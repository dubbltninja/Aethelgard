// U22: the `save` and `load` actions through `step` and `legalActions` (PLAN §4.6, §4.7, §4.12).
import { describe, expect, test } from 'bun:test';
import { isLegal, legalActions, serialize, step, type Action, type GameState, type SaveFile, type StepResult } from '@engine/index';
import { stateHash } from '@engine/util/hash';
import { deepFreeze } from '@engine/util/clone';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';
import { snapshot } from './snapshots';

const content = fixturePack();
const profile = freshProfile();
const AT = '2026-10-13T10:00:00Z';
const APEX = 'loc_temporal_breach_apex';

/** The reason of the single `actionRejected` event a step produced. */
const reasonOf = (out: StepResult): string => {
  const event = out.events[0];
  if (out.events.length !== 1 || event?.t !== 'actionRejected') throw new Error(`expected one rejection, got ${JSON.stringify(out.events)}`);
  return event.reason;
};
const saves = (s: GameState, p = profile) => legalActions(s, content, p).filter((a) => a.type === 'save');
const fileOf = (s: GameState, loopCounter = 1): SaveFile => JSON.parse(JSON.stringify(serialize(s, freshProfile({ loopCounter }), content, AT)));
const loadAction = (save: unknown): Action => ({ type: 'load', save });
const titleState = (): GameState => makeState({ mode: 'title' });

describe('save', () => {
  test('emits saveRequested and changes nothing else (the shell serializes the post-step state)', () => {
    const s = makeState();
    const out = play(s, [{ type: 'save', slot: 2 }]);
    expect(out.events).toEqual([{ t: 'saveRequested', slot: 2 }]);
    expect({ ...out.state, meta: { ...out.state.meta, stepCount: 0 } }).toEqual(s);
    expect(out.state.meta.stepCount).toBe(s.meta.stepCount + 1);
  });

  test('legal in explore and the Threshold for slots 1–3 (and auto where an autosave may be written)', () => {
    // legalActions sorts by type, then canonical JSON of the parameters
    expect(saves(makeState())).toEqual([
      { type: 'save', slot: 'auto' },
      { type: 'save', slot: 1 },
      { type: 'save', slot: 2 },
      { type: 'save', slot: 3 },
    ]);
    expect(saves(makeState({ mode: 'threshold' })).length).toBe(4);
  });

  test('not in the title, in dialogue (the Apex prompt included), combat or an ending', () => {
    for (const mode of ['title', 'dialogue', 'combat', 'ending'] as const) expect(saves(makeState({ mode }))).toEqual([]);
    const prompt = play(makeState({ locationId: 'loc_chronos_nexus', quests: { q_echo_crystal: { status: 'completed', stage: 'crystal_found' } } }), [
      { type: 'move', to: APEX },
    ]);
    expect(prompt.state.mode).toBe('dialogue');
    expect(saves(prompt.state)).toEqual([]);
    expect(isLegal(prompt.state, { type: 'save', slot: 1 }, content, profile)).toBe(false);
  });

  test('the autosave slot is refused at the Loop 1 Apex and during a Horde (D-067.1); manual slots are not', () => {
    for (const s of [makeState({ locationId: APEX }), makeState({ patch: (x) => void (x.world.hordeActive = true) })]) {
      expect(saves(s).map((a) => (a as { slot: unknown }).slot)).toEqual([1, 2, 3]);
      const out = step(s, { type: 'save', slot: 'auto' }, content, profile);
      expect(reasonOf(out)).toMatch(/autosave slot is not written here/);
      expect(play(s, [{ type: 'save', slot: 3 }]).events).toEqual([{ t: 'saveRequested', slot: 3 }]);
    }
  });

  test('a slot that does not exist is rejected, not emitted', () => {
    const out = step(makeState(), { type: 'save', slot: 4 } as unknown as Action, content, profile);
    expect(out.events[0]).toMatchObject({ t: 'actionRejected', reason: "'4' is not a save slot" });
  });
});

