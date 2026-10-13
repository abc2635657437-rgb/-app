const agent='TravelWorld/1.0 (+https://travel-world-mwdw.onrender.com)';
const cache=new Map();
export function imageIds(value){const ids=[...new Set(String(value||'').split('|'))];if(!ids.length||ids.length>24||ids.some(id=>!/^Q\d+$/.test(id)))throw new Error('Invalid place IDs');return ids;}
async function json(url){const r=await fetch(url,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Photo source unavailable');const d=await r.json();if(d.error)throw new Error('Photo source unavailable');return d;}
const plain=v=>String(v||'').replace(/<[^>]*>/g,'').slice(0,300);
export function installPlaceImages(app){
  app.get('/api/map/place-images',async(req,res)=>{
    let ids;try{ids=imageIds(req.query.ids);}catch(_){return res.status(400).json({error:'Invalid place IDs'});}
    try{
      const missing=ids.filter(id=>!cache.has(id));
      if(missing.length){
        const entities=await json('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids='+missing.join('|'));
        const files=new Map();missing.forEach(id=>{const file=entities.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;if(typeof file==='string'&&/\.(jpe?g|webp|png)$/i.test(file)&&!/(?:\bflag\b|coat of arms|\blogo\b|\bmap\b|\bdrawing\b|\bpainting\b)/i.test(file))files.set(id,file);});
        const pages=files.size?await json('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=240&titles='+encodeURIComponent([...new Set(files.values())].map(f=>'File:'+f).join('|'))):{};
        const byTitle=new Map(Object.values(pages.query?.pages||{}).map(p=>[p.title?.replace(/^File:/,''),p.imageinfo?.[0]]));
        missing.forEach(id=>{const file=files.get(id),info=byTitle.get(file),meta=info?.extmetadata||{},url=info?.thumburl||info?.url;
          const photo=url&&/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url)&&meta.LicenseShortName?.value?{url:url.replace('https://upload.wikimedia.org/','https://thumb.wikimedia.org/'),sourceUrl:info.descriptionurl,credit:plain(meta.Artist?.value),license:plain(meta.LicenseShortName?.value),licenseUrl:meta.LicenseUrl?.value||'',file,placeId:id}:null;
          if(cache.size>=2000)cache.delete(cache.keys().next().value);cache.set(id,photo);
        });
      }
      res.json({photos:Object.fromEntries(ids.map(id=>[id,cache.get(id)])),provider:'Wikidata P18 / Wikimedia Commons'});
    }catch(_){res.status(502).json({error:'Place photographs are unavailable. No substitute image was used.'});}
  });
}
