// U38: `pathBot` and the ending scripts (PLAN §7.8). Every step kind runs through the runner on a fixture pack; the ones that
// need a mode the runner would not leave a bot in (a stray dialogue, the Threshold) are driven with `choose` directly on
// states from `loadScenario`. The fixture `EndingScript`s (tests/fixtures/scripts/endings.ts) are proved on all nine packs.
import { describe, expect, test } from 'bun:test';
import { APEX_LOCATION_ID, legalActions, type Action, type ContentPack, type GameState, type Profile } from '@engine/index';
import { casterBot } from '@sim/bots/caster';
import { pathBot } from '@sim/bots/pathBot';
import type { Bot, BotMemory } from '@sim/bots/types';
import { runLoop, type RunConfig, type RunResult } from '@sim/runner';
import { loadScenario, type ScenarioId } from '@sim/scenarios';
import { isCloser, runEndingScript } from '@sim/scripts/run';
import type { ScriptStep } from '@sim/scripts/types';
import { FIXTURE_ENDING_SCRIPTS, FIXTURE_PACK_FACTORIES, type FixturePackName } from '@tests/fixtures/scripts/endings';
import { fixturePack } from '@tests/fixtures/miniContent';
import { hordePack } from '@tests/fixtures/hordeContent';
import { thresholdPack } from '@tests/fixtures/thresholdContent';

const LIBRARY = 'loc_shattered_library';
const GLOWLANDS = 'loc_veridian_glowlands';
const RUINS = 'loc_whispering_ruins';
const content = fixturePack();

/** A scripted run from Loop 1, Day 1 of the fixture pack (or another start). */
function run(script: ScriptStep[], over: Partial<RunConfig> = {}, pack: ContentPack = content, scenario: ScenarioId | undefined = 'loop1_day1'): RunResult {
  return runLoop(
    { seed: 'path:1', classId: 'ranger', bot: pathBot(script), stopAt: 'ending', onFallen: 'stop', ...(scenario === undefined ? {} : { scenario }), ...over },
    pack,
  );
}

const ctxOf = (profile: Profile) => ({ profile, rngSeed: 'path', step: 0, recentEvents: [] });

/** One `choose` of a fresh pathBot on a scenario's state (and its memory, for the halt). */
function chooseOn(script: ScriptStep[], id: ScenarioId, pack: ContentPack): { action: Action; legal: Action[]; bot: Bot; memory: BotMemory; state: GameState } {
  const { state, profile } = loadScenario(id, pack);
  const bot = pathBot(script);
  const memory = bot.init?.('path') ?? {};
  const legal = legalActions(state, pack, profile);
  return { action: bot.choose(state, legal, pack, memory, ctxOf(profile)), legal, bot, memory, state };
}

describe('pathBot: how a script ends', () => {
  test('an empty script is done at once; the action it drops is never played', () => {
    const r = run([]);
    expect(r.stopReason).toBe('script_done');
    expect(r.steps).toBeLessThan(5);
    expect(r.errors).toEqual([]);
  });

  test('a script that runs out stops the run with script_done, and the bot stays halted', () => {
    const { bot, memory, legal, state } = chooseOn([], 'loop1_day1', content);
    expect(bot.halt?.(memory)).toEqual({ reason: 'script_done' });
    expect(legal.map((a) => JSON.stringify(a))).toContain(JSON.stringify(chooseOn([], 'loop1_day1', content).action));
    // asked again, it keeps answering with a listed action and the same halt
    const again = bot.choose(state, legal, content, memory, ctxOf(loadScenario('loop1_day1', content).profile));
    expect(legal.map((a) => JSON.stringify(a))).toContain(JSON.stringify(again));
    expect(bot.halt?.(memory)).toEqual({ reason: 'script_done' });
  });

  test('an exact action is played when listed; the script then ends', () => {
    const r = run([{ type: 'rest', kind: 'short' }, { type: 'wait' }]);
    expect(r.stopReason).toBe('script_done');
    expect(r.trace).toBeUndefined();
    const traced = run([{ type: 'rest', kind: 'short' }, { type: 'wait' }], { record: true });
    expect((traced.trace ?? []).slice(-2)).toEqual([{ type: 'rest', kind: 'short' }, { type: 'wait' }]);
  });

  test('an exact action that is not listed ends the run with script_assert and names the step', () => {
    const r = run([{ type: 'wait' }, { type: 'move', to: 'loc_nowhere' }]);
    expect(r.stopReason).toBe('script_assert');
    expect(r.stopMessage).toContain('step 1');
    expect(r.stopMessage).toContain('loc_nowhere');
    expect(r.stopMessage).toContain("mode 'explore'");
    expect(r.errors).toEqual([]);
  });

  test('assert: a true condition passes; a false one ends the run with the author’s message, verbatim', () => {
    expect(run([{ assert: { location: RUINS }, message: 'at the ruins' }]).stopReason).toBe('script_done');
    const r = run([{ assert: { location: LIBRARY }, message: 'we should be at the library' }]);
    expect(r.stopReason).toBe('script_assert');
    expect(r.stopMessage).toBe('we should be at the library');
  });
});

