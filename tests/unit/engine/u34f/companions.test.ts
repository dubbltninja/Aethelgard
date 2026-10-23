// U34f — the companion gaps D-112 and D-113 queued, played on the real pack with deterministic seeds or scripted draws:
//   1. refusals (STORY §7): each record's `refusesWhen`, read by `companionAllowedAt` / `companionBarredAt` as if standing on
//      the node; an active companion steps out with the line, waits at the last node it walked with you (a refusal of
//      company: at home) and falls back in where it may stand; no fight fields it, no swap brings it;
//   2. Dask and the Tyrant (DESIGN §12.5): −30 on the kill (`onDefeat`), +3 on sparing it (`communion.onSpared`); Phase 3 one
//      voice quieter with `echo_dask_rest`;
//   3. Brak's *Named* (STORY §7.2): Hold the Line shields the party; Ilyra's *Unbound Hand* stays flavour (no data);
//   4. Dray's tie (D-113): a refused Ledger offer no longer hides the Keeper's Price.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import {
  FLICKERED_FLAG,
  beginCombat,
  companionAllowedAt,
  companionBarredAt,
  companionRefusal,
  generateIntent,
  legalActions,
  runCombat,
  step,
  swapProblem,
  type Action,
  type CombatState,
  type Combatant,
  type CommunionState,
  type CompanionRunState,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import type { CreatureInput } from '@schema/creature';
import { D, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';
import { FIXTURE_VERSION, miniContentTables } from '@tests/fixtures/miniContent';

const pack = buildContentPack();
const STORY = fs.readFileSync(path.resolve(import.meta.dirname, '../../../../docs/STORY.md'), 'utf8').replace(/\s+/g, ' ');
const loop2 = freshProfile({ loopCounter: 2 });

const APEX = 'loc_temporal_breach_apex';
const NEXUS = 'loc_chronos_nexus';
const VEIL_MOUTH = 'loc_veil_mouth';
const HOLLOW = 'loc_voidscar_hollow';
const OUTPOST = 'loc_blighted_outpost';
const FORGE = 'loc_emberforge';
const CAMP = 'loc_ironclad_camp';
const TYRANT = 'cr_chronos_tyrant_unveiled';

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
const logs = (events: readonly Ev[]): string[] => ofType(events, 'log').map((e) => e.text);
const run = (id: string, over: Partial<CompanionRunState> = {}): CompanionRunState => {
  const hp = pack.companions[id]?.stats.hp ?? 80;
  return { id, recruited: true, loyalty: 0, hp, hpMax: hp, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {}, ...over };
};
/** Loop 2 (unless `o.loop`), `active` in the party, the others recruited as given. */
function party(active: string | null, o: StateOverrides = {}, others: Record<string, Partial<CompanionRunState>> = {}): GameState {
  return makeState(
    {
      loop: 2,
      level: 12,
      ...o,
      patch: (s) => {
        if (active !== null) {
          s.companions.recruited[active] = run(active);
          s.companions.activeId = active;
        }
        for (const [id, over] of Object.entries(others)) s.companions.recruited[id] = run(id, over);
        o.patch?.(s);
      },
    },
    { content: pack, profile: loop2 },
  );
}
const why = (id: string, at: string, o: StateOverrides = {}, others: Record<string, Partial<CompanionRunState>> = {}): string | null =>
  companionRefusal(party(null, o, others), pack, loop2, id, at);
const questState = (status: 'active' | 'completed' | 'failed', stage = 'start') => ({ status, stage, startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] });

// ---- 1. the data (STORY §7 "Refusals") ------------------------------------------------------------------------------------------

