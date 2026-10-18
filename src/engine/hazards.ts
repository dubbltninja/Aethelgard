// Weather and hazards (U34e; D-094, D-096, D-097; WORLD §2's "Weather / time" and "Hazards" rows): a location's `hazards`
// (schema/location.ts `HazardSchema`; a region-wide row is repeated on each of its places). Where each trigger runs:
//   fight / ambush   `hazardsAtOpening` — reducers/combat.ts, a fight's opening: statuses, and the fight's accuracy and
//                    damage modifiers as combatant tags (combat/damage.ts reads them); also the statuses a `linger`
//                    hazard left waiting for "the next combat", wherever it is
//   round            `hazardsAtRound` — the start of every round, the first included: statuses and strikes
//   leave            `leaveWatches` — reducers/explore.ts `travel`, on a `move` only: extra watches on the road
//   watch            `hazardPostStep` — every watch of the step, at the place it ends in: the road in is spent there (the
//                    Null Orchard has no rest and no `wait`); a fight the step started takes the loss on the player's
//                    snapshot before it opens
//   linger           `hazardPostStep` — the watches spent standing at the place, those after the step's last arrival
// A hazard holds while its `when` holds, on its `cycle`'s days and (`firstVisit`) on this loop's first visit only; a
// `chance` below 1 draws once per target for a status or a strike and once otherwise (1 never draws). The player's
// `hazard_immunity` gear (`{ hazard: <id> }`, the Weaver's Thread Ring) keeps that hazard off the player alone.
import type { Hazard } from '@schema/location';
import { dayOf, evaluate } from './conditions';
import type { StepCtx } from './ctx';
import { GEAR_SCRIPT, scriptPassives } from './derived';
import type { PostStepHook } from './step';
import type { Combatant, CombatState } from './types/state';
import { addTag, hasTag } from './combat/buffs';
import { HAZARD_ACC_TAG, HAZARD_DEALT_TAG, hasStatus, resolveTick, roundHalfUp } from './combat/damage';
import { applyStatus } from './combat/statuses';
import { AMBUSH_TAG, combatLog, isActive } from './combat/turnOrder';

/** `player.uses` keys: watches stood still here; a status waiting for the next fight; HP a hazard holds until leaving. */
export const HAZARD_STILL_KEY = 'hazard:still';
export const HAZARD_PENDING_KEY = 'hazard:pending:';
export const HAZARD_LOST_KEY = 'hazard:lost:';

/** Does the player's gear shield them from hazard `id` (`hazard_immunity`, D-099)? */
export function hazardImmune(ctx: StepCtx, id: string): boolean {
  return scriptPassives(ctx.s.player, ctx.content, GEAR_SCRIPT.hazardImmunity).some((p) => p.params.hazard === id);
}

/** `h` holds now at `locationId` (its `when`, `cycle` and `firstVisit`). */
export function hazardHolds(ctx: StepCtx, h: Hazard, locationId: string): boolean {
  const { s } = ctx;
  if (h.when !== undefined && !evaluate(h.when, s, ctx.profile, ctx.content)) return false;
  if (h.cycle !== undefined && !h.cycle.days.includes(((dayOf(s.clock.ticks) - 1) % h.cycle.every) + 1)) return false;
  return !h.firstVisit || (s.world.locationStates[locationId]?.visitCount ?? 0) <= 1;
}

const hazardsAt = (ctx: StepCtx, locationId: string): readonly Hazard[] => ctx.content.locations[locationId]?.hazards ?? [];

function say(ctx: StepCtx, combat: CombatState | null, h: Hazard): void {
  if (h.text === undefined) return;
  if (combat !== null) combatLog(combat, h.text, 'status');
  ctx.log(h.text, combat !== null ? 'combat' : 'event');
}

/** The living combatants `to` names, the player left out when immune to the hazard. */
function reached(ctx: StepCtx, combat: CombatState, h: Hazard, to: 'player' | 'party' | 'enemies' | 'all'): Combatant[] {
  const party = combat.party.filter(isActive);
  const enemies = combat.enemies.filter(isActive);
  const all = to === 'player' ? party.filter((c) => c.kind === 'player') : to === 'party' ? party : to === 'enemies' ? enemies : [...party, ...enemies];
  return hazardImmune(ctx, h.id) ? all.filter((c) => c.kind !== 'player') : all;
}

