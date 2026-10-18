import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rename, stat, open, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const [id, inputPath, kind = 'hero', slotArg = '1'] = process.argv.slice(2);
assert.match(id || '', /^Q\d+$/, 'A catalog place ID is required');
assert.ok(['hero', 'eat', 'drink', 'play', 'joy', 'stay', 'go'].includes(kind));
const slot = Number(slotArg);
assert.ok(Number.isInteger(slot) && (kind === 'hero' ? slot === 1 : slot === 1 || slot === 2), 'Use slot 1 for a cover and slot 1 or 2 for a category image');
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('modules/data/global-landmark-guide-catalog.json', root), 'utf8'));
const place = catalog.places.find(place => place.id === id);
assert.ok(place, 'Generated artwork must belong to the selected 1,000-place catalog');
const bytes = await readFile(inputPath);
assert.ok(bytes.length > 1000 && bytes.subarray(1, 4).toString() === 'PNG', 'Expected a completed generated PNG');
await mkdir(new URL('assets/destination-guides/', root), { recursive: true });
const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
const src = `/assets/destination-guides/${id}-ai-${kind}-${slot}-${digest}.jpg`;
const target = new URL(src.slice(1), root);
const temporary = new URL(target.href + '.tmp.jpg');
execFileSync(process.env.TW_POWERSHELL || 'pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('scripts/compress-guide-image.ps1', root)), '-InputPath', inputPath, '-OutputPath', fileURLToPath(temporary)], { windowsHide: true });
assert.ok((await stat(temporary)).size > 1000);
await rename(temporary, target);
const registryUrl = new URL('modules/data/global-guide-generated-images.json', root);
let jobs = { jobs: [] };
try { jobs = JSON.parse(await readFile(new URL('modules/data/global-guide-image-jobs.json', root), 'utf8')); } catch {}
const job = jobs.jobs.find(job => job.id === id && job.kind === kind && Number(job.slot || 1) === slot);
const art = { kind, slot, src, alt: `${place.name} · AI ${kind === 'hero' ? '景区' : '场景'}示意`, label: 'AI 生成示意 · 非实景照片', preferred: kind === 'hero', prompt: job?.prompt || '', generatedAt: new Date().toISOString() };
const lockUrl = new URL(registryUrl.href + '.lock');
let lock;
for (let attempt = 0; attempt < 200 && !lock; attempt++) {
  try { lock = await open(lockUrl, 'wx'); }
  catch (error) { if (error.code !== 'EEXIST') throw error; if (Date.now() - (await stat(lockUrl)).mtimeMs > 300000) await unlink(lockUrl); else await delay(50); }
}
assert.ok(lock, 'Generated image registry is busy; retry registration');
try {
  const registry = JSON.parse(await readFile(registryUrl, 'utf8'));
  registry.places[id] = [...(registry.places[id] || []).filter(art => (art.kind || 'hero') !== kind || Number(art.slot || 1) !== slot), art];
  const tempRegistry = new URL(registryUrl.href + `.${process.pid}.tmp`);
  await writeFile(tempRegistry, JSON.stringify(registry, null, 2));
  await rename(tempRegistry, registryUrl);
} finally { await lock.close(); await unlink(lockUrl); }
console.log(JSON.stringify({ id, kind, slot, src, bytes: (await stat(target)).size }));
