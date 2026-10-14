// U33: the quest stage machine — PLAN §8.1 row "quests" (objectives sweep, optional/hidden, `advanceWhen`, branching
// `next` by condition, `outcome` complete/fail, rewards applied once, `timeLimitDays`, `startWhen` auto-start, shortcuts,
// journal events, counters), plus `failWhen`/`onFail`, `onEnter`/`onExit`, `killed.sinceStage`, once-per-profile and
// class quests, `acceptQuest`, and STORY §11.2's `q_echo_crystal` with its Give / Keep branch end to end through `step`.
// DESIGN §6.2, §13.1, §13.3; PLAN §4.6 rule 3, §5.9; STORY §11, §13; D-010, D-048, D-072.
import { describe, expect, test } from 'bun:test';
import {
  HANDLERS,
  POST_STEP_HOOKS,
  STAGE_DAY,
  applyAll,
  counterValue,
  createStep,
  isLegal,
  legalActions,
  questJournal,
  questStartProblem,
  step,
  type Action,
  type GameEvent,
  type GameState,
  type LocationState,
  type Profile,
} from '@engine/index';
import type { Effect } from '@schema/effect';
import { freshProfile, makeState, play, type PlayEntry, type StateOverrides } from '@tests/fixtures/helpers';
import {
  AUTO,
  CLASS_QUEST,
  CLEAR_PATH,
  CRYSTAL_QUEST,
  CRYSTAL_SCENE,
  GLOWLANDS,
  LEDGER,
  LIBRARY,
  ONCE,
  PLAZA,
  RUINS,
  TIMED,
  WEN,
  storyPack,
} from '@tests/fixtures/storyContent';

const pack = storyPack();

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
const sum = (events: readonly Ev[], t: 'xpGained' | 'goldChanged') =>
  ofType(events, t).reduce((n, e) => n + ('amount' in e ? e.amount : 'delta' in e ? e.delta : 0), 0);

/** A state on the story pack (Loop 1 unless told otherwise). */
const at = (o: StateOverrides = {}, profile?: Profile) => makeState(o, { content: pack, ...(profile ? { profile } : {}) });
const run = (s: GameState, script: readonly PlayEntry[], profile: Profile = freshProfile({ loopCounter: s.meta.loop })) => play(s, script, { content: pack, profile });

/** `wait` whose handler applies `effects` (a stand-in for whatever starts or moves a quest), with every post-step hook. */
const effectStep = (effects: readonly Effect[]) => createStep({ ...HANDLERS, wait: (ctx) => applyAll(effects, ctx) }, POST_STEP_HOOKS);
const WAIT: Action = { type: 'wait' };
function apply(s: GameState, effects: readonly Effect[], profile: Profile = freshProfile({ loopCounter: s.meta.loop })) {
  const out = effectStep(effects)(s, WAIT, pack, profile);
  const rejected = ofType(out.events, 'actionRejected')[0];
  if (rejected) throw new Error(`rejected: ${rejected.reason}`);
  return out;
}

/** The Library's fixed fight marked won (these tests walk past it). */
const libraryCleared = (s: GameState): void => {
  const ls: LocationState = {
    visited: false, visitCount: 0, items: [], itemsSpawned: false, encountersCleared: ['enc_library_shades'], encounterClearedDay: {},
    eventsFired: [], flags: {}, unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
  };
  s.world.locationStates[LIBRARY] = ls;
};

const stageOf = (s: GameState, id: string) => s.quests[id]?.stage;
const statusOf = (s: GameState, id: string) => s.quests[id]?.status ?? 'inactive';

