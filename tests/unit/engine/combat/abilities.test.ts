// U26: abilities in play (DESIGN §4.1, §4.8, §5.1–5.7, §7.9, §12.4; PLAN §8.1 "xp/levels/resources" self-cost and
// resource rows; D-066 #3/#5/#12, D-067.19, D-074). Availability (known abilities, MP, Blood price and "Not enough
// blood", cooldowns, targets), resolution for every ability field through the real reducer — at least three abilities
// per class — class resources in a fight, the companion's signature command, combat items, traps, foresight, and
// legalActions ⇔ step for the new actions.
import { describe, expect, test } from 'bun:test';
import {
  COAT_KEY,
  DELAY_KEY,
  FORESIGHT_KEY,
  TRAP_FLAG,
  beginCombat,
  combatAbilityProblem,
  combatItemActions,
  combatItemProblem,
  fieldAbilityActions,
  fieldAbilityProblem,
  findStatus,
  foreseenMove,
  foresightActive,
  knownAbilities,
  legalActions,
  pickTargets,
  playerOf,
  roundHalfUp,
  runCombat,
  signatureActions,
  step,
  type Action,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { BRUTE, D, DUELIST, SHADE, combatPack, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';

const content = combatPack();
const profile = freshProfile();
const TYRANT = 'cr_chronos_tyrant_unveiled';
const ILYRA = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {} };

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });
const state = (o: StateOverrides = {}): GameState => makeState(o, { content });
const withIlyra = (o: StateOverrides = {}): GameState =>
  state({ ...o, patch: (st) => void ((st.companions.recruited.ilyra = { ...ILYRA }), (st.companions.activeId = 'ilyra'), o.patch?.(st)) });
const spec = (groups: EncounterSpec['groups'], over: Partial<EncounterSpec> = {}): EncounterSpec => ({
  id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [], ...over,
});
type Groups = EncounterSpec['groups'];
const one = (creatureId: string, count = 1): Groups => [{ creatureId, count }];

/** A hit with variance `v` and no crit; a crit; a miss. */
const HIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(99)];
const CRIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(0)];
const MISS = [D.pct(99)];

/**
 * A fight at the player's first turn: the player first (d4 4), the companion next (d4 3), every enemy last (d4 1). By
 * default the enemies hold still (their intents are dropped: no enemy draws after the player acts).
 */
function fight(s: GameState, groups: Groups, opts: { keepIntents?: boolean; over?: Partial<EncounterSpec> } = {}): GameState {
  const companion = s.companions.activeId !== null;
  const draws = [D.d4(4), ...(companion ? [D.d4(3)] : []), ...groups.flatMap((g) => Array.from({ length: g.count }, () => D.d4(1)))];
  const ctx = scriptedCtx(s, draws, content, profile);
  beginCombat(ctx, spec(groups, opts.over));
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  if (!opts.keepIntents) (ctx.s.combat as CombatState).intents = {};
  return ctx.s;
}
function patched(s: GameState, edit: (c: CombatState, s: GameState) => void): GameState {
  const out = clone(s);
  edit(out.combat as CombatState, out);
  return out;
}
/** The enemies hold still on their next turn. */
const quiet = (s: GameState): GameState => patched(s, (c) => void (c.intents = {}));
const enemy = (s: GameState, i = 0): Combatant => (s.combat as CombatState).enemies[i] as Combatant;
const me = (s: GameState): Combatant => playerOf(s.combat as CombatState);
const ally = (s: GameState): Combatant => (s.combat as CombatState).party[1] as Combatant;
function act(s: GameState, action: Action, draws: readonly number[] = []) {
  const out = scriptedStep(s, action, draws, content, profile);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}
const rejected = (s: GameState, action: Action): string | null => scriptedStep(s, action, [], content, profile).rejected;
const ability = (abilityId: string, targetUid?: string): Action => (targetUid === undefined ? { type: 'ability', abilityId } : { type: 'ability', abilityId, targetUid });
const dealt = (events: readonly GameEvent[]) => ofType(events, 'damageDealt').map((e) => [e.refId, e.amount]);

// ---- availability --------------------------------------------------------------------------------------------------------

