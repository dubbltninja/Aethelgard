// U14: the condition evaluator (PLAN §4.9, §8.1 "conditions/effects"). Every atom true and false; nested logic;
// explain() parts; the D-048 Apex gate in Loop 1 and Loop 2+.
import { describe, expect, test } from 'bun:test';
import type { Condition, ConditionKey } from '@schema/condition';
import { evaluate, explain, rangeText, type CompanionRunState, type GameState, type Profile } from '@engine/index';
import { deepFreeze } from '@engine/util/clone';
import { fullState, minimalProfile, minimalState } from './types/handmade';
import { standInPack } from './standInPack';

const content = deepFreeze(standInPack());
type Setup = (s: GameState, p: Profile) => void;
interface Case {
  cond: Condition;
  /** Setups that make `cond` true / false (applied to a fresh minimal state + profile). */
  t: Setup[];
  f: Setup[];
  base?: () => GameState;
}

const none: Setup = () => {};
const comp = (id: string, patch: Partial<CompanionRunState> = {}): CompanionRunState => ({
  id, recruited: true, loyalty: 0, hp: 100, hpMax: 100, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {},
  ...patch,
});
const quest = (status: 'active' | 'completed' | 'failed' | 'inactive', stage = 'find_brute') => ({
  status, stage, startedDay: 1, endedDay: null, counters: {}, objectivesDone: [],
});
const item = (itemId: string, qty = 1) => ({ uid: `i_${itemId}_${qty}`, itemId, qty, rarity: 'common' as const, affixes: [] });

