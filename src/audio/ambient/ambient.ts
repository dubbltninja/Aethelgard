// The ambient layer (U75; DESIGN §18.1, §18.2, §18.4, §18.5): the region beds on the `ambient` bus, the Threshold drone, an
// unease layer while the Breach spreads, and the Tyrant theme on the `music` bus. The UI states what is happening as an
// `AmbientScene`; this controller makes the sound follow it and keeps the graph small:
//   - nothing exists before the engine's context is running (the first gesture), and it follows mute and the volumes;
//   - a new bed fades in over XFADE seconds while the old one fades out, so exactly one bed plays; the old one is cut from
//     the graph when its fade is done, and at most MAX_RETIRING linger (the oldest is cut at once);
//   - the same bed for a different interior / infection state is changed in place (a filter, a layer), never restarted;
//   - the theme fades in over a bed that ducks under it; the bed, the theme and the unease layer are each one Layer.
// A pump (a 300 ms interval; tests call `pump()`) schedules each layer's sparse events a second or two ahead of the audio
// clock and cuts event voices that have rung out. The interval runs only while something is alive.
import type { AudioEngine } from '../engine/engine';
import { audioRng } from '../synth/synth';
import { buildBed, disposeLayer, fadeTo, noiseSet, runEvents, setInterior, setPulse, type Layer, type Rt } from './layers';
import { RECIPES, UNEASE, type Recipe } from './recipes';
import { buildTheme } from './theme';

export interface AmbientScene {
  /** The ambient preset id of the place (`location.ambient ?? region.ambient`); null on the Title and in the endings. */
  bed: string | null;
  /** The place is indoors: the bed through a darker filter. */
  interior: boolean;
  /** The node is infected, or a Horde runs. */
  infected: boolean;
  /** The Tyrant's phase 0..3 while a Tyrant fight is on, else -1. */
  tyrant: number;
  /** The communion's resolve 0..8 in a Tyrant fight that has become one, else -1. */
  resolve: number;
}

export const NO_SCENE: AmbientScene = { bed: null, interior: false, infected: false, tyrant: -1, resolve: -1 };

export interface AmbientStatus {
  bed: string | null;
  interior: boolean;
  infected: boolean;
  /** The theme while it plays: phase 0..3 and how far the communion has thinned it (0..1). */
  theme: { phase: number; purity: number } | null;
  ducked: boolean;
  /** Layers alive in the graph, fading ones included. */
  layers: number;
}

export interface Ambient {
  set(scene: AmbientScene): void;
  current(): AmbientStatus;
  /** Schedules due events and cuts finished layers (the interval calls it; tests call it with the mock clock). */
  pump(): void;
  dispose(): void;
}

export const XFADE = 2;
export const THEME_FADE = 2.5;
export const DUCK = 0.4;
const MAX_RETIRING = 2;
const AHEAD = 1.5;
const PUMP_MS = 300;

/** How far the communion has pulled the theme back to a pure C minor: resolve 1 (the start) is 0, resolve 8 is 1. */
export const purityOf = (resolve: number): number => (resolve < 0 ? 0 : Math.min(1, Math.max(0, (resolve - 1) / 7)));

const same = (a: AmbientScene, b: AmbientScene): boolean => a.bed === b.bed && a.interior === b.interior && a.infected === b.infected && a.tyrant === b.tyrant && a.resolve === b.resolve;

