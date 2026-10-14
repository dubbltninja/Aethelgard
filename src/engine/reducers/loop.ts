// The loop reducer (PLAN §4.11, DESIGN §10.1–10.3). Clock part (U20): tick arithmetic, the floor, the per-watch and
// per-dawn consequences of time passing, clock warnings and expiry. Loop-end part (U30, below the post-step hook): the
// closers' actions, the loop's end, the ending screens and the next loop; the Horde itself is horde.ts.
//
// Time moves only through `advanceTime` (effects.ts: one `watchAdvanced` per watch, a `dayAdvanced` at each dawn; a
// no-op while the clock is frozen in Silverwood Before) and the limit only through `changeLimit` (effects.ts:
// `clockChanged`, Frayed Clock halving, the floor). `clockHook` runs once per accepted step, after the action, over the
// events that step emitted, in order:
//   watchAdvanced → out-of-combat Poison/Bleed/Curse tick (DESIGN §4.5)
//   dayAdvanced   → DAWN_HOOKS (per-day uses reset, fled-boss HP cleared, `dawn` location events, loot left on the
//                   ground gone (U26b); restock U34)
// then the warning for the most urgent of 10/5/2/1 dawns left (`dawnsLeft`) crossed this step, then expiry,
// held while a fight is in progress (DESIGN §10.2) and applied by the first step after it.
import { ENDING_LETTERS } from '@schema/ending';
import { TICKS_PER_DAY, dayOf, evaluate, watchOf } from '../conditions';
import { enterMode, type ContentPack, type StepCtx } from '../ctx';
import { LEFT_ON_GROUND, advanceTime, apply } from '../effects';
import { HORDE_TEXT, grantKnownEcho, startHorde } from '../horde';
import type { Enumerator } from '../legalActions';
import { newRun } from '../newRun';
import type { PostStepHook } from '../step';
import type { ActionOf } from '../types/actions';
import type { GameEvent } from '../types/events';
import type { Profile, RunRecord } from '../types/profile';
import type { EndingPending, GameState } from '../types/state';
import { clone } from '../util/clone';
import { tickCarriedWatch } from '../combat/turnOrder';
import { FLAG_TYRANT_DEAD } from './combat';
import { enterStartLocation, fireEvents } from './explore';
import { RESPEC_REST_KINDS } from './inventory';

/** Set at expiry for WORLD's world-state variants (DESIGN §10.2). */
export const FLAG_CLOCK_EXPIRED = 'flag_clock_expired';

// ---- tick arithmetic -------------------------------------------------------------------------------------------------

/** The dawn tick of the day `ticks` falls in. */
export const dayStartTick = (ticks: number): number => ticks - (ticks % TICKS_PER_DAY);
/** Watches from `ticks` to the next dawn: 4 at dawn (a full rest at dawn sleeps a whole day), 1 at night. */
export const watchesToNextDawn = (ticks: number): number => TICKS_PER_DAY - watchOf(ticks);
/** DESIGN §10.1 floor: the limit never moves below the current day's dawn + `floorDawns` (3) dawns. */
export const floorTick = (ticks: number, content: ContentPack): number =>
  dayStartTick(ticks) + TICKS_PER_DAY * content.config.clock.floorDawns;
/** The last dawn before collapse: the dawn tick with `daysLeft` = 1 (ending E's gate, D-066 #8). */
export const lastDawnTick = (limitTicks: number): number => dayStartTick(Math.max(0, limitTicks - TICKS_PER_DAY));

/**
 * Whole days until the limit, rounded up: the count the warnings use. It drops exactly at `limitTicks − 4n` — at a dawn
 * when the limit is a dawn (DESIGN §10.1: Days 20/25/28/29 at the base limit) — whereas the condition atom's
 * `daysLeft` (⌊(limit − ticks)/4⌋, PLAN §4.9) already reads n during the day before.
 */
export const dawnsLeft = (clock: { ticks: number; limitTicks: number }): number => Math.ceil((clock.limitTicks - clock.ticks) / TICKS_PER_DAY);

