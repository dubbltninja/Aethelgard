// step — the only state transition (PLAN §4.6). Pure: same (state, action, content, profile) → same result; inputs
// are never mutated. The state is structuredClone'd into a draft (D-065), the profile is cloned only if a reducer
// writes it, and an illegal action returns the *same* state/profile references plus one `actionRejected` event
// (D-043). Dispatch is a table with one handler per Action['type']; until a reducer unit lands, its handler rejects
// with the unit's name, so the table is exhaustive from day one and `legalActions` (all-empty) agrees with it.
import { Ctx, RejectSignal, type ContentPack, type StepCtx } from './ctx';
import { ACTION_MODES, isActionType } from './legalActions';
import {
  arrivalHook,
  chooseHandler,
  examineHandler,
  gatherHandler,
  moveHandler,
  restHandler,
  retreatHandler,
  takeAllHandler,
  takeHandler,
  waitHandler,
} from './reducers/explore';
import { clockHook } from './reducers/loop';
import { characterPostStep, inventoryHandlers } from './reducers/inventory';
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
/** Runs after every accepted action (quest sweep U33, achievements, clock warnings U20, mode transitions). */
export type PostStepHook = (ctx: StepCtx) => void;
export type StepFn = (state: GameState, action: Action, content: ContentPack, profile: Profile) => StepResult;

/** Stub handler: rejects, naming the unit that will implement the reducer (PLAN §9.2). */
const pending =
  (unit: string) =>
  (ctx: StepCtx, action: Action): void =>
    ctx.reject(`'${action.type}' is not implemented yet (${unit})`);

export const HANDLERS: HandlerTable = {
  newGame: pending('U30'),
  chooseClass: pending('U30/U31'),
  save: pending('U22'),
  load: pending('U22'),
  returnToTitle: pending('U30'),
  move: moveHandler,
  examine: examineHandler,
  take: takeHandler,
  takeAll: takeAllHandler,
  rest: restHandler,
  retreat: retreatHandler,
  gather: gatherHandler,
  talk: pending('U33'),
  enterPortal: pending('U30'),
  interact: pending('U33'),
  wait: waitHandler,
  letGo: pending('U30'),
  keepVigil: pending('U30'),
  use: inventoryHandlers.use,
  equip: inventoryHandlers.equip,
  unequip: inventoryHandlers.unequip,
  drop: inventoryHandlers.drop,
  allocateStat: inventoryHandlers.allocateStat,
  unlockAbility: inventoryHandlers.unlockAbility,
  readBook: inventoryHandlers.readBook,
  respec: inventoryHandlers.respec,
  buy: pending('U34'),
  sell: pending('U34'),
  craft: pending('U34'),
  upgrade: pending('U34'),
  salvage: pending('U34'),
  choose: chooseHandler, // U20: the Loop 1 Apex prompt only; U33's dialogue reducer replaces it and keeps that branch
  continue: pending('U33'),
  acceptQuest: pending('U33'),
  attack: pending('U23'),
  ability: pending('U26'),
  guard: pending('U23'),
  item: pending('U26'),
  flee: pending('U26'),
  companionCommand: pending('U28'),
  setStance: pending('U28'),
  commune: pending('U29'),
  swapCompanion: pending('U28'),
  acknowledgeEnding: pending('U30'),
  thresholdGo: pending('U31'),
  thresholdSpend: pending('U31'),
  thresholdRefund: pending('U31'),
  equipAttunement: pending('U31'),
  toggleModifier: pending('U31'),
  newLoop: pending('U31'),
  newGamePlus: pending('U31'),
};

/** Post-step hooks in run order; later units append theirs here. */
export const POST_STEP_HOOKS: readonly PostStepHook[] = [
  arrivalHook, // U20: arrival pipeline for content teleports
  clockHook, // U20: per-watch status ticks, dawn hooks, clock warnings, expiry
  characterPostStep, // U21: Weaver mark at max Corruption; stored maxima = derive() outside combat
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
    const ctx = new Ctx(clone(state), profile, content);
    let out: { profile: Profile; profileCloned: boolean };
    try {
      (handlers[type] as (ctx: StepCtx, action: Action) => void)(ctx, action);
      for (const hook of hooks) hook(ctx);
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
