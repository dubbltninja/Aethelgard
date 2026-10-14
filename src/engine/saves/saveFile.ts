// Run saves (PLAN §4.12, DESIGN §14): `serialize` wraps a GameState in a versioned envelope, `deserialize` takes any
// parsed value or file text back to a GameState — size guard, JSON, migration chain, strict zod schema, then a check
// of the state against the content pack. Failures are `{ error }` with the field and the reason; nothing throws.
// The engine reads no clock: `savedAt` is passed in by the shell.
import { z } from 'zod';
import type { ContentPack } from '../ctx';
import { dayOf, watchOf } from '../conditions';
import { STATE_VERSION } from '../newRun';
import { GameStateSchema } from '../types/schema';
import type { Profile } from '../types/profile';
import type { GameState, Watch } from '../types/state';
import { clone } from '../util/clone';
import { formatIssues, migrate, parseFileText, type MigrationTable } from './problems';

/** The file-format version. D-058: saves were disposable until the first integration checkpoint; v1 is frozen then. */
export const SAVE_VERSION = 1;

/** What a slot list shows without opening the state. */
export interface SaveSummary {
  classId: string;
  level: number;
  loop: number;
  day: number;
  watch: Watch;
  locationId: string;
  /** `Loop 2 · Day 11 · Ironclad Camp`. */
  title: string;
  /** Actions accepted so far (the engine has no clock; this stands in for playtime). */
  playtimeSteps: number;
}

export interface SaveFile {
  kind: 'run';
  version: number;
  seed: string;
  /** `ContentPack.version` at save time, for diagnostics. */
  contentVersion: string;
  /** `profile.loopCounter` when the save was written; an older run may be loaded, endLoop keeps the counter rising. */
  profileLoopAtSave: number;
  /** Caller-supplied timestamp (ISO-8601 by convention); never read from a clock in the engine. */
  savedAt: string;
  savedStep: number;
  summary: SaveSummary;
  state: GameState;
}

const int = z.number().int();
export const SaveSummarySchema: z.ZodType<SaveSummary> = z
  .object({
    classId: z.string(),
    level: int.min(1),
    loop: int.min(1),
    day: int.min(1),
    watch: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    locationId: z.string(),
    title: z.string(),
    playtimeSteps: int.min(0),
  })
  .strict();

export const SaveFileSchema: z.ZodType<SaveFile> = z
  .object({
    kind: z.literal('run'),
    version: z.literal(SAVE_VERSION),
    seed: z.string(),
    contentVersion: z.string(),
    profileLoopAtSave: int.min(1),
    savedAt: z.string().min(1),
    savedStep: int.min(0),
    summary: SaveSummarySchema,
    state: GameStateSchema,
  })
  .strict();

/** Upgrades v → v + 1 for run saves. Empty: v1 is the first format that ever shipped (D-058). */
export const migrations: MigrationTable = {};

// ---- serialize -------------------------------------------------------------------------------------------------------

export function summarize(state: GameState, content: ContentPack): SaveSummary {
  const day = dayOf(state.clock.ticks);
  const place = state.mode === 'threshold' ? 'The Threshold' : (content.locations[state.world.currentLocationId]?.name ?? state.world.currentLocationId);
  return {
    classId: state.player.classId,
    level: state.player.level,
    loop: state.meta.loop,
    day,
    watch: watchOf(state.clock.ticks),
    locationId: state.world.currentLocationId,
    title: `Loop ${state.meta.loop} · Day ${day} · ${place}`,
    playtimeSteps: state.meta.stepCount,
  };
}

/** The save envelope for `state`; the state is copied, so the file never aliases the live game. */
export function serialize(state: GameState, profile: Readonly<Pick<Profile, 'loopCounter'>>, content: ContentPack, savedAt: string): SaveFile {
  return {
    kind: 'run',
    version: SAVE_VERSION,
    seed: state.meta.seed,
    contentVersion: content.version,
    profileLoopAtSave: profile.loopCounter,
    savedAt,
    savedStep: state.meta.stepCount,
    summary: summarize(state, content),
    state: clone(state),
  };
}

// ---- deserialize -----------------------------------------------------------------------------------------------------

export interface LoadedRun {
  state: GameState;
  /** The file version the save was upgraded from, or null if it was already current. */
  migratedFrom: number | null;
  /** Things dropped or noted while checking the state against the content pack (DESIGN §14.4). */
  warnings: string[];
  /** The validated, migrated file (its `state` is `state`): summary, `profileLoopAtSave`, `savedAt`. */
  file: SaveFile;
}
export type DeserializeResult = LoadedRun | { error: string };

export interface DeserializeOptions {
  /** Test seam: a different migration table (default: `migrations`). */
  migrations?: MigrationTable;
}

