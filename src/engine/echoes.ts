// Echo rules the engine owns (DESIGN §10.4–10.5, §12.5, §15.1; STORY §5.5, §12; PLAN §8.1 "echoes"; D-010, D-066.20,
// D-067.15/.16, D-082). U32.
//
// Granting has one path, effects.ts `grantEcho`: an Echo is granted at most once per loop (idempotent; `echoGained`
// says `firstEver` when the profile did not hold it yet), never in a loop that already holds an Echo it is
// `exclusiveWith` (either record may name the other; the next loop allows it), and its `onGrant` effects apply with
// the grant.
//
// The engine's own grants (`echoPostStep`, a post-step hook that runs just before the loop-end hook):
//   - `echo_tyrant_jailer` the moment any two of STORY §5.5's five sources are held (D-067.16). The fifth source is a
//     pair (the thirtieth dawn with the Ledger read); sources earned in different loops count, so the profile's Echoes
//     count too. Checked in play and on the step that closes a loop (so the record carries it).
//   - At a loop's end (the step that enters ending mode, before the record is written): a companion's bond Echo when
//     its loyalty is ≥ 50, and `echo_ironclad_oath` / `echo_weaver_sign` when that faction stands at Trusted or better
//     (STORY §12 "at a loop's end").
//
// Loop-start effects — DESIGN §10.5's mechanical rows that are not content conditions:
//   - rep starts (`beginLoop` → `applyLoopStartEchoes`): `echo_ilyra_watchword` Remnants 20, `echo_weaver_sign`
//     Weavers 20, `echo_ironclad_oath` Ironclad 20. The faction starts at that value (a start never lowers it).
//   - bond loyalty: a companion whose bond Echo is held starts the loop at 25 — applied when it is recruited
//     (`companionRecruited`, post-step), since companions join during the loop (DESIGN §12.5; Brak's is
//     `echo_brak_lives`).
//   - shortcuts (the quest's own `shortcuts`, D-010: `{ echo, skipTo, text }`): with that Echo held a quest opens at
//     `skipTo` (the furthest one when several apply; `text` is logged) — applied when it starts (`questStarted`,
//     post-step), or at loop start for a quest already running then (one started at the Threshold, D-067.15).
//   Mute Ley (`disable_echo_shortcuts`, DESIGN §15.1) turns off rep starts and shortcuts; bond starts, dialogue
//   unlocks, routes and ending flags stay.
// Routes, dialogue unlocks and ending flags are content conditions: `{ echo }` on exits (a `hidden` exit appears once
// its `when` holds, explore.ts `exitState`; WORLD §11.3 owns the gates), on dialogue choices and on ending
// requirements. The engine adds nothing for them.
//
// The tables key Echoes by id; an Echo the engine grants is also on `ENGINE_GRANTED_ECHOES` (schema/echo.ts, D-082).
import { hasEcho, repTier } from './conditions';
import type { ContentPack, StepCtx } from './ctx';
import { enterStage } from './effects';
import { grantKnownEcho } from './horde';
import type { PostStepHook } from './step';
import type { Profile } from './types/profile';
import type { FactionId, GameState, Mode } from './types/state';

/** DESIGN §10.5 / §12.5: a bond Echo starts its companion at this loyalty. */
export const BOND_LOYALTY = 25;
/** STORY §12: loyalty at a loop's end that earns the bond Echo. */
export const BOND_ECHO_MIN_LOYALTY = 50;
export const ECHO_TYRANT_JAILER = 'echo_tyrant_jailer';
/** D-067.16: two of the five sources. */
export const JAILER_SOURCES_NEEDED = 2;

/** STORY §5.5: each source Echo → its source number; source 5 is held only with both of its Echoes. */
export const JAILER_SOURCES: Readonly<Record<string, number>> = {
  echo_flickering_man: 1, // Dask's whole sentence (`q_the_flickering_man`)
  echo_tyrant_speaks: 2, // the Tyrant itself (*Listen* at the Apex)
  echo_breach_recoil: 3, // Nyx reading Oriel's scroll
  echo_ninth_verse_unfinished: 4, // the Echo Crystal heard
  echo_thirtieth_dawn: 5, // the thirtieth dawn …
  echo_seven_wayfinders: 5, // … with Keeper Dray's Ledger read
};

