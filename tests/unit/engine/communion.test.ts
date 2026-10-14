// U29: the communion engine (DESIGN §4.11; STORY §8.3, §8.5, §10; WORLD §6.8; PLAN §8.1 row "communion"; D-054, D-066 #6,
// D-067.3, D-069.8, D-079) on the fixture Tyrant, through `step` with the run's seeded rng: opening (Commune with
// `echo_tyrant_speaks`, or Listen; turn 1 or a phase transition; none in Phase 4), Resolve from 1 clamped 0–8, answers
// +1/+2/−2, Listen and Support once per Movement, Offer values (never consumed), the press, attacks forfeiting the
// question, rejection only at the end of Movements II/III or on a second lie (and leaving), +8 watches once at Resolve ≥ 4,
// the outcomes F ≥ 3 / A ≥ 6 / B = 8 with D-054's requirements, and a full communion to each of F, A and B.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import {
  COMMUNE_FULL_PRESS_KEY,
  COMMUNE_WINDOW_KEY,
  FLAG_TYRANT_STEADIED,
  TAG_QUESTION,
  communeActions,
  evaluate,
  legalActions,
  openProblem,
  playerOf,
  step,
  type Action,
  type CombatState,
  type Combatant,
  type CommunionState,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import type { CreatureInput, PhaseInput } from '@schema/creature';
import { companionPack } from '@tests/fixtures/companionContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { FIXTURE_VERSION, fixturePack, miniContentTables } from '@tests/fixtures/miniContent';

const content = fixturePack();
const APEX = 'loc_temporal_breach_apex';
const NEXUS = 'loc_chronos_nexus';
const TYRANT = 'cr_chronos_tyrant_unveiled';
const loop2 = freshProfile({ loopCounter: 2 });

/** Movement I/II answer Echoes; the endings' Echoes. */
const M1 = ['echo_tyrant_jailer', 'echo_thirtieth_dawn', 'echo_seven_wayfinders'];
const M2 = ['echo_litany_verse_2', 'echo_ritual_inevitable', 'echo_hallow_said_stop'];
const B_ECHOES = ['echo_litany_complete', 'echo_void_resonance', 'echo_heartstone_resonance', 'echo_anchor_mechanic'];

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);

interface Run {
  s: GameState;
  prof: Profile;
  /** The last step's events. */
  last: Ev[];
  /** Every event so far. */
  all: Ev[];
  pack: ContentPack;
}

/** Loop 2, level 18, at the Nexus with the Apex Echo (and `o.echoes`), then up the stair: the fight runs to the player's first turn. */
function arrive(o: StateOverrides = {}, prof: Profile = loop2, pack: ContentPack = content): Run {
  const s0 = makeState({ loop: 2, level: 18, locationId: NEXUS, ...o, echoes: ['echo_apex_resonance', ...(o.echoes ?? [])] }, { content: pack, profile: prof });
  const out = step(s0, { type: 'move', to: APEX }, pack, prof);
  expect(ofType(out.events, 'actionRejected')).toEqual([]);
  expect(out.state.mode).toBe('combat');
  return { s: out.state, prof: out.profile, last: out.events, all: [...out.events], pack };
}
function act(r: Run, action: Action): Run {
  const out = step(r.s, action, r.pack, r.prof);
  const rejected = ofType(out.events, 'actionRejected')[0];
  if (rejected) throw new Error(`${JSON.stringify(action)} was rejected: ${rejected.reason}`);
  return { s: out.state, prof: out.profile, last: out.events, all: [...r.all, ...out.events], pack: r.pack };
}
const run = (r: Run, actions: readonly Action[]): Run => actions.reduce(act, r);
function refused(r: Run, action: Action): string {
  const out = step(r.s, action, r.pack, r.prof);
  expect(out.state).toBe(r.s);
  return ofType(out.events, 'actionRejected')[0]?.reason ?? '(accepted)';
}
/** A writable copy of the run's state (step output is frozen in dev). */
function patch(r: Run, fn: (s: GameState, c: CombatState) => void): Run {
  const s = clone(r.s);
  fn(s, s.combat as CombatState);
  return { ...r, s };
}

const C = (r: Run): CombatState => r.s.combat as CombatState;
const comm = (r: Run): CommunionState => C(r).communion as CommunionState;
const tyrant = (r: Run): Combatant => C(r).enemies.find((e) => e.refId === TYRANT) as Combatant;
const me = (r: Run): Combatant => playerOf(C(r));

const TOGGLE: Action = { type: 'commune', act: 'toggle' };
const LISTEN: Action = { type: 'commune', act: 'listen' };
const RESIST: Action = { type: 'commune', act: 'resist' };
const speak = (answerId: string): Action => ({ type: 'commune', act: 'speak', answerId });
const offer = (itemId: string): Action => ({ type: 'commune', act: 'offer', itemId });
const attack = (r: Run): Action => ({ type: 'attack', targetUid: tyrant(r).uid });
const communeLegal = (r: Run) => legalActions(r.s, r.pack, r.prof).filter((a) => a.type === 'commune');
const resolves = (events: readonly Ev[]) => ofType(events, 'resolveChanged').map((e) => [e.reason, e.delta, e.value]);

/** The fixture pack with the Tyrant reshaped (validated like the fixture). */
function tyrantVariant(fn: (t: CreatureInput) => CreatureInput): ContentPack {
  const creatures = miniContentTables.creatures.map((c) => (c.id === TYRANT ? fn(clone(c) as CreatureInput) : c));
  return buildContentPack({ ...miniContentTables, creatures }, { version: FIXTURE_VERSION });
}
const MARK = { statusId: 'status_mark', stacks: 1, duration: 3, sourceUid: null, appliedOnOwnTurn: false };

