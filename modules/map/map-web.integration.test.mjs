// Executes the real modules/map/map-web.js against the real
// modules/map/map-provider.js in a vm, with a fake Leaflet that records every
// coordinate and tile URL it is handed.
//
// The browser is unavailable in this environment (Chrome exits silently when a
// user session is running), so this is the only way to check the integration
// that matters: does initTravelMap() create one tile layer on the provider's
// URL, and are the markers it draws projected into the active datum?
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

// This file lives in modules/map/, so the repo root is two levels up.
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = relative => readFileSync(root + relative, 'utf8');

// --- recorded side effects -------------------------------------------------
const tileLayers = [];
const markers = [];
const setViews = [];
const fitBounds = [];
const allElements = [];

// renderMarkers() is async and initMap() does not await it, so the markers land
// a few ticks after initTravelMap() resolves. Flush before asserting on them.
const flush = () => new Promise(resolve => setTimeout(resolve, 50));

// Coordinates recorded from inside the vm come from another realm, so their
// arrays carry foreign prototypes. Copying them into host values keeps the
// deepEqual assertions meaningful.
const norm = coords => [...coords].map(Number);

function makeLeaflet() {
  const marker = (coords, options) => {
    markers.push({ coords, options });
    const m = { addTo: () => m, bindPopup: () => m, on: () => m, remove: () => {}, openPopup: () => m };
    return m;
  };
  const map = {
    _twTileLayer: null,
    on: () => map,
    invalidateSize: () => map,
    remove: () => map,
    getZoom: () => 8,
    getBounds: () => ({ contains: () => true, getSouth: () => -85, getNorth: () => 85, getWest: () => -180, getEast: () => 180 }),
    latLngToLayerPoint: coords => ({ x: coords[1] * 100, y: -coords[0] * 100 }),
    setView: coords => { setViews.push(coords); return map; },
    fitBounds: coords => { fitBounds.push(coords); return map; }
  };
  return {
    map: () => map,
    // Records the URL and options, and supports the error-fallback handshake the
    // real provider module wires when it uses a browser-direct URL.
    tileLayer: (url, options) => {
      const listeners = {};
      const layer = {
        url, options,
        on: (event, fn) => { listeners[event] = fn; return layer; },
        setUrl: next => { layer.url = next; return layer; },
        fireTileError: () => listeners.tileerror && listeners.tileerror(),
        addTo: target => { tileLayers.push({ url: layer.url, options, target, layer }); return layer; },
        remove: () => {}
      };
      return layer;
    },
    marker,
    divIcon: options => options,
    polyline: coords => ({ addTo: () => ({ getBounds: () => coords }) })
  };
}

function makeElement(id) {
  const el = {
    id,
    offsetParent: {},
    className: '',
    style: { cssText: '', setProperty: () => {} },
    dataset: {},
    children: [],
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    appendChild: child => { el.children.push(child); return child; },
    append: (...kids) => el.children.push(...kids),
    insertBefore: child => { el.children.push(child); return child; },
    replaceChildren: () => { el.children = []; },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    remove: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    closest: () => null,
    after: () => {},
    before: () => {}
  };
  // updateProviderBadge() attaches via mapStatus.after(), which a stub cannot
  // observe. Registering every element makes the badge findable regardless of
  // where it is mounted.
  allElements.push(el);
  return el;
}

// Browser globals Node does not provide.
const requestAnimationFrame = fn => setTimeout(fn, 0);
const cancelAnimationFrame = id => clearTimeout(id);

