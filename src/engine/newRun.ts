// newRun (PLAN §4.11 minimum): the initial GameState of a loop — Day 1 Dawn at the start location, class base stats
// (DESIGN §3.3), starter items, the Amulet carried from Loop 2 (D-047, via `config.startItems`), the challenge
// modifiers toggled in the profile (incl. a `clock_base_watches` rule such as Frayed Clock), and the level
// carry-over of D-067.2 (bestLevel rule D-070.5), and the equipped Attunements (U31, `applyLoopAttunements`). Pure.
// Elsewhere: loop-start Echo effects (U32), gear-derived maxima (U21 `derived.ts`), quests started at the Threshold
// (U31 `newLoop` carries them).
import type { Class } from '@schema/class';
import type { Item } from '@schema/item';
import { TICKS_PER_DAY } from './conditions';
import type { ContentPack } from './ctx';
import { syncMaxima } from './derived';
import { seedFromString } from './rng';
import { attunementEffects, loopAttunements, modifierRules } from './runRules';
import type { Profile } from './types/profile';
import type { EquipSlot, Equipment, GameState, ItemInstance, Rarity } from './types/state';
import { clamp } from './util/math';

/** `GameState.meta.version` written by newRun; saves migrate on it (U22). */
export const STATE_VERSION = 1;
/** DESIGN §10.1 base limit: Day 30 Dawn. */
export const BASE_LIMIT_TICKS = 116;
/** D-067.2: ⌊0.6 × best level⌋, never below 1, capped at 10. */
export const CARRY_OVER_RATIO = 0.6;
export const CARRY_OVER_CAP = 10;

/** The parts of a class record that `baseMaxima` reads. */
export type ClassView = Pick<Class, 'baseStats' | 'growth'>;
/** The parts of an item record that starter-item creation reads. */
export type ItemView = Partial<Pick<Item, 'type' | 'slot' | 'stackable' | 'fixedRarity' | 'fixedAffixes'>>;

export interface NewRunOptions {
  playerName?: string;
}

/** The start level of a new loop (D-067.2): bestLevel = max over every class's mastery (D-070.5), min 1. */
export function carryOverLevel(profile: Readonly<Profile>): number {
  let best = 1;
  for (const mastery of Object.values(profile.classMastery)) best = Math.max(best, mastery.bestLevel);
  return clamp(Math.floor(CARRY_OVER_RATIO * best), 1, CARRY_OVER_CAP);
}

/** DESIGN §3.2 `max_hp` / `max_mp` before gear: base + growth·(level−1) + 2·primary. */
export function baseMaxima(cls: ClassView, level: number): { hpMax: number; mpMax: number } {
  return {
    hpMax: cls.baseStats.hp + cls.growth.hp * (level - 1) + 2 * cls.baseStats.strength,
    mpMax: cls.baseStats.mp + cls.growth.mp * (level - 1) + 2 * cls.baseStats.magic,
  };
}

/** Stackable by default only for consumables and materials (PLAN §5.5). */
export function isStackable(def: ItemView | undefined): boolean {
  return def?.stackable ?? (def?.type === 'consumable' || def?.type === 'material');
}

/** The rarity an item is created with when nothing rolls it: its fixed rarity, else common (rolls: U27/U34). */
export function defaultRarity(def: ItemView | undefined): Rarity {
  return def?.fixedRarity ?? 'common';
}

/**
 * A fresh loop. `seed` is the run seed (`newGame`'s, or `${profileId}:${loopCounter}` for later loops, PLAN §4.11);
 * the loop number is `profile.loopCounter` (min 1). Throws on an unknown class id (callers validate first).
 */
