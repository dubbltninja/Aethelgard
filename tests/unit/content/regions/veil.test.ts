// U47: The Veil — checked against the documents at test time, U42's pattern (regions/silverwood_ruins.test.ts) and U46's
// (regions/drowned_reach.test.ts): WORLD §2.9, §3.8, §4, §6.1, §10.1, §10.3, §11.1–11.3, §12.1; DESIGN §6.2, §17.1, §18.2;
// PLAN Appendix A; STORY's codex ids. The region is new (no legacy text, no `legacyName`), so every description is WORLD's,
// character for character. Patterns are walked turn by turn by the engine (`generateIntent`), so every WORLD cadence word is
// held to what the game does. Where a record departs from the letter of WORLD (a reading the schema or the engine forces),
// the test pins the departure so a later edit cannot move it silently; the readings are listed in the U47 reply.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures as folderCreatures } from '@content/regions/veil/creatures';
import { items } from '@content/regions/veil/items';
import { locations } from '@content/regions/veil/locations';
import { npcs } from '@content/regions/veil/npcs';
import { region } from '@content/regions/veil/region';
import { validateContent } from '@content/validate';
import { beginCombat, evaluate, generateIntent, legalActions, step, type CombatState, type Combatant, type EncounterSpec, type GameState } from '@engine/index';
import type { Condition } from '@schema/condition';
import { CreatureSchema, walkSteps, type Creature, type Step } from '@schema/creature';
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

const REGION = 'region_veil';
const VM = 'loc_veil_mouth';
const SU = 'loc_stair_of_unmaking';
const ST = 'loc_sanctum_of_threads';
const SH = 'loc_scar_shelf';
const VY = 'loc_voidglass_gallery';
const NO = 'loc_null_orchard';
const EY = 'loc_eye_of_the_scar';
const WS = 'loc_where_she_fell';
const VH = 'loc_voidscar_hollow';
const CW = 'loc_chasm_of_whispers';
const WR = 'loc_whispering_ruins';
const UMBRA = 'cr_vells_umbra';
const LANTERN = 'cr_hollow_lantern';
const SENTRY = 'cr_veil_sentry';

const S29 = section(WORLD, '### 2.9 `region_veil`', '### 2.10');
const S38 = section(WORLD, '### 3.8 The Veil', '### 3.9');
const WL = Object.fromEntries(worldLocations(S38).map((l) => [l.id, l]));
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
/** One decimal, rounding half up (WORLD's tables print 0.35 as 0.4). */
const one = (x: number): string => (Math.round(x * 10 + 1e-9) / 10).toFixed(1);

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
  /** Kills this loop, by creature id. */
  kills?: Record<string, number>;
  /** Nyx recruited and in the party. */
  nyx?: boolean;
}

