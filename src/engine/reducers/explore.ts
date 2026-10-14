// Explore reducers (PLAN §4.6–4.7, §4.11; DESIGN §2.1, §4.7, §7.8, §8.2, §9.5, §10.1–10.2): move, retreat, take,
// takeAll, gather, wait, rest, examine; the location-arrival pipeline; and the Loop 1 Apex prompt (*Face it / Not yet*,
// D-067.1). Every action has a reducer (`step` dispatch) and an enumerator (`legalActions`) built on the same
// predicates, so the two agree by construction.
//
// Time passes only through `advanceTime` (effects.ts). Its per-watch and per-dawn consequences (out-of-combat status
// ticks, dawn hooks, warnings, expiry) run once per step in the clock hook (reducers/loop.ts), over the events the step
// emitted, so travel, rest and content `passWatches` effects get identical treatment.
//
// Arrival = the `teleport` effect's state change (current/previous location, visit count, discovery,
// `locationEntered`), then: first-entry item spawn → `enter` events → the Loop 1 Apex prompt, or the ARRIVAL_HOOKS
// (encounters U23, Horde spread U30) → an autosave checkpoint. A `teleport` applied by content gets the same pipeline
// from `arrivalHook` (post-step), for the arrival the player is still standing in.
import type { Exit, Location, LocationEvent } from '@schema/location';
import type { Item } from '@schema/item';
import { WATCH_NAMES, dayOf, evaluate, explain, watchOf } from '../conditions';
import { enterMode, type ContentPack, type StepCtx } from '../ctx';
import { addItem, advanceTime, apply, applyAll, locationState } from '../effects';
import { encounterArrivalHook } from './combat';
import type { Enumerator } from '../legalActions';
import { defaultRarity } from '../newRun';
import type { PostStepHook } from '../step';
import type { ActionOf, ExamineTarget } from '../types/actions';
import type { AutosaveReason, GameEvent } from '../types/events';
import type { Profile } from '../types/profile';
import type { GameState, ItemInstance, LocationState, StatusInstance } from '../types/state';
import { clone } from '../util/clone';
import { round } from '../util/math';

/** DESIGN §7.8: 40 stack slots; quest items and `key`-tagged items live in the Satchel and do not count. */
export const INVENTORY_SLOTS = 40;
/** DESIGN §4.5: the only statuses that persist out of combat; they tick per watch and any rest clears them. */
export const OUT_OF_COMBAT_STATUSES: readonly string[] = ['status_poison', 'status_bleed', 'status_curse'];
/** DESIGN §9.5: an inn's full rest grants this for the first fight of the day. */
export const RESTED_STATUS = 'status_rested';
/** WORLD §3.5 / D-048: the Tyrant's node; in Loop 1 arrival asks *Face it / Not yet* (D-067.1). */
export const APEX_LOCATION_ID = 'loc_temporal_breach_apex';
/** The engine-built Apex prompt (PLAN §4.12: ordinary `choose` actions); not a content scene. */
export const APEX_PROMPT_SCENE = 'scene_apex_prompt';
export const APEX_PROMPT_NODE = 'apex_prompt';
export const APEX_FACE_IT = 'face_it';
export const APEX_NOT_YET = 'not_yet';
const APEX_PROMPT_TEXT = 'The Amulet of Echoes burns against your throat. Whatever holds the Breach has not moved. Face it, or not yet?';

type Pr = Readonly<Profile>;

// ---- read helpers (state-only, for enumerators and reducers alike) ---------------------------------------------------

/** The content record of the current location, or undefined when the state stands somewhere the pack does not know. */
export function currentLocation(s: GameState, content: ContentPack): Location | undefined {
  return content.locations[s.world.currentLocationId];
}

const nameOf = (content: ContentPack, id: string): string => content.locations[id]?.name ?? id;

export type ExitState = 'open' | 'locked' | 'hidden';

/**
 * How an exit of `from` shows (PLAN §5.3, D-069.9): a road whose `gate` fails does not exist; an exit locked by
 * `lockExit` is locked; one unlocked by `unlockExit` is open; otherwise `when` decides, and a failing `when` hides a
 * `hidden` exit (Echo routes) and locks any other.
 */
export function exitState(s: GameState, content: ContentPack, profile: Pr, from: string, exit: Exit): ExitState {
  if (exit.kind === 'road' && !(exit.gate !== undefined && evaluate(exit.gate, s, profile, content))) return 'hidden';
  const ls = s.world.locationStates[from];
  if (ls?.lockedExits.includes(exit.to)) return 'locked';
  if (ls?.unlockedExits.includes(exit.to)) return 'open';
  if (exit.when === undefined || evaluate(exit.when, s, profile, content)) return 'open';
  return exit.hidden ? 'hidden' : 'locked';
}

