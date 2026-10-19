"""Bake the stylised 3D-earth textures for the Explore globe.

Input : a public-domain NASA Visible Earth "Blue Marble next generation,
        topography and bathymetry" equirectangular image (no clouds).
Output: three small WebP textures consumed by modules/explore3d/globe.js

    assets/explore3d/earth-albedo.webp   4096 x 2048   paper-ink atlas look
    assets/explore3d/earth-normal.webp   2048 x 1024   relief normal map
    assets/explore3d/earth-clouds.webp   1024 x  512   soft cloud alpha

Everything here is a deterministic restyle of the source image: no network
call, no per-frame generation. Run it once, commit the three outputs.

    python scripts/bake-earth-textures.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "outputs" / "bake" / "earth-source.jpg"
OUT = ROOT / "assets" / "explore3d"

ALBEDO_SIZE = (4096, 2048)
NORMAL_SIZE = (2048, 1024)
CLOUD_SIZE = (1024, 512)

# The palette is the product's own: warm paper, deep teal water, cinnabar and
# gold reserved for the UI. Land is deliberately desaturated so the 3D scene's
# warm lamplight reads against it.
WATER_DEEP = np.array([14, 44, 58], dtype=np.float32)
WATER_SHELF = np.array([38, 94, 104], dtype=np.float32)
WATER_SHALLOW = np.array([92, 158, 156], dtype=np.float32)
LAND_FOREST = np.array([122, 148, 118], dtype=np.float32)
LAND_MEADOW = np.array([166, 178, 138], dtype=np.float32)
LAND_DESERT = np.array([206, 188, 146], dtype=np.float32)
LAND_ROCK = np.array([138, 132, 120], dtype=np.float32)
LAND_SNOW = np.array([236, 234, 226], dtype=np.float32)
ICE = np.array([232, 238, 236], dtype=np.float32)


def _box1d(a: np.ndarray, k: int, axis: int) -> np.ndarray:
    """Edge-padded moving average along one axis, via a prefix sum."""
    pad = [(0, 0), (0, 0)]
    pad[axis] = (k, k)
    p = np.pad(a, pad, mode="edge")
    cs = np.cumsum(p, axis=axis, dtype=np.float64)
    zero_shape = list(cs.shape)
    zero_shape[axis] = 1
    cs = np.concatenate([np.zeros(zero_shape, dtype=cs.dtype), cs], axis=axis)
    n = cs.shape[axis]
    hi = np.take(cs, np.arange(2 * k + 1, n), axis=axis)
    lo = np.take(cs, np.arange(0, n - (2 * k + 1)), axis=axis)
    return ((hi - lo) / (2 * k + 1)).astype(np.float32)


def smooth(a: np.ndarray, radius: float) -> np.ndarray:
    """Three box passes ≈ a Gaussian; stays in float, no 8-bit round-trip."""
    k = int(round(radius * 0.9))
    if k < 1:
        return a.astype(np.float32)
    out = a.astype(np.float32)
    for _ in range(3):
        out = _box1d(out, k, 0)
        out = _box1d(out, k, 1)
    return out


def blur(arr: np.ndarray, radius: float) -> np.ndarray:
    """Blur a 0..1 float array or an HxWxC stack, per channel."""
    squeeze = arr.ndim == 2
    if squeeze:
        arr = arr[..., None]
    chans = [smooth(arr[..., c], radius) for c in range(arr.shape[2])]
    out = np.stack(chans, axis=2)
    return out[..., 0] if squeeze else out


def resize(arr: np.ndarray, size: tuple[int, int], resample=Image.LANCZOS) -> np.ndarray:
    squeeze = arr.ndim == 2
    if squeeze:
        arr = arr[..., None]
    chans = []
    for c in range(arr.shape[2]):
        img = Image.fromarray(np.clip(arr[..., c] * 255.0, 0, 255).astype(np.uint8), mode="L")
        chans.append(np.asarray(img.resize(size, resample), dtype=np.float32) / 255.0)
    out = np.stack(chans, axis=2)
    return out[..., 0] if squeeze else out


def sobel(height: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    gy = np.zeros_like(height)
    gx = np.zeros_like(height)
    gy[1:-1, :] = (height[2:, :] - height[:-2, :]) * 0.5
    gx[:, 1:-1] = (height[:, 2:] - height[:, :-2]) * 0.5
    return gx, gy


def fbm(size: tuple[int, int], octaves: int, seed: int, base: int = 8) -> np.ndarray:
    rng = np.random.default_rng(seed)
    w, h = size
    total = np.zeros((h, w), dtype=np.float32)
    weight = 0.0
    amp = 1.0
    for o in range(octaves):
        gw = max(2, base * (2 ** o))
        gh = max(1, gw // 2)
        noise = rng.random((gh, gw), dtype=np.float32)
        layer = resize(noise, size, Image.BICUBIC)
        total += layer * amp
        weight += amp
        amp *= 0.55
    return total / weight


def main() -> int:
    if not SOURCE.exists():
        print(f"missing source image: {SOURCE}", file=sys.stderr)
        print("see scripts/bake-earth-textures.ps1 for the public-domain URL", file=sys.stderr)
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SOURCE).convert("RGB").resize(ALBEDO_SIZE, Image.LANCZOS)
    rgb = np.asarray(src, dtype=np.float32) / 255.0
    h, w, _ = rgb.shape

    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b

    # --- water mask -------------------------------------------------------
    # Blue Marble's bathymetry is a clean blue ramp; land never has b - r this
    # positive, so a soft ramp on that difference separates the two without
    # hard aliasing on the coasts.
    blue_dominance = b - r
    water = np.clip((blue_dominance - 0.015) / 0.11, 0.0, 1.0)
    water = blur(water, 1.0)
    depth = np.clip((0.30 - lum) / 0.24, 0.0, 1.0)  # darker = deeper

    # --- land palette -----------------------------------------------------
    # Classify with hue, not brightness: Blue Marble's greens and sands are
    # both bright, so a brightness ramp turns the whole planet to beige.
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    hue = np.zeros_like(lum)
    delta = np.maximum(mx - mn, 1e-5)
    hue = np.where(mx == r, ((g - b) / delta) % 6.0, hue)
    hue = np.where(mx == g, (b - r) / delta + 2.0, hue)
    hue = np.where(mx == b, (r - g) / delta + 4.0, hue)
    hue_deg = hue * 60.0

    def band(center: float, width: float) -> np.ndarray:
        d = np.abs((hue_deg - center + 180.0) % 360.0 - 180.0)
        return np.exp(-((d / width) ** 2))

    green = band(105.0, 34.0) * np.clip(sat * 3.2, 0.0, 1.0)
    olive = band(70.0, 30.0) * np.clip(sat * 2.4, 0.0, 1.0)
    sand = band(42.0, 22.0) * np.clip(sat * 2.0, 0.0, 1.0) * np.clip((lum - 0.34) / 0.3, 0.0, 1.0)
    grey = np.clip(1.0 - sat * 6.0, 0.0, 1.0) * np.clip((lum - 0.30) / 0.35, 0.0, 1.0)

    land = np.repeat(LAND_ROCK[None, None, :], h, axis=0).repeat(w, axis=1).astype(np.float32)
    for weight, colour in (
        (green, LAND_FOREST),
        (olive, LAND_MEADOW),
        (sand, LAND_DESERT),
        (grey, LAND_ROCK),
    ):
        a = np.clip(weight, 0.0, 1.0)[..., None]
        land = land * (1.0 - a * 0.9) + colour * (a * 0.9)

    # Relief: high-pass on a smoothed luminance gives cheap hill shading that
    # survives the palette flattening and reads as painted mountains.
    relief_base = blur(lum, 2.2)
    relief = np.clip((lum - relief_base) * 5.0, -0.45, 0.45)
    land = land + relief[..., None] * 46.0

    # Snow: bright + high latitude, softened so the caps are not stencils.
    lat = np.abs(np.linspace(90.0, -90.0, h, dtype=np.float32))[:, None]
    snow_signal = np.clip((lum - 0.62) / 0.2, 0.0, 1.0) * np.clip((lat - 36.0) / 20.0, 0.0, 1.0)
    land = land * (1.0 - snow_signal[..., None] * 0.92) + LAND_SNOW * (snow_signal[..., None] * 0.92)
    polar = np.clip((lat - 64.0) / 9.0, 0.0, 1.0)
    land = land * (1.0 - polar[..., None]) + ICE * polar[..., None]

    # --- water palette ----------------------------------------------------
    # Depth stays almost flat: a big cyan blotch per ocean reads as a texture
    # error, while a shallow band that hugs the coast reads as bathymetry.
    sea_mix = np.clip(depth * 0.55 + 0.15, 0.0, 1.0)[..., None]
    sea = WATER_DEEP * (1.0 - sea_mix) + WATER_SHELF * sea_mix

    edge = np.clip(1.0 - np.abs(water - 0.5) * 2.0, 0.0, 1.0)
    shelf = np.clip(blur(edge, 7.0) * 1.5, 0.0, 1.0) ** 1.6 * water
    sea = sea * (1.0 - shelf[..., None] * 0.85) + WATER_SHALLOW * (shelf[..., None] * 0.85)

    albedo = land * (1.0 - water[..., None]) + sea * water[..., None]

    # --- atlas flourishes -------------------------------------------------
    # Coast ink, then a light rim just inside it: the same two strokes the 2D
    # Q-atlas pins use, so the globe and the map pages share one vocabulary.
    coast_ink = np.clip(blur(edge, 1.0) * 1.25, 0.0, 1.0) ** 2
    albedo = albedo * (1.0 - coast_ink[..., None] * 0.42)
    rim = np.clip(edge * 1.0, 0.0, 1.0) ** 3
    albedo = albedo + (WATER_SHALLOW * 0.35)[None, None, :] * rim[..., None] * 0.6

    # Contour ink on land: a faint darker line wherever the relief turns over.
    edges = blur(np.clip(np.abs(relief) - 0.11, 0.0, 1.0) * 5.0, 0.7)
    albedo = albedo * (1.0 - edges[..., None] * 0.12 * (1.0 - water[..., None]))

    # Cooler poles, warmer equator: a filmic tint instead of a flat map.
    lat_norm = np.linspace(1.0, -1.0, h, dtype=np.float32)[:, None]
    cool = np.clip(np.abs(lat_norm) * 1.15 - 0.55, 0.0, 1.0)[..., None]
    albedo = albedo * (1.0 - cool * 0.10) + np.array([150, 180, 190], dtype=np.float32) * cool * 0.10

    # Paper grain, kept subtle so it reads as stock, not noise.
    grain = fbm((w // 4, h // 4), 4, seed=7)
    grain = resize(grain, (w, h), Image.BICUBIC) - 0.5
    albedo = albedo + grain[..., None] * 6.0

    albedo = np.clip(albedo, 0, 255).astype(np.uint8)
    Image.fromarray(albedo, mode="RGB").save(OUT / "earth-albedo.webp", quality=84, method=6)

    # --- relief normal map ------------------------------------------------
    height = np.clip(relief_base * 1.6 + relief * 0.9, 0.0, 1.0) * (1.0 - water)
    height = resize(height, NORMAL_SIZE, Image.LANCZOS)
    gx, gy = sobel(height)
    strength = 2.6
    nx, ny, nz = -gx * strength, gy * strength, np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack([nx / length, ny / length, nz / length], axis=2)
    normal = (normal * 0.5 + 0.5) * 255.0
    Image.fromarray(np.clip(normal, 0, 255).astype(np.uint8), mode="RGB").save(
        OUT / "earth-normal.webp", quality=88, method=6
    )

    # --- clouds -----------------------------------------------------------
    cw, ch = CLOUD_SIZE
    base = fbm((cw, ch), 5, seed=21, base=6)
    detail = fbm((cw, ch), 4, seed=42, base=24)
    cloud = np.clip((base * 0.78 + detail * 0.22 - 0.52) * 3.1, 0.0, 1.0) ** 1.4
    # Trade-wind banding: real cloud fields are not uniform.
    band = (0.55 + 0.45 * np.cos(np.linspace(-3.2, 3.2, ch, dtype=np.float32)))[:, None]
    cloud = np.clip(cloud * band, 0.0, 1.0)
    rgba = np.zeros((ch, cw, 4), dtype=np.uint8)
    rgba[..., 0:3] = 255
    rgba[..., 3] = (cloud * 255).astype(np.uint8)
    Image.fromarray(rgba, mode="RGBA").save(OUT / "earth-clouds.webp", quality=80, method=6)

    for name in ("earth-albedo.webp", "earth-normal.webp", "earth-clouds.webp"):
        size = (OUT / name).stat().st_size / 1024
        print(f"{name:22s} {size:8.1f} KB")
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
