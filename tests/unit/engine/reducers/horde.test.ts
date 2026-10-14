// U30: the Horde — PLAN §8.1 row "horde" (Tyrant defeat and clock expiry both start the Horde at the Apex, expiry with a
// 3-move delay; spread per move with the Mistwood→Plaza delay; infected entry damage = ⅓ max HP; Ilyra at the Library
// portal; Brak removed from camp; portal → closer_escape; death → closer_fall death/expiry), plus Brak's last stand
// (WORLD §12.1 `ws_brak_at_apex`), the legacy spread's rules (WORLD §10.7: portal edges, roads, regions never reached),
// no rest during the Horde, and legalActions agreement for `enterPortal` (DESIGN §10.2; STORY §4.1, §4.3, §8.6).
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import {
  BRAK_QUESTS,
  ECHO_BRAK_DEATH,
  ECHO_HORDE_PATH,
  FLAG_BRAK_KEPT_AWAY,
  FLAG_HORDE_ACTIVE,
  FLAG_LIBRARY_PORTAL_OPEN,
  HORDE_EDGE_DELAYS,
  HORDE_TEXT,
  NEVER_INFECTED_REGIONS,
  TYRANT_HORDE_DELAY,
  brakComesToApex,
  hordeEntryDamage,
  hordeNeighbours,
  isLegal,
  legalActions,
  hordePostStep,
  makeCtx,
  spreadHorde,
  startHorde,
  step,
  type Action,
  type CombatState,
  type CompanionRunState,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import type { LocationInput } from '@schema/location';
import type { RegionInput } from '@schema/region';
import { clone } from '@engine/util/clone';
import { CONTAINED } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { hordePack } from '@tests/fixtures/hordeContent';
import { FIXTURE_VERSION, fixturePack, miniContentTables } from '@tests/fixtures/miniContent';

const mini = fixturePack();
const pack = hordePack();
const RUINS = 'loc_whispering_ruins' as const;
const LIBRARY = 'loc_shattered_library' as const;
const PLAZA = 'loc_silverwood_plaza' as const;
const GLOWLANDS = 'loc_veridian_glowlands' as const;
const NEXUS = 'loc_chronos_nexus' as const;
const APEX = 'loc_temporal_breach_apex' as const;
const MARK = { statusId: 'status_mark', stacks: 1, duration: 3, sourceUid: null, appliedOnOwnTurn: false };

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
const logs = (events: readonly Ev[]) => ofType(events, 'log').map((e) => e.text);

interface Run {
  s: GameState;
  prof: Profile;
  /** The last step's events. */
  last: Ev[];
  all: Ev[];
  pack: ContentPack;
}
const start = (s: GameState, prof: Profile, p: ContentPack = pack): Run => ({ s, prof, last: [], all: [], pack: p });
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
function patch(r: Run, fn: (s: GameState) => void): Run {
  const s = clone(r.s);
  fn(s);
  return { ...r, s };
}
const move = (to: string): Action => ({ type: 'move', to });

const brakRun = (o: Partial<CompanionRunState> = {}): CompanionRunState => ({
  id: 'brak', recruited: true, loyalty: 20, hp: 130, hpMax: 130, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {}, ...o,
});
/** Both of Brak's legacy quests completed this loop (ids outside the fixture: set directly). */
const brakQuestsDone = (s: GameState): void => {
  for (const q of BRAK_QUESTS) s.quests[q] = { status: 'completed', stage: 'done', startedDay: 1, endedDay: 2, counters: {}, objectivesDone: [] };
};

/** Loop 1, level 13, at the Nexus with the Apex stair open (one quest done, the fixture's apexGate). */
function loop1AtNexus(o: StateOverrides = {}): Run {
  const prof = freshProfile();
  const s = makeState({ level: 13, locationId: NEXUS, quests: { q_echo_crystal: { status: 'completed', stage: 'crystal_found' } }, ...o }, { content: pack, profile: prof });
  return start(s, prof);
}
/** Up the stair, *Face it*, the Contained Tyrant at 1 HP and Marked, one attack: the kill. */
function killContained(r: Run): Run {
  const fight = run(r, [move(APEX), { type: 'choose', choiceId: 'face_it' }]);
  expect(fight.s.mode).toBe('combat');
  const marked = patch(fight, (s) => {
    const t = (s.combat as CombatState).enemies.find((e) => e.refId === CONTAINED)!;
    t.hp = 1;
    t.statuses.push({ ...MARK });
  });
  const uid = (marked.s.combat as CombatState).enemies.find((e) => e.refId === CONTAINED)!.uid;
  return act(marked, { type: 'attack', targetUid: uid });
}
/** Loop 2 on the fixture pack: the Unveiled Tyrant at the Apex at 1 HP and Marked, one attack. */
function killUnveiled(o: StateOverrides = {}): Run {
  const prof = freshProfile({ loopCounter: 2 });
  const s0 = makeState({ loop: 2, level: 18, locationId: NEXUS, echoes: ['echo_apex_resonance'], ...o }, { content: mini, profile: prof });
  const fight = act(start(s0, prof, mini), move(APEX));
  const marked = patch(fight, (s) => {
    const t = (s.combat as CombatState).enemies[0]!;
    t.hp = 1;
    t.statuses.push({ ...MARK });
  });
  return act(marked, { type: 'attack', targetUid: (marked.s.combat as CombatState).enemies[0]!.uid });
}

/** A Horde already running, for spread/lash tests: `infected`, `delay`, cause. */
function inHorde(at: string, infected: string[], o: { delay?: number; cause?: 'tyrant' | 'expiry'; loop?: number; hp?: number } = {}, p: ContentPack = mini): Run {
  const prof = freshProfile({ loopCounter: o.loop ?? 1 });
  const s = makeState(
    {
      loop: o.loop ?? 1,
      locationId: at,
      ...(o.hp === undefined ? {} : { hp: o.hp }),
      patch: (st) => {
        Object.assign(st.world, { hordeActive: true, hordeCause: o.cause ?? 'tyrant', hordeDelay: o.delay ?? 0, infected, hordePending: {} });
        st.flags[FLAG_HORDE_ACTIVE] = true;
        st.flags[FLAG_LIBRARY_PORTAL_OPEN] = true;
        // no encounter on the way (the fixture's fixed groups): cleared for this loop
        for (const [loc, enc] of [[LIBRARY, 'enc_library_shades'], [NEXUS, 'enc_nexus_aberration']] as const) {
          st.world.locationStates[loc] = { ...emptyLocation(), encountersCleared: [enc] };
        }
      },
    },
    { content: p, profile: prof },
  );
  return start(s, prof, p);
}
const emptyLocation = () => ({
  visited: false, visitCount: 0, items: [], itemsSpawned: false, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
  unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
});

// ---- the start ----------------------------------------------------------------------------------------------------------

describe('a Tyrant killed in combat starts the Horde at the Apex (D-060; legacy delay 1)', () => {
  test('Loop 2 Unveiled: defeated, tyrantResolved, Horde from the Apex, flags, Ilyra to the Library, the legacy lines, no autosave', () => {
    const r = killUnveiled();
    const s = r.s;
    expect(s.mode).toBe('explore');
    expect(s.flags.flag_tyrant_dead).toBe(true);
    expect(s.world).toMatchObject({ tyrant: 'defeated', hordeActive: true, hordeCause: 'tyrant', hordeDelay: TYRANT_HORDE_DELAY, infected: [APEX], hordePending: {} });
    expect(s.flags).toMatchObject({ [FLAG_HORDE_ACTIVE]: true, [FLAG_LIBRARY_PORTAL_OPEN]: true });
    expect(ofType(r.last, 'tyrantResolved')).toEqual([{ t: 'tyrantResolved', outcome: 'defeated' }]);
    expect(ofType(r.last, 'hordeStarted')).toEqual([{ t: 'hordeStarted', cause: 'tyrant', delay: 1 }]);
    expect(ofType(r.last, 'hordeSpread')).toEqual([{ t: 'hordeSpread', infected: [APEX] }]);
    expect(ofType(r.last, 'npcMoved')).toEqual([{ t: 'npcMoved', npcId: 'npc_ilyra', to: LIBRARY }]);
    expect(s.world.npcOverrides.npc_ilyra).toEqual({ location: LIBRARY });
    // no Brak this loop (his quests were not done): the portal pulse tells the player where to run
    for (const line of [...HORDE_TEXT.tyrantFalls, ...HORDE_TEXT.collapse, HORDE_TEXT.portalPulse]) expect(logs(r.last)).toContain(line);
    expect(logs(r.last)).not.toContain(HORDE_TEXT.brakArrives);
    expect(ofType(r.last, 'autosaveCheckpoint')).toEqual([]);
    // the fixture has no echo_horde_path: an engine Echo the pack lacks is not granted
    expect(s.echoesThisLoop).not.toContain(ECHO_HORDE_PATH);
  });

  test('Loop 1 Contained, Brak at the Apex: his last stand — gone from his post, dead, echo_brak_death; remembered on leaving', () => {
    const r0 = loop1AtNexus({ patch: (s) => { brakQuestsDone(s); s.companions.recruited.brak = brakRun(); } });
    expect(brakComesToApex(r0.s)).toBe(true);
    const r = killContained(r0);
    const s = r.s;
    expect(s.world).toMatchObject({ tyrant: 'defeated', hordeActive: true, hordeCause: 'tyrant', hordeDelay: 1 });
    expect(s.companions.recruited.brak).toMatchObject({ dead: true, hp: 0 });
    expect(ofType(r.last, 'companionDied')).toEqual([{ t: 'companionDied', companionId: 'brak' }]);
    expect(s.world.npcOverrides.npc_brak).toEqual({ location: null });
    expect(ofType(r.last, 'npcMoved')).toEqual([
      { t: 'npcMoved', npcId: 'npc_brak', to: null },
      { t: 'npcMoved', npcId: 'npc_ilyra', to: LIBRARY },
    ]);
    for (const id of [ECHO_BRAK_DEATH, ECHO_HORDE_PATH, 'echo_apex_resonance']) expect(s.echoesThisLoop).toContain(id);
    for (const line of [HORDE_TEXT.brakArrives, ...HORDE_TEXT.brakSpeech]) expect(logs(r.last)).toContain(line);
    expect(logs(r.last)).not.toContain(HORDE_TEXT.portalPulse);
    const away = act(r, move(NEXUS));
    expect(logs(away.last)).toContain(HORDE_TEXT.brakMourned);
    const back = run(away, [move(APEX), move(NEXUS)]);
    expect(logs(back.all.slice(away.all.length))).not.toContain(HORDE_TEXT.brakMourned);
  });

  test('Brak stays away: quests not both done, flag_brak_kept_away, or he held the Nexus (echo_brak_lives this loop)', () => {
    const kill = (fn: (s: GameState) => void) => killContained(loop1AtNexus({ patch: (s) => { brakQuestsDone(s); s.companions.recruited.brak = brakRun(); fn(s); } })).s;
    for (const s of [
      kill((st) => void delete st.quests[BRAK_QUESTS[1]!]),
      kill((st) => void (st.flags[FLAG_BRAK_KEPT_AWAY] = true)),
      kill((st) => void st.echoesThisLoop.push('echo_brak_lives')),
    ]) {
      expect(s.world.hordeActive).toBe(true);
      expect(s.companions.recruited.brak?.dead).toBe(false);
      expect(s.world.npcOverrides.npc_brak).toBeUndefined();
      expect(s.echoesThisLoop).not.toContain(ECHO_BRAK_DEATH);
    }
  });

  test('a Tyrant killed while an expiry Horde runs: defeated, the Horde keeps its cause and spread', () => {
    const s = killUnveiled({ patch: (st) => Object.assign(st.world, { hordeActive: true, hordeCause: 'expiry', hordeDelay: 2, infected: [APEX, NEXUS] }) }).s;
    expect(s.world).toMatchObject({ tyrant: 'defeated', hordeCause: 'expiry', hordeDelay: 2, infected: [APEX, NEXUS] });
  });
});

describe('clock expiry starts the Horde with a 3-move delay (DESIGN §10.2, D-066 #7, WORLD R10-3)', () => {
  test("STORY §4.3's line; waiting is not a move; three moves count down, the fourth spreads", () => {
    const prof = freshProfile();
    const s0 = makeState({ day: 29, watch: 3, locationId: GLOWLANDS }, { content: pack, profile: prof });
    const expired = act(start(s0, prof), { type: 'wait' });
    expect(expired.s.world).toMatchObject({ hordeActive: true, hordeCause: 'expiry', hordeDelay: 3, infected: [APEX] });
    expect(logs(expired.last)).toContain(HORDE_TEXT.expiry);
    expect(ofType(expired.last, 'npcMoved')).toEqual([{ t: 'npcMoved', npcId: 'npc_ilyra', to: LIBRARY }]);
    expect(expired.s.echoesThisLoop).toContain(ECHO_HORDE_PATH);
    expect(act(expired, { type: 'wait' }).s.world.hordeDelay).toBe(3); // waiting is not a move
    const delays = [move(PLAZA), move(GLOWLANDS), move(PLAZA)].reduce<{ r: Run; d: number[] }>(
      (acc, a) => {
        const r = act(acc.r, a);
        return { r, d: [...acc.d, r.s.world.hordeDelay] };
      },
      { r: expired, d: [] },
    );
    expect(delays.d).toEqual([2, 1, 0]);
    expect(delays.r.s.world.infected).toEqual([APEX]);
    const fourth = act(delays.r, move(GLOWLANDS));
    expect(fourth.s.world.infected).toEqual([APEX, NEXUS]);
    expect(ofType(fourth.last, 'hordeSpread')).toEqual([{ t: 'hordeSpread', infected: [NEXUS] }]);
  });
});

// ---- the spread -----------------------------------------------------------------------------------------------------------

describe('the spread (legacy `spread_horde`, WORLD §10.7)', () => {
  /** A ctx over a Horde state for calling `spreadHorde` directly. */
  const ctxIn = (infected: string[], o: { delay?: number; pending?: Record<string, number>; echoes?: string[] } = {}, p: ContentPack = mini) => {
    const prof = freshProfile();
    const s = makeState({ echoes: o.echoes ?? [], patch: (st) => Object.assign(st.world, { hordeActive: true, hordeCause: 'tyrant', hordeDelay: o.delay ?? 0, infected, hordePending: o.pending ?? {} }) }, { content: p, profile: prof });
    return makeCtx(s, prof, p);
  };

  test('once per move: nodes infected before the move infect their neighbours; new ones wait for the next move', () => {
    const ctx = ctxIn([APEX]);
    expect(spreadHorde(ctx)).toEqual([NEXUS]);
    expect(spreadHorde(ctx)).toEqual([GLOWLANDS]); // the road to the Ruins is not there without echo_apex_resonance
    expect(spreadHorde(ctx)).toEqual([PLAZA]);
    expect(spreadHorde(ctx)).toEqual([LIBRARY]);
    expect(spreadHorde(ctx)).toEqual([RUINS]);
    expect(spreadHorde(ctx)).toEqual([]);
    expect(ctx.s.world.infected).toEqual([APEX, NEXUS, GLOWLANDS, PLAZA, LIBRARY, RUINS]);
    expect(ofType(ctx.events, 'hordeSpread').map((e) => e.infected)).toEqual([[NEXUS], [GLOWLANDS], [PLAZA], [LIBRARY], [RUINS]]);
  });

  test('the delay only counts down; a road counts once its gate holds', () => {
    const ctx = ctxIn([APEX], { delay: 2 });
    expect([spreadHorde(ctx), spreadHorde(ctx), ctx.s.world.hordeDelay]).toEqual([[], [], 0]);
    expect(spreadHorde(ctx)).toEqual([NEXUS]);
    const road = ctxIn([NEXUS], { echoes: ['echo_apex_resonance'] });
    expect(spreadHorde(road)).toEqual([GLOWLANDS, APEX, RUINS]);
    expect(hordeNeighbours(road.s, mini, road.profile, NEXUS)).toEqual([GLOWLANDS, APEX, RUINS]);
    expect(hordeNeighbours(ctxIn([]).s, mini, freshProfile(), NEXUS)).toEqual([GLOWLANDS, APEX]);
    expect(spreadHorde(makeCtx(makeState(), freshProfile(), mini))).toEqual([]); // no Horde, no spread
  });

  test('a slow edge holds its neighbour back that many extra moves (the legacy Mistwood → Plaza is 2)', () => {
    expect(HORDE_EDGE_DELAYS).toEqual({ 'loc_mistwood_path->loc_silverwood_plaza': 2, 'loc_blighted_outpost->loc_emberforge': 1 });
    const slow = { [`${GLOWLANDS}->${PLAZA}`]: 2 };
    const ctx = ctxIn([GLOWLANDS]);
    expect(spreadHorde(ctx, slow)).toEqual([NEXUS]);
    expect(ctx.s.world.hordePending).toEqual({ [PLAZA]: 2 });
    expect(spreadHorde(ctx, slow)).toEqual([APEX]);
    expect(ctx.s.world.hordePending).toEqual({ [PLAZA]: 1 });
    // two moves after an ordinary edge would have taken it; as in the legacy, a node it releases spreads that same move
    expect(spreadHorde(ctx, slow)).toEqual([PLAZA, LIBRARY]);
    expect(ctx.s.world.hordePending).toEqual({});
    // a node an ordinary edge reaches first is not held back by a slow one
    const both = ctxIn([GLOWLANDS, LIBRARY]);
    expect(spreadHorde(both, slow)).toEqual([NEXUS, RUINS, PLAZA]);
    expect(both.s.world.hordePending).toEqual({});
  });

  test('never across a portal edge, never into the Before or the Threshold (WORLD §10.7)', () => {
    expect(NEVER_INFECTED_REGIONS).toEqual(['region_silverwood_before', 'region_threshold']);
    const threshold: RegionInput = { ...clone(miniContentTables.regions[0]!), id: 'region_threshold', name: 'The Threshold', order: 13 };
    const shore: LocationInput = { ...clone(miniContentTables.locations[2]!), id: 'loc_still_shore', regionId: 'region_threshold', name: 'Still Shore', exits: [{ dir: 'west', to: PLAZA }], npcs: [], events: [], encounters: [] };
    const locations = miniContentTables.locations.map((l) =>
      l.id === PLAZA ? { ...clone(l), exits: [...clone(l.exits ?? []), { dir: 'portal' as const, to: APEX }, { dir: 'in' as const, to: 'loc_still_shore' as const }] } : clone(l),
    );
    const p = buildContentPack({ ...miniContentTables, regions: [...miniContentTables.regions, threshold], locations: [...locations, shore] }, { version: FIXTURE_VERSION, validate: false });
    expect(hordeNeighbours(makeState({}, { content: p }), p, freshProfile(), PLAZA)).toEqual([LIBRARY, GLOWLANDS]);
  });
});

// ---- moving through it --------------------------------------------------------------------------------------------------------

describe('entering an infected node: ⌈max HP / 3⌉, and that move does not spread (WORLD §10.7)', () => {
  test('hordeEntryDamage', () => {
    expect([hordeEntryDamage(99, 1 / 3), hordeEntryDamage(100, 1 / 3), hordeEntryDamage(120, 1 / 3), hordeEntryDamage(1, 1 / 3), hordeEntryDamage(0, 1 / 3)]).toEqual([33, 34, 40, 1, 1]);
  });

  test('the lash: ⅓ of max HP, the legacy line, no spread this move; the next clean move spreads again', () => {
    const r = inHorde(GLOWLANDS, [APEX, NEXUS]);
    const hpMax = r.s.player.hpMax;
    const lashed = act(r, move(NEXUS));
    const dmg = Math.ceil(hpMax / 3);
    expect(lashed.s.player.hp).toBe(hpMax - dmg);
    expect(lashed.s.counters.damageTaken).toBe(dmg);
    expect(logs(lashed.last)).toContain(HORDE_TEXT.lash(dmg));
    expect(lashed.s.world.infected).toEqual([APEX, NEXUS]);
    expect(ofType(lashed.last, 'hordeSpread')).toEqual([]);
    const clean = act(lashed, move(GLOWLANDS)); // the Glowlands are not infected yet
    expect(clean.s.player.hp).toBe(lashed.s.player.hp + Math.round(hpMax * 0.05)); // travel regen only
    expect(clean.s.world.infected).toEqual([APEX, NEXUS, GLOWLANDS]);
  });

  test('a killing lash: closer_fall — reason death in a Tyrant Horde (Loop 1 too, no FALLEN), expiry in an expiry Horde', () => {
    const tyrant = inHorde(GLOWLANDS, [APEX, NEXUS], { hp: 1 });
    const dead = act(tyrant, move(NEXUS));
    expect(dead.s.player.hp).toBe(0);
    expect(dead.s.mode).toBe('ending');
    expect(dead.s.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'death', slideIndex: 0 });
    expect(dead.s.counters.deathsThisLoop).toBe(1);
    expect(ofType(dead.last, 'playerDied')).toEqual([{ t: 'playerDied', loop: 1 }]);
    expect(ofType(dead.last, 'loopEnded')).toHaveLength(1);
    expect(ofType(dead.last, 'combatStarted')).toEqual([]); // the chain stops: no encounter, no spread
    const expiry = act(inHorde(GLOWLANDS, [APEX, NEXUS], { hp: 1, cause: 'expiry', loop: 2 }), move(NEXUS));
    expect(expiry.s.pendingEnding).toEqual({ outcome: 'closer_fall', reason: 'expiry', slideIndex: 0 });
    // the lash lands after the watch's travel regen: arriving with exactly its damage kills, one more HP survives at 1
    const r = inHorde(GLOWLANDS, [APEX, NEXUS]);
    const dmg = hordeEntryDamage(r.s.player.hpMax, 1 / 3);
    const regen = Math.round(r.s.player.hpMax * 0.05);
    expect(act(patch(r, (s) => void (s.player.hp = dmg - regen)), move(NEXUS)).s.mode).toBe('ending');
    expect(act(patch(r, (s) => void (s.player.hp = dmg - regen + 1)), move(NEXUS)).s.player.hp).toBe(1);
  });

  test('retreat is a move too; teleports and waiting are not', () => {
    const r = patch(inHorde(GLOWLANDS, [APEX]), (s) => void (s.world.previousLocationId = PLAZA));
    expect(act(r, { type: 'retreat' }).s.world.infected).toEqual([APEX, NEXUS]);
  });

  test('no rest while the Horde runs (WORLD §12.1 ws_horde)', () => {
    const camp = inHorde(RUINS, [APEX]);
    expect(legalActions(camp.s, mini, camp.prof).filter((a) => a.type === 'rest')).toEqual([]);
    expect(refused(camp, { type: 'rest', kind: 'short' })).toBe('you cannot rest here now');
  });
});

