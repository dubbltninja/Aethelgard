// U44: The Voidscar — checked against the documents at test time, U42's pattern (regions/silverwood_ruins.test.ts): WORLD §2.3,
// §3.3, §4, §6, §10.1, §10.3, §11.1–11.3, §12.1; DESIGN §6.5, §17.1, §18.2; STORY §14; PLAN Appendix A. The legacy text is
// checked against the Python sources here and in legacy.test.ts. Patterns are walked turn by turn by the engine
// (`generateIntent`), so every WORLD cadence word is held to what the game does. Where a record departs from the letter of WORLD
// (a reading the schema or the engine forces), the test pins the departure so a later edit cannot move it silently.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures as folderCreatures } from '@content/regions/voidscar/creatures';
import { items } from '@content/regions/voidscar/items';
import { locations } from '@content/regions/voidscar/locations';
import { npcs } from '@content/regions/voidscar/npcs';
import { region } from '@content/regions/voidscar/region';
import { companions } from '@content/shared/companions';
import { validateContent } from '@content/validate';
import { beginCombat, evaluate, generateIntent, legalActions, step, type CombatState, type Combatant, type EncounterSpec, type GameState } from '@engine/index';
import type { Condition } from '@schema/condition';
import { CreatureSchema, walkSteps, type Creature, type Step } from '@schema/creature';
import { LocationSchema, type Location } from '@schema/location';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { main as validateCli } from '../../../../tools/validate-content';
import { PLAN, WORLD, appendixLegacyLocations, section, tableRows, unquote, worldCreature, worldCreatureTable, worldEdges, worldLocations, worldNodes } from './worldDoc';

// U34e (D-087): WORLD §10.2's anomaly variants live in this folder too; WORLD §6's checks below are on the
// others (tests/unit/engine/u34e/anomalies.test.ts checks the variants).
const creatures = folderCreatures.filter((c) => !c.id.startsWith('cr_anomaly_'));

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');
const LEGACY_PY = fs.readFileSync(path.join(ROOT, 'legacy/echoes_of_aethelgard.py'), 'utf8');

const REGION = 'region_voidscar';
const CHASM = 'loc_chasm_of_whispers';
const HOLLOW = 'loc_voidscar_hollow';
const PLAZA = 'loc_silverwood_plaza';
const WR = 'loc_whispering_ruins';
const STALKER = 'cr_void_touched_stalker';
const SENTRY = 'cr_veil_sentry';

const S33 = section(WORLD, '### 3.3 The Voidscar', '### 3.4');
const WL = Object.fromEntries(worldLocations(S33).map((l) => [l.id, l]));
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
/**
 * WORLD's condition notation (`{quest:"q_x",stage:"accepted"}`, unquoted keys) as the schema's data: `{item:"x"}` is
 * `{item:{id:"x"}}`, and `{quest:"q",stage:"accepted"}` is `{quest:{id:"q"}}` ("accepted" = in the journal, accepted or later).
 */
function worldCondition(text: string): Condition {
  const json = text.replace(/([{,])([a-zA-Z_]+):/g, '$1"$2":');
  const fix = (c: unknown): unknown => {
    if (Array.isArray(c)) return c.map(fix);
    if (typeof c !== 'object' || c === null) return c;
    const o = c as Record<string, unknown>;
    if (typeof o['quest'] === 'string') return { quest: { id: o['quest'], ...(o['stage'] === 'accepted' || o['stage'] === undefined ? {} : { status: o['stage'] }) } };
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'item' && typeof v === 'string' ? { id: v } : fix(v)]));
  };
  return fix(JSON.parse(json)) as Condition;
}

// ---- Engine helpers -----------------------------------------------------------------------------------------------------------