/** Advances the clock by `watches` (no-op while frozen); returns the watches that actually passed. */
export function passTime(ctx: StepCtx, watches: number): number {
  if (ctx.s.clock.frozen || watches <= 0) return 0;
  advanceTime(ctx, watches);
  return watches;
}

/**
 * Skips the clock to the last dawn before the limit (`daysLeft` 1) if it is not there yet; returns the watches passed.
 * For *Keep the vigil* (D-067.14, its action is U30's): every watch and dawn on the way runs through the clock hook.
 */
export function skipToLastDawn(ctx: StepCtx): number {
  return passTime(ctx, lastDawnTick(ctx.s.clock.limitTicks) - ctx.s.clock.ticks);
}

// ---- per-watch: out-of-combat statuses ---------------------------------------------------------------------------------

/**
 * One watch of the out-of-combat DoTs (DESIGN §4.5): each deals its tick by the in-combat rule (stored tick × stacks
 * when per-stack, the resistance step), never below 1 HP (out-of-combat damage does not kill, D-072), then counts down
 * and expires at 0. One implementation, shared with `beginCombat` (U24): combat/turnOrder.ts `tickCarriedWatch`.
 */
export function tickOutOfCombatStatuses(ctx: StepCtx): void {
  tickCarriedWatch(ctx);
}

// ---- per-dawn hooks ----------------------------------------------------------------------------------------------------

/** Runs at each dawn crossed, with the new Breach-Clock day. */
export type DawnHook = (ctx: StepCtx, day: number) => void;

/** Per-day `uses` (respec once a day …) expire at dawn; per-loop ones (`loop` only) stay until the loop resets. */
export const resetDailyUses: DawnHook = (ctx, day) => {
  const uses = ctx.s.player.uses;
  for (const key of Object.keys(uses)) {
    const entry = uses[key];
    if (entry?.day !== undefined && entry.day < day) delete uses[key];
  }
};

/** A fled boss/story gate keeps its HP only until dawn (DESIGN §4.7, LocationState.encounterHp). */
export const clearEncounterHp: DawnHook = (ctx) => {
  for (const ls of Object.values(ctx.s.world.locationStates)) {
    if (Object.keys(ls.encounterHp).length > 0) ls.encounterHp = {};
  }
};

/** `dawn` events of the location the player wakes in (LocationEventSchema trigger 'dawn'). */
export const fireDawnEvents: DawnHook = (ctx) => {
  if (ctx.s.mode !== 'explore') return;
  fireEvents(ctx, ctx.s.world.currentLocationId, 'dawn');
};

/**
 * DESIGN §7.8: loot left on the ground (a drop, a full pack's spoils; effects.ts `leaveOnGround`) persists at the node
 * until the next dawn — every item marked before this day is gone, everywhere (with a line when it lay where the player
 * is). A location's own content items are never marked and stay. Marks of items picked up meanwhile are dropped too.
 */
export const expireGroundLoot: DawnHook = (ctx, day) => {
  for (const [locationId, ls] of Object.entries(ctx.s.world.locationStates)) {
    let gone = 0;
    for (const key of Object.keys(ls.flags)) {
      const left = ls.flags[key];
      if (!key.startsWith(LEFT_ON_GROUND) || (typeof left === 'number' && left >= day)) continue;
      delete ls.flags[key];
      const i = ls.items.findIndex((it) => it.uid === key.slice(LEFT_ON_GROUND.length));
      if (i < 0) continue;
      ls.items.splice(i, 1);
      gone += 1;
    }
    if (gone > 0 && locationId === ctx.s.world.currentLocationId) ctx.log('What was left on the ground here is gone with the night.', 'system');
  }
};

/**
 * Dawn hooks in run order; later units append theirs (one line each): U34 the merchant restock (D-057, every dawn;
 * `MerchantState.lastRestockDay` < day marks a stale stock), U32 Before-local resets if any.
 */