describe('availability (DESIGN §5.1, D-066 #5, D-074)', () => {
  test("the player's abilities: unlocked ones, then those carried gear grants (the Amulet's itm_echo_bolt)", () => {
    expect(knownAbilities(state({ abilities: ['rgr_rend'], items: ['item_amulet_of_echoes'] }), content)).toEqual(['rgr_rend', 'itm_echo_bolt']);
    expect(knownAbilities(state(), content)).toEqual([]);
    const s = fight(state({ abilities: ['rgr_rend'] }), one(SHADE));
    expect(combatAbilityProblem(s, content, s.combat!, 'rgr_marked_shot')).toBe("You do not know 'rgr_marked_shot'");
    expect(rejected(s, ability('nonsense'))).toBe("You do not know 'nonsense'");
  });

  test('MP: an ability the player cannot pay for is unavailable ("Not enough MP")', () => {
    const s = fight(state({ abilities: ['rgr_rend'], mp: 7 }), one(SHADE));
    expect(combatAbilityProblem(s, content, s.combat!, 'rgr_rend')).toBe('Not enough MP');
    expect(legalActions(s, content, profile).some((a) => a.type === 'ability')).toBe(false);
  });

  test('Blood price + % HP self-cost: available only while the total HP cost is below current HP; it never kills (D-066 #5)', () => {
    // Shadow Weaver L1 (102 max HP), 0 MP: Void Lance's 10 MP → 20 HP of Blood price, + 8 % of 102 (8) = 28 HP
    const base = fight(state({ classId: 'shadow_weaver', abilities: ['wvr_void_lance'], mp: 0 }), one(DUELIST));
    expect(me(base).hpMax).toBe(102);
    const at = (hp: number) => patched(base, (c) => void (c.party[0]!.hp = hp));
    const lance = ability('wvr_void_lance', enemy(base).uid);
    expect(combatAbilityProblem(at(28), content, at(28).combat!, 'wvr_void_lance')).toBe('Not enough blood');
    expect(rejected(at(28), lance)).toBe('Not enough blood');
    expect(legalActions(at(28), content, profile).filter((a) => a.type === 'ability')).toEqual([]);
    expect(legalActions(at(29), content, profile).filter((a) => a.type === 'ability')).toEqual([lance]);
    const out = act(at(29), lance, HIT());
    expect(me(out.state)).toMatchObject({ hp: 1, mp: 0 });
    // 3 + 1.3 × 12 = 18.6 − ward 1 = 17.6 → 18
    expect(dealt(out.events)).toEqual([['wvr_void_lance', 18]]);
  });

  test("cooldowns count the caster's turns: the Amulet's bolt (1-turn cooldown, D-067.19) is out for exactly the next turn; its Ley hit consumes Rewind (interplay 9)", () => {
    const s = fight(state({ items: ['item_amulet_of_echoes'] }), one(SHADE));
    const bolt = ability('itm_echo_bolt', enemy(s).uid);
    const rewound = patched(s, (c) => void c.enemies[0]!.statuses.push(status('status_rewind', { duration: 2, snapshotHp: 36 })));
    const t1 = act(rewound, bolt, HIT());
    // max(0.75 × 14, 4 + 0.8 × 7) = 10.5; weak Ley × 1.5 = 15.75 − ward 2 = 13.75 → 14
    expect(dealt(t1.events)).toEqual([['itm_echo_bolt', 14]]);
    expect(ofType(t1.events, 'interplay').map((e) => e.rule)).toEqual(['rewind_consumed']);
    expect(findStatus(enemy(t1.state), 'status_rewind')).toBeUndefined();
    expect(me(t1.state).mp).toBe(me(s).mp - 10);
    expect(t1.state.combat!.cooldowns).toEqual({ itm_echo_bolt: 1 });
    expect(rejected(quiet(t1.state), bolt)).toBe('Echo Bolt (Amulet) is recharging (1)');
    const t2 = act(quiet(t1.state), { type: 'guard' });
    expect(t2.state.combat!.cooldowns).toEqual({});
    expect(dealt(act(quiet(t2.state), bolt, HIT()).events)).toEqual([['itm_echo_bolt', 14]]);
  });

  test('targets (DESIGN §4.8): an enemy (default leftmost), every enemy, self, the party, an ally (default the companion, else the caster)', () => {
    const s = fight(withIlyra({ abilities: ['rgr_rend', 'rgr_field_dressing', 'rgr_smoke_bomb'] }), one(SHADE, 2));
    const c = s.combat!;
    const a = (id: string) => content.abilities[id]!;
    expect(pickTargets(c, me(s), a('rgr_rend'))).toEqual({ primary: enemy(s, 0), recipients: [enemy(s, 0)] });
    expect(pickTargets(c, me(s), a('rgr_rend'), 'nobody')).toBe("There is no enemy 'nobody' to target");
    expect(pickTargets(c, me(s), a('rgr_rend'), me(s).uid)).toBe(`There is no enemy '${me(s).uid}' to target`);
    expect(pickTargets(c, me(s), a('rgr_smoke_bomb'))).toEqual({ primary: null, recipients: [enemy(s, 0), enemy(s, 1)] });
    expect(pickTargets(c, me(s), a('rgr_smoke_bomb'), enemy(s).uid)).toBe('Smoke Bomb takes no target');
    expect(pickTargets(c, me(s), a('rgr_field_dressing'))).toEqual({ primary: ally(s), recipients: [ally(s)] });
    expect(pickTargets(c, me(s), a('rgr_field_dressing'), me(s).uid)).toEqual({ primary: me(s), recipients: [me(s)] });
    expect(pickTargets(c, me(s), a('rgr_field_dressing'), enemy(s).uid)).toBe(`'${enemy(s).uid}' is not one of your party`);
    expect(pickTargets(c, ally(s), a('rgr_field_dressing'))).toEqual({ primary: me(s), recipients: [me(s)] });
    const solo = fight(state({ abilities: ['rgr_field_dressing'] }), one(SHADE));
    expect(pickTargets(solo.combat!, me(solo), a('rgr_field_dressing'))).toEqual({ primary: me(solo), recipients: [me(solo)] });
    expect(pickTargets(c, me(s), a('wiz_cinder_shield'), me(s).uid)).toBe('Cinder Shield takes no target');
    expect(pickTargets(c, me(s), a('elf_veilwalk'))).toEqual({ primary: null, recipients: [me(s), ally(s)] });
    // the enumerator lists one action per target choice
    expect(legalActions(s, content, profile).filter((x) => x.type === 'ability')).toEqual([
      ability('rgr_field_dressing', me(s).uid),
      ability('rgr_field_dressing', ally(s).uid),
      ability('rgr_rend', enemy(s, 0).uid),
      ability('rgr_rend', enemy(s, 1).uid),
      ability('rgr_smoke_bomb'),
    ]);
  });
});

// ---- Ranger --------------------------------------------------------------------------------------------------------------

