// U74: the 30 sounds of DESIGN §18.3 (and the two percussion hits) each build a valid graph on a mock AudioContext,
// ring for a sensible time, stay quiet, and use the audio layer's own random stream.
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import { RECIPES, SFX_IDS, type SoundId, type SoundParams } from '@audio/sfx/sfx';
import { auditionGroups } from '@audio/sfx/audition';
import { audioRng, noiseBuffer, type Voice } from '@audio/synth/synth';
import { MockAudioContext, MockGain, MockParam, MockSource } from './mockAudio';

function voiceOn(mock: MockAudioContext, t0 = 1): Voice {
  const ctx = mock as unknown as BaseAudioContext;
  const rnd = audioRng(7);
  return { ctx, out: mock.createGain() as unknown as AudioNode, t0, sources: [], noise: noiseBuffer(ctx, rnd), rnd };
}

function build(id: SoundId, params: SoundParams = {}): { mock: MockAudioContext; voice: Voice; length: number } {
  const mock = new MockAudioContext();
  const voice = voiceOn(mock);
  const length = RECIPES[id](voice, params);
  return { mock, voice, length };
}

const VARIANTS: [SoundId, SoundParams][] = [
  ...['physical', 'fire', 'storm', 'ley', 'void', 'chrono', 'nonsense'].map((variant): [SoundId, SoundParams] => ['sfx_crit', { variant }]),
  ...['burn', 'bleed', 'shock', 'other'].map((variant): [SoundId, SoundParams] => ['sfx_status_apply', { variant }]),
  ['sfx_clock_warning', { variant: 'late' }],
  ['sfx_resonance', { n: 3 }],
  ['sfx_resonance', { n: 99 }],
  ['sfx_resonance', { n: 0 }],
];

describe('the sound list', () => {
  test('SFX_IDS is DESIGN §18.3’s table: 30 unique ids, each with a recipe', () => {
    const design = fs.readFileSync('docs/DESIGN.md', 'utf8');
    const section = design.slice(design.indexOf('### 18.3'), design.indexOf('### 18.4'));
    const listed = [...section.matchAll(/^\| `(sfx_[a-z_]+)` \|/gm)].map((m) => m[1]);
    expect(SFX_IDS.length).toBe(30);
    expect(new Set(SFX_IDS).size).toBe(30);
    expect([...SFX_IDS]).toEqual(listed as typeof listed & string[]);
    for (const id of SFX_IDS) expect(typeof RECIPES[id]).toBe('function');
    expect(Object.keys(RECIPES).sort()).toEqual([...SFX_IDS, 'sfx_perc_hat', 'sfx_perc_kick'].sort());
  });

  test('the audition page offers every sound', () => {
    const offered = new Set(auditionGroups().flatMap(([, entries]) => entries.map((e) => e.id)));
    expect([...offered].sort()).toEqual(Object.keys(RECIPES).sort());
  });
});

describe('every sound builds its graph', () => {
  const cases: [SoundId, SoundParams][] = [...(Object.keys(RECIPES) as SoundId[]).map((id): [SoundId, SoundParams] => [id, {}]), ...VARIANTS];
  for (const [id, params] of cases) {
    test(`${id} ${JSON.stringify(params)}`, () => {
      const { mock, voice, length } = build(id, params);
      expect(length).toBeGreaterThan(0.02);
      expect(length).toBeLessThanOrEqual(2.5);
      const sources = mock.sources();
      expect(sources.length).toBeGreaterThan(0);
      expect(voice.sources).toEqual(sources);
      for (const s of sources) {
        expect(s.startedAt).not.toBeNull();
        expect(s.startedAt as number).toBeGreaterThanOrEqual(voice.t0);
        expect(s.stoppedAt as number).toBeGreaterThan(s.startedAt as number);
        // nothing sounds past the length the recipe reports (beyond a stop's 20 ms margin)
        expect(s.stoppedAt as number).toBeLessThanOrEqual(voice.t0 + length + 0.021);
        expect(s.outputs.size).toBe(1);
      }
      // quiet by default: no layer peaks above 0.5 (the out gain itself is the voice's, at 1)
      const layers = mock.gains().slice(1).filter((g) => g.gain.events.length > 0);
      expect(layers.length).toBeGreaterThan(0);
      for (const g of layers) expect(g.gain.peak()).toBeLessThanOrEqual(0.5);
    });
  }

  test('pitches stay audible and below 8 kHz; filters sweep inside the audible band', () => {
    for (const id of Object.keys(RECIPES) as SoundId[]) {
      const { mock } = build(id);
      for (const s of mock.sources().filter((x) => x.kind === 'oscillator')) {
        for (const e of s.frequency.events) {
          expect(e.value).toBeGreaterThanOrEqual(20);
          expect(e.value).toBeLessThanOrEqual(8000);
        }
      }
    }
  });

  test('a recipe works without a StereoPanner (sfx_miss skips its sweep)', () => {
    const mock = new MockAudioContext(false);
    const voice = voiceOn(mock);
    expect(() => RECIPES.sfx_miss(voice, {})).not.toThrow();
    expect(mock.nodes.some((n) => n.kind === 'panner')).toBe(false);
    const withPan = build('sfx_miss').mock;
    expect(withPan.nodes.some((n) => n.kind === 'panner')).toBe(true);
  });

  test('the Echo bell rings through a feedback-delay room', () => {
    const { mock } = build('sfx_echo_gain');
    const delay = mock.nodes.find((n) => n.kind === 'delay') as unknown as { delayTime: MockParam };
    expect(delay.delayTime.value).toBeGreaterThan(0.05);
    expect(mock.nodes.filter((n) => n.kind === 'oscillator')).toHaveLength(3);
  });

  test('a late clock warning adds a detuned partner; Resonance blips once per unit, at most five', () => {
    expect(build('sfx_clock_warning', { variant: 'late' }).mock.sources().length).toBe(build('sfx_clock_warning').mock.sources().length + 1);
    expect(build('sfx_resonance', { n: 3 }).mock.sources()).toHaveLength(3);
    expect(build('sfx_resonance', { n: 40 }).mock.sources()).toHaveLength(5);
  });
});

describe('synth', () => {
  test('the audio RNG is seeded and in [0, 1)', () => {
    const a = audioRng(42);
    const b = audioRng(42);
    const xs = Array.from({ length: 200 }, () => a());
    expect(xs).toEqual(Array.from({ length: 200 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(190);
  });

  test('the noise buffer is a second of white noise in [-1, 1]', () => {
    const mock = new MockAudioContext();
    const buffer = noiseBuffer(mock as unknown as BaseAudioContext, audioRng(1));
    const data = buffer.getChannelData(0);
    expect(data.length).toBe(mock.sampleRate);
    expect(data.every((x) => x >= -1 && x <= 1)).toBe(true);
    expect(data.some((x) => x !== 0)).toBe(true);
  });

  test('voices built on the mock are real MockSources and MockGains', () => {
    const { mock } = build('sfx_coin');
    expect(mock.sources().every((s) => s instanceof MockSource)).toBe(true);
    expect(mock.gains().every((g) => g instanceof MockGain)).toBe(true);
  });
});
