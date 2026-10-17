// U48a: The Skyreach — checked against the documents at test time, U42's pattern (regions/silverwood_ruins.test.ts) and the
// Steppe's (regions/ashen_steppe.test.ts): WORLD §2.11, §3.10, §3.13, §4, §6.5, §8.1, §10.1, §10.3–10.5, §11.1–11.3, §12.1,
// §12.3; DESIGN §6.2, §6.5, §9.5, §10.5, §17.1, §18.2; STORY's codex ids and `q_high_mark`; BIBLE; PLAN Appendix A. The region is
// new (no legacy text, no `legacyName`), so every description is WORLD's, character for character. Patterns are walked turn by
// turn by the engine (`generateIntent`), so every WORLD cadence word is held to what the game does. Where a record departs from
// the letter of WORLD (a reading the schema or the engine forces), the test pins the departure so a later edit cannot move it
// silently; the readings are listed in the U48a reply. The last group reports the 73 locations' reachability from
// loc_whispering_ruins against whatever has landed (order-agnostic: the Veil and the Glowfen are U47's).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures } from '@content/regions/skyreach/creatures';
import { items } from '@content/regions/skyreach/items';
import { locations } from '@content/regions/skyreach/locations';
import { npcs } from '@content/regions/skyreach/npcs';
import { region } from '@content/regions/skyreach/region';
import { validateContent } from '@content/validate';
import {
  apply,
  applyHit,
  beginCombat,
  evaluate,
  executeIntent,
  generateIntent,
  hasStatus,
  legalActions,
  step,
  type Action,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameState,
} from '@engine/index';
import type { Condition } from '@schema/condition';
import { CreatureSchema, walkSteps, type Creature, type Step } from '@schema/creature';
import type { ItemInput } from '@schema/item';
import { LocationSchema, type Location } from '@schema/location';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { main as validateCli } from '../../../../tools/validate-content';
import { PLAN, WORLD, section, tableRows, unquote, worldCreature, worldCreatureTable, worldEdges, worldLocations, worldNodes } from './worldDoc';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');
const BIBLE = fs.readFileSync(path.join(ROOT, 'docs/BIBLE.md'), 'utf8');

const REGION = 'region_skyreach';
const WW = 'loc_windward_stair';
const CR = 'loc_spire_crown';
const RS = 'loc_roost_of_sentinels';
const AE = 'loc_auldes_eyrie';
const PE = 'loc_stormcrowns_perch';
const SPIRES = 'loc_aetherium_spires';
const PLATEAU = 'loc_sky_whisper_plateau';
const WR = 'loc_whispering_ruins';
const ALL = [WW, CR, RS, AE, PE];
const LOOM = 'cr_spire_loom';
const KITE = 'cr_gale_kite';
const RAY = 'cr_cloud_ray';
const CROWN = 'cr_stormcrown';
const WEAVER = 'cr_aetherial_weaver';
const MOTE = 'cr_glass_mote';
const SENTINEL = 'cr_sky_whisper_sentinel';
const TALISMAN = 'item_sky_whisper_talisman';
const PRISM = 'item_aetherium_prism';
const AXE = 'item_hearth_iron_greataxe';
const STAFF = 'item_spire_builders_staff';

const S211 = section(WORLD, '### 2.11 `region_skyreach`', '### 2.12');
const S310 = section(WORLD, '### 3.10 The Skyreach', '### 3.11');
const WL = Object.fromEntries(worldLocations(S310).map((l) => [l.id, l]));
const NODES = worldNodes();
const EDGES = worldEdges();
const CREATURE_TABLE = worldCreatureTable();
const pack = buildContentPack();
const parsedLocations: Location[] = locations.map((l) => LocationSchema.parse(l));
const parsedCreatures: Creature[] = creatures.map((c) => CreatureSchema.parse(c));
const here = new Set<string>(locations.map((l) => l.id));
const mine = new Set<string>([REGION, ...locations.map((l) => l.id), ...creatures.map((c) => c.id)]);

