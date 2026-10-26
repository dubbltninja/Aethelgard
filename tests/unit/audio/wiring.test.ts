// U74: the UI's audio wiring (src/ui/hooks/useAudio.ts) — one shared engine, the stage side a combatant is on, and the
// gestures that start sound. The live hook is exercised end to end in tests/e2e/audio.spec.ts.
import { describe, expect, test } from 'bun:test';
import type { GameState } from '@engine/index';
import { GESTURES, sharedAudio, sideOf } from '@ui/hooks/useAudio';

describe('useAudio helpers', () => {
  test('one engine per page, silent where there is no Web Audio', async () => {
    expect(sharedAudio()).toBe(sharedAudio());
    expect(await sharedAudio().unlock()).toBe(false);
    expect(sharedAudio().play('sfx_coin')).toBe(false);
  });

  test('the party sounds left, foes right, anyone else (or no fight) centre', () => {
    const state = { combat: { party: [{ uid: 'c1' }], enemies: [{ uid: 'c2' }] } } as unknown as GameState;
    const side = sideOf(state);
    expect(side('c1')).toBeLessThan(0);
    expect(side('c2')).toBeGreaterThan(0);
    expect(side('c9')).toBe(0);
    expect(sideOf({ combat: null } as unknown as GameState)('c1')).toBe(0);
  });

  test('pointer, touch and key presses all count as the starting gesture', () => {
    expect([...GESTURES]).toEqual(['pointerdown', 'pointerup', 'keydown', 'touchend']);
  });
});
