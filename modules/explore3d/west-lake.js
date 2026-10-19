// Explore 3D — the West Lake model.
//
// Everything in this file is generated at runtime from a height function and a
// handful of real coordinates, so the whole scene costs one module download
// instead of a megabytes-long GLB. That is a deliberate phase-1 decision: it
// proves the camera, the water, the LOD story and the social overlay before any
// artist-made asset pipeline exists. Swapping the hero pagoda for a scanned GLB
// later touches one function, not the architecture.
//
// The model is positioned on the real globe: the group sits at the lake's
// latitude/longitude, its up axis is the true radial, and its north is the true
// north tangent. Local coordinates are metres, +X east, +Y up, +Z south.

import * as THREE from '/modules/vendor/three/three.module.js';
import { EARTH_RADIUS, geoToVec3, northTangent, eastTangent } from './globe.js';

export const WEST_LAKE = {
  id: 'cn-west-lake',
  name: '西湖',
  nameEn: 'West Lake',
  city: '杭州',
  lat: 30.243,
  lon: 120.145,
  // The opening shot inside the scene. `tilt` is measured away from
  // straight-down, so 68° is a 22°-above-horizon landscape view: near water at
  // the bottom of the frame, 雷峰塔 in the lower left, 断桥 and 保俶塔 on the
  // skyline. The sub-point sits off the south shore so the lake runs away.
  arrival: { lat: 30.2058, lon: 120.1472, altitude: 6.4, heading: 6, tilt: 36 },
};

const DEG = Math.PI / 180;
const METRES_PER_DEG_LAT = 110574;
const METRES_PER_DEG_LON = 111320 * Math.cos(WEST_LAKE.lat * DEG);

/** Geographic → local metres in this scene's frame. */
export function geoToLocal(lat, lon) {
  return { x: (lon - WEST_LAKE.lon) * METRES_PER_DEG_LON, z: -(lat - WEST_LAKE.lat) * METRES_PER_DEG_LAT };
}

/** Local metres → geographic. */
export function localToGeo(x, z) {
  return { lat: WEST_LAKE.lat - z / METRES_PER_DEG_LAT, lon: WEST_LAKE.lon + x / METRES_PER_DEG_LON };
}

// --- named places ----------------------------------------------------------
// Coordinates are the real ones already used by the 2D guide (WGS-84).
export const SPOTS = [
  { id: 'broken-bridge', name: '断桥残雪', lat: 30.2592, lon: 120.1483, kind: 'bridge', height: 6.5 },
  { id: 'leifeng-pagoda', name: '雷峰塔', lat: 30.2317, lon: 120.1492, kind: 'pagoda', height: 72 },
  { id: 'three-pools', name: '三潭印月', lat: 30.2274, lon: 120.1431, kind: 'islet', height: 3 },
  { id: 'su-causeway', name: '苏堤春晓', lat: 30.2405, lon: 120.1362, kind: 'causeway', height: 3 },
  { id: 'bai-causeway', name: '白堤', lat: 30.2565, lon: 120.1425, kind: 'causeway', height: 3 },
  { id: 'hubin', name: '湖滨', lat: 30.2489, lon: 120.1600, kind: 'shore', height: 5 },
  { id: 'gushan', name: '孤山', lat: 30.2557, lon: 120.1385, kind: 'island', height: 38 },
  { id: 'baochu', name: '保俶塔', lat: 30.2601, lon: 120.1442, kind: 'pagoda', height: 45 },
  { id: 'chenghuang', name: '城隍阁', lat: 30.2380, lon: 120.1670, kind: 'pavilion', height: 60 },
  { id: 'jingci', name: '净慈寺', lat: 30.2300, lon: 120.1468, kind: 'temple', height: 20 },
  { id: 'quyuan', name: '曲院风荷', lat: 30.2540, lon: 120.1320, kind: 'garden', height: 8 },
  { id: 'huagang', name: '花港观鱼', lat: 30.2260, lon: 120.1360, kind: 'garden', height: 8 },
  { id: 'liulang', name: '柳浪闻莺', lat: 30.2350, lon: 120.1560, kind: 'garden', height: 8 },
  { id: 'huxinting', name: '湖心亭', lat: 30.2455, lon: 120.1445, kind: 'islet', height: 2 },
];

// The lake outline, hand-traced in local metres from the real shoreline. The
// order is clockwise when seen from above, which keeps the triangulation and
// the normal direction predictable.
const SHORE = [
  [330, -1790], [640, -1700], [900, -1480], [1080, -1180], [1130, -860], [1090, -560],
  [1040, -260], [1000, 40], [940, 380], [840, 720], [700, 1020], [540, 1300],
  [380, 1520], [260, 1750], [120, 1930], [-140, 2010], [-430, 1960], [-680, 1830],
  [-820, 1650], [-880, 1400], [-930, 1120], [-1010, 860], [-1120, 560], [-1200, 220],
  [-1190, -120], [-1100, -430], [-1010, -720], [-880, -980], [-760, -1200], [-640, -1400],
  [-560, -1580], [-440, -1740], [-260, -1860], [-60, -1900], [140, -1870], [270, -1830],
];

// Causeways: [ax, az, bx, bz, halfWidth, height]
const CAUSEWAYS = [
  { name: '苏堤', a: [-930, -1000], b: [-770, 1110], half: 15, height: 2.1 },
  { name: '白堤', a: [340, -1770], b: [-530, -1600], half: 10, height: 1.9 },
  { name: '杨公堤', a: [-1290, -820], b: [-1210, 1500], half: 13, height: 2.2 },
];

const ISLANDS = [
  { name: '孤山', x: -620, z: -1330, r: 210, height: 38 },
  { name: '小瀛洲', x: -183, z: 1725, r: 165, height: 2.4 },
  { name: '湖心亭', x: -48, z: -277, r: 52, height: 1.8 },
];

const HILLS = [
  // [x, z, radius, height, falloff]
  [150, -2380, 520, 78, 2.2],    // 宝石山
  [-350, -2520, 620, 130, 2.0],  // 葛岭
  [-520, -2100, 420, 96, 2.4],   // 栖霞岭
  [404, 1249, 170, 45, 2.6],     // 夕照山 (雷峰塔)
  [2100, 560, 420, 62, 2.2],     // 吴山
  [-200, 2450, 620, 96, 2.0],    // 南屏山
  [1250, 3050, 780, 130, 2.0],   // 玉皇山
  [-4200, -600, 1500, 300, 1.9], // 北高峰 / 灵隐一带
  [-5000, 1800, 1700, 240, 1.9], // 五云山
  [-3600, 3400, 1500, 200, 1.9],
  [4200, -2600, 1200, 90, 2.0],  // 城东·皋亭
  [1300, -3200, 900, 120, 2.1],
];

// --- deterministic noise ---------------------------------------------------
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, octaves = 4, lacunarity = 2.05, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(fx, fy) * amp;
    norm += amp;
    amp *= gain;
    fx *= lacunarity;
    fy *= lacunarity;
  }
  return sum / norm;
}

const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Distance from a point to a polyline segment, plus the local parameter. */
function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const len2 = vx * vx + vz * vz || 1e-6;
  const t = THREE.MathUtils.clamp((wx * vx + wz * vz) / len2, 0, 1);
  const dx = wx - vx * t;
  const dz = wz - vz * t;
  return { distance: Math.hypot(dx, dz), t };
}

/** Signed distance to the shoreline: negative inside the lake. */
function lakeSignedDistance(x, z) {
  let best = Infinity;
  let inside = false;
  for (let i = 0, j = SHORE.length - 1; i < SHORE.length; j = i, i += 1) {
    const [ax, az] = SHORE[j];
    const [bx, bz] = SHORE[i];
    const { distance } = segmentDistance(x, z, ax, az, bx, bz);
    if (distance < best) best = distance;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az || 1e-6) + ax) inside = !inside;
  }
  return inside ? -best : best;
}

