// The audio engine (DESIGN §18.1, §18.5; PLAN §6.5): one AudioContext, created on the first user gesture (browsers start
// audio only after one) and resumed there; nothing plays before that, and a browser without Web Audio (or a test) gets
// a silent engine that never throws. Graph:
//
//   sfx ─┐
//   ui  ─┼─ master (gain) → compressor → speakers
//   ambient ─┤   (U75's region drones; this unit leaves the bus ready)
//   music ───┘   (the combat percussion now; U75's Tyrant theme)
//
// Volumes are 0..1 per bus, heard as v² (perceptual, §18.5); the ui bus follows the effects volume. Mute sets master to 0
// at once, and a muted (or silent) bus schedules nothing at all. SFX are fire-and-forget voices: at most MAX_VOICES at
// once (the oldest is faded out and stolen), and the same sound is not started twice within THROTTLE seconds.
// Reduced motion drops the combat hat ticks (§18.5; U75 drops the ambient pulse). Hidden tab → suspend; shown → resume.
import { audioRng, noiseBuffer, type Voice } from '../synth/synth';
import { RECIPES, type SoundId, type SoundParams } from '../sfx/sfx';
import type { Cue } from '../map/map';

export type BusName = 'sfx' | 'ui' | 'ambient' | 'music';
export interface Levels {
  volumes: { master: number; sfx: number; ambient: number; music: number };
  muted: boolean;
}
export interface PlayOptions extends SoundParams {
  /** Seconds from now. */
  at?: number;
  vel?: number;
  pan?: number;
  /** Override the sound's own bus (the Settings test sound for a bus that has no sounds of its own yet). */
  bus?: BusName;
}
export type AudioState = 'unavailable' | 'locked' | 'suspended' | 'running' | 'closed';

export interface AudioEngine {
  /** Create (first call) and resume the context; call from a user gesture. Resolves true when running. */
  unlock(): Promise<boolean>;
  state(): AudioState;
  /** Schedules one sound; false when it was not (locked, muted, silent bus, throttled, reduced motion, an error). */
  play(id: SoundId, opts?: PlayOptions): boolean;
  playCues(cues: readonly Cue[]): void;
  setLevels(levels: Levels): void;
  setReducedMotion(on: boolean): void;
  suspend(): void;
  resume(): void;
  /** A bus to connect to (U75's ambient and music), or null before the context exists. */
  bus(name: BusName): GainNode | null;
  /** The last sounds scheduled, newest last (the e2e spy and the audition page read it). */
  played(): readonly SoundId[];
  voices(): number;
  dispose(): void;
}

type ContextCtor = new (options?: AudioContextOptions) => AudioContext;
export interface EngineOptions {
  /** Makes the context (tests pass a mock); default: the browser's AudioContext, or null without one. */
  create?: () => AudioContext | null;
  seed?: number;
}

export const MAX_VOICES = 8;
export const THROTTLE = 0.045;
const PLAYED_KEPT = 40;
const TAIL = 0.5;

const UI_SOUNDS: ReadonlySet<SoundId> = new Set(['sfx_ui_tick', 'sfx_ui_confirm', 'sfx_ui_back', 'sfx_ui_error']);
const busOf = (id: SoundId): BusName => (id.startsWith('sfx_perc') ? 'music' : UI_SOUNDS.has(id) ? 'ui' : 'sfx');

function browserContext(): AudioContext | null {
  const g = globalThis as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  return Ctor === undefined ? null : new Ctor({ latencyHint: 'interactive' });
}

