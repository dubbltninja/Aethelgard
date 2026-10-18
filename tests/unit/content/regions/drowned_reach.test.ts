// U46: The Drowned Reach — checked against the documents at test time, U42's pattern (regions/silverwood_ruins.test.ts):
// WORLD §2.7, §3.6, §4, §6.3, §10.1, §10.3, §11.1–11.3, §12.1; DESIGN §6.2, §17.1, §18.2; PLAN Appendix A; STORY's codex ids.
// The region is new (no legacy text, no `legacyName`), so every description is WORLD's, character for character. Patterns
// are walked turn by turn by the engine (`generateIntent`), so every WORLD cadence word is held to what the game does. Where
// a record departs from the letter of WORLD (a reading the schema or the engine forces), the test pins the departure so a
// later edit cannot move it silently; the readings are listed in the U46 reply.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures } from '@content/regions/drowned_reach/creatures';
import { items } from '@content/regions/drowned_reach/items';
import { locations } from '@content/regions/drowned_reach/locations';
import { npcs } from '@content/regions/drowned_reach/npcs';
import { region } from '@content/regions/drowned_reach/region';
import { validateContent } from '@content/validate';
import { beginCombat, evaluate, generateIntent, legalActions, step, type CombatState, type Combatant, type EncounterSpec, type GameState } from '@engine/index';
import type { Condition } from '@schema/condition';
import { CreatureSchema, walkSteps, type Creature, type Step } from '@schema/creature';
import { LocationSchema, type Location } from '@schema/location';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { main as validateCli } from '../../../../tools/validate-content';
import { PLAN, WORLD, ids, section, tableRows, unquote, worldCreature, worldCreatureTable, worldEdges, worldLocations, worldNodes } from './worldDoc';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');

const REGION = 'region_drowned_reach';
const DS = 'loc_drowned_stair';
const TW = 'loc_tidewell_hall';
const CI = 'loc_cistern_of_names';
const LR = 'loc_lamplighters_rest';
const SY = 'loc_sunken_scriptorium';
const BS = 'loc_black_sluice';
const BM = 'loc_bellmouth';
const BW = 'loc_bell_wardens_deep';
const SA = 'loc_sunken_archives';
const WR = 'loc_whispering_ruins';
const WARDEN = 'cr_bell_warden';
const LANTERN = 'item_glyphbound_lantern';
const KEY = 'item_cistern_key';

const S27 = section(WORLD, '### 2.7 `region_drowned_reach`', '### 2.8');
const S36 = section(WORLD, '### 3.6 The Drowned Reach', '### 3.7');
const WL = Object.fromEntries(worldLocations(S36).map((l) => [l.id, l]));
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
/** WORLD's condition notation (`{item:"x"}`, unquoted keys) as data; `{item:"x"}` is the schema's `{item:{id:"x"}}`. */
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
  /** Item ids carried (the pack has no item records yet, so they are put straight into the inventory). */
  carrying?: string[];
  /** 0 dawn … 3 night. */
  watch?: NonNullable<StateOverrides['watch']>;
  reputation?: StateOverrides['reputation'];
}

/** A state on the real pack, standing at `locationId`. */
function stateAt(locationId: string, o: At = {}): GameState {
  const overrides: StateOverrides = {
    locationId,
    seed: o.seed ?? 'u46',
    ...(o.loop === undefined ? {} : { loop: o.loop }),
    ...(o.watch === undefined ? {} : { watch: o.watch }),
    ...(o.reputation === undefined ? {} : { reputation: o.reputation }),
    flags: o.flags ?? {},
    patch: (s) => {
      for (const id of o.echoes ?? []) s.echoesThisLoop.push(id);
      for (const itemId of o.carrying ?? []) s.player.inventory.push({ uid: `i${s.meta.nextUid++}`, itemId, qty: 1, rarity: 'common', affixes: [] });
    },
  };
  return makeState(overrides, { content: pack });
}
const profileOf = (o: At = {}) => freshProfile({ loopCounter: o.loop ?? 1 });
const holds = (cond: Condition, locationId: string, o: At = {}): boolean => evaluate(cond, stateAt(locationId, o), profileOf(o), pack);
/**
 * Walk to `to` from the state `from` stands in. No item record exists yet (the items tables are U49/U50's), and the engine
 * cannot put an unknown item on the ground, so the destination's items are taken as already spawned; its events named in
 * `quiet` (the ones that grant Echoes, whose records are a later unit's) as already fired.
 */
