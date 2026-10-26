// step — the only state transition (PLAN §4.6). Pure: same (state, action, content, profile) → same result; inputs
// are never mutated. The state is structuredClone'd into a draft (D-065), the profile is cloned only if a reducer
// writes it, and an illegal action returns the *same* state/profile references plus one `actionRejected` event
// (D-043). Dispatch is a table with one handler per Action['type'] (every one implemented since U33/U34; until then a
// stub rejected with the owning unit's name), so the table is exhaustive and `legalActions` agrees with it.
import { Ctx, RejectSignal, type ContentPack, type StepCtx } from './ctx';
import { ACTION_MODES, isActionType, reservedParam } from './legalActions';
import {
  arrivalHook,
  examineHandler,
  gatherHandler,
  moveHandler,
  retreatHandler,
  takeAllHandler,
  takeHandler,
  waitHandler,
} from './reducers/explore';
import { campRestHandler, continueHandler, dialogueChooseHandler, interactHandler, talkHandler } from './reducers/dialogue';
import { acceptQuestHandler, questPostStep } from './reducers/quests';
import {
  acknowledgeEndingHandler,
  clockHook,
  keepVigilHandler,
  letGoHandler,
  loopEndHook,
  newGameHandler,
  returnToTitleHandler,
} from './reducers/loop';
import { enterPortalHandler, hordePostStep } from './horde';
import { echoPostStep } from './echoes';
import { hazardPostStep } from './hazards';
import {
  chooseClassHandler,
  equipAttunementHandler,
  newGamePlusHandler,
  newLoopHandler,
  thresholdGoHandler,
  thresholdPostStep,
  thresholdRefundHandler,
  thresholdSpendHandler,
  toggleModifierHandler,
} from './reducers/threshold';
import { characterPostStep, inventoryHandlers } from './reducers/inventory';
import { buyHandler, economyPostStep, sellHandler } from './reducers/economy';
import { craftHandler, salvageHandler, upgradeHandler } from './reducers/crafting';
import {
  abilityHandler,
  attackHandler,
  combatPostStep,
  communeHandler,
  companionCommandHandler,
  fleeHandler,
  guardHandler,
  itemHandler,
  setStanceHandler,
  swapCompanionHandler,
} from './reducers/combat';
import { companionPostStep } from './combat/companionAi';
import { codexUnlockPass } from './codexUnlock';
import { achievementPostStep } from './achievements';
import { loadHandler, saveHandler } from './saves/reducers';
import type { Action, ActionOf, ActionType } from './types/actions';
import type { GameEvent } from './types/events';
import type { Profile } from './types/profile';
import type { GameState } from './types/state';
import { clone, deepFreeze } from './util/clone';

export interface StepResult {
  state: GameState;
  profile: Profile;
  events: GameEvent[];
}

/** A reducer for one action type: mutates `ctx.s` / `ctx.profileDraft()`, or calls `ctx.reject` before mutating. */
export type Handler<K extends ActionType> = (ctx: StepCtx, action: ActionOf<K>) => void;
export type HandlerTable = { readonly [K in ActionType]: Handler<K> };
/**
 * Runs after every accepted action (quest sweep U33, achievements, clock warnings U20, mode transitions). U62a: a hook is
 * also given what `step` was given — the state and profile before the action, and the action — for the codex pass
 * (optional: a test that drives hooks by hand passes only the ctx, and the codex pass then does nothing).
 */
export type PostStepHook = (ctx: StepCtx, before?: GameState, beforeProfile?: Readonly<Profile>, action?: Action) => void;
export type StepFn = (state: GameState, action: Action, content: ContentPack, profile: Profile) => StepResult;

export const HANDLERS: HandlerTable = {
  newGame: newGameHandler, // U30
  chooseClass: chooseClassHandler, // U31: the Far Light (the title's class choice is part of `newGame`)
  save: saveHandler, // U22
  load: loadHandler, // U22
  returnToTitle: returnToTitleHandler, // U30 (also the Loop 1 FALLEN acknowledgement, D-075)
  move: moveHandler,
  examine: examineHandler,
  take: takeHandler,
  takeAll: takeAllHandler,
  rest: campRestHandler, // U20 (reducers/explore.ts); U33: then the camp conversation of a full rest (D-059)
  retreat: retreatHandler,
  gather: gatherHandler,
  talk: talkHandler, // U33 (reducers/dialogue.ts)
  enterPortal: enterPortalHandler, // U30 (horde.ts)
  interact: interactHandler, // U33
  wait: waitHandler,
  letGo: letGoHandler, // U30
  keepVigil: keepVigilHandler, // U30
  use: inventoryHandlers.use,
  equip: inventoryHandlers.equip,
  unequip: inventoryHandlers.unequip,
  drop: inventoryHandlers.drop,
  allocateStat: inventoryHandlers.allocateStat,
  unlockAbility: inventoryHandlers.unlockAbility,
  readBook: inventoryHandlers.readBook,
  respec: inventoryHandlers.respec,
  buy: buyHandler, // U34 (reducers/economy.ts)
  sell: sellHandler, // U34
  craft: craftHandler, // U34 (reducers/crafting.ts)
  upgrade: upgradeHandler, // U34
  salvage: salvageHandler, // U34
  choose: dialogueChooseHandler, // U33; the Loop 1 Apex prompt keeps U20's handler (D-074)
  continue: continueHandler, // U33
  acceptQuest: acceptQuestHandler, // U33 (reducers/quests.ts)
  attack: attackHandler, // U23
  ability: abilityHandler, // U26 (in a fight, and `field` abilities out of one)
  guard: guardHandler, // U23 (Guard abilities such as Iron Guard: U26 abilities)
  item: itemHandler, // U26
  flee: fleeHandler, // U26
  companionCommand: companionCommandHandler, // U26: the signature (DESIGN §4.1 `C`); U28: its cost, focus/hold orders
  setStance: setStanceHandler, // U28
  commune: communeHandler, // U29 (communion.ts)
  swapCompanion: swapCompanionHandler, // U28
  acknowledgeEnding: acknowledgeEndingHandler, // U30
  thresholdGo: thresholdGoHandler, // U31 (reducers/threshold.ts)
  thresholdSpend: thresholdSpendHandler, // U31
  thresholdRefund: thresholdRefundHandler, // U31
  equipAttunement: equipAttunementHandler, // U31
  toggleModifier: toggleModifierHandler, // U31
  newLoop: newLoopHandler, // U31
  newGamePlus: newGamePlusHandler, // U31
};

