// U34e item 2 — the item `custom` passives the engine did not read (D-099, D-101), each per its WORLD §7 row: the Clapper's
// basic Stun, the Diver's Coat and Salt Charm, the Lantern-Moth Brooch, the Unlidded Eye, Oriel's Quill, the named cleanses,
// the Whetstone Strip, Remnant Ink, Lantern Oil's ward, the Keeper's Copy, the Scout's Whistle, the Remnant Wax Seal and Korr's
// Marginalia counting as a Spellbook (`readBook` counts toward `spellbooksRead` whatever the book costs). The Weaver's Thread
// Ring's `hazard_immunity` is item 5's (hazards.test.ts). Real-pack items, deterministic draws.
import { describe, expect, test } from 'bun:test';
import { buildContentPack, type ContentTables } from '@content/index';
import { questItems, tomes } from '@content/items/quest';
import {
  FORESIGHT_KEY,
  PREP_USE,
  WHETSTONE_KEY,
  applyHit,
  applyStatus,
  basicAttackOf,
  beginCombat,
  cleanseOnUse,
  findStatus,
  fixedHit,
  gearFightOpening,
  keepForesight,
  legalActions,
  playerAbilityCost,
  playerOf,
  restock,
  stockView,
  wardHolds,
  whetstoneSpec,
  type Action,
  type CombatState,
  type EncounterSpec,
  type GameState,
  type StepCtx,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { companionTables } from '@tests/fixtures/companionContent';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';
import { FIXTURE_VERSION, miniContentTables } from '@tests/fixtures/miniContent';

const pack = buildContentPack();
const profile = freshProfile();
const at = (o: StateOverrides = {}): GameState => makeState(o, { content: pack, profile });
const run = (s: GameState, actions: Action[]) => play(s, actions, { content: pack, profile });
const uidOf = (s: GameState, itemId: string): string => {
  const inst = s.player.inventory.find((i) => i.itemId === itemId);
  if (!inst) throw new Error(`no ${itemId}`);
  return inst.uid;
};

const spec = (creatureId: string): EncounterSpec => ({
  id: 'enc_u34e_test', groups: [{ creatureId, count: 1 }], fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [],
});
/** A fight against a Wildling Brute where the state stands; extra draws for what the test rolls. */
function fight(s: GameState, draws: number[] = []): { ctx: StepCtx; combat: CombatState } {
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1), ...draws], pack, profile);
  const combat = beginCombat(ctx, spec('cr_wildling_brute'));
  return { ctx, combat };
}

