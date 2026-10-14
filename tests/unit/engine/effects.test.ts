// U14: the effect applier (PLAN §4.9, §8.1 "conditions/effects"). Every effect atom has an observable result (state,
// profile and/or events) or, where its system is not built yet, a rejection naming the owning unit. Effects run
// through a real `step` (stand-in `interact` reducer), so purity, lazy profile cloning and atomicity are exercised.
import { describe, expect, test } from 'bun:test';
import type { Effect, EffectKey } from '@schema/effect';
import {
  HANDLERS,
  apply,
  applyAll,
  createStep,
  makeCtx,
  type ApplyOptions,
  type ContentPack,
  type GameState,
  type Profile,
  type StepResult,
} from '@engine/index';
import { clone, deepFreeze } from '@engine/util/clone';
import { fullState, minimalProfile, minimalState } from './types/handmade';
import { standInPack } from './standInPack';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';

const content = deepFreeze(standInPack());

/** Applies `effects` inside one accepted (or rejected) step from explore mode. */
function run(effects: Effect[], state: GameState = minimalState(), profile: Profile = minimalProfile(), opts?: ApplyOptions, pack: ContentPack = content): StepResult & { input: GameState; inputProfile: Profile } {
  const input = deepFreeze(state);
  const inputProfile = deepFreeze(profile);
  const stepFn = createStep({ ...HANDLERS, interact: (ctx) => applyAll(effects, ctx, opts) });
  return { ...stepFn(input, { type: 'interact', eventId: 'ev_test' }, pack, inputProfile), input, inputProfile };
}
const withState = (patch: (s: GameState) => void): GameState => {
  const s = minimalState();
  patch(s);
  return s;
};
const rejectedWith = (out: StepResult, fragment: string) => {
  expect(out.events).toHaveLength(1);
  expect(out.events[0]!.t).toBe('actionRejected');
  expect((out.events[0] as { reason: string }).reason).toContain(fragment);
};
const tonic = (uid: string, qty: number) => ({ uid, itemId: 'item_ley_touched_tonic', qty, rarity: 'common' as const, affixes: [] });