describe('Ranger (DESIGN §5.2) through the reducer', () => {
  test('Marked Shot → Piercing Arrow: Mark (100 %, no roll) makes the arrow certain and × 1.15 × 1.25 (bonus `when` targetHas), ignoring armor', () => {
    const s = fight(state({ abilities: ['rgr_marked_shot', 'rgr_piercing_arrow'] }), one(BRUTE));
    const brute = enemy(s).uid;
    const t1 = act(s, ability('rgr_marked_shot', brute), HIT()); // 1.1 × 14 = 15.4 − 3 = 12.4 → 12
    expect(dealt(t1.events)).toEqual([['rgr_marked_shot', 12]]);
    expect(findStatus(enemy(t1.state), 'status_mark')).toMatchObject({ duration: 2, sourceUid: me(s).uid });
    expect(me(t1.state).mp).toBe(me(s).mp - 8);
    const t2 = act(quiet(t1.state), ability('rgr_piercing_arrow', brute), [D.variance(1), D.pct(99)]); // no hit roll: Marked
    expect(dealt(t2.events)).toEqual([['rgr_piercing_arrow', 30]]); // 1.5 × 14 = 21 × 1.15 × 1.25 = 30.19, armor ignored
    expect(ofType(t2.events, 'abilityUsed')).toEqual([{ t: 'abilityUsed', uid: me(s).uid, abilityId: 'rgr_piercing_arrow' }]);
  });

  test('Killing Shot: a guaranteed crit against a Marked target (mark_execute: no hit or crit roll); a kill refunds 24 MP (onKill)', () => {
    const s = patched(fight(state({ abilities: ['rgr_killing_shot'], mp: 30 }), one(SHADE, 2)), (c) => {
      c.enemies[0]!.hp = 20;
      c.enemies[0]!.statuses.push(status('status_mark', { duration: 2 }));
    });
    const out = act(s, ability('rgr_killing_shot', enemy(s).uid), [D.variance(1)]);
    expect(ofType(out.events, 'attackResolved')[0]).toMatchObject({ hit: true, crit: true });
    expect(enemy(out.state)).toMatchObject({ alive: false, hp: 0 });
    expect(ofType(out.events, 'resourceGained')).toEqual([{ t: 'resourceGained', uid: me(s).uid, amount: 24, reason: 'onKill:rgr_killing_shot' }]);
    expect(me(out.state).mp).toBe(30);
    expect(out.state.combat!.cooldowns.rgr_killing_shot).toBe(4);
  });

  test('Riposte Stance: Guard this round, a 0.8·ATK counter-hit on each melee hit that connects, +8 Focus each (counter_stance)', () => {
    const s = fight(state({ abilities: ['rgr_riposte_stance'], mp: 20 }), one(DUELIST), { keepIntents: true });
    expect(s.combat!.intents[enemy(s).uid]?.moveId).toBe('duel_lunge');
    // the Duelist's Lunge: two hits (multiHit), each Guarded (5 × 0.5 = 2.5 → 3) and each answered (11.2 − 1 = 10.2 → 10)
    const out = act(s, ability('rgr_riposte_stance'), [...HIT(), ...HIT(), ...HIT(), ...HIT()]);
    expect(dealt(out.events)).toEqual([['duel_lunge', 3], ['counter:rgr_riposte_stance', 10], ['duel_lunge', 3], ['counter:rgr_riposte_stance', 10]]);
    expect(ofType(out.events, 'guarded')).toEqual([{ t: 'guarded', uid: me(s).uid }]);
    expect(me(out.state).mp).toBe(20 - 8 + 8 + 8);
    expect(enemy(out.state).hp).toBe(40);
    expect(out.state.combat!.cooldowns).toEqual({ rgr_riposte_stance: 3 }); // the stance ends when the Ranger's next turn begins
    expect(me(out.state).guarding).toBe(false);
  });

  test('Hamstring: Slow always; +1 Bleed stack only where the target already bleeds (a row `when`)', () => {
    const s = patched(fight(state({ abilities: ['rgr_hamstring'] }), one(SHADE, 2)), (c) => void c.enemies[0]!.statuses.push(status('status_bleed', { duration: 3, tick: 3 })));
    const a = act(s, ability('rgr_hamstring', enemy(s, 0).uid), HIT());
    expect(findStatus(enemy(a.state, 0), 'status_bleed')?.stacks).toBe(2);
    expect(findStatus(enemy(a.state, 0), 'status_slow')).toBeDefined();
    const b = act(quiet(a.state), ability('rgr_hamstring', enemy(s, 1).uid), HIT());
    expect(findStatus(enemy(b.state, 1), 'status_bleed')).toBeUndefined();
    expect(findStatus(enemy(b.state, 1), 'status_slow')).toBeDefined();
  });

  test('Venom Coat: for 3 of the Ranger\'s turns its strikes carry Poison (100 %, 4); the fourth strike does not (script `coat`)', () => {
    let s = act(fight(state({ abilities: ['rgr_venom_coat'] }), one(BRUTE)), ability('rgr_venom_coat')).state;
    expect(s.combat!.cooldowns[`${COAT_KEY}rgr_venom_coat`]).toBe(3);
    expect(findStatus(me(s), 'status_poison')).toBeUndefined(); // the row coats; it does not land on the caster
    const poisoned: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const out = act(quiet(s), { type: 'attack', targetUid: enemy(s).uid }, HIT());
      poisoned.push(ofType(out.events, 'statusApplied').some((e) => e.statusId === 'status_poison'));
      s = out.state;
    }
    expect(poisoned).toEqual([true, true, true, false]);
    expect(findStatus(enemy(s), 'status_poison')?.tick).toBe(3); // round(1 + 0.15 × 14)
  });

  test('Exsanguinate: the hit, then all the Bleed at once — 2 × its remaining tick total, armor ignored (script)', () => {
    const s = patched(fight(state({ abilities: ['rgr_exsanguinate'] }), one(BRUTE, 2)), (c) => void c.enemies[0]!.statuses.push(status('status_bleed', { stacks: 2, duration: 2, tick: 5 })));
    const out = act(s, ability('rgr_exsanguinate', enemy(s).uid), HIT());
    expect(dealt(out.events)).toEqual([['rgr_exsanguinate', 17], ['rgr_exsanguinate', 40]]); // 19.6 − 3 → 17; 2 × 5 × 2 × 2
    expect(findStatus(enemy(out.state), 'status_bleed')).toBeUndefined();
    expect(enemy(out.state).hp).toBe(64 - 57);
  });

  test('Field Dressing: 18 + 0.8·max(STR, AGI) on the chosen ally; it takes Bleed and Poison only (script); out of combat, its `outOfCombat` heal at 10 MP', () => {
    const s = patched(fight(state({ abilities: ['rgr_field_dressing'] }), one(SHADE)), (c) => {
      c.party[0]!.hp = 50;
      c.party[0]!.statuses.push(status('status_bleed', { tick: 2 }), status('status_poison', { tick: 2 }), status('status_weaken'));
    });
    const out = act(s, ability('rgr_field_dressing', me(s).uid), [D.variance(1)]);
    expect(ofType(out.events, 'healed')).toEqual([{ t: 'healed', targetUid: me(s).uid, amount: 26, source: 'rgr_field_dressing' }]);
    expect(me(out.state).statuses.map((st) => st.statusId)).toEqual(['status_weaken']);
    // the field: 20 HP for 10 MP, no target
    const field = state({ abilities: ['rgr_field_dressing', 'rgr_rend'], hp: 50 });
    expect(fieldAbilityActions(field, content)).toEqual([{ type: 'ability', abilityId: 'rgr_field_dressing' }]);
    expect(fieldAbilityProblem(field, content, 'rgr_rend')).toBe('Rend can only be used in a fight');
    expect(fieldAbilityProblem(field, content, 'rgr_field_dressing', 'x')).toBe('There is nothing to target outside combat');
    const healed = act(field, ability('rgr_field_dressing'));
    expect(healed.state.player).toMatchObject({ hp: 70, mp: field.player.mp - 10 });
    expect(ofType(healed.events, 'abilityUsed')).toEqual([{ t: 'abilityUsed', uid: 'player', abilityId: 'rgr_field_dressing' }]);
    expect(step(field, ability('rgr_rend'), content, profile).events[0]).toMatchObject({ t: 'actionRejected', reason: 'Rend can only be used in a fight' });
  });

  test('Field Dressing on the road cleanses Bleed and Poison at full HP, preserves other statuses and spends 10 MP', () => {
    const field = state({ abilities: ['rgr_field_dressing'] });
    field.player.statuses = [status('status_bleed', { tick: 2 }), status('status_poison', { tick: 3 }), status('status_weaken')];
    const out = act(field, ability('rgr_field_dressing'));
    expect(out.state.player.hp).toBe(field.player.hp);
    expect(out.state.player.mp).toBe(field.player.mp - 10);
    expect(out.state.player.statuses.map((st) => st.statusId)).toEqual(['status_weaken']);
    expect(ofType(out.events, 'statusExpired').map((e) => e.statusId)).toEqual(['status_bleed', 'status_poison']);
    expect(field.player.statuses).toHaveLength(3);
  });

  test('Snare Trap (trap): set out of combat, it springs when the next fight at that node opens — Stun on a non-boss, the intent cancelled', () => {
    const set = act(state({ abilities: ['rgr_snare_trap'] }), ability('rgr_snare_trap'));
    const ruins = set.state.world.currentLocationId;
    expect(set.state.world.locationStates[ruins]?.flags).toEqual({ [`${TRAP_FLAG}rgr_snare_trap`]: true });
    expect(set.state.player.mp).toBe(state().player.mp - 12);
    const ctx = scriptedCtx(set.state, [D.d4(4), D.d4(1), ...HIT()], content, profile);
    beginCombat(ctx, spec(one(SHADE)));
    runCombat(ctx);
    expect(ctx.rng.queue).toEqual([]);
    const c = ctx.s.combat!;
    expect(findStatus(c.enemies[0]!, 'status_stun')).toBeDefined();
    expect(c.intents[c.enemies[0]!.uid]).toBeUndefined();
    expect(c.log.map((l) => l.text)).toContain('Snare Trap springs under Corrupted Shade.');
    expect(ctx.s.world.locationStates[ruins]?.flags).toEqual({});
  });

  test("Hunter's Eye (foresight): for 3 turns the party sees each enemy's next-next move", () => {
    const s = fight(state({ abilities: ['rgr_hunters_eye'] }), one(BRUTE), { keepIntents: true });
    const brute = enemy(s);
    const read = { s, profile, content };
    expect(foreseenMove(read, s.combat!, brute)).toBe('brute_strike'); // strike (shown) → strike (next) → maul
    const out = act(s, ability('rgr_hunters_eye'), MISS); // the Brute's Strike misses; it commits to the second Strike
    expect(out.state.combat!.cooldowns[FORESIGHT_KEY]).toBe(3);
    expect(foresightActive(out.state.combat!)).toBe(true);
    expect(foreseenMove({ s: out.state, profile, content }, out.state.combat!, enemy(out.state))).toBe('brute_maul');
    expect(foresightActive(s.combat!)).toBe(false);
  });

  test('Pinning Shot: the hit, Slow, then the interrupt — the Brute\'s Strike is lost and it commits to its next step', () => {
    const s = fight(state({ abilities: ['rgr_pinning_shot'] }), one(BRUTE), { keepIntents: true });
    expect(enemy(s).pattern.pointer).toBe(1);
    const out = act(s, ability('rgr_pinning_shot', enemy(s).uid), [...HIT(), ...MISS]);
    expect(out.state.combat!.log.map((l) => l.text)).toContain("Wildling Brute's Strike is interrupted.");
    expect(findStatus(enemy(out.state), 'status_slow')).toBeDefined();
    expect(enemy(out.state).pattern.pointer).toBe(3); // the interrupt took step 1; its turn played step 2, its next is step 3
  });
});

