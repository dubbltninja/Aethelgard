// U42: Silverwood Ruins, the first region — checked against the documents at test time (WORLD §2.1, §3.1, §4, §6, §10.1,
// §11.1–11.3; PLAN Appendix A; DESIGN §6.2, §6.5). The legacy text is checked against the Python source in
// tests/unit/content/legacy.test.ts. The pattern for later region tests: read the region's WORLD blocks with
// regions/worldDoc.ts, hold every record to them field by field, prove reachability inside the region, then build the
// real pack and pin what `npm run validate` and the engine say about it while other tables are still being authored.
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures as folderCreatures } from '@content/regions/silverwood_ruins/creatures';
import { locations } from '@content/regions/silverwood_ruins/locations';
import { npcs } from '@content/regions/silverwood_ruins/npcs';
import { region } from '@content/regions/silverwood_ruins/region';
import { gameConfig } from '@content/shared/config';
import { validateContent } from '@content/validate';
import { legalActions, newRun, step, type GameState } from '@engine/index';
import { CreatureSchema, walkSteps, type Creature, type Step } from '@schema/creature';
import { LocationSchema, type Location } from '@schema/location';
import { freshProfile } from '@tests/fixtures/helpers';
import { main as validateCli } from '../../../../tools/validate-content';
import { WORLD, appendixLegacyLocations, ids, section, tableRows, unquote, worldCreature, worldCreatureTable, worldEdges, worldLocations, worldNodes } from './worldDoc';

// U34e (D-087): WORLD §10.2's anomaly variants live in this folder too and the Unmade (its first region is the Depths' exploited state); WORLD §6's checks below are on the
// others (tests/unit/engine/u34e/anomalies.test.ts checks the variants).
const creatures = folderCreatures.filter((c) => !c.id.startsWith('cr_anomaly_') && c.id !== 'cr_unmade');