/** Companion → the Echo that starts it at loyalty 25 (DESIGN §10.5). */
export const BOND_ECHOES: Readonly<Record<string, string>> = {
  nyx: 'echo_nyx_bond',
  ilyra: 'echo_ilyra_bond',
  dask: 'echo_dask_bond',
  mireya: 'echo_mireya_bond',
  caelum: 'echo_caelum_bond',
  brak: 'echo_brak_lives', // Brak's equivalent; `q_the_line_he_holds` grants it, not his loyalty
};
/** The bond Echoes a loop's end grants by loyalty (all but Brak's). */
export const LOOP_END_BOND_COMPANIONS: readonly string[] = ['nyx', 'ilyra', 'dask', 'mireya', 'caelum'];

/** DESIGN §10.5 Rep rows: Echo → the faction's start value. */
export const ECHO_REP_STARTS: Readonly<Record<string, { faction: FactionId; value: number }>> = {
  echo_ilyra_watchword: { faction: 'remnants', value: 20 },
  echo_weaver_sign: { faction: 'weavers', value: 20 },
  echo_ironclad_oath: { faction: 'ironclad', value: 20 },
};
/** STORY §12: a faction at Trusted or better at a loop's end grants its oath Echo. */
export const LOOP_END_REP_ECHOES: Readonly<Partial<Record<FactionId, string>>> = {
  ironclad: 'echo_ironclad_oath',
  weavers: 'echo_weaver_sign',
};

/** Modes in which the jailer's sources are checked (outside the closing step of a loop). */
const IN_PLAY: readonly Mode[] = ['explore', 'combat', 'dialogue'];

type Pr = Readonly<Profile>;

// ---- reads ---------------------------------------------------------------------------------------------------------------

/** Mute Ley (DESIGN §15.1): a run modifier with `disable_echo_shortcuts` turns off shortcuts and rep starts. */
export function shortcutsMuted(s: GameState, content: ContentPack): boolean {
  return s.meta.modifiers.some((id) => content.modifiers[id]?.rules.some((r) => r.kind === 'disable_echo_shortcuts') ?? false);
}

/**
 * The shortcut `questId` opens at because its Echo is held (the furthest stage when several are), or undefined; none
 * with Mute Ley.
 */
export function shortcutFor(s: GameState, profile: Pr, content: ContentPack, questId: string): { skipTo: string; text: string } | undefined {
  const quest = content.quests[questId];
  if (quest === undefined || shortcutsMuted(s, content)) return undefined;
  const order = quest.stages.map((st) => st.id);
  let best: { skipTo: string; text: string } | undefined;
  for (const sc of quest.shortcuts ?? []) {
    if (!hasEcho(s, profile, sc.echo)) continue;
    if (best === undefined || order.indexOf(sc.skipTo) > order.indexOf(best.skipTo)) best = sc;
  }
  return best;
}

/** The loyalty `companionId` starts at this loop because of its bond Echo (0 without one). */
export function bondLoyalty(s: GameState, profile: Pr, companionId: string): number {
  const echo = BOND_ECHOES[companionId];
  return echo !== undefined && hasEcho(s, profile, echo) ? BOND_LOYALTY : 0;
}

/** The rep start each faction gets from the Echoes held (absent: none); never with Mute Ley. */
export function repStarts(s: GameState, profile: Pr, content: ContentPack): Partial<Record<FactionId, number>> {
  const out: Partial<Record<FactionId, number>> = {};
  if (shortcutsMuted(s, content)) return out;
  for (const [echo, { faction, value }] of Object.entries(ECHO_REP_STARTS)) {
    if (hasEcho(s, profile, echo)) out[faction] = Math.max(out[faction] ?? value, value);
  }
  return out;
}

/** How many of STORY §5.5's five sources of `echo_tyrant_jailer` are held (this loop or any earlier one). */
export function jailerSourcesHeld(s: GameState, profile: Pr): number {
  const held = new Map<number, boolean>();
  for (const [echo, source] of Object.entries(JAILER_SOURCES)) held.set(source, (held.get(source) ?? true) && hasEcho(s, profile, echo));
  return [...held.values()].filter(Boolean).length;
}

// ---- writes --------------------------------------------------------------------------------------------------------------

/** Raises a recruited companion to its bond start (`loyaltyChanged`); a start never lowers loyalty. */
function applyBond(ctx: StepCtx, companionId: string): void {
  const c = ctx.s.companions.recruited[companionId];
  if (c === undefined || c.dead) return;
  const start = bondLoyalty(ctx.s, ctx.profile, companionId);
  if (c.loyalty >= start) return;
  const delta = start - c.loyalty;
  c.loyalty = start;
  ctx.emit({ t: 'loyaltyChanged', companionId, delta, value: start });
}

