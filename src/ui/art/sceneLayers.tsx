// The code layers both kinds of scene share (DESIGN §17.2, §17.7): particles, the hour's wash and the Breach hatch. U64's
// parametric <Scene> draws them over its own shapes; U71's painted backdrop draws them over the painting (SceneBackdrop.tsx).
// Pure; placement comes from the caller's `uiRng`, never the engine's Rng (D-032).
import type { ReactNode } from 'react';
import type { Watch } from '@engine/index';
import type { LocationArt } from '@schema/location';
import type { UiRng } from './uiRng';

export const SCENE_W = 1200;
export const SCENE_H = 500;

/** One decimal place: short, stable path data. */
export const f = (n: number): string => (Math.round(n * 10) / 10).toString();

/** The schema's kinds plus DESIGN §17.2's `dust`, `mist` and `void_flecks`, which only the UI-side overlay registry (U72) names. */
export type ParticleKind = LocationArt['particles'] | 'dust' | 'mist' | 'void_flecks';

/** The frame's rectangle a kind is scattered in: `[x0, y0, x1, y1]` in the 1200 × 500 viewBox. */
export type Area = readonly [number, number, number, number];

interface MotionSpec {
  count: number;
  motion: 'drift' | 'rise' | 'fall';
  r: [number, number];
  /** Seconds one cycle takes (default 7–14). */
  dur?: [number, number];
  /** Soft gradient puffs rather than hard dots (mist). */
  puff?: boolean;
}

/** DESIGN §17.2: at most 24 particles; how each kind moves (CSS keyframes in explore.css, off under reduced motion). */
export const PARTICLE_MOTION: Readonly<Record<Exclude<ParticleKind, 'none'>, MotionSpec>> = {
  dust: { count: 16, motion: 'drift', r: [0.8, 1.8] },
  mist: { count: 7, motion: 'drift', r: [26, 52], dur: [22, 34], puff: true },
  void_flecks: { count: 16, motion: 'rise', r: [0.9, 2] },
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

export interface Particle {
  x: number;
  y: number;
  r: number;
  delay: number;
  dur: number;
}

export interface ParticleSet {
  motion: 'drift' | 'rise' | 'fall';
  puff: boolean;
  dots: Particle[];
}

export interface ParticleOptions {
  /** Where to scatter them (default: the whole frame less the top and bottom bands). */
  area?: Area;
  /** The share of the kind's usual count, 0..1 (U72 overlays). */
  rate?: number;
}

/** The particles of `kind` (null for none), placed by `rng`. Never more than 24 (DESIGN §17.2). */
export function makeParticles(kind: ParticleKind, rng: UiRng, opts: ParticleOptions = {}): ParticleSet | null {
  if (kind === 'none') return null;
  const spec = PARTICLE_MOTION[kind];
  const [x0, y0, x1, y1] = opts.area ?? [0, 40, SCENE_W, SCENE_H - 60];
  const count = Math.min(24, Math.max(1, Math.round(spec.count * (opts.rate ?? 1))));
  const [d0, d1] = spec.dur ?? [7, 14];
  return {
    motion: spec.motion,
    puff: spec.puff === true,
    dots: Array.from({ length: count }, () => ({
      x: rng.range(x0, x1),
      y: rng.range(y0, y1),
      r: rng.range(spec.r[0], spec.r[1]),
      delay: rng.range(0, 9),
      dur: rng.range(d0, d1),
    })),
  };
}

/** `fill` is a colour, or for puffs (mist) a `url(#gradient)` the caller defines. */
export function ParticlesLayer({ set, fill, reducedMotion }: { set: ParticleSet; fill: string; reducedMotion: boolean }): ReactNode {
  return (
    <g className={`scene__particles scene__particles--${set.motion}${set.puff ? ' scene__particles--puff' : ''}`} fill={fill}>
      {set.dots.map((pt, i) => (
        <circle
          key={i}
          cx={f(pt.x)}
          cy={f(pt.y)}
          r={f(pt.r)}
          opacity={set.puff ? 0.5 : 0.7}
          className={reducedMotion ? undefined : 'scene__particle'}
          style={reducedMotion ? undefined : { animationDelay: `-${f(pt.delay)}s`, animationDuration: `${f(pt.dur)}s` }}
        />
      ))}
    </g>
  );
}

/** The hour over U64's drawn scene. */
export const TIME_WASH: Readonly<Record<Watch, { color: string; opacity: number }>> = {
  0: { color: '#ffb27a', opacity: 0.1 },
  1: { color: '#ffffff', opacity: 0.05 },
  2: { color: '#ff7a6a', opacity: 0.07 },
  3: { color: '#02030a', opacity: 0.32 },
};

/** The hour over a painting: subtler, because the paintings are already lit for dusk and deep shadow (ART §3). */
export const PAINT_WASH: Readonly<Record<Watch, { color: string; opacity: number }>> = {
  0: { color: '#ffb27a', opacity: 0.08 },
  1: { color: '#ffffff', opacity: 0.03 },
  2: { color: '#ff7a6a', opacity: 0.05 },
  3: { color: '#02030a', opacity: 0.22 },
};

/** The Breach's violet-black hatch (DESIGN §16.6), as a pattern to fill a rect with. */
export function HatchPattern({ id }: { id: string }): ReactNode {
  return (
    <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="14" height="14" fill="#0b0414" fillOpacity={0.35} />
      <line x1="0" y1="0" x2="0" y2="14" stroke="#7b3fe4" strokeWidth={5} strokeOpacity={0.8} />
    </pattern>
  );
}

/** DESIGN §17.2 `breachOverlay`: U70's value when given, else the Horde flags. */
export const breachLevel = (state: { breachOverlay?: number; infected?: boolean; horde: boolean }): number =>
  state.breachOverlay ?? (state.infected === true ? 0.55 : state.horde ? 0.22 : 0);

export const idOf = (s: string): string => s.replace(/[^a-z0-9_-]/gi, '_');
