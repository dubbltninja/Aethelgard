// Codex entries unlock by their `unlockWhen` (U62a, D-131; STORY §14, DESIGN §6.2). At the end of every step the codex pass
// evaluates the condition of each still-locked entry that the step could have changed and unlocks those that hold, through
// the same path as the `unlockCodex` effect (`unlockCodexEntry`: the profile's `codexUnlocked` plus a `codexUnlocked` event,
// so the toast, Resonance and achievements see it). An entry without `unlockWhen` stays effect-only; an `unlockedAtStart`
// entry is unlocked already.
//
// Cost (`step` runs millions of times in the sims): entries are indexed by the atoms their condition reads — echo,
// location, region, killed, quest, companion, corruption, flag, item. A step compares the state and profile it was given
// with the ones it built, only along those atoms (the indexed ids, a few list lengths), and re-evaluates only the entries
// under an atom that changed. An atom of any other kind (none today) puts its entry on the `always` list, evaluated every
// step. Actions that replace the run (a new game, a load, a new loop, New Game+) evaluate every locked entry once.
// Pure and deterministic: no Rng, the order is the pack's.
import type { Condition } from '@schema/condition';
import type { CodexEntry } from '@schema/codex';
import { evaluate, isFlagSet, itemCount } from './conditions';
import type { ContentPack, StepCtx } from './ctx';
import type { Action } from './types/actions';
import type { Profile } from './types/profile';
import type { GameState } from './types/state';

/** The atoms the index keys by id; any other atom lands on `always`. */
export const INDEXED_ATOMS = ['echo', 'location', 'region', 'killed', 'quest', 'companion', 'corruption', 'flag', 'item'] as const;
export type IndexedAtom = (typeof INDEXED_ATOMS)[number];

/** Entry ids by the ids their condition reads. Lists keep the pack's order. */
export interface CodexUnlockIndex {
  /** Every entry the pass can unlock (has `unlockWhen`, not `unlockedAtStart`), in pack order. */
  entries: readonly CodexEntry[];
  /** Position of each entry in `entries` (the evaluation order). */
  order: ReadonlyMap<string, number>;
  echo: readonly string[];
  corruption: readonly string[];
  always: readonly string[];
  location: ReadonlyMap<string, readonly string[]>;
  region: ReadonlyMap<string, readonly string[]>;
  killed: ReadonlyMap<string, readonly string[]>;
  quest: ReadonlyMap<string, readonly string[]>;
  companion: ReadonlyMap<string, readonly string[]>;
  flag: ReadonlyMap<string, readonly string[]>;
  item: ReadonlyMap<string, readonly string[]>;
}

