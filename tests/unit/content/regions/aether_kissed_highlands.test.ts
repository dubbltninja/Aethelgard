// U44: The Aether-Kissed Highlands — checked against the documents at test time, U42's pattern (regions/silverwood_ruins.test.ts):
// WORLD §2.4, §3.4, §4, §6, §10.1, §10.3, §11.1–11.3, §12.1, §12.3; DESIGN §6.5, §8.2, §10.5, §17.1, §18.2; STORY §14; PLAN
// Appendix A. The legacy text is checked against the Python sources here and in legacy.test.ts. Patterns are walked turn by turn
// by the engine (`generateIntent`), so every WORLD cadence word is held to what the game does. Where a record departs from the
// letter of WORLD (a reading the schema or the engine forces), the test pins the departure so a later edit cannot move it
// silently. The Highlands are the Apex road's missing middle: the last test group proves the Glowlands, the Nexus and the Apex are
// reachable from loc_whispering_ruins now.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures } from '@content/regions/aether_kissed_highlands/creatures';
import { items } from '@content/regions/aether_kissed_highlands/items';
import { locations } from '@content/regions/aether_kissed_highlands/locations';
import { npcs } from '@content/regions/aether_kissed_highlands/npcs';
import { region } from '@content/regions/aether_kissed_highlands/region';
import { companions } from '@content/shared/companions';
import { validateContent } from '@content/validate';
import { beginCombat, evaluate, generateIntent, legalActions, step, type CombatState, type Combatant, type EncounterSpec, type GameState } from '@engine/index';
import { npcsAt } from '@engine/reducers/explore';
import type { Condition } from '@schema/condition';
import { CreatureSchema, walkSteps, type Creature, type Step } from '@schema/creature';
import { LocationSchema, type Location } from '@schema/location';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { main as validateCli } from '../../../../tools/validate-content';
import { PLAN, WORLD, appendixLegacyLocations, section, tableRows, unquote, worldCreature, worldCreatureTable, worldEdges, worldLocations, worldNodes } from './worldDoc';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');

const REGION = 'region_aether_kissed_highlands';
const WR = 'loc_whispering_ruins';
const DEPTHS = 'loc_heartstone_depths';
const PASS = 'loc_shimmering_pass';
const SPIRES = 'loc_aetherium_spires';
const PLATEAU = 'loc_sky_whisper_plateau';
const GLOWLANDS = 'loc_veridian_glowlands';
const NEXUS = 'loc_chronos_nexus';
const APEX = 'loc_temporal_breach_apex';
const OUTPOST = 'loc_blighted_outpost';
const PHANTOM = 'cr_shimmering_phantom';
const MOTH = 'cr_moment_moth';
const MOTE = 'cr_glass_mote';
const WEAVER = 'cr_aetherial_weaver';
const SENTINEL = 'cr_sky_whisper_sentinel';
const HARRIER = 'cr_steppe_harrier';
const TALISMAN = 'item_sky_whisper_talisman';