export const DAWN_HOOKS: readonly DawnHook[] = [resetDailyUses, clearEncounterHp, fireDawnEvents, expireGroundLoot];

// ---- warnings and expiry -----------------------------------------------------------------------------------------------

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** DESIGN §10.1's Loop 2+ callouts ("Ten dawns remain." … "One dawn."). */
export function warningText(dawns: number): string {
  if (dawns === 10) return 'Ten dawns remain.';
  if (dawns === 1) return 'One dawn.';
  return `${NUMBER_WORDS[dawns] ?? dawns} dawns.`;
}

/**
 * The warning a step owes: the most urgent threshold crossed downward between `before` and `after` dawns left, or
 * null. Crossing several at once (a Destroy, a long skip) announces only the most urgent.
 */
export function warningCrossed(before: number, after: number, thresholds: readonly number[]): number | null {
  if (after >= before || after < 1) return null;
  const crossed = thresholds.filter((w) => w < before && w >= after);
  return crossed.length === 0 ? null : Math.min(...crossed);
}

/**
 * Clock expiry (DESIGN §10.2, D-066 #7): `expired`, `flag_clock_expired`, `clockExpired`; STORY §4.3's line and the
 * Horde from the Apex with cause `expiry` after a 3-move delay (horde.ts `startHorde`: the Library portal opens, Ilyra
 * goes to hold it). A Horde already running (the Tyrant died) is left as it is. `echo_thirtieth_dawn` is granted when
 * the loop closes (`closeLoop`, STORY §12: "granted on waking or at the Shore").
 */
export function expireClock(ctx: StepCtx): void {
  const { s, content } = ctx;
  s.clock.expired = true;
  s.flags[FLAG_CLOCK_EXPIRED] = true;
  ctx.emit({ t: 'clockExpired' });
  if (s.world.hordeActive) {
    ctx.log('The sky tears open above the Apex. The Breach is loose.', 'system');
    return;
  }
  ctx.log(HORDE_TEXT.expiry, 'event');
  startHorde(ctx, 'expiry', content.config.clock.expiryHordeDelay);
}

/** Expiry waits for a fight to end, and never applies outside play (ending, threshold, title). */
const canExpireNow = (ctx: StepCtx): boolean => {
  const { s } = ctx;
  return !s.clock.expired && s.clock.ticks >= s.clock.limitTicks && s.combat === null && (s.mode === 'explore' || s.mode === 'dialogue');
};

// ---- the post-step hook -------------------------------------------------------------------------------------------------

/** Post-step clock work (PLAN §4.6 `runPostStepHooks`: "clock warnings"); see the file header. */
export const clockHook: PostStepHook = (ctx) => {
  const { s, content } = ctx;
  let watches = 0;
  let limitDelta = 0;
  // `ctx.events` may grow while dawn events apply effects; the loop picks those up too.
  for (let i = 0; i < ctx.events.length; i++) {
    const e = ctx.events[i] as GameEvent;
    if (e.t === 'watchAdvanced') {
      watches += 1;
      if (s.combat === null) tickOutOfCombatStatuses(ctx);
    } else if (e.t === 'dayAdvanced') {
      for (const hook of DAWN_HOOKS) hook(ctx, e.day);
    } else if (e.t === 'clockChanged') {
      limitDelta += e.deltaWatches;
    }
  }
  if (watches > 0 || limitDelta !== 0) {
    const before = dawnsLeft({ ticks: s.clock.ticks - watches, limitTicks: s.clock.limitTicks - limitDelta });
    const dawns = warningCrossed(before, dawnsLeft(s.clock), content.config.clock.warningsDawnsLeft);
    if (dawns !== null) {
      ctx.emit({ t: 'clockWarning', daysLeft: dawns });
      if (s.meta.loop >= 2) ctx.log(warningText(dawns), 'system'); // Loop 1: NPC/ambient lines carry it (DESIGN §10.1)
    }
  }
  if (canExpireNow(ctx)) expireClock(ctx);
};

