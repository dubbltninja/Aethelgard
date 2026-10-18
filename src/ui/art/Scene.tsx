// <Scene> (PLAN §6.4, DESIGN §17.2): a location's picture as one inline SVG, composed from layers — Sky → Ceiling →
// Far silhouettes → Horizon → Mid elements → Near elements → Particles → Breach overlay — out of the location's `art`
// record (template, horizon, particles, timeOfDay) and its region's palette (palettes.ts). Placement is deterministic
// from `seed` through `uiRng` (never the engine's Rng, D-032), so a place always looks the same.
//
// U64's cut, "at the level the Explore screen needs": each of the 20 schema templates maps to a horizon curve and a
// set of generic far / mid / near shapes. The per-location silhouette keys and the hand-authored focal pieces
// (`art.silhouettes`, `art.focal`) are U71/U72's registry; until then they fall back to the template (validator rule
// 4 reports them once the registry is injected). Pure (no hooks), so it renders inside the pure views and on the server.
import type { ReactNode } from 'react';
import type { HeartstoneState, Watch } from '@engine/index';
import type { Location, LocationArt } from '@schema/location';
import type { Region } from '@schema/region';
import { scenePalette, shade, type ScenePalette } from './palettes';
import { uiRng, type UiRng } from './uiRng';

export const SCENE_W = 1200;
export const SCENE_H = 500;

export type Template = LocationArt['template'];
type Curve = 'flat' | 'hills' | 'jagged' | 'flooded';
type Far = 'spires' | 'ruins' | 'trees' | 'peaks' | 'dome' | 'shards' | 'none';
type Mid =
  | 'arch' | 'crystal' | 'shelves' | 'tent' | 'palisade' | 'forge' | 'fountain' | 'reeds' | 'lantern' | 'cairn' | 'stones'
  | 'tear' | 'pillars' | 'threads' | 'chasm' | 'platform' | 'trees';
type Near = 'rubble' | 'roots' | 'water' | 'grass' | 'scree' | 'clouds';

interface TemplateSpec {
  curve: Curve;
  far: Far;
  mid: readonly Mid[];
  near: Near;
  /** A roof of rock or vault over the scene (indoor and underground places). */
  ceiling?: boolean;
  density: number;
}

/** The 20 schema templates (LocationArtSchema) → generic layers. */
export const TEMPLATES: Readonly<Record<Template, TemplateSpec>> = {
  ruins: { curve: 'hills', far: 'spires', mid: ['arch', 'crystal'], near: 'rubble', density: 0.6 },
  forest: { curve: 'hills', far: 'trees', mid: ['trees'], near: 'roots', density: 0.8 },
  cavern: { curve: 'flat', far: 'none', mid: ['crystal', 'stones'], near: 'rubble', ceiling: true, density: 0.5 },
  swamp: { curve: 'flooded', far: 'trees', mid: ['reeds', 'lantern'], near: 'water', density: 0.6 },
  peaks: { curve: 'jagged', far: 'peaks', mid: ['cairn'], near: 'scree', density: 0.7 },
  spires: { curve: 'jagged', far: 'spires', mid: ['crystal', 'pillars'], near: 'scree', density: 0.7 },
  void: { curve: 'jagged', far: 'shards', mid: ['chasm', 'stones'], near: 'scree', density: 0.6 },
  observatory: { curve: 'hills', far: 'dome', mid: ['arch', 'pillars'], near: 'rubble', density: 0.5 },
  breach: { curve: 'jagged', far: 'peaks', mid: ['tear'], near: 'scree', density: 0.6 },
  camp: { curve: 'hills', far: 'trees', mid: ['tent', 'palisade'], near: 'grass', density: 0.6 },
  forge: { curve: 'flat', far: 'peaks', mid: ['forge', 'palisade'], near: 'scree', density: 0.5 },
  shore: { curve: 'flooded', far: 'none', mid: ['stones'], near: 'water', density: 0.3 },
  city: { curve: 'flat', far: 'spires', mid: ['arch', 'fountain'], near: 'rubble', density: 0.8 },
  archive: { curve: 'flat', far: 'none', mid: ['shelves'], near: 'rubble', ceiling: true, density: 0.7 },
  steppe: { curve: 'flat', far: 'peaks', mid: ['stones', 'cairn'], near: 'grass', density: 0.35 },
  sky: { curve: 'flat', far: 'peaks', mid: ['platform'], near: 'clouds', density: 0.4 },
  threshold: { curve: 'flooded', far: 'none', mid: ['lantern'], near: 'water', density: 0.2 },
  undercity: { curve: 'flat', far: 'none', mid: ['arch', 'shelves'], near: 'water', ceiling: true, density: 0.6 },
  sanctum: { curve: 'flat', far: 'none', mid: ['pillars', 'threads'], near: 'rubble', ceiling: true, density: 0.6 },
  custom: { curve: 'hills', far: 'ruins', mid: ['stones'], near: 'rubble', density: 0.5 },
};

