// U75: the ambient layer (DESIGN §18.2, §18.4, §18.5) on the mock AudioContext — a recipe for every preset the content
// names, one bed at a time with a crossfade, in-place interior and infection changes, the Tyrant theme (phases, thinning
// in the communion, ducking, stopping), reduced motion, mute and volumes, the hidden tab, and no node left connected.
import { describe, expect, test } from 'bun:test';
import { createAmbient, DUCK, NO_SCENE, XFADE, purityOf, type Ambient, type AmbientScene } from '@audio/ambient/ambient';
import { AMBIENT_PRESETS, RECIPES, UNEASE } from '@audio/ambient/recipes';
import { createAudioEngine, type AudioEngine, type Levels } from '@audio/engine/engine';
import { buildContentPack, contentTables } from '@content/index';
import { MockAudioContext, type MockGain, type MockNode, type MockSource } from './mockAudio';

const LEVELS: Levels = { volumes: { master: 0.8, sfx: 0.8, ambient: 0.6, music: 0.5 }, muted: false };
const RUINS = 'ambient_silverwood_ruins';
const MISTWOOD = 'ambient_mistwood_ironclad_reach';
const APEX = 'ambient_temporal_breach_apex';
const scene = (over: Partial<AmbientScene> = {}): AmbientScene => ({ ...NO_SCENE, ...over });

interface Rig {
  mock: MockAudioContext;
  engine: AudioEngine;
  ambient: Ambient;
  baseline: number;
}

async function rig(levels: Levels = LEVELS, unlocked = true): Promise<Rig> {
  const mock = new MockAudioContext();
  const engine = createAudioEngine({ create: () => mock as unknown as AudioContext });
  engine.setLevels(levels);
  const ambient = createAmbient(engine, { pumpMs: 0 });
  if (unlocked) await engine.unlock();
  return { mock, engine, ambient, baseline: mock.nodes.length };
}

/** Moves the audio clock on, pumping as the interval would. */
function advance(r: Rig, seconds: number, step = 0.3): void {
  for (let t = 0; t < seconds; t += step) {
    r.mock.currentTime += step;
    r.ambient.pump();
  }
}

/** Nodes made since `baseline` that still have a path to the speakers. */
function connected(r: Rig): MockNode[] {
  const reaches = new Set<MockNode>([r.mock.destination]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const n of r.mock.nodes) {
      if (!reaches.has(n) && [...n.outputs].some((o) => reaches.has(o))) {
        reaches.add(n);
        grew = true;
      }
    }
  }
  return r.mock.nodes.slice(r.baseline).filter((n) => reaches.has(n));
}

const oscillators = (r: Rig, from = 0): MockSource[] => r.mock.sources().filter((s) => s.kind === 'oscillator').slice(from);
const bufferSources = (r: Rig): number => r.mock.sources().filter((s) => s.kind === 'buffer').length;
/** The gain a source feeds (an LFO's depth, an oscillator's level). */
const feeds = (s: MockSource): MockGain | undefined => [...s.outputs].find((o): o is MockGain => (o as MockNode).kind === 'gain');

describe('recipes', () => {
  const pack = buildContentPack(contentTables, { validate: false });

  test('every ambient preset the content names has a recipe, and every region has a bed', () => {
    const named = new Set<string>();
    for (const region of Object.values(pack.regions)) named.add(region.ambient);
    for (const loc of Object.values(pack.locations)) if (loc.ambient !== undefined) named.add(loc.ambient);
    expect(Object.values(pack.regions).length).toBe(12); // the 11 regions of the world and the Threshold
    for (const id of named) expect(AMBIENT_PRESETS).toContain(id);
    for (const id of AMBIENT_PRESETS) expect(named.has(id)).toBe(true); // and nothing is written that nothing plays
    expect(AMBIENT_PRESETS).toContain('ambient_threshold');
  });

  test('the beds are quiet by design: no drone above -12 dB, nothing in the unease layer above -30 dB', () => {
    for (const [id, r] of Object.entries(RECIPES)) {
      for (const o of r.osc) expect(o.db, `${id} ${o.f} Hz`).toBeLessThanOrEqual(-12);
      for (const n of r.noise ?? []) expect(n.db, `${id} noise`).toBeLessThanOrEqual(-18);
    }
    for (const o of UNEASE.osc) expect(o.db).toBeLessThanOrEqual(-30);
  });

  test('every bed builds and runs a minute of events on the mock without error, and ends silent', async () => {
    for (const id of AMBIENT_PRESETS) {
      const r = await rig();
      r.ambient.set(scene({ bed: id }));
      expect(r.ambient.current().bed).toBe(id);
      expect(oscillators(r).length).toBeGreaterThan(0);
      advance(r, 60);
      r.ambient.set(NO_SCENE);
      advance(r, 4);
      expect(connected(r), id).toEqual([]);
    }
  });

  test('an unknown preset is silence, not an error', async () => {
    const r = await rig();
    r.ambient.set(scene({ bed: 'ambient_nowhere' }));
    expect(r.ambient.current()).toMatchObject({ bed: null, layers: 0 });
  });

  test('the Threshold drone is the Tyrant theme’s root: 32.7 and 65.4 Hz sines under a 150 Hz lowpass', () => {
    const t = RECIPES.ambient_threshold;
    expect(t?.osc.map((o) => o.f).slice(0, 2)).toEqual([32.7, 65.4]);
    expect(t?.lp).toBe(150);
    expect(t?.noise).toBeUndefined();
  });
});