// ---- the loop end (U30; DESIGN §10.2–10.3, §10.6, §14; STORY §4.2–4.3, §10.7; PLAN §4.6 rule 5, §4.11) ----------------
//
// A step that enters ending mode — an `endLoop` effect (a closer: the portal, a death in the Horde or in Loop 2+, a
// rejection, *Let go*) or an `ending` effect (a true ending) — closes the loop in `loopEndHook`, after every effect of
// that step has applied (so an Echo granted beside the `ending` is in the record):
//   Echoes the end grants (`echo_thirtieth_dawn` after an expiry with the Tyrant alive; `echo_ending_<letter>`) →
//   Echoes and map memory copied to the profile → Resonance (first-time locations +2, completed quests +5, codex +1
//   not yet paid; a true ending +50 the first time; +10 per closer except `released`, STORY §10.7) → class mastery
//   (this loop's class abilities mastered, `loopsPlayed`, `bestLevel`, endings) → the RunRecord in `runHistory`
//   (cap 200), `lastClassId`, `loopCounter = max(profile, run) + 1` → `loopEnded` → the first slide.
// `acknowledgeEnding` steps through the slides (the record's sequence and epilogues; a closer without a record uses
// STORY's lines) and after the last one resets per DESIGN §10.3: the next loop is `newRun` (class kept, the Amulet on
// the Wayfinder from Loop 2, carry-over level from the mastery just written). Loop 1 → Loop 2 Day 1 at once (D-049,
// `beginLoop`); later loops → the Threshold (U31), with the pending outcome kept on the new state.
// The Loop 1 FALLEN screen (a death outside a Horde, D-049, D-075) is not a loop end: the fight stays in phase
// 'defeat' and `returnToTitle` is its acknowledgement (the profile already holds the Echoes and codex gained).

export const ECHO_THIRTIETH_DAWN = 'echo_thirtieth_dawn';
export const ECHO_AMULET_MEMORY = 'echo_amulet_memory';
/** D-047: the one object the reset never takes. */
export const AMULET_ITEM_ID = 'item_amulet_of_echoes';
/** DESIGN §10.3 / PLAN §4.3 `runHistory` cap. */
export const RUN_HISTORY_CAP = 200;
/** D-067.14: *Let go* and *Keep the vigil* are offered from Loop 2. */
export const CAMP_ACTIONS_FROM_LOOP = 2;
export const DEFAULT_PLAYER_NAME = 'Wayfinder';

/** The closers' screens when the pack has no record for them (STORY §4.2, §4.3, §10.7). */
export const CLOSER_TEXT = {
  lastThreshold:
    "The Last Threshold. You plunge through the shimmering portal, the screams of Aethelgard's final moments echoing behind you. The journey through the Temporal Breach is disorienting, a maelstrom of fractured realities. When you finally emerge, the air is still, the world unfamiliar. The Wayfinder's true journey has just begun...",
  shear: 'The stillness breaks. Something behind you has not finished speaking. The Breach does not lead beyond. It leads back.',
  shearUntouched: 'You did not kill it. It happened anyway.',
  fall: {
    death: 'The echoes fade, and the world grows silent.',
    expiry: HORDE_TEXT.expiry,
    rejected: 'Then you are the third to come for me with a blade in your mouth. Go and get a real one.',
    released: 'You let the day go. The Amulet is warm. It will be warm tomorrow, which is yesterday.',
  },
  amuletWarm:
    'The Amulet of Echoes is warm against your throat. You did not pick it up. It is simply there, as it was, as it will be. Your hands remember a portal. The stones remember nothing.',
  /** Engine line (DESIGN §10.2 names the action, not its text). */
  vigil: 'You keep the vigil. The days go by like pages turned in another room, until the last dawn.',
} as const;

const isCloser = (outcome: string): outcome is 'closer_escape' | 'closer_fall' => outcome === 'closer_escape' || outcome === 'closer_fall';

