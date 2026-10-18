// U36: loadScenario (PLAN §4.13, §7, §8.3; DESIGN §19 #19; D-066 #18) — every scenario is a pure builder that reaches its
// target by legal actions through `step` (the constructed parts are listed per scenario), on every fixture pack that can
// express it. Per cell of the (pack × scenario) matrix: the state parses as a GameState, the profile as a Profile, the
// player has a legal game action, and an unavailable cell is exactly the documented one. Per scenario: what the state is
// (mode, loop, level, clock, location, fight phase, communion movement …) and what the next action does (the Apex prompt,
// the ending's Speak, the expiring watch). Options, determinism, errors, and the dev gate (a production bundle drops the
// builders; an e2e bundle keeps them).
import { describe, expect, test } from 'bun:test';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { ENDING_LETTERS } from '@schema/ending';
import {
  APEX_FACE_IT,
  APEX_LOCATION_ID,
  APEX_NOT_YET,
  BEFORE_REGION_ID,
  GameStateSchema,
  isApexPromptOpen,
  legalActions,
  playerOf,
  step,
  type Action,
  type ActionType,
  type CombatState,
  type ContentPack,
  type GameState,
  type Profile,
} from '@engine/index';
import { ProfileSchema } from '@engine/saves';
import { buildContentPack } from '@content/index';
import {
  RESONANCE_FLOOR,
  SCENARIOS,
  SCENARIO_IDS,
  ScenarioError,
  ScenarioUnavailable,
  bestGear,
  gearTierOf,
  loadScenario,
  type ScenarioId,
  type ScenarioOptions,
} from '@sim/scenarios';
import { beforePack } from '@tests/fixtures/beforeContent';
import { combatPack } from '@tests/fixtures/combatContent';
import { companionPack } from '@tests/fixtures/companionContent';
import { beforeEconomyPack, economyPack } from '@tests/fixtures/economyContent';
import { hordePack } from '@tests/fixtures/hordeContent';
import { fixturePack } from '@tests/fixtures/miniContent';
import { storyPack } from '@tests/fixtures/storyContent';
import { thresholdPack } from '@tests/fixtures/thresholdContent';
import { ROOT, esbuildOptions } from '../../../tools/build';

// ---- the matrix ---------------------------------------------------------------------------------------------------------------

/** PLAN §4.13's twelve, and the brief's "first fight". */
const EXPECTED_IDS: readonly ScenarioId[] = [
  'loop1_day1',
  'first_fight',
  'pre_tyrant_l11_ranger',
  'pre_tyrant_l13_ranger',
  'combat_tyrant_contained_p2',
  'loop2_day1',
  'loop2_end',
  'communion_movement_2',
  'ending_a_ready',
  'ending_b_ready',
  'before_day_3',
  'combat_bell_warden_p2',
  'expiry_minus_1',
];

const PACKS = {
  mini: fixturePack,
  combat: () => combatPack(),
  companion: () => companionPack(),
  horde: hordePack,
  before: beforePack,
  threshold: thresholdPack,
  story: storyPack,
  economy: economyPack,
  beforeEconomy: beforeEconomyPack,
} as const;
type PackName = keyof typeof PACKS;

/** A pack without the Contained Tyrant's Loop 1 encounter at the Apex cannot play the three Apex scenarios. */
const NO_TYRANT: readonly ScenarioId[] = ['pre_tyrant_l11_ranger', 'pre_tyrant_l13_ranger', 'combat_tyrant_contained_p2'];
/** Which cells the fixture packs cannot express (no Loop 1 Tyrant encounter, no Silverwood Before, no placed boss). */
const UNAVAILABLE: Record<PackName, readonly ScenarioId[]> = {
  mini: [...NO_TYRANT, 'before_day_3', 'combat_bell_warden_p2'],
  combat: [...NO_TYRANT, 'before_day_3'],
  companion: [...NO_TYRANT, 'before_day_3'],
  horde: ['before_day_3'],
  before: [],
  threshold: ['before_day_3'],
  story: [...NO_TYRANT, 'before_day_3'],
  economy: [...NO_TYRANT, 'before_day_3'],
  beforeEconomy: [],
};

