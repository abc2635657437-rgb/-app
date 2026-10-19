// Detailed landmark models for the West Lake plate.
//
// The first pass built every landmark out of stacked boxes: it read as a block
// model the moment you flew down to one. These build the shapes that actually
// identify each place — the outward-curving eaves of a pagoda, the arch of the
// Broken Bridge, the pierced body of a stone lantern, the hipped roof of a
// Jiangnan hall.
//
// Every geometry and material is handed to `track` so the scene can dispose
// them; nothing here allocates state outside the returned group.

import * as THREE from '/modules/vendor/three/three.module.js';


/** Canvas textures: everything here is drawn at runtime, so there is no asset
 *  download and no licence to track. Kept small (256²) because they tile. */
function makeCanvas(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

function toTexture(canvas, repeat = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Barrel tiles: rows of half-rounds with a highlight on each ridge. */
function roofTileTexture() {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = '#3b454e';
  ctx.fillRect(0, 0, 256, 256);
  const row = 32;
  for (let y = 0; y < 256; y += row) {
    for (let x = 0; x < 256; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#2b333a');
      g.addColorStop(0.45, '#5b6772');
      g.addColorStop(0.6, '#6d7a86');
      g.addColorStop(1, '#2b333a');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 16, row);
    }
    ctx.fillStyle = 'rgba(20,24,28,0.55)';
    ctx.fillRect(0, y + row - 3, 256, 3);
  }
  // weathering
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = 'rgba(120,130,120,' + (Math.random() * 0.06).toFixed(3) + ')';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  return toTexture(canvas, 3);
}

/** Lime plaster: warm, slightly mottled, with damp staining near the base. */
function plasterTexture() {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = '#e6d7b6';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i += 1) {
    const shade = Math.random() > 0.5 ? 255 : 180;
    ctx.fillStyle = 'rgba(' + shade + ',' + (shade - 12) + ',' + (shade - 40) + ',' + (Math.random() * 0.05).toFixed(3) + ')';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const g = ctx.createLinearGradient(0, 200, 0, 256);
  g.addColorStop(0, 'rgba(120,110,90,0)');
  g.addColorStop(1, 'rgba(110,100,80,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 200, 256, 56);
  return toTexture(canvas, 2);
}

/** Cut stone: mottled grey with a faint course line. */
function stoneTexture() {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = '#b6b1a2';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i += 1) {
    ctx.fillStyle = 'rgba(90,88,80,' + (Math.random() * 0.08).toFixed(3) + ')';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.strokeStyle = 'rgba(80,78,70,0.35)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  return toTexture(canvas, 2);
}

const PALETTE = {
  roofTile: 0x4c5a63,
  roofRidge: 0x39464f,
  wallWhite: 0xf3efe3,
  wallShade: 0xe2dccb,
  lacquer: 0xa8402a,
  wood: 0x8a5836,
  gold: 0xd8b168,
  stone: 0xbdb7a7,
  stoneDark: 0x9a9486,
  glow: 0xffcf8a,
};

/**
 * An eave: a lathe-turned surface whose profile flares out and turns up at the
 * rim. Eight radial segments keep the octagonal footprint of a pagoda.
 */
function makeEave(radius, rise, track, material, segments = 8) {
  const points = [];
  const steps = 9;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    // A Chinese eave runs outward much further than it rises: nearly flat for
    // the first two thirds, then lifting into an upturned lip.
    const r = radius * (0.5 + 1.1 * t);
    const y = rise * (0.62 * t + 0.38 * Math.pow(t, 2.6));
    points.push(new THREE.Vector2(r, y));
  }
  // the fascia: a short drop at the rim gives the roof visible thickness
  points.push(new THREE.Vector2(radius * 1.55, rise - rise * 0.28));
  const geometry = new THREE.LatheGeometry(points, segments);
  track(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A ring of small dark openings, the gallery windows of each storey. */
function makeGallery(radius, height, track, material, segments = 8) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
  track(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height / 2;
  return mesh;
}

function buildPagoda({ tiers = 5, baseRadius = 11, tierHeight = 8, track }) {
  const group = new THREE.Group();
  // Standard materials so the tile catches a highlight and the plaster stays
  // matte; flat colour is what made the first version read as plastic.
  const wall = new THREE.MeshStandardMaterial({ color: 0xe8d9b8, map: plasterTexture(), roughness: 0.92, metalness: 0 });
  const tile = new THREE.MeshStandardMaterial({ color: 0xffffff, map: roofTileTexture(), roughness: 0.55, metalness: 0.12, side: THREE.DoubleSide });
  const ridge = new THREE.MeshStandardMaterial({ color: 0x2f3a42, roughness: 0.5, metalness: 0.15, flatShading: true });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x8f3a26, roughness: 0.6, metalness: 0.05 });
  const gold = new THREE.MeshLambertMaterial({ color: PALETTE.gold });
  const glow = new THREE.MeshLambertMaterial({ color: 0x2b2f30 });
  [wall, tile, ridge, lacquer, gold, glow].forEach(track);

  // --- stepped stone platform ---
  let y = 0;
  const platform = [
    [baseRadius * 1.9, 1.5],
    [baseRadius * 1.62, 1.3],
    [baseRadius * 1.34, 1.1],
  ];
  for (const [radius, height] of platform) {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.02, height, 8), track(new THREE.MeshStandardMaterial({ color: 0xffffff, map: stoneTexture(), roughness: 0.95 })) || new THREE.MeshLambertMaterial({ color: PALETTE.stone }));
    track(step.geometry);
    step.position.y = y + height / 2;
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
    y += height;
  }

  // --- storeys ---
  let radius = baseRadius;
  for (let tier = 0; tier < tiers; tier += 1) {
    const height = tier === 0 ? tierHeight * 1.2 : tierHeight * (1 - tier * 0.06);
    const taper = 0.93;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * taper, radius, height, 8), wall);
    track(body.geometry);
    body.position.y = y + height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // veranda floor ring: gives each storey a shadow line
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, height * 0.06, 8), ridge);
    track(ring.geometry);
    ring.position.y = y + height * 0.03;
    group.add(ring);

    // lit gallery
    const gallery = makeGallery(radius * taper * 1.005, height * 0.30, track, glow);
    gallery.position.y = y + height * 0.46;
    group.add(gallery);

    // bracket band (dougong) under the eave
    const band = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.05, radius * 1.02, height * 0.1, 8), lacquer);
    track(band.geometry);
    band.position.y = y + height - height * 0.05;
    group.add(band);

    // eave, sitting on top of the storey and overhanging it
    const eave = makeEave(radius * 1.35, height * 0.62, track, tile);
    eave.position.y = y + height;
    group.add(eave);

    // 翼角: the corners lift away from the roof plane. Eight small swept horns
    // do more for the silhouette than any amount of extra body geometry.
    for (let corner = 0; corner < 8; corner += 1) {
      const angle = (corner / 8) * Math.PI * 2 + Math.PI / 8;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.17, height * 0.3, 4), ridge);
      track(horn.geometry);
      horn.position.set(
        Math.cos(angle) * radius * 1.28,
        y + height + height * 0.34,
        Math.sin(angle) * radius * 1.28
      );
      // lean outward so it continues the roof's curve rather than stabbing it
      horn.rotation.z = Math.cos(angle) * 0.34;
      horn.rotation.x = -Math.sin(angle) * 0.34;
      group.add(horn);
    }

    // ridge line under each eave corner reads as structure at distance
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, height * 0.12, 8), lacquer);
    track(drum.geometry);
    drum.position.y = y + height + height * 0.06;
    group.add(drum);

    y += height + height * 0.12;
    radius *= 0.86;
  }

  // --- finial ---
  const finial = new THREE.Group();
  const spireBase = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.72, 1.4, 8), ridge);
  track(spireBase.geometry);
  spireBase.position.y = 0.7;
  finial.add(spireBase);

  for (let i = 0; i < 4; i += 1) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(radius * (0.34 - i * 0.05), 10, 8), gold);
    track(bead.geometry);
    bead.position.y = 1.6 + i * 1.25;
    finial.add(bead);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius * (0.12 - i * 0.02), radius * (0.12 - i * 0.02), 0.22, 8), gold);
    track(collar.geometry);
    collar.position.y = 2.2 + i * 1.25;
    finial.add(collar);
  }

  const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.34, 3.2, 6), gold);
  track(spike.geometry);
  spike.position.y = 7.4;
  finial.add(spike);

  finial.position.y = y;
  group.add(finial);

  return group;
}

