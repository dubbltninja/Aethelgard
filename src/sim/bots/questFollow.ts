// U81b1 (D-145, brief item 6): following quests the way a player reads the journal. U80's bots reached a quest's hint and
// then did nothing a walk does not do: a hidden item named by an objective (the Echo Crystal in its alcove) needs the place
// searched (`examine` the location), an item the objective asks for may be on the merchant's shelf (Brak's sack of Steppe
// salt), and a stage with no objective ("Return to Ilyra and choose", "Report to Brak") points at no place at all, so the
// quest sat there until the loop ended. Coverage (quests 38/49) and every clock row (#10, #11, #15) measured that, not the
// game. These rows use only the engine's own quest machinery (`questJournal`, the stage's objectives and its giver):
//   questTargets  the journal's open hint places, then — for an active quest whose stage names no open hint — the places
//                 where its giver stands now (`npcPlacement`, else the authored placement): the turn-in conversation.
//   questErrand   here, at a hint of an objective that names an item the player lacks: buy it if the merchant here sells it;
//                 else search the place once per quest state (`examine` the location reveals hidden items; the bot must list
//                 examines, `Bot.examines`). Picking up is the head's `takeAll`.
import { BEFORE_REGION_ID, BEFORE_WATCH_COUNTER, WATCH_NAMES, evaluate, npcPlacement, questJournal, watchNow, type Action, type ContentPack, type GameState, type Profile } from '@engine/index';
import type { Condition } from '@schema/condition';
import { allOf, nearestWhere, questSignature, restAvailable, stepAlong, type PathOptions } from './shared';
import type { BotMemory } from './types';

/** Item ids a condition asks the player to hold (`item` atoms, through all/any; never under a `not`). */
export function wantedItems(c: Condition, into: Set<string> = new Set()): Set<string> {
  const [key, value] = Object.entries(c)[0] as [string, unknown];
  if (key === 'item') {
    const v = value as { id?: string } | string;
    const id = typeof v === 'string' ? v : v.id;
    if (id !== undefined) into.add(id);
  } else if (key === 'all' || key === 'any') for (const child of value as Condition[]) wantedItems(child, into);
  return into;
}

/** Companion ids a condition asks to be at the player's side (`companion` atoms in the default `active` state, through all/any). */
export function wantedCompanions(c: Condition, into: Set<string> = new Set()): Set<string> {
  const [key, value] = Object.entries(c)[0] as [string, unknown];
  if (key === 'companion') {
    const v = value as { id: string; state?: string };
    if ((v.state ?? 'active') === 'active') into.add(v.id);
  } else if (key === 'all' || key === 'any') for (const child of value as Condition[]) wantedCompanions(child, into);
  return into;
}

/** The places an NPC stands now (an override or a schedule, else the locations that list it). */
export function npcWhere(s: GameState, content: ContentPack, profile: Profile, npcId: string): string[] {
  const placed = npcPlacement(s, content, profile, npcId);
  if (placed !== null) return [...placed];
  return Object.values(content.locations).flatMap((l) => (l !== undefined && (l.npcs ?? []).some((id) => id === npcId) ? [l.id] : []));
}

export interface QuestTarget {
  locationId: string;
  questId: string;
}

/** The journal's open hint places (journal order), then the givers of active quests whose stage names no open hint. */
export function questTargets(s: GameState, content: ContentPack, profile: Profile): QuestTarget[] {
  const out: QuestTarget[] = [];
  const add = (locationId: string, questId: string): void => {
    if (content.locations[locationId] !== undefined && !out.some((x) => x.locationId === locationId)) out.push({ locationId, questId });
  };
  const idle: string[] = [];
  for (const entry of questJournal(s, content)) {
    if (entry.status !== 'active') continue;
    const open = entry.objectives.filter((o) => !o.done && o.hintLocationId !== undefined);
    for (const o of open) add(o.hintLocationId as string, entry.questId);
    if (open.length === 0) idle.push(entry.questId);
  }
  for (const questId of idle) {
    const giver = content.quests[questId]?.giverNpcId;
    if (giver !== undefined) for (const at of npcWhere(s, content, profile, giver)) add(at, questId);
  }
  return out;
}

