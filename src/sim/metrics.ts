// Metrics (PLAN §7.5; DESIGN §19 is the single balance-target table, D-066 #17): everything `docs/BALANCE.md` says is computed
// here, from the runs of one pack. Pure and runtime-neutral: `BatchRun[]` and the `ContentPack` in, `Metrics` out.
//
// `targets` has one row per DESIGN §19 row (1–20) and one per PLAN §1.2 gate (G1–G6). A row is `pass`, `fail`, `partial` (the
// parts that could be measured pass, the others could not) or `n/a`; a row the pack cannot measure reads "n/a — needs <what>",
// never a pass. A row whose sample is smaller than the spec asks for (N ≥ 200 per class, ≥ 2,000 runs …) is judged on what was
// measured and carries `sample` so the report can say the sample is thin.
import { RESIST_MULT, type ContentPack } from '@engine/index';
import { TRUE_ENDING_IDS } from '@schema/ending';
import { DamageType } from '@schema/primitives';
import { computeCoverage, coverageRatios, type Coverage } from './coverage';
import type { FightRecord, LoopRecord, RunResult } from './runner';
import type { ScenarioId } from './scenarios';

// ---- the data -------------------------------------------------------------------------------------------------------------------

/** Which part of the batch a run belongs to. */
export type Suite = 'main' | 'scenario' | 'script';

/** One run of the batch, with what produced it. */
export interface BatchRun {
  pack: string;
  suite: Suite;
  /** `suite: 'scenario'`: the scenario the run started from. */
  scenario?: string;
  /** `suite: 'scenario'`: the companion who travelled with the Wayfinder (absent = solo). */
  companionId?: string;
  /** `suite: 'script'`: the ending script's label (`<endingId>[:<name>]#<n>`). */
  script?: string;
  /** `suite: 'script'`: whether the script reached its ending, and why not when it did not. */
  proof?: { reached: boolean; detail: string };
  /** The command that replays the run (`npm run sim:replay -- …`). */
  repro: string;
  result: RunResult;
}

/** One sampled run replayed twice (PLAN §7.4): a fresh run and a replay of its recorded actions must reach `expected`. */
export interface DeterminismMismatch {
  pack: string;
  bot: string;
  classId: string;
  seed: string;
  expected: string;
  rerun: string;
  replay: string;
  repro: string;
}

export interface DeterminismSummary {
  sampled: number;
  mismatches: DeterminismMismatch[];
}

export interface Blocker {
  pack: string;
  suite: Suite;
  bot: string;
  classId: string;
  seed: string;
  scenario?: string;
  stopReason: RunResult['stopReason'];
  errors: RunResult['errors'];
  softLock: RunResult['softLock'];
  repro: string;
  hasTrace: boolean;
  /** A script that did not reach its ending: the reason. */
  proofFailure?: string;
}

export type TargetStatus = 'pass' | 'fail' | 'partial' | 'n/a';

export interface TargetRow {
  /** DESIGN §19 row number (1–20), or `G1`…`G6` for PLAN §1.2's gates. */
  row: number | string;
  name: string;
  status: TargetStatus;
  /** `true` = pass, `false` = fail, `null` = partial or n/a (never a pass). */
  pass: boolean | null;
  /** The headline number (null when there is none). */
  value: number | null;
  valueText: string;
  threshold: string;
  /** What was measured; for an n/a row "n/a — needs <what>". */
  detail: string;
  /** Set when fewer runs back the row than the spec asks for: the verdict stands on what was measured. */
  sample?: { n: number; required: number };
}

export interface Dist {
  n: number;
  min: number;
  median: number;
  p90: number;
  max: number;
}

export interface ClassBotMetrics {
  runs: number;
  loop1EscapeRate: number;
  loop1ExpiryRate: number;
  loop1FallenRate: number;
  /** Share of runs whose Loop 1 reached a closer. */
  loop1ClosedRate: number;
  endings: Record<string, number>;
  medianDaysLoop1: number | null;
  p90Days: number | null;
  /** Mean deaths in Loop 1 (FALLEN screens included). */
  deaths: number;
  zeroDeathShare: number;
  medianLevelAtApex: number | null;
  abilityActionShare: number | null;
  zeroMpFightShare: number | null;
}

export interface RegionCurveRow {
  regionId: string;
  levelBand: [number, number];
  fights: number;
  medianRounds: number | null;
  deathRate: number;
  fleeRate: number;
  avgDamageTakenPerRound: number;
}

export interface BossStat {
  fights: number;
  winRate: number;
  medianRounds: number | null;
  /** Fights whose highest boss phase was the key (0 = the first phase). */
  phaseReached: Record<number, number>;
}

/** The Contained Tyrant from a pre-Tyrant scenario (DESIGN §19 #19), for one (level, class, companion, bot). */
export interface TyrantCell {
  level: number;
  classId: string;
  companion: boolean;
  bot: string;
  runs: number;
  wins: number;
  winRate: number;
  medianRounds: number | null;
  medianDamageDealt: number | null;
}

export interface Metrics {
  runs: number;
  byClassBot: Record<string, ClassBotMetrics>;
  daysByBotLoop: { bot: string; loop: number; dist: Dist }[];
  damageShareByClass: Record<string, Record<string, number>>;
  regionCurve: RegionCurveRow[];
  bossStats: Record<string, BossStat>;
  tyrant: TyrantCell[];
  coverage: Coverage;
  softLocks: RunResult['softLock'][];
  errors: RunResult['errors'];
  blockers: Blocker[];
  economy: { medianGoldAtApex: number | null; medianGoldEndOfLoop1: number | null; purchases: Record<string, number>; craftsByRecipe: Record<string, number>; upgradesByRarity: Record<string, number> };
  quests: Record<string, { started: number; completed: number; failed: number; medianDaysToComplete: number | null; completedByBots: string[] }>;
  echoes: Record<string, { gained: number; firstLoopGained: number }>;
  companions: Record<string, { recruited: number; kos: number; deaths: number; avgLoyalty: number }>;
  targets: TargetRow[];
}

export interface MetricsInput {
  pack: string;
  content: ContentPack;
  runs: readonly BatchRun[];
  /** The determinism check's outcome for this pack (null = it was not run). */
  determinism: DeterminismSummary | null;
}

// ---- constants -------------------------------------------------------------------------------------------------------------------

/** The six damage types (DESIGN §4.4), in the schema's order. */
const DAMAGE_TYPES = DamageType.options;
type DamageKind = (typeof DAMAGE_TYPES)[number];
export const CONTAINED_TYRANT = 'cr_chronos_tyrant_contained';
export const UNVEILED_TYRANT = 'cr_chronos_tyrant_unveiled';
/** PLAN §1.2: "every bot in {melee, caster, explorer, speedrunner, pacifist, random}". */
export const RELEASE_BOTS = ['melee', 'caster', 'explorer', 'speedrunner', 'pacifist', 'random'] as const;
/** DESIGN §19 #12: the martial classes and the casters. */
export const MARTIAL_CLASSES = ['ranger', 'elf', 'ironclad_warden'] as const;
export const CASTER_CLASSES = ['wizard', 'shadow_weaver'] as const;
/** The bots that fight like a player: the ones DESIGN §19 #12/#13 and #14 are measured with. */
export const FIGHTING_BOTS = ['melee', 'caster', 'explorer'] as const;
/** DESIGN §19 #19: the level → pre-Tyrant scenario (the class is chosen per run), and #20's communion scenario. */
export const SCENARIO_PRE_TYRANT = { 11: 'pre_tyrant_l11_ranger', 13: 'pre_tyrant_l13_ranger' } as const satisfies Record<number, ScenarioId>;
export const SCENARIO_COMMUNION = 'communion_movement_2' satisfies ScenarioId;
/** A region needs this many fights before its row of the difficulty curve counts. */
export const MIN_REGION_FIGHTS = 5;
/** A band needs this many fodder encounters before DESIGN §19 #16's 15 % granularity means anything. */
export const MIN_BAND_ENCOUNTERS = 6;
export const FIGHT_LENGTH_BANDS = [
  { key: 'fodder1', label: 'fodder single', lo: 3, hi: 5 },
  { key: 'fodderN', label: 'fodder pair/triple', lo: 5, hi: 8 },
  { key: 'elite', label: 'elite', lo: 6, hi: 9 },
  { key: 'boss', label: 'regional boss', lo: 10, hi: 14 },
  { key: 'contained', label: 'Contained Tyrant', lo: 12, hi: 18 },
  { key: 'unveiled', label: 'Unveiled Tyrant', lo: 14, hi: 20 },
] as const;
type FightBand = (typeof FIGHT_LENGTH_BANDS)[number]['key'];

