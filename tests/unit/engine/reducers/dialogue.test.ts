// U33: dialogue — PLAN §8.1 row "dialogue" (scene selection by `when` + `priority`, `entry` matching, variants, choice
// `when` / `disabledText` / `once` / `oncePerLoop`, `continue` on no-choice nodes, `onEnter` / `onEnd` effects,
// startDialogue from combat and the return mode, companion reactions), plus companion interjections, camp conversations
// on a full rest (D-059, DESIGN §12.7), `interact`, a scene that starts a fight, Companion's Trust and `loyalty_start`
// at recruitment (DESIGN §10.7, §12.5), the Loop 1 Apex prompt kept (D-074), and legal/step agreement.
// DESIGN §12.5, §12.7, §13.2; PLAN §5.10; STORY §13; C-58.
import { describe, expect, test } from 'bun:test';
import {
  CAMP_LOYALTY,
  DEFAULT_DISABLED_TEXT,
  HANDLERS,
  POST_STEP_HOOKS,
  applyAll,
  campSceneFor,
  choiceViews,
  createStep,
  isLegal,
  legalActions,
  sceneForNpc,
  step,
  type Action,
  type CompanionRunState,
  type GameEvent,
  type GameState,
  type LocationState,
  type Profile,
} from '@engine/index';
import { freshProfile, makeState, play, type PlayEntry, type StateOverrides } from '@tests/fixtures/helpers';
import { CLEAR_PATH, GLOWLANDS, LIBRARY, PLAZA, RUINS, WEN, storyPack } from '@tests/fixtures/storyContent';

const pack = storyPack();
const WEN_SCENE = 'scene_fixture_wen';

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);

const at = (o: StateOverrides = {}, profile?: Profile) => makeState(o, { content: pack, ...(profile ? { profile } : {}) });
const run = (s: GameState, script: readonly PlayEntry[], profile: Profile = freshProfile({ loopCounter: s.meta.loop })) => play(s, script, { content: pack, profile });
const legal = (s: GameState, profile = freshProfile({ loopCounter: s.meta.loop })) => legalActions(s, pack, profile);
const ofKind = (s: GameState, type: Action['type'], profile?: Profile) => legal(s, profile).filter((a) => a.type === type);

const companion = (id: string, o: Partial<CompanionRunState> = {}): CompanionRunState => ({
  id, recruited: true, loyalty: 0, hp: 130, hpMax: 130, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {}, ...o,
});
/** Brak recruited and standing in the party. */
const withBrak = (o: Partial<CompanionRunState> = {}) => (s: GameState): void => {
  s.companions.recruited.brak = companion('brak', o);
  s.companions.activeId = 'brak';
};
const talkWen = (o: StateOverrides = {}, profile?: Profile) => run(at({ locationId: GLOWLANDS, ...o }, profile), [{ type: 'talk', npcId: WEN }], profile);

/** Every enumerated dialogue/quest action of `s` is accepted by `step` (PLAN §4.7 agreement). */
function agrees(s: GameState, profile = freshProfile({ loopCounter: s.meta.loop })): void {
  for (const a of legal(s, profile)) {
    if (!['talk', 'choose', 'continue', 'acceptQuest', 'interact'].includes(a.type)) continue;
    expect(ofType(step(s, a, pack, profile).events, 'actionRejected')).toEqual([]);
  }
}