describe('combat scripts', () => {
  test('basic_stun_chance: the Clapper makes a heavy basic attack’s Stun 20 % (base 10 %)', () => {
    expect(basicAttackOf(at({ classId: 'ironclad_warden' }), pack).stunChance).toBe(0.1);
    const clapper = at({ classId: 'ironclad_warden', items: [{ itemId: 'item_bell_clapper', equip: true }] });
    expect(basicAttackOf(clapper, pack).stunChance).toBe(0.2);
  });

  test('status_duration_reduction: Soaked lasts 2 under the Diver’s Coat; Poison 3 and Bleed 2 under the Salt Charm; others untouched', () => {
    const coat = fight(at({ items: [{ itemId: 'item_divers_coat', equip: true }] }));
    const me = playerOf(coat.combat);
    applyStatus(coat.ctx, coat.combat, null, me, 'status_soaked');
    expect(findStatus(me, 'status_soaked')?.duration).toBe(2);
    applyStatus(coat.ctx, coat.combat, null, me, 'status_weaken');
    expect(findStatus(me, 'status_weaken')?.duration).toBe(2);
    const charm = fight(at({ items: [{ itemId: 'item_salt_charm', equip: true }] }));
    const p2 = playerOf(charm.combat);
    applyStatus(charm.ctx, charm.combat, null, p2, 'status_poison');
    applyStatus(charm.ctx, charm.combat, null, p2, 'status_bleed');
    expect([findStatus(p2, 'status_poison')?.duration, findStatus(p2, 'status_bleed')?.duration]).toEqual([3, 2]);
    // never below 1, and an enemy is untouched
    applyStatus(charm.ctx, charm.combat, null, p2, 'status_poison', { duration: 1 });
    expect(findStatus(p2, 'status_poison')?.duration).toBe(1);
    const foe = charm.combat.enemies[0]!;
    applyStatus(charm.ctx, charm.combat, null, foe, 'status_bleed');
    expect(findStatus(foe, 'status_bleed')?.duration).toBe(3);
  });

  test('low_hp_status: the Lantern-Moth Brooch gives Regen 4 for 3 turns the first time a hit takes HP under 30 %, once a fight', () => {
    const s = at({ items: [{ itemId: 'item_lantern_moth_brooch', equip: true }] });
    const { ctx, combat } = fight(s);
    const me = playerOf(combat);
    const brute = combat.enemies[0]!;
    const hit = { source: 'brute_maul', type: 'physical' as const, base: 0, coef: 1, stat: 'atk' as const };
    const toJustAbove = me.hp - Math.ceil(0.3 * me.hpMax);
    applyHit(ctx, combat, brute, me, hit, fixedHit(toJustAbove, false, []), 'intent');
    expect(findStatus(me, 'status_regen')).toBeUndefined();
    applyHit(ctx, combat, brute, me, hit, fixedHit(2, false, []), 'intent');
    expect(findStatus(me, 'status_regen')).toMatchObject({ duration: 3, tick: 4 });
    expect(ctx.events.filter((e) => e.t === 'statusApplied' && e.statusId === 'status_regen')).toEqual([
      { t: 'statusApplied', targetUid: me.uid, statusId: 'status_regen', stacks: 1, duration: 3, source: 'gear:item_lantern_moth_brooch' },
    ]);
    me.statuses = [];
    applyHit(ctx, combat, brute, me, hit, fixedHit(1, false, []), 'intent');
    expect(findStatus(me, 'status_regen')).toBeUndefined();
  });

  test('foresight: the Unlidded Eye holds the next-next chip all fight, like att_foresight (one key)', () => {
    const plain = fight(at());
    keepForesight(plain.ctx, plain.combat);
    expect(plain.combat.cooldowns[FORESIGHT_KEY]).toBeUndefined();
    const eye = fight(at({ items: [{ itemId: 'item_unlidded_eye', equip: true }] }));
    keepForesight(eye.ctx, eye.combat);
    expect(eye.combat.cooldowns[FORESIGHT_KEY]).toBe(2);
  });

  test('ability_mp_cost_reduction: Oriel’s Quill makes Ley abilities 10 % cheaper on top of the staff; other types untouched', () => {
    const base = at({ classId: 'elf' });
    const quill = at({ classId: 'elf', items: [{ itemId: 'item_oriels_quill', equip: true }] });
    const ley = pack.abilities['elf_thornlash']!;
    expect(playerAbilityCost(base, pack, ley.id).mp).toBe(ley.mp);
    expect(playerAbilityCost(quill, pack, ley.id).mp).toBe(Math.max(1, Math.floor(ley.mp * 0.9)));
    const other = Object.values(pack.abilities).find((a) => a.id.startsWith('elf_') && a.damageType !== undefined && a.damageType !== 'ley' && a.mp >= 10)!;
    expect(playerAbilityCost(quill, pack, other.id).mp).toBe(playerAbilityCost(base, pack, other.id).mp);
    // a wizard's staff (10 %) and the Quill add up: Echo Bolt 10 MP → ⌊10 × 0.8⌋ = 8
    const wiz = at({ classId: 'wizard', items: [{ itemId: 'item_oriels_quill', equip: true }] });
    expect(playerAbilityCost(wiz, pack, 'wiz_echo_bolt').mp).toBe(8);
  });
});

