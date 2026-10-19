// Explore 3D — the globe itself, plus the geographic math every layer shares.
//
// Units: kilometres everywhere (earth radius 6371). The camera near/far planes
// are recomputed from altitude each frame instead of relying on a logarithmic
// depth buffer, because a logarithmic buffer would have to be opted into by
// every hand-written shader; a dynamic near/far works with built-in and custom
// materials alike.
//
// Textures are baked offline by scripts/bake-earth-textures.py from a
// public-domain NASA Blue Marble image. Nothing here fetches map tiles at
// runtime: the globe is one sphere, three small WebP files and two shaders.

import * as THREE from '/modules/vendor/three/three.module.js';

export const EARTH_RADIUS = 6371;
const DEG = Math.PI / 180;

/** Latitude/longitude (degrees) → point on a sphere of `radius` km. */
export function geoToVec3(latDeg, lonDeg, radius = EARTH_RADIUS, out = new THREE.Vector3()) {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const cosLat = Math.cos(lat);
  return out.set(
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * cosLat * Math.sin(lon)
  );
}

/** Point on the sphere → { lat, lon } in degrees. */
export function vec3ToGeo(v) {
  const r = v.length() || 1;
  return {
    lat: Math.asin(THREE.MathUtils.clamp(v.y / r, -1, 1)) / DEG,
    lon: Math.atan2(-v.z, v.x) / DEG,
  };
}

/** Unit north tangent at a geo point (direction of increasing latitude). */
export function northTangent(latDeg, lonDeg, out = new THREE.Vector3()) {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  return out.set(-Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)).normalize();
}

/** Unit east tangent at a geo point (direction of increasing longitude). */
export function eastTangent(latDeg, lonDeg, out = new THREE.Vector3()) {
  const lon = lonDeg * DEG;
  return out.set(-Math.sin(lon), 0, -Math.cos(lon)).normalize();
}

export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;

/** Shortest arc between two unit vectors, as a quaternion rotation. */
export function arcQuaternion(from, to) {
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  return q;
}

// The lighting and colour pipeline is written by hand in the two custom
// materials below: three does not apply tone mapping or the output colour
// space to a raw ShaderMaterial, so the same ACES curve the built-in
// materials use lives here as GLSL.
const FINISH_GLSL = /* glsl */ `
  vec3 twACES(vec3 x) {
    const float a = 2.51; const float b = 0.03; const float c = 2.43;
    const float d = 0.59; const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }
  vec3 twFinish(vec3 linearColor, float exposure) {
    vec3 c = twACES(max(linearColor * exposure, vec3(0.0)));
    return pow(c, vec3(1.0 / 2.2));
  }
  vec3 srgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }
`;

