import { readFileSync, existsSync } from 'node:fs';

const agent = 'TravelWorld/1.0 (+https://travel-world-mwdw.onrender.com)';
const cache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 3000;
// thumb.wikimedia.org only serves standard buckets; arbitrary widths such as
// 1400 return HTTP 400, so every request is rounded down to one of these.
const THUMB_WIDTHS = [250, 330, 500, 960, 1280, 1920];
const bucket = width => THUMB_WIDTHS.filter(size => size <= Math.max(240, Number(width) || 1280)).pop() || 250;

// Hand-picked replacements for places whose Wikidata photograph is small,
// portrait or visibly dated. The server still resolves author, licence and the
// source page from Commons, so the credit stays exact.
const overrides = (() => {
  try {
    const file = new URL('../modules/data/destination-photo-overrides.json', import.meta.url);
    if (!existsSync(file)) return {};
    const payload = JSON.parse(readFileSync(file, 'utf8'));
    return payload.files || {};
  } catch (_) { return {}; }
})();

export function imageIds(value) {
  const ids = [...new Set(String(value || '').split('|'))];
  if (!ids.length || ids.length > 24 || ids.some(id => !/^Q\d+$/.test(id))) throw new Error('Invalid place IDs');
  return ids;
}

const plain = v => String(v || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);

async function json(url, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': agent }, signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (response?.ok) {
      const body = await response.json().catch(() => null);
      if (body && !body.error) return body;
    }
    if (response && ![429, 502, 503, 504].includes(response.status) && attempt === 0) return null;
    await new Promise(resolve => setTimeout(resolve, 900 * (attempt + 1)));
  }
  return null;
}

async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try { results[index] = await task(items[index], index); } catch (_) { results[index] = null; }
    }
  }));
  return results;
}

function splitTitle(value) {
  return 'File:' + String(value || '').replace(/^File:/, '');
}

async function entities(ids) {
  const data = await json('https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action: 'wbgetentities', format: 'json', props: 'claims', ids: ids.join('|'),
  }), 3);
  return data?.entities || {};
}

async function imageInfo(title, width) {
  const data = await json('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', origin: '*', titles: splitTitle(title), prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(width),
  }), 3);
  const page = Object.values(data?.query?.pages || {})[0] || {};
  return page.imageinfo?.[0] || null;
}

function thumbUrl(info, width) {
  const url = info?.thumburl || info?.url || '';
  if (!url || !Number.isFinite(info?.width)) return url;
  if (!/\/\d+px-/.test(url)) return url;
  const safe = Math.min(bucket(width), info.width);
  return url.replace(/\/(\d+)px-/, `/${safe}px-`);
}

function srcset(url, width) {
  if (!url || !/\/\d+px-/.test(url)) return '';
  return THUMB_WIDTHS
    .filter(size => size <= bucket(width) && size <= (Number(width) || 1280))
    .map(size => `${url.replace(/\/(\d+)px-/, `/${size}px-`)} ${size}w`)
    .join(', ');
}

function photoFrom(info, placeId, width, file) {
  if (!info) return null;
  const meta = info.extmetadata || {};
  const url = thumbUrl(info, width);
  return {
    url,
    srcset: srcset(url, width),
    width: Math.min(info.thumbwidth || info.width || 0, bucket(width)),
    height: info.thumbheight || info.height || 0,
    originalWidth: info.width || 0,
    originalHeight: info.height || 0,
    date: plain(meta.DateTimeOriginal?.value || meta.DateTime?.value),
    credit: plain(meta.Artist?.value).slice(0, 140),
    license: plain(meta.LicenseShortName?.value),
    licenseUrl: meta.LicenseUrl?.value || '',
    sourceUrl: info.descriptionurl || '',
    file,
    placeId,
    provider: 'Wikimedia Commons',
  };
}

export function installPlaceImages(app) {
  app.get('/api/map/place-images', async (req, res) => {
    let ids;
    try { ids = imageIds(req.query.ids); } catch (_) { return res.status(400).json({ error: 'Invalid place IDs' }); }
    const width = Math.max(240, Math.min(2000, Number(req.query.w) || 240));
    const keyFor = id => `${id}:${bucket(width)}`;
    try {
      const fresh = ids.filter(id => {
        const cached = cache.get(keyFor(id));
        return !(cached && Date.now() - cached.at < CACHE_TTL);
      });
      if (fresh.length) {
        const data = await entities(fresh);
        await mapLimit(fresh, 3, async id => {
          const claims = data[id]?.claims || {};
          const file = overrides[id]?.file || claims.P18?.[0]?.mainsnak?.datavalue?.value || '';
          const info = file ? await imageInfo(file, width) : null;
          cache.set(keyFor(id), { photo: photoFrom(info, id, width, file), width: bucket(width), at: Date.now() });
          while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
        });
      }
      res.json({
        photos: Object.fromEntries(ids.map(id => [id, cache.get(keyFor(id))?.photo || null])),
        provider: 'Wikidata P18 / Wikimedia Commons',
        requestedWidth: bucket(width),
      });
    } catch (_) {
      res.status(502).json({ error: 'Place photographs are unavailable. No substitute image was used.' });
    }
  });
}
