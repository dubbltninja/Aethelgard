// Effect applier (PLAN §4.9, DESIGN §13.3): `apply(effect, ctx)` mutates the step draft through the ctx and emits
// the events the UI renders. Effects are applied in order inside one `step`, so a later rejection rolls all of them
// back. Flags and counters are invisible state and emit nothing. Ids must exist in the (validated) content pack;
// a missing one is a programmer error and throws.
//
// Minimal implementations, marked TODO(Uxx) where the owning system adds behaviour later:
// xp (level-ups U21), giveItem (rolled rarity/affixes U27/U34), heal/damage (combat snapshots U23, death U30),
// passWatches (dawn hooks, warnings and expiry U20), teleport (entry hooks U20), questAdvance (outcomes/rewards U33),
// recruit (level scaling U28), endLoop/ending (RunRecord, Resonance, profile writes U30).
// startCombat starts the encounter (U23, combat/turnOrder.ts; the fight plays from the combat post-step hook).
// Not yet applicable — they reject the action, naming the unit: startDialogue (U33),
// unlockRecipe (U34: no known-recipe state yet) and the five combat-scope atoms (U26/U27; D-069.9).
import type { Effect, EffectAtoms, EffectKey } from '@schema/effect';
import { startEncounterById } from './combat/turnOrder';
import { atomOf, dayOf, daysLeft, repTier, watchOf, TICKS_PER_DAY } from './conditions';
import { enterMode, type StepCtx } from './ctx';
import { defaultRarity, isStackable } from './newRun';
import { grantXp } from './progression';
import type { ItemInstance, LocationState, QuestState } from './types/state';
import { clamp } from './util/math';

export interface ApplyOptions {
  /** What caused the effect ('choice:c_destroy', 'quest:q_x', 'item:i3' …); shown in events and the clock audit trail. */
  source?: string;
}

export const REPUTATION_MIN = -100;
export const REPUTATION_MAX = 100;
export const LOYALTY_MAX = 100;
export const RESOLVE_MAX = 8;
/** DESIGN §10.1: the limit never moves earlier than the current day's dawn + 3 dawns. */
export const DEFAULT_FLOOR_DAWNS = 3;

// ---- shared helpers (later reducers reuse these) ---------------------------------------------------------------------

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`effect: unknown ${what}`);
  return value;
}

/** The sparse LocationState of `locationId`, created on first touch. */
export function locationState(ctx: StepCtx, locationId: string): LocationState {
  const states = ctx.s.world.locationStates;
  states[locationId] ??= {
    visited: false,
    visitCount: 0,
    items: [],
    itemsSpawned: false,
    encountersCleared: [],
    encounterClearedDay: {},
    eventsFired: [],
    flags: {},
    unlockedExits: [],
    lockedExits: [],
    scattered: [],
    encounterHp: {},
  };
  return states[locationId];
}

/** Adds `count` of an item to the inventory (stacking up to maxStack); returns the touched instances. */
export function addItem(ctx: StepCtx, itemId: string, count: number, rarity?: ItemInstance['rarity']): ItemInstance[] {
  const def = need(ctx.content.items[itemId], `item '${itemId}'`);
  const r = rarity ?? defaultRarity(def); // TODO(U27/U34): roll rarity for rarityRule 'rolled' (config.rarityWeights)
  const inventory = ctx.s.player.inventory;
  const touched: ItemInstance[] = [];
  const make = (qty: number): ItemInstance => {
    const item = { uid: ctx.uid('i'), itemId, qty, rarity: r, affixes: [...(def.fixedAffixes ?? [])] };
    inventory.push(item);
    return item;
  };
  if (!isStackable(def)) {
    for (let i = 0; i < count; i++) touched.push(make(1));
    return touched;
  }
  const max = def.maxStack ?? 99;
  let left = count;
  for (const stack of inventory) {
    if (left === 0) break;
    if (stack.itemId !== itemId || stack.rarity !== r || stack.qty >= max) continue;
    const add = Math.min(left, max - stack.qty);
    stack.qty += add;
    left -= add;
    touched.push(stack);
  }
  while (left > 0) {
    const qty = Math.min(left, max);
    touched.push(make(qty));
    left -= qty;
  }
  return touched;
}

