// The reducer context (PLAN §4.6): what a reducer may touch during one `step`. A `StepCtx` wraps the draft state
// (a structuredClone, D-065), the profile (read the original until a reducer asks for a draft, then a lazy clone),
// the events sink, a lazy Rng cursor over `state.rng`, and the content pack. `RejectSignal` is how a reducer says
// "illegal action": `step` catches it and returns its inputs unchanged plus one `actionRejected` event (D-043).
import { Rng } from './rng';
import type { FactionId, GameState, LogEntry, Mode, Rarity } from './types/state';
import type { GameEvent } from './types/events';
import type { Profile } from './types/profile';
import { clone } from './util/clone';

// ---- ContentPack: the engine's structural view of PLAN §4.8 ---------------------------------------------------------
// The real `ContentPack` (zod-parsed tables, `src/content/schema/contentPack.ts`) lands in U17. Until then the engine
// is typed against this subset: only the tables and fields U13/U14 read, every field optional where the schema
// supplies a default. The parsed pack is a structural superset, so U17 can replace this block with
// `export type { ContentPack } from '@schema/contentPack'` without touching any reducer.

/** Anything with an optional display name (used by `explain()` and log lines; falls back to the id). */
export interface NamedView {
  name?: string;
}

export interface ClassView extends NamedView {
  baseStats: { hp: number; mp: number; strength: number; magic: number; agility: number };
  growth: { hp: number; mp: number };
  starterItems?: readonly { itemId: string; equip?: boolean; count?: number }[];
  startingAbilities?: readonly string[];
  startingGold?: number;
}

export interface ItemView extends NamedView {
  type?: string;
  slot?: 'weapon' | 'armor' | 'trinket';
  stackable?: boolean;
  maxStack?: number;
  rarityRule?: 'rolled' | 'fixed';
  fixedRarity?: Rarity;
  fixedAffixes?: readonly string[];
}

export interface LocationView extends NamedView {
  regionId: string;
  encounters?: readonly { id: string; once?: boolean; fleeable?: boolean }[];
}

export interface QuestView extends NamedView {
  stages: readonly { id: string; journal?: string }[];
  firstStage?: string;
  /** Contributes to the engine counter `quests_completed` (D-048); default true. */
  countsForApex?: boolean;
}

export interface CompanionView extends NamedView {
  stats: { hp: number };
  startingLoyalty?: number;
}

export interface ModifierView extends NamedView {
  rules?: readonly { kind: string; watches?: number; halveOthers?: boolean }[];
}

export interface ConfigView {
  startLocationId: string;
  /** Amulet of Echoes: carried from Loop 2 (`fromLoop: 2`, D-047). */
  startItems?: readonly { itemId: string; fromLoop?: number }[];
  clock?: { baseLimitTicks?: number; floorDawns?: number };
  /** Lower bound of each reputation tier (D-014): ≤−40 hostile, −39..−10 wary, −9..19 neutral, 20..59, ≥60. */
  repTiers?: { hostile: number; wary: number; neutral: number; trusted: number; sworn: number };
  corruptionMax?: number;
}

export interface ContentPack {
  version: string;
  config: ConfigView;
  classes: Record<string, ClassView>;
  items: Record<string, ItemView>;
  locations: Record<string, LocationView>;
  quests: Record<string, QuestView>;
  companions: Record<string, CompanionView>;
  creatures: Record<string, NamedView>;
  echoes: Record<string, NamedView>;
  codex: Record<string, NamedView>;
  endings: Record<string, NamedView>;
  modifiers: Record<string, ModifierView>;
  factions: Partial<Record<FactionId, NamedView>>;
}

// ---- RejectSignal ----------------------------------------------------------------------------------------------------

/**
 * Thrown by `ctx.reject(reason)`; caught only by `step`, which turns it into `actionRejected` and returns the input
 * references (D-043). Not an `Error`: rejections are normal control flow (bots probe thousands), so no stack capture.
 */
export class RejectSignal {
  constructor(readonly reason: string) {}
}

// ---- StepCtx ---------------------------------------------------------------------------------------------------------

/** Capacity of `GameState.recentLog` (state.ts). */
export const RECENT_LOG_CAP = 100;

