// Web Audio building blocks (DESIGN §18.1): every sound in the game is made from these — oscillators, one noise buffer
// generated once per context, biquad filters, gain envelopes and a feedback-delay "room". No audio files (D-036).
//
// A `Voice` is one fire-and-forget sound: its layers connect to `voice.out` (the voice's own gain, then a panner, then a
// bus), start at `voice.t0 + at` and register their sources so the engine can stop a voice it steals. Times are seconds.
// Levels are linear peak gains; keep each layer ≤ 0.5 so a voice stays well under clipping before the buses scale it.

export interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;
  t0: number;
  sources: AudioScheduledSourceNode[];
  noise: AudioBuffer;
  /** The audio layer's own random stream (DESIGN §18.1: never the engine's), 0..1. */
  rnd: () => number;
}

/** A tiny fixed-seed generator (mulberry32): audio variation never touches game state. */
export function audioRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One second of white noise, made once per context; every noise layer reads it from a random offset. */
export function noiseBuffer(ctx: BaseAudioContext, rnd: () => number): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
  return buffer;
}

const QUIET = 0.0001;

/**
 * A gain envelope into `out`: silence → `peak` over `attack` (linear) → silence at `dur` (exponential). `reverse` swells
 * instead (exponential rise to the end, then a 20 ms cut) — the "reversed envelope" of DESIGN §18.3.
 */
export function envelope(v: Voice, out: AudioNode, start: number, dur: number, peak: number, attack = 0.004, reverse = false): GainNode {
  const g = v.ctx.createGain();
  const p = g.gain;
  p.setValueAtTime(QUIET, start);
  if (reverse) {
    p.exponentialRampToValueAtTime(peak, start + dur * 0.92);
    p.linearRampToValueAtTime(0, start + dur);
  } else {
    p.linearRampToValueAtTime(peak, start + Math.min(attack, dur / 2));
    p.exponentialRampToValueAtTime(QUIET, start + dur);
  }
  g.connect(out);
  return g;
}

/** A biquad filter into `out`, its cutoff optionally gliding (exponentially) to `to` over `glide` seconds. */
export function filter(v: Voice, out: AudioNode, type: BiquadFilterType, f: number, q = 0.7, to?: number, start = v.t0, glide = 0): BiquadFilterNode {
  const node = v.ctx.createBiquadFilter();
  node.type = type;
  node.Q.value = q;
  node.frequency.setValueAtTime(f, start);
  if (to !== undefined) node.frequency.exponentialRampToValueAtTime(to, start + glide);
  node.connect(out);
  return node;
}

export interface ToneSpec {
  type?: OscillatorType;
  f: number;
  /** Glide (exponential) to this pitch over `glide` (default: the whole note). */
  to?: number;
  glide?: number;
  /** Later pitches stepped in at even intervals across the note (an arpeggio in one oscillator). */
  steps?: readonly number[];
  /** Seconds after the voice's start. */
  at?: number;
  dur: number;
  gain: number;
  attack?: number;
  detune?: number;
  /** Instead of the voice output (a filter or a delay made by the recipe). */
  out?: AudioNode;
}

export function tone(v: Voice, s: ToneSpec): void {
  const start = v.t0 + (s.at ?? 0);
  const o = v.ctx.createOscillator();
  o.type = s.type ?? 'sine';
  const f = o.frequency;
  f.setValueAtTime(s.f, start);
  if (s.to !== undefined) f.exponentialRampToValueAtTime(s.to, start + (s.glide ?? s.dur));
  const steps = s.steps ?? [];
  steps.forEach((pitch, i) => f.setValueAtTime(pitch, start + (s.dur * (i + 1)) / (steps.length + 1)));
  if (s.detune !== undefined) o.detune.value = s.detune;
  o.connect(envelope(v, s.out ?? v.out, start, s.dur, s.gain, s.attack));
  o.start(start);
  o.stop(start + s.dur + 0.02);
  v.sources.push(o);
}

export interface NoiseSpec {
  at?: number;
  dur: number;
  gain: number;
  attack?: number;
  reverse?: boolean;
  /** A filter on the noise (absent: raw white noise). */
  type?: BiquadFilterType;
  f?: number;
  /** The filter's cutoff glides here over the whole burst. */
  to?: number;
  q?: number;
  /** A pan sweep from → to across the burst (`sfx_miss`); skipped where the browser has no StereoPanner. */
  pan?: readonly [number, number];
  out?: AudioNode;
}

export function noise(v: Voice, s: NoiseSpec): void {
  const start = v.t0 + (s.at ?? 0);
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  // D-135: loop the 1 s buffer — a burst starting up to 0.5 s in would otherwise run dry after ~0.5 s (sfx_breach_tear's 2 s layer)
  src.loop = true;
  let out = s.out ?? v.out;
  if (s.pan !== undefined && typeof v.ctx.createStereoPanner === 'function') {
    const panner = v.ctx.createStereoPanner();
    panner.pan.setValueAtTime(s.pan[0], start);
    panner.pan.linearRampToValueAtTime(s.pan[1], start + s.dur);
    panner.connect(out);
    out = panner;
  }
  const shaped = envelope(v, out, start, s.dur, s.gain, s.attack, s.reverse);
  src.connect(s.type === undefined ? shaped : filter(v, shaped, s.type, s.f ?? 1000, s.q, s.to, start, s.dur));
  src.start(start, v.rnd() * 0.5);
  src.stop(start + s.dur + 0.02);
  v.sources.push(src);
}

/**
 * Convolution-free reverb (DESIGN §18.1): a feedback delay through a lowpass. Returns the node a layer connects to; the
 * dry signal and the decaying repeats both reach the voice output.
 */
export function room(v: Voice, delay = 0.12, feedback = 0.35, cutoff = 2200): AudioNode {
  const input = v.ctx.createGain();
  const line = v.ctx.createDelay(1);
  const loop = v.ctx.createGain();
  line.delayTime.value = delay;
  loop.gain.value = feedback;
  input.connect(v.out);
  input.connect(line);
  line.connect(filter(v, loop, 'lowpass', cutoff));
  loop.connect(line);
  loop.connect(v.out);
  return input;
}