/** The exits of the current location the player can see, with their state (hidden ones omitted). */
export function visibleExits(s: GameState, content: ContentPack, profile: Pr): { exit: Exit; state: Exclude<ExitState, 'hidden'> }[] {
  const from = s.world.currentLocationId;
  const out: { exit: Exit; state: Exclude<ExitState, 'hidden'> }[] = [];
  for (const exit of currentLocation(s, content)?.exits ?? []) {
    const state = exitState(s, content, profile, from, exit);
    if (state !== 'hidden') out.push({ exit, state });
  }
  return out;
}

/** The first visible exit of the current location to `to` (open ones first). */
function findExit(s: GameState, content: ContentPack, profile: Pr, to: string): { exit: Exit; state: 'open' | 'locked' } | undefined {
  const visible = visibleExits(s, content, profile).filter((v) => v.exit.to === to);
  return visible.find((v) => v.state === 'open') ?? visible[0];
}

/** "I should talk to Brak first. (Needs: Quests completed ≥ 6 (now 2))": `lockedText` plus the failing reasons. */
export function lockedReason(s: GameState, content: ContentPack, profile: Pr, from: string, exit: Exit): string {
  const head = exit.lockedText ?? `The way to ${nameOf(content, exit.to)} is closed.`;
  if (s.world.locationStates[from]?.lockedExits.includes(exit.to) || exit.when === undefined) return head;
  const failing = explain(exit.when, s, profile, content).parts.filter((p) => !p.ok).map((p) => p.text);
  return failing.length > 0 ? `${head} (Needs: ${failing.join('; ')})` : head;
}

/** Stack slots the inventory uses (DESIGN §7.8): Satchel items (quest, `key`) do not count. */
export function slotsUsed(s: GameState, content: ContentPack): number {
  return s.player.inventory.filter((i) => countsForSlots(content.items[i.itemId])).length;
}

const countsForSlots = (def: Item | undefined): boolean => def !== undefined && def.type !== 'quest' && !def.tags.includes('key');

/** New slots that `qty` of `itemId` (at `rarity`) would need after filling existing stacks. */
export function slotsNeeded(s: GameState, content: ContentPack, itemId: string, qty: number, rarity: ItemInstance['rarity']): number {
  const def = content.items[itemId];
  if (!countsForSlots(def) || def === undefined) return 0;
  if (!def.stackable) return qty;
  let left = qty;
  for (const stack of s.player.inventory) {
    if (stack.itemId === itemId && stack.rarity === rarity) left -= Math.max(0, def.maxStack - stack.qty);
  }
  return left <= 0 ? 0 : Math.ceil(left / def.maxStack);
}

/** True if the whole of `qty` × `itemId` fits in the pack. */
export function canCarry(s: GameState, content: ContentPack, itemId: string, qty: number, rarity: ItemInstance['rarity']): boolean {
  const need = slotsNeeded(s, content, itemId, qty, rarity);
  return need === 0 || slotsUsed(s, content) + need <= INVENTORY_SLOTS;
}

/** Items lying at the current location. */
const groundItems = (s: GameState): readonly ItemInstance[] => s.world.locationStates[s.world.currentLocationId]?.items ?? [];

/** NPCs standing at `locationId`: home NPCs not moved elsewhere, plus NPCs an override moved here. */
export function npcsAt(s: GameState, content: ContentPack, locationId: string): string[] {
  const overrides = s.world.npcOverrides;
  const home: string[] = (content.locations[locationId]?.npcs ?? []).filter((id) => overrides[id] === undefined);
  const moved = Object.keys(overrides).filter((id) => overrides[id]?.location === locationId);
  return [...home, ...moved.filter((id) => !home.includes(id))];
}

/** `wait` is allowed where the location says so (schema `waitable`, a rest spot, or the `waitable` tag). */
const isWaitable = (loc: Location): boolean => loc.waitable || loc.rest !== undefined || loc.tags.includes('waitable');

/** The rest spot here, if any is usable now (`rest.when`). */
function restSpot(s: GameState, content: ContentPack, profile: Pr): NonNullable<Location['rest']> | undefined {
  const rest = currentLocation(s, content)?.rest;
  if (rest === undefined || (rest.when !== undefined && !evaluate(rest.when, s, profile, content))) return undefined;
  return rest;
}

/** Units of the gathering node here still available today (0 when there is none). */
export function gatherLeft(s: GameState, content: ContentPack): number {
  const node = currentLocation(s, content)?.gather;
  if (node === undefined) return 0;
  const used = s.world.gather[s.world.currentLocationId];
  const taken = used !== undefined && used.day === dayOf(s.clock.ticks) ? used.taken : 0;
  return Math.max(0, node.perDay - taken);
}

