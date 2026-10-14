// U24: statuses (DESIGN §4.1 turn timing, §4.5; PLAN §8.1 "statuses (18 + rested)"; D-066 #4, D-067.18, D-074). One
// `describe` per canonical status (apply, stacking cap, duration, ticks, numeric effect, expiry, cleanse), then the
// own-turn timing rule, the DoT rule, the turn loop (ticks that kill, Stun skips), rows and immunities, and the
// out-of-combat ticks shared with the clock hook. The interplay table is interplay.test.ts.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import type { ContentPack } from '@schema/contentPack';
import type { StatusApply } from '@schema/creature';
import {
  STATUS,
  STUN_RECOVERY_KEY,
  applyHit,
  applyStatus,
  applyStatusRows,
  beginCombat,
  blocksAction,
  cleanse,
  damageRange,
  dotDamage,
  effectiveInitiative,
  endOfTurnStatuses,
  findStatus,
  finishPlayerTurn,
  hitChanceOf,
  isOwnTurn,
  playerOf,
  removeStatus,
  resolveHeal,
  resolveHit,
  runCombat,
  skipsTurn,
  startOfTurnStatuses,
  statusImmunities,
  tauntedBy,
  tickCarriedWatch,
  tickOutOfCombatStatuses,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type HitSpec,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { BRUTE, D, SHADE, combatPack, combatTables, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';
import { FIXTURE_VERSION } from '@tests/fixtures/miniContent';

const content = combatPack();
const profile = freshProfile();
const TYRANT = 'cr_chronos_tyrant_unveiled';
const ABERRATION = 'cr_temporal_aberration';
const GOLEM = 'cr_test_golem';
const CHARM = 'item_test_charm';

/** The combat pack plus a construct (Poison-immune by tag only), a charm (resist physical, Blind-immune) and an Ilyra immune to Weaken. */
const variant: ContentPack = (() => {
  const t = combatTables();
  const { legacyName: _legacy, ...brute } = clone(t.creatures.find((c) => c.id === BRUTE)!);
  return buildContentPack(
    {
      ...t,
      creatures: [...t.creatures, { ...brute, id: GOLEM, name: 'Test Golem', tags: ['construct'] }],
      items: [
        ...t.items,
        {
          id: CHARM, name: 'Test Charm', type: 'trinket', slot: 'trinket', tier: 1, description: 'Fixture: a charm against the dark.', value: 10, art: { icon: 'charm' },
          passives: [{ kind: 'resist', damageType: 'physical', level: 'resist' }, { kind: 'statusImmunity', status: 'status_blind' }],
        },
      ],
      companions: t.companions.map((c) => (c.id === 'ilyra' ? { ...clone(c), statusImmunities: ['status_weaken'] } : c)),
    },
    { version: FIXTURE_VERSION },
  );
})();

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const inst = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });
const spec = (groups: EncounterSpec['groups']): EncounterSpec => ({ id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] });
const ILYRA = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {} };
const withIlyra: StateOverrides = { patch: (st) => void ((st.companions.recruited.ilyra = { ...ILYRA }), (st.companions.activeId = 'ilyra')) };

/** A fight in phase 'start': the player first (d4 4), a companion next (d4 4), enemies last (d4 1); nothing has acted. */
function setup(groups: EncounterSpec['groups'] = [{ creatureId: BRUTE, count: 1 }], o: StateOverrides = {}, pack: ContentPack = content) {
  const s = makeState(o, { content: pack });
  const companion = s.companions.activeId !== null ? 1 : 0;
  const enemies = groups.reduce((n, g) => n + g.count, 0);
  const ctx = scriptedCtx(s, [D.d4(4), ...Array<number>(companion).fill(D.d4(4)), ...Array<number>(enemies).fill(D.d4(1))], pack, profile);
  const combat = beginCombat(ctx, spec(groups));
  return { ctx, combat, me: combat.party[0] as Combatant, foe: combat.enemies[0] as Combatant };
}
/** Makes it `c`'s turn (for the own-turn rule). */
function turnOf(combat: CombatState, c: Combatant): void {
  combat.phase = c.kind === 'player' ? 'playerTurn' : c.kind === 'companion' ? 'companionTurn' : 'enemyTurn';
  combat.turnIndex = combat.turnOrder.indexOf(c.uid);
}
/** A fight at the player's first turn (the player acts first), with `edit` applied to the fight. */
function atPlayerTurn(groups: EncounterSpec['groups'] = [{ creatureId: BRUTE, count: 1 }], edit: (c: CombatState) => void = () => {}, o: StateOverrides = {}): GameState {
  const { ctx } = setup(groups, o);
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  const s = clone(ctx.s);
  edit(s.combat as CombatState);
  return s;
}
function act(s: GameState, action: Parameters<typeof scriptedStep>[1], draws: readonly number[]) {
  const out = scriptedStep(s, action, draws, content, profile);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}
const fightOf = (s: GameState): CombatState => s.combat as CombatState;
const foeOf = (s: GameState, i = 0): Combatant => fightOf(s).enemies[i] as Combatant;
const meOf = (s: GameState): Combatant => playerOf(fightOf(s));
const ids = (c: Combatant): string[] => c.statuses.map((st) => st.statusId);
const HIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(99)];
const MISS = [D.pct(99)];
const hitSpec = (type: HitSpec['type'], base = 10, over: Partial<HitSpec> = {}): HitSpec => ({ source: 'test', type, base, coef: 0, stat: 'atk', ...over });
/** Resolves and applies a hit through the reducer's applyHit (afterHit included). */
function strike(ctx: ReturnType<typeof setup>['ctx'], combat: CombatState, from: Combatant, to: Combatant, sp: HitSpec, draws: readonly number[]) {
  ctx.rng.queue.push(...draws);
  const r = resolveHit(ctx, from, to, sp);
  applyHit(ctx, combat, from, to, sp, r, 'ability');
  expect(ctx.rng.queue).toEqual([]);
  return r;
}