// ---- the portal --------------------------------------------------------------------------------------------------------------

describe('Ilyra at the Library portal; enterPortal → closer_escape (STORY §4.1 beats 15–16, §10.7)', () => {
  test('arriving at the Library in the Horde: Ilyra speaks once; the portal is the way out', () => {
    const r = inHorde(PLAZA, [APEX], {}, mini);
    const withIlyra = patch(r, (s) => void (s.world.npcOverrides.npc_ilyra = { location: LIBRARY }));
    const there = act(withIlyra, move(LIBRARY));
    expect(logs(there.last)).toContain(HORDE_TEXT.ilyraAtPortal);
    expect(logs(run(there, [move(PLAZA), move(LIBRARY)]).all.slice(there.all.length))).not.toContain(HORDE_TEXT.ilyraAtPortal);
    expect(legalActions(there.s, mini, there.prof).filter((a) => a.type === 'enterPortal')).toEqual([{ type: 'enterPortal' }]);
    const out = act(there, { type: 'enterPortal' });
    expect(out.s.mode).toBe('ending');
    expect(out.s.pendingEnding).toEqual({ outcome: 'closer_escape', slideIndex: 0 });
    expect(ofType(out.last, 'portalEntered')).toHaveLength(1);
    expect(ofType(out.last, 'loopEnded')[0]?.record).toMatchObject({ outcome: 'closer_escape', loop: 1 });
  });

  test('no portal outside a Horde or away from the Library; content may open it on purpose (Ilyra\'s tear)', () => {
    const calm = start(makeState({ locationId: LIBRARY }, { content: mini }), freshProfile(), mini);
    expect(refused(calm, { type: 'enterPortal' })).toBe(HORDE_TEXT.noPortal);
    expect(refused(inHorde(PLAZA, [APEX]), { type: 'enterPortal' })).toBe(HORDE_TEXT.noPortalHere);
    const torn = patch(calm, (s) => void (s.flags[FLAG_LIBRARY_PORTAL_OPEN] = true));
    expect(act(torn, { type: 'enterPortal' }).s.pendingEnding?.outcome).toBe('closer_escape');
  });

  test('legalActions agrees with step for enterPortal across the states above', () => {
    const states = [inHorde(LIBRARY, [APEX]), inHorde(PLAZA, [APEX]), start(makeState({ locationId: LIBRARY }, { content: mini }), freshProfile(), mini)];
    for (const r of states) {
      const accepted = ofType(step(r.s, { type: 'enterPortal' }, mini, r.prof).events, 'actionRejected').length === 0;
      expect(isLegal(r.s, { type: 'enterPortal' }, mini, r.prof)).toBe(accepted);
    }
  });
});