interface Live {
  end: number;
  gain: GainNode;
  out: AudioNode;
  sources: AudioScheduledSourceNode[];
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function createAudioEngine(options: EngineOptions = {}): AudioEngine {
  const create = options.create ?? browserContext;
  const rnd = audioRng(options.seed ?? 0x5eed);
  let ctx: AudioContext | null = null;
  let unavailable = false;
  let disposed = false;
  let starting = false;
  let master: GainNode | null = null;
  let buses: Record<BusName, GainNode> | null = null;
  let noise: AudioBuffer | null = null;
  let levels: Levels = { volumes: { master: 0.8, sfx: 0.8, ambient: 0.6, music: 0.5 }, muted: false };
  let reduced = false;
  let live: Live[] = [];
  const lastStart = new Map<SoundId, number>();
  const history: SoundId[] = [];

  const gainOf = (bus: BusName | 'master'): number => {
    if (bus === 'master') return levels.muted ? 0 : clamp01(levels.volumes.master) ** 2;
    return clamp01(levels.volumes[bus === 'ui' ? 'sfx' : bus]) ** 2;
  };

  const applyLevels = (instant: boolean): void => {
    if (ctx === null || master === null || buses === null) return;
    const now = ctx.currentTime;
    const set = (node: GainNode, value: number, at: boolean): void => {
      node.gain.cancelScheduledValues(now);
      if (at) node.gain.setValueAtTime(value, now);
      else node.gain.setTargetAtTime(value, now, 0.015);
    };
    set(master, gainOf('master'), instant || levels.muted);
    for (const name of Object.keys(buses) as BusName[]) set(buses[name], gainOf(name), instant);
  };

  const build = (c: AudioContext): void => {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.connect(c.destination);
    master = c.createGain();
    master.connect(comp);
    const bus = (): GainNode => {
      const g = c.createGain();
      g.connect(master as GainNode);
      return g;
    };
    buses = { sfx: bus(), ui: bus(), ambient: bus(), music: bus() };
    noise = noiseBuffer(c, rnd);
    applyLevels(true);
  };

  const steal = (voice: Live, now: number): void => {
    voice.end = now;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, 0.004);
    for (const s of voice.sources) s.stop(now + 0.02);
  };

  const engine: AudioEngine = {
    async unlock() {
      if (disposed || unavailable) return false;
      try {
        if (ctx === null) {
          ctx = create();
          if (ctx === null) {
            unavailable = true;
            return false;
          }
          build(ctx);
        }
        if (ctx.state === 'suspended') {
          // the gesture's own sounds are scheduled meanwhile and play once the context runs
          starting = true;
          await ctx.resume().finally(() => (starting = false));
        }
        return ctx.state === 'running';
      } catch {
        return false;
      }
    },
    state() {
      if (unavailable) return 'unavailable';
      if (disposed) return 'closed';
      if (ctx === null) return 'locked';
      return ctx.state === 'running' ? 'running' : ctx.state === 'closed' ? 'closed' : 'suspended';
    },
    play(id, opts = {}) {
      if (ctx === null || buses === null || noise === null || disposed || (ctx.state !== 'running' && !starting)) return false;
      const bus = opts.bus ?? busOf(id);
      if (gainOf('master') === 0 || gainOf(bus) === 0) return false;
      if (reduced && id === 'sfx_perc_hat') return false;
      try {
        const now = ctx.currentTime;
        const start = now + Math.max(0, opts.at ?? 0);
        const last = lastStart.get(id);
        if (last !== undefined && Math.abs(start - last) < THROTTLE) return false;
        // a voice that has rung out (feedback-delay tails included) is disconnected; the oldest sounding one is stolen
        live = live.filter((v) => v.end + TAIL > now || void v.out.disconnect());
        const sounding = live.filter((v) => v.end > now);
        while (sounding.length >= MAX_VOICES) steal(sounding.shift() as Live, now);
        const gain = ctx.createGain();
        gain.gain.value = clamp01(opts.vel ?? 1);
        let out: AudioNode = gain;
        if (opts.pan !== undefined && opts.pan !== 0 && typeof ctx.createStereoPanner === 'function') {
          const panner = ctx.createStereoPanner();
          panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
          gain.connect(panner);
          out = panner;
        }
        out.connect(buses[bus]);
        const voice: Voice = { ctx, out: gain, t0: start, sources: [], noise, rnd };
        const length = RECIPES[id](voice, opts);
        live.push({ end: start + length, gain, out, sources: voice.sources });
        lastStart.set(id, start);
        history.push(id);
        if (history.length > PLAYED_KEPT) history.shift();
        return true;
      } catch {
        return false;
      }
    },
    playCues(cues) {
      for (const cue of cues) engine.play(cue.id, cue);
    },
    setLevels(next) {
      levels = { volumes: { ...next.volumes }, muted: next.muted };
      applyLevels(false);
    },
    setReducedMotion(on) {
      reduced = on;
    },
    suspend() {
      if (ctx?.state === 'running') void ctx.suspend().catch(() => undefined);
    },
    resume() {
      if (ctx?.state === 'suspended' && !disposed) void ctx.resume().catch(() => undefined);
    },
    bus: (name) => (buses === null ? null : buses[name]),
    played: () => history,
    voices: () => (ctx === null ? 0 : live.filter((v) => v.end > (ctx as AudioContext).currentTime).length),
    dispose() {
      disposed = true;
      live = [];
      if (ctx !== null && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
    },
  };
  return engine;
}