/** A state on the real pack, standing at `locationId`. */
function stateAt(locationId: string, o: At = {}): GameState {
  const overrides: StateOverrides = {
    locationId,
    seed: o.seed ?? 'u47',
    ...(o.loop === undefined ? {} : { loop: o.loop }),
    ...(o.watch === undefined ? {} : { watch: o.watch }),
    ...(o.reputation === undefined ? {} : { reputation: o.reputation }),
    flags: o.flags ?? {},
    patch: (s) => {
      for (const id of o.echoes ?? []) s.echoesThisLoop.push(id);
      for (const itemId of o.carrying ?? []) s.player.inventory.push({ uid: `i${s.meta.nextUid++}`, itemId, qty: 1, rarity: 'common', affixes: [] });
      for (const [id, n] of Object.entries(o.kills ?? {})) s.counters.kills[id] = n;
      if (o.nyx) {
        s.companions.recruited['nyx'] = { id: 'nyx', recruited: true, loyalty: 60, hp: 200, hpMax: 200, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} };
        s.companions.activeId = 'nyx';
      }
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
/** A return visit to `to`: it has been entered before (its first-visit fights are behind the player). */
const back = (from: string, to: string, i: number, o: At = {}): GameState => {
  const s = stateAt(from, { ...o, seed: `${o.seed ?? 'u47'}-back-${i}` });
  s.world.locationStates[to] = {
    visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: loc(to).encounters.filter((e) => e.respawn === 'never' && e.once).map((e) => e.id), encounterClearedDay: {},
    eventsFired: loc(to).events.map((e) => e.id), flags: {}, unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
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
/** The fights over `n` seeds of a visit: encounter id → count. */
const tally = (n: number, visit: (i: number) => GameState): Map<string, number> => {
  const out = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const s = visit(i);
    if (s.mode === 'combat') out.set(s.combat?.encounterId ?? '?', (out.get(s.combat?.encounterId ?? '?') ?? 0) + 1);
  }
  return out;
};

const WARY = { weavers: -20 } as const;

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_veil vs WORLD §2.9, §10.1, DESIGN §6.5, §17.1, §18.2', () => {
  test('id, name, new (Appendix A.1), faction, band, WORLD’s theme text, order, codex entry', () => {
    expect(region.id).toBe(REGION);
    expect(S29.startsWith(`### 2.9 \`${REGION}\` — ${region.name}`)).toBe(true);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | new | 8 |`);
    expect('legacy' in region).toBe(false); // not one of the five legacy regions (D-015)
    expect(pack.regions[REGION]?.legacy).toBe(false);
    expect(S29).toContain('| Level band | 10–14 |');
    expect(region.levelBand).toEqual({ min: 10, max: 14 });
    expect(S29).toContain('| Factions | Shadow Weavers (dominant; the Sanctum).');
    expect(region.factionId).toBe('weavers');
    const theme = /\*\*Theme\.\*\* ([\s\S]*?)\n\n\| Field/.exec(S29)?.[1] ?? '';
    expect(region.description).toBe(playText(theme));
    expect(region.order).toBe(9);
    expect(region.codexId).toBe('codex_region_veil');
    expect(STORY).toContain('| `codex_region_veil` |');
  });

  test('the eight locations WORLD lists, in WORLD’s order, all in the region', () => {
    const listed = /\| Locations \(8\) \| ([^|]+) \|/.exec(S29)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual([VM, SU, ST, SH, VY, NO, EY, WS]);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of locations) expect(l.regionId).toBe(REGION);
  });

  test('the pool is WORLD §10.1’s pool_veil, weight for weight; return chance 20 %; every entry is in-band fodder; the Wary sentry shift is a location encounter, not a pool row', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_veil');
    expect(row?.[2]).toBe('Weavers ≤ Wary: sentry 50');
    const entries = [...(row?.[1] ?? '').matchAll(/(cr_[a-z_]+) (\d+)/g)].map((m) => ({ creatureId: m[1] ?? '', weight: Number(m[2]) }));
    expect(entries.map((e) => e.creatureId)).toEqual([LANTERN, 'cr_null_mouth', SENTRY]);
    expect(region.wanderingPool).toEqual(entries);
    expect(region.returnEncounterChance).toBe(0.2);
    expect(creatures.map((c) => c.id as string)).not.toContain(SENTRY); // first region: the Voidscar (D-090)
    for (const e of region.wanderingPool) {
      const c = pack.creatures[e.creatureId];
      expect([e.creatureId, c?.role, c !== undefined && c.level >= region.levelBand.min - 2 && c.level <= region.levelBand.max + 2]).toEqual([e.creatureId, 'fodder', true]);
    }
    // the shift: 50 against 25 is 25 extra weight in a Wary pool of 125 = a fifth of the pool's 20 % return rolls = 4 % per return visit
    const extra = 50 - (region.wanderingPool.find((e) => e.creatureId === SENTRY)?.weight ?? 0);
    const wary = region.wanderingPool.reduce((n, e) => n + e.weight, 0) + extra;
    expect((extra / wary) * region.returnEncounterChance).toBeCloseTo(0.04, 10);
  });

  test('palette: DESIGN §17.1’s Veil row (sky top, sky bottom, mid, accent = glow); the ambient preset exists in §18.2', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'The Veil');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).some((c) => c[0] === 'The Veil')).toBe(true);
    expect(region.ambient).toBe('ambient_veil');
    // WORLD's extra ambient layers (the Sanctum's choir pad, Where She Fell's held sine) are additive: no location replaces the preset
    for (const l of parsedLocations) expect([l.id, l.ambient]).toEqual([l.id, undefined]);
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the eight locations vs WORLD §3.8 blocks', () => {
  test('names, bands, coordinates and region', () => {
    for (const l of locations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.levelBand, l.map]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map]);
    }
    expect(WL[EY]?.block).toContain('13 (boss) · (32, −4)');
  });

  test('descriptions: WORLD’s, character for character (the one decision reference dropped); no legacy name (a new region)', () => {
    for (const l of locations) {
      expect([l.id, l.description]).toEqual([l.id, playText(WL[l.id]?.description ?? '')]);
      expect([l.id, 'legacyName' in l]).toEqual([l.id, false]);
    }
    expect(WL[WS]?.description).toContain('crawled toward the Hollow (D-067.13).');
    expect(loc(WS).description).toContain('crawled toward the Hollow. Around the rim');
  });

  test('exits: every WORLD exit in order, the Sanctum door carries a `when` and a refusal line; every exit costs one watch', () => {
    for (const l of parsedLocations) {
      const got = l.exits.map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.exits]);
      for (const e of l.exits) expect([l.id, e.to, e.travelWatches]).toEqual([l.id, e.to, 1]);
    }
    expect(loc(SU).exits.filter((e) => e.when !== undefined).map((e) => [e.to, e.lockedText])).toEqual([[ST, 'The thread across the Sanctum door does not part for you.']]);
    expect(WL[SU]?.block).toContain('the Sanctum door is barred to the Wary and Hostile');
  });

  test('rest points and merchants as WORLD says: the inn at the Sanctum (open to Weavers ≥ −9), Hollis’s stall; nothing else rests or sells', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      // WORLD §10.3 gives the inn a condition ("ST inn (Weavers ≥ −9)") that the block's "Rest point: yes" does not
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, l.id === ST ? 'cond' : w?.rest, w?.merchant]);
    }
    expect(WL[ST]?.rest).toBe('yes');
    expect(loc(ST).rest).toMatchObject({ kind: 'inn', cost: 10, when: { rep: { faction: 'weavers', min: -9 } } });
    expect(loc(ST).merchantId).toBe('npc_hollis_cade');
    expect(tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'veil')?.[9]).toBe('ST inn (Weavers ≥ −9)');
    expect(loc(ST).rest?.when).toEqual(loc(SU).exits.find((e) => e.to === ST)?.when); // the door's condition
  });

  test('every item WORLD places is placed, with WORLD’s conditions; the Eye’s loot is the Umbra’s for the fight and the bypass’s here', () => {
    for (const l of parsedLocations) {
      expect([l.id, l.items.map((i) => i.itemId).sort()]).toEqual([l.id, [...new Set(WL[l.id]?.itemIds ?? [])].sort()]);
    }
    const plain = (itemId: string, count = 1) => ({ itemId, count, hidden: false, once: true, chance: 1, onTake: [] }); // U34d's defaults
    expect(loc(VM).items).toEqual([]);
    expect(loc(SU).items).toEqual([plain('mat_umbral_thread', 2)]);
    expect(loc(SH).items).toEqual([plain('item_void_shard'), plain('mat_breach_glass')]);
    expect(WL[SH]?.block).toContain('item_void_shard ×1 (first visit), mat_breach_glass ×1');
    expect(loc(VY).items).toEqual([plain('mat_breach_glass', 2), plain('mat_shadow_ash', 2)]);
    expect(loc(NO).items).toEqual([plain('mat_breach_glass'), plain('item_void_shard')]);
    // the ring: a gift at Trusted
    expect(loc(ST).items).toEqual([{ ...plain('item_weavers_thread_ring'), when: { rep: { faction: 'weavers', min: 20 } } }]);
    expect(WL[ST]?.block).toContain('item_weavers_thread_ring (gift at Trusted)');
    // the Eye: "100 % after boss" is the Umbra's own loot; placed here only for the bypass
    const calls: Condition = { all: [{ companion: { id: 'nyx' } }, { echo: 'echo_nyx_is_of_the_nine' }] };
    expect(loc(EY).items).toEqual([{ ...plain('item_umbral_mirror'), when: calls }, { ...plain('mat_umbral_thread', 3), when: calls }]);
    expect(WL[EY]?.block).toContain('item_umbral_mirror (100% after boss), mat_umbral_thread ×3 (after boss)');
    expect(cr(UMBRA).loot.map((r) => [r.itemId, r.count])).toEqual([['item_umbral_mirror', 1], ['mat_umbral_thread', 3], ['mat_breach_glass', 2], ['item_void_shard', 2]]);
    // Where She Fell: the case opens as WORLD writes it; the shardglass for the Sworn
    const opens = /opens with `(\{any:[^`]+)`/.exec(WL[WS]?.block ?? '')?.[1] ?? '';
    expect(loc(WS).items).toEqual([
      { ...plain('item_litany_page_2'), when: worldCondition(opens) },
      { ...plain('item_nyxs_shardglass'), when: { rep: { faction: 'weavers', min: 60 } } },
    ]);
    expect(worldCondition(opens)).toEqual({ any: [{ rep: { faction: 'weavers', min: 20 } }, { echo: 'echo_nyx_is_of_the_nine' }] });
    expect(WL[WS]?.block).toContain('item_nyxs_shardglass (void_focus; Weavers Sworn only)');
    expect(DESIGN).toContain('Sworn ≥ 60'); // D-014
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa (the pool’s Wary sentry share and the Umbra’s own adds aside)', () => {
    for (const l of parsedLocations) {
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      const expected = new Set(WL[l.id]?.creatureIds ?? []);
      if ([SU, SH, VY].includes(l.id)) got.delete(SENTRY); // the Wary share of the pool (the header)
      if (l.id === EY) expected.delete(LANTERN); // "adds cr_hollow_lantern": the Umbra's second phase
      expect([l.id, [...got].sort()]).toEqual([l.id, [...expected].sort()]);
    }
    expect(cr(UMBRA).phases[1]?.adds).toEqual([{ creatureId: LANTERN, count: 2, hpPct: 1 }]);
  });

  test('first-visit fights: chances 50 % / 60 % / 60 % / 70 % / 100 %; the Orchard is a fleeable scatter node (WORLD §10.4); the boss holds', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const shape = (l: string, id: string) => {
      const x = e(l, id);
      return [x.groups.map((g) => `${g.creatureId}×${g.count}`), x.chance, x.respawn, x.once, x.fleeable, x.onFlee];
    };
    expect(WL[VM]?.block).toContain('first: cr_hollow_lantern ×2 (50%). return: pool(veil) 20%.');
    expect(shape(VM, 'enc_mouth_lanterns')).toEqual([['cr_hollow_lantern×2'], 0.5, 'never', true, true, 'scatter']);
    expect(WL[SU]?.block).toContain('first: cr_null_mouth ×1 (60%). return: pool 20%.');
    expect(shape(SU, 'enc_stair_null_mouth')).toEqual([['cr_null_mouth×1'], 0.6, 'never', true, true, 'scatter']);
    expect(WL[SH]?.block).toContain('first: cr_void_touched_stalker ×2 (60%). return: pool 20%.');
    expect(shape(SH, 'enc_shelf_stalkers')).toEqual([['cr_void_touched_stalker×2'], 0.6, 'never', true, true, 'scatter']);
    expect(WL[VY]?.block).toContain('first: cr_starved_shadow ×1 (70%).');
    expect(shape(VY, 'enc_gallery_shadow')).toEqual([['cr_starved_shadow×1'], 0.7, 'never', true, true, 'scatter']);
    expect(WL[NO]?.block).toContain('first: cr_null_mouth ×2 (100%).');
    expect(shape(NO, 'enc_orchard_null_mouths')).toEqual([['cr_null_mouth×2'], 1, 'never', true, true, 'scatter']);
    const boss = e(EY, 'enc_eye_umbra');
    expect([boss.groups, boss.fleeable, boss.onFlee, boss.chance, boss.optionalWhen]).toEqual([
      [{ creatureId: UMBRA, count: 1 }],
      false,
      'hold',
      1,
      { all: [{ companion: { id: 'nyx' } }, { echo: 'echo_nyx_is_of_the_nine' }] },
    ]);
    expect(WL[EY]?.block).toContain('**forced boss:** cr_vells_umbra ×1 (adds cr_hollow_lantern). Pacifist bypass: with Nyx as active companion and `echo_nyx_is_of_the_nine`');
    // §10.4: the Orchard is the region's scatter node, the Starved Shadow its guaranteed-elite chance (70 %)
    const row = tableRows(section(WORLD, '### 10.4 Elites', '### 10.5')).find((c) => c[0] === 'veil');
    expect(row?.[1]).toBe('cr_starved_shadow (VY 70%)');
    expect(row?.[2]).toBe('EY without Nyx + `echo_nyx_is_of_the_nine`');
    expect(row?.[3]).toBe('NO');
  });

  test('return rolls at WORLD’s chances, each ahead of the pool’s 20 %; the Orchard, the Sanctum, the Eye and Where She Fell name no pool, so they are `safe` (no wandering roll)', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const back2 = (l: string, id: string) => [e(l, id).chance, e(l, id).respawn, e(l, id).once, e(l, id).groups.map((g) => `${g.creatureId}×${g.count}`)];
    expect(WL[VY]?.block).toContain('return: cr_hollow_lantern ×2 (30%) or pool 20%.');
    expect(back2(VY, 'enc_gallery_lanterns')).toEqual([0.3, 'on_return', false, ['cr_hollow_lantern×2']]);
    expect(WL[NO]?.block).toContain('return: cr_null_mouth ×1 (35%).');
    expect(back2(NO, 'enc_orchard_null_mouth_return')).toEqual([0.35, 'on_return', false, ['cr_null_mouth×1']]);
    expect([VM, SU, ST, SH, VY, NO, EY, WS].map((id) => loc(id).safe)).toEqual([false, false, true, false, false, true, true, true]);
    expect(WL[ST]?.block).toContain('**Encounters:** none.');
    expect(WL[WS]?.block).toContain('**Encounters:** none (she warded it).');
  });

  test('Weavers Wary/Hostile: two sentries at the Mouth on every visit (100 %); the sentry’s pool share (4 %) at the Stair, the Shelf and the Gallery, ahead of the pool', () => {
    const sentries = byId(loc(VM).encounters, 'enc_mouth_sentries');
    // WORLD §7 `item_veil_sigil`: "while carried, cr_veil_sentry encounters at loc_veil_mouth are skipped when Weavers are Wary (not Hostile)"
    expect(sentries.optionalWhen).toEqual({ all: [{ item: { id: 'item_veil_sigil' } }, { rep: { faction: 'weavers', min: -39 } }] });
    expect(WORLD).toContain('`cr_veil_sentry` encounters at `loc_veil_mouth` are skipped when Weavers are Wary (not Hostile)');
    expect([sentries.groups, sentries.chance, sentries.when, sentries.once, sentries.respawn, sentries.fleeable]).toEqual([
      [{ creatureId: SENTRY, count: 2 }],
      1,
      { rep: { faction: 'weavers', max: -10 } },
      false,
      'never',
      true,
    ]);
    expect(WL[VM]?.block).toContain('Weavers Wary/Hostile: cr_veil_sentry ×2 (100%, every visit)');
    expect(loc(VM).encounters.map((x) => x.id)).toEqual(['enc_mouth_sentries', 'enc_mouth_lanterns']);
    for (const [l, id] of [[SU, 'enc_stair_pool_sentry'], [SH, 'enc_shelf_pool_sentry'], [VY, 'enc_gallery_pool_sentry']] as const) {
      const x = byId(loc(l).encounters, id);
      expect([x.groups, x.chance, x.when, x.once, x.respawn]).toEqual([[{ creatureId: SENTRY, count: 1 }], 0.04, { rep: { faction: 'weavers', max: -10 } }, false, 'on_return']);
      expect(loc(l).encounters.at(-1)?.id).toBe(id); // after the location's own fights, ahead of the pool the engine rolls last
    }
    // ws_weavers_wary: `{rep:{faction:"weavers",max:-10}}`
    expect(section(WORLD, '### 12.1 State table', '### 12.2')).toContain('`{rep:{faction:"weavers",max:-10}}` | Nyx curt | CW pool 20%; VH: cr_veil_sentry joins group B (Loop 2+); VM: sentries ×2 every visit');
  });

  test('events: every WORLD event, its text verbatim, ids as WORLD spells them, once; WORLD’s conditions, grants and loop gates', () => {
    for (const l of parsedLocations) {
      const got = Object.fromEntries(l.events.filter((e) => !['ev_mouth_count_again', 'ev_gallery_reflection_plain'].includes(e.id)).map((e) => [e.id, e.text]));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.events]);
      for (const e of l.events) expect([e.id, e.trigger, e.once]).toEqual([e.id, 'enter', true]);
    }
    const ev = (l: string, id: string) => byId(loc(l).events, id);
    // Loop 1 line and Loop 2+ line
    expect(ev(VM, 'ev_mouth_count').when).toEqual({ not: { loop: { min: 2 } } });
    expect(ev(VM, 'ev_mouth_count_again')).toMatchObject({ text: "'Eight again.'", when: { loop: { min: 2 } } });
    expect(WL[VM]?.block).toContain('Loop 2+ the line is "\'Eight again.\'"');
    expect(section(WORLD, '### 12.1 State table', '### 12.2')).toContain('`ev_mouth_count` "Eight again"');
    // the Thread-Mother: once per loop, Loop 2+
    expect(ev(ST, 'ev_sanctum_thread').when).toEqual({ loop: { min: 2 } });
    expect(WL[ST]?.block).toContain('— once per loop, Loop 2+.');
    // the reflection: Loop 4+ spawns the Wayfinder (two events with complementary `when`s)
    expect(ev(VY, 'ev_gallery_reflection')).toMatchObject({ when: { loop: { min: 4 } }, effects: [{ spawn: { creature: 'cr_redundant_wayfinder' } }] });
    expect(ev(VY, 'ev_gallery_reflection_plain')).toMatchObject({ when: { not: { loop: { min: 4 } } }, effects: [] });
    expect(ev(VY, 'ev_gallery_reflection_plain').text).toBe(ev(VY, 'ev_gallery_reflection').text);
    expect(WL[VY]?.block).toContain('Loop 4+ this spawns cr_redundant_wayfinder ×1');
    // Where She Fell
    expect(ev(WS, 'ev_fell_notes').effects).toEqual([{ grantEcho: 'echo_nyx_is_of_the_nine' }]);
    expect(WL[WS]?.block).toContain('— once; grants `echo_nyx_is_of_the_nine`.');
    expect(ev(WS, 'ev_fell_resonance')).toMatchObject({ when: { rep: { faction: 'weavers', min: 20 } }, effects: [{ grantEcho: 'echo_void_resonance' }] });
    expect(WL[WS]?.block).toContain('— once, requires `{rep:{faction:"weavers",min:20}}`; grants `echo_void_resonance`.');
    expect(ev(WS, 'ev_fell_names')).toMatchObject({ when: { loop: { min: 2 } }, effects: [] });
    expect(WL[WS]?.block).toContain('— once, Loop 2+, `q_the_dark_between` stage 2 (STORY\'s id)');
    expect(STORY).toContain('`q_the_dark_between` — The Dark Between');
  });

  test('NPC placement: the three Sanctum NPCs are placed there; Nyx’s Loop 2+ scenes are the dialogue units’, her home is the Chasm', () => {
    expect(WL[ST]?.npcIds).toEqual(['npc_sethe_unlidded', 'npc_ysmay', 'npc_hollis_cade', 'npc_nyx']);
    expect(loc(ST).npcs).toEqual(['npc_sethe_unlidded', 'npc_ysmay', 'npc_hollis_cade']);
    expect(WL[WS]?.npcIds).toEqual(['npc_nyx']);
    for (const l of parsedLocations) if (l.id !== ST) expect([l.id, l.npcs]).toEqual([l.id, []]);
    expect(pack.npcs['npc_nyx']?.homeLocationId).toBe(CW);
  });

  test('art: WORLD’s horizon per block; the void template, the sanctum at the Sanctum; no particles in the Gallery; Where She Fell glows when the Heartstone is exploited', () => {
    expect(parsedLocations.map((l) => [l.id, l.art.template, l.art.horizon, l.art.timeOfDay])).toEqual(
      [VM, SU, ST, SH, VY, NO, EY, WS].map((id) => [id, id === ST ? 'sanctum' : 'void', WL[id]?.horizon, 'timeless']),
    );
    expect(parsedLocations.map((l) => l.art.horizon)).toEqual([0.5, 0.6, 0.55, 0.45, 0.6, 0.55, 0.5, 0.5]);
    expect(loc(VY).art.particles).toBe('none');
    expect(WL[VY]?.block).toContain('particles: none (deliberate)');
    expect(loc(WS).art.variants).toEqual([{ when: { flag: 'flag_heartstone_exploited' }, patch: { particles: 'shards' } }]);
    expect(S29).toContain('Heartstone exploited: Where She Fell glows');
    expect(S29).toContain('No day or night.');
  });
});

