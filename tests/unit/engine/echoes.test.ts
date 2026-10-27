// U32: Echo rules — PLAN §8.1 row "echoes" (grant idempotent, `firstEver`, `exclusiveWith` blocks the second within a
// loop and allows it next loop, shortcuts skip quest stages, routes (hidden exits) appear, rep starts and bond loyalty
// starts apply at loop start), plus `onGrant`, Mute Ley, `echo_tyrant_jailer`'s two-of-five rule (D-067.16) and the
// loop-end grants (STORY §12: bond Echoes at loyalty ≥ 50, the Ironclad/Weaver oaths at Trusted). DESIGN §10.4–10.5,
// §12.5, §15.1; STORY §5.5, §11, §12; D-010.
import { describe, expect, test } from 'bun:test';
import {
  BOND_ECHOES,
  BOND_LOYALTY,
  ECHO_REP_STARTS,
  ECHO_TYRANT_JAILER,
  HANDLERS,
  JAILER_SOURCES,
  POST_STEP_HOOKS,
  applyAll,
  applyLoopStartEchoes,
  bondLoyalty,
  createStep,
  echoPostStep,
  isLegal,
  jailerSourcesHeld,
  legalActions,
  makeCtx,
  repStarts,
  shortcutFor,
  step,
  type Action,
  type CompanionRunState,
  type GameEvent,
  type GameState,
  type Profile,
  type QuestState,
} from '@engine/index';
import type { Effect } from '@schema/effect';
import { ENGINE_GRANTED_ECHOES } from '@schema/echo';
import { clone } from '@engine/util/clone';
import { DEPTHS, beforePack } from '@tests/fixtures/beforeContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';

const pack = beforePack();
const RUINS = 'loc_whispering_ruins';
const NEXUS = 'loc_chronos_nexus';
const LANTERN = 'q_lantern_in_the_reeds';

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
const echoesGained = (events: readonly Ev[]) => ofType(events, 'echoGained').map((e) => e.echoId);

/** `step` whose `wait` applies `effects` (a stand-in for the dialogue/quest reducers of U33), with every post-step hook. */
const effectStep = (effects: readonly Effect[]) => createStep({ ...HANDLERS, wait: (ctx) => applyAll(effects, ctx) }, POST_STEP_HOOKS);
const WAIT: Action = { type: 'wait' };

/** Loop `loop`, standing in the Glowlands (a waitable node) unless told otherwise. */
function at(loop: number, o: StateOverrides = {}, profile: Profile = freshProfile({ loopCounter: loop })) {
  const s = makeState({ loop, locationId: 'loc_veridian_glowlands', ...o }, { content: pack, profile });
  return { s, profile };
}
function run(effects: readonly Effect[], s: GameState, profile: Profile) {
  const out = effectStep(effects)(s, WAIT, pack, profile);
  const rejected = ofType(out.events, 'actionRejected')[0];
  if (rejected) throw new Error(`rejected: ${rejected.reason}`);
  return out;
}
const companion = (id: string, o: Partial<CompanionRunState> = {}): CompanionRunState => ({
  id, recruited: true, loyalty: 0, hp: 90, hpMax: 90, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {}, ...o,
});

