// The 30 sound effects of DESIGN §18.3, plus the two combat-percussion hits of its closing paragraph. Each recipe builds
// one voice from `synth.ts` and returns how long it rings (seconds), so the engine knows when the voice is done.
// The register is dark and quiet: low fundamentals, soft attacks except for impacts, short tails, peaks ≤ 0.5 per layer.
//
// | id                  | heard on (src/audio/map/map.ts)                                         |
// |---------------------|-------------------------------------------------------------------------|
// | sfx_ui_tick         | dialogue line, equip, stat point, companion swap, objective done, modifier |
// | sfx_ui_confirm      | item taken/given, quest started/advanced, exit unlocked, ability, recruit, |
// |                     | attunement on, a panel opens (Shell)                                     |
// | sfx_ui_back         | unequip, dismiss, attunement off, Resolve lost, a panel closes (Shell)   |
// | sfx_ui_error        | an action refused                                                       |
// | sfx_travel          | entering a location, a successful flight                                 |
// | sfx_rest_dawn       | resting, a new loop's first dawn                                         |
// | sfx_hit_physical…   | a blow by damage type: physical, fire, storm, ley, void, chrono (6); a   |
// |                     | damage-over-time tick at 45 %; void also: Corruption rises, communion    |
// |                     | rejected                                                                 |
// | sfx_crit            | a critical blow (its type's hit + a high ping)                           |
// | sfx_miss            | an attack that missed, a failed flight                                   |
// | sfx_guard           | Guard, a blow wholly absorbed                                            |
// | sfx_shield_up       | Shield applied                                                          |
// | sfx_shield_break    | Shield expired or broken by void                                         |
// | sfx_status_apply    | any other status (Burn crackle, Bleed drip, Shock buzz tails)             |
// | sfx_heal            | healed                                                                  |
// | sfx_level_up        | level up, achievement                                                   |
// | sfx_echo_gain       | Echo gained, the communion's Listen, Heartstone/Tyrant resolved, ending   |
// | sfx_resonance       | Resonance gained (one blip per unit, ≤ 5), Resolve gained, codex entry   |
// | sfx_intent_flip     | a creature's intent set or changed (once per step)                       |
// | sfx_clock_warning   | the Breach Clock's warnings (detuned at ≤ 2 dawns), boss phase, Movement |
// |                     | ended, the loop's end                                                    |
// | sfx_breach_tear     | the clock expires, the Horde starts, the portal                          |
// | sfx_forge_hammer    | crafted, upgraded                                                       |
// | sfx_coin            | gold gained, bought, sold, attunement bought                             |
// | sfx_combat_start    | a fight begins, adds summoned                                            |
// | sfx_victory         | a fight won, a quest completed                                           |
// | sfx_ko              | a combatant defeated, a companion down, the player falls, a quest failed |
// | sfx_perc_kick/_hat  | (music bus, not in the 30) each new round / each turn; the hat is off    |
// |                     | under reduced motion (DESIGN §18.5)                                      |
import { noise, room, tone, type Voice } from '../synth/synth';

export const SFX_IDS = [
  'sfx_ui_tick',
  'sfx_ui_confirm',
  'sfx_ui_back',
  'sfx_ui_error',
  'sfx_travel',
  'sfx_rest_dawn',
  'sfx_hit_physical',
  'sfx_hit_fire',
  'sfx_hit_storm',
  'sfx_hit_ley',
  'sfx_hit_void',
  'sfx_hit_chrono',
  'sfx_crit',
  'sfx_miss',
  'sfx_guard',
  'sfx_shield_up',
  'sfx_shield_break',
  'sfx_status_apply',
  'sfx_heal',
  'sfx_level_up',
  'sfx_echo_gain',
  'sfx_resonance',
  'sfx_intent_flip',
  'sfx_clock_warning',
  'sfx_breach_tear',
  'sfx_forge_hammer',
  'sfx_coin',
  'sfx_combat_start',
  'sfx_victory',
  'sfx_ko',
] as const;

export type SfxId = (typeof SFX_IDS)[number];
/** DESIGN §18.3's combat percussion (music bus), heard in fights but not one of the 30. */
export type PercId = 'sfx_perc_kick' | 'sfx_perc_hat';
export type SoundId = SfxId | PercId;

export interface SoundParams {
  /** A recipe's flavour: the damage type for `sfx_crit`, `burn`/`bleed`/`shock` for `sfx_status_apply`, `late` for `sfx_clock_warning`. */
  variant?: string;
  /** How many blips (`sfx_resonance`). */
  n?: number;
}