// ---- the 18 statuses + rested --------------------------------------------------------------------------------------------

describe('status_bleed', () => {
  test('tick round(1 + 0.2·ATK) per stack, stored at application; each application +1 stack (cap 3) and a refresh; the stronger tick kept', () => {
    const { ctx, combat, me, foe } = setup();
    expect(applyStatus(ctx, combat, me, foe, STATUS.bleed, { duration: 3 }).outcome).toBe('applied');
    expect(findStatus(foe, STATUS.bleed)).toEqual({ statusId: STATUS.bleed, stacks: 1, duration: 3, sourceUid: me.uid, tick: 4, appliedOnOwnTurn: false }); // 1 + 0.2·14 = 3.8
    findStatus(foe, STATUS.bleed)!.duration = 1;
    expect(applyStatus(ctx, combat, me, foe, STATUS.bleed, { duration: 3 }).outcome).toBe('stacked');
    expect(findStatus(foe, STATUS.bleed)).toMatchObject({ stacks: 2, duration: 3 });
    applyStatus(ctx, combat, me, foe, STATUS.bleed, { duration: 3, stacks: 2 });
    expect(findStatus(foe, STATUS.bleed)?.stacks).toBe(3);
    applyStatus(ctx, combat, { ...me, atk: 1 }, foe, STATUS.bleed);
    expect(findStatus(foe, STATUS.bleed)).toMatchObject({ stacks: 3, tick: 4, duration: 3 }); // a weaker source: tick kept (default duration 3)
    applyStatus(ctx, combat, { ...me, uid: 'c_strong', atk: 30 }, foe, STATUS.bleed);
    expect(findStatus(foe, STATUS.bleed)).toMatchObject({ tick: 7, sourceUid: 'c_strong' });
    expect(ofType(ctx.events, 'statusApplied').map((e) => e.stacks)).toEqual([1, 2, 3, 3, 3]);
  });

  test('ticks tick × stacks at the start of the holder\'s turn, Physical resistance step, ignoring armor; counted as party damage', () => {
    const { ctx, combat, me, foe } = setup();
    foe.statuses = [inst(STATUS.bleed, { stacks: 2, tick: 4, duration: 3, sourceUid: me.uid })];
    expect(startOfTurnStatuses(ctx, combat, foe)).toEqual({ killedBy: null, ticks: [{ statusId: STATUS.bleed, amount: 8 }] });
    expect(foe.hp).toBe(56); // armor 3 ignored
    expect(ctx.s.counters.damageBySource).toEqual({ 'status:status_bleed': 8 });
    foe.resistances = { physical: 'weak' };
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(44);
    expect(ofType(ctx.events, 'statusTicked').map((e) => e.amount)).toEqual([8, 12]);
  });
});

describe('status_burn', () => {
  test('tick round(1 + 0.2·SP) for every source (D-066 #3), Fire resistance step; no stacking, a refresh', () => {
    const { ctx, combat, me, foe } = setup();
    applyStatus(ctx, combat, { ...me, sp: 20 }, foe, STATUS.burn, { duration: 3 });
    expect(findStatus(foe, STATUS.burn)).toMatchObject({ tick: 5, stacks: 1, duration: 3 });
    applyStatus(ctx, combat, foe, me, STATUS.burn); // an enemy source: its SP
    expect(findStatus(me, STATUS.burn)?.tick).toBe(1);
    expect(applyStatus(ctx, combat, me, foe, STATUS.burn, { stacks: 3 }).outcome).toBe('refreshed');
    expect(findStatus(foe, STATUS.burn)).toMatchObject({ tick: 5, stacks: 1, duration: 3 });
    foe.resistances = { fire: 'resist' };
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(64 - 3); // 2.5 → 3
  });

  test('cannot be applied to a Soaked target; a Soaked application puts it out (interplay 5)', () => {
    const { ctx, combat, me, foe } = setup();
    foe.statuses = [inst(STATUS.soaked)];
    expect(applyStatus(ctx, combat, me, foe, STATUS.burn).outcome).toBe('blocked');
    expect(ids(foe)).toEqual([STATUS.soaked]);
    me.statuses = [inst(STATUS.burn, { tick: 3 })];
    expect(applyStatus(ctx, combat, foe, me, STATUS.soaked).outcome).toBe('applied');
    expect(ids(me)).toEqual([STATUS.soaked]);
  });
});

describe('status_shock', () => {
  test('−15 accuracy, +25 % Storm taken (step 7); 2 turns; refresh', () => {
    const { ctx, combat, me, foe } = setup();
    const before = hitChanceOf(content, foe, me, hitSpec('physical'));
    applyStatus(ctx, combat, me, foe, STATUS.shock);
    expect(findStatus(foe, STATUS.shock)?.duration).toBe(2);
    expect(hitChanceOf(content, foe, me, hitSpec('physical'))).toBe(Math.max(50, before - 15));
    const r = { s: ctx.s, content };
    expect(damageRange(r, me, foe, hitSpec('storm', 20))).toEqual([23, 28]); // 18 × 1.25 = 22.5, 22 × 1.25 = 27.5
    expect(damageRange(r, me, foe, hitSpec('fire', 20))).toEqual([18, 22]);
    expect(applyStatus(ctx, combat, me, foe, STATUS.shock, { duration: 1 }).outcome).toBe('refreshed');
    expect(findStatus(foe, STATUS.shock)?.duration).toBe(1);
  });
});

describe('status_soaked', () => {
  test('+50 % Storm, −50 % Fire (step 6); a Fire hit removes it; 3 turns', () => {
    const { ctx, combat, me, foe } = setup();
    applyStatus(ctx, combat, me, foe, STATUS.soaked);
    expect(findStatus(foe, STATUS.soaked)?.duration).toBe(3);
    const r = { s: ctx.s, content };
    expect(damageRange(r, me, foe, hitSpec('storm', 20))).toEqual([27, 33]);
    expect(damageRange(r, me, foe, hitSpec('fire', 20))).toEqual([9, 11]);
    strike(ctx, combat, me, foe, hitSpec('fire', 20), HIT());
    expect(foe.hp).toBe(54);
    expect(ids(foe)).toEqual([]);
  });
});

