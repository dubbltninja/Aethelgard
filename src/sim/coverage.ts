// Coverage of the content by the sims (PLAN §7.7, §1.2 "Coverage of content by sims"): which quests, locations, endings,
// creatures, items, Echoes, codex entries, abilities and dialogue choices the union of a batch's runs reached. The "never"
// lists are the content team's punch list: each entry must be reached in the next batch or justified in BALANCE.md.
//
// Pure: a pack and the runs' `RunResult`s in, a `Coverage` out. The runs include the scripted `pathBot` proofs (PLAN §7.8).
import type { ContentPack } from '@engine/index';
import { CLOSER_IDS } from '@schema/ending';
import type { RunResult } from './runner';

export interface Coverage {
  quests: { total: number; completed: string[]; neverStarted: string[]; startedNeverCompleted: string[] };
  locations: { total: number; visited: string[]; never: string[] };
  /** The pack's endings plus the two loop closers, however the pack records them (PLAN §1.2: "6 true + 2 closers"). */
  endings: { total: number; reached: string[]; never: string[] };
  creatures: { total: number; seen: string[]; killed: string[]; neverSeen: string[]; neverKilled: string[] };
  items: { total: number; obtained: string[]; never: string[] };
  echoes: { total: number; gained: string[]; never: string[] };
  codex: { total: number; unlocked: string[]; never: string[] };
  abilities: { total: number; used: string[]; neverUsed: string[] };
  /** Choices are `<sceneId>/<choiceId>`. */
  dialogueChoices: { total: number; taken: string[]; never: string[] };
}

/** One row of the coverage summary: a content kind and how much of it the runs reached. */
export interface CoverageRatio {
  kind: 'quests' | 'locations' | 'endings' | 'creatures' | 'items' | 'echoes' | 'codex' | 'abilities' | 'dialogueChoices';
  /** What "covered" means for this kind (completed, visited, reached, killed, obtained, gained, unlocked, used, taken). */
  verb: string;
  covered: number;
  total: number;
  ratio: number;
}

/** Every `<sceneId>/<choiceId>` of the pack's dialogue scenes, sorted. */
export function dialogueChoiceIds(content: ContentPack): string[] {
  const out: string[] = [];
  for (const scene of Object.values(content.dialogues)) {
    for (const node of scene.nodes) for (const choice of node.choices) out.push(`${scene.id}/${choice.id}`);
  }
  return [...new Set(out)].sort();
}

const union = (lists: readonly (readonly string[])[]): Set<string> => {
  const out = new Set<string>();
  for (const list of lists) for (const x of list) out.add(x);
  return out;
};

const unionKeys = (maps: readonly Readonly<Record<string, number>>[]): Set<string> => {
  const out = new Set<string>();
  for (const m of maps) for (const [k, n] of Object.entries(m)) if (n > 0) out.add(k);
  return out;
};

const known = (all: readonly string[], reached: ReadonlySet<string>): string[] => all.filter((id) => reached.has(id));
const missing = (all: readonly string[], reached: ReadonlySet<string>): string[] => all.filter((id) => !reached.has(id));

