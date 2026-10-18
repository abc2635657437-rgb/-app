import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../modules/data/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('global-landmark-guide-catalog.json', root), 'utf8'));
let cache = { checkedAt: '', places: {} };
try { cache = JSON.parse(await readFile(new URL('global-guide-entity-validation.json', root), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const queue = catalog.places.filter(place => process.argv.includes('--refresh') || !cache.places[place.id]);
const distance = (a, b) => {
  const rad = Math.PI / 180, dlat = (a.latitude - b.latitude) * rad, dlon = (a.longitude - b.longitude) * rad;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dlon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
};
for (let offset = 0; offset < queue.length; offset += 250) {
  const batch = queue.slice(offset, offset + 250);
  const query = `PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/> SELECT ?item ?coord WHERE { VALUES ?item { ${batch.map(place => 'wd:' + place.id).join(' ')} } ?item wdt:P625 ?coord. }`;
  const response = await fetch('https://qlever.dev/api/wikidata', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: new URLSearchParams({ query, format: 'json' }), signal: AbortSignal.timeout(55000) });
  if (!response.ok) throw new Error(`Entity verification HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.status === 'ERROR') throw new Error(payload.exception || 'Entity verification failed');
  if (!Array.isArray(payload.results?.bindings)) throw new Error('Unexpected entity response format; verification cache unchanged');
  const coordinates = new Map();
  for (const row of payload.results?.bindings || []) {
    const match = /^Point\((-?[\d.]+)\s+(-?[\d.]+)\)$/i.exec(row.coord.value);
    if (!match) continue;
    const id = row.item.value.split('/').at(-1);
    if (!coordinates.has(id)) coordinates.set(id, []);
    coordinates.get(id).push({ latitude: Number(match[2]), longitude: Number(match[1]) });
  }
  if (!coordinates.size) throw new Error('No coordinate values parsed; verification cache unchanged');
  for (const place of batch) {
    const positions = coordinates.get(place.id) || [];
    const nearestKm = positions.length ? Math.min(...positions.map(position => distance(place, position))) : null;
    cache.places[place.id] = { name: place.name_en || place.name, valid: nearestKm !== null && nearestKm <= 50, nearestKm, coordinateCount: positions.length };
  }
  cache.checkedAt = new Date().toISOString();
  await writeFile(new URL('global-guide-entity-validation.json', root), JSON.stringify(cache));
  console.log(`Entity coordinates checked ${Math.min(offset + batch.length, queue.length)}/${queue.length}`);
}
const invalid = catalog.places.filter(place => !cache.places[place.id]?.valid).map(place => ({ id: place.id, name: place.name_en || place.name, country: place.country, ...cache.places[place.id] }));
console.log(JSON.stringify({ checked: catalog.places.length, invalidCount: invalid.length, invalid: invalid.slice(0, 45) }, null, 2));
