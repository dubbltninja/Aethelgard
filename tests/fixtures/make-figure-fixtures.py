"""Fixture figures for the e2e build (U73a; docs/ART-2.md §1-2). Not art: small pixel stand-ins at the four size classes, so the
stage, the fallbacks and the screenshots can be built and tested before the art session delivers. The real files go to
public/art/sprites and public/art/portraits; these go to tests/fixtures/art/ (the e2e build's art folder, D-125).

    python3 tests/fixtures/make-figure-fixtures.py

Each sprite is drawn on a coarse grid (one cell = one art pixel), outlined, dither-shaded on its far side, then scaled up with
NEAREST to its size class's stored height and saved as a transparent lossless WebP. Creatures face left; heroes face right.
`cr_rootling` is left out on purpose: the e2e test shows its sigil in its place.
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'art')
SIZE = {'small': 256, 'medium': 384, 'large': 512, 'huge': 768}
OUTLINE = (12, 10, 18, 255)


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def finish(img, facing):
    """Outline every filled cell, dither the side away from the light, mirror for facing right."""
    w, h = img.size
    src = img.load()
    out = img.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3] != 0:
                continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and src[x + dx, y + dy][3] != 0 and src[x + dx, y + dy][:3] != OUTLINE[:3]
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                dst[x, y] = OUTLINE
    # light from the front-left: dither-darken the right third of each row
    for y in range(h):
        xs = [x for x in range(w) if src[x, y][3] != 0]
        if not xs:
            continue
        x0, x1 = min(xs), max(xs)
        for x in xs:
            if (x - x0) > (x1 - x0) * 0.62 and (x + y) % 2 == 0 and src[x, y][:3] != OUTLINE[:3]:
                if sum(src[x, y][:3]) < 600:  # glows keep their light
                    dst[x, y] = shade(src[x, y], 0.62)
    return out if facing == 'left' else out.transpose(Image.FLIP_LEFT_RIGHT)


def save(img, name, size_class, pad=1):
    bbox = img.getbbox()
    img = img.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(img.width, bbox[2] + pad), min(img.height, bbox[3] + pad)))
    target = SIZE[size_class]
    scale = target / img.height
    big = img.resize((max(1, round(img.width * scale)), target), Image.NEAREST)
    path = os.path.join(ROOT, 'sprites', f'{name}.webp')
    big.save(path, 'WEBP', lossless=True, quality=100, method=6)
    print(f'{path}: {big.width}x{big.height} {os.path.getsize(path)} B')


def canvas(w, h):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def humanoid(name, body, trim, accent, facing, size='medium', hood=True, weapon=None, cape=None):
    """A standing figure in three-quarter view, facing left as drawn (mirrored for heroes)."""
    img, d = canvas(30, 48)
    if cape:
        d.polygon([(12, 14), (22, 14), (25, 42), (9, 42)], fill=cape)
    d.rectangle([11, 30, 14, 45], fill=shade(body, 0.7))  # legs
    d.rectangle([16, 30, 19, 45], fill=shade(body, 0.6))
    d.rectangle([10, 45, 14, 46], fill=OUTLINE[:3] + (255,))
    d.rectangle([16, 45, 20, 46], fill=OUTLINE[:3] + (255,))
    d.polygon([(10, 14), (20, 14), (22, 31), (8, 31)], fill=body)  # torso
    d.rectangle([9, 24, 21, 26], fill=trim)  # belt
    d.ellipse([10, 4, 19, 14], fill=(196, 168, 140, 255))  # head
    if hood:
        d.chord([8, 2, 21, 16], 180, 360, fill=shade(body, 0.85))
        d.rectangle([8, 9, 10, 15], fill=shade(body, 0.85))
    d.point((11, 9), fill=accent)  # the eye, on the facing side
    d.rectangle([6, 16, 9, 27], fill=shade(body, 0.9))  # front arm
    d.rectangle([20, 16, 23, 26], fill=shade(body, 0.75))
    if weapon == 'bow':
        d.arc([0, 8, 10, 36], 100, 260, fill=trim, width=2)
        d.line([(5, 9), (5, 35)], fill=(200, 200, 200, 255))
    elif weapon == 'staff':
        d.line([(5, 2), (5, 46)], fill=trim, width=2)
        d.ellipse([3, 0, 8, 5], fill=accent)
    elif weapon == 'blade':
        d.line([(1, 30), (8, 22)], fill=(210, 214, 222, 255), width=2)
    elif weapon == 'shield':
        d.rectangle([2, 15, 9, 33], fill=trim)
        d.rectangle([4, 18, 7, 30], fill=shade(trim, 0.7))
    elif weapon == 'axe':
        d.line([(6, 10), (6, 34)], fill=(110, 80, 60, 255), width=2)
        d.polygon([(1, 10), (6, 12), (6, 18), (1, 20)], fill=(170, 170, 180, 255))
    elif weapon == 'void':
        d.ellipse([1, 22, 8, 29], fill=accent)
    elif weapon == 'spark':
        d.ellipse([2, 20, 7, 25], fill=accent)
        d.point((1, 18), fill=accent)
        d.point((8, 19), fill=accent)
    save(finish(img, facing), name, size)


def beast(name, body, accent, size, w=40, h=26, horns=False):
    img, d = canvas(w, h)
    d.ellipse([8, 6, w - 4, h - 8], fill=body)  # body
    d.ellipse([1, 3, 14, 15], fill=shade(body, 1.1))  # head, facing left
    d.point((4, 8), fill=accent)
    d.point((5, 8), fill=accent)
    for x in (10, 15, w - 16, w - 10):  # legs
        d.rectangle([x, h - 10, x + 2, h - 2], fill=shade(body, 0.7))
    d.line([(w - 5, 10), (w - 1, 4)], fill=body, width=2)  # tail
    for x in range(12, w - 8, 4):  # glowing stripes
        d.point((x, 9), fill=accent)
    if horns:
        d.line([(6, 3), (2, 0)], fill=(220, 210, 190, 255), width=1)
        d.line([(10, 3), (12, 0)], fill=(220, 210, 190, 255), width=1)
    save(finish(img, 'left'), name, size)


def brute(name, body, accent, size):
    img, d = canvas(40, 44)
    d.ellipse([8, 8, 34, 34], fill=body)  # hunched mass
    d.ellipse([3, 6, 15, 18], fill=shade(body, 1.15))  # head low and forward
    d.line([(5, 6), (1, 0)], fill=(214, 200, 170, 255), width=2)  # antlers
    d.line([(11, 6), (14, 0)], fill=(214, 200, 170, 255), width=2)
    d.point((6, 11), fill=accent)
    d.rectangle([4, 20, 9, 40], fill=shade(body, 0.85))  # long arm, knuckles down
    d.rectangle([3, 39, 10, 42], fill=shade(body, 0.7))
    d.rectangle([14, 32, 19, 42], fill=shade(body, 0.7))
    d.rectangle([24, 32, 29, 42], fill=shade(body, 0.65))
    for (x, y) in ((16, 16), (22, 22), (27, 14), (19, 27)):  # ember cracks
        d.point((x, y), fill=accent)
        d.point((x + 1, y + 1), fill=accent)
    save(finish(img, 'left'), name, size)


def wisp(name, core, glow, size):
    img, d = canvas(20, 22)
    d.ellipse([3, 2, 17, 16], fill=glow)
    d.ellipse([6, 5, 14, 13], fill=core)
    for (x, y) in ((1, 9), (18, 6), (10, 0), (9, 19), (4, 17), (15, 18)):
        d.point((x, y), fill=glow)
    d.point((8, 8), fill=(255, 255, 255, 255))
    save(finish(img, 'left'), name, size)


def giant(name, body, accent, size, eye=True, crown=False, bands=False, bell=False):
    img, d = canvas(48, 56)
    d.ellipse([6, 14, 44, 54], fill=body)  # mass
    d.ellipse([10, 2, 34, 26], fill=shade(body, 1.12))  # head
    if eye:
        d.ellipse([13, 10, 21, 16], fill=accent)
        d.point((15, 13), fill=(255, 255, 255, 255))
    d.rectangle([2, 22, 9, 46], fill=shade(body, 0.8))  # arm forward
    d.ellipse([0, 42, 10, 50], fill=shade(body, 0.7))
    d.rectangle([12, 50, 20, 55], fill=shade(body, 0.6))
    d.rectangle([30, 50, 38, 55], fill=shade(body, 0.55))
    if crown:
        for x in (12, 18, 24, 30):
            d.polygon([(x, 4), (x + 3, -1), (x + 5, 4)], fill=accent)
    if bands:
        for y in (24, 34, 44):
            d.line([(8, y), (43, y + 2)], fill=(214, 206, 255, 255), width=1)
    if bell:
        d.polygon([(14, 38), (30, 38), (33, 48), (11, 48)], fill=(150, 112, 60, 255))
    for (x, y) in ((24, 30), (32, 22), (36, 38), (20, 44)):
        d.point((x, y), fill=accent)
    save(finish(img, 'left'), name, size)


def arm(name, body, accent, size):
    img, d = canvas(44, 36)
    d.polygon([(42, 4), (44, 12), (20, 26), (16, 20)], fill=shade(body, 0.8))  # upper arm fading in
    d.polygon([(18, 18), (22, 26), (6, 30), (4, 24)], fill=body)  # forearm
    for i, x in enumerate((0, 2, 4)):  # fingers reaching left
        d.line([(5, 24 + i * 2), (x, 20 + i * 4)], fill=(230, 222, 240, 255), width=1)
    for (x, y) in ((28, 16), (34, 11), (12, 25)):
        d.point((x, y), fill=accent)
    save(finish(img, 'left'), name, size)


def aberration(name, body, accent, size):
    img, d = canvas(32, 48)
    d.polygon([(8, 12), (24, 12), (16, 24)], fill=body)  # hourglass torso
    d.polygon([(16, 24), (8, 38), (24, 38)], fill=body)
    d.line([(16, 18), (16, 30)], fill=accent)
    d.ellipse([10, 1, 22, 12], fill=shade(body, 1.1))
    d.point((12, 6), fill=accent)
    d.rectangle([10, 38, 13, 46], fill=shade(body, 0.7))
    d.rectangle([19, 38, 22, 46], fill=shade(body, 0.6))
    d.line([(8, 14), (2, 26)], fill=shade(body, 0.9), width=2)
    d.line([(24, 14), (30, 26)], fill=shade(body, 0.8), width=2)
    save(finish(img, 'left'), name, size)


def portrait(name, skin, cloth, accent, sizes=('lg', 'sm')):
    img = Image.new('RGBA', (32, 32), (24, 22, 28, 255))
    d = ImageDraw.Draw(img)
    d.ellipse([4, 2, 28, 26], fill=shade(accent, 0.35))  # the glow behind the head
    d.polygon([(4, 32), (8, 22), (24, 22), (28, 32)], fill=cloth)  # shoulders
    d.ellipse([10, 7, 22, 21], fill=skin)  # head
    d.chord([8, 4, 24, 20], 180, 360, fill=shade(cloth, 0.9))  # hood
    d.point((13, 13), fill=(30, 26, 30, 255))
    d.point((18, 13), fill=(30, 26, 30, 255))
    d.line([(14, 17), (17, 17)], fill=shade(skin, 0.7))
    for s in sizes:
        px = 512 if s == 'lg' else 160
        out = img.resize((px, px), Image.NEAREST).convert('RGB')
        suffix = '' if s == 'lg' else '@sm'
        path = os.path.join(ROOT, 'portraits', f'{name}{suffix}.webp')
        out.save(path, 'WEBP', lossless=True, quality=100, method=6)
        print(f'{path}: {px}x{px} {os.path.getsize(path)} B')


def main():
    os.makedirs(os.path.join(ROOT, 'sprites'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'portraits'), exist_ok=True)
    blue, amber, violet, ember, aqua, gold = (150, 210, 255, 255), (240, 190, 90, 255), (190, 120, 255, 255), (255, 140, 60, 255), (120, 230, 220, 255), (250, 214, 120, 255)
    # heroes (facing right)
    humanoid('class_ranger', (78, 92, 64, 255), (122, 90, 58, 255), amber, 'right', weapon='bow')
    humanoid('class_wizard', (52, 48, 78, 255), (150, 120, 70, 255), blue, 'right', weapon='spark')
    humanoid('class_elf', (128, 132, 142, 255), (92, 96, 110, 255), (180, 230, 255, 255), 'right', hood=False, weapon='blade')
    humanoid('class_ironclad_warden', (106, 108, 116, 255), (140, 104, 70, 255), ember, 'right', hood=False, weapon='shield')
    humanoid('class_shadow_weaver', (84, 82, 92, 255), (60, 50, 80, 255), violet, 'right', weapon='void')
    humanoid('companion_ilyra', (96, 104, 128, 255), (170, 150, 110, 255), blue, 'right', weapon='staff')
    humanoid('companion_brak', (98, 78, 60, 255), (70, 70, 74, 255), ember, 'right', hood=False, weapon='axe')
    # creatures (facing left)
    humanoid('cr_corrupted_shade', (44, 46, 66, 255), (30, 30, 46, 255), blue, 'left', cape=(28, 28, 44, 255), weapon='spark')
    beast('cr_mistwood_prowler', (96, 100, 96, 255), (200, 170, 90, 255), 'medium')
    brute('cr_wildling_brute', (88, 70, 52, 255), ember, 'large')
    wisp('cr_arcane_wisp', (220, 240, 255, 255), (110, 170, 240, 255), 'small')
    aberration('cr_temporal_aberration', (128, 126, 140, 255), (230, 214, 160, 255), 'large')
    arm('cr_tyrants_reach', (196, 186, 214, 255), violet, 'large')
    giant('cr_chronos_tyrant_contained', (78, 62, 112, 255), violet, 'huge', bands=True)
    giant('cr_chronos_tyrant_unveiled', (92, 64, 128, 255), violet, 'huge', crown=True)
    giant('cr_bell_warden', (150, 170, 168, 255), aqua, 'huge', bell=True)
    # portraits (opaque)
    portrait('npc_ilyra', (214, 182, 150, 255), (84, 92, 120, 255), blue)
    portrait('npc_brak', (190, 150, 120, 255), (96, 76, 58, 255), ember, sizes=('lg',))
    portrait('npc_kaelen_stonehand', (200, 160, 128, 255), (110, 84, 60, 255), ember)


if __name__ == '__main__':
    main()