/** The press for a player of `hpMax` at Resolve `resolve` (full: after a Listen). */
const press = (hpMax: number, resolve: number, full = false): number => Math.round(0.08 * hpMax * (full ? 1 : 1 - resolve / 8));

describe('opening (DESIGN §4.11): Commune with echo_tyrant_speaks or Listen; turn 1 or a phase transition; Loop 2+', () => {
  test('without the Echo only Listen opens it; with it Commune is free and the first question becomes the intent', () => {
    const bare = arrive();
    expect(communeLegal(bare)).toEqual([{ type: 'commune', act: 'listen' }]);
    expect(refused(bare, TOGGLE)).toBe('You do not know how to speak to it yet');
    expect(refused(bare, speak('to_kill_you'))).toBe('You are not communing');

    const r0 = arrive({ echoes: ['echo_tyrant_speaks'] });
    expect(communeLegal(r0)).toEqual([{ type: 'commune', act: 'listen' }, { type: 'commune', act: 'toggle' }]);
    const r = act(r0, TOGGLE);
    expect(r.s.combat?.phase).toBe('playerTurn'); // free: still the player's turn
    expect(ofType(r.last, 'turnStarted')).toEqual([]);
    expect(comm(r)).toEqual({ movement: 1, resolve: 1, questionIndex: 0, answered: [], usedAnswers: [], lies: 0, listened: false, supportUsed: false, clockBonusGranted: false });
    expect(r.s.world.tyrant).toBe('communing');
    expect(resolves(r.last)).toEqual([['open', 0, 1]]);
    expect(C(r).intents[tyrant(r).uid]).toEqual({ moveId: 'tyr_q_why', targetUid: me(r).uid, projected: [0, 0], hidden: false, text: 'It asks why you have come.', tags: [TAG_QUESTION] });
    // the dialogue actions: the answers that hold (no Echo answers without their Echoes), Listen, Resist
    expect(communeLegal(r)).toEqual([
      { type: 'commune', act: 'listen' },
      { type: 'commune', act: 'resist' },
      { type: 'commune', act: 'speak', answerId: 'lie' },
      { type: 'commune', act: 'speak', answerId: 'to_kill_you' },
    ]);
    expect(refused(r, TOGGLE)).toBe('You are already communing');
    expect(refused(r, { type: 'flee' })).toBe('There is no fleeing from this fight');
  });

  test('Listen opens it too: +1, the Movement\'s codex fragments, echo_tyrant_speaks — and the turn is spent', () => {
    const r = act(arrive(), LISTEN);
    expect(resolves(r.last).slice(0, 2)).toEqual([['open', 0, 1], ['listen', 1, 2]]);
    expect(r.s.echoesThisLoop).toContain('echo_tyrant_speaks');
    expect(r.prof.echoes).toContain('echo_tyrant_speaks');
    expect(ofType(r.last, 'codexUnlocked').map((e) => e.codexId)).toEqual(['codex_tyrant_holding', 'codex_tyrant_reflex']);
    expect(r.prof.codexUnlocked).toEqual(['codex_tyrant_holding', 'codex_tyrant_reflex']);
    expect(comm(r)).toMatchObject({ movement: 1, listened: true, questionIndex: 0 });
    expect(ofType(r.last, 'turnStarted').length).toBeGreaterThan(0); // the round went on
  });

  test('the window: only the first player turn — or the first after the Tyrant enters a new phase, at the matching Movement', () => {
    const r0 = arrive({ echoes: ['echo_tyrant_speaks'] });
    expect(C(r0).cooldowns[COMMUNE_WINDOW_KEY]).toBe(1);
    const later = act(r0, { type: 'guard' });
    expect(later.s.combat?.cooldowns[COMMUNE_WINDOW_KEY]).toBeUndefined();
    expect(communeLegal(later)).toEqual([]);
    expect(refused(later, TOGGLE)).toBe('Communion opens only on your first turn or at a phase transition');
    // under 75 %: at the round's end the Tyrant enters The Nine Surface; the next player turn may commune, at Movement II
    const hurt = patch(later, (_s, c) => void (c.enemies[0]!.hp = 600));
    const r1 = act(hurt, { type: 'guard' });
    expect(tyrant(r1).phase).toBe(1);
    expect(communeLegal(r1).map((a) => a.type === 'commune' && a.act)).toEqual(['listen', 'toggle']);
    const r = act(r1, TOGGLE);
    expect(comm(r)).toMatchObject({ movement: 2, questionIndex: 0, resolve: 1 });
    expect(C(r).intents[tyrant(r).uid]?.moveId).toBe('tyr_q_korr');
  });

  test('Loop 1 never; a Tyrant that holds echo_tyrant_rejected starts the next communion at Movement II (STORY §8.5)', () => {
    const r0 = arrive({ echoes: ['echo_tyrant_speaks'] });
    const loop1 = clone(r0.s);
    loop1.meta.loop = 1;
    expect(openProblem(loop1, content, loop2, loop1.combat as CombatState, 'toggle')).toBe('It cannot hear you yet');
    const remembered = act(arrive({ echoes: ['echo_tyrant_speaks'] }, freshProfile({ loopCounter: 3, echoes: ['echo_tyrant_rejected'] })), TOGGLE);
    expect(comm(remembered)).toMatchObject({ movement: 2, questionIndex: 0 });
    expect(tyrant(remembered).phase).toBe(0); // the Movement, not the fight's phase
  });
});

