// Explore 3D — one camera model for the whole descent.
//
// The camera is described by five numbers everywhere, at every scale:
//
//   lat, lon   the geographic point directly below the camera
//   altitude   kilometres above the surface
//   heading    which way the tilted view faces, 0 = north
//   tilt       radians off straight-down, 0 = looking at the planet's centre
//
// A flight therefore never swaps renderers or scenes: it interpolates those
// five numbers (longitude/latitude along a great circle, altitude on a
// logarithmic curve) and the same globe keeps growing until the lake fills the
// frame. That is what makes the move continuous instead of a cross-fade.

import * as THREE from '/modules/vendor/three/three.module.js';
import {
  EARTH_RADIUS,
  geoToVec3,
  northTangent,
  eastTangent,
  easeInOutCubic,
} from './globe.js';

const DEG = Math.PI / 180;
const MIN_ALTITUDE = 0.06;   // 60 m — close enough to read a roof tile
const MAX_ALTITUDE = 26000;  // 2.6 earth-radii shy of the far plane
const MAX_LAT = 85;

const GLOBE_VIEW = Object.freeze({ lat: 32, lon: 112, altitude: 11800, heading: 0, tilt: 0 });

export class ExploreCamera {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.lat = GLOBE_VIEW.lat;
    this.lon = GLOBE_VIEW.lon;
    this.altitude = GLOBE_VIEW.altitude;
    this.heading = 0;
    this.tilt = 0;

    this.mode = 'globe';
    this.flying = null;
    this.onModeChange = null;

    this._velocity = { lon: 0, lat: 0 };
    this._pointer = null;
    this._pinch = null;
    this._lastMove = 0;

    // Pointer parallax (degrees of head-turn). Sits on top of heading/tilt
    // without ever being written back into them, so dragging still behaves.
    this.parallax = { x: 0, y: 0, targetX: 0, targetY: 0 };

    this._up = new THREE.Vector3(0, 1, 0);
    this._look = new THREE.Vector3();
    this._position = new THREE.Vector3();

