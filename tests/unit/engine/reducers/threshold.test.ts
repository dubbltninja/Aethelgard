// U30: the loop's end — PLAN §8.1 row "loop reset & profile" (the parts before the Threshold screens, which are U31):
// `endLoop` writes the RunRecord, moves Echoes, pays Resonance (incl. +10 per closer), writes mastery and `bestLevel`;
// the reset per DESIGN §10.3 keeps the Amulet; Loop 1 closers → Loop 2 Day 1 with no Threshold; Loop 2+ → the
// Threshold; `loopCounter = max + 1` after loading an older run; a Loop 1 non-Horde death → title with Echoes kept —
// plus a full Loop 1 → Tyrant → Horde → portal → Loop 2 Day 1 run through `step`, the ending screens, *Let go*,
// *Keep the vigil*, `newGame` / `returnToTitle`, and legalActions agreement for every U30 action
// (DESIGN §10.2–10.3, §10.6, §14; STORY §4.2–4.3, §10.7; D-047, D-049, D-055, D-066 #7, D-067.2, D-067.14, D-075, D-078).
import { describe, expect, test } from 'bun:test';
import {
  AMULET_ITEM_ID,
  CLOSER_TEXT,
  ECHO_AMULET_MEMORY,
  ECHO_THIRTIETH_DAWN,
  FLAG_HORDE_ACTIVE,
  FLAG_LIBRARY_PORTAL_OPEN,
  HANDLERS,
  HORDE_TEXT,
  POST_STEP_HOOKS,
  RUN_HISTORY_CAP,
  apply,
  createStep,
  endingSlides,
  isLegal,
  legalActions,
  newRun,
  step,
  type Action,
  type ActionType,
  type CombatState,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
  type RunRecord,
  type StepFn,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { CONTAINED } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { hordePack } from '@tests/fixtures/hordeContent';
import { fixturePack } from '@tests/fixtures/miniContent';

const mini = fixturePack();
const pack = hordePack();
const RUINS = 'loc_whispering_ruins';
const LIBRARY = 'loc_shattered_library';
const PLAZA = 'loc_silverwood_plaza';
const GLOWLANDS = 'loc_veridian_glowlands';
const NEXUS = 'loc_chronos_nexus';
const APEX = 'loc_temporal_breach_apex';
const MARK = { statusId: 'status_mark', stacks: 1, duration: 3, sourceUid: null, appliedOnOwnTurn: false };

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
const logs = (events: readonly Ev[]) => ofType(events, 'log').map((e) => e.text);

interface Run {
  s: GameState;
  prof: Profile;
  last: Ev[];
  all: Ev[];
  pack: ContentPack;
  step: StepFn;
}
const start = (s: GameState, prof: Profile, p: ContentPack = mini, fn: StepFn = step): Run => ({ s, prof, last: [], all: [], pack: p, step: fn });
function act(r: Run, action: Action): Run {
  const out = r.step(r.s, action, r.pack, r.prof);
  const rejected = ofType(out.events, 'actionRejected')[0];
  if (rejected) throw new Error(`${JSON.stringify(action)} was rejected: ${rejected.reason}`);
  return { ...r, s: out.state, prof: out.profile, last: out.events, all: [...r.all, ...out.events] };
}
const run = (r: Run, actions: readonly Action[]): Run => actions.reduce(act, r);
function refused(r: Run, action: Action): string {
  const out = r.step(r.s, action, r.pack, r.prof);
  expect(out.state).toBe(r.s);
  return ofType(out.events, 'actionRejected')[0]?.reason ?? '(accepted)';
}
function patch(r: Run, fn: (s: GameState) => void): Run {
  const s = clone(r.s);
  fn(s);
  return { ...r, s };
}
const move = (to: string): Action => ({ type: 'move', to });
const ACK: Action = { type: 'acknowledgeEnding' };
/** Acknowledges every slide until the ending screen is left. */
function acknowledgeAll(r: Run): Run {
  let x = r;
  for (let i = 0; i < 20 && x.s.mode === 'ending'; i++) x = act(x, ACK);
  return x;
}
const lastRecord = (p: Profile): RunRecord => p.runHistory[p.runHistory.length - 1] as RunRecord;
/** A stand-in `wait` that applies `effects` (the effects run inside a step with every post-step hook). */
const withWait = (fn: Parameters<typeof apply>[0][]): StepFn =>
  createStep({ ...HANDLERS, wait: (ctx) => fn.forEach((e) => apply(e, ctx, { source: 'test' })) }, POST_STEP_HOOKS);

/** A Loop `loop` run at `at` whose profile is `prof`. */
function at(at: string, o: StateOverrides = {}, prof: Profile = freshProfile({ loopCounter: o.loop ?? 1 }), p: ContentPack = mini, fn: StepFn = step): Run {
  return start(makeState({ locationId: at, ...o }, { content: p, profile: prof }), prof, p, fn);
}

// ---- endLoop: the profile layer -----------------------------------------------------------------------------------------------

describe('endLoop writes the profile (DESIGN §10.3 step 2, §10.6; PLAN §4.6 rule 5)', () => {
  /** Loop 2 at the Library with the portal torn open on purpose, a record's worth of state. */
  function escapeLoop2(prof: Profile): Run {
    const r = at(
      LIBRARY,
      {
        loop: 2,
        level: 9,
        abilities: ['rgr_rend', 'itm_echo_bolt'],
        echoes: ['echo_tyrant_speaks'],
        quests: { q_echo_crystal: { status: 'completed', stage: 'crystal_found' } },
        flags: { [FLAG_LIBRARY_PORTAL_OPEN]: true },
        patch: (s) => void (s.world.discovered = [RUINS, LIBRARY, PLAZA]),
      },
      prof,
    );
    return act(r, { type: 'enterPortal' });
  }
  const before = (): Profile =>
    freshProfile({
      loopCounter: 2,
      codexUnlocked: ['codex_tyrant_holding'],
      discoveries: ['loc:loc_whispering_ruins'],
      classMastery: { ranger: { loopsPlayed: 1, mastered: ['rgr_marked_shot'], endings: [], bestLevel: 12, bestDays: null } },
    });

  test('a closer: the RunRecord, Echoes and map memory, Resonance (unpaid first discoveries + 10), mastery, loopCounter', () => {
    const r = escapeLoop2(before());
    const p = r.prof;
    const record: RunRecord = {
      runId: 'fixture:2',
      seed: 'fixture',
      loop: 2,
      classId: 'ranger',
      outcome: 'closer_escape',
      daysUsed: 1,
      level: 9,
      echoesGained: ['echo_tyrant_speaks'],
      questsCompleted: ['q_echo_crystal'],
      tyrant: 'untouched',
      heartstone: 'intact',
      modifiers: [],
      summary: 'Loop 2 · Ranger · Escape · Day 1',
    };
    expect(p.runHistory).toEqual([record]);
    expect(ofType(r.last, 'loopEnded')).toEqual([{ t: 'loopEnded', loop: 2, outcome: 'closer_escape', record }]);
    expect(p.echoes).toContain('echo_tyrant_speaks');
    expect(p.mapKnowledge).toEqual([RUINS, LIBRARY, PLAZA]);
    // the Ruins were paid before; the Library and the Plaza +2 each, the quest +5, the earlier codex entry +1, the closer +10
    expect(ofType(r.last, 'resonanceGained').map((e) => [e.reason, e.amount])).toEqual([
      ['locations', 4],
      ['quests', 5],
      ['codex', 1],
      ['closer_escape', 10],
    ]);
    expect([p.resonance, p.resonanceEarnedTotal]).toEqual([20, 20]);
    expect(p.discoveries).toEqual(['loc:loc_whispering_ruins', 'loc:loc_shattered_library', 'loc:loc_silverwood_plaza', 'quest:q_echo_crystal', 'codex:codex_tyrant_holding']);
    // D-078: this loop's class abilities are mastered (not the Amulet's), loops +1, best level kept at the max
    expect(p.classMastery.ranger).toEqual({ loopsPlayed: 2, mastered: ['rgr_marked_shot', 'rgr_rend'], endings: [], bestLevel: 12, bestDays: null });
    expect([p.lastClassId, p.loopCounter]).toEqual(['ranger', 3]);
    expect(ofType(r.last, 'endingSlide')).toEqual([{ t: 'endingSlide', endingId: 'closer_escape', index: 0, text: CLOSER_TEXT.lastThreshold }]);
  });

  test('a second loop pays nothing twice; *Let go* (released) pays no closer bonus (STORY §10.7)', () => {
    const first = escapeLoop2(before());
    const again = act(at(RUINS, { loop: 3, patch: (s) => void (s.world.discovered = [RUINS, LIBRARY]) }, first.prof), { type: 'letGo' });
    expect(ofType(again.last, 'resonanceGained')).toEqual([]);
    expect(lastRecord(again.prof)).toMatchObject({ loop: 3, outcome: 'closer_fall', reason: 'released', summary: 'Loop 3 · Ranger · Fall (released) · Day 1' });
    expect(again.prof.classMastery.ranger).toMatchObject({ loopsPlayed: 3, bestLevel: 12 });
    expect(again.prof.loopCounter).toBe(4);
  });

  test("U29's rejection, then leaving (D-081): closer_fall / rejected closes the loop like any closer (+10, the Echo in the record)", () => {
    const speak = (answerId: string): Action => ({ type: 'commune', act: 'speak', answerId });
    const r0 = at(NEXUS, { loop: 2, level: 18, echoes: ['echo_apex_resonance', 'echo_tyrant_speaks'] }, freshProfile({ loopCounter: 2 }));
    const rejected = run(r0, [move(APEX), { type: 'commune', act: 'toggle' }, speak('lie'), speak('lie_first_day')]);
    expect(ofType(rejected.all, 'communionRejected')).toEqual([{ t: 'communionRejected', reason: 'lies' }]);
    const left = act(rejected, { type: 'flee' });
    expect(left.s.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'rejected', slideIndex: 0 });
    expect(lastRecord(left.prof)).toMatchObject({ loop: 2, outcome: 'closer_fall', reason: 'rejected', tyrant: 'untouched', summary: 'Loop 2 · Ranger · Fall (rejected) · Day 1' });
    expect(lastRecord(left.prof).echoesGained).toContain('echo_tyrant_rejected');
    expect(ofType(left.last, 'resonanceGained').map((e) => e.reason)).toContain('closer_fall');
    expect(ofType(left.last, 'endingSlide')[0]?.text).toBe(CLOSER_TEXT.fall.rejected);
    expect(acknowledgeAll(left).s.mode).toBe('threshold');
  });

  test('loopCounter = max(profile, run) + 1: loading an older run never rewinds it (DESIGN §10.3 step 5)', () => {
    const r = act(at(RUINS, { loop: 2 }, freshProfile({ loopCounter: 5 })), { type: 'letGo' });
    expect(r.prof.loopCounter).toBe(6);
    const shore = acknowledgeAll(r);
    expect(shore.s.meta.loop).toBe(6);
    expect(act(at(RUINS, { loop: 7 }, freshProfile({ loopCounter: 2 })), { type: 'letGo' }).prof.loopCounter).toBe(8);
  });

  test('the run history keeps the last 200 records', () => {
    const old = (i: number): RunRecord => ({ ...lastRecord(escapeLoop2(before()).prof), runId: `old:${i}` });
    const full = freshProfile({ loopCounter: 2, runHistory: Array.from({ length: RUN_HISTORY_CAP }, (_, i) => old(i)) });
    const p = act(at(RUINS, { loop: 2 }, full), { type: 'letGo' }).prof;
    expect(p.runHistory).toHaveLength(RUN_HISTORY_CAP);
    expect(p.runHistory[0]?.runId).toBe('old:1');
    expect(lastRecord(p).outcome).toBe('closer_fall');
  });

  test('a true ending: endingReached, +50 the first time only, endingsReached, mastery endings and best days, echo_ending_f', () => {
    const fn = withWait([{ setFlag: 'flag_tyrant_spared' }, { ending: 'ending_unbound' }]);
    const prof = freshProfile({ loopCounter: 2 });
    const r = act(at(GLOWLANDS, { loop: 2, day: 4 }, prof, pack, fn), { type: 'wait' });
    expect(r.s.mode).toBe('ending');
    expect(r.s.pendingEnding).toEqual({ outcome: 'ending_unbound', slideIndex: 0 });
    expect(ofType(r.last, 'endingReached')).toEqual([{ t: 'endingReached', endingId: 'ending_unbound' }]);
    expect(r.s.echoesThisLoop).toContain('echo_ending_f');
    const p = r.prof;
    expect(lastRecord(p)).toMatchObject({ outcome: 'ending_unbound', tyrant: 'untouched', summary: 'Loop 2 · Ranger · The Unbound · Day 4' });
    expect(lastRecord(p).echoesGained).toContain('echo_ending_f');
    expect(lastRecord(p)).not.toHaveProperty('reason');
    expect(ofType(r.last, 'resonanceGained').map((e) => [e.reason, e.amount])).toEqual([['locations', 4], ['ending_unbound', 50]]); // the Ruins and the Glowlands
    expect(p.endingsReached).toEqual(['ending_unbound']);
    expect(p.classMastery.ranger).toMatchObject({ endings: ['ending_unbound'], bestDays: 4 });
    const twice = act(at(GLOWLANDS, { loop: 3, day: 9 }, p, pack, fn), { type: 'wait' });
    expect(ofType(twice.last, 'resonanceGained')).toEqual([]);
    expect(twice.prof.classMastery.ranger).toMatchObject({ endings: ['ending_unbound'], bestDays: 4 });
    expect(twice.prof.endingsReached).toEqual(['ending_unbound']);
  });

  test('the loop closes once, after every effect of the step (an Echo granted beside the ending is in the record)', () => {
    const fn = withWait([{ ending: 'ending_unbound' }, { grantEcho: 'echo_tyrant_name' }]);
    const r = act(at(GLOWLANDS, { loop: 2 }, freshProfile({ loopCounter: 2 }), pack, fn), { type: 'wait' });
    expect(lastRecord(r.prof).echoesGained).toEqual(['echo_tyrant_name', 'echo_ending_f']);
    expect(ofType(r.last, 'loopEnded')).toHaveLength(1);
  });
});

