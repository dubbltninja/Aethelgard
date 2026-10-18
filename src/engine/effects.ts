// Effect applier (PLAN §4.9, DESIGN §13.3): `apply(effect, ctx)` mutates the step draft through the ctx and emits
// the events the UI renders. Effects are applied in order inside one `step`, so a later rejection rolls all of them
// back. Flags and counters are invisible state and emit nothing. Ids must exist in the (validated) content pack;
// a missing one is a programmer error and throws.
//
// Minimal implementations, marked TODO(Uxx) where the owning system adds behaviour later:
// xp (level-ups U21), heal/damage (combat snapshots U23; never lethal, D-072),
// passWatches (dawn hooks, warnings and expiry U20), teleport (entry hooks U20). grantEcho: once per loop, never beside
// an `exclusiveWith` Echo, then `onGrant` (U32).
// recruit: loyalty starts at the companion's `startingLoyalty` + the Attunements' `loyalty_start` (U33); a bond Echo
// raises it to 25 + that bonus after the step (echoes.ts `echoPostStep`, U32); max HP by level: combat/companionAi.ts
// `companionPostStep` (U28). loyalty: gains × (1 + Companion's Trust, `loyalty_gain`; U33).
// Quests (U33): questStart/questAdvance/questFail go through the stage machine's transitions below (`enterStage`,
// `finishQuest`: onExit → onEnter → an `outcome` ends the quest; completion pays `rewards` once). Objectives, branches,
// `failWhen`, time limits and auto-starts are swept after every step by reducers/quests.ts.
// startDialogue (U33): `openScene` below — a scene's lifecycle (open → entry node → nodes → close) lives here because
// effects must start it inside the step and src/engine has no import cycles; reducers/dialogue.ts picks scenes for
// `talk`/camp and plays choices.
// endLoop/ending enter ending mode; the loop's end (RunRecord, Resonance, profile writes) runs after the step's
// effects in U30's `loopEndHook` (reducers/loop.ts).
// startCombat starts the encounter (U23, combat/turnOrder.ts; the fight plays from the combat post-step hook).
// U34: giveItem rolls each piece of 'rolled' gear that names no rarity (rarity.ts, in the band where the Wayfinder
// stands); unlockRecipe marks a recipe known for the loop (`player.uses['recipe:<id>']`, which `requiresItemRead`
// reads, reducers/crafting.ts); revive brings a knocked-out companion round at a share of its max HP, in a fight or
// out of one (combat/revive.ts; Lanternreed Salts, D-080).
// Not yet applicable — they reject the action, naming the unit: the five combat-scope atoms (U26/U27; D-069.9).
import type { DialogueNode, DialogueScene } from '@schema/dialogue';
import type { Effect, EffectAtoms, EffectKey } from '@schema/effect';
import type { Quest } from '@schema/quest';
import { reviveCompanion } from './combat/revive';
import { startEncounterById } from './combat/turnOrder';
import { atomOf, dayOf, daysLeft, evaluate, repTier, watchOf, TICKS_PER_DAY } from './conditions';
import { enterMode, type ContentPack, type StepCtx } from './ctx';
import { defaultRarity, isStackable } from './newRun';
import { grantXp } from './progression';
import { lootBand, rollPiece } from './rarity';
import { ATT_SCRIPT, loyaltyStartBonus, scaleXp, scriptNumber } from './runRules';
import type { Profile } from './types/profile';
import type { DialogueState, GameState, ItemInstance, LocationState, QuestState } from './types/state';
import { clamp, round } from './util/math';

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

/** `LocationState.flags` key `ground:<item uid>` → the Breach-Clock day it was left (U26b; reducers/loop.ts `expireGroundLoot`). */
export const LEFT_ON_GROUND = 'ground:';

/**
 * Leaves `item` on the ground at `locationId` — a drop, a full pack's spoils — marked with today's day: DESIGN §7.8, it
 * persists at the node until the next dawn. (A location's own content items are not marked and stay.)
 */
export function leaveOnGround(ctx: StepCtx, locationId: string, item: ItemInstance): void {
  const ls = locationState(ctx, locationId);
  ls.items.push(item);
  ls.flags[`${LEFT_ON_GROUND}${item.uid}`] = dayOf(ctx.s.clock.ticks);
}

