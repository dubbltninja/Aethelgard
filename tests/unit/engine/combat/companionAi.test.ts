// U28: companions (DESIGN §4.9, §12; PLAN §8.1 "companion AI"; D-053, D-059, D-066 #5/#12, D-068.2, D-072, D-078).
// `companionAct` per stance with cooldown readiness (no MP) — every rule of DESIGN §4.9's pseudocode as a decision row —
// then turns through the real reducer: a fight per stance played to the end, the signature on the player's action
// (self-cost, loyalty cooldown cut), the free orders (focus, hold) and stance changes, KO → camp revive, revive at a
// share, Trusted, max HP by level, Dask's places (flickers out on unflagged nodes, rejoins on flagged / infected ones,
// never at fight setup where he cannot stand), swapping, and legalActions ⇔ step for every companion action.
import { describe, expect, test } from 'bun:test';
import {
  FLICKERED_FLAG,
  FOCUS_TAG,
  HOLD_TAG,
  ORDER_KEY,
  STANCE_SET_KEY,
  TRUSTED_MULT,
  applyHit,
  beginCombat,
  commandActions,
  companionAct,
  companionAllowedAt,
  companionHpMax,
  companionTurn,
  damageRange,
  incomingDamage,
  legalActions,
  playerOf,
  resolveHeal,
  reviveCompanion,
  runCombat,
  step,
  strikeSpec,
  type Action,
  type CombatState,
  type Combatant,
  type CompanionMove,
  type CompanionRunState,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type Intent,
  type Stance,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';
import { CONTAINED, D, SHADE, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';
// A lone Shade's victory rolls (as in reducers/combat.test.ts): gold 9 (7–12), then Shadow Ash (80 %).
const SHADE_SPOILS = [D.int(9, 7, 12), D.yes];
import { companionPack } from '@tests/fixtures/companionContent';

const content = companionPack();
const profile = freshProfile();
const RUINS = 'loc_whispering_ruins';
const LIBRARY = 'loc_shattered_library';
const PLAZA = 'loc_silverwood_plaza';
const GLOWLANDS = 'loc_veridian_glowlands';
const NEXUS = 'loc_chronos_nexus';

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });

/** A recruited companion's run record at level 1, full HP, Guarded. */
function runOf(id: string, over: Partial<CompanionRunState> = {}): CompanionRunState {
  const hp = content.companions[id]!.stats.hp;
  return { id, recruited: true, loyalty: 0, hp, hpMax: hp, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {}, ...over };
}
/** A state with `id` recruited and active in `stance` (and anything else `o` says). */
function withCompanion(id: string, stance: Stance = 'guarded', o: StateOverrides = {}, over: Partial<CompanionRunState> = {}): GameState {
  return makeState(
    {
      ...o,
      patch: (st) => {
        st.companions.recruited[id] = runOf(id, { stance, ...over });
        st.companions.activeId = id;
        o.patch?.(st);
      },
    },
    { content },
  );
}
const spec = (groups: EncounterSpec['groups']): EncounterSpec => ({
  id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [],
});
const one = (creatureId: string, count = 1): EncounterSpec['groups'] => [{ creatureId, count }];

/** A landed hit with variance `v` and no crit; a miss. */
const HIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(99)];
const MISS = [D.pct(99)];

/**
 * A fight at the player's first turn: the player first (d4 4 → initiative 12), the companion next (d4 3), every enemy
 * last (d4 1). The enemies hold still: their intents are dropped (no enemy draws after the player acts).
 */
function fight(s: GameState, groups: EncounterSpec['groups']): GameState {
  const draws = [D.d4(4), ...(s.companions.activeId !== null ? [D.d4(3)] : []), ...groups.flatMap((g) => Array.from({ length: g.count }, () => D.d4(1)))];
  const ctx = scriptedCtx(s, draws, content, profile);
  beginCombat(ctx, spec(groups));
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  (ctx.s.combat as CombatState).intents = {};
  return ctx.s;
}
function patched(s: GameState, edit: (c: CombatState, s: GameState) => void): GameState {
  const out = clone(s);
  edit(out.combat as CombatState, out);
  return out;
}
function patchState(s: GameState, edit: (s: GameState) => void): GameState {
  const out = clone(s);
  edit(out);
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
const used = (events: readonly GameEvent[], uid: string): string[] => ofType(events, 'abilityUsed').filter((e) => e.uid === uid).map((e) => e.abilityId);
const intentAt = (target: Combatant, hi: number, over: Partial<Intent> = {}): Intent => ({ moveId: 'shade_rake', targetUid: target.uid, projected: [hi - 2, hi], hidden: false, text: '', tags: [], ...over });

/** The decision for the companion of `s`, as [ability id | 'strike' | 'guard' | 'wait', target uid]. */
function decide(s: GameState): [string, string | undefined] {
  const m: CompanionMove = companionAct({ s, content }, s.combat as CombatState, ally(s));
  if (m.kind === 'ability') return [m.ability.id, m.targetUid];
  if (m.kind === 'strike') return ['strike', m.targetUid];
  return [m.kind, undefined];
}

// ---- the decision rules -----------------------------------------------------------------------------------------------------

describe('companionAct — Aggressive (DESIGN §4.9)', () => {
  const brak = fight(withCompanion('brak', 'aggressive'), one(SHADE, 2));

  test('opens with its debuff on the first foe while no foe has its status', () => {
    expect(decide(brak)).toEqual(['comp_brak_shieldbreak', enemy(brak, 0).uid]);
  });

  test('once any foe carries the status (or the debuff recharges), the area attack against two or more foes', () => {
    expect(decide(patched(brak, (c) => void c.enemies[1]!.statuses.push(status('status_armor_break'))))).toEqual(['comp_brak_cleave', undefined]);
    expect(decide(patched(brak, (c) => void (c.party[1]!.cooldowns.comp_brak_shieldbreak = 1)))).toEqual(['comp_brak_cleave', undefined]);
  });

  test('else its attack on a Marked foe, else the lowest current HP (slot order on ties)', () => {
    const both = (c: CombatState) => void (c.party[1]!.cooldowns = { comp_brak_shieldbreak: 1, comp_brak_cleave: 1 });
    expect(decide(patched(brak, both))).toEqual(['comp_brak_axe', enemy(brak, 0).uid]);
    expect(decide(patched(brak, (c) => void (both(c), (c.enemies[1]!.hp = 20))))).toEqual(['comp_brak_axe', enemy(brak, 1).uid]);
    const marked = patched(brak, (c) => void (both(c), (c.enemies[1]!.hp = 20), c.enemies[0]!.statuses.push(status('status_mark'))));
    expect(decide(marked)).toEqual(['comp_brak_axe', enemy(brak, 0).uid]);
    // one foe left: no area attack
    const alone = patched(brak, (c) => void ((c.enemies[1]!.alive = false), c.enemies[0]!.statuses.push(status('status_armor_break'))));
    expect(decide(alone)).toEqual(['comp_brak_axe', enemy(brak, 0).uid]);
  });

  test('a foe immune to the debuff does not count as open; an attack that cannot be used becomes the plain strike', () => {
    const dask = beginOnly(withCompanion('dask', 'aggressive', { locationId: NEXUS }), one(CONTAINED)); // Tyrant: immune to Slow
    expect(decide(dask)).toEqual(['comp_dask_flicker_strike', enemy(dask).uid]);
    const noAxe = patched(brak, (c) => void (c.party[1]!.cooldowns = { comp_brak_shieldbreak: 1, comp_brak_cleave: 1, comp_brak_axe: 1 }));
    expect(decide(noAxe)).toEqual(['strike', enemy(brak, 0).uid]);
    expect(strikeSpec(content, 'brak')).toEqual({ source: 'basic', type: 'physical', base: 0, coef: 1, stat: 'atk' });
    expect(strikeSpec(content, 'nobody').type).toBe('physical');
  });
});

/** Setup only (no turns played): for decisions where the companion would act before the player. */
function beginOnly(s: GameState, groups: EncounterSpec['groups']): GameState {
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(3), ...groups.flatMap((g) => Array.from({ length: g.count }, () => D.d4(1)))], content, profile);
  beginCombat(ctx, spec(groups));
  return ctx.s;
}

