// U24: the interplay table (DESIGN §4.6; PLAN §8.1 "interplay"): table-driven over all 18 rows — each row's multiplier
// and/or status change, and the `interplay` event it emits — then every other (damage type × status) pair unchanged:
// no step-6 multiplier, no status change, no event (the earlier draft's fire × bleed and physical × shock rules do not
// exist).
import { describe, expect, test } from 'bun:test';
import {
  DAMAGE_TYPES,
  INTERPLAY_MULT,
  INTERPLAY_TABLE,
  STATUS,
  afterHit,
  applyHit,
  applyStatus,
  beginCombat,
  damageRange,
  findStatus,
  hitChanceOf,
  interplayMults,
  resolveHit,
  startOfTurnStatuses,
  type Combatant,
  type DamageType,
  type EncounterSpec,
  type GameEvent,
  type HitResult,
  type HitSpec,
  type StatusInstance,
} from '@engine/index';
import { BRUTE, D, combatPack, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';

const content = combatPack();
const profile = freshProfile();
const TYRANT = 'cr_chronos_tyrant_unveiled';

const inst = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });
const spec = (groups: EncounterSpec['groups']): EncounterSpec => ({ id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] });
const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);

/** The player (Ranger L1, ATK 14, crit 9) against 1–3 enemies, nothing acted yet. */
function setup(groups: EncounterSpec['groups'] = [{ creatureId: BRUTE, count: 2 }], o: StateOverrides = {}) {
  const n = groups.reduce((a, g) => a + g.count, 0);
  const ctx = scriptedCtx(makeState(o, { content }), [D.d4(4), ...Array<number>(n).fill(D.d4(1))], content, profile);
  const combat = beginCombat(ctx, spec(groups));
  return { ctx, combat, me: combat.party[0] as Combatant, a: combat.enemies[0] as Combatant, b: combat.enemies[1] as Combatant | undefined };
}
type Setup = ReturnType<typeof setup>;
const hit = (type: DamageType, over: Partial<HitSpec> = {}): HitSpec => ({ source: 'test', type, base: 20, coef: 0, stat: 'atk', ...over });
const ids = (c: Combatant): string[] => c.statuses.map((st) => st.statusId);
const rules = (x: Setup): string[] => ofType(x.ctx.events, 'interplay').map((e) => e.rule);
/** Lands `sp` on `to` through the reducer's applyHit: variance 1.00, crit or not. */
function land(x: Setup, to: Combatant, sp: HitSpec, crit = false): HitResult {
  x.ctx.rng.queue.push(...(hitChanceOf(content, x.me, to, sp) >= 100 ? [] : [D.pct(0)]), D.variance(1), D.pct(crit ? 0 : 99));
  const r = resolveHit(x.ctx, x.me, to, sp);
  applyHit(x.ctx, x.combat, x.me, to, sp, r, 'ability');
  expect(x.ctx.rng.queue).toEqual([]);
  return r;
}
const step6 = (x: Setup, to: Combatant, sp: HitSpec): number[] => interplayMults({ s: x.ctx.s, content }, x.me, to, sp).map((m) => m.value);