describe('beds', () => {
  test('nothing exists before the first gesture; the bed starts when the context runs', async () => {
    const r = await rig(LEVELS, false);
    r.ambient.set(scene({ bed: RUINS }));
    expect(r.mock.nodes).toEqual([]);
    expect(r.ambient.current().bed).toBeNull();
    await r.engine.unlock();
    expect(r.ambient.current().bed).toBe(RUINS);
    expect(connected(r).length).toBeGreaterThan(0);
  });

  test('a region change crossfades over about two seconds and keeps one bed', async () => {
    const r = await rig();
    r.ambient.set(scene({ bed: RUINS }));
    advance(r, 3);
    const first = oscillators(r);
    const at = r.mock.currentTime;
    r.ambient.set(scene({ bed: MISTWOOD }));
    expect(r.ambient.current()).toMatchObject({ bed: MISTWOOD, layers: 2 });
    const fading = r.mock.gains().filter((g) => g.gain.events.some((e) => e.kind === 'target' && e.value === 0));
    const rising = r.mock.gains().filter((g) => g.gain.events.some((e) => e.kind === 'target' && e.value === 1 && e.time >= 3));
    expect(fading.length).toBeGreaterThan(0);
    expect(rising.length).toBeGreaterThan(0);
    expect(fading[0]?.gain.events.find((e) => e.value === 0)?.time).toBeCloseTo(at, 5);
    expect(rising[0]?.gain.events.find((e) => e.value === 1 && e.time >= 3)?.time).toBeCloseTo(at, 5);
    // time constants: a fade of XFADE seconds is within 3 % of done at its end
    expect(Math.exp(-XFADE / (XFADE / 3.5))).toBeLessThan(0.04);
    advance(r, XFADE + 1);
    expect(r.ambient.current().layers).toBe(1);
    expect(first.every((s) => s.stoppedAt !== null)).toBe(true);
    expect(connected(r).length).toBeGreaterThan(0);
  });

  test('the same bed again does not restart; indoors and infection change it in place', async () => {
    const r = await rig();
    r.ambient.set(scene({ bed: RUINS }));
    const built = r.mock.nodes.length;
    r.ambient.set(scene({ bed: RUINS }));
    expect(r.mock.nodes.length).toBe(built);

    r.ambient.set(scene({ bed: RUINS, interior: true }));
    expect(r.ambient.current()).toMatchObject({ bed: RUINS, interior: true, layers: 1 });
    expect(r.mock.nodes.length).toBe(built); // only a filter's target moved
    const dark = r.mock.nodes.find((n) => n.kind === 'biquad' && 'frequency' in n && (n as unknown as { frequency: { events: { value: number }[] } }).frequency.events.some((e) => e.value === 1100));
    expect(dark).toBeDefined();
    r.ambient.set(scene({ bed: RUINS }));
    expect(r.ambient.current().interior).toBe(false);
  });

  test('an infected node or a running Horde adds the unease layer, quietly, and clearing it removes it', async () => {
    const r = await rig();
    r.ambient.set(scene({ bed: RUINS }));
    const bedOscillators = oscillators(r).length;
    r.ambient.set(scene({ bed: RUINS, infected: true }));
    expect(r.ambient.current()).toMatchObject({ bed: RUINS, infected: true, layers: 2 });
    expect(oscillators(r).length).toBeGreaterThan(bedOscillators);
    // the new layer's oscillators carry the tritone, none louder than -30 dB
    const added = oscillators(r, bedOscillators).filter((s) => s.frequency.value > 80 && s.frequency.value < 130);
    expect(added.length).toBe(3);
    for (const s of added) expect(feeds(s)?.gain.value ?? 0).toBeLessThanOrEqual(10 ** (-30 / 20) + 1e-9);
    r.ambient.set(scene({ bed: RUINS }));
    advance(r, 6);
    expect(r.ambient.current()).toMatchObject({ infected: false, layers: 1 });
    // the unease layer needs a bed: a bedless infected scene plays nothing
    r.ambient.set(scene({ infected: true }));
    expect(r.ambient.current()).toMatchObject({ bed: null, infected: false });
    advance(r, 3);
    expect(r.ambient.current().layers).toBe(0);
  });

  test('rapid region changes keep at most three layers alive', async () => {
    const r = await rig();
    for (let i = 0; i < 12; i++) {
      r.ambient.set(scene({ bed: AMBIENT_PRESETS[i % AMBIENT_PRESETS.length] ?? RUINS }));
      expect(r.ambient.current().layers).toBeLessThanOrEqual(3);
    }
    advance(r, 5);
    expect(r.ambient.current().layers).toBe(1);
  });
});

