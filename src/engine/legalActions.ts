// legalActions (PLAN §4.7): every action `step` would accept from a state. Skeleton (U13): the per-type structure is
// fixed and exhaustive — a mode table and one enumerator per Action['type'] — and every enumerator returns [] until
// the unit that implements the action's reducer fills it in (U35 then proves legal/step agreement over fixture
// states). `step` uses ACTION_MODES as its first gate, so the two can never disagree about modes.
import type { ContentPack } from './ctx';
import {
  chooseEnumerator,
  examineEnumerator,
  gatherEnumerator,
  moveEnumerator,
  restEnumerator,
  retreatEnumerator,
  takeAllEnumerator,
  takeEnumerator,
  waitEnumerator,
} from './reducers/explore';
import { inventoryEnumerators } from './reducers/inventory';
import { buyEnumerator, sellEnumerator } from './reducers/economy';
import { craftEnumerator, salvageEnumerator, upgradeEnumerator } from './reducers/crafting';
import {
  acknowledgeEndingEnumerator,
  keepVigilEnumerator,
  letGoEnumerator,
  newGameEnumerator,
  returnToTitleEnumerator,
} from './reducers/loop';
import { enterPortalEnumerator } from './horde';
import {
  chooseClassEnumerator,
  equipAttunementEnumerator,
  newGamePlusEnumerator,
  newLoopEnumerator,
  thresholdGoEnumerator,
  thresholdRefundEnumerator,
  thresholdSpendEnumerator,
  toggleModifierEnumerator,
} from './reducers/threshold';
import {
  abilityEnumerator,
  attackEnumerator,
  communeEnumerator,
  companionCommandEnumerator,
  fleeEnumerator,
  guardEnumerator,
  itemEnumerator,
  setStanceEnumerator,
  swapCompanionEnumerator,
} from './reducers/combat';
import { saveEnumerator } from './saves/reducers';
import type { Action, ActionOf, ActionType } from './types/actions';
import type { Profile } from './types/profile';
import type { GameState, Mode } from './types/state';
import { canonicalJson } from './util/hash';

/**
 * Modes in which each action can be legal at all. PLAN §4.7 fixes the shell rows (save: explore/threshold;
 * load/newGame: title; returnToTitle: ending/threshold/explore); the rest follow the Action union's groups.
 * `ability` is also an explore action (out-of-combat abilities, PLAN §5.7 `outOfCombat`).
 */
export const ACTION_MODES: { readonly [K in ActionType]: readonly Mode[] } = {
  newGame: ['title'],
  chooseClass: ['title', 'threshold'],
  save: ['explore', 'threshold'],
  load: ['title'],
  returnToTitle: ['explore', 'threshold', 'ending', 'combat'], // combat: the Loop 1 FALLEN screen only (D-075)
  move: ['explore'],
  examine: ['explore'],
  take: ['explore'],
  takeAll: ['explore'],
  rest: ['explore'],
  retreat: ['explore'],
  gather: ['explore'],
  talk: ['explore'],
  enterPortal: ['explore'],
  interact: ['explore'],
  wait: ['explore'],
  letGo: ['explore'],
  keepVigil: ['explore'],
  use: ['explore'],
  equip: ['explore'],
  unequip: ['explore'],
  drop: ['explore'],
  allocateStat: ['explore'],
  unlockAbility: ['explore'],
  readBook: ['explore'],
  respec: ['explore'],
  buy: ['explore', 'dialogue'],
  sell: ['explore', 'dialogue'],
  craft: ['explore'],
  upgrade: ['explore'],
  salvage: ['explore'],
  choose: ['dialogue'],
  continue: ['dialogue'],
  acceptQuest: ['dialogue'],
  attack: ['combat'],
  ability: ['combat', 'explore'],
  guard: ['combat'],
  item: ['combat'],
  flee: ['combat'],
  companionCommand: ['combat'],
  setStance: ['combat', 'explore'],
  commune: ['combat'],
  swapCompanion: ['explore'],
  acknowledgeEnding: ['ending'],
  thresholdGo: ['threshold'],
  thresholdSpend: ['threshold'],
  thresholdRefund: ['threshold'],
  equipAttunement: ['threshold'],
  toggleModifier: ['threshold'],
  newLoop: ['threshold'],
  newGamePlus: ['ending', 'threshold'], // U31: a true ending's screens (PLAN §4.4) and the Loom (DESIGN §10.8)
};

export interface LegalOptions {
  /** `examine` is enumerated only when the UI asks (PLAN §4.7 enumeration limits). */
  includeExamine?: boolean;
}

export type Enumerator<K extends ActionType> = (
  state: GameState,
  content: ContentPack,
  profile: Profile,
  opts: LegalOptions,
) => ActionOf<K>[];

export type EnumeratorTable = { readonly [K in ActionType]: Enumerator<K> };

/** Placeholder until the action's reducer lands; the comment on each row names that unit (PLAN §9.2). */
const none = (): never[] => [];

