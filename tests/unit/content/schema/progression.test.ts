// U17: AchievementSchema, AttunementSchema, ModifierSchema (PLAN §5.13) and EndingSchema (PLAN §5.14) — DESIGN §10.7 /
// §11.5 / §15.1 and STORY §10 records parse; per-record rules bite.
import { describe, expect, test } from 'bun:test';
import { AchievementSchema } from '@schema/achievement';
import { AttunementSchema } from '@schema/attunement';
import { CLOSER_IDS, ENDING_IDS, ENDING_LETTERS, EndingRecordId, EndingSchema, TRUE_ENDING_IDS } from '@schema/ending';
import { ModifierSchema, REQUIRED_MODIFIERS } from '@schema/modifier';
import {
  achievementTwoOaths,
  attunementSteadyHand,
  attunementSteadyHours,
  closerEscape,
  endingWardensVigil,
  modifierFrayedClock,
} from '../examples';

const issuesOf = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } } }, value: unknown): string[] => {
  const r = schema.safeParse(value);
  return r.success ? [] : (r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`);
};
const expectIssue = (schema: Parameters<typeof issuesOf>[0], value: unknown, path: string, fragment: string) => {
  const found = issuesOf(schema, value);
  expect(found.some((i) => i.startsWith(`${path}: `) && i.includes(fragment)), `wanted "${path}: …${fragment}…", got ${JSON.stringify(found)}`).toBe(true);
};

describe('AchievementSchema', () => {
  test('ach_two_oaths parses; defaults: checkpoints loop_end + ending, 10 Resonance, not hidden', () => {
    expect(AchievementSchema.parse(achievementTwoOaths)).toMatchObject({ hidden: true, checkpoints: ['loop_end', 'ending'], resonance: 10 });
    const { hidden: _h, ...visible } = achievementTwoOaths;
    expect(AchievementSchema.parse(visible).hidden).toBe(false);
  });

  test('ids are ach_*, the condition is checked, checkpoints are a closed non-empty set', () => {
    expectIssue(AchievementSchema, { ...achievementTwoOaths, id: 'two_oaths' }, 'id', 'ach_');
    expectIssue(AchievementSchema, { ...achievementTwoOaths, when: { rep: { faction: 'nomads' } } }, 'when.rep.faction', 'Invalid enum value');
    expectIssue(AchievementSchema, { ...achievementTwoOaths, checkpoints: [] }, 'checkpoints', 'at least 1');
    expectIssue(AchievementSchema, { ...achievementTwoOaths, checkpoints: ['often'] }, 'checkpoints.0', 'Invalid enum value');
    expectIssue(AchievementSchema, { ...achievementTwoOaths, when: undefined }, 'when', '');
  });
});

describe('AttunementSchema', () => {
  test('DESIGN §10.7 Steady Hand and Steady Hours parse', () => {
    expect(AttunementSchema.parse(attunementSteadyHand)).toMatchObject({ cost: 20, effects: [{ kind: 'hp_max_pct', pct: 0.05 }] });
    expect(AttunementSchema.parse(attunementSteadyHours)).toMatchObject({ cost: 50, effects: [{ kind: 'clock_watches', watches: 4 }], requires: { echo: 'echo_breach_clock' } });
  });

  test('every effect kind of PLAN §5.13 parses; item effects default to count 1', () => {
    const effects = [
      { kind: 'start_gold', amount: 60 },
      { kind: 'start_item', itemId: 'item_glow_moss' },
      { kind: 'stat', stat: 'agility', amount: 1 },
      { kind: 'hp_max_pct', pct: 0.05 },
      { kind: 'clock_watches', watches: 4 },
      { kind: 'xp_pct', pct: 0.1 },
      { kind: 'shop_discount_pct', pct: 0.05 },
      { kind: 'ability_points', amount: 1 },
      { kind: 'reveal_region', regionId: 'region_veil' },
      { kind: 'loyalty_start', amount: 5 },
      { kind: 'rest_heal_pct', pct: 0.1 },
      { kind: 'flee_pct', pct: 0.1 },
    ];
    const parsed = AttunementSchema.parse({ ...attunementSteadyHand, effects });
    expect(parsed.effects).toHaveLength(12);
    expect(parsed.effects[1]).toEqual({ kind: 'start_item', itemId: 'item_glow_moss', count: 1 });
  });

  test('ids, costs, effect shapes', () => {
    expectIssue(AttunementSchema, { ...attunementSteadyHand, id: 'steady_hand' }, 'id', 'att_');
    expectIssue(AttunementSchema, { ...attunementSteadyHand, cost: 0 }, 'cost', '');
    expectIssue(AttunementSchema, { ...attunementSteadyHand, effects: [] }, 'effects', 'at least 1');
    expectIssue(AttunementSchema, { ...attunementSteadyHand, effects: [{ kind: 'levitate' }] }, 'effects.0.kind', 'Invalid discriminator');
    expectIssue(AttunementSchema, { ...attunementSteadyHand, effects: [{ kind: 'start_gold', amount: 1.5 }] }, 'effects.0.amount', 'integer');
    expectIssue(AttunementSchema, { ...attunementSteadyHand, effects: [{ kind: 'start_gold', amount: 5, extra: 1 }] }, 'effects.0', 'Unrecognized key');
    expectIssue(AttunementSchema, { ...attunementSteadyHand, effects: [{ kind: 'start_item', itemId: 'moss' }] }, 'effects.0.itemId', 'item_ or mat_');
    expectIssue(AttunementSchema, { ...attunementSteadyHand, requires: { echo: 'breach_clock' } }, 'requires.echo', 'echo_');
  });
});

describe('ModifierSchema', () => {
  test('DESIGN §15.1 Frayed Clock parses', () => {
    expect(ModifierSchema.parse(modifierFrayedClock).rules).toEqual([{ kind: 'clock_base_watches', watches: 80, halveOthers: true }]);
  });

  test('the six D-021 modifiers are the required set; every rule kind parses', () => {
    expect([...REQUIRED_MODIFIERS]).toEqual(['mod_iron_loop', 'mod_frayed_clock', 'mod_mute_ley', 'mod_horde_rising', 'mod_glass', 'mod_pacifist']);
    const rules = [
      { kind: 'disable_attunements' },
      { kind: 'clock_base_watches', watches: 80, halveOthers: true },
      { kind: 'disable_echo_shortcuts' },
      { kind: 'elite_chance', pct: 0.3 },
      { kind: 'damage_multiplier', outgoing: 2, incoming: 2 },
      { kind: 'xp_sources', allow: ['quest', 'discovery'] },
      { kind: 'custom', scriptId: 'pacifist_vow' },
    ];
    expect(ModifierSchema.parse({ ...modifierFrayedClock, rules }).rules).toHaveLength(7);
  });

  test('ids and rule bounds', () => {
    expectIssue(ModifierSchema, { ...modifierFrayedClock, id: 'frayed_clock' }, 'id', 'mod_');
    expectIssue(ModifierSchema, { ...modifierFrayedClock, rules: [] }, 'rules', 'at least 1');
    expectIssue(ModifierSchema, { ...modifierFrayedClock, rules: [{ kind: 'clock_base_watches', watches: 12, halveOthers: false }] }, 'rules.0.watches', '');
    expectIssue(ModifierSchema, { ...modifierFrayedClock, rules: [{ kind: 'elite_chance', pct: 1.5 }] }, 'rules.0.pct', '');
    expectIssue(ModifierSchema, { ...modifierFrayedClock, rules: [{ kind: 'xp_sources', allow: ['gift'] }] }, 'rules.0.allow.0', 'Invalid enum value');
    expectIssue(ModifierSchema, { ...modifierFrayedClock, achievementId: 'frayed' }, 'achievementId', 'ach_');
  });
});

describe('EndingSchema', () => {
  test('STORY §10.1 ending A and §10.7 closer_escape parse with defaults', () => {
    const a = EndingSchema.parse(endingWardensVigil);
    expect(a).toMatchObject({ letter: 'A', kind: 'true', reasons: [], resonance: 50, credits: true, achievementId: 'ach_the_ninth_verse' });
    expect(a.sequence).toHaveLength(3);
    expect(a.epilogues[0]).toEqual({ subject: 'remnants', text: 'The Ledger gains an eighth name and the words "did not die."' });
    const closer = EndingSchema.parse(closerEscape);
    expect(closer).toMatchObject({ kind: 'closer', reasons: [], credits: false, requirementTexts: [], epilogues: [] });
    expect(closer.letter).toBeUndefined();
  });

  test('the eight record ids: six true endings A–F and the two closers (STORY §10)', () => {
    expect(ENDING_IDS).toHaveLength(8);
    expect([...TRUE_ENDING_IDS]).toEqual(Object.values(ENDING_LETTERS));
    expect(Object.keys(ENDING_LETTERS)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect([...CLOSER_IDS]).toEqual(['closer_escape', 'closer_fall']);
    expect([...EndingRecordId.options].sort()).toEqual([...ENDING_IDS].sort());
    expectIssue(EndingSchema, { ...endingWardensVigil, id: 'ending_the_end' }, 'id', 'Invalid enum value');
  });

  test('kind and letter follow the id', () => {
    expectIssue(EndingSchema, { ...endingWardensVigil, kind: 'closer' }, 'kind', "kind must be 'true'");
    expectIssue(EndingSchema, { ...closerEscape, kind: 'true' }, 'kind', "kind must be 'closer'");
    expectIssue(EndingSchema, { ...endingWardensVigil, letter: 'B' }, 'letter', 'is ending A');
    expectIssue(EndingSchema, { ...endingWardensVigil, letter: undefined }, 'letter', 'is ending A');
    expectIssue(EndingSchema, { ...closerEscape, letter: 'A' }, 'letter', 'no letter');
  });

  test('closer_fall carries its reasons (incl. released, D-067.14); no other ending does', () => {
    const fall = { ...closerEscape, id: 'closer_fall', name: 'The Fall', reasons: ['death', 'expiry', 'rejected', 'released'] };
    expect(EndingSchema.parse(fall).reasons).toEqual(['death', 'expiry', 'rejected', 'released']);
    expectIssue(EndingSchema, { ...fall, reasons: ['boredom'] }, 'reasons.0', 'Invalid enum value');
    expectIssue(EndingSchema, { ...closerEscape, reasons: ['death'] }, 'reasons', 'closer_fall only');
  });

  test('requirements and sequence', () => {
    expectIssue(EndingSchema, { ...endingWardensVigil, sequence: [] }, 'sequence', 'at least 1');
    expectIssue(EndingSchema, { ...endingWardensVigil, requirements: { echoes: 'echo_x' } }, 'requirements.echoes', "unknown condition atom 'echoes'");
    expectIssue(EndingSchema, { ...endingWardensVigil, requirements: undefined }, 'requirements', '');
    expectIssue(EndingSchema, { ...endingWardensVigil, achievementId: 'ninth_verse' }, 'achievementId', 'ach_');
  });
});