/** Removes up to `count` (inventory first, then equipped); returns how many were removed. */
export function removeItem(ctx: StepCtx, itemId: string, count: number): number {
  const player = ctx.s.player;
  let left = count;
  for (let i = 0; i < player.inventory.length && left > 0; ) {
    const stack = player.inventory[i] as ItemInstance;
    if (stack.itemId !== itemId) {
      i++;
      continue;
    }
    const take = Math.min(left, stack.qty);
    stack.qty -= take;
    left -= take;
    if (stack.qty === 0) player.inventory.splice(i, 1);
    else i++;
  }
  for (const slot of ['weapon', 'armor', 'trinket1', 'trinket2'] as const) {
    if (left > 0 && player.equipment[slot]?.itemId === itemId) {
      player.equipment[slot] = null;
      left -= 1;
      ctx.emit({ t: 'itemUnequipped', slot });
    }
  }
  return count - left;
}

const killBaseline = (ctx: StepCtx): Record<string, number> =>
  Object.fromEntries(Object.entries(ctx.s.counters.kills).map(([id, n]) => [`kills:${id}`, n]));

/**
 * Puts a quest at `stage` (starting it if needed) and records the kill baseline that `killed.sinceStage` reads.
 * Emits questStarted (if it starts) and questAdvanced. TODO(U33): stage outcomes, onEnter/onExit, rewards.
 */
export function enterStage(ctx: StepCtx, questId: string, stage: string): void {
  const def = need(ctx.content.quests[questId], `quest '${questId}'`);
  const stageDef = need(
    def.stages.find((st) => st.id === stage),
    `stage '${stage}' of '${questId}'`,
  );
  const s = ctx.s;
  const existing = s.quests[questId];
  if (!existing || existing.status === 'inactive') {
    const fresh: QuestState = { status: 'active', stage, startedDay: dayOf(s.clock.ticks), endedDay: null, counters: {}, objectivesDone: [] };
    s.quests[questId] = fresh;
    ctx.emit({ t: 'questStarted', questId });
  }
  const qs = s.quests[questId] as QuestState;
  qs.stage = stage;
  Object.assign(qs.counters, killBaseline(ctx));
  ctx.emit({ t: 'questAdvanced', questId, stage, journal: stageDef.journal ?? '' });
}

/** Moves the Breach Clock limit by `watches`, with Frayed Clock halving and the floor (DESIGN §10.1, PLAN §4.11). */
export function changeLimit(ctx: StepCtx, watches: number, source: string): void {
  const { s, content } = ctx;
  const halve = s.meta.modifiers.some((id) => content.modifiers[id]?.rules.some((rule) => rule.kind === 'clock_base_watches' && rule.halveOthers) ?? false);
  const delta = halve ? Math.trunc(watches / 2) : watches;
  const clock = s.clock;
  const floor = clock.ticks - (clock.ticks % TICKS_PER_DAY) + TICKS_PER_DAY * (content.config.clock?.floorDawns ?? DEFAULT_FLOOR_DAWNS);
  const wanted = clock.limitTicks + delta;
  const next = delta < 0 ? Math.max(wanted, Math.min(clock.limitTicks, floor)) : wanted;
  const applied = next - clock.limitTicks;
  clock.limitTicks = next;
  if (applied !== 0) clock.modifiers.push({ source, watches: applied });
  ctx.emit({ t: 'clockChanged', deltaWatches: applied, limitTicks: next, floored: next !== wanted });
}

/**
 * Time passes by `watches` (no-op while the clock is frozen in Silverwood Before): one watchAdvanced per watch and a
 * dayAdvanced at each dawn crossed. Dawn hooks, per-watch status ticks, clock warnings and expiry run afterwards in
 * U20's post-step clock hook (`reducers/loop.ts`).
 */
export function advanceTime(ctx: StepCtx, watches: number): void {
  const clock = ctx.s.clock;
  if (clock.frozen) return;
  for (let i = 0; i < watches; i++) {
    clock.ticks += 1;
    ctx.emit({ t: 'watchAdvanced', day: dayOf(clock.ticks), watch: watchOf(clock.ticks) });
    if (watchOf(clock.ticks) === 0) ctx.emit({ t: 'dayAdvanced', day: dayOf(clock.ticks), daysLeft: daysLeft(clock) });
  }
}