/** The open objectives of the active quests, with their stage's condition. */
function openObjectives(s: GameState, content: ContentPack): { questId: string; when: Condition; hint?: string }[] {
  const out: { questId: string; when: Condition; hint?: string }[] = [];
  for (const [questId, qs] of Object.entries(s.quests)) {
    if (qs === undefined || qs.status !== 'active') continue;
    const stage = content.quests[questId]?.stages.find((x) => x.id === qs.stage);
    for (const o of stage?.objectives ?? []) {
      if (qs.objectivesDone.includes(o.id)) continue;
      out.push({ questId, when: o.when, ...(o.hintLocationId !== undefined ? { hint: o.hintLocationId } : {}) });
    }
  }
  return out;
}

// ---- quests a scene starts and advances at once (U81b1, second pass) ---------------------------------------------------------
// Caelum's errand and the boy's quest begin in their offer scene with `questStart` and `questAdvance` in one choice (the first
// stage "passes through" the scene). The generic Accept (`acceptQuest`, any talk with the giver) starts them on that first
// stage, which has no objective and no scene that advances it, and the offer scene (`notStarted`) never plays again: the quest
// is stranded for the loop. A bot leaves those to their scene. (A game finding too: BALANCE.md "after U81b1".)

const CARRIED = new WeakMap<ContentPack, ReadonlySet<string>>();

/** Quests some dialogue effect list both starts and advances (their offer scene carries the first stage). */
export function sceneCarriedStarts(content: ContentPack): ReadonlySet<string> {
  const have = CARRIED.get(content);
  if (have !== undefined) return have;
  const out = new Set<string>();
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) {
      const starts = x.flatMap((e: unknown) => (e !== null && typeof e === 'object' && 'questStart' in e ? [(e as { questStart: string }).questStart] : []));
      const advanced = x.flatMap((e: unknown) => (e !== null && typeof e === 'object' && 'questAdvance' in e ? [(e as { questAdvance: { quest: string } }).questAdvance.quest] : []));
      for (const q of starts) if (advanced.includes(q)) out.add(q);
      for (const y of x) walk(y);
    } else if (x !== null && typeof x === 'object') for (const v of Object.values(x)) walk(v);
  };
  walk(content.dialogues);
  CARRIED.set(content, out);
  return out;
}

/** Is a generic Accept of this quest safe (no offer scene carries its first stage)? */
export const acceptable = (content: ContentPack, questId: string): boolean => !sceneCarriedStarts(content).has(questId);

// ---- the Before's hours (U81b1, second pass) --------------------------------------------------------------------------------
// Caelum's quests (`q_the_apprentices_errand`: the Plaza at noon on Last Bell; `q_a_boy_from_a_doomed_city`: the Silver Gate
// after dusk on Last Bell) ask for an hour of the Before, and its offer scene for one too (Caelum gives the errand at noon on
// Last Bell). Time passes there only by resting at the Garret (DESIGN §10.1: a full rest brings the next Bell, a short one the
// next hour). U80's and U81b1's first explorer walked to the hint at the wrong hour, marked it reached and left: Caelum was
// never recruited in 4,000 runs.

/** The Before's time atoms of a condition: the Bell (`beforeDay`) and the hours (`watch`, any of them), through all/any. */
export function beforeTime(c: Condition): { day?: number; watches?: string[] } {
  const [key, value] = Object.entries(c)[0] as [string, unknown];
  if (key === 'beforeDay' && typeof value === 'number') return { day: value };
  if (key === 'watch' && typeof value === 'string') return { watches: [value] };
  if (key === 'all') {
    const out: { day?: number; watches?: string[] } = {};
    for (const child of value as Condition[]) {
      const t = beforeTime(child);
      if (t.day !== undefined) out.day = t.day;
      if (t.watches !== undefined) out.watches = t.watches;
    }
    return out;
  }
  if (key === 'any') {
    const parts = (value as Condition[]).map(beforeTime);
    if (parts.length > 0 && parts.every((p) => p.watches !== undefined && p.day === undefined)) return { watches: parts.flatMap((p) => p.watches ?? []) };
  }
  return {};
}

/** Is the Before's hour right for this time need now (outside the Before: never, when it asks for one)? */
function timeRight(s: GameState, t: { day?: number; watches?: string[] }): boolean {
  if (t.day === undefined && t.watches === undefined) return true;
  if (s.before === null) return false;
  return (t.day === undefined || s.before.day === t.day) && (t.watches === undefined || t.watches.includes(WATCH_NAMES[watchNow(s)]));
}