// ---- Wizard --------------------------------------------------------------------------------------------------------------

describe('Wizard (DESIGN §5.3) through the reducer', () => {
  test('Fireball: 9 MP (staff −10 %), weak Fire × 1.5, Burn 60 % rolled after the hit (10 < 60), tick round(1 + 0.2·SP)', () => {
    const s = fight(state({ classId: 'wizard', abilities: ['wiz_fireball'] }), one(SHADE, 2));
    const out = act(s, ability('wiz_fireball', enemy(s).uid), [...HIT(), D.pct(10)]);
    expect(dealt(out.events)).toEqual([['wiz_fireball', 24]]); // (3 + 1.2 × 12) × 1.5 = 26.1 − 2 → 24
    expect(findStatus(enemy(out.state), 'status_burn')).toMatchObject({ tick: 3 });
    expect(me(out.state).mp).toBe(me(s).mp - 9 + 3); // and the next turn's regen (3 at L1)
    const noBurn = act(s, ability('wiz_fireball', enemy(s).uid), [...HIT(), D.pct(60)]);
    expect(findStatus(enemy(noBurn.state), 'status_burn')).toBeUndefined();
  });

  test('regen 3 + ⌊L/4⌋ MP at the start of each Wizard turn (D-066 #3): 6 at level 12', () => {
    const s = fight(state({ classId: 'wizard', level: 12, mp: 10 }), one(SHADE));
    expect(me(s).mp).toBe(16); // the first turn's regen
    const out = act(s, { type: 'guard' });
    expect(ofType(out.events, 'resourceGained').map((e) => [e.reason, e.amount])).toEqual([['guard', 5], ['turn_start', 6]]);
  });

  test('Lightning Bolt (chain): on a Soaked target it repeats at × 0.5 on the next enemy, which the Storm-on-Soaked spread has Shocked', () => {
    const s = patched(fight(state({ classId: 'wizard', abilities: ['wiz_lightning_bolt'] }), one(SHADE, 2)), (c) => void c.enemies[0]!.statuses.push(status('status_soaked', { duration: 3 })));
    const out = act(s, ability('wiz_lightning_bolt', enemy(s).uid), [...HIT(), ...HIT()]);
    // A: (4 + 1.7 × 12) × 1.5 = 36.6 − 2 → 35; B: 24.4 × 1.25 (Shock) × 0.5 = 15.25 − 2 → 13
    expect(ofType(out.events, 'damageDealt').map((e) => [e.targetUid, e.amount])).toEqual([[enemy(s, 0).uid, 35], [enemy(s, 1).uid, 13]]);
    expect(me(out.state).mp).toBe(me(s).mp - 12 + 3);
  });

  test('Pyre of the Nine: 10 % max HP self-cost (96 → 9), every enemy, Burn and Armor Break 100 %', () => {
    const s = fight(state({ classId: 'wizard', abilities: ['wiz_pyre_of_the_nine'] }), one(DUELIST, 2));
    const out = act(s, ability('wiz_pyre_of_the_nine'), [...HIT(), ...HIT()]);
    expect(me(s).hpMax).toBe(96);
    expect(me(out.state).hp).toBe(me(s).hp - 9);
    expect(dealt(out.events)).toEqual([['wiz_pyre_of_the_nine', 33], ['wiz_pyre_of_the_nine', 33]]); // 10 + 24 = 34 − 1
    for (const i of [0, 1]) expect([findStatus(enemy(out.state, i), 'status_burn'), findStatus(enemy(out.state, i), 'status_armor_break')].every(Boolean)).toBe(true);
  });

  test('Cinder Shield (shield): a 1.5·SP + 10 pool for 3 turns; Rewind (rewind special) snapshots the caster', () => {
    const s = fight(state({ classId: 'wizard', abilities: ['wiz_cinder_shield', 'wiz_rewind'] }), one(SHADE));
    const shielded = act(s, ability('wiz_cinder_shield'));
    expect(findStatus(me(shielded.state), 'status_shield')).toMatchObject({ tick: 28, duration: 3 });
    const hurt = patched(shielded.state, (c) => void ((c.party[0]!.hp = 40), (c.intents = {})));
    const rewound = act(hurt, ability('wiz_rewind'));
    expect(findStatus(me(rewound.state), 'status_rewind')).toMatchObject({ snapshotHp: 40, duration: 2 });
  });

  test('Stutter on a non-boss: Stun (its `when`), the intent cancelled; Concussive Slam on a boss: Weaken instead of Stun', () => {
    const s = fight(state({ classId: 'wizard', abilities: ['wiz_stutter'] }), one(DUELIST), { keepIntents: true });
    const out = act(s, ability('wiz_stutter', enemy(s).uid), HIT());
    expect(ofType(out.events, 'statusApplied').map((e) => e.statusId)).toEqual(['status_stun']);
    expect(out.state.combat!.log.map((l) => l.text)).toContain('Fixture Duelist is stunned and loses the turn.');
    const boss = fight(state({ classId: 'ironclad_warden', abilities: ['wrd_concussive_slam'] }), one(TYRANT), { over: { fleeable: false } });
    const slam = act(boss, ability('wrd_concussive_slam', enemy(boss).uid), HIT());
    expect(findStatus(enemy(slam.state), 'status_weaken')).toBeDefined();
    expect(findStatus(enemy(slam.state), 'status_stun')).toBeUndefined();
  });
});

