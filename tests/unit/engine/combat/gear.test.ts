// U34b: gear passives and affix scripts in a fight (combat/gear.ts; DESIGN §7.3, §7.7, §4.3, §4.5; D-066 #5, D-083, D-085)
// — one block per brief ruling: what counts as "on hit" (1), statusOnHit (2), the Shadow-Kissed Dagger's curse (3),
// life steal (4), gear regen (5), the three affix scripts (6), Foresight (7), Horde Rising (8) and the event sources (9).
// Fixture items carry each passive; the real DESIGN §7.3 affixes (content/shared/affixes.ts) are rolled onto the combat
// pack's weapons and armor. Rolls are scripted (`scriptedStep`), so every test also pins its exact draw count.
import { describe, expect, test } from 'bun:test';
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import { affixes as designAffixes } from '@content/shared/affixes';
import type { AttunementInput } from '@schema/attunement';
import type { EncounterInput } from '@schema/encounter';
import type { ItemInput } from '@schema/item';
import type { LocationInput } from '@schema/location';
import type { ModifierInput } from '@schema/modifier';
import {
  CURSE_COST_LINE,
  ELITE_VARIANT_TAG,
  FORESIGHT_KEY,
  beginCombat,
  derive,
  encounterSpec,
  findStatus,
  foresightActive,
  gearPassives,
  gearReflect,
  gearStatusMults,
  hordeRising,
  hordeRisingChance,
  isPlayerDirectHit,
  playerOf,
  rollSpoils,
  runCombat,
  type Action,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type HitResult,
  type HitSpec,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState, play, type ItemSpec, type StateOverrides } from '@tests/fixtures/helpers';
import { BELL, BRUTE, D, DUELIST, MISTWOOD, SHADE, combatTables, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';

// ---- the pack -------------------------------------------------------------------------------------------------------------

const art = { icon: 'gear' };
const weapon = (id: ItemInput['id'], name: string, power: number, passives: ItemInput['passives'], extra: Partial<ItemInput> = {}): ItemInput => ({
  id, name, type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 2, description: `Fixture: ${name}.`, stats: { power }, passives, value: 50, art, ...extra,
});
const charm = (id: ItemInput['id'], name: string, passives: ItemInput['passives']): ItemInput => ({
  id, name, type: 'trinket', slot: 'trinket', tier: 1, description: `Fixture: ${name}.`, passives, value: 30, art,
});

/** DESIGN §7.7's two legacy passive weapons, and fixture gear carrying one passive each. */
const GEAR_ITEMS: ItemInput[] = [
  weapon('item_shadow_kissed_dagger', 'Shadow-Kissed Dagger', 7, [{ kind: 'curse', chance: 0.2, damage: 2 }], { legacyName: 'Shadow-Kissed Dagger', value: 75 }),
  weapon('item_necromancer_staff', 'Necromancer Staff', 4, [{ kind: 'mpCostReduction', pct: 0.2 }, { kind: 'lifeSteal', pct: 0.05 }], {
    weaponType: 'magic_staff', stats: { power: 4, spellPower: 3 }, legacyName: 'Necromancer Staff', value: 100,
  }),
  weapon('item_fixture_leech_blade', 'Leech Blade', 5, [{ kind: 'lifeSteal', pct: 0.5 }]),
  weapon('item_fixture_venom_fang', 'Venom Fang', 5, [{ kind: 'statusOnHit', status: 'status_poison', chance: 1, duration: 2 }]),
  charm('item_fixture_leech_charm', 'Leech Charm', [{ kind: 'lifeSteal', pct: 0.5 }]),
  charm('item_fixture_mending_charm', 'Mending Charm', [{ kind: 'regen', hp: 6, mp: 3 }]),
  charm('item_fixture_odd_charm', 'Odd Charm', [
    { kind: 'custom', scriptId: 'fixture_unknown_script', params: { pct: 1 } },
    { kind: 'custom', scriptId: 'basic_attack_rider', params: { damageType: 'plasma', pct: 0.5 } },
    { kind: 'custom', scriptId: 'reflect_melee', params: { damageType: 'physical' } },
    { kind: 'custom', scriptId: 'damage_vs_status', params: { status: 'status_armor_break' } },
  ]),
];

const FORESIGHT: AttunementInput = { id: 'att_foresight', name: 'Foresight', description: 'Fixture: Foresight.', cost: 40, effects: [{ kind: 'custom', scriptId: 'foresight' }], icon: 'foresight' };
const HORDE_RISING: ModifierInput = { id: 'mod_horde_rising', name: 'Horde Rising', description: 'Fixture: elites everywhere.', rules: [{ kind: 'elite_chance', pct: 0.3 }], icon: 'horde_rising' };

/** The combat tables with the gear above, DESIGN §7.3's twelve affixes, Foresight and Horde Rising. */
function gearTables(patch?: (t: { locations: LocationInput[] }) => void): ContentTables {
  const base = combatTables(patch);
  const design = new Set<string>(designAffixes.map((a) => a.id));
  return {
    ...base,
    items: [...base.items, ...GEAR_ITEMS],
    affixes: [...base.affixes.filter((a) => !design.has(a.id)), ...designAffixes],
    attunements: [...base.attunements, FORESIGHT],
    modifiers: [...base.modifiers, HORDE_RISING],
  };
}
const gearPack = (patch?: (t: { locations: LocationInput[] }) => void): ContentPack => buildContentPack(gearTables(patch), { version: 'u34b-fixture' });

const content = gearPack();
const profile = freshProfile();

// ---- helpers --------------------------------------------------------------------------------------------------------------

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });
const HIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(99)];
const MISS = [D.pct(99)];
const GUARD: Action = { type: 'guard' };
const ILYRA = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {} };