/** The exit back to where the player came from, if it exists and is open (DESIGN §4.7 Retreat). */
function retreatExit(s: GameState, content: ContentPack, profile: Pr): Exit | undefined {
  const prev = s.world.previousLocationId;
  if (prev === null) return undefined;
  const found = findExit(s, content, profile, prev);
  return found?.state === 'open' ? found.exit : undefined;
}

// ---- events, items, arrival ------------------------------------------------------------------------------------------

/** Fires one location event: records it, emits `eventFired`, logs its text, applies its effects (source `event:<id>`). */
export function fireEvent(ctx: StepCtx, locationId: string, ev: LocationEvent): void {
  const ls = locationState(ctx, locationId);
  if (!ls.eventsFired.includes(ev.id)) ls.eventsFired.push(ev.id);
  ctx.emit({ t: 'eventFired', locationId, eventId: ev.id, text: ev.text });
  ctx.log(ev.text, 'event');
  applyAll(ev.effects, ctx, { source: `event:${ev.id}` });
}

/**
 * Fires the location's events with this `trigger` whose `when` holds (a `once` event at most once per loop). Stops when
 * an effect moved the player or changed the mode (a teleport or a fight ends this location's turn).
 */
export function fireEvents(ctx: StepCtx, locationId: string, trigger: LocationEvent['trigger']): void {
  const loc = ctx.content.locations[locationId];
  if (loc === undefined) return;
  const mode = ctx.s.mode;
  for (const ev of loc.events) {
    if (ev.trigger !== trigger) continue;
    if (ev.once && locationState(ctx, locationId).eventsFired.includes(ev.id)) continue;
    if (ev.when !== undefined && !evaluate(ev.when, ctx.s, ctx.profile, ctx.content)) continue;
    fireEvent(ctx, locationId, ev);
    if (ctx.s.world.currentLocationId !== locationId || ctx.s.mode !== mode) return;
  }
}

/** Instantiates content items into `ls.items`: one instance per count for gear, one stack for stackables. */
function placeItems(ctx: StepCtx, ls: LocationState, specs: Location['items']): void {
  for (const spec of specs) {
    if (spec.when !== undefined && !evaluate(spec.when, ctx.s, ctx.profile, ctx.content)) continue;
    const def = ctx.content.items[spec.itemId];
    if (def === undefined) throw new Error(`explore: unknown item '${spec.itemId}'`);
    const rarity = spec.rarity ?? defaultRarity(def);
    const make = (qty: number): ItemInstance => ({ uid: ctx.uid('i'), itemId: spec.itemId, qty, rarity, affixes: [...def.fixedAffixes] });
    if (def.stackable) ls.items.push(make(spec.count));
    else for (let i = 0; i < spec.count; i++) ls.items.push(make(1));
  }
}

/** First entry this loop: the location's visible content items appear on the ground (hidden ones wait for examine). */
function spawnItems(ctx: StepCtx, loc: Location): void {
  const ls = locationState(ctx, loc.id);
  if (ls.itemsSpawned) return;
  ls.itemsSpawned = true;
  placeItems(ctx, ls, loc.items.filter((spec) => !spec.hidden));
}

/** PLAN §5.3: `once: false` items respawn when the player rests at their location (if none is lying there). */
function respawnItems(ctx: StepCtx, loc: Location): void {
  const ls = locationState(ctx, loc.id);
  if (!ls.itemsSpawned) return;
  placeItems(ctx, ls, loc.items.filter((spec) => !spec.once && !spec.hidden && !ls.items.some((i) => i.itemId === spec.itemId)));
}

/** How the player arrived; arrival hooks decide what applies (no encounter roll on `retreat` / `notYet`, DESIGN §4.7). */
export type ArrivalVia = 'move' | 'retreat' | 'notYet' | 'faceIt' | 'teleport' | 'start';
export interface Arrival {
  locationId: string;
  via: ArrivalVia;
  firstVisit: boolean;
}
/** Runs when the player is standing at a location after its events (and after *Face it* at the Loop 1 Apex). */
export type ArrivalHook = (ctx: StepCtx, arrival: Arrival) => void;

/**
 * Arrival hooks in run order; later units append theirs (one line each): U23 the encounter check (fixed, return 20 %,
 * anomaly; nothing on `retreat`/`notYet`), U30 the Horde spread and infected-entry damage. A hook that changes the mode
 * or moves the player ends the chain.
 */
export const ARRIVAL_HOOKS: readonly ArrivalHook[] = [
  encounterArrivalHook, // U23: spawned / fixed / wandering encounters (reducers/combat.ts)
];

/** `locationEntered` events whose arrival pipeline already ran (move/retreat run it inline; strays go to arrivalHook). */
const handledArrivals = new WeakSet<GameEvent>();