describe('Resolve and the answers (DESIGN §4.11 table; WORLD §6.8 conversions)', () => {
  test('starts at 1; Echo answers +1, Hallow\'s silence and Masque\'s perfect answer +2, the honest "to kill you" +1; clamped to 8', () => {
    const r0 = act(arrive({ echoes: ['echo_tyrant_speaks', ...M1, ...M2] }), TOGGLE);
    // each answer holds only with its Echo; each id once per encounter
    expect(communeLegal(r0).filter((a) => a.type === 'commune' && a.act === 'speak').map((a) => a.type === 'commune' && a.answerId)).toEqual(['lie', 'the_jailer', 'to_kill_you']);
    const r = run(r0, [speak('the_jailer'), speak('thirtieth_dawn'), speak('seven_wayfinders'), speak('verse_2'), speak('ritual_inevitable'), speak('hallow_said_stop')]);
    expect(resolves(r.all).filter(([why]) => String(why).startsWith('answer'))).toEqual([
      ['answer:tyr_q_why:the_jailer', 1, 2],
      ['answer:tyr_q_hour:thirtieth_dawn', 1, 3],
      ['answer:tyr_q_before:seven_wayfinders', 1, 4],
      ['answer:tyr_q_korr:verse_2', 1, 5],
      ['answer:tyr_q_masque:ritual_inevitable', 2, 7],
      ['answer:tyr_q_hallow:hallow_said_stop', 1, 8], // +2, clamped at 8
    ]);
    expect(comm(r)).toMatchObject({ movement: 3, questionIndex: 0, resolve: 8, lies: 0 });
    expect(comm(r).answered).toEqual(['tyr_q_why', 'tyr_q_hour', 'tyr_q_before', 'tyr_q_korr', 'tyr_q_masque', 'tyr_q_hallow']);
    expect(comm(r).usedAnswers).toEqual(['the_jailer', 'thirtieth_dawn', 'seven_wayfinders', 'verse_2', 'ritual_inevitable', 'hallow_said_stop']);
    expect(ofType(r.all, 'movementEnded')).toEqual([
      { t: 'movementEnded', movement: 1, resolve: 4 },
      { t: 'movementEnded', movement: 2, resolve: 8 },
    ]);
    expect(refused(r, speak('the_jailer'))).toBe("'the_jailer' is not an answer you can give");
  });

  test('a lie is −2 and Resolve never goes below 0; the second lie rejects at once', () => {
    const r0 = act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE);
    const r1 = act(r0, speak('lie'));
    expect(resolves(r1.last)[0]).toEqual(['answer:tyr_q_why:lie', -1, 0]); // 1 − 2, clamped
    expect(comm(r1)).toMatchObject({ lies: 1, resolve: 0, questionIndex: 1 });
    expect(ofType(r1.last, 'communionRejected')).toEqual([]);
    const r2 = act(r1, speak('lie_first_day'));
    expect(ofType(r2.last, 'communionRejected')).toEqual([{ t: 'communionRejected', reason: 'lies' }]);
    expect(C(r2).communion).toBeNull();
    expect(r2.s.world.tyrant).toBe('waiting');
  });

  test('"it is tired": below 30 % of its HP every gain is +1 more (losses are not)', () => {
    const r0 = patch(act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE), (_s, c) => void (c.enemies[0]!.hp = 250));
    const r = act(r0, speak('to_kill_you'));
    expect(resolves(r.last)[0]).toEqual(['answer:tyr_q_why:to_kill_you:tired', 2, 3]);
    const lie = act(patch(act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE), (_s, c) => void (c.enemies[0]!.hp = 250)), speak('lie'));
    expect(resolves(lie.last)[0]).toEqual(['answer:tyr_q_why:lie', -1, 0]);
  });

  test("Corruption ≥ 3 satisfies Korr (+1) and costs −1 as the next asker comes (STORY §8.3)", () => {
    const r0 = act(arrive({ echoes: ['echo_tyrant_speaks', ...M1], corruption: 3 }), TOGGLE);
    const r1 = run(r0, [speak('the_jailer'), speak('thirtieth_dawn'), speak('seven_wayfinders')]);
    const r = act(r1, speak('corrupted'));
    expect(resolves(r.last).slice(0, 2)).toEqual([['answer:tyr_q_korr:corrupted', 1, 5], ['corruption', -1, 4]]);
    expect(comm(r)).toMatchObject({ movement: 2, questionIndex: 1 });
  });
});

