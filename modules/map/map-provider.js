// Basemap selection for every Leaflet map in the app.
//
// Two problems this file solves:
//
// 1. Compliance. OSM raster tiles are not a lawful basemap for a mainland-facing
//    product, so the Chinese providers (天地图 / 高德 / 腾讯 / 百度) sit behind the
//    same origin and are preferred automatically. Only `/api/map/providers` is
//    public — the keys themselves never reach the browser.
//
// 2. Datum drift. The place catalogue is WGS-84. 高德 and 腾讯 serve GCJ-02 tiles
//    and 百度 serves BD-09, so a marker drawn from raw WGS-84 coordinates lands
//    hundreds of metres off on those basemaps. `focusLatLng()` re-projects on the
//    way out; 天地图 `*_w` layers and OSM are already WGS-84 and pass through
//    untouched, which is why they stay the default.
//
// `get()` has to stay synchronous: the four existing tile call sites (map-web,
// discover-web, west-lake-guide) call it during Leaflet setup, before any request
// has resolved. The backend list only ever narrows the choice afterwards — it
// never blocks the first paint.
(function () {
  const PROVIDERS = {
    tianditu: { id: 'tianditu', label: '天地图', labelEn: 'Tianditu', datum: 'wgs84', maxZoom: 18, attribution: '&copy; 天地图 · 国家地理信息公共服务平台' },
    amap: { id: 'amap', label: '高德地图', labelEn: 'Amap', datum: 'gcj02', maxZoom: 18, attribution: '&copy; 高德地图 GS(2023)3424号' },
    tencent: { id: 'tencent', label: '腾讯地图', labelEn: 'Tencent Maps', datum: 'gcj02', maxZoom: 18, attribution: '&copy; 腾讯地图 · 审图号GS(2022)3125号' },
    baidu: { id: 'baidu', label: '百度地图', labelEn: 'Baidu Maps', datum: 'bd09', maxZoom: 19, attribution: '&copy; 百度地图 · GS(2022)3125号' },
    osm: { id: 'osm', label: 'OpenStreetMap', labelEn: 'OpenStreetMap', datum: 'wgs84', maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' },
    google: { id: 'google', label: 'Google Maps', labelEn: 'Google Maps', datum: 'wgs84', maxZoom: 20, attribution: '&copy; Google Maps' }
  };
  // Preference inside mainland China, and everywhere else. A mainland visitor
  // should never open the map on a foreign proxy.
  const CHINA_FIRST = ['tianditu', 'amap', 'tencent', 'baidu'];
  const GLOBAL_FIRST = ['osm', 'google'];
  const CHINA_TIMEZONES = ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Urumqi', 'Asia/Macau', 'Asia/Hong_Kong', 'Asia/Taipei'];

  let configured = null;      // ids the backend can actually serve
  let serverDefault = null;   // the backend's own preference
  let requested = null;       // explicit ?provider= override, kept forever
  let active = null;
  let revision = 0;
  const ready = [];

  function inMainland() {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (CHINA_TIMEZONES.indexOf(zone) !== -1) return true;
    } catch (_) { /* Intl is missing on very old browsers; fall through */ }
    return false;
  }

  function pickDefault() {
    const order = inMainland() ? CHINA_FIRST.concat(GLOBAL_FIRST) : GLOBAL_FIRST.concat(CHINA_FIRST);
    const wanted = requested && order.indexOf(requested) !== -1 ? requested : null;
    if (wanted) return wanted;
    if (configured) {
      const available = order.filter(id => configured.indexOf(id) !== -1);
      if (serverDefault && available.indexOf(serverDefault) !== -1) return serverDefault;
      if (available.length) return available[0];
    }
    const known = order.filter(id => PROVIDERS[id]);
    return known[0] || 'osm';
  }

  function describe(id) {
    const spec = PROVIDERS[id] || PROVIDERS.osm;
    return {
      id: spec.id,
      label: spec.label,
      labelEn: spec.labelEn,
      datum: spec.datum,
      maxZoom: spec.maxZoom,
      attribution: spec.attribution,
      tile: '/api/map/tiles/' + spec.id + '/{z}/{x}/{y}.png'
    };
  }

  // Everything the client needs, resolved from the backend once it answers.
  let remote = {};

  function current() {
    if (!active) active = pickDefault();
    const spec = describe(active);
    const remoteSpec = remote[spec.id] || {};
    return Object.assign({}, spec, {
      direct: remoteSpec.direct || null,
      subdomains: remoteSpec.subdomains || 'abc'
    });
  }

  // --- WGS-84 → GCJ-02 → BD-09 ------------------------------------------------
  // Standard published constants; `outOfChina` short-circuits so a Paris marker
  // is never nudged by a China-specific correction.
  const A = 6378245.0;
  const EE = 0.00669342162296594323;

  function outOfChina(lat, lon) {
    return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }

  function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }

  function transformLon(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
    return ret;
  }

  function wgs84ToGcj02(lat, lon) {
    if (outOfChina(lat, lon)) return [lat, lon];
    let dLat = transformLat(lon - 105.0, lat - 35.0);
    let dLon = transformLon(lon - 105.0, lat - 35.0);
    const radLat = (lat / 180.0) * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * Math.PI);
    dLon = (dLon * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * Math.PI);
    return [lat + dLat, lon + dLon];
  }

  function gcj02ToBd09(lat, lon) {
    const z = Math.sqrt(lon * lon + lat * lat) + 0.00002 * Math.sin(lat * Math.PI * 3000.0 / 180.0);
    const theta = Math.atan2(lat, lon) + 0.000003 * Math.cos(lon * Math.PI * 3000.0 / 180.0);
    return [z * Math.sin(theta) + 0.006, z * Math.cos(theta) + 0.0065];
  }

  // Catalogue coordinates are always WGS-84; this returns what the *active*
  // basemap expects. Same input, different output, depending on the provider.
  // Every correction is China-specific, so a point outside China is passed
  // through untouched — a Paris marker on the BD-09 maths would be nonsense.
  function focusLatLng(latitude, longitude) {
    let lat = Number(latitude);
    let lon = Number(longitude);
    if (!isFinite(lat) || !isFinite(lon)) return [0, 0];
    if (outOfChina(lat, lon)) return [lat, lon];
    const datum = current().datum;
    if (datum === 'gcj02') { const moved = wgs84ToGcj02(lat, lon); lat = moved[0]; lon = moved[1]; }
    else if (datum === 'bd09') { const moved = gcj02ToBd09.apply(null, wgs84ToGcj02(lat, lon)); lat = moved[0]; lon = moved[1]; }
    return [lat, lon];
  }

  // Outbound Amap URI links always need GCJ-02, regardless of the active basemap.
  function amapLatLng(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!isFinite(lat) || !isFinite(lon)) return [0, 0];
    return outOfChina(lat, lon) ? [lat, lon] : wgs84ToGcj02(lat, lon);
  }

  function focusPoint(point) {
    if (!point) return [0, 0];
    return focusLatLng(point.latitude, point.longitude);
  }

  function focusList(points) {
    return (points || []).map(focusPoint);
  }

  // Rebuilds the tile layer, keeping the caller's extra Leaflet options.
  function tileLayer(map, options) {
    const leaflet = window.L;
    if (!map || !leaflet) return null;
    const provider = current();
    // Direct browser→provider only where the provider's terms allow it, and
    // never for a mainland visitor, where the proxy is both faster and required.
    const url = (!inMainland() && provider.direct) || provider.tile;
    const layer = leaflet.tileLayer(url, Object.assign({ attribution: provider.attribution, maxZoom: provider.maxZoom }, options || {}));
    if (url !== provider.tile) {
      let swapped = false;
      layer.on('tileerror', () => {
        if (swapped) return;
        swapped = true;
        layer.setUrl(provider.tile);
      });
    }
    layer.addTo(map);
    return layer;
  }

  function attributionLabel() {
    const provider = current();
    return provider.label + ' · ' + provider.attribution.replace(/&copy;\s*/g, '');
  }

  function refresh() {
    let payload = null;
    try { payload = window.TravelMapProvidersPayload; } catch (_) { payload = null; }
    if (!payload) return Promise.resolve(false);
    try {
      configured = Array.isArray(payload.providers) ? payload.providers.map(spec => spec.id) : null;
      serverDefault = payload.default || null;
      remote = {};
      (payload.providers || []).forEach(spec => { remote[spec.id] = spec; });
      const next = pickDefault();
      const changed = next !== active;
      active = next;
      revision += 1;
      ready.splice(0).forEach(fn => { try { fn(current()); } catch (_) {} });
      return Promise.resolve(changed);
    } catch (_) { return Promise.resolve(false); }
  }

  window.TravelMapProviders = {
    providers: PROVIDERS,
    defaultProvider: inMainland() ? 'tianditu' : 'osm',
    // Synchronous, as it always was — every existing call site keeps working.
    get(id) {
      const provider = current();
      if (!id || id === provider.id) return provider;
      // An explicitly requested provider is honoured only when the backend can
      // serve it, so a stale ?provider= can never blank the map.
      if (PROVIDERS[id] && (!configured || configured.indexOf(id) !== -1)) {
        const spec = describe(id);
        return Object.assign({}, spec, { direct: (remote[id] || {}).direct || null, subdomains: (remote[id] || {}).subdomains || 'abc' });
      }
      return provider;
    },
    active() { return current().id; },
    datum() { return current().datum; },
    isLoaded() { return Boolean(configured); },
    revision() { return revision; },
    // Re-projects a WGS-84 coordinate (or list of them) into the active datum.
    focusLatLng,
    amapLatLng,
    focusPoint,
    focusList,
    tileLayer,
    attributionLabel,
    onReady(callback) {
      if (configured && typeof callback === 'function') { try { callback(current()); } catch (_) {} return; }
      if (typeof callback === 'function') ready.push(callback);
    },
    // Called by map-loader once /api/map/providers has answered.
    apply(payload) {
      window.TravelMapProvidersPayload = payload || null;
      return refresh();
    }
  };

  // Kick off the backend lookup immediately; the map renders regardless.
  if (location.protocol !== 'file:') {
    fetch('/api/map/providers', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(payload => { if (payload) window.TravelMapProviders.apply(payload); })
      .catch(() => {});
  }
}());
