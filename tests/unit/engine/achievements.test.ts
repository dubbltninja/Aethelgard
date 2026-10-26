// U81a (D-119): the achievement engine. Each of DESIGN §15.2's forty achievements is earned on a built state at its checkpoint
// — once, into `profile.achievements` with the loop and day, with the `achievementUnlocked` event the toast reads — and not
// on the same state without the fact it asks for. The 13 `tally_*` counters are written into the run's counters by the step.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import {
  FIGHT_MARK,
  TALLY_NAMES,
  achievementPostStep,
  checkpointsOf,
  derivedTallies,
  legalActions,
  makeCtx,
  step,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
  type RunRecord,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { loadScenario } from '@sim/scenarios';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';

const pack: ContentPack = buildContentPack();
const ids = (table: Record<string, unknown>): string[] => Object.keys(table);

interface Built {
  s: GameState;
  p: Profile;
  events?: GameEvent[];
  before?: GameState;
  action?: Action;
}

/** Runs the hook as `step` does at its end: a ctx over the built state, the step's events, then `achievementPostStep`. */
function hook(b: Built): { s: GameState; p: Profile; events: GameEvent[] } {
  const ctx = makeCtx(clone(b.s), b.p, pack);
  for (const e of b.events ?? []) ctx.emit(e);
  achievementPostStep(ctx, b.before ?? b.s, b.p, b.action);
  return { s: ctx.s, p: ctx.commit().profile, events: ctx.events };
}

const built = (o: StateOverrides = {}, p: Profile = freshProfile(), extra: Omit<Built, 's' | 'p'> = {}): Built => ({ s: makeState(o, { content: pack, profile: p }), p, ...extra });

const record = (outcome: RunRecord['outcome'], over: Partial<RunRecord> = {}): RunRecord => ({
  runId: 'r',
  seed: 's',
  loop: 1,
  classId: 'ranger',
  outcome,
  daysUsed: 20,
  level: 10,
  echoesGained: [],
  questsCompleted: [],
  tyrant: 'untouched',
  heartstone: 'untouched',
  modifiers: [],
  summary: '',
  ...over,
});
/** The step that closed a loop with `outcome` (mode 'ending'), its record in the run history as `closeLoop` leaves it. */
function loopClosed(outcome: RunRecord['outcome'], o: StateOverrides = {}, p: Profile = freshProfile()): Built {
  const r = record(outcome);
  const profile: Profile = { ...p, runHistory: [...p.runHistory, r] };
  return { s: makeState({ mode: 'ending', ...o }, { content: pack, profile }), p: profile, events: [{ t: 'loopEnded', loop: 1, outcome: outcome as Extract<GameEvent, { t: 'loopEnded' }>['outcome'], record: r }] };
}
const ENDING_OF: Record<string, string> = { a: 'ending_wardens_vigil', b: 'ending_mending', c: 'ending_weavers_dawn', d: 'ending_iron_silence', e: 'ending_long_archive', f: 'ending_unbound' };
const endingReached = (letter: keyof typeof ENDING_OF, o: StateOverrides = {}, p: Profile = freshProfile()): Built =>
  loopClosed(ENDING_OF[letter] as RunRecord['outcome'], o, { ...p, echoes: [...p.echoes, `echo_ending_${letter}`] });

const SIX_QUESTS = ['q_echo_crystal', 'q_lost_scroll', 'q_echoing_heartbeat', 'q_clear_path', 'q_blighted_outpost', 'q_blood_and_salt'];
const completed = (questIds: readonly string[]): StateOverrides['quests'] =>
  Object.fromEntries(questIds.map((id) => [id, { status: 'completed' as const, stage: pack.quests[id]!.stages.find((st) => st.outcome === 'complete')!.id }]));