describe('use scripts', () => {
  test('cleanse: an Antidote Root lifts carried Poison and Bleed out of combat, and from the player in a fight', () => {
    const dot = (statusId: string) => ({ statusId, stacks: 1, duration: 3, sourceUid: null, appliedOnOwnTurn: false, tick: 2 });
    const s = at({ items: ['item_antidote_root', 'item_antidote_root'], patch: (st) => void (st.player.statuses = [dot('status_poison'), dot('status_bleed'), dot('status_curse')]) });
    const out = run(s, [{ type: 'use', uid: uidOf(s, 'item_antidote_root') }]);
    expect(out.state.player.statuses.map((st) => st.statusId)).toEqual(['status_curse']);
    expect(out.events.filter((e) => e.t === 'statusExpired').map((e) => (e as { statusId: string }).statusId)).toEqual(['status_poison', 'status_bleed']);
    // in a fight (abilities.ts useCombatItem → gear.ts cleanseOnUse): whom it is used on; a Brine Draught lifts Soaked only
    const { ctx, combat } = fight(clone(out.state));
    const me = playerOf(combat);
    me.statuses = []; // the carried Curse aside
    for (const id of ['status_poison', 'status_soaked', 'status_weaken']) applyStatus(ctx, combat, null, me, id);
    cleanseOnUse(ctx, combat, me, pack.items['item_brine_draught']!);
    expect(me.statuses.map((st) => st.statusId).sort()).toEqual(['status_poison', 'status_weaken']);
    cleanseOnUse(ctx, combat, me, pack.items['item_antidote_root']!);
    cleanseOnUse(ctx, combat, me, pack.items['item_hearth_broth']!);
    expect(me.statuses).toEqual([]);
  });

  test('whetstone_strip: used out of combat, the next fight’s first three basic attacks carry +3 power (× the ATK coefficient)', () => {
    const s = at({ items: ['item_whetstone_strip'] });
    const out = run(s, [{ type: 'use', uid: uidOf(s, 'item_whetstone_strip') }]);
    expect(out.state.player.uses[`${PREP_USE}item_whetstone_strip`]).toEqual({ loop: 1, count: 3 });
    const { ctx, combat } = fight(clone(out.state));
    gearFightOpening(ctx, combat);
    const me = playerOf(combat);
    expect(me.cooldowns[`${WHETSTONE_KEY}item_whetstone_strip`]).toBe(3);
    expect(ctx.s.player.uses[`${PREP_USE}item_whetstone_strip`]).toBeUndefined();
    const basic = basicAttackOf(ctx.s, pack).spec;
    const boosted = [1, 2, 3, 4].map(() => whetstoneSpec(ctx, me, basic).base - basic.base);
    expect(boosted).toEqual([3 * basic.coef, 3 * basic.coef, 3 * basic.coef, 0]);
  });

  test('remnant_ink: used out of combat, the next fight opens with a 30-point Shield on the player', () => {
    const s = at({ items: ['item_remnant_ink'] });
    const out = run(s, [{ type: 'use', uid: uidOf(s, 'item_remnant_ink') }]);
    const { ctx, combat } = fight(clone(out.state));
    gearFightOpening(ctx, combat);
    expect(findStatus(playerOf(combat), 'status_shield')).toMatchObject({ tick: 30 });
    // the fight after it does not get it again
    const after = clone(ctx.s);
    after.combat = null;
    const again = fight(after);
    gearFightOpening(again.ctx, again.combat);
    expect(findStatus(playerOf(again.combat), 'status_shield')).toBeUndefined();
  });

  test('lantern_oil_ward: used out of combat, it keeps Blind off at an ambush until the next dawn', () => {
    const s = at({ items: ['item_lantern_oil'], day: 3, watch: 2 });
    expect(wardHolds(s, pack, 'status_blind')).toBe(false);
    const out = run(s, [{ type: 'use', uid: uidOf(s, 'item_lantern_oil') }]);
    expect(wardHolds(out.state, pack, 'status_blind')).toBe(true);
    expect(wardHolds(out.state, pack, 'status_poison')).toBe(false);
    const dawn = clone(out.state);
    dawn.clock.ticks += 2;
    expect(wardHolds(dawn, pack, 'status_blind')).toBe(false);
  });

  test('keepers_copy: out of combat it reads the verse Echoes held again (not consumed); with none held it cannot be used', () => {
    const none = at({ items: ['item_keepers_copy'] });
    const use: Action = { type: 'use', uid: uidOf(none, 'item_keepers_copy') };
    expect(legalActions(none, pack, profile)).not.toContainEqual(use);
    const s = at({ items: ['item_keepers_copy'], echoes: ['echo_litany_verse_3', 'echo_litany_verse_1'] });
    const out = run(s, [{ type: 'use', uid: uidOf(s, 'item_keepers_copy') }]);
    const lines = out.state.recentLog.map((l) => l.text);
    const v1 = pack.echoes['echo_litany_verse_1']!;
    const v3 = pack.echoes['echo_litany_verse_3']!;
    expect(lines.slice(-3)).toEqual([`You read the Keeper's Copy again.`, `${v1.name}: ${v1.codexLine}`, `${v3.name}: ${v3.codexLine}`]);
    expect(out.state.player.inventory.some((i) => i.itemId === 'item_keepers_copy')).toBe(true);
  });

  test('scouts_whistle: at a camp it calls Brak to the active slot (fixture companions); away from a camp it cannot be used', () => {
    const whistle = { ...questItems.find((i) => i.id === 'item_scouts_whistle')!, sources: [] };
    const base = companionTables();
    const tables: ContentTables = { ...base, items: [...base.items, whistle] };
    const cpack = buildContentPack(tables, { version: FIXTURE_VERSION });
    const cprofile = freshProfile();
    const recruited = (id: string, waitingAt: string | null) => ({
      id, recruited: true, loyalty: 30, hp: 100, hpMax: 100, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt, arcFlags: {},
    });
    const s = makeState(
      {
        locationId: 'loc_whispering_ruins',
        items: ['item_scouts_whistle'],
        patch: (st) => {
          st.companions.recruited = { nyx: recruited('nyx', null), brak: recruited('brak', 'loc_silverwood_plaza') };
          st.companions.activeId = 'nyx';
        },
      },
      { content: cpack, profile: cprofile },
    );
    const use: Action = { type: 'use', uid: uidOf(s, 'item_scouts_whistle') };
    const out = play(s, [use], { content: cpack, profile: cprofile });
    expect(out.state.companions.activeId).toBe('brak');
    expect(out.state.companions.recruited.nyx?.waitingAt).not.toBeNull();
    expect(out.state.player.inventory.some((i) => i.itemId === 'item_scouts_whistle')).toBe(true);
    // Brak already with you, or no camp here: not legal
    expect(legalActions(out.state, cpack, cprofile)).not.toContainEqual(use);
    const away = clone(s);
    away.world.currentLocationId = 'loc_mistwood_path';
    expect(legalActions(away, cpack, cprofile)).not.toContainEqual(use);
  });
});