describe('granting (effects.ts grantEcho, D-010)', () => {
  test('a grant is idempotent within a loop: one echoGained, one entry, one count', () => {
    const { s, profile } = at(2);
    const out = run([{ grantEcho: 'echo_flickering_man' }, { grantEcho: 'echo_flickering_man' }], s, profile);
    expect(echoesGained(out.events)).toEqual(['echo_flickering_man']);
    expect(out.state.echoesThisLoop.filter((id) => id === 'echo_flickering_man')).toHaveLength(1);
    expect(out.state.counters.echoesGainedThisLoop).toBe(1);
    const again = run([{ grantEcho: 'echo_flickering_man' }], out.state, out.profile);
    expect(echoesGained(again.events)).toEqual([]);
    expect(again.profile).toBe(out.profile); // nothing written
  });

  test('firstEver: true the first time the profile sees it, false when an earlier loop already earned it', () => {
    const fresh = at(2);
    const first = run([{ grantEcho: 'echo_breach_recoil' }], fresh.s, fresh.profile);
    expect(ofType(first.events, 'echoGained')[0]).toEqual({ t: 'echoGained', echoId: 'echo_breach_recoil', firstEver: true });
    expect(first.profile.echoes).toContain('echo_breach_recoil');
    const known = at(3, {}, freshProfile({ loopCounter: 3, echoes: ['echo_breach_recoil'] }));
    const again = run([{ grantEcho: 'echo_breach_recoil' }], known.s, known.profile);
    expect(ofType(again.events, 'echoGained')[0]).toEqual({ t: 'echoGained', echoId: 'echo_breach_recoil', firstEver: false });
    expect(again.state.echoesThisLoop).toContain('echo_breach_recoil'); // this loop's record carries it
    expect(again.profile.echoes.filter((id) => id === 'echo_breach_recoil')).toHaveLength(1);
  });

  test('exclusiveWith blocks the second Echo in the same loop, either way round, and allows it the next loop', () => {
    const { s, profile } = at(2);
    const out = run([{ grantEcho: 'echo_heartstone_resonance' }, { grantEcho: 'echo_heartstone_hunger' }, { grantEcho: 'echo_heartstone_silence' }], s, profile);
    expect(echoesGained(out.events)).toEqual(['echo_heartstone_resonance']);
    expect(out.state.echoesThisLoop).not.toContain('echo_heartstone_hunger');
    expect(out.profile.echoes).not.toContain('echo_heartstone_hunger');
    // the next loop: the profile holds Resonance, but this loop holds nothing — Hunger is allowed, and then blocks the rest
    const next = at(3, {}, freshProfile({ loopCounter: 3, echoes: out.profile.echoes }));
    const later = run([{ grantEcho: 'echo_heartstone_hunger' }, { grantEcho: 'echo_heartstone_resonance' }], next.s, next.profile);
    expect(echoesGained(later.events)).toEqual(['echo_heartstone_hunger']);
    for (const id of ['echo_heartstone_resonance', 'echo_heartstone_hunger']) expect(later.profile.echoes).toContain(id);
  });

  test('a symmetric pair blocks even when only one record names the other', () => {
    // fixture: echo_heartstone_resonance names hunger/silence; the reverse direction is checked too
    const { s, profile } = at(2, { echoes: ['echo_heartstone_silence'] });
    const out = run([{ grantEcho: 'echo_heartstone_resonance' }], s, profile);
    expect(echoesGained(out.events)).toEqual([]);
  });

  test("an Echo's onGrant effects apply with the grant (echo_before_route unlocks its codex entry)", () => {
    const { s, profile } = at(2);
    const out = run([{ grantEcho: 'echo_before_route' }], s, profile);
    expect(ofType(out.events, 'codexUnlocked').map((e) => e.codexId)).toEqual(['codex_tyrant_holding']);
    expect(out.profile.codexUnlocked).toContain('codex_tyrant_holding');
  });

  test('every Echo the engine grants is on ENGINE_GRANTED_ECHOES (D-082)', () => {
    for (const id of [ECHO_TYRANT_JAILER, ...Object.values(BOND_ECHOES), 'echo_ironclad_oath', 'echo_weaver_sign', 'echo_before_route', 'echo_anchor_mechanic']) {
      expect(ENGINE_GRANTED_ECHOES).toContain(id);
    }
  });
});