export function createAmbient(engine: AudioEngine, options: { pumpMs?: number; seed?: number } = {}): Ambient {
  const pumpMs = options.pumpMs ?? PUMP_MS;
  let scene: AmbientScene = NO_SCENE;
  let rt: Rt | null = null;
  let rtCtx: AudioContext | null = null;
  let duck: GainNode | null = null;
  let bed: { id: string; L: Layer } | null = null;
  let unease: Layer | null = null;
  let theme: Layer | null = null;
  let retiring: { L: Layer; at: number }[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  const live = (): Layer[] => [bed?.L, unease, theme, ...retiring.map((r) => r.L)].filter((l): l is Layer => l != null);

  const runtime = (ctx: AudioContext): Rt => {
    if (rt === null || rtCtx !== ctx) {
      const rnd = audioRng((options.seed ?? 0x75) ^ 0xa11b);
      rt = { ctx, rnd, ...noiseSet(ctx, rnd), reduced: engine.reducedMotion, sfx: () => engine.bus('sfx') };
      rtCtx = ctx;
    }
    return rt;
  };

  const retire = (L: Layer, fade: number, now: number): void => {
    fadeTo(L, 0, fade / 3.5, now);
    retiring.push({ L, at: now + fade * 1.2 + 0.1 });
    while (retiring.length > MAX_RETIRING) disposeLayer((retiring.shift() as { L: Layer }).L);
  };

  const release = (): void => {
    if (live().length > 0) return;
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (duck !== null) duck.disconnect();
    duck = null;
  };

  const pump = (): void => {
    if (rt === null) return;
    const now = rt.ctx.currentTime;
    const ready = rt.ctx.state === 'running';
    retiring = retiring.filter((r) => r.at > now || void disposeLayer(r.L));
    if (ready) for (const L of [bed?.L, unease, theme]) if (L != null) runEvents(rt, L, now, AHEAD);
    release();
  };

  const teardown = (): void => {
    for (const L of live()) disposeLayer(L);
    bed = unease = theme = null;
    retiring = [];
    release();
  };

  const sync = (): void => {
    const ctx = engine.context();
    if (ctx === null || ctx.state === 'closed') return teardown();
    if (engine.state() !== 'running') return; // a locked or hidden-tab context keeps what it has
    const r = runtime(ctx);
    const now = ctx.currentTime;
    const lv = engine.levels();
    const open = !lv.muted && lv.volumes.master > 0;
    const wantBed = open && lv.volumes.ambient > 0 && scene.bed !== null && RECIPES[scene.bed] !== undefined ? scene.bed : null;
    const wantTheme = open && lv.volumes.music > 0 && scene.tyrant >= 0;
    const ambientBus = engine.bus('ambient');
    const musicBus = engine.bus('music');
    if (ambientBus === null || musicBus === null) return;
    const pulse = !engine.reducedMotion();

    if (wantBed !== (bed?.id ?? null)) {
      if (bed !== null) retire(bed.L, wantBed === null ? 0.15 : XFADE, now);
      bed = null;
      if (wantBed !== null) {
        duck ??= ctx.createGain();
        duck.connect(ambientBus);
        const L = buildBed(r, RECIPES[wantBed] as Recipe, duck, scene.interior, pulse);
        fadeTo(L, 1, XFADE / 3.5, now);
        bed = { id: wantBed, L };
      }
    }
    if (bed !== null) {
      setInterior(bed.L, scene.interior, now);
      setPulse(bed.L, pulse, now);
    }

    const wantUnease = bed !== null && scene.infected;
    if (wantUnease && unease === null && duck !== null) {
      unease = buildBed(r, UNEASE, duck, false, pulse);
      fadeTo(unease, 1, 1, now);
    } else if (!wantUnease && unease !== null) {
      retire(unease, 3, now);
      unease = null;
    }
    if (unease !== null) setPulse(unease, pulse, now);

    if (wantTheme && theme === null) {
      theme = buildTheme(r, musicBus);
      fadeTo(theme, 1, THEME_FADE / 3.5, now);
    } else if (!wantTheme && theme !== null) {
      retire(theme, THEME_FADE, now);
      theme = null;
    }
    theme?.update?.(Math.max(0, scene.tyrant), purityOf(scene.resolve));
    duck?.gain.setTargetAtTime(theme === null ? 1 : DUCK, now, 0.6);

    if (live().length > 0 && timer === null && pumpMs > 0) timer = setInterval(pump, pumpMs);
    release();
  };

  const unsubscribe = engine.subscribe(sync);
  return {
    set(next) {
      if (same(scene, next)) return;
      scene = { ...next };
      sync();
    },
    current: () => ({
      bed: bed?.id ?? null,
      interior: bed?.L.interior ?? false,
      infected: unease !== null,
      theme: theme === null ? null : { phase: theme.phase, purity: theme.purity },
      ducked: theme !== null,
      layers: live().length,
    }),
    pump,
    dispose() {
      unsubscribe();
      teardown();
    },
  };
}
