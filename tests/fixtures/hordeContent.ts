// Horde and loop-end fixtures (U30; PLAN §8, §9.1 "later units may append fixtures for their own systems"): the companion
// pack (Brak and his NPC, the Mistwood Path, the Loop 1 Contained Tyrant) plus
//   - the Loop 1 Apex encounter with the Contained Tyrant (`enc_apex_contained`, `{ loop: { max: 1 } }`; the fixture's
//     own Apex fight is the Unveiled Tyrant from Loop 2, D-051),
//   - WORLD §12.1's Horde state for the other fixed groups: none while `flag_horde_active` (the Library's Shades stand
//     down, "Ilyra holds the stacks"; elsewhere "no new fights, the entry damage is the threat"),
//   - no wandering rolls (every region's return chance 0), so a walk through the Horde is deterministic,
//   - the Echoes the engine grants itself (STORY §12: `echo_horde_path`, `echo_brak_death`, `echo_amulet_memory`,
//     `echo_ending_f`). No content effect grants them, so the pack skips `validateContent` (rule 16 would flag them).
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import type { Condition } from '@schema/condition';
import type { EchoInput } from '@schema/echo';
import type { LocationInput } from '@schema/location';
import { clone, deepFreeze } from '@engine/util/clone';
import { CONTAINED } from './combatContent';
import { companionTables } from './companionContent';
import { FIXTURE_VERSION } from './miniContent';

export const APEX_CONTAINED = 'enc_apex_contained';
const NOT_IN_HORDE: Condition = { not: { flag: 'flag_horde_active' } };

/** STORY §12 rows the engine grants (fixture codex lines). */
export const engineEchoes: EchoInput[] = [
  { id: 'echo_horde_path', name: 'How the Unraveling Spreads', codexLine: 'Fixture: I watched it spread.', category: 'secret', obtainedBy: ['engine:horde'] },
  { id: 'echo_brak_death', name: 'Brak Stonehand', codexLine: 'Fixture: he held the line.', category: 'character', obtainedBy: ['engine:horde'] },
  { id: 'echo_amulet_memory', name: 'The Amulet Remembers', codexLine: 'Fixture: I woke, and it was warm.', category: 'lore', obtainedBy: ['engine:waking'] },
  { id: 'echo_ending_f', name: 'Witnessed', codexLine: 'Fixture: I went through.', category: 'ending', obtainedBy: ['engine:ending'] },
];

export function hordeTables(): ContentTables {
  const base = companionTables();
  const locations = base.locations.map((loc) => {
    const l = clone(loc) as LocationInput;
    const own = (l.encounters ?? []).map((e) => ({ ...e, when: e.when === undefined ? NOT_IN_HORDE : { all: [e.when, NOT_IN_HORDE] } }));
    l.encounters =
      l.id === 'loc_temporal_breach_apex'
        ? [{ id: APEX_CONTAINED, groups: [{ creatureId: CONTAINED }], when: { loop: { max: 1 } }, fleeable: false, onFlee: 'hold' as const }, ...own]
        : own;
    return l;
  });
  return {
    ...base,
    regions: base.regions.map((r) => ({ ...clone(r), returnEncounterChance: 0 })),
    locations,
    echoes: [...base.echoes, ...engineEchoes],
  };
}

let cached: ContentPack | null = null;

/** The Horde pack (cached, frozen; parsed by every schema, cross-reference validation skipped — see the header). */
export function hordePack(): ContentPack {
  cached ??= deepFreeze(buildContentPack(hordeTables(), { version: FIXTURE_VERSION, validate: false }));
  return cached;
}
