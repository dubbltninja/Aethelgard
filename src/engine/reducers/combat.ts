// The combat reducer (DESIGN §4.1 turn structure, §4.7 death, §4.8 targeting, §5.7 basic attacks; PLAN §4.10).
//
// A fight starts in phase 'start' (combat/turnOrder.ts `beginCombat`: an encounter on arrival, a `startCombat` effect)
// and `runCombat` plays turns in initiative order until it is the player's turn or the fight is over:
//   start of turn — `turnStarted`, Guard drops ("until the guarder's next turn begins"), start-of-turn status ticks
//                   (combat/statuses.ts: a combatant killed by them does not act), class `turn_start` resource
//   action        — a Stunned combatant loses it; else the player's (`attack`, `guard` here; `ability`, `item`, `flee`
//                   and the companion's signature command: U26, combat/abilities.ts and combat/flee.ts), the companion's
//                   by stance (U28, combat/companionAi.ts `companionTurn`), or the enemy's committed intent
//                   (combat/intents.ts, U25)
// Free actions on the player's turn (U28, DESIGN §4.1; D-078): a stance change (once per turn) and one companion order
// (`focus` / `hold`); neither ends the turn. Outside a fight: `setStance` and `swapCompanion` (DESIGN §12.1).
//   end of turn   — ability cooldowns count down, then status durations (D-066 #4) and expiry; the turn is counted
//                   (`pattern.turnsTaken`); an enemy then generates its next intent (after a Stun: from the next step)
// and at the end of each round the round counter goes up and the order is re-sorted (boss phases, U27: checked there
// and after every damage event, combat/phases.ts; a survival fight is won at the end of its last round). Before
// the first turn every enemy generates its opening intent; at the start of each player turn the intents are refreshed
// (re-aimed, re-projected, hidden ones due before the player's next turn revealed; DESIGN §4.2).
// The fight ends when every enemy is down or gone (victory: combat/rewards.ts — XP via progression, gold, loot with rarity
// and affix rolls, a full pack's overflow on the ground, the creatures' and the encounter's effects; autosave), when a
// `surviveRounds` fight's last round ends (a win without spoils), or when the player is down (defeat: Loop 1 outside a
// Horde is the classic FALLEN game over,
// D-049 — the state stays in combat, phase 'defeat', with no legal action and the shell returns to the title; any
// other death is The Fall, `closer_fall`, D-066 #7), or on a successful flee (U26: phase 'fled', no XP/loot, then the
// encounter's `onFlee`, combat/flee.ts). A knocked-out companion does not end the fight (DESIGN §4.7). The bestiary
// (U27, combat/rewards.ts): kills at the knock-out, intents seen at each player turn, creatures seen when the fight ends.
// U26 hooks: a delayed hit (Doom Sigil) fires at the start of its target's turn; traps set at the node spring when the
// fight opens; every hit that lands gives counter stances and ripostes their answer (combat/specials.ts).
// U29 (communion.ts, DESIGN §4.11): the player's turn start opens the phase-transition window and keeps the Tyrant's
// intent a communion beat; while communing the Tyrant's turn is a question or the press and a companion stands down; the
// player's turn end lets an attack forfeit the current question; `commune` is the dialogue actions; a spared Tyrant ends
// the fight without spoils after the chosen outcome (`finishSpared`); after a rejection `flee` leaves (`finishLeft`).
//
// Arrival encounters (ARRIVAL_HOOKS, reducers/explore.ts; DESIGN §4.7–4.8, WORLD §3 and §10.0), in order: a group a
// `spawn` effect placed here; the location's fixed encounters (not scattered or cleared, `when` holds, not bypassable
// by `optionalWhen`; `first:` groups below 100 % roll on the loop's first visit only, `respawn: 'on_return'` groups on
// later visits); then, on a return visit to a non-`safe` node, the region's wandering pool at its return chance
// (1 creature 70 %, 2 creatures 30 %). Nothing rolls on Retreat or *Not yet*.
// TODO(later unit): anomaly spawns (DESIGN §6.6) — the schema does not yet tie an anomaly encounter to a region.
import type { Move } from '@schema/creature';
import type { Effect } from '@schema/effect';
import type { Item } from '@schema/item';
import type { Location } from '@schema/location';
import { dayOf, evaluate } from '../conditions';
import { enterMode, type ContentPack, type StepCtx } from '../ctx';
import { derive } from '../derived';
import { apply, applyAll, locationState } from '../effects';
import type { Enumerator } from '../legalActions';
import { grantXp, resourceGain, type ResourceEventName } from '../progression';
import type { Handler, PostStepHook } from '../step';
import type { ActionOf } from '../types/actions';
import type { CloserReason } from '../types/ids';
import type { Combatant, CombatState, GameState } from '../types/state';
import {
  applyCoats,
  combatAbilityActions,
  combatItemActions,
  fieldAbilityActions,
  fireDelayed,
  springTraps,
  useCombatItem,
  useFieldAbility,
  usePlayerAbility,
} from '../combat/abilities';
import { consumeShield, resolveHit, rollPct, type HitResult, type HitSpec } from '../combat/damage';
import { attemptFlee, fleeOutcome, fleeProblem } from '../combat/flee';
import { expireStances, reactToHit, type CombatOps, type HitKind } from '../combat/specials';
import { STATUS, afterHit, applyStatus, blocksAction, endOfTurnStatuses, isBoss, skipsTurn, startOfTurnStatuses } from '../combat/statuses';
import { afterStunnedTurn, executeIntent, generateIntent, openingIntents, refreshIntents } from '../combat/intents';
import { checkPhases, openPhases, survivalRounds } from '../combat/phases';
import { noteIntentsSeen, recordKill, recordSeen, rollSpoils, type Spoils } from '../combat/rewards';
import {
  changeStance,
  commandActions,
  commandProblem,
  commandSignature,
  companionKnockedOut,
  companionTurn,
  giveOrder,
  stanceActions,
  stanceProblem,
  swapActions,
  swapCompanion,
  swapProblem,
} from '../combat/companionAi';
import {
  CARRIED_STATUSES,
  beginCombat,
  combatLog,
  currentActor,
  encounterSpec,
  isActive,
  playerOf,
  spawnedSpec,
  startRound,
  type EncounterSpec,
} from '../combat/turnOrder';
import {
  commune,
  communeActions,
  communeProblem,
  communes,
  communing,
  communionAfterAction,
  communionBossTurn,
  communionCompanionTurn,
  communionRejected,
  communionResolving,
  communionTurnStart,
  leaveRejected,
} from '../communion';
import type { Arrival, ArrivalHook } from './explore';

