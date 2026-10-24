// Shared set-up for the U68 tests: the real pack and four states, built once from scenarios and handed out as copies —
// the Threshold after Loop 2's *Let go* (`loop2_end`, Resonance 100), the ending screens of a closer (Loop 2's Let go, stopped on
// its first slide) and of a true ending (`ending_a_ready` plus its last answer), and a live loop for the Timeline.
import { legalActions, step, type Action, type GameState, type Profile, type ThresholdArea } from '@engine/index';
import { loadScenario } from '@sim/scenarios';
import { pack } from './panelFixtures';

export { pack };

export interface At {
  state: GameState;
  profile: Profile;
}

const cache = new Map<string, At>();

function scenario(id: 'loop2_end' | 'loop2_day1' | 'ending_a_ready'): At {
  let built = cache.get(id);
  if (built === undefined) {
    built = loadScenario(id, pack);
    cache.set(id, built);
  }
  return { state: structuredClone(built.state), profile: structuredClone(built.profile) };
}

/** An editable copy (the engine hands back frozen states). */
export const mutable = (at: At): At => structuredClone(at);

/** One accepted step (a rejection is a test failure). */
export function act(at: At, action: Action): At {
  const out = step(at.state, action, pack, at.profile);
  const rejected = out.events.find((e) => e.t === 'actionRejected');
  if (rejected?.t === 'actionRejected') throw new Error(`${JSON.stringify(action)} was rejected: ${rejected.reason}`);
  return { state: out.state, profile: out.profile };
}

/** The Threshold after Loop 2, on the Still Shore. */
export const thresholdAt = (): At => scenario('loop2_end');

export function goTo(at: At, area: ThresholdArea): At {
  return act(at, { type: 'thresholdGo', to: area });
}

/** A closer's ending screen (Loop 2's *Let go*), on its first slide. */
export const closerEndingAt = (): At => act(scenario('loop2_day1'), { type: 'letGo' });

/** Ending A's screen (else the first ending the last answers reach), on its first slide: the communion's last answer given. */
export function trueEndingAt(): At {
  const at = scenario('ending_a_ready');
  let any: At | null = null;
  for (const action of legalActions(at.state, pack, at.profile)) {
    if (action.type !== 'commune' || action.act !== 'speak') continue;
    const out = step(at.state, action, pack, at.profile);
    if (out.state.mode !== 'ending') continue;
    const reached = { state: out.state, profile: out.profile };
    if (out.state.pendingEnding?.outcome === 'ending_wardens_vigil') return reached;
    any ??= reached;
  }
  if (any === null) throw new Error('no answer ended the game');
  return any;
}

/** A loop under way (Loop 2 Day 1), for the Timeline's "in progress" row. */
export const liveAt = (): At => scenario('loop2_day1');

export { legalFor } from './panelFixtures';