export interface SceneState {
  horde: boolean;
  heartstone: HeartstoneState;
  watch: Watch;
  loop: number;
  /** The Horde has reached this node (the violet-black hatch, DESIGN §16.6). */
  infected?: boolean;
}

export interface SceneProps {
  location: Pick<Location, 'id' | 'name' | 'regionId' | 'art'>;
  region?: Pick<Region, 'palette'>;
  /** The art with its matching `variants` applied (the container evaluates their conditions); default `location.art`. */
  art?: LocationArt;
  state: SceneState;
  reducedMotion: boolean;
  seed: string;
  className?: string;
}

/** `art` with `patch` merged over it (an art variant: `{ focal, particles, timeOfDay … }`); unknown keys are ignored. */
export function patchArt(art: LocationArt, patch: Record<string, unknown>): LocationArt {
  const out: LocationArt = { ...art };
  const keys = ['template', 'horizon', 'silhouettes', 'particles', 'focal', 'timeOfDay'] as const;
  for (const key of keys) if (patch[key] !== undefined) (out as Record<string, unknown>)[key] = patch[key];
  return out;
}

const f = (n: number): string => (Math.round(n * 10) / 10).toString();

// ---- horizon -----------------------------------------------------------------------------------------------------------------

/** The ground line's y at each of `steps + 1` points across the width. */
function horizonLine(curve: Curve, base: number, rng: UiRng, steps = 24): number[] {
  const phase1 = rng.range(0, Math.PI * 2);
  const phase2 = rng.range(0, Math.PI * 2);
  const ys: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (curve === 'hills') ys.push(base + Math.sin(t * Math.PI * 2 + phase1) * 14 + Math.sin(t * Math.PI * 5 + phase2) * 7);
    else if (curve === 'jagged') ys.push(base + (i % 2 === 0 ? -1 : 1) * rng.range(4, 22) + Math.sin(t * Math.PI * 3 + phase1) * 10);
    else ys.push(base + Math.sin(t * Math.PI * 4 + phase1) * 3);
  }
  return ys;
}

function groundPath(ys: readonly number[]): string {
  const step = SCENE_W / (ys.length - 1);
  const pts = ys.map((y, i) => `${f(i * step)} ${f(y)}`);
  return `M0 ${SCENE_H} L${pts.join(' L')} L${SCENE_W} ${SCENE_H} Z`;
}

const yAt = (ys: readonly number[], x: number): number => {
  const step = SCENE_W / (ys.length - 1);
  const i = Math.max(0, Math.min(ys.length - 2, Math.floor(x / step)));
  const t = (x - i * step) / step;
  return (ys[i] as number) * (1 - t) + (ys[i + 1] as number) * t;
};

// ---- far silhouettes -------------------------------------------------------------------------------------------------------