/** One observable test per atom (typed: tsc fails if an atom has no test). */
const OBSERVED: { [K in EffectKey]: () => void } = {
  setFlag: () => {
    const out = run([{ setFlag: 'flag_a' }]);
    expect(out.state.flags).toEqual({ flag_a: true });
    expect(out.events).toEqual([]);
    expect(out.input.flags).toEqual({});
  },
  clearFlag: () => {
    const out = run([{ clearFlag: 'flag_a' }], withState((s) => void (s.flags = { flag_a: 2, flag_b: true })));
    expect(out.state.flags).toEqual({ flag_b: true });
  },
  grantEcho: () => {
    const first = run([{ grantEcho: 'echo_ilyra_watchword' }]);
    expect(first.state.echoesThisLoop).toEqual(['echo_ilyra_watchword']);
    expect(first.state.counters.echoesGainedThisLoop).toBe(1);
    expect(first.profile.echoes).toEqual(['echo_ilyra_watchword']);
    expect(first.profile).not.toBe(first.inputProfile);
    expect(first.events).toEqual([{ t: 'echoGained', echoId: 'echo_ilyra_watchword', firstEver: true }]);
    // known from an earlier loop: no profile clone, firstEver false
    const known = run([{ grantEcho: 'echo_ilyra_watchword' }], minimalState(), { ...minimalProfile(), echoes: ['echo_ilyra_watchword'] });
    expect(known.profile).toBe(known.inputProfile);
    expect(known.events).toEqual([{ t: 'echoGained', echoId: 'echo_ilyra_watchword', firstEver: false }]);
    // already granted this loop: idempotent
    const again = run([{ grantEcho: 'echo_ilyra_watchword' }, { grantEcho: 'echo_ilyra_watchword' }]);
    expect(again.state.echoesThisLoop).toEqual(['echo_ilyra_watchword']);
    expect(again.events).toHaveLength(1);
  },
  questStart: () => {
    const out = run([{ questStart: 'q_clear_path' }], withState((s) => void (s.counters.kills = { cr_wildling_brute: 2 })));
    expect(out.state.quests.q_clear_path).toEqual({
      status: 'active',
      stage: 'find_brute',
      startedDay: 1,
      endedDay: null,
      counters: { 'kills:cr_wildling_brute': 2 },
      objectivesDone: [],
    });
    expect(out.events).toEqual([
      { t: 'questStarted', questId: 'q_clear_path' },
      { t: 'questAdvanced', questId: 'q_clear_path', stage: 'find_brute', journal: 'Find the brute on the road.' },
    ]);
    expect(run([{ questStart: 'q_echoing_heartbeat' }]).state.quests.q_echoing_heartbeat!.stage).toBe('listen'); // firstStage
    const twice = run([{ questStart: 'q_clear_path' }, { questStart: 'q_clear_path' }]);
    expect(twice.events).toHaveLength(2);
    expect(() => run([{ questStart: 'q_unknown' }])).toThrow("unknown quest 'q_unknown'");
  },
  questAdvance: () => {
    const started = run([{ questStart: 'q_clear_path' }]).state;
    const out = run([{ questAdvance: { quest: 'q_clear_path', stage: 'done' } }], clone(started));
    expect(out.state.quests.q_clear_path).toMatchObject({ status: 'active', stage: 'done', startedDay: 1 });
    expect(out.events).toEqual([{ t: 'questAdvanced', questId: 'q_clear_path', stage: 'done', journal: 'The road is clear.' }]);
    // a shortcut into a quest not yet started starts it at that stage (DESIGN §13.3 example 8)
    const jump = run([{ questAdvance: { quest: 'q_echoing_heartbeat', stage: 'done_destroy' } }]);
    expect(jump.state.quests.q_echoing_heartbeat).toMatchObject({ status: 'active', stage: 'done_destroy' });
    expect(jump.events.map((e) => e.t)).toEqual(['questStarted', 'questAdvanced']);
    // same stage, or a finished quest: no-op
    expect(run([{ questAdvance: { quest: 'q_clear_path', stage: 'find_brute' } }], clone(started)).events).toEqual([]);
    const done = withState((s) => void (s.quests.q_clear_path = { status: 'completed', stage: 'done', startedDay: 1, endedDay: 2, counters: {}, objectivesDone: [] }));
    expect(run([{ questAdvance: { quest: 'q_clear_path', stage: 'find_brute' } }], done).state.quests.q_clear_path!.stage).toBe('done');
    expect(() => run([{ questAdvance: { quest: 'q_clear_path', stage: 'nowhere' } }])).toThrow("unknown stage 'nowhere'");
  },
  questFail: () => {
    const active = run([{ questStart: 'q_clear_path' }]).state;
    const out = run([{ questFail: 'q_clear_path' }], withState((s) => Object.assign(s, { quests: clone(active.quests), clock: { ...s.clock, ticks: 9 } })));
    expect(out.state.quests.q_clear_path).toMatchObject({ status: 'failed', stage: 'find_brute', startedDay: 1, endedDay: 3 });
    expect(out.state.counters.questsFailed).toBe(1);
    expect(out.events).toEqual([{ t: 'questFailed', questId: 'q_clear_path' }]);
    const never = run([{ questFail: 'q_side_errand' }]);
    expect(never.state.quests.q_side_errand).toMatchObject({ status: 'failed', startedDay: null, endedDay: 1 });
    expect(run([{ questFail: 'q_clear_path' }], clone(out.state)).events).toEqual([]);
  },
  giveItem: () => {
    // stackable: merges into the matching stack, overflows into new stacks at maxStack (99)
    const out = run([{ giveItem: { item: 'item_ley_touched_tonic', count: 100 } }], withState((s) => void s.player.inventory.push(tonic('i0', 2))));
    expect(out.state.player.inventory.map((i) => [i.uid, i.qty])).toEqual([['i0', 99], ['i1', 3]]);
    expect(out.events).toEqual([{ t: 'itemGiven', item: { ...tonic('i0', 100) }, source: 'effect' }]);
    // non-stackable: one instance each; fixed rarity and affixes; explicit rarity wins; the source is reported
    const rings = run([{ giveItem: { item: 'item_silver_ring', count: 2 } }, { giveItem: { item: 'item_hunting_bow', rarity: 'epic' } }], minimalState(), minimalProfile(), { source: 'quest:q_clear_path' });
    expect(rings.state.player.inventory).toEqual([
      { uid: 'i1', itemId: 'item_silver_ring', qty: 1, rarity: 'uncommon', affixes: ['affix_of_embers'] },
      { uid: 'i2', itemId: 'item_silver_ring', qty: 1, rarity: 'uncommon', affixes: ['affix_of_embers'] },
      { uid: 'i3', itemId: 'item_hunting_bow', qty: 1, rarity: 'epic', affixes: [] },
    ]);
    expect(rings.state.meta.nextUid).toBe(4);
    expect(rings.events.map((e) => (e.t === 'itemGiven' ? [e.item.itemId, e.item.qty, e.source] : null))).toEqual([
      ['item_silver_ring', 2, 'quest:q_clear_path'],
      ['item_hunting_bow', 1, 'quest:q_clear_path'],
    ]);
    // a different rarity does not merge into an existing stack
    const ore = run([{ giveItem: { item: 'mat_ember_ore', count: 1, rarity: 'rare' } }, { giveItem: { item: 'mat_ember_ore', count: 2 } }]);
    expect(ore.state.player.inventory.map((i) => [i.rarity, i.qty])).toEqual([['rare', 1], ['common', 2]]);
    expect(() => run([{ giveItem: { item: 'item_nope' } }])).toThrow("unknown item 'item_nope'");
  },
  takeItem: () => {
    const s = withState((st) => {
      st.player.inventory.push(tonic('i1', 1), tonic('i2', 3));
      st.player.equipment.weapon = { uid: 'i3', itemId: 'item_hunting_bow', qty: 1, rarity: 'common', affixes: [] };
    });
    const out = run([{ takeItem: { item: 'item_ley_touched_tonic', count: 2 } }, { takeItem: { item: 'item_hunting_bow' } }], s);
    expect(out.state.player.inventory).toEqual([tonic('i2', 2)]);
    expect(out.state.player.equipment.weapon).toBeNull();
    expect(out.events).toEqual([
      { t: 'itemLost', itemId: 'item_ley_touched_tonic', qty: 2, reason: 'taken' },
      { t: 'itemUnequipped', slot: 'weapon' },
      { t: 'itemLost', itemId: 'item_hunting_bow', qty: 1, reason: 'taken' },
    ]);
    // takes what is there; nothing carried → no event
    expect(run([{ takeItem: { item: 'item_ley_touched_tonic', count: 9 } }], clone(s)).state.player.inventory).toEqual([]);
    expect(run([{ takeItem: { item: 'item_chronos_lens' } }]).events).toEqual([]);
  },
  rep: () => {
    const out = run([{ rep: { faction: 'weavers', delta: 25 } }, { rep: { faction: 'ironclad', delta: -150 } }]);
    expect(out.state.reputation).toEqual({ remnants: 0, weavers: 25, ironclad: -100 });
    expect(out.events).toEqual([
      { t: 'reputationChanged', faction: 'weavers', delta: 25, value: 25, tierBefore: 'neutral', tierAfter: 'trusted' },
      { t: 'reputationChanged', faction: 'ironclad', delta: -100, value: -100, tierBefore: 'neutral', tierAfter: 'hostile' },
    ]);
    const tiers = run([{ rep: { faction: 'remnants', delta: 60 } }, { rep: { faction: 'remnants', delta: -80 } }]);
    expect(tiers.events.map((e) => (e.t === 'reputationChanged' ? e.tierAfter : ''))).toEqual(['sworn', 'wary']);
  },
  loyalty: () => {
    const s = withState((st) => {
      st.companions.recruited.brak = { id: 'brak', recruited: true, loyalty: 98, hp: 1, hpMax: 1, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} };
    });
    const out = run([{ loyalty: { companion: 'brak', delta: 5 } }, { loyalty: { companion: 'mireya', delta: 5 } }], s);
    expect(out.state.companions.recruited.brak!.loyalty).toBe(100);
    expect(out.state.companions.recruited.mireya).toBeUndefined();
    expect(out.events).toEqual([{ t: 'loyaltyChanged', companionId: 'brak', delta: 2, value: 100 }]);
  },
  gold: () => {
    const out = run([{ gold: 50 }, { gold: -80 }]);
    expect(out.state.player.gold).toBe(0);
    expect(out.state.counters).toMatchObject({ goldEarned: 50, goldSpent: 50 });
    expect(out.events).toEqual([
      { t: 'goldChanged', delta: 50, total: 50 },
      { t: 'goldChanged', delta: -50, total: 0 },
    ]);
  },
  xp: () => {
    const out = run([{ xp: 120 }]);
    expect(out.state.player.xp).toBe(120);
    expect(out.events).toEqual([{ t: 'xpGained', amount: 120 }]);
  },
  resonance: () => {
    const out = run([{ resonance: 10 }, { resonance: -25 }], minimalState(), { ...minimalProfile(), resonance: 5 }, { source: 'closer' });
    expect(out.profile.resonance).toBe(0);
    expect(out.profile.resonanceEarnedTotal).toBe(10);
    expect(out.inputProfile.resonance).toBe(5);
    expect(out.events).toEqual([
      { t: 'resonanceGained', amount: 10, reason: 'closer', total: 15 },
      { t: 'resonanceGained', amount: -25, reason: 'closer', total: 0 },
    ]);
  },
  heal: () => {
    const hurt = withState((s) => Object.assign(s.player, { hp: 10, mp: 1 }));
    const out = run([{ heal: { hp: 20 } }, { heal: { hp: 100, mp: 'full' } }], hurt);
    expect(out.state.player).toMatchObject({ hp: 40, mp: 10 });
    expect(out.events).toEqual([
      { t: 'healed', targetUid: 'player', amount: 20, source: 'effect' },
      { t: 'healed', targetUid: 'player', amount: 10, source: 'effect' },
    ]);
    expect(run([{ heal: { hp: 'full', mp: 3 } }], clone(hurt)).state.player).toMatchObject({ hp: 40, mp: 4 });
  },
  damage: () => {
    const out = run([{ damage: { hp: 15 } }, { damage: { hp: 100 } }]);
    expect(out.state.player.hp).toBe(1); // out-of-combat damage never kills (until U30's death handling)
    expect(out.state.counters.damageTaken).toBe(39);
    expect(out.events).toEqual([
      { t: 'log', text: 'You take 15 damage.', kind: 'event' },
      { t: 'log', text: 'You take 24 damage.', kind: 'event' },
    ]);
    expect(out.state.recentLog).toHaveLength(2);
  },
  corruption: () => {
    const out = run([{ corruption: 4 }, { corruption: 4 }, { corruption: -10 }]);
    expect(out.state.player.corruption).toBe(0);
    expect(out.events).toEqual([
      { t: 'corruptionChanged', value: 4, delta: 4 },
      { t: 'corruptionChanged', value: 6, delta: 2 },
      { t: 'corruptionChanged', value: 0, delta: -6 },
    ]);
  },
  clockWatches: () => {
    // Stabilize +24 and the audit trail
    const plus = run([{ clockWatches: 24 }], minimalState(), minimalProfile(), { source: 'heartstone_stabilize' });
    expect(plus.state.clock.limitTicks).toBe(140);
    expect(plus.state.clock.modifiers).toEqual([{ source: 'heartstone_stabilize', watches: 24 }]);
    expect(plus.events).toEqual([{ t: 'clockChanged', deltaWatches: 24, limitTicks: 140, floored: false }]);
    // Destroy −40 early: no floor
    expect(run([{ clockWatches: -40 }]).state.clock.limitTicks).toBe(76);
    // Destroy −40 on Day 21 (tick 81): floored at dawn of Day 21 + 3 dawns = 92
    const late = run([{ clockWatches: -40 }], withState((s) => void (s.clock.ticks = 81)));
    expect(late.state.clock.limitTicks).toBe(92);
    expect(late.events).toEqual([{ t: 'clockChanged', deltaWatches: -24, limitTicks: 92, floored: true }]);
    // already inside the floor: a reduction never raises the limit, it just stops
    const inside = run([{ clockWatches: -4 }], withState((s) => void (s.clock.ticks = 110)));
    expect(inside.state.clock).toMatchObject({ limitTicks: 116, modifiers: [] });
    expect(inside.events).toEqual([{ t: 'clockChanged', deltaWatches: 0, limitTicks: 116, floored: true }]);
    // Frayed Clock halves other modifiers toward zero
    const frayed = withState((s) => {
      s.meta.modifiers = ['mod_frayed_clock'];
      s.clock.limitTicks = 80;
    });
    expect(run([{ clockWatches: -5 }, { clockWatches: 24 }], frayed).state.clock.modifiers.map((m) => m.watches)).toEqual([-2, 12]);
  },
  passWatches: () => {
    const out = run([{ passWatches: 5 }], withState((s) => void (s.clock.ticks = 2)));
    expect(out.state.clock.ticks).toBe(7);
    expect(out.state.clock.limitTicks).toBe(116);
    expect(out.events).toEqual([
      { t: 'watchAdvanced', day: 1, watch: 3 },
      { t: 'watchAdvanced', day: 2, watch: 0 },
      { t: 'dayAdvanced', day: 2, daysLeft: 28 },
      { t: 'watchAdvanced', day: 2, watch: 1 },
      { t: 'watchAdvanced', day: 2, watch: 2 },
      { t: 'watchAdvanced', day: 2, watch: 3 },
    ]);
    const frozen = run([{ passWatches: 4 }], withState((s) => void (s.clock.frozen = true)));
    expect(frozen.state.clock.ticks).toBe(0);
    expect(frozen.events).toEqual([]);
  },
  spawn: () => {
    const out = run([{ spawn: { creature: 'cr_wildling_brute' } }, { spawn: { creature: 'cr_wildling_brute', location: 'loc_shattered_library' } }]);
    expect(out.state.world.pendingEncounters).toEqual({
      loc_whispering_ruins: [{ id: 'spawn_1', groups: [{ creatureId: 'cr_wildling_brute', count: 1 }], once: true, onFlee: 'scatter' }],
      loc_shattered_library: [{ id: 'spawn_2', groups: [{ creatureId: 'cr_wildling_brute', count: 1 }], once: true, onFlee: 'scatter' }],
    });
    expect(out.events[1]).toEqual({ t: 'log', text: 'Wildling Brute appears at Shattered Library.', kind: 'event' });
    expect(() => run([{ spawn: { creature: 'cr_nope' } }])).toThrow("unknown creature 'cr_nope'");
  },
  teleport: () => {
    const out = run([{ teleport: 'loc_shattered_library' }]);
    expect(out.state.world).toMatchObject({ currentLocationId: 'loc_shattered_library', previousLocationId: 'loc_whispering_ruins' });
    expect(out.state.world.discovered).toEqual(['loc_whispering_ruins', 'loc_shattered_library']);
    expect(out.state.world.locationStates.loc_shattered_library).toMatchObject({ visited: true, visitCount: 1 });
    expect(out.events).toEqual([
      { t: 'locationDiscovered', locationId: 'loc_shattered_library' },
      { t: 'locationEntered', locationId: 'loc_shattered_library', firstVisit: true, regionId: 'region_silverwood_ruins' },
    ]);
    const back = run([{ teleport: 'loc_shattered_library' }], clone(out.state));
    expect(back.events).toEqual([{ t: 'locationEntered', locationId: 'loc_shattered_library', firstVisit: false, regionId: 'region_silverwood_ruins' }]);
    expect(back.state.world.locationStates.loc_shattered_library!.visitCount).toBe(2);
  },
  unlockExit: () => {
    const s = withState((st) => {
      st.world.locationStates.loc_whispering_ruins = { ...emptyLocation(), lockedExits: ['loc_shattered_library'] };
    });
    const out = run([{ unlockExit: { from: 'loc_whispering_ruins', to: 'loc_shattered_library' } }, { unlockExit: { from: 'loc_whispering_ruins', to: 'loc_shattered_library' } }], s);
    expect(out.state.world.locationStates.loc_whispering_ruins).toMatchObject({ unlockedExits: ['loc_shattered_library'], lockedExits: [] });
    expect(out.events[0]).toEqual({ t: 'exitUnlocked', from: 'loc_whispering_ruins', to: 'loc_shattered_library' });
    expect(() => run([{ unlockExit: { from: 'loc_whispering_ruins', to: 'loc_nope' } }])).toThrow("unknown location 'loc_nope'");
  },
  scatter: () => {
    const out = run([{ scatter: { location: 'loc_shattered_library' } }, { scatter: { location: 'loc_shattered_library' } }]);
    // only the fixed (once) fleeable group scatters; the boss and the wandering pool do not
    expect(out.state.world.locationStates.loc_shattered_library!.scattered).toEqual(['enc_library_wraiths']);
    expect(out.events).toEqual([{ t: 'encounterScattered', locationId: 'loc_shattered_library', encounterId: 'enc_library_wraiths' }]);
    const cleared = withState((s) => void (s.world.locationStates.loc_shattered_library = { ...emptyLocation(), encountersCleared: ['enc_library_wraiths'] }));
    expect(run([{ scatter: { location: 'loc_shattered_library' } }], cleared).events).toEqual([]);
    expect(run([{ scatter: { location: 'loc_whispering_ruins' } }]).events).toEqual([]);
  },
  multiHit: () => rejectedWith(run([{ multiHit: { hits: 7 } }]), "effect 'multiHit' is combat-scope (D-069.9); the combat engine applies it (U26)"),
  stripBuffs: () => rejectedWith(run([{ stripBuffs: { kinds: ['shield'] } }]), "'stripBuffs' is combat-scope (D-069.9); the combat engine applies it (U26)"),
  healOnDamage: () => rejectedWith(run([{ healOnDamage: { pct: 0.5 } }]), "'healOnDamage' is combat-scope (D-069.9); the combat engine applies it (U26)"),
  surviveRounds: () => rejectedWith(run([{ surviveRounds: { rounds: 10 } }]), "'surviveRounds' is combat-scope (D-069.9); the combat engine applies it (U27)"),
  leaveCombat: () => rejectedWith(run([{ leaveCombat: true }]), "'leaveCombat' is combat-scope (D-069.9); the combat engine applies it (U27)"),
  areaMove: () => rejectedWith(run([{ areaMove: 'tyr_shear' }]), "'areaMove' is combat-scope (D-069.9); the combat engine applies it (U26b)"),
  recruit: () => {
    const out = run([{ recruit: 'brak' }, { recruit: 'mireya' }, { recruit: 'brak' }]);
    expect(out.state.companions.activeId).toBe('brak');
    expect(out.state.companions.recruited.brak).toEqual({
      id: 'brak', recruited: true, loyalty: 10, hp: 190, hpMax: 190, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {},
    });
    expect(out.state.companions.recruited.mireya!.loyalty).toBe(0);
    expect(out.events).toEqual([
      { t: 'companionRecruited', companionId: 'brak' },
      { t: 'companionRecruited', companionId: 'mireya' },
    ]);
    expect(() => run([{ recruit: 'nyx' }])).toThrow("unknown companion 'nyx'");
  },
  dismiss: () => {
    const two = run([{ recruit: 'brak' }, { recruit: 'mireya' }]).state;
    const out = run([{ dismiss: 'brak' }, { dismiss: 'caelum' }], clone(two));
    expect(Object.keys(out.state.companions.recruited)).toEqual(['mireya']);
    expect(out.state.companions.activeId).toBeNull();
    expect(out.events).toEqual([{ t: 'companionDismissed', companionId: 'brak' }]);
    const keep = run([{ dismiss: 'mireya' }], clone(two));
    expect(keep.state.companions.activeId).toBe('brak');
  },
  startCombat: () => {
    // U23: the fight is set up here; it plays from the combat post-step hook (not part of this bare step)
    const pack = fixturePack();
    const out = run([{ startCombat: 'enc_library_shades' }], makeState(), freshProfile(), undefined, pack);
    expect(out.state.mode).toBe('combat');
    expect(out.state.combat).toMatchObject({ encounterId: 'enc_library_shades', phase: 'start', round: 1 });
    expect(out.state.combat?.enemies.map((e) => e.refId)).toEqual(['cr_corrupted_shade', 'cr_corrupted_shade']);
    expect(out.events.map((e) => e.t)).toEqual(['modeChanged', 'combatStarted', 'log']);
    const twice = run([{ startCombat: 'enc_library_shades' }, { startCombat: 'enc_library_shades' }], makeState(), freshProfile(), undefined, pack);
    rejectedWith(twice, "effect 'startCombat' while a fight is already in progress");
  },
  startDialogue: () => rejectedWith(run([{ startDialogue: 'scene_ilyra' }]), "effect 'startDialogue' is not implemented yet (U33)"),
  endLoop: () => {
    const out = run([{ endLoop: { closer: 'closer_fall', reason: 'released' } }], withState((s) => void (s.meta.loop = 2)));
    expect(out.state.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'released', slideIndex: 0 });
    expect(out.state.mode).toBe('ending');
    expect(out.events).toEqual([{ t: 'modeChanged', from: 'explore', to: 'ending' }]);
    expect(run([{ endLoop: { closer: 'closer_escape' } }]).state.pendingEnding).toEqual({ outcome: 'closer_escape', slideIndex: 0 });
  },
  ending: () => {
    const out = run([{ ending: 'ending_mending' }]);
    expect(out.state.pendingEnding).toEqual({ outcome: 'ending_mending', slideIndex: 0 });
    expect(out.state.mode).toBe('ending');
    expect(out.events).toEqual([
      { t: 'modeChanged', from: 'explore', to: 'ending' },
      { t: 'endingReached', endingId: 'ending_mending' },
    ]);
    expect(() => run([{ ending: 'ending_nope' }])).toThrow("unknown ending 'ending_nope'");
  },
  unlockRecipe: () => {
    // U34: the recipe is known for the loop (`player.uses`, read by reducers/crafting.ts `requiresItemRead`), once
    const pack = fixturePack();
    const twice: Effect[] = [{ unlockRecipe: 'recipe_glyphbound_lantern' }, { unlockRecipe: 'recipe_glyphbound_lantern' }];
    const out = run(twice, makeState(), freshProfile(), undefined, pack);
    expect(out.state.player.uses['recipe:recipe_glyphbound_lantern']).toEqual({ loop: 1 });
    expect(out.events).toEqual([{ t: 'log', text: 'You learn how to make the Glyphbound Lantern.', kind: 'event' }]);
    expect(() => run([{ unlockRecipe: 'recipe_ghost' }], makeState(), freshProfile(), undefined, pack)).toThrow("unknown recipe 'recipe_ghost'");
  },
  revive: () => {
    // U34 (D-080): out of a fight the knocked-out companion comes round at the share of its max HP; no one down: a line
    const pack = fixturePack();
    const s = makeState({ patch: (st) => void (st.companions = { activeId: 'ilyra', recruited: { ilyra: { id: 'ilyra', recruited: true, loyalty: 0, hp: 0, hpMax: 80, ko: true, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} } } }) });
    const out = run([{ revive: 0.3 }], s, freshProfile(), undefined, pack);
    expect(out.state.companions.recruited.ilyra).toMatchObject({ ko: false, hp: 24 });
    expect(out.events).toEqual([{ t: 'log', text: 'Ilyra comes round (24 HP).', kind: 'event' }]);
    expect(run([{ revive: 0.3 }], clone(out.state), freshProfile(), undefined, pack).events).toEqual([{ t: 'log', text: 'No one here needs bringing round.', kind: 'event' }]);
  },
  unlockCodex: () => {
    const out = run([{ unlockCodex: 'codex_breach' }]);
    expect(out.profile.codexUnlocked).toEqual(['codex_breach']);
    expect(out.events).toEqual([{ t: 'codexUnlocked', codexId: 'codex_breach' }]);
    const again = run([{ unlockCodex: 'codex_breach' }], minimalState(), { ...minimalProfile(), codexUnlocked: ['codex_breach'] });
    expect(again.profile).toBe(again.inputProfile);
    expect(again.events).toEqual([]);
  },
  counter: () => {
    const out = run([{ counter: { name: 'bells_rung', delta: 2 } }, { counter: { name: 'bells_rung', delta: 1 } }]);
    expect(out.state.counters.custom).toEqual({ bells_rung: 3 });
    expect(out.events).toEqual([]);
  },
  resolve: () => {
    // communion is a combat state; apply through a ctx directly
    const ctx = makeCtx(clone(fullState()), minimalProfile(), content);
    apply({ resolve: 2 }, ctx, { source: 'answer:tyr_q_name' });
    apply({ resolve: 5 }, ctx);
    apply({ resolve: -9 }, ctx);
    expect(ctx.s.combat!.communion!.resolve).toBe(0);
    expect(ctx.events).toEqual([
      { t: 'resolveChanged', delta: 2, value: 6, movement: 2, reason: 'answer:tyr_q_name' },
      { t: 'resolveChanged', delta: 2, value: 8, movement: 2, reason: 'effect' },
      { t: 'resolveChanged', delta: -8, value: 0, movement: 2, reason: 'effect' },
    ]);
    // outside communion: no-op
    const out = run([{ resolve: 3 }]);
    expect(out.events).toEqual([]);
    expect(out.state.combat).toBeNull();
  },
};