// ---- the ending screens and the next loop --------------------------------------------------------------------------------------

describe('the ending screens: acknowledgeEnding steps through the slides, then the next loop (DESIGN §10.3 step 4)', () => {
  test('a record: its sequence then the epilogues; a closer without one: STORY §4.2 / §10.7 lines', () => {
    const fn = withWait([{ ending: 'ending_unbound' }]);
    const r = act(at(GLOWLANDS, { loop: 2 }, freshProfile({ loopCounter: 2 }), pack, fn), { type: 'wait' });
    const def = pack.endings.ending_unbound!;
    const slides = [...def.sequence.map((x) => x.text), ...def.epilogues.map((x) => x.text)];
    expect(endingSlides(r.s, pack, r.prof)).toEqual(slides);
    const steps = run(r, [ACK, ACK, ACK, ACK]);
    expect(ofType(steps.all, 'endingSlide').map((e) => [e.index, e.text])).toEqual(slides.map((text, i) => [i, text]));
    expect(steps.s.mode).toBe('ending');
    expect(act(steps, ACK).s.mode).toBe('threshold');

    const fall = (o: StateOverrides, reason: 'death' | 'expiry' | 'rejected' | 'released') =>
      endingSlides(makeState({ mode: 'ending', ...o, patch: (s) => { o.patch?.(s); s.pendingEnding = { outcome: 'closer_fall', reason, slideIndex: 0 }; } }), mini, freshProfile());
    expect(fall({}, 'death')).toEqual([CLOSER_TEXT.fall.death, CLOSER_TEXT.shear]);
    expect(fall({}, 'released')).toEqual([CLOSER_TEXT.fall.released, CLOSER_TEXT.shear]);
    expect(fall({}, 'rejected')[0]).toBe(CLOSER_TEXT.fall.rejected);
    expect(fall({ patch: (s) => void (s.clock.expired = true) }, 'expiry')).toEqual([HORDE_TEXT.expiry, `${CLOSER_TEXT.shear} ${CLOSER_TEXT.shearUntouched}`]);
    expect(endingSlides(makeState(), mini, freshProfile())).toEqual([]);
  });

  test('Loop 2+ → the Threshold: the next loop reset and waiting at the Still Shore, with what brought the Wayfinder there', () => {
    const r = act(at(RUINS, { loop: 2, level: 6, gold: 500, items: ['item_chronos_lens'], flags: { flag_x: true } }, freshProfile({ loopCounter: 2 })), { type: 'letGo' });
    expect(r.s.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'released', slideIndex: 0 });
    const shore = acknowledgeAll(r);
    const s = shore.s;
    expect(s.mode).toBe('threshold');
    expect(s.threshold).toEqual({ visited: ['still_shore'], spentThisVisit: 0, pendingClassId: null });
    expect(s.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'released', slideIndex: 1 });
    expect(ofType(shore.last, 'thresholdEntered')).toEqual([{ t: 'thresholdEntered', area: 'still_shore' }]);
    expect(ofType(shore.last, 'modeChanged')).toEqual([{ t: 'modeChanged', from: 'ending', to: 'threshold' }]);
    expect(ofType(shore.last, 'loopStarted')).toEqual([]); // U31's Far Light starts the loop
    expect(s.meta).toMatchObject({ loop: 3, seed: 'fixture:3', runId: 'fixture:3:3' });
    expect(s.player.inventory.map((i) => i.itemId).sort()).toEqual([AMULET_ITEM_ID, 'item_ley_touched_tonic']); // the Lens is gone, the Amulet stays
    expect(s.player.equipment.weapon?.itemId).toBe('item_rusty_dagger');
    expect(s.player.gold).toBe(30);
    expect(s.flags).toEqual({});
  });

  test('legal: acknowledgeEnding only on an ending screen with something pending', () => {
    const r = act(at(RUINS, { loop: 2 }, freshProfile({ loopCounter: 2 })), { type: 'letGo' });
    expect(legalActions(r.s, mini, r.prof).map((a) => a.type)).toEqual(['acknowledgeEnding', 'returnToTitle']);
    const empty = patch(r, (s) => void (s.pendingEnding = null));
    expect(refused(empty, ACK)).toBe('there is nothing to acknowledge');
    expect(legalActions(empty.s, mini, empty.prof).map((a) => a.type)).toEqual(['returnToTitle']);
  });
});

