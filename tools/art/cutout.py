#!/usr/bin/env python3
"""Cut a Grok Imagine sprite out of its flat key background (docs/ART-2.md §2).

usage:
  cutout.py SRC.jpg OUT.webp --size small|medium|large|huge [--key green|magenta] [--mirror] [--tol 60] [--erode 0]

Steps: key out pixels near the key colour, erode a noisy 1 px fringe, pull key-tinted edge
pixels toward their opaque neighbours (spill), trim to alpha + 4 px, resize to the size-class
height with LANCZOS, and save a WebP with alpha. Prints the output size and a quality report
(key-tinted pixels left on the edge, figure coverage) so screening can reject bad cuts.
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageFilter

HEIGHTS = {"small": 256, "medium": 384, "large": 512, "huge": 768}
KEYS = {"green": (0, 255, 0), "magenta": (255, 0, 255)}
CAP = 120_000


def key_mask(rgb: np.ndarray, key, tol: float) -> np.ndarray:
    """True where the pixel is background."""
    d = np.sqrt(((rgb.astype(np.int32) - np.array(key)) ** 2).sum(-1))
    near = d < tol
    # JPEG and Grok's dithering leave a darker / duller key around the figure: also treat as key any
    # pixel whose key channels dominate strongly (green: G >> R,B; magenta: R,B >> G).
    r, g, b = [rgb[..., i].astype(np.int32) for i in range(3)]
    if key == KEYS["green"]:
        dom = (g > 110) & (g - np.maximum(r, b) > 70)
    else:
        dom = (r > 110) & (b > 110) & (np.minimum(r, b) - g > 70)
    return near | dom


def keyness(rgb: np.ndarray, key) -> np.ndarray:
    r, g, b = [rgb[..., i].astype(np.int32) for i in range(3)]
    if key == KEYS["green"]:
        return np.clip(g - np.maximum(r, b), 0, 255)
    return np.clip(np.minimum(r, b) - g, 0, 255)


def cut(src: str, key_name: str, tol: float, erode: int = 0) -> Image.Image:
    key = KEYS[key_name]
    im = Image.open(src).convert("RGB")
    rgb = np.asarray(im).copy()
    # Grok sometimes paints the "bright" key darker (e.g. 0,110,0). Measure the actual background
    # from the image border and key against that as well as the nominal colour.
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    kn = keyness(border[None, ...], key)[0]
    if (kn > 40).mean() > 0.6:
        actual = tuple(int(v) for v in np.median(border[kn > 40], axis=0))
    else:
        actual = key
    bg = key_mask(rgb, key, tol) | (np.sqrt(((rgb.astype(np.int32) - np.array(actual)) ** 2).sum(-1)) < tol)
    if actual != key:
        # relative dominance test scaled to the darker key
        r, g, b = [rgb[..., i].astype(np.int32) for i in range(3)]
        if key == KEYS["green"]:
            bg |= (g > 0.6 * actual[1]) & (g - np.maximum(r, b) > 0.55 * (actual[1] - max(actual[0], actual[2])))
        else:
            lo = np.minimum(r, b)
            bg |= (lo > 0.6 * min(actual[0], actual[2])) & (lo - g > 0.55 * (min(actual[0], actual[2]) - actual[1]))

    # keep only the largest connected figure region? Too costly without scipy; instead remove
    # isolated specks with a median filter on the alpha.
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MedianFilter(3))

    # fringe: erode 1 px where the edge still carries key hue
    a = np.asarray(alpha).copy()
    eroded = np.asarray(alpha.filter(ImageFilter.MinFilter(3)))
    edge = (a > 0) & (eroded == 0)
    k = keyness(rgb, key)
    a[edge & (k > 25)] = 0

    # spill: on the remaining edge, replace key-tinted pixels with the mean of opaque neighbours
    opaque = Image.fromarray(np.where(a > 0, 255, 0).astype(np.uint8))
    edge2 = (a > 0) & (np.asarray(opaque.filter(ImageFilter.MinFilter(5))) == 0)
    if edge2.any():
        blur = np.asarray(Image.fromarray(np.where(a[..., None] > 0, rgb, 0).astype(np.uint8)).filter(ImageFilter.BoxBlur(2))).astype(np.float32)
        wts = np.asarray(Image.fromarray(np.where(a > 0, 255, 0).astype(np.uint8)).filter(ImageFilter.BoxBlur(2))).astype(np.float32) / 255.0
        avg = blur / np.maximum(wts[..., None], 1e-3)
        tinted = edge2 & (k > 8)
        rgb[tinted] = np.clip(avg[tinted], 0, 255).astype(np.uint8)
        # neutralise residual key hue on edge pixels
        if key == KEYS["green"]:
            g = rgb[..., 1].astype(np.int32)
            cap = np.maximum(rgb[..., 0], rgb[..., 2]).astype(np.int32)
            rgb[..., 1] = np.where(edge2 & (g > cap), cap, g).astype(np.uint8)
        else:
            r = rgb[..., 0].astype(np.int32); b = rgb[..., 2].astype(np.int32); g = rgb[..., 1].astype(np.int32)
            m = np.maximum(g, np.minimum(r, b) - 0)
            rgb[..., 0] = np.where(edge2 & (r > g + 30), np.maximum(g, r - (np.minimum(r, b) - g)), r).astype(np.uint8)
            rgb[..., 2] = np.where(edge2 & (b > g + 30), np.maximum(g, b - (np.minimum(r, b) - g)), b).astype(np.uint8)

    # bounce-light despill: Grok paints a faint key-coloured rim light onto the figure's outer
    # parts (rag hems, fur tips). Within ~10 px of the outline, neutralise pixels whose hue leans
    # clearly toward the key (ratio test, so olive moss and yellow-green glow are left alone).
    band = (a > 0) & (np.asarray(Image.fromarray(np.where(a > 0, 255, 0).astype(np.uint8)).filter(ImageFilter.MinFilter(21))) == 0)
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    if key == KEYS["green"]:
        lean = band & (g > 1.25 * r + 2) & (g > 1.15 * b + 2) & (g - np.maximum(r, b) > 6)
        rgb[..., 1] = np.where(lean, np.maximum(r, b) + 0.25 * (g - np.maximum(r, b)), g).astype(np.uint8)
    else:
        lo = np.minimum(r, b)
        lean = band & (r > 1.25 * g + 2) & (b > 1.25 * g + 2) & (lo - g > 6)
        tgt = g + 0.25 * (lo - g)
        rgb[..., 0] = np.where(lean, np.minimum(r, tgt + (r - lo)), r).astype(np.uint8)
        rgb[..., 2] = np.where(lean, np.minimum(b, tgt + (b - lo)), b).astype(np.uint8)

    if erode:
        # strip a painted light outline ("sticker" rim) that Grok sometimes draws around the figure
        a = np.asarray(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.MinFilter(2 * erode + 1))).copy()

    out = Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), "RGBA")
    return out


def finish(im: Image.Image, size: str, mirror: bool) -> Image.Image:
    bbox = im.getchannel("A").getbbox()
    if not bbox:
        raise SystemExit("empty cut-out")
    x0, y0, x1, y1 = bbox
    im = im.crop((max(0, x0 - 4), max(0, y0 - 4), min(im.width, x1 + 4), min(im.height, y1 + 4)))
    h = HEIGHTS[size]
    w = max(1, round(im.width * h / im.height))
    # premultiply-safe resize: resize RGB weighted by alpha
    im = im.resize((w, h), Image.LANCZOS)
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im


def report(im: Image.Image, key_name: str) -> str:
    a = np.asarray(im.getchannel("A"))
    rgb = np.asarray(im.convert("RGB"))
    k = keyness(rgb, KEYS[key_name])
    edge = (a > 0) & (np.asarray(im.getchannel("A").filter(ImageFilter.MinFilter(3))) == 0)
    tinted = int(((k > 40) & edge).sum())
    cover = (a > 0).mean()
    edge_touch = bool(a[:2].any() and a[-2:].any())
    return f"edge-key-px={tinted} cover={cover:.2f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--size", required=True, choices=HEIGHTS)
    ap.add_argument("--key", default="green", choices=KEYS)
    ap.add_argument("--mirror", action="store_true")
    ap.add_argument("--tol", type=float, default=60)
    ap.add_argument("--erode", type=int, default=0, help="extra px to shave off the outline")
    ns = ap.parse_args()
    im = finish(cut(ns.src, ns.key, ns.tol, ns.erode), ns.size, ns.mirror)
    q = 88
    while True:
        im.save(ns.out, "WEBP", lossless=False, quality=q, alpha_quality=100, method=6)
        if os.path.getsize(ns.out) <= CAP or q <= 60:
            break
        q -= 6
    print(f"{os.path.basename(ns.out)}: {im.width}x{im.height} {os.path.getsize(ns.out)//1000} kB q{q} {report(im, ns.key)}")


if __name__ == "__main__":
    main()