function buildBridge({ track }) {
  // The Broken Bridge is a single stone arch with a shallow hump. Extruding a
  // profile with a hole gives the opening and the spandrels in one piece, which
  // is what the stacked boxes could never read as.
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xffffff, map: stoneTexture(), roughness: 0.95, metalness: 0 });
  const coping = new THREE.MeshStandardMaterial({ color: 0xa8a294, roughness: 0.9 });
  [stone, coping].forEach(track);

  const span = 44;
  const halfSpan = span / 2;
  const width = 9.5;
  const hump = 4.2;
  const archRadius = 11.5;

  const shape = new THREE.Shape();
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = -halfSpan + span * t;
    const y = Math.sin(t * Math.PI) * hump;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.lineTo(halfSpan, -1.2);
  shape.lineTo(-halfSpan, -1.2);
  shape.closePath();

  const arch = new THREE.Path();
  arch.absarc(0, -1.2, archRadius, 0, Math.PI, false);
  shape.holes.push(arch);

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 24 });
  track(geometry);
  const body = new THREE.Mesh(geometry, stone);
  body.rotation.x = 0;
  body.position.set(0, 0, -width / 2);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // parapets that follow the hump
  for (const side of [-1, 1]) {
    const rail = new THREE.Shape();
    const railSteps = 20;
    for (let i = 0; i <= railSteps; i += 1) {
      const t = i / railSteps;
      const x = -halfSpan + span * t;
      const y = Math.sin(t * Math.PI) * hump;
      if (i === 0) rail.moveTo(x, y);
      else rail.lineTo(x, y);
    }
    for (let i = railSteps; i >= 0; i -= 1) {
      const t = i / railSteps;
      const x = -halfSpan + span * t;
      const y = Math.sin(t * Math.PI) * hump + 1.15;
      rail.lineTo(x, y);
    }
    rail.closePath();
    const railGeometry = new THREE.ExtrudeGeometry(rail, { depth: 0.6, bevelEnabled: false, curveSegments: 16 });
    track(railGeometry);
    const railMesh = new THREE.Mesh(railGeometry, coping);
    railMesh.position.set(0, 0, side > 0 ? width / 2 - 0.6 : -width / 2);
    railMesh.castShadow = true;
    group.add(railMesh);
  }

  // youbai: the shallow steps up each ramp
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) {
      const t = 0.06 + i * 0.055;
      const x = side * halfSpan * (1 - 2 * t);
      const y = Math.sin(t * Math.PI) * hump;
      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.32, width * 0.82), coping);
      track(stepMesh.geometry);
      stepMesh.position.set(x, y + 0.16, 0);
      group.add(stepMesh);
    }
  }

  return group;
}

