// U26: the specials registry (PLAN §5.19 rule 3; D-072: 15 ids) — the engine mirror of the content list — and the move
// parts U25 left to U26 (D-077): a move's `special`, its combat-scope `effects` (multiHit, stripBuffs, healOnDamage;
// D-069.9) and `riposte`, plus counter-hits. Ability specials are exercised through the abilities in
// abilities.test.ts (mark_execute, chain, counter_stance, drain, unmaking, resource_convert, foresight, guard, phase,
// rewind, cleanse, trap); the rest are here.
import { describe, expect, test } from 'bun:test';
import { SPECIALS as CONTENT_SPECIALS, SPECIAL_INFO } from '@schema/specials';
import {
  BOUND_MAGES,
  BOUND_MAGE_TAG,
  RIPOSTE_KEY,
  SPECIALS,
  SPECIAL_HOOKS,
  boundMageOf,
  findStatus,
  hooksOf,
  moveHits,
  playerOf,
  projectIntent,
  reactToHit,
  beginCombat,
  runCombat,
  type Action,
  type CombatState,
  type Combatant,
  type CombatOps,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type Intent,
  type SpecialUse,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { D, DUELIST, SHADE, combatPack, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';

const content = combatPack();
const profile = freshProfile();
const ILYRA = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {} };

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });
const state = (o: StateOverrides = {}): GameState => makeState(o, { content });
const spec = (groups: EncounterSpec['groups']): EncounterSpec => ({ id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] });
const HIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(99)];
const MISS = [D.pct(99)];

function fight(s: GameState, groups: EncounterSpec['groups']): GameState {
  const companion = s.companions.activeId !== null;
  const draws = [D.d4(4), ...(companion ? [D.d4(3)] : []), ...groups.flatMap((g) => Array.from({ length: g.count }, () => D.d4(1)))];
  const ctx = scriptedCtx(s, draws, content, profile);
  beginCombat(ctx, spec(groups));
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  (ctx.s.combat as CombatState).intents = {};
  return ctx.s;
}
function patched(s: GameState, edit: (c: CombatState) => void): GameState {
  const out = clone(s);
  edit(out.combat as CombatState);
  return out;
}
const enemy = (s: GameState, i = 0): Combatant => (s.combat as CombatState).enemies[i] as Combatant;
const me = (s: GameState): Combatant => playerOf(s.combat as CombatState);
function act(s: GameState, action: Action, draws: readonly number[] = []) {
  const out = scriptedStep(s, action, draws, content, profile);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}
const GUARD: Action = { type: 'guard' };
/** The Duelist(s) commit to `moveId` at the player; enemies without one hold still. */
const commit = (s: GameState, moveId: string, i = 0): GameState =>
  patched(s, (c) => void (c.intents[c.enemies[i]!.uid] = { moveId, targetUid: c.party[0]!.uid, projected: [0, 0], hidden: false, text: '', tags: [] } satisfies Intent));
const duel = (o: StateOverrides = {}, n = 1) => fight(state(o), [{ creatureId: DUELIST, count: n }]);

describe('the SPECIALS registry (PLAN §5.19 rule 3, D-072)', () => {
  test('the engine list mirrors src/content/schema/specials.ts exactly — the same 17 ids (U34e: class_mirror, last_spell), in order, with the same scopes', () => {
    expect(SPECIALS).toEqual(CONTENT_SPECIALS);
    expect(SPECIALS).toHaveLength(17);
    for (const id of SPECIALS) {
      const hooks = SPECIAL_HOOKS[id];
      expect([id, [...hooks.scopes]]).toEqual([id, [...SPECIAL_INFO[id].scopes]]);
      expect(hooks.rule.length).toBeGreaterThan(10);
      const keys = Object.keys(hooks).filter((k) => k !== 'scopes' && k !== 'rule');
      expect(keys.length).toBeGreaterThan(0); // every id does something
    }
    expect(hooksOf(undefined)).toBeUndefined();
    expect(hooksOf('nonsense')).toBeUndefined();
  });

  test('taunt (ability): Taunt from the user on the opposing recipients, else on every opponent', () => {
    const s = fight(state({ classId: 'ironclad_warden' }), [{ creatureId: SHADE, count: 2 }]);
    const ctx = scriptedCtx(s, [], content, profile);
    const c = ctx.s.combat as CombatState;
    const ops: CombatOps = { applyHit: () => {}, gainResource: () => 0, addMp: () => 0 };
    const use = (recipients: Combatant[]): SpecialUse => ({ ctx, combat: c, ops, user: c.party[0]!, scope: 'ability', id: 'x', kind: 'ability', primary: null, recipients, spec: null, struck: [], hpPaid: 0, from: 0, memo: {} });
    SPECIAL_HOOKS.taunt.after(use([c.enemies[1]!]));
    expect(c.enemies.map((e) => findStatus(e, 'status_taunt')?.sourceUid ?? null)).toEqual([null, c.party[0]!.uid]);
    SPECIAL_HOOKS.taunt.after(use([c.party[0]!]));
    expect(c.enemies.map((e) => findStatus(e, 'status_taunt')?.sourceUid ?? null)).toEqual([c.party[0]!.uid, c.party[0]!.uid]);
  });
});