const CASES: { [K in ConditionKey]: Case[] } = {
  all: [{ cond: { all: [{ flag: 'flag_a' }, { loop: { min: 1 } }] }, t: [(s) => void (s.flags.flag_a = true)], f: [none] }],
  any: [{ cond: { any: [{ flag: 'flag_a' }, { flag: 'flag_b' }] }, t: [(s) => void (s.flags.flag_b = true)], f: [none] }],
  not: [{ cond: { not: { flag: 'flag_a' } }, t: [none], f: [(s) => void (s.flags.flag_a = true)] }],
  flag: [{ cond: { flag: 'flag_a' }, t: [(s) => void (s.flags.flag_a = 3), (s) => void (s.flags.flag_a = 'x')], f: [none, (s) => void (s.flags.flag_a = false)] }],
  echo: [
    {
      cond: { echo: 'echo_ilyra_watchword' },
      t: [(_s, p) => void p.echoes.push('echo_ilyra_watchword'), (s) => void s.echoesThisLoop.push('echo_ilyra_watchword')],
      f: [none, (_s, p) => void p.echoes.push('echo_other')],
    },
  ],
  quest: [
    {
      cond: { quest: { id: 'q_clear_path' } },
      t: [(s) => void (s.quests.q_clear_path = quest('active')), (s) => void (s.quests.q_clear_path = quest('completed'))],
      f: [none, (s) => void (s.quests.q_clear_path = quest('failed')), (s) => void (s.quests.q_clear_path = quest('inactive'))],
    },
    { cond: { quest: { id: 'q_clear_path', status: 'inactive' } }, t: [none], f: [(s) => void (s.quests.q_clear_path = quest('active'))] },
    {
      cond: { quest: { id: 'q_clear_path', stage: 'done' } },
      t: [(s) => void (s.quests.q_clear_path = quest('active', 'done')), (s) => void (s.quests.q_clear_path = quest('completed', 'done'))],
      f: [none, (s) => void (s.quests.q_clear_path = quest('active')), (s) => void (s.quests.q_clear_path = quest('inactive', 'done'))],
    },
    {
      cond: { quest: { id: 'q_clear_path', stage: 'done', status: 'completed' } },
      t: [(s) => void (s.quests.q_clear_path = quest('completed', 'done'))],
      f: [(s) => void (s.quests.q_clear_path = quest('active', 'done')), (s) => void (s.quests.q_clear_path = quest('completed'))],
    },
  ],
  item: [
    {
      cond: { item: { id: 'item_ley_touched_tonic', count: 3 } },
      t: [(s) => void s.player.inventory.push(item('item_ley_touched_tonic', 2), item('item_ley_touched_tonic', 1))],
      f: [none, (s) => void s.player.inventory.push(item('item_ley_touched_tonic', 2))],
    },
    {
      cond: { item: { id: 'item_hunting_bow' } },
      t: [(s) => void (s.player.equipment.weapon = item('item_hunting_bow')), (s) => void s.player.inventory.push(item('item_hunting_bow'))],
      f: [none],
    },
  ],
  rep: [
    {
      cond: { rep: { faction: 'weavers', min: 20, max: 59 } },
      t: [(s) => void (s.reputation.weavers = 20), (s) => void (s.reputation.weavers = 59)],
      f: [none, (s) => void (s.reputation.weavers = 60), (s) => void (s.reputation.remnants = 30)],
    },
  ],
  loop: [{ cond: { loop: { min: 2 } }, t: [(s) => void (s.meta.loop = 2)], f: [none] }],
  day: [{ cond: { day: { min: 5 } }, t: [(s) => void (s.clock.ticks = 16)], f: [none, (s) => void (s.clock.ticks = 15)] }],
  level: [{ cond: { level: { max: 3 } }, t: [none, (s) => void (s.player.level = 3)], f: [(s) => void (s.player.level = 4)] }],
  watch: [
    { cond: { watch: 'night' }, t: [(s) => void (s.clock.ticks = 3), (s) => void (s.clock.ticks = 7)], f: [none, (s) => void (s.clock.ticks = 4)] },
    // U34d: inside the Before (frozen clock) the echo's own hour, `counters.custom.before_watch`
    {
      cond: { watch: 'day' },
      t: [(s) => void Object.assign(s, { before: { day: 3, resets: 0 } }, { counters: { ...s.counters, custom: { before_watch: 1 } } })],
      f: [
        (s) => void Object.assign(s, { before: { day: 3, resets: 0 } }, { clock: { ...s.clock, ticks: 1 } }),
        (s) => void (s.counters.custom.before_watch = 1),
      ],
    },
  ],
  clock: [
    {
      cond: { clock: { daysLeft: { max: 1 } } },
      t: [(s) => void (s.clock.ticks = 112), (s) => void Object.assign(s.clock, { ticks: 76, limitTicks: 80 })],
      f: [none, (s) => void (s.clock.ticks = 108)],
    },
  ],
  beforeDay: [
    {
      cond: { beforeDay: 2 },
      t: [(s) => void (s.before = { day: 2, resets: 0 })],
      f: [none, (s) => void (s.before = { day: 1, resets: 0 })],
    },
  ],
  beforeResets: [
    {
      cond: { beforeResets: { min: 3 } },
      t: [(s) => void (s.before = { day: 1, resets: 3 })],
      f: [none, (s) => void (s.before = { day: 3, resets: 2 })],
    },
  ],
  class: [{ cond: { class: 'wizard' }, t: [(s) => void (s.player.classId = 'wizard')], f: [none] }],
  stat: [{ cond: { stat: { name: 'agility', min: 10 } }, t: [(s) => void (s.player.stats.agility = 10)], f: [none, (s) => void (s.player.stats.agility = 9)] }],
  companion: [
    {
      cond: { companion: { id: 'brak' } },
      t: [(s) => void (s.companions = { recruited: { brak: comp('brak') }, activeId: 'brak' })],
      f: [
        none,
        (s) => void (s.companions = { recruited: { brak: comp('brak') }, activeId: null }),
        (s) => void (s.companions = { recruited: { brak: comp('brak', { dead: true }) }, activeId: 'brak' }),
      ],
    },
    {
      cond: { companion: { id: 'brak', state: 'recruited' } },
      t: [(s) => void (s.companions = { recruited: { brak: comp('brak') }, activeId: null })],
      f: [none, (s) => void (s.companions = { recruited: { brak: comp('brak', { recruited: false }) }, activeId: null })],
    },
    {
      cond: { companion: { id: 'brak', state: 'ko' } },
      t: [(s) => void (s.companions = { recruited: { brak: comp('brak', { ko: true }) }, activeId: 'brak' })],
      f: [none, (s) => void (s.companions = { recruited: { brak: comp('brak') }, activeId: 'brak' })],
    },
    {
      // U34f: recruited, not the active one, waiting nowhere (walking with the party)
      cond: { companion: { id: 'brak', state: 'following' } },
      t: [(s) => void (s.companions = { recruited: { brak: comp('brak') }, activeId: null })],
      f: [
        none,
        (s) => void (s.companions = { recruited: { brak: comp('brak') }, activeId: 'brak' }),
        (s) => void (s.companions = { recruited: { brak: comp('brak', { waitingAt: 'loc_whispering_ruins' }) }, activeId: null }),
        (s) => void (s.companions = { recruited: { brak: comp('brak', { dead: true }) }, activeId: null }),
      ],
    },
  ],
  loyalty: [
    {
      cond: { loyalty: { companion: 'mireya', min: 25 } },
      t: [(s) => void (s.companions.recruited.mireya = comp('mireya', { loyalty: 25 }))],
      f: [none, (s) => void (s.companions.recruited.mireya = comp('mireya', { loyalty: 24 }))],
    },
  ],
  corruption: [{ cond: { corruption: { min: 3 } }, t: [(s) => void (s.player.corruption = 3)], f: [none, (s) => void (s.player.corruption = 2)] }],
  location: [{ cond: { location: 'loc_shattered_library' }, t: [(s) => void (s.world.currentLocationId = 'loc_shattered_library')], f: [none] }],
  killed: [
    {
      cond: { killed: { id: 'cr_wildling_brute', count: 2 } },
      t: [(s) => void (s.counters.kills.cr_wildling_brute = 2)],
      f: [none, (s) => void (s.counters.kills.cr_wildling_brute = 1), (s) => void (s.counters.kills.cr_other = 5)],
    },
    {
      // U34e: `anyLoop` reads the profile's bestiary (every loop), this loop's kills too
      cond: { killed: { id: 'cr_wildling_brute', anyLoop: true } },
      t: [
        (_s, p) => void (p.bestiary.cr_wildling_brute = { seen: 1, killed: 1, spared: 0, revealed: 'resist', intentsSeen: [] }),
        (s) => void (s.counters.kills.cr_wildling_brute = 1),
      ],
      f: [none, (_s, p) => void (p.bestiary.cr_wildling_brute = { seen: 3, killed: 0, spared: 1, revealed: 'none', intentsSeen: [] })],
    },
  ],
  counter: [
    {
      cond: { counter: { name: 'bells', min: 3 } },
      t: [(s) => void (s.counters.custom.bells = 3)],
      f: [none, (s) => void (s.counters.custom.bells = 2)],
    },
  ],
  resolve: [
    {
      cond: { resolve: { min: 4 } },
      base: fullState,
      t: [none],
      f: [(s) => void (s.combat!.communion!.resolve = 3), (s) => void (s.combat!.communion = null), (s) => void (s.combat = null)],
    },
  ],
  modifier: [{ cond: { modifier: 'mod_glass' }, t: [(s) => void s.meta.modifiers.push('mod_glass')], f: [none, (s) => void s.meta.modifiers.push('mod_iron_loop')] }],
  infected: [
    {
      cond: { infected: true },
      t: [(s) => void s.world.infected.push('loc_whispering_ruins')],
      f: [none, (s) => void s.world.infected.push('loc_temporal_breach_apex')],
    },
  ],
  // U34e: the profile's last death place is where the player stands
  diedHere: [
    {
      cond: { diedHere: true },
      t: [(s, p) => void (p.lastDeathLocation = s.world.currentLocationId)],
      f: [none, (_s, p) => void (p.lastDeathLocation = 'loc_temporal_breach_apex')],
    },
  ],
  // U34f: the current node's region
  region: [
    {
      cond: { region: 'region_glowlands' },
      t: [(s) => void (s.world.currentLocationId = 'loc_heartstone_depths')],
      f: [none, (s) => void (s.world.currentLocationId = 'loc_shattered_library'), (s) => void (s.world.currentLocationId = 'loc_nowhere')],
    },
  ],
};