describe('Listen, Support, Offer, Resist (once per Movement / per encounter)', () => {
  test('Listen once per Movement, again in the next; its cost is the next press, not softened by Resolve (D-069.8: no lash)', () => {
    const r0 = act(arrive({ echoes: ['echo_tyrant_speaks', ...M1] }), TOGGLE);
    const r1 = act(r0, LISTEN);
    expect(refused(r1, LISTEN)).toBe('You have listened in this Movement');
    expect(communeLegal(r1).some((a) => a.type === 'commune' && a.act === 'listen')).toBe(false);
    // the press that follows the Listen is the full 8 % (else softened by Resolve); no other damage from the Tyrant
    const hp = me(r1).hpMax;
    const r2 = run(r1, [speak('the_jailer'), speak('thirtieth_dawn'), speak('seven_wayfinders')]);
    const presses = ofType(r2.all, 'damageDealt').filter((e) => e.sourceUid === tyrant(r2).uid);
    expect(presses.every((e) => e.refId === 'tyr_hour_presses' && e.damageType === 'chrono' && e.kind === 'intent')).toBe(true);
    expect(presses.length).toBeGreaterThan(0);
    expect(presses[0]?.amount).toBe(press(hp, 2, true));
    expect(tyrant(r2).pattern.firedOnce).not.toContain(COMMUNE_FULL_PRESS_KEY);
    expect(comm(r2)).toMatchObject({ movement: 2, listened: false });
    const r3 = act(r2, LISTEN);
    expect(ofType(r3.last, 'codexUnlocked').map((e) => e.codexId)).toEqual(['codex_tyrant_fracture']);
    expect(resolves(r3.last)[0]).toEqual(['listen', 1, comm(r2).resolve + 1]);
  });

  test('Support: Dask or Caelum in Support stance add +1 once per Movement on their turn; any other companion stands down and Guards', () => {
    const pack = companionPack();
    const withCompanion = (id: string, stance: 'support' | 'guarded') =>
      arrive(
        {
          echoes: ['echo_tyrant_speaks', ...M1],
          patch: (s) => {
            s.companions.recruited[id] = { id, recruited: true, loyalty: 60, hp: 200, hpMax: 200, ko: false, dead: false, stance, cooldowns: {}, waitingAt: null, arcFlags: {} };
            s.companions.activeId = id;
          },
        },
        loop2,
        pack,
      );
    const caelum = run(withCompanion('caelum', 'support'), [TOGGLE, speak('the_jailer'), speak('thirtieth_dawn'), speak('seven_wayfinders'), RESIST]);
    const support = ofType(caelum.all, 'resolveChanged').filter((e) => e.reason.startsWith('support'));
    expect(support.map((e) => [e.reason, e.delta, e.movement])).toEqual([
      ['support:caelum', 1, 1],
      ['support:caelum', 1, 2],
    ]); // once in Movement I, once in Movement II
    expect(ofType(caelum.all, 'movementEnded').map((e) => e.movement)).toEqual([1]);
    expect(ofType(caelum.all, 'damageDealt').some((e) => e.sourceUid === C(caelum).party[1]?.uid)).toBe(false); // it never attacks
    const ilyra = run(withCompanion('ilyra', 'support'), [TOGGLE, speak('the_jailer'), speak('thirtieth_dawn')]);
    expect(resolves(ilyra.all).some(([why]) => String(why).startsWith('support'))).toBe(false);
    const ilyraUid = C(ilyra).party[1]!.uid;
    expect(ofType(ilyra.all, 'guarded').some((e) => e.uid === ilyraUid)).toBe(true);
    expect(ofType(ilyra.all, 'damageDealt').some((e) => e.sourceUid === ilyraUid)).toBe(false);
    const guarded = run(withCompanion('caelum', 'guarded'), [TOGGLE, speak('the_jailer'), speak('thirtieth_dawn')]);
    expect(resolves(guarded.all).some(([why]) => String(why).startsWith('support'))).toBe(false);
  });

  test('Offer: the Lens +1, the Stabilized Heartstone +1, the Breach-anchor +2 (flag_anchor_offered), the Core −2; once each; never consumed', () => {
    const items = ['item_chronos_lens', 'item_stabilized_heartstone', 'item_breach_anchor', 'item_heartstone_core'];
    const r0 = act(arrive({ echoes: ['echo_tyrant_speaks'], items }), TOGGLE);
    expect(communeActions(r0.s, content, r0.prof, C(r0)).filter((a) => a.act === 'offer').map((a) => a.itemId).sort()).toEqual([...items].sort());
    const r = run(r0, items.map(offer));
    expect(resolves(r.all).filter(([why]) => String(why).startsWith('offer'))).toEqual([
      ['offer:item_chronos_lens', 1, 2],
      ['offer:item_stabilized_heartstone', 1, 3],
      ['offer:item_breach_anchor', 2, 5],
      ['offer:item_heartstone_core', -2, 3],
    ]);
    expect(r.s.flags.flag_anchor_offered).toBe(true);
    for (const id of items) expect(r.s.player.inventory.filter((i) => i.itemId === id).map((i) => i.qty)).toEqual([1]);
    expect(ofType(r.all, 'itemLost')).toEqual([]);
    expect(refused(r, offer('item_chronos_lens'))).toBe("'item_chronos_lens' is not something you can show it");
    expect(comm(r)).toMatchObject({ usedAnswers: items, questionIndex: 0, movement: 1 }); // offers answer no question
    expect(refused(act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE), offer('item_chronos_lens'))).toBe("'item_chronos_lens' is not something you can show it");
  });

  test('Resist is Guard, +0: the player guards and gains the class Guard resource; no Resolve change', () => {
    const r = act(patch(act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE), (_s, c) => void (c.party[0]!.mp = 0)), RESIST);
    expect(ofType(r.last, 'guarded').some((e) => e.uid === me(r).uid)).toBe(true);
    expect(ofType(r.last, 'resourceGained').some((e) => e.uid === me(r).uid && e.reason === 'guard')).toBe(true);
    expect(resolves(r.last)).toEqual([]);
  });
});