// ---- statistics ---------------------------------------------------------------------------------------------------------------------

export const sum = (xs: readonly number[]): number => xs.reduce((t, x) => t + x, 0);
export const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : sum(xs) / xs.length);

/** The middle value (the mean of the two middle ones for an even count); 0 for an empty list, so callers guard `length`. */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Nearest-rank percentile (`p` in 0..100); 0 for an empty list. */
export function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] as number;
}

export function dist(xs: readonly number[]): Dist {
  return xs.length === 0
    ? { n: 0, min: 0, median: 0, p90: 0, max: 0 }
    : { n: xs.length, min: Math.min(...xs), median: median(xs), p90: percentile(xs, 90), max: Math.max(...xs) };
}

const ratio = (n: number, d: number): number => (d === 0 ? 0 : n / d);
const medianOrNull = (xs: readonly number[]): number | null => (xs.length === 0 ? null : median(xs));
const round1 = (x: number): number => Math.round(x * 10) / 10;
const pct0 = (x: number): string => `${Math.round(100 * x)}%`;
const pct1 = (x: number): string => `${(100 * x).toFixed(1)}%`;
const num = (x: number): string => (Number.isInteger(x) ? String(x) : round1(x).toFixed(1));

// ---- run helpers ----------------------------------------------------------------------------------------------------------------------

const loop1Of = (r: RunResult): LoopRecord | undefined => r.loops.find((l) => l.loop === 1);
/** Deaths in Loop 1: the loop's own count once it ended, else the run's (no loop ended: they were all Loop 1's). */
const loop1Deaths = (r: RunResult): number => loop1Of(r)?.deaths ?? (r.loops.length === 0 ? r.deaths : 0);
/**
 * U81b1 (D-145): the portal reached with the Tyrant untouched — the expiry Horde opens Ilyra's portal too (DESIGN §10.2) — is
 * a clock expiry the player outran, not an Escape: DESIGN §19 #1 counts runs that "kill the Contained Tyrant and reach the
 * portal". U80 counted it as an Escape (most of its 94–98 % were these) and missed it in the expiry rows (#15).
 */
const expiredEscape = (l: LoopRecord | undefined): boolean => l?.outcome === 'closer_escape' && l.tyrant === 'untouched';
const isExpiry = (l: LoopRecord | undefined): boolean => (l?.outcome === 'closer_fall' && l.reason === 'expiry') || expiredEscape(l);
const isEscape = (l: LoopRecord | undefined): boolean => l?.outcome === 'closer_escape' && !expiredEscape(l);
const COMBAT_TURNS = ['attack', 'ability', 'guard', 'item', 'flee'] as const;
const combatTurns = (r: RunResult): number => sum(COMBAT_TURNS.map((t) => r.combatActions[t] ?? 0));
const hasEnemy = (f: FightRecord, id: string): boolean => f.enemies.includes(id);
const finished = (f: FightRecord): boolean => f.result !== 'fled';

const key = (classId: string, bot: string): string => `${classId}:${bot}`;

// ---- target rows --------------------------------------------------------------------------------------------------------------------------

/** One verdict inside a row: `ok` null = could not be measured, with `text` saying what it needs ("needs …"). */
interface Check {
  ok: boolean | null;
  text: string;
}
const ok = (good: boolean, text: string): Check => ({ ok: good, text });
const needs = (what: string): Check => ({ ok: null, text: `needs ${what}` });

interface RowOpts {
  value?: number | null;
  valueText?: string;
  sample?: { n: number; required: number };
}

/** Folds a row's checks into its status: any failure fails it, all-unmeasured is n/a, a mix of passes and unmeasured is partial. */
export function targetRow(row: number | string, name: string, threshold: string, checks: readonly Check[], opts: RowOpts = {}): TargetRow {
  const failed = checks.filter((c) => c.ok === false).length;
  const measured = checks.filter((c) => c.ok !== null);
  const unmeasured = checks.filter((c) => c.ok === null);
  const status: TargetStatus = failed > 0 ? 'fail' : measured.length === 0 ? 'n/a' : unmeasured.length > 0 ? 'partial' : 'pass';
  const mark = (c: Check): string => (c.ok === false ? `FAIL ${c.text}` : c.text);
  let detail: string;
  if (status === 'n/a') detail = `n/a — ${unmeasured.map((c) => c.text).join('; ')}`;
  else if (status === 'partial') detail = `${measured.map(mark).join('; ')}; not measured: ${unmeasured.map((c) => c.text).join('; ')}`;
  else detail = measured.map(mark).join('; ');
  const value = opts.value ?? null;
  return {
    row,
    name,
    status,
    pass: status === 'pass' ? true : status === 'fail' ? false : null,
    value,
    valueText: status === 'n/a' ? '—' : (opts.valueText ?? (value === null ? '—' : num(value))),
    threshold,
    detail,
    ...(opts.sample === undefined ? {} : { sample: opts.sample }),
  };
}

const failing = (checks: readonly Check[]): number => checks.filter((c) => c.ok === false).length;

interface Ctx {
  pack: string;
  content: ContentPack;
  runs: readonly BatchRun[];
  main: readonly RunResult[];
  scenario: readonly BatchRun[];
  script: readonly RunResult[];
  all: readonly RunResult[];
  determinism: DeterminismSummary | null;
  coverage: Coverage;
}

const mainOf = (c: Ctx, bots: readonly string[]): RunResult[] => c.main.filter((r) => bots.includes(r.bot));
const classesIn = (rs: readonly RunResult[]): string[] => [...new Set(rs.map((r) => r.classId))].sort();
const thin = (n: number, required: number): { n: number; required: number } | undefined => (n < required ? { n, required } : undefined);
const withSample = (n: number, required: number): Pick<RowOpts, 'sample'> => {
  const s = thin(n, required);
  return s === undefined ? {} : { sample: s };
};

/** Row 1 and G2: the Escape rate per class with the melee or the caster bot. */
function escapeRow(row: number | string, name: string, c: Ctx): TargetRow {
  const threshold = 'every class ≥ 60 % (melee or caster), N ≥ 200 per class';
  const rs = mainOf(c, ['melee', 'caster']);
  if (rs.length === 0) return targetRow(row, name, threshold, [needs('melee or caster runs')]);
  const classes = classesIn(rs);
  const cells = classes.map((classId) => {
    const per = (['melee', 'caster'] as const).map((bot) => {
      const runs = rs.filter((r) => r.classId === classId && r.bot === bot);
      return { bot, n: runs.length, rate: ratio(runs.filter((r) => isEscape(loop1Of(r))).length, runs.length) };
    });
    const ran = per.filter((p) => p.n > 0);
    return { classId, per, best: Math.max(...ran.map((p) => p.rate)), n: Math.min(...ran.map((p) => p.n)) };
  });
  const worst = Math.min(...cells.map((x) => x.best));
  const text = cells.map((x) => `${x.classId} ${pct0(x.best)} (${x.per.filter((p) => p.n > 0).map((p) => `${p.bot} ${pct0(p.rate)}`).join(', ')})`).join('; ');
  return targetRow(row, name, threshold, [ok(worst >= 0.6, `Escape rate by class: ${text}`)], {
    value: worst,
    valueText: `worst class ${pct0(worst)}`,
    ...withSample(Math.min(...cells.map((x) => x.n)), 200),
  });
}