const prepared = (c: Case, setup: Setup) => {
  const s = (c.base ?? minimalState)();
  const p = minimalProfile();
  setup(s, p);
  return { s: deepFreeze(s), p: deepFreeze(p) };
};

describe('evaluate: every atom true and false', () => {
  for (const [key, cases] of Object.entries(CASES)) {
    test(key, () => {
      for (const c of cases) {
        c.t.forEach((setup, i) => {
          const { s, p } = prepared(c, setup);
          if (evaluate(c.cond, s, p, content) !== true) throw new Error(`${JSON.stringify(c.cond)} should be true (setup #${i})`);
        });
        c.f.forEach((setup, i) => {
          const { s, p } = prepared(c, setup);
          if (evaluate(c.cond, s, p, content) !== false) throw new Error(`${JSON.stringify(c.cond)} should be false (setup #${i})`);
        });
      }
    });
  }
});

describe('engine-maintained semantics', () => {
  test('killed.sinceStage subtracts the kill baseline recorded at stage entry (with a quest scope)', () => {
    const s = minimalState();
    s.counters.kills.cr_wildling_brute = 4;
    s.quests.q_clear_path = { ...quest('active'), counters: { 'kills:cr_wildling_brute': 3 } };
    deepFreeze(s);
    const one: Condition = { killed: { id: 'cr_wildling_brute', count: 1, sinceStage: true } };
    const two: Condition = { killed: { id: 'cr_wildling_brute', count: 2, sinceStage: true } };
    expect(evaluate(one, s, minimalProfile(), content, { questId: 'q_clear_path' })).toBe(true);
    expect(evaluate(two, s, minimalProfile(), content, { questId: 'q_clear_path' })).toBe(false);
    expect(evaluate(two, s, minimalProfile(), content)).toBe(true); // no scope: counts the whole loop
    expect(evaluate(two, s, minimalProfile(), content, { questId: 'q_unknown' })).toBe(true);
  });

  test('counter quests_completed counts completed quests whose countsForApex is not false', () => {
    const s = minimalState();
    s.quests.q_clear_path = quest('completed', 'done');
    s.quests.q_side_errand = quest('completed', 'go');
    s.quests.q_echoing_heartbeat = quest('active', 'listen');
    s.counters.custom.quests_completed = 99; // content cannot fake the engine counter
    expect(evaluate({ counter: { name: 'quests_completed', min: 1, max: 1 } }, s, minimalProfile(), content)).toBe(true);
  });

  test('counter factions_trusted counts factions at Trusted or Sworn', () => {
    const s = minimalState();
    s.reputation = { remnants: 19, weavers: 20, ironclad: 75 };
    expect(evaluate({ counter: { name: 'factions_trusted', min: 2, max: 2 } }, s, minimalProfile(), content)).toBe(true);
    s.reputation.remnants = 20;
    expect(evaluate({ counter: { name: 'factions_trusted', min: 3 } }, s, minimalProfile(), content)).toBe(true);
  });

  test('the D-048 Apex gate: Loop 1 by six quests, Loop 2+ also by echo_apex_resonance', () => {
    const gate: Condition = { any: [{ counter: { name: 'quests_completed', min: 6 } }, { echo: 'echo_apex_resonance' }] };
    const loop1 = minimalState();
    for (let i = 0; i < 5; i++) loop1.quests[`q_done_${i}`] = quest('completed', 'done');
    expect(evaluate(gate, loop1, minimalProfile(), content)).toBe(false);
    loop1.quests.q_done_5 = quest('completed', 'done');
    expect(evaluate(gate, loop1, minimalProfile(), content)).toBe(true);
    const loop2 = { ...minimalState(), meta: { ...minimalState().meta, loop: 2 } };
    expect(evaluate(gate, loop2, minimalProfile(), content)).toBe(false);
    expect(evaluate(gate, loop2, { ...minimalProfile(), echoes: ['echo_apex_resonance'] }, content)).toBe(true);
  });

  test('nested logic', () => {
    const s = deepFreeze({ ...minimalState(), flags: { flag_a: true } });
    const p = minimalProfile();
    expect(evaluate({ all: [] }, s, p, content)).toBe(true);
    expect(evaluate({ not: { all: [{ flag: 'flag_a' }, { not: { flag: 'flag_b' } }] } }, s, p, content)).toBe(false);
    expect(evaluate({ any: [{ all: [{ flag: 'flag_b' }] }, { not: { not: { flag: 'flag_a' } } }] }, s, p, content)).toBe(true);
  });

  test('a malformed (unparsed) condition is a programmer error', () => {
    expect(() => evaluate({} as Condition, minimalState(), minimalProfile(), content)).toThrow('exactly one key');
    expect(() => evaluate({ visited: 'loc_x' } as unknown as Condition, minimalState(), minimalProfile(), content)).toThrow(
      "unknown condition atom 'visited'",
    );
  });
});

