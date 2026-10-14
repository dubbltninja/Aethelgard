// U27: the end of a won fight and the bestiary (DESIGN §6.2, §6.6, §7.2–7.3, §7.8, §9, §4.2, §10.6, §16.3; D-055;
// PLAN §4.10, §8.1): kill XP and DESIGN's formula, rarity by band, affixes, the full pack, D-055 across a loop, and the
// bestiary's kills, reveals, Resonance, seen counts and intents — with the lazy profile draft.
import { describe, expect, test } from 'bun:test';
import {
  affixCount,
  beginCombat,
  creatureXp,
  expectedKillXp,
  lootBand,
  noteIntentsSeen,
  packRoom,
  placeLoot,
  recordKill,
  recordSeen,
  recordSpared,
  revealAt,
  rollAffixes,
  rollRarity,
  runCombat,
  step,
  type Action,
  type CombatState,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type ItemInstance,
  type Profile,
  type StepCtx,
} from '@engine/index';
import { BRUTE, D, MISTWOOD, RUNNER, SHADE, TIDE, combatPack, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';

const content = combatPack();
const profile = freshProfile();
const LIBRARY = 'loc_shattered_library';
const NEXUS = 'loc_chronos_nexus';
const ABERRATION = 'cr_temporal_aberration';

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const state = (o: StateOverrides = {}): GameState => makeState(o, { content });
const spec = (creatureId: string, over: Partial<EncounterSpec> = {}): EncounterSpec => ({
  id: 'enc_test', groups: [{ creatureId, count: 1 }], fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [], ...over,
});
/** A fight at the player's first turn (the player first: d4 4 against the enemy's 1). */
function open(s: GameState, sp: EncounterSpec, prof: Profile = profile): GameState {
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1)], content, prof);
  beginCombat(ctx, sp);
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  return ctx.s;
}
function act(s: GameState, action: Action, draws: readonly number[], prof: Profile = profile) {
  const out = scriptedStep(s, action, draws, content, prof);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}
const HIT = [D.pct(0), D.variance(1), D.pct(99)];
/** The last enemy at 1 HP: the next hit wins the fight. */
const lastHit = (s: GameState): GameState => {
  (s.combat as CombatState).enemies[0]!.hp = 1;
  return s;
};
const finish = (s: GameState, spoils: readonly number[], prof: Profile = profile) =>
  act(lastHit(s), { type: 'attack', targetUid: (s.combat as CombatState).enemies[0]!.uid }, [...HIT, ...spoils], prof);
const ctxOf = (draws: readonly number[] = [], o: StateOverrides = {}, prof: Profile = profile): StepCtx & { rng: { queue: number[] } } =>
  scriptedCtx(state(o), draws, content, prof);

describe('kill XP (DESIGN §6.2, §6.6)', () => {
  test('the authored xp × the loop nudge; elite ×1.8 and anomaly ×1.3 are already in the authored number (DESIGN\'s formula agrees)', () => {
    expect(creatureXp(state({ loop: 7 }), content, ABERRATION)).toBe(Math.round(520 * 1.15)); // the nudge caps at +15 %
    const fixtures = [SHADE, BRUTE, 'cr_glowfen_mireling', ABERRATION].map((id) => [id, content.creatures[id]!.xp, expectedKillXp(content.creatures[id]!, content)]);
    expect(fixtures).toEqual([[SHADE, 41, 41], [BRUTE, 71, 71], ['cr_glowfen_mireling', 189, 189], [ABERRATION, 520, 520]]);
    expect(expectedKillXp({ role: 'elite', level: 6 }, content)).toBe(200); // the Stone-Hide Golem
    expect(expectedKillXp({ role: 'anomaly', level: 4 }, content)).toBe(92); // WORLD §6's L4 anomaly Wisp: 71 × 1.3
    expect(expectedKillXp({ role: 'anomaly', level: 12 }, content)).toBe(376); // WORLD §6's L12 anomaly: 289 × 1.3
    expect(expectedKillXp({ role: 'boss', level: 18 }, content)).toBeNull(); // hand-set
  });
});

