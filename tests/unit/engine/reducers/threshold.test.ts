// U30: the loop's end — PLAN §8.1 row "loop reset & profile" (the parts before the Threshold screens, which are U31):
// `endLoop` writes the RunRecord, moves Echoes, pays Resonance (incl. +10 per closer), writes mastery and `bestLevel`;
// the reset per DESIGN §10.3 keeps the Amulet; Loop 1 closers → Loop 2 Day 1 with no Threshold; Loop 2+ → the
// Threshold; `loopCounter = max + 1` after loading an older run; a Loop 1 non-Horde death → title with Echoes kept —
// plus a full Loop 1 → Tyrant → Horde → portal → Loop 2 Day 1 run through `step`, the ending screens, *Let go*,
// *Keep the vigil*, `newGame` / `returnToTitle`, and legalActions agreement for every U30 action
// (DESIGN §10.2–10.3, §10.6, §14; STORY §4.2–4.3, §10.7; D-047, D-049, D-055, D-066 #7, D-067.2, D-067.14, D-075, D-078).
// U31 (below the U30 rows): the Threshold itself — arrival (the Still Shore, the autosave), the four places, the Loom's
// Attunements (buy, refund within the visit, equip cap 5) and modifier toggles (the next loop only), buy → equip → loop
// start → effect visible for every wired Attunement, the modifiers' effects and Resonance multiplier, the Far Light's
// class change with mastery, quests started at the Threshold kept, New Game+, and legal/step agreement for every U31
// action (DESIGN §10.6–10.9, §14.2, §15.1; D-011, D-012, D-021, D-067.15, D-082; PLAN §8.1).
// U34c (last): `talk` at the Threshold — Dask on the fixture's Still Shore, his scene, back to the Threshold (D-012, D-084).
import { describe, expect, test } from 'bun:test';
import {
  AMULET_ITEM_ID,
  CLOSER_TEXT,
  MULTIPLIER_REASON,
  REFUND_REASON,
  THRESHOLD_LOCATIONS,
  THRESHOLD_TEXT,
  derive,
  modifierDamageMult,
  syncMaxima,
  newGamePlusProfile,
  resonanceMultiplier,
  thresholdArea,
  thresholdLocationId,
  xpBonus,
  type ThresholdArea,
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
import { FIXTURE_VERSION, fixturePack } from '@tests/fixtures/miniContent';
import type { AttunementInput } from '@schema/attunement';
import { DASK_NPC, DASK_SHORE_SCENE, INN_COST, SHORE, thresholdPack, thresholdTables } from '@tests/fixtures/thresholdContent';
import { buildContentPack } from '@content/index';

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

// ==== U31: the Threshold ===========================================================================================================

const tp = thresholdPack();
const NGP: Action = { type: 'newGamePlus' };
const NEW_LOOP: Action = { type: 'newLoop' };
const go = (to: ThresholdArea): Action => ({ type: 'thresholdGo', to });
const buy = (attunementId: string): Action => ({ type: 'thresholdSpend', attunementId });
const unbuy = (attunementId: string): Action => ({ type: 'thresholdRefund', attunementId });
const equip = (attunementId: string, on = true): Action => ({ type: 'equipAttunement', attunementId, on });
const toggle = (modifierId: string): Action => ({ type: 'toggleModifier', modifierId });
const choose = (classId: string): Action => ({ type: 'chooseClass', classId });
const legalOf = (r: Run, type: ActionType): Action[] => legalActions(r.s, r.pack, r.prof).filter((a) => a.type === type);
/** A Loop 2 profile with Resonance to spend; the Ruins already paid for, so *Let go* pays nothing. */
const rich = (o: Partial<Profile> = {}): Profile =>
  freshProfile({ loopCounter: 2, resonance: 500, resonanceEarnedTotal: 500, discoveries: ['loc:loc_whispering_ruins'], ...o });
/** `ids` owned and equipped. */
const wearing = (ids: string[], o: Partial<Profile> = {}): Profile => freshProfile({ loopCounter: 2, attunements: { owned: ids, equipped: ids }, ...o });
/** The Threshold reached the real way: *Let go* at the Ruins camp in Loop `prof.loopCounter`, every slide acknowledged. */
const shore = (prof: Profile = rich(), o: StateOverrides = {}): Run => acknowledgeAll(act(at(RUINS, { loop: prof.loopCounter, ...o }, prof, tp), { type: 'letGo' }));
/** From the shore: the Loom and `loom`, the Far Light and `far`, then into the light. */
const intoLoop = (r: Run, loom: readonly Action[] = [], far: readonly Action[] = []): Run => run(r, [go('loom'), ...loom, go('far_light'), ...far, NEW_LOOP]);
const EPS = 1e-9;

describe('U31 · arriving at the Threshold, the four places (DESIGN §10.8, §14.2; STORY §10.7)', () => {
  test('the Still Shore: the shore, the last run, its Echoes, the Resonance, the figure; an autosave on arrival only', () => {
    const r = shore();
    expect([r.s.mode, thresholdArea(r.s)]).toEqual(['threshold', 'still_shore']);
    expect(logs(r.last)).toEqual([
      THRESHOLD_TEXT.shore,
      'Loop 2 · Ranger · Fall (released) · Day 1',
      'No Echo came back with you.',
      'Resonance to spend at the Loom: 500.',
      THRESHOLD_TEXT.figure,
    ]);
    expect(ofType(r.last, 'autosaveCheckpoint')).toEqual([{ t: 'autosaveCheckpoint', reason: 'thresholdEntered' }]);
    expect(legalOf(r, 'thresholdGo')).toEqual([go('far_light'), go('gallery'), go('loom')]);
    const walked = run(r, [go('gallery'), go('loom'), go('far_light'), go('loom')]);
    expect(walked.s.threshold?.visited).toEqual(['still_shore', 'gallery', 'far_light', 'loom']);
    expect(thresholdArea(walked.s)).toBe('loom');
    expect(ofType(walked.all.slice(r.all.length), 'thresholdEntered').map((e) => e.area)).toEqual(['gallery', 'loom', 'far_light', 'loom']);
    expect(refused(walked, go('loom'))).toBe('you are already there');
    expect(refused(walked, { type: 'thresholdGo', to: 'beach' } as unknown as Action)).toBe("there is no place called 'beach' here");
    const back = act(walked, go('still_shore'));
    expect(logs(back.last)[0]).toBe(THRESHOLD_TEXT.shore);
    expect(ofType(back.last, 'autosaveCheckpoint')).toEqual([]);
  });

  test("each place's actions only there; a threshold state without a record stands at the Still Shore", () => {
    const r = shore();
    for (const a of [buy('att_full_purse'), unbuy('att_full_purse'), equip('att_full_purse'), toggle('mod_glass'), NGP]) expect(refused(r, a)).toBe('that is done at the Loom');
    for (const a of [choose('wizard'), NEW_LOOP]) expect(refused(r, a)).toBe('that is done at the Far Light');
    const bare = start(makeState({ mode: 'threshold' }, { content: tp }), freshProfile(), tp);
    expect(thresholdArea(bare.s)).toBe('still_shore');
    expect(act(bare, go('loom')).s.threshold).toEqual({ visited: ['still_shore', 'loom'], spentThisVisit: 0, pendingClassId: null });
    expect(refused(start(makeState({ mode: 'title' }), freshProfile()), choose('wizard'))).toBe('a new game names its class');
  });
});

describe('U31 · the Loom: Attunements — buy, refund within the visit, equip cap 5 (DESIGN §10.7)', () => {
  const loom = (prof: Profile = rich()): Run => act(shore(prof), go('loom'));

  test('buy: Resonance − cost (never "earned"), owned forever, counted for the visit; refused when owned, unknown, too dear or not yet allowed', () => {
    const r = act(loom(), buy('att_full_purse'));
    expect([r.prof.resonance, r.prof.resonanceEarnedTotal, r.s.threshold?.spentThisVisit]).toEqual([485, 500, 15]);
    expect(r.prof.attunements).toEqual({ owned: ['att_full_purse'], equipped: [] });
    expect(r.last.filter((e) => e.t === 'resonanceGained' || e.t === 'attunementBought')).toEqual([
      { t: 'resonanceGained', amount: -15, reason: 'attunement:att_full_purse', total: 485 },
      { t: 'attunementBought', attunementId: 'att_full_purse' },
    ]);
    expect(refused(r, buy('att_full_purse'))).toBe('Full Purse is already yours');
    expect(refused(r, buy('att_nope'))).toBe("unknown attunement 'att_nope'");
    expect(refused(loom(rich({ resonance: 59 })), buy('att_second_wind'))).toBe('Second Wind costs 60 Resonance; you have 59');
    expect(refused(r, buy('att_steady_hours'))).toMatch(/^Steady Hours needs .+/); // DESIGN §10.7: requires echo_breach_clock
    expect(act(loom(rich({ echoes: ['echo_breach_clock'] })), buy('att_steady_hours')).prof.attunements.owned).toEqual(['att_steady_hours']);
    const twenty = loom(rich({ resonance: 20 }));
    expect(legalOf(twenty, 'thresholdSpend')).toEqual(
      ['att_deep_well', 'att_echo_sense', 'att_full_purse', 'att_light_step', 'att_old_road', 'att_steady_hand'].map(buy),
    );
  });

  test('refund: only what this visit bought (the tail of owned worth spentThisVisit) — the cost back, unequipped, uncounted', () => {
    let r = run(loom(rich({ attunements: { owned: ['att_deep_well'], equipped: ['att_deep_well'] } })), [
      buy('att_full_purse'),
      buy('att_keen_eye'),
      equip('att_full_purse'),
    ]);
    expect([r.prof.resonance, r.s.threshold?.spentThisVisit]).toEqual([460, 40]);
    expect(legalOf(r, 'thresholdRefund')).toEqual([unbuy('att_full_purse'), unbuy('att_keen_eye')]);
    expect(refused(r, unbuy('att_deep_well'))).toBe('only an Attunement woven during this visit can be unpicked');
    expect(refused(r, unbuy('att_echo_sense'))).toBe('that Attunement is not yours');
    r = act(r, unbuy('att_full_purse'));
    expect(r.prof.attunements).toEqual({ owned: ['att_deep_well', 'att_keen_eye'], equipped: ['att_deep_well'] });
    expect([r.prof.resonance, r.prof.resonanceEarnedTotal, r.s.threshold?.spentThisVisit]).toEqual([475, 500, 25]);
    expect(r.last.filter((e) => e.t === 'attunementEquipped' || e.t === 'resonanceGained')).toEqual([
      { t: 'attunementEquipped', attunementId: 'att_full_purse', on: false },
      { t: 'resonanceGained', amount: 15, reason: `${REFUND_REASON}att_full_purse`, total: 475 },
    ]);
    expect(legalOf(r, 'thresholdRefund')).toEqual([unbuy('att_keen_eye')]);
    // the next visit cannot unpick what the last one wove
    const later = act(acknowledgeAll(act(run(r, [go('far_light'), NEW_LOOP]), { type: 'letGo' })), go('loom'));
    expect(later.s.threshold?.spentThisVisit).toBe(0);
    expect(refused(later, unbuy('att_keen_eye'))).toBe('only an Attunement woven during this visit can be unpicked');
  });

  test('equip: owned only, at most five, off again; the legal toggles', () => {
    const six = ['att_deep_well', 'att_echo_sense', 'att_full_purse', 'att_keen_eye', 'att_light_step', 'att_steady_hand'];
    let r = run(loom(rich({ attunements: { owned: six, equipped: [] } })), six.slice(0, 5).map((id) => equip(id)));
    expect(r.prof.attunements.equipped).toEqual(six.slice(0, 5));
    expect(refused(r, equip('att_steady_hand'))).toBe('at most 5 Attunements can be equipped');
    expect(refused(r, equip('att_deep_well'))).toBe('that Attunement is already equipped');
    expect(refused(r, equip('att_second_wind'))).toBe('you do not own that Attunement');
    expect(refused(r, { type: 'equipAttunement', attunementId: 'att_deep_well' } as unknown as Action)).toBe('equip on or off?');
    expect(legalOf(r, 'equipAttunement')).toEqual(six.slice(0, 5).map((id) => equip(id, false)));
    r = run(r, [equip('att_keen_eye', false), equip('att_steady_hand')]);
    expect(r.prof.attunements.equipped).toEqual(['att_deep_well', 'att_echo_sense', 'att_full_purse', 'att_light_step', 'att_steady_hand']);
    expect(ofType(r.last, 'attunementEquipped')).toEqual([{ t: 'attunementEquipped', attunementId: 'att_steady_hand', on: true }]);
    expect(refused(r, equip('att_keen_eye', false))).toBe('that Attunement is not equipped');
  });
});

describe('U31 · buy → equip → loop start → the effect is visible (DESIGN §10.7; engine/runRules.ts)', () => {
  test('Steady Hand, Deep Well, Full Purse, Keen Eye, Steady Hours: maxima, gold, crit, the clock — on the loop the Far Light starts', () => {
    const five = ['att_steady_hand', 'att_deep_well', 'att_full_purse', 'att_keen_eye', 'att_steady_hours'];
    const r = intoLoop(shore(rich({ echoes: ['echo_breach_clock'] })), [...five.map(buy), ...five.map((id) => equip(id))]);
    const { s } = r;
    const p = s.player;
    expect([s.mode, s.meta.loop, s.world.currentLocationId, s.clock.ticks, s.threshold, s.pendingEnding]).toEqual(['explore', 3, RUINS, 0, null, null]);
    expect(ofType(r.last, 'loopStarted')).toEqual([{ t: 'loopStarted', loop: 3, classId: 'ranger' }]);
    expect(ofType(r.last, 'modeChanged')).toEqual([{ t: 'modeChanged', from: 'threshold', to: 'explore' }]);
    expect(logs(r.last)[0]).toBe(THRESHOLD_TEXT.farLight);
    expect(p.attunements).toEqual(five);
    const plain = derive({ ...p, attunements: [] }, tp);
    expect([p.hpMax, p.mpMax]).toEqual([Math.floor(plain.hpMax * 1.05 + EPS), Math.floor(plain.mpMax * 1.05 + EPS)]);
    expect([p.hp, p.mp]).toEqual([p.hpMax, p.mpMax]);
    expect(p.gold).toBe(30 + 60);
    expect(derive(p, tp).crit).toBe(plain.crit + 3);
    expect(s.clock).toMatchObject({ limitTicks: 116 + 4, modifiers: [{ source: 'att_steady_hours', watches: 4 }] });
    expect(r.prof.resonance).toBe(500 - 20 - 20 - 15 - 25 - 50);
    expect(r.prof.attunements.equipped).toEqual(five); // the profile keeps them for later loops
  });

  test('Iron Loop: the equipped set sleeps for the loop; Frayed Clock halves Steady Hours toward zero (DESIGN §10.1, §15.1)', () => {
    const owned = ['att_full_purse', 'att_steady_hours'];
    const iron = intoLoop(shore(rich({ attunements: { owned, equipped: owned } })), [toggle('mod_iron_loop')]);
    expect([iron.s.player.attunements, iron.s.player.gold, iron.s.meta.modifiers]).toEqual([undefined, 30, ['mod_iron_loop']]);
    expect(iron.s.clock).toMatchObject({ limitTicks: 116, modifiers: [] });
    const frayed = intoLoop(shore(rich({ attunements: { owned, equipped: owned } })), [toggle('mod_frayed_clock')]);
    expect(frayed.s.clock).toMatchObject({ limitTicks: 80 + 2, modifiers: [{ source: 'att_steady_hours', watches: 2 }] });
    expect(frayed.s.player.gold).toBe(90);
  });

  test('the other loop-start kinds: stat points, ability points, starting items, a revealed region (no DESIGN row uses them)', () => {
    const extra: AttunementInput = {
      id: 'att_extra',
      name: 'Extra',
      description: 'Fixture.',
      cost: 1,
      icon: 'extra',
      effects: [
        { kind: 'stat', stat: 'strength', amount: 2 },
        { kind: 'ability_points', amount: 1 },
        { kind: 'start_item', itemId: 'item_glow_moss', count: 2 },
        { kind: 'reveal_region', regionId: 'region_glowlands_nexus' },
      ],
    };
    const pack = buildContentPack({ ...thresholdTables(), attunements: [extra] }, { version: FIXTURE_VERSION, validate: false });
    const s = newRun('x', 'ranger', pack, wearing(['att_extra']));
    const plain = newRun('x', 'ranger', pack, freshProfile({ loopCounter: 2 }));
    expect(s.player.passiveBonuses).toEqual({ strength: 2 });
    expect(s.player.apHalf).toBe(plain.player.apHalf + 2);
    expect(s.player.inventory.filter((i) => i.itemId === 'item_glow_moss').map((i) => i.qty)).toEqual([2]);
    expect(s.meta.nextUid).toBe(plain.meta.nextUid + 1);
    expect(s.world.discovered).toEqual([RUINS, GLOWLANDS, NEXUS, APEX]);
    expect(derive(s.player, pack).strength).toBe(derive(plain.player, pack).strength + 2);
    expect([s.player.hpMax, s.player.hp]).toEqual([derive(s.player, pack).hpMax, derive(s.player, pack).hpMax]); // STR raises max HP
  });

  test("Quick Study: +10 % XP, with gear at most +20 %; Pacifist's Vow: XP from anything but kills ×2 (DESIGN §10.7, §15.1)", () => {
    const xpOf = (prof: Profile): number | undefined =>
      ofType(act(at(RUINS, { loop: 2 }, prof, tp, withWait([{ xp: 50 }])), { type: 'wait' }).last, 'xpGained')[0]?.amount;
    expect(xpOf(freshProfile({ loopCounter: 2 }))).toBe(50);
    expect(xpOf(wearing(['att_quick_study']))).toBe(55);
    expect(xpOf(freshProfile({ loopCounter: 2, modifiers: { mod_pacifist: true } }))).toBe(100);
    expect(xpOf(wearing(['att_quick_study'], { modifiers: { mod_pacifist: true } }))).toBe(110);
    const p = makeState({ loop: 2 }, { content: tp, profile: wearing(['att_quick_study']) }).player;
    expect([xpBonus(p, tp), xpBonus(p, tp, 0.1), xpBonus(p, tp, 0.15)]).toEqual([0.1, 0.2, 0.2]);
  });

  test('Light Step: travel regen +5 % HP / +10 % MP more per watch; Remembered Steps: the first remembered road of a day is free', () => {
    // maxima synced first (the Amulet's +1 MAG), so the regen reads the same max MP as the post-step sync keeps
    const tired = (s: GameState) => void (syncMaxima(s.player, tp), (s.player.hp = 10), (s.player.mp = 0));
    const walk = (prof: Profile) => act(at(PLAZA, { loop: 2, patch: tired }, prof, tp), move(GLOWLANDS)).s.player;
    const plain = walk(freshProfile({ loopCounter: 2 }));
    const light = walk(wearing(['att_light_step']));
    expect([plain.hp, plain.mp]).toEqual([10 + Math.round(plain.hpMax * 0.05), Math.round(plain.mpMax * 0.1)]);
    expect([light.hp, light.mp]).toEqual([10 + Math.round(light.hpMax * 0.1), Math.round(light.mpMax * 0.2)]);

    const remembered = wearing(['att_remembered_steps'], { mapKnowledge: [PLAZA, GLOWLANDS] });
    let r = act(at(PLAZA, { loop: 2 }, remembered, tp), move(GLOWLANDS));
    expect(r.s.clock.ticks).toBe(0);
    expect(logs(r.last)).toContain('Your feet remember this road; it takes no time at all.');
    expect(r.s.player.uses.att_remembered_steps).toEqual({ day: 1 });
    r = act(r, move(PLAZA));
    expect(r.s.clock.ticks).toBe(1); // once a day
    r = act(patch(r, (s) => void (s.clock.ticks = 4)), move(GLOWLANDS)); // Day 2
    expect(r.s.clock.ticks).toBe(4);
    expect(act(at(PLAZA, { loop: 2 }, wearing(['att_remembered_steps']), tp), move(GLOWLANDS)).s.clock.ticks).toBe(1); // not remembered
  });

  test('Old Road: one free inn night a loop, legal even without the gold', () => {
    const road = at(PLAZA, { loop: 2, gold: 0 }, wearing(['att_old_road']), tp);
    expect(legalOf(road, 'rest')).toEqual([{ type: 'rest', kind: 'full' }, { type: 'rest', kind: 'short' }]);
    const slept = act(road, { type: 'rest', kind: 'full' });
    expect([slept.s.player.gold, slept.s.player.uses.att_old_road]).toEqual([0, { loop: 2 }]);
    expect(logs(slept.last)).toContain('The innkeeper waves your coin away. The old road remembers you.');
    expect(refused(slept, { type: 'rest', kind: 'full' })).toBe(`a bed here costs ${INN_COST} gold`);
    expect(act(patch(slept, (s) => void (s.player.gold = 50)), { type: 'rest', kind: 'full' }).s.player.gold).toBe(50 - INN_COST);
    expect(legalOf(at(PLAZA, { loop: 2, gold: 0 }, freshProfile({ loopCounter: 2 }), tp), 'rest')).toEqual([{ type: 'rest', kind: 'short' }]);
  });

  test('Second Wind: once a loop from Loop 2 the killing blow leaves 1 HP, then the Fall; never in Loop 1 (DESIGN §10.7)', () => {
    const fight = (r0: Run): { r: Run; stood: number } => {
      let r = act(r0, move(LIBRARY)); // the two Shades
      let stood = 0;
      for (let i = 0; i < 60 && r.s.mode === 'combat' && r.s.combat?.phase !== 'defeat'; i++) {
        r = act(r, { type: 'guard' });
        stood = Math.max(stood, r.s.combat?.log.filter((l) => l.text.startsWith('Second Wind')).length ?? 0);
      }
      return { r, stood };
    };
    const wind = fight(at(RUINS, { loop: 2, hp: 1 }, wearing(['att_second_wind']), tp));
    expect(wind.stood).toBe(1);
    expect(wind.r.s.player.uses.att_second_wind).toEqual({ loop: 2 });
    expect(wind.r.s.pendingEnding).toMatchObject({ outcome: 'closer_fall', reason: 'death' });
    const loop1 = fight(at(RUINS, { hp: 1 }, freshProfile({ attunements: { owned: ['att_second_wind'], equipped: ['att_second_wind'] } }), tp));
    expect([loop1.stood, loop1.r.s.combat?.phase]).toEqual([0, 'defeat']); // FALLEN
  });

  test('Echo-Sense: resistances known at first sight (DESIGN §10.7)', () => {
    const seen = act(at(RUINS, { loop: 2 }, wearing(['att_echo_sense']), tp), move(LIBRARY));
    expect(seen.s.mode).toBe('combat');
    expect(seen.prof.bestiary.cr_corrupted_shade?.revealed).toBe('resist');
    const blind = act(at(RUINS, { loop: 2 }, freshProfile({ loopCounter: 2 }), tp), move(LIBRARY));
    expect(blind.prof.bestiary.cr_corrupted_shade?.revealed ?? 'none').toBe('none');
  });
});

describe('U31 · challenge modifiers: toggled at the Loom, fixed for the next loop (DESIGN §15.1, D-021, D-082)', () => {
  test('toggles write the profile; the prepared run is unchanged until the Far Light rebuilds it; off again deletes the toggle', () => {
    let r = run(shore(), [go('loom'), toggle('mod_frayed_clock'), toggle('mod_glass'), toggle('mod_pacifist'), toggle('mod_pacifist')]);
    expect(r.prof.modifiers).toEqual({ mod_frayed_clock: true, mod_glass: true });
    expect(ofType(r.last, 'modifierToggled')).toEqual([{ t: 'modifierToggled', modifierId: 'mod_pacifist', on: false }]);
    expect(r.s.meta.modifiers).toEqual([]);
    expect(refused(r, toggle('mod_nope'))).toBe("unknown modifier 'mod_nope'");
    expect(legalOf(r, 'toggleModifier')).toEqual(['mod_frayed_clock', 'mod_glass', 'mod_horde_rising', 'mod_iron_loop', 'mod_mute_ley', 'mod_pacifist'].map(toggle));
    r = run(r, [go('far_light'), NEW_LOOP]);
    expect(r.s.meta.modifiers).toEqual(['mod_frayed_clock', 'mod_glass']);
    expect(r.s.clock.limitTicks).toBe(80);
    expect(refused(r, toggle('mod_glass'))).toBe("'toggleModifier' is not available in explore mode"); // fixed for the loop
  });

  test('Glass: DoT ticks ×2 both ways as hits are (DESIGN §15.1 "including DoT ticks")', () => {
    expect([modifierDamageMult(['mod_glass'], tp, true), modifierDamageMult(['mod_glass'], tp, false), modifierDamageMult([], tp, true)]).toEqual([2, 2, 1]);
    const poison = { statusId: 'status_poison', stacks: 1, duration: 3, sourceUid: null, appliedOnOwnTurn: false, tick: 3 };
    const tick = (modifiers: string[]): number | undefined => {
      const r = at(PLAZA, { loop: 2, patch: (s) => void (s.player.statuses.push({ ...poison }), (s.meta.modifiers = modifiers)) }, freshProfile({ loopCounter: 2 }), tp);
      return ofType(act(r, move(GLOWLANDS)).last, 'statusTicked')[0]?.amount;
    };
    expect([tick([]), tick(['mod_glass'])]).toEqual([3, 6]);
  });

  test("Resonance: the loop's total × the modifiers' product (at most ×3) at its end, as one more payment", () => {
    expect([resonanceMultiplier([]), resonanceMultiplier(['mod_glass']), resonanceMultiplier(['mod_glass', 'mod_frayed_clock'])]).toEqual([1, 1.5, 1.875]);
    expect(resonanceMultiplier(['mod_iron_loop', 'mod_frayed_clock', 'mod_mute_ley', 'mod_horde_rising', 'mod_glass', 'mod_pacifist'])).toBe(3);
    const prof = freshProfile({ loopCounter: 2, modifiers: { mod_glass: true, mod_frayed_clock: true } });
    let r = act(at(RUINS, { loop: 2 }, prof, tp, withWait([{ resonance: 6 }])), { type: 'wait' });
    expect(r.s.counters.resonance).toBe(6); // earned during the loop
    r = act(r, { type: 'letGo' }); // the Ruins +2 (released: no closer bonus)
    expect(ofType(r.last, 'resonanceGained').map((e) => [e.reason, e.amount])).toEqual([['locations', 2], [MULTIPLIER_REASON, 7]]); // 8 × 0.875
    expect([r.s.counters.resonance, r.prof.resonance, r.prof.resonanceEarnedTotal]).toEqual([8, 15, 15]);
    expect(logs(r.last)).toContain('Challenge modifiers ×1.875: +7 Resonance.');
    const none = act(act(at(RUINS, { loop: 2 }, freshProfile({ loopCounter: 2 }), tp, withWait([{ resonance: 6 }])), { type: 'wait' }), { type: 'letGo' });
    expect(ofType(none.last, 'resonanceGained').map((e) => e.reason)).toEqual(['locations']);
    // spending and refunds at the Threshold are not a loop's earnings
    const spent = run(shore(rich({ modifiers: { mod_glass: true } })), [go('loom'), buy('att_full_purse'), unbuy('att_full_purse')]);
    expect(spent.s.counters.resonance).toBeUndefined();
  });
});

describe('U31 · the Far Light: class change between loops keeps mastery (DESIGN §10.9, D-011, D-067.2)', () => {
  test("chooseClass sets the next loop's class; that class's mastered abilities cost half again; the other mastery stays", () => {
    const mastery = {
      ranger: { loopsPlayed: 1, mastered: ['rgr_rend'], endings: [], bestLevel: 5, bestDays: null },
      wizard: { loopsPlayed: 2, mastered: ['wiz_fireball'], endings: [], bestLevel: 8, bestDays: null },
    };
    let r = act(shore(rich({ classMastery: mastery })), go('far_light'));
    const ranger = r.prof.classMastery.ranger;
    expect(legalOf(r, 'chooseClass')).toEqual(['elf', 'ironclad_warden', 'shadow_weaver', 'wizard'].map(choose));
    expect(refused(r, choose('ranger'))).toBe('that is the shape you will wake in already');
    expect(refused(r, choose('bard'))).toBe("unknown class 'bard'");
    r = act(r, choose('wizard'));
    expect(r.s.threshold?.pendingClassId).toBe('wizard');
    expect(logs(r.last)).toEqual(['The Wayfinder re-manifests: Wizard.']);
    expect(act(r, choose('ranger')).s.threshold?.pendingClassId).toBeNull(); // back to the class just played
    r = act(r, NEW_LOOP);
    expect([r.s.player.classId, r.s.player.level]).toEqual(['wizard', 4]); // ⌊0.6 × 8⌋, the best over every class (D-070.5)
    expect(ofType(r.last, 'loopStarted')).toEqual([{ t: 'loopStarted', loop: 3, classId: 'wizard' }]);
    const ap = r.s.player.apHalf;
    r = act(r, { type: 'unlockAbility', abilityId: 'wiz_fireball' });
    expect(r.s.player.apHalf).toBe(ap - 1); // mastered: half of 2 half-points
    r = act(r, { type: 'letGo' });
    expect(r.prof.classMastery.ranger).toEqual(ranger);
    expect(r.prof.classMastery.wizard).toMatchObject({ loopsPlayed: 3, bestLevel: 8 });
    expect(r.prof.classMastery.wizard?.mastered).toContain('wiz_fireball');
    expect(r.prof.lastClassId).toBe('wizard');
  });

  test('quests started at the Threshold, and its Echoes, go into the loop (D-067.15)', () => {
    const r0 = patch(act(shore(), go('far_light')), (s) => {
      s.quests.q_echo_crystal = { status: 'active', stage: 'find_crystal', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] };
      s.echoesThisLoop.push('echo_breach_clock');
    });
    const r = act(r0, NEW_LOOP);
    expect(r.s.quests.q_echo_crystal).toMatchObject({ status: 'active', stage: 'find_crystal' });
    expect(r.s.echoesThisLoop).toContain('echo_breach_clock');
    expect(r.s.counters.echoesGainedThisLoop).toBe(r.s.echoesThisLoop.length);
  });
});