const packs = new Map<PackName, ContentPack>();
const packOf = (name: PackName): ContentPack => {
  let pack = packs.get(name);
  if (pack === undefined) {
    pack = PACKS[name]();
    packs.set(name, pack);
  }
  return pack;
};

interface Built {
  state: GameState;
  profile: Profile;
}
const built = new Map<string, Built>();
/** Memoised load (the builders are pure; callers here only read). */
function load(id: ScenarioId, pack: PackName = 'beforeEconomy', opts: ScenarioOptions = {}): Built {
  const key = `${pack}|${id}|${JSON.stringify(opts)}`;
  let out = built.get(key);
  if (out === undefined) {
    out = loadScenario(id, packOf(pack), opts);
    built.set(key, out);
  }
  return out;
}

const SHELL: readonly ActionType[] = ['save', 'load', 'newGame', 'returnToTitle'];
const legalOf = (b: Built, pack: PackName = 'beforeEconomy'): Action[] => legalActions(b.state, packOf(pack), b.profile);
const combatOf = (s: GameState): CombatState => {
  if (s.combat === null) throw new Error('not in a fight');
  return s.combat;
};
const play = (b: Built, action: Action, pack: PackName = 'beforeEconomy') => step(b.state, action, packOf(pack), b.profile);

// ---- every cell -------------------------------------------------------------------------------------------------------------------

describe('registry', () => {
  test('the thirteen scenarios, each described', () => {
    expect([...SCENARIO_IDS].sort()).toEqual([...EXPECTED_IDS].sort());
    for (const id of SCENARIO_IDS) {
      const def = SCENARIOS[id];
      expect(def.summary.length).toBeGreaterThan(10);
      // played = nothing constructed; mixed = says what is
      expect(def.route === 'played' ? def.constructed === '' : def.constructed.length > 10).toBe(true);
    }
  });
});

for (const name of Object.keys(PACKS) as PackName[]) {
  describe(`scenarios on the ${name} pack`, () => {
    for (const id of EXPECTED_IDS) {
      if (UNAVAILABLE[name].includes(id)) {
        test(`${id}: unavailable (the pack cannot express it)`, () => {
          expect(() => loadScenario(id, packOf(name))).toThrow(ScenarioUnavailable);
        });
        continue;
      }
      test(`${id}: a valid state and profile with a legal game action`, () => {
        const b = load(id, name);
        const parsed = GameStateSchema.safeParse(b.state);
        expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
        const profile = ProfileSchema.safeParse(b.profile);
        expect(profile.success ? [] : profile.error.issues).toEqual([]);
        const legal = legalOf(b, name);
        expect(legal.length).toBeGreaterThan(0);
        expect(legal.some((a) => !SHELL.includes(a.type))).toBe(true);
        // the engine agrees with itself: a listed action is accepted
        const first = legal.find((a) => !SHELL.includes(a.type)) as Action;
        expect(play(b, first, name).events.some((e) => e.t === 'actionRejected')).toBe(false);
      });
    }
  });
}

// ---- each scenario ----------------------------------------------------------------------------------------------------------------

describe('loop1_day1', () => {
  test('a fresh Loop 1 at the start location', () => {
    const { state: s, profile: p } = load('loop1_day1');
    const pack = packOf('beforeEconomy');
    expect(s.mode).toBe('explore');
    expect(s.meta.loop).toBe(1);
    expect(s.clock.ticks).toBe(0);
    expect(s.clock.limitTicks).toBe(116);
    expect(s.world.currentLocationId).toBe(pack.config.startLocationId);
    expect(s.player.classId).toBe('ranger');
    expect(s.player.level).toBe(1);
    expect(s.combat).toBeNull();
    expect(p.loopCounter).toBe(1);
    expect(p.echoes).toEqual([]);
  });
});