/** One check per DESIGN §4.6 row, keyed by row number. */
const ROWS: Record<number, () => void> = {
  1: () => {
    const x = setup([{ creatureId: BRUTE, count: 3 }]);
    x.a.statuses = [inst(STATUS.soaked, { duration: 3 })];
    expect(step6(x, x.a, hit('storm'))).toEqual([INTERPLAY_MULT.stormOnSoaked]);
    expect(land(x, x.a, hit('storm')).amount).toBe(30);
    expect(x.combat.enemies.map(ids)).toEqual([[STATUS.soaked], [STATUS.shock], [STATUS.shock]]);
    expect(findStatus(x.b!, STATUS.shock)).toMatchObject({ duration: 2, sourceUid: x.me.uid });
    expect(rules(x)).toEqual(['storm_on_soaked']);
  },
  2: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.soaked, { duration: 3 })];
    expect(step6(x, x.a, hit('fire'))).toEqual([INTERPLAY_MULT.fireOnSoaked]);
    expect(land(x, x.a, hit('fire')).amount).toBe(10);
    expect(ids(x.a)).toEqual([]);
    expect(rules(x)).toEqual(['fire_on_soaked']);
  },
  3: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.haste)];
    expect(land(x, x.a, hit('chrono')).amount).toBe(20);
    expect(ids(x.a)).toEqual([]);
    expect(rules(x)).toEqual(['chrono_on_haste']);
  },
  4: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.shield, { tick: 50, duration: 3 })];
    expect(land(x, x.a, hit('void'))).toMatchObject({ amount: 20, absorbed: 0, shieldBroken: true });
    expect(ids(x.a)).toEqual([]);
    expect(x.a.hp).toBe(44);
    expect(rules(x)).toEqual(['void_on_shield']);
    expect(ofType(x.ctx.events, 'statusExpired').map((e) => e.statusId)).toEqual([STATUS.shield]);
  },
  5: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.burn, { tick: 4, duration: 3 })];
    expect(applyStatus(x.ctx, x.combat, x.me, x.a, STATUS.soaked).outcome).toBe('applied');
    expect(ids(x.a)).toEqual([STATUS.soaked]);
    expect(applyStatus(x.ctx, x.combat, x.me, x.a, STATUS.burn).outcome).toBe('blocked');
    expect(ids(x.a)).toEqual([STATUS.soaked]);
    expect(rules(x)).toEqual(['soaked_on_burn', 'soaked_on_burn']);
  },
  6: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.haste)];
    expect(applyStatus(x.ctx, x.combat, x.me, x.a, STATUS.slow).outcome).toBe('cancelled');
    expect(ids(x.a)).toEqual([]);
    x.b!.statuses = [inst(STATUS.slow)];
    expect(applyStatus(x.ctx, x.combat, x.b!, x.b!, STATUS.haste).outcome).toBe('cancelled');
    expect(ids(x.b!)).toEqual([]);
    expect(rules(x)).toEqual(['slow_haste_cancel', 'slow_haste_cancel']);
  },
  7: () => {
    const x = setup();
    x.a.hp = 40;
    x.a.statuses = [inst(STATUS.regen, { tick: 5, duration: 3 }), inst(STATUS.bleed, { tick: 2, stacks: 2, duration: 3 })];
    startOfTurnStatuses(x.ctx, x.combat, x.a);
    expect(x.a.hp).toBe(40 - 4 + 5);
    expect(findStatus(x.a, STATUS.bleed)?.stacks).toBe(1);
    startOfTurnStatuses(x.ctx, x.combat, x.a);
    expect(ids(x.a)).toEqual([STATUS.regen]);
    expect(rules(x)).toEqual(['regen_on_bleed', 'regen_on_bleed']);
  },
  8: () => {
    const x = setup();
    x.a.hp = 40;
    x.a.statuses = [inst(STATUS.regen, { tick: 9, duration: 3 }), inst(STATUS.poison, { tick: 2, duration: 4 })];
    expect(startOfTurnStatuses(x.ctx, x.combat, x.a).ticks).toEqual([{ statusId: STATUS.poison, amount: 2 }, { statusId: STATUS.regen, amount: 5 }]); // 4.5 → 5
    expect(rules(x)).toEqual(['poison_on_regen']);
  },
  9: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.rewind, { snapshotHp: 64 })];
    x.b!.statuses = [inst(STATUS.rewind, { snapshotHp: 64 })];
    expect(step6(x, x.a, hit('void'))).toEqual([INTERPLAY_MULT.voidOnRewind]);
    expect(step6(x, x.a, hit('ley'))).toEqual([]);
    expect(land(x, x.a, hit('void')).amount).toBe(25);
    expect(land(x, x.b!, hit('ley')).amount).toBe(20);
    expect([ids(x.a), ids(x.b!)]).toEqual([[], []]);
    expect(rules(x)).toEqual(['rewind_consumed', 'rewind_consumed']);
  },
  10: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.phase, { duration: 1 })];
    expect(hitChanceOf(content, x.me, x.a, hit('physical'))).toBe(0);
    expect(land(x, x.a, hit('chrono')).hit).toBe(true);
    expect(ids(x.a)).toEqual([STATUS.phase]);
    expect(rules(x)).toEqual(['chrono_ignores_phase']);
  },
  11: () => {
    const x = setup([{ creatureId: BRUTE, count: 1 }], { classId: 'ironclad_warden' });
    applyStatus(x.ctx, x.combat, x.me, x.a, STATUS.taunt);
    expect(findStatus(x.a, STATUS.taunt)?.sourceUid).toBe(x.me.uid);
    applyStatus(x.ctx, x.combat, x.a, x.me, STATUS.stun, { duration: 1 });
    expect(ids(x.a)).toEqual([]);
    expect(rules(x)).toEqual(['stun_ends_taunt']);
  },
  12: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.shock)];
    x.b!.statuses = [inst(STATUS.shock)];
    land(x, x.a, hit('storm'), true);
    land(x, x.b!, hit('storm'), false);
    expect([ids(x.a), ids(x.b!)]).toEqual([[STATUS.shock, STATUS.stun], [STATUS.shock]]);
    expect(findStatus(x.a, STATUS.stun)?.duration).toBe(1);
    expect(rules(x)).toEqual(['storm_crit_on_shock']);
    const boss = setup([{ creatureId: TYRANT, count: 1 }], { loop: 2 }); // stun-immune
    boss.a.statuses = [inst(STATUS.shock)];
    land(boss, boss.a, hit('storm'), true);
    expect(ids(boss.a)).toEqual([STATUS.shock]);
    expect(rules(boss)).toEqual([]);
  },
  13: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.curse, { tick: 3, duration: 3 })];
    expect(step6(x, x.a, hit('ley'))).toEqual([INTERPLAY_MULT.leyOnCurse]);
    expect(land(x, x.a, hit('ley')).amount).toBe(25);
    expect(ids(x.a)).toEqual([]);
    expect(rules(x)).toEqual(['ley_on_curse']);
  },
  14: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.regen, { tick: 5, duration: 3 })];
    land(x, x.a, hit('void'));
    expect(ids(x.a)).toEqual([]);
    expect(rules(x)).toEqual(['void_on_regen']);
  },
  15: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.bleed, { tick: 2, stacks: 2, duration: 2 })];
    const light = hit('physical', { base: 5 }); // 2, crit 5: the Brute lives through three
    land(x, x.a, light);
    expect(findStatus(x.a, STATUS.bleed)?.stacks).toBe(2); // no crit: nothing
    land(x, x.a, light, true);
    expect(findStatus(x.a, STATUS.bleed)).toMatchObject({ stacks: 3, duration: 2 });
    land(x, x.a, light, true);
    expect(findStatus(x.a, STATUS.bleed)?.stacks).toBe(3); // max 3
    expect(rules(x)).toEqual(['physical_crit_on_bleed']);
  },
  16: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.burn, { tick: 5, duration: 2 })];
    x.b!.statuses = [inst(STATUS.burn, { tick: 5, duration: 2 })];
    land(x, x.b!, hit('fire', { source: 'wiz_fireball' }));
    expect(ids(x.b!)).toEqual([STATUS.burn]); // only Immolate consumes it
    land(x, x.a, hit('fire', { source: 'wiz_immolate' }));
    expect(ids(x.a)).toEqual([]);
    expect(x.a.hp).toBe(64 - 20 - 30); // the hit, then 3 × 5 × 2 turns left
    expect(ofType(x.ctx.events, 'damageDealt').at(-1)).toMatchObject({ amount: 30, damageType: 'fire', kind: 'status', refId: STATUS.burn });
    expect(x.ctx.s.counters.damageBySource).toMatchObject({ 'status:status_burn': 30 });
    expect(rules(x)).toEqual(['immolate_on_burn']);
  },
  17: () => {
    const x = setup();
    const r = { s: x.ctx.s, content };
    expect(damageRange(r, x.me, x.a, hit('physical'))).toEqual([15, 19]); // − armor 3
    x.a.statuses = [inst(STATUS.armorBreak, { duration: 3 })];
    expect(damageRange(r, x.me, x.a, hit('physical'))).toEqual([21, 25]); // × 1.15, armor ignored
    expect(damageRange(r, x.me, x.a, hit('fire'))).toEqual([18, 22]); // no +15 % for other types (ward 0 anyway)
    expect(rules(x)).toEqual([]);
  },
  18: () => {
    const x = setup();
    x.a.statuses = [inst(STATUS.mark, { duration: 3 })];
    expect(hitChanceOf(content, x.me, x.a, hit('fire'))).toBe(100);
    expect(land(x, x.a, hit('fire')).amount).toBe(23); // no hit roll; × 1.15
    expect(rules(x)).toEqual([]);
  },
};

