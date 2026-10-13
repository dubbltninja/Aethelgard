// The loop reducer (PLAN §4.11, DESIGN §10.1–10.2). Clock part (U20): tick arithmetic, the floor, the per-watch and
// per-dawn consequences of time passing, clock warnings and expiry. U30 appends the Horde, closers and loop end.
//
// Time moves only through `advanceTime` (effects.ts: one `watchAdvanced` per watch, a `dayAdvanced` at each dawn; a
// no-op while the clock is frozen in Silverwood Before) and the limit only through `changeLimit` (effects.ts:
// `clockChanged`, Frayed Clock halving, the floor). `clockHook` runs once per accepted step, after the action, over the
// events that step emitted, in order:
//   watchAdvanced → out-of-combat Poison/Bleed/Curse tick (DESIGN §4.5)
//   dayAdvanced   → DAWN_HOOKS (per-day uses reset, fled-boss HP cleared, `dawn` location events; restock U34)
// then the warning for the most urgent of 10/5/2/1 dawns left (`dawnsLeft`) crossed this step, then expiry,
// held while a fight is in progress (DESIGN §10.2) and applied by the first step after it.
import { TICKS_PER_DAY, watchOf } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { advanceTime } from '../effects';
import type { PostStepHook } from '../step';
import type { GameEvent } from '../types/events';
import { OUT_OF_COMBAT_STATUSES, fireEvents } from './explore';

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
 * One watch of the out-of-combat DoTs (DESIGN §4.5): each deals its stored tick (× stacks when the status ticks per
 * stack), never below 1 HP (out-of-combat damage does not kill, D-072), then counts down and expires at 0.
 */
export function tickOutOfCombatStatuses(ctx: StepCtx): void {
  const player = ctx.s.player;
  if (!player.statuses.some((st) => OUT_OF_COMBAT_STATUSES.includes(st.statusId))) return;
  for (const st of player.statuses) {
    if (!OUT_OF_COMBAT_STATUSES.includes(st.statusId)) continue;
    const dmg = ctx.content.statuses[st.statusId]?.tick?.damage;
    const amount = (st.tick ?? dmg?.base ?? 0) * (dmg?.perStack ? st.stacks : 1);
    const before = player.hp;
    player.hp = Math.max(1, player.hp - amount);
    ctx.s.counters.damageTaken += before - player.hp;
    ctx.emit({ t: 'statusTicked', targetUid: 'player', statusId: st.statusId, amount: before - player.hp });
    st.duration -= 1;
  }
  const expired = player.statuses.filter((st) => OUT_OF_COMBAT_STATUSES.includes(st.statusId) && st.duration <= 0);
  if (expired.length === 0) return;
  player.statuses = player.statuses.filter((st) => !expired.includes(st));
  for (const st of expired) ctx.emit({ t: 'statusExpired', targetUid: 'player', statusId: st.statusId });
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
 * Dawn hooks in run order; later units append theirs (one line each): U34 the merchant restock (D-057, every dawn;
 * `MerchantState.lastRestockDay` < day marks a stale stock), U32 Before-local resets if any.
 */
export const DAWN_HOOKS: readonly DawnHook[] = [resetDailyUses, clearEncounterHp, fireDawnEvents];

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
 * Clock expiry (DESIGN §10.2, D-066 #7): `expired`, `flag_clock_expired`, `clockExpired`; the Horde starts from the
 * Apex with cause `expiry` after a 3-move delay, and with `hordeActive` the Library portal is open (`enterPortal`).
 * A Horde already running (the Tyrant died) is left as it is. TODO(U30): spread, Ilyra at the portal, Echo grants.
 */
export function expireClock(ctx: StepCtx): void {
  const { s, content } = ctx;
  s.clock.expired = true;
  s.flags[FLAG_CLOCK_EXPIRED] = true;
  ctx.emit({ t: 'clockExpired' });
  ctx.log('The sky tears open above the Apex. The Breach is loose.', 'system');
  if (s.world.hordeActive) return;
  const delay = content.config.clock.expiryHordeDelay;
  s.world.hordeActive = true;
  s.world.hordeCause = 'expiry';
  s.world.hordeDelay = delay;
  ctx.emit({ t: 'hordeStarted', cause: 'expiry', delay });
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