const REGION = 'region_silverwood_ruins';
const RUINS = section(WORLD, '### 3.1 Silverwood Ruins', '### 3.2');
const WL = Object.fromEntries(worldLocations(RUINS).map((l) => [l.id, l]));
const NODES = worldNodes();
const EDGES = worldEdges();
const CREATURE_TABLE = worldCreatureTable();
const pack = buildContentPack();
const parsedLocations: Location[] = locations.map((l) => LocationSchema.parse(l));
const parsedCreatures: Creature[] = creatures.map((c) => CreatureSchema.parse(c));
const byId = <T extends { id: string }>(rows: readonly T[], id: string): T => {
  const found = rows.find((r) => r.id === id);
  if (!found) throw new Error(`no record ${id}`);
  return found;
};

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_silverwood_ruins vs WORLD §2.1, §10.1 and DESIGN §6.5', () => {
  const S21 = section(WORLD, '### 2.1 `region_silverwood_ruins`', '### 2.2');

  test('id, name, legacy, faction, band, description (WORLD’s theme text) and order', () => {
    expect(region.id).toBe(REGION);
    expect(S21).toContain(`### 2.1 \`${REGION}\` — ${region.name}`);
    expect(region.legacy).toBe(true);
    expect(region.factionId).toBe('remnants');
    expect(S21).toContain('| Level band | 1–4 |');
    expect(region.levelBand).toEqual({ min: 1, max: 4 });
    expect(S21.replace(/\n/g, ' ')).toContain(region.description);
    expect(region.order).toBe(1);
    expect(region.codexId).toBe('codex_region_silverwood_ruins');
  });

  test('the seven locations WORLD lists, in WORLD’s order, all in the region', () => {
    const listed = /\| Locations \(7\) \| ([^|]+) \|/.exec(S21)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toHaveLength(7);
    expect(locations.map((l) => l.id)).toEqual(listed);
    for (const l of locations) expect(l.regionId).toBe(REGION);
    expect(Object.keys(WL)).toEqual(listed);
  });

  test('the wandering pool is WORLD §10.1’s pool_silverwood_ruins, weight for weight; return chance 20 %', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_silverwood_ruins');
    expect(row).toBeDefined();
    const entries = [...(row?.[1] ?? '').matchAll(/(cr_[a-z_]+) (\d+)/g)].map((m) => ({ creatureId: m[1], weight: Number(m[2]) }));
    expect(entries).toHaveLength(4);
    expect(region.wanderingPool).toEqual(entries);
    expect(region.returnEncounterChance).toBe(0.2);
    // every pool creature is a Ruins fodder of this unit, inside the band
    for (const e of entries) expect([e.creatureId, byId(parsedCreatures, e.creatureId ?? '').role]).toEqual([e.creatureId, 'fodder']);
  });

  test('palette: DESIGN §17.1’s Silverwood Ruins row (sky top, sky bottom, mid, accent)', () => {
    const DESIGN = section(WORLD, '## 1. Geography overview', '### Region graph'); // guard: WORLD is loaded
    expect(DESIGN.length).toBeGreaterThan(0);
    expect(region.palette).toEqual({ bg: '#1B1F3B', bgAlt: '#4A3F6B', fg: '#5B5380', accent: '#9FD8FF', glow: '#9FD8FF' });
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the seven locations vs WORLD §3.1 blocks', () => {
  test('names, bands, coordinates and region', () => {
    for (const l of locations) {
      const w = WL[l.id];
      expect(w, l.id).toBeDefined();
      expect([l.id, l.name, l.regionId, l.levelBand, l.map]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map]);
    }
  });

  test('descriptions: the legacy text with WORLD’s `+` sentence appended, character for character', () => {
    for (const l of locations) expect([l.id, l.description]).toEqual([l.id, WL[l.id]?.description]);
  });

  test('exits: every walkable WORLD exit, with its direction and destination; gated exits carry a `when`, open ones none', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const got = l.exits.map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, got]).toEqual([l.id, w?.exits]);
      // the Threshold portal is the engine's `enterPortal`, never an exit (U30)
      expect(l.exits.some((e) => e.dir === 'portal' || e.to === 'loc_still_shore')).toBe(false);
    }
  });

  test('rest points and merchants as WORLD says', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, w?.rest, w?.merchant]);
    }
    expect(byId(parsedLocations, 'loc_whispering_ruins').rest?.kind).toBe('camp');
    // the Library's nook: Loop 2+ with Ilyra Trusted (loyalty ≥ 75, DESIGN §12.5)
    expect(byId(parsedLocations, 'loc_shattered_library').rest?.when).toEqual({ all: [{ loop: { min: 2 } }, { loyalty: { companion: 'ilyra', min: 75 } }] });
  });

  test('every item WORLD places is placed (the Archivist’s quest drop as creature loot), and nothing else', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const placed = new Set(l.items.map((i) => i.itemId));
      const expected = new Set(w?.itemIds ?? []);
      if (l.id === 'loc_sunken_archives') {
        expected.delete('item_scholars_lost_scroll');
        const archivist = byId(parsedCreatures, 'cr_drowned_archivist');
        const drop = archivist.loot.find((row) => row.itemId === 'item_scholars_lost_scroll');
        expect(drop?.when).toEqual({
          all: [{ location: 'loc_sunken_archives' }, { quest: { id: 'q_lost_scroll', status: 'active' } }, { not: { item: { id: 'item_scholars_lost_scroll' } } }],
        });
      }
      expect([l.id, [...placed].sort()]).toEqual([l.id, [...expected].sort()]);
    }
    // the Amulet lies here on Day 1 of Loop 1 only (D-047); from Loop 2 it is a start item
    expect(byId(parsedLocations, 'loc_whispering_ruins').items[0]).toMatchObject({ itemId: 'item_amulet_of_echoes', when: { loop: { max: 1 } } });
    expect(gameConfig.startItems.map((s) => s.itemId)).toContain('item_amulet_of_echoes');
    expect(pack.items['item_amulet_of_echoes']?.sources).toEqual(['loc:loc_whispering_ruins']);
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      expect([l.id, [...got].sort()]).toEqual([l.id, [...(w?.creatureIds ?? [])].sort()]);
    }
  });

  test('legacy fixed fights: 100 %, once, on the first visit (Shade at the Corridor; a Wisp at the Library and the Plaza)', () => {
    const fixed = (loc: string, id: string) => byId(byId(parsedLocations, loc).encounters, id);
    for (const [loc, id, cr] of [
      ['loc_darkened_corridor', 'enc_corridor_shade', 'cr_corrupted_shade'],
      ['loc_shattered_library', 'enc_library_wisp', 'cr_arcane_wisp'],
      ['loc_silverwood_plaza', 'enc_plaza_wisp', 'cr_arcane_wisp'],
    ] as const) {
      const e = fixed(loc, id);
      expect([loc, e.groups, e.chance, e.once, e.respawn, e.fleeable, e.onFlee]).toEqual([loc, [{ creatureId: cr, count: 1 }], 1, true, 'never', true, 'scatter']);
    }
    // the Archway's Prowler rolls once at 40 %
    expect(fixed('loc_crumbling_archway', 'enc_archway_prowler')).toMatchObject({ chance: 0.4, once: true, respawn: 'never' });
  });

  test('story gates and Horde fights hold (R10-1): the Archivist under q_lost_scroll, the Corridor’s husks and Tide', () => {
    const archivist = byId(byId(parsedLocations, 'loc_sunken_archives').encounters, 'enc_archives_archivist');
    expect(archivist).toMatchObject({ fleeable: false, onFlee: 'hold', once: false, when: { quest: { id: 'q_lost_scroll', status: 'active' } }, optionalWhen: { echo: 'echo_oriel_drowned' } });
    const corridor = byId(parsedLocations, 'loc_darkened_corridor');
    for (const id of ['enc_corridor_husks', 'enc_corridor_tide']) expect(byId(corridor.encounters, id)).toMatchObject({ fleeable: false, onFlee: 'hold' });
    expect(byId(corridor.encounters, 'enc_corridor_husks').when).toEqual({ flag: 'flag_horde_active' });
    expect(byId(corridor.encounters, 'enc_corridor_tide').when).toEqual({ all: [{ flag: 'flag_horde_active' }, { counter: { name: 'horde_moves', min: 15 } }] });
    // WORLD §12.2: the Tide after move 14; husks ×2
    expect(WORLD).toContain('tide: { at: "loc_darkened_corridor", afterMoves: 14 }');
    expect(byId(corridor.encounters, 'enc_corridor_husks').groups).toEqual([{ creatureId: 'cr_horde_husk', count: 2 }]);
    // the Horde encounters come before the legacy Shade, so an infected Corridor fights the Horde
    expect(corridor.encounters.map((e) => e.id)).toEqual(['enc_corridor_tide', 'enc_corridor_husks', 'enc_corridor_shade']);
  });

  test('events: every WORLD event, its text verbatim, legacy ids with the ev_ prefix; once unless WORLD repeats it', () => {
    // U54 added the carrel's scene opener to the Sunken Archives (STORY §13 scene_the_first_drowned; its own test holds it);
    // U58 the carrel approached without drawing (`q_the_first_drowned`) and the Depths' count (`q_the_thirtieth_dawn`), both interacts
    const U54_EVENTS = ['ev_archives_first_drowned'];
    const U58_EVENTS = ['ev_archives_oriel_carrel', 'ev_depths_count_beats'];
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const got = Object.fromEntries(l.events.filter((e) => !U54_EVENTS.includes(e.id) && !U58_EVENTS.includes(e.id)).map((e) => [e.id, e.text]));
      const expected = Object.fromEntries(Object.entries(w?.events ?? {}).map(([id, text]) => [id.startsWith('ev_') ? id : `ev_${id}`, text]));
      expect([l.id, got]).toEqual([l.id, expected]);
      for (const e of l.events) {
        expect([e.id, e.trigger]).toEqual([e.id, U58_EVENTS.includes(e.id) ? 'interact' : 'enter']);
        expect([e.id, e.once]).toEqual([e.id, e.id !== 'ev_depths_choice' && !U54_EVENTS.includes(e.id) && !U58_EVENTS.includes(e.id)]);
      }
    }
    // the Heartstone prompt opens STORY's choice scene while the quest is open
    expect(byId(byId(parsedLocations, 'loc_heartstone_depths').events, 'ev_depths_choice')).toMatchObject({
      when: { quest: { id: 'q_echoing_heartbeat', status: 'active' } },
      effects: [{ startDialogue: 'scene_heartstone_choice' }],
    });
    // the thirtieth dawn: the last dusk before the limit, however the limit moved
    expect(byId(byId(parsedLocations, 'loc_whispering_ruins').events, 'ev_ruins_thirtieth').when).toEqual({ all: [{ watch: 'dusk' }, { clock: { daysLeft: { max: 0 } } }] });
  });

  test('NPC placement: WORLD’s first NPC of each block is placed here; the others are runtime moves', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const first = w?.npcIds[0];
      if (first === undefined) expect([l.id, l.npcs]).toEqual([l.id, []]);
      else {
        expect([l.id, l.npcs[0]]).toEqual([l.id, first]);
        for (const n of l.npcs) expect(w?.npcIds).toContain(n);
      }
    }
    for (const n of npcs) expect(byId(parsedLocations, n.homeLocationId).npcs).toContain(n.id);
  });

  test('art: WORLD’s horizon per block; the Library and the Depths carry their state variants', () => {
    for (const l of parsedLocations) expect([l.id, l.art.horizon]).toEqual([l.id, WL[l.id]?.horizon]);
    expect(byId(parsedLocations, 'loc_shattered_library').art.variants.map((v) => v.when)).toEqual([{ flag: 'flag_library_portal_open' }]);
    expect(byId(parsedLocations, 'loc_heartstone_depths').art.variants.map((v) => v.when)).toEqual([
      { flag: 'flag_heartstone_stabilized' },
      { flag: 'flag_heartstone_exploited' },
      { flag: 'flag_heartstone_destroyed' },
    ]);
  });

  test('state texts (WORLD §3.1, §12.1): the Library’s portal and scar descriptions, the Depths’ three Heartstone states', () => {
    const library = byId(parsedLocations, 'loc_shattered_library');
    expect(library.descriptionVariants).toHaveLength(3);
    expect(library.descriptionVariants[0]?.text).toContain('Ilyra stands before it, her hands glowing with an intense, straining light');
    const alone = /\*\*Portal state \(Horde, Ilyra not yet arrived\):\*\* base description \+ "([^"]+)"/.exec(WL['loc_shattered_library']?.block ?? '')?.[1] ?? 'missing';
    const scar = /\*\*Portal scar \(Loop 2\+, no Horde\):\*\* base description \+ "([^"]+)"/.exec(WL['loc_shattered_library']?.block ?? '')?.[1] ?? 'missing';
    expect(library.descriptionVariants[1]?.text).toBe(`${WL['loc_shattered_library']?.legacyDescription} ${alone}`);
    expect(library.descriptionVariants[2]?.text).toBe(`${WL['loc_shattered_library']?.legacyDescription} ${scar}`);
    const depths = byId(parsedLocations, 'loc_heartstone_depths');
    const states = [...(WL['loc_heartstone_depths']?.block.matchAll(/\*(stabilized|exploited|destroyed)\* — "([^"]+)"/g) ?? [])];
    expect(states).toHaveLength(3);
    for (const [i, m] of states.entries()) {
      expect(depths.descriptionVariants[i]?.when).toEqual({ flag: `flag_heartstone_${m[1]}` });
      expect(depths.descriptionVariants[i]?.text).toBe(`${depths.description} ${m[2]}`);
    }
  });

  test('Appendix A: the seven legacy ids carry their legacy names and region', () => {
    const appendix = appendixLegacyLocations();
    for (const l of locations) expect([l.id, l.legacyName, l.regionId]).toEqual([l.id, appendix[l.id]?.name, appendix[l.id]?.region]);
  });
});

