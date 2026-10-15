import assert from 'node:assert/strict';
import express from 'express';
import { installMapTiles, mapProviderInfo, preferredProvider } from './map-tiles.mjs';

// A 1x1 PNG, small enough to inline and unmistakably an image.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const REAL_FETCH = globalThis.fetch;

// Deterministic upstream: OpenStreetMap answers, every Chinese provider fails.
// The templates are hardcoded in the module, so the hostname is the only handle.
// Requests to the local test server itself must fall through to the real fetch.
const upstreamCalls = [];
globalThis.fetch = async (url, options) => {
  const target = String(url);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(target)) return REAL_FETCH(url, options);
  upstreamCalls.push(target);
  if (target.includes('tile.openstreetmap.org')) {
    return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
  }
  // Providers with a bogus key, and anything unknown, fail with an HTML error
  // page — the same shape a real provider returns when it rejects the token.
  return new Response('<html><body>invalid key</body></html>', { status: 403, headers: { 'content-type': 'text/html' } });
};

const KEY = 'test-secret-key-value';
const restore = () => {
  globalThis.fetch = REAL_FETCH;
  for (const name of ['TIANDITU_KEY', 'AMAP_KEY', 'TENCENT_MAP_KEY', 'BAIDU_MAP_KEY', 'GOOGLE_MAPS_KEY']) delete process.env[name];
};

const install = () => {
  const scoped = express();
  installMapTiles(scoped);
  const srv = scoped.listen(0);
  return { srv, url: `http://127.0.0.1:${srv.address().port}` };
};