const equip = (itemId: string, affixes: string[] = []): ItemSpec => ({ itemId, equip: true, affixes });
const state = (o: StateOverrides = {}, pack = content): GameState => makeState(o, { content: pack });
const spec = (groups: EncounterSpec['groups'], over: Partial<EncounterSpec> = {}): EncounterSpec => ({
  id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [], ...over,
});
const one = (creatureId: string, count = 1): EncounterSpec['groups'] => [{ creatureId, count }];

/** A fight at the player's first turn: the player first (d4 4), the companion next (d4 3), every enemy last (d4 1). */
function fight(s: GameState, groups: EncounterSpec['groups'], opts: { keepIntents?: boolean } = {}): GameState {
  const companion = s.companions.activeId !== null;
  const draws = [D.d4(4), ...(companion ? [D.d4(3)] : []), ...groups.flatMap((g) => Array.from({ length: g.count }, () => D.d4(1)))];
  const ctx = scriptedCtx(s, draws, content, profile);
  beginCombat(ctx, spec(groups));
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
function act(s: GameState, action: Action, draws: readonly number[] = [], pack = content) {
  const out = scriptedStep(s, action, draws, pack, profile);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}
const attack = (s: GameState, i = 0): Action => ({ type: 'attack', targetUid: enemy(s, i).uid });
const ability = (abilityId: string, targetUid?: string): Action => (targetUid === undefined ? { type: 'ability', abilityId } : { type: 'ability', abilityId, targetUid });
const dealt = (events: readonly GameEvent[]) => ofType(events, 'damageDealt').map((e) => [e.refId, e.amount]);
const healed = (events: readonly GameEvent[]) => ofType(events, 'healed').map((e) => [e.source, e.amount]);
const gains = (events: readonly GameEvent[]) => ofType(events, 'resourceGained').map((e) => [e.reason, e.amount]);
const applied = (events: readonly GameEvent[]) => ofType(events, 'statusApplied').map((e) => [e.statusId, e.duration, e.source ?? null]);
const logged = (s: GameState, text: string): number => (s.combat as CombatState).log.filter((l) => l.text === text).length;

// ---- the passive list ------------------------------------------------------------------------------------------------------

describe('gearPassives: every passive with its source, in gear order (derived.ts)', () => {
  test('weapon (its own passives, then its affixes), armor, trinkets; derive().passives is the same list unsourced', () => {
    const s = state({
      items: [equip('item_shadow_kissed_dagger', ['affix_of_moments']), equip('item_wildling_hide_armor', ['affix_of_thorns']), equip('item_fixture_mending_charm')],
    });
    const listed = gearPassives(s.player, content);
    expect(listed.map((p) => [p.source, p.passive.kind])).toEqual([
      ['gear:item_shadow_kissed_dagger', 'curse'],
      ['affix:affix_of_moments', 'statusOnHit'],
      ['affix:affix_of_thorns', 'custom'],
      ['gear:item_fixture_mending_charm', 'regen'],
    ]);
    expect(derive(s.player, content).passives).toEqual(listed.map((p) => p.passive));
  });
});

// ---- rule 1: what "on hit" is ------------------------------------------------------------------------------------------------

describe('rule 1 — "on hit": a direct hit by the player that lands and deals damage', () => {
  const fang = (o: StateOverrides = {}) => state({ ...o, items: [equip('item_fixture_venom_fang'), equip('item_fixture_leech_charm'), ...(o.items ?? [])] });

  test('the basic attack: a landed hit fires the on-hit passives (no draw for a certain chance); a miss fires nothing', () => {
    const s = fight(fang({ hp: 60 }), one(DUELIST));
    const hit = act(s, attack(s), HIT());
    expect(dealt(hit.events)).toEqual([[null, 14]]); // ATK 15 − armor 1
    expect(applied(hit.events)).toEqual([['status_poison', 2, 'gear:item_fixture_venom_fang']]);
    expect(healed(hit.events)).toEqual([['gear:item_fixture_leech_charm', 7]]); // ⌊0.5 × 14⌋
    const miss = act(s, attack(s), MISS);
    expect([dealt(miss.events), applied(miss.events), healed(miss.events)]).toEqual([[], [], []]);
  });

  test('an area ability: each target struck counts once per cast, in slot order', () => {
    const s = fight(fang({ hp: 60, mp: 48, abilities: ['rgr_whirling_steel'] }), one(DUELIST, 2));
    const out = act(s, ability('rgr_whirling_steel'), [...HIT(), ...HIT()]);
    expect(dealt(out.events)).toEqual([['rgr_whirling_steel', 12], ['rgr_whirling_steel', 12]]); // 15 × 0.85 − 1 = 11.75
    expect(ofType(out.events, 'statusApplied').map((e) => e.targetUid)).toEqual([enemy(s, 0).uid, enemy(s, 1).uid]);
    expect(healed(out.events)).toEqual([['gear:item_fixture_leech_charm', 6], ['gear:item_fixture_leech_charm', 6]]);
  });

  test("a multi-hit ability is one on-hit per target: its hits' HP summed, one roll, one self-cost", () => {
    const s = fight(state({ classId: 'elf', abilities: ['elf_twin_strike'], items: [equip('item_shadow_kissed_dagger'), equip('item_fixture_leech_charm')] }), one(DUELIST));
    const hp = me(s).hp;
    const out = act(patched(s, (c) => void (c.party[0]!.hp = hp - 20)), ability('elf_twin_strike', enemy(s).uid), [...HIT(), ...HIT(), D.pct(0)]);
    expect(dealt(out.events)).toEqual([['elf_twin_strike', 8], ['elf_twin_strike', 8]]); // 0.65 × 14 − 1 = 8.1, twice
    expect(applied(out.events)).toEqual([['status_curse', 3, 'gear:item_shadow_kissed_dagger']]);
    expect(healed(out.events)).toEqual([['gear:item_fixture_leech_charm', 8]]); // ⌊0.5 × 16⌋
    expect(me(out.state).hp).toBe(hp - 20 + 8 - 2);
  });

  test('not "on hit": DoT ticks, counters, companions and thrown items', () => {
    // a Bleed the player put on the Duelist ticks on its turn: no theft, no Poison
    const bleeding = patched(fight(fang({ hp: 60 }), one(DUELIST)), (c) => void c.enemies[0]!.statuses.push(status('status_bleed', { sourceUid: c.party[0]!.uid, tick: 4, duration: 3 })));
    const tick = act(quiet(bleeding), GUARD);
    expect(ofType(tick.events, 'statusTicked').map((e) => [e.statusId, e.amount])).toEqual([['status_bleed', 4]]);
    expect([healed(tick.events), applied(tick.events)]).toEqual([[], []]);
    // Riposte Stance's counters answer the Lunge: counter hits are not direct hits
    const stance = fight(fang({ hp: 60, mp: 48, abilities: ['rgr_riposte_stance'] }), one(DUELIST), { keepIntents: true });
    const counters = act(stance, ability('rgr_riposte_stance'), [...HIT(), ...HIT(), ...HIT(), ...HIT()]);
    expect(dealt(counters.events).filter(([ref]) => ref === 'counter:rgr_riposte_stance')).toHaveLength(2);
    expect([healed(counters.events), applied(counters.events)]).toEqual([[], []]);
    // the companion's Ley Dart on its own turn
    const withIlyra = fang({ hp: 60, patch: (st) => void ((st.companions.recruited.ilyra = { ...ILYRA }), (st.companions.activeId = 'ilyra')) });
    const ilyra = act(quiet(fight(withIlyra, one(DUELIST))), GUARD, HIT());
    expect(dealt(ilyra.events)).toEqual([['comp_ilyra_ley_dart', 9]]); // SP 10 − ward 1
    expect([healed(ilyra.events), applied(ilyra.events)]).toEqual([[], []]);
    // a thrown Ember Flask (an item's ability)
    const flask = fight(fang({ hp: 60, items: ['item_ember_flask'] }), one(DUELIST));
    const uid = flask.player.inventory.find((i) => i.itemId === 'item_ember_flask')!.uid;
    const thrown = act(quiet(flask), { type: 'item', uid, targetUid: enemy(flask).uid }, HIT());
    expect(dealt(thrown.events)).toEqual([['itm_ember_flask', 24]]);
    expect(healed(thrown.events)).toEqual([]);
    expect(applied(thrown.events).map(([id]) => id)).toEqual(['status_burn']); // the flask's own row; no Poison
  });
});

// ---- rule 2: statusOnHit ------------------------------------------------------------------------------------------------------

describe('rule 2 — statusOnHit applies through applyStatus with the passive duration', () => {
  test('affix_of_moments: Slow (2) when the 10 % roll comes up (one draw after the hit), with its source', () => {
    const s = fight(state({ items: [equip('item_travelers_sword', ['affix_of_moments'])] }), one(DUELIST));
    const slowed = act(quiet(s), attack(s), [...HIT(), D.pct(9)]);
    expect(applied(slowed.events)).toEqual([['status_slow', 2, 'affix:affix_of_moments']]);
    expect(findStatus(enemy(slowed.state), 'status_slow')).toBeDefined();
    expect(applied(act(quiet(s), attack(s), [...HIT(), D.pct(10)]).events)).toEqual([]);
  });

  test('immunities hold: a breach-born Shade is Immune to the Venom Fang, the Duelist is not', () => {
    const s = fight(state({ items: [equip('item_fixture_venom_fang')] }), [{ creatureId: SHADE, count: 1 }, { creatureId: DUELIST, count: 1 }]);
    const shade = act(quiet(s), attack(s, 0), HIT());
    expect(applied(shade.events)).toEqual([]);
    expect((shade.state.combat as CombatState).log.some((l) => l.text === 'Corrupted Shade: Immune to Poison.')).toBe(true);
    expect(applied(act(quiet(s), attack(s, 1), HIT()).events)).toEqual([['status_poison', 2, 'gear:item_fixture_venom_fang']]);
  });
});

// ---- rule 3: the Shadow-Kissed Dagger --------------------------------------------------------------------------------------------

describe("rule 3 — curse: the Shadow-Kissed Dagger's 20 % Curse (3), and every on-hit costs 2 HP, never below 1", () => {
  const dagger = (o: StateOverrides = {}) => fight(state({ ...o, items: [equip('item_shadow_kissed_dagger')] }), one(DUELIST));

  test('a roll under 20 curses the target (tick 2 + 0.2·SP = 3); hit or curse, the wielder pays 2 HP — "The dagger drinks."', () => {
    const s = dagger();
    const cursed = act(quiet(s), attack(s), [...HIT(), D.pct(19)]);
    expect(dealt(cursed.events)).toEqual([[null, 16]]); // ATK 17 − 1
    expect(applied(cursed.events)).toEqual([['status_curse', 3, 'gear:item_shadow_kissed_dagger']]);
    expect(findStatus(enemy(cursed.state), 'status_curse')?.tick).toBe(3);
    expect(me(cursed.state).hp).toBe(120 - 2);
    expect(logged(cursed.state, CURSE_COST_LINE)).toBe(1);
    const plain = act(quiet(s), attack(s), [...HIT(), D.pct(20)]);
    expect(applied(plain.events)).toEqual([]);
    expect(me(plain.state).hp).toBe(118);
    const missed = act(quiet(s), attack(s), MISS); // no hit, no cost
    expect(me(missed.state).hp).toBe(120);
  });

  test('self-costs never kill (D-066 #5): at 2 HP it takes 1; at 1 HP nothing, and nothing is logged', () => {
    const s = dagger();
    const at = (hp: number) => patched(s, (c) => void ((c.party[0]!.hp = hp), (c.intents = {})));
    expect(me(act(at(2), attack(s), [...HIT(), D.pct(50)]).state).hp).toBe(1);
    const last = act(at(1), attack(s), [...HIT(), D.pct(50)]);
    expect(me(last.state).hp).toBe(1);
    expect(logged(last.state, CURSE_COST_LINE)).toBe(0);
  });
});

// ---- rule 4: life steal ---------------------------------------------------------------------------------------------------------

describe('rule 4 — lifeSteal heals ⌊pct × the HP the hit took⌋, no overheal', () => {
  const blade = (o: StateOverrides = {}) => fight(state({ ...o, items: [equip('item_fixture_leech_blade')] }), one(DUELIST));

  test('after shields and mitigation, rounded down, clamped to missing HP; Curse halves it', () => {
    const s = blade({ hp: 100 });
    expect(healed(act(quiet(s), attack(s), HIT()).events)).toEqual([['gear:item_fixture_leech_blade', 7]]); // ⌊0.5 × 14⌋
    expect(healed(act(quiet(patched(s, (c) => void (c.party[0]!.hp = 118))), attack(s), HIT()).events)).toEqual([['gear:item_fixture_leech_blade', 2]]);
    expect(healed(act(quiet(patched(s, (c) => void (c.party[0]!.hp = 120))), attack(s), HIT()).events)).toEqual([]);
    // a Shield of 10 takes most of the blow: 4 HP lost → 2 stolen
    const shielded = act(quiet(patched(s, (c) => void c.enemies[0]!.statuses.push(status('status_shield', { tick: 10, duration: 3 })))), attack(s), HIT());
    expect(ofType(shielded.events, 'damageDealt').map((e) => [e.amount, e.absorbed])).toEqual([[4, 10]]);
    expect(healed(shielded.events)).toEqual([['gear:item_fixture_leech_blade', 2]]);
    // Cursed: healing received × 0.5 → ⌊3.5⌋
    const cursed = act(quiet(patched(s, (c) => void c.party[0]!.statuses.push(status('status_curse', { tick: 1, duration: 3 })))), attack(s), HIT());
    expect(healed(cursed.events)).toEqual([['gear:item_fixture_leech_blade', 3]]);
  });

  test("the Necromancer Staff's 5 % rounds down: 14 damage steals nothing (no event), 35 steals 1", () => {
    const s = fight(state({ classId: 'wizard', hp: 50, items: [equip('item_necromancer_staff')] }), one(DUELIST));
    const small = act(quiet(s), attack(s), HIT());
    expect(dealt(small.events)).toEqual([[null, 14]]); // Ley 4 + 0.8 × SP 14 = 15.2 − ward 1
    expect(healed(small.events)).toEqual([]);
    const big = act(quiet(patched(s, (c) => void (c.party[0]!.sp = 40))), attack(s), HIT());
    expect(dealt(big.events)).toEqual([[null, 35]]); // 4 + 32 − 1
    expect(healed(big.events)).toEqual([['gear:item_necromancer_staff', 1]]);
  });
});

// ---- rule 5: regen --------------------------------------------------------------------------------------------------------------

describe("rule 5 — regen: at the start of each of the player's turns, before the Wizard's mana regen; nothing out of combat", () => {
  const wizard = (o: StateOverrides = {}) =>
    state({ ...o, classId: 'wizard', items: [equip('item_fixture_mending_charm'), equip('item_wildling_hide_armor', ['affix_of_the_wellspring'])] });

  test('in gear order: +2 MP (armor of the Wellspring), +6 HP and +3 MP (Mending Charm), then turn_start +3; HP halved while Poisoned', () => {
    const s = fight(wizard({ hp: 50, mp: 10 }), one(DUELIST));
    expect([me(s).hp, me(s).mp]).toEqual([56, 18]); // the first turn already
    const next = act(quiet(s), GUARD);
    expect(healed(next.events)).toEqual([['gear:item_fixture_mending_charm', 6]]);
    expect(gains(next.events)).toEqual([['guard', 5], ['affix:affix_of_the_wellspring', 2], ['gear:item_fixture_mending_charm', 3], ['turn_start', 3]]);
    const poisoned = act(quiet(patched(s, (c) => void c.party[0]!.statuses.push(status('status_poison', { tick: 1, duration: 4 })))), GUARD);
    expect(ofType(poisoned.events, 'statusTicked').map((e) => [e.statusId, e.amount])).toEqual([['status_poison', 1]]);
    expect(healed(poisoned.events)).toEqual([['gear:item_fixture_mending_charm', 3]]);
    const full = act(quiet(patched(s, (c) => void (c.party[0]!.hp = c.party[0]!.hpMax))), GUARD);
    expect(healed(full.events)).toEqual([]); // no overheal, no empty event
  });

  test('out of combat the passive does nothing (travel regen belongs to the Attunements)', () => {
    const out = play(wizard({ hp: 50, mp: 10 }), [{ type: 'move', to: MISTWOOD }], { content });
    expect(out.state.mode).toBe('explore');
    expect(ofType(out.events, 'healed').filter((e) => e.source.startsWith('gear:') || e.source.startsWith('affix:'))).toEqual([]);
    expect(ofType(out.events, 'resourceGained').filter((e) => e.reason.startsWith('gear:') || e.reason.startsWith('affix:'))).toEqual([]);
  });
});

// ---- rule 6: the custom affix scripts ---------------------------------------------------------------------------------------------

describe('rule 6 — the affix scripts', () => {
  test('basic_attack_rider (of Embers): +15 % of a landed basic attack as Fire — no draws, resistance applies, not "on hit"', () => {
    const s = fight(state({ hp: 60, items: [equip('item_travelers_sword', ['affix_of_embers']), equip('item_fixture_leech_charm')] }), [
      { creatureId: DUELIST, count: 1 },
      { creatureId: SHADE, count: 1 },
    ]);
    const out = act(quiet(s), attack(s, 0), HIT());
    expect(dealt(out.events)).toEqual([[null, 14], ['affix:affix_of_embers', 2]]); // 0.15 × 14 = 2.1
    expect(ofType(out.events, 'damageDealt').map((e) => [e.kind, e.damageType])).toEqual([['basic', 'physical'], ['item', 'fire']]);
    expect(healed(out.events)).toEqual([['gear:item_fixture_leech_charm', 7]]); // the main hit's 14 only
    expect(out.state.counters.damageBySource['affix:affix_of_embers']).toBe(2);
    expect(dealt(act(quiet(s), attack(s, 1), HIT()).events)).toEqual([[null, 14], ['affix:affix_of_embers', 3]]); // Shade weak to Fire: 3.15
    expect(dealt(act(quiet(s), attack(s), MISS).events)).toEqual([]);
    // an ability is not a basic attack: no rider
    const rend = fight(state({ mp: 48, abilities: ['rgr_rend'], items: [equip('item_travelers_sword', ['affix_of_embers'])] }), one(DUELIST));
    expect(dealt(act(quiet(rend), ability('rgr_rend', enemy(rend).uid), HIT()).events)).toEqual([['rgr_rend', 14]]);
  });

  test('damage_vs_status (of Iron): × 1.1 against Armor Broken on any player direct hit — basic attack or ability', () => {
    const iron = (o: StateOverrides = {}) => state({ ...o, items: [equip('item_travelers_sword', ['affix_of_iron'])] });
    const broken = (s: GameState) => quiet(patched(s, (c) => void c.enemies[0]!.statuses.push(status('status_armor_break', { duration: 3 }))));
    const s = fight(iron({ mp: 48, abilities: ['rgr_rend'] }), one(DUELIST));
    expect(dealt(act(quiet(s), attack(s), HIT()).events)).toEqual([[null, 14]]); // no Armor Break: untouched
    expect(dealt(act(broken(s), attack(s), HIT()).events)).toEqual([[null, 19]]); // 15 × 1.15 × 1.1 = 18.975 (armor ignored)
    expect(dealt(act(broken(s), ability('rgr_rend', enemy(s).uid), HIT()).events)).toEqual([['rgr_rend', 19]]);
    const plainSword = fight(state({ items: [equip('item_travelers_sword')] }), one(DUELIST));
    expect(dealt(act(broken(plainSword), attack(plainSword), HIT()).events)).toEqual([[null, 17]]); // 17.25
    const read = { s: broken(s), content };
    const basic: HitSpec = { source: 'basic', type: 'physical', base: 0, coef: 1, stat: 'atk' };
    expect(gearStatusMults(read, me(s), enemy(read.s), basic)).toEqual([{ name: 'affix:affix_of_iron', value: 1.1 }]);
    expect(gearStatusMults(read, me(s), enemy(read.s), { ...basic, source: 'counter:rgr_riposte_stance' })).toEqual([]);
    expect(gearStatusMults(read, me(s), enemy(s), basic)).toEqual([]);
  });

  test('isPlayerDirectHit: the basic attack and abilities — not counters, auras, gear hits, thrown items or anyone else', () => {
    const p = { kind: 'player' as const };
    expect(['basic', 'rgr_rend', 'itm_echo_bolt'].map((source) => isPlayerDirectHit(content, p, { source }))).toEqual([true, true, true]);
    expect(['counter:rgr_riposte_stance', 'affix:affix_of_embers', 'gear:item_x', 'itm_ember_flask'].map((source) => isPlayerDirectHit(content, p, { source }))).toEqual([false, false, false, false]);
    expect(isPlayerDirectHit(content, { kind: 'companion' }, { source: 'basic' })).toBe(false);
  });

  test("reflect_melee (armor of Thorns): 10 % of the HP each rolled Physical blow took goes back — cannot miss, no draws", () => {
    const s = fight(state({ items: [equip('item_wildling_hide_armor', ['affix_of_thorns'])] }), one(DUELIST), { keepIntents: true });
    // Lunge × 2 on the Guard: 5 − armor 2 = 3 × 0.5 = 1.5 → 2 each; 0.2 → at least 1 back
    const out = act(s, GUARD, [...HIT(), ...HIT()]);
    expect(dealt(out.events)).toEqual([['duel_lunge', 2], ['affix:affix_of_thorns', 1], ['duel_lunge', 2], ['affix:affix_of_thorns', 1]]);
    expect(ofType(out.events, 'damageDealt').filter((e) => e.refId === 'affix:affix_of_thorns').map((e) => [e.sourceUid, e.targetUid, e.kind])).toEqual([
      [me(s).uid, enemy(s).uid, 'item'],
      [me(s).uid, enemy(s).uid, 'item'],
    ]);
    expect(out.state.counters.damageBySource['affix:affix_of_thorns']).toBe(2);
  });

  test('reflect_melee answers only a rolled, single-target Physical enemy blow that took HP, while both stand', () => {
    const s = fight(state({ items: [equip('item_wildling_hide_armor', ['affix_of_thorns'])] }), one(DUELIST));
    const blow: HitSpec = { source: 'duel_lunge', type: 'physical', base: 0, coef: 0.5, stat: 'atk' };
    const landed: HitResult = { hit: true, phased: false, crit: false, immune: false, hitChance: 83, critChance: 7, variance: 1, amount: 30, absorbed: 0, shieldBroken: false, mitigated: 0, steps: [] };
    const reflected = (sp: HitSpec, r: HitResult, attacker = enemy(s), target = me(s)) => {
      const ctx = scriptedCtx(s, [], content, profile);
      const calls: string[] = [];
      const ops = { applyHit: (_c: unknown, _cb: unknown, a: Combatant, t: Combatant, hs: HitSpec, hr: HitResult) => void calls.push(`${a.kind}>${t.kind}:${hs.source}:${hr.amount}`), gainResource: () => 0, addMp: () => 0 };
      gearReflect(ops, ctx, ctx.s.combat as CombatState, attacker, target, sp, r);
      return calls;
    };
    expect(reflected(blow, landed)).toEqual(['player>enemy:affix:affix_of_thorns:3']);
    expect(reflected({ ...blow, aoe: true }, landed)).toEqual([]);
    expect(reflected({ ...blow, type: 'void' }, landed)).toEqual([]);
    expect(reflected(blow, { ...landed, variance: null })).toEqual([]); // a fixed amount (communion pressure, a reflect)
    expect(reflected(blow, { ...landed, amount: 0, absorbed: 30 })).toEqual([]); // the Shield took it all
    expect(reflected({ ...blow, source: 'counter:duel_set' }, landed)).toEqual([]);
    expect(reflected(blow, landed, me(s), enemy(s))).toEqual([]); // the player's own blow
  });

  test('unknown script ids and malformed params do nothing in a fight (the validator owns them)', () => {
    const s = fight(state({ items: [equip('item_travelers_sword'), equip('item_fixture_odd_charm')] }), one(DUELIST), { keepIntents: true });
    const broken = patched(s, (c) => void c.enemies[0]!.statuses.push(status('status_armor_break', { duration: 3 })));
    const out = act(broken, attack(s), [...HIT(), ...HIT(), ...HIT()]); // the swing, then the Lunge × 2
    expect(dealt(out.events)).toEqual([[null, 17], ['duel_lunge', 5], ['duel_lunge', 5]]);
  });
});

// ---- rule 7: Foresight ------------------------------------------------------------------------------------------------------------

describe('rule 7 — Foresight (att_foresight): next-next intents for the whole fight, through Hunter\'s Eye\'s mechanism', () => {
  test('the foresight key holds from the first turn to the last; without the Attunement it never appears', () => {
    const seer = state({ patch: (st) => void (st.player.attunements = ['att_foresight']) });
    let s = fight(seer, one(DUELIST));
    expect(foresightActive(s.combat as CombatState)).toBe(true);
    for (let i = 0; i < 5; i++) {
      s = act(quiet(s), GUARD).state;
      expect(foresightActive(s.combat as CombatState)).toBe(true);
    }
    const blind = fight(state(), one(DUELIST));
    expect(foresightActive(blind.combat as CombatState)).toBe(false);
    expect((act(quiet(blind), GUARD).state.combat as CombatState).cooldowns[FORESIGHT_KEY]).toBeUndefined();
  });
});

// ---- rule 8: Horde Rising ---------------------------------------------------------------------------------------------------------

describe('rule 8 — Horde Rising (mod_horde_rising): +1 pool enemy and 30 % elite variants, on the fight\'s own stream', () => {
  const MIST_BRUTE = 'enc_mist_brute';
  const mist = (encounters: EncounterInput[]) =>
    gearPack(({ locations }) => {
      const loc = locations.find((l) => l.id === MISTWOOD)!;
      loc.encounters = encounters;
      loc.events = [{ id: 'ev_ambush', text: 'Ferns part.', when: { flag: 'flag_ambush' }, effects: [{ startCombat: 'enc_brute_ambush' }] }];
    });
  const pack = mist([{ id: MIST_BRUTE, groups: [{ creatureId: BRUTE }] }]);
  const rising = (o: StateOverrides = {}) => state({ ...o, patch: (st) => void ((st.meta.modifiers = ['mod_horde_rising']), o.patch?.(st)) }, pack);
  const loc = pack.locations[MISTWOOD]!;
  /** hordeRising with an Rng that throws if it is touched: the modifier never draws from the run's stream. */
  const rise = (s: GameState, sp: EncounterSpec) => hordeRising(scriptedCtx(s, [], pack, profile), loc, sp);
  const brute = encounterSpec(pack.locations[MISTWOOD]!.encounters[0]!);

  test('the chance is the elite_chance rule; off without the modifier (the spec comes back as it was)', () => {
    expect(hordeRisingChance(rising(), pack)).toBe(0.3);
    expect(hordeRisingChance(state({}, pack), pack)).toBeNull();
    expect(rise(state({}, pack), brute)).toBe(brute);
  });

  test('a fixed group gains one Wildling Brute or Corrupted Shade (the region pool) as its last slot; ~30 % of the slots are elite', () => {
    const counts = { [BRUTE]: 0, [SHADE]: 0 } as Record<string, number>;
    let elites = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      const out = rise(rising({ patch: (st) => void (st.counters.fights = i) }), brute);
      expect(out.groups[0]).toEqual({ creatureId: BRUTE, count: 1 });
      expect(out.groups).toHaveLength(2);
      counts[out.groups[1]!.creatureId] = (counts[out.groups[1]!.creatureId] ?? 0) + 1;
      expect(out.elites).toHaveLength(2);
      elites += out.elites!.filter(Boolean).length;
    }
    expect(Object.keys(counts).sort()).toEqual([BRUTE, SHADE].sort());
    expect(counts[BRUTE]! / n).toBeGreaterThan(0.4);
    expect(counts[BRUTE]! / n).toBeLessThan(0.6);
    expect(elites / (2 * n)).toBeGreaterThan(0.26);
    expect(elites / (2 * n)).toBeLessThan(0.34);
    // the same fight rolls the same way; the next fight rolls afresh
    const s = rising();
    expect(rise(s, brute)).toEqual(rise(s, brute));
  });

  test('at most 3 enemies; no pool, no extra; elites and an `elite` encounter are never upgraded again', () => {
    const three = rise(rising(), spec(one(BRUTE, 3)));
    expect(three.groups).toEqual(one(BRUTE, 3));
    expect(three.elites).toHaveLength(3);
    const noPool = hordeRising(scriptedCtx(rising(), [], pack, profile), pack.locations.loc_whispering_ruins!, spec(one(BRUTE)));
    expect(noPool.groups).toEqual(one(BRUTE));
    for (let i = 0; i < 60; i++) {
      const s = rising({ patch: (st) => void (st.counters.fights = i) });
      expect(rise(s, spec(one('cr_temporal_aberration'))).elites![0]).toBe(false); // role 'elite'
      expect(rise(s, spec(one(BRUTE), { elite: true })).elites![0]).toBe(false); // the record says elite
    }
  });

  test('untouched: bosses, story gates (fleeable: false)', () => {
    const s = rising();
    const boss = spec(one(BELL), { fleeable: false, onFlee: 'hold' });
    expect(rise(s, boss)).toBe(boss);
    const gate = spec(one(BRUTE), { fleeable: false, onFlee: 'hold' });
    expect(rise(s, gate)).toBe(gate);
    const mixed = spec([{ creatureId: BRUTE, count: 1 }, { creatureId: BELL, count: 1 }]);
    expect(rise(s, mixed)).toBe(mixed);
  });

  test('through the arrival: the run Rng only rolls the extra d4; an elite is "Elite …", +40 % HP, +20 % ATK; × 1.8 kill XP', () => {
    // the first seed whose fight fields an elite Brute beside a plain Shade
    let found: GameState | null = null;
    for (let i = 0; i < 200 && !found; i++) {
      const s = rising({ seed: `u34b-${i}` });
      const out = rise(s, brute);
      if (out.groups[1]?.creatureId === SHADE && out.elites?.[0] === true && out.elites[1] === false) found = s;
    }
    expect(found).not.toBeNull();
    const fought = act(found as GameState, { type: 'move', to: MISTWOOD }, [D.d4(4), D.d4(1), D.d4(1)], pack).state;
    expect(fought.combat?.encounterId).toBe(MIST_BRUTE);
    const [b, sh] = (fought.combat as CombatState).enemies as [Combatant, Combatant];
    expect([b.name, b.hpMax, b.hp, b.atk, b.pattern.firedOnce]).toEqual(['Elite Wildling Brute', 90, 90, 11 * 1.2, [ELITE_VARIANT_TAG]]); // 64 × 1.4 = 89.6
    expect([sh.name, sh.hpMax, sh.atk]).toEqual(['Corrupted Shade', 36, 7]);
    // without the modifier: one Brute, two d4s
    const plain = act(state({ seed: found!.meta.seed }, pack), { type: 'move', to: MISTWOOD }, [D.d4(4), D.d4(1)], pack).state;
    expect((plain.combat as CombatState).enemies.map((e) => e.name)).toEqual(['Wildling Brute']);
    // kill XP: 71 × 1.8 = 127.8 → 128 for the elite; 41 for the Shade
    const ctx = scriptedCtx(fought, [D.int(11, 11, 18), D.no, D.no, D.no, D.int(9, 7, 12), D.no], pack, profile);
    for (const e of (ctx.s.combat as CombatState).enemies) Object.assign(e, { alive: false, hp: 0 });
    expect(rollSpoils(ctx, ctx.s.combat as CombatState).xp).toBe(128 + 41);
  });

  test('a wandering roll gains its extra too; story fights — a `spawn` group, `startCombat` — are untouched', () => {
    const visited = (o: StateOverrides = {}) =>
      rising({ ...o, patch: (st) => void ((st.world.locationStates[MISTWOOD] = { visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: [MIST_BRUTE], encounterClearedDay: {}, eventsFired: [], flags: {}, unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {} }), o.patch?.(st)) });
    const wander = act(visited(), { type: 'move', to: MISTWOOD }, [D.no, 0.25, D.d4(4), D.d4(1), D.d4(1)], pack).state; // one Brute (70 %) + 1
    expect(wander.combat?.encounterId).toBe('wandering');
    expect((wander.combat as CombatState).enemies).toHaveLength(2);
    const spawned = rising({ patch: (st) => void (st.world.pendingEncounters[MISTWOOD] = [{ id: 'spawn_9', groups: [{ creatureId: SHADE, count: 1 }], once: true, onFlee: 'scatter' }]) });
    expect((act(spawned, { type: 'move', to: MISTWOOD }, [D.d4(4), D.d4(1)], pack).state.combat as CombatState).enemies.map((e) => e.name)).toEqual(['Corrupted Shade']);
    const story = mist([]);
    const ambushed = state({ flags: { flag_ambush: true }, patch: (st) => void (st.meta.modifiers = ['mod_horde_rising']) }, story);
    const out = scriptedStep(ambushed, { type: 'move', to: MISTWOOD }, [D.d4(4), D.d4(1)], story, profile);
    expect([out.rejected, out.left]).toEqual([null, 0]);
    expect((out.state.combat as CombatState).enemies.map((e) => e.name)).toEqual(['Wildling Brute']);
  });
});

// ---- rule 9: sources ------------------------------------------------------------------------------------------------------------

describe('rule 9 — every gear event names its source (U39 damage share)', () => {
  test('one fight: statusApplied.source, healed.source, damageDealt.refId and counters.damageBySource', () => {
    const s = fight(state({ hp: 60, items: [equip('item_travelers_sword', ['affix_of_embers', 'affix_of_the_void']), equip('item_fixture_leech_charm')] }), one(DUELIST));
    const out = act(quiet(s), attack(s), [...HIT(), D.pct(0)]);
    expect(applied(out.events)).toEqual([['status_curse', 3, 'affix:affix_of_the_void']]);
    expect(healed(out.events)).toEqual([['gear:item_fixture_leech_charm', 7]]);
    expect(dealt(out.events)).toEqual([[null, 14], ['affix:affix_of_embers', 2]]);
    expect(out.state.counters.damageBySource).toMatchObject({ basic: 14, 'affix:affix_of_embers': 2 });
  });
});