/** May the bot walk to this hint now: no open objective there waits for another hour of the Before. */
export function hintTimely(s: GameState, content: ContentPack, locationId: string): boolean {
  return openObjectives(s, content).every((o) => o.hint !== locationId || timeRight(s, beforeTime(o.when)));
}

/** A `location` atom of a condition (through all), else undefined. */
function locationAtom(c: Condition): string | undefined {
  const [key, value] = Object.entries(c)[0] as [string, unknown];
  if (key === 'location' && typeof value === 'string') return value;
  if (key === 'all') {
    for (const child of value as Condition[]) {
      const at = locationAtom(child);
      if (at !== undefined) return at;
    }
  }
  return undefined;
}

/** Quest ids a dialogue scene's nodes start (any `questStart`). */
function sceneStarts(x: unknown, into: string[] = []): string[] {
  if (Array.isArray(x)) for (const y of x) sceneStarts(y, into);
  else if (x !== null && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      if (k === 'questStart' && typeof v === 'string') into.push(v);
      else if (k !== 'when') sceneStarts(v, into);
    }
  }
  return into;
}

export interface BeforeNeed {
  locationId: string;
  time: { day?: number; watches?: string[] };
}

/**
 * The Before's appointments: the hint of an open objective that asks for an hour, and the place and hour of an offer scene
 * (one that starts a quest not yet started) whose condition holds at that hour — read by evaluating it with the Bell, the
 * hour and the place it names put in place (Caelum's errand: the Garret at noon on Last Bell). Only places inside the Before.
 */
export function beforeNeeds(s: GameState, content: ContentPack, profile: Profile): BeforeNeed[] {
  const before = s.before;
  if (before === null) return [];
  const inBefore = (id: string): boolean => content.locations[id]?.regionId === BEFORE_REGION_ID;
  const out: BeforeNeed[] = [];
  /** Would `cond` hold standing at `at` at the hour `time` names (everything else as now)? */
  const holdsThen = (cond: Condition, at: string, time: BeforeNeed['time']): boolean => {
    const watch = time.watches?.[0];
    const hourIdx = watch === undefined ? watchNow(s) : WATCH_NAMES.indexOf(watch as (typeof WATCH_NAMES)[number]);
    const then: GameState = {
      ...s,
      before: { ...before, day: (time.day ?? before.day) as typeof before.day },
      counters: { ...s.counters, custom: { ...s.counters.custom, [BEFORE_WATCH_COUNTER]: hourIdx } },
      world: { ...s.world, currentLocationId: at },
    };
    return evaluate(cond, then, profile, content);
  };
  for (const o of openObjectives(s, content)) {
    const time = beforeTime(o.when);
    // an hour-bound objective that the hour alone would satisfy (not one that also waits for a companion who left)
    if (o.hint !== undefined && inBefore(o.hint) && (time.day !== undefined || time.watches !== undefined) && holdsThen(o.when, o.hint, time)) out.push({ locationId: o.hint, time });
  }
  for (const scene of Object.values(content.dialogues)) {
    if (scene?.npcId === undefined || scene.when === undefined) continue;
    const starts = sceneStarts(scene.nodes);
    if (starts.length === 0 || starts.every((q) => s.quests[q] !== undefined)) continue;
    const time = beforeTime(scene.when);
    // the place the scene names, else where its NPC stands (Caelum's "what you know": anywhere in the Before, at the Garret)
    const named = locationAtom(scene.when);
    const places = (named === undefined ? npcWhere(s, content, profile, scene.npcId) : [named]).filter(inBefore);
    for (const at of places) if (holdsThen(scene.when, at, time)) out.push({ locationId: at, time });
  }
  return out;
}

/** The Before's appointments whose hour is now (the places to walk to). */
export const beforeAppointmentsNow = (s: GameState, content: ContentPack, profile: Profile): string[] =>
  beforeNeeds(s, content, profile)
    .filter((n) => timeRight(s, n.time))
    .map((n) => n.locationId);

export const BEFORE_WAITS = 8;
const WAITED = 'questFollow:waited';