// ---- Loop 1 → Loop 2 -----------------------------------------------------------------------------------------------------------

describe('Loop 1 closers lead straight to Loop 2 Day 1, no Threshold (D-049, D-066 #7)', () => {
  test('a full Loop 1 through step: Face it → the Contained Tyrant falls → Brak holds → the Horde → the portal → Loop 2 Day 1', () => {
    const prof0 = freshProfile();
    const s0 = makeState(
      {
        level: 13,
        locationId: NEXUS,
        gold: 240,
        items: ['item_chronos_lens', 'item_glow_moss'],
        quests: { q_echo_crystal: { status: 'completed', stage: 'crystal_found' } },
        patch: (s) => {
          for (const q of ['q_clear_path', 'q_blighted_outpost']) s.quests[q] = { status: 'completed', stage: 'done', startedDay: 1, endedDay: 2, counters: {}, objectivesDone: [] };
          s.player.inventory.push({ uid: 'i900', itemId: AMULET_ITEM_ID, qty: 1, rarity: 'common', affixes: [] }); // picked up in the Ruins
          s.clock.ticks = 85; // Day 22, Day watch (WORLD §10.8 route T1)
        },
      },
      { content: pack, profile: prof0 },
    );
    let r = start(s0, prof0, pack);
    r = run(r, [move(APEX)]);
    expect(r.s.mode).toBe('dialogue'); // Face it / Not yet (D-067.1)
    r = act(r, { type: 'choose', choiceId: 'face_it' });
    expect(r.s.combat?.enemies[0]?.refId).toBe(CONTAINED);
    r = patch(r, (s) => {
      const t = (s.combat as CombatState).enemies[0]!;
      t.hp = 1;
      t.statuses.push({ ...MARK });
    });
    r = act(r, { type: 'attack', targetUid: (r.s.combat as CombatState).enemies[0]!.uid });
    expect(r.s.world).toMatchObject({ tyrant: 'defeated', hordeActive: true, hordeCause: 'tyrant', hordeDelay: 1, infected: [APEX] });
    expect(logs(r.last)).toContain(HORDE_TEXT.brakArrives);
    // the escape: Apex → Nexus (the delay) → Glowlands → Plaza → Library, ahead of the spread
    r = run(r, [move(NEXUS), move(GLOWLANDS), move(PLAZA), move(LIBRARY)]);
    expect(r.s.world.infected).toEqual([APEX, NEXUS, GLOWLANDS, RUINS, PLAZA, LIBRARY, 'loc_mistwood_path']);
    expect(logs(r.all).some((line) => line.startsWith('The temporal collapse lashes out'))).toBe(false); // never lashed: the route stays ahead
    expect(ofType(r.all, 'autosaveCheckpoint').filter((e) => e.reason === 'locationEntered')).toEqual([]); // no autosave in a Horde
    expect(logs(r.all)).toContain(HORDE_TEXT.ilyraAtPortal);
    r = act(r, { type: 'enterPortal' });
    expect(r.s.mode).toBe('ending');
    const record = lastRecord(r.prof);
    expect(record).toMatchObject({ loop: 1, outcome: 'closer_escape', tyrant: 'defeated', level: 13, daysUsed: 23 });
    expect(record.echoesGained).toEqual(['echo_apex_resonance', 'echo_brak_death', 'echo_horde_path']);
    expect(r.prof.classMastery.ranger).toMatchObject({ loopsPlayed: 1, bestLevel: 13 });
    expect(r.prof.loopCounter).toBe(2);
    expect(r.prof.bestiary[CONTAINED]?.killed).toBe(1);

    const woke = acknowledgeAll(r);
    const s = woke.s;
    expect(s.mode).toBe('explore');
    expect(ofType(woke.last, 'modeChanged')).toEqual([{ t: 'modeChanged', from: 'ending', to: 'explore' }]);
    expect(ofType(woke.last, 'thresholdEntered')).toEqual([]);
    expect(ofType(woke.last, 'loopStarted')).toEqual([{ t: 'loopStarted', loop: 2, classId: 'ranger' }]);
    expect(ofType(woke.last, 'locationEntered')).toEqual([{ t: 'locationEntered', locationId: RUINS, firstVisit: true, regionId: 'region_silverwood_ruins' }]);
    expect(logs(woke.last)).toContain(CLOSER_TEXT.amuletWarm);
    expect(ofType(woke.last, 'autosaveCheckpoint')).toEqual([{ t: 'autosaveCheckpoint', reason: 'locationEntered' }]); // a loop transition
    // DESIGN §10.3 step 3: exactly a fresh Loop 2 — carry-over level ⌊0.6 × 13⌋ = 7, the Amulet on the Wayfinder (once)
    const fresh = newRun('fixture:2', 'ranger', pack, woke.prof, { playerName: 'Wayfinder' });
    const noMaxima = (p: GameState['player']) => ({ ...p, hp: 0, hpMax: 0, mp: 0, mpMax: 0 }); // the Amulet's +1 MAG syncs max MP (U21)
    expect(noMaxima(s.player)).toEqual(noMaxima(fresh.player));
    expect([s.player.hp, s.player.mp]).toEqual([s.player.hpMax, s.player.mpMax]);
    expect(s.player.level).toBe(7);
    expect(s.player.inventory.filter((i) => i.itemId === AMULET_ITEM_ID)).toHaveLength(1);
    expect(s.player.gold).toBe(30);
    expect(s.clock).toEqual({ ticks: 0, limitTicks: 116, modifiers: [], frozen: false, expired: false });
    expect([s.quests, s.flags, s.reputation, s.companions, s.merchants, s.combat]).toEqual([{}, {}, fresh.reputation, { recruited: {}, activeId: null }, {}, null]);
    expect(s.world).toMatchObject({ currentLocationId: RUINS, hordeActive: false, infected: [], npcOverrides: {}, tyrant: 'waiting', heartstone: 'intact' });
    expect(s.meta).toMatchObject({ loop: 2, seed: 'fixture:2', runId: 'fixture:2:2' });
    expect(s.rng).not.toEqual(r.s.rng);
    expect(s.echoesThisLoop).toEqual([ECHO_AMULET_MEMORY]); // STORY §12: "wake in Loop 2"
    expect(woke.prof.echoes).toEqual(['echo_apex_resonance', 'echo_brak_death', 'echo_horde_path', ECHO_AMULET_MEMORY]);
    expect(woke.prof.mapKnowledge).toEqual([RUINS, NEXUS, APEX, GLOWLANDS, PLAZA, LIBRARY]); // the start, then the road walked
  });

  test('a Loop 1 death in the expiry Horde: closer_fall / expiry, echo_thirtieth_dawn, then Loop 2 Day 1 (no FALLEN screen)', () => {
    const prof0 = freshProfile();
    const s0 = makeState(
      {
        locationId: GLOWLANDS,
        hp: 1,
        patch: (s) => {
          Object.assign(s.world, { hordeActive: true, hordeCause: 'expiry', hordeDelay: 0, infected: [APEX, NEXUS] });
          Object.assign(s.clock, { ticks: 118, expired: true });
          s.flags[FLAG_HORDE_ACTIVE] = true;
        },
      },
      { content: pack, profile: prof0 },
    );
    const dead = act(start(s0, prof0, pack), move(NEXUS));
    expect(dead.s.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'expiry', slideIndex: 0 });
    expect(lastRecord(dead.prof)).toMatchObject({ loop: 1, outcome: 'closer_fall', reason: 'expiry', echoesGained: [ECHO_THIRTIETH_DAWN] });
    expect(ofType(dead.last, 'endingSlide')[0]?.text).toBe(HORDE_TEXT.expiry);
    const woke = acknowledgeAll(dead);
    expect(woke.s.mode).toBe('explore');
    expect(woke.s.meta.loop).toBe(2);
    expect(woke.prof.echoes).toEqual([ECHO_THIRTIETH_DAWN, ECHO_AMULET_MEMORY]);
  });
});