/** Autosave checkpoint, except at the Loop 1 Apex and while a Horde is active (D-067.1, PLAN §4.12). */
export function autosave(ctx: StepCtx, reason: AutosaveReason): void {
  const { s } = ctx;
  if (s.world.hordeActive || (s.meta.loop === 1 && s.world.currentLocationId === APEX_LOCATION_ID)) return;
  ctx.emit({ t: 'autosaveCheckpoint', reason });
}

function runArrival(ctx: StepCtx, arrival: Arrival): void {
  const { s, content } = ctx;
  const loc = content.locations[arrival.locationId];
  if (loc === undefined) throw new Error(`explore: unknown location '${arrival.locationId}'`);
  const stillHere = () => s.world.currentLocationId === loc.id && s.mode === 'explore';
  if (arrival.via !== 'faceIt') {
    spawnItems(ctx, loc);
    fireEvents(ctx, loc.id, 'enter');
    if (!stillHere()) return;
    if (apexPromptDue(s)) {
      openApexPrompt(ctx);
      return;
    }
  }
  for (const hook of ARRIVAL_HOOKS) {
    hook(ctx, arrival);
    if (!stillHere()) return;
  }
  autosave(ctx, 'locationEntered');
}

/** Puts the player at `to` (the `teleport` effect's state change) and runs the arrival pipeline. */
function arrive(ctx: StepCtx, to: string, via: ArrivalVia): void {
  const from = ctx.events.length;
  apply({ teleport: to as `loc_${string}` }, ctx);
  const entered = ctx.events.slice(from).find((e) => e.t === 'locationEntered');
  if (entered !== undefined) handledArrivals.add(entered);
  runArrival(ctx, { locationId: to, via, firstVisit: entered?.t === 'locationEntered' && entered.firstVisit });
}

/**
 * The loop's first arrival, at the start location (`newRun` only places the player there): marks it visited, emits
 * `locationEntered`, and runs the arrival pipeline (Day-1 items such as the Loop 1 Amulet, `enter` events, hooks).
 * For the reducers that start a loop (`newGame` U30, `newLoop` U31).
 */
export function enterStartLocation(ctx: StepCtx): void {
  const { s, content } = ctx;
  const id = s.world.currentLocationId;
  const loc = content.locations[id];
  if (loc === undefined) throw new Error(`explore: unknown start location '${id}'`);
  const ls = locationState(ctx, id);
  const firstVisit = !ls.visited;
  ls.visited = true;
  ls.visitCount += 1;
  if (!s.world.discovered.includes(id)) s.world.discovered.push(id);
  const entered: GameEvent = { t: 'locationEntered', locationId: id, firstVisit, regionId: loc.regionId };
  handledArrivals.add(entered);
  ctx.emit(entered);
  runArrival(ctx, { locationId: id, via: 'start', firstVisit });
}

/**
 * Post-step hook: runs the arrival pipeline for a content `teleport` (effects.ts) that moved the player this step —
 * the last such arrival only, and only if the player is still standing there in explore mode.
 */
export const arrivalHook: PostStepHook = (ctx) => {
  for (let i = 0; i < ctx.events.length; i++) {
    const e = ctx.events[i] as GameEvent;
    if (e.t !== 'locationEntered' || handledArrivals.has(e)) continue;
    handledArrivals.add(e);
    const later = ctx.events.slice(i + 1).some((x) => x.t === 'locationEntered');
    if (later || ctx.s.world.currentLocationId !== e.locationId || ctx.s.mode !== 'explore') continue;
    runArrival(ctx, { locationId: e.locationId, via: 'teleport', firstVisit: e.firstVisit });
  }
};

// ---- travel ----------------------------------------------------------------------------------------------------------

/** DESIGN §3.2 travel regen: per watch travelled, +5 % max HP and +10 % max MP (config.travelRegen). */
function travelRegen(ctx: StepCtx, watches: number): void {
  if (watches <= 0) return;
  const { player } = ctx.s;
  const { hpPct, mpPct } = ctx.content.config.travelRegen;
  const hpBefore = player.hp;
  player.hp = Math.min(player.hpMax, player.hp + round(player.hpMax * hpPct) * watches);
  player.mp = Math.min(player.mpMax, player.mp + round(player.mpMax * mpPct) * watches);
  if (player.hp > hpBefore) ctx.emit({ t: 'healed', targetUid: 'player', amount: player.hp - hpBefore, source: 'travel' });
}