describe('the Tyrant theme', () => {
  test('starts on the Tyrant’s fight on the music bus, ducks the bed, and stops after', async () => {
    const r = await rig();
    r.ambient.set(scene({ bed: APEX }));
    advance(r, 3);
    expect(r.ambient.current().theme).toBeNull();
    const music = r.engine.bus('music');
    const before = connected(r).length;
    r.ambient.set(scene({ bed: APEX, tyrant: 0 }));
    expect(r.ambient.current()).toMatchObject({ bed: APEX, theme: { phase: 0, purity: 0 }, ducked: true });
    expect(connected(r).length).toBeGreaterThan(before);
    expect([...(music as unknown as MockNode).outputs].length).toBeGreaterThan(0);
    // the ambient bus's feeder is the duck: it eases to DUCK and back to 1
    const duck = r.mock.gains().find((g) => g.outputs.has(r.engine.bus('ambient') as unknown as MockNode));
    const last = (): number => duck?.gain.events.filter((e) => e.kind === 'target').at(-1)?.value ?? -1;
    expect(last()).toBe(DUCK);

    r.ambient.set(scene({ bed: APEX }));
    expect(r.ambient.current().theme).toBeNull();
    expect(last()).toBe(1);
    expect(r.ambient.current().layers).toBe(2); // fading
    advance(r, 5);
    expect(r.ambient.current().layers).toBe(1);
    const triad = oscillators(r).filter((s) => s.type === 'triangle');
    expect(triad.every((s) => s.stoppedAt !== null)).toBe(true);
  });

  test('is made of the drone, the almost-in-tune triad and the clock', async () => {
    const r = await rig();
    r.ambient.set(scene({ tyrant: 0 }));
    const freq = oscillators(r).map((s) => s.frequency.value);
    for (const f of [32.7, 34.6, 130.81, 155.56, 196, 65.4]) expect(freq).toContain(f);
    const triad = oscillators(r).filter((s) => s.type === 'triangle');
    expect(triad.map((s) => s.detune.value)).toEqual([0, 25, -25]);
    advance(r, 3);
    expect(bufferSources(r)).toBeGreaterThan(0); // ticks and the swell
  });

  test('changes with the boss phase: the saw enters at Phase 2, the tick doubles at Phase 3, the detune drifts at Phase 4', async () => {
    const r = await rig();
    const ticksIn = (phase: number): number => {
      r.ambient.set(scene({ tyrant: phase }));
      advance(r, 1);
      const from = bufferSources(r);
      advance(r, 6);
      return bufferSources(r) - from;
    };
    r.ambient.set(scene({ tyrant: 0 }));
    const sawGain = (): number => (feeds(oscillators(r).find((s) => s.type === 'sawtooth') as MockSource)?.gain.events.filter((e) => e.kind === 'target').at(-1)?.value ?? -1);
    expect(sawGain()).toBe(0);
    const p1 = ticksIn(0);
    const p2 = ticksIn(1);
    expect(sawGain()).toBeGreaterThan(0);
    const p3 = ticksIn(2);
    const p4 = ticksIn(3);
    expect(p2).toBeGreaterThan(p1); // the second tick, 30 ms behind
    expect(p3).toBeGreaterThan(p2 * 1.6); // twice as often
    expect(p4).toBeGreaterThan(p2 * 1.6);
    // the drift: LFO depths on the three detunes reach 50 cents at Phase 4 only
    const depths = oscillators(r)
      .filter((s) => s.type === 'sine' && s.frequency.value < 0.1)
      .map((s) => feeds(s)?.gain.events.filter((e) => e.kind === 'target').at(-1)?.value);
    expect(depths).toEqual([50, 50, 50]);
    r.ambient.set(scene({ tyrant: 2 }));
    expect(oscillators(r).filter((s) => s.type === 'sine' && s.frequency.value < 0.1).map((s) => feeds(s)?.gain.events.at(-1)?.value)).toEqual([0, 0, 0]);
  });

  test('the communion thins it: just intonation, no beating, no tick, no swell', async () => {
    const r = await rig();
    expect(purityOf(-1)).toBe(0);
    expect(purityOf(1)).toBe(0);
    expect(purityOf(8)).toBe(1);
    expect(purityOf(4.5)).toBeCloseTo(0.5, 5);
    r.ambient.set(scene({ tyrant: 1, resolve: 4 }));
    expect(r.ambient.current().theme?.purity).toBeCloseTo(3 / 7, 5);
    r.ambient.set(scene({ tyrant: 1, resolve: 8 }));
    expect(r.ambient.current().theme).toEqual({ phase: 1, purity: 1 });
    const targets = (s: MockSource): number[] => s.detune.events.filter((e) => e.kind === 'target').map((e) => e.value);
    const triad = oscillators(r).filter((s) => s.type === 'triangle');
    expect(targets(triad[1] as MockSource).at(-1)).toBeCloseTo(15.64, 2); // E-flat at 6/5
    expect(targets(triad[2] as MockSource).at(-1)).toBeCloseTo(1.96, 2); // G at 3/2
    const beat = oscillators(r)[1] as MockSource; // the 34.6 Hz sine
    expect(beat.frequency.events.filter((e) => e.kind === 'target').at(-1)?.value).toBeCloseTo(32.7, 5); // a unison
    advance(r, 20);
    const base = bufferSources(r);
    advance(r, 20);
    expect(bufferSources(r)).toBe(base); // the tick and the swell fall silent
  });

  test('no music volume, no theme; the bed still plays', async () => {
    const r = await rig({ ...LEVELS, volumes: { ...LEVELS.volumes, music: 0 } });
    r.ambient.set(scene({ bed: RUINS, tyrant: 0 }));
    expect(r.ambient.current()).toMatchObject({ bed: RUINS, theme: null, ducked: false });
  });
});