/** What the union of `results` reached of `content`. Ids a run reports that the pack does not define are ignored. */
export function computeCoverage(content: ContentPack, results: readonly RunResult[]): Coverage {
  const questIds = Object.keys(content.quests).sort();
  const locationIds = Object.keys(content.locations).sort();
  const endingIds = [...new Set([...Object.keys(content.endings), ...CLOSER_IDS])].sort();
  const creatureIds = Object.keys(content.creatures).sort();
  const itemIds = Object.keys(content.items).sort();
  const echoIds = Object.keys(content.echoes).sort();
  const codexIds = Object.keys(content.codex).sort();
  const abilityIds = Object.keys(content.abilities).sort();
  const choiceIds = dialogueChoiceIds(content);

  const started = union(results.map((r) => r.questsStarted));
  const completed = union(results.map((r) => r.questsCompleted));
  const visited = union(results.map((r) => r.locationsVisited));
  const reachedEndings = union(results.map((r) => [...r.endings, ...r.closers]));
  const seen = union(results.map((r) => r.creaturesSeen));
  const killed = unionKeys(results.map((r) => r.creaturesKilled));
  const obtained = union(results.map((r) => r.itemsObtained));
  const echoes = union(results.map((r) => r.echoes));
  const codex = union(results.map((r) => r.codexUnlocked));
  const used = unionKeys(results.map((r) => r.abilitiesUsed));
  const taken = union(results.map((r) => r.choicesTaken));

  return {
    quests: {
      total: questIds.length,
      completed: known(questIds, completed),
      neverStarted: missing(questIds, started),
      startedNeverCompleted: questIds.filter((id) => started.has(id) && !completed.has(id)),
    },
    locations: { total: locationIds.length, visited: known(locationIds, visited), never: missing(locationIds, visited) },
    endings: { total: endingIds.length, reached: known(endingIds, reachedEndings), never: missing(endingIds, reachedEndings) },
    creatures: {
      total: creatureIds.length,
      seen: known(creatureIds, seen),
      killed: known(creatureIds, killed),
      neverSeen: missing(creatureIds, seen),
      neverKilled: missing(creatureIds, killed),
    },
    items: { total: itemIds.length, obtained: known(itemIds, obtained), never: missing(itemIds, obtained) },
    echoes: { total: echoIds.length, gained: known(echoIds, echoes), never: missing(echoIds, echoes) },
    codex: { total: codexIds.length, unlocked: known(codexIds, codex), never: missing(codexIds, codex) },
    abilities: { total: abilityIds.length, used: known(abilityIds, used), neverUsed: missing(abilityIds, used) },
    dialogueChoices: { total: choiceIds.length, taken: known(choiceIds, taken), never: missing(choiceIds, taken) },
  };
}

/** The coverage as covered/total rows, in report order. An empty kind (total 0) has ratio 1: nothing is left to reach. */
export function coverageRatios(c: Coverage): CoverageRatio[] {
  const row = (kind: CoverageRatio['kind'], verb: string, covered: number, total: number): CoverageRatio => ({
    kind,
    verb,
    covered,
    total,
    ratio: total === 0 ? 1 : covered / total,
  });
  return [
    row('quests', 'completed', c.quests.completed.length, c.quests.total),
    row('locations', 'visited', c.locations.visited.length, c.locations.total),
    row('endings', 'reached', c.endings.reached.length, c.endings.total),
    row('creatures', 'killed', c.creatures.killed.length, c.creatures.total),
    row('items', 'obtained', c.items.obtained.length, c.items.total),
    row('echoes', 'gained', c.echoes.gained.length, c.echoes.total),
    row('codex', 'unlocked', c.codex.unlocked.length, c.codex.total),
    row('abilities', 'used', c.abilities.used.length, c.abilities.total),
    row('dialogueChoices', 'taken', c.dialogueChoices.taken.length, c.dialogueChoices.total),
  ];
}

/** The "never" lists by kind, for the punch list (empty kinds omitted). */
export function neverLists(c: Coverage): { kind: CoverageRatio['kind']; label: string; ids: string[] }[] {
  const lists: { kind: CoverageRatio['kind']; label: string; ids: string[] }[] = [
    { kind: 'quests', label: 'quests never started', ids: c.quests.neverStarted },
    { kind: 'quests', label: 'quests started, never completed', ids: c.quests.startedNeverCompleted },
    { kind: 'locations', label: 'locations never visited', ids: c.locations.never },
    { kind: 'endings', label: 'endings and closers never reached', ids: c.endings.never },
    { kind: 'creatures', label: 'creatures never seen', ids: c.creatures.neverSeen },
    { kind: 'creatures', label: 'creatures never killed', ids: c.creatures.neverKilled },
    { kind: 'items', label: 'items never obtained', ids: c.items.never },
    { kind: 'echoes', label: 'Echoes never gained', ids: c.echoes.never },
    { kind: 'codex', label: 'codex entries never unlocked', ids: c.codex.never },
    { kind: 'abilities', label: 'abilities never used', ids: c.abilities.neverUsed },
    { kind: 'dialogueChoices', label: 'dialogue choices never taken', ids: c.dialogueChoices.never },
  ];
  return lists.filter((l) => l.ids.length > 0);
}
