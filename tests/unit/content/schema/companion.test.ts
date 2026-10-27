// U16: CompanionSchema (PLAN §5.11). Brak and Dask parse from DESIGN §12.3–12.4 / §12.8 and STORY §11 (arc quests);
// per-record rules fail with clear messages.
import { describe, expect, test } from 'bun:test';
import { CompanionSchema, type CompanionInput } from '@schema/companion';

const issues = (value: unknown): string[] => {
  const r = CompanionSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const expectIssue = (value: unknown, path: string, fragment: string) => {
  const found = issues(value);
  expect(found.some((i) => i.startsWith(`${path}: `) && i.includes(fragment)), `wanted "${path}: …${fragment}…", got ${JSON.stringify(found)}`).toBe(true);
};

const brak = {
  id: 'brak',
  npcId: 'npc_brak',
  name: 'Brak',
  role: 'bruiser',
  stats: { hp: 130, atk: 12, sp: 0, agi: 5, armor: 4, ward: 0 },
  perLevel: { hp: 10, atk: 1, sp: 0 },
  abilities: ['comp_brak_axe', 'comp_brak_cleave', 'comp_brak_shieldbreak'],
  signature: { abilityId: 'comp_brak_hold_the_line', cooldown: 4 },
  stances: { aggressive: { targetRule: 'lowest_hp' }, guarded: { guardBelowHpPct: 0.35 }, support: { healAllyBelowPct: 0.6 } },
  deathRule: 'permadeath_scripted',
  arcQuestIds: ['q_the_scouts_oath', 'q_blood_and_salt', 'q_the_line_he_holds'],
  banter: [{ locationId: 'loc_barren_peaks', text: 'The Peaks were quiet before the Brute.' }],
  campScenes: ['scene_brak_camp_1'],
  portrait: { sigil: 'brak', accent: 'ironclad' },
} satisfies CompanionInput;

const dask = {
  id: 'dask',
  npcId: 'npc_dask',
  name: 'Dask',
  role: 'caster',
  damageType: 'chrono',
  stats: { hp: 70, atk: 6, sp: 10, agi: 12, armor: 0, ward: 2, evasion: 20 },
  perLevel: { hp: 5, atk: 0.5, sp: 1 },
  abilities: ['comp_dask_flicker_strike', 'comp_dask_stall', 'comp_dask_glimpse'],
  signature: { abilityId: 'comp_dask_between_instants', cooldown: 5 },
  requiresTemporallyUnstable: true,
  constraintText: 'Dask flickers and cannot follow.',
  arcQuestIds: ['q_the_flickering_man', 'q_seven_marks', 'q_the_last_instant'],
  banter: [{ when: { echo: 'echo_tyrant_speaks' }, regionId: 'region_apex', text: 'It knows my name.', loyalty: 2 }],
  portrait: { sigil: 'dask' },
} satisfies CompanionInput;

describe('two companions parse (DESIGN §12)', () => {
  test('Brak', () => {
    const c = CompanionSchema.parse(brak);
    expect(c).toMatchObject({ damageType: 'physical', startingLoyalty: 0, requiresTemporallyUnstable: false, statusImmunities: [] });
    expect(c.stats.evasion).toBe(0);
    expect(c.stances.guarded).toEqual({ guardBelowHpPct: 0.35, healAllyBelowPct: 0.4, preferStatuses: false, targetRule: 'lowest_hp', abilityWeight: 0.6 });
    expect(c.banter[0]?.loyalty).toBe(0);
  });

  test('Dask (location-restricted, innate evasion)', () => {
    const c = CompanionSchema.parse(dask);
    expect(c).toMatchObject({ damageType: 'chrono', requiresTemporallyUnstable: true, deathRule: 'ko', stances: {} });
    expect(c.stats.evasion).toBe(20);
    expect(c.signature).toEqual({ abilityId: 'comp_dask_between_instants', cooldown: 5 });
  });
});

describe('invalid companions fail with clear messages', () => {
  test('rules', () => {
    expectIssue({ ...brak, id: 'borin' }, 'id', '');
    expectIssue({ ...brak, abilities: brak.abilities.slice(0, 2) }, 'abilities', 'exactly three auto abilities');
    expectIssue({ ...brak, abilities: ['comp_brak_axe', 'comp_nyx_hex', 'comp_brak_cleave'] }, 'abilities.1', "brak's abilities are comp_brak_");
    expectIssue({ ...brak, abilities: ['comp_brak_axe', 'comp_brak_axe', 'comp_brak_cleave'] }, 'abilities.1', 'duplicate auto ability');
    expectIssue({ ...brak, signature: { abilityId: 'comp_brak_axe', cooldown: 4 } }, 'signature.abilityId', 'not one of the three auto abilities');
    expectIssue({ ...brak, signature: { abilityId: 'comp_dask_between_instants', cooldown: 4 } }, 'signature.abilityId', "brak's signature is comp_brak_");
    expectIssue({ ...brak, signature: { abilityId: 'comp_brak_hold_the_line', cooldown: 0 } }, 'signature.cooldown', '');
    expectIssue({ ...dask, constraintText: undefined }, 'constraintText', 'needs constraintText');
    expectIssue({ ...brak, arcQuestIds: [] }, 'arcQuestIds', '');
    expectIssue({ ...brak, arcQuestIds: ['q_blood_and_salt', 'q_blood_and_salt'] }, 'arcQuestIds.1', 'duplicate arc quest');
    expectIssue({ ...brak, arcQuestIds: ['blood_and_salt'] }, 'arcQuestIds.0', 'prefix q_');
    expectIssue({ ...brak, npcId: 'brak' }, 'npcId', 'prefix npc_');
    expectIssue({ ...brak, stances: { reckless: {} } }, 'stances.reckless', '');
    expectIssue({ ...brak, banter: [{ locationId: 'barren_peaks', text: 'x' }] }, 'banter.0.locationId', 'prefix loc_');
    expectIssue({ ...brak, mp: 30 }, '', 'Unrecognized key');
    expectIssue({ ...brak, startingLoyalty: 120 }, 'startingLoyalty', '');
  });
});
