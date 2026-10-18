import {readFile} from 'node:fs/promises';
export function parseBounds(value){
  const parts=String(value??'').split(',');if(parts.length!==4||parts.some(p=>!p.trim()))throw new Error('Invalid bounds');
  const b=parts.map(Number),[s,w,n,e]=b;
  if(b.some(v=>!Number.isFinite(v))||s>=n||w>=e||s< -85||n>85||w< -180||e>180||(n-s)*(e-w)>2000)throw new Error('Invalid bounds');return b;
}
let pending;
export async function mapCatalog(){
  if(!pending)pending=readFile(new URL('../modules/data/map-place-catalog.json',import.meta.url),'utf8').then(JSON.parse).catch(e=>{pending=null;throw e;});return pending;
}

// Latitude-sorted view of the catalogue, built once and reused for every viewport.
// A full scan of 24,924 places costs ~3 ms of CPU per request plus a 4.5 MB JSON parse
// on a cold instance; a binary search costs microseconds and stays O(log n + k).
let index=null;
export async function placeIndex(){
  if(index)return index;
  const catalog=await mapCatalog();
  const sorted=catalog.places.slice().sort((a,b)=>a.latitude-b.latitude);
  const lats=new Float64Array(sorted.length);
  for(let i=0;i<sorted.length;i++)lats[i]=sorted[i].latitude;
  index={catalog,sorted,lats};
  return index;
}
function lowerBound(lats,value){
  let lo=0,hi=lats.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(lats[mid]<value)lo=mid+1;else hi=mid;}
  return lo;
}
export function placesInBoundsIndexed(idx,[s,w,n,e]){
  const {sorted,lats}=idx,out=[],total=lats.length;
  for(let i=lowerBound(lats,s);i<total;i++){
    if(lats[i]>e)break;
    const p=sorted[i];
    if(p.longitude>=w&&p.longitude<=e)out.push(p);
    if(out.length>=400)break;
  }
  return out;
}
// Kept for the existing test-suite and for callers that already hold a plain array.
export function placesInBounds(places,[s,w,n,e]){return places.filter(p=>p.latitude>=s&&p.latitude<=n&&p.longitude>=w&&p.longitude<=e);}
export const regionCountries={china:['CN'],asia:'CN JP KR KP TW HK MO SG MY TH VN ID PH KH LA MM BN TL IN NP BT BD LK PK MV MN KZ UZ KG TJ TM AF IR IQ IL PS JO LB SY SA AE QA BH KW OM YE GE AM AZ TR'.split(' '),europe:'GB FR DE ES PT IT IE NL BE LU CH AT LI DK NO SE FI IS PL CZ SK HU RO BG GR AL ME RS BA HR SI MK EE LV LT UA BY MD RU MT CY'.split(' '),'north-america':'US CA MX GT BZ HN SV NI CR PA CU JM HT DO BS BB TT GD LC VC AG DM KN'.split(' '),'south-america':'BR AR CL PE BO EC CO VE UY PY GY SR GF'.split(' '),africa:'ZA EG MA TN DZ LY SD SS ET ER DJ SO KE TZ UG RW BI CD CG GA GQ CM CF TD NE NG BJ TG GH CI LR SL GN GW SN GM MR ML BF CV ST AO ZM ZW MW MZ NA BW SZ LS MG MU SC KM'.split(' '),oceania:'AU NZ FJ PG SB VU NC PF WS TO TV KI FM MH PW NR'.split(' ')};
regionCountries.world=[];
export function regionPlaces(places,region,country=''){
  if(region==='world')return places.filter(p=>!country||p.countryCode===country);
  return places.filter(p=>(regionCountries[region]||[]).includes(p.countryCode)&&(!country||p.countryCode===country));
}

export function popularCityPlaces(places,region='world',country='',limit=1000){
  const cities=new Map();
  for(const place of places){
    if(!place.city||!place.countryCode)continue;
    const key=place.countryCode+'|'+place.city.trim().toLocaleLowerCase();
    const current=cities.get(key);
    if(!current||(place.rank||0)>(current.rank||0))cities.set(key,{...place,destinationCity:place.city,cityPlaceCount:(current?.cityPlaceCount||0)+1});
    else current.cityPlaceCount++;
  }
  return regionPlaces([...cities.values()],region,country)
    .sort((a,b)=>(b.rank||0)-(a.rank||0)||a.destinationCity.localeCompare(b.destinationCity))
    .slice(0,Math.max(0,Math.min(1000,limit)));
}

// Small bbox cache: panning back and forth reuses the same payload instead of
// re-filtering and re-serialising it.
const cache=new Map();
const CACHE_MAX=400;
const CACHE_TTL=10*60*1000;
function cacheGet(key){const hit=cache.get(key);if(!hit)return null;if(Date.now()-hit.at>CACHE_TTL){cache.delete(key);return null;}cache.delete(key);cache.set(key,hit);return hit.value;}
function cacheSet(key,value){if(cache.size>=CACHE_MAX)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),value});}

export function installMapPlaces(app){
  app.get('/api/map/destinations',async(req,res)=>{
    const region=String(req.query.region||'china'),country=String(req.query.country||''),page=Number(req.query.page||0);
    if(!regionCountries[region]||(country&&!/^[A-Z]{2}$/.test(country))||!Number.isInteger(page)||page<0||page>2000)return res.status(400).json({error:'Invalid destination filter'});
    try{
      const idx=await placeIndex(),popular=popularCityPlaces(idx.catalog.places,region,'',1000),matches=regionPlaces(popular,region,country);
      const countries=[...new Set(popular.map(p=>p.countryCode))].sort();
      res.set('Cache-Control','public, max-age=120');
      res.json({places:matches.slice(page*8,page*8+8).map(p=>({...p,sourceUrl:'https://www.wikidata.org/wiki/'+p.id})),total:matches.length,countries,page,pageSize:8,license:idx.catalog.license,attribution:idx.catalog.attribution,rankBasis:'Source-provided rank from the curated Wikidata-derived place catalogue; it is not visitor-count data.'});
    }catch(_){res.status(503).json({error:'Destination directory unavailable'});}
  });
  app.get('/api/map/places',async(req,res)=>{
    let bounds;try{bounds=parseBounds(req.query.bbox);}catch(_){return res.status(400).json({error:'Invalid map bounds; zoom in and retry.'});}
    const key=bounds.map(v=>v.toFixed(3)).join(',');
    const hit=cacheGet(key);if(hit)return res.json(hit);
    try{
      const idx=await placeIndex(),matches=placesInBoundsIndexed(idx,bounds),catalog=idx.catalog;
      const places=matches.slice(0,400).map(p=>({...p,sourceUrl:'https://www.wikidata.org/wiki/'+p.id,provider:'Audiala open directory',license:catalog.license,verification:'Third-party place directory; verify access and current conditions.'}));
      const payload={places,totalInView:matches.length,limited:matches.length>400,provider:catalog.attribution,sourceUrl:catalog.sourceUrl,license:catalog.license,licenseUrl:catalog.licenseUrl,sourceGeneratedAt:catalog.sourceGeneratedAt};
      cacheSet(key,payload);
      res.set('Cache-Control','public, max-age=120, stale-while-revalidate=600');
      res.json(payload);
    }catch(_){res.status(503).json({error:'Place directory unavailable. Existing landmarks remain visible.'});}
  });
}