describe('status_slow', () => {
  test('−5 initiative (re-sorted each round), −10 evasion, cannot flee; Haste and Slow cancel', () => {
    const { ctx, combat, me, foe } = setup();
    const init = effectiveInitiative(foe, content);
    const evade = hitChanceOf(content, me, foe, hitSpec('physical'));
    applyStatus(ctx, combat, me, foe, STATUS.slow);
    expect(effectiveInitiative(foe, content)).toBe(init - 5);
    expect(hitChanceOf(content, me, foe, hitSpec('physical'))).toBe(Math.min(100, evade + 10));
    expect(blocksAction(content, foe, 'flee')).toBe(true);
    expect(blocksAction(content, foe, 'item')).toBe(false);
    expect(applyStatus(ctx, combat, me, foe, STATUS.haste).outcome).toBe('cancelled');
    expect(ids(foe)).toEqual([]);
  });
});

describe('status_haste', () => {
  test('+5 initiative, +10 evasion; removes Slow (cancel); a Chrono hit removes it', () => {
    const { ctx, combat, me, foe } = setup();
    const init = effectiveInitiative(me, content);
    applyStatus(ctx, combat, me, me, STATUS.haste);
    expect(effectiveInitiative(me, content)).toBe(init + 5);
    expect(hitChanceOf(content, foe, me, hitSpec('physical'))).toBe(86 - 4 - 10);
    expect(applyStatus(ctx, combat, foe, me, STATUS.slow).outcome).toBe('cancelled');
    expect(ids(me)).toEqual([]);
    applyStatus(ctx, combat, foe, foe, STATUS.haste);
    strike(ctx, combat, me, foe, hitSpec('chrono'), HIT());
    expect(ids(foe)).toEqual([]);
  });
});

describe('status_stun', () => {
  test('a Stunned enemy loses its next action (intent cancelled), then is immune for 2 of its turns', () => {
    const s = atPlayerTurn([{ creatureId: BRUTE, count: 1 }], (c) => void (c.intents[c.enemies[0]!.uid] = { moveId: 'brute_strike', targetUid: c.party[0]!.uid, projected: [8, 10], hidden: false, text: '', tags: [] }));
    const ctx = scriptedCtx(s, [], content, profile);
    const combat = fightOf(ctx.s);
    expect(applyStatus(ctx, combat, playerOf(combat), combat.enemies[0]!, STATUS.stun, { duration: 1 }).outcome).toBe('applied');
    expect(combat.intents).toEqual({});
    finishPlayerTurn(ctx, combat, playerOf(combat)); // the Brute's turn: stunned, no draw
    expect(ctx.rng.queue).toEqual([]);
    const brute = combat.enemies[0]!;
    expect(combat.log.map((l) => l.text)).toContain('Wildling Brute is stunned and loses the turn.');
    expect(ofType(ctx.events, 'attackResolved')).toEqual([]);
    expect(ids(brute)).toEqual([]);
    expect(brute.cooldowns).toEqual({ [STUN_RECOVERY_KEY]: 2 });
    expect(applyStatus(ctx, combat, playerOf(combat), brute, STATUS.stun).outcome).toBe('immune');
    expect(combat.log.at(-1)?.text).toBe('Wildling Brute: Immune (recovering) to Stun.');
    // two more of its turns close the window
    const one = act(ctx.s, { type: 'guard' }, MISS);
    expect(foeOf(one.state).cooldowns).toEqual({ [STUN_RECOVERY_KEY]: 1 });
    const two = act(one.state, { type: 'guard' }, MISS);
    expect(foeOf(two.state).cooldowns).toEqual({});
    const again = scriptedCtx(two.state, [], content, profile);
    expect(applyStatus(again, fightOf(again.s), meOf(again.s), foeOf(again.s), STATUS.stun).outcome).toBe('applied');
  });

  test('a Stunned player loses the turn automatically; the window lives in the fight\'s cooldown table', () => {
    const { ctx, combat, me } = setup();
    applyStatus(ctx, combat, null, me, STATUS.stun, { duration: 1 });
    ctx.rng.queue.push(...MISS);
    runCombat(ctx);
    expect(ctx.rng.queue).toEqual([]);
    expect(combat.round).toBe(2);
    expect(combat.phase).toBe('playerTurn');
    expect(combat.cooldowns).toEqual({ [STUN_RECOVERY_KEY]: 2 });
    expect(skipsTurn(content, me)).toBe(false);
  });

  test('bosses declare Stun immunity; the heavy weapon stuns non-bosses 10 % of the time (after the hit\'s draws)', () => {
    const { ctx, combat, me } = setup([{ creatureId: TYRANT, count: 1 }], { loop: 2 });
    expect(applyStatus(ctx, combat, me, combat.enemies[0]!, STATUS.stun).outcome).toBe('immune');
    const shade = atPlayerTurn([{ creatureId: SHADE, count: 1 }], () => {}, { classId: 'ironclad_warden' });
    const stunned = act(shade, { type: 'attack', targetUid: foeOf(shade).uid }, [D.pct(0), D.variance(1), D.pct(99), D.pct(9)]); // 9 < 10: stun; the Shade loses its turn
    expect(ofType(stunned.events, 'statusApplied')).toEqual([{ t: 'statusApplied', targetUid: foeOf(shade).uid, statusId: STATUS.stun, stacks: 1, duration: 1 }]);
    expect(ofType(stunned.events, 'attackResolved')).toHaveLength(1);
    const tyrant = atPlayerTurn([{ creatureId: TYRANT, count: 1 }], () => {}, { classId: 'ironclad_warden', loop: 2 });
    const boss = scriptedStep(tyrant, { type: 'attack', targetUid: foeOf(tyrant).uid }, [D.pct(0), D.variance(1), D.pct(99), ...MISS], content, freshProfile({ loopCounter: 2 }));
    expect(boss.left).toBe(0); // no stun roll against a boss
    expect(ofType(boss.events, 'statusApplied')).toEqual([]);
  });
});