const S34 = section(WORLD, '### 3.4 Aether-Kissed Highlands', '### 3.5');
const WL = Object.fromEntries(worldLocations(S34).map((l) => [l.id, l]));
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
const playText = (s: string): string => flat(s).replace(/[`*]/g, '').replace(/ \(D-\d+(?:\.\d+)?\)/g, '');
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
  return flat((end < 0 ? rest : rest.slice(0, end)).replace(/^- \*\*[^*]+\*\*\s*(\([^)]*\))?:?\s*/, '')).replace(/\s*---$/, '');
}
/** WORLD's condition notation (`{any:[{item:"x"},{echo:"y"}]}`, unquoted keys) as the schema's data: `{item:"x"}` is `{item:{id:"x"}}`. */
function worldCondition(text: string): Condition {
  const json = text.replace(/([{,])([a-zA-Z_]+):/g, '$1"$2":');
  const fix = (c: unknown): unknown => {
    if (Array.isArray(c)) return c.map(fix);
    if (typeof c !== 'object' || c === null) return c;
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, k === 'item' && typeof v === 'string' ? { id: v } : fix(v)]));
  };
  return fix(JSON.parse(json)) as Condition;
}

// ---- Engine helpers -----------------------------------------------------------------------------------------------------------

interface At {
  seed?: string;
  loop?: number;
  flags?: Record<string, boolean>;
  /** Echoes granted this loop (the pack has no echo records yet, so they are set directly). */
  echoes?: string[];
  /** Items carried (the pack has no item records yet, so they are set directly). */
  carrying?: string[];
  /**
   * Location states the player has already stood in: id → what is cleared / scattered there. `first` marks a first visit still to
   * come (the items of the pack's unauthored item tables are not spawned either way: U49/U50's).
   */
  stood?: Record<string, { cleared?: string[]; scattered?: string[]; first?: true }>;
}

const locationState = (o: { cleared?: string[]; scattered?: string[]; first?: true }): GameState['world']['locationStates'][string] => ({
  visited: o.first !== true, visitCount: o.first === true ? 0 : 1, items: [], itemsSpawned: true, encountersCleared: o.cleared ?? [], encounterClearedDay: {}, eventsFired: [],
  flags: {}, unlockedExits: [], lockedExits: [], scattered: o.scattered ?? [], encounterHp: {},
});

function stateAt(locationId: string, o: At = {}): GameState {
  return makeState(
    {
      locationId,
      seed: o.seed ?? 'u44',
      ...(o.loop === undefined ? {} : { loop: o.loop }),
      flags: o.flags ?? {},
      patch: (s) => {
        for (const id of o.echoes ?? []) s.echoesThisLoop.push(id);
        for (const id of o.carrying ?? []) s.player.inventory.push({ uid: `i${s.meta.nextUid++}`, itemId: id, qty: 1, rarity: 'common', affixes: [] });
        for (const [id, st] of Object.entries(o.stood ?? {})) s.world.locationStates[id] = locationState(st);
      },
    },
    { content: pack },
  );
}
const profileOf = (o: At = {}) => freshProfile({ loopCounter: o.loop ?? 1 });
const holds = (cond: Condition, o: At = {}): boolean => evaluate(cond, stateAt(PLATEAU, o), profileOf(o), pack);
const arrive = (from: string, to: string, o: At = {}): GameState => step(stateAt(from, o), { type: 'move', to }, pack, profileOf(o)).state;
const movesFrom = (locationId: string, o: At = {}): string[] =>
  legalActions(stateAt(locationId, o), pack, profileOf(o))
    .filter((a) => a.type === 'move')
    .map((a) => (a as { to: string }).to)
    .sort();
/** What a walk onto `to` starts: the encounter id and the enemies' creature ids ('' / [] for none). */
function fight(from: string, to: string, o: At = {}): { id: string; enemies: string[]; canFlee: boolean | undefined } {
  const s = arrive(from, to, o);
  return { id: s.combat?.encounterId ?? '', enemies: s.combat?.enemies.map((e) => e.refId) ?? [], canFlee: s.combat?.canFlee };
}
/** Tally the encounters of `n` seeded return walks onto `to`. */
function tally(from: string, to: string, n: number, o: At): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const id = fight(from, to, { ...o, seed: `u44-${i}` }).id || 'none';
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}
const share = (t: Record<string, number>, id: string, n: number): number => (t[id] ?? 0) / n;

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_aether_kissed_highlands vs WORLD §2.4, §10.1 and DESIGN §6.5, §17.1, §18.2', () => {
  const S24 = section(WORLD, '### 2.4 `region_aether_kissed_highlands`', '### 2.5');

  test('id, name, legacy (Appendix A.1), no faction, the band, WORLD’s theme text, order, codex entry', () => {
    expect(region.id).toBe(REGION);
    expect(S24).toContain(`### 2.4 \`${REGION}\` — ${region.name}`);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | yes |`);
    expect(region.legacy).toBe(true);
    expect(S24).toContain('| Factions | None hold it.');
    expect('factionId' in region).toBe(false);
    expect(S24).toContain('| Level band | 6–10 |');
    expect(region.levelBand).toEqual({ min: 6, max: 10 });
    expect(tableRows(section(DESIGN, '### 6.5', '### 6.6')).find((c) => c[0] === 'Aether-Kissed Highlands')?.slice(1, 3)).toEqual([`\`${REGION}\``, '6–10']);
    // WORLD's theme with its decision references (D-013, D-024, D-015) dropped, as the creature files drop them
    expect(playText(/\*\*Theme\.\*\*([\s\S]*?)\n\n/.exec(S24)?.[1] ?? '')).toBe(region.description);
    expect(region.order).toBe(4);
    expect(region.codexId).toBe('codex_region_highlands');
    expect(STORY).toContain('| `codex_region_highlands` | The Aether-Kissed Highlands |');
  });

  test('the three locations WORLD lists, in WORLD’s order, all in the region', () => {
    const listed = /\| Locations \(3\) \| ([^|]+) \|/.exec(S24)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual([PASS, SPIRES, PLATEAU]);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of locations) expect(l.regionId).toBe(REGION);
  });

  test('the pool is WORLD §10.1’s pool_aether_kissed_highlands, weight for weight; 20 % return rolls; fodder inside the band ± 2 (rule 11)', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_aether_kissed_highlands');
    expect(row?.[2]).toBe('—');
    const entries = [...(row?.[1] ?? '').matchAll(/(cr_[a-z_]+) (\d+)/g)].map((m) => ({ creatureId: m[1] ?? '', weight: Number(m[2]) }));
    expect(entries.map((e) => e.creatureId)).toEqual([MOTH, PHANTOM, MOTE, HARRIER, WEAVER]);
    expect(region.wanderingPool).toEqual(entries);
    expect(region.returnEncounterChance).toBe(0.2);
    for (const e of region.wanderingPool) {
      const c = pack.creatures[e.creatureId];
      expect([e.creatureId, c?.role, (c?.level ?? 0) >= region.levelBand.min - 2 && (c?.level ?? 0) <= region.levelBand.max + 2]).toEqual([e.creatureId, 'fodder', true]);
    }
  });

  test('palette: DESIGN §17.1’s Highlands row (sky top, sky bottom, mid, accent); the ambient preset', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'Aether-Kissed Highlands');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).some((c) => c[0] === 'Aether-Kissed Highlands')).toBe(true);
    expect(region.ambient).toBe('ambient_aether_kissed_highlands');
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the three locations vs WORLD §3.4 blocks', () => {
  test('names, bands, coordinates and region', () => {
    for (const l of locations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.levelBand, l.map]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map]);
    }
  });

  test('descriptions: the legacy text with WORLD’s `+` sentence appended, character for character', () => {
    for (const l of locations) expect([l.id, l.description]).toEqual([l.id, WL[l.id]?.description]);
  });

  test('exits: every WORLD exit in order, gated ones with a `when`; the two climbs cost 2 watches up and sit behind the Talisman or echo_high_mark', () => {
    for (const l of parsedLocations) {
      const got = l.exits.map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.exits]);
    }
    const climbs = parsedLocations.flatMap((l) => l.exits.filter((e) => e.when !== undefined).map((e) => [l.id, e.dir, e.to, e.travelWatches]));
    expect(climbs).toEqual([
      [SPIRES, 'south', 'loc_spire_crown', 2],
      [PLATEAU, 'south', 'loc_windward_stair', 2],
    ]);
  });

  test('rest points and merchants as WORLD says: the Pass’s cleft and the Plateau’s wind-shelter; none at the Spires', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, w?.rest, w?.merchant]);
    }
    expect([loc(PASS).rest?.kind, loc(SPIRES).rest, loc(PLATEAU).rest?.kind]).toEqual(['camp', undefined, 'camp']);
    expect(WL[PASS]?.block).toContain("(Dask's hollow, a cleft that is always the same temperature)");
    expect(WL[PLATEAU]?.block).toContain('(a wind-shelter among the markers)');
  });

  test('every item WORLD places is placed, with WORLD’s conditions; the Pass’s Frayed Moment and the Spires’ second shard are the two readings', () => {
    for (const l of parsedLocations) {
      expect([l.id, [...new Set(l.items.map((i) => i.itemId))].sort()]).toEqual([l.id, [...new Set(WL[l.id]?.itemIds ?? [])].sort()]);
    }
    const item = (o: object) => ({ count: 1, hidden: false, once: true, chance: 1, onTake: [], ...o }); // U34d's defaults
    expect(loc(PASS).items).toEqual([
      item({ itemId: 'item_chronal_dust' }),
      // "mat_frayed_moment ×1 (50% after killing cr_shimmering_phantom)": hidden for the examine after the kill (as U43's Peaks),
      // at its own 50 % (D-098, U34d; was 100 %, D-091 gap 1)
      item({ itemId: 'mat_frayed_moment', hidden: true, chance: 0.5, when: { killed: { id: PHANTOM } } }),
    ]);
    expect(loc(SPIRES).items).toEqual([
      item({ itemId: 'item_aetherium_shard' }),
      // "a second shard appears here with flag_heartstone_stabilized": D-098 an entry appears at the first arrival its condition holds
      item({ itemId: 'item_aetherium_shard', when: { flag: 'flag_heartstone_stabilized' } }),
    ]);
    expect(loc(PLATEAU).items).toEqual([item({ itemId: TALISMAN })]);
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa', () => {
    for (const l of parsedLocations) {
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      expect([l.id, [...got].sort()]).toEqual([l.id, [...(WL[l.id]?.creatureIds ?? [])].sort()]);
    }
  });

  test('the legacy fixed fights (the Phantom, the Weaver, the Sentinel): 100 %, once, on the first visit, `scatter` (WORLD §10.5)', () => {
    for (const [l, id, creature] of [
      [PASS, 'enc_pass_phantom', PHANTOM],
      [SPIRES, 'enc_spires_weaver', WEAVER],
      [PLATEAU, 'enc_plateau_sentinel', SENTINEL],
    ] as const) {
      const e = byId(loc(l).encounters, id);
      expect([id, e.groups, e.chance, e.once, e.respawn, e.fleeable, e.onFlee, e.when]).toEqual([id, [{ creatureId: creature, count: 1 }], 1, true, 'never', true, 'scatter', undefined]);
      expect(loc(l).encounters[0]?.id).toBe(id);
    }
    expect(flat(section(WORLD, '### 10.5', '### 10.6'))).toContain('the legacy Apex-road fights (Phantom, Weaver, Sentinel, Mireling, Aberration) are `scatter`');
    // DESIGN §10.5: two of them are passive under an Echo (the Glowlands' optional-fight reading, U43's Golem shortcut)
    expect(DESIGN).toContain('`echo_spire_note` | S: Aetherial Weavers at the Spires are passive on first visit');
    expect(DESIGN).toContain('`echo_high_mark` | S: Sky-Whisper Sentinels passive');
    expect(byId(loc(SPIRES).encounters, 'enc_spires_weaver').optionalWhen).toEqual({ echo: 'echo_spire_note' });
    expect(byId(loc(PLATEAU).encounters, 'enc_plateau_sentinel').optionalWhen).toEqual({ echo: 'echo_high_mark' });
    expect(byId(loc(PASS).encounters, 'enc_pass_phantom').optionalWhen).toBeUndefined();
  });

  test('return rolls at WORLD’s chances: Moths ×3 (30 %), Glass Motes ×2 (30 %), Harriers ×2 (25 %), each then the pool’s 20 %; the Reach from Loop 3 (10 %, once per loop) first', () => {
    const at = (l: string, id: string) => byId(loc(l).encounters, id);
    expect(WL[PASS]?.block).toContain('return: cr_moment_moth ×3 (30%) or pool 20%.');
    expect(at(PASS, 'enc_pass_moths')).toMatchObject({ groups: [{ creatureId: MOTH, count: 3 }], chance: 0.3, respawn: 'on_return', once: false });
    expect(WL[SPIRES]?.block).toContain('return: cr_glass_mote ×2 (30%) or pool 20%. Loop 3+: cr_tyrants_reach ×1 (10%, once per loop).');
    expect(at(SPIRES, 'enc_spires_glass_motes')).toMatchObject({ groups: [{ creatureId: MOTE, count: 2 }], chance: 0.3, respawn: 'on_return', once: false });
    expect(at(SPIRES, 'enc_spires_tyrants_reach')).toMatchObject({ groups: [{ creatureId: 'cr_tyrants_reach', count: 1 }], chance: 0.1, respawn: 'on_return', once: true, when: { loop: { min: 3 } } });
    expect(loc(SPIRES).encounters.map((e) => e.id)).toEqual(['enc_spires_weaver', 'enc_spires_tyrants_reach', 'enc_spires_glass_motes']);
    expect(WL[PLATEAU]?.block).toContain('return: cr_steppe_harrier ×2 (25%) or pool 20%.');
    expect(at(PLATEAU, 'enc_plateau_harriers')).toMatchObject({ groups: [{ creatureId: HARRIER, count: 2 }], chance: 0.25, respawn: 'on_return', once: false });
    expect(loc(PASS).encounters.map((e) => e.id)).toEqual(['enc_pass_phantom', 'enc_pass_moths']);
    expect(loc(PLATEAU).encounters.map((e) => e.id)).toEqual(['enc_plateau_sentinel', 'enc_plateau_harriers']);
    expect(section(WORLD, '### 12.1', '### 12.2')).toContain('cr_tyrants_reach at AS (10%, once a loop)');
  });

  test('events: every WORLD event, its text verbatim, legacy ids with the ev_ prefix, once; WORLD’s conditions', () => {
    for (const l of parsedLocations) {
      const got = Object.fromEntries(l.events.map((e) => [e.id, e.text]));
      const expected = Object.fromEntries(Object.entries(WL[l.id]?.events ?? {}).map(([id, text]) => [id.startsWith('ev_') ? id : `ev_${id}`, text]));
      expect([l.id, got]).toEqual([l.id, expected]);
      for (const e of l.events) expect([e.id, e.trigger, e.once]).toEqual([e.id, 'enter', true]);
    }
    const ev = (l: string, id: string) => byId(loc(l).events, id);
    expect(ev(PASS, 'ev_pass_shimmer').when).toBeUndefined();
    expect(ev(PASS, 'ev_pass_flicker').when).toBeUndefined();
    expect(ev(PASS, 'ev_pass_true_path').when).toEqual({ echo: 'echo_flickering_man' });
    expect(ev(SPIRES, 'ev_spires_hum').when).toBeUndefined();
    expect(ev(SPIRES, 'ev_spires_tuned').when).toEqual({ echo: 'echo_litany_verse_1' });
    expect(ev(PLATEAU, 'ev_plateau_gale').when).toBeUndefined();
    expect(ev(PLATEAU, 'ev_plateau_view').when).toEqual({ loop: { min: 2 } });
    expect(WL[PASS]?.block).toContain('requires `echo_flickering_man`');
    expect(WL[SPIRES]?.block).toContain('requires `echo_litany_verse_1`');
    expect(WL[PLATEAU]?.block).toContain('— once, Loop 2+.');
  });

  test('NPCs: Dask at the Pass, none at the Spires or the Plateau', () => {
    for (const l of parsedLocations) expect([l.id, l.npcs]).toEqual([l.id, WL[l.id]?.npcIds]);
    expect(loc(PASS).npcs).toEqual(['npc_dask']);
  });

  test('art: WORLD’s horizons and the road’s templates; the Spires dim when the Heartstone is destroyed (WORLD §2.4)', () => {
    expect(parsedLocations.map((l) => [l.id, l.art.template, WL[l.id]?.horizon, l.art.horizon])).toEqual([
      [PASS, 'peaks', 0.5, 0.5],
      [SPIRES, 'spires', 0.4, 0.4],
      [PLATEAU, 'sky', 0.35, 0.35],
    ]);
    expect(loc(SPIRES).art.variants).toEqual([{ when: { flag: 'flag_heartstone_destroyed' }, patch: { particles: 'none' } }]);
    expect(section(WORLD, '### 2.4', '### 2.5')).toContain('Heartstone destroyed: the Spires dim');
    expect(parsedLocations.map((l) => l.art.silhouettes)).toEqual([
      ['crystal_rock_walls', 'doubled_path', 'dasks_cleft'],
      ['five_spires', 'basin_rim', 'spiral_stair'],
      ['standing_markers', 'shelf_edge', 'apex_seams'],
    ]);
  });

  test('Appendix A: the three legacy ids carry their legacy names and region', () => {
    const appendix = appendixLegacyLocations();
    for (const l of locations) expect([l.id, l.legacyName, l.regionId]).toEqual([l.id, appendix[l.id]?.name, appendix[l.id]?.region]);
  });
});

