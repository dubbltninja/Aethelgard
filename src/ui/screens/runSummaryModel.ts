// What the Run Summary shows (DESIGN §15.3, §10.3, §16.3 `screen_run_summary`; U68): outcome, days, level, kills, quests, Echoes
// gained, Resonance earned. Pure functions of the loop's `RunRecord` (the profile keeps one per loop, so the summary can be
// reopened from the Still Shore) and, while the run is still on the ending screens, the run's own state (counters for kills,
// damage and gold; the Resonance tally). Nothing here invents a number: a line whose source is not there is left out.
import {
  dayOf,
  repTier,
  resonanceMultiplier,
  type ContentPack,
  type EndingPending,
  type GameState,
  type Profile,
  type RunRecord,
} from '@engine/index';

export const cap = (s: string): string => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1));
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
/** "fam_wildling_kin" → "Wildling kin". */
export const idWords = (id: string): string => cap(id.replace(/^[a-z]+_/, '').replace(/_/g, ' '));

const FALL_WORDS: Readonly<Record<string, string>> = {
  death: 'Fell in the Breach',
  expiry: 'The thirtieth dawn',
  rejected: 'Turned away by the Tyrant',
  released: 'Let go',
};

export type OutcomeKind = 'ending' | 'escape' | 'fall';

export interface OutcomeText {
  kind: OutcomeKind;
  /** "The Warden's Vigil", "The Escape", "The Fall · Let go". */
  label: string;
  tagline: string | null;
}

/** An outcome id (`ending_*`, `closer_escape`, `closer_fall`) and a Fall's reason, in words. */
export function outcomeText(outcome: string, reason: string | undefined, content: ContentPack): OutcomeText {
  const def = content.endings[outcome];
  if (outcome === 'closer_fall') {
    const why = reason === undefined ? null : (FALL_WORDS[reason] ?? idWords(reason));
    return { kind: 'fall', label: why === null ? (def?.name ?? 'The Fall') : `${def?.name ?? 'The Fall'} · ${why}`, tagline: null };
  }
  if (outcome === 'closer_escape') return { kind: 'escape', label: def?.name ?? 'The Escape', tagline: null };
  return { kind: 'ending', label: def?.name ?? idWords(outcome), tagline: def?.tagline ?? null };
}

/** A faction's name from its id (the pack keys them by the three FactionIds). */
export const factionName = (content: ContentPack, id: string): string => (content.factions as Record<string, { name: string } | undefined>)[id]?.name ?? idWords(id);

export const TYRANT_WORDS = { defeated: 'Struck down', spared: 'Spared', untouched: 'Never faced' } as const;

export const classNameOf = (content: ContentPack, classId: string): string => content.classes[classId]?.name ?? idWords(classId);

export interface SummaryLine {
  key: string;
  label: string;
  value: string;
}

export interface SummaryEcho {
  id: string;
  name: string;
  codexLine: string;
}

export interface SummaryDamage {
  source: string;
  amount: number;
  /** Whole percent of all damage dealt. */
  share: number;
}

export interface RunSummaryModel {
  heading: string;
  outcome: OutcomeText;
  /** The headline facts: loop, class, days, level, quests. */
  facts: SummaryLine[];
  echoes: SummaryEcho[];
  /** The run's own numbers; empty when only the record is left (the Still Shore's summary). */
  combat: SummaryLine[];
  damageTop: SummaryDamage[];
  /** Companions (with final loyalty) and faction standings; only while the run's state is at hand. */
  company: SummaryLine[];
  standings: SummaryLine[];
  /** Key choices (DESIGN §15.3): the Tyrant, the Heartstone, the modifiers. */
  choices: SummaryLine[];
  resonance: { base: number; multiplier: number; bonus: number; total: number } | null;
  /** The vanity line: gold·5 + damage/2 + XP, halved on a loss. */
  legacy: number | null;
  seed: string;
  credit: string;
}

/** What the model reads: the record, and — if the run is still on its ending screens — its state. */
export interface SummarySource {
  record: RunRecord;
  /** The ended run's state (ending mode only); at the Threshold the state is already the next loop's. */
  run: GameState | null;
}

/** The record to summarise: the profile's last, or null (a profile with no finished loop). */
export function lastRecord(profile: Readonly<Profile>): RunRecord | null {
  return profile.runHistory[profile.runHistory.length - 1] ?? null;
}

/** The source for the ending screens (state at hand) or the Still Shore (record only). */
export function summarySource(state: GameState, profile: Readonly<Profile>): SummarySource | null {
  const record = lastRecord(profile);
  if (record === null) return null;
  return { record, run: state.mode === 'ending' && state.pendingEnding !== null ? state : null };
}

function loopOutcome(record: RunRecord): Pick<EndingPending, 'outcome'> & { reason: string | undefined } {
  return { outcome: record.outcome as EndingPending['outcome'], reason: record.reason };
}

const watchWord = (ticks: number): string => ['dawn', 'day', 'dusk', 'night'][ticks % 4] ?? 'dawn';