describe('status_weaken', () => {
  test('deals −25 % damage (all types); 2 turns; refresh', () => {
    const { ctx, combat, me, foe } = setup();
    const r = { s: ctx.s, content };
    expect(damageRange(r, me, foe, hitSpec('fire', 20))).toEqual([18, 22]);
    applyStatus(ctx, combat, foe, me, STATUS.weaken);
    expect(findStatus(me, STATUS.weaken)?.duration).toBe(2);
    expect(damageRange(r, me, foe, hitSpec('fire', 20))).toEqual([14, 17]); // 13.5, 16.5
    expect(applyStatus(ctx, combat, foe, me, STATUS.weaken).outcome).toBe('refreshed');
  });
});

describe('status_armor_break', () => {
  test('armor and ward count as 0; +15 % Physical; 3 turns', () => {
    const { ctx, combat, me, foe } = setup();
    const r = { s: ctx.s, content };
    expect(damageRange(r, me, foe, hitSpec('physical', 20))).toEqual([15, 19]); // − armor 3
    applyStatus(ctx, combat, me, foe, STATUS.armorBreak);
    expect(findStatus(foe, STATUS.armorBreak)?.duration).toBe(3);
    expect(damageRange(r, me, foe, hitSpec('physical', 20))).toEqual([21, 25]); // 20.7, 25.3
  });
});

describe('status_mark', () => {
  test('+15 % damage taken; attacks cannot miss (no hit roll); 3 turns', () => {
    const { ctx, combat, me, foe } = setup();
    applyStatus(ctx, combat, me, foe, STATUS.mark);
    expect(findStatus(foe, STATUS.mark)?.duration).toBe(3);
    expect(hitChanceOf(content, me, foe, hitSpec('physical'))).toBe(100);
    const r = strike(ctx, combat, me, foe, hitSpec('fire', 20), [D.variance(1), D.pct(99)]);
    expect(r.amount).toBe(23);
  });
});

describe('status_curse', () => {
  test('Void tick round(2 + 0.2·SP); healing received ×0.5; refresh', () => {
    const { ctx, combat, me, foe } = setup();
    applyStatus(ctx, combat, me, foe, STATUS.curse);
    expect(findStatus(foe, STATUS.curse)).toMatchObject({ tick: 3, duration: 3 }); // 2 + 1.2
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(61);
    me.statuses = [inst(STATUS.curse, { tick: 3 })];
    me.hp = 50;
    ctx.rng.queue.push(D.variance(1));
    expect(resolveHeal(ctx, me, me, { base: 20, coef: 0, stat: 'sp' }).amount).toBe(10);
  });

  test('D-067.18: Void treats `resist void` as neutral against a Cursed target — hits and the Curse tick itself', () => {
    const { ctx, combat, me } = setup([{ creatureId: SHADE, count: 1 }]);
    const shade = combat.enemies[0]!;
    const r = { s: ctx.s, content };
    expect(damageRange(r, me, shade, hitSpec('void', 20))).toEqual([7, 9]); // resist ×0.5, − ward 2
    applyStatus(ctx, combat, me, shade, STATUS.curse);
    expect(damageRange(r, me, shade, hitSpec('void', 20))).toEqual([16, 20]); // neutral
    expect(damageRange(r, me, shade, hitSpec('physical', 20))).toEqual([17, 21]);
    expect(dotDamage(shade, findStatus(shade, STATUS.curse)!, content.statuses[STATUS.curse])?.amount).toBe(3); // not 1.5 → 2
    expect(dotDamage({ ...shade, statuses: [] }, inst(STATUS.curse, { tick: 3 }), content.statuses[STATUS.curse])?.amount).toBe(2);
  });
});

describe('status_shield', () => {
  test('a pool from the source (power) or an amount; reapplying keeps the higher pool and refreshes the duration', () => {
    const { ctx, combat, me, foe } = setup();
    applyStatus(ctx, combat, foe, foe, STATUS.shield, { amount: 20 });
    expect(findStatus(foe, STATUS.shield)).toMatchObject({ tick: 20, duration: 3 });
    findStatus(foe, STATUS.shield)!.duration = 1;
    applyStatus(ctx, combat, foe, foe, STATUS.shield, { amount: 10 });
    expect(findStatus(foe, STATUS.shield)).toMatchObject({ tick: 20, duration: 3 });
    applyStatus(ctx, combat, me, foe, STATUS.shield, { power: { base: 4, coef: 1, stat: 'atk' } }); // 4 + 14
    expect(findStatus(foe, STATUS.shield)?.tick).toBe(20);
    applyStatus(ctx, combat, me, foe, STATUS.shield, { power: { base: 10, coef: 1, stat: 'atk' } });
    expect(findStatus(foe, STATUS.shield)).toMatchObject({ tick: 24, sourceUid: me.uid });
  });

  test('absorbs before HP; emptied → gone; Void destroys it; DoT ticks go past it', () => {
    const { ctx, combat, me, foe } = setup();
    foe.statuses = [inst(STATUS.shield, { tick: 15, duration: 3 }), inst(STATUS.poison, { tick: 3, duration: 4 })];
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(61);
    expect(findStatus(foe, STATUS.shield)?.tick).toBe(15);
    strike(ctx, combat, me, foe, hitSpec('fire', 10), HIT());
    expect([foe.hp, findStatus(foe, STATUS.shield)?.tick]).toEqual([61, 5]);
    strike(ctx, combat, me, foe, hitSpec('fire', 10), HIT());
    expect(foe.hp).toBe(56);
    expect(ids(foe)).toEqual([STATUS.poison]);
    expect(ofType(ctx.events, 'statusExpired').map((e) => e.statusId)).toEqual([STATUS.shield]);
  });
});

