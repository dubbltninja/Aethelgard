#!/usr/bin/env python3
"""Make a game portrait from a Grok Imagine bust (docs/ART-2.md §1-2).

usage: portrait.py SRC.jpg OUT_BASE [--dy 0.0] [--zoom 1.0]
Writes OUT_BASE.webp (512x512, <=70 kB) and OUT_BASE@sm.webp (160x160, <=15 kB).
The square crop is centred horizontally; --dy shifts it vertically (fraction of height, + = down),
--zoom > 1 crops tighter around the centre.
"""
import argparse
import os

from PIL import Image


def save(im, path, cap, q=82):
    while True:
        im.save(path, "WEBP", quality=q, method=6)
        if os.path.getsize(path) <= cap or q <= 40:
            return q
        q -= 6


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out_base")
    ap.add_argument("--dy", type=float, default=0.0)
    ap.add_argument("--zoom", type=float, default=1.0)
    ns = ap.parse_args()
    im = Image.open(ns.src).convert("RGB")
    w, h = im.size
    side = round(min(w, h) / ns.zoom)
    cx, cy = w / 2, h / 2 + ns.dy * h
    x0 = int(max(0, min(w - side, cx - side / 2)))
    y0 = int(max(0, min(h - side, cy - side / 2)))
    sq = im.crop((x0, y0, x0 + side, y0 + side))
    big = sq.resize((512, 512), Image.LANCZOS)
    sm = sq.resize((160, 160), Image.LANCZOS)
    q1 = save(big, ns.out_base + ".webp", 70_000)
    q2 = save(sm, ns.out_base + "@sm.webp", 15_000, 80)
    for p, q in ((ns.out_base + ".webp", q1), (ns.out_base + "@sm.webp", q2)):
        print(f"{os.path.basename(p)}: {os.path.getsize(p)//1000} kB q{q}")


if __name__ == "__main__":
    main()
