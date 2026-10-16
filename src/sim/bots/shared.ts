// Shared bot helpers (PLAN §7.1): map search over the pack's exits, the player's condition, equipment scoring, damage
// estimates from ability data, quest hints and the Apex. Pure readers of (state, content, profile); no randomness here
// except `botRng`, which hands each bot its own seeded stream (never Math.random / Date.now; D-032).
//
// Signatures follow PLAN §7.1 with one addition: helpers that read exit states take the profile too (`exitState` needs
// it for Echo-gated routes).
import {
  APEX_LOCATION_ID,
  BEFORE_REGION_ID,
  Rng,
  evaluate,
  exitState,
  isActive,
  itemStats,
  playerOf,
  questJournal,
  type Action,
  type ActionType,
  type Combatant,
  type ContentPack,
  type DamageType,
  type GameState,
  type ItemInstance,
  type Profile,
} from '@engine/index';
import { canonicalJson } from '@engine/util/hash';
import type { Ability } from '@schema/ability';
import type { BotMemory } from './types';

// ---- actions ---------------------------------------------------------------------------------------------------------------

/** The shell's actions (PLAN §7.2): the runner plays them for the title and FALLEN screens; bots never pick them. */
export const SHELL_ACTIONS: ReadonlySet<ActionType> = new Set<ActionType>(['newGame', 'load', 'save', 'returnToTitle']);

export const isShellAction = (a: Action): boolean => SHELL_ACTIONS.has(a.type);

/** Structural identity of an action (key order does not matter): what "the same action" means for the runner's check. */
export const actionKey = (a: Action): string => canonicalJson(a);

/** The first listed action of `type`, if any. */
export function firstOf<K extends ActionType>(legal: readonly Action[], type: K): Extract<Action, { type: K }> | undefined {
  return legal.find((a): a is Extract<Action, { type: K }> => a.type === type);
}

/** Every listed action of `type`. */
export function allOf<K extends ActionType>(legal: readonly Action[], type: K): Extract<Action, { type: K }>[] {
  return legal.filter((a): a is Extract<Action, { type: K }> => a.type === type);
}

/** The bot's own stream, created on first use from its seed and kept in memory (it survives reloads). */
export function botRng(memory: BotMemory, seed: string): Rng {
  const have = memory['rng'];
  if (have instanceof Rng) return have;
  const rng = Rng.fromSeed(seed);
  memory['rng'] = rng;
  return rng;
}

// ---- the player ------------------------------------------------------------------------------------------------------------

/** Current HP over max HP: the fight's combatant in a fight, the stored values outside one. */
export function healthFraction(s: GameState): number {
  const c = s.combat === null ? null : playerOf(s.combat);
  const [hp, max] = c !== null ? [c.hp, c.hpMax] : [s.player.hp, s.player.hpMax];
  return max > 0 ? hp / max : 0;
}

/** Current MP over max MP (1 for a class without MP). */
export function manaFraction(s: GameState): number {
  const c = s.combat === null ? null : playerOf(s.combat);
  const [mp, max] = c !== null ? [c.mp, c.mpMax] : [s.player.mp, s.player.mpMax];
  return max > 0 ? mp / max : 1;
}

/** HP a consumable restores (`onUse` `heal.hp`); 0 for anything else. */
export function healAmount(content: ContentPack, itemId: string): number {
  const def = content.items[itemId];
  if (def === undefined || def.type !== 'consumable') return 0;
  let hp = 0;
  for (const e of def.onUse) if ('heal' in e && typeof e.heal.hp === 'number') hp = Math.max(hp, e.heal.hp);
  return hp;
}

/** Healing consumables carried (stack quantities summed). */
export function healingCarried(s: GameState, content: ContentPack): number {
  return s.player.inventory.filter((i) => healAmount(content, i.itemId) > 0).reduce((n, i) => n + i.qty, 0);
}

/** The item instance `uid`: in the pack, equipped, on the ground here, or in a merchant's stock. */
export function itemOf(s: GameState, uid: string): ItemInstance | undefined {
  const equipped = Object.values(s.player.equipment).find((i): i is ItemInstance => i?.uid === uid);
  return (
    s.player.inventory.find((i) => i.uid === uid) ??
    equipped ??
    s.world.locationStates[s.world.currentLocationId]?.items.find((i) => i.uid === uid) ??
    Object.values(s.merchants)
      .flatMap((m) => m.stock)
      .find((i) => i.uid === uid)
  );
}