function farPath(kind: Far, base: number, density: number, rng: UiRng): string {
  if (kind === 'none') return '';
  const parts: string[] = [];
  if (kind === 'peaks') {
    const pts: string[] = [`M0 ${base + 10}`];
    for (let x = 0; x <= SCENE_W; x += rng.range(60, 140)) pts.push(`L${f(x)} ${f(base - rng.range(40, 120 + 100 * density))}`);
    pts.push(`L${SCENE_W} ${base - 30} L${SCENE_W} ${base + 10} Z`);
    return pts.join(' ');
  }
  const count = Math.round(5 + 10 * density);
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, SCENE_W);
    if (kind === 'spires') {
      const w = rng.range(14, 34);
      const h = rng.range(50, 150 + 80 * density);
      parts.push(`M${f(x - w / 2)} ${base + 6} L${f(x - w / 2)} ${f(base - h)} L${f(x)} ${f(base - h - rng.range(30, 80))} L${f(x + w / 2)} ${f(base - h)} L${f(x + w / 2)} ${base + 6} Z`);
    } else if (kind === 'ruins') {
      const w = rng.range(30, 90);
      const h = rng.range(30, 110);
      parts.push(`M${f(x)} ${base + 6} L${f(x)} ${f(base - h)} L${f(x + w * 0.4)} ${f(base - h + rng.range(8, 30))} L${f(x + w * 0.7)} ${f(base - h - 10)} L${f(x + w)} ${f(base - h + 20)} L${f(x + w)} ${base + 6} Z`);
    } else if (kind === 'trees') {
      const h = rng.range(70, 160);
      const w = rng.range(30, 60);
      parts.push(`M${f(x - 3)} ${base + 6} L${f(x - 3)} ${f(base - h * 0.4)} L${f(x - w / 2)} ${f(base - h * 0.4)} L${f(x)} ${f(base - h)} L${f(x + w / 2)} ${f(base - h * 0.4)} L${f(x + 3)} ${f(base - h * 0.4)} L${f(x + 3)} ${base + 6} Z`);
    } else if (kind === 'dome') {
      const r = rng.range(40, 90);
      parts.push(`M${f(x - r)} ${base + 6} L${f(x - r)} ${f(base - r * 0.4)} A ${f(r)} ${f(r * 0.9)} 0 0 1 ${f(x + r)} ${f(base - r * 0.4)} L${f(x + r)} ${base + 6} Z`);
      if (i > 2) break;
    } else if (kind === 'shards') {
      const y = rng.range(base - 240, base - 60);
      const s = rng.range(16, 46);
      parts.push(`M${f(x)} ${f(y - s)} L${f(x + s * 0.7)} ${f(y - s * 0.1)} L${f(x + s * 0.2)} ${f(y + s * 0.9)} L${f(x - s * 0.6)} ${f(y + s * 0.2)} Z`);
    }
  }
  return parts.join(' ');
}

// ---- mid elements -------------------------------------------------------------------------------------------------------------

interface Shape {
  d: string;
  /** 'glow' draws in the accent with a soft halo; 'line' is a stroke, not a fill. */
  tone: 'mid' | 'glow' | 'line' | 'dark';
}

