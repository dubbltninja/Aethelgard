// U39: what the runner records for the balance report (PLAN §7.5) — per-loop steps, deaths and gold, the fight record's gold,
// MP, damage dealt, companion, phase and communion flags, combat action counts, Blood-price casts, purchases, crafts,
// upgrades, quest days, dialogue choices, the lowest gold, the highest Resolve and the companions' record — plus `startRun`
// and the scenario companion.
import { describe, expect, test } from 'bun:test';
import { newRun, type Action, type GameEvent, type GameState, type ItemInstance } from '@engine/index';
import { casterBot } from '@sim/bots/caster';
import { meleeBot } from '@sim/bots/melee';
import { Recorder, resolveClass, runLoop, startRun } from '@sim/runner';
import { newProfile } from '@sim/scenarios';
import { companionPack } from '@tests/fixtures/companionContent';
import { economyPack } from '@tests/fixtures/economyContent';
import { storyPack } from '@tests/fixtures/storyContent';

const story = storyPack();

describe('the record of a real run', () => {
  // U81a (D-110): a seed whose run reaches the communion and pays a Blood price (bal:0 did so only while the bots guarded forever).
  // U84: bal:8 stopped reaching the communion once Blood-priced casts were empowered (D-149 #4); bal:3 does.
  const run = runLoop({ seed: 'bal:3', classId: 'shadow_weaver', bot: casterBot(), stopAt: 'ending' }, story);

  test('each loop knows its own steps, deaths and gold', () => {
    expect(run.loops.length).toBeGreaterThanOrEqual(2);
    const steps = run.loops.reduce((t, l) => t + l.steps, 0);
    expect(steps).toBeGreaterThan(0);
    expect(steps).toBeLessThanOrEqual(run.steps);
    expect(run.loops.reduce((t, l) => t + l.deaths, 0)).toBeLessThanOrEqual(run.deaths);
    for (const l of run.loops) {
      expect(l.steps).toBeGreaterThan(0);
      expect(l.gold).toBeGreaterThanOrEqual(0);
    }
  });

  test('a fight carries gold, MP, damage dealt, companion, phase and communion', () => {
    const f = run.fights[0];
    expect(f).toBeDefined();
    expect(f).toMatchObject({ companion: false, phase: 0, communion: false });
    expect(f?.gold).toBeGreaterThanOrEqual(0);
    expect(f?.mpMax).toBeGreaterThan(0);
    expect(f?.endMp).toBeLessThanOrEqual(f?.mpMax ?? 0);
    expect(f?.damageDealt).toBeGreaterThan(0);
    expect(run.fights.some((x) => x.communion)).toBe(true); // the Tyrant's communion in Loop 2
  });

  test('combat actions are counted by type, shell actions never', () => {
    expect(run.combatActions['ability']).toBeGreaterThan(0);
    expect(run.combatActions['attack']).toBeGreaterThan(0);
    expect(run.combatActions['returnToTitle']).toBeUndefined();
    expect(run.combatActions['newGame']).toBeUndefined();
  });

  test('purchases, quest days, dialogue choices, lowest gold and the highest Resolve', () => {
    expect(Object.keys(run.purchases).length).toBeGreaterThan(0);
    expect(run.questDays['q_echo_crystal']).toBeGreaterThanOrEqual(0);
    expect(run.choicesTaken.length).toBeGreaterThan(0);
    expect(run.choicesTaken.every((c) => /^scene_\w+\/\w+$/.test(c))).toBe(true);
    expect(run.minGold).toBeGreaterThanOrEqual(0);
    expect(run.maxResolve).toBeGreaterThanOrEqual(3);
  });

  test('a cast that pays part of its MP in HP is a Blood-price cast (Shadow Weaver only)', () => {
    expect(run.bloodCasts).toBeGreaterThan(0);
    const wizard = runLoop({ seed: 'bal:0', classId: 'wizard', bot: casterBot(), stopAt: 'ending' }, story);
    expect(wizard.bloodCasts).toBe(0);
  });

  test('upgrades are counted by the rarity reached', () => {
    const r = runLoop({ seed: 'bal:0', classId: 'ranger', bot: meleeBot(), stopAt: 'ending' }, economyPack());
    expect(r.upgradesByRarity['uncommon']).toBeGreaterThan(0);
  });
});

