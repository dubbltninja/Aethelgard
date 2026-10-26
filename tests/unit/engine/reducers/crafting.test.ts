// U34: the Emberforge — PLAN §8.1 row "crafting/upgrade" (recipe inputs consumed incl. the `anyOf` fragment, the
// Ironclad tier gate and its Neutral waiver while `q_the_mending`/`q_iron_silence` is active, story recipes cost 0,
// upgrade costs by rarity with materials, an affix slot added on tier-up, Legendary not upgradeable, salvage yields,
// every fragment-giving Heartstone choice gives 2), the Breach-anchor with each fragment, the poverty rule, plus fees with
// Borin's Favor, read patterns (`unlockRecipe`), Echo/flag requirements, the per-visit time rule and the forge's smith.
// DESIGN §8, §9.6, §10.7; WORLD §8; D-017, D-052, D-066 #10, D-067.6, D-073.
import { describe, expect, test } from 'bun:test';
import {
  applyAll,
  craftQuote,
  isLegal,
  legalActions,
  makeCtx,
  step,
  upgradeAffixSlots,
  upgradeOffers,
  upgradeQuote,
  type Action,
  type GameEvent,
  type GameState,
  type ItemInstance,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { ANCHOR, BORIN, DEAD, FORGE, HEARTSTONE, PATTERN, RESPITE, STABLE, economyPack } from '@tests/fixtures/economyContent';
import { freshProfile, makeState, type ItemSpec, type StateOverrides } from '@tests/fixtures/helpers';

const pack = economyPack();

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);

interface Run {
  s: GameState;
  prof: Profile;
  last: Ev[];
}
const start = (o: StateOverrides = {}, prof?: Profile): Run => {
  const profile = prof ?? freshProfile({ loopCounter: o.loop ?? 1 });
  return { s: makeState({ locationId: FORGE, ...o }, { content: pack, profile }), prof: profile, last: [] };
};
function act(r: Run, action: Action): Run {
  const out = step(r.s, action, pack, r.prof);
  const rejected = ofType(out.events, 'actionRejected')[0];
  if (rejected) throw new Error(`${JSON.stringify(action)} was rejected: ${rejected.reason}`);
  return { s: out.state, prof: out.profile, last: out.events };
}
const run = (r: Run, actions: readonly Action[]): Run => actions.reduce(act, r);
function refused(r: Run, action: Action): string {
  const out = step(r.s, action, pack, r.prof);
  expect(out.state).toBe(r.s);
  return ofType(out.events, 'actionRejected')[0]?.reason ?? '(accepted)';
}
const count = (s: GameState, itemId: string): number => s.player.inventory.filter((i) => i.itemId === itemId).reduce((n, i) => n + i.qty, 0);
type Spec = string | ItemSpec;
const stack = (itemId: string, qty: number): ItemSpec => ({ itemId, qty });
const pieceOf = (r: Run, itemId: string): ItemInstance => {
  const inst = r.s.player.inventory.find((i) => i.itemId === itemId) ?? Object.values(r.s.player.equipment).find((i) => i?.itemId === itemId);
  if (!inst) throw new Error(`no ${itemId}`);
  return inst;
};
const craft = (recipeId: string): Action => ({ type: 'craft', recipeId });
const FAVOR = { patch: (s: GameState) => void (s.player.attunements = ['att_borins_favor']) };

/** The Breach-anchor's fixed inputs (DESIGN §8.5): Aetherium ×3, Void Shard ×3, Ember Ore ×3, heartwood ×1. */
const ANCHOR_INPUTS: Spec[] = [stack('item_aetherium_shard', 3), stack('item_void_shard', 3), stack('mat_ember_ore', 3), stack('mat_silverwood_heartwood', 1)];
const SCHEMA = freshProfile({ echoes: ['echo_anchor_schema'] });
const anchorRun = (fragments: Spec[], o: StateOverrides = {}): Run =>
  start({ reputation: { ironclad: 20 }, gold: 50, items: [...ANCHOR_INPUTS, ...fragments], ...o }, SCHEMA);

