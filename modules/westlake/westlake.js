// West Lake — a living plate.
//
// The design comp is the artwork: one photograph-quality frame of the lake.
// Everything that moves is painted on top of it in a canvas, clipped to the
// water by a mask derived from the plate itself:
//
//   * flowing water   two drifting caustic layers, soft-light blended
//   * boats           painted hulls with wakes, following closed paths
//   * ripples         expand from wherever the visitor taps the water
//
// The DOM overlay then puts real, working controls on the exact pixels where
// the artwork drew them, so taps, tabs, chips and the search all behave like
// the app they are pretending to be.

const PLATE = { width: 1400, height: 2131 };
const CROP = { x: 16, y: 12, scale: 1400 / 992 };

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Design-comp pixel → percentage of the plate. Lets hotspots be written in
 *  the same numbers that were measured off the comp. */
const px = x => ((x - CROP.x) * CROP.scale) / PLATE.width * 100;
const py = y => ((y - CROP.y) * CROP.scale) / PLATE.height * 100;
const pw = w => (w * CROP.scale) / PLATE.width * 100;
const ph = h => (h * CROP.scale) / PLATE.height * 100;

// --- places ---------------------------------------------------------------
const PLACES = {
  'leifeng-pagoda': {
    name: '雷峰塔', en: 'Leifeng Pagoda', photo: 'leifeng-pagoda',
    body: '西湖南岸夕照山上。旧塔遗址原地保护，新塔 2002 年落成，登塔可俯瞰全湖。',
    facts: [['西湖十景', '雷峰夕照'], ['建议', '傍晚登塔看落日'], ['周边', '净慈寺 · 长桥公园']],
    card: { x: 725, y: 740, w: 160, h: 52 },
  },
  'broken-bridge': {
    name: '断桥残雪', en: 'Broken Bridge', photo: 'broken-bridge',
    body: '白堤东端，雪后桥面积雪先融，远看似断非断。白蛇传的故事让它成了西湖最出名的一座桥。',
    facts: [['西湖十景', '断桥残雪'], ['建议', '清晨人少，沿白堤步行'], ['周边', '白堤 · 平湖秋月']],
    card: { x: 490, y: 378, w: 200, h: 52 },
  },
  'three-pools': {
    name: '三潭印月', en: 'Three Pools', photo: 'three-pools',
    body: '湖心小瀛洲与三座石塔。塔身五个圆孔，月夜点灯，湖面会浮起许多个月亮。',
    facts: [['西湖十景', '三潭印月'], ['建议', '需乘船登岛'], ['周边', '花港观鱼 · 湖心亭']],
    card: { x: 410, y: 615, w: 200, h: 52 },
  },
  'su-causeway': {
    name: '苏堤春晓', en: 'Su Causeway', photo: 'su-causeway',
    body: '南北纵贯西湖的长堤，六桥烟柳。春天桃红柳绿，是西湖十景之首。',
    facts: [['西湖十景', '苏堤春晓'], ['建议', '春天赏桃花'], ['周边', '花港观鱼 · 曲院风荷']],
    card: { x: 185, y: 552, w: 205, h: 52 },
  },
  'beishan-street': {
    name: '北山街', en: 'Beishan Street', photo: 'hupanjui',
    body: '西湖北岸的一条路，一侧是湖，一侧是民国老别墅与梧桐。秋天最好看。',
    facts: [['类型', '历史街区'], ['建议', '傍晚散步'], ['周边', '宝石山 · 保俶塔']],
    card: { x: 690, y: 458, w: 150, h: 52 },
  },
  'huagang': {
    name: '花港观鱼', en: 'Huagang', photo: 'quyuan-fenghe',
    body: '苏堤南端的大公园，红鱼池里养着成群锦鲤，春天有牡丹和樱花。',
    facts: [['西湖十景', '花港观鱼'], ['建议', '带孩子看锦鲤'], ['周边', '苏堤 · 雷峰塔']],
    card: { x: 128, y: 788, w: 200, h: 52 },
  },
};

