// Combat setup and turn order (DESIGN §4.1 Setup and Round, §4.8 slots, §3.2 initiative; PLAN §4.10).
//
// Setup turns an encounter into a CombatState: a snapshot of the player's derived stats (DESIGN §3.2), the active
// companion (§4.9, §12.3), and 1–3 enemies from creature records in slots left → right (§4.8), with the loop variety
// nudge (§6.6). Each combatant rolls `initiative = AGI (+ gear) + d4` once — player, companion, then enemies by slot —
// and keeps it for the fight. `status_rested` (§9.5) is baked into the snapshot and consumed; the out-of-combat DoTs
// (Poison, Bleed, Curse, §4.5) move onto the player's Combatant and back when the fight ends.
//
// Rounds: all living combatants sorted by initiative (the kept roll plus live status modifiers, so Haste/Slow matter),
// descending; ties player → companion → enemies by slot. The order is re-sorted at the start of every round; the round
// counter starts at 1 and increments when every living combatant has acted.
//
// No enemy acts here: `beginCombat` leaves the fight in phase 'start' and the combat reducer (reducers/combat.ts) runs
// turns, so content effects (`startCombat`) can start a fight without importing the reducer.
import type { Companion } from '@schema/companion';
import type { Effect } from '@schema/effect';
import type { Encounter } from '@schema/encounter';
import { enterMode, type ContentPack, type StepCtx } from '../ctx';
import { DAMAGE_TYPES, derive } from '../derived';
import { modifierDamageMult } from '../runRules';
import type { Combatant, CombatState, DamageType, GameState, Resistance, SpawnedEncounter, StatusInstance } from '../types/state';
import { round } from '../util/math';
import { actsFirst } from './buffs';
import { dotDamage, statusMods } from './damage';

/** DESIGN §4.1: the initiative die, rolled once per fight. */
export const INITIATIVE_DIE = 4;
/** DESIGN §4.8: at most three enemies (slots left, center, right). */
export const MAX_ENEMIES = 3;
/** DESIGN §4.5: the statuses that persist out of combat (also reducers/explore.ts; kept here to avoid an import cycle). */
export const CARRIED_STATUSES: readonly string[] = ['status_poison', 'status_bleed', 'status_curse'];
/** DESIGN §9.5: the inn's first-fight buff (reducers/explore.ts RESTED_STATUS); baked into the snapshot, consumed here. */
const RESTED = 'status_rested';
/** Capacity of `CombatState.log`. */
export const COMBAT_LOG_CAP = 200;

const KIND_RANK: Readonly<Record<Combatant['kind'], number>> = { player: 0, companion: 1, enemy: 2 };

// ---- encounters ---------------------------------------------------------------------------------------------------------

/** What starts a fight: a location or table encounter, a spawned group, or a wandering roll. */
export interface EncounterSpec {
  /** The encounter id ('wandering' for a pool roll); victory bookkeeping finds the record by it. */
  id: string;
  groups: readonly { creatureId: string; count: number }[];
  fleeable: boolean;
  onFlee: CombatState['onFlee'];
  ambush: boolean;
  intro?: string;
  onVictory: readonly Effect[];
  onDefeat: readonly Effect[];
  onFleeEffects: readonly Effect[];
}

/** An encounter record (location or table) as a fight spec. */
export function encounterSpec(enc: Encounter): EncounterSpec {
  const spec: EncounterSpec = {
    id: enc.id,
    groups: enc.groups,
    fleeable: enc.fleeable,
    onFlee: enc.onFlee,
    ambush: enc.ambush,
    onVictory: enc.onVictory,
    onDefeat: enc.onDefeat,
    onFleeEffects: enc.onFleeEffects,
  };
  if (enc.intro !== undefined) spec.intro = enc.intro;
  return spec;
}

/** A group placed by a `spawn` effect (WorldState.pendingEncounters). */
export function spawnedSpec(sp: SpawnedEncounter): EncounterSpec {
  const spec: EncounterSpec = { id: sp.id, groups: sp.groups, fleeable: true, onFlee: sp.onFlee, ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] };
  if (sp.label !== undefined) spec.intro = sp.label;
  return spec;
}

/**
 * The encounter with id `id` (ids are global, PLAN §5.19 rule 6): the encounters table first, then the location `at`,
 * then any location. Returns the record and the location that holds it (null for a table encounter).
 */
