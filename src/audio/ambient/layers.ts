// Running graphs for the ambient layer (U75). A `Layer` is one faded unit: a region bed, the infection unease, or the Tyrant
// theme. It owns its sources (stopped when it is disposed), its short-lived event voices (disconnected once they have rung
// out) and a schedule of sparse events that the controller's pump runs a little ahead of the clock. Disposing a layer stops
// its sources and cuts its output from the graph, so nothing that was ever built stays connected (the leak test).
import { noise as burst, room, tone, type Voice } from '../synth/synth';
import type { EventSpec, Recipe } from './recipes';

export interface Rt {
  ctx: AudioContext;
  rnd: () => number;
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
  /** Live: reduced motion (§18.5) drops the pulse and the stutter gate. */
  reduced: () => boolean;
  /** The sfx bus, where the distant hammer sounds (§18.2). */
  sfx: () => AudioNode | null;
}

export interface Sched {
  next: number;
  every: [number, number];
  fire: (t: number) => void;
}

export interface Layer {
  out: GainNode;
  srcs: AudioScheduledSourceNode[];
  trans: { out: AudioNode; end: number }[];
  ev: Sched[];
  pulses: { g: GainNode; v: number }[];
  pulse: boolean;
  dark: BiquadFilterNode | null;
  interior: boolean;
  wind: { g: AudioParam; base: number } | null;
  gate: GainNode | null;
  /** The theme's phase and purity update (theme.ts); null for beds. */
  update: ((phase: number, purity: number) => void) | null;
  phase: number;
  purity: number;
}

/** A bed's overall level before the buses: quiet by default (the ambient bus defaults to 0.6, heard as 0.36). */
export const BED_TRIM = 0.6;
export const OPEN = 14000;
export const DARK = 1100;
export const dbGain = (db: number): number => 10 ** (db / 20);

/** Three seconds of white, pink and brown noise per context (the engine's second of white is too short to loop unheard). */
export function noiseSet(ctx: BaseAudioContext, rnd: () => number): Pick<Rt, 'white' | 'pink' | 'brown'> {
  const n = Math.floor(ctx.sampleRate * 3);
  const make = (fill: (d: Float32Array) => void): AudioBuffer => {
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    fill(d);
    let peak = 0;
    for (const x of d) peak = Math.max(peak, Math.abs(x));
    if (peak > 0) for (let i = 0; i < d.length; i++) d[i] = ((d[i] as number) / peak) * 0.9;
    return buffer;
  };
  return {
    white: make((d) => {
      for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    }),
    pink: make((d) => {
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = rnd() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = b0 + b1 + b2 + w * 0.1848;
      }
    }),
    brown: make((d) => {
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02;
        d[i] = last;
      }
    }),
  };
}

export function newLayer(rt: Rt, dest: AudioNode): Layer {
  const out = rt.ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  return { out, srcs: [], trans: [], ev: [], pulses: [], pulse: true, dark: null, interior: false, wind: null, gate: null, update: null, phase: 0, purity: 0 };
}

export function gainNode(rt: Rt, value: number, to?: AudioNode): GainNode {
  const g = rt.ctx.createGain();
  g.gain.value = value;
  if (to !== undefined) g.connect(to);
  return g;
}

export function filterNode(rt: Rt, type: BiquadFilterType, hz: number, q?: number, to?: AudioNode): BiquadFilterNode {
  const f = rt.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  if (q !== undefined) f.Q.value = q;
  if (to !== undefined) f.connect(to);
  return f;
}

export function oscNode(rt: Rt, L: Layer, type: OscillatorType, hz: number): OscillatorNode {
  const o = rt.ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  o.start(rt.ctx.currentTime);
  L.srcs.push(o);
  return o;
}

/** A sine LFO of `depth` (in the target's units) on `target`; returns the depth gain. */
export function lfo(rt: Rt, L: Layer, hz: number, depth: number, target: AudioParam): GainNode {
  const g = gainNode(rt, depth);
  oscNode(rt, L, 'sine', hz).connect(g);
  g.connect(target);
  return g;
}

/** A short-lived voice into `dest`, cut from the graph by the pump `len` seconds after `t`. */
export function spot(rt: Rt, L: Layer, dest: AudioNode, t: number, len: number): Voice {
  const out = gainNode(rt, 1, dest);
  L.trans.push({ out, end: t + len });
  return { ctx: rt.ctx, out, t0: t, sources: [], noise: rt.white, rnd: rt.rnd };
}

function fireEvent(rt: Rt, L: Layer, e: EventSpec, t: number, dest: AudioNode): void {
  const g = dbGain(e.db);
  const r = rt.rnd;
  switch (e.k) {
    case 'hammer': {
      const v = spot(rt, L, rt.sfx() ?? dest, t, 0.5);
      burst(v, { dur: 0.05, gain: g, type: 'bandpass', f: 1400, q: 3 });
      tone(v, { f: 620, to: 480, dur: 0.25, gain: g * 0.7 });
      break;
    }
    case 'burst':
      burst(spot(rt, L, dest, t, 0.6), { dur: 0.12 + r() * 0.25, gain: g, type: 'bandpass', f: 3000, q: 4, attack: 0.02 });
      break;
    case 'drip': {
      const v = spot(rt, L, dest, t, 1.8);
      const f = 1100 + r() * 1100;
      tone(v, { f, to: f * 1.5, glide: 0.06, dur: 0.14, gain: g, out: room(v, 0.11, 0.35, 1800) });
      break;
    }
    case 'chirp': {
      const v = spot(rt, L, dest, t, 0.5);
      for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
        const f = 2500 + r() * 1500;
        tone(v, { at: i * 0.07, f, to: f * 1.15, dur: 0.04, gain: g });
      }
      break;
    }
    case 'bell': {
      const v = spot(rt, L, dest, t, 6);
      const hall = room(v, 0.19, 0.5, 2400);
      tone(v, { f: 784, dur: 4, gain: g, attack: 0.01, out: hall });
      tone(v, { f: 1568, dur: 2, gain: g * 0.35, attack: 0.01, out: hall });
      break;
    }
    case 'tick':
      burst(spot(rt, L, dest, t, 0.1), { dur: 0.014, gain: g, type: 'bandpass', f: 7000, q: 5, attack: 0.001 });
      break;
    case 'gate':
      if (L.gate !== null && !rt.reduced()) {
        const p = L.gate.gain;
        p.setValueAtTime(1, t);
        for (let i = 0; i < 3; i++) {
          p.setValueAtTime(0.12, t + 0.28 * i);
          p.setValueAtTime(1, t + 0.28 * i + 0.12);
        }
      }
      break;
    case 'gust':
      if (L.wind !== null) {
        const { g: p, base } = L.wind;
        p.setValueAtTime(base, t);
        p.linearRampToValueAtTime(base * 1.9, t + 1.8);
        p.linearRampToValueAtTime(base, t + 4.5);
      }
      break;
  }
}