/** Rejects: the effect belongs to a system that is not built yet. */
const notYet =
  (unit: string, why = 'is not implemented yet') =>
  (_v: unknown, ctx: StepCtx, key: EffectKey): never =>
    ctx.reject(`effect '${key}' ${why} (${unit})`);
const combatScope = (unit: string) => notYet(unit, 'is combat-scope (D-069.9); the combat engine applies it');

// ---- appliers --------------------------------------------------------------------------------------------------------

type Appliers = { readonly [K in EffectKey]: (v: EffectAtoms[K], ctx: StepCtx, key: K, source: string) => void };

const APPLIERS: Appliers = {
  setFlag: (id, { s }) => {
    s.flags[id] = true;
  },
  clearFlag: (id, { s }) => {
    delete s.flags[id];
  },
  grantEcho: (id, ctx) => {
    const s = ctx.s;
    if (s.echoesThisLoop.includes(id)) return;
    s.echoesThisLoop.push(id);
    s.counters.echoesGainedThisLoop += 1;
    const firstEver = !ctx.profile.echoes.includes(id);
    if (firstEver) ctx.profileDraft().echoes.push(id);
    ctx.emit({ t: 'echoGained', echoId: id, firstEver });
  },
  questStart: (id, ctx) => {
    const def = need(ctx.content.quests[id], `quest '${id}'`);
    const status = ctx.s.quests[id]?.status ?? 'inactive';
    if (status !== 'inactive') return;
    enterStage(ctx, id, need(def.firstStage ?? def.stages[0]?.id, `first stage of '${id}'`));
  },
  questAdvance: ({ quest, stage }, ctx) => {
    need(ctx.content.quests[quest], `quest '${quest}'`);
    const qs = ctx.s.quests[quest];
    if (qs?.status === 'completed' || qs?.status === 'failed') return;
    if (qs?.status === 'active' && qs.stage === stage) return;
    enterStage(ctx, quest, stage);
  },
  questFail: (id, ctx) => {
    need(ctx.content.quests[id], `quest '${id}'`);
    const s = ctx.s;
    const qs = s.quests[id];
    if (qs?.status === 'completed' || qs?.status === 'failed') return;
    const day = dayOf(s.clock.ticks);
    s.quests[id] = { status: 'failed', stage: qs?.stage ?? '', startedDay: qs?.startedDay ?? null, endedDay: day, counters: qs?.counters ?? {}, objectivesDone: qs?.objectivesDone ?? [] };
    s.counters.questsFailed += 1;
    ctx.emit({ t: 'questFailed', questId: id });
  },
  giveItem: ({ item, count = 1, rarity }, ctx, _key, source) => {
    const touched = addItem(ctx, item, count, rarity);
    const first = touched[0] as ItemInstance;
    ctx.emit({ t: 'itemGiven', item: { ...first, qty: count, affixes: [...first.affixes] }, source });
  },
  takeItem: ({ item, count = 1 }, ctx) => {
    need(ctx.content.items[item], `item '${item}'`);
    const removed = removeItem(ctx, item, count);
    if (removed > 0) ctx.emit({ t: 'itemLost', itemId: item, qty: removed, reason: 'taken' });
  },
  rep: ({ faction, delta }, ctx) => {
    const before = ctx.s.reputation[faction];
    const after = clamp(before + delta, REPUTATION_MIN, REPUTATION_MAX);
    ctx.s.reputation[faction] = after;
    ctx.emit({
      t: 'reputationChanged',
      faction,
      delta: after - before,
      value: after,
      tierBefore: repTier(before, ctx.content),
      tierAfter: repTier(after, ctx.content),
    });
  },
  loyalty: ({ companion, delta }, ctx) => {
    const c = ctx.s.companions.recruited[companion];
    if (!c) return; // TODO(U32): bond loyalty for companions not yet recruited is applied at recruitment
    const before = c.loyalty;
    c.loyalty = clamp(before + delta, 0, LOYALTY_MAX);
    ctx.emit({ t: 'loyaltyChanged', companionId: companion, delta: c.loyalty - before, value: c.loyalty });
  },
  gold: (n, ctx) => {
    const { player, counters } = ctx.s;
    const before = player.gold;
    player.gold = Math.max(0, before + n);
    const delta = player.gold - before;
    if (delta > 0) counters.goldEarned += delta;
    else counters.goldSpent -= delta;
    ctx.emit({ t: 'goldChanged', delta, total: player.gold });
  },
  xp: (n, ctx) => void grantXp(ctx, n), // U21: level-ups, refills (progression.ts)
  resonance: (n, ctx, _key, source) => {
    const p = ctx.profileDraft();
    p.resonance = Math.max(0, p.resonance + n);
    if (n > 0) p.resonanceEarnedTotal += n;
    ctx.emit({ t: 'resonanceGained', amount: n, reason: source, total: p.resonance });
  },
  heal: ({ hp, mp }, ctx, _key, source) => {
    const player = ctx.s.player; // TODO(U23/U26): inside combat, the party Combatant snapshot
    const before = player.hp;
    if (hp !== undefined) player.hp = hp === 'full' ? player.hpMax : Math.min(player.hpMax, player.hp + hp);
    if (mp !== undefined) player.mp = mp === 'full' ? player.mpMax : Math.min(player.mpMax, player.mp + mp);
    ctx.emit({ t: 'healed', targetUid: 'player', amount: player.hp - before, source });
  },
  damage: ({ hp }, ctx) => {
    const player = ctx.s.player;
    const before = player.hp;
    player.hp = Math.max(1, before - hp); // TODO(U30): out-of-combat damage never kills until death handling lands
    ctx.s.counters.damageTaken += before - player.hp;
    ctx.log(`You take ${before - player.hp} damage.`, 'event');
  },
  corruption: (n, ctx) => {
    const player = ctx.s.player;
    const before = player.corruption;
    player.corruption = clamp(before + n, 0, ctx.content.config.corruptionMax ?? 6);
    ctx.emit({ t: 'corruptionChanged', value: player.corruption, delta: player.corruption - before });
  },
  clockWatches: (n, ctx, _key, source) => changeLimit(ctx, n, source),
  passWatches: (n, ctx) => advanceTime(ctx, n),
  spawn: ({ creature, location }, ctx) => {
    const { s, content } = ctx;
    need(content.creatures[creature], `creature '${creature}'`);
    const at = location ?? s.world.currentLocationId;
    const where = need(content.locations[at], `location '${at}'`);
    (s.world.pendingEncounters[at] ??= []).push({
      id: ctx.uid('spawn_'),
      groups: [{ creatureId: creature, count: 1 }],
      once: true,
      onFlee: 'scatter',
    });
    ctx.log(`${content.creatures[creature]?.name ?? creature} appears at ${where.name ?? at}.`, 'event');
  },
  teleport: (to, ctx) => {
    const { s, content } = ctx;
    const def = need(content.locations[to], `location '${to}'`);
    s.world.previousLocationId = s.world.currentLocationId;
    s.world.currentLocationId = to;
    const ls = locationState(ctx, to);
    const firstVisit = !ls.visited;
    ls.visited = true;
    ls.visitCount += 1;
    if (!s.world.discovered.includes(to)) {
      s.world.discovered.push(to);
      ctx.emit({ t: 'locationDiscovered', locationId: to });
    }
    ctx.emit({ t: 'locationEntered', locationId: to, firstVisit, regionId: def.regionId }); // arrival hooks: U20 post-step
  },
  unlockExit: ({ from, to }, ctx) => {
    need(ctx.content.locations[from], `location '${from}'`);
    need(ctx.content.locations[to], `location '${to}'`);
    const ls = locationState(ctx, from);
    if (!ls.unlockedExits.includes(to)) ls.unlockedExits.push(to);
    ls.lockedExits = ls.lockedExits.filter((id) => id !== to);
    ctx.emit({ t: 'exitUnlocked', from, to });
  },
  scatter: ({ location }, ctx) => {
    const def = need(ctx.content.locations[location], `location '${location}'`);
    const ls = locationState(ctx, location);
    for (const enc of def.encounters ?? []) {
      const fixed = (enc.once ?? true) && (enc.fleeable ?? true);
      if (!fixed || ls.encountersCleared.includes(enc.id) || ls.scattered.includes(enc.id)) continue;
      ls.scattered.push(enc.id);
      ctx.emit({ t: 'encounterScattered', locationId: location, encounterId: enc.id });
    }
  },
  multiHit: combatScope('U26'),
  stripBuffs: combatScope('U26'),
  healOnDamage: combatScope('U26'),
  surviveRounds: combatScope('U27'),
  leaveCombat: combatScope('U27'),
  recruit: (id, ctx) => {
    const def = need(ctx.content.companions[id], `companion '${id}'`);
    const companions = ctx.s.companions;
    const existing = companions.recruited[id];
    if (existing?.recruited && !existing.dead) return;
    companions.recruited[id] = {
      id,
      recruited: true,
      loyalty: def.startingLoyalty ?? 0,
      hp: def.stats.hp, // TODO(U28): level scaling (perLevel) and the bond-Echo loyalty start
      hpMax: def.stats.hp,
      ko: false,
      dead: false,
      stance: 'guarded',
      cooldowns: {},
      waitingAt: null,
      arcFlags: {},
    };
    companions.activeId ??= id;
    ctx.emit({ t: 'companionRecruited', companionId: id });
  },
  dismiss: (id, ctx) => {
    const companions = ctx.s.companions;
    if (!companions.recruited[id]) return;
    delete companions.recruited[id];
    if (companions.activeId === id) companions.activeId = null;
    ctx.emit({ t: 'companionDismissed', companionId: id });
  },
  startCombat: (id, ctx) => startEncounterById(ctx, id), // U23
  startDialogue: notYet('U33'),
  endLoop: ({ closer, reason }, ctx) => {
    // TODO(U30): RunRecord, Resonance, Echo/profile writes and the loopEnded event (DESIGN §10.3)
    ctx.s.pendingEnding = reason === undefined ? { outcome: closer, slideIndex: 0 } : { outcome: closer, reason, slideIndex: 0 };
    enterMode(ctx, 'ending');
  },
  ending: (id, ctx) => {
    need(ctx.content.endings[id], `ending '${id}'`);
    ctx.s.pendingEnding = { outcome: id, slideIndex: 0 }; // TODO(U30): profile endingsReached, mastery, Resonance
    enterMode(ctx, 'ending');
    ctx.emit({ t: 'endingReached', endingId: id });
  },
  unlockRecipe: notYet('U34', 'is not implemented yet (no known-recipe state)'),
  unlockCodex: (id, ctx) => {
    need(ctx.content.codex[id], `codex entry '${id}'`);
    if (ctx.profile.codexUnlocked.includes(id)) return;
    ctx.profileDraft().codexUnlocked.push(id);
    ctx.emit({ t: 'codexUnlocked', codexId: id });
  },
  counter: ({ name, delta }, { s }) => {
    s.counters.custom[name] = (s.counters.custom[name] ?? 0) + delta;
  },
  resolve: (n, ctx, _key, source) => {
    const communion = ctx.s.combat?.communion;
    if (!communion) return; // communion only (DESIGN §13.3)
    const before = communion.resolve;
    communion.resolve = clamp(before + n, 0, RESOLVE_MAX);
    ctx.emit({ t: 'resolveChanged', delta: communion.resolve - before, value: communion.resolve, movement: communion.movement, reason: source });
  },
};

/** Applies one effect to the step draft (PLAN §4.9). */
export function apply(effect: Effect, ctx: StepCtx, opts: ApplyOptions = {}): void {
  const [key, value] = atomOf<EffectKey>(effect, 'apply');
  const fn = APPLIERS[key] as ((v: unknown, ctx: StepCtx, key: EffectKey, source: string) => void) | undefined;
  if (!fn) throw new Error(`apply: unknown effect atom '${key}'`);
  fn(value, ctx, key, opts.source ?? 'effect');
}

/** Applies effects in order (PLAN §4.9). */
export function applyAll(effects: readonly Effect[], ctx: StepCtx, opts: ApplyOptions = {}): void {
  for (const effect of effects) apply(effect, ctx, opts);
}
