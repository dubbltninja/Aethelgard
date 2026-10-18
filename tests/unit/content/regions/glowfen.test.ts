// U47: The Glowfen — checked against the documents at test time, U42's pattern (regions/silverwood_ruins.test.ts), U46's
// (regions/drowned_reach.test.ts) and the Veil's (regions/veil.test.ts): WORLD §2.10, §3.9, §4, §6.6, §10.1, §10.3, §10.4, §11.1–11.3,
// §12.1; DESIGN §6.7, §17.1, §18.2; PLAN Appendix A; STORY's codex ids. The region is new (no legacy text, no `legacyName`), so
// every description is WORLD's, character for character. Patterns are walked turn by turn by the engine (`generateIntent`), so
// every WORLD cadence word is held to what the game does. Where a record departs from the letter of WORLD (a reading the schema or
// the engine forces), the test pins the departure so a later edit cannot move it silently; the readings are listed in the U47 reply.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures } from '@content/regions/glowfen/creatures';
import { items } from '@content/regions/glowfen/items';
import { locations } from '@content/regions/glowfen/locations';
import { npcs } from '@content/regions/glowfen/npcs';
import { region } from '@content/regions/glowfen/region';
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

const REGION = 'region_glowfen';
const LC = 'loc_lantern_causeway';
const LN = 'loc_lanternreed';
const LS = 'loc_sporelight_shallows';
const EM = 'loc_elder_mangrove';
const BP = 'loc_breathing_pool';
const FB = 'loc_firefly_barrows';
const PG = 'loc_pale_gullet';
const MH = 'loc_matrons_hall';
const VG = 'loc_veridian_glowlands';
const WR = 'loc_whispering_ruins';
const BARROW = 'cr_barrow_light';
const MATRON = 'cr_lantern_matron';
const TOAD = 'cr_lantern_toad';
const MIRELING = 'cr_glowfen_mireling';
const STALKER = 'cr_reed_stalker';
const SPORE = 'cr_spore_drift';

const S210 = section(WORLD, '### 2.10 `region_glowfen`', '### 2.11');
const S39 = section(WORLD, '### 3.9 The Glowfen', '### 3.10');
const WL = Object.fromEntries(worldLocations(S39).map((l) => [l.id, l]));
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

// ---- Engine helpers -----------------------------------------------------------------------------------------------------------

interface At {
  seed?: string;
  loop?: number;
  flags?: Record<string, boolean>;
  /** Echoes granted this loop (the pack has no echo records yet, so they are set directly). */
  echoes?: string[];
  /** Item ids carried that have no record yet (put straight into the inventory; the engine cannot derive them). */
  carrying?: string[];
  /** 0 dawn … 3 night: the watch the state STANDS in (a move to the next node takes one more). */
  watch?: NonNullable<StateOverrides['watch']>;
  corruption?: number;
  /** Glow Moss carried (a real item record). */
  moss?: number;
  /** Mireya recruited and in the party. */
  mireya?: boolean;
}

/** A state on the real pack, standing at `locationId`. */
function stateAt(locationId: string, o: At = {}): GameState {
  const overrides: StateOverrides = {
    locationId,
    seed: o.seed ?? 'u47g',
    ...(o.loop === undefined ? {} : { loop: o.loop }),
    ...(o.watch === undefined ? {} : { watch: o.watch }),
    ...(o.corruption === undefined ? {} : { corruption: o.corruption }),
    ...(o.moss === undefined ? {} : { items: [{ itemId: 'item_glow_moss', qty: o.moss }] }),
    flags: o.flags ?? {},
    patch: (s) => {
      for (const id of o.echoes ?? []) s.echoesThisLoop.push(id);
      for (const itemId of o.carrying ?? []) s.player.inventory.push({ uid: `i${s.meta.nextUid++}`, itemId, qty: 1, rarity: 'common', affixes: [] });
      if (o.mireya) {
        s.companions.recruited['mireya'] = { id: 'mireya', recruited: true, loyalty: 60, hp: 200, hpMax: 200, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} };
        s.companions.activeId = 'mireya';
      }
    },
  };
  return makeState(overrides, { content: pack });
}
const profileOf = (o: At = {}) => freshProfile({ loopCounter: o.loop ?? 1 });
const holds = (cond: Condition, locationId: string, o: At = {}): boolean => evaluate(cond, stateAt(locationId, o), profileOf(o), pack);
/**
 * Walk to `to` from the state `from` stands in. No item record exists yet beyond the starter kit (the items tables are
 * U49/U50's), and the engine cannot put an unknown item on the ground, so the destination's items are taken as already spawned.
 */
const arrive = (from: string, to: string, o: At = {}) => {
  const s = stateAt(from, o);
  s.world.locationStates[to] = {
    visited: false, visitCount: 0, items: [], itemsSpawned: true, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
    unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
  };
  return { before: s.clock.ticks, state: step(s, { type: 'move', to }, pack, profileOf(o)).state };
};
/** A return visit to `to`: it has been entered before (its first-visit fights are behind the player). */
const back = (from: string, to: string, i: number, o: At = {}): GameState => {
  const s = stateAt(from, { ...o, seed: `${o.seed ?? 'u47g'}-back-${i}` });
  s.world.locationStates[to] = {
    visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: loc(to).encounters.filter((e) => e.respawn === 'never' && e.once).map((e) => e.id), encounterClearedDay: {},
    eventsFired: loc(to).events.map((e) => e.id), flags: {}, unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
  };
  return step(s, { type: 'move', to }, pack, profileOf(o)).state;
};
const movesFrom = (locationId: string, o: At = {}): string[] =>
  legalActions(stateAt(locationId, o), pack, profileOf(o))
    .filter((a) => a.type === 'move')
    .map((a) => (a as { to: string }).to)
    .sort();
const restsAt = (locationId: string, o: At = {}): string[] =>
  legalActions(stateAt(locationId, o), pack, profileOf(o))
    .filter((a) => a.type === 'rest')
    .map((a) => (a as { kind: string }).kind);