describe('status_regen', () => {
  test('heals the stored amount at the start of the turn (power from the source), clamped to missing HP', () => {
    const { ctx, combat, foe } = setup();
    const rootKnit = content.creatures[BRUTE]!.moves.brute_root_knit!.statuses;
    turnOf(combat, foe);
    applyStatusRows(ctx, combat, foe, null, rootKnit);
    expect(findStatus(foe, STATUS.regen)).toMatchObject({ tick: 3, duration: 2, appliedOnOwnTurn: true });
    foe.hp = 30;
    expect(startOfTurnStatuses(ctx, combat, foe).ticks).toEqual([{ statusId: STATUS.regen, amount: 3 }]);
    expect(foe.hp).toBe(33);
    foe.hp = 63;
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(64);
    expect(ofType(ctx.events, 'healed')).toEqual([
      { t: 'healed', targetUid: foe.uid, amount: 3, source: STATUS.regen },
      { t: 'healed', targetUid: foe.uid, amount: 1, source: STATUS.regen },
    ]);
  });

  test('halved while Poisoned and while Cursed (×0.25 for both); a Void hit removes it', () => {
    const { ctx, combat, me, foe } = setup();
    foe.hp = 20;
    foe.statuses = [inst(STATUS.regen, { tick: 10 }), inst(STATUS.poison, { tick: 1, duration: 4 })];
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(20 - 1 + 5);
    foe.statuses.push(inst(STATUS.curse, { tick: 1 }));
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(24 - 1 - 1 + 3); // 2.5 → 3
    strike(ctx, combat, me, foe, hitSpec('void', 1), HIT());
    expect(findStatus(foe, STATUS.regen)).toBeUndefined();
  });
});

describe('status_taunt', () => {
  test('sits on the taunted creature with the taunter as its source; `tauntImmune` bosses ignore it; Stun on the taunter ends it', () => {
    const { ctx, combat, me, foe } = setup([{ creatureId: BRUTE, count: 2 }]);
    applyStatus(ctx, combat, me, foe, STATUS.taunt);
    applyStatus(ctx, combat, me, combat.enemies[1]!, STATUS.taunt);
    expect(tauntedBy(foe)).toBe(me.uid);
    expect(findStatus(foe, STATUS.taunt)?.duration).toBe(2);
    applyStatus(ctx, combat, foe, me, STATUS.stun);
    expect(combat.enemies.map(tauntedBy)).toEqual([null, null]);
    expect(ofType(ctx.events, 'interplay').map((e) => e.rule)).toEqual(['stun_ends_taunt', 'stun_ends_taunt']);
    const boss = setup([{ creatureId: TYRANT, count: 1 }], { loop: 2 });
    expect(applyStatus(boss.ctx, boss.combat, boss.me, boss.foe, STATUS.taunt).outcome).toBe('immune');
  });
});

describe('status_phase', () => {
  test('the next single-target attack misses (no roll) and consumes it, with any Mark; AoE and Chrono hit and keep it', () => {
    const { ctx, combat, me, foe } = setup();
    foe.statuses = [inst(STATUS.phase, { duration: 1 }), inst(STATUS.mark, { duration: 2 })];
    const aoe = strike(ctx, combat, me, foe, hitSpec('fire', 10, { aoe: true }), [D.variance(1), D.pct(99)]);
    expect(aoe.hit).toBe(true);
    const chrono = strike(ctx, combat, me, foe, hitSpec('chrono', 10), [D.variance(1), D.pct(99)]);
    expect(chrono.hit).toBe(true);
    expect(ids(foe)).toEqual([STATUS.phase, STATUS.mark]);
    const phased = strike(ctx, combat, me, foe, hitSpec('physical', 10), []);
    expect(phased).toMatchObject({ hit: false, phased: true, hitChance: 0 });
    expect(ids(foe)).toEqual([]);
    expect(ofType(ctx.events, 'statusExpired').map((e) => e.statusId)).toEqual([STATUS.phase, STATUS.mark]);
  });
});

describe('status_rewind', () => {
  test('snapshot at application; one per target; when its countdown reaches 0 the next turn start restores HP and cleanses Bleed/Burn/Poison', () => {
    const { ctx, combat, foe } = setup([{ creatureId: ABERRATION, count: 1 }]);
    foe.hp = 200;
    turnOf(combat, foe);
    applyStatusRows(ctx, combat, foe, null, content.creatures[ABERRATION]!.moves.aberration_rewind!.statuses);
    expect(findStatus(foe, STATUS.rewind)).toMatchObject({ snapshotHp: 200, duration: 2, appliedOnOwnTurn: true });
    expect(applyStatus(ctx, combat, foe, foe, STATUS.rewind).outcome).toBe('kept');
    endOfTurnStatuses(ctx, combat, foe); // own turn: no countdown
    foe.hp = 100;
    foe.statuses.push(inst(STATUS.bleed, { tick: 2, duration: 3 }), inst(STATUS.poison, { tick: 2, duration: 4 }), inst(STATUS.weaken, { duration: 3 }));
    startOfTurnStatuses(ctx, combat, foe);
    endOfTurnStatuses(ctx, combat, foe);
    startOfTurnStatuses(ctx, combat, foe);
    endOfTurnStatuses(ctx, combat, foe);
    expect(findStatus(foe, STATUS.rewind)?.duration).toBe(0); // kept at 0: it fires at the next turn start
    expect(foe.hp).toBe(100 - 4 - 4);
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(200);
    expect(ids(foe)).toEqual([STATUS.weaken]);
    expect(ofType(ctx.events, 'healed').at(-1)).toEqual({ t: 'healed', targetUid: foe.uid, amount: 112, source: STATUS.rewind }); // 200 − 88 (this turn's ticks first)
  });

  test('on a boss the restore is capped at 10 % of max HP (D-066 #1); never below current HP; Void and Ley consume it', () => {
    const { ctx, combat, me, foe } = setup([{ creatureId: TYRANT, count: 1 }], { loop: 2 });
    foe.hp = 500;
    foe.statuses = [inst(STATUS.rewind, { snapshotHp: 900, duration: 0 })];
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(500 + Math.round(0.1 * foe.hpMax));
    foe.statuses = [inst(STATUS.rewind, { snapshotHp: 100, duration: 0 })];
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(593);
    foe.statuses = [inst(STATUS.rewind, { snapshotHp: 900 })];
    strike(ctx, combat, me, foe, hitSpec('ley', 1), HIT());
    expect(ids(foe)).toEqual([]);
  });
});

