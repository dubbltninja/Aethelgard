// What the Loop Timeline draws (DESIGN §16.3 `screen_loop_timeline`, §10.3; U68): every loop of the profile as a row — class,
// how it ended, how many days it had, the level it reached, what was learned (the Echoes, pinned by their group) and the choices
// it made — with the loop now under way as the last row, and, below, what the profile has still to do for the endings it has not
// met (a hint only when the profile itself can answer it; the ending's name stays back). Pure functions of the state, the pack
// and the profile.
import type { ContentPack, GameState, Profile } from '@engine/index';
import { dayOf } from '@engine/index';
import { endingHints, recordGlyphs, type LoopGlyph } from '../screens/thresholdModel';
import { classNameOf, idWords, outcomeText, type OutcomeKind } from '../screens/runSummaryModel';

export interface LearnedEcho {
  id: string;
  name: string;
  /** The Echo's Timeline group ("litany", "heartstone"…), in words. */
  group: string | null;
}

export interface TimelineRow {
  key: string;
  loop: number;
  className: string;
  /** null for the loop in progress. */
  outcome: { kind: OutcomeKind; label: string } | null;
  inProgress: boolean;
  days: number;
  /** The day axis: days used out of the clock's length. */
  axisMax: number;
  level: number;
  learned: LearnedEcho[];
  glyphs: LoopGlyph[];
}

export interface TimelineModel {
  rows: TimelineRow[];
  /** "Endings reached: 1 of 6". */
  endings: string;
  hints: string[];
  empty: string | null;
}

const DEFAULT_DAYS = 30;

function learned(ids: readonly string[], content: ContentPack): LearnedEcho[] {
  return ids.map((id) => {
    const echo = content.echoes[id];
    return { id, name: echo?.name ?? idWords(id), group: echo?.timelineGroup === undefined ? null : idWords(echo.timelineGroup) };
  });
}

/** Modes in which a loop is being lived (not the Threshold between loops, not the title). */
const LIVE_MODES: readonly string[] = ['explore', 'combat', 'dialogue'];

export function timelineModel(s: GameState, content: ContentPack, profile: Readonly<Profile>): TimelineModel {
  const rows: TimelineRow[] = profile.runHistory.map((r) => {
    const out = outcomeText(r.outcome, r.reason, content);
    return {
      key: r.runId,
      loop: r.loop,
      className: classNameOf(content, r.classId),
      outcome: { kind: out.kind, label: out.label },
      inProgress: false,
      days: r.daysUsed,
      axisMax: DEFAULT_DAYS,
      level: r.level,
      learned: learned(r.echoesGained, content),
      glyphs: recordGlyphs(r, content),
    };
  });
  if (LIVE_MODES.includes(s.mode)) {
    const glyphs: LoopGlyph[] = s.meta.modifiers.map((id) => ({ id, mark: '▲', text: content.modifiers[id]?.name ?? idWords(id) }));
    rows.push({
      key: s.meta.runId,
      loop: s.meta.loop,
      className: classNameOf(content, s.player.classId),
      outcome: null,
      inProgress: true,
      days: dayOf(s.clock.ticks),
      axisMax: Math.max(1, Math.round(s.clock.limitTicks / 4)),
      level: s.player.level,
      learned: learned(s.echoesThisLoop, content),
      glyphs,
    });
  }
  const total = Object.values(content.endings).filter((e) => e?.kind === 'true').length;
  const reached = profile.endingsReached.length;
  return {
    rows,
    endings: `Endings reached: ${reached} of ${total}`,
    hints: reached >= total ? [] : endingHints(content, profile),
    empty: rows.length === 0 ? 'No loop has ended yet. When one does, it is drawn here.' : null,
  };
}