interface At {
  seed?: string;
  loop?: number;
  flags?: Record<string, boolean>;
  /** Quests in the journal (the pack has no quest records yet, so they are set directly). */
  quests?: string[];
  /** Echoes granted this loop (the pack has no echo records yet, so they are set directly). */
  echoes?: string[];
  /** The Weavers' standing. */
  weavers?: number;
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
      ...(o.weavers === undefined ? {} : { reputation: { weavers: o.weavers } }),
      patch: (s) => {
        for (const id of o.quests ?? []) s.quests[id] = { status: 'active', stage: 'u44', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] };
        for (const id of o.echoes ?? []) s.echoesThisLoop.push(id);
        for (const [id, st] of Object.entries(o.stood ?? {})) s.world.locationStates[id] = locationState(st);
      },
    },
    { content: pack },
  );
}
const profileOf = (o: At = {}) => freshProfile({ loopCounter: o.loop ?? 1 });
const holds = (cond: Condition, o: At = {}): boolean => evaluate(cond, stateAt(CHASM, o), profileOf(o), pack);
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

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_voidscar vs WORLD §2.3, §10.1 and DESIGN §6.5, §17.1, §18.2', () => {
  const S23 = section(WORLD, '### 2.3 `region_voidscar`', '### 2.4');

  test('id, name, legacy (Appendix A.1), the Weavers, the band, WORLD’s theme text, order, codex entry', () => {
    expect(region.id).toBe(REGION);
    expect(S23).toContain(`### 2.3 \`${REGION}\` — ${region.name}`);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | yes |`);
    expect(region.legacy).toBe(true);
    expect(S23).toContain('| Factions | Shadow Weavers (Nyx at the Chasm;');
    expect(region.factionId).toBe('weavers');
    expect(S23).toContain('| Level band | 5–8 |');
    expect(region.levelBand).toEqual({ min: 5, max: 8 });
    expect(tableRows(section(DESIGN, '### 6.5', '### 6.6')).find((c) => c[0] === 'The Voidscar')?.slice(1, 3)).toEqual([`\`${REGION}\``, '5–8']);
    expect(flat(S23)).toContain(`**Theme.** ${region.description}`);
    expect(region.order).toBe(3);
    expect(region.codexId).toBe('codex_region_voidscar');
    expect(STORY).toContain('| `codex_region_voidscar` | The Voidscar |');
  });

  test('the two locations WORLD lists, in WORLD’s order, all in the region', () => {
    const listed = /\| Locations \(2\) \| ([^|]+) \|/.exec(S23)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual([CHASM, HOLLOW]);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of locations) expect(l.regionId).toBe(REGION);
  });

  test('the pool is WORLD §10.1’s pool_voidscar: the Stalker alone; the Weavers-Wary share (sentry 40 · stalker 60) is location encounters', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_voidscar');
    expect(row?.[1]).toBe('cr_void_touched_stalker 100');
    expect(row?.[2]).toBe('Weavers ≤ Wary: cr_veil_sentry 40 · stalker 60');
    expect(region.wanderingPool).toEqual([{ creatureId: STALKER, weight: 100 }]);
    expect(region.returnEncounterChance).toBe(0.2);
    // the Hollow: the sentry's 40 % of the pool's 20 % return rolls, a location encounter ahead of the pool roll
    const sentry = byId(loc(HOLLOW).encounters, 'enc_hollow_pool_sentry');
    expect([sentry.groups, sentry.respawn, sentry.once, sentry.when]).toEqual([[{ creatureId: SENTRY, count: 1 }], 'on_return', false, { rep: { faction: 'weavers', max: -10 } }]);
    expect(sentry.chance).toBeCloseTo(0.4 * region.returnEncounterChance, 12);
    // the Chasm: "pool 20% only if Weavers ≤ Wary": no pool roll at all (`safe`); the whole Wary pool is two gated encounters
    expect(loc(CHASM).safe).toBe(true);
    const [s, st] = [byId(loc(CHASM).encounters, 'enc_chasm_sentry'), byId(loc(CHASM).encounters, 'enc_chasm_stalker')];
    expect(s.chance).toBeCloseTo(0.4 * region.returnEncounterChance, 12);
    // the second group's roll is p2 / (1 − p1): its share of the whole is the pool's 60 % of the 20 %
    expect(st.chance * (1 - s.chance)).toBeCloseTo(0.6 * region.returnEncounterChance, 12);
    for (const e of [s, st]) expect([e.id, e.respawn, e.once, e.when]).toEqual([e.id, 'on_return', false, { rep: { faction: 'weavers', max: -10 } }]);
    // only fodder of this unit, the Stalker inside the band ± 2 (validator rule 11)
    for (const e of region.wanderingPool) expect([cr(e.creatureId).role, cr(e.creatureId).level >= region.levelBand.min - 2 && cr(e.creatureId).level <= region.levelBand.max + 2]).toEqual(['fodder', true]);
  });

  test('palette: DESIGN §17.1’s Voidscar row (sky top, sky bottom, mid, accent); the ambient preset', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'The Voidscar');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).some((c) => c[0] === 'The Voidscar')).toBe(true);
    expect(region.ambient).toBe('ambient_voidscar');
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the two locations vs WORLD §3.3 blocks', () => {
  test('names, bands, coordinates and region', () => {
    for (const l of locations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.levelBand, l.map]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map]);
    }
    // the Chasm sits below the region's band (WORLD: 4–5 in a 5–8 region): the Veil Sentry's rule-11 warnings are WORLD's
    expect([loc(CHASM).levelBand, loc(HOLLOW).levelBand]).toEqual([{ min: 4, max: 5 }, { min: 5, max: 7 }]);
  });

  test('descriptions: the legacy text with WORLD’s `+` sentence appended, character for character', () => {
    for (const l of locations) expect([l.id, l.description]).toEqual([l.id, WL[l.id]?.description]);
  });

  test('exits: every WORLD exit in order, gated ones with a `when`; the Chasm’s lock line is the legacy one', () => {
    for (const l of parsedLocations) {
      const got = l.exits.map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.exits]);
    }
    const line = 'I should talk with Nyx before going this way.';
    expect(loc(CHASM).exits.find((e) => e.to === HOLLOW)?.lockedText).toBe(line);
    expect(LEGACY_PY).toContain(`print("${line}")`);
  });

  test('rest points and merchants as WORLD says: a cold camp on the lip, none in the Hollow', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, w?.rest, w?.merchant]);
    }
    expect(loc(CHASM).rest?.kind).toBe('camp');
    expect(WL[CHASM]?.block).toContain('(a cold camp on the lip; Nyx permits it)');
  });

  test('items: none at the lip; one Void Shard lies loose in the Hollow (first visit)', () => {
    for (const l of parsedLocations) expect([l.id, l.items.map((i) => i.itemId).sort()]).toEqual([l.id, [...(WL[l.id]?.itemIds ?? [])].sort()]);
    expect(loc(CHASM).items).toEqual([]);
    expect(loc(HOLLOW).items).toEqual([{ itemId: 'item_void_shard', count: 1, hidden: false, once: true, chance: 1, onTake: [] }]); // U34d's defaults
  });

  test('creatures: the Hollow’s are WORLD’s; the Chasm’s Encounters line names none, its Wary pool is the Sentry and the Stalker', () => {
    const got = (id: string): string[] => [...new Set(loc(id).encounters.flatMap((e) => e.groups.map((g) => g.creatureId)))].sort();
    expect(got(HOLLOW)).toEqual([...(WL[HOLLOW]?.creatureIds ?? [])].sort());
    expect(WL[CHASM]?.creatureIds).toEqual([]);
    expect(got(CHASM)).toEqual([SENTRY, STALKER].sort());
    expect(WL[CHASM]?.block).toContain('**Encounters:** none at the lip. return: pool 20% only if Weavers ≤ Wary (Nyx withdraws her protection).');
  });

  test('the Hollow: group A ×2 then group B ×1 (the legacy three), both 100 %, `regroup` (D-144: the shards come back at dawn); in Loop 2+ with the Weavers Wary a Veil Sentry joins B', () => {
    const enc = loc(HOLLOW).encounters;
    expect(WL[HOLLOW]?.block).toContain('first: group A cr_void_touched_stalker ×2 (100%), then group B cr_void_touched_stalker ×1 (100%) — the legacy three.');
    expect(WL[HOLLOW]?.block).toContain('Weavers Wary/Hostile, Loop 2+: cr_veil_sentry ×1 joins group B.');
    expect(enc.map((e) => e.id)).toEqual(['enc_hollow_stalkers_a', 'enc_hollow_group_b_sentry', 'enc_hollow_group_b', 'enc_hollow_stalker', 'enc_hollow_pool_sentry']);
    const a = byId(enc, 'enc_hollow_stalkers_a');
    expect([a.groups, a.chance, a.once, a.respawn, a.fleeable, a.onFlee, a.when]).toEqual([[{ creatureId: STALKER, count: 2 }], 1, true, 'never', true, 'regroup', undefined]);
    const joined = { all: [{ loop: { min: 2 } }, { rep: { faction: 'weavers', max: -10 } }] };
    const bs = byId(enc, 'enc_hollow_group_b_sentry');
    const b = byId(enc, 'enc_hollow_group_b');
    expect([bs.groups, bs.when]).toEqual([[{ creatureId: STALKER, count: 1 }, { creatureId: SENTRY, count: 1 }], joined]);
    expect([b.groups, b.when]).toEqual([[{ creatureId: STALKER, count: 1 }], { not: joined }]);
    for (const e of [bs, b]) expect([e.id, e.chance, e.once, e.respawn, e.fleeable, e.onFlee, e.onVictory]).toEqual([e.id, 1, true, 'never', true, 'regroup', [{ scatter: { location: HOLLOW } }]]);
    // WORLD §12.1 `ws_weavers_wary`: `{rep:{faction:"weavers",max:-10}}`, "VH: cr_veil_sentry joins group B (Loop 2+)"
    expect(tableRows(section(WORLD, '### 12.1', '### 12.2')).find((c) => unquote(c[0] ?? '') === 'ws_weavers_wary')?.[2]).toBe('`{rep:{faction:"weavers",max:-10}}`');
    // return: a Stalker (35 %), then the pool's 20 %
    expect(byId(enc, 'enc_hollow_stalker')).toMatchObject({ groups: [{ creatureId: STALKER, count: 1 }], chance: 0.35, respawn: 'on_return', once: false });
    expect(WL[HOLLOW]?.block).toContain('return: cr_void_touched_stalker ×1 (35%) or pool 20%.');
    // WORLD §10.4: "two groups; R10-1 rules the Stalkers `scatter`"
    expect(section(WORLD, '### 10.4', '### 10.5')).toContain('VH (two groups; R10-1 rules the Stalkers `scatter`');
  });

  test('the legacy fight (Python: three Void-Touched Stalkers) is a 100 % once group of that creature, with no condition', () => {
    const a = byId(loc(HOLLOW).encounters, 'enc_hollow_stalkers_a');
    expect([a.groups[0]?.creatureId, a.chance, a.once, a.when]).toEqual([STALKER, 1, true, undefined]);
    expect(loc(HOLLOW).encounters[0]?.id).toBe('enc_hollow_stalkers_a');
  });

  test('events: every WORLD event, its text verbatim, legacy ids with the ev_ prefix, once; WORLD’s conditions', () => {
    // U57 hooked `q_lightless_stair`'s discovery on an interact at the curtain (tests/unit/content/quests/regional.test.ts pins it);
    // U59 `q_class_shadow_weaver`'s seam (tests/unit/content/quests/classes.test.ts)
    // U62b the bridge remembered (STORY §12 `echo_hollow_path`; tests/unit/content/echoHooks.test.ts)
    const U57_HOOKS = ['ev_hollow_curtain_stair', 'ev_hollow_feel_seam', 'ev_hollow_bridge_held'];
    for (const l of parsedLocations) {
      const got = Object.fromEntries(l.events.filter((e) => !U57_HOOKS.includes(e.id)).map((e) => [e.id, e.text]));
      const expected = Object.fromEntries(Object.entries(WL[l.id]?.events ?? {}).map(([id, text]) => [id.startsWith('ev_') ? id : `ev_${id}`, text]));
      expect([l.id, got]).toEqual([l.id, expected]);
      for (const e of l.events) if (!U57_HOOKS.includes(e.id)) expect([e.id, e.trigger, e.once]).toEqual([e.id, 'enter', true]);
    }
    const ev = (l: string, id: string) => byId(loc(l).events, id);
    // "once, Loop 2+, requires echo_nine_voices"
    expect(ev(CHASM, 'ev_chasm_name').when).toEqual({ all: [{ loop: { min: 2 } }, { echo: 'echo_nine_voices' }] });
    expect(WL[CHASM]?.block).toContain('— once, Loop 2+, requires `echo_nine_voices`.');
    expect(ev(CHASM, 'ev_chasm_hum').when).toBeUndefined();
    expect(ev(HOLLOW, 'ev_voidscar_thrum').when).toBeUndefined();
    expect(ev(HOLLOW, 'ev_hollow_curtain').when).toBeUndefined();
  });

  test('NPCs: Nyx at the Chasm, none in the Hollow', () => {
    for (const l of parsedLocations) expect([l.id, l.npcs]).toEqual([l.id, WL[l.id]?.npcIds]);
    expect(loc(CHASM).npcs).toEqual(['npc_nyx']);
    expect(loc(HOLLOW).npcs).toEqual([]);
  });

  test('art: WORLD’s horizons and the Voidscar scene; the exploited Heartstone brightens the Hollow (WORLD §2.3, §12.1)', () => {
    expect(parsedLocations.map((l) => [l.id, l.art.template, WL[l.id]?.horizon, l.art.horizon])).toEqual([
      [CHASM, 'void', 0.48, 0.48],
      [HOLLOW, 'void', 0.5, 0.5],
    ]);
    expect(loc(HOLLOW).art.variants).toEqual([{ when: { flag: 'flag_heartstone_exploited' }, patch: { particles: 'shards' } }]);
    expect(tableRows(section(WORLD, '### 12.1', '### 12.2')).find((c) => unquote(c[0] ?? '') === 'ws_heartstone_exploited')?.[1]).toContain('VH');
    // "No weather. Starlight visible even by day." (WORLD §2.3): night, as the Ruins' Depths read their dark
    expect(section(WORLD, '### 2.3', '### 2.4')).toContain('Starlight visible even by day');
    expect([loc(CHASM).art.timeOfDay, loc(HOLLOW).art.timeOfDay]).toEqual(['night', 'night']);
  });

  test('Appendix A: the two legacy ids carry their legacy names and region', () => {
    const appendix = appendixLegacyLocations();
    for (const l of locations) expect([l.id, l.legacyName, l.regionId]).toEqual([l.id, appendix[l.id]?.name, appendix[l.id]?.region]);
  });
});