describe('companionAct — Guarded (DESIGN §4.9)', () => {
  const ilyra = fight(withCompanion('ilyra'), one(SHADE, 2));
  const hurt = (pct: number) => (c: CombatState) => void (c.party[0]!.hp = Math.floor(c.party[0]!.hpMax * pct));

  test('its heal on the player below 40 % HP; not at 40 %', () => {
    expect(decide(patched(ilyra, hurt(0.39)))).toEqual(['comp_ilyra_mend', me(ilyra).uid]);
    expect(decide(patched(ilyra, (c) => void (c.party[0]!.hp = 0.4 * c.party[0]!.hpMax)))).toEqual(['comp_ilyra_ley_dart', enemy(ilyra, 0).uid]);
  });

  test('Guard below 35 % of its own HP (the heal recharging), then its attack on the lowest-HP foe', () => {
    const low = patched(ilyra, (c) => void (hurt(0.3)(c), (c.party[1]!.hp = 20), (c.party[1]!.cooldowns.comp_ilyra_mend = 2)));
    expect(decide(low)).toEqual(['guard', undefined]);
    expect(decide(patched(ilyra, (c) => void (c.enemies[1]!.hp = 5)))).toEqual(['comp_ilyra_ley_dart', enemy(ilyra, 1).uid]);
  });

  test('its shield on an unshielded player when the visible intents aimed at them reach 30 % of max HP', () => {
    const third = Math.ceil(0.3 * me(ilyra).hpMax);
    const heavy = patched(ilyra, (c) => void ((c.intents[c.enemies[0]!.uid] = intentAt(c.party[0]!, third - 10)), (c.intents[c.enemies[1]!.uid] = intentAt(c.party[0]!, 10, { tags: ['ALL'], targetUid: null }))));
    expect(incomingDamage(heavy.combat!, me(heavy))).toBe(third);
    expect(decide(heavy)).toEqual(['comp_ilyra_ward', me(ilyra).uid]);
    expect(decide(patched(heavy, (c) => void c.party[0]!.statuses.push(status('status_shield', { tick: 10 }))))[0]).toBe('comp_ilyra_ley_dart');
    // a hidden intent is not counted (the companion reacts to what the player sees), nor one aimed at the companion
    const hidden = patched(heavy, (c) => void (c.intents[c.enemies[0]!.uid]!.hidden = true));
    expect(decide(hidden)[0]).toBe('comp_ilyra_ley_dart');
    const atHer = patched(heavy, (c) => void (c.intents[c.enemies[0]!.uid]!.targetUid = c.party[1]!.uid));
    expect(incomingDamage(atHer.combat!, me(atHer))).toBe(10);
  });

  test("a heal that cannot reach the player (Nyx's Drink heals Nyx) is not used for them", () => {
    const nyx = fight(withCompanion('nyx'), one(SHADE));
    expect(decide(patched(nyx, hurt(0.2)))).toEqual(['comp_nyx_void_needle', enemy(nyx).uid]);
  });
});