/** Post-step hooks in run order; later units append theirs here. */
export const POST_STEP_HOOKS: readonly PostStepHook[] = [
  questPostStep, // U33: Echo shortcuts, auto-starts, the objective sweep; first, so its effects reach the hooks below
  arrivalHook, // U20: arrival pipeline for content teleports
  clockHook, // U20: per-watch status ticks, dawn hooks, clock warnings, expiry
  hazardPostStep, // U34e: watches spent standing at a hazard (the Unmaking, the Void-chill); before a fight's opening reads them
  characterPostStep, // U21: Weaver mark at max Corruption; stored maxima = derive() outside combat
  companionPostStep, // U28: companion max HP by level; Dask's places (D-059) outside a fight
  combatPostStep, // U23: a fight started this step plays until the player's first turn
  hordePostStep, // U30: a Tyrant killed in a fight that is over starts the Horde (horde.ts)
  echoPostStep, // U32: bond starts and shortcuts for this step's recruits/quests; echo_tyrant_jailer; loop-end Echoes
  loopEndHook, // U30: a step that entered ending mode closes the loop (reducers/loop.ts)
  thresholdPostStep, // U31: the loop's Resonance tally and modifier multiplier, the Still Shore, the Threshold autosave
  economyPostStep, // U34: the Before's merchants restock each Before day; a merchant met for the first time gets its stock
  codexUnlockPass, // U62a: codex entries whose `unlockWhen` this step made true unlock (codexUnlock.ts)
  achievementPostStep, // U81a: last — the tallies, then the achievements whose checkpoint this step reached (achievements.ts)
];

const rejected = (state: GameState, profile: Profile, action: Action, reason: string): StepResult => ({
  state,
  profile,
  events: [{ t: 'actionRejected', action, reason }],
});

/**
 * Builds a `step` over a handler table and hooks. The game uses `step` (HANDLERS + POST_STEP_HOOKS); tests build
 * their own to exercise the accept path with stand-in reducers.
 */
export function createStep(handlers: HandlerTable, hooks: readonly PostStepHook[] = []): StepFn {
  return (state, action, content, profile) => {
    const type: unknown = (action as { type?: unknown } | null)?.type;
    if (!isActionType(type)) return rejected(state, profile, action, `unknown action type '${String(type)}'`);
    if (!ACTION_MODES[type].includes(state.mode)) {
      return rejected(state, profile, action, `'${type}' is not available in ${state.mode} mode`);
    }
    const reserved = reservedParam(action);
    if (reserved !== null) return rejected(state, profile, action, `'${reserved}' names nothing in this game`); // U35
    const ctx = new Ctx(clone(state), profile, content);
    let out: { profile: Profile; profileCloned: boolean };
    try {
      (handlers[type] as (ctx: StepCtx, action: Action) => void)(ctx, action);
      for (const hook of hooks) hook(ctx, state, profile, action);
      out = ctx.commit();
      ctx.s.meta.stepCount += 1;
    } catch (e) {
      if (e instanceof RejectSignal) return rejected(state, profile, action, e.reason);
      throw e; // programmer error (missing content id after validation, corrupt state): surface loudly
    }
    if (__DEV__) {
      // dev/test only: a later reducer that mutates its input fails at once. The caller's profile is never frozen.
      deepFreeze(ctx.s);
      deepFreeze(ctx.events);
      if (out.profileCloned) deepFreeze(out.profile);
    }
    return { state: ctx.s, profile: out.profile, events: ctx.events };
  };
}

const stepImpl = createStep(HANDLERS, POST_STEP_HOOKS);

/**
 * The only transition (PLAN §4.6, D-041): `step(state, action, content, profile) → { state, profile, events }`.
 * Pure; never throws for an illegal action (D-043).
 */
export function step(state: GameState, action: Action, content: ContentPack, profile: Profile): StepResult {
  return stepImpl(state, action, content, profile);
}