export type Recipe = (v: Voice, p: SoundParams) => number;

type HitId = 'sfx_hit_physical' | 'sfx_hit_fire' | 'sfx_hit_storm' | 'sfx_hit_ley' | 'sfx_hit_void' | 'sfx_hit_chrono';

const HITS: Record<HitId, Recipe> = {
  // a dull thud under a short scuff
  sfx_hit_physical: (v) => {
    noise(v, { dur: 0.03, gain: 0.32, type: 'bandpass', f: 1400, q: 0.8 });
    tone(v, { f: 150, to: 62, dur: 0.08, gain: 0.5, attack: 0.002 });
    return 0.1;
  },
  // a roaring band of noise falling in pitch, under a sinking low sweep
  sfx_hit_fire: (v) => {
    noise(v, { dur: 0.2, gain: 0.24, type: 'bandpass', f: 2200, to: 900, q: 0.9, attack: 0.01 });
    tone(v, { f: 90, to: 45, dur: 0.2, gain: 0.34, attack: 0.004 });
    return 0.22;
  },
  // a dry crack, then a falling zap
  sfx_hit_storm: (v) => {
    noise(v, { dur: 0.015, gain: 0.34, type: 'highpass', f: 2000 });
    tone(v, { type: 'triangle', f: 4000, to: 200, dur: 0.12, gain: 0.1, attack: 0.001 });
    return 0.14;
  },
  // a glassy fifth with a slow release (the ley lines ring)
  sfx_hit_ley: (v) => {
    noise(v, { dur: 0.02, gain: 0.12, type: 'highpass', f: 3000 });
    tone(v, { type: 'triangle', f: 523, dur: 0.3, gain: 0.12, attack: 0.006 });
    tone(v, { type: 'triangle', f: 784, dur: 0.3, gain: 0.08, attack: 0.006 });
    return 0.32;
  },
  // a breath drawn in (reversed noise) into a sub-bass knock
  sfx_hit_void: (v) => {
    noise(v, { dur: 0.25, gain: 0.3, type: 'lowpass', f: 300, reverse: true });
    tone(v, { f: 60, dur: 0.25, gain: 0.45, attack: 0.01 });
    return 0.27;
  },
  // three stuttered blips stepping down: time skipping
  sfx_hit_chrono: (v) => {
    [880, 784, 698].forEach((f, i) => tone(v, { f, at: i * 0.05, dur: 0.04, gain: 0.13, attack: 0.002 }));
    return 0.16;
  },
};

const isHit = (id: string): id is HitId => id in HITS;

/** Status tails for `sfx_status_apply` (DESIGN §18.3): Burn crackles, Bleed drips, Shock buzzes; others get a low murmur. */
function statusTail(v: Voice, variant: string | undefined): number {
  switch (variant) {
    case 'burn':
      for (let i = 0; i < 4; i++) noise(v, { at: 0.05 + v.rnd() * 0.18, dur: 0.012, gain: 0.14, type: 'highpass', f: 3000 });
      return 0.26;
    case 'bleed':
      tone(v, { f: 2000, to: 1200, at: 0.08, dur: 0.03, gain: 0.07, attack: 0.001 });
      tone(v, { f: 2000, to: 1200, at: 0.18, dur: 0.03, gain: 0.05, attack: 0.001 });
      return 0.22;
    case 'shock':
      tone(v, { type: 'sawtooth', f: 110, at: 0.04, dur: 0.15, gain: 0.05, attack: 0.005 });
      tone(v, { type: 'sawtooth', f: 113, at: 0.04, dur: 0.15, gain: 0.04, attack: 0.005 });
      return 0.2;
    default:
      tone(v, { f: 330, to: 294, at: 0.04, dur: 0.12, gain: 0.06, attack: 0.01 });
      return 0.17;
  }
}

