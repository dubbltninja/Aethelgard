// U34e item 4 (D-101): the Loop 1 closer of the scenario builders on the real pack. A Level 1 Wayfinder walking to the
// Library portal in the expiry Horde meets the Corridor's pair and falls; The Fall (reason `expiry`) is a Loop 1 closer
// too, so the builders reach Loop 2 Day 1 instead of failing with "cannot walk in ending mode".
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { loadScenario } from '@sim/scenarios';

const content = buildContentPack();

describe('playLoop1Out on the real pack', () => {
  test('loop2_day1: a Fall on the way to the portal still leads to Loop 2 Day 1 (seed sim:0, Ranger)', () => {
    const { state, profile } = loadScenario('loop2_day1', content, { classId: 'ranger', seed: 'sim:0' });
    expect(state.mode).toBe('explore');
    expect(state.meta.loop).toBe(2);
    expect(state.clock.ticks).toBe(0);
    expect(state.world.hordeActive).toBe(false);
    expect(state.world.currentLocationId).toBe(content.config.startLocationId);
    expect(profile.runHistory[0]).toMatchObject({ loop: 1, outcome: 'closer_fall', reason: 'expiry' });
  });

  test('loop2_end: the Threshold after Let go, from the same Loop 1 Fall', () => {
    const { state, profile } = loadScenario('loop2_end', content, { classId: 'ranger', seed: 'sim:0' });
    expect(state.mode).toBe('threshold');
    expect(state.pendingEnding).toMatchObject({ outcome: 'closer_fall', reason: 'released' });
    expect(profile.runHistory.map((r) => r.outcome)).toEqual(['closer_fall', 'closer_fall']);
  });
});