describe('companionAct — Support (DESIGN §4.9)', () => {
  const mireya = fight(withCompanion('mireya', 'support'), one(SHADE, 2));

  test('its heal on the lower (by HP %) of the player and itself, below 60 %', () => {
    expect(decide(patched(mireya, (c) => void (c.party[0]!.hp = Math.floor(0.5 * c.party[0]!.hpMax))))).toEqual(['comp_mireya_glowsalve', me(mireya).uid]);
    const herself = patched(mireya, (c) => void ((c.party[0]!.hp = Math.floor(0.55 * c.party[0]!.hpMax)), (c.party[1]!.hp = Math.floor(0.5 * c.party[1]!.hpMax))));
    expect(decide(herself)).toEqual(['comp_mireya_glowsalve', ally(mireya).uid]);
  });

  test('then its debuff on the first foe (an area debuff takes no target), then its attack on the lowest-HP foe', () => {
    expect(decide(mireya)).toEqual(['comp_mireya_spore_cloud', undefined]);
    const spent = patched(mireya, (c) => void ((c.party[1]!.cooldowns.comp_mireya_spore_cloud = 1), (c.enemies[1]!.hp = 9)));
    expect(decide(spent)).toEqual(['comp_mireya_lantern_light', enemy(mireya, 1).uid]);
  });

  test('its cleanse on a player carrying a debuff (a buff does not count)', () => {
    const pack = companionPack({ cleanse: true });
    const s = (() => {
      const ctx = scriptedCtx(withCompanion('mireya', 'support', {}, {}), [D.d4(4), D.d4(3), D.d4(1)], pack, profile);
      beginCombat(ctx, spec(one(SHADE)));
      return ctx.s;
    })();
    const pick = (st: GameState) => companionAct({ s: st, content: pack }, st.combat!, ally(st));
    expect(pick(patched(s, (c) => void c.party[0]!.statuses.push(status('status_weaken'))))).toMatchObject({ kind: 'ability', ability: { id: 'comp_mireya_cleansing_reed' }, targetUid: me(s).uid });
    expect(pick(patched(s, (c) => void c.party[0]!.statuses.push(status('status_haste'))))).toMatchObject({ ability: { id: 'comp_mireya_lantern_light' } });
  });

  test('its shield on an unshielded player, then its buff on the player if they lack its status (Caelum)', () => {
    const caelum = fight(withCompanion('caelum', 'support'), one(SHADE));
    expect(decide(caelum)).toEqual(['comp_caelum_foresight', me(caelum).uid]);
    const shielded = patched(caelum, (c) => void c.party[0]!.statuses.push(status('status_shield', { tick: 5 })));
    expect(decide(shielded)).toEqual(['comp_caelum_haste', me(caelum).uid]);
    expect(decide(patched(shielded, (c) => void c.party[0]!.statuses.push(status('status_haste'))))).toEqual(['comp_caelum_chrono_shard', enemy(caelum).uid]);
  });

  test('its utility when nothing better is ready (Dask: Stall, then Glimpse, then Flicker Strike)', () => {
    const dask = beginOnly(withCompanion('dask', 'support', { locationId: NEXUS }), one(SHADE));
    expect(decide(dask)).toEqual(['comp_dask_stall', enemy(dask).uid]);
    const stalled = patched(dask, (c) => void (c.party[1]!.cooldowns.comp_dask_stall = 1));
    expect(decide(stalled)).toEqual(['comp_dask_glimpse', undefined]);
    expect(decide(patched(stalled, (c) => void (c.party[1]!.cooldowns.comp_dask_glimpse = 2)))).toEqual(['comp_dask_flicker_strike', enemy(dask).uid]);
  });

  test("a drain heal is aimed at a foe and only when the drinker is the low one (Nyx); else its debuff", () => {
    const nyx = fight(withCompanion('nyx', 'support'), one(SHADE, 2));
    const thirsty = patched(nyx, (c) => void ((c.party[1]!.hp = 30), (c.enemies[1]!.hp = 9)));
    expect(decide(thirsty)).toEqual(['comp_nyx_drink', enemy(nyx, 1).uid]);
    expect(decide(patched(nyx, (c) => void (c.party[0]!.hp = 20)))).toEqual(['comp_nyx_hex', enemy(nyx, 0).uid]);
  });
});

describe('orders in the decision (D-078): focus, hold; no foe left', () => {
  const brak = fight(withCompanion('brak', 'aggressive'), one(SHADE, 2));
  const tag = (c: CombatState, t: string) => void c.party[1]!.pattern.firedOnce.push(t);

  test('hold: it Guards instead of acting, whatever the stance', () => {
    expect(decide(patched(brak, (c) => tag(c, HOLD_TAG)))).toEqual(['guard', undefined]);
  });

  test('focus: its single-target picks go to the focused enemy while it stands (the debuff only if it is open there)', () => {
    const b = enemy(brak, 1).uid;
    const focused = patched(brak, (c) => tag(c, `${FOCUS_TAG}${b}`));
    expect(decide(focused)).toEqual(['comp_brak_shieldbreak', b]);
    const later = patched(focused, (c) => void (c.party[1]!.cooldowns = { comp_brak_shieldbreak: 1, comp_brak_cleave: 1 }));
    expect(decide(later)).toEqual(['comp_brak_axe', b]);
    const covered = patched(focused, (c) => void c.enemies[1]!.statuses.push(status('status_armor_break')));
    expect(decide(covered)).toEqual(['comp_brak_cleave', undefined]);
    expect(decide(patched(later, (c) => void (c.enemies[1]!.alive = false)))).toEqual(['comp_brak_axe', enemy(brak, 0).uid]);
    const ilyra = fight(withCompanion('ilyra', 'support'), one(SHADE, 2));
    expect(decide(patched(ilyra, (c) => tag(c, `${FOCUS_TAG}${enemy(ilyra, 1).uid}`)))).toEqual(['comp_ilyra_ward', me(ilyra).uid]);
  });

  test('with no foe standing it waits', () => {
    const empty = patched(brak, (c) => void c.enemies.forEach((e) => (e.alive = false)));
    expect(decide(empty)).toEqual(['wait', undefined]);
    const ctx = scriptedCtx(empty, [], content, profile);
    const combat = ctx.s.combat as CombatState;
    expect(companionTurn({ applyHit, gainResource: () => 0, addMp: () => 0 }, ctx, combat, combat.party[1]!).kind).toBe('wait');
    expect(combat.log.at(-1)?.text).toBe('Brak waits (no one left to fight).');
  });
});

// ---- turns through the reducer ----------------------------------------------------------------------------------------------

