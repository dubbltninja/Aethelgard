// Where the figures stand on the combat stage (U73a; docs/ART-2.md §2, §7; DESIGN §16.5). Pure: the stage measures its band
// and asks this for one box per figure, in px from the band's top-left. The box is the sprite's own box (its stored aspect at
// its scaled height), so a figure is never clipped: every box lies inside the band, feet on the floor line.
//
// - Scale: one factor for the whole stage. Every size class is its stored height (ART-2 §2) times that factor, so within a fight
//   a huge boss dominates and a small mote is small. The factor fits the tallest class present — but never less than `large` —
//   between the floor and just under the band's top: a Tyrant fills the band, and a fight of medium figures still reads at a
//   good size (a medium figure is 3/4 of the band then, half of it beside a huge one).
// - Heroes on the left (the companion a step behind the player), enemies on the right in card order (the first nearest the
//   heroes: ← / → walk the same row). Three or four enemies stand in two ranks: every other one a step back (smaller, its feet a
//   little higher), never a huge one.
// - A crowded side first closes its gaps, then overlaps its figures a little (more on a narrow phone band), and only then
//   scales its figures down — so nothing ever leaves the band.
import { SIZE_PX, type SizeClass } from './sprites';

export interface LayoutFigure {
  uid: string;
  side: 'hero' | 'enemy';
  size: SizeClass;
  /** Stored width / height (a sigil fallback is 1). */
  aspect: number;
}

export interface FigureBox {
  uid: string;
  /** Left and top edges, px. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where its feet stand (y of the box's bottom). */
  feet: number;
  /** Stacking order: back rank under front rank. */
  z: number;
  back: boolean;
}

export interface StageLayout {
  width: number;
  height: number;
  /** The floor line's y, px. */
  floor: number;
  boxes: FigureBox[];
}

/** The proportions of the band (fractions of its width or height). */
export const STAGE = {
  /** The floor line, from the top. */
  floor: 0.88,
  /** Head-room a huge figure leaves at the top. */
  top: 0.04,
  /** Wide band: heroes' and enemies' strips across the width. */
  wide: { hero: [0.03, 0.4], enemy: [0.45, 0.97], overlap: 0.15 },
  /** Narrow band (a phone): the enemies get more of it, and may overlap a little more. */
  narrow: { hero: [0.02, 0.3], enemy: [0.32, 0.98], overlap: 0.3 },
  /** Below this width / height the band counts as narrow. */
  narrowAspect: 2.6,
  /** The gap between two figures, of the band's width. */
  gap: 0.02,
  /** A back-rank figure: its feet this much of the height above the floor, and this much smaller. */
  backRise: 0.05,
  backScale: 0.86,
} as const;

const r1 = (n: number): number => Math.round(n * 10) / 10;

interface Sized {
  f: LayoutFigure;
  h: number;
  w: number;
  back: boolean;
}

/** One strip of figures, left to right, fitted into [x0, x1]; returns the boxes before rounding. */
function fitStrip(items: readonly Sized[], x0: number, x1: number, floor: number, rise: number, gap: number, maxOverlap: number): FigureBox[] {
  if (items.length === 0) return [];
  const zone = x1 - x0;
  const sum = items.reduce((t, i) => t + i.w, 0);
  const minW = Math.min(...items.map((i) => i.w));
  const n = items.length;
  let scale = 1;
  let step = gap;
  if (sum + gap * (n - 1) > zone) {
    step = n === 1 ? 0 : (zone - sum) / (n - 1);
    const floorStep = -maxOverlap * minW;
    if (step < floorStep || n === 1) {
      // still too wide at the most overlap allowed: shrink the whole strip
      step = n === 1 ? 0 : floorStep;
      scale = zone / (sum + step * (n - 1));
      step *= scale;
    }
  }
  const total = sum * scale + step * (n - 1);
  let x = x0 + Math.max(0, (zone - total) / 2);
  return items.map((it) => {
    const w = it.w * scale;
    const h = it.h * scale;
    const feet = it.back ? floor - rise : floor;
    const box: FigureBox = { uid: it.f.uid, x, y: feet - h, w, h, feet, z: it.back ? 1 : 2, back: it.back };
    x += w + step;
    return box;
  });
}

/** The boxes for `figures` on a band of `width` × `height` px. Heroes are given left to right (companion, then player). */
export function stageLayout(width: number, height: number, figures: readonly LayoutFigure[]): StageLayout {
  const floor = height * STAGE.floor;
  const tallest = Math.max(SIZE_PX.large, ...figures.map((f) => SIZE_PX[f.size]));
  const unit = (floor - height * STAGE.top) / tallest;
  const strips = width / Math.max(1, height) < STAGE.narrowAspect ? STAGE.narrow : STAGE.wide;
  const gap = width * STAGE.gap;
  const rise = height * STAGE.backRise;
  const sized = (f: LayoutFigure, back: boolean): Sized => {
    const h = SIZE_PX[f.size] * unit * (back ? STAGE.backScale : 1);
    return { f, h, w: h * (f.aspect > 0 ? f.aspect : 1), back };
  };
  const heroes = figures.filter((f) => f.side === 'hero');
  const enemies = figures.filter((f) => f.side === 'enemy');
  // the player is the last hero (front, nearest the enemies); anyone before it stands a step back
  const heroItems = heroes.map((f, i) => sized(f, i < heroes.length - 1));
  // three or more enemies: every other one a step back, never a huge one
  const enemyItems = enemies.map((f, i) => sized(f, enemies.length >= 3 && i % 2 === 1 && f.size !== 'huge'));
  const boxes = [
    ...fitStrip(heroItems, width * strips.hero[0], width * strips.hero[1], floor, rise, gap, strips.overlap),
    ...fitStrip(enemyItems, width * strips.enemy[0], width * strips.enemy[1], floor, rise, gap, strips.overlap),
  ].map((b) => ({ ...b, x: r1(b.x), y: r1(Math.max(0, b.y)), w: r1(b.w), h: r1(b.h), feet: r1(b.feet) }));
  return { width, height, floor: r1(floor), boxes };
}

/** A box lies wholly inside the band (to the rounding's 0.1 px). */
export const insideBand = (b: FigureBox, width: number, height: number): boolean =>
  b.x >= -0.05 && b.y >= -0.05 && b.x + b.w <= width + 0.15 && b.y + b.h <= height + 0.15;