describe('the Heartstone choice and the Breach-anchor (D-017, D-052, D-066 #10)', () => {
  const choose = (eventId: string): GameState => {
    const ctx = makeCtx(clone(makeState({ locationId: HEARTSTONE }, { content: pack })), freshProfile(), pack);
    applyAll(pack.locations[HEARTSTONE]!.events.find((e) => e.id === eventId)!.effects, ctx);
    return ctx.s;
  };

  test('Stabilize and Destroy each give two fragments; Exploit gives the Core and none', () => {
    const stable = choose('ev_heartstone_stabilize');
    const dead = choose('ev_heartstone_destroy');
    const core = choose('ev_heartstone_exploit');
    expect([count(stable, STABLE), count(stable, DEAD)]).toEqual([2, 0]);
    expect([count(dead, STABLE), count(dead, DEAD)]).toEqual([0, 2]);
    expect([count(core, STABLE), count(core, DEAD), count(core, 'item_heartstone_core')]).toEqual([0, 0, 1]);
  });

  test.each([
    ['the stable fragment (Stabilize: seals, ending B)', STABLE],
    ['the dead fragment (Destroy: cuts, ending D)', DEAD],
  ])('crafted with %s; the second fragment is left for Mireya’s dam; story recipe: no fee', (_label, fragment) => {
    const r = anchorRun([fragment, fragment]); // quest items do not stack
    const out = act(r, craft('recipe_breach_anchor'));
    expect(count(out.s, ANCHOR)).toBe(1);
    expect(count(out.s, fragment)).toBe(1);
    for (const id of ['item_aetherium_shard', 'item_void_shard', 'mat_ember_ore', 'mat_silverwood_heartwood']) expect(count(out.s, id)).toBe(0);
    expect(out.s.player.gold).toBe(50);
    expect(ofType(out.last, 'goldChanged')).toEqual([]);
    expect(ofType(out.last, 'itemLost').map((e) => [e.itemId, e.qty, e.reason])).toEqual([
      ['item_aetherium_shard', 3, 'crafted'],
      ['item_void_shard', 3, 'crafted'],
      ['mat_ember_ore', 3, 'crafted'],
      ['mat_silverwood_heartwood', 1, 'crafted'],
      [fragment, 1, 'crafted'],
    ]);
    expect(ofType(out.last, 'crafted')).toEqual([{ t: 'crafted', recipeId: 'recipe_breach_anchor', item: { ...pieceOf(out, ANCHOR) } }]);
    expect(out.s.counters.itemsCrafted).toBe(1);
  });

  test('anyOf: the first payable group pays (stable before dead); with neither, both options are named', () => {
    const both = act(anchorRun([STABLE, DEAD]), craft('recipe_breach_anchor'));
    expect([count(both.s, STABLE), count(both.s, DEAD)]).toEqual([0, 1]);
    expect(refused(anchorRun([]), craft('recipe_breach_anchor'))).toBe('Missing: Stable Heartstone Fragment ×1 or Dead Heartstone Fragment ×1');
    const short = start({ reputation: { ironclad: 20 }, items: [stack('item_aetherium_shard', 1), STABLE] }, SCHEMA);
    expect(refused(short, craft('recipe_breach_anchor'))).toBe(
      'Missing: Aetherium Shard ×2, Void Shard ×3, Ember Ore ×3, Silverwood Heartwood ×1; and Stable Heartstone Fragment ×1 or Dead Heartstone Fragment ×1',
    );
  });

  test('the Ironclad gate: Trusted, or Neutral while q_the_mending or q_iron_silence is active (never below)', () => {
    expect(refused(anchorRun([STABLE], { reputation: { ironclad: 0 } }), craft('recipe_breach_anchor'))).toBe(
      'Borin forges the Breach-anchor only for those the Ironclad Nomads hold trusted',
    );
    for (const quest of ['q_the_mending', 'q_iron_silence']) {
      const r = anchorRun([STABLE], { reputation: { ironclad: 0 }, quests: { [quest]: 'forge' } });
      expect(count(act(r, craft('recipe_breach_anchor')).s, ANCHOR)).toBe(1);
    }
    const wary = anchorRun([STABLE], { reputation: { ironclad: -20 }, quests: { q_the_mending: 'forge' } });
    expect(refused(wary, craft('recipe_breach_anchor'))).toBe('Borin forges the Breach-anchor only for those the Ironclad Nomads hold neutral');
    const done = anchorRun([STABLE], { reputation: { ironclad: 0 }, quests: { q_the_mending: { status: 'completed' } } });
    expect(refused(done, craft('recipe_breach_anchor'))).toContain('hold trusted');
  });

  test('the recipe needs echo_anchor_schema (from any loop)', () => {
    const r = start({ reputation: { ironclad: 20 }, items: [...ANCHOR_INPUTS, STABLE] });
    expect(refused(r, craft('recipe_breach_anchor'))).toMatch(/^Breach-anchor requires: /);
    const thisLoop = start({ reputation: { ironclad: 20 }, items: [...ANCHOR_INPUTS, STABLE], echoes: ['echo_anchor_schema'] });
    expect(count(act(thisLoop, craft('recipe_breach_anchor')).s, ANCHOR)).toBe(1);
  });
});