describe('the companion turn through the reducer (cooldowns in its own turns, no MP)', () => {
  test("Brak: Shieldbreak (cooldown 2 of his turns), then Cleave; the cooldowns count down only on his turns", () => {
    const s0 = fight(withCompanion('brak', 'aggressive'), one(SHADE, 2));
    const r1 = act(quiet(s0), { type: 'guard' }, HIT()); // Shieldbreak: hit, variance, crit; Armor Break 100 % draws nothing
    const brakUid = ally(s0).uid;
    expect(used(r1.events, brakUid)).toEqual(['comp_brak_shieldbreak']);
    expect(enemy(r1.state, 0).statuses.map((st) => st.statusId)).toEqual(['status_armor_break']);
    expect(ally(r1.state)).toMatchObject({ mp: 0, mpMax: 0, cooldowns: { comp_brak_shieldbreak: 2 } });
    expect(r1.state.counters.abilitiesUsed.comp_brak_shieldbreak).toBe(1);
    expect(r1.state.combat!.log.some((l) => l.text.startsWith('Brak uses Shieldbreak ('))).toBe(true);
    const r2 = act(quiet(r1.state), { type: 'guard' }, [...HIT(), ...HIT()]); // Cleave on both
    expect(used(r2.events, brakUid)).toEqual(['comp_brak_cleave']);
    expect(ally(r2.state).cooldowns).toEqual({ comp_brak_shieldbreak: 1, comp_brak_cleave: 2 });
    const r3 = act(quiet(r2.state), { type: 'guard' }, HIT()); // both recharging, Armor Break still on A → the axe
    expect(used(r3.events, brakUid)).toEqual(['comp_brak_axe']);
    expect(ally(r3.state).cooldowns).toEqual({ comp_brak_cleave: 1 });
  });

  test('a plain strike when no attack ability is ready; a held companion Guards for one turn', () => {
    const s0 = fight(withCompanion('brak', 'aggressive'), one(SHADE));
    const noAxe = patched(s0, (c) => void (c.party[1]!.cooldowns = { comp_brak_shieldbreak: 2, comp_brak_axe: 2 }));
    const out = act(quiet(noAxe), { type: 'guard' }, HIT());
    expect(ofType(out.events, 'damageDealt').find((e) => e.sourceUid === ally(s0).uid)).toMatchObject({ kind: 'basic', refId: null, damageType: 'physical' });
    expect(out.state.counters.damageBySource['companion:brak']).toBeGreaterThan(0);
    const held = patched(s0, (c) => void c.party[1]!.pattern.firedOnce.push(HOLD_TAG));
    const g = act(quiet(held), { type: 'guard' });
    expect(ofType(g.events, 'guarded').map((e) => e.uid)).toEqual([me(s0).uid, ally(s0).uid]);
    expect(ally(g.state).pattern.firedOnce).toEqual([]); // a hold lasts one turn
  });
});

// ---- the player's commands ------------------------------------------------------------------------------------------------

describe('the signature on the player\'s action (DESIGN §4.1 `C`, D-053; §12.5; D-066 #5)', () => {
  const nyx = (over: Partial<CompanionRunState> = {}) => fight(withCompanion('nyx', 'guarded', {}, over), one(SHADE));
  const sig: Action = { type: 'companionCommand', command: 'signature' };

  test("it ends the player's turn; Nyx pays 10 % of her HP first; she still takes her own turn; cooldown 4 in her turns", () => {
    const s = nyx();
    const out = act(quiet(s), sig, [...HIT(), ...MISS]); // Unmaking hits the Shade; her own Needle misses
    expect(used(out.events, ally(s).uid)).toEqual(['comp_nyx_unmaking', 'comp_nyx_void_needle']);
    expect(ally(out.state).hp).toBe(90 - 9);
    expect(out.state.combat!.round).toBe(2); // the turn passed: back at the player's turn of round 2
    expect(ofType(out.events, 'turnStarted').map((e) => e.uid)).toEqual([ally(s).uid, enemy(s).uid, me(s).uid]);
    expect(ally(out.state).cooldowns.comp_nyx_unmaking).toBe(3);
    expect(rejected(quiet(out.state), sig)).toBe('Unmaking is recharging (3)');
  });

  test('loyalty ≥ 50 shortens the cooldown by one; a self-cost the companion cannot pay is "Not enough blood"', () => {
    const loyal = act(quiet(nyx({ loyalty: 50 })), sig, [...HIT(), ...MISS]);
    expect(ally(loyal.state).cooldowns.comp_nyx_unmaking).toBe(2);
    const faint = patched(nyx(), (c) => void (c.party[1]!.hp = 9));
    expect(rejected(faint, sig)).toBe('Not enough blood');
    expect(commandActions(content, faint.combat!).some((a) => a.command === 'signature')).toBe(false);
    expect(commandActions(content, nyx().combat!)).toContainEqual(sig);
  });

  test("Brak's Hold the Line: every foe Taunted onto him, a Shield on him", () => {
    const s = fight(withCompanion('brak'), one(SHADE, 2));
    const out = act(quiet(s), sig, HIT()); // then his own turn: the axe
    expect(enemy(out.state, 0).statuses.find((st) => st.statusId === 'status_taunt')?.sourceUid).toBe(ally(s).uid);
    expect(enemy(out.state, 1).statuses.map((st) => st.statusId)).toContain('status_taunt');
    expect(ally(out.state).statuses.find((st) => st.statusId === 'status_shield')?.tick).toBe(27); // 15 + 1.0·12
    expect(used(out.events, ally(s).uid)).toEqual(['comp_brak_hold_the_line', 'comp_brak_axe']);
  });
});