    this._bind();
    this.apply();
  }

  get altitudeMeters() {
    return this.altitude * 1000;
  }

  get isGlobeView() {
    return this.mode === 'globe';
  }

  // --- camera transform ----------------------------------------------------

  /** Direction from the camera to its look-at point, in world space. */
  lookDirection(out = new THREE.Vector3()) {
    return out.copy(this._look).sub(this._position).normalize();
  }

  apply() {
    const surface = geoToVec3(this.lat, this.lon, EARTH_RADIUS, new THREE.Vector3());
    const radial = surface.clone().normalize();
    this._position.copy(radial).multiplyScalar(EARTH_RADIUS + this.altitude);

    const north = northTangent(this.lat, this.lon, new THREE.Vector3());
    const east = eastTangent(this.lat, this.lon, new THREE.Vector3());

    // Where the camera aims: the ground below it, pushed forward by exactly
    // enough to produce `tilt` at the current altitude. Expressing the aim
    // point this way is what keeps the tilt constant while the altitude
    // interpolates, and it degrades gracefully to "straight down" at tilt 0.
    const lookTilt = THREE.MathUtils.clamp(this.tilt + this.parallax.y, 0, 1.22);
    const lookHeading = this.heading + this.parallax.x;
    const ahead = Math.tan(lookTilt) * Math.max(this.altitude, 0.0005);
    const forward = north.multiplyScalar(Math.cos(lookHeading)).add(east.multiplyScalar(Math.sin(lookHeading)));
    this._look.copy(surface).addScaledVector(forward, ahead);

    // A level horizon: the camera's up is the radial direction with the
    // forward component removed, so a tilted view never rolls.
    const toLook = this._look.clone().sub(this._position).normalize();
    const radialNow = this._position.clone().normalize();
    this._up.copy(radialNow).addScaledVector(toLook, -radialNow.dot(toLook));
    if (this._up.lengthSq() < 1e-6) this._up.copy(north);
    this._up.normalize();

    this.camera.position.copy(this._position);
    this.camera.up.copy(this._up);
    this.camera.lookAt(this._look);
    this.camera.near = THREE.MathUtils.clamp(this.altitude * 0.004, 0.02, 45);
    this.camera.far = Math.max(90, this.altitude * 14 + 400);
    this.camera.updateProjectionMatrix();
  }

  // --- flight --------------------------------------------------------------

  /**
   * Fly to a new camera state. The path is the shortest great circle between
   * the two ground points, with altitude on a log curve so the visual zoom rate
   * stays even (a linear altitude ramp spends most of its time near the end).
   */
  flyTo(target, { duration, arc = 0.09, onArrive } = {}) {
    const from = {
      lat: this.lat,
      lon: this.lon,
      altitude: this.altitude,
      heading: this.heading,
      tilt: this.tilt,
    };
    const to = {
      lat: target.lat ?? from.lat,
      lon: target.lon ?? from.lon,
      altitude: THREE.MathUtils.clamp(target.altitude ?? from.altitude, MIN_ALTITUDE, MAX_ALTITUDE),
      heading: target.heading ?? from.heading,
      tilt: THREE.MathUtils.clamp(target.tilt ?? from.tilt, 0, 68 * DEG),
    };

    // Shortest way round in longitude.
    let dLon = ((to.lon - from.lon + 540) % 360) - 180;

    const zoomSpan = Math.abs(Math.log(to.altitude / from.altitude));
    const travelSpan = Math.hypot((to.lat - from.lat) * 111, dLon * 111 * Math.cos(((from.lat + to.lat) / 2) * DEG));
    const autoDuration = THREE.MathUtils.clamp(2400 + zoomSpan * 900 + travelSpan * 0.55, 2200, 8200);

    this.flying = {
      from,
      to,
      dLon,
      started: performance.now(),
      duration: duration ?? autoDuration,
      arc,
      onArrive,
    };
    this._velocity.lon = 0;
    this._velocity.lat = 0;
    return this.flying;
  }

  get flightProgress() {
    if (!this.flying) return 1;
    return THREE.MathUtils.clamp((performance.now() - this.flying.started) / this.flying.duration, 0, 1);
  }

  _stepFlight(now) {
    const f = this.flying;
    const raw = THREE.MathUtils.clamp((now - f.started) / f.duration, 0, 1);
    const t = easeInOutCubic(raw);

    this.lat = THREE.MathUtils.lerp(f.from.lat, f.to.lat, t);
    this.lon = f.from.lon + f.dLon * t;

    const logAlt = THREE.MathUtils.lerp(Math.log(f.from.altitude), Math.log(f.to.altitude), t);
    // A slight lift at the start: the camera pulls back a touch before it
    // dives, which reads as a considered move rather than a zoom slider.
    const lift = 1 + f.arc * Math.sin(Math.PI * Math.pow(raw, 0.65)) * (1 - raw * 0.35);
    this.altitude = Math.exp(logAlt) * lift;

    const tiltEase = easeInOutCubic(THREE.MathUtils.clamp((raw - 0.18) / 0.82, 0, 1));
    this.tilt = THREE.MathUtils.lerp(f.from.tilt, f.to.tilt, tiltEase);

    const headingDelta = ((f.to.heading - f.from.heading + 540) % 360) - 180;
    this.heading = f.from.heading + headingDelta * tiltEase;

    if (raw >= 1) {
      this.lat = f.to.lat;
      this.lon = f.to.lon;
      this.altitude = f.to.altitude;
      this.tilt = f.to.tilt;
      this.heading = f.to.heading;
      this.flying = null;
      this.setMode(this.altitude > EARTH_RADIUS * 0.2 ? 'globe' : 'local');
      this.apply();
      f.onArrive?.();
      return true;
    }
    return false;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.onModeChange?.(mode);
  }

  cancelFlight() {
    this.flying = null;
  }

  // --- input ---------------------------------------------------------------

  _bind() {
    const el = this.dom;
    const pointerDown = event => {
      if (event.button !== undefined && event.button > 0 && event.pointerType === 'mouse') return;
      if (this.flying) this.cancelFlight();
      this._pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0, at: performance.now() };
      this._velocity.lon = 0;
      this._velocity.lat = 0;
      try {
        el.setPointerCapture?.(event.pointerId);
      } catch (_) {
        /* synthetic or already-released pointers have no capture target */
      }
      el.classList.add('is-dragging');
    };
    const pointerMove = event => {
      if (!this._pointer || this._pointer.id !== event.pointerId) return;
      const dx = event.clientX - this._pointer.x;
      const dy = event.clientY - this._pointer.y;
      this._pointer.x = event.clientX;
      this._pointer.y = event.clientY;
      this._pointer.moved += Math.abs(dx) + Math.abs(dy);
      this.pan(dx, dy);
      this._velocity.lon = dx;
      this._velocity.lat = dy;
      this._lastMove = performance.now();
    };
    const pointerUp = event => {
      if (!this._pointer || this._pointer.id !== event.pointerId) return;
      this._pointer = null;
      el.classList.remove('is-dragging');
      if (performance.now() - this._lastMove > 120) this._velocity.lon = this._velocity.lat = 0;
    };

    el.addEventListener('pointerdown', pointerDown);
    el.addEventListener('pointermove', pointerMove);
    el.addEventListener('pointerup', pointerUp);
    el.addEventListener('pointercancel', pointerUp);

    el.addEventListener(
      'wheel',
      event => {
        event.preventDefault();
        if (this.flying) this.cancelFlight();
        const step = Math.exp(THREE.MathUtils.clamp(event.deltaY, -120, 120) * 0.0016);
        this.zoom(step);
      },
      { passive: false }
    );

    // Two-finger pinch on touch: altitude only, like every map the visitor has
    // used. One finger orbit/pan is handled by the pointer events above.
    const touchState = { distance: 0, center: null };
    el.addEventListener(
      'touchstart',
      event => {
        if (event.touches.length !== 2) return;
        this._pointer = null;
        const [a, b] = event.touches;
        touchState.distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        touchState.center = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      },
      { passive: true }
    );
    el.addEventListener(
      'touchmove',
      event => {
        if (event.touches.length !== 2 || !touchState.distance) return;
        event.preventDefault();
        const [a, b] = event.touches;
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (touchState.distance > 4) this.zoom(touchState.distance / distance);
        touchState.distance = distance;
      },
      { passive: false }
    );
    el.addEventListener('touchend', () => {
      touchState.distance = 0;
    });
  }

  /** Drag: rotate the globe under the camera, or orbit the local scene. */
  pan(dx, dy) {
    if (this.tilt < 0.02) {
      // Straight-down view: the drag is a rotation of the planet. The rate
      // follows the visible ground width, so a drag covers the same fraction
      // of the frame whether the camera is 20 000 km or 600 m up.
      const width = Math.max(this.dom.clientWidth || 800, 320);
      const degPerPx = (this.altitude * 0.85) / (111 * width);
      const cosLat = Math.max(Math.cos(this.lat * DEG), 0.12);
      this.lon -= (dx * degPerPx) / cosLat;
      this.lat = THREE.MathUtils.clamp(this.lat + dy * degPerPx, -MAX_LAT, MAX_LAT);
      this.lon = ((this.lon + 540) % 360) - 180;
    } else {
      const rate = 0.0042;
      this.heading -= dx * rate;
      this.tilt = THREE.MathUtils.clamp(this.tilt + dy * rate * 0.62, 2 * DEG, 70 * DEG);
    }
    this.apply();
  }

  zoom(factor) {
    const next = THREE.MathUtils.clamp(this.altitude * factor, MIN_ALTITUDE, MAX_ALTITUDE);
    this.altitude = next;
    if (this.altitude > EARTH_RADIUS * 0.2) {
      this.tilt *= 0.55;
      if (this.mode === 'local') this.setMode('globe');
    }
    this.apply();
  }

  /** Ease the pointer parallax toward where the cursor is. */
  updateParallax(dt) {
    const k = 1 - Math.pow(0.0016, dt);
    this.parallax.x += (this.parallax.targetX - this.parallax.x) * k;
    this.parallax.y += (this.parallax.targetY - this.parallax.y) * k;
  }

  /** Frame-rate independent glide after a flick. */
  update(dt) {
    if (this.flying) {
      this._stepFlight(performance.now());
      this.apply();
      return;
    }
    if (!this._pointer && (Math.abs(this._velocity.lon) > 0.05 || Math.abs(this._velocity.lat) > 0.05)) {
      const decay = Math.pow(0.9, dt * 60);
      if (this.tilt < 0.02) {
        const width = Math.max(this.dom.clientWidth || 800, 320);
        const degPerPx = (this.altitude * 0.85) / (111 * width);
        const cosLat = Math.max(Math.cos(this.lat * DEG), 0.12);
        this.lon -= (this._velocity.lon * degPerPx) / cosLat;
        this.lat = THREE.MathUtils.clamp(this.lat + this._velocity.lat * degPerPx, -MAX_LAT, MAX_LAT);
        this.lon = ((this.lon + 540) % 360) - 180;
      } else {
        this.heading -= this._velocity.lon * 0.0042;
        this.tilt = THREE.MathUtils.clamp(this.tilt + this._velocity.lat * 0.0026, 2 * DEG, 70 * DEG);
      }
      this._velocity.lon *= decay;
      this._velocity.lat *= decay;
      this.apply();
    }
  }

  /** Back to the opening shot, tilted back to a clean north-up globe. */
  returnToGlobe({ lat = GLOBE_VIEW.lat, lon = GLOBE_VIEW.lon, altitude = GLOBE_VIEW.altitude, onArrive } = {}) {
    this.setMode('globe');
    return this.flyTo({ lat, lon, altitude, heading: 0, tilt: 0 }, { arc: 0.06, onArrive });
  }
}

export { GLOBE_VIEW };
