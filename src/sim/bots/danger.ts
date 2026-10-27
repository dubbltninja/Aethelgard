// U81b1 (D-145, D-066's "flees encounters ≥ level + 4"): bots respect danger. U80's batch had the explorer and melee bots
// walking into fights far above them (Vell's Umbra, L16, met at a median L5: 540 fights, 1 % wins; three Moment Moths at L2)
// and dying there over and over through the FALLEN reloads. A player sees the threat (the map's level band, the creature's
// level once met) and comes back later. So:
//   - in a fight: flee one whose strongest foe is ≥ level + DANGER_MARGIN (when it can be fled), and one where the player
//     already fell at this level (`fellHere` in policy.ts: a reload stands next to it);
//   - on the map: a place whose pending fight (an authored encounter that would start now: `pendingFights`) is that far above
//     the player is not a place to go to (`visit`) until the player has grown into it; it is passed through only when that
//     fight can be fled (`pass`: a flight scatters or regroups the group, D-143/D-144, so the road opens behind it) — an
//     unfleeable one (Vell's Umbra, the Stormcrown, the Ashmaw) is not walked into at all.
// A Horde lifts it (no fights start in one); a conversation the bot means to hold (the Loop 2+ Tyrant) is not a danger.
import type { ContentPack, GameState, Profile } from '@engine/index';
import { pendingFights } from './shared';

/** Levels above the player at which a fight is fled, and a place is left for later. */
export const DANGER_MARGIN = 4;

/**
 * Is there a fight at `locationId` the player should not walk into yet? `visit` (a destination): any such fight; `pass` (on
 * the way somewhere else): only one that cannot be fled.
 */
export function dangerAt(s: GameState, content: ContentPack, profile: Profile, locationId: string, mode: 'visit' | 'pass' = 'visit', margin: number = DANGER_MARGIN): boolean {
  if (s.world.hordeActive || locationId === s.world.currentLocationId) return false;
  return pendingFights(s, content, profile, locationId).some((f) => !f.communion && f.level >= s.player.level + margin && (mode === 'visit' || !f.fleeable));
}

/**
 * U82 (D-149 #1): levels the player must gain over the level it fell at before it walks back into that place or fight. U81b1
 * waited for one level: 181 of 2,969 defeats were the same fight replayed one level up (the caster at the Pass's Moths).
 */
export const FALLEN_LEVELS = 2;

/** Did the player fall at `id` too recently to go back (less than FALLEN_LEVELS levels ago)? */
export const fellRecently = (fellAt: Readonly<Record<string, number>>, id: string, level: number): boolean => {
  const at = fellAt[id];
  return at !== undefined && level < at + FALLEN_LEVELS;
};
