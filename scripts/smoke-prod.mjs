// Production smoke check: the routes and every precached asset the service
// worker will ask for, so a deploy does not ship a broken install.
import { readFileSync } from 'node:fs';

// Usage: node scripts/smoke-prod.mjs https://your-domain
const base = process.argv[2] || 'http://127.0.0.1:8787';
const results = [];
async function check(path, label) {
  try {
    const response = await fetch(base + path, { method: 'GET' });
    results.push({ ok: response.ok, status: response.status, path, label });
  } catch (error) {
    results.push({ ok: false, status: 'ERR', path, label, error: error.message });
  }
}

await check('/api/health', 'health');
await check('/', 'index');
await check('/modules/ai/ai-chat.js?v=17-travel-desk', 'chat js');
await check('/modules/ai/ai-chat.css?v=17-travel-desk', 'chat css');
await check('/modules/ai/ai-voice.js?v=1', 'voice js');
await check('/sw.js', 'service worker');
await check('/api/ai/assistant/health', 'assistant health');
await check('/api/ai/place?name=%E9%94%A6%E5%B8%82%E5%9C%BA&lang=zh', 'place detail');

const sw = readFileSync('sw.js', 'utf8');
const assets = [...sw.matchAll(/'(\/[^']+)'/g)].map(match => match[1])
  .filter(path => /\.[a-z0-9]{2,4}(\?|$)/i.test(path) || path === '/' || path === '/index.html');
const unique = [...new Set(assets)];
let missing = 0;
for (const path of unique) {
  const response = await fetch(base + path);
  if (!response.ok) { missing += 1; results.push({ ok: false, status: response.status, path, label: 'precache' }); }
}

const failed = results.filter(item => !item.ok);
console.log(JSON.stringify({ checked: results.length, precached: unique.length, missing, failed }, null, 2));
process.exit(failed.length ? 1 : 0);
