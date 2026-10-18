import { readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../', import.meta.url), dataRoot = new URL('modules/data/', root);
const catalog = JSON.parse(await readFile(new URL('global-landmark-guide-catalog.json', dataRoot), 'utf8'));
const covers = JSON.parse(await readFile(new URL('global-landmark-guide-assets.json', dataRoot), 'utf8'));
const sourcePhotos = JSON.parse(await readFile(new URL('global-landmark-guide-images.json', dataRoot), 'utf8'));
const cachePath = new URL('global-guide-section-photo-cache.json', dataRoot);
const outputPath = new URL('global-guide-section-images.json', dataRoot);
const lockPath = new URL(cachePath.href + '.lock');
let lock;
try { lock = await open(lockPath, 'wx'); await lock.writeFile(String(process.pid)); }
catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const pid = Number(await readFile(lockPath, 'utf8'));
  try { process.kill(pid, 0); console.log(`Section image builder already running (${pid})`); process.exit(0); }
  catch { await unlink(lockPath); lock = await open(lockPath, 'wx'); await lock.writeFile(String(process.pid)); }
}
let previousCache = { regions: {}, play: {}, places: {} };
let cache = { places: {} };
let sourcePaused = false;
let sourcePauseReason = null;
let openversePaused = false;
let wordpressPaused = false;
let commonsPaused = false;
let searchStartAt = 0;
let searchGate = Promise.resolve();
const searchCache = new Map();
const commonsSearchCache = new Map();
try { previousCache = JSON.parse(await readFile(cachePath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const words = value => normalize(plainText(value)).replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const hasPhrase = (identity, phrase) => { const haystack=` ${words(identity)} `,needle=` ${words(phrase)} `; return needle.length>2&&haystack.includes(needle); };
const plainText = value => String(value || '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#8217;|&#039;/g,"'").replace(/&#8211;/g,'-').replace(/&quot;/g,'"').replace(/&#([0-9]+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g,' ').trim();
const countryFor = p => p.countryNameEn || p.country_en || p.country;
const regionKey = p => `${p.countryCode}:${normalize(p.city_en || p.city || '')}`;
const kinds = ['eat','drink','play','joy','stay','go'];
const countryNames = p => [...new Set([countryFor(p),p.countryName,p.country,...({US:['USA','United States'],GB:['UK','Britain'],KR:['Korea'],CN:['China','中国'],JP:['Japan']}[p.countryCode]||[])].filter(Boolean))];
const countryAliases = [...new Set(catalog.places.flatMap(countryNames))].filter(Boolean);
const mentionsAnotherCountryLocation = (identity, place) => {
  const text = words(identity), allowed = new Set(countryNames(place).map(normalize));
  return countryAliases.some(name => {
    const normalized = normalize(name);
    if (!normalized || allowed.has(normalized)) return false;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|\\s)(?:in|near|from|within|at|located in|photographed in)\\s+(?:the\\s+)?${escaped}(?:\\s|$)`, 'i').test(text);
  });
};
const guideCity = p => {
  const city=p.city_en||p.city;
  if(city)return city;
  const name=p.name_en||p.name,query=plainText(p.imageQuery||'').trim();
  if(!name||!query)return '';
  let remainder=query.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*`,'i'),'').trim();
  for(const country of countryNames(p).sort((a,b)=>b.length-a.length)){
    if(normalize(remainder).endsWith(normalize(country))) { remainder=remainder.slice(0,remainder.length-country.length).trim(); break; }
  }
  return remainder;
};
const queries = {
  eat:['restaurant','food','cuisine'],
  drink:['cafe','coffee','beverage','tea'],
  play:['landmark','attraction'],
  joy:['music','theatre','festival','concert','dance'],
  stay:['hotel','resort','hostel'],
  go:['train','bus','metro','transport','taxi']
};
const countriesByCity = new Map();
for (const place of catalog.places) {
  const city = normalize(guideCity(place));
  if (!city) continue;
  if (!countriesByCity.has(city)) countriesByCity.set(city, new Set());
  countriesByCity.get(city).add(place.countryCode);
}
const locationMatches = (identity, place, photo) => {
  if (photo?.locationVerified === 'within-10km') return true;
  if (mentionsAnotherCountryLocation(identity, place)) return false;
  const city = guideCity(place);
  if (!city) return photo?.provider !== 'Wikimedia Commons' && countryNames(place).some(name => hasPhrase(identity, name));
  const cityMatch = localNames(place).some(name => hasPhrase(identity, name));
  if (!cityMatch) return false;
  const countrySet = countriesByCity.get(normalize(city));
  return !countrySet || countrySet.size < 2 || countryNames(place).some(name => hasPhrase(identity, name));
};
const categoryMatches = {
  eat:/food|cuisin|dish|meal|dining|restaurant|breakfast|dinner|lunch|market|noodle|seafood|rice|curry|pizza|taco|bread|soup|grill|burger|sushi|steak/i,
  drink:/caf[eé]|coffee|espresso|cappuccino|roast|latte|tea.?house|teahouse|teashop|beverage|juice|drink/i,
  joy:/theat|perform|concert|music|festival|dance|opera|nightlife|cultur|entertain|stage|orchestra|jazz/i,
  stay:/hotel|hostel|resort|guest.?house|guest.?room|accommodation|bedroom|lodge|suite|motel/i,
  go:/transit|transport|rail|train|bus\b|metro|subway|tram|taxi|station|ferry|cycling|bicycle/i,
  play:/landmark|attraction|monument|temple|palace|castle|mountain|waterfall|beach|park|lake|bridge|garden|museum|tower|historic|heritage|viewpoint|island|wall/i
};
const unsuitable = /\b(?:mascots?|souvenirs?|figurines?|selfies?|portraits?|t-shirts?|posters?|logos?|stickers?|paintings?|engravings?|drawings?|postcards?|maps?|insect hotels?)\b/i;
const localNames = p => {
  const city=guideCity(p);
  if(city)return [...new Set([city,city.replace(/^mueang\s+/i,'')].filter(Boolean))];
  return countryNames(p);
};
const identifiers = photo => [photo.remoteSrc,photo.sourceUrl,photo.unique,photo.src].filter(Boolean);
const keyOf = photo => identifiers(photo).map(String);
const atomic = async (path, value) => { const temp = new URL(path.href + '.tmp'); await writeFile(temp, JSON.stringify(value)); await rename(temp,path); };
async function searchCommons(q, place) {
  if (commonsPaused) return [];
  const hasCoordinates = Number.isFinite(Number(place?.latitude)) && Number.isFinite(Number(place?.longitude));
  const city = guideCity(place);
  if (!hasCoordinates && !city) return [];
  const useGeosearch = !city && hasCoordinates;
  const key = useGeosearch ? `${place.id}:${place.latitude}:${place.longitude}` : `${city}:${q}`;
  if (commonsSearchCache.has(key)) return commonsSearchCache.get(key);
  const task = (async () => {
    const params = useGeosearch
      ? {action:'query',generator:'geosearch',ggscoord:`${place.latitude}|${place.longitude}`,ggsradius:'10000',ggslimit:'40',ggsnamespace:'6',prop:'imageinfo|categories|coordinates',iiprop:'url|extmetadata',iiurlwidth:'1200',cllimit:'30',clshow:'!hidden',format:'json',origin:'*'}
      : {action:'query',generator:'search',gsrsearch:q,gsrnamespace:'6',gsrlimit:'40',prop:'imageinfo|categories',iiprop:'url|extmetadata',iiurlwidth:'1200',cllimit:'30',clshow:'!hidden',format:'json',origin:'*'};
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams(params)}`,{signal:AbortSignal.timeout(20000),headers:{'user-agent':'TravelWorldGuide/1.0 (licensed image discovery)'}});
    if (!response.ok) { if ([401,403,429].includes(response.status)) commonsPaused=true; return []; }
    const pages=Object.values((await response.json()).query?.pages||{});
    const distanceKm=(a,b)=>{const radians=value=>value*Math.PI/180,lat=radians(b.latitude-a.latitude),lon=radians(b.longitude-a.longitude),h=Math.sin(lat/2)**2+Math.cos(radians(a.latitude))*Math.cos(radians(b.latitude))*Math.sin(lon/2)**2;return 12742*Math.asin(Math.sqrt(h));};
    return pages.map(page=>{
      const info=page.imageinfo?.[0],meta=info?.extmetadata||{},licenseLabel=plainText(meta.LicenseShortName?.value||'');
      const license=/^CC0\b/i.test(licenseLabel)?'cc0':/public domain|\bpdm\b/i.test(licenseLabel)?'pdm':/CC BY-SA/i.test(licenseLabel)?'by-sa':/^CC BY\b/i.test(licenseLabel)?'by':'';
      const licenseVersion=licenseLabel.match(/\b[0-9]+(?:\.[0-9]+)?\b/)?.[0]||'';
      const coordinatesFound=page.coordinates?.[0];
      const distance=useGeosearch&&coordinatesFound?distanceKm(place,{latitude:coordinatesFound.lat,longitude:coordinatesFound.lon}):Infinity;
      return {id:`commons-${page.pageid}`,unique:`commons-${page.pageid}`,title:plainText(page.title?.replace(/^File:/,'')),description:plainText(meta.ImageDescription?.value||''),tags:(page.categories||[]).map(category=>category.title?.replace(/^Category:/,'')||''),thumbnail:info?.thumburl||info?.url,creator:plainText(meta.Artist?.value||''),license,licenseLabel,license_version:licenseVersion,license_url:(meta.LicenseUrl?.value||'').replace(/^http:/i,'https:'),foreign_landing_url:info?.descriptionurl||'',provider:'Wikimedia Commons',source:'Wikimedia Commons',locationVerified:distance<=10?'within-10km':'',distanceKm:Number.isFinite(distance)?Number(distance.toFixed(2)):null};
    }).filter(photo=>photo.license&&photo.thumbnail&&photo.license_url&&photo.foreign_landing_url&&(photo.license==='cc0'||photo.license==='pdm'||photo.creator)&&(!useGeosearch||photo.locationVerified==='within-10km'));
  })();
  commonsSearchCache.set(key,task);
  try { return await task; } catch { commonsSearchCache.delete(key); return []; }
}
async function search(q, place) {
  const queryKey=`${q.toLocaleLowerCase()}::${place?.id||''}`;
  if(searchCache.has(queryKey))return searchCache.get(queryKey);
  const task=(async()=>{
  const previous = searchGate;
  let release;
  searchGate = new Promise(resolve => { release = resolve; });
  await previous;
  await delay(Math.max(0, 2500 - (Date.now() - searchStartAt)));
  searchStartAt = Date.now();
  release();
  let openverseItems=[];
  if(!openversePaused){
    const openverseUrl='https://api.openverse.org/v1/images/?'+new URLSearchParams({q,license:'cc0,by,by-sa,pdm',page_size:'30',excluded_source:'wikimedia'});
    let openverse;
    for(let attempt=0;attempt<3;attempt++){
      openverse=await fetch(openverseUrl,{signal:AbortSignal.timeout(20000),headers:{'user-agent':'TravelWorldGuide/1.0 (open-license image lookup)'}});
      if((openverse.ok&&openverse.headers.get('content-type')?.includes('application/json'))||![401,403,429,500,502,503,504].includes(openverse.status)||attempt===2)break;
      const retryAfter=Number(openverse.headers.get('retry-after'))*1000;
      await delay(retryAfter||1500*(attempt+1));
    }
    if(openverse.ok&&openverse.headers.get('content-type')?.includes('application/json')){
      openverseItems=(await openverse.json()).results.map(image=>({
        id:image.id,title:plainText(image.title||q),description:'',tags:(image.tags||[]).map(tag=>tag.name),
        thumbnail:image.url||image.thumbnail,creator:image.creator||'Creator not listed',license:image.license,
        license_version:image.license_version,license_url:image.license_url,foreign_landing_url:image.foreign_landing_url,
        provider:image.provider,source:image.source
      }));
    }else if([401,403,429].includes(openverse.status)||openverse.ok){openversePaused=true;sourcePauseReason=`Openverse returned an unavailable response (${openverse.status}, ${openverse.headers.get('content-type')||'unknown content type'}); continuing with the secondary source only`;}
  }
  let wordpressItems=[];
  if(!wordpressPaused){
    const wpUrl='https://wordpress.org/photos/wp-json/wp/v2/media?'+new URLSearchParams({search:q,per_page:'100',_embed:'1'});
    for(let attempt=0;attempt<2;attempt++){
      const response=await fetch(wpUrl,{signal:AbortSignal.timeout(20000)});
      if([429,403,401].includes(response.status)){wordpressPaused=true;break;}
      if(response.status>=500){await delay(Math.min(30000,Number(response.headers.get('retry-after'))*1000||3000*(attempt+1)));continue;}
      if(!response.ok)break;
      wordpressItems=(await response.json()).map(image=>{
        const tags=(image._embedded?.['wp:term']||[]).flat().map(term=>term.name);
        return {id:`wp-${image.id}`,title:plainText(image.caption?.rendered||image.alt_text||image.description?.rendered||image.title?.rendered||q),description:plainText(image.description?.rendered||''),tags,thumbnail:image.media_details?.sizes?.medium_large?.source_url||image.media_details?.sizes?.large?.source_url||image.source_url,creator:image._embedded?.author?.[0]?.name||'Creator not listed',license:'cc0',license_version:'1.0',license_url:'https://wordpress.org/photos/license/',foreign_landing_url:image.link||'https://wordpress.org/photos/',provider:'WordPress Photo Directory',source:'WordPress Photo Directory'};
      });
      break;
    }
  }
  const commonsItems=await searchCommons(q,place);
  if(openversePaused&&wordpressPaused&&commonsPaused){sourcePaused=true;sourcePauseReason=sourcePauseReason||'Openverse, WordPress Photo Directory, and Wikimedia Commons are temporarily unavailable';}
  return [...openverseItems,...wordpressItems,...commonsItems];
  })();
  searchCache.set(queryKey,task);
  try{return await task;}catch(error){searchCache.delete(queryKey);throw error;}
}
function imageRecord(photo, scope, place) {
  const remoteSrc=photo.thumbnail||photo.remoteSrc||photo.src;
  return {src:remoteSrc,remoteSrc,unique:photo.unique||photo.id||'',title:plainText(photo.title),description:plainText(photo.description||''),tags:(photo.tags||[]).map(tag=>typeof tag==='string'?tag:tag.name).filter(Boolean),creator:photo.creator||'Creator not listed',license:photo.licenseLabel||(photo.license_version?`${photo.license} ${photo.license_version}`:photo.license),licenseUrl:photo.license_url||photo.licenseUrl,sourceUrl:photo.foreign_landing_url||photo.sourceUrl,provider:photo.provider||photo.source||'WordPress Photo Directory',scope,locationVerified:photo.locationVerified||(photo.provider==='Wikimedia Commons'&&guideCity(place)?'city-metadata-match':''),distanceKm:photo.distanceKm??null};
}
async function resolvePhotos(place, kind, existing=[]) {
  const result = [...existing], geographic = localNames(place);
  const names = [place.name_en,place.name].filter(Boolean).map(normalize);
  const city = guideCity(place);
  const country = countryFor(place);
  const terms=kind==='drink'&&place.countryCode!=='CN'?['cafe','coffee','beverage','juice','drink']:queries[kind];
  const locations = kind==='play'
    ? [[place.name_en||place.name,city,country].filter(Boolean).join(' ')]
    : geographic.map(location=>city&&country?`${location} ${country}`:location);
  const variants = locations.flatMap(location=>terms.map(term=>`${location} ${term}`));
  for (const q of [...new Set(variants.filter(Boolean))]) {
    if (sourcePaused) break;
    let found; try { found=await search(q,place); } catch { if (sourcePaused) break; continue; }
    for (const photo of found) {
      const identity=normalize(plainText([photo.title,photo.description,...(photo.tags||[])].flat().join(' '))), source=`${photo.source} ${photo.provider} ${photo.foreign_landing_url}`;
      const commonsFile=photo.provider==='Wikimedia Commons'&&/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(photo.foreign_landing_url||'');
      if (unsuitable.test(plainText(photo.title)) || /wikipedia\.org/i.test(source) || (/wikimedia/i.test(source)&&!commonsFile) || !['by','by-sa','cc0','pdm'].includes(photo.license)) continue;
      if (!/^https:\/\//.test(photo.thumbnail||'') || !/^https:\/\//.test(photo.license_url||'') || !/^https:\/\//.test(photo.foreign_landing_url||'')) continue;
      const locationMatch=kind==='play'
        ? names.some(n=>hasPhrase(identity,n))
        : locationMatches(identity,place,photo);
      if (!locationMatch || !categoryMatches[kind].test(identity)) continue;
      if (kind==='drink' && place.countryCode!=='CN' && /tea.?house|teahouse|teashop|tea shop/i.test(plainText([photo.title,...(photo.tags||[])].flat().join(' ')))) continue;
      const record=imageRecord(photo,countryFor(place),place);
      if (result.some(p=>keyOf(p).some(k=>keyOf(record).includes(k))) || keyOf(record).some(k=>usedSources.has(k))) continue;
      keyOf(record).forEach(k=>usedSources.add(k));
      result.push(record);
      if (result.length>=2) return result.slice(0,2);
    }
  }
  return result.slice(0,2);
}
function manifest() {
  const places={}; let completedSections=0,images=0;
  for (const place of catalog.places) {
    const sections={};
    for (const kind of kinds) sections[kind]=cache.places[place.id]?.[kind]?.photos||[];
    for (const photos of Object.values(sections)) { images+=photos.length; if(photos.length>=2)completedSections++; }
    places[place.id]=sections;
  }
  const fullyIllustratedPlaces=Object.values(places).filter(sections=>kinds.every(kind=>sections[kind].length>0)).length;
  const fullyTwoPhotoPlaces=Object.values(places).filter(sections=>kinds.every(kind=>sections[kind].length>=2)).length;
  const uniquePhotos=new Set(Object.values(places).flatMap(sections=>Object.values(sections).flatMap(photos=>photos.map(photo=>photo.remoteSrc||photo.unique||photo.sourceUrl||photo.src).filter(Boolean))));
  return {version:2,updatedAt:new Date().toISOString(),total:1000,requiredSections:6000,completedSections,fullyIllustratedPlaces,fullyTwoPhotoPlaces,displayImageSlots:images,requiredImageSlots:12000,uniquePhotoAssets:uniquePhotos.size,places};
}
cache={places:previousCache.places||{}};
const placeByRegion=new Map();
for(const place of catalog.places)if(!placeByRegion.has(regionKey(place)))placeByRegion.set(regionKey(place),place);
for(const [id,entry] of Object.entries(previousCache.play||{}))if(entry?.photos?.length)cache.places[id]={...(cache.places[id]||{}),play:entry};
for(const [compound,entry] of Object.entries(previousCache.regions||{})) {
  const split=compound.lastIndexOf(':'); if(split<0)continue;
  const region=compound.slice(0,split),kind=compound.slice(split+1),place=placeByRegion.get(region);
  if(place&&kinds.includes(kind)&&entry?.photos?.length&&!cache.places[place.id]?.[kind])cache.places[place.id]={...(cache.places[place.id]||{}),[kind]:entry};
}
for(const place of catalog.places)for(const kind of ['eat','drink','joy','stay','go']){
  const section=cache.places[place.id]?.[kind]; if(!section?.photos)continue;
  const before=section.photos.length;
  section.photos=section.photos.filter(photo=>{
    if(!['WordPress Photo Directory','Openverse','Wikimedia Commons'].includes(photo.provider))return true;
    const identity=words([photo.title,photo.description,...(photo.tags||[])].flat().join(' '));
    const city=guideCity(place);
    const locationMatch=locationMatches(identity,place,photo);
    return categoryMatches[kind].test(identity)&&locationMatch;
  });
  if(section.photos.length<before&&section.photos.length<2)section.checkedAt='2000-01-01T00:00:00.000Z';
}
const usedSources=new Set();
const candidatePhotos=new Map();
for(const place of catalog.places){
  const seen=new Set(),candidates=[...(covers.places[place.id]?.photos||[]),...(sourcePhotos.places[place.id]?.photos||[])].filter(photo=>{
    const keys=keyOf(photo);
    if(!keys.length||keys.some(key=>seen.has(key))||unsuitable.test(photo.title||''))return false;
    keys.forEach(key=>seen.add(key));return true;
  });
  candidatePhotos.set(place.id,candidates);
  if(candidates[0])keyOf(candidates[0]).forEach(key=>usedSources.add(key));
}
for(const place of catalog.places)for(const kind of ['play','eat','drink','joy','stay','go']){
  const section=cache.places[place.id]?.[kind]; if(!section?.photos)continue;
  const before=section.photos.length;
  section.photos=section.photos.filter(photo=>{
    if(photo.provider==='Wikimedia Commons'){
      const identity=words([photo.title,photo.description,...(photo.tags||[])].flat().join(' '));
      if(!locationMatches(identity,place,photo))return false;
      if(!photo.locationVerified&&guideCity(place))photo.locationVerified='city-metadata-match';
    }
    const keys=keyOf(photo);if(!keys.length||keys.some(key=>usedSources.has(key)))return false;keys.forEach(key=>usedSources.add(key));return true;
  });
  if(section.photos.length<before&&section.photos.length<2)section.checkedAt='2000-01-01T00:00:00.000Z';
}
for(const place of catalog.places){
  if(!cache.places[place.id])cache.places[place.id]={};
  const play=cache.places[place.id].play?.photos||[];
  for(const photo of candidatePhotos.get(place.id).slice(1)){
    if(play.length>=2)break;
    const keys=keyOf(photo); if(!keys.length||keys.some(key=>usedSources.has(key)))continue;
    play.push(photo); keys.forEach(key=>usedSources.add(key));
  }
  cache.places[place.id].play={photos:play.slice(0,2),checkedAt:cache.places[place.id].play?.checkedAt||new Date().toISOString()};
}
const jobs=[];
const retryAfterMs=24*60*60*1000;
const retryIncomplete=process.argv.includes('--retry-incomplete');
const localOnly=process.argv.includes('--local-only');
const placeOnly=process.argv.find(argument=>argument.startsWith('--place='))?.split('=')[1];
const kindOnly=process.argv.find(argument=>argument.startsWith('--kind='))?.split('=')[1];
for(const place of catalog.places)for(const kind of kinds){
  if(placeOnly&&place.id!==placeOnly||kindOnly&&kind!==kindOnly)continue;
  const section=cache.places[place.id]?.[kind]||{};
  if((section.photos?.length||0)>=2)continue;
  if(!retryIncomplete&&section.checkedAt&&Date.now()-Date.parse(section.checkedAt)<retryAfterMs)continue;
  if(!localOnly)jobs.push({key:place.id,place,kind});
}
const firstWave=['CN','US','JP','ID','MY','VN','TH','PH','SG','KH','LA','MM','BN','TL'];
jobs.sort((a,b)=>{
  const pa=firstWave.indexOf(a.place.countryCode),pb=firstWave.indexOf(b.place.countryCode);
  return (pa<0?firstWave.length:pa)-(pb<0?firstWave.length:pb)||Number(b.place.rank||0)-Number(a.place.rank||0)||kinds.indexOf(a.kind)-kinds.indexOf(b.kind);
});
const limitArg=process.argv.find(argument=>argument.startsWith('--limit='));
if(limitArg)jobs.length=Math.min(jobs.length,Math.max(0,Number(limitArg.split('=')[1])||0));
let cursor=0,complete=0,saves=Promise.resolve();
const save=()=>{const a=JSON.stringify(cache),b=JSON.stringify(manifest());saves=saves.then(async()=>{await atomic(cachePath,JSON.parse(a));await atomic(outputPath,JSON.parse(b));});return saves;};
try {
  await save();
  if(!localOnly)await Promise.all(Array.from({length:2},async()=>{while(cursor<jobs.length && !sourcePaused){const job=jobs[cursor++],prior=cache.places[job.key]?.[job.kind]?.photos||[];cache.places[job.key][job.kind]={photos:await resolvePhotos(job.place,job.kind,prior),checkedAt:new Date().toISOString()};complete++;if(complete%10===0||complete===jobs.length){await save();const m=manifest();console.log(`Place categories checked ${complete}/${jobs.length}; two-photo categories ${m.completedSections}/6000; image slots ${m.displayImageSlots}/12000; places with every category pictured ${m.fullyIllustratedPlaces}/1000; places with two photos in all six ${m.fullyTwoPhotoPlaces}/1000`);}await delay(150);}}));
  await save(); console.log(JSON.stringify({jobs:jobs.length,localOnly,sourcePaused,openversePaused,wordpressPaused,commonsPaused,sourcePauseReason:sourcePaused?`${sourcePauseReason}; saved progress can resume.`:openversePaused?sourcePauseReason:null,...Object.fromEntries(Object.entries(manifest()).filter(([key])=>key!=='places'))}));
} finally {await lock.close();await unlink(lockPath);}
