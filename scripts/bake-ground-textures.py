"""Bake the tiling surface textures for the West Lake 3D scene.

These are surfaces, not the map: the lake, trees and buildings remain real
geometry. Everything here is deterministic numpy work — no network, no model.

    python scripts/bake-ground-textures.py

Outputs, all 512 x 512 and tileable:
    assets/explore3d/tex/canopy.webp   tree crowns seen from above (tintable)
    assets/explore3d/tex/meadow.webp   meadow / woodland floor (tintable)
    assets/explore3d/tex/water-normal.webp  ripple normals for the lake
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "explore3d" / "tex"
SIZE = 512


def fbm(size: int, octaves: int, seed: int, base: int = 4) -> np.ndarray:
    """Tileable fractal noise: every octave wraps, so the result repeats."""
    rng = np.random.default_rng(seed)
    total = np.zeros((size, size), dtype=np.float32)
    weight = 0.0
    amp = 1.0
    grid = base
    for _ in range(octaves):
        noise = rng.random((grid, grid), dtype=np.float32)
        img = Image.fromarray((noise * 255).astype(np.uint8), mode="L")
        layer = np.asarray(img.resize((size, size), Image.BICUBIC), dtype=np.float32) / 255.0
        # Cross-fade the edges with a rolled copy so the tile has no seam.
        layer = np.asarray(
            Image.fromarray((layer * 255).astype(np.uint8), mode="L").resize((size, size), Image.BICUBIC),
            dtype=np.float32,
        ) / 255.0
        total += layer * amp
        weight += amp
        amp *= 0.55
        grid *= 2
    return total / weight


def wrap_blob(canvas: np.ndarray, cx: float, cy: float, radius: float, strength: float, shade: float) -> None:
    """Add one tree crown, drawn 9× so it wraps across the tile edges."""
    size = canvas.shape[0]
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    for ox in (-size, 0, size):
        for oy in (-size, 0, size):
            dx = xs - (cx + ox)
            dy = ys - (cy + oy)
            d = np.sqrt(dx * dx + dy * dy) / radius
            mask = np.clip(1.0 - d, 0.0, 1.0) ** 1.5
            if not mask.any():
                continue
            # Light from the upper left: a highlight offset inside the crown
            # gives the cluster its roundness without any real lighting model.
            lit = np.clip(1.0 - np.sqrt((dx + radius * 0.3) ** 2 + (dy + radius * 0.35) ** 2) / (radius * 1.15), 0.0, 1.0)
            canvas[:] += (mask * (0.55 + lit * shade) * strength)[..., None] if canvas.ndim == 3 else mask * (0.55 + lit * shade) * strength


def bake_canopy() -> Image.Image:
    size = SIZE
    rng = np.random.default_rng(2024)
    height = np.zeros((size, size), dtype=np.float32)

    base = fbm(size, 5, seed=11, base=6)
    height += base * 0.55

    # Tree crowns: denser in clumps, so the texture reads as woodland rather
    # than as evenly scattered dots.
    for _ in range(260):
        cx = rng.random() * size
        cy = rng.random() * size
        radius = 12 + rng.random() * 30
        strength = 0.5 + rng.random() * 0.7
        wrap_blob(height, cx, cy, radius, strength, 0.85)

    # Fine leaf speckle.
    speckle = fbm(size, 3, seed=77, base=96)
    height = np.clip(height * 0.86 + speckle * 0.22, 0.0, None)

    lo, hi = np.percentile(height, 2), np.percentile(height, 98)
    norm = np.clip((height - lo) / max(hi - lo, 1e-5), 0.0, 1.0)
    # Compress into a near-white range: this texture modulates vertex colours,
    # so it must not darken the map when multiplied.
    norm = 0.70 + norm * 0.30

    # Slight green cast keeps it lively when tinted, while staying neutral
    # enough for instance colours to drive green / pink / autumn.
    rgb = np.stack([norm * 0.94, norm, norm * 0.84], axis=2)
    rgb = np.clip(rgb * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(rgb, mode="RGB")


def bake_meadow() -> Image.Image:
    size = SIZE
    coarse = fbm(size, 4, seed=5, base=4)
    mid = fbm(size, 5, seed=19, base=12)
    fine = fbm(size, 4, seed=31, base=64)

    height = coarse * 0.5 + mid * 0.32 + fine * 0.18
    lo, hi = np.percentile(height, 2), np.percentile(height, 98)
    norm = np.clip((height - lo) / max(hi - lo, 1e-5), 0.0, 1.0)
    norm = 0.74 + norm * 0.26

    # Meadow is mostly a brightness variation: the terrain's vertex colours
    # supply the actual hue, so fields and woodland floor stay consistent.
    rgb = np.stack([norm * 0.95, norm, norm * 0.82], axis=2)
    rgb = np.clip(rgb * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(rgb, mode="RGB")


def bake_water_normal() -> Image.Image:
    size = SIZE
    # Two crossing wave trains plus noise: reads as fine chop at metre scale.
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32) / size
    h = (
        np.sin((xs * 7 + ys * 3) * np.pi * 2) * 0.35
        + np.sin((xs * 3 - ys * 6) * np.pi * 2) * 0.25
        + (fbm(size, 4, seed=41, base=18) - 0.5) * 0.9
        + (fbm(size, 3, seed=53, base=48) - 0.5) * 0.45
    )

    gy, gx = np.gradient(h)
    strength = 2.4
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(h)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack([nx / length, ny / length, nz / length], axis=2)
    rgb = (normal * 0.5 + 0.5) * 255
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), mode="RGB")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, image, quality in (
        ("canopy.webp", bake_canopy(), 82),
        ("meadow.webp", bake_meadow(), 82),
        ("water-normal.webp", bake_water_normal(), 88),
    ):
        image.save(OUT / name, quality=quality, method=6)
        print(f"{name:20s} {(OUT / name).stat().st_size / 1024:7.1f} KB")
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