describe('DESIGN §4.6 — the interplay table, row by row', () => {
  test('18 rows, numbered 1–18, one unique rule id each; every row has a check below', () => {
    expect(INTERPLAY_TABLE.map((r) => r.row)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(new Set(INTERPLAY_TABLE.map((r) => r.rule)).size).toBe(18);
    expect(Object.keys(ROWS).map(Number)).toEqual(INTERPLAY_TABLE.map((r) => r.row));
  });
  for (const row of INTERPLAY_TABLE) test(`row ${row.row} (${row.rule}): ${row.trigger} → ${row.result}`, () => ROWS[row.row]!());
});

// ---- everything else is unchanged ------------------------------------------------------------------------------------------

/** The (type, status) pairs a landed, non-crit, non-Immolate hit reacts to (rows 1–4, 9, 10, 13, 14). */
const REACTS = new Set(['storm:status_soaked', 'fire:status_soaked', 'chrono:status_haste', 'void:status_shield', 'void:status_rewind', 'ley:status_rewind', 'ley:status_curse', 'void:status_regen', 'chrono:status_phase']);
/** The pairs with a step-6 multiplier (rows 1, 2, 9, 13). */
const MULTIPLIES = new Set(['storm:status_soaked', 'fire:status_soaked', 'void:status_rewind', 'ley:status_curse']);
const COMBAT_STATUSES = Object.values(STATUS).filter((id) => id !== STATUS.rested);

describe('non-matching pairs are unchanged', () => {
  test('every damage type × every combat status outside the table: no multiplier, no status change, no event', () => {
    expect(COMBAT_STATUSES).toHaveLength(18);
    let checked = 0;
    for (const type of DAMAGE_TYPES) {
      for (const statusId of COMBAT_STATUSES) {
        const pair = `${type}:${statusId}`;
        const x = setup([{ creatureId: BRUTE, count: 2 }]);
        x.a.statuses = [inst(statusId, { tick: 5, stacks: 2, duration: 2, snapshotHp: 64 })];
        const before = JSON.stringify([x.a.statuses, x.b!.statuses, x.me.statuses]);
        expect(step6(x, x.a, hit(type)).length > 0).toBe(MULTIPLIES.has(pair));
        if (REACTS.has(pair)) continue;
        // a landed hit that did nothing to the pool (the pipeline's own Shield absorption is step 10, not interplay)
        const result: HitResult = { hit: true, phased: false, crit: false, immune: false, hitChance: 100, critChance: 0, variance: 1, amount: 10, absorbed: 0, shieldBroken: false, mitigated: 0, steps: [] };
        afterHit(x.ctx, x.combat, x.me, x.a, hit(type), result);
        expect(JSON.stringify([x.a.statuses, x.b!.statuses, x.me.statuses])).toBe(before);
        expect(rules(x)).toEqual([]);
        checked += 1;
      }
    }
    expect(checked).toBe(DAMAGE_TYPES.length * 18 - REACTS.size);
  });

  test('the earlier draft\'s rules do not exist: Fire on Bleeding, Physical on Shocked (crits included)', () => {
    for (const [type, statusId] of [['fire', STATUS.bleed], ['physical', STATUS.shock]] as const) {
      const x = setup();
      x.a.statuses = [inst(statusId, { tick: 3, duration: 3 })];
      const plain = setup();
      expect(land(x, x.a, hit(type), true).amount).toBe(land(plain, plain.a, hit(type), true).amount);
      expect(ids(x.a)).toEqual([statusId]);
      expect(rules(x)).toEqual([]);
    }
  });

  test('an immune hit triggers nothing; ticks trigger nothing (a Curse tick does not consume a Rewind)', () => {
    const x = setup();
    x.a.resistances = { void: 'immune' };
    x.a.statuses = [inst(STATUS.regen, { tick: 1 }), inst(STATUS.rewind, { snapshotHp: 64, duration: 2 }), inst(STATUS.curse, { tick: 2, duration: 3 })];
    expect(land(x, x.a, hit('void'))).toMatchObject({ immune: true, amount: 0 });
    startOfTurnStatuses(x.ctx, x.combat, x.a);
    expect(ids(x.a)).toEqual([STATUS.regen, STATUS.rewind, STATUS.curse]);
    expect(rules(x)).toEqual([]);
  });
});
