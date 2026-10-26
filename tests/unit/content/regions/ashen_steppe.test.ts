// U46: The Ashen Steppe — checked against the documents at test time, U42's pattern (regions/silverwood_ruins.test.ts) and the
// Reach's (regions/drowned_reach.test.ts): WORLD §2.8, §3.7, §4, §6.2, §6.6, §10.1, §10.3, §10.4, §11.1–11.3, §12.1; DESIGN §6.2,
// §17.1, §18.2; PLAN Appendix A; STORY's codex ids. The region is new (no legacy text, no `legacyName`), so every description
// is WORLD's, character for character. Patterns are walked turn by turn by the engine (`generateIntent`), so every WORLD
// cadence word is held to what the game does. Where a record departs from the letter of WORLD (a reading the schema or the
// engine forces), the test pins the departure so a later edit cannot move it silently; the readings are listed in the U46
// reply. The Steppe Harrier is U44's (first region: the Highlands): the engine tests run on a pack with a stand-in for it until
// that record lands, and on the record itself after.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures as folderCreatures } from '@content/regions/ashen_steppe/creatures';
import { items } from '@content/regions/ashen_steppe/items';
import { locations } from '@content/regions/ashen_steppe/locations';
import { npcs } from '@content/regions/ashen_steppe/npcs';
import { region } from '@content/regions/ashen_steppe/region';
import { validateContent } from '@content/validate';
import { beginCombat, evaluate, generateIntent, legalActions, step, type CombatState, type Combatant, type EncounterSpec, type GameState } from '@engine/index';
import type { Condition } from '@schema/condition';
import { CreatureSchema, walkSteps, type Creature, type CreatureInput, type Step } from '@schema/creature';
import { LocationSchema, type Location } from '@schema/location';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { main as validateCli } from '../../../../tools/validate-content';
import { PLAN, WORLD, ids, section, tableRows, unquote, worldCreature, worldCreatureTable, worldEdges, worldLocations, worldNodes } from './worldDoc';

// U34e (D-087): WORLD §10.2's anomaly variants live in this folder too; WORLD §6's checks below are on the
// others (tests/unit/engine/u34e/anomalies.test.ts checks the variants).
const creatures = folderCreatures.filter((c) => !c.id.startsWith('cr_anomaly_'));

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');

const REGION = 'region_ashen_steppe';
const SG = 'loc_scorched_gate';
const AF = 'loc_ash_wind_flats';
const HR = 'loc_hearthring';
const BN = 'loc_bone_orchard';
const GP = 'loc_grey_salt_pan';
const SC = 'loc_stormgate_cairns';
const WF = 'loc_watchfire_ridge';
const RD = 'loc_reedmarch_descent';
const HG = 'loc_herd_grave';
const BO = 'loc_blighted_outpost';
const VG = 'loc_veridian_glowlands';
const WR = 'loc_whispering_ruins';
const ASHMAW = 'cr_ashmaw';
const HARRIER = 'cr_steppe_harrier';
const ALL = [SG, AF, HR, BN, GP, SC, WF, RD, HG];

const S28 = section(WORLD, '### 2.8 `region_ashen_steppe`', '### 2.9');
const S37 = section(WORLD, '### 3.7 The Ashen Steppe', '### 3.8');
const WL = Object.fromEntries(worldLocations(S37).map((l) => [l.id, l]));
const NODES = worldNodes();
const EDGES = worldEdges();
const CREATURE_TABLE = worldCreatureTable();
const pack = buildContentPack();
const parsedLocations: Location[] = locations.map((l) => LocationSchema.parse(l));
const parsedCreatures: Creature[] = creatures.map((c) => CreatureSchema.parse(c));
const here = new Set<string>(locations.map((l) => l.id));
const mine = new Set<string>([REGION, ...locations.map((l) => l.id), ...creatures.map((c) => c.id), ...npcs.map((n) => n.id)]);

const byId = <T extends { id: string }>(rows: readonly T[], id: string): T => {
  const found = rows.find((r) => r.id === id);
  if (!found) throw new Error(`no record ${id}`);
  return found;
};
const loc = (id: string): Location => byId(parsedLocations, id);
const cr = (id: string): Creature => byId(parsedCreatures, id);
/** One line of prose: the document's wrapped lines joined. */
const flat = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim();
/** WORLD's prose as play text: markdown emphasis and decision references dropped (the creature files' header). */
const playText = (s: string): string =>
  flat(s)
    .replace(/[`*]/g, '')
    .replace(/ \(D-\d+(?:\.\d+)?\)/g, '')
    .replace(/, D-\d+(?:\.\d+)?\)/g, ')');
const words = (s: string): number => s.trim().split(/\s+/).length;

/** The `#### \`cr_x\`` block of a creature (anywhere in §6), and one of its `- **Label**` bullets as one line. */
function block(id: string): string {
  const start = WORLD.indexOf(`#### \`${id}\``);
  if (start < 0) throw new Error(`no block for ${id}`);
  const next = WORLD.slice(start + 5).search(/\n#{3,4} /);
  return next < 0 ? WORLD.slice(start) : WORLD.slice(start, start + 5 + next);
}
function bullet(text: string, label: string): string {
  const start = text.indexOf(`- **${label}`);
  if (start < 0) throw new Error(`no bullet ${label}`);
  const rest = text.slice(start);
  const end = rest.indexOf('\n- **', 1);
  return flat((end < 0 ? rest : rest.slice(0, end)).replace(/^- \*\*[^*]+\*\*\s*(\([^)]*\))?:?\s*/, ''));
}
/** WORLD's condition notation (`{echo:"x"}`, unquoted keys) as data; `{item:"x"}` is the schema's `{item:{id:"x"}}`. */
function worldCondition(text: string): Condition {
  const json = text.replace(/([{,])([a-zA-Z_]+):/g, '$1"$2":');
  const fix = (c: unknown): unknown => {
    if (Array.isArray(c)) return c.map(fix);
    if (typeof c !== 'object' || c === null) return c;
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, k === 'item' && typeof v === 'string' ? { id: v } : fix(v)]));
  };
  return fix(JSON.parse(json)) as Condition;
}

// ---- The Harrier's stand-in -----------------------------------------------------------------------------------------------------

/**
 * The Steppe Harrier's first region is the Highlands (WORLD §6: "Highlands, Ashen Steppe"), so U44 authors it. Until that unit
 * merges the pool and three locations name a pending reference, and the engine cannot start a fight with an absent record. The
 * engine tests run on `epack`: the real pack, with this stand-in (WORLD §6.2's level, stats and weakness) when the record is
 * absent, and the real record once it lands. No test of the content itself reads the stand-in.
 */
const STAND_IN = {
  id: HARRIER,
  name: 'Steppe Harrier',
  description: 'Stand-in for the Highlands unit’s record (test only).',
  family: 'fam_wilds',
  role: 'fodder',
  level: 8,
  stats: { hp: 88, atk: 17, sp: 17, armor: 1, ward: 2, agi: 12 },
  resistances: { chrono: 'weak', fire: 'resist' },
  moves: { harrier_stoop: { name: 'Stoop', line: 'A shadow drops out of the white sky at you.', type: 'physical', power: { coef: 1.3, stat: 'atk' } } },
  pattern: [{ move: 'harrier_stoop', target: 'player' }],
  loot: [],
  gold: { min: 19, max: 30 },
  xp: 161,
  bestiary: { voice: 'remnant_archive', summary: 'Stand-in.', tactics: 'Stand-in.', codexId: 'codex_creatures_wilds', reveals: [{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }] },
  sigil: { base: 'triangle', details: [] },
} satisfies CreatureInput;
const harrierLanded = pack.creatures[HARRIER] !== undefined;
const epack = harrierLanded ? pack : buildContentPack({ ...contentTables, creatures: [...contentTables.creatures, STAND_IN] }, { validate: false });

// ---- Engine helpers -----------------------------------------------------------------------------------------------------------

type QuestSpec = 'active' | 'completed';
const questState = (status: QuestSpec) => ({ status, stage: 'u46', startedDay: 1, endedDay: status === 'completed' ? 1 : null, counters: {}, objectivesDone: [] as string[] });

interface At {
  seed?: string;
  loop?: number;
  flags?: Record<string, boolean>;
  quests?: Record<string, QuestSpec>;
  /** Echoes granted this loop (the pack has no echo records yet, so they are set directly). */
  echoes?: string[];
  /** Item ids carried (the pack has no item records yet, so they are put straight into the inventory). */
  carrying?: string[];
  /** Kills this loop, by creature id. */
  kills?: Record<string, number>;
  /** The `horde_moves` counter (engine-written once a Horde runs). */
  hordeMoves?: number;
  /** The Horde's infected set (D-098's `infected` atom reads it). */
  infected?: string[];
}

/** A state on the engine pack, standing at `locationId`. */
function stateAt(locationId: string, o: At = {}): GameState {
  const overrides: StateOverrides = {
    locationId,
    seed: o.seed ?? 'u46',
    ...(o.loop === undefined ? {} : { loop: o.loop }),
    flags: o.flags ?? {},
    patch: (s) => {
      for (const [id, status] of Object.entries(o.quests ?? {})) s.quests[id] = questState(status);
      for (const id of o.echoes ?? []) s.echoesThisLoop.push(id);
      for (const itemId of o.carrying ?? []) s.player.inventory.push({ uid: `i${s.meta.nextUid++}`, itemId, qty: 1, rarity: 'common', affixes: [] });
      for (const [id, n] of Object.entries(o.kills ?? {})) s.counters.kills[id] = n;
      if (o.hordeMoves !== undefined) s.counters.custom['horde_moves'] = o.hordeMoves;
      if (o.infected !== undefined) s.world.infected = [...o.infected];
    },
  };
  return makeState(overrides, { content: epack });
}
const profileOf = (o: At = {}) => freshProfile({ loopCounter: o.loop ?? 1 });
const holds = (cond: Condition, locationId: string, o: At = {}): boolean => evaluate(cond, stateAt(locationId, o), profileOf(o), epack);
/** A fresh location state, as if the player had been there: `visited` and the first-visit groups behind them, or not yet entered. */
const seen = (to: string, visited: boolean, quiet: readonly string[]) => ({
  visited,
  visitCount: visited ? 1 : 0,
  items: [],
  itemsSpawned: true,
  encountersCleared: visited ? loc(to).encounters.filter((e) => e.respawn === 'never').map((e) => e.id) : [],
  encounterClearedDay: {},
  eventsFired: [...quiet],
  flags: {},
  unlockedExits: [],
  lockedExits: [],
  scattered: [],
  encounterHp: {},
});
/**
 * Walk to `to` from the state `from` stands in. No item record exists yet (the items tables are U49/U50's), and the engine
 * cannot put an unknown item on the ground, so the destination's items are taken as already spawned; its events named in
 * `quiet` (the ones that grant Echoes, whose records are a later unit's) as already fired.
 */
const arrive = (from: string, to: string, o: At = {}, quiet: readonly string[] = []) => {
  const s = stateAt(from, o);
  s.world.locationStates[to] = seen(to, false, quiet);
  return step(s, { type: 'move', to }, epack, profileOf(o)).state;
};
/** A return visit to `to`: it has been entered before, its first-visit fights are behind the player and its events have fired. */
const arriveAgain = (from: string, to: string, i: number, o: At = {}): GameState => {
  const s = stateAt(from, { ...o, seed: `u46-back-${i}` });
  s.world.locationStates[to] = seen(to, true, loc(to).events.map((e) => e.id));
  return step(s, { type: 'move', to }, epack, profileOf(o)).state;
};
const movesFrom = (locationId: string, o: At = {}): string[] =>
  legalActions(stateAt(locationId, o), epack, profileOf(o))
    .filter((a) => a.type === 'move')
    .map((a) => (a as { to: string }).to)
    .sort();
