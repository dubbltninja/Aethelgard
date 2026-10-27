// Threshold fixtures (U31; PLAN §8, §9.1 "later units may append fixtures for their own systems"): the Horde pack plus
//   - DESIGN §10.7's fifteen Attunements with their costs, written with AttunementSchema's kinds (the `custom` scripts
//     of engine/runRules.ts `ATT_SCRIPT` where no kind says the effect),
//   - DESIGN §15.1's six challenge modifiers (Frayed Clock is the fixture's own),
//   - `echo_breach_clock` (STORY §12; `att_steady_hours` requires it),
//   - an inn at the Silverwood Plaza (40 gold a night; fixture) for Old Road,
//   - (U34c) WORLD §3.12's Still Shore with Dask standing on it (the companion pack's `npc_dask`) and one scene of his,
//     from Loop 3 and not repeatable: `talk` at the Threshold (D-012, D-084). The Shore has no exits (the Threshold is
//     reached only by a loop's end) and is the only Threshold place here.
// Cross-reference validation is skipped as for the Horde pack (its engine-granted Echoes).
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import type { AttunementInput } from '@schema/attunement';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { EchoInput } from '@schema/echo';
import type { LocationInput } from '@schema/location';
import type { ModifierInput } from '@schema/modifier';
import type { RegionInput } from '@schema/region';
import { clone, deepFreeze } from '@engine/util/clone';
import { hordeTables } from './hordeContent';
import { FIXTURE_VERSION } from './miniContent';

/** The Plaza's fixture inn (Old Road's free night). */
export const INN_COST = 40;

const att = (id: `att_${string}`, name: string, cost: number, effects: AttunementInput['effects'], extra: Partial<AttunementInput> = {}): AttunementInput => ({
  id,
  name,
  description: `Fixture: ${name}.`,
  cost,
  effects,
  icon: id.slice(4),
  ...extra,
});

/** DESIGN §10.7, in its order (total 440). */
export const thresholdAttunements: AttunementInput[] = [
  att('att_steady_hand', 'Steady Hand', 20, [{ kind: 'hp_max_pct', pct: 0.05 }]),
  att('att_deep_well', 'Deep Well', 20, [{ kind: 'mp_max_pct', pct: 0.05 }]),
  att('att_full_purse', 'Full Purse', 15, [{ kind: 'start_gold', amount: 60 }]),
  att('att_old_road', 'Old Road', 15, [{ kind: 'custom', scriptId: 'free_inn_rest' }]),
  att('att_foresight', 'Foresight', 40, [{ kind: 'custom', scriptId: 'foresight' }]),
  att('att_quick_study', 'Quick Study', 30, [{ kind: 'xp_pct', pct: 0.1 }]),
  att('att_keen_eye', 'Keen Eye', 25, [{ kind: 'custom', scriptId: 'crit', params: { amount: 3 } }]),
  att('att_light_step', 'Light Step', 20, [{ kind: 'custom', scriptId: 'travel_regen', params: { hpPct: 0.05, mpPct: 0.1 } }]),
  att('att_steady_hours', 'Steady Hours', 50, [{ kind: 'clock_watches', watches: 4 }], { requires: { echo: 'echo_breach_clock' } }),
  att('att_borins_favor', "Borin's Favor", 25, [{ kind: 'custom', scriptId: 'forge_discount', params: { pct: 0.15 } }]),
  att('att_kaelens_ledger', "Kaelen's Ledger", 25, [{ kind: 'shop_discount_pct', pct: 0.05 }]),
  att('att_remembered_steps', 'Remembered Steps', 40, [{ kind: 'custom', scriptId: 'remembered_steps' }]),
  att('att_echo_sense', 'Echo-Sense', 20, [{ kind: 'custom', scriptId: 'reveal_resistances' }]),
  att('att_companions_trust', "Companion's Trust", 25, [{ kind: 'custom', scriptId: 'loyalty_gain', params: { pct: 0.25 } }]),
  att('att_second_wind', 'Second Wind', 60, [{ kind: 'custom', scriptId: 'second_wind' }]),
];

