// Silverwood Before (DESIGN §10.1 "Silverwood Before clock", §13.3; STORY §9; WORLD §3.11, §11.3, §12.1 `ws_before_*`,
// `ws_wanted`; PLAN §4.11, §8.1; D-016, D-066 #9, D-067.4/.5/.10). U32.
//
// Entering `region_silverwood_before` (any arrival from outside it — the Breach-door, the Tyrant's tear, a teleport)
// freezes the Breach Clock and starts the echo at First Bell: `before = { day: 1, resets }` (`resets`: this loop's
// Last Bell resets so far, kept for the whole loop because Caelum remembers them; `counters.custom.before_resets`),
// the day mirrored into `flag_before_day_1..3`, the door the Wayfinder came by (`flag_entered_before_via_apex` after
// the tear, `flag_entered_before_via_nexus` otherwise — WORLD §11.3: only that door leads back), `echo_before_route`
// (STORY §12 "Enter Silverwood Before"), `beforeDayAdvanced`, and a fresh echo (below). Inside, edges cost nothing
// (travel reads the frozen clock) and *wait* is refused (reducers/explore.ts).
//
// Days: a full rest in the Before (WORLD: the Apprentices' Garret is its only rest point) advances the Before day,
// First → Second → Last Bell (`beforeDayAdvanced`). A full rest on Last Bell brings its dusk — the ninth verse — and
// the echo resets to First Bell (`resets + 1`, `beforeReset`, a fresh echo), unless `q_stop_the_ritual` is resolved
// (completed or failed): then Last Bell holds.
// Hours (U34d, D-098 item 6: the Before's "noon" under the frozen clock): the echo keeps its own watch in
// `counters.custom.before_watch` (conditions.ts `watchNow`, which the `watch` atom reads inside the Before). Every Bell
// begins at dawn (entering, the next Bell, a reset); a short rest at the Garret passes one watch (dawn → noon → dusk →
// night); nothing else moves it.
//
// A fresh echo (every entry and every reset): the Before-local flags clear (`flag_before_*`, WORLD's
// `flag_wanted_in_silverwood`), what the Wayfinder left on the Before's ground (drops, overflow loot) is gone, and its
// enemies stand again (cleared, daily, scattered and fled-boss records and spawned groups). What persists: Echoes,
// inventory, quests (Caelum's memory, the ritual's attempts), the Conflux anchors (`flag_conflux_anchored`,
// `flag_cradle_pin_anchored`), the door flags, and the loop's once-only payouts — the Before's content items spawn once
// per loop (one taken never returns), its gathering nodes give their `perDay` once per loop (the frozen clock never
// starts a new day there, and an entry carries the count over), and a fight there pays XP, gold and loot once per loop
// per encounter (`claimBeforeSpoils`, combat/rewards.ts): "a place, not a farm" (STORY §9.1, D-067.5).
//
// Leaving (an arrival outside the region): `before = null`, the Before-local and door flags clear, the clock runs again
// and the door takes a dawn: 4 watches pass (D-067.5) through `advanceTime`, so their dawn hooks, warnings and expiry
// run in the clock hook (reducers/loop.ts).
//
// Anchors (D-016, D-067.4; STORY §9.3): an `anchorable` item set down (`drop`) in the Conflux Chamber goes on the
// cradle's rim — a bound or quest item too (reducers/inventory.ts `checkDrop`) — and is set down in every instant at
// once: it lies in the Heartstone Depths for the rest of this loop (an `anchor:` mark, not ground loot, so no dawn
// takes it; the loop's reset does). Any Anchor sets `flag_conflux_anchored`; Hallow's Cradle-Pin also
// `flag_cradle_pin_anchored`. Finding an Anchor in the Depths grants `echo_anchor_mechanic` (STORY §12).
import type { Item } from '@schema/item';
import { BEFORE_WATCH_COUNTER, dayOf, watchNow } from './conditions';
import type { ContentPack, StepCtx } from './ctx';
import { LEFT_ON_GROUND, advanceTime, apply, locationState } from './effects';
import { grantKnownEcho } from './horde';
import type { GameState, LocationState } from './types/state';