describe('recipes (DESIGN §8.1, WORLD §8.2)', () => {
  const VOID_INPUTS: Spec[] = [stack('item_void_shard', 3), stack('mat_ember_ore', 3), stack('mat_iron_rivet', 2)];

  test("Echo/flag requirements: void-forged needs the Shards refused, and Trusted or echo_borin_oath; the fee takes Borin's Favor", () => {
    expect(refused(start({ gold: 200, reputation: { ironclad: 20 }, items: VOID_INPUTS }), craft('recipe_voidforged_edge'))).toMatch(/^Voidforged Edge requires: /);
    const refusedShards = { gold: 200, items: VOID_INPUTS, flags: { flag_shards_refused: true } };
    expect(refused(start(refusedShards), craft('recipe_voidforged_edge'))).toMatch(/^Voidforged Edge requires: /);
    const trusted = act(start({ ...refusedShards, reputation: { ironclad: 20 } }), craft('recipe_voidforged_edge'));
    expect(trusted.s.player.gold).toBe(80);
    const oath = act(start(refusedShards, freshProfile({ echoes: ['echo_borin_oath'] })), craft('recipe_voidforged_edge'));
    expect(count(oath.s, 'item_voidforged_edge')).toBe(1);
    const favored = act(start({ ...refusedShards, reputation: { ironclad: 20 }, ...FAVOR }), craft('recipe_voidforged_edge'));
    expect(favored.s.player.gold).toBe(200 - 102); // 120 × 0.85
    expect(ofType(favored.last, 'goldChanged')).toEqual([{ t: 'goldChanged', delta: -102, total: 98 }]);
    expect(refused(start({ ...refusedShards, gold: 101, reputation: { ironclad: 20 }, ...FAVOR }), craft('recipe_voidforged_edge'))).toBe(
      "Borin's fee is 102 gold; you have 101",
    );
  });

  test('the output: its count (Ember Flask ×2), Common unless noted, its affixes for that rarity', () => {
    const r = act(start({ gold: 20, items: [stack('mat_ember_ore', 1), stack('mat_ley_resin', 1)] }), craft('recipe_ember_flask'));
    expect(count(r.s, 'item_ember_flask')).toBe(2);
    expect(r.s.player.gold).toBe(0);
    expect(ofType(r.last, 'crafted')[0]?.item).toMatchObject({ itemId: 'item_ember_flask', qty: 2, rarity: 'common' });
    expect(act(start({ gold: 50, items: [stack('mat_ley_spark', 2), stack('mat_iron_rivet', 1)] }), craft('recipe_glyphbound_lantern')).s.player.inventory.at(-1)).toMatchObject({
      itemId: 'item_glyphbound_lantern',
      rarity: 'common',
      affixes: [],
    });
  });

  test('a read pattern: the recipe is known once its pattern is used (unlockRecipe), for the rest of the loop', () => {
    const items = [PATTERN, stack('mat_ember_ore', 5), stack('mat_breach_glass', 2), stack('mat_frayed_moment', 2), stack('mat_silverwood_heartwood', 1)];
    const r = start({ gold: 300, items });
    expect(refused(r, craft('recipe_breachsteel_blade'))).toBe('Read the Pattern: Breachsteel Blade first');
    const read = act(r, { type: 'use', uid: pieceOf(r, PATTERN).uid });
    expect(count(read.s, PATTERN)).toBe(0);
    expect(read.s.player.uses['recipe:recipe_breachsteel_blade']).toEqual({ loop: 1 });
    const made = act(read, craft('recipe_breachsteel_blade'));
    expect(count(made.s, 'item_breachsteel_blade')).toBe(1);
    expect(made.s.player.gold).toBe(20);
  });

  test('time: the first forge job of a visit costs its watch, later ones none; a new visit pays again', () => {
    const flaskKit = [stack('mat_ember_ore', 4), stack('mat_ley_resin', 4)];
    const r = start({ gold: 200, items: flaskKit, reputation: { ironclad: 20 } });
    const first = act(r, craft('recipe_ember_flask'));
    expect(first.s.clock.ticks - r.s.clock.ticks).toBe(1);
    const second = act(first, craft('recipe_ember_flask'));
    expect(second.s.clock.ticks).toBe(first.s.clock.ticks);
    const sword = act(second, { type: 'upgrade', uid: pieceOf(r, 'item_rusty_dagger').uid });
    expect(sword.s.clock.ticks).toBe(first.s.clock.ticks);
    const back = run(sword, [{ type: 'move', to: RESPITE }, { type: 'move', to: FORGE }]);
    const again = act(back, craft('recipe_ember_flask'));
    expect(again.s.clock.ticks - back.s.clock.ticks).toBe(1);
  });

  test('only at the Emberforge, with Borin there and willing; unknown recipes', () => {
    expect(refused(start({ locationId: RESPITE }), craft('recipe_ember_flask'))).toBe('Only at the Emberforge');
    expect(refused(start({ reputation: { ironclad: -40 } }), craft('recipe_ember_flask'))).toBe('Borin Stonefist will not trade with you');
    const away = start({ patch: (s) => void (s.world.npcOverrides[BORIN] = { location: null }) });
    expect(refused(away, craft('recipe_ember_flask'))).toBe('Borin Stonefist is not at the forge');
    expect(legalActions(away.s, pack, away.prof).filter((a) => a.type === 'craft' || a.type === 'upgrade' || a.type === 'salvage')).toEqual([]);
    expect(refused(start(), craft('recipe_ghost'))).toBe("There is no recipe 'recipe_ghost'");
  });
});

