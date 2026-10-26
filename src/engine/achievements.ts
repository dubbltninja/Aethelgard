// The achievement engine (U81a, D-119; DESIGN §15.2, PLAN §5.13). An achievement is a Condition checked at its checkpoints; the
// first time it holds in a profile it is earned: `profile.achievements[id] = { loop, day, runId }`, its Resonance (0 for all
// forty today, content/shared/achievements.ts) and one `achievementUnlocked` event (the UI toast's, toastModel.ts).
//
// Checkpoints (schema/achievement.ts `CHECKPOINTS`), read from what the step did:
//   step        every accepted step in a run mode (explore, combat, dialogue, ending) — never the title or the Threshold,
//               whose state is not a run under way (First Steps would read "not at the Ruins" on the title screen)
//   combat_end  the step emitted `combatEnded`
//   day_end     the step crossed a dawn (the day of the clock grew)
//   loop_end    the step closed the loop (`loopEnded`, any outcome)
//   ending      the step closed the loop with a true ending (`loopEnded` whose outcome is not a closer)
//
// The 13 `tally_*` counters (achievements.ts header) are written into the run's `counters.custom` here, before the checks, so
// the content's `counter` atoms read them (and the UI's progress). A tally is stored only while it is not 0 (absent = 0):
//   from the profile and the run, recomputed every step:
//     tally_closer_escape (runHistory), tally_mastery_peak, tally_classes_finished (classMastery), tally_capstones_held (the
//     class's tier-5 abilities held), tally_echoes_complete, tally_bestiary_complete, tally_codex_complete, tally_map_complete
//     (every id of the pack held), tally_legendary_owned (carried or worn), tally_kills (this loop), tally_new_game_plus
//   counted by events, this loop:
//     tally_boss_untouched  a fight with a boss won while the run's `damageTaken` did not move since it began; the mark is
//                           FIGHT_MARK (damageTaken + 1 at the boss fight's start; absent outside one)
//     tally_voidforged_crafted  a `craft` whose output is a void-forged item (`item_voidforged_*`)
// Earned achievements stay earned. Pure and deterministic (no Rng); evaluation in pack order.
import type { Achievement, CHECKPOINTS } from '@schema/achievement';

type Checkpoint = (typeof CHECKPOINTS)[number];
import { dayOf, evaluate } from './conditions';
import type { ContentPack, StepCtx } from './ctx';
import { apply } from './effects';
import type { PostStepHook } from './step';
import type { Action } from './types/actions';
import type { GameEvent } from './types/events';
import type { Profile } from './types/profile';
import type { GameState, Mode } from './types/state';

/** The tallies the achievements read (content/shared/achievements.ts). */
export const TALLY_NAMES = [
  'tally_closer_escape',
  'tally_boss_untouched',
  'tally_mastery_peak',
  'tally_classes_finished',
  'tally_capstones_held',
  'tally_echoes_complete',
  'tally_bestiary_complete',
  'tally_codex_complete',
  'tally_map_complete',
  'tally_legendary_owned',
  'tally_voidforged_crafted',
  'tally_kills',
  'tally_new_game_plus',
] as const;
export type TallyName = (typeof TALLY_NAMES)[number];

/** `counters.custom` key: the run's `damageTaken` + 1 when the boss fight under way began (absent outside one). */
export const FIGHT_MARK = 'fight_boss_damage_mark';
/** A capstone is a tier-5 ability (DESIGN §5.1). */
export const CAPSTONE_TIER = 5;
/** Void-forged items (DESIGN §8.5): the outputs of the three void-forged recipes. */
export const VOIDFORGED_PREFIX = 'item_voidforged_';

const RUN_MODES: readonly Mode[] = ['explore', 'combat', 'dialogue', 'ending'];
const CLOSERS: readonly string[] = ['closer_escape', 'closer_fall'];