export const BEFORE_REGION_ID = 'region_silverwood_before';
/** WORLD §3.11: the Anchor slot is the cradle's rim in the Conflux Chamber. */
export const CONFLUX_LOCATION_ID = 'loc_conflux_chamber';
/** WORLD §3.5: where Anchors lie in the present. */
export const DEPTHS_LOCATION_ID = 'loc_heartstone_depths';
/** The two doors (WORLD §11.3 `gate_breach_door`, `gate_tyrant_tear`). */
export const BREACH_DOOR_FROM = 'loc_chronos_nexus';
export const TYRANT_TEAR_FROM = 'loc_temporal_breach_apex';
export const FLAG_ENTERED_VIA_NEXUS = 'flag_entered_before_via_nexus';
export const FLAG_ENTERED_VIA_APEX = 'flag_entered_before_via_apex';
/** Before-local flags: this prefix (the day mirror included) and WORLD's `ws_wanted` flag. */
export const BEFORE_FLAG_PREFIX = 'flag_before_';
export const FLAG_WANTED_IN_SILVERWOOD = 'flag_wanted_in_silverwood';
export const FLAG_CONFLUX_ANCHORED = 'flag_conflux_anchored';
export const FLAG_CRADLE_PIN_ANCHORED = 'flag_cradle_pin_anchored';
/** Hallow's Cradle-Pin (WORLD §7). */
export const CRADLE_PIN_ITEM_ID = 'item_caelums_anchor_token';
/** STORY §9.4: resolving it stops the Last Bell reset. */
export const RITUAL_QUEST_ID = 'q_stop_the_ritual';
/** D-067.5: each return to the present costs one Breach-Clock day. */
export const BEFORE_RETURN_WATCHES = 4;
/** `counters.custom` key: this loop's Last Bell resets. */
export const BEFORE_RESETS_COUNTER = 'before_resets';
export const ECHO_BEFORE_ROUTE = 'echo_before_route';
export const ECHO_ANCHOR_MECHANIC = 'echo_anchor_mechanic';
/** STORY §9.1 / WORLD §3.11 names of the three days. */
export const BELL_NAMES = { 1: 'First Bell', 2: 'Second Bell', 3: 'Last Bell' } as const;
export type BeforeDay = keyof typeof BELL_NAMES;

/** `LocationState.flags` markers (engine-only): a fight paid out this loop; an Anchor lying in the Depths. */
const PAID = 'before:paid:';
const ANCHOR = 'anchor:';
const ANCHORS_NOTICED = 'anchors:noticed';

/** Engine lines (STORY §9 gives the beats, not these words). */
export const BEFORE_TEXT = {
  enter: 'The air folds behind you. Silverwood stands whole, and the bells are ringing First Bell.',
  day: { 2: 'You wake to Second Bell. Single tolls, an overcast sky.', 3: 'You wake to Last Bell. No birds sing.' },
  reset: "Last Bell's dusk. The Nine begin, and at the first line of the ninth verse the world folds. You wake to First Bell.",
  holds: 'Last Bell holds. The ritual has been spoken; the echo has nothing left to repeat.',
  leave: 'The door takes a dawn. You step back into the present a day later.',
  /** U34d: the echo's hours (a short rest; words the engine's, as the lines above). */
  hour: {
    1: 'You doze under the eaves. The bells ring noon.',
    2: 'You doze under the eaves. When you wake the light is long and gold; it is dusk.',
    3: 'You doze under the eaves. Night has come down over the city.',
  },
  stillNight: 'You doze, and wake, and it is still night. Only a night in a cot brings the next Bell.',
  /** U34d: the Watch's arrest (WORLD §6.9's bestiary: "carried to a cell … Losing costs a day in the Garret, not a loop"). */
  arrest: 'The halberds close. They carry you to a cell, not a grave, and turn you out at the next bell. You wake in the Garret. A day is gone.',
  anchor: (name: string) => `You set the ${name} on the cradle's rim. It is set down in every instant at once.`,
  found: (name: string) => `On the ninth plinth lies the ${name} you left on the cradle's rim, five hundred years ago.`,
} as const;