describe("a move's U26 parts (D-077), through the turn loop", () => {
  test('multiHit: Lunge lands two hits (each its own rolls); its chip projects both (2 × [5, 6])', () => {
    const s = commit(duel(), 'duel_lunge');
    expect(moveHits(content.creatures[DUELIST]!.moves.duel_lunge!)).toBe(2);
    expect(moveHits(content.creatures[DUELIST]!.moves.duel_drink!)).toBe(1);
    const c = s.combat!;
    expect(projectIntent({ s, profile, content }, c, enemy(s), c.intents[enemy(s).uid]!)).toEqual([10, 12]);
    const out = act(s, GUARD, [...HIT(), ...MISS]);
    expect(ofType(out.events, 'attackResolved').map((e) => e.hit)).toEqual([true, false]);
  });

  test('healOnDamage: Drink heals the Duelist half of what it dealt (10 → 5)', () => {
    const s = patched(commit(duel(), 'duel_drink'), (c) => void (c.enemies[0]!.hp = 40));
    const out = act(s, { type: 'attack', targetUid: enemy(s).uid }, [...MISS, ...HIT()]);
    expect(ofType(out.events, 'damageDealt').map((e) => e.amount)).toEqual([10]);
    expect(ofType(out.events, 'healed')).toEqual([{ t: 'healed', targetUid: enemy(s).uid, amount: 5, source: 'duel_drink' }]);
  });

  test('stripBuffs: Take removes the listed buffs (Shield, Regen) from its target, and only those', () => {
    const s = patched(commit(duel(), 'duel_take'), (c) => void c.party[0]!.statuses.push(status('status_shield', { tick: 20 }), status('status_regen', { tick: 3 }), status('status_haste')));
    const out = act(s, GUARD);
    expect(me(out.state).statuses.map((st) => st.statusId)).toEqual(['status_haste']);
  });

  test('riposte: armed for its next turn; the player\'s Physical hit is answered (1.0·ATK = 10); a Ley hit is not', () => {
    const armed = act(commit(duel({ items: ['item_amulet_of_echoes'] }), 'duel_set'), GUARD).state;
    expect(enemy(armed).cooldowns).toEqual({ [`${RIPOSTE_KEY}duel_set`]: 1 });
    const quietly = patched(armed, (c) => void (c.intents = {}));
    const sword = act(quietly, { type: 'attack', targetUid: enemy(armed).uid }, [...HIT(), ...HIT()]);
    expect(ofType(sword.events, 'damageDealt').map((e) => [e.sourceUid === me(armed).uid ? 'player' : 'duelist', e.refId, e.amount])).toEqual([
      ['player', null, 13],
      ['duelist', 'counter:duel_set', 10],
    ]);
    expect(enemy(sword.state).cooldowns).toEqual({}); // it lasted until the Duelist's next turn began
    const bolt = act(quietly, { type: 'ability', abilityId: 'itm_echo_bolt', targetUid: enemy(armed).uid }, HIT());
    expect(ofType(bolt.events, 'damageDealt')).toHaveLength(1);
  });

  test('counter_stance (move): Parry strikes, then Guards and counters the player\'s next melee hit with its power', () => {
    const parried = act(commit(duel(), 'duel_parry'), GUARD, HIT()).state; // 5 × 0.5 → 3 on the Guarding player
    expect(enemy(parried).guarding).toBe(true);
    const quietly = patched(parried, (c) => void (c.intents = {}));
    const out = act(quietly, { type: 'attack', targetUid: enemy(parried).uid }, [...HIT(), ...HIT()]);
    expect(ofType(out.events, 'damageDealt').map((e) => [e.refId, e.amount])).toEqual([[null, 7], ['counter:duel_parry', 5]]); // 13 × 0.5 → 7
  });

  test('guard (move): Brace — the Duelist Guards until its next turn', () => {
    const braced = act(commit(duel(), 'duel_guard'), GUARD).state;
    expect(enemy(braced).guarding).toBe(true);
    const out = act(patched(braced, (c) => void (c.intents = {})), { type: 'attack', targetUid: enemy(braced).uid }, HIT());
    expect(ofType(out.events, 'damageDealt').map((e) => e.amount)).toEqual([7]);
  });

  test('drain (move): Leech heals half of the Void it dealt', () => {
    const s = patched(commit(duel(), 'duel_leech'), (c) => void (c.enemies[0]!.hp = 30));
    const out = act(s, GUARD, HIT());
    expect(ofType(out.events, 'damageDealt').map((e) => e.amount)).toEqual([5]); // 10 × 0.5 (Guard)
    expect(ofType(out.events, 'healed')).toEqual([{ t: 'healed', targetUid: enemy(s).uid, amount: 3, source: 'duel_leech' }]);
  });

  test('cleanse (move): Mend takes every debuff off the Duelist', () => {
    const s = patched(commit(duel(), 'duel_mend'), (c) => void c.enemies[0]!.statuses.push(status('status_weaken', { duration: 5 }), status('status_mark', { duration: 5 }), status('status_shield', { tick: 9, duration: 5 })));
    const out = act(s, GUARD);
    expect(enemy(out.state).statuses.map((st) => st.statusId)).toEqual(['status_shield']);
  });

  test('chain (move): Arc on the Soaked player repeats at × 0.5 on Ilyra, whom the spread has Shocked', () => {
    const s0 = state({ patch: (st) => void ((st.companions.recruited.ilyra = { ...ILYRA }), (st.companions.activeId = 'ilyra')) });
    const s = patched(commit(fight(s0, [{ creatureId: DUELIST, count: 1 }]), 'duel_arc'), (c) => void c.party[0]!.statuses.push(status('status_soaked', { duration: 3 })));
    const out = act(s, GUARD, [...MISS, ...HIT(), ...HIT()]); // Ilyra's dart misses; the Arc; the chained Arc
    // player: 10 × 1.5 (Soaked) × 0.5 (Guard) = 7.5 → 8; Ilyra: 10 × 1.25 (Shock) × 0.5 (chain) = 6.25 − ward 3 → 3
    expect(ofType(out.events, 'damageDealt').map((e) => [e.targetUid, e.amount])).toEqual([[me(s).uid, 8], [s.combat!.party[1]!.uid, 3]]);
  });

  test('hour_presses: Chrono 8 % of max HP × (1 − Resolve/8), no roll; while Resolve ≥ 3 it cannot kill (D-067.3)', () => {
    const s = commit(duel(), 'duel_press');
    expect(me(s).hpMax).toBe(120);
    const plain = act(s, GUARD); // no communion: Resolve 0 → 9.6 → 10, Guard does not touch it
    expect(ofType(plain.events, 'damageDealt').map((e) => [e.damageType, e.amount])).toEqual([['chrono', 10]]);
    const communion = { movement: 1 as const, resolve: 4, questionIndex: 0, answered: [], usedAnswers: [], lies: 0, listened: false, supportUsed: false, clockBonusGranted: false };
    const half = act(patched(s, (c) => void (c.communion = { ...communion })), GUARD);
    expect(ofType(half.events, 'damageDealt').map((e) => e.amount)).toEqual([5]); // 4.8
    const spared = act(patched(s, (c) => void ((c.communion = { ...communion }), (c.party[0]!.hp = 1))), GUARD);
    expect(me(spared.state).hp).toBe(1);
    expect(ofType(spared.events, 'damageDealt').map((e) => e.amount)).toEqual([0]);
  });

  test("bound_mage: each Reach rolls its mage once, without repeats in the fight (Korr's fire + Burn 60 %; Aulde's Shield on itself)", () => {
    const s = commit(commit(duel({}, 2), 'duel_dead_spell', 0), 'duel_dead_spell', 1);
    const out = act(s, GUARD, [D.int(0, 0, 4), ...HIT(), D.pct(10), D.int(1, 0, 3)]);
    expect(enemy(out.state, 0).pattern.firedOnce).toContain(`${BOUND_MAGE_TAG}korr`);
    expect(enemy(out.state, 1).pattern.firedOnce).toContain(`${BOUND_MAGE_TAG}aulde`);
    expect(ofType(out.events, 'damageDealt').map((e) => [e.damageType, e.amount])).toEqual([['fire', 6]]); // 12 × 0.5 (Guard)
    expect(findStatus(me(out.state), 'status_burn')).toBeDefined();
    expect(findStatus(enemy(out.state, 1), 'status_shield')?.tick).toBe(15);
    // a mage once rolled stays; when all five are taken, repeats are allowed
    const ctx = scriptedCtx(out.state, [D.int(2, 0, 4)], content, profile);
    const c = ctx.s.combat as CombatState;
    expect(boundMageOf(ctx, c, c.enemies[0]!)).toBe('korr');
    const other = c.enemies[1]!;
    c.enemies.splice(1, 1, ...Object.keys(BOUND_MAGES).map((m, i) => ({ ...clone(other), uid: `reach${i}`, pattern: { ...other.pattern, firedOnce: [`${BOUND_MAGE_TAG}${m}`] } })));
    c.enemies[0]!.pattern.firedOnce = [];
    expect(boundMageOf(ctx, c, c.enemies[0]!)).toBe('aulde');
  });

  test('Sallow and Masque: Regen / Rewind on a boss ally if any, else itself, and their rows on the target; Vane: Physical + Armor Break 50 %', () => {
    const tag = (s: GameState, i: number, mage: string) => patched(s, (c) => void c.enemies[i]!.pattern.firedOnce.push(`${BOUND_MAGE_TAG}${mage}`));
    const base = commit(commit(duel({}, 2), 'duel_dead_spell', 0), 'duel_dead_spell', 1);
    const out = act(tag(tag(base, 0, 'sallow'), 1, 'masque'), GUARD, [D.pct(10)]); // Sallow's Poison 50 % (10 < 50); Masque's Mark is certain
    expect(findStatus(enemy(out.state, 0), 'status_regen')?.tick).toBe(4); // 0.4 × 10
    expect(findStatus(enemy(out.state, 1), 'status_rewind')).toBeDefined();
    expect([findStatus(me(out.state), 'status_poison'), findStatus(me(out.state), 'status_mark')].every(Boolean)).toBe(true);
    const vane = act(tag(patched(base, (c) => void delete c.intents[c.enemies[1]!.uid]), 0, 'vane'), GUARD, [...HIT(), D.pct(10)]);
    expect(ofType(vane.events, 'damageDealt').map((e) => [e.damageType, e.amount])).toEqual([['physical', 6]]);
    expect(findStatus(me(vane.state), 'status_armor_break')).toBeDefined();
  });
});

