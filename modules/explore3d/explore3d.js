// Explore 3D — the West Lake map controller.
//
// One scene, one camera: the globe, the flight and the lake are a single
// continuous world (see globe.js / rig.js / west-lake.js). This file owns
// everything the visitor touches: the floating place cards, the bottom sheet,
// the category chips, search, and the traveller layer.
//
// Social features are the existing ones: presence goes to /api/map/presence,
// avatars come from /api/map/online-users, and a tap opens the app's own
// profile + direct-message flow when it is available.

import * as THREE from '/modules/vendor/three/three.module.js';
import { createGlobe, geoToVec3, EARTH_RADIUS } from './globe.js';
import { ExploreCamera } from './rig.js';
import { createWestLake, WEST_LAKE } from './west-lake.js';

const CATALOG_URL = '/modules/data/global-landmark-guide-catalog.json';
const ONLINE_USERS_URL = '/api/map/online-users';
const WEATHER_URL = '/api/weather?latitude=30.243&longitude=120.145';

const $ = id => document.getElementById(id);

// A GLSL mistake does not throw: the material silently renders black, which is
// how a broken water shader shipped once. Record it so the test suite fails.
window.__shaderErrors = [];
const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  try {
    const text = args.map(String).join(' ');
    if (text.includes('Shader Error') || text.includes('Program Info Log')) {
      window.__shaderErrors.push(text.slice(0, 400));
    }
  } catch (_) { /* never let the guard break logging */ }
  originalConsoleError(...args);
};