// ---- Map data (WORLD §11) -------------------------------------------------------------------------------------------------------

describe('WORLD §11 map data', () => {
  test('§11.1 nodes: coordinates, band, rest, merchant, temporallyUnstable (WORLD §12.3: all three are static)', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable]);
      const rest = l.rest === undefined ? '—' : l.rest.when === undefined ? l.rest.kind : 'cond';
      expect([l.id, rest, l.merchantId ?? '—']).toEqual([l.id, n?.rest, n?.merchant]);
    }
    expect(parsedLocations.map((l) => l.temporallyUnstable)).toEqual([true, true, true]);
    expect(section(WORLD, '### 12.3', '---')).toContain('**Static (24):** loc_shimmering_pass, loc_aetherium_spires, loc_sky_whisper_plateau (Highlands);');
  });

  test('§11.2 edges: every walk edge touching the region with its direction, cost and gate; reverse exits inside the region match', () => {
    const edges = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(edges.map((e) => `${e.from}>${e.to}`)).toEqual([
      `${DEPTHS}>${PASS}`,
      `${OUTPOST}>${PLATEAU}`,
      `${PASS}>${SPIRES}`,
      `${SPIRES}>${PLATEAU}`,
      `${SPIRES}>loc_spire_crown`,
      `${PLATEAU}>${GLOWLANDS}`,
      `${PLATEAU}>loc_windward_stair`,
    ]);
    for (const e of edges) {
      if (here.has(e.from)) {
        const exit = loc(e.from).exits.find((x) => x.to === e.to);
        expect([e.from, e.to, exit?.dir, exit?.travelWatches, exit?.when !== undefined]).toEqual([e.from, e.to, e.dir, e.cost, e.gate !== 'open']);
      }
      if (here.has(e.to)) {
        const back = loc(e.to).exits.find((x) => x.to === e.from);
        expect([e.to, e.from, back?.dir, back?.travelWatches, back?.when !== undefined]).toEqual([e.to, e.from, e.reverseDir, e.reverseCost, e.reverseGate !== 'open']);
      }
    }
  });

  test('§11.3 gates: gate_thin_air is the Talisman or echo_high_mark on both climbs (descents are open, 1 watch)', () => {
    const gates = Object.fromEntries(tableRows(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).map((c) => [unquote(c[0] ?? ''), unquote(c[2] ?? '')]));
    const exit = (from: string, to: string) => loc(from).exits.find((e) => e.to === to)?.when;
    expect(exit(SPIRES, 'loc_spire_crown')).toEqual(worldCondition(gates['gate_thin_air'] ?? ''));
    expect(exit(PLATEAU, 'loc_windward_stair')).toEqual(worldCondition(gates['gate_thin_air'] ?? ''));
    expect(exit(SPIRES, 'loc_spire_crown')).toEqual({ any: [{ item: { id: TALISMAN } }, { echo: 'echo_high_mark' }] });
    // the exits to the Pass, the Spires, the Glowlands and the Outpost are open
    for (const [from, to] of [[PASS, DEPTHS], [PASS, SPIRES], [SPIRES, PASS], [SPIRES, PLATEAU], [PLATEAU, SPIRES], [PLATEAU, GLOWLANDS], [PLATEAU, OUTPOST]] as const) expect([from, to, exit(from, to)]).toEqual([from, to, undefined]);
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6', () => {
  test('exactly the creatures whose first region is the Highlands (D-090); the Tyrant’s Reach, listed there too, is U45’s by D-091', () => {
    const first = Object.values(CREATURE_TABLE).filter((r) => /^Highlands\b/.test(r.regions)).map((r) => r.id);
    expect(first.sort()).toEqual([WEAVER, MOTE, MOTH, PHANTOM, SENTINEL, HARRIER, 'cr_tyrants_reach'].sort());
    expect(CREATURE_TABLE['cr_tyrants_reach']?.regions).toBe('Highlands; Unveiled Tyrant add');
    expect(creatures.map((c) => c.id).sort()).toEqual(first.filter((id) => id !== 'cr_tyrants_reach').sort());
    expect(pack.creatures['cr_tyrants_reach']?.id).toBe('cr_tyrants_reach'); // authored with the Glowlands (it is the Unveiled's add)
    expect(CREATURE_TABLE[HARRIER]?.regions).toBe('Highlands, Ashen Steppe'); // the Steppe unit references it
  });

  test('name, family, role, level and XP as WORLD’s table (DESIGN §6.2: fodder round(20 + 8L + 1.2L²))', () => {
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, row?.name, c.family, c.role, c.level, c.xp]).toEqual([c.id, c.name, row?.family, row?.role, row?.level, row?.xp]);
      expect([c.id, c.xp]).toEqual([c.id, Math.round(20 + 8 * c.level + 1.2 * c.level * c.level)]);
    }
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
  });

  test('resistances and immunities as WORLD’s Resist line; breach-born carry Poison; every construct carries Poison and Bleed (the reading in creatures.ts)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      const weak = Object.entries(c.resistances).filter(([, r]) => r === 'weak').map(([t]) => t).sort();
      const resist = Object.entries(c.resistances).filter(([, r]) => r === 'resist').map(([t]) => t).sort();
      expect([c.id, weak, resist]).toEqual([c.id, [...w.weak].sort(), [...w.resist].sort()]);
      const immune = new Set(w.immune.map((s) => `status_${s}`));
      if (c.tags.includes('construct')) for (const s of ['status_poison', 'status_bleed']) immune.add(s);
      expect([c.id, [...c.statusImmunities].sort()]).toEqual([c.id, [...immune].sort()]);
      if (c.tags.includes('breach_born')) expect(c.statusImmunities).toContain('status_poison');
    }
    // WORLD's Resist line names only Poison for the Weaver and the Sentinel; the `construct` tag decides (WORLD §5)
    expect([bullet(block(WEAVER), 'Resist:'), bullet(block(SENTINEL), 'Resist:')]).toEqual(['weak void · resist ley · immune poison', 'weak chrono, void · resist storm · immune poison']);
    expect(bullet(block(MOTE), 'Resist:')).toBe('weak physical, void · resist ley · immune poison, bleed');
    expect(cr(HARRIER).statusImmunities).toEqual([]);
    expect(bullet(block(HARRIER), 'Resist:')).toBe('weak chrono · resist fire · immune —');
    expect(cr(PHANTOM).tags).toEqual(['breach_born', 'legacy']);
    expect([cr(SENTINEL).tags, cr(HARRIER).tags]).toEqual([['construct', 'skyborn', 'legacy'], ['skyborn']]);
  });

  test('moves: every WORLD intent id with its telegraph verbatim; every move reached by a pattern but the Glass Mote’s death burst; telegraphs ≤ 12 words', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect(Object.keys(w.intents).length).toBeGreaterThan(0);
      expect([c.id, Object.keys(c.moves).sort()]).toEqual([c.id, Object.keys(w.intents).sort()]);
      for (const [id, line] of Object.entries(w.intents)) expect([c.id, id, c.moves[id]?.line]).toEqual([c.id, id, line]);
      const used = new Set<string>();
      walkSteps(c.pattern, [], (s: Step) => void ('move' in s && used.add(s.move)));
      expect([c.id, Object.keys(c.moves).filter((id) => !used.has(id))]).toEqual([c.id, c.id === MOTE ? ['mote_shatter'] : []]);
      for (const m of Object.values(c.moves)) expect([c.id, m.line, words(m.line) <= 12]).toEqual([c.id, m.line, true]);
    }
    // WORLD's `onDeath`: no pattern condition or hook fires a move at death (DESIGN §4.2): the burst waits for one (a gap for U34d)
    expect(block(MOTE)).toContain('`mote_shatter` · "Cracks race through it. It is going to burst." · 1.2× all · onDeath');
  });

  test('moves carry WORLD’s numbers: the multiplier and stat, type, statuses and their chances, the area moves, the Moth’s haste strip', () => {
    const m = (c: string, id: string) => cr(c).moves[id];
    const hit = (c: string, id: string) => [m(c, id)?.type, m(c, id)?.power?.coef, m(c, id)?.power?.stat];
    const rows = (c: string, id: string) => m(c, id)?.statuses.map((s) => [s.status.slice('status_'.length), s.chance, s.duration, s.target]);
    expect(hit(PHANTOM, 'phantom_flicker')).toEqual(['chrono', 1.1, 'sp']);
    expect(rows(PHANTOM, 'phantom_mirage')).toEqual([['phase', 1, 1, 'self']]);
    expect(hit(PHANTOM, 'phantom_teeth')).toEqual(['physical', 1.3, 'atk']);
    expect(rows(PHANTOM, 'phantom_teeth')).toEqual([['bleed', 0.4, 2, 'target']]);
    expect(hit(MOTH, 'moth_flutter')).toEqual(['chrono', 0.6, 'sp']);
    expect(rows(MOTH, 'moth_flutter')).toEqual([['slow', 0.4, 2, 'target']]);
    expect(hit(MOTH, 'moth_eat_a_second')).toEqual(['chrono', 0.8, 'sp']);
    expect(rows(MOTH, 'moth_eat_a_second')).toEqual([['stun', 0.1, 1, 'target']]);
    expect(m(MOTH, 'moth_eat_a_second')?.effects).toEqual([{ stripBuffs: { kinds: ['haste'] } }]); // "strips your haste"
    expect(hit(MOTH, 'moth_swarm')).toEqual(['chrono', 0.5, 'sp']);
    expect(hit(MOTE, 'mote_spin')).toEqual(['physical', 1.0, 'atk']);
    expect(rows(MOTE, 'mote_spin')).toEqual([['bleed', 0.4, 3, 'target']]);
    expect(hit(MOTE, 'mote_refract')).toEqual(['ley', 1.1, 'sp']); // "ley on Refract"
    expect(hit(MOTE, 'mote_shatter')).toEqual(['physical', 1.2, 'atk']);
    expect(hit(WEAVER, 'weaver_strand')).toEqual(['ley', 1.0, 'sp']);
    expect(rows(WEAVER, 'weaver_strand')).toEqual([['slow', 0.3, 2, 'target']]);
    expect(hit(WEAVER, 'weaver_bind')).toEqual(['ley', 0.8, 'sp']);
    expect(rows(WEAVER, 'weaver_bind')).toEqual([['weaken', 0.5, 2, 'target']]);
    expect(hit(WEAVER, 'weaver_web')).toEqual(['ley', 0.7, 'sp']);
    expect(rows(WEAVER, 'weaver_web')).toEqual([['shock', 0.3, 2, 'target']]);
    expect(m(WEAVER, 'weaver_mend')?.shield?.power).toEqual({ base: 0, coef: 1.2, stat: 'atk', hits: 1 }); // shield self 1.2×
    expect(m(WEAVER, 'weaver_mend')?.power).toBeUndefined();
    expect(hit(SENTINEL, 'sentinel_cutting_gust')).toEqual(['storm', 1.0, 'sp']);
    expect(rows(SENTINEL, 'sentinel_cutting_gust')).toEqual([['bleed', 0.3, 2, 'target']]);
    expect(hit(SENTINEL, 'sentinel_gale_wall')).toEqual(['storm', 0.6, 'sp']);
    expect(rows(SENTINEL, 'sentinel_gale_wall')).toEqual([['blind', 0.3, 1, 'target']]);
    expect(rows(SENTINEL, 'sentinel_ride_the_wind')).toEqual([['haste', 1, 2, 'self']]);
    expect(hit(SENTINEL, 'sentinel_dive')).toEqual(['physical', 1.5, 'atk']); // "1.5× physical you"
    expect(hit(HARRIER, 'harrier_stoop')).toEqual(['physical', 1.3, 'atk']);
    expect(hit(HARRIER, 'harrier_rake')).toEqual(['physical', 0.8, 'atk']);
    expect(rows(HARRIER, 'harrier_rake')).toEqual([['blind', 0.3, 1, 'target']]);
    expect(rows(HARRIER, 'harrier_climb')).toEqual([['haste', 1, 2, 'self']]);
    expect(hit(HARRIER, 'harrier_dive')).toEqual(['physical', 1.5, 'atk']);
    // "× all": the Web, the Gale Wall and the Swarm are area moves (their pattern steps target `all`); the rest hit one
    const targets = (c: string): Record<string, string> => {
      const t: Record<string, string> = {};
      walkSteps(cr(c).pattern, [], (s: Step) => void ('move' in s && (t[s.move] = s.target ?? 'player')));
      return t;
    };
    expect(targets(WEAVER)).toEqual({ weaver_web: 'all', weaver_mend: 'self', weaver_strand: 'player', weaver_bind: 'player' });
    expect(targets(SENTINEL)).toEqual({ sentinel_ride_the_wind: 'self', sentinel_dive: 'player', sentinel_cutting_gust: 'player', sentinel_gale_wall: 'all' });
    expect(targets(MOTH)).toEqual({ moth_swarm: 'all', moth_flutter: 'player', moth_eat_a_second: 'player' });
  });

  test('loot: gold ranges and every item WORLD lists, chances as WORLD (the Harrier’s Storm Glass 30 % is DESIGN §8.2’s and WORLD §8.1’s, not §6.2’s block)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      const expected = [...w.lootIds, ...(c.id === HARRIER ? ['mat_storm_glass'] : [])];
      expect([c.id, c.loot.map((l) => l.itemId).sort()]).toEqual([c.id, expected.sort()]);
    }
    const row = (c: string) => cr(c).loot.map((l) => [l.itemId, l.chance, l.count]);
    expect(row(PHANTOM)).toEqual([['item_chronal_dust', 1, 1], ['mat_frayed_moment', 0.3, 1]]);
    expect(row(MOTH)).toEqual([['item_chronal_dust', 0.3, 1], ['mat_frayed_moment', 0.2, 1]]);
    expect(row(MOTE)).toEqual([['item_aetherium_shard', 0.3, 1], ['mat_skyreach_crystal', 0.15, 1]]);
    expect(row(WEAVER)).toEqual([['item_aetherium_shard', 1, 1], ['mat_spire_thread', 0.7, 1]]);
    expect(row(SENTINEL)).toEqual([[TALISMAN, 1, 1], ['mat_gale_feather', 0.8, 1]]);
    expect(row(HARRIER)).toEqual([['mat_gale_feather', 0.5, 1], ['mat_steppe_salt', 0.2, 1], ['mat_storm_glass', 0.3, 1]]);
    expect(DESIGN).toContain('| `mat_storm_glass` | Storm Glass | 99 | `cr_steppe_harrier` 30%;');
    expect(WORLD).toContain('| `mat_storm_glass` **W** | Storm Glass | T3 | 99 | 16 | `cr_steppe_harrier` 30%;');
    expect(bullet(block(HARRIER), 'Loot:')).not.toContain('mat_storm_glass');
    // material kin (DESIGN §8.2): the Phantom's `phantom`, the Weaver's `aetherial`, the Sentinel's `sentinel`
    expect([cr(PHANTOM).materialKin, cr(WEAVER).materialKin, cr(SENTINEL).materialKin]).toEqual(['phantom', 'aetherial', 'sentinel']);
    for (const kin of ['phantom', 'aetherial', 'sentinel']) expect(DESIGN).toContain(`\`${kin}\``);
  });

  test('legacy descriptions verbatim (the Phantom, the Weaver, the Sentinel); bestiary voice, entry and tactics verbatim; family codex entries', () => {
    for (const c of parsedCreatures) {
      const b = block(c.id);
      const legacy = /- \*\*Legacy description:\*\* "([^"]+)"/.exec(b)?.[1];
      if (legacy !== undefined) expect([c.id, c.description]).toEqual([c.id, flat(legacy)]);
      else expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
      expect([c.id, c.bestiary.voice]).toEqual([c.id, worldCreature(c.id).voice]);
      expect([c.id, c.bestiary.summary]).toEqual([c.id, playText(bullet(b, 'Bestiary'))]);
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, playText(bullet(b, 'Tactics:'))]);
      expect(c.bestiary.codexId).toBe(`codex_creatures_${c.family.slice('fam_'.length)}`);
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
    }
    expect([cr(PHANTOM).legacyName, cr(WEAVER).legacyName, cr(SENTINEL).legacyName]).toEqual(['Shimmering Phantom', 'Aetherial Weaver', 'Sky-Whisper Sentinel']);
    expect([cr(MOTH).legacyName, cr(MOTE).legacyName, cr(HARRIER).legacyName]).toEqual([undefined, undefined, undefined]);
    for (const id of ['codex_creatures_watch_wardens', 'codex_creatures_spireborn', 'codex_creatures_wilds']) expect(STORY).toContain(`| \`${id}\` |`);
  });
});