export const RECIPES: Record<SoundId, Recipe> = {
  // a tiny click, softened from a square's edge
  sfx_ui_tick: (v) => {
    tone(v, { type: 'square', f: 2000, dur: 0.02, gain: 0.03, attack: 0.002 });
    return 0.03;
  },
  sfx_ui_confirm: (v) => {
    tone(v, { f: 660, to: 880, dur: 0.06, gain: 0.14, attack: 0.004 });
    tone(v, { type: 'triangle', f: 330, to: 440, dur: 0.07, gain: 0.06, attack: 0.004 });
    return 0.08;
  },
  sfx_ui_back: (v) => {
    tone(v, { f: 440, to: 330, dur: 0.06, gain: 0.13, attack: 0.004 });
    return 0.07;
  },
  // two short low buzzes
  sfx_ui_error: (v) => {
    tone(v, { type: 'square', f: 220, dur: 0.04, gain: 0.05, attack: 0.002 });
    tone(v, { type: 'square', f: 220, at: 0.07, dur: 0.04, gain: 0.05, attack: 0.002 });
    return 0.12;
  },
  // three muffled footfalls, each a little different
  sfx_travel: (v) => {
    for (let i = 0; i < 3; i++) {
      noise(v, { at: i * 0.08, dur: 0.05, gain: 0.2 + v.rnd() * 0.08, type: 'lowpass', f: 380 + v.rnd() * 60 });
      tone(v, { f: 85 + v.rnd() * 10, to: 55, at: i * 0.08, dur: 0.05, gain: 0.12, attack: 0.003 });
    }
    return 0.24;
  },
  // a slow rising sine with its fifth over a soft wash of air: first light
  sfx_rest_dawn: (v) => {
    tone(v, { f: 110, to: 440, dur: 1.2, gain: 0.12, attack: 0.35 });
    tone(v, { type: 'triangle', f: 165, to: 660, dur: 1.2, gain: 0.04, attack: 0.45 });
    noise(v, { dur: 1.4, gain: 0.035, type: 'lowpass', f: 400, to: 2400, attack: 0.6 });
    return 1.42;
  },
  ...HITS,
  // the blow of its type, then a high ping
  sfx_crit: (v, p) => {
    const hit = `sfx_hit_${p.variant ?? 'physical'}`;
    const len = (isHit(hit) ? HITS[hit] : HITS.sfx_hit_physical)(v, p);
    tone(v, { f: 1200, at: 0.02, dur: 0.15, gain: 0.08, attack: 0.002 });
    tone(v, { f: 1800, at: 0.02, dur: 0.1, gain: 0.03, attack: 0.002 });
    return Math.max(len, 0.18);
  },
  // air cut past you, left to right
  sfx_miss: (v) => {
    noise(v, { dur: 0.12, gain: 0.16, type: 'bandpass', f: 1200, to: 3000, q: 1.2, attack: 0.04, pan: [-0.6, 0.6] });
    return 0.14;
  },
  // metal on metal: an inharmonic pair through a highpass, with a short ring
  sfx_guard: (v) => {
    const hp = v.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 500;
    hp.connect(v.out);
    tone(v, { type: 'square', f: 330, dur: 0.06, gain: 0.05, attack: 0.001, out: hp });
    tone(v, { type: 'square', f: 495, dur: 0.06, gain: 0.04, attack: 0.001, out: hp });
    tone(v, { f: 1320, dur: 0.14, gain: 0.03, attack: 0.001 });
    return 0.16;
  },
  // a rising minor arpeggio: a ward closing round you
  sfx_shield_up: (v) => {
    [440, 523, 659].forEach((f, i) => tone(v, { type: 'triangle', f, at: i * 0.05, dur: 0.09, gain: 0.1, attack: 0.004 }));
    return 0.2;
  },
  // glass: a bright tight crack and a falling tone
  sfx_shield_break: (v) => {
    noise(v, { dur: 0.09, gain: 0.2, type: 'bandpass', f: 5000, q: 3 });
    tone(v, { f: 1760, to: 440, dur: 0.2, gain: 0.07, attack: 0.002 });
    return 0.22;
  },
  sfx_status_apply: (v, p) => {
    tone(v, { f: 660, dur: 0.04, gain: 0.1, attack: 0.003 });
    return Math.max(0.05, statusTail(v, p.variant));
  },
  // three rising steps, warm
  sfx_heal: (v) => {
    tone(v, { f: 523, steps: [659, 784], dur: 0.2, gain: 0.11, attack: 0.01 });
    tone(v, { type: 'triangle', f: 1046, steps: [1318, 1568], dur: 0.2, gain: 0.02, attack: 0.02 });
    return 0.22;
  },
  // a C major triad blooming in, with a shimmer of high noise
  sfx_level_up: (v) => {
    [262, 330, 392].forEach((f, i) => tone(v, { f, at: i * 0.03, dur: 0.8, gain: 0.08, attack: 0.03 }));
    noise(v, { at: 0.05, dur: 0.6, gain: 0.025, type: 'highpass', f: 6000, attack: 0.1 });
    return 0.9;
  },
  // a bell (1047 Hz and two inharmonic partials) in a small dark room
  sfx_echo_gain: (v) => {
    const out = room(v, 0.13, 0.32, 1800);
    tone(v, { f: 1047, dur: 2, gain: 0.09, attack: 0.003, out });
    tone(v, { f: 1047 * 2.76, dur: 0.9, gain: 0.025, attack: 0.002, out });
    tone(v, { f: 1047 * 5.4, dur: 0.35, gain: 0.012, attack: 0.002, out });
    return 2.3;
  },
  // one soft blip per unit (≤ 5)
  sfx_resonance: (v, p) => {
    const n = Math.max(1, Math.min(5, Math.round(p.n ?? 1)));
    for (let i = 0; i < n; i++) tone(v, { f: 880, at: i * 0.09, dur: 0.08, gain: 0.07, attack: 0.006 });
    return (n - 1) * 0.09 + 0.09;
  },
  // two quick soft square notes: the creature changes its mind
  sfx_intent_flip: (v) => {
    const lp = v.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    lp.connect(v.out);
    tone(v, { type: 'square', f: 440, dur: 0.04, gain: 0.05, attack: 0.002, out: lp });
    tone(v, { type: 'square', f: 523, at: 0.045, dur: 0.04, gain: 0.05, attack: 0.002, out: lp });
    return 0.1;
  },
  // a low bell over its sub-octave; near the end (`late`) a detuned partner makes it beat
  sfx_clock_warning: (v, p) => {
    tone(v, { f: 220, dur: 1.5, gain: 0.14, attack: 0.004 });
    tone(v, { f: 110, dur: 1.5, gain: 0.16, attack: 0.01 });
    tone(v, { f: 220 * 2.76, dur: 0.5, gain: 0.02, attack: 0.003 });
    if (p.variant === 'late') tone(v, { f: 226, dur: 1.5, gain: 0.1, attack: 0.004, detune: -12 });
    return 1.52;
  },
  // the world tearing: a slow noise sweep opening upward over a 30 Hz floor (with a 60 Hz partial small speakers can play)
  sfx_breach_tear: (v) => {
    noise(v, { dur: 2, gain: 0.16, type: 'lowpass', f: 200, to: 4000, q: 2, attack: 1.2 });
    tone(v, { f: 30, dur: 2, gain: 0.35, attack: 0.5 });
    tone(v, { f: 60, to: 52, dur: 2, gain: 0.08, attack: 0.6 });
    return 2.02;
  },
  // strike, thump, then the anvil rings
  sfx_forge_hammer: (v) => {
    noise(v, { dur: 0.02, gain: 0.28, type: 'bandpass', f: 2500, q: 0.8 });
    tone(v, { f: 200, to: 120, dur: 0.06, gain: 0.36, attack: 0.001 });
    tone(v, { f: 1800, dur: 0.3, gain: 0.05, attack: 0.001 });
    tone(v, { f: 2690, dur: 0.18, gain: 0.025, attack: 0.001 });
    return 0.32;
  },
  // two little clinks
  sfx_coin: (v) => {
    tone(v, { f: 2200, dur: 0.03, gain: 0.07, attack: 0.001 });
    tone(v, { f: 3100, at: 0.04, dur: 0.03, gain: 0.06, attack: 0.001 });
    return 0.08;
  },
  // a low drum with a snap on top
  sfx_combat_start: (v) => {
    tone(v, { f: 90, to: 55, glide: 0.05, dur: 0.2, gain: 0.5, attack: 0.002 });
    noise(v, { dur: 0.025, gain: 0.16, type: 'highpass', f: 1500 });
    return 0.22;
  },
  // three rising triangle notes, the last held
  sfx_victory: (v) => {
    tone(v, { type: 'triangle', f: 330, dur: 0.15, gain: 0.11, attack: 0.006 });
    tone(v, { type: 'triangle', f: 440, at: 0.15, dur: 0.15, gain: 0.11, attack: 0.006 });
    tone(v, { type: 'triangle', f: 550, at: 0.3, dur: 0.35, gain: 0.11, attack: 0.006 });
    return 0.66;
  },
  // a long fall, with a soft body-thud under its start
  sfx_ko: (v) => {
    tone(v, { f: 330, to: 110, dur: 0.4, gain: 0.14, attack: 0.006 });
    noise(v, { dur: 0.08, gain: 0.12, type: 'lowpass', f: 250 });
    return 0.42;
  },
  sfx_perc_kick: (v) => {
    tone(v, { f: 80, to: 50, glide: 0.04, dur: 0.12, gain: 0.3, attack: 0.002 });
    return 0.13;
  },
  sfx_perc_hat: (v) => {
    noise(v, { dur: 0.04, gain: 0.035, type: 'highpass', f: 7000 });
    return 0.05;
  },
};