describe('echo_tyrant_jailer: any two of five sources (STORY §5.5, D-067.16)', () => {
  test('one source is not enough; the second grants it in the same step', () => {
    const { s, profile } = at(2);
    const one = run([{ grantEcho: 'echo_flickering_man' }], s, profile);
    expect(one.state.echoesThisLoop).not.toContain(ECHO_TYRANT_JAILER);
    const two = run([{ grantEcho: 'echo_tyrant_speaks' }], one.state, one.profile);
    expect(echoesGained(two.events)).toEqual(['echo_tyrant_speaks', ECHO_TYRANT_JAILER]);
    expect(two.profile.echoes).toContain(ECHO_TYRANT_JAILER);
  });

  test('sources from different loops count (the profile holds one, this loop earns the other)', () => {
    const { s, profile } = at(3, {}, freshProfile({ loopCounter: 3, echoes: ['echo_ninth_verse_unfinished'] }));
    const out = run([{ grantEcho: 'echo_breach_recoil' }], s, profile);
    expect(out.state.echoesThisLoop).toContain(ECHO_TYRANT_JAILER);
  });

  test('the fifth source is a pair: the thirtieth dawn alone, or the Ledger alone, does not count', () => {
    const p = freshProfile({ loopCounter: 3, echoes: ['echo_thirtieth_dawn', 'echo_flickering_man'] });
    const half = at(3, {}, p);
    expect(jailerSourcesHeld(half.s, half.profile)).toBe(1);
    expect(run([], half.s, half.profile).state.echoesThisLoop).not.toContain(ECHO_TYRANT_JAILER);
    const whole = run([{ grantEcho: 'echo_seven_wayfinders' }], half.s, half.profile);
    expect(jailerSourcesHeld(whole.state, whole.profile)).toBe(2);
    expect(whole.state.echoesThisLoop).toContain(ECHO_TYRANT_JAILER);
    expect(new Set(Object.values(JAILER_SOURCES)).size).toBe(5);
  });

  test('two sources held from earlier loops: granted at the first step of the next loop, never twice', () => {
    const prof = freshProfile({ loopCounter: 4, echoes: ['echo_flickering_man', 'echo_tyrant_speaks'] });
    const title = makeState({ loop: 4, mode: 'title' }, { content: pack, profile: prof });
    const out = step(title, { type: 'newGame', name: 'Wayfinder', classId: 'ranger' }, pack, prof);
    expect(out.state.echoesThisLoop).toContain(ECHO_TYRANT_JAILER);
    const held = freshProfile({ loopCounter: 4, echoes: ['echo_flickering_man', 'echo_tyrant_speaks', ECHO_TYRANT_JAILER] });
    const again = step(title, { type: 'newGame', name: 'Wayfinder', classId: 'ranger' }, pack, held);
    expect(again.state.echoesThisLoop).not.toContain(ECHO_TYRANT_JAILER);
  });
});