describe('refusesWhen: every STORY §7 refusal of a place (or of company), read as if standing on the node', () => {
  test('STORY’s quoted words are verbatim in the lines', () => {
    expect(STORY).toContain('Will not enter the Veil ("That place reads you back")');
    expect(STORY).toContain('("That thing\'s in your pack hurting you and you want *me* to hold a line?")');
    expect(STORY).toContain('Will not stand in Silverwood Before ("Two of me is one too many")');
    expect(STORY).toContain('"I am not ready to see his face. I was never ready.');
    expect(STORY).toContain('("That\'s the cradle. Hallow *made* that")');
    expect(why('ilyra', VEIL_MOUTH)).toContain('"That place reads you back."');
    expect(why('brak', APEX, { flags: { flag_heartstone_exploited: true } })).toContain('"That thing\'s in your pack hurting you and you want me to hold a line?"');
    expect(why('nyx', 'loc_grand_library')).toContain('"Two of me is one too many."');
    expect(why('nyx', APEX)).toContain('"I am not ready to see his face. I was never ready."');
    expect(why('caelum', 'loc_heartstone_depths', { quests: { q_echoing_heartbeat: 'descend' } })).toContain('"That\'s the cradle. Hallow made that."');
  });

  test('Ilyra: the whole Veil; the Apex in Loop 1 only', () => {
    const veil = Object.values(pack.locations).filter((l) => l.regionId === 'region_veil');
    expect(veil.length).toBeGreaterThan(5);
    for (const l of veil) expect([l.id, why('ilyra', l.id) !== null]).toEqual([l.id, true]);
    expect([why('ilyra', HOLLOW), why('ilyra', APEX), why('ilyra', NEXUS)]).toEqual([null, null, null]);
    expect(why('ilyra', APEX, { loop: 1 })).toBe('Ilyra will not climb to the Apex. "Not this time, Wayfinder. I would only be in your way." She waits below.');
  });

  test('Brak: the Hollow Choir (the Sanctum of Threads); Nyx walking behind him; the Apex after an Exploit', () => {
    expect(why('brak', 'loc_sanctum_of_threads')).toContain('Hollow Choir');
    expect(why('brak', VEIL_MOUTH)).toBeNull();
    expect(why('brak', APEX)).toBeNull();
    expect(why('brak', APEX, { flags: { flag_heartstone_destroyed: true } })).toBeNull();
    // Nyx recruited and waiting nowhere (walking with the party) — not when she waits somewhere, is down and away, or is gone
    expect(why('brak', CAMP, {}, { nyx: {} })).toBe('Brak will not walk with Nyx at his back. "Not her. Not behind me." He goes back to the Camp to wait.');
    expect(why('brak', CAMP, {}, { nyx: { waitingAt: 'loc_chasm_of_whispers' } })).toBeNull();
    expect(why('brak', CAMP, {}, { nyx: { dead: true } })).toBeNull();
  });

  test('Nyx: the Emberforge; the Apex until `q_what_she_would_undo` is resolved; all of Silverwood Before', () => {
    expect(why('nyx', FORGE)).toContain("Hallow's fire");
    expect(why('nyx', OUTPOST)).toBeNull();
    expect(why('nyx', APEX, { quests: { q_what_she_would_undo: 'plan' } })).not.toBeNull();
    for (const status of ['completed', 'failed'] as const) {
      expect(why('nyx', APEX, { patch: (s) => void (s.quests.q_what_she_would_undo = questState(status)) })).toBeNull();
    }
    const before = Object.values(pack.locations).filter((l) => l.regionId === 'region_silverwood_before');
    expect(before.length).toBeGreaterThan(5);
    for (const l of before) expect([l.id, why('nyx', l.id)]).toEqual([l.id, 'Nyx will not cross into the Before. "Two of me is one too many."']);
  });

  test('Dask: silent toward Nyx while she walks with you, until she has been unmasked this loop; his place rule first', () => {
    const silence = 'Dask says nothing while the Weaver woman walks with you, and between one instant and the next he is not there.';
    expect(why('dask', NEXUS, {}, { nyx: {} })).toBe(silence);
    expect(why('dask', NEXUS, { flags: { flag_scene_done_scene_nyx_unmasking: true } }, { nyx: {} })).toBeNull();
    expect(why('dask', NEXUS)).toBeNull();
    const s = party(null);
    expect(companionBarredAt(s, pack, loop2, 'dask', OUTPOST)).toBe('Dask flickers and cannot follow.');
    expect(companionBarredAt(s, pack, loop2, 'dask', NEXUS)).toBeNull();
  });

  test('Mireya: not out of the Glowfen while `q_lantern_in_the_reeds` runs; Caelum: not the Library before his second quest, not the Depths while the Heartstone’s choice is open', () => {
    const lantern = (status: 'active' | 'completed') => ({ patch: (s: GameState) => void (s.quests.q_lantern_in_the_reeds = questState(status)) });
    expect(why('mireya', CAMP, lantern('active'))).toContain('will not leave the Glowfen');
    expect(why('mireya', 'loc_lanternreed', lantern('active'))).toBeNull();
    expect(why('mireya', CAMP, lantern('completed'))).toBeNull();
    expect(why('mireya', CAMP)).toBeNull();
    expect(why('caelum', 'loc_shattered_library')).toContain('I know what this was');
    expect(why('caelum', 'loc_shattered_library', { patch: (s) => void (s.quests.q_a_boy_from_a_doomed_city = questState('active')) })).toBeNull();
    expect(why('caelum', 'loc_heartstone_depths')).toBeNull();
    expect(why('caelum', 'loc_heartstone_depths', { quests: { q_echoing_heartbeat: 'descend' } })).not.toBeNull();
  });
});

