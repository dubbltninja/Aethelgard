// U14: the canonical Effect schema (DESIGN §13.3, PLAN §4.9, D-069.9).
import { describe, expect, test } from 'bun:test';
import { COMBAT_SCOPE_EFFECTS, EFFECT_KEYS, EffectSchema, Effects, isCombatScope, type Effect, type EffectKey } from '@schema/effect';

const issues = (value: unknown): string[] => {
  const r = EffectSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

const VALID: { [K in EffectKey]: Effect[] } = {
  setFlag: [{ setFlag: 'flag_heartstone_destroyed' }],
  clearFlag: [{ clearFlag: 'flag_ilyra_told' }],
  grantEcho: [{ grantEcho: 'echo_heartstone_silence' }],
  questStart: [{ questStart: 'q_clear_path' }],
  questAdvance: [{ questAdvance: { quest: 'q_echoing_heartbeat', stage: 'done_destroy' } }],
  questFail: [{ questFail: 'q_clear_path' }],
  giveItem: [{ giveItem: { item: 'item_heartstone_fragment_dead', count: 2 } }, { giveItem: { item: 'mat_ember_ore', rarity: 'rare' } }],
  takeItem: [{ takeItem: { item: 'item_chronos_lens' } }],
  rep: [{ rep: { faction: 'remnants', delta: -25 } }],
  loyalty: [{ loyalty: { companion: 'brak', delta: 5 } }],
  gold: [{ gold: -30 }],
  xp: [{ xp: 120 }],
  resonance: [{ resonance: 10 }],
  heal: [{ heal: { hp: 'full' } }, { heal: { hp: 20, mp: 'full' } }],
  damage: [{ damage: { hp: 12 } }],
  corruption: [{ corruption: 1 }],
  clockWatches: [{ clockWatches: -40 }, { clockWatches: 24 }],
  passWatches: [{ passWatches: 8 }],
  spawn: [{ spawn: { creature: 'cr_wildling_brute' } }, { spawn: { creature: 'cr_wildling_brute', location: 'loc_mistwood_path' } }],
  teleport: [{ teleport: 'loc_shattered_library' }],
  unlockExit: [{ unlockExit: { from: 'loc_scorched_gate', to: 'loc_reedmarch_descent' } }],
  scatter: [{ scatter: { location: 'loc_barren_peaks' } }],
  multiHit: [{ multiHit: { hits: 7 } }],
  stripBuffs: [{ stripBuffs: { kinds: ['shield', 'regen', 'haste', 'rewind'] } }, { stripBuffs: { kinds: ['haste'], target: 'all_enemies' } }],
  healOnDamage: [{ healOnDamage: { pct: 0.5 } }],
  surviveRounds: [{ surviveRounds: { rounds: 10 } }, { surviveRounds: { rounds: 3, line: 'The tide recedes.' } }],
  leaveCombat: [{ leaveCombat: true }],
  areaMove: [{ areaMove: 'tyr_shear' }],
  recruit: [{ recruit: 'caelum' }],
  dismiss: [{ dismiss: 'dask' }],
  startCombat: [{ startCombat: 'enc_library_wraiths' }],
  startDialogue: [{ startDialogue: 'scene_ilyra_watchword' }],
  endLoop: [{ endLoop: { closer: 'closer_escape' } }, { endLoop: { closer: 'closer_fall', reason: 'released' } }],
  ending: [{ ending: 'ending_mending' }],
  unlockRecipe: [{ unlockRecipe: 'recipe_breach_anchor' }],
  unlockCodex: [{ unlockCodex: 'codex_breach' }],
  counter: [{ counter: { name: 'bells_rung', delta: 1 } }],
  resolve: [{ resolve: -2 }],
};

const INVALID: { [K in EffectKey]: [unknown, string][] } = {
  setFlag: [[{ setFlag: 'heartstone_destroyed' }, 'setFlag: expected an id with prefix flag_']],
  clearFlag: [[{ clearFlag: true }, 'clearFlag: expected an id with prefix flag_']],
  grantEcho: [[{ grantEcho: 'echo_' }, 'grantEcho']],
  questStart: [[{ questStart: { id: 'q_x' } }, 'questStart: expected an id with prefix q_']],
  questAdvance: [[{ questAdvance: { quest: 'q_x' } }, 'questAdvance.stage: Required'], [{ questAdvance: { quest: 'q_x', stage: 'Done' } }, 'questAdvance.stage']],
  questFail: [[{ questFail: 'clear_path' }, 'questFail']],
  giveItem: [[{ giveItem: { item: 'item_x', count: 0 } }, 'giveItem.count'], [{ giveItem: { item: 'item_x', rarity: 'mythic' } }, 'giveItem.rarity'], [{ giveItem: 'item_x' }, 'giveItem: Expected object']],
  takeItem: [[{ takeItem: { id: 'item_x' } }, 'takeItem.item: Required']],
  rep: [[{ rep: { faction: 'weavers', delta: 2.5 } }, 'rep.delta'], [{ rep: { faction: 'weavers' } }, 'rep.delta: Required']],
  loyalty: [[{ loyalty: { companion: 'kaelen', delta: 1 } }, 'loyalty.companion']],
  gold: [[{ gold: '10' }, 'gold: Expected number'], [{ gold: 1.5 }, 'gold']],
  xp: [[{ xp: -5 }, 'xp']],
  resonance: [[{ resonance: 'lots' }, 'resonance']],
  heal: [[{ heal: {} }, '`heal` needs hp and/or mp'], [{ heal: { hp: 'half' } }, 'heal.hp'], [{ heal: { sp: 3 } }, 'Unrecognized key']],
  damage: [[{ damage: { hp: 0 } }, 'damage.hp'], [{ damage: 5 }, 'damage: Expected object']],
  corruption: [[{ corruption: 0.5 }, 'corruption']],
  clockWatches: [[{ clockWatches: { days: -10 } }, 'clockWatches: Expected number']],
  passWatches: [[{ passWatches: 0 }, 'passWatches: `passWatches` must be ≥ 1'], [{ passWatches: -4 }, 'must be ≥ 1']],
  spawn: [[{ spawn: { creature: 'wildling' } }, 'spawn.creature'], [{ spawn: { creature: 'cr_x', location: 'x' } }, 'spawn.location']],
  teleport: [[{ teleport: { to: 'loc_x' } }, 'teleport']],
  unlockExit: [[{ unlockExit: { from: 'loc_a' } }, 'unlockExit.to: Required']],
  scatter: [[{ scatter: 'loc_a' }, 'scatter: Expected object']],
  multiHit: [[{ multiHit: { hits: 0 } }, 'multiHit.hits']],
  stripBuffs: [[{ stripBuffs: { kinds: [] } }, 'stripBuffs.kinds'], [{ stripBuffs: { kinds: ['poison'] } }, 'stripBuffs.kinds.0']],
  healOnDamage: [[{ healOnDamage: { pct: 1.5 } }, 'healOnDamage.pct']],
  surviveRounds: [[{ surviveRounds: { rounds: 0 } }, 'surviveRounds.rounds'], [{ surviveRounds: { rounds: 2, line: '' } }, 'surviveRounds.line']],
  leaveCombat: [[{ leaveCombat: false }, 'leaveCombat']],
  areaMove: [[{ areaMove: 'Shear All' }, 'areaMove'], [{ areaMove: { move: 'tyr_shear' } }, 'areaMove']],
  recruit: [[{ recruit: 'npc_brak' }, 'recruit: Invalid enum value']],
  dismiss: [[{ dismiss: 'kaelen' }, 'dismiss']],
  startCombat: [[{ startCombat: 'Library Wraiths' }, 'startCombat']],
  startDialogue: [[{ startDialogue: 3 }, 'startDialogue']],
  endLoop: [
    [{ endLoop: { closer: 'closer_win' } }, 'endLoop.closer'],
    [{ endLoop: { closer: 'closer_fall', reason: 'bored' } }, 'endLoop.reason'],
    [{ endLoop: { closer: 'closer_escape', reason: 'death' } }, 'only closer_fall carries a reason'],
  ],
  ending: [[{ ending: 'closer_escape' }, 'ending: expected an id with prefix ending_']],
  unlockRecipe: [[{ unlockRecipe: 'breach_anchor' }, 'unlockRecipe']],
  unlockCodex: [[{ unlockCodex: 'codex' }, 'unlockCodex']],
  counter: [[{ counter: { name: 'x' } }, 'counter.delta: Required']],
  resolve: [[{ resolve: { delta: 1 } }, 'resolve: Expected number']],
};

describe('EffectSchema', () => {
  test('the atom set is exactly DESIGN §13.3’s (incl. D-069.9’s six engine kinds and U26b’s areaMove)', () => {
    expect([...EFFECT_KEYS].sort()).toEqual(
      [
        'setFlag', 'clearFlag', 'grantEcho', 'questStart', 'questAdvance', 'questFail', 'giveItem', 'takeItem', 'rep', 'loyalty',
        'gold', 'xp', 'resonance', 'heal', 'damage', 'corruption', 'clockWatches', 'passWatches', 'spawn', 'teleport',
        'unlockExit', 'scatter', 'multiHit', 'stripBuffs', 'healOnDamage', 'surviveRounds', 'leaveCombat', 'areaMove', 'recruit', 'dismiss',
        'startCombat', 'startDialogue', 'endLoop', 'ending', 'unlockRecipe', 'unlockCodex', 'counter', 'resolve',
      ].sort(),
    );
  });

  for (const key of Object.keys(VALID) as EffectKey[]) {
    test(`${key}: valid samples parse unchanged; invalid samples fail with a useful message`, () => {
      for (const sample of VALID[key]) {
        const r = EffectSchema.safeParse(sample);
        if (!r.success) throw new Error(`${JSON.stringify(sample)}: ${r.error.message}`);
        expect(r.data).toEqual(sample);
      }
      for (const [bad, fragment] of INVALID[key]) {
        const found = issues(bad);
        if (!found.some((m) => m.includes(fragment))) throw new Error(`${JSON.stringify(bad)} → ${JSON.stringify(found)} (wanted '${fragment}')`);
      }
    });
  }

  test('shape errors and withdrawn atoms', () => {
    expect(issues({ gold: 1, xp: 1 })[0]).toContain('an effect has exactly one key; got gold, xp (put several in a list)');
    for (const atom of ['questComplete', 'lockExit', 'applyStatus', 'log', 'if', 'random', 'learnAbility', 'achievement']) {
      expect(issues({ [atom]: {} })[0]).toContain(`unknown effect atom '${atom}'`);
    }
  });

  test('combat-scope atoms (D-069.9)', () => {
    expect([...COMBAT_SCOPE_EFFECTS]).toEqual(['multiHit', 'stripBuffs', 'healOnDamage', 'surviveRounds', 'leaveCombat', 'areaMove']);
    expect(isCombatScope('multiHit')).toBe(true);
    expect(isCombatScope('passWatches')).toBe(false);
  });

  test('Effects: a list that defaults to [] and reports the failing index', () => {
    expect(Effects.parse(undefined)).toEqual([]);
    expect(Effects.parse([{ gold: 5 }, { setFlag: 'flag_a' }])).toEqual([{ gold: 5 }, { setFlag: 'flag_a' }]);
    const bad = Effects.safeParse([{ gold: 5 }, { setflag: 'flag_a' }]);
    expect(bad.error!.issues[0]!.path).toEqual([1, 'setflag']);
  });
});
