// China-compliant map tile providers with automatic fallback.
//
// Why this exists: the app used to proxy OpenStreetMap tiles through a US-based
// Render instance. That is slow for mainland visitors and, for a China-facing
// product, OSM raster tiles are not a compliant basemap. This module adds the
// Chinese providers (天地图 / 高德 / 腾讯 / 百度) behind the same origin, keeps
// OSM and Google for the rest of the world, caches tiles in process, and falls
// back to the next provider when one fails.
//
// Keys are read from the environment and never sent to the browser: the client
// only learns which providers are configured, not their credentials.
import { createHash } from 'node:crypto';

const TILE_TTL = 7 * 24 * 60 * 60 * 1000;
const TILE_CACHE_MAX = 3000;
const UPSTREAM_TIMEOUT = 12_000;

// `datum` matters: 高德/腾讯 serve GCJ-02 tiles and 百度 serves BD-09, while the
// place catalogue is WGS-84. Markers must be re-projected before they are drawn
// on those basemaps. 天地图's *_w layers are already WGS-84.
const PROVIDER_SPECS = [
  {
    id: 'tianditu',
    label: '天地图',
    labelEn: 'Tianditu',
    datum: 'wgs84',
    maxZoom: 18,
    keyName: 'TIANDITU_KEY',
    attribution: '&copy; 天地图 · 国家地理信息公共服务平台',
    // vec_w is the WGS-84 vector layer, img_w the WGS-84 imagery layer.
    layers: [
      { id: 'vector', template: 'https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk={key}', subdomains: '01234567' },
      { id: 'imagery', template: 'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk={key}', subdomains: '01234567' },
      { id: 'annotation', template: 'https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk={key}', subdomains: '01234567' }
    ]
  },
  {
    id: 'amap',
    label: '高德地图',
    labelEn: 'Amap',
    datum: 'gcj02',
    maxZoom: 18,
    keyName: 'AMAP_KEY',
    attribution: '&copy; 高德地图 GS(2023)3424号',
    layers: [
      { id: 'vector', template: 'https://webrst0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', subdomains: '1234' },
      { id: 'imagery', template: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', subdomains: '1234' }
    ]
  },
  {
    id: 'tencent',
    label: '腾讯地图',
    labelEn: 'Tencent Maps',
    datum: 'gcj02',
    maxZoom: 18,
    keyName: 'TENCENT_MAP_KEY',
    attribution: '&copy; 腾讯地图 · 审图号GS(2022)3125号',
    layers: [
      { id: 'vector', template: 'https://rt0{s}.map.qq.com/tile?type=vector&x={x}&y={y}&z={z}&styleid=3', subdomains: '123' },
      { id: 'imagery', template: 'https://p{s}.map.gtimg.com/sateTiles/{z}/{sx}/{sy}_{x}_{y}.jpg', subdomains: '0123' }
    ]
  },
  {
    id: 'baidu',
    label: '百度地图',
    labelEn: 'Baidu Maps',
    datum: 'bd09',
    maxZoom: 19,
    keyName: 'BAIDU_MAP_KEY',
    attribution: '&copy; 百度地图 · GS(2022)3125号',
    layers: [
      { id: 'vector', template: 'https://maponline0{s}.bdimg.com/tile/?qt=vtile&x={x}&y={y}&z={z}&styles=pl&scaler=1&udt=20240101', subdomains: '123' }
    ]
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    labelEn: 'OpenStreetMap',
    datum: 'wgs84',
    maxZoom: 19,
    keyName: '',
    attribution: '&copy; OpenStreetMap contributors',
    layers: [
      {
        id: 'vector',
        template: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: 'abc',
        // OSM is the only keyless provider, so it is also the only one a browser
        // may fetch directly. Skipping the US proxy halves the round trips for
        // visitors outside China; Chinese visitors still go through the proxy,
        // where the tile is cached and served by a compliant provider instead.
        direct: 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      }
    ]
  },
  {
    id: 'google',
    label: 'Google Maps',
    labelEn: 'Google Maps',
    datum: 'wgs84',
    maxZoom: 20,
    keyName: 'GOOGLE_MAPS_KEY',
    attribution: '&copy; Google Maps',
    layers: [
      { id: 'vector', template: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key={key}', subdomains: '0123' },
      { id: 'imagery', template: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key={key}', subdomains: '0123' }
    ]
  }
];

// Rough mainland-China bounding box used to pick a compliant basemap by default.
// Deliberately generous: a nearby provider is preferable to an OSM proxy hop.
const CHINA_BOUNDS = { south: 17.5, west: 73.5, north: 53.5, east: 135.1 };

// The deployment already carried AMAP_SERVER_KEY / GOOGLE_MAPS_SERVER_KEY for
// the geocoding calls, so those names are accepted as aliases. Without this a
// perfectly good Amap key sat unused and mainland visitors stayed on OSM.
const KEY_ALIASES = {
  AMAP_KEY: ['AMAP_KEY', 'AMAP_SERVER_KEY', 'GAODE_KEY'],
  GOOGLE_MAPS_KEY: ['GOOGLE_MAPS_KEY', 'GOOGLE_MAPS_SERVER_KEY'],
  TIANDITU_KEY: ['TIANDITU_KEY'],
  TENCENT_MAP_KEY: ['TENCENT_MAP_KEY'],
  BAIDU_MAP_KEY: ['BAIDU_MAP_KEY']
};

function providerKey(keyName) {
  for (const name of KEY_ALIASES[keyName] || [keyName]) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function providers() {
  const specs = PROVIDER_SPECS.map(spec => {
    const key = spec.keyName ? providerKey(spec.keyName) : '';
    return {
      ...spec,
      key,
      // Providers without a key are only offered when they are free and keyless.
      configured: !spec.keyName ? true : Boolean(key)
    };
  });
  const list = specs.filter(spec => spec.configured);
  // China-facing order first, so a mainland visitor never starts on the OSM proxy.
  const order = ['tianditu', 'amap', 'tencent', 'baidu', 'osm', 'google'];
  return {
    all: specs,
    configured: list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
    default: (list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))[0] || {}).id || 'osm'
  };
}

export function mapProviderInfo() {
  const { all, configured, default: fallback } = providers();
  return {
    providers: configured.map(spec => ({
      id: spec.id, label: spec.label, labelEn: spec.labelEn, datum: spec.datum,
      maxZoom: spec.maxZoom, attribution: spec.attribution,
      tile: `/api/map/tiles/${spec.id}/{z}/{x}/{y}.png`,
      // Browser-to-provider URL, offered only where the provider's terms allow a
      // keyless fetch (today: OSM). The client falls back to `tile` on error.
      direct: spec.layers.map(layer => layer.direct).find(Boolean) || null,
      subdomains: spec.layers[0].subdomains,
      layers: spec.layers.map(layer => layer.id)
    })),
    // Reported so the UI can explain why a provider is missing; no key material.
    // `datum` is included because the client has to know it before it can be
    // offered — the catalogue is WGS-84 and not every provider is.
    unconfigured: all.filter(spec => !spec.configured).map(spec => ({ id: spec.id, label: spec.label, keyName: spec.keyName, datum: spec.datum })),
    default: fallback,
    chinaBounds: CHINA_BOUNDS,
    fallbackOrder: configured.map(spec => spec.id)
  };
}

function inChina(latitude, longitude) {
  return latitude >= CHINA_BOUNDS.south && latitude <= CHINA_BOUNDS.north
    && longitude >= CHINA_BOUNDS.west && longitude <= CHINA_BOUNDS.east;
}

// Picks the best configured provider for a viewport: a compliant Chinese
// basemap inside China, a keyless global one everywhere else.
export function preferredProvider(latitude, longitude) {
  const { configured } = providers();
  if (!configured.length) return null;
  const chinaFirst = ['tianditu', 'amap', 'tencent', 'baidu'];
  if (inChina(latitude, longitude)) {
    const local = configured.find(spec => chinaFirst.includes(spec.id));
    if (local) return local.id;
  }
  const global = configured.find(spec => !chinaFirst.includes(spec.id));
  return (global || configured[0]).id;
}

function fillTemplate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) => {
    const value = values[name];
    return value === undefined || value === null ? match : String(value);
  });
}