/** Builds a region bed (or the unease layer) from its recipe; the layer's output starts silent, the controller fades it in. */
export function buildBed(rt: Rt, r: Recipe, dest: AudioNode, interior: boolean, pulse: boolean): Layer {
  const L = newLayer(rt, dest);
  L.interior = interior;
  const now = rt.ctx.currentTime;
  const dark = filterNode(rt, 'lowpass', interior ? DARK : OPEN, undefined, L.out);
  L.dark = dark;
  let tail: AudioNode = dark;
  if (r.hp !== undefined) tail = filterNode(rt, 'highpass', r.hp, undefined, tail);
  if (r.ev?.some((e) => e.k === 'gate')) tail = L.gate = gainNode(rt, 1, tail);
  const amp = r.ampLfo?.[1] ?? 0;
  const body = gainNode(rt, BED_TRIM * (1 - amp), tail);
  if (r.ampLfo !== undefined) {
    const v = BED_TRIM * amp;
    L.pulses.push({ g: lfo(rt, L, r.ampLfo[0], pulse ? v : 0, body.gain), v });
    L.pulse = pulse;
  }

  const mix = gainNode(rt, 1);
  const lp = filterNode(rt, 'lowpass', r.lp ?? 20000, undefined, body);
  mix.connect(lp);
  if (r.filterLfo !== undefined) lfo(rt, L, r.filterLfo[0], r.filterLfo[1], lp.frequency);
  const panner = typeof rt.ctx.createStereoPanner === 'function';
  for (const o of r.osc) {
    const s = oscNode(rt, L, o.t, o.f);
    const g = gainNode(rt, dbGain(o.db));
    s.connect(g);
    if (o.pan !== undefined && panner) {
      const p = rt.ctx.createStereoPanner();
      g.connect(p);
      p.connect(mix);
      lfo(rt, L, o.pan, 0.8, p.pan);
    } else g.connect(mix);
    if (o.drift !== undefined) lfo(rt, L, o.drift[0], o.drift[1], s.detune);
  }

  for (const n of r.noise ?? []) {
    const src = rt.ctx.createBufferSource();
    src.buffer = rt[n.c];
    src.loop = true;
    src.start(now, rt.rnd() * 2);
    L.srcs.push(src);
    const g = gainNode(rt, dbGain(n.db), body);
    let prev: AudioNode = src;
    n.f.forEach(([type, hz, q], i) => {
      const f = filterNode(rt, type, hz, q);
      prev.connect(f);
      prev = f;
      if (i === 0 && n.sweep !== undefined) lfo(rt, L, n.sweep[0], n.sweep[1], f.frequency);
    });
    prev.connect(g);
    if (n.gust === true) L.wind = { g: g.gain, base: dbGain(n.db) };
  }

  for (const e of r.ev ?? []) L.ev.push({ next: now + 0.6 + rt.rnd() * e.every[0], every: [e.every[0], e.every[1]], fire: (t) => fireEvent(rt, L, e, t, body) });
  return L;
}

/** Runs the events due within `ahead` seconds and cuts finished event voices; after a long pause nothing is caught up. */
export function runEvents(rt: Rt, L: Layer, now: number, ahead: number): void {
  for (const s of L.ev) {
    if (s.next < now) s.next = now + 0.05;
    for (let n = 0; n < 4 && s.next < now + ahead; n++) {
      s.fire(s.next);
      s.next += s.every[0] + rt.rnd() * (s.every[1] - s.every[0]);
    }
  }
  L.trans = L.trans.filter((tr) => tr.end > now || void tr.out.disconnect());
}

export function fadeTo(L: Layer, value: number, tc: number, now: number): void {
  L.out.gain.cancelScheduledValues(now);
  L.out.gain.setTargetAtTime(value, now, tc);
}

export function setPulse(L: Layer, on: boolean, now: number): void {
  if (L.pulse === on) return;
  L.pulse = on;
  for (const p of L.pulses) p.g.gain.setTargetAtTime(on ? p.v : 0, now, 0.4);
}

export function setInterior(L: Layer, on: boolean, now: number): void {
  if (L.interior === on || L.dark === null) return;
  L.interior = on;
  L.dark.frequency.setTargetAtTime(on ? DARK : OPEN, now, 0.9);
}

export function disposeLayer(L: Layer): void {
  for (const s of L.srcs) {
    try {
      s.stop();
    } catch {
      // already stopped
    }
  }
  L.out.disconnect();
  for (const tr of L.trans) tr.out.disconnect();
  L.srcs = [];
  L.trans = [];
  L.ev = [];
}
