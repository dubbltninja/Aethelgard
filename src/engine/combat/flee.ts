// Fleeing (DESIGN §3.2 `flee%`, §4.1 the action table, §4.7; PLAN §4.10 "Flee", §8.1 "turn order & flee & guard";
// D-066 #11, D-071.1).
//
// Who can flee: anyone, from any fight, except bosses and story gates (`CombatState.canFlee` is false when the encounter
// or a creature in it says `fleeable: false`), a Slowed player (status `blockActions: ['flee']`) and communion (§4.11
// "Fleeing is impossible").
// The roll: `flee% = clamp(40 + 3·AGI − 2·max living enemy AGI, 10, 90) + 15 per failed attempt this fight` (derived.ts
// `fleeChance`), one percentage draw. Smoke Bomb / Veilwalk make the next flee this fight succeed without a roll
// (`FLEE_AUTO_TAG` on the player's pattern record, consumed by the flee). A failure wastes the turn and adds 15 %.
// A success ends the fight (the reducer's `finishFled`: phase 'fled', HP/MP synced back, `combatEnded` 'fled' with no
// XP, gold or loot, the encounter's `onFleeEffects`) and then `fleeOutcome` applies the encounter's `onFlee` mode:
//   previous  wandering / return rolls: 1 watch; the encounter is gone.
//   scatter   fixed non-boss groups (the default): 1 + 2 watches (3 in all); the group scatters for the rest of the loop
//             (`LocationState.scattered`; a spawned group leaves `pendingEncounters`), so the node is passable next time.
//   regroup   quest-drop groups (D-144: a location group whose creatures can drop an item a quest objective needs): 3
//             watches, as a scatter; the group is gone until the next dawn after the party could walk straight back in
//             (that day in `LocationState.encounterClearedDay`, read by reducers/combat.ts `arrivalEncounter`), then gathers
//             whole, its drops with it (a first-visit group fires on the next arrival until beaten). The node is passable
//             for the rest of that day; the quest is never lost.
//   hold      bosses / story gates (unfleeable) and a fleeable `hold` group: 1 watch; the living keep their HP until dawn
//             (`LocationState.encounterHp`, keys `heldHpKey`, cleared by the clock's dawn hook) and the group re-fires on
//             the next arrival (`arrivalEncounter`); a creature felled before the flight stands again whole.
// Whatever the mode, the party then falls back to the previous node (D-143, DESIGN §4.7), unless there is none or it is
// this node. The placement is a teleport; the reducer's arrival hook does not roll an encounter on it.
import { BEFORE_RETURN_WATCHES, isBeforeLocation } from '../before';
import { dayOf } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { fleeChance } from '../derived';
import { advanceTime, apply, locationState } from '../effects';
import type { Combatant, CombatState } from '../types/state';
import { rollPct } from './damage';
import { blocksAction } from './statuses';
import { combatLog, heldHpKey, isActive, playerOf } from './turnOrder';

/** On the player's pattern record (`firedOnce`, fight-scoped): the next flee succeeds without a roll (DESIGN §4.7). */
export const FLEE_AUTO_TAG = 'flee_auto';

/** Why the player cannot flee this fight now, or null. */
export function fleeProblem(content: ContentPack, combat: CombatState): string | null {
  if (!combat.canFlee) return 'There is no fleeing from this fight';
  if (combat.communion !== null) return 'There is no fleeing from this';
  if (blocksAction(content, playerOf(combat), 'flee')) return 'You are slowed and cannot flee';
  return null;
}

/** Smoke Bomb, Veilwalk: the player's next flee this fight succeeds (non-bosses: bosses cannot be fled at all). */
export function grantFleeAuto(c: Combatant): void {
  if (!c.pattern.firedOnce.includes(FLEE_AUTO_TAG)) c.pattern.firedOnce.push(FLEE_AUTO_TAG);
}

export const hasFleeAuto = (c: Combatant): boolean => c.pattern.firedOnce.includes(FLEE_AUTO_TAG);

/** DESIGN §3.2 `flee%` for this fight now (100 with a guaranteed flee). */
export function fleeChanceIn(content: ContentPack, combat: CombatState): number {
  const player = playerOf(combat);
  if (hasFleeAuto(player)) return 100;
  const enemyAgi = Math.max(0, ...combat.enemies.filter(isActive).map((e) => e.agi));
  return fleeChance(player.agi, enemyAgi, combat.fleeAttempts, content.config);
}