// ---- Map data (WORLD §11) -------------------------------------------------------------------------------------------------------

describe('WORLD §11 map data', () => {
  test('§11.1 nodes: coordinates, band, rest, merchant; neither is temporally unstable', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable]);
      const rest = l.rest === undefined ? '—' : l.rest.when === undefined ? l.rest.kind : 'cond';
      expect([l.id, rest, l.merchantId ?? '—']).toEqual([l.id, n?.rest, n?.merchant]);
    }
  });

  test('§11.2 edges: every walk edge touching the region with its direction, cost and gate; reverse exits inside the region match', () => {
    const edges = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(edges.map((e) => `${e.from}>${e.to}`)).toEqual([`${PLAZA}>${CHASM}`, `${CHASM}>${HOLLOW}`, `${HOLLOW}>loc_veil_mouth`, `${HOLLOW}>loc_scar_shelf`]);
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

  test('§11.3 gates: the Chasm bridge and the Veil curtain carry WORLD’s conditions (the curtain also opens with q_lightless_stair, W12)', () => {
    const gates = Object.fromEntries(tableRows(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).map((c) => [unquote(c[0] ?? ''), unquote(c[2] ?? '')]));
    const exit = (from: string, to: string) => loc(from).exits.find((e) => e.to === to)?.when;
    expect(exit(CHASM, HOLLOW)).toEqual(worldCondition(gates['gate_chasm_bridge'] ?? ''));
    expect(exit(HOLLOW, 'loc_veil_mouth')).toEqual(worldCondition(gates['gate_veil_curtain'] ?? ''));
    expect(exit(HOLLOW, 'loc_scar_shelf')).toEqual(exit(HOLLOW, 'loc_veil_mouth'));
    // the Hollow block's own table lists only the rep/echo pair; §11.3 and the block's `q_lightless_stair` paragraph add the quest
    expect(WL[HOLLOW]?.block).toContain('`{any:[{rep:{faction:"weavers",min:20}},{echo:"echo_weaver_sign"}]}`');
    expect(WL[HOLLOW]?.block).toContain('while it is accepted the curtain opens (`gate_veil_curtain`)');
  });

  test('reachability: both are reachable from loc_whispering_ruins (Plaza → Chasm → Hollow, WORLD §3.13’s 4 watches) through the landed regions', () => {
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
    // Loop 1 terms: a quest gate is satisfiable (the journal), an Echo-only gate is closed
    const loop1 = reach((when) => JSON.stringify(when).includes('"quest"'));
    expect([CHASM, HOLLOW].map((id) => loop1.get(id))).toEqual([3, 4]); // WR → MP (1) → Plaza (2) → Chasm (3) → Hollow (4)
    const closed = reach(() => false);
    expect(closed.has(CHASM)).toBe(true); // "with no gate satisfied, 11 nodes are reachable (…CW…)": the Chasm is
    expect(closed.has(HOLLOW)).toBe(false); // the bridge is the first gate
    expect(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).toContain('11 nodes are\nreachable (WR, CA, DC, SL, SP, SA, MP, WY, IC, CW, DS)');
    expect(flat(WORLD)).toContain('| loc_voidscar_hollow | WR → Mistwood Path → Plaza → Chasm → Hollow (4) | `q_void_shards` accepted or `echo_hollow_path` |');
    // the validator agrees: nothing about these two is reported by rule 8, as a warning or as an error
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.warnings.filter((w) => w.rule === 'rule-08' && here.has(w.id))).toEqual([]);
    expect(validateContent(pack, { strict: false }).errors.filter((e) => e.rule === 'rule-08' && here.has(e.id))).toEqual([]);
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6', () => {
  test('exactly the creatures whose first region is the Voidscar (D-090)', () => {
    const first = Object.values(CREATURE_TABLE).filter((r) => /^Voidscar\b/.test(r.regions)).map((r) => r.id);
    expect(first.sort()).toEqual([SENTRY, STALKER].sort());
    expect(creatures.map((c) => c.id).sort()).toEqual(first.sort());
  });

  test('name, family, role, level and XP as WORLD’s table (the Sentry’s family is the Mortals, the Stalker’s the Hollowed)', () => {
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, row?.name, c.family, c.role, c.level, c.xp]).toEqual([c.id, c.name, c.id === SENTRY ? 'fam_mortal' : row?.family, row?.role, row?.level, row?.xp]);
    }
    expect(CREATURE_TABLE[SENTRY]?.family).toBe('Mortal');
    // XP follows DESIGN §6.2: fodder round(20 + 8L + 1.2L²)
    for (const c of creatures) expect([c.id, c.xp]).toEqual([c.id, Math.round(20 + 8 * c.level + 1.2 * c.level * c.level)]);
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
  });

  test('resistances and immunities as WORLD’s Resist line; the Stalker is breach-born and immune to Poison; the Sentry’s statuses work normally', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      const weak = Object.entries(c.resistances).filter(([, r]) => r === 'weak').map(([t]) => t).sort();
      const resist = Object.entries(c.resistances).filter(([, r]) => r === 'resist').map(([t]) => t).sort();
      expect([c.id, weak, resist]).toEqual([c.id, [...w.weak].sort(), [...w.resist].sort()]);
      expect([c.id, [...c.statusImmunities].sort()]).toEqual([c.id, w.immune.map((s) => `status_${s}`).sort()]);
    }
    expect(cr(STALKER).tags).toContain('breach_born');
    expect(cr(STALKER).statusImmunities).toEqual(['status_poison']);
    expect(cr(SENTRY).statusImmunities).toEqual([]);
    expect(bullet(block(SENTRY), 'Resist:')).toBe('resist void · statuses work normally');
  });

  test('moves: every WORLD intent id with its telegraph verbatim; every move reached by a pattern; telegraphs ≤ 12 words', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect(Object.keys(w.intents).length).toBeGreaterThan(0);
      expect([c.id, Object.keys(c.moves).sort()]).toEqual([c.id, Object.keys(w.intents).sort()]);
      for (const [id, line] of Object.entries(w.intents)) expect([c.id, id, c.moves[id]?.line]).toEqual([c.id, id, line]);
      const used = new Set<string>();
      walkSteps(c.pattern, [], (s: Step) => void ('move' in s && used.add(s.move)));
      expect([c.id, Object.keys(c.moves).filter((id) => !used.has(id))]).toEqual([c.id, []]);
      for (const m of Object.values(c.moves)) expect([c.id, m.line, words(m.line) <= 12]).toEqual([c.id, m.line, true]);
    }
  });

  test('moves carry WORLD’s numbers: the multiplier and stat, type, statuses and their chances, the area Choir, the withdrawal', () => {
    const m = (c: string, id: string) => cr(c).moves[id];
    const hit = (c: string, id: string) => [m(c, id)?.type, m(c, id)?.power?.coef, m(c, id)?.power?.stat];
    const rows = (c: string, id: string) => m(c, id)?.statuses.map((s) => [s.status.slice('status_'.length), s.chance, s.duration, s.target]);
    expect(rows(STALKER, 'stalker_circle')).toEqual([['phase', 1, 1, 'self']]);
    expect(m(STALKER, 'stalker_circle')?.power).toBeUndefined();
    expect(hit(STALKER, 'stalker_lunge')).toEqual(['physical', 1.1, 'atk']);
    expect(rows(STALKER, 'stalker_lunge')).toEqual([['bleed', 0.4, 3, 'target']]);
    expect(hit(STALKER, 'stalker_starbite')).toEqual(['void', 0.9, 'sp']);
    expect(rows(STALKER, 'stalker_starbite')).toEqual([['curse', 0.4, 3, 'target']]);
    expect(hit(STALKER, 'stalker_pounce')).toEqual(['physical', 1.5, 'atk']);
    expect(hit(SENTRY, 'sentry_count')).toEqual(['void', 0.6, 'sp']);
    expect(rows(SENTRY, 'sentry_count')).toEqual([['slow', 0.5, 2, 'target']]);
    expect(hit(SENTRY, 'sentry_thread_cut')).toEqual(['void', 1.1, 'sp']);
    expect(rows(SENTRY, 'sentry_thread_cut')).toEqual([['bleed', 0.4, 3, 'target']]);
    expect(rows(SENTRY, 'sentry_unsee')).toEqual([['phase', 1, 1, 'self']]);
    expect(hit(SENTRY, 'sentry_call_the_choir')).toEqual(['void', 0.4, 'sp']);
    expect(rows(SENTRY, 'sentry_call_the_choir')).toEqual([['curse', 0.6, 3, 'target']]);
    expect(m(SENTRY, 'sentry_withdraw')?.leaveCombat).toBe(true);
    // "0.4× all": the Choir is an area move (its pattern step targets `all`); the rest hit one
    const targets: Record<string, string> = {};
    walkSteps(cr(SENTRY).pattern, [], (s: Step) => void ('move' in s && (targets[s.move] = s.target ?? 'player')));
    expect(targets).toEqual({ sentry_count: 'player', sentry_unsee: 'self', sentry_call_the_choir: 'all', sentry_withdraw: 'self', sentry_thread_cut: 'player' });
    // WORLD's "leaves combat" is the move's flag, as U45's Tyrant's Reach
    expect(block(SENTRY)).toContain('`sentry_withdraw` · "She cuts her own thread and is gone." · leaves combat · ifHpBelow:25');
  });

  test('loot: gold ranges and every item WORLD lists, in WORLD’s order and chances (the Stalker’s Void Shard at 100 %, DESIGN §8.2)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      expect([c.id, c.loot.map((l) => l.itemId).sort()]).toEqual([c.id, [...w.lootIds].sort()]);
    }
    expect(cr(STALKER).loot.map((l) => [l.itemId, l.chance, l.count])).toEqual([['item_void_shard', 1, 1], ['item_warriors_sword', 0.25, 1], ['item_chasmglass_focus', 0.1, 1]]);
    expect(cr(SENTRY).loot.map((l) => [l.itemId, l.chance, l.count])).toEqual([['mat_umbral_thread', 0.4, 1], ['item_void_shard', 0.15, 1]]);
    expect(DESIGN).toContain('| `item_void_shard` | Void Shard (legacy) | 99 | family `void_touched` (Void-Touched Stalker) 100% |');
    expect(cr(STALKER).materialKin).toBe('void_touched');
  });

  test('legacy description verbatim (the Stalker); bestiary voice, entry and tactics verbatim; the Hollowed’s codex entry, none for the Mortals', () => {
    for (const c of parsedCreatures) {
      const b = block(c.id);
      const legacy = /- \*\*Legacy description:\*\* "([^"]+)"/.exec(b)?.[1];
      if (legacy !== undefined) expect([c.id, c.description]).toEqual([c.id, flat(legacy)]);
      else expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
      expect([c.id, c.bestiary.voice]).toEqual([c.id, worldCreature(c.id).voice]);
      expect([c.id, c.bestiary.summary]).toEqual([c.id, playText(bullet(b, 'Bestiary'))]);
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, playText(bullet(b, 'Tactics:'))]);
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
    }
    expect(cr(STALKER).legacyName).toBe('Void-Touched Stalker');
    expect(cr(SENTRY).legacyName).toBeUndefined();
    expect(cr(STALKER).bestiary.codexId).toBe('codex_creatures_hollowed');
    expect(STORY).toContain('| `codex_creatures_hollowed` |');
    // WORLD §5: Mortals have "no sigil; a portrait" and STORY §14 lists eight families, none of them the Mortals
    expect(cr(SENTRY).bestiary.codexId).toBeUndefined();
    expect(cr(SENTRY).sigil.base).toBe('portrait');
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
const player = (combat: CombatState): Combatant => combat.party[0] as Combatant;