const PHOTO_BASE = '/assets/explore3d/spots';

const SHEET = {
  recommend: ['leifeng-pagoda', 'broken-bridge', 'three-pools', 'su-causeway'],
  nearby: ['leifeng-pagoda', 'three-pools', 'huagang', 'beishan-street'],
  dest: ['three-pools', 'su-causeway', 'beishan-street'],
  food: ['beishan-street', 'huagang'],
  play: ['three-pools', 'leifeng-pagoda'],
  stay: ['beishan-street'],
  photo: ['leifeng-pagoda', 'broken-bridge', 'su-causeway'],
  route: ['leifeng-pagoda', 'su-causeway', 'broken-bridge'],
};

const state = { tab: 'recommend', category: 'all', selected: null };

// --- the canvas ------------------------------------------------------------
const canvas = $('fx');
const ctx = canvas.getContext('2d', { alpha: true });
let maskImage = null;
let sceneScale = 1;

/** Paints on a plate-sized offscreen buffer, then composites through the mask. */
const waterLayer = document.createElement('canvas');
waterLayer.width = PLATE.width;
waterLayer.height = PLATE.height;
const waterCtx = waterLayer.getContext('2d');

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(PLATE.width * dpr);
  canvas.height = Math.round(PLATE.height * dpr);
  sceneScale = canvas.width / PLATE.width;
  ctx.setTransform(sceneScale, 0, 0, sceneScale, 0, 0);
  void rect;
}

// --- boats ----------------------------------------------------------------
// Positions and sizes are in plate pixels; the lake occupies the middle band,
// so these paths all sit well inside the mask.
const BOATS = [
  { cx: 330, cy: 560, rx: 90, rz: 44, phase: 0.2, speed: 0.045, size: 30 },
  { cx: 520, cy: 500, rx: 120, rz: 36, phase: 1.9, speed: 0.033, size: 26 },
  { cx: 640, cy: 620, rx: 96, rz: 52, phase: 3.4, speed: 0.028, size: 34 },
  { cx: 300, cy: 700, rx: 70, rz: 40, phase: 4.7, speed: 0.05, size: 28 },
  { cx: 470, cy: 690, rx: 130, rz: 46, phase: 2.6, speed: 0.024, size: 24 },
  { cx: 590, cy: 760, rx: 84, rz: 38, phase: 5.5, speed: 0.038, size: 22 },
  { cx: 250, cy: 470, rx: 60, rz: 30, phase: 0.9, speed: 0.055, size: 20 },
];

function drawBoat(x, y, angle, size, t, index) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const s = size / 30;

  // wake
  const wake = ctx.createLinearGradient(-size * 1.9, 0, -size * 0.3, 0);
  wake.addColorStop(0, 'rgba(255,255,255,0)');
  wake.addColorStop(1, 'rgba(255,255,255,0.42)');
  ctx.fillStyle = wake;
  ctx.beginPath();
  ctx.moveTo(-size * 1.9, -size * 0.10);
  ctx.quadraticCurveTo(-size * 0.9, -size * 0.30, -size * 0.25, -size * 0.22);
  ctx.lineTo(-size * 0.25, size * 0.22);
  ctx.quadraticCurveTo(-size * 0.9, size * 0.30, -size * 1.9, size * 0.10);
  ctx.closePath();
  ctx.fill();

  // hull
  ctx.beginPath();
  ctx.moveTo(size * 0.62, 0);
  ctx.quadraticCurveTo(size * 0.2, size * 0.30, -size * 0.52, size * 0.24);
  ctx.lineTo(-size * 0.52, -size * 0.24);
  ctx.quadraticCurveTo(size * 0.2, -size * 0.30, size * 0.62, 0);
  ctx.closePath();
  const hull = ctx.createLinearGradient(-size * 0.5, 0, size * 0.6, 0);
  hull.addColorStop(0, '#5d3a26');
  hull.addColorStop(1, '#8a5a38');
  ctx.fillStyle = hull;
  ctx.fill();

  // canopy
  ctx.beginPath();
  ctx.ellipse(-size * 0.02, 0, size * 0.30 * s, size * 0.30, 0, 0, Math.PI * 2);
  const roof = ctx.createLinearGradient(0, -size * 0.3, 0, size * 0.3);
  roof.addColorStop(0, '#f4ead4');
  roof.addColorStop(1, '#cbb994');
  ctx.fillStyle = roof;
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,70,48,0.5)';
  ctx.lineWidth = Math.max(1, s * 1.1);
  ctx.stroke();

  // a warm dot for the lantern
  if (index % 2 === 0) {
    ctx.beginPath();
    ctx.arc(-size * 0.34, 0, size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 214, 140, 0.95)';
    ctx.fill();
  }
  void t;
  ctx.restore();
}

