// U81b1 (D-145, brief item 6): following quests the way a player reads the journal. U80's bots reached a quest's hint and
// then did nothing a walk does not do: a hidden item named by an objective (the Echo Crystal in its alcove) needs the place
// searched (`examine` the location), an item the objective asks for may be on the merchant's shelf (Brak's sack of Steppe
// salt), and a stage with no objective ("Return to Ilyra and choose", "Report to Brak") points at no place at all, so the
// quest sat there until the loop ended. Coverage (quests 38/49) and every clock row (#10, #11, #15) measured that, not the
// game. These rows use only the engine's own quest machinery (`questJournal`, the stage's objectives and its giver):
//   questTargets  the journal's open hint places, then — for an active quest whose stage names no open hint — the places
//                 where its giver stands now (`npcPlacement`, else the authored placement): the turn-in conversation.
//   questErrand   here, at a hint of an objective that names an item the player lacks: buy it if the merchant here sells it;
//                 else search the place once per quest state (`examine` the location reveals hidden items; the bot must list
//                 examines, `Bot.examines`). Picking up is the head's `takeAll`.
import { npcPlacement, questJournal, type Action, type ContentPack, type GameState, type Profile } from '@engine/index';
import type { Condition } from '@schema/condition';
import { allOf, questSignature } from './shared';
import type { BotMemory } from './types';

/** Item ids a condition asks the player to hold (`item` atoms, through all/any; never under a `not`). */
export function wantedItems(c: Condition, into: Set<string> = new Set()): Set<string> {
  const [key, value] = Object.entries(c)[0] as [string, unknown];
  if (key === 'item') {
    const v = value as { id?: string } | string;
    const id = typeof v === 'string' ? v : v.id;
    if (id !== undefined) into.add(id);
  } else if (key === 'all' || key === 'any') for (const child of value as Condition[]) wantedItems(child, into);
  return into;
}

/** The places an NPC stands now (an override or a schedule, else the locations that list it). */
export function npcWhere(s: GameState, content: ContentPack, profile: Profile, npcId: string): string[] {
  const placed = npcPlacement(s, content, profile, npcId);
  if (placed !== null) return [...placed];
  return Object.values(content.locations).flatMap((l) => (l !== undefined && (l.npcs ?? []).some((id) => id === npcId) ? [l.id] : []));
}

export interface QuestTarget {
  locationId: string;
  questId: string;
}

/** The journal's open hint places (journal order), then the givers of active quests whose stage names no open hint. */
export function questTargets(s: GameState, content: ContentPack, profile: Profile): QuestTarget[] {
  const out: QuestTarget[] = [];
  const add = (locationId: string, questId: string): void => {
    if (content.locations[locationId] !== undefined && !out.some((x) => x.locationId === locationId)) out.push({ locationId, questId });
  };
  const idle: string[] = [];
  for (const entry of questJournal(s, content)) {
    if (entry.status !== 'active') continue;
    const open = entry.objectives.filter((o) => !o.done && o.hintLocationId !== undefined);
    for (const o of open) add(o.hintLocationId as string, entry.questId);
    if (open.length === 0) idle.push(entry.questId);
  }
  for (const questId of idle) {
    const giver = content.quests[questId]?.giverNpcId;
    if (giver !== undefined) for (const at of npcWhere(s, content, profile, giver)) add(at, questId);
  }
  return out;
}

/** The open objectives of the active quests, with their stage's condition. */
function openObjectives(s: GameState, content: ContentPack): { questId: string; when: Condition; hint?: string }[] {
  const out: { questId: string; when: Condition; hint?: string }[] = [];
  for (const [questId, qs] of Object.entries(s.quests)) {
    if (qs === undefined || qs.status !== 'active') continue;
    const stage = content.quests[questId]?.stages.find((x) => x.id === qs.stage);
    for (const o of stage?.objectives ?? []) {
      if (qs.objectivesDone.includes(o.id)) continue;
      out.push({ questId, when: o.when, ...(o.hintLocationId !== undefined ? { hint: o.hintLocationId } : {}) });
    }
  }
  return out;
}

const carried = (s: GameState, itemId: string): boolean => s.player.inventory.some((i) => i.itemId === itemId) || Object.values(s.player.equipment).some((i) => i?.itemId === itemId);

const SEARCHED = 'questFollow:searched';

/** Buy an objective's item from the merchant here; else search a hint place for one (once per quest state). */
export function questErrand(s: GameState, legal: readonly Action[], content: ContentPack, memory: BotMemory): Action | undefined {
  const here = s.world.currentLocationId;
  const wanted = new Set<string>();
  let searchHere = false;
  for (const o of openObjectives(s, content)) {
    const items = [...wantedItems(o.when)].filter((id) => !carried(s, id));
    for (const id of items) wanted.add(id);
    if (items.length > 0 && o.hint === here) searchHere = true;
  }
  if (wanted.size === 0) return undefined;
  const buy = allOf(legal, 'buy').find((a) => wanted.has(s.merchants[a.merchantId]?.stock.find((i) => i.uid === a.uid)?.itemId ?? ''));
  if (buy !== undefined) return buy;
  if (!searchHere) return undefined;
  const key = `${s.meta.runId}|${here}|${questSignature(s)}`;
  const done = (memory[SEARCHED] as string[] | undefined) ?? [];
  if (done.includes(key)) return undefined;
  const search = legal.find((a) => a.type === 'examine' && a.target.kind === 'location');
  if (search === undefined) return undefined;
  memory[SEARCHED] = [...done, key];
  return search;
}
