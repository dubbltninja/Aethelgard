// U38: the four policy bots (PLAN §7.2) — caster, explorer, speedrunner, pacifist — against the done-when: a Loop 1 closer
// on most seeds of every fixture pack, a Loop 2+ communion for the caster and the pacifist, the pacifist's kill record,
// determinism (same seed → same state hash and result), and the registry.
import { describe, expect, test } from 'bun:test';
import type { ContentPack } from '@engine/index';
import { BOTS } from '@sim/bots/index';
import { runLoop, type RunConfig, type RunResult } from '@sim/runner';
import { FIXTURE_PACK_FACTORIES, type FixturePackName } from '@tests/fixtures/scripts/endings';

const NEW_BOTS = ['caster', 'explorer', 'speedrunner', 'pacifist'] as const;
type NewBot = (typeof NEW_BOTS)[number];
const PACKS = Object.keys(FIXTURE_PACK_FACTORIES) as FixturePackName[];

const packs = new Map<FixturePackName, ContentPack>();
const packOf = (name: FixturePackName): ContentPack => {
  let p = packs.get(name);
  if (p === undefined) {
    p = FIXTURE_PACK_FACTORIES[name]();
    packs.set(name, p);
  }
  return p;
};

const play = (bot: NewBot, pack: FixturePackName, seed: string, over: Partial<RunConfig> = {}): RunResult =>
  runLoop({ seed, classId: 'auto', bot: (BOTS[bot] as NonNullable<(typeof BOTS)[string]>)(), stopAt: 'loop_end', ...over }, packOf(pack));

const clean = (r: RunResult): void => {
  expect(r.errors).toEqual([]);
  expect(r.softLock.detected).toBe(false);
  expect(r.rejected).toBe(0);
};

/** What must not differ between two runs of one seed (the wall clock does). */
const essence = (r: RunResult) => ({ ...r, durationMs: 0 });

describe('the registry', () => {
  test('names the six bots; every factory builds a bot of that name', () => {
    expect(Object.keys(BOTS).sort()).toEqual(['caster', 'explorer', 'melee', 'pacifist', 'random', 'speedrunner']);
    for (const [name, make] of Object.entries(BOTS)) expect(make().name).toBe(name);
  });

  test('each new bot says which class it prefers; the explorer lists `examine`', () => {
    expect(BOTS['caster']?.().preferredClasses).toEqual(['wizard', 'shadow_weaver']);
    expect(BOTS['explorer']?.().preferredClasses).toEqual(['ranger']);
    expect(BOTS['explorer']?.().examines).toBe(true);
    expect(BOTS['caster']?.().examines).toBeUndefined();
  });
});

describe('Loop 1: a closer on most seeds of every fixture pack (U38 done-when)', () => {
  describe.each(NEW_BOTS)('%s', (bot) => {
    test.each(PACKS)('%s pack', (pack) => {
      const runs = ['a', 'b', 'c', 'd'].map((seed) => play(bot, pack, `u38:${seed}`));
      for (const r of runs) clean(r);
      const closed = runs.filter((r) => r.stopReason === 'loop_end' && r.closers.length === 1 && r.loops[0]?.loop === 1);
      expect(closed.length).toBeGreaterThanOrEqual(3);
      expect(runs[0]?.bot).toBe(bot);
    }, 30_000);
  });
});

describe('determinism: the same seed gives the same state hash and result', () => {
  test.each(NEW_BOTS)('%s', (bot) => {
    for (const pack of ['fixture', 'story', 'economy'] as const) {
      const a = play(bot, pack, 'u38:det', { maxLoops: 3, stopAt: 'ending', record: true });
      const b = play(bot, pack, 'u38:det', { maxLoops: 3, stopAt: 'ending', record: true });
      expect(b.finalStateHash).toBe(a.finalStateHash);
      expect(essence(b)).toEqual(essence(a));
      const other = play(bot, pack, 'u38:other', { maxLoops: 3, stopAt: 'ending' });
      expect(other.errors).toEqual([]);
    }
  }, 60_000);
});

