// U48b: The Threshold — checked against the documents at test time, U42's pattern (regions/silverwood_ruins.test.ts): WORLD
// §2.12, §3.12, §3.13, §10.1, §10.3, §10.4, §11.1–11.4, §12.1, §12.3; DESIGN §6.5, §10.8, §17.1, §18.2; PLAN Appendix A; STORY
// §12, §14; D-012, D-049, D-062, D-082. The region is new (no legacy text), so every description and event line is WORLD's,
// character for character. The engine runs the Threshold as four places (reducers/threshold.ts, U31; `talk`, U34c): the last
// part of this file plays them on the real pack — a Loop 2 *Let go* at the Ruins' camp, the slides, the Still Shore, the
// walk between the places, who stands where, the Far Light's class change and the step into the light. Where a record
// departs from the letter of WORLD (a reading the schema or the engine forces), the test pins the departure; the readings are
// listed in the U48b reply.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures } from '@content/regions/threshold/creatures';
import { items } from '@content/regions/threshold/items';
import { locations } from '@content/regions/threshold/locations';
import { npcs } from '@content/regions/threshold/npcs';
import { region } from '@content/regions/threshold/region';
import { LEGACY_CREATURES, LEGACY_LOCATIONS, LEGACY_NPCS, validateContent } from '@content/validate';
import { talkProblem } from '@engine/reducers/dialogue';
import { npcsAt } from '@engine/reducers/explore';
import {
  THRESHOLD_AREAS,
  THRESHOLD_LOCATIONS,
  THRESHOLD_TEXT,
  evaluate,
  legalActions,
  step,
  thresholdArea,
  thresholdLocationId,
  type Action,
  type GameEvent,
  type GameState,
  type Profile,
  type ThresholdArea,
} from '@engine/index';
import type { Condition } from '@schema/condition';
import { LocationSchema, type Location } from '@schema/location';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { main as validateCli } from '../../../../tools/validate-content';
import { PLAN, WORLD, ids, section, tableRows, unquote, worldEdges, worldLocations, worldNodes } from './worldDoc';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');
const DECISIONS = fs.readFileSync(path.join(ROOT, 'docs/DECISIONS.md'), 'utf8');

const REGION = 'region_threshold';
const TS = 'loc_still_shore';
const LG = 'loc_gallery_of_loops';
const LM = 'loc_loom';
const FL = 'loc_far_light';
const ALL = [TS, LG, LM, FL];
const WR = 'loc_whispering_ruins';
const LIBRARY = 'loc_shattered_library';
const DASK = 'npc_dask';

const S212 = section(WORLD, '### 2.12 `region_threshold`', '## 3. Locations');
/** WORLD §3.12. The blocks' band is "none", which the reader's meta line does not take: read as 0 here (no band is checked). */
const S312_RAW = section(WORLD, '### 3.12 The Threshold', '### 3.13');
const S312 = S312_RAW.replaceAll('- **Band / map / rest / merchant:** none ·', '- **Band / map / rest / merchant:** 0 ·');
const WL = Object.fromEntries(worldLocations(S312).map((l) => [l.id, l]));
const NODES = worldNodes();
const EDGES = worldEdges();
const pack = buildContentPack();
const parsedLocations: Location[] = locations.map((l) => LocationSchema.parse(l));
const here = new Set<string>(ALL);
const mine = new Set<string>([REGION, ...ALL]);