/** Is `c` a wielder of a bow (the gale's and the glare's `rangedOnly`; no hit in the game says "ranged" itself)? */
function wieldsBow(ctx: StepCtx, c: Combatant): boolean {
  if (c.kind !== 'player') return false;
  const weapon = ctx.s.player.equipment.weapon;
  const def = weapon === null ? undefined : ctx.content.items[weapon.itemId];
  return def?.type === 'weapon' && def.weaponType === 'ranged_bow';
}

/** A hazard's status on the combatants it reaches (each its own `chance`). Returns whether any took it. */
function statusOn(ctx: StepCtx, combat: CombatState, h: Hazard): boolean {
  const st = h.status;
  if (st === undefined) return false;
  let any = false;
  for (const c of reached(ctx, combat, h, st.to)) {
    if (st.onlyIf !== undefined && !hasStatus(c, st.onlyIf)) continue;
    if (st.creatureTag !== undefined && (c.kind !== 'enemy' || !(ctx.content.creatures[c.refId]?.tags.includes(st.creatureTag) ?? false))) continue;
    if (!ctx.rng.chance(h.chance)) continue;
    const r = applyStatus(ctx, combat, null, c, st.id, st.duration === undefined ? {} : { duration: st.duration });
    any ||= r.outcome !== 'immune' && r.outcome !== 'ignored';
  }
  return any;
}

/**
 * A fight's opening (after the opening intents): every `fight` hazard here, the `ambush` ones when the player was
 * ambushed, then the statuses a `linger` hazard left waiting.
 */
export function hazardsAtOpening(ctx: StepCtx, combat: CombatState): void {
  const player = combat.party[0];
  const ambush = player !== undefined && hasTag(player, AMBUSH_TAG);
  for (const h of hazardsAt(ctx, combat.locationId)) {
    if (!(h.on === 'fight' || (h.on === 'ambush' && ambush)) || !hazardHolds(ctx, h, combat.locationId)) continue;
    let struck = statusOn(ctx, combat, h);
    if ((h.accuracy !== undefined || h.dealtMult !== undefined) && ctx.rng.chance(h.chance)) {
      if (h.accuracy !== undefined) {
        const acc = h.accuracy;
        for (const c of reached(ctx, combat, h, acc.to)) if (!acc.rangedOnly || wieldsBow(ctx, c)) addTag(c, `${HAZARD_ACC_TAG}${h.id}:${acc.amount}`);
      }
      if (h.dealtMult !== undefined) {
        for (const c of reached(ctx, combat, h, 'all')) addTag(c, `${HAZARD_DEALT_TAG}${h.id}:${h.dealtMult.type}:${h.dealtMult.mult}`);
      }
      struck = true;
    }
    if (struck) say(ctx, combat, h);
  }
  const uses = ctx.s.player.uses;
  for (const key of Object.keys(uses).filter((k) => k.startsWith(HAZARD_PENDING_KEY)).sort()) {
    const duration = uses[key]?.count;
    delete uses[key];
    if (player !== undefined) applyStatus(ctx, combat, null, player, key.slice(HAZARD_PENDING_KEY.length), duration === undefined ? {} : { duration });
  }
}

/**
 * The start of a round (the first included): every `round` hazard's status and strike here. A strike is flat typed
 * damage under resistance only, as a tick. Returns the combatants it brought to 0 HP (the caller knocks them out) and
 * whether any strike landed.
 */
export function hazardsAtRound(ctx: StepCtx, combat: CombatState): { downed: Combatant[]; struck: boolean } {
  const downed: Combatant[] = [];
  let hit = false;
  for (const h of hazardsAt(ctx, combat.locationId)) {
    if (h.on !== 'round' || !hazardHolds(ctx, h, combat.locationId)) continue;
    let struck = statusOn(ctx, combat, h);
    const strike = h.strike;
    for (const c of strike === undefined ? [] : reached(ctx, combat, h, strike.to)) {
      if (strike === undefined || (strike.onlyIf !== undefined && !hasStatus(c, strike.onlyIf)) || !ctx.rng.chance(h.chance)) continue;
      const tick = resolveTick(c, strike.amount, strike.type);
      c.hp = Math.max(0, c.hp - tick.amount);
      if (c.kind === 'player') ctx.s.counters.damageTaken += tick.amount;
      combatLog(combat, tick.immune ? `${c.name}: Immune.` : `It strikes ${c.name} for ${tick.amount}.`, 'damage');
      if (c.hp <= 0) downed.push(c);
      struck = hit = true;
    }
    if (struck) say(ctx, combat, h);
  }
  return { downed, struck: hit };
}