const byId = <T extends { id: string }>(rows: readonly T[], id: string): T => {
  const found = rows.find((r) => r.id === id);
  if (!found) throw new Error(`no record ${id}`);
  return found;
};
const loc = (id: string): Location => byId(parsedLocations, id);
const cr = (id: string): Creature => byId(parsedCreatures, id);
/** One line of prose: the document's wrapped lines joined. */
const flat = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim();
/** WORLD's prose as play text: markdown emphasis, decision and document references dropped (the creature files' header). */
const playText = (s: string): string =>
  flat(s)
    .replace(/[`*]/g, '')
    .replace(/ \(D-\d+(?:\.\d+)?\)/g, '')
    .replace(/ \(WORLD §\d+(?:\.\d+)?\)/g, '');
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

// ---- The engine pack: stand-ins for the four items the climbs, the bargain, the ledge and the case need -------------------------

/**
 * The item records are U49/U50's. The engine tests carry four of them — the Sky-Whisper Talisman (the climbs, the bargain), the
 * Aetherium Prism (Aulde's case), the Hearth-Iron Greataxe (the ledge) and the Spire-Builder's Staff (the case) — so `epack` is
 * the real pack with these stand-ins wherever the record has not landed. No test of the content itself reads them.
 */
const STAND_INS: ItemInput[] = [
  { id: TALISMAN, name: 'Sky-Whisper Talisman', type: 'trinket', slot: 'trinket', tier: 2, description: 'Stand-in (test only).', stats: { agility: 1 }, value: 32, art: { icon: 'talisman' }, tags: ['key'] },
  { id: PRISM, name: 'Aetherium Prism', type: 'key', tier: 0, description: 'Stand-in (test only).', value: 1, art: { icon: 'prism' }, tags: ['key'] },
  { id: AXE, name: 'Hearth-Iron Greataxe', type: 'key', tier: 0, description: 'Stand-in (test only).', value: 1, art: { icon: 'axe' }, tags: [] },
  { id: STAFF, name: "Spire-Builder's Staff", type: 'key', tier: 0, description: 'Stand-in (test only).', value: 1, art: { icon: 'staff' }, tags: [] },
];
const epack = buildContentPack({ ...contentTables, items: [...contentTables.items, ...STAND_INS.filter((i) => pack.items[i.id] === undefined)] }, { validate: false });

// ---- Engine helpers -----------------------------------------------------------------------------------------------------------

interface At {
  seed?: string;
  loop?: number;
  flags?: Record<string, boolean>;
  /** Echoes granted this loop (the pack has no echo records yet, so they are set directly). */
  echoes?: string[];
  /** Item ids carried (stand-ins or real records). */
  items?: string[];
  /** Locations stood in this loop: their first-visit fights are behind the player (cleared). */
  visited?: string[];
  /** Encounters scattered, by location. */
  scattered?: Record<string, string[]>;
  ironclad?: number;
}

const PLACES = [...ALL, SPIRES, PLATEAU];
/**
 * A location state as if the player had been there or not: its items already spawned (no item record exists to spawn), its
 * `enter` events already fired (their Echoes' records are a later unit's) — the `interact` ones stay open — and, if visited,
 * the first-visit groups behind it.
 */
const seeded = (id: string, visited: boolean, scattered: string[] = []): GameState['world']['locationStates'][string] => {
  const l = (epack.locations[id] ?? loc(id)) as Location;
  return {
    visited,
    visitCount: visited ? 1 : 0,
    items: [],
    itemsSpawned: true,
    encountersCleared: visited ? l.encounters.filter((e) => e.respawn === 'never').map((e) => e.id) : [],
    encounterClearedDay: {},
    eventsFired: l.events.filter((e) => e.trigger === 'enter').map((e) => e.id),
    flags: {},
    unlockedExits: [],
    lockedExits: [],
    scattered,
    encounterHp: {},
  };
};

/** A level-14 Wayfinder standing at `locationId` on the engine pack. */
function stateAt(locationId: string, o: At = {}): GameState {
  return makeState(
    {
      locationId,
      seed: o.seed ?? 'u48a',
      ...(o.loop === undefined ? {} : { loop: o.loop }),
      level: 14,
      items: o.items ?? [],
      flags: o.flags ?? {},
      ...(o.ironclad === undefined ? {} : { reputation: { ironclad: o.ironclad } }),
      patch: (s) => {
        for (const id of PLACES) s.world.locationStates[id] = seeded(id, (o.visited ?? []).includes(id), o.scattered?.[id] ?? []);
        for (const id of o.echoes ?? []) s.echoesThisLoop.push(id);
      },
    },
    { content: epack },
  );
}
const profileOf = (o: At = {}) => freshProfile({ loopCounter: o.loop ?? 1 });
const holds = (cond: Condition, at: string, o: At = {}): boolean => evaluate(cond, stateAt(at, o), profileOf(o), epack);
const arrive = (from: string, to: string, o: At = {}): GameState => step(stateAt(from, o), { type: 'move', to }, epack, profileOf(o)).state;
/** A return visit: `to` has been stood in, its first-visit fights are behind the player. */
const arriveAgain = (from: string, to: string, i: number, o: At = {}): GameState => arrive(from, to, { ...o, seed: `u48a-back-${i}`, visited: [...(o.visited ?? []), to] });
const movesFrom = (locationId: string, o: At = {}): string[] =>
  legalActions(stateAt(locationId, o), epack, profileOf(o))
    .filter((a) => a.type === 'move')
    .map((a) => (a as { to: string }).to)
    .sort();
const enemiesOf = (s: GameState): string[] => s.combat?.enemies.map((e) => e.refId) ?? [];
/** How the fights fall over `n` seeds: encounter id → count ('—' = no fight). */
function tally(n: number, go: (i: number) => GameState): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const s = go(i);
    const key = s.mode === 'combat' ? (s.combat?.encounterId ?? '?') : '—';
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}
const rate = (t: Map<string, number>, id: string, n: number): number => (t.get(id) ?? 0) / n;

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_skyreach vs WORLD §2.11, §10.1, DESIGN §6.5, §17.1, §18.2', () => {
  test('id, name, new (Appendix A.1), no faction, band, WORLD’s theme text, order, codex entry', () => {
    expect(region.id).toBe(REGION);
    expect(S211.startsWith(`### 2.11 \`${REGION}\` — ${region.name}`)).toBe(true);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | new | 5 |`);
    expect('legacy' in region).toBe(false); // not one of the five legacy regions (D-015)
    expect(pack.regions[REGION]?.legacy).toBe(false);
    expect(S211).toContain('| Factions | None. Nomad sky-burials on the Roost. Remnants want Aulde\'s notes. |');
    expect('factionId' in region).toBe(false);
    expect(S211).toContain('| Level band | 12–15 |');
    expect(region.levelBand).toEqual({ min: 12, max: 15 });
    expect(DESIGN).toMatch(/\| The Skyreach \| `region_skyreach` \| 12–15 \|/);
    const theme = /\*\*Theme\.\*\* ([\s\S]*?)\n\n\| Field/.exec(S211)?.[1] ?? '';
    expect(region.description).toBe(playText(theme));
    expect(region.order).toBe(11);
    expect(region.codexId).toBe('codex_region_skyreach');
    expect(STORY).toContain('| `codex_region_skyreach` | The Skyreach |');
  });

  test('the five locations WORLD lists, in WORLD’s order, all in the region, each inside the region’s band', () => {
    const listed = /\| Locations \(5\) \| ([^|]+) \|/.exec(S211)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual(ALL);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of locations) {
      expect(l.regionId).toBe(REGION);
      expect([l.id, l.levelBand.min >= region.levelBand.min && l.levelBand.max <= region.levelBand.max]).toEqual([l.id, true]);
    }
  });

  test('the pool is WORLD §10.1’s pool_skyreach, weight for weight, no conditions; return chance 20 %; the Sentinel (L9) is WORLD’s, under the band (rule 11 warns)', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_skyreach');
    expect(row?.[2]).toBe('—');
    const entries = [...(row?.[1] ?? '').matchAll(/(cr_[a-z_]+) (\d+)/g)].map((m) => ({ creatureId: m[1] ?? '', weight: Number(m[2]) }));
    expect(entries.map((e) => e.creatureId)).toEqual([KITE, RAY, SENTINEL]);
    expect(region.wanderingPool).toEqual(entries);
    expect(region.returnEncounterChance).toBe(0.2);
    const band = (id: string) => {
      const c = pack.creatures[id];
      return [c?.role, (c?.level ?? 0) >= region.levelBand.min - 2 && (c?.level ?? 0) <= region.levelBand.max + 2];
    };
    expect(region.wanderingPool.map((e) => [e.creatureId, ...band(e.creatureId)])).toEqual([
      [KITE, 'fodder', true],
      [RAY, 'fodder', true],
      [SENTINEL, 'fodder', false], // "only fodder whose level sits in the band" (§10.1's own rule) — the row is WORLD's
    ]);
    expect(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).toContain('Only fodder whose level\nsits in the band.');
  });

  test('palette: DESIGN §17.1’s Skyreach row (sky top, sky bottom, mid, accent = glow); the ambient preset exists in §18.2', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'The Skyreach');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).some((c) => c[0] === 'The Skyreach')).toBe(true);
    expect(region.ambient).toBe('ambient_skyreach');
    // WORLD's extra layers (the Eyrie's loom-click, the Perch's thunder) are additive: no location replaces the preset
    for (const l of parsedLocations) expect([l.id, l.ambient]).toEqual([l.id, undefined]);
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the five locations vs WORLD §3.10 blocks', () => {
  test('names, bands, coordinates and region; the Perch is the boss arena', () => {
    for (const l of locations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.levelBand, l.map]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map]);
    }
    expect(WL[PE]?.block).toContain('15 (boss) · (8, 14)');
  });

  test('descriptions: WORLD’s, character for character, as play text (the Eyrie’s editorial parenthesis and the Perch’s decision reference dropped); no legacy name', () => {
    for (const l of locations) {
      const w = (WL[l.id]?.description ?? '').replace(/ \(The id was `loc_aldours_eyrie` before U9; D-063's spelling is Aulde\.\)$/, '');
      expect([l.id, l.description]).toEqual([l.id, playText(w).replace(/ \(D-\d+\.\d+\)\./, '.')]);
      expect([l.id, 'legacyName' in l]).toEqual([l.id, false]);
    }
    expect(WL[AE]?.description).toContain("(The id was `loc_aldours_eyrie` before U9; D-063's spelling is Aulde.)");
    expect(WL[PE]?.description.endsWith('keeps its distance (D-067.12).')).toBe(true);
    expect(loc(PE).description.endsWith('keeps its distance.')).toBe(true);
  });

  test('exits: every WORLD exit in order, none gated from inside; the two ways down cost one watch (the climbs are the Highlands’)', () => {
    for (const l of parsedLocations) {
      const got = l.exits.map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.exits]);
      for (const e of l.exits) expect([l.id, e.to, e.travelWatches, e.kind, e.hidden]).toEqual([l.id, e.to, 1, 'path', false]);
    }
    expect(S310).toContain('Entered from loc_sky_whisper_plateau (south) or loc_aetherium_spires (south).');
  });

  test('rest: only the Eyrie, a free camp (WORLD "Rest point: yes"); §11.1 and §10.3 still write "inn", but DESIGN §9 dropped the Skyreach inn (C-31); nothing sells', () => {
    for (const l of parsedLocations) {
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, WL[l.id]?.rest, WL[l.id]?.merchant]);
    }
    expect(loc(AE).rest).toMatchObject({ kind: 'camp', cost: 0, healPct: 1, companionSwap: true });
    expect(WL[AE]?.block).toContain("**Rest point: yes** (the workshop's inner room is windless)");
    // the departure, pinned: the node row and the traversal row say "inn"; DESIGN's inn list and WORLD's own §4/§9.3 notes say none
    expect(NODES[AE]?.rest).toBe('inn');
    expect(tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'skyreach')?.[9]).toBe('AE inn');
    expect(DESIGN).toContain('- **Inn** (Respite, Hearthring/Ironclad Camp caravan, Lanternreed, Sanctum of Threads — WORLD §9.1)');
    expect(WORLD).toContain('`npc_skyreach_trader` → no WORLD merchant exists; DESIGN §9 dropped it and the Skyreach inn (C-31).');
    expect(WORLD).toContain('| 12–15 Skyreach | none on site (DESIGN §9 dropped its Skyreach merchant and inn, C-31) | Hollis, Fennick, Anso | Aulde\'s Eyrie |');
    expect(BIBLE).toMatch(/\| Aulde's Eyrie \| `loc_auldes_eyrie` \|.*\| inn \| yes \|/);
  });

  test('every item WORLD places is placed, with WORLD’s counts and conditions; gathering is `gather`; the Perch’s fight pays its own loot; the ledge’s axe is an `interact`', () => {
    for (const l of parsedLocations) {
      const expected = new Set(WL[l.id]?.itemIds ?? []);
      if (l.gather) expected.delete(l.gather.itemId); // "gathering: X" is the location's `gather` (DESIGN §8.2)
      if (l.id === AE) expected.delete(PRISM); // "opens with item_aetherium_prism": the key, not a placement (it lies at the Crown)
      if (l.id === RS) expected.delete(AXE); // the ledge: the two `interact` events give it (below)
      if (l.id === PE) expected.delete('mat_gale_feather'); // "(100% after boss)": the Stormcrown's own loot
      expect([l.id, l.items.map((i) => i.itemId).sort()]).toEqual([l.id, [...expected].sort()]);
    }
    expect([loc(WW).gather, loc(CR).gather]).toEqual([{ itemId: 'mat_skyreach_crystal', perDay: 1 }, { itemId: 'mat_skyreach_crystal', perDay: 1 }]);
    expect([WL[WW]?.block, WL[CR]?.block].every((b) => (b ?? '').includes('gathering: mat_skyreach_crystal ×1'))).toBe(true);
    expect(loc(WW).items).toEqual([{ itemId: 'mat_gale_feather', count: 1, hidden: false, once: true }]);
    expect(loc(CR).items).toEqual([
      { itemId: 'item_aetherium_shard', count: 2, hidden: false, once: true },
      { itemId: PRISM, count: 1, hidden: false, once: true, when: { loop: { min: 2 } } },
    ]);
    expect(WL[CR]?.block).toContain('item_aetherium_shard ×2, item_aetherium_prism (100%, Loop 2+)');
    expect(loc(RS).items).toEqual([{ itemId: 'mat_gale_feather', count: 2, hidden: false, once: true }]);
    expect(loc(AE).items).toEqual([
      { itemId: 'item_auldes_spire_notes', count: 1, hidden: false, once: true },
      { itemId: 'item_breach_anchor_schematic_a', count: 1, hidden: false, once: true },
      // "locked case; opens with item_aetherium_prism": hidden, for examine, with the Prism in the pack
      { itemId: STAFF, count: 1, hidden: true, once: true, when: worldCondition(`{item:"${PRISM}"}`) },
    ]);
    expect(WL[AE]?.block).toContain('item_spire_builders_staff (locked case; opens with `item_aetherium_prism`)');
    // the Perch: the Talon with the bargain only; the three storm-glass WORLD §8.1 lists at the Perch itself
    expect(loc(PE).items).toEqual([
      { itemId: 'item_stormcrown_talon', count: 1, hidden: false, once: true, when: { all: [{ loop: { min: 2 } }, { echo: 'echo_sky_oath' }, { item: { id: TALISMAN } }] } },
      { itemId: 'mat_storm_glass', count: 3, hidden: false, once: true },
    ]);
    expect(WL[PE]?.block).toContain('item_stormcrown_talon (100% after boss or bargain), mat_gale_feather (100% after boss), mat_storm_glass ×3');
    expect(tableRows(section(WORLD, '### 8.1 Materials', '### 8.2')).find((c) => unquote(c[0] ?? '').startsWith('mat_storm_glass'))?.[5]).toBe('`cr_steppe_harrier` 30%; `loc_stormgate_cairns` ×2, `loc_stormcrowns_perch` ×3');
    expect(cr(CROWN).loot.map((r) => [r.itemId, r.count, r.chance])).toEqual([['item_stormcrown_talon', 1, 1], ['mat_gale_feather', 1, 1], ['mat_storm_glass', 3, 1], ['mat_skyreach_crystal', 2, 1]]);
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa (the Perch’s kite is the Stormcrown’s own)', () => {
    for (const l of parsedLocations) {
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      const expected = new Set(WL[l.id]?.creatureIds ?? []);
      if (l.id === PE) expected.delete(KITE); // "(adds cr_gale_kite)": the Stormcrown's Phase 1 and its Call Kite
      expect([l.id, [...got].sort()]).toEqual([l.id, [...expected].sort()]);
    }
    expect(cr(CROWN).phases[0]?.adds).toMatchObject([{ creatureId: KITE, count: 1 }]);
  });

  test('first-visit fights: the Stair 60 %, the Crown, the Roost and the Eyrie 100 %, the Perch a held boss; §10.4’s elite, forced node and scatter nodes', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const shape = (l: string, id: string) => {
      const x = e(l, id);
      return [x.groups.map((g) => `${g.creatureId}×${g.count}`), x.chance, x.respawn, x.once, x.fleeable, x.onFlee];
    };
    expect(flat(WL[WW]?.block ?? '')).toContain('first: cr_gale_kite ×2 (60%). return: pool(skyreach) 20%.');
    expect(shape(WW, 'enc_windward_kites')).toEqual([[`${KITE}×2`], 0.6, 'never', true, true, 'scatter']);
    expect(flat(WL[CR]?.block ?? '')).toContain('first: cr_aetherial_weaver ×2 + cr_glass_mote ×1 (100%).');
    expect(shape(CR, 'enc_crown_weavers')).toEqual([[`${WEAVER}×2`, `${MOTE}×1`], 1, 'never', true, true, 'scatter']);
    expect(flat(WL[RS]?.block ?? '')).toContain('first: cr_sky_whisper_sentinel ×1 + cr_gale_kite ×1 (100%).');
    expect(shape(RS, 'enc_roost_sentinel_kite')).toEqual([[`${SENTINEL}×1`, `${KITE}×1`], 1, 'never', true, true, 'scatter']);
    expect(flat(WL[AE]?.block ?? '')).toContain('first: cr_spire_loom ×1 + cr_aetherial_weaver ×1 (100%).');
    expect(shape(AE, 'enc_eyrie_loom_weaver')).toEqual([[`${LOOM}×1`, `${WEAVER}×1`], 1, 'never', true, true, 'scatter']);
    const boss = e(PE, 'enc_perch_stormcrown');
    expect([boss.groups, boss.fleeable, boss.onFlee, boss.chance, boss.when]).toEqual([[{ creatureId: CROWN, count: 1 }], false, 'hold', 1, undefined]);
    expect(flat(WL[PE]?.block ?? '')).toContain('**forced boss:** cr_stormcrown ×1 (adds cr_gale_kite) unless bargain.');
    const row = tableRows(section(WORLD, '### 10.4 Elites', '### 10.5')).find((c) => c[0] === 'skyreach');
    expect(row?.slice(1, 5)).toEqual(["cr_spire_loom (AE, 100%, at the region's only rest)", 'PE without `echo_sky_oath` + Talisman', 'CR, RS, AE', 'SW→WW→AE (AE scatters; then rest)']);
    // the scatter nodes' groups and the elite scatter (R10-1); only the boss holds
    for (const l of parsedLocations) for (const x of l.encounters) expect([x.id, x.fleeable, x.onFlee]).toEqual([x.id, l.id !== PE, l.id === PE ? 'hold' : 'scatter']);
    expect(cr(LOOM).role).toBe('elite');
  });

  test('return rolls at WORLD’s chances; WORLD names no pool at the Crown, the Roost, the Eyrie or the Perch, so they are `safe` (no wandering roll); only the Stair rolls the pool', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const back = (l: string, id: string) => [e(l, id).chance, e(l, id).respawn, e(l, id).once, e(l, id).groups.map((g) => `${g.creatureId}×${g.count}`)];
    expect(flat(WL[CR]?.block ?? '')).toContain('return: cr_glass_mote ×3 (35%). Heartstone destroyed');
    expect(back(CR, 'enc_crown_motes')).toEqual([0.35, 'on_return', false, [`${MOTE}×3`]]);
    expect(flat(WL[RS]?.block ?? '')).toContain('return: cr_cloud_ray ×2 (35%). **NPCs:**');
    expect(back(RS, 'enc_roost_cloud_rays')).toEqual([0.35, 'on_return', false, [`${RAY}×2`]]);
    expect(flat(WL[AE]?.block ?? '')).toContain('return: cr_spire_loom ×1 (25%). Heartstone destroyed');
    expect(back(AE, 'enc_eyrie_loom')).toEqual([0.25, 'on_return', false, [`${LOOM}×1`]]);
    expect(ALL.map((id) => loc(id).safe)).toEqual([false, true, true, true, true]);
    expect(loc(WW).encounters.filter((x) => x.respawn === 'on_return')).toEqual([]); // the Stair's return is the pool's alone
  });

  test('a destroyed Heartstone darkens the Crown and idles the Eyrie’s looms: their groups wait on it (`when`), and their particles go out (WORLD §2.11, §12.1)', () => {
    expect(WORLD).toContain('| `ws_heartstone_destroyed` | HD, MP, CR, AE, Steppe, Drowned, EF |');
    expect(WORLD).toContain('CR, AE none (dark; looms idle)');
    expect(S211).toContain('Heartstone destroyed: the Spire-Crown goes dark; Spire Looms inactive (free Aulde\'s notes).');
    const LIT: Condition = { not: { flag: 'flag_heartstone_destroyed' } };
    for (const id of [CR, AE]) {
      expect([id, loc(id).encounters.map((x) => x.when)]).toEqual([id, [LIT, LIT]]);
      expect([id, loc(id).art.variants]).toEqual([id, [{ when: { flag: 'flag_heartstone_destroyed' }, patch: { particles: 'none' } }]]);
    }
    for (const id of [WW, RS, PE]) expect([id, loc(id).art.variants]).toEqual([id, []]);
    expect(holds(LIT, CR)).toBe(true);
    expect(holds(LIT, CR, { flags: { flag_heartstone_destroyed: true } })).toBe(false);
  });

  test('DESIGN §10.5’s `echo_high_mark` ("Sky-Whisper Sentinels passive") at the Roost: the Sentinel stands aside and the Kite comes alone; either form settles both', () => {
    expect(DESIGN).toContain('| `echo_high_mark` | S: Sky-Whisper Sentinels passive; R: the Skyreach stair opens without the Talisman |');
    const both = byId(loc(RS).encounters, 'enc_roost_sentinel_kite');
    const alone = byId(loc(RS).encounters, 'enc_roost_kite');
    expect([both.when, alone.when]).toEqual([{ not: { echo: 'echo_high_mark' } }, { echo: 'echo_high_mark' }]);
    expect(alone.groups).toEqual([{ creatureId: KITE, count: 1 }]);
    const settle = [{ scatter: { location: RS } }];
    for (const x of [both, alone]) expect([x.id, x.onVictory, x.onFleeEffects, x.chance, x.respawn]).toEqual([x.id, settle, settle, 1, 'never']);
    for (const echoes of [[], ['echo_high_mark'], ['echo_spire_note']]) {
      const fires = [both, alone].map((x) => holds(x.when as Condition, RS, { loop: 2, echoes }));
      expect([echoes, fires]).toEqual([echoes, echoes.includes('echo_high_mark') ? [false, true] : [true, false]]);
    }
  });

  test('events: every WORLD event, its text verbatim, once, with WORLD’s grants', () => {
    for (const l of parsedLocations) {
      const got = Object.fromEntries(l.events.filter((e) => e.trigger === 'enter').map((e) => [e.id, e.text]));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.events]);
      for (const e of l.events) expect([e.id, e.once]).toEqual([e.id, true]);
    }
    const ev = (l: string, id: string) => byId(loc(l).events, id);
    const grant = (l: string, id: string) => [ev(l, id).when, ev(l, id).effects];
    expect(grant(WW, 'ev_stair_breath')).toEqual([undefined, [{ grantEcho: 'echo_high_mark' }]]);
    expect(WL[WW]?.block).toContain('— once; grants `echo_high_mark`.');
    expect(grant(CR, 'ev_crown_threads')).toEqual([undefined, [{ grantEcho: 'echo_spire_note' }]]);
    expect(WL[CR]?.block).toContain('— once; grants `echo_spire_note`.');
    expect(grant(RS, 'ev_roost_bones')).toEqual([undefined, []]);
    expect(grant(AE, 'ev_eyrie_weavers')).toEqual([undefined, [{ grantEcho: 'echo_spire_note' }]]);
    expect(WL[AE]?.block).toContain('— once; grants `echo_spire_note`.');
    expect(grant(PE, 'ev_perch_watch')).toEqual([undefined, [{ grantEcho: 'echo_tyrant_never_struck' }]]);
    expect(WL[PE]?.block).toContain('— once per loop; grants `echo_tyrant_never_struck`.');
    // the Echoes are STORY §12's
    for (const id of ['echo_high_mark', 'echo_spire_note', 'echo_tyrant_never_struck', 'echo_sky_oath']) expect([id, STORY.includes(`| \`${id}\``)]).toEqual([id, true]);
  });

  test('the ledge’s greataxe: two `interact` events with complementary `when`s — the Ironclad’s −10 without the oath, none with it — one axe a loop', () => {
    expect(WL[RS]?.block).toContain('item_hearth_iron_greataxe (on a sky-burial ledge; taking it costs Ironclad −10 unless `echo_sky_oath`)');
    const theft = byId(loc(RS).events, 'ev_roost_greataxe');
    const heir = byId(loc(RS).events, 'ev_roost_greataxe_oath');
    const TAKEN = { flag: 'flag_roost_greataxe_taken' };
    expect([theft.trigger, theft.label, theft.when, theft.effects]).toEqual([
      'interact', 'Take the greataxe from the ledge', { all: [{ not: { echo: 'echo_sky_oath' } }, { not: TAKEN }] },
      [{ giveItem: { item: AXE } }, { rep: { faction: 'ironclad', delta: -10 } }, { setFlag: 'flag_roost_greataxe_taken' }],
    ]);
    expect([heir.trigger, heir.label, heir.when, heir.effects]).toEqual([
      'interact', 'Take the greataxe from the ledge', { all: [{ echo: 'echo_sky_oath' }, { not: TAKEN }] },
      [{ giveItem: { item: AXE } }, { setFlag: 'flag_roost_greataxe_taken' }],
    ]);
    for (const o of [{}, { loop: 2, echoes: ['echo_sky_oath'] }, { flags: { flag_roost_greataxe_taken: true } }, { loop: 2, echoes: ['echo_sky_oath'], flags: { flag_roost_greataxe_taken: true } }] as At[]) {
      const fires = [theft, heir].map((x) => holds(x.when as Condition, RS, o));
      const taken = o.flags?.['flag_roost_greataxe_taken'] === true;
      const oath = (o.echoes ?? []).includes('echo_sky_oath');
      expect([o, fires]).toEqual([o, taken ? [false, false] : oath ? [false, true] : [true, false]]);
    }
    expect(WORLD).toContain('| `item_hearth_iron_greataxe` | Hearth-Iron Greataxe | T4 |');
    expect(WORLD).toContain('Taking it is a theft, or an inheritance.');
  });

  test('NPC placement: nobody lives here; the Eyrie’s "npc_dask (can remain)" is the engine’s rule for a `temporallyUnstable` place (D-059), not a placement', () => {
    for (const l of parsedLocations) expect([l.id, l.npcs]).toEqual([l.id, []]);
    expect(WL[AE]?.npcIds).toEqual(['npc_dask']);
    expect(WL[AE]?.block).toContain('**NPCs:** npc_dask (can remain).');
    expect(pack.npcs['npc_dask']?.homeLocationId).toBe('loc_shimmering_pass');
    expect(parsedLocations.every((l) => l.temporallyUnstable)).toBe(true);
  });

  test('art: WORLD’s horizon per block; the templates; the boss and the camp tags', () => {
    expect(parsedLocations.map((l) => [l.id, l.art.template, l.art.horizon])).toEqual([
      [WW, 'sky', 0.3], [CR, 'spires', 0.35], [RS, 'peaks', 0.4], [AE, 'archive', 0.55], [PE, 'peaks', 0.25],
    ]);
    expect(ALL.map((id) => WL[id]?.horizon)).toEqual([0.3, 0.35, 0.4, 0.55, 0.25]);
    expect(loc(PE).tags).toEqual(['boss', 'regional_boss']);
    expect(loc(AE).tags).toContain('camp');
  });
});

