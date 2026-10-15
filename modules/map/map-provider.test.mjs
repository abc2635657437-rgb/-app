// Runs modules/map/map-provider.js in a controlled sandbox so the two things
// that are easy to get wrong — the synchronous `get()` contract and the datum
// re-projection — are checked without a browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./map-provider.js', import.meta.url), 'utf8');
// Values created inside the vm sandbox come from another realm, so they have
// foreign prototypes. Copying them into a host array keeps deepEqual honest.
const norm = value => [...value].map(Number);

// The module probes the visitor's timezone to pick a compliant default, and
// fetches the provider list. Both are stubbed per case.
function load({ timeZone = 'Europe/Paris', providers = null, protocol = 'https:' } = {}) {
  const layers = [];
  const window = { L: null };
  const location = { protocol, search: '' };
  const fetchCalls = [];
  // Leaflet is a global in the real page; the module reads `window.L`.
  window.L = {
    tileLayer: (url, options) => {
      layers.push({ url, options });
      const listeners = {};
      const layer = {
        url,
        options,
        on: (event, fn) => { listeners[event] = fn; return layer; },
        addTo: () => layer,
        setUrl: (next) => { layer.url = next; return layer; },
        fireError: () => listeners.tileerror && listeners.tileerror()
      };
      return layer;
    }
  };
  const sandbox = {
    window,
    location,
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }) },
    fetch: (url) => {
      fetchCalls.push(String(url));
      return providers
        ? Promise.resolve(new Response(JSON.stringify(providers), { status: 200, headers: { 'content-type': 'application/json' } }))
        : Promise.reject(new Error('offline'));
    },
    Response,
    Promise,
    Math,
    JSON,
    isFinite,
    Number
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { api: window.TravelMapProviders, layers, fetchCalls, window };
}

// 1. `get()` is synchronous and still returns everything the four existing
//    call sites read, before the backend has answered at all.
{
  const { api } = load();
  const provider = api.get();
  assert.ok(provider.tile && provider.attribution && provider.maxZoom && provider.datum, 'the sync contract holds with no backend response');
  assert.equal(provider.tile, '/api/map/tiles/' + provider.id + '/{z}/{x}/{y}.png', 'tiles stay same-origin');
  assert.equal(api.isLoaded(), false, 'no provider list has arrived yet');
  assert.equal(api.get('nonsense').id, provider.id, 'an unknown id falls back instead of throwing');
}

// 2. The default follows the visitor, so a mainland user never opens on OSM.
{
  assert.equal(load({ timeZone: 'Asia/Shanghai' }).api.active(), 'tianditu', 'mainland visitors get the compliant basemap first');
  assert.equal(load({ timeZone: 'Europe/Paris' }).api.active(), 'osm', 'everyone else gets the keyless global basemap');
  assert.equal(load({ timeZone: 'America/New_York' }).api.active(), 'osm');
}