describe("STORY §11.2 q_echo_crystal end to end (talk → accept → objectives → Ilyra's choice)", () => {
  /** Day 1 at the Ruins: accept from Ilyra, walk to the Library, take the Crystal, come back to her scene. */
  function toTheChoice(profile = freshProfile()) {
    const start = at({ locationId: RUINS, patch: libraryCleared }, profile);
    const accepted = run(start, [{ type: 'talk', npcId: 'npc_ilyra' }, { type: 'choose', choiceId: 'yes' }], profile);
    expect(accepted.state.mode).toBe('explore');
    expect(stageOf(accepted.state, CRYSTAL_QUEST)).toBe('reach_library');
    const library = run(accepted.state, [{ type: 'move', to: LIBRARY }], profile);
    expect(stageOf(library.state, CRYSTAL_QUEST)).toBe('take_crystal');
    expect(ofType(library.events, 'questObjective')).toEqual([{ t: 'questObjective', questId: CRYSTAL_QUEST, objectiveId: 'obj_library', done: true }]);
    const crystal = library.state.world.locationStates[LIBRARY]?.items.find((i) => i.itemId === 'item_echo_crystal');
    const taken = run(library.state, [{ type: 'take', uid: crystal!.uid }, { type: 'move', to: RUINS }], profile);
    expect(stageOf(taken.state, CRYSTAL_QUEST)).toBe('return');
    return { state: taken.state, events: [...accepted.events, ...library.events, ...taken.events], profile };
  }

  test('Give: Remnants +15, the Crystal handed over, 120 XP and 20 gold, the quest complete', () => {
    const { state, events } = toTheChoice();
    expect(ofType(events, 'questAdvanced').map((e) => e.stage)).toEqual(['reach_library', 'take_crystal', 'return']);
    const talk = run(state, [{ type: 'talk', npcId: 'npc_ilyra' }]);
    expect(talk.state.dialogue?.sceneId).toBe(CRYSTAL_SCENE); // priority 10 over the first meeting while at 'return'
    const gold = state.player.gold;
    const give = run(talk.state, [{ type: 'choose', choiceId: 'give' }]);
    expect(statusOf(give.state, CRYSTAL_QUEST)).toBe('completed');
    expect(stageOf(give.state, CRYSTAL_QUEST)).toBe('given');
    expect(give.state.reputation.remnants).toBe(15);
    expect(give.state.player.inventory.some((i) => i.itemId === 'item_echo_crystal')).toBe(false);
    expect(sum(give.events, 'xpGained')).toBe(120); // 60 on the Give stage + the 60 reward (DESIGN §6.2, legacy halving when kept)
    expect(give.state.player.gold).toBe(gold + 20);
    expect(give.state.echoesThisLoop).toContain('echo_crystal_location');
    expect(give.state.counters.questsCompleted).toBe(1);
    expect(counterValue(give.state, pack, 'quests_completed')).toBe(1);
    // the choice's effects, the sweep's branch (same step), the ending; the scene still reads "given" until continued
    expect(give.events.map((e) => e.t).filter((t) => t.startsWith('quest'))).toEqual(['questAdvanced', 'questCompleted']);
    const done = run(give.state, [{ type: 'continue' }, { type: 'continue' }]);
    expect(done.state.mode).toBe('explore');
    expect(done.state.flags.flag_scene_done_scene_echo_crystal).toBe(true);
    // rewards are paid once: later steps never pay again
    const later = run(done.state, [{ type: 'rest', kind: 'short' }]);
    expect(ofType(later.events, 'questCompleted')).toEqual([]);
    expect(later.state.player.gold).toBe(done.state.player.gold);
  });

  test('Keep: Weavers +10, Remnants −10, 60 XP; Loop 2+ the Crystal can be heard (verse 1 + nine voices)', () => {
    const { state } = toTheChoice();
    const keep = run(state, [{ type: 'talk', npcId: 'npc_ilyra' }, { type: 'choose', choiceId: 'keep' }]);
    expect(stageOf(keep.state, CRYSTAL_QUEST)).toBe('kept');
    expect(statusOf(keep.state, CRYSTAL_QUEST)).toBe('completed');
    expect(keep.state.reputation).toMatchObject({ remnants: -10, weavers: 10 });
    expect(sum(keep.events, 'xpGained')).toBe(60);
    expect(legalActions(keep.state, pack, freshProfile()).filter((a) => a.type === 'choose')).toEqual([{ type: 'choose', choiceId: 'leave' }]);
    // Loop 2: the node reads its variant and offers Listen
    const prof2 = freshProfile({ loopCounter: 2 });
    const loop2 = at({ loop: 2, locationId: RUINS, quests: { [CRYSTAL_QUEST]: 'return' }, items: ['item_echo_crystal'] }, prof2);
    const kept2 = run(loop2, [{ type: 'talk', npcId: 'npc_ilyra' }, { type: 'choose', choiceId: 'keep' }], prof2);
    expect(ofType(kept2.events, 'dialogueNode').at(-1)?.text).toMatch(/cold against the Amulet/);
    const heard = run(kept2.state, [{ type: 'choose', choiceId: 'listen' }], prof2);
    expect(heard.state.echoesThisLoop).toContain('echo_litany_verse_1');
    expect(heard.state.echoesThisLoop).toContain('echo_nine_voices');
    expect(heard.state.mode).toBe('explore');
  });

  test("the Echo shortcut (U32): with echo_crystal_location held the quest opens at 'take_crystal', its text logged", () => {
    const prof = freshProfile({ loopCounter: 2, echoes: ['echo_crystal_location'] });
    const s = at({ loop: 2, locationId: RUINS }, prof);
    const out = run(s, [{ type: 'talk', npcId: 'npc_ilyra' }, { type: 'choose', choiceId: 'yes' }], prof);
    expect(stageOf(out.state, CRYSTAL_QUEST)).toBe('take_crystal');
    expect(ofType(out.events, 'questAdvanced').map((e) => e.stage)).toEqual(['reach_library', 'take_crystal']);
    expect(ofType(out.events, 'log').map((e) => e.text)).toContain('Third alcove, behind the fallen shelf.');
    // the skipped stage's objective was never swept
    expect(ofType(out.events, 'questObjective')).toEqual([]);
  });
});