describe('rarity and affixes (DESIGN §7.2–7.3)', () => {
  test('the band: the location\'s level band minimum, else its region\'s, else the creature\'s level', () => {
    expect(lootBand(content, NEXUS, 1)).toBe(11);
    expect(lootBand(content, MISTWOOD, 1)).toBe(2);
    expect(lootBand(content, 'loc_nowhere', 5)).toBe(5);
  });

  test('one weighted draw over the band\'s row: 50/30/15/4/1, from band 9 35/35/20/8/2, from band 13 25/35/25/12/3', () => {
    const roll = (band: number, draw: number) => rollRarity(ctxOf([draw]), band);
    expect([0, 0.6, 0.9, 0.97, 0.995].map((d) => roll(2, d))).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
    expect([0.3, 0.5, 0.8, 0.95, 0.99].map((d) => roll(9, d))).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
    expect([0.2, 0.5, 0.8, 0.9, 0.99].map((d) => roll(13, d))).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
  });

  test('affixes: Common none; Uncommon 50 % one; Rare one; Epic one or two; Legendary two — distinct, only those acting on the slot', () => {
    const armor = content.items.item_wildling_hide_armor!;
    const dagger = content.items.item_rusty_dagger!;
    const affixes = (def: typeof armor, rarity: Parameters<typeof rollAffixes>[2], draws: number[]) => {
      const ctx = ctxOf(draws);
      const out = rollAffixes(ctx, def, rarity);
      expect(ctx.rng.queue).toEqual([]);
      return out;
    };
    // the armor pool, by id: iron, the gale, vigor; the weapon pool has no vigor (DESIGN §7.3 "—")
    expect(affixes(armor, 'common', [])).toEqual([]);
    expect(affixes(armor, 'uncommon', [D.no])).toEqual([]);
    expect(affixes(armor, 'uncommon', [D.yes, D.int(2, 0, 2)])).toEqual(['affix_of_vigor']);
    expect(affixes(armor, 'rare', [D.int(0, 0, 2)])).toEqual(['affix_of_iron']);
    expect(affixes(armor, 'epic', [D.int(1, 1, 2), D.int(1, 0, 2)])).toEqual(['affix_of_the_gale']);
    expect(affixes(armor, 'epic', [D.int(2, 1, 2), D.int(2, 0, 2), D.int(0, 0, 1)])).toEqual(['affix_of_vigor', 'affix_of_iron']);
    expect(affixes(dagger, 'legendary', [D.int(1, 0, 1), D.int(0, 0, 0)])).toEqual(['affix_of_the_gale', 'affix_of_iron']);
    // fixed affixes come first and count against the cap; non-gear rolls nothing
    const fixed = { ...dagger, fixedAffixes: ['affix_of_iron'] as `affix_${string}`[] };
    expect(affixes(fixed, 'rare', [])).toEqual(['affix_of_iron']);
    expect(affixes(fixed, 'legendary', [D.int(0, 0, 0)])).toEqual(['affix_of_iron', 'affix_of_the_gale']);
    expect(affixes(content.items.item_glow_moss!, 'rare', [])).toEqual([]);
    expect(affixCount(ctxOf([]), 'legendary')).toBe(2);
  });

  test('through the victory: the Brute\'s Wildling Hide Armor (25 %: yes) rolls its rarity for the Mistwood band, then its affix', () => {
    const s = open(state({ locationId: MISTWOOD }), spec(BRUTE));
    const out = finish(s, [D.int(14, 11, 18), D.yes, D.yes, 0.6, D.yes, D.int(1, 0, 2), D.yes]);
    const armor = out.state.player.inventory.find((i) => i.itemId === 'item_wildling_hide_armor');
    expect(armor).toMatchObject({ qty: 1, rarity: 'uncommon', affixes: ['affix_of_the_gale'] });
    const loot = ofType(out.events, 'combatEnded')[0]!.loot.map((i) => [i.itemId, i.rarity, i.affixes]);
    expect(loot).toEqual([['item_ley_touched_tonic', 'common', []], ['item_wildling_hide_armor', 'uncommon', ['affix_of_the_gale']], ['mat_wildling_hide', 'common', []]]);
    expect(ofType(out.events, 'itemGiven').map((e) => [e.item.itemId, e.source])).toEqual([
      ['item_ley_touched_tonic', `loot:${BRUTE}`], ['item_wildling_hide_armor', `loot:${BRUTE}`], ['mat_wildling_hide', `loot:${BRUTE}`],
    ]);
  });
});