describe('upgrades (DESIGN §8.3)', () => {
  const sword = (rarity: ItemInstance['rarity'], affixes: string[] = []): ItemSpec => ({ itemId: 'item_warriors_sword', rarity, affixes });
  const up = (r: Run, extra: Partial<Extract<Action, { type: 'upgrade' }>> = {}): Action => ({ type: 'upgrade', uid: pieceOf(r, 'item_warriors_sword').uid, ...extra });

  test('Common → Uncommon: 0.5 × gold_value, gold only (§9.6 rule 4), no slot', () => {
    const r = start({ gold: 20, items: [sword('common')] });
    const out = act(r, up(r));
    expect(pieceOf(out, 'item_warriors_sword')).toMatchObject({ rarity: 'uncommon', affixes: [] });
    expect(out.s.player.gold).toBe(0);
    expect(ofType(out.last, 'upgraded')[0]?.item).toMatchObject({ rarity: 'uncommon' });
    expect(out.s.counters.itemsUpgraded).toBe(1);
    expect(refused(r, up(r, { affixId: 'affix_of_iron' }))).toBe("No affix slot opens on the Warrior's Sword at uncommon");
    expect(act(start({ gold: 17, items: [sword('common')], ...FAVOR }), up(r)).s.player.gold).toBe(0); // 20 × 0.85
  });

  test('U81a (D-118): an upgraded Uncommon is a rolled Uncommon without its affix; both reach Rare with one and Epic with two', () => {
    expect([upgradeAffixSlots({ affixes: [] }, 'uncommon'), upgradeAffixSlots({ affixes: [] }, 'rare'), upgradeAffixSlots({ affixes: ['affix_of_iron'] }, 'rare')]).toEqual([0, 1, 0]);
    expect([upgradeAffixSlots({ affixes: ['affix_of_iron'] }, 'epic'), upgradeAffixSlots({ affixes: ['affix_of_iron', 'affix_of_the_gale'] }, 'legendary')]).toEqual([1, 0]);
    const rich = { gold: 500, reputation: { ironclad: 20 } };
    // the upgraded one: Common → Uncommon (no affix), → Rare (one offered slot), → Epic (a second)
    let a = start({ ...rich, items: [sword('common'), stack('mat_ember_ore', 5), stack('mat_slate_core', 2)] });
    a = act(a, up(a));
    expect(pieceOf(a, 'item_warriors_sword')).toMatchObject({ rarity: 'uncommon', affixes: [] });
    const qa = upgradeQuote(a.s, pack, a.prof, pieceOf(a, 'item_warriors_sword').uid);
    if (typeof qa === 'string') throw new Error(qa);
    a = act(a, up(a, { affixId: qa.offers[0]! }));
    expect(pieceOf(a, 'item_warriors_sword').affixes).toHaveLength(1);
    // the rolled one: an Uncommon that drew its affix → Rare opens nothing (it already holds Rare's one)
    let b = start({ ...rich, items: [sword('uncommon', ['affix_of_iron']), stack('mat_ember_ore', 5), stack('mat_slate_core', 2)] });
    expect(refused(b, up(b, { affixId: 'affix_of_the_gale' }))).toBe("No affix slot opens on the Warrior's Sword at rare");
    b = act(b, up(b));
    expect(pieceOf(b, 'item_warriors_sword')).toMatchObject({ rarity: 'rare', affixes: ['affix_of_iron'] });
    // Epic: both get the second slot
    for (const r of [a, b]) {
      const q = upgradeQuote(r.s, pack, r.prof, pieceOf(r, 'item_warriors_sword').uid);
      if (typeof q === 'string') throw new Error(q);
      expect([q.target, q.newSlots]).toEqual(['epic', 1]);
      expect(pieceOf(act(r, up(r, { affixId: q.offers[0]! })), 'item_warriors_sword').affixes).toHaveLength(2);
    }
  });

  test('Uncommon → Rare: 1.0 ×, Ember Ore ×2; the new slot takes one of three offered affixes (the player picks)', () => {
    const r = start({ gold: 44, items: [sword('uncommon'), stack('mat_ember_ore', 2)] });
    const q = upgradeQuote(r.s, pack, r.prof, pieceOf(r, 'item_warriors_sword').uid);
    if (typeof q === 'string') throw new Error(q);
    expect([q.target, q.fee, q.newSlots, q.offers.length]).toEqual(['rare', 44, 1, 3]);
    expect(q.offers).toEqual(upgradeOffers(r.s, pack, q.inst, q.def, 'rare'));
    expect(refused(r, up(r))).toBe(`Choose an affix for the new slot: ${q.offers.join(', ')}`);
    expect(refused(r, up(r, { affixId: 'affix_of_nothing' }))).toMatch(/^'affix_of_nothing' is not one of the affixes offered/);
    const pick = q.offers[1]!;
    const out = act(r, up(r, { affixId: pick }));
    expect(pieceOf(out, 'item_warriors_sword')).toMatchObject({ rarity: 'rare', affixes: [pick] });
    expect(count(out.s, 'mat_ember_ore')).toBe(0);
    expect(refused(start({ gold: 44, items: [sword('uncommon'), stack('mat_ember_ore', 1)] }), up(r, { affixId: pick }))).toBe('Missing: Ember Ore ×1');
    expect(refused(start({ gold: 43, items: [sword('uncommon'), stack('mat_ember_ore', 2)] }), up(r, { affixId: pick }))).toBe("Borin's fee is 44 gold; you have 43");
  });

  test('Rare → Epic: 1.5 ×, Ember Ore ×3 + 2 of the tier material, Trusted; a second affix slot', () => {
    const kit = [sword('rare', ['affix_of_iron']), stack('mat_ember_ore', 3), stack('mat_slate_core', 2)];
    const neutral = start({ gold: 75, items: kit });
    expect(refused(neutral, up(neutral))).toBe('Borin takes work to epic only for those the Ironclad Nomads hold trusted');
    const r = start({ gold: 75, items: kit, reputation: { ironclad: 20 } });
    const q = upgradeQuote(r.s, pack, r.prof, pieceOf(r, 'item_warriors_sword').uid);
    if (typeof q === 'string') throw new Error(q);
    expect(q.offers).not.toContain('affix_of_iron');
    const out = act(r, up(r, { affixId: q.offers[0]! }));
    expect(pieceOf(out, 'item_warriors_sword')).toMatchObject({ rarity: 'epic', affixes: ['affix_of_iron', q.offers[0]] });
    expect([out.s.player.gold, count(out.s, 'mat_ember_ore'), count(out.s, 'mat_slate_core')]).toEqual([0, 0, 0]);
  });

  test('Epic → Legendary: 2.0 ×, Ember Ore ×5 + Frayed Moment ×2 + one regional rare (the first held); no new slot at 2', () => {
    const kit = [sword('epic', ['affix_of_iron', 'affix_of_the_gale']), stack('mat_ember_ore', 5), stack('mat_frayed_moment', 2)];
    const pearl = start({ gold: 120, items: [...kit, stack('mat_drowned_pearl', 1), stack('mat_tyrant_shard', 1)], reputation: { ironclad: 20 } });
    const out = act(pearl, up(pearl));
    expect(pieceOf(out, 'item_warriors_sword')).toMatchObject({ rarity: 'legendary', affixes: ['affix_of_iron', 'affix_of_the_gale'] });
    expect([count(out.s, 'mat_drowned_pearl'), count(out.s, 'mat_tyrant_shard'), out.s.player.gold]).toEqual([0, 1, 0]);
    const none = start({ gold: 120, items: kit, reputation: { ironclad: 20 } });
    expect(refused(none, up(none))).toBe('Missing: Breach Glass ×1 or Drowned Pearl ×1 or Silverwood Heartwood ×1 or Tyrant Shard ×1');
    expect(refused(start({ items: [sword('legendary')], reputation: { ironclad: 60 } }), up(pearl))).toBe("The Warrior's Sword is Legendary; nothing is finer");
  });

  test('tier materials: either of a T1 pair (arcane gear spends the Ley Spark first); a trinket may spend a second Talisman', () => {
    const lantern = (extra: Spec[]) =>
      start({ gold: 100, reputation: { ironclad: 20 }, items: [{ itemId: 'item_glyphbound_lantern', rarity: 'rare', affixes: ['affix_of_vigor'] }, stack('mat_ember_ore', 3), ...extra] });
    const upLantern = (r: Run) => {
      const q = upgradeQuote(r.s, pack, r.prof, pieceOf(r, 'item_glyphbound_lantern').uid);
      if (typeof q === 'string') return q;
      return act(r, { type: 'upgrade', uid: q.inst.uid, affixId: q.offers[0]! });
    };
    const both = upLantern(lantern([stack('mat_ley_spark', 2), stack('mat_wildling_hide', 2)])) as Run;
    expect([count(both.s, 'mat_ley_spark'), count(both.s, 'mat_wildling_hide')]).toEqual([0, 2]);
    const hide = upLantern(lantern([stack('mat_wildling_hide', 2)])) as Run;
    expect(count(hide.s, 'mat_wildling_hide')).toBe(0);
    const talismans = upLantern(lantern(['item_sky_whisper_talisman', 'item_sky_whisper_talisman'])) as Run;
    expect(count(talismans.s, 'item_sky_whisper_talisman')).toBe(1);
    const worn = upLantern(lantern(['item_sky_whisper_talisman', { itemId: 'item_sky_whisper_talisman', equip: true }])) as Run;
    expect(count(worn.s, 'item_sky_whisper_talisman')).toBe(0);
    expect(worn.s.player.equipment.trinket1?.itemId).toBe('item_sky_whisper_talisman');
    expect(upLantern(lantern(['item_sky_whisper_talisman']))).toBe('Missing: Ley Spark ×2 or Wildling Hide ×2 or Sky-Whisper Talisman ×1');
    const melee = start({ gold: 100, reputation: { ironclad: 20 }, items: [{ itemId: 'item_rusty_dagger', rarity: 'rare' }, stack('mat_ember_ore', 3), stack('mat_ley_spark', 2), stack('mat_wildling_hide', 2)] });
    const q = upgradeQuote(melee.s, pack, melee.prof, pieceOf(melee, 'item_rusty_dagger').uid);
    if (typeof q === 'string') throw new Error(q);
    expect(q.pay.map((n) => n.itemId)).toEqual(['mat_ember_ore', 'mat_wildling_hide']);
  });

  test('a worn piece is upgraded in place; bound or non-gear pieces cannot be', () => {
    const r = start({ gold: 20, items: [{ itemId: 'item_warriors_sword', equip: true }] });
    const out = act(r, up(r));
    expect(out.s.player.equipment.weapon).toMatchObject({ itemId: 'item_warriors_sword', rarity: 'uncommon' });
    const core = start({ items: [{ itemId: 'item_heartstone_core', equip: true }] });
    expect(refused(core, { type: 'upgrade', uid: core.s.player.equipment.trinket1!.uid })).toBe('The Heartstone Core cannot be upgraded');
    const moss = start({ items: ['item_glow_moss'] });
    expect(refused(moss, { type: 'upgrade', uid: pieceOf(moss, 'item_glow_moss').uid })).toBe('The Glow Moss cannot be upgraded');
    expect(refused(moss, { type: 'upgrade', uid: 'i9999' })).toBe('You are not carrying that');
  });
});