// ---- Map data (WORLD §11) -------------------------------------------------------------------------------------------------------

describe('WORLD §11 map data', () => {
  test('§11.1 nodes: coordinates, band, rest, merchant; the settlement is the Sanctum', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable]);
      const rest = l.rest === undefined ? '—' : l.rest.when === undefined ? l.rest.kind : 'cond';
      expect([l.id, rest, l.merchantId ?? '—']).toEqual([l.id, l.id === ST ? 'cond' : n?.rest, n?.merchant]);
      expect([l.id, l.tags.includes('settlement')]).toEqual([l.id, n?.settlement]);
    }
    expect(NODES[ST]?.rest).toBe('inn');
  });

  test('§11.2 edges: every walk edge touching the region exists with its direction, cost and gate on both sides', () => {
    const walks = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(walks.map((e) => `${e.from}>${e.to}`)).toEqual([
      `${VH}>${VM}`,
      `${VH}>${SH}`,
      `${VM}>${SU}`,
      `${VM}>${VY}`,
      `${SU}>${ST}`,
      `${SU}>${NO}`,
      `${SH}>${VY}`,
      `${VY}>${NO}`,
      `${VY}>${EY}`,
      `${NO}>${WS}`,
      `${EY}>${WS}`,
    ]);
    for (const e of walks) {
      if (here.has(e.from)) {
        const exit = loc(e.from).exits.find((x) => x.to === e.to);
        expect([e.from, e.to, exit?.dir, exit?.travelWatches, exit?.when !== undefined]).toEqual([e.from, e.to, e.dir, e.cost, e.gate !== 'open']);
      }
      if (here.has(e.to)) {
        const back2 = loc(e.to).exits.find((x) => x.to === e.from);
        expect([e.to, e.from, back2?.dir, back2?.travelWatches, back2?.when !== undefined]).toEqual([e.to, e.from, e.reverseDir, e.reverseCost, e.reverseGate !== 'open']);
      }
    }
    // the Voidscar's side of the curtain resolves (U44 wrote it)
    for (const to of [VM, SH]) {
      const exit = pack.locations[VH]?.exits.find((x) => x.to === to);
      expect([to, exit?.when !== undefined, pack.locations[to] !== undefined]).toEqual([to, true, true]);
    }
    expect(pack.locations[VH]?.exits.find((x) => x.to === VM)?.dir).toBe('east');
    expect(pack.locations[VH]?.exits.find((x) => x.to === SH)?.dir).toBe('north');
  });

  test('§11.3 gates: the Sanctum door carries WORLD’s condition; the curtain is the Voidscar’s and opens on Weavers ≥ 20, the sign or the quest', () => {
    const gates = Object.fromEntries(tableRows(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).map((c) => [unquote(c[0] ?? ''), unquote(c[2] ?? '')]));
    expect(loc(SU).exits.find((e) => e.to === ST)?.when).toEqual(worldCondition(gates['gate_sanctum_door'] ?? ''));
    expect(loc(SU).exits.find((e) => e.to === ST)?.when).toEqual({ rep: { faction: 'weavers', min: -9 } });
    expect(gates['gate_veil_curtain']).toContain('{rep:{faction:"weavers",min:20}}');
    // Weavers tiers (DESIGN §11.1): Wary −39..−10, Neutral −9..19, Trusted 20..59, Sworn ≥ 60
    expect(DESIGN).toContain('Hostile ≤ −40 · Wary −39..−10 · Neutral −9..19 · Trusted 20..59 · Sworn ≥ 60');
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

  test('reachability from loc_whispering_ruins: shut with no gate satisfied; open through the Hollow (the Mouth is 5 watches away); the Sanctum additionally needs Weavers ≥ −9 (WORLD §3.13)', () => {
    const none = reach(() => false);
    expect([VM, SU, ST, SH, VY, NO, EY, WS].map((id) => none.has(id))).toEqual([false, false, false, false, false, false, false, false]);
    const all = reach(() => true);
    expect(all.get(VH)).toBe(4);
    expect(all.get(VM)).toBe(5);
    expect(all.get(SH)).toBe(5);
    expect([SU, ST, SH, VY, NO, EY, WS].map((id) => all.get(id))).toEqual([6, 7, 5, 6, 7, 7, 8]);
    expect(section(WORLD, '### 3.13', '### Conventions')).toContain('| The Veil | … Hollow → Veil Mouth (5) | Weavers Trusted (rep ≥ 20) or `echo_weaver_sign`; the Sanctum additionally needs rep ≥ −9 |');
    // every node but the Sanctum is reachable with the Sanctum door shut (it is a dead end)
    const barred = reach((cond) => !JSON.stringify(cond).includes('"min":-9'));
    expect([VM, SU, SH, VY, NO, EY, WS].map((id) => barred.has(id))).toEqual([true, true, true, true, true, true, true]);
    expect(barred.has(ST)).toBe(false);
  });

  test('§10.3 row: 8 nodes, sweep 8 watches, fights 4.4 first / 1.4 return (through-route 1.1 / 0.4, +1.0 / +0.4), worst node 4 from a rest point, rest point ST inn', () => {
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'veil') ?? [];
    expect(row.slice(1, 3)).toEqual(['10–14', '8']);
    // the sweep: the shortest walk from the gateway (the Mouth) that visits every node of the region (a breadth-first search over visited sets)
    const inside = new Map<string, string[]>(parsedLocations.map((l) => [l.id, l.exits.map((e) => e.to).filter((t) => here.has(t))]));
    const ordered = [...inside.keys()];
    const full = (1 << ordered.length) - 1;
    const start = ordered.indexOf(VM);
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
    expect(row[6]).toBe('8');

    // expected fights (WORLD §10.0, Loop 1, a neutral Wayfinder): a first group counts its chance; "X (p%) or pool 20 %" counts
    // p + (1 − p)·0.2; a node with no pool counts p alone; a settlement none; the boss counts 1 on the first visit
    const plain = (e: Location['encounters'][number]) => e.when === undefined;
    const firstVisit = (ids2: string[]): number => ids2.reduce((sum, id) => sum + loc(id).encounters.filter((e) => e.respawn !== 'on_return' && plain(e)).reduce((p, e) => p + e.chance, 0), 0);
    const returning = (ids2: string[]): number =>
      ids2.reduce((sum, id) => {
        const l = loc(id);
        const own = l.encounters.filter((e) => e.respawn === 'on_return' && plain(e));
        const pool = l.safe ? 0 : region.returnEncounterChance;
        return sum + (1 - own.reduce((p, e) => p * (1 - e.chance), 1) * (1 - pool));
      }, 0);
    const all = [VM, SU, ST, SH, VY, NO, EY, WS];
    expect(one(firstVisit(all))).toBe('4.4');
    expect(one(returning(all))).toBe('1.4');
    expect(row[7]).toBe('4.4 / 1.4');
    expect(row[5]).toBe('1.1 / 0.4 · +1.0 / +0.4');
    expect([one(firstVisit([VM, SU, ST])), one(returning([VM, SU, ST]))]).toEqual(['1.1', '0.4']);
    expect([one(firstVisit([NO, WS])), one(returning([NO, WS]))]).toEqual(['1.0', '0.4']);
    expect(row[3]).toBe('VH→VM→SU→ST · SU→NO→WS');
    expect(row[4]).toBe('3 · +2');
    // "to rest": the worst node's distance to the Sanctum — the 4-watch gap WORLD §10.4 names (the Eye)
    const dist = (from: string): number => {
      const d = new Map<string, number>([[from, 0]]);
      const q = [from];
      for (let i = 0; i < q.length; i++) for (const t of inside.get(q[i] ?? '') ?? []) if (!d.has(t)) (d.set(t, (d.get(q[i] ?? '') ?? 0) + 1), q.push(t));
      return d.get(ST) ?? Infinity;
    };
    expect(Math.max(...all.map(dist))).toBe(Number(row[8]));
    expect(row[8]).toBe('4');
    expect(dist(EY)).toBe(4);
    expect(row[9]).toBe('ST inn (Weavers ≥ −9)');
    expect(section(WORLD, '### 10.4 Elites', '### 10.5')).toContain('The Veil* is the only region with a 4-watch rest gap (Eye of the Scar).');
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6.1', () => {
  const MINE = ['cr_starved_shadow', 'cr_hollow_lantern', 'cr_null_mouth', UMBRA];

  test('exactly the creatures whose first region is the Veil (D-090), in WORLD’s block order; the Stalker and the Sentry stay in the Voidscar, the Wayfinder in the Ruins', () => {
    const first = Object.values(CREATURE_TABLE).filter((r) => r.regions === 'Veil').map((r) => r.id);
    expect([...first].sort()).toEqual([...MINE].sort());
    expect(creatures.map((c) => c.id)).toEqual(MINE);
    expect(CREATURE_TABLE['cr_void_touched_stalker']?.regions).toBe('Voidscar, Veil');
    expect(CREATURE_TABLE[SENTRY]?.regions).toBe('Voidscar, Veil');
    expect(CREATURE_TABLE['cr_redundant_wayfinder']?.regions).toBe('Silverwood Ruins, Veil');
    expect(pack.creatures['cr_void_touched_stalker']).toBeDefined();
    expect(pack.creatures[SENTRY]).toBeDefined();
    expect(pack.creatures['cr_redundant_wayfinder']).toBeDefined();
  });

  test('name, family, role, level and XP as WORLD’s table; XP follows DESIGN §6.2 (fodder round(20 + 8L + 1.2L²), elite ×1.8; the boss is hand-set 880)', () => {
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, row?.name.startsWith(c.name), c.family, c.role, c.level, c.xp]).toEqual([c.id, true, row?.family, row?.role, row?.level, row?.xp]);
    }
    const fodder = (L: number): number => Math.round(20 + 8 * L + 1.2 * L * L);
    for (const c of creatures) if (c.role !== 'boss') expect([c.id, c.xp]).toEqual([c.id, Math.round(fodder(c.level) * (c.role === 'elite' ? 1.8 : 1))]);
    // regional boss: band top + 2; 400–1,200 hand-set
    expect([cr(UMBRA).level, cr(UMBRA).xp]).toEqual([region.levelBand.max + 2, 880]);
    expect(cr(UMBRA).xp).toBeGreaterThanOrEqual(400);
    expect(cr(UMBRA).xp).toBeLessThanOrEqual(1200);
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK; the boss’s HP is 12 × (42 − 2 armor) = 480 (D-067.20)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
    expect(cr(UMBRA).stats).toEqual({ hp: 480, atk: 29, sp: 29, armor: 2, ward: 8, agi: 11 });
    expect(12 * (42 - cr(UMBRA).stats.armor)).toBe(480);
    expect(WORLD).toContain('Veil (top 14, ATK 35) 42');
  });

  test('resistances and immunities as WORLD’s Resist line; every Hollowed here is breach-born (Poison-immune); the boss is Blind-immune, void-resistant (not immune), Stagger-able and takes plain steel', () => {
    const resistLine = (id: string) => {
      const text = bullet(block(id), 'Resist:').replace(/[*~]/g, '').replace(/\([^)]*\)/g, '');
      const types = (label: string): string[] => (new RegExp(`(?:^|· )${label} ([^·]+)`).exec(text)?.[1] ?? '').split(',').map((s) => s.trim()).filter((t) => /^(physical|fire|storm|ley|void|chrono)$/.test(t));
      const immune = (/(?:status )?immune:? ([a-z, ]+)/.exec(text)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      return { weak: types('weak'), resist: types('resist'), immune };
    };
    for (const c of parsedCreatures) {
      const w = resistLine(c.id);
      const weak = Object.entries(c.resistances).filter(([, r]) => r === 'weak').map(([t]) => t).sort();
      const resist = Object.entries(c.resistances).filter(([, r]) => r === 'resist').map(([t]) => t).sort();
      expect([c.id, weak, resist]).toEqual([c.id, [...w.weak].sort(), [...w.resist].sort()]);
      expect([c.id, [...c.statusImmunities].sort()]).toEqual([c.id, w.immune.map((s) => `status_${s}`).sort()]);
      expect([c.id, c.tags.includes('breach_born'), c.statusImmunities.includes('status_poison')]).toEqual([c.id, true, true]);
    }
    expect(cr(UMBRA).statusImmunities.sort()).toEqual(['status_blind', 'status_poison']);
    expect(cr(UMBRA).resistances).toEqual({ ley: 'weak', fire: 'weak', void: 'resist' }); // neutral physical: "plain steel now lands in full"
    expect([cr(UMBRA).interruptible, cr(UMBRA).fleeable]).toEqual([true, false]);
    expect(bullet(block(UMBRA), 'Resist:')).toContain('Stagger allowed');
    expect(bullet(block(UMBRA), 'Stats:')).toContain('cannot be fled');
    expect(cr(UMBRA).tags).toContain('regional_boss');
    expect(cr(LANTERN).tags).toContain('umbra_add'); // the Umbra's second phase brings two
    expect([cr(LANTERN).resistances['physical'], cr('cr_null_mouth').resistances['physical'], cr('cr_starved_shadow').resistances['physical']]).toEqual(['weak', 'resist', 'resist']);
  });

  test('moves: exactly WORLD’s intent ids with their telegraph lines verbatim; every move reached by a pattern; telegraphs ≤ 12 words', () => {
    for (const c of parsedCreatures) {
      const intents: Record<string, string> = {};
      for (const m of block(c.id).matchAll(/^\s*- `([a-z0-9_]+)` · "([^"]+)"/gm)) intents[m[1] ?? ''] = m[2] ?? '';
      expect(Object.keys(intents).length).toBeGreaterThan(0);
      expect([c.id, Object.keys(c.moves).sort()]).toEqual([c.id, Object.keys(intents).sort()]);
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
    expect(cr(UMBRA).moves['umbra_open']?.hidden).toBe(true);
    expect(cr(UMBRA).moves['umbra_fall']?.hidden).toBe(true);
  });

  test('moves carry WORLD’s numbers: the multiplier and stat, type, statuses and their chances, heals, shields, strips, the Haste rows', () => {
    const m = (c: string, id: string) => cr(c).moves[id];
    const hit = (c: string, id: string) => [m(c, id)?.type, m(c, id)?.power?.coef, m(c, id)?.power?.stat];
    const rows = (c: string, id: string) => m(c, id)?.statuses.map((s) => [s.status.slice('status_'.length), s.chance, s.duration, s.target]);
    expect(hit(LANTERN, 'lantern_gutter')).toEqual(['void', 0.8, 'sp']);
    expect(rows(LANTERN, 'lantern_gutter')).toEqual([['blind', 0.4, 2, 'target']]);
    expect(hit(LANTERN, 'lantern_drink')).toEqual(['void', 1.0, 'sp']);
    expect(m(LANTERN, 'lantern_drink')?.effects).toEqual([{ healOnDamage: { pct: 0.5 } }]); // heals self for 50 % of damage dealt
    expect(m(LANTERN, 'lantern_shelter')?.shieldAlly?.power).toEqual({ base: 0, coef: 1.2, stat: 'atk', hits: 1 });
    expect(hit('cr_null_mouth', 'null_bite')).toEqual(['void', 1.2, 'sp']);
    expect(hit('cr_null_mouth', 'null_unmake')).toEqual(['void', 0.5, 'sp']);
    expect(m('cr_null_mouth', 'null_unmake')?.effects).toEqual([{ stripBuffs: { kinds: ['shield', 'regen', 'haste', 'rewind'] } }]);
    expect(hit('cr_null_mouth', 'null_gape')).toEqual(['void', 1.6, 'sp']);
    expect(rows('cr_null_mouth', 'null_gape')).toEqual([['weaken', 0.5, 2, 'target']]);
    expect(rows('cr_null_mouth', 'null_fill')).toEqual([['regen', 1, 3, 'self']]);
    expect(m('cr_null_mouth', 'null_fill')?.statuses[0]?.power).toEqual({ base: 0, coef: 0.4, stat: 'atk' });
    expect(hit('cr_starved_shadow', 'starved_snuff')).toEqual(['void', 0.6, 'sp']);
    expect(rows('cr_starved_shadow', 'starved_snuff')).toEqual([['blind', 0.6, 2, 'target']]);
    expect(hit('cr_starved_shadow', 'starved_gnaw')).toEqual(['void', 1.3, 'sp']);
    expect(rows('cr_starved_shadow', 'starved_gnaw')).toEqual([['curse', 0.5, 3, 'target']]);
    expect(m('cr_starved_shadow', 'starved_feed')?.heal).toMatchObject({ target: 'self', power: { coef: 1.5, stat: 'atk' } });
    expect(hit('cr_starved_shadow', 'starved_hunger')).toEqual(['void', 1.8, 'sp']);
    expect(hit(UMBRA, 'umbra_her_hand')).toEqual(['void', 1.0, 'sp']);
    expect(rows(UMBRA, 'umbra_her_hand')?.[0]).toEqual(['curse', 0.5, 3, 'target']);
    expect(rows(UMBRA, 'umbra_name_the_dark')).toEqual([['blind', 0.6, 2, 'target']]);
    expect(hit(UMBRA, 'umbra_open')).toEqual(['void', 1.6, 'sp']);
    expect(hit(UMBRA, 'umbra_between')).toEqual(['void', 0.8, 'sp']);
    expect(rows(UMBRA, 'umbra_between')).toEqual([['phase', 1, 1, 'self']]);
    expect(hit(UMBRA, 'umbra_unname')).toEqual(['void', 0.6, 'sp']);
    expect(rows(UMBRA, 'umbra_unname')).toEqual([['weaken', 1, 2, 'target']]);
    expect(m(UMBRA, 'umbra_unname')?.effects).toEqual([{ stripBuffs: { kinds: ['shield'] } }]);
    expect(hit(UMBRA, 'umbra_fall')).toEqual(['void', 2.2, 'sp']);
    expect(m(UMBRA, 'umbra_cling')?.heal).toMatchObject({ target: 'self', power: { coef: 2.0, stat: 'atk' } });
    // Phase 3 "Haste self every turn": a self-Haste row on each move it makes there; Her Hand's waits on the Phase 3 threshold
    expect(rows(UMBRA, 'umbra_fall')?.[0]).toEqual(['haste', 1, 2, 'self']);
    expect(rows(UMBRA, 'umbra_cling')?.[0]).toEqual(['haste', 1, 2, 'self']);
    expect(m(UMBRA, 'umbra_her_hand')?.statuses[1]).toMatchObject({ status: 'status_haste', target: 'self', when: { hpBelow: 0.25 } });
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
    expect(gold(cr(LANTERN))).toEqual([23, 36]);
    expect(gold(cr('cr_starved_shadow'))).toEqual([54, 84]);
    expect(gold(cr(UMBRA))).toEqual([165, 255]);
  });

  test('bestiary voice, entry and tactics are WORLD’s text verbatim (backticks, asterisks and decision references dropped); family codex entry; reveals at 1 and 3 kills; short non-legacy descriptions', () => {
    for (const c of parsedCreatures) {
      const b = block(c.id);
      const voice = /- \*\*Bestiary\*\* \((Remnant Archive|Wayfinder's Notes)\)/.exec(b)?.[1];
      expect([c.id, c.bestiary.voice]).toEqual([c.id, voice === 'Remnant Archive' ? 'remnant_archive' : 'wayfinder_notes']);
      expect([c.id, c.bestiary.summary]).toEqual([c.id, playText(bullet(b, 'Bestiary'))]);
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, playText(bullet(b, 'Tactics:'))]);
      expect(c.bestiary.codexId).toBe('codex_creatures_hollowed');
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
      expect([c.id, c.legacyName, /- \*\*Legacy description:\*\*/.test(b)]).toEqual([c.id, undefined, false]); // no legacy line: the Veil's own
      expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
    }
    expect(STORY).toContain('| `codex_creatures_hollowed` |');
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
  test('the Hollow Lantern: Gutter and Drink in turn; Shelter replaces them for as long as an ally stands', () => {
    const lantern = [{ creatureId: LANTERN, count: 1 }];
    expect(plan(LANTERN, 6)).toEqual(seq('gutter drink gutter drink gutter drink'));
    expect(plan(LANTERN, 4, { allies: lantern })).toEqual(seq('shelter shelter shelter shelter'));
    const fall = (t: number, _f: Combatant, c: CombatState): void => ally(c, 1, t < 3);
    expect(plan(LANTERN, 5, { allies: lantern, before: fall })).toEqual(seq('shelter shelter gutter drink gutter'));
  });

  test('the Null Mouth: Bite and Unmake in turn, Gape on every third turn, Fill below 40 % HP and not again while its Regen runs', () => {
    expect(plan('cr_null_mouth', 7)).toEqual(seq('bite unmake gape unmake bite gape bite'));
    const hurt = (t: number, f: Combatant): void => {
      hpAt(0.3)(f);
      withStatus(f, 'status_regen', t >= 2 && t <= 4);
    };
    expect(plan('cr_null_mouth', 7, { before: hurt })).toEqual(seq('fill unmake gape unmake fill gape fill'));
  });

  test('the Starved Shadow: Snuff first, Feed while you are Blind, Hunger on every fourth turn, else Gnaw', () => {
    expect(plan('cr_starved_shadow', 8)).toEqual(seq('snuff gnaw gnaw hunger gnaw gnaw gnaw hunger'));
    const blind = (t: number, _f: Combatant, c: CombatState): void => withStatus(player(c), 'status_blind', t === 2 || t === 3);
    expect(plan('cr_starved_shadow', 5, { before: blind })).toEqual(seq('snuff feed feed hunger gnaw'));
    // the Blind from the Snuff on the first turn, unanswered, is what feeds it
    const stayBlind = (t: number, _f: Combatant, c: CombatState): void => withStatus(player(c), 'status_blind', t >= 2);
    expect(plan('cr_starved_shadow', 5, { before: stayBlind })).toEqual(seq('snuff feed feed feed feed'));
  });

  test('Vell’s Umbra, Her Shape: Her Hand; Name the Dark on every third turn; the hidden Open while you are Blind', () => {
    expect(plan(UMBRA, 7, { phase: 0 })).toEqual(seq('her_hand her_hand name_the_dark her_hand her_hand name_the_dark her_hand'));
    const blind = (t: number, _f: Combatant, c: CombatState): void => withStatus(player(c), 'status_blind', t === 4 || t === 5);
    expect(plan(UMBRA, 7, { phase: 0, before: blind })).toEqual(seq('her_hand her_hand name_the_dark open open name_the_dark her_hand'));
  });

  test('Vell’s Umbra, The Dark Between: Between, Unname and Her Hand in turn', () => {
    expect(plan(UMBRA, 7, { phase: 1 })).toEqual(seq('between unname her_hand between unname her_hand between'));
  });

  test('Vell’s Umbra, Forty Years: the hidden Fall on every third turn; Cling eats a lantern while one stands (consumes it); else Her Hand', () => {
    const lanterns = [{ creatureId: LANTERN, count: 2 }];
    expect(plan(UMBRA, 7, { phase: 2 })).toEqual(seq('her_hand her_hand fall her_hand her_hand fall her_hand'));
    // U34e (D-096): each Cling consumes a lantern (`consumesAlly`; the walk does not execute moves, so `before` takes them)
    expect(cr(UMBRA).moves['umbra_cling']?.consumesAlly).toBe(LANTERN);
    const eaten = (t: number, _f: Combatant, c: CombatState): void => {
      for (let i = 1; i <= Math.min(2, t - 1); i++) (c.enemies[i] as Combatant).fledOrGone = true;
    };
    expect(plan(UMBRA, 7, { phase: 2, allies: lanterns, before: eaten })).toEqual(seq('cling cling fall her_hand her_hand fall her_hand'));
    // one lantern already down: one Cling, then none
    const one = (t: number, _f: Combatant, c: CombatState): void => {
      ally(c, 1, false);
      if (t > 1) (c.enemies[2] as Combatant).fledOrGone = true;
    };
    expect(plan(UMBRA, 7, { phase: 2, allies: lanterns, before: one })).toEqual(seq('cling her_hand fall her_hand her_hand fall her_hand'));
    const none = (_t: number, _f: Combatant, c: CombatState): void => (ally(c, 1, false), ally(c, 2, false));
    expect(plan(UMBRA, 5, { phase: 2, allies: lanterns, before: none })).toEqual(seq('her_hand her_hand fall her_hand her_hand'));
  });

  test('Vell’s Umbra’s phases: ids, names, triggers (60 %, 25 %), WORLD’s transition lines; Phase 1 is skipped once the Umbra has been killed; Phase 2 opens with two lanterns', () => {
    const u = cr(UMBRA);
    expect(u.phases.map((p) => [p.id, p.name, p.enterWhen])).toEqual([
      ['umbra_her_shape', 'Her Shape', []],
      ['umbra_the_dark_between', 'The Dark Between', [{ hpBelow: 0.6 }]],
      ['umbra_forty_years', 'Forty Years', [{ hpBelow: 0.25 }]],
    ]);
    const W = flat(block(UMBRA));
    expect(W).toContain('**Phase 1 — Her Shape** (100–60%;');
    expect(W).toContain('**Phase 2 — The Dark Between** (<60%; onEnter: 2× `cr_hollow_lantern` at full HP)');
    expect(W).toContain('**Phase 3 — Forty Years** (<25%; Haste self every turn)');
    expect(W).toContain(`*Transition (<60%):* "${u.phases[1]?.line}"`);
    expect(W).toContain(`*Transition (<25%):* "${u.phases[2]?.line}"`);
    expect(u.phases[0]?.line).toBeUndefined();
    expect(W).toContain('if `{killed:"cr_vells_umbra"}` in\n  any earlier loop'.replace('\n  ', ' '));
    expect(u.phases[0]?.skipWhen).toEqual({ killed: { id: UMBRA, anyLoop: true } }); // U34e (D-096): any earlier loop
    expect(u.phases[1]?.skipWhen).toBeUndefined();
    expect(u.phases[1]?.adds).toEqual([{ creatureId: LANTERN, count: 2, hpPct: 1 }]);
    expect(u.phases[2]?.adds).toEqual([]);
  });
});

// ---- The NPCs ----------------------------------------------------------------------------------------------------------------

describe('the NPCs vs WORLD §4', () => {
  const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
  const rows = Object.fromEntries(tableRows(S4).filter((c) => unquote(c[0] ?? '').startsWith('npc_')).map((c) => [unquote(c[0] ?? ''), c]));
  const home = (c: string[]): string => (c[3] ?? '').replace(/\*\*stall: /, '').replace(/\*\*/g, '');

  test('exactly the NPCs whose home is in the region: Sethe, Ysmay and Hollis Cade, all at the Sanctum of Threads', () => {
    const homes = Object.values(rows).filter((c) => here.has(/^loc_[a-z_]+/.exec(home(c))?.[0] ?? ''));
    expect(npcs.map((n) => n.id).sort()).toEqual(homes.map((c) => unquote(c[0] ?? '')).sort());
    expect(npcs.map((n) => n.id)).toEqual(['npc_sethe_unlidded', 'npc_ysmay', 'npc_hollis_cade']);
  });

  test('names, factions, home locations and sample lines as WORLD’s row; descriptions are the row’s cell made into sentences', () => {
    for (const n of npcs) {
      const row = rows[n.id];
      expect(row, n.id).toBeDefined();
      expect([n.id, n.name, n.factionId]).toEqual([n.id, row?.[1], row?.[2]]);
      expect([n.id, home(row ?? []).startsWith(n.homeLocationId)]).toEqual([n.id, true]);
      expect(n.barks).toHaveLength(2);
      for (const b of n.barks ?? []) expect([n.id, (row?.[6] ?? '').includes(`"${b.text}"`)]).toEqual([n.id, true]);
      expect([n.id, 'legacyName' in n, 'age' in n]).toEqual([n.id, false, false]); // new characters; BIBLE gives no age for any of the three
    }
    expect(rows['npc_sethe_unlidded']?.[5]).toBe('Weaver lieutenant who cut away her eyelids to keep watch between moments. Wants to see what Nyx has seen.');
    expect(byId(npcs, 'npc_sethe_unlidded').description).toBe('A Weaver lieutenant who cut away her eyelids to keep watch between moments. She wants to see what Nyx has seen.');
    expect(rows['npc_ysmay']?.[5]).toBe('Ritual elder of the Hollow Choir; no eyes; holds the thread all the others are tied to.');
    expect(byId(npcs, 'npc_ysmay').description).toBe('The ritual elder of the Hollow Choir. She has no eyes, and she holds the one thread that all the others are tied to.');
    expect(rows['npc_hollis_cade']?.[5]).toContain('Weaver quartermaster in grey thread.');
    expect(byId(npcs, 'npc_hollis_cade').description).toBe("The Weavers' quartermaster, in grey thread.");
  });

  test('roles and records: the merchant with his stall (WORLD §9 is a later unit’s), the two quest givers', () => {
    const hollis = byId(npcs, 'npc_hollis_cade');
    expect([byId(npcs, 'npc_sethe_unlidded').roles, byId(npcs, 'npc_ysmay').roles, hollis.roles]).toEqual([['questgiver'], ['questgiver'], ['merchant']]);
    expect([hollis.merchantId, byId(npcs, 'npc_ysmay').merchantId]).toEqual(['npc_hollis_cade', undefined]);
    expect(loc(ST).merchantId).toBe(hollis.id);
    expect(rows['npc_sethe_unlidded']?.[4]).toContain('quest giver (q_hollow_choir, q_unlidded_eye)');
    expect(rows['npc_ysmay']?.[4]).toContain('gives `item_weavers_thread_ring` at Trusted');
    expect(rows['npc_hollis_cade']?.[4]).toContain('merchant');
  });
});

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder in WORLD §2 order; the region tables are in `contentTables` and the index', () => {
    const folders = REGION_FOLDERS.map((f) => f.region.id);
    expect(folders).toContain(REGION);
    expect(folders.indexOf('region_ashen_steppe')).toBeLessThan(folders.indexOf(REGION));
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('The Veil');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.name).toBe(c.name);
    for (const n of npcs) expect(pack.npcs[n.id]?.name).toBe(n.name);
    expect(items).toEqual([]); // the items tables are U49/U50's; this region owns none
  });

  test('validates with 0 errors; nothing real is reported about the region but the two known warnings; pending references name only tables still being authored', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const about = report.warnings.filter((w) => mine.has(w.id) || locations.some((l) => w.message.includes(` ${l.id}`)));
    const real = about.filter((w) => !w.message.startsWith('pending — content not yet authored'));
    // the Void-Touched Stalker (L6, the Voidscar's) at the Scar Shelf (band 10): WORLD §3.8 places two there, so the record is
    // WORLD's and rule 11 stands; and the Umbra (L16, WORLD's level: band top 14 + 2) at the Eye, whose WORLD band is 13, which
    // rule 11 reads as top 13 + 2 = 15 (WORLD's own contradiction: §3.8 gives the Eye 13 and §6.1 says the boss is top + 2 of 10–14)
    expect(real.map((w) => `${w.rule} ${w.id} ${w.path}`).sort()).toEqual(['rule-11 cr_vells_umbra level', 'rule-11 cr_void_touched_stalker level']);
    expect(real.find((w) => w.id === 'cr_void_touched_stalker')?.message).toContain(SH);
    expect(real.find((w) => w.id === UMBRA)?.message).toContain('expected 15');
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

  test('this region’s pending references name only ids WORLD/STORY/DESIGN spell (items, Echoes, the merchant record, codex entries, the faction); the Voidscar’s creatures, the Wayfinder and Nyx resolve', () => {
    const { report } = parseContentPack(contentTables);
    const targets = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    // Later units resolve these one by one (items U49/U50, Echoes, the merchants, the codex): the list may only shrink
    const known = new Set([
      'item_weavers_thread_ring', 'item_veil_sigil', 'item_void_shard', 'item_umbral_mirror', 'item_litany_page_2', 'item_nyxs_shardglass', 'item_hollow_lantern_focus', 'item_dark_spellbook',
      'mat_umbral_thread', 'mat_breach_glass', 'mat_shadow_ash',
      'echo_nyx_is_of_the_nine', 'echo_void_resonance',
      'npc_hollis_cade', // the merchant record (WORLD §9)
      'weavers', // the faction record (region.factionId, npc factions)
      'nyx', // the companion record (the Eye's bypass reads `{companion:{id:'nyx'}}`; the companions table is still being authored)
      'codex_region_veil', 'codex_creatures_hollowed',
    ]);
    expect([...targets].filter((t) => !known.has(t)).sort()).toEqual([]);
    for (const t of [VH, VM, SH, 'cr_void_touched_stalker', SENTRY, 'cr_redundant_wayfinder', 'npc_nyx']) expect([t, targets.has(t)]).toEqual([t, false]);
    // every one is an id the documents spell
    const docs = `${WORLD}\n${STORY}\n${DESIGN}`;
    for (const id of targets) expect([id, docs.includes(id)]).toEqual([id, true]);
  });
});