function softLockRow(row: number | string, name: string, c: Ctx): TargetRow {
  const threshold = '0 soft-locks in ≥ 2,000 runs';
  const locks = c.runs.filter((r) => r.result.softLock.detected);
  const byRule = new Map<string, number>();
  for (const r of locks) byRule.set(r.result.softLock.rule ?? 'unknown', (byRule.get(r.result.softLock.rule ?? 'unknown') ?? 0) + 1);
  const rules = [...byRule].map(([rule, n]) => `${rule} ${n}`).join(', ');
  return targetRow(row, name, threshold, [ok(locks.length === 0, `${locks.length} soft-lock(s) in ${c.runs.length} run(s)${rules === '' ? '' : ` (${rules})`}`)], {
    value: locks.length,
    ...withSample(c.runs.length, 2000),
  });
}

/** Fights of the main and scenario suites that went to a finish (not fled). */
function fightsOf(c: Ctx, suites: readonly Suite[] = ['main', 'scenario']): FightRecord[] {
  return c.runs.filter((r) => suites.includes(r.suite)).flatMap((r) => r.result.fights);
}

function fightBand(f: FightRecord, content: ContentPack): FightBand | null {
  if (hasEnemy(f, UNVEILED_TYRANT)) return f.communion ? null : 'unveiled'; // the communion is not the fight path
  if (hasEnemy(f, CONTAINED_TYRANT)) return 'contained';
  if (f.boss) return 'boss';
  const roles = f.enemies.map((id) => content.creatures[id]?.role);
  if (roles.some((r) => r === 'elite')) return 'elite';
  if (roles.every((r) => r === 'fodder')) return f.enemies.length === 1 ? 'fodder1' : 'fodderN';
  return null;
}

function difficultyRow(c: Ctx): TargetRow {
  const threshold = 'median rounds and death rate non-decreasing in band order';
  const byBand = new Map<string, { lo: number; hi: number; fights: FightRecord[] }>();
  for (const f of fightsOf(c, ['main'])) {
    const band = c.content.regions[f.regionId]?.levelBand;
    if (band === undefined) continue;
    const k = `${band.min}-${band.max}`;
    const entry = byBand.get(k) ?? { lo: band.min, hi: band.max, fights: [] };
    entry.fights.push(f);
    byBand.set(k, entry);
  }
  const bands = [...byBand.values()].filter((b) => b.fights.length >= MIN_REGION_FIGHTS).sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  if (bands.length < 2) return targetRow(3, 'Difficulty monotone across regions', threshold, [needs(`fights in at least 2 level bands (${MIN_REGION_FIGHTS}+ each; found ${bands.length})`)]);
  const rows = bands.map((b) => ({
    band: `${b.lo}-${b.hi}`,
    rounds: median(b.fights.filter(finished).map((f) => f.rounds)),
    death: ratio(b.fights.filter((f) => f.result === 'defeat').length, b.fights.length),
  }));
  const violations: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1] as (typeof rows)[number];
    const b = rows[i] as (typeof rows)[number];
    if (b.rounds < a.rounds) violations.push(`rounds fall ${a.band} ${num(a.rounds)} → ${b.band} ${num(b.rounds)}`);
    if (b.death < a.death) violations.push(`death rate falls ${a.band} ${pct0(a.death)} → ${b.band} ${pct0(b.death)}`);
  }
  const curve = rows.map((r) => `${r.band}: ${num(r.rounds)} rounds, ${pct0(r.death)} deaths`).join('; ');
  return targetRow(3, 'Difficulty monotone across regions', threshold, [ok(violations.length === 0, `${curve}${violations.length === 0 ? '' : ` — ${violations.join('; ')}`}`)], {
    value: violations.length,
    valueText: `${violations.length} violation(s)`,
  });
}

function damageShareRow(c: Ctx, shares: Metrics['damageShareByClass']): TargetRow {
  const threshold = 'no ability > 35 % of its class\'s damage';
  const classes = Object.keys(shares);
  if (classes.length === 0) return targetRow(2, 'No single ability dominates', threshold, [needs('runs that deal damage')]);
  let worst = { classId: '', source: '', share: 0 };
  for (const classId of classes) {
    for (const [source, share] of Object.entries(shares[classId] ?? {})) {
      if (c.content.abilities[source] !== undefined && share > worst.share) worst = { classId, source, share };
    }
  }
  if (worst.source === '') return targetRow(2, 'No single ability dominates', threshold, [needs('runs that cast abilities')]);
  return targetRow(2, 'No single ability dominates', threshold, [ok(worst.share <= 0.35, `largest share ${worst.source} ${pct1(worst.share)} of ${worst.classId}'s damage`)], {
    value: worst.share,
    valueText: pct1(worst.share),
  });
}

function endingsRow(c: Ctx): TargetRow {
  const threshold = 'each of A–F reached (explorer + scripted suites)';
  const explorer = new Set(c.main.filter((r) => r.bot === 'explorer').flatMap((r) => r.endings));
  const scripted = new Set(c.script.flatMap((r) => r.endings));
  const others = new Set(c.main.filter((r) => r.bot !== 'explorer').flatMap((r) => r.endings));
  const trueEndings = Object.keys(c.content.endings).filter((id) => (TRUE_ENDING_IDS as readonly string[]).includes(id)).sort();
  if (trueEndings.length < TRUE_ENDING_IDS.length) {
    const reached = trueEndings.filter((id) => explorer.has(id) || scripted.has(id));
    return targetRow(4, 'Every ending reached', threshold, [needs(`the six true endings in the pack (it defines ${trueEndings.length}; ${reached.length} of them reached by explorer or scripts)`)]);
  }
  const missing = trueEndings.filter((id) => !explorer.has(id) && !scripted.has(id));
  const viaOthers = missing.filter((id) => others.has(id));
  return targetRow(4, 'Every ending reached', threshold, [ok(missing.length === 0, `${trueEndings.length - missing.length}/${trueEndings.length} reached${missing.length === 0 ? '' : `; missing ${missing.join(', ')}${viaOthers.length === 0 ? '' : ` (${viaOthers.join(', ')} reached only by other bots)`}`}`)], {
    value: trueEndings.length - missing.length,
  });
}

function coverageRow(row: number, name: string, threshold: string, covered: number, total: number, never: readonly string[]): TargetRow {
  if (total === 0) return targetRow(row, name, threshold, [needs(`${name.toLowerCase().replace('every ', '')} in the pack (it has none)`)]);
  return targetRow(row, name, threshold, [ok(covered === total, `${covered}/${total}${never.length === 0 ? '' : `; never: ${never.slice(0, 6).join(', ')}${never.length > 6 ? ` … +${never.length - 6}` : ''}`}`)], {
    value: ratio(covered, total),
    valueText: `${covered}/${total}`,
  });
}