export interface StepCtx {
  /** The draft: a structuredClone of the input state. Mutate freely. */
  readonly s: GameState;
  /** Read view of the profile: the draft once `profileDraft()` was called, else the caller's original. Never write it. */
  readonly profile: Readonly<Profile>;
  /** The writable profile; clones the input profile on first call (lazy, D-065). Every profile write goes through it. */
  profileDraft(): Profile;
  readonly content: ContentPack;
  /** The run's Rng, created on first access from `s.rng`; `step` writes its state back on accept. */
  readonly rng: Rng;
  readonly events: GameEvent[];
  emit(event: GameEvent): void;
  /** Appends to `s.recentLog` (capped at RECENT_LOG_CAP) and emits a `log` event. */
  log(text: string, kind?: LogEntry['kind']): void;
  /** Abort the action as illegal. Call it before mutating; `step` discards the draft either way. */
  reject(reason: string): never;
  /** `${prefix}${s.meta.nextUid++}` — the only source of instance ids. */
  uid(prefix: string): string;
}

/** The concrete context `step` builds; `commit()` is for `step` only. */
export class Ctx implements StepCtx {
  readonly events: GameEvent[] = [];
  #profileIn: Profile;
  #profileDraft: Profile | null = null;
  #rng: Rng | null = null;

  constructor(
    readonly s: GameState,
    profile: Profile,
    readonly content: ContentPack,
  ) {
    this.#profileIn = profile;
  }

  get profile(): Readonly<Profile> {
    return this.#profileDraft ?? this.#profileIn;
  }

  profileDraft(): Profile {
    this.#profileDraft ??= clone(this.#profileIn);
    return this.#profileDraft;
  }

  get rng(): Rng {
    this.#rng ??= new Rng(this.s.rng);
    return this.#rng;
  }

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  log(text: string, kind: LogEntry['kind'] = 'narration'): void {
    const log = this.s.recentLog;
    log.push({ step: this.s.meta.stepCount, text, kind });
    if (log.length > RECENT_LOG_CAP) log.splice(0, log.length - RECENT_LOG_CAP);
    this.emit({ t: 'log', text, kind });
  }

  reject(reason: string): never {
    throw new RejectSignal(reason);
  }

  uid(prefix: string): string {
    return `${prefix}${this.s.meta.nextUid++}`;
  }

  /** Writes the Rng back to the draft and returns the output profile: the draft if one was made, else the input. */
  commit(): { profile: Profile; profileCloned: boolean } {
    if (this.#rng) this.s.rng = this.#rng.state();
    return { profile: this.#profileDraft ?? this.#profileIn, profileCloned: this.#profileDraft !== null };
  }
}

/** A context over a draft the caller already cloned (`step` passes `clone(state)`). */
export function makeCtx(draft: GameState, profile: Profile, content: ContentPack): Ctx {
  return new Ctx(draft, profile, content);
}

// ---- Mode transitions (PLAN §4.6 rule 4) -----------------------------------------------------------------------------

/**
 * Allowed `s.mode` changes. PLAN §4.6's list, plus the edges its own rules need: title→threshold (`load` of a
 * Threshold save), explore/threshold→title (`returnToTitle`, §4.7), dialogue→combat (`startCombat` from dialogue,
 * boss talk returning to the fight) and dialogue→ending (an `ending`/`endLoop` effect in a choice).
 */
export const MODE_TRANSITIONS: Readonly<Record<Mode, readonly Mode[]>> = {
  title: ['explore', 'threshold'],
  explore: ['combat', 'dialogue', 'ending', 'title'],
  combat: ['explore', 'dialogue', 'ending'],
  dialogue: ['explore', 'combat', 'threshold', 'ending'],
  ending: ['threshold', 'explore', 'title'],
  threshold: ['explore', 'dialogue', 'title'],
};

/**
 * The only way a reducer changes `s.mode`: validates the edge and emits `modeChanged`. Same mode is a no-op.
 * An edge outside MODE_TRANSITIONS is a programmer error and throws (it is not a rejection).
 */
export function enterMode(ctx: StepCtx, to: Mode): void {
  const from = ctx.s.mode;
  if (from === to) return;
  if (!MODE_TRANSITIONS[from].includes(to)) throw new Error(`enterMode: illegal transition ${from} → ${to}`);
  ctx.s.mode = to;
  ctx.emit({ t: 'modeChanged', from, to });
}
