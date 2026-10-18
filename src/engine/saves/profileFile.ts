// The profile file (PLAN §4.3, §4.12, DESIGN §14.1): the persistent layer that survives every run, stored apart from
// the run slots (D-034). Same discipline as run saves: a versioned envelope, a strict zod schema, a migration chain,
// readable errors. The settings mirror is a second, tiny copy of `profile.settings` so a corrupt profile still
// restores accessibility settings (PLAN §4.12).
import { z } from 'zod';
import type { Profile, Settings } from '../types/profile';
import { clone } from '../util/clone';
import { formatIssues, migrate, parseFileText, type MigrationTable } from './problems';

export const PROFILE_VERSION = 1;

export interface ProfileFile {
  kind: 'profile';
  version: number;
  profile: Profile;
}

const num = z.number().finite();
const int = z.number().int();
const strs = z.array(z.string());
const unit = num.min(0).max(1);

export const SettingsSchema: z.ZodType<Settings> = z
  .object({
    textScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
    highContrast: z.boolean(),
    reducedMotion: z.enum(['system', 'on', 'off']),
    volumes: z.object({ master: unit, ambient: unit, sfx: unit, music: unit }).strict(),
    muted: z.boolean(),
    autosave: z.boolean(),
    showIntentNumbers: z.boolean(),
    confirmFlee: z.boolean(),
    logLength: z.union([z.literal(50), z.literal(100), z.literal(200)]),
  })
  .strict();

const RunRecordSchema = z
  .object({
    runId: z.string(),
    seed: z.string(),
    loop: int,
    classId: z.string(),
    outcome: z.string(),
    reason: z.enum(['death', 'expiry', 'rejected', 'released']).optional(),
    daysUsed: int,
    level: int,
    echoesGained: strs,
    questsCompleted: strs,
    tyrant: z.enum(['defeated', 'spared', 'untouched']),
    heartstone: z.string(),
    modifiers: strs,
    summary: z.string(),
  })
  .strict();

export const ProfileSchema: z.ZodType<Profile> = z
  .object({
    version: int.min(0),
    profileId: z.string(),
    echoes: strs,
    codexUnlocked: strs,
    bestiary: z.record(
      z.string(),
      z.object({ seen: int, killed: int, spared: int, revealed: z.enum(['none', 'resist', 'pattern', 'all']), intentsSeen: strs }).strict(),
    ),
    achievements: z.record(z.string(), z.object({ loop: int, day: int, runId: z.string() }).strict()),
    resonance: num,
    resonanceEarnedTotal: num,
    attunements: z.object({ owned: strs, equipped: strs }).strict(),
    classMastery: z.record(
      z.string(),
      z.object({ loopsPlayed: int, mastered: strs, endings: strs, bestLevel: int, bestDays: int.nullable() }).strict(),
    ),
    runHistory: z.array(RunRecordSchema).max(200),
    settings: SettingsSchema,
    modifiers: z.record(z.string(), z.boolean()),
    mapKnowledge: strs,
    discoveries: strs,
    endingsReached: strs,
    loopCounter: int.min(1),
    newGamePlus: int.min(0),
    lastClassId: z.string().nullable(),
    // U34e (C1 addition): optional, so older profile files parse unchanged
    lastDeathLocation: z.string().optional(),
  })
  .strict();

export const ProfileFileSchema: z.ZodType<ProfileFile> = z
  .object({ kind: z.literal('profile'), version: z.literal(PROFILE_VERSION), profile: ProfileSchema })
  .strict();

/** Upgrades v → v + 1 for the profile file. Empty at v1 (D-058). */
export const profileMigrations: MigrationTable = {};

export function serializeProfile(profile: Profile): ProfileFile {
  return { kind: 'profile', version: PROFILE_VERSION, profile: clone(profile) };
}

export type DeserializeProfileResult = { profile: Profile; migratedFrom: number | null } | { error: string };

/** Validates and migrates a profile file (text, or the parsed value). The input is never mutated. */
export function deserializeProfile(json: unknown, opts: { migrations?: MigrationTable } = {}): DeserializeProfileResult {
  let raw = json;
  if (typeof raw === 'string') {
    const parsed = parseFileText(raw, 'Profile');
    if (!parsed.ok) return { error: parsed.error };
    raw = parsed.value;
  }
  const migrated = migrate(raw, PROFILE_VERSION, opts.migrations ?? profileMigrations, 'profile');
  if (!migrated.ok) return { error: `Profile rejected: ${migrated.error}` };
  if (migrated.value.kind === 'run') return { error: 'Profile rejected: this is a run save, not a profile file (load it into a slot)' };
  const parsed = ProfileFileSchema.safeParse(migrated.value);
  if (!parsed.success) return { error: `Profile rejected: ${formatIssues(parsed.error.issues)}` };
  return { profile: parsed.data.profile, migratedFrom: migrated.migratedFrom };
}

/** Export text: the pretty-printed profile file. */
export function exportProfile(profile: Profile): string {
  return JSON.stringify(serializeProfile(profile), null, 2);
}

export function importProfile(text: string): DeserializeProfileResult {
  return deserializeProfile(text);
}

// ---- settings mirror -------------------------------------------------------------------------------------------------

export interface SettingsMirror {
  kind: 'settings';
  version: number;
  settings: Settings;
}
export const SETTINGS_MIRROR_VERSION = 1;

const SettingsMirrorSchema: z.ZodType<SettingsMirror> = z
  .object({ kind: z.literal('settings'), version: z.literal(SETTINGS_MIRROR_VERSION), settings: SettingsSchema })
  .strict();

/** The text the shell stores under SETTINGS_MIRROR_KEY whenever settings change. */
export function serializeSettingsMirror(settings: Settings): string {
  const mirror: SettingsMirror = { kind: 'settings', version: SETTINGS_MIRROR_VERSION, settings: clone(settings) };
  return JSON.stringify(mirror);
}

export type SettingsMirrorResult = { settings: Settings } | { error: string };

/** Reads the mirror back; a missing or damaged mirror is an `{ error }`, never an exception. */
export function parseSettingsMirror(text: string): SettingsMirrorResult {
  const parsed = parseFileText(text, 'Settings mirror');
  if (!parsed.ok) return { error: parsed.error };
  const result = SettingsMirrorSchema.safeParse(parsed.value);
  return result.success ? { settings: result.data.settings } : { error: `Settings mirror rejected: ${formatIssues(result.error.issues)}` };
}