/** The ending's letter (STORY §10), for `echo_ending_<letter>`. */
function endingLetter(endingId: string): string | undefined {
  return (Object.keys(ENDING_LETTERS) as (keyof typeof ENDING_LETTERS)[]).find((l) => ENDING_LETTERS[l] === endingId);
}

/** "Escape" / "Fall (released)" / the ending's name. */
function outcomeLabel(content: ContentPack, pending: EndingPending): string {
  if (pending.outcome === 'closer_escape') return 'Escape';
  if (pending.outcome === 'closer_fall') return pending.reason === undefined ? 'Fall' : `Fall (${pending.reason})`;
  return content.endings[pending.outcome]?.name ?? pending.outcome;
}

/** The loop's Tyrant for the record: killed, spared, or never resolved. */
function tyrantFate(s: GameState): RunRecord['tyrant'] {
  if (s.world.tyrant === 'defeated' || s.flags[FLAG_TYRANT_DEAD] === true) return 'defeated';
  return s.world.tyrant === 'spared' ? 'spared' : 'untouched';
}

/** DESIGN §10.6 Resonance owed at the loop's end (each payment one `resonanceGained`). */
function payResonance(ctx: StepCtx, pending: EndingPending): void {
  const { s, content } = ctx;
  const r = content.config.resonance;
  const p = ctx.profileDraft();
  const firstTime = (key: string): boolean => {
    if (p.discoveries.includes(key)) return false;
    p.discoveries.push(key);
    return true;
  };
  const count = (ids: readonly string[], prefix: string): number => ids.filter((id) => firstTime(`${prefix}:${id}`)).length;
  const pay = (amount: number, reason: string): void => {
    if (amount > 0) apply({ resonance: amount }, ctx, { source: reason });
  };
  pay(count(s.world.discovered, 'loc') * r.location, 'locations');
  pay(count(Object.keys(s.quests).filter((id) => s.quests[id]?.status === 'completed'), 'quest') * r.quest, 'quests');
  pay(count([...p.codexUnlocked], 'codex') * r.codex, 'codex');
  if (!isCloser(pending.outcome)) {
    const def = content.endings[pending.outcome];
    if (firstTime(`ending:${pending.outcome}`)) pay(def !== undefined && def.resonance > 0 ? def.resonance : r.ending, pending.outcome);
  } else if (pending.reason !== 'released') {
    pay(r.closer, pending.outcome);
  }
}

/** DESIGN §10.3 step 2 for the class just played: this loop's class abilities mastered, loops, best level, endings. */
function writeMastery(ctx: StepCtx, pending: EndingPending, days: number): void {
  const { s, content } = ctx;
  const p = ctx.profileDraft();
  const classId = s.player.classId;
  p.classMastery[classId] ??= { loopsPlayed: 0, mastered: [], endings: [], bestLevel: 1, bestDays: null };
  const m = p.classMastery[classId];
  m.loopsPlayed += 1;
  const own = content.index.abilitiesByClass[classId] ?? [];
  for (const id of s.player.abilitiesUnlocked) if (own.includes(id) && !m.mastered.includes(id)) m.mastered.push(id);
  m.bestLevel = Math.max(m.bestLevel, s.player.level);
  if (isCloser(pending.outcome)) return;
  if (!m.endings.includes(pending.outcome)) m.endings.push(pending.outcome);
  m.bestDays = m.bestDays === null ? days : Math.min(m.bestDays, days);
  if (!p.endingsReached.includes(pending.outcome)) p.endingsReached.push(pending.outcome);
}

