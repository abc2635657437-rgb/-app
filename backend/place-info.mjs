// A place, in detail: a short encyclopaedic summary, a handful of licensed
// photographs, coordinates and a map link. Everything is resolved from Wikidata
// and Wikipedia; nothing is generated.
const AGENT = 'TravelWorld/1.0 (+https://travel-world-mwdw.onrender.com)';
const CACHE_TTL = 60 * 60 * 1000;
const cache = new Map();

const plain = value => String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// Keep the introduction to two or three sentences, cut at a sentence end.
function shorten(text, limit) {
  const value = String(text || '').trim();
  if (value.length <= limit) return value;
  const window = value.slice(0, limit);
  const cut = Math.max(window.lastIndexOf('。'), window.lastIndexOf('！'), window.lastIndexOf('？'), window.lastIndexOf('. '));
  return cut > 40 ? value.slice(0, cut + 1) : window.replace(/[，、；：,;:]$/, '') + '…';
}

async function getJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('source ' + response.status);
  return response.json();
}

function photoFrom(info) {
  const meta = info?.extmetadata || {};
  const url = info?.thumburl || info?.url;
  if (!url || !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url)) return null;
  return {
    url: url.replace('https://upload.wikimedia.org/', 'https://thumb.wikimedia.org/'),
    page: info.descriptionurl || '',
    credit: plain(meta.Artist?.value),
    license: plain(meta.LicenseShortName?.value)
  };
}

export async function placeInfo(name, language = 'zh') {
  const clean = String(name || '').trim().slice(0, 80);
  if (!clean) return null;
  const key = language + '|' + clean;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  let entityId = null;
  try {
    const search = await getJson('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=' + (language === 'en' ? 'en' : 'zh') + '&uselang=' + (language === 'en' ? 'en' : 'zh') + '&limit=1&search=' + encodeURIComponent(clean));
    entityId = search.search?.[0]?.id || null;
  } catch (_) { /* no entity, still try the photo search */ }

  let entity = null;
  let coordinates = null;
  if (entityId) {
    try {
      const data = await getJson('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|descriptions|labels|sitelinks&ids=' + entityId + '&languages=' + (language === 'en' ? 'en' : 'zh'));
      entity = data.entities?.[entityId] || null;
      const coord = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      if (coord && typeof coord.latitude === 'number') coordinates = { lat: coord.latitude, lon: coord.longitude };
    } catch (_) { /* keep going */ }
  }

  // Photographs: the entity's main image first, then a Commons search for the name.
  const photos = [];
  const seen = new Set();
  const push = photo => {
    if (!photo || photos.length >= 6 || seen.has(photo.url)) return;
    seen.add(photo.url);
    photos.push(photo);
  };

  const file = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (typeof file === 'string') {
    try {
      const data = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&titles=' + encodeURIComponent('File:' + file));
      const page = Object.values(data.query?.pages || {})[0];
      push(photoFrom(page?.imageinfo?.[0]));
    } catch (_) { /* gallery may still work */ }
  }

  try {
    const data = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=' + encodeURIComponent(clean) + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900');
    Object.values(data.query?.pages || {}).forEach(page => push(photoFrom(page?.imageinfo?.[0])));
  } catch (_) { /* a single photo is still a detail page */ }

  // Summary: Chinese Wikipedia first, then English; attribution is kept.
  // The action API keeps the language variant (zh-cn) so the summary matches the
  // interface instead of arriving in traditional characters.
  let summary = null;
  const titles = [language === 'en' ? null : 'zh', 'en'].filter(Boolean);
  for (const lang of titles) {
    try {
      const title = lang === 'zh' ? (entity?.labels?.zh?.value || clean) : (entity?.labels?.en?.value || clean);
      const url = 'https://' + lang + '.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles='
        + encodeURIComponent(title) + (lang === 'zh' ? '&variant=zh-cn' : '');
      const data = await getJson(url);
      const page = Object.values(data.query?.pages || {})[0];
      const extract = plain(page?.extract || '');
      if (extract) {
        summary = {
          text: shorten(extract, 100),
          source: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(page?.title || title),
          license: 'CC BY-SA'
        };
        break;
      }
    } catch (_) { /* try the other language */ }
  }

  const description = entity?.descriptions?.[language === 'en' ? 'en' : 'zh']?.value
    || entity?.descriptions?.en?.value
    || '';

  const reach = Object.keys(entity?.sitelinks || {}).length;
  const stars = reach >= 40 ? 5 : reach >= 15 ? 4 : reach >= 5 ? 3 : reach >= 1 ? 2 : photos.length ? 2 : 1;
  const data = {
    name: entity?.labels?.[language === 'en' ? 'en' : 'zh']?.value || clean,
    stars,
    reach,
    description: plain(description).slice(0, 200),
    summary,
    photos,
    coordinates,
    wikidata: entityId ? 'https://www.wikidata.org/wiki/' + entityId : ''
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

export function installPlaceInfo(app) {
  app.get('/api/ai/place', async (req, res) => {
    try {
      const data = await placeInfo(req.query.name, req.query.lang === 'en' ? 'en' : 'zh');
      if (!data) return res.status(400).json({ error: 'Missing place name' });
      res.json(data);
    } catch (error) {
      res.status(502).json({ error: 'Place details are unavailable' });
    }
  });
}

export default installPlaceInfo;