describe('orders (D-078): focus and hold are free, one per player turn', () => {
  const s = fight(withCompanion('ilyra'), one(SHADE, 2));
  const b = enemy(s, 1).uid;
  const focus = (targetUid?: string): Action => (targetUid === undefined ? { type: 'companionCommand', command: 'focus' } : { type: 'companionCommand', command: 'focus', targetUid });

  test("focus: the turn goes on; her next attack goes at the focused enemy although another is weaker; a second order waits for the next turn", () => {
    const weak = patched(s, (c) => void (c.enemies[0]!.hp = 5));
    const ordered = act(weak, focus(b));
    expect(ordered.state.combat).toMatchObject({ phase: 'playerTurn', turnIndex: weak.combat!.turnIndex, cooldowns: { [ORDER_KEY]: 1 } });
    expect(ally(ordered.state).pattern.firedOnce).toEqual([`${FOCUS_TAG}${b}`]);
    expect(ofType(ordered.events, 'turnStarted')).toEqual([]);
    expect(ofType(ordered.events, 'log').map((e) => e.text)).toEqual(['Ilyra turns on Corrupted Shade B.']);
    expect(rejected(ordered.state, { type: 'companionCommand', command: 'hold' })).toBe('Ilyra already has an order this turn');
    const next = act(quiet(ordered.state), { type: 'guard' }, HIT());
    expect(ofType(next.events, 'damageDealt').find((e) => e.sourceUid === ally(s).uid)?.targetUid).toBe(b);
    expect(next.state.combat!.cooldowns[ORDER_KEY]).toBeUndefined();
    // the next turn: clear it (focus without a target), or switch it; the same target again is refused
    expect(rejected(next.state, focus(b))).toBe('Ilyra is already focused on Corrupted Shade B');
    expect(ally(act(next.state, focus()).state).pattern.firedOnce).toEqual([]);
    expect(ally(act(next.state, focus(enemy(s, 0).uid)).state).pattern.firedOnce).toEqual([`${FOCUS_TAG}${enemy(s, 0).uid}`]);
  });

  test('refusals: no focus to clear, no such enemy, hold twice, a target on hold, no companion standing', () => {
    expect(rejected(s, focus())).toBe('Ilyra has no focus to clear');
    expect(rejected(s, focus('c99'))).toBe("There is no enemy 'c99' to focus");
    expect(rejected(s, { type: 'companionCommand', command: 'hold', targetUid: b })).toBe('Hold takes no target');
    const held = act(s, { type: 'companionCommand', command: 'hold' });
    expect(ally(held.state).pattern.firedOnce).toEqual([HOLD_TAG]);
    const holding = patched(held.state, (c) => void delete c.cooldowns[ORDER_KEY]);
    expect(rejected(holding, { type: 'companionCommand', command: 'hold' })).toBe('Ilyra is already holding');
    const down = patched(s, (c) => void (c.party[1]!.alive = false));
    expect(rejected(down, focus(b))).toBe('You have no companion standing');
    expect(commandActions(content, down.combat!)).toEqual([]);
  });

  test('every order and the signature are enumerated, and each is accepted (legalActions ⇔ step)', () => {
    const listed = legalActions(s, content, profile).filter((a) => a.type === 'companionCommand' || a.type === 'setStance');
    expect(listed).toEqual([
      { type: 'companionCommand', command: 'focus', targetUid: enemy(s, 0).uid },
      { type: 'companionCommand', command: 'focus', targetUid: b },
      { type: 'companionCommand', command: 'hold' },
      { type: 'companionCommand', command: 'signature' },
      { type: 'setStance', stance: 'aggressive' },
      { type: 'setStance', stance: 'support' },
    ]);
    for (const a of listed) expect(step(s, a, content, profile).events.find((e) => e.t === 'actionRejected')).toBeUndefined();
  });
});

describe('stance (DESIGN §4.1 free action, §12.2)', () => {
  test('in a fight: free and once per player turn; the companion acts on the new stance at once; mirrored on the player', () => {
    const s = fight(withCompanion('brak'), one(SHADE));
    const set = act(s, { type: 'setStance', stance: 'aggressive' });
    expect(set.state.companions.recruited.brak!.stance).toBe('aggressive');
    expect(set.state.player.stance).toBe('aggressive');
    expect(set.state.combat).toMatchObject({ phase: 'playerTurn', cooldowns: { [STANCE_SET_KEY]: 1 } });
    expect(rejected(set.state, { type: 'setStance', stance: 'support' })).toBe('The stance was already changed this turn');
    expect(rejected(s, { type: 'setStance', stance: 'guarded' })).toBe('The stance is already Guarded');
    expect(rejected(s, { type: 'setStance', stance: 'reckless' as Stance })).toBe("Unknown stance 'reckless'");
    const turn = act(quiet(set.state), { type: 'guard' }, HIT());
    expect(used(turn.events, ally(s).uid)).toEqual(['comp_brak_shieldbreak']);
    expect(legalActions(turn.state, content, profile).filter((a) => a.type === 'setStance')).toEqual([
      { type: 'setStance', stance: 'guarded' },
      { type: 'setStance', stance: 'support' },
    ]);
    expect(legalActions(patched(s, (c) => void (c.phase = 'enemyTurn')), content, profile).filter((a) => a.type === 'setStance')).toEqual([]);
  });

  test('outside a fight at any time, for the active companion; nothing to set without one', () => {
    const out = play(withCompanion('mireya'), [{ type: 'setStance', stance: 'support' }, { type: 'setStance', stance: 'aggressive' }], { content });
    expect(out.state.companions.recruited.mireya!.stance).toBe('aggressive');
    expect(ofType(out.events, 'log').map((e) => e.text)).toEqual(['Mireya takes the Support stance.', 'Mireya takes the Aggressive stance.']);
    const alone = makeState({}, { content });
    expect(step(alone, { type: 'setStance', stance: 'support' }, content, profile).events[0]).toMatchObject({ reason: 'You have no companion with you' });
    expect(legalActions(alone, content, profile).filter((a) => a.type === 'setStance')).toEqual([]);
  });
});

// ---- whole fights, one per stance (seeded rng, the real `step`) ------------------------------------------------------------------

