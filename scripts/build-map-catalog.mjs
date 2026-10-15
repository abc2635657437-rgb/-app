// Mechanical reduction of downloaded CC BY 4.0 data; no guide text or photos copied.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const raw=JSON.parse(await readFile(new URL('../modules/data/audiala-places.geojson',import.meta.url),'utf8'));
const seen=new Set(),places=[];
const excluded=new Set(['building','stadium','university','library','locality','town','village','street','neighbourhood','restaurant']);
for(const feature of raw.features||[]){
  const p=feature.properties||{},[longitude,latitude]=feature.geometry?.coordinates||[];
  if(excluded.has(p.category)||/airport|railway station|hospital|incident|\bcouncil\b/i.test(p.name_en||''))continue;
  if(!/^Q\d+$/.test(p.wikidata_id)||seen.has(p.wikidata_id)||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||!p.name_en)continue;
  seen.add(p.wikidata_id);places.push({id:p.wikidata_id,name:p.name_zh||p.name_en,name_en:p.name_en,latitude,longitude,countryCode:p.country_iso2,city:p.city_en,category:p.category,rank:Number(p.sitelinks)||0});
}
places.sort((a,b)=>b.rank-a.rank);
assert(places.length>20000);assert(places.filter(p=>p.countryCode==='CN').length>=200);assert(places.filter(p=>p.countryCode==='AU').length>=100);
const catalog={sourceUrl:'https://github.com/audiala/open-data',attribution:'Data by Audiala — https://audiala.com',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',sourceGeneratedAt:raw.generated_at,notice:'Reduced bilingual place directory. Third-party coordinates and city labels are not verified entrances, administrative boundaries, current opening information or prices.',places};
await writeFile(new URL('../modules/data/map-place-catalog.json',import.meta.url),JSON.stringify(catalog));
console.log(JSON.stringify({total:places.length,china:places.filter(p=>p.countryCode==='CN').length,australia:places.filter(p=>p.countryCode==='AU').length,japan:places.filter(p=>p.countryCode==='JP').length,bytes:JSON.stringify(catalog).length}));