// ---- reads ---------------------------------------------------------------------------------------------------------------

export const isBeforeLocation = (content: ContentPack, locationId: string): boolean => content.locations[locationId]?.regionId === BEFORE_REGION_ID;

export const beforeDayFlag = (day: BeforeDay): string => `${BEFORE_FLAG_PREFIX}day_${day}`;

/** Flags the echo resets (a fresh echo, leaving). */
export const isBeforeLocalFlag = (id: string): boolean => id.startsWith(BEFORE_FLAG_PREFIX) || id === FLAG_WANTED_IN_SILVERWOOD;

/** STORY §9.4: the ritual quest is resolved — completed or failed — so Last Bell no longer resets. */
export const ritualResolved = (s: GameState): boolean => s.quests[RITUAL_QUEST_ID]?.status === 'completed' || s.quests[RITUAL_QUEST_ID]?.status === 'failed';

/** An `anchorable` item set down here goes on the cradle's rim: in the Before, in the Conflux Chamber. */
export function onTheRim(s: GameState, def: Pick<Item, 'anchorable'> | undefined): boolean {
  return s.before !== null && s.world.currentLocationId === CONFLUX_LOCATION_ID && def?.anchorable === true;
}

/** Item uids lying in the Depths as Anchors this loop. */
export function anchorsInDepths(s: GameState): string[] {
  const ls = s.world.locationStates[DEPTHS_LOCATION_ID];
  if (ls === undefined) return [];
  return ls.items.filter((i) => ls.flags[`${ANCHOR}${i.uid}`] === true).map((i) => i.uid);
}

// ---- the echo ------------------------------------------------------------------------------------------------------------

/** A Bell begins: the day mirror, and the echo's hour back to dawn (U34d). */
function setDay(ctx: StepCtx, day: BeforeDay): void {
  const { s } = ctx;
  for (const d of [1, 2, 3] as const) delete s.flags[beforeDayFlag(d)];
  s.flags[beforeDayFlag(day)] = true;
  if (s.before !== null) s.before.day = day;
  s.counters.custom[BEFORE_WATCH_COUNTER] = 0;
}

function clearLocalFlags(s: GameState): void {
  for (const id of Object.keys(s.flags)) if (isBeforeLocalFlag(id)) delete s.flags[id];
}

/** What the Wayfinder left on this ground (marked by effects.ts `leaveOnGround`) is gone. */
function clearLeftItems(ls: LocationState): void {
  for (const key of Object.keys(ls.flags)) {
    if (!key.startsWith(LEFT_ON_GROUND)) continue;
    delete ls.flags[key];
    const uid = key.slice(LEFT_ON_GROUND.length);
    ls.items = ls.items.filter((i) => i.uid !== uid);
  }
}

/** A fresh echo at First Bell (see the file header): local flags, the Wayfinder's leavings, the enemies. */
function freshEcho(ctx: StepCtx): void {
  const { s, content } = ctx;
  clearLocalFlags(s);
  setDay(ctx, 1);
  for (const id of content.index.locationsByRegion[BEFORE_REGION_ID] ?? []) {
    delete s.world.pendingEncounters[id];
    const ls = s.world.locationStates[id];
    if (ls === undefined) continue;
    clearLeftItems(ls);
    ls.encountersCleared = [];
    ls.encounterClearedDay = {};
    ls.scattered = [];
    ls.encounterHp = {};
  }
}

/** The Before's gathering nodes keep this loop's count: their record moves to today (the frozen clock's day). */
function carryGathering(ctx: StepCtx, today: number): void {
  const { s, content } = ctx;
  const ids = content.index.locationsByRegion[BEFORE_REGION_ID] ?? [];
  for (const [key, used] of Object.entries(s.world.gather)) {
    // a node's key is its location id, or `<location>:<item>` for a location's second node on (explore.ts `gatherKey`)
    if (ids.includes(key) || ids.includes(key.split(':')[0] as string)) used.day = today;
  }
}