// ---- The engine on the real pack ------------------------------------------------------------------------------------------------

describe('the region in the engine (real pack, seeded)', () => {
  test('the curtain: the Hollow’s two doors open at Weavers ≥ 20, with the sign or with the quest; the Sanctum door shuts at Wary (−10) and opens at −9', () => {
    for (const to of [VM, SH]) {
      expect([to, exitOpen(VH, to)]).toEqual([to, false]);
      expect([to, exitOpen(VH, to, { reputation: { weavers: 20 } })]).toEqual([to, true]);
      expect([to, exitOpen(VH, to, { reputation: { weavers: 19 } })]).toEqual([to, false]);
      expect([to, exitOpen(VH, to, { loop: 2, echoes: ['echo_weaver_sign'] })]).toEqual([to, true]);
    }
    for (const [rep, open] of [[-40, false], [-10, false], [-9, true], [0, true], [20, true], [60, true]] as const) {
      expect([rep, exitOpen(SU, ST, { reputation: { weavers: rep } })]).toEqual([rep, open]);
    }
    expect(movesFrom(SU, { reputation: { weavers: -10 } })).toEqual([VM, NO].sort());
    expect(movesFrom(SU)).toEqual([VM, ST, NO].sort());
    expect(movesFrom(ST)).toEqual([SU]);
    expect(movesFrom(VY)).toEqual([SH, VM, NO, EY].sort());
    expect(movesFrom(WS)).toEqual([EY, NO].sort());
    expect(movesFrom(SH)).toEqual([VH, VY].sort());
  });

  test('the Mouth: a neutral Wayfinder meets two lanterns half the time (400 seeds); the Wary and Hostile meet two sentries on every arrival, first and return; the Trusted meet none', () => {
    const N = 400;
    const first = tally(N, (i) => arrive(SU, VM, { seed: `u47-${i}` }));
    expect([...first.keys()]).toEqual(['enc_mouth_lanterns']);
    expect((first.get('enc_mouth_lanterns') ?? 0) / N).toBeGreaterThan(0.42);
    expect((first.get('enc_mouth_lanterns') ?? 0) / N).toBeLessThan(0.58);
    const lanterns = arrive(SU, VM, { seed: 'u47-find-lanterns' });
    for (let i = 0; i < 60 && lanterns.mode !== 'combat'; i++) {
      const s = arrive(SU, VM, { seed: `u47-find-${i}` });
      if (s.mode === 'combat') expect(s.combat?.enemies.map((e) => e.refId)).toEqual([LANTERN, LANTERN]);
    }
    for (const rep of [-20, -60]) {
      for (let i = 0; i < 30; i++) {
        const s = arrive(SU, VM, { seed: `u47-wary-${i}`, reputation: { weavers: rep } });
        expect([rep, s.mode, s.combat?.encounterId, s.combat?.enemies.map((e) => e.refId)]).toEqual([rep, 'combat', 'enc_mouth_sentries', [SENTRY, SENTRY]]);
        expect(s.combat).toMatchObject({ canFlee: true, onFlee: 'scatter' });
        const again = back(SU, VM, i, { reputation: { weavers: rep } });
        expect([rep, again.mode, again.combat?.encounterId]).toEqual([rep, 'combat', 'enc_mouth_sentries']);
      }
    }
    // the Veil Sigil in the pack (read as a condition: the item has no record yet, so the engine cannot carry it): the Wary pass
    // unchallenged, the Hostile (≤ −40) are still counted, and without the sigil nobody is excused
    const sentryGroup = byId(loc(VM).encounters, 'enc_mouth_sentries');
    const stands = (rep: number, carrying: string[]): boolean =>
      holds(sentryGroup.when as Condition, VM, { reputation: { weavers: rep }, carrying }) && !holds(sentryGroup.optionalWhen as Condition, VM, { reputation: { weavers: rep }, carrying });
    expect([-9, -10, -20, -39, -40, -60].map((rep) => stands(rep, ['item_veil_sigil']))).toEqual([false, false, false, false, true, true]);
    expect([-9, -10, -20, -39, -40, -60].map((rep) => stands(rep, []))).toEqual([false, true, true, true, true, true]);
    // Trusted: the pool's sentry share needs Wary, and the lantern roll is the neutral one
    const trusted = tally(N, (i) => arrive(SU, VM, { seed: `u47-trusted-${i}`, reputation: { weavers: 25 } }));
    expect([...trusted.keys()]).toEqual(['enc_mouth_lanterns']);
  });

  test('the Stair, the Shelf and the Gallery add the sentry’s 4 % only while Wary; the Orchard rolls no pool; the Sanctum, the Eye and Where She Fell roll nothing on a return (200–600 seeds)', () => {
    const N = 600;
    for (const [from, to, own, share] of [[VM, SU, 'enc_stair_null_mouth', 'enc_stair_pool_sentry'], [VY, SH, 'enc_shelf_stalkers', 'enc_shelf_pool_sentry'], [VM, VY, 'enc_gallery_shadow', 'enc_gallery_pool_sentry']] as const) {
      const neutral = tally(N, (i) => back(from, to, i));
      expect([to, neutral.has(share)]).toEqual([to, false]);
      expect([to, neutral.has(own)]).toEqual([to, false]); // the first-visit group is behind the player
      expect(neutral.get('wandering') ?? 0).toBeGreaterThan(0.1 * N); // the pool's 20 %
      const wary = tally(N, (i) => back(from, to, i, { reputation: WARY }));
      expect((wary.get(share) ?? 0) / N).toBeGreaterThan(0.015);
      expect((wary.get(share) ?? 0) / N).toBeLessThan(0.08);
    }
    // the Orchard: only its own 35 % group, never the pool
    const orchard = tally(200, (i) => back(SU, NO, i));
    expect([...orchard.keys()]).toEqual(['enc_orchard_null_mouth_return']);
    expect((orchard.get('enc_orchard_null_mouth_return') ?? 0) / 200).toBeGreaterThan(0.25);
    expect((orchard.get('enc_orchard_null_mouth_return') ?? 0) / 200).toBeLessThan(0.45);
    // the Gallery: the lanterns' 30 %, then the pool's 20 % of what is left (about 44 % in all)
    const gallery = tally(N, (i) => back(VM, VY, i));
    expect([...gallery.keys()].sort()).toEqual(['enc_gallery_lanterns', 'wandering']);
    const total = [...gallery.values()].reduce((a, b) => a + b, 0);
    expect(total / N).toBeGreaterThan(0.36);
    expect(total / N).toBeLessThan(0.52);
    for (const [from, to] of [[SU, ST], [VY, EY], [NO, WS]] as const) {
      for (let i = 0; i < 200; i++) expect([to, back(from, to, i, { echoes: ['echo_nyx_is_of_the_nine'], nyx: to === EY }).mode]).toEqual([to, 'explore']);
    }
    for (let i = 0; i < 200; i++) expect(arrive(SU, ST, { seed: `u47-st-${i}` }).mode).toBe('explore');
  });

  test('the Gallery’s first visit: about 70 % a Starved Shadow, 30 % nothing; Loop 4+ the reflection spawns a Redundant Wayfinder first (the spawn event, then the Shadow’s roll)', () => {
    const N = 400;
    const first = tally(N, (i) => arrive(VM, VY, { seed: `u47-gallery-${i}` }));
    expect([...first.keys()]).toEqual(['enc_gallery_shadow']);
    expect((first.get('enc_gallery_shadow') ?? 0) / N).toBeGreaterThan(0.62);
    expect((first.get('enc_gallery_shadow') ?? 0) / N).toBeLessThan(0.78);
    const loop3 = arrive(VM, VY, { loop: 3, seed: 'u47-reflection' });
    expect(loop3.world.pendingEncounters[VY] ?? []).toEqual([]);
    for (let i = 0; i < 20; i++) {
      const s = arrive(VM, VY, { loop: 4, seed: `u47-reflection-${i}` });
      expect([s.mode, s.combat?.enemies.map((e) => e.refId)]).toEqual(['combat', ['cr_redundant_wayfinder']]);
    }
  });

  test('the Orchard’s first visit is two Null Mouths (100 %, fleeable scatter)', () => {
    const s = arrive(SU, NO);
    expect(s.combat).toMatchObject({ encounterId: 'enc_orchard_null_mouths', canFlee: true, onFlee: 'scatter' });
    expect(s.combat?.enemies.map((e) => e.refId)).toEqual(['cr_null_mouth', 'cr_null_mouth']);
  });

  test('the Eye: a held boss fight without the bypass; with Nyx active and `echo_nyx_is_of_the_nine` the shadow is called back and the fight skipped; an earlier kill this loop opens the fight on Phase 2', () => {
    const fight = arrive(VY, EY);
    expect(fight.mode).toBe('combat');
    expect(fight.combat).toMatchObject({ encounterId: 'enc_eye_umbra', canFlee: false, onFlee: 'hold' });
    expect(fight.combat?.enemies.map((e) => [e.refId, e.phase])).toEqual([[UMBRA, 0]]);
    const called = arrive(VY, EY, { loop: 2, echoes: ['echo_nyx_is_of_the_nine'], nyx: true });
    expect(called.mode).toBe('explore');
    expect(called.world.currentLocationId).toBe(EY);
    // each half of the bypass alone is not enough (the condition, read directly: a fight with Nyx in the party needs her record)
    const calls = loc(EY).encounters[0]?.optionalWhen as Condition;
    expect([true, false].map((nyx) => holds(calls, EY, { loop: 2, echoes: ['echo_nyx_is_of_the_nine'], nyx }))).toEqual([true, false]);
    expect(holds(calls, EY, { loop: 2, nyx: true })).toBe(false);
    expect(holds(calls, EY, { loop: 2 })).toBe(false);
    const again = arrive(VY, EY, { kills: { [UMBRA]: 1 } });
    expect(again.combat?.enemies.map((e) => [e.refId, e.phase]).slice(0, 1)).toEqual([[UMBRA, 1]]);
  });

  test('Where She Fell: the case opens to the Trusted or to one who knows whose it is; the Sanctum’s ring is a gift at Trusted; the shardglass is for the Sworn', () => {
    const when = (l: string, itemId: string): Condition => loc(l).items.find((i) => i.itemId === itemId)?.when as Condition;
    const page = when(WS, 'item_litany_page_2');
    expect([0, 19, 20, 60].map((rep) => holds(page, WS, { reputation: { weavers: rep } }))).toEqual([false, false, true, true]);
    expect(holds(page, WS, { loop: 2, echoes: ['echo_nyx_is_of_the_nine'] })).toBe(true);
    const glass = when(WS, 'item_nyxs_shardglass');
    expect([0, 20, 59, 60, 100].map((rep) => holds(glass, WS, { reputation: { weavers: rep } }))).toEqual([false, false, false, true, true]);
    const ring = when(ST, 'item_weavers_thread_ring');
    expect([0, 19, 20, 59].map((rep) => holds(ring, ST, { reputation: { weavers: rep } }))).toEqual([false, false, true, true]);
    const resonance = byId(loc(WS).events, 'ev_fell_resonance').when as Condition;
    expect([0, 19, 20].map((rep) => holds(resonance, WS, { reputation: { weavers: rep } }))).toEqual([false, false, true]);
  });

  test('the Sanctum’s inn: a rest while Weavers ≥ −9, none once Wary; a settlement on the first and every return visit', () => {
    const rests = (o: At): string[] => legalActions(stateAt(ST, o), pack, profileOf(o)).filter((a) => a.type === 'rest').map((a) => `${(a as { kind: string }).kind}`);
    expect(rests({})).toContain('short');
    expect(rests({ reputation: { weavers: -9 } })).toContain('short');
    expect(rests({ reputation: { weavers: -10 } })).toEqual([]);
    expect(rests({ reputation: WARY })).toEqual([]);
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U47 reply -----------------------------------------

describe('authored words outside the documents are few and short; coined ids are the listed ones', () => {
  test('encounter intros are ≤ 30 words; the non-legacy descriptions are drawn from the documents; the Sanctum door’s refusal is the one exit line', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro)).filter((t): t is string => t !== undefined);
    expect(intros).toHaveLength(12); // every encounter carries one
    for (const t of intros) expect([t, words(t) <= 30]).toEqual([t, true]);
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro))).not.toContain(undefined);
    const locked = parsedLocations.flatMap((l) => l.exits.map((e) => e.lockedText)).filter(Boolean);
    expect(locked).toHaveLength(1);
    for (const t of locked) expect([t, words(t ?? '') <= 30]).toEqual([t, true]);
  });

  test('ids this unit coined (WORLD/STORY have none for them): encounter ids, the two plain events, the Umbra’s phase ids', () => {
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.id))).toEqual([
      'enc_mouth_sentries', 'enc_mouth_lanterns',
      'enc_stair_null_mouth', 'enc_stair_pool_sentry',
      'enc_shelf_stalkers', 'enc_shelf_pool_sentry',
      'enc_gallery_shadow', 'enc_gallery_lanterns', 'enc_gallery_pool_sentry',
      'enc_orchard_null_mouths', 'enc_orchard_null_mouth_return',
      'enc_eye_umbra',
    ]);
    const wordedEvents = new Set(Object.values(WL).flatMap((w) => Object.keys(w.events)));
    expect(parsedLocations.flatMap((l) => l.events.map((e) => e.id)).filter((id) => !wordedEvents.has(id))).toEqual(['ev_mouth_count_again', 'ev_gallery_reflection_plain']);
    expect(cr(UMBRA).phases.map((p) => p.id)).toEqual(['umbra_her_shape', 'umbra_the_dark_between', 'umbra_forty_years']);
    // every move id is WORLD's: the creatures use WORLD's intent ids only
    for (const c of parsedCreatures) for (const id of Object.keys(c.moves)) expect([c.id, id, WORLD.includes(`\`${id}\``)]).toEqual([c.id, id, true]);
    expect(ids(JSON.stringify(locations), 'ambient')).toEqual([]);
  });
});