/** Leave events → the edge's watches (0 while the clock is frozen) → regen → arrival. */
function travel(ctx: StepCtx, exit: Exit, via: 'move' | 'retreat'): void {
  const { s } = ctx;
  const from = s.world.currentLocationId;
  fireEvents(ctx, from, 'leave');
  if (s.world.currentLocationId !== from || s.mode !== 'explore') return;
  const watches = s.clock.frozen ? 0 : exit.travelWatches;
  advanceTime(ctx, watches);
  travelRegen(ctx, watches);
  s.counters.travels += 1;
  arrive(ctx, exit.to, via);
}

// ---- Loop 1 Apex prompt (D-067.1) ------------------------------------------------------------------------------------

/** Loop 1, the Tyrant still waiting and no Horde: arriving at the Apex asks *Face it / Not yet* before anything starts. */
export function apexPromptDue(s: GameState): boolean {
  return s.meta.loop === 1 && s.world.currentLocationId === APEX_LOCATION_ID && s.world.tyrant === 'waiting' && !s.world.hordeActive;
}

export function isApexPromptOpen(s: GameState): boolean {
  return s.mode === 'dialogue' && s.dialogue?.sceneId === APEX_PROMPT_SCENE;
}

function openApexPrompt(ctx: StepCtx): void {
  ctx.s.dialogue = {
    sceneId: APEX_PROMPT_SCENE,
    nodeId: APEX_PROMPT_NODE,
    npcId: null,
    visitedNodes: [APEX_PROMPT_NODE],
    choicesTaken: [],
    returnMode: 'explore',
  };
  enterMode(ctx, 'dialogue');
  ctx.emit({ t: 'dialogueStarted', sceneId: APEX_PROMPT_SCENE, npcId: null });
  ctx.emit({ t: 'dialogueNode', nodeId: APEX_PROMPT_NODE, speaker: 'narrator', text: APEX_PROMPT_TEXT });
}

/** The prompt's choices: *Face it* always, *Not yet* when there is a node to go back to. */
export function apexPromptChoices(s: GameState): string[] {
  if (!isApexPromptOpen(s)) return [];
  return s.world.previousLocationId === null ? [APEX_FACE_IT] : [APEX_FACE_IT, APEX_NOT_YET];
}

/**
 * `choose` while the prompt is open. *Face it*: back to explore at the Apex and the arrival hooks run (U23 starts the
 * Contained Tyrant). *Not yet*: back to the previous node at no watch cost, with nothing started (WORLD §3.5).
 */
function chooseApexPrompt(ctx: StepCtx, choiceId: string): void {
  if (!apexPromptChoices(ctx.s).includes(choiceId)) ctx.reject(`'${choiceId}' is not a choice here`);
  const s = ctx.s;
  s.dialogue = null;
  ctx.emit({ t: 'dialogueEnded', sceneId: APEX_PROMPT_SCENE });
  enterMode(ctx, 'explore');
  if (choiceId === APEX_FACE_IT) {
    runArrival(ctx, { locationId: APEX_LOCATION_ID, via: 'faceIt', firstVisit: false });
    return;
  }
  arrive(ctx, s.world.previousLocationId as string, 'notYet');
}

/**
 * `choose` (dialogue mode). U20 owns only the engine-built Apex prompt; every other scene is U33's dialogue reducer,
 * which replaces this handler and keeps the Apex branch.
 */
export function chooseHandler(ctx: StepCtx, a: ActionOf<'choose'>): void {
  if (!isApexPromptOpen(ctx.s)) ctx.reject("'choose' is not implemented yet (U33)");
  chooseApexPrompt(ctx, a.choiceId);
}

export const chooseEnumerator: Enumerator<'choose'> = (s) => apexPromptChoices(s).map((choiceId) => ({ type: 'choose', choiceId }));

// ---- reducers --------------------------------------------------------------------------------------------------------

function requireHere(ctx: StepCtx): Location {
  const loc = currentLocation(ctx.s, ctx.content);
  return loc ?? ctx.reject(`unknown location '${ctx.s.world.currentLocationId}'`);
}

/** `move`: along an open exit of the current location (DESIGN §2.1; exit conditions via `evaluate`, roads via `gate`). */
export function moveHandler(ctx: StepCtx, a: ActionOf<'move'>): void {
  requireHere(ctx);
  const found = findExit(ctx.s, ctx.content, ctx.profile, a.to);
  if (found === undefined) ctx.reject(`there is no way to ${nameOf(ctx.content, a.to)} from here`);
  if (found.state === 'locked') ctx.reject(lockedReason(ctx.s, ctx.content, ctx.profile, ctx.s.world.currentLocationId, found.exit));
  travel(ctx, found.exit, 'move');
}

/** `retreat`: back along the arrival edge, at the edge's cost, with no encounter roll on arrival (DESIGN §4.7). */
export function retreatHandler(ctx: StepCtx): void {
  requireHere(ctx);
  const exit = retreatExit(ctx.s, ctx.content, ctx.profile);
  if (exit === undefined) ctx.reject('there is no way back the way you came');
  travel(ctx, exit, 'retreat');
}

