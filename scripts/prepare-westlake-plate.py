"""Prepare the West Lake plate: crop the device bezel out of the design comp and
derive a water mask from its own colours.

The mask is what lets the animated water be painted only on the lake — it is
computed from the plate itself, so it follows every inlet and pond exactly.

    python scripts/prepare-westlake-plate.py <source.png>

Outputs (same pixel size, plate coordinate space):
    assets/explore3d/plate.webp        the cropped screen
    assets/explore3d/water-mask.png    alpha mask of everything that is water
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "explore3d"

# Bezel crop of the supplied 1024 x 1536 comp.
CROP = (16, 12, 1008, 1522)
TARGET_WIDTH = 1400


def main() -> int:
    source = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "outputs" / "plate-source.png")
    image = Image.open(source).convert("RGB").crop(CROP)

    # The comp is the only source we have, so: Lanczos up to a width that stays
    # sharp on a 3x phone, then an unsharp pass to undo the softness the source
    # picked up from being re-encoded. No browser-side scaling beyond 1x.
    scale = TARGET_WIDTH / image.width
    image = image.resize((TARGET_WIDTH, int(round(image.height * scale))), Image.LANCZOS)
    image = image.filter(ImageFilter.UnsharpMask(radius=1.6, percent=118, threshold=2))
    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT / "plate.webp", quality=94, method=6)
    print(f"plate      {image.size}  {(OUT / 'plate.webp').stat().st_size / 1024:.0f} KB")

    # --- water mask -------------------------------------------------------
    # West Lake in this artwork is a saturated cyan-teal inside the middle band
    # of the plate. Hue + saturation + a spatial band is enough: the sky above
    # is desaturated blue and the blossoms below are pink, so neither qualifies.
    hsv = np.asarray(image.convert("HSV"), dtype=np.float32) / 255.0
    hue, sat, val = hsv[..., 0] * 360.0, hsv[..., 1], hsv[..., 2]
    height = hue.shape[0]
    ys = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]

    in_hue = (hue > 158.0) & (hue < 208.0)
    in_sat = sat > 0.36
    in_val = val > 0.30
    in_band = (ys > 0.19) & (ys < 0.66)
    water = in_hue & in_sat & in_val & in_band

    strength = np.clip((sat - 0.30) / 0.35, 0.0, 1.0) * np.clip((val - 0.24) / 0.30, 0.0, 1.0)
    mask = np.where(water, np.clip(0.45 + strength * 0.75, 0.0, 1.0), 0.0)

    mask_img = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    # Soften the edge so painted ripples never show a hard cut at the shore.
    mask_img = mask_img.filter(ImageFilter.GaussianBlur(4))
    alpha = np.asarray(mask_img, dtype=np.float32)
    alpha = np.clip((alpha - 30) / 150.0, 0.0, 1.0)

    rgba = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    rgba[..., 0:3] = 255
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    Image.fromarray(rgba, mode="RGBA").save(OUT / "water-mask.png")
    print(f"mask       {alpha.shape[1]}x{alpha.shape[0]}  water {alpha.mean() * 100:.1f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
