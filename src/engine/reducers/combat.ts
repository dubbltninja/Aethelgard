// The combat reducer (DESIGN §4.1 turn structure, §4.7 death, §4.8 targeting, §5.7 basic attacks; PLAN §4.10).
//
// A fight starts in phase 'start' (combat/turnOrder.ts `beginCombat`: an encounter on arrival, a `startCombat` effect)
// and `runCombat` plays turns in initiative order until it is the player's turn or the fight is over:
//   start of turn — `turnStarted`, Guard drops ("until the guarder's next turn begins"), class `turn_start` resource,
//                   start-of-turn ticks (U24: a combatant killed by them does not act)
//   action        — the player's (`attack`, `guard` here; abilities, items, flee U26; companion command U28), or the
//                   companion's / enemy's (placeholders until U28 companion AI and U25 intents, marked below)
//   end of turn   — ability cooldowns count down (status durations: U24)
// and at the end of each round the round counter goes up and the order is re-sorted (boss phase checks: U27).
// The fight ends when every enemy is down (victory: XP via progression, gold and loot rolls, the creatures' and the
// encounter's effects, autosave) or the player is (defeat: Loop 1 outside a Horde is the classic FALLEN game over,
// D-049 — the state stays in combat, phase 'defeat', with no legal action and the shell returns to the title; any
// other death is The Fall, `closer_fall`, D-066 #7). A knocked-out companion does not end the fight (DESIGN §4.7).
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
import { addItem, apply, applyAll, locationState } from '../effects';
import type { Enumerator } from '../legalActions';
import { grantXp, resourceGain, type ResourceEventName } from '../progression';
import type { Handler, PostStepHook } from '../step';
import type { ActionOf } from '../types/actions';
import type { CloserReason } from '../types/ids';
import type { Combatant, CombatState, GameState, ItemInstance } from '../types/state';
import { round } from '../util/math';
import { consumeShield, resolveHit, type HitResult, type HitSpec } from '../combat/damage';
import {
  CARRIED_STATUSES,
  beginCombat,
  combatLog,
  currentActor,
  encounterSpec,
  isActive,
  loopNudge,
  playerOf,
  spawnedSpec,
  startRound,
  type EncounterSpec,
} from '../combat/turnOrder';
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
type DamageKind = 'basic' | 'ability' | 'item' | 'intent';

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
  /** Stun chance against non-bosses (heavy weapon 10 %). TODO(U24): applied with the status rules. */
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

/** The companion's strike: its `attack`-kind auto ability, else `1.0·ATK` of its damage type. */
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
  } else if (target.kind === 'companion') {
    ctx.emit({ t: 'companionKo', companionId: target.refId });
    combatLog(combat, `${target.name} is down.`, 'info');
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
  // TODO(U27): HP-threshold boss phase triggers are checked here, after every damage event (DESIGN §4.10).
  if (target.hp <= 0) knockOut(ctx, combat, target);
}

// ---- turns ---------------------------------------------------------------------------------------------------------------

/** DESIGN §4.1 (1): the start of a combatant's turn. */
function startTurn(ctx: StepCtx, combat: CombatState, actor: Combatant): void {
  combat.phase = actor.kind === 'player' ? 'playerTurn' : actor.kind === 'companion' ? 'companionTurn' : 'enemyTurn';
  actor.guarding = false;
  if (actor.kind === 'player') combat.resourceGainedThisTurn = 0;
  ctx.emit({ t: 'turnStarted', uid: actor.uid, round: combat.round });
  // TODO(U24): start-of-turn ticks (DoTs, Regen, Rewind and Doom Sigil timers); a combatant killed here does not act.
  if (actor.kind === 'player') gainResource(ctx, combat, actor, 'turn_start');
}

/** DESIGN §4.1 (3): the end of a combatant's turn. */
function endTurn(_ctx: StepCtx, combat: CombatState, actor: Combatant): void {
  // TODO(U24): status durations decrement here, except a status applied during this turn (D-066 #4); expiry.
  const cooldowns = actor.kind === 'player' ? combat.cooldowns : actor.cooldowns;
  for (const id of Object.keys(cooldowns)) {
    const left = (cooldowns[id] ?? 0) - 1;
    if (left > 0) cooldowns[id] = left;
    else delete cooldowns[id];
  }
}

/** DESIGN §4.1 end of round: the counter goes up and the order is re-sorted. TODO(U27): boss phase triggers. */
function endRound(ctx: StepCtx, combat: CombatState): void {
  combat.phase = 'roundEnd';
  combat.round += 1;
  startRound(combat, ctx.content);
}

/** TODO(U25): replaced by intent resolution. Placeholder: the creature's first damaging move, at the player. */
function enemyPlaceholderAction(ctx: StepCtx, combat: CombatState, enemy: Combatant): void {
  const def = ctx.content.creatures[enemy.refId];
  const target = combat.party.find(isActive);
  let spec: HitSpec | null = null;
  for (const [id, move] of Object.entries(def?.moves ?? {})) {
    spec = moveSpec(id, move);
    if (spec) break;
  }
  if (!spec || !target) {
    combatLog(combat, `${enemy.name} holds still.`, 'info');
    return;
  }
  applyHit(ctx, combat, enemy, target, spec, resolveHit(ctx, enemy, target, spec), 'intent');
}