describe('the sweep: objectives, optional and hidden, onExit/onEnter, advanceWhen, branches, outcomes', () => {
  const started = (o: StateOverrides = {}) => apply(at({ locationId: GLOWLANDS, ...o }), [{ questStart: LEDGER }]);

  test('optional objectives never block; hidden ones show in the journal once done; latched objectives', () => {
    const out = started({ items: ['item_ley_touched_tonic'] });
    expect(stageOf(out.state, LEDGER)).toBe('gather');
    expect(ofType(out.events, 'questObjective').map((e) => e.objectiveId)).toEqual(['obj_tonic']);
    const entry = () => questJournal(out.state, pack).find((j) => j.questId === LEDGER)!;
    expect(entry().objectives).toEqual([
      { id: 'obj_moss', text: 'Find Glow Moss', done: false, optional: false },
      { id: 'obj_tonic', text: 'Bring a Tonic too', done: true, optional: true },
    ]);
    const secret = apply(out.state, [{ setFlag: 'flag_fixture_secret' }, { takeItem: { item: 'item_ley_touched_tonic' } }]);
    const journal = questJournal(secret.state, pack).find((j) => j.questId === LEDGER)!;
    expect(journal.objectives.map((o) => [o.id, o.done])).toEqual([
      ['obj_moss', false],
      ['obj_tonic', true], // latched for the stage even though the Tonic is gone
      ['obj_secret', true],
    ]);
    expect(stageOf(secret.state, LEDGER)).toBe('gather'); // the required one is still missing
  });

  test("the required objective done (a real `gather`): onExit, then the next stage's onEnter, questAdvanced with its journal", () => {
    const out = started();
    const moss = run(out.state, [{ type: 'gather' }]);
    expect(stageOf(moss.state, LEDGER)).toBe('deliver');
    expect(moss.state.flags.flag_fixture_left_gather).toBe(true);
    expect(moss.state.player.inventory.some((i) => i.itemId === 'item_chronal_dust')).toBe(true);
    expect(ofType(moss.events, 'questAdvanced')).toEqual([{ t: 'questAdvanced', questId: LEDGER, stage: 'deliver', journal: 'Fixture: deliver it — or burn it.' }]);
    expect(moss.state.quests[LEDGER]?.objectivesDone).toEqual([]); // a new stage starts over
    // history: the journal lists the stage passed
    expect(questJournal(moss.state, pack).find((j) => j.questId === LEDGER)?.history).toEqual([{ stage: 'gather', journal: 'Fixture: find Glow Moss; a Tonic would help.' }]);
  });

  const delivering = () => apply(at({ locationId: GLOWLANDS, quests: { [LEDGER]: 'deliver' } }), []).state;

  test('advanceWhen overrides the objectives; it waits while it fails', () => {
    const s = delivering();
    const nothing = apply(s, [{ setFlag: 'flag_unrelated' }]);
    expect(stageOf(nothing.state, LEDGER)).toBe('deliver');
  });

  test('branches: the first that holds wins (order matters), each to its own terminal stage', () => {
    const trusted = apply(delivering(), [{ rep: { faction: 'remnants', delta: 20 } }, { setFlag: 'flag_fixture_delivered' }]);
    expect(stageOf(trusted.state, LEDGER)).toBe('trusted');
    expect(trusted.state.flags.flag_fixture_trusted_end).toBe(true);
    const plain = apply(delivering(), [{ setFlag: 'flag_fixture_delivered' }]);
    expect(stageOf(plain.state, LEDGER)).toBe('plain');
    // burned is listed first: it wins over delivered + trusted
    const burned = apply(delivering(), [{ rep: { faction: 'remnants', delta: 20 } }, { setFlag: 'flag_fixture_delivered' }, { setFlag: 'flag_fixture_burned' }]);
    expect(stageOf(burned.state, LEDGER)).toBe('burned');
  });

  test("outcome 'complete' pays every reward once: XP, gold, items, rep, Echoes, Resonance; questCompleted, counters", () => {
    const s = delivering();
    const out = apply(s, [{ setFlag: 'flag_fixture_delivered' }]);
    expect(statusOf(out.state, LEDGER)).toBe('completed');
    expect(out.state.quests[LEDGER]?.endedDay).toBe(1);
    expect(sum(out.events, 'xpGained')).toBe(50);
    expect(out.state.player.gold).toBe(s.player.gold + 15);
    expect(out.state.player.inventory.filter((i) => i.itemId === 'item_mana_bloom').reduce((n, i) => n + i.qty, 0)).toBe(2);
    expect(out.state.reputation.remnants).toBe(5);
    expect(out.state.echoesThisLoop).toContain('echo_seven_wayfinders');
    expect(out.profile.resonance).toBe(3);
    expect(out.state.counters.questsCompleted).toBe(1);
    expect(ofType(out.events, 'questCompleted')).toEqual([{ t: 'questCompleted', questId: LEDGER }]);
    expect(ofType(out.events, 'autosaveCheckpoint')).toEqual([{ t: 'autosaveCheckpoint', reason: 'questCompleted' }]);
    // a second completion attempt is a no-op
    const again = apply(out.state, [{ questAdvance: { quest: LEDGER, stage: 'plain' } }], out.profile);
    expect(ofType(again.events, 'questCompleted')).toEqual([]);
    expect(again.profile.resonance).toBe(3);
  });

  test("outcome 'fail': questFailed, onFail, no rewards, counters.questsFailed", () => {
    const s = delivering();
    const out = apply(s, [{ setFlag: 'flag_fixture_burned' }]);
    expect(statusOf(out.state, LEDGER)).toBe('failed');
    expect(out.state.flags.flag_fixture_ledger_lost).toBe(true);
    expect(out.state.player.gold).toBe(s.player.gold);
    expect(out.state.counters.questsFailed).toBe(1);
    expect(ofType(out.events, 'questFailed')).toEqual([{ t: 'questFailed', questId: LEDGER }]);
    expect(questJournal(out.state, pack).map((j) => [j.questId, j.status])).toEqual([[LEDGER, 'failed']]);
  });

  test('a quest left active on an ending stage (a hand-built or old state) ends at the next sweep', () => {
    const out = apply(at({ locationId: GLOWLANDS, quests: { [LEDGER]: 'plain' } }), []);
    expect(statusOf(out.state, LEDGER)).toBe('completed');
    expect(statusOf(apply(at({ locationId: GLOWLANDS, quests: { [LEDGER]: 'burned' } }), []).state, LEDGER)).toBe('failed');
  });

  test('a stage without objectives and a plain `next` waits for a questAdvance (the dialogue report)', () => {
    const s = apply(at({ locationId: GLOWLANDS, quests: { [CLEAR_PATH]: 'report' } }), []).state;
    const later = apply(s, [{ setFlag: 'flag_whatever' }, { passWatches: 1 }]);
    expect(stageOf(later.state, CLEAR_PATH)).toBe('report');
    expect(stageOf(apply(later.state, [{ questAdvance: { quest: CLEAR_PATH, stage: 'done' } }]).state, CLEAR_PATH)).toBe('done');
  });

  test('sweeps run outside a fight only: a quest whose objective holds in combat waits for the fight to end', () => {
    const s = at({ locationId: GLOWLANDS, quests: { [TIMED]: 'hurry' }, mode: 'combat' });
    const ctxStep = createStep({ ...HANDLERS, guard: () => undefined }, POST_STEP_HOOKS);
    const out = ctxStep(s, { type: 'guard' }, pack, freshProfile());
    expect(stageOf(out.state, TIMED)).toBe('hurry');
  });
});