/** A safety net: one call to `runCombat` never plays more turns than this (a stuck loop is a bug, not a hang). */
export const MAX_COMBAT_TURNS = 10_000;
/** DESIGN §4.8: a wandering roll fields two creatures 30 % of the time, else one. */
export const WANDERING_PAIR_CHANCE = 0.3;
/** `CombatState.encounterId` of a wandering-pool fight (no encounter record to clear). */
export const WANDERING_ENCOUNTER_ID = 'wandering';
/** PLAN §4.11 / D-069.6: set when either Tyrant dies in combat. */
export const FLAG_TYRANT_DEAD = 'flag_tyrant_dead';
export const TYRANT_IDS: readonly string[] = ['cr_chronos_tyrant_contained', 'cr_chronos_tyrant_unveiled'];
/** The Warden's heavy-weapon Grit (DESIGN §5.7 `shield_heavy`). */
export const WARDEN_CLASS_ID = 'ironclad_warden';
/** No autosave at the Loop 1 Apex (D-067.1); the same rule as reducers/explore.ts (not imported: import cycle). */
const APEX_LOCATION_ID = 'loc_temporal_breach_apex';

type WeaponType = NonNullable<Item['weaponType']>;
type DamageKind = HitKind;

// ---- basic attacks (DESIGN §5.7) ----------------------------------------------------------------------------------------

export interface BasicAttack {
  weaponType: WeaponType;
  spec: HitSpec;
  /** MP restored on a hit (staff 3, focus 4). */
  mpOnHit: number;
  /** HP paid per swing (void focus 2); like every self-cost it needs current HP > cost (D-066 #5). */
  hpCost: number;
  /** Grit on a hit (heavy weapon, Warden only). */
  gritOnHit: number;
  /** Stun chance against non-bosses (heavy weapon 10 %), rolled after the hit's draws. */
  stunChance: number;
}

/**
 * DESIGN §5.7, one row per weapon type. Accuracy is the weapon type's (the `spell` rows get +10 through
 * `config.spellAccuracyBonus`); an item's own `stats.accuracy` is gear and already in the snapshot, so content should
 * not repeat the type's −5 there. Every class gains its class `basic_hit` / `basic_crit` resource on any basic hit.
 */
export const BASIC_ATTACKS: Readonly<Record<WeaponType, Omit<BasicAttack, 'weaponType'>>> = {
  melee: { spec: { source: 'basic', type: 'physical', base: 0, coef: 1.0, stat: 'atk' }, mpOnHit: 0, hpCost: 0, gritOnHit: 0, stunChance: 0 },
  ranged_bow: {
    spec: { source: 'basic', type: 'physical', base: 0, coef: 0.9, stat: 'atk', accuracy: 5, critBonus: 5 },
    mpOnHit: 0,
    hpCost: 0,
    gritOnHit: 0,
    stunChance: 0,
  },
  magic_staff: { spec: { source: 'basic', type: 'ley', base: 4, coef: 0.8, stat: 'sp', spell: true }, mpOnHit: 3, hpCost: 0, gritOnHit: 0, stunChance: 0 },
  shield_heavy: { spec: { source: 'basic', type: 'physical', base: 0, coef: 1.1, stat: 'atk', accuracy: -5 }, mpOnHit: 0, hpCost: 0, gritOnHit: 5, stunChance: 0.1 },
  void_focus: { spec: { source: 'basic', type: 'void', base: 3, coef: 0.7, stat: 'sp', spell: true }, mpOnHit: 4, hpCost: 2, gritOnHit: 0, stunChance: 0 },
};

/** The equipped weapon's type; bare hands fight as `melee` (ATK = STR). */
export function weaponTypeOf(s: GameState, content: ContentPack): WeaponType {
  const weapon = s.player.equipment.weapon;
  return (weapon ? content.items[weapon.itemId]?.weaponType : undefined) ?? 'melee';
}

/** The player's basic attack with the equipped weapon. */
export function basicAttackOf(s: GameState, content: ContentPack): BasicAttack {
  const weaponType = weaponTypeOf(s, content);
  const row = BASIC_ATTACKS[weaponType];
  return { ...row, weaponType, spec: { ...row.spec }, gritOnHit: s.player.classId === WARDEN_CLASS_ID ? row.gritOnHit : 0 };
}

/** A creature move as a hit spec (null for a non-damaging move). */
export function moveSpec(moveId: string, move: Move): HitSpec | null {
  if (!move.power || !move.type) return null;
  const spec: HitSpec = { source: moveId, type: move.type, base: move.power.base, coef: move.power.coef, stat: move.power.stat };
  if (move.spell) spec.spell = true;
  return spec;
}