// ---- Patterns, walked by the engine ------------------------------------------------------------------------------------------

/** WORLD's cadence words, turn by turn: the moves `id` commits to (by `generateIntent`), its HP, statuses and allies set per turn. */
function plan(
  id: string,
  turns: number,
  o: { groups?: { creatureId: string; count: number }[]; from?: number; before?: (turn: number, foe: Combatant, combat: CombatState) => void } = {},
): string[] {
  const profile = freshProfile();
  const s = makeState({ level: 12 }, { content: pack, profile });
  const ctx = scriptedCtx(s, [D.d4(4), ...Array.from({ length: 12 }, () => D.d4(1))], pack, profile); // the player's initiative d4, then each foe's
  const spec = { id: 'enc_test', groups: o.groups ?? [{ creatureId: id, count: 1 }], fleeable: false, onFlee: 'hold', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] } satisfies EncounterSpec;
  const combat = beginCombat(ctx, spec);
  const foe = combat.enemies.find((e) => e.refId === id) as Combatant;
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

describe('patterns: WORLD’s cadence words hold turn by turn (first-match on every turn; two cycled moves alternate)', () => {
  test('the Phantom: the Mirage every third turn; the Teeth while it is Phased; otherwise the Flicker', () => {
    expect(plan(PHANTOM, 6)).toEqual(seq('flicker flicker mirage flicker flicker mirage'));
    expect(plan(PHANTOM, 6, { before: (t, f) => withStatus(f, 'status_phase', t === 4) })).toEqual(seq('flicker flicker mirage teeth flicker mirage'));
  });

  test('the Moths: the Swarm every third turn while another Moth stands; the Flutter and Eat a Second alternate', () => {
    const three = [{ creatureId: MOTH, count: 3 }];
    expect(plan(MOTH, 7, { groups: three })).toEqual(seq('flutter eat_a_second swarm eat_a_second flutter swarm flutter'));
    // alone, or once the others are down: no Swarm
    expect(plan(MOTH, 6)).toEqual(seq('flutter eat_a_second flutter eat_a_second flutter eat_a_second'));
    expect(plan(MOTH, 6, { groups: three, before: (t, f, c) => void c.enemies.forEach((e) => e !== f && (e.alive = t < 3)) })).toEqual(seq('flutter eat_a_second flutter eat_a_second flutter eat_a_second'));
  });

  test('the Glass Mote: Spin and Refract, a plain cycle (it has no condition; the Shatter waits for an onDeath hook)', () => {
    expect(plan(MOTE, 5)).toEqual(seq('spin refract spin refract spin'));
  });

  test('the Weaver: the Web every third turn; one Mend below half HP while no Shield stands; the Strand and the Bind alternate', () => {
    expect(plan(WEAVER, 6)).toEqual(seq('strand bind web bind strand web'));
    const hurt = (t: number, f: Combatant): void => {
      hpAt(t >= 4 ? 0.4 : 1)(f);
      withStatus(f, 'status_shield', t >= 5 && t <= 7);
    };
    expect(plan(WEAVER, 8, { before: (t, f) => hurt(t, f) })).toEqual(seq('strand bind web mend strand web strand mend'));
  });

  test('the Sentinel: Ride the Wind every third turn; the Dive while it is Hasted; the Gust and the Gale Wall alternate', () => {
    expect(plan(SENTINEL, 6)).toEqual(seq('cutting_gust gale_wall ride_the_wind gale_wall cutting_gust ride_the_wind'));
    expect(plan(SENTINEL, 6, { before: (t, f) => withStatus(f, 'status_haste', t === 4) })).toEqual(seq('cutting_gust gale_wall ride_the_wind dive cutting_gust ride_the_wind'));
  });

  test('the Harrier: the Stoop first; the Climb every third turn; the Dive while it is Hasted; otherwise the Rake', () => {
    expect(plan(HARRIER, 6)).toEqual(seq('stoop rake climb rake rake climb'));
    expect(plan(HARRIER, 6, { before: (t, f) => withStatus(f, 'status_haste', t === 4) })).toEqual(seq('stoop rake climb dive rake climb'));
  });
});

