import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {journeyPhotos,waypointPhotos} from '../modules/discover/journey-photos.js';
const root=new URL('../',import.meta.url);
assert.equal(journeyPhotos.length,7);
assert.equal(waypointPhotos.length,4);
for(const photo of [...journeyPhotos,...waypointPhotos]){
  assert.ok(photo.credit&&photo.license&&photo.licenseUrl);
  assert.match(photo.imageSourceUrl,/^https:\/\/commons.wikimedia.org\/wiki\/File:/);
  assert.ok((await stat(fileURLToPath(new URL('.'+photo.image,root)))).size>10000);
}
const guides=JSON.parse(await readFile(new URL('modules/data/route-guides.json',root),'utf8'));
const bed=guides.guides[0].stops.find(s=>s.category==='stay'||s.id.includes('ferramenteiro'));
assert.ok(bed,'Hostel must be present');
assert.match(bed.image,/ferramenteiro-beds\.jpg$/);
assert.ok((await stat(new URL('.'+bed.image,root))).size>10000);
console.log('Photo preview checks passed: seven towns, four waypoints, source credits and actual bed image.');