/**
 * Inside the Before: rest at the Garret until the hour an appointment (`beforeNeeds`) or a waiting giver here asks for — a
 * full rest for the Bell (Last Bell's own resets the echo: bounded), a short one for a later hour; at most `BEFORE_WAITS` per
 * quest state. Nothing while some appointment's hour is now (the caller walks there).
 */
export function beforeWait(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile, memory: BotMemory, opts: PathOptions): Action | undefined {
  const before = s.before;
  if (before === null) return undefined;
  const inBefore = (id: string): boolean => content.locations[id]?.regionId === BEFORE_REGION_ID;
  const hour = watchNow(s);
  const needs = beforeNeeds(s, content, profile);
  if (needs.some((n) => timeRight(s, n.time))) return undefined;
  let kind: 'full' | 'short' | undefined;
  const first = needs[0];
  if (first !== undefined) {
    const want = first.time.watches?.map((w) => WATCH_NAMES.indexOf(w as (typeof WATCH_NAMES)[number])).filter((i) => i >= 0) ?? [];
    const later = want.some((i) => i > hour);
    kind = first.time.day !== undefined && before.day !== first.time.day ? 'full' : later ? 'short' : 'full';
  }
  // a giver in the Before waiting with nothing to say: the hours pass
  if (kind === undefined) {
    const idle = questTargets(s, content, profile).some((t) => t.locationId === s.world.currentLocationId && inBefore(t.locationId) && !openObjectives(s, content).some((o) => o.questId === t.questId && o.hint !== undefined));
    if (idle) kind = before.day < 3 ? 'full' : hour < 3 ? 'short' : undefined;
  }
  if (kind === undefined) return undefined;
  const key = `${s.meta.runId}|${questSignature(s)}`;
  const waited = (memory[WAITED] as Record<string, number> | undefined) ?? {};
  if ((waited[key] ?? 0) >= BEFORE_WAITS) return undefined;
  const rest = legal.find((a) => a.type === 'rest' && a.kind === kind) ?? (kind === 'short' ? undefined : legal.find((a) => a.type === 'rest'));
  if (rest !== undefined) {
    memory[WAITED] = { ...waited, [key]: (waited[key] ?? 0) + 1 };
    return rest;
  }
  return stepAlong(legal, nearestWhere(s, content, profile, (id) => inBefore(id) && restAvailable(s, content, profile, id), { ...opts, enterBefore: true })?.path ?? null);
}

const carried = (s: GameState, itemId: string): boolean => s.player.inventory.some((i) => i.itemId === itemId) || Object.values(s.player.equipment).some((i) => i?.itemId === itemId);

const SEARCHED = 'questFollow:searched';

/** Buy an objective's item from the merchant here; else search a hint place for one (once per quest state). */
export function questErrand(s: GameState, legal: readonly Action[], content: ContentPack, memory: BotMemory): Action | undefined {
  const here = s.world.currentLocationId;
  // U81b1 (second pass): an objective that asks for a companion at your side ("Stand at the Silver Gate with Caelum") — swap
  // that companion in when it is recruited and the swap is listed
  for (const o of openObjectives(s, content)) {
    for (const id of wantedCompanions(o.when)) {
      if (s.companions.activeId === id) continue;
      const swap = legal.find((a) => a.type === 'swapCompanion' && a.companionId === id);
      if (swap !== undefined) return swap;
    }
  }
  const wanted = new Set<string>();
  let searchHere = false;
  for (const o of openObjectives(s, content)) {
    const items = [...wantedItems(o.when)].filter((id) => !carried(s, id));
    for (const id of items) wanted.add(id);
    if (items.length > 0 && o.hint === here) searchHere = true;
  }
  if (wanted.size === 0) return undefined;
  const buy = allOf(legal, 'buy').find((a) => wanted.has(s.merchants[a.merchantId]?.stock.find((i) => i.uid === a.uid)?.itemId ?? ''));
  if (buy !== undefined) return buy;
  if (!searchHere) return undefined;
  const key = `${s.meta.runId}|${here}|${questSignature(s)}`;
  const done = (memory[SEARCHED] as string[] | undefined) ?? [];
  if (done.includes(key)) return undefined;
  const search = legal.find((a) => a.type === 'examine' && a.target.kind === 'location');
  if (search === undefined) return undefined;
  memory[SEARCHED] = [...done, key];
  return search;
}