describe('loop-start effects', () => {
  const newGame = (prof: Profile) => step(makeState({ loop: prof.loopCounter, mode: 'title' }, { content: pack, profile: prof }), { type: 'newGame', name: 'W', classId: 'ranger' }, pack, prof);

  test('rep starts: the watchword, the hand-sign and the oath start their faction at 20 (Trusted), with events', () => {
    const prof = freshProfile({ loopCounter: 3, echoes: Object.keys(ECHO_REP_STARTS) });
    const out = newGame(prof);
    expect(out.state.reputation).toEqual({ remnants: 20, weavers: 20, ironclad: 20 });
    const changes = ofType(out.events, 'reputationChanged');
    expect(changes.map((e) => [e.faction, e.delta, e.tierBefore, e.tierAfter])).toEqual([
      ['remnants', 20, 'neutral', 'trusted'],
      ['weavers', 20, 'neutral', 'trusted'],
      ['ironclad', 20, 'neutral', 'trusted'],
    ]);
    // before the start location's arrival (its events and encounters see the start)
    const loopStarted = out.events.findIndex((e) => e.t === 'loopStarted');
    const entered = out.events.findIndex((e) => e.t === 'locationEntered');
    expect(out.events.findIndex((e) => e.t === 'reputationChanged')).toBeGreaterThan(loopStarted);
    expect(out.events.findIndex((e) => e.t === 'reputationChanged')).toBeLessThan(entered);
  });

  test('no rep-start Echo, no change; a start never lowers a faction already higher', () => {
    expect(newGame(freshProfile({ loopCounter: 2 })).state.reputation).toEqual({ remnants: 0, weavers: 0, ironclad: 0 });
    const { s, profile } = at(3, { reputation: { remnants: 35 } }, freshProfile({ loopCounter: 3, echoes: ['echo_ilyra_watchword'] }));
    const ctx = makeCtx(clone(s), profile, pack);
    applyLoopStartEchoes(ctx);
    expect(ctx.s.reputation.remnants).toBe(35);
    expect(ofType(ctx.events, 'reputationChanged')).toEqual([]);
  });

  test('bond loyalty: a companion recruited with its bond Echo starts at 25 (Brak with echo_brak_lives)', () => {
    const prof = freshProfile({ loopCounter: 3, echoes: ['echo_nyx_bond', 'echo_brak_lives'] });
    const { s } = at(3, {}, prof);
    const out = run([{ recruit: 'nyx' }, { recruit: 'brak' }, { recruit: 'dask' }], s, prof);
    expect(out.state.companions.recruited.nyx?.loyalty).toBe(BOND_LOYALTY);
    expect(out.state.companions.recruited.brak?.loyalty).toBe(BOND_LOYALTY);
    expect(out.state.companions.recruited.dask?.loyalty).toBe(0);
    expect(ofType(out.events, 'loyaltyChanged').map((e) => [e.companionId, e.delta, e.value])).toEqual([
      ['nyx', 25, 25],
      ['brak', 25, 25],
    ]);
    expect(bondLoyalty(out.state, prof, 'dask')).toBe(0);
  });

  test('bond loyalty also applies to a companion already in the party when the loop starts; never lowers it', () => {
    const prof = freshProfile({ loopCounter: 3, echoes: ['echo_ilyra_bond', 'echo_mireya_bond'] });
    const { s } = at(3, { patch: (st) => void Object.assign(st.companions.recruited, { ilyra: companion('ilyra'), mireya: companion('mireya', { loyalty: 40 }) }) }, prof);
    const ctx = makeCtx(clone(s), prof, pack);
    applyLoopStartEchoes(ctx);
    expect(ctx.s.companions.recruited.ilyra?.loyalty).toBe(25);
    expect(ctx.s.companions.recruited.mireya?.loyalty).toBe(40);
  });

  test("shortcuts skip quest stages: a quest started with its Echo held opens at the shortcut's stage", () => {
    const prof = freshProfile({ loopCounter: 2, echoes: ['echo_glowlands_leak', 'echo_crystal_location'] });
    const { s } = at(2, {}, prof);
    const out = run([{ questStart: LANTERN }, { questStart: 'q_echo_crystal' }], s, prof);
    expect(out.state.quests[LANTERN]?.stage).toBe('gather');
    expect(out.state.quests.q_echo_crystal?.stage).toBe('crystal_found');
    expect(ofType(out.events, 'questAdvanced').filter((e) => e.questId === LANTERN).map((e) => e.stage)).toEqual(['the_shining', 'gather']);
    expect(ofType(out.events, 'log').map((e) => e.text)).toContain('She already knows you know what the light is.');
    // without the Echo it opens at its first stage
    const plain = at(2);
    expect(run([{ questStart: LANTERN }], plain.s, plain.profile).state.quests[LANTERN]?.stage).toBe('the_shining');
  });

  test('a quest already running at loop start (started at the Threshold, D-067.15) moves on to its shortcut; one past it stays', () => {
    const prof = freshProfile({ loopCounter: 3, echoes: ['echo_glowlands_leak'] });
    const running = (stage: string): QuestState => ({ status: 'active', stage, startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] });
    for (const [from, to] of [['the_shining', 'gather'], ['tend', 'tend']] as const) {
      const { s } = at(3, { patch: (st) => void (st.quests[LANTERN] = running(from)) }, prof);
      const ctx = makeCtx(clone(s), prof, pack);
      applyLoopStartEchoes(ctx);
      expect(ctx.s.quests[LANTERN]?.stage).toBe(to);
    }
  });

  test('Mute Ley (disable_echo_shortcuts) turns off shortcuts and rep starts; bond starts stay', () => {
    const prof = freshProfile({ loopCounter: 3, echoes: ['echo_glowlands_leak', 'echo_ilyra_watchword', 'echo_nyx_bond'] });
    const { s } = at(3, { patch: (st) => void st.meta.modifiers.push('mod_mute_ley') }, prof);
    expect(shortcutFor(s, prof, pack, LANTERN)).toBeUndefined();
    expect(repStarts(s, prof, pack)).toEqual({});
    const ctx = makeCtx(clone(s), prof, pack);
    applyLoopStartEchoes(ctx);
    expect(ctx.s.reputation.remnants).toBe(0);
    const out = run([{ questStart: LANTERN }, { recruit: 'nyx' }], s, prof);
    expect(out.state.quests[LANTERN]?.stage).toBe('the_shining');
    expect(out.state.companions.recruited.nyx?.loyalty).toBe(25);
  });

  test('routes: a hidden exit gated on an Echo appears once it is held — this loop, and from the start of later loops', () => {
    const down: Action = { type: 'move', to: DEPTHS };
    const { s, profile } = at(2, { locationId: NEXUS });
    expect(isLegal(s, down, pack, profile)).toBe(false);
    expect(legalActions(s, pack, profile).some((a) => a.type === 'examine' && a.target.kind === 'exit' && a.target.to === DEPTHS)).toBe(false);
    const rejected = step(s, down, pack, profile);
    expect(rejected.state).toBe(s);
    const granted = run([{ grantEcho: 'echo_heartstone_path' }], s, profile);
    expect(isLegal(granted.state, down, pack, granted.profile)).toBe(true);
    const later = at(3, { locationId: NEXUS }, freshProfile({ loopCounter: 3, echoes: ['echo_heartstone_path'] }));
    expect(isLegal(later.s, down, pack, later.profile)).toBe(true);
    const walked = step(later.s, down, pack, later.profile);
    expect(walked.state.world.currentLocationId).toBe(DEPTHS);
  });
});

