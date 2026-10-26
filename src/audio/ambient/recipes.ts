// The ambient beds as data (DESIGN §18.2): one recipe per ambient preset id that the content names (`region.ambient`, and a
// location's own `ambient`). Each recipe is a drone (oscillators through a lowpass, an optional LFO on the filter or on the
// level), noise layers and sparse events; `layers.ts` turns one into a running graph. Levels are dB relative to full scale
// BEFORE the bed trim and the filters, as DESIGN writes them. Deviations from the table, all for audibility:
//   - beds whose fundamental sits below 60 Hz (Voidscar, Drowned Reach, Veil, Threshold) carry the same note's octave or
//     twelfth at -34 dB, so a phone speaker that cannot reproduce 36 Hz still hints at the bed;
//   - a narrow resonant band (Veil's formant, Skyreach's whistle) is lifted about 6 dB, since a Q of 10 passes little noise;
//   - the Highlands' bandpass 800 Q 2 shapes only its pink air, since it would remove two of the three chord notes.
// Interiors: a location whose art template is an interior (cavern, archive, sanctum, undercity, observatory) plays its
// region's bed through a lowpass at 1.1 kHz instead of 14 kHz (layers.ts).
export type FilterSpec = readonly [type: BiquadFilterType, hz: number, q?: number];
export interface OscSpec {
  t: OscillatorType;
  f: number;
  db: number;
  /** Rate (Hz) of a slow pan sweep. */
  pan?: number;
  /** A slow detune drift: rate (Hz), reach (cents). */
  drift?: readonly [hz: number, cents: number];
}
export interface NoiseSpec {
  c: 'white' | 'pink' | 'brown';
  db: number;
  f: readonly FilterSpec[];
  /** A slow sweep of the first filter: rate (Hz), reach (Hz). */
  sweep?: readonly [hz: number, hzDepth: number];
  /** Slow swells of this layer's level (the steppe's gusts). */
  gust?: boolean;
}
export type EventKind = 'hammer' | 'burst' | 'drip' | 'chirp' | 'bell' | 'tick' | 'gate' | 'gust';
export interface EventSpec {
  k: EventKind;
  /** Seconds between events, drawn from this range. */
  every: readonly [number, number];
  db: number;
}
export interface Recipe {
  osc: readonly OscSpec[];
  lp?: number;
  hp?: number;
  /** A slow LFO on the oscillators' lowpass: rate (Hz), reach (Hz). */
  filterLfo?: readonly [hz: number, hzDepth: number];
  /** The "pulse": an LFO on the bed's level (0..0.5 of full); dropped under reduced motion (§18.5). */
  ampLfo?: readonly [hz: number, depth: number];
  noise?: readonly NoiseSpec[];
  ev?: readonly EventSpec[];
}

const GLOWLAND_OSC: Recipe['osc'] = [
  { t: 'triangle', f: 73, db: -16 },
  { t: 'square', f: 146, db: -26 },
];

