// U34e item 1 — the Heartstone's world effects (D-105, D-017, DESIGN §11.2, WORLD §12.1): the choice sets `world.heartstone`
// (the `heartstone` effect); Destroy's Ley abilities cost +25 % MP and every Breach-born creature (and the ley-made Aetherial
// Weaver, WORLD §2.4) fights at −25 % HP; Exploit's Hollow fields its Void-Touched Stalkers one level up (WORLD §3.3, D-098),
// with HP, ATK/SP and kill XP by DESIGN §6.5/§6.2's per-level rules. Played on the real pack with deterministic draws.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import {
  DESTROYED_HEARTSTONE_HP_MULT,
  beginCombat,
  enemyKillXp,
  playerAbilityCost,
  type Action,
  type EncounterSpec,
  type GameState,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';

const pack = buildContentPack();
const profile = freshProfile();
const at = (overrides: Parameters<typeof makeState>[0]): GameState => makeState(overrides, { content: pack, profile });
const run = (s: GameState, actions: Action[]) => play(s, actions, { content: pack, profile });
const pick = (choiceId: string): Action => ({ type: 'choose', choiceId });
const go: Action = { type: 'continue' };

/** The Depths' choice, taken: the scene opens on arrival with the quest at `descend` (U52's real-pack path). */
function choose(choiceId: 'stabilize' | 'exploit' | 'destroy', classId = 'wizard'): ReturnType<typeof run> {
  const s = at({ classId, locationId: 'loc_sunken_archives', quests: { q_echoing_heartbeat: 'descend' } });
  const entered = run(s, [{ type: 'move', to: 'loc_heartstone_depths' }]);
  expect(entered.state.dialogue?.sceneId).toBe('scene_heartstone_choice');
  return run(entered.state, [pick(choiceId), go, go]);
}

const spec = (creatureId: string, count = 1): EncounterSpec => ({
  id: 'enc_u34e_test', groups: [{ creatureId, count }], fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [],
});
/** A fight against `creatureId` started directly where the state stands (initiative d4s scripted). */
function fight(s: GameState, creatureId: string, count = 1) {
  const ctx = scriptedCtx(s, Array.from({ length: 8 }, () => D.d4(2)), pack, profile);
  return beginCombat(ctx, spec(creatureId, count));
}

describe('the choice sets world.heartstone (D-105)', () => {
  test('each of the three choices resolves the state once, with `heartstoneResolved`; Wait leaves it intact', () => {
    for (const [choiceId, state] of [['stabilize', 'stabilized'], ['exploit', 'exploited'], ['destroy', 'destroyed']] as const) {
      const out = choose(choiceId);
      expect([choiceId, out.state.world.heartstone]).toEqual([choiceId, state]);
      expect(out.events.filter((e) => e.t === 'heartstoneResolved')).toEqual([{ t: 'heartstoneResolved', outcome: state }]);
    }
    const s = at({ locationId: 'loc_sunken_archives', quests: { q_echoing_heartbeat: 'descend' } });
    const waited = run(run(s, [{ type: 'move', to: 'loc_heartstone_depths' }]).state, [pick('wait'), go]);
    expect(waited.state.world.heartstone).toBe('intact');
  });

  test('the run record keeps the choice (reducers/loop.ts `heartstone`)', () => {
    expect(choose('exploit').state.world.heartstone).toBe('exploited');
  });
});