describe('patterns: WORLD’s cadence words hold turn by turn (first-match on every turn; two cycled moves alternate)', () => {
  test('the Stalker: Circle first; the Pounce while you are Cursed; otherwise the Lunge and the Starbite alternate', () => {
    expect(plan(STALKER, 6)).toEqual(seq('circle starbite lunge starbite lunge starbite'));
    expect(plan(STALKER, 6, { before: (t, _f, c) => withStatus(player(c), 'status_curse', t === 3 || t === 4) })).toEqual(seq('circle starbite pounce pounce lunge starbite'));
    // "Clean the Curse with Ley and the pounce never comes": a Curse removed before the turn leaves the cycle alone
    expect(plan(STALKER, 6, { before: (t, _f, c) => withStatus(player(c), 'status_curse', t === 3) })).toEqual(seq('circle starbite pounce starbite lunge starbite'));
  });

  test('the Sentry: Count first; Unsee every third turn; the Choir once an ally has fallen; Withdraw below a quarter; otherwise the Thread Cut', () => {
    const group = [{ creatureId: STALKER, count: 1 }, { creatureId: SENTRY, count: 1 }];
    const ally = (alive: (t: number) => boolean) => (t: number, f: Combatant, c: CombatState) => {
      for (const e of c.enemies) if (e !== f) e.alive = alive(t);
    };
    // beside a living Stalker
    expect(plan(SENTRY, 6, { groups: group, before: ally(() => true) })).toEqual(seq('count thread_cut unsee thread_cut thread_cut unsee'));
    // the ally falls on turn 4: the Choir, with Unsee still every third turn
    expect(plan(SENTRY, 8, { groups: group, before: ally((t) => t < 4) })).toEqual(seq('count thread_cut unsee call_the_choir call_the_choir unsee call_the_choir call_the_choir'));
    // wounded below a quarter beside a living ally: it cuts its thread and goes
    expect(plan(SENTRY, 6, { groups: group, before: (t, f, c) => { ally(() => true)(t, f, c); hpAt(t >= 4 ? 0.2 : 1)(f); } })).toEqual(seq('count thread_cut unsee withdraw withdraw unsee'));
    // alone (a pool or Chasm encounter): no ally has died, so no Choir (U34e, D-094: `allyDown`, "an ally died this fight")
    expect(plan(SENTRY, 6)).toEqual(seq('count thread_cut unsee thread_cut thread_cut unsee'));
  });
});