/** Walks into the Library's two Shades and plays the fight out with `choose`; every action must be accepted. */
function battle(s0: GameState, choose: (s: GameState) => Action): { state: GameState; events: GameEvent[]; companion: string[] } {
  const start = play(s0, [{ type: 'move', to: LIBRARY }], { content });
  expect(start.state.mode).toBe('combat');
  const uid = start.state.combat!.party[1]!.uid;
  let cur = start.state;
  const events = [...start.events];
  for (let i = 0; i < 100 && cur.mode === 'combat'; i++) {
    const out = step(cur, choose(cur), content, profile);
    expect(out.events.find((e) => e.t === 'actionRejected')).toBeUndefined();
    events.push(...out.events);
    cur = out.state;
  }
  expect(ofType(events, 'combatEnded').map((e) => e.result)).toEqual(['victory']);
  const companion = events.flatMap((e) => (e.t === 'abilityUsed' && e.uid === uid ? [e.abilityId] : e.t === 'guarded' && e.uid === uid ? ['guard'] : []));
  return { state: cur, events, companion };
}
const attackFirst = (s: GameState): Action => ({ type: 'attack', targetUid: s.combat!.enemies.find((e) => e.alive && !e.fledOrGone)!.uid });
const guardOnly = (): Action => ({ type: 'guard' });

describe('a fight per stance through the reducer', () => {
  test('Aggressive (Brak, the player only guards): Shieldbreak, then Cleave on the pair, and he finishes them', () => {
    const { companion } = battle(withCompanion('brak', 'aggressive', { level: 5, locationId: 'loc_whispering_ruins' }), guardOnly);
    expect(companion.slice(0, 2)).toEqual(['comp_brak_shieldbreak', 'comp_brak_cleave']);
    expect(companion.every((id) => id.startsWith('comp_brak_'))).toBe(true);
  });

  test('Guarded (Ilyra, the player at 30 % HP): she mends the player first, then fights with Ley Dart', () => {
    const s = withCompanion('ilyra', 'guarded', { level: 5, locationId: 'loc_whispering_ruins', patch: (st) => void (st.player.hp = Math.floor(0.3 * st.player.hpMax)) });
    const { companion, state } = battle(s, attackFirst);
    expect(companion[0]).toBe('comp_ilyra_mend');
    expect(companion).toContain('comp_ilyra_ley_dart');
    expect(state.player.hp).toBeGreaterThan(Math.floor(0.3 * s.player.hpMax));
  });

  test('Support (Mireya, the player at half HP): Glowsalve on the player, Spore Cloud over the pair, Lantern Light', () => {
    const s = withCompanion('mireya', 'support', { level: 5, locationId: 'loc_whispering_ruins', patch: (st) => void (st.player.hp = Math.floor(0.5 * st.player.hpMax)) });
    const { companion, events } = battle(s, attackFirst);
    expect(companion[0]).toBe('comp_mireya_glowsalve');
    expect(companion).toContain('comp_mireya_spore_cloud');
    expect(companion).toContain('comp_mireya_lantern_light');
    expect(ofType(events, 'statusApplied').some((e) => e.statusId === 'status_blind')).toBe(true);
  });
});

// ---- KO and revive ------------------------------------------------------------------------------------------------------------

describe('KO → camp revive (DESIGN §4.9, §12.5–12.6)', () => {
  test('KO: out of the fight (−2 loyalty), out of the next fight, still down after a short rest, back at 50 % after a full one', () => {
    const s0 = fight(withCompanion('ilyra', 'guarded', { locationId: LIBRARY }, { loyalty: 10 }), one(SHADE));
    const aimed = patched(s0, (c) => void ((c.party[1]!.hp = 1), (c.intents[c.enemies[0]!.uid] = intentAt(c.party[1]!, 8))));
    const ko = act(aimed, { type: 'guard' }, HIT()); // Ilyra (1 HP) guards; the Shade's Rake drops her
    expect(ally(ko.state).alive).toBe(false);
    expect(ofType(ko.events, 'companionKo')).toEqual([{ t: 'companionKo', companionId: 'ilyra' }]);
    expect(ofType(ko.events, 'loyaltyChanged')).toEqual([{ t: 'loyaltyChanged', companionId: 'ilyra', delta: -2, value: 8 }]);
    expect(ko.state.mode).toBe('combat'); // a KO does not end the fight (DESIGN §4.7)
    expect(legalActions(ko.state, content, profile).filter((a) => a.type === 'companionCommand' || a.type === 'setStance')).toEqual([]);
    const won = act(patched(quiet(ko.state), (c) => void (c.enemies[0]!.hp = 1)), { type: 'attack', targetUid: enemy(s0).uid }, [...HIT(), ...SHADE_SPOILS]);
    expect(won.state.companions.recruited.ilyra).toMatchObject({ ko: true, hp: 0, loyalty: 8 });
    // the next fight starts without her (no initiative roll for her)
    const ctx = scriptedCtx(won.state, [D.d4(4), D.d4(1)], content, profile);
    beginCombat(ctx, spec(one(SHADE)));
    expect(ctx.s.combat!.party.map((c) => c.kind)).toEqual(['player']);
    const camp = play(won.state, [{ type: 'move', to: RUINS }, { type: 'rest', kind: 'short' }], { content });
    expect(camp.state.companions.recruited.ilyra).toMatchObject({ ko: true, hp: 0 });
    const full = play(patchState(camp.state, (st) => void ((st.companions.recruited.brak = runOf('brak', { dead: true, hp: 0, waitingAt: PLAZA })), (st.companions.recruited.nyx = runOf('nyx', { hp: 30, waitingAt: LIBRARY })))), [{ type: 'rest', kind: 'full' }], { content });
    expect(full.state.companions.recruited.ilyra).toMatchObject({ ko: false, hp: 40 });
    expect(full.state.companions.recruited.brak).toMatchObject({ dead: true, hp: 0 }); // the dead stay dead (story only)
    expect(full.state.companions.recruited.nyx!.hp).toBe(90); // a standing one heals like the player
    expect(ofType(full.events, 'log').map((e) => e.text)).toContain('Ilyra comes round by the fire (40 HP).');
  });

  test('reviveCompanion: in a fight she stands at the share and is in the next round\'s order; outside one, the active companion', () => {
    const s0 = fight(withCompanion('ilyra'), one(SHADE));
    const down = patched(s0, (c) => void ((c.party[1]!.alive = false), (c.party[1]!.hp = 0), c.party[1]!.statuses.push(status('status_weaken'))));
    const ctx = scriptedCtx(down, [], content, profile);
    expect(reviveCompanion(ctx, 0.3, 'item_lanternreed_salts')).toBe(true);
    expect(ally(ctx.s)).toMatchObject({ alive: true, hp: 24, statuses: [] });
    expect(ofType(ctx.events, 'healed')).toEqual([{ t: 'healed', targetUid: ally(s0).uid, amount: 24, source: 'item_lanternreed_salts' }]);
    expect(reviveCompanion(ctx, 0.3, 'again')).toBe(false);
    const next = act(quiet(ctx.s), { type: 'guard' }); // she has her turn again: at 30 %, Guarded, she guards
    expect(ofType(next.events, 'guarded').map((e) => e.uid)).toEqual([me(s0).uid, ally(s0).uid]);
    const out = scriptedCtx(withCompanion('ilyra', 'guarded', {}, { ko: true, hp: 0 }), [], content, profile);
    expect(reviveCompanion(out, 0.4, 'wrd_last_bastion')).toBe(true);
    expect(out.s.companions.recruited.ilyra).toMatchObject({ ko: false, hp: 32 });
    expect(reviveCompanion(out, 0.4, 'again')).toBe(false);
    const waiting = scriptedCtx(
      withCompanion('ilyra', 'guarded', { patch: (st) => void (st.companions.recruited.brak = runOf('brak', { ko: true, hp: 0, waitingAt: PLAZA })) }),
      [],
      content,
      profile,
    );
    expect(reviveCompanion(waiting, 0.3, 'item_lanternreed_salts')).toBe(true);
    expect(waiting.s.companions.recruited.brak).toMatchObject({ ko: false, hp: 39 });
  });
});