/** The companion's usual hit: its `attack`-kind auto ability, else `1.0·ATK` of its damage type (UI previews; U28's turn: companionAi.ts). */
export function companionAttackSpec(content: ContentPack, companionId: string): HitSpec {
  const def = content.companions[companionId];
  for (const id of def?.abilities ?? []) {
    const a = content.abilities[id];
    if (a?.kind !== 'attack' || !a.power || !a.damageType) continue;
    const spec: HitSpec = { source: id, type: a.damageType, base: a.power.base, coef: a.power.coef, stat: a.power.stat };
    if (a.spell) spec.spell = true;
    return spec;
  }
  return { source: 'basic', type: def?.damageType ?? 'physical', base: 0, coef: 1, stat: 'atk' };
}

// ---- resources ---------------------------------------------------------------------------------------------------------

/** Adds MP (capped) to a party combatant; emits `resourceGained` for what actually landed. */
function addMp(ctx: StepCtx, combat: CombatState, c: Combatant, amount: number, reason: string): number {
  if (amount <= 0) return 0;
  const before = c.mp;
  c.mp = Math.min(c.mpMax, c.mp + amount);
  const gained = c.mp - before;
  if (gained > 0) {
    combat.resourceGainedThisTurn += gained;
    ctx.emit({ t: 'resourceGained', uid: c.uid, amount: gained, reason });
  }
  return gained;
}

/** The player's class resource for one event (DESIGN §5.2–5.6, progression `resourceGain`); others gain nothing. */
export function gainResource(ctx: StepCtx, combat: CombatState, c: Combatant, on: ResourceEventName): number {
  if (c.kind !== 'player') return 0;
  const cls = ctx.content.classes[ctx.s.player.classId];
  if (!cls) return 0;
  const gainPct = derive(ctx.s.player, ctx.content).resourceGainPct;
  return addMp(ctx, combat, c, resourceGain(cls, on, c.level, ctx.content.config, { mpMax: c.mpMax, gainPct }), on);
}

const hasRule = (ctx: StepCtx, on: ResourceEventName): boolean =>
  ctx.content.classes[ctx.s.player.classId]?.resource.rules.some((r) => r.on === on) ?? false;

// ---- hits ----------------------------------------------------------------------------------------------------------------

const damageSourceKey = (attacker: Combatant, spec: HitSpec): string => (attacker.kind === 'companion' ? `companion:${attacker.refId}` : spec.source);

/** Takes `target` out of the fight at 0 HP: statuses discarded, intent dropped, kills counted (DESIGN §4.5, §4.9). */
function knockOut(ctx: StepCtx, combat: CombatState, target: Combatant): void {
  target.hp = 0;
  target.alive = false;
  target.guarding = false;
  target.statuses = [];
  delete combat.intents[target.uid];
  ctx.emit({ t: 'combatantDefeated', uid: target.uid, refId: target.refId });
  if (target.kind === 'enemy') {
    const kills = ctx.s.counters.kills;
    kills[target.refId] = (kills[target.refId] ?? 0) + 1;
    if (TYRANT_IDS.includes(target.refId)) ctx.s.flags[FLAG_TYRANT_DEAD] = true;
    combatLog(combat, `${target.name} falls.`, 'info');
    recordKill(ctx, target.refId); // the bestiary, at the moment of the kill (U27)
  } else if (target.kind === 'companion') {
    ctx.emit({ t: 'companionKo', companionId: target.refId });
    combatLog(combat, `${target.name} is down.`, 'info');
    companionKnockedOut(ctx, target); // −2 loyalty, orders dropped (U28, DESIGN §12.5)
  }
}

/**
 * Applies a resolved hit: `attackResolved`, then on a hit the Shield and HP changes, `damageDealt`, run counters,
 * hit-taken / dodge resources for the player, and a knock-out at 0 HP.
 */
export function applyHit(ctx: StepCtx, combat: CombatState, attacker: Combatant, target: Combatant, spec: HitSpec, result: HitResult, kind: DamageKind): void {
  const { counters } = ctx.s;
  ctx.emit({ t: 'attackResolved', sourceUid: attacker.uid, targetUid: target.uid, hit: result.hit, crit: result.crit });
  const playerHit = target.kind === 'player' && attacker.kind === 'enemy';
  if (!result.hit) {
    combatLog(combat, `${attacker.name} misses ${target.name}.`, 'damage');
    afterHit(ctx, combat, attacker, target, spec, result); // a Phased miss consumes the Phase (U24)
    if (playerHit) gainResource(ctx, combat, target, 'dodge');
    return;
  }
  consumeShield(target, result);
  target.hp = Math.max(0, target.hp - result.amount);
  ctx.emit({
    t: 'damageDealt',
    sourceUid: attacker.uid,
    targetUid: target.uid,
    amount: result.amount,
    damageType: spec.type,
    mitigated: result.mitigated,
    absorbed: result.absorbed,
    kind,
    refId: spec.source === 'basic' ? null : spec.source,
  });
  const note = result.immune ? ' (Immune)' : result.crit ? ' (critical)' : '';
  combatLog(combat, `${attacker.name} hits ${target.name} for ${result.amount}${note}.`, 'damage');
  if (attacker.kind !== 'enemy' && target.kind === 'enemy') {
    counters.damageDealt += result.amount;
    const key = damageSourceKey(attacker, spec);
    counters.damageBySource[key] = (counters.damageBySource[key] ?? 0) + result.amount;
  }
  if (target.kind === 'player') counters.damageTaken += result.amount;
  if (playerHit) gainResource(ctx, combat, target, 'hit_taken');
  afterHit(ctx, combat, attacker, target, spec, result); // interplay that changes statuses (U24, DESIGN §4.6)
  if (target.hp <= 0) knockOut(ctx, combat, target);
  else reactToHit(ctx, combat, OPS, attacker, target, spec, result); // counter stances and ripostes answer (U26)
  checkPhases(ctx, combat); // boss phase triggers and reinforcements after every damage event (U27, DESIGN §4.10)
}