function fightLengthRow(c: Ctx): TargetRow {
  const threshold = 'fodder 3–5/5–8, elite 6–9, boss 10–14, Contained Tyrant 12–18, Unveiled 14–20 rounds';
  const groups = new Map<FightBand, number[]>();
  for (const f of fightsOf(c)) {
    if (f.result !== 'victory') continue;
    const band = fightBand(f, c.content);
    if (band !== null) groups.set(band, [...(groups.get(band) ?? []), f.rounds]);
  }
  const checks = FIGHT_LENGTH_BANDS.map((b): Check => {
    const rounds = groups.get(b.key) ?? [];
    if (rounds.length === 0) return needs(`${b.label} fights won (none)`);
    const m = median(rounds);
    return ok(m >= b.lo && m <= b.hi, `${b.label} ${num(m)} (${b.lo}–${b.hi}, n=${rounds.length})`);
  });
  return targetRow(8, 'Fight length by band', threshold, checks, { value: failing(checks), valueText: `${failing(checks)} band(s) out of range` });
}

function deathsRow(c: Ctx): TargetRow {
  const threshold = 'melee/caster mean ≤ 1.0 and ≥ 55 % zero-death; explorer ≤ 1.5; random ≥ 3';
  const stats = (bot: string): { n: number; mean: number; zero: number } => {
    const rs = c.main.filter((r) => r.bot === bot);
    const deaths = rs.map(loop1Deaths);
    return { n: rs.length, mean: mean(deaths), zero: ratio(deaths.filter((d) => d === 0).length, deaths.length) };
  };
  const checks: Check[] = [];
  for (const bot of ['melee', 'caster']) {
    const s = stats(bot);
    checks.push(s.n === 0 ? needs(`${bot} runs`) : ok(s.mean <= 1 && s.zero >= 0.55, `${bot} mean ${s.mean.toFixed(2)}, ${pct0(s.zero)} zero-death`));
  }
  const ex = stats('explorer');
  checks.push(ex.n === 0 ? needs('explorer runs') : ok(ex.mean <= 1.5, `explorer mean ${ex.mean.toFixed(2)}`));
  const rd = stats('random');
  checks.push(rd.n === 0 ? needs('random runs') : ok(rd.mean >= 3, `random mean ${rd.mean.toFixed(2)}`));
  return targetRow(9, 'Deaths per Loop 1 by bot', threshold, checks, { value: failing(checks), valueText: `${failing(checks)} bot(s) out of range` });
}

function durationRow(c: Ctx): TargetRow {
  const threshold = 'explorer Loop 1 350–600 actions, 22–26 days; speedrunner 12–16 days; Loop 3+ (speedrunner) 120–220 actions';
  const checks: Check[] = [];
  const loop1 = (bot: string): LoopRecord[] => c.main.filter((r) => r.bot === bot).flatMap((r) => loop1Of(r) ?? []);
  const ex = loop1('explorer');
  if (ex.length === 0) {
    checks.push(needs('explorer runs that close Loop 1'));
  } else {
    const steps = median(ex.map((l) => l.steps));
    const days = median(ex.map((l) => l.daysUsed));
    checks.push(ok(steps >= 350 && steps <= 600, `explorer Loop 1 ${num(steps)} actions`));
    checks.push(ok(days >= 22 && days <= 26, `explorer Loop 1 ${num(days)} days`));
  }
  const sp = loop1('speedrunner');
  checks.push(sp.length === 0 ? needs('speedrunner runs that close Loop 1') : ok(median(sp.map((l) => l.daysUsed)) >= 12 && median(sp.map((l) => l.daysUsed)) <= 16, `speedrunner Loop 1 ${num(median(sp.map((l) => l.daysUsed)))} days`));
  const late = c.main.filter((r) => r.bot === 'speedrunner').flatMap((r) => r.loops.filter((l) => l.loop >= 3));
  checks.push(late.length === 0 ? needs('speedrunner runs that finish Loop 3 or later') : ok(median(late.map((l) => l.steps)) >= 120 && median(late.map((l) => l.steps)) <= 220, `speedrunner Loop 3+ ${num(median(late.map((l) => l.steps)))} actions`));
  return targetRow(10, 'Loop duration', threshold, checks, { value: failing(checks), valueText: `${failing(checks)} measure(s) out of range` });
}

/** The first Contained Tyrant fight of each run's Loop 1. */
const apexFight = (r: RunResult): FightRecord | undefined => r.fights.find((f) => hasEnemy(f, CONTAINED_TYRANT));

function apexLevelRow(c: Ctx): TargetRow {
  const threshold = 'explorer median 11–13; speedrunner ≥ 9';
  const level = (bot: string): number[] => c.main.filter((r) => r.bot === bot).flatMap((r) => apexFight(r)?.playerLevel ?? []);
  const checks: Check[] = [];
  const ex = level('explorer');
  checks.push(ex.length === 0 ? needs('explorer runs that reach the Apex') : ok(median(ex) >= 11 && median(ex) <= 13, `explorer median level ${num(median(ex))} (n=${ex.length})`));
  const sp = level('speedrunner');
  checks.push(sp.length === 0 ? needs('speedrunner runs that reach the Apex') : ok(median(sp) >= 9, `speedrunner median level ${num(median(sp))} (n=${sp.length})`));
  return targetRow(11, 'Level at the Loop 1 Apex', threshold, checks, { value: ex.length === 0 ? null : median(ex), valueText: ex.length === 0 ? '—' : `explorer ${num(median(ex))}` });
}

function abilityUsageRow(c: Ctx): TargetRow {
  const threshold = 'ranger/elf/warden 40–60 %, wizard/weaver 55–80 % of combat actions; Blood price 10–30 % of Weaver casts';
  const rs = mainOf(c, FIGHTING_BOTS);
  const checks: Check[] = [];
  for (const [classes, lo, hi] of [[MARTIAL_CLASSES, 0.4, 0.6], [CASTER_CLASSES, 0.55, 0.8]] as const) {
    for (const classId of classes) {
      const runs = rs.filter((r) => r.classId === classId);
      const turns = sum(runs.map(combatTurns));
      if (turns === 0) {
        checks.push(needs(`${classId} runs that fight`));
        continue;
      }
      const share = ratio(sum(runs.map((r) => r.combatActions['ability'] ?? 0)), turns);
      checks.push(ok(share >= lo && share <= hi, `${classId} ${pct0(share)} (${pct0(lo)}–${pct0(hi)}, ${turns} actions)`));
    }
  }
  const weaver = rs.filter((r) => r.classId === 'shadow_weaver');
  const casts = sum(weaver.map((r) => r.combatActions['ability'] ?? 0));
  if (casts === 0) checks.push(needs('shadow_weaver casts'));
  else {
    const blood = ratio(sum(weaver.map((r) => r.bloodCasts)), casts);
    checks.push(ok(blood >= 0.1 && blood <= 0.3, `Blood price ${pct0(blood)} of ${casts} Weaver casts`));
  }
  return targetRow(12, 'Ability usage', threshold, checks, { value: failing(checks), valueText: `${failing(checks)} class(es) out of band` });
}

function resourceRow(c: Ctx): TargetRow {
  const threshold = 'fights ending with 0 MP ≤ 15 % for every class';
  const rs = mainOf(c, FIGHTING_BOTS);
  const classes = classesIn(rs);
  const cells = classes.flatMap((classId) => {
    const fights = rs.filter((r) => r.classId === classId).flatMap((r) => r.fights).filter((f) => finished(f) && f.mpMax > 0);
    return fights.length === 0 ? [] : [{ classId, n: fights.length, share: ratio(fights.filter((f) => f.endMp === 0).length, fights.length) }];
  });
  if (cells.length === 0) return targetRow(13, 'Resource health', threshold, [needs('fights by classes with an MP pool')]);
  const checks = cells.map((x) => ok(x.share <= 0.15, `${x.classId} ${pct0(x.share)} of ${x.n} fights`));
  const worst = Math.max(...cells.map((x) => x.share));
  return targetRow(13, 'Resource health', threshold, checks, { value: worst, valueText: `worst class ${pct0(worst)}` });
}