// ---- The NPC ------------------------------------------------------------------------------------------------------------------

describe('Dask vs WORLD §4', () => {
  const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
  const row = tableRows(S4).find((c) => unquote(c[0] ?? '') === 'npc_dask') ?? [];
  const dask = byId(npcs, 'npc_dask');

  test('exactly the NPCs whose home is in the region: Dask, at the Pass', () => {
    const homes = tableRows(S4).filter((c) => /^loc_(shimmering_pass|aetherium_spires|sky_whisper_plateau)\b/.test(c[3] ?? '')).map((c) => unquote(c[0] ?? ''));
    expect(npcs.map((n) => n.id)).toEqual(homes);
    expect(homes).toEqual(['npc_dask']);
    expect([dask.homeLocationId, dask.factionId, row[2]]).toEqual([PASS, 'neutral', '—']);
  });

  test('name, no age (BIBLE gives none), description and sample lines verbatim, roles and the companion handshake (D-088); not a legacy character', () => {
    expect(row[1]).toBe('Dask, the Flickering Man');
    expect(row[1]?.startsWith(dask.name)).toBe(true);
    expect('age' in dask).toBe(false);
    expect(row[5]).not.toMatch(/~\d+/);
    expect(dask.description).toBe(row[5]);
    expect('legacyName' in dask).toBe(false);
    expect(dask.barks).toHaveLength(2);
    for (const b of dask.barks ?? []) expect(row[6]).toContain(`"${b.text}"`);
    expect(dask.roles).toEqual(['companion', 'questgiver']);
    expect(row[4]).toBe('companion anchor `dask`; quest giver (Dask arc, q_high_mark, q_wardens_vigil)');
    expect(dask.companionId).toBe('dask');
    expect(companions.find((c) => c.id === 'dask')?.npcId).toBe('npc_dask');
    expect(dask.portrait).toEqual(companions.find((c) => c.id === 'dask')?.portrait);
    // he may stay in any `temporallyUnstable` location (D-059): the engine's rule, not a second placement
    expect(row[3]).toContain('may remain in any `temporallyUnstable` location, D-059');
    expect(parsedLocations.filter((l) => l.npcs.includes('npc_dask')).map((l) => l.id)).toEqual([PASS]);
  });

  test('D-098 (U34d): in Loop 1 he is "a flicker the player cannot speak to" — his schedule stands him nowhere; from Loop 2 he is at the Pass', () => {
    expect(WL[PASS]?.block).toContain('in Loop 1 he is a flicker the player cannot speak to — Loop 2+ only');
    expect(dask.schedule).toEqual([{ when: { loop: { max: 1 } }, at: [] }]);
    const here = (o: At) => {
      const s = stateAt(PASS, { stood: { [PASS]: { cleared: ['enc_pass_phantom'] } }, ...o });
      return {
        npcs: npcsAt(s, pack, profileOf(o), PASS),
        examinable: legalActions(s, pack, profileOf(o), { includeExamine: true }).some((a) => a.type === 'examine' && a.target.kind === 'npc'),
      };
    };
    expect(here({})).toEqual({ npcs: [], examinable: false });
    expect(here({ loop: 2 })).toEqual({ npcs: ['npc_dask'], examinable: true });
    // the glimpse is the Pass's own event
    expect(byId(loc(PASS).events, 'ev_pass_flicker').when).toBeUndefined();
  });
});

