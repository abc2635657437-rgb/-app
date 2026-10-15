import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),registry=JSON.parse(await readFile(new URL('modules/data/place-backgrounds.json',root))).backgrounds;
assert.equal(Object.keys(registry).length,100);
for(const art of Object.values(registry)){
  assert(art.mobileImage&&art.mobileSourceImage,'Missing mobile portrait background');
  const bytes=await readFile(new URL(art.image.slice(1),root));
  assert.equal(bytes.readUInt32BE(16),art.width);assert.equal(bytes.readUInt32BE(20),art.height);
  await readFile(new URL((art.sourceImage||art.image.replace('gathered-background.png','source.jpg')).slice(1),root));
  {
    const bytes=await readFile(new URL(art.mobileImage.slice(1),root));
    assert.equal(bytes.readUInt32BE(16),art.mobileWidth);assert.equal(bytes.readUInt32BE(20),art.mobileHeight);
    assert(art.mobileWidth<art.mobileHeight,'Mobile background must be portrait');
    await readFile(new URL(art.mobileSourceImage.slice(1),root));
  }
  assert.equal(art.skill,'scenes-gathered-zine-v1-3');assert(art.artisticDerivative&&art.sourceAuthor&&art.sourceUrl&&art.licenseUrl);
}
const code=await readFile(new URL('modules/map/gathered-backgrounds.js',root),'utf8');
for(const id of Object.keys(registry))assert(code.includes(id));
console.log('100 landmark backgrounds and all registered portrait variants: files, dimensions, sources, licenses and map aliases passed.');