describe('stripBuffs targets (D-069.9: `target` as StatusApply, default the struck targets)', () => {
  test('self, all_enemies, all_allies, ally', () => {
    const take = content.creatures[DUELIST]!.moves.duel_take!;
    const packFor = (target: 'self' | 'all_enemies' | 'all_allies' | 'ally') => ({
      ...content,
      creatures: { ...content.creatures, [DUELIST]: { ...content.creatures[DUELIST]!, moves: { ...content.creatures[DUELIST]!.moves, duel_take: { ...take, effects: [{ stripBuffs: { kinds: ['haste' as const], target } }] } } } },
    });
    const s = patched(commit(duel({}, 2), 'duel_take'), (c) => {
      for (const x of [...c.party, ...c.enemies]) x.statuses.push(status('status_haste', { duration: 5 }));
    });
    const hasted = (st: GameState) => [...st.combat!.party, ...st.combat!.enemies].map((x) => findStatus(x, 'status_haste') !== undefined);
    const run = (target: 'self' | 'all_enemies' | 'all_allies' | 'ally') => {
      const out = scriptedStep(s, GUARD, [], packFor(target), profile);
      expect(out.rejected).toBeNull();
      return hasted(out.state);
    };
    expect(run('self')).toEqual([true, false, true]);
    expect(run('all_enemies')).toEqual([false, true, true]);
    expect(run('all_allies')).toEqual([true, false, false]);
    expect(run('ally')).toEqual([true, true, false]);
  });
});

