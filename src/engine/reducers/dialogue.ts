// Dialogue reducer (U33; DESIGN §12.5, §12.7, §13.2; PLAN §5.10, §8.1 "dialogue"; STORY §13; D-059, D-074, C-58).
// A scene's lifecycle — open, entry node, text variants, `onEnter`, companion interjections, close with the companion's
// reaction, `onEnd` and the return to the interrupted mode — is effects.ts `openScene` / `enterNode` / `closeScene`
// (the `startDialogue` effect needs it inside the step). This file picks scenes and plays the player's side:
//
//   talk (explore,   to an NPC standing here: of the scenes with that `npcId` whose `when` holds — a non-repeatable one
//    threshold)      only until it has ended this loop (`flag_scene_done_<scene>`) — the highest `priority` opens
//                    (content order on ties). No scene: nothing to say (not legal). "Here" at the Threshold is the place
//                    the Wayfinder stands in (threshold.ts `thresholdLocationId`: Dask on the Still Shore, D-012, D-084);
//                    the scene returns to the Threshold when it ends.
//   choose           the current node's choices: one whose `when` fails is hidden, or shown greyed when it has a
//                    `disabledText`; one whose `disabledWhen` holds is greyed with its `disabledText` (default "(You do
//                    not yet know this)"); a `once` choice is hidden after it was taken in this visit of the scene, an
//                    `oncePerLoop` one once `flag_choice_<scene>_<choice>` is set (written when taken). Taking one applies
//                    its effects, then goes to its `next` (`end` closes the scene) — unless an effect started another
//                    scene, a fight or an ending. The Loop 1 Apex prompt (*Face it / Not yet*) is U20's engine-built
//                    scene and keeps its own handler (reducers/explore.ts, D-074).
//   continue         on a node with no choice to take: its `next` (absent: the scene ends).
//   camp (rest)      a full rest with a companion standing in the party opens at most one of that companion's
//                    `campScenes` that holds and has not been played this loop (highest priority), as a dialogue
//                    overlay on the rest (D-059), worth +2 loyalty (DESIGN §12.5, through the `loyalty` effect).
//   interact         a location event with `trigger: 'interact'` here whose `when` holds (`once`: until it fired this
//                    loop) fires — its effects may open a scene (`startDialogue`).
import type { DialogueChoice, DialogueScene } from '@schema/dialogue';
import type { LocationEvent } from '@schema/location';
import { evaluate, isFlagSet } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { apply, applyAll, choiceFlag, currentNode, enterNode, openScene, openSceneDef, sceneDoneFlag, settleDialogue } from '../effects';
import type { Enumerator } from '../legalActions';
import type { ActionOf } from '../types/actions';
import type { CompanionId } from '../types/ids';
import type { Profile } from '../types/profile';
import type { GameState } from '../types/state';
import {
  chooseEnumerator as apexChooseEnumerator,
  chooseHandler as apexChooseHandler,
  currentLocation,
  fireEvent,
  isApexPromptOpen,
  npcStandsAt,
  npcsAt,
  restHandler,
} from './explore';
import { thresholdLocationId } from './threshold';

type Pr = Readonly<Profile>;

/** DESIGN §12.5: a camp conversation is worth +2 loyalty (×1.25 with Companion's Trust). */
export const CAMP_LOYALTY = 2;
/** DESIGN §13.2: the greyed reason of an Echo-locked line when content gives none. */
export const DEFAULT_DISABLED_TEXT = '(You do not yet know this)';

// ---- scene selection ------------------------------------------------------------------------------------------------------

/** A scene can play now: its `when` holds and, if it is not repeatable, it has not ended this loop. */
export function sceneAvailable(s: GameState, content: ContentPack, profile: Pr, scene: DialogueScene): boolean {
  if (!scene.repeatable && isFlagSet(s, sceneDoneFlag(scene.id))) return false;
  return scene.when === undefined || evaluate(scene.when, s, profile, content);
}

/** The highest-priority available scene among `scenes` (the first on ties). */
function best(s: GameState, content: ContentPack, profile: Pr, scenes: readonly (DialogueScene | undefined)[]): DialogueScene | undefined {
  let pick: DialogueScene | undefined;
  for (const scene of scenes) {
    if (scene === undefined || !sceneAvailable(s, content, profile, scene)) continue;
    if (pick === undefined || scene.priority > pick.priority) pick = scene;
  }
  return pick;
}