describe('the rhythm and the press (D-067.3)', () => {
  test('its turns alternate question (no damage) and press, from the question; the press is 8 % of max HP × (1 − Resolve/8), the chip shows it', () => {
    const r0 = act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE);
    const from = r0.all.length;
    const r = run(r0, [RESIST, RESIST, RESIST, RESIST, RESIST]);
    const uid = tyrant(r).uid;
    const since = r.all.slice(from);
    const turns = ofType(since, 'turnStarted').filter((e) => e.uid === uid).length;
    const hits = ofType(since, 'damageDealt').filter((e) => e.sourceUid === uid);
    expect(turns).toBeGreaterThanOrEqual(4);
    expect(hits).toHaveLength(Math.floor(turns / 2)); // question, press, question, press …
    for (const h of hits) expect([h.refId, h.damageType, h.amount]).toEqual(['tyr_hour_presses', 'chrono', press(me(r).hpMax, 1)]);
    const chips = ofType(since, 'intentRevealed').filter((e) => e.uid === uid).map((e) => (e.intent.tags.includes(TAG_QUESTION) ? 'q' : e.intent.moveId));
    expect([...new Set(chips)].sort()).toEqual(['q', 'tyr_hour_presses']);
    const chip = C(r).intents[uid]!;
    const shown = chip.moveId === 'tyr_hour_presses' ? chip : C(act(r, RESIST)).intents[uid]!;
    expect(shown).toMatchObject({ moveId: 'tyr_hour_presses', projected: [press(me(r).hpMax, 1), press(me(r).hpMax, 1)], tags: [] });
  });

  test('it cannot kill while Resolve ≥ 3; below 3 it can — a Loop 2 death is The Fall', () => {
    const toPress = (resolve: number) => {
      const r0 = act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE);
      // the Tyrant's next beat is the press, the player at 1 HP
      return patch(r0, (_s, c) => {
        const t = c.enemies[0]!;
        c.intents[t.uid] = { moveId: 'tyr_hour_presses', targetUid: c.party[0]!.uid, projected: [0, 0], hidden: false, text: '', tags: [] };
        (c.communion as CommunionState).resolve = resolve;
        c.party[0]!.hp = 1;
      });
    };
    const held = act(toPress(3), RESIST);
    expect(held.s.mode).toBe('combat');
    expect(me(held).hp).toBe(1);
    expect(ofType(held.last, 'damageDealt').find((e) => e.refId === 'tyr_hour_presses')?.amount).toBe(0);
    const fell = act(toPress(2), RESIST);
    expect(ofType(fell.last, 'playerDied')).toHaveLength(1);
    expect(fell.s.pendingEnding).toMatchObject({ outcome: 'closer_fall', reason: 'death' });
  });

  test('attacking forfeits the current question: it is skipped unanswered, no Resolve; the turn is spent', () => {
    const r0 = act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE);
    const r = act(r0, attack(r0));
    expect(ofType(r.last, 'attackResolved')[0]?.sourceUid).toBe(me(r0).uid);
    expect(comm(r)).toMatchObject({ questionIndex: 1, answered: [], usedAnswers: [], resolve: 1 });
    expect(resolves(r.last)).toEqual([]);
    expect(C(r).log.some((l) => l.text.includes('the question goes unanswered'))).toBe(true);
  });
});

describe('the clock: the first time in a loop Resolve reaches 4, +8 watches', () => {
  test('once: a later return to 4 pays nothing; a run that was already steadied pays nothing', () => {
    const r0 = act(arrive({ echoes: ['echo_tyrant_speaks', ...M1], items: ['item_chronos_lens'] }), TOGGLE);
    const limit = r0.s.clock.limitTicks;
    const r1 = run(r0, [speak('the_jailer'), speak('thirtieth_dawn'), speak('seven_wayfinders')]); // 4
    expect(ofType(r1.all, 'clockChanged')).toEqual([{ t: 'clockChanged', deltaWatches: 8, limitTicks: limit + 8, floored: false }]);
    expect(r1.s.flags[FLAG_TYRANT_STEADIED]).toBe(true);
    expect(comm(r1).clockBonusGranted).toBe(true);
    const r2 = run(patch(r1, (_s, c) => void ((c.communion as CommunionState).resolve = 3)), [offer('item_chronos_lens')]); // 3 → 4 again
    expect(comm(r2).resolve).toBe(4);
    expect(ofType(r2.last, 'clockChanged')).toEqual([]);
    const steadied = run(act(arrive({ echoes: ['echo_tyrant_speaks', ...M1], flags: { [FLAG_TYRANT_STEADIED]: true } }), TOGGLE), [
      speak('the_jailer'), speak('thirtieth_dawn'), speak('seven_wayfinders'),
    ]);
    expect(ofType(steadied.all, 'clockChanged')).toEqual([]);
    expect(comm(steadied)).toMatchObject({ resolve: 4, clockBonusGranted: true });
  });
});

describe('rejection (only at the end of Movements II/III, or on a second lie) and leaving', () => {
  test('Movement I may end below 3; Movement II may not: combat resumes at Phase 2, or the player leaves → closer_fall / rejected', () => {
    const r0 = act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE);
    // Movement I: one lie, two forfeits → it ends at Resolve 0, no rejection
    const r1 = run(r0, [speak('lie')]);
    const r2 = act(r1, attack(r1));
    const r3 = act(r2, attack(r2));
    expect(ofType(r3.all, 'movementEnded')).toEqual([{ t: 'movementEnded', movement: 1, resolve: 0 }]);
    expect(ofType(r3.all, 'communionRejected')).toEqual([]);
    expect(comm(r3)).toMatchObject({ movement: 2, questionIndex: 0 });
    // Movement II: forfeit all three → the end of II at Resolve 0 rejects
    const r4 = act(r3, attack(r3));
    const r5 = act(r4, attack(r4));
    const r6 = act(r5, attack(r5));
    expect(ofType(r6.last, 'movementEnded')).toEqual([{ t: 'movementEnded', movement: 2, resolve: 0 }]);
    expect(ofType(r6.last, 'communionRejected')).toEqual([{ t: 'communionRejected', reason: 'resolve' }]);
    expect(C(r6).communion).toBeNull();
    // "Combat begins at Phase 2 with no Phase 1": the Nine Surface, its add, a combat intent again
    expect(tyrant(r6).phase).toBe(1);
    expect(ofType(r6.last, 'bossPhase').map((e) => e.phase)).toEqual([1]);
    expect(C(r6).enemies.filter((e) => e.isAdd)).toHaveLength(1);
    expect(communeLegal(r6)).toEqual([]); // never again in this fight
    expect(refused(r6, LISTEN)).toBe('It will not listen to you again in this fight');
    // leaving: flee is legal (no roll) and closes the loop
    expect(legalActions(r6.s, content, r6.prof).some((a) => a.type === 'flee')).toBe(true);
    const left = act(r6, { type: 'flee' });
    expect(left.s.combat).toBeNull();
    expect(left.s.mode).toBe('ending');
    expect(left.s.pendingEnding).toMatchObject({ outcome: 'closer_fall', reason: 'rejected' });
    expect(left.s.echoesThisLoop).toContain('echo_tyrant_rejected');
    expect(left.prof.echoes).toContain('echo_tyrant_rejected');
    expect(ofType(left.last, 'combatEnded').map((e) => e.result)).toEqual(['fled']);
  });

  test('Movement III below 3 rejects too (it opened there: the phase-3 transition, Resolve 1)', () => {
    const r0 = arrive({ echoes: ['echo_tyrant_speaks'] });
    const r1 = act(patch(act(r0, { type: 'guard' }), (_s, c) => void (c.enemies[0]!.hp = 400)), { type: 'guard' });
    expect(tyrant(r1).phase).toBe(2);
    const r2 = act(r1, TOGGLE);
    expect(comm(r2)).toMatchObject({ movement: 3, questionIndex: 0 });
    expect(communeLegal(r2).filter((a) => a.type === 'commune' && a.act === 'speak')).toEqual([]); // 'Choose' needs Resolve ≥ 3
    const r = act(r2, attack(r2));
    expect(ofType(r.last, 'movementEnded')).toEqual([{ t: 'movementEnded', movement: 3, resolve: 1 }]);
    expect(ofType(r.last, 'communionRejected')).toEqual([{ t: 'communionRejected', reason: 'resolve' }]);
    expect(tyrant(r).phase).toBe(2); // already past Phase 2: never backwards
  });
});

