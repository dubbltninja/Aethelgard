// legalActions (PLAN §4.7): every action `step` would accept from a state. The per-type structure is fixed and
// exhaustive — a mode table and one enumerator per Action['type'], each built on the same predicate as its reducer —
// and `step` uses ACTION_MODES (then `reservedParam`) as its first gates, so the two never disagree about modes or ids.
// U35 proved legal/step agreement over the fixture corpus (tests/unit/engine/legalActions.property.test.ts, C2).
//
// Enumeration contract. Each enumerator lists exactly the parameterizations `step` accepts, one action per distinct
// outcome, except where an action has other spellings of the same thing or a free-form parameter; there it lists one
// canonical representative and `isLegal` (not list membership) answers for the rest:
//   newGame   free-text `name`/`seed`: one per class, the default name, no seed; any name/seed is accepted.
//   load      the shell's parsed save file: never listed (the state holds no file); legal in title mode exactly when
//             the file deserializes and resumes into explore/threshold (`loadable`).
//   drop      PLAN §4.7: one per distinct itemId (its first droppable stack, whole); every droppable stack, qty 1..n.
//   sell      PLAN §4.7: one per merchant × distinct itemId (first sellable stack, qty 1); every stack, qty 1..n.
//   buy       one per stock line at qty 1 (qty omitted); any qty 1..n the purse and the pack allow.
//   equip     weapons/armor without a slot (implied), trinkets once per trinket slot; the item's own slot spelled out
//             (weapon/armor) or omitted (trinket: the first free one) is the same equip.
//   ability, companionCommand 'signature', item
//             one per valid target; an omitted target takes the default (DESIGN §4.8: the first living enemy for an
//             enemy ability or a thrown item, the companion if standing else the player for an ally ability); a heal
//             is listed untargeted for the player, and naming the player is the same use.
//   examine   listed only on request (`includeExamine`, PLAN §4.7).
// Ids never name an Object.prototype member (content rule-06 reserves them): `step` rejects such a parameter up front.
//
// Never empty — there is no terminal state with an empty list. Title lists `newGame` per class; explore, threshold and
// ending list `returnToTitle` (threshold also `thresholdGo`, ending `acknowledgeEnding` while slides remain); dialogue
// lists `choose` or else `continue`; combat stops only on the player's turn (`guard` always: no content status blocks
// it), the communion's Resolution (`commune` speak, at least one outcome or the fight closes) or the Loop 1 FALLEN
// screen (`returnToTitle` alone, phase 'defeat', D-082). Over the U35 corpus every other state also lists a game action
// besides save/load/newGame/returnToTitle.
import type { ContentPack } from './ctx';
import {
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
import { continueEnumerator, dialogueChooseEnumerator, interactEnumerator, talkEnumerator } from './reducers/dialogue';
import { acceptQuestEnumerator } from './reducers/quests';
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
import { loadable, saveEnumerator } from './saves/reducers';
import { checkDrop, checkEquip } from './reducers/inventory';
import { checkBuy, checkSell } from './reducers/economy';
import { combatAbilityProblem, combatItemProblem, fieldAbilityProblem } from './combat/abilities';
import { commandProblem } from './combat/companionAi';
import { playerTurnCombat } from './reducers/combat';
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
  talk: ['explore', 'threshold'], // threshold: whoever stands at the Threshold place (Dask, D-012, D-084)
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
  talk: talkEnumerator, // U33
  enterPortal: enterPortalEnumerator, // U30 (horde.ts)
  interact: interactEnumerator, // U33
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
  choose: dialogueChooseEnumerator, // U33 (the Loop 1 Apex prompt: U20's)
  continue: continueEnumerator, // U33
  acceptQuest: acceptQuestEnumerator, // U33
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

/**
 * An action parameter that names an Object.prototype member (`'toString'`, `'__proto__'` …), or null. No content id can
 * (rule-06) and no uid does, so such an action is illegal; `step` rejects it before any reducer looks it up in a
 * content table (a plain record would hand back the prototype's member). Free text (`newGame` name and seed) and the
 * `load` payload are not ids.
 */
export function reservedParam(action: Action): string | null {
  const scan = (o: object, skip: readonly string[]): string | null => {
    for (const [k, v] of Object.entries(o)) {
      if (skip.includes(k)) continue;
      if (typeof v === 'string' && v in Object.prototype) return v;
      if (k === 'target' && typeof v === 'object' && v !== null) {
        const inner = scan(v, ['kind']);
        if (inner !== null) return inner;
      }
    }
    return null;
  };
  return scan(action, ['type', 'name', 'seed', 'save']);
}

/**
 * The actions whose enumerators list a canonical representative (see the header): `isLegal` asks the reducer's own
 * predicate instead of list membership, so every accepted spelling is legal. Mode and reserved ids are checked first.
 */
const ALIASED: { readonly [K in ActionType]?: (s: GameState, a: ActionOf<K>, content: ContentPack, profile: Profile) => boolean } = {
  newGame: (_s, a, content) => content.classes[a.classId] !== undefined,
  load: (_s, a, content) => typeof loadable(a.save, content) !== 'string',
  drop: (s, a, content) => typeof checkDrop(s, content, a) !== 'string',
  sell: (s, a, content, profile) => typeof checkSell(s, content, profile, a) !== 'string',
  buy: (s, a, content, profile) => typeof checkBuy(s, content, profile, a) !== 'string',
  equip: (s, a, content, profile) => typeof checkEquip(s, content, profile, a) !== 'string',
  ability: (s, a, content) => {
    if (s.mode !== 'combat') return fieldAbilityProblem(s, content, a.abilityId, a.targetUid) === null;
    const combat = playerTurnCombat(s);
    return combat !== null && combatAbilityProblem(s, content, combat, a.abilityId, a.targetUid) === null;
  },
  item: (s, a, content) => {
    const combat = playerTurnCombat(s);
    return combat !== null && combatItemProblem(s, content, combat, a) === null;
  },
  companionCommand: (s, a, content) => {
    const combat = playerTurnCombat(s);
    return combat !== null && commandProblem(content, combat, a) === null;
  },
};

/** Single-action check over an explicit table: mode, reserved ids, then list membership (key order does not matter). */
export function isLegalIn(table: EnumeratorTable, state: GameState, action: Action, content: ContentPack, profile: Profile): boolean {
  if (!isActionType(action.type) || !ACTION_MODES[action.type].includes(state.mode) || reservedParam(action) !== null) return false;
  const key = sortKey(action);
  return (table[action.type] as Enumerator<ActionType>)(state, content, profile, { includeExamine: true }).some(
    (a) => sortKey(a) === key,
  );
}

/**
 * Cheap single-action check for the UI (one button); same rules as legalActions, and true for every spelling `step`
 * accepts: membership in the type's list, or — for the types listed by a canonical representative — the reducer's own
 * predicate. Equal to "step accepts" over the U35 corpus (legalActions.property.test.ts).
 */
export function isLegal(state: GameState, action: Action, content: ContentPack, profile: Profile): boolean {
  if (!isActionType(action.type) || !ACTION_MODES[action.type].includes(state.mode) || reservedParam(action) !== null) return false;
  const direct = ALIASED[action.type] as ((s: GameState, a: Action, content: ContentPack, profile: Profile) => boolean) | undefined;
  return direct !== undefined ? direct(state, action, content, profile) : isLegalIn(ENUMERATORS, state, action, content, profile);
}
