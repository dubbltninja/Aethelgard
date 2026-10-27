// What the Quest journal draws (PLAN §6.3 `QuestJournalPanel`, DESIGN §13.1, §11.1, §12.5, §16.3 `screen_quest_log`; STORY
// §11), as pure functions of the state and the pack: the started quests in three groups (active, completed, failed), each
// with its blurb, the current stage's journal text, its objectives (done or open, with the place a hint names), the
// stages already passed, the rewards it pays that the player can know, and who gave it; then where the Wayfinder stands
// with each faction (tier, its line, how far to the next tier) and with each companion (loyalty and its next milestone).
// The engine's `questJournal` is the read model; nothing here decides what a quest is.
import {
  DEFAULT_REP_TIERS,
  questJournal,
  repTier,
  type ContentPack,
  type GameState,
  type JournalEntry,
  type JournalObjective,
  type RepTier,
} from '@engine/index';
import type { Quest } from '@schema/quest';

export type JournalTab = 'active' | 'completed' | 'failed' | 'standing';

export const CATEGORY_LABELS: Readonly<Record<Quest['category'], string>> = {
  legacy: 'Main road',
  faction: 'Faction',
  companion: 'Companion',
  regional: 'Regional',
  loop: 'Loop',
  ending: 'Ending',
  class: 'Class',
  stretch: 'Side road',
};

export interface ObjectiveRow {
  id: string;
  text: string;
  done: boolean;
  optional: boolean;
  /** The name of the place a hint points at (only while the objective is open). */
  where: string | null;
}

export interface QuestRowModel {
  id: string;
  name: string;
  category: string;
  status: JournalEntry['status'];
  description: string;
  /** The current stage's journal text. */
  journal: string;
  objectives: ObjectiveRow[];
  /** "2 of 3 done" (required objectives only), or null when the stage lists none. */
  progress: string | null;
  history: { stage: string; journal: string }[];
  /** "Reward" while the quest runs, "Earned" once completed, nothing once failed. */
  rewardsLabel: string | null;
  rewards: string[];
  /** The person who gave it. */
  giver: string | null;
  /** "Started on Day 3", "Finished on Day 7". */
  days: string;
}

function rewardLines(content: ContentPack, quest: Quest): string[] {
  const r = quest.rewards;
  const out: string[] = [];
  if (r.xp > 0) out.push(`${r.xp} XP`);
  if (r.gold > 0) out.push(`${r.gold} gold`);
  for (const it of r.items) out.push(`${content.items[it.itemId]?.name ?? it.itemId}${it.count > 1 ? ` × ${it.count}` : ''}`);
  for (const rep of r.rep) {
    const name = content.factions[rep.faction]?.shortName ?? rep.faction;
    out.push(`${name} standing ${rep.delta >= 0 ? '+' : '−'}${Math.abs(rep.delta)}`);
  }
  return out;
}

function objectiveRow(content: ContentPack, o: JournalObjective): ObjectiveRow {
  const where = !o.done && o.hintLocationId !== undefined ? (content.locations[o.hintLocationId]?.name ?? null) : null;
  return { id: o.id, text: o.text, done: o.done, optional: o.optional, where };
}

export function questRow(entry: JournalEntry, content: ContentPack): QuestRowModel {
  const quest = content.quests[entry.questId];
  const required = entry.objectives.filter((o) => !o.optional);
  const doneCount = required.filter((o) => o.done).length;
  const failed = entry.status === 'failed';
  const days =
    entry.status === 'active'
      ? entry.startedDay === null
        ? ''
        : `Started on Day ${entry.startedDay}`
      : `${failed ? 'Failed' : 'Finished'}${entry.endedDay === null ? '' : ` on Day ${entry.endedDay}`}`;
  return {
    id: entry.questId,
    name: entry.name,
    category: quest === undefined ? '' : CATEGORY_LABELS[quest.category],
    status: entry.status,
    description: entry.description,
    journal: entry.journal,
    objectives: entry.objectives.map((o) => objectiveRow(content, o)),
    progress: required.length === 0 ? null : `${doneCount} of ${required.length} done`,
    history: entry.history,
    rewardsLabel: failed ? null : entry.status === 'completed' ? 'Earned' : 'Reward',
    rewards: failed || quest === undefined ? [] : rewardLines(content, quest),
    giver: quest?.giverNpcId === undefined ? null : (content.npcs[quest.giverNpcId]?.name ?? null),
    days,
  };
}

// ---- standing ------------------------------------------------------------------------------------------------------------

export const TIER_LABELS: Readonly<Record<RepTier, string>> = { hostile: 'Hostile', wary: 'Wary', neutral: 'Neutral', trusted: 'Trusted', sworn: 'Sworn' };
const TIER_ORDER: readonly RepTier[] = ['hostile', 'wary', 'neutral', 'trusted', 'sworn'];