/** Closes the loop for `s.pendingEnding` (see the section header); returns the record written. */
export function closeLoop(ctx: StepCtx): RunRecord {
  const { s, content } = ctx;
  const pending = s.pendingEnding;
  if (pending === null) throw new Error('closeLoop: no pending outcome');
  if (isCloser(pending.outcome)) {
    if (s.clock.expired && s.flags[FLAG_TYRANT_DEAD] !== true) grantKnownEcho(ctx, ECHO_THIRTIETH_DAWN, 'expiry');
  } else {
    const letter = endingLetter(pending.outcome);
    if (letter !== undefined) grantKnownEcho(ctx, `echo_ending_${letter.toLowerCase()}`, `ending:${pending.outcome}`);
  }
  const p = ctx.profileDraft();
  for (const id of s.echoesThisLoop) if (!p.echoes.includes(id)) p.echoes.push(id);
  for (const id of s.world.discovered) if (!p.mapKnowledge.includes(id)) p.mapKnowledge.push(id);
  payResonance(ctx, pending);
  const days = dayOf(s.clock.ticks);
  writeMastery(ctx, pending, days);
  const record: RunRecord = {
    runId: s.meta.runId,
    seed: s.meta.seed,
    loop: s.meta.loop,
    classId: s.player.classId,
    outcome: pending.outcome,
    ...(pending.reason === undefined ? {} : { reason: pending.reason }),
    daysUsed: days,
    level: s.player.level,
    echoesGained: [...s.echoesThisLoop],
    questsCompleted: Object.keys(s.quests).filter((id) => s.quests[id]?.status === 'completed'),
    tyrant: tyrantFate(s),
    heartstone: s.world.heartstone,
    modifiers: [...s.meta.modifiers],
    summary: `Loop ${s.meta.loop} · ${content.classes[s.player.classId]?.name ?? s.player.classId} · ${outcomeLabel(content, pending)} · Day ${days}`,
  };
  p.runHistory.push(record);
  if (p.runHistory.length > RUN_HISTORY_CAP) p.runHistory.splice(0, p.runHistory.length - RUN_HISTORY_CAP);
  p.lastClassId = s.player.classId;
  p.loopCounter = Math.max(p.loopCounter, s.meta.loop) + 1;
  ctx.emit({ t: 'loopEnded', loop: s.meta.loop, outcome: pending.outcome, ...(pending.reason === undefined ? {} : { reason: pending.reason }), record: clone(record) });
  emitSlide(ctx, pending);
  return record;
}

/** Post-step hook (last): a step that entered ending mode closes the loop once. */
export const loopEndHook: PostStepHook = (ctx) => {
  const { s } = ctx;
  if (s.mode !== 'ending' || s.pendingEnding === null) return;
  if (!ctx.events.some((e) => e.t === 'modeChanged' && e.to === 'ending') || ctx.events.some((e) => e.t === 'loopEnded')) return;
  closeLoop(ctx);
};

// ---- the ending screens ------------------------------------------------------------------------------------------------

/** The slides of the pending outcome: its record's sequence then the epilogues whose `when` holds; else STORY's lines. */
export function endingSlides(s: GameState, content: ContentPack, profile: Readonly<Profile>): string[] {
  const pending = s.pendingEnding;
  if (pending === null) return [];
  const def = content.endings[pending.outcome];
  if (def !== undefined) {
    const texts = def.sequence.map((x) => x.text);
    for (const ep of def.epilogues) if (ep.when === undefined || evaluate(ep.when, s, profile, content)) texts.push(ep.text);
    return texts;
  }
  const untouched = s.clock.expired && s.flags[FLAG_TYRANT_DEAD] !== true;
  const shear = untouched ? `${CLOSER_TEXT.shear} ${CLOSER_TEXT.shearUntouched}` : CLOSER_TEXT.shear;
  if (pending.outcome === 'closer_escape') return [CLOSER_TEXT.lastThreshold, shear];
  return [CLOSER_TEXT.fall[pending.reason ?? 'death'], shear];
}

function emitSlide(ctx: StepCtx, pending: EndingPending): void {
  const text = endingSlides(ctx.s, ctx.content, ctx.profile)[pending.slideIndex] ?? '';
  ctx.emit({ t: 'endingSlide', endingId: pending.outcome, index: pending.slideIndex, text });
}