/** Every (atom, id) a condition reads (`all`, `any`, `not` unwrapped); `id` is null for atoms without one. */
export function conditionAtoms(cond: Condition | undefined): { atom: string; id: string | null }[] {
  const out: { atom: string; id: string | null }[] = [];
  const walk = (c: unknown): void => {
    if (typeof c !== 'object' || c === null) return;
    for (const [key, value] of Object.entries(c)) {
      if (key === 'all' || key === 'any') (value as unknown[]).forEach(walk);
      else if (key === 'not') walk(value);
      else if (typeof value === 'string') out.push({ atom: key, id: value });
      else if (typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string') out.push({ atom: key, id: (value as { id: string }).id });
      else out.push({ atom: key, id: null });
    }
  };
  walk(cond);
  return out;
}

const cache = new WeakMap<ContentPack, CodexUnlockIndex>();

/** The pack's index, built once per pack. */
export function codexUnlockIndex(content: ContentPack): CodexUnlockIndex {
  const hit = cache.get(content);
  if (hit !== undefined) return hit;
  const entries: CodexEntry[] = [];
  const keyed = { location: new Map(), region: new Map(), killed: new Map(), quest: new Map(), companion: new Map(), flag: new Map(), item: new Map() } as Record<
    'location' | 'region' | 'killed' | 'quest' | 'companion' | 'flag' | 'item',
    Map<string, string[]>
  >;
  const echo: string[] = [];
  const corruption: string[] = [];
  const always: string[] = [];
  const add = (list: string[], id: string): void => {
    if (list[list.length - 1] !== id) list.push(id);
  };
  for (const entry of Object.values(content.codex)) {
    if (entry === undefined || entry.unlockWhen === undefined || entry.unlockedAtStart) continue;
    entries.push(entry);
    for (const { atom, id } of conditionAtoms(entry.unlockWhen)) {
      if (atom === 'echo') add(echo, entry.id);
      else if (atom === 'corruption') add(corruption, entry.id);
      else if (id !== null && Object.hasOwn(keyed, atom)) {
        const map = keyed[atom as keyof typeof keyed];
        const list = map.get(id) ?? [];
        add(list, entry.id);
        map.set(id, list);
      } else add(always, entry.id);
    }
  }
  const index: CodexUnlockIndex = { entries, order: new Map(entries.map((e, i) => [e.id, i])), echo, corruption, always, ...keyed };
  cache.set(content, index);
  return index;
}

/** The `unlockCodex` effect's path: once per profile, into `codexUnlocked`, with the event. False when already unlocked. */
export function unlockCodexEntry(ctx: StepCtx, id: string): boolean {
  if (ctx.profile.codexUnlocked.includes(id)) return false;
  ctx.profileDraft().codexUnlocked.push(id);
  ctx.emit({ t: 'codexUnlocked', codexId: id });
  return true;
}

/** Actions that replace the run: every locked entry is evaluated once after them. */
const FULL_SWEEP: ReadonlySet<Action['type']> = new Set(['newGame', 'load', 'newLoop', 'newGamePlus']);

const regionOf = (content: ContentPack, locationId: string): string | undefined => content.locations[locationId]?.regionId;

function companionKey(s: GameState, id: string): string {
  const c = s.companions.recruited[id];
  if (c === undefined) return '';
  return `${c.recruited ? 1 : 0}${c.dead ? 1 : 0}${c.ko ? 1 : 0}${s.companions.activeId === id ? 1 : 0}${c.waitingAt ?? ''}`;
}

function questKey(s: GameState, id: string): string {
  const q = s.quests[id];
  return q === undefined ? '' : `${q.status}:${q.stage ?? ''}`;
}

/**
 * The ids of the entries whose atoms differ between `before`/`beforeProfile` and the step's result, or every entry when
 * `full`. Exported for tests (the index).
 */
export function dirtyCodexEntries(index: CodexUnlockIndex, before: GameState, beforeProfile: Readonly<Profile>, after: GameState, afterProfile: Readonly<Profile>, content: ContentPack, full = false): string[] {
  if (index.entries.length === 0) return [];
  if (full) return index.entries.map((e) => e.id);
  const marked = new Set<string>(index.always);
  const mark = (ids: readonly string[] | undefined): void => {
    if (ids !== undefined) for (const id of ids) marked.add(id);
  };
  const fromLoc = before.world.currentLocationId;
  const toLoc = after.world.currentLocationId;
  if (fromLoc !== toLoc) {
    mark(index.location.get(fromLoc));
    mark(index.location.get(toLoc));
    const fromRegion = regionOf(content, fromLoc);
    const toRegion = regionOf(content, toLoc);
    if (fromRegion !== toRegion) {
      if (fromRegion !== undefined) mark(index.region.get(fromRegion));
      if (toRegion !== undefined) mark(index.region.get(toRegion));
    }
  }
  if (before.echoesThisLoop.length !== after.echoesThisLoop.length || beforeProfile.echoes.length !== afterProfile.echoes.length) mark(index.echo);
  if (before.player.corruption !== after.player.corruption) mark(index.corruption);
  for (const [flag, ids] of index.flag) if (isFlagSet(before, flag) !== isFlagSet(after, flag)) mark(ids);
  for (const [item, ids] of index.item) if (itemCount(before, item) !== itemCount(after, item)) mark(ids);
  for (const [creature, ids] of index.killed) {
    if ((before.counters.kills[creature] ?? 0) !== (after.counters.kills[creature] ?? 0) || (beforeProfile.bestiary[creature]?.killed ?? 0) !== (afterProfile.bestiary[creature]?.killed ?? 0)) mark(ids);
  }
  for (const [quest, ids] of index.quest) if (questKey(before, quest) !== questKey(after, quest)) mark(ids);
  for (const [companion, ids] of index.companion) if (companionKey(before, companion) !== companionKey(after, companion)) mark(ids);
  if (marked.size === 0) return [];
  return [...marked].sort((a, b) => (index.order.get(a) ?? 0) - (index.order.get(b) ?? 0));
}

/**
 * The codex pass: the last post-step hook. `before`/`beforeProfile` are what `step` was given (without them it does nothing);
 * `action` decides a full sweep.
 * Unlocks (in pack order) every still-locked entry the step could have changed whose `unlockWhen` now holds.
 */
export function codexUnlockPass(ctx: StepCtx, before?: GameState, beforeProfile?: Readonly<Profile>, action?: Action): void {
  if (before === undefined || beforeProfile === undefined) return; // a hook driven by hand (tests): nothing to compare with
  const index = codexUnlockIndex(ctx.content);
  const full = action !== undefined && FULL_SWEEP.has(action.type);
  const dirty = dirtyCodexEntries(index, before, beforeProfile, ctx.s, ctx.profile, ctx.content, full);
  for (const id of dirty) {
    if (ctx.profile.codexUnlocked.includes(id)) continue;
    const entry = index.entries[index.order.get(id) ?? -1];
    if (entry?.unlockWhen !== undefined && evaluate(entry.unlockWhen, ctx.s, ctx.profile, ctx.content)) unlockCodexEntry(ctx, id);
  }
}