// ---- Elf -----------------------------------------------------------------------------------------------------------------

describe('Elf (DESIGN §5.4) through the reducer', () => {
  test('Twin Strike: two hits, each its own hit, variance and crit roll; a crit gains +6 MP (Elf crit rule)', () => {
    const s = fight(state({ classId: 'elf', abilities: ['elf_twin_strike'] }), one(SHADE));
    const out = act(s, ability('elf_twin_strike', enemy(s).uid), [...HIT(), ...CRIT()]);
    expect(dealt(out.events)).toEqual([['elf_twin_strike', 6], ['elf_twin_strike', 10]]); // 7.15 − 1; 10.725 − 1
    expect(ofType(out.events, 'resourceGained')).toEqual([{ t: 'resourceGained', uid: me(s).uid, amount: 6, reason: 'crit' }]);
  });

  test('Ambush × 1.5 against a target that has not acted (or while Phased); not after it acted', () => {
    const s = fight(state({ classId: 'elf', abilities: ['elf_ambush'] }), one(DUELIST));
    expect(dealt(act(s, ability('elf_ambush', enemy(s).uid), HIT()).events)).toEqual([['elf_ambush', 25]]); // 17.6 × 1.5 − 1
    const acted = patched(s, (c) => void (c.enemies[0]!.pattern.turnsTaken = 1));
    expect(dealt(act(acted, ability('elf_ambush', enemy(s).uid), HIT()).events)).toEqual([['elf_ambush', 17]]);
    const phased = patched(acted, (c) => void c.party[0]!.statuses.push(status('status_phase', { duration: 1 })));
    expect(dealt(act(phased, ability('elf_ambush', enemy(s).uid), HIT()).events)).toEqual([['elf_ambush', 25]]);
  });

  test('Shadowstep (phase): the Shade\'s Rake passes through — no roll — and the Elf gains +10 MP (dodge)', () => {
    const s = fight(state({ classId: 'elf', abilities: ['elf_shadowstep'], mp: 20 }), one(SHADE), { keepIntents: true });
    const out = act(s, ability('elf_shadowstep'));
    expect(ofType(out.events, 'attackResolved')).toEqual([{ t: 'attackResolved', sourceUid: enemy(s).uid, targetUid: me(s).uid, hit: false, crit: false }]);
    expect(me(out.state).mp).toBe(20 - 6 + 10);
    expect(findStatus(me(out.state), 'status_phase')).toBeUndefined();
  });

  test('Ley Mend heals the companion by default (14 + 1.2·SP); Barkskin: Shield 12 + 1.4·SP and Regen 4 + 0.4·SP on the chosen ally', () => {
    const s = patched(fight(withIlyra({ classId: 'elf', abilities: ['elf_ley_mend', 'elf_barkskin'] }), one(SHADE)), (c) => void (c.party[1]!.hp = 40));
    const mend = act(s, ability('elf_ley_mend'), [D.variance(1), ...MISS]); // the heal's variance, then Ilyra's dart misses
    expect(ofType(mend.events, 'healed')).toEqual([{ t: 'healed', targetUid: ally(s).uid, amount: 22, source: 'elf_ley_mend' }]);
    const bark = act(quiet(mend.state), ability('elf_barkskin', me(s).uid), MISS);
    expect(findStatus(me(bark.state), 'status_shield')).toMatchObject({ tick: 22 });
    expect(findStatus(me(bark.state), 'status_regen')).toMatchObject({ tick: 7 });
  });

  test('Silverwood Bloom (cleanse, party): debuffs leave player and companion, Regen on both, Soaked on every enemy', () => {
    const s = patched(fight(withIlyra({ classId: 'elf', abilities: ['elf_silverwood_bloom'] }), one(SHADE, 2)), (c) => {
      c.party[0]!.statuses.push(status('status_weaken'), status('status_haste'));
      c.party[1]!.statuses.push(status('status_blind'));
    });
    const out = act(s, ability('elf_silverwood_bloom'), MISS);
    expect(me(out.state).statuses.map((st) => st.statusId).sort()).toEqual(['status_haste', 'status_regen']);
    expect(ally(out.state).statuses.map((st) => st.statusId)).toEqual(['status_regen']);
    for (const i of [0, 1]) expect(findStatus(enemy(out.state, i), 'status_soaked')).toBeDefined();
  });
});

// ---- Ironclad Warden ---------------------------------------------------------------------------------------------------------