describe('pathBot: goto', () => {
  test('walks to the place, fighting what stands in the way with melee', () => {
    const r = run([{ goto: LIBRARY }, { assert: { location: LIBRARY }, message: 'arrived' }]);
    expect(r.stopReason).toBe('script_done');
    expect(r.locationsVisited).toContain(LIBRARY);
    expect(r.fights.length).toBeGreaterThan(0);
  });

  test('a place it already stands at is a no-op', () => {
    expect(run([{ goto: RUINS }, { assert: { location: RUINS }, message: 'still here' }]).stopReason).toBe('script_done');
  });

  test('the fight policy is set by a fight step: flee runs from the library fight', () => {
    const r = run([{ fight: 'flee' }, { goto: LIBRARY }]);
    expect(r.stopReason).toBe('script_done');
    expect(r.fights.map((f) => f.result)).toContain('fled');
  });

  test('flee falls back to melee where the fight cannot be fled', () => {
    // the Tyrant's fight cannot be fled; the policy plays on with melee
    const { state, profile } = loadScenario('communion_movement_2', hordePack());
    const pack = hordePack();
    const bot = pathBot([{ fight: 'flee' }]);
    const memory = bot.init?.('x') ?? {};
    const legal = legalActions(state, pack, profile);
    expect(legal.some((a) => a.type === 'flee')).toBe(false);
    const a = bot.choose(state, legal, pack, memory, ctxOf(profile));
    expect(legal.map((x) => JSON.stringify(x))).toContain(JSON.stringify(a));
  });

  test('the caster policy plays the fight with the caster rows', () => {
    const r = run([{ fight: 'caster' }, { goto: LIBRARY }], { classId: 'wizard' });
    expect(r.stopReason).toBe('script_done');
    expect(r.fights.length).toBeGreaterThan(0);
    expect(r.fights.every((f) => f.result === 'victory')).toBe(true);
  });

  test('a fight step with no fight on screen only sets the policy; with one on screen it plays it out', () => {
    const quiet = run([{ fight: 'melee' }, { assert: { location: RUINS }, message: 'nothing happened' }]);
    expect(quiet.stopReason).toBe('script_done');
    const { state } = loadScenario('first_fight', content);
    expect(state.mode).toBe('combat');
    const r = run([{ fight: 'melee' }, { assert: { level: { min: 1 } }, message: 'out of the fight' }], {}, content, 'first_fight');
    expect(r.stopReason).toBe('script_done');
    expect(r.final.mode).toBe('explore');
  });

  test('maxSteps bounds the walk; an unknown place has no route', () => {
    const slow = run([{ goto: GLOWLANDS, maxSteps: 1 }]);
    expect(slow.stopReason).toBe('script_assert');
    expect(slow.stopMessage).toContain(`goto ${GLOWLANDS}: not reached within 1 steps`);
    const lost = run([{ goto: 'loc_nowhere' }]);
    expect(lost.stopReason).toBe('script_assert');
    expect(lost.stopMessage).toContain('no open route');
  });

  test('a stray dialogue is walked through (Continue, else the first choice); a mode with no way on fails', () => {
    const stray = chooseOn([{ goto: RUINS }], 'pre_tyrant_l13_ranger', hordePack());
    expect(stray.state.mode).toBe('dialogue');
    expect(stray.action).toEqual({ type: 'choose', choiceId: 'face_it' });
    const stuck = chooseOn([{ goto: LIBRARY }], 'loop2_end', thresholdPack());
    expect(stuck.bot.halt?.(stuck.memory)).toEqual({ reason: 'script_assert', message: "step 0: goto loc_shattered_library: cannot go on in mode 'threshold'" });
  });
});