const capstones = (classId: string): string[] => (pack.index.abilitiesByClass[classId] ?? []).filter((id) => pack.abilities[id]?.tier === 5);
const recruited = (companion: string, loyalty: number) => (s: GameState): void => {
  s.companions.recruited[companion] = { id: companion, recruited: true, loyalty, hp: 50, hpMax: 50, ko: false, dead: false, stance: 'aggressive', cooldowns: {}, waitingAt: null, arcFlags: {} };
};
const withModifiers = (...mods: string[]) => (s: GameState): void => {
  s.meta.modifiers = mods;
};
const boss = 'cr_lantern_matron';
const started = (): GameEvent => ({ t: 'combatStarted', encounterId: 'enc_hall_matron', enemies: [{ uid: 'c9', creatureId: boss }], ambush: false });
const ended = (result: 'victory' | 'defeat' | 'fled' = 'victory'): GameEvent => ({ t: 'combatEnded', result, rounds: 9, xp: 0, gold: 0, loot: [] });
const commune = (resolve: number): Built => {
  const { state, profile } = loadScenario('communion_movement_2', pack);
  const s = clone(state);
  if (s.combat?.communion != null) s.combat.communion.resolve = resolve;
  return { s, p: profile };
};

/**
 * Per achievement: the built step that earns it, and the same step without the fact (null where "without" is the earn case's
 * own negation, e.g. the ending Echo missing).
 */