describe('talk: scene selection by when + priority', () => {
  test('an NPC standing here with a playable scene can be talked to; the highest priority available scene opens', () => {
    const s = at({ locationId: GLOWLANDS });
    expect(ofKind(s, 'talk')).toEqual([{ type: 'talk', npcId: WEN }]);
    expect(ofKind(at({ locationId: PLAZA }), 'talk')).toEqual([{ type: 'talk', npcId: 'npc_brak' }]); // Tamsin has no scene
    expect(sceneForNpc(s, pack, freshProfile(), WEN)?.id).toBe(WEN_SCENE);
    const urgent = at({ locationId: GLOWLANDS, flags: { flag_fixture_urgent: true } });
    expect(sceneForNpc(urgent, pack, freshProfile(), WEN)?.id).toBe('scene_fixture_wen_urgent'); // priority 5 over 0
    const once = run(urgent, [{ type: 'talk', npcId: WEN }, { type: 'continue' }]);
    expect(once.state.flags.flag_scene_done_scene_fixture_wen_urgent).toBe(true);
    expect(sceneForNpc(once.state, pack, freshProfile(), WEN)?.id).toBe(WEN_SCENE); // non-repeatable: done this loop
  });

  test('talk opens the scene: dialogue mode, dialogueStarted with the NPC, the entry node', () => {
    const out = talkWen();
    expect(out.state.mode).toBe('dialogue');
    expect(out.state.dialogue).toEqual({ sceneId: WEN_SCENE, nodeId: 'hello', npcId: WEN, visitedNodes: ['hello'], choicesTaken: [], returnMode: 'explore' });
    expect(out.events.map((e) => e.t)).toEqual(['modeChanged', 'dialogueStarted', 'dialogueNode']);
    expect(ofType(out.events, 'dialogueNode')[0]).toEqual({ t: 'dialogueNode', nodeId: 'hello', speaker: WEN, text: 'The reeds have been whispering again.' });
  });

  test('no one here, nothing to say: not legal, rejected with a reason', () => {
    const s = at({ locationId: PLAZA });
    expect(step(s, { type: 'talk', npcId: 'npc_ilyra' }, pack, freshProfile()).events[0]).toMatchObject({ reason: 'Ilyra is not here' });
    expect(step(s, { type: 'talk', npcId: 'npc_tamsin_reed' }, pack, freshProfile()).events[0]).toMatchObject({ reason: 'Scribe Tamsin Reed has nothing more to say' });
    const ruins = at({ locationId: RUINS, flags: { flag_scene_done_scene_first_meeting_ilyra: true } });
    expect(ofKind(ruins, 'talk')).toEqual([{ type: 'talk', npcId: 'npc_ilyra' }]); // the first meeting is repeatable
    const silent = at({ locationId: 'loc_chronos_nexus' });
    expect(ofKind(silent, 'talk')).toEqual([]);
  });
});

describe('nodes: entry rules, text variants, onEnter, continue, interjections, onEnd, reactions', () => {
  test('entry: the first rule that holds (Loop 2 → again); the unconditional last rule otherwise', () => {
    const prof2 = freshProfile({ loopCounter: 2 });
    const loop2 = talkWen({ loop: 2 }, prof2);
    expect(loop2.state.dialogue?.nodeId).toBe('again');
    expect(talkWen().state.dialogue?.nodeId).toBe('hello');
  });

  test('text variants: the first that holds; onEnter applies on every entry of the node', () => {
    const plain = talkWen();
    expect(plain.state.counters.custom.wen_visits).toBe(1);
    const secret = talkWen({ flags: { flag_fixture_secret: true } });
    expect(ofType(secret.events, 'dialogueNode')[0]?.text).toBe('You again. Keep what I told you to yourself.');
    const ink = run(plain.state, [{ type: 'choose', choiceId: 'ink' }]);
    expect(ink.state.dialogue?.nodeId).toBe('hello');
    expect(ink.state.counters.custom.wen_visits).toBe(2);
  });

  test('a choice-less node: only continue, along `next`; an absent companion’s interjection is skipped', () => {
    const rumour = run(talkWen().state, [{ type: 'choose', choiceId: 'rumour' }]);
    expect(rumour.state.dialogue?.nodeId).toBe('rumour');
    expect(legal(rumour.state)).toEqual([{ type: 'continue' }]);
    expect(step(rumour.state, { type: 'choose', choiceId: 'bye' }, pack, freshProfile()).events[0]).toMatchObject({ reason: "'bye' is not a choice here" });
    const next = run(rumour.state, [{ type: 'continue' }]);
    expect(next.state.dialogue?.nodeId).toBe('tail'); // Brak's line skipped: he is not in the party
    expect(next.state.dialogue?.visitedNodes).toEqual(['hello', 'rumour', 'tail']);
  });

  test('with the companion standing in the party the interjection plays; at the end his reaction (a line and its loyalty)', () => {
    const s = at({ locationId: GLOWLANDS, patch: withBrak({ loyalty: 10 }) });
    const out = run(s, [{ type: 'talk', npcId: WEN }, { type: 'choose', choiceId: 'rumour' }, { type: 'continue' }]);
    expect(out.state.dialogue?.nodeId).toBe('interject');
    expect(ofType(out.events, 'dialogueNode').at(-1)).toMatchObject({ speaker: 'brak', text: 'Days until what?' });
    const end = run(out.state, [{ type: 'continue' }, { type: 'continue' }]);
    expect(end.state.mode).toBe('explore');
    expect(ofType(end.events, 'log').map((e) => e.text)).toContain('Brak grunts. "Rumours."');
    expect(ofType(end.events, 'loyaltyChanged')).toEqual([{ t: 'loyaltyChanged', companionId: 'brak', delta: 2, value: 12 }]);
    // a knocked-out companion neither interjects nor reacts
    const ko = run(at({ locationId: GLOWLANDS, patch: withBrak({ ko: true, hp: 0 }) }), [{ type: 'talk', npcId: WEN }, { type: 'choose', choiceId: 'rumour' }, { type: 'continue' }]);
    expect(ko.state.dialogue?.nodeId).toBe('tail');
  });

  test("the end: onEnd, the done flag, dialogueEnded, back to explore; a reaction's `when` gates it", () => {
    const s = at({ locationId: GLOWLANDS, patch: withBrak() });
    const out = run(s, [{ type: 'talk', npcId: WEN }, { type: 'choose', choiceId: 'bye' }]);
    expect(out.state.mode).toBe('explore');
    expect(out.state.dialogue).toBeNull();
    expect(out.state.flags).toMatchObject({ flag_fixture_wen_spoke: true, flag_scene_done_scene_fixture_wen: true });
    expect(ofType(out.events, 'dialogueEnded')).toEqual([{ t: 'dialogueEnded', sceneId: WEN_SCENE }]);
    expect(ofType(out.events, 'loyaltyChanged')).toEqual([]); // no rumour heard: no reaction
    expect(ofType(out.events, 'modeChanged').at(-1)).toEqual({ t: 'modeChanged', from: 'dialogue', to: 'explore' });
  });
});