describe('Destroy: Ley abilities +25 % MP, Breach-born −25 % HP (DESIGN §11.2, D-017)', () => {
  test('an Elf’s Thornlash (Ley) costs ⌊mp × 1.25⌋ after Destroy and its own after Stabilize; a non-Ley ability is untouched', () => {
    const destroyed = choose('destroy', 'elf').state;
    const stabilized = choose('stabilize', 'elf').state;
    const thornlash = pack.abilities['elf_thornlash']!;
    expect(thornlash.mp).toBeGreaterThan(3);
    expect(playerAbilityCost(destroyed, pack, 'elf_thornlash').mp).toBe(Math.floor(thornlash.mp * 1.25));
    expect(playerAbilityCost(stabilized, pack, 'elf_thornlash').mp).toBe(thornlash.mp);
    const other = Object.values(pack.abilities).find((a) => a.id.startsWith('elf_') && a.damageType !== undefined && a.damageType !== 'ley' && a.mp > 3);
    expect(other).toBeDefined();
    expect(playerAbilityCost(destroyed, pack, other!.id).mp).toBe(other!.mp);
  });

  test('a Corrupted Shade (breach_born) has 27 of 36 HP, the Aetherial Weaver (ley_made) 72 of 96; a Wildling Brute is untouched', () => {
    const destroyed = choose('destroy').state;
    const shade = fight(destroyed, 'cr_corrupted_shade').enemies[0]!;
    expect([shade.hp, shade.hpMax]).toEqual([27, 27]);
    expect(Math.round(36 * DESTROYED_HEARTSTONE_HP_MULT)).toBe(27);
    expect(fight(destroyed, 'cr_aetherial_weaver').enemies[0]!.hpMax).toBe(72);
    expect(fight(destroyed, 'cr_wildling_brute').enemies[0]!.hpMax).toBe(64);
    // the Contained Tyrant is Breach-born too ("So is the thing holding the door.")
    expect(fight(destroyed, 'cr_chronos_tyrant_contained').enemies[0]!.hpMax).toBe(345);
    // intact and stabilized: full HP
    expect(fight(at({}), 'cr_corrupted_shade').enemies[0]!.hpMax).toBe(36);
    expect(fight(choose('stabilize').state, 'cr_corrupted_shade').enemies[0]!.hpMax).toBe(36);
  });
});

describe('Exploit: the Hollow’s Void-touched +1 level variants (WORLD §3.3, §12.1; D-098)', () => {
  const hollow = (heartstone: 'exploit' | 'stabilize'): GameState => {
    const s = clone(choose(heartstone).state);
    s.world.currentLocationId = 'loc_voidscar_hollow';
    return s;
  };

  test('exploited: a Stalker at the Hollow fights at level 7 — HP 76 → 85, ATK 14 → 15.5, kill XP 111 → 135; elsewhere it is level 6', () => {
    const combat = fight(hollow('exploit'), 'cr_void_touched_stalker', 2);
    for (const e of combat.enemies) {
      expect([e.level, e.hpMax, e.atk, e.sp]).toEqual([7, 85, 15.5, 15.5]);
    }
    const s = hollow('exploit');
    expect(enemyKillXp(s, pack, combat.enemies[0]!)).toBe(135);
    const chasm = clone(s);
    chasm.world.currentLocationId = 'loc_chasm_of_whispers';
    const plain = fight(chasm, 'cr_void_touched_stalker').enemies[0]!;
    expect([plain.level, plain.hpMax, plain.atk]).toEqual([6, 76, 14]);
    expect(enemyKillXp(s, pack, plain)).toBe(111);
  });

  test('not exploited: the Hollow’s Stalkers are their own level; the Veil Sentry beside them never changes', () => {
    const plain = fight(hollow('stabilize'), 'cr_void_touched_stalker').enemies[0]!;
    expect([plain.level, plain.hpMax]).toEqual([6, 76]);
    const sentry = pack.creatures['cr_veil_sentry']!;
    const withSentry = fight(hollow('exploit'), 'cr_veil_sentry').enemies[0]!;
    expect([withSentry.level, withSentry.hpMax]).toEqual([sentry.level, sentry.stats.hp]);
  });

  test('the Hollow’s record carries the variant (content, D-105)', () => {
    expect(pack.locations['loc_voidscar_hollow']?.levelBonus).toEqual([{ when: { flag: 'flag_heartstone_exploited' }, creatures: ['cr_void_touched_stalker'], levels: 1 }]);
  });
});
