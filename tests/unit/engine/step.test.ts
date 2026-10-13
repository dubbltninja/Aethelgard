// U13: the step contract (PLAN §4.6, §8.1 "step contract"; D-041, D-043, D-065).
import { describe, expect, test } from 'bun:test';
import {
  ACTION_MODES,
  HANDLERS,
  MODE_TRANSITIONS,
  RECENT_LOG_CAP,
  RejectSignal,
  createStep,
  enterMode,
  makeCtx,
  newRun,
  step,
  type Action,
  type ActionType,
  type GameState,
  type HandlerTable,
  type Mode,
  type Profile,
} from '@engine/index';
import { clone, deepFreeze } from '@engine/util/clone';
import { stateHash } from '@engine/util/hash';
import { minimalProfile, minimalState } from './types/handmade';
import { sampleActions, standInPack } from './standInPack';

const content = standInPack();
const frozenInputs = () => ({ state: deepFreeze(minimalState()), profile: deepFreeze(minimalProfile()) });
const snapshot = (...values: unknown[]) => JSON.stringify(values);
const MODES: Mode[] = ['title', 'explore', 'combat', 'dialogue', 'threshold', 'ending'];

/** Stand-in reducers for the accept path: `wait` draws the rng, `toggleModifier` writes the profile. */
const testHandlers: HandlerTable = {
  ...HANDLERS,
  wait: (ctx) => {
    ctx.s.clock.ticks += 1 + ctx.rng.int(0, 2);
    ctx.log('You wait.', 'narration');
  },
  setStance: (ctx, action) => {
    ctx.s.player.stance = action.stance;
  },
  toggleModifier: (ctx, action) => {
    const mods = ctx.profileDraft().modifiers;
    mods[action.modifierId] = !mods[action.modifierId];
  },
  rest: (ctx) => {
    ctx.s.player.hp = 1; // mutate, then find it illegal: the draft must be discarded
    ctx.reject('too dangerous to rest');
  },
  gather: () => {
    throw new Error('corrupt state');
  },
};
const testStep = createStep(testHandlers);