const loc = (id: string): Location => {
  const found = parsedLocations.find((l) => l.id === id);
  if (!found) throw new Error(`no location ${id}`);
  return found;
};
const ev = (l: string, id: string) => {
  const found = loc(l).events.find((e) => e.id === id);
  if (!found) throw new Error(`no event ${id} at ${l}`);
  return found;
};
/** One line of prose: the document's wrapped lines joined. */
const flat = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim();
/** WORLD's prose as play text: markdown emphasis and decision references dropped. */
const playText = (s: string): string =>
  flat(s)
    .replace(/[`*]/g, '')
    .replace(/ \(D-\d+(?:\.\d+)?\)/g, '')
    .replace(/, D-\d+(?:\.\d+)?\)/g, ')');
const ENDINGS = ['a', 'b', 'c', 'd', 'e', 'f'].map((x): `echo_${string}` => `echo_ending_${x}`);
const ANY_ENDING: Condition = { any: ENDINGS.map((echo) => ({ echo })) };

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_threshold vs WORLD §2.12, §10.1, DESIGN §6.5, §17.1, §18.2', () => {
  test('id, name, new (Appendix A.1), no faction, WORLD’s theme text, the last in order, codex entry; no `unlockWhen` (reached by a loop’s end, not a door)', () => {
    expect(region.id).toBe(REGION);
    expect(S212.startsWith(`### 2.12 \`${REGION}\` — ${region.name}`)).toBe(true);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | new | 4 |`);
    expect('legacy' in region).toBe(false);
    expect(pack.regions[REGION]?.legacy).toBe(false);
    expect(S212).toContain('| Factions | None. |');
    expect('factionId' in region).toBe(false);
    const theme = /\*\*Theme\.\*\* ([\s\S]*?)\n\n\| Field/.exec(S212)?.[1] ?? '';
    expect(flat(theme).endsWith('and leaves by the Far Light (D-012).')).toBe(true);
    expect(region.description).toBe(playText(theme));
    expect(region.order).toBe(12);
    expect(REGION_FOLDERS.at(-1)?.region.id).toBe(REGION);
    expect(region.codexId).toBe('codex_region_threshold');
    expect(STORY).toContain('| `codex_region_threshold` | The Threshold |');
    expect('unlockWhen' in region).toBe(false);
    expect(flat(section(WORLD, '### 3.13', '## 4. Non-companion NPCs'))).toContain('| The Threshold | Shattered Library portal (Horde), death (Loop 2+), Day 30, *Let go* at any camp (Loop 2+, D-067.14) | loop end only, from Loop 2');
  });

  test('band: WORLD and DESIGN give none; the schema needs one, so it is the whole level range (no placement reads it: there are no fights); the places carry none', () => {
    expect(S212).toContain('| Level band | none (no combat) |');
    expect(DESIGN).toContain('| The Threshold | `region_threshold` | — | no combat | — |');
    expect(region.levelBand).toEqual({ min: 1, max: 20 });
    for (const l of parsedLocations) expect([l.id, l.levelBand]).toEqual([l.id, undefined]);
    expect(S312_RAW.split('- **Band / map / rest / merchant:** none ·').length - 1).toBe(4);
  });

  test('no wandering pool, no return encounters: "the Threshold has no combat" (WORLD §10.1); tags say so', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => c[0] === '(Silverwood Before, Threshold)');
    expect(row?.slice(1)).toEqual(['none', 'the Before is day-scripted (§12); the Threshold has no combat']);
    expect([region.wanderingPool, region.returnEncounterChance]).toEqual([[], 0]);
    expect(region.tags).toEqual(['threshold', 'no_combat', 'no_time']);
  });

  test('palette: DESIGN §17.1’s Threshold row (D-062: DESIGN wins over WORLD §2.12’s own set); the ambient preset exists in §18.2', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'The Threshold');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(row?.[6]).toBe('`#B8C7FF` (far light)');
    expect(S212).toContain('| Palette | sky `#0D0D12` · horizon `#26262E` · mid `#4C4C5A` · near `#090909` · accent `#FFF4D6` |');
    expect(DECISIONS).toContain('The palette follows DESIGN §17.1 (D-062).');
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).find((c) => c[0] === 'The Threshold')?.[5]).toBe('the still shore');
    expect(region.ambient).toBe('ambient_threshold');
    for (const l of parsedLocations) expect([l.id, l.ambient]).toEqual([l.id, undefined]);
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the four locations vs WORLD §3.12 blocks', () => {
  test('the four WORLD lists, in WORLD’s order and the engine’s (THRESHOLD_LOCATIONS); names, coordinates, region; safe, temporally unstable, tagged `threshold`', () => {
    const listed = /\| Locations \(4\) \| ([^|]+) \|/.exec(S212)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual(ALL);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    expect(THRESHOLD_AREAS.map((a) => THRESHOLD_LOCATIONS[a])).toEqual(listed);
    for (const l of parsedLocations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.map, l.safe, l.temporallyUnstable, l.tags.includes('threshold')]).toEqual([l.id, w?.name, REGION, w?.map, true, true, true]);
    }
    expect(S312).toContain('Reached only by a loop ending. No combat, no time, no items to take except Attunements.');
  });

  test('descriptions: WORLD’s, character for character; no legacy name', () => {
    for (const l of locations) {
      expect([l.id, l.description]).toEqual([l.id, playText(WL[l.id]?.description ?? '')]);
      expect([l.id, l.description]).toEqual([l.id, WL[l.id]?.description]);
      expect([l.id, 'legacyName' in l]).toEqual([l.id, false]);
    }
  });

  test('exits: WORLD’s walk rows at 0 watches ("no time"), open; the Shore’s arrival row and the Far Light’s step into the light are not exits (the engine’s loop end and `newLoop`)', () => {
    for (const l of parsedLocations) {
      expect([l.id, l.exits.map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }))]).toEqual([l.id, WL[l.id]?.exits]);
      for (const e of l.exits) expect([l.id, e.to, e.travelWatches, e.hidden, here.has(e.to)]).toEqual([l.id, e.to, 0, false, true]);
    }
    expect(WL[TS]?.block).toContain('| (arrival ⟂) | from loc_shattered_library (portal), death (Loop 2+), the Breach Clock | not a usable exit |');
    expect(WL[FL]?.block).toContain('| step into the light ⟂ | loc_whispering_ruins | always; begins the next loop on Day 1, dawn |');
    // and nothing outside leads in: the Library's portal is the engine's `enterPortal` (D-091's ruling on U42)
    const inward = Object.values(pack.locations).filter((l) => !here.has(l.id)).flatMap((l) => l.exits.filter((e) => here.has(e.to)).map((e) => `${l.id}>${e.to}`));
    expect(inward).toEqual([]);
    expect(DECISIONS).toContain('The Library portal is the engine\'s `enterPortal`, not an exit.');
  });

  test('no rest, no merchant, nothing to take, nothing to fight; the Loom is the Attunement station, not a merchant', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      expect([l.id, l.rest, l.merchantId, w?.rest, w?.merchant]).toEqual([l.id, undefined, undefined, 'no', null]);
      expect([l.id, l.items, l.gather, l.encounters, w?.itemIds, w?.creatureIds]).toEqual([l.id, [], undefined, [], [], []]);
    }
    expect(WL[LM]?.block).toContain('· no · **Attunement vendor** (not a merchant; spends Resonance, D-011)');
    expect(parsedLocations.map((l) => [l.id, l.craftingStation])).toEqual([[TS, undefined], [LG, undefined], [LM, 'loom'], [FL, undefined]]);
    expect(WL[TS]?.block).toContain('- **Items:** none. **Encounters:** none.');
    expect(WL[LG]?.block).toContain('- **Items / Encounters:** none. **NPCs:** none.');
  });

  test('NPCs: Dask on the Still Shore (WORLD’s block and §2.12’s companion anchor), at home in the Shimmering Pass (U44); nobody else', () => {
    expect(parsedLocations.map((l) => [l.id, l.npcs])).toEqual([[TS, [DASK]], [LG, []], [LM, []], [FL, []]]);
    expect(WL[TS]?.npcIds).toEqual([DASK]);
    expect(WL[TS]?.block).toContain('**NPCs:** npc_dask (from Loop 3; conversation partner, D-012).');
    expect(S212).toContain('| Companion anchor | **Dask** (from Loop 3 he stands on the Shore). |');
    expect(pack.npcs[DASK]?.homeLocationId).toBe('loc_shimmering_pass');
    expect(npcs).toEqual([]);
  });

  test('events: every WORLD event, its text verbatim; the loop numbers as WORLD writes them, read in the next loop’s count (D-082) with Loop 1 skipping the Threshold (D-049)', () => {
    // U57 hooked `q_the_still_shore` on one event per place (tests/unit/content/quests/regional.test.ts pins them)
    const U57_HOOKS = ['ev_shore_between', 'ev_gallery_first_loop', 'ev_loom_one_thread', 'ev_far_light_look_back'];
    for (const l of parsedLocations) {
      expect([l.id, Object.fromEntries(l.events.filter((e) => !U57_HOOKS.includes(e.id)).map((e) => [e.id, e.text]))]).toEqual([l.id, WL[l.id]?.events]);
      // U55 hooked `q_seven_marks`'s Gallery stage on the marks event (tests/unit/content/quests/companions_u55.test.ts pins it); the rest carry no effects
      for (const e of l.events) if (!U57_HOOKS.includes(e.id)) expect([e.id, e.trigger, e.once, e.id === 'ev_gallery_marks' ? e.effects.length : e.effects]).toEqual([e.id, 'enter', true, e.id === 'ev_gallery_marks' ? 2 : []]);
    }
    // "once, Loop 1→2 only": the first crossing, whose state is already Loop 3's
    expect(ev(TS, 'ev_shore_first').when).toEqual({ loop: { max: 3 } });
    expect(WL[TS]?.block).toContain('— once, Loop 1→2 only.');
    expect(DECISIONS).toContain('The Loop 1 → Loop 2 transition skips the Threshold');
    expect(ev(TS, 'ev_shore_silhouette').when).toEqual({ loop: { min: 5 } });
    expect(ev(TS, 'ev_shore_shards').when).toEqual({ loop: { min: 7 } });
    expect(WL[TS]?.block).toContain('— once, Loop 5+.');
    expect(WL[TS]?.block).toContain('— once, Loop 7+.');
    // "after any true ending": STORY §12's `echo_ending_a` .. `_f` ("Reach each ending")
    expect(ev(LG, 'ev_gallery_ending').when).toEqual(ANY_ENDING);
    expect(STORY).toContain('| `echo_ending_a` .. `echo_ending_f` | Witnessed | Reach each ending | Gallery frames; New Game+; achievements | — |');
    expect(ev(LG, 'ev_gallery_marks').when).toEqual({ all: [{ loop: { min: 3 } }, { quest: { id: 'q_seven_marks', status: 'active' } }] });
    expect(WL[LG]?.block).toContain('— once, Loop 3+, while `q_seven_marks` is active');
    expect([ev(LM, 'ev_loom_first_thread').when, ev(FL, 'ev_far_light_step').when]).toEqual([undefined, undefined]);
    expect(WL[FL]?.block).toContain('— every loop.'); // the schema's `once` is once per loop
    // §12.1's growth rows
    const rows = Object.fromEntries(tableRows(section(WORLD, '### 12.1', '### 12.2')).map((c) => [unquote(c[0] ?? ''), c]));
    expect(rows['ws_threshold_n']?.slice(1, 4)).toEqual(['Threshold', '`{loop:{min:N}}`', 'Loop 2 bare; 3 Dask on the Shore; 5 `ev_shore_silhouette`; 7 `ev_shore_shards`']);
    expect(rows['ws_threshold_ended']?.slice(1, 4)).toEqual(['loc_gallery_of_loops', 'any true ending recorded in the profile', '`ev_gallery_ending`; epilogue paintings']);
  });

  test('the events’ conditions in play, on a threshold state of each loop', () => {
    const at = (loop: number, echoes: string[] = [], quests: string[] = []): [GameState, Profile] => {
      const prof = freshProfile({ loopCounter: loop });
      const s = makeState(
        {
          mode: 'threshold',
          loop,
          patch: (x) => {
            for (const id of echoes) x.echoesThisLoop.push(id);
            for (const id of quests) x.quests[id] = { status: 'active', stage: 'u48b', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] };
          },
        },
        { content: pack, profile: prof },
      );
      return [s, prof];
    };
    const holds = (cond: Condition | undefined, loop: number, echoes: string[] = [], quests: string[] = []): boolean => {
      const [s, prof] = at(loop, echoes, quests);
      return cond === undefined || evaluate(cond, s, prof, pack);
    };
    const first = ev(TS, 'ev_shore_first').when;
    const silhouette = ev(TS, 'ev_shore_silhouette').when;
    const shards = ev(TS, 'ev_shore_shards').when;
    expect([3, 4, 5, 6, 7, 9].map((n) => [n, holds(first, n), holds(silhouette, n), holds(shards, n)])).toEqual([
      [3, true, false, false], [4, false, false, false], [5, false, true, false], [6, false, true, false], [7, false, true, true], [9, false, true, true],
    ]);
    const ending = ev(LG, 'ev_gallery_ending').when;
    expect([holds(ending, 4), ...ENDINGS.map((e) => holds(ending, 4, [e]))]).toEqual([false, true, true, true, true, true, true]);
    const marks = ev(LG, 'ev_gallery_marks').when;
    expect([holds(marks, 3), holds(marks, 3, [], ['q_seven_marks']), holds(marks, 2, [], ['q_seven_marks'])]).toEqual([false, true, false]);
  });

  test('art: the `threshold` template, timeless; WORLD’s horizons; the Shore’s water grows with the loops, the Gallery shows the epilogue after an ending', () => {
    for (const l of parsedLocations) expect([l.id, l.art.template, l.art.horizon, l.art.timeOfDay]).toEqual([l.id, 'threshold', WL[l.id]?.horizon, 'timeless']);
    expect(parsedLocations.map((l) => [l.id, l.art.particles])).toEqual([[TS, 'none'], [LG, 'none'], [LM, 'motes'], [FL, 'motes']]);
    expect(WL[TS]?.block).toContain('particles: none');
    expect(WL[LG]?.block).toContain('particles: none.');
    expect(WL[LM]?.block).toContain('particles: thread-glints.');
    expect(WL[FL]?.block).toContain('particles: light motes converging.');
    expect(loc(TS).art.variants).toEqual([
      { when: { loop: { min: 5, max: 6 } }, patch: { focal: 'tyrant_silhouette' } },
      { when: { loop: { min: 7 } }, patch: { focal: 'nine_shards' } },
    ]);
    expect(S212).toContain("Loop 5 the Tyrant's silhouette in the water; Loop 7 the Nine's shards visible; after any true ending the Gallery shows the epilogue slides as paintings.");
    expect(loc(LG).art.variants).toEqual([{ when: ANY_ENDING, patch: { focal: 'epilogue_paintings' } }]);
    expect([loc(LM).art.variants, loc(FL).art.variants]).toEqual([[], []]);
  });
});

