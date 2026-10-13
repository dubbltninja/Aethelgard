// Condition evaluator (PLAN §4.9): `evaluate` is pure (no rng, no writes) over state + profile + content; `explain`
// gives the per-atom reasons the UI shows on locks ("why can't I") and on the Threshold eligibility panel.
// Semantics (PLAN §4.9, DESIGN §13.3): `item` counts inventory and equipped; `killed` reads `counters.kills` (this
// loop) and with `sinceStage` subtracts the kill baseline recorded when the quest's current stage began
// (`QuestState.counters['kills:<cr_id>']`, written on stage entry); `quest` with neither stage nor status means active
// or completed; `clock.daysLeft` = ⌊(limitTicks − ticks) / 4⌋; `counter` names `quests_completed` and
// `factions_trusted` are computed by the engine; `beforeDay`/`beforeResets` and `resolve` are false outside the
// Silverwood Before / communion.
import type { Condition, ConditionAtoms, ConditionKey, Range } from '@schema/condition';
import type { ContentPack } from './ctx';
import type { Profile } from './types/profile';
import type { FactionId, GameState } from './types/state';

/** Context for atoms that depend on who is asking: `killed.sinceStage` needs the quest whose stage it is. */
export interface EvalScope {
  questId?: string;
}

export interface Explanation {
  ok: boolean;
  parts: { text: string; ok: boolean }[];
}

interface Env {
  s: GameState;
  p: Readonly<Profile>;
  c: ContentPack;
  scope: EvalScope;
}

// ---- shared readers (also used by effects.ts and later reducers) -----------------------------------------------------

export const WATCH_NAMES = ['dawn', 'day', 'dusk', 'night'] as const;
export const TICKS_PER_DAY = 4;
export const FACTIONS: readonly FactionId[] = ['remnants', 'weavers', 'ironclad'];
/** D-014 tier lower bounds; `config.repTiers` overrides. */
export const DEFAULT_REP_TIERS = { hostile: -100, wary: -39, neutral: -9, trusted: 20, sworn: 60 } as const;
export type RepTier = keyof typeof DEFAULT_REP_TIERS;

/** Breach Clock day, 1-based (tick 0 = Day 1 Dawn). */
export const dayOf = (ticks: number): number => Math.floor(ticks / TICKS_PER_DAY) + 1;
/** 0 dawn, 1 day, 2 dusk, 3 night. */
export const watchOf = (ticks: number): 0 | 1 | 2 | 3 => (ticks % TICKS_PER_DAY) as 0 | 1 | 2 | 3;
/** Dawns before the limit (PLAN §4.9). */
export const daysLeft = (clock: { ticks: number; limitTicks: number }): number =>
  Math.floor((clock.limitTicks - clock.ticks) / TICKS_PER_DAY);

export function inRange(value: number, range: { min?: number; max?: number }): boolean {
  return (range.min === undefined || value >= range.min) && (range.max === undefined || value <= range.max);
}

export function repTier(value: number, content: ContentPack): RepTier {
  const t = content.config.repTiers ?? DEFAULT_REP_TIERS;
  return value >= t.sworn ? 'sworn' : value >= t.trusted ? 'trusted' : value >= t.neutral ? 'neutral' : value >= t.wary ? 'wary' : 'hostile';
}

/** Quantity carried: inventory stacks plus equipped items (PLAN §4.9; the "satchel" is the inventory). */
export function itemCount(s: GameState, itemId: string): number {
  let n = 0;
  for (const item of s.player.inventory) if (item.itemId === itemId) n += item.qty;
  for (const item of Object.values(s.player.equipment)) if (item?.itemId === itemId) n += item.qty;
  return n;
}

export function isFlagSet(s: GameState, flag: string): boolean {
  const v = s.flags[flag];
  return v !== undefined && v !== false;
}

export function hasEcho(s: GameState, p: Readonly<Profile>, echo: string): boolean {
  return s.echoesThisLoop.includes(echo) || p.echoes.includes(echo);
}

/** Engine counter `quests_completed` (D-048): completed quests whose `countsForApex` is not false. */
export function questsCompleted(s: GameState, content: ContentPack): number {
  let n = 0;
  for (const [id, q] of Object.entries(s.quests)) if (q.status === 'completed' && content.quests[id]?.countsForApex !== false) n++;
  return n;
}

/** Engine counter `factions_trusted`: factions at Trusted or better. */
export function factionsTrusted(s: GameState, content: ContentPack): number {
  return FACTIONS.filter((f) => {
    const tier = repTier(s.reputation[f], content);
    return tier === 'trusted' || tier === 'sworn';
  }).length;
}

export function counterValue(s: GameState, content: ContentPack, name: string): number {
  if (name === 'quests_completed') return questsCompleted(s, content);
  if (name === 'factions_trusted') return factionsTrusted(s, content);
  return s.counters.custom[name] ?? 0;
}