/** The reducer's operations the combat modules call back into (U26: abilities, items, flee, specials, intents). */
const OPS: CombatOps = { applyHit, gainResource, addMp };

// ---- turns ---------------------------------------------------------------------------------------------------------------

/** DESIGN §4.1 (1): the start of a combatant's turn. */
function startTurn(ctx: StepCtx, combat: CombatState, actor: Combatant): void {
  combat.phase = actor.kind === 'player' ? 'playerTurn' : actor.kind === 'companion' ? 'companionTurn' : 'enemyTurn';
  actor.guarding = false;
  expireStances(combat, actor); // counter stances, ripostes, Iron Guard end with the round (U26)
  if (actor.kind === 'player') combat.resourceGainedThisTurn = 0;
  ctx.emit({ t: 'turnStarted', uid: actor.uid, round: combat.round });
  // start-of-turn ticks: DoTs, Regen, Rewind (U24, combat/statuses.ts), then the Doom Sigil timer (U26, a delayed hit);
  // a combatant killed here does not act.
  const ticks = startOfTurnStatuses(ctx, combat, actor);
  if (actor.hp <= 0) {
    const how = ticks.ticks.some((t) => t.statusId === STATUS.bleed) ? 'bleeds out' : 'succumbs';
    combatLog(combat, `${actor.name} ${how} before it can act.`, 'damage');
    knockOut(ctx, combat, actor);
    checkPhases(ctx, combat); // U27
    return;
  }
  if (ticks.ticks.length > 0) checkPhases(ctx, combat); // a tick is a damage event (U27, DESIGN §4.10)
  fireDelayed(OPS, ctx, combat, actor);
  if (!isActive(actor)) return;
  if (actor.kind === 'player') gainResource(ctx, combat, actor, 'turn_start');
}

/** DESIGN §4.1 (3): the end of a combatant's turn. */
function endTurn(ctx: StepCtx, combat: CombatState, actor: Combatant): void {
  const cooldowns = actor.kind === 'player' ? combat.cooldowns : actor.cooldowns;
  for (const id of Object.keys(cooldowns)) {
    const left = (cooldowns[id] ?? 0) - 1;
    if (left > 0) cooldowns[id] = left;
    else delete cooldowns[id];
  }
  // status durations count down, except a status applied during this turn (D-066 #4); expiry (U24). After the
  // cooldowns, so a Stun that wears off here opens a full 2-turn recovery window.
  endOfTurnStatuses(ctx, combat, actor);
  actor.pattern.turnsTaken += 1; // `first` / `everyNth` count turns (U25); `targetHasActed` reads it for anyone
}

/**
 * DESIGN §4.1 end of round: a `surviveRounds` fight whose last round this was is won (D-069.9); else the counter goes up,
 * the order is re-sorted and the boss phases are checked (round triggers; adds they spawn join this round's order).
 */
function endRound(ctx: StepCtx, combat: CombatState): void {
  const survive = survivalRounds(ctx.content, combat);
  if (survive && combat.round >= survive.rounds) {
    ctx.log(survive.line ?? 'You hold until the end.', 'combat');
    finishVictory(ctx, combat, true);
    return;
  }
  combat.phase = 'roundEnd';
  combat.round += 1;
  startRound(combat, ctx.content);
  const enemies = combat.enemies.length;
  checkPhases(ctx, combat);
  if (combat.enemies.length !== enemies) startRound(combat, ctx.content);
}

/**
 * Plays turns until the player must act or the fight is over (DESIGN §4.1). Called by the post-step hook for a fight
 * in phase 'start', and by every player action after its effect.
 */
export function runCombat(ctx: StepCtx): void {
  const opening = ctx.s.combat;
  if (opening?.phase === 'start') {
    openPhases(ctx, opening); // bosses enter their opening phase (U27)
    openingIntents(ctx, opening); // DESIGN §4.1 Setup: every enemy's first intent (U25)
    springTraps(OPS, ctx, opening); // traps set at this node (U26)
  }
  for (let n = 0; n < MAX_COMBAT_TURNS; n++) {
    const combat = ctx.s.combat;
    if (combat === null || combat.phase === 'victory' || combat.phase === 'defeat' || combat.phase === 'fled') return;
    if (checkEnd(ctx, combat)) return;
    const actor = currentActor(combat);
    if (actor === undefined) {
      endRound(ctx, combat);
      continue;
    }
    if (!isActive(actor)) {
      combat.turnIndex += 1;
      continue;
    }
    startTurn(ctx, combat, actor);
    if (checkEnd(ctx, combat)) return;
    if (!isActive(actor)) {
      combat.turnIndex += 1; // killed by a start-of-turn tick: it does not act
      continue;
    }
    if (actor.kind === 'player') {
      refreshIntents(ctx, combat); // re-aim, re-project, reveal what is due (U25)
      noteIntentsSeen(ctx, combat); // the bestiary's intents seen (U27)
      communionTurnStart(ctx, combat); // the phase-transition window; a communing Tyrant's beat (U29)
    }
    if (skipsTurn(ctx.content, actor)) {
      combatLog(combat, `${actor.name} is stunned and loses the turn.`, 'status'); // DESIGN §4.5 Stun (U24)
      endTurn(ctx, combat, actor);
      if (actor.kind === 'enemy') afterStunnedTurn(ctx, combat, actor); // the stunned step is skipped, not replayed (U25)
      combat.turnIndex += 1;
      continue;
    }
    if (actor.kind === 'player') return;
    if (actor.kind === 'companion') {
      if (communing(ctx.content, combat)) communionCompanionTurn(ctx, combat, actor); // stands down, or Support +1 (U29)
      else companionTurn(OPS, ctx, combat, actor); // DESIGN §4.9 by stance (U28)
      endTurn(ctx, combat, actor);
    } else if (communes(ctx.content, combat, actor)) {
      communionBossTurn(OPS, ctx, combat, actor, () => endTurn(ctx, combat, actor)); // a question or the press (U29)
    } else {
      const phase = actor.phase;
      const played = executeIntent(ctx, combat, actor, applyHit, OPS); // DESIGN §4.2 (U25)
      endTurn(ctx, combat, actor);
      // the next intent, once this turn is over — unless a phase entered during its action already reset it (U27)
      if (actor.phase === phase) generateIntent(ctx, combat, actor, played);
    }
    combat.turnIndex += 1;
  }
  throw new Error('combat: the turn loop did not settle');
}