describe('salvage (DESIGN §8.4)', () => {
  const salvageOf = (spec: ItemSpec, o: StateOverrides = {}): Run => {
    const r = start({ items: [spec], ...o });
    return act(r, { type: 'salvage', uid: pieceOf(r, spec.itemId).uid });
  };

  test('yields by rarity: tier material 1/2/2/3/3, Ember Ore 0/0/1/2/2; no gold, no time', () => {
    const yields = (rarity: ItemInstance['rarity']) => {
      const out = salvageOf({ itemId: 'item_warriors_sword', rarity });
      expect(out.s.player.gold).toBe(start().s.player.gold);
      expect(out.s.clock.ticks).toBe(0);
      expect(count(out.s, 'item_warriors_sword')).toBe(0);
      return [count(out.s, 'mat_slate_core'), count(out.s, 'mat_ember_ore')];
    };
    expect(['common', 'uncommon', 'rare', 'epic', 'legendary'].map((r) => yields(r as ItemInstance['rarity']))).toEqual([
      [1, 0],
      [2, 0],
      [2, 1],
      [3, 2],
      [3, 2],
    ]);
  });

  test("the piece's own kind of tier material (T1 martial: hide; staves, focuses, trinkets: Ley Spark); an 'of the Void' piece returns a Void Shard", () => {
    expect(count(salvageOf({ itemId: 'item_rusty_dagger' }).s, 'mat_wildling_hide')).toBe(1);
    expect(count(salvageOf({ itemId: 'item_apprentice_staff' }).s, 'mat_ley_spark')).toBe(1);
    expect(count(salvageOf({ itemId: 'item_glyphbound_lantern' }).s, 'mat_ley_spark')).toBe(1);
    const voidMail = salvageOf({ itemId: 'item_ironclad_mail', rarity: 'rare', affixes: ['affix_of_the_void'] });
    expect([count(voidMail.s, 'mat_wildling_hide'), count(voidMail.s, 'mat_ember_ore'), count(voidMail.s, 'item_void_shard')]).toEqual([2, 1, 1]);
    expect(ofType(voidMail.last, 'itemGiven').map((e) => e.source)).toEqual(['salvage:item_ironclad_mail', 'salvage:item_ironclad_mail', 'salvage:item_ironclad_mail']);
  });

  test('worn, bound and non-gear pieces are refused; a full pack leaves the yield on the ground', () => {
    const worn = start({ items: [{ itemId: 'item_warriors_sword', equip: true }] });
    expect(refused(worn, { type: 'salvage', uid: worn.s.player.equipment.weapon!.uid })).toBe('Take it off first');
    const core = start({ items: ['item_heartstone_core'] });
    expect(refused(core, { type: 'salvage', uid: pieceOf(core, 'item_heartstone_core').uid })).toBe('The Heartstone Core is bound to you');
    const ore = start({ items: [stack('mat_ember_ore', 2)] });
    expect(refused(ore, { type: 'salvage', uid: pieceOf(ore, 'mat_ember_ore').uid })).toBe('Only weapons, armor and trinkets can be salvaged');
    const full = start({
      patch: (s) =>
        void (s.player.inventory = Array.from({ length: 40 }, (_, i) => ({ uid: `f${i}`, itemId: 'item_rusty_dagger', qty: 1, rarity: 'rare' as const, affixes: [] }))),
    });
    const out = act(full, { type: 'salvage', uid: 'f0' });
    expect(count(out.s, 'mat_wildling_hide')).toBe(2);
    expect(out.s.world.locationStates[FORGE]?.items.map((i) => [i.itemId, i.qty])).toEqual([['mat_ember_ore', 1]]);
  });
});