describe('first_fight', () => {
  test('Level 1 at the first turn of a fixed fight from the pack, with explicit targets', () => {
    const b = load('first_fight');
    const c = combatOf(b.state);
    expect(b.state.mode).toBe('combat');
    expect(b.state.player.level).toBe(1);
    expect(c.phase).toBe('playerTurn');
    expect(c.round).toBe(1);
    expect(c.enemies.every((e) => e.alive)).toBe(true);
    expect(packOf('beforeEconomy').locations[c.locationId]?.encounters.some((e) => e.id === c.encounterId)).toBe(true);
    const attacks = legalOf(b).filter((a) => a.type === 'attack');
    expect(attacks.length).toBe(c.enemies.length);
    expect(attacks.every((a) => a.type === 'attack' && a.targetUid !== undefined)).toBe(true);
  });
});

describe.each(['pre_tyrant_l11_ranger', 'pre_tyrant_l13_ranger'] as const)('%s', (id) => {
  const level = id === 'pre_tyrant_l11_ranger' ? 11 : 13;
  test('Loop 1 at the Apex with the prompt open, a built character at full strength', () => {
    const { state: s } = load(id, 'horde');
    const pack = packOf('horde');
    expect(s.meta.loop).toBe(1);
    expect(s.player.classId).toBe('ranger');
    expect(s.player.level).toBe(level);
    expect(s.player.statPoints).toBe(0); // spent through allocateStat
    expect(s.player.hp).toBe(s.player.hpMax);
    expect(s.player.mp).toBe(s.player.mpMax);
    expect(s.mode).toBe('dialogue');
    expect(isApexPromptOpen(s)).toBe(true);
    expect(s.world.currentLocationId).toBe(APEX_LOCATION_ID);
    const potions = s.player.inventory.filter((i) => pack.items[i.itemId]?.type === 'consumable').reduce((n, i) => n + i.qty, 0);
    expect(potions).toBeGreaterThanOrEqual(5);
    const choices = legalOf(load(id, 'horde'), 'horde').flatMap((a) => (a.type === 'choose' ? [a.choiceId] : []));
    expect(choices.sort()).toEqual([APEX_FACE_IT, APEX_NOT_YET].sort());
  });

  test('Face it starts the Contained Tyrant fight; Not yet leaves', () => {
    const b = load(id, 'horde');
    const face = play(b, { type: 'choose', choiceId: APEX_FACE_IT }, 'horde');
    expect(face.state.mode).toBe('combat');
    expect(combatOf(face.state).enemies.some((e) => e.refId === 'cr_chronos_tyrant_contained')).toBe(true);
    const later = play(b, { type: 'choose', choiceId: APEX_NOT_YET }, 'horde');
    expect(later.state.mode).toBe('explore');
    expect(later.state.world.currentLocationId).not.toBe(APEX_LOCATION_ID);
  });
});