describe('Ironclad Warden (DESIGN §5.5) through the reducer', () => {
  test('Iron Guard (guard): Guard at 65 % this round and +12 Grit; the Strike that lands 11 × 0.35 → 4, and +6 Grit for the hit', () => {
    const s = fight(state({ classId: 'ironclad_warden', abilities: ['wrd_iron_guard'], mp: 10 }), one(BRUTE), { keepIntents: true });
    const out = act(s, ability('wrd_iron_guard'), HIT());
    expect(dealt(out.events)).toEqual([['brute_strike', 4]]);
    expect(ofType(out.events, 'resourceGained').map((e) => [e.reason, e.amount])).toEqual([['wrd_iron_guard', 12], ['hit_taken', 6]]);
    expect(me(out.state).mp).toBe(10 - 6 + 12 + 6);
    expect(out.state.combat!.cooldowns).toEqual({}); // the 65 % Guard ended when the Warden's next turn began
  });

  test('Challenge: Taunt on every enemy (source = the Warden) and +4 Grit per enemy Taunted', () => {
    const s = fight(state({ classId: 'ironclad_warden', abilities: ['wrd_challenge'], mp: 10 }), one(SHADE, 2));
    const out = act(s, ability('wrd_challenge'));
    for (const i of [0, 1]) expect(findStatus(enemy(out.state, i), 'status_taunt')?.sourceUid).toBe(me(s).uid);
    expect(ofType(out.events, 'resourceGained').map((e) => [e.reason, e.amount])).toEqual([['taunt', 4], ['taunt', 4]]);
    expect(me(out.state).mp).toBe(10);
  });

  test("Crushing Blow → Executioner's Arc: Armor Break, then × 1.5 (bonus) × 1.15 (Physical on Armor Break) with armor ignored", () => {
    const s = fight(state({ classId: 'ironclad_warden', abilities: ['wrd_crushing_blow', 'wrd_executioners_arc'] }), [{ creatureId: BRUTE, count: 1 }, { creatureId: SHADE, count: 1 }]);
    const t1 = act(s, ability('wrd_crushing_blow', enemy(s).uid), HIT());
    expect(dealt(t1.events)).toEqual([['wrd_crushing_blow', 19]]); // 1.3 × 17 = 22.1 − 3
    const t2 = act(quiet(t1.state), ability('wrd_executioners_arc', enemy(s).uid), HIT());
    expect(dealt(t2.events)).toEqual([['wrd_executioners_arc', 47]]); // 27.2 × 1.15 × 1.5 = 46.92 → 47 (≥ the Brute's 45)
    expect(enemy(t2.state).alive).toBe(false);
  });

  test('Steady Breath: 10 + 0.6·ATK and the first negative status in its order (Burn before Weaken); Shield Wall shields the party', () => {
    const s = patched(fight(withIlyra({ classId: 'ironclad_warden', abilities: ['wrd_steady_breath', 'wrd_shield_wall'] }), one(SHADE)), (c) => {
      c.party[0]!.hp = 60;
      c.party[0]!.statuses.push(status('status_weaken'), status('status_burn', { tick: 2 }));
    });
    const breath = act(s, ability('wrd_steady_breath'), [D.variance(1), ...MISS]);
    expect(ofType(breath.events, 'healed')[0]).toMatchObject({ amount: 20 });
    expect(me(breath.state).statuses.map((st) => st.statusId)).toEqual(['status_weaken']);
    const wall = act(quiet(breath.state), ability('wrd_shield_wall'), MISS);
    expect([findStatus(me(wall.state), 'status_shield')?.tick, findStatus(ally(wall.state), 'status_shield')?.tick]).toEqual([38, 38]); // 18 + 1.2 × 17
  });
});

// ---- Shadow Weaver --------------------------------------------------------------------------------------------------------

describe('Shadow Weaver (DESIGN §5.6) through the reducer', () => {
  test('Siphon (drain): heals 50 % of the damage dealt', () => {
    const s = patched(fight(state({ classId: 'shadow_weaver', abilities: ['wvr_siphon'] }), one(DUELIST)), (c) => void (c.party[0]!.hp = 50));
    const out = act(s, ability('wvr_siphon', enemy(s).uid), HIT());
    expect(dealt(out.events)).toEqual([['wvr_siphon', 13]]);
    expect(ofType(out.events, 'healed')).toEqual([{ t: 'healed', targetUid: me(s).uid, amount: 7, source: 'wvr_siphon' }]);
  });

  test('Blood Pact (resource_convert): 15 % max HP for 30 % max MP, no MP cost; 2-turn cooldown', () => {
    const s = fight(state({ classId: 'shadow_weaver', abilities: ['wvr_blood_pact'], mp: 0 }), one(SHADE));
    const out = act(s, ability('wvr_blood_pact'));
    expect(me(out.state).hp).toBe(me(s).hp - 15); // 15 % of 102
    expect(me(out.state).mp).toBe(Math.floor(0.3 * me(s).mpMax));
    expect(out.state.combat!.cooldowns.wvr_blood_pact).toBe(2);
  });

  test('The Unmaking Word: 40 % of current HP; a kill returns the HP spent (unmaking) and 20 MP (onKill)', () => {
    const s = patched(fight(state({ classId: 'shadow_weaver', abilities: ['wvr_unmaking_word'] }), one(DUELIST, 2)), (c) => void (c.enemies[0]!.hp = 5));
    const out = act(s, ability('wvr_unmaking_word', enemy(s).uid), HIT());
    expect(enemy(out.state).alive).toBe(false);
    expect(me(out.state).hp).toBe(me(s).hp);
    expect(me(out.state).mp).toBe(me(s).mp - 30 + 20);
    const miss = act(s, ability('wvr_unmaking_word', enemy(s).uid), MISS);
    expect(me(miss.state).hp).toBe(me(s).hp - Math.floor(0.4 * me(s).hp));
  });

  test('Doom Sigil: written now, read after 3 of the target\'s turns — 3.0·SP at the start of its 4th (Void on a Cursed target: resist → neutral), Stun if Cursed then', () => {
    let s = patched(fight(state({ classId: 'shadow_weaver', abilities: ['wvr_doom_sigil'] }), one(DUELIST)), (c) => void c.enemies[0]!.statuses.push(status('status_curse', { duration: 9, tick: 4 })));
    const duelist = enemy(s).uid;
    s = act(s, ability('wvr_doom_sigil', duelist)).state;
    expect(Object.keys(enemy(s).cooldowns)).toEqual([`${DELAY_KEY}wvr_doom_sigil:${me(s).uid}`]);
    for (let i = 0; i < 3; i++) s = act(quiet(s), { type: 'guard' }, i === 2 ? [D.variance(1), D.pct(99)] : []).state;
    const hits = s.combat!.log.filter((l) => l.text === 'Doom Sigil is read on Fixture Duelist.');
    expect(hits).toHaveLength(1);
    expect(enemy(s).hp).toBe(60 - 4 * 4 - 35); // four Curse ticks, then 36 − ward 1
    expect(findStatus(enemy(s), 'status_stun')).toBeDefined();
    expect(enemy(s).cooldowns).toEqual({});
  });

  test('Unravel strips Shield, Regen, Rewind, Haste before the hit and deals × 1.5 if anything went; Collapse adds its missing-HP bonus', () => {
    const s = patched(fight(state({ classId: 'shadow_weaver', abilities: ['wvr_unravel', 'wvr_collapse'] }), one(DUELIST)), (c) =>
      void c.enemies[0]!.statuses.push(status('status_shield', { tick: 50 }), status('status_regen', { tick: 5 })),
    );
    const out = act(s, ability('wvr_unravel', enemy(s).uid), HIT());
    expect(dealt(out.events)).toEqual([['wvr_unravel', 19]]); // 13.2 × 1.5 − 1 = 18.8
    expect(enemy(out.state).statuses).toEqual([]);
    const bare = act(s, ability('wvr_unravel', enemy(s).uid), HIT());
    expect(dealt(bare.events)).toEqual([['wvr_unravel', 19]]);
    const plain = patched(s, (c) => void (c.enemies[0]!.statuses = []));
    expect(dealt(act(plain, ability('wvr_unravel', enemy(s).uid), HIT()).events)).toEqual([['wvr_unravel', 12]]);
    // Collapse at 80/102 HP: the 12 % cost (12) leaves 68 → 1/3 missing → × 1.333; 17.6 × 1.333 − 1 = 22.47 → 22
    const low = patched(plain, (c) => void (c.party[0]!.hp = 80));
    expect(dealt(act(low, ability('wvr_collapse'), HIT()).events)).toEqual([['wvr_collapse', 22]]);
    // capped at + 50 %: at 30 HP (18 after the cost) 17.6 × 1.5 − 1 = 25.4 → 25
    const lower = patched(plain, (c) => void (c.party[0]!.hp = 30));
    expect(dealt(act(lower, ability('wvr_collapse'), HIT()).events)).toEqual([['wvr_collapse', 25]]);
  });
});

