// U22: canAutosave (DESIGN §14.2, D-067.1): never in combat, never at the Loop 1 Apex or during a Horde.
import { describe, expect, test } from 'bun:test';
import { canAutosave, makeCtx, type GameState, type Mode } from '@engine/index';
import { clone } from '@engine/util/clone';
import { autosave } from '@engine/reducers/explore';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';
import { fullState } from '../types/handmade';

const content = fixturePack();
const APEX = 'loc_temporal_breach_apex';

describe('canAutosave', () => {
  test('ordinary exploring and the Threshold may autosave', () => {
    expect(canAutosave(makeState())).toBe(true);
    expect(canAutosave(makeState({ locationId: 'loc_silverwood_plaza', day: 9, watch: 3 }))).toBe(true);
    expect(canAutosave(makeState({ mode: 'threshold' }))).toBe(true);
  });

  test('not in combat, dialogue, the title or an ending', () => {
    const modes: Mode[] = ['title', 'combat', 'dialogue', 'ending'];
    for (const mode of modes) expect({ mode, ok: canAutosave(makeState({ mode })) }).toEqual({ mode, ok: false });
    const mid = fullState();
    expect(mid.combat).not.toBeNull();
    mid.mode = 'explore'; // a state that is somehow in explore with a fight attached still refuses
    expect(canAutosave(mid)).toBe(false);
    const talking = makeState({ patch: (s) => void (s.dialogue = fullState().dialogue) });
    expect(talking.dialogue).not.toBeNull();
    expect(canAutosave(talking)).toBe(false);
  });

  test('not at the Loop 1 Apex (the Face it / Not yet prompt), but the Apex in Loop 2+ is an ordinary node', () => {
    expect(canAutosave(makeState({ locationId: APEX }))).toBe(false);
    expect(canAutosave(makeState({ locationId: APEX, loop: 2 }))).toBe(true);
    expect(canAutosave(makeState({ locationId: 'loc_chronos_nexus' }))).toBe(true); // the node before it
  });

  test('not while a Horde is active, in any loop or place', () => {
    const horde = (loop: number, locationId?: string) =>
      makeState({ loop, ...(locationId ? { locationId } : {}), patch: (s) => void (s.world.hordeActive = true) });
    expect(canAutosave(horde(1))).toBe(false);
    expect(canAutosave(horde(2, 'loc_shattered_library'))).toBe(false);
    expect(canAutosave(horde(3, APEX))).toBe(false);
  });

  test('agrees with the checkpoint suppression in explore.autosave over every explore-mode case', () => {
    const cases: GameState[] = [
      makeState(),
      makeState({ locationId: APEX }),
      makeState({ locationId: APEX, loop: 2 }),
      makeState({ patch: (s) => void (s.world.hordeActive = true) }),
      makeState({ loop: 2, locationId: APEX, patch: (s) => void (s.world.hordeActive = true) }),
    ];
    for (const state of cases) {
      const ctx = makeCtx(clone(state), freshProfile(), content);
      autosave(ctx, 'locationEntered');
      expect({ at: state.world.currentLocationId, loop: state.meta.loop, horde: state.world.hordeActive, emitted: ctx.events.length === 1 }).toEqual({
        at: state.world.currentLocationId,
        loop: state.meta.loop,
        horde: state.world.hordeActive,
        emitted: canAutosave(state),
      });
    }
  });
});
