import fs from 'node:fs/promises';

const data = JSON.parse(await fs.readFile(new URL('../modules/data/landmarks.json', import.meta.url), 'utf8'));
const required = ['id','name','name_en','description','description_en','location','image','country','country_en','city','city_en','category','latitude','longitude'];
const ids = new Set();
const errors = [];

for (const item of data.landmarks) {
  const missing = required.filter(key => item[key] === undefined || item[key] === null || item[key] === '');
  if (missing.length) errors.push(`${item.id || 'unknown'} missing ${missing.join(', ')}`);
  if (ids.has(item.id)) errors.push(`${item.id} is duplicated`); else ids.add(item.id);
  if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) errors.push(`${item.id} has invalid coordinates`);
  if (!item.location || item.location.latitude !== item.latitude || item.location.longitude !== item.longitude) errors.push(`${item.id} has inconsistent location data`);
  for (const [key, value] of Object.entries(item).filter(([key]) => key.endsWith('_en'))) {
    if (/[\u3400-\u9fff]/.test(Array.isArray(value) ? value.join(' ') : String(value))) errors.push(`${item.id}.${key} contains Chinese text`);
  }
}

if (data.landmarks.filter(item => item.country === '俄罗斯').length < 10) errors.push('Russia must have at least 10 landmarks');

if (process.argv.includes('--network')) {
  for (let index = 0; index < data.landmarks.length; index += 6) {
    const batch = data.landmarks.slice(index, index + 6);
    await Promise.all(batch.map(async item => {
      try {
        let response;
        for (let attempt = 0; attempt < 3; attempt++) {
          response = await fetch(item.image, { headers: { Range: 'bytes=0-0', 'User-Agent': 'TravelWorldLandmarkCheck/1.0' }, signal: AbortSignal.timeout(15000) });
          if (response.status !== 429) break;
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
        if (!response.ok || !String(response.headers.get('content-type')).startsWith('image/')) errors.push(`${item.id} image returned ${response.status}`);
      } catch (error) { errors.push(`${item.id} image failed: ${error.message}`); }
    }));
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK: ${data.landmarks.length} bilingual landmarks, ${data.landmarks.filter(item => item.country === '俄罗斯').length} in Russia, all images valid${process.argv.includes('--network') ? ' online' : ''}.`);