// --- ripples --------------------------------------------------------------
const ripples = [];

function spawnRipple(u, v) {
  ripples.push({ u, v, life: 0 });
  if (ripples.length > 10) ripples.shift();
}

// --- frame ----------------------------------------------------------------
let last = performance.now();
let elapsed = 0;

function paintWater(t) {
  waterCtx.clearRect(0, 0, PLATE.width, PLATE.height);
  waterCtx.save();
  waterCtx.globalCompositeOperation = 'lighter';

  // Two interference fields drifting at different speeds: the crossing lines
  // read as moving water rather than as a scrolling texture.
  for (let layer = 0; layer < 2; layer += 1) {
    const speed = layer === 0 ? 9 : -6;
    const period = layer === 0 ? 26 : 41;
    const alpha = layer === 0 ? 0.20 : 0.14;
    waterCtx.strokeStyle = waterTint.replace('0.7', String(alpha));
    waterCtx.lineWidth = layer === 0 ? 3.2 : 5.6;
    const offset = ((t * speed) % (period * 2));
    waterCtx.beginPath();
    for (let y = -PLATE.height; y < PLATE.height * 2; y += period) {
      const yy = y + offset;
      waterCtx.moveTo(0, yy);
      for (let x = 0; x <= PLATE.width; x += 24) {
        const wave = Math.sin((x + t * (layer === 0 ? 42 : -28)) * 0.012 + yy * 0.03) * (layer === 0 ? 4.5 : 7);
        waterCtx.lineTo(x, yy + wave);
      }
    }
    waterCtx.stroke();
  }
  waterCtx.restore();
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  elapsed += dt;

  ctx.clearRect(0, 0, PLATE.width, PLATE.height);

  // --- water: paint, clip to the mask, blend over the plate ---------------
  paintWater(elapsed);
  if (maskImage) {
    waterCtx.save();
    waterCtx.globalCompositeOperation = 'destination-in';
    waterCtx.drawImage(maskImage, 0, 0, PLATE.width, PLATE.height);
    waterCtx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(waterLayer, 0, 0);
    ctx.restore();
  }

  // --- ripples ------------------------------------------------------------
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    const ripple = ripples[i];
    ripple.life += dt / 2.2;
    if (ripple.life >= 1) {
      ripples.splice(i, 1);
      continue;
    }
    const radius = 10 + ripple.life * 120;
    ctx.beginPath();
    ctx.ellipse(ripple.u, ripple.v, radius, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${(1 - ripple.life) * 0.55})`;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }

  // --- boats --------------------------------------------------------------
  BOATS.forEach((boat, index) => {
    const a = boat.phase + elapsed * boat.speed;
    const x = boat.cx + Math.cos(a) * boat.rx;
    const y = boat.cy + Math.sin(a) * boat.rz;
    // heading of the ellipse tangent
    const angle = Math.atan2(Math.cos(a) * boat.rz, -Math.sin(a) * boat.rx);
    drawBoat(x, y, angle, boat.size, elapsed, index);
  });

  requestAnimationFrame(frame);
}

// --- DOM overlay -----------------------------------------------------------
// The artwork already draws the cards, tabs and buttons. We lay transparent
// hotspots on those exact pixels so every one of them does something.

function hotspot({ x, y, w, h, label, onClick, className = '' }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `hotspot ${className}`;
  button.style.left = `${px(x)}%`;
  button.style.top = `${py(y)}%`;
  button.style.width = `${pw(w)}%`;
  button.style.height = `${ph(h)}%`;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  $('hotspots').append(button);
  return button;
}

function buildHotspots() {
  const layer = $('hotspots');
  layer.innerHTML = '';

  // place cards on the map
  for (const [id, place] of Object.entries(PLACES)) {
    const card = place.card;
    hotspot({
      ...card,
      label: place.name,
      className: 'hotspot--card',
      onClick: () => openPlace(id),
    });
  }

  // top bar: bell and map both leave for the app
  hotspot({ x: 828, y: 84, w: 84, h: 84, label: '消息', onClick: () => { window.location.href = '/index.html?screen=messages'; } });
  hotspot({ x: 722, y: 84, w: 84, h: 84, label: '地图', onClick: () => { window.location.href = '/index.html?screen=map'; } });
  hotspot({ x: 606, y: 84, w: 84, h: 84, label: '搜索顶栏', onClick: openSearch });
  hotspot({ x: 872, y: 78, w: 96, h: 96, label: '我的', onClick: () => { window.location.href = '/index.html?screen=profile'; } });

  // hero card
  hotspot({ x: 62, y: 335, w: 440, h: 96, label: '杭州 · 西湖', onClick: () => openPlace('leifeng-pagoda') });

  // search
  hotspot({ x: 68, y: 185, w: 750, h: 66, label: '搜索', onClick: openSearch });

  // 筛选
  hotspot({ x: 845, y: 184, w: 140, h: 68, label: '筛选', onClick: openFilters });

  // category chips
  const chips = [
    ['all', 62, 118], ['nature', 195, 158], ['history', 366, 102], ['food', 490, 120],
    ['stay', 625, 112], ['play', 745, 112], ['outdoor', 875, 110],
  ];
  for (const [cat, x, w] of chips) {
    hotspot({
      x, y: 264, w, h: 52,
      label: cat,
      className: 'hotspot--chip',
      onClick: () => pickCategory(cat, x, w),
    });
  }

  // right hand controls
  const controls = [
    ['y', '图层', 540, openLayers],
    ['y', '定位', 610, locateMe],
    ['y', '放大', 682, () => zoomBy(1.14)],
    ['y', '缩小', 752, () => zoomBy(0.88)],
    ['y', '指北', 828, () => {
      resetView();
      toast('已回到正北视角');
    }],
    ['y', '全景', 866, showOverview],
  ];
  for (const [, label, y, onClick] of controls) {
    hotspot({ x: 890, y, w: 100, h: 62, label, className: 'hotspot--control', onClick });
  }

  // sheet tabs
  const tabs = [
    ['recommend', 62, 92], ['nearby', 175, 100], ['dest', 290, 112], ['food', 405, 100],
    ['play', 500, 90], ['stay', 600, 90], ['photo', 690, 90], ['route', 790, 96],
  ];
  for (const [tab, x, w] of tabs) {
    hotspot({
      x, y: 1026, w, h: 56,
      label: tab,
      className: 'hotspot--tab',
      onClick: () => pickTab(tab, x, w),
    });
  }

  // bottom navigation
  const nav = [
    ['首页', 60, 180, '/index.html?screen=home'],
    ['探索', 240, 170, null],
    ['发布', 440, 140, '/index.html?screen=publish'],
    ['聊天', 640, 160, '/index.html?screen=messages'],
    ['旅友', 800, 160, '/index.html?screen=friends'],
  ];
  for (const [label, x, w, href] of nav) {
    const y = href ? 1418 : 1400;
    hotspot({
      x, y, w, h: 110,
      label,
      className: 'hotspot--nav',
      onClick: () => {
        if (href) window.location.href = href;
        else toast('已经在探索页了');
      },
    });
  }
}

// --- interactions ----------------------------------------------------------

let zoom = 1;
const pan = { x: 0, y: 0 };

function applyTransform() {
  $('plateWrap').style.transform = `translate(${pan.x.toFixed(1)}px, ${pan.y.toFixed(1)}px) scale(${zoom.toFixed(3)})`;
}

function zoomBy(factor) {
  zoom = clamp(zoom * factor, 1, 1.45);
  if (zoom <= 1.001) pan.x = pan.y = 0;
  applyTransform();
  toast(factor > 1 ? '放大' : '缩小');
}

function resetView() {
  zoom = 1;
  pan.x = 0;
  pan.y = 0;
  applyTransform();
}

function pickCategory(cat, x, w) {
  state.category = cat;
  // the artwork paints "全部" as selected; a white patch retires it so the new
  // chip is the only green one
  $('chipCover').style.opacity = cat === 'all' ? '0' : '1';
  $('chipMark').style.left = `${px(x - 4)}%`;
  $('chipMark').style.width = `${pw(w + 8)}%`;
  $('chipMark').style.opacity = '1';
  const label = { all: '全部', nature: '自然风光', history: '历史人文', food: '美食', stay: '住宿', play: '玩乐', outdoor: '户外' }[cat];
  toast(`已筛选：${label}`);
}

function pickTab(tab, x, w) {
  state.tab = tab;
  $('tabMark').style.left = `${px(x + w / 2 - 18)}%`;
  $('tabMark').style.opacity = '1';
  renderSheet();
  $('liveCards').style.opacity = '1';
  $('liveCards').style.pointerEvents = 'auto';
  toast(`切换到「${{ recommend: '推荐', nearby: '附近', dest: '目的地', food: '美食', play: '玩乐', stay: '住宿', photo: '拍照', route: '路线' }[tab]}」`);
}

function renderSheet() {
  const ids = SHEET[state.tab] || SHEET.recommend;
  const row = $('liveCards');
  row.innerHTML = '';
  ids.forEach((id, index) => {
    const place = PLACES[id];
    if (!place) return;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'live-card';
    card.style.left = `${px(62 + index * 232)}%`;
    card.style.width = `${pw(214)}%`;
    card.innerHTML = `
      <span class="live-card__media"><img src="${PHOTO_BASE}/${place.photo}.jpg" alt=""></span>
      <span class="live-card__meta"><span class="live-card__name">${place.name}</span><span class="live-card__en">${place.en}</span></span>`;
    card.onclick = () => openPlace(id);
    row.append(card);
  });
}

let searchOpen = false;
function openSearch() {
  searchOpen = !searchOpen;
  $('searchPanel').classList.toggle('is-open', searchOpen);
  if (searchOpen) {
    $('searchInput').value = '';
    renderSearch('');
    setTimeout(() => $('searchInput').focus(), 60);
  }
}

function renderSearch(query) {
  const list = $('searchList');
  const q = query.trim().toLowerCase();
  const matches = Object.entries(PLACES).filter(([, place]) =>
    !q || `${place.name}${place.en}`.toLowerCase().includes(q)
  );
  list.innerHTML = '';
  for (const [id, place] of matches) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'search-row';
    row.innerHTML = `<img src="${PHOTO_BASE}/${place.photo}.jpg" alt=""><span><b>${place.name}</b><small>${place.en} · 西湖</small></span>`;
    row.onclick = () => {
      openSearch();
      openPlace(id);
    };
    list.append(row);
  }
  if (!matches.length) list.innerHTML = '<p class="search-empty">没有找到匹配的地点</p>';
}

// --- place sheet -----------------------------------------------------------
function openPlace(id) {
  const place = PLACES[id];
  if (!place) return;
  state.selected = id;
  const sheet = $('placeSheet');
  $('placeSheetBody').innerHTML = `
    <div class="place-sheet__hero">
      <img src="${PHOTO_BASE}/${place.photo}.jpg" alt="${place.name}">
      <button class="place-sheet__close" id="placeSheetClose" type="button" aria-label="关闭">✕</button>
      <div class="place-sheet__title"><b>${place.name}</b><small>${place.en} · 杭州西湖</small></div>
    </div>
    <p class="place-sheet__body">${place.body}</p>
    <dl class="place-sheet__facts">${place.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <div class="place-sheet__actions">
      <button type="button" class="ghost" id="placeSheetRoute">加入路线</button>
      <button type="button" class="primary" id="placeSheetGo">在地图上看</button>
    </div>`;
  sheet.classList.add('is-visible');
  $('placeSheetClose').onclick = () => sheet.classList.remove('is-visible');
  $('placeSheetRoute').onclick = () => toast(`已把「${place.name}」加入路线`);
  $('placeSheetGo').onclick = () => {
    sheet.classList.remove('is-visible');
    toast(`镜头对准 ${place.name}`);
  };
}


// --- panels: layers, filters ----------------------------------------------
// Both are real sheets with real effects, not decoration.

const TONES = {
  day: { label: '日景', hint: '此刻的西湖', filter: 'none' },
  dusk: { label: '暮色', hint: '夕照雷峰', filter: 'sepia(0.16) saturate(1.12) hue-rotate(-10deg) brightness(0.95)' },
  night: { label: '夜游', hint: '灯影湖山', filter: 'saturate(0.82) brightness(0.6) hue-rotate(6deg) contrast(1.05)' },
};

let tone = 'day';
let waterTint = 'rgba(255,255,255,0.7)';

function applyTone(next) {
  tone = next;
  document.body.dataset.tone = next;
  waterTint = next === 'night' ? 'rgba(150, 200, 255, 0.5)' : next === 'dusk' ? 'rgba(255, 210, 170, 0.7)' : 'rgba(255,255,255,0.7)';
  closeSheet('layerSheet');
  toast(TONES[next].label + ' · ' + TONES[next].hint);
}

function openLayers() {
  const sheet = $('layerSheet');
  sheet.innerHTML =
    '<div class="panel__head"><b>图层</b><button type="button" class="panel__close" data-close>✕</button></div>' +
    '<div class="panel__list">' +
    Object.entries(TONES)
      .map(function (entry) {
        const key = entry[0];
        const value = entry[1];
        return '<button type="button" class="panel__row ' + (key === tone ? 'is-active' : '') + '" data-tone="' + key + '">' +
          '<span><b>' + value.label + '</b><small>' + value.hint + '</small></span>' +
          '<span class="panel__check">' + (key === tone ? '✓' : '') + '</span></button>';
      })
      .join('') +
    '</div><p class="panel__note">色调作用在整张画面上，游船与水流的动画不受影响。</p>';
  openSheet(sheet);
  sheet.querySelectorAll('[data-tone]').forEach(function (button) {
    button.onclick = function () {
      applyTone(button.dataset.tone);
    };
  });
  sheet.querySelector('[data-close]').onclick = function () {
    closeSheet('layerSheet');
  };
}

let filterCategory = 'all';
let filterPhotoOnly = false;

const CATEGORY_TAB = { all: 'recommend', nature: 'dest', history: 'play', food: 'food', stay: 'stay', play: 'play', outdoor: 'dest' };
const CATEGORY_TAB_X = { recommend: 62, nearby: 175, dest: 290, food: 405, play: 500, stay: 600, photo: 690, route: 790 };

function openFilters() {
  const sheet = $('filterSheet');
  const cats = [['all', '全部'], ['nature', '自然风光'], ['history', '历史人文'], ['food', '美食'], ['stay', '住宿'], ['play', '玩乐'], ['outdoor', '户外']];
  sheet.innerHTML =
    '<div class="panel__head"><b>筛选</b><button type="button" class="panel__close" data-close>✕</button></div>' +
    '<div class="panel__chips">' +
    cats
      .map(function (entry) {
        return '<button type="button" class="panel__chip ' + (entry[0] === filterCategory ? 'is-active' : '') + '" data-cat="' + entry[0] + '">' + entry[1] + '</button>';
      })
      .join('') +
    '</div>' +
    '<label class="panel__toggle"><input type="checkbox" id="photoOnly" ' + (filterPhotoOnly ? 'checked' : '') + '><span>只看有照片的景点</span></label>' +
    '<div class="panel__actions"><button type="button" class="ghost" data-reset>重置</button><button type="button" class="primary" data-apply>查看结果</button></div>';
  openSheet(sheet);

  sheet.querySelectorAll('[data-cat]').forEach(function (button) {
    button.onclick = function () {
      filterCategory = button.dataset.cat;
      sheet.querySelectorAll('[data-cat]').forEach(function (other) {
        other.classList.toggle('is-active', other === button);
      });
    };
  });
  sheet.querySelector('[data-reset]').onclick = function () {
    filterCategory = 'all';
    filterPhotoOnly = false;
    $('photoOnly').checked = false;
    sheet.querySelectorAll('[data-cat]').forEach(function (other) {
      other.classList.toggle('is-active', other.dataset.cat === 'all');
    });
  };
  sheet.querySelector('[data-close]').onclick = function () {
    closeSheet('filterSheet');
  };
  sheet.querySelector('[data-apply]').onclick = function () {
    filterPhotoOnly = $('photoOnly').checked;
    const tab = CATEGORY_TAB[filterCategory] || 'recommend';
    pickTab(tab, 62, 92);
    closeSheet('filterSheet');
    const count = (SHEET[tab] || []).length;
    toast('已筛选 · ' + count + ' 个地点');
  };
}

function openSheet(sheet) {
  sheet.classList.add('is-visible');
}

function closeSheet(id) {
  $(id).classList.remove('is-visible');
}

// --- geolocation -----------------------------------------------------------
const LAKE = { lat: 30.243, lon: 120.145 };

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function locateMe() {
  if (!navigator.geolocation) {
    toast('这台设备不支持定位');
    return;
  }
  toast('正在定位…');
  navigator.geolocation.getCurrentPosition(
    function (position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const distance = haversineKm(latitude, longitude, LAKE.lat, LAKE.lon);
      if (distance < 3) {
        zoomBy(1.14);
        toast('你就在西湖边 · 已放大到湖心');
      } else if (distance < 60) {
        toast('你距离西湖约 ' + distance.toFixed(1) + ' 公里');
      } else {
        toast('你距离西湖约 ' + Math.round(distance) + ' 公里');
      }
    },
    function () {
      toast('没有拿到定位权限，可在系统设置里打开');
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
  );
}

function showOverview() {
  resetView();
  toast('全景 · 西湖全域');
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2200);
}

// --- boot ------------------------------------------------------------------
function boot() {
  maskImage = new Image();
  maskImage.src = '/assets/explore3d/water-mask.png';
  maskImage.decode?.().catch(() => {});

  resizeCanvas();
  buildHotspots();
  requestAnimationFrame(frame);

  window.addEventListener('resize', resizeCanvas);

  // tapping the water drops a ripple, but only where the mask says there is water
  const waterTest = document.createElement('canvas');
  waterTest.width = PLATE.width;
  waterTest.height = PLATE.height;
  const waterTestCtx = waterTest.getContext('2d', { willReadFrequently: true });

  // --- gestures: pinch to zoom, drag to nudge when zoomed, double-tap to push in
  const gesture = { pointers: new Map(), startDist: 0, startZoom: 1, origin: null, moved: false, lastTap: 0 };

  const isWater = (clientX, clientY) => {
    const rect = $('tapLayer').getBoundingClientRect();
    const u = ((clientX - rect.left) / rect.width) * PLATE.width;
    const v = ((clientY - rect.top) / rect.height) * PLATE.height;
    if (!maskImage.complete) return null;
    waterTestCtx.clearRect(0, 0, PLATE.width, PLATE.height);
    waterTestCtx.drawImage(maskImage, 0, 0, PLATE.width, PLATE.height);
    const alpha = waterTestCtx.getImageData(Math.round(u), Math.round(v), 1, 1).data[3];
    return { u, v, water: alpha > 90 };
  };

  const layer = $('tapLayer');
  layer.addEventListener('pointerdown', event => {
    try {
      layer.setPointerCapture(event.pointerId);
    } catch (_) {
      /* synthetic pointers have nothing to capture */
    }
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.moved = false;
    gesture.origin = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    if (gesture.pointers.size === 2) {
      const points = [...gesture.pointers.values()];
      gesture.startDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      gesture.startZoom = zoom;
    }
  });

  layer.addEventListener('pointermove', event => {
    const tracked = gesture.pointers.get(event.pointerId);
    if (!tracked) return;
    tracked.x = event.clientX;
    tracked.y = event.clientY;

    if (gesture.pointers.size === 2) {
      const points = [...gesture.pointers.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (gesture.startDist > 8) {
        zoom = clamp((distance / gesture.startDist) * gesture.startZoom, 1, 1.45);
        applyTransform();
        gesture.moved = true;
      }
      return;
    }

    if (!gesture.origin) return;
    const dx = event.clientX - gesture.origin.x;
    const dy = event.clientY - gesture.origin.y;
    if (Math.hypot(dx, dy) > 6) gesture.moved = true;
    if (gesture.moved && zoom > 1.001) {
      // panning only once zoomed in: at 1x the artwork must stay on its own UI
      pan.x = clamp(gesture.origin.panX + dx, -70 * zoom, 70 * zoom);
      pan.y = clamp(gesture.origin.panY + dy, -90 * zoom, 90 * zoom);
      applyTransform();
    }
  });

  const endPointer = event => {
    gesture.pointers.delete(event.pointerId);
    if (gesture.pointers.size > 0) return;
    const wasDrag = gesture.moved;
    gesture.origin = null;
    if (wasDrag) return;
    const spot = isWater(event.clientX, event.clientY);
    if (spot && spot.water) spawnRipple(spot.u, spot.v);
    const now = performance.now();
    if (now - gesture.lastTap < 300) zoomBy(1.18);
    gesture.lastTap = now;
  };
  layer.addEventListener('pointerup', endPointer);
  layer.addEventListener('pointercancel', endPointer);

  $('searchInput').addEventListener('input', event => renderSearch(event.target.value));
  $('searchClose').addEventListener('click', openSearch);
  $('placeSheet').addEventListener('click', event => {
    if (event.target === $('placeSheet')) $('placeSheet').classList.remove('is-visible');
  });

  const plateImage = $('plate');
  const hideLoading = () => {
    $('loading').classList.remove('is-visible');
    window.__westlakeReady = true;
  };
  if (plateImage.complete) setTimeout(hideLoading, 120);
  else plateImage.addEventListener('load', () => setTimeout(hideLoading, 120), { once: true });
  // never let a slow image hold the page hostage
  setTimeout(hideLoading, 2500);
}

boot();

window.__westlake = { PLACES, openPlace, spawnRipple, zoomBy, pickTab, pickCategory };