/** Replaces the whole draft with `next` (as `load` does) and reports the mode change. */
function replaceState(ctx: StepCtx, next: GameState): void {
  const from = ctx.s.mode;
  const draft = ctx.s as unknown as Record<string, unknown>;
  for (const key of Object.keys(draft)) delete draft[key];
  Object.assign(draft, next);
  if (from !== next.mode) ctx.emit({ t: 'modeChanged', from, to: next.mode });
}

/**
 * DESIGN §10.3 step 3: the next loop's state — `newRun` at `profile.loopCounter` with seed `${profileId}:${loopCounter}`
 * (PLAN §4.11), the class given (the Far Light may change it, U31), the player's name kept. For U31's `newLoop` too.
 */
export function nextLoopState(ctx: StepCtx, classId: string): GameState {
  const p = ctx.profile;
  return newRun(`${p.profileId}:${Math.max(1, p.loopCounter)}`, classId, ctx.content, p, { playerName: ctx.s.player.name });
}

/**
 * A loop's first moments (also U31's `newLoop`): `loopStarted`; from Loop 2 the waking — `echo_amulet_memory` the
 * first time (STORY §12 "wake in Loop 2") and the Amulet's warmth — then the start location's arrival (D-074).
 */
export function beginLoop(ctx: StepCtx): void {
  const { s } = ctx;
  ctx.emit({ t: 'loopStarted', loop: s.meta.loop, classId: s.player.classId });
  if (s.meta.loop >= 2) {
    if (!ctx.profile.echoes.includes(ECHO_AMULET_MEMORY)) grantKnownEcho(ctx, ECHO_AMULET_MEMORY, 'waking');
    if (s.player.inventory.some((i) => i.itemId === AMULET_ITEM_ID)) ctx.log(CLOSER_TEXT.amuletWarm, 'narration');
  }
  enterStartLocation(ctx);
}

/** After the last slide: Loop 1 → Loop 2 Day 1 (D-049); otherwise the Threshold's Still Shore (U31 takes it from there). */
function leaveEnding(ctx: StepCtx): void {
  const { s } = ctx;
  const pending = { ...(s.pendingEnding as EndingPending) };
  const next = nextLoopState(ctx, s.player.classId);
  if (s.meta.loop === 1) {
    replaceState(ctx, next);
    beginLoop(ctx);
    return;
  }
  next.mode = 'threshold';
  next.threshold = { visited: ['still_shore'], spentThisVisit: 0, pendingClassId: null };
  next.pendingEnding = pending; // DESIGN §10.3 step 4's `threshold.pending`: what brought the Wayfinder to the Shore
  replaceState(ctx, next);
  ctx.emit({ t: 'thresholdEntered', area: 'still_shore' });
}

/** `acknowledgeEnding` (ending mode): the next slide, or after the last one the next loop / the Threshold. */
export function acknowledgeEndingHandler(ctx: StepCtx): void {
  const pending = ctx.s.pendingEnding ?? ctx.reject('there is nothing to acknowledge');
  if (pending.slideIndex + 1 < endingSlides(ctx.s, ctx.content, ctx.profile).length) {
    pending.slideIndex += 1;
    emitSlide(ctx, pending);
    return;
  }
  leaveEnding(ctx);
}

export const acknowledgeEndingEnumerator: Enumerator<'acknowledgeEnding'> = (s) => (s.pendingEnding !== null ? [{ type: 'acknowledgeEnding' }] : []);

// ---- the camp: *Let go*, *Keep the vigil* (D-067.14) ------------------------------------------------------------------------

/** Why the camp's loop actions are not offered here: Loop 1, a running Horde, or no usable camp fire. */
export function campProblem(s: GameState, content: ContentPack, profile: Readonly<Profile>): string | null {
  if (s.meta.loop < CAMP_ACTIONS_FROM_LOOP) return 'The Amulet is quiet. Not yet.';
  if (s.world.hordeActive) return 'No time for that. You must run!';
  const rest = content.locations[s.world.currentLocationId]?.rest;
  if (rest === undefined || !RESPEC_REST_KINDS.includes(rest.kind) || (rest.when !== undefined && !evaluate(rest.when, s, profile, content))) {
    return 'Only at a camp fire';
  }
  return null;
}