async function load({ timeZone = 'Europe/Paris', providers = null } = {}) {
  tileLayers.length = 0; markers.length = 0; setViews.length = 0; fitBounds.length = 0; allElements.length = 0;
  const canvas = makeElement('mapCanvas');
  const status = makeElement('mapStatus');
  const elements = new Map([['mapCanvas', canvas], ['mapStatus', status]]);

  const sandbox = {
    console,
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }) },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame,
    AbortController, AbortSignal: { timeout: () => ({ aborted: false }) },
    URL, URLSearchParams,
    document: {
      getElementById: id => elements.get(id) || null,
      createElement: tag => makeElement(tag),
      querySelector: () => null,
      querySelectorAll: () => [],
      head: makeElement('head'),
      body: makeElement('body'),
      addEventListener: () => {}
    },
    location: { protocol: 'https:', search: '', hostname: 'travel-world-mwdw.onrender.com', href: 'https://travel-world-mwdw.onrender.com/' },
    navigator: { serviceWorker: { register: () => Promise.resolve({ update: () => {} }) }, geolocation: { getCurrentPosition: () => {}, watchPosition: () => {} } },
    fetch: (url, options) => {
      const target = String(url);
      if (target.includes('landmarks.json')) {
        return Promise.resolve(new Response(JSON.stringify(LANDMARKS), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      if (target.includes('global-landmark-guide-catalog.json')) {
        return Promise.resolve(new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }));
      }
      if (target.includes('place-backgrounds.json')) {
        return Promise.resolve(new Response(JSON.stringify({ backgrounds: {} }), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      if (target.startsWith('/api/map/providers')) {
        return providers
          ? Promise.resolve(new Response(JSON.stringify(providers), { status: 200, headers: { 'content-type': 'application/json' } }))
          : Promise.reject(new Error('offline'));
      }
      // Everything else (places, images, presence) resolves empty; nothing under
      // test depends on it.
      return Promise.resolve(new Response(JSON.stringify({ places: [], photos: {} }), { status: 200, headers: { 'content-type': 'application/json' } }));
    },
    Response, Promise, Math, JSON, Number, isFinite, Date
  };
  sandbox.window = sandbox;
  sandbox.L = makeLeaflet();
  sandbox.window.L = sandbox.L;

  // Node drops the vm's importModuleDynamically callback once the module is in
  // the ESM cache, which breaks the second and later load() calls. Pre-loading
  // the cluster module on the host side and swapping the import for a resolved
  // promise avoids that entirely — and keeps the real implementation under test.
  sandbox.__clusterModule = await import(pathToFileURL(root + 'modules/map/cluster-points.js').href);

  const context = vm.createContext(sandbox);
  vm.runInContext(read('modules/map/map-provider.js'), context, { filename: 'map-provider.js' });
  vm.runInContext(read('modules/map/map-web.js').replace("import('./cluster-points.js')", 'globalThis.__clusterModule'), context, { filename: 'map-web.js' });
  return sandbox;
}

// Two landmarks far enough apart to stay unclustered, one in China and one in
// France, so the projection is visible in the recorded markers.
const LANDMARKS = {
  landmarks: [
    { id: 'cn-west-lake', name: '西湖', name_en: 'West Lake', city: '杭州', country: '中国', latitude: 30.2465, longitude: 120.1492, icon: '🏞️', image: '/x.png' },
    { id: 'fr-eiffel', name: '埃菲尔铁塔', name_en: 'Eiffel Tower', city: '巴黎', country: '法国', latitude: 48.8584, longitude: 2.2945, icon: '🗼', image: '/y.png' }
  ]
};

const PROVIDERS = {
  providers: [
    { id: 'amap', datum: 'gcj02', maxZoom: 18, attribution: '&copy; 高德地图 GS(2023)3424号', direct: null, subdomains: '1234' },
    { id: 'osm', datum: 'wgs84', maxZoom: 19, attribution: '&copy; OpenStreetMap contributors', direct: 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', subdomains: 'abc' }
  ],
  default: 'amap',
  unconfigured: [], chinaBounds: { south: 17.5, west: 73.5, north: 53.5, east: 135.1 }, fallbackOrder: ['amap', 'osm']
};

const OSM_ONLY = {
  providers: [
    { id: 'osm', datum: 'wgs84', maxZoom: 19, attribution: '&copy; OpenStreetMap contributors', direct: 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', subdomains: 'abc' }
  ],
  default: 'osm',
  unconfigured: [{ id: 'amap', label: '高德地图', keyName: 'AMAP_KEY', datum: 'gcj02' }],
  chinaBounds: { south: 17.5, west: 73.5, north: 53.5, east: 135.1 }, fallbackOrder: ['osm']
};

// 1. Baseline: backend has answered, WGS-84 provider, non-China visitor.
{
  const sandbox = await load({ timeZone: 'Europe/Paris', providers: OSM_ONLY });
  const api = sandbox.window.TravelMapProviders;
  api.apply(OSM_ONLY);
  await sandbox.window.initTravelMap();
  await flush();
  const statusText = () => String(sandbox.document.getElementById('mapStatus')?.textContent || '');
  assert.equal(tileLayers.length, 1, 'exactly one tile layer is created (status: ' + statusText() + ')');
  assert.equal(tileLayers[0].url, 'https://t{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 'outside China and keyless, the browser goes straight to the provider');
  assert.equal(tileLayers[0].options.attribution, '&copy; OpenStreetMap contributors');
  assert.equal(markers.length, LANDMARKS.landmarks.length, 'every landmark gets a marker');
  const westLake = markers.find(m => Math.abs(m.coords[0] - 30.2465) < 0.02);
  assert.deepEqual(norm(westLake.coords).map(v => Number(v.toFixed(6))), [30.2465, 120.1492], 'on a WGS-84 basemap the coordinate is untouched');
  assert.equal(api.get('amap').id, 'osm', 'a provider the backend cannot serve is never handed to Leaflet');
}

// 2. The backend picks 高德 (GCJ-02): the tile layer switches to the proxy and
//    the Chinese marker moves while the French one does not.
{
  const sandbox = await load({ timeZone: 'Asia/Shanghai', providers: PROVIDERS });
  const api = sandbox.window.TravelMapProviders;
  api.apply(PROVIDERS);
  assert.equal(api.active(), 'amap', 'the backend preference is honoured');
  await sandbox.window.initTravelMap();
  await flush();
  // The status line is the module's own error channel; surfacing it makes a
  // silent early-return obvious instead of just "0 !== 1".
  const statusText = () => String(sandbox.document.getElementById('mapStatus')?.textContent || '');
  assert.equal(tileLayers.length, 1, 'still exactly one tile layer — no duplicate after the switch (status: ' + statusText() + ')');
  assert.equal(tileLayers[0].url, '/api/map/tiles/amap/{z}/{x}/{y}.png', 'a keyed Chinese provider is served through the same-origin proxy');
  assert.equal(tileLayers[0].options.attribution, '&copy; 高德地图 GS(2023)3424号', 'attribution names the provider actually in use');
  assert.equal(tileLayers[0].options.maxZoom, 18, 'the provider maxZoom is used, not a hardcoded 19');

  const westLake = markers.find(m => m.coords[0] < 31 && m.coords[0] > 29);
  assert.deepEqual(norm(westLake.coords).map(v => Number(v.toFixed(6))), [30.244179, 120.153909], 'the Chinese marker is re-projected into GCJ-02');
  const eiffel = markers.find(m => m.coords[0] > 40);
  assert.deepEqual(norm(eiffel.coords).map(v => Number(v.toFixed(6))), [48.8584, 2.2945], 'the French marker is left exactly as it is');
}

// 3. The attribution badge is written and names the active provider.
{
  const sandbox = await load({ timeZone: 'Asia/Shanghai', providers: PROVIDERS });
  sandbox.window.TravelMapProviders.apply(PROVIDERS);
  await sandbox.window.initTravelMap();
  await flush();
  const badge = allElements.find(el => el.id === 'mapProviderCredit');
  assert.ok(badge, 'the provider badge element is created');
  assert.ok(String(badge.textContent).includes('高德地图'), 'and it credits the provider actually in use: ' + badge.textContent);
}

// 4. Offline: no backend answer, the map still renders on the timezone default,
//    and uses the same-origin proxy because no direct URL is known to be allowed.
{
  const sandbox = await load({ timeZone: 'Asia/Shanghai' });
  await sandbox.window.initTravelMap();
  await flush();
  assert.equal(tileLayers.length, 1, 'a tile layer is created without any backend answer');
  assert.equal(tileLayers[0].url, '/api/map/tiles/tianditu/{z}/{x}/{y}.png', 'mainland visitors default to the compliant provider');
  assert.equal(markers.length, LANDMARKS.landmarks.length, 'markers are still drawn');

  const outside = await load({ timeZone: 'Europe/Paris' });
  await outside.window.initTravelMap();
  await flush();
  assert.equal(tileLayers.length, 1, 'and the same holds outside China');
  assert.equal(tileLayers[0].url, '/api/map/tiles/osm/{z}/{x}/{y}.png', 'with no backend answer a direct fetch is never assumed');
}

console.log('map-web integration: 5 checks passed');
// initMap() leaves a 30s presence-refresh interval running, which would keep the
// process alive long after the assertions. Exiting explicitly is correct here:
// reaching this line means every assertion above it already passed.
process.exit(0);