function enterBefore(ctx: StepCtx): void {
  const { s } = ctx;
  const resets = s.counters.custom[BEFORE_RESETS_COUNTER] ?? 0;
  s.clock.frozen = true;
  s.before = { day: 1, resets };
  delete s.flags[FLAG_ENTERED_VIA_NEXUS];
  delete s.flags[FLAG_ENTERED_VIA_APEX];
  s.flags[s.world.previousLocationId === TYRANT_TEAR_FROM ? FLAG_ENTERED_VIA_APEX : FLAG_ENTERED_VIA_NEXUS] = true;
  freshEcho(ctx);
  carryGathering(ctx, dayOf(s.clock.ticks));
  ctx.log(BEFORE_TEXT.enter, 'narration');
  ctx.emit({ t: 'beforeDayAdvanced', day: 1, resets });
  grantKnownEcho(ctx, ECHO_BEFORE_ROUTE, 'before');
}

function leaveBefore(ctx: StepCtx): void {
  const { s } = ctx;
  s.before = null;
  delete s.counters.custom[BEFORE_WATCH_COUNTER];
  clearLocalFlags(s);
  delete s.flags[FLAG_ENTERED_VIA_NEXUS];
  delete s.flags[FLAG_ENTERED_VIA_APEX];
  s.clock.frozen = false;
  ctx.log(BEFORE_TEXT.leave, 'narration');
  advanceTime(ctx, BEFORE_RETURN_WATCHES);
}

/** Lists the Anchors lying in the Depths the first time the Wayfinder arrives there to find them. */
function noticeAnchors(ctx: StepCtx): void {
  const anchors = anchorsInDepths(ctx.s);
  const ls = ctx.s.world.locationStates[DEPTHS_LOCATION_ID];
  if (ls === undefined || anchors.length === 0 || ls.flags[ANCHORS_NOTICED] === true) return;
  ls.flags[ANCHORS_NOTICED] = true;
  for (const uid of anchors) {
    const item = ls.items.find((i) => i.uid === uid);
    if (item !== undefined) ctx.log(BEFORE_TEXT.found(ctx.content.items[item.itemId]?.name ?? item.itemId), 'event');
  }
  grantKnownEcho(ctx, ECHO_ANCHOR_MECHANIC, 'anchor');
}

/**
 * The start of every arrival (reducers/explore.ts `runArrival`, before items, events and hooks): entering or leaving
 * the Before by the region of the location arrived at, and Anchors found in the Depths.
 */
export function beforeArrival(ctx: StepCtx, locationId: string): void {
  const inside = isBeforeLocation(ctx.content, locationId);
  if (inside && ctx.s.before === null) enterBefore(ctx);
  else if (!inside && ctx.s.before !== null) leaveBefore(ctx);
  if (locationId === DEPTHS_LOCATION_ID) noticeAnchors(ctx);
}

/** A full rest (reducers/explore.ts `restHandler`): inside the Before, the next Bell, or Last Bell's dusk and the reset. */
export function beforeRest(ctx: StepCtx): void {
  const b = ctx.s.before;
  if (b === null) return;
  if (b.day < 3) {
    const day = (b.day + 1) as 2 | 3;
    setDay(ctx, day);
    ctx.log(BEFORE_TEXT.day[day], 'narration');
    ctx.emit({ t: 'beforeDayAdvanced', day, resets: b.resets });
    return;
  }
  if (ritualResolved(ctx.s)) {
    ctx.s.counters.custom[BEFORE_WATCH_COUNTER] = 0; // U34d: the night passes; Last Bell's morning again
    ctx.log(BEFORE_TEXT.holds, 'narration');
    return;
  }
  b.resets += 1;
  ctx.s.counters.custom[BEFORE_RESETS_COUNTER] = b.resets;
  freshEcho(ctx);
  ctx.log(BEFORE_TEXT.reset, 'event');
  ctx.emit({ t: 'beforeReset', resets: b.resets });
  ctx.emit({ t: 'beforeDayAdvanced', day: 1, resets: b.resets });
}