function midShapes(kind: Mid, x: number, ground: number, rng: UiRng): Shape[] {
  const s = rng.range(0.8, 1.25);
  switch (kind) {
    case 'arch': {
      const w = 150 * s;
      const h = 190 * s;
      const broken = rng.next() < 0.6;
      const left = `M${f(x)} ${f(ground)} L${f(x)} ${f(ground - h * 0.7)} C ${f(x)} ${f(ground - h * 1.05)}, ${f(x + w * 0.42)} ${f(ground - h * 1.1)}, ${f(x + w * 0.5)} ${f(ground - h * 1.06)} L${f(x + w * 0.5)} ${f(ground - h * 0.95)} C ${f(x + w * 0.28)} ${f(ground - h * 0.93)}, ${f(x + 26)} ${f(ground - h * 0.88)}, ${f(x + 26)} ${f(ground - h * 0.66)} L${f(x + 26)} ${f(ground)} Z`;
      const right = broken
        ? `M${f(x + w - 26)} ${f(ground)} L${f(x + w - 26)} ${f(ground - h * 0.55)} L${f(x + w - 10)} ${f(ground - h * 0.62)} L${f(x + w)} ${f(ground - h * 0.5)} L${f(x + w)} ${f(ground)} Z`
        : `M${f(x + w)} ${f(ground)} L${f(x + w)} ${f(ground - h * 0.7)} C ${f(x + w)} ${f(ground - h * 1.05)}, ${f(x + w * 0.58)} ${f(ground - h * 1.1)}, ${f(x + w * 0.5)} ${f(ground - h * 1.06)} L${f(x + w * 0.5)} ${f(ground - h * 0.95)} C ${f(x + w * 0.72)} ${f(ground - h * 0.93)}, ${f(x + w - 26)} ${f(ground - h * 0.88)}, ${f(x + w - 26)} ${f(ground - h * 0.66)} L${f(x + w - 26)} ${f(ground)} Z`;
      return [{ d: `${left} ${right}`, tone: 'mid' }];
    }
    case 'crystal': {
      const parts: string[] = [];
      for (let i = 0; i < 3; i++) {
        const cx = x + i * 16 * s;
        const h = rng.range(36, 90) * s;
        parts.push(`M${f(cx - 8)} ${f(ground)} L${f(cx)} ${f(ground - h)} L${f(cx + 9)} ${f(ground)} Z`);
      }
      return [{ d: parts.join(' '), tone: 'glow' }];
    }
    case 'shelves': {
      const w = 90 * s;
      const h = rng.range(170, 240) * s;
      const tilt = rng.range(-8, 8);
      const body = `M${f(x)} ${f(ground)} L${f(x + tilt)} ${f(ground - h)} L${f(x + w + tilt)} ${f(ground - h)} L${f(x + w)} ${f(ground)} Z`;
      const rows = [0.25, 0.45, 0.65, 0.85].map((t) => `M${f(x + 6 + tilt * t)} ${f(ground - h * t)} L${f(x + w - 6 + tilt * t)} ${f(ground - h * t)}`).join(' ');
      return [
        { d: body, tone: 'mid' },
        { d: rows, tone: 'line' },
      ];
    }
    case 'tent': {
      const w = 110 * s;
      const h = 80 * s;
      return [{ d: `M${f(x)} ${f(ground)} L${f(x + w / 2)} ${f(ground - h)} L${f(x + w)} ${f(ground)} Z M${f(x + w / 2)} ${f(ground - h)} L${f(x + w / 2)} ${f(ground - h - 18)}`, tone: 'mid' }];
    }
    case 'palisade': {
      const parts: string[] = [];
      for (let i = 0; i < 9; i++) {
        const px = x + i * 14;
        const h = rng.range(44, 66) * s;
        parts.push(`M${f(px)} ${f(ground)} L${f(px)} ${f(ground - h)} L${f(px + 5)} ${f(ground - h - 10)} L${f(px + 10)} ${f(ground - h)} L${f(px + 10)} ${f(ground)} Z`);
      }
      return [{ d: parts.join(' '), tone: 'mid' }];
    }
    case 'forge': {
      const body = `M${f(x)} ${f(ground)} L${f(x)} ${f(ground - 70 * s)} L${f(x + 50 * s)} ${f(ground - 70 * s)} L${f(x + 50 * s)} ${f(ground - 190 * s)} L${f(x + 80 * s)} ${f(ground - 190 * s)} L${f(x + 80 * s)} ${f(ground - 70 * s)} L${f(x + 140 * s)} ${f(ground - 70 * s)} L${f(x + 140 * s)} ${f(ground)} Z`;
      return [
        { d: body, tone: 'mid' },
        { d: `M${f(x + 30 * s)} ${f(ground)} L${f(x + 30 * s)} ${f(ground - 34 * s)} A ${f(20 * s)} ${f(20 * s)} 0 0 1 ${f(x + 70 * s)} ${f(ground - 34 * s)} L${f(x + 70 * s)} ${f(ground)} Z`, tone: 'glow' },
      ];
    }
    case 'fountain': {
      return [
        { d: `M${f(x)} ${f(ground)} L${f(x + 10)} ${f(ground - 30)} L${f(x + 110)} ${f(ground - 30)} L${f(x + 120)} ${f(ground)} Z M${f(x + 54)} ${f(ground - 30)} L${f(x + 54)} ${f(ground - 90)} L${f(x + 66)} ${f(ground - 90)} L${f(x + 66)} ${f(ground - 30)} Z`, tone: 'mid' },
        { d: `M${f(x + 60)} ${f(ground - 92)} C ${f(x + 40)} ${f(ground - 120)}, ${f(x + 26)} ${f(ground - 80)}, ${f(x + 18)} ${f(ground - 34)} M${f(x + 60)} ${f(ground - 92)} C ${f(x + 80)} ${f(ground - 120)}, ${f(x + 94)} ${f(ground - 80)}, ${f(x + 102)} ${f(ground - 34)}`, tone: 'line' },
      ];
    }
    case 'reeds': {
      const parts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const rx = x + i * 9;
        const h = rng.range(40, 100) * s;
        parts.push(`M${f(rx)} ${f(ground)} Q ${f(rx + rng.range(-10, 10))} ${f(ground - h * 0.6)}, ${f(rx + rng.range(-16, 16))} ${f(ground - h)}`);
      }
      return [{ d: parts.join(' '), tone: 'line' }];
    }
    case 'lantern': {
      const h = 120 * s;
      return [
        { d: `M${f(x)} ${f(ground)} L${f(x)} ${f(ground - h)} L${f(x + 24)} ${f(ground - h)}`, tone: 'line' },
        { d: `M${f(x + 18)} ${f(ground - h + 4)} L${f(x + 30)} ${f(ground - h + 4)} L${f(x + 32)} ${f(ground - h + 26)} L${f(x + 16)} ${f(ground - h + 26)} Z`, tone: 'glow' },
      ];
    }
    case 'cairn': {
      const parts: string[] = [];
      let y = ground;
      for (let i = 0; i < 4; i++) {
        const w = (44 - i * 9) * s;
        const h = (20 - i * 2) * s;
        parts.push(`M${f(x - w / 2)} ${f(y)} Q ${f(x - w / 2)} ${f(y - h)}, ${f(x)} ${f(y - h)} Q ${f(x + w / 2)} ${f(y - h)}, ${f(x + w / 2)} ${f(y)} Z`);
        y -= h * 0.85;
      }
      return [{ d: parts.join(' '), tone: 'mid' }];
    }
    case 'stones': {
      const parts: string[] = [];
      for (let i = 0; i < 3; i++) {
        const sx = x + i * rng.range(40, 70);
        const h = rng.range(50, 130) * s;
        const w = rng.range(18, 32);
        parts.push(`M${f(sx)} ${f(ground)} L${f(sx + 3)} ${f(ground - h)} L${f(sx + w - 4)} ${f(ground - h - rng.range(0, 12))} L${f(sx + w)} ${f(ground)} Z`);
      }
      return [{ d: parts.join(' '), tone: 'mid' }];
    }
    case 'tear': {
      const top = ground - 320;
      const pts: string[] = [`M${f(x)} ${f(top)}`];
      for (let y = top + 30; y < ground; y += 30) pts.push(`L${f(x + rng.range(-26, 26))} ${f(y)}`);
      const back: string[] = [];
      for (let y = ground - 30; y > top; y -= 30) back.push(`L${f(x + rng.range(-12, 12) + 14)} ${f(y)}`);
      return [{ d: `${pts.join(' ')} L${f(x + 6)} ${f(ground)} ${back.join(' ')} Z`, tone: 'glow' }];
    }
    case 'pillars': {
      const parts: string[] = [];
      for (let i = 0; i < 3; i++) {
        const px = x + i * 60 * s;
        const h = rng.range(150, 240) * s;
        parts.push(`M${f(px)} ${f(ground)} L${f(px)} ${f(ground - h)} L${f(px + 24)} ${f(ground - h)} L${f(px + 24)} ${f(ground)} Z M${f(px - 6)} ${f(ground - h)} L${f(px + 30)} ${f(ground - h)}`);
      }
      return [{ d: parts.join(' '), tone: 'mid' }];
    }
    case 'threads': {
      const parts: string[] = [];
      for (let i = 0; i < 6; i++) parts.push(`M${f(x + i * 22)} ${f(ground)} Q ${f(x + 70)} ${f(ground - 160)}, ${f(x + 150 - i * 12)} ${f(ground - 300)}`);
      return [{ d: parts.join(' '), tone: 'line' }];
    }
    case 'chasm':
      return [{ d: `M${f(x)} ${f(ground + 2)} L${f(x + 40)} ${f(ground + 60)} L${f(x + 90)} ${f(ground + 40)} L${f(x + 150)} ${f(ground + 70)} L${f(x + 210)} ${f(ground + 2)} Z`, tone: 'dark' }];
    case 'platform':
      return [{ d: `M${f(x)} ${f(ground - 60)} L${f(x + 180 * s)} ${f(ground - 60)} L${f(x + 150 * s)} ${f(ground - 20)} L${f(x + 110 * s)} ${f(ground)} L${f(x + 70 * s)} ${f(ground - 20)} Z`, tone: 'mid' }];
    case 'trees': {
      const parts: string[] = [];
      for (let i = 0; i < 3; i++) {
        const tx = x + i * rng.range(40, 70);
        const h = rng.range(150, 230) * s;
        parts.push(`M${f(tx - 5)} ${f(ground)} L${f(tx - 4)} ${f(ground - h * 0.5)} Q ${f(tx - 50)} ${f(ground - h * 0.6)}, ${f(tx - 30)} ${f(ground - h * 0.85)} Q ${f(tx)} ${f(ground - h * 1.1)}, ${f(tx + 30)} ${f(ground - h * 0.85)} Q ${f(tx + 50)} ${f(ground - h * 0.6)}, ${f(tx + 4)} ${f(ground - h * 0.5)} L${f(tx + 5)} ${f(ground)} Z`);
      }
      return [{ d: parts.join(' '), tone: 'mid' }];
    }
  }
}

