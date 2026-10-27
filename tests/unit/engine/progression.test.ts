// U21: progression (PLAN §8.1 "xp/levels/resources"): DESIGN §6.1's table, multi-level-up from one grant, level-up
// refills, class growth, the per-class resource rules (Ranger 8/12/5, Wizard 3 + ⌊L/4⌋, Elf 10/6/5, Warden 6/8/4,
// Weaver Blood price), self-cost availability ("Not enough blood"), tier gates, half-point costs and mastery.
import { describe, expect, test } from 'bun:test';
import { buildContentPack, type ContentPack } from '@content/index';
import type { Ability, AbilityInput } from '@schema/ability';
import type { Class } from '@schema/class';
import {
  HANDLERS,
  POST_STEP_HOOKS,
  abilityCost,
  apply,
  createStep,
  grantXp,
  makeCtx,
  masteredFor,
  maxLevel,
  playerAbilityCost,
  resourceGain,
  respecPlan,
  totalXpToReach,
  unlockCostHalf,
  unlockProblem,
  xpToNext,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';
import { fixturePack, miniContentTables } from '@tests/fixtures/miniContent';

const content = fixturePack();

/** A step whose `interact` grants `ev_<n>` XP through the `xp` effect (the U14 wiring), with the real post-step hooks. */
const xpStep = createStep(
  { ...HANDLERS, interact: (ctx, action) => apply({ xp: Number(action.eventId.slice(3)) }, ctx) },
  POST_STEP_HOOKS,
);
const grant = (s: GameState, ...amounts: number[]) =>
  play(
    s,
    amounts.map((n) => ({ type: 'interact' as const, eventId: `ev_${n}` })),
    { step: xpStep },
  );
const xpEvents = (events: GameEvent[]) => events.filter((e) => e.t === 'xpGained' || e.t === 'levelUp');

// ---- DESIGN §6.1 ------------------------------------------------------------------------------------------------------

describe('DESIGN §6.1 XP curve', () => {
  test('XP to next level, levels 1–19', () => {
    const table = [100, 150, 220, 300, 400, 520, 650, 800, 960, 1140, 1340, 1560, 1800, 2060, 2340, 2640, 2960, 3300, 3660];
    expect(table.map((_, i) => xpToNext(i + 1, content))).toEqual(table);
    expect(xpToNext(20, content)).toBeUndefined();
    expect(maxLevel(content)).toBe(20);
  });

  test('total XP to reach each level', () => {
    const totals = [0, 100, 250, 470, 770, 1170, 1690, 2340, 3140, 4100, 5240, 6580, 8140, 9940, 12000, 14340, 16980, 19940, 23240, 26900];
    expect(totals.map((_, i) => totalXpToReach(i + 1, content))).toEqual(totals);
  });
});

// ---- level-ups -------------------------------------------------------------------------------------------------------

describe('level-ups (the xp effect → grantXp)', () => {
  test('one grant crosses several levels: +1 stat point and +2 half-AP each, one levelUp per level', () => {
    const out = grant(makeState({ hp: 50, mp: 5 }), 470);
    expect(out.state.player).toMatchObject({ level: 4, xp: 0, statPoints: 3, apHalf: 8, hp: 144, hpMax: 144, mp: 57, mpMax: 57 });
    expect(xpEvents(out.events)).toEqual([
      { t: 'xpGained', amount: 470 },
      { t: 'levelUp', level: 2, statPoints: 1, apHalf: 4 },
      { t: 'levelUp', level: 3, statPoints: 2, apHalf: 6 },
      { t: 'levelUp', level: 4, statPoints: 3, apHalf: 8 },
    ]);
  });

  test('XP below the threshold accrues; the remainder carries over', () => {
    const below = grant(makeState({ hp: 50 }), 99);
    expect(below.state.player).toMatchObject({ level: 1, xp: 99, hp: 50 });
    expect(xpEvents(below.events)).toEqual([{ t: 'xpGained', amount: 99 }]);
    expect(grant(below.state, 1).state.player).toMatchObject({ level: 2, xp: 0 });
    expect(grant(makeState(), 120).state.player).toMatchObject({ level: 2, xp: 20 });
    expect(grant(makeState(), 60, 60).state.player).toMatchObject({ level: 2, xp: 20 });
  });

  test('a level-up refills HP and MP to the new maxima (allocated points included)', () => {
    const s = makeState({ hp: 3, mp: 0, patch: (st) => void (st.player.stats.strength = 12) });
    expect(grant(s, 100).state.player).toMatchObject({ level: 2, hp: 132, hpMax: 132, mp: 51, mpMax: 51 });
  });

  test('class growth: one grant from level 1 reproduces DESIGN §3.3 at every reference level', () => {
    const reference: Record<string, Record<number, [number, number]>> = {
      ranger: { 4: [144, 57], 8: [176, 69], 12: [208, 81], 16: [240, 93], 20: [272, 105] },
      wizard: { 4: [114, 87], 8: [138, 107], 12: [162, 127], 16: [186, 147], 20: [210, 167] },
    };
    for (const [classId, rows] of Object.entries(reference)) {
      for (const [level, [hp, mp]] of Object.entries(rows)) {
        const p = grant(makeState({ classId }), totalXpToReach(Number(level), content)).state.player;
        expect([p.level, p.xp, p.hpMax, p.mpMax, p.hp, p.mp, p.statPoints, p.apHalf]).toEqual([Number(level), 0, hp, mp, hp, mp, Number(level) - 1, 2 * Number(level)]);
      }
    }
  });

  test('level 20 is the cap: XP keeps accruing without level-ups', () => {
    const top = grant(makeState({ classId: 'wizard' }), 26_900);
    expect(top.state.player).toMatchObject({ level: 20, xp: 0 });
    const more = grant(top.state, 5000);
    expect(more.state.player).toMatchObject({ level: 20, xp: 5000 });
    expect(xpEvents(more.events)).toEqual([{ t: 'xpGained', amount: 5000 }]);
  });

  test('grantXp directly: returns the levels gained; a pack without a curve never levels', () => {
    const ctx = makeCtx(makeState(), freshProfile(), content);
    expect(grantXp(ctx, 250)).toBe(2);
    expect(grantXp(ctx, 0)).toBe(0);
    const noCurve = { ...content, config: { ...content.config, xpToNext: undefined } } as unknown as ContentPack;
    const bare = makeCtx(makeState(), freshProfile(), noCurve);
    expect(grantXp(bare, 10_000)).toBe(0);
    expect(bare.s.player).toMatchObject({ level: 1, xp: 10_000 });
    expect(maxLevel(noCurve)).toBe(1);
  });
});

// ---- class resources ---------------------------------------------------------------------------------------------------

type Res = Pick<Class, 'resource'>;
const elf: Res = { resource: { name: 'Mana', rules: [{ on: 'dodge', amount: 10 }, { on: 'crit', amount: 6 }] } };
const warden: Res = { resource: { name: 'Grit', rules: [{ on: 'hit_taken', amount: 6 }, { on: 'guard', amount: 8 }, { on: 'taunt', amount: 4 }] } };
const weaver: Res = { resource: { name: 'Mana', rules: [{ on: 'guard', amount: 5 }], bloodPrice: { hpPerMp: 2 } } };

describe('class resource rules (DESIGN §5.2–5.6)', () => {
  const gain = (cls: Res, on: Parameters<typeof resourceGain>[1], level = 1, opts: { mpMax?: number; gainPct?: number } = {}) => resourceGain(cls, on, level, content.config, opts);
  const { ranger, wizard } = content.classes as Record<string, Class>;

  test('Ranger Focus: +8 per basic hit, +12 on a basic crit, +5 per Guard', () => {
    expect([gain(ranger!, 'basic_hit'), gain(ranger!, 'basic_crit'), gain(ranger!, 'guard'), gain(ranger!, 'hit_taken')]).toEqual([8, 12, 5, 0]);
  });

  test('Wizard: 3 + ⌊level/4⌋ at turn start (3 at L1, 6 at L12, 8 at L20); universal +5 Guard', () => {
    expect([1, 3, 4, 8, 12, 19, 20].map((l) => gain(wizard!, 'turn_start', l))).toEqual([3, 3, 4, 5, 6, 7, 8]);
    expect(gain(wizard!, 'guard')).toBe(5);
  });

  test('Elf 10 on a dodge / 6 per crit / the universal 5 on Guard; Warden 6 / 8 / 4; Weaver Guard 5', () => {
    expect([gain(elf, 'dodge'), gain(elf, 'crit'), gain(elf, 'guard')]).toEqual([10, 6, 5]);
    expect([gain(warden, 'hit_taken'), gain(warden, 'guard'), gain(warden, 'taunt'), gain(warden, 'turn_start')]).toEqual([6, 8, 4, 0]);
    expect([gain(weaver, 'guard'), gain(weaver, 'basic_hit')]).toEqual([5, 0]);
  });

  test('pctMax rules and the Wellspring bonus (rounded down)', () => {
    const pctRule: Res = { resource: { name: 'Mana', rules: [{ on: 'turn_start', pctMax: 0.1 }] } };
    expect(gain(pctRule, 'turn_start', 1, { mpMax: 72 })).toBe(7);
    expect(gain(pctRule, 'turn_start', 1)).toBe(0);
    expect(gain(ranger!, 'basic_hit', 1, { gainPct: 0.25 })).toBe(10);
    expect(gain(ranger!, 'basic_crit', 1, { gainPct: 0.25 })).toBe(15);
  });
});

// ---- ability costs -------------------------------------------------------------------------------------------------------

type CostAbility = Pick<Ability, 'id' | 'mp' | 'selfCost'>;
const voidLance: CostAbility = { id: 'wvr_void_lance', mp: 10, selfCost: { hpPctMax: 0.08 } };
const bloodPact: CostAbility = { id: 'wvr_blood_pact', mp: 0, selfCost: { hpPctMax: 0.15 } };
const unmakingWord: CostAbility = { id: 'wvr_unmaking_word', mp: 30, selfCost: { hpPctCur: 0.4 } };
const markedShot: CostAbility = { id: 'rgr_marked_shot', mp: 8 };
const blood = { bloodPrice: weaver.resource.bloodPrice! };

describe('ability costs and self-costs (DESIGN §5.1, §5.6, D-066 #5)', () => {
  test('% max-HP self-cost rounds down; enough MP → no Blood price', () => {
    expect(abilityCost(voidLance, { hp: 90, hpMax: 90, mp: 48 }, blood)).toEqual({ mp: 10, mpPaid: 10, hp: 7, bloodHp: 0, ok: true, reason: null });
  });

  test('Weaver Blood price: 2 HP per missing MP, total HP cost must be < current HP', () => {
    expect(abilityCost(voidLance, { hp: 90, hpMax: 90, mp: 4 }, blood)).toEqual({ mp: 10, mpPaid: 4, hp: 19, bloodHp: 12, ok: true, reason: null });
    expect(abilityCost(voidLance, { hp: 20, hpMax: 90, mp: 4 }, blood).ok).toBe(true);
    expect(abilityCost(voidLance, { hp: 19, hpMax: 90, mp: 4 }, blood)).toMatchObject({ ok: false, reason: 'Not enough blood' });
  });

  test('without Blood price, missing MP makes an ability unavailable', () => {
    expect(abilityCost(markedShot, { hp: 120, hpMax: 120, mp: 5 })).toMatchObject({ ok: false, reason: 'Not enough MP', mp: 8 });
    expect(abilityCost(markedShot, { hp: 120, hpMax: 120, mp: 8 })).toMatchObject({ ok: true, mpPaid: 8, hp: 0 });
  });

  test('a self-cost never kills: HP must exceed it (Blood Pact, The Unmaking Word)', () => {
    expect(abilityCost(bloodPact, { hp: 13, hpMax: 90, mp: 0 }, blood)).toMatchObject({ hp: 13, ok: false, reason: 'Not enough blood' });
    expect(abilityCost(bloodPact, { hp: 14, hpMax: 90, mp: 0 }, blood)).toMatchObject({ hp: 13, ok: true });
    expect(abilityCost(unmakingWord, { hp: 50, hpMax: 90, mp: 30 }, blood)).toMatchObject({ hp: 20, ok: true });
    expect(abilityCost(unmakingWord, { hp: 1, hpMax: 90, mp: 30 }, blood)).toMatchObject({ hp: 1, ok: false });
  });

  test('MP modifiers: staff reduction rounds down (min 1), ×1.25 before it, Corruption 3 makes wvr_ 1 cheaper', () => {
    const caster = { hp: 100, hpMax: 100, mp: 100 };
    const mp = (a: CostAbility, opts: Parameters<typeof abilityCost>[2]) => abilityCost(a, caster, opts).mp;
    expect(mp(markedShot, { mpCostReduction: 0.1 })).toBe(7);
    expect(mp({ id: 'wiz_fireball', mp: 10 }, { mpCostReduction: 0.1 })).toBe(9);
    expect(mp({ id: 'wiz_spark', mp: 1 }, { mpCostReduction: 0.2 })).toBe(1);
    expect(mp({ id: 'wiz_bolt', mp: 14 }, { mpCostReduction: 0.2 })).toBe(11);
    expect(mp({ id: 'wiz_echo_bolt', mp: 10 }, { mpMult: 1.25, mpCostReduction: 0.1 })).toBe(10);
    expect(mp({ id: 'wiz_echo_bolt', mp: 10 }, { mpMult: 1 })).toBe(10);
    expect(mp(voidLance, { corruption: 3 })).toBe(9);
    expect(mp(voidLance, { corruption: 2 })).toBe(10);
    expect(mp(markedShot, { corruption: 6 })).toBe(8);
    expect(mp(bloodPact, { corruption: 6, mpCostReduction: 0.2 })).toBe(0);
  });

  test('playerAbilityCost applies the equipped staff and a destroyed Heartstone (Ley only)', () => {
    const s = makeState({ classId: 'wizard' });
    expect(playerAbilityCost(s, content, 'wiz_fireball').mp).toBe(9);
    expect(playerAbilityCost(s, content, 'wiz_echo_bolt').mp).toBe(9);
    s.world.heartstone = 'destroyed';
    expect(playerAbilityCost(s, content, 'wiz_echo_bolt').mp).toBe(10);
    expect(playerAbilityCost(s, content, 'wiz_fireball').mp).toBe(9);
    expect(playerAbilityCost(s, content, 'wiz_fireball', { hp: 10, hpMax: 96, mp: 3 })).toMatchObject({ ok: false, reason: 'Not enough MP' });
    expect(() => playerAbilityCost(s, content, 'wiz_nothing')).toThrow("unknown ability 'wiz_nothing'");
  });
});

// ---- unlocks, mastery, respec ----------------------------------------------------------------------------------------------

const ability = (id: string, tier: number, mp: number, extra: Partial<AbilityInput> = {}): AbilityInput => ({
  id, ownerId: 'ranger', branch: 'hunt', tier, name: id, description: 'Fixture.', mp, target: 'enemy', damageType: 'physical', power: { coef: 1, stat: 'atk' }, ...extra,
});
/** The fixture plus the rest of the Hunt branch (Tiers 3–5), a corruption-gated Wizard ability and a Wizard starting ability. */
const treePack = buildContentPack(
  {
    ...miniContentTables,
    abilities: [
      ...miniContentTables.abilities,
      ability('rgr_hunters_eye', 3, 10),
      ability('rgr_pinning_shot', 4, 14),
      ability('rgr_killing_shot', 5, 24),
      ability('wiz_static_lash', 1, 8, { ownerId: 'wizard', branch: 'storm', damageType: 'storm', corruptionReq: 1 }),
    ],
    classes: miniContentTables.classes.map((c) => (c.id === 'wizard' ? { ...c, startingAbilities: ['wiz_echo_bolt'] } : c)),
  },
  { version: 'u21-tree' },
);
const at = (o: StateOverrides) => makeState(o, { content: treePack });
const mastery = (mastered: string[]): Profile => freshProfile({ classMastery: { ranger: { loopsPlayed: 1, mastered, endings: [], bestLevel: 5, bestDays: null } } });
const problem = (s: GameState, id: string, profile = freshProfile()) => unlockProblem(s, treePack, profile, id);

describe('ability unlocks: tier gates and branch prerequisites (DESIGN §5.1)', () => {
  test('Tier 1 at level 1; Tier 2 needs level 4', () => {
    expect(problem(at({}), 'rgr_marked_shot')).toBeNull();
    expect(problem(at({}), 'rgr_piercing_arrow')).toBe('Piercing Arrow requires level 4');
    expect(problem(at({ level: 4 }), 'rgr_piercing_arrow')).toBeNull();
  });

  test('Tier 3 needs 2 abilities in its branch, Tier 4 needs 3, the capstone all four (other branches do not count)', () => {
    const s = at({ level: 16, abilities: ['rgr_rend'] });
    expect(problem(s, 'rgr_hunters_eye')).toBe('rgr_hunters_eye requires 2 hunt abilities unlocked first');
    s.player.abilitiesUnlocked.push('rgr_marked_shot');
    expect(problem(s, 'rgr_hunters_eye')).toContain('requires 2');
    s.player.abilitiesUnlocked.push('rgr_piercing_arrow');
    expect(problem(s, 'rgr_hunters_eye')).toBeNull();
    expect(problem(s, 'rgr_pinning_shot')).toContain('requires 3');
    s.player.abilitiesUnlocked.push('rgr_hunters_eye');
    expect(problem(s, 'rgr_pinning_shot')).toBeNull();
    expect(problem(s, 'rgr_killing_shot')).toContain('requires 4');
    s.player.abilitiesUnlocked.push('rgr_pinning_shot');
    expect(problem(s, 'rgr_killing_shot')).toBeNull();
    expect(problem(at({ level: 15, abilities: ['rgr_marked_shot', 'rgr_piercing_arrow', 'rgr_hunters_eye', 'rgr_pinning_shot'] }), 'rgr_killing_shot')).toBe(
      'rgr_killing_shot requires level 16',
    );
  });

  test('only the own class tree; never twice; Corruption-gated abilities wait for Corruption', () => {
    const s = at({ abilities: ['rgr_rend'] });
    expect(problem(s, 'rgr_rend')).toBe('Rend is already unlocked');
    expect(problem(s, 'wiz_fireball')).toBe("'wiz_fireball' is not one of your class's abilities");
    expect(problem(s, 'comp_ilyra_mend')).toContain('not one of your');
    expect(problem(s, 'itm_echo_bolt')).toContain('not one of your');
    expect(problem(s, 'rgr_nothing')).toContain('not one of your');
    expect(problem(at({ classId: 'wizard' }), 'wiz_static_lash')).toBe('wiz_static_lash requires Corruption 1');
    expect(problem(at({ classId: 'wizard', corruption: 1 }), 'wiz_static_lash')).toBeNull();
  });
});

describe('half-point costs and mastery (DESIGN §5.1, §6.4)', () => {
  const abilities = treePack.abilities;

  test('Tiers 1–4 cost 2 half-points, the capstone 4; mastered ones half that', () => {
    expect(['rgr_marked_shot', 'rgr_piercing_arrow', 'rgr_hunters_eye', 'rgr_pinning_shot', 'rgr_killing_shot'].map((id) => unlockCostHalf(abilities[id]!, []))).toEqual([2, 2, 2, 2, 4]);
    const mastered = ['rgr_marked_shot', 'rgr_killing_shot'];
    expect(unlockCostHalf(abilities.rgr_marked_shot!, mastered)).toBe(1);
    expect(unlockCostHalf(abilities.rgr_killing_shot!, mastered)).toBe(2);
    expect(unlockCostHalf(abilities.rgr_rend!, mastered)).toBe(2);
  });

  test('mastery is per class, read from the profile; a mastered ability fits in half an AP', () => {
    const profile = mastery(['rgr_marked_shot']);
    expect(masteredFor(profile, 'ranger')).toEqual(['rgr_marked_shot']);
    expect(masteredFor(profile, 'wizard')).toEqual([]);
    const s = at({ patch: (st) => void (st.player.apHalf = 1) });
    expect(problem(s, 'rgr_rend')).toBe('Not enough ability points');
    expect(problem(s, 'rgr_marked_shot', profile)).toBeNull();
  });

  test('mastery does not lift level gates: a mastered capstone still needs level 16', () => {
    const profile = mastery(['rgr_marked_shot', 'rgr_piercing_arrow', 'rgr_hunters_eye', 'rgr_pinning_shot', 'rgr_killing_shot']);
    expect(problem(at({ level: 9, abilities: ['rgr_marked_shot', 'rgr_piercing_arrow', 'rgr_hunters_eye', 'rgr_pinning_shot'] }), 'rgr_killing_shot', profile)).toContain('level 16');
  });

  test('the respec refund is what each unlock cost this loop; starting abilities are free and stay', () => {
    const ranger = at({ level: 8, abilities: ['rgr_marked_shot', 'rgr_rend', 'rgr_piercing_arrow', 'rgr_hunters_eye'] });
    expect(respecPlan(ranger, treePack, freshProfile())).toEqual({
      refundHalf: 8,
      keep: [],
      refunded: ['rgr_marked_shot', 'rgr_rend', 'rgr_piercing_arrow', 'rgr_hunters_eye'],
    });
    expect(respecPlan(ranger, treePack, mastery(['rgr_rend', 'rgr_hunters_eye'])).refundHalf).toBe(6);
    const wizard = at({ classId: 'wizard', abilities: ['wiz_fireball', 'rgr_rend'] });
    expect(wizard.player.abilitiesUnlocked).toEqual(['wiz_echo_bolt', 'wiz_fireball', 'rgr_rend']);
    expect(respecPlan(wizard, treePack, freshProfile())).toEqual({ refundHalf: 2, keep: ['wiz_echo_bolt', 'rgr_rend'], refunded: ['wiz_fireball'] });
  });
});