/** The pack's id lists the completeness tallies compare against (built once per pack). */
interface PackIds {
  echoes: readonly string[];
  creatures: readonly string[];
  codex: readonly string[];
  locations: readonly string[];
}
const packIds = new WeakMap<ContentPack, PackIds>();
function idsOf(content: ContentPack): PackIds {
  let ids = packIds.get(content);
  if (ids === undefined) {
    ids = { echoes: Object.keys(content.echoes), creatures: Object.keys(content.creatures), codex: Object.keys(content.codex), locations: Object.keys(content.locations) };
    packIds.set(content, ids);
  }
  return ids;
}

/**
 * 1 when every id of a pack table is held, else 0 (an empty table is never complete). `size` is an upper bound of what is held:
 * below the table's size the answer is 0 without building a set (the common case, every step of the sims).
 */
function complete(ids: readonly string[], size: number, held: () => ReadonlySet<string>): number {
  if (ids.length === 0 || size < ids.length) return 0;
  const set = held();
  for (const id of ids) if (!set.has(id)) return 0;
  return 1;
}

/** The tallies read from the profile and the run (all but the two event counts). */
export function derivedTallies(s: GameState, p: Readonly<Profile>, content: ContentPack): Record<Exclude<TallyName, 'tally_boss_untouched' | 'tally_voidforged_crafted'>, number> {
  const ids = idsOf(content);
  let peak = 0;
  let finished = 0;
  for (const id in p.classMastery) {
    const m = p.classMastery[id]!;
    if (m.mastered.length > peak) peak = m.mastered.length;
    if (m.loopsPlayed > 0) finished += 1;
  }
  const own = content.index.abilitiesByClass[s.player.classId] ?? [];
  let capstones = 0;
  for (const id of s.player.abilitiesUnlocked) if (content.abilities[id]?.tier === CAPSTONE_TIER && own.includes(id)) capstones += 1;
  let legendary = 0;
  for (const i of s.player.inventory) if (i.rarity === 'legendary') legendary += 1;
  const eq = s.player.equipment;
  for (const key in eq) if (eq[key as keyof typeof eq]?.rarity === 'legendary') legendary += 1;
  let kills = 0;
  for (const id in s.counters.kills) kills += s.counters.kills[id]!;
  let escapes = 0;
  for (const r of p.runHistory) if (r.outcome === 'closer_escape') escapes += 1;
  return {
    tally_closer_escape: escapes,
    tally_mastery_peak: peak,
    tally_classes_finished: finished,
    tally_capstones_held: capstones,
    tally_echoes_complete: complete(ids.echoes, p.echoes.length + s.echoesThisLoop.length, () => new Set([...p.echoes, ...s.echoesThisLoop])),
    tally_bestiary_complete: complete(ids.creatures, Object.keys(p.bestiary).length, () => new Set(Object.keys(p.bestiary))),
    tally_codex_complete: complete(ids.codex, p.codexUnlocked.length, () => new Set(p.codexUnlocked)),
    tally_map_complete: complete(ids.locations, p.mapKnowledge.length + s.world.discovered.length, () => new Set([...p.mapKnowledge, ...s.world.discovered])),
    tally_legendary_owned: legendary,
    tally_kills: kills,
    tally_new_game_plus: p.newGamePlus,
  };
}

/** Sets a run counter, keeping 0 absent. */
function setCounter(s: GameState, name: string, value: number): void {
  if (value === 0) {
    if (name in s.counters.custom) delete s.counters.custom[name];
  } else if (s.counters.custom[name] !== value) s.counters.custom[name] = value;
}

const bump = (s: GameState, name: string): void => setCounter(s, name, (s.counters.custom[name] ?? 0) + 1);