/** Healing consumables a merchant stocks, cheapest price first. */
function healingPrices(content: ContentPack): number[] {
  const prices: number[] = [];
  for (const m of Object.values(content.merchants)) {
    for (const entry of m.stock) {
      const item = content.items[entry.itemId];
      if (item?.type !== 'consumable') continue;
      const heals = item.onUse.some((e) => 'heal' in e && e.heal.hp !== undefined && e.heal.hp !== 0);
      if (heals) prices.push(Math.ceil(item.value * m.regionMarkup * entry.priceMult));
    }
  }
  return prices.sort((a, b) => a - b);
}

/** The fodder creatures a region fields: its wandering pool and the fodder-only fixed encounters of its locations. */
function fodderEncounters(content: ContentPack): { regionId: string; band: [number, number]; creatures: string[] }[] {
  const out: { regionId: string; band: [number, number]; creatures: string[] }[] = [];
  const isFodder = (id: string): boolean => content.creatures[id]?.role === 'fodder';
  for (const region of Object.values(content.regions)) {
    const band: [number, number] = [region.levelBand.min, region.levelBand.max];
    for (const w of region.wanderingPool) if (isFodder(w.creatureId)) out.push({ regionId: region.id, band, creatures: [w.creatureId] });
    for (const locId of content.index.locationsByRegion[region.id] ?? []) {
      const loc = content.locations[locId];
      if (loc === undefined) continue;
      const b: [number, number] = loc.levelBand === undefined ? band : [loc.levelBand.min, loc.levelBand.max];
      for (const enc of loc.encounters) {
        const creatures = enc.groups.flatMap((g) => Array.from({ length: g.count }, () => g.creatureId));
        if (creatures.length > 0 && creatures.every(isFodder)) out.push({ regionId: region.id, band: b, creatures });
      }
    }
  }
  return out;
}

function economyRow(c: Ctx): TargetRow {
  const threshold = 'gold never negative; a healing consumable within two kills at every band; end-of-loop gold median 50–200';
  const checks: Check[] = [];
  const minGold = Math.min(...c.all.map((r) => r.minGold));
  checks.push(c.all.length === 0 ? needs('runs') : ok(minGold >= 0, `lowest gold held ${minGold}`));
  const prices = healingPrices(c.content);
  const encounters = fodderEncounters(c.content);
  if (prices.length === 0) checks.push(needs('a merchant that sells a healing consumable'));
  else if (encounters.length === 0) checks.push(needs('fodder encounters to price a kill'));
  else {
    const cheapest = prices[0] as number;
    // a "kill" is one enemy: price the two-kill rule on the gold one enemy drops
    const perKill = new Map<string, number[]>();
    for (const e of encounters) {
      const k = `${e.band[0]}-${e.band[1]}`;
      perKill.set(k, [...(perKill.get(k) ?? []), ...e.creatures.map((id) => ((c.content.creatures[id]?.gold.min ?? 0) + (c.content.creatures[id]?.gold.max ?? 0)) / 2)]);
    }
    const bad = [...perKill].filter(([, golds]) => 2 * mean(golds) < cheapest).map(([band]) => band);
    checks.push(ok(bad.length === 0, `cheapest healing ${cheapest} gold${bad.length === 0 ? ` within two kills in all ${perKill.size} band(s)` : `; two kills fall short in band(s) ${bad.join(', ')}`}`));
  }
  const end = c.main.filter((r) => (FIGHTING_BOTS as readonly string[]).includes(r.bot)).flatMap((r) => loop1Of(r)?.gold ?? []);
  checks.push(end.length === 0 ? needs('melee/caster/explorer runs that close Loop 1') : ok(median(end) >= 50 && median(end) <= 200, `end-of-Loop-1 gold median ${num(median(end))} (n=${end.length})`));
  return targetRow(14, 'Economy', threshold, checks, { value: failing(checks), valueText: `${failing(checks)} check(s) failing` });
}

function clockRow(c: Ctx): TargetRow {
  const threshold = 'explorer Loop 1 expiry rate 10–20 %; speedrunner 0 %';
  const checks: Check[] = [];
  const ex = c.main.filter((r) => r.bot === 'explorer');
  let value: number | null = null;
  if (ex.length === 0) checks.push(needs('explorer runs'));
  else {
    const rate = ratio(ex.filter((r) => isExpiry(loop1Of(r))).length, ex.length);
    value = rate;
    const hs = new Map<string, number>();
    for (const r of ex) {
      const l = loop1Of(r);
      if (l !== undefined) hs.set(l.heartstone, (hs.get(l.heartstone) ?? 0) + 1);
    }
    const heart = [...hs].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `${k} ${n}`).join(', ');
    checks.push(ok(rate >= 0.1 && rate <= 0.2, `explorer expiry ${pct0(rate)} of ${ex.length} (Heartstone: ${heart === '' ? 'none logged' : heart})`));
  }
  const sp = c.main.filter((r) => r.bot === 'speedrunner');
  if (sp.length === 0) checks.push(needs('speedrunner runs'));
  else {
    const rate = ratio(sp.filter((r) => isExpiry(loop1Of(r))).length, sp.length);
    checks.push(ok(rate === 0, `speedrunner expiry ${pct0(rate)} of ${sp.length}`));
  }
  return targetRow(15, 'Clock', threshold, checks, { value, valueText: value === null ? '—' : `explorer ${pct0(value)}` });
}

function resistanceRow(c: Ctx): TargetRow {
  const threshold = 'each damage type best in 15–35 % of fodder encounters per band';
  const byBand = new Map<string, string[][]>();
  for (const e of fodderEncounters(c.content)) {
    const k = `${e.band[0]}-${e.band[1]}`;
    byBand.set(k, [...(byBand.get(k) ?? []), e.creatures]);
  }
  const bands = [...byBand].filter(([, es]) => es.length >= MIN_BAND_ENCOUNTERS);
  if (bands.length === 0) return targetRow(16, 'Resistance relevance', threshold, [needs(`a level band with ${MIN_BAND_ENCOUNTERS}+ fodder encounters (best found ${Math.max(0, ...[...byBand.values()].map((es) => es.length))})`)]);
  const damage = (creatures: readonly string[], type: DamageKind): number =>
    sum(creatures.map((id) => RESIST_MULT[c.content.creatures[id]?.resistances[type] ?? 'neutral']));
  const checks = bands.map(([band, encounters]): Check => {
    const shares = DAMAGE_TYPES.map((d) => {
      const best = encounters.filter((creatures) => {
        const scores = DAMAGE_TYPES.map((t) => damage(creatures, t));
        // an encounter with no weakness or resistance has no best type
        return Math.max(...scores) > Math.min(...scores) && damage(creatures, d) === Math.max(...scores);
      }).length;
      return { d, share: ratio(best, encounters.length) };
    });
    const bad = shares.filter((s) => s.share < 0.15 || s.share > 0.35);
    return ok(bad.length === 0, `band ${band} (${encounters.length} encounters): ${shares.map((s) => `${s.d} ${pct0(s.share)}`).join(', ')}`);
  });
  return targetRow(16, 'Resistance relevance', threshold, checks, { value: failing(checks), valueText: `${failing(checks)} band(s) out of range` });
}