describe('Recorder events that real runs seldom produce', () => {
  const profile = newProfile('rec');
  const state: GameState = { ...newRun('rec', 'ranger', story, profile), mode: 'explore' };
  const item: ItemInstance = { uid: 'i1', itemId: 'item_rusty_dagger', qty: 1, rarity: 'rare', affixes: [] };
  const feed = (rec: Recorder, events: GameEvent[], action: Action = { type: 'wait' }, steps = 1, next: GameState = state): void => rec.observe(state, next, events, action, steps);

  test('crafts by recipe, upgrades by rarity, companions (knocked out, died, loyalty), the highest Resolve', () => {
    const rec = new Recorder(story);
    feed(rec, [
      { t: 'crafted', recipeId: 'recipe_x', item },
      { t: 'crafted', recipeId: 'recipe_x', item },
      { t: 'upgraded', item },
      { t: 'companionRecruited', companionId: 'ilyra' },
      { t: 'companionKo', companionId: 'ilyra' },
      { t: 'companionKo', companionId: 'ilyra' },
      { t: 'loyaltyChanged', companionId: 'ilyra', delta: 5, value: 55 },
      { t: 'companionDied', companionId: 'brak' },
      { t: 'resolveChanged', delta: 2, value: 4, movement: 1, reason: 'x' },
      { t: 'resolveChanged', delta: -1, value: 3, movement: 1, reason: 'x' },
    ]);
    expect(rec.craftsByRecipe).toEqual({ recipe_x: 2 });
    expect(rec.upgradesByRarity).toEqual({ rare: 1 });
    expect(rec.companions).toEqual({ ilyra: { kos: 2, died: false, loyalty: 55 }, brak: { kos: 0, died: true, loyalty: 0 } });
    expect(rec.maxResolve).toBe(4);
  });

  test('a loop end takes the steps and deaths since the previous one, whatever the order of the events', () => {
    const rec = new Recorder(story);
    const record = { runId: 'x', seed: 'x', loop: 1, classId: 'ranger', outcome: 'closer_fall', reason: 'death' as const, daysUsed: 3, level: 1, echoesGained: [], questsCompleted: [], tyrant: 'untouched' as const, heartstone: 'intact', modifiers: [], summary: '' };
    feed(rec, [{ t: 'loopEnded', loop: 1, outcome: 'closer_fall', reason: 'death', record }, { t: 'playerDied', loop: 1 }], { type: 'wait' }, 7);
    feed(rec, [{ t: 'playerDied', loop: 2 }, { t: 'loopEnded', loop: 2, outcome: 'closer_fall', reason: 'death', record: { ...record, loop: 2 } }], { type: 'wait' }, 12);
    expect(rec.loops.map((l) => [l.steps, l.deaths])).toEqual([[7, 1], [5, 1]]);
    expect(rec.closers).toEqual(['closer_fall', 'closer_fall']);
  });

  test('a quest completed in a later loop counts days from its start in that loop; a never-started one counts none', () => {
    const rec = new Recorder(story);
    const at = (day: number): GameState => ({ ...state, clock: { ...state.clock, ticks: (day - 1) * 4 } });
    rec.observe(state, at(2), [{ t: 'questStarted', questId: 'q_a' }], { type: 'wait' }, 1);
    rec.observe(state, at(5), [{ t: 'questCompleted', questId: 'q_a' }, { t: 'questCompleted', questId: 'q_b' }], { type: 'wait' }, 2);
    expect(rec.questDays).toEqual({ q_a: 3, q_b: 0 });
  });
});

describe('startRun and the scenario companion', () => {
  test('a title-screen start, with modifiers; the errors name what is missing', () => {
    const mod = Object.keys(story.modifiers)[0];
    const start = startRun({ seed: 's', modifiers: mod === undefined ? [] : [mod] }, 'ranger', story);
    expect(start.state.mode).toBe('title');
    if (mod !== undefined) expect(start.profile.modifiers[mod]).toBe(true);
    expect(() => startRun({ seed: 's', modifiers: ['mod_nope'] }, 'ranger', story)).toThrow("no modifier 'mod_nope'");
    expect(() => startRun({ seed: 's' }, 'ranger', { ...story, locations: {} })).toThrow('no start location');
    expect(resolveClass('auto', {}, story)).toBe('elf');
  });

  test('a scenario can start with a companion at the Wayfinder\'s side, and its fights say so', () => {
    const pack = companionPack();
    const withCompanion = runLoop({ seed: 'c:1', classId: 'ranger', bot: meleeBot(), scenario: 'first_fight', companionId: 'ilyra', stopAt: 'max_steps', maxSteps: 40 }, pack);
    const solo = runLoop({ seed: 'c:1', classId: 'ranger', bot: meleeBot(), scenario: 'first_fight', stopAt: 'max_steps', maxSteps: 40 }, pack);
    expect(withCompanion.fights[0]?.companion).toBe(true);
    expect(solo.fights[0]?.companion).toBe(false);
  });
});