describe('choices: when, disabledText, disabledWhen, once, oncePerLoop', () => {
  test('hidden when `when` fails; greyed with its disabledText; Echo-locked lines greyed with the default reason', () => {
    const s = talkWen().state;
    const views = choiceViews(s, pack, freshProfile());
    expect(views.map((v) => v.id)).toEqual(['ink', 'rumour', 'greyed', 'nine', 'bye']);
    expect(views.find((v) => v.id === 'greyed')).toEqual({ id: 'greyed', text: 'Fixture: shown greyed.', enabled: false, disabledText: '(You need a reason.)', tags: [] });
    expect(views.find((v) => v.id === 'nine')).toEqual({
      id: 'nine', text: 'I have heard nine voices.', enabled: false, disabledText: DEFAULT_DISABLED_TEXT, tags: ['echo'], echoHint: 'echo_nine_voices',
    });
    expect(ofKind(s, 'choose').map((a) => (a as { choiceId: string }).choiceId)).toEqual(['bye', 'ink', 'rumour']);
    expect(step(s, { type: 'choose', choiceId: 'greyed' }, pack, freshProfile()).events[0]).toMatchObject({ reason: '(You need a reason.)' });
    expect(step(s, { type: 'choose', choiceId: 'hidden' }, pack, freshProfile()).events[0]).toMatchObject({ reason: "'hidden' is not a choice here" });
    expect(step(s, { type: 'continue' }, pack, freshProfile()).events[0]).toMatchObject({ reason: 'choose an answer' });
    // with the Echo held (an earlier loop's), the line opens
    const prof = freshProfile({ echoes: ['echo_nine_voices'] });
    const known = talkWen({}, prof).state;
    expect(choiceViews(known, pack, prof).find((v) => v.id === 'nine')?.enabled).toBe(true);
    const spoke = run(known, [{ type: 'choose', choiceId: 'nine' }], prof);
    expect(spoke.state.reputation.remnants).toBe(1);
  });

  test('once: gone for the rest of this visit, back on the next; oncePerLoop: gone for the loop (flag_choice_…)', () => {
    const ink = run(talkWen().state, [{ type: 'choose', choiceId: 'ink' }]);
    expect(ink.state.dialogue?.choicesTaken).toEqual(['hello:ink']);
    expect(choiceViews(ink.state, pack, freshProfile()).map((v) => v.id)).not.toContain('ink');
    const again = run(ink.state, [{ type: 'choose', choiceId: 'bye' }, { type: 'talk', npcId: WEN }]);
    expect(choiceViews(again.state, pack, freshProfile()).map((v) => v.id)).toContain('ink');
    const rumour = run(again.state, [{ type: 'choose', choiceId: 'rumour' }, { type: 'continue' }, { type: 'continue' }]);
    expect(rumour.state.flags.flag_choice_scene_fixture_wen_rumour).toBe(true);
    const third = run(rumour.state, [{ type: 'talk', npcId: WEN }]);
    expect(choiceViews(third.state, pack, freshProfile()).map((v) => v.id)).toEqual(['ink', 'greyed', 'nine', 'bye']);
  });
});