// ---- Map data (WORLD §11, §12.3) --------------------------------------------------------------------------------------------------

describe('WORLD §11 map data', () => {
  test('§11.1 nodes: coordinates, band, `temporallyUnstable`, merchant, settlement (the Eyrie’s rest is the camp above)', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable, n?.regionId]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable, REGION]);
      const rest = l.rest === undefined ? '—' : l.rest.kind;
      // AE: "inn" in the row, a camp here (C-31, the rest-point test)
      expect([l.id, rest === 'camp' && n?.rest === 'inn' ? 'inn' : rest, l.merchantId ?? '—']).toEqual([l.id, n?.rest, n?.merchant]);
      expect([l.id, l.tags.includes('settlement')]).toEqual([l.id, n?.settlement]);
    }
    expect(ALL.map((id) => NODES[id]?.abbr)).toEqual(['WW', 'CR', 'RS', 'AE', 'PE']);
  });

  test('§12.3: all five are among WORLD’s static `temporallyUnstable` places (D-059)', () => {
    const list = flat(section(WORLD, '### 12.3 `temporallyUnstable`', '---'));
    expect(list).toContain('loc_windward_stair, loc_spire_crown, loc_roost_of_sentinels, loc_auldes_eyrie, loc_stormcrowns_perch (Skyreach)');
  });

  test('§11.2 edges: every walk edge touching the region exists with its direction, cost and gate on both sides; the climbs cost 2 up, 1 down', () => {
    const walks = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(walks.map((e) => `${e.from}>${e.to}`)).toEqual([`${SPIRES}>${CR}`, `${PLATEAU}>${WW}`, `${WW}>${CR}`, `${WW}>${AE}`, `${CR}>${RS}`, `${RS}>${AE}`, `${RS}>${PE}`]);
    for (const e of walks) {
      const sideOf = (from: string) => (here.has(from) ? loc(from) : (pack.locations[from] as Location));
      const fwd = sideOf(e.from).exits.find((x) => x.to === e.to);
      expect([e.from, e.to, fwd?.dir, fwd?.travelWatches, fwd?.when !== undefined]).toEqual([e.from, e.to, e.dir, e.cost, e.gate !== 'open']);
      const back = sideOf(e.to).exits.find((x) => x.to === e.from);
      expect([e.to, e.from, back?.dir, back?.travelWatches, back?.when !== undefined]).toEqual([e.to, e.from, e.reverseDir, e.reverseCost, e.reverseGate !== 'open']);
    }
    expect(walks.filter((e) => e.cost === 2).map((e) => [e.from, e.to, e.gate, e.reverseCost, e.reverseGate])).toEqual([
      [SPIRES, CR, 'gate_thin_air', 1, 'open'],
      [PLATEAU, WW, 'gate_thin_air', 1, 'open'],
    ]);
    // no portal or road touches the Skyreach
    expect(EDGES.filter((e) => e.kind !== 'walk' && (here.has(e.from) || here.has(e.to)))).toEqual([]);
  });

  test('§11.3 `gate_thin_air`: the Highlands’ two climbs carry WORLD’s condition (U44’s exits; the way down is open)', () => {
    const gates = Object.fromEntries(tableRows(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).map((c) => [unquote(c[0] ?? ''), unquote(c[2] ?? '')]));
    expect(gates['gate_thin_air']).toBe('{any:[{item:"item_sky_whisper_talisman"},{echo:"echo_high_mark"}]}');
    for (const [from, to] of [[SPIRES, CR], [PLATEAU, WW]] as const) expect(pack.locations[from]?.exits.find((e) => e.to === to)?.when).toEqual(worldCondition(gates['gate_thin_air'] ?? ''));
    expect(S310).toContain('**Thin air\ngate:** both entrances require `{any:[{item:"item_sky_whisper_talisman"},{echo:"echo_high_mark"}]}`.');
  });

  /** Is a gate satisfiable in Loop 1 (quests, items, counters can be had)? `echoes` also opens the Echo and flag terms. */
  const satisfiable = (cond: Condition, echoes: boolean): boolean => {
    const [key, value] = Object.entries(cond as Record<string, unknown>)[0] ?? ['', undefined];
    if (key === 'any') return (value as Condition[]).some((c) => satisfiable(c, echoes));
    if (key === 'all') return (value as Condition[]).every((c) => satisfiable(c, echoes));
    if (key === 'not') return true;
    if (key === 'echo' || key === 'flag' || key === 'loop' || key === 'rep') return echoes;
    return true;
  };
  /** Watches from `from` to every landed location over the exits whose gates `open` allows (Dijkstra: the climbs cost 2). */
  const watches = (from: string, open: (cond: Condition) => boolean, within?: ReadonlySet<string>): Map<string, number> => {
    const dist = new Map<string, number>([[from, 0]]);
    const done = new Set<string>();
    for (;;) {
      const [at] = [...dist.entries()].filter(([id]) => !done.has(id)).sort((a, b) => a[1] - b[1])[0] ?? [];
      if (at === undefined) return dist;
      done.add(at);
      for (const exit of pack.locations[at]?.exits ?? []) {
        if (pack.locations[exit.to] === undefined || (within !== undefined && !within.has(exit.to))) continue;
        const gate = exit.kind === 'road' ? exit.gate : exit.when;
        if (gate !== undefined && !open(gate)) continue;
        const d = (dist.get(at) ?? 0) + exit.travelWatches;
        if (d < (dist.get(exit.to) ?? Infinity)) dist.set(exit.to, d);
      }
    }
  };

  test('reachability from loc_whispering_ruins (WORLD §3.13): nothing of the Skyreach with no gate satisfied; the Crown in 6 watches and the Stair in 7, counting the 2-watch ascents', () => {
    const none = watches(WR, () => false);
    expect(ALL.map((id) => none.has(id))).toEqual([false, false, false, false, false]);
    const loop1 = watches(WR, (c) => satisfiable(c, false));
    expect(ALL.map((id) => loop1.get(id))).toEqual([7, 6, 7, 8, 8]);
    const row = tableRows(section(WORLD, '### 3.13', '### Conventions for §4–6')).find((c) => c[0] === 'The Skyreach');
    expect(row?.[1]).toBe('… Plateau → Windward Stair (7) or … Spires → Spire-Crown (6), counting the 2-watch ascents');
    expect(row?.[2]).toBe('`item_sky_whisper_talisman` (lies on the Plateau) or `echo_high_mark`');
    // the Echo alone opens it too (Loop 2+): every Skyreach node is reachable with the Echo terms open
    const echoes = watches(WR, (c) => satisfiable(c, true));
    expect(ALL.every((id) => echoes.has(id))).toBe(true);
  });

  test('§10.3 row: 5 nodes; through-routes SW→WW→AE (3 watches) and AS→CR→RS→PE (4); sweep 5 watches; fights 4.6 / 1.1 over the sweep, 1.6 / 0.5 · 3.0 / 0.7 on the routes; the worst node 2 from the Eyrie', () => {
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'skyreach') ?? [];
    expect(row.slice(1, 3)).toEqual(['12–15', '5']);
    expect(row[3]).toBe('SW→WW→AE · AS→CR→RS→PE');
    expect(row[4]).toBe('3 · 4');
    const land = new Set<string>([...here, SPIRES, PLATEAU]);
    const anyGate = (c: Condition) => satisfiable(c, false);
    expect(watches(PLATEAU, anyGate, land).get(AE)).toBe(3);
    expect(watches(SPIRES, anyGate, land).get(PE)).toBe(4);
    // the sweep: the shortest walk from the Stair (the gateway) that visits every node (a breadth-first search over visited sets)
    const inside = new Map<string, string[]>(parsedLocations.map((l) => [l.id, l.exits.map((e) => e.to).filter((t) => here.has(t))]));
    const ordered = [...inside.keys()];
    const full = (1 << ordered.length) - 1;
    const start = ordered.indexOf(WW);
    let frontier = new Set<string>([`${start}:${1 << start}`]);
    const seenStates = new Set(frontier);
    let walk = 0;
    while (![...frontier].some((k) => Number(k.split(':')[1]) === full)) {
      const next = new Set<string>();
      for (const key of frontier) {
        const [at, mask] = key.split(':').map(Number) as [number, number];
        for (const to of inside.get(ordered[at] ?? '') ?? []) {
          const j = ordered.indexOf(to);
          const k = `${j}:${mask | (1 << j)}`;
          if (!seenStates.has(k)) {
            seenStates.add(k);
            next.add(k);
          }
        }
      }
      frontier = next;
      walk += 1;
    }
    expect([walk, row[6]]).toEqual([5, '5']);
    // expected fights (WORLD §10.0), Loop 1 with nothing held: a node's first-visit groups roll in order (1 − Π(1 − p)); a return
    // visit rolls its own groups, then the pool unless the node is safe. `when`s are read in a plain Loop 1 state
    const live = (l: Location, e: Location['encounters'][number]) => (e.when === undefined || holds(e.when, l.id)) && !(e.optionalWhen !== undefined && holds(e.optionalWhen, l.id));
    const chanceOf = (groups: readonly { chance: number }[]): number => 1 - groups.reduce((p, e) => p * (1 - e.chance), 1);
    const firstVisit = (ids: readonly string[]) => ids.map(loc).reduce((sum, l) => sum + chanceOf(l.encounters.filter((e) => e.respawn !== 'on_return' && live(l, e))), 0);
    const returning = (ids: readonly string[]) =>
      ids.map(loc).reduce((sum, l) => sum + (1 - (1 - chanceOf(l.encounters.filter((e) => e.respawn === 'on_return' && live(l, e)))) * (1 - (l.safe ? 0 : region.returnEncounterChance))), 0);
    // WORLD prints the two-decimal sum to one decimal as `toFixed` does (1.15 → 1.1, 0.45 → 0.5); the sums here carry float drift
    const one = (x: number): string => Number(x.toFixed(2)).toFixed(1);
    expect(row[7]).toBe('4.6 / 1.1');
    expect([one(firstVisit(ALL)), one(returning(ALL))]).toEqual(['4.6', '1.1']);
    expect(row[5]).toBe('1.6 / 0.5 · 3.0 / 0.7');
    expect([one(firstVisit([WW, AE])), one(returning([WW, AE]))]).toEqual(['1.6', '0.5']);
    expect([one(firstVisit([CR, RS, PE])), one(returning([CR, RS, PE]))]).toEqual(['3.0', '0.7']);
    // with the pool at every node the return count would be 1.6, not WORLD's 1.1: hence the `safe` reading
    expect(one(0.2 + 2 * (0.35 + 0.65 * 0.2) + (0.25 + 0.75 * 0.2))).toBe('1.6');
    // "to rest": the worst node's distance to the Eyrie, the region's only rest point
    const hops = (from: string): number => {
      const d = new Map<string, number>([[from, 0]]);
      const q = [from];
      for (let i = 0; i < q.length; i++) for (const t of inside.get(q[i] ?? '') ?? []) if (!d.has(t)) (d.set(t, (d.get(q[i] ?? '') ?? 0) + 1), q.push(t));
      return d.get(AE) ?? Infinity;
    };
    expect([Math.max(...ALL.map(hops)), row[8]]).toEqual([2, '2']);
  });

  test('§10.4 Horde order: from the Plateau at move 4, the Stair 5 → the Eyrie and the Crown 6 → the Roost 7 → the Perch 8 (the spread’s graph: walk edges, gates ignored, no portals)', () => {
    const row = tableRows(section(WORLD, '### 10.4 Elites', '### 10.5')).find((c) => c[0] === 'skyreach');
    expect(row?.[5]).toBe('from the Plateau at WW 5 → AE, CR 6 → RS 7 → PE 8');
    const outside = new Set(['region_silverwood_before', 'region_threshold']);
    const hops = new Map<string, number>([['loc_temporal_breach_apex', 0]]);
    const q = ['loc_temporal_breach_apex'];
    for (let i = 0; i < q.length; i++) {
      for (const e of pack.locations[q[i] ?? '']?.exits ?? []) {
        const to = pack.locations[e.to];
        if (to === undefined || outside.has(to.regionId) || e.kind === 'road' || hops.has(e.to)) continue;
        hops.set(e.to, (hops.get(q[i] ?? '') ?? 0) + 1);
        q.push(e.to);
      }
    }
    // the Tyrant-kill Horde keeps the legacy one-move delay: a node `h` hops from the Apex is infected at move h + 1
    const move = (id: string) => (hops.get(id) ?? NaN) + 1;
    expect([PLATEAU, SPIRES, ...ALL].map(move)).toEqual([4, 5, 5, 6, 7, 6, 8]);
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6.5', () => {
  const MINE = [LOOM, KITE, RAY, CROWN];

  test('exactly the creatures whose first region is the Skyreach (D-090), in WORLD’s order; the Weaver, the Mote and the Sentinel are the Highlands’ (U44)', () => {
    const first = Object.values(CREATURE_TABLE).filter((r) => /^Skyreach/.test(r.regions)).map((r) => r.id);
    expect([...first].sort()).toEqual([...MINE].sort());
    expect(creatures.map((c) => c.id)).toEqual(MINE);
    for (const id of [WEAVER, MOTE, SENTINEL]) {
      expect([id, CREATURE_TABLE[id]?.regions]).toEqual([id, 'Highlands, Skyreach']);
      expect([id, pack.creatures[id] !== undefined, creatures.some((c) => c.id === id)]).toEqual([id, true, false]);
    }
  });

  test('name, family, role, level and XP as WORLD’s table; XP follows DESIGN §6.2 (fodder round(20 + 8L + 1.2L²), elite ×1.8; the boss is hand-set 1,050 at band top + 2)', () => {
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, row?.name, c.family, c.role, c.level, c.xp]).toEqual([c.id, c.name, row?.family, row?.role, row?.level, row?.xp]);
    }
    const fodder = (L: number): number => Math.round(20 + 8 * L + 1.2 * L * L);
    for (const c of creatures) if (c.role !== 'boss') expect([c.id, c.xp]).toEqual([c.id, Math.round(fodder(c.level) * (c.role === 'elite' ? 1.8 : 1))]);
    expect([cr(CROWN).level, cr(CROWN).xp]).toEqual([region.levelBand.max + 2, 1050]);
    expect(cr(CROWN).xp).toBeGreaterThanOrEqual(400);
    expect(cr(CROWN).xp).toBeLessThanOrEqual(1200);
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK; the boss’s HP is 12 × (49.2 − 6 armor) = 518, rounded to 520 (D-067.20)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
    expect(cr(CROWN).stats).toEqual({ hp: 520, atk: 31, sp: 31, armor: 6, ward: 8, agi: 11 });
    expect(Math.round((12 * (49.2 - 6)) / 10) * 10).toBe(520);
    expect(WORLD).toMatch(/HP 520 \(~~640~~; 12 × \(49\.2 . 6 armor\) = 518, D-067\.20\)/);
    expect(WORLD).toContain('Skyreach (top 15, ATK 41) 49.2');
  });

  test('resistances and immunities as WORLD’s Resist line; every construct carries Poison and Bleed (D-094); the boss is Stagger-able and cannot be fled', () => {
    const kind = (c: Creature, which: string): string[] => Object.entries(c.resistances).filter(([, r]) => r === which).map(([t]) => t).sort();
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      const immune = new Set(w.immune.map((s) => `status_${s}`));
      if (c.tags.includes('construct')) for (const s of ['status_poison', 'status_bleed']) immune.add(s);
      expect([c.id, kind(c, 'weak'), kind(c, 'resist'), kind(c, 'immune'), [...c.statusImmunities].sort()]).toEqual([c.id, [...w.weak].sort(), [...w.resist].sort(), [], [...immune].sort()]);
      expect([c.id, c.tags.includes('construct')]).toEqual([c.id, true]); // "tag construct" (WORLD §5, Spireborn)
    }
    expect(parsedCreatures.map((c) => [c.id, c.tags])).toEqual([[LOOM, ['construct']], [KITE, ['construct', 'skyborn']], [RAY, ['construct', 'skyborn']], [CROWN, ['regional_boss', 'construct', 'skyborn']]]);
    expect(bullet(block(CROWN), 'Resist:')).toBe('weak chrono · resist storm, ley · status immune: shock, blind, poison; Stagger allowed');
    expect([cr(CROWN).interruptible, cr(CROWN).fleeable]).toEqual([true, false]);
    expect(block(CROWN)).toContain('cannot be fled');
    expect(bullet(block(LOOM), 'Resist:')).toBe('weak void · resist ley, storm · immune poison, bleed, stun');
  });

  test('moves: exactly WORLD’s intent ids with their telegraph lines verbatim; every move reached by a pattern; telegraphs ≤ 12 words; who each move is aimed at', () => {
    for (const c of parsedCreatures) {
      const intents = worldCreature(c.id).intents;
      expect([c.id, Object.keys(c.moves).sort()]).toEqual([c.id, Object.keys(intents).sort()]);
      for (const [id, line] of Object.entries(intents)) expect([c.id, id, c.moves[id]?.line]).toEqual([c.id, id, line]);
      const used = new Set<string>();
      const visit = (s: Step) => void ('move' in s && used.add(s.move));
      walkSteps(c.pattern, [], visit);
      for (const ph of c.phases) walkSteps(ph.pattern, [], visit);
      expect([c.id, Object.keys(c.moves).filter((id) => !used.has(id))]).toEqual([c.id, []]);
      for (const m of Object.values(c.moves)) expect([c.id, m.line, words(m.line) <= 12]).toEqual([c.id, m.line, true]);
    }
    const aims = (id: string): Record<string, string[]> => {
      const c = cr(id);
      const out: Record<string, Set<string>> = {};
      const visit = (s: Step) => void ('move' in s && (out[s.move] ??= new Set()).add(s.target));
      walkSteps(c.pattern, [], visit);
      for (const ph of c.phases) walkSteps(ph.pattern, [], visit);
      return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
    };
    expect(aims(LOOM)).toEqual({ loom_weave: ['self'], loom_rethread: ['self'], loom_shuttle: ['player'], loom_warp: ['all'] });
    expect(aims(KITE)).toEqual({ kite_tether: ['player'], kite_swoop: ['player'], kite_updraft: ['player'], kite_slice: ['player'] });
    expect(aims(RAY)).toEqual({ ray_mist_over: ['all'], ray_discharge: ['player'], ray_wingbeat: ['all'] });
    expect(aims(CROWN)).toEqual({ crown_regard: ['player'], crown_gale: ['all'], crown_talon: ['player'], crown_rain: ['all'], crown_call_lightning: ['player'], crown_call_kite: ['self'], crown_seven: ['player'] });
    expect(cr(CROWN).moves['crown_call_lightning']?.hidden).toBe(true);
    expect(Object.entries(cr(CROWN).moves).filter(([, m]) => m.hidden).map(([id]) => id)).toEqual(['crown_call_lightning']);
  });

  test('moves carry WORLD’s numbers: the multiplier and stat, type, statuses and their chances, hits, summons, shield', () => {
    const m = (c: string, id: string) => cr(c).moves[id];
    const hit = (c: string, id: string) => [m(c, id)?.type, m(c, id)?.power?.coef, m(c, id)?.power?.stat, m(c, id)?.power?.hits];
    const rows = (c: string, id: string) => m(c, id)?.statuses.map((s) => [s.status.slice('status_'.length), s.chance, s.duration, s.target]);
    expect(m(LOOM, 'loom_weave')?.summon).toEqual({ creatureId: WEAVER, count: 1, max: 2, hpPct: 1 });
    expect(m(LOOM, 'loom_weave')?.power).toBeUndefined();
    expect(hit(LOOM, 'loom_shuttle')).toEqual(['physical', 1.3, 'atk', 1]);
    expect(rows(LOOM, 'loom_shuttle')).toEqual([['stun', 0.2, 1, 'target']]);
    expect(hit(LOOM, 'loom_warp')).toEqual(['ley', 0.8, 'sp', 1]);
    expect(rows(LOOM, 'loom_warp')).toEqual([['slow', 0.5, 2, 'target']]);
    expect(m(LOOM, 'loom_rethread')?.shield?.power).toEqual({ base: 0, coef: 1.5, stat: 'atk', hits: 1 });
    expect(hit(KITE, 'kite_tether')).toEqual(['storm', 0.8, 'sp', 1]);
    expect(rows(KITE, 'kite_tether')).toEqual([['mark', 1, 2, 'target']]);
    expect(hit(KITE, 'kite_slice')).toEqual(['physical', 1.1, 'atk', 1]);
    expect(rows(KITE, 'kite_slice')).toEqual([['bleed', 0.4, 3, 'target']]);
    expect(hit(KITE, 'kite_swoop')).toEqual(['physical', 1.2, 'atk', 1]); // 1.2× (WORLD struck the old 1.4×)
    expect(bullet(block(KITE), 'Intents:')).toContain('1.2× you (~~1.4×~~, REVIEW-STORY-WORLD #19) · ifTargetHas:mark');
    expect(hit(KITE, 'kite_updraft')).toEqual(['storm', 0.6, 'sp', 1]);
    expect(rows(KITE, 'kite_updraft')).toEqual([['slow', 0.5, 2, 'target']]);
    expect([m(RAY, 'ray_mist_over')?.power, rows(RAY, 'ray_mist_over')]).toEqual([undefined, [['soaked', 1, 3, 'target']]]);
    expect(hit(RAY, 'ray_discharge')).toEqual(['storm', 1.1, 'sp', 1]);
    expect(rows(RAY, 'ray_discharge')).toEqual([['shock', 0.4, 2, 'target']]);
    expect(hit(RAY, 'ray_wingbeat')).toEqual(['physical', 0.8, 'atk', 1]);
    expect(rows(RAY, 'ray_wingbeat')).toEqual([['slow', 0.3, 2, 'target']]);
    expect([m(CROWN, 'crown_regard')?.power, rows(CROWN, 'crown_regard')]).toEqual([undefined, [['mark', 1, 3, 'target']]]);
    expect(hit(CROWN, 'crown_gale')).toEqual(['storm', 0.9, 'sp', 1]);
    expect(hit(CROWN, 'crown_talon')).toEqual(['physical', 1.3, 'atk', 1]);
    expect(rows(CROWN, 'crown_talon')).toEqual([['bleed', 0.5, 3, 'target'], ['haste', 1, 2, 'self']]);
    expect(m(CROWN, 'crown_talon')?.statuses[1]?.when).toEqual({ hpBelow: 0.3 }); // "Haste self every turn" in Phase 3 only
    expect([m(CROWN, 'crown_rain')?.power, rows(CROWN, 'crown_rain')]).toEqual([undefined, [['soaked', 1, 3, 'target']]]);
    expect(hit(CROWN, 'crown_call_lightning')).toEqual(['storm', 2, 'sp', 1]);
    expect(rows(CROWN, 'crown_call_lightning')).toEqual([['shock', 1, 2, 'target']]);
    expect(m(CROWN, 'crown_call_kite')?.summon).toEqual({ creatureId: KITE, count: 1, max: 1, hpPct: 1 }); // "(max 1 alive)"
    expect(hit(CROWN, 'crown_seven')).toEqual(['storm', 0.3, 'sp', 7]); // "7 hits × 0.3× you"
    expect(rows(CROWN, 'crown_seven')).toEqual([['haste', 1, 2, 'self']]);
    expect(m(CROWN, 'crown_seven')?.statuses[0]?.when).toBeUndefined();
  });

  test('loot: gold ranges and every item WORLD lists, with WORLD’s chances and counts (100 % = guaranteed)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      const expected = [...bullet(block(c.id), 'Loot:').matchAll(/`((?:item|mat)_[a-z0-9_]+)`†?(?: ×(\d+))? (\d+)%/g)].map((x) => [x[1], Number(x[2] ?? 1), Number(x[3]) / 100]);
      expect([c.id, c.loot.map((l) => [l.itemId, l.count, l.chance])]).toEqual([c.id, expected]);
      for (const l of c.loot) expect([c.id, l.when]).toEqual([c.id, undefined]);
    }
    expect(bullet(block(CROWN), 'Loot:')).toBe('175–270 g · `item_stormcrown_talon` 100% · `mat_gale_feather` 100% · `mat_storm_glass`† ×3 100% · `mat_skyreach_crystal` ×2 100%');
    expect(parsedCreatures.map((c) => [c.gold.min, c.gold.max])).toEqual([[62, 96], [27, 42], [29, 45], [175, 270]]);
  });

  test('bestiary voice, entry and tactics are WORLD’s text verbatim (the Loom’s "(WORLD §3.10)" dropped); the Spireborn codex entry; reveals at 1 and 3 kills; short non-legacy descriptions', () => {
    for (const c of parsedCreatures) {
      const b = block(c.id);
      expect([c.id, c.bestiary.voice]).toEqual([c.id, worldCreature(c.id).voice]);
      expect([c.id, c.bestiary.summary]).toEqual([c.id, playText(bullet(b, 'Bestiary'))]);
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, playText(bullet(b, 'Tactics:'))]);
      expect([c.id, c.bestiary.codexId, c.family]).toEqual([c.id, 'codex_creatures_spireborn', 'fam_spireborn']);
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
      expect([c.id, c.legacyName, /- \*\*Legacy description:\*\*/.test(b)]).toEqual([c.id, undefined, false]);
      expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
    }
    expect(bullet(block(LOOM), 'Tactics:')).toBe('Ignore the Weavers it makes; Void the loom. Heartstone destroyed: no fight (WORLD §3.10).');
    expect(cr(LOOM).bestiary.tactics).toBe('Ignore the Weavers it makes; Void the loom. Heartstone destroyed: no fight.');
    expect(STORY).toContain('| `codex_creatures_spireborn` |');
    expect(parsedCreatures.map((c) => c.materialKin)).toEqual(['aetherial', 'sentinel', 'sentinel', 'sentinel']);
  });
});