describe('load', () => {
  test('is never enumerated (the payload comes from the shell), and only the title may send it', () => {
    expect(legalActions(titleState(), content, profile).filter((a) => a.type === 'load')).toEqual([]);
    const file = fileOf(makeState());
    const out = step(makeState(), loadAction(file), content, profile);
    expect(out.events[0]).toMatchObject({ t: 'actionRejected', reason: "'load' is not available in explore mode" });
  });

  test('replaces the state wholesale: the loaded run equals the saved one, step counter included', () => {
    const { state: saved } = snapshot(10); // an explore-mode walk (since U23 some walks end in a fight, which is not resumable)
    const out = step(deepFreeze(titleState()), loadAction(fileOf(saved)), content, profile);
    expect(out.events.map((e) => e.t)).toEqual(['modeChanged', 'saveLoaded']);
    expect(out.events[0]).toEqual({ t: 'modeChanged', from: 'title', to: 'explore' });
    expect(out.events[1]).toEqual({ t: 'saveLoaded', version: 1, migratedFrom: null });
    expect(out.state).toEqual(saved);
    expect(stateHash(out.state)).toBe(stateHash(saved));
    expect(out.profile).toBe(profile);
  });

  test('resuming and continuing is the same as never having stopped', () => {
    const { state: saved } = snapshot(30);
    const next = legalActions(saved, content, profile).find((a) => a.type === 'move' || a.type === 'wait') as Action;
    const straight = play(saved, [next]).state;
    const resumed = play(play(titleState(), [loadAction(fileOf(saved))]).state, [next]).state;
    expect(stateHash(resumed)).toBe(stateHash(straight));
  });

  test('a Threshold save loads into the Threshold', () => {
    const saved = makeState({ mode: 'threshold', loop: 2 });
    const out = step(titleState(), loadAction(fileOf(saved, 2)), content, profile);
    expect(out.events[0]).toEqual({ t: 'modeChanged', from: 'title', to: 'threshold' });
    expect(out.state.mode).toBe('threshold');
  });

  test('a save from an older loop than the profile is allowed (PLAN §4.12)', () => {
    const out = step(titleState(), loadAction(fileOf(makeState(), 1)), content, freshProfile({ loopCounter: 4 }));
    expect(out.events.map((e) => e.t)).toEqual(['modeChanged', 'saveLoaded']);
  });

  test('warnings about dropped content come out as system log events; the state keeps no trace of them', () => {
    const file = fileOf(makeState());
    file.contentVersion = 'older';
    const out = step(titleState(), loadAction(file), content, profile);
    expect(out.events.at(-1)).toEqual({ t: 'log', text: `Save: saved with content older; this build has ${content.version}.`, kind: 'system' });
    expect(out.state.recentLog).toEqual(makeState().recentLog);
  });

  test('a bad file is rejected with the readable error and the state is left alone', () => {
    const title = titleState();
    const file = fileOf(makeState());
    delete (file.state.player as Partial<typeof file.state.player>).hp;
    const out = step(title, loadAction(file), content, profile);
    expect(out.state).toBe(title);
    expect(out.events).toEqual([
      { t: 'actionRejected', action: loadAction(file), reason: 'load: Save rejected: state.player.hp: is missing (expected number)' },
    ]);
    expect(reasonOf(step(title, loadAction('{ not json'), content, profile))).toMatch(/^load: Save file is not valid JSON/);
    expect(reasonOf(step(title, loadAction(undefined), content, profile))).toMatch(/not a JSON object/);
  });

  test('a save made in a mode that cannot be resumed (combat, dialogue) is refused', () => {
    for (const mode of ['combat', 'dialogue', 'ending', 'title'] as const) {
      const out = step(titleState(), loadAction(fileOf(makeState({ mode }))), content, profile);
      expect(out.events[0]).toMatchObject({ t: 'actionRejected', reason: `load: this save was made in ${mode} mode and cannot be resumed` });
    }
  });
});