/** Leave the frame when this page is embedded in the app shell. */
function topNavigate(url) {
  if (window.top !== window.self) {
    try {
      window.top.location.href = url;
      return;
    } catch (_) {
      /* cross-origin parent: fall through */
    }
  }
  window.location.href = url;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const RAD = Math.PI / 180;

// --- places shown on the map ----------------------------------------------
// Photo credits live in assets/explore3d/spots/spots.json.
const PLACES = [
  { id: 'leifeng-pagoda', name: '雷峰塔', en: 'Leifeng Pagoda', lat: 30.2317, lon: 120.1492, photo: 'leifeng-pagoda', cats: ['history', 'photo'], badge: '西湖十景', tags: ['历史建筑', '夜景绝美'], height: 58 },
  { id: 'broken-bridge', name: '断桥残雪', en: 'Broken Bridge', lat: 30.2592, lon: 120.1483, photo: 'broken-bridge', cats: ['history', 'nature'], badge: '西湖十景', tags: ['网红打卡', '四季皆美'], height: 10 },
  { id: 'three-pools', name: '三潭印月', en: 'Three Pools', lat: 30.2274, lon: 120.1431, photo: 'three-pools', cats: ['history', 'play'], badge: '西湖十景', tags: ['必游景点', '乘船体验'], height: 8 },
  { id: 'su-causeway', name: '苏堤春晓', en: 'Su Causeway', lat: 30.2405, lon: 120.1362, photo: 'su-causeway', cats: ['nature', 'outdoor'], badge: '西湖十景', tags: ['春季限定', '赏樱'], height: 8 },
  { id: 'quyuan-fenghe', name: '曲院风荷', en: 'Quyuan Garden', lat: 30.2540, lon: 120.1320, photo: 'quyuan-fenghe', cats: ['nature', 'outdoor'], badge: '西湖十景', tags: ['荷塘', '园林'], height: 8 },
  { id: 'hupanjui', name: '湖畔居', en: 'Lakeside Teahouse', lat: 30.2489, lon: 120.1575, photo: 'hupanjui', cats: ['food', 'stay'], badge: '茶与食', tags: ['临湖茶座', '杭帮菜'], height: 16 },
];

// Small category pins between the photo cards: the map reads as busy without
// paying for another photograph.
const PINS = [
  { id: 'louwailou', icon: '◍', tone: 'food', lat: 30.2551, lon: 120.1447, label: '楼外楼', height: 14 },
  { id: 'bowuguan', icon: '▣', tone: 'history', lat: 30.2528, lon: 120.1408, label: '浙江省博物馆', height: 14 },
  { id: 'gushan', icon: '▲', tone: 'outdoor', lat: 30.2557, lon: 120.1385, label: '孤山', height: 34 },
  { id: 'huagang', icon: '◍', tone: 'nature', lat: 30.2260, lon: 120.1360, label: '花港观鱼', height: 10 },
  { id: 'jingci', icon: '▣', tone: 'history', lat: 30.2300, lon: 120.1468, label: '净慈寺', height: 18 },
  { id: 'liulang', icon: '◍', tone: 'nature', lat: 30.2350, lon: 120.1560, label: '柳浪闻莺', height: 10 },
  { id: 'baochu', icon: '▲', tone: 'outdoor', lat: 30.2601, lon: 120.1442, label: '保俶塔', height: 46 },
  { id: 'huaxing', icon: '⌂', tone: 'stay', lat: 30.2465, lon: 120.1620, label: '湖滨住宿', height: 20 },
];

const PHOTO_BASE = '/assets/explore3d/spots';

// Sheet content: the four postcards the map leads with, then the supporting
// places. Distances are computed live from the camera.
const SHEET_TABS = {
  recommend: ['leifeng-pagoda', 'broken-bridge', 'three-pools', 'su-causeway', 'quyuan-fenghe', 'hupanjui'],
  nearby: ['leifeng-pagoda', 'three-pools', 'hupanjui', 'broken-bridge'],
  dest: ['three-pools', 'su-causeway', 'quyuan-fenghe'],
  food: ['hupanjui'],
  play: ['three-pools', 'leifeng-pagoda'],
  stay: ['hupanjui'],
  photo: ['leifeng-pagoda', 'broken-bridge', 'su-causeway'],
  route: ['leifeng-pagoda', 'su-causeway', 'broken-bridge'],
};

const state = {
  tier: matchMedia('(pointer:coarse)').matches || (navigator.deviceMemory || 4) <= 4 ? 'medium' : 'high',
  category: 'all',
  sheetTab: 'recommend',
  catalog: [],
  onlineUsers: [],
  sharing: false,
  demotions: 0,
  frames: 0,
  fps: 60,
  lastSample: performance.now(),
};

// --- renderer --------------------------------------------------------------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({
  canvas: $('scene'),
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setClearColor(0xdfeae6, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.tier === 'high' ? 2 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = state.tier !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.02, 400000);

// Morning light over the lake. The globe shares the azimuth so the two views
// agree about where the sun is.
const sunDirection = geoToVec3(24, 86, 1).normalize();

performance.mark('explore:boot');
const globe = createGlobe({ renderer, sunDirection });
performance.mark('explore:globe');
scene.add(globe.group, globe.stars);

const lake = createWestLake({ renderer, sunDirection, quality: state.tier });
performance.mark('explore:lake');
lake.group.visible = false;
scene.add(lake.group);

// Two fog regimes: a wide one for the globe, a short one for the lake. Without
// the short one the plate has no aerial perspective and every roof is equally
// crisp no matter how far away it is.
const fog = new THREE.Fog(0xdfeef2, 1e7, 2e7);
scene.fog = fog;

const LAKE_FOG = { color: 0xd9e6e0, near: 0.55, far: 11 };
const SPACE_FOG = { color: 0xdfeef2, near: 1e7, far: 2e7 };
function updateFog(altitude) {
  const target = altitude < 400 ? LAKE_FOG : SPACE_FOG;
  if (fog.near === target.near) return;
  fog.near = target.near;
  fog.far = target.far;
  fog.color.setHex(target.color);
}

const rig = new ExploreCamera(camera, stage);

// --- DOM -------------------------------------------------------------------
const poiLayer = $('poiLayer');
const pinLayer = $('pinLayer');
const socialLayer = $('socialLayer');
const poiPool = [];
const pinPool = [];
const socialPool = [];

function geoDistanceKm(a, b) {
  const dLat = (b.lat - a.lat) * 111;
  const dLon = (b.lon - a.lon) * 111 * Math.cos(((a.lat + b.lat) / 2) * RAD);
  return Math.hypot(dLat, dLon);
}

function formatDistance(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

// --- place cards over the 3D scene -----------------------------------------

function makePoiNode() {
  const wrap = document.createElement('div');
  wrap.className = 'poi';
  wrap.hidden = true;
  const anchor = document.createElement('button');
  anchor.type = 'button';
  anchor.className = 'poi__anchor';
  anchor.innerHTML = `
    <span class="poi__card">
      <img class="poi__thumb" alt="" loading="lazy">
      <span class="poi__text"><span class="poi__name"></span><span class="poi__meta"></span></span>
      <svg class="ic poi__chevron" aria-hidden="true"><use href="#i-chevron"/></svg>
    </span>
    <span class="poi__pin"></span>`;
  wrap.append(anchor);
  poiLayer.append(wrap);
  return {
    wrap,
    anchor,
    thumb: anchor.querySelector('.poi__thumb'),
    name: anchor.querySelector('.poi__name'),
    meta: anchor.querySelector('.poi__meta'),
    key: null,
  };
}

function getPoiNode(index) {
  while (poiPool.length <= index) poiPool.push(makePoiNode());
  return poiPool[index];
}

function project(world) {
  const v = world.clone().project(camera);
  if (v.z < -1 || v.z > 1) return null;
  return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
}

function facingCamera(world) {
  if (rig.altitude < EARTH_RADIUS * 0.05) return true;
  return world.clone().normalize().dot(camera.position.clone().normalize()) > 0.12;
}

function updatePoiLayer() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const onLake = rig.altitude < 40;
  const list = onLake ? PLACES.filter(place => state.category === 'all' || place.cats.includes(state.category)) : [];

  let used = 0;
  const minGap = 48;
  const placed = [];

  for (const place of list) {
    const world = lake.poseAt(place.lat, place.lon, place.height);
    if (!facingCamera(world)) continue;
    const point = project(world);
    if (!point) continue;
    if (point.x < 84 || point.x > width - 84 || point.y < 196 || point.y > height - 292) continue;
    // the hero destination card occupies the top-left corner; a place card
    // underneath it is unreadable and unclickable
    if (point.y < 300 && point.x < 336) continue;
    if (point.x < 310 && point.y < 248) continue;
    if (placed.some(other => Math.hypot(other.x - point.x, other.y - point.y) < minGap)) continue;
    placed.push(point);

    const slot = getPoiNode(used);
    used += 1;
    slot.wrap.hidden = false;
    const clampedX = clamp(point.x, 92, width - 92);
    slot.wrap.style.transform = `translate3d(${clampedX}px, ${point.y}px, 0)`;
    const distance = geoDistanceKm({ lat: rig.lat, lon: rig.lon }, place);
    const scale = clamp(1.06 - distance / 14, 0.82, 1.04);
    slot.anchor.style.transform = `translate(-50%, -2px) scale(${scale.toFixed(3)})`;
    if (slot.key !== place.id) {
      slot.key = place.id;
      slot.thumb.src = `${PHOTO_BASE}/${place.photo}.jpg`;
      slot.thumb.alt = place.name;
      slot.name.textContent = place.name;
      slot.anchor.onclick = () => focusPlace(place);
    }
    slot.meta.textContent = formatDistance(distance);
    slot.wrap.classList.toggle('poi--hero', place.id === 'leifeng-pagoda');
  }

  for (let i = used; i < poiPool.length; i += 1) poiPool[i].wrap.hidden = true;
}

const TONE_ICON = { food: 'i-food', history: 'i-history', nature: 'i-nature', outdoor: 'i-outdoor', stay: 'i-stay' };

function makePinNode() {
  const node = document.createElement('div');
  node.className = 'mpin';
  node.hidden = true;
  node.innerHTML = '<span class="mpin__icon"></span>';
  pinLayer.append(node);
  return { node, icon: node.querySelector('.mpin__icon'), key: null };
}

function getPinNode(index) {
  while (pinPool.length <= index) pinPool.push(makePinNode());
  return pinPool[index];
}

function updatePinLayer() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  let used = 0;
  const placed = [];
  if (rig.altitude >= 40) {
    for (let i = 0; i < pinPool.length; i += 1) pinPool[i].node.hidden = true;
    return;
  }
  for (const pin of PINS) {
    const world = lake.poseAt(pin.lat, pin.lon, pin.height);
    const point = project(world);
    if (!point) continue;
    if (point.x < 30 || point.x > width - 30 || point.y < 210 || point.y > height - 290) continue;
    if (placed.some(other => Math.hypot(other.x - point.x, other.y - point.y) < 44)) continue;
    placed.push(point);
    const slot = getPinNode(used);
    used += 1;
    slot.node.hidden = false;
    slot.node.dataset.tone = pin.tone;
    slot.node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    if (slot.key !== pin.id) {
      slot.key = pin.id;
      slot.icon.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#${TONE_ICON[pin.tone] || 'i-nature'}"/></svg>`;
      slot.node.title = pin.label;
    }
  }
  for (let i = used; i < pinPool.length; i += 1) pinPool[i].node.hidden = true;
}