function buildStoneLantern({ track }) {
  // 三潭印月: a stone pagoda lantern standing in the water — bulbous body,
  // five openings, a small finial.
  const group = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: PALETTE.stone, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: PALETTE.stoneDark, flatShading: true });
  const glow = new THREE.MeshBasicMaterial({ color: PALETTE.glow });
  [stone, dark, glow].forEach(track);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 0.9, 12), dark);
  track(base.geometry);
  base.position.y = 0.45;
  base.castShadow = true;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.5, 12), stone);
  track(stem.geometry);
  stem.position.y = 1.65;
  group.add(stem);

  // the pierced body: a lathe profile that swells like a lantern
  const profile = [];
  const bulbSteps = 12;
  for (let i = 0; i <= bulbSteps; i += 1) {
    const t = i / bulbSteps;
    const r = 0.4 + Math.sin(t * Math.PI) * 1.55;
    profile.push(new THREE.Vector2(r, t * 2.6));
  }
  const bulbGeometry = new THREE.LatheGeometry(profile, 14);
  track(bulbGeometry);
  const bulb = new THREE.Mesh(bulbGeometry, stone);
  bulb.position.y = 2.4;
  bulb.castShadow = true;
  group.add(bulb);

  // five openings, evenly spaced — the "three pools mirroring the moon" glow
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    const opening = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), glow);
    track(opening.geometry);
    opening.position.set(Math.cos(angle) * 1.52, 3.7, Math.sin(angle) * 1.52);
    opening.lookAt(0, 3.7, 0);
    group.add(opening);
  }

  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.1, 12), dark);
  track(cap.geometry);
  cap.position.y = 5.55;
  cap.castShadow = true;
  group.add(cap);

  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), stone);
  track(tip.geometry);
  tip.position.y = 6.25;
  group.add(tip);

  return group;
}