describe('the Remnant Wax Seal (stock only, not prices)', () => {
  test('carried, Tamsin stocks her Trusted lines at Neutral; her prices still read the real standing; Borin is untouched', () => {
    const plain = at({ locationId: 'loc_silverwood_plaza', reputation: { remnants: 0 } });
    const sealed = at({ locationId: 'loc_silverwood_plaza', reputation: { remnants: 0 }, items: ['item_remnant_wax_seal'] });
    expect(stockView(plain, pack, 'npc_tamsin_reed')).toBe(plain);
    expect(stockView(sealed, pack, 'npc_tamsin_reed').reputation.remnants).toBe(20);
    expect(stockView(sealed, pack, 'npc_borin_stonefist')).toBe(sealed);
    const stocked = (s: GameState): string[] => {
      const ctx = scriptedCtx(s, [], pack, profile);
      restock(ctx, 'npc_tamsin_reed');
      return ctx.s.merchants['npc_tamsin_reed']!.stock.map((i) => i.itemId);
    };
    expect(stocked(plain)).not.toContain('item_pattern_conflux_robe');
    expect(stocked(sealed)).toContain('item_pattern_conflux_robe');
    expect(sealed.reputation.remnants).toBe(0);
  });
});

describe('readBook counts every Spellbook (D-101; WORLD §7.10)', () => {
  // the fixture pack (its codex has no Korr entry to unlock) with a Korr's Marginalia that counts as one
  const marginalia = { ...tomes.find((i) => i.id === 'item_korrs_marginalia')!, sources: [], onUse: [{ counter: { name: 'read_marginalia', delta: 1 } }] };
  const tables: ContentTables = { ...miniContentTables, items: [...miniContentTables.items, marginalia] };
  const mini = buildContentPack(tables, { version: FIXTURE_VERSION });

  test('Korr’s Marginalia counts with no HP or Corruption cost; the third read in a loop grants echo_litany_verse_2', () => {
    const p = freshProfile();
    const s = makeState({ items: ['item_korrs_marginalia', 'item_dark_spellbook', 'item_dark_spellbook'], hp: 80 }, { content: mini, profile: p });
    const read = (st: GameState, itemId: string) => play(st, [{ type: 'readBook', uid: uidOf(st, itemId) }], { content: mini, profile: p });
    const one = read(s, 'item_korrs_marginalia');
    expect([one.state.player.hp, one.state.player.corruption, one.state.player.uses.spellbooksRead?.count]).toEqual([80, 0, 1]);
    const two = read(one.state, 'item_dark_spellbook');
    expect(two.state.echoesThisLoop).not.toContain('echo_litany_verse_2');
    const three = read(two.state, 'item_dark_spellbook');
    expect(three.state.player.uses.spellbooksRead?.count).toBe(3);
    expect(three.state.echoesThisLoop).toContain('echo_litany_verse_2');
    expect(three.events.filter((e) => e.t === 'echoGained')).toEqual([{ t: 'echoGained', echoId: 'echo_litany_verse_2', firstEver: true }]);
  });

  test('a Dark Spellbook read with the Amulet from Loop 2 grants echo_korr_marginalia (in the real pack); not in Loop 1', () => {
    const p2 = freshProfile({ loopCounter: 2 });
    const s2 = makeState({ loop: 2, items: ['item_dark_spellbook'] }, { content: pack, profile: p2 });
    expect(s2.player.inventory.some((i) => i.itemId === 'item_amulet_of_echoes') || Object.values(s2.player.equipment).some((i) => i?.itemId === 'item_amulet_of_echoes')).toBe(true);
    const out = play(s2, [{ type: 'readBook', uid: uidOf(s2, 'item_dark_spellbook') }], { content: pack, profile: p2 });
    expect(out.state.echoesThisLoop).toContain('echo_korr_marginalia');
    const s1 = at({ items: ['item_dark_spellbook', 'item_amulet_of_echoes'] });
    const loop1 = run(s1, [{ type: 'readBook', uid: uidOf(s1, 'item_dark_spellbook') }]);
    expect(loop1.state.echoesThisLoop).not.toContain('echo_korr_marginalia');
  });
});