describe('counter-hits (reactToHit)', () => {
  test('only a rolled Physical single-target hit from an opponent that connected; counters are never countered', () => {
    const armed = patched(duel(), (c) => void (c.enemies[0]!.cooldowns[`${RIPOSTE_KEY}duel_set`] = 1));
    const ctx = scriptedCtx(armed, [], content, profile);
    const c = ctx.s.combat as CombatState;
    const calls: string[] = [];
    const ops: CombatOps = { applyHit: (_x, _c, a) => void calls.push(a.uid), gainResource: () => 0, addMp: () => 0 };
    const [player, foe] = [c.party[0]!, c.enemies[0]!];
    const hit = { hit: true, phased: false, crit: false, immune: false, hitChance: 100, critChance: 0, variance: 1, amount: 5, absorbed: 0, shieldBroken: false, mitigated: 0, steps: [] };
    const phys = { source: 'basic', type: 'physical' as const, base: 0, coef: 1, stat: 'atk' as const };
    reactToHit(ctx, c, ops, player, foe, { ...phys, aoe: true }, hit);
    reactToHit(ctx, c, ops, player, foe, { ...phys, type: 'fire' }, hit);
    reactToHit(ctx, c, ops, player, foe, phys, { ...hit, hit: false });
    reactToHit(ctx, c, ops, player, foe, phys, { ...hit, variance: null });
    reactToHit(ctx, c, ops, player, foe, { ...phys, source: 'counter:rgr_riposte_stance' }, hit);
    reactToHit(ctx, c, ops, foe, foe, phys, hit);
    expect(calls).toEqual([]);
    ctx.rng.queue.push(...HIT());
    reactToHit(ctx, c, ops, player, foe, phys, hit);
    expect(calls).toEqual([foe.uid]);
  });
});