describe('no communion Movement in Phase 4 (DESIGN §4.10); the Movements and the phases', () => {
  const phase4: PhaseInput = { id: 'tyr_phase_4', name: 'The Hold Fails', enterWhen: [{ hpBelow: 0.25 }, { round: 20 }], pattern: [{ move: 'tyr_shear', target: 'all' }] };
  const pack = tyrantVariant((t) => ({ ...t, phases: [...(t.phases ?? []), phase4] }));

  test('it cannot open in Phase 4, and a blow that drives it there closes a running communion', () => {
    const r0 = arrive({ echoes: ['echo_tyrant_speaks'] }, loop2, pack);
    const r1 = act(patch(act(r0, { type: 'guard' }), (_s, c) => void (c.enemies[0]!.hp = 200)), { type: 'guard' });
    expect(tyrant(r1).phase).toBe(3);
    expect(communeLegal(r1)).toEqual([]);
    expect(openProblem(r1.s, pack, r1.prof, C(r1), 'toggle')).toBe('The hold is failing; there is nothing left to say');
    // communing in Movement I at 232 HP (just above 25 %), a Marked Tyrant: the hit lands, it crosses every threshold
    const c0 = act(arrive({ echoes: ['echo_tyrant_speaks'] }, loop2, pack), TOGGLE);
    const c1 = patch(c0, (_s, c) => {
      const t = c.enemies[0]!;
      t.hp = 232;
      t.statuses.push({ ...MARK });
    });
    const c2 = act(c1, attack(c1));
    expect(tyrant(c2).phase).toBe(3);
    expect(C(c2).communion).toBeNull();
    expect(c2.s.world.tyrant).toBe('waiting');
  });

  test('Phase 4 by its round trigger while communing: the next player turn finds the communion closed', () => {
    const c0 = patch(act(arrive({ echoes: ['echo_tyrant_speaks'] }, loop2, pack), TOGGLE), (_s, c) => void (c.round = 19));
    const c1 = act(c0, RESIST);
    expect(C(c1).round).toBe(20);
    expect(tyrant(c1).phase).toBe(3);
    expect(C(c1).communion).toBeNull();
    expect(C(c1).log.some((l) => l.text === 'The hold fails. There is nothing left to say.')).toBe(true);
  });

  test('`communionMovementEnd` is reported to the phase triggers; the communion goes on with the next question', () => {
    const sync = tyrantVariant((t) => ({
      ...t,
      phases: (t.phases ?? []).map((p, i) => (i === 1 ? { ...p, enterWhen: [...(p.enterWhen ?? []), { event: 'communionMovementEnd' as const }] } : p)),
    }));
    const r = run(act(arrive({ echoes: ['echo_tyrant_speaks', ...M1] }, loop2, sync), TOGGLE), [speak('the_jailer'), speak('thirtieth_dawn'), speak('seven_wayfinders')]);
    expect(tyrant(r).phase).toBe(1);
    expect(comm(r)).toMatchObject({ movement: 2, questionIndex: 0 });
    expect(C(r).intents[tyrant(r).uid]?.moveId === 'tyr_q_korr' || C(r).intents[tyrant(r).uid]?.moveId === 'tyr_hour_presses').toBe(true);
    expect(ofType(r.all, 'damageDealt').filter((e) => e.sourceUid === tyrant(r).uid).every((e) => e.refId === 'tyr_hour_presses')).toBe(true);
  });

  test('a kill during communion ends it: the fight is won as usual, the Tyrant defeated, the Horde begins (U30)', () => {
    const c0 = act(arrive({ echoes: ['echo_tyrant_speaks'] }), TOGGLE);
    const c1 = patch(c0, (_s, c) => {
      const t = c.enemies[0]!;
      t.hp = 1;
      t.statuses.push({ ...MARK });
    });
    const won = act(c1, attack(c1));
    expect(won.s.mode).toBe('explore');
    expect(won.s.flags.flag_tyrant_dead).toBe(true);
    expect(won.s.world.tyrant).toBe('defeated');
    expect(won.s.world.hordeActive).toBe(true);
    expect(ofType(won.last, 'combatEnded').map((e) => e.result)).toEqual(['victory']);
  });
});