// ---- loyalty, levels -----------------------------------------------------------------------------------------------------------

describe('Trusted (loyalty ≥ 75: +10 % damage and healing, DESIGN §12.2) and max HP by level (§12.3)', () => {
  test('Trusted multiplies step 7 of its hits and its heals', () => {
    const s = fight(withCompanion('brak'), one(SHADE));
    const axe = { source: 'comp_brak_axe', type: 'physical' as const, base: 0, coef: 1.1, stat: 'atk' as const };
    expect(damageRange({ s, content }, ally(s), enemy(s), axe)).toEqual([11, 14]); // 13.2 × 0.9 / 1.1 − 1
    const trusted = patched(s, (_c, st) => void (st.companions.recruited.brak!.loyalty = 75));
    expect(damageRange({ s: trusted, content }, ally(trusted), enemy(trusted), axe)).toEqual([12, 15]); // × 1.1 before armor
    expect(TRUSTED_MULT).toBe(1.1);
    const m = fight(withCompanion('mireya', 'guarded', { hp: 50 }), one(SHADE));
    const salve = { base: 10, coef: 1.0, stat: 'sp' as const };
    expect(resolveHeal(scriptedCtx(m, [D.variance(1)], content, profile), ally(m), me(m), salve).amount).toBe(19);
    const loyal = patched(m, (_c, st) => void (st.companions.recruited.mireya!.loyalty = 80));
    expect(resolveHeal(scriptedCtx(loyal, [D.variance(1)], content, profile), ally(loyal), me(loyal), salve).amount).toBe(21);
  });

  test("max HP follows the player's level: at fight setup and after every step outside one (a KO'd one stays at 0)", () => {
    const def = content.companions.brak!;
    expect([companionHpMax(def, 1), companionHpMax(def, 5)]).toEqual([130, 170]);
    const s = withCompanion('brak', 'guarded', { level: 5 });
    const ctx = scriptedCtx(s, [D.d4(4), D.d4(3), D.d4(1)], content, profile);
    beginCombat(ctx, spec(one(SHADE)));
    expect(ctx.s.combat!.party[1]).toMatchObject({ hp: 170, hpMax: 170 });
    const looked = play(s, [{ type: 'examine', target: { kind: 'location' } }], { content });
    expect(looked.state.companions.recruited.brak).toMatchObject({ hp: 170, hpMax: 170 });
    const hurt = withCompanion('brak', 'guarded', { level: 5, patch: (st) => void (st.companions.recruited.ilyra = runOf('ilyra', { ko: true, hp: 0, waitingAt: RUINS })) }, { hp: 30 });
    const synced = play(hurt, [{ type: 'examine', target: { kind: 'location' } }], { content }).state.companions.recruited;
    expect([synced.brak!.hp, synced.brak!.hpMax, synced.ilyra!.hp, synced.ilyra!.hpMax]).toEqual([70, 170, 0, 104]);
  });
});

// ---- Dask's places (D-059, D-066 #12, D-068.2, DESIGN §12.8) ----------------------------------------------------------------------