// ---- near elements ---------------------------------------------------------------------------------------------------------

function nearPath(kind: Near, rng: UiRng): { fill: string; lines: string } {
  const top = SCENE_H - 70;
  if (kind === 'water') {
    const lines: string[] = [];
    for (let i = 0; i < 6; i++) {
      const y = top + 14 + i * 9;
      const x = rng.range(0, SCENE_W - 200);
      lines.push(`M${f(x)} ${f(y)} q 40 -5 80 0 t 80 0`);
    }
    return { fill: `M0 ${top + 10} C 300 ${top}, 900 ${top + 16}, ${SCENE_W} ${top + 6} L${SCENE_W} ${SCENE_H} L0 ${SCENE_H} Z`, lines: lines.join(' ') };
  }
  if (kind === 'clouds') {
    const parts: string[] = [];
    for (let x = -40; x < SCENE_W + 40; x += rng.range(90, 150)) parts.push(`M${f(x)} ${SCENE_H} a 70 ${f(rng.range(36, 60))} 0 0 1 ${f(rng.range(120, 180))} 0 Z`);
    return { fill: `${parts.join(' ')} M0 ${SCENE_H - 24} L${SCENE_W} ${SCENE_H - 24} L${SCENE_W} ${SCENE_H} L0 ${SCENE_H} Z`, lines: '' };
  }
  const pts: string[] = [`M0 ${SCENE_H}`, `L0 ${top + 20}`];
  for (let x = 0; x <= SCENE_W; x += rng.range(30, 70)) {
    const bump = kind === 'scree' ? rng.range(0, 34) : kind === 'grass' ? rng.range(4, 18) : rng.range(6, 28);
    pts.push(kind === 'scree' ? `L${f(x)} ${f(top + 26 - bump)}` : `Q ${f(x - 15)} ${f(top + 20 - bump)}, ${f(x)} ${f(top + 22)}`);
  }
  pts.push(`L${SCENE_W} ${SCENE_H} Z`);
  let lines = '';
  if (kind === 'grass') {
    const blades: string[] = [];
    for (let i = 0; i < 40; i++) {
      const x = rng.range(0, SCENE_W);
      blades.push(`M${f(x)} ${f(top + 30)} q ${f(rng.range(-6, 6))} -14 ${f(rng.range(-10, 10))} -26`);
    }
    lines = blades.join(' ');
  } else if (kind === 'roots') {
    const roots: string[] = [];
    for (let i = 0; i < 6; i++) {
      const x = rng.range(0, SCENE_W);
      roots.push(`M${f(x)} ${f(top + 20)} C ${f(x + 30)} ${f(top + 40)}, ${f(x + 60)} ${f(top + 30)}, ${f(x + 100)} ${f(top + 66)}`);
    }
    lines = roots.join(' ');
  }
  return { fill: pts.join(' '), lines };
}

