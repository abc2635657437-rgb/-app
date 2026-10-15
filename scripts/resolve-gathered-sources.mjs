// Resolve one real, attributable source photograph per landmark in the
// 100-landmark Gathered production queue (modules/data/background-priority-100.json).
// Free step: no image generation, no credits. Produces:
//   - assets/route-photos/<qid>-source.jpg  (downloaded reference photograph)
//   - modules/data/gathered-sources.json    (manifest: author / license / source URL)
import {readFile,writeFile,mkdir,access,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const agent='TravelWorld/1.0 (+https://travel-world-mwdw.onrender.com)';
const REUSE={ // already downloaded under the older, hand-made slugs
  Q12501:'great-wall-source.jpg',Q9202:'liberty-source.jpg',Q45178:'sydney-opera-source.jpg',
  Q10866444:'west-lake-source.jpg',Q243:'q243-source.jpg',Q9141:'q9141-source.jpg',Q19675:'q19675-source.jpg'
};
const badFile=/(?:\bflag\b|coat of arms|\blogo\b|\bmap\b|\bdrawing\b|\bpainting\b|plan\b|diagram)/i;
const plain=v=>String(v||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,200);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function json(url,tries=4){
  for(let i=0;i<tries;i++){
    try{
      const r=await fetch(url,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(25000)});
      if(r.status===429||r.status>=500){await sleep(1200*(i+1));continue;}
      if(!r.ok)throw new Error('HTTP '+r.status);
      const d=await r.json();if(d.error)throw new Error(d.error.code||'api error');return d;
    }catch(e){if(i===tries-1)throw e;await sleep(900*(i+1));}
  }
}

const priority=JSON.parse(await readFile(new URL('modules/data/background-priority-100.json',root),'utf8'));
const entries=priority.entries;
console.log('queue entries:',entries.length);

// 1. Wikidata P18 (image) in batches of 50
const files=new Map();
for(let i=0;i<entries.length;i+=50){
  const batch=entries.slice(i,i+50).map(e=>e.id);
  const d=await json('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids='+batch.join('|'));
  batch.forEach(id=>{
    const f=d.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if(typeof f==='string'&&/\.(jpe?g|png|webp)$/i.test(f)&&!badFile.test(f))files.set(id,f);
  });
  await sleep(300);
}
console.log('P18 resolved:',files.size,'/ missing:',entries.length-files.size);

// 2. Commons imageinfo: 1600px thumbnail + license metadata, in batches of 40 titles
const byTitle=new Map();
const titles=[...new Set([...files.values()])];
for(let i=0;i<titles.length;i+=40){
  const chunk=titles.slice(i,i+40);
  const d=await json('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1600&titles='+encodeURIComponent(chunk.map(t=>'File:'+t).join('|')));
  Object.values(d.query?.pages||{}).forEach(p=>byTitle.set(String(p.title||'').replace(/^File:/,''),p.imageinfo?.[0]));
  await sleep(300);
}

// 3. Download + manifest
const dir=new URL('assets/route-photos/',root);
await mkdir(dir,{recursive:true});
const manifest={};
let downloaded=0,reused=0,skipped=0;
for(const e of entries){
  const id=e.id,slug=id.toLowerCase();
  const existing=REUSE[id]||(slug+'-source.jpg');
  let localFile=null;
  try{await access(new URL(existing,dir));localFile=existing;reused++;}
  catch(_){
    const file=files.get(id),info=byTitle.get(file),url=info?.thumburl||info?.url;
    if(!file||!url){skipped++;console.log('  no source:',id,e.name_en);continue;}
    const r=await fetch(url,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(45000)});
    if(!r.ok){skipped++;console.log('  download failed:',id,r.status);continue;}
    const buf=Buffer.from(await r.arrayBuffer());
    localFile=slug+'-source.jpg';
    await writeFile(new URL(localFile,dir),buf);
    downloaded++;
  }
  const file=files.get(id),info=byTitle.get(file),meta=info?.extmetadata||{};
  manifest[id]={
    id,name:e.name_en||e.name,priority:e.priority,city:e.city,countryCode:e.countryCode,
    localFile:'assets/route-photos/'+localFile,
    commonsTitle:file||null,
    sourceUrl:info?.descriptionurl||('https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file||'')),
    sourceAuthor:plain(meta.Artist?.value)||'Unknown',
    license:plain(meta.LicenseShortName?.value)||'',
    licenseUrl:meta.LicenseUrl?.value||'',
    thumbWidth:info?.thumbwidth||null,thumbHeight:info?.thumbheight||null
  };
  await sleep(120);
}

await writeFile(new URL('modules/data/gathered-sources.json',root),JSON.stringify({
  purpose:'One real, attributable reference photograph per landmark in the 100-landmark Gathered queue. Not the generated artwork.',
  agent,resolved:Object.keys(manifest).length,downloaded,reused,missing:entries.length-Object.keys(manifest).length,
  generatedOn:new Date().toISOString().slice(0,10),sources:manifest
},null,2));

const noLicense=Object.values(manifest).filter(m=>!m.license).map(m=>m.id);
console.log(JSON.stringify({resolved:Object.keys(manifest).length,downloaded,reused,skipped,noLicense},null,1));