// ---- The NPC ------------------------------------------------------------------------------------------------------------------

describe('Nyx vs WORLD §4 and the legacy source', () => {
  const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
  const row = tableRows(S4).find((c) => unquote(c[0] ?? '') === 'npc_nyx') ?? [];
  const nyx = byId(npcs, 'npc_nyx');

  test('exactly the NPCs whose home is in the region: Nyx, at the Chasm', () => {
    const homes = tableRows(S4).filter((c) => /^loc_(chasm_of_whispers|voidscar_hollow)\b/.test(c[3] ?? '')).map((c) => unquote(c[0] ?? ''));
    expect(npcs.map((n) => n.id)).toEqual(homes);
    expect(homes).toEqual(['npc_nyx']);
    expect([nyx.homeLocationId, nyx.factionId, row[2]]).toEqual([CHASM, 'weavers', 'weavers']);
    expect(row[3]).toContain('loc_chasm_of_whispers');
  });

  test('name, age, legacy description (verbatim from the Python), sample lines, roles and the companion handshake (D-088)', () => {
    expect(row[1]).toContain(nyx.name);
    expect(row[5]).toContain('~70 now');
    expect(nyx.age).toBe(70);
    expect(row[5]).toContain('eyes of quiet starlight');
    expect(nyx.legacyName).toBe('Nyx');
    expect(nyx.description).toBe('A shadow-wrapped figure whose eyes burn with quiet starlight.');
    expect(fs.readFileSync(path.join(ROOT, 'legacy/aethelgard_data.py'), 'utf8')).toContain(`"description": "${nyx.description}"`);
    expect(nyx.barks).toHaveLength(2);
    for (const b of nyx.barks ?? []) expect(row[6]).toContain(`"${b.text}"`);
    expect(nyx.roles).toEqual(['companion', 'questgiver']);
    expect(row[4]).toBe('companion anchor `nyx`; quest giver (q_void_shards, Nyx arc, q_weavers_dawn)');
    expect(nyx.companionId).toBe('nyx');
    expect(companions.find((c) => c.id === 'nyx')?.npcId).toBe('npc_nyx');
    expect(nyx.portrait).toEqual(companions.find((c) => c.id === 'nyx')?.portrait);
  });
});