function cacheKey(providerId, layer, z, x, y) {
  return createHash('sha1').update(`${providerId}:${layer}:${z}:${x}:${y}`).digest('hex');
}

export function installMapTiles(app) {
  const { configured } = providers();
  const cache = new Map();
  let misses = 0, hits = 0;
  // A provider whose key is rejected would otherwise be retried for every tile
  // of every request, adding a wasted round trip per layer. Remembering the
  // failure for a minute costs nothing and sends the next tile straight to the
  // provider that actually works.
  const PROVIDER_BACKOFF = 60_000;
  const downUntil = new Map();
  const isDown = id => {
    const until = downUntil.get(id);
    if (!until) return false;
    if (Date.now() > until) { downUntil.delete(id); return false; }
    return true;
  };
  const markDown = id => downUntil.set(id, Date.now() + PROVIDER_BACKOFF);

  function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > TILE_TTL) { cache.delete(key); return null; }
    cache.delete(key); cache.set(key, hit);
    hits += 1;
    return hit;
  }
  function cacheSet(key, value) {
    if (cache.size >= TILE_CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { ...value, at: Date.now() });
  }

  function tileCoord(providerId, layer, z, x, y) {
    // 腾讯 imagery uses a per-quadrant filename; the rest use plain x/y.
    if (providerId === 'tencent' && layer === 'imagery') {
      const quad = (y >> (z - 1)) & 1 ? 1 : 0;
      return { z, x, y, sx: quad * (x % 2), sy: 0 };
    }
    return { z, x, y };
  }

  async function fetchTile(spec, layer, z, x, y) {
    const layerSpec = spec.layers.find(item => item.id === layer) || spec.layers[0];
    if (!layerSpec) throw new Error('unknown layer');
    const subdomain = layerSpec.subdomains[(x + y) % layerSpec.subdomains.length];
    const coord = tileCoord(spec.id, layerSpec.id, z, x, y);
    const url = fillTemplate(layerSpec.template, { ...coord, s: subdomain, key: spec.key });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': `TravelWorld/1.0 (+${process.env.PUBLIC_APP_URL || 'travel-world'})`,
          Referer: process.env.PUBLIC_APP_URL || 'https://travel-world-mwdw.onrender.com/',
          Accept: 'image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5'
        }
      });
      if (!response.ok) throw new Error(`upstream ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/png';
      // Some providers answer with an HTML error page instead of an image.
      if (/text\/html|application\/json/i.test(contentType)) throw new Error('non-image response');
      return { body, contentType };
    } finally { clearTimeout(timer); }
  }

  // Tries the requested provider, then every other configured one, so a single
  // upstream outage never blanks the map.
  async function resolveTile(providerId, z, x, y) {
    const order = [providerId, ...configured.map(spec => spec.id)].filter((id, index, all) => id && all.indexOf(id) === index);
    let lastError = null;
    for (const id of order) {
      // A provider already known to reject its key is skipped entirely.
      if (isDown(id)) continue;
      const spec = configured.find(item => item.id === id);
      if (!spec) continue;
      let failed = null;
      for (const layer of spec.layers.map(item => item.id)) {
        const key = cacheKey(id, layer, z, x, y);
        const cached = cacheGet(key);
        if (cached) { downUntil.delete(id); return { ...cached, provider: id, layer, fromCache: true }; }
        try {
          const { body, contentType } = await fetchTile(spec, layer, z, x, y);
          const entry = { body, contentType };
          cacheSet(key, entry);
          downUntil.delete(id);
          return { ...entry, provider: id, layer, fromCache: false };
        } catch (error) { lastError = error; failed = error; }
      }
      // A rejected key arrives either as 401/403 or as an HTML error page; both
      // mean "stop asking this provider". A plain 404 is just a missing tile at
      // this zoom and must not blacklist anything.
      const reason = String(failed && failed.message || '');
      if (failed && (/\b(401|403)\b/.test(reason) || /non-image/.test(reason))) markDown(id);
    }
    throw lastError || new Error('no tile provider available');
  }

// HTTP header values must be printable Latin-1, so Chinese attributions are
// stripped for the header and kept in full on /api/map/providers instead.
function headerSafe(value) {
  return String(value || '').replace(/[^\x20-\x7e]/g, '').trim();
}

function send(res, result, extra = {}) {
  res.set({
    'Content-Type': result.contentType,
    'Cache-Control': 'public, max-age=2592000, immutable',
    'X-Map-Provider': result.provider,
    'X-Map-Layer': result.layer,
    'X-Map-Cache': result.fromCache ? 'hit' : 'miss'
  });
  const attribution = headerSafe(extra.attribution);
  if (attribution) res.set('X-Map-Attribution', attribution);
  res.send(result.body);
}

  const validTile = (z, x, y) => {
    const max = 2 ** z;
    return Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y)
      && z >= 0 && z <= 20 && x >= 0 && y >= 0 && x < max && y < max;
  };

  app.get('/api/map/providers', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    // `down` is the short-lived failure memory, surfaced so a broken key is
    // visible without reading logs.
    res.json({ ...mapProviderInfo(), cache: { hits, misses, size: cache.size, down: [...downUntil.keys()] } });
  });

  app.get('/api/map/tiles/:provider/:z/:x/:y.png', async (req, res) => {
    const z = Number(req.params.z), x = Number(req.params.x), y = Number(req.params.y);
    if (!validTile(z, x, y)) return res.status(400).json({ error: '地图瓦片坐标无效' });
    const requested = String(req.params.provider || '');
    const spec = configured.find(item => item.id === requested);
    if (!spec) return res.status(404).json({ error: '未知的地图提供商', available: configured.map(item => item.id) });
    try {
      const result = await resolveTile(spec.id, z, x, y);
      if (!result.fromCache) misses += 1;
      // Attribute whoever actually served the tile, not whoever was requested.
      const served = configured.find(item => item.id === result.provider) || spec;
      send(res, result, { attribution: served.attribution });
    } catch (error) {
      res.status(502).json({ error: '地图瓦片服务暂时不可用', detail: String(error && error.message || error).slice(0, 120) });
    }
  });

  // Legacy path kept for cached clients and the service worker's old asset list.
  app.get('/api/map/tiles/:z/:x/:y.png', async (req, res) => {
    const z = Number(req.params.z), x = Number(req.params.x), y = Number(req.params.y);
    if (!validTile(z, x, y)) return res.status(400).json({ error: '地图瓦片坐标无效' });
    const providerId = preferredProvider(35, 105) || providers().default;
    const spec = configured.find(item => item.id === providerId) || configured[0];
    if (!spec) return res.status(503).json({ error: '没有可用的地图提供商' });
    try {
      const result = await resolveTile(spec.id, z, x, y);
      if (!result.fromCache) misses += 1;
      const served = configured.find(item => item.id === result.provider) || spec;
      send(res, result, { attribution: served.attribution });
    } catch (error) {
      res.status(502).json({ error: '地图瓦片服务暂时不可用', detail: String(error && error.message || error).slice(0, 120) });
    }
  });
}

export default installMapTiles;