// ---- the Loop 1 FALLEN screen ------------------------------------------------------------------------------------------------

describe('a Loop 1 death outside a Horde: FALLEN → title, the profile keeps its Echoes (D-049, D-075)', () => {
  test('returnToTitle is the acknowledgement; no loop end; a new game is Loop 1 again', () => {
    const fn = withWait([{ grantEcho: 'echo_tyrant_name' }]);
    let r = act(at(RUINS, { hp: 1 }, freshProfile(), mini, fn), { type: 'wait' });
    expect(r.prof.echoes).toEqual(['echo_tyrant_name']);
    r = { ...r, step }; // the real step from here
    r = act(r, move(LIBRARY)); // the two Shades
    for (let i = 0; i < 50 && r.s.combat?.phase !== 'defeat'; i++) r = act(r, { type: 'guard' });
    expect(r.s.mode).toBe('combat');
    expect(r.s.combat?.phase).toBe('defeat');
    expect(logs(r.last)).toContain('FALLEN');
    expect(legalActions(r.s, mini, r.prof)).toEqual([{ type: 'returnToTitle' }]);
    const title = act(r, { type: 'returnToTitle' });
    expect(title.s.mode).toBe('title');
    expect(title.s.combat).toBeNull();
    expect(ofType(title.last, 'modeChanged')).toEqual([{ t: 'modeChanged', from: 'combat', to: 'title' }]);
    expect(title.prof.echoes).toEqual(['echo_tyrant_name']);
    expect([title.prof.runHistory, title.prof.loopCounter, ofType(title.all, 'loopEnded')]).toEqual([[], 1, []]);
    expect(legalActions(title.s, mini, title.prof)).toEqual([
      { type: 'newGame', name: 'Wayfinder', classId: 'ranger' },
      { type: 'newGame', name: 'Wayfinder', classId: 'wizard' },
    ]);
    const again = act(title, { type: 'newGame', name: '  Tim ', classId: 'wizard' });
    expect(again.s.mode).toBe('explore');
    expect(again.s.meta).toMatchObject({ loop: 1, seed: 'fixture:1', playerName: 'Tim' });
    expect(again.s.player).toMatchObject({ classId: 'wizard', name: 'Tim', level: 1 });
    expect(ofType(again.last, 'loopStarted')).toEqual([{ t: 'loopStarted', loop: 1, classId: 'wizard' }]);
    expect(again.s.world.locationStates[RUINS]?.items.map((i) => i.itemId)).toEqual([AMULET_ITEM_ID]); // Loop 1: on the ground
    expect(again.s.echoesThisLoop).toEqual([]);
  });
});