export interface FactionStanding {
  id: string;
  name: string;
  value: number;
  tier: RepTier;
  tierLabel: string;
  /** The faction's line for this tier. */
  line: string;
  /** "Trusted at 20 (12 more)", or null at Sworn. */
  next: string | null;
  /** −100..100 as 0..100 for the meter. */
  percent: number;
}

export function factionStandings(state: GameState, content: ContentPack): FactionStanding[] {
  const bounds = content.config.repTiers ?? DEFAULT_REP_TIERS;
  return Object.values(content.factions).map((faction) => {
    const value = state.reputation[faction.id] ?? 0;
    const tier = repTier(value, content);
    const upper = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1];
    const need = upper === undefined ? null : bounds[upper] - value;
    return {
      id: faction.id,
      name: faction.name,
      value,
      tier,
      tierLabel: TIER_LABELS[tier],
      line: faction.tierTexts[tier],
      next: upper === undefined || need === null ? null : `${TIER_LABELS[upper]} at ${bounds[upper]} (${need} more)`,
      percent: Math.round(((Math.max(-100, Math.min(100, value)) + 100) / 200) * 100),
    };
  });
}

/** DESIGN §12.5's loyalty thresholds: the second camp conversation, the third arc stage, the Trusted rider, the bond. */
export const LOYALTY_MILESTONES: readonly { at: number; text: string }[] = [
  { at: 25, text: 'a second camp conversation and the next part of their story' },
  { at: 50, text: 'the third part of their story, and their signature comes back sooner' },
  { at: 75, text: 'the Trusted bonus in a fight' },
  { at: 100, text: 'a full bond' },
];

export interface CompanionStanding {
  id: string;
  name: string;
  role: string;
  loyalty: number;
  state: 'with you' | 'waiting' | 'knocked out' | 'fallen' | 'not with you';
  /** "At 50: the third part of their story, …", or null at 100. */
  next: string | null;
}

export function companionStandings(state: GameState, content: ContentPack): CompanionStanding[] {
  const out: CompanionStanding[] = [];
  for (const run of Object.values(state.companions.recruited)) {
    const def = content.companions[run.id];
    if (!run.recruited || def === undefined) continue;
    const next = LOYALTY_MILESTONES.find((m) => m.at > run.loyalty);
    out.push({
      id: run.id,
      name: def.name,
      role: def.role,
      loyalty: run.loyalty,
      state: run.dead ? 'fallen' : run.ko ? 'knocked out' : state.companions.activeId === run.id ? 'with you' : run.waitingAt !== null ? 'waiting' : 'not with you',
      next: next === undefined ? null : `At ${next.at}: ${next.text}`,
    });
  }
  return out;
}

// ---- the journal ----------------------------------------------------------------------------------------------------------------

export interface JournalModel {
  active: QuestRowModel[];
  completed: QuestRowModel[];
  failed: QuestRowModel[];
  factions: FactionStanding[];
  companions: CompanionStanding[];
  tabs: { id: JournalTab; label: string; count: number | null }[];
}

export function journalModel(state: GameState, content: ContentPack): JournalModel {
  const rows = questJournal(state, content).map((entry) => questRow(entry, content));
  const active = rows.filter((r) => r.status === 'active');
  const completed = rows.filter((r) => r.status === 'completed');
  const failed = rows.filter((r) => r.status === 'failed');
  const factions = factionStandings(state, content);
  const companions = companionStandings(state, content);
  return {
    active,
    completed,
    failed,
    factions,
    companions,
    tabs: [
      { id: 'active', label: 'Active', count: active.length },
      { id: 'completed', label: 'Completed', count: completed.length },
      { id: 'failed', label: 'Failed', count: failed.length },
      { id: 'standing', label: 'People', count: null },
    ],
  };
}

/** The rows a tab lists (the people tab lists none). */
export function rowsOf(model: JournalModel, tab: JournalTab): QuestRowModel[] {
  return tab === 'active' ? model.active : tab === 'completed' ? model.completed : tab === 'failed' ? model.failed : [];
}

/** The tab to open on: Active, unless it is empty and another group has quests. */
export function firstTab(model: JournalModel): JournalTab {
  if (model.active.length > 0) return 'active';
  if (model.completed.length > 0) return 'completed';
  if (model.failed.length > 0) return 'failed';
  return 'active';
}

export const EMPTY_TEXT: Readonly<Record<'active' | 'completed' | 'failed', string>> = {
  active: 'No quest is under way. Talk to people; some will ask for your help.',
  completed: 'No quest is finished yet in this loop.',
  failed: 'No quest has failed in this loop.',
};

/** A quest's list line: "Lost scroll — 2 of 3 done". */
export function questLine(row: QuestRowModel): string {
  return row.progress === null ? row.name : `${row.name}, ${row.progress}`;
}