export const ENUMERATORS: EnumeratorTable = {
  newGame: newGameEnumerator, // U30
  chooseClass: chooseClassEnumerator, // U31 (Far Light; the title's class choice is part of `newGame`)
  save: saveEnumerator, // U22
  load: none, // U22
  returnToTitle: returnToTitleEnumerator, // U30
  move: moveEnumerator, // U20
  examine: examineEnumerator, // U20
  take: takeEnumerator, // U20
  takeAll: takeAllEnumerator, // U20
  rest: restEnumerator, // U20
  retreat: retreatEnumerator, // U20
  gather: gatherEnumerator, // U20
  talk: none, // U33
  enterPortal: enterPortalEnumerator, // U30 (horde.ts)
  interact: none, // U33
  wait: waitEnumerator, // U20
  letGo: letGoEnumerator, // U30
  keepVigil: keepVigilEnumerator, // U30
  use: inventoryEnumerators.use, // U21
  equip: inventoryEnumerators.equip, // U21
  unequip: inventoryEnumerators.unequip, // U21
  drop: inventoryEnumerators.drop, // U21
  allocateStat: inventoryEnumerators.allocateStat, // U21
  unlockAbility: inventoryEnumerators.unlockAbility, // U21
  readBook: inventoryEnumerators.readBook, // U21
  respec: inventoryEnumerators.respec, // U21
  buy: buyEnumerator, // U34
  sell: sellEnumerator, // U34
  craft: craftEnumerator, // U34
  upgrade: upgradeEnumerator, // U34
  salvage: salvageEnumerator, // U34
  choose: chooseEnumerator, // U20 (Loop 1 Apex prompt) / U33
  continue: none, // U33
  acceptQuest: none, // U33
  attack: attackEnumerator, // U23
  ability: abilityEnumerator, // U26
  guard: guardEnumerator, // U23
  item: itemEnumerator, // U26
  flee: fleeEnumerator, // U26
  companionCommand: companionCommandEnumerator, // U26 (signature) / U28 (cost, focus, hold)
  setStance: setStanceEnumerator, // U28
  commune: communeEnumerator, // U29
  swapCompanion: swapCompanionEnumerator, // U28
  acknowledgeEnding: acknowledgeEndingEnumerator, // U30
  thresholdGo: thresholdGoEnumerator, // U31
  thresholdSpend: thresholdSpendEnumerator, // U31
  thresholdRefund: thresholdRefundEnumerator, // U31
  equipAttunement: equipAttunementEnumerator, // U31
  toggleModifier: toggleModifierEnumerator, // U31
  newLoop: newLoopEnumerator, // U31
  newGamePlus: newGamePlusEnumerator, // U31
};

const ACTION_TYPES = Object.keys(ACTION_MODES) as ActionType[];

/** True if `type` is an Action type at all (untrusted input: traces, scenario files, the e2e hook). */
export function isActionType(type: unknown): type is ActionType {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(ACTION_MODES, type);
}

/** Secondary order key: the action's parameters as canonical JSON (stable across key order). */
const sortKey = (a: Action): string => canonicalJson(a);

/** legalActions over an explicit enumerator table (the game passes ENUMERATORS; tests pass stand-ins). */
export function enumerateLegal(
  table: EnumeratorTable,
  state: GameState,
  content: ContentPack,
  profile: Profile,
  opts: LegalOptions = {},
): Action[] {
  const out: { a: Action; k: string }[] = [];
  for (const type of ACTION_TYPES) {
    if (!ACTION_MODES[type].includes(state.mode)) continue;
    if (type === 'examine' && !opts.includeExamine) continue;
    for (const a of (table[type] as Enumerator<ActionType>)(state, content, profile, opts)) out.push({ a, k: sortKey(a) });
  }
  out.sort((x, y) => (x.a.type < y.a.type ? -1 : x.a.type > y.a.type ? 1 : x.k < y.k ? -1 : x.k > y.k ? 1 : 0));
  return out.map((x) => x.a);
}

/**
 * Enumerates every action `step` would accept from this state (PLAN §4.7): only types whose ACTION_MODES include
 * `state.mode`, each via its enumerator; deterministic order (type, then parameters) so "pick first" bots replay.
 */
export function legalActions(state: GameState, content: ContentPack, profile: Profile, opts: LegalOptions = {}): Action[] {
  return enumerateLegal(ENUMERATORS, state, content, profile, opts);
}

/** Single-action check over an explicit table; same rules as enumerateLegal. */
export function isLegalIn(table: EnumeratorTable, state: GameState, action: Action, content: ContentPack, profile: Profile): boolean {
  if (!isActionType(action.type) || !ACTION_MODES[action.type].includes(state.mode)) return false;
  const key = sortKey(action);
  return (table[action.type] as Enumerator<ActionType>)(state, content, profile, { includeExamine: true }).some(
    (a) => sortKey(a) === key,
  );
}

/** Cheap single-action check for the UI (one button); same rules as legalActions. */
export function isLegal(state: GameState, action: Action, content: ContentPack, profile: Profile): boolean {
  return isLegalIn(ENUMERATORS, state, action, content, profile);
}