function emptyLocation() {
  return {
    visited: false, visitCount: 0, items: [], itemsSpawned: false, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
    unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
  };
}

describe('apply: every effect atom is observable', () => {
  for (const [key, fn] of Object.entries(OBSERVED)) test(key, fn);
});

describe('applyAll', () => {
  test('applies in order, purely: frozen inputs untouched, profile cloned only when written', () => {
    const out = run([{ gold: 10 }, { setFlag: 'flag_a' }, { gold: 5 }]);
    expect(out.state.player.gold).toBe(15);
    expect(out.input.player.gold).toBe(0);
    expect(out.profile).toBe(out.inputProfile);
    expect(out.state.meta.stepCount).toBe(1);
  });

  test('atomic: a later rejection rolls back every earlier effect', () => {
    const out = run([{ gold: 10 }, { grantEcho: 'echo_ilyra_watchword' }, { startDialogue: 'scene_ilyra' }]);
    expect(out.state).toBe(out.input);
    expect(out.profile).toBe(out.inputProfile);
    expect(out.events).toHaveLength(1);
  });

  test('a malformed or unknown effect is a programmer error', () => {
    expect(() => run([{} as Effect])).toThrow('exactly one key');
    expect(() => run([{ lockExit: 'loc_x' } as unknown as Effect])).toThrow("unknown effect atom 'lockExit'");
  });

  test('DESIGN §13.3 example 1 (Heartstone Destroy) applies end to end on Day 21', () => {
    const s = withState((st) => void (st.clock.ticks = 80));
    const out = run(
      [
        { setFlag: 'flag_heartstone_destroyed' }, { clockWatches: -40 }, { rep: { faction: 'ironclad', delta: 20 } }, { rep: { faction: 'remnants', delta: -25 } },
        { rep: { faction: 'weavers', delta: -10 } }, { grantEcho: 'echo_heartstone_silence' }, { giveItem: { item: 'item_heartstone_fragment_dead', count: 2 } },
        { setFlag: 'flag_ley_cost_up' }, { setFlag: 'flag_breach_born_weakened' }, { questAdvance: { quest: 'q_echoing_heartbeat', stage: 'done_destroy' } },
      ],
      s,
      minimalProfile(),
      { source: 'choice:heartstone_destroy' },
    );
    expect(out.state.clock.limitTicks).toBe(92); // floored: Day 21 dawn + 3 dawns
    expect(out.state.reputation).toEqual({ remnants: -25, weavers: -10, ironclad: 20 });
    expect(out.state.player.inventory).toEqual([{ uid: 'i1', itemId: 'item_heartstone_fragment_dead', qty: 2, rarity: 'common', affixes: [] }]);
    expect(out.state.quests.q_echoing_heartbeat!.stage).toBe('done_destroy');
    expect(out.profile.echoes).toEqual(['echo_heartstone_silence']);
    expect(Object.keys(out.state.flags).sort()).toEqual(['flag_breach_born_weakened', 'flag_heartstone_destroyed', 'flag_ley_cost_up']);
  });
});