/** Moves a ground instance into the inventory, filling stacks of the same item and rarity first. */
function pickUp(ctx: StepCtx, item: ItemInstance): void {
  const def = ctx.content.items[item.itemId];
  const inventory = ctx.s.player.inventory;
  if (def === undefined || !def.stackable) {
    inventory.push(item);
    return;
  }
  let left = item.qty;
  for (const stack of inventory) {
    if (left === 0) break;
    if (stack.itemId !== item.itemId || stack.rarity !== item.rarity || stack.qty >= def.maxStack) continue;
    const add = Math.min(left, def.maxStack - stack.qty);
    stack.qty += add;
    left -= add;
  }
  let first = true;
  while (left > 0) {
    const qty = Math.min(left, def.maxStack);
    inventory.push(first ? { ...item, qty } : { ...item, uid: ctx.uid('i'), qty, affixes: [...item.affixes] });
    first = false;
    left -= qty;
  }
}

function takeFromGround(ctx: StepCtx, index: number): void {
  const ls = locationState(ctx, ctx.s.world.currentLocationId);
  const [item] = ls.items.splice(index, 1) as [ItemInstance];
  ctx.emit({ t: 'itemTaken', item: clone(item) });
  pickUp(ctx, item);
}

const fits = (s: GameState, content: ContentPack, item: ItemInstance): boolean => canCarry(s, content, item.itemId, item.qty, item.rarity);

/** `take`: one item lying here, if it fits (DESIGN §7.8: a full pack blocks pickup). */
export function takeHandler(ctx: StepCtx, a: ActionOf<'take'>): void {
  const index = groundItems(ctx.s).findIndex((i) => i.uid === a.uid);
  if (index < 0) ctx.reject('that is not here');
  const item = groundItems(ctx.s)[index] as ItemInstance;
  if (!fits(ctx.s, ctx.content, item)) ctx.reject(`your pack is full (${INVENTORY_SLOTS} slots)`);
  takeFromGround(ctx, index);
}

/** `takeAll`: every item here that fits, in ground order; legal while at least one fits. */
export function takeAllHandler(ctx: StepCtx): void {
  if (!groundItems(ctx.s).some((i) => fits(ctx.s, ctx.content, i))) ctx.reject('there is nothing here you can carry');
  let skipped = 0;
  for (let i = 0; i < groundItems(ctx.s).length; ) {
    if (fits(ctx.s, ctx.content, groundItems(ctx.s)[i] as ItemInstance)) takeFromGround(ctx, i);
    else {
      skipped += 1;
      i += 1;
    }
  }
  if (skipped > 0) ctx.log(`Your pack is full; ${skipped} item${skipped === 1 ? '' : 's'} left on the ground.`, 'system');
}

/** `gather`: one unit from the node here, up to `perDay` a day (DESIGN §8.2; the day resets at dawn). No time cost. */
export function gatherHandler(ctx: StepCtx): void {
  const loc = requireHere(ctx);
  const node = loc.gather;
  if (node === undefined) ctx.reject('there is nothing to gather here');
  if (gatherLeft(ctx.s, ctx.content) === 0) ctx.reject('you have gathered all there is here today');
  const rarity = defaultRarity(ctx.content.items[node.itemId]);
  if (!canCarry(ctx.s, ctx.content, node.itemId, 1, rarity)) ctx.reject(`your pack is full (${INVENTORY_SLOTS} slots)`);
  const today = dayOf(ctx.s.clock.ticks);
  const used = ctx.s.world.gather[loc.id];
  ctx.s.world.gather[loc.id] = { day: today, taken: (used?.day === today ? used.taken : 0) + 1 };
  const [stack] = addItem(ctx, node.itemId, 1) as [ItemInstance];
  ctx.emit({ t: 'itemGiven', item: { ...stack, qty: 1, affixes: [...stack.affixes] }, source: `gather:${loc.id}` });
  ctx.log(`You gather ${ctx.content.items[node.itemId]?.name ?? node.itemId}.`, 'narration');
}

/** `wait`: one watch in place where the location allows it; nothing to wait for while the clock is frozen. */
export function waitHandler(ctx: StepCtx): void {
  const loc = requireHere(ctx);
  if (!isWaitable(loc)) ctx.reject('this is no place to wait');
  if (ctx.s.clock.frozen) ctx.reject('time does not pass here');
  advanceTime(ctx, 1);
  ctx.log(`You wait. It is ${WATCH_NAMES[watchOf(ctx.s.clock.ticks)]}.`, 'narration');
}