describe('status_poison', () => {
  test('untyped tick round(1 + 0.15·ATK) ignoring resistances and armor; 4 turns; refresh', () => {
    const { ctx, combat, me, foe } = setup();
    applyStatus(ctx, combat, me, foe, STATUS.poison);
    expect(findStatus(foe, STATUS.poison)).toMatchObject({ tick: 3, duration: 4 }); // 1 + 2.1
    foe.resistances = { physical: 'immune', void: 'immune', fire: 'immune', storm: 'immune', ley: 'immune', chrono: 'immune' };
    startOfTurnStatuses(ctx, combat, foe);
    expect(foe.hp).toBe(61);
    expect(applyStatus(ctx, combat, me, foe, STATUS.poison).outcome).toBe('refreshed');
  });

  test('constructs and breach-born are immune (tags), as are records that list it ("Immune" in the log)', () => {
    const shade = setup([{ creatureId: SHADE, count: 1 }]);
    expect(applyStatus(shade.ctx, shade.combat, shade.me, shade.foe, STATUS.poison).outcome).toBe('immune');
    expect(shade.combat.log.at(-1)?.text).toBe('Corrupted Shade: Immune to Poison.');
    expect(ofType(shade.ctx.events, 'statusApplied')).toEqual([]);
    const golem = setup([{ creatureId: GOLEM, count: 1 }], {}, variant);
    expect(statusImmunities(golem.ctx.s, variant, golem.foe)).toEqual([STATUS.poison]);
    expect(applyStatus(golem.ctx, golem.combat, golem.me, golem.foe, STATUS.poison).outcome).toBe('immune');
  });
});

describe('status_blind', () => {
  test('−30 accuracy; 2 turns; refresh', () => {
    const { ctx, combat, me, foe } = setup();
    applyStatus(ctx, combat, me, foe, STATUS.blind);
    expect(findStatus(foe, STATUS.blind)?.duration).toBe(2);
    expect(hitChanceOf(content, foe, me, hitSpec('physical'))).toBe(52); // 86 − 30 − 4
    expect(hitChanceOf(content, foe, { ...me, evasion: 40 }, hitSpec('physical'))).toBe(50); // the hit% floor
  });
});

describe('status_rested', () => {
  test('baked into the snapshot (+2 initiative, +5 accuracy), consumed when the fight starts; never applied in a fight', () => {
    const plain = setup();
    const rested = setup(undefined, { patch: (st) => void (st.player.statuses = [inst(STATUS.rested, { duration: 1 })]) });
    expect(rested.me.initiative - plain.me.initiative).toBe(2);
    expect(rested.me.accuracy - plain.me.accuracy).toBe(5);
    expect(ids(rested.me)).toEqual([]);
    expect(rested.ctx.s.player.statuses).toEqual([]);
    expect(ofType(rested.ctx.events, 'statusExpired')).toEqual([{ t: 'statusExpired', targetUid: 'player', statusId: STATUS.rested }]);
    expect(() => applyStatus(plain.ctx, plain.combat, null, plain.me, STATUS.rested)).toThrow('never in a fight');
  });
});

// ---- timing -------------------------------------------------------------------------------------------------------------------

describe('status timing (DESIGN §4.1 (3), D-066 #4)', () => {
  test('durations count down at the end of the holder\'s own turns; at 0 the status expires', () => {
    const { ctx, combat, me, foe } = setup();
    turnOf(combat, me);
    applyStatus(ctx, combat, me, foe, STATUS.weaken, { duration: 2 });
    expect(isOwnTurn(combat, foe)).toBe(false);
    endOfTurnStatuses(ctx, combat, me); // not the holder's turn end: nothing
    expect(findStatus(foe, STATUS.weaken)?.duration).toBe(2);
    endOfTurnStatuses(ctx, combat, foe);
    expect(findStatus(foe, STATUS.weaken)?.duration).toBe(1);
    endOfTurnStatuses(ctx, combat, foe);
    expect(ids(foe)).toEqual([]);
    expect(ofType(ctx.events, 'statusExpired')).toEqual([{ t: 'statusExpired', targetUid: foe.uid, statusId: STATUS.weaken }]);
    expect(combat.log.at(-1)?.text).toBe('Weaken wears off Wildling Brute.');
  });

  test('a status applied during its holder\'s own turn skips that turn\'s countdown once (a refresh on its own turn too)', () => {
    const { ctx, combat, foe } = setup();
    turnOf(combat, foe);
    applyStatus(ctx, combat, foe, foe, STATUS.phase, { duration: 1 });
    expect(findStatus(foe, STATUS.phase)).toMatchObject({ duration: 1, appliedOnOwnTurn: true });
    endOfTurnStatuses(ctx, combat, foe);
    expect(findStatus(foe, STATUS.phase)).toMatchObject({ duration: 1, appliedOnOwnTurn: false });
    applyStatus(ctx, combat, foe, foe, STATUS.phase, { duration: 1 });
    endOfTurnStatuses(ctx, combat, foe);
    expect(findStatus(foe, STATUS.phase)?.duration).toBe(1);
    endOfTurnStatuses(ctx, combat, foe);
    expect(ids(foe)).toEqual([]);
  });

  test('through the turn loop: a self-Haste (2) on the player\'s turn lasts through the enemies\' next two turns and its full duration', () => {
    const s = atPlayerTurn();
    const ctx = scriptedCtx(s, MISS, content, profile);
    const combat = fightOf(ctx.s);
    applyStatus(ctx, combat, playerOf(combat), playerOf(combat), STATUS.haste);
    finishPlayerTurn(ctx, combat, playerOf(combat));
    expect(findStatus(playerOf(combat), STATUS.haste)?.duration).toBe(2);
    const second = act(ctx.s, { type: 'guard' }, MISS);
    expect(findStatus(meOf(second.state), STATUS.haste)?.duration).toBe(1);
    const third = act(second.state, { type: 'guard' }, MISS);
    expect(ids(meOf(third.state))).toEqual([]);
    const t = third.events.map((e) => e.t);
    expect(t.indexOf('statusExpired')).toBeLessThan(t.indexOf('attackResolved')); // expired at the player's turn end, before the Brute acts
  });
});