// ---- Patterns, walked by the engine ------------------------------------------------------------------------------------------

/** A fight against `id` (its group behind it): the engine's combat state, scripted draws, the foe first. */
function fightAgainst(id: string, o: { allies?: readonly { creatureId: string; count: number }[]; draws?: number } = {}) {
  const profile = freshProfile();
  const s = makeState({ level: 14 }, { content: epack, profile });
  // one initiative draw for the player, one for each enemy, then middling draws for whatever a move rolls
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1), ...Array.from({ length: 8 }, (_, i) => D.d4((i % 4) + 1)), ...Array.from({ length: o.draws ?? 0 }, () => 0.5)], epack, profile);
  const groups = [{ creatureId: id, count: 1 }, ...(o.allies ?? [])];
  const combat = beginCombat(ctx, { id: 'enc_test', groups, fleeable: false, onFlee: 'hold', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] } satisfies EncounterSpec);
  return { ctx, combat, foe: combat.enemies[0] as Combatant };
}

/** WORLD's cadence words, turn by turn: the moves `id` commits to (by `generateIntent`), its phase, HP, statuses and allies set per turn. */
function plan(
  id: string,
  turns: number,
  o: {
    phase?: number;
    from?: number;
    allies?: readonly { creatureId: string; count: number }[];
    before?: (turn: number, foe: Combatant, combat: CombatState) => void;
  } = {},
): string[] {
  const { ctx, combat, foe } = fightAgainst(id, o.allies === undefined ? {} : { allies: o.allies });
  if (o.phase !== undefined) Object.assign(foe, { phase: o.phase });
  foe.pattern.pointer = 0;
  foe.pattern.turnsTaken = (o.from ?? 1) - 1;
  const out: string[] = [];
  for (let turn = o.from ?? 1; turn < (o.from ?? 1) + turns; turn++) {
    combat.round = turn;
    o.before?.(turn, foe, ctx.s.combat as CombatState);
    const intent = generateIntent(ctx, combat, foe);
    out.push(intent?.moveId.replace(/^[a-z]+_/, '') ?? '—');
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
/** The Stormcrown's own kite (its Phase 1 add) falls: no ally stands. */
const kitesDown = (combat: CombatState): void => {
  for (const e of combat.enemies.slice(1)) e.alive = false;
};

describe('patterns: WORLD’s cadence words hold turn by turn (first-match on every turn; two cycled moves alternate)', () => {
  test('the Spire Loom: Weave on every third turn, Shuttle and Warp between, Rethread below half HP while no Shield stands', () => {
    expect(plan(LOOM, 9)).toEqual(seq('shuttle warp weave warp shuttle weave shuttle warp weave'));
    const hurt = (t: number, f: Combatant): void => {
      hpAt(t >= 4 ? 0.4 : 1)(f);
      withStatus(f, 'status_shield', t === 5 || t === 7);
    };
    // the Weave is ahead of the Rethread (turn 6); the Rethread waits while the Shield stands (turns 5, 7)
    expect(plan(LOOM, 8, { before: hurt })).toEqual(seq('shuttle warp weave rethread shuttle weave shuttle rethread'));
  });

  test('the Gale Kite: Tether first, Swoop while you are Marked, Updraft on every third turn, else Slice', () => {
    expect(plan(KITE, 7)).toEqual(seq('tether slice updraft slice slice updraft slice'));
    const marked = (t: number, _f: Combatant, c: CombatState): void => withStatus(player(c), 'status_mark', t === 2 || t === 3 || t === 5);
    // the Swoop is ahead of the Updraft (turn 3): clear the Mark and they swoop at nothing
    expect(plan(KITE, 7, { before: marked })).toEqual(seq('tether swoop swoop slice swoop updraft slice'));
  });

  test('the Cloud Ray: the fixed pattern, Mist, Discharge, Wingbeat', () => {
    expect(plan(RAY, 7)).toEqual(seq('mist_over discharge wingbeat mist_over discharge wingbeat mist_over'));
  });

  test('the Stormcrown, Phase 1 — The Watch: Regard first, then Talon and Gale in turn', () => {
    expect(plan(CROWN, 7, { phase: 0 })).toEqual(seq('regard talon gale talon gale talon gale'));
  });

  test('the Stormcrown, Phase 2 — The Storm Comes Down: Rain on every third turn and the hidden Lightning the turn after, Gale between; Call Kite only when no kite stands', () => {
    // a kite still flies (the fight's opening adds are the reducer's, so the group carries it here): the Gale fills the turns between
    const kite = [{ creatureId: KITE, count: 1 }];
    expect(plan(CROWN, 9, { phase: 1, allies: kite })).toEqual(seq('gale gale rain call_lightning gale rain call_lightning gale rain'));
    // the kite is down: Call Kite takes the Gale's turns, never the Rain's or the Lightning's
    expect(plan(CROWN, 9, { phase: 1, allies: kite, before: (_t, _f, c) => kitesDown(c) })).toEqual(seq('call_kite call_kite rain call_lightning call_kite rain call_lightning call_kite rain'));
    expect(plan(CROWN, 4, { phase: 1 })).toEqual(seq('call_kite call_kite rain call_lightning'));
    // entered on a turn after a multiple of three, no Lightning comes without its Rain
    expect(plan(CROWN, 5, { phase: 1, from: 4, allies: kite })).toEqual(seq('gale gale rain call_lightning gale'));
  });

  test('the Stormcrown, Phase 3 — Seven Struck: Seven on every second turn, the Talon between', () => {
    expect(plan(CROWN, 6, { phase: 2 })).toEqual(seq('talon seven talon seven talon seven'));
  });

  test('the Stormcrown’s phases: ids, names, triggers (70 %, 30 %), WORLD’s transition lines; a kite comes with Phase 1; no damage multiplier', () => {
    const w = cr(CROWN);
    expect(w.phases.map((p) => [p.id, p.name, p.enterWhen])).toEqual([
      ['crown_the_watch', 'The Watch', []],
      ['crown_the_storm_comes_down', 'The Storm Comes Down', [{ hpBelow: 0.7 }]],
      ['crown_seven_struck', 'Seven Struck', [{ hpBelow: 0.3 }]],
    ]);
    const W = flat(block(CROWN));
    expect(W).toContain('**Phase 1 — The Watch** (100–70%; onEnter: 1× `cr_gale_kite`)');
    expect(W).toContain('**Phase 2 — The Storm Comes Down** (<70%)');
    expect(W).toContain('**Phase 3 — Seven Struck** (<30%; Haste self every turn)');
    expect(W).toContain(`*Transition (<70%):* "${w.phases[1]?.line}"`);
    expect(W).toContain(`*Transition (<30%):* "${w.phases[2]?.line}"`);
    expect(w.phases[0]?.line).toBeUndefined(); // WORLD gives Phase 1's kite no line
    expect(w.phases[0]?.adds).toMatchObject([{ creatureId: KITE, count: 1 }]);
    expect(w.phases.slice(1).map((p) => p.adds)).toEqual([[], []]);
    expect(w.phases.map((p) => p.damageTakenMult)).toEqual([1, 1, 1]);
  });

  test('Phase 3’s Haste, executed: the Talon and Seven put Haste on the Stormcrown in Phase 3; the Talon of Phase 1 does not', () => {
    const hasted = (phase: number, hp: number, turnsTaken: number, expected: string): boolean => {
      const { ctx, combat, foe } = fightAgainst(CROWN, { draws: 80 });
      Object.assign(foe, { phase });
      foe.hp = Math.floor(foe.hpMax * hp);
      foe.pattern.pointer = 0;
      foe.pattern.turnsTaken = turnsTaken;
      const intent = generateIntent(ctx, combat, foe);
      expect(intent?.moveId).toBe(expected);
      executeIntent(ctx, combat, foe, applyHit);
      return hasStatus(foe, 'status_haste');
    };
    expect(hasted(2, 0.25, 0, 'crown_talon')).toBe(true);
    expect(hasted(2, 0.25, 1, 'crown_seven')).toBe(true);
    expect(hasted(0, 1, 1, 'crown_talon')).toBe(false);
  });
});

// ---- The NPCs ---------------------------------------------------------------------------------------------------------------

describe('the NPCs vs WORLD §4', () => {
  test('nobody’s home is in the Skyreach: the folder’s NPC table is empty (Dask is the Pass’s, Aulde the Before’s)', () => {
    const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
    const homes = tableRows(S4).filter((c) => unquote(c[0] ?? '').startsWith('npc_') && ALL.some((id) => (c[3] ?? '').replace(/\*\*stall: /, '').startsWith(id)));
    expect(homes).toEqual([]);
    expect(npcs).toEqual([]);
    expect(pack.npcs['npc_seraphine_aulde']?.homeLocationId).toBe('loc_outer_walks');
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder after the Steppe and before the Threshold; the region tables are in `contentTables` and the index', () => {
    const folders = REGION_FOLDERS.map((f) => f.region.id);
    expect(folders).toContain(REGION);
    expect(folders.indexOf('region_ashen_steppe')).toBeLessThan(folders.indexOf(REGION));
    expect(folders.indexOf(REGION)).toBeLessThan(folders.indexOf('region_threshold'));
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('The Skyreach');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.name).toBe(c.name);
    expect(items).toEqual([]); // the items tables are U49/U50's; this region owns none
  });

  test('validates with 0 errors; the region’s real warnings are rule 11’s six placements of the Highlands’ Spireborn under the band (WORLD’s); pending references name only tables still being authored', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const about = report.warnings.filter((w) => mine.has(w.id) || [...here, REGION].some((id) => w.message.includes(` ${id}`)));
    const real = about.filter((w) => !w.message.startsWith('pending — content not yet authored'));
    // WORLD §3.10 puts the L8 Weaver and Mote at the Crown (band 13) and the Eyrie (14), the L9 Sentinel at the Roost (13–14) and
    // in the pool (12–15): more than 2 under the band. The records and placements are WORLD's, so the warnings stay
    expect(real.map((w) => `${w.rule} ${w.id} ${/band of ([a-z_]+)/.exec(w.message)?.[1]}`).sort()).toEqual([
      `rule-11 ${WEAVER} ${AE}`, `rule-11 ${WEAVER} ${CR}`, `rule-11 ${MOTE} ${CR}`, `rule-11 ${MOTE} ${CR}`, `rule-11 ${SENTINEL} ${REGION}`, `rule-11 ${SENTINEL} ${RS}`,
    ].sort());
    for (const w of about.filter((x) => x.message.startsWith('pending — content not yet authored (reference): '))) {
      const table = /not found in ([a-z]+)$/.exec(w.message)?.[1];
      expect([w.message, INCOMPLETE_TABLES.includes(table as (typeof INCOMPLETE_TABLES)[number])]).toEqual([w.message, true]);
    }
    // the regional boss sits at band top + 2 (no rule-11 boss warning), and the coined flag is both set and read (no rule 2)
    expect(report.warnings.filter((w) => !w.message.startsWith('pending — content not yet authored') && (w.id === CROWN || w.message.includes('flag_roost_greataxe_taken')))).toEqual([]);
  });

  test('`npm run validate`: exit 0, 0 errors', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/ regions \d+ · locations \d+ · creatures \d+ · /);
    expect(text).toMatch(/validate: ok — 0 errors, \d+ warning\(s\), \d+ pending completeness check\(s\), \d+ pending reference\(s\)/);
  });

  test('this region’s pending references name only ids WORLD/STORY/DESIGN spell (items, Echoes, the faction record, codex entries); the Highlands’ climbs, its Spireborn and the Plateau now resolve', () => {
    const { report } = parseContentPack(contentTables);
    const targets = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    // later units resolve these one by one (items U49/U50, Echoes, codex): the list may only shrink
    const known = new Set([
      'mat_gale_feather', 'mat_skyreach_crystal', 'mat_spire_thread', 'mat_storm_glass',
      'item_aetherium_shard', 'item_aetherium_prism', 'item_hearth_iron_greataxe', 'item_auldes_spire_notes', 'item_breach_anchor_schematic_a', STAFF, 'item_stormcrown_talon', TALISMAN,
      'echo_high_mark', 'echo_spire_note', 'echo_sky_oath', 'echo_tyrant_never_struck',
      'ironclad', // the faction record (the ledge's rep effect)
      'codex_region_skyreach', 'codex_creatures_spireborn',
    ]);
    expect([...targets].filter((t) => !known.has(t)).sort()).toEqual([]);
    for (const t of [SPIRES, PLATEAU, WEAVER, MOTE, SENTINEL]) expect([t, targets.has(t)]).toEqual([t, false]);
    const docs = `${WORLD}\n${STORY}\n${DESIGN}`;
    for (const id of targets) expect([id, docs.includes(id)]).toEqual([id, true]);
    // and the Highlands' two climbs no longer point at nothing
    const highlands = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && (w.id === SPIRES || w.id === PLATEAU)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1]));
    expect([highlands.has(CR), highlands.has(WW)]).toEqual([false, false]);
  });
});