describe('kills since the stage began, failWhen, time limits, auto-starts', () => {
  test('killed.sinceStage (DESIGN §13.3 example 9): kills before the stage do not count', () => {
    const s = at({ locationId: PLAZA, patch: (x) => void (x.counters.kills = { cr_wildling_brute: 3 }) });
    const accepted = run(s, [{ type: 'talk', npcId: 'npc_brak' }, { type: 'choose', choiceId: 'accept' }]);
    expect(stageOf(accepted.state, CLEAR_PATH)).toBe('hunt');
    expect(accepted.state.quests[CLEAR_PATH]?.counters['kills:cr_wildling_brute']).toBe(3);
    const still = apply(accepted.state, []);
    expect(stageOf(still.state, CLEAR_PATH)).toBe('hunt');
    const killed = apply({ ...still.state, counters: { ...still.state.counters, kills: { cr_wildling_brute: 4 } } }, []);
    expect(stageOf(killed.state, CLEAR_PATH)).toBe('report');
    // the report: Brak's scene opens at 'report' (entry rule), its onEnter finishes the quest — Ironclad Mail, +10
    const reported = run({ ...killed.state, world: { ...killed.state.world, currentLocationId: PLAZA } }, [{ type: 'talk', npcId: 'npc_brak' }]);
    expect(reported.state.dialogue?.nodeId).toBe('report');
    expect(statusOf(reported.state, CLEAR_PATH)).toBe('completed');
    expect(reported.state.player.inventory.some((i) => i.itemId === 'item_ironclad_mail')).toBe(true);
    expect(reported.state.reputation.ironclad).toBe(10);
  });

  test('failWhen fails an active quest at once, with onFail', () => {
    const s = apply(at({ locationId: RUINS }), [{ questStart: TIMED }]).state;
    const out = apply(s, [{ setFlag: 'flag_fixture_doomed' }]);
    expect(statusOf(out.state, TIMED)).toBe('failed');
    expect(out.state.flags.flag_fixture_mourned).toBe(true);
  });

  test('timeLimitDays: after N days in a stage → onTimeoutTo; a stage with no onTimeoutTo fails; reaching in time completes', () => {
    const s = apply(at({ locationId: RUINS }), [{ questStart: TIMED }]).state;
    expect(s.quests[TIMED]?.counters[STAGE_DAY]).toBe(1);
    const day2 = run(s, [{ type: 'rest', kind: 'full' }]);
    expect(stageOf(day2.state, TIMED)).toBe('hurry');
    const day3 = run(day2.state, [{ type: 'rest', kind: 'full' }]);
    expect(stageOf(day3.state, TIMED)).toBe('late');
    expect(ofType(day3.events, 'log').map((e) => e.text)).toContain('The Fixture Errand: time has run out.');
    expect(day3.state.quests[TIMED]?.counters[STAGE_DAY]).toBe(3);
    const day4 = run(day3.state, [{ type: 'rest', kind: 'full' }]);
    expect(statusOf(day4.state, TIMED)).toBe('failed');
    expect(day4.state.flags.flag_fixture_mourned).toBe(true);
    // in time: the objective completes the quest before the deadline is read
    const inTime = apply({ ...day3.state, world: { ...day3.state.world, currentLocationId: GLOWLANDS } }, []);
    expect(statusOf(inTime.state, TIMED)).toBe('completed');
  });

  test('startWhen auto-starts a quest once it holds (legacy q_echoing_heartbeat shape), once', () => {
    const s = at({ locationId: GLOWLANDS, flags: { flag_fixture_hum: true } });
    expect(statusOf(apply(s, []).state, AUTO)).toBe('inactive');
    const done = apply(at({ locationId: GLOWLANDS, flags: { flag_fixture_hum: true }, quests: { [LEDGER]: 'deliver' } }), [{ setFlag: 'flag_fixture_delivered' }]);
    expect(statusOf(done.state, AUTO)).toBe('active');
    expect(ofType(done.events, 'questStarted').map((e) => e.questId)).toEqual([AUTO]);
    // countsForApex false: it does not count toward quests_completed when it completes
    const heard = run({ ...done.state, world: { ...done.state.world, currentLocationId: RUINS } }, [{ type: 'rest', kind: 'short' }], done.profile);
    expect(statusOf(heard.state, AUTO)).toBe('completed');
    expect(counterValue(heard.state, pack, 'quests_completed')).toBe(1);
    expect(heard.state.counters.questsCompleted).toBe(2);
  });
});