describe('explain', () => {
  test('ok always equals evaluate, for every case', () => {
    for (const cases of Object.values(CASES)) {
      for (const c of cases) {
        for (const setup of [...c.t, ...c.f]) {
          const { s, p } = prepared(c, setup);
          const e = explain(c.cond, s, p, content);
          expect(e.ok).toBe(evaluate(c.cond, s, p, content));
          expect(e.parts.length).toBeGreaterThan(0);
          for (const part of e.parts) expect(part.text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('all is flattened into one part per child with names from content', () => {
    const s = minimalState();
    s.reputation.weavers = 5;
    s.player.inventory.push(item('item_chronos_lens'));
    const cond: Condition = {
      all: [
        { echo: 'echo_ilyra_watchword' },
        { all: [{ item: { id: 'item_chronos_lens' } }, { rep: { faction: 'weavers', min: 20 } }] },
        { loop: { min: 2 } },
      ],
    };
    expect(explain(cond, s, minimalProfile(), content)).toEqual({
      ok: false,
      parts: [
        { text: "Echo: Ilyra's Watchword", ok: false },
        { text: 'Carry Chronos Lens (have 1)', ok: true },
        { text: 'The Weavers reputation ≥ 20 (now 5)', ok: false },
        { text: 'Loop ≥ 2 (now 1)', ok: false },
      ],
    });
  });

  test('any / not are single parts; texts for the remaining atoms', () => {
    const s = minimalState();
    const p = minimalProfile();
    const text = (cond: Condition, scope = {}) => explain(cond, s, p, content, scope).parts.map((x) => x.text);
    expect(text({ any: [{ counter: { name: 'quests_completed', min: 6 } }, { echo: 'echo_apex_resonance' }] })).toEqual([
      'One of: Quests completed ≥ 6 (now 0) / Echo: Apex Resonance',
    ]);
    expect(text({ not: { flag: 'flag_ilyra_told' } })).toEqual(['Not (Flag flag_ilyra_told)']);
    expect(text({ not: { all: [{ flag: 'flag_a' }, { loop: { min: 2 } }] } })).toEqual(['Not (Flag flag_a and Loop ≥ 2 (now 1))']);
    expect(text({ quest: { id: 'q_clear_path' } })).toEqual(['Clear the Path: started']);
    expect(text({ quest: { id: 'q_clear_path', status: 'completed' } })).toEqual(['Clear the Path: completed']);
    expect(text({ quest: { id: 'q_x', stage: 'done', status: 'active' } })).toEqual(['q_x: at stage done (active)']);
    expect(text({ quest: { id: 'q_x', stage: 'done' } })).toEqual(['q_x: at stage done']);
    expect(text({ item: { id: 'mat_ember_ore', count: 3 } })).toEqual(['Carry 3 × Ember Ore (have 0)']);
    expect(text({ day: { min: 5, max: 9 } })).toEqual(['Day 5–9 (now 1)']);
    expect(text({ level: { min: 2, max: 2 } })).toEqual(['Level = 2 (now 1)']);
    expect(text({ watch: 'night' })).toEqual(['At night (now dawn)']);
    expect(text({ clock: { daysLeft: { max: 1 } } })).toEqual(['Dawns left ≤ 1 (now 29)']);
    expect(text({ beforeDay: 2 })).toEqual(['Silverwood Before, day 2']);
    expect(text({ beforeResets: { min: 3 } })).toEqual(['Silverwood Before resets ≥ 3']);
    expect(text({ class: 'wizard' })).toEqual(['Class: Wizard']);
    expect(text({ class: 'elf' })).toEqual(['Class: elf']);
    expect(text({ stat: { name: 'magic', min: 12 } })).toEqual(['Magic ≥ 12 (now 3)']);
    expect(text({ companion: { id: 'mireya' } })).toEqual(['Mireya in the party']);
    expect(text({ companion: { id: 'brak', state: 'recruited' } })).toEqual(['Brak recruited']);
    expect(text({ companion: { id: 'nyx', state: 'ko' } })).toEqual(['nyx knocked out']);
    expect(text({ companion: { id: 'brak', state: 'following' } })).toEqual(['Brak walking with you']);
    expect(text({ region: 'region_glowlands' })).toEqual(['In The Glowlands']);
    expect(text({ region: 'region_x' })).toEqual(['In region_x']);
    expect(text({ loyalty: { companion: 'mireya', min: 25 } })).toEqual(['Mireya loyalty ≥ 25']);
    expect(text({ corruption: { max: 5 } })).toEqual(['Corruption ≤ 5 (now 0)']);
    expect(text({ location: 'loc_heartstone_depths' })).toEqual(['At Heartstone Depths']);
    expect(text({ killed: { id: 'cr_wildling_brute', count: 1, sinceStage: true } }, { questId: 'q_clear_path' })).toEqual([
      'Defeat 1 × Wildling Brute (this stage) (0/1)',
    ]);
    expect(text({ killed: { id: 'cr_x' } })).toEqual(['Defeat 1 × cr_x (0/1)']);
    expect(text({ resolve: { min: 8 } })).toEqual(['Resolve ≥ 8 (communion only)']);
    expect(text({ modifier: 'mod_frayed_clock' })).toEqual(['Modifier: Frayed Clock']);
    expect(text({ infected: true })).toEqual(['Here, where the Horde has reached']);
    expect(text({ diedHere: true })).toEqual(['Here, where you last fell']);
    expect(text({ killed: { id: 'cr_x', anyLoop: true } })).toEqual(['Defeat 1 × cr_x (in any loop) (0/1)']);
    const loyal = { ...minimalState(), companions: { recruited: { mireya: comp('mireya', { loyalty: 30 }) }, activeId: null } };
    expect(explain({ loyalty: { companion: 'mireya', min: 25 } }, loyal, p, content).parts[0]!.text).toBe('Mireya loyalty ≥ 25 (now 30)');
    expect(explain({ resolve: { min: 8 } }, fullState(), p, content).parts[0]!.text).toBe('Resolve ≥ 8 (now 4)');
  });

  test('rangeText', () => {
    expect(rangeText({})).toBe('any');
    expect(rangeText({ min: 1 })).toBe('≥ 1');
    expect(rangeText({ max: 1 })).toBe('≤ 1');
    expect(rangeText({ min: 1, max: 4 })).toBe('1–4');
    expect(rangeText({ min: 4, max: 4 })).toBe('= 4');
  });
});