export function newRun(
  seed: string,
  classId: string,
  content: ContentPack,
  profile: Readonly<Profile>,
  opts: NewRunOptions = {},
): GameState {
  const cls = content.classes[classId];
  if (!cls) throw new Error(`newRun: unknown class '${classId}'`);
  const loop = Math.max(1, profile.loopCounter);
  const level = carryOverLevel(profile);
  const { hpMax, mpMax } = baseMaxima(cls, level);
  const name = opts.playerName ?? 'Wayfinder';

  let nextUid = 1;
  const inventory: ItemInstance[] = [];
  const equipment: Equipment = { weapon: null, armor: null, trinket1: null, trinket2: null };
  const make = (itemId: string, qty: number): ItemInstance => {
    const def = content.items[itemId];
    return { uid: `i${nextUid++}`, itemId, qty, rarity: defaultRarity(def), affixes: [...(def?.fixedAffixes ?? [])] };
  };
  const add = (itemId: string, count: number, equip: boolean): void => {
    const def = content.items[itemId];
    if (isStackable(def)) {
      inventory.push(make(itemId, count));
      return;
    }
    for (let i = 0; i < count; i++) {
      const item = make(itemId, 1);
      const slot = equip ? freeSlot(equipment, def?.slot) : null;
      if (slot) equipment[slot] = item;
      else inventory.push(item);
    }
  };
  for (const starter of cls.starterItems ?? []) add(starter.itemId, starter.count ?? 1, starter.equip ?? false);
  for (const start of content.config.startItems ?? []) {
    if (loop >= (start.fromLoop ?? 1)) add(start.itemId, 1, false);
  }

  const modifiers = Object.keys(profile.modifiers)
    .filter((id) => profile.modifiers[id])
    .sort();
  let limitTicks = content.config.clock?.baseLimitTicks ?? BASE_LIMIT_TICKS;
  for (const id of modifiers) {
    for (const rule of content.modifiers[id]?.rules ?? []) {
      if (rule.kind === 'clock_base_watches' && rule.watches !== undefined) limitTicks = rule.watches;
    }
  }

  const start = content.config.startLocationId;
  const s: GameState = {
    meta: {
      seed,
      loop,
      version: STATE_VERSION,
      stepCount: 0,
      nextUid,
      runId: `${seed}:${loop}`,
      modifiers,
      playerName: name,
    },
    clock: { ticks: 0, limitTicks, modifiers: [], frozen: false, expired: false },
    before: null,
    player: {
      name,
      classId,
      level,
      xp: 0,
      stats: { strength: cls.baseStats.strength, magic: cls.baseStats.magic, agility: cls.baseStats.agility },
      hp: hpMax,
      hpMax,
      mp: mpMax,
      mpMax,
      gold: cls.startingGold ?? 30,
      corruption: 0,
      inventory,
      equipment,
      abilitiesUnlocked: [...(cls.startingAbilities ?? [])],
      // 1 AP (2 half-points) per level including level 1; +1 stat point per level-up (DESIGN §6.3, D-067.2).
      apHalf: 2 * level,
      statPoints: level - 1,
      statuses: [],
      uses: {},
      stance: 'guarded',
      passiveBonuses: {},
    },
    companions: { recruited: {}, activeId: null },
    world: {
      currentLocationId: start,
      previousLocationId: null,
      locationStates: {},
      discovered: [start],
      pendingEncounters: {},
      npcOverrides: {},
      hordeActive: false,
      hordeDelay: 0,
      infected: [],
      hordePending: {},
      hordeCause: null,
      heartstone: 'intact',
      tyrant: 'waiting',
      gather: {},
    },
    quests: {},
    flags: {},
    reputation: { remnants: 0, weavers: 0, ironclad: 0 },
    echoesThisLoop: [],
    combat: null,
    dialogue: null,
    merchants: {},
    rng: seedFromString(seed),
    counters: {
      kills: {},
      seen: {},
      damageDealt: 0,
      damageTaken: 0,
      damageBySource: {},
      abilitiesUsed: {},
      itemsCrafted: 0,
      itemsUpgraded: 0,
      goldEarned: 0,
      goldSpent: 0,
      fights: 0,
      fightsWon: 0,
      fled: 0,
      rests: 0,
      travels: 0,
      questsCompleted: 0,
      questsFailed: 0,
      echoesGainedThisLoop: 0,
      deathsThisLoop: 0,
      custom: {},
    },
    pendingEnding: null,
    mode: 'explore',
    recentLog: [],
    threshold: null,
  };
  applyLoopAttunements(s, content, loopAttunements(profile, content, modifiers), (itemId, count) => add(itemId, count, false));
  s.meta.nextUid = nextUid;
  return s;
}

/**
 * DESIGN §10.7 at loop start (engine/runRules.ts lists where every other effect acts): the run's Attunements are
 * recorded on the player; starting gold, items (`addItem`), stat points as passive bonuses, ability points, the Breach
 * Clock (Frayed Clock halves it toward zero, DESIGN §10.1; recorded in `clock.modifiers`), a revealed region; then the
 * stored maxima follow `derive()` (Steady Hand, Deep Well) with full HP/MP.
 */
function applyLoopAttunements(s: GameState, content: ContentPack, ids: readonly string[], addItem: (itemId: string, count: number) => void): void {
  if (ids.length === 0) return;
  const p = s.player;
  p.attunements = [...ids];
  const halve = modifierRules(s.meta.modifiers, content, 'clock_base_watches').some((r) => r.halveOthers);
  for (const { attunementId, effect } of attunementEffects(p, content)) {
    switch (effect.kind) {
      case 'start_gold':
        p.gold += effect.amount;
        break;
      case 'start_item':
        addItem(effect.itemId, effect.count);
        break;
      case 'stat':
        p.passiveBonuses[effect.stat] = (p.passiveBonuses[effect.stat] ?? 0) + effect.amount;
        break;
      case 'ability_points':
        p.apHalf += 2 * effect.amount;
        break;
      case 'clock_watches': {
        const watches = halve ? Math.trunc(effect.watches / 2) : effect.watches;
        if (watches === 0) break;
        s.clock.limitTicks = Math.max(s.clock.limitTicks + watches, TICKS_PER_DAY * content.config.clock.floorDawns); // the floor at Day 1
        s.clock.modifiers.push({ source: attunementId, watches });
        break;
      }
      case 'reveal_region':
        for (const id of content.index.locationsByRegion[effect.regionId] ?? []) if (!s.world.discovered.includes(id)) s.world.discovered.push(id);
        break;
      default:
        break; // read where they act (derive, XP, combat, explore — runRules.ts)
    }
  }
  syncMaxima(p, content);
  p.hp = p.hpMax;
  p.mp = p.mpMax;
}

function freeSlot(equipment: Equipment, slot: ItemView['slot']): EquipSlot | null {
  if (slot === 'weapon' || slot === 'armor') return equipment[slot] ? null : slot;
  if (slot === 'trinket') return !equipment.trinket1 ? 'trinket1' : !equipment.trinket2 ? 'trinket2' : null;
  return null;
}