// ---- Map data (WORLD §11) -------------------------------------------------------------------------------------------------------

describe('WORLD §11 map data', () => {
  test('§11.1 nodes: coordinates, band, rest, merchant, temporallyUnstable', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable]);
      const rest = l.rest === undefined ? '—' : l.rest.when === undefined ? l.rest.kind : 'cond';
      expect([l.id, rest, l.merchantId ?? '—']).toEqual([l.id, n?.rest, n?.merchant]);
    }
  });

  test('§11.2 edges: every walk edge out of the Ruins exists with its direction and cost; reverse exits inside the region match', () => {
    const inRuins = new Set<string>(locations.map((l) => l.id));
    const walks = EDGES.filter((e) => e.kind === 'walk' && (inRuins.has(e.from) || inRuins.has(e.to)));
    expect(walks.length).toBeGreaterThanOrEqual(12);
    for (const e of walks) {
      if (inRuins.has(e.from)) {
        const exit = byId(parsedLocations, e.from).exits.find((x) => x.to === e.to);
        expect([e.from, e.to, exit?.dir, exit?.travelWatches, exit?.when !== undefined]).toEqual([e.from, e.to, e.dir, e.cost, e.gate !== 'open']);
      }
      if (inRuins.has(e.to)) {
        const back = byId(parsedLocations, e.to).exits.find((x) => x.to === e.from);
        expect([e.to, e.from, back?.dir, back?.travelWatches, back?.when !== undefined]).toEqual([e.to, e.from, e.reverseDir, e.reverseCost, e.reverseGate !== 'open']);
      }
    }
  });

  test('§11.3 gates: the Depths descent and the Cistern crack carry WORLD’s conditions', () => {
    const gates = section(WORLD, '### 11.3 Gate conditions', '### 11.4');
    expect(gates).toContain('`gate_depths_descent`');
    expect(byId(parsedLocations, 'loc_sunken_archives').exits.find((x) => x.to === 'loc_heartstone_depths')?.when).toEqual({
      any: [{ quest: { id: 'q_echoing_heartbeat' } }, { echo: 'echo_heartstone_path' }],
    });
    expect(gates).toContain('`gate_cistern_crack_in`');
    expect(byId(parsedLocations, 'loc_heartstone_depths').exits.find((x) => x.to === 'loc_cistern_of_names')?.when).toEqual({
      all: [{ item: { id: 'item_glyphbound_lantern' } }, { any: [{ item: { id: 'item_cistern_key' } }, { flag: 'flag_heartstone_destroyed' }, { echo: 'echo_archive_door' }] }],
    });
  });

  test('reachability: all seven locations from loc_whispering_ruins inside the region, in Loop 1 terms (the one gate is a quest)', () => {
    const inRuins = new Map<string, Location>(parsedLocations.map((l) => [l.id, l]));
    const seen = new Set<string>(['loc_whispering_ruins']);
    const queue = ['loc_whispering_ruins'];
    for (let i = 0; i < queue.length; i++) {
      for (const exit of inRuins.get(queue[i] ?? '')?.exits ?? []) {
        if (!inRuins.has(exit.to) || seen.has(exit.to)) continue;
        // Loop 1: no Echoes; a quest condition is satisfiable
        if (exit.when !== undefined && JSON.stringify(exit.when).includes('"echo"') && !JSON.stringify(exit.when).includes('"quest"')) continue;
        seen.add(exit.to);
        queue.push(exit.to);
      }
    }
    expect([...seen].sort()).toEqual(locations.map((l) => l.id).sort());
    expect(gameConfig.startLocationId).toBe('loc_whispering_ruins');
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6', () => {
  test('exactly the creatures whose first region is the Ruins (D-090), with WORLD’s name, family, role, level and XP', () => {
    const mine = Object.values(CREATURE_TABLE).filter((r) => /^(Silverwood Ruins|Horde: loc_darkened_corridor)/.test(r.regions)).map((r) => r.id);
    expect(creatures.map((c) => c.id).sort()).toEqual(mine.sort());
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, c.name.replace(/^The /, ''), c.family, c.role, c.level, c.xp]).toEqual([c.id, row?.name.replace(/^The /, ''), row?.family, row?.role, row?.level, row?.xp]);
    }
    // the Horde Husk has no first region and is only referenced
    expect(creatures.map((c) => c.id as string)).not.toContain('cr_horde_husk');
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK (WORLD: ATK doubles as SP)', () => {
    for (const c of creatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
  });

  test('resistances and immunities as WORLD’s Resist line', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      const weak = Object.entries(c.resistances).filter(([, r]) => r === 'weak').map(([t]) => t).sort();
      const resist = Object.entries(c.resistances).filter(([, r]) => r === 'resist').map(([t]) => t).sort();
      expect([c.id, weak, resist]).toEqual([c.id, [...w.weak].sort(), [...w.resist].sort()]);
      for (const status of w.immune) expect([c.id, c.statusImmunities.includes(`status_${status}`)]).toEqual([c.id, true]);
    }
  });

  test('moves: every WORLD intent id with its telegraph line verbatim; every move used by a pattern; telegraphs ≤ 12 words', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      for (const [id, line] of Object.entries(w.intents)) expect([c.id, id, c.moves[id]?.line]).toEqual([c.id, id, line]);
      const used = new Set<string>();
      const visit = (s: Step) => {
        if ('move' in s) used.add(s.move);
      };
      walkSteps(c.pattern, [], visit);
      for (const ph of c.phases) walkSteps(ph.pattern, [], visit);
      for (const m of Object.values(c.moves)) if (m.windUp) used.add(m.windUp.then);
      expect([c.id, Object.keys(c.moves).filter((id) => !used.has(id))]).toEqual([c.id, []]);
      for (const m of Object.values(c.moves)) expect(m.line.split(/\s+/).length).toBeLessThanOrEqual(12);
    }
  });

  test('loot: gold ranges and every item WORLD lists (the anomalies’ guaranteed material at 100 %)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      const lootIds = new Set<string>(c.loot.map((l) => l.itemId));
      for (const id of w.lootIds) expect([c.id, id, lootIds.has(id)]).toEqual([c.id, id, true]);
    }
    expect(byId(parsedCreatures, 'cr_paradox_wisp').loot.find((l) => l.itemId === 'mat_ley_spark')?.chance).toBe(1);
    expect(byId(parsedCreatures, 'cr_redundant_wayfinder').loot.find((l) => l.itemId === 'mat_frayed_moment')).toMatchObject({ chance: 1, count: 2 });
    // the Shade's Spellbook (D-055, PLAN §5.4): 100 % until the flag, then 50 %
    const shade = byId(parsedCreatures, 'cr_corrupted_shade');
    expect(shade.loot.filter((l) => l.itemId === 'item_dark_spellbook')).toEqual([
      { itemId: 'item_dark_spellbook', chance: 1, count: 1, when: { not: { flag: 'flag_spellbook_dropped' } } },
      { itemId: 'item_dark_spellbook', chance: 0.5, count: 1, when: { flag: 'flag_spellbook_dropped' } },
    ]);
    expect(shade.onDefeat).toEqual([{ setFlag: 'flag_spellbook_dropped' }]);
  });

  test('legacy descriptions verbatim; bestiary voice as WORLD; family codex entries', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      if (w.legacyDescription !== null) expect([c.id, c.description]).toEqual([c.id, w.legacyDescription]);
      expect([c.id, c.bestiary.voice]).toEqual([c.id, w.voice]);
      expect(c.bestiary.codexId).toBe(`codex_creatures_${c.family.slice('fam_'.length)}`);
      expect(c.bestiary.summary.split(/\s+/).length).toBeGreaterThanOrEqual(40);
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
    }
  });

  test('XP follows DESIGN §6.2: fodder round(20 + 8L + 1.2L²), anomaly ×1.3; the Tide is hand-set', () => {
    const fodder = (L: number) => Math.round(20 + 8 * L + 1.2 * L * L);
    for (const c of creatures) {
      if (c.role === 'fodder') expect([c.id, c.xp]).toEqual([c.id, fodder(c.level)]);
      if (c.role === 'anomaly' && c.id === 'cr_paradox_wisp') expect(c.xp).toBe(Math.round(fodder(c.level) * 1.3));
    }
    // the Redundant Wayfinder has elite stats: ×1.8 then ×1.3 (WORLD 676)
    expect(byId(creatures, 'cr_redundant_wayfinder').xp).toBe(Math.round(fodder(12) * 1.8 * 1.3));
    expect(byId(creatures, 'cr_unraveling_tide').xp).toBe(500);
  });

  test('the Tide (WORLD §6.8): a boss that cannot be fled, three phases on WORLD’s triggers, a 10-round survival win, Stagger allowed', () => {
    const tide = byId(parsedCreatures, 'cr_unraveling_tide');
    expect([tide.role, tide.fleeable, tide.interruptible]).toEqual(['boss', false, true]);
    expect(tide.phases.map((p) => [p.name, p.enterWhen])).toEqual([
      ['The Edge', []],
      ['The Undertow', [{ round: 4 }, { hpBelow: 0.66 }]],
      ['It Passes', [{ round: 8 }, { hpBelow: 0.33 }]],
    ]);
    expect(tide.phases[0]?.onEnter).toEqual([{ surviveRounds: { rounds: 10, line: 'The Tide passes. It had somewhere else to be.' } }]);
    expect(tide.phases[1]?.line).toBe('The Tide pulls back to gather. The corridor walls go with it, then return.');
    expect(tide.phases[2]?.line).toBe('The Tide is thinner here. Through it: the Library, and a violet light.');
    expect(tide.statusImmunities).toEqual(['status_stun', 'status_slow', 'status_poison', 'status_bleed', 'status_burn']);
    expect(tide.moves['tide_take']?.effects).toEqual([{ stripBuffs: { kinds: ['shield', 'regen', 'haste', 'rewind'] } }]);
    expect(tide.moves['tide_shape']?.summon).toEqual({ creatureId: 'cr_horde_husk', count: 1, max: 2, hpPct: 1 });
    expect(tide.moves['tide_rise']).toMatchObject({ hidden: true, windUp: { turns: 1, then: 'tide_fall' } });
    expect(tide.moves['tide_fall']?.power).toEqual({ base: 0, coef: 1.8, stat: 'sp', hits: 1 });
    expect(tide.moves['tide_crest']?.power).toEqual({ base: 0, coef: 1.6, stat: 'sp', hits: 1 });
  });

  test('the Redundant Wayfinder mirrors the class in data where the schema allows: per-class statuses and starter-weapon drops; leaves on round 3 untouched', () => {
    const r = byId(parsedCreatures, 'cr_redundant_wayfinder');
    const classes = r.moves['redundant_your_move']?.statuses.map((s) => JSON.stringify(s.when));
    expect(classes).toEqual(['ranger', 'wizard', 'elf', 'ironclad_warden', 'shadow_weaver'].map((c) => JSON.stringify({ class: c })));
    expect(r.loot.filter((l) => l.chance === 0.3).map((l) => l.itemId)).toEqual(['item_rusty_dagger', 'item_apprentice_staff', 'item_primitive_bow', 'item_nomads_maul', 'item_cracked_void_focus']);
    expect(r.moves['redundant_leave']?.leaveCombat).toBe(true);
    expect(r.moves['redundant_your_guard']?.special).toBe('guard');
    expect(r.pattern[1]).toEqual({ move: 'redundant_leave', target: 'self', when: { all: [{ roundAtLeast: 3 }, { not: { hpBelow: 1 } }] } });
  });

  test('the Archivist turns her back first only at the Sunken Archives during q_lost_scroll (D-046)', () => {
    const a = byId(parsedCreatures, 'cr_drowned_archivist');
    expect(a.pattern[0]).toEqual({
      move: 'first_drowned_turns',
      target: 'self',
      when: { all: [{ first: true }, { location: 'loc_sunken_archives' }, { quest: { id: 'q_lost_scroll', status: 'active' } }] },
    });
    expect(a.tags).toContain('drowned');
  });
});

