import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalog = await readJson('modules/data/global-landmark-guide-catalog.json');
const assets = await readJson('modules/data/global-landmark-guide-assets.json');
const sectionImages = await readJson('modules/data/global-guide-section-images.json');
const generatedGuide = await readJson('modules/data/global-guide-generated-images.json');
const guideRenderer = await readFile(new URL('modules/map/global-landmark-guide.js', root), 'utf8');
assert.equal(catalog.places.length, 1000);
assert.equal(new Set(catalog.places.map(p => p.id)).size, 1000);
assert.equal(new Set(catalog.places.map(p => p.countryCode)).size, 195);
for (const [code, count] of [['CN',100],['US',100],['JP',50]]) assert.equal(catalog.places.filter(p => p.countryCode === code).length, count);
const sea = new Set(['ID','MY','VN','TH','PH','SG','KH','LA','MM','BN','TL']);
assert.equal(catalog.places.filter(p => sea.has(p.countryCode)).length, 300);
const missing = [], broken = [];
let photos = 0, generated = 0, registeredAiHeroes = 0, covered = 0;
const sectionKinds = ['eat','drink','play','joy','stay','go'], sectionSources = new Set();
let sectionPhotoCount = 0;
for (const place of catalog.places) for (const kind of sectionKinds) {
  const records = sectionImages.places?.[place.id]?.[kind] || [];
  assert.ok(records.length <= 2, `${place.id}/${kind} has more than two section photos`);
  for (const photo of records) {
    const source = photo.remoteSrc || photo.src;
    assert.match(source, /^https:\/\//, `${place.id}/${kind} photo must use HTTPS`);
    assert.ok(photo.creator && photo.license && photo.sourceUrl && photo.licenseUrl, `${place.id}/${kind} photo attribution is incomplete`);
    assert.ok(!sectionSources.has(source), `Section photo reused across cards: ${source}`);
    sectionSources.add(source); sectionPhotoCount++;
    if (photo.provider === 'Wikimedia Commons') {
      assert.match(photo.sourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, 'Commons file page is required');
      assert.ok(['within-10km','city-metadata-match'].includes(photo.locationVerified), 'Commons photo needs verified local coordinates or city metadata');
    }
  }
}
async function checkImage(src) {
  assert.match(src, /^\/assets\/destination-guides\/|^\/assets\/route-photos\//);
  const data = await readFile(new URL(src.slice(1), root));
  assert.ok(data.length > 1000);
  assert.ok((data[0] === 255 && data[1] === 216) || data.subarray(1,4).toString() === 'PNG' || data.subarray(8,12).toString() === 'WEBP');
}
const generatedSources = new Set();
let registeredAiImages = 0;
for (const [id, entries] of Object.entries(generatedGuide.places || {})) {
  assert.ok(catalog.places.some(place => place.id === id), `Generated art references unknown destination ${id}`);
  const heroSources = new Set(entries.filter(art => (art.kind || 'hero') === 'hero').map(art => art.src));
  const byCategory = new Map();
  for (const art of entries) {
    const kind = art.kind || 'hero', slot = Number(art.slot || 1);
    assert.ok(['hero', ...sectionKinds].includes(kind), `${id}: unknown generated image kind ${kind}`);
    assert.ok(kind === 'hero' ? slot === 1 : slot === 1 || slot === 2, `${id}/${kind}: invalid image slot`);
    assert.ok(art.label?.includes('AI'), `${id}/${kind}/${slot}: generated image must be labeled`);
    assert.ok(art.src && !generatedSources.has(art.src), `${id}/${kind}/${slot}: generated image reused`);
    if (kind !== 'hero') assert.ok(!heroSources.has(art.src), `${id}/${kind}/${slot}: cover reused in category`);
    generatedSources.add(art.src); byCategory.set(kind, (byCategory.get(kind) || 0) + 1);
    try { await checkImage(art.src); registeredAiImages++; }
    catch (error) { broken.push({ id, kind, src: art.src, error: error.message }); }
  }
  for (const [kind, count] of byCategory) assert.ok(count <= 2, `${id}/${kind}: too many generated images`);
}
assert.doesNotMatch(guideRenderer, /\['hero', 'play', 'joy'\]\.includes\(kind\)/, 'Category art must not fall back to the hero image');
assert.match(guideRenderer, /if \(art\) \{/, 'Category cards must render any registered AI illustration');
for (const place of catalog.places) {
  const record = assets.places[place.id];
  let usable = 0;
  for (const photo of record?.photos || []) {
    try { assert.ok(photo.creator && photo.license && photo.sourceUrl && photo.licenseUrl); await checkImage(photo.src); usable++; photos++; }
    catch (error) { broken.push({id:place.id,src:photo.src,error:error.message}); }
  }
  for (const art of record?.generated || []) {
    try { assert.ok(art.label.includes('AI')); await checkImage(art.src); usable++; generated++; }
    catch (error) { broken.push({id:place.id,src:art.src,error:error.message}); }
  }
  const hasRegisteredAiHero = (generatedGuide.places?.[place.id] || []).some(art => (art.kind || 'hero') === 'hero');
  if (hasRegisteredAiHero) registeredAiHeroes++;
  if (usable || hasRegisteredAiHero) covered++; else missing.push({id:place.id,name:place.name});
}
for (const [mode, art] of Object.entries(assets.transport || {})) try { await checkImage(art.src); } catch (error) { broken.push({mode,src:art.src,error:error.message}); }
console.log(JSON.stringify({total:1000,countries:195,covered,missing:missing.length,localRealPhotos:photos,localGeneratedImages:generated,registeredAiHeroes,registeredAiImages,sectionPhotoSlots:sectionPhotoCount,sectionSourcesUnique:sectionSources.size,transportImages:Object.keys(assets.transport||{}).length,brokenCount:broken.length,broken},null,2));
assert.equal(broken.length, 0, 'Broken local guide assets');
if (process.argv.includes('--require-complete')) assert.equal(missing.length, 0, 'Destination image coverage is incomplete');
