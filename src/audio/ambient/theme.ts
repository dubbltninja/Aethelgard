// The Tyrant theme (DESIGN §18.4), on the music bus during the Tyrant's two fights, built from the Threshold drone:
//   - C1 (32.7 Hz) over a second sine at 34.6 Hz, which beat about 2 Hz: the Tyrant's held moment;
//   - a triad that is almost in tune on triangle waves: C3, E-flat 3 at +25 cents and G3 at -25 cents;
//   - a 7 kHz clock tick every 0.75 s and a reversed-envelope noise swell every 8 s.
// Phases add a voice: Phase 2 a sawtooth at 65 Hz filtered at 300 Hz; Phase 3 doubles the tick (and the clock begins to come
// apart: a second tick 30 ms behind per phase); Phase 4 lets every detune drift by up to 50 cents.
// The communion thins it, since the Tyrant is listening: as resolve rises (`purity` 0..1) the triad comes back to just
// intonation (a pure C minor), the beating slows to a unison, the tick and the swell fall silent and the whole theme falls
// away to under half. All of it is live parameters on one running graph: a phase or a resolve change never restarts anything.
import { noise as burst } from '../synth/synth';
import { dbGain, filterNode, gainNode, lfo, newLayer, oscNode, spot, type Layer, type Rt } from './layers';

/** C3, E-flat 3, G3 in equal temperament; the triad's cents from these, detuned and then just (6/5, 3/2). */
const TRIAD: readonly { f: number; off: number; just: number; drift: number }[] = [
  { f: 130.81, off: 0, just: 0, drift: 0.05 },
  { f: 155.56, off: 25, just: 15.64, drift: 0.067 },
  { f: 196, off: -25, just: 1.96, drift: 0.083 },
];
const THEME_TRIM = 0.7;
const TAIL = 0.8;

export function buildTheme(rt: Rt, dest: AudioNode): Layer {
  const L = newLayer(rt, dest);
  const now = rt.ctx.currentTime;
  const mix = gainNode(rt, THEME_TRIM, L.out);
  const set = (p: AudioParam, v: number): void => void p.setTargetAtTime(v, rt.ctx.currentTime, TAIL);

  oscNode(rt, L, 'sine', 32.7).connect(gainNode(rt, 0.26, mix));
  const beat = oscNode(rt, L, 'sine', 34.6);
  beat.connect(gainNode(rt, 0.2, mix));
  oscNode(rt, L, 'sine', 98.1).connect(gainNode(rt, 0.035, mix));

  const triadLp = filterNode(rt, 'lowpass', 900, undefined, mix);
  const voices = TRIAD.map((t) => {
    const o = oscNode(rt, L, 'triangle', t.f);
    o.detune.value = t.off;
    o.connect(gainNode(rt, dbGain(-20), triadLp));
    return { o, depth: lfo(rt, L, t.drift, 0, o.detune), t };
  });

  const sawGain = gainNode(rt, 0, filterNode(rt, 'lowpass', 300, undefined, mix));
  oscNode(rt, L, 'sawtooth', 65.4).connect(sawGain);

  // the clock: a tick every 0.75 s, a second one 30 ms later per phase from Phase 2, and twice as often from Phase 3
  const gains = { tick: dbGain(-26), swell: dbGain(-22) };
  const tickAt = (t: number): void => {
    const g = gains.tick * (1 - L.purity);
    if (g < 0.002) return;
    const v = spot(rt, L, mix, t, 0.3);
    burst(v, { dur: 0.012, gain: g, type: 'bandpass', f: 7000, q: 5, attack: 0.001 });
    if (L.phase >= 1) burst(v, { at: 0.03 * L.phase, dur: 0.012, gain: g * 0.7, type: 'bandpass', f: 7000, q: 5, attack: 0.001 });
  };
  const tick = { next: now + 0.5, every: [0.75, 0.75] as [number, number], fire: tickAt };
  const swell = {
    next: now + 3,
    every: [8, 8] as [number, number],
    fire: (t: number): void => {
      const g = gains.swell * (1 - L.purity);
      if (L.purity < 0.85) burst(spot(rt, L, mix, t, 3.6), { dur: 3.4, gain: g, reverse: true, type: 'bandpass', f: 300, to: 1600, q: 1.2 });
    },
  };
  L.ev.push(tick, swell);

  L.update = (phase, purity) => {
    L.phase = phase;
    L.purity = purity;
    set(mix.gain, THEME_TRIM * (1 - 0.55 * purity));
    set(beat.frequency, 32.7 + 1.9 * (1 - purity));
    set(sawGain.gain, phase >= 1 ? 0.09 * (1 - 0.8 * purity) : 0);
    tick.every = phase >= 2 ? [0.375, 0.375] : [0.75, 0.75];
    for (const v of voices) {
      set(v.o.detune, v.t.off + (v.t.just - v.t.off) * purity);
      set(v.depth.gain, phase >= 3 ? 50 * (1 - purity) : 0);
    }
  };
  return L;
}