// 3. Datum re-projection. Reference values, not ranges.
{
  const { api } = load();
  // Default provider is WGS-84, so nothing moves.
  assert.deepEqual(norm(api.focusLatLng(39.9042, 116.4074)), [39.9042, 116.4074], 'on a WGS-84 basemap the coordinate is passed through');
  assert.deepEqual(norm(api.focusLatLng(48.8566, 2.3522)), [48.8566, 2.3522], 'and nothing outside China is corrected, on any provider');

  api.apply({ providers: [{ id: 'amap', datum: 'gcj02', direct: null, subdomains: '1234' }, { id: 'osm', datum: 'wgs84', direct: 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', subdomains: 'abc' }], default: 'amap' });
  assert.equal(api.active(), 'amap', 'the backend preference wins once known');
  assert.equal(api.datum(), 'gcj02');
  assert.deepEqual(norm(api.focusLatLng(48.8566, 2.3522)), [48.8566, 2.3522], 'still untouched on the GCJ-02 provider');
  assert.deepEqual(norm(api.focusLatLng(39.9042, 116.4074)).map(v => Number(v.toFixed(6))), [39.905603, 116.413642], 'WGS-84 Beijing re-projects to the published GCJ-02 position');
  const shanghai = api.focusLatLng(31.2304, 121.4737);
  assert.ok(Number(shanghai[0]) < 31.2304, 'Shanghai shifts south in GCJ-02, which is the documented offset');
  assert.ok(Number(shanghai[1]) > 121.4737, 'and east');
  assert.deepEqual(norm(api.focusPoint({ latitude: 39.9042, longitude: 116.4074 })).map(v => Number(v.toFixed(6))), [39.905603, 116.413642]);
  assert.equal(api.focusList([{ latitude: 48.8566, longitude: 2.3522 }]).length, 1);
  // Garbage in, nothing drawn.
  assert.deepEqual(norm(api.focusLatLng('nope', null)), [0, 0]);
}

// 4. A provider the backend cannot serve is never handed to Leaflet.
{
  const payload = { providers: [{ id: 'tianditu', datum: 'wgs84', direct: null, subdomains: '01234567' }, { id: 'osm', datum: 'wgs84', direct: 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', subdomains: 'abc' }], default: 'tianditu' };
  const { api } = load({ providers: payload });
  api.apply(payload);
  assert.equal(api.isLoaded(), true, 'the backend list was applied');
  assert.equal(api.get('amap').id, 'tianditu', 'an unconfigured provider resolves to the active one, not to a blank map');
  assert.equal(api.get('amap').tile.includes('amap'), false, 'and never leaks an amap tile URL');
  assert.equal(api.get('tianditu').id, 'tianditu', 'a configured provider is still directly addressable');
  assert.equal(api.get('osm').direct, 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 'the direct URL is carried through for configured providers');
}

// 5. Tile URL choice: direct browser→provider only where it is legal, and never
//    for a mainland visitor.
{
  const payload = { providers: [{ id: 'osm', datum: 'wgs84', direct: 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', subdomains: 'abc' }], default: 'osm' };
  const outside = load({ timeZone: 'Europe/Paris', providers: payload });
  outside.api.apply(payload);
  const map = {};
  const layer = outside.api.tileLayer(map, { scrollWheelZoom: false });
  assert.equal(layer.url, 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 'outside China the browser goes straight to the provider');
  assert.equal(layer.options.attribution, '&copy; OpenStreetMap contributors');
  layer.fireError();
  assert.equal(layer.url, '/api/map/tiles/osm/{z}/{x}/{y}.png', 'one failed tile swaps to the same-origin proxy');

  const inside = load({ timeZone: 'Asia/Shanghai', providers: payload });
  inside.api.apply(payload);
  const map2 = {};
  const layer2 = inside.api.tileLayer(map2);
  assert.equal(layer2.url, '/api/map/tiles/osm/{z}/{x}/{y}.png', 'mainland visitors stay on the compliant proxy');
  assert.equal(layer2.options.maxZoom, 19, 'the provider maxZoom is used, not a hardcoded 19');
}

// 6. The backend lookup is fired on its own and never blocks the first paint.
{
  const { api, fetchCalls } = load();
  assert.equal(api.active(), 'osm', 'the map is usable before the request resolves');
  assert.ok(fetchCalls.includes('/api/map/providers'), 'the lookup was started');
}

// 7. onReady fires once, with the resolved provider.
{
  const payload = { providers: [{ id: 'tianditu', datum: 'wgs84', direct: null, subdomains: '01234567' }, { id: 'osm', datum: 'wgs84', direct: 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', subdomains: 'abc' }], default: 'tianditu' };
  const { api } = load({ timeZone: 'Asia/Shanghai', providers: payload });
  let fired = 0, seen = null;
  api.onReady(provider => { fired += 1; seen = provider; });
  assert.equal(fired, 0, 'nothing fires before the list arrives');
  api.apply(payload);
  assert.equal(fired, 1, 'onReady fires exactly once');
  assert.equal(seen.id, 'tianditu');
  api.onReady(() => { fired += 1; });
  assert.equal(fired, 2, 'a late subscriber is called immediately');
}

// 8. Offline: a failed lookup keeps the timezone default rather than breaking.
{
  const { api } = load({ timeZone: 'Asia/Shanghai', providers: null });
  assert.equal(api.active(), 'tianditu', 'an unreachable backend leaves a usable provider');
  assert.equal(api.isLoaded(), false);
  api.apply(null);
  assert.equal(api.active(), 'tianditu', 'a null payload is ignored');
}

// 9. Attribution names the provider actually in use, so the badge is honest.
{
  const { api } = load();
  assert.ok(api.attributionLabel().includes('OpenStreetMap'), 'the label credits the active provider');
  api.apply({ providers: [{ id: 'amap', datum: 'gcj02', direct: null, subdomains: '1234' }], default: 'amap' });
  assert.ok(api.attributionLabel().includes('高德地图'), 'and switches with the provider');
}

console.log('map-provider: all frontend contract checks passed');