describe('never soft-locked by poverty (DESIGN §9.6 rule 4) and enumeration (PLAN §4.7)', () => {
  test('penniless: a Common → Uncommon upgrade needs only its gold, a story recipe nothing; quotes say why not', () => {
    const r = start({ gold: 0, items: [{ itemId: 'item_rusty_dagger' }] });
    expect(refused(r, { type: 'upgrade', uid: pieceOf(r, 'item_rusty_dagger').uid })).toBe("Borin's fee is 4 gold; you have 0");
    expect(act({ ...r, s: { ...r.s, player: { ...r.s.player, gold: 4 } } }, { type: 'upgrade', uid: pieceOf(r, 'item_rusty_dagger').uid }).s.player.gold).toBe(0);
    const anchor = anchorRun([STABLE], { gold: 0 });
    expect(count(act(anchor, craft('recipe_breach_anchor')).s, ANCHOR)).toBe(1);
    expect(typeof craftQuote(anchor.s, pack, anchor.prof, 'recipe_breach_anchor')).toBe('object');
  });

  test('every listed craft/upgrade/salvage is accepted; upgrades with a new slot list one action per offered affix', () => {
    const r = start({
      gold: 500,
      reputation: { ironclad: 20 },
      items: [
        { itemId: 'item_warriors_sword', rarity: 'uncommon' },
        { itemId: 'item_rusty_dagger', equip: true },
        stack('mat_ember_ore', 6),
        stack('mat_ley_resin', 2),
        stack('mat_ley_spark', 2),
        stack('mat_iron_rivet', 1),
        'item_heartstone_core',
      ],
    });
    const legal = legalActions(r.s, pack, r.prof).filter((a) => a.type === 'craft' || a.type === 'upgrade' || a.type === 'salvage');
    expect(legal.filter((a) => a.type === 'craft').map((a) => (a as { recipeId: string }).recipeId)).toEqual(['recipe_ember_flask', 'recipe_glyphbound_lantern']);
    const sword = pieceOf(r, 'item_warriors_sword').uid;
    expect(legal.filter((a) => a.type === 'upgrade' && a.uid === sword)).toHaveLength(3);
    expect(legal.some((a) => a.type === 'salvage' && a.uid === pieceOf(r, 'item_heartstone_core').uid)).toBe(false);
    for (const a of legal) {
      expect(isLegal(r.s, a, pack, r.prof)).toBe(true);
      expect(ofType(step(r.s, a, pack, r.prof).events, 'actionRejected')).toEqual([]);
    }
  });
});