/** The fights over `n` seeds of a visit: encounter id → count. */
const tally = (n: number, visit: (i: number) => GameState): Map<string, number> => {
  const out = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const s = visit(i);
    if (s.mode === 'combat') out.set(s.combat?.encounterId ?? '?', (out.get(s.combat?.encounterId ?? '?') ?? 0) + 1);
  }
  return out;
};
/** The first arrival at `to` (over seeds `prefix-0` …) that meets a fight: its state. */
const firstFight = (from: string, to: string, prefix: string, o: At = {}): GameState => {
  for (let i = 0; i < 200; i++) {
    const s = arrive(from, to, { ...o, seed: `${prefix}-${i}` }).state;
    if (s.mode === 'combat') return s;
  }
  throw new Error(`no fight arriving at ${to}`);
};
const DUSK_NIGHT = { any: [{ watch: 'dusk' }, { watch: 'night' }] };

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_glowfen vs WORLD §2.10, §10.1, DESIGN §6.5, §17.1, §18.2', () => {
  test('id, name, new (Appendix A.1), no faction, band, WORLD’s theme text, order, codex entry', () => {
    expect(region.id).toBe(REGION);
    expect(S210.startsWith(`### 2.10 \`${REGION}\` — ${region.name}`)).toBe(true);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | new | 8 |`);
    expect('legacy' in region).toBe(false); // not one of the five legacy regions (D-015)
    expect(pack.regions[REGION]?.legacy).toBe(false);
    expect(S210).toContain('| Level band | 8–12 |');
    expect(region.levelBand).toEqual({ min: 8, max: 12 });
    // "Glowfen folk (unaligned villagers; …)": no faction holds the region
    expect(S210).toContain('| Factions | Glowfen folk (unaligned villagers; the Remnants court their elders; the Weavers buy spores). Lanternreed is neutral ground for all three factions. |');
    expect('factionId' in region).toBe(false);
    const theme = /\*\*Theme\.\*\* ([\s\S]*?)\n\n\| Field/.exec(S210)?.[1] ?? '';
    expect(region.description).toBe(playText(theme));
    expect(region.order).toBe(10);
    expect(region.codexId).toBe('codex_region_glowfen');
    expect(STORY).toContain('| `codex_region_glowfen` |');
  });

  test('the eight locations WORLD lists, in WORLD’s order, all in the region; the region has one exit (the Causeway north), so it is a cul-de-sac', () => {
    const listed = /\| Locations \(8\) \| ([^|]+) \|/.exec(S210)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual([LC, LN, LS, EM, BP, FB, PG, MH]);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of locations) expect(l.regionId).toBe(REGION);
    expect(parsedLocations.flatMap((l) => l.exits.filter((e) => !here.has(e.to)).map((e) => `${l.id}>${e.to}`))).toEqual([`${LC}>${VG}`]);
    expect(WORLD).toContain('*The Glowfen* is a cul-de-sac off the Glowlands (one exit), hence R10-3.');
  });

  test('the pool is WORLD §10.1’s pool_glowfen, weight for weight, the barrow light at dusk and night only (D-098: a pool entry’s `when`); return chance 20 %; every entry is in-band fodder', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_glowfen');
    expect(row?.[2]).toBe('barrow light at dusk/night only');
    const entries = [...(row?.[1] ?? '').matchAll(/(cr_[a-z_]+) (\d+)/g)].map((m) => ({ creatureId: m[1] ?? '', weight: Number(m[2]) }));
    expect(entries.map((e) => e.creatureId)).toEqual([MIRELING, TOAD, SPORE, STALKER, BARROW]);
    // the barrow light is in the pool at dusk and night, at the two pool nodes that can bear its level (not the band-8 Causeway)
    const night = { any: [{ watch: 'dusk' }, { watch: 'night' }] };
    const nodes = { any: [{ location: LS }, { location: EM }] };
    expect(region.wanderingPool).toEqual([...entries.slice(0, 4), { ...entries[4], when: { all: [night, nodes] } }]);
    expect(region.returnEncounterChance).toBe(0.2);
    for (const e of entries) {
      const c = pack.creatures[e.creatureId];
      expect([e.creatureId, c?.role, c !== undefined && c.level >= region.levelBand.min - 2 && c.level <= region.levelBand.max + 2]).toEqual([e.creatureId, 'fodder', true]);
    }
    // the pool's wandering fodder are the other regions' (first region: the Glowlands, the Steppe); the Glowfen owns the light and the Matron
    expect(creatures.map((c) => c.id as string)).not.toContain(MIRELING);
    for (const id of [MIRELING, TOAD, SPORE, STALKER]) expect(pack.creatures[id]).toBeDefined();
  });

  test('palette: DESIGN §17.1’s Glowfen row (sky top, sky bottom, mid, accent = glow); the ambient preset exists in §18.2', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'The Glowfen');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).some((c) => c[0] === 'The Glowfen')).toBe(true);
    expect(region.ambient).toBe('ambient_glowfen');
    // WORLD's extra ambient layers (Lanternreed's kalimba loop, the Pool's inhale and exhale sweep) are additive: no location replaces the preset
    for (const l of parsedLocations) expect([l.id, l.ambient]).toEqual([l.id, undefined]);
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the eight locations vs WORLD §3.9 blocks', () => {
  test('names, bands, coordinates and region', () => {
    for (const l of locations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.levelBand, l.map]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map]);
    }
    expect(WL[MH]?.block).toContain('12 (boss) · (48, 16)');
  });

  test('descriptions: WORLD’s, character for character; no legacy name (a new region)', () => {
    for (const l of locations) {
      expect([l.id, l.description]).toEqual([l.id, playText(WL[l.id]?.description ?? '')]);
      expect([l.id, 'legacyName' in l]).toEqual([l.id, false]);
    }
  });

  test('exits: every WORLD exit in order, none gated; every exit costs one watch but the Gullet’s haul west, which costs two', () => {
    for (const l of parsedLocations) {
      const got = l.exits.map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.exits]);
      for (const e of l.exits) expect([l.id, e.to, e.travelWatches]).toEqual([l.id, e.to, l.id === PG && e.to === EM ? 2 : 1]);
    }
    expect(WL[PG]?.block).toContain('| west | loc_elder_mangrove | — (costs 2 watches) |');
  });

  test('rest points and merchants as WORLD says: the Lanternreed inn and Fennick’s stall; the Pool rests only while Elder Wen’s cleansing is on offer; nothing else rests or sells', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      // WORLD's Pool block says "no"; the cleansing is "one full rest here" (the header of locations.ts)
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, l.id === BP ? 'cond' : w?.rest, w?.merchant]);
    }
    expect(loc(LN).rest).toMatchObject({ kind: 'inn', cost: 10 });
    expect(loc(LN).merchantId).toBe('npc_old_fennick');
    expect(WL[LN]?.merchant).toBe('npc_old_fennick');
    expect(tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'glowfen')?.[9]).toBe('LN inn');
    expect(WL[BP]?.rest).toBe('no');
    expect(loc(BP).rest).toMatchObject({ kind: 'sanctum', cost: 0 });
    expect(loc(BP).merchantId).toBeUndefined();
  });

  test('every item WORLD places is placed, with WORLD’s conditions; the Hall’s loot is the Matron’s for the fight and the bypass’s here', () => {
    for (const l of parsedLocations) {
      expect([l.id, [...new Set(l.items.map((i) => i.itemId))].sort()]).toEqual([l.id, [...new Set(WL[l.id]?.itemIds ?? [])].sort()]);
    }
    const plain = (itemId: string, count = 1) => ({ itemId, count, hidden: false, once: true, chance: 1, onTake: [] }); // U34d's defaults
    expect(loc(LC).items).toEqual([plain('item_glow_moss')]);
    expect(loc(LN).items).toEqual([plain('item_antidote_root', 2)]);
    expect(loc(LS).items).toEqual([plain('mat_glow_gland', 3)]);
    expect(loc(BP).items).toEqual([plain('item_stillwater_phial')]);
    expect(loc(PG).items).toEqual([plain('mat_glow_gland', 2)]);
    // the Mangrove: "Loop 2+, 100% once, in a root-hollow, if Mireya is active" = hidden, found by examining
    expect(WL[EM]?.block).toContain('item_lanternwood_bow (Loop 2+, 100% once, in a root-hollow, if Mireya is active)');
    expect(loc(EM).items).toEqual([plain('mat_ley_resin', 2), { ...plain('item_lanternwood_bow'), hidden: true, when: { all: [{ loop: { min: 2 } }, { companion: { id: 'mireya' } }] } }]);
    // the Barrows: the vial "100% after cr_barrow_light" = hidden until a light has been killed (this loop)
    expect(WL[FB]?.block).toContain('item_barrow_light_vial ×1 (100% after cr_barrow_light), mat_ley_resin ×1');
    expect(loc(FB).items).toEqual([{ ...plain('item_barrow_light_vial'), hidden: true, when: { killed: { id: BARROW } } }, plain('mat_ley_resin')]);
    // the Hall: Mireya's lantern for a party with Mireya; the Matron's loot for the bypass only
    const lulled: Condition = { all: [{ companion: { id: 'mireya' } }, { item: { id: 'item_mireyas_lantern' } }] };
    expect(WL[MH]?.block).toContain('item_mireyas_lantern (Mireya\'s quest), item_lantern_moth_brooch (100% after boss), mat_ley_resin ×4 (after boss)');
    expect(loc(MH).items).toEqual([
      { ...plain('item_mireyas_lantern'), when: { companion: { id: 'mireya' } } },
      { ...plain('item_lantern_moth_brooch'), when: lulled },
      { ...plain('mat_ley_resin', 4), when: lulled },
    ]);
    expect(cr(MATRON).loot.map((r) => [r.itemId, r.count])).toEqual([['item_lantern_moth_brooch', 1], ['mat_ley_resin', 4], ['mat_glow_gland', 3]]);
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa (the Matron’s own Calls aside)', () => {
    for (const l of parsedLocations) {
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      const expected = new Set(WL[l.id]?.creatureIds ?? []);
      if (l.id === MH) expected.delete(TOAD); // "adds cr_lantern_toad": the Matron's Call
      expect([l.id, [...got].sort()]).toEqual([l.id, [...expected].sort()]);
    }
    expect(cr(MATRON).moves['matron_call']?.summon).toEqual({ creatureId: TOAD, count: 1, max: 2, hpPct: 1 });
  });

  test('first-visit fights at WORLD’s chances (50 / 70 / 60 / 100 % and the Barrows by the watch); the Gullet is a fleeable scatter node (WORLD §10.4); the boss holds', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const shape = (l: string, id: string) => {
      const x = e(l, id);
      return [x.groups.map((g) => `${g.creatureId}×${g.count}`), x.chance, x.respawn, x.once, x.fleeable, x.onFlee, x.when];
    };
    expect(WL[LC]?.block).toContain('first: cr_lantern_toad ×2 (50%). return: pool(glowfen) 20%.');
    expect(shape(LC, 'enc_causeway_toads')).toEqual([['cr_lantern_toad×2'], 0.5, 'never', true, true, 'scatter', undefined]);
    expect(WL[LS]?.block).toContain('first: cr_spore_drift ×2 (70%). return: cr_glowfen_mireling ×2 (30%) or pool 20%.');
    expect(shape(LS, 'enc_shallows_spore_drifts')).toEqual([['cr_spore_drift×2'], 0.7, 'never', true, true, 'scatter', undefined]);
    expect(WL[EM]?.block).toContain('first: cr_reed_stalker ×1 + cr_glowfen_mireling ×1 (60%). return: cr_barrow_light ×1 (20%) or pool 20%.');
    expect(shape(EM, 'enc_mangrove_stalker_mireling')).toEqual([['cr_reed_stalker×1', 'cr_glowfen_mireling×1'], 0.6, 'never', true, true, 'scatter', undefined]);
    expect(WL[FB]?.block).toContain('first: cr_barrow_light ×1 (100%, dusk/night; 40% by day). return: cr_barrow_light ×1 (30%).');
    expect(shape(FB, 'enc_barrows_light_night')).toEqual([['cr_barrow_light×1'], 1, 'never', true, true, 'scatter', DUSK_NIGHT]);
    expect(shape(FB, 'enc_barrows_light_day')).toEqual([['cr_barrow_light×1'], 0.4, 'never', true, true, 'scatter', { not: DUSK_NIGHT }]);
    expect(WL[PG]?.block).toContain('first: cr_glowfen_mireling ×3 (100%). return: cr_reed_stalker ×2 (40%).');
    expect(shape(PG, 'enc_gullet_mirelings')).toEqual([['cr_glowfen_mireling×3'], 1, 'never', true, true, 'scatter', undefined]);
    const boss = e(MH, 'enc_hall_matron');
    expect([boss.groups, boss.fleeable, boss.onFlee, boss.chance, boss.optionalWhen]).toEqual([
      [{ creatureId: MATRON, count: 1 }],
      false,
      'hold',
      1,
      { all: [{ companion: { id: 'mireya' } }, { item: { id: 'item_mireyas_lantern' } }] },
    ]);
    expect(WL[MH]?.block).toContain('**forced boss:** cr_lantern_matron ×1 (adds cr_lantern_toad). Pacifist bypass: with Mireya active and `item_mireyas_lantern` lit');
    // §10.4: no elites; the Gullet and the Barrows (dusk/night) are the scatter nodes; the Hall is forced without Mireya and her lit lantern
    const row = tableRows(section(WORLD, '### 10.4 Elites', '### 10.5')).find((c) => c[0] === 'glowfen');
    expect(row?.[1]).toBe('none');
    expect(row?.[2]).toBe('MH without Mireya + lit `item_mireyas_lantern`');
    expect(row?.[3]).toBe('PG, FB (dusk/night)');
    // every fight but the Matron's can be fled (a scatter node)
    const fleeable = parsedLocations.flatMap((l) => l.encounters.filter((x) => x.id !== 'enc_hall_matron').map((x) => [x.id, x.fleeable, x.onFlee]));
    expect(fleeable).toHaveLength(10); // D-098 retired the two dusk-and-night pool-share groups
    for (const row of fleeable) expect(row.slice(1)).toEqual([true, 'scatter']);
  });

  test('return rolls at WORLD’s chances, each ahead of the pool’s 20 %; the pool’s dusk-and-night barrow light holds at the Shallows and the Mangrove, not the Causeway (D-098; rule 11); the Pool, Lanternreed, the Barrows, the Gullet and the Hall name no pool, so they are `safe`', () => {
    const e = (l: string, id: string) => byId(loc(l).encounters, id);
    const back2 = (l: string, id: string) => [e(l, id).chance, e(l, id).respawn, e(l, id).once, e(l, id).groups.map((g) => `${g.creatureId}×${g.count}`)];
    expect(back2(LS, 'enc_shallows_mirelings')).toEqual([0.3, 'on_return', false, ['cr_glowfen_mireling×2']]);
    expect(back2(EM, 'enc_mangrove_barrow_light')).toEqual([0.2, 'on_return', false, ['cr_barrow_light×1']]);
    expect(back2(FB, 'enc_barrows_light_return')).toEqual([0.3, 'on_return', false, ['cr_barrow_light×1']]);
    expect(back2(PG, 'enc_gullet_stalkers')).toEqual([0.4, 'on_return', false, ['cr_reed_stalker×2']]);
    // the pool entry's `when` (D-098): dusk or night, at the Shallows or the Mangrove — not the Causeway, nor by day
    const light = region.wanderingPool.find((x) => x.creatureId === BARROW)?.when as Condition;
    for (const [at, flags, isNight] of [[LS, true, true], [EM, true, true], [LC, false, true], [LS, false, false]] as const) {
      expect([at, isNight, holds(light, at, { watch: isNight ? 3 : 1 })]).toEqual([at, isNight, flags]);
    }
    expect(loc(LS).encounters.map((x) => x.id)).toEqual(['enc_shallows_spore_drifts', 'enc_shallows_mirelings']);
    expect(loc(EM).encounters.map((x) => x.id)).toEqual(['enc_mangrove_stalker_mireling', 'enc_mangrove_barrow_light']);
    expect(loc(LC).encounters.map((x) => x.id)).toEqual(['enc_causeway_toads']);
    expect([LC, LN, LS, EM, BP, FB, PG, MH].map((id) => loc(id).safe)).toEqual([false, true, false, false, true, true, true, true]);
    expect(WL[LN]?.block).toContain('**Encounters:** none (settlement).');
    expect(WL[BP]?.block).toContain('**Encounters:** none while Wen lives.');
  });

  test('events: every WORLD event, its text verbatim, ids as WORLD spells them; once unless the cleansing (every qualifying rest); WORLD’s conditions and grants', () => {
    const coined = ['ev_mangrove_answer_plain', 'ev_pool_cleanse_free'];
    for (const l of parsedLocations) {
      const got = Object.fromEntries(l.events.filter((e) => !coined.includes(e.id)).map((e) => [e.id, e.text]));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.events]);
      for (const e of l.events) if (!e.id.startsWith('ev_pool_cleanse')) expect([e.id, e.trigger, e.once]).toEqual([e.id, 'enter', true]);
    }
    const ev = (l: string, id: string) => byId(loc(l).events, id);
    // "once; grants echo_glowlands_leak with Mireya active": two events with complementary `when`s
    expect(WL[EM]?.block).toContain('— once; grants `echo_glowlands_leak` with Mireya active.');
    expect(ev(EM, 'ev_mangrove_answer')).toMatchObject({ when: { companion: { id: 'mireya' } }, effects: [{ grantEcho: 'echo_glowlands_leak' }] });
    expect(ev(EM, 'ev_mangrove_answer_plain')).toMatchObject({ when: { not: { companion: { id: 'mireya' } } }, effects: [] });
    expect(ev(EM, 'ev_mangrove_answer_plain').text).toBe(ev(EM, 'ev_mangrove_answer').text);
    // "once, Loop 3+; grants echo_seven_wayfinders if not already held" (a repeated grant is a no-op, effects.ts)
    expect(WL[FB]?.block).toContain('— once, Loop 3+; grants `echo_seven_wayfinders` if not already held.');
    expect(ev(FB, 'ev_barrows_names')).toMatchObject({ when: { loop: { min: 3 } }, effects: [{ grantEcho: 'echo_seven_wayfinders' }] });
    expect(section(WORLD, '### 12.1 State table', '### 12.2')).toContain('`ev_barrows_names` (FB); Dask on the Still Shore');
    // "once per loop"
    expect(WL[LN]?.block).toContain('— once per loop.');
    expect(WL[MH]?.block).toContain('— once per loop.');
    // the cleansing: "fires on cleansing"
    expect(WL[BP]?.block).toContain('`ev_pool_cleanse` — "Wen puts your hands in the light.');
    expect(WL[BP]?.block).toContain('— fires on cleansing.');
  });

  test('NPC placement: Lanternreed lists WORLD’s four, the Pool lists Wen (who sits with the elders at Lanternreed too); no one else is placed', () => {
    expect(WL[LN]?.npcIds).toEqual(['npc_elder_tam', 'npc_elder_wen', 'npc_old_fennick', 'npc_mireya']);
    expect(loc(LN).npcs).toEqual(['npc_elder_tam', 'npc_elder_wen', 'npc_old_fennick', 'npc_mireya']);
    expect(WL[BP]?.npcIds).toEqual(['npc_elder_wen']);
    expect(loc(BP).npcs).toEqual(['npc_elder_wen']);
    for (const l of parsedLocations) if (![LN, BP].includes(l.id)) expect([l.id, l.npcs]).toEqual([l.id, []]);
  });

  test('art: WORLD’s horizon per block; the swamp template (a cavern for the Hall); particles as the art spec says; no location overrides the dusk-lit palette but the Hall', () => {
    expect(parsedLocations.map((l) => [l.id, l.art.template, l.art.horizon])).toEqual(
      [LC, LN, LS, EM, BP, FB, PG, MH].map((id) => [id, id === MH ? 'cavern' : 'swamp', WL[id]?.horizon]),
    );
    expect(parsedLocations.map((l) => l.art.horizon)).toEqual([0.6, 0.58, 0.62, 0.5, 0.6, 0.58, 0.55, 0.45]);
    expect(parsedLocations.map((l) => l.art.particles)).toEqual(['motes', 'motes', 'spores', 'fireflies', 'motes', 'fireflies', 'motes', 'motes']);
    for (const [id, spec] of [[LC, 'green motes rising from water'], [LS, 'glowing spore dust'], [EM, 'slow drifting fireflies'], [FB, 'firefly swarm'], [PG, 'white motes streaming downhill']] as const) {
      expect(WL[id]?.block).toContain(`particles: ${spec}`);
    }
    expect(parsedLocations.map((l) => l.art.timeOfDay)).toEqual(['dusk', 'dusk', 'dusk', 'dusk', 'dusk', 'dusk', 'dusk', 'timeless']);
    expect(S210).toContain('Humid; glow brightens at night.');
  });
});

// ---- Map data (WORLD §11) -------------------------------------------------------------------------------------------------------

describe('WORLD §11 map data', () => {
  test('§11.1 nodes: coordinates, band, rest, merchant; the settlement is Lanternreed', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable]);
      const rest = l.rest === undefined ? '—' : l.rest.when === undefined ? l.rest.kind : 'cond';
      expect([l.id, rest, l.merchantId ?? '—']).toEqual([l.id, l.id === BP ? 'cond' : n?.rest, n?.merchant]);
      expect([l.id, l.tags.includes('settlement')]).toEqual([l.id, n?.settlement]);
    }
    expect(NODES[LN]?.rest).toBe('inn');
    expect(NODES[BP]?.rest).toBe('—');
  });

  test('§11.2 edges: every walk edge touching the region exists with its direction, cost and gate on both sides; the Gullet’s haul west costs two', () => {
    const walks = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(walks.map((e) => `${e.from}>${e.to}`)).toEqual([
      `${VG}>${LC}`,
      `${LC}>${LN}`,
      `${LC}>${LS}`,
      `${LN}>${EM}`,
      `${LN}>${BP}`,
      `${LS}>${EM}`,
      `${EM}>${FB}`,
      `${EM}>${PG}`,
      `${BP}>${FB}`,
      `${FB}>${MH}`,
      `${PG}>${MH}`,
    ]);
    for (const e of walks) {
      if (here.has(e.from) || e.from === VG) {
        const exit = pack.locations[e.from]?.exits.find((x) => x.to === e.to);
        expect([e.from, e.to, exit?.dir, exit?.travelWatches, exit?.when !== undefined]).toEqual([e.from, e.to, e.dir, e.cost, e.gate !== 'open']);
      }
      if (here.has(e.to)) {
        const back2 = pack.locations[e.to]?.exits.find((x) => x.to === e.from);
        expect([e.to, e.from, back2?.dir, back2?.travelWatches, back2?.when !== undefined]).toEqual([e.to, e.from, e.reverseDir, e.reverseCost, e.reverseGate !== 'open']);
      }
    }
    expect(EDGES.find((e) => e.from === EM && e.to === PG)).toMatchObject({ cost: 1, reverseCost: 2 });
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

  test('reachability from loc_whispering_ruins: the region has no gate of its own, so it opens with the Glowlands road (WORLD §3.13: the Depths gate, or the Nomad route); the Causeway is 7 watches out', () => {
    expect(section(WORLD, '### 3.13', '### Conventions')).toContain('| The Glowfen | WR → Archives → Depths → Pass → Spires → Plateau → Glowlands → Causeway (7) | Depths gate only (or the Nomad route via the Outpost → Plateau, 7) |');
    for (const l of parsedLocations) for (const x of l.exits) expect([l.id, x.to, x.when]).toEqual([l.id, x.to, undefined]);
    const all = reach(() => true);
    expect(all.get(LC)).toBe(7);
    expect(all.get(VG)).toBe(6);
    expect([LN, LS, EM, BP, FB, PG, MH].map((id) => (all.get(id) ?? 0) - (all.get(LC) ?? 0))).toEqual([1, 1, 2, 2, 3, 3, 4]);
    // every node is reachable once the road to the Glowlands is
    expect([LC, LN, LS, EM, BP, FB, PG, MH].every((id) => all.has(id))).toBe(true);
  });

  test('§10.3 row: 8 nodes, sweep 7 watches, fights 4.4 first / 1.7 return (through-route 0.5 / 0.2, +1.6 / +0.3), worst node 3 from a rest point, rest point LN inn', () => {
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'glowfen') ?? [];
    expect(row.slice(1, 3)).toEqual(['8–12', '8']);
    // the sweep: the cheapest walk from the gateway (the Causeway) that visits every node of the region, by watches
    const inside = new Map<string, { to: string; cost: number }[]>(parsedLocations.map((l) => [l.id, l.exits.filter((e) => here.has(e.to)).map((e) => ({ to: e.to, cost: e.travelWatches }))]));
    const ordered = [...inside.keys()];
    const full = (1 << ordered.length) - 1;
    const best = new Map<string, number>([[`${ordered.indexOf(LC)}:${1 << ordered.indexOf(LC)}`, 0]]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const [key, cost] of [...best]) {
        const [at, mask] = key.split(':').map(Number) as [number, number];
        for (const e of inside.get(ordered[at] ?? '') ?? []) {
          const j = ordered.indexOf(e.to);
          const k = `${j}:${mask | (1 << j)}`;
          if (cost + e.cost < (best.get(k) ?? Infinity)) (best.set(k, cost + e.cost), (changed = true));
        }
      }
    }
    const sweep = Math.min(...[...best].filter(([k]) => Number(k.split(':')[1]) === full).map(([, c]) => c));
    expect(sweep).toBe(Number(row[6]));
    expect(row[6]).toBe('7');

    // expected fights (WORLD §10.0, Loop 1, a neutral Wayfinder): a first group counts its chance; "X (p%) or pool 20 %" counts
    // p + (1 − p)·0.2; a node with no pool counts p alone; a settlement none; the boss counts 1 on the first visit. The
    // dusk-and-night extras (the Pool's barrow light) are not Loop 1's neutral count
    const plain = (e: Location['encounters'][number]) => e.when === undefined;
    const firstVisit = (ids2: string[], atNight = false): number =>
      ids2.reduce(
        (sum, id) =>
          sum +
          loc(id)
            .encounters.filter((e) => e.respawn !== 'on_return')
            .filter((e) => plain(e) || (e.id === 'enc_barrows_light_night' ? atNight : !atNight))
            .reduce((p, e) => p + e.chance, 0),
        0,
      );
    const returning = (ids2: string[]): number =>
      ids2.reduce((sum, id) => {
        const l = loc(id);
        const own = l.encounters.filter((e) => e.respawn === 'on_return' && plain(e));
        const pool = l.safe ? 0 : region.returnEncounterChance;
        return sum + (1 - own.reduce((p, e) => p * (1 - e.chance), 1) * (1 - pool));
      }, 0);
    const all = [LC, LN, LS, EM, BP, FB, PG, MH];
    expect(one(returning(all))).toBe('1.7');
    expect(row[7]).toBe('4.4 / 1.7');
    // WORLD prints the Barrows' first visit at 0.6 (4.4 = 0.5 + 0.7 + 0.6 + 0.6 + 1.0 + 1.0; through-route +1.6 = 0.6 + 1.0), which is
    // neither of the section's two figures: 40 % by day (4.2 in all) or 100 % at dusk and night (4.8). The record keeps §3.9's words
    expect([one(firstVisit(all)), one(firstVisit(all, true))]).toEqual(['4.2', '4.8']);
    expect(Number(row[7]?.split(' / ')[0])).toBeGreaterThan(4.2);
    expect(Number(row[7]?.split(' / ')[0])).toBeLessThan(4.8);
    expect(row[5]).toBe('0.5 / 0.2 · +1.6 / +0.3');
    expect([one(firstVisit([LC, LN])), one(returning([LC, LN]))]).toEqual(['0.5', '0.2']);
    expect([one(returning([BP, FB, MH]))]).toEqual(['0.3']);
    expect([one(firstVisit([BP, FB, MH])), one(firstVisit([BP, FB, MH], true))]).toEqual(['1.4', '2.0']);
    expect(row[3]).toBe('VG→LC→LN · LN→BR→FB→MH');
    expect(row[4]).toBe('2 · +3');
    // "to rest": the worst node's cheapest way to the Lanternreed inn, by watches (the Gullet's haul west costs two)
    const dist = (from: string): number => {
      const d = new Map<string, number>([[from, 0]]);
      for (let changed = true; changed; ) {
        changed = false;
        for (const [at, cost] of [...d]) for (const e of inside.get(at) ?? []) if (cost + e.cost < (d.get(e.to) ?? Infinity)) (d.set(e.to, cost + e.cost), (changed = true));
      }
      return d.get(LN) ?? Infinity;
    };
    expect(Math.max(...all.map(dist))).toBe(Number(row[8]));
    expect(row[8]).toBe('3');
    expect([dist(PG), dist(MH)]).toEqual([3, 3]);
    expect(row[9]).toBe('LN inn');
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6.6', () => {
  const MINE = [BARROW, MATRON];

  test('exactly the creatures whose first region is the Glowfen (D-090), in WORLD’s block order; the Mireling, Toad and Spore Drift stay in the Glowlands, the Reed Stalker in the Steppe', () => {
    const first = Object.values(CREATURE_TABLE).filter((r) => r.regions === 'Glowfen').map((r) => r.id);
    expect([...first].sort()).toEqual([...MINE].sort());
    expect(creatures.map((c) => c.id)).toEqual(MINE);
    expect([MIRELING, TOAD, SPORE].map((id) => CREATURE_TABLE[id]?.regions)).toEqual(['Glowlands, Glowfen', 'Glowlands, Glowfen', 'Glowlands, Glowfen']);
    expect(CREATURE_TABLE[STALKER]?.regions).toBe('Ashen Steppe, Glowfen');
    for (const id of [MIRELING, TOAD, SPORE, STALKER]) expect(pack.creatures[id]).toBeDefined();
  });

  test('name, family, role, level and XP as WORLD’s table; XP follows DESIGN §6.2 (fodder round(20 + 8L + 1.2L²); the boss is hand-set 770)', () => {
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, row?.name.startsWith(c.name), c.family, c.role, c.level, c.xp]).toEqual([c.id, true, row?.family, row?.role, row?.level, row?.xp]);
    }
    const fodder = (L: number): number => Math.round(20 + 8 * L + 1.2 * L * L);
    expect([cr(BARROW).xp, fodder(11)]).toEqual([253, 253]);
    // regional boss: band top + 2; 400–1,200 hand-set
    expect([cr(MATRON).level, cr(MATRON).xp]).toEqual([region.levelBand.max + 2, 770]);
    expect(cr(MATRON).xp).toBeGreaterThanOrEqual(400);
    expect(cr(MATRON).xp).toBeLessThanOrEqual(1200);
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK; the boss’s HP is WORLD’s 430, the 12 × (39.6 − 4 armor) = 427 budget rounded (D-067.20)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
    expect(cr(MATRON).stats).toEqual({ hp: 430, atk: 26, sp: 26, armor: 4, ward: 6, agi: 4 });
    expect(Math.round(12 * (39.6 - cr(MATRON).stats.armor))).toBe(427);
    expect(Math.abs(cr(MATRON).stats.hp - 12 * (39.6 - cr(MATRON).stats.armor))).toBeLessThan(5);
    expect(WORLD).toContain('Glowfen (top 12, ATK 33) 39.6');
  });

  test('resistances and immunities as WORLD’s Resist line; the Green carry Poison (immune); the Matron is Blind- and Stun-immune, Stagger-able and cannot be fled', () => {
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
      expect([c.id, c.family, c.statusImmunities.includes('status_poison')]).toEqual([c.id, 'fam_green', true]); // "Poison immune (they carry it)"
    }
    expect(cr(MATRON).statusImmunities.sort()).toEqual(['status_blind', 'status_poison', 'status_stun']);
    expect(cr(MATRON).resistances).toEqual({ void: 'weak', fire: 'weak', ley: 'resist' });
    expect(cr(BARROW).statusImmunities.sort()).toEqual(['status_bleed', 'status_poison']);
    expect([cr(MATRON).interruptible, cr(MATRON).fleeable]).toEqual([true, false]);
    expect(bullet(block(MATRON), 'Resist:')).toContain('Stagger allowed');
    expect(bullet(block(MATRON), 'Stats:')).toContain('cannot be fled');
    expect(cr(MATRON).tags).toContain('regional_boss');
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
      expect([c.id, Object.keys(c.moves).filter((id) => !used.has(id))]).toEqual([c.id, []]);
      for (const m of Object.values(c.moves)) expect([c.id, m.line, words(m.line) <= 12]).toEqual([c.id, m.line, true]);
    }
  });

  test('moves carry WORLD’s numbers: the multiplier and stat, type, statuses and their chances, heals, shields, the Call', () => {
    const m = (c: string, id: string) => cr(c).moves[id];
    const hit = (c: string, id: string) => [m(c, id)?.type, m(c, id)?.power?.coef, m(c, id)?.power?.stat];
    const rows = (c: string, id: string) => m(c, id)?.statuses.map((s) => [s.status.slice('status_'.length), s.chance, s.duration, s.target]);
    expect(rows(BARROW, 'barrow_keep_watch')).toEqual([['mark', 1, 3, 'target']]);
    expect(m(BARROW, 'barrow_keep_watch')?.power).toBeUndefined();
    expect(hit(BARROW, 'barrow_cold_glow')).toEqual(['ley', 1.1, 'sp']);
    expect(rows(BARROW, 'barrow_cold_glow')).toEqual([['weaken', 0.4, 2, 'target']]);
    expect(hit(BARROW, 'barrow_say_a_name')).toEqual(['ley', 0.5, 'sp']);
    expect(rows(BARROW, 'barrow_say_a_name')).toEqual([['stun', 0.3, 1, 'target']]);
    expect(m(BARROW, 'barrow_gather')?.heal).toMatchObject({ target: 'self', power: { coef: 1.0, stat: 'atk' } });
    expect(hit(MATRON, 'matron_hum')).toEqual(['ley', 0.4, 'sp']);
    expect(rows(MATRON, 'matron_hum')).toEqual([['slow', 0.6, 2, 'target']]);
    expect(m(MATRON, 'matron_lantern_light')?.shield?.power).toEqual({ base: 0, coef: 1.2, stat: 'atk', hits: 1 });
    expect(rows(MATRON, 'matron_lantern_light')).toEqual([['regen', 1, 3, 'self']]);
    expect(m(MATRON, 'matron_lantern_light')?.statuses[0]?.power).toEqual({ base: 0, coef: 0.3, stat: 'atk' });
    expect(hit(MATRON, 'matron_reach')).toEqual(['physical', 1.2, 'atk']);
    expect(rows(MATRON, 'matron_reach')).toEqual([['slow', 0.4, 2, 'target']]);
    expect(hit(MATRON, 'matron_name_you')).toEqual(['ley', 0.5, 'sp']);
    expect(rows(MATRON, 'matron_name_you')).toEqual([['curse', 1, 3, 'target'], ['mark', 1, 3, 'target']]);
    expect(hit(MATRON, 'matron_embrace')).toEqual(['physical', 1.6, 'atk']);
    expect(rows(MATRON, 'matron_embrace')).toEqual([['poison', 0.6, 4, 'target']]);
    expect(m(MATRON, 'matron_drink')?.heal).toMatchObject({ target: 'self', power: { coef: 1.5, stat: 'atk' } });
    expect(hit(MATRON, 'matron_flood')).toEqual(['ley', 1.1, 'sp']);
    expect(rows(MATRON, 'matron_flood')).toEqual([['blind', 0.5, 1, 'target']]);
    expect(m(MATRON, 'matron_call')?.summon).toEqual({ creatureId: TOAD, count: 1, max: 2, hpPct: 1 });
    // "physical on Reach and Embrace": the other moves are the creature's ley
    expect([m(MATRON, 'matron_reach')?.type, m(MATRON, 'matron_embrace')?.type]).toEqual(['physical', 'physical']);
  });

  test('the Barrow-Light’s Stun is from Loop 3 (the tactics: "from Loop 3 the named turn is the Stun turn")', () => {
    expect(cr(BARROW).moves['barrow_say_a_name']?.statuses[0]?.when).toEqual({ loop: { min: 3 } });
    expect(bullet(block(BARROW), 'Tactics:')).toContain('from Loop 3 the named turn is the Stun turn');
    expect(bullet(block(BARROW), 'Bestiary')).toContain('In the third loop they began to say names.');
  });

  test('loot: gold ranges and every item WORLD lists, with WORLD’s chances and counts (100 % = guaranteed); the vial is the Barrows’ hidden item, not the creature’s', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      const text = bullet(block(c.id), 'Loot:');
      const expected = [...text.matchAll(/`((?:item|mat)_[a-z0-9_]+)`†?(?: ×(\d+))? (\d+)%/g)].map((m) => [m[1], Number(m[2] ?? 1), Number(m[3]) / 100]);
      expect([c.id, c.loot.map((l) => [l.itemId, l.count, l.chance])]).toEqual([c.id, expected]);
      for (const l of c.loot) expect([c.id, l.when]).toEqual([c.id, undefined]);
    }
    expect(bullet(block(BARROW), 'Loot:')).toContain('`item_barrow_light_vial` (the first one killed at loc_firefly_barrows, 100%, WORLD §3.9)');
    expect(cr(BARROW).loot.map((l) => l.itemId)).not.toContain('item_barrow_light_vial');
    expect(loc(FB).items.map((i) => i.itemId)).toContain('item_barrow_light_vial');
    // gold [3 + 2L, 6 + 3L]: the Barrow-Light's 25–39 at L11; the boss's is WORLD's 145–225
    expect([cr(BARROW).gold, cr(MATRON).gold]).toEqual([{ min: 25, max: 39 }, { min: 145, max: 225 }]);
  });

  test('bestiary voice, entry and tactics are WORLD’s text verbatim (backticks, asterisks and decision references dropped); family codex entry; reveals at 1 and 3 kills; short non-legacy descriptions', () => {
    for (const c of parsedCreatures) {
      const b = block(c.id);
      const voice = /- \*\*Bestiary\*\* \((Remnant Archive|Wayfinder's Notes)\)/.exec(b)?.[1];
      expect([c.id, c.bestiary.voice]).toEqual([c.id, voice === 'Remnant Archive' ? 'remnant_archive' : 'wayfinder_notes']);
      expect([c.id, c.bestiary.summary]).toEqual([c.id, playText(bullet(b, 'Bestiary'))]);
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, playText(bullet(b, 'Tactics:'))]);
      expect(c.bestiary.codexId).toBe('codex_creatures_green');
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
      expect([c.id, c.legacyName, /- \*\*Legacy description:\*\*/.test(b)]).toEqual([c.id, undefined, false]); // no legacy line: the Glowfen's own
      expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
    }
    expect(STORY).toContain('| `codex_creatures_green` |');
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
  const profile = freshProfile({ loopCounter: 1 });
  const s = makeState({ level: 12 }, { content: pack, profile });
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
    if (move?.windUp && !Object.keys(foe.cooldowns).some((k) => k.startsWith('windup:'))) foe.cooldowns[`windup:${intent?.moveId}`] = move.windUp.turns + 1;
    for (const k of Object.keys(foe.cooldowns)) if (k.startsWith('windup:') && (foe.cooldowns[k] = (foe.cooldowns[k] ?? 0) - 1) <= 0) delete foe.cooldowns[k];
    foe.pattern.turnsTaken += 1;
  }
  return out;
}
const seq = (s: string): string[] => s.split(' ');
const hpAt = (fraction: number) => (foe: Combatant) => void (foe.hp = Math.floor(foe.hpMax * fraction));
/** Marks the `n`th ally of the foe (1-based) as fallen or standing. */
const ally = (combat: CombatState, n: number, standing: boolean): void => {
  const a = combat.enemies[n] as Combatant;
  a.alive = standing;
  a.hp = standing ? a.hpMax : 0;
};

describe('patterns: WORLD’s cadence words hold turn by turn', () => {
  test('the Barrow-Light: Keep Watch first, Say a Name on every third turn, Gather below 40 % HP, else the Cold Glow', () => {
    expect(plan(BARROW, 8)).toEqual(seq('keep_watch cold_glow say_a_name cold_glow cold_glow say_a_name cold_glow cold_glow'));
    // hurt from the start: Keep Watch still opens (WORLD's order: `first`, then the third-turn name, then Gather)
    expect(plan(BARROW, 8, { before: (_t, f) => hpAt(0.3)(f) })).toEqual(seq('keep_watch gather say_a_name gather gather say_a_name gather gather'));
    // 40 % is not below 40 %
    expect(plan(BARROW, 3, { before: (_t, f) => hpAt(0.4)(f) })).toEqual(seq('keep_watch cold_glow say_a_name'));
  });

  test('the Lantern Matron, Lullaby: Hum, Lantern Light and Reach in turn, the Call on every third turn (the cycle resumes after it)', () => {
    expect(plan(MATRON, 9, { phase: 0 })).toEqual(seq('hum lantern_light call reach hum call lantern_light reach call'));
    // her own Calls are not turn-order dependent on the toads she has: with two standing the Call still comes on the third turn
    expect(plan(MATRON, 4, { phase: 0, allies: [{ creatureId: TOAD, count: 2 }] })).toEqual(seq('hum lantern_light call reach'));
  });

  test('the Lantern Matron, Counting the Names: Name You and Embrace in turn; Drink replaces them while a toad stands, and consumes it', () => {
    expect(plan(MATRON, 6, { phase: 1 })).toEqual(seq('name_you embrace name_you embrace name_you embrace'));
    const toads = [{ creatureId: TOAD, count: 2 }];
    // U34e (D-096): each Drink consumes a toad (`consumesAlly`; the walk does not execute moves, so `before` takes them as she drinks)
    expect(cr(MATRON).moves['matron_drink']?.consumesAlly).toBe(TOAD);
    const drunk = (t: number, _f: Combatant, c: CombatState): void => {
      for (let i = 1; i <= Math.min(2, t - 1); i++) (c.enemies[i] as Combatant).fledOrGone = true;
    };
    expect(plan(MATRON, 6, { phase: 1, allies: toads, before: drunk })).toEqual(seq('drink drink name_you embrace name_you embrace'));
    // one toad killed before the first Drink: she drinks the other, then none is left
    const one = (t: number, _f: Combatant, c: CombatState): void => {
      ally(c, 1, false);
      if (t > 1) (c.enemies[2] as Combatant).fledOrGone = true;
    };
    expect(plan(MATRON, 4, { phase: 1, allies: toads, before: one })).toEqual(seq('drink embrace name_you embrace'));
    const none = (_t: number, _f: Combatant, c: CombatState): void => (ally(c, 1, false), ally(c, 2, false));
    expect(plan(MATRON, 4, { phase: 1, allies: toads, before: none })).toEqual(seq('name_you embrace name_you embrace'));
  });

  test('the Lantern Matron, She Wants More: the Flood on every second turn, Embrace between; her Regen and Shield are stripped on entry and nothing in her pattern puts them back', () => {
    expect(plan(MATRON, 6, { phase: 2 })).toEqual(seq('embrace flood embrace flood embrace flood'));
    const m = cr(MATRON);
    expect(m.phases[2]?.onEnter).toEqual([{ stripBuffs: { kinds: ['shield', 'regen'], target: 'self' } }]);
    expect(m.phases[2]?.statusImmunities).toEqual(['status_shield', 'status_regen']); // U34e (D-096): "cannot be reapplied"
    const used = new Set<string>();
    walkSteps(m.phases[2]?.pattern ?? [], [], (s) => void ('move' in s && used.add(s.move)));
    expect([...used].sort()).toEqual(['matron_embrace', 'matron_flood']);
    for (const id of used) expect([id, m.moves[id]?.shield, m.moves[id]?.statuses.map((s) => s.status).filter((s) => ['status_regen'].includes(s))]).toEqual([id, undefined, []]);
    // the only Shield and Regen she casts is Phase 1's Lantern Light
    expect(Object.entries(m.moves).filter(([, mv]) => mv.shield || mv.statuses.some((s) => s.status === 'status_regen')).map(([id]) => id)).toEqual(['matron_lantern_light']);
  });

  test('the Lantern Matron’s phases: ids, names, triggers (65 %, 30 %), WORLD’s transition lines; no phase is skipped (the Matron has no bypass in the fight)', () => {
    const m = cr(MATRON);
    expect(m.phases.map((p) => [p.id, p.name, p.enterWhen])).toEqual([
      ['matron_lullaby', 'Lullaby', []],
      ['matron_counting_the_names', 'Counting the Names', [{ hpBelow: 0.65 }]],
      ['matron_she_wants_more', 'She Wants More', [{ hpBelow: 0.3 }]],
    ]);
    const W = flat(block(MATRON));
    expect(W).toContain('**Phase 1 — Lullaby** (100–65%):');
    expect(W).toContain('**Phase 2 — Counting the Names** (<65%):');
    expect(W).toContain('**Phase 3 — She Wants More** (<30%; her Regen and Shield end and cannot be reapplied):');
    expect(W).toContain(`*Transition (<65%):* "${m.phases[1]?.line}"`);
    expect(W).toContain(`*Transition (<30%):* "${m.phases[2]?.line}"`);
    expect(m.phases[0]?.line).toBeUndefined();
    for (const p of m.phases) expect([p.id, p.skipWhen]).toEqual([p.id, undefined]);
    expect(m.phases.every((p) => p.adds.length === 0)).toBe(true);
  });
});

// ---- The NPCs ----------------------------------------------------------------------------------------------------------------

describe('the NPCs vs WORLD §4', () => {
  const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
  const rows = Object.fromEntries(tableRows(S4).filter((c) => unquote(c[0] ?? '').startsWith('npc_')).map((c) => [unquote(c[0] ?? ''), c]));
  const home = (c: string[]): string => (c[3] ?? '').replace(/\*\*stall: /, '').replace(/\*\*/g, '');
  const IDS = ['npc_mireya', 'npc_elder_wen', 'npc_elder_tam', 'npc_old_fennick'];

  test('exactly the NPCs whose home is in the region, in WORLD’s order: Mireya, Elder Wen, Elder Tam and Old Fennick', () => {
    const homes = Object.values(rows).filter((c) => here.has(/^loc_[a-z_]+/.exec(home(c))?.[0] ?? ''));
    expect(npcs.map((n) => n.id).sort()).toEqual(homes.map((c) => unquote(c[0] ?? '')).sort());
    expect(npcs.map((n) => n.id)).toEqual(IDS);
    expect(npcs.map((n) => n.homeLocationId)).toEqual([LN, BP, LN, LN]);
  });

  test('names, factions, home locations and sample lines as WORLD’s row (markdown emphasis dropped); descriptions are the row’s cell made into sentences; no age, no legacy name', () => {
    for (const n of npcs) {
      const row = rows[n.id];
      expect(row, n.id).toBeDefined();
      expect([n.id, n.name, row?.[2], n.factionId]).toEqual([n.id, row?.[1], '— (Glowfen folk)', 'neutral']);
      expect([n.id, home(row ?? []).startsWith(n.homeLocationId)]).toEqual([n.id, true]);
      expect(n.barks).toHaveLength(2);
      for (const b of n.barks ?? []) expect([n.id, (row?.[6] ?? '').replace(/\*/g, '').includes(`"${b.text}"`)]).toEqual([n.id, true]);
      expect([n.id, 'legacyName' in n, 'age' in n]).toEqual([n.id, false, false]); // new characters; BIBLE gives Mireya only "~30s"
    }
    expect(rows['npc_mireya']?.[6]).toContain('"Sit *down*.');
    expect(rows['npc_mireya']?.[5]).toBe('Herbalist with light under the skin of her own wrists.');
    expect(byId(npcs, 'npc_mireya').description).toBe('A herbalist with light under the skin of her own wrists.');
    expect(rows['npc_elder_wen']?.[5]).toBe('Glowfen elder at the reed mat by the Pool. Would keep the glow, whatever it costs.');
    expect(byId(npcs, 'npc_elder_wen').description).toBe('The Glowfen elder at the reed mat by the Pool. She would keep the glow, whatever it costs.');
    expect(rows['npc_elder_tam']?.[5]).toBe('Eldest of Lanternreed, so far into the glow that the tree answers for him.');
    expect(byId(npcs, 'npc_elder_tam').description).toBe('The eldest of Lanternreed, so far into the glow that the tree answers for him.');
    expect(rows['npc_old_fennick']?.[5]).toBe('Stall-keeper on the stilts; trades moss for Nomad salt through the Reedmarch baskets.');
    expect(byId(npcs, 'npc_old_fennick').description).toBe('The stall-keeper on the stilts, who trades moss for Nomad salt through the Reedmarch baskets.');
  });

  test('roles and records: Mireya is the companion anchor (the handshake with the companion record) and a quest giver, Wen a quest giver who cleanses, Tam lore, Fennick the merchant', () => {
    expect(npcs.map((n) => [n.id, n.roles])).toEqual([
      ['npc_mireya', ['companion', 'questgiver']],
      ['npc_elder_wen', ['questgiver', 'healer']],
      ['npc_elder_tam', ['lore']],
      ['npc_old_fennick', ['merchant']],
    ]);
    expect(byId(npcs, 'npc_mireya').companionId).toBe('mireya');
    for (const n of npcs) if (n.id !== 'npc_mireya') expect([n.id, n.companionId]).toEqual([n.id, undefined]);
    expect(byId(npcs, 'npc_old_fennick').merchantId).toBe('npc_old_fennick');
    for (const n of npcs) if (n.id !== 'npc_old_fennick') expect([n.id, n.merchantId]).toEqual([n.id, undefined]);
    expect(loc(LN).merchantId).toBe('npc_old_fennick');
    expect(rows['npc_mireya']?.[4]).toContain('companion anchor `mireya`; quest giver (Mireya arc)');
    expect(rows['npc_elder_wen']?.[4]).toContain('quest giver (q_the_drowned_lantern); cleanses Corruption');
    expect(rows['npc_elder_tam']?.[4]).toContain('flavor');
    expect(rows['npc_old_fennick']?.[4]).toContain('merchant');
  });
});

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder in WORLD §2 order (after the Veil); the region tables are in `contentTables` and the index', () => {
    const folders = REGION_FOLDERS.map((f) => f.region.id);
    expect(folders).toContain(REGION);
    expect(folders.indexOf('region_veil')).toBeLessThan(folders.indexOf(REGION));
    expect(folders.indexOf('region_ashen_steppe')).toBeLessThan(folders.indexOf(REGION));
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('The Glowfen');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.name).toBe(c.name);
    for (const n of npcs) expect(pack.npcs[n.id]?.name).toBe(n.name);
    expect(items).toEqual([]); // the items tables are U49/U50's; this region owns none
  });

  test('validates with 0 errors; nothing real is reported about the region; pending references name only tables still being authored', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const about = report.warnings.filter((w) => mine.has(w.id) || locations.some((l) => w.message.includes(` ${l.id}`)));
    const real = about.filter((w) => !w.message.startsWith('pending — content not yet authored'));
    // the Lantern Matron (L14: band top 12 + 2) at the Hall (band 12) and every wandering light inside two levels of its node: no warning
    expect(real.map((w) => `${w.rule} ${w.id} ${w.path}`)).toEqual([]);
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

  test('this region’s pending references name only ids WORLD/STORY/DESIGN spell (items, Echoes, the merchant record, the companion record, codex entries); the Glowlands’ and the Steppe’s creatures and the Glowlands resolve', () => {
    const { report } = parseContentPack(contentTables);
    const targets = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    // Later units resolve these one by one (items U49/U50, Echoes, the merchants and companions, the codex): the list may only shrink
    const known = new Set([
      'item_antidote_root', 'item_stillwater_phial', 'item_barrow_light_vial', 'item_lanternwood_bow', 'item_mireyas_lantern', 'item_lantern_moth_brooch',
      'mat_glow_gland', 'mat_ley_resin',
      'echo_glowlands_leak', 'echo_seven_wayfinders',
      'npc_old_fennick', // the merchant record (WORLD §9)
      'mireya', // the companion record (the Hall's bypass and the Mangrove read it; shared/companions.ts has it, the table is still being authored)
      'codex_region_glowfen', 'codex_creatures_green',
    ]);
    expect([...targets].filter((t) => !known.has(t)).sort()).toEqual([]);
    for (const t of [VG, MIRELING, TOAD, SPORE, STALKER, 'item_glow_moss']) expect([t, targets.has(t)]).toEqual([t, false]);
    // every one is an id the documents spell
    const docs = `${WORLD}\n${STORY}\n${DESIGN}`;
    for (const id of targets) expect([id, docs.includes(id)]).toEqual([id, true]);
  });
});

// ---- The engine on the real pack ------------------------------------------------------------------------------------------------

describe('the region in the engine (real pack, seeded)', () => {
  test('the way in and out: the Causeway opens on the Glowlands; the Gullet’s haul west costs two watches, every other step one', () => {
    expect(movesFrom(LC)).toEqual([VG, LN, LS].sort());
    expect(movesFrom(LN)).toEqual([LC, EM, BP].sort());
    expect(movesFrom(LS)).toEqual([LC, EM].sort());
    expect(movesFrom(EM)).toEqual([LS, LN, FB, PG].sort());
    expect(movesFrom(BP)).toEqual([LN, FB].sort());
    expect(movesFrom(FB)).toEqual([BP, EM, MH].sort());
    expect(movesFrom(PG)).toEqual([EM, MH].sort());
    expect(movesFrom(MH)).toEqual([PG, FB].sort());
    const haul = arrive(PG, EM, { seed: 'u47g-haul' });
    expect(haul.state.clock.ticks - haul.before).toBe(2);
    const down = arrive(EM, PG, { seed: 'u47g-down' });
    expect(down.state.clock.ticks - down.before).toBe(1);
  });

  test('the Causeway: about half the first visits meet two Lantern Toads (400 seeds), a fleeable scatter; a return visit rolls the pool (about a fifth) and never the barrow light', () => {
    const N = 400;
    const first = tally(N, (i) => arrive(VG, LC, { seed: `u47g-${i}` }).state);
    expect([...first.keys()]).toEqual(['enc_causeway_toads']);
    expect((first.get('enc_causeway_toads') ?? 0) / N).toBeGreaterThan(0.42);
    expect((first.get('enc_causeway_toads') ?? 0) / N).toBeLessThan(0.58);
    const toads = firstFight(VG, LC, 'u47g-find');
    expect(toads.combat).toMatchObject({ encounterId: 'enc_causeway_toads', canFlee: true, onFlee: 'scatter' });
    expect(toads.combat?.enemies.map((e) => e.refId)).toEqual([TOAD, TOAD]);
    for (const watch of [1, 2] as const) {
      const ret = tally(N, (i) => back(LN, LC, i, { watch }));
      expect([...ret.keys()]).toEqual(['wandering']);
      expect((ret.get('wandering') ?? 0) / N).toBeGreaterThan(0.12);
      expect((ret.get('wandering') ?? 0) / N).toBeLessThan(0.28);
    }
  });

  test('the Shallows: about 70 % Spore Drifts ×2 on the first visit; on a return the pool brings the barrow light at dusk and night only (D-098: about 2 %), never by day', () => {
    const N = 600;
    const first = tally(N, (i) => arrive(LC, LS, { seed: `u47g-${i}` }).state);
    expect([...first.keys()]).toEqual(['enc_shallows_spore_drifts']);
    expect((first.get('enc_shallows_spore_drifts') ?? 0) / N).toBeGreaterThan(0.62);
    expect((first.get('enc_shallows_spore_drifts') ?? 0) / N).toBeLessThan(0.78);
    const M = 1500;
    const lights = (watch: 0 | 2) => {
      let fights = 0;
      let mirelings = 0;
      for (let i = 0; i < M; i++) {
        const s = back(LC, LS, i, { watch }); // the step takes the clock one watch on: day, or night
        if (s.combat?.encounterId === 'enc_shallows_mirelings') mirelings += 1;
        if (s.combat?.encounterId === 'wandering' && s.combat.enemies.some((e) => e.refId === BARROW)) fights += 1;
      }
      return { light: fights / M, mirelings: mirelings / M };
    };
    const night = lights(2);
    expect(night.light).toBeGreaterThan(0.005);
    expect(night.light).toBeLessThan(0.04);
    expect(night.mirelings).toBeGreaterThan(0.24);
    expect(night.mirelings).toBeLessThan(0.36);
    expect(lights(0).light).toBe(0);
  });

  test('the Mangrove: a Reed Stalker with a Mireling on the first visit (about 60 %); a Barrow-Light on a return (about a fifth) and the pool behind it', () => {
    const N = 400;
    const first = tally(N, (i) => arrive(LN, EM, { seed: `u47g-${i}` }).state);
    expect([...first.keys()]).toEqual(['enc_mangrove_stalker_mireling']);
    expect((first.get('enc_mangrove_stalker_mireling') ?? 0) / N).toBeGreaterThan(0.5);
    expect((first.get('enc_mangrove_stalker_mireling') ?? 0) / N).toBeLessThan(0.7);
    expect(firstFight(LN, EM, 'u47g-m').combat?.enemies.map((e) => e.refId)).toEqual([STALKER, MIRELING]);
    const ret = tally(N, (i) => back(LN, EM, i, { watch: 0 }));
    expect([...ret.keys()].sort()).toEqual(['enc_mangrove_barrow_light', 'wandering']);
    expect((ret.get('enc_mangrove_barrow_light') ?? 0) / N).toBeGreaterThan(0.14);
    expect((ret.get('enc_mangrove_barrow_light') ?? 0) / N).toBeLessThan(0.27);
  });

  test('the Mangrove answers: with Mireya in the party the tree’s answer grants `echo_glowlands_leak` (once); without her it only speaks', () => {
    // the Echo has no record yet, so the grant is read off the loop's list; the arrival may be a fight, but its events fire either way
    const withHer = arrive(LS, EM, { mireya: true, seed: 'u47g-ans' }).state;
    const fired = withHer.world.locationStates[EM]?.eventsFired ?? [];
    expect(fired).toContain('ev_mangrove_answer');
    expect(fired).not.toContain('ev_mangrove_answer_plain');
    expect(withHer.echoesThisLoop).toContain('echo_glowlands_leak');
    const alone = arrive(LS, EM, { seed: 'u47g-ans' }).state;
    expect(alone.world.locationStates[EM]?.eventsFired).toContain('ev_mangrove_answer_plain');
    expect(alone.world.locationStates[EM]?.eventsFired).not.toContain('ev_mangrove_answer');
    expect(alone.echoesThisLoop).not.toContain('echo_glowlands_leak');
  });

  test('the Barrows: a Barrow-Light at 100 % at dusk and night and about 40 % by day on the first visit; about 30 % on a return, no pool', () => {
    const N = 400;
    // the step takes the clock one watch on: stand at dusk (watch 1) to arrive at dusk (2), at day (watch 0) to arrive at day (1)
    for (const watch of [1, 2] as const) {
      const t = tally(N, (i) => arrive(BP, FB, { seed: `u47g-${i}`, watch }).state);
      expect([...t.entries()]).toEqual([['enc_barrows_light_night', N]]);
    }
    const day = tally(N, (i) => arrive(BP, FB, { seed: `u47g-${i}`, watch: 0 }).state);
    expect([...day.keys()]).toEqual(['enc_barrows_light_day']);
    expect((day.get('enc_barrows_light_day') ?? 0) / N).toBeGreaterThan(0.32);
    expect((day.get('enc_barrows_light_day') ?? 0) / N).toBeLessThan(0.48);
    const ret = tally(N, (i) => back(BP, FB, i, { watch: 2 }));
    expect([...ret.keys()]).toEqual(['enc_barrows_light_return']);
    expect((ret.get('enc_barrows_light_return') ?? 0) / N).toBeGreaterThan(0.22);
    expect((ret.get('enc_barrows_light_return') ?? 0) / N).toBeLessThan(0.38);
    // the reading in the header: a 100 % group stands until cleared, so a first visit by day that rolled nothing leaves it for a later night
    const s = stateAt(BP, { watch: 2, seed: 'u47g-late' });
    s.world.locationStates[FB] = {
      visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: ['enc_barrows_light_day'], encounterClearedDay: {}, eventsFired: [], flags: {}, unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
    };
    expect(step(s, { type: 'move', to: FB }, pack, profileOf()).state.combat?.encounterId).toBe('enc_barrows_light_night');
  });

  test('the Barrows speak names from Loop 3: `echo_seven_wayfinders` is granted then, not before', () => {
    const l2 = arrive(BP, FB, { loop: 2, watch: 0, seed: 'u47g-n2' }).state;
    expect(l2.world.locationStates[FB]?.eventsFired ?? []).not.toContain('ev_barrows_names');
    expect(l2.echoesThisLoop).not.toContain('echo_seven_wayfinders');
    const l3 = arrive(BP, FB, { loop: 3, watch: 0, seed: 'u47g-n2' }).state;
    expect(l3.world.locationStates[FB]?.eventsFired).toContain('ev_barrows_names');
    expect(l3.echoesThisLoop).toContain('echo_seven_wayfinders');
  });

  test('the Gullet: three Mirelings at 100 % on the first visit; on a return, two Reed Stalkers 40 % of the time and no pool', () => {
    const s = arrive(EM, PG, { seed: 'u47g-g' }).state;
    expect(s.combat).toMatchObject({ encounterId: 'enc_gullet_mirelings', canFlee: true, onFlee: 'scatter' });
    expect(s.combat?.enemies.map((e) => e.refId)).toEqual([MIRELING, MIRELING, MIRELING]);
    const N = 400;
    const ret = tally(N, (i) => back(EM, PG, i));
    expect([...ret.keys()]).toEqual(['enc_gullet_stalkers']);
    expect((ret.get('enc_gullet_stalkers') ?? 0) / N).toBeGreaterThan(0.32);
    expect((ret.get('enc_gullet_stalkers') ?? 0) / N).toBeLessThan(0.48);
  });

  test('the Hall: a held boss fight, a first arrival into Phase 1; with Mireya active and her lantern carried Sulis is lulled and the fight skipped; each half alone is not enough', () => {
    const fight = arrive(FB, MH, { seed: 'u47g-h' }).state;
    expect(fight.mode).toBe('combat');
    expect(fight.combat).toMatchObject({ encounterId: 'enc_hall_matron', canFlee: false, onFlee: 'hold' });
    expect(fight.combat?.enemies.map((e) => [e.refId, e.phase])).toEqual([[MATRON, 0]]);
    // read as conditions (the lantern has no record yet, so the engine cannot carry it)
    const lulled = loc(MH).encounters[0]?.optionalWhen as Condition;
    expect(holds(lulled, MH, { mireya: true, carrying: ['item_mireyas_lantern'] })).toBe(true);
    expect(holds(lulled, MH, { mireya: true })).toBe(false);
    expect(holds(lulled, MH, { carrying: ['item_mireyas_lantern'] })).toBe(false);
    expect(holds(lulled, MH, {})).toBe(false);
    // the bypass pays the Matron's loot here, so the fight and the bypass never both pay
    const item = (id: string): Condition => loc(MH).items.find((i) => i.itemId === id)?.when as Condition;
    expect(holds(item('item_lantern_moth_brooch'), MH, { mireya: true, carrying: ['item_mireyas_lantern'] })).toBe(true);
    expect(holds(item('item_lantern_moth_brooch'), MH, {})).toBe(false);
    expect(holds(item('item_mireyas_lantern'), MH, { mireya: true })).toBe(true);
    expect(holds(item('item_mireyas_lantern'), MH, {})).toBe(false);
  });

  test('the Mangrove’s hollow holds the lanternwood bow in Loop 2+ for a party with Mireya, and not otherwise', () => {
    const bow = loc(EM).items.find((i) => i.itemId === 'item_lanternwood_bow')?.when as Condition;
    expect([[1, false], [2, false], [1, true], [2, true]].map(([loop, mireya]) => holds(bow, EM, { loop: loop as number, mireya: mireya as boolean }))).toEqual([false, false, false, true]);
  });

  test('Elder Wen’s cleansing at the Breathing Pool: a rest while Marked (Corruption ≥ 6) with three Glow Moss, or free once the Heartstone is stabilized; it sets Corruption 0 and `flag_corruption_cleansed`', () => {
    // no rest without the cleansing on offer
    expect(restsAt(BP)).toEqual([]);
    expect(restsAt(BP, { corruption: 5, moss: 3 })).toEqual([]);
    expect(restsAt(BP, { corruption: 6 })).toEqual([]);
    expect(restsAt(BP, { corruption: 6, moss: 2 })).toEqual([]);
    expect(restsAt(BP, { corruption: 6, moss: 3 })).toContain('full');
    expect(restsAt(BP, { corruption: 6, flags: { flag_heartstone_stabilized: true } })).toContain('full');
    expect(restsAt(BP, { corruption: 5, flags: { flag_heartstone_stabilized: true } })).toEqual([]);

    // paid: the moss goes, Corruption goes
    const paid = stateAt(BP, { corruption: 6, moss: 4 });
    const after = step(paid, { type: 'rest', kind: 'full' }, pack, profileOf()).state;
    expect(after.player.corruption).toBe(0);
    expect(after.flags['flag_corruption_cleansed']).toBe(true);
    expect(after.player.inventory.filter((i) => i.itemId === 'item_glow_moss').reduce((n, i) => n + i.qty, 0)).toBe(1);
    expect(after.world.locationStates[BP]?.eventsFired).toContain('ev_pool_cleanse');
    expect(after.world.locationStates[BP]?.eventsFired).not.toContain('ev_pool_cleanse_free');
    // cleansed: nothing left to offer
    expect(legalActions(after, pack, profileOf()).filter((a) => a.type === 'rest')).toEqual([]);

    // free once the Heartstone is stabilized: the moss stays
    const free = stateAt(BP, { corruption: 6, moss: 3, flags: { flag_heartstone_stabilized: true } });
    const freed = step(free, { type: 'rest', kind: 'full' }, pack, profileOf()).state;
    expect(freed.player.corruption).toBe(0);
    expect(freed.flags['flag_corruption_cleansed']).toBe(true);
    expect(freed.player.inventory.filter((i) => i.itemId === 'item_glow_moss').reduce((n, i) => n + i.qty, 0)).toBe(3);
    expect(freed.world.locationStates[BP]?.eventsFired).toContain('ev_pool_cleanse_free');
    expect(freed.world.locationStates[BP]?.eventsFired).not.toContain('ev_pool_cleanse');
  });

  test('Lanternreed’s inn: a rest on offer to anyone; a settlement on the first and every return visit', () => {
    expect(restsAt(LN)).toContain('short');
    for (let i = 0; i < 100; i++) expect(arrive(LC, LN, { seed: `u47g-${i}` }).state.mode).toBe('explore');
    for (let i = 0; i < 100; i++) expect(back(LC, LN, i).mode).toBe('explore');
    // the Pool names no pool and no fight: first and return visits are quiet
    for (let i = 0; i < 100; i++) expect(arrive(LN, BP, { seed: `u47g-${i}` }).state.mode).toBe('explore');
    for (let i = 0; i < 100; i++) expect(back(LN, BP, i).mode).toBe('explore');
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U47 reply -----------------------------------------

describe('authored words outside the documents are few and short; coined ids are the listed ones', () => {
  test('encounter intros are ≤ 30 words, every encounter has one; there is no locked-exit line (no gate)', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro));
    expect(intros).toHaveLength(11); // D-098 retired the two pool-share groups
    for (const t of intros) expect([t, t !== undefined && words(t) <= 30]).toEqual([t, true]);
    expect(parsedLocations.flatMap((l) => l.exits.map((e) => e.lockedText)).filter(Boolean)).toEqual([]);
  });

  test('ids this unit coined (WORLD/STORY have none for them): encounter ids, the two plain events, the Matron’s phase ids', () => {
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.id))).toEqual([
      'enc_causeway_toads',
      'enc_shallows_spore_drifts', 'enc_shallows_mirelings',
      'enc_mangrove_stalker_mireling', 'enc_mangrove_barrow_light',
      'enc_barrows_light_night', 'enc_barrows_light_day', 'enc_barrows_light_return',
      'enc_gullet_mirelings', 'enc_gullet_stalkers',
      'enc_hall_matron',
    ]);
    const wordedEvents = new Set(Object.values(WL).flatMap((w) => Object.keys(w.events)));
    expect(parsedLocations.flatMap((l) => l.events.map((e) => e.id)).filter((id) => !wordedEvents.has(id))).toEqual(['ev_mangrove_answer_plain', 'ev_pool_cleanse_free']);
    expect(cr(MATRON).phases.map((p) => p.id)).toEqual(['matron_lullaby', 'matron_counting_the_names', 'matron_she_wants_more']);
    // every move id is WORLD's: the creatures use WORLD's intent ids only
    for (const c of parsedCreatures) for (const id of Object.keys(c.moves)) expect([c.id, id, WORLD.includes(`\`${id}\``)]).toEqual([c.id, id, true]);
    expect(ids(JSON.stringify(locations), 'ambient')).toEqual([]);
  });
});