const CASES: Record<string, { earn: () => Built; miss: () => Built }> = {
  ach_first_steps: { earn: () => built({ locationId: 'loc_mistwood_path' }), miss: () => built({ locationId: 'loc_whispering_ruins' }) },
  ach_echo_in_the_library: { earn: () => built({ quests: completed(['q_echo_crystal']) }), miss: () => built({ quests: { q_echo_crystal: 'return' } }) },
  ach_six_quests: { earn: () => built({ quests: completed(SIX_QUESTS) }), miss: () => built({ quests: completed(SIX_QUESTS.slice(0, 5)) }) },
  ach_the_escape: { earn: () => loopClosed('closer_escape'), miss: () => loopClosed('closer_fall') },
  ach_the_fall: { earn: () => built({ flags: { flag_clock_expired: true } }), miss: () => built() },
  ach_loop_two: { earn: () => built({ loop: 2 }), miss: () => built({ loop: 1 }) },
  ach_i_know_what_you_are: {
    earn: () => built({ loop: 2, echoes: ['echo_nyx_is_of_the_nine'], flags: { flag_named_nyx: true } }),
    miss: () => built({ loop: 2, echoes: ['echo_nyx_is_of_the_nine'] }),
  },
  ach_brak_lives: {
    earn: () => loopClosed('closer_escape', { flags: { flag_tyrant_dead: true }, echoes: ['echo_brak_lives'] }),
    miss: () => loopClosed('closer_escape', { flags: { flag_tyrant_dead: true } }),
  },
  ach_two_brothers: { earn: () => built({ quests: completed(['q_blood_and_salt']) }), miss: () => built() },
  ach_vigil: { earn: () => endingReached('a'), miss: () => loopClosed('closer_escape') },
  ach_mending: { earn: () => endingReached('b'), miss: () => loopClosed('closer_escape') },
  ach_weavers_dawn: { earn: () => endingReached('c'), miss: () => loopClosed('closer_escape') },
  ach_iron_silence: { earn: () => endingReached('d'), miss: () => loopClosed('closer_escape') },
  ach_long_archive: { earn: () => endingReached('e'), miss: () => loopClosed('closer_escape') },
  ach_unbound: { earn: () => endingReached('f'), miss: () => loopClosed('closer_escape') },
  ach_all_endings: {
    earn: () => endingReached('f', {}, freshProfile({ echoes: ['echo_ending_a', 'echo_ending_b', 'echo_ending_c', 'echo_ending_d', 'echo_ending_e'] })),
    miss: () => endingReached('f', {}, freshProfile({ echoes: ['echo_ending_a', 'echo_ending_b', 'echo_ending_c', 'echo_ending_d'] })),
  },
  ach_commune: { earn: () => commune(8), miss: () => commune(7) },
  ach_speedrun: { earn: () => endingReached('a', { day: 10 }), miss: () => endingReached('a', { day: 11 }) },
  ach_untouched: {
    // the fight began with 5 damage taken this loop, and ended with 5: untouched (the start's step marked it)
    earn: () => {
      const b = built({ patch: (s) => (s.counters.damageTaken = 5) });
      const first = hook({ ...b, events: [started()] });
      return { s: first.s, p: first.p, events: [ended()] };
    },
    miss: () => {
      const b = built({ patch: (s) => (s.counters.damageTaken = 5) });
      const first = hook({ ...b, events: [started()] });
      first.s.counters.damageTaken = 12;
      return { s: first.s, p: first.p, events: [ended()] };
    },
  },
  ach_sworn_remnant: { earn: () => built({ reputation: { remnants: 60 } }), miss: () => built({ reputation: { remnants: 59 } }) },
  ach_sworn_weaver: { earn: () => built({ reputation: { weavers: 60 } }), miss: () => built({ reputation: { weavers: 59 } }) },
  ach_sworn_ironclad: { earn: () => built({ reputation: { ironclad: 60 } }), miss: () => built({ reputation: { ironclad: 59 } }) },
  ach_two_oaths: { earn: () => built({ reputation: { remnants: 60, ironclad: 60 } }), miss: () => built({ reputation: { remnants: 60, ironclad: 59 } }) },
  ach_mastery_any: {
    earn: () => loopClosed('closer_escape', {}, freshProfile({ classMastery: { ranger: { loopsPlayed: 3, mastered: (pack.index.abilitiesByClass['ranger'] ?? []).slice(0, 15), endings: [], bestLevel: 20, bestDays: null } } })),
    miss: () => loopClosed('closer_escape', {}, freshProfile({ classMastery: { ranger: { loopsPlayed: 3, mastered: (pack.index.abilitiesByClass['ranger'] ?? []).slice(0, 14), endings: [], bestLevel: 20, bestDays: null } } })),
  },
  ach_five_classes: {
    earn: () => loopClosed('closer_escape', {}, freshProfile({ classMastery: Object.fromEntries(ids(pack.classes).map((c) => [c, { loopsPlayed: 1, mastered: [], endings: [], bestLevel: 5, bestDays: null }])) })),
    miss: () => loopClosed('closer_escape', {}, freshProfile({ classMastery: Object.fromEntries(ids(pack.classes).slice(1).map((c) => [c, { loopsPlayed: 1, mastered: [], endings: [], bestLevel: 5, bestDays: null }])) })),
  },
  ach_capstone_trio: { earn: () => built({ abilities: capstones('ranger') }), miss: () => built({ abilities: capstones('ranger').slice(0, 2) }) },
  ach_bestiary_full: {
    earn: () => loopClosed('closer_escape', {}, freshProfile({ bestiary: Object.fromEntries(ids(pack.creatures).map((c) => [c, { seen: 1, killed: 0, spared: 0, revealed: 'none' as const, intentsSeen: [] }])) })),
    miss: () => loopClosed('closer_escape', {}, freshProfile({ bestiary: Object.fromEntries(ids(pack.creatures).slice(1).map((c) => [c, { seen: 1, killed: 0, spared: 0, revealed: 'none' as const, intentsSeen: [] }])) })),
  },
  ach_codex_full: {
    earn: () => loopClosed('closer_escape', {}, freshProfile({ codexUnlocked: ids(pack.codex) })),
    miss: () => loopClosed('closer_escape', {}, freshProfile({ codexUnlocked: ids(pack.codex).slice(1) })),
  },
  ach_all_echoes: {
    earn: () => loopClosed('closer_escape', {}, freshProfile({ echoes: ids(pack.echoes) })),
    miss: () => loopClosed('closer_escape', {}, freshProfile({ echoes: ids(pack.echoes).slice(1) })),
  },
  ach_cartographer: {
    earn: () => loopClosed('closer_escape', {}, freshProfile({ mapKnowledge: ids(pack.locations) })),
    miss: () => loopClosed('closer_escape', {}, freshProfile({ mapKnowledge: ids(pack.locations).filter((id) => id !== 'loc_temporal_breach_apex') })),
  },
  ach_legendary: {
    earn: () => built({ items: [{ itemId: 'item_warriors_sword', rarity: 'legendary' }] }),
    miss: () => built({ items: [{ itemId: 'item_warriors_sword', rarity: 'epic' }] }),
  },
  ach_breach_anchor: { earn: () => built({ items: ['item_breach_anchor'] }), miss: () => built() },
  ach_voidforged: {
    earn: () => {
      const before = makeState({}, { content: pack });
      return { s: makeState({ items: ['item_voidforged_edge'], patch: (s) => (s.counters.itemsCrafted = 1) }, { content: pack }), p: freshProfile(), before, action: { type: 'craft', recipeId: 'recipe_voidforged_edge' } };
    },
    miss: () => {
      const before = makeState({}, { content: pack });
      return { s: makeState({ items: ['item_breach_anchor'], patch: (s) => (s.counters.itemsCrafted = 1) }, { content: pack }), p: freshProfile(), before, action: { type: 'craft', recipeId: 'recipe_breach_anchor' } };
    },
  },
  ach_corrupted: { earn: () => built({ corruption: 6 }), miss: () => built({ corruption: 5 }) },
  ach_cleansed: { earn: () => built({ flags: { flag_corruption_cleansed: true } }), miss: () => built() },
  ach_pacifist_loop: {
    earn: () => loopClosed('closer_escape', { patch: withModifiers('mod_pacifist') }),
    miss: () => loopClosed('closer_escape', { patch: (s) => { withModifiers('mod_pacifist')(s); s.counters.kills['cr_corrupted_shade'] = 1; } }),
  },
  ach_glass_boss: {
    earn: () => built({ flags: { flag_tyrant_dead: true }, patch: withModifiers('mod_glass') }, freshProfile(), { events: [ended()] }),
    miss: () => built({ flags: { flag_tyrant_dead: true } }, freshProfile(), { events: [ended()] }),
  },
  ach_iron_frayed: {
    earn: () => endingReached('a', { patch: withModifiers('mod_iron_loop', 'mod_frayed_clock') }),
    miss: () => endingReached('a', { patch: withModifiers('mod_iron_loop') }),
  },
  ach_bond_any: { earn: () => built({ patch: recruited('ilyra', 100) }), miss: () => built({ patch: recruited('ilyra', 99) }) },
  ach_ng_plus: { earn: () => built({}, freshProfile({ newGamePlus: 1 })), miss: () => built() },
};