/** Kills of `creatureId` this loop; with a quest scope, only those since its current stage began. */
export function killsSince(s: GameState, creatureId: string, questId: string | undefined): number {
  const total = s.counters.kills[creatureId] ?? 0;
  const baseline = questId ? (s.quests[questId]?.counters[`kills:${creatureId}`] ?? 0) : 0;
  return total - baseline;
}

/** The single key of a parsed Condition/Effect and its value. Throws on a malformed (unparsed) object. */
export function atomOf<K extends string>(obj: object, what: string): [K, unknown] {
  const keys = Object.keys(obj);
  if (keys.length !== 1) throw new Error(`${what}: expected exactly one key, got ${JSON.stringify(obj)}`);
  const key = keys[0] as K;
  return [key, (obj as Record<string, unknown>)[key]];
}

// ---- evaluate --------------------------------------------------------------------------------------------------------

type Evaluators = { readonly [K in ConditionKey]: (v: ConditionAtoms[K], env: Env) => boolean };

const companion = (env: Env, id: string) => {
  const c = env.s.companions.recruited[id];
  return c && c.recruited && !c.dead ? c : undefined;
};

const EVALUATORS: Evaluators = {
  all: (list, env) => list.every((c) => run(c, env)),
  any: (list, env) => list.some((c) => run(c, env)),
  not: (c, env) => !run(c, env),
  flag: (id, { s }) => isFlagSet(s, id),
  echo: (id, { s, p }) => hasEcho(s, p, id),
  quest: (q, { s }) => {
    const qs = s.quests[q.id];
    const status = qs?.status ?? 'inactive';
    if (q.status === undefined && q.stage === undefined) return status === 'active' || status === 'completed';
    if (q.status !== undefined && status !== q.status) return false;
    if (q.stage !== undefined && (status === 'inactive' || qs?.stage !== q.stage)) return false;
    return true;
  },
  item: (i, { s }) => itemCount(s, i.id) >= (i.count ?? 1),
  rep: (r, { s }) => inRange(s.reputation[r.faction], r),
  loop: (r, { s }) => inRange(s.meta.loop, r),
  day: (r, { s }) => inRange(dayOf(s.clock.ticks), r),
  level: (r, { s }) => inRange(s.player.level, r),
  watch: (w, { s }) => WATCH_NAMES[watchOf(s.clock.ticks)] === w,
  clock: (c, { s }) => inRange(daysLeft(s.clock), c.daysLeft),
  beforeDay: (d, { s }) => s.before?.day === d,
  beforeResets: (r, { s }) => s.before !== null && inRange(s.before.resets, r),
  class: (id, { s }) => s.player.classId === id,
  stat: (st, { s }) => inRange(s.player.stats[st.name], st),
  companion: (c, env) => {
    const state = c.state ?? 'active';
    const cs = companion(env, c.id);
    if (!cs) return false;
    if (state === 'recruited') return true;
    if (state === 'ko') return cs.ko;
    return env.s.companions.activeId === c.id;
  },
  loyalty: (l, env) => {
    const cs = companion(env, l.companion);
    return cs !== undefined && inRange(cs.loyalty, l);
  },
  corruption: (r, { s }) => inRange(s.player.corruption, r),
  location: (id, { s }) => s.world.currentLocationId === id,
  killed: (k, { s, scope }) => killsSince(s, k.id, k.sinceStage ? scope.questId : undefined) >= (k.count ?? 1),
  counter: (c, { s, c: content }) => inRange(counterValue(s, content, c.name), c),
  resolve: (r, { s }) => {
    const communion = s.combat?.communion;
    return communion != null && inRange(communion.resolve, r);
  },
  modifier: (id, { s }) => s.meta.modifiers.includes(id),
};

function run(cond: Condition, env: Env): boolean {
  const [key, value] = atomOf<ConditionKey>(cond, 'evaluate');
  const fn = EVALUATORS[key] as ((v: unknown, env: Env) => boolean) | undefined;
  if (!fn) throw new Error(`evaluate: unknown condition atom '${key}'`);
  return fn(value, env);
}

/** Pure, side-effect free, no rng (PLAN §4.9). `scope.questId` scopes `killed.sinceStage`. */
export function evaluate(cond: Condition, state: GameState, profile: Readonly<Profile>, content: ContentPack, scope: EvalScope = {}): boolean {
  return run(cond, { s: state, p: profile, c: content, scope });
}

// ---- explain ---------------------------------------------------------------------------------------------------------

const nameIn = (table: Record<string, { name?: string }> | Partial<Record<string, { name?: string }>>, id: string): string =>
  table[id]?.name ?? id;