export const RECIPES: Readonly<Record<string, Recipe>> = {
  ambient_silverwood_ruins: {
    osc: [
      { t: 'sine', f: 55, db: -12 },
      { t: 'sine', f: 82.5, db: -15 },
      { t: 'triangle', f: 220, db: -18 },
    ],
    lp: 600,
    filterLfo: [0.08, 200],
    noise: [{ c: 'pink', db: -30, f: [['bandpass', 400, 0.7]] }],
  },
  ambient_mistwood_ironclad_reach: {
    osc: [{ t: 'sawtooth', f: 110, db: -20 }],
    lp: 300,
    hp: 80,
    ampLfo: [0.2, 0.25],
    noise: [{ c: 'brown', db: -26, f: [] }],
    ev: [{ k: 'hammer', every: [3, 5], db: -24 }],
  },
  ambient_voidscar: {
    osc: [
      { t: 'sine', f: 41, db: -14 },
      { t: 'sine', f: 41.7, db: -14, drift: [0.05, 8] },
      { t: 'sine', f: 82, db: -34 },
    ],
    lp: 250,
    ev: [{ k: 'burst', every: [3, 8], db: -32 }],
  },
  ambient_aether_kissed_highlands: {
    osc: [
      { t: 'sine', f: 330, db: -24, pan: 0.3 },
      { t: 'sine', f: 440, db: -24, pan: 0.23 },
      { t: 'sine', f: 660, db: -24, pan: 0.37 },
    ],
    lp: 1600,
    noise: [{ c: 'pink', db: -34, f: [['bandpass', 800, 2]] }],
  },
  /** Glowlands: a breathing glow and water drips (the swamp's pulses). */
  ambient_glowlands_nexus: {
    osc: GLOWLAND_OSC,
    lp: 400,
    ampLfo: [0.5, 0.3],
    ev: [{ k: 'drip', every: [2, 4], db: -22 }],
  },
  /** The Chronos Nexus replaces the swamp's pulses with a clock: a 7 kHz tick every second (§18.2). */
  ambient_chronos_nexus: {
    osc: GLOWLAND_OSC,
    lp: 400,
    ev: [{ k: 'tick', every: [1, 1], db: -24 }],
  },
  /** WORLD §3.5: a chorus of detuned saws with a 7 s stutter gate. */
  ambient_temporal_breach_apex: {
    osc: [
      { t: 'sawtooth', f: 55, db: -24, drift: [0.04, 18] },
      { t: 'sawtooth', f: 55.8, db: -24, drift: [0.05, -18] },
      { t: 'sawtooth', f: 82.4, db: -26, drift: [0.06, 25] },
    ],
    lp: 380,
    ev: [{ k: 'gate', every: [7, 7], db: 0 }],
  },
  ambient_drowned_reach: {
    osc: [
      { t: 'sine', f: 49, db: -14 },
      { t: 'sine', f: 98, db: -34 },
    ],
    lp: 200,
    filterLfo: [0.1, 40],
    noise: [
      { c: 'brown', db: -24, f: [['lowpass', 500]] },
      { c: 'brown', db: -32, f: [['bandpass', 180, 8]] },
    ],
  },
  ambient_ashen_steppe: {
    osc: [{ t: 'sawtooth', f: 98, db: -22 }],
    lp: 900,
    hp: 120,
    filterLfo: [0.15, 400],
    noise: [{ c: 'brown', db: -20, f: [['lowpass', 1200]], gust: true }],
    ev: [{ k: 'gust', every: [7, 13], db: 0 }],
  },
  ambient_veil: {
    osc: [
      { t: 'sine', f: 36, db: -14 },
      { t: 'sine', f: 54, db: -20 },
      { t: 'sine', f: 108, db: -34 },
    ],
    lp: 180,
    filterLfo: [0.04, 40],
    noise: [{ c: 'white', db: -30, f: [['bandpass', 1200, 5]], sweep: [0.07, 400] }],
  },
  ambient_glowfen: {
    osc: [{ t: 'triangle', f: 65, db: -24 }],
    lp: 500,
    ampLfo: [0.4, 0.2],
    ev: [{ k: 'chirp', every: [0.7, 2.4], db: -30 }],
  },
  ambient_skyreach: {
    osc: [
      { t: 'sine', f: 220, db: -26, pan: 0.25 },
      { t: 'sine', f: 330, db: -26, pan: 0.19 },
    ],
    hp: 300,
    noise: [
      { c: 'white', db: -18, f: [['lowpass', 2600]] },
      { c: 'white', db: -24, f: [['bandpass', 2000, 12]] },
    ],
  },
  ambient_silverwood_before: {
    osc: [
      { t: 'triangle', f: 131, db: -22 },
      { t: 'triangle', f: 165, db: -22 },
      { t: 'triangle', f: 196, db: -22 },
    ],
    lp: 1200,
    filterLfo: [0.1, 300],
    noise: [{ c: 'pink', db: -30, f: [['bandpass', 500, 0.8]] }],
    ev: [{ k: 'bell', every: [20, 20], db: -26 }],
  },
  /** The Threshold's Still Shore, Gallery, Loom and Far Light (§18.2): the drone the Tyrant theme is built from. */
  ambient_threshold: {
    osc: [
      { t: 'sine', f: 32.7, db: -16 },
      { t: 'sine', f: 65.4, db: -22 },
      { t: 'sine', f: 98.1, db: -34 },
    ],
    lp: 150,
    filterLfo: [0.03, 30],
  },
};

/** The infection layer (DESIGN §10.2, §16.6): a tritone, low and slow, under the bed; never louder than -30 dB. */
export const UNEASE: Recipe = {
  osc: [
    { t: 'sine', f: 87.3, db: -30 },
    { t: 'sine', f: 123.5, db: -33 },
    { t: 'sine', f: 123.9, db: -40 },
  ],
  lp: 320,
  ampLfo: [0.11, 0.4],
};

export const AMBIENT_PRESETS: readonly string[] = Object.keys(RECIPES);