describe('the pack (DESIGN §7.8): what fits goes in; the rest is left on the ground at the fight\'s node', () => {
  const rivets = (n: number): ItemInstance[] => Array.from({ length: n }, (_, i) => ({ uid: `r${i}`, itemId: 'mat_iron_rivet', qty: 99, rarity: 'common', affixes: [] }));
  /** The pack: the Ranger's tonics plus `n` full stacks of rivets. */
  const packed = (n: number, o: StateOverrides = {}) => state({ ...o, patch: (st) => void st.player.inventory.push(...rivets(n)) });

  test('packRoom: stacks first, then free slots; Satchel items always fit', () => {
    const full = packed(39);
    const ash = content.items.mat_shadow_ash!;
    expect(packRoom(full, content, ash, 'common', 3)).toBe(0);
    full.player.inventory.push({ uid: 'ash', itemId: 'mat_shadow_ash', qty: 98, rarity: 'common', affixes: [] });
    full.player.inventory.splice(full.player.inventory.findIndex((i) => i.uid === 'r0'), 1);
    expect(packRoom(full, content, ash, 'common', 3)).toBe(1);
    expect(packRoom(full, content, content.items.item_echo_crystal!, 'common', 1)).toBe(1);
    expect(packRoom(packed(38), content, content.items.item_rusty_dagger!, 'common', 2)).toBe(1);
  });

  test('placeLoot: one Shadow Ash into the 98-stack, two on the ground with a log line; gear in a full pack lies on the ground', () => {
    const s = packed(38);
    s.player.inventory.push({ uid: 'ash', itemId: 'mat_shadow_ash', qty: 98, rarity: 'common', affixes: [] });
    const ctx = scriptedCtx(s, [], content, profile);
    const out = placeLoot(ctx, LIBRARY, 'mat_shadow_ash', 3, 'common', [], 'loot:test');
    expect(out.map((i) => [i.itemId, i.qty])).toEqual([['mat_shadow_ash', 1], ['mat_shadow_ash', 2]]);
    expect(ctx.s.player.inventory.find((i) => i.uid === 'ash')?.qty).toBe(99);
    expect(ctx.s.world.locationStates[LIBRARY]?.items.map((i) => [i.itemId, i.qty])).toEqual([['mat_shadow_ash', 2]]);
    expect(ofType(ctx.events, 'itemGiven').map((e) => e.item.qty)).toEqual([1]);
    expect(ofType(ctx.events, 'log').map((e) => e.text)).toEqual(['Your pack is full: Shadow Ash ×2 is left on the ground.']);
    placeLoot(ctx, LIBRARY, 'item_rusty_dagger', 1, 'rare', ['affix_of_iron'], 'loot:test');
    expect(ctx.s.world.locationStates[LIBRARY]?.items.at(-1)).toMatchObject({ itemId: 'item_rusty_dagger', rarity: 'rare', affixes: ['affix_of_iron'] });
  });

  test('a won fight with a full pack: the spoils lie at the node (the combatEnded loot lists them), the gold and XP still land', () => {
    const s = open(packed(39, { locationId: LIBRARY }), spec(SHADE));
    const out = finish(s, [D.int(9, 7, 12), D.yes]);
    expect(ofType(out.events, 'itemGiven')).toEqual([]);
    expect(out.state.world.locationStates[LIBRARY]?.items.map((i) => [i.itemId, i.qty])).toEqual([['item_dark_spellbook', 1], ['mat_shadow_ash', 1]]);
    expect(ofType(out.events, 'log').filter((e) => e.text.startsWith('Your pack is full')).map((e) => e.text)).toEqual([
      'Your pack is full: Dark Spellbook is left on the ground.', 'Your pack is full: Shadow Ash is left on the ground.',
    ]);
    expect(ofType(out.events, 'combatEnded')[0]!.loot.map((i) => i.itemId)).toEqual(['item_dark_spellbook', 'mat_shadow_ash']);
    expect(out.state.player).toMatchObject({ xp: 41 });
  });
});