/** Land height in metres for the whole diorama apron. */
function heightAt(x, z) {
  const lake = lakeSignedDistance(x, z);
  const r = Math.hypot(x, z);

  // Base: a flat city plain that rises gently to the west and south.
  let h = 4.5 + fbm(x / 2400 + 11.3, z / 2400 - 4.7, 3) * 6.0;

  // Hills, added as smooth bumps so the skyline is soft rather than spiky.
  for (const [hx, hz, radius, height, falloff] of HILLS) {
    const d = Math.hypot(x - hx, z - hz) / radius;
    if (d < 1.6) h += height * Math.pow(Math.max(0, 1 - d * d / 1.6), falloff);
  }

  // Ridging: mountains are noisy, plains are not.
  const relief = fbm(x / 900 + 3.1, z / 900 + 7.7, 4) - 0.5;
  h += relief * 16 * smoothstep(1200, 5200, r) * smoothstep(30, 120, h);

  // The lake basin.
  const bed = -3.4 + fbm(x / 900, z / 900, 2) * 0.8;
  if (lake < 120) {
    const shoreBlend = smoothstep(0, 120, lake);
    const landNearShore = -0.9 + shoreBlend * 2.2;
    if (lake < 0) {
      // Inside: bed, forced below the water line so no terrain pokes through.
      h = Math.min(bed + smoothstep(-260, 0, lake) * 1.9, -0.55);
    } else {
      h = Math.min(h, landNearShore);
    }
  }

  // Causeways sit above the water and cut the lake into its real bays.
  for (const causeway of CAUSEWAYS) {
    const { distance } = segmentDistance(x, z, causeway.a[0], causeway.a[1], causeway.b[0], causeway.b[1]);
    const band = 1 - smoothstep(causeway.half, causeway.half + 16, distance);
    if (band > 0) h = THREE.MathUtils.lerp(h, causeway.height, band);
  }

  // Islands rise out of the lake.
  for (const island of ISLANDS) {
    const d = Math.hypot(x - island.x, z - island.z) / island.r;
    const band = 1 - smoothstep(0.72, 1.0, d);
    if (band > 0) h = Math.max(h, THREE.MathUtils.lerp(-1.2, island.height, band));
  }

  // 钱塘江: a broad river east of the city, reading as water from altitude.
  const riverBag = Math.abs(x - (4300 + Math.sin(z / 2600) * 320)) - 260;
  if (riverBag < 0) h = Math.min(h, -3.0 + smoothstep(-260, 0, riverBag) * 2.0);

  return h;
}

/** Height including the earth's curvature, so the apron meets the globe. */
function surfaceAt(x, z) {
  const r = Math.hypot(x, z);
  return heightAt(x, z) - (r * r) / (2 * EARTH_RADIUS * 1000);
}

// --- geometry helpers ------------------------------------------------------

function polygonArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    area += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return area / 2;
}