// ---- The region in the engine (real pack, seeded) ------------------------------------------------------------------------------

describe('the region in the engine (real pack, seeded)', () => {
  const journal = { quests: ['q_void_shards'] };

  test('the bridge: shut without Nyx’s quest, open with q_void_shards in the journal or echo_hollow_path; the Plaza’s east exit reaches the Chasm', () => {
    expect(movesFrom(PLAZA)).toContain(CHASM);
    expect(arrive(PLAZA, CHASM).world.currentLocationId).toBe(CHASM);
    expect(movesFrom(CHASM)).toEqual([PLAZA]);
    expect(movesFrom(CHASM, journal)).toEqual([HOLLOW, PLAZA].sort());
    expect(movesFrom(CHASM, { loop: 2, echoes: ['echo_hollow_path'] })).toEqual([HOLLOW, PLAZA].sort());
    expect(movesFrom(CHASM, { loop: 2, echoes: ['echo_ironclad_passwords'] })).toEqual([PLAZA]);
    expect(movesFrom(HOLLOW)).toEqual([CHASM]);
  });

  test('the Veil curtain (gate_veil_curtain): Weavers Trusted (≥ 20), echo_weaver_sign, or q_lightless_stair in the journal', () => {
    const when = loc(HOLLOW).exits.find((e) => e.to === 'loc_veil_mouth')?.when as Condition;
    expect(holds(when)).toBe(false);
    expect(holds(when, { weavers: 19 })).toBe(false);
    expect(holds(when, { weavers: 20 })).toBe(true);
    expect(holds(when, { weavers: -30 })).toBe(false);
    expect(holds(when, { loop: 2, echoes: ['echo_weaver_sign'] })).toBe(true);
    expect(holds(when, { quests: ['q_lightless_stair'] })).toBe(true);
    expect(holds(when, { quests: ['q_void_shards'] })).toBe(false);
  });

  test('the first visit to the Hollow: group A, two Stalkers; the legacy three are two fights, B on the next arrival', () => {
    const first = { ...journal, stood: { [HOLLOW]: { first: true as const } } };
    expect(fight(CHASM, HOLLOW, first)).toEqual({ id: 'enc_hollow_stalkers_a', enemies: [STALKER, STALKER], canFlee: true });
    expect(arrive(CHASM, HOLLOW, first).combat).toMatchObject({ onFlee: 'regroup' });
    // A fought (cleared) or scattered (a `scatter` effect): the next arrival is group B, one Stalker
    for (const gone of [{ cleared: ['enc_hollow_stalkers_a'] }, { scattered: ['enc_hollow_stalkers_a'] }]) {
      expect(fight(CHASM, HOLLOW, { ...journal, stood: { [HOLLOW]: gone } })).toEqual({ id: 'enc_hollow_group_b', enemies: [STALKER], canFlee: true });
    }
    // B fought or fled too: no fixed fight is left; the walk is a return roll (or nothing)
    const done = { cleared: ['enc_hollow_stalkers_a', 'enc_hollow_group_b'] };
    for (let i = 0; i < 40; i++) expect(['none', 'enc_hollow_stalker', 'wandering']).toContain(fight(CHASM, HOLLOW, { ...journal, seed: `u44-${i}`, stood: { [HOLLOW]: done } }).id || 'none');
  });

  test('Loop 2+ with the Weavers Wary or Hostile a Veil Sentry joins group B; Loop 1, or Neutral, it does not', () => {
    const stood = { [HOLLOW]: { cleared: ['enc_hollow_stalkers_a'] } };
    const joined = { id: 'enc_hollow_group_b_sentry', enemies: [STALKER, SENTRY], canFlee: true };
    const plain = { id: 'enc_hollow_group_b', enemies: [STALKER], canFlee: true };
    expect(fight(CHASM, HOLLOW, { ...journal, stood, loop: 2, weavers: -10 })).toEqual(joined); // Wary
    expect(fight(CHASM, HOLLOW, { ...journal, stood, loop: 3, weavers: -40 })).toEqual(joined); // Hostile
    expect(fight(CHASM, HOLLOW, { ...journal, stood, loop: 2, weavers: -9 })).toEqual(plain);
    expect(fight(CHASM, HOLLOW, { ...journal, stood, loop: 2, weavers: 0 })).toEqual(plain);
    expect(fight(CHASM, HOLLOW, { ...journal, stood, loop: 1, weavers: -40 })).toEqual(plain);
    // group A is the Stalkers alone whatever the standing
    expect(fight(CHASM, HOLLOW, { ...journal, loop: 2, weavers: -40, stood: { [HOLLOW]: { first: true } } }).enemies).toEqual([STALKER, STALKER]);
  });

  test('return walks to the Hollow (500 seeds): a Stalker about 35 % then the pool’s 20 %; Neutral, never a Sentry; Wary, the Sentry’s 8 % of what is left', () => {
    const stood = { [HOLLOW]: { cleared: ['enc_hollow_stalkers_a', 'enc_hollow_group_b'] } };
    const N = 500;
    const neutral = tally(CHASM, HOLLOW, N, { ...journal, stood, weavers: 0 });
    expect(neutral['enc_hollow_pool_sentry'] ?? 0).toBe(0);
    expect((neutral['enc_hollow_stalker'] ?? 0) / N).toBeGreaterThan(0.28);
    expect((neutral['enc_hollow_stalker'] ?? 0) / N).toBeLessThan(0.42);
    expect((neutral['wandering'] ?? 0) / N).toBeGreaterThan(0.07); // 0.65 × 0.20 = 13 %
    expect((neutral['wandering'] ?? 0) / N).toBeLessThan(0.19);
    const wary = tally(CHASM, HOLLOW, N, { ...journal, stood, weavers: -20 });
    expect((wary['enc_hollow_pool_sentry'] ?? 0) / N).toBeGreaterThan(0.02); // 0.65 × 0.08 = 5.2 %
    expect((wary['enc_hollow_pool_sentry'] ?? 0) / N).toBeLessThan(0.09);
    expect(Object.keys(wary).filter((k) => !['none', 'enc_hollow_stalker', 'enc_hollow_pool_sentry', 'wandering'].includes(k))).toEqual([]);
  });

  test('the Chasm: safe, no fight on a first visit or while the Weavers are not Wary; Wary on a return, a Sentry 8 % and a Stalker 12 %', () => {
    expect(fight(PLAZA, CHASM, { weavers: -40 }).id).toBe(''); // a first visit, even Hostile
    const stood = { [CHASM]: {} };
    const N = 500;
    expect(tally(PLAZA, CHASM, N, { stood, weavers: 0 })).toEqual({ none: N });
    expect(tally(PLAZA, CHASM, N, { stood, weavers: -9 })).toEqual({ none: N });
    const wary = tally(PLAZA, CHASM, N, { stood, weavers: -10 });
    expect(Object.keys(wary).filter((k) => !['none', 'enc_chasm_sentry', 'enc_chasm_stalker'].includes(k))).toEqual([]); // no pool: `safe`
    expect((wary['enc_chasm_sentry'] ?? 0) / N).toBeGreaterThan(0.04);
    expect((wary['enc_chasm_sentry'] ?? 0) / N).toBeLessThan(0.13);
    expect((wary['enc_chasm_stalker'] ?? 0) / N).toBeGreaterThan(0.07);
    expect((wary['enc_chasm_stalker'] ?? 0) / N).toBeLessThan(0.18);
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder in WORLD §2 order; the region’s tables are in `contentTables` and the index', () => {
    const folders = REGION_FOLDERS.map((f) => f.region.id);
    expect(folders).toContain(REGION);
    expect(folders.indexOf('region_mistwood_ironclad_reach')).toBeLessThan(folders.indexOf(REGION));
    expect(folders.indexOf(REGION)).toBeLessThan(folders.indexOf('region_aether_kissed_highlands'));
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('The Voidscar');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.name).toBe(c.name);
    for (const n of npcs) expect(pack.npcs[n.id]?.name).toBe(n.name);
    expect(items).toEqual([]); // the items tables are U49/U50's; this region owns none
    expect(pack.index.startLocationId).toBe(WR);
  });

  test('validates with 0 errors; pending references name only tables still being authored; the region’s real warnings are the Sentry’s two band notes', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const pending = report.warnings.filter((w) => w.message.startsWith('pending — content not yet authored (reference): '));
    for (const w of pending) {
      const table = /not found in ([a-z]+)$/.exec(w.message)?.[1];
      expect([w.message, INCOMPLETE_TABLES.includes(table as (typeof INCOMPLETE_TABLES)[number])]).toEqual([w.message, true]);
    }
    // Order-agnostic (U47): a warning that names a location outside this region is that region's (the Void-Touched Stalker is this
    // region's creature, but the Veil's Scar Shelf places it too, and rule 11 reads the band of the Shelf there).
    const elsewhere = (w: { message: string }): boolean => [...w.message.matchAll(/\bloc_[a-z0-9_]+/g)].some((m) => !here.has(m[0]));
    const real = report.warnings.filter(
      (w) => !w.message.startsWith('pending — content not yet authored') && !elsewhere(w) && (mine.has(w.id) || [...here].some((id) => w.message.includes(` ${id}`))),
    );
    // WORLD gives the Sentry level 10 and the Chasm 4–5, the Hollow 5–7: rule 11 (non-fatal) says so, once per placement
    expect([...new Set(real.map((w) => `${w.rule} ${w.id}`))].sort()).toEqual(['rule-11 cr_veil_sentry']);
    expect(real.every((w) => /loc_(chasm_of_whispers|voidscar_hollow)/.test(w.message))).toBe(true);
  });

  test('`npm run validate`: exit 0, 0 errors, the pending references listed', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/ regions \d+ · locations \d+ · creatures \d+ · /);
    expect(text).not.toMatch(/pending rule-01: /); // U61: the codex was the last table a region referred to; nothing is pending now
    expect(text).toMatch(/validate: ok — 0 errors, \d+ warning\(s\)$/m);
  });

  test('this region’s pending references name only ids WORLD/STORY/DESIGN spell (other regions’ locations, items, quests, Echoes, codex entries); the Plaza now resolves', () => {
    const { report } = parseContentPack(contentTables);
    const targets = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    // Later units resolve these one by one (regions U46–U48, items U49/U50, quests U52–U59): the list may only shrink
    const known = new Set([
      'loc_veil_mouth', 'loc_scar_shelf',
      'item_void_shard', 'item_warriors_sword', 'item_chasmglass_focus', 'mat_umbral_thread',
      'q_void_shards', 'q_lightless_stair',
      'echo_hollow_path', 'echo_nine_voices', 'echo_weaver_sign',
      'weavers', // the faction record (region.factionId, npc faction, the rep atoms)
      'nyx', // the companion record (D-088: registered by U55)
      'codex_region_voidscar', 'codex_creatures_hollowed',
    ]);
    expect([...targets].filter((t) => !known.has(t)).sort()).toEqual([]);
    expect(targets.has(PLAZA)).toBe(false);
    expect(targets.has(CHASM)).toBe(false);
    const docs = `${WORLD}\n${STORY}\n${DESIGN}`;
    for (const id of targets) expect([id, docs.includes(id)]).toEqual([id, true]);
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U44 reply ----------------------------------------

describe('authored words outside the documents are few and short; coined ids are the listed ones', () => {
  test('encounter intros, the rest text, the Sentry’s description', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro)).filter((t): t is string => t !== undefined);
    expect(intros.length).toBe(7);
    expect(parsedLocations.flatMap((l) => l.encounters).length).toBe(7);
    for (const t of intros) expect([t, words(t) <= 20]).toEqual([t, true]);
    expect(loc(CHASM).rest?.text).toBe('You rest at the cold camp on the lip, where Nyx permits it.');
    expect(loc(HOLLOW).rest).toBeUndefined();
    expect(cr(SENTRY).description).toBe('A Weaver in grey thread, counting you in or out.');
    expect(words(cr(SENTRY).description)).toBeLessThanOrEqual(30);
  });

  test('ids this unit coined (WORLD/STORY have none for them): encounter ids, the Mortals’ family id, the art silhouette keys', () => {
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.id))).toEqual([
      'enc_chasm_sentry', 'enc_chasm_stalker',
      'enc_hollow_stalkers_a', 'enc_hollow_group_b_sentry', 'enc_hollow_group_b', 'enc_hollow_stalker', 'enc_hollow_pool_sentry',
    ]);
    expect(cr(SENTRY).family).toBe('fam_mortal');
    expect(parsedLocations.map((l) => l.art.silhouettes)).toEqual([['cliff_lips', 'rope_bridge', 'glass_plain'], ['obsidian_scree', 'leaning_crystals', 'dark_curtain']]);
    // every move id is WORLD's
    for (const c of parsedCreatures) for (const id of Object.keys(c.moves)) expect([c.id, id, WORLD.includes(`\`${id}\``)]).toEqual([c.id, id, true]);
  });
});
