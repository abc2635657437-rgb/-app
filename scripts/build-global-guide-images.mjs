import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const catalogPath = new URL('../modules/data/global-landmark-guide-catalog.json', import.meta.url);
const outputPath = new URL('../modules/data/global-landmark-guide-images.json', import.meta.url);
const sectionPath = new URL('../modules/data/global-guide-section-images.json', import.meta.url);
const concurrency = 2;
const saveEvery = 10;
const allowedLicenses = new Set(['by', 'by-sa', 'cc0', 'pdm']);
const unsuitableTitle = /\b(?:mascots?|souvenirs?|figurines?|toys?|selfies?|portraits?|little (?:girl|boy)|t-shirts?|posters?|logos?|stickers?|paintings?|engravings?|drawings?|postcards?)\b/i;

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
let existing = { places: {} };
try { existing = JSON.parse(await readFile(outputPath, 'utf8')); } catch {}
let existingSections = { places: {} };
try { existingSections = JSON.parse(await readFile(sectionPath, 'utf8')); } catch {}
const manifest = {
  version: 2,
  generatedAt: new Date().toISOString(),
  catalogVersion: catalog.version,
  total: catalog.places.length,
  provider: 'WordPress Photo Directory (CC0), with previously verified open-licensed photos retained',
  policy: 'Use CC0 or previously verified CC BY/CC BY-SA/Public Domain; exclude Wikipedia/Wikimedia; keep attribution and license links.',
  places: existing.version === 2 ? existing.places || {} : {}
};
for (const place of Object.values(manifest.places)) {
  if (!place.photos?.length) continue;
  place.photos = place.photos.filter(photo => !unsuitableTitle.test(photo.title || ''));
  if (!place.photos.length) place.status = 'retry-required';
}
const usedPhotos = new Set([
  ...Object.values(manifest.places).flatMap(place => (place.photos || []).flatMap(photo => [photo.unique, photo.sourceUrl, photo.src].filter(Boolean))),
  ...Object.values(existingSections.places || {}).flatMap(sections => Object.values(sections).flatMap(photos => (photos || []).flatMap(photo => [photo.unique, photo.sourceUrl, photo.src, photo.remoteSrc].filter(Boolean))))
]);