// ---- Map data ---------------------------------------------------------------------------------------------------------------

describe('WORLD §11 map data, §10.3–10.4, §12.3; validator rule 8', () => {
  test('§11.1 nodes: coordinates, temporally unstable, no band, no rest, the Loom’s Attunements, no settlement', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect([l.id, n?.regionId, l.map, n?.temporallyUnstable, n?.rest, n?.settlement]).toEqual([l.id, REGION, { x: n?.x, y: n?.y }, true, '—', false]);
      expect([l.id, n?.merchant]).toEqual([l.id, l.craftingStation === 'loom' ? 'attunements' : '—']);
    }
    expect(Object.values(NODES).filter((n) => n.regionId === REGION).map((n) => n.id)).toEqual(ALL);
  });

  test('§11.2 edges: the three walk edges from the Shore at 0 both ways; the two one-way portals are the loop’s end and its start, not exits', () => {
    const walks = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(walks.map((e) => [e.from, e.to, e.dir, e.reverseDir, e.cost, e.reverseCost, e.gate, e.reverseGate])).toEqual([
      [TS, LG, 'west', 'east', 0, 0, 'open', 'open'],
      [TS, LM, 'east', 'west', 0, 0, 'open', 'open'],
      [TS, FL, 'south', 'north', 0, 0, 'open', 'open'],
    ]);
    for (const e of walks) {
      expect(loc(e.from).exits.find((x) => x.to === e.to)).toMatchObject({ dir: e.dir, travelWatches: 0 });
      expect(loc(e.to).exits.find((x) => x.to === e.from)).toMatchObject({ dir: e.reverseDir, travelWatches: 0 });
    }
    const portals = EDGES.filter((e) => e.kind !== 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(portals.map((e) => [e.from, e.to, e.dir, e.reverseDir, e.gate, e.reverseGate, e.kind])).toEqual([
      [WR, FL, 'none', 'step into the light', 'none', 'gate_far_light', 'portal_oneway'],
      [LIBRARY, TS, 'portal', 'none', 'gate_library_portal', 'none', 'portal_oneway'],
    ]);
    expect(loc(FL).exits.some((x) => x.to === WR)).toBe(false);
    expect(pack.locations[LIBRARY]?.exits.some((x) => x.to === TS)).toBe(false);
    const gates = Object.fromEntries(tableRows(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).map((c) => [unquote(c[0] ?? ''), c]));
    expect(gates['gate_far_light']?.slice(1)).toEqual(['far_light ⟂ whispering_ruins (one-way)', 'always', 'begins the next loop, Day 1 Dawn']);
  });

  test('§11.4: the Threshold is an inset; every place lies inside its bounds', () => {
    const row = tableRows(section(WORLD, '### 11.4', '### 11.5')).find((c) => c[0] === REGION) ?? [];
    expect(row.slice(1)).toEqual(['64,14,80,16', '64,14,80,14 ; 72,16,72,16', '76,13']);
    const [x0, y0, x1, y1] = (row[1] ?? '').split(',').map(Number) as [number, number, number, number];
    for (const l of parsedLocations) expect([l.id, l.map.x >= x0 && l.map.x <= x1 && l.map.y >= y0 && l.map.y <= y1]).toEqual([l.id, true]);
    const inset = flat(section(WORLD, '### 11.4', '### 11.5')).replace(/\*/g, '');
    expect(inset).toContain('The Threshold is an inset, not part of the main map');
    // "in local coordinates = world − (64, 14): Gallery (0,0), Still Shore (8,0), Loom (16,0), Far Light (8,2)"
    const local = Object.fromEntries([...inset.matchAll(/(Gallery|Still Shore|Loom|Far Light) \((\d+),(\d+)\)/g)].map((m) => [m[1], { x: Number(m[2]), y: Number(m[3]) }]));
    expect(parsedLocations.map((l) => ({ x: l.map.x - 64, y: l.map.y - 14 }))).toEqual([local['Still Shore'], local['Gallery'], local['Loom'], local['Far Light']]);
  });

  test('§10.3 and §10.4 rows: four nodes, the Shore to the Far Light in one step, no time, no rest needed; nothing to fight, never infected', () => {
    const traversal = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'threshold') ?? [];
    expect(traversal.slice(1)).toEqual(['—', '4', 'TS→FL', '0 (no time)', 'none', '—', 'none', '—', 'none needed']);
    expect(loc(TS).exits.find((e) => e.to === FL)?.travelWatches).toBe(0);
    const elites = tableRows(section(WORLD, '### 10.4 Elites', '### 10.5')).find((c) => c[0] === 'threshold') ?? [];
    expect(elites.slice(1)).toEqual(['none', 'none', 'none', 'all four places, always', 'never infected']);
  });

  test('§12.3: all four are statically temporally unstable (D-059)', () => {
    const text = flat(section(WORLD, '### 12.3 `temporallyUnstable` (D-059)', '**Dynamic:**'));
    expect(text).toContain('loc_still_shore, loc_gallery_of_loops, loc_loom, loc_far_light (Threshold).');
    for (const l of parsedLocations) expect([l.id, l.temporallyUnstable]).toEqual([l.id, true]);
  });

  test('rule 8: the Threshold is reached from the Still Shore (every place is), not from the start; the validator reports nothing about it', () => {
    const fromShore = new Set<string>([TS]);
    for (const id of [...fromShore]) for (const e of pack.locations[id]?.exits ?? []) fromShore.add(e.to);
    expect([...fromShore].sort()).toEqual([...ALL].sort());
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect([...strict.errors, ...strict.warnings].filter((w) => w.rule === 'rule-08' && here.has(w.id))).toEqual([]);
    const lax = validateContent(pack, { strict: false });
    expect(lax.errors.filter((e) => e.rule === 'rule-08')).toEqual([]);
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder last (WORLD §2 order: twelfth); the tables are in `contentTables` and the index; no creature, NPC or item of its own', () => {
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('The Threshold');
    expect(pack.index.locationsByRegion[REGION]).toEqual(ALL);
    expect([creatures, npcs, items]).toEqual([[], [], []]);
    for (const id of mine) expect([id, id in LEGACY_LOCATIONS || id in LEGACY_CREATURES || id in LEGACY_NPCS]).toEqual([id, false]);
  });

  test('validates with 0 errors and no real warning about the Threshold; its pending references are WORLD/STORY ids in tables still being authored', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const about = report.warnings.filter((w) => mine.has(w.id));
    expect(about.filter((w) => !w.message.startsWith('pending — content not yet authored'))).toEqual([]);
    const { report: parsed } = parseContentPack(contentTables);
    const targets = new Set(parsed.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    const known = new Set([...ENDINGS, 'q_seven_marks', 'codex_region_threshold']);
    expect([...targets].filter((t) => !known.has(t))).toEqual([]);
    expect(targets.has(DASK)).toBe(false);
    for (const id of targets) expect([id, `${WORLD}\n${STORY}`.includes(id) || id.startsWith('echo_ending_')]).toEqual([id, true]);
  });

  test('`npm run validate`: exit 0', () => {
    expect(validateCli([], () => undefined)).toBe(0);
  });

  test('the words are WORLD’s: every event id and line is in §3.12; the coined ids are the art keys only', () => {
    const worded = new Set(Object.values(WL).flatMap((w) => Object.keys(w.events)));
    expect(parsedLocations.flatMap((l) => l.events.map((e) => e.id)).filter((id) => !worded.has(id))).toEqual(['ev_shore_between', 'ev_gallery_first_loop', 'ev_loom_one_thread', 'ev_far_light_look_back']); // U57's hooks
    expect(ids(JSON.stringify(locations), 'flag')).toEqual([]);
    expect(parsedLocations.flatMap((l) => [...l.art.silhouettes, ...l.art.variants.map((v) => v.patch.focal ?? '')])).toEqual([
      'flat_shore', 'own_shadow', 'far_light', 'tyrant_silhouette', 'nine_shards', 'receding_colonnade', 'framed_panels', 'epilogue_paintings', 'loom_frame', 'light_threads',
      'five_coats', 'light_path', 'doorway',
    ]);
  });
});