// ---- the companion's signature, items -------------------------------------------------------------------------------------

describe("the companion's signature command (DESIGN §4.1 `C`, §4.9, D-066 #12)", () => {
  test("Ilyra's Archive Light on the player's action: Shield on both, both cleansed; no MP; a 4-turn cooldown in her turns", () => {
    const s = patched(fight(withIlyra(), one(SHADE)), (c) => void c.party[0]!.statuses.push(status('status_weaken')));
    const cmd: Action = { type: 'companionCommand', command: 'signature' };
    expect(signatureActions(content, s.combat!)).toEqual([cmd]);
    const out = act(s, cmd, MISS); // Ilyra still takes her own turn: her dart misses
    expect(ofType(out.events, 'abilityUsed')).toEqual([
      { t: 'abilityUsed', uid: ally(s).uid, abilityId: 'comp_ilyra_archive_light' },
      { t: 'abilityUsed', uid: ally(s).uid, abilityId: 'comp_ilyra_ley_dart' }, // her own turn (U28)
    ]);
    expect([findStatus(me(out.state), 'status_shield')?.tick, findStatus(ally(out.state), 'status_shield')?.tick]).toEqual([25, 25]);
    expect(findStatus(me(out.state), 'status_weaken')).toBeUndefined();
    expect(me(out.state).mp).toBe(me(s).mp);
    expect(ally(out.state).cooldowns.comp_ilyra_archive_light).toBe(3);
    expect(rejected(quiet(out.state), cmd)).toBe('Archive Light is recharging (3)');
    expect(rejected(s, { type: 'companionCommand', command: 'focus' })).toBe('Ilyra has no focus to clear'); // U28 defines focus/hold (D-078)
    const alone = fight(state(), one(SHADE));
    expect(rejected(alone, cmd)).toBe('You have no companion standing');
    expect(signatureActions(content, alone.combat!)).toEqual([]);
    const stunned = patched(s, (c) => void c.party[1]!.statuses.push(status('status_stun', { duration: 1 })));
    expect(rejected(stunned, cmd)).toBe('Ilyra is stunned');
  });
});

describe('combat items (DESIGN §7.9)', () => {
  test('a Tonic is the turn\'s action: +25 HP and +15 MP on the player, one used; on the companion, HP only', () => {
    const s = patched(fight(withIlyra(), one(SHADE)), (c) => void ((c.party[0]!.hp = 50), (c.party[0]!.mp = 10), (c.party[1]!.hp = 30)));
    const tonic = s.player.inventory.find((i) => i.itemId === 'item_ley_touched_tonic')!;
    expect(combatItemActions(s, content, s.combat!)).toEqual([
      { type: 'item', uid: tonic.uid },
      { type: 'item', uid: tonic.uid, targetUid: ally(s).uid },
    ]);
    const out = act(s, { type: 'item', uid: tonic.uid }, MISS);
    expect(me(out.state)).toMatchObject({ hp: 75, mp: 25 });
    expect(out.state.player.inventory.find((i) => i.uid === tonic.uid)?.qty).toBe(1);
    expect(ofType(out.events, 'itemLost')).toEqual([{ t: 'itemLost', itemId: 'item_ley_touched_tonic', qty: 1, reason: 'used' }]);
    const onIlyra = act(s, { type: 'item', uid: tonic.uid, targetUid: ally(s).uid }, MISS);
    expect([ally(onIlyra.state).hp, me(onIlyra.state).mp]).toEqual([55, 10]);
    expect(combatItemProblem(s, content, s.combat!, { type: 'item', uid: tonic.uid, targetUid: enemy(s).uid })).toBe(`'${enemy(s).uid}' is not one of your party`);
  });

  test('an Ember Flask unleashes its ability (Fire 25 + Burn) on the chosen enemy; a Dark Spellbook cannot be read in a fight', () => {
    const s = fight(state({ items: ['item_ember_flask', 'item_dark_spellbook'] }), one(DUELIST, 2));
    const flask = s.player.inventory.find((i) => i.itemId === 'item_ember_flask')!;
    const book = s.player.inventory.find((i) => i.itemId === 'item_dark_spellbook')!;
    expect(combatItemActions(s, content, s.combat!).filter((a) => a.uid === flask.uid).map((a) => a.targetUid)).toEqual([enemy(s, 0).uid, enemy(s, 1).uid]);
    expect(rejected(s, { type: 'item', uid: book.uid })).toBe('Dark Spellbook cannot be used in a fight');
    expect(rejected(s, { type: 'item', uid: 'nope' })).toBe('You are not carrying that');
    const out = act(s, { type: 'item', uid: flask.uid, targetUid: enemy(s, 1).uid }, HIT());
    expect(ofType(out.events, 'damageDealt').map((e) => [e.targetUid, e.amount, e.kind, e.refId])).toEqual([[enemy(s, 1).uid, 24, 'item', 'itm_ember_flask']]);
    expect(findStatus(enemy(out.state, 1), 'status_burn')).toBeDefined();
    expect(out.state.player.inventory.some((i) => i.uid === flask.uid)).toBe(false);
    expect(out.state.counters.custom.flasks_thrown).toBe(1);
  });
});