function companionRow(c: Ctx): TargetRow {
  const threshold = 'fights with a companion end 20–35 % faster at equal level';
  const fights = c.runs.filter((r) => r.suite === 'main').flatMap((r) => r.result.fights).filter((f) => f.result === 'victory' && !f.boss);
  const groups = new Map<string, { with: number[]; without: number[] }>();
  for (const f of fights) {
    const k = `${f.playerLevel}|${[...f.enemies].sort().join(',')}`;
    const g = groups.get(k) ?? { with: [], without: [] };
    (f.companion ? g.with : g.without).push(f.rounds);
    groups.set(k, g);
  }
  const pairs = [...groups.values()].filter((g) => g.with.length >= 3 && g.without.length >= 3);
  if (pairs.length === 0) return targetRow(17, 'Companion value', threshold, [needs('3+ won fights with and without a companion at the same level against the same enemies')]);
  const weights = pairs.map((g) => Math.min(g.with.length, g.without.length));
  const faster = 1 - sum(pairs.map((g, i) => median(g.with) * (weights[i] as number))) / sum(pairs.map((g, i) => median(g.without) * (weights[i] as number)));
  return targetRow(17, 'Companion value', threshold, [ok(faster >= 0.2 && faster <= 0.35, `${pct0(faster)} faster across ${pairs.length} level/enemy group(s)`)], { value: faster, valueText: pct0(faster) });
}

/** The Contained Tyrant scenario sims (DESIGN §19 #19), one cell per (level, class, companion, bot). */
export function tyrantCells(scenario: readonly BatchRun[]): TyrantCell[] {
  const cells = new Map<string, { level: number; classId: string; companion: boolean; bot: string; runs: RunResult[] }>();
  for (const r of scenario) {
    const level = (Object.entries(SCENARIO_PRE_TYRANT).find(([, id]) => id === r.scenario)?.[0] ?? '') as string;
    if (level === '') continue;
    const companion = r.companionId !== undefined;
    const k = `${level}|${r.result.classId}|${companion}|${r.result.bot}`;
    const cell = cells.get(k) ?? { level: Number(level), classId: r.result.classId, companion, bot: r.result.bot, runs: [] };
    cell.runs.push(r.result);
    cells.set(k, cell);
  }
  return [...cells.values()]
    .map((x): TyrantCell => {
      const won = x.runs.flatMap((r) => r.fights.filter((f) => hasEnemy(f, CONTAINED_TYRANT) && f.result === 'victory').slice(0, 1));
      return {
        level: x.level,
        classId: x.classId,
        companion: x.companion,
        bot: x.bot,
        runs: x.runs.length,
        wins: won.length,
        winRate: ratio(won.length, x.runs.length),
        medianRounds: medianOrNull(won.map((f) => f.rounds)),
        medianDamageDealt: medianOrNull(won.map((f) => f.damageDealt)),
      };
    })
    .sort((a, b) => a.level - b.level || a.classId.localeCompare(b.classId) || Number(a.companion) - Number(b.companion) || a.bot.localeCompare(b.bot));
}

function tyrantRow(cells: readonly TyrantCell[]): TargetRow {
  const threshold = 'L11 median 12–18 rounds; melee/caster win ≥ 60 % at L11, ≥ 80 % at L13; effective HP ≤ 850';
  const checks: Check[] = [];
  for (const companion of [false, true]) {
    const tag = companion ? 'with a companion' : 'solo';
    const mine = cells.filter((x) => x.companion === companion);
    if (mine.length === 0) {
      checks.push(needs(companion ? 'a companion in the pack for the pre-Tyrant scenarios' : 'a pack that places the Contained Tyrant at the Apex (pre-Tyrant scenarios)'));
      continue;
    }
    const classes = [...new Set(mine.map((x) => x.classId))].sort();
    const rounds11 = classes.flatMap((classId) => {
      const rs = mine.filter((x) => x.level === 11 && x.classId === classId && x.medianRounds !== null);
      return rs.length === 0 ? [] : [{ classId, rounds: median(rs.map((x) => x.medianRounds as number)) }];
    });
    checks.push(rounds11.length === 0 ? needs(`won Tyrant fights at L11 ${tag}`) : ok(rounds11.every((x) => x.rounds >= 12 && x.rounds <= 18), `L11 ${tag} median rounds ${rounds11.map((x) => `${x.classId} ${num(x.rounds)}`).join(', ')}`));
    for (const [level, need] of [[11, 0.6], [13, 0.8]] as const) {
      const rates = classes.flatMap((classId) => {
        const rs = mine.filter((x) => x.level === level && x.classId === classId && x.runs > 0 && (x.bot === 'melee' || x.bot === 'caster'));
        return rs.length === 0 ? [] : [{ classId, rate: Math.max(...rs.map((x) => x.winRate)) }];
      });
      checks.push(rates.length === 0 ? needs(`melee or caster runs at L${level} ${tag}`) : ok(rates.every((x) => x.rate >= need), `L${level} ${tag} win rate ${rates.map((x) => `${x.classId} ${pct0(x.rate)}`).join(', ')} (≥ ${pct0(need)})`));
    }
    const ehp = mine.flatMap((x) => (x.medianDamageDealt === null ? [] : [x.medianDamageDealt]));
    checks.push(ehp.length === 0 ? needs(`won Tyrant fights ${tag} (effective HP)`) : ok(median(ehp) <= 850, `effective HP ${tag} ${num(median(ehp))} (damage dealt in won fights)`));
  }
  return targetRow(19, 'Contained Tyrant', threshold, checks, { value: failing(checks), valueText: `${failing(checks)} check(s) failing` });
}

function unveiledRow(c: Ctx): TargetRow {
  const threshold = 'fight path L15–18: median 14–20 rounds; communion: Resolve ≥ 3 reachable from Loop 2';
  const checks: Check[] = [];
  const fights = fightsOf(c).filter((f) => hasEnemy(f, UNVEILED_TYRANT) && !f.communion && f.result === 'victory' && f.playerLevel >= 15 && f.playerLevel <= 18);
  checks.push(fights.length === 0 ? needs('Unveiled Tyrant fights won at L15–18 (no scenario starts one)') : ok(median(fights.map((f) => f.rounds)) >= 14 && median(fights.map((f) => f.rounds)) <= 20, `fight path median ${num(median(fights.map((f) => f.rounds)))} rounds (n=${fights.length})`));
  const comm = c.scenario.filter((r) => r.scenario === SCENARIO_COMMUNION);
  if (comm.length === 0) checks.push(needs('the communion_movement_2 scenario runs'));
  else {
    const reached = comm.filter((r) => r.result.maxResolve >= 3);
    checks.push(ok(reached.length > 0, `Resolve ≥ 3 reached in ${reached.length}/${comm.length} communion run(s) (${[...new Set(comm.map((r) => r.result.bot))].sort().join(', ')})`));
  }
  return targetRow(20, 'Unveiled Tyrant', threshold, checks, { value: failing(checks), valueText: `${failing(checks)} check(s) failing` });
}

function botsCompleteRow(c: Ctx): TargetRow {
  const threshold = `${RELEASE_BOTS.length} bots × every class: no engine error, ≥ 2,000 steps or a loop; ≥ 900 runs`;
  const classes = classesIn(c.main);
  const missing = RELEASE_BOTS.filter((b) => !c.main.some((r) => r.bot === b));
  const errored = c.runs.filter((r) => r.result.errors.length > 0).length;
  const incomplete = c.main.filter((r) => r.steps < 2000 && r.loops.length === 0 && r.endings.length === 0).length;
  const checks: Check[] = [ok(errored === 0, `${errored} run(s) with an engine error`), ok(incomplete === 0, `${incomplete} main run(s) ended before 2,000 steps or a loop`)];
  if (missing.length > 0) checks.push(needs(`all six bots (not run: ${missing.join(', ')})`));
  return targetRow('G1', 'Bots complete runs', threshold, checks, {
    value: errored + incomplete,
    valueText: `${errored + incomplete} bad run(s) of ${c.main.length} (${classes.length} class(es))`,
    ...withSample(c.main.length, 900),
  });
}