// ---- 1. the engine ---------------------------------------------------------------------------------------------------------------

describe('stepping out, waiting, falling back in (engine: applyLocationRule, swapProblem, fight setup)', () => {
  test('Nyx at the Emberforge door: she stays at the Outpost with her line, and falls back in on the way out (seeded run, real moves)', () => {
    const s = party('nyx', { locationId: OUTPOST });
    const into = play(s, [{ type: 'move', to: FORGE }], { content: pack, profile: loop2 });
    expect(ofType(into.events, 'companionSwapped')).toEqual([{ t: 'companionSwapped', activeId: null }]);
    expect(logs(into.events)).toContain('Nyx will not go near the Emberforge. "Hallow\'s fire. I have stood in it once." She waits outside.');
    expect(into.state.companions.activeId).toBeNull();
    expect(into.state.companions.recruited.nyx).toMatchObject({ waitingAt: OUTPOST, arcFlags: { [FLICKERED_FLAG]: true } });
    // she will not be swapped in here either, and the enumerator agrees
    expect(swapProblem(into.state, pack, loop2, 'nyx')).not.toBeNull();
    expect(legalActions(into.state, pack, loop2).filter((a) => a.type === 'swapCompanion' && a.companionId === 'nyx')).toEqual([]);
    const out = play(into.state, [{ type: 'move', to: OUTPOST }], { content: pack, profile: loop2 });
    expect(ofType(out.events, 'companionSwapped')[0]).toEqual({ t: 'companionSwapped', activeId: 'nyx' });
    expect(logs(out.events)).toContain('Nyx falls back into step beside you.');
    expect(out.state.companions.recruited.nyx).toMatchObject({ waitingAt: null, arcFlags: {} });
  });

  test('a node she could not stand on before either: the last node is skipped, and she waits nowhere if there is none', () => {
    // placed in the Veil by hand, coming from another Veil node: no allowed previous node → her home (the Ruins)
    const s = party('ilyra', { locationId: VEIL_MOUTH, patch: (st) => void (st.world.previousLocationId = 'loc_stair_of_unmaking') });
    const out = play(s, [{ type: 'examine', target: { kind: 'location' } }], { content: pack, profile: loop2 });
    expect(out.state.companions.recruited.ilyra).toMatchObject({ waitingAt: 'loc_whispering_ruins', arcFlags: { [FLICKERED_FLAG]: true } });
    expect(logs(out.events)).toContain('Ilyra stops where the Veil begins. "That place reads you back." She will wait on this side.');
    // from the Hollow (allowed): she waits there
    const fromHollow = party('ilyra', { locationId: VEIL_MOUTH, patch: (st) => void (st.world.previousLocationId = HOLLOW) });
    expect(play(fromHollow, [{ type: 'examine', target: { kind: 'location' } }], { content: pack, profile: loop2 }).state.companions.recruited.ilyra?.waitingAt).toBe(HOLLOW);
  });

  test('no fight fields a companion where it refuses to stand', () => {
    const s = party('ilyra', { locationId: VEIL_MOUTH });
    const ctx = scriptedCtx(s, [D.d4(4), D.d4(1)], pack, loop2);
    beginCombat(ctx, { id: 'enc_u34f', groups: [{ creatureId: 'cr_corrupted_shade', count: 1 }], fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] });
    expect(ctx.s.combat?.party.map((c) => c.kind)).toEqual(['player']);
  });

  test('Brak and Nyx behind him: recruiting her while he leads sends him to the Camp; he will not be swapped back while she walks with you', () => {
    const s = party('brak', { locationId: 'loc_chasm_of_whispers' }, { nyx: {} });
    const out = play(s, [{ type: 'examine', target: { kind: 'location' } }], { content: pack, profile: loop2 });
    expect(out.state.companions.activeId).toBeNull();
    expect(out.state.companions.recruited.brak).toMatchObject({ waitingAt: CAMP, arcFlags: { [FLICKERED_FLAG]: true } });
    expect(logs(out.events)).toContain('Brak will not walk with Nyx at his back. "Not her. Not behind me." He goes back to the Camp to wait.');
    // Nyx is still at hand: swap her in; Brak goes home for good (no rejoin while someone holds the place)
    expect(swapProblem(out.state, pack, loop2, 'nyx')).toBeNull();
    const swapped = play(out.state, [{ type: 'swapCompanion', companionId: 'nyx' }], { content: pack, profile: loop2 });
    expect([swapped.state.companions.activeId, swapped.state.companions.recruited.brak?.waitingAt, swapped.state.companions.recruited.brak?.arcFlags]).toEqual(['nyx', CAMP, {}]);
    // at the Camp with Nyx in the party (not behind him), Brak may be swapped in; she then waits at home, and he leads
    const camp = clone(swapped.state);
    camp.world.currentLocationId = CAMP;
    expect(companionAllowedAt(camp, pack, loop2, 'brak', CAMP)).toBe(true);
    const back = play(camp, [{ type: 'swapCompanion', companionId: 'brak' }], { content: pack, profile: loop2 });
    expect(back.state.companions.activeId).toBe('brak');
    expect(back.state.companions.recruited.nyx?.waitingAt).toBe('loc_chasm_of_whispers');
  });
});