// ---- The engine on the real pack ------------------------------------------------------------------------------------------------

describe('the region in the engine (real pack, seeded; four item stand-ins)', () => {
  test('the climbs (gate_thin_air): shut with neither the Talisman nor `echo_high_mark`; with either, two watches up; one watch down', () => {
    expect(movesFrom(SPIRES)).not.toContain(CR);
    expect(movesFrom(PLATEAU)).not.toContain(WW);
    expect(movesFrom(SPIRES, { items: [TALISMAN] })).toContain(CR);
    expect(movesFrom(PLATEAU, { loop: 2, echoes: ['echo_high_mark'] })).toContain(WW);
    for (const [low, high] of [[SPIRES, CR], [PLATEAU, WW]] as const) {
      const up = arrive(low, high, { items: [TALISMAN], visited: [high] });
      expect([high, up.world.currentLocationId, up.clock.ticks - stateAt(low).clock.ticks]).toEqual([high, high, 2]);
      const down = arrive(high, low, { visited: [low] });
      expect([low, down.world.currentLocationId, down.clock.ticks - stateAt(high).clock.ticks]).toEqual([low, low, 1]);
    }
    expect(movesFrom(WW)).toEqual([PLATEAU, CR, AE].sort());
    expect(movesFrom(PE)).toEqual([RS]); // a dead end
  });

  test('the Stair: Gale Kites in a pair on about 60 % of first visits; on a return only the pool (about 20 %): kites, rays and the odd Sentinel', () => {
    const N = 300;
    const first = tally(N, (i) => arrive(PLATEAU, WW, { seed: `u48a-ww-${i}`, items: [TALISMAN] }));
    expect([...first.keys()].sort()).toEqual(['enc_windward_kites', '—'].sort());
    expect(rate(first, 'enc_windward_kites', N)).toBeGreaterThan(0.5);
    expect(rate(first, 'enc_windward_kites', N)).toBeLessThan(0.7);
    for (let i = 0; i < 30; i++) {
      const s = arrive(PLATEAU, WW, { seed: `u48a-pair-${i}`, items: [TALISMAN] });
      if (s.mode === 'combat') expect(enemiesOf(s)).toEqual([KITE, KITE]);
    }
    const back = tally(N, (i) => arriveAgain(CR, WW, i));
    expect([...back.keys()].filter((k) => k !== '—')).toEqual(['wandering']);
    expect(rate(back, 'wandering', N)).toBeGreaterThan(0.12);
    expect(rate(back, 'wandering', N)).toBeLessThan(0.28);
    const kinds = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const s = arriveAgain(CR, WW, i);
      if (s.mode === 'combat') for (const id of enemiesOf(s)) kinds.add(id);
    }
    expect([...kinds].every((k) => [KITE, RAY, SENTINEL].includes(k))).toBe(true);
    expect(kinds.has(KITE) && kinds.has(RAY)).toBe(true);
  });

  test('the Crown: always two Weavers and a Mote on the first visit, Motes ×3 about 35 % of returns and never the pool; nothing at all with the Heartstone destroyed', () => {
    const s = arrive(SPIRES, CR, { items: [TALISMAN] });
    expect([s.combat?.encounterId, enemiesOf(s), s.combat?.canFlee]).toEqual(['enc_crown_weavers', [WEAVER, WEAVER, MOTE], true]);
    expect(arrive(SPIRES, CR, { items: [TALISMAN], flags: { flag_heartstone_destroyed: true } }).mode).toBe('explore');
    const N = 300;
    const back = tally(N, (i) => arriveAgain(WW, CR, i));
    expect([...back.keys()].sort()).toEqual(['enc_crown_motes', '—'].sort());
    expect(rate(back, 'enc_crown_motes', N)).toBeGreaterThan(0.27);
    expect(rate(back, 'enc_crown_motes', N)).toBeLessThan(0.43);
    expect([...tally(100, (i) => arriveAgain(WW, CR, i, { flags: { flag_heartstone_destroyed: true } })).keys()]).toEqual(['—']);
  });

  test('the Roost: a Sentinel and a Kite; with `echo_high_mark` the Kite alone; winning either settles both; Cloud Rays ×2 about 35 % of returns, never the pool', () => {
    const s = arrive(CR, RS);
    expect([s.combat?.encounterId, enemiesOf(s)]).toEqual(['enc_roost_sentinel_kite', [SENTINEL, KITE]]);
    const passive = arrive(CR, RS, { loop: 2, echoes: ['echo_high_mark'] });
    expect([passive.combat?.encounterId, enemiesOf(passive)]).toEqual(['enc_roost_kite', [KITE]]);
    // the victory effect (`scatter` the Roost) leaves no second form behind: won without the Echo, then back with it
    const won = stateAt(CR, { loop: 2, echoes: ['echo_high_mark'] });
    won.world.locationStates[RS] = { ...seeded(RS, false), encountersCleared: ['enc_roost_sentinel_kite'] };
    const ctx = scriptedCtx(won, [], epack, profileOf({ loop: 2 }));
    apply({ scatter: { location: RS } }, ctx, { source: 'test' });
    expect(ctx.s.world.locationStates[RS]?.scattered).toEqual(['enc_roost_kite']);
    expect(step(ctx.s, { type: 'move', to: RS }, epack, profileOf({ loop: 2 })).state.mode).toBe('explore');
    const N = 300;
    const back = tally(N, (i) => arriveAgain(CR, RS, i));
    expect([...back.keys()].sort()).toEqual(['enc_roost_cloud_rays', '—'].sort());
    expect(rate(back, 'enc_roost_cloud_rays', N)).toBeGreaterThan(0.27);
    expect(rate(back, 'enc_roost_cloud_rays', N)).toBeLessThan(0.43);
  });

  test('the ledge’s greataxe: offered once a loop; without the oath it costs the Ironclad 10, with it nothing', () => {
    const offered = (s: GameState, o: At) => legalActions(s, epack, profileOf(o)).filter((a) => a.type === 'interact').map((a) => (a as { eventId: string }).eventId);
    const take = (o: At) => {
      const s = stateAt(RS, { ...o, visited: [RS] });
      const ids = offered(s, o);
      const out = step(s, { type: 'interact', eventId: ids[0] ?? '' } satisfies Action, epack, profileOf(o));
      return { ids, s: out.state };
    };
    const theft = take({ ironclad: 0 });
    expect(theft.ids).toEqual(['ev_roost_greataxe']);
    expect([theft.s.player.inventory.some((i) => i.itemId === AXE), theft.s.reputation.ironclad, theft.s.flags['flag_roost_greataxe_taken']]).toEqual([true, -10, true]);
    expect(offered(theft.s, {})).toEqual([]);
    const heir = take({ loop: 2, echoes: ['echo_sky_oath'], ironclad: 0 });
    expect(heir.ids).toEqual(['ev_roost_greataxe_oath']);
    expect([heir.s.player.inventory.some((i) => i.itemId === AXE), heir.s.reputation.ironclad]).toEqual([true, 0]);
    expect(offered(heir.s, { loop: 2 })).toEqual([]);
  });

  test('the Eyrie: the Spire Loom and a Weaver on the first visit, the Loom about 25 % of returns, never the pool; idle with the Heartstone destroyed; a free camp', () => {
    const s = arrive(WW, AE);
    expect([s.combat?.encounterId, enemiesOf(s), s.combat?.canFlee]).toEqual(['enc_eyrie_loom_weaver', [LOOM, WEAVER], true]);
    expect(arrive(WW, AE, { flags: { flag_heartstone_destroyed: true } }).mode).toBe('explore');
    const N = 300;
    const back = tally(N, (i) => arriveAgain(WW, AE, i));
    expect([...back.keys()].sort()).toEqual(['enc_eyrie_loom', '—'].sort());
    expect(rate(back, 'enc_eyrie_loom', N)).toBeGreaterThan(0.18);
    expect(rate(back, 'enc_eyrie_loom', N)).toBeLessThan(0.32);
    const rest = stateAt(AE, { visited: [AE] });
    expect(legalActions(rest, epack, profileOf()).some((a) => a.type === 'rest' && a.kind === 'full')).toBe(true);
    const rested = step(rest, { type: 'rest', kind: 'full' }, epack, profileOf()).state;
    expect(rested.player.gold).toBe(rest.player.gold);
  });

  test('Aulde’s case: examining the Eyrie with the Prism in the pack finds the Spire-Builder’s Staff; without it the case stays shut', () => {
    const look = (o: At) => {
      const s = step(stateAt(AE, { ...o, visited: [AE] }), { type: 'examine', target: { kind: 'location' } }, epack, profileOf(o)).state;
      return (s.world.locationStates[AE]?.items ?? []).map((i) => i.itemId);
    };
    expect(look({ loop: 2, items: [PRISM] })).toEqual([STAFF]);
    expect(look({ loop: 2 })).toEqual([]);
  });

  test('the Perch: the Stormcrown and its kite, held, without the bargain; from Loop 2 the oath and the Talisman skip the fight', () => {
    const fight = arrive(RS, PE);
    expect(fight.combat).toMatchObject({ encounterId: 'enc_perch_stormcrown', canFlee: false, onFlee: 'hold' });
    expect(fight.combat?.enemies.map((e) => [e.refId, e.phase])).toEqual([[CROWN, 0], [KITE, 0]]);
    const bargain = { loop: 2, echoes: ['echo_sky_oath'], items: [TALISMAN] };
    const yielded = arrive(RS, PE, bargain);
    expect([yielded.mode, yielded.world.currentLocationId]).toEqual(['explore', PE]);
    // half a bargain is no bargain; and in Loop 1 even the oath and the Talisman together meet the fight (see the header)
    for (const o of [{ loop: 2, echoes: ['echo_sky_oath'] }, { loop: 2, items: [TALISMAN] }, { loop: 1, echoes: ['echo_sky_oath'], items: [TALISMAN] }] as At[]) {
      expect([o, arrive(RS, PE, o).combat?.encounterId]).toEqual([o, 'enc_perch_stormcrown']);
    }
    expect(S211).toContain('Loop 2+: Stormcrown can be bargained with (`echo_sky_oath`), skipping its fight for the Talisman-bearer.');
    expect(STORY).toContain('From Loop 2\nthe Stormcrown can be bargained with on the Perch');
    expect(BIBLE).toContain('bargain from Loop 2 (`echo_sky_oath`, `echo_tyrant_never_struck`)');
    expect(flat(section(WORLD, '### 10.5 Forced-combat nodes', '### 10.6'))).toContain('| loc_stormcrowns_perch | cr_stormcrown | boss | without `echo_sky_oath` + `item_sky_whisper_talisman` | the bargain |');
  });
});

