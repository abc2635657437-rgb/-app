import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('modules/data/map-place-catalog.json',root),'utf8'));
const registry=JSON.parse(await readFile(new URL('modules/data/place-backgrounds.json',root),'utf8')).backgrounds;
for(const [id,art] of Object.entries(registry)){
  assert(/^Q\d+$/.test(id));assert(art.artisticDerivative===true);assert.equal(art.skill,'scenes-gathered-zine-v1-3');
  assert(/^\/assets\/route-photos\/[a-z0-9-]+\.png$/.test(art.image));assert(art.sourceUrl&&art.sourceAuthor&&art.license&&art.licenseUrl);
  assert(art.width>0&&art.height>0);await access(new URL(art.image.slice(1),root));
}
const ready=catalog.places.filter(p=>registry[p.id]);
const pending=catalog.places.filter(p=>!registry[p.id]);
console.log(JSON.stringify({cataloguedPlaces:catalog.places.length,generatedAndRegistered:ready.length,pending:pending.length,registeredExtraPlaces:Object.keys(registry).filter(id=>!catalog.places.some(p=>p.id===id)),ready:ready.map(p=>({id:p.id,name:p.name_en})),productionReady:pending.length===0},null,2));