const safeHttps = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
};
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[’‘]/g, "'");
const plainText = value => String(value || '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#8217;|&#039;/g,"'").replace(/&#8211;/g,'-').replace(/&quot;/g,'"').replace(/&#([0-9]+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g,' ').trim();
const aliases = { Q2047427: ['Forbidden City', 'Palace Museum Beijing'], Q740104: ['Qalat al Bahrain', 'Bahrain Fort'], Q63724: ['Stecci', 'Stecak'], Q948850: ['Medecourbe', 'Medacorba'], Q804009: ['Baitul Mukarram'], Q3176133: ['Louvre Abu Dhabi'] };
const namesFor = item => [...new Set([item.name_en, item.name, ...(aliases[item.id] || [])].filter(Boolean).map(normalize))];
const makePrompt = item => `Create one vivid, premium travel-editorial image inspired by ${item.name_en || item.name}, ${item.city_en || item.city || ''} ${item.countryNameEn || item.country_en || item.countryName || item.country}. Depict the real place accurately using its documented identity and characteristic landscape; do not invent historic structures or signage. Bright natural light, rich but believable color, polished travel-social photography composition, horizontal 4:3 crop, no text or logos. This is AI-generated illustrative artwork, not documentary photography; the app must label it as AI-generated.`;

function matchesPlace(photo, item) {
  const words = value => normalize(plainText(value)).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const identity = ` ${words(`${photo.title || ''} ${photo.description || ''} ${photo.foreign_landing_url || ''} ${(photo.tags || []).map(tag => tag.name || tag).join(' ')}`)} `;
  return namesFor(item).some(name => {
    const phrase = ` ${words(name)} `;
    return phrase.length > 2 && identity.includes(phrase);
  });
}

let searchStartAt = 0;
let searchGate = Promise.resolve();
let sourcePaused = false;
let openversePaused = false;
let wordpressPaused = false;
async function search(query) {
  const previous = searchGate;
  let release;
  searchGate = new Promise(resolve => { release = resolve; });
  await previous;
  await delay(Math.max(0, 1000 - (Date.now() - searchStartAt)));
  searchStartAt = Date.now();
  release();
  let openverseItems = [];
  if (!openversePaused) {
    const openverseUrl = new URL('https://api.openverse.org/v1/images/');
    openverseUrl.search = new URLSearchParams({ q: query, license: 'cc0,by,by-sa,pdm', page_size: '30', excluded_source: 'wikimedia' });
    let openverse;
    for (let attempt = 0; attempt < 3; attempt++) {
      openverse = await fetch(openverseUrl, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'TravelWorldGuide/1.0 (open-license image lookup)' } });
      if ((openverse.ok && openverse.headers.get('content-type')?.includes('application/json')) || ![401, 403, 429, 500, 502, 503, 504].includes(openverse.status) || attempt === 2) break;
      const retryAfter = Number(openverse.headers.get('retry-after')) * 1000;
      await delay(retryAfter || 1500 * (attempt + 1));
    }
    if (openverse.ok && openverse.headers.get('content-type')?.includes('application/json')) openverseItems = (await openverse.json()).results.map(image => ({
      id: `ov-${image.id}`, title: plainText(image.title || query), description: '', tags: image.tags || [],
      foreign_landing_url: image.foreign_landing_url, thumbnail: image.url || image.thumbnail,
      creator: image.creator || 'Creator not listed', license: image.license, license_version: image.license_version,
      license_url: image.license_url, source: image.source, provider: image.provider
    }));
    else if ([401, 403, 429].includes(openverse.status) || openverse.ok) { openversePaused = true; sourcePaused = true; }
  }
  let wordpressItems = [];
  if (!wordpressPaused) {
    const wpUrl = new URL('https://wordpress.org/photos/wp-json/wp/v2/media');
    wpUrl.search = new URLSearchParams({ search: query, per_page: '100', _embed: '1' });
    const response = await fetch(wpUrl, { signal: AbortSignal.timeout(20000) });
    if (response.status === 429 || response.status === 403 || response.status === 401) wordpressPaused = true;
    else if (response.ok) wordpressItems = (await response.json()).map(image => ({
      id: `wp-${image.id}`, title: plainText(image.caption?.rendered || image.alt_text || image.description?.rendered || image.title?.rendered || query),
      description: plainText(image.description?.rendered || ''), tags: (image._embedded?.['wp:term'] || []).flat().map(term => term.name),
      foreign_landing_url: image.link || 'https://wordpress.org/photos/',
      thumbnail: image.media_details?.sizes?.medium_large?.source_url || image.media_details?.sizes?.large?.source_url || image.source_url,
      creator: image._embedded?.author?.[0]?.name || 'Creator not listed',
      license: 'cc0', license_version: '1.0', license_url: 'https://wordpress.org/photos/license/',
      source: 'WordPress Photo Directory', provider: 'WordPress Photo Directory'
    }));
    else if (!openverseItems.length) throw new Error(`Photo search HTTP ${response.status}`);
  }
  if (openversePaused && wordpressPaused) sourcePaused = true;
  return [...openverseItems, ...wordpressItems];
}