describe('pathBot: talk', () => {
  test('talks to an NPC and takes the picks in order', () => {
    const r = run([{ talk: 'npc_ilyra', pick: ['yes'] }, { assert: { location: RUINS }, message: 'back in explore mode' }], { record: true });
    expect(r.stopReason).toBe('script_done');
    expect((r.trace ?? []).map((a) => a.type).slice(-2)).toEqual(['talk', 'choose']);
  });

  test('*Continue* is taken where no pick is wanted', () => {
    const { state, profile } = loadScenario('pre_tyrant_l13_ranger', hordePack());
    const bot = pathBot([{ talk: 'npc_ilyra', pick: [] }]);
    const memory: BotMemory = {}; // no init: the script's state is made on first use
    const a = bot.choose(state, [{ type: 'continue' }], hordePack(), memory, ctxOf(profile));
    expect(a).toEqual({ type: 'continue' });
    expect(bot.halt?.(memory)).toBeNull();
  });

  test('a choice with no pick left, a pick that is not offered, and picks left over fail with the offer in the message', () => {
    const none = run([{ talk: 'npc_ilyra', pick: [] }]);
    expect(none.stopReason).toBe('script_assert');
    expect(none.stopMessage).toContain('talk npc_ilyra: every pick is used and the dialogue offers [');
    const bad = run([{ talk: 'npc_ilyra', pick: ['maybe'] }]);
    expect(bad.stopMessage).toContain("'maybe' is not offered and the dialogue offers [");
    const extra = run([{ talk: 'npc_ilyra', pick: ['yes', 'yes', 'yes'] }]);
    expect(extra.stopMessage).toContain('the dialogue ended with picks left: [yes, yes]');
  });

  test('an NPC who is not here, and a talk where none can be had', () => {
    const away = run([{ talk: 'npc_nobody', pick: [] }]);
    expect(away.stopMessage).toContain('npc_nobody: they are not here (loc_whispering_ruins)');
    const shut = chooseOn([{ talk: 'npc_ilyra', pick: [] }], 'loop2_end', thresholdPack());
    expect(shut.bot.halt?.(shut.memory)?.message).toContain("cannot talk in mode 'threshold'");
  });
});

describe('pathBot: until', () => {
  test('hands the play to a named bot until the condition holds, and checks it first', () => {
    const r = run([{ until: { location: LIBRARY }, do: 'explorer', maxSteps: 60 }, { assert: { location: LIBRARY }, message: 'there' }]);
    expect(r.stopReason).toBe('script_done');
    const noop = run([{ until: { location: RUINS }, do: 'melee' }, { assert: { location: RUINS }, message: 'did not move' }]);
    expect(noop.stopReason).toBe('script_done');
    expect(noop.steps).toBeLessThan(4);
  });

  test('every named delegate plays', () => {
    for (const name of ['melee', 'explorer', 'caster', 'speedrunner', 'pacifist'] as const) {
      const r = run([{ until: { location: LIBRARY }, do: name, maxSteps: 120 }], { classId: name === 'caster' ? 'wizard' : 'ranger' });
      expect(r.stopReason).toBe('script_done');
      expect(r.locationsVisited).toContain(LIBRARY);
    }
  });

  test('a Bot object plays too, in a memory of its own', () => {
    let calls = 0;
    const stub: Bot = {
      name: 'stub',
      init: () => ({ made: true }),
      choose(s, legal, c, memory, ctx) {
        calls += 1;
        expect(memory['made']).toBe(true);
        return casterBot().choose(s, legal, c, memory['caster'] === undefined ? (memory['caster'] = {}) as BotMemory : (memory['caster'] as BotMemory), ctx);
      },
    };
    const r = run([{ until: { location: LIBRARY }, do: stub, maxSteps: 120 }], { classId: 'wizard' });
    expect(r.stopReason).toBe('script_done');
    expect(calls).toBeGreaterThan(0);
  });

  test('maxSteps bounds it (default 400); the failure names the condition', () => {
    const r = run([{ until: { level: { min: 99 } }, do: 'melee', maxSteps: 6 }]);
    expect(r.stopReason).toBe('script_assert');
    expect(r.stopMessage).toBe('step 0: until {"level":{"min":99}}: not reached within 6 steps');
    // the default is 400 choices
    const { state, profile } = loadScenario('loop1_day1', content);
    const legal = legalActions(state, content, profile);
    const idle: Bot = { name: 'idle', choose: (_s, l) => l[0] as Action };
    const bot = pathBot([{ until: { level: { min: 99 } }, do: idle }]);
    const memory = bot.init?.('x') ?? {};
    for (let i = 0; i < 400; i++) bot.choose(state, legal, content, memory, ctxOf(profile));
    expect(bot.halt?.(memory)).toBeNull();
    bot.choose(state, legal, content, memory, ctxOf(profile));
    expect(bot.halt?.(memory)?.message).toContain('not reached within 400 steps');
  });
});