// ---- The 73 locations: reachability from loc_whispering_ruins, against what has landed ------------------------------------------

describe('reachability of WORLD’s 73 locations (the brief’s report; order-agnostic)', () => {
  const all73 = Object.keys(NODES);
  const landed = all73.filter((id) => pack.locations[id] !== undefined);
  const missing = all73.filter((id) => pack.locations[id] === undefined);
  /**
   * Every exit taken whatever its gate (every gate is satisfiable under some sequence, WORLD §3.13 / §11.3); the Threshold is
   * entered at a loop's end, on the Still Shore (WORLD §3.13 "loop end only"; the Library portal is the engine's, D-091), as
   * validator rule 8 reads it.
   */
  const SHORE = 'loc_still_shore';
  const open = new Set<string>([WR, ...(pack.locations[SHORE] ? [SHORE] : [])]);
  const queue = [...open];
  for (let i = 0; i < queue.length; i++) {
    for (const e of pack.locations[queue[i] ?? '']?.exits ?? []) {
      if (pack.locations[e.to] === undefined || open.has(e.to)) continue;
      open.add(e.to);
      queue.push(e.to);
    }
  }

  test('WORLD has 73 nodes; every landed one is reachable from loc_whispering_ruins with every gate satisfiable; the rest are exactly the regions still being authored', () => {
    expect(all73).toHaveLength(73);
    expect(landed.filter((id) => !open.has(id))).toEqual([]);
    // what is not reachable is not authored: today at most the Veil's and the Glowfen's sixteen (U47), each a pending exit target
    expect(missing.every((id) => ['region_veil', 'region_glowfen'].includes(NODES[id]?.regionId ?? ''))).toBe(true);
    expect(landed.length + missing.length).toBe(73);
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors.filter((e) => e.rule === 'rule-08')).toEqual([]);
    expect(report.warnings.filter((w) => w.rule === 'rule-08' && here.has(w.id))).toEqual([]);
  });

  test('the Skyreach is reachable through its own authored exits, both climbs, with nothing pending', () => {
    expect(ALL.every((id) => open.has(id))).toBe(true);
    expect(validateContent(pack, { strict: false }).errors.filter((e) => e.rule === 'rule-08' && here.has(e.id))).toEqual([]);
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U48a reply -----------------------------------------

describe('authored words outside the documents are few and short; coined ids are the listed ones', () => {
  test('encounter intros (≤ 20 words), the rest text, the ledge’s two lines and label, the creature descriptions (≤ 30 words)', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro));
    expect(intros).toHaveLength(9);
    for (const t of intros) expect([t, t !== undefined && words(t) <= 20]).toEqual([t, true]);
    expect(loc(AE).rest?.text).toBe("You rest in the workshop's inner room, where there is no wind.");
    const ledge = loc(RS).events.filter((e) => e.trigger === 'interact').map((e) => [e.label, e.text]);
    expect(ledge).toEqual([
      ['Take the greataxe from the ledge', 'You take the greataxe from beside its owner. Without the oath, it is a theft.'],
      ['Take the greataxe from the ledge', 'You take the greataxe from beside its owner. With the oath, it is an inheritance.'],
    ]);
    for (const c of parsedCreatures) expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
    // every move line is WORLD's (no telegraph written here)
    for (const c of parsedCreatures) for (const [id, m] of Object.entries(c.moves)) expect([c.id, id, m.line]).toEqual([c.id, id, worldCreature(c.id).intents[id]]);
  });

  test('ids this unit coined (WORLD/STORY have none for them): encounter ids, the ledge’s two events and its flag, the Stormcrown’s phase ids', () => {
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.id))).toEqual([
      'enc_windward_kites',
      'enc_crown_weavers', 'enc_crown_motes',
      'enc_roost_sentinel_kite', 'enc_roost_kite', 'enc_roost_cloud_rays',
      'enc_eyrie_loom_weaver', 'enc_eyrie_loom',
      'enc_perch_stormcrown',
    ]);
    const wordedEvents = new Set(Object.values(WL).flatMap((w) => Object.keys(w.events)));
    expect(parsedLocations.flatMap((l) => l.events.map((e) => e.id)).filter((id) => !wordedEvents.has(id))).toEqual(['ev_roost_greataxe', 'ev_roost_greataxe_oath']);
    expect(JSON.stringify(locations).match(/flag_[a-z_]+/g)?.filter((f) => f !== 'flag_heartstone_destroyed').filter((f, i, a) => a.indexOf(f) === i)).toEqual(['flag_roost_greataxe_taken']);
    expect(WORLD.includes('flag_roost_greataxe_taken')).toBe(false);
    expect(cr(CROWN).phases.map((p) => p.id)).toEqual(['crown_the_watch', 'crown_the_storm_comes_down', 'crown_seven_struck']);
    for (const c of parsedCreatures) for (const id of Object.keys(c.moves)) expect([c.id, id, WORLD.includes(`\`${id}\``)]).toEqual([c.id, id, true]);
  });
});