/** The Before's rest spot (WORLD §3.11: the Apprentices' Garret is its only one): the first of its locations with a `rest`. */
export const beforeRestLocation = (content: ContentPack): string | undefined =>
  (content.index.locationsByRegion[BEFORE_REGION_ID] ?? []).find((id) => content.locations[id]?.rest !== undefined);

/**
 * U34d (D-098 item 6; WORLD §2.6 hazards, §6.9 `cr_city_watch_halberdier`, §12.1 `ws_wanted`): the Watch's non-lethal
 * arrest — "you wake in the Garret and lose a day". The fight that took the Wayfinder is over (reducers/combat.ts
 * `finishArrest`); here the day is lost as a night in a cell — the next Bell, or on Last Bell its dusk and the echo's
 * reset, exactly as a full rest brings them (`beforeRest`) — and the Wayfinder wakes at the Before's rest spot. Outside the
 * Before (no Watch there) the Wayfinder is simply let go where they stand.
 */
export function beforeArrest(ctx: StepCtx): void {
  const { s, content } = ctx;
  if (s.before === null) return;
  ctx.log(BEFORE_TEXT.arrest, 'event');
  beforeRest(ctx);
  const garret = beforeRestLocation(content);
  if (garret !== undefined && garret !== s.world.currentLocationId) apply({ teleport: garret as `loc_${string}` }, ctx, { source: 'arrest' });
}

/**
 * U34d (D-098 item 6): a short rest inside the Before (the Garret's) passes one of the echo's own watches — dawn, noon,
 * dusk, night — which the `watch` atom reads there (conditions.ts `watchNow`). Only a full rest brings the next Bell, and
 * Last Bell's reset stays the full rest's (DESIGN §10.1), so dusk and night of Last Bell can be walked before the verse.
 */
export function beforeShortRest(ctx: StepCtx): void {
  const { s } = ctx;
  if (s.before === null) return;
  const hour = watchNow(s);
  if (hour >= 3) {
    ctx.log(BEFORE_TEXT.stillNight, 'narration');
    return;
  }
  const next = (hour + 1) as 1 | 2 | 3;
  s.counters.custom[BEFORE_WATCH_COUNTER] = next;
  ctx.log(BEFORE_TEXT.hour[next], 'narration');
}

// ---- once per loop -------------------------------------------------------------------------------------------------------

/**
 * D-067.5 (combat/rewards.ts `rollSpoils`): may this won fight pay XP, gold and loot? Outside the Before always; inside,
 * the first win of each encounter in the loop, which this call records.
 */
export function claimBeforeSpoils(ctx: StepCtx, locationId: string, encounterId: string): boolean {
  if (!isBeforeLocation(ctx.content, locationId)) return true;
  const ls = locationState(ctx, locationId);
  const key = `${PAID}${encounterId}`;
  if (ls.flags[key] === true) return false;
  ls.flags[key] = true;
  return true;
}

// ---- Anchors -------------------------------------------------------------------------------------------------------------

/**
 * After a `drop` on the rim (reducers/inventory.ts): every `anchorable` item lying in the Conflux Chamber becomes an
 * Anchor — it moves to the Depths for the rest of the loop and sets the anchor flags (see the file header).
 */
export function anchorOnTheRim(ctx: StepCtx): void {
  const { s, content } = ctx;
  const rim = locationState(ctx, CONFLUX_LOCATION_ID);
  const depths = locationState(ctx, DEPTHS_LOCATION_ID);
  for (const item of rim.items.filter((i) => content.items[i.itemId]?.anchorable === true)) {
    rim.items = rim.items.filter((i) => i !== item);
    delete rim.flags[`${LEFT_ON_GROUND}${item.uid}`];
    depths.items.push(item);
    depths.flags[`${ANCHOR}${item.uid}`] = true;
    delete depths.flags[ANCHORS_NOTICED];
    s.flags[FLAG_CONFLUX_ANCHORED] = true;
    if (item.itemId === CRADLE_PIN_ITEM_ID) s.flags[FLAG_CRADLE_PIN_ANCHORED] = true;
    ctx.log(BEFORE_TEXT.anchor(content.items[item.itemId]?.name ?? item.itemId), 'event');
  }
}