/**
 * Validates and migrates a save: `json` is file text, or the value `JSON.parse` produced (the `load` action carries
 * the latter). The input is never mutated.
 */
export function deserialize(json: unknown, content: ContentPack, opts: DeserializeOptions = {}): DeserializeResult {
  let raw = json;
  if (typeof raw === 'string') {
    const parsed = parseFileText(raw, 'Save');
    if (!parsed.ok) return { error: parsed.error };
    raw = parsed.value;
  }
  const migrated = migrate(raw, SAVE_VERSION, opts.migrations ?? migrations, 'save');
  if (!migrated.ok) return { error: `Save rejected: ${migrated.error}` };

  const kind = migrated.value.kind;
  if (kind === 'profile') return { error: 'Save rejected: this is a profile file, not a run save (import it as a profile)' };

  const parsed = SaveFileSchema.safeParse(migrated.value);
  if (!parsed.success) return { error: `Save rejected: ${formatIssues(parsed.error.issues)}` };
  const file = parsed.data;

  if (file.seed !== file.state.meta.seed) {
    return { error: `Save rejected: seed: ${JSON.stringify(file.seed)} does not match state.meta.seed ${JSON.stringify(file.state.meta.seed)}` };
  }
  if (file.state.meta.version !== STATE_VERSION) {
    return { error: `Save rejected: state.meta.version: expected ${STATE_VERSION}, got ${file.state.meta.version} (the state layout is not this build's)` };
  }
  const checked = reconcile(file, content);
  if (typeof checked === 'string') return { error: `Save rejected: ${checked}` };
  return { state: file.state, migratedFrom: migrated.migratedFrom, warnings: checked, file };
}

// ---- content check ---------------------------------------------------------------------------------------------------

/**
 * Checks the state against the content pack (DESIGN §14.4). A class or current location the pack does not have is
 * fatal (the run cannot continue), returned as the error text; references that can be dropped (an item, ability or
 * quest removed in a later build) are dropped from `file.state` and listed as warnings, as the legacy loader did.
 */
function reconcile(file: SaveFile, content: ContentPack): string | string[] {
  const s = file.state;
  if (content.classes[s.player.classId] === undefined) return `state.player.classId: class '${s.player.classId}' is not in this version of the game`;
  if (content.locations[s.world.currentLocationId] === undefined) {
    return `state.world.currentLocationId: location '${s.world.currentLocationId}' is not in this version of the game`;
  }
  const warnings: string[] = [];
  if (file.contentVersion !== content.version) {
    warnings.push(`saved with content ${file.contentVersion}; this build has ${content.version}`);
  }
  const keep = <T extends { itemId: string }>(items: T[], where: string): T[] =>
    items.filter((it) => {
      if (content.items[it.itemId] !== undefined) return true;
      warnings.push(`dropped unknown item '${it.itemId}' (${where})`);
      return false;
    });

  s.player.inventory = keep(s.player.inventory, 'inventory');
  for (const slot of ['weapon', 'armor', 'trinket1', 'trinket2'] as const) {
    const worn = s.player.equipment[slot];
    if (worn && content.items[worn.itemId] === undefined) {
      warnings.push(`dropped unknown item '${worn.itemId}' (equipped ${slot})`);
      s.player.equipment[slot] = null;
    }
  }
  for (const [id, loc] of Object.entries(s.world.locationStates)) loc.items = keep(loc.items, `on the ground at ${id}`);
  for (const [id, merchant] of Object.entries(s.merchants)) merchant.stock = keep(merchant.stock, `${id}'s stock`);

  s.player.abilitiesUnlocked = s.player.abilitiesUnlocked.filter((id) => {
    if (content.abilities[id] !== undefined) return true;
    warnings.push(`dropped unknown ability '${id}'`);
    return false;
  });
  for (const id of Object.keys(s.quests)) {
    if (content.quests[id] === undefined) {
      warnings.push(`dropped unknown quest '${id}'`);
      delete s.quests[id];
    }
  }
  if (s.world.previousLocationId !== null && content.locations[s.world.previousLocationId] === undefined) {
    warnings.push(`forgot the previous location '${s.world.previousLocationId}' (not in this version of the game)`);
    s.world.previousLocationId = null;
  }
  return warnings;
}

// ---- text in / out (export, import) ----------------------------------------------------------------------------------

/** Export text: the pretty-printed save file (DESIGN §14.3). */
export function exportRun(state: GameState, profile: Readonly<Pick<Profile, 'loopCounter'>>, content: ContentPack, savedAt: string): string {
  return JSON.stringify(serialize(state, profile, content, savedAt), null, 2);
}

/** Import text: `deserialize` over file text. */
export function importRun(text: string, content: ContentPack, opts: DeserializeOptions = {}): DeserializeResult {
  return deserialize(text, content, opts);
}