export function runSummaryModel(source: SummarySource, content: ContentPack): RunSummaryModel {
  const { record, run } = source;
  const { outcome, reason } = loopOutcome(record);
  const text = outcomeText(outcome, reason, content);
  const className = classNameOf(content, record.classId);
  const facts: SummaryLine[] = [
    { key: 'loop', label: 'Loop', value: String(record.loop) },
    { key: 'class', label: 'Class', value: className },
    {
      key: 'days',
      label: 'Days used',
      value: run === null ? `Day ${record.daysUsed}` : `Day ${dayOf(run.clock.ticks)}, ${watchWord(run.clock.ticks)}`,
    },
    { key: 'level', label: 'Level reached', value: String(record.level) },
    { key: 'quests', label: 'Quests completed', value: String(record.questsCompleted.length) },
  ];
  const echoes = record.echoesGained.map((id) => ({ id, name: content.echoes[id]?.name ?? idWords(id), codexLine: content.echoes[id]?.codexLine ?? '' }));
  const choices: SummaryLine[] = [
    { key: 'tyrant', label: 'The Tyrant', value: TYRANT_WORDS[record.tyrant] },
    { key: 'heartstone', label: 'The Heartstone', value: idWords(record.heartstone) },
    ...(record.modifiers.length === 0
      ? []
      : [{ key: 'modifiers', label: 'Challenge modifiers', value: record.modifiers.map((id) => content.modifiers[id]?.name ?? idWords(id)).join(', ') }]),
  ];

  const combat: SummaryLine[] = [];
  const damageTop: SummaryDamage[] = [];
  const company: SummaryLine[] = [];
  const standings: SummaryLine[] = [];
  let resonance: RunSummaryModel['resonance'] = null;
  let legacy: number | null = null;
  if (run !== null) {
    const c = run.counters;
    const kills = Object.entries(c.kills);
    const killTotal = kills.reduce((n, [, k]) => n + k, 0);
    const families: Record<string, number> = {};
    for (const [id, k] of kills) {
      const family = content.creatures[id]?.family;
      const name = family === undefined ? 'Other' : idWords(family);
      families[name] = (families[name] ?? 0) + k;
    }
    const byFamily = Object.entries(families)
      .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
      .map(([name, k]) => `${name} ${k}`)
      .join(', ');
    combat.push({ key: 'kills', label: 'Kills', value: killTotal === 0 ? 'None' : `${killTotal} (${byFamily})` });
    combat.push({ key: 'fights', label: 'Fights won', value: `${c.fightsWon} of ${c.fights}${c.fled > 0 ? `, fled ${c.fled}` : ''}` });
    combat.push({ key: 'dealt', label: 'Damage dealt', value: String(Math.round(c.damageDealt)) });
    combat.push({ key: 'taken', label: 'Damage taken', value: String(Math.round(c.damageTaken)) });
    combat.push({ key: 'gold', label: 'Gold earned / spent', value: `${c.goldEarned} / ${c.goldSpent}` });
    if (record.outcome === 'closer_fall' && record.reason === 'death') combat.push({ key: 'deaths', label: 'Fell on', value: `Day ${record.daysUsed}` });
    const total = Object.values(c.damageBySource).reduce((n, v) => n + v, 0);
    for (const [source, amount] of Object.entries(c.damageBySource)
      .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
      .slice(0, 5)) {
      damageTop.push({ source: damageSourceName(source, content), amount: Math.round(amount), share: total <= 0 ? 0 : Math.round((amount / total) * 100) });
    }
    for (const [id, comp] of Object.entries(run.companions.recruited)) {
      const def = content.companions[id];
      const name = (def === undefined ? undefined : content.npcs[def.npcId]?.name) ?? def?.name ?? idWords(id);
      company.push({ key: id, label: name, value: `loyalty ${comp.loyalty}${comp.dead ? ', fallen' : ''}` });
    }
    for (const [id, value] of Object.entries(run.reputation)) {
      standings.push({ key: id, label: factionName(content, id), value: `${cap(repTier(value, content))} (${value})` });
    }
    const base = c.resonance ?? 0;
    const multiplier = resonanceMultiplier(record.modifiers);
    const bonus = Math.round(base * (multiplier - 1));
    resonance = { base, multiplier, bonus, total: base + bonus };
    const loss = record.outcome === 'closer_fall';
    const score = c.goldEarned * 5 + c.damageDealt / 2 + run.player.xp;
    legacy = Math.round(loss ? score / 2 : score);
  }
  return {
    heading: `Loop ${record.loop} · ${className}`,
    outcome: text,
    facts,
    echoes,
    combat,
    damageTop,
    company,
    standings,
    choices,
    resonance,
    legacy,
    seed: record.seed,
    credit: 'A game by Tim Dibert',
  };
}

/** `basic`, an ability id, `companion:<id>`, `status:<id>`, `item:<id>` → words. */
export function damageSourceName(source: string, content: ContentPack): string {
  if (source === 'basic') return 'Basic attacks';
  if (source.startsWith('status:')) return `${idWords(source.slice(7))} (over time)`;
  if (source.startsWith('companion:')) {
    const id = source.slice(10);
    const def = content.companions[id];
    return (def === undefined ? undefined : content.npcs[def.npcId]?.name) ?? def?.name ?? idWords(id);
  }
  if (source.startsWith('item:')) return content.items[source.slice(5)]?.name ?? idWords(source.slice(5));
  return content.abilities[source]?.name ?? idWords(source);
}