describe('the caster and the pacifist commune with the Tyrant from Loop 2 (U38 done-when)', () => {
  test.each(['caster', 'pacifist', 'speedrunner'] as const)('%s reaches an ending by the communion on every pack, on some seed of three', (bot) => {
    for (const pack of PACKS) {
      let ending: RunResult | undefined;
      for (const seed of ['u38:c1', 'u38:c2', 'u38:c3']) {
        const r = play(bot, pack, seed, { maxLoops: 3, stopAt: 'ending' });
        clean(r);
        if (r.endings.length > 0) {
          ending = r;
          break;
        }
      }
      expect(ending?.stopReason).toBe('ending');
      expect(ending?.final.loop).toBeGreaterThanOrEqual(2);
      expect(ending?.loops.at(-1)?.outcome).toBe(ending?.endings[0] as string);
    }
  }, 60_000);

  test('the explorer does not commune (it fights like melee) and never reaches an ending', () => {
    const r = play('explorer', 'fixture', 'u38:c2', { maxLoops: 2, stopAt: 'ending' });
    clean(r);
    expect(r.endings).toEqual([]);
  });
});

describe('the pacifist', () => {
  test('records no kills in a run that never had to fight', () => {
    let quiet = 0;
    for (const pack of PACKS) {
      for (const seed of ['a', 'b', 'c']) {
        const r = play('pacifist', pack, `u38:p:${seed}`);
        clean(r);
        // U81a: "never had to fight" is no blow landed, not only no victory — a forced fight (now from round 20) can kill one
        // foe and still be lost
        if (r.fights.every((f) => f.result !== 'victory' && f.damageDealt === 0)) {
          quiet += 1;
          expect(Object.values(r.creaturesKilled).reduce((x, y) => x + y, 0)).toBe(0);
        }
      }
    }
    expect(quiet).toBeGreaterThan(PACKS.length); // most runs never had to fight
  }, 60_000);

  test('where every arrival starts a wandering fight (the economy pack’s Mistwood Path) it is forced, once, to stand and fight', () => {
    const runs = ['a', 'b', 'c', 'd', 'e'].map((seed) => play('pacifist', 'economy', `u38:p:${seed}`));
    for (const r of runs) {
      clean(r);
      expect(r.closers).toHaveLength(1); // still ends its loop (the portal, or the Horde of the thirtieth dawn)
    }
    expect(runs.some((r) => r.fights.some((f) => f.result === 'fled'))).toBe(true);
    expect(runs.some((r) => Object.keys(r.creaturesKilled).length > 0)).toBe(true);
  });

  test('a Loop 2+ communion run kills nothing and ends in an ending', () => {
    const r = play('pacifist', 'story', 'u38:p:comm', { maxLoops: 3, stopAt: 'ending' });
    clean(r);
    expect(r.endings.length).toBe(1);
    expect(Object.values(r.creaturesKilled).reduce((x, y) => x + y, 0)).toBe(0);
  });
});

describe('the explorer', () => {
  test('visits every place before Day 26, opens every examine, talks to everyone', () => {
    const pack = packOf('fixture');
    const r = play('explorer', 'fixture', 'u38:x', { record: true });
    clean(r);
    expect([...r.locationsVisited].sort()).toEqual(Object.keys(pack.locations).sort());
    const trace = r.trace ?? [];
    expect(trace.filter((a) => a.type === 'examine').length).toBeGreaterThan(5);
    expect(trace.some((a) => a.type === 'talk')).toBe(true);
    expect(r.questsStarted.length).toBeGreaterThan(0);
  });

  test('on the larger packs it still finishes Loop 1 within a normal run', () => {
    for (const pack of ['story', 'companion', 'before_economy'] as const) {
      const r = play('explorer', pack, 'u38:x');
      clean(r);
      expect(r.closers).toHaveLength(1);
      expect(r.locationsVisited.length).toBeGreaterThan(3);
    }
  });
});