/** The class's primary stat: its highest base stat (strength, then magic, then agility on a tie). */
export function primaryStat(content: ContentPack, classId: string): 'strength' | 'magic' | 'agility' {
  const b = content.classes[classId]?.baseStats;
  if (b === undefined) return 'strength';
  if (b.strength >= b.magic && b.strength >= b.agility) return 'strength';
  return b.magic >= b.agility ? 'magic' : 'agility';
}

/**
 * A gear piece's worth to `classId` (higher is better): its rarity-scaled stats weighted toward the class's primary stat
 * (physical classes value power and strength, casters spell power and magic), plus a point per affix. Gear the class may
 * not wear scores −Infinity. A heuristic for "does this improve on what is equipped", not a balance model.
 */
export function scoreEquipment(content: ContentPack, item: Pick<ItemInstance, 'itemId' | 'rarity' | 'affixes'>, classId: string): number {
  const def = content.items[item.itemId];
  if (def === undefined || def.slot === undefined) return Number.NEGATIVE_INFINITY;
  const allowed = def.requirements?.classIds;
  if (allowed !== undefined && !(allowed as readonly string[]).includes(classId)) return Number.NEGATIVE_INFINITY;
  const st = itemStats(def, item.rarity, content);
  const caster = primaryStat(content, classId) === 'magic';
  return (
    st.power * (caster ? 1 : 3) +
    st.spellPower * (caster ? 3 : 0.5) +
    st.armor * 2 +
    st.ward * 1.5 +
    st.strength * (caster ? 0.5 : 2) +
    st.magic * (caster ? 2 : 0.5) +
    st.agility +
    st.hpMax * 0.15 +
    st.mpMax * (caster ? 0.15 : 0.05) +
    st.hpMaxPct * 50 +
    st.crit * 0.5 +
    (st.accuracy + st.evasion) * 0.3 +
    st.initiative * 0.2 +
    item.affixes.length
  );
}

// ---- the map ---------------------------------------------------------------------------------------------------------------

export interface PathOptions {
  /** Also walk exits that are locked now (a route to plan for, not to walk). */
  allowLocked?: boolean;
  /** Locations never passed through (the goal itself is the caller's decision and is always allowed). */
  avoid?: (locationId: string) => boolean;
}

/**
 * Shortest routes from `from` over visible exits (open ones; locked ones too with `allowLocked`), as a map
 * location → the path to it (excluding `from`). Silverwood Before and the Threshold are never passed through
 * (their own rules); BFS in exit order, so ties break by the pack's authored order.
 */
export function routes(s: GameState, content: ContentPack, profile: Profile, from: string, opts: PathOptions = {}, goal?: string): Map<string, string[]> {
  const special = (id: string): boolean => {
    const region = content.locations[id]?.regionId;
    return region === BEFORE_REGION_ID || region === 'region_threshold';
  };
  const out = new Map<string, string[]>();
  const queue: string[] = [from];
  const prev = new Map<string, string>();
  const seen = new Set([from]);
  while (queue.length > 0) {
    const here = queue.shift() as string;
    if (here !== from) {
      const path: string[] = [];
      for (let at = here; at !== from; at = prev.get(at) as string) path.unshift(at);
      out.set(here, path);
      if (here === goal) return out;
      if (opts.avoid?.(here) === true || special(here)) continue; // reachable, but never walked through
    }
    for (const exit of content.locations[here]?.exits ?? []) {
      if (seen.has(exit.to) || content.locations[exit.to] === undefined) continue;
      const st = exitState(s, content, profile, here, exit);
      if (st === 'hidden' || (st === 'locked' && opts.allowLocked !== true)) continue;
      if (special(exit.to) && exit.to !== goal) continue;
      seen.add(exit.to);
      prev.set(exit.to, here);
      queue.push(exit.to);
    }
  }
  return out;
}

/** PLAN §7.1 `bfsPath`: the locations after `from` on a shortest route to `to`, `[]` when already there, null if none. */
export function bfsPath(s: GameState, content: ContentPack, profile: Profile, from: string, to: string, opts: PathOptions = {}): string[] | null {
  if (from === to) return [];
  return routes(s, content, profile, from, opts, to).get(to) ?? null;
}

/** The level band of a location: its own, else its region's. */
export function levelBand(content: ContentPack, locationId: string): { min: number; max: number } | undefined {
  const loc = content.locations[locationId];
  if (loc === undefined) return undefined;
  return loc.levelBand ?? content.regions[loc.regionId]?.levelBand;
}

/** True if the location has been entered this loop. */
export const visitedThisLoop = (s: GameState, locationId: string): boolean => s.world.locationStates[locationId]?.visited === true;