// --- travellers ------------------------------------------------------------

function makeSocialNode() {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'traveler';
  node.hidden = true;
  node.innerHTML = '<span class="traveler__avatar"></span><span class="traveler__name"></span>';
  socialLayer.append(node);
  return { node, avatar: node.querySelector('.traveler__avatar'), name: node.querySelector('.traveler__name') };
}

function getSocialNode(index) {
  while (socialPool.length <= index) socialPool.push(makeSocialNode());
  return socialPool[index];
}

let socialLastFetch = 0;
let socialLoading = false;

async function loadOnlineUsers(force = false) {
  if (socialLoading) return;
  if (!force && Date.now() - socialLastFetch < 40000) return;
  socialLoading = true;
  try {
    const response = await fetch(ONLINE_USERS_URL, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json();
    state.onlineUsers = Array.isArray(payload.users) ? payload.users : [];
    socialLastFetch = Date.now();
    if (state.onlineUsers.length) setStatus(`有 ${state.onlineUsers.length} 位旅友正在共享位置`);
  } catch (_) {
    /* offline is fine: the map works without the traveller layer */
  } finally {
    socialLoading = false;
  }
}

function updateSocialLayer() {
  let used = 0;
  const placed = [];
  for (const entry of state.onlineUsers) {
    if (!Number.isFinite(entry.latitude) || !Number.isFinite(entry.longitude)) continue;
    const nearLake = geoDistanceKm({ lat: WEST_LAKE.lat, lon: WEST_LAKE.lon }, { lat: entry.latitude, lon: entry.longitude }) < 40;
    if (rig.altitude < 40 && !nearLake) continue;
    const world = nearLake && rig.altitude < 300
      ? lake.poseAt(entry.latitude, entry.longitude, 3)
      : geoToVec3(entry.latitude, entry.longitude, EARTH_RADIUS * 1.01);
    if (!facingCamera(world)) continue;
    const point = project(world);
    if (!point) continue;
    if (point.x < 30 || point.x > window.innerWidth - 30) continue;
    if (placed.some(other => Math.hypot(other.x - point.x, other.y - point.y) < 52)) continue;
    placed.push(point);

    const profile = entry.profiles || {};
    const slot = getSocialNode(used);
    used += 1;
    const name = profile.display_name || profile.username || '旅行者';
    slot.node.hidden = false;
    slot.node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    slot.name.textContent = name;
    if (profile.avatar_url) {
      slot.avatar.style.backgroundImage = `url("${String(profile.avatar_url).replace(/"/g, '')}")`;
      slot.avatar.textContent = '';
    } else {
      slot.avatar.style.backgroundImage = 'none';
      slot.avatar.textContent = name.slice(0, 1);
    }
    slot.node.onclick = () => openTraveler(String(profile.id || entry.user_id || ''));
  }
  for (let i = used; i < socialPool.length; i += 1) socialPool[i].node.hidden = true;
}

async function openTraveler(userId) {
  if (!userId) return;
  if (typeof window.openTravelUser === 'function') {
    try {
      await window.openTravelUser(userId);
      return;
    } catch (_) {
      /* fall through to the local sheet */
    }
  }
  const sheet = $('travelerSheet');
  const body = $('travelerSheetBody');
  sheet.classList.add('is-visible');
  body.innerHTML = '<p class="traveler-sheet__loading">正在读取旅友资料…</p>';
  try {
    const response = await fetch(`/api/community/users/${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json();
    const profile = payload.profile || {};
    const stats = payload.stats || {};
    const name = profile.display_name || profile.username || '旅行者';
    body.innerHTML = `
      <div class="traveler-sheet__hero">
        <span class="traveler-sheet__avatar"${profile.avatar_url ? ` style="background-image:url('${String(profile.avatar_url).replace(/'/g, '')}')"` : ''}>${profile.avatar_url ? '' : escapeHtml(name.slice(0, 1))}</span>
        <div><h2>${escapeHtml(name)}</h2><p>${escapeHtml(profile.bio || '这位旅行者还没有填写简介。')}</p></div>
      </div>
      <dl class="traveler-sheet__stats">
        <div><b>${Number(stats.posts || 0)}</b><small>发布</small></div>
        <div><b>${Number(stats.routes || 0)}</b><small>路线</small></div>
        <div><b>${Number(stats.followers || 0)}</b><small>粉丝</small></div>
      </dl>
      <div class="traveler-sheet__actions">
        <button type="button" id="travelerFollow" class="ghost">${payload.isFollowing ? '已关注' : '关注'}</button>
        <a class="primary" href="/index.html?screen=messages">去 App 里私聊</a>
      </div>`;
    $('travelerFollow').onclick = async () => {
      const auth = window.TravelWorldAuth;
      if (!auth?.session?.()) return toast('登录后才能关注');
      try {
        const result = await auth.request(`/api/community/users/${encodeURIComponent(userId)}/follow`, { method: 'POST' });
        $('travelerFollow').textContent = result.following ? '已关注' : '关注';
      } catch (_) {
        toast('关注没有成功');
      }
    };
  } catch (_) {
    body.innerHTML = '<p class="traveler-sheet__loading">这位旅友的资料暂时打不开。</p>';
  }
}

// --- camera actions --------------------------------------------------------

function focusPlace(place) {
  // Use the scene's own record when there is one: a landmark that had to be
  // moved onto dry ground is no longer at its map pin's coordinates.
  const spot = lake.spots.find(entry => entry.id === place.id);
  const targetLat = spot ? spot.lat : place.lat;
  const targetLon = spot ? spot.lon : place.lon;

  // Frame the landmark rather than standing on it. The camera is pulled back
  // along the view direction so the building sits above the bottom sheet, and
  // its height comes from the building instead of one fixed altitude.
  // Stand due south of the landmark and look north at it: the heading no longer
  // depends on guessing which way the scene's north points.
  const heading = 0;
  const tilt = 58 * RAD;
  const height = spot && spot.height ? spot.height : (place.height || 20);
  const cameraAltitude = Math.min(0.5, Math.max(0.18, height * 0.0038));
  const backOff = (cameraAltitude * 0.9) / Math.tan(tilt) * 0.85; // km
  const metresPerDegLat = 110574;
  const metresPerDegLon = 111320 * Math.cos((targetLat * Math.PI) / 180);
  const camLat = targetLat - (backOff * 1000) / metresPerDegLat;
  const camLon = targetLon;

  rig.flyTo(
    { lat: camLat, lon: camLon, altitude: cameraAltitude, heading, tilt },
    {
      duration: 2600,
            onArrive: () => {
        rig.setMode('local');
        document.body.dataset.mode = 'local';
        // the chrome would otherwise sit on top of whatever we frame
        document.body.dataset.focus = 'place';
        showPlaceCard({
          title: place.name,
          meta: place.en + ' · 杭州西湖',
          body: place.badge + ' · ' + place.tags.join(' · ') + '。拖动环绕，滚轮或双指缩放。',
          action: { label: '回到全球', handler: flyToGlobe },
        });
      },
    }
  );
  document.body.dataset.mode = 'flying';
}

function flyToLake() {
  lake.group.visible = true;
  rig.flyTo(
    {
      lat: WEST_LAKE.arrival.lat,
      lon: WEST_LAKE.arrival.lon,
      altitude: WEST_LAKE.arrival.altitude,
      heading: WEST_LAKE.arrival.heading * RAD,
      tilt: WEST_LAKE.arrival.tilt * RAD,
    },
    {
      duration: 4800,
      arc: 0.12,
      onArrive: () => {
        rig.setMode('local');
        document.body.dataset.mode = 'local';
        setStatus('拖动旋转视角，滚轮或双指缩放');
      },
    }
  );
  document.body.dataset.mode = 'flying';
}

function globeFitAltitude() {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const half = Math.min(vHalf, hHalf) * 0.94;
  return EARTH_RADIUS / Math.sin(half) - EARTH_RADIUS;
}

function clearFocus() {
  delete document.body.dataset.focus;
}

function flyToGlobe() {
  clearFocus();
  rig.setMode('flying');
  document.body.dataset.mode = 'flying';
  rig.flyTo(
    { lat: 33, lon: 112, altitude: globeFitAltitude(), heading: 0, tilt: 0 },
    {
      duration: 3600,
      arc: 0.1,
      onArrive: () => {
        rig.setMode('globe');
        document.body.dataset.mode = 'globe';
        lake.group.visible = false;
        setStatus('地球 · 点选右侧全景回到西湖');
      },
    }
  );
}

function resetView() {
  if (rig.altitude < 200) {
    rig.cancelFlight();
    flyToLake();
  } else {
    flyToGlobe();
  }
}

// --- bottom sheet ----------------------------------------------------------

let sheetExpanded = false;

function setSheetExpanded(next) {
  sheetExpanded = next;
  $('sheet').classList.toggle('is-expanded', next);
}

function renderSheet() {
  const ids = SHEET_TABS[state.sheetTab] || SHEET_TABS.recommend;
  const container = $('sheetCards');
  container.innerHTML = '';
  for (const id of ids) {
    const place = PLACES.find(item => item.id === id);
    if (!place) continue;
    const distance = formatDistance(geoDistanceKm({ lat: rig.lat, lon: rig.lon }, place));
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'place-card';
    card.innerHTML = `
      <span class="place-card__media">
        <img src="${PHOTO_BASE}/${place.photo}.jpg" alt="${escapeHtml(place.name)}" loading="lazy">
        <span class="place-card__badge">${escapeHtml(place.badge)}</span>
        <span class="place-card__fave"><svg class="ic" aria-hidden="true"><use href="#i-heart"/></svg></span>
      </span>
      <span class="place-card__meta"><svg class="ic place-card__star" aria-hidden="true"><use href="#i-star"/></svg><b>${escapeHtml(place.badge)}</b>${distance}</span>
      <span class="place-card__title">${escapeHtml(place.name)}</span>
      <span class="place-card__tags">${place.tags.map(tag => `<span class="place-card__tag">${escapeHtml(tag)}</span>`).join('')}</span>`;
    card.onclick = () => {
      if (rig.altitude > 40) flyToLake();
      setTimeout(() => focusPlace(place), rig.altitude > 40 ? 3600 : 0);
    };
    container.append(card);
  }
}

// --- chips / tabs ----------------------------------------------------------

function setCategory(category) {
  state.category = category;
  document.querySelectorAll('.chip').forEach(chip => {
    const active = chip.dataset.cat === category;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-selected', String(active));
  });
}

function setSheetTab(tab) {
  state.sheetTab = tab;
  document.querySelectorAll('.sheet__tab').forEach(node => node.classList.toggle('is-active', node.dataset.tab === tab));
  renderSheet();
}

// --- search ----------------------------------------------------------------

function scoreMatch(place, query) {
  const haystack = [place.name, place.en, '西湖', '杭州', place.badge, ...(place.tags || [])].join(' ').toLowerCase();
  if (place.name.toLowerCase().startsWith(query)) return 120;
  if (place.en.toLowerCase().startsWith(query)) return 110;
  if (haystack.includes(query)) return 60;
  return 0;
}

function runSearch(raw) {
  const query = String(raw || '').trim().toLowerCase();
  const list = $('searchResults');
  if (!query) {
    list.hidden = true;
    return;
  }
  const results = PLACES.map(place => ({ place, score: scoreMatch(place, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!results.length && ('杭州'.includes(query) || '西湖'.includes(query) || 'hangzhou'.includes(query))) {
    results.push({ place: PLACES[0], score: 1 });
  }

  list.hidden = false;
  list.innerHTML = '';
  if (!results.length) {
    list.innerHTML = '<p class="search-empty">没有找到匹配的地点</p>';
    return;
  }
  for (const { place } of results.slice(0, 6)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    button.innerHTML = `<b>${escapeHtml(place.name)}</b><small>${escapeHtml(place.en)} · 西湖</small>`;
    button.onclick = () => {
      list.hidden = true;
      $('searchInput').blur();
      if (rig.altitude > 40) flyToLake();
      setTimeout(() => focusPlace(place), rig.altitude > 40 ? 3600 : 0);
    };
    list.append(button);
  }
}

// --- status / toast --------------------------------------------------------

let statusTimer = 0;
function setStatus(text) {
  const el = $('status');
  el.textContent = text;
  el.classList.add('is-visible');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.remove('is-visible'), 4200);
}

function showPlaceCard({ title, meta, body, action }) {
  const card = $('placeCard');
  if (!card) return;
  $('placeCardTitle').textContent = title || '';
  $('placeCardMeta').textContent = meta || '';
  $('placeCardBody').textContent = body || '';
  const button = $('placeCardAction');
  if (action) {
    button.hidden = false;
    button.textContent = action.label;
    button.onclick = action.handler;
  } else {
    button.hidden = true;
    button.onclick = null;
  }
  card.classList.add('is-visible');
}

function hidePlaceCard() {
  $('placeCard')?.classList.remove('is-visible');
  clearFocus();
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

// --- weather ---------------------------------------------------------------

async function loadWeather() {
  const chip = $('weatherChip');
  try {
    const response = await fetch(WEATHER_URL, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json();
    const temperature = Number(payload?.current?.temperature_2m);
    if (Number.isFinite(temperature)) chip.innerHTML = `<i class="weather__dot"></i>${Math.round(temperature)}°C`;
  } catch (_) {
    chip.innerHTML = '<i class="weather__dot"></i>西湖 · 实时';
  }
}

// --- location sharing ------------------------------------------------------

async function toggleLocationSharing() {
  const auth = window.TravelWorldAuth;
  if (!auth?.session?.()) return toast('登录后即可共享位置');
  if (state.sharing) {
    try {
      await auth.request('/api/map/presence', { method: 'DELETE' });
      state.sharing = false;
      toast('已关闭位置共享');
      loadOnlineUsers(true);
    } catch (_) {
      toast('关闭共享时网络没有响应');
    }
    return;
  }
  if (!navigator.geolocation) return toast('当前设备不支持定位');
  navigator.geolocation.getCurrentPosition(
    async position => {
      try {
        await auth.request('/api/map/presence', {
          method: 'POST',
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            sharing_enabled: true,
            city: '',
            country: '',
          }),
        });
        state.sharing = true;
        toast('已开始共享位置 · 仅显示最近 5 分钟');
        loadOnlineUsers(true);
      } catch (_) {
        toast('共享位置没有成功');
      }
    },
    () => toast('没有拿到定位权限'),
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
  );
}

// --- render loop -----------------------------------------------------------

const clock = new THREE.Clock();
let elapsed = 0;
let lastInteraction = performance.now();
let idlePhase = 0;
let idleBase = null;

function qualityGovernor() {
  state.frames += 1;
  const now = performance.now();
  if (now - state.lastSample < 1200) return;
  state.fps = (state.frames * 1000) / (now - state.lastSample);
  state.frames = 0;
  state.lastSample = now;

  if (state.fps < 41 && state.demotions < 2) {
    state.demotions += 1;
    if (state.demotions === 1) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
      // two full-width backdrop blurs are the first thing to give up
      document.body.classList.add('is-low');
    }
    else {
      renderer.shadowMap.enabled = false;
      scene.traverse(node => {
        if (node.material) node.material.needsUpdate = true;
      });
    }
  }
}

let hiddenWarmFrames = 0;

function frame() {
  const screen = document.body.dataset.screen;
  if (screen && screen !== 'map') {
    // Another tab is showing: keep the loop alive but do no work — except for
    // a few frames right after boot, which compile the shader programs. Paying
    // that while hidden keeps the first reveal free.
    clock.getDelta();
    if (hiddenWarmFrames < 3 && window.__explore3dReady) {
      hiddenWarmFrames += 1;
      if (hiddenWarmFrames === 1) renderer.compile(scene, camera);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
    return;
  }
  hiddenWarmFrames = 0;
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  // A living map: when nobody has touched anything for a while the camera
  // drifts a couple of degrees, the way a slow camera move keeps a still scene
  // breathing.
  if (!rig.flying && rig.tilt > 0.9 && performance.now() - lastInteraction > 6500) {
    if (idleBase === null) idleBase = rig.heading;
    idlePhase += dt * 0.05;
    rig.heading = idleBase + Math.sin(idlePhase) * 0.032;
    rig.apply();
  } else if (idleBase !== null && performance.now() - lastInteraction <= 6500) {
    idleBase = null;
  }

  updateFog(rig.altitude);
  rig.updateParallax(dt);
  rig.update(dt);
  if (rig.flying) rig.apply();
  else rig.apply();

  const nearGround = rig.altitude < 340;
  fog.near = nearGround ? clamp(rig.altitude * 7, 4, 9000) : 1e7;
  fog.far = nearGround ? fog.near + clamp(rig.altitude * 30, 30, 52000) : 2e7;
  globe.atmosphere.visible = rig.altitude > 90;
  globe.stars.visible = rig.altitude > 260;

  if (rig.altitude < 300 && !lake.group.visible) lake.group.visible = true;
  if (lake.group.visible) lake.update(dt, elapsed, camera);
  globe.update(dt, camera, camera.far);

  updatePoiLayer();
  updatePinLayer();
  updateSocialLayer();

  renderer.render(scene, camera);
  qualityGovernor();
  requestAnimationFrame(frame);
}

// --- wiring ----------------------------------------------------------------

function markInteraction() {
  lastInteraction = performance.now();
  idleBase = null;
}

stage.addEventListener('pointerdown', markInteraction, { capture: true });

// --- touch the scene ------------------------------------------------------
// Moving the pointer turns the camera by a degree or two; tapping the water
// drops a ripple; tapping a boat nudges it. This is the "it reacts to me" part.
{
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = null;
  let dragged = false;

  const updatePointer = event => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    // The scene answers the pointer: a slow, small head-turn.
    rig.parallax.targetX = -pointer.x * 0.035;
    rig.parallax.targetY = pointer.y * 0.02;
  };

  stage.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') updatePointer(event);
  });
  stage.addEventListener('pointerleave', () => {
    rig.parallax.targetX = 0;
    rig.parallax.targetY = 0;
  });

  stage.addEventListener('pointerdown', event => {
    downAt = { x: event.clientX, y: event.clientY };
    dragged = false;
  });
  stage.addEventListener('pointermove', event => {
    if (!downAt) return;
    if (Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 8) dragged = true;
  });
  stage.addEventListener('pointerup', event => {
    if (!downAt) return;
    const wasDrag = dragged;
    downAt = null;
    if (wasDrag || !lake.group.visible) return;
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(lake.water, false);
    if (hits.length) {
      lake.spawnRipple(hits[0].point);
      setStatus('湖面被轻轻点了一下');
    }
  });
}

stage.addEventListener('wheel', markInteraction, { passive: true, capture: true });

$('searchInput').addEventListener('input', event => runSearch(event.target.value));
$('searchInput').addEventListener('focus', event => runSearch(event.target.value));
document.addEventListener('click', event => {
  if (!event.target.closest('.searchbar') && !event.target.closest('#searchResults')) $('searchResults').hidden = true;
});

$('chips').addEventListener('click', event => {
  const chip = event.target.closest('.chip');
  if (chip) setCategory(chip.dataset.cat);
});

$('sheetTabs').addEventListener('click', event => {
  const tab = event.target.closest('.sheet__tab');
  if (tab) setSheetTab(tab.dataset.tab);
});

$('sheetHandle').addEventListener('click', () => setSheetExpanded(!sheetExpanded));
{
  let dragStart = null;
  const handle = $('sheetHandle');
  handle.addEventListener('pointerdown', event => {
    dragStart = { y: event.clientY };
    handle.setPointerCapture?.(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!dragStart) return;
    const dy = event.clientY - dragStart.y;
    if (Math.abs(dy) < 16) return;
    setSheetExpanded(dy < 0);
    dragStart = null;
  });
  handle.addEventListener('pointerup', () => {
    dragStart = null;
  });
}

$('zoomIn').addEventListener('click', () => {
  markInteraction();
  rig.zoom(0.62);
});
$('zoomOut').addEventListener('click', () => {
  markInteraction();
  rig.zoom(1.6);
});
// the 全景 control already restores the opening framing, so this optional
$('resetView')?.addEventListener('click', () => {
  markInteraction();
  resetView();
});
$('overviewBtn').addEventListener('click', () => {
  markInteraction();
  flyToGlobe();
});
$('mapModeToggle').addEventListener('click', () => {
  markInteraction();
  flyToGlobe();
});
$('compassBtn').addEventListener('click', () => {
  markInteraction();
  rig.heading = 0;
  rig.apply();
  toast('已转向正北');
});
$('locateBtn').addEventListener('click', () => {
  markInteraction();
  toggleLocationSharing();
});
$('layerBtn').addEventListener('click', () => {
  markInteraction();
  const next = document.body.dataset.time === 'dusk' ? 'day' : 'dusk';
  document.body.dataset.time = next;
  lake.setTimeOfDay?.(next);
  toast(next === 'dusk' ? '暮色 · 夕照雷峰' : '日景 · 湖光潋滟');
});
$('heroCard').addEventListener('click', () => {
  markInteraction();
  if (rig.altitude > 40) flyToLake();
  else focusPlace(PLACES[0]);
});
$('filterBtn').addEventListener('click', () => {
  setSheetTab('recommend');
  setSheetExpanded(true);
  toast('已展开筛选面板');
});
$('navExplore')?.addEventListener('click', () => {
  markInteraction();
  flyToLake();
});
$('navPublish')?.addEventListener('click', () => {
  topNavigate('/explore3d.html?screen=publish');
});
$('placeCardClose').addEventListener('click', hidePlaceCard);
$('travelerSheetClose').addEventListener('click', () => $('travelerSheet').classList.remove('is-visible'));
$('travelerSheet').addEventListener('click', event => {
  if (event.target === $('travelerSheet')) $('travelerSheet').classList.remove('is-visible');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- boot ------------------------------------------------------------------

async function boot() {
  await Promise.all([
    globe.ready,
    fetch(CATALOG_URL)
      .then(response => (response.ok ? response.json() : { places: [] }))
      .then(payload => {
        state.catalog = payload.places || [];
      })
      .catch(() => {}),
  ]);

  // Open on the shot the product is meant to be seen in: over the lake.
  rig.lat = WEST_LAKE.arrival.lat;
  rig.lon = WEST_LAKE.arrival.lon;
  rig.altitude = WEST_LAKE.arrival.altitude;
  rig.tilt = WEST_LAKE.arrival.tilt * RAD;
  rig.heading = WEST_LAKE.arrival.heading * RAD;
  rig.mode = 'local';
  rig.apply();
  lake.group.visible = true;
  document.body.dataset.mode = 'local';
  document.body.dataset.time = 'day';

  $('loading').classList.remove('is-visible');
  renderSheet();
  loadWeather();
  loadOnlineUsers(true);
  performance.mark('explore:ready');
  performance.measure('boot', 'explore:boot', 'explore:globe');
  performance.measure('lake', 'explore:globe', 'explore:lake');
  performance.measure('first-frame', 'explore:lake', 'explore:ready');
  window.__explore3dReady = true;
  setStatus('拖动旋转视角，滚轮或双指缩放');
  requestAnimationFrame(frame);
}

boot().catch(error => {
  $('loadingNote').textContent = `场景没有启动：${error.message}`;
  $('loading').classList.add('is-visible');
  console.error(error);
});

// Handle for the headless captures and for embedding this scene in the app.
window.__explore3d = {
  rig,
  lake,
  scene,
  renderer,
  camera,
  flyToLake,
  flyToGlobe,
  focusPlace,
  places: PLACES,
  get mode() {
    return document.body.dataset.mode;
  },
};