describe('the forty achievements (DESIGN §15.2): each is earned on a built state at its checkpoint, and not without its fact', () => {
  test('one case per achievement of the pack, forty in all', () => {
    expect(Object.keys(CASES).sort()).toEqual(ids(pack.achievements).sort());
    expect(ids(pack.achievements)).toHaveLength(40);
  });

  for (const [id, c] of Object.entries(CASES)) {
    test(id, () => {
      const earn = hook(c.earn());
      expect([id, earn.p.achievements[id] !== undefined]).toEqual([id, true]);
      expect(earn.events.filter((e) => e.t === 'achievementUnlocked' && e.achievementId === id)).toHaveLength(1);
      expect(earn.p.achievements[id]).toEqual({ loop: earn.s.meta.loop, day: Math.floor(earn.s.clock.ticks / 4) + 1, runId: earn.s.meta.runId });
      const miss = hook(c.miss());
      expect([id, miss.p.achievements[id]]).toEqual([id, undefined]);
      // earned once: the same step again unlocks nothing more
      const again = hook({ ...c.earn(), p: earn.p });
      expect(again.events.filter((e) => e.t === 'achievementUnlocked' && e.achievementId === id)).toEqual([]);
    });
  }
});

describe('the tallies (D-119: the 13 `tally_*` counters, written in the step)', () => {
  test('the content reads exactly the thirteen tallies the engine writes', () => {
    const names = Object.values(pack.achievements).flatMap((a) => JSON.stringify(a?.when).match(/tally_[a-z_]+/g) ?? []);
    expect([...new Set(names)].sort()).toEqual([...TALLY_NAMES].sort());
    expect(TALLY_NAMES).toHaveLength(13);
  });

  test('a tally is stored in the run counters while it is not 0, and read back by `counter`', () => {
    const b = built({ abilities: capstones('ranger'), patch: (s) => (s.counters.kills['cr_corrupted_shade'] = 2) }, freshProfile({ newGamePlus: 2 }));
    const out = hook(b);
    expect(out.s.counters.custom).toMatchObject({ tally_capstones_held: 3, tally_kills: 2, tally_new_game_plus: 2 });
    expect('tally_closer_escape' in out.s.counters.custom).toBe(false);
    const derived = derivedTallies(b.s, b.p, pack);
    expect(derived.tally_capstones_held).toBe(3);
    expect(derived.tally_echoes_complete).toBe(0);
  });

  test('a boss fight fled or lost earns nothing; a fight without a boss leaves no mark', () => {
    const b = built();
    const first = hook({ ...b, events: [started()] });
    expect(first.s.counters.custom[FIGHT_MARK]).toBe(1);
    const fled = hook({ s: first.s, p: first.p, events: [ended('fled')] });
    expect(fled.s.counters.custom['tally_boss_untouched']).toBeUndefined();
    expect(fled.s.counters.custom[FIGHT_MARK]).toBeUndefined();
    const plain = hook({ ...b, events: [{ t: 'combatStarted', encounterId: 'x', enemies: [{ uid: 'c1', creatureId: 'cr_corrupted_shade' }], ambush: false }] });
    expect(plain.s.counters.custom[FIGHT_MARK]).toBeUndefined();
  });
});

