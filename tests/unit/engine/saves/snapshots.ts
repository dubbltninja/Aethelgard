// Sim snapshots for the save tests: states produced by `play` over random legal actions (PLAN §8.1 saves row).
// Deterministic: snapshot i always yields the same state (its own seeded Rng picks the actions).
import { Rng, legalActions, seedFromString, type Action, type GameState, type Profile } from '@engine/index';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';

const CLASSES = ['ranger', 'wizard'] as const;
/** Shell actions are not gameplay; leave them out of the walk. */
const SHELL = new Set<Action['type']>(['save', 'load', 'newGame', 'chooseClass', 'returnToTitle']);

export interface Snapshot {
  state: GameState;
  profile: Profile;
  /** Actions accepted on the way. */
  steps: number;
}

export function snapshot(i: number): Snapshot {
  const content = fixturePack();
  const rng = new Rng(seedFromString(`save-snapshot:${i}`));
  const loop = i % 5 === 4 ? 2 : 1;
  let profile = freshProfile({ loopCounter: loop });
  // every fourth walk starts beside the Apex with its gate open, so some end at the Face it / Not yet prompt
  const nearApex = i % 4 === 3;
  let state = makeState(
    {
      seed: `snap-${i}`,
      classId: CLASSES[i % CLASSES.length],
      loop,
      level: 1 + (i % 7),
      ...(nearApex ? { locationId: 'loc_chronos_nexus', quests: { q_echo_crystal: { status: 'completed' as const, stage: 'crystal_found' } } } : {}),
    },
    { profile },
  );
  // every eighth walk is just the step onto the Apex: a state parked at the Face it / Not yet prompt (dialogue mode)
  let steps = 0;
  if (i % 8 === 3) {
    const out = play(state, [{ type: 'move', to: 'loc_temporal_breach_apex' }], { profile, content });
    return { state: out.state, profile: out.profile, steps: 1 };
  }
  const length = rng.int(0, 60);
  for (; steps < length; steps++) {
    const options = legalActions(state, content, profile, { includeExamine: true }).filter((a) => !SHELL.has(a.type));
    if (options.length === 0) break;
    const out = play(state, [options[rng.int(0, options.length - 1)] as Action], { profile, content });
    state = out.state;
    profile = out.profile;
  }
  return { state, profile, steps };
}
