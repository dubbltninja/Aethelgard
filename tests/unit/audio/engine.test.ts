// U74: the audio engine (DESIGN §18.1, §18.5) on a mock AudioContext — locked until a gesture unlocks it, a silent
// no-op without Web Audio, bus gains that follow the settings (v², mute at once), throttling, the voice cap, reduced
// motion, visibility, and errors that never escape.
import { describe, expect, test } from 'bun:test';
import { MAX_VOICES, THROTTLE, createAudioEngine, type Levels } from '@audio/engine/engine';
import { SFX_IDS } from '@audio/sfx/sfx';
import { MockAudioContext, type MockGain } from './mockAudio';

const LEVELS: Levels = { volumes: { master: 0.8, sfx: 0.8, ambient: 0.6, music: 0.5 }, muted: false };

async function running(levels: Levels = LEVELS): Promise<{ engine: ReturnType<typeof createAudioEngine>; mock: MockAudioContext }> {
  const mock = new MockAudioContext();
  const engine = createAudioEngine({ create: () => mock as unknown as AudioContext });
  engine.setLevels(levels);
  expect(await engine.unlock()).toBe(true);
  return { engine, mock };
}

const gainOf = (node: GainNode | null): number => (node as unknown as MockGain).gain.value;

describe('the context', () => {
  test('nothing is created or played before the first gesture; unlock creates and resumes it once', async () => {
    let made = 0;
    const mock = new MockAudioContext();
    const engine = createAudioEngine({
      create: () => {
        made += 1;
        return mock as unknown as AudioContext;
      },
    });
    expect(engine.state()).toBe('locked');
    expect(engine.play('sfx_ui_tick')).toBe(false);
    expect(engine.bus('sfx')).toBeNull();
    expect(made).toBe(0);
    expect(await engine.unlock()).toBe(true);
    expect(await engine.unlock()).toBe(true);
    expect(made).toBe(1);
    expect(mock.resumes).toBe(1);
    expect(engine.state()).toBe('running');
    expect(engine.play('sfx_ui_tick')).toBe(true);
    expect(engine.played()).toEqual(['sfx_ui_tick']);
  });

  test('without Web Audio the engine is a silent no-op', async () => {
    const engine = createAudioEngine({ create: () => null });
    expect(await engine.unlock()).toBe(false);
    expect(engine.state()).toBe('unavailable');
    expect(engine.play('sfx_coin')).toBe(false);
    expect(() => {
      engine.setLevels(LEVELS);
      engine.setReducedMotion(true);
      engine.suspend();
      engine.resume();
      engine.playCues([{ id: 'sfx_coin', at: 0 }]);
      engine.dispose();
    }).not.toThrow();
    expect(engine.voices()).toBe(0);
  });

  test('the default factory finds no AudioContext under bun, and stays silent', async () => {
    const engine = createAudioEngine();
    expect(await engine.unlock()).toBe(false);
    expect(engine.state()).toBe('unavailable');
  });

  test('a context that throws never reaches the caller', async () => {
    const throwing = createAudioEngine({
      create: () => {
        throw new Error('no audio device');
      },
    });
    expect(await throwing.unlock()).toBe(false);
    const { engine, mock } = await running();
    mock.createOscillator = () => {
      throw new Error('broken');
    };
    expect(engine.play('sfx_coin')).toBe(false);
  });

  test('a hidden tab suspends, a shown one resumes; dispose closes', async () => {
    const { engine, mock } = await running();
    engine.suspend();
    expect(mock.state).toBe('suspended');
    expect(engine.state()).toBe('suspended');
    expect(engine.play('sfx_coin')).toBe(false);
    engine.resume();
    expect(mock.state).toBe('running');
    engine.dispose();
    expect(mock.state).toBe('closed');
    expect(engine.state()).toBe('closed');
    expect(await engine.unlock()).toBe(false);
  });
});