/** DESIGN §15.1. */
export const thresholdModifiers: ModifierInput[] = [
  { id: 'mod_iron_loop', name: 'Iron Loop', description: 'Equipped Attunements inactive this loop.', rules: [{ kind: 'disable_attunements' }], icon: 'iron_loop' },
  {
    id: 'mod_frayed_clock',
    name: 'Frayed Clock',
    description: 'Base clock 20 days; all clock modifiers halved toward zero.',
    rules: [{ kind: 'clock_base_watches', watches: 80, halveOthers: true }],
    icon: 'frayed_clock',
  },
  { id: 'mod_mute_ley', name: 'Mute Ley', description: 'Echo shortcuts disabled.', rules: [{ kind: 'disable_echo_shortcuts' }], icon: 'mute_ley' },
  { id: 'mod_horde_rising', name: 'Horde Rising', description: 'Elites everywhere.', rules: [{ kind: 'elite_chance', pct: 0.3 }], icon: 'horde_rising' },
  { id: 'mod_glass', name: 'Glass', description: 'All damage ×2, both ways.', rules: [{ kind: 'damage_multiplier', outgoing: 2, incoming: 2 }], icon: 'glass' },
  {
    id: 'mod_pacifist',
    name: "Pacifist's Vow",
    description: 'Kill XP 0; quest and discovery XP ×2.',
    rules: [{ kind: 'xp_sources', allow: ['quest', 'discovery'] }],
    icon: 'pacifist',
  },
];

const breachClock: EchoInput = {
  id: 'echo_breach_clock',
  name: 'The Breach Clock',
  codexLine: 'Fixture: I can count the dawns now.',
  category: 'lore',
  obtainedBy: ['quest:q_echo_crystal'],
};

/** WORLD §2.12 / §3.12; DESIGN §17.1's Threshold palette. */
const thresholdRegion: RegionInput = {
  id: 'region_threshold',
  name: 'The Threshold',
  description: 'A shore of black sand under no sky, inside the Breach.',
  order: 12,
  levelBand: { min: 1, max: 20 }, // fixture: WORLD gives none (no combat)
  palette: { bg: '#05060C', bgAlt: '#1A2140', fg: '#0F1428', accent: '#283055', glow: '#B8C7FF' },
  ambient: 'threshold_drone',
};

/** The Still Shore and who stands on it (U34c). */
export const SHORE = 'loc_still_shore';
export const DASK_NPC = 'npc_dask';
export const DASK_SHORE_SCENE = 'scene_fixture_dask_shore';

const stillShore: LocationInput = {
  id: SHORE,
  regionId: 'region_threshold',
  name: 'The Still Shore',
  description: 'Black sand. Still water that shows no reflection, only what happened. No sky, but a light far out across the water.',
  exits: [],
  npcs: [DASK_NPC],
  art: { template: 'threshold', silhouettes: ['flat_shore', 'far_light'], particles: 'none', timeOfDay: 'timeless' },
  map: { x: 72, y: 14 },
  temporallyUnstable: true,
  tags: ['threshold'],
};

/**
 * Fixture lines (WORLD §4's barks for Dask). One answer sets a flag and pays 5 Resonance, so a test can see the choice
 * landed and that Resonance gained at the Threshold is not the next loop's tally.
 */
const daskShore: DialogueSceneInput = {
  id: DASK_SHORE_SCENE,
  npcId: DASK_NPC,
  title: 'The man on the shore',
  when: { loop: { min: 3 } }, // WORLD §3.12: Dask stands on the Shore from Loop 3
  repeatable: false,
  entry: 'greet',
  nodes: [
    {
      id: 'greet',
      speaker: DASK_NPC,
      text: 'Hells of a road, this. I walked it seventy years ago. Or — tomorrow.',
      choices: [
        { id: 'ask', text: 'What do I do differently?', effects: [{ setFlag: 'flag_fixture_dask_asked' }, { resonance: 5 }], next: 'advice' },
        { id: 'leave', text: 'Leave him to the water.', next: 'end' },
      ],
    },
    { id: 'advice', speaker: DASK_NPC, text: "Don't strike it first. It won't strike what keeps its distance.", next: 'end' },
  ],
};

export function thresholdTables(): ContentTables {
  const base = hordeTables();
  return {
    ...base,
    regions: [...base.regions, thresholdRegion],
    locations: [
      ...base.locations.map((loc) => {
        const l = clone(loc) as LocationInput;
        if (l.id === 'loc_silverwood_plaza') l.rest = { kind: 'inn', cost: INN_COST, text: 'Fixture: a bed above the stall.' };
        return l;
      }),
      stillShore,
    ],
    dialogues: [...base.dialogues, daskShore],
    echoes: [...base.echoes, breachClock],
    attunements: thresholdAttunements,
    modifiers: thresholdModifiers,
  };
}

let cached: ContentPack | null = null;

/** The Threshold pack (cached, frozen; parsed by every schema, cross-reference validation skipped). */
export function thresholdPack(): ContentPack {
  cached ??= deepFreeze(buildContentPack(thresholdTables(), { version: FIXTURE_VERSION, validate: false }));
  return cached;
}