// ---- particles ---------------------------------------------------------------------------------------------------------------

type ParticleKind = LocationArt['particles'];

/** DESIGN §17.2: at most 24 particles; how each kind moves (CSS keyframes in explore.css, off under reduced motion). */
const PARTICLE_MOTION: Readonly<Record<Exclude<ParticleKind, 'none'>, { count: number; motion: 'drift' | 'rise' | 'fall'; r: [number, number] }>> = {
  motes: { count: 18, motion: 'drift', r: [1.2, 2.6] },
  embers: { count: 16, motion: 'rise', r: [1.2, 2.4] },
  spores: { count: 18, motion: 'drift', r: [1.4, 3] },
  ash: { count: 22, motion: 'fall', r: [1, 2.2] },
  static: { count: 14, motion: 'drift', r: [0.8, 1.6] },
  shards: { count: 12, motion: 'drift', r: [1.6, 3.2] },
  rain: { count: 24, motion: 'fall', r: [0.8, 1.2] },
  fireflies: { count: 14, motion: 'drift', r: [1.6, 2.8] },
  snow: { count: 24, motion: 'fall', r: [1.2, 2.6] },
  pollen: { count: 16, motion: 'drift', r: [1, 2] },
};

// ---- the component ---------------------------------------------------------------------------------------------------------------