/** Removes the out-of-combat DoTs (any rest clears them, DESIGN §4.5). */
function clearDots(ctx: StepCtx): void {
  const player = ctx.s.player;
  const cleared = player.statuses.filter((st) => OUT_OF_COMBAT_STATUSES.includes(st.statusId));
  if (cleared.length === 0) return;
  player.statuses = player.statuses.filter((st) => !OUT_OF_COMBAT_STATUSES.includes(st.statusId));
  for (const st of cleared) ctx.emit({ t: 'statusExpired', targetUid: 'player', statusId: st.statusId });
}

/**
 * `rest` at a rest spot (DESIGN §2.1, §9.5, §10.1). Short: 1 watch, +30 % HP/MP. Full: to the next dawn (a whole day at
 * dawn), heal by the spot's `healPct` (full by default), pay its `cost` (inn 10 g) and, at an inn, `status_rested`.
 * Both clear the out-of-combat DoTs, recover companions, respawn `once: false` items here and fire `rest` events.
 * While the clock is frozen (Silverwood Before) no time passes; the Before-day advance at the Garret is U32's.
 */
export function restHandler(ctx: StepCtx, a: ActionOf<'rest'>): void {
  const loc = requireHere(ctx);
  const spot = restSpot(ctx.s, ctx.content, ctx.profile);
  if (spot === undefined) ctx.reject(loc.rest === undefined ? 'there is nowhere to rest here' : 'you cannot rest here now');
  const s = ctx.s;
  const full = a.kind === 'full';
  if (full && spot.cost > 0) {
    if (s.player.gold < spot.cost) ctx.reject(`a bed here costs ${spot.cost} gold`);
    s.player.gold -= spot.cost;
    s.counters.goldSpent += spot.cost;
    ctx.emit({ t: 'goldChanged', delta: -spot.cost, total: s.player.gold });
  }
  clearDots(ctx);
  advanceTime(ctx, s.clock.frozen ? 0 : full ? 4 - watchOf(s.clock.ticks) : 1);
  // TODO(U23): wild-camp ambush (`spot.ambushChance`) starts a fight here.
  const player = s.player;
  const pct = full ? spot.healPct : ctx.content.config.restShortPct;
  const hpBefore = player.hp;
  const mpBefore = player.mp;
  player.hp = Math.min(player.hpMax, player.hp + round(player.hpMax * pct));
  player.mp = Math.min(player.mpMax, player.mp + round(player.mpMax * pct));
  for (const c of Object.values(s.companions.recruited)) {
    if (c.dead) continue;
    c.ko = false;
    c.hp = Math.min(c.hpMax, Math.max(1, c.hp + round(c.hpMax * pct)));
  }
  if (full && spot.kind === 'inn' && ctx.content.statuses[RESTED_STATUS] !== undefined) {
    const rested: StatusInstance = { statusId: RESTED_STATUS, stacks: 1, duration: 1, sourceUid: null, appliedOnOwnTurn: false };
    player.statuses = [...player.statuses.filter((st) => st.statusId !== RESTED_STATUS), rested];
    ctx.emit({ t: 'statusApplied', targetUid: 'player', statusId: RESTED_STATUS, stacks: 1, duration: 1 });
  }
  respawnItems(ctx, loc);
  s.counters.rests += 1;
  ctx.emit({ t: 'rested', locationId: loc.id, hpRestored: player.hp - hpBefore, mpRestored: player.mp - mpBefore });
  if (spot.text !== undefined) ctx.log(spot.text, 'narration');
  fireEvents(ctx, loc.id, 'rest');
  if (s.mode === 'explore' && s.world.currentLocationId === loc.id) autosave(ctx, 'rest');
}

/** The item with `uid` on the ground here, in the pack or equipped. */
function findItem(s: GameState, uid: string): ItemInstance | undefined {
  return (
    groundItems(s).find((i) => i.uid === uid) ??
    s.player.inventory.find((i) => i.uid === uid) ??
    Object.values(s.player.equipment).find((i): i is ItemInstance => i?.uid === uid)
  );
}

function describeLocation(s: GameState, content: ContentPack, profile: Pr, loc: Location): string {
  return loc.descriptionVariants.find((v) => evaluate(v.when, s, profile, content))?.text ?? loc.description;
}

/**
 * `examine` (enumerated only on request, PLAN §4.7): narration about the location, an exit, an item or an NPC; no time
 * passes. Examining the location also reveals its hidden items (once per loop).
 */
