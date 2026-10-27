#!/usr/bin/env python3
"""Contact sheets for ART-2 screening (docs/ART-2.md §6).

usage:
  sheet.py sprites OUT.jpg ROWS.json   rows: [[label, src_prefix, name, size, key], ...]
  sheet.py portraits OUT.jpg ROWS.json rows: [[label, src_prefix, name], ...]

src_prefix is a path without the trailing "<n>.jpg" (e.g. ".../cr_rootling-a"); candidates 1-4 are read.
Sprite rows show each candidate cut out on black and on white (halos and holes show); portrait rows show
each candidate full size and at 160 px inside a round-cornered frame.
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)


def sprites(out, rows):
    CELL = 220  # each cut shown in a CELL x CELL box on black and on white
    PAD, LAB = 10, 22
    W = PAD + 4 * (2 * CELL + 6 + PAD)
    H = PAD + len(rows) * (CELL + LAB + PAD)
    s = Image.new("RGB", (W, H), (40, 38, 44))
    d = ImageDraw.Draw(s)
    tmp = tempfile.mkdtemp()
    for r, (lab, prefix, name, size, key) in enumerate(rows):
        for i in range(4):
            src = f"{prefix}{i+1}.jpg"
            x = PAD + i * (2 * CELL + 6 + PAD)
            y = PAD + r * (CELL + LAB + PAD)
            d.text((x, y), f"{lab}{i+1}  {name}", fill=(235, 230, 220), font=FONT)
            if not os.path.exists(src):
                continue
            dst = os.path.join(tmp, f"{r}_{i}.webp")
            res = subprocess.run([sys.executable, os.path.join(HERE, "cutout.py"), src, dst, "--size", size, "--key", key],
                                 capture_output=True, text=True)
            if res.returncode:
                d.text((x, y + LAB), "CUT FAILED", fill=(255, 80, 80), font=FONT)
                continue
            cut = Image.open(dst).convert("RGBA")
            cut.thumbnail((CELL - 8, CELL - 8), Image.LANCZOS)
            for j, bg in enumerate(((0, 0, 0), (255, 255, 255))):
                box = Image.new("RGBA", (CELL, CELL), bg + (255,))
                box.alpha_composite(cut, ((CELL - cut.width) // 2, CELL - cut.height - 4))
                s.paste(box.convert("RGB"), (x + j * (CELL + 6), y + LAB))
    s.save(out, quality=86)


def portraits(out, rows):
    BIG, SM = 300, 160
    PAD, LAB = 10, 22
    CW = BIG + 8 + SM
    W = PAD + 4 * (CW + PAD)
    H = PAD + len(rows) * (BIG + LAB + PAD)
    s = Image.new("RGB", (W, H), (40, 38, 44))
    d = ImageDraw.Draw(s)
    for r, (lab, prefix, name) in enumerate(rows):
        for i in range(4):
            src = f"{prefix}{i+1}.jpg"
            x = PAD + i * (CW + PAD)
            y = PAD + r * (BIG + LAB + PAD)
            d.text((x, y), f"{lab}{i+1}  {name}", fill=(235, 230, 220), font=FONT)
            if not os.path.exists(src):
                continue
            im = Image.open(src).convert("RGB")
            side = min(im.size)
            im = im.crop(((im.width - side) // 2, (im.height - side) // 2, (im.width + side) // 2, (im.height + side) // 2))
            s.paste(im.resize((BIG, BIG), Image.LANCZOS), (x, y + LAB))
            sm = im.resize((SM, SM), Image.LANCZOS)
            mask = Image.new("L", (SM, SM), 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, SM - 1, SM - 1), radius=18, fill=255)
            frame = Image.new("RGB", (SM + 6, SM + 6), (150, 140, 120))
            s.paste(frame, (x + BIG + 8 - 3, y + LAB + (BIG - SM) // 2 - 3))
            s.paste(sm, (x + BIG + 8, y + LAB + (BIG - SM) // 2), mask)
    s.save(out, quality=86)


if __name__ == "__main__":
    mode, out, rows = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
    (sprites if mode == "sprites" else portraits)(out, rows)