// ---- the shell ---------------------------------------------------------------------------------------------------------------

describe('newGame and returnToTitle', () => {
  const title = (prof = freshProfile()) => start(makeState({ mode: 'title' }), prof);

  test('newGame: unknown class rejected; the name defaults; the seed defaults to profileId:loopCounter; a later loop wakes with the Amulet', () => {
    expect(refused(title(), { type: 'newGame', name: 'X', classId: 'bard' })).toBe("unknown class 'bard'");
    const plain = act(title(), { type: 'newGame', name: ' ', classId: 'ranger', seed: 'abc' });
    expect(act(title(), { type: 'newGame', name: 'W', classId: 'ranger', seed: '' }).s.meta.seed).toBe('fixture:1');
    expect(plain.s.meta).toMatchObject({ seed: 'abc', playerName: 'Wayfinder', loop: 1 });
    const later = act(title(freshProfile({ loopCounter: 4, echoes: [ECHO_AMULET_MEMORY] })), { type: 'newGame', name: 'W', classId: 'ranger' });
    expect(later.s.meta).toMatchObject({ seed: 'fixture:4', loop: 4 });
    expect(later.s.player.inventory.some((i) => i.itemId === AMULET_ITEM_ID)).toBe(true);
    expect(later.s.echoesThisLoop).toEqual([]); // already remembered
  });

  test('returnToTitle from explore, the Threshold and an ending screen; never mid-fight', () => {
    expect(act(at(RUINS), { type: 'returnToTitle' }).s.mode).toBe('title');
    expect(act(start(makeState({ mode: 'threshold' }), freshProfile()), { type: 'returnToTitle' }).s.mode).toBe('title');
    const ending = act(at(RUINS, { loop: 2 }, freshProfile({ loopCounter: 2 })), { type: 'letGo' });
    expect(act(ending, { type: 'returnToTitle' }).s.mode).toBe('title');
    const fight = act(at(RUINS), move(LIBRARY));
    expect(fight.s.mode).toBe('combat');
    expect(refused(fight, { type: 'returnToTitle' })).toBe('you cannot leave in the middle of a fight');
  });
});