export function examineHandler(ctx: StepCtx, a: ActionOf<'examine'>): void {
  const loc = requireHere(ctx);
  const { s, content, profile } = ctx;
  const t = a.target;
  if (!examinable(s, content, profile, t)) ctx.reject('there is nothing like that to examine here');
  if (t.kind === 'location') {
    ctx.log(describeLocation(s, content, profile, loc), 'narration');
    const ls = locationState(ctx, loc.id);
    if (ls.flags.hiddenRevealed !== true) {
      ls.flags.hiddenRevealed = true;
      const before = ls.items.length;
      placeItems(ctx, ls, loc.items.filter((spec) => spec.hidden));
      if (ls.items.length > before) ctx.log('Looking closer, you find something.', 'event');
    }
  } else if (t.kind === 'exit') {
    const found = findExit(s, content, profile, t.to) as { exit: Exit; state: 'open' | 'locked' };
    const watches = found.exit.travelWatches;
    const label = found.exit.label ?? nameOf(content, t.to);
    ctx.log(
      found.state === 'locked'
        ? lockedReason(s, content, profile, loc.id, found.exit)
        : `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${watches} watch${watches === 1 ? '' : 'es'} to ${nameOf(content, t.to)}.`,
      'narration',
    );
  } else if (t.kind === 'item') {
    const item = findItem(s, t.uid) as ItemInstance;
    const def = content.items[item.itemId];
    ctx.log(`${def?.name ?? item.itemId}: ${def?.description ?? ''}`.trim(), 'narration');
  } else {
    const npc = content.npcs[t.id];
    ctx.log(`${npc?.name ?? t.id}: ${npc?.description ?? ''}`.trim(), 'narration');
  }
}

function examinable(s: GameState, content: ContentPack, profile: Pr, t: ExamineTarget): boolean {
  switch (t.kind) {
    case 'location':
      return true;
    case 'exit':
      return findExit(s, content, profile, t.to) !== undefined;
    case 'item':
      return findItem(s, t.uid) !== undefined;
    case 'npc':
      return npcsAt(s, content, s.world.currentLocationId).includes(t.id);
  }
}

// ---- enumerators (legalActions, PLAN §4.7) ---------------------------------------------------------------------------

export const moveEnumerator: Enumerator<'move'> = (s, content, profile) => {
  if (currentLocation(s, content) === undefined) return [];
  const seen = new Set<string>();
  const out: ActionOf<'move'>[] = [];
  for (const { exit, state } of visibleExits(s, content, profile)) {
    if (state !== 'open' || seen.has(exit.to)) continue;
    seen.add(exit.to);
    out.push({ type: 'move', to: exit.to });
  }
  return out;
};

export const retreatEnumerator: Enumerator<'retreat'> = (s, content, profile) =>
  currentLocation(s, content) !== undefined && retreatExit(s, content, profile) !== undefined ? [{ type: 'retreat' }] : [];

export const takeEnumerator: Enumerator<'take'> = (s, content) =>
  groundItems(s)
    .filter((i) => fits(s, content, i))
    .map((i) => ({ type: 'take', uid: i.uid }));

export const takeAllEnumerator: Enumerator<'takeAll'> = (s, content) =>
  groundItems(s).some((i) => fits(s, content, i)) ? [{ type: 'takeAll' }] : [];

export const gatherEnumerator: Enumerator<'gather'> = (s, content) => {
  const node = currentLocation(s, content)?.gather;
  if (node === undefined || gatherLeft(s, content) === 0) return [];
  return canCarry(s, content, node.itemId, 1, defaultRarity(content.items[node.itemId])) ? [{ type: 'gather' }] : [];
};

export const waitEnumerator: Enumerator<'wait'> = (s, content) => {
  const loc = currentLocation(s, content);
  return loc !== undefined && isWaitable(loc) && !s.clock.frozen ? [{ type: 'wait' }] : [];
};

export const restEnumerator: Enumerator<'rest'> = (s, content, profile) => {
  const spot = restSpot(s, content, profile);
  if (spot === undefined) return [];
  const out: ActionOf<'rest'>[] = [{ type: 'rest', kind: 'short' }];
  if (s.player.gold >= spot.cost) out.push({ type: 'rest', kind: 'full' });
  return out;
};

export const examineEnumerator: Enumerator<'examine'> = (s, content, profile) => {
  if (currentLocation(s, content) === undefined) return [];
  const out: ActionOf<'examine'>[] = [{ type: 'examine', target: { kind: 'location' } }];
  for (const to of new Set(visibleExits(s, content, profile).map((v) => v.exit.to))) out.push({ type: 'examine', target: { kind: 'exit', to } });
  const items = [...groundItems(s), ...s.player.inventory, ...Object.values(s.player.equipment).filter((i): i is ItemInstance => i !== null)];
  for (const item of items) out.push({ type: 'examine', target: { kind: 'item', uid: item.uid } });
  for (const id of npcsAt(s, content, s.world.currentLocationId)) out.push({ type: 'examine', target: { kind: 'npc', id } });
  return out;
};
