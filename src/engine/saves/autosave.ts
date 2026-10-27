// When may the game write the autosave slot? (DESIGN §14.2, D-067.1, PLAN §4.12.) Pure; the shell calls it after the
// step that emitted an `autosaveCheckpoint` (and only when `profile.settings.autosave` is on).
import { APEX_LOCATION_ID } from '../reducers/explore';
import type { GameState } from '../types/state';

/**
 * False in combat (a reload resumes at the pre-combat node), in the title and ending screens (no run to resume),
 * while a Horde is active, and at the Loop 1 Apex (the *Face it / Not yet* prompt) — so a reload can never land
 * inside the Apex prompt or a Horde. Explore and the Threshold are the modes a save resumes into; a checkpoint
 * reached inside a dialogue overlay waits for the next one. Mirrors the suppression in `explore.autosave`.
 */
export function canAutosave(state: GameState): boolean {
  if (state.mode !== 'explore' && state.mode !== 'threshold') return false;
  if (state.combat !== null || state.dialogue !== null) return false;
  if (state.world.hordeActive) return false;
  if (state.meta.loop === 1 && state.world.currentLocationId === APEX_LOCATION_ID) return false;
  return true;
}