describe('U31 · New Game+ (D-021): a fresh save with the Echoes and codex, the loop counter continuing', () => {
  const owned = ['att_full_purse'];
  const veteran = (): Profile =>
    rich({
      echoes: ['echo_amulet_memory'],
      codexUnlocked: ['codex_tyrant_holding'],
      discoveries: ['loc:loc_whispering_ruins', 'codex:codex_tyrant_holding', 'quest:q_echo_crystal'],
      attunements: { owned, equipped: owned },
      classMastery: { ranger: { loopsPlayed: 3, mastered: ['rgr_rend'], endings: [], bestLevel: 14, bestDays: null } },
      modifiers: { mod_glass: true },
    });
  /** A true ending (Loop 2, Day 4) on its first slide. */
  const ended = (): Run => ({ ...act(at(GLOWLANDS, { loop: 2, day: 4 }, veteran(), tp, withWait([{ ending: 'ending_unbound' }])), { type: 'wait' }), step });

  test("on a true ending's screen: the fresh profile, then Day 1 of the next loop at level 1", () => {
    const r = ended();
    expect(legalActions(r.s, tp, r.prof).map((a) => a.type)).toEqual(['acknowledgeEnding', 'newGamePlus', 'returnToTitle']);
    const ng = act(r, NGP);
    const p = ng.prof;
    expect(p).toEqual(newGamePlusProfile(r.prof));
    expect(p.echoes).toEqual(r.prof.echoes);
    expect(p.echoes).toContain('echo_ending_f');
    expect(p.codexUnlocked).toEqual(['codex_tyrant_holding']);
    expect([p.resonance, p.resonanceEarnedTotal, p.attunements, p.classMastery, p.runHistory, p.bestiary, p.mapKnowledge, p.endingsReached]).toEqual([
      0,
      0,
      { owned: [], equipped: [] },
      {},
      [],
      {},
      [],
      [],
    ]);
    expect(p.discoveries).toEqual(['codex:codex_tyrant_holding']);
    expect([p.loopCounter, p.newGamePlus, p.modifiers, p.profileId, p.settings]).toEqual([3, 1, { mod_glass: true }, 'fixture', r.prof.settings]);
    const s = ng.s;
    expect([s.mode, s.meta.loop, s.meta.seed, s.player.level, s.player.classId, s.world.currentLocationId]).toEqual(['explore', 3, 'fixture:ng1:3', 1, 'ranger', RUINS]);
    expect([s.meta.modifiers, s.player.attunements, s.player.gold, s.pendingEnding]).toEqual([['mod_glass'], undefined, 30, null]);
    expect(ofType(ng.last, 'modeChanged')).toEqual([{ t: 'modeChanged', from: 'ending', to: 'explore' }]);
    expect(ofType(ng.last, 'loopStarted')).toEqual([{ t: 'loopStarted', loop: 3, classId: 'ranger' }]);
    expect(logs(ng.last)).toContain(THRESHOLD_TEXT.newGamePlus);
  });

  test('at the Loom once an ending is reached (the chosen class); never after a closer or before any ending', () => {
    expect(refused(act(at(RUINS, { loop: 2 }, rich(), tp), { type: 'letGo' }), NGP)).toBe('New Game+ follows a true ending');
    expect(refused(act(shore(), go('loom')), NGP)).toBe('New Game+ opens once an ending has been reached');
    const loom = act(acknowledgeAll(ended()), go('loom'));
    expect(legalOf(loom, 'newGamePlus')).toEqual([NGP]);
    const ng = run(loom, [go('far_light'), choose('wizard'), go('loom'), NGP]);
    expect([ng.s.player.classId, ng.s.meta.seed, ng.prof.newGamePlus, ng.prof.endingsReached]).toEqual(['wizard', 'fixture:ng1:3', 1, []]);
    expect(legalOf(act(ng, { type: 'letGo' }), 'newGamePlus')).toEqual([]); // a fresh save has reached no ending yet
  });
});

