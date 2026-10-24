// What the onboarding model reads off the screen (U70): a plain-data snapshot of the state, the pack and the legal actions.
// Pure; the container (Callouts.tsx) calls it on every change.
import { dayOf, type Action, type ContentPack, type GameState, type Profile } from '@engine/index';
import { walkSteps, type Creature } from '@schema/creature';
import { dialogueModel } from '../screens/dialogueModel';
import { legalSet } from '../screens/exploreModel';
import type { CombatSnapshot, OnboardingSnapshot } from './model';

/** A creature that changes plans at half health or lower (the Wildling Brute, DESIGN §16.8): an `if hpBelow ≤ 0.5` step in its pattern. */
export function changesPlansBelowHalf(creature: Pick<Creature, 'pattern'> | undefined): boolean {
  if (creature === undefined) return false;
  let found = false;
  walkSteps(creature.pattern, [], (step) => {
    if ('if' in step && typeof step.if === 'object' && step.if !== null && 'hpBelow' in step.if && typeof step.if.hpBelow === 'number' && step.if.hpBelow <= 0.5) found = true;
  });
  return found;
}

function combatSnapshot(state: GameState, content: ContentPack, isLegal: (a: Action) => boolean): CombatSnapshot | null {
  const combat = state.combat;
  if (combat === null) return null;
  const standing = combat.enemies.filter((e) => e.alive && !e.fledOrGone);
  const intentShown = standing.some((e) => combat.intents[e.uid] !== undefined && !combat.intents[e.uid]!.hidden);
  let status: CombatSnapshot['status'] = null;
  for (const who of [...combat.party, ...standing]) {
    const first = who.statuses[0];
    const def = first === undefined ? undefined : content.statuses[first.statusId];
    if (first !== undefined && def !== undefined) {
      status = { id: first.statusId, name: def.name, description: def.description };
      break;
    }
  }
  const brute = standing.find((e) => changesPlansBelowHalf(content.creatures[e.refId]));
  return { round: combat.round, intentShown, guardEnabled: isLegal({ type: 'guard' }), status, conditional: brute?.name ?? null };
}

function fixedFightDone(state: GameState): boolean {
  return Object.values(state.world.locationStates).some((ls) => ls.encountersCleared.length > 0 || ls.scattered.length > 0);
}

/** The snapshot of the game as the screen shows it. `legal` is `store.getLegal()`. */
export function onboardingSnapshot(state: GameState, content: ContentPack, profile: Readonly<Profile>, legal: readonly Action[]): OnboardingSnapshot {
  const isLegal = legalSet(legal);
  return {
    mode: state.mode,
    loop: state.meta.loop,
    day: dayOf(state.clock.ticks),
    combat: state.mode === 'combat' ? combatSnapshot(state, content, isLegal) : null,
    atCamp: state.mode === 'explore' && isLegal({ type: 'rest', kind: 'full' }),
    firstFightDone: fixedFightDone(state),
    echoChoice: state.mode === 'dialogue' && (dialogueModel(state, content, profile, legal)?.choices.some((c) => c.tags.some((t) => t.id === 'echo')) ?? false),
  };
}