/** Ear-clipping triangulation for a simple polygon (no holes). */
function triangulate(points) {
  const indices = [];
  const n = points.length;
  const clockwise = polygonArea(points) > 0;
  const order = [];
  for (let i = 0; i < n; i += 1) order.push(clockwise ? n - 1 - i : i);
  const remaining = order.slice();

  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const pointInTriangle = (p, a, b, c) => {
    const d1 = cross(a, b, p);
    const d2 = cross(b, c, p);
    const d3 = cross(c, a, p);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  };

  let guard = 0;
  while (remaining.length > 3 && guard < 10000) {
    guard += 1;
    let clipped = false;
    for (let i = 0; i < remaining.length; i += 1) {
      const ia = remaining[(i + remaining.length - 1) % remaining.length];
      const ib = remaining[i];
      const ic = remaining[(i + 1) % remaining.length];
      const a = points[ia];
      const b = points[ib];
      const c = points[ic];
      if (cross(a, b, c) <= 0) continue;
      let contains = false;
      for (const idx of remaining) {
        if (idx === ia || idx === ib || idx === ic) continue;
        if (pointInTriangle(points[idx], a, b, c)) {
          contains = true;
          break;
        }
      }
      if (contains) continue;
      indices.push(ia, ib, ic);
      remaining.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (remaining.length === 3) indices.push(remaining[0], remaining[1], remaining[2]);
  return indices;
}

function flatShaded(geometry) {
  geometry.computeVertexNormals();
  return geometry;
}

// --- material palette ------------------------------------------------------
// sRGB hex; three converts these for built-in materials.
// The reference is a bright spring morning, so the land is saturated and the
// water is turquoise rather than the slate of the dusk pass.
const C = {
  grass: 0x5d9b48,
  grassDry: 0x8ab34f,
  forest: 0x2f6b3c,
  soil: 0x9b7f56,
  rock: 0x8d8878,
  stone: 0xbdb6a2,
  sand: 0xdcc99b,
  urban: 0xc9c3b1,
  waterShallow: 0x9fdcd6,
  waterDeep: 0x147d96,
  roofTile: 0x5a6670,
  roofWarm: 0x8a4f38,
  wallWhite: 0xf4efe2,
  wallWood: 0x8a5836,
  lacquer: 0xa83c25,
  gold: 0xd2ab5c,
  stonework: 0xa9a698,
};

/**
 * Builds the whole West Lake scene.
 * @returns {{ group: THREE.Group, update: Function, dispose: Function, poseFor: Function, spots: Array }}
 */
export function createWestLake({ renderer, sunDirection, quality = 'high' }) {
  const group = new THREE.Group();
  group.name = 'west-lake';
  group.scale.setScalar(0.001); // metres → kilometres

  const origin = geoToVec3(WEST_LAKE.lat, WEST_LAKE.lon, EARTH_RADIUS, new THREE.Vector3());
  const up = origin.clone().normalize();
  const north = northTangent(WEST_LAKE.lat, WEST_LAKE.lon, new THREE.Vector3());
  const east = eastTangent(WEST_LAKE.lat, WEST_LAKE.lon, new THREE.Vector3());
  const south = north.clone().negate();
  group.position.copy(origin);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, south));

  const tiers = {
    high: { rings: 132, segments: 200, radius: 30000, trees: 3300, buildings: 560 },
    medium: { rings: 104, segments: 156, radius: 26000, trees: 2100, buildings: 380 },
    low: { rings: 78, segments: 112, radius: 22000, trees: 900, buildings: 220 },
  }[quality] ?? { rings: 104, segments: 156, radius: 26000, trees: 950, buildings: 130 };

  const disposables = [];
  const cameraLocal = new THREE.Vector3();
  const track = item => {
    disposables.push(item);
    return item;
  };

  // The diorama gets its own sun, low in the south-west, because a globe lit
  // from directly overhead has no raking light to model a pagoda with. Nobody
  // sees both lights at once: the model takes over below ~50 km altitude.
  const localSun = new THREE.Vector3(-0.58, 0.33, 0.74).normalize();

  // --- surface textures ----------------------------------------------------
  // Small, tileable, and multiplicative: they add surface detail without
  // changing the silhouette or the lighting the geometry already does.
  const textureLoader = new THREE.TextureLoader();
  const loadTexture = (url, repeat) => {
    const texture = textureLoader.load(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
    if (repeat) texture.repeat.set(repeat, repeat);
    return texture;
  };
  const meadowTexture = loadTexture('/assets/explore3d/tex/meadow.webp');
  const canopyTexture = loadTexture('/assets/explore3d/tex/canopy.webp');
  track(meadowTexture);
  track(canopyTexture);

  // --- sky ---------------------------------------------------------------
  // A dome, not a skybox: it is drawn in the diorama's own frame so the fogged
  // rim of the 30 km apron dissolves into the horizon instead of ending on a
  // hard circle against the globe. Clouds live in the same shader, drifting
  // slowly, which is most of what makes the sky feel alive.
  const DAY_SKY = { horizon: 0xe9f5f7, mid: 0xb9dff2, zenith: 0x69b4e0 };
  const DUSK_SKY = { horizon: 0xd9cdb2, mid: 0xa8bcc0, zenith: 0x2f5468 };
  const skyUniforms = {
    uSunDir: { value: localSun.clone() },
    uHorizon: { value: new THREE.Color(DAY_SKY.horizon) },
    uMid: { value: new THREE.Color(DAY_SKY.mid) },
    uZenith: { value: new THREE.Color(DAY_SKY.zenith) },
    uTime: { value: 0 },
    uClouds: { value: 0.72 },
  };
  const skyGeometry = track(new THREE.SphereGeometry(42000, 44, 26, 0, Math.PI * 2, 0, Math.PI * 0.52));
  const skyMaterial = track(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uSunDir;
        uniform vec3 uHorizon;
        uniform vec3 uMid;
        uniform vec3 uZenith;
        uniform float uTime;
        uniform float uClouds;
        varying vec3 vDir;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) {
          return noise(p) * 0.55 + noise(p * 2.1 + 11.3) * 0.28 + noise(p * 4.3 - 7.1) * 0.17;
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, -1.0, 1.0);
          vec3 color = mix(uHorizon, uMid, smoothstep(0.0, 0.30, h));
          color = mix(color, uZenith, smoothstep(0.26, 0.95, h));

          // Sun: a warm bloom rather than a disc, in keeping with painted skies.
          float sun = max(dot(dir, normalize(uSunDir)), 0.0);
          color += vec3(1.0, 0.80, 0.52) * pow(sun, 14.0) * 0.5;
          color += vec3(1.0, 0.92, 0.76) * pow(sun, 220.0) * 1.1;

          // Cloud deck: project the sky direction onto a plane and drift it.
          if (h > 0.02) {
            vec2 p = dir.xz / max(h + 0.22, 0.24) * 1.6;
            vec2 drift = vec2(uTime * 0.0035, uTime * 0.0012);
            float c = fbm(p * 0.9 + drift);
            float c2 = fbm(p * 2.2 - drift * 1.7);
            float cover = smoothstep(0.52, 0.86, c * 0.72 + c2 * 0.28);
            cover *= smoothstep(0.02, 0.20, h) * uClouds;
            vec3 cloudCol = mix(vec3(0.82, 0.87, 0.90), vec3(1.0, 0.99, 0.96), clamp(c2 + 0.25, 0.0, 1.0));
            color = mix(color, cloudCol, cover * 0.88);
          }

          // A hair of warmth right at the horizon line.
          color = mix(color, vec3(0.97, 0.96, 0.90), smoothstep(0.10, -0.02, h) * 0.45);
          gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(0.4545)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
  );
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.name = 'sky';
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  // --- terrain -------------------------------------------------------------
  // A polar grid, not a square one: rings grow geometrically so the lake gets
  // metre-scale triangles while the far hills stay cheap, and the curvature
  // term makes the 30 km apron bend with the planet instead of floating flat.
  const terrainGeometry = (() => {
    const positions = [];
    const colors = [];
    const uvs = [];
    const indices = [];
    const ringRadius = i => (i === 0 ? 0 : tiers.radius * Math.pow(i / tiers.rings, 3.1));
    const ringCount = tiers.rings;
    const segCount = tiers.segments;

    const color = new THREE.Color();
    const pushVertex = (x, z) => {
      const y = surfaceAt(x, z);
      positions.push(x, y, z);
      uvs.push(x / 900, z / 900);
      const lake = lakeSignedDistance(x, z);
      const r = Math.hypot(x, z);
      const noise = fbm(x / 260 + 5.5, z / 260 - 2.2, 3);

      if (lake < 0) {
        color.setHex(0x4a5240).lerp(new THREE.Color(C.sand), smoothstep(-90, 4, lake) * 0.75);
      } else if (Math.abs(x - (4300 + Math.sin(z / 2600) * 320)) < 300) {
        color.setHex(C.waterShallow).multiplyScalar(0.85);
      } else if (y > 120) {
        color.setHex(C.rock).lerp(new THREE.Color(0xb9b6ab), smoothstep(120, 240, y));
      } else if (y > 46) {
        color.setHex(C.forest).lerp(new THREE.Color(C.rock), smoothstep(46, 120, y) * 0.55);
      } else if (r > 6200 && noise > 0.55) {
        color.setHex(C.grassDry).lerp(new THREE.Color(C.urban), noise * 0.5);
      } else if (r < 3600 && y < 12) {
        color.setHex(C.grass).lerp(new THREE.Color(C.urban), smoothstep(2400, 3600, r) * 0.45);
      } else {
        const patch = fbm(x / 620 + 31.7, z / 620 - 17.3, 4);
        color.setHex(C.grass).lerp(new THREE.Color(C.grassDry), smoothstep(0.42, 0.78, patch) * 0.55);
        const forestBand = smoothstep(0.5, 0.82, fbm(x / 1450 - 8.2, z / 1450 + 4.4, 3));
        color.lerp(new THREE.Color(C.forest), forestBand * 0.75);
        color.offsetHSL((patch - 0.5) * 0.02, (patch - 0.5) * 0.1, (patch - 0.5) * 0.05);
      }

      // Causeway decks read as pale trodden earth, not lawn.
      for (const causeway of CAUSEWAYS) {
        const { distance } = segmentDistance(x, z, causeway.a[0], causeway.a[1], causeway.b[0], causeway.b[1]);
        if (distance < causeway.half + 18) {
          color.lerp(new THREE.Color(C.stone), 1 - smoothstep(causeway.half, causeway.half + 18, distance));
        }
      }
      // A hint of beach exactly at the water line.
      if (lake >= 0 && lake < 16) color.lerp(new THREE.Color(C.sand), (1 - lake / 16) * 0.7);

      colors.push(color.r, color.g, color.b);
    };

    for (let i = 0; i <= ringCount; i += 1) {
      const rr = ringRadius(i);
      if (i === 0) {
        pushVertex(0, 0);
        continue;
      }
      for (let s = 0; s < segCount; s += 1) {
        const angle = (s / segCount) * Math.PI * 2;
        pushVertex(Math.cos(angle) * rr, Math.sin(angle) * rr);
      }
    }

    for (let s = 0; s < segCount; s += 1) {
      const a = 1 + s;
      const b = 1 + ((s + 1) % segCount);
      indices.push(0, b, a);
    }
    for (let i = 1; i < ringCount; i += 1) {
      const innerStart = 1 + (i - 1) * segCount;
      const outerStart = 1 + i * segCount;
      for (let s = 0; s < segCount; s += 1) {
        const s1 = (s + 1) % segCount;
        const a = innerStart + s;
        const b = innerStart + s1;
        const c = outerStart + s;
        const d = outerStart + s1;
        indices.push(a, d, c);
        indices.push(a, b, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  })();

  const terrainMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: meadowTexture,
    side: THREE.FrontSide,
  });
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.name = 'terrain';
  terrain.receiveShadow = true;
  group.add(terrain);
  track(terrainGeometry);
  track(terrainMaterial);

  // --- water ---------------------------------------------------------------
  // The surface is a triangulated polygon, so the shoreline is an exact curve
  // at any zoom. Waves and colour live entirely in the fragment shader.

  const waterUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: localSun.clone() },
    uCameraLocal: { value: new THREE.Vector3() },
    uDeep: { value: new THREE.Color(0x1a8fae) },
    uShallow: { value: new THREE.Color(0x8adcd8) },
    uSkyTop: { value: new THREE.Color(0x8fc6e2) },
    uSkyHorizon: { value: new THREE.Color(0xe8ecd8) },
    uMask: { value: null },
    uMaskBounds: { value: new THREE.Vector4(-1400, -2000, 1400, 2200) },
  };

  const maskSize = 192;
  const maskData = new Uint8Array(maskSize * maskSize * 2);
  {
    const [x0, z0, x1, z1] = waterUniforms.uMaskBounds.value.toArray();
    for (let j = 0; j < maskSize; j += 1) {
      for (let i = 0; i < maskSize; i += 1) {
        const x = THREE.MathUtils.lerp(x0, x1, i / (maskSize - 1));
        const z = THREE.MathUtils.lerp(z0, z1, j / (maskSize - 1));
        const sdf = lakeSignedDistance(x, z);
        const idx = (j * maskSize + i) * 2;
        // R: 1 inside the lake with a soft edge. G: shore proximity, which is
        // what drives the shallow tint and the foam line.
        maskData[idx] = Math.round(THREE.MathUtils.clamp(0.5 - sdf / 30, 0, 1) * 255);
        // Shore proximity has to decay on *both* sides of the waterline. Using
        // max(0, sdf) made it 1 across the whole lake, which painted every
        // square metre with foam and turned the water flat grey.
        maskData[idx + 1] = Math.round(Math.exp(-Math.abs(sdf) / 55) * 255);
      }
    }
  }
  const maskTexture = new THREE.DataTexture(maskData, maskSize, maskSize, THREE.RGFormat, THREE.UnsignedByteType);
  maskTexture.magFilter = THREE.LinearFilter;
  maskTexture.minFilter = THREE.LinearFilter;
  maskTexture.needsUpdate = true;
  waterUniforms.uMask.value = maskTexture;
  track(maskTexture);

  const waterGeometry = (() => {
    // Fill the polygon with concentric rings so the shader has enough vertices
    // for the swell displacement, while the boundary stays exactly SHORE.
    const positions = [];
    const uvs = [];
    const indices = [];
    const centre = SHORE.reduce((acc, [x, z]) => [acc[0] + x / SHORE.length, acc[1] + z / SHORE.length], [0, 0]);
    const rings = 18;
    const boundary = SHORE.length;

    for (let ring = 0; ring <= rings; ring += 1) {
      const t = ring / rings;
      for (let i = 0; i < boundary; i += 1) {
        const x = THREE.MathUtils.lerp(centre[0], SHORE[i][0], t);
        const z = THREE.MathUtils.lerp(centre[1], SHORE[i][1], t);
        positions.push(x, 0, z);
        uvs.push(i / boundary, t);
      }
    }
    for (let ring = 0; ring < rings; ring += 1) {
      for (let i = 0; i < boundary; i += 1) {
        const next = (i + 1) % boundary;
        const a = ring * boundary + i;
        const b = ring * boundary + next;
        const c = (ring + 1) * boundary + i;
        const d = (ring + 1) * boundary + next;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  })();

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vLocal;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        // Swell: three long waves, amplitude scaled down near the shore so the
        // water does not climb over the embankment.
        float edge = smoothstep(0.0, 0.12, 1.0 - uv.y);
        float swell = sin(pos.x * 0.011 + uTime * 0.85) * 0.055
                    + sin(pos.z * 0.017 - uTime * 1.1) * 0.038
                    + sin((pos.x + pos.z) * 0.028 + uTime * 1.7) * 0.018;
        pos.y += swell * (0.35 + 0.65 * edge);
        vLocal = pos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uCameraLocal;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSkyTop;
      uniform vec3 uSkyHorizon;
      uniform sampler2D uMask;
      uniform vec4 uMaskBounds;
      varying vec3 vLocal;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      // Three octaves of drifting noise, sampled once as a field and once with
      // a small offset on each axis: the difference is the surface normal.
      float ripple(vec2 p, vec2 drift) {
        return noise(p * 0.055 + drift) * 0.6
             + noise(p * 0.13 - drift * 1.7) * 0.3
             + noise(p * 0.31 + drift * 2.3) * 0.1;
      }

      void main() {
        // Everything is shaded in the diorama's own frame (+X east, +Z south).
        // Using world coordinates here would shear every wave by the 30° the
        // lake is rotated by on the sphere.
        vec2 uv = (vLocal.xz - uMaskBounds.xy) / (uMaskBounds.zw - uMaskBounds.xy);
        vec2 mask = vec2(1.0, 1.0);
        if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
          mask = texture2D(uMask, uv).rg;
        }
        float shore = mask.g;

        vec2 p = vLocal.xz;
        float e = 1.8;
        vec2 drift = vec2(uTime * 0.28, -uTime * 0.19);
        float c = ripple(p, drift);
        float nx = ripple(p + vec2(e, 0.0), drift);
        float nz = ripple(p + vec2(0.0, e), drift);
        // Ripples fade with distance: at 4 km a 30 cm wave is far below a pixel,
        // and letting it alias turns the lake into grey noise.
        float dist = length(uCameraLocal - vLocal);
        // Two bands: fine ripples fade out so a far lake never aliases into
        // noise, while a broad swell keeps the surface from turning into a flat
        // cyan fill.
        float fine = 1.0 - smoothstep(420.0, 3200.0, dist);
        float broad = 1.0 - smoothstep(9000.0, 26000.0, dist);
        float bump = 2.6 * fine + 0.9 * broad;
        vec3 N = normalize(vec3((c - nx) * bump, 1.0, (c - nz) * bump));

        vec3 V = normalize(uCameraLocal - vLocal);
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);

        float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(R.y * 1.6 + 0.15, 0.0, 1.0));

        vec3 body = mix(uShallow, uDeep, smoothstep(0.05, 0.75, mask.r));
        body *= 1.18 + 0.22 * clamp(L.y + 0.35, 0.0, 1.0);

        // Wind streaks: slow bands of slightly lighter water, the thing that
        // makes a real lake look brushed rather than poured.
        float streak = noise(p * 0.0045 + vec2(uTime * 0.006, 0.0)) * 0.6
                     + noise(p * 0.011 - vec2(uTime * 0.004, 0.0)) * 0.4;
        body = mix(body, body * 1.16 + vec3(0.012, 0.03, 0.03), smoothstep(0.52, 0.82, streak) * 0.55);

        // Depth mottling: real lake beds are uneven, and a single flat cyan
        // read is the thing that made the first pass look like paint.
        float depthNoise = noise(p * 0.0026 + vec2(3.1, -1.7)) * 0.6 + noise(p * 0.0074 - vec2(1.3, 2.9)) * 0.4;
        body *= 0.88 + depthNoise * 0.26;

        float spec = pow(max(dot(N, H), 0.0), 180.0) * 3.6
                   + pow(max(dot(N, H), 0.0), 18.0) * 0.16;
        // Coarse glitter: the sun path on a real lake at this distance is a
        // band of moving highlights, not a single specular lobe.
        float glit = noise(p * 0.05 + vec2(uTime * 0.55, -uTime * 0.32));
        float sparkle = pow(max(glit, 0.0), 13.0) * (1.0 - smoothstep(1400.0, 7500.0, dist) * 0.55);
        vec3 color = mix(body, sky, fresnel * 0.42) + vec3(1.0, 0.94, 0.82) * (spec + sparkle * 0.38);

        // Foam at the bank: a soft, drifting line rather than a hard ring.
        float foam = smoothstep(0.60, 0.98, shore) * (0.35 + 0.65 * noise(p * 0.5 + uTime * 0.4));
        color = mix(color, vec3(0.88, 0.90, 0.86), foam * 0.20);

        gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(0.4545)), 1.0);
      }
    `,
  });
  waterMaterial.side = THREE.DoubleSide;
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.name = 'water';
  water.position.y = 0.02;
  water.renderOrder = 1;
  group.add(water);
  track(waterGeometry);
  track(waterMaterial);

  // --- ripples -------------------------------------------------------------
  // Tapping the water drops a ring on it. Twelve pooled rings, no allocation at
  // runtime, and it is the cheapest way to make the lake feel touchable.
  const ripples = (() => {
    const pool = [];
    const geometry = track(new THREE.RingGeometry(0.66, 1, 48));
    geometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i += 1) {
      const material = track(
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 3;
      group.add(mesh);
      pool.push({ mesh, material, life: 1 });
    }
    let cursor = 0;
    return {
      spawn(x, z) {
        const slot = pool[cursor % pool.length];
        cursor += 1;
        slot.mesh.position.set(x, 0.55, z);
        slot.life = 0;
        slot.mesh.visible = true;
      },
      update(dt) {
        for (const slot of pool) {
          if (slot.life >= 1) continue;
          slot.life = Math.min(1, slot.life + dt / 2.5);
          // Starts wide enough to be legible from the opening camera (11 m is
          // two pixels at 5 km); 26 m -> 236 m reads from any altitude.
          const scale = 26 + slot.life * 210;
          slot.mesh.scale.set(scale, 1, scale);
          slot.material.opacity = Math.pow(1 - slot.life, 1.4) * 0.85;
          if (slot.life >= 1) slot.mesh.visible = false;
        }
      },
    };
  })();

  // --- stone embankment ----------------------------------------------------
  // A ribbon along the shoreline. It covers the seam between the water polygon
  // and the terrain grid, and it is what West Lake actually looks like.
  const bankGroup = (() => {
    const positions = [];
    const colors = [];
    const indices = [];
    const color = new THREE.Color();
    const inner = [];
    const outer = [];
    for (let i = 0; i < SHORE.length; i += 1) {
      const [x, z] = SHORE[i];
      const [px, pz] = SHORE[(i + SHORE.length - 1) % SHORE.length];
      const [nx, nz] = SHORE[(i + 1) % SHORE.length];
      const dx = nx - px;
      const dz = nz - pz;
      const len = Math.hypot(dx, dz) || 1;
      // Outward normal: the polygon is clockwise seen from above.
      const ox = -dz / len;
      const oz = dx / len;
      inner.push([x - ox * 1.5, z - oz * 1.5]);
      outer.push([x + ox * 2.4, z + oz * 2.4]);
    }
    for (const [arr, lift] of [[inner, 0.55], [inner, -0.9], [outer, -0.9], [outer, 0.32]]) {
      for (let i = 0; i < arr.length; i += 1) {
        positions.push(arr[i][0], lift, arr[i][1]);
        color.setHex(lift > 0.4 ? C.stonework : C.rock).multiplyScalar(lift > 0.4 ? 1 : 0.78);
        colors.push(color.r, color.g, color.b);
      }
    }
    const n = SHORE.length;
    for (let band = 0; band < 3; band += 1) {
      const a0 = band * n;
      const a1 = (band + 1) * n;
      for (let i = 0; i < n; i += 1) {
        const j = (i + 1) % n;
        indices.push(a0 + i, a1 + i, a0 + j);
        indices.push(a0 + j, a1 + i, a1 + j);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    track(geometry);
    track(material);
    return new THREE.Mesh(geometry, material);
  })();
  bankGroup.name = 'embankment';
  group.add(bankGroup);

  // --- trees ---------------------------------------------------------------
  const trees = (() => {
    const canopyGeometry = track(new THREE.IcosahedronGeometry(1, 0));
    const trunkGeometry = track(new THREE.CylinderGeometry(0.16, 0.24, 1, 5, 1, false));
    trunkGeometry.translate(0, 0.5, 0);
    canopyGeometry.scale(1, 0.82, 1);
    canopyGeometry.translate(0, 1, 0);

    const canopyMaterial = track(new THREE.MeshLambertMaterial({ flatShading: true }));
    const trunkMaterial = track(new THREE.MeshLambertMaterial({ color: 0x584436 }));

    const timeUniform = { value: 0 };
    const patch = shader => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           float phase = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.13;
         #else
           float phase = 0.0;
         #endif
         float sway = sin(uTime * 1.05 + phase) * 0.55 + sin(uTime * 2.3 + phase * 1.7) * 0.18;
         transformed.x += sway * 0.045 * max(position.y, 0.0);
         transformed.z += sway * 0.028 * max(position.y, 0.0);`
      );
    };
    canopyMaterial.onBeforeCompile = patch;

    const positions = [];
    const rng = (() => {
      let seed = 90210;
      return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
    })();

    // Willows along the causeways and the near shore: the two places a visitor
    // actually sees trees from the opening shot.
    const causewayTreeStart = positions.length;
    for (const causeway of CAUSEWAYS) {
      const steps = Math.round(Math.hypot(causeway.b[0] - causeway.a[0], causeway.b[1] - causeway.a[1]) / 26);
      for (let i = 0; i < steps; i += 1) {
        const t = i / steps;
        const x = THREE.MathUtils.lerp(causeway.a[0], causeway.b[0], t);
        const z = THREE.MathUtils.lerp(causeway.a[1], causeway.b[1], t);
        const side = rng() > 0.5 ? 1 : -1;
        const offset = (causeway.half - 2) * side * (0.5 + rng() * 0.5);
        const dx = causeway.b[0] - causeway.a[0];
        const dz = causeway.b[1] - causeway.a[1];
        const len = Math.hypot(dx, dz) || 1;
        positions.push({ x: x + (-dz / len) * offset, z: z + (dx / len) * offset, scale: 0.8 + rng() * 0.5 });
      }
    }
    const causewayTreeEnd = positions.length;
    for (const island of ISLANDS) {
      const count = island.r > 150 ? 46 : 10;
      for (let i = 0; i < count; i += 1) {
        const angle = rng() * Math.PI * 2;
        const rad = Math.sqrt(rng()) * island.r * 0.72;
        positions.push({ x: island.x + Math.cos(angle) * rad, z: island.z + Math.sin(angle) * rad, scale: 0.75 + rng() * 0.6 });
      }
    }
    // A denser ring of trees just outside the shoreline.
    for (let i = 0; i < tiers.trees; i += 1) {
      const angle = rng() * Math.PI * 2;
      const rad = 1150 + Math.sqrt(rng()) * 3200;
      const x = Math.cos(angle) * rad;
      const z = Math.sin(angle) * rad;
      if (lakeSignedDistance(x, z) > 18 && heightAt(x, z) < 70) positions.push({ x, z, scale: 0.7 + rng() * 0.8 });
    }

    const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, positions.length);
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, positions.length);
    canopies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();
    positions.forEach((tree, index) => {
      const h = surfaceAt(tree.x, tree.z);
      const size = 19 * tree.scale;
      const yaw = rng() * Math.PI * 2;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      matrix.compose(
        new THREE.Vector3(tree.x, h, tree.z),
        quaternion,
        new THREE.Vector3(size * 0.62, size, size * 0.62)
      );
      canopies.setMatrixAt(index, matrix);
      matrix.compose(
        new THREE.Vector3(tree.x, h, tree.z),
        quaternion,
        new THREE.Vector3(size * 0.16, size * 0.62, size * 0.16)
      );
      trunks.setMatrixAt(index, matrix);
      // Three species: spring green, deep pine, and the flowering peach that
      // lines 苏堤 and 白堤 in April. The pink is what makes the map read as
      // West Lake in spring rather than "a lake somewhere".
      // 苏堤春晓 and 白堤 are lined with flowering peach, so the causeway
      // rows bloom harder than the woodland behind them.
      const onCauseway = index >= causewayTreeStart && index < causewayTreeEnd;
      const roll = rng();
      const base = onCauseway
        ? (roll < 0.52 ? 0xef9fbc : roll < 0.82 ? 0x5da34a : 0x2f6b3c)
        : (roll < 0.6 ? 0x5da34a : roll < 0.86 ? 0x2f6b3c : 0xf0a1bd);
      color.setHex(base).offsetHSL((rng() - 0.5) * 0.04, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.09);
      canopies.setColorAt(index, color);
    });
    canopies.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    // Without this the instance colours never reach the GPU and every canopy
    // renders black.
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    canopies.name = 'trees';
    trunks.castShadow = false;
    canopies.castShadow = true;
    group.add(canopies, trunks);
    track(canopyGeometry);
    track(trunkGeometry);
    track(canopyMaterial);
    track(trunkMaterial);
    return { canopies, trunks, timeUniform, positions };
  })();

  // --- hero landmarks ------------------------------------------------------

  /** 雷峰塔: five tapering eaves on an octagonal core, with a lit gallery. */
  function buildLeifeng() {
    const pagoda = new THREE.Group();
    const lacquer = new THREE.MeshLambertMaterial({ color: C.lacquer });
    const wall = new THREE.MeshLambertMaterial({ color: 0xd8c8a8 });
    const tile = new THREE.MeshLambertMaterial({ color: C.roofTile, flatShading: true });
    const glint = new THREE.MeshBasicMaterial({ color: 0xffcf8a });
    [lacquer, wall, tile, glint].forEach(track);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 15, 7, 8), new THREE.MeshLambertMaterial({ color: 0xb8b2a4 }));
    base.position.y = 3.5;
    base.castShadow = true;
    base.receiveShadow = true;
    track(base.geometry);
    track(base.material);
    pagoda.add(base);

    let y = 7;
    let radius = 10.4;
    for (let tier = 0; tier < 5; tier += 1) {
      const height = tier === 0 ? 10.5 : 8.4 - tier * 0.5;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, height, 8), wall);
      body.position.y = y + height / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      pagoda.add(body);

      // The gallery: a ring of small lit windows around each tier.
      const windows = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.915, radius * 0.915, height * 0.34, 8, 1, true), glint);
      windows.position.y = y + height * 0.52;
      pagoda.add(windows);

      // The eave: a shallow cone with a kicked-up rim, which is what makes a
      // Chinese pagoda silhouette read at 40 px.
      const eave = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius * 1.42, 1.5, 8, 1), tile);
      eave.position.y = y + height + 0.4;
      eave.castShadow = true;
      pagoda.add(eave);
      const upturn = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.32, 0.34, 4, 16), tile);
      upturn.rotation.x = Math.PI / 2;
      upturn.position.y = y + height + 1.1;
      pagoda.add(upturn);

      y += height + 1.2;
      radius *= 0.86;
    }

    // Finial: stacked rings and a gilded spire.
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 7.5, 6), new THREE.MeshLambertMaterial({ color: C.gold }));
    spire.position.y = y + 3.7;
    pagoda.add(spire);
    for (let ring = 0; ring < 5; ring += 1) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1.4 - ring * 0.1, 0.16, 4, 12), spire.material);
      r.rotation.x = Math.PI / 2;
      r.position.y = y + 1.6 + ring * 1.1;
      pagoda.add(r);
    }
    pagoda.traverse(node => {
      if (node.isMesh) node.castShadow = true;
    });
    return pagoda;
  }

  /** 保俶塔: the slender brick spire on 宝石山. */
  function buildBaochu() {
    const pagoda = new THREE.Group();
    const brick = new THREE.MeshLambertMaterial({ color: 0xb9ab92, flatShading: true });
    track(brick);
    let y = 0;
    let radius = 2.6;
    for (let tier = 0; tier < 7; tier += 1) {
      const height = 4.2 - tier * 0.28;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.94, radius, height, 8), brick);
      body.position.y = y + height / 2;
      body.castShadow = true;
      pagoda.add(body);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.25, radius * 1.25, 0.3, 8), brick);
      ring.position.y = y + height;
      pagoda.add(ring);
      y += height + 0.32;
      radius *= 0.9;
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 8), brick);
    tip.position.y = y + 1.8;
    pagoda.add(tip);
    return pagoda;
  }

  /** 三潭印月: three stone lanterns floating south of the island. */
  function buildThreePools() {
    const stone = new THREE.MeshLambertMaterial({ color: 0xa8a396, flatShading: true });
    track(stone);
    const trio = new THREE.Group();
    const pool = (x, z) => {
      const tower = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 1.1, 8), stone);
      base.position.y = 0.3;
      const body = new THREE.Mesh(new THREE.SphereGeometry(2.1, 10, 8), stone);
      body.position.y = 2.2;
      body.scale.y = 0.85;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.6, 8), stone);
      neck.position.y = 4.1;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.4, 8), stone);
      cap.position.y = 5.4;
      // The five round openings that give the place its name.
      for (let i = 0; i < 5; i += 1) {
        const hole = new THREE.Mesh(
          new THREE.CircleGeometry(0.38, 8),
          new THREE.MeshBasicMaterial({ color: 0x2a2118 })
        );
        const angle = (i / 5) * Math.PI * 2;
        hole.position.set(Math.cos(angle) * 1.85, 2.2, Math.sin(angle) * 1.85);
        hole.lookAt(new THREE.Vector3(Math.cos(angle) * 4, 2.2, Math.sin(angle) * 4));
        tower.add(hole);
        track(hole.material);
        track(hole.geometry);
      }
      tower.add(base, body, neck, cap);
      tower.position.set(x, 0, z);
      return tower;
    };
    trio.add(pool(-70, 120), pool(0, 168), pool(64, 96));
    return trio;
  }

  /** 断桥: a low stone arch with a balustrade, carrying 白堤. */
  function buildBrokenBridge() {
    const bridge = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: 0xbcb6a6, flatShading: true });
    track(stone);
    const span = 42;
    const width = 9;
    const segments = 16;
    const deck = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const x = (t - 0.5) * span;
      const y = Math.sin(t * Math.PI) * 3.4;
      deck.push([x, y]);
      const block = new THREE.Mesh(new THREE.BoxGeometry(span / segments + 0.4, 1.2, width), stone);
      block.position.set(x, y - 0.55, 0);
      block.castShadow = true;
      block.receiveShadow = true;
      bridge.add(block);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < deck.length - 1; i += 1) {
        const [x0, y0] = deck[i];
        const [x1, y1] = deck[i + 1];
        const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0), 1.1, 0.4), stone);
        rail.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.75, (side * width) / 2);
        rail.rotation.z = Math.atan2(y1 - y0, x1 - x0);
        bridge.add(rail);
      }
      for (const [x, y] of deck) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.7), stone);
        post.position.set(x, y + 0.75, (side * width) / 2);
        bridge.add(post);
      }
    }
    return bridge;
  }

  /** A Hangzhou hall: white walls, dark tile roof, upturned eaves. */
  function buildHall({ width = 16, depth = 11, height = 5.4, roof = C.roofTile, walls = C.wallWhite } = {}) {
    const hall = new THREE.Group();
    const wallMaterial = new THREE.MeshLambertMaterial({ color: walls });
    const roofMaterial = new THREE.MeshLambertMaterial({ color: roof, flatShading: true });
    track(wallMaterial);
    track(roofMaterial);
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    hall.add(body);

    const roofGeometry = new THREE.ConeGeometry(width * 0.78, height * 0.85, 4);
    roofGeometry.rotateY(Math.PI / 4);
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    roofMesh.position.y = height + height * 0.42;
    roofMesh.scale.set(1, 1, depth / width);
    roofMesh.castShadow = true;
    hall.add(roofMesh);
    track(roofGeometry);
    return hall;
  }

  const landmarkExtras = new THREE.Group();
  landmarkExtras.name = 'landmarks';
  group.add(landmarkExtras);

  const leifeng = buildLeifeng();
  {
    const p = geoToLocal(30.2317, 120.1492);
    leifeng.position.set(p.x, surfaceAt(p.x, p.z), p.z);
    leifeng.rotation.y = -0.35;
    landmarkExtras.add(leifeng);
  }
  {
    const p = geoToLocal(30.2601, 120.1442);
    const baochu = buildBaochu();
    baochu.position.set(p.x, surfaceAt(p.x, p.z), p.z);
    landmarkExtras.add(baochu);
  }
  {
    const p = geoToLocal(30.2274, 120.1431);
    const pools = buildThreePools();
    pools.position.set(p.x, 0.3, p.z);
    landmarkExtras.add(pools);
  }
  {
    const p = geoToLocal(30.2592, 120.1483);
    const bridge = buildBrokenBridge();
    bridge.position.set(p.x, 1.85, p.z);
    bridge.rotation.y = 0.14;
    landmarkExtras.add(bridge);
  }
  // 湖心亭 and 小瀛洲 pavilions, plus a few halls on the north shore.
  for (const [lat, lon, opts] of [
    [30.2455, 120.1445, { width: 11, depth: 8, height: 4.4, roof: 0x5b6b6f }],
    [30.2295, 120.1425, { width: 15, depth: 10, height: 5, roof: 0x545f66 }],
    [30.2566, 120.1392, { width: 20, depth: 12, height: 6, roof: 0x4c5359 }],
    [30.2540, 120.1560, { width: 17, depth: 11, height: 5.5, roof: 0x55544a }],
  ]) {
    const p = geoToLocal(lat, lon);
    const hall = buildHall(opts);
    hall.position.set(p.x, Math.max(1.6, surfaceAt(p.x, p.z)), p.z);
    hall.rotation.y = (lat * 37) % 1.2;
    landmarkExtras.add(hall);
  }

  // --- city ---------------------------------------------------------------
  // Instanced blocks east and north of the lake: enough to read as Hangzhou
  // from 800 m, cheap enough to keep the draw call count flat.
  const city = (() => {
    const wallGeometry = track(new THREE.BoxGeometry(1, 1, 1));
    wallGeometry.translate(0, 0.5, 0);
    const roofGeometry = track(new THREE.ConeGeometry(0.78, 0.55, 4));
    roofGeometry.rotateY(Math.PI / 4);
    roofGeometry.translate(0, 1, 0);

    const wallMaterial = track(new THREE.MeshLambertMaterial({ color: 0xd9d2c2 }));
    const roofMaterial = track(new THREE.MeshLambertMaterial({ color: 0x6a7278, flatShading: true }));
    // main town + a dense shoreline ring (see the second pass below)
    const count = Math.round(tiers.buildings * 1.85);
    const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, count);
    const roofs = new THREE.InstancedMesh(roofGeometry, roofMaterial, count);
    const rng = (() => {
      let seed = 424242;
      return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
    })();

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 40) {
      guard += 1;
      const angle = rng() * Math.PI * 2;
      const rad = 980 + Math.pow(rng(), 0.62) * 4600;
      const x = Math.cos(angle) * rad + 400;
      const z = Math.sin(angle) * rad * 0.9 + 200;
      if (lakeSignedDistance(x, z) < 90) continue;
      const h = heightAt(x, z);
      if (h > 34) continue;
      const width = 34 + rng() * 58;
      const depth = 30 + rng() * 50;
      const height = 14 + rng() * 26;
      const yaw = Math.floor(rng() * 12) * (Math.PI / 6);
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      matrix.compose(
        new THREE.Vector3(x, surfaceAt(x, z), z),
        quaternion,
        new THREE.Vector3(width, height, depth)
      );
      walls.setMatrixAt(placed, matrix);
      matrix.compose(
        new THREE.Vector3(x, surfaceAt(x, z) + height, z),
        quaternion,
        new THREE.Vector3(width * 1.16, height * 0.34, depth * 1.16)
      );
      roofs.setMatrixAt(placed, matrix);
      color.setHex(0xd9d2c2).offsetHSL(0, (rng() - 0.5) * 0.06, (rng() - 0.5) * 0.08);
      walls.setColorAt(placed, color);
      placed += 1;
    }
    // A second pass that hugs the shoreline. The painted reference is mostly
    // a ring of small white houses right at the water, so this band does more
    // for the "lived-in lake" look than anything further out.
    let shoreGuard = 0;
    while (placed < count && shoreGuard < count * 60) {
      shoreGuard += 1;
      const angle = rng() * Math.PI * 2;
      const rad = 700 + Math.pow(rng(), 0.5) * 2600;
      const x = Math.cos(angle) * rad;
      const z = Math.sin(angle) * rad * 1.05;
      const sdf = lakeSignedDistance(x, z);
      if (sdf < 45 || sdf > 330) continue;
      const h = heightAt(x, z);
      if (h > 40) continue;
      const width = 22 + rng() * 34;
      const depth = 20 + rng() * 30;
      const height = 11 + rng() * 15;
      const yaw = Math.floor(rng() * 16) * (Math.PI / 8);
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      matrix.compose(
        new THREE.Vector3(x, surfaceAt(x, z), z),
        quaternion,
        new THREE.Vector3(width, height, depth)
      );
      walls.setMatrixAt(placed, matrix);
      matrix.compose(
        new THREE.Vector3(x, surfaceAt(x, z) + height, z),
        quaternion,
        new THREE.Vector3(width * 1.18, height * 0.36, depth * 1.18)
      );
      roofs.setMatrixAt(placed, matrix);
      // a few warm brick walls among the white ones
      const warm = rng() < 0.18;
      color.setHex(warm ? 0xd8b49a : 0xf1ead9).offsetHSL(0, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.06);
      walls.setColorAt(placed, color);
      placed += 1;
    }

    walls.count = placed;
    roofs.count = placed;
    walls.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
    walls.castShadow = true;
    roofs.castShadow = true;
    group.add(walls, roofs);
    return { walls, roofs };
  })();

  // --- boats ---------------------------------------------------------------
  const boats = (() => {
    const hullGeometry = (() => {
      const shape = new THREE.Shape();
      shape.moveTo(-3.2, 0);
      shape.quadraticCurveTo(-1.4, 0.9, 0, 0.95);
      shape.quadraticCurveTo(1.4, 0.9, 3.2, 0);
      shape.quadraticCurveTo(1.2, -0.55, 0, -0.6);
      shape.quadraticCurveTo(-1.2, -0.55, -3.2, 0);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.75, bevelEnabled: false, curveSegments: 6 });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, -0.35, 0);
      return track(geometry);
    })();
    const canopyGeometry = (() => {
      const geometry = new THREE.CylinderGeometry(1.35, 1.35, 4.2, 10, 1, false, 0, Math.PI);
      geometry.rotateZ(Math.PI / 2);
      geometry.scale(1, 0.55, 1);
      geometry.translate(0, 0.62, 0);
      return track(geometry);
    })();
    const hullMaterial = track(new THREE.MeshLambertMaterial({ color: 0x6b4a33 }));
    const canopyMaterial = track(new THREE.MeshLambertMaterial({ color: 0xd8cbb2, side: THREE.DoubleSide }));
    const count = 14;
    // A soft wake quad behind every boat: cheap, and it is what makes the
    // water read as being crossed rather than as a painted blue field.
    const wakeTexture = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(70, 32, 2, 70, 32, 60);
      gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.45, 'rgba(255,255,255,0.34)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 64);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return track(texture);
    })();
    const wakeGeometry = track(new THREE.PlaneGeometry(30, 10));
    wakeGeometry.rotateX(-Math.PI / 2);
    const wakeMaterial = track(
      new THREE.MeshBasicMaterial({ map: wakeTexture, transparent: true, depthWrite: false, opacity: 0.5 })
    );
    const wakes = new THREE.InstancedMesh(wakeGeometry, wakeMaterial, count);
    wakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    wakes.renderOrder = 2;
    group.add(wakes);

    const hulls = new THREE.InstancedMesh(hullGeometry, hullMaterial, count);
    const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, count);
    const routes = [];
    const rng = (() => {
      let seed = 777;
      return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
    })();
    for (let i = 0; i < count; i += 1) {
      const cx = (rng() - 0.5) * 1300;
      const cz = (rng() - 0.5) * 1700;
      const rx = 260 + rng() * 420;
      const rz = 220 + rng() * 420;
      routes.push({
        cx,
        cz,
        rx,
        rz,
        phase: rng() * Math.PI * 2,
        speed: 0.021 + rng() * 0.017,
        wobble: rng() * Math.PI * 2,
      });
    }
    hulls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    canopies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(hulls, canopies);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const wakeQuaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const wakePosition = new THREE.Vector3();
    const wakeScale = new THREE.Vector3(1, 1, 1);
    const scale = new THREE.Vector3(4.2, 4.2, 4.2);
    return {
      hulls,
      canopies,
      update(t) {
        routes.forEach((route, index) => {
          const angle = route.phase + t * route.speed;
          const x = route.cx + Math.cos(angle) * route.rx;
          const z = route.cz + Math.sin(angle) * route.rz;
          if (lakeSignedDistance(x, z) > -45) {
            hulls.setMatrixAt(index, matrix.makeScale(0, 0, 0));
            canopies.setMatrixAt(index, matrix);
            wakes.setMatrixAt(index, matrix);
            return;
          }
          const tangent = Math.atan2(-Math.sin(angle) * route.rz, Math.cos(angle) * route.rx);
          const bob = Math.sin(t * 1.7 + route.wobble) * 0.045;
          const roll = Math.sin(t * 1.3 + route.wobble) * 0.02;
          quaternion.setFromEuler(new THREE.Euler(roll, -tangent, Math.sin(t * 1.1 + route.wobble) * 0.014));
          position.set(x, bob, z);
          matrix.compose(position, quaternion, scale);
          hulls.setMatrixAt(index, matrix);
          canopies.setMatrixAt(index, matrix);

          // wake trails behind the hull, aligned with the direction of travel
          const vx = -Math.sin(angle) * route.rx;
          const vz = Math.cos(angle) * route.rz;
          const vlen = Math.hypot(vx, vz) || 1;
          wakeQuaternion.setFromEuler(new THREE.Euler(0, Math.atan2(-vz / vlen, vx / vlen), 0));
          wakePosition.set(x - (vx / vlen) * 17, 0.12, z - (vz / vlen) * 17);
          matrix.compose(wakePosition, wakeQuaternion, wakeScale);
          wakes.setMatrixAt(index, matrix);
        });
        hulls.instanceMatrix.needsUpdate = true;
        canopies.instanceMatrix.needsUpdate = true;
        wakes.instanceMatrix.needsUpdate = true;
      },
    };
  })();

  // --- birds ---------------------------------------------------------------
  // Two flocks of silhouettes over the water. They cost one draw call and one
  // matrix update per bird, and they are most of the reason the frame reads as
  // a living place rather than a model.
  const birds = (() => {
    const geometry = track(
      (() => {
        const g = new THREE.BufferGeometry();
        // A shallow V: two wing panels seen edge-on from below.
        const vertices = new Float32Array([
          -1.0, 0.0, 0.0, -0.12, 0.10, -0.22, -0.12, 0.10, 0.22,
          1.0, 0.0, 0.0, 0.12, 0.10, 0.22, 0.12, 0.10, -0.22,
        ]);
        g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        g.computeVertexNormals();
        return g;
      })()
    );
    const material = track(new THREE.MeshBasicMaterial({ color: 0x2b3f3a, side: THREE.DoubleSide }));
    const count = 16;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.name = 'birds';
    group.add(mesh);

    const rng = (() => {
      let seed = 5150;
      return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
    })();

    const flock = [];
    for (let i = 0; i < count; i += 1) {
      const flockIndex = i < 10 ? 0 : 1;
      flock.push({
        cx: flockIndex === 0 ? -320 : 640,
        cz: flockIndex === 0 ? 380 : -520,
        radius: 240 + rng() * (flockIndex === 0 ? 420 : 300),
        height: 90 + rng() * 70,
        speed: 0.055 + rng() * 0.03,
        phase: rng() * Math.PI * 2,
        offset: (rng() - 0.5) * 0.55,
        size: 1.4 + rng() * 0.9,
      });
    }

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scaleVector = new THREE.Vector3();
    const euler = new THREE.Euler();

    return {
      mesh,
      update(t) {
        flock.forEach((bird, index) => {
          const angle = bird.phase + t * bird.speed;
          const radius = bird.radius * (1 + bird.offset * 0.35);
          const x = bird.cx + Math.cos(angle) * radius;
          const z = bird.cz + Math.sin(angle) * radius;
          const y = bird.height + Math.sin(t * 0.6 + bird.phase) * 6;
          // Bank into the turn and flap: the flap is a roll, which reads at any
          // distance without needing a second geometry.
          const flap = Math.sin(t * 3.4 + bird.phase * 3) * 0.5;
          euler.set(-Math.PI / 2 + 0.12, -angle + Math.PI / 2, flap);
          quaternion.setFromEuler(euler);
          position.set(x, y, z);
          scaleVector.set(bird.size, bird.size, bird.size);
          matrix.compose(position, quaternion, scaleVector);
          mesh.setMatrixAt(index, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      },
    };
  })();

  // --- lighting ------------------------------------------------------------
  const hemisphere = new THREE.HemisphereLight(0xe2f2f7, 0x7f8a5e, 1.85);
  group.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff6e2, 2.75);
  sun.position.copy(localSun).multiplyScalar(30000);
  sun.target.position.set(0, 0, 0);
  group.add(sun, sun.target);

  if (quality !== 'low') {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    const camera = sun.shadow.camera;
    camera.left = -3600;
    camera.right = 3600;
    camera.top = 3600;
    camera.bottom = -3600;
    camera.near = 100;
    camera.far = 40000;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 2.2;
  }

  // A warm bounce from the water, so the pagoda's south face is never black.
  const bounce = new THREE.DirectionalLight(0xdff0f5, 0.5);
  bounce.position.set(-6000, -2000, 8000);
  group.add(bounce);

  const fogColor = new THREE.Color(0xdfeef2);

  // --- public API ----------------------------------------------------------
  const spotLocal = SPOTS.map(spot => {
    const local = geoToLocal(spot.lat, spot.lon);
    return { ...spot, x: local.x, z: local.z, y: Math.max(surfaceAt(local.x, local.z), 0) };
  });

  return {
    group,
    name: 'west-lake',
    originLocal: origin,
    terrain,
    water,
    boats,
    fogColor,
    spots: spotLocal,
    boundingRadius: tiers.radius,
    /** Drop a ripple where the visitor tapped, given a world-space point. */
    spawnRipple(worldPoint) {
      const local = group.worldToLocal(worldPoint.clone());
      ripples.spawn(local.x, local.z);
    },
    /** World-space position of a local point (after the group's parent rebases). */
    toWorld(x, y, z, out = new THREE.Vector3()) {
      return group.localToWorld(out.set(x, y, z));
    },
    /** World-space pose for a geographic point: what a map pin needs. */
    poseAt(lat, lon, height = 0, out = new THREE.Vector3()) {
      const local = geoToLocal(lat, lon);
      return group.localToWorld(out.set(local.x, Math.max(surfaceAt(local.x, local.z), 0) + height, local.z));
    },
    update(dt, elapsed, camera) {
      waterUniforms.uTime.value = elapsed;
      // The water shades in local metres, so the camera has to be carried into
      // that frame before it can be used for the view vector.
      group.updateMatrixWorld();
      cameraLocal.copy(camera.position);
      group.worldToLocal(cameraLocal);
      waterUniforms.uCameraLocal.value.copy(cameraLocal);
      // The sky dome is only meaningful inside the apron; from orbit the real
      // atmosphere shell takes over and the dome would read as a bubble.
      sky.visible = cameraLocal.length() < 60000;
      skyUniforms.uTime.value = elapsed;
      trees.timeUniform.value = elapsed;
      boats.update(elapsed);
      birds.update(elapsed);
      ripples.update(dt);
    },
    /**
     * Two lighting presets. The sun does not actually move (a moving sun in a
     * five-second visit is noise), but the sky, the water and the fill light
     * switch together so the toggle reads as a time of day, not a filter.
     */
    setTimeOfDay(mode) {
      const dusk = mode === 'dusk';
      const palette = dusk ? DUSK_SKY : DAY_SKY;
      skyUniforms.uHorizon.value.setHex(palette.horizon);
      skyUniforms.uMid.value.setHex(palette.mid);
      skyUniforms.uZenith.value.setHex(palette.zenith);
      skyUniforms.uClouds.value = dusk ? 0.5 : 0.72;

      hemisphere.color.setHex(dusk ? 0xb9c8d6 : 0xe2f2f7);
      hemisphere.groundColor.setHex(dusk ? 0x5c5c46 : 0x7f8a5e);
      hemisphere.intensity = dusk ? 1.0 : 1.85;
      sun.color.setHex(dusk ? 0xffc48a : 0xfff6e2);
      sun.intensity = dusk ? 2.0 : 2.75;
      bounce.color.setHex(dusk ? 0xffcfa0 : 0xdff0f5);
      bounce.intensity = dusk ? 0.35 : 0.5;

      waterUniforms.uDeep.value.setHex(dusk ? 0x143c4a : 0x147d96);
      waterUniforms.uShallow.value.setHex(dusk ? 0x4d8b8c : 0x63c6c9);
      waterUniforms.uSkyTop.value.setHex(dusk ? 0x6d94a6 : 0x8fc6e2);
      waterUniforms.uSkyHorizon.value.setHex(dusk ? 0xcbbfa6 : 0xe8ecd8);

      return dusk ? new THREE.Color(0xc2cec9) : new THREE.Color(0xdfeef2);
    },
    dispose() {
      disposables.forEach(item => item.dispose?.());
      group.traverse(node => {
        if (node.isInstancedMesh) node.dispose();
      });
    },
  };
}