// ---- The region in the engine (real pack, seeded) ------------------------------------------------------------------------------

describe('the region in the engine (real pack, seeded)', () => {
  const FRESH = (id: string) => ({ [id]: { first: true as const } });

  test('the road: the Depths’ east exit opens onto the Pass; the Pass, the Spires and the Plateau are joined west to east; the Plateau reaches the Glowlands and the Outpost', () => {
    expect(movesFrom(DEPTHS, { flags: {} })).toContain(PASS);
    expect(movesFrom(PASS)).toEqual([DEPTHS, SPIRES].sort());
    expect(movesFrom(SPIRES)).toEqual([PASS, PLATEAU].sort());
    expect(movesFrom(PLATEAU)).toEqual([SPIRES, GLOWLANDS, OUTPOST].sort());
    expect(arrive(PLATEAU, GLOWLANDS).world.currentLocationId).toBe(GLOWLANDS);
  });

  test('the climbs (gate_thin_air): shut with neither the Talisman nor echo_high_mark; open with either', () => {
    const when = loc(SPIRES).exits.find((e) => e.to === 'loc_spire_crown')?.when as Condition;
    expect(holds(when)).toBe(false);
    expect(holds(when, { carrying: [TALISMAN] })).toBe(true);
    expect(holds(when, { loop: 2, echoes: ['echo_high_mark'] })).toBe(true);
    expect(holds(when, { loop: 2, echoes: ['echo_spire_note'] })).toBe(false);
  });

  test('the first visit to the Pass: the Phantom, one, fleeable with `scatter`; once it is fought or fled the Pass offers the Moths on a return', () => {
    expect(fight(DEPTHS, PASS, { stood: FRESH(PASS) })).toEqual({ id: 'enc_pass_phantom', enemies: [PHANTOM], canFlee: true });
    expect(arrive(DEPTHS, PASS, { stood: FRESH(PASS) }).combat).toMatchObject({ onFlee: 'scatter' });
    const N = 500;
    for (const gone of [{ cleared: ['enc_pass_phantom'] }, { scattered: ['enc_pass_phantom'] }]) {
      const t = tally(DEPTHS, PASS, N, { stood: { [PASS]: gone } });
      expect(Object.keys(t).filter((k) => !['none', 'enc_pass_moths', 'wandering'].includes(k))).toEqual([]);
      expect(share(t, 'enc_pass_moths', N)).toBeGreaterThan(0.23); // 30 %
      expect(share(t, 'enc_pass_moths', N)).toBeLessThan(0.37);
      expect(share(t, 'wandering', N)).toBeGreaterThan(0.08); // 0.70 × 0.20 = 14 %
      expect(share(t, 'wandering', N)).toBeLessThan(0.2);
    }
    expect(fight(DEPTHS, PASS, { stood: { [PASS]: { cleared: ['enc_pass_phantom'] } }, seed: 'u44-moths' }).enemies.every((e) => [MOTH, PHANTOM, MOTE, HARRIER, WEAVER].includes(e))).toBe(true);
  });

  test('the first visit to the Spires: the Weaver, unless echo_spire_note makes it passive; the Reach only from Loop 3, once per loop, 10 %', () => {
    expect(fight(PASS, SPIRES, { stood: FRESH(SPIRES) })).toEqual({ id: 'enc_spires_weaver', enemies: [WEAVER], canFlee: true });
    expect(fight(PASS, SPIRES, { stood: FRESH(SPIRES), loop: 2, echoes: ['echo_spire_note'] }).id).toBe('');
    // the passive Weaver stays passive on a return
    const N = 400;
    expect(Object.keys(tally(PASS, SPIRES, N, { stood: { [SPIRES]: {} }, loop: 2, echoes: ['echo_spire_note'] })).filter((k) => k === 'enc_spires_weaver')).toEqual([]);
    const cleared = { [SPIRES]: { cleared: ['enc_spires_weaver'] } };
    const loop2 = tally(PASS, SPIRES, N, { stood: cleared, loop: 2 });
    expect(loop2['enc_spires_tyrants_reach'] ?? 0).toBe(0);
    expect(share(loop2, 'enc_spires_glass_motes', N)).toBeGreaterThan(0.23); // 30 %
    expect(share(loop2, 'enc_spires_glass_motes', N)).toBeLessThan(0.37);
    const loop3 = tally(PASS, SPIRES, N, { stood: cleared, loop: 3 });
    expect(share(loop3, 'enc_spires_tyrants_reach', N)).toBeGreaterThan(0.05); // 10 %
    expect(share(loop3, 'enc_spires_tyrants_reach', N)).toBeLessThan(0.16);
    expect(share(loop3, 'enc_spires_glass_motes', N)).toBeGreaterThan(0.18); // 0.9 × 0.3 = 27 %
    expect(share(loop3, 'enc_spires_glass_motes', N)).toBeLessThan(0.36);
    // once per loop: after it has been fought the Reach does not return
    const spent = tally(PASS, SPIRES, N, { stood: { [SPIRES]: { cleared: ['enc_spires_weaver', 'enc_spires_tyrants_reach'] } }, loop: 3 });
    expect(spent['enc_spires_tyrants_reach'] ?? 0).toBe(0);
    // the Reach is one creature (the Unveiled Tyrant's add, authored with the Glowlands)
    for (let i = 0; i < 200; i++) {
      const f = fight(PASS, SPIRES, { stood: cleared, loop: 3, seed: `u44-${i}` });
      if (f.id === 'enc_spires_tyrants_reach') {
        expect(f.enemies).toEqual(['cr_tyrants_reach']);
        break;
      }
    }
  });

  test('the first visit to the Plateau: the Sentinel, unless echo_high_mark makes it passive; Harriers ×2 about 25 % on a return', () => {
    expect(fight(SPIRES, PLATEAU, { stood: FRESH(PLATEAU) })).toEqual({ id: 'enc_plateau_sentinel', enemies: [SENTINEL], canFlee: true });
    expect(fight(SPIRES, PLATEAU, { stood: FRESH(PLATEAU), loop: 2, echoes: ['echo_high_mark'] }).id).toBe('');
    const N = 500;
    const t = tally(SPIRES, PLATEAU, N, { stood: { [PLATEAU]: { cleared: ['enc_plateau_sentinel'] } } });
    expect(share(t, 'enc_plateau_harriers', N)).toBeGreaterThan(0.18);
    expect(share(t, 'enc_plateau_harriers', N)).toBeLessThan(0.32);
    // a Harrier pair is two Harriers
    for (let i = 0; i < 200; i++) {
      const f = fight(SPIRES, PLATEAU, { stood: { [PLATEAU]: { cleared: ['enc_plateau_sentinel'] } }, seed: `u44-${i}` });
      if (f.id === 'enc_plateau_harriers') {
        expect(f.enemies).toEqual([HARRIER, HARRIER]);
        break;
      }
    }
  });
});