/** PLAN §7.1 `nearestUnvisited`: the closest location not yet entered this loop that passes `filter`, with its path. */
export function nearestUnvisited(
  s: GameState,
  content: ContentPack,
  profile: Profile,
  filter: (locationId: string) => boolean = () => true,
  opts: PathOptions = {},
): { id: string; path: string[] } | null {
  for (const [id, path] of routes(s, content, profile, s.world.currentLocationId, opts)) {
    if (!visitedThisLoop(s, id) && filter(id)) return { id, path };
  }
  return null;
}

/** The closest location (by route length, here first) that passes `pred`, with its path. */
export function nearestWhere(
  s: GameState,
  content: ContentPack,
  profile: Profile,
  pred: (locationId: string) => boolean,
  opts: PathOptions = {},
): { id: string; path: string[] } | null {
  const here = s.world.currentLocationId;
  if (pred(here)) return { id: here, path: [] };
  for (const [id, path] of routes(s, content, profile, here, opts)) if (pred(id)) return { id, path };
  return null;
}

/** True if a rest spot at `locationId` is usable now (its `when`); none while a Horde runs. */
export function restAvailable(s: GameState, content: ContentPack, profile: Profile, locationId: string): boolean {
  const rest = content.locations[locationId]?.rest;
  if (rest === undefined || s.world.hordeActive) return false;
  return rest.when === undefined || evaluate(rest.when, s, profile, content);
}

/** PLAN §7.1 `questHints`: the hint locations of the active quests' open objectives, in journal order, deduplicated. */
export function questHints(s: GameState, content: ContentPack): string[] {
  const out: string[] = [];
  for (const entry of questJournal(s, content)) {
    if (entry.status !== 'active') continue;
    for (const o of entry.objectives) {
      if (o.done || o.hintLocationId === undefined || out.includes(o.hintLocationId)) continue;
      if (content.locations[o.hintLocationId] !== undefined) out.push(o.hintLocationId);
    }
  }
  return out;
}

/** Every active quest's stage and done objectives, as one string: changes exactly when quest progress does. */
export function questSignature(s: GameState): string {
  return Object.keys(s.quests)
    .sort()
    .map((id) => {
      const q = s.quests[id];
      return q === undefined ? id : `${id}:${q.status}:${q.stage}:${q.objectivesDone.length}`;
    })
    .join('|');
}

/** PLAN §7.1 `canReachApex`: an open route (under `opts`) from here to the Apex. */
export function canReachApex(s: GameState, content: ContentPack, profile: Profile, opts: PathOptions = {}): boolean {
  return content.locations[APEX_LOCATION_ID] !== undefined && bfsPath(s, content, profile, s.world.currentLocationId, APEX_LOCATION_ID, opts) !== null;
}

/**
 * The highest creature level among the fights a location would start now (its encounters whose `when` holds and that are
 * not cleared this loop); 0 if none would.
 */
export function locationThreat(s: GameState, content: ContentPack, profile: Profile, locationId: string): number {
  const loc = content.locations[locationId];
  if (loc === undefined) return 0;
  const cleared = s.world.locationStates[locationId]?.encountersCleared ?? [];
  let level = 0;
  for (const enc of loc.encounters) {
    if (cleared.includes(enc.id) || (enc.when !== undefined && !evaluate(enc.when, s, profile, content))) continue;
    for (const g of enc.groups) level = Math.max(level, content.creatures[g.creatureId]?.level ?? 0);
  }
  return level;
}

// ---- combat ------------------------------------------------------------------------------------------------------------------

/** PLAN §7.1 `enemyWeakness`: the damage types a creature takes extra damage from. */
export function enemyWeakness(content: ContentPack, creatureId: string): DamageType[] {
  const res = content.creatures[creatureId]?.resistances ?? {};
  return (Object.keys(res) as DamageType[]).filter((t) => res[t] === 'weak').sort();
}

/** The standing enemies of the current fight. */
export function foesOf(s: GameState): Combatant[] {
  return s.combat === null ? [] : s.combat.enemies.filter(isActive);
}

/** The ability an `ability` action uses, if the pack has it. */
export const abilityOf = (content: ContentPack, a: Action): Ability | undefined => (a.type === 'ability' ? content.abilities[a.abilityId] : undefined);

/**
 * Damage a strike promises by the numbers (no variance, armor or resistances): a basic attack is ATK; an ability is
 * `(base + coef · ATK|SP) × hits` (the better of `maxOf` too), × the number of standing foes for an area ability.
 * 0 for anything that does not hit.
 */