/** After the player's action: end the player's turn and play on (exported for the ability and item handlers). */
export function finishPlayerTurn(ctx: StepCtx, combat: CombatState, player: Combatant): void {
  const communion = communionAfterAction(ctx, combat); // U29: an attack forfeits the current question
  if (communion === 'chosen') return finishSpared(ctx, combat);
  if (communion === 'hold') return; // Movement III ended: the turn holds for the Resolution
  endTurn(ctx, combat, player);
  combat.turnIndex += 1;
  runCombat(ctx);
}

/** Post-step hook: a fight that started this step (phase 'start') plays until the player's first turn. */
export const combatPostStep: PostStepHook = (ctx) => {
  if (ctx.s.combat?.phase === 'start') runCombat(ctx);
};

// ---- the end of a fight --------------------------------------------------------------------------------------------------

/** Copies the party snapshots back: player HP/MP and surviving out-of-combat DoTs, the companion's HP (and max) and KO. */
function syncBack(ctx: StepCtx, combat: CombatState): void {
  const { player, companions } = ctx.s;
  const p = playerOf(combat);
  player.hp = Math.min(player.hpMax, Math.max(0, p.hp));
  player.mp = Math.min(player.mpMax, Math.max(0, p.mp));
  const carried = p.statuses.filter((st) => CARRIED_STATUSES.includes(st.statusId)).map((st) => ({ ...st, appliedOnOwnTurn: false }));
  player.statuses = [...player.statuses.filter((st) => !CARRIED_STATUSES.includes(st.statusId)), ...carried];
  for (const c of combat.party) {
    const run = c.kind === 'companion' ? companions.recruited[c.refId] : undefined;
    if (!run) continue;
    run.hpMax = c.hpMax;
    run.hp = Math.max(0, c.hp);
    if (!c.alive) run.ko = true;
  }
}

/** Victory bookkeeping: a `once` encounter is cleared for the loop, a daily one for today; a spawned group is gone. */
function clearEncounter(ctx: StepCtx, combat: CombatState): void {
  const { s, content } = ctx;
  const id = combat.encounterId;
  const ls = locationState(ctx, combat.locationId);
  const enc = content.locations[combat.locationId]?.encounters.find((e) => e.id === id) ?? content.encounters[id];
  if (enc?.respawn === 'daily') ls.encounterClearedDay[id] = dayOf(s.clock.ticks);
  else if (enc?.once && !ls.encountersCleared.includes(id)) ls.encountersCleared.push(id);
  const pending = s.world.pendingEncounters[combat.locationId];
  if (pending) {
    const left = pending.filter((sp) => sp.id !== id);
    if (left.length > 0) s.world.pendingEncounters[combat.locationId] = left;
    else delete s.world.pendingEncounters[combat.locationId];
  }
  delete ls.encounterHp[id];
}

/** No autosave at the Loop 1 Apex or during a Horde (D-067.1). */
function autosaveAfterCombat(ctx: StepCtx): void {
  const { s } = ctx;
  if (s.mode !== 'explore' || s.world.hordeActive || (s.meta.loop === 1 && s.world.currentLocationId === APEX_LOCATION_ID)) return;
  ctx.emit({ t: 'autosaveCheckpoint', reason: 'combatEnded' });
}

/**
 * Victory (DESIGN §4.1, §6.2): back to explore; the spoils (combat/rewards.ts `rollSpoils`: per fallen enemy in slot
 * order its gold roll, loot rolls with rarity/affixes and a full pack's overflow on the ground, `onDefeat`; none for a
 * survival win); gold, then XP through progression (level-ups refill); the bestiary's seen counts; `combatEnded`; the
 * encounter's `onVictory` effects; an autosave.
 */
function finishVictory(ctx: StepCtx, combat: CombatState, survived = false): void {
  const { s } = ctx;
  combat.phase = 'victory';
  syncBack(ctx, combat);
  s.combat = null;
  enterMode(ctx, 'explore');
  const { xp, gold, loot }: Spoils = survived ? { xp: 0, gold: 0, loot: [] } : rollSpoils(ctx, combat);
  if (gold > 0) apply({ gold }, ctx, { source: `encounter:${combat.encounterId}` });
  if (xp > 0) grantXp(ctx, xp);
  s.counters.fightsWon += 1;
  clearEncounter(ctx, combat);
  recordSeen(ctx, combat);
  ctx.emit({ t: 'combatEnded', result: 'victory', rounds: combat.round, xp, gold, loot });
  applyAll(combat.onVictory as Effect[], ctx, { source: `encounter:${combat.encounterId}` });
  autosaveAfterCombat(ctx);
}

/**
 * Defeat (DESIGN §4.7): `playerDied`, `combatEnded`, the encounter's `onDefeat` effects, then — Loop 1 outside a Horde —
 * the FALLEN game over (the fight stays on screen in phase 'defeat'; no action is legal; the shell offers load/title,
 * D-049) or else The Fall: `closer_fall` with reason `expiry` in an expiry Horde, `death` otherwise (PLAN §4.11).
 * TODO(U31): `att_second_wind` (once per loop, 1 HP instead).
 */