/** The scene `talk` to `npcId` opens now, if any. */
export function sceneForNpc(s: GameState, content: ContentPack, profile: Pr, npcId: string): DialogueScene | undefined {
  return best(
    s,
    content,
    profile,
    Object.values(content.dialogues).filter((scene) => scene.npcId === npcId),
  );
}

/** Where `talk` looks for people: the current location, or at the Threshold the place the Wayfinder stands in. */
export const talkLocationId = (s: GameState): string => (s.mode === 'threshold' ? thresholdLocationId(s) : s.world.currentLocationId);

/** Why the player cannot talk to `npcId` now (null: they can). */
export function talkProblem(s: GameState, content: ContentPack, profile: Pr, npcId: string): string | null {
  const name = content.npcs[npcId]?.name ?? npcId;
  if (!npcStandsAt(s, content, profile, npcId, talkLocationId(s))) return `${name} is not here`;
  return sceneForNpc(s, content, profile, npcId) === undefined ? `${name} has nothing more to say` : null;
}

/** `talk` (explore): opens the NPC's scene (see the header). */
export function talkHandler(ctx: StepCtx, a: ActionOf<'talk'>): void {
  const why = talkProblem(ctx.s, ctx.content, ctx.profile, a.npcId);
  if (why !== null) ctx.reject(why);
  openScene(ctx, (sceneForNpc(ctx.s, ctx.content, ctx.profile, a.npcId) as DialogueScene).id, a.npcId);
}

export const talkEnumerator: Enumerator<'talk'> = (s, content, profile) =>
  npcsAt(s, content, profile, talkLocationId(s))
    .filter((npcId) => talkProblem(s, content, profile, npcId) === null)
    .map((npcId) => ({ type: 'talk', npcId }));

// ---- choices --------------------------------------------------------------------------------------------------------------

/** A choice as the player sees it (the UI's ChoiceList). */
export interface ChoiceView {
  id: string;
  text: string;
  enabled: boolean;
  /** Why it is greyed (only when disabled). */
  disabledText?: string;
  tags: DialogueChoice['tags'];
  echoHint?: string;
  hotkey?: string;
}

/** `DialogueState.choicesTaken` entry: choice ids are unique within a node only. */
const takenKey = (nodeId: string, choiceId: string): string => `${nodeId}:${choiceId}`;

/** The current node's choices the player sees, in order (hidden ones left out; greyed ones with their reason). */
export function choiceViews(s: GameState, content: ContentPack, profile: Pr): ChoiceView[] {
  const scene = openSceneDef(s, content);
  const node = currentNode(s, content);
  const d = s.dialogue;
  if (scene === undefined || node === undefined || d === null) return [];
  const out: ChoiceView[] = [];
  for (const c of node.choices) {
    if (c.once && d.choicesTaken.includes(takenKey(node.id, c.id))) continue;
    if (c.oncePerLoop && isFlagSet(s, choiceFlag(scene.id, c.id))) continue;
    const shown = c.when === undefined || evaluate(c.when, s, profile, content);
    if (!shown && c.disabledText === undefined) continue;
    const greyed = !shown || (c.disabledWhen !== undefined && evaluate(c.disabledWhen, s, profile, content));
    out.push({
      id: c.id,
      text: c.text,
      enabled: !greyed,
      ...(greyed ? { disabledText: c.disabledText ?? DEFAULT_DISABLED_TEXT } : {}),
      tags: c.tags,
      ...(c.echoHint !== undefined ? { echoHint: c.echoHint } : {}),
      ...(c.hotkey !== undefined ? { hotkey: c.hotkey } : {}),
    });
  }
  return out;
}

/** The ids of the choices that can be taken now. */
export const takeableChoices = (s: GameState, content: ContentPack, profile: Pr): string[] =>
  choiceViews(s, content, profile)
    .filter((v) => v.enabled)
    .map((v) => v.id);

/** `choose` (dialogue): the Apex prompt's own handler (U20), else the open scene's choice (see the header). */
export function dialogueChooseHandler(ctx: StepCtx, a: ActionOf<'choose'>): void {
  if (isApexPromptOpen(ctx.s)) {
    apexChooseHandler(ctx, a);
    return;
  }
  const { s, content, profile } = ctx;
  const d = s.dialogue;
  const scene = openSceneDef(s, content);
  const node = currentNode(s, content);
  if (d === null || scene === undefined || node === undefined) ctx.reject('there is no conversation to answer');
  const view = choiceViews(s, content, profile).find((v) => v.id === a.choiceId);
  if (view === undefined) ctx.reject(`'${a.choiceId}' is not a choice here`);
  if (!view.enabled) ctx.reject(view.disabledText ?? DEFAULT_DISABLED_TEXT);
  const choice = node.choices.find((c) => c.id === a.choiceId) as DialogueChoice;
  d.choicesTaken.push(takenKey(node.id, choice.id));
  if (choice.oncePerLoop) s.flags[choiceFlag(scene.id, choice.id)] = true;
  applyAll(choice.effects, ctx, { source: `choice:${choice.id}` });
  if (settleDialogue(ctx, d)) return; // a fight, an ending, or another scene took over
  enterNode(ctx, choice.next);
}