describe('who may start a quest: acceptQuest, once per profile, class quests', () => {
  const talking = (o: StateOverrides = {}, profile = freshProfile()) => run(at({ locationId: GLOWLANDS, ...o }, profile), [{ type: 'talk', npcId: WEN }], profile).state;
  const accepts = (s: GameState, profile = freshProfile()) => legalActions(s, pack, profile).filter((a) => a.type === 'acceptQuest');

  test("acceptQuest: offered by the NPC spoken to when availableWhen holds; the scene stays open; legal ≡ accepted", () => {
    expect(accepts(talking())).toEqual([]);
    const s = talking({ flags: { flag_fixture_offer: true } });
    expect(accepts(s)).toEqual([{ type: 'acceptQuest', questId: ONCE }]);
    const out = run(s, [{ type: 'acceptQuest', questId: ONCE }]);
    expect(statusOf(out.state, ONCE)).toBe('active');
    expect(out.state.mode).toBe('dialogue');
    expect(accepts(out.state)).toEqual([]);
    const reason = step(out.state, { type: 'acceptQuest', questId: ONCE }, pack, freshProfile()).events[0];
    expect(reason).toMatchObject({ t: 'actionRejected', reason: 'The Fixture Reveal is already under way' });
    expect(isLegal(s, { type: 'acceptQuest', questId: CRYSTAL_QUEST }, pack, freshProfile())).toBe(false); // Ilyra's, not Wen's
    expect(step(s, { type: 'acceptQuest', questId: CRYSTAL_QUEST }, pack, freshProfile()).events[0]).toMatchObject({ reason: 'no one here offers Echoes in the Library' });
  });

  test('repeatablePerLoop false: once completed in an earlier loop it never starts again (record or paid Resonance)', () => {
    for (const prof of [freshProfile({ discoveries: [`quest:${ONCE}`] }), freshProfile({ runHistory: [{ runId: 'r1', seed: 's', loop: 1, classId: 'ranger', outcome: 'closer_escape', daysUsed: 3, level: 2, echoesGained: [], questsCompleted: [ONCE], tyrant: 'untouched', heartstone: 'intact', modifiers: [], summary: '' }] })]) {
      const s = talking({ flags: { flag_fixture_offer: true } }, prof);
      expect(accepts(s, prof)).toEqual([]);
      expect(questStartProblem(s, pack, prof, ONCE)).toBe('The Fixture Reveal was finished in an earlier loop');
      expect(statusOf(apply(at({ locationId: GLOWLANDS }, prof), [{ questStart: ONCE }], prof).state, ONCE)).toBe('inactive'); // so does the effect
    }
  });

  test("a class quest is offered only to its class", () => {
    expect(accepts(talking()).map((a) => (a as { questId: string }).questId)).not.toContain(CLASS_QUEST);
    expect(questStartProblem(at(), pack, freshProfile(), CLASS_QUEST)).toBe('The Fixture Lesson is not for your class');
    expect(accepts(talking({ classId: 'wizard' }))).toEqual([{ type: 'acceptQuest', questId: CLASS_QUEST }]);
    expect(questStartProblem(at(), pack, freshProfile(), 'q_nope')).toBe("there is no quest 'q_nope'");
  });
});