// ---- the DoT rule and the turn loop ---------------------------------------------------------------------------------------------

describe('DoT ticks (D-066 #4): resistance step only, at the start of the holder\'s turn', () => {
  test('weak ×1.5, resist ×0.5, immune 0 ("Immune"); never armor, ward, Guard or variance (no draws)', () => {
    const { ctx, combat, foe } = setup();
    foe.guarding = true;
    foe.armor = 50;
    foe.ward = 50;
    foe.statuses = [inst(STATUS.burn, { tick: 5 })];
    for (const [res, hp] of [['weak', 64 - 8], ['resist', 56 - 3], ['immune', 53], ['neutral', 48]] as const) {
      foe.resistances = { fire: res };
      startOfTurnStatuses(ctx, combat, foe);
      expect(foe.hp).toBe(hp);
    }
    expect(combat.log.filter((l) => l.text === 'Wildling Brute: Immune to Burn.')).toHaveLength(1);
    expect(ctx.rng.queue).toEqual([]);
  });

  test('DoTs tick Bleed → Burn → Poison → Curse; the first that kills stops the rest; Regen and Rewind then do not run', () => {
    const { ctx, combat, foe } = setup();
    foe.hp = 6;
    foe.statuses = [inst(STATUS.curse, { tick: 2 }), inst(STATUS.poison, { tick: 3 }), inst(STATUS.regen, { tick: 50 }), inst(STATUS.bleed, { tick: 4 })];
    expect(startOfTurnStatuses(ctx, combat, foe)).toEqual({ killedBy: STATUS.poison, ticks: [{ statusId: STATUS.bleed, amount: 4 }, { statusId: STATUS.poison, amount: 3 }] });
    expect(foe.hp).toBe(0);
  });

  test('an enemy killed by its ticks does not act and the fight goes on with the next combatant', () => {
    const s = atPlayerTurn([{ creatureId: BRUTE, count: 2 }], (c) => {
      c.enemies[0]!.hp = 3;
      c.enemies[0]!.statuses = [inst(STATUS.poison, { tick: 3, duration: 4, sourceUid: c.party[0]!.uid })];
    });
    const out = act(s, { type: 'guard' }, MISS); // only Brute B swings
    expect(foeOf(out.state, 0)).toMatchObject({ alive: false, hp: 0, statuses: [] });
    expect(ofType(out.events, 'combatantDefeated').map((e) => e.uid)).toEqual([foeOf(s, 0).uid]);
    expect(ofType(out.events, 'attackResolved').map((e) => e.sourceUid)).toEqual([foeOf(s, 1).uid]);
    expect(fightOf(out.state).log.map((l) => l.text)).toContain('Wildling Brute A succumbs before it can act.');
    expect(out.state.counters.damageBySource).toEqual({ 'status:status_poison': 3 });
    expect(fightOf(out.state)).toMatchObject({ round: 2, phase: 'playerTurn' });
  });

  test('the player killed by a start-of-turn tick falls before acting (Loop 1: FALLEN)', () => {
    const s = atPlayerTurn([{ creatureId: BRUTE, count: 1 }], (c) => {
      c.party[0]!.hp = 2;
      c.party[0]!.statuses = [inst(STATUS.bleed, { tick: 3, duration: 3 })];
    });
    const out = act(s, { type: 'guard' }, MISS);
    expect(out.state.combat?.phase).toBe('defeat');
    expect(ofType(out.events, 'playerDied')).toHaveLength(1);
    expect(ofType(out.events, 'resourceGained').filter((e) => e.reason === 'turn_start')).toEqual([]);
  });
});

// ---- rows, immunities, removal ---------------------------------------------------------------------------------------------------

describe('applyStatusRows (a move\'s or an ability\'s rows)', () => {
  const row = (over: Partial<StatusApply>): StatusApply => ({ status: STATUS.weaken, chance: 1, stacks: 1, duration: 2, target: 'target', ...over });

  test('one percentage roll per recipient after `when`; certain rows draw nothing; failures are reported', () => {
    const { ctx, combat, me, foe } = setup([{ creatureId: BRUTE, count: 2 }]);
    ctx.rng.queue.push(D.pct(59), D.pct(60));
    const out = applyStatusRows(ctx, combat, me, null, [row({ chance: 0.6, target: 'all_enemies' }), row({ status: STATUS.haste, target: 'self' })]);
    expect(out.map((r) => r.outcome)).toEqual(['applied', 'failed', 'applied']);
    expect(ids(foe)).toEqual([STATUS.weaken]);
    expect(ids(combat.enemies[1]!)).toEqual([]);
    expect(ids(me)).toEqual([STATUS.haste]);
    expect(ctx.rng.queue).toEqual([]);
  });

  test('targets: target, self, all_enemies, all_allies, ally (the companion, else self); `when` needs an evaluator', () => {
    const { ctx, combat, me, foe } = setup([{ creatureId: BRUTE, count: 1 }], withIlyra);
    const ilyra = combat.party[1]!;
    applyStatusRows(ctx, combat, me, foe, [row({ status: STATUS.mark }), row({ status: STATUS.regen, target: 'ally', power: { base: 5, coef: 0, stat: 'sp' } }), row({ status: STATUS.blind, target: 'all_allies' })]);
    expect([ids(foe), ids(ilyra), ids(me)]).toEqual([[STATUS.mark], [STATUS.regen, STATUS.blind], [STATUS.blind]]);
    expect(findStatus(ilyra, STATUS.regen)?.tick).toBe(5);
    applyStatusRows(ctx, combat, foe, null, [row({ status: STATUS.shock, target: 'all_enemies' }), row({ status: STATUS.haste, target: 'ally' })]);
    expect([ids(me), ids(ilyra), ids(foe)]).toEqual([[STATUS.blind, STATUS.shock], [STATUS.regen, STATUS.blind, STATUS.shock], [STATUS.mark, STATUS.haste]]);
    const stunRow = row({ status: STATUS.stun, duration: 1, when: { playerGuarding: false } });
    expect(() => applyStatusRows(ctx, combat, foe, me, [stunRow])).toThrow('no evaluator');
    expect(applyStatusRows(ctx, combat, foe, me, [stunRow], () => false)).toEqual([]);
    expect(applyStatusRows(ctx, combat, foe, me, [stunRow], (w, r) => 'playerGuarding' in w && r === me)[0]?.outcome).toBe('applied');
  });
});