/** `player.uses` key prefix of a recipe known this loop (`unlockRecipe`; U34, reducers/crafting.ts `requiresItemRead`). */
export const KNOWN_RECIPE = 'recipe:';

/** Adds `count` of an item to the inventory (stacking up to maxStack); returns the touched instances. */
export function addItem(ctx: StepCtx, itemId: string, count: number, rarity?: ItemInstance['rarity']): ItemInstance[] {
  const def = need(ctx.content.items[itemId], `item '${itemId}'`);
  const r = rarity ?? defaultRarity(def); // rolled gear draws its rarity before it gets here (giveItem, loot, stock)
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

// ---- quests: the stage machine's transitions (U33; DESIGN §13.1, PLAN §5.9) ----------------------------------------------
//
// A quest is active at one stage. Entering a stage: the previous stage's `onExit`, then the stage is current (its
// objectives start over; the kill baseline `killed.sinceStage` reads, its start day and its place in the history are
// written to `QuestState.counters`), `questAdvanced`, its `onEnter`; a stage with an `outcome` then ends the quest.
// Completing pays `rewards` once (xp, gold, items, rep, Echoes, Resonance); failing runs `onFail`. reducers/quests.ts
// decides *when* a stage advances (objectives, `advanceWhen`, `next`, `failWhen`, `timeLimitDays`, `startWhen`).

/** `QuestState.counters` key: the Breach-Clock day the current stage began (`timeLimitDays`). */
export const STAGE_DAY = 'stageDay';
/** `QuestState.counters` key prefix: `stage:<id>` = the order the stage was entered (1, 2, …) — the journal's history. */
export const STAGE_ORDER = 'stage:';

/** A once-per-profile quest (`repeatablePerLoop: false`) already completed in an earlier loop (its record or its paid Resonance). */
export function questDoneEarlier(profile: Readonly<Profile>, questId: string): boolean {
  return profile.discoveries.includes(`quest:${questId}`) || profile.runHistory.some((r) => r.questsCompleted.includes(questId));
}

/** True when `questId` may start now as far as the engine is concerned: inactive and, if once per profile, never completed. */
export function questStartable(s: GameState, profile: Readonly<Profile>, questId: string, def: Pick<Quest, 'repeatablePerLoop'>): boolean {
  const status = s.quests[questId]?.status ?? 'inactive';
  return status === 'inactive' && !(def.repeatablePerLoop === false && questDoneEarlier(profile, questId));
}

const isOpen = (qs: QuestState | undefined): boolean => qs?.status === 'active';

/**
 * Puts a quest at `stage`, starting it if it was inactive (`questStarted`): the transition described above. A finished
 * quest is left alone; effects of `onExit`/`onEnter` that moved or ended the quest themselves win.
 */
export function enterStage(ctx: StepCtx, questId: string, stage: string): void {
  const def = need(ctx.content.quests[questId], `quest '${questId}'`);
  const stageDef = need(
    def.stages.find((st) => st.id === stage),
    `stage '${stage}' of '${questId}'`,
  );
  const s = ctx.s;
  const source = `quest:${questId}`;
  const before = s.quests[questId];
  if (before?.status === 'completed' || before?.status === 'failed') return;
  if (!isOpen(before)) {
    s.quests[questId] = { status: 'active', stage, startedDay: dayOf(s.clock.ticks), endedDay: null, counters: {}, objectivesDone: [] };
    ctx.emit({ t: 'questStarted', questId });
  } else {
    const from = (before as QuestState).stage;
    applyAll(def.stages.find((st) => st.id === from)?.onExit ?? [], ctx, { source });
    const now = s.quests[questId];
    if (!isOpen(now) || now?.stage !== from) return;
  }
  const qs = s.quests[questId] as QuestState;
  const order = Object.keys(qs.counters).filter((k) => k.startsWith(STAGE_ORDER)).length + 1;
  qs.stage = stage;
  qs.objectivesDone = [];
  for (const [id, n] of Object.entries(s.counters.kills)) qs.counters[`kills:${id}`] = n;
  qs.counters[STAGE_DAY] = dayOf(s.clock.ticks);
  qs.counters[`${STAGE_ORDER}${stage}`] = order;
  ctx.emit({ t: 'questAdvanced', questId, stage, journal: stageDef.journal ?? '' });
  applyAll(stageDef.onEnter ?? [], ctx, { source });
  const after = s.quests[questId];
  if (stageDef.outcome !== undefined && isOpen(after) && after?.stage === stage) finishQuest(ctx, questId, stageDef.outcome);
}

/** Ends a quest that is not finished yet: `complete` (`questCompleted`, then the rewards) or `fail` (`questFailed`, `onFail`). */
export function finishQuest(ctx: StepCtx, questId: string, outcome: 'complete' | 'fail'): void {
  const def = need(ctx.content.quests[questId], `quest '${questId}'`);
  const s = ctx.s;
  const qs: QuestState = s.quests[questId] ?? { status: 'inactive', stage: '', startedDay: null, endedDay: null, counters: {}, objectivesDone: [] };
  if (qs.status === 'completed' || qs.status === 'failed') return;
  s.quests[questId] = qs;
  qs.endedDay = dayOf(s.clock.ticks);
  const source = `quest:${questId}`;
  if (outcome === 'fail') {
    qs.status = 'failed';
    s.counters.questsFailed += 1;
    ctx.emit({ t: 'questFailed', questId });
    applyAll(def.onFail ?? [], ctx, { source });
    return;
  }
  qs.status = 'completed';
  s.counters.questsCompleted += 1;
  ctx.emit({ t: 'questCompleted', questId });
  const r: Partial<Quest['rewards']> = def.rewards ?? {};
  if ((r.xp ?? 0) > 0) apply({ xp: r.xp as number }, ctx, { source });
  if ((r.gold ?? 0) > 0) apply({ gold: r.gold as number }, ctx, { source });
  for (const it of r.items ?? []) apply({ giveItem: { item: it.itemId, count: it.count } }, ctx, { source });
  for (const rep of r.rep ?? []) apply({ rep }, ctx, { source });
  for (const echo of r.echoes ?? []) apply({ grantEcho: echo }, ctx, { source });
  if ((r.resonance ?? 0) > 0) apply({ resonance: r.resonance as number }, ctx, { source });
}

// ---- dialogue: a scene's lifecycle (U33; DESIGN §13.2, PLAN §5.10) --------------------------------------------------------
//
// Open: the scene (`dialogueStarted`), remembering the mode it interrupted (explore, combat — boss talk — or threshold;
// a scene opened from inside another one replaces it and keeps that mode); its entry node is the first `entry` rule that
// holds, else its first node. Entering a node: the first text variant that holds, `dialogueNode`, then its `onEnter`. A
// choice-less node spoken by a companion (its plain id, or `companion`) who is not standing in the party is an
// interjection that did not happen: it is skipped along its `next`. Close (`end`, or an effect that left dialogue mode —
// a fight, an ending): the done flag `flag_scene_done_<scene>` (C-58; set for every scene, read for non-repeatable ones),
// the active companion's first matching reaction (a `dialogue` log line and its loyalty), `dialogueEnded`, back to the
// interrupted mode (combat only while the fight stands), then the scene's `onEnd`.

/** C-58: set when a scene ends (it bars a non-repeatable scene for the rest of the loop). */
export const sceneDoneFlag = (sceneId: string): string => `flag_scene_done_${sceneId}`;
/** C-58: written when an `oncePerLoop` choice is taken. */
export const choiceFlag = (sceneId: string, choiceId: string): string => `flag_choice_${sceneId}_${choiceId}`;

/** The scene open now, if it is a content scene (the Loop 1 Apex prompt is engine-built, D-074). */
export function openSceneDef(s: GameState, content: ContentPack): DialogueScene | undefined {
  return s.dialogue === null ? undefined : content.dialogues[s.dialogue.sceneId];
}

/** The node the open scene stands at. */
export function currentNode(s: GameState, content: ContentPack): DialogueNode | undefined {
  const nodeId = s.dialogue?.nodeId;
  return openSceneDef(s, content)?.nodes.find((n) => n.id === nodeId);
}

/** The companion standing in the party (recruited, alive, not knocked out), if any. */
function standingCompanionId(s: GameState): string | null {
  const id = s.companions.activeId;
  const c = id === null ? undefined : s.companions.recruited[id];
  return c !== undefined && c.recruited && !c.dead && !c.ko ? c.id : null;
}

/** A node's speaker as shown: `companion` is the companion in the party. */
export function speakerOf(s: GameState, node: DialogueNode): string {
  return node.speaker === 'companion' ? (standingCompanionId(s) ?? 'companion') : node.speaker;
}

/** A node's text: its first variant whose `when` holds, else its own. */
export function nodeText(s: GameState, profile: Readonly<Profile>, content: ContentPack, node: DialogueNode): string {
  return node.textVariants.find((v) => evaluate(v.when, s, profile, content))?.text ?? node.text;
}

/** A choice-less node voiced by a companion who is not standing in the party (skipped). */
function absentInterjection(s: GameState, content: ContentPack, node: DialogueNode): boolean {
  if (node.choices.length > 0 || node.next === undefined) return false;
  if (node.speaker === 'companion') return standingCompanionId(s) === null;
  return content.companions[node.speaker] !== undefined && standingCompanionId(s) !== node.speaker;
}

/** Scenes already closed in this step (a scene a fight took down is closed once, by whoever sees it first). */
const closedScenes = new WeakSet<DialogueState>();

/**
 * After effects ran inside the scene `d`: true when that scene is over — another scene replaced it, or an effect left
 * dialogue mode (an ending; a fight, which takes the scene down itself: combat/turnOrder.ts) and the scene is closed
 * here (its bookkeeping and `onEnd`, without going back to the mode it interrupted).
 */
export function settleDialogue(ctx: StepCtx, d: DialogueState): boolean {
  if (ctx.s.dialogue === d && ctx.s.mode === 'dialogue') return false;
  if (ctx.s.mode !== 'dialogue') closeScene(ctx, false, d);
  return true;
}

/** Enters `nodeId` of the open scene (see above); `end` closes the scene. */
export function enterNode(ctx: StepCtx, nodeId: string): void {
  const { s, content } = ctx;
  const d = s.dialogue;
  const scene = openSceneDef(s, content);
  if (d === null || scene === undefined) throw new Error('enterNode: no content scene is open');
  let id = nodeId;
  for (let hops = 0; ; hops++) {
    if (id === 'end') {
      closeScene(ctx, true);
      return;
    }
    const node = need(
      scene.nodes.find((n) => n.id === id),
      `node '${id}' of '${scene.id}'`,
    );
    if (!absentInterjection(s, content, node) || hops > scene.nodes.length) break;
    id = node.next as string;
  }
  const node = scene.nodes.find((n) => n.id === id) as DialogueNode;
  d.nodeId = id;
  if (!d.visitedNodes.includes(id)) d.visitedNodes.push(id);
  ctx.emit({ t: 'dialogueNode', nodeId: id, speaker: speakerOf(s, node), text: nodeText(s, ctx.profile, content, node) });
  applyAll(node.onEnter ?? [], ctx, { source: `scene:${scene.id}` });
  settleDialogue(ctx, d);
}

const returnModeOf = (s: GameState): DialogueState['returnMode'] | null =>
  s.mode === 'dialogue' ? (s.dialogue?.returnMode ?? (s.combat !== null ? 'combat' : 'explore')) : s.mode === 'explore' || s.mode === 'combat' || s.mode === 'threshold' ? s.mode : null;

/** Opens `sceneId` (the `startDialogue` effect, `talk`, a camp conversation): see above. `npcId` defaults to the scene's. */
export function openScene(ctx: StepCtx, sceneId: string, npcId: string | null = null): void {
  const { s, content } = ctx;
  const scene = need(content.dialogues[sceneId], `dialogue '${sceneId}'`);
  const returnMode = returnModeOf(s) ?? ctx.reject(`a dialogue cannot start in ${s.mode} mode`);
  if (s.dialogue !== null) closeScene(ctx, false);
  const who = npcId ?? scene.npcId ?? null;
  s.dialogue = { sceneId, nodeId: '', npcId: who, visitedNodes: [], choicesTaken: [], returnMode };
  enterMode(ctx, 'dialogue');
  ctx.emit({ t: 'dialogueStarted', sceneId, npcId: who });
  const entry = typeof scene.entry === 'string' ? scene.entry : scene.entry.find((r) => evaluate(r.when, s, ctx.profile, content))?.node;
  enterNode(ctx, entry ?? (scene.nodes[0] as DialogueNode).id);
}

/** Closes the open scene, or `d` (see above); `resume` goes back to the mode the scene interrupted. */
export function closeScene(ctx: StepCtx, resume: boolean, d: DialogueState | null = ctx.s.dialogue): void {
  const { s, content } = ctx;
  if (d === null || closedScenes.has(d)) return;
  closedScenes.add(d);
  const scene = content.dialogues[d.sceneId];
  const source = `scene:${d.sceneId}`;
  if (scene !== undefined) {
    s.flags[sceneDoneFlag(scene.id)] = true;
    const companion = standingCompanionId(s);
    const reaction = scene.companionReactions.find((r) => r.companionId === companion && (r.when === undefined || evaluate(r.when, s, ctx.profile, content)));
    if (reaction !== undefined) {
      ctx.log(reaction.text, 'dialogue');
      if (reaction.loyalty !== 0) apply({ loyalty: { companion: reaction.companionId, delta: reaction.loyalty } }, ctx, { source });
    }
  }
  if (s.dialogue === d) {
    s.dialogue = null;
    ctx.emit({ t: 'dialogueEnded', sceneId: d.sceneId });
  }
  if (resume && s.mode === 'dialogue') enterMode(ctx, d.returnMode === 'combat' && s.combat === null ? 'explore' : d.returnMode);
  if (scene !== undefined) applyAll(scene.onEnd, ctx, { source });
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

/** U34e (D-097): the `damage` effect's HP — flat `hp` plus `pctMax` of max HP rounded down (at least 1 when it names a share). */
export function damageAmount(hpMax: number, hp: number | undefined, pctMax: number | undefined): number {
  const share = pctMax === undefined ? 0 : Math.max(1, Math.floor(pctMax * hpMax + 1e-9));
  return (hp ?? 0) + share;
}

/** The `statBonus` effect's log label per stat. */
const STAT_BONUS_LABEL: Readonly<Record<EffectAtoms['statBonus']['stat'], string>> = {
  strength: 'Strength',
  magic: 'Magic',
  agility: 'Agility',
  hpMax: 'Max HP',
  mpMax: 'Max MP',
};

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
    const { s, content } = ctx;
    if (s.echoesThisLoop.includes(id)) return;
    // U32 (echoes.ts): never beside an Echo it is exclusive with in this loop (D-010; either record may name the other)
    const def = content.echoes[id];
    const exclusive = (a: { exclusiveWith?: readonly string[] } | undefined, b: string): boolean => a?.exclusiveWith?.includes(b) ?? false;
    if (s.echoesThisLoop.some((other) => exclusive(def, other) || exclusive(content.echoes[other], id))) return;
    s.echoesThisLoop.push(id);
    s.counters.echoesGainedThisLoop += 1;
    const firstEver = !ctx.profile.echoes.includes(id);
    if (firstEver) ctx.profileDraft().echoes.push(id);
    ctx.emit({ t: 'echoGained', echoId: id, firstEver });
    applyAll(def?.onGrant ?? [], ctx, { source: `echo:${id}` }); // U32: the Echo's own effects
  },
  questStart: (id, ctx) => {
    const def = need(ctx.content.quests[id], `quest '${id}'`);
    if (!questStartable(ctx.s, ctx.profile, id, def)) return; // running, finished, or once per profile and done (U33)
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
    finishQuest(ctx, id, 'fail');
  },
  giveItem: ({ item, count = 1, rarity }, ctx, _key, source) => {
    const def = need(ctx.content.items[item], `item '${item}'`);
    if (rarity === undefined && def.rarityRule === 'rolled') {
      // U34 (D-079): each piece draws its rarity in the band where the Wayfinder stands, then its affixes (rarity.ts)
      const band = lootBand(ctx.content, ctx.s.world.currentLocationId, ctx.s.player.level);
      for (let i = 0; i < count; i++) {
        const piece: ItemInstance = { uid: ctx.uid('i'), itemId: item, qty: 1, ...rollPiece(ctx, def, band) };
        ctx.s.player.inventory.push(piece);
        ctx.emit({ t: 'itemGiven', item: { ...piece, affixes: [...piece.affixes] }, source });
      }
      return;
    }
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
    if (!c) return; // not recruited: nothing to change (a bond Echo's start applies at recruitment, echoes.ts)
    const before = c.loyalty;
    // U33: Companion's Trust (DESIGN §10.7, §12.5) — gains × (1 + pct), rounded; losses unchanged
    const trust = scriptNumber(ctx.s.player, ctx.content, ATT_SCRIPT.loyaltyGain, 'pct');
    c.loyalty = clamp(before + (delta > 0 ? round(delta * (1 + trust)) : delta), 0, LOYALTY_MAX);
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
  // U21: level-ups, refills (progression.ts); U31: Quick Study and Pacifist's Vow ×2 (runRules.ts `scaleXp`; kill XP is rewards.ts)
  xp: (n, ctx) => void grantXp(ctx, scaleXp(ctx.s.player, ctx.s.meta.modifiers, ctx.content, n)),
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
  damage: ({ hp, pctMax }, ctx) => {
    const player = ctx.s.player;
    const before = player.hp;
    const amount = damageAmount(player.hpMax, hp, pctMax); // U34e: a share of max HP (D-097)
    player.hp = Math.max(1, before - amount); // out-of-combat damage never kills (D-072); the Horde's lash is horde.ts
    ctx.s.counters.damageTaken += before - player.hp;
    ctx.log(`You take ${before - player.hp} damage.`, 'event');
  },
  // U52 (C1 addition): a bonus for the rest of the loop; the stored maxima follow at the post-step (derived.ts `syncMaxima`)
  statBonus: ({ stat, delta }, ctx) => {
    const bonuses = ctx.s.player.passiveBonuses;
    bonuses[stat] = (bonuses[stat] ?? 0) + delta;
    ctx.log(`${STAT_BONUS_LABEL[stat]} ${delta >= 0 ? '+' : '−'}${Math.abs(delta)} for the rest of this loop.`, 'event');
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
  areaMove: combatScope('U26b'),
  recruit: (id, ctx) => {
    const def = need(ctx.content.companions[id], `companion '${id}'`);
    const companions = ctx.s.companions;
    const existing = companions.recruited[id];
    if (existing?.recruited && !existing.dead) return;
    companions.recruited[id] = {
      id,
      recruited: true,
      // U33: + the Attunements' loyalty_start; a bond Echo raises it after the step (echoes.ts)
      loyalty: clamp((def.startingLoyalty ?? 0) + loyaltyStartBonus(ctx.s.player, ctx.content), 0, LOYALTY_MAX),
      hp: def.stats.hp, // level 1: companionPostStep (U28) moves max HP to the player's level; bond start: U32 echoes.ts
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
  startDialogue: (id, ctx) => openScene(ctx, id), // U33
  endLoop: ({ closer, reason }, ctx) => {
    // the loop's end (RunRecord, Resonance, profile writes, `loopEnded`): reducers/loop.ts `loopEndHook`, after this step
    ctx.s.pendingEnding = reason === undefined ? { outcome: closer, slideIndex: 0 } : { outcome: closer, reason, slideIndex: 0 };
    enterMode(ctx, 'ending');
  },
  ending: (id, ctx) => {
    need(ctx.content.endings[id], `ending '${id}'`);
    ctx.s.pendingEnding = { outcome: id, slideIndex: 0 }; // endingsReached, mastery, Resonance: `loopEndHook` (U30)
    enterMode(ctx, 'ending');
    ctx.emit({ t: 'endingReached', endingId: id });
  },
  unlockRecipe: (id, ctx) => {
    // U34: known for this loop (a pattern read, a scene); `requiresItemRead` recipes need it (reducers/crafting.ts)
    const def = need(ctx.content.recipes[id], `recipe '${id}'`);
    const uses = ctx.s.player.uses;
    if (uses[`${KNOWN_RECIPE}${id}`] !== undefined) return;
    uses[`${KNOWN_RECIPE}${id}`] = { loop: ctx.s.meta.loop };
    ctx.log(`You learn how to make the ${def.name}.`, 'event');
  },
  revive: (pct, ctx, _key, source) => {
    // U34 (D-080): Lanternreed Salts — the knocked-out companion comes round at `pct` of its max HP
    if (!reviveCompanion(ctx, pct, source)) ctx.log('No one here needs bringing round.', 'event');
  },
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
  // U34d (D-098 item 3): the nested effects apply only if `when` holds at this point of the list
  onlyIf: ({ when, effects }, ctx, _key, source) => {
    if (evaluate(when, ctx.s, ctx.profile, ctx.content)) applyAll(effects, ctx, { source });
  },
  // U34e (D-105): the Heartstone's state for the loop; the first resolution stands (the choice is offered once)
  heartstone: (outcome, ctx) => {
    const world = ctx.s.world;
    if (world.heartstone !== 'intact') return;
    world.heartstone = outcome;
    ctx.emit({ t: 'heartstoneResolved', outcome });
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