describe('the journal', () => {
  test('started quests only: active first, then completed, then failed; text, objectives, history, days', () => {
    const s = at({
      locationId: GLOWLANDS,
      quests: {
        [TIMED]: { status: 'failed', stage: 'late', endedDay: 4 },
        [LEDGER]: { status: 'completed', stage: 'plain', endedDay: 2 },
        [CRYSTAL_QUEST]: 'take_crystal',
      },
    });
    const journal = questJournal(s, pack);
    expect(journal.map((j) => [j.questId, j.status])).toEqual([
      [CRYSTAL_QUEST, 'active'],
      [LEDGER, 'completed'],
      [TIMED, 'failed'],
    ]);
    expect(journal[0]).toMatchObject({ name: 'Echoes in the Library', journal: 'The Crystal is in the third alcove, behind the fallen shelf.', startedDay: 1, endedDay: null });
    expect(journal[0]?.objectives).toEqual([{ id: 'obj_crystal', text: 'Take the Echo Crystal', done: false, optional: false }]);
    expect(journal[2]).toMatchObject({ endedDay: 4, objectives: [{ id: 'obj_glow_late', done: false }] });
    expect(questJournal(at(), pack)).toEqual([]);
  });

  test('objectives carry their map hint', () => {
    const s = at({ quests: { [CRYSTAL_QUEST]: 'reach_library' } });
    expect(questJournal(s, pack)[0]?.objectives[0]).toEqual({ id: 'obj_library', text: 'Reach the Shattered Library', done: false, optional: false, hintLocationId: LIBRARY });
  });
});