/** One flee attempt (the caller checked `fleeProblem`): emits `fleeAttempt`; a failure counts toward the next try. */
export function attemptFlee(ctx: StepCtx, combat: CombatState): boolean {
  const player = playerOf(combat);
  const chance = fleeChanceIn(ctx.content, combat);
  const auto = hasFleeAuto(player);
  const success = auto || rollPct(ctx.rng, chance);
  if (auto) player.pattern.firedOnce = player.pattern.firedOnce.filter((t) => t !== FLEE_AUTO_TAG);
  ctx.emit({ t: 'fleeAttempt', success, chance });
  if (success) combatLog(combat, auto ? 'Unseen, you slip away.' : 'You break away and run.', 'info');
  else {
    combat.fleeAttempts += 1;
    combatLog(combat, 'You try to break away, but they cut you off.', 'info');
  }
  return success;
}

/**
 * After a successful flee has closed the fight (the state is back in explore mode): the watches walked, what the
 * encounter does and the fall back to the previous node (see the file header). Emits `encounterScattered` for a scattered
 * location group.
 */
export function fleeOutcome(ctx: StepCtx, combat: CombatState): void {
  const { s, content } = ctx;
  const ls = locationState(ctx, combat.locationId);
  const id = combat.encounterId;
  const scatter = combat.onFlee === 'scatter';
  const regroup = combat.onFlee === 'regroup';
  advanceTime(ctx, 1 + (scatter || regroup ? content.config.flee.scatterWatches : 0));
  const pending = s.world.pendingEncounters[combat.locationId];
  const spawned = pending?.some((sp) => sp.id === id) ?? false;
  if (scatter) {
    if (spawned && pending) {
      const left = pending.filter((sp) => sp.id !== id);
      if (left.length > 0) s.world.pendingEncounters[combat.locationId] = left;
      else delete s.world.pendingEncounters[combat.locationId];
    } else if (!ls.scattered.includes(id)) {
      ls.scattered.push(id);
      ctx.emit({ t: 'encounterScattered', locationId: combat.locationId, encounterId: id });
    }
    ctx.log('The group scatters into the land. It will not gather here again this loop.', 'combat');
  } else if (combat.onFlee === 'hold') {
    const nth: Record<string, number> = {};
    const held: Record<string, number> = {};
    for (const e of combat.enemies) {
      const n = (nth[e.refId] = (nth[e.refId] ?? 0) + 1);
      if (isActive(e)) held[heldHpKey(e.refId, n)] = e.hp;
    }
    ls.encounterHp[id] = held;
  }
  const back = s.world.previousLocationId;
  const fallsBack = back !== null && back !== s.world.currentLocationId && content.locations[back] !== undefined;
  if (regroup) {
    // D-144: gone until the next dawn after the party could walk straight back in — the flight's watches, the road back,
    // and the Breach-door's charge when the fall back is into the Before — so that walk back always passes even when it
    // crosses a dawn; that day is recorded, and the dawn after it brings the group back whole (`arrivalEncounter`)
    const loc = combat.locationId;
    const edge = fallsBack ? content.locations[back as string]?.exits.find((e) => e.to === loc) : undefined;
    const door = fallsBack && isBeforeLocation(content, back as string) ? BEFORE_RETURN_WATCHES : 0;
    const road = !fallsBack || isBeforeLocation(content, loc) ? 0 : (edge?.travelWatches ?? 1) + door;
    const away = dayOf(s.clock.ticks + road);
    // the groups of this node already sent off stay off with it: two groups fled in turn would otherwise come back in turn,
    // and the node would never be passable
    for (const e of content.locations[combat.locationId]?.encounters ?? []) {
      if (e.onFlee === 'regroup' && e.respawn !== 'daily' && ls.encounterClearedDay[e.id] !== undefined) ls.encounterClearedDay[e.id] = away;
    }
    ls.encounterClearedDay[id] = away;
    ctx.log('The group breaks apart into the land. It will gather here again at dawn.', 'combat');
  }
  if (fallsBack) {
    ctx.log('You fall back the way you came.', 'combat');
    apply({ teleport: back as `loc_${string}` }, ctx, { source: 'flee' });
  }
}