// ---- The Apex road: now whole ---------------------------------------------------------------------------------------------------

describe('the Apex road is whole: the Glowlands, the Nexus and the Apex are reachable from loc_whispering_ruins (U44 + U45)', () => {
  const landed = new Map<string, Location>(Object.entries(pack.locations).map(([id, l]) => [id, l]));
  const reach = (open: (when: Condition) => boolean): Map<string, number> => {
    const dist = new Map<string, number>([[WR, 0]]);
    const queue = [WR];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i] ?? '';
      for (const exit of landed.get(at)?.exits ?? []) {
        if (!landed.has(exit.to) || dist.has(exit.to) || (exit.when !== undefined && !open(exit.when))) continue;
        dist.set(exit.to, (dist.get(at) ?? 0) + exit.travelWatches);
        queue.push(exit.to);
      }
    }
    return dist;
  };

  test('Loop 1 terms (a quest gate is satisfiable, six completed quests count, an Echo-only gate is closed): WORLD §3.13’s watches, Pass 3 … Apex 8', () => {
    const loop1 = reach((when) => /"(quest|counter)"/.test(JSON.stringify(when)));
    expect([PASS, SPIRES, PLATEAU, GLOWLANDS, NEXUS, APEX].map((id) => loop1.get(id))).toEqual([3, 4, 5, 6, 7, 8]);
    expect(loop1.get(DEPTHS)).toBe(2);
    const row = tableRows(section(WORLD, '### 3.13', '### Conventions for §4–6')).find((c) => unquote(c[0] ?? '') === 'loc_temporal_breach_apex');
    expect(row?.[1]).toBe('… Glowlands → Nexus → Apex (8; W10)');
    expect(row?.[2]).toContain('six completed quests (Loop 1) or `echo_apex_resonance`');
    // the same road, counted to the Glowfen's door: Glowlands is the sixth watch, the Causeway the seventh
    expect(section(WORLD, '### 3.13', '### Conventions for §4–6')).toContain('WR → Archives → Depths → Pass → Spires → Plateau → Glowlands → Causeway (7)');
  });

  test('the road’s only gate before the Pass is the Depths’ descent: with no gate satisfied none of the six is reachable (WORLD §11.3’s eleven nodes)', () => {
    const closed = reach(() => false);
    expect([PASS, SPIRES, PLATEAU, GLOWLANDS, NEXUS, APEX].map((id) => closed.has(id))).toEqual([false, false, false, false, false, false]);
    // …and the Apex itself needs its own gate (D-048) on top of the road
    const noApex = reach((when) => JSON.stringify(when).includes('"quest"') && !JSON.stringify(when).includes('"counter"'));
    expect([GLOWLANDS, NEXUS, APEX].map((id) => noApex.has(id))).toEqual([true, true, false]);
  });

  test('the validator agrees: rule 8 says nothing about the Highlands, the Glowlands, the Nexus or the Apex, as a warning or as an error', () => {
    const ids = new Set<string>([...here, GLOWLANDS, NEXUS, APEX]);
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.warnings.filter((w) => w.rule === 'rule-08' && ids.has(w.id))).toEqual([]);
    expect(validateContent(pack, { strict: false }).errors.filter((e) => e.rule === 'rule-08' && ids.has(e.id))).toEqual([]);
    expect(report.errors).toEqual([]);
  });

  test('walked by the engine: each step of the road is a legal move that lands on the next location (the first-visit fight, if any, is the location’s own)', () => {
    const road = [[DEPTHS, PASS], [PASS, SPIRES], [SPIRES, PLATEAU], [PLATEAU, GLOWLANDS], [GLOWLANDS, NEXUS]] as const;
    for (const [from, to] of road) {
      expect([from, to, movesFrom(from).includes(to)]).toEqual([from, to, true]);
      expect([from, to, arrive(from, to, { stood: { [to]: { first: true } } }).world.currentLocationId]).toEqual([from, to, to]);
    }
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder after the Voidscar and before the Glowlands; the region’s tables are in `contentTables` and the index', () => {
    const folders = REGION_FOLDERS.map((f) => f.region.id);
    expect(folders).toContain(REGION);
    expect(folders.indexOf('region_voidscar')).toBeLessThan(folders.indexOf(REGION));
    expect(folders.indexOf(REGION)).toBeLessThan(folders.indexOf('region_glowlands_nexus'));
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('Aether-Kissed Highlands');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.name).toBe(c.name);
    for (const n of npcs) expect(pack.npcs[n.id]?.name).toBe(n.name);
    expect(items).toEqual([]); // the items tables are U49/U50's; this region owns none
    expect(pack.index.startLocationId).toBe(WR);
  });

  test('validates with 0 errors; pending references name only tables still being authored; the region’s real warnings are the known ones', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const pending = report.warnings.filter((w) => w.message.startsWith('pending — content not yet authored (reference): '));
    for (const w of pending) {
      const table = /not found in ([a-z]+)$/.exec(w.message)?.[1];
      expect([w.message, INCOMPLETE_TABLES.includes(table as (typeof INCOMPLETE_TABLES)[number])]).toEqual([w.message, true]);
    }
    // order-agnostic (U48a): a rule-11 placement warning names the place a creature stands; one that names another region's place
    // or pool (the Skyreach places this region's Weaver, Mote and Sentinel below its band 12–15, WORLD §3.10, §10.1) is that
    // region's to pin, whether or not it has landed
    const placedElsewhere = (w: { rule: string; path: string; message: string }): boolean =>
      w.rule === 'rule-11' && w.path === 'level' && ![...here, REGION].some((id) => w.message.includes(` ${id}`));
    const real = report.warnings.filter((w) => !w.message.startsWith('pending — content not yet authored') && !placedElsewhere(w) && (mine.has(w.id) || [...here].some((id) => w.message.includes(` ${id}`))));
    // the Heartstone flags the Spires read are set by the Heartstone unit's effects (rule 02, once per flag at its first use, in
    // table order: the Ruins' Depths report them, silverwood_ruins.test.ts); nothing real is reported about this region
    expect([...new Set(real.map((w) => `${w.rule} ${w.id}`))].sort()).toEqual([]);
  });

  test('`npm run validate`: exit 0, 0 errors, the pending references listed', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/ regions \d+ · locations \d+ · creatures \d+ · /);
    expect(text).toMatch(/pending rule-01: \d+ reference\(s\) into tables still being authored/);
    expect(text).toMatch(/validate: ok — 0 errors, \d+ warning\(s\), \d+ pending completeness check\(s\), \d+ pending reference\(s\)/);
  });

  test('this region’s pending references name only ids WORLD/STORY/DESIGN spell (the Skyreach’s locations, items, Echoes, the companion, codex entries); its neighbours now resolve', () => {
    const { report } = parseContentPack(contentTables);
    const targets = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    // Later units resolve these one by one (regions U46–U48, items U49/U50, quests U52–U59): the list may only shrink
    const known = new Set([
      'loc_spire_crown', 'loc_windward_stair',
      'item_chronal_dust', 'item_aetherium_shard', TALISMAN,
      'mat_frayed_moment', 'mat_skyreach_crystal', 'mat_spire_thread', 'mat_gale_feather', 'mat_steppe_salt', 'mat_storm_glass',
      'echo_flickering_man', 'echo_litany_verse_1', 'echo_spire_note', 'echo_high_mark',
      'dask', // the companion record (D-088: registered by U55)
      'neutral', // the faction id of the neutral NPCs
      'codex_region_highlands', 'codex_creatures_watch_wardens', 'codex_creatures_spireborn', 'codex_creatures_wilds',
    ]);
    expect([...targets].filter((t) => !known.has(t)).sort()).toEqual([]);
    for (const resolved of [DEPTHS, GLOWLANDS, OUTPOST, 'cr_tyrants_reach']) expect([resolved, targets.has(resolved)]).toEqual([resolved, false]);
    const docs = `${WORLD}\n${STORY}\n${DESIGN}`;
    for (const id of targets) expect([id, docs.includes(id)]).toEqual([id, true]);
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U44 reply ----------------------------------------

describe('authored words outside the documents are few and short; coined ids are the listed ones', () => {
  test('encounter intros, the rest texts, the non-legacy creature descriptions', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro)).filter((t): t is string => t !== undefined);
    expect(intros.length).toBe(7);
    expect(parsedLocations.flatMap((l) => l.encounters).length).toBe(7);
    for (const t of intros) expect([t, words(t) <= 20]).toEqual([t, true]);
    expect(loc(PASS).rest?.text).toBe("You rest in Dask's hollow, a cleft that is always the same temperature.");
    expect(loc(PLATEAU).rest?.text).toBe('You rest in a wind-shelter among the markers.');
    for (const id of [MOTH, MOTE, HARRIER]) expect([id, words(cr(id).description) <= 30]).toEqual([id, true]);
  });

  test('ids this unit coined (WORLD/STORY have none for them): encounter ids and the art silhouette keys', () => {
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.id))).toEqual([
      'enc_pass_phantom', 'enc_pass_moths',
      'enc_spires_weaver', 'enc_spires_tyrants_reach', 'enc_spires_glass_motes',
      'enc_plateau_sentinel', 'enc_plateau_harriers',
    ]);
    // every move id is WORLD's
    for (const c of parsedCreatures) for (const id of Object.keys(c.moves)) expect([c.id, id, WORLD.includes(`\`${id}\``)]).toEqual([c.id, id, true]);
  });
});