describe('startDialogue: from the world, from combat (returning to it), and a scene that starts a fight', () => {
  const library = (o: StateOverrides = {}) =>
    at({
      locationId: LIBRARY,
      patch: (s) => {
        const ls: LocationState = {
          visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: ['enc_library_shades'], encounterClearedDay: {},
          eventsFired: [], flags: {}, unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
        };
        s.world.locationStates[LIBRARY] = ls;
      },
      ...o,
    });

  test('interact fires a location event (once); its startDialogue opens the scene; slipping away passes a watch', () => {
    const s = library();
    expect(ofKind(s, 'interact')).toEqual([{ type: 'interact', eventId: 'ev_fixture_alcove' }]);
    const opened = run(s, [{ type: 'interact', eventId: 'ev_fixture_alcove' }]);
    expect(ofType(opened.events, 'eventFired')[0]).toMatchObject({ eventId: 'ev_fixture_alcove', text: 'You pull the fallen shelf aside.' });
    expect(opened.state.dialogue).toMatchObject({ sceneId: 'scene_fixture_ambush', npcId: null, returnMode: 'explore' });
    const slip = run(opened.state, [{ type: 'choose', choiceId: 'slip' }]);
    expect(slip.state.mode).toBe('explore');
    expect(slip.state.clock.ticks).toBe(s.clock.ticks + 1);
    expect(slip.state.flags.flag_fixture_ambush_over).toBe(true);
    expect(ofKind(slip.state, 'interact')).toEqual([]);
    expect(step(slip.state, { type: 'interact', eventId: 'ev_fixture_alcove' }, pack, freshProfile()).events[0]).toMatchObject({
      reason: "there is nothing to do with 'ev_fixture_alcove' here",
    });
  });

  test('a choice that starts a fight closes the scene (onEnd still applies) and the fight begins', () => {
    const out = run(library(), [{ type: 'interact', eventId: 'ev_fixture_alcove' }, { type: 'choose', choiceId: 'fight' }]);
    expect(out.state.mode).toBe('combat');
    expect(out.state.dialogue).toBeNull();
    expect(out.state.combat?.encounterId).toBe('enc_library_shades');
    expect(out.state.flags.flag_fixture_ambush_over).toBe(true);
    expect(ofType(out.events, 'dialogueEnded')).toEqual([{ t: 'dialogueEnded', sceneId: 'scene_fixture_ambush' }]);
  });

  test('a scene opened in the middle of a fight returns to it (returnMode combat)', () => {
    const fight = run(library(), [{ type: 'interact', eventId: 'ev_fixture_alcove' }, { type: 'choose', choiceId: 'fight' }]).state;
    const talkStep = createStep({ ...HANDLERS, guard: (ctx) => applyAll([{ startDialogue: 'scene_fixture_boss_talk' }], ctx) }, POST_STEP_HOOKS);
    const talking = talkStep(fight, { type: 'guard' }, pack, freshProfile());
    expect(talking.state.mode).toBe('dialogue');
    expect(talking.state.dialogue).toMatchObject({ sceneId: 'scene_fixture_boss_talk', returnMode: 'combat' });
    expect(talking.state.combat).not.toBeNull();
    expect(ofType(talking.events, 'dialogueNode')[0]).toMatchObject({ speaker: 'cr_corrupted_shade', text: 'You keep coming back.' });
    const back = run(talking.state, [{ type: 'continue' }]);
    expect(back.state.mode).toBe('combat');
    expect(back.state.combat?.encounterId).toBe('enc_library_shades');
  });

  test('a scene opened from inside another replaces it and keeps the interrupted mode; it cannot start on an ending screen', () => {
    const chain = createStep({ ...HANDLERS, choose: (ctx) => applyAll([{ startDialogue: 'scene_fixture_boss_talk' }], ctx) }, POST_STEP_HOOKS);
    const s = talkWen().state;
    const out = chain(s, { type: 'choose', choiceId: 'x' }, pack, freshProfile());
    expect(out.state.dialogue).toMatchObject({ sceneId: 'scene_fixture_boss_talk', returnMode: 'explore' });
    expect(ofType(out.events, 'dialogueEnded')).toEqual([{ t: 'dialogueEnded', sceneId: WEN_SCENE }]);
    expect(out.state.flags.flag_fixture_wen_spoke).toBe(true); // the first scene's onEnd ran
    const ending = createStep({ ...HANDLERS, acknowledgeEnding: (ctx) => applyAll([{ startDialogue: 'scene_fixture_boss_talk' }], ctx) });
    const refused = ending(at({ mode: 'ending' }), { type: 'acknowledgeEnding' }, pack, freshProfile());
    expect(refused.events[0]).toMatchObject({ t: 'actionRejected', reason: 'a dialogue cannot start in ending mode' });
  });

  test('the Loop 1 Apex prompt keeps its own handler (D-074): Face it / Not yet only, no continue', () => {
    const s = at({ locationId: 'loc_chronos_nexus', quests: { q_echo_crystal: { status: 'completed', stage: 'given' } } });
    const prompt = run(s, [{ type: 'move', to: 'loc_temporal_breach_apex' }]).state;
    expect(prompt.dialogue?.sceneId).toBe('scene_apex_prompt');
    expect(legal(prompt).map((a) => a.type === 'choose' && a.choiceId)).toEqual(['face_it', 'not_yet']);
    expect(isLegal(prompt, { type: 'continue' }, pack, freshProfile())).toBe(false);
    expect(run(prompt, [{ type: 'choose', choiceId: 'not_yet' }]).state.world.currentLocationId).toBe('loc_chronos_nexus');
  });
});