async function imagesFor(item) {
  const country = item.countryNameEn || item.country_en || item.countryName || item.country;
  const queries = [...new Set([
    item.imageQuery,
    ...(aliases[item.id] || []),
    [item.name_en || item.name, country].filter(Boolean).join(' '),
    item.name_en,
    item.name
  ].filter(Boolean).map(query => query.slice(0, 190)))];
  const photos = [];
  for (const query of queries) {
    const results = await search(query);
    for (const photo of results) {
      const source = `${photo.source || ''} ${photo.provider || ''} ${photo.foreign_landing_url || ''}`;
      if (!matchesPlace(photo, item) || unsuitableTitle.test(photo.title || '') || /(wikimedia|wikipedia)/i.test(source) || !allowedLicenses.has(photo.license)) continue;
      const src = safeHttps(photo.thumbnail);
      const sourceUrl = safeHttps(photo.foreign_landing_url);
      const licenseUrl = safeHttps(photo.license_url);
      if (!src || !sourceUrl || !licenseUrl) continue;
      const unique = photo.id || sourceUrl;
      if (photos.some(candidate => candidate.unique === unique) || usedPhotos.has(unique) || usedPhotos.has(sourceUrl) || usedPhotos.has(src)) continue;
      usedPhotos.add(unique); usedPhotos.add(sourceUrl); usedPhotos.add(src);
      photos.push({
        unique,
        src,
        title: plainText(photo.title || item.name_en || item.name),
        width: photo.width || null,
        height: photo.height || null,
        creator: photo.creator || 'Creator not listed',
        license: `${photo.license}${photo.license_version ? ` ${photo.license_version}` : ''}`,
        licenseUrl,
        sourceUrl,
        provider: photo.provider || photo.source || 'Openverse'
      });
      if (photos.length === 3) break;
    }
    if (photos.length) break;
  }
  return { photos, queries };
}

let next = 0;
let complete = 0;
let matched = 0;
let failed = 0;
let queue = catalog.places.filter(item => !manifest.places[item.id]?.checkedAt || manifest.places[item.id]?.status === 'retry-required' || (process.argv.includes('--retry-missing') && !manifest.places[item.id]?.photos?.length));
const firstWave = ['CN','US','JP','ID','MY','VN','TH','PH','SG','KH','LA','MM','BN','TL'];
queue.sort((a,b)=>{
  const pa=firstWave.indexOf(a.countryCode),pb=firstWave.indexOf(b.countryCode);
  return (pa<0?firstWave.length:pa)-(pb<0?firstWave.length:pb)||Number(b.rank||0)-Number(a.rank||0)||a.id.localeCompare(b.id);
});
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
if (limitArg) queue = queue.slice(0, Number(limitArg.split('=')[1]));
await writeFile(outputPath, JSON.stringify(manifest));

async function worker() {
  while (next < queue.length && !sourcePaused) {
    const item = queue[next++];
    try {
      const { photos, queries } = await imagesFor(item);
      manifest.places[item.id] = {
        name: item.name,
        name_en: item.name_en || '',
        country: item.countryName || item.country,
        checkedAt: new Date().toISOString(),
        status: photos.length ? 'licensed-photos-found' : 'ai-generation-required',
        queries,
        photos,
        ...(photos.length ? {} : { generationPrompt: makePrompt(item) })
      };
      matched += Number(photos.length > 0);
    } catch (error) {
      failed += 1;
      manifest.places[item.id] = {
        name: item.name,
        name_en: item.name_en || '',
        country: item.countryName || item.country,
        checkedAt: new Date().toISOString(),
        status: 'retry-required',
        error: String(error.message || error),
        generationPrompt: makePrompt(item)
      };
    }
    complete += 1;
    if (complete % saveEvery === 0 || complete === queue.length) {
      await writeFile(outputPath, JSON.stringify(manifest));
      process.stdout.write(`checked ${complete}/${queue.length}; real-photo matches ${matched}; retry ${failed}\n`);
    }
    await delay(150);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
manifest.realPhotoMatches = Object.values(manifest.places).filter(place => place.status === 'licensed-photos-found').length;
manifest.aiGenerationRequired = Object.values(manifest.places).filter(place => place.status === 'ai-generation-required').length;
manifest.retryRequired = Object.values(manifest.places).filter(place => place.status === 'retry-required').length;
manifest.completedAt = new Date().toISOString();
await writeFile(outputPath, JSON.stringify(manifest));
process.stdout.write(`done ${catalog.places.length}; photos ${manifest.realPhotoMatches}; AI queue ${manifest.aiGenerationRequired}; retries ${manifest.retryRequired}\n`);
