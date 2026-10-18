import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('modules/data/global-landmark-guide-catalog.json', root), 'utf8'));
const source = JSON.parse(await readFile(new URL('modules/data/global-landmark-guide-images.json', root), 'utf8'));
let generated = { places: {} };
try { generated = JSON.parse(await readFile(new URL('modules/data/global-guide-generated-images.json', root), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const output = { version: 1, builtAt: new Date().toISOString(), total: catalog.places.length, places: {} };
try { output.transport = JSON.parse(await readFile(new URL('modules/data/global-guide-transport-images.json', root), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const tasks = [];
for (const place of catalog.places) {
  const record = source.places[place.id] || {};
  output.places[place.id] = { name: place.name, name_en: place.name_en, photos: [], generated: generated.places[place.id] || [] };
  for (const photo of record.photos || []) tasks.push({ id: place.id, photo });
}
const assetDir = new URL('assets/destination-guides/', root);
await mkdir(assetDir, { recursive: true });
let next = 0, complete = 0, failed = 0;
const failures = [];
const exists = async url => { try { await access(url); return true; } catch { return false; } };

async function cachePhoto({ id, photo }) {
  const remoteSrc = photo.remoteSrc || photo.src;
  assert.match(remoteSrc, /^https:\/\//, 'Photo source must use HTTPS');
  assert.ok(photo.creator && photo.license && photo.sourceUrl && photo.licenseUrl, 'Photo attribution is required');
  const digest = createHash('sha256').update(remoteSrc).digest('hex').slice(0, 12);
  const stem = `${id}-${digest}`;
  for (const ext of ['jpg', 'png', 'webp']) {
    if (await exists(new URL(`${stem}.${ext}`, assetDir))) return { ...photo, src: `/assets/destination-guides/${stem}.${ext}`, remoteSrc };
  }
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(remoteSrc, { signal: AbortSignal.timeout(22000) });
      if (!response.ok) throw new Error(`Photo HTTP ${response.status}`);
      const type = (response.headers.get('content-type') || '').split(';')[0];
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
      if (!extension) throw new Error(`Unsupported photo type ${type}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1000 || bytes.length > 6 * 1024 * 1024) throw new Error('Photo size outside expected bounds');
      const valid = extension === 'jpg' ? bytes[0] === 255 && bytes[1] === 216
        : extension === 'png' ? bytes.subarray(1, 4).toString() === 'PNG'
          : bytes.subarray(8, 12).toString() === 'WEBP';
      if (!valid) throw new Error('Invalid image signature');
      const filename = `${stem}.${extension}`;
      await writeFile(new URL(filename, assetDir), bytes);
      return { ...photo, src: `/assets/destination-guides/${filename}`, remoteSrc };
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

await Promise.all(Array.from({ length: Math.min(8, tasks.length) }, async () => {
  while (next < tasks.length) {
    const task = tasks[next++];
    try { output.places[task.id].photos.push(await cachePhoto(task)); }
    catch (error) { failed++; failures.push({ id: task.id, src: task.photo.src, error: error.message }); }
    complete++;
    if (complete % 50 === 0 || complete === tasks.length) console.log(`Local photos ${complete}/${tasks.length}; failed ${failed}`);
  }
}));
for (const [id, record] of Object.entries(output.places)) {
  record.generated = (await Promise.all(record.generated.map(async art => {
    assert.match(art.src, /^\/assets\//, 'Generated image must be a project asset');
    return await exists(new URL(art.src.slice(1), root)) ? art : null;
  }))).filter(Boolean);
  record.status = record.photos.length ? 'local-licensed-photos' : record.generated.length ? 'local-ai-illustration' : 'image-required';
}
output.realPhotoPlaces = Object.values(output.places).filter(p => p.photos.length).length;
output.generatedPlaces = Object.values(output.places).filter(p => p.generated.length).length;
output.coveredPlaces = Object.values(output.places).filter(p => p.photos.length || p.generated.length).length;
output.missing = Object.entries(output.places).filter(([, p]) => !p.photos.length && !p.generated.length).map(([id, p]) => ({ id, name: p.name, name_en: p.name_en }));
output.failures = failures;
await writeFile(new URL('modules/data/global-landmark-guide-assets.json', root), JSON.stringify(output));
console.log(JSON.stringify({ total: output.total, localPhotos: complete - failed, coveredPlaces: output.coveredPlaces, realPhotoPlaces: output.realPhotoPlaces, generatedPlaces: output.generatedPlaces, missingPlaces: output.missing.length, failed }));
if (process.argv.includes('--require-complete')) assert.equal(output.missing.length, 0, 'Every destination needs a working local image');