describe('camp conversations (D-059, DESIGN §12.7) and loyalty', () => {
  const camp = (o: Partial<CompanionRunState> = {}, extra: StateOverrides = {}) => at({ locationId: RUINS, patch: withBrak(o), ...extra });

  test('a full rest with a companion standing in the party opens one of his camp scenes, +2 loyalty; short rests do not', () => {
    const short = run(camp(), [{ type: 'rest', kind: 'short' }]);
    expect(short.state.mode).toBe('explore');
    const full = run(camp(), [{ type: 'rest', kind: 'full' }]);
    expect(full.state.dialogue).toMatchObject({ sceneId: 'scene_fixture_camp_brak_1', npcId: 'npc_brak' });
    expect(ofType(full.events, 'dialogueNode')[0]).toMatchObject({ speaker: 'brak' });
    expect(full.state.companions.recruited.brak?.loyalty).toBe(CAMP_LOYALTY);
    const done = run(full.state, [{ type: 'continue' }]);
    expect(done.state.mode).toBe('explore');
    // the next night: the first is spent; the second needs loyalty 25
    expect(campSceneFor(done.state, pack, freshProfile())).toBeUndefined();
    expect(run(done.state, [{ type: 'rest', kind: 'full' }]).state.mode).toBe('explore');
    const trusted = run(camp({ loyalty: 30 }, { flags: { flag_scene_done_scene_fixture_camp_brak_1: true } }), [{ type: 'rest', kind: 'full' }]);
    expect(trusted.state.dialogue?.sceneId).toBe('scene_fixture_camp_brak_2');
    expect(ofType(trusted.events, 'dialogueNode')[0]).toMatchObject({ speaker: 'brak' }); // `companion` resolves to him
  });

  test('the higher priority camp scene wins when both hold; none without a companion', () => {
    expect(campSceneFor(camp({ loyalty: 30 }), pack, freshProfile())?.sceneId).toBe('scene_fixture_camp_brak_2');
    expect(campSceneFor(at({ locationId: RUINS }), pack, freshProfile())).toBeUndefined();
    expect(run(at({ locationId: RUINS }), [{ type: 'rest', kind: 'full' }]).state.mode).toBe('explore');
  });

  test("Companion's Trust: loyalty gains ×1.25, rounded (camp +2 → +3); losses unchanged", () => {
    const trust = (s: GameState) => void (s.player.attunements = ['att_companions_trust']);
    const full = run(camp({}, { patch: (s) => { withBrak()(s); trust(s); } }), [{ type: 'rest', kind: 'full' }]);
    expect(full.state.companions.recruited.brak?.loyalty).toBe(3);
    const loss = createStep({ ...HANDLERS, wait: (ctx) => applyAll([{ loyalty: { companion: 'brak', delta: -10 } }, { loyalty: { companion: 'brak', delta: 4 } }], ctx) });
    const out = loss(at({ locationId: GLOWLANDS, patch: (s) => { withBrak({ loyalty: 20 })(s); trust(s); } }), { type: 'wait' }, pack, freshProfile());
    expect(ofType(out.events, 'loyaltyChanged').map((e) => e.delta)).toEqual([-10, 5]);
  });

  test('recruitment: loyalty starts at startingLoyalty + loyalty_start, then the bond Echo adds what it is above the plain start', () => {
    const done = { [CLEAR_PATH]: { status: 'completed' as const, stage: 'done' } };
    const join: PlayEntry[] = [{ type: 'talk', npcId: 'npc_brak' }, { type: 'choose', choiceId: 'join' }];
    const plain = run(at({ locationId: PLAZA, quests: done }), join);
    expect(plain.state.companions.recruited.brak?.loyalty).toBe(4); // the scene's +4
    expect(plain.state.companions.activeId).toBe('brak');
    expect(ofType(plain.events, 'companionRecruited')).toEqual([{ t: 'companionRecruited', companionId: 'brak' }]);
    const kin = (s: GameState) => void (s.player.attunements = ['att_fixture_kinship', 'att_companions_trust']);
    const attuned = run(at({ locationId: PLAZA, quests: done, patch: kin }), join);
    expect(attuned.state.companions.recruited.brak?.loyalty).toBe(10); // 0 + 5 kinship, then +4 × 1.25
    const prof = freshProfile({ loopCounter: 2, echoes: ['echo_brak_lives'] });
    const bonded = run(at({ loop: 2, locationId: PLAZA, quests: done, patch: kin }, prof), join, prof);
    expect(bonded.state.companions.recruited.brak?.loyalty).toBe(35); // 25 bond + 5 kinship + 5 from the scene
    expect(legal(bonded.state, prof).some((a) => a.type === 'choose')).toBe(false);
  });
});

