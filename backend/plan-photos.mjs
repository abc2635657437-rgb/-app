// Photographs for a planned day.
//
// The desk will only show a real, licensed photograph of the place it names, so
// each place is resolved through Wikidata: the Chinese name is searched for an
// entity, that entity's P18 image is fetched from Wikimedia Commons together
// with its licence and author. Anything unresolved simply has no photo.
//
// Two calls per batch, cached per name for an hour.

const AGENT = 'TravelWorld/1.0 (+https://travel-world-mwdw.onrender.com)';
const CACHE_TTL = 60 * 60 * 1000;
const cache = new Map();

function plain(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

async function getJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error('photo source ' + response.status);
  return response.json();
}

async function entityFor(name) {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.id;
  try {
    const data = await getJson('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=zh&uselang=zh&limit=1&search=' + encodeURIComponent(name));
    const id = data.search?.[0]?.id || null;
    cache.set(name, { at: Date.now(), id });
    return id;
  } catch (_) {
    return null;
  }
}

export async function resolvePhotos(names) {
  const unique = [...new Set((Array.isArray(names) ? names : []).map(name => String(name || '').trim()).filter(Boolean))];
  const photos = new Map();
  if (!unique.length) return photos;

  const ids = new Map();
  await Promise.all(unique.map(async name => {
    const id = await entityFor(name);
    if (id) ids.set(name, id);
  }));
  if (!ids.size) return photos;

  let entities = {};
  try {
    const data = await getJson('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=' + [...new Set(ids.values())].join('|'));
    entities = data.entities || {};
  } catch (_) {
    return photos;
  }

  const files = new Map();
  ids.forEach((id, name) => {
    const file = entities[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (typeof file === 'string' && /\.(jpe?g|webp|png)$/i.test(file) && !/(?:\bflag\b|coat of arms|\blogo\b|\bmap\b|\bdrawing\b|\bpainting\b)/i.test(file)) {
      files.set(id, file);
    }
  });
  if (!files.size) return photos;

  try {
    const data = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=520&titles=' + encodeURIComponent([...new Set(files.values())].map(file => 'File:' + file).join('|')));
    const pages = new Map(Object.values(data.query?.pages || {}).map(page => [page.title?.replace(/^File:/, ''), page.imageinfo?.[0]]));
    ids.forEach((id, name) => {
      const info = pages.get(files.get(id));
      const meta = info?.extmetadata || {};
      const url = info?.thumburl || info?.url;
      if (!url || !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url)) return;
      photos.set(name, {
        url: url.replace('https://upload.wikimedia.org/', 'https://thumb.wikimedia.org/'),
        page: info.descriptionurl || '',
        credit: plain(meta.Artist?.value),
        license: plain(meta.LicenseShortName?.value)
      });
    });
  } catch (_) { /* fall through to the search pass */ }

  const missing = unique.filter(name => !photos.has(name));
  if (!missing.length) return photos;

  const searched = await Promise.all(missing.slice(0, 10).map(async name => {
    const cached = cache.get('search:' + name);
    if (cached && Date.now() - cached.at < CACHE_TTL) return [name, cached.photo];
    try {
      const data = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=1&gsrsearch=' + encodeURIComponent(name) + '&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=520');
      const page = Object.values(data.query?.pages || {})[0];
      const info = page?.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      const url = info?.thumburl || info?.url;
      if (!url || !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url)) return null;
      const photo = {
        url: url.replace('https://upload.wikimedia.org/', 'https://thumb.wikimedia.org/'),
        page: info.descriptionurl || '',
        credit: plain(meta.Artist?.value),
        license: plain(meta.LicenseShortName?.value),
        file: page?.title?.replace(/^File:/, '')
      };
      cache.set('search:' + name, { at: Date.now(), photo });
      return [name, photo];
    } catch (_) {
      return null;
    }
  }));

  searched.filter(Boolean).forEach(([name, photo]) => { if (photo) photos.set(name, photo); });
  return photos;
}

export default resolvePhotos;