export function expectedDamage(content: ContentPack, me: Combatant, a: Action, foes: number): number {
  if (a.type === 'attack') return me.atk;
  const ab = abilityOf(content, a);
  if (ab?.power === undefined) return 0;
  const p = ab.power;
  const stat = (k: 'atk' | 'sp'): number => (k === 'sp' ? me.sp : me.atk);
  let per = p.base + p.coef * stat(p.stat);
  if (p.maxOf !== undefined) per = Math.max(per, p.maxOf.base + p.maxOf.coef * stat(p.maxOf.stat));
  return per * p.hits * (ab.target === 'all_enemies' ? Math.max(1, foes) : 1);
}

/**
 * PLAN §7.1 `bestAffordableAbility`: among the listed `ability` actions (affordable and off cooldown by construction)
 * whose ability passes `filter`, the one promising the most damage (ties: fewer MP, then list order); null if none hits.
 */
export function bestAffordableAbility(
  s: GameState,
  content: ContentPack,
  legal: readonly Action[],
  filter: (ability: Ability) => boolean = () => true,
): Action | null {
  if (s.combat === null) return null;
  const me = playerOf(s.combat);
  const foes = foesOf(s).length;
  let best: { a: Action; dmg: number; mp: number } | null = null;
  for (const a of legal) {
    const ab = abilityOf(content, a);
    if (ab === undefined || !filter(ab)) continue;
    const dmg = expectedDamage(content, me, a, foes);
    if (dmg <= 0) continue;
    if (best === null || dmg > best.dmg || (dmg === best.dmg && ab.mp < best.mp)) best = { a, dmg, mp: ab.mp };
  }
  return best?.a ?? null;
}

/** The uid a combat action aims at (`attack`/`ability`/`item` targets), if any. */
export function targetOf(a: Action): string | undefined {
  return a.type === 'attack' || a.type === 'ability' || a.type === 'item' || a.type === 'companionCommand' ? a.targetUid : undefined;
}

// ---- U38 additions (append-only; nothing above changes) --------------------------------------------------------------------

/** A fight a location would start now (its encounters whose `when` holds and that are not cleared or scattered this loop). */
export interface PendingFight {
  encounterId: string;
  /** The strongest creature in it. */
  level: number;
  boss: boolean;
  /** False for a boss or story gate (`fleeable: false`, D-066 #11). */
  fleeable: boolean;
  /** Some creature in it can be talked down (a `communion` spec; DESIGN §4.11, Loop 2+). */
  communion: boolean;
}

/** The fights `locationId` would start now, in the pack's order (see `locationThreat`, which reads the highest level). */
export function pendingFights(s: GameState, content: ContentPack, profile: Profile, locationId: string): PendingFight[] {
  const loc = content.locations[locationId];
  if (loc === undefined) return [];
  const state = s.world.locationStates[locationId];
  const out: PendingFight[] = [];
  for (const enc of loc.encounters) {
    if (state?.encountersCleared.includes(enc.id) === true || state?.scattered.includes(enc.id) === true) continue;
    if (enc.when !== undefined && !evaluate(enc.when, s, profile, content)) continue;
    let level = 0;
    let boss = false;
    let communion = false;
    for (const g of enc.groups) {
      const c = content.creatures[g.creatureId];
      level = Math.max(level, c?.level ?? 0);
      boss ||= c?.role === 'boss';
      communion ||= c?.communion !== undefined;
    }
    out.push({ encounterId: enc.id, level, boss, fleeable: enc.fleeable !== false, communion });
  }
  return out;
}

/** True if `c` carries status `statusId`. */
export const hasStatus = (c: Pick<Combatant, 'statuses'>, statusId: string): boolean => c.statuses.some((x) => x.statusId === statusId);

/** True if the ability applies status `statusId` (to anyone). */
export const appliesStatus = (ab: Ability, statusId: string): boolean => ab.statuses.some((x) => x.status === statusId);

/** A creature's resistance to a damage type (the combatant's own table first, then the creature's authored one). */
export function resistanceOf(content: ContentPack, foe: Combatant, type: DamageType): 'weak' | 'neutral' | 'resist' | 'immune' {
  return foe.resistances[type] ?? content.creatures[foe.refId]?.resistances?.[type] ?? 'neutral';
}

/** The fraction of `part` in `whole` (1 when `whole` is 0). */
export const fractionOf = (part: number, whole: number): number => (whole > 0 ? part / whole : 1);

/** `a` before `b` by id (a stable, language-neutral tiebreak). */
export const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The first step of `path` as a listed `move`, if there is one. */
export function stepAlong(legal: readonly Action[], path: readonly string[] | null | undefined): Action | undefined {
  const to = path?.[0];
  return to === undefined ? undefined : legal.find((a) => a.type === 'move' && a.to === to);
}