describe('pathBot: rest', () => {
  test('rests N times, full where a bed is listed; zero is a no-op', () => {
    const r = run([{ rest: 3 }], { record: true });
    expect(r.stopReason).toBe('script_done');
    expect((r.trace ?? []).filter((a) => a.type === 'rest')).toHaveLength(3);
    expect(run([{ rest: 0 }, { assert: { day: { max: 1 } }, message: 'no time passed' }]).stopReason).toBe('script_done');
  });

  test('a rest that is not listed fails; a rest in a mode with no way on fails', () => {
    const shut = chooseOn([{ rest: 1 }], 'loop2_end', thresholdPack());
    expect(shut.bot.halt?.(shut.memory)?.message).toContain("rest: cannot go on in mode 'threshold'");
    const none = pathBot([{ rest: 1 }]);
    const memory = none.init?.('x') ?? {};
    const { state, profile } = loadScenario('loop1_day1', content);
    none.choose(state, [{ type: 'wait' }], content, memory, ctxOf(profile));
    expect(none.halt?.(memory)?.message).toBe('step 0: rest: no rest is listed here');
  });
});

describe('pathBot: loopEnd', () => {
  test('portal: passes the time to the Horde, walks to the Library portal, escapes and acknowledges the slides', () => {
    const r = run([{ loopEnd: 'portal' }, { assert: { loop: { min: 2 } }, message: 'Loop 2 has begun' }], {}, content, undefined);
    expect(r.stopReason).toBe('script_done');
    expect(r.closers).toEqual(['closer_escape']);
    expect(r.final.loop).toBe(2);
  });

  test('clock: waits for the thirtieth dawn and falls in its Horde', () => {
    const r = run([{ loopEnd: 'clock' }], {}, content, 'expiry_minus_1');
    expect(r.closers).toEqual(['closer_fall']);
    expect(r.loops[0]?.reason).toBe('expiry');
  });

  test('death from Loop 1 outside a Horde passes the time to one (a death before that would be FALLEN, not a closer)', () => {
    const r = run([{ loopEnd: 'death' }], {}, content, undefined);
    expect(r.closers).toEqual(['closer_fall']);
    expect(r.fallen).toBe(0);
  });

  test('death in Loop 2 seeks out the deadliest fight and falls in it', () => {
    const r = run([{ loopEnd: 'death' }], {}, content, 'loop2_day1');
    expect(r.closers).toEqual(['closer_fall']);
    expect(r.loops[0]?.reason).toBe('death');
    expect(r.deaths).toBe(1);
  });

  test('a loop that ends in the Threshold is done there', () => {
    const r = run([{ type: 'letGo' }, { loopEnd: 'portal' }, { assert: { loop: { min: 99 } }, message: 'unreachable' }], {}, content, 'loop2_day1');
    expect(r.final.mode).toBe('threshold');
    expect(r.stopMessage).toBe('unreachable');
    const already = run([{ loopEnd: 'death' }, { assert: { loop: { min: 3 } }, message: 'in the Threshold of the next loop' }], {}, content, 'loop2_end');
    expect(already.stopReason).toBe('script_done');
  });

  test('maxSteps bounds it, and a Horde with no open way to the portal fails', () => {
    const r = run([{ loopEnd: 'portal', maxSteps: 5 }], {}, content, undefined);
    expect(r.stopReason).toBe('script_assert');
    expect(r.stopMessage).toBe('step 0: loopEnd portal: the loop did not end within 5 steps');
  });

  test('a wandering dialogue and a closed mode on the way fail or are walked through', () => {
    const shut = chooseOn([{ loopEnd: 'portal' }], 'communion_movement_2', hordePack());
    expect(shut.state.mode).toBe('combat');
    expect(shut.legal).toContain(shut.action);
  });
});

describe('pathBot: determinism', () => {
  test('the same script and seed give the same result and state hash', () => {
    const script: ScriptStep[] = [{ goto: LIBRARY }, { rest: 2 }, { loopEnd: 'portal' }];
    const a = run(script);
    const b = run(script);
    expect(b.finalStateHash).toBe(a.finalStateHash);
    expect(b.steps).toBe(a.steps);
    expect(b.stopReason).toBe(a.stopReason);
  });
});