describe('D-055 across a loop: the first Corrupted Shade always drops the Dark Spellbook, later ones 50 %', () => {
  test('first fight of the loop: the book without a draw; a later fight: 50 % (yes / no); the next loop starts over', () => {
    const shade = spec(SHADE);
    const books = (s: GameState) => s.player.inventory.find((i) => i.itemId === 'item_dark_spellbook')?.qty ?? 0;
    const first = finish(open(state({ locationId: LIBRARY }), shade), [D.int(9, 7, 12), D.no]); // the book, then no Shadow Ash
    expect(books(first.state)).toBe(1);
    expect(first.state.flags.flag_spellbook_dropped).toBe(true);
    const later = open(first.state, shade);
    expect(books(finish(later, [D.int(9, 7, 12), D.yes, D.no]).state)).toBe(2);
    expect(books(finish(later, [D.int(9, 7, 12), D.no, D.no]).state)).toBe(1);
    // Loop 2 is a fresh run: its flags are empty, so its first Shade drops the book again without a draw
    const loop2 = freshProfile({ loopCounter: 2 });
    const next = finish(open(state({ loop: 2, locationId: LIBRARY }), shade, loop2), [D.int(9, 7, 12), D.no], loop2);
    expect(books(next.state)).toBe(1);
  });
});

