// U23: the damage pipeline (DESIGN §4.3–4.4; PLAN §4.10, §8.1 "damage pipeline"). Every step in order, the roll
// order, variance bounds, crit, resistance (immune → 0), status and run modifiers, flat armor/ward, Guard, Shield,
// min 1 / max HP; DoT ticks (resistance only) and heals. The §4.12 worked example is in reducers/combat.test.ts.
import { describe, expect, test } from 'bun:test';
import {
  ARMOR_BREAK_PHYSICAL_MULT,
  RESIST_MULT,
  Rng,
  VARIANCE_MAX,
  VARIANCE_MIN,
  consumeShield,
  critChanceOf,
  damageRange,
  drawVariance,
  guardValueOf,
  hasStatus,
  hitChanceOf,
  interplayMults,
  resolveHeal,
  resolveHit,
  resolveTick,
  rollPct,
  scaledPower,
  statusMods,
  type Combatant,
  type GameState,
  type HitSpec,
  type PipelineCtx,
  type StatusInstance,
} from '@engine/index';
import { makeState } from '@tests/fixtures/helpers';
import { D, ScriptedRng, combatPack } from '@tests/fixtures/combatContent';

const content = combatPack();

function combatant(over: Partial<Combatant> = {}): Combatant {
  return {
    uid: 'c1',
    kind: 'enemy',
    refId: 'cr_corrupted_shade',
    name: 'Target',
    level: 1,
    hp: 100,
    hpMax: 100,
    mp: 0,
    mpMax: 0,
    atk: 10,
    sp: 10,
    armor: 0,
    ward: 0,
    agi: 0,
    accuracy: 85,
    evasion: 0,
    crit: 5,
    critMult: 1.5,
    statuses: [],
    guarding: false,
    initiative: 0,
    resistances: {},
    phase: 0,
    pattern: { pointer: 0, turnsTaken: 0, firedOnce: [], phaseEnteredRound: 1 },
    cooldowns: {},
    alive: true,
    fledOrGone: false,
    isAdd: false,
    ...over,
  };
}
const attacker = (over: Partial<Combatant> = {}) => combatant({ uid: 'c0', kind: 'player', refId: 'ranger', name: 'You', ...over });
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });
const physical = (over: Partial<HitSpec> = {}): HitSpec => ({ source: 'basic', type: 'physical', base: 0, coef: 1, stat: 'atk', ...over });

function pctx(draws: readonly number[], s: GameState = makeState()): PipelineCtx & { rng: ScriptedRng } {
  return { s, content, rng: new ScriptedRng(draws) };
}
/** A hit that lands with variance 1.00 and no crit (roll 99). */
const plain = [D.pct(0), D.variance(1), D.pct(99)];
const stepNames = (r: { steps: { name: string }[] }) => r.steps.map((x) => x.name);
const stepValue = (r: { steps: { name: string; value: number }[] }, name: string) => r.steps.find((x) => x.name === name)?.value;