// 1. The public provider list is honest about keys and never leaks them.
{
  process.env.TIANDITU_KEY = KEY;
  const info = mapProviderInfo();
  const ids = info.providers.map(spec => spec.id);
  assert.deepEqual(ids, ['tianditu', 'osm'], 'only providers with a usable key are offered');
  assert.equal(info.default, 'tianditu', 'the compliant mainland basemap leads the order');
  assert.deepEqual(info.unconfigured.map(spec => spec.id), ['amap', 'tencent', 'baidu', 'google'], 'keyed providers without a key are listed as unavailable');
  const serialized = JSON.stringify(info);
  assert.ok(!serialized.includes(KEY), 'the key itself must never reach the client');
  assert.ok(info.providers.every(spec => /^\/api\/map\/tiles\//.test(spec.tile)), 'every tile URL is same-origin');
  assert.equal(info.providers.find(spec => spec.id === 'tianditu').direct, null, 'keyed providers have no browser-direct URL');
  assert.ok(info.providers.find(spec => spec.id === 'osm').direct, 'the keyless provider offers a direct URL');
  assert.equal(info.providers.find(spec => spec.id === 'tianditu').datum, 'wgs84', 'tianditu *_w layers are WGS-84');
  assert.equal(info.providers.find(spec => spec.id === 'osm').datum, 'wgs84', 'OSM is WGS-84');
  assert.equal(info.unconfigured.find(spec => spec.id === 'amap').datum, 'gcj02', '高德 tiles are GCJ-02, so markers need re-projecting');
  assert.equal(info.unconfigured.find(spec => spec.id === 'baidu').datum, 'bd09', '百度 tiles are BD-09');
  assert.equal(info.unconfigured.find(spec => spec.id === 'tianditu'), undefined, 'a configured provider is not also listed as unavailable');
  assert.ok(info.chinaBounds, 'the mainland bounds used for provider selection are published');
  delete process.env.TIANDITU_KEY;
}

// 2. Provider choice follows the viewport, not a hardcoded default.
{
  process.env.TIANDITU_KEY = KEY;
  assert.equal(preferredProvider(39.9, 116.4), 'tianditu', 'Beijing gets the compliant mainland basemap');
  assert.equal(preferredProvider(48.86, 2.35), 'osm', 'Paris gets the keyless global basemap');
  assert.equal(preferredProvider(40.71, -74.0), 'osm', 'New York gets the keyless global basemap');
  delete process.env.TIANDITU_KEY;
  assert.equal(preferredProvider(39.9, 116.4), 'osm', 'without a key, even Beijing falls back rather than serving nothing');
}

// 3. Bad input is rejected before any upstream request is made.
{
  const before = upstreamCalls.length;
  const { srv, url } = install();
  const bad = await fetch(`${url}/api/map/tiles/tianditu/19/999999/0.png`);
  assert.equal(bad.status, 400, 'out-of-range tile coordinates are rejected');
  const unknown = await fetch(`${url}/api/map/tiles/nope/3/1/2.png`);
  assert.equal(unknown.status, 404, 'an unknown provider is refused, not silently proxied');
  assert.deepEqual((await unknown.json()).available, ['osm'], 'the error names what is actually available');
  assert.equal(upstreamCalls.length, before, 'rejected requests never reach a provider');
  srv.close();
}

// 4. A provider whose key is rejected falls back to the next configured one,
//    and the attribution names whoever actually served the tile.
{
  process.env.TIANDITU_KEY = KEY;   // configured, but every tile request fails
  const { srv, url } = install();
  const response = await fetch(`${url}/api/map/tiles/tianditu/3/1/2.png`);
  assert.equal(response.status, 200, 'a broken provider must not blank the map');
  assert.equal(response.headers.get('x-map-provider'), 'osm', 'the fallback provider served it');
  assert.equal(response.headers.get('x-map-cache'), 'miss', 'first fetch is a cache miss');
  assert.equal(response.headers.get('x-map-layer'), 'vector');
  const attribution = response.headers.get('x-map-attribution');
  assert.ok(attribution, 'the tile carries an attribution header');
  assert.ok(!/[^\x20-\x7e]/.test(attribution), 'the header must be printable Latin-1, or Node throws on send');
  assert.ok(attribution.includes('OpenStreetMap'), 'attribution credits the serving provider, not the requested one');
  assert.equal(Buffer.from(await response.arrayBuffer()).length, PNG.length, 'the proxied bytes arrive intact');
  srv.close();
}

// 5. Repeated tiles are served from the in-process cache, once. A provider
//    whose key was rejected is skipped rather than retried per tile.
{
  process.env.TIANDITU_KEY = KEY;
  const { srv, url } = install();
  const before = upstreamCalls.length;
  await fetch(`${url}/api/map/tiles/tianditu/4/2/3.png`);
  const first = upstreamCalls.length - before;
  assert.ok(first >= 2, 'the broken provider was tried before falling back');
  const second = await fetch(`${url}/api/map/tiles/tianditu/4/2/3.png`);
  assert.equal(second.headers.get('x-map-cache'), 'hit', 'the second request is a cache hit');
  assert.equal(upstreamCalls.length - before - first, 0, 'a cached tile never reaches upstream again');
  assert.equal((await fetch(`${url}/api/map/providers`).then(r => r.json())).cache.down.includes('tianditu'), true, 'the rejected provider is remembered, not retried');
  assert.match(second.headers.get('cache-control') || '', /max-age=2592000/, 'tiles are immutable for 30 days');
  srv.close();
}

// 6. The legacy tile path still resolves for cached clients and the service worker.
{
  const { srv, url } = install();
  const response = await fetch(`${url}/api/map/tiles/5/2/3.png`);
  assert.equal(response.status, 200, 'the legacy path keeps serving');
  assert.equal(response.headers.get('x-map-provider'), 'osm');
  srv.close();
}

// 7. The deployment already carries AMAP_SERVER_KEY / GOOGLE_MAPS_SERVER_KEY for
//    geocoding, so those names are honoured — otherwise a working key sits idle
//    and mainland visitors stay on the OSM proxy.
{
  for (const name of ['TIANDITU_KEY', 'AMAP_KEY', 'TENCENT_MAP_KEY', 'BAIDU_MAP_KEY', 'GOOGLE_MAPS_KEY', 'AMAP_SERVER_KEY', 'GOOGLE_MAPS_SERVER_KEY']) delete process.env[name];
  process.env.AMAP_SERVER_KEY = KEY;
  const info = mapProviderInfo();
  assert.deepEqual(info.providers.map(spec => spec.id), ['amap', 'osm'], 'the alias alone is enough to configure the provider');
  assert.equal(info.default, 'amap', 'and mainland visitors then get 高德, not the OSM proxy');
  const serialized = JSON.stringify(info);
  assert.ok(!serialized.includes(KEY), 'still no key material in the payload');
  delete process.env.AMAP_SERVER_KEY;
}

// 8. A rejected key served as an HTML page is also remembered, not retried per tile.
{
  process.env.TIANDITU_KEY = KEY;
  const realFetch = globalThis.fetch;
  // Same shape a real provider returns when it rejects a token: 200 + HTML.
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(target)) return realFetch(url);
    if (target.includes('tile.openstreetmap.org')) return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
    return new Response('<html>forbidden</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const { srv, url } = install();
  const first = await fetch(`${url}/api/map/tiles/tianditu/6/2/3.png`);
  assert.equal(first.status, 200, 'an HTML error page still falls through to a working provider');
  assert.equal(first.headers.get('x-map-provider'), 'osm');
  assert.equal((await fetch(`${url}/api/map/providers`).then(r => r.json())).cache.down.includes('tianditu'), true, 'the HTML rejection is remembered');
  srv.close();
  globalThis.fetch = realFetch;
}

restore();
console.log('map-tiles: 8 assertions groups passed');
