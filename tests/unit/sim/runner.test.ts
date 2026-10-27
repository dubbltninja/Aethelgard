// U37: the sim runner (PLAN §7.3) — the done-when (`random` runs 5,000 steps on the fixture pack with zero errors; `melee`
// reaches a Loop 1 closer on most seeds of every fixture pack), and the runner's own contract: the shell (title, FALLEN
// screen, autosave reload), stop rules, bot-bug and engine-exception reporting, determinism and trace replay, scenarios,
// modifiers and the record.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { legalActions, newRun, step, type Action, type ContentPack, type GameState, type Profile } from '@engine/index';
import { stateHash } from '@engine/util/hash';
import { meleeBot } from '@sim/bots/melee';
import { randomBot } from '@sim/bots/random';
import type { Bot } from '@sim/bots/types';
import { DEFAULT_MAX_FALLEN, DEFAULT_MAX_STEPS, REPLAY_LIMIT, isFallenScreen, resolveClass, runLoop, type RunConfig, type RunResult } from '@sim/runner';
import { newProfile } from '@sim/scenarios';
import { beforePack } from '@tests/fixtures/beforeContent';
import { combatPack } from '@tests/fixtures/combatContent';
import { companionPack } from '@tests/fixtures/companionContent';
import { beforeEconomyPack, economyPack } from '@tests/fixtures/economyContent';
import { hordePack } from '@tests/fixtures/hordeContent';
import { fixturePack } from '@tests/fixtures/miniContent';
import { storyPack } from '@tests/fixtures/storyContent';
import { thresholdPack } from '@tests/fixtures/thresholdContent';

const PACKS: readonly (readonly [string, () => ContentPack])[] = [
  ['fixture', fixturePack],
  ['combat', combatPack],
  ['companion', companionPack],
  ['horde', hordePack],
  ['story', storyPack],
  ['threshold', thresholdPack],
  ['economy', economyPack],
  ['before', beforePack],
  ['before_economy', beforeEconomyPack],
];

const LIBRARY = 'loc_shattered_library';

/** A bot from a function (tests only). */
const scripted = (name: string, choose: (s: GameState, legal: readonly Action[]) => Action): Bot => ({ name, choose: (s, legal) => choose(s, legal) });

/** Walks to the Library and Guards through every fight: dies to the two Shades at Level 1. */
const reckless = scripted('reckless', (s, legal) => {
  if (s.mode === 'combat') return legal.find((a) => a.type === 'guard') ?? (legal[0] as Action);
  return legal.find((a) => a.type === 'move' && a.to === LIBRARY) ?? legal.find((a) => a.type === 'continue') ?? legal.find((a) => a.type === 'choose') ?? legal.find((a) => a.type === 'wait') ?? (legal[0] as Action);
});

const clean = (r: RunResult): void => {
  expect(r.errors).toEqual([]);
  expect(r.softLock).toEqual({ detected: false });
  expect(r.rejected).toBe(0);
};

describe('random: the crash and soft-lock baseline (U37 done-when)', () => {
  test('5,000 steps on the fixture pack: zero errors, no soft-lock, no rejection', () => {
    const r = runLoop({ seed: 'u37:random', classId: 'auto', bot: randomBot(), maxSteps: 5000, stopAt: 'max_steps', maxFallen: Number.POSITIVE_INFINITY }, fixturePack());
    clean(r);
    expect(r.steps).toBe(5000);
    expect(r.stopReason).toBe('max_steps');
    expect(r.loops.length).toBeGreaterThan(3); // it lives through Loop 1 into the Threshold and later loops
    expect(r.deaths).toBeGreaterThan(0);
    expect(r.fights.length).toBeGreaterThan(0);
  }, 60_000);

  test.each(PACKS.slice(1))('%s: 800 steps, zero errors', (_name, pack) => {
    const r = runLoop({ seed: 'u37:random', classId: 'auto', bot: randomBot(), maxSteps: 800, stopAt: 'max_steps', maxFallen: Number.POSITIVE_INFINITY }, pack());
    clean(r);
    expect(r.steps).toBe(800);
  }, 30_000);
});