// ---- 2. Dask and the Tyrant -----------------------------------------------------------------------------------------------------

describe('Dask and the Tyrant (DESIGN §12.5, STORY §7.4): −30 on the kill, +3 on sparing it, Phase 3 one voice quieter', () => {
  test('the data: the kill is the creature’s `onDefeat`, the sparing its communion’s `onSpared`', () => {
    const t = pack.creatures[TYRANT];
    expect(t?.onDefeat).toEqual([{ loyalty: { companion: 'dask', delta: -30 } }]);
    expect(t?.communion?.onSpared).toEqual([{ loyalty: { companion: 'dask', delta: 3 } }]);
    expect(pack.creatures['cr_chronos_tyrant_contained']?.onDefeat).toEqual([]); // Loop 1: no Dask (DESIGN §12.1)
  });

  test('killed at the Apex with Dask beside you: his loyalty falls by 30 (seeded run through step)', () => {
    const prof = freshProfile({ loopCounter: 2 });
    const s0 = party('dask', { level: 18, locationId: NEXUS, echoes: ['echo_apex_resonance'] });
    s0.companions.recruited.dask!.loyalty = 40;
    const up = step(s0, { type: 'move', to: APEX }, pack, prof);
    expect(up.state.mode).toBe('combat');
    const s1 = clone(up.state);
    const tyrant = (s1.combat as CombatState).enemies.find((e) => e.refId === TYRANT) as Combatant;
    tyrant.hp = 1;
    let r = { state: s1, profile: up.profile, events: [] as Ev[] };
    for (let i = 0; i < 6 && r.state.mode === 'combat'; i++) {
      const out = step(r.state, { type: 'attack', targetUid: tyrant.uid }, pack, r.profile);
      expect(ofType(out.events, 'actionRejected')).toEqual([]);
      r = { state: out.state, profile: out.profile, events: [...r.events, ...out.events] };
    }
    expect(ofType(r.events, 'combatEnded').map((e) => e.result)).toEqual(['victory']);
    expect(r.state.flags.flag_tyrant_dead).toBe(true);
    expect(ofType(r.events, 'loyaltyChanged')).toContainEqual({ t: 'loyaltyChanged', companionId: 'dask', delta: -30, value: 10 });
    // without Dask recruited, nothing to change
    const alone = party(null, { level: 18, locationId: NEXUS, echoes: ['echo_apex_resonance'] });
    const fight = clone(step(alone, { type: 'move', to: APEX }, pack, prof).state);
    (fight.combat as CombatState).enemies.find((e) => e.refId === TYRANT)!.hp = 1;
    const quiet = step(fight, { type: 'attack', targetUid: (fight.combat as CombatState).enemies[0]!.uid }, pack, prof);
    expect(ofType(quiet.events, 'loyaltyChanged')).toEqual([]);
  });

  test('spared: the communion’s `onSpared` runs the moment Movement III ends with Resolve ≥ 3 (the fixture Tyrant, the engine hook)', () => {
    const creatures = miniContentTables.creatures.map((c) =>
      c.id === TYRANT ? ({ ...(clone(c) as CreatureInput), communion: { ...(c as CreatureInput).communion!, onSpared: [{ loyalty: { companion: 'ilyra', delta: 3 } }] } } as CreatureInput) : c,
    );
    const fixture = buildContentPack({ ...miniContentTables, creatures }, { version: FIXTURE_VERSION });
    const hp = fixture.companions.ilyra?.stats.hp ?? 80;
    const s0 = makeState(
      {
        loop: 2,
        level: 18,
        locationId: NEXUS,
        echoes: ['echo_apex_resonance', 'echo_tyrant_speaks'],
        patch: (s) => void ((s.companions.recruited.ilyra = { ...run('ilyra'), hp, hpMax: hp, loyalty: 20 }), (s.companions.activeId = 'ilyra')),
      },
      { content: fixture, profile: loop2 },
    );
    let s = step(s0, { type: 'move', to: APEX }, fixture, loop2);
    const act = (a: Action) => {
      const out = step(s.state, a, fixture, s.profile);
      expect(ofType(out.events, 'actionRejected')).toEqual([]);
      s = out;
      return out;
    };
    act({ type: 'guard' });
    const hurt = clone(s.state);
    (hurt.combat as CombatState).enemies[0]!.hp = 400;
    s = { ...s, state: hurt };
    act({ type: 'guard' });
    act({ type: 'commune', act: 'toggle' });
    const set = clone(s.state);
    ((set.combat as CombatState).communion as CommunionState).resolve = 3;
    s = { ...s, state: set };
    const spared = act({ type: 'commune', act: 'speak', answerId: 'answer' });
    expect(spared.state.world.tyrant).toBe('spared');
    expect(ofType(spared.events, 'loyaltyChanged')).toEqual([{ t: 'loyaltyChanged', companionId: 'ilyra', delta: 3, value: 23 }]);
  });

  /** The moves the Unveiled commits to in Phase 3 (index 2), turn by turn (its wind-up counted down as executeIntent would). */
  function phase3(echoes: string[], turns: number): string[] {
    const s = makeState({ level: 18, loop: 2, echoes }, { content: pack, profile: loop2 });
    const ctx = scriptedCtx(s, [D.d4(4), D.d4(1)], pack, loop2);
    const spec: EncounterSpec = { id: 'enc_u34f', groups: [{ creatureId: TYRANT, count: 1 }], fleeable: false, onFlee: 'hold', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] };
    const combat = beginCombat(ctx, spec);
    const foe = combat.enemies[0] as Combatant;
    Object.assign(foe, { phase: 2 });
    foe.pattern.pointer = 0;
    foe.pattern.turnsTaken = 6;
    const out: string[] = [];
    for (let turn = 7; turn < 7 + turns; turn++) {
      combat.round = turn;
      const intent = generateIntent(ctx, combat, foe);
      const move = intent ? pack.creatures[TYRANT]?.moves[intent.moveId] : undefined;
      out.push(intent?.moveId.replace(/^tyr_/, '') ?? '—');
      if (move?.windUp && !Object.keys(foe.cooldowns).some((k) => k.startsWith('windup:'))) foe.cooldowns[`windup:${intent?.moveId}`] = move.windUp.turns + 1;
      for (const k of Object.keys(foe.cooldowns)) if (k.startsWith('windup:') && (foe.cooldowns[k] = (foe.cooldowns[k] ?? 0) - 1) <= 0) delete foe.cooldowns[k];
      foe.pattern.turnsTaken += 1;
    }
    return out;
  }

  test('Phase 3 with `echo_dask_rest`: one voice quieter — Shear leaves the cycle; the Gather keeps its cadence', () => {
    expect(phase3([], 12)).toEqual('time_lash grasp gather gather chrono_strike shear time_lash grasp gather gather chrono_strike shear'.split(' '));
    expect(phase3(['echo_dask_rest'], 12)).toEqual('time_lash grasp gather gather chrono_strike time_lash grasp time_lash gather gather chrono_strike grasp'.split(' '));
    expect(phase3(['echo_dask_rest'], 40)).not.toContain('shear');
  });
});