describe('rejection (D-043)', () => {
  test('a stub handler rejects: same state/profile references, one actionRejected event naming the unit', () => {
    const { state, profile } = frozenInputs();
    const before = snapshot(state, profile);
    const action: Action = { type: 'move', to: 'loc_shattered_library' };
    const out = step(state, action, content, profile);
    expect(out.state).toBe(state);
    expect(out.profile).toBe(profile);
    expect(out.events).toEqual([{ t: 'actionRejected', action, reason: "'move' is not implemented yet (U20)" }]);
    expect(snapshot(state, profile)).toBe(before);
  });

  test('every Action type has a handler, and every one rejects for now (in a mode where it is allowed)', () => {
    const samples = sampleActions();
    expect(Object.keys(HANDLERS).sort()).toEqual(Object.keys(samples).sort());
    for (const type of Object.keys(samples) as ActionType[]) {
      const state = deepFreeze({ ...minimalState(), mode: ACTION_MODES[type][0]! });
      const profile = deepFreeze(minimalProfile());
      const out = step(state, samples[type], content, profile);
      expect(out.state).toBe(state);
      expect(out.profile).toBe(profile);
      expect(out.events).toHaveLength(1);
      expect(out.events[0]).toMatchObject({ t: 'actionRejected', action: samples[type] });
      expect((out.events[0] as { reason: string }).reason).toMatch(/not implemented yet \(U\d\d/);
    }
  });

  test('a wrong-mode action is rejected before dispatch, with the mode in the reason', () => {
    const { state, profile } = frozenInputs();
    const out = step(state, { type: 'attack', targetUid: 'c1' }, content, profile);
    expect(out.state).toBe(state);
    expect(out.events[0]).toMatchObject({ t: 'actionRejected', reason: "'attack' is not available in explore mode" });
  });

  test('malformed input never throws: unknown type, null, missing type', () => {
    const { state, profile } = frozenInputs();
    for (const bad of [{ type: 'fly' }, null, {}, { type: 42 }]) {
      const out = step(state, bad as unknown as Action, content, profile);
      expect(out.state).toBe(state);
      expect(out.profile).toBe(profile);
      expect(out.events[0]!.t).toBe('actionRejected');
      expect((out.events[0] as { reason: string }).reason).toMatch(/^unknown action type/);
    }
  });

  test('a reducer that mutates its draft and then rejects still returns the untouched inputs', () => {
    const { state, profile } = frozenInputs();
    const out = testStep(state, { type: 'rest', kind: 'short' }, content, profile);
    expect(out.state).toBe(state);
    expect(out.state.player.hp).toBe(40);
    expect(out.events).toEqual([{ t: 'actionRejected', action: { type: 'rest', kind: 'short' }, reason: 'too dangerous to rest' }]);
  });

  test('programmer errors (non-RejectSignal throws) surface', () => {
    const { state, profile } = frozenInputs();
    expect(() => testStep(state, { type: 'gather' }, content, profile)).toThrow('corrupt state');
  });

  test('RejectSignal carries its reason and is not an Error', () => {
    const signal = new RejectSignal('nope');
    expect(signal.reason).toBe('nope');
    expect(signal instanceof Error).toBe(false);
  });
});

describe('accept path (stand-in reducers)', () => {
  test('purity: deep-frozen inputs are unchanged; a new state is returned; stepCount +1', () => {
    const { state, profile } = frozenInputs();
    const before = snapshot(state, profile);
    const out = testStep(state, { type: 'setStance', stance: 'aggressive' }, content, profile);
    expect(snapshot(state, profile)).toBe(before);
    expect(out.state).not.toBe(state);
    expect(out.state.player.stance).toBe('aggressive');
    expect(out.state.meta.stepCount).toBe(state.meta.stepCount + 1);
    expect(out.events).toEqual([]);
  });

  test('lazy profile clone: the profile reference is unchanged when no reducer writes it', () => {
    const { state, profile } = frozenInputs();
    const out = testStep(state, { type: 'wait' }, content, profile);
    expect(out.profile).toBe(profile);
    expect(Object.isFrozen(profile)).toBe(true);
  });

  test('a profile write clones the profile; the caller’s profile is untouched', () => {
    const state = deepFreeze({ ...minimalState(), mode: 'threshold' as const });
    const profile = deepFreeze(minimalProfile());
    const out = testStep(state, { type: 'toggleModifier', modifierId: 'mod_glass' }, content, profile);
    expect(out.profile).not.toBe(profile);
    expect(out.profile.modifiers).toEqual({ mod_glass: true });
    expect(profile.modifiers).toEqual({});
  });

  test('__DEV__: outputs are deep-frozen; an unfrozen caller profile stays unfrozen when untouched', () => {
    const state = minimalState();
    const profile = minimalProfile();
    const out = testStep(state, { type: 'wait' }, content, profile);
    expect(Object.isFrozen(out.state)).toBe(true);
    expect(Object.isFrozen(out.state.clock)).toBe(true);
    expect(Object.isFrozen(out.events)).toBe(true);
    expect(Object.isFrozen(profile)).toBe(false);
    expect(Object.isFrozen(state)).toBe(false);
    const written = testStep({ ...minimalState(), mode: 'threshold' }, { type: 'toggleModifier', modifierId: 'mod_glass' }, content, profile);
    expect(Object.isFrozen(written.profile.modifiers)).toBe(true);
  });

  test('the rng advances only when drawn and only on accept', () => {
    const { state, profile } = frozenInputs();
    const untouched = testStep(state, { type: 'setStance', stance: 'support' }, content, profile);
    expect(untouched.state.rng).toEqual(state.rng);
    const drawn = testStep(state, { type: 'wait' }, content, profile);
    expect(drawn.state.rng).not.toEqual(state.rng);
    const refused = testStep(state, { type: 'rest', kind: 'full' }, content, profile);
    expect(refused.state.rng).toBe(state.rng);
    expect(refused.state.meta.stepCount).toBe(0);
  });

  test('log lines go to recentLog and events in order', () => {
    const { state, profile } = frozenInputs();
    const out = testStep(state, { type: 'wait' }, content, profile);
    expect(out.events).toEqual([{ t: 'log', text: 'You wait.', kind: 'narration' }]);
    expect(out.state.recentLog).toEqual([{ step: 0, text: 'You wait.', kind: 'narration' }]);
  });

  test('post-step hooks run in order after the handler, and only on accept', () => {
    const order: string[] = [];
    const hooked = createStep(testHandlers, [
      (ctx) => {
        order.push(`a:${ctx.s.player.stance}`);
      },
      (ctx) => {
        order.push('b');
        ctx.emit({ t: 'clockWarning', daysLeft: 5 });
      },
    ]);
    const { state, profile } = frozenInputs();
    const out = hooked(state, { type: 'setStance', stance: 'support' }, content, profile);
    expect(order).toEqual(['a:support', 'b']);
    expect(out.events).toEqual([{ t: 'clockWarning', daysLeft: 5 }]);
    hooked(state, { type: 'rest', kind: 'short' }, content, profile);
    expect(order).toEqual(['a:support', 'b']);
  });

  test('a hook may reject the whole action', () => {
    const strict = createStep(testHandlers, [(ctx) => ctx.reject('hook says no')]);
    const { state, profile } = frozenInputs();
    const out = strict(state, { type: 'wait' }, content, profile);
    expect(out.state).toBe(state);
    expect(out.events[0]).toMatchObject({ t: 'actionRejected', reason: 'hook says no' });
  });
});

describe('determinism', () => {
  const trace: Action[] = [
    { type: 'wait' },
    { type: 'setStance', stance: 'support' },
    { type: 'move', to: 'loc_shattered_library' },
    { type: 'wait' },
    { type: 'rest', kind: 'short' },
    { type: 'wait' },
  ];
  const run = (seed: string): { hash: string; events: unknown[] } => {
    let state: GameState = newRun(seed, 'ranger', content, minimalProfile());
    let profile: Profile = minimalProfile();
    const events: unknown[] = [];
    for (const action of trace) {
      const out = testStep(state, action, content, profile);
      state = out.state;
      profile = out.profile;
      events.push(...out.events);
    }
    return { hash: stateHash(state), events };
  };

  test('same seed + same actions → same stateHash and same events', () => {
    const a = run('seed-a');
    const b = run('seed-a');
    expect(a.hash).toBe(b.hash);
    expect(a.events).toEqual(b.events);
  });

  test('a different seed diverges (the rng is really consumed)', () => {
    expect(run('seed-a').hash).not.toBe(run('seed-b').hash);
  });

  test('the real step is deterministic too (all rejects leave the state hash unchanged)', () => {
    const state = newRun('seed-a', 'wizard', content, minimalProfile());
    const hash = stateHash(state);
    let s = state;
    for (const action of trace) s = step(s, action, content, minimalProfile()).state;
    expect(stateHash(s)).toBe(hash);
  });
});

describe('ctx', () => {
  test('uid() draws from meta.nextUid; log() caps recentLog', () => {
    const draft = clone(minimalState());
    const ctx = makeCtx(draft, minimalProfile(), content);
    expect(ctx.uid('i')).toBe('i1');
    expect(ctx.uid('c')).toBe('c2');
    expect(draft.meta.nextUid).toBe(3);
    for (let i = 0; i < RECENT_LOG_CAP + 5; i++) ctx.log(`line ${i}`);
    expect(draft.recentLog).toHaveLength(RECENT_LOG_CAP);
    expect(draft.recentLog[0]!.text).toBe('line 5');
    expect(ctx.events).toHaveLength(RECENT_LOG_CAP + 5);
  });

  test('profile reads the original until profileDraft() is called, then the draft', () => {
    const original = deepFreeze(minimalProfile());
    const ctx = makeCtx(clone(minimalState()), original, content);
    expect(ctx.profile).toBe(original);
    const draft = ctx.profileDraft();
    expect(ctx.profileDraft()).toBe(draft);
    expect(ctx.profile).toBe(draft);
    draft.resonance = 7;
    expect(ctx.commit()).toEqual({ profile: draft, profileCloned: true });
    expect(original.resonance).toBe(0);
  });

  test('reject() throws a RejectSignal', () => {
    const ctx = makeCtx(clone(minimalState()), minimalProfile(), content);
    expect(() => ctx.reject('why')).toThrow();
    try {
      ctx.reject('why');
    } catch (e) {
      expect(e).toBeInstanceOf(RejectSignal);
    }
  });
});

describe('enterMode', () => {
  test('a listed transition sets the mode and emits modeChanged; same mode is a no-op', () => {
    const ctx = makeCtx(clone(minimalState()), minimalProfile(), content);
    enterMode(ctx, 'explore');
    expect(ctx.events).toEqual([]);
    enterMode(ctx, 'combat');
    enterMode(ctx, 'dialogue');
    enterMode(ctx, 'combat');
    expect(ctx.s.mode).toBe('combat');
    expect(ctx.events).toEqual([
      { t: 'modeChanged', from: 'explore', to: 'combat' },
      { t: 'modeChanged', from: 'combat', to: 'dialogue' },
      { t: 'modeChanged', from: 'dialogue', to: 'combat' },
    ]);
  });

  test('an unlisted transition is a programmer error', () => {
    const ctx = makeCtx(clone({ ...minimalState(), mode: 'combat' }), minimalProfile(), content);
    expect(() => enterMode(ctx, 'threshold')).toThrow('illegal transition combat → threshold');
  });

  test('PLAN §4.6 rule 4 edges are all present', () => {
    const edges: [Mode, Mode][] = [
      ['title', 'explore'], ['explore', 'combat'], ['combat', 'explore'], ['explore', 'dialogue'], ['dialogue', 'explore'],
      ['combat', 'dialogue'], ['explore', 'ending'], ['combat', 'ending'], ['ending', 'threshold'], ['ending', 'explore'],
      ['ending', 'title'], ['threshold', 'explore'], ['threshold', 'dialogue'], ['dialogue', 'threshold'],
    ];
    for (const [from, to] of edges) expect(MODE_TRANSITIONS[from]).toContain(to);
    for (const mode of MODES) expect(MODE_TRANSITIONS[mode]).not.toContain(mode);
  });
});