/** Moves a running quest on to its shortcut stage while it is still before it. */
function applyShortcut(ctx: StepCtx, questId: string): void {
  const { s, content } = ctx;
  const sc = shortcutFor(s, ctx.profile, content, questId);
  const qs = s.quests[questId];
  if (sc === undefined || qs?.status !== 'active') return;
  const stages = (content.quests[questId]?.stages ?? []).map((st) => st.id);
  if (stages.indexOf(qs.stage) >= stages.indexOf(sc.skipTo)) return;
  ctx.log(sc.text, 'narration');
  enterStage(ctx, questId, sc.skipTo);
}

/** Each faction's start value from the Echoes held (`reputationChanged`); a start never lowers reputation. */
function applyRepStarts(ctx: StepCtx): void {
  const { s, content } = ctx;
  for (const [faction, value] of Object.entries(repStarts(s, ctx.profile, content)) as [FactionId, number][]) {
    const before = s.reputation[faction];
    if (before >= value) continue;
    s.reputation[faction] = value;
    ctx.emit({
      t: 'reputationChanged',
      faction,
      delta: value - before,
      value,
      tierBefore: repTier(before, content),
      tierAfter: repTier(value, content),
    });
  }
}

/**
 * Loop-start Echo effects (reducers/loop.ts `beginLoop`, before the start location's arrival): rep starts, then the
 * bond start of any companion already recruited and the shortcut of any quest already running (one started at the
 * Threshold, D-067.15).
 */
export function applyLoopStartEchoes(ctx: StepCtx): void {
  applyRepStarts(ctx);
  for (const id of Object.keys(ctx.s.companions.recruited)) applyBond(ctx, id);
  for (const id of Object.keys(ctx.s.quests)) applyShortcut(ctx, id);
}

/** Grants `echo_tyrant_jailer` once two of its sources are held (D-067.16); true if it was granted now. */
export function grantJailerIfDue(ctx: StepCtx): boolean {
  const { s, profile } = ctx;
  if (hasEcho(s, profile, ECHO_TYRANT_JAILER) || jailerSourcesHeld(s, profile) < JAILER_SOURCES_NEEDED) return false;
  return grantKnownEcho(ctx, ECHO_TYRANT_JAILER, 'jailer');
}

/** STORY §12 "at a loop's end": bond Echoes by loyalty ≥ 50, the Ironclad and Weaver oaths by Trusted standing. */
export function grantLoopEndEchoes(ctx: StepCtx): void {
  const { s, content } = ctx;
  for (const id of LOOP_END_BOND_COMPANIONS) {
    const c = s.companions.recruited[id];
    const echo = BOND_ECHOES[id];
    if (c !== undefined && !c.dead && c.loyalty >= BOND_ECHO_MIN_LOYALTY && echo !== undefined) grantKnownEcho(ctx, echo, `loopEnd:${id}`);
  }
  for (const [faction, echo] of Object.entries(LOOP_END_REP_ECHOES) as [FactionId, string][]) {
    const tier = repTier(s.reputation[faction], content);
    if (tier === 'trusted' || tier === 'sworn') grantKnownEcho(ctx, echo, `loopEnd:${faction}`);
  }
}

/** The step closes the loop: it entered ending mode and the loop-end hook (which runs next) has not run yet. */
function closingLoop(ctx: StepCtx): boolean {
  const { s } = ctx;
  if (s.mode !== 'ending' || s.pendingEnding === null) return false;
  return ctx.events.some((e) => e.t === 'modeChanged' && e.to === 'ending') && !ctx.events.some((e) => e.t === 'loopEnded');
}

/**
 * Post-step hook (before `loopEndHook`): bond starts and shortcuts for what this step recruited or started; then
 * `echo_tyrant_jailer` when due; then, on the step that closes the loop, the loop-end Echoes.
 */
export const echoPostStep: PostStepHook = (ctx) => {
  for (const e of ctx.events.slice()) {
    if (e.t === 'companionRecruited') applyBond(ctx, e.companionId);
    else if (e.t === 'questStarted') applyShortcut(ctx, e.questId);
  }
  const closing = closingLoop(ctx);
  if (closing || IN_PLAY.includes(ctx.s.mode)) grantJailerIfDue(ctx);
  if (closing) grantLoopEndEchoes(ctx);
};