/** TODO(U28): replaced by the stance AI (DESIGN §4.9). Placeholder: its strike at the leftmost living enemy. */
function companionPlaceholderAction(ctx: StepCtx, combat: CombatState, companion: Combatant): void {
  const target = combat.enemies.find(isActive);
  if (!target) return;
  const spec = companionAttackSpec(ctx.content, companion.refId);
  applyHit(ctx, combat, companion, target, spec, resolveHit(ctx, companion, target, spec), spec.source === 'basic' ? 'basic' : 'ability');
}

/**
 * Plays turns until the player must act or the fight is over (DESIGN §4.1). Called by the post-step hook for a fight
 * in phase 'start', and by every player action after its effect.
 */
export function runCombat(ctx: StepCtx): void {
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
    if (actor.kind === 'player') return;
    if (actor.kind === 'companion') companionPlaceholderAction(ctx, combat, actor);
    else enemyPlaceholderAction(ctx, combat, actor);
    endTurn(ctx, combat, actor);
    combat.turnIndex += 1;
  }
  throw new Error('combat: the turn loop did not settle');
}

/** After the player's action: end the player's turn and play on. */
function finishPlayerTurn(ctx: StepCtx, combat: CombatState, player: Combatant): void {
  endTurn(ctx, combat, player);
  combat.turnIndex += 1;
  runCombat(ctx);
}

/** Post-step hook: a fight that started this step (phase 'start') plays until the player's first turn. */
export const combatPostStep: PostStepHook = (ctx) => {
  if (ctx.s.combat?.phase === 'start') runCombat(ctx);
};

// ---- the end of a fight --------------------------------------------------------------------------------------------------

/** DESIGN §6.2 kill XP: the creature's XP × the loop nudge (§6.6), rounded half-up. */
export function creatureXp(s: GameState, content: ContentPack, creatureId: string): number {
  const def = content.creatures[creatureId];
  return def ? round(def.xp * loopNudge(s, content)) : 0;
}

/** Pacifist's Vow and friends: a run modifier `xp_sources` that does not allow 'combat' zeroes kill XP (DESIGN §6.2). */
export function combatXpAllowed(s: GameState, content: ContentPack): boolean {
  return !s.meta.modifiers.some((id) => content.modifiers[id]?.rules.some((r) => r.kind === 'xp_sources' && !r.allow.includes('combat')) ?? false);
}

/** Copies the party snapshots back: player HP/MP and surviving out-of-combat DoTs, the companion's HP and KO. */
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
 * Victory (DESIGN §4.1, §6.2): back to explore, then per fallen enemy in slot order its gold roll, its loot rolls (each
 * `when`, then `chance`) and its `onDefeat` effects; XP through progression (level-ups refill); `combatEnded`; the
 * encounter's `onVictory` effects; an autosave. TODO(U27): bestiary kills and reveals, loot rarity rolls, a full pack.
 */
function finishVictory(ctx: StepCtx, combat: CombatState): void {
  const { s, content } = ctx;
  combat.phase = 'victory';
  syncBack(ctx, combat);
  s.combat = null;
  enterMode(ctx, 'explore');
  let xp = 0;
  let gold = 0;
  const loot: ItemInstance[] = [];
  const xpAllowed = combatXpAllowed(s, content);
  for (const enemy of combat.enemies.filter((e) => !e.alive)) {
    const def = content.creatures[enemy.refId];
    if (!def) continue;
    if (xpAllowed) xp += creatureXp(s, content, enemy.refId);
    gold += def.gold.min === def.gold.max ? def.gold.min : ctx.rng.int(def.gold.min, def.gold.max);
    for (const drop of def.loot) {
      if (drop.when !== undefined && !evaluate(drop.when, s, ctx.profile, content)) continue;
      if (!ctx.rng.chance(drop.chance)) continue;
      const [first] = addItem(ctx, drop.itemId, drop.count, drop.rarity);
      if (!first) continue;
      const item: ItemInstance = { ...first, qty: drop.count, affixes: [...first.affixes] };
      loot.push(item);
      ctx.emit({ t: 'itemGiven', item, source: `loot:${enemy.refId}` });
    }
    applyAll(def.onDefeat, ctx, { source: `creature:${enemy.refId}` });
  }
  if (gold > 0) apply({ gold }, ctx, { source: `encounter:${combat.encounterId}` });
  if (xp > 0) grantXp(ctx, xp);
  s.counters.fightsWon += 1;
  clearEncounter(ctx, combat);
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

/** The fight, when it is the player's turn to act (null otherwise). */
export function playerTurnCombat(s: GameState): CombatState | null {
  const combat = s.combat;
  if (s.mode !== 'combat' || combat === null || combat.phase !== 'playerTurn') return null;
  const actor = currentActor(combat);
  return actor?.kind === 'player' && isActive(actor) ? combat : null;
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
  // TODO(U24): the heavy weapon's 10 % Stun on non-bosses (`basic.stunChance`) and interplay 15 (Physical crit on Bleeding).
  finishPlayerTurn(ctx, combat, player);
};

/** `guard`: 50 % less direct damage until the player's next turn begins (DESIGN §4.7) and the class Guard resource. */
export const guardHandler: Handler<'guard'> = (ctx: StepCtx): void => {
  const combat = requirePlayerTurn(ctx);
  const player = playerOf(combat);
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

export const guardEnumerator: Enumerator<'guard'> = (s) => (playerTurnCombat(s) ? [{ type: 'guard' }] : []);

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
  if (arrival.via === 'retreat' || arrival.via === 'notYet' || ctx.s.combat !== null) return;
  const spec = arrivalEncounter(ctx, arrival);
  if (spec) beginCombat(ctx, spec);
};