describe('checkpoints', () => {
  test('nothing is checked on the title screen or at the Threshold', () => {
    const title = makeState({ mode: 'title', locationId: 'loc_mistwood_path' }, { content: pack });
    expect(checkpointsOf(title, []).size).toBe(0);
    expect(hook({ s: title, p: freshProfile() }).p.achievements).toEqual({});
  });

  test('a combat end, a dawn crossed, a loop closed, a true ending', () => {
    const s = makeState({ day: 3 }, { content: pack });
    const before = makeState({ day: 2, watch: 3 }, { content: pack });
    expect([...checkpointsOf(s, [ended()], before)].sort()).toEqual(['combat_end', 'day_end', 'step']);
    const closer = loopClosed('closer_fall');
    expect([...checkpointsOf(closer.s, closer.events ?? [])].sort()).toEqual(['loop_end', 'step']);
    const ending = endingReached('b');
    expect([...checkpointsOf(ending.s, ending.events ?? [])].sort()).toEqual(['ending', 'loop_end', 'step']);
  });

  test('an achievement whose checkpoint was not reached waits for it (the Escape at a plain step is not checked)', () => {
    const b = loopClosed('closer_escape');
    const out = hook({ ...b, events: [] });
    expect(out.p.achievements['ach_the_escape']).toBeUndefined();
  });
});

describe('through `step` (the hook is the last post-step hook)', () => {
  test('leaving the Ruins earns First Steps with the toast event; a second step does not repeat it', () => {
    const s = makeState({ locationId: 'loc_whispering_ruins' }, { content: pack });
    const p = freshProfile();
    const move = legalActions(s, pack, p).find((a) => a.type === 'move') as Action;
    const out = step(s, move, pack, p);
    expect(out.profile.achievements['ach_first_steps']).toMatchObject({ loop: 1, day: 1 });
    expect(out.events.filter((e) => e.t === 'achievementUnlocked').map((e) => (e as { achievementId: string }).achievementId)).toContain('ach_first_steps');
    const wait = legalActions(out.state, pack, out.profile).find((a) => a.type === 'move') as Action;
    const next = step(out.state, wait, pack, out.profile);
    expect(next.events.some((e) => e.t === 'achievementUnlocked' && e.achievementId === 'ach_first_steps')).toBe(false);
  });

  test('a new game at the Ruins earns nothing', () => {
    const title = makeState({ mode: 'title' }, { content: pack });
    const out = step(title, { type: 'newGame', classId: 'ranger', seed: 'ach' } as Action, pack, freshProfile());
    expect(out.events.filter((e) => e.t === 'achievementUnlocked')).toEqual([]);
  });
});