export function findEncounter(content: ContentPack, id: string, at: string): { enc: Encounter; locationId: string | null } | undefined {
  const table = content.encounters[id];
  if (table) return { enc: table, locationId: null };
  const here = content.locations[at]?.encounters.find((e) => e.id === id);
  if (here) return { enc: here, locationId: at };
  for (const loc of Object.values(content.locations)) {
    const enc = loc.encounters.find((e) => e.id === id);
    if (enc) return { enc, locationId: loc.id };
  }
  return undefined;
}

/** The `startCombat` effect (DESIGN §13.3): starts encounter `id` here. A fight already running rejects the action. */
export function startEncounterById(ctx: StepCtx, id: string): void {
  if (ctx.s.combat !== null) ctx.reject(`effect 'startCombat' while a fight is already in progress`);
  const found = findEncounter(ctx.content, id, ctx.s.world.currentLocationId);
  if (!found) throw new Error(`startCombat: unknown encounter '${id}'`);
  beginCombat(ctx, encounterSpec(found.enc));
}

// ---- combatants ---------------------------------------------------------------------------------------------------------

const halfAgi = (agi: number): number => Math.floor(agi / 2);

/** DESIGN §6.6: creature HP and ATK/SP (and XP) × (1 + 3 % per loop after the first, at most +15 %). */
export function loopNudge(s: GameState, content: ContentPack): number {
  return 1 + content.config.loopNudgePct * Math.min(Math.max(0, s.meta.loop - 1), content.config.loopNudgeCap);
}

const STEP_TO_RESISTANCE: readonly Resistance[] = ['neutral', 'resist', 'immune'];

/** The player's resistances from gear: each step moves one notch toward immune (DESIGN §4.4); `resist` passives set a level. */
function playerResistances(steps: Partial<Record<DamageType, number>>, passives: ReturnType<typeof derive>['passives']): Combatant['resistances'] {
  const out: Combatant['resistances'] = {};
  const rank = (r: Resistance): number => ['weak', 'neutral', 'resist', 'immune'].indexOf(r);
  for (const type of DAMAGE_TYPES) {
    let level: Resistance = STEP_TO_RESISTANCE[Math.min(steps[type] ?? 0, STEP_TO_RESISTANCE.length - 1)] ?? 'neutral';
    for (const p of passives) if (p.kind === 'resist' && p.damageType === type && rank(p.level) > rank(level)) level = p.level;
    if (level !== 'neutral') out[type] = level;
  }
  return out;
}

const freshPattern = (): Combatant['pattern'] => ({ pointer: 0, turnsTaken: 0, firedOnce: [], phaseEnteredRound: 1 });

function d4(ctx: StepCtx): number {
  return ctx.rng.int(1, INITIATIVE_DIE);
}

/** The player's Combatant: derive() with the out-of-combat statuses (Rested included), plus the d4. */
function playerCombatant(ctx: StepCtx, carried: StatusInstance[]): Combatant {
  const { player } = ctx.s;
  const d = derive(player, ctx.content);
  return {
    uid: ctx.uid('c'),
    kind: 'player',
    refId: player.classId,
    name: player.name,
    level: player.level,
    hp: player.hp,
    hpMax: player.hpMax,
    mp: player.mp,
    mpMax: player.mpMax,
    atk: d.atk,
    sp: d.sp,
    armor: d.armor,
    ward: d.ward,
    agi: d.agility,
    accuracy: d.accuracy,
    evasion: d.evasion,
    crit: d.crit,
    critMult: d.critMult,
    statuses: carried,
    guarding: false,
    initiative: d.initiative + d4(ctx),
    resistances: playerResistances(d.resistSteps, d.passives),
    phase: 0,
    pattern: freshPattern(),
    cooldowns: {},
    alive: true,
    fledOrGone: false,
    isAdd: false,
  };
}

/** DESIGN §12.3: a companion's max HP at the player's level (L1 + per level). */
export const companionHpMax = (def: Pick<Companion, 'stats' | 'perLevel'>, level: number): number => round(def.stats.hp + def.perLevel.hp * (Math.max(1, level) - 1));

/**
 * D-059 / D-066 #12 / DESIGN §12.8: a location-restricted companion (Dask) may stand only where the location is
 * `temporallyUnstable` or Horde-infected; every other companion anywhere (U28, combat/companionAi.ts).
 */