describe('loop-end grants (STORY §12 "at a loop\'s end")', () => {
  /** Loop 2 at the Ruins' camp; *Let go* closes the loop. */
  function letGo(o: StateOverrides, prof = freshProfile({ loopCounter: 2 })) {
    const s = makeState({ loop: 2, locationId: RUINS, ...o }, { content: pack, profile: prof });
    const out = step(s, { type: 'letGo' }, pack, prof);
    expect(ofType(out.events, 'actionRejected')).toEqual([]);
    return out;
  }

  test('bond Echoes for companions at loyalty ≥ 50, oaths for factions at Trusted or better — in the record', () => {
    const out = letGo({
      reputation: { ironclad: 20, weavers: 19, remnants: 60 },
      patch: (st) =>
        void Object.assign(st.companions.recruited, {
          nyx: companion('nyx', { loyalty: 50 }),
          ilyra: companion('ilyra', { loyalty: 49 }),
          caelum: companion('caelum', { loyalty: 80, dead: true }),
          brak: companion('brak', { loyalty: 90 }),
        }),
    });
    const gained = echoesGained(out.events);
    expect(gained).toEqual(['echo_nyx_bond', 'echo_ironclad_oath']);
    const ended = ofType(out.events, 'loopEnded')[0];
    for (const id of gained) {
      expect(ended?.record.echoesGained).toContain(id);
      expect(out.profile.echoes).toContain(id);
    }
    expect(out.events.findIndex((e) => e.t === 'echoGained')).toBeLessThan(out.events.findIndex((e) => e.t === 'loopEnded'));
  });

  test('Weavers at Sworn grant the hand-sign; nothing at a loop end that earned nothing', () => {
    expect(echoesGained(letGo({ reputation: { weavers: 60 } }).events)).toEqual(['echo_weaver_sign']);
    expect(echoesGained(letGo({}).events)).toEqual([]);
  });

  test('the hook only acts on the closing step (ending-mode steps after it grant nothing)', () => {
    const closed = letGo({ reputation: { ironclad: 30 } });
    const ctx = makeCtx(clone(closed.state), closed.profile, pack);
    echoPostStep(ctx);
    expect(ctx.events).toEqual([]);
  });
});