const arrive = (from: string, to: string, o: At = {}, quiet: readonly string[] = []) => {
  const s = stateAt(from, o);
  s.world.locationStates[to] = {
    visited: false, visitCount: 0, items: [], itemsSpawned: true, encountersCleared: [], encounterClearedDay: {}, eventsFired: [...quiet], flags: {},
    unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
  };
  return step(s, { type: 'move', to }, pack, profileOf(o)).state;
};
/** Does the exit `from → to` stand open? (`holds` reads the condition itself: `legalActions` cannot list a carried item that has no record yet.) */
const exitOpen = (from: string, to: string, o: At = {}): boolean => {
  const exit = pack.locations[from]?.exits.find((e) => e.to === to);
  return exit !== undefined && (exit.when === undefined || holds(exit.when, from, o));
};
const movesFrom = (locationId: string, o: At = {}): string[] =>
  legalActions(stateAt(locationId, o), pack, profileOf(o))
    .filter((a) => a.type === 'move')
    .map((a) => (a as { to: string }).to)
    .sort();

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_drowned_reach vs WORLD §2.7, §10.1, DESIGN §6.5, §17.1, §18.2', () => {
  test('id, name, new (Appendix A.1), faction, band, WORLD’s theme text, order, codex entry', () => {
    expect(region.id).toBe(REGION);
    expect(S27.startsWith(`### 2.7 \`${REGION}\` — ${region.name}`)).toBe(true);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | new | 8 |`);
    expect('legacy' in region).toBe(false); // not one of the five legacy regions (D-015)
    expect(pack.regions[REGION]?.legacy).toBe(false);
    expect(S27).toContain('| Level band | 4–8 |');
    expect(region.levelBand).toEqual({ min: 4, max: 8 });
    expect(S27).toContain('| Factions | Remnants (divers and lamplighters at Lamplighters\' Rest).');
    expect(region.factionId).toBe('remnants');
    const theme = /\*\*Theme\.\*\* ([\s\S]*?)\n\n\| Field/.exec(S27)?.[1] ?? '';
    expect(region.description).toBe(playText(theme));
    expect(region.order).toBe(7);
    expect(region.codexId).toBe('codex_region_drowned_reach');
    expect(STORY).toContain('| `codex_region_drowned_reach` |');
  });

  test('the eight locations WORLD lists, in WORLD’s order, all in the region', () => {
    const listed = /\| Locations \(8\) \| ([^|]+) \|/.exec(S27)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual([DS, TW, CI, LR, SY, BS, BM, BW]);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of locations) expect(l.regionId).toBe(REGION);
  });

  test('the pool is WORLD §10.1’s pool_drowned_reach, weight for weight; return chance 20 %; the Archivist is the Ruins’ and landed; every entry is in-band fodder', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_drowned_reach');
    expect(row?.[2]).toBe('—');
    const entries = [...(row?.[1] ?? '').matchAll(/(cr_[a-z_]+) (\d+)/g)].map((m) => ({ creatureId: m[1] ?? '', weight: Number(m[2]) }));
    expect(entries.map((e) => e.creatureId)).toEqual(['cr_brine_lamprey', 'cr_pale_diver', 'cr_tide_clerk', 'cr_drowned_archivist']);
    expect(region.wanderingPool).toEqual(entries);
    expect(region.returnEncounterChance).toBe(0.2);
    expect(creatures.map((c) => c.id as string)).not.toContain('cr_drowned_archivist'); // first region: the Ruins (D-090)
    for (const e of region.wanderingPool) {
      const c = pack.creatures[e.creatureId];
      expect([e.creatureId, c?.role, c !== undefined && c.level >= region.levelBand.min - 2 && c.level <= region.levelBand.max + 2]).toEqual([e.creatureId, 'fodder', true]);
    }
  });

  test('palette: DESIGN §17.1’s Drowned Reach row (sky top, sky bottom, mid, accent = glow); the ambient preset exists in §18.2', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'The Drowned Reach');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).some((c) => c[0] === 'The Drowned Reach')).toBe(true);
    expect(region.ambient).toBe('ambient_drowned_reach');
    // WORLD's extra ambient layers (muffled bell, paper rustle) are additive: no location replaces the preset
    for (const l of parsedLocations) expect([l.id, l.ambient]).toEqual([l.id, undefined]);
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the eight locations vs WORLD §3.6 blocks', () => {
  test('names, bands, coordinates and region', () => {
    for (const l of locations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.levelBand, l.map]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map]);
    }
    expect(WL[BW]?.block).toContain('8 (boss) · (−24, 12)');
  });

  test('descriptions: WORLD’s, character for character; no legacy name (a new region)', () => {
    for (const l of locations) {
      expect([l.id, l.description]).toEqual([l.id, WL[l.id]?.description]);
      expect([l.id, 'legacyName' in l]).toEqual([l.id, false]);
    }
  });

  test('exits: every walkable WORLD exit in order, gated ones with a `when`; the dark gate and the walkway carry a refusal line', () => {
    for (const l of parsedLocations) {
      const got = l.exits.map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.exits]);
      for (const e of l.exits) expect([l.id, e.to, e.travelWatches]).toEqual([l.id, e.to, 1]);
    }
    expect(loc(DS).exits.filter((e) => e.when !== undefined).map((e) => e.lockedText)).toEqual([
      'The dark past the lamps is not ordinary dark. Without the glyph-etched lantern you will not go into it.',
      'The dark past the lamps is not ordinary dark. Without the glyph-etched lantern you will not go into it.',
    ]);
    // WORLD §1's text for the lantern is "not ordinary dark" (§2.7 Hazards)
    expect(S27).toContain('the dark below "is not ordinary dark"');
    for (const [l, to] of [[BS, BM], [BM, BS]] as const) expect(loc(l).exits.find((e) => e.to === to)?.lockedText).toBe('The water has risen over the walkway. It will fall again by morning.');
  });

  test('rest points and merchants as WORLD says: the camp at Lamplighters’ Rest, Sedge’s stall; nothing else rests or sells', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, w?.rest, w?.merchant]);
    }
    expect(loc(LR).rest?.kind).toBe('camp');
    expect(loc(LR).merchantId).toBe('npc_sedge_marrow');
  });

  test('every item WORLD places is placed, with WORLD’s conditions; the Deep’s loot is the Warden’s; a chance is the item’s `chance` (D-098)', () => {
    for (const l of parsedLocations) {
      const expected = new Set(WL[l.id]?.itemIds ?? []);
      // the Warden pays the clapper (and the key and Hydromancy for the fight): only the bypass's share is placed here
      if (l.id === BW) expected.delete('item_bell_clapper');
      expect([l.id, l.items.map((i) => i.itemId).sort()]).toEqual([l.id, [...expected].sort()]);
    }
    const item = (o: object) => ({ count: 1, hidden: false, once: true, chance: 1, onTake: [], ...o }); // U34d's defaults
    expect(loc(DS).items).toEqual([item({ itemId: 'item_brine_draught' })]);
    expect(loc(TW).items).toEqual([item({ itemId: 'mat_sodden_vellum', count: 2 })]);
    expect(loc(LR).items).toEqual([item({ itemId: 'item_lantern_oil', count: 2 })]);
    expect(loc(BM).items).toEqual([item({ itemId: 'mat_bell_bronze', count: 2 })]);
    // ×1 (40 %) and ×1 (30 %, caught in a grate): the item's own `chance` (D-098, U34d; they lay hidden at 100 %, D-091 gap 1)
    expect(WL[CI]?.block).toContain('mat_drowned_pearl ×1 (40%)');
    expect(WL[BS]?.block).toContain('mat_bell_bronze ×1 (30%, caught in a grate)');
    expect([loc(CI).items, loc(BS).items]).toEqual([[item({ itemId: 'mat_drowned_pearl', chance: 0.4 })], [item({ itemId: 'mat_bell_bronze', chance: 0.3 })]]);
    expect(loc(SY).items).toEqual([
      item({ itemId: 'item_litany_page_1' }),
      item({ itemId: 'item_oriels_ledger', when: { any: [{ loop: { min: 2 } }, { echo: 'echo_oriel_lineage' }] } }),
      item({ itemId: 'mat_sodden_vellum', count: 2 }),
    ]);
    expect(WL[SY]?.block).toContain('item_oriels_ledger (100%, Loop 2+ or `echo_oriel_lineage`)');
    // the Deep: the key and the Hydromancy only with the Echo (the bypass), the clapper never
    expect(loc(BW).items).toEqual([
      item({ itemId: KEY, when: { echo: 'echo_rhune_choice' } }),
      item({ itemId: 'item_rhunes_hydromancy', when: { echo: 'echo_rhune_choice' } }),
    ]);
    expect(cr(WARDEN).loot.map((r) => r.itemId)).toEqual([KEY, 'item_bell_clapper', 'item_rhunes_hydromancy', 'mat_drowned_pearl', 'mat_bell_bronze']);
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa (the Warden’s add is its own)', () => {
    for (const l of parsedLocations) {
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      const expected = new Set(WL[l.id]?.creatureIds ?? []);
      if (l.id === BW) expected.delete('cr_brine_lamprey'); // "adds cr_brine_lamprey": the Warden's `warden_call`
      expect([l.id, [...got].sort()]).toEqual([l.id, [...expected].sort()]);
    }
    expect(JSON.stringify(cr(WARDEN).moves['warden_call']?.summon)).toBe('{"creatureId":"cr_brine_lamprey","count":1,"max":2,"hpPct":1}');
  });

  test('first-visit fights: chances 60 % / 100 % / 70 % / 100 %; the elites are fleeable scatter nodes (TW, SY, BS, BM, WORLD §10.4); the boss holds', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const shape = (l: string, id: string) => {
      const x = e(l, id);
      return [x.groups.map((g) => `${g.creatureId}×${g.count}`), x.chance, x.respawn, x.once, x.fleeable, x.onFlee];
    };
    expect(WL[DS]?.block).toContain('first: cr_brine_lamprey ×2 (60%). return: pool(drowned) 20%.');
    expect(shape(DS, 'enc_stair_lampreys')).toEqual([['cr_brine_lamprey×2'], 0.6, 'never', true, true, 'scatter']);
    expect(WL[TW]?.block).toContain('first: cr_tide_clerk ×1 + cr_drowned_archivist ×1 (100%).');
    expect(shape(TW, 'enc_tidewell_clerk_archivist')).toEqual([['cr_tide_clerk×1', 'cr_drowned_archivist×1'], 1, 'never', true, true, 'scatter']);
    expect(WL[CI]?.block).toContain('first: cr_pale_diver ×2 (70%). return: pool 20%.');
    expect(shape(CI, 'enc_cistern_divers')).toEqual([['cr_pale_diver×2'], 0.7, 'never', true, true, 'scatter']);
    expect(WL[SY]?.block).toContain('first: cr_ledger_choir ×1 + cr_drowned_archivist ×2 (100%; elite guard).');
    expect(shape(SY, 'enc_scriptorium_choir')).toEqual([['cr_ledger_choir×1', 'cr_drowned_archivist×2'], 1, 'never', true, true, 'scatter']);
    expect(WL[BS]?.block).toContain('first: cr_brine_lamprey ×3 (100%).');
    expect(shape(BS, 'enc_sluice_lampreys')).toEqual([['cr_brine_lamprey×3'], 1, 'never', true, true, 'scatter']);
    expect(WL[BM]?.block).toContain('first: cr_bell_ringer ×1 + cr_drowned_archivist ×1 (100%).');
    expect(shape(BM, 'enc_bellmouth_ringer')).toEqual([['cr_bell_ringer×1', 'cr_drowned_archivist×1'], 1, 'never', true, true, 'scatter']);
    const boss = e(BW, 'enc_deep_bell_warden');
    expect([boss.groups, boss.fleeable, boss.onFlee, boss.chance, boss.optionalWhen]).toEqual([[{ creatureId: WARDEN, count: 1 }], false, 'hold', 1, { echo: 'echo_rhune_choice' }]);
    expect(WL[BW]?.block).toContain('**forced boss:** cr_bell_warden ×1 (adds cr_brine_lamprey). Pacifist bypass exists (see §10).');
    // §10.4: the scatter nodes and the two guaranteed elites
    const row = tableRows(section(WORLD, '### 10.4 Elites', '### 10.5')).find((c) => c[0] === 'drowned_reach');
    expect(row?.[1]).toBe('cr_ledger_choir (SY, 100%); cr_bell_ringer (BM, 100%)');
    expect(row?.[3]).toBe('TW, SY, BS, BM');
  });

  test('return rolls at WORLD’s chances, each ahead of the pool’s 20 %; the Black Sluice, the Bellmouth and the Deep name no pool, so they are `safe` (no wandering roll)', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const back = (l: string, id: string) => [e(l, id).chance, e(l, id).respawn, e(l, id).once, e(l, id).groups.map((g) => `${g.creatureId}×${g.count}`)];
    expect(WL[TW]?.block).toContain('return: cr_tide_clerk ×1 (30%) or pool 20%.');
    expect(back(TW, 'enc_tidewell_clerk')).toEqual([0.3, 'on_return', false, ['cr_tide_clerk×1']]);
    expect(WL[SY]?.block).toContain('return: cr_drowned_archivist ×2 (30%) or pool 20%. Loop 3+: cr_unmade ×1 (20%).');
    expect(back(SY, 'enc_scriptorium_archivists')).toEqual([0.3, 'on_return', false, ['cr_drowned_archivist×2']]);
    expect(back(SY, 'enc_scriptorium_unmade')).toEqual([0.2, 'on_return', false, ['cr_unmade×1']]);
    expect(e(SY, 'enc_scriptorium_unmade').when).toEqual({ loop: { min: 3 } });
    expect(loc(SY).encounters.map((x) => x.id)).toEqual(['enc_scriptorium_choir', 'enc_scriptorium_unmade', 'enc_scriptorium_archivists']);
    expect(WL[BS]?.block).toContain('return: cr_brine_lamprey ×2 (40%).');
    expect(back(BS, 'enc_sluice_lampreys_return')).toEqual([0.4, 'on_return', false, ['cr_brine_lamprey×2']]);
    expect(WL[BM]?.block).toContain('return: cr_pale_diver ×2 (35%).');
    expect(back(BM, 'enc_bellmouth_divers')).toEqual([0.35, 'on_return', false, ['cr_pale_diver×2']]);
    expect([DS, TW, CI, LR, SY, BS, BM, BW].map((id) => loc(id).safe)).toEqual([false, false, false, true, false, true, true, true]);
  });

  test('events: every WORLD event, its text verbatim, legacy-less ids as WORLD spells them, once; WORLD’s conditions, grants and time cost', () => {
    for (const l of parsedLocations) {
      const got = Object.fromEntries(l.events.filter((e) => e.id !== 'ev_cistern_names_plain').map((e) => [e.id, e.text]));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.events]);
      for (const e of l.events) expect([e.id, e.trigger, e.once]).toEqual([e.id, 'enter', true]);
    }
    const ev = (l: string, id: string) => byId(loc(l).events, id);
    expect(ev(TW, 'ev_tidewell_ledger').effects).toEqual([{ grantEcho: 'echo_rhune_choice' }]);
    expect(WL[TW]?.block).toContain('— once; grants `echo_rhune_choice`.');
    expect(ev(SY, 'ev_scriptorium_hand').effects).toEqual([{ grantEcho: 'echo_oriel_lineage' }]);
    expect(WL[SY]?.block).toContain('— once; grants `echo_oriel_lineage`.');
    expect(ev(BM, 'ev_bellmouth_note').when).toEqual({ echo: 'echo_litany_verse_1' });
    expect(WL[BM]?.block).toContain('— once, requires `echo_litany_verse_1`.');
    // DESIGN §9: "Drowned Reach sluice draining 1 watch"
    expect(ev(BS, 'ev_sluice_pull').effects).toEqual([{ passWatches: 1 }]);
    expect(DESIGN).toContain('Drowned Reach sluice draining 1 watch');
  });

  test('the Names event is two events with complementary `when`s: the grant with Remnants ≥ 20, the same text without it', () => {
    const grant = byId(loc(CI).events, 'ev_cistern_names');
    const plain = byId(loc(CI).events, 'ev_cistern_names_plain');
    expect([grant.text, plain.text]).toEqual([WL[CI]?.events['ev_cistern_names'], WL[CI]?.events['ev_cistern_names']]);
    expect(WL[CI]?.block).toContain('grants `echo_oriel_lineage` with `{rep:{faction:"remnants",min:20}}`');
    expect([grant.when, grant.effects]).toEqual([{ rep: { faction: 'remnants', min: 20 } }, [{ grantEcho: 'echo_oriel_lineage' }]]);
    expect([plain.when, plain.effects]).toEqual([{ not: { rep: { faction: 'remnants', min: 20 } } }, []]);
    for (const rep of [0, 19, 20, 60]) {
      const s = stateAt(CI, { reputation: { remnants: rep } });
      const fires = [grant, plain].map((e) => evaluate(e.when as Condition, s, profileOf(), pack));
      expect([rep, fires]).toEqual([rep, rep >= 20 ? [true, false] : [false, true]]);
    }
  });

  test('NPC placement: both NPCs of the Rest are placed there, and nowhere else', () => {
    expect(WL[LR]?.npcIds).toEqual(['npc_sedge_marrow', 'npc_pellam']);
    expect(loc(LR).npcs).toEqual(['npc_sedge_marrow', 'npc_pellam']);
    for (const l of parsedLocations) if (l.id !== LR) expect([l.id, l.npcs]).toEqual([l.id, []]);
  });

  test('art: WORLD’s horizon per block, the undercity templates, the camp at the Rest, the cavern at the Deep', () => {
    expect(parsedLocations.map((l) => [l.id, l.art.template, l.art.horizon])).toEqual(
      [DS, TW, CI, LR, SY, BS, BM, BW].map((id) => [id, { [DS]: 'undercity', [TW]: 'undercity', [CI]: 'undercity', [LR]: 'camp', [SY]: 'archive', [BS]: 'undercity', [BM]: 'undercity', [BW]: 'cavern' }[id], WL[id]?.horizon]),
    );
    expect(WL[DS]?.horizon).toBe(0.7);
    expect(loc(DS).tags).toContain('dark_gate');
    expect(loc(BW).tags).toEqual(['boss', 'regional_boss']);
  });
});

// ---- Map data (WORLD §11) -------------------------------------------------------------------------------------------------------

describe('WORLD §11 map data', () => {
  test('§11.1 nodes: coordinates, band, rest, merchant; the settlement is the Rest', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable]);
      const rest = l.rest === undefined ? '—' : l.rest.when === undefined ? l.rest.kind : 'cond';
      expect([l.id, rest, l.merchantId ?? '—']).toEqual([l.id, n?.rest, n?.merchant]);
      expect([l.id, l.tags.includes('settlement')]).toEqual([l.id, n?.settlement]);
    }
  });

  test('§11.2 edges: every walk edge touching the region exists with its direction, cost and gate on both sides', () => {
    const walks = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(walks.map((e) => `${e.from}>${e.to}`)).toEqual([
      `${SA}>${DS}`,
      `loc_heartstone_depths>${CI}`,
      `${DS}>${TW}`,
      `${DS}>${CI}`,
      `${TW}>${LR}`,
      `${CI}>${LR}`,
      `${CI}>${BS}`,
      `${LR}>${SY}`,
      `${LR}>${BM}`,
      `${SY}>${BW}`,
      `${BS}>${BM}`,
      `${BM}>${BW}`,
    ]);
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
    // the Archives' side of the stair resolves (U42 wrote it)
    expect(pack.locations[SA]?.exits.find((x) => x.to === DS)?.dir).toBe('west');
    expect(pack.locations[DS]).toBeDefined();
  });

  test('§11.3 gates: the dark gate, the Cistern’s crack and the Sluice walkway carry WORLD’s conditions', () => {
    const gates = Object.fromEntries(tableRows(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).map((c) => [unquote(c[0] ?? ''), unquote(c[2] ?? '')]));
    const exit = (from: string, to: string) => loc(from).exits.find((e) => e.to === to)?.when;
    expect(exit(DS, TW)).toEqual(worldCondition(gates['gate_drowned_dark'] ?? ''));
    expect(exit(DS, CI)).toEqual(worldCondition(gates['gate_drowned_dark'] ?? ''));
    expect(exit(DS, TW)).toEqual({ item: { id: LANTERN } });
    expect(exit(CI, 'loc_heartstone_depths')).toEqual(worldCondition(gates['gate_cistern_crack'] ?? ''));
    expect(exit(BS, BM)).toEqual(worldCondition(gates['gate_sluice_walkway'] ?? ''));
    expect(exit(BM, BS)).toEqual(worldCondition(gates['gate_sluice_walkway'] ?? ''));
    // the dark gate has no Echo alternative (WORLD §3.6): the exits' conditions hold nothing else
    expect(JSON.stringify(exit(DS, TW))).not.toContain('echo');
    expect(S36).toContain('(no Echo\nalternative; the Lantern is placed in the Archives and sold by Kaelen from Loop 2)');
  });

  // The BFS runs over every landed location of the real pack (other regions may land beside this one: D-090).
  const reach = (open: (cond: Condition) => boolean): Map<string, number> => {
    const dist = new Map<string, number>([[WR, 0]]);
    const queue = [WR];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i] ?? '';
      for (const exit of pack.locations[at]?.exits ?? []) {
        if (pack.locations[exit.to] === undefined || dist.has(exit.to)) continue;
        if (exit.when !== undefined && !open(exit.when)) continue;
        dist.set(exit.to, (dist.get(at) ?? 0) + exit.travelWatches);
        queue.push(exit.to);
      }
    }
    return dist;
  };

  test('reachability from loc_whispering_ruins: the Stair is 2 watches away, ungated; the lantern opens the other seven (WORLD §3.13, §10.3)', () => {
    const none = reach(() => false);
    expect(none.get(DS)).toBe(2);
    expect([TW, CI, LR, SY, BS, BM, BW].map((id) => none.has(id))).toEqual([false, false, false, false, false, false, false]);
    // WORLD §11.3: "with no gate satisfied, 11 nodes are reachable (… DS)"
    expect(section(WORLD, '### 11.3', '### 11.4')).toContain('(WR, CA, DC, SL, SP, SA, MP, WY, IC, CW, DS)');
    // Loop 1 terms: items and the night rule satisfiable, Echo-only terms closed (the crack's key is the Warden's)
    const loop1 = reach((cond) => !JSON.stringify(cond).includes('"echo"') || JSON.stringify(cond).includes('"item"'));
    expect([DS, TW, CI, LR, SY, BS, BM, BW].map((id) => loop1.get(id))).toEqual([2, 3, 3, 4, 5, 4, 5, 6]);
    // §3.13: "beyond the Stair (3+)"; §10.3 through-route SA→DS→TW→LR is 3 watches from the Archives, +2 to the Scriptorium and the Deep
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'drowned_reach') ?? [];
    expect(row[3]).toBe('SA→DS→TW→LR · LR→SY→BW');
    expect(row[4]).toBe('3 · +2');
    expect([(loop1.get(LR) ?? 0) - (loop1.get(SA) ?? 0), (loop1.get(BW) ?? 0) - (loop1.get(LR) ?? 0)]).toEqual([3, 2]);
    // the pacifist path of §10.4: SA→DS→CI→LR avoiding TW
    expect(tableRows(section(WORLD, '### 10.4 Elites', '### 10.5')).find((c) => c[0] === 'drowned_reach')?.[4]).toBe('SA→DS→CI→LR (DS 60%, CI 70%; avoid TW)');
    // the crack: opened by the destroyed Heartstone from the Cistern, the Depths reach the Cistern only with the lantern as well
    const crack = reach((cond) => JSON.stringify(cond).includes('flag_heartstone_destroyed') || JSON.stringify(cond).includes('"item"') || !JSON.stringify(cond).includes('"echo"'));
    expect(crack.has(CI)).toBe(true);
  });

  test('§10.3 row: 8 nodes, sweep 7 watches, fights 6.3 first / 2.0 return (through-route 1.6 / 0.6), worst node 2 from a rest point, rest point LR camp', () => {
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'drowned_reach') ?? [];
    expect(row.slice(1, 3)).toEqual(['4–8', '8']);
    // the sweep: the shortest walk from the Stair that visits every node of the region (a breadth-first search over visited sets)
    const inside = new Map<string, string[]>(parsedLocations.map((l) => [l.id, l.exits.map((e) => e.to).filter((t) => here.has(t))]));
    const ordered = [...inside.keys()];
    const full = (1 << ordered.length) - 1;
    const start = (ordered.indexOf(DS) << 0) | 0;
    let frontier = new Set<string>([`${start}:${1 << start}`]);
    const seen = new Set(frontier);
    let walk = 0;
    while (![...frontier].some((k) => Number(k.split(':')[1]) === full)) {
      const next = new Set<string>();
      for (const key of frontier) {
        const [at, mask] = key.split(':').map(Number) as [number, number];
        for (const to of inside.get(ordered[at] ?? '') ?? []) {
          const j = ordered.indexOf(to);
          const k = `${j}:${mask | (1 << j)}`;
          if (!seen.has(k)) {
            seen.add(k);
            next.add(k);
          }
        }
      }
      frontier = next;
      walk += 1;
    }
    expect(walk).toBe(Number(row[6]));
    expect(row[6]).toBe('7');

    // expected fights (WORLD §10.0): a first group counts its chance; "X (p%) or pool 20 %" counts p + (1 − p)·0.2; a node with
    // no pool counts p alone; a settlement none; the boss counts 1 on the first visit
    const fixed = (l: Location) => l.encounters.filter((e) => e.respawn !== 'on_return' && !JSON.stringify(e.when ?? {}).includes('"loop"'));
    const firstVisit = (ids2: string[]): number => ids2.reduce((sum, id) => sum + (loc(id).safe && loc(id).encounters.length === 0 ? 0 : fixed(loc(id)).reduce((p, e) => p + e.chance, 0)), 0);
    const returning = (ids2: string[]): number =>
      ids2.reduce((sum, id) => {
        const l = loc(id);
        if (l.id === BW || (l.safe && l.encounters.length === 0)) return sum;
        const own = l.encounters.filter((e) => e.respawn === 'on_return' && !JSON.stringify(e.when ?? {}).includes('"loop"'));
        const pool = l.safe ? 0 : region.returnEncounterChance;
        return sum + (1 - own.reduce((p, e) => p * (1 - e.chance), 1) * (1 - pool));
      }, 0);
    const all = [DS, TW, CI, LR, SY, BS, BM, BW];
    expect(firstVisit(all).toFixed(1)).toBe('6.3');
    expect(returning(all).toFixed(1)).toBe('2.0');
    expect(row[7]).toBe('6.3 / 2.0');
    expect(row[5]).toBe('1.6 / 0.6 · +2.0 / +0.5');
    expect(firstVisit([DS, TW]).toFixed(1)).toBe('1.6');
    expect(returning([DS, TW]).toFixed(1)).toBe('0.6');
    expect(firstVisit([SY, BW]).toFixed(1)).toBe('2.0');
    // "to rest": the worst node's distance to Lamplighters' Rest
    const dist = (from: string): number => {
      const d = new Map<string, number>([[from, 0]]);
      const q = [from];
      for (let i = 0; i < q.length; i++) for (const t of inside.get(q[i] ?? '') ?? []) if (!d.has(t)) (d.set(t, (d.get(q[i] ?? '') ?? 0) + 1), q.push(t));
      return d.get(LR) ?? Infinity;
    };
    expect(Math.max(...all.map(dist))).toBe(Number(row[8]));
    expect(row[8]).toBe('2');
    expect(row[9]).toBe('LR camp');
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6.3', () => {
  const MINE = ['cr_tide_clerk', 'cr_pale_diver', 'cr_brine_lamprey', 'cr_ledger_choir', 'cr_bell_ringer', 'cr_bell_warden'];

  test('exactly the creatures whose first region is the Reach (D-090), in WORLD’s order; the Archivist stays in the Ruins', () => {
    const first = Object.values(CREATURE_TABLE).filter((r) => /^(Drowned Reach|loc_tidewell_hall|loc_cistern_of_names|loc_drowned_stair|loc_black_sluice|loc_bell|loc_sunken_scriptorium)/.test(r.regions)).map((r) => r.id);
    expect([...first].sort()).toEqual([...MINE].sort());
    expect(creatures.map((c) => c.id)).toEqual(MINE);
    expect(CREATURE_TABLE['cr_drowned_archivist']?.regions).toMatch(/^Ruins\b|^loc_sunken_archives|^Silverwood/);
  });

  test('name, family, role, level and XP as WORLD’s table; XP follows DESIGN §6.2 (fodder round(20 + 8L + 1.2L²), elite ×1.8; the boss is hand-set 500)', () => {
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, row?.name.startsWith(c.name), c.family, c.role, c.level, c.xp]).toEqual([c.id, true, row?.family, row?.role, row?.level, row?.xp]);
    }
    const fodder = (L: number): number => Math.round(20 + 8 * L + 1.2 * L * L);
    for (const c of creatures) if (c.role !== 'boss') expect([c.id, c.xp]).toEqual([c.id, Math.round(fodder(c.level) * (c.role === 'elite' ? 1.8 : 1))]);
    // regional boss: band top + 2; 400–1,200 hand-set
    expect([cr(WARDEN).level, cr(WARDEN).xp]).toEqual([region.levelBand.max + 2, 500]);
    expect(cr(WARDEN).xp).toBeGreaterThanOrEqual(400);
    expect(cr(WARDEN).xp).toBeLessThanOrEqual(1200);
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK; the boss’s HP is 12 × (30 − 5 armor) = 300 (D-067.20)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
    expect(cr(WARDEN).stats).toEqual({ hp: 300, atk: 20, sp: 20, armor: 5, ward: 4, agi: 5 });
    expect(12 * (30 - cr(WARDEN).stats.armor)).toBe(300);
    expect(WORLD).toContain('Drowned Reach (top 8, ATK 25) 30');
  });

  test('resistances and immunities as WORLD’s Resist line; every Drowned is breach-born (Poison-immune) and carries the `drowned` tag; the boss is Stun-immune and Stagger-able', () => {
    const resistLine = (id: string) => {
      const text = bullet(block(id), 'Resist:');
      const types = (label: string): string[] => (new RegExp(`(?:^|· )${label} ([^·]+)`).exec(text)?.[1] ?? '').split(',').map((s) => s.trim().replace(/\s*\(.*$/, '')).filter((t) => /^(physical|fire|storm|ley|void|chrono)$/.test(t));
      const immune = (/(?:status )?immune:? ([a-z, ]+)/.exec(text)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      return { weak: types('weak'), resist: types('resist'), immune };
    };
    for (const c of parsedCreatures) {
      const w = resistLine(c.id);
      const weak = Object.entries(c.resistances).filter(([, r]) => r === 'weak').map(([t]) => t).sort();
      const resist = Object.entries(c.resistances).filter(([, r]) => r === 'resist').map(([t]) => t).sort();
      expect([c.id, weak, resist]).toEqual([c.id, [...w.weak].sort(), [...w.resist].sort()]);
      expect([c.id, [...c.statusImmunities].sort()]).toEqual([c.id, w.immune.map((s) => `status_${s}`).sort()]);
      expect([c.id, c.tags.includes('breach_born'), c.tags.includes('drowned'), c.statusImmunities.includes('status_poison')]).toEqual([c.id, true, true, true]);
      expect([c.id, c.resistances['ley']]).toEqual([c.id, undefined]); // D-067.19: none is weak to Ley
    }
    expect([cr('cr_bell_ringer').resistances['void'], cr(WARDEN).interruptible, cr(WARDEN).fleeable]).toEqual(['weak', true, false]);
    expect(bullet(block(WARDEN), 'Resist:')).toContain('Stagger allowed');
    expect(cr(WARDEN).tags).toContain('regional_boss');
  });

  test('moves: exactly WORLD’s intent ids with their telegraph lines verbatim; every move reached by a pattern; telegraphs ≤ 12 words', () => {
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
      const unused = Object.keys(c.moves).filter((id) => !used.has(id));
      expect([c.id, unused]).toEqual([c.id, []]);
      for (const m of Object.values(c.moves)) expect([c.id, m.line, words(m.line) <= 12]).toEqual([c.id, m.line, true]);
    }
    // the Great Toll is WORLD's id ("then `warden_great_toll`") with a telegraph WORLD does not give: written here
    expect(cr(WARDEN).moves['warden_lift']).toMatchObject({ hidden: true, windUp: { turns: 1, then: 'warden_great_toll' } });
    expect(cr(WARDEN).moves['warden_great_toll']?.line).toBe('The clapper falls. The whole well rings with it.');
    expect(cr(WARDEN).moves['warden_great_toll']?.hidden).toBe(true);
  });

  test('moves carry WORLD’s numbers: the multiplier and stat, type, statuses and their chances, heals, shields, revives, the summon', () => {
    const m = (c: string, id: string) => cr(c).moves[id];
    const hit = (c: string, id: string) => [m(c, id)?.type, m(c, id)?.power?.coef, m(c, id)?.power?.stat];
    const rows = (c: string, id: string) => m(c, id)?.statuses.map((s) => [s.status.slice('status_'.length), s.chance, s.duration, s.target]);
    expect(rows('cr_tide_clerk', 'clerk_check_name')).toEqual([['mark', 1, 3, 'target']]);
    expect(hit('cr_tide_clerk', 'clerk_stamp')).toEqual(['physical', 1.2, 'atk']);
    expect(rows('cr_tide_clerk', 'clerk_stamp')).toEqual([['stun', 0.15, 1, 'target']]);
    expect(hit('cr_tide_clerk', 'clerk_strike_out')).toEqual(['physical', 0.9, 'atk']);
    expect(rows('cr_tide_clerk', 'clerk_strike_out')).toEqual([['weaken', 0.4, 2, 'target']]);
    expect(hit('cr_pale_diver', 'diver_grapple')).toEqual(['physical', 0.9, 'atk']);
    expect(rows('cr_pale_diver', 'diver_grapple')).toEqual([['slow', 0.6, 2, 'target']]);
    expect(hit('cr_pale_diver', 'diver_hold_under')).toEqual(['physical', 1.4, 'atk']);
    expect(rows('cr_pale_diver', 'diver_hold_under')).toEqual([['soaked', 1, 3, 'target']]);
    expect(rows('cr_pale_diver', 'diver_rise')).toEqual([['phase', 1, 1, 'self']]);
    expect(hit('cr_brine_lamprey', 'lamprey_latch')).toEqual(['physical', 0.8, 'atk']);
    expect(rows('cr_brine_lamprey', 'lamprey_latch')).toEqual([['bleed', 0.5, 3, 'target']]);
    expect(hit('cr_brine_lamprey', 'lamprey_drink')).toEqual(['physical', 0.6, 'atk']);
    expect(m('cr_brine_lamprey', 'lamprey_drink')?.effects).toEqual([{ healOnDamage: { pct: 1 } }]); // heals self for 100 % of damage dealt
    expect(rows('cr_brine_lamprey', 'lamprey_eddy')).toEqual([['phase', 1, 1, 'self']]);
    expect(hit('cr_ledger_choir', 'choir_intone')).toEqual(['ley', 0.8, 'sp']);
    expect(rows('cr_ledger_choir', 'choir_intone')).toEqual([['weaken', 0.4, 2, 'target']]);
    expect(m('cr_ledger_choir', 'choir_amend')?.heal).toMatchObject({ target: 'ally', power: { coef: 1.5, stat: 'atk' } });
    expect(m('cr_ledger_choir', 'choir_reinscribe')?.revive).toEqual({ hpPct: 0.4 });
    expect(hit('cr_ledger_choir', 'choir_verse')).toEqual(['ley', 1.4, 'sp']);
    expect(rows('cr_ledger_choir', 'choir_verse')).toEqual([['soaked', 1, 3, 'target']]);
    expect(hit('cr_bell_ringer', 'ringer_low_note')).toEqual(['storm', 0.7, 'sp']);
    expect(rows('cr_bell_ringer', 'ringer_low_note')).toEqual([['shock', 0.4, 2, 'target']]);
    expect(m('cr_bell_ringer', 'ringer_stand_them_up')?.revive).toEqual({ hpPct: 0.5 });
    expect(hit('cr_bell_ringer', 'ringer_rope')).toEqual(['physical', 1.2, 'atk']);
    expect(rows('cr_bell_ringer', 'ringer_rope')).toEqual([['stun', 0.2, 1, 'target']]);
    expect(m('cr_bell_ringer', 'ringer_shell')?.shield?.power).toEqual({ base: 0, coef: 1.5, stat: 'atk', hits: 1 });
    expect(hit(WARDEN, 'warden_toll')).toEqual(['storm', 0.8, 'sp']);
    expect(rows(WARDEN, 'warden_toll')).toEqual([['soaked', 1, 3, 'target']]);
    expect(hit(WARDEN, 'warden_clapper')).toEqual(['physical', 1.4, 'atk']);
    expect(rows(WARDEN, 'warden_clapper')).toEqual([['armor_break', 0.4, 2, 'target']]);
    expect(hit(WARDEN, 'warden_undertow')).toEqual(['physical', 1, 'atk']);
    expect(rows(WARDEN, 'warden_undertow')).toEqual([['slow', 0.5, 2, 'target']]);
    expect(hit(WARDEN, 'warden_great_toll')).toEqual(['storm', 1.8, 'sp']);
    expect(hit(WARDEN, 'warden_ring_the_city')).toEqual(['storm', 1.2, 'sp']);
    expect(m(WARDEN, 'warden_ask')?.power).toBeUndefined(); // "no action"
    expect(m(WARDEN, 'warden_call')?.summon).toEqual({ creatureId: 'cr_brine_lamprey', count: 1, max: 2, hpPct: 1 });
  });

  test('loot: gold ranges and every item WORLD lists, with WORLD’s chances and counts (100 % = guaranteed); nothing else', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      const text = bullet(block(c.id), 'Loot:');
      const expected = [...text.matchAll(/`((?:item|mat)_[a-z0-9_]+)`†?(?: ×(\d+))? (\d+)%/g)].map((m) => [m[1], Number(m[2] ?? 1), Number(m[3]) / 100]);
      expect([c.id, c.loot.map((l) => [l.itemId, l.count, l.chance])]).toEqual([c.id, expected]);
      for (const l of c.loot) expect([c.id, l.when]).toEqual([c.id, undefined]);
    }
    // gold [3 + 2L, 6 + 3L], elite ×2, boss ×5 (DESIGN §6.5): the figures WORLD prints
    const gold = (c: Creature) => [c.gold.min, c.gold.max];
    expect(gold(cr('cr_tide_clerk'))).toEqual([13, 21]);
    expect(gold(cr('cr_bell_ringer'))).toEqual([34, 54]);
    expect(gold(cr(WARDEN))).toEqual([105, 165]);
  });

  test('bestiary voice, entry and tactics are WORLD’s text verbatim (backticks dropped); family codex entry; reveals at 1 and 3 kills; short non-legacy descriptions', () => {
    for (const c of parsedCreatures) {
      const b = block(c.id);
      const voice = /- \*\*Bestiary\*\* \((Remnant Archive|Wayfinder's Notes)\)/.exec(b)?.[1];
      expect([c.id, c.bestiary.voice]).toEqual([c.id, voice === 'Remnant Archive' ? 'remnant_archive' : 'wayfinder_notes']);
      expect([c.id, c.bestiary.summary]).toEqual([c.id, playText(bullet(b, 'Bestiary'))]);
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, playText(bullet(b, 'Tactics:'))]);
      expect(c.bestiary.codexId).toBe('codex_creatures_drowned');
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
      expect([c.id, c.legacyName, /- \*\*Legacy description:\*\*/.test(b)]).toEqual([c.id, undefined, false]); // no legacy line: the Reach's own
      expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
    }
    expect(STORY).toContain('| `codex_creatures_drowned` |');
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
  const s = makeState({ level: 12 }, { content: pack, profile });
  // one initiative draw for the player, one for each enemy (the creature first, then its group)
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1), ...Array.from({ length: 8 }, (_, i) => D.d4((i % 4) + 1))], pack, profile);
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
    const move = intent ? pack.creatures[id]?.moves[intent.moveId] : undefined;
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
/** Marks the `n`th ally of the foe (1-based) as fallen or standing. */
const ally = (combat: CombatState, n: number, standing: boolean): void => {
  const a = combat.enemies[n] as Combatant;
  a.alive = standing;
  a.hp = standing ? a.hpMax : 0;
};

describe('patterns: WORLD’s cadence words hold turn by turn (first-match on every turn; two cycled moves alternate)', () => {
  test('the Tide Clerk: Check Name first, Stamp while you are Marked, else Strike Out', () => {
    const marked = (t: number, _f: Combatant, c: CombatState): void => withStatus(player(c), 'status_mark', t === 2 || t === 3);
    expect(plan('cr_tide_clerk', 6, { before: marked })).toEqual(seq('check_name stamp stamp strike_out strike_out strike_out'));
    expect(plan('cr_tide_clerk', 3)).toEqual(seq('check_name strike_out strike_out')); // clear the Mark and it never Stamps
  });

  test('the Pale Diver: Grapple, Hold Under while you are Slowed, Rise on every third turn; Hold Under ahead of Rise', () => {
    expect(plan('cr_pale_diver', 6)).toEqual(seq('grapple grapple rise grapple grapple rise'));
    const slowed = (t: number, _f: Combatant, c: CombatState): void => withStatus(player(c), 'status_slow', t === 2 || t === 3);
    expect(plan('cr_pale_diver', 6, { before: slowed })).toEqual(seq('grapple hold_under hold_under grapple grapple rise'));
  });

  test('the Brine Lamprey: Latch; Drink while you bleed; Eddy below half HP, and not again while its Phase stands', () => {
    const hurt = (t: number, f: Combatant, c: CombatState): void => {
      withStatus(player(c), 'status_bleed', t === 2 || t === 3);
      hpAt(t >= 4 ? 0.4 : 1)(f);
      withStatus(f, 'status_phase', t === 6);
    };
    expect(plan('cr_brine_lamprey', 7, { before: hurt })).toEqual(seq('latch drink drink eddy eddy latch eddy'));
  });

  test('the Ledger Choir: Amend while a reader stands, Verse every third turn, Reinscribe once when one has fallen, Intone when it stands alone', () => {
    const readers = [{ creatureId: 'cr_drowned_archivist', count: 2 }];
    const fall = (t: number, _f: Combatant, c: CombatState): void => {
      ally(c, 1, t < 4);
      ally(c, 2, t < 7);
    };
    expect(plan('cr_ledger_choir', 9, { allies: readers, before: fall })).toEqual(seq('amend amend verse reinscribe amend verse intone intone verse'));
    expect(plan('cr_ledger_choir', 3, { allies: readers })).toEqual(seq('amend amend verse'));
  });

  test('the Bell-Ringer: Low Note and Rope in turn; stands the archivist up once; Shell below half HP, and not again while it stands', () => {
    const turn = (t: number, f: Combatant, c: CombatState): void => {
      ally(c, 1, t < 3);
      hpAt(t >= 5 ? 0.4 : 1)(f);
      withStatus(f, 'status_shield', t === 6);
    };
    expect(plan('cr_bell_ringer', 8, { allies: [{ creatureId: 'cr_drowned_archivist', count: 1 }], before: turn })).toEqual(
      seq('low_note rope stand_them_up rope shell rope shell shell'),
    );
  });

  test('the Bell-Warden: Is It the Hour? (Ask first, Call every third turn, Toll and Clapper between)', () => {
    expect(plan(WARDEN, 7, { phase: 0 })).toEqual(seq('ask clapper call clapper toll call toll'));
  });

  test('the Bell-Warden: The Water Rises (Undertow and Clapper, the hidden Lift on every third turn, then the Great Toll on the next)', () => {
    expect(plan(WARDEN, 8, { phase: 1 })).toEqual(seq('undertow clapper lift great_toll undertow lift great_toll clapper'));
  });

  test('the Bell-Warden: The Hour (Ring the City on every second turn, the Clapper between)', () => {
    expect(plan(WARDEN, 5, { phase: 2 })).toEqual(seq('clapper ring_the_city clapper ring_the_city clapper'));
  });

  test('the Bell-Warden’s phases: ids, names, triggers (65 %, 25 %), WORLD’s transition lines; Phase 1 is skipped when the Heartstone is stabilized', () => {
    const w = cr(WARDEN);
    expect(w.phases.map((p) => [p.id, p.name, p.enterWhen])).toEqual([
      ['warden_is_it_the_hour', 'Is It the Hour?', []],
      ['warden_the_water_rises', 'The Water Rises', [{ hpBelow: 0.65 }]],
      ['warden_the_hour', 'The Hour', [{ hpBelow: 0.25 }]],
    ]);
    const W = flat(block(WARDEN));
    expect(W).toContain('**Phase 1 — Is It the Hour?** (100–65%; skipped if `flag_heartstone_stabilized`');
    expect(W).toContain('**Phase 2 — The Water Rises** (<65%');
    expect(W).toContain('**Phase 3 — The Hour** (<25%)');
    expect(W).toContain(`*Transition (<65%):* "${w.phases[1]?.line}"`);
    expect(W).toContain(`*Transition (<25%):* "${w.phases[2]?.line}"`);
    expect(w.phases[0]?.skipWhen).toEqual({ flag: 'flag_heartstone_stabilized' });
    expect(w.phases[1]?.skipWhen).toBeUndefined();
    // the Phase 1 "Ask" opens the fight; the bypass is the location's (`optionalWhen`), not a phase's
    expect(W).toContain('`warden_ask`');
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the NPCs vs WORLD §4', () => {
  const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
  const rows = Object.fromEntries(tableRows(S4).filter((c) => unquote(c[0] ?? '').startsWith('npc_')).map((c) => [unquote(c[0] ?? ''), c]));
  const home = (c: string[]): string => (c[3] ?? '').replace(/\*\*stall: /, '').replace(/\*\*/g, '');

  test('exactly the NPCs whose home is in the region: Sedge Marrow and Pellam, both at Lamplighters’ Rest', () => {
    const homes = Object.values(rows).filter((c) => here.has(/^loc_[a-z_]+/.exec(home(c))?.[0] ?? ''));
    expect(npcs.map((n) => n.id).sort()).toEqual(homes.map((c) => unquote(c[0] ?? '')).sort());
    expect(npcs.map((n) => n.id)).toEqual(['npc_sedge_marrow', 'npc_pellam']);
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
    }
    expect(rows['npc_sedge_marrow']?.[5]).toBe('Remnant diver who outfits the lamplighters, and sells to Weavers too, and says so.');
    expect(byId(npcs, 'npc_sedge_marrow').description).toBe('A Remnant diver who outfits the lamplighters. He sells to the Weavers too, and says so.');
    expect(rows['npc_pellam']?.[5]).toBe('Lamplighter; keeps the lamps on every ninth step lit and counts the bell.');
    expect(byId(npcs, 'npc_pellam').description).toBe('A lamplighter. He keeps the lamps on every ninth step lit and counts the bell.');
  });

  test('roles and records: the merchant with his stall (WORLD §9 is a later unit’s), the rest keeper', () => {
    const sedge = byId(npcs, 'npc_sedge_marrow');
    const pellam = byId(npcs, 'npc_pellam');
    expect([sedge.roles, pellam.roles]).toEqual([['merchant'], ['keeper']]);
    expect([sedge.merchantId, pellam.merchantId]).toEqual(['npc_sedge_marrow', undefined]);
    expect(loc(LR).merchantId).toBe(sedge.id);
    expect(rows['npc_sedge_marrow']?.[4]).toContain('merchant');
    expect(rows['npc_pellam']?.[4]).toContain('rest keeper');
    expect(WL[LR]?.block).toContain('npc_pellam (rest keeper; Remnant Archive voice)');
  });
});

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder; the region tables are in `contentTables` and the index', () => {
    const folders = REGION_FOLDERS.map((f) => f.region.id);
    expect(folders).toContain(REGION);
    expect(folders.indexOf('region_silverwood_ruins')).toBeLessThan(folders.indexOf(REGION));
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('The Drowned Reach');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.name).toBe(c.name);
    for (const n of npcs) expect(pack.npcs[n.id]?.name).toBe(n.name);
    expect(items).toEqual([]); // the items tables are U49/U50's; this region owns none
  });

  test('validates with 0 errors; nothing real is reported about the region but the known warnings; pending references name only tables still being authored', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const about = report.warnings.filter((w) => mine.has(w.id) || locations.some((l) => w.message.includes(` ${l.id}`)));
    const real = about.filter((w) => !w.message.startsWith('pending — content not yet authored'));
    // the Drowned Archivist (L4, the Ruins' fodder) at the Bellmouth (band 7): rule 11 reads it as the elite's escort, 3 levels down.
    // WORLD §3.6 places it there ("cr_bell_ringer ×1 + cr_drowned_archivist ×1"), so the record is WORLD's and the warning stays.
    expect(real.map((w) => `${w.rule} ${w.id} ${w.path}`).sort()).toEqual(['rule-11 cr_drowned_archivist level']);
    expect(real[0]?.message).toContain(BM);
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
    expect(text).toMatch(/validate: ok — 0 errors, \d+ warning\(s\), \d+ pending completeness check\(s\), \d+ pending reference\(s\)/);
  });

  test('this region’s pending references name only ids WORLD/STORY/DESIGN spell (other regions’ locations, items, quests, Echoes, the Unmade, codex entries); the Archives, the Depths and the Archivist now resolve', () => {
    const { report } = parseContentPack(contentTables);
    const targets = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    // Later units resolve these one by one (items U49/U50, quests U52–U59, Echoes, the merchants, the Unmade): the list may only shrink
    const known = new Set([
      'item_glyphbound_lantern', 'item_brine_draught', 'item_lantern_oil', 'item_litany_page_1', 'item_oriels_ledger', 'item_cistern_key', 'item_rhunes_hydromancy',
      'item_bell_clapper', 'item_bell_shard', 'item_remnant_ink',
      'mat_sodden_vellum', 'mat_drowned_pearl', 'mat_bell_bronze',
      'echo_rhune_choice', 'echo_oriel_lineage', 'echo_litany_verse_1', 'echo_archive_door',
      'cr_unmade',
      'npc_sedge_marrow', // the merchant record (WORLD §9)
      'remnants', // the faction record (region.factionId, npc factions)
      'codex_region_drowned_reach', 'codex_creatures_drowned',
    ]);
    expect([...targets].filter((t) => !known.has(t)).sort()).toEqual([]);
    for (const t of [SA, 'loc_heartstone_depths', 'cr_drowned_archivist', WR, DS]) expect([t, targets.has(t)]).toEqual([t, false]);
    // every one is an id the documents spell
    const docs = `${WORLD}\n${STORY}\n${DESIGN}`;
    for (const id of targets) expect([id, docs.includes(id)]).toEqual([id, true]);
  });
});

// ---- The engine on the real pack ------------------------------------------------------------------------------------------------

describe('the region in the engine (real pack, seeded)', () => {
  test('the dark gate: from the Stair only the Archives without the lantern; the lantern opens Tidewell Hall and the Cistern; the Archives’ stair reaches the Stair', () => {
    expect(movesFrom(SA)).toContain(DS);
    expect(arrive(SA, DS).world.currentLocationId).toBe(DS);
    expect(movesFrom(DS)).toEqual([SA]);
    expect(movesFrom(DS, { loop: 3, echoes: ['echo_archive_door', 'echo_rhune_choice'] })).toEqual([SA]); // no Echo alternative
    expect(movesFrom(TW)).toEqual([DS, LR].sort());
    // the lantern (carried: no record exists yet, so the exits' conditions are read directly)
    expect([TW, CI].map((to) => [exitOpen(DS, to), exitOpen(DS, to, { carrying: [LANTERN] })])).toEqual([[false, true], [false, true]]);
    expect(exitOpen(DS, SA)).toBe(true);
  });

  test('the Sluice walkway floods at night, both ways, unless you carry the key; the Cistern’s crack needs the key, the Archive’s door or the destroyed Heartstone', () => {
    for (const [from, to] of [[BS, BM], [BM, BS]] as const) {
      expect([from, exitOpen(from, to, { watch: 0 })]).toEqual([from, true]);
      expect([from, exitOpen(from, to, { watch: 1 })]).toEqual([from, true]);
      expect([from, exitOpen(from, to, { watch: 2 })]).toEqual([from, true]);
      expect([from, exitOpen(from, to, { watch: 3 })]).toEqual([from, false]);
      expect([from, exitOpen(from, to, { watch: 3, carrying: [KEY] })]).toEqual([from, true]);
    }
    // and in the engine: the walkway is a legal move by day, not by night (no item needed)
    expect(movesFrom(BS, { watch: 1 })).toContain(BM);
    expect(movesFrom(BS, { watch: 3 })).not.toContain(BM);
    const crack = (o: At = {}): boolean => exitOpen(CI, 'loc_heartstone_depths', o);
    expect(crack()).toBe(false);
    expect(crack({ carrying: [KEY] })).toBe(true);
    expect(crack({ flags: { flag_heartstone_destroyed: true } })).toBe(true);
    expect(crack({ loop: 2, echoes: ['echo_archive_door'] })).toBe(true);
    expect(movesFrom(CI)).not.toContain('loc_heartstone_depths');
    expect(movesFrom(CI, { flags: { flag_heartstone_destroyed: true } })).toContain('loc_heartstone_depths');
  });

  test('the first visit to the Stair (400 seeds): about 60 % two lampreys, 40 % nothing; the fight is fleeable', () => {
    const tally = { lampreys: 0, none: 0, other: 0 };
    const N = 400;
    for (let i = 0; i < N; i++) {
      const s = arrive(SA, DS, { seed: `u46-${i}` });
      if (s.mode !== 'combat') tally.none += 1;
      else if (s.combat?.encounterId === 'enc_stair_lampreys' && s.combat.enemies.length === 2 && s.combat.canFlee) tally.lampreys += 1;
      else tally.other += 1;
    }
    expect(tally.other).toBe(0);
    expect(tally.lampreys / N).toBeGreaterThan(0.51);
    expect(tally.lampreys / N).toBeLessThan(0.69);
  });

  test('the Bell-Warden’s Deep: a held boss fight without the Echo; with `echo_rhune_choice` the fight is skipped; with the Heartstone stabilized the fight opens on Phase 2', () => {
    const fight = arrive(BM, BW);
    expect(fight.mode).toBe('combat');
    expect(fight.combat).toMatchObject({ encounterId: 'enc_deep_bell_warden', canFlee: false, onFlee: 'hold' });
    expect(fight.combat?.enemies.map((e) => [e.refId, e.phase])).toEqual([[WARDEN, 0]]);
    const said = arrive(BM, BW, { loop: 2, echoes: ['echo_rhune_choice'] });
    expect(said.mode).toBe('explore');
    expect(said.world.currentLocationId).toBe(BW);
    const calm = arrive(BM, BW, { flags: { flag_heartstone_stabilized: true } });
    expect(calm.combat?.enemies.map((e) => [e.refId, e.phase])).toEqual([[WARDEN, 1]]);
  });

  test('the Scriptorium’s first visit is the Choir and two readers (100 %, fleeable scatter); the Bellmouth’s the Ringer and one reader', () => {
    const sy = arrive(LR, SY, {}, ['ev_scriptorium_hand']);
    expect(sy.combat).toMatchObject({ encounterId: 'enc_scriptorium_choir', canFlee: true, onFlee: 'scatter' });
    expect(sy.combat?.enemies.map((e) => e.refId)).toEqual(['cr_ledger_choir', 'cr_drowned_archivist', 'cr_drowned_archivist']);
    const bm = arrive(LR, BM);
    expect(bm.combat).toMatchObject({ encounterId: 'enc_bellmouth_ringer', canFlee: true, onFlee: 'scatter' });
    expect(bm.combat?.enemies.map((e) => e.refId)).toEqual(['cr_bell_ringer', 'cr_drowned_archivist']);
  });

  test('the Black Sluice and the Bellmouth roll no pool on a return (WORLD names none), Tidewell Hall does; the Rest rolls nothing at all (200 seeds each)', () => {
    /** A return visit to `to`: it has been entered before (its first-visit fight is behind the player). */
    const back = (from: string, to: string, i: number): GameState => {
      const s = stateAt(from, { seed: `u46-back-${i}` });
      s.world.locationStates[to] = {
        visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: loc(to).encounters.filter((e) => e.respawn === 'never').map((e) => e.id), encounterClearedDay: {}, eventsFired: ['ev_sluice_pull', 'ev_bellmouth_note'], flags: {},
        unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
      };
      return step(s, { type: 'move', to }, pack, profileOf()).state;
    };
    const fights = (from: string, to: string): Map<string, number> => {
      const tally = new Map<string, number>();
      for (let i = 0; i < 200; i++) {
        const s = back(from, to, i);
        if (s.mode === 'combat') tally.set(s.combat?.encounterId ?? '?', (tally.get(s.combat?.encounterId ?? '?') ?? 0) + 1);
      }
      return tally;
    };
    // the Sluice: only its own 40 % group; the Bellmouth: only its own 35 % group
    expect([...fights(CI, BS).keys()]).toEqual(['enc_sluice_lampreys_return']);
    expect([...fights(LR, BM).keys()]).toEqual(['enc_bellmouth_divers']);
    expect((fights(CI, BS).get('enc_sluice_lampreys_return') ?? 0) / 200).toBeGreaterThan(0.3);
    expect((fights(CI, BS).get('enc_sluice_lampreys_return') ?? 0) / 200).toBeLessThan(0.5);
    expect((fights(LR, BM).get('enc_bellmouth_divers') ?? 0) / 200).toBeGreaterThan(0.25);
    expect((fights(LR, BM).get('enc_bellmouth_divers') ?? 0) / 200).toBeLessThan(0.45);
    // Tidewell Hall: the Clerk's 30 %, then the pool's 20 % of what is left (about 44 % in all), the pool's creatures among them
    const tw = fights(LR, TW);
    const total = [...tw.values()].reduce((a, b) => a + b, 0);
    expect(total / 200).toBeGreaterThan(0.34);
    expect(total / 200).toBeLessThan(0.54);
    expect([...tw.keys()].sort()).toEqual(['enc_tidewell_clerk', 'wandering'].sort());
    // Lamplighters' Rest: a settlement, first or return
    for (let i = 0; i < 200; i++) expect(arrive(TW, LR, { seed: `u46-rest-${i}` }).mode).toBe('explore');
    for (let i = 0; i < 200; i++) expect(back(TW, LR, i).mode).toBe('explore');
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U46 reply -----------------------------------------

describe('authored words outside the documents are few and short; coined ids are the listed ones', () => {
  test('encounter intros are ≤ 30 words; the non-legacy descriptions are drawn from the documents; the Great Toll’s telegraph is the one move line WORLD does not give', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro)).filter((t): t is string => t !== undefined);
    expect(intros).toHaveLength(12); // every encounter carries one
    for (const t of intros) expect([t, words(t) <= 30]).toEqual([t, true]);
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro))).not.toContain(undefined);
    expect(loc(DS).exits.map((e) => e.lockedText).filter(Boolean)).toHaveLength(2);
    for (const l of parsedLocations) for (const e of l.exits) if (e.lockedText) expect([e.lockedText, words(e.lockedText) <= 30]).toEqual([e.lockedText, true]);
  });

  test('ids this unit coined (WORLD/STORY have none for them): encounter ids, the plain Names event, the Warden’s phase ids', () => {
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.id))).toEqual([
      'enc_stair_lampreys',
      'enc_tidewell_clerk_archivist', 'enc_tidewell_clerk',
      'enc_cistern_divers',
      'enc_scriptorium_choir', 'enc_scriptorium_unmade', 'enc_scriptorium_archivists',
      'enc_sluice_lampreys', 'enc_sluice_lampreys_return',
      'enc_bellmouth_ringer', 'enc_bellmouth_divers',
      'enc_deep_bell_warden',
    ]);
    const wordedEvents = new Set(Object.values(WL).flatMap((w) => Object.keys(w.events)));
    expect(parsedLocations.flatMap((l) => l.events.map((e) => e.id)).filter((id) => !wordedEvents.has(id))).toEqual(['ev_cistern_names_plain']);
    expect(cr(WARDEN).phases.map((p) => p.id)).toEqual(['warden_is_it_the_hour', 'warden_the_water_rises', 'warden_the_hour']);
    // every move id but none is WORLD's: the creatures use WORLD's intent ids only (the Great Toll is named by the Lift's line)
    for (const c of parsedCreatures) for (const id of Object.keys(c.moves)) expect([c.id, id, WORLD.includes(`\`${id}\``)]).toEqual([c.id, id, true]);
    expect(ids(JSON.stringify(locations), 'ambient')).toEqual([]);
  });
});