export function companionAllowedAt(s: GameState, content: ContentPack, companionId: string, locationId: string): boolean {
  if (!content.companions[companionId]?.requiresTemporallyUnstable) return true;
  return (content.locations[locationId]?.temporallyUnstable ?? false) || s.world.infected.includes(locationId);
}

/**
 * The active companion at the player's level (DESIGN §4.9, §12.3): HP/ATK/SP grow per level (current HP moves with a max
 * that grew since the record was last synced), armor/ward +1 per 4 levels. None where it cannot stand (Dask, U28).
 */
function companionCombatant(ctx: StepCtx): Combatant | null {
  const { s, content } = ctx;
  const id = s.companions.activeId;
  const run = id === null ? undefined : s.companions.recruited[id];
  const def = id === null ? undefined : content.companions[id];
  if (!run || !def || run.ko || run.dead || run.hp <= 0) return null;
  if (!companionAllowedAt(s, content, def.id, s.world.currentLocationId)) return null;
  const level = s.player.level;
  const steps = Math.floor(level / 4);
  const agi = def.stats.agi;
  const { config } = content;
  const hpMax = companionHpMax(def, level);
  return {
    uid: ctx.uid('c'),
    kind: 'companion',
    refId: def.id,
    name: def.name,
    level,
    hp: Math.min(hpMax, Math.max(1, run.hp + hpMax - run.hpMax)),
    hpMax,
    mp: 0,
    mpMax: 0,
    atk: def.stats.atk + def.perLevel.atk * (level - 1),
    sp: def.stats.sp + def.perLevel.sp * (level - 1),
    armor: def.stats.armor + steps,
    ward: def.stats.ward + steps,
    agi,
    accuracy: config.baseAccuracy + halfAgi(agi),
    evasion: halfAgi(agi) + def.stats.evasion,
    crit: Math.min(config.critCap, config.critBase + halfAgi(agi)),
    critMult: config.critMult,
    statuses: [],
    guarding: false,
    initiative: agi + d4(ctx),
    resistances: {},
    phase: 0,
    pattern: freshPattern(),
    cooldowns: { ...run.cooldowns },
    alive: true,
    fledOrGone: false,
    isAdd: false,
  };
}

/**
 * An enemy Combatant from its creature record (PLAN §5.4): stats × the loop nudge (HP rounded half-up), accuracy
 * `85 + ⌊AGI/2⌋`, evasion `⌊AGI/2⌋`, crit `5 + ⌊AGI/2⌋` (DESIGN §3.2: one rule for every combatant). `hp` overrides the
 * starting HP (a fled boss keeps its HP until dawn, `LocationState.encounterHp`).
 */
export function enemyCombatant(ctx: StepCtx, creatureId: string, name: string, hp?: number): Combatant {
  const { content } = ctx;
  const def = content.creatures[creatureId];
  if (!def) throw new Error(`combat: unknown creature '${creatureId}'`);
  const nudge = loopNudge(ctx.s, content);
  const agi = def.stats.agi;
  const { config } = content;
  const hpMax = Math.max(1, round(def.stats.hp * nudge));
  return {
    uid: ctx.uid('c'),
    kind: 'enemy',
    refId: creatureId,
    name,
    level: def.level,
    hp: hp === undefined ? hpMax : Math.min(hpMax, Math.max(1, hp)),
    hpMax,
    mp: 0,
    mpMax: 0,
    atk: def.stats.atk * nudge,
    sp: def.stats.sp * nudge,
    armor: def.stats.armor,
    ward: def.stats.ward,
    agi,
    accuracy: config.baseAccuracy + halfAgi(agi),
    evasion: halfAgi(agi),
    crit: Math.min(config.critCap, config.critBase + halfAgi(agi)),
    critMult: config.critMult,
    statuses: [],
    guarding: false,
    initiative: agi + d4(ctx),
    resistances: { ...def.resistances },
    phase: 0,
    pattern: freshPattern(),
    cooldowns: {},
    alive: true,
    fledOrGone: false,
    isAdd: false,
  };
}

/** Display names: "Corrupted Shade A", "Corrupted Shade B" when a creature appears more than once. */
function enemyNames(content: ContentPack, ids: readonly string[]): string[] {
  const total: Record<string, number> = {};
  for (const id of ids) total[id] = (total[id] ?? 0) + 1;
  const seen: Record<string, number> = {};
  return ids.map((id) => {
    const name = content.creatures[id]?.name ?? id;
    if ((total[id] ?? 0) < 2) return name;
    const n = seen[id] ?? 0;
    seen[id] = n + 1;
    return `${name} ${String.fromCharCode(65 + n)}`;
  });
}