// ---- 3. Named ------------------------------------------------------------------------------------------------------------------

describe("Brak's Named (STORY §7.2, `q_blood_and_salt` A): Hold the Line's shield covers the Wayfinder too", () => {
  const SIG: Action = { type: 'companionCommand', command: 'signature' };
  function shields(quests: StateOverrides['quests']): { player: boolean; brak: boolean; log: string[] } {
    const s = party('brak', { quests });
    const ctx = scriptedCtx(s, [D.d4(4), D.d4(3), D.d4(1)], pack, loop2);
    beginCombat(ctx, { id: 'enc_u34f', groups: [{ creatureId: 'cr_corrupted_shade', count: 1 }], fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] });
    runCombat(ctx);
    const at = clone(ctx.s);
    const c = at.combat as CombatState;
    c.intents = {};
    const out = scriptedStep(at, SIG, Array.from({ length: 40 }, () => 0.5), pack, loop2);
    expect(out.rejected).toBeNull();
    const shielded = ofType(out.events, 'statusApplied').filter((e) => e.statusId === 'status_shield').map((e) => e.targetUid);
    return { player: shielded.includes(c.party[0]!.uid), brak: shielded.includes(c.party[1]!.uid), log: (out.state.combat?.log ?? []).map((l) => l.text) };
  }

  test('without it: Brak alone; with the brothers spoken: both, and the log names it', () => {
    expect(shields({})).toMatchObject({ player: false, brak: true });
    const named = shields({ q_blood_and_salt: { status: 'completed', stage: 'spoke' } });
    expect(named).toMatchObject({ player: true, brak: true });
    expect(named.log).toContain('Named: his taunt shields you too.');
    expect(shields({ q_blood_and_salt: { status: 'completed', stage: 'fine' } })).toMatchObject({ player: false, brak: true });
    expect(STORY).toContain('Brak gains *Named* (his taunt also shields)');
  });

  test('the Unbound Hand stays flavour: no trait on Ilyra (the portal has no cost in data to lower)', () => {
    expect(pack.companions.ilyra?.traits).toEqual([]);
    expect(STORY).toContain('she gains the *Unbound Hand* trait: her portal costs less');
  });
});