function buildHall({ width = 16, depth = 11, height = 5.4, roof = PALETTE.roofTile, walls = PALETTE.wallWhite } = {}, { track } = {}) {
  const hall = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({ color: walls, map: plasterTexture(), roughness: 0.92 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: roofTileTexture(), roughness: 0.55, metalness: 0.12 });
  const woodMaterial = new THREE.MeshLambertMaterial({ color: PALETTE.wood });
  const stoneMaterial = new THREE.MeshLambertMaterial({ color: PALETTE.stoneDark });
  [wallMaterial, roofMaterial, woodMaterial, stoneMaterial].forEach(track);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 2.4, 0.8, depth + 2.4), stoneMaterial);
  track(plinth.geometry);
  plinth.position.y = 0.4;
  plinth.receiveShadow = true;
  hall.add(plinth);

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
  track(body.geometry);
  body.position.y = 0.8 + height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  hall.add(body);

  // veranda posts, the thing that makes a hall read as timber rather than a box
  const postGeometry = new THREE.CylinderGeometry(0.22, 0.22, height, 6);
  track(postGeometry);
  for (const zx of [-1, 1]) {
    for (let i = 0; i <= 4; i += 1) {
      const post = new THREE.Mesh(postGeometry, woodMaterial);
      post.position.set(-width / 2 + (width * i) / 4, 0.8 + height / 2, zx * (depth / 2 + 0.5));
      post.castShadow = true;
      hall.add(post);
    }
  }

  // hipped roof: a four-sided pyramid, slightly oversailing
  // The roof overhangs the walls by a little, not by a lot: a cone that is
  // wider than the building reads as a floating plate.
  const roofHeight = Math.min(width, depth) * 0.42;
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(width * 0.72, roofHeight, 4), roofMaterial);
  track(roofMesh.geometry);
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.position.y = 0.8 + height + roofHeight / 2 - 0.15;
  roofMesh.scale.z = (depth / width) * 1.08;
  roofMesh.castShadow = true;
  hall.add(roofMesh);

  // ridge
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(width * 0.5, 0.3, 0.5), roofMaterial);
  track(ridge.geometry);
  ridge.position.y = 0.8 + height + roofHeight - 0.1;
  hall.add(ridge);

  return hall;
}

function buildSlenderPagoda({ track, tiers = 7 }) {
  // 保俶塔: tall and thin, plain storeys, a long spire.
  const group = new THREE.Group();
  const wall = new THREE.MeshLambertMaterial({ color: PALETTE.wallShade });
  const ring = new THREE.MeshLambertMaterial({ color: PALETTE.stoneDark, flatShading: true });
  [wall, ring].forEach(track);

  let y = 0;
  let radius = 2.6;
  for (let tier = 0; tier < tiers; tier += 1) {
    const height = 2.6;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius, height, 8), wall);
    track(body.geometry);
    body.position.y = y + height / 2;
    body.castShadow = true;
    group.add(body);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.22, radius * 1.22, 0.28, 8), ring);
    track(brim.geometry);
    brim.position.y = y + height;
    group.add(brim);

    y += height + 0.28;
    radius *= 0.93;
  }

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 6.4, 6), ring);
  track(spire.geometry);
  spire.position.y = y + 3.2;
  group.add(spire);

  return group;
}

export function createModelKit({ track, palette = {} }) {
  const colors = { ...PALETTE, ...palette };
  return {
    leifeng: () => buildPagoda({ tiers: 5, baseRadius: 11, tierHeight: 8, track }),
    baochu: () => buildSlenderPagoda({ tiers: 7, track }),
    brokenBridge: () => buildBridge({ track }),
    stoneLantern: () => buildStoneLantern({ track }),
    hall: (options) => buildHall(options, { track }),
    colors,
  };
}