describe("Dask: only where the location is temporally unstable or infected", () => {
  const atNexus = (o: StateOverrides = {}) => withCompanion('dask', 'guarded', { level: 12, locationId: NEXUS, ...o });

  test('the rule: flagged or Horde-infected locations only, for Dask alone', () => {
    const s = atNexus();
    expect([NEXUS, GLOWLANDS, RUINS].map((l) => companionAllowedAt(s, content, 'dask', l))).toEqual([true, false, false]);
    expect(companionAllowedAt(s, content, 'brak', GLOWLANDS)).toBe(true);
    const infected = atNexus({ patch: (st) => void (st.world.infected = [GLOWLANDS]) });
    expect(companionAllowedAt(infected, content, 'dask', GLOWLANDS)).toBe(true);
  });

  test('he flickers out on the Glowlands and rejoins at the Nexus — before its encounter rolls, so he fights there', () => {
    const away = play(atNexus(), [{ type: 'move', to: GLOWLANDS }], { content });
    expect(ofType(away.events, 'companionSwapped')).toEqual([{ t: 'companionSwapped', activeId: null }]);
    expect(ofType(away.events, 'log').map((e) => e.text)).toContain('Dask flickers and cannot follow.');
    expect(away.state.companions.activeId).toBeNull();
    expect(away.state.companions.recruited.dask).toMatchObject({ waitingAt: null, arcFlags: { [FLICKERED_FLAG]: true } });
    const back = play(away.state, [{ type: 'move', to: NEXUS }], { content });
    const order = back.events.map((e) => e.t).filter((t) => t === 'companionSwapped' || t === 'combatStarted');
    expect(order).toEqual(['companionSwapped', 'combatStarted']);
    expect(ofType(back.events, 'companionSwapped')).toEqual([{ t: 'companionSwapped', activeId: 'dask' }]);
    expect(back.state.companions.recruited.dask!.arcFlags).toEqual({});
    expect(back.state.combat!.party.map((c) => c.refId)).toEqual(['ranger', 'dask']);
  });

  test('an infected node keeps him; any step outside a fight applies the rule; fight setup never fields him where he cannot stand', () => {
    const infected = play(atNexus({ patch: (st) => void (st.world.infected = [GLOWLANDS]) }), [{ type: 'move', to: GLOWLANDS }], { content });
    expect(infected.state.companions.activeId).toBe('dask');
    expect(ofType(infected.events, 'companionSwapped')).toEqual([]);
    const stray = atNexus({ locationId: GLOWLANDS }); // placed there by hand: no arrival has run
    const ctx = scriptedCtx(stray, [D.d4(4), D.d4(1)], content, profile);
    beginCombat(ctx, spec(one(SHADE)));
    expect(ctx.s.combat!.party.map((c) => c.kind)).toEqual(['player']);
    const waited = play(stray, [{ type: 'wait' }], { content });
    expect(waited.state.companions.activeId).toBeNull();
    expect(waited.state.companions.recruited.dask!.arcFlags[FLICKERED_FLAG]).toBe(true);
  });

  test('no rejoin when someone took his place; a swap sends the flickered Dask home', () => {
    const away = play(atNexus({ patch: (st) => void (st.companions.recruited.mireya = runOf('mireya', { waitingAt: GLOWLANDS })) }), [{ type: 'move', to: GLOWLANDS }], { content });
    const swapped = play(away.state, [{ type: 'swapCompanion', companionId: 'mireya' }], { content });
    expect(swapped.state.companions.activeId).toBe('mireya');
    expect(swapped.state.companions.recruited.dask).toMatchObject({ waitingAt: NEXUS, arcFlags: {} });
    const back = play(swapped.state, [{ type: 'move', to: NEXUS }], { content });
    expect(back.state.companions.activeId).toBe('mireya');
    expect(back.state.combat!.party.map((c) => c.refId)).toEqual(['ranger', 'mireya']);
  });
});

// ---- swapping (DESIGN §12.1) ------------------------------------------------------------------------------------------------------

describe('swapCompanion: at a rest spot, or with the companion present; the one leaving waits at home', () => {
  const team = (o: StateOverrides = {}, active: Partial<CompanionRunState> = {}) =>
    withCompanion('ilyra', 'guarded', {
      ...o,
      patch: (st) => {
        st.companions.recruited.brak = runOf('brak', { waitingAt: PLAZA });
        st.companions.recruited.nyx = runOf('nyx', { waitingAt: LIBRARY });
        st.companions.recruited.dask = runOf('dask', { waitingAt: NEXUS });
        o.patch?.(st);
      },
    }, active);

  test('at the Ruins camp anyone may come (Dask cannot stand there); the enumerator lists exactly what step accepts', () => {
    const s = team({ locationId: RUINS });
    const listed = legalActions(s, content, profile).filter((a) => a.type === 'swapCompanion');
    expect(listed).toEqual([
      { type: 'swapCompanion', companionId: 'brak' },
      { type: 'swapCompanion', companionId: 'nyx' },
      { type: 'swapCompanion', companionId: null },
    ]);
    for (const a of listed) expect(step(s, a, content, profile).events.find((e) => e.t === 'actionRejected')).toBeUndefined();
    const out = play(s, [{ type: 'swapCompanion', companionId: 'brak' }], { content });
    expect(out.state.companions.activeId).toBe('brak');
    expect(out.state.companions.recruited.brak!.waitingAt).toBeNull();
    expect(out.state.companions.recruited.ilyra!.waitingAt).toBe(RUINS); // npc_ilyra's home
    expect(ofType(out.events, 'companionSwapped')).toEqual([{ t: 'companionSwapped', activeId: 'brak' }]);
    expect(step(s, { type: 'swapCompanion', companionId: 'dask' }, content, profile).events[0]).toMatchObject({ reason: 'Dask flickers and cannot follow.' });
    const alone = play(s, [{ type: 'swapCompanion', companionId: null }], { content });
    expect(alone.state.companions.activeId).toBeNull();
    expect(ofType(alone.events, 'log').map((e) => e.text)).toContain('You go on alone.');
    expect(step(alone.state, { type: 'swapCompanion', companionId: null }, content, profile).events[0]).toMatchObject({ reason: 'No one travels with you' });
  });

  test("away from a rest only a companion who is here; never a KO'd one out, nor a KO'd or unknown one in", () => {
    const s = team({ locationId: LIBRARY });
    const reason = (st: GameState, companionId: string | null) => (step(st, { type: 'swapCompanion', companionId }, content, profile).events[0] as { reason?: string }).reason;
    expect(legalActions(s, content, profile).filter((a) => a.type === 'swapCompanion').map((a) => a.companionId)).toEqual(['nyx', null]);
    expect(reason(s, 'brak')).toBe('Brak is not here (swap at a rest, or where they wait)');
    expect(reason(s, 'ilyra')).toBe('Ilyra is already with you');
    expect(reason(s, 'caelum')).toBe('Caelum is not one of your companions');
    const down = team({ locationId: LIBRARY }, { ko: true, hp: 0 });
    expect(reason(down, 'nyx')).toBe('Ilyra is down; they cannot be sent away until revived');
    const nyxDown = team({ locationId: LIBRARY, patch: (st) => void (st.companions.recruited.nyx = runOf('nyx', { waitingAt: LIBRARY, ko: true, hp: 0 })) });
    expect(reason(nyxDown, 'nyx')).toBe('Nyx is down');
  });
});