// ---- setup ----------------------------------------------------------------------------------------------------------------

/** Appends to the fight's own log (capped). */
export function combatLog(combat: CombatState, text: string, kind: CombatState['log'][number]['kind'] = 'info'): void {
  combat.log.push({ round: combat.round, text, kind });
  if (combat.log.length > COMBAT_LOG_CAP) combat.log.splice(0, combat.log.length - COMBAT_LOG_CAP);
}

/**
 * One watch of the carried DoTs on the player outside a fight (DESIGN §4.5, D-074): each deals `dotDamage` — the rule
 * of a tick in a fight (statuses.ts): the stored tick × stacks when per-stack, the gear resistance step — but never
 * below 1 HP (out-of-combat damage does not kill, D-072), then counts down one; expiry at 0. The one implementation for
 * the clock hook (reducers/loop.ts `tickOutOfCombatStatuses`) and for the watches travelled into a fight (below).
 */
export function tickCarriedWatch(ctx: StepCtx): void {
  const player = ctx.s.player;
  if (!player.statuses.some((st) => CARRIED_STATUSES.includes(st.statusId))) return;
  const d = derive(player, ctx.content);
  const holder = { resistances: playerResistances(d.resistSteps, d.passives), hpMax: player.hpMax, statuses: player.statuses };
  for (const st of player.statuses) {
    if (!CARRIED_STATUSES.includes(st.statusId)) continue;
    const before = player.hp;
    const mult = modifierDamageMult(ctx.s.meta.modifiers, ctx.content, true); // Glass (U31)
    player.hp = Math.max(1, player.hp - (dotDamage(holder, st, ctx.content.statuses[st.statusId], mult)?.amount ?? 0));
    ctx.s.counters.damageTaken += before - player.hp;
    ctx.emit({ t: 'statusTicked', targetUid: 'player', statusId: st.statusId, amount: before - player.hp });
    st.duration -= 1;
  }
  const expired = player.statuses.filter((st) => CARRIED_STATUSES.includes(st.statusId) && st.duration <= 0);
  if (expired.length === 0) return;
  player.statuses = player.statuses.filter((st) => !expired.includes(st));
  for (const st of expired) ctx.emit({ t: 'statusExpired', targetUid: 'player', statusId: st.statusId });
}

/**
 * Watches that passed earlier in this step (travelling into the fight) tick the out-of-combat DoTs before the fight
 * takes them over: the clock hook skips out-of-combat ticks while a fight is on.
 */
function tickWatchesBeforeFight(ctx: StepCtx): void {
  const watches = ctx.events.filter((e) => e.t === 'watchAdvanced').length;
  for (let w = 0; w < watches; w++) tickCarriedWatch(ctx);
}

/**
 * Starts a fight (DESIGN §4.1 Setup): builds the CombatState, rolls initiative, sorts round 1, switches to combat mode
 * (closing a dialogue that started it) and emits `combatStarted`. The fight waits in phase 'start' until the combat
 * reducer runs it (its post-step hook).
 */