function finishDefeat(ctx: StepCtx, combat: CombatState): void {
  const { s } = ctx;
  combat.phase = 'defeat';
  syncBack(ctx, combat);
  s.counters.deathsThisLoop = 1;
  recordSeen(ctx, combat); // U27
  ctx.emit({ t: 'playerDied', loop: s.meta.loop });
  ctx.emit({ t: 'combatEnded', result: 'defeat', rounds: combat.round, xp: 0, gold: 0, loot: [] });
  applyAll(combat.onDefeat as Effect[], ctx, { source: `encounter:${combat.encounterId}` });
  if (s.meta.loop === 1 && !s.world.hordeActive) {
    ctx.log('FALLEN', 'system');
    return;
  }
  const reason: CloserReason = s.world.hordeActive && s.world.hordeCause === 'expiry' ? 'expiry' : 'death';
  if (s.combat === combat) s.combat = null;
  apply({ endLoop: { closer: 'closer_fall', reason } }, ctx);
}

/** Ends the fight if the player or every enemy is down (defeat first); returns whether it ended. */
function checkEnd(ctx: StepCtx, combat: CombatState): boolean {
  if (!playerOf(combat).alive) {
    finishDefeat(ctx, combat);
    return true;
  }
  if (combat.enemies.every((e) => !isActive(e))) {
    finishVictory(ctx, combat);
    return true;
  }
  return false;
}

// ---- player actions ------------------------------------------------------------------------------------------------------

/** The fight, when the player is the one acting (null otherwise) — the Resolution included (U29). */
export function playerActing(s: GameState): CombatState | null {
  const combat = s.combat;
  if (s.mode !== 'combat' || combat === null || combat.phase !== 'playerTurn') return null;
  const actor = currentActor(combat);
  return actor?.kind === 'player' && isActive(actor) ? combat : null;
}

/** The fight, when it is the player's turn to act (null otherwise; during a communion's Resolution only `commune` is). */
export function playerTurnCombat(s: GameState): CombatState | null {
  return communionResolving(s) ? null : playerActing(s);
}

function requirePlayerTurn(ctx: StepCtx): CombatState {
  const combat = playerTurnCombat(ctx.s);
  return combat ?? ctx.reject(ctx.s.combat?.phase === 'defeat' ? 'you have fallen' : 'it is not your turn');
}

/**
 * `attack`: the basic attack of the equipped weapon type at one living enemy (DESIGN §5.7). Resource on a hit: the
 * class `basic_crit` rule on a crit (else `basic_hit`), the `crit` rule on any crit, and the weapon's MP/Grit.
 */
export const attackHandler: Handler<'attack'> = (ctx: StepCtx, a: ActionOf<'attack'>): void => {
  const combat = requirePlayerTurn(ctx);
  const player = playerOf(combat);
  const target = combat.enemies.find((e) => e.uid === a.targetUid && isActive(e));
  if (!target) ctx.reject(`there is no enemy '${a.targetUid}' to attack`);
  const basic = basicAttackOf(ctx.s, ctx.content);
  if (basic.hpCost > 0) {
    if (player.hp <= basic.hpCost) ctx.reject('Not enough blood');
    player.hp -= basic.hpCost;
    combatLog(combat, `The focus takes ${basic.hpCost} HP.`, 'info');
  }
  const result = resolveHit(ctx, player, target, basic.spec);
  applyHit(ctx, combat, player, target, basic.spec, result, 'basic');
  if (result.hit) {
    gainResource(ctx, combat, player, result.crit && hasRule(ctx, 'basic_crit') ? 'basic_crit' : 'basic_hit');
    if (result.crit) gainResource(ctx, combat, player, 'crit');
    addMp(ctx, combat, player, basic.mpOnHit, `weapon:${basic.weaponType}`);
    addMp(ctx, combat, player, basic.gritOnHit, `weapon:${basic.weaponType}`);
  }
  // the heavy weapon's 10 % Stun on a non-boss it hit (U24): the status roll comes after the hit's draws (PLAN §4.10)
  if (result.hit && !result.immune && basic.stunChance > 0 && isActive(target) && !isBoss(ctx.content, target) && rollPct(ctx.rng, Math.round(basic.stunChance * 100))) {
    applyStatus(ctx, combat, player, target, STATUS.stun, { duration: 1 });
  }
  if (result.hit && !result.immune) applyCoats(ctx, combat, player, target, null); // Venom Coat (U26)
  finishPlayerTurn(ctx, combat, player);
};

/** `guard`: 50 % less direct damage until the player's next turn begins (DESIGN §4.7) and the class Guard resource. */
export const guardHandler: Handler<'guard'> = (ctx: StepCtx): void => {
  const combat = requirePlayerTurn(ctx);
  const player = playerOf(combat);
  if (blocksAction(ctx.content, player, 'guard')) ctx.reject('You cannot guard now');
  player.guarding = true;
  ctx.emit({ t: 'guarded', uid: player.uid });
  combatLog(combat, `${player.name} guards.`, 'info');
  gainResource(ctx, combat, player, 'guard');
  finishPlayerTurn(ctx, combat, player);
};

export const attackEnumerator: Enumerator<'attack'> = (s, content) => {
  const combat = playerTurnCombat(s);
  if (!combat) return [];
  const basic = basicAttackOf(s, content);
  if (basic.hpCost > 0 && playerOf(combat).hp <= basic.hpCost) return [];
  return combat.enemies.filter(isActive).map((e) => ({ type: 'attack', targetUid: e.uid }));
};