// ---- The Threshold in the engine (the real pack) --------------------------------------------------------------------------------

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
interface Run {
  s: GameState;
  prof: Profile;
  last: Ev[];
}
function act(r: Run, action: Action): Run {
  const out = step(r.s, action, pack, r.prof);
  const rejected = ofType(out.events, 'actionRejected')[0];
  if (rejected) throw new Error(`${JSON.stringify(action)} was rejected: ${rejected.reason}`);
  return { s: out.state, prof: out.profile, last: out.events };
}
const go = (to: ThresholdArea): Action => ({ type: 'thresholdGo', to });
/** What the place offers beyond the menu every Threshold state has (save slots, back to the title). */
const offered = (r: Run): Action[] => legalActions(r.s, pack, r.prof).filter((a) => a.type !== 'save' && a.type !== 'returnToTitle');

describe('the Threshold in the engine (reducers/threshold.ts on the real pack)', () => {
  /** Loop 2 at the Ruins' camp: *Let go* (D-067.14), every slide acknowledged — the Still Shore, Loop 3's state (D-082). */
  function arrive(): Run {
    const prof = freshProfile({ loopCounter: 2 });
    let r: Run = { s: makeState({ locationId: WR, loop: 2 }, { content: pack, profile: prof }), prof, last: [] };
    r = act(r, { type: 'letGo' });
    for (let i = 0; i < 20 && r.s.mode === 'ending'; i++) r = act(r, { type: 'acknowledgeEnding' });
    return r;
  }

  test('a loop’s end lands on the Still Shore: threshold mode, the next loop’s count, the shore’s lines', () => {
    const r = arrive();
    expect([r.s.mode, r.s.meta.loop, thresholdArea(r.s), thresholdLocationId(r.s)]).toEqual(['threshold', 3, 'still_shore', TS]);
    expect(ofType(r.last, 'log').map((e) => e.text)).toContain(THRESHOLD_TEXT.shore);
    // ev_shore_first's `loop ≤ 3` holds on this, the first crossing
    expect(evaluate(ev(TS, 'ev_shore_first').when as Condition, r.s, r.prof, pack)).toBe(true);
  });

  test('every place offers its legal actions: the walk to the other three; Dask stands on the Shore; the Far Light’s class change and the step into the light', () => {
    const shore = arrive();
    // the walk to the other three, and (U55: his Shore scene, Loop 3+) a word with Dask
    expect(offered(shore).filter((a) => a.type === 'thresholdGo')).toEqual([go('far_light'), go('gallery'), go('loom')]);
    expect(offered(shore).filter((a) => a.type !== 'thresholdGo')).toEqual([{ type: 'talk', npcId: DASK }]);
    expect(npcsAt(shore.s, pack, shore.prof, thresholdLocationId(shore.s))).toEqual([DASK]);
    expect(talkProblem(shore.s, pack, shore.prof, DASK)).toBeNull();
    for (const area of ['gallery', 'loom', 'far_light'] as const) {
      const there = act(shore, go(area));
      expect([thresholdLocationId(there.s), ofType(there.last, 'thresholdEntered')]).toEqual([THRESHOLD_LOCATIONS[area], [{ t: 'thresholdEntered', area }]]);
      expect(npcsAt(there.s, pack, there.prof, thresholdLocationId(there.s))).toEqual([]);
      const walks = THRESHOLD_AREAS.filter((a) => a !== area).sort().map(go);
      const own = offered(there).filter((a) => a.type !== 'thresholdGo');
      expect(offered(there).filter((a) => a.type === 'thresholdGo')).toEqual(walks);
      if (area === 'gallery') expect(own).toEqual([]);
      // the Loom's are the Attunement and modifier records' (none authored yet) and New Game+ (no ending reached)
      if (area === 'loom') for (const a of own) expect(['thresholdSpend', 'thresholdRefund', 'equipAttunement', 'toggleModifier', 'newGamePlus']).toContain(a.type);
      if (area === 'far_light') {
        const classes = Object.keys(pack.classes).filter((c) => c !== there.s.player.classId).sort();
        expect(own).toEqual([...classes.map((classId) => ({ type: 'chooseClass', classId })), { type: 'newLoop' }]);
      }
    }
  });

  test('the Far Light: choose another class, step into the light — the next loop at the Whispering Ruins, Day 1, in the chosen shape', () => {
    let r = act(arrive(), go('far_light'));
    const other = Object.keys(pack.classes).find((c) => c !== r.s.player.classId) ?? '';
    r = act(r, { type: 'chooseClass', classId: other });
    expect(r.s.threshold?.pendingClassId).toBe(other);
    r = act(r, { type: 'newLoop' });
    expect([r.s.mode, r.s.world.currentLocationId, r.s.player.classId, r.s.meta.loop, r.s.threshold]).toEqual(['explore', WR, other, 3, null]);
    expect(ofType(r.last, 'log').map((e) => e.text)).toContain(THRESHOLD_TEXT.farLight);
    expect(r.s.clock.ticks).toBe(0);
  });

  test('D-098 (U34d, was a pinned gap): every arrival fires the place’s events — the Shore from the ending, then each walk; `once` holds for the visit', () => {
    const shore = arrive();
    // the Shore from the ending: `ev_shore_first` (Loop 3, the first crossing), after the shore's own lines
    expect(ofType(shore.last, 'eventFired').map((e) => e.eventId)).toEqual(['ev_shore_first', 'ev_shore_between']); // U57's hook starts q_the_still_shore
    const logs = ofType(shore.last, 'log').map((e) => e.text);
    expect(logs.indexOf(THRESHOLD_TEXT.shore)).toBeLessThan(logs.indexOf(ev(TS, 'ev_shore_first').text));
    // from the Shore, the quest U57's hook started is at its first stage: the Gallery's hook fires, the Loom's and the Far Light's wait
    const fired = { loom: ['ev_loom_first_thread'], far_light: ['ev_far_light_step'], gallery: ['ev_gallery_first_loop'] } as const;
    for (const area of ['loom', 'far_light', 'gallery'] as const) {
      const there = act(shore, go(area));
      expect([area, ofType(there.last, 'eventFired').map((e) => e.eventId)]).toEqual([area, [...fired[area]]]);
      expect(there.s.world.locationStates[THRESHOLD_LOCATIONS[area]]?.eventsFired ?? []).toEqual([...fired[area]]);
    }
    // back and forth: a `once` event fires once a visit (the Gallery's two need an ending or `q_seven_marks`)
    const again = act(act(act(shore, go('loom')), go('still_shore')), go('loom'));
    expect(ofType(again.last, 'eventFired')).toEqual([]);
    const back = act(act(shore, go('loom')), go('still_shore'));
    expect(ofType(back.last, 'eventFired')).toEqual([]);
  });
});