// ---- the camp: Let go, Keep the vigil ------------------------------------------------------------------------------------------

describe('*Let go* and *Keep the vigil* at a camp from Loop 2 (DESIGN §10.2, D-067.14)', () => {
  test('Let go: closer_fall / released at once — not in Loop 1, away from a camp fire, or while a Horde runs', () => {
    const r = act(at(RUINS, { loop: 2 }, freshProfile({ loopCounter: 2 })), { type: 'letGo' });
    expect(r.s.mode).toBe('ending');
    expect(r.s.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'released', slideIndex: 0 });
    expect(refused(at(RUINS), { type: 'letGo' })).toBe('The Amulet is quiet. Not yet.');
    expect(refused(at(PLAZA, { loop: 2 }, freshProfile({ loopCounter: 2 })), { type: 'letGo' })).toBe('Only at a camp fire');
    const horde = at(RUINS, { loop: 2, patch: (s) => void (s.world.hordeActive = true) }, freshProfile({ loopCounter: 2 }));
    expect(refused(horde, { type: 'letGo' })).toBe('No time for that. You must run!');
  });

  test('Keep the vigil: the clock runs to the last dawn (daysLeft 1) through every dawn; not again, not frozen', () => {
    const r = act(at(RUINS, { loop: 2, day: 3 }, freshProfile({ loopCounter: 2 })), { type: 'keepVigil' });
    expect(r.s.clock.ticks).toBe(112);
    expect(r.s.clock.expired).toBe(false);
    expect(ofType(r.last, 'dayAdvanced').map((e) => e.day)).toEqual(Array.from({ length: 26 }, (_, i) => i + 4)); // Days 4 … 29
    expect(ofType(r.last, 'clockWarning')).toEqual([{ t: 'clockWarning', daysLeft: 1 }]);
    expect(logs(r.last)[0]).toBe(CLOSER_TEXT.vigil);
    expect(refused(r, { type: 'keepVigil' })).toBe('The last dawn is already here');
    expect(refused(at(RUINS, { loop: 2, patch: (s) => void (s.clock.frozen = true) }, freshProfile({ loopCounter: 2 })), { type: 'keepVigil' })).toBe('time does not pass here');
    expect(refused(at(RUINS), { type: 'keepVigil' })).toBe('The Amulet is quiet. Not yet.');
  });
});