describe('melee: a Loop 1 closer on the fixture packs', () => {
  test.each(PACKS)('%s: most seeds reach a closer', (_name, pack) => {
    const runs = ['a', 'b', 'c'].map((seed) => runLoop({ seed: `u37:${seed}`, classId: 'auto', bot: meleeBot(), stopAt: 'loop_end' }, pack()));
    for (const r of runs) {
      expect(r.errors).toEqual([]);
      expect(r.softLock.detected).toBe(false);
    }
    const closed = runs.filter((r) => r.stopReason === 'loop_end' && r.closers.length === 1 && r.loops[0]?.loop === 1);
    expect(closed.length).toBeGreaterThanOrEqual(2);
  }, 30_000);

  test('the record: places, fights, kills, quests, damage by source, the loop', () => {
    const r = runLoop({ seed: 'u37:record', classId: 'ranger', bot: meleeBot(), stopAt: 'loop_end' }, storyPack());
    clean(r);
    expect(r.classId).toBe('ranger');
    expect(r.bot).toBe('melee');
    expect(r.locationsVisited).toContain(LIBRARY);
    expect(r.questsStarted).toContain('q_echo_crystal');
    expect(r.questsCompleted).toContain('q_echo_crystal');
    expect(r.creaturesSeen).toContain('cr_corrupted_shade');
    expect(r.creaturesKilled['cr_corrupted_shade']).toBeGreaterThan(0);
    expect(r.itemsObtained).toContain('item_echo_crystal');
    expect(r.fights.length).toBeGreaterThan(0);
    for (const f of r.fights) {
      // U81b2: an idle bot roams (melee.ts `idleRoam`), so its wanderers may be met outside the Ruins too
      expect(f.boss).toBe(false);
      expect(storyPack().regions[f.regionId]).toBeDefined();
      expect(['victory', 'defeat', 'fled']).toContain(f.result);
      expect(f.rounds).toBeGreaterThan(0);
    }
    expect(Object.values(r.damageBySource).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(r.loops).toHaveLength(1);
    expect(r.loops[0]).toMatchObject({ loop: 1, classId: 'ranger', outcome: 'closer_escape' });
    expect(r.closers).toEqual(['closer_escape']);
    expect(r.final).toMatchObject({ loop: 1, mode: 'ending' });
    expect(r.finalStateHash).toMatch(/^[0-9a-f]{8}$/);
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('stop rules', () => {
  test("'ending' stops at the Threshold of loop maxLoops; 'max_steps' only at the cap", () => {
    const loops = runLoop({ seed: 'u37:stop', classId: 'ranger', bot: meleeBot(), maxLoops: 2 }, fixturePack());
    clean(loops);
    expect(loops.stopReason).toBe('max_loops');
    expect(loops.loops.map((l) => l.loop)).toEqual([1, 2]);
    const capped = runLoop({ seed: 'u37:stop', classId: 'ranger', bot: meleeBot(), maxSteps: 40, stopAt: 'max_steps' }, fixturePack());
    expect(capped).toMatchObject({ steps: 40, stopReason: 'max_steps' });
    expect(DEFAULT_MAX_STEPS).toBe(6000);
  });

  test("a true ending stops an 'ending' run", () => {
    const r = runLoop({ seed: 'u37:end', classId: 'ranger', bot: meleeBot(), scenario: 'ending_a_ready' }, fixturePack());
    expect(r.errors).toEqual([]);
    expect(r.stopReason).toBe('ending');
    expect(r.endings).toHaveLength(1);
  });
});

describe('the shell: the FALLEN screen and the autosave', () => {
  test("onFallen 'stop': the run ends on the FALLEN screen", () => {
    const r = runLoop({ seed: 'u37:fall', classId: 'ranger', bot: reckless, onFallen: 'stop' }, fixturePack());
    expect(r.errors).toEqual([]);
    expect(r).toMatchObject({ stopReason: 'fallen', fallen: 1, deaths: 1 });
    expect(r.final.mode).toBe('combat');
    expect(r.loops).toEqual([]);
  });

  test("'reload' (default): back to the title, the last autosave loaded, up to maxFallen", () => {
    const r = runLoop({ seed: 'u37:fall', classId: 'ranger', bot: reckless, maxFallen: 2, record: true }, fixturePack());
    expect(r.errors).toEqual([]);
    expect(r).toMatchObject({ stopReason: 'fallen', fallen: 3, deaths: 3 });
    const types = (r.trace ?? []).map((a) => a.type);
    expect(types[0]).toBe('newGame');
    expect(types.filter((t) => t === 'returnToTitle')).toHaveLength(2);
    expect(types.filter((t) => t === 'load')).toHaveLength(2);
    expect(DEFAULT_MAX_FALLEN).toBe(25);
  });

  test('a scenario run stops at its FALLEN screen by default (its start is no save)', () => {
    const r = runLoop({ seed: 'u37:ff', classId: 'ranger', bot: reckless, scenario: 'first_fight' }, fixturePack());
    expect(r).toMatchObject({ stopReason: 'fallen', fallen: 1 });
  });

  test('isFallenScreen', () => {
    const s = { mode: 'combat', combat: { phase: 'defeat' } } as unknown as GameState;
    expect(isFallenScreen(s)).toBe(true);
    expect(isFallenScreen({ ...s, combat: { phase: 'playerTurn' } } as unknown as GameState)).toBe(false);
    expect(isFallenScreen({ ...s, mode: 'explore' } as unknown as GameState)).toBe(false);
  });
});

describe('bot bugs and engine exceptions are recorded', () => {
  test('an unlisted action: an error each time, then the rejected storm stops the run', () => {
    const r = runLoop({ seed: 'u37:bug', classId: 'ranger', bot: scripted('lost', () => ({ type: 'move', to: 'loc_nowhere' })) }, fixturePack());
    expect(r.stopReason).toBe('error');
    expect(r.rejected).toBe(31);
    expect(r.errors.filter((e) => e.message.includes('unlisted'))).toHaveLength(31);
    expect(r.errors.at(-1)?.message).toContain('rejected storm');
    expect(r.errors[0]).toMatchObject({ action: { type: 'move', to: 'loc_nowhere' } });
    expect(r.errors[0]?.stateHash).toMatch(/^[0-9a-f]{8}$/);
  });

  test('a shell action from a bot is a bot bug (and saving forever is a stall)', () => {
    const r = runLoop({ seed: 'u37:bug', classId: 'ranger', bot: scripted('saver', () => ({ type: 'save', slot: 1 })) }, fixturePack());
    expect(r.errors[0]?.message).toContain('shell action (save)');
    expect(r.softLock).toMatchObject({ detected: true, rule: 'stall', mode: 'explore' });
    expect(r.softLock.lastActions).toHaveLength(20);
    expect(r.stopReason).toBe('soft_lock');
  });

  test('a bot that throws ends the run with its stack', () => {
    const r = runLoop({ seed: 'u37:bug', classId: 'ranger', bot: scripted('broken', () => { throw new Error('boom'); }) }, fixturePack());
    expect(r.stopReason).toBe('error');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.message).toContain("bot 'broken' threw: boom");
    expect(r.errors[0]?.stack).toContain('boom');
  });

  test('an exception from step ends the run with the action and the state hash', () => {
    const base = fixturePack();
    const broken = { ...base, creatures: {} } as ContentPack; // a pack that lost its creatures: the Library's fight cannot start
    const r = runLoop({ seed: 'u37:bug', classId: 'ranger', bot: reckless }, broken);
    expect(r.stopReason).toBe('error');
    expect(r.errors[0]?.message).toMatch(/^step threw on move: /);
    expect(r.errors[0]?.action).toEqual({ type: 'move', to: LIBRARY });
    expect(r.errors[0]?.stack).toBeDefined();
  });
});

describe('determinism and replay', () => {
  const cfg = (record = false): RunConfig => ({ seed: 'u37:det', classId: 'auto', bot: randomBot(), maxSteps: 600, stopAt: 'max_steps', record, maxFallen: 100 });
  const strip = ({ durationMs: _d, trace: _t, ...rest }: RunResult) => rest;

  test('the same seed replays exactly; another seed does not', () => {
    const a = runLoop(cfg(), fixturePack());
    expect(strip(runLoop(cfg(), fixturePack()))).toEqual(strip(a));
    expect(runLoop({ ...cfg(), seed: 'u37:other' }, fixturePack()).finalStateHash).not.toBe(a.finalStateHash);
  });

  test('the recorded trace replays through step to the same final state', () => {
    const r = runLoop(cfg(true), fixturePack());
    const content = fixturePack();
    let profile: Profile = newProfile('u37:det');
    let s: GameState = { ...newRun('u37:det', 'ranger', content, profile), mode: 'title' };
    expect(r.trace).toHaveLength(r.steps);
    for (const a of r.trace ?? []) ({ state: s, profile } = step(s, a, content, profile));
    expect(stateHash(s)).toBe(r.finalStateHash);
  });
});

describe('configuration', () => {
  test("classId 'auto': the bot's preferred class the pack has, else the first by id", () => {
    const h = hordePack();
    expect(resolveClass('auto', meleeBot(), h)).toBe('ranger');
    expect(resolveClass('auto', { preferredClasses: ['ironclad_warden'] }, h)).toBe('ironclad_warden');
    expect(resolveClass('auto', { preferredClasses: ['nobody'] }, h)).toBe('elf');
    expect(resolveClass('auto', randomBot(), fixturePack())).toBe('ranger');
    expect(resolveClass('wizard', randomBot(), fixturePack())).toBe('wizard');
    expect(() => resolveClass('nobody', randomBot(), fixturePack())).toThrow("no class 'nobody'");
    expect(() => resolveClass('auto', randomBot(), { ...fixturePack(), classes: {} } as ContentPack)).toThrow('no classes');
  });

  test('the real pack starts (U42: the Ruins exist) and meets a dangling reference only in a table still being authored (D-090)', () => {
    // The regions, the gear and (U50) every item, recipe and merchant exist; what is still being authored (quests, dialogues, Echoes,
    // codex entries …) is not there yet, so a run that reaches one ends with an engine error naming it — and until it does it plays on.
    const r = runLoop({ seed: 's', classId: 'ranger', bot: meleeBot(), maxSteps: 200 }, buildContentPack());
    expect(r.steps).toBeGreaterThan(0);
    expect(['error', 'max_steps']).toContain(r.stopReason);
    for (const e of r.errors) expect(e.message).toMatch(/unknown (item|location|creature|quest|scene|dialogue|codex entry|echo|npc)/);
  });

  test('modifiers are toggled before Loop 1 (Frayed Clock: an earlier expiry); unknown ones throw', () => {
    const t = thresholdPack();
    const r = runLoop({ seed: 'u37:mod', classId: 'ranger', bot: meleeBot(), stopAt: 'loop_end', modifiers: ['mod_frayed_clock'] }, t);
    clean(r);
    expect(r.loops[0]?.daysUsed).toBeLessThan(25);
    expect(() => runLoop({ seed: 's', classId: 'ranger', bot: meleeBot(), modifiers: ['mod_nope'] }, t)).toThrow("no modifier 'mod_nope'");
  });

  test('a carried profile is copied, never mutated; its id seeds Loop 2', () => {
    const carried = newProfile('carried');
    const before = structuredClone(carried);
    const r = runLoop({ seed: 'u37:carry', classId: 'ranger', bot: meleeBot(), profile: carried, maxLoops: 2 }, fixturePack());
    clean(r);
    expect(carried).toEqual(before);
    expect(r.loops).toHaveLength(2);
  });

  test('the bot sees only legal lists of the state it plays (never the title or the FALLEN screen)', () => {
    const modes = new Set<string>();
    const spy: Bot = {
      name: 'spy',
      choose(s, legal, content, memory, ctx) {
        modes.add(s.mode);
        expect(legal).toEqual(legalActions(s, content, ctx.profile));
        expect(isFallenScreen(s)).toBe(false);
        return reckless.choose(s, legal, content, memory, ctx);
      },
    };
    runLoop({ seed: 'u37:spy', classId: 'ranger', bot: spy, maxFallen: 1, maxSteps: 300 }, fixturePack());
    expect(modes.has('title')).toBe(false);
    expect(modes.has('combat')).toBe(true);
  });
});

describe('U82: the hand save (D-149 #1)', () => {
  test('a dead end at a few HP is left for the last healthy save after REPLAY_LIMIT FALLEN screens on one autosave', () => {
    // U81b2's batch: this ranger fled the Pass's Moths to the Spires at 16 HP, the autosave kept it there, and every way out
    // (the Pass, the Plateau) killed it again: 26 FALLEN screens and a stopped run. Now it goes back to its last healthy save.
    const r = runLoop({ seed: 'balA:1', classId: 'ranger', bot: meleeBot(), stopAt: 'loop_end', maxSteps: 6000 }, buildContentPack());
    expect(REPLAY_LIMIT).toBe(2);
    expect(r.stopReason).toBe('loop_end');
    expect(r.fallen).toBeLessThan(DEFAULT_MAX_FALLEN);
  }, 120_000);
});