describe('levels, motion and the tab', () => {
  test('reduced motion drops the pulse (the amplitude LFO) and the stutter gate, live', async () => {
    const r = await rig();
    r.engine.setReducedMotion(true);
    r.ambient.set(scene({ bed: MISTWOOD }));
    const wobble = (): number | undefined => feeds(oscillators(r).find((s) => s.frequency.value === 0.2) as MockSource)?.gain.events.filter((e) => e.kind === 'target').at(-1)?.value;
    const lfoGain = feeds(oscillators(r).find((s) => s.frequency.value === 0.2) as MockSource);
    expect(lfoGain?.gain.value).toBe(0);
    r.engine.setReducedMotion(false);
    expect(wobble()).toBeCloseTo(0.6 * 0.25, 5);
    r.engine.setReducedMotion(true);
    expect(wobble()).toBe(0);

    const gated = async (reduced: boolean): Promise<boolean> => {
      const g = await rig();
      g.engine.setReducedMotion(reduced);
      g.ambient.set(scene({ bed: APEX }));
      advance(g, 40);
      return g.mock.gains().some((n) => n.gain.events.some((e) => e.value === 0.12));
    };
    expect(await gated(false)).toBe(true);
    expect(await gated(true)).toBe(false);
  });

  test('mute stops both layers at once and unmuting brings them back; volumes gate each bus', async () => {
    const r = await rig();
    r.ambient.set(scene({ bed: APEX, tyrant: 0 }));
    advance(r, 1);
    expect(r.ambient.current()).toMatchObject({ bed: APEX, ducked: true });
    r.engine.setLevels({ ...LEVELS, muted: true });
    expect(r.ambient.current()).toMatchObject({ bed: null, theme: null });
    advance(r, 5);
    expect(r.ambient.current().layers).toBe(0);
    expect(connected(r)).toEqual([]);
    r.engine.setLevels(LEVELS);
    expect(r.ambient.current()).toMatchObject({ bed: APEX, ducked: true });

    r.engine.setLevels({ ...LEVELS, volumes: { ...LEVELS.volumes, ambient: 0 } });
    expect(r.ambient.current()).toMatchObject({ bed: null, ducked: true }); // music is its own bus
    r.engine.setLevels({ ...LEVELS, volumes: { ...LEVELS.volumes, music: 0 } });
    expect(r.ambient.current()).toMatchObject({ bed: APEX, theme: null });
    r.engine.setLevels({ ...LEVELS, volumes: { ...LEVELS.volumes, master: 0 } });
    expect(r.ambient.current()).toMatchObject({ bed: null, theme: null });
  });

  test('a hidden tab builds nothing new; the scene is played on return', async () => {
    const r = await rig();
    r.ambient.set(scene({ bed: RUINS }));
    r.engine.suspend();
    await Promise.resolve();
    const nodes = r.mock.nodes.length;
    r.ambient.set(scene({ bed: MISTWOOD }));
    expect(r.mock.nodes.length).toBe(nodes);
    expect(r.ambient.current().bed).toBe(RUINS);
    r.mock.currentTime += 100;
    r.ambient.pump(); // no events are scheduled on a frozen clock
    r.engine.resume();
    await Promise.resolve();
    await Promise.resolve();
    expect(r.ambient.current().bed).toBe(MISTWOOD);
  });

  test('the interval runs only while something is alive and is cleared on dispose', async () => {
    const real = { set: globalThis.setInterval, clear: globalThis.clearInterval };
    const active = new Set<number>();
    let next = 1;
    globalThis.setInterval = ((_fn: () => void, _ms: number) => {
      active.add(next);
      return next++;
    }) as unknown as typeof setInterval;
    globalThis.clearInterval = ((id: number) => void active.delete(id)) as unknown as typeof clearInterval;
    try {
      const mock = new MockAudioContext();
      const engine = createAudioEngine({ create: () => mock as unknown as AudioContext });
      engine.setLevels(LEVELS);
      const ambient = createAmbient(engine);
      await engine.unlock();
      expect(active.size).toBe(0);
      ambient.set(scene({ bed: RUINS }));
      expect(active.size).toBe(1);
      ambient.set(NO_SCENE);
      mock.currentTime += 5;
      ambient.pump();
      expect(active.size).toBe(0);
      ambient.set(scene({ bed: RUINS }));
      expect(active.size).toBe(1);
      ambient.dispose();
      expect(active.size).toBe(0);
    } finally {
      globalThis.setInterval = real.set;
      globalThis.clearInterval = real.clear;
    }
  });

  test('a disposed engine tears the layers down', async () => {
    const r = await rig();
    r.ambient.set(scene({ bed: RUINS, tyrant: 0 }));
    r.engine.dispose();
    expect(r.ambient.current().layers).toBe(0);
    expect(connected(r)).toEqual([]);
  });
});