const GLOBE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GLOBE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uAlbedo;
  uniform sampler2D uNormal;
  uniform sampler2D uClouds;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform float uTime;
  uniform float uCloudiness;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  ${FINISH_GLSL}

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vPosW);
    vec3 L = normalize(uSunDir);

    // Tangent frame from spherical parametrisation: cheap and good enough for
    // a relief map that only needs to break up the specular highlight.
    vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(1e-5, 0.0, 0.0));
    vec3 B = cross(N, T);
    vec4 relief = texture2D(uNormal, vUv);
    float water = relief.a;
    vec3 nTex = relief.xyz * 2.0 - 1.0;
    vec3 Np = normalize(N + (T * nTex.x + B * nTex.y) * mix(0.55, 0.12, water));

    vec3 albedo = srgbToLinear(texture2D(uAlbedo, vUv).rgb);

    // Half-Lambert keeps the terminator soft and painted rather than harsh.
    float ndl = dot(Np, L);
    float diffuse = pow(clamp(ndl * 0.5 + 0.5, 0.0, 1.0), 1.35);

    vec3 sunColor = vec3(1.0, 0.93, 0.82);
    vec3 skyAmbient = vec3(0.16, 0.24, 0.30);

    vec3 color = albedo * (sunColor * diffuse * 1.25 + skyAmbient);

    // Water gets a broad glossy lobe so the oceans read as water, not paint.
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(Np, H), 0.0), mix(180.0, 26.0, water)) * mix(0.05, 0.85, water);
    color += sunColor * spec * smoothstep(-0.2, 0.35, ndl);

    // A thin cool rim: the atmosphere catching light at the limb.
    float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.2);
    color += vec3(0.22, 0.46, 0.58) * rim * (0.35 + 0.65 * max(ndl, 0.0));

    // Clouds drift extremely slowly; they are a texture, never a per-frame cost.
    float clouds = texture2D(uClouds, vec2(vUv.x + uTime * 0.00035, vUv.y)).a;
    clouds = smoothstep(0.32, 0.95, clouds) * uCloudiness;
    vec3 cloudColor = vec3(1.0, 0.985, 0.96) * (diffuse * 1.1 + 0.05);
    color = mix(color, cloudColor, clouds * 0.5);

    // Night side keeps a little blue so the dark half is never a dead black.
    float night = smoothstep(0.05, -0.25, ndl);
    color = mix(color, color * vec3(0.20, 0.30, 0.42) + vec3(0.012, 0.021, 0.035), night);

    gl_FragColor = vec4(twFinish(color, 1.15), 1.0);
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ATMO_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform vec3 uColor;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vPosW);
    float rim = pow(1.0 - abs(dot(N, V)), 2.6);
    float sun = clamp(dot(N, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
    float alpha = rim * (0.30 + 0.70 * pow(sun, 1.6));
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;

function makeStars(count, radius) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    // Uniform on the sphere, biased away from the ecliptic band so it reads as
    // a night sky rather than confetti.
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = radius * r * Math.cos(theta);
    positions[i * 3 + 1] = radius * u;
    positions[i * 3 + 2] = radius * r * Math.sin(theta);
    const warm = rand();
    colors[i * 3] = 0.72 + warm * 0.28;
    colors[i * 3 + 1] = 0.78 + warm * 0.14;
    colors[i * 3 + 2] = 0.86 + warm * 0.10;
    sizes[i] = 0.6 + rand() * rand() * 2.6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      varying vec3 vColor;
      uniform float uPixel;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixel;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float falloff = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(vColor, falloff * 0.85);
      }
    `,
    vertexColors: true,
  });
  return new THREE.Points(geometry, material);
}

/**
 * Builds the earth, its atmosphere shell and the star field.
 * Textures load lazily so the first paint is the ocean sphere, not a blank div.
 */
export function createGlobe({ renderer, sunDirection }) {
  const group = new THREE.Group();
  group.name = 'globe';

  const uniforms = {
    uAlbedo: { value: null },
    uNormal: { value: null },
    uClouds: { value: null },
    uSunDir: { value: sunDirection.clone() },
    uCameraPos: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uCloudiness: { value: 0.62 },
  };

  const earthMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: GLOBE_VERT,
    fragmentShader: GLOBE_FRAG,
    extensions: { derivatives: true },
  });

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 192, 96), earthMaterial);
  sphere.name = 'earth-surface';
  sphere.renderOrder = 0;
  group.add(sphere);

  const atmoUniforms = {
    uSunDir: uniforms.uSunDir,
    uCameraPos: uniforms.uCameraPos,
    uColor: { value: new THREE.Vector3(0.24, 0.55, 0.72) },
  };
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.032, 96, 48),
    new THREE.ShaderMaterial({
      uniforms: atmoUniforms,
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  atmosphere.name = 'atmosphere';
  atmosphere.renderOrder = 2;
  group.add(atmosphere);

  const stars = makeStars(2600, 1);
  stars.name = 'stars';
  stars.frustumCulled = false;

  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let loaded = 0;

  const load = (key, url, onDone) =>
    new Promise(resolve => {
      loader.load(
        url,
        texture => {
          const albedo = key === 'uAlbedo';
          texture.colorSpace = albedo ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          texture.anisotropy = anisotropy;
          texture.wrapS = THREE.RepeatWrapping;
          uniforms[key].value = texture;
          earthMaterial.needsUpdate = true;
          onDone?.();
          resolve(true);
        },
        undefined,
        () => resolve(false)
      );
    });

  const ready = Promise.all([
    load('uAlbedo', '/assets/explore3d/earth-albedo.webp'),
    load('uNormal', '/assets/explore3d/earth-normal.webp'),
    load('uClouds', '/assets/explore3d/earth-clouds.webp'),
  ]).then(results => {
    loaded = results.filter(Boolean).length;
    return results;
  });

  return {
    group,
    sphere,
    atmosphere,
    stars,
    uniforms,
    ready,
    get loadedTextures() {
      return loaded;
    },
    update(dt, camera, farPlane) {
      uniforms.uTime.value += dt;
      uniforms.uCameraPos.value.copy(camera.position);
      atmoUniforms.uCameraPos.value.copy(camera.position);
      // Stars ride with the camera, just inside the far plane, so the same
      // points work at 20 000 km and at 900 m above a lake.
      stars.position.copy(camera.position);
      const scale = farPlane * 0.62 / EARTH_RADIUS;
      stars.scale.setScalar(scale);
      stars.material.uniforms.uPixel.value = Math.max(0.9, window.devicePixelRatio || 1) * 1.15;
    },
    setSun(direction) {
      uniforms.uSunDir.value.copy(direction).normalize();
    },
    dispose() {
      sphere.geometry.dispose();
      earthMaterial.dispose();
      atmosphere.geometry.dispose();
      atmosphere.material.dispose();
      stars.geometry.dispose();
      stars.material.dispose();
      for (const key of ['uAlbedo', 'uNormal', 'uClouds']) uniforms[key].value?.dispose();
    },
  };
}

/** A warm low sun, shared by the globe and the West Lake scene. */
export function sunDirectionFromAngles(azimuthDeg, elevationDeg) {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
}

export { FINISH_GLSL };