export function beginCombat(ctx: StepCtx, spec: EncounterSpec): CombatState {
  const { s, content } = ctx;
  if (s.combat !== null) throw new Error('beginCombat: a fight is already in progress');
  const creatureIds = spec.groups.flatMap((g) => Array.from({ length: g.count }, () => g.creatureId));
  if (creatureIds.length < 1 || creatureIds.length > MAX_ENEMIES) throw new Error(`beginCombat: ${creatureIds.length} enemies (DESIGN §4.8: 1–3)`);
  for (const id of creatureIds) if (!content.creatures[id]) throw new Error(`beginCombat: unknown creature '${id}'`);

  // Out-of-combat statuses: this step's travel ticks first; Rested is consumed (baked into the snapshot); the DoTs
  // move onto the Combatant.
  tickWatchesBeforeFight(ctx);
  const player = s.player;
  const carried = player.statuses.filter((st) => CARRIED_STATUSES.includes(st.statusId));
  const rested = player.statuses.some((st) => st.statusId === RESTED);
  const party: Combatant[] = [playerCombatant(ctx, carried.map((st) => ({ ...st })))];
  player.statuses = player.statuses.filter((st) => !CARRIED_STATUSES.includes(st.statusId) && st.statusId !== RESTED);
  if (rested) ctx.emit({ t: 'statusExpired', targetUid: 'player', statusId: RESTED });
  const companion = companionCombatant(ctx);
  if (companion) party.push(companion);

  const locationId = s.world.currentLocationId;
  const held = s.world.locationStates[locationId]?.encounterHp[spec.id];
  const names = enemyNames(content, creatureIds);
  const enemies = creatureIds.map((id, i) => enemyCombatant(ctx, id, names[i] ?? id, held?.[id]));
  const canFlee = spec.fleeable && creatureIds.every((id) => content.creatures[id]?.fleeable ?? true);

  const combat: CombatState = {
    encounterId: spec.id,
    locationId,
    enemies,
    party,
    turnOrder: [],
    turnIndex: 0,
    round: 1,
    phase: 'start',
    intents: {}, // DESIGN §4.1 Setup: the opening intents are generated when the fight first runs (combat/intents.ts, U25)
    log: [],
    cooldowns: {},
    canFlee,
    onFlee: spec.onFlee,
    fleeAttempts: 0,
    communion: null, // TODO(U29)
    resourceGainedThisTurn: 0,
    onVictory: [...spec.onVictory],
    onDefeat: [...spec.onDefeat],
    onFleeEffects: [...spec.onFleeEffects],
    pendingSelection: null,
  };
  startRound(combat, content);
  s.combat = combat;
  if (s.dialogue !== null) {
    ctx.emit({ t: 'dialogueEnded', sceneId: s.dialogue.sceneId });
    s.dialogue = null;
  }
  enterMode(ctx, 'combat');
  s.counters.fights += 1;
  for (const id of creatureIds) s.counters.seen[id] = (s.counters.seen[id] ?? 0) + 1;
  ctx.emit({ t: 'combatStarted', encounterId: spec.id, enemies: enemies.map((e) => ({ uid: e.uid, creatureId: e.refId })), ambush: spec.ambush });
  if (spec.intro !== undefined) {
    combatLog(combat, spec.intro, 'system');
    ctx.log(spec.intro, 'combat');
  }
  return combat;
}

// ---- order ----------------------------------------------------------------------------------------------------------------

/** Every combatant, party first (player, companion), then enemies by slot. */
export const allCombatants = (combat: CombatState): Combatant[] => [...combat.party, ...combat.enemies];

export const isActive = (c: Combatant): boolean => c.alive && !c.fledOrGone;

export function combatantByUid(combat: CombatState, uid: string): Combatant | undefined {
  return combat.party.find((c) => c.uid === uid) ?? combat.enemies.find((c) => c.uid === uid);
}

/** The player's Combatant (always party[0]). */
export function playerOf(combat: CombatState): Combatant {
  const p = combat.party[0];
  if (!p || p.kind !== 'player') throw new Error('combat: party[0] is not the player');
  return p;
}

/** The kept roll plus live status modifiers (Haste +5, Slow −5 …, DESIGN §4.5). */
export function effectiveInitiative(c: Combatant, content: ContentPack): number {
  return c.initiative + statusMods(c, content).initiative;
}

/**
 * DESIGN §4.1: living combatants by initiative, descending; ties player → companion → enemies by slot. A combatant whose
 * buff says so goes first whatever its initiative (U26b, combat/buffs.ts: Blink Strike's "you act first next round").
 */
export function sortTurnOrder(combat: CombatState, content: ContentPack): string[] {
  const slot = (c: Combatant): number => (c.kind === 'enemy' ? combat.enemies.indexOf(c) : combat.party.indexOf(c));
  return allCombatants(combat)
    .filter(isActive)
    .map((c) => ({ c, init: effectiveInitiative(c, content), first: actsFirst(c) ? 1 : 0 }))
    .sort((a, b) => b.first - a.first || b.init - a.init || KIND_RANK[a.c.kind] - KIND_RANK[b.c.kind] || slot(a.c) - slot(b.c))
    .map((x) => x.c.uid);
}

/** A new round's order (re-sorted, DESIGN §4.1); the round counter is the caller's. */
export function startRound(combat: CombatState, content: ContentPack): void {
  combat.turnOrder = sortTurnOrder(combat, content);
  combat.turnIndex = 0;
}

/** Whose turn it is (undefined once every slot of the round has passed). */
export function currentActor(combat: CombatState): Combatant | undefined {
  const uid = combat.turnOrder[combat.turnIndex];
  return uid === undefined ? undefined : combatantByUid(combat, uid);
}