// ---- The NPCs -----------------------------------------------------------------------------------------------------------------

describe('the NPCs vs WORLD §4', () => {
  const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
  const rows = Object.fromEntries(tableRows(S4).filter((c) => unquote(c[0] ?? '').startsWith('npc_')).map((c) => [unquote(c[0] ?? ''), c]));
  /** The row's Location cell without the merchant mark-up: `**stall: loc_x** (…)` → `loc_x (…)`. */
  const home = (c: string[]): string => (c[3] ?? '').replace(/\*\*stall: /, '').replace(/\*\*/g, '');

  test('exactly the NPCs whose home is in the Ruins: Ilyra, Tamsin Reed, Ansel Dray', () => {
    const homes = Object.values(rows).filter((c) => /^loc_(whispering_ruins|crumbling_archway|darkened_corridor|shattered_library|silverwood_plaza|sunken_archives|heartstone_depths)\b/.test(home(c)));
    expect(npcs.map((n) => n.id).sort()).toEqual(homes.map((c) => unquote(c[0] ?? '')).sort());
  });

  test('names, factions, home locations and sample lines as WORLD’s row; Ilyra points at her companion record', () => {
    for (const n of npcs) {
      const row = rows[n.id];
      expect(row, n.id).toBeDefined();
      expect([n.id, n.name]).toEqual([n.id, row?.[1]]);
      expect(row?.[2]).toBe(n.factionId);
      expect([n.id, home(row ?? []).startsWith(n.homeLocationId)]).toEqual([n.id, true]);
      for (const b of n.barks ?? []) expect([n.id, (row?.[6] ?? '').includes(`"${b.text}"`)]).toEqual([n.id, true]);
    }
    expect(byId(npcs, 'npc_ilyra')).toMatchObject({ companionId: 'ilyra', legacyName: 'Ilyra', roles: ['companion', 'questgiver'] });
    // (no asymmetric matchers inside toMatchObject: bun 1.4.2 mutates the received record)
    expect(byId(npcs, 'npc_tamsin_reed').merchantId).toBe('npc_tamsin_reed');
    expect(byId(npcs, 'npc_tamsin_reed').roles).toContain('merchant');
    expect(byId(npcs, 'npc_ansel_dray').roles).toContain('questgiver');
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the real pack with the Ruins registered (D-090)', () => {
  // The Ruins are the first folder; later regions follow them (U43 onward), so the pins are on this folder's own records.
  test('builds; the region barrel starts with this folder; `contentTables` holds the region tables', () => {
    expect(REGION_FOLDERS[0]?.region).toEqual(region);
    expect(Object.keys(pack.regions)[0]).toBe(REGION);
    expect(Object.keys(pack.locations).slice(0, locations.length)).toEqual(locations.map((l) => l.id));
    expect(Object.keys(pack.creatures).slice(0, creatures.length)).toEqual(creatures.map((c) => c.id));
    expect(Object.keys(pack.npcs).slice(0, npcs.length)).toEqual(npcs.map((n) => n.id));
    expect(contentTables.regions[0]).toEqual(region);
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    expect(pack.index.startLocationId).toBe('loc_whispering_ruins');
  });

  test('validates with 0 errors; pending references name only tables still being authored; the real warnings about the Ruins are the known ones (five until the Before lands, then four)', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const pending = report.warnings.filter((w) => w.message.startsWith('pending — content not yet authored (reference): '));
    expect(pending.length).toBeGreaterThan(50);
    for (const w of pending) {
      const table = /not found in ([a-z]+)$/.exec(w.message)?.[1];
      expect([w.message, INCOMPLETE_TABLES.includes(table as (typeof INCOMPLETE_TABLES)[number])]).toEqual([w.message, true]);
    }
    // the Ruins' own: warnings on its locations, and placement warnings (rule 11) naming one of them
    const ruins = locations.map((l) => l.id as string);
    const aboutRuins = (w: (typeof report.warnings)[number]): boolean =>
      (w.table === 'locations' && ruins.includes(w.id)) || (w.rule === 'rule-11' && ruins.some((id) => w.message.includes(` ${id}`)));
    const real = report.warnings.filter((w) => !w.message.startsWith('pending — content not yet authored') && aboutRuins(w));
    // order-agnostic (U48b): the Plaza's `flag_visited_before` is set by Silverwood Before's entry events, so it warns only
    // until that region has landed
    const beforeLanded = pack.regions['region_silverwood_before'] !== undefined;
    // likewise the Depths' three Heartstone flags, which the Heartstone choice sets (U52: scene_heartstone_choice)
    const heartstoneLanded = pack.dialogues['scene_heartstone_choice'] !== undefined;
    expect(real.map((w) => `${w.rule} ${w.id} ${w.path}`).sort()).toEqual(
      [
        // flags later content units set (the Heartstone choice, the Before); the engine's own (Horde, portal, Anchors) are
        // ENGINE_WRITTEN_FLAGS and raise nothing
        ...(beforeLanded ? [] : ['rule-02 loc_silverwood_plaza events.1.when.flag']),
        ...(heartstoneLanded
          ? []
          : [
              'rule-02 loc_heartstone_depths descriptionVariants.0.when.flag',
              'rule-02 loc_heartstone_depths descriptionVariants.1.when.flag',
              'rule-02 loc_heartstone_depths descriptionVariants.2.when.flag',
            ]),
        // WORLD's deliberate out-of-band placements (D-091 gap 6): the exploited Depths' Hourglass Crawlers. D-098 (U34d) left
        // out of rule 11 the Loop 4+ anomaly at the start, the Horde boss and the Horde Husks in the Corridor
        'rule-11 cr_hourglass_crawler level',
      ].sort(),
    );
  });

  test('`npm run validate`: exit 0, 0 errors, the pending references listed', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    const text = out.join('\n');
    // the counts grow as region units land (the Ruins' own records are pinned above)
    expect(text).toMatch(/ regions [1-9]\d* · locations [1-9]\d* · creatures [1-9]\d* · /);
    expect(text).toMatch(/ npcs [1-9]\d* · /);
    expect(text).toMatch(/pending rule-01: \d+ reference\(s\) into tables still being authored/);
    expect(text).toMatch(/validate: ok — 0 errors, \d+ warning\(s\), \d+ pending completeness check\(s\), \d+ pending reference\(s\)/);
  });

  test('the Ruins’ pending references name only ids WORLD/STORY spell (other regions’ locations, items, quests, Echoes, a scene, the Husk, merchants, codex entries); the Mistwood Path now resolves', () => {
    const { report } = parseContentPack(contentTables);
    const ruins = new Set<string>([REGION, ...locations.map((l) => l.id), ...creatures.map((c) => c.id), ...npcs.map((n) => n.id)]);
    const targets = new Set(
      report.warnings.filter((w) => w.message.includes('(reference)') && ruins.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message),
    );
    // Later units resolve these one by one (regions U43–U48, items U49/U50, quests U52–U59): the list may only shrink
    const known = new Set([
      'loc_chasm_of_whispers', 'loc_drowned_stair', 'loc_shimmering_pass', 'loc_cistern_of_names',
      'item_remnant_wax_seal', 'item_echo_crystal', 'item_korrs_marginalia', 'item_bell_shard', 'item_glyphbound_lantern', 'item_cistern_key',
      'item_scholars_lost_scroll', 'item_travelers_sword', 'item_necromancer_staff', 'item_chronal_dust',
      'mat_shadow_ash', 'mat_wildling_hide', 'mat_ley_resin', 'mat_sodden_vellum', 'mat_ley_spark', 'mat_frayed_moment',
      'cr_horde_husk', 'cr_hourglass_crawler', 'cr_unmade',
      'q_echoing_heartbeat', 'q_lost_scroll',
      'q_echo_crystal', // D-098: the alcove's skipped search waits while the Crystal's quest is not done
      'echo_heartstone_path', 'echo_nine_voices', 'echo_crystal_location', 'echo_archive_door', 'echo_oriel_drowned',
      'scene_heartstone_choice',
      'ilyra', // the companion record (D-088: registered by U56)
      'npc_tamsin_reed', // the merchant record (WORLD §9)
      'remnants', // the faction record (region.factionId)
      'codex_region_silverwood_ruins', 'codex_creatures_hollowed', 'codex_creatures_wilds', 'codex_creatures_drowned', 'codex_creatures_spireborn', 'codex_creatures_unravelled',
    ]);
    expect([...targets].filter((t) => !known.has(t))).toEqual([]);
    expect(targets.has('loc_mistwood_path')).toBe(false); // the east exit and the Plaza's south exit resolve (U43)
    expect(targets.size).toBeGreaterThan(0);
  });

  test('a new game opens at the Whispering Ruins: the Amulet on the ground, Ilyra present, the hum, three ways out; the Glyphbound Lantern at the Sunken Archives resolves since U49 (no dangling-item error)', () => {
    const profile = freshProfile();
    const title: GameState = { ...newRun('u42', 'ranger', pack, profile), mode: 'title' };
    const started = step(title, { type: 'newGame', name: 'Wayfinder', classId: 'ranger' }, pack, profile);
    const s = started.state;
    expect(s.world.currentLocationId).toBe('loc_whispering_ruins');
    const here = s.world.locationStates['loc_whispering_ruins'];
    expect(here?.items.map((i) => i.itemId)).toEqual(['item_amulet_of_echoes']);
    expect(here?.eventsFired).toContain('ev_ruins_echo');
    expect(pack.locations['loc_whispering_ruins']?.npcs).toEqual(['npc_ilyra']);
    const moves = legalActions(s, pack, started.profile).filter((a) => a.type === 'move').map((a) => (a as { to: string }).to).sort();
    expect(moves).toEqual(['loc_crumbling_archway', 'loc_mistwood_path', 'loc_sunken_archives']);
    // inside the region: north to the Archway (its first-visit Prowler rolls at 40 %)
    const north = step(s, { type: 'move', to: 'loc_crumbling_archway' }, pack, started.profile);
    expect(north.state.world.currentLocationId).toBe('loc_crumbling_archway');
    expect(north.state.world.locationStates['loc_crumbling_archway']?.eventsFired).toContain('ev_archway_whisper');
    // east is the Mistwood Path (U43): the exit resolves and the step is taken
    expect(step(s, { type: 'move', to: 'loc_mistwood_path' }, pack, started.profile).state.world.currentLocationId).toBe('loc_mistwood_path');
    // south is the Sunken Archives, whose placed Glyphbound Lantern is authored since U49 (it threw "unknown item" while the item did not exist, D-090)
    const south = step(s, { type: 'move', to: 'loc_sunken_archives' }, pack, started.profile);
    expect(south.state.world.currentLocationId).toBe('loc_sunken_archives');
    expect(south.state.world.locationStates['loc_sunken_archives']?.items.map((i) => i.itemId)).toContain('item_glyphbound_lantern');
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U42 reply -----------------------------------------

describe('authored words outside the documents are few and short', () => {
  test('encounter intros, the two rest texts and the three non-legacy creature descriptions are ≤ 30 words; coined ids are the listed ones', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro)).filter((t): t is string => t !== undefined);
    expect(intros.length).toBeGreaterThan(0);
    for (const t of intros) expect(t.split(/\s+/).length).toBeLessThanOrEqual(30);
    for (const l of parsedLocations) if (l.rest?.text) expect(l.rest.text.split(/\s+/).length).toBeLessThanOrEqual(30);
    for (const c of parsedCreatures) if (worldCreature(c.id).legacyDescription === null) expect(c.description.split(/\s+/).length).toBeLessThanOrEqual(30);
    // ids this unit coined (WORLD has none): the Tide's phase ids and its wind-up payoff move, the Horde-moves counter
    const tide = byId(parsedCreatures, 'cr_unraveling_tide');
    expect(tide.phases.map((p) => p.id)).toEqual(['tide_the_edge', 'tide_the_undertow', 'tide_it_passes']);
    expect(Object.keys(tide.moves).filter((id) => !(id in worldCreature('cr_unraveling_tide').intents))).toEqual(['tide_fall']);
    expect(ids(JSON.stringify(locations), 'horde')).toEqual(['horde_moves', 'horde_tide']); // the Horde-moves counter and a tag
  });
});