describe('immunities, removal and lookups', () => {
  test('creature records, companion records and the player\'s gear; a fallen target takes nothing; an unknown status is a bug', () => {
    const { ctx, combat, me } = setup([{ creatureId: BRUTE, count: 1 }], { ...withIlyra, items: [{ itemId: CHARM, equip: true }] }, variant);
    expect(statusImmunities(ctx.s, variant, combat.enemies[0]!)).toEqual([]);
    expect(statusImmunities(ctx.s, variant, combat.party[1]!)).toEqual([STATUS.weaken]);
    expect(applyStatus(ctx, combat, null, combat.party[1]!, STATUS.weaken).outcome).toBe('immune');
    expect(applyStatus(ctx, combat, null, me, STATUS.blind).outcome).toBe('immune');
    const tyrant = setup([{ creatureId: TYRANT, count: 1 }], { loop: 2 });
    expect(statusImmunities(tyrant.ctx.s, content, tyrant.foe).sort()).toEqual([STATUS.bleed, STATUS.poison, STATUS.slow, STATUS.stun, STATUS.taunt].sort());
    const down = setup();
    down.foe.alive = false;
    expect(applyStatus(down.ctx, down.combat, null, down.foe, STATUS.weaken).outcome).toBe('ignored');
    expect(() => applyStatus(down.ctx, down.combat, null, down.me, 'status_nothing')).toThrow("unknown status 'status_nothing'");
    expect(statusImmunities(down.ctx.s, content, { ...down.foe, refId: 'cr_unknown' })).toEqual([]);
  });

  test('cleanse removes what the ability lists (statusExpired each); removeStatus of an absent status is false', () => {
    const { ctx, combat, me } = setup();
    me.statuses = [inst(STATUS.weaken), inst(STATUS.bleed, { tick: 2 }), inst(STATUS.haste)];
    expect(cleanse(ctx, combat, me, [STATUS.weaken, STATUS.bleed, STATUS.blind])).toEqual([STATUS.weaken, STATUS.bleed]);
    expect(ids(me)).toEqual([STATUS.haste]);
    expect(removeStatus(ctx, combat, me, STATUS.blind)).toBe(false);
    expect(combat.log.at(-1)?.text).toBe(`${me.name} is cleansed of Bleed.`);
  });
});

// ---- out of combat (shared with the clock hook) ---------------------------------------------------------------------------------

describe('carried DoTs out of combat (DESIGN §4.5, D-074): one implementation for the clock hook and beginCombat', () => {
  test('per watch: the in-combat tick rule (gear resistance included), never below 1 HP; the clock hook and tickCarriedWatch agree', () => {
    const s = makeState({ hp: 40, items: [{ itemId: CHARM, equip: true }], patch: (st) => void (st.player.statuses = [inst(STATUS.curse, { tick: 9, duration: 3 }), inst(STATUS.bleed, { tick: 2, stacks: 2, duration: 1 })]) }, { content: variant });
    const viaHelper = scriptedCtx(s, [], variant, profile);
    tickCarriedWatch(viaHelper);
    const viaHook = scriptedCtx(s, [], variant, profile);
    tickOutOfCombatStatuses(viaHook);
    for (const ctx of [viaHelper, viaHook]) {
      expect(ctx.s.player.hp).toBe(40 - 9 - 2); // Curse 9; Bleed 2 × 2 stacks × 0.5 (the charm: resist physical)
      expect(ofType(ctx.events, 'statusExpired').map((e) => e.statusId)).toEqual([STATUS.bleed]);
    }
    // the same Bleed in a fight deals the same tick
    const fight = setup([{ creatureId: BRUTE, count: 1 }], { items: [{ itemId: CHARM, equip: true }] }, variant);
    expect(dotDamage(fight.me, inst(STATUS.bleed, { tick: 2, stacks: 2 }), variant.statuses[STATUS.bleed])?.amount).toBe(2);
    const low = scriptedCtx(makeState({ hp: 3, patch: (st) => void (st.player.statuses = [inst(STATUS.poison, { tick: 9, duration: 4 })]) }), [], content, profile);
    tickCarriedWatch(low);
    expect(low.s.player.hp).toBe(1);
  });

  test('any rest clears them', () => {
    const s = makeState({ hp: 40, patch: (st) => void (st.player.statuses = [inst(STATUS.poison, { tick: 1, duration: 4 }), inst(STATUS.curse, { tick: 1, duration: 3 })]) });
    const out = play(s, [{ type: 'rest', kind: 'short' }]);
    expect(out.state.player.statuses).toEqual([]);
    expect(ofType(out.events, 'statusExpired').map((e) => e.statusId).sort()).toEqual([STATUS.curse, STATUS.poison]);
  });
});