describe('the bestiary (DESIGN §4.2, §10.6, §16.3; profile writes through the lazy draft)', () => {
  test('a kill: killed + 1 at once, resistances shown, the first entry pays +3 Resonance once ever; the third Shade reveals all', () => {
    let prof = profile;
    const kill = () => {
      const ctx = scriptedCtx(state(), [], content, prof);
      recordKill(ctx, SHADE);
      prof = ctx.profile as Profile;
      return ctx.events;
    };
    const e1 = kill();
    expect(e1).toEqual([
      { t: 'bestiaryUpdated', creatureId: SHADE, field: 'killed' },
      { t: 'bestiaryUpdated', creatureId: SHADE, field: 'weakness' },
      { t: 'resonanceGained', amount: 3, reason: `bestiary:${SHADE}`, total: 3 },
    ]);
    expect(prof.bestiary[SHADE]).toEqual({ seen: 0, killed: 1, spared: 0, revealed: 'resist', intentsSeen: [] });
    expect(prof.discoveries).toEqual([`kill:${SHADE}`]);
    expect(profile.bestiary).toEqual({}); // the input profile is never written
    expect(kill()).toEqual([{ t: 'bestiaryUpdated', creatureId: SHADE, field: 'killed' }]);
    expect(kill()).toEqual([{ t: 'bestiaryUpdated', creatureId: SHADE, field: 'killed' }, { t: 'bestiaryUpdated', creatureId: SHADE, field: 'weakness' }]);
    expect(prof).toMatchObject({ resonance: 3, resonanceEarnedTotal: 3, bestiary: { [SHADE]: { killed: 3, revealed: 'all' } } });
    expect([0, 1, 2, 3].map((k) => revealAt(content, SHADE, k))).toEqual(['none', 'resist', 'resist', 'all']);
    expect(revealAt(content, BRUTE, 5)).toBe('resist'); // no reveal rows: the first-kill rule only
  });

  test('"after the first kill of that family": the family\'s known entries rise to resist, and its new entries start there', () => {
    const ctx = scriptedCtx(state(), [], content, profile);
    const c = { enemies: [{ refId: RUNNER }] } as unknown as CombatState;
    recordSeen(ctx, c); // a Runner (fam_wilds) seen, not killed
    expect(ctx.profile.bestiary[RUNNER]?.revealed).toBe('none');
    recordKill(ctx, BRUTE); // fam_wilds
    expect(ctx.profile.bestiary[RUNNER]?.revealed).toBe('resist');
    expect(ofType(ctx.events, 'bestiaryUpdated').filter((e) => e.field === 'weakness').map((e) => e.creatureId)).toEqual([BRUTE, RUNNER]);
    recordSeen(ctx, { enemies: [{ refId: 'cr_fixture_bell' }, { refId: SHADE }] } as unknown as CombatState);
    expect([ctx.profile.bestiary.cr_fixture_bell?.revealed, ctx.profile.bestiary[SHADE]?.revealed]).toEqual(['resist', 'none']);
  });

  test('spared (communion, U29) is a first entry too: +3 once, and a later kill pays nothing more', () => {
    const ctx = scriptedCtx(state(), [], content, profile);
    recordSpared(ctx, TIDE);
    recordKill(ctx, TIDE);
    expect(ctx.profile.bestiary[TIDE]).toMatchObject({ spared: 1, killed: 1 });
    expect(ofType(ctx.events, 'resonanceGained')).toHaveLength(1);
  });

  test('seen when the fight ends however it ends — won, fled, lost (Loop 1 FALLEN) — adds included; intents seen once each, hidden ones not', () => {
    const fled = act(open(state(), spec(RUNNER)), { type: 'flee' }, [D.pct(0)]);
    expect(ofType(fled.events, 'combatEnded')[0]?.result).toBe('fled');
    expect(fled.profile.bestiary[RUNNER]).toMatchObject({ seen: 1, killed: 0 });
    const dying = open(state(), spec(RUNNER));
    (dying.combat as CombatState).party[0]!.hp = 1;
    const fallen = act(dying, { type: 'guard' }, HIT);
    expect(fallen.state.combat?.phase).toBe('defeat');
    expect(fallen.profile.bestiary[RUNNER]).toMatchObject({ seen: 1, killed: 0 });
    // intents: a hidden chip is not "seen"; a seen one is not written twice (the profile stays the input object)
    const ctx = scriptedCtx(open(state(), spec(ABERRATION)), [], content, profile);
    const c = ctx.s.combat as CombatState;
    const add = c.enemies[0]!;
    c.intents[add.uid] = { moveId: 'aberration_flicker_strike', targetUid: null, projected: [0, 0], hidden: true, text: '', tags: [] };
    noteIntentsSeen(ctx, c);
    expect(ctx.events).toEqual([]);
    c.intents[add.uid]!.hidden = false;
    noteIntentsSeen(ctx, c);
    expect(ctx.profile.bestiary[ABERRATION]?.intentsSeen).toEqual(['aberration_flicker_strike']);
    const again = scriptedCtx(ctx.s, [], content, ctx.profile as Profile);
    noteIntentsSeen(again, again.s.combat as CombatState);
    expect(again.events).toEqual([]);
    expect(again.profile).toBe(ctx.profile);
  });

  test('step contract: a fight step that kills nothing new and sees no new intent hands back the input profile', () => {
    const s0 = open(state(), spec(TIDE, { fleeable: false, onFlee: 'hold' }));
    const prof = act(s0, { type: 'guard' }, [D.pct(0), D.variance(1), D.pct(99)]).profile;
    expect(prof.bestiary[TIDE]?.intentsSeen).toEqual(['tide_wash']);
    const out = step(s0, { type: 'guard' }, content, prof);
    expect(ofType(out.events, 'actionRejected')).toEqual([]);
    expect(out.profile).toBe(prof);
  });
});