describe('the outcomes: F ≥ 3, A ≥ 6, B = 8 with D-054\'s requirements (offered in the Resolution after Movement III)', () => {
  /** A communion at the Resolution with Resolve `resolve` (set before the final answer), holding `o`. */
  function resolution(resolve: number, o: StateOverrides = {}): Run {
    const r0 = arrive({ ...o, echoes: ['echo_tyrant_speaks', ...(o.echoes ?? [])] });
    const r1 = act(patch(act(r0, { type: 'guard' }), (_s, c) => void (c.enemies[0]!.hp = 400)), { type: 'guard' });
    const r2 = patch(act(r1, TOGGLE), (_s, c) => void ((c.communion as CommunionState).resolve = resolve));
    return act(r2, speak('answer'));
  }
  const offered = (r: Run) => communeActions(r.s, content, r.prof, C(r)).map((a) => a.answerId);
  const B_STATE: StateOverrides = {
    echoes: B_ECHOES,
    items: ['item_breach_anchor'],
    reputation: { remnants: 100, weavers: 100 },
    flags: { flag_conflux_anchored: true, flag_cradle_pin_anchored: true },
  };

  test('3 → pass (F or Before); 6 with the Litany → + take its place (A); 8 with B\'s requirements → + the Mending; one missing → no Mending', () => {
    expect(offered(resolution(3))).toEqual(['let_pass', 'pass_before']);
    expect(offered(resolution(6))).toEqual(['let_pass', 'pass_before']);
    expect(offered(resolution(6, { echoes: ['echo_litany_complete'] }))).toEqual(['let_pass', 'pass_before', 'take_place']);
    expect(offered(resolution(8, B_STATE))).toEqual(['let_pass', 'pass_before', 'take_place', 'mending']);
    expect(offered(resolution(7, B_STATE))).toEqual(['let_pass', 'pass_before', 'take_place']);
    expect(offered(resolution(8, { ...B_STATE, items: [] }))).toEqual(['let_pass', 'pass_before', 'take_place']);
    expect(offered(resolution(8, { ...B_STATE, reputation: { remnants: 100 } }))).toEqual(['let_pass', 'pass_before', 'take_place']);
    expect(offered(resolution(8, { ...B_STATE, flags: { flag_conflux_anchored: true } }))).toEqual(['let_pass', 'pass_before', 'take_place']);
  });

  test('the Resolution: the Tyrant spared (flag, world, bestiary without an event, tyrantResolved); only the outcome is legal', () => {
    const r = resolution(3);
    expect(r.s.flags.flag_tyrant_spared).toBe(true);
    expect(r.s.world.tyrant).toBe('spared');
    expect(ofType(r.last, 'tyrantResolved')).toEqual([{ t: 'tyrantResolved', outcome: 'spared' }]);
    expect(r.prof.bestiary[TYRANT]).toMatchObject({ spared: 1, killed: 0 });
    expect(ofType(r.last, 'bestiaryUpdated').filter((e) => e.creatureId === TYRANT)).toEqual([]);
    expect(r.s.combat?.phase).toBe('playerTurn');
    expect(C(r).intents[tyrant(r).uid]).toBeUndefined();
    expect(legalActions(r.s, content, r.prof)).toEqual([speak('let_pass'), speak('pass_before')]);
    expect(refused(r, attack(r))).toBe('it is not your turn');
    expect(refused(r, LISTEN)).toBe('Only your answer remains');
    expect(refused(r, speak('take_place'))).toBe("'take_place' is not offered");
  });

  test('with nothing to offer the fight closes at once, spared', () => {
    const none = tyrantVariant((t) => ({ ...t, communion: { ...t.communion!, outcomes: t.communion!.outcomes.map((o) => ({ ...o, minResolve: 8 })) } }));
    const r0 = arrive({ echoes: ['echo_tyrant_speaks'] }, loop2, none);
    const r1 = act(patch(act(r0, { type: 'guard' }), (_s, c) => void (c.enemies[0]!.hp = 400)), { type: 'guard' });
    const r2 = patch(act(r1, TOGGLE), (_s, c) => void ((c.communion as CommunionState).resolve = 3));
    const r = act(r2, speak('answer'));
    expect(r.s.mode).toBe('explore');
    expect(r.s.world.tyrant).toBe('spared');
    expect(ofType(r.last, 'combatEnded').map((e) => e.result)).toEqual(['victory']);
  });

  test('let you pass into the Before (no ending): the fight closes without spoils, back to explore at the Apex, the encounter cleared', () => {
    const r = act(resolution(3), speak('pass_before'));
    expect(r.s.mode).toBe('explore');
    expect(r.s.combat).toBeNull();
    expect(r.s.flags.flag_tyrant_tear_open).toBe(true);
    expect(ofType(r.last, 'combatEnded')).toEqual([{ t: 'combatEnded', result: 'victory', rounds: C(resolution(3)).round, xp: 0, gold: 0, loot: [] }]);
    expect(r.s.counters.kills).toEqual({});
    expect(r.s.world.locationStates[APEX]?.encountersCleared).toContain('enc_apex_tyrant');
    expect(r.prof.bestiary[TYRANT]).toMatchObject({ seen: 1, spared: 1 });
    expect(ofType(r.last, 'autosaveCheckpoint')).toHaveLength(1);
  });
});