function coverageGateRow(c: Ctx): TargetRow {
  const threshold = 'quests, locations, endings 100 %; creatures killed ≥ 95 %; items obtained ≥ 90 %';
  const cov = c.coverage;
  const part = (label: string, covered: number, total: number, need: number): Check =>
    total === 0 ? needs(`${label} in the pack`) : ok(covered / total >= need, `${label} ${covered}/${total} (${pct0(covered / total)}, ≥ ${pct0(need)})`);
  const checks = [
    part('quests completed', cov.quests.completed.length, cov.quests.total, 1),
    part('locations visited', cov.locations.visited.length, cov.locations.total, 1),
    part('endings and closers reached', cov.endings.reached.length, cov.endings.total, 1),
    part('creatures killed', cov.creatures.killed.length, cov.creatures.total, 0.95),
    part('items obtained', cov.items.obtained.length, cov.items.total, 0.9),
  ];
  return targetRow('G4', 'Coverage of content by sims', threshold, checks, { value: failing(checks), valueText: `${failing(checks)} kind(s) short` });
}

function determinismRow(c: Ctx): TargetRow {
  const threshold = '100 % identical final state hashes in 200 sampled runs';
  const d = c.determinism;
  if (d === null || d.sampled === 0) return targetRow('G6', 'Determinism', threshold, [needs('the determinism check (--determinism > 0)')]);
  return targetRow('G6', 'Determinism', threshold, [ok(d.mismatches.length === 0, `${d.sampled - d.mismatches.length}/${d.sampled} sampled runs replayed to the same hash`)], {
    value: d.mismatches.length,
    valueText: `${d.mismatches.length} mismatch(es)`,
    ...withSample(d.sampled, 200),
  });
}

// ---- the rest of the metrics ----------------------------------------------------------------------------------------------------------------

function classBotMetrics(runs: readonly RunResult[]): ClassBotMetrics {
  const loop1 = runs.flatMap((r) => loop1Of(r) ?? []);
  const deaths = runs.map(loop1Deaths);
  const endings: Record<string, number> = {};
  for (const r of runs) for (const e of r.endings) endings[e] = (endings[e] ?? 0) + 1;
  const turns = sum(runs.map(combatTurns));
  const fights = runs.flatMap((r) => r.fights).filter((f) => finished(f) && f.mpMax > 0);
  const apex = runs.flatMap((r) => apexFight(r)?.playerLevel ?? []);
  return {
    runs: runs.length,
    loop1EscapeRate: ratio(loop1.filter((l) => isEscape(l)).length, runs.length),
    loop1ExpiryRate: ratio(loop1.filter((l) => isExpiry(l)).length, runs.length),
    loop1FallenRate: ratio(runs.filter((r) => r.fallen > 0).length, runs.length),
    loop1ClosedRate: ratio(loop1.length, runs.length),
    endings,
    medianDaysLoop1: medianOrNull(loop1.map((l) => l.daysUsed)),
    p90Days: loop1.length === 0 ? null : percentile(loop1.map((l) => l.daysUsed), 90),
    deaths: mean(deaths),
    zeroDeathShare: ratio(deaths.filter((d) => d === 0).length, runs.length),
    medianLevelAtApex: medianOrNull(apex),
    abilityActionShare: turns === 0 ? null : ratio(sum(runs.map((r) => r.combatActions['ability'] ?? 0)), turns),
    zeroMpFightShare: fights.length === 0 ? null : ratio(fights.filter((f) => f.endMp === 0).length, fights.length),
  };
}

function regionCurve(content: ContentPack, runs: readonly RunResult[]): RegionCurveRow[] {
  const byRegion = new Map<string, FightRecord[]>();
  for (const f of runs.flatMap((r) => r.fights)) {
    if (content.regions[f.regionId] === undefined) continue;
    byRegion.set(f.regionId, [...(byRegion.get(f.regionId) ?? []), f]);
  }
  return [...byRegion]
    .map(([regionId, fights]): RegionCurveRow => {
      const band = (content.regions[regionId] as NonNullable<(typeof content.regions)[string]>).levelBand;
      const done = fights.filter(finished);
      return {
        regionId,
        levelBand: [band.min, band.max],
        fights: fights.length,
        medianRounds: medianOrNull(done.map((f) => f.rounds)),
        deathRate: ratio(fights.filter((f) => f.result === 'defeat').length, fights.length),
        fleeRate: ratio(fights.filter((f) => f.result === 'fled').length, fights.length),
        avgDamageTakenPerRound: ratio(sum(fights.map((f) => f.damageTaken)), sum(fights.map((f) => f.rounds))),
      };
    })
    .sort((a, b) => a.levelBand[0] - b.levelBand[0] || a.levelBand[1] - b.levelBand[1] || a.regionId.localeCompare(b.regionId));
}

function bossStats(content: ContentPack, fights: readonly FightRecord[]): Record<string, BossStat> {
  const out: Record<string, FightRecord[]> = {};
  for (const f of fights) {
    for (const id of new Set(f.enemies)) if (content.creatures[id]?.role === 'boss') (out[id] ??= []).push(f);
  }
  return Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((id) => {
        const fs = out[id] as FightRecord[];
        const phaseReached: Record<number, number> = {};
        for (const f of fs) phaseReached[f.phase] = (phaseReached[f.phase] ?? 0) + 1;
        return [id, { fights: fs.length, winRate: ratio(fs.filter((f) => f.result === 'victory').length, fs.length), medianRounds: medianOrNull(fs.filter(finished).map((f) => f.rounds)), phaseReached }];
      }),
  );
}

function damageShares(main: readonly RunResult[]): Metrics['damageShareByClass'] {
  const totals = new Map<string, Map<string, number>>();
  for (const r of main) {
    const m = totals.get(r.classId) ?? new Map<string, number>();
    for (const [source, amount] of Object.entries(r.damageBySource)) m.set(source, (m.get(source) ?? 0) + amount);
    totals.set(r.classId, m);
  }
  const out: Metrics['damageShareByClass'] = {};
  for (const classId of [...totals.keys()].sort()) {
    const m = totals.get(classId) as Map<string, number>;
    const total = sum([...m.values()]);
    if (total === 0) continue;
    out[classId] = Object.fromEntries([...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([source, amount]) => [source, amount / total]));
  }
  return out;
}

function questMetrics(content: ContentPack, main: readonly RunResult[]): Metrics['quests'] {
  return Object.fromEntries(
    Object.keys(content.quests)
      .sort()
      .map((id) => {
        const days = main.flatMap((r) => r.questDays[id] ?? []);
        return [
          id,
          {
            started: main.filter((r) => r.questsStarted.includes(id)).length,
            completed: main.filter((r) => r.questsCompleted.includes(id)).length,
            failed: main.filter((r) => r.questsFailed.includes(id)).length,
            medianDaysToComplete: medianOrNull(days),
            completedByBots: [...new Set(main.filter((r) => r.questsCompleted.includes(id)).map((r) => r.bot))].sort(),
          },
        ];
      }),
  );
}

