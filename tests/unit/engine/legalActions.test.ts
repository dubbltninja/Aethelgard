// U13: the legalActions skeleton (PLAN §4.7, §8.1). Structure is exhaustive by Action type; every enumerator is
// empty until its reducer lands, and legalActions/isLegal agree with step on the whole sample corpus.
import { describe, expect, test } from 'bun:test';
import {
  ACTION_MODES,
  ENUMERATORS,
  HANDLERS,
  enumerateLegal,
  isActionType,
  isLegal,
  isLegalIn,
  legalActions,
  step,
  type Action,
  type ActionType,
  type EnumeratorTable,
  type Mode,
} from '@engine/index';
import { deepFreeze } from '@engine/util/clone';
import { minimalProfile, minimalState } from './types/handmade';
import { fixturePack } from '@tests/fixtures/miniContent';
import { sampleActions } from './standInPack';

const content = fixturePack();
const MODES: Mode[] = ['title', 'explore', 'combat', 'dialogue', 'threshold', 'ending'];
const stateIn = (mode: Mode) => deepFreeze({ ...minimalState(), mode });

describe('structure', () => {
  test('ACTION_MODES, ENUMERATORS and HANDLERS cover exactly the same Action types', () => {
    const types = Object.keys(sampleActions()).sort();
    expect(Object.keys(ACTION_MODES).sort()).toEqual(types);
    expect(Object.keys(ENUMERATORS).sort()).toEqual(types);
    expect(Object.keys(HANDLERS).sort()).toEqual(types);
    for (const type of types as ActionType[]) expect(ACTION_MODES[type].length).toBeGreaterThan(0);
  });

  test('PLAN §4.7 shell rows', () => {
    expect([...ACTION_MODES.save].sort()).toEqual(['explore', 'threshold']);
    expect(ACTION_MODES.load).toEqual(['title']);
    expect(ACTION_MODES.newGame).toEqual(['title']);
    expect([...ACTION_MODES.returnToTitle].sort()).toEqual(['ending', 'explore', 'threshold']);
  });

  test('isActionType accepts exactly the Action types', () => {
    expect(isActionType('move')).toBe(true);
    expect(isActionType('fly')).toBe(false);
    expect(isActionType('toString')).toBe(false);
    expect(isActionType(3)).toBe(false);
  });
});

describe('skeleton agreement with step', () => {
  test('deterministic, mode-gated, examine only on request', () => {
    for (const mode of MODES) {
      const listed = legalActions(stateIn(mode), content, minimalProfile());
      expect(legalActions(stateIn(mode), content, minimalProfile())).toEqual(listed);
      for (const action of listed) expect(ACTION_MODES[action.type]).toContain(mode);
      expect(listed.some((a) => a.type === 'examine')).toBe(false);
    }
  });

  test('every sample action in every mode: isLegal ⇔ step accepts; a rejection leaves the state as it was', () => {
    const profile = deepFreeze(minimalProfile());
    for (const mode of MODES) {
      const state = stateIn(mode);
      for (const action of Object.values(sampleActions()) as Action[]) {
        const out = step(state, action, content, profile);
        const accepted = out.events[0]?.t !== 'actionRejected';
        expect({ action, mode, legal: isLegal(state, action, content, profile) }).toEqual({ action, mode, legal: accepted });
        if (!accepted) expect(out.state).toBe(state);
      }
    }
  });

  test('isLegal is false for an unknown action type', () => {
    expect(isLegal(stateIn('explore'), { type: 'fly' } as unknown as Action, content, minimalProfile())).toBe(false);
  });
});

describe('enumeration over a stand-in table', () => {
  const table: EnumeratorTable = {
    ...ENUMERATORS,
    move: () => [
      { type: 'move', to: 'loc_whispering_ruins' },
      { type: 'move', to: 'loc_heartstone_depths' },
    ],
    wait: () => [{ type: 'wait' }],
    examine: () => [{ type: 'examine', target: { kind: 'location' } }],
    rest: () => [
      { type: 'rest', kind: 'short' },
      { type: 'rest', kind: 'full' },
    ],
    attack: () => [{ type: 'attack', targetUid: 'c9' }],
  };

  test('only mode-allowed types; sorted by type then parameters; examine only on request', () => {
    const state = stateIn('explore');
    expect(enumerateLegal(table, state, content, minimalProfile())).toEqual([
      { type: 'move', to: 'loc_heartstone_depths' },
      { type: 'move', to: 'loc_whispering_ruins' },
      { type: 'rest', kind: 'full' },
      { type: 'rest', kind: 'short' },
      { type: 'wait' },
    ]);
    const withExamine = enumerateLegal(table, state, content, minimalProfile(), { includeExamine: true });
    expect(withExamine[0]).toEqual({ type: 'examine', target: { kind: 'location' } });
    expect(enumerateLegal(table, stateIn('combat'), content, minimalProfile())).toEqual([{ type: 'attack', targetUid: 'c9' }]);
  });

  test('isLegalIn ≡ membership (key order of the action object does not matter)', () => {
    const state = stateIn('explore');
    const listed = enumerateLegal(table, state, content, minimalProfile(), { includeExamine: true });
    for (const action of listed) expect(isLegalIn(table, state, action, content, minimalProfile())).toBe(true);
    expect(isLegalIn(table, state, { to: 'loc_whispering_ruins', type: 'move' } as Action, content, minimalProfile())).toBe(true);
    expect(isLegalIn(table, state, { type: 'move', to: 'loc_nowhere' }, content, minimalProfile())).toBe(false);
    expect(isLegalIn(table, state, { type: 'attack', targetUid: 'c9' }, content, minimalProfile())).toBe(false);
  });
});
