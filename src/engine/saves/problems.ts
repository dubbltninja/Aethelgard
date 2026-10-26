// Readable errors and the migration chain, shared by run saves and the profile file (PLAN §4.12, DESIGN §14.4).
// An error names the field and says why ("state.player.hp: expected number, got string"), never a bare "invalid".
import type { z } from 'zod';

/** At most this many problems are spelled out; the rest are counted. */
export const MAX_REPORTED_PROBLEMS = 5;

/** `state.player.inventory[2].qty` (an empty path is the file itself). */
export function pathText(path: readonly (string | number)[]): string {
  let out = '';
  for (const seg of path) out += typeof seg === 'number' ? `[${seg}]` : out === '' ? seg : `.${seg}`;
  return out === '' ? '(file)' : out;
}

const quote = (v: unknown): string => (typeof v === 'string' ? JSON.stringify(v) : String(v));

function describe(issue: z.ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined'
        ? `is missing (expected ${issue.expected})`
        : `expected ${issue.expected}, got ${issue.received}`;
    case 'unrecognized_keys':
      return `unknown field${issue.keys.length === 1 ? '' : 's'} ${issue.keys.map((k) => `'${k}'`).join(', ')}`;
    case 'invalid_literal':
      return `expected ${quote(issue.expected)}, got ${quote(issue.received)}`;
    case 'invalid_enum_value':
      return `expected one of ${issue.options.map(quote).join(' | ')}, got ${quote(issue.received)}`;
    case 'invalid_union':
      return 'matches none of the allowed shapes';
    default:
      return issue.message;
  }
}

/** One line per problem, joined with `; `, capped at MAX_REPORTED_PROBLEMS. */
export function formatIssues(issues: readonly z.ZodIssue[]): string {
  const lines = [...new Set(issues.map((i) => `${pathText(i.path)}: ${describe(i)}`))];
  const shown = lines.slice(0, MAX_REPORTED_PROBLEMS).join('; ');
  return lines.length > MAX_REPORTED_PROBLEMS ? `${shown}; and ${lines.length - MAX_REPORTED_PROBLEMS} more` : shown;
}

// ---- Migrations ------------------------------------------------------------------------------------------------------

/** A pure function from a file at version v to a file at v + 1; `migrate` stamps the new `version` itself. */
export type Migration = (old: unknown) => unknown;
/** Keyed by the version it upgrades FROM (`1` upgrades v1 → v2), applied in order until the target. */
export type MigrationTable = Readonly<Record<number, Migration>>;

export type MigrateResult =
  | {
      ok: true;
      value: Record<string, unknown>;
      migratedFrom: number | null;
      /** The file had no `version` at all (a pre-checkpoint file, D-058): it was read as FIRST_FROZEN_VERSION. */
      unversioned?: true;
    }
  | { ok: false; error: string };

/**
 * U79 (D-058): the save format was frozen at the integration checkpoint, and v1 is the first frozen version. Every file
 * the game wrote before that already said `version: 1`; a file with no `version` field at all (hand-made, or from a
 * tool) is read as v1 — `migratedFrom` is then UNVERSIONED — and loads if it has v1's exact shape, which the caller's
 * strict schema decides. Otherwise the caller refuses it with `preCheckpointRefusal`.
 */
export const FIRST_FROZEN_VERSION = 1;
/** `migratedFrom` for a file that carried no `version` field. */
export const UNVERSIONED = 0;

/** The sentence a refused unversioned file gets: what it is, then the first problems the schema found. */
export function preCheckpointRefusal(what: string, problems: string): string {
  return `this ${what} has no version number, so it comes from a build made before the save format was frozen at v${FIRST_FROZEN_VERSION}, and it does not fit that format (${problems})`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Brings a parsed file up to `target`. `what` names the thing in messages ("save", "profile"). The input is never
 * mutated (each step gets a structured clone). A version above `target` is refused with an update hint, a gap in the
 * table with the version that has no migration, a throwing migration with its message. A file with no `version` is
 * read as FIRST_FROZEN_VERSION (see there) and migrated on from it.
 */
export function migrate(raw: unknown, target: number, table: MigrationTable, what: string): MigrateResult {
  if (!isRecord(raw)) return { ok: false, error: `${what} file is not a JSON object (got ${raw === null ? 'null' : Array.isArray(raw) ? 'an array' : typeof raw})` };
  const unversioned = raw.version === undefined;
  const version = unversioned ? FIRST_FROZEN_VERSION : raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return { ok: false, error: `version: expected a whole number ≥ 0, got ${quote(version)}` };
  }
  if (version > target) {
    return {
      ok: false,
      error: `version: this ${what} was written by a newer version of the game (file v${version}, this build reads up to v${target}); update the game to open it`,
    };
  }
  let current: Record<string, unknown> = unversioned ? { ...raw, version } : raw;
  for (let v = version; v < target; v++) {
    const step = table[v];
    if (step === undefined) return { ok: false, error: `version: this ${what} is v${version}, which is too old to open (no migration from v${v})` };
    let next: unknown;
    try {
      next = step(structuredClone(current));
    } catch (e) {
      return { ok: false, error: `upgrading the ${what} from v${v} to v${v + 1} failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (!isRecord(next)) return { ok: false, error: `upgrading the ${what} from v${v} to v${v + 1} did not produce an object` };
    current = { ...next, version: v + 1 };
  }
  if (unversioned) return { ok: true, value: current, migratedFrom: UNVERSIONED, unversioned: true };
  return { ok: true, value: current, migratedFrom: version < target ? version : null };
}

// ---- Text in -----------------------------------------------------------------------------------------------------------

/** Longest file text (in characters) that is parsed at all; PLAN §2 budgets a slot under 300 kB. */
export const MAX_FILE_CHARS = 1_000_000;

/** Parses file text: size guard first, then JSON, each failure with a sentence a player can act on. */
export function parseFileText(text: string, what: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (text.length > MAX_FILE_CHARS) {
    return { ok: false, error: `${what} file is too large (${Math.ceil(text.length / 1000)} kB; the limit is ${Math.floor(MAX_FILE_CHARS / 1000)} kB)` };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (e) {
    return { ok: false, error: `${what} file is not valid JSON (${e instanceof Error ? e.message : String(e)})` };
  }
}