/** How the fights fall over `n` seeds: encounter id → count (a combat is a fight; anything else is none). */
function tally(n: number, go: (i: number) => GameState): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const s = go(i);
    const key = s.mode === 'combat' ? (s.combat?.encounterId ?? '?') : '—';
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_ashen_steppe vs WORLD §2.8, §10.1, DESIGN §6.5, §17.1, §18.2', () => {
  test('id, name, new (Appendix A.1), faction, band, WORLD’s theme text, order, codex entry', () => {
    expect(region.id).toBe(REGION);
    expect(S28.startsWith(`### 2.8 \`${REGION}\` — ${region.name}`)).toBe(true);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | new | 9 |`);
    expect('legacy' in region).toBe(false); // not one of the five legacy regions (D-015)
    expect(pack.regions[REGION]?.legacy).toBe(false);
    expect(S28).toContain('| Level band | 7–11 |');
    expect(region.levelBand).toEqual({ min: 7, max: 11 });
    expect(DESIGN).toMatch(/\| The Ashen Steppe \| `region_ashen_steppe` \| 7–11 \|/);
    expect(S28).toContain('| Factions | Ironclad Nomads (dominant: Hearthring, Scorched Gate, Watchfire).');
    expect(region.factionId).toBe('ironclad');
    const theme = /\*\*Theme\.\*\* ([\s\S]*?)\n\n\| Field/.exec(S28)?.[1] ?? '';
    expect(region.description).toBe(playText(theme));
    expect(region.order).toBe(8);
    expect(region.codexId).toBe('codex_region_ashen_steppe');
    expect(STORY).toContain('| `codex_region_ashen_steppe` |');
  });

  test('the nine locations WORLD lists, in WORLD’s order, all in the region, each inside the region’s band', () => {
    const listed = /\| Locations \(9\) \| ([^|]+) \|/.exec(S28)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual(ALL);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of locations) {
      expect(l.regionId).toBe(REGION);
      expect([l.id, l.levelBand.min >= region.levelBand.min && l.levelBand.max <= region.levelBand.max]).toEqual([l.id, true]);
    }
  });

  test('the pool is WORLD §10.1’s pool_ashen_steppe, the Reed Stalker in it at Watchfire Ridge and the Reedmarch Descent only (D-098: a pool entry’s `when`); return chance 20 %; every entry is in-band fodder', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_ashen_steppe');
    expect(row?.[2]).toBe('reed stalker at loc_watchfire_ridge / loc_reedmarch_descent only');
    const entries = [...(row?.[1] ?? '').matchAll(/(cr_[a-z_]+) (\d+)/g)].map((m) => ({ creatureId: m[1] ?? '', weight: Number(m[2]) }));
    expect(entries.map((e) => e.creatureId)).toEqual(['cr_salt_jackal', HARRIER, 'cr_reed_stalker']);
    expect(region.wanderingPool).toEqual([
      ...entries.slice(0, 2),
      { ...entries[2], when: { any: [{ location: WF }, { location: RD }] } },
    ]);
    expect(region.returnEncounterChance).toBe(0.2);
    // the U46 reading (a 5 % location group ahead of the pool at the two nodes) is gone
    for (const at of [WF, RD]) expect([at, loc(at).encounters.filter((e) => e.respawn === 'on_return').map((e) => e.id)]).toEqual([at, []]);
    for (const e of region.wanderingPool) {
      const c = pack.creatures[e.creatureId];
      // the Harrier is the Highlands unit's: a pending reference until its record lands (D-090)
      if (c === undefined) expect([e.creatureId, e.creatureId === HARRIER]).toEqual([e.creatureId, true]);
      else expect([e.creatureId, c.role, c.level >= region.levelBand.min - 2 && c.level <= region.levelBand.max + 2]).toEqual([e.creatureId, 'fodder', true]);
    }
  });

  test('palette: DESIGN §17.1’s Ashen Steppe row (sky top, sky bottom, mid, accent = glow); the ambient preset exists in §18.2', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'The Ashen Steppe');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).some((c) => c[0] === 'The Ashen Steppe')).toBe(true);
    expect(region.ambient).toBe('ambient_ashen_steppe');
    // WORLD's extra ambient layers (herd lowing, the frame drum, thunder at the Cairns) are additive: no location replaces the preset
    for (const l of parsedLocations) expect([l.id, l.ambient]).toEqual([l.id, undefined]);
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the nine locations vs WORLD §3.7 blocks', () => {
  test('names, bands, coordinates and region', () => {
    for (const l of locations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.levelBand, l.map]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map]);
    }
    expect(WL[HG]?.block).toContain('11 (boss) · (48, 6)');
  });

  test('descriptions: WORLD’s, character for character; no legacy name (a new region)', () => {
    for (const l of locations) {
      expect([l.id, l.description]).toEqual([l.id, WL[l.id]?.description]);
      expect([l.id, 'legacyName' in l]).toEqual([l.id, false]);
    }
  });

  test('exits: every walkable WORLD exit in order, gated ones with a `when`; the waystone road is a `road` exit with its gate; the Grave’s door carries a refusal line', () => {
    for (const l of parsedLocations) {
      const walks = l.exits.filter((e) => e.kind !== 'road').map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, walks]).toEqual([l.id, WL[l.id]?.exits]);
      // "south (the waystone road)" / "north (the waystone road)": the schema's repeatable `path` direction, labelled
      const roads = l.exits.filter((e) => e.kind === 'road').map((e) => ({ dir: e.dir, label: e.label, to: e.to, conditional: e.gate !== undefined }));
      expect([l.id, roads]).toEqual([l.id, (WL[l.id]?.noteExits ?? []).map((n) => ({ dir: 'path', label: n.note, to: n.to, conditional: n.conditional }))]);
      for (const e of l.exits) expect([l.id, e.to, e.travelWatches]).toEqual([l.id, e.to, 1]); // D-068.1: the road costs one watch too
    }
    expect([SG, RD].map((id) => WL[id]?.noteExits.map((n) => n.dir))).toEqual([['south'], ['north']]);
    expect(loc(HR).exits.find((e) => e.to === HG)?.lockedText).toBe('The clan does not let strangers wake the Herd.');
    expect(WL[HR]?.block).toContain('the clan does not let strangers wake the Herd');
    expect(loc(HR).exits.filter((e) => e.when !== undefined).map((e) => e.to)).toEqual([HG]);
  });

  test('rest points and merchants as WORLD says: the camps at Hearthring and Watchfire Ridge, Tessaly’s stall; nothing else rests or sells', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, w?.rest, w?.merchant]);
    }
    expect([HR, WF].map((id) => loc(id).rest?.kind)).toEqual(['camp', 'camp']);
    expect(loc(HR).merchantId).toBe('npc_tessaly_varr');
  });

  test('every item WORLD places is placed, with WORLD’s counts; gathering is `gather`; the Grave’s heart and horn are Ashmaw’s; a chance is the item’s `chance` (D-098)', () => {
    for (const l of parsedLocations) {
      const expected = new Set(WL[l.id]?.itemIds ?? []);
      // "gathering: X" is the location's `gather` (DESIGN §8.2), not an item on the ground
      for (const g of l.gather ?? []) expected.delete(g.itemId);
      // the Grave: the fight pays the heart and the horn (Ashmaw's loot); only the bypass's Pyre Ledger is placed here
      if (l.id === HG) for (const id of ['item_cinder_heart', 'mat_cinder_horn']) expected.delete(id);
      expect([l.id, l.items.map((i) => i.itemId).sort()]).toEqual([l.id, [...expected].sort()]);
    }
    const item = (o: object) => ({ count: 1, hidden: false, once: true, chance: 1, onTake: [], ...o }); // U34d's defaults
    expect(loc(SG).items).toEqual([item({ itemId: 'item_nomad_hardtack', count: 2 })]);
    expect(loc(SG).gather).toEqual([{ itemId: 'mat_ember_ore', perDay: 1 }]);
    expect(WL[SG]?.block).toContain('gathering: mat_ember_ore ×1');
    expect(loc(GP).gather).toEqual([{ itemId: 'mat_steppe_salt', perDay: 2 }]);
    expect(WL[GP]?.block).toContain('gathering: mat_steppe_salt ×2');
    expect(loc(HR).items).toEqual([item({ itemId: 'item_hearth_broth', count: 2 })]);
    expect(loc(BN).items).toEqual([item({ itemId: 'mat_cinder_horn', count: 2 }), item({ itemId: 'mat_iron_rivet' })]);
    expect(loc(SC).items).toEqual([item({ itemId: 'mat_storm_glass', count: 2 }), item({ itemId: 'item_storm_jar' })]);
    expect(loc(WF).items).toEqual([item({ itemId: 'item_whetstone_strip' })]);
    expect(loc(RD).items).toEqual([item({ itemId: 'item_glow_moss', count: 2 })]);
    // ×1 (50 %): the item's own `chance` (D-098, U34d; it lay hidden at 100 %, D-091 gap 1)
    expect(WL[AF]?.block).toContain('mat_cinder_horn ×1 (50%)');
    expect(loc(AF).items).toEqual([item({ itemId: 'mat_cinder_horn', chance: 0.5 })]);
    // "first visit, in a jackal den, 100% after clearing": hidden until the pack has been killed
    expect(WL[GP]?.block).toContain('item_salt_charm ×1 (first visit, in a jackal den, 100% after clearing)');
    expect(loc(GP).items).toMatchObject([{ itemId: 'item_salt_charm', count: 1, hidden: true, once: true, when: { killed: { id: 'cr_salt_jackal' } } }]);
    // the Grave: the ledger only with the Echo (the bypass), the heart and the horn never placed
    expect(loc(HG).items).toEqual([item({ itemId: 'item_dreyls_pyre_ledger', when: { echo: 'echo_dreyl_brand' } })]);
    expect(WL[HG]?.block).toContain('Pacifist bypass: with `echo_dreyl_brand` the player may break the brand-stone');
    expect(WL[HG]?.block).toContain('no fight, reduced loot');
    expect(cr(ASHMAW).loot.slice(0, 3).map((r) => [r.itemId, r.count, r.chance])).toEqual([['item_cinder_heart', 1, 1], ['mat_cinder_horn', 3, 1], ['mat_ember_ore', 3, 1]]);
  });

  test('the Pan’s salt charm appears once a jackal has been killed, not before', () => {
    const when = byId(loc(GP).items.map((i) => ({ id: i.itemId, when: i.when })), 'item_salt_charm').when as Condition;
    expect(holds(when, GP)).toBe(false);
    expect(holds(when, GP, { kills: { cr_salt_jackal: 1 } })).toBe(true);
    expect(holds(when, GP, { kills: { cr_cinderback: 5 } })).toBe(false);
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa (Ashmaw’s add is its own; the pool’s stalker is the pool’s, D-098)', () => {
    for (const l of parsedLocations) {
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      const expected = new Set(WL[l.id]?.creatureIds ?? []);
      if (l.id === HG) expected.delete('cr_salt_jackal'); // "adds cr_salt_jackal": Ashmaw's first phase
      expect([l.id, [...got].sort()]).toEqual([l.id, [...expected].sort()]);
    }
    expect(cr(ASHMAW).phases[0]?.adds).toMatchObject([{ creatureId: 'cr_salt_jackal', count: 2 }]);
  });

  test('first-visit fights: chances 60 / 50 / 100 / 60 / 40 / 40 %; the Flats’ two groups are one roll of 60 % / 40 %; the Gate and the Pan are safe; the Flats and the Pan are the scatter nodes (WORLD §10.4); the boss holds', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const shape = (l: string, id: string) => {
      const x = e(l, id);
      return [x.groups.map((g) => `${g.creatureId}×${g.count}`), x.chance, x.respawn, x.once, x.fleeable, x.onFlee];
    };
    const flats = flat(WL[AF]?.block ?? '');
    expect(flats).toContain('first: cr_cinderback ×1 (60%, telegraphed stampede — Guard on the first turn avoids the opening charge) or cr_salt_jackal ×3 (40%).');
    expect(shape(AF, 'enc_flats_cinderback')).toEqual([['cr_cinderback×1'], 0.6, 'never', true, true, 'scatter']);
    // "A (60 %) or B (40 %)": the engine runs the first group whose roll succeeds, so B's own roll is 0.4 / (1 − 0.6) = 1: 0.999
    expect(shape(AF, 'enc_flats_jackals')).toEqual([['cr_salt_jackal×3'], 0.999, 'never', true, true, 'regroup']);
    expect(loc(AF).encounters.map((x) => x.id).slice(0, 2)).toEqual(['enc_flats_cinderback', 'enc_flats_jackals']);
    expect(flat(WL[BN]?.block ?? '')).toContain('first: cr_cinderback ×1 (50%; one of the warm shapes).');
    expect(shape(BN, 'enc_orchard_cinderback')).toEqual([['cr_cinderback×1'], 0.5, 'never', true, true, 'scatter']);
    expect(flat(WL[GP]?.block ?? '')).toContain('first: cr_salt_jackal ×3 (100%).');
    expect(shape(GP, 'enc_pan_jackals')).toEqual([['cr_salt_jackal×3'], 1, 'never', true, true, 'regroup']);
    expect(flat(WL[SC]?.block ?? '')).toContain('first: cr_steppe_harrier ×2 (60%).');
    expect(shape(SC, 'enc_cairns_harriers')).toEqual([[`${HARRIER}×2`], 0.6, 'never', true, true, 'regroup']);
    expect(flat(WL[WF]?.block ?? '')).toContain('first: cr_steppe_harrier ×2 (40%).');
    expect(shape(WF, 'enc_ridge_harriers')).toEqual([[`${HARRIER}×2`], 0.4, 'never', true, true, 'regroup']);
    expect(flat(WL[RD]?.block ?? '')).toContain('first: cr_reed_stalker ×1 (40%).');
    expect(shape(RD, 'enc_reedmarch_stalker')).toEqual([['cr_reed_stalker×1'], 0.4, 'never', true, true, 'scatter']);
    const boss = e(HG, 'enc_grave_ashmaw');
    expect([boss.groups, boss.fleeable, boss.onFlee, boss.chance, boss.optionalWhen]).toEqual([[{ creatureId: ASHMAW, count: 1 }], false, 'hold', 1, { echo: 'echo_dreyl_brand' }]);
    expect(flat(WL[HG]?.block ?? '')).toContain('**forced boss:** cr_ashmaw ×1 (adds cr_salt_jackal).');
    // §10.4: the Cinderback's two nodes, the forced boss, the scatter nodes
    const row = tableRows(section(WORLD, '### 10.4 Elites', '### 10.5')).find((c) => c[0] === 'ashen_steppe');
    expect(row?.slice(1, 4)).toEqual(['cr_cinderback (AF 60%, BN 50%)', 'HG without `echo_dreyl_brand`', 'AF, GP']);
    expect(row?.[4]).toBe('from the south (ungated): VG→RD→WF→SG→AF→HR (AF scatters)');
  });

  test('return rolls at WORLD’s chances, each ahead of the pool’s 20 %; the Pan names no pool, so it is `safe` (no wandering roll), as are the Gate, Hearthring and the Grave', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const back = (l: string, id: string) => [e(l, id).chance, e(l, id).respawn, e(l, id).once, e(l, id).groups.map((g) => `${g.creatureId}×${g.count}`)];
    expect(flat(WL[AF]?.block ?? '')).toContain('return: cr_steppe_harrier ×2 (30%) or pool(steppe) 20%.');
    expect(back(AF, 'enc_flats_harriers')).toEqual([0.3, 'on_return', false, [`${HARRIER}×2`]]);
    expect(flat(WL[BN]?.block ?? '')).toContain('return: cr_salt_jackal ×2 (35%) or pool 20%.');
    expect(back(BN, 'enc_orchard_jackals')).toEqual([0.35, 'on_return', false, ['cr_salt_jackal×2']]);
    expect(flat(WL[GP]?.block ?? '')).toContain('return: cr_salt_jackal ×2 (40%).');
    expect(back(GP, 'enc_pan_jackals_return')).toEqual([0.4, 'on_return', false, ['cr_salt_jackal×2']]);
    expect(flat(WL[SC]?.block ?? '')).toContain('return: pool 20%.');
    expect(flat(WL[WF]?.block ?? '')).toContain('return: pool 20%.');
    expect(flat(WL[RD]?.block ?? '')).toContain('return: pool(steppe) 10% / pool(glowfen) 10%.');
    expect(loc(RD).wanderingPools).toEqual([{ regionId: REGION, chance: 0.1 }, { regionId: 'region_glowfen', chance: 0.1 }]); // D-098
    expect([SG, AF, HR, BN, GP, SC, WF, RD, HG].map((id) => loc(id).safe)).toEqual([true, false, true, false, true, false, false, false, true]);
    expect(WL[SG]?.block).toContain('**Encounters:** none (watched).');
    expect(WL[HR]?.block).toContain('**Encounters:** none (settlement).');
  });

  test('the Reedmarch’s “pool(steppe) 10 % / pool(glowfen) 10 %” is its `wanderingPools` (D-098, U34d): one return roll at 20 %, then either pool by its share', () => {
    expect(flat(WL[RD]?.block ?? '')).toContain('pool(steppe) 10% / pool(glowfen) 10%');
    expect(WORLD).toContain('| `pool_glowfen` | cr_glowfen_mireling 30 · cr_lantern_toad 25 · cr_spore_drift 20 · cr_reed_stalker 15 · cr_barrow_light 10 |');
    expect(loc(RD).wanderingPools).toEqual([{ regionId: REGION, chance: 0.1 }, { regionId: 'region_glowfen', chance: 0.1 }]);
    expect(loc(RD).encounters.filter((x) => x.respawn === 'on_return').map((x) => x.id)).toEqual([]);
  });

  test('events: every WORLD event, its text verbatim, ids as WORLD spells them, once; WORLD’s grants and conditions', () => {
    // U57 hooked `q_bone_road`'s inscription on an interact at the Cairns (tests/unit/content/quests/regional.test.ts pins it)
    const U57_HOOKS = ['ev_hallows_ember_bowl'];
    for (const l of parsedLocations) {
      const got = Object.fromEntries(l.events.filter((e) => !e.id.endsWith('_plain') && !U57_HOOKS.includes(e.id)).map((e) => [e.id, e.text]));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.events]);
      for (const e of l.events) if (!U57_HOOKS.includes(e.id)) expect([e.id, e.trigger, e.once]).toEqual([e.id, 'enter', true]);
    }
    const ev = (l: string, id: string) => byId(loc(l).events, id);
    expect(ev(BN, 'ev_orchard_brand').effects).toEqual([{ grantEcho: 'echo_dreyl_brand' }]);
    expect(WL[BN]?.block).toContain('— once; grants `echo_dreyl_brand`.');
    expect(ev(WF, 'ev_ridge_apex').effects).toEqual([{ grantEcho: 'echo_breach_clock' }]);
    expect(WL[WF]?.block).toContain('— once; grants `echo_breach_clock`.');
    expect(ev(HR, 'ev_hearthring_brothers').when).toEqual({ quest: { id: 'q_clear_path', status: 'completed' } });
    expect(WL[HR]?.block).toContain('— once, requires `{quest:"q_clear_path",stage:"completed"}`.');
    // `ev_hallows_cairn` is STORY's Hallow's Cairn (`q_bone_road` stage 3; C-37)
    expect(STORY).toContain('`loc_stormgate_cairns`, `ev_hallows_cairn`');
  });

  test('the two conditional grants are each two events with complementary `when`s: the grant with the item in the pack, the same text without it', () => {
    const pairs = [
      ['ev_cairns_strike', 'ev_cairns_strike_plain', 'item_sky_whisper_talisman', 'echo_sky_oath', 'grants `echo_sky_oath` (Stormcrown\'s bargain, §6) with `{item:"item_sky_whisper_talisman"}`'],
      ['ev_hallows_cairn', 'ev_hallows_cairn_plain', 'item_borins_forge_mark', 'echo_iron_that_does_not_wish', '`echo_iron_that_does_not_wish` with `item_borins_forge_mark` in inventory'],
    ] as const;
    for (const [grantId, plainId, itemId, echo, worded] of pairs) {
      const grant = byId(loc(SC).events, grantId);
      const plain = byId(loc(SC).events, plainId);
      expect(plain.text).toBe(grant.text);
      expect(WL[SC]?.block).toContain(worded);
      expect([grant.when, grant.effects]).toEqual([worldCondition(`{item:"${itemId}"}`), [{ grantEcho: echo }]]);
      expect([plain.when, plain.effects]).toEqual([{ not: worldCondition(`{item:"${itemId}"}`) }, []]);
      for (const carrying of [[], [itemId], ['item_other']]) {
        const fires = [grant, plain].map((x) => holds(x.when as Condition, SC, { carrying }));
        expect([itemId, carrying, fires]).toEqual([itemId, carrying, carrying.includes(itemId) ? [true, false] : [false, true]]);
      }
    }
    expect(loc(SC).events.map((x) => x.id)).toEqual(['ev_cairns_strike', 'ev_cairns_strike_plain', 'ev_hallows_cairn', 'ev_hallows_cairn_plain', 'ev_hallows_ember_bowl']); // the last is U57's
  });

  test('NPC placement: Ferrin at the Gate, Hadda, Oma, Tessaly and Ketch at Hearthring, nowhere else', () => {
    expect(WL[HR]?.npcIds).toEqual(['npc_hadda_ironvow', 'npc_oma_varr', 'npc_tessaly_varr', 'npc_ketch']);
    for (const l of parsedLocations) expect([l.id, l.npcs]).toEqual([l.id, WL[l.id]?.npcIds]);
    expect(loc(SG).npcs).toEqual(['npc_scout_ferrin']);
    expect(loc(HR).npcs).toHaveLength(4);
  });

  test('art: WORLD’s horizon per block, the steppe template, the camp at Hearthring', () => {
    expect(parsedLocations.map((l) => [l.id, l.art.template, l.art.horizon])).toEqual(ALL.map((id) => [id, id === HR ? 'camp' : 'steppe', WL[id]?.horizon]));
    expect([WL[WF]?.horizon, WL[SC]?.horizon, WL[SG]?.horizon]).toEqual([0.4, 0.48, 0.58]);
    expect(loc(HG).tags).toEqual(['boss', 'regional_boss']);
  });
});

// ---- Map data (WORLD §11) -------------------------------------------------------------------------------------------------------

describe('WORLD §11 map data', () => {
  test('§11.1 nodes: coordinates, band, rest, merchant; the settlement is Hearthring', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable]);
      const rest = l.rest === undefined ? '—' : l.rest.when === undefined ? l.rest.kind : 'cond';
      expect([l.id, rest, l.merchantId ?? '—']).toEqual([l.id, n?.rest, n?.merchant]);
      expect([l.id, l.tags.includes('settlement')]).toEqual([l.id, n?.settlement]);
    }
  });

  test('§11.2 edges: every walk edge touching the region exists with its direction, cost and gate on both sides; the road is the one `road` edge', () => {
    const walks = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(walks.map((e) => `${e.from}>${e.to}`)).toEqual([`${BO}>${SG}`, `${VG}>${RD}`, `${SG}>${AF}`, `${SG}>${BN}`, `${SG}>${WF}`, `${AF}>${HR}`, `${AF}>${GP}`, `${HR}>${SC}`, `${HR}>${HG}`, `${BN}>${GP}`, `${GP}>${SC}`, `${WF}>${RD}`]);
    for (const e of walks) {
      if (here.has(e.from)) {
        const exit = loc(e.from).exits.find((x) => x.to === e.to);
        expect([e.from, e.to, exit?.dir, exit?.travelWatches, exit?.when !== undefined]).toEqual([e.from, e.to, e.dir, e.cost, e.gate !== 'open']);
      }
      if (here.has(e.to)) {
        const back = loc(e.to).exits.find((x) => x.to === e.from);
        expect([e.to, e.from, back?.dir, back?.travelWatches, back?.when !== undefined]).toEqual([e.to, e.from, e.reverseDir, e.reverseCost, e.reverseGate !== 'open']);
      }
    }
    // the neighbours' sides resolve: the Outpost's gated east door (U43) and the Glowlands' north door (U45)
    expect(pack.locations[BO]?.exits.find((x) => x.to === SG)).toMatchObject({ dir: 'east' });
    expect(pack.locations[BO]?.exits.find((x) => x.to === SG)?.when).toBeDefined();
    expect(pack.locations[VG]?.exits.find((x) => x.to === RD)?.dir).toBe('north');
    const roads = EDGES.filter((e) => e.kind === 'road');
    expect(roads.map((e) => [e.from, e.to, e.dir, e.reverseDir, e.cost, e.reverseCost, e.gate, e.reverseGate])).toEqual([
      [SG, RD, 'south (the waystone road)', 'north (the waystone road)', 1, 1, 'gate_steppe_road', 'gate_steppe_road'],
    ]);
    for (const [from, to] of [[SG, RD], [RD, SG]] as const) {
      expect(loc(from).exits.find((x) => x.to === to)).toMatchObject({ dir: 'path', kind: 'road', label: 'the waystone road', travelWatches: 1, gate: { echo: 'echo_steppe_waystones' } });
    }
    expect(section(WORLD, '### 11.2 Edges', '### 11.3')).toContain('(93 = 88 walk + 1 road');
  });

  test('§11.3 gates: the Waystone road and the Herd-Grave door carry WORLD’s conditions (the Outpost’s door is U43’s)', () => {
    const gates = Object.fromEntries(tableRows(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).map((c) => [unquote(c[0] ?? ''), unquote(c[2] ?? '')]));
    expect(gates['gate_steppe_road']).toBe('{echo:"echo_steppe_waystones"}');
    expect(loc(SG).exits.find((e) => e.kind === 'road')?.gate).toEqual(worldCondition(gates['gate_steppe_road'] ?? ''));
    expect(loc(RD).exits.find((e) => e.kind === 'road')?.gate).toEqual(worldCondition(gates['gate_steppe_road'] ?? ''));
    // `{quest:"q_bone_road",stage:"accepted"}` is the quest atom with no status: "in the journal" (active or completed)
    expect(gates['gate_herd_grave']).toBe('{any:[{quest:"q_bone_road",stage:"accepted"},{echo:"echo_nomad_signs"}]}');
    expect(loc(HR).exits.find((e) => e.to === HG)?.when).toEqual({ any: [{ quest: { id: 'q_bone_road' } }, worldCondition('{echo:"echo_nomad_signs"}')] });
    expect(gates['gate_scorched_gate']).toContain('q_blighted_outpost');
    expect(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).toContain('| `gate_scorched_gate` | blighted_outpost → scorched_gate |');
  });

  /** Is a gate satisfiable in Loop 1 (quests, items and the night rule can be had)? `echoes` also opens the Echo terms. */
  const satisfiable = (cond: Condition, echoes: boolean): boolean => {
    const [key, value] = Object.entries(cond as Record<string, unknown>)[0] ?? ['', undefined];
    if (key === 'any') return (value as Condition[]).some((c) => satisfiable(c, echoes));
    if (key === 'all') return (value as Condition[]).every((c) => satisfiable(c, echoes));
    if (key === 'echo') return echoes;
    return key !== 'flag';
  };
  /** Watches from `from` to every landed location over the exits whose gates `open` allows (a road counts only through its gate). */
  const reach = (from: string, open: (cond: Condition) => boolean, within?: ReadonlySet<string>): Map<string, number> => {
    const dist = new Map<string, number>([[from, 0]]);
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i] ?? '';
      for (const exit of pack.locations[at]?.exits ?? []) {
        if (pack.locations[exit.to] === undefined || dist.has(exit.to) || (within !== undefined && !within.has(exit.to))) continue;
        const gate = exit.kind === 'road' ? exit.gate : exit.when;
        if (gate !== undefined && !open(gate)) continue;
        dist.set(exit.to, (dist.get(at) ?? 0) + exit.travelWatches);
        queue.push(exit.to);
      }
    }
    return dist;
  };

  test('reachability from loc_whispering_ruins: nothing of the Steppe with no gate satisfied; the Gate is 5 watches away once the Peaks and the Outpost are open (WORLD §3.13)', () => {
    const none = reach(WR, () => false);
    expect(ALL.map((id) => none.has(id))).toEqual(ALL.map(() => false));
    // WORLD §11.3: "with no gate satisfied, 11 nodes are reachable (… DS)": none of them is a Steppe node
    expect(section(WORLD, '### 11.3', '### 11.4')).toContain('(WR, CA, DC, SL, SP, SA, MP, WY, IC, CW, DS)');
    // Loop 1 terms (quests and items satisfiable, Echo terms closed): the Peaks (`q_clear_path` accepted), the Outpost (`q_blighted_outpost` completed)
    const loop1 = reach(WR, (c) => satisfiable(c, false));
    expect(loop1.get(SG)).toBe(5);
    expect(WORLD).toContain('WR → Mistwood → Camp → Peaks → Outpost → Scorched Gate (5)');
    expect(ALL.map((id) => loop1.get(id))).toEqual([5, 6, 7, 6, 7, 8, 6, 7, 8]);
    // the pacifist path of §10.4 is the same graph from the Outpost: the Hearthring is 3 watches past it (BO→SG→AF→HR)
    expect([loop1.get(HR), loop1.get(BO)].map(Number)).toEqual([7, 4]);
  });

  test('§10.3 through-routes: BO→SG→AF→HR is 3 watches and SG→WF→RD→VG is 3; the waystone road makes BO→SG→RD→VG 3 (D-068.1, WORLD X3)', () => {
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'ashen_steppe') ?? [];
    expect(row[3]).toBe('BO→SG→AF→HR · SG→WF→RD→VG');
    expect(row[4]).toBe('3 · 3');
    const land = new Set<string>([...here, BO, VG]);
    const bare = (c: Condition) => satisfiable(c, false);
    const roaded = (c: Condition) => satisfiable(c, true);
    expect(reach(BO, bare, land).get(HR)).toBe(3);
    expect(reach(SG, bare, land).get(VG)).toBe(3);
    expect(reach(SG, roaded, land).get(VG)).toBe(2);
    expect(reach(BO, bare, land).get(VG)).toBe(4);
    expect(reach(BO, roaded, land).get(VG)).toBe(3);
    expect(section(WORLD, '### 10.10', '## 11. Map data')).toContain('3 with the road (BO→SG→RD→VG)');
  });

  test('§10.3 row: 9 nodes, sweep 10 watches, fights 4.9 first / 1.9 return (D-098: WORLD’s own 1.92 now), worst node 2 from a rest point', () => {
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'ashen_steppe') ?? [];
    expect(row.slice(1, 3)).toEqual(['7–11', '9']);
    // the sweep: the shortest walk from the Gate that visits every node of the region (a breadth-first search over visited sets);
    // the road is not an edge until its gate holds
    const inside = new Map<string, string[]>(parsedLocations.map((l) => [l.id, l.exits.filter((e) => e.kind !== 'road').map((e) => e.to).filter((t) => here.has(t))]));
    const ordered = [...inside.keys()];
    const full = (1 << ordered.length) - 1;
    const start = ordered.indexOf(SG);
    let frontier = new Set<string>([`${start}:${1 << start}`]);
    const visited = new Set(frontier);
    let walk = 0;
    while (![...frontier].some((k) => Number(k.split(':')[1]) === full)) {
      const next = new Set<string>();
      for (const key of frontier) {
        const [at, mask] = key.split(':').map(Number) as [number, number];
        for (const to of inside.get(ordered[at] ?? '') ?? []) {
          const j = ordered.indexOf(to);
          const k = `${j}:${mask | (1 << j)}`;
          if (!visited.has(k)) {
            visited.add(k);
            next.add(k);
          }
        }
      }
      frontier = next;
      walk += 1;
    }
    expect(walk).toBe(Number(row[6]));
    expect(row[6]).toBe('10');

    // expected fights (WORLD §10.0): the fixed first-visit groups roll in order and the first success fights, so a node's chance
    // is 1 − Π(1 − p) ("A (60%) or B (40%)" is one fight); a return visit rolls its own groups, then the pool unless the node is safe
    const fixed = (l: Location) => l.encounters.filter((e) => e.respawn !== 'on_return' && e.when === undefined);
    const chanceOf = (groups: readonly { chance: number }[]): number => 1 - groups.reduce((p, e) => p * (1 - e.chance), 1);
    const firstVisit = (list: readonly Location[]): number => list.reduce((sum, l) => sum + chanceOf(fixed(l)), 0);
    const returning = (list: readonly Location[]): number =>
      list.reduce((sum, l) => {
        const own = l.encounters.filter((e) => e.respawn === 'on_return' && e.when === undefined);
        // a location's own pools (D-098: the Reedmarch's two) roll once at the sum of their chances
        const pool = l.safe ? 0 : (l.wanderingPools?.reduce((n, p) => n + p.chance, 0) ?? region.returnEncounterChance);
        return sum + (1 - (1 - chanceOf(own)) * (1 - pool));
      }, 0);
    const some = (ids2: readonly string[]) => ids2.map((id) => loc(id));
    // (the Gate's Horde husks have a `when`: a Horde fight, not a Loop 1 expectation; the Grave's return is nothing: safe, boss cleared)
    expect(firstVisit(some(ALL)).toFixed(1)).toBe('4.9');
    expect(row[7]).toBe('4.9 / 1.9');
    // D-098 (U34d): the Reed Stalker is the pool's own entry at the Ridge and the Descent, so both roll WORLD's 20 % (U46's 5 %
    // group ahead of the pool made it 24 %, 2.00 in all): WORLD's 1.92, the row's 1.9
    expect(returning(some(ALL)).toFixed(2)).toBe('1.92');
    expect(returning(some([WF, RD])).toFixed(2)).toBe('0.40');
    // the through-routes of the row: SG→AF→HR, and WF + RD (+ the Glowlands' VG, which the Glowlands unit counts)
    expect(row[5]).toBe('1.0 / 0.4 · 1.8 / 0.8');
    expect(firstVisit(some([SG, AF, HR])).toFixed(1)).toBe('1.0');
    expect(returning(some([SG, AF, HR])).toFixed(1)).toBe('0.4');
    expect(firstVisit(some([WF, RD])).toFixed(1)).toBe('0.8');
    const vg = pack.locations[VG] as Location;
    expect((firstVisit(some([WF, RD])) + firstVisit([vg])).toFixed(1)).toBe('1.8');
    // "to rest": the worst node's distance to the nearer camp
    const camps = [HR, WF];
    const dist = (from: string): number => {
      const d = new Map<string, number>([[from, 0]]);
      const q = [from];
      for (let i = 0; i < q.length; i++) for (const t of inside.get(q[i] ?? '') ?? []) if (!d.has(t)) (d.set(t, (d.get(q[i] ?? '') ?? 0) + 1), q.push(t));
      return Math.min(...camps.map((c) => d.get(c) ?? Infinity));
    };
    expect(Math.max(...ALL.map(dist))).toBe(Number(row[8]));
    expect(row[8]).toBe('2');
    expect(row[9]).toBe('HR camp, WF camp');
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6.2, §6.6', () => {
  const MINE = ['cr_salt_jackal', 'cr_cinderback', ASHMAW, 'cr_reed_stalker'];

  test('exactly the creatures whose first region is the Steppe (D-090), in WORLD’s order; the Harrier is the Highlands’ (U44), the Husk is the Horde’s (U45)', () => {
    const first = Object.values(CREATURE_TABLE).filter((r) => /^Ashen Steppe/.test(r.regions)).map((r) => r.id);
    expect([...first].sort()).toEqual([...MINE].sort());
    expect(creatures.map((c) => c.id)).toEqual(MINE);
    expect(CREATURE_TABLE[HARRIER]?.regions).toBe('Highlands, Ashen Steppe');
    expect(creatures.map((c) => c.id as string)).not.toContain(HARRIER);
    expect(CREATURE_TABLE['cr_horde_husk']?.regions).toBe('Horde (any infected node)');
  });

  test('name, family, role, level and XP as WORLD’s table; XP follows DESIGN §6.2 (fodder round(20 + 8L + 1.2L²), elite ×1.8; the boss is hand-set 720)', () => {
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, row?.name.startsWith(c.name), c.family, c.role, c.level, c.xp]).toEqual([c.id, true, row?.family, row?.role, row?.level, row?.xp]);
    }
    const fodder = (L: number): number => Math.round(20 + 8 * L + 1.2 * L * L);
    for (const c of creatures) if (c.role !== 'boss') expect([c.id, c.xp]).toEqual([c.id, Math.round(fodder(c.level) * (c.role === 'elite' ? 1.8 : 1))]);
    // regional boss: band top + 2; 400–1,200 hand-set
    expect([cr(ASHMAW).level, cr(ASHMAW).xp]).toEqual([region.levelBand.max + 2, 720]);
    expect(cr(ASHMAW).xp).toBeGreaterThanOrEqual(400);
    expect(cr(ASHMAW).xp).toBeLessThanOrEqual(1200);
    expect(cr('cr_cinderback').role).toBe('elite');
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK; the boss’s HP is 12 × (38.4 − 6 armor) = 389, WORLD prints 390 (D-067.20)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
    expect(cr(ASHMAW).stats).toEqual({ hp: 390, atk: 25, sp: 25, armor: 6, ward: 3, agi: 6 });
    expect(Math.round(12 * (38.4 - 6))).toBe(389);
    expect(WORLD).toMatch(/HP 390 \(~~520~~; 12 × \(38\.4 . 6 armor\) = 389, D-067\.20\)/);
  });

  test('resistances and immunities as WORLD’s Resist line: weak and resist types, the boss’s Fire immunity, status immunities; the boss is Stun-immune and Stagger-able', () => {
    const DAMAGE = /^(physical|fire|storm|ley|void|chrono)$/;
    const resistLine = (id: string) => {
      const text = bullet(block(id), 'Resist:');
      const types = (label: string): string[] => (new RegExp(`(?:^|· )${label} ([^·]+)`).exec(text)?.[1] ?? '').split(',').map((s) => s.trim().replace(/\s*\(.*$/, '')).filter((t) => DAMAGE.test(t));
      const immune = [...text.matchAll(/immune:? ([a-z, ]+)/g)].flatMap((m) => (m[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean));
      return { weak: types('weak'), resist: types('resist'), immuneDamage: immune.filter((t) => DAMAGE.test(t)), immuneStatus: immune.filter((t) => !DAMAGE.test(t)) };
    };
    const kind = (c: Creature, which: string): string[] => Object.entries(c.resistances).filter(([, r]) => r === which).map(([t]) => t).sort();
    for (const c of parsedCreatures) {
      const w = resistLine(c.id);
      expect([c.id, kind(c, 'weak'), kind(c, 'resist'), kind(c, 'immune'), [...c.statusImmunities].sort()]).toEqual([
        c.id, [...w.weak].sort(), [...w.resist].sort(), [...w.immuneDamage].sort(), w.immuneStatus.map((s) => `status_${s}`).sort(),
      ]);
    }
    expect(parsedCreatures.map((c) => [c.id, c.statusImmunities])).toEqual([['cr_salt_jackal', []], ['cr_cinderback', ['status_burn']], [ASHMAW, ['status_burn', 'status_stun']], ['cr_reed_stalker', ['status_poison']]]);
    expect([cr(ASHMAW).interruptible, cr(ASHMAW).fleeable, cr(ASHMAW).tags]).toEqual([true, false, ['regional_boss', 'herd']]);
    expect(bullet(block(ASHMAW), 'Resist:')).toContain('Stagger allowed');
    expect(block(ASHMAW)).toContain('cannot be fled');
    // fire is the Steppe's element: every Wilds creature here resists or is immune to it, and Storm is their weakness (the Cairns pull it down)
    expect(['cr_salt_jackal', 'cr_cinderback', ASHMAW].map((id) => [cr(id).resistances['storm'], cr(id).resistances['fire']])).toEqual([['weak', 'resist'], ['weak', 'resist'], ['weak', 'immune']]);
    expect([cr('cr_reed_stalker').resistances['fire'], cr('cr_reed_stalker').resistances['ley']]).toEqual(['weak', 'resist']);
  });

  test('moves: exactly WORLD’s intent ids with their telegraph lines verbatim; every move reached by a pattern; telegraphs ≤ 12 words; area moves target all, self moves target self', () => {
    for (const c of parsedCreatures) {
      const intents: Record<string, string> = {};
      for (const m of block(c.id).matchAll(/^\s*- `([a-z0-9_]+)` · "([^"]+)"/gm)) intents[m[1] ?? ''] = m[2] ?? '';
      expect(Object.keys(intents).length).toBeGreaterThan(0);
      for (const [id, line] of Object.entries(intents)) expect([c.id, id, c.moves[id]?.line]).toEqual([c.id, id, line]);
      const used = new Set<string>();
      const visit = (s: Step) => void ('move' in s && used.add(s.move));
      walkSteps(c.pattern, [], visit);
      for (const ph of c.phases) walkSteps(ph.pattern, [], visit);
      for (const m of Object.values(c.moves)) if (m.windUp) used.add(m.windUp.then);
      for (const l of c.hpLines) if (l.move !== undefined) used.add(l.move); // U34e: a move an HP line forces
      const unused = Object.keys(c.moves).filter((id) => !used.has(id));
      expect([c.id, unused]).toEqual([c.id, []]);
      for (const m of Object.values(c.moves)) expect([c.id, m.line, words(m.line) <= 12]).toEqual([c.id, m.line, true]);
    }
    // who each move is aimed at, read off the pattern steps: WORLD's `all` (area) and `self`
    const aims = (id: string): Record<string, string[]> => {
      const c = cr(id);
      const out: Record<string, Set<string>> = {};
      const visit = (s: Step) => void ('move' in s && (out[s.move] ??= new Set()).add(s.target ?? 'player'));
      walkSteps(c.pattern, [], visit);
      for (const ph of c.phases) walkSteps(ph.pattern, [], visit);
      return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
    };
    expect(aims('cr_salt_jackal')).toEqual({ jackal_harry: ['player'], jackal_pull_down: ['player'], jackal_scatter: ['self'], jackal_snap: ['player'] });
    expect(aims('cr_cinderback')).toEqual({ cinder_stampede: ['player'], cinder_rekindle: ['self'], cinder_paw: ['player'], cinder_hook: ['player'], cinder_shake: ['all'] });
    expect(aims('cr_reed_stalker')).toEqual({ reed_still: ['self'], reed_twice: ['player'], reed_wade: ['self'], reed_spear: ['player'] });
    // the Grief is aimed at itself by its HP line (U34e: `forceIntent`), not by a pattern step
    expect(aims(ASHMAW)).toEqual({ ashmaw_low: ['all'], ashmaw_breathe: ['all'], ashmaw_shoulder: ['player'], ashmaw_paw: ['player'], ashmaw_gore: ['all'], ashmaw_stampede: ['player'], ashmaw_brand_flare: ['all'] });
    // the Stampede is WORLD's id with no telegraph of its own ("no wind-up" in Phase 3): written here, and visible
    expect(cr(ASHMAW).moves['ashmaw_stampede']?.line).toBe('The herd comes down on you as one.');
    expect(cr(ASHMAW).moves['ashmaw_stampede']?.hidden).toBe(false);
    expect(cr(ASHMAW).moves['ashmaw_paw']).toMatchObject({ hidden: true, windUp: { turns: 1, then: 'ashmaw_stampede' } });
  });

  test('moves carry WORLD’s numbers: the multiplier and stat, type, statuses and their chances, hits, shield, regen, leaving combat', () => {
    const m = (c: string, id: string) => cr(c).moves[id];
    const hit = (c: string, id: string) => [m(c, id)?.type, m(c, id)?.power?.coef, m(c, id)?.power?.stat];
    const rows = (c: string, id: string) => m(c, id)?.statuses.map((s) => [s.status.slice('status_'.length), s.chance, s.duration, s.target]);
    expect(hit('cr_salt_jackal', 'jackal_harry')).toEqual(['physical', 0.6, 'atk']);
    expect(rows('cr_salt_jackal', 'jackal_harry')).toEqual([['mark', 1, 2, 'target']]);
    expect(hit('cr_salt_jackal', 'jackal_snap')).toEqual(['physical', 0.9, 'atk']);
    expect(rows('cr_salt_jackal', 'jackal_snap')).toEqual([['bleed', 0.3, 3, 'target']]);
    expect(hit('cr_salt_jackal', 'jackal_pull_down')).toEqual(['physical', 1.4, 'atk']);
    expect(m('cr_salt_jackal', 'jackal_scatter')?.leaveCombat).toBe(true);
    expect(m('cr_salt_jackal', 'jackal_scatter')?.power).toBeUndefined(); // "leaves combat (no loot)"
    expect(hit('cr_cinderback', 'cinder_stampede')).toEqual(['fire', 2, 'sp']);
    expect(rows('cr_cinderback', 'cinder_stampede')).toEqual([['burn', 0.6, 3, 'target']]);
    // "misses entirely if you Guard": U34e (D-094) `missesIfGuarded` — no damage and no Burn against a Guarding target
    expect(m('cr_cinderback', 'cinder_stampede')?.missesIfGuarded).toBe(true);
    expect(m('cr_cinderback', 'cinder_stampede')?.statuses[0]?.when).toBeUndefined();
    expect(hit('cr_cinderback', 'cinder_hook')).toEqual(['physical', 1.1, 'atk']);
    expect(rows('cr_cinderback', 'cinder_hook')).toEqual([['armor_break', 0.3, 2, 'target']]);
    expect(hit('cr_cinderback', 'cinder_shake')).toEqual(['fire', 0.5, 'sp']);
    expect(rows('cr_cinderback', 'cinder_shake')).toEqual([['blind', 0.4, 1, 'target']]);
    expect(m('cr_cinderback', 'cinder_rekindle')?.shield?.power).toEqual({ base: 0, coef: 1, stat: 'atk', hits: 1 });
    expect(hit('cr_cinderback', 'cinder_paw')).toEqual(['fire', 1.8, 'sp']);
    expect(rows('cr_cinderback', 'cinder_paw')).toEqual([['burn', 0.6, 3, 'target']]);
    expect(m('cr_cinderback', 'cinder_paw')?.statuses[0]?.when).toBeUndefined(); // the Paw's Burn lands whatever you do
    expect(rows('cr_reed_stalker', 'reed_still')).toEqual([['phase', 1, 1, 'self']]);
    expect(hit('cr_reed_stalker', 'reed_spear')).toEqual(['physical', 1.2, 'atk']);
    expect(rows('cr_reed_stalker', 'reed_spear')).toEqual([['blind', 0.3, 1, 'target']]);
    expect(m('cr_reed_stalker', 'reed_twice')?.power).toMatchObject({ coef: 0.7, stat: 'atk', hits: 2 }); // "2 hits × 0.7× you"
    expect(rows('cr_reed_stalker', 'reed_twice')).toEqual([['bleed', 0.3, 2, 'target']]);
    expect(rows('cr_reed_stalker', 'reed_wade')).toEqual([['regen', 1, 3, 'self']]); // "regen self 0.3×/3"
    expect(m('cr_reed_stalker', 'reed_wade')?.statuses[0]?.power).toMatchObject({ coef: 0.3, stat: 'atk' });
    expect(hit(ASHMAW, 'ashmaw_breathe')).toEqual(['fire', 0.7, 'sp']);
    expect(rows(ASHMAW, 'ashmaw_breathe')).toEqual([['blind', 0.4, 1, 'target']]);
    expect(hit(ASHMAW, 'ashmaw_shoulder')).toEqual(['physical', 1.3, 'atk']);
    expect(rows(ASHMAW, 'ashmaw_shoulder')).toEqual([['slow', 0.4, 2, 'target']]);
    expect(m(ASHMAW, 'ashmaw_low')?.power).toBeUndefined();
    expect(rows(ASHMAW, 'ashmaw_low')).toEqual([['weaken', 0.6, 2, 'target']]);
    expect(hit(ASHMAW, 'ashmaw_stampede')).toEqual(['fire', 2.2, 'sp']);
    expect(rows(ASHMAW, 'ashmaw_stampede')).toEqual([['burn', 0.8, 3, 'target']]);
    expect(hit(ASHMAW, 'ashmaw_gore')).toEqual(['physical', 1.2, 'atk']);
    expect(hit(ASHMAW, 'ashmaw_brand_flare')).toEqual(['fire', 1, 'sp']);
    expect(rows(ASHMAW, 'ashmaw_brand_flare')).toEqual([['burn', 1, 3, 'target']]);
    expect([m(ASHMAW, 'ashmaw_grief')?.power, m(ASHMAW, 'ashmaw_grief')?.statuses]).toEqual([undefined, []]); // "no action"
  });

  test('loot: gold ranges and every item WORLD lists, with WORLD’s chances and counts (100 % = guaranteed); Ashmaw also pays the Pyre Ledger', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      const text = bullet(block(c.id), 'Loot:');
      const expected = [...text.matchAll(/`((?:item|mat)_[a-z0-9_]+)`†?(?: ×(\d+))? (\d+)%/g)].map((m) => [m[1], Number(m[2] ?? 1), Number(m[3]) / 100]);
      // Ashmaw: the Grave's block lists `item_dreyls_pyre_ledger` as "100% first clear" and the creature block omits it: the fight pays it too
      const got = c.loot.filter((l) => l.itemId !== 'item_dreyls_pyre_ledger').map((l) => [l.itemId, l.count, l.chance]);
      expect([c.id, got]).toEqual([c.id, expected]);
      for (const l of c.loot) expect([c.id, l.when]).toEqual([c.id, undefined]);
    }
    expect(cr(ASHMAW).loot.at(-1)).toMatchObject({ itemId: 'item_dreyls_pyre_ledger', count: 1, chance: 1 });
    expect(cr('cr_cinderback').loot[0]).toMatchObject({ itemId: 'mat_cinder_horn', chance: 1 });
    expect(bullet(block('cr_cinderback'), 'Loot:')).toContain('`mat_cinder_horn`† 100%'); // † = introduced by WORLD, adopted by DESIGN §8.2 (C-42)
    // gold [3 + 2L, 6 + 3L], elite ×2, boss ×5 (DESIGN §6.5): the figures WORLD prints
    const gold = (c: Creature) => [c.gold.min, c.gold.max];
    expect(gold(cr('cr_salt_jackal'))).toEqual([17, 27]);
    expect(gold(cr('cr_cinderback'))).toEqual([38, 60]);
    expect(gold(cr('cr_reed_stalker'))).toEqual([21, 33]);
    expect(gold(cr(ASHMAW))).toEqual([135, 210]);
  });

  test('bestiary voice, entry and tactics are WORLD’s text verbatim (backticks dropped); family codex entries; reveals at 1 and 3 kills; short non-legacy descriptions', () => {
    for (const c of parsedCreatures) {
      const b = block(c.id);
      const voice = /- \*\*Bestiary\*\* \((Remnant Archive|Wayfinder's Notes)\)/.exec(b)?.[1];
      expect([c.id, c.bestiary.voice]).toEqual([c.id, voice === 'Remnant Archive' ? 'remnant_archive' : 'wayfinder_notes']);
      expect([c.id, c.bestiary.summary]).toEqual([c.id, playText(bullet(b, 'Bestiary'))]);
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, playText(bullet(b, 'Tactics:'))]);
      expect([c.id, c.bestiary.codexId]).toEqual([c.id, c.family === 'fam_green' ? 'codex_creatures_green' : 'codex_creatures_wilds']);
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
      expect([c.id, c.legacyName, /- \*\*Legacy description:\*\*/.test(b)]).toEqual([c.id, undefined, false]); // no legacy line: the Steppe's own
      expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
    }
    expect(STORY).toContain('| `codex_creatures_wilds` |');
    expect(STORY).toContain('| `codex_creatures_green` |');
    expect(parsedCreatures.map((c) => [c.id, c.family])).toEqual([['cr_salt_jackal', 'fam_wilds'], ['cr_cinderback', 'fam_wilds'], [ASHMAW, 'fam_wilds'], ['cr_reed_stalker', 'fam_green']]);
  });
});

// ---- Patterns, walked by the engine ------------------------------------------------------------------------------------------

/** WORLD's cadence words, turn by turn: the moves `id` commits to (by `generateIntent`), its phase, HP, statuses and allies set per turn. */
function plan(
  id: string,
  turns: number,
  o: {
    phase?: number;
    from?: number;
    /** The rest of the group (the creature itself is `id` × 1, first). */
    allies?: readonly { creatureId: string; count: number }[];
    before?: (turn: number, foe: Combatant, combat: CombatState, s: GameState) => void;
  } = {},
): string[] {
  const profile = freshProfile();
  const s = makeState({ level: 12 }, { content: epack, profile });
  // one initiative draw for the player, one for each enemy (the creature first, then its group)
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1), ...Array.from({ length: 8 }, (_, i) => D.d4((i % 4) + 1))], epack, profile);
  const groups = [{ creatureId: id, count: 1 }, ...(o.allies ?? [])];
  const combat = beginCombat(ctx, { id: 'enc_test', groups, fleeable: false, onFlee: 'hold', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] } satisfies EncounterSpec);
  const foe = combat.enemies[0] as Combatant;
  if (o.phase !== undefined) Object.assign(foe, { phase: o.phase });
  foe.pattern.pointer = 0;
  foe.pattern.turnsTaken = (o.from ?? 1) - 1;
  const out: string[] = [];
  for (let turn = o.from ?? 1; turn < (o.from ?? 1) + turns; turn++) {
    combat.round = turn;
    o.before?.(turn, foe, ctx.s.combat as CombatState, ctx.s);
    const intent = generateIntent(ctx, combat, foe);
    const move = intent ? epack.creatures[id]?.moves[intent.moveId] : undefined;
    out.push(intent?.moveId.replace(/^[a-z]+_/, '') ?? '—');
    // what executing it does to the wind-up (combat/intents.ts executeIntent), then the turn ends (its countdown)
    if (move?.windUp && !Object.keys(foe.cooldowns).some((k) => k.startsWith('windup:'))) foe.cooldowns[`windup:${intent?.moveId}`] = move.windUp.turns + 1;
    for (const k of Object.keys(foe.cooldowns)) if (k.startsWith('windup:') && (foe.cooldowns[k] = (foe.cooldowns[k] ?? 0) - 1) <= 0) delete foe.cooldowns[k];
    foe.pattern.turnsTaken += 1;
  }
  return out;
}
const seq = (s: string): string[] => s.split(' ');
const hpAt = (fraction: number) => (foe: Combatant) => void (foe.hp = Math.floor(foe.hpMax * fraction));
const withStatus = (c: Combatant, statusId: string, on: boolean): void => {
  c.statuses = c.statuses.filter((st) => st.statusId !== statusId);
  if (on) c.statuses.push({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false });
};
const player = (combat: CombatState): Combatant => combat.party[0] as Combatant;

describe('patterns: WORLD’s cadence words hold turn by turn (first-match on every turn; two cycled moves alternate)', () => {
  test('the Salt Jackal: Harry first, Pull Down while you are Marked, Scatter below a quarter HP, else Snap', () => {
    const turn = (t: number, f: Combatant, c: CombatState): void => {
      withStatus(player(c), 'status_mark', t === 2 || t === 3 || t === 5);
      hpAt(t >= 5 ? 0.2 : 1)(f);
    };
    // Pull Down is ahead of Scatter (WORLD's listing order): marked at low HP it still pulls you down
    expect(plan('cr_salt_jackal', 7, { before: turn })).toEqual(seq('harry pull_down pull_down snap pull_down scatter scatter'));
    expect(plan('cr_salt_jackal', 4)).toEqual(seq('harry snap snap snap')); // clear the Mark and it only bites
  });

  test('the Cinderback: Stampede first (Guard turn one), Paw every fourth turn (Guard it), Hook and Shake between, Rekindle once below half HP while the shield is down', () => {
    expect(plan('cr_cinderback', 9)).toEqual(seq('stampede shake hook paw hook shake hook paw hook'));
    const hurt = (t: number, f: Combatant): void => {
      hpAt(t >= 5 ? 0.4 : 1)(f);
      withStatus(f, 'status_shield', t >= 6 && t <= 8);
    };
    // Rekindle is ahead of the Paw while the shield is down (turn 5, and again on 9), behind it while the shield stands (turn 8)
    expect(plan('cr_cinderback', 9, { before: hurt })).toEqual(seq('stampede shake hook paw rekindle shake hook paw rekindle'));
  });

  test('the Reed Stalker: Still first, Twice every third turn, Wade below half HP unless it is already regenerating, else Spear', () => {
    expect(plan('cr_reed_stalker', 7)).toEqual(seq('still spear twice spear spear twice spear'));
    const hurt = (t: number, f: Combatant): void => {
      hpAt(t >= 4 ? 0.4 : 1)(f);
      withStatus(f, 'status_regen', t === 5);
    };
    // Twice is ahead of Wade (turn 6), Wade ahead of Spear (turns 4 and 7)
    expect(plan('cr_reed_stalker', 7, { before: hurt })).toEqual(seq('still spear twice wade spear twice wade'));
  });

  test('Ashmaw, Phase 1 — The Herd Sleeps: Breathe and Shoulder in turn, Low on every third turn', () => {
    expect(plan(ASHMAW, 7, { phase: 0 })).toEqual(seq('breathe shoulder low shoulder breathe low breathe'));
  });

  test('Ashmaw, Phase 2 — The Herd Wakes: Gore and Breathe in turn, the hidden Paw on every third turn, then the Stampede on the next', () => {
    expect(plan(ASHMAW, 9, { phase: 1 })).toEqual(seq('gore breathe paw stampede gore paw stampede breathe paw'));
  });

  test('Ashmaw, Phase 3 — One Animal: the Stampede on every second turn (no wind-up), Brand Flare between, Grief once below 15 % HP', () => {
    expect(plan(ASHMAW, 6, { phase: 2 })).toEqual(seq('brand_flare stampede brand_flare stampede brand_flare stampede'));
    // U34e (D-094): the Grief is an HP line, not a pattern step — the moment its HP falls under 15 % its next action is the Grief,
    // once (phases.ts `hpLines`; tests/unit/engine/u34e/creatures.test.ts plays it)
    expect(cr(ASHMAW).hpLines).toEqual([{ below: 0.15, move: 'ashmaw_grief' }]);
    const low = (t: number, f: Combatant): void => hpAt(t >= 5 ? 0.1 : 1)(f);
    expect(plan(ASHMAW, 8, { phase: 2, before: low })).toEqual(seq('brand_flare stampede brand_flare stampede brand_flare stampede brand_flare stampede'));
  });

  test('Ashmaw’s phases: ids, names, triggers (70 %, 35 %), WORLD’s transition lines; two jackals come with Phase 1; Phase 3 takes 1.185× (armor 0)', () => {
    const w = cr(ASHMAW);
    expect(w.phases.map((p) => [p.id, p.name, p.enterWhen])).toEqual([
      ['ashmaw_the_herd_sleeps', 'The Herd Sleeps', []],
      ['ashmaw_the_herd_wakes', 'The Herd Wakes', [{ hpBelow: 0.7 }]],
      ['ashmaw_one_animal', 'One Animal', [{ hpBelow: 0.35 }]],
    ]);
    const W = flat(block(ASHMAW));
    expect(W).toContain('**Phase 1 — The Herd Sleeps** (100–70%; onEnter: 2× `cr_salt_jackal`, "They come for the leavings.")');
    expect(W).toContain('**Phase 2 — The Herd Wakes** (<70%)');
    expect(W).toContain('**Phase 3 — One Animal** (<35%; its armor is 0 for the rest of the fight)');
    expect(W).toContain(`*Transition (<70%):* "${w.phases[1]?.line}"`);
    expect(W).toContain(`*Transition (<35%):* "${w.phases[2]?.line}"`);
    expect(w.phases[0]?.line).toBe('They come for the leavings.');
    expect(w.phases[0]?.adds).toMatchObject([{ creatureId: 'cr_salt_jackal', count: 2 }]);
    expect(w.phases.slice(1).map((p) => p.adds)).toEqual([[], []]);
    // no field sets a creature's armor mid-fight, so the phase takes the damage armor 0 would: D-067.20's reference arithmetic
    // inverted. 38.4 expected physical damage a round against armor 6 is 32.4 through it; 38.4 / 32.4 = 1.185 without it
    expect(w.phases.map((p) => p.damageTakenMult)).toEqual([1, 1, 1.185]);
    expect(Math.round((38.4 / (38.4 - w.stats.armor)) * 1000) / 1000).toBe(1.185);
  });
});

// ---- The NPCs ---------------------------------------------------------------------------------------------------------------

describe('the NPCs vs WORLD §4', () => {
  const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
  const rows = Object.fromEntries(tableRows(S4).filter((c) => unquote(c[0] ?? '').startsWith('npc_')).map((c) => [unquote(c[0] ?? ''), c]));
  const home = (c: string[]): string => (c[3] ?? '').replace(/\*\*stall: /, '').replace(/\*\*/g, '');
  const IDS = ['npc_scout_ferrin', 'npc_hadda_ironvow', 'npc_oma_varr', 'npc_tessaly_varr', 'npc_ketch'];

  test('exactly the NPCs whose home is in the region, in WORLD’s order: Ferrin at the Gate, the four at Hearthring', () => {
    const homes = Object.values(rows).filter((c) => here.has(/^loc_[a-z_]+/.exec(home(c))?.[0] ?? ''));
    expect(npcs.map((n) => n.id).sort()).toEqual(homes.map((c) => unquote(c[0] ?? '')).sort());
    expect(npcs.map((n) => n.id)).toEqual(IDS);
    expect(homes.map((c) => unquote(c[0] ?? ''))).toEqual(IDS);
    expect(npcs.map((n) => n.homeLocationId)).toEqual([SG, HR, HR, HR, HR]);
  });

  test('names, factions, home locations and sample lines as WORLD’s row; descriptions are the row’s cell made into sentences', () => {
    for (const n of npcs) {
      const row = rows[n.id];
      expect(row, n.id).toBeDefined();
      expect([n.id, n.name, n.factionId]).toEqual([n.id, row?.[1], row?.[2]]);
      expect([n.id, home(row ?? []).startsWith(n.homeLocationId)]).toEqual([n.id, true]);
      expect(n.barks).toHaveLength(2);
      for (const b of n.barks ?? []) expect([n.id, (row?.[6] ?? '').includes(`"${b.text}"`)]).toEqual([n.id, true]);
      expect([n.id, 'legacyName' in n]).toEqual([n.id, false]); // new characters (validator rule 22 asks a legacy name only of legacy ones)
      expect([n.id, n.portrait]).toEqual([n.id, { sigil: n.id.slice('npc_'.length), accent: 'ironclad' }]);
    }
    const cell = (id: string) => rows[id]?.[5];
    const desc = (id: string) => byId(npcs, id).description;
    expect([cell('npc_scout_ferrin'), desc('npc_scout_ferrin')]).toEqual(['Gate scout: a brazier, a horn, a smaller gate inside a burned one.', 'A gate scout at the smaller gate inside the burned one. He keeps a brazier and a horn.']);
    expect([cell('npc_hadda_ironvow'), desc('npc_hadda_ironvow')]).toEqual(['Clan-mother and warchief of the Steppe, ~50. Wants the Day of Teeth avenged.', 'Clan-mother and warchief of the Steppe. She wants the Day of Teeth avenged.']);
    expect([cell('npc_oma_varr'), desc('npc_oma_varr')]).toEqual(["The Steppe's old teller; knew the Stonehand brothers as boys.", "The Steppe's old teller. She knew the Stonehand brothers as boys."]);
    expect([cell('npc_tessaly_varr'), desc('npc_tessaly_varr')]).toEqual(["Caravan master and quartermaster; Oma's granddaughter.", "Caravan master and quartermaster, and Oma's granddaughter."]);
    expect([cell('npc_ketch'), desc('npc_ketch')]).toEqual(['Skald with a frame drum; sings the Day of Teeth.', 'A skald with a frame drum. He sings the Day of Teeth.']);
    expect(byId(npcs, 'npc_hadda_ironvow').age).toBe(50); // "~50" (WORLD and BIBLE)
  });

  test('roles and records: the questgiver, the merchant with her stall (WORLD §9 is a later unit’s), the three who tell', () => {
    expect(npcs.map((n) => [n.id, n.roles])).toEqual([
      ['npc_scout_ferrin', ['lore']], ['npc_hadda_ironvow', ['questgiver']], ['npc_oma_varr', ['lore']], ['npc_tessaly_varr', ['merchant']], ['npc_ketch', ['lore']],
    ]);
    expect(rows['npc_hadda_ironvow']?.[4]).toBe('quest giver (q_bone_road, q_day_of_teeth, q_iron_silence)');
    expect(rows['npc_tessaly_varr']?.[4]).toContain('merchant');
    expect(rows['npc_scout_ferrin']?.[4]).toContain('teaches the trail-signs');
    expect(rows['npc_oma_varr']?.[4]).toContain('teller');
    expect(rows['npc_ketch']?.[4]).toContain('skald');
    expect(byId(npcs, 'npc_tessaly_varr').merchantId).toBe('npc_tessaly_varr');
    expect(loc(HR).merchantId).toBe('npc_tessaly_varr');
    expect(WL[HR]?.block).toContain('npc_tessaly_varr (quartermaster/merchant)');
    for (const n of npcs) if (n.id !== 'npc_tessaly_varr') expect([n.id, n.merchantId]).toEqual([n.id, undefined]);
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder after the Reach; the region tables are in `contentTables` and the index', () => {
    const folders = REGION_FOLDERS.map((f) => f.region.id);
    expect(folders).toContain(REGION);
    expect(folders.indexOf('region_drowned_reach')).toBeLessThan(folders.indexOf(REGION));
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('The Ashen Steppe');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.name).toBe(c.name);
    for (const n of npcs) expect(pack.npcs[n.id]?.name).toBe(n.name);
    expect(items).toEqual([]); // the items tables are U49/U50's; this region owns none
  });

  test('validates with 0 errors; nothing real is reported about the region (D-098: rule 11 leaves the Gate’s Horde husks out); pending references name only tables still being authored', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const about = report.warnings.filter((w) => mine.has(w.id) || locations.some((l) => w.message.includes(` ${l.id}`)));
    const real = about.filter((w) => !w.message.startsWith('pending — content not yet authored'));
    // the Horde Husk (L12, the Horde's) at the Scorched Gate (band 7) was rule 11's one warning here; D-098 (U34d) leaves the
    // Horde's own placements (a `when` that needs `flag_horde_active`) out of the band check
    expect(real.map((w) => `${w.rule} ${w.id} ${w.path}`).sort()).toEqual([]);
    for (const w of about.filter((x) => x.message.startsWith('pending — content not yet authored (reference): '))) {
      const table = /not found in ([a-z]+)$/.exec(w.message)?.[1];
      expect([w.message, INCOMPLETE_TABLES.includes(table as (typeof INCOMPLETE_TABLES)[number])]).toEqual([w.message, true]);
    }
  });

  test('`npm run validate`: exit 0, 0 errors', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/ regions \d+ · locations \d+ · creatures \d+ · /);
    expect(text).toMatch(/validate: ok — 0 errors, \d+ warning\(s\)$/m);
  });

  test('this region’s pending references name only ids WORLD/STORY/DESIGN spell (items, quests, Echoes, the merchant and faction records, codex entries, U44’s Harrier); the Outpost, the Glowlands and the Husk now resolve', () => {
    const { report } = parseContentPack(contentTables);
    const targets = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    // Later units resolve these one by one (items U49/U50, quests U52–U59, Echoes, the merchants, the Highlands' Harrier): the list may only shrink
    const known = new Set([
      'item_nomad_hardtack', 'item_hearth_broth', 'item_salt_charm', 'item_storm_jar', 'item_whetstone_strip', 'item_glow_moss', 'item_cinder_heart', 'item_dreyls_pyre_ledger',
      'item_sky_whisper_talisman', 'item_borins_forge_mark',
      'mat_ember_ore', 'mat_cinder_horn', 'mat_iron_rivet', 'mat_steppe_salt', 'mat_storm_glass', 'mat_wildling_hide', 'mat_ley_resin', 'mat_glow_gland',
      'echo_steppe_waystones', 'echo_nomad_signs', 'echo_dreyl_brand', 'echo_sky_oath', 'echo_iron_that_does_not_wish', 'echo_breach_clock',
      'q_bone_road', 'q_clear_path',
      HARRIER,
      'npc_tessaly_varr', // the merchant record (WORLD §9)
      'ironclad', // the faction record (region.factionId, npc factions)
      'codex_region_ashen_steppe', 'codex_creatures_wilds', 'codex_creatures_green',
    ]);
    expect([...targets].filter((t) => !known.has(t)).sort()).toEqual([]);
    for (const t of [BO, VG, 'cr_horde_husk', 'cr_reed_stalker', 'cr_salt_jackal']) expect([t, targets.has(t)]).toEqual([t, false]);
    expect(targets.has(HARRIER)).toBe(!harrierLanded);
    // every one is an id the documents spell
    const docs = `${WORLD}\n${STORY}\n${DESIGN}`;
    for (const id of targets) expect([id, docs.includes(id)]).toEqual([id, true]);
  });
});

// ---- The engine on the real pack ------------------------------------------------------------------------------------------------

describe('the region in the engine (real pack, seeded)', () => {
  test('the waystone road does not exist until `echo_steppe_waystones` (it is not even listed), then joins the Gate and the Descent in one watch, both ways', () => {
    expect(movesFrom(SG)).toEqual([AF, BN, BO, WF].sort());
    expect(movesFrom(SG, { loop: 3, echoes: ['echo_steppe_waystones'] })).toEqual([AF, BN, BO, RD, WF].sort());
    expect(movesFrom(RD)).toEqual([VG, WF].sort());
    expect(movesFrom(RD, { loop: 3, echoes: ['echo_steppe_waystones'] })).toEqual([SG, VG, WF].sort());
    const taken = arrive(SG, RD, { loop: 3, echoes: ['echo_steppe_waystones'] });
    expect(taken.world.currentLocationId).toBe(RD);
    expect(taken.clock.ticks - stateAt(SG).clock.ticks).toBe(1); // one watch (D-068.1), the walk's price
    const walked = arrive(SG, WF);
    expect(walked.clock.ticks - stateAt(SG).clock.ticks).toBe(1);
  });

  test('the Grave’s door: the Herd is not woken by strangers; `q_bone_road` in the journal or `echo_nomad_signs` opens it', () => {
    expect(movesFrom(HR)).toEqual([AF, SC].sort());
    expect(movesFrom(HR, { quests: { q_bone_road: 'active' } })).toEqual([AF, HG, SC].sort());
    expect(movesFrom(HR, { quests: { q_bone_road: 'completed' } })).toEqual([AF, HG, SC].sort());
    expect(movesFrom(HR, { loop: 2, echoes: ['echo_nomad_signs'] })).toEqual([AF, HG, SC].sort());
    expect(movesFrom(HR, { quests: { q_clear_path: 'active' } })).toEqual([AF, SC].sort());
    expect(movesFrom(HG)).toEqual([HR]); // a dead end
  });

  test('the first visit to the Flats (400 seeds): about 60 % a Cinderback, 40 % three jackals, never nothing; both fights can be fled', () => {
    const N = 400;
    const t = tally(N, (i) => arrive(SG, AF, { seed: `u46-af-${i}` }));
    expect([...t.keys()].filter((k) => k !== '—').sort()).toEqual(['enc_flats_cinderback', 'enc_flats_jackals']);
    expect((t.get('enc_flats_cinderback') ?? 0) / N).toBeGreaterThan(0.5);
    expect((t.get('enc_flats_cinderback') ?? 0) / N).toBeLessThan(0.7);
    expect((t.get('enc_flats_jackals') ?? 0) / N).toBeGreaterThan(0.3);
    expect((t.get('enc_flats_jackals') ?? 0) / N).toBeLessThan(0.5);
    expect(t.get('—') ?? 0).toBeLessThanOrEqual(2); // the 0.999 of the form: one in a thousand
    for (let i = 0; i < 40; i++) {
      const s = arrive(SG, AF, { seed: `u46-shape-${i}` });
      if (s.mode !== 'combat') continue;
      const kinds = s.combat?.encounterId === 'enc_flats_cinderback' ? ['cr_cinderback'] : ['cr_salt_jackal', 'cr_salt_jackal', 'cr_salt_jackal'];
      expect(s.combat?.enemies.map((e) => e.refId)).toEqual(kinds);
      // D-144: the jackals drop Steppe Salt (q_blood_and_salt) and regroup; the Cinderback scatters
      expect(s.combat).toMatchObject({ canFlee: true, onFlee: s.combat?.encounterId === 'enc_flats_cinderback' ? 'scatter' : 'regroup' });
    }
  });

  test('the Pan’s jackals are a 100 % scatter node on the first visit, though the Pan is safe; the Orchard’s Cinderback is 50 %', () => {
    const pan = arrive(AF, GP);
    expect(pan.combat).toMatchObject({ encounterId: 'enc_pan_jackals', canFlee: true, onFlee: 'regroup' });
    expect(pan.combat?.enemies.map((e) => e.refId)).toEqual(['cr_salt_jackal', 'cr_salt_jackal', 'cr_salt_jackal']);
    const N = 300;
    const t = tally(N, (i) => arrive(SG, BN, { seed: `u46-bn-${i}` }, ['ev_orchard_brand']));
    expect([...t.keys()].sort()).toEqual(['enc_orchard_cinderback', '—'].sort());
    expect((t.get('enc_orchard_cinderback') ?? 0) / N).toBeGreaterThan(0.4);
    expect((t.get('enc_orchard_cinderback') ?? 0) / N).toBeLessThan(0.6);
  });

  test('the Cairns, the Ridge and the Descent open on harriers 60 % / 40 % and a stalker 40 % (300 seeds each); the harriers come in pairs', () => {
    const N = 300;
    const rate = (from: string, to: string, id: string, quiet: string[] = []) => (tally(N, (i) => arrive(from, to, { seed: `u46-${to}-${i}` }, quiet)).get(id) ?? 0) / N;
    const sc = rate(HR, SC, 'enc_cairns_harriers');
    expect([sc > 0.5, sc < 0.7]).toEqual([true, true]);
    const wf = rate(SG, WF, 'enc_ridge_harriers', ['ev_ridge_apex']);
    expect([wf > 0.3, wf < 0.5]).toEqual([true, true]);
    const rd = rate(WF, RD, 'enc_reedmarch_stalker');
    expect([rd > 0.3, rd < 0.5]).toEqual([true, true]);
    for (const [from, to] of [[HR, SC], [SG, WF]] as const) {
      for (let i = 0; i < 40; i++) {
        const s = arrive(from, to, { seed: `u46-pair-${to}-${i}` }, ['ev_ridge_apex']);
        if (s.mode === 'combat') expect(s.combat?.enemies.map((e) => e.refId)).toEqual([HARRIER, HARRIER]);
      }
    }
  });

  test('Hearthring, the Scorched Gate and the Herd-Grave roll no wandering fight on a return; the Pan only its own 40 % group (300 seeds each)', () => {
    const N = 300;
    for (const [from, to] of [[AF, HR], [AF, SG], [HR, HG]] as const) expect([to, [...tally(N, (i) => arriveAgain(from, to, i, { quests: { q_bone_road: 'active' } })).keys()]]).toEqual([to, ['—']]);
    const pan = tally(N, (i) => arriveAgain(AF, GP, i));
    expect([...pan.keys()].sort()).toEqual(['enc_pan_jackals_return', '—'].sort());
    expect((pan.get('enc_pan_jackals_return') ?? 0) / N).toBeGreaterThan(0.3);
    expect((pan.get('enc_pan_jackals_return') ?? 0) / N).toBeLessThan(0.5);
    // and Hearthring on the first visit too
    for (let i = 0; i < 100; i++) expect(arrive(AF, HR, { seed: `u46-hr-${i}` }).mode).toBe('explore');
  });

  test('return visits elsewhere: the Flats 30 % harriers then the pool (about 44 %), the Orchard 35 % jackals then the pool (about 48 %), the Cairns, the Ridge and the Descent the pool alone (about 20 %; D-098)', () => {
    const N = 300;
    const near = (x: number, target: number) => [x > target - 0.1, x < target + 0.1];
    const run = (from: string, to: string) => tally(N, (i) => arriveAgain(from, to, i));
    const total = (t: Map<string, number>) => N - (t.get('—') ?? 0);
    const af = run(SG, AF);
    expect(near(total(af) / N, 0.44)).toEqual([true, true]);
    expect([...af.keys()].filter((k) => k !== '—').sort()).toEqual(['enc_flats_harriers', 'wandering']);
    const bn = run(SG, BN);
    expect(near(total(bn) / N, 0.48)).toEqual([true, true]);
    expect([...bn.keys()].filter((k) => k !== '—').sort()).toEqual(['enc_orchard_jackals', 'wandering']);
    const sc = run(HR, SC);
    expect(near(total(sc) / N, 0.2)).toEqual([true, true]);
    expect([...sc.keys()].filter((k) => k !== '—')).toEqual(['wandering']);
    // D-098 (U34d): the stalker is the pool's own entry at these two nodes, and the Descent's roll is its two pools' 10 % + 10 %
    for (const [from, to] of [[SG, WF], [WF, RD]] as const) {
      const t = run(from, to);
      expect(near(total(t) / N, 0.2)).toEqual([true, true]);
      expect([...t.keys()].filter((k) => k !== '—')).toEqual(['wandering']);
    }
  });

  test('the wandering pool of the Steppe is jackals and harriers, singly or in pairs; the stalker joins it at the Ridge and the Descent only, and the Descent draws on the Glowfen’s pool too (D-098)', () => {
    const met = (from: string, to: string, n: number) => {
      const seen2 = new Set<string>();
      for (let i = 0; i < n; i++) {
        const s = arriveAgain(from, to, i);
        if (s.mode === 'combat' && s.combat?.encounterId === 'wandering') for (const e of s.combat.enemies) seen2.add(e.refId);
      }
      return [...seen2].sort();
    };
    expect(met(HR, SC, 400)).toEqual(['cr_salt_jackal', HARRIER].sort());
    expect(met(SG, WF, 600)).toEqual(['cr_reed_stalker', 'cr_salt_jackal', HARRIER].sort());
    // the Descent: the Steppe's three and the Glowfen's daytime four (its barrow light is the Shallows' and the Mangrove's)
    const glowfen = ['cr_glowfen_mireling', 'cr_lantern_toad', 'cr_spore_drift', 'cr_reed_stalker'];
    const descent = met(WF, RD, 1200);
    expect(descent.every((id) => [...glowfen, 'cr_salt_jackal', HARRIER].includes(id))).toBe(true);
    expect(descent.some((id) => ['cr_glowfen_mireling', 'cr_lantern_toad', 'cr_spore_drift'].includes(id))).toBe(true);
    expect(descent.some((id) => ['cr_salt_jackal', HARRIER].includes(id))).toBe(true);
  });

  test('the Herd-Grave: a held boss fight without the Echo (Ashmaw, with Phase 1’s two jackals); with `echo_dreyl_brand` the fight is skipped and the bowl lies quiet', () => {
    const open = { loop: 2, echoes: ['echo_nomad_signs'] };
    const fight = arrive(HR, HG, open);
    expect(fight.mode).toBe('combat');
    expect(fight.combat).toMatchObject({ encounterId: 'enc_grave_ashmaw', canFlee: false, onFlee: 'hold' });
    expect(fight.combat?.enemies.map((e) => [e.refId, e.phase])).toEqual([[ASHMAW, 0], ['cr_salt_jackal', 0], ['cr_salt_jackal', 0]]);
    const said = arrive(HR, HG, { loop: 2, echoes: ['echo_nomad_signs', 'echo_dreyl_brand'] });
    expect(said.mode).toBe('explore');
    expect(said.world.currentLocationId).toBe(HG);
  });

  test('the Gate’s husks (R10-1): only in a Horde, only once the Gate is infected (D-098: the `infected` atom, not the move count); no Brak clause', () => {
    const husks = byId(loc(SG).encounters, 'enc_gate_husks');
    expect(husks.when).toBeDefined();
    if (husks.when === undefined) return;
    const horde = { flag_horde_active: true };
    expect(holds(husks.when, SG, { infected: [SG] })).toBe(false); // infected without a Horde (not a real state)
    expect(holds(husks.when, SG, { flags: horde })).toBe(false);
    expect(holds(husks.when, SG, { flags: horde, hordeMoves: 30, infected: ['loc_temporal_breach_apex', BO] })).toBe(false); // not reached yet
    expect(holds(husks.when, SG, { flags: horde, hordeMoves: 2, infected: [SG] })).toBe(true);
    expect(holds(husks.when, SG, { flags: { ...horde, flag_brak_kept_away: true }, infected: [SG] })).toBe(true); // the Camp's Brak clause is not the Gate's
    expect(holds(husks.when, SG, { flags: { ...horde, flag_clock_expired: true }, infected: [SG] })).toBe(true);
    expect([husks.groups, husks.fleeable, husks.onFlee]).toEqual([[{ creatureId: 'cr_horde_husk', count: 2 }], false, 'hold']);
    expect(WL[SG]?.block).toContain('Horde: cr_horde_husk ×2.');
    expect(section(WORLD, '### 10.4 Elites', '### 10.5')).toContain('RD 4 → WF 5 → SG 6 → AF, BN 7');
    expect(loc(SG).encounters.map((x) => x.id)).toEqual(['enc_gate_husks']);
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U46 reply -----------------------------------------

describe('authored words outside the documents are few and short; coined ids are the listed ones', () => {
  test('encounter intros are ≤ 30 words; the non-legacy descriptions are drawn from the documents; the Stampede’s telegraph is the one move line WORLD does not give', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro)).filter((t): t is string => t !== undefined);
    expect(intros).toHaveLength(12); // every encounter carries one (D-098 retired the two located-stalker groups)
    for (const t of intros) expect([t, words(t) <= 30]).toEqual([t, true]);
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro))).not.toContain(undefined);
    expect(loc(HR).exits.map((e) => e.lockedText).filter(Boolean)).toHaveLength(1);
    for (const l of parsedLocations) for (const e of l.exits) if (e.lockedText) expect([e.lockedText, words(e.lockedText) <= 30]).toEqual([e.lockedText, true]);
    // the move lines WORLD does not give: only the Stampede's
    const worded = new Set(Object.values(Object.fromEntries(parsedCreatures.map((c) => [c.id, worldCreature(c.id).intents]))).flatMap((x) => Object.values(x)));
    const own = parsedCreatures.flatMap((c) => Object.values(c.moves).map((m) => m.line)).filter((line) => !worded.has(line));
    expect(own).toEqual(['The herd comes down on you as one.']);
  });

  test('ids this unit coined (WORLD/STORY have none for them): encounter ids, the two plain events, Ashmaw’s phase ids', () => {
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.id))).toEqual([
      'enc_gate_husks',
      'enc_flats_cinderback', 'enc_flats_jackals', 'enc_flats_harriers',
      'enc_orchard_cinderback', 'enc_orchard_jackals',
      'enc_pan_jackals', 'enc_pan_jackals_return',
      'enc_cairns_harriers',
      'enc_ridge_harriers',
      'enc_reedmarch_stalker',
      'enc_grave_ashmaw',
    ]);
    const wordedEvents = new Set(Object.values(WL).flatMap((w) => Object.keys(w.events)));
    expect(parsedLocations.flatMap((l) => l.events.map((e) => e.id)).filter((id) => !wordedEvents.has(id))).toEqual(['ev_cairns_strike_plain', 'ev_hallows_cairn_plain', 'ev_hallows_ember_bowl']); // the last is U57's hook
    expect(cr(ASHMAW).phases.map((p) => p.id)).toEqual(['ashmaw_the_herd_sleeps', 'ashmaw_the_herd_wakes', 'ashmaw_one_animal']);
    // every move id is WORLD's: the creatures use WORLD's intent ids only
    for (const c of parsedCreatures) for (const id of Object.keys(c.moves)) expect([c.id, id, WORLD.includes(`\`${id}\``)]).toEqual([c.id, id, true]);
    expect(ids(JSON.stringify(locations), 'ambient')).toEqual([]);
  });
});