/** `travel` on a `move` away from `from`: the `leave` hazards' extra watches (the Pass's mirage paths). */
export function leaveWatches(ctx: StepCtx, from: string): number {
  let extra = 0;
  for (const h of hazardsAt(ctx, from)) {
    if (h.on !== 'leave' || !hazardHolds(ctx, h, from) || hazardImmune(ctx, h.id) || !ctx.rng.chance(h.chance)) continue;
    extra += h.watches ?? 0;
    say(ctx, null, h);
  }
  return extra;
}

/** On arriving where hazard `id` is not: the HP it held comes back (the Unmaking, "restored on leaving"). */
function restoreHeld(ctx: StepCtx, locationId: string): void {
  const { player } = ctx.s;
  for (const key of Object.keys(player.uses).filter((k) => k.startsWith(HAZARD_LOST_KEY))) {
    const id = key.slice(HAZARD_LOST_KEY.length);
    if (hazardsAt(ctx, locationId).some((h) => h.id === id)) continue;
    const held = player.uses[key]?.count ?? 0;
    delete player.uses[key];
    const before = player.hp;
    player.hp = Math.min(player.hpMax, player.hp + held);
    if (player.hp > before) ctx.emit({ t: 'healed', targetUid: 'player', amount: player.hp - before, source: `hazard:${id}` });
  }
}

/**
 * One `watch` hazard's watch: its share of max HP (never below 1), held for `restoreOnLeave`. Taken from the player's
 * snapshot when the step started a fight (it is copied back when the fight ends).
 */
function hazardWatch(ctx: StepCtx, h: Hazard): void {
  const { s } = ctx;
  const player = s.player;
  const opening = s.combat?.phase === 'start' ? s.combat.party.find((c) => c.kind === 'player') : undefined;
  const holder: { hp: number; hpMax: number } = opening ?? player;
  const loss = Math.min(Math.max(0, holder.hp - 1), roundHalfUp(holder.hpMax * (h.hpPctMax ?? 0)));
  if (loss <= 0) return;
  holder.hp -= loss;
  s.counters.damageTaken += loss;
  if (h.restoreOnLeave) {
    const key = `${HAZARD_LOST_KEY}${h.id}`;
    player.uses[key] = { count: (player.uses[key]?.count ?? 0) + loss };
  }
  ctx.log(h.text ?? `You lose ${loss} HP.`, 'event');
}

/**
 * Post-step: an arrival clears the still-standing count and gives back what a `restoreOnLeave` hazard held; every watch
 * of the step strikes the `watch` hazards of the place it ends in (outside a fight under way), and the watches spent
 * standing there after the step's last arrival count toward a `linger` hazard, whose status then waits for the next fight.
 */
export const hazardPostStep: PostStepHook = (ctx) => {
  const { s } = ctx;
  let watches = 0;
  let standing = 0;
  let arrived = false;
  for (const e of ctx.events) {
    if (e.t === 'locationEntered') {
      standing = 0;
      arrived = true;
    } else if (e.t === 'watchAdvanced') {
      watches += 1;
      standing += 1;
    }
  }
  const here = s.world.currentLocationId;
  const uses = s.player.uses;
  if (arrived) {
    delete uses[HAZARD_STILL_KEY];
    restoreHeld(ctx, here);
  }
  const hazards = hazardsAt(ctx, here);
  if (watches === 0 || hazards.length === 0 || (s.mode !== 'explore' && s.mode !== 'dialogue' && s.mode !== 'combat')) return;
  let still = 0;
  if (hazards.some((h) => h.on === 'linger')) {
    still = (uses[HAZARD_STILL_KEY]?.count ?? 0) + standing; // counted only where a `linger` hazard reads it
    uses[HAZARD_STILL_KEY] = { count: still };
  }
  for (const h of hazards) {
    if (!hazardHolds(ctx, h, here) || hazardImmune(ctx, h.id)) continue;
    if (h.on === 'watch' && (s.combat === null || s.combat.phase === 'start')) {
      for (let n = 0; n < watches; n++) if (ctx.rng.chance(h.chance)) hazardWatch(ctx, h);
    } else if (h.on === 'linger' && h.status !== undefined && still > (h.watches ?? 0)) {
      const key = `${HAZARD_PENDING_KEY}${h.status.id}`;
      if (uses[key] === undefined && ctx.rng.chance(h.chance)) {
        uses[key] = h.status.duration === undefined ? {} : { count: h.status.duration };
        say(ctx, null, h);
      }
    }
  }
};
