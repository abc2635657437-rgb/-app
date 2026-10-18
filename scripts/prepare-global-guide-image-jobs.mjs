import { readFile, writeFile, rename, access } from 'node:fs/promises';

const dataRoot = new URL('../modules/data/', import.meta.url);
const root = new URL('../', import.meta.url);
const [catalog, generated, covers, realCovers, sections] = await Promise.all([
  readJson('global-landmark-guide-catalog.json'),
  readJson('global-guide-generated-images.json'),
  readJson('global-landmark-guide-assets.json'),
  readJson('global-landmark-guide-images.json'),
  readJson('global-guide-section-images.json')
]);
const categories = ['eat', 'drink', 'play', 'joy', 'stay', 'go'];
const countryWave = ['CN', 'US', 'JP', 'ID', 'MY', 'VN', 'TH', 'PH', 'SG', 'KH', 'LA', 'MM', 'BN', 'TL'];
const scene = (place, kind, slot) => {
  const location = [place.name_en || place.name, place.city_en || place.city, place.countryNameEn || place.country_en || place.country].filter(Boolean).join(', ');
  const angle = slot === 1 ? 'wide establishing composition' : 'a distinct close or alternate-angle composition';
  const subjects = {
    eat: 'a locally characteristic meal and real regional cuisine, presented in a welcoming restaurant setting',
    drink: place.countryCode === 'CN' ? 'a real local tea-house, coffee shop, or characteristic local beverage experience' : 'a locally popular café or characteristic local beverage experience, not a tea house',
    play: `a documented attraction or scenic feature associated with ${place.name_en || place.name}`,
    joy: 'a locally characteristic live performance, cultural activity, or ticketed entertainment experience',
    stay: 'a tasteful locally inspired hotel-room or lobby interior concept, explicitly not a photograph of a named hotel',
    go: 'a locally accurate public-transport vehicle or street transport scene'
  };
  return `Create one vivid, photorealistic travel-editorial illustration for ${location}. Category: ${kind}. Subject: ${subjects[kind]}. ${angle}. Keep the scene geographically and culturally plausible; do not invent a named venue, historic fact, landmark, brand, menu, room listing, price, or signage. Rich natural color, clear inviting light, authentic textures, polished travel-social photography, horizontal 4:3 crop. No text, logos, watermark, collage, or repeated stock composition. This is AI-generated illustrative artwork, not documentary photography, and the app must label it as AI-generated.`;
};
const jobs = [];
for (const place of catalog.places) {
  const art = generated.places?.[place.id] || [];
  const coverPhotos = [...(covers.places?.[place.id]?.photos || []), ...(realCovers.places?.[place.id]?.photos || [])];
  const coverArt = art.find(image => (image.kind || 'hero') === 'hero');
  const coverReady = coverPhotos.length > 0 || await exists(coverArt?.src);
  jobs.push({
    id: place.id, name: place.name, country: place.countryName || place.country, countryCode: place.countryCode, kind: 'hero', slot: 1,
    status: coverPhotos.length ? 'real-photo' : coverReady ? 'ai-image' : 'pending',
    hasRealPhoto: coverPhotos.length > 0, hasGeneratedImage: await exists(coverArt?.src), rank: Number(place.rank) || 0,
    prompt: `Create one vivid, photorealistic travel-editorial illustration inspired by the documented real place ${[place.name_en || place.name, place.city_en || place.city, place.countryNameEn || place.country_en || place.country].filter(Boolean).join(', ')}. Preserve recognizable landscape and architecture; do not invent historic structures or signs. Bright natural light, rich but believable color, polished social-travel composition, horizontal 4:3 crop. No text, logos, watermark, collage, or mascots. This is AI-generated illustrative artwork, not documentary photography; label it clearly.`
  });
  for (const kind of categories) {
    const real = sections.places?.[place.id]?.[kind] || [];
    for (const slot of [1, 2]) {
      const generatedSlot = art.find(image => image.kind === kind && Number(image.slot || 1) === slot);
      const hasRealPhoto = Boolean(real[slot - 1]);
      const hasGeneratedImage = await exists(generatedSlot?.src);
      jobs.push({
        id: place.id, name: place.name, country: place.countryName || place.country, countryCode: place.countryCode, kind, slot,
        status: hasRealPhoto ? 'real-photo' : hasGeneratedImage ? 'ai-image' : 'pending',
        hasRealPhoto, hasGeneratedImage, rank: Number(place.rank) || 0, prompt: scene(place, kind, slot)
      });
    }
  }
}
jobs.sort((a, b) => Number(a.status !== 'pending') - Number(b.status !== 'pending')
  || (countryWave.indexOf(a.countryCode) < 0 ? countryWave.length : countryWave.indexOf(a.countryCode)) - (countryWave.indexOf(b.countryCode) < 0 ? countryWave.length : countryWave.indexOf(b.countryCode))
  || b.rank - a.rank || a.id.localeCompare(b.id) || a.kind.localeCompare(b.kind) || a.slot - b.slot);
const output = {
  version: 2, updatedAt: new Date().toISOString(), destinations: catalog.places.length,
  total: jobs.length, requiredImages: catalog.places.length * 13,
  readyRealPhotos: jobs.filter(job => job.status === 'real-photo').length,
  readyAiImages: jobs.filter(job => job.status === 'ai-image').length,
  pending: jobs.filter(job => job.status === 'pending').length,
  jobs
};
const outputUrl = new URL('global-guide-image-jobs.json', dataRoot);
const tempUrl = new URL(outputUrl.href + '.tmp');
await writeFile(tempUrl, JSON.stringify(output));
await rename(tempUrl, outputUrl);
console.log(JSON.stringify({ destinations: output.destinations, requiredImages: output.requiredImages, readyRealPhotos: output.readyRealPhotos, readyAiImages: output.readyAiImages, pending: output.pending }));

async function readJson(file) {
  try { return JSON.parse(await readFile(new URL(file, dataRoot), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
async function exists(src) {
  if (!src) return false;
  try { await access(new URL(src.replace(/^\//, ''), root)); return true; } catch { return false; }
}