/** `letGo` (DESIGN §10.2): at a camp from Loop 2 the loop closes at once as `closer_fall` / `released` (no Resonance). */
export function letGoHandler(ctx: StepCtx): void {
  const why = campProblem(ctx.s, ctx.content, ctx.profile);
  if (why !== null) ctx.reject(why);
  apply({ endLoop: { closer: 'closer_fall', reason: 'released' } }, ctx, { source: 'letGo' });
}

export const letGoEnumerator: Enumerator<'letGo'> = (s, content, profile) => (campProblem(s, content, profile) === null ? [{ type: 'letGo' }] : []);

/** Why *Keep the vigil* is not offered: the camp rules, a frozen clock, or the last dawn already here. */
export function vigilProblem(s: GameState, content: ContentPack, profile: Readonly<Profile>): string | null {
  const camp = campProblem(s, content, profile);
  if (camp !== null) return camp;
  if (s.clock.frozen) return 'time does not pass here';
  if (s.clock.ticks >= lastDawnTick(s.clock.limitTicks)) return 'The last dawn is already here';
  return null;
}

/** `keepVigil` (DESIGN §10.2, for ending E): the clock skips to the last dawn before the limit (`daysLeft` 1). */
export function keepVigilHandler(ctx: StepCtx): void {
  const why = vigilProblem(ctx.s, ctx.content, ctx.profile);
  if (why !== null) ctx.reject(why);
  ctx.log(CLOSER_TEXT.vigil, 'narration');
  skipToLastDawn(ctx);
}

export const keepVigilEnumerator: Enumerator<'keepVigil'> = (s, content, profile) =>
  vigilProblem(s, content, profile) === null ? [{ type: 'keepVigil' }] : [];

// ---- the shell: a new game, back to the title ---------------------------------------------------------------------------

/**
 * `newGame` (title): a fresh run of `classId` at the profile's loop counter (a profile never rewinds; seed `seed` or
 * `${profileId}:${loopCounter}`), then `beginLoop`.
 */
export function newGameHandler(ctx: StepCtx, a: ActionOf<'newGame'>): void {
  if (ctx.content.classes[a.classId] === undefined) ctx.reject(`unknown class '${a.classId}'`);
  const name = typeof a.name === 'string' && a.name.trim() !== '' ? a.name.trim() : DEFAULT_PLAYER_NAME;
  const p = ctx.profile;
  const seed = typeof a.seed === 'string' && a.seed !== '' ? a.seed : `${p.profileId}:${Math.max(1, p.loopCounter)}`;
  replaceState(ctx, newRun(seed, a.classId, ctx.content, p, { playerName: name }));
  beginLoop(ctx);
}

/** One `newGame` per class, with the default name (a payload the shell fills; any non-empty name is accepted). */
export const newGameEnumerator: Enumerator<'newGame'> = (_s, content) =>
  Object.keys(content.classes)
    .sort()
    .map((classId) => ({ type: 'newGame', name: DEFAULT_PLAYER_NAME, classId }));

/** In a fight only the Loop 1 FALLEN screen (phase 'defeat', D-049) may go back to the title. */
export function returnToTitleProblem(s: GameState): string | null {
  if (s.mode === 'combat' && s.combat?.phase !== 'defeat') return 'you cannot leave in the middle of a fight';
  return null;
}

/** `returnToTitle`: back to the title; from the FALLEN screen it is the acknowledgement (the fight is cleared). */
export function returnToTitleHandler(ctx: StepCtx): void {
  const why = returnToTitleProblem(ctx.s);
  if (why !== null) ctx.reject(why);
  ctx.s.combat = null;
  enterMode(ctx, 'title');
}

export const returnToTitleEnumerator: Enumerator<'returnToTitle'> = (s) => (returnToTitleProblem(s) === null ? [{ type: 'returnToTitle' }] : []);
