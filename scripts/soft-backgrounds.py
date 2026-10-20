"""Bake a soft 'paper wash' version of the five page backgrounds.

Originals stay untouched; the softened copies live in assets/route-photos/soft/.
The treatment is deliberately mild: the CSS adds the paper veil on top, so this
pass only takes the glare out of the artwork and cuts the file weight.
"""
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "route-photos"
DST = SRC / "soft"
DST.mkdir(exist_ok=True)

PAPER = (249, 246, 238)
TARGET_WIDTH = 1080

NAMES = [
    "page-bg-great-wall-mobile.png",
    "page-bg-zhangjiajie-mobile.png",
    "page-bg-west-lake-mobile.png",
    "page-bg-erhai-mobile.png",
    "page-bg-potala-mobile.png",
]


def soften(path: Path) -> Path:
    image = Image.open(path).convert("RGB")
    width, height = image.size
    if width != TARGET_WIDTH:
        image = image.resize(
            (TARGET_WIDTH, round(height * TARGET_WIDTH / width)), Image.LANCZOS
        )

    # Take the detail down a notch so architecture stops competing with text.
    image = image.filter(ImageFilter.GaussianBlur(radius=1.6))

    # Pull the colour back toward pencil-and-wash.
    grey = image.convert("L").convert("RGB")
    image = Image.blend(image, grey, alpha=0.30)

    # Lift the shadows and lower the contrast.
    image = ImageEnhance.Brightness(image).enhance(1.05)
    image = ImageEnhance.Contrast(image).enhance(0.90)

    # A barely-there warm paper tint, so it sits with the journal paper.
    image = Image.blend(image, Image.new("RGB", image.size, PAPER), alpha=0.10)

    out = DST / (path.stem.replace("-mobile", "") + "-soft.jpg")
    image.save(out, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"{path.name} -> {out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f} KB")
    return out


for name in NAMES:
    soften(SRC / name)