// ---- legal / step agreement --------------------------------------------------------------------------------------------------

describe('legalActions agrees with step for every U30 action (PLAN §4.7)', () => {
  const U30: Action[] = [
    { type: 'letGo' },
    { type: 'keepVigil' },
    { type: 'enterPortal' },
    { type: 'acknowledgeEnding' },
    { type: 'returnToTitle' },
    { type: 'newGame', name: 'Wayfinder', classId: 'ranger' },
  ];
  const corpus = (): Run[] => {
    const loop2 = freshProfile({ loopCounter: 2 });
    return [
      at(RUINS),
      at(RUINS, { loop: 2 }, loop2),
      at(RUINS, { loop: 2, day: 29 }, loop2),
      at(PLAZA, { loop: 2 }, loop2),
      at(LIBRARY, { patch: (s) => void (s.world.hordeActive = true) }),
      act(at(RUINS, { loop: 2 }, loop2), { type: 'letGo' }),
      acknowledgeAll(act(at(RUINS, { loop: 2 }, loop2), { type: 'letGo' })),
      start(makeState({ mode: 'title' }), freshProfile()),
      act(at(RUINS), move(LIBRARY)),
    ];
  };
  test('isLegal ⇔ step accepts, for each state in the corpus', () => {
    const seen = new Set<ActionType>();
    for (const r of corpus()) {
      for (const a of U30) {
        if (!['explore', 'combat', 'ending', 'threshold', 'title'].includes(r.s.mode)) continue;
        const accepted = ofType(r.step(r.s, a, r.pack, r.prof).events, 'actionRejected').length === 0;
        expect({ a, mode: r.s.mode, legal: isLegal(r.s, a, r.pack, r.prof) }).toEqual({ a, mode: r.s.mode, legal: accepted });
        if (accepted) seen.add(a.type);
      }
    }
    expect([...seen].sort()).toEqual(['acknowledgeEnding', 'enterPortal', 'keepVigil', 'letGo', 'newGame', 'returnToTitle']);
  });
});