// D-092: the Tyrant scenarios wear the band's best Common gear (WORLD "Tiers": T1 1–4 · T2 5–8 · T3 9–13 · T4 14–15 · T5 16–18).
describe('the Tyrant scenarios\' gear (D-092)', () => {
  test('the tier of a level band', () => {
    const tiers = [1, 4, 5, 8, 9, 13, 14, 15, 16, 18].map(gearTierOf);
    expect(tiers).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  test('the real pack: a class-fit weapon, an armor and two different trinkets, all Common-capable, none above the band', () => {
    const pack = buildContentPack();
    for (const level of [11, 13]) {
      for (const classId of Object.keys(pack.classes)) {
        const pick = bestGear(pack, classId, level);
        const starter = pack.classes[classId]?.starterItems.map((k) => pack.items[k.itemId]).find((d) => d?.type === 'weapon');
        const all = [pick.weapon, pick.armor, ...pick.trinkets].map((id) => pack.items[id as string]);
        expect(all.every((d) => d !== undefined), `${classId} L${level} has a full kit`).toBe(true);
        expect(pick.weapon !== undefined && pack.items[pick.weapon]?.weaponType === starter?.weaponType, `${classId} weapon fits`).toBe(true);
        expect(pack.items[pick.armor as string]?.type).toBe('armor');
        expect(pick.trinkets.length).toBe(2);
        expect(new Set(pick.trinkets).size).toBe(2);
        for (const d of all) {
          expect(d?.tier ?? 99).toBeLessThanOrEqual(gearTierOf(level));
          expect(d?.rarityRule === 'rolled' || d?.fixedRarity === 'common').toBe(true);
          expect(d?.sellable).toBe(true);
        }
      }
    }
  });

  test('the real pack: the Apex prompt opens on a character who wears exactly that kit and carries a combat potion of the band', () => {
    const pack = buildContentPack();
    const { state: s } = loadScenario('pre_tyrant_l11_ranger', pack, { seed: 'gear' });
    const pick = bestGear(pack, 'ranger', 11);
    const worn = Object.values(s.player.equipment).map((i) => i?.itemId);
    for (const id of [pick.weapon, ...pick.trinkets, pick.armor]) expect(worn).toContain(id);
    expect(s.player.equipment.trinket1?.itemId).not.toBe(s.player.equipment.trinket2?.itemId);
    const potions = s.player.inventory.filter((i) => pack.items[i.itemId]?.type === 'consumable' && pack.items[i.itemId]?.usableInCombat);
    expect(potions.every((i) => (pack.items[i.itemId]?.tier ?? 99) <= gearTierOf(11))).toBe(true);
    expect(potions.reduce((n, i) => n + i.qty, 0)).toBeGreaterThanOrEqual(5);
  });

  test('a fixture pack with no gear to wear still builds (nothing is granted)', () => {
    const { state: s } = load('pre_tyrant_l11_ranger', 'horde');
    expect(isApexPromptOpen(s)).toBe(true);
  });
});

describe('combat_tyrant_contained_p2', () => {
  test('the Contained Tyrant in its second phase at the player turn', () => {
    const b = load('combat_tyrant_contained_p2', 'horde');
    const c = combatOf(b.state);
    const tyrant = c.enemies.find((e) => e.refId === 'cr_chronos_tyrant_contained');
    expect(b.state.mode).toBe('combat');
    expect(c.phase).toBe('playerTurn');
    expect(tyrant?.phase).toBe(1);
    expect(tyrant?.alive).toBe(true);
    expect(playerOf(c).hp).toBeGreaterThan(0);
    expect(b.state.player.level).toBe(13);
    const targets = legalOf(b, 'horde').flatMap((a) => (a.type === 'attack' ? [a.targetUid] : []));
    expect(targets).toContain(tyrant?.uid);
  });

  test('a seed that loses retries with a derived one; the result is named by the seed that won', () => {
    const { state } = load('combat_tyrant_contained_p2', 'horde');
    expect(state.meta.seed).toMatch(/^scenario:combat_tyrant_contained_p2(#\d+)?$/);
  });

  test('a character that cannot win ends in a defeat error, not a bad state', () => {
    expect(() => loadScenario('combat_tyrant_contained_p2', packOf('horde'), { level: 1 })).toThrow(/Wayfinder fell/);
  });
});

describe('loop2_day1', () => {
  test('after a played Loop 1 closer: Loop 2, Day 1 dawn, Echoes kept', () => {
    const { state: s, profile: p } = load('loop2_day1');
    expect(s.mode).toBe('explore');
    expect(s.meta.loop).toBe(2);
    expect(s.clock.ticks).toBe(0);
    expect(s.clock.expired).toBe(false);
    expect(s.world.currentLocationId).toBe(packOf('beforeEconomy').config.startLocationId);
    expect(s.world.hordeActive).toBe(false);
    expect(p.loopCounter).toBe(2);
    expect(p.runHistory.length).toBeGreaterThanOrEqual(1);
    expect(p.echoes.length).toBeGreaterThan(0);
    expect(s.pendingEnding).toBeNull();
  });
});

describe('loop2_end', () => {
  test('the Threshold after Let go in Loop 2', () => {
    const { state: s, profile: p } = load('loop2_end');
    expect(s.mode).toBe('threshold');
    expect(s.threshold).not.toBeNull();
    expect(s.pendingEnding).toMatchObject({ outcome: 'closer_fall', reason: 'released' });
    expect(p.loopCounter).toBe(3);
    expect(legalOf(load('loop2_end')).some((a) => a.type === 'thresholdGo')).toBe(true);
  });

  test('with Attunements in the pack, Resonance is topped up to the floor and can be spent', () => {
    const b = load('loop2_end', 'threshold');
    expect(Object.keys(packOf('threshold').attunements).length).toBeGreaterThan(0);
    expect(b.state.mode).toBe('threshold');
    expect(b.profile.resonance).toBeGreaterThanOrEqual(RESONANCE_FLOOR);
    const loom = play(b, { type: 'thresholdGo', to: 'loom' }, 'threshold'); // the Loom is where it is spent
    expect(loom.events.some((e) => e.t === 'actionRejected')).toBe(false);
    expect(legalActions(loom.state, packOf('threshold'), loom.profile).some((a) => a.type === 'thresholdSpend')).toBe(true);
  });
});

describe('communion_movement_2', () => {
  test("Loop 2, the Tyrant's communion at the start of Movement II", () => {
    const b = load('communion_movement_2');
    const c = combatOf(b.state);
    expect(b.state.meta.loop).toBe(2);
    expect(b.state.mode).toBe('combat');
    expect(b.state.world.currentLocationId).toBe(APEX_LOCATION_ID);
    expect(b.state.world.tyrant).toBe('communing');
    expect(c.phase).toBe('playerTurn');
    expect(c.communion).toMatchObject({ movement: 2, questionIndex: 0 });
    expect(c.communion?.resolve).toBeGreaterThanOrEqual(1);
    expect(c.communion?.answered.length).toBeGreaterThanOrEqual(1);
    expect(c.communion?.lies).toBe(0);
    expect(legalOf(b).some((a) => a.type === 'commune')).toBe(true);
  });
});

const ENDINGS: ['ending_a_ready' | 'ending_b_ready', keyof typeof ENDING_LETTERS][] = [
  ['ending_a_ready', 'A'],
  ['ending_b_ready', 'B'],
];
describe.each(ENDINGS)('%s', (id, letter) => {
  /** The Speak actions whose outcome ends the game with this letter's ending. */
  const endings = (b: Built): Action[] => {
    const pack = packOf('beforeEconomy');
    const spec = Object.values(pack.creatures).find((c) => c.communion !== undefined)?.communion;
    const outcome = spec?.outcomes.find((o) => o.effects.some((e) => 'ending' in e && e.ending === ENDING_LETTERS[letter]));
    return legalOf(b).filter((a) => a.type === 'commune' && a.act === 'speak' && a.answerId === outcome?.choiceId);
  };

  test("the Resolution is reached, the ending's outcome is on offer", () => {
    const b = load(id);
    const c = combatOf(b.state);
    expect(b.state.mode).toBe('combat');
    expect(b.state.meta.loop).toBeGreaterThanOrEqual(2);
    expect(c.phase).toBe('playerTurn');
    expect(c.communion?.movement).toBe(3);
    expect(c.communion?.resolve).toBeGreaterThanOrEqual(6);
    expect(endings(b).length).toBe(1);
  });

  test(`the next Speak ends the game with ending ${letter}`, () => {
    const b = load(id);
    const out = play(b, endings(b)[0] as Action);
    expect(out.events.some((e) => e.t === 'actionRejected')).toBe(false);
    expect(out.state.mode).toBe('ending');
    expect(out.state.pendingEnding?.outcome).toBe(ENDING_LETTERS[letter]);
  });
});

describe('before_day_3', () => {
  test("Loop 2 in Silverwood Before on Last Bell, the clock frozen, at the Before's rest point", () => {
    const { state: s } = load('before_day_3');
    const pack = packOf('beforeEconomy');
    expect(s.mode).toBe('explore');
    expect(s.meta.loop).toBe(2);
    expect(s.before?.day).toBe(3);
    expect(s.clock.frozen).toBe(true);
    expect(pack.locations[s.world.currentLocationId]?.regionId).toBe(BEFORE_REGION_ID);
    expect(pack.locations[s.world.currentLocationId]?.rest).toBeDefined();
  });
});

describe('combat_bell_warden_p2', () => {
  test('the Bell-Warden in its second phase at the player turn', () => {
    const b = load('combat_bell_warden_p2');
    const pack = packOf('beforeEconomy');
    const c = combatOf(b.state);
    const boss = c.enemies.find((e) => pack.creatures[e.refId]?.role === 'boss');
    expect(b.state.mode).toBe('combat');
    expect(c.phase).toBe('playerTurn');
    expect(boss?.refId).toBe('cr_fixture_bell');
    expect(boss?.phase).toBe(1);
    expect(boss?.alive).toBe(true);
    expect(b.state.player.level).toBe(pack.creatures['cr_fixture_bell']?.level);
  });
});

describe('expiry_minus_1', () => {
  test('Loop 1, one watch before the thirtieth dawn; the next watch expires the clock', () => {
    const b = load('expiry_minus_1');
    expect(b.state.mode).toBe('explore');
    expect(b.state.meta.loop).toBe(1);
    expect(b.state.clock.ticks).toBe(b.state.clock.limitTicks - 1);
    expect(b.state.clock.expired).toBe(false);
    const next = play(b, { type: 'rest', kind: 'short' });
    expect(next.events.some((e) => e.t === 'actionRejected')).toBe(false);
    expect(next.state.clock.expired).toBe(true);
    expect(next.state.world.hordeCause).toBe('expiry');
  });
});

// ---- options -----------------------------------------------------------------------------------------------------------------------

describe('options', () => {
  test('classId picks the class (default: the Ranger)', () => {
    const other = Object.keys(packOf('beforeEconomy').classes).find((c) => c !== 'ranger');
    expect(other).toBeDefined();
    expect(load('loop1_day1', 'beforeEconomy', { classId: other }).state.player.classId).toBe(other as string);
    expect(load('first_fight', 'beforeEconomy', { classId: other }).state.player.classId).toBe(other as string);
  });

  test('level overrides the scenario level', () => {
    expect(load('loop1_day1', 'horde', { level: 7 }).state.player.level).toBe(7);
    expect(load('pre_tyrant_l11_ranger', 'horde', { level: 12 }).state.player.level).toBe(12);
    const hp = load('loop1_day1', 'horde', { level: 7 }).state;
    expect(hp.player.hp).toBe(hp.player.hpMax);
  });

  test('companionId recruits a companion who travels with the Wayfinder', () => {
    const id = Object.keys(packOf('companion').companions)[0] as string;
    const s = load('loop1_day1', 'companion', { companionId: id }).state;
    expect(s.companions.activeId).toBe(id);
    expect(s.companions.recruited[id]?.recruited).toBe(true);
    const fight = load('first_fight', 'companion', { companionId: id }).state;
    expect(combatOf(fight).party.some((m) => m.kind === 'companion' && m.refId === id)).toBe(true);
  });

  test('seed varies the run; the same seed repeats it', () => {
    const a = load('first_fight', 'horde', { seed: 'one' }).state;
    const b = load('first_fight', 'horde', { seed: 'two' }).state;
    expect(a.meta.seed).toBe('one');
    expect(b.meta.seed).toBe('two');
    expect(a.rng).not.toEqual(b.rng);
    // Loop 2 onward are seeded `${profileId}:${loop}` (PLAN §4.11): the profile carries the scenario seed
    expect(load('loop2_day1', 'horde', { seed: 'one' }).state.meta.seed).not.toBe(load('loop2_day1', 'horde', { seed: 'two' }).state.meta.seed);
  });

  test('an option the pack cannot satisfy is "unavailable"', () => {
    expect(() => loadScenario('loop1_day1', packOf('horde'), { classId: 'nonesuch' })).toThrow(ScenarioUnavailable);
    expect(() => loadScenario('loop1_day1', packOf('horde'), { companionId: 'nonesuch' })).toThrow(ScenarioUnavailable);
    expect(() => loadScenario('pre_tyrant_l11_ranger', packOf('horde'), { companionId: 'nonesuch' })).toThrow(ScenarioUnavailable);
  });
});

// ---- purity -------------------------------------------------------------------------------------------------------------------------

describe('purity', () => {
  test.each(EXPECTED_IDS)('%s is deterministic, and its result is the caller\'s to edit', (id) => {
    const pack = packOf('beforeEconomy');
    const a = loadScenario(id, pack);
    const b = loadScenario(id, pack);
    expect(a.state).toEqual(b.state);
    expect(a.profile).toEqual(b.profile);
    expect(a.state).not.toBe(b.state);
    expect(Object.isFrozen(a.state)).toBe(false); // step's dev-mode freeze does not leak out
    a.state.player.gold += 1;
    a.state.player.inventory.length = 0;
    a.profile.echoes.push('echo_scribble');
    expect(b.state.player.gold).toBe(loadScenario(id, pack).state.player.gold);
    expect(b.profile.echoes).not.toContain('echo_scribble');
  });

  test('the content pack is left alone', () => {
    const pack = beforeEconomyPack();
    const before = JSON.stringify(pack);
    for (const id of EXPECTED_IDS) loadScenario(id, pack);
    expect(JSON.stringify(pack)).toBe(before);
  });
});

// ---- errors -----------------------------------------------------------------------------------------------------------------------

describe('errors', () => {
  test.each(['nonesuch', '', 'toString', '__proto__', 'constructor', 'hasOwnProperty'])('unknown scenario %j', (id) => {
    expect(() => loadScenario(id as ScenarioId, packOf('horde'))).toThrow(ScenarioError);
    expect(() => loadScenario(id as ScenarioId, packOf('horde'))).not.toThrow(ScenarioUnavailable);
  });

  test('a pack with no world is unavailable, not a crash in the engine', () => {
    const pack: ContentPack = { ...packOf('horde'), locations: {} };
    for (const id of EXPECTED_IDS) expect(() => loadScenario(id, pack)).toThrow(ScenarioUnavailable);
  });

  test('errors name the scenario', () => {
    try {
      loadScenario('before_day_3', packOf('mini'));
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ScenarioUnavailable);
      expect((e as ScenarioUnavailable).scenario).toBe('before_day_3');
      expect((e as Error).message).toContain('before_day_3');
    }
  });
});

// ---- the dev gate -----------------------------------------------------------------------------------------------------------------

/** Bundles a probe module exactly as tools/build.ts configures esbuild (defines, tsconfig paths), in memory. */
async function bundle(mode: 'production' | 'e2e', source: string): Promise<string> {
  const { entryPoints: _entry, outdir: _outdir, sourcemap: _map, entryNames: _names, assetNames: _assets, metafile: _meta, ...base } = esbuildOptions({
    root: ROOT,
    entry: 'unused',
    assetsDir: path.join(ROOT, 'unused'),
    mode,
    version: 'test',
  });
  const out = await esbuild.build({
    ...base,
    stdin: { contents: source, resolveDir: ROOT, loader: 'ts', sourcefile: 'probe.ts' },
    write: false,
    logLevel: 'silent',
  });
  return out.outputFiles[0]?.text ?? '';
}

describe('dev gate (PLAN §4.13: dev and e2e builds only)', () => {
  const MARKER = 'pre_tyrant_l13_ranger'; // a string only the scenario registry contains
  const guarded = "import { loadScenario } from '@sim/scenarios';\nif (__E2E__) (globalThis as { loadScenario?: unknown }).loadScenario = loadScenario;\nexport const entry = 1;\n";
  const unguarded = "import { loadScenario } from '@sim/scenarios';\nexport const probe = (pack: never) => loadScenario('loop1_day1', pack);\n";

  test('a production bundle keeps none of the scenario builders behind an e2e guard', async () => {
    const js = await bundle('production', guarded);
    expect(js).not.toContain(MARKER);
    expect(js).not.toContain('first_fight');
  }, 30_000);

  test('nor when the call is not guarded: the body is dead code and throws', async () => {
    const js = await bundle('production', unguarded);
    expect(js).not.toContain(MARKER);
    expect(js).toContain('dev and e2e builds only');
  }, 30_000);

  test('an e2e bundle has them', async () => {
    const js = await bundle('e2e', guarded);
    expect(js).toContain(MARKER);
    expect(js).toContain('first_fight');
  }, 30_000);
});
