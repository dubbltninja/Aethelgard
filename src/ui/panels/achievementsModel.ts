// What the Achievements panel draws (DESIGN §15.2, §16.3 `screen_achievements`; U68): the forty badges — earned ones with the
// loop and day they came, the rest with their condition in play words and, where the condition is a count the screen can read,
// how far along it is; the hidden ones stay "???" until earned. An achievement is a Condition the engine checks (D-081 left the
// checker to a later unit), so the panel reads only `profile.achievements` for "earned"; progress is a courtesy drawn from the
// facts the profile and the run already hold, never a second opinion about what is earned. Pure.
import { counterValue, type ContentPack, type GameState, type Profile } from '@engine/index';
import type { Achievement } from '@schema/achievement';
import type { Condition } from '@schema/condition';

export const HIDDEN_NAME = '???';
export const HIDDEN_TEXT = 'A hidden one. It shows itself when it is earned.';

export interface AchievementRow {
  id: string;
  name: string;
  description: string;
  hidden: boolean;
  earned: boolean;
  /** "Loop 2, Day 5" once earned. */
  when: string | null;
  /** 3 of 6, where the condition is a count. */
  progress: { have: number; need: number; unit: string } | null;
  icon: string;
}

export interface AchievementsModel {
  rows: AchievementRow[];
  earned: number;
  total: number;
}

type Tally = (s: GameState, p: Readonly<Profile>) => number;

/** Counters the engine does not keep yet (`tally_*`, achievements.ts) that the profile can answer today. */
const PROFILE_TALLIES: Readonly<Record<string, Tally>> = {
  tally_closer_escape: (_s, p) => p.runHistory.filter((r) => r.outcome === 'closer_escape').length,
  tally_classes_finished: (_s, p) => Object.values(p.classMastery).filter((m) => m.loopsPlayed > 0).length,
  tally_mastery_peak: (_s, p) => Math.max(0, ...Object.values(p.classMastery).map((m) => m.mastered.length)),
  tally_new_game_plus: (_s, p) => p.newGamePlus,
};

const LIVE_MODES: readonly string[] = ['explore', 'combat', 'dialogue'];

/** The count a condition asks for, if it is one: a `counter` with a minimum, or several Echoes all held. */
export function countOf(
  when: Condition,
  s: GameState,
  p: Readonly<Profile>,
  content: ContentPack,
): { have: number; need: number; unit: string } | null {
  if ('counter' in when) {
    const { name, min } = when.counter;
    if (min === undefined || min < 2) return null;
    const tally = PROFILE_TALLIES[name];
    if (tally !== undefined) return { have: Math.min(min, tally(s, p)), need: min, unit: '' };
    if (name.startsWith('tally_')) return null;
    // a run's own counter reads the run under way; between loops there is none to read
    return LIVE_MODES.includes(s.mode) ? { have: Math.min(min, counterValue(s, content, name)), need: min, unit: 'this loop' } : null;
  }
  if ('all' in when) {
    const echoes = when.all.filter((c): c is Extract<Condition, { echo: string }> => 'echo' in c);
    if (echoes.length >= 2 && echoes.length === when.all.length) {
      const held = echoes.filter((c) => p.echoes.includes(c.echo) || s.echoesThisLoop.includes(c.echo)).length;
      return { have: held, need: echoes.length, unit: '' };
    }
    const counters = when.all.filter((c) => 'counter' in c);
    if (counters.length === 1) return countOf(counters[0] as Condition, s, p, content);
  }
  return null;
}

export function achievementRow(def: Achievement, s: GameState, p: Readonly<Profile>, content: ContentPack): AchievementRow {
  const record = p.achievements[def.id];
  const earned = record !== undefined;
  const concealed = def.hidden && !earned;
  return {
    id: def.id,
    name: concealed ? HIDDEN_NAME : def.name,
    description: concealed ? HIDDEN_TEXT : def.description,
    hidden: def.hidden,
    earned,
    when: record === undefined ? null : `Loop ${record.loop}, Day ${record.day}`,
    progress: earned || concealed ? null : countOf(def.when, s, p, content),
    icon: def.icon,
  };
}

export function achievementsModel(s: GameState, content: ContentPack, profile: Readonly<Profile>): AchievementsModel {
  const defs = Object.values(content.achievements).filter((a): a is Achievement => a !== undefined);
  const rows = defs.map((d) => achievementRow(d, s, profile, content));
  return { rows, earned: rows.filter((r) => r.earned).length, total: rows.length };
}