// ---- 4. Dray's tie ------------------------------------------------------------------------------------------------------------

describe("Dray's tie (D-113): a refused Ledger offer no longer hides the Keeper's Price", () => {
  const talk: Action = { type: 'talk', npcId: 'npc_ansel_dray' };
  const pick = (choiceId: string): Action => ({ type: 'choose', choiceId });
  const go: Action = { type: 'continue' };
  const scenes = (events: readonly Ev[]): string[] => ofType(events, 'dialogueStarted').map((e) => e.sceneId);
  const at = (ilyra: boolean): { s: GameState; profile: Profile } => {
    const profile = freshProfile({ loopCounter: 2, echoes: ['echo_ilyra_cost'] });
    const s = makeState(
      {
        loop: 2,
        locationId: 'loc_shattered_library',
        reputation: { remnants: 20 },
        patch: (st) => {
          if (!ilyra) return;
          st.companions.recruited.ilyra = { ...run('ilyra'), loyalty: 50 };
          st.companions.activeId = 'ilyra';
        },
      },
      { content: pack, profile },
    );
    return { s, profile };
  };

  test('both offers standing: Dray asks which page; the Ledger refused, the hub comes back, and the Keeper’s Price opens from it', () => {
    const { s, profile } = at(true);
    const hub = play(s, [talk], { content: pack, profile });
    expect(hub.state.dialogue?.sceneId).toBe('scene_dray_offers');
    const ledger = play(hub.state, [pick('ledger')], { content: pack, profile });
    expect(ledger.state.dialogue?.sceneId).toBe('scene_dray_keepers_ledger_offer');
    const refused = play(ledger.state, [go, pick('no'), go], { content: pack, profile });
    expect([refused.state.mode, refused.state.quests.q_keepers_ledger?.status ?? 'inactive']).toEqual(['explore', 'inactive']);
    const again = play(refused.state, [talk], { content: pack, profile });
    expect(again.state.dialogue?.sceneId).toBe('scene_dray_offers');
    const price = play(again.state, [pick('ilyra')], { content: pack, profile });
    expect(scenes(price.events)).toContain('scene_dray_keepers_price');
    expect(price.state.dialogue?.sceneId).toBe('scene_dray_keepers_price');
    // "Neither, tonight" closes it
    expect(play(again.state, [pick('neither')], { content: pack, profile }).state.mode).toBe('explore');
  });

  test('one offer standing: its own scene, as before (no hub)', () => {
    const { s, profile } = at(false);
    expect(play(s, [talk], { content: pack, profile }).state.dialogue?.sceneId).toBe('scene_dray_keepers_ledger_offer');
    const done = at(true);
    done.s.quests.q_keepers_ledger = { ...questState('completed', 'whole') };
    expect(play(done.s, [talk], { content: pack, profile: done.profile }).state.dialogue?.sceneId).toBe('scene_dray_keepers_price');
  });
});