export const guardEnumerator: Enumerator<'guard'> = (s, content) => {
  const combat = playerTurnCombat(s);
  return combat && !blocksAction(content, playerOf(combat), 'guard') ? [{ type: 'guard' }] : [];
};

// ---- abilities, items, flee, the companion's signature (U26) ----------------------------------------------------------------

/** `ability`: in a fight, the turn's action (combat/abilities.ts); out of combat, a `field` ability (DESIGN §5.1). */
export const abilityHandler: Handler<'ability'> = (ctx: StepCtx, a: ActionOf<'ability'>): void => {
  if (ctx.s.mode !== 'combat') return useFieldAbility(ctx, a);
  const combat = requirePlayerTurn(ctx);
  usePlayerAbility(OPS, ctx, combat, a);
  finishPlayerTurn(ctx, combat, playerOf(combat));
};

export const abilityEnumerator: Enumerator<'ability'> = (s, content) => {
  if (s.mode === 'explore') return fieldAbilityActions(s, content);
  const combat = playerTurnCombat(s);
  return combat ? combatAbilityActions(s, content, combat) : [];
};

/** `item`: a consumable as the turn's action (DESIGN §7.9). */
export const itemHandler: Handler<'item'> = (ctx: StepCtx, a: ActionOf<'item'>): void => {
  const combat = requirePlayerTurn(ctx);
  useCombatItem(OPS, ctx, combat, a);
  finishPlayerTurn(ctx, combat, playerOf(combat));
};

export const itemEnumerator: Enumerator<'item'> = (s, content) => {
  const combat = playerTurnCombat(s);
  return combat ? combatItemActions(s, content, combat) : [];
};

// ---- the companion (U28, combat/companionAi.ts) ------------------------------------------------------------------------------

/**
 * `companionCommand` (DESIGN §4.1 `C`, §4.9; D-053, D-078): `signature` on the player's action (its self-cost, then
 * U26's resolution, then the loyalty cooldown cut); `focus` / `hold` are free orders, one per turn — the turn goes on.
 */
export const companionCommandHandler: Handler<'companionCommand'> = (ctx: StepCtx, a: ActionOf<'companionCommand'>): void => {
  const combat = requirePlayerTurn(ctx);
  const why = commandProblem(ctx.content, combat, a);
  if (why !== null) ctx.reject(why);
  if (a.command !== 'signature') {
    giveOrder(ctx, combat, a);
    return;
  }
  commandSignature(OPS, ctx, combat, a);
  finishPlayerTurn(ctx, combat, playerOf(combat));
};

export const companionCommandEnumerator: Enumerator<'companionCommand'> = (s, content) => {
  const combat = playerTurnCombat(s);
  return combat ? commandActions(content, combat) : [];
};

/** `setStance` (DESIGN §4.1 free action, §12.2): the active companion's stance; in a fight once per player turn. */
export const setStanceHandler: Handler<'setStance'> = (ctx: StepCtx, a: ActionOf<'setStance'>): void => {
  if (ctx.s.mode === 'combat') requirePlayerTurn(ctx);
  const why = stanceProblem(ctx.s, a.stance);
  if (why !== null) ctx.reject(why);
  changeStance(ctx, a.stance);
};

export const setStanceEnumerator: Enumerator<'setStance'> = (s) => (s.mode === 'combat' && playerTurnCombat(s) === null ? [] : stanceActions(s));

/** `swapCompanion` (DESIGN §12.1): at a rest spot, or with the companion present. */
export const swapCompanionHandler: Handler<'swapCompanion'> = (ctx: StepCtx, a: ActionOf<'swapCompanion'>): void => {
  const why = swapProblem(ctx.s, ctx.content, ctx.profile, a.companionId);
  if (why !== null) ctx.reject(why);
  swapCompanion(ctx, a.companionId);
};

export const swapCompanionEnumerator: Enumerator<'swapCompanion'> = (s, content, profile) => swapActions(s, content, profile);

/** A successful flee (DESIGN §4.7): the fight closes with no XP or loot, then the encounter's `onFlee` (combat/flee.ts). */
function finishFled(ctx: StepCtx, combat: CombatState): void {
  const { s } = ctx;
  combat.phase = 'fled';
  syncBack(ctx, combat);
  s.combat = null;
  enterMode(ctx, 'explore');
  s.counters.fled += 1;
  recordSeen(ctx, combat); // U27
  ctx.emit({ t: 'combatEnded', result: 'fled', rounds: combat.round, xp: 0, gold: 0, loot: [] });
  applyAll(combat.onFleeEffects as Effect[], ctx, { source: `encounter:${combat.encounterId}` });
  fleeOutcome(ctx, combat);
  if (s.mode === 'explore' && s.world.currentLocationId === combat.locationId) autosaveAfterCombat(ctx);
}

/** `flee` (DESIGN §4.1 `F`, §4.7): a failed roll wastes the turn and makes the next try +15 %. */
export const fleeHandler: Handler<'flee'> = (ctx: StepCtx): void => {
  const combat = requirePlayerTurn(ctx);
  if (communionRejected(combat)) return finishLeft(ctx, combat); // U29: leaving after a rejection, no roll
  const why = fleeProblem(ctx.content, combat);
  if (why !== null) ctx.reject(why);
  if (attemptFlee(ctx, combat)) finishFled(ctx, combat);
  else finishPlayerTurn(ctx, combat, playerOf(combat));
};

export const fleeEnumerator: Enumerator<'flee'> = (s, content) => {
  const combat = playerTurnCombat(s);
  return combat && (communionRejected(combat) || fleeProblem(content, combat) === null) ? [{ type: 'flee' }] : [];
};

// ---- communion (U29, communion.ts) ------------------------------------------------------------------------------------------