describe('buses and levels', () => {
  test('master → compressor → speakers; sfx, ui, ambient and music feed master', async () => {
    const { engine, mock } = await running();
    const compressor = mock.nodes.find((n) => n.kind === 'compressor');
    expect(compressor?.outputs.has(mock.destination)).toBe(true);
    const master = mock.gains().find((g) => g.outputs.has(compressor as never)) as MockGain;
    for (const name of ['sfx', 'ui', 'ambient', 'music'] as const) expect((engine.bus(name) as unknown as MockGain).outputs.has(master)).toBe(true);
  });

  test('gains follow the settings as v²; the ui bus follows the effects volume; mute zeroes master at once', async () => {
    const { engine, mock } = await running();
    const master = mock.gains()[0] as MockGain;
    expect(master.gain.value).toBeCloseTo(0.64);
    expect(gainOf(engine.bus('sfx'))).toBeCloseTo(0.64);
    expect(gainOf(engine.bus('ui'))).toBeCloseTo(0.64);
    expect(gainOf(engine.bus('ambient'))).toBeCloseTo(0.36);
    expect(gainOf(engine.bus('music'))).toBeCloseTo(0.25);
    engine.setLevels({ volumes: { master: 0.5, sfx: 0.3, ambient: 1, music: 0 }, muted: false });
    expect(master.gain.value).toBeCloseTo(0.25);
    expect(gainOf(engine.bus('sfx'))).toBeCloseTo(0.09);
    expect(gainOf(engine.bus('ambient'))).toBeCloseTo(1);
    expect(gainOf(engine.bus('music'))).toBe(0);
    expect(master.gain.events.at(-1)?.kind).toBe('target'); // a volume glides (no zipper noise)
    engine.setLevels({ ...LEVELS, muted: true });
    expect(master.gain.value).toBe(0);
    expect(master.gain.events.at(-1)?.kind).toBe('set'); // mute is instant
    engine.setLevels({ volumes: { master: 7, sfx: Number.NaN, ambient: -1, music: 0.5 }, muted: false });
    expect(master.gain.value).toBe(1);
    expect(gainOf(engine.bus('sfx'))).toBe(0);
    expect(gainOf(engine.bus('ambient'))).toBe(0);
  });

  test('muted, or a silent bus, schedules nothing', async () => {
    const { engine, mock } = await running({ ...LEVELS, muted: true });
    expect(engine.play('sfx_hit_fire')).toBe(false);
    expect(mock.sources()).toHaveLength(0);
    engine.setLevels({ volumes: { ...LEVELS.volumes, sfx: 0 }, muted: false });
    expect(engine.play('sfx_hit_fire')).toBe(false);
    expect(engine.play('sfx_ui_tick')).toBe(false); // the ui bus follows effects
    expect(engine.play('sfx_perc_kick')).toBe(true); // music is still on
    expect(engine.play('sfx_ui_confirm', { bus: 'ambient' })).toBe(true); // the Settings test sound for a bus
    engine.setLevels({ volumes: { ...LEVELS.volumes, master: 0 }, muted: false });
    expect(engine.play('sfx_perc_kick', { at: 1 })).toBe(false);
  });

  test('sounds go to their bus: ui sounds to ui, percussion to music, the rest to sfx; pan and velocity apply', async () => {
    const { engine, mock } = await running();
    const before = mock.nodes.length;
    engine.play('sfx_ui_confirm');
    const voice = mock.nodes[before] as MockGain;
    expect(voice.outputs.has(engine.bus('ui') as never)).toBe(true);
    engine.play('sfx_perc_hat');
    expect(mock.gains().some((g) => g.outputs.has(engine.bus('music') as never))).toBe(true);
    const n = mock.nodes.length;
    engine.play('sfx_hit_void', { pan: 0.35, vel: 0.5 });
    const hitVoice = mock.nodes[n] as MockGain;
    expect(hitVoice.gain.value).toBe(0.5);
    const panner = [...hitVoice.outputs][0] as unknown as { kind: string; pan: { value: number }; outputs: Set<unknown> };
    expect(panner.kind).toBe('panner');
    expect(panner.pan.value).toBe(0.35);
    expect(panner.outputs.has(engine.bus('sfx'))).toBe(true);
  });
});

describe('throttling and the voice cap', () => {
  test('the same sound within THROTTLE starts once; later, or at another beat, it plays again', async () => {
    const { engine, mock } = await running();
    expect(engine.play('sfx_coin')).toBe(true);
    expect(engine.play('sfx_coin')).toBe(false);
    expect(engine.play('sfx_coin', { at: THROTTLE / 2 })).toBe(false);
    expect(engine.play('sfx_coin', { at: 0.42 })).toBe(true);
    mock.currentTime += 1;
    expect(engine.play('sfx_coin')).toBe(true);
    expect(engine.played()).toEqual(['sfx_coin', 'sfx_coin', 'sfx_coin']);
  });

  test(`at most ${MAX_VOICES} voices sound at once: the oldest is faded and stopped`, async () => {
    const { engine, mock } = await running();
    const ids = SFX_IDS.filter((id) => !id.startsWith('sfx_ui')).slice(0, 12);
    const firstSources: number[] = [];
    for (const [i, id] of ids.entries()) {
      const before = mock.sources().length;
      expect(engine.play(id)).toBe(true);
      if (i === 0) firstSources.push(before, mock.sources().length);
      expect(engine.voices()).toBeLessThanOrEqual(MAX_VOICES);
    }
    expect(engine.voices()).toBe(MAX_VOICES);
    const [from, to] = firstSources as [number, number];
    for (const s of mock.sources().slice(from, to)) expect(s.stoppedAt as number).toBeLessThanOrEqual(0.03);
    // once they ring out, voices free up and are disconnected
    mock.currentTime += 5;
    expect(engine.voices()).toBe(0);
    engine.play('sfx_coin');
    expect(mock.gains().filter((g) => g.disconnected).length).toBeGreaterThanOrEqual(ids.length - MAX_VOICES);
  });

  test('a step’s cues are scheduled at their offsets', async () => {
    const { engine, mock } = await running();
    mock.currentTime = 2;
    engine.playCues([
      { id: 'sfx_hit_physical', at: 0.14 },
      { id: 'sfx_hit_physical', at: 0.56 },
      { id: 'sfx_ko', at: 0.63 },
    ]);
    const starts = [...new Set(mock.sources().map((s) => s.startedAt))].sort();
    expect(starts).toEqual([2.14, 2.56, 2.63]);
  });

  test('reduced motion drops the combat hat ticks only (DESIGN §18.5)', async () => {
    const { engine } = await running();
    engine.setReducedMotion(true);
    expect(engine.play('sfx_perc_hat')).toBe(false);
    expect(engine.play('sfx_perc_kick')).toBe(true);
    expect(engine.play('sfx_hit_storm')).toBe(true);
    engine.setReducedMotion(false);
    expect(engine.play('sfx_perc_hat')).toBe(true);
  });

  test('played() keeps the most recent 40', async () => {
    const { engine, mock } = await running();
    for (let i = 0; i < 50; i++) {
      mock.currentTime += 1;
      engine.play('sfx_coin');
    }
    expect(engine.played()).toHaveLength(40);
  });
});