describe('leaks', () => {
  test('starting and stopping beds, unease and the theme 100 times leaves no node connected', async () => {
    const r = await rig();
    for (let i = 0; i < 100; i++) {
      const bed = AMBIENT_PRESETS[i % AMBIENT_PRESETS.length] ?? RUINS;
      r.ambient.set(scene({ bed, infected: i % 2 === 0, interior: i % 3 === 0, tyrant: i % 4 === 0 ? (i / 4) % 4 : -1, resolve: i % 8 === 0 ? 5 : -1 }));
      advance(r, 4);
      expect(r.ambient.current().layers).toBeLessThanOrEqual(5);
      r.ambient.set(NO_SCENE);
      advance(r, 4);
      expect(r.ambient.current().layers).toBe(0);
    }
    expect(connected(r)).toEqual([]);
    expect(r.mock.sources().every((s) => s.stoppedAt !== null)).toBe(true);
  });

  test('a long session on one bed holds a steady number of live event voices', async () => {
    const r = await rig();
    r.ambient.set(scene({ bed: 'ambient_glowfen', infected: true }));
    advance(r, 30);
    const steady = connected(r).length;
    advance(r, 600);
    expect(connected(r).length).toBeLessThanOrEqual(steady + 40);
  });
});

describe('the engine hooks the ambient layer uses', () => {
  test('subscribe is told of levels, reduced motion, running and disposal; a listener’s error stays inside', async () => {
    const mock = new MockAudioContext();
    const engine = createAudioEngine({ create: () => mock as unknown as AudioContext });
    let told = 0;
    const off = engine.subscribe(() => {
      told += 1;
      throw new Error('a listener fails');
    });
    expect(engine.context()).toBeNull();
    engine.setLevels(LEVELS);
    engine.setReducedMotion(true);
    expect(engine.levels()).toEqual(LEVELS);
    expect(engine.reducedMotion()).toBe(true);
    expect(told).toBe(2);
    await engine.unlock();
    expect(told).toBe(3);
    expect(engine.context()).not.toBeNull();
    off();
    engine.setReducedMotion(false);
    expect(told).toBe(3);
    engine.dispose();
    expect(engine.context()).toBeNull();
  });
});