describe('startHorde', () => {
  test('a Horde already running is never restarted', () => {
    const ctx = makeCtx(inHorde(PLAZA, [APEX, NEXUS], { delay: 2, cause: 'expiry' }).s, freshProfile(), mini);
    startHorde(ctx, 'tyrant', 1);
    expect(ctx.s.world).toMatchObject({ hordeCause: 'expiry', hordeDelay: 2, infected: [APEX, NEXUS] });
    expect(ctx.events).toEqual([]);
  });

  test('hordePostStep waits until the fight is over and the game is back in explore; it resolves the kill once', () => {
    const dead = (mode: 'combat' | 'explore' | 'ending', inFight: boolean) =>
      makeCtx(
        makeState({ mode, flags: { flag_tyrant_dead: true }, patch: (s) => void (s.combat = inFight ? (clone(killUnveiledFight().s.combat) as CombatState) : null) }, { content: mini }),
        freshProfile(),
        mini,
      );
    for (const ctx of [dead('combat', true), dead('ending', false)]) {
      hordePostStep(ctx);
      expect(ctx.s.world.hordeActive).toBe(false);
      expect(ctx.s.world.tyrant).toBe('waiting');
    }
    const ctx = dead('explore', false);
    hordePostStep(ctx);
    expect(ctx.s.world).toMatchObject({ hordeActive: true, tyrant: 'defeated' });
    const events = ctx.events.length;
    hordePostStep(ctx);
    expect(ctx.events).toHaveLength(events);
  });
});

/** The Loop 2 Tyrant fight at the player's first turn (fixture pack). */
function killUnveiledFight(): Run {
  const prof = freshProfile({ loopCounter: 2 });
  const s0 = makeState({ loop: 2, level: 18, locationId: NEXUS, echoes: ['echo_apex_resonance'] }, { content: mini, profile: prof });
  return act(start(s0, prof, mini), move(APEX));
}