describe('a full communion to each ending, through step (STORY §10 requirement blocks hold when the ending fires)', () => {
  /** Plays the script, checks the ending's requirements at the Resolution, chooses, returns both runs. */
  function toEnding(o: StateOverrides, script: (r: Run) => Run, choiceId: string, endingId: string) {
    const r0 = arrive({ ...o, echoes: ['echo_tyrant_speaks', ...(o.echoes ?? [])] });
    const atChoice = script(act(r0, TOGGLE));
    expect(atChoice.s.world.tyrant).toBe('spared');
    // the moment its `ending` effect fires: the outcome's earlier effects (flags, Echoes) applied, the communion still readable
    const outcome = content.creatures[TYRANT]!.communion!.outcomes.find((o) => o.choiceId === choiceId)!;
    const firing = clone(atChoice.s);
    for (const e of outcome.effects.slice(0, outcome.effects.findIndex((x) => 'ending' in x))) {
      if ('setFlag' in e) firing.flags[e.setFlag] = true;
      if ('grantEcho' in e) firing.echoesThisLoop.push(e.grantEcho);
    }
    expect(evaluate(content.endings[endingId]!.requirements, firing, atChoice.prof, content)).toBe(true);
    const end = act(atChoice, speak(choiceId));
    expect(end.s.mode).toBe('ending');
    expect(end.s.combat).toBeNull();
    expect(end.s.pendingEnding).toEqual({ outcome: endingId, slideIndex: 0 });
    expect(ofType(end.last, 'endingReached')).toEqual([{ t: 'endingReached', endingId }]);
    expect(ofType(end.last, 'combatEnded').map((e) => [e.result, e.xp])).toEqual([['victory', 0]]);
    expect(end.s.flags.flag_tyrant_dead).toBeUndefined();
    expect(end.prof.bestiary[TYRANT]).toMatchObject({ spared: 1, killed: 0 });
    return { atChoice, end };
  }

  test('F · The Unbound: three answers and a Listen in I, forfeits in II, "Choose" in III — Resolve ≥ 3, every other path refused', () => {
    const { atChoice, end } = toEnding(
      { echoes: ['echo_thirtieth_dawn', 'echo_seven_wayfinders'] },
      (r) => {
        let x = run(r, [speak('to_kill_you'), LISTEN, speak('thirtieth_dawn'), speak('seven_wayfinders')]); // 1+1+1+1+1 = 5
        for (let i = 0; i < 3; i++) x = act(x, attack(x)); // Korr, Masque, Hallow unanswered
        return act(x, speak('answer'));
      },
      'let_pass',
      'ending_unbound',
    );
    expect(ofType(atChoice.all, 'movementEnded').map((e) => [e.movement, e.resolve])).toEqual([[1, 5], [2, 5], [3, 5]]);
    expect(ofType(atChoice.all, 'communionRejected')).toEqual([]);
    expect(end.s.flags.flag_refused_all_paths).toBe(true);
    // the communion's damage is the press alone; never below 1 HP once Resolve ≥ 3
    const tyrantUid = tyrant(atChoice).uid;
    const dmg = ofType(atChoice.all, 'damageDealt').filter((e) => e.sourceUid === tyrantUid);
    expect(dmg.every((e) => e.refId === 'tyr_hour_presses')).toBe(true);
    expect(me(atChoice).hp).toBeGreaterThan(0);
  });

  test('A · The Warden\'s Vigil: Echo answers through I and II (Resolve 8), the Litany complete; take its place', () => {
    const { atChoice, end } = toEnding(
      { echoes: [...M1, ...M2, 'echo_litany_complete'] },
      (r) => run(r, [speak('the_jailer'), speak('thirtieth_dawn'), speak('seven_wayfinders'), speak('verse_2'), speak('ritual_inevitable'), speak('hallow_said_stop'), speak('answer')]),
      'take_place',
      'ending_wardens_vigil',
    );
    expect(comm(atChoice).resolve).toBe(8);
    expect(end.s.flags.flag_tyrant_spared).toBe(true);
    expect(end.s.echoesThisLoop).not.toContain('echo_tyrant_consent');
  });

  test('B · The Mending: Resolve 8, the anchor shown and still in hand, two factions Trusted, both pins set; consent', () => {
    const { atChoice, end } = toEnding(
      {
        echoes: [...M1, 'echo_hallow_said_stop', ...B_ECHOES],
        items: ['item_breach_anchor', 'item_stabilized_heartstone'],
        reputation: { remnants: 100, ironclad: 100 },
        flags: { flag_conflux_anchored: true, flag_cradle_pin_anchored: true },
      },
      (r) => {
        const x = run(r, [speak('the_jailer'), speak('thirtieth_dawn'), speak('seven_wayfinders'), offer('item_breach_anchor'), LISTEN]); // 1+3+2+1 = 7
        const y = act(x, attack(x)); // Korr unanswered
        const z = act(y, attack(y)); // Masque unanswered
        return run(z, [speak('hallow_said_stop'), offer('item_stabilized_heartstone'), speak('answer')]); // 8 (clamped), 8
      },
      'mending',
      'ending_mending',
    );
    expect(comm(atChoice).resolve).toBe(8);
    expect(atChoice.s.flags.flag_anchor_offered).toBe(true);
    expect(atChoice.s.player.inventory.some((i) => i.itemId === 'item_breach_anchor')).toBe(true);
    expect(communeActions(atChoice.s, content, atChoice.prof, C(atChoice)).map((a) => a.answerId)).toEqual(['let_pass', 'pass_before', 'take_place', 'mending']);
    expect(end.s.echoesThisLoop).toContain('echo_tyrant_consent');
    expect(ofType(end.last, 'echoGained').map((e) => e.echoId)).toEqual(['echo_tyrant_consent']);
  });
});