describe('legal/step agreement over the dialogue states above', () => {
  test('every enumerated talk / choose / continue / acceptQuest / interact action is accepted', () => {
    const states: [GameState, Profile?][] = [
      [at({ locationId: PLAZA })],
      [at({ locationId: GLOWLANDS })],
      [talkWen().state],
      [talkWen({ flags: { flag_fixture_offer: true } }).state],
      [run(talkWen().state, [{ type: 'choose', choiceId: 'rumour' }]).state],
      [at({ locationId: RUINS, quests: { q_echo_crystal: 'return' } })],
      [run(at({ locationId: RUINS, quests: { q_echo_crystal: 'return' } }), [{ type: 'talk', npcId: 'npc_ilyra' }]).state],
      [run(at({ locationId: RUINS, patch: withBrak() }), [{ type: 'rest', kind: 'full' }]).state],
    ];
    for (const [s, p] of states) agrees(s, p);
  });

  test('dialogue actions outside a dialogue are refused by mode; continue with nothing open is refused', () => {
    const s = at();
    expect(step(s, { type: 'continue' }, pack, freshProfile()).events[0]).toMatchObject({ reason: "'continue' is not available in explore mode" });
    const empty = at({ mode: 'dialogue' });
    expect(step(empty, { type: 'continue' }, pack, freshProfile()).events[0]).toMatchObject({ reason: 'there is nothing to continue' });
    expect(legal(empty)).toEqual([]);
  });
});