describe('resolveHit: the eleven steps in order (DESIGN §4.3)', () => {
  test('records every step, in order, and draws hit → variance → crit', () => {
    const ctx = pctx(plain);
    const r = resolveHit(ctx, attacker(), combatant({ armor: 2 }), physical());
    expect(stepNames(r)).toEqual(['hit%', 'base', 'scaled', 'variance', 'crit', 'resistance', 'interplay', 'status', 'flat', 'guard', 'shield', 'final']);
    expect(r).toMatchObject({ hit: true, crit: false, immune: false, amount: 8, absorbed: 0, mitigated: 2, variance: 1 });
    expect(ctx.rng.queue).toEqual([]);
  });

  test('1–2: base + coef · ATK or SP; maxOf takes the larger scaling (itm_echo_bolt)', () => {
    const a = attacker({ atk: 18, sp: 6 });
    expect(scaledPower(a, { base: 0, coef: 1.1, stat: 'atk' })).toBeCloseTo(19.8);
    expect(scaledPower(a, { base: 4, coef: 0.8, stat: 'sp' })).toBeCloseTo(8.8);
    expect(scaledPower(a, { base: 0, coef: 0.75, stat: 'atk', maxOf: { base: 4, coef: 0.8, stat: 'sp' } })).toBeCloseTo(13.5);
    expect(scaledPower(attacker({ atk: 2, sp: 20 }), { base: 0, coef: 0.75, stat: 'atk', maxOf: { base: 4, coef: 0.8, stat: 'sp' } })).toBeCloseTo(20);
    const r = resolveHit(pctx(plain), a, combatant(), { source: 'wiz', type: 'ley', base: 3, coef: 1.2, stat: 'sp' });
    expect(stepValue(r, 'base')).toBe(3);
    expect(stepValue(r, 'scaled')).toBeCloseTo(10.2);
  });

  test('3: variance is one draw mapped onto [0.90, 1.10); DoTs and projections draw nothing', () => {
    expect(drawVariance(new ScriptedRng([0]))).toBe(VARIANCE_MIN);
    expect(drawVariance(new ScriptedRng([0.5]))).toBeCloseTo(1);
    expect(drawVariance(new ScriptedRng([0.999999]))).toBeLessThan(VARIANCE_MAX);
    const r = resolveHit(pctx([D.pct(0), D.variance(1.07), D.pct(99)]), attacker({ atk: 11 }), combatant(), physical());
    expect(stepValue(r, 'variance')).toBeCloseTo(11.77);
    expect(r.variance).toBeCloseTo(1.07);
  });

  test('variance bounds hold over 2,000 real draws: every amount lies in damageRange', () => {
    const rng = Rng.fromSeed('variance-bounds');
    const a = attacker({ atk: 40, crit: 0 });
    const t = combatant({ armor: 3, hpMax: 1000, hp: 1000 });
    const ctx = { s: makeState(), content, rng };
    const [lo, hi] = damageRange(ctx, a, t, physical({ cannotMiss: true }));
    expect([lo, hi]).toEqual([33, 41]);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const r = resolveHit(ctx, a, t, physical({ cannotMiss: true }));
      expect(r.variance).toBeGreaterThanOrEqual(VARIANCE_MIN);
      expect(r.variance).toBeLessThan(VARIANCE_MAX);
      expect(r.amount).toBeGreaterThanOrEqual(lo);
      expect(r.amount).toBeLessThanOrEqual(hi);
      seen.add(r.amount);
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  test('4: crit when the roll is under crit% (× crit_mult); a guaranteed crit draws nothing; crit% caps at 60', () => {
    const a = attacker({ atk: 18, crit: 9 });
    const crit = resolveHit(pctx([D.pct(0), D.variance(1), D.pct(8)]), a, combatant(), physical());
    expect(crit.crit).toBe(true);
    expect(stepValue(crit, 'crit')).toBeCloseTo(27);
    expect(resolveHit(pctx([D.pct(0), D.variance(1), D.pct(9)]), a, combatant(), physical()).crit).toBe(false);
    const sure = pctx([D.pct(0), D.variance(1)]);
    expect(resolveHit(sure, a, combatant(), physical({ guaranteedCrit: true })).crit).toBe(true);
    expect(sure.rng.queue).toEqual([]);
    expect(critChanceOf(content, attacker({ crit: 50 }), physical({ critBonus: 20 }))).toBe(60);
    expect(critChanceOf(content, attacker({ crit: 50, statuses: [status('status_blind')] }), physical())).toBe(50);
    expect(critChanceOf(content, attacker({ crit: 0 }), physical())).toBe(0);
    const never = pctx([D.pct(0), D.variance(1)]);
    expect(resolveHit(never, attacker({ crit: 0 }), combatant(), physical()).crit).toBe(false);
    expect(never.rng.queue).toEqual([]);
  });

  test('5: weak ×1.5, neutral ×1, resist ×0.5; immune short-circuits to 0 (no minimum) but keeps the draws', () => {
    expect(RESIST_MULT).toEqual({ weak: 1.5, neutral: 1, resist: 0.5, immune: 0 });
    const a = attacker({ sp: 10 });
    const fire = { source: 'x', type: 'fire', base: 0, coef: 1, stat: 'sp' } as const;
    expect(resolveHit(pctx(plain), a, combatant({ resistances: { fire: 'weak' } }), fire).amount).toBe(15);
    expect(resolveHit(pctx(plain), a, combatant({ resistances: { fire: 'resist' } }), fire).amount).toBe(5);
    const ctx = pctx(plain);
    const immune = resolveHit(ctx, a, combatant({ resistances: { fire: 'immune' } }), fire);
    expect(immune).toMatchObject({ hit: true, immune: true, amount: 0, absorbed: 0 });
    expect(stepNames(immune).at(-1)).toBe('final');
    expect(ctx.rng.queue).toEqual([]);
  });

  test('6: interplay is U24\'s table; until then no multiplier and the value passes through', () => {
    expect(interplayMults({ s: makeState(), content }, attacker(), combatant(), physical())).toEqual([]);
    const r = resolveHit(pctx(plain), attacker(), combatant(), physical());
    expect(stepValue(r, 'interplay')).toBe(stepValue(r, 'resistance'));
  });

  test('7: attacker Weaken ×0.75, target Mark ×1.15, Armor Break vs Physical ×1.15; multiplicative', () => {
    const a = attacker({ atk: 20 });
    const weak = resolveHit(pctx(plain), attacker({ atk: 20, statuses: [status('status_weaken')] }), combatant(), physical());
    expect(stepValue(weak, 'status')).toBeCloseTo(15);
    const marked = resolveHit(pctx([D.variance(1), D.pct(99)]), a, combatant({ statuses: [status('status_mark')] }), physical());
    expect(stepValue(marked, 'status')).toBeCloseTo(23);
    const broken = resolveHit(pctx(plain), a, combatant({ armor: 5, statuses: [status('status_armor_break')] }), physical());
    expect(stepValue(broken, 'status')).toBeCloseTo(20 * ARMOR_BREAK_PHYSICAL_MULT);
    expect(broken.amount).toBe(23); // armor ignored
    const both = resolveHit(pctx([D.variance(1), D.pct(99)]), attacker({ atk: 20, statuses: [status('status_weaken')] }), combatant({ statuses: [status('status_mark')] }), physical());
    expect(stepValue(both, 'status')).toBeCloseTo(20 * 0.75 * 1.15);
    const bonus = resolveHit(pctx(plain), a, combatant(), physical({ mults: [{ name: 'vs Marked', mult: 1.25 }] }));
    expect(stepValue(bonus, 'status')).toBeCloseTo(25);
  });

  test('7: Armor Break zeroes ward too but adds +15 % only to Physical', () => {
    const r = resolveHit(pctx(plain), attacker({ sp: 20 }), combatant({ ward: 5, statuses: [status('status_armor_break')] }), { source: 'x', type: 'fire', base: 0, coef: 1, stat: 'sp' });
    expect(stepValue(r, 'status')).toBeCloseTo(20);
    expect(r.amount).toBe(20);
  });

  test('7: the player\'s gear and Corruption percentages (DESIGN §6.7: Void +5 %, Ley −3 % per point)', () => {
    const s = makeState({ corruption: 2 });
    const voidHit = resolveHit(pctx(plain, s), attacker({ sp: 20 }), combatant(), { source: 'x', type: 'void', base: 0, coef: 1, stat: 'sp' });
    expect(stepValue(voidHit, 'status')).toBeCloseTo(22);
    const ley = resolveHit(pctx(plain, s), attacker({ sp: 20 }), combatant(), { source: 'x', type: 'ley', base: 0, coef: 1, stat: 'sp' });
    expect(stepValue(ley, 'status')).toBeCloseTo(18.8);
    // an enemy attacker is not the player: no gear percentages
    const enemy = resolveHit(pctx(plain, s), combatant({ sp: 20 }), attacker(), { source: 'x', type: 'void', base: 0, coef: 1, stat: 'sp' });
    expect(stepValue(enemy, 'status')).toBeCloseTo(20);
  });

  test('7: Glass doubles party damage both ways (outgoing and incoming), never enemy on enemy', () => {
    const s = makeState({ patch: (st) => void (st.meta.modifiers = ['mod_glass']) });
    expect(resolveHit(pctx(plain, s), attacker({ atk: 10 }), combatant(), physical()).amount).toBe(20);
    expect(resolveHit(pctx(plain, s), combatant({ atk: 10 }), attacker(), physical()).amount).toBe(20);
    expect(resolveHit(pctx(plain, s), combatant({ atk: 10 }), combatant({ uid: 'c2' }), physical()).amount).toBe(10);
  });

  test('8: Physical − armor, every other type − ward; negative ward adds; ignores_armor skips', () => {
    const a = attacker({ atk: 10, sp: 10 });
    expect(resolveHit(pctx(plain), a, combatant({ armor: 3, ward: 1 }), physical()).amount).toBe(7);
    expect(resolveHit(pctx(plain), a, combatant({ armor: 3, ward: 1 }), { source: 'x', type: 'storm', base: 0, coef: 1, stat: 'sp' }).amount).toBe(9);
    expect(resolveHit(pctx(plain), a, combatant({ ward: -2 }), { source: 'x', type: 'chrono', base: 0, coef: 1, stat: 'sp' }).amount).toBe(12);
    expect(resolveHit(pctx(plain), a, combatant({ armor: 3 }), physical({ ignoresArmor: true })).amount).toBe(10);
  });

  test('9: Guard × (1 − 0.5), after flat reduction; the player\'s Guard value comes from derive()', () => {
    const r = resolveHit(pctx(plain), combatant({ atk: 17.6 }), attacker({ armor: 2, guarding: true }), physical());
    expect(stepValue(r, 'flat')).toBeCloseTo(15.6);
    expect(stepValue(r, 'guard')).toBeCloseTo(7.8);
    expect(r.amount).toBe(8);
    expect(r.mitigated).toBe(10);
    expect(guardValueOf({ s: makeState(), content }, attacker())).toBe(0.5);
    expect(guardValueOf({ s: makeState(), content }, combatant())).toBe(content.config.guardValue);
  });

  test('10: the Shield pool absorbs first; Void destroys it without absorbing', () => {
    const shielded = (pool: number) => combatant({ statuses: [status('status_shield', { tick: pool })] });
    const partial = resolveHit(pctx(plain), attacker({ atk: 10 }), shielded(4), physical());
    expect(partial).toMatchObject({ amount: 6, absorbed: 4, shieldBroken: false });
    const full = resolveHit(pctx(plain), attacker({ atk: 10 }), shielded(30), physical());
    expect(full).toMatchObject({ amount: 0, absorbed: 10 });
    const sliver = resolveHit(pctx(plain), attacker({ atk: 10.4 }), shielded(10), physical());
    expect(sliver).toMatchObject({ amount: 1, absorbed: 10 }); // the 0.4 left over still connects: minimum 1
    const voidHit = resolveHit(pctx(plain), attacker({ sp: 10 }), shielded(30), { source: 'x', type: 'void', base: 0, coef: 1, stat: 'sp' });
    expect(voidHit).toMatchObject({ amount: 10, absorbed: 0, shieldBroken: true });

    const t = shielded(30);
    consumeShield(t, full);
    expect(t.statuses[0]?.tick).toBe(20);
    consumeShield(t, { absorbed: 20, shieldBroken: false });
    expect(t.statuses).toEqual([]);
    const broken = shielded(30);
    consumeShield(broken, voidHit);
    expect(broken.statuses).toEqual([]);
    consumeShield(broken, voidHit); // no Shield: nothing to do
    expect(broken.statuses).toEqual([]);
  });

  test('11: round half-up, minimum 1 for a connecting non-immune hit, maximum the target\'s max HP', () => {
    expect(resolveHit(pctx(plain), attacker({ atk: 10.5 }), combatant(), physical()).amount).toBe(11);
    expect(resolveHit(pctx(plain), attacker({ atk: 10.49 }), combatant(), physical()).amount).toBe(10);
    // binary fractions: 7 × 0.9 − 2 = 4.3 and 6.3 × 0.9 − 1 = 4.67 round as printed in DESIGN §4.12
    expect(resolveHit(pctx([D.pct(0), D.variance(0.9), D.pct(99)]), combatant({ atk: 7 }), attacker({ armor: 2 }), physical()).amount).toBe(4);
    expect(resolveHit(pctx(plain), attacker({ atk: 2 }), combatant({ armor: 10 }), physical()).amount).toBe(1);
    expect(resolveHit(pctx(plain), attacker({ atk: 500 }), combatant({ hpMax: 40, hp: 12 }), physical()).amount).toBe(40);
  });
});

describe('the hit roll (DESIGN §3.2)', () => {
  test('hit% = clamp(accuracy − evasion, 50, 100) with live status modifiers; spell +10; weapon accuracy', () => {
    expect(hitChanceOf(content, attacker({ accuracy: 89 }), combatant({ evasion: 2 }), physical())).toBe(87);
    expect(hitChanceOf(content, attacker({ accuracy: 10 }), combatant({ evasion: 90 }), physical())).toBe(50);
    expect(hitChanceOf(content, attacker({ accuracy: 120 }), combatant(), physical())).toBe(100);
    expect(hitChanceOf(content, attacker({ accuracy: 87 }), combatant({ evasion: 4 }), physical({ spell: true }))).toBe(93);
    expect(hitChanceOf(content, attacker({ accuracy: 85 }), combatant(), physical({ accuracy: -5 }))).toBe(80);
    expect(hitChanceOf(content, attacker({ accuracy: 85, statuses: [status('status_blind')] }), combatant(), physical())).toBe(55);
    expect(hitChanceOf(content, attacker({ accuracy: 85 }), combatant({ evasion: 10, statuses: [status('status_slow')] }), physical())).toBe(85);
  });

  test('a roll at or over hit% misses and draws nothing more; Mark and cannotMiss make the hit certain (no draw)', () => {
    const miss = pctx([D.pct(83)]);
    const r = resolveHit(miss, combatant({ accuracy: 87 }), attacker({ evasion: 4 }), physical());
    expect(r).toMatchObject({ hit: false, amount: 0, variance: null, hitChance: 83 });
    expect(stepNames(r)).toEqual(['hit%']);
    expect(miss.rng.queue).toEqual([]);
    expect(resolveHit(pctx([D.pct(82), D.variance(1), D.pct(99)]), combatant({ accuracy: 87 }), attacker({ evasion: 4 }), physical()).hit).toBe(true);
    const marked = pctx([D.variance(1), D.pct(99)]);
    expect(resolveHit(marked, attacker({ accuracy: 0 }), combatant({ evasion: 99, statuses: [status('status_mark')] }), physical()).hit).toBe(true);
    expect(marked.rng.queue).toEqual([]);
    expect(hitChanceOf(content, attacker(), combatant(), physical({ cannotMiss: true }))).toBe(100);
  });

  test('rollPct: int(0, 99) < pct; certain and impossible chances draw nothing', () => {
    const rng = new ScriptedRng([D.pct(49), D.pct(50)]);
    expect(rollPct(rng, 50)).toBe(true);
    expect(rollPct(rng, 50)).toBe(false);
    expect(rollPct(rng, 100)).toBe(true);
    expect(rollPct(rng, 0)).toBe(false);
    expect(rng.queue).toEqual([]);
  });
});

describe('damageRange (projections: variance bounds, no crit, no rng)', () => {
  test('DESIGN §4.12 opening chips and the Guard preview "14–17 → 7–9"', () => {
    const r = { s: makeState(), content };
    const ranger = attacker({ armor: 2, ward: 1, evasion: 4 });
    expect(damageRange(r, combatant({ atk: 7 }), ranger, physical())).toEqual([4, 6]);
    expect(damageRange(r, combatant({ sp: 7 }), ranger, { source: 'shade_wail', type: 'void', base: 0, coef: 0.9, stat: 'sp', spell: true })).toEqual([5, 6]);
    expect(damageRange(r, combatant({ atk: 11 }), ranger, physical())).toEqual([8, 10]);
    const maul = physical({ coef: 1.6 });
    expect(damageRange(r, combatant({ atk: 11 }), ranger, maul)).toEqual([14, 17]);
    expect(damageRange(r, combatant({ atk: 11 }), ranger, maul, { guard: true })).toEqual([7, 9]);
    // "not assuming Guard": a guarding target still projects unguarded unless asked
    expect(damageRange(r, combatant({ atk: 11 }), { ...ranger, guarding: true }, maul)).toEqual([14, 17]);
    expect(damageRange(r, combatant({ atk: 11 }), attacker({ resistances: { physical: 'immune' } }), maul)).toEqual([0, 0]);
  });
});

describe('resolveTick (DoT: resistance only, D-066 #4)', () => {
  test('typed ticks take the resistance step; no armor, ward, Guard, variance or crit', () => {
    const t = combatant({ armor: 50, ward: 50, guarding: true });
    expect(resolveTick(t, 5, 'physical')).toMatchObject({ amount: 5, immune: false });
    expect(resolveTick({ ...t, resistances: { fire: 'weak' } }, 3, 'fire').amount).toBe(5); // 4.5 → 5
    expect(resolveTick({ ...t, resistances: { void: 'resist' } }, 1, 'void').amount).toBe(1); // 0.5 → 1 (minimum)
    expect(resolveTick({ ...t, resistances: { void: 'immune' } }, 9, 'void')).toMatchObject({ amount: 0, immune: true });
    expect(stepNames(resolveTick(t, 5, 'physical'))).toEqual(['tick', 'resistance', 'final']);
  });

  test('untyped ticks (Poison) ignore resistance; capped at max HP; a zero tick deals 0', () => {
    expect(resolveTick(combatant({ resistances: { physical: 'immune' } }), 4).amount).toBe(4);
    expect(resolveTick(combatant({ hpMax: 3, hp: 3 }), 9).amount).toBe(3);
    expect(resolveTick(combatant(), 0, 'fire').amount).toBe(0);
  });
});

describe('resolveHeal (DESIGN §4.3 healing pipeline)', () => {
  test('base + coef·stat → one variance draw → Curse ×0.5 → clamp to missing HP (overheal reported)', () => {
    const healer = attacker({ sp: 10, atk: 0 });
    const hurt = attacker({ uid: 'c9', hp: 50, hpMax: 100 });
    const spec = { base: 14, coef: 1.2, stat: 'sp' } as const;
    const ctx = pctx([D.variance(1)]);
    expect(resolveHeal(ctx, healer, hurt, spec)).toMatchObject({ amount: 26, overheal: 0 });
    expect(ctx.rng.queue).toEqual([]);
    const cursed = { ...hurt, statuses: [status('status_curse')] };
    expect(resolveHeal(pctx([D.variance(1)]), healer, cursed, spec).amount).toBe(13);
    const nearlyFull = { ...hurt, hp: 95 };
    expect(resolveHeal(pctx([D.variance(1.1)]), healer, nearlyFull, spec)).toMatchObject({ amount: 5, overheal: 24 });
  });
});

describe('status helpers', () => {
  test('statusMods sums content modifiers per status; hasStatus', () => {
    const c = combatant({ statuses: [status('status_haste'), status('status_weaken'), status('status_mark'), status('status_curse'), status('status_armor_break'), status('status_unknown')] });
    expect(statusMods(c, content)).toEqual({
      accuracy: 0,
      evasion: 10,
      crit: 0,
      initiative: 5,
      outgoing: [-0.25],
      incoming: [0.15],
      healing: [-0.5],
      armorWardZero: true,
    });
    expect(hasStatus(c, 'status_mark')).toBe(true);
    expect(hasStatus(c, 'status_stun')).toBe(false);
  });
});