describe('ending scripts (PLAN §7.8; tests/fixtures/scripts/endings.ts)', () => {
  test('there is a script for every ending and closer the fixture packs express', () => {
    const ids = new Set(FIXTURE_ENDING_SCRIPTS.map((s) => s.endingId));
    for (const id of ['closer_escape', 'closer_fall', 'ending_unbound', 'ending_wardens_vigil', 'ending_mending']) expect(ids.has(id)).toBe(true);
    for (const pack of Object.values(FIXTURE_PACK_FACTORIES)) {
      for (const ending of Object.values(pack().endings)) expect(ids.has(ending.id)).toBe(true);
    }
    expect(isCloser('closer_fall') && isCloser('closer_escape') && !isCloser('ending_unbound')).toBe(true);
  });

  const packs = Object.keys(FIXTURE_PACK_FACTORIES) as FixturePackName[];
  describe.each(packs)('on the %s pack', (name) => {
    const pack = FIXTURE_PACK_FACTORIES[name]();
    test.each(FIXTURE_ENDING_SCRIPTS.map((s) => [`${s.endingId}${s.name === undefined ? '' : ` — ${s.name}`}`, s] as const))('%s', (_label, script) => {
      const proof = runEndingScript(script, pack);
      expect(proof.detail).toContain(`${script.endingId} reached`);
      expect(proof.reached).toBe(true);
      expect(proof.result.errors).toEqual([]);
      expect(proof.result.softLock.detected).toBe(false);
      if (!isCloser(script.endingId)) expect(proof.result.stopReason).toBe('ending');
    });
  });

  test('a script that does not reach its ending says why', () => {
    const base = FIXTURE_ENDING_SCRIPTS.find((s) => s.endingId === 'ending_mending');
    expect(base).toBeDefined();
    const wrongEnding = runEndingScript({ ...(base as NonNullable<typeof base>), endingId: 'ending_unbound' }, content);
    expect(wrongEnding.reached).toBe(false);
    expect(wrongEnding.detail).toContain('ending_unbound not reached');
    const broken = runEndingScript({ ...(base as NonNullable<typeof base>), loops: [[{ assert: { level: { min: 99 } }, message: 'too weak' }]] }, content);
    expect(broken.reached).toBe(false);
    expect(broken.detail).toBe('script_assert: too weak');
    const unfinished = runEndingScript({ ...(base as NonNullable<typeof base>), loops: [[]] }, content);
    expect(unfinished.detail).toContain('script_done: ending_mending not reached');
  });

  test('the Apex is where the Tyrant waits: the route script’s Loop 2 starts in Loop 2', () => {
    const route = FIXTURE_ENDING_SCRIPTS.find((s) => s.name?.startsWith("Loop 1's portal"));
    expect(route?.loops).toHaveLength(2);
    expect(APEX_LOCATION_ID).toBe('loc_temporal_breach_apex');
  });
});

describe('the runner hooks pathBot and the explorer use (U38)', () => {
  test('halt: asked after every choice; a non-null answer ends the run and the chosen action is not played', () => {
    let calls = 0;
    const waits: Bot = {
      name: 'halting',
      choose: (_s, legal) => {
        calls += 1;
        return legal.find((a) => a.type === 'wait') ?? (legal[0] as Action);
      },
      halt: () => (calls >= 3 ? { reason: 'script_assert', message: 'enough' } : null),
    };
    const r = run([], { bot: waits, record: true });
    expect(r.stopReason).toBe('script_assert');
    expect(r.stopMessage).toBe('enough');
    expect(calls).toBe(3);
    expect((r.trace ?? []).filter((a) => a.type === 'wait')).toHaveLength(2);
    const quiet = run([], { bot: { ...waits, halt: () => ({ reason: 'script_done' }) } });
    expect(quiet.stopReason).toBe('script_done');
    expect(quiet.stopMessage).toBeUndefined();
  });

  test('examines: `examine` is listed for a bot that asks for it, and for no other', () => {
    const seen = (examines: boolean): boolean => {
      let listed = false;
      const looker: Bot = {
        name: 'looker',
        examines,
        choose: (_s, legal) => {
          listed ||= legal.some((a) => a.type === 'examine');
          return legal.find((a) => a.type === 'wait') ?? (legal[0] as Action);
        },
        halt: () => (listed ? { reason: 'script_done' } : null),
      };
      runLoop({ seed: 'ex:1', classId: 'ranger', bot: looker, scenario: 'loop1_day1', maxSteps: 12, stopAt: 'max_steps' }, content);
      return listed;
    };
    expect(seen(true)).toBe(true);
    expect(seen(false)).toBe(false);
  });
});