// ---- fields no DESIGN fixture row uses ------------------------------------------------------------------------------------

describe('the remaining ability fields, on patched records', () => {
  const variant = (id: string, edit: Record<string, unknown>) => ({ ...content, abilities: { ...content.abilities, [id]: { ...content.abilities[id]!, ...edit } } });
  const run = (pack: typeof content, s: GameState, a: Action, draws: number[]) => {
    const out = scriptedStep(s, a, draws, pack, profile);
    expect([out.rejected, out.left]).toEqual([null, 0]);
    return out;
  };

  test('selfCost.hpPerHit is paid per hit while it leaves at least 1 HP; the hits stop when it cannot be paid', () => {
    const pack = variant('elf_twin_strike', { selfCost: { hpPerHit: 3 } });
    const s = patched(fight(state({ classId: 'elf', abilities: ['elf_twin_strike'] }), one(SHADE)), (c) => void (c.party[0]!.hp = 5));
    const out = run(pack, s, ability('elf_twin_strike', enemy(s).uid), HIT());
    expect(me(out.state).hp).toBe(2);
    expect(ofType(out.events, 'attackResolved')).toHaveLength(1);
  });

  test("onKill.refundHp 'spent' returns the HP paid without the unmaking special; a scripted Guard value guards on its own", () => {
    const pack = variant('wvr_void_lance', { onKill: { refundHp: 'spent' } });
    const s = patched(fight(state({ classId: 'shadow_weaver', abilities: ['wvr_void_lance'] }), one(DUELIST, 2)), (c) => void (c.enemies[0]!.hp = 3));
    const out = run(pack, s, ability('wvr_void_lance', enemy(s).uid), HIT());
    expect(me(out.state).hp).toBe(me(s).hp);
    expect(ofType(out.events, 'healed')).toEqual([{ t: 'healed', targetUid: me(s).uid, amount: 8, source: 'wvr_void_lance' }]);
    const plain = variant('wrd_iron_guard', { special: undefined, statuses: [{ status: 'status_haste', chance: 1, stacks: 1, duration: 1, target: 'target' }] });
    const w = fight(state({ classId: 'ironclad_warden', abilities: ['wrd_iron_guard'] }), one(SHADE));
    const guarded = scriptedStep(w, ability('wrd_iron_guard'), [], plain, profile);
    expect(ofType(guarded.events, 'guarded')).toEqual([{ t: 'guarded', uid: me(w).uid }]);
  });

  test("a consumable's `damage` hurts the player, never below 1 HP; foresight reads branches at the turn after next", () => {
    const tonic = content.items.item_ley_touched_tonic!;
    const pack = { ...content, items: { ...content.items, item_ley_touched_tonic: { ...tonic, onUse: [{ damage: { hp: 500 } }, { setFlag: 'flag_bitter' as const }] } } };
    const s = fight(state(), one(SHADE));
    const uid = s.player.inventory.find((i) => i.itemId === 'item_ley_touched_tonic')!.uid;
    const out = run(pack, s, { type: 'item', uid }, []);
    expect([me(out.state).hp, out.state.flags.flag_bitter]).toEqual([1, true]);
    const brute = patched(fight(state(), one(BRUTE)), (c) => void (c.enemies[0]!.pattern.pointer = 3));
    expect(foreseenMove({ s: brute, profile, content }, brute.combat!, enemy(brute))).toBe('brute_strike');
    const hurt = patched(brute, (c) => void (c.enemies[0]!.hp = 10));
    expect(foreseenMove({ s: hurt, profile, content }, hurt.combat!, enemy(hurt))).toBe('brute_root_knit');
  });
});

// ---- legality --------------------------------------------------------------------------------------------------------------

describe("legalActions ⇔ step for U26's actions", () => {
  test('every listed ability, item, flee and command is accepted, for each class', () => {
    const cases: GameState[] = [
      fight(withIlyra({ abilities: ['rgr_marked_shot', 'rgr_field_dressing', 'rgr_smoke_bomb', 'rgr_riposte_stance'], items: ['item_ember_flask'] }), one(SHADE, 2)),
      fight(state({ classId: 'wizard', abilities: ['wiz_fireball', 'wiz_flame_wave', 'wiz_rewind'] }), one(BRUTE)),
      fight(state({ classId: 'elf', abilities: ['elf_twin_strike', 'elf_ley_mend', 'elf_veilwalk'] }), one(SHADE)),
      fight(state({ classId: 'ironclad_warden', abilities: ['wrd_iron_guard', 'wrd_challenge', 'wrd_shield_wall'] }), one(DUELIST)),
      fight(state({ classId: 'shadow_weaver', abilities: ['wvr_siphon', 'wvr_blood_pact', 'wvr_doom_sigil'], mp: 4 }), one(SHADE)),
    ];
    for (const s of cases) {
      const listed = legalActions(s, content, profile).filter((a) => ['ability', 'item', 'flee', 'companionCommand'].includes(a.type));
      expect(listed.length).toBeGreaterThan(2);
      for (const a of listed) expect(step(s, a, content, profile).events.find((e) => e.t === 'actionRejected')).toBeUndefined();
    }
  });

  test('nothing is listed outside the player\'s turn; a status that blocks abilities, items or Guard blocks them (blockActions)', () => {
    const s = fight(state({ abilities: ['rgr_rend'] }), one(SHADE));
    const theirs = patched(s, (c) => void (c.phase = 'enemyTurn'));
    expect(legalActions(theirs, content, profile)).toEqual([]);
    expect(rejected(theirs, ability('rgr_rend'))).toBe('it is not your turn');
    const blockAll = combatPack();
    const statusDef = blockAll.statuses.status_blind!;
    const blocking = { ...blockAll, statuses: { ...blockAll.statuses, status_blind: { ...statusDef, modifiers: { ...statusDef.modifiers, blockActions: ['ability', 'item', 'guard'] as ('ability' | 'item' | 'guard')[] } } } };
    const blind = patched(s, (c) => void c.party[0]!.statuses.push(status('status_blind')));
    expect(legalActions(blind, blocking, profile).map((a) => a.type).sort()).toEqual(['attack', 'flee']);
    const why = (a: Action) => scriptedStep(blind, a, [], blocking, profile).rejected;
    expect([why(ability('rgr_rend')), why({ type: 'guard' }), why({ type: 'item', uid: s.player.inventory[0]!.uid })]).toEqual(['You cannot use abilities now', 'You cannot guard now', 'You cannot use items now']);
    expect(roundHalfUp(2.5)).toBe(3);
  });
});