/**
 * `commune` (DESIGN §4.11): Commune opens it (free); Speak / Listen / Offer / Resist each cost the turn; in the Resolution,
 * Speak names the outcome and the fight closes.
 */
export const communeHandler: Handler<'commune'> = (ctx: StepCtx, a: ActionOf<'commune'>): void => {
  const combat = playerActing(ctx.s) ?? ctx.reject(ctx.s.combat?.phase === 'defeat' ? 'you have fallen' : 'it is not your turn');
  const why = communeProblem(ctx.s, ctx.content, ctx.profile, combat, a);
  if (why !== null) ctx.reject(why);
  const result = commune(OPS, ctx, combat, a);
  if (result === 'turn') finishPlayerTurn(ctx, combat, playerOf(combat));
  else if (result === 'chosen') finishSpared(ctx, combat);
};

export const communeEnumerator: Enumerator<'commune'> = (s, content, profile) => {
  const combat = playerActing(s);
  return combat ? communeActions(s, content, profile, combat) : [];
};

/**
 * The Tyrant spared and its outcome applied (an `ending` has already moved the mode on): the fight closes without spoils
 * or the encounter's `onVictory` — snapshots synced back, the encounter cleared, the bestiary's seen counts, `combatEnded`
 * as a victory with nothing paid (DESIGN §4.1: combat ends when every enemy is dead, spared or fled), an autosave if back
 * in explore.
 */
function finishSpared(ctx: StepCtx, combat: CombatState): void {
  const { s } = ctx;
  combat.phase = 'victory';
  syncBack(ctx, combat);
  s.combat = null;
  if (s.mode === 'combat') enterMode(ctx, 'explore');
  s.counters.fightsWon += 1;
  clearEncounter(ctx, combat);
  recordSeen(ctx, combat);
  ctx.emit({ t: 'combatEnded', result: 'victory', rounds: combat.round, xp: 0, gold: 0, loot: [] });
  autosaveAfterCombat(ctx);
}

/** Leaving after a rejection (STORY §8.5): the fight closes as fled, then `closer_fall` / `rejected` (communion.ts). */
function finishLeft(ctx: StepCtx, combat: CombatState): void {
  const { s } = ctx;
  combat.phase = 'fled';
  syncBack(ctx, combat);
  s.counters.fled += 1;
  recordSeen(ctx, combat);
  ctx.emit({ t: 'combatEnded', result: 'fled', rounds: combat.round, xp: 0, gold: 0, loot: [] });
  s.combat = null;
  leaveRejected(ctx);
}

/** The arrival after a flee (placed at the previous node) rolls no encounter (DESIGN §4.7). */
const fledThisStep = (ctx: StepCtx): boolean => ctx.events.some((e) => e.t === 'combatEnded' && e.result === 'fled');

// ---- arrival encounters --------------------------------------------------------------------------------------------------

/** A wandering-pool roll on a return visit (WORLD §10.0–10.1, DESIGN §4.8). */
function wanderingEncounter(ctx: StepCtx, loc: Location, arrival: Arrival): EncounterSpec | null {
  if (loc.safe || arrival.firstVisit) return null;
  const region = ctx.content.regions[loc.regionId];
  const pool = region?.wanderingPool ?? [];
  if (!region || pool.length === 0 || !ctx.rng.chance(region.returnEncounterChance)) return null;
  const size = ctx.rng.chance(WANDERING_PAIR_CHANCE) ? 2 : 1;
  const groups: { creatureId: string; count: number }[] = [];
  for (let i = 0; i < size; i++) {
    const creatureId = ctx.rng.weighted(pool.map((e) => ({ weight: e.weight, value: e.creatureId })));
    const group = groups.find((g) => g.creatureId === creatureId);
    if (group) group.count += 1;
    else groups.push({ creatureId, count: 1 });
  }
  return { id: WANDERING_ENCOUNTER_ID, groups, fleeable: true, onFlee: 'previous', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] };
}

/** The fight this arrival starts, if any (see the file header for the order and the rules). */
export function arrivalEncounter(ctx: StepCtx, arrival: Arrival): EncounterSpec | null {
  const { s, content, profile } = ctx;
  const loc = content.locations[arrival.locationId];
  if (!loc) return null;
  const spawned = s.world.pendingEncounters[loc.id]?.[0];
  if (spawned) return spawnedSpec(spawned);
  const ls = locationState(ctx, loc.id);
  const today = dayOf(s.clock.ticks);
  for (const enc of loc.encounters) {
    if (ls.scattered.includes(enc.id)) continue;
    if (enc.respawn === 'daily' ? ls.encounterClearedDay[enc.id] === today : enc.once && ls.encountersCleared.includes(enc.id)) continue;
    if (enc.respawn === 'on_return' ? arrival.firstVisit : enc.respawn === 'never' && enc.chance < 1 && !arrival.firstVisit) continue;
    if (enc.when !== undefined && !evaluate(enc.when, s, profile, content)) continue;
    if (enc.optionalWhen !== undefined && evaluate(enc.optionalWhen, s, profile, content)) continue;
    if (!ctx.rng.chance(enc.chance)) continue;
    return encounterSpec(enc);
  }
  return wanderingEncounter(ctx, loc, arrival);
}

/** ARRIVAL_HOOKS entry (reducers/explore.ts): starts the arrival's fight; it plays from the combat post-step hook. */
export const encounterArrivalHook: ArrivalHook = (ctx, arrival) => {
  if (arrival.via === 'retreat' || arrival.via === 'notYet' || ctx.s.combat !== null || fledThisStep(ctx)) return;
  const spec = arrivalEncounter(ctx, arrival);
  if (spec) beginCombat(ctx, spec);
};