/** "≥ 6", "≤ 1", "2–5", "= 3", "any". */
export function rangeText(r: Range): string {
  if (r.min !== undefined && r.max !== undefined) return r.min === r.max ? `= ${r.min}` : `${r.min}–${r.max}`;
  if (r.min !== undefined) return `≥ ${r.min}`;
  if (r.max !== undefined) return `≤ ${r.max}`;
  return 'any';
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const humanize = (id: string): string => capitalize(id.replace(/_/g, ' '));

type Describers = { readonly [K in ConditionKey]: (v: ConditionAtoms[K], env: Env) => string };

const DESCRIBERS: Describers = {
  all: (list, env) => list.map((c) => describe(c, env)).join(' and '),
  any: (list, env) => `One of: ${list.map((c) => describe(c, env)).join(' / ')}`,
  not: (c, env) => `Not (${describe(c, env)})`,
  flag: (id) => `Flag ${id}`,
  echo: (id, { c }) => `Echo: ${nameIn(c.echoes, id)}`,
  quest: (q, { c }) => {
    const name = nameIn(c.quests, q.id);
    if (q.stage !== undefined) return `${name}: at stage ${q.stage}${q.status ? ` (${q.status})` : ''}`;
    return q.status !== undefined ? `${name}: ${q.status}` : `${name}: started`;
  },
  item: (i, { s, c }) => `Carry ${(i.count ?? 1) > 1 ? `${i.count} × ` : ''}${nameIn(c.items, i.id)} (have ${itemCount(s, i.id)})`,
  rep: (r, { s, c }) => `${nameIn(c.factions, r.faction)} reputation ${rangeText(r)} (now ${s.reputation[r.faction]})`,
  loop: (r, { s }) => `Loop ${rangeText(r)} (now ${s.meta.loop})`,
  day: (r, { s }) => `Day ${rangeText(r)} (now ${dayOf(s.clock.ticks)})`,
  level: (r, { s }) => `Level ${rangeText(r)} (now ${s.player.level})`,
  watch: (w, { s }) => `At ${w} (now ${WATCH_NAMES[watchOf(s.clock.ticks)]})`,
  clock: (k, { s }) => `Dawns left ${rangeText(k.daysLeft)} (now ${daysLeft(s.clock)})`,
  beforeDay: (d) => `Silverwood Before, day ${d}`,
  beforeResets: (r) => `Silverwood Before resets ${rangeText(r)}`,
  class: (id, { c }) => `Class: ${nameIn(c.classes, id)}`,
  stat: (st, { s }) => `${capitalize(st.name)} ${rangeText(st)} (now ${s.player.stats[st.name]})`,
  companion: (k, { c }) => {
    const name = nameIn(c.companions, k.id);
    const state = k.state ?? 'active';
    return state === 'active' ? `${name} in the party` : state === 'recruited' ? `${name} recruited` : `${name} knocked out`;
  },
  loyalty: (l, env) => {
    const cs = companion(env, l.companion);
    return `${nameIn(env.c.companions, l.companion)} loyalty ${rangeText(l)}${cs ? ` (now ${cs.loyalty})` : ''}`;
  },
  corruption: (r, { s }) => `Corruption ${rangeText(r)} (now ${s.player.corruption})`,
  location: (id, { c }) => `At ${nameIn(c.locations, id)}`,
  killed: (k, { s, c, scope }) =>
    `Defeat ${k.count ?? 1} × ${nameIn(c.creatures, k.id)}${k.sinceStage ? ' (this stage)' : ''} (${killsSince(s, k.id, k.sinceStage ? scope.questId : undefined)}/${k.count ?? 1})`,
  counter: (k, { s, c }) => `${humanize(k.name)} ${rangeText(k)} (now ${counterValue(s, c, k.name)})`,
  resolve: (r, { s }) => `Resolve ${rangeText(r)}${s.combat?.communion ? ` (now ${s.combat.communion.resolve})` : ' (communion only)'}`,
  modifier: (id, { c }) => `Modifier: ${nameIn(c.modifiers, id)}`,
};

function describe(cond: Condition, env: Env): string {
  const [key, value] = atomOf<ConditionKey>(cond, 'explain');
  return (DESCRIBERS[key] as (v: unknown, env: Env) => string)(value, env);
}

function explainIn(cond: Condition, env: Env): Explanation {
  if ('all' in cond) {
    const parts = cond.all.flatMap((c) => explainIn(c, env).parts);
    return { ok: parts.every((part) => part.ok), parts };
  }
  const ok = run(cond, env);
  return { ok, parts: [{ text: describe(cond, env), ok }] };
}

/**
 * Human-readable reasons for a condition (PLAN §4.9): `all` is flattened into one part per child; every other atom
 * (including `any` and `not`) is one part. `ok` always equals `evaluate()`.
 */
export function explain(cond: Condition, state: GameState, profile: Readonly<Profile>, content: ContentPack, scope: EvalScope = {}): Explanation {
  return explainIn(cond, { s: state, p: profile, c: content, scope });
}