describe('legalActions agrees with step for every U31 action (PLAN §4.7)', () => {
  const U31: Action[] = [
    go('still_shore'),
    go('gallery'),
    go('loom'),
    go('far_light'),
    buy('att_full_purse'),
    buy('att_steady_hours'),
    buy('att_second_wind'),
    unbuy('att_full_purse'),
    unbuy('att_deep_well'),
    equip('att_full_purse'),
    equip('att_full_purse', false),
    equip('att_deep_well'),
    equip('att_deep_well', false),
    toggle('mod_glass'),
    choose('wizard'),
    choose('ranger'),
    NEW_LOOP,
    NGP,
  ];
  const corpus = (): Run[] => {
    const five = ['att_deep_well', 'att_echo_sense', 'att_keen_eye', 'att_light_step', 'att_steady_hand'];
    const loom = act(shore(rich({ resonance: 70 })), go('loom'));
    return [
      shore(),
      loom,
      act(loom, buy('att_full_purse')),
      run(loom, [buy('att_full_purse'), equip('att_full_purse')]),
      act(shore(rich({ attunements: { owned: [...five, 'att_full_purse'], equipped: five } })), go('loom')),
      act(shore(rich({ resonance: 0, endingsReached: ['ending_unbound'] })), go('loom')),
      act(shore(), go('far_light')),
      run(shore(), [go('far_light'), choose('wizard')]),
      act(at(GLOWLANDS, { loop: 2 }, rich(), tp, withWait([{ ending: 'ending_unbound' }])), { type: 'wait' }),
      act(at(RUINS, { loop: 2 }, rich(), tp), { type: 'letGo' }),
      at(RUINS, { loop: 2 }, rich(), tp),
      start(makeState({ mode: 'title' }, { content: tp }), freshProfile(), tp),
      start(makeState({ mode: 'threshold' }, { content: tp }), freshProfile(), tp),
    ];
  };
  test('isLegal ⇔ step accepts, for each state in the corpus', () => {
    const seen = new Set<ActionType>();
    for (const r of corpus()) {
      for (const a of U31) {
        const accepted = ofType(r.step(r.s, a, r.pack, r.prof).events, 'actionRejected').length === 0;
        expect({ a, mode: r.s.mode, area: thresholdArea(r.s), legal: isLegal(r.s, a, r.pack, r.prof) }).toEqual({ a, mode: r.s.mode, area: thresholdArea(r.s), legal: accepted });
        if (accepted) seen.add(a.type);
      }
    }
    expect([...seen].sort()).toEqual(['chooseClass', 'equipAttunement', 'newGamePlus', 'newLoop', 'thresholdGo', 'thresholdRefund', 'thresholdSpend', 'toggleModifier']);
  });
});