/** The step's two event-counted tallies: a boss fight won untouched; a void-forged craft. */
function countEvents(ctx: StepCtx, before: GameState | undefined, action: Action | undefined): void {
  const { s, content } = ctx;
  for (const e of ctx.events) {
    if (e.t === 'combatStarted') {
      const boss = e.enemies.some((x) => content.creatures[x.creatureId]?.role === 'boss');
      setCounter(s, FIGHT_MARK, boss ? (before?.counters.damageTaken ?? s.counters.damageTaken) + 1 : 0);
    } else if (e.t === 'combatEnded') {
      const mark = s.counters.custom[FIGHT_MARK];
      if (mark !== undefined && e.result === 'victory' && s.counters.damageTaken + 1 === mark) bump(s, 'tally_boss_untouched');
      setCounter(s, FIGHT_MARK, 0);
    }
  }
  if (action?.type === 'craft' && before !== undefined && s.counters.itemsCrafted > before.counters.itemsCrafted) {
    if (content.recipes[action.recipeId]?.output.itemId.startsWith(VOIDFORGED_PREFIX) === true) bump(s, 'tally_voidforged_crafted');
  }
}

/** Writes every tally into the run's counters (call before the checks). */
export function writeTallies(ctx: StepCtx, before?: GameState, action?: Action): void {
  countEvents(ctx, before, action);
  const derived = derivedTallies(ctx.s, ctx.profile, ctx.content);
  for (const [name, value] of Object.entries(derived)) setCounter(ctx.s, name, value);
}

/** The checkpoints this step reached (see the header). */
export function checkpointsOf(s: GameState, events: readonly GameEvent[], before?: GameState): Set<Checkpoint> {
  const out = new Set<Checkpoint>();
  if (!RUN_MODES.includes(s.mode)) return out;
  out.add('step');
  if (events.some((e) => e.t === 'combatEnded')) out.add('combat_end');
  if (before !== undefined && before.mode !== 'title' && dayOf(s.clock.ticks) > dayOf(before.clock.ticks)) out.add('day_end');
  for (const e of events) {
    if (e.t !== 'loopEnded') continue;
    out.add('loop_end');
    if (!CLOSERS.includes(e.outcome)) out.add('ending');
  }
  return out;
}

/** Earns `def` now: the record, its Resonance, the event. False when it was earned already. */
export function earnAchievement(ctx: StepCtx, def: Achievement): boolean {
  if (ctx.profile.achievements[def.id] !== undefined) return false;
  const { s } = ctx;
  ctx.profileDraft().achievements[def.id] = { loop: s.meta.loop, day: dayOf(s.clock.ticks), runId: s.meta.runId };
  if (def.resonance > 0) apply({ resonance: def.resonance }, ctx, { source: `achievement:${def.id}` });
  ctx.emit({ t: 'achievementUnlocked', achievementId: def.id });
  return true;
}

const ordered = new WeakMap<ContentPack, readonly Achievement[]>();
const achievementsOf = (content: ContentPack): readonly Achievement[] => {
  let list = ordered.get(content);
  if (list === undefined) {
    list = Object.values(content.achievements).filter((a): a is Achievement => a !== undefined);
    ordered.set(content, list);
  }
  return list;
};

/** Every not-yet-earned achievement with a checkpoint reached this step whose condition holds is earned (pack order). */
export function checkAchievements(ctx: StepCtx, reached: ReadonlySet<Checkpoint>): string[] {
  if (reached.size === 0) return [];
  const earned: string[] = [];
  for (const def of achievementsOf(ctx.content)) {
    if (ctx.profile.achievements[def.id] !== undefined) continue;
    if (!def.checkpoints.some((c) => reached.has(c))) continue;
    if (evaluate(def.when, ctx.s, ctx.profile, ctx.content) && earnAchievement(ctx, def)) earned.push(def.id);
  }
  return earned;
}

/** Post-step hook (after the codex pass, so this step's codex unlocks and loop-end writes are seen): tallies, then the checks. */
export const achievementPostStep: PostStepHook = (ctx, before, _beforeProfile, action) => {
  writeTallies(ctx, before, action);
  checkAchievements(ctx, checkpointsOf(ctx.s, ctx.events, before));
};
