#!/usr/bin/env python3
"""Render Gathered-zine style backgrounds locally, with no image-generation calls.

Input : a real, attributable source photograph per landmark
        (modules/data/gathered-sources.json, produced by resolve-gathered-sources.mjs)
Output: assets/route-photos/<qid>-gathered-background.png   wide 5:3 paper artwork
        assets/route-photos/<qid>-gathered-background-mobile.png  portrait crop for phones
        assets/route-photos/<qid>-gathered-background.provenance.json

Style target (approved reference: assets/route-photos/sydney-opera-gathered-background.png)
  - left ~40%  : the landmark kept photographic, high-key and lightly desaturated
  - right ~60% : the SAME scene re-drawn as a flat two-tone navy/cream screen print
  - a fibrous torn-paper edge separates the halves, exposing cream paper between them
  - large quiet ivory paper negative space in the upper margin
  - no text, no lettering, no foreign landmarks, no red accents

This is a deterministic, code-generated artistic derivative. It is NOT a documentary
photograph, and it is NOT AI-generated.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTO_DIR = os.path.join(ROOT, "assets", "route-photos")
MANIFEST = os.path.join(ROOT, "modules", "data", "gathered-sources.json")

W, H = 1619, 971            # 5:3 wide artwork (desktop / tablet / background)
MW, MH = 900, 1350          # 2:3 portrait artwork (phones)


def rng_for(seed_text):
    h = 2166136261
    for ch in seed_text:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return np.random.default_rng(h)


def smooth_noise(rng, n, octaves=5):
    """1-D fractal noise, roughly in [-1, 1]."""
    out = np.zeros(n)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        step = max(2, n // (2 ** (o + 2)))
        knots = rng.normal(0, 1, step + 2)
        xs = np.linspace(0, step, n)
        idx = np.clip(xs.astype(int), 0, step - 1)
        frac = xs - idx
        frac = frac * frac * (3 - 2 * frac)
        out += amp * (knots[idx] * (1 - frac) + knots[idx + 1] * frac)
        total += amp
        amp *= 0.5
    return out / total


def paper_base(rng, w, h):
    fine = rng.normal(0, 3.4, (h, w)).astype(np.float32)
    fine = np.asarray(Image.fromarray((fine + 128).clip(0, 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(0.7)), dtype=np.float32) - 128
    return np.array([243.0, 237.0, 225.0])[None, None, :] + fine[:, :, None]


def cover_crop(im, w, h, focus=0.42):
    im = im.convert("RGB")
    sr, tr = im.width / im.height, w / h
    if sr > tr:
        nh, nw = h, max(w, int(round(h * sr)))
    else:
        nw, nh = w, max(h, int(round(w / sr)))
    im = im.resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2
    top = int((nh - h) * focus)
    return im.crop((left, top, left + w, top + h))


def photo_half(src):
    """Documentary half: kept natural and vivid, only mildly high-key."""
    im = ImageEnhance.Color(src).enhance(0.92)
    im = ImageEnhance.Brightness(im).enhance(1.03)
    im = ImageEnhance.Contrast(im).enhance(1.04)
    a = np.asarray(im, dtype=np.float32) / 255.0
    return np.clip(a * 255.0, 0, 255)


def illo_half(src, rng, w, h):
    """Flat two-tone navy/cream screen print with crisp silhouettes and no halftone noise."""
    g = np.asarray(src.convert("L").filter(ImageFilter.GaussianBlur(2.6)), dtype=np.float32) / 255.0
    lo, hi = np.percentile(g, 2), np.percentile(g, 97)
    g = np.clip((g - lo) / max(hi - lo, 1e-3), 0, 1)
    g = g ** 0.82

    ink = 1.0 / (1.0 + np.exp(-(0.52 - g) * 24.0))      # 1 = solid ink, crisp edge
    ink = np.clip((ink - 0.06) / 0.88, 0, 1)

    ivory = np.array([244.0, 238.0, 227.0])
    navy = np.array([24.0, 52.0, 95.0])
    grain = rng.normal(0, 0.022, (h, w))
    col = ivory[None, None, :] * (1 - ink[:, :, None]) + navy[None, None, :] * ink[:, :, None]
    col = col * (1.0 + grain[:, :, None] * 1.4)
    return np.clip(col, 0, 255)


def torn_edge(rng, base, amp, drift, n, jitter=1.8, octaves=6):
    e = base + smooth_noise(rng, n, octaves) * amp + np.linspace(0.0, 1.0, n) * drift
    e = e + rng.normal(0, jitter, n)
    return np.convolve(e, np.ones(3) / 3.0, mode="same")


def composite(src, rng, w, h, wide=True):
    paper = paper_base(rng, w, h)
    photo = photo_half(src)
    illo = illo_half(src, rng, w, h)

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)

    # ---- main diagonal tear: photograph left, screen print right, cream paper between
    base = w * (0.455 if wide else 0.44)
    drift = -w * (0.16 if wide else 0.13)
    edge = torn_edge(rng, base, w * 0.018, drift, h, jitter=0.7, octaves=4)
    gap = 8.0 + np.abs(smooth_noise(rng, h, 4)) * (14.0 if wide else 11.0)

    left_of = xx < edge[:, None]
    right_of = xx > (edge + gap)[:, None]

    out = np.where(right_of[:, :, None], illo, paper)                 # illustration + paper
    out = np.where(left_of[:, :, None], photo, out)                   # photograph on top-left

    # ---- comb-like fibres along the tear: very short strands
    d = xx - edge[:, None]
    fine = smooth_noise(rng, h, 7)
    length = 1.5 + (np.clip(fine, 0, 1) * 0.5 + rng.random(h) * 0.5) * (6.0 if wide else 5.0)
    strand = rng.random((h, w)) > 0.34
    fibres = (d < 0) & (d > -length[:, None]) & strand
    fade = np.clip(1.0 + d / np.maximum(length[:, None], 1.0), 0, 1) ** 0.7
    fa = np.where(fibres, 0.22 + 0.60 * fade, 0.0)[:, :, None]
    out = out * (1 - fa) + paper * fa

    # a thin bright pulp line right on the tear
    pulp = np.exp(-(np.abs(d - gap[:, None] * 0.5) / 2.4) ** 2)
    pulp = pulp * np.clip(0.60 + 0.40 * np.abs(smooth_noise(rng, w, 4))[None, :], 0, 1)
    pa = (pulp * 0.94)[:, :, None]
    out = out * (1 - pa) + np.array([247.0, 242.0, 232.0])[None, None, :] * pa

    # ---- torn cream wedge lifting the bottom-left corner of the photograph
    wy = h * (0.86 if wide else 0.78) + xx * 0.30 + smooth_noise(rng, w, 5)[None, :] * 16.0
    wedge = (yy > wy) & left_of
    wa = np.where(wedge, 1.0, 0.0)[:, :, None]
    out = out * (1 - wa) + paper * wa

    # ---- torn cream fringe along the bottom of the illustration
    fy = h * 0.945 + smooth_noise(rng, w, 5)[None, :] * 18.0
    fringe = (yy > fy) & right_of
    fr = np.where(fringe, 1.0, 0.0)[:, :, None]
    out = out * (1 - fr) + paper * fr

    # ---- quiet ivory margin at the top of the illustration only; the photograph stays vivid
    lift = np.clip((yy - h * 0.08) / (h * 0.24), 0, 1)[:, :, None]
    lam = 0.78 * (1 - lift) * right_of[:, :, None]
    out = out * (1 - lam) + paper * lam

    # ---- paper bite + light print grain
    out = out * 0.96 + paper * 0.04
    out = out + rng.normal(0, 1.7, (h, w, 1))
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def main():
    only = sys.argv[1:] or None
    with open(MANIFEST, encoding="utf-8") as fh:
        manifest = json.load(fh)
    made, failed = [], []
    for pid, entry in manifest["sources"].items():
        if only and pid not in only:
            continue
        src_path = os.path.join(ROOT, entry["localFile"])
        base = pid.lower() + "-gathered-background"
        try:
            src = Image.open(src_path)
            wide = composite(cover_crop(src, W, H, 0.42), rng_for(pid), W, H, wide=True)
            mobile = composite(cover_crop(src, MW, MH, 0.30), rng_for(pid + "-m"), MW, MH, wide=False)
            wide.save(os.path.join(PHOTO_DIR, base + ".png"), "PNG", optimize=True)
            mobile.save(os.path.join(PHOTO_DIR, base + "-mobile.png"), "PNG", optimize=True)
            with open(os.path.join(PHOTO_DIR, base + ".provenance.json"), "w", encoding="utf-8") as fh:
                json.dump({
                    "asset": base + ".png",
                    "mobileAsset": base + "-mobile.png",
                    "placeId": pid,
                    "dimensions": {"width": W, "height": H, "mobile": {"width": MW, "height": MH}},
                    "kind": "Code-rendered Gathered-zine artistic background, not a documentary photograph",
                    "generation": "local deterministic render (Pillow/numpy); no image-generation service used",
                    "source": {
                        "localFile": os.path.basename(entry["localFile"]),
                        "title": entry.get("commonsTitle"),
                        "author": entry["sourceAuthor"],
                        "license": entry["license"],
                        "licenseUrl": entry["licenseUrl"],
                        "url": entry["sourceUrl"],
                    },
                    "styleReference": "sydney-opera-gathered-background.png",
                    "changes": "Photograph reinterpreted as a paper collage: high-key documentary left third, "
                               "flat two-tone navy/cream screen print on the right, fibrous torn-paper handoff, "
                               "ivory negative space. No text, no added landmarks.",
                    "seed": pid,
                }, fh, ensure_ascii=False, indent=2)
            made.append(pid)
        except Exception as exc:                                        # noqa: BLE001
            failed.append((pid, str(exc)))
    print(json.dumps({"rendered": len(made), "failed": failed[:8]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