// ==== U34c: talk at the Threshold =================================================================================================

describe('U34c · talk at the Threshold: whoever stands at the place (Dask on the Still Shore; D-012, D-084)', () => {
  const TALK: Action = { type: 'talk', npcId: DASK_NPC };

  test('on the Shore Dask is listed; talk opens his scene, its choice lands, and the scene ends back at the Threshold', () => {
    const r = shore();
    expect([r.s.mode, r.s.meta.loop, thresholdLocationId(r.s)]).toEqual(['threshold', 3, SHORE]);
    expect(legalOf(r, 'talk')).toEqual([TALK]);
    const open = act(r, TALK);
    expect(open.s.mode).toBe('dialogue');
    expect(open.s.dialogue).toMatchObject({ sceneId: DASK_SHORE_SCENE, npcId: DASK_NPC, nodeId: 'greet', returnMode: 'threshold' });
    expect(ofType(open.last, 'modeChanged')).toEqual([{ t: 'modeChanged', from: 'threshold', to: 'dialogue' }]);
    expect(legalActions(open.s, tp, open.prof)).toEqual([
      { type: 'choose', choiceId: 'ask' },
      { type: 'choose', choiceId: 'leave' },
    ]);
    const asked = act(open, { type: 'choose', choiceId: 'ask' });
    expect(asked.s.flags.flag_fixture_dask_asked).toBe(true);
    // Resonance gained in a Threshold conversation is the profile's, not the next loop's tally (×modifiers at its end)
    expect([asked.prof.resonance - open.prof.resonance, asked.s.counters.resonance ?? 0]).toEqual([5, 0]);
    const back = act(asked, { type: 'continue' });
    expect([back.s.mode, thresholdArea(back.s), back.s.dialogue]).toEqual(['threshold', 'still_shore', null]);
    expect(ofType(back.last, 'modeChanged')).toEqual([{ t: 'modeChanged', from: 'dialogue', to: 'threshold' }]);
    // not repeatable: said for this visit; the Threshold goes on as before
    expect(legalOf(back, 'talk')).toEqual([]);
    expect(refused(back, TALK)).toBe('Dask has nothing more to say');
    expect(legalOf(back, 'thresholdGo')).toEqual([go('far_light'), go('gallery'), go('loom')]);
  });

  test('only where he stands and while his scene is available; nowhere else, and not in another pack', () => {
    const r = shore();
    for (const to of ['gallery', 'loom', 'far_light'] as const) {
      const there = act(r, go(to));
      expect([thresholdLocationId(there.s), legalOf(there, 'talk'), refused(there, TALK)]).toEqual([THRESHOLD_LOCATIONS[to], [], 'Dask is not here']);
    }
    const loopTwo = patch(r, (s) => void (s.meta.loop = 2)); // his scene is from Loop 3 (WORLD §3.12)
    expect([legalOf(loopTwo, 'talk'), refused(loopTwo, TALK)]).toEqual([[], 'Dask has nothing more to say']);
    const nobody = start(makeState({ mode: 'threshold' }, { content: pack }), freshProfile({ loopCounter: 3 }), pack); // no Shore record
    expect([legalOf(nobody, 'talk'), refused(nobody, { type: 'talk', npcId: 'npc_ilyra' })]).toEqual([[], 'Ilyra is not here']);
    expect(refused(at(RUINS, { loop: 3 }, rich(), tp), TALK)).toBe('Dask is not here'); // explore: the Ruins, not the Shore
  });

  test('isLegal ⇔ step accepts for every talk, in every place of the Threshold and around it', () => {
    const talks: Action[] = [...Object.keys(tp.npcs).sort(), 'npc_nobody', 'toString'].map((npcId) => ({ type: 'talk', npcId }));
    const corpus = [
      shore(),
      ...(['gallery', 'loom', 'far_light'] as const).map((to) => act(shore(), go(to))),
      act(shore(), TALK),
      run(shore(), [TALK, { type: 'choose', choiceId: 'leave' }]),
      at(RUINS, { loop: 3 }, rich(), tp),
    ];
    let accepted = 0;
    for (const r of corpus) {
      for (const a of talks) {
        const ok = ofType(r.step(r.s, a, r.pack, r.prof).events, 'actionRejected').length === 0;
        expect({ a, mode: r.s.mode, area: thresholdArea(r.s), legal: isLegal(r.s, a, r.pack, r.prof) }).toEqual({ a, mode: r.s.mode, area: thresholdArea(r.s), legal: ok });
        expect({ a, listed: legalOf(r, 'talk').some((x) => JSON.stringify(x) === JSON.stringify(a)) }).toEqual({ a, listed: ok });
        if (ok) accepted += 1;
      }
    }
    expect(accepted).toBeGreaterThanOrEqual(2); // the Shore, and Ilyra at the Ruins
  });
});