export const dialogueChooseEnumerator: Enumerator<'choose'> = (s, content, profile, opts) =>
  isApexPromptOpen(s) ? apexChooseEnumerator(s, content, profile, opts) : takeableChoices(s, content, profile).map((choiceId) => ({ type: 'choose', choiceId }));

/** Why `continue` is not possible: no content scene open, or the node has a choice to take. */
function continueProblem(s: GameState, content: ContentPack, profile: Pr): string | null {
  if (currentNode(s, content) === undefined) return 'there is nothing to continue';
  return takeableChoices(s, content, profile).length > 0 ? 'choose an answer' : null;
}

/** `continue` (dialogue): a node with no choice to take goes to its `next` (absent: the scene ends). */
export function continueHandler(ctx: StepCtx): void {
  const why = continueProblem(ctx.s, ctx.content, ctx.profile);
  if (why !== null) ctx.reject(why);
  enterNode(ctx, currentNode(ctx.s, ctx.content)?.next ?? 'end');
}

export const continueEnumerator: Enumerator<'continue'> = (s, content, profile) =>
  continueProblem(s, content, profile) === null ? [{ type: 'continue' }] : [];

// ---- camp conversations (D-059) ---------------------------------------------------------------------------------------------

/** The camp conversation a full rest here would open now: the standing companion's best playable camp scene. */
export function campSceneFor(s: GameState, content: ContentPack, profile: Pr): { sceneId: string; companionId: CompanionId; npcId: string } | undefined {
  if (s.mode !== 'explore') return undefined;
  const id = s.companions.activeId;
  const c = id === null ? undefined : s.companions.recruited[id];
  const def = id === null ? undefined : content.companions[id];
  if (c === undefined || def === undefined || !c.recruited || c.dead || c.ko) return undefined;
  const fresh = def.campScenes.map((sceneId) => content.dialogues[sceneId]).filter((scene) => scene !== undefined && !isFlagSet(s, sceneDoneFlag(scene.id)));
  const scene = best(s, content, profile, fresh);
  return scene === undefined ? undefined : { sceneId: scene.id, companionId: def.id, npcId: def.npcId };
}

/** `rest` (U20's reducer, reducers/explore.ts), then — after a full rest — the camp conversation, if one is due. */
export function campRestHandler(ctx: StepCtx, a: ActionOf<'rest'>): void {
  const at = ctx.s.world.currentLocationId;
  restHandler(ctx, a);
  if (a.kind !== 'full' || ctx.s.world.currentLocationId !== at) return;
  const camp = campSceneFor(ctx.s, ctx.content, ctx.profile);
  if (camp === undefined) return;
  openScene(ctx, camp.sceneId, camp.npcId);
  apply({ loyalty: { companion: camp.companionId, delta: CAMP_LOYALTY } }, ctx, { source: `camp:${camp.sceneId}` });
}

// ---- interact -----------------------------------------------------------------------------------------------------------------

/** The `interact` events at the current location that can fire now. */
export function interactables(s: GameState, content: ContentPack, profile: Pr): LocationEvent[] {
  const loc = currentLocation(s, content);
  if (loc === undefined) return [];
  const fired = s.world.locationStates[loc.id]?.eventsFired ?? [];
  return loc.events.filter(
    (ev) => ev.trigger === 'interact' && !(ev.once && fired.includes(ev.id)) && (ev.when === undefined || evaluate(ev.when, s, profile, content)),
  );
}

/** `interact` (explore): fires a location's interactable event (its text, its effects). */
export function interactHandler(ctx: StepCtx, a: ActionOf<'interact'>): void {
  const ev = interactables(ctx.s, ctx.content, ctx.profile).find((e) => e.id === a.eventId);
  if (ev === undefined) ctx.reject(`there is nothing to do with '${a.eventId}' here`);
  fireEvent(ctx, ctx.s.world.currentLocationId, ev);
}

export const interactEnumerator: Enumerator<'interact'> = (s, content, profile) =>
  interactables(s, content, profile).map((ev) => ({ type: 'interact', eventId: ev.id }));