function echoMetrics(content: ContentPack, main: readonly RunResult[]): Metrics['echoes'] {
  return Object.fromEntries(
    Object.keys(content.echoes)
      .sort()
      .map((id) => [
        id,
        {
          gained: main.filter((r) => r.echoes.includes(id)).length,
          // a run whose Loop 1 never ended gained everything in Loop 1
          firstLoopGained: main.filter((r) => (loop1Of(r) === undefined ? r.loops.length === 0 && r.echoes.includes(id) : (loop1Of(r) as LoopRecord).echoesGained.includes(id))).length,
        },
      ]),
  );
}

function companionMetrics(content: ContentPack, main: readonly RunResult[]): Metrics['companions'] {
  return Object.fromEntries(
    Object.keys(content.companions)
      .sort()
      .map((id) => {
        const rs = main.flatMap((r) => (r.companions[id] === undefined ? [] : [r.companions[id]]));
        return [id, { recruited: rs.length, kos: sum(rs.map((x) => x.kos)), deaths: rs.filter((x) => x.died).length, avgLoyalty: mean(rs.map((x) => x.loyalty)) }];
      }),
  );
}

function sumRecords(rs: readonly Readonly<Record<string, number>>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rs) for (const [k, n] of Object.entries(r)) out[k] = (out[k] ?? 0) + n;
  return Object.fromEntries(Object.entries(out).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}

/** A run is a blocker when it recorded an error or a soft-lock, or is a script that missed its ending. */
export const isBlockerRun = (r: BatchRun): boolean => r.result.errors.length > 0 || r.result.softLock.detected || r.proof?.reached === false;

function blockersOf(runs: readonly BatchRun[]): Blocker[] {
  return runs
    .filter(isBlockerRun)
    .map((r) => ({
      pack: r.pack,
      suite: r.suite,
      bot: r.result.bot,
      classId: r.result.classId,
      seed: r.result.seed,
      ...(r.scenario === undefined ? {} : { scenario: r.scenario }),
      stopReason: r.result.stopReason,
      errors: r.result.errors,
      softLock: r.result.softLock,
      repro: r.repro,
      hasTrace: r.result.trace !== undefined,
      ...(r.proof?.reached === false ? { proofFailure: `${r.script ?? 'script'}: ${r.proof.detail}` } : {}),
    }));
}

/** Everything BALANCE.md reports for one pack. */
export function computeMetrics(input: MetricsInput): Metrics {
  const { content } = input;
  const main = input.runs.filter((r) => r.suite === 'main').map((r) => r.result);
  const scenario = input.runs.filter((r) => r.suite === 'scenario');
  const script = input.runs.filter((r) => r.suite === 'script').map((r) => r.result);
  const all = input.runs.map((r) => r.result);
  const coverage = computeCoverage(content, all);
  const ctx: Ctx = { pack: input.pack, content, runs: input.runs, main, scenario, script, all, determinism: input.determinism, coverage };

  const byClassBot: Metrics['byClassBot'] = {};
  for (const classId of classesIn(main)) {
    for (const bot of [...new Set(main.map((r) => r.bot))].sort()) {
      const rs = main.filter((r) => r.classId === classId && r.bot === bot);
      if (rs.length > 0) byClassBot[key(classId, bot)] = classBotMetrics(rs);
    }
  }
  const loops = new Map<string, number[]>();
  for (const r of main) for (const l of r.loops) loops.set(`${r.bot}|${l.loop}`, [...(loops.get(`${r.bot}|${l.loop}`) ?? []), l.daysUsed]);
  const daysByBotLoop = [...loops]
    .map(([k, days]) => ({ bot: k.split('|')[0] as string, loop: Number(k.split('|')[1]), dist: dist(days) }))
    .sort((a, b) => a.loop - b.loop || a.bot.localeCompare(b.bot));

  const shares = damageShares(main);
  const cells = tyrantCells(scenario);
  const apexGold = main.flatMap((r) => apexFight(r)?.gold ?? []);
  const endGold = main.flatMap((r) => loop1Of(r)?.gold ?? []);

  /** G5: every DESIGN §19 row measured and passing. */
  const balanceGate = (section: readonly TargetRow[]): TargetRow => {
    const failed = section.filter((r) => r.status === 'fail').length;
    const passed = section.filter((r) => r.status === 'pass').length;
    const open = section.length - failed - passed;
    const checks: Check[] = [failed > 0 ? ok(false, `${passed}/${section.length} rows pass, ${failed} fail`) : ok(true, `${passed}/${section.length} rows pass`)];
    if (open > 0 && failed === 0) checks.push(needs(`${open} row(s) the pack cannot fully measure yet`));
    return targetRow('G5', 'Balance targets (DESIGN §19)', 'every row of the table measured and passing', checks, { value: passed, valueText: `${passed}/${section.length} pass, ${failed} fail, ${open} open` });
  };
  const explorerLocations = new Set(main.filter((r) => r.bot === 'explorer').flatMap((r) => r.locationsVisited));
  const locationIds = Object.keys(content.locations).sort();

  const rows: TargetRow[] = [
    escapeRow(1, 'Every class finishes Loop 1', ctx),
    damageShareRow(ctx, shares),
    difficultyRow(ctx),
    endingsRow(ctx),
    coverageRow(5, 'Every quest completed', 'every quest completed (union of runs and scripts)', coverage.quests.completed.length, coverage.quests.total, coverage.quests.neverStarted.concat(coverage.quests.startedNeverCompleted)),
    main.some((r) => r.bot === 'explorer')
      ? coverageRow(6, 'Every location reached', 'every location visited by the explorer runs', locationIds.filter((id) => explorerLocations.has(id)).length, locationIds.length, locationIds.filter((id) => !explorerLocations.has(id)))
      : targetRow(6, 'Every location reached', 'every location visited by the explorer runs', [needs('explorer runs')]),
    softLockRow(7, 'Zero soft-locks', ctx),
    fightLengthRow(ctx),
    deathsRow(ctx),
    durationRow(ctx),
    apexLevelRow(ctx),
    abilityUsageRow(ctx),
    resourceRow(ctx),
    economyRow(ctx),
    clockRow(ctx),
    resistanceRow(ctx),
    companionRow(ctx),
    targetRow(18, 'Variance sanity', 'the ±10 % roll changes a fight\'s outcome in < 3 % of replays', [needs('a fixed-decision roll-replay harness (the ±10 % roll is an engine constant, not a tunable the sim can switch off)')]),
    tyrantRow(cells),
    unveiledRow(ctx),
  ];
  const gateRows: TargetRow[] = [botsCompleteRow(ctx), escapeRow('G2', 'Loop 1 completion', ctx), softLockRow('G3', 'Zero soft-locks', ctx), coverageGateRow(ctx)];
  const targets = [...rows, ...gateRows, balanceGate(rows), determinismRow(ctx)];

  return {
    runs: input.runs.length,
    byClassBot,
    daysByBotLoop,
    damageShareByClass: shares,
    regionCurve: regionCurve(content, main),
    bossStats: bossStats(content, input.runs.filter((r) => r.suite !== 'script').flatMap((r) => r.result.fights)),
    tyrant: cells,
    coverage,
    softLocks: all.filter((r) => r.softLock.detected).map((r) => r.softLock),
    errors: all.flatMap((r) => r.errors),
    blockers: blockersOf(input.runs),
    economy: {
      medianGoldAtApex: medianOrNull(apexGold),
      medianGoldEndOfLoop1: medianOrNull(endGold),
      purchases: sumRecords(main.map((r) => r.purchases)),
      craftsByRecipe: sumRecords(main.map((r) => r.craftsByRecipe)),
      upgradesByRarity: sumRecords(main.map((r) => r.upgradesByRarity)),
    },
    quests: questMetrics(content, main),
    echoes: echoMetrics(content, main),
    companions: companionMetrics(content, main),
    targets,
  };
}

export { coverageRatios };