const TIME_WASH: Readonly<Record<Watch, { color: string; opacity: number }>> = {
  0: { color: '#ffb27a', opacity: 0.1 },
  1: { color: '#ffffff', opacity: 0.05 },
  2: { color: '#ff7a6a', opacity: 0.07 },
  3: { color: '#02030a', opacity: 0.32 },
};

const idOf = (s: string): string => s.replace(/[^a-z0-9_-]/gi, '_');

export function Scene({ location, region, art: artIn, state, reducedMotion, seed, className }: SceneProps): ReactNode {
  const art = artIn ?? location.art;
  const spec = TEMPLATES[art.template] ?? TEMPLATES.custom;
  const p: ScenePalette = scenePalette(location.regionId, region);
  const rng = uiRng(`${seed}:${location.id}`);
  const base = Math.round(SCENE_H * Math.min(0.85, Math.max(0.35, art.horizon)));
  const id = `scene-${idOf(location.id)}`;
  const timeless = art.timeOfDay === 'timeless';
  const night = art.timeOfDay === 'night';
  const band = art.timeOfDay === 'dawn' || art.timeOfDay === 'dusk';

  const ys = horizonLine(spec.curve, base, rng);
  const far = farPath(spec.far, base, spec.density, rng);
  const mids: { kind: Mid; x: number }[] = [];
  const slots = Math.max(2, Math.round(2 + spec.density * 3));
  for (let i = 0; i < slots; i++) {
    const kind = spec.mid[i % spec.mid.length] as Mid;
    const x = (SCENE_W / slots) * i + rng.range(10, SCENE_W / slots - 160);
    mids.push({ kind, x: Math.max(20, Math.min(SCENE_W - 220, x)) });
  }
  const near = nearPath(spec.near, rng);
  const particleSpec = art.particles === 'none' ? null : PARTICLE_MOTION[art.particles];
  const particles = particleSpec === null ? [] : Array.from({ length: particleSpec.count }, () => ({
    x: rng.range(0, SCENE_W),
    y: rng.range(40, SCENE_H - 60),
    r: rng.range(particleSpec.r[0], particleSpec.r[1]),
    delay: rng.range(0, 9),
    dur: rng.range(7, 14),
  }));
  const wash = TIME_WASH[state.watch];
  const breach = state.infected === true ? 0.55 : state.horde ? 0.22 : 0;
  const ceiling = spec.ceiling === true;
  const ceilingPath = ceiling
    ? (() => {
        const pts: string[] = ['M0 0', `L0 ${f(rng.range(50, 80))}`];
        for (let x = 40; x <= SCENE_W; x += rng.range(40, 80)) pts.push(`L${f(x - 20)} ${f(rng.range(70, 130))} L${f(x)} ${f(rng.range(40, 80))}`);
        pts.push(`L${SCENE_W} 60 L${SCENE_W} 0 Z`);
        return pts.join(' ');
      })()
    : '';

  return (
    <svg
      className={className === undefined ? 'scene' : `scene ${className}`}
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={location.name}
      focusable="false"
      data-template={art.template}
      data-motion={reducedMotion ? 'off' : 'on'}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? shade(p.skyTop, -0.4) : p.skyTop} />
          <stop offset="1" stopColor={night ? shade(p.skyBottom, -0.45) : art.timeOfDay === 'day' ? shade(p.skyBottom, 0.12) : p.skyBottom} />
        </linearGradient>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.accent} stopOpacity={0} />
          <stop offset="1" stopColor={p.accent} stopOpacity={0.3} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={p.accent} stopOpacity={0.45} />
          <stop offset="1" stopColor={p.accent} stopOpacity={0} />
        </radialGradient>
        <pattern id={`${id}-hatch`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill="#0b0414" fillOpacity={0.35} />
          <line x1="0" y1="0" x2="0" y2="14" stroke="#7b3fe4" strokeWidth={5} strokeOpacity={0.8} />
        </pattern>
      </defs>
      {/* 1 sky */}
      <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id}-sky)`} />
      {band && !ceiling ? <rect y={base - 120} width={SCENE_W} height={130} fill={`url(#${id}-band)`} /> : null}
      {/* 2 ceiling (underground and indoor places) */}
      {ceiling ? <path d={ceilingPath} fill={p.near} opacity={0.92} /> : null}
      {/* 3 far silhouettes, 35 % */}
      {far !== '' ? <path d={far} fill={p.far} opacity={0.35 + 0.3 * spec.density} /> : null}
      {/* 4 horizon */}
      <path d={groundPath(ys)} fill={shade(p.far, -0.25)} />
      {spec.curve === 'flooded' ? (
        <rect y={base + 4} width={SCENE_W} height={SCENE_H - base} fill={p.accent} opacity={0.08} />
      ) : null}
      {/* 5 mid elements, 70 % */}
      <g className="scene__mid" opacity={0.85}>
        {mids.map(({ kind, x }, i) =>
          midShapes(kind, x, yAt(ys, x + 40), rng).map((shape, j) => {
            const key = `${i}-${j}`;
            if (shape.tone === 'line') return <path key={key} d={shape.d} fill="none" stroke={shade(p.mid, 0.15)} strokeWidth={3} strokeLinecap="round" />;
            if (shape.tone === 'glow')
              return (
                <g key={key}>
                  <circle cx={x + 30} cy={yAt(ys, x + 40) - 50} r={90} fill={`url(#${id}-glow)`} className={reducedMotion ? undefined : 'scene__glow'} />
                  <path d={shape.d} fill={p.accent} opacity={0.9} />
                </g>
              );
            return <path key={key} d={shape.d} fill={shape.tone === 'dark' ? shade(p.near, -0.6) : p.mid} />;
          }),
        )}
      </g>
      {/* 6 near elements */}
      <path d={near.fill} fill={p.near} />
      {near.lines !== '' ? (
        <path d={near.lines} fill="none" stroke={spec.near === 'water' ? p.accent : shade(p.near, 0.25)} strokeOpacity={spec.near === 'water' ? 0.35 : 0.9} strokeWidth={2} strokeLinecap="round" />
      ) : null}
      {/* the hour (non-timeless places follow the Breach Clock) */}
      {timeless ? null : <rect width={SCENE_W} height={SCENE_H} fill={wash.color} opacity={wash.opacity} className="scene__wash" />}
      {/* 7 particles (≤ 24; still under reduced motion) */}
      {particleSpec === null ? null : (
        <g className={`scene__particles scene__particles--${particleSpec.motion}`} fill={p.accent}>
          {particles.map((pt, i) => (
            <circle
              key={i}
              cx={f(pt.x)}
              cy={f(pt.y)}
              r={f(pt.r)}
              opacity={0.7}
              className={reducedMotion ? undefined : 'scene__particle'}
              style={reducedMotion ? undefined : { animationDelay: `-${f(pt.delay)}s`, animationDuration: `${f(pt.dur)}s` }}
            />
          ))}
        </g>
      )}
      {/* 8 the Breach: infected nodes hatched violet-black, the whole world tinged while the Horde runs */}
      {breach > 0 ? <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id}-hatch)`} opacity={breach} data-breach="" /> : null}
    </svg>
  );
}
