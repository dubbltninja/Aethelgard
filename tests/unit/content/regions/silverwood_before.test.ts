// U48b: Silverwood Before — checked against the documents at test time, U42's pattern (regions/silverwood_ruins.test.ts) and the
// later regions' (regions/ashen_steppe.test.ts): WORLD §2.6, §3.11, §3.13, §4, §6, §10.1–10.5, §11.1–11.3, §12.1; DESIGN §6.2,
// §6.5, §10.1, §17.1, §18.2; PLAN Appendix A; STORY §9, §12, §14. The region is new (no legacy text, no `legacyName`), so every
// description is WORLD's, character for character, as play text. Patterns are walked turn by turn by the engine
// (`generateIntent`). The Before runs on the engine's own mechanics (src/engine/before.ts, U32): the last part of this file
// plays them on the real pack — through the Breach-door and through the Apex tear, a day at the Garret, an Anchor on the
// cradle's rim, the door's dawn, the day-scripted guards, the drawn blade, Last Bell's reset. Where a record departs from the
// letter of WORLD (a reading the schema or the engine forces), the test pins the departure; the readings are listed in the
// U48b reply.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures as folderCreatures } from '@content/regions/silverwood_before/creatures';
import { items } from '@content/regions/silverwood_before/items';
import { locations } from '@content/regions/silverwood_before/locations';
import { npcs } from '@content/regions/silverwood_before/npcs';
import { region } from '@content/regions/silverwood_before/region';
import { companions } from '@content/shared/companions';
import { LEGACY_CREATURES, LEGACY_LOCATIONS, LEGACY_NPCS, validateContent } from '@content/validate';
import { dayOf } from '@engine/conditions';
import { npcsAt } from '@engine/reducers/explore';
import {
  BEFORE_RETURN_WATCHES,
  BEFORE_TEXT,
  CONFLUX_LOCATION_ID,
  CRADLE_PIN_ITEM_ID,
  DEPTHS_LOCATION_ID,
  FLAG_CONFLUX_ANCHORED,
  FLAG_ENTERED_VIA_APEX,
  FLAG_ENTERED_VIA_NEXUS,
  FLAG_WANTED_IN_SILVERWOOD,
  anchorsInDepths,
  beginCombat,
  evaluate,
  generateIntent,
  legalActions,
  step,
  type Action,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import type { Condition } from '@schema/condition';
import { CreatureSchema, walkSteps, type Creature, type Step } from '@schema/creature';
import type { ItemInput } from '@schema/item';
import { LocationSchema, type Location } from '@schema/location';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { main as validateCli } from '../../../../tools/validate-content';
import { PLAN, WORLD, ids, section, tableRows, unquote, worldCreature, worldCreatureTable, worldEdges, worldLocations, worldNodes } from './worldDoc';

// U34e (D-087): WORLD §10.2's anomaly variants live in this folder too; WORLD §6's checks below are on the
// others (tests/unit/engine/u34e/anomalies.test.ts checks the variants).
const creatures = folderCreatures.filter((c) => !c.id.startsWith('cr_anomaly_'));

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');

const REGION = 'region_silverwood_before';
const GT = 'loc_silver_gate';
const OW = 'loc_outer_walks';
const CO = 'loc_scholars_corridor';
const GL = 'loc_grand_library';
const PB = 'loc_plaza_of_bells';
const NH = 'loc_ninefold_hall';
const AG = 'loc_apprentices_garret';
const CG = 'loc_cistern_gardens';
const AD = 'loc_archives_of_danthe';
const CX = 'loc_conflux_chamber';
const ALL = [GT, OW, CO, GL, PB, NH, AG, CG, AD, CX];
const NEXUS = 'loc_chronos_nexus';
const APEX = 'loc_temporal_breach_apex';
const WR = 'loc_whispering_ruins';
const HOUND = 'cr_ley_hound';
const KNIGHT = 'cr_ninefold_knight';
const WARDEN = 'cr_unbroken_warden';
const HALBERDIER = 'cr_city_watch_halberdier';
const ADEPT = 'cr_circle_adept';
const PILLAR = 'cr_warding_pillar';
const SEAL = 'item_ward_seal';
const LENS = 'item_chronos_lens';
const TALISMAN = 'item_sky_whisper_talisman';

const S26 = section(WORLD, '### 2.6 `region_silverwood_before`', '### 2.7');
/** WORLD §3.11. The Grand Library's meta line reads "Band / band / map / rest / merchant" (a typo in WORLD): mended for the reader. */
const S311_RAW = section(WORLD, '### 3.11 Silverwood Before', '### 3.12');
const S311 = S311_RAW.replace('**Band / band / map / rest / merchant:**', '**Band / map / rest / merchant:**');
const WL = Object.fromEntries(worldLocations(S311).map((l) => [l.id, l]));
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
const enc = (l: string, id: string) => byId(loc(l).encounters, id);
const ev = (l: string, id: string) => byId(loc(l).events, id);
const itemAt = (l: string, itemId: string) => {
  const found = loc(l).items.find((i) => i.itemId === itemId);
  if (!found) throw new Error(`no ${itemId} at ${l}`);
  return found;
};
/** One line of prose: the document's wrapped lines joined. */
const flat = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim();
/** WORLD's prose as play text: markdown emphasis and decision references dropped (the creature files' header). */
const playText = (s: string): string =>
  flat(s)
    .replace(/[`*]/g, '')
    .replace(/ \(D-\d+(?:\.\d+)?\)/g, '')
    .replace(/, D-\d+(?:\.\d+)?\)/g, ')');
const words = (s: string): number => s.trim().split(/\s+/).length;
const bell = (...days: (1 | 2 | 3)[]): Condition => (days.length === 1 ? { beforeDay: days[0] as 1 | 2 | 3 } : { any: days.map((d) => ({ beforeDay: d })) });

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
/**
 * WORLD's condition notation (`{flag:"x"}`, unquoted keys) as the schema's data: `{item:"x"}` is `{item:{id:"x"}}`,
 * `{companion:"x",state:"active"}` is `{companion:{id:"x",state:"active"}}`, and the engine's Bell mirror `{flag:"flag_before_day_n"}`
 * is DESIGN §13.3's `{beforeDay:n}` (the reading in locations.ts).
 */
function worldCondition(text: string): Condition {
  const json = text.replace(/([{,])([a-zA-Z_]+):/g, '$1"$2":');
  const fix = (c: unknown): unknown => {
    if (Array.isArray(c)) return c.map(fix);
    if (typeof c !== 'object' || c === null) return c;
    const o = c as Record<string, unknown>;
    if (typeof o['companion'] === 'string') return { companion: { id: o['companion'], ...(o['state'] === undefined ? {} : { state: o['state'] }) } };
    const day = typeof o['flag'] === 'string' ? /^flag_before_day_([123])$/.exec(o['flag'])?.[1] : undefined;
    if (day !== undefined) return { beforeDay: Number(day) };
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'item' && typeof v === 'string' ? { id: v } : fix(v)]));
  };
  return fix(JSON.parse(json)) as Condition;
}

// ---- The engine pack: stand-ins for the three items the doors and the rim need ---------------------------------------------------

/**
 * The item records are U49/U50's. The engine tests carry three of them — the Chronos Lens (the Breach-door), the Ward Seal (the
 * Hall and the stair) and the Sky-Whisper Talisman (an `anchorable` item for the rim, WORLD §7.11/§3.1) — so `epack` is the real
 * pack with these stand-ins wherever the record has not landed. No test of the content itself reads them.
 */
const STAND_INS: ItemInput[] = [
  { id: LENS, name: 'Chronos Lens', type: 'trinket', slot: 'trinket', tier: 3, description: 'Stand-in (test only).', value: 40, art: { icon: 'lens' }, tags: ['key'] },
  { id: SEAL, name: 'Ward Seal', type: 'quest', tier: 0, description: 'Stand-in (test only).', value: 0, art: { icon: 'seal' }, tags: ['key'] },
  {
    id: TALISMAN,
    name: 'Sky-Whisper Talisman',
    type: 'trinket',
    slot: 'trinket',
    tier: 2,
    description: 'Stand-in (test only).',
    stats: { agility: 1 },
    value: 32,
    art: { icon: 'talisman' },
    tags: ['key'],
    anchorable: true,
  },
];
const epack = buildContentPack({ ...contentTables, items: [...contentTables.items, ...STAND_INS.filter((i) => pack.items[i.id] === undefined)] }, { validate: false });

// ---- Engine helpers -----------------------------------------------------------------------------------------------------------

type QuestSpec = 'active' | 'completed' | 'failed';
interface At {
  seed?: string;
  loop?: number;
  /** Inside the Before on this Bell (the engine's `before` counter, the frozen clock, the mirror flag, the door flag). */
  day?: 1 | 2 | 3;
  resets?: number;
  /** The door the Wayfinder came by (default the Nexus's). */
  via?: 'nexus' | 'apex';
  flags?: Record<string, boolean>;
  /** Item ids carried (stand-ins or real records). */
  items?: string[];
  /** Echoes granted this loop (the pack has no echo records yet, so they are set directly). */
  echoes?: string[];
  quests?: Record<string, QuestSpec>;
  /** Locations the Wayfinder has stood in this loop (their first-visit roll is behind them). */
  visited?: string[];
  /** Encounters fled (scattered), by location. */
  scattered?: Record<string, string[]>;
  kills?: Record<string, number>;
  remnants?: number;
  /** D-098: the echo's own hour inside the Before (0 dawn … 3 night; `counters.custom.before_watch`). */
  hour?: 0 | 1 | 2 | 3;
}

/** A location state as if its items were already on the ground (no item record exists to spawn: U49/U50's). */
const seeded = (visited: boolean, cleared: string[] = [], scattered: string[] = []): GameState['world']['locationStates'][string] => ({
  visited,
  visitCount: visited ? 1 : 0,
  items: [],
  itemsSpawned: true,
  encountersCleared: cleared,
  encounterClearedDay: {},
  eventsFired: [],
  flags: {},
  unlockedExits: [],
  lockedExits: [],
  scattered,
  encounterHp: {},
});

/** A Loop 2 (by default) level-15 Wayfinder standing at `locationId` on the engine pack. */
function stateAt(locationId: string, o: At = {}): GameState {
  return makeState(
    {
      locationId,
      seed: o.seed ?? 'u48b',
      loop: o.loop ?? 2,
      level: 15,
      items: o.items ?? [],
      flags: o.flags ?? {},
      ...(o.remnants === undefined ? {} : { reputation: { remnants: o.remnants } }),
      patch: (s) => {
        for (const id of [...ALL, NEXUS, APEX]) {
          const visited = (o.visited ?? []).includes(id);
          // the Nexus's first-visit Aberration is behind anyone who has stood there
          s.world.locationStates[id] = seeded(visited, id === NEXUS && visited ? ['enc_nexus_aberration'] : [], o.scattered?.[id] ?? []);
        }
        if (o.day !== undefined) {
          s.before = { day: o.day, resets: o.resets ?? 0 };
          s.clock.frozen = true;
          s.flags[`flag_before_day_${o.day}`] = true;
          s.flags[o.via === 'apex' ? FLAG_ENTERED_VIA_APEX : FLAG_ENTERED_VIA_NEXUS] = true;
          s.counters.custom['before_watch'] = o.hour ?? 0;
        }
        for (const id of o.echoes ?? []) s.echoesThisLoop.push(id);
        for (const [id, status] of Object.entries(o.quests ?? {})) s.quests[id] = { status, stage: 'u48b', startedDay: 1, endedDay: status === 'active' ? null : 1, counters: {}, objectivesDone: [] };
        for (const [id, n] of Object.entries(o.kills ?? {})) s.counters.kills[id] = n;
      },
    },
    { content: epack },
  );
}
const profileOf = (o: At = {}): Profile => freshProfile({ loopCounter: o.loop ?? 2 });
/** Caelum recruited and active (a condition's view only: the companion records are U56's, D-088). */
function withCaelum(s: GameState): GameState {
  s.companions.recruited['caelum'] = { id: 'caelum', recruited: true, loyalty: 0, hp: 75, hpMax: 75, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} };
  s.companions.activeId = 'caelum';
  return s;
}
const holds = (cond: Condition, at: string, o: At = {}, caelum = false): boolean => {
  const s = stateAt(at, o);
  return evaluate(cond, caelum ? withCaelum(s) : s, profileOf(o), epack);
};

type Ev = GameEvent;
const ofType = <T extends Ev['t']>(events: readonly Ev[], t: T) => events.filter((e): e is Extract<Ev, { t: T }> => e.t === t);
interface Run {
  s: GameState;
  prof: Profile;
  last: Ev[];
}
function act(r: Run, action: Action): Run {
  const out = step(r.s, action, epack, r.prof);
  const rejected = ofType(out.events, 'actionRejected')[0];
  if (rejected) throw new Error(`${JSON.stringify(action)} was rejected: ${rejected.reason}`);
  return { s: out.state, prof: out.profile, last: out.events };
}
const run = (r: Run, actions: readonly Action[]): Run => actions.reduce(act, r);
const start = (locationId: string, o: At = {}): Run => ({ s: stateAt(locationId, o), prof: profileOf(o), last: [] });
const move = (to: string): Action => ({ type: 'move', to });
const FULL: Action = { type: 'rest', kind: 'full' };
const movesOf = (r: Run): string[] =>
  legalActions(r.s, epack, r.prof)
    .filter((a) => a.type === 'move')
    .map((a) => (a as { to: string }).to)
    .sort();
/** What a walk onto `to` starts: the encounter id and the enemies' creature ids ('' / [] for none). */
function fight(from: string, to: string, o: At = {}): { id: string; enemies: string[]; canFlee: boolean | undefined; onFlee: string | undefined } {
  const s = act(start(from, o), move(to)).s;
  return { id: s.combat?.encounterId ?? '', enemies: s.combat?.enemies.map((e) => e.refId) ?? [], canFlee: s.combat?.canFlee, onFlee: s.combat?.onFlee };
}
/** How the fights fall over `n` seeded walks onto `to`: encounter id → count ('—' for none). */
function tally(from: string, to: string, n: number, o: At): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const id = fight(from, to, { ...o, seed: `u48b-${to}-${i}` }).id || '—';
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_silverwood_before vs WORLD §2.6, §10.1, DESIGN §6.5, §17.1, §18.2', () => {
  test('id, name, new (Appendix A.1), no faction, the band, WORLD’s theme text, order, codex entry, Loop 2+', () => {
    expect(region.id).toBe(REGION);
    expect(S26.startsWith(`### 2.6 \`${REGION}\` — ${region.name}`)).toBe(true);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | new | 10 |`);
    expect('legacy' in region).toBe(false);
    expect(pack.regions[REGION]?.legacy).toBe(false);
    expect(S26).toContain('| Level band | 13–17 |');
    expect(region.levelBand).toEqual({ min: 13, max: 17 });
    expect(DESIGN).toMatch(/\| Silverwood Before \| `region_silverwood_before` \| 13–17 \|/);
    // "None of the three exist yet": the Watch and the Circle are not reputation tracks
    expect(S26).toContain('| Factions | None of the three exist yet.');
    expect('factionId' in region).toBe(false);
    const theme = /\*\*Theme\.\*\* ([\s\S]*?)\n\n\| Field/.exec(S26)?.[1] ?? '';
    expect(region.description).toBe(playText(theme));
    expect(flat(theme)).toContain('each time the Wayfinder enters (D-016)');
    expect(region.order).toBe(6);
    expect(region.codexId).toBe('codex_region_silverwood_before');
    expect(STORY).toContain('| `codex_region_silverwood_before` | Silverwood, Three Days Before |');
    // PLAN §5.2's own example of `unlockWhen`
    expect(region.unlockWhen).toEqual({ loop: { min: 2 } });
    expect(PLAN).toContain('unlockWhen: ConditionSchema.optional(),                // e.g. Silverwood Before: { loop: { min: 2 } }');
  });

  test('the ten locations WORLD lists, in WORLD’s order, all in the region, each inside the region’s band', () => {
    const listed = /\| Locations \(10\) \| ([^|]+) \|/.exec(S26)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual(ALL);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of parsedLocations) {
      expect(l.regionId).toBe(REGION);
      const band = l.levelBand ?? region.levelBand;
      expect([l.id, band.min >= region.levelBand.min && band.max <= region.levelBand.max]).toEqual([l.id, true]);
    }
  });

  test('no wandering pool: WORLD §10.1 says the Before is day-scripted, so nothing rolls on a return visit', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => c[0] === '(Silverwood Before, Threshold)');
    expect(row?.slice(1)).toEqual(['none', 'the Before is day-scripted (§12); the Threshold has no combat']);
    expect(region.wanderingPool).toEqual([]);
    expect(region.returnEncounterChance).toBe(0);
  });

  test('palette: DESIGN §17.1’s Silverwood Before row (sky top, sky bottom, mid, accent = glow); the ambient preset exists in §18.2', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'Silverwood Before');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).some((c) => c[0] === 'Silverwood Before')).toBe(true);
    expect(region.ambient).toBe('ambient_silverwood_before');
    for (const l of parsedLocations) expect([l.id, l.ambient]).toEqual([l.id, undefined]);
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the ten locations vs WORLD §3.11 blocks', () => {
  test('names, bands, coordinates and region; every node is temporally unstable (WORLD §12.3)', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.levelBand, l.map, l.temporallyUnstable]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map, true]);
    }
    expect(WL[CX]?.block).toContain('16–17 (boss) · (64, 10)');
    // the Library's typo, mended for the reader above, is WORLD's own
    expect(S311_RAW).toContain('- **Band / band / map / rest / merchant:** 14 · (64, 0) · no · no');
  });

  test('descriptions: WORLD’s, character for character, as play text (the Library’s card loses its emphasis, the Conflux WORLD’s editorial note); no legacy name', () => {
    for (const l of locations) {
      const w = WL[l.id]?.description ?? '';
      const expected = l.id === CX ? w.replace(/ \(STORY wins, D-067\.10: [^)]*\)$/, '') : playText(w);
      expect([l.id, l.description]).toEqual([l.id, expected]);
      expect([l.id, 'legacyName' in l]).toEqual([l.id, false]);
    }
    expect(WL[GL]?.description).toContain("with a card in Oriel Danthe's hand: *Do not sing to it.*");
    expect(loc(GL).description.endsWith("with a card in Oriel Danthe's hand: Do not sing to it.")).toBe(true);
    expect(WL[CX]?.description.endsWith('(STORY wins, D-067.10: the stone exists before the ritual; the ritual cracks it.)')).toBe(true);
    expect(loc(CX).description.endsWith('and it does not let anyone through who is not Nine.')).toBe(true);
  });

  test('exits: every walkable WORLD exit in order, at 0 watches (WORLD §11.0), gated ones with a `when` and WORLD’s refusal; the two doors back are hidden portals', () => {
    for (const l of parsedLocations) {
      const walks = l.exits.filter((e) => e.to !== NEXUS && e.to !== APEX).map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, walks]).toEqual([l.id, WL[l.id]?.exits]);
      for (const e of l.exits) expect([l.id, e.to, e.travelWatches]).toEqual([l.id, e.to, 0]);
    }
    expect(section(WORLD, '### 11.0', '### 11.1')).toContain('Before and Threshold edges cost 0');
    // the gates' refusal lines are WORLD's notes on the gates
    expect(loc(PB).exits.find((e) => e.to === NH)?.lockedText).toBe('The Hall admits apprentices and the sealed.');
    expect(WL[PB]?.block).toContain('— the Hall admits apprentices and the sealed; on Last Bell its doors stand open');
    expect(loc(AD).exits.find((e) => e.to === CX)?.lockedText).toBe('The stair is warded until Last Bell.');
    expect(WL[AD]?.block).toContain('— the stair is warded until Last Bell');
    // the doors back: WORLD's ⟂ rows, not walkable exits in the reader
    expect(loc(GT).exits.at(-1)).toEqual({ dir: 'west', to: NEXUS, label: 'the Breach-door', when: { flag: FLAG_ENTERED_VIA_NEXUS }, hidden: true, travelWatches: 0, oneWay: false, kind: 'path' });
    expect(WL[GT]?.block).toContain('| west ⟂ (Breach-door) | loc_chronos_nexus | `{flag:"flag_entered_before_via_nexus"}` — the way back |');
    expect(loc(CX).exits.at(-1)).toEqual({ dir: 'portal', to: APEX, label: 'through the tear', when: { flag: FLAG_ENTERED_VIA_APEX }, hidden: true, travelWatches: 0, oneWay: false, kind: 'path' });
    expect(WL[CX]?.block).toContain('| through the tear ⟂ | loc_temporal_breach_apex | `{flag:"flag_entered_before_via_apex"}` — the way back |');
  });

  test('rest points and merchants as WORLD says: the Garret is the only rest (it advances the Bell), Anso’s stall at the Plaza', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, w?.rest, w?.merchant]);
    }
    expect(loc(AG).rest?.kind).toBe('camp');
    expect(WL[AG]?.block).toContain('**Rest point: yes** (resting here advances the Before\'s day)');
    expect(loc(PB).merchantId).toBe('npc_bellwright_anso');
  });

  test('every item WORLD places is placed with its condition; gathering is `gather`; Bell-bound and visit-earned items lie in the open (D-098), the plinth’s half hidden; the Library’s seal and the Hall’s page are not items there', () => {
    for (const l of parsedLocations) {
      const expected = new Set(WL[l.id]?.itemIds ?? []);
      for (const g of l.gather ?? []) expected.delete(g.itemId);
      if (l.id === GL) expected.delete(SEAL); // the marginalia's requirement ("requires `item_ward_seal` or …")
      if (l.id === NH) expected.delete('item_litany_page_3'); // "is **not** here (see Archives)"
      expect([l.id, l.items.map((i) => i.itemId).sort()]).toEqual([l.id, [...expected].sort()]);
    }
    expect(WL[GL]?.block).toContain('requires `item_ward_seal` or `rep remnants ≥ 20` via Oriel\'s letter');
    expect(WL[NH]?.block).toContain('item_litany_page_3 is **not** here (see Archives)');
    // gathering: heartwood ×1 at the Walks and the Gardens, ×2 at the Conflux (once per loop: the engine's count, before.ts)
    expect([OW, CG, CX].map((id) => loc(id).gather)).toEqual([1, 1, 2].map((perDay) => [{ itemId: 'mat_silverwood_heartwood', perDay }]));
    // the plain ones
    const item = (o: object) => ({ count: 1, hidden: false, once: true, chance: 1, onTake: [], ...o }); // U34d's defaults
    expect(loc(OW).items).toEqual([item({ itemId: 'item_silverwood_honeycake', count: 2 })]);
    expect(itemAt(GL, 'item_remnant_ink')).toEqual(item({ itemId: 'item_remnant_ink', count: 2 }));
    expect(itemAt(AG, 'item_silverwood_honeycake')).toEqual(item({ itemId: 'item_silverwood_honeycake' }));
    expect(itemAt(CG, 'item_mana_bloom')).toEqual(item({ itemId: 'item_mana_bloom', count: 2 }));
    expect(itemAt(CX, 'item_chronal_dust')).toEqual(item({ itemId: 'item_chronal_dust', count: 3 }));
    // the conditioned ones, each with WORLD's condition: D-098 (U34d) an entry appears on the first arrival at which its condition
    // holds, so U48b's `hidden` (for an item that could only appear at the loop's first entry) is gone — but the plinth's half,
    // which the Warden's fight on arrival earns, waits for the examine after it
    const hid = (l: string, itemId: string) => [itemAt(l, itemId).hidden, itemAt(l, itemId).when];
    expect(hid(GL, 'item_korrs_marginalia')).toEqual([false, { all: [bell(1, 2), { any: [{ item: { id: SEAL } }, { rep: { faction: 'remnants', min: 20 } }] }] }]);
    expect(hid(PB, 'item_bell_shard')).toEqual([false, bell(3)]);
    expect(WL[PB]?.block).toContain('item_bell_shard (Day 3, after the first toll cracks a bell; 100%)');
    expect(hid(NH, 'item_orrery_key')).toEqual([false, { all: [bell(1), { echo: 'echo_hadrek_clockwright' }] }]);
    expect(hid(AG, CRADLE_PIN_ITEM_ID)).toEqual([false, { any: [{ quest: { id: 'q_the_apprentices_errand', status: 'completed' } }, { quest: { id: 'q_the_mending', status: 'active' } }] }]);
    expect(WORLD).toContain('`npc_caelum` gives it (`loc_apprentices_garret`, his errand); `q_the_mending` stage 3');
    expect(hid(CG, 'item_cistern_key')).toEqual([false, { all: [bell(2), { echo: 'echo_rhune_choice' }] }]);
    const page = itemAt(AD, 'item_litany_page_3');
    expect([page.hidden, page.when]).toEqual([false, worldCondition('{any:[{echo:"echo_oriel_lineage"},{rep:{faction:"remnants",min:20}}]}')]);
    expect(WL[AD]?.block).toContain('item_litany_page_3 (Oriel gives it: `{any:[{echo:"echo_oriel_lineage"},{rep:{faction:"remnants",min:20}}]}`)');
    expect(hid(AD, 'item_oriels_quill')).toEqual([false, bell(3)]);
    const tobrin = { all: [bell(2), { echo: 'echo_vask_seal' }] };
    expect(hid(CX, SEAL)).toEqual([false, tobrin]);
    expect(hid(CX, 'item_breach_anchor_schematic_b')).toEqual([
      true,
      { any: [tobrin, { all: [bell(3), { any: [{ killed: { id: WARDEN } }, { all: [{ item: { id: SEAL } }, { companion: { id: 'caelum', state: 'active' } }] }] }] }] },
    ]);
  });

  test('the items’ conditions in play: the marginalia on First and Second Bell with the seal or Remnants Trusted; the cistern key on Second Bell with Rhune’s Echo; the half on Tobrin’s plinth after the Warden or the kneeling', () => {
    const marg = itemAt(GL, 'item_korrs_marginalia').when as Condition;
    expect([holds(marg, GL, { day: 1 }), holds(marg, GL, { day: 1, items: [SEAL] }), holds(marg, GL, { day: 2, remnants: 20 }), holds(marg, GL, { day: 3, items: [SEAL] })]).toEqual([false, true, true, false]);
    const key = itemAt(CG, 'item_cistern_key').when as Condition;
    expect([holds(key, CG, { day: 2 }), holds(key, CG, { day: 2, echoes: ['echo_rhune_choice'] }), holds(key, CG, { day: 3, echoes: ['echo_rhune_choice'] })]).toEqual([false, true, false]);
    const half = itemAt(CX, 'item_breach_anchor_schematic_b').when as Condition;
    expect([
      holds(half, CX, { day: 2, echoes: ['echo_vask_seal'] }),
      holds(half, CX, { day: 3 }),
      holds(half, CX, { day: 3, kills: { [WARDEN]: 1 } }),
      holds(half, CX, { day: 3, items: [SEAL] }, true),
      holds(half, CX, { day: 3, items: [SEAL] }),
    ]).toEqual([true, false, true, true, false]);
    // outside the Before no Bell holds: `beforeDay` is false there (DESIGN §13.3)
    expect(holds(itemAt(PB, 'item_bell_shard').when as Condition, PB)).toBe(false);
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa (the Warden’s pillars are its Phase 1 adds and the stair’s own)', () => {
    for (const l of parsedLocations) {
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      expect([l.id, [...got].sort()]).toEqual([l.id, [...(WL[l.id]?.creatureIds ?? [])].sort()]);
    }
    expect(cr(WARDEN).phases[0]?.adds).toMatchObject([{ creatureId: PILLAR, count: 2 }]);
  });

  test('the encounters, Bell by Bell (WORLD §3.11, §12.1 `ws_before_day_n`, `ws_wanted`): chances, conditions, the guards that hold (R10-1)', () => {
    const shape = (l: string, id: string) => {
      const x = enc(l, id);
      return [x.groups.map((g) => `${g.creatureId}×${g.count}`), x.chance, x.when, x.respawn, x.once, x.fleeable, x.onFlee];
    };
    const wanted = { flag: FLAG_WANTED_IN_SILVERWOOD };
    expect(shape(GT, 'enc_silver_gate_halberdiers')).toEqual([[`${HALBERDIER}×2`], 1, { all: [bell(3), wanted] }, 'never', true, true, 'scatter']);
    expect(WL[GT]?.block).toContain('**Encounters:** none (Watch present); on Day 3, cr_city_watch_halberdier ×2 if `flag_wanted_in_silverwood`.');
    // a Bell's group under 100 % rolls on every arrival while its Bell holds (the header's reading)
    expect(shape(OW, 'enc_walks_hounds')).toEqual([[`${HOUND}×2`], 0.4, bell(2, 3), 'daily', true, true, 'scatter']);
    expect(WL[OW]?.block).toContain('first: cr_ley_hound ×2 (Day 2–3 only, 40%; the Circle\'s hounds roam when the Archives are sealed)');
    expect(shape(CO, 'enc_scholars_adept')).toEqual([[`${ADEPT}×1`], 0.5, { all: [bell(3), wanted] }, 'daily', true, true, 'scatter']);
    expect(WL[CO]?.block).toContain('Day 3: ley-flare hazard (Burn 1 turn on entry); cr_circle_adept ×1 (50%) if `flag_wanted_in_silverwood`.');
    expect(shape(GL, 'enc_grand_library_adepts')).toEqual([[`${ADEPT}×2`], 0.6, bell(3), 'daily', true, true, 'scatter']);
    expect(WL[GL]?.block).toContain('**Encounters:** none Days 1–2; Day 3: cr_circle_adept ×2 (60%).');
    // §6.9's "loc_grand_library (×2, Day 3)" has no chance; §3.11 and §12.1 say 60 %
    expect(block(ADEPT)).toContain('loc_grand_library (×2, Day 3)');
    expect(section(WORLD, '### 12.1', '### 12.2')).toContain('GL adepts 60%');
    // the Plaza's Watch never starts on an arrival: the drawn blade starts it (`ev_plaza_blade`)
    expect(shape(PB, 'enc_bells_watch')).toEqual([[`${HALBERDIER}×2`], 1, { not: { all: [] } }, 'never', true, true, 'scatter']);
    expect(ev(PB, 'ev_plaza_blade').effects).toEqual([{ startCombat: 'enc_bells_watch' }]);
    expect(shape(NH, 'enc_hall_knight')).toEqual([[`${KNIGHT}×1`], 1, bell(3), 'never', true, false, 'hold']);
    expect(shape(AD, 'enc_danthe_pillar')).toEqual([[`${PILLAR}×1`], 1, { all: [bell(2), { not: { item: { id: SEAL } } }] }, 'never', true, false, 'hold']);
    expect(shape(CX, 'enc_conflux_warden')).toEqual([[`${WARDEN}×1`], 1, bell(3), 'never', true, false, 'hold']);
    expect(enc(CX, 'enc_conflux_warden').optionalWhen).toEqual({ all: [{ item: { id: SEAL } }, { companion: { id: 'caelum', state: 'active' } }] });
    expect(shape(CX, 'enc_conflux_pillars')).toEqual([
      [`${PILLAR}×2`], 1, { all: [bell(1, 2), { not: { item: { id: SEAL } } }, { not: { flag: FLAG_ENTERED_VIA_APEX } }] }, 'never', true, false, 'hold',
    ]);
    // R10-1: "the Before's day-scripted guards (Archives Day 2, Hall Day 3, Conflux)" hold
    expect(flat(section(WORLD, '### 10.0', '### 10.1'))).toContain("and the Before's day-scripted guards (Archives Day 2, Hall Day 3, Conflux). Not fleeable");
    // §10.5's three Before rows
    const forced = Object.fromEntries(tableRows(section(WORLD, '### 10.5 Forced-combat nodes', '### 10.6')).map((c) => [c[0], c]));
    expect(forced[CX]?.slice(1, 5)).toEqual([
      'cr_unbroken_warden (Day 3); cr_warding_pillar ×2 (Days 1–2, entering from the Archives stair only, W8)', 'boss / story gate', 'no `item_ward_seal`',
      'seal (Days 1–2); seal + Caelum active (Day 3); arrival through the Apex tear wakes no pillars',
    ]);
    expect(forced[NH]?.slice(1, 5)).toEqual(['cr_ninefold_knight', 'story gate', 'Day 3', 'enter on Days 1–2 with the seal or Caelum']);
    expect(forced[AD]?.slice(1, 5)).toEqual(['cr_warding_pillar', 'story gate', 'Day 2 without the seal', 'visit on Day 1 or 3']);
    // no wandering pool, so `safe` would say nothing more: no location sets it
    for (const l of parsedLocations) expect([l.id, l.safe]).toEqual([l.id, false]);
  });

  test('events: every WORLD event but the superseded Sundering, its text verbatim, WORLD’s Bell and grants; two `interact` options the documents describe', () => {
    for (const l of parsedLocations) {
      const got = Object.fromEntries(l.events.filter((e) => e.trigger === 'enter').map((e) => [e.id, e.text]));
      const expected = { ...WL[l.id]?.events };
      if (l.id === CX) delete expected['ev_conflux_sundering'];
      expect([l.id, got]).toEqual([l.id, expected]);
    }
    // D-083: "WORLD §3.11/§12.1 `ev_conflux_sundering` (sent home at Last Bell's dusk) is superseded … the echo resets to First Bell in place"
    expect(WL[CX]?.events['ev_conflux_sundering']).toBe('Veyran Thal steps forward into the light and does not step back. The bells stop. The floor is the sky. You are falling toward a door.');
    expect(fs.readFileSync(path.join(ROOT, 'docs/DECISIONS.md'), 'utf8')).toContain('`ev_conflux_sundering` (sent home at Last Bell\'s dusk) is superseded');
    const one = (l: string, id: string) => [ev(l, id).once, ev(l, id).when, ev(l, id).effects];
    // "once per entry": once per echo, guarded by a Before-local flag the fresh echo clears; arriving here is arriving
    expect(one(GT, 'ev_gate_whole')).toEqual([false, { not: { flag: 'flag_before_gate_whole' } }, [{ setFlag: 'flag_before_gate_whole' }, { setFlag: 'flag_visited_before' }]]);
    expect(WL[GT]?.block).toContain('— once per entry.');
    expect(one(OW, 'ev_walks_tablet')).toEqual([true, undefined, []]);
    expect(one(CO, 'ev_corridor_plaster')).toEqual([true, undefined, []]);
    expect(one(GL, 'ev_library_cradle')).toEqual([true, undefined, []]);
    expect(one(PB, 'ev_plaza_dance')).toEqual([true, bell(1), []]);
    expect(one(PB, 'ev_plaza_crack')).toEqual([true, bell(3), [{ grantEcho: 'echo_bells_of_silverwood' }]]);
    expect(STORY).toContain('| `echo_bells_of_silverwood` | The Bells | The Plaza of Bells on Last Bell |');
    // "Day 3 noon": D-098 (U34d) the echo's own hour, `watch: 'day'`
    expect(one(PB, 'ev_plaza_spire_yard')).toEqual([true, { all: [bell(3), { watch: 'day' }, { quest: { id: 'q_the_apprentices_errand', status: 'active' } }] }, [{ grantEcho: 'echo_litany_verse_5' }]]);
    expect(one(NH, 'ev_hall_veyran')).toEqual([true, bell(1), [{ grantEcho: 'echo_tyrant_name' }]]);
    expect(one(NH, 'ev_hall_study_draft')).toEqual([true, bell(2, 3), [{ grantEcho: 'echo_litany_verse_9' }]]);
    // U58: on the fourth failure the quest's scene follows (it grants `echo_ritual_inevitable`, STORY §12)
    expect(one(NH, 'ev_hall_masque_roof')).toEqual([true, bell(3), [{ onlyIf: { when: { quest: { id: 'q_stop_the_ritual', stage: 'masque' } }, effects: [{ startDialogue: 'scene_masque_roof' }] } }]]);
    expect(STORY).toContain('| `echo_ritual_inevitable` | Always Going to Fail | `q_stop_the_ritual` attempt 4 |');
    expect(one(AG, 'ev_garret_litany')).toEqual([true, undefined, [{ grantEcho: 'echo_litany_verse_2' }]]);
    expect(one(CG, 'ev_gardens_wheels')).toEqual([true, bell(2), []]);
    expect(one(AD, 'ev_archives_oriel')).toEqual([true, undefined, [{ grantEcho: 'echo_oriel_lineage' }]]);
    expect(one(CX, 'ev_conflux_well')).toEqual([true, undefined, [{ setFlag: 'flag_visited_before' }]]);
    // `flag_visited_before` is read by the Ruins' Plaza and the Apex, and set by nothing else
    expect(WORLD).toContain('`ev_plaza_bells_before` — "You have heard these bells with their roofs on. The memory is not yours yet. Then it is." — once, requires `{flag:"flag_visited_before"}`.');
    expect(pack.locations['loc_silverwood_plaza']?.events.find((e) => e.id === 'ev_plaza_bells_before')?.when).toEqual({ flag: 'flag_visited_before' });
    expect(pack.locations[APEX]?.events.find((e) => e.id === 'ev_apex_names')?.when).toEqual({ flag: 'flag_visited_before' });
    // the two options: the Library's "Loop 3+ option" and the Plaza's drawn weapon
    const options = parsedLocations.flatMap((l) => l.events.filter((e) => e.trigger === 'interact').map((e) => [l.id, e.id, e.label, e.once, e.when, e.effects]));
    const attempt = (scene: string) => ({ all: [{ quest: { id: 'q_stop_the_ritual', stage: 'try' } }, { not: { flag: `flag_scene_done_${scene}` } }] });
    expect(options).toEqual([
      [GL, 'ev_library_cradle_seed', 'Tell it what it will hear', true, { loop: { min: 3 } }, [{ grantEcho: 'echo_crystal_seeded' }]],
      [PB, 'ev_plaza_blade', 'Draw your weapon', false, undefined, [{ startCombat: 'enc_bells_watch' }]],
      // U58: `q_stop_the_ritual`'s third and fourth attempts (STORY §9.4), once a loop each
      [AD, 'ev_archives_fair_copy', 'Take the fair copy', false, attempt('scene_ritual_steal_record'), [{ startDialogue: 'scene_ritual_steal_record' }]],
      [CX, 'ev_conflux_cradle', 'Break the cradle', false, attempt('scene_ritual_break_cradle'), [{ startDialogue: 'scene_ritual_break_cradle' }]],
    ]);
    expect(WL[GL]?.block).toContain('— once; Loop 3+ option grants `echo_crystal_seeded`');
    expect(WL[PB]?.block).toContain('drawing a weapon here summons cr_city_watch_halberdier ×2 (non-lethal arrest)');
  });

  test('NPC placement: each NPC at the first place of WORLD’s Location cell; the ones WORLD moves by Bell or hour are not placed twice', () => {
    const rows = Object.fromEntries(tableRows(section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families')).map((c) => [unquote(c[0] ?? ''), c]));
    const homeOf = (id: string): string => /loc_[a-z_]+/.exec(rows[id]?.[3] ?? '')?.[0] ?? '';
    for (const l of parsedLocations) expect([l.id, l.npcs]).toEqual([l.id, (WL[l.id]?.npcIds ?? []).filter((n) => homeOf(n) === l.id)]);
    expect(loc(PB).npcs).toEqual(['npc_bellwright_anso', 'npc_corvin_dreyl']);
    expect(WL[PB]?.npcIds).toEqual(['npc_bellwright_anso', 'npc_corvin_dreyl', 'npc_caelum']); // Caelum: First Bell's bread, at home in the Garret
    expect(loc(NH).npcs).toEqual(['npc_veyran_thal', 'npc_nyxaria_vell_before', 'npc_haldric_vane', 'npc_hadrek', 'npc_tobrin_vask']);
    // the Conflux: Hallow at his forge; on Last Bell all nine stand at the plinths, non-interactive
    expect(loc(CX).npcs).toEqual(['npc_durn_hallow']);
    expect(WL[CX]?.npcIds).toHaveLength(9);
    expect(WL[CX]?.block).toContain('Day 3: all nine, non-interactive');
  });

  test('art: WORLD’s horizon per block; the city, the archive, the Hall’s sanctum and the Conflux’s cavern; Last Bell’s particles', () => {
    expect(parsedLocations.map((l) => [l.id, l.art.template, l.art.horizon])).toEqual([
      [GT, 'city', 0.55], [OW, 'city', 0.6], [CO, 'city', 0.68], [GL, 'archive', 0.7], [PB, 'city', 0.58],
      [NH, 'sanctum', 0.6], [AG, 'city', 0.66], [CG, 'city', 0.58], [AD, 'archive', 0.64], [CX, 'cavern', 0.5],
    ]);
    for (const l of parsedLocations) expect([l.id, l.art.horizon]).toEqual([l.id, WL[l.id]?.horizon]);
    // "(Day 3: blue flare)", "(Day 3: none)", "(Day 3: strobe to white)"
    expect([CO, PB, CX].map((id) => loc(id).art.variants)).toEqual([[{ when: bell(3), patch: { particles: 'static' } }], [{ when: bell(3), patch: { particles: 'none' } }], [{ when: bell(3), patch: { particles: 'static' } }]]);
    expect(WL[CO]?.block).toContain('particles: lamplight motes (Day 3: blue flare)');
    expect(WL[PB]?.block).toContain('particles: water spray (Day 3: none)');
    expect(WL[CX]?.block).toContain('particles: rising light streams (Day 3: strobe to white)');
    // the Anchor slot is PLAN §5.3's station kind; the engine finds the rim by the Conflux's id
    expect([loc(CX).craftingStation, CONFLUX_LOCATION_ID]).toEqual(['anchor', CX]);
  });
});

// ---- Map data (WORLD §11, §3.13, §10.3–10.4) ------------------------------------------------------------------------------------

describe('WORLD §11 map data, reachability and traversal', () => {
  test('§11.1 nodes: coordinates, band, rest, merchant, settlements (the Plaza and the Garret), all temporally unstable', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable]);
      const rest = l.rest === undefined ? '—' : l.rest.when === undefined ? l.rest.kind : 'cond';
      expect([l.id, rest, l.merchantId ?? '—']).toEqual([l.id, n?.rest, n?.merchant]);
      expect([l.id, l.tags.includes('settlement')]).toEqual([l.id, n?.settlement]);
    }
  });

  test('§11.2 edges: every walk edge of the region at 0 watches with its gate on both sides; the two portal edges are the doors’ exits (the Nexus and the Apex own the way in)', () => {
    const walks = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(walks).toHaveLength(10);
    for (const e of walks) {
      expect([e.from, e.to, here.has(e.from) && here.has(e.to)]).toEqual([e.from, e.to, true]);
      const exit = loc(e.from).exits.find((x) => x.to === e.to);
      expect([e.from, e.to, exit?.dir, exit?.travelWatches, exit?.when !== undefined]).toEqual([e.from, e.to, e.dir, e.cost, e.gate !== 'open']);
      const back = loc(e.to).exits.find((x) => x.to === e.from);
      expect([e.to, e.from, back?.dir, back?.travelWatches, back?.when !== undefined]).toEqual([e.to, e.from, e.reverseDir, e.reverseCost, e.reverseGate !== 'open']);
    }
    const portals = EDGES.filter((e) => e.kind === 'portal' && (here.has(e.from) || here.has(e.to)));
    expect(portals.map((e) => [e.from, e.to, e.dir, e.reverseDir, e.cost, e.reverseCost, e.gate, e.reverseGate])).toEqual([
      [NEXUS, GT, 'east', 'west', 0, 0, 'gate_breach_door', 'gate_breach_door_back'],
      [APEX, CX, 'through the tear', 'through the tear', 0, 0, 'gate_tyrant_tear', 'gate_tyrant_tear_back'],
    ]);
    // the way in is the Glowlands & Nexus unit's (U45); the way back is here
    expect(pack.locations[NEXUS]?.exits.find((x) => x.to === GT)).toMatchObject({ dir: 'east', travelWatches: 0, hidden: true, label: 'the Breach-door' });
    expect(pack.locations[APEX]?.exits.find((x) => x.to === CX)).toMatchObject({ dir: 'portal', travelWatches: 0, hidden: true, label: 'through the tear' });
    expect(loc(GT).exits.find((x) => x.to === NEXUS)?.dir).toBe('west');
    expect(loc(CX).exits.find((x) => x.to === APEX)?.dir).toBe('portal');
  });

  test('§11.3 gates: the Hall doors, the Conflux stair and the two doors back carry WORLD’s conditions (the Bell mirror flag read as the `beforeDay` atom)', () => {
    const gates = Object.fromEntries(tableRows(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).map((c) => [unquote(c[0] ?? ''), unquote(c[2] ?? '')]));
    const exit = (from: string, to: string) => loc(from).exits.find((e) => e.to === to)?.when;
    expect(gates['gate_hall_doors']).toBe('{any:[{flag:"flag_before_day_3"},{item:"item_ward_seal"},{companion:"caelum",state:"active"}]}');
    expect(exit(PB, NH)).toEqual(worldCondition(gates['gate_hall_doors'] ?? ''));
    expect(gates['gate_conflux_stair']).toBe('{any:[{flag:"flag_before_day_3"},{item:"item_ward_seal"}]}');
    expect(exit(AD, CX)).toEqual(worldCondition(gates['gate_conflux_stair'] ?? ''));
    expect(exit(GT, NEXUS)).toEqual(worldCondition(gates['gate_breach_door_back'] ?? ''));
    expect(exit(CX, APEX)).toEqual(worldCondition(gates['gate_tyrant_tear_back'] ?? ''));
    // the doors in are U45's, with WORLD's conditions
    expect(pack.locations[NEXUS]?.exits.find((x) => x.to === GT)?.when).toEqual(worldCondition(gates['gate_breach_door'] ?? ''));
    expect(pack.locations[APEX]?.exits.find((x) => x.to === CX)?.when).toEqual(worldCondition(gates['gate_tyrant_tear'] ?? ''));
    // DESIGN §10.1: "The engine mirrors the day into `flag_before_day_1..3` … conditions read it as `{ beforeDay: n }`"
    expect(flat(DESIGN)).toContain('The engine mirrors the day into `flag_before_day_1..3` for WORLD\'s world-state variants; conditions read it as `{ beforeDay: n }`');
  });

  test('the gates in play: the Hall opens on Last Bell, to the seal, or with Caelum beside you; the stair on Last Bell or to the seal', () => {
    const hall = loc(PB).exits.find((e) => e.to === NH)?.when as Condition;
    expect([holds(hall, PB, { day: 1 }), holds(hall, PB, { day: 3 }), holds(hall, PB, { day: 2, items: [SEAL] }), holds(hall, PB, { day: 1 }, true)]).toEqual([false, true, true, true]);
    const stair = loc(AD).exits.find((e) => e.to === CX)?.when as Condition;
    expect([holds(stair, AD, { day: 2 }), holds(stair, AD, { day: 3 }), holds(stair, AD, { day: 1, items: [SEAL] }), holds(stair, AD, { day: 2 }, true)]).toEqual([false, true, true, false]);
  });

  test('reachability (WORLD §3.13): the Before is reached only through its two doors, from Loop 2; every node is 7 watches from the Whispering Ruins, through the Nexus; the validator agrees', () => {
    // shortest watches from the Ruins over the exits `open` admits (relaxed until nothing shortens)
    const reach = (open: (when: Condition) => boolean): Map<string, number> => {
      const dist = new Map<string, number>([[WR, 0]]);
      for (let changed = true; changed; ) {
        changed = false;
        for (const [at, d] of [...dist]) {
          for (const exit of pack.locations[at]?.exits ?? []) {
            if (pack.locations[exit.to] === undefined || (exit.when !== undefined && !open(exit.when))) continue;
            const via = d + exit.travelWatches;
            if (via < (dist.get(exit.to) ?? Infinity)) (dist.set(exit.to, via), (changed = true));
          }
        }
      }
      return dist;
    };
    const any = reach(() => true);
    expect(ALL.map((id) => any.get(id))).toEqual(ALL.map(() => 7)); // the Nexus is 7 (D-094); the Before's edges cost nothing
    expect(any.get(NEXUS)).toBe(7);
    // with the doors shut (Loop 1, no Lens, the Tyrant not spared) no node of the Before is reachable
    const doorsShut = reach((when) => !JSON.stringify(when).includes('"loop":{"min":2}'));
    expect(ALL.some((id) => doorsShut.has(id))).toBe(false);
    expect(flat(WORLD)).toContain('| Silverwood Before | … Nexus ⟂ Silver Gate | Loop ≥ 2 + `item_chronos_lens` + `echo_litany_verse_1`; or Apex ⟂ Conflux with the Tyrant spared |');
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.warnings.filter((w) => w.rule === 'rule-08' && here.has(w.id))).toEqual([]);
    expect(validateContent(pack, { strict: false }).errors.filter((e) => e.rule === 'rule-08' && here.has(e.id))).toEqual([]);
  });

  test('§10.3 row: 10 nodes, no watches (moves 2 · +2 · 4 for the three through-routes), a sweep of 11 moves, the worst node 3 moves from the Garret, the only rest', () => {
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'silverwood_before') ?? [];
    expect(row.slice(1, 5)).toEqual(['13–17', '10', 'GT→OW→AG · OW→AD→CX · GT→CO→GL→PB→NH', '0 (moves: 2 · +2 · 4; the Before has no watches)']);
    const inside = new Map<string, string[]>(parsedLocations.map((l) => [l.id, l.exits.map((e) => e.to).filter((t) => here.has(t))]));
    const dist = (from: string): Map<string, number> => {
      const d = new Map<string, number>([[from, 0]]);
      const q = [from];
      for (let i = 0; i < q.length; i++) for (const t of inside.get(q[i] ?? '') ?? []) if (!d.has(t)) (d.set(t, (d.get(q[i] ?? '') ?? 0) + 1), q.push(t));
      return d;
    };
    expect([dist(GT).get(AG), dist(OW).get(CX), dist(GT).get(NH)]).toEqual([2, 2, 4]);
    // the sweep: the shortest walk from the Gate that visits every node (a breadth-first search over visited sets)
    const ordered = [...inside.keys()];
    const full = (1 << ordered.length) - 1;
    let frontier = new Set<string>([`0:${1 << 0}`]);
    const visited = new Set(frontier);
    let walk = 0;
    while (![...frontier].some((k) => Number(k.split(':')[1]) === full)) {
      const next = new Set<string>();
      for (const key of frontier) {
        const [at, mask] = key.split(':').map(Number) as [number, number];
        for (const to of inside.get(ordered[at] ?? '') ?? []) {
          const j = ordered.indexOf(to);
          const k = `${j}:${mask | (1 << j)}`;
          if (!visited.has(k)) (visited.add(k), next.add(k));
        }
      }
      frontier = next;
      walk += 1;
    }
    expect([ordered[0], walk, row[6]]).toEqual([GT, 11, '11']);
    expect(row[7]).toBe('day-scripted');
    expect(Math.max(...ALL.map((id) => dist(id).get(AG) ?? Infinity))).toBe(3);
    expect(row.slice(8)).toEqual(['3 (Before days, no clock)', 'AG camp']);
  });

  test('§10.4 row: the Knight is the elite (Hall, Last Bell); the forced nodes are the Conflux, the Hall and the Archives; no scatter node; the pacifist’s First Bell walk to the Plaza meets nothing; never infected', () => {
    const row = tableRows(section(WORLD, '### 10.4 Elites', '### 10.5')).find((c) => c[0] === 'silverwood_before') ?? [];
    expect(row.slice(1)).toEqual([
      'cr_ninefold_knight (NH, Day 3)', 'CX (Day 3 boss; Days 1–2 pillars from the stair), NH Day 3, AD Day 2', 'none', 'GT→OW→AG→PB on Day 1 (no encounters)', 'never infected (outside the Breach Clock)',
    ]);
    // First Bell, the pacifist's walk: no encounter can start at any of the four
    for (const id of [GT, OW, AG, PB]) for (const e of loc(id).encounters) expect([id, e.id, holds(e.when ?? { all: [] }, id, { day: 1 })]).toEqual([id, e.id, false]);
    expect(cr(KNIGHT).role).toBe('elite');
    expect(parsedLocations.filter((l) => l.encounters.some((e) => !e.fleeable)).map((l) => l.id)).toEqual([NH, AD, CX]);
  });

  test('§12.1 rows: the three Bells and `ws_wanted` are what the locations carry', () => {
    const rows = Object.fromEntries(tableRows(section(WORLD, '### 12.1', '### 12.2')).map((c) => [unquote(c[0] ?? ''), c]));
    expect(rows['ws_before_day_1']?.[4]).toBe('none, except CX pillars ×2 when entering from the Archives stair without the seal');
    expect(rows['ws_before_day_2']?.[4]).toBe('OW cr_ley_hound ×2 40%; AD cr_warding_pillar 100% without the seal; CX pillars as Day 1');
    expect(rows['ws_before_day_3']?.[4]).toBe('CO ley-flare (Burn), adept 50% if wanted; GL adepts 60%; OW hounds 40%; NH cr_ninefold_knight 100%; CX boss cr_unbroken_warden');
    expect(rows['ws_wanted']?.[2]).toBe('`{flag:"flag_wanted_in_silverwood"}` (weapon drawn at PB → arrest, wake at AG, lose a day)');
    expect(rows['ws_wanted']?.[4]).toBe('GT halberdiers ×2 (Day 3); CO adept 50%');
    expect(rows['ws_before_day_3']?.[5]).toContain('`gate_hall_doors`, `gate_conflux_stair` open');
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6.2, §6.4, §6.9', () => {
  const MINE = [HOUND, KNIGHT, WARDEN, HALBERDIER, ADEPT];

  test('exactly the creatures whose first region is the Before (D-090), in WORLD’s order; the Warding Pillar is Mistwood’s (U43)', () => {
    const first = Object.values(CREATURE_TABLE).filter((r) => /^Silverwood Before/.test(r.regions)).map((r) => r.id);
    expect([...first].sort()).toEqual([...MINE].sort());
    expect(creatures.map((c) => c.id)).toEqual(MINE);
    expect(CREATURE_TABLE[PILLAR]?.regions).toBe('Mistwood & Reach, Silverwood Before');
    expect(pack.creatures[PILLAR]?.name).toBe('Warding Pillar');
  });

  test('name, family, role, level and XP as WORLD’s table; XP follows DESIGN §6.2 (fodder round(20 + 8L + 1.2L²), elite ×1.8; the boss is hand-set 1,200); the Mortals’ family is `fam_mortal`', () => {
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      const family = row?.family === 'Mortal' ? 'fam_mortal' : row?.family;
      expect([c.id, row?.name.replace(/^The /, '') === c.name.replace(/^The /, ''), c.family, c.role, c.level, c.xp]).toEqual([c.id, true, family, row?.role, row?.level, row?.xp]);
    }
    const fodder = (L: number): number => Math.round(20 + 8 * L + 1.2 * L * L);
    for (const c of creatures) if (c.role !== 'boss') expect([c.id, c.xp]).toEqual([c.id, Math.round(fodder(c.level) * (c.role === 'elite' ? 1.8 : 1))]);
    expect([cr(WARDEN).level, cr(WARDEN).xp]).toEqual([region.levelBand.max + 2, 1200]);
    expect([CREATURE_TABLE[HALBERDIER]?.family, CREATURE_TABLE[ADEPT]?.family]).toEqual(['Mortal', 'Mortal']);
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK; the boss’s HP is 12 × (51.6 − 10 armor) = 499, WORLD prints 500 (D-067.20)', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
    expect(cr(WARDEN).stats).toEqual({ hp: 500, atk: 34, sp: 34, armor: 10, ward: 6, agi: 6 });
    expect(Math.round(12 * (51.6 - 10))).toBe(499);
    expect(WORLD).toContain('· Before (top 17, ATK 43) 51.6');
  });

  test('resistances and immunities as WORLD’s Resist line; constructs are Poison- and Bleed-immune; the Mortals’ statuses work normally; the boss is Stagger-able and cannot be fled', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      const kind = (which: string): string[] => Object.entries(c.resistances).filter(([, r]) => r === which).map(([t]) => t).sort();
      expect([c.id, kind('weak'), kind('resist'), [...c.statusImmunities].sort()]).toEqual([c.id, [...w.weak].sort(), [...w.resist].sort(), w.immune.map((s) => `status_${s}`).sort()]);
    }
    expect(parsedCreatures.map((c) => [c.id, c.statusImmunities])).toEqual([
      [HOUND, []], [KNIGHT, ['status_poison', 'status_bleed']], [WARDEN, ['status_poison', 'status_bleed', 'status_stun', 'status_slow']], [HALBERDIER, []], [ADEPT, []],
    ]);
    expect([KNIGHT, WARDEN].map((id) => cr(id).tags.includes('construct'))).toEqual([true, true]);
    expect(bullet(block(HALBERDIER), 'Resist:')).toBe('neutral to all · statuses work normally');
    expect(bullet(block(ADEPT), 'Resist:')).toBe('weak physical · resist ley · statuses work normally');
    expect([cr(WARDEN).interruptible, cr(WARDEN).fleeable, cr(WARDEN).tags]).toEqual([true, false, ['construct', 'regional_boss']]);
    expect(bullet(block(WARDEN), 'Resist:')).toContain('Stagger allowed');
    expect(block(WARDEN)).toContain('cannot be fled');
  });

  test('moves: exactly WORLD’s intent ids with their telegraph lines verbatim (the Gate Slam is WORLD’s id with a line written here); every move reached; telegraphs ≤ 12 words; aims', () => {
    for (const c of parsedCreatures) {
      const intents = worldCreature(c.id).intents;
      const own = c.id === WARDEN ? ['uw_gate_slam'] : [];
      expect([c.id, Object.keys(c.moves).filter((id) => !own.includes(id)).sort()]).toEqual([c.id, Object.keys(intents).sort()]);
      for (const [id, line] of Object.entries(intents)) expect([c.id, id, c.moves[id]?.line]).toEqual([c.id, id, line]);
      const used = new Set<string>();
      const visit = (s: Step) => void ('move' in s && used.add(s.move));
      walkSteps(c.pattern, [], visit);
      for (const ph of c.phases) walkSteps(ph.pattern, [], visit);
      for (const m of Object.values(c.moves)) if (m.windUp) used.add(m.windUp.then);
      expect([c.id, Object.keys(c.moves).filter((id) => !used.has(id))]).toEqual([c.id, []]);
      for (const m of Object.values(c.moves)) expect([c.id, m.line, words(m.line) <= 12]).toEqual([c.id, m.line, true]);
    }
    expect(block(WARDEN)).toContain('hidden wind-up, then `uw_gate_slam` 1.8× you · stun 50% 1');
    expect(cr(WARDEN).moves['uw_raise']).toMatchObject({ hidden: true, windUp: { turns: 1, then: 'uw_gate_slam' } });
    expect(cr(WARDEN).moves['uw_gate_slam']).toMatchObject({ line: 'The arms come down. The stair shuts like a gate.', hidden: true });
    const aims = (id: string): Record<string, string[]> => {
      const c = cr(id);
      const out: Record<string, Set<string>> = {};
      const visit = (s: Step) => void ('move' in s && (out[s.move] ??= new Set()).add(s.target ?? 'player'));
      walkSteps(c.pattern, [], visit);
      for (const ph of c.phases) walkSteps(ph.pattern, [], visit);
      return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
    };
    expect(aims(HOUND)).toEqual({ hound_bay: ['self'], hound_track: ['player'], hound_bite: ['player'], hound_ley_snap: ['player'] });
    expect(aims(KNIGHT)).toEqual({ knight_shield_up: ['self'], knight_bash: ['player'], knight_verse: ['player'], knight_cleave: ['player'] });
    expect(aims(WARDEN)).toEqual({
      uw_hold_the_gate: ['self'], uw_stone_stand: ['player'], uw_sweep: ['all'], uw_meet_what_comes: ['self'], uw_raise: ['player'], uw_last_order: ['all'], uw_break: ['player'],
    });
    expect(aims(HALBERDIER)).toEqual({ watch_halt: ['player'], watch_whistle: ['self'], watch_hook: ['player'], watch_haft: ['player'] });
    expect(aims(ADEPT)).toEqual({ adept_ward: ['self'], adept_pyre: ['player'], adept_seal: ['player'], adept_ley_dart: ['player'] });
  });

  test('moves carry WORLD’s numbers: the multiplier and stat, type, statuses and their chances, shields, the riposte, the summon, the Phase 3 Haste', () => {
    const m = (c: string, id: string) => cr(c).moves[id];
    const hit = (c: string, id: string) => [m(c, id)?.type, m(c, id)?.power?.coef, m(c, id)?.power?.stat];
    const rows = (c: string, id: string) => m(c, id)?.statuses.map((s) => [s.status.slice('status_'.length), s.chance, s.duration, s.target]);
    expect(rows(HOUND, 'hound_bay')).toEqual([['haste', 1, 2, 'all_allies']]); // "haste self and ally 2"
    expect(m(HOUND, 'hound_bay')?.power).toBeUndefined();
    expect(hit(HOUND, 'hound_bite')).toEqual(['physical', 1.1, 'atk']);
    expect(rows(HOUND, 'hound_bite')).toEqual([['bleed', 0.4, 3, 'target']]);
    expect(hit(HOUND, 'hound_ley_snap')).toEqual(['ley', 1.2, 'sp']);
    expect(rows(HOUND, 'hound_ley_snap')).toEqual([['shock', 0.3, 2, 'target']]);
    expect(rows(HOUND, 'hound_track')).toEqual([['mark', 1, 3, 'target']]);
    expect(m(KNIGHT, 'knight_shield_up')?.shield?.power).toEqual({ base: 0, coef: 1.5, stat: 'atk', hits: 1 });
    expect(hit(KNIGHT, 'knight_cleave')).toEqual(['physical', 1.3, 'atk']);
    expect(rows(KNIGHT, 'knight_cleave')).toEqual([['bleed', 0.4, 3, 'target']]);
    expect(hit(KNIGHT, 'knight_bash')).toEqual(['physical', 0.9, 'atk']);
    expect(rows(KNIGHT, 'knight_bash')).toEqual([['stun', 0.3, 1, 'target']]);
    expect(rows(KNIGHT, 'knight_verse')).toEqual([['weaken', 0.6, 2, 'target'], ['armor_break', 0.4, 2, 'target']]);
    expect(m(WARDEN, 'uw_hold_the_gate')?.shield?.power).toEqual({ base: 0, coef: 1.5, stat: 'atk', hits: 1 });
    expect(hit(WARDEN, 'uw_stone_stand')).toEqual(['physical', 1.2, 'atk']);
    expect(rows(WARDEN, 'uw_stone_stand')).toEqual([['armor_break', 0.4, 3, 'target']]);
    expect(hit(WARDEN, 'uw_sweep')).toEqual(['physical', 0.9, 'atk']);
    expect(m(WARDEN, 'uw_meet_what_comes')?.riposte).toEqual({ power: { base: 0, coef: 1, stat: 'atk', hits: 1 }, turns: 1 });
    expect(hit(WARDEN, 'uw_gate_slam')).toEqual(['physical', 1.8, 'atk']);
    expect(rows(WARDEN, 'uw_gate_slam')).toEqual([['stun', 0.5, 1, 'target']]);
    // Phase 3's "Haste self every turn" rides on its own two moves (the header's reading)
    expect(hit(WARDEN, 'uw_break')).toEqual(['physical', 1.5, 'atk']);
    expect(rows(WARDEN, 'uw_break')).toEqual([['haste', 1, 2, 'self']]);
    expect(hit(WARDEN, 'uw_last_order')).toEqual(['physical', 1, 'atk']);
    expect(rows(WARDEN, 'uw_last_order')).toEqual([['weaken', 0.5, 2, 'target'], ['haste', 1, 2, 'self']]);
    expect(rows(WARDEN, 'uw_sweep')).toEqual([]);
    expect(hit(HALBERDIER, 'watch_halt')).toEqual(['physical', 0.6, 'atk']);
    expect(rows(HALBERDIER, 'watch_halt')).toEqual([['slow', 0.6, 2, 'target']]);
    expect(hit(HALBERDIER, 'watch_hook')).toEqual(['physical', 1, 'atk']);
    expect(rows(HALBERDIER, 'watch_hook')).toEqual([['stun', 0.25, 1, 'target']]);
    expect(hit(HALBERDIER, 'watch_haft')).toEqual(['physical', 1.2, 'atk']);
    expect(m(HALBERDIER, 'watch_whistle')?.summon).toEqual({ creatureId: HALBERDIER, count: 1, max: 2, hpPct: 1 });
    expect(hit(ADEPT, 'adept_ley_dart')).toEqual(['ley', 1, 'sp']);
    expect(m(ADEPT, 'adept_ward')?.shield?.power).toEqual({ base: 0, coef: 1.2, stat: 'atk', hits: 1 });
    expect(hit(ADEPT, 'adept_pyre')).toEqual(['fire', 1.2, 'sp']);
    expect(rows(ADEPT, 'adept_pyre')).toEqual([['burn', 0.5, 3, 'target']]);
    expect(hit(ADEPT, 'adept_seal')).toEqual(['ley', 0.5, 'sp']);
    expect(rows(ADEPT, 'adept_seal')).toEqual([['stun', 0.3, 1, 'target']]);
  });

  test('loot: gold ranges and every item WORLD lists, with WORLD’s chances and counts (100 % = guaranteed); beating the Watch sets the wanted flag', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      const text = bullet(block(c.id), 'Loot:');
      const expected = [...text.matchAll(/`((?:item|mat)_[a-z0-9_]+)`†?(?: ×(\d+))? (\d+)%/g)].map((x) => [x[1], Number(x[2] ?? 1), Number(x[3]) / 100]);
      expect([c.id, c.loot.map((l) => [l.itemId, l.count, l.chance])]).toEqual([c.id, expected]);
      for (const l of c.loot) expect([c.id, l.when]).toEqual([c.id, undefined]);
    }
    expect(bullet(block(KNIGHT), 'Loot:')).toContain('`item_pattern_breachsteel_blade` 100% on the first kill (§7)');
    expect(bullet(block(WARDEN), 'Loot:')).toContain('(`item_breach_anchor_schematic_b` lies on Tobrin\'s plinth afterward, WORLD §3.11)');
    expect(bullet(block(HALBERDIER), 'Loot:')).toContain('beating them sets `flag_wanted_in_silverwood`');
    expect(cr(HALBERDIER).onDefeat).toEqual([{ setFlag: FLAG_WANTED_IN_SILVERWOOD }]);
    for (const c of parsedCreatures) if (c.id !== HALBERDIER) expect([c.id, c.onDefeat]).toEqual([c.id, []]);
    // gold [3 + 2L, 6 + 3L], elite ×2 (DESIGN §6.5); the boss's WORLD figure
    expect(parsedCreatures.map((c) => [c.id, c.gold.min, c.gold.max])).toEqual([[HOUND, 29, 45], [KNIGHT, 66, 102], [WARDEN, 195, 300], [HALBERDIER, 29, 45], [ADEPT, 31, 48]]);
  });

  test('bestiary voice, entry and tactics are WORLD’s text verbatim; Wilds and Wards codex entries, none for the Mortals (a portrait, no sigil); reveals at 1 and 3 kills; short descriptions', () => {
    for (const c of parsedCreatures) {
      const b = block(c.id);
      expect([c.id, c.bestiary.voice]).toEqual([c.id, worldCreature(c.id).voice]);
      expect([c.id, c.bestiary.summary]).toEqual([c.id, playText(bullet(b, 'Bestiary'))]);
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, playText(bullet(b, 'Tactics:'))]);
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
      expect([c.id, c.legacyName, /- \*\*Legacy description:\*\*/.test(b)]).toEqual([c.id, undefined, false]);
      expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
    }
    expect(parsedCreatures.map((c) => [c.id, c.bestiary.codexId, c.sigil.base])).toEqual([
      [HOUND, 'codex_creatures_wilds', 'triangle'], [KNIGHT, 'codex_creatures_wards', 'hexagon'], [WARDEN, 'codex_creatures_wards', 'hexagon'],
      [HALBERDIER, undefined, 'portrait'], [ADEPT, undefined, 'portrait'],
    ]);
    expect(STORY).toContain('| `codex_creatures_wards` |');
    expect(section(WORLD, '## 5. Creature families', '## 6. Creatures')).toContain('| *(Mortals)* | People | Silverwood\'s Watch and the Circle\'s adepts (the Before); Weaver sentries (the Veil) | No sigil; a portrait |');
  });
});

// ---- Patterns, walked by the engine ------------------------------------------------------------------------------------------

/** WORLD's cadence words, turn by turn: the moves `id` commits to (by `generateIntent`), its phase, HP, statuses and allies set per turn. */
function plan(
  id: string,
  turns: number,
  o: {
    phase?: number;
    allies?: readonly { creatureId: string; count: number }[];
    before?: (turn: number, foe: Combatant, combat: CombatState) => void;
  } = {},
): string[] {
  const profile = freshProfile();
  const s = makeState({ level: 15 }, { content: epack, profile });
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1), ...Array.from({ length: 8 }, (_, i) => D.d4((i % 4) + 1))], epack, profile);
  const groups = [{ creatureId: id, count: 1 }, ...(o.allies ?? [])];
  const combat = beginCombat(ctx, { id: 'enc_test', groups, fleeable: false, onFlee: 'hold', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] } satisfies EncounterSpec);
  const foe = combat.enemies[0] as Combatant;
  if (o.phase !== undefined) Object.assign(foe, { phase: o.phase });
  foe.pattern.pointer = 0;
  foe.pattern.turnsTaken = 0;
  const out: string[] = [];
  for (let turn = 1; turn <= turns; turn++) {
    combat.round = turn;
    o.before?.(turn, foe, ctx.s.combat as CombatState);
    const intent = generateIntent(ctx, combat, foe);
    const mv = intent ? epack.creatures[id]?.moves[intent.moveId] : undefined;
    out.push(intent?.moveId.replace(/^(hound|knight|uw|watch|adept)_/, '') ?? '—');
    if (mv?.windUp && !Object.keys(foe.cooldowns).some((k) => k.startsWith('windup:'))) foe.cooldowns[`windup:${intent?.moveId}`] = mv.windUp.turns + 1;
    for (const k of Object.keys(foe.cooldowns)) if (k.startsWith('windup:') && (foe.cooldowns[k] = (foe.cooldowns[k] ?? 0) - 1) <= 0) delete foe.cooldowns[k];
    foe.pattern.turnsTaken += 1;
  }
  return out;
}
const seq = (s: string): string[] => s.split(' ');
const withStatus = (c: Combatant, statusId: string, on: boolean): void => {
  c.statuses = c.statuses.filter((st) => st.statusId !== statusId);
  if (on) c.statuses.push({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false });
};
const player = (combat: CombatState): Combatant => combat.party[0] as Combatant;
const alliesDown = (from: number) => (t: number, f: Combatant, c: CombatState): void => {
  for (const e of c.enemies) if (e !== f) e.alive = t < from;
};

describe('patterns: WORLD’s cadence words hold turn by turn (first-match on every turn; two cycled moves alternate)', () => {
  test('the Ley Hound: Bay first; Track beside its pair while you are not Marked; else Bite and Ley Snap in turn', () => {
    const pair = [{ creatureId: HOUND, count: 1 }];
    // the Track lands (Marked turns 3–4), falls off and comes again on turn 5 (Marked once more on turn 6, the pair keeps its turn)
    expect(plan(HOUND, 6, { allies: pair, before: (t, _f, c) => withStatus(player(c), 'status_mark', t === 3 || t === 4 || t === 6) })).toEqual(seq('bay track bite ley_snap track ley_snap'));
    // alone, or once its pair is down, it only bites
    expect(plan(HOUND, 5)).toEqual(seq('bay ley_snap bite ley_snap bite'));
    expect(plan(HOUND, 5, { allies: pair, before: (t, f, c) => { alliesDown(3)(t, f, c); withStatus(player(c), 'status_mark', false); } })).toEqual(seq('bay track bite ley_snap bite'));
  });

  test('the Ninefold Knight: Shield Up first; the Bash while its Shield holds; the Verse every third turn; else the Cleave', () => {
    expect(plan(KNIGHT, 7)).toEqual(seq('shield_up cleave verse cleave cleave verse cleave'));
    // behind the shield (turns 2–3) it bashes, even on the Verse's turn; one Void hit and it is a Cleave again
    expect(plan(KNIGHT, 7, { before: (t, f) => withStatus(f, 'status_shield', t === 2 || t === 3) })).toEqual(seq('shield_up bash bash cleave cleave verse cleave'));
  });

  test('the City Watch Halberdier: Halt first; the Whistle once when its partner falls; else Hook and Haft in turn', () => {
    const pair = [{ creatureId: HALBERDIER, count: 1 }];
    expect(plan(HALBERDIER, 5, { allies: pair })).toEqual(seq('halt haft hook haft hook'));
    expect(plan(HALBERDIER, 6, { allies: pair, before: alliesDown(3) })).toEqual(seq('halt haft whistle haft hook haft'));
  });

  test('the Circle Adept: the Ward beside an ally while its own Shield is down; the Pyre every third turn, the Seal every fourth; else the Ley Dart', () => {
    expect(plan(ADEPT, 12)).toEqual(seq('ley_dart ley_dart pyre seal ley_dart pyre ley_dart seal pyre ley_dart ley_dart pyre'));
    const pair = [{ creatureId: ADEPT, count: 1 }];
    // the Ward on turn 1; its Shield holds through turn 3, so the cadence plays; down again on turn 4, it wards again
    expect(plan(ADEPT, 6, { allies: pair, before: (t, f) => withStatus(f, 'status_shield', t === 2 || t === 3) })).toEqual(seq('ward ley_dart pyre ward ward ward'));
  });

  test('the Unbroken Warden, Phase 1 — Keep the Line: Hold the Gate first, then Stone Stand and Sweep in turn', () => {
    expect(plan(WARDEN, 6, { phase: 0 })).toEqual(seq('hold_the_gate sweep stone_stand sweep stone_stand sweep'));
  });

  test('the Unbroken Warden, Phase 2 — Without Fear: Meet What Comes on every second turn, the hidden Raise on every third and the Gate Slam on the next; else Stone Stand', () => {
    expect(plan(WARDEN, 8, { phase: 1 })).toEqual(seq('stone_stand meet_what_comes raise gate_slam stone_stand meet_what_comes stone_stand meet_what_comes'));
  });

  test('the Unbroken Warden, Phase 3 — The Last Order: The Last Order on every third turn; else Break and Sweep in turn', () => {
    expect(plan(WARDEN, 7, { phase: 2 })).toEqual(seq('break sweep last_order sweep break last_order break'));
  });

  test('the Warden’s phases: ids, names, triggers (65 %, 30 %), WORLD’s transition lines; two pillars come with Phase 1; Phase 3 takes 1.24× (armor 0)', () => {
    const w = cr(WARDEN);
    expect(w.phases.map((p) => [p.id, p.name, p.enterWhen])).toEqual([
      ['uw_keep_the_line', 'Keep the Line', []],
      ['uw_without_fear', 'Without Fear', [{ hpBelow: 0.65 }]],
      ['uw_the_last_order', 'The Last Order', [{ hpBelow: 0.3 }]],
    ]);
    const W = flat(block(WARDEN));
    expect(W).toContain('**Phase 1 — Keep the Line** (100–65%; onEnter: 2× `cr_warding_pillar`)');
    expect(W).toContain('**Phase 2 — Without Fear** (<65%)');
    expect(W).toContain('**Phase 3 — The Last Order** (<30%; armor 0; Haste self every turn)');
    expect(W).toContain(`*Transition (<65%):* "${w.phases[1]?.line}"`);
    expect(W).toContain(`*Transition (<30%):* "${w.phases[2]?.line}"`);
    expect(w.phases[0]?.line).toBeUndefined();
    expect(w.phases.map((p) => p.adds)).toEqual([[{ creatureId: PILLAR, count: 2, hpPct: 1 }], [], []]);
    // U46's reading for Ashmaw: D-067.20's reference arithmetic inverted. 51.6 a round against armor 10 is 41.6; 51.6 / 41.6 = 1.24
    expect(w.phases.map((p) => p.damageTakenMult)).toEqual([1, 1, 1.24]);
    expect(Math.round((51.6 / (51.6 - w.stats.armor)) * 100) / 100).toBe(1.24);
  });
});

// ---- The NPCs ---------------------------------------------------------------------------------------------------------------

describe('the NPCs vs WORLD §4', () => {
  const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
  const rows = Object.fromEntries(tableRows(S4).filter((c) => unquote(c[0] ?? '').startsWith('npc_')).map((c) => [unquote(c[0] ?? ''), c]));
  const home = (c: string[]): string => /loc_[a-z_]+/.exec(c[3] ?? '')?.[0] ?? '';

  test('exactly the NPCs whose home is in the region, in WORLD’s order: Caelum, all nine of the Circle, and the six who were not of the Nine (D-063)', () => {
    const homes = Object.values(rows).filter((c) => here.has(home(c))).map((c) => unquote(c[0] ?? ''));
    expect(npcs.map((n) => n.id)).toEqual(homes);
    expect(homes).toHaveLength(16);
    for (const n of npcs) expect([n.id, n.homeLocationId]).toEqual([n.id, home(rows[n.id] ?? [])]);
    // the Nine are STORY's (D-063): every one of them is here
    const nine = ['npc_veyran_thal', 'npc_nyxaria_vell_before', 'npc_oriel_danthe', 'npc_maelis_korr', 'npc_haldric_vane', 'npc_durn_hallow', 'npc_seraphine_aulde', 'npc_imre_sallow', 'npc_tovren_masque'];
    expect(npcs.filter((n) => n.tags?.includes('ninefold_circle')).map((n) => n.id).sort()).toEqual([...nine].sort());
    for (const id of nine) expect(fs.readFileSync(path.join(ROOT, 'docs/BIBLE.md'), 'utf8')).toContain(`\`${id}\``);
  });

  test('names (STORY’s, as WORLD’s Name column), the neutral faction, the sample lines verbatim, portraits, ages', () => {
    for (const n of npcs) {
      const row = rows[n.id] ?? [];
      expect([n.id, (row[1] ?? '').startsWith(n.name)]).toEqual([n.id, true]);
      expect([n.id, n.factionId, (row[2] ?? '').startsWith('—')]).toEqual([n.id, 'neutral', true]);
      expect(n.barks).toHaveLength(2);
      for (const b of n.barks ?? []) expect([n.id, (row[6] ?? '').includes(`"${b.text}"`)]).toEqual([n.id, true]);
      expect([n.id, 'legacyName' in n]).toEqual([n.id, false]);
      expect([n.id, n.portrait]).toEqual([n.id, { sigil: n.id === 'npc_caelum' ? 'caelum' : n.id.slice('npc_'.length) }]);
    }
    // "Nyxaria Vell (young)": the disambiguation is WORLD's, not her name; the present-day Nyx is `npc_nyx` (U44)
    expect([rows['npc_nyxaria_vell_before']?.[1], byId(npcs, 'npc_nyxaria_vell_before').name]).toEqual(['Nyxaria Vell (young)', 'Nyxaria Vell']);
    expect(npcs.filter((n) => n.age !== undefined).map((n) => [n.id, n.age])).toEqual([['npc_caelum', 16], ['npc_nyxaria_vell_before', 30]]);
    expect(rows['npc_caelum']?.[5]).toContain('~16');
    expect(rows['npc_nyxaria_vell_before']?.[5]).toContain('~30');
  });

  test('descriptions are the row’s cell made into sentences', () => {
    const cell = (id: string) => rows[id]?.[5];
    const desc = (id: string) => byId(npcs, id).description;
    const pairs: [string, string, string][] = [
      ['npc_caelum', "Veyran's errand-boy, ~16, unanchored by the Breach's first breath. The only one in the Before who remembers you.", "Veyran's errand-boy, unanchored by the Breach's first breath. The only one in the Before who remembers you."],
      ['npc_bryn_dunn', 'Gate-captain under Captain Corvin Dreyl. Takes the Wayfinder for a foreign scholar. Renamed from Hesper Dunn (C-52: the first name repeated the second Wayfinder\'s; STORY §3.3 names her Bryn).', 'Gate-captain under Captain Corvin Dreyl. She takes the Wayfinder for a foreign scholar.'],
      ['npc_bellwright_anso', "Casts the Plaza's nine bells and sells charms beneath them.", "The bellwright who casts the Plaza's nine bells and sells charms beneath them."],
      ['npc_veyran_thal', 'Leader of the Nine, whole. Kind to apprentices, certain a mind large enough can hold anything.', 'Leader of the Nine, whole. Kind to apprentices, certain a mind large enough can hold anything.'],
      ['npc_nyxaria_vell_before', 'Youngest of the Nine, ~30, eyes still ordinary. The only one who looks at you twice.', 'Youngest of the Nine, eyes still ordinary. The only one who looks at you twice.'],
      ['npc_oriel_danthe', "The Circle's archivist, writing the Litany in fair copy in case. Ilyra's hands.", "The Circle's archivist, writing the Litany in fair copy in case. She has Ilyra's hands."],
      ['npc_maelis_korr', 'Author of the Dark Spellbooks; annotates an uncharred workbook while his students listen.', 'Author of the Dark Spellbooks. He annotates an uncharred workbook while his students listen.'],
      ['npc_haldric_vane', 'The Warder. Trusts stone over people.', 'The Warder. He trusts stone over people.'],
      ['npc_durn_hallow', 'The Circle\'s smith, fitting the iron cradle. The one who will say "Stop."', 'The Circle\'s smith, fitting the iron cradle. The one who will say "Stop."'],
      ['npc_seraphine_aulde', 'The Spire-builder. Loves one note above all others.', 'The Spire-builder. She loves one note above all others.'],
      ['npc_imre_sallow', 'Life-mage and gardener; agreed only if the overflow went to living things.', 'Life-mage and gardener. She agreed only if the overflow went to living things.'],
      ['npc_tovren_masque', 'Astronomer. Has read the sky twice, and it said no.', 'Astronomer. He has read the sky twice, and it said no.'],
      ['npc_tobrin_vask', "Haldric Vane's apprentice ward-engineer; keeps the failsafe's second half.", "Haldric Vane's apprentice ward-engineer, who keeps the failsafe's second half."],
      ['npc_corvin_dreyl', "Captain of the Silverwood Watch. His pyre-ward, built to Vane's design, will turn outward and burn the Steppe.", "Captain of the Silverwood Watch. His pyre-ward, built to Vane's design, will turn outward and burn the Steppe."],
      ['npc_ilsabet_rhune', "Checks every sluice-wheel twice and does not sleep. Will open the cisterns to drown the Conflux's fire.", "She checks every sluice-wheel twice and does not sleep. She will open the cisterns to drown the Conflux's fire."],
      ['npc_hadrek', "Tovren Masque's orrery-maker.", "Tovren Masque's orrery-maker."],
    ];
    expect(pairs.map(([id]) => id)).toEqual(npcs.map((n) => n.id));
    for (const [id, worldCell, ours] of pairs) expect([id, cell(id), desc(id)]).toEqual([id, worldCell, ours]);
  });

  test('roles: Caelum the companion and questgiver (D-088’s handshake), the gate-captain a keeper, Anso the merchant; every other one carries a beat (lore)', () => {
    expect(npcs.map((n) => [n.id, n.roles])).toEqual(npcs.map((n) => [n.id, n.id === 'npc_caelum' ? ['companion', 'questgiver'] : n.id === 'npc_bryn_dunn' ? ['keeper'] : n.id === 'npc_bellwright_anso' ? ['merchant'] : ['lore']]));
    const caelum = byId(npcs, 'npc_caelum');
    expect(caelum.companionId).toBe('caelum');
    expect(companions.find((c) => c.id === 'caelum')?.npcId).toBe('npc_caelum');
    expect(caelum.portrait).toEqual(companions.find((c) => c.id === 'caelum')?.portrait);
    expect(rows['npc_caelum']?.[4]).toBe('companion anchor `caelum`; quest giver (Caelum arc)');
    expect(rows['npc_bryn_dunn']?.[4]).toContain('gatekeeper');
    expect(byId(npcs, 'npc_bellwright_anso').merchantId).toBe('npc_bellwright_anso');
    expect(rows['npc_bellwright_anso']?.[4]).toBe('merchant (charms, bell-bronze, honeycake)');
    for (const n of npcs) if (n.id !== 'npc_bellwright_anso') expect([n.id, n.merchantId]).toEqual([n.id, undefined]);
    for (const n of npcs) if (!['npc_caelum', 'npc_bryn_dunn', 'npc_bellwright_anso'].includes(n.id)) expect([n.id, (rows[n.id]?.[4] ?? '').startsWith('flavor')]).toEqual([n.id, true]);
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder after Glowlands & Nexus and before the Drowned Reach (WORLD §2 order); the tables are in `contentTables` and the index', () => {
    const folders = REGION_FOLDERS.map((f) => f.region.id);
    expect(folders).toContain(REGION);
    expect(folders.indexOf('region_glowlands_nexus')).toBeLessThan(folders.indexOf(REGION));
    expect(folders.indexOf(REGION)).toBeLessThan(folders.indexOf('region_drowned_reach'));
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('Silverwood Before');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.name).toBe(c.name);
    for (const n of npcs) expect(pack.npcs[n.id]?.name).toBe(n.name);
    expect(items).toEqual([]);
    // a new region: no legacy location, creature or NPC (legacy.test.ts's LANDED gains nothing)
    for (const id of mine) expect([id, id in LEGACY_LOCATIONS || id in LEGACY_CREATURES || id in LEGACY_NPCS]).toEqual([id, false]);
  });

  test('validates with 0 errors; the real warnings are the Warding Pillar’s two out-of-band placements (WORLD’s, rule 11); pending references name only tables still being authored', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const about = report.warnings.filter((w) => mine.has(w.id) || locations.some((l) => w.message.includes(` ${l.id}`)));
    const real = about.filter((w) => !w.message.startsWith('pending — content not yet authored'));
    // U43's L6 Warding Pillar guards the Archives (band 14–15) and the Conflux stair (16–17): WORLD §3.11 places it there
    expect(real.map((w) => `${w.rule} ${w.id} ${w.path} ${/loc_[a-z_]+/.exec(w.message)?.[0]}`).sort()).toEqual([`rule-11 ${PILLAR} level ${AD}`, `rule-11 ${PILLAR} level ${CX}`]);
    for (const w of about.filter((x) => x.message.startsWith('pending — content not yet authored (reference): '))) {
      const table = /not found in ([a-z]+)$/.exec(w.message)?.[1];
      expect([w.message, INCOMPLETE_TABLES.includes(table as (typeof INCOMPLETE_TABLES)[number])]).toEqual([w.message, true]);
    }
    // the region's flags raise nothing: the door flags and the wanted flag are the engine's (ENGINE_WRITTEN_FLAGS), the rest are set here
    expect(report.warnings.filter((w) => w.rule === 'rule-02' && !w.message.startsWith('pending') && (here.has(w.id) || w.message.includes('flag_visited_before')))).toEqual([]);
  });

  test('`npm run validate`: exit 0, 0 errors', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/ regions \d+ · locations \d+ · creatures \d+ · /);
    expect(text).toMatch(/validate: ok — 0 errors, \d+ warning\(s\), \d+ pending completeness check\(s\), \d+ pending reference\(s\)/);
  });

  test('this region’s pending references name only ids WORLD/STORY/DESIGN spell (items, quests, Echoes, the companion, the merchant, codex entries); the Nexus, the Apex and the Pillar resolve', () => {
    const { report } = parseContentPack(contentTables);
    const targets = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    // Later units resolve these one by one (items U49/U50, quests and scenes U52–U59, Echoes, codex, the companions U56): the list may only shrink
    const known = new Set([
      'item_silverwood_honeycake', 'item_korrs_marginalia', 'item_ward_seal', 'item_remnant_ink', 'item_bell_shard', 'item_orrery_key', 'item_caelums_anchor_token',
      'item_cistern_key', 'item_litany_page_3', 'item_oriels_quill', 'item_breach_anchor_schematic_b', 'item_chronal_dust', 'item_pattern_breachsteel_blade',
      'item_pattern_breachwarden_mail',
      'mat_silverwood_heartwood', 'mat_ley_spark', 'mat_wildling_hide', 'mat_slate_core', 'mat_iron_rivet',
      'q_the_apprentices_errand', 'q_the_mending',
      'echo_hadrek_clockwright', 'echo_rhune_choice', 'echo_oriel_lineage', 'echo_vask_seal', 'echo_crystal_seeded', 'echo_bells_of_silverwood', 'echo_litany_verse_5',
      'echo_tyrant_name', 'echo_litany_verse_9', 'echo_litany_verse_2',
      'caelum', // the companion record (D-088: registered by U56)
      'npc_bellwright_anso', // the merchant record (WORLD §9)
      'remnants', // the faction record (the marginalia's Trusted)
      'codex_region_silverwood_before', 'codex_creatures_wilds', 'codex_creatures_wards',
    ]);
    expect([...targets].filter((t) => !known.has(t)).sort()).toEqual([]);
    for (const t of [NEXUS, APEX, PILLAR, 'item_mana_bloom']) expect([t, targets.has(t)]).toEqual([t, false]);
    const docs = `${WORLD}\n${STORY}\n${DESIGN}`;
    for (const id of targets) expect([id, docs.includes(id)]).toEqual([id, true]);
  });
});

// ---- The Before in the engine (the real pack, with three item stand-ins) -----------------------------------------------------------

describe('Silverwood Before in the engine (before.ts on the real pack, seeded)', () => {
  /** Loop 2 at the Nexus with the Lens and the first verse: the Breach-door shows. */
  const atNexus = (o: At = {}): Run => start(NEXUS, { items: [LENS], echoes: ['echo_litany_verse_1'], visited: [NEXUS], ...o });

  test('the Breach-door (U45’s exit, WORLD §11.3): Loop 2 with the Lens and the first verse; Loop 1, or without either, it does not show', () => {
    expect(movesOf(atNexus())).toContain(GT);
    expect(movesOf(atNexus({ items: [] }))).not.toContain(GT);
    expect(movesOf(atNexus({ echoes: [] }))).not.toContain(GT);
    expect(movesOf(atNexus({ loop: 1 }))).not.toContain(GT);
  });

  test('entering: the Silver Gate on First Bell, the Breach Clock frozen, the door flag, the gate’s event once per echo, `flag_visited_before`; the walk is free and the door back shows', () => {
    const r0 = atNexus();
    const r = act(r0, move(GT));
    expect(r.s.world.currentLocationId).toBe(GT);
    expect([r.s.before, r.s.clock.frozen, r.s.clock.ticks - r0.s.clock.ticks]).toEqual([{ day: 1, resets: 0 }, true, 0]);
    expect(r.s.flags).toMatchObject({ [FLAG_ENTERED_VIA_NEXUS]: true, flag_before_day_1: true, flag_before_gate_whole: true, flag_visited_before: true });
    expect(ofType(r.last, 'eventFired').map((e) => e.eventId)).toEqual(['ev_gate_whole']);
    expect(ofType(r.last, 'log').map((e) => e.text)).toContain(BEFORE_TEXT.enter);
    expect([r.s.mode, r.s.combat]).toEqual(['explore', null]); // the Watch is present, not hostile
    expect(movesOf(r)).toEqual([CO, NEXUS, OW].sort());
    // walking back to the gate in the same echo: the event does not fire again
    const back = run(r, [move(OW), move(GT)]);
    expect(ofType(back.last, 'eventFired')).toEqual([]);
    expect(back.s.clock.ticks).toBe(r0.s.clock.ticks);
  });

  test('a day: the Garret’s full rest is the next Bell (Second, then Last); on Last Bell it brings the dusk and the echo resets to First Bell, Before-local flags forgotten', () => {
    let r = run(atNexus(), [move(GT), move(OW), move(AG)]);
    expect(r.s.before?.day).toBe(1);
    expect(ofType(r.last, 'eventFired').map((e) => e.eventId)).toEqual(['ev_garret_litany']);
    const ticks = r.s.clock.ticks;
    r = act(r, FULL);
    expect([r.s.before?.day, r.s.flags['flag_before_day_2'], r.s.flags['flag_before_day_1']]).toEqual([2, true, undefined]);
    expect(ofType(r.last, 'beforeDayAdvanced')).toEqual([{ t: 'beforeDayAdvanced', day: 2, resets: 0 }]);
    expect(ofType(r.last, 'log').map((e) => e.text)).toContain(BEFORE_TEXT.day[2]);
    // Second Bell's people and events are on: the Gardens' wheels, the Hall's study draft
    expect(evaluate(ev(CG, 'ev_gardens_wheels').when as Condition, r.s, r.prof, epack)).toBe(true);
    expect(evaluate(ev(NH, 'ev_hall_study_draft').when as Condition, r.s, r.prof, epack)).toBe(true);
    r = act(r, FULL);
    expect(r.s.before?.day).toBe(3);
    // Last Bell: wanted (say, after the Plaza), then the dusk
    r = { ...r, s: { ...r.s, flags: { ...r.s.flags, [FLAG_WANTED_IN_SILVERWOOD]: true } } };
    r = act(r, FULL);
    expect(r.s.before).toEqual({ day: 1, resets: 1 });
    expect(ofType(r.last, 'beforeReset')).toEqual([{ t: 'beforeReset', resets: 1 }]);
    expect([r.s.flags[FLAG_WANTED_IN_SILVERWOOD], r.s.flags['flag_before_gate_whole'], r.s.flags[FLAG_ENTERED_VIA_NEXUS], r.s.flags['flag_visited_before']]).toEqual([undefined, undefined, true, true]);
    expect(r.s.clock.ticks).toBe(ticks); // three Bells and a dusk: the Breach Clock never moved
    // a fresh echo: the gate's event fires again on the next walk there
    const again = run(r, [move(OW), move(GT)]);
    expect(ofType(again.last, 'eventFired').map((e) => e.eventId)).toEqual(['ev_gate_whole']);
    // with `q_stop_the_ritual` resolved, Last Bell holds (STORY §9.4)
    const held = act(start(AG, { day: 3, quests: { q_stop_the_ritual: 'failed' }, visited: [AG] }), FULL);
    expect(held.s.before?.day).toBe(3);
  });

  test('an Anchor (D-016, D-067.4): Second Bell with the ward seal — the Archives let you by, the stair is open, no pillar wakes; the Talisman set on the cradle’s rim lies in the Depths; the door back takes a dawn', () => {
    let r = start(AG, { day: 2, items: [SEAL, TALISMAN], visited: [GT, OW, AG, NEXUS], scattered: { [OW]: ['enc_walks_hounds'] } });
    r = run(r, [move(OW), move(AD), move(CX)]);
    expect([r.s.world.currentLocationId, r.s.mode, r.s.combat]).toEqual([CX, 'explore', null]);
    expect(ofType(r.last, 'eventFired').map((e) => e.eventId)).toEqual(['ev_conflux_well']);
    const talisman = r.s.player.inventory.find((i) => i.itemId === TALISMAN);
    expect(talisman).toBeDefined();
    expect(legalActions(r.s, epack, r.prof).some((a) => a.type === 'drop' && a.uid === talisman?.uid)).toBe(true);
    r = act(r, { type: 'drop', uid: talisman?.uid ?? '' });
    expect(r.s.flags[FLAG_CONFLUX_ANCHORED]).toBe(true);
    expect(anchorsInDepths(r.s)).toEqual([talisman?.uid]);
    expect(r.s.world.locationStates[DEPTHS_LOCATION_ID]?.items.map((i) => i.itemId)).toEqual([TALISMAN]);
    expect(r.s.world.locationStates[CX]?.items.map((i) => i.itemId)).toEqual([]);
    expect(ofType(r.last, 'log').map((e) => e.text)).toContain(BEFORE_TEXT.anchor('Sky-Whisper Talisman'));
    // home through the Breach-door: the clock runs again, a dawn later; the Anchor is still in the Depths
    const ticks = r.s.clock.ticks;
    r = run(r, [move(AD), move(OW), move(GT), move(NEXUS)]);
    expect([r.s.world.currentLocationId, r.s.before, r.s.clock.frozen, r.s.clock.ticks - ticks]).toEqual([NEXUS, null, false, BEFORE_RETURN_WATCHES]);
    expect([r.s.flags[FLAG_ENTERED_VIA_NEXUS], r.s.flags['flag_before_day_2'], r.s.flags[FLAG_CONFLUX_ANCHORED]]).toEqual([undefined, undefined, true]);
    expect(anchorsInDepths(r.s)).toEqual([talisman?.uid]);
  });

  test('the Apex tear: the spared Tyrant’s way through lands in the Conflux on First Bell and wakes no pillar (W8); the way back is the tear, and the Gate’s door stays shut', () => {
    const r0 = start(APEX, { flags: { flag_tyrant_spared: true }, visited: [APEX] });
    expect(movesOf(r0)).toContain(CX);
    expect(movesOf(start(APEX, { visited: [APEX] }))).not.toContain(CX);
    const r = act(r0, move(CX));
    expect([r.s.world.currentLocationId, r.s.mode, r.s.combat, r.s.before]).toEqual([CX, 'explore', null, { day: 1, resets: 0 }]);
    expect(r.s.flags).toMatchObject({ [FLAG_ENTERED_VIA_APEX]: true, flag_visited_before: true });
    expect(r.s.flags[FLAG_ENTERED_VIA_NEXUS]).toBeUndefined();
    expect(movesOf(r)).toEqual([APEX, AD].sort());
    expect(evaluate(loc(GT).exits.find((e) => e.to === NEXUS)?.when as Condition, r.s, r.prof, epack)).toBe(false);
    // the same arrival by the stair on First Bell, without the seal, would wake them
    const pillars = enc(CX, 'enc_conflux_pillars').when as Condition;
    expect([holds(pillars, CX, { day: 1 }), holds(pillars, CX, { day: 2 }), holds(pillars, CX, { day: 1, via: 'apex' }), holds(pillars, CX, { day: 1, items: [SEAL] }), holds(pillars, CX, { day: 3 })]).toEqual([true, true, false, false, false]);
  });

  test('the day-scripted guards hold: the Archives’ pillar on Second Bell without the seal, the Hall’s Knight on Last Bell, the Warden on Last Bell with its two pillars — which kneels to the seal with Caelum beside you', () => {
    expect(fight(OW, AD, { day: 2, visited: [OW] })).toEqual({ id: 'enc_danthe_pillar', enemies: [PILLAR], canFlee: false, onFlee: 'hold' });
    for (const o of [{ day: 1 as const }, { day: 3 as const }, { day: 2 as const, items: [SEAL] }]) expect(fight(OW, AD, { ...o, visited: [OW] }).id).toBe('');
    expect(fight(PB, NH, { day: 3, visited: [PB] })).toEqual({ id: 'enc_hall_knight', enemies: [KNIGHT], canFlee: false, onFlee: 'hold' });
    expect(fight(PB, NH, { day: 1, items: [SEAL], visited: [PB] }).id).toBe('');
    expect(fight(AD, CX, { day: 3, visited: [AD] })).toEqual({ id: 'enc_conflux_warden', enemies: [WARDEN, PILLAR, PILLAR], canFlee: false, onFlee: 'hold' });
    const kneels = enc(CX, 'enc_conflux_warden').optionalWhen as Condition;
    expect([holds(kneels, CX, { day: 3, items: [SEAL] }, true), holds(kneels, CX, { day: 3, items: [SEAL] }), holds(kneels, CX, { day: 3 }, true)]).toEqual([true, false, false]);
  });

  test('the Bells’ chances (300 seeds each): the Walks’ hounds 40 % on every arrival of Second and Last Bell, never on First; the Library’s adepts 60 % on Last Bell; the Corridor’s adept 50 % for the wanted; the Gate’s halberdiers for the wanted on Last Bell', () => {
    const N = 300;
    const near = (x: number, p: number) => [x > p - 0.1, x < p + 0.1];
    // First Bell: never the Circle's hounds; only the Early Hound (U34e: WORLD §10.2's anomaly, 15 % in Loop 2, DESIGN §6.6)
    const first = tally(GT, OW, N, { day: 1, visited: [GT, OW] });
    expect([...first.keys()].sort()).toEqual(['anomaly', '—']);
    expect(near((first.get('anomaly') ?? 0) / N, 0.15)).toEqual([true, true]);
    for (const day of [2, 3] as const) {
      for (const visited of [[GT], [GT, OW]]) {
        const t = tally(GT, OW, N, { day, visited });
        expect([...t.keys()].sort()).toEqual(['enc_walks_hounds', '—']);
        expect([day, visited.length, ...near((t.get('enc_walks_hounds') ?? 0) / N, 0.4)]).toEqual([day, visited.length, true, true]);
      }
    }
    const gl = tally(CO, GL, N, { day: 3, visited: [CO] });
    expect(near((gl.get('enc_grand_library_adepts') ?? 0) / N, 0.6)).toEqual([true, true]);
    expect(tally(CO, GL, 50, { day: 2, visited: [CO] })).toEqual(new Map([['—', 50]]));
    const wanted = { [FLAG_WANTED_IN_SILVERWOOD]: true };
    const co = tally(GT, CO, N, { day: 3, flags: wanted, visited: [GT] });
    expect(near((co.get('enc_scholars_adept') ?? 0) / N, 0.5)).toEqual([true, true]);
    expect(tally(GT, CO, 50, { day: 3, visited: [GT] })).toEqual(new Map([['—', 50]]));
    expect(fight(OW, GT, { day: 3, flags: wanted, visited: [OW] })).toEqual({ id: 'enc_silver_gate_halberdiers', enemies: [HALBERDIER, HALBERDIER], canFlee: true, onFlee: 'scatter' });
    expect(fight(OW, GT, { day: 2, flags: wanted, visited: [OW] }).id).toBe('');
    // a pair is fought once per echo: cleared, the Bell's group does not come back
    for (let i = 0; i < 30; i++) {
      const s = stateAt(GT, { day: 2, visited: [GT, OW], seed: `u48b-cleared-${i}` });
      const walks = s.world.locationStates[OW];
      if (walks) walks.encounterClearedDay['enc_walks_hounds'] = dayOf(s.clock.ticks); // the frozen clock: "today" lasts the echo
      expect(step(s, move(OW), epack, profileOf()).state.mode).toBe('explore');
    }
  });

  test('the drawn blade: drawing a weapon in the Plaza (an `interact`) starts the Watch’s fight, which can be fled; no arrival ever starts it', () => {
    const r = start(PB, { day: 1, visited: [PB] });
    const blade = legalActions(r.s, epack, r.prof).find((a) => a.type === 'interact' && a.eventId === 'ev_plaza_blade');
    expect(blade).toEqual({ type: 'interact', eventId: 'ev_plaza_blade' });
    const drawn = act(r, blade as Action);
    expect(drawn.s.mode).toBe('combat');
    expect([drawn.s.combat?.encounterId, drawn.s.combat?.enemies.map((e) => e.refId), drawn.s.combat?.canFlee]).toEqual(['enc_bells_watch', [HALBERDIER, HALBERDIER], true]);
    expect(ofType(drawn.last, 'eventFired').map((e) => [e.eventId, e.text])).toEqual([['ev_plaza_blade', 'Steel comes out in the Plaza of Bells. At the Watch post a whistle goes up.']]);
    for (const day of [1, 2, 3] as const) expect(tally(GL, PB, 30, { day, visited: [GL, PB] })).toEqual(new Map([['—', 30]]));
  });

  test('the Library’s option (Loop 3+): “Tell it what it will hear” is offered from the third loop', () => {
    const offered = (loop: number) => legalActions(stateAt(GL, { day: 1, loop, visited: [GL] }), epack, profileOf({ loop })).some((a) => a.type === 'interact' && a.eventId === 'ev_library_cradle_seed');
    expect([offered(2), offered(3), offered(5)]).toEqual([false, true, true]);
  });

  // ---- D-098 (U34d): the living city, the hour, the arrest, items on their Bell ---------------------------------------------------

  test('the hour (D-098): every Bell begins at dawn; a short rest at the Garret passes one of the echo’s watches, a full rest brings the next Bell at dawn; the `watch` atom reads it, not the frozen clock', () => {
    const hour = (r: Run) => r.s.counters.custom['before_watch'];
    const noon: Condition = { watch: 'day' };
    // (a seed whose walk across the Walks meets no Early Hound, U34e's First Bell anomaly)
    let r = run(start(NEXUS, { items: [LENS], echoes: ['echo_litany_verse_1'], visited: [NEXUS], seed: 'u34d-hour-2' }), [move(GT), move(OW), move(AG)]);
    expect([r.s.before?.day, hour(r)]).toEqual([1, 0]);
    const frozen = r.s.clock.ticks;
    const SHORT: Action = { type: 'rest', kind: 'short' };
    const hours: number[] = [];
    for (let i = 0; i < 4; i++) {
      r = act(r, SHORT);
      hours.push(hour(r) ?? -1);
    }
    expect(hours).toEqual([1, 2, 3, 3]); // noon, dusk, night — and night holds
    expect(ofType(r.last, 'log').map((e) => e.text)).toContain(BEFORE_TEXT.stillNight);
    expect(r.s.clock.ticks).toBe(frozen);
    expect(evaluate({ watch: 'night' }, r.s, r.prof, epack)).toBe(true);
    r = act(r, FULL);
    expect([r.s.before?.day, hour(r), evaluate({ watch: 'dawn' }, r.s, r.prof, epack)]).toEqual([2, 0, true]);
    r = act(r, { type: 'rest', kind: 'short' });
    expect([evaluate(noon, r.s, r.prof, epack), ofType(r.last, 'log').map((e) => e.text).includes(BEFORE_TEXT.hour[1])]).toEqual([true, true]);
    // outside the Before the atom reads the Breach Clock again, and the counter is gone
    const home = run(r, [move(OW), move(GT), move(NEXUS)]);
    expect([home.s.before, hour(home)]).toEqual([null, undefined]);
  });

  test('the Spire Yard at noon (D-098): `ev_plaza_spire_yard` needs Last Bell, the errand and noon — not Last Bell’s dawn', () => {
    const errand = { quests: { q_the_apprentices_errand: 'active' as const } };
    const fires = (o: At) => ofType(act(start(GL, { visited: [GL], ...errand, ...o }), move(PB)).last, 'eventFired').some((e) => e.eventId === 'ev_plaza_spire_yard');
    expect([fires({ day: 3, hour: 1 }), fires({ day: 3, hour: 0 }), fires({ day: 3, hour: 2 }), fires({ day: 2, hour: 1 })]).toEqual([true, false, false, false]);
  });

  test('the living city (D-098): who stands where by Bell and hour — Caelum, the Nine, young Nyxaria, Tobrin, Ilsabet, Hadrek', () => {
    const at = (l: string, o: At) => npcsAt(stateAt(l, o), epack, profileOf(o), l);
    const nine = ['npc_veyran_thal', 'npc_nyxaria_vell_before', 'npc_oriel_danthe', 'npc_maelis_korr', 'npc_haldric_vane', 'npc_durn_hallow', 'npc_seraphine_aulde', 'npc_imre_sallow', 'npc_tovren_masque'];
    // the Hall: the Circle and Hadrek on First Bell, Tobrin (not Hadrek) on Second, nobody on Last (the Nine are at the plinths)
    expect(at(NH, { day: 1 })).toEqual(['npc_veyran_thal', 'npc_nyxaria_vell_before', 'npc_haldric_vane', 'npc_hadrek']);
    expect(at(NH, { day: 2 })).toEqual(['npc_veyran_thal', 'npc_nyxaria_vell_before', 'npc_haldric_vane', 'npc_tobrin_vask']);
    expect(at(NH, { day: 3 })).toEqual([]);
    // the Conflux: Hallow at his forge on the first two Bells (Tobrin too on Second); all nine on Last Bell, Aulde but at noon
    expect(at(CX, { day: 1 })).toEqual(['npc_durn_hallow']);
    expect(at(CX, { day: 2 })).toEqual(['npc_durn_hallow', 'npc_tobrin_vask']);
    expect([...at(CX, { day: 3 })].sort()).toEqual([...nine].sort());
    expect(at(CX, { day: 3, hour: 1 })).not.toContain('npc_seraphine_aulde');
    // the Plaza: Anso and Dreyl always; Caelum at noon on First Bell; young Nyxaria at night on the first two Bells; Aulde at noon on Last Bell
    expect(at(PB, { day: 1 })).toEqual(['npc_bellwright_anso', 'npc_corvin_dreyl']);
    expect(at(PB, { day: 1, hour: 1 })).toEqual(['npc_bellwright_anso', 'npc_corvin_dreyl', 'npc_caelum']);
    expect(at(PB, { day: 2, hour: 3 })).toEqual(['npc_bellwright_anso', 'npc_corvin_dreyl', 'npc_nyxaria_vell_before']);
    expect(at(PB, { day: 3, hour: 3 })).toEqual(['npc_bellwright_anso', 'npc_corvin_dreyl']);
    expect(at(PB, { day: 3, hour: 1 })).toEqual(['npc_bellwright_anso', 'npc_corvin_dreyl', 'npc_seraphine_aulde']);
    // Caelum: the Garret, but the Plaza at noon on First Bell and the Archive stair at Last Bell's dusk
    expect([at(AG, { day: 1 }), at(AG, { day: 1, hour: 1 }), at(AG, { day: 3, hour: 2 }), at(AD, { day: 3, hour: 2 })]).toEqual([['npc_caelum'], [], [], ['npc_caelum']]);
    expect(at(AD, { day: 3 })).toEqual([]); // Oriel at the plinths
    // the Gardens: Sallow on the first two Bells, Ilsabet on Second Bell only
    expect([at(CG, { day: 1 }), at(CG, { day: 2 }), at(CG, { day: 3 })]).toEqual([['npc_imre_sallow'], ['npc_ilsabet_rhune', 'npc_imre_sallow'], []]);
    // talking and examining follow presence: Hadrek cannot be examined on Second Bell
    const examined = (o: At) => legalActions(stateAt(NH, { ...o, visited: [NH] }), epack, profileOf(o), { includeExamine: true }).filter((a) => a.type === 'examine' && a.target.kind === 'npc').map((a) => (a as { target: { id: string } }).target.id);
    expect([examined({ day: 1 }).includes('npc_hadrek'), examined({ day: 2 }).includes('npc_hadrek')]).toEqual([true, false]);
  });

  test('the arrest (D-098; WORLD §6.9 "non-lethal"): losing to the Watch is not a death — you wake in the Garret a Bell later at 1 HP or more; on Last Bell the day lost is the dusk, and the echo resets', () => {
    expect(cr(HALBERDIER).tags).toContain('non_lethal');
    const lose = (o: At): Run => {
      let r = act(start(PB, { visited: [PB, AG], seed: 'u34d-arrest', ...o }), { type: 'interact', eventId: 'ev_plaza_blade' });
      const s = JSON.parse(JSON.stringify(r.s)) as GameState;
      for (const c of s.combat?.party ?? []) if (c.kind === 'player') c.hp = 1;
      r = { ...r, s };
      for (let i = 0; i < 30 && r.s.mode === 'combat'; i++) r = act(r, { type: 'guard' });
      return r;
    };
    const taken = lose({ day: 1 });
    expect([taken.s.mode, taken.s.world.currentLocationId, taken.s.before, taken.s.combat]).toEqual(['explore', AG, { day: 2, resets: 0 }, null]);
    expect(taken.s.player.hp).toBeGreaterThanOrEqual(1);
    expect(ofType(taken.last, 'playerDied')).toEqual([]);
    expect(ofType(taken.last, 'combatEnded').map((e) => e.result)).toEqual(['defeat']);
    expect(ofType(taken.last, 'log').map((e) => e.text)).toContain(BEFORE_TEXT.arrest);
    expect(taken.s.pendingEnding).toBeNull();
    const dusk = lose({ day: 3 });
    expect([dusk.s.world.currentLocationId, dusk.s.before]).toEqual([AG, { day: 1, resets: 1 }]);
    expect(ofType(dusk.last, 'beforeReset')).toEqual([{ t: 'beforeReset', resets: 1 }]);
  });

  test('items on their Bell (D-098): the cracked bell’s shard is not on the Plaza on First Bell, and lies there when the Wayfinder comes back on Last Bell', () => {
    const fresh = (s: GameState): GameState => {
      s.world.locationStates[PB] = { ...seeded(false), itemsSpawned: false };
      return s;
    };
    let r: Run = { s: fresh(stateAt(GL, { day: 1, visited: [GL, AG] })), prof: profileOf(), last: [] };
    r = act(r, move(PB));
    expect(r.s.world.locationStates[PB]?.items.map((i) => i.itemId)).toEqual([]);
    r = run(r, [move(AG), FULL, FULL, move(PB)]);
    expect([r.s.before?.day, r.s.world.locationStates[PB]?.items.map((i) => i.itemId)]).toEqual([3, ['item_bell_shard']]);
    // taken, it does not come back that loop (the Before's items are once a loop)
    const shard = r.s.world.locationStates[PB]?.items[0];
    r = act(r, { type: 'take', uid: shard?.uid ?? '' });
    r = run(r, [move(AG), move(PB)]);
    expect(r.s.world.locationStates[PB]?.items).toEqual([]);
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U48b reply ----------------------------------------

describe('authored words outside the documents are few and short; coined ids are the listed ones', () => {
  test('encounter intros, the two refusal lines, the rest text, the two options’ labels and texts, the Gate Slam’s telegraph, the non-legacy descriptions', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro));
    expect(intros).toHaveLength(9);
    for (const t of intros) expect([t, t !== undefined && words(t) <= 20]).toEqual([t, true]);
    const locked = parsedLocations.flatMap((l) => l.exits.map((e) => e.lockedText).filter((t): t is string => t !== undefined));
    expect(locked).toEqual(['The Hall admits apprentices and the sealed.', 'The stair is warded until Last Bell.']);
    expect(loc(AG).rest?.text).toBe('You take a spare cot under the eaves. Down the row a boy is still reading.');
    const options = parsedLocations.flatMap((l) => l.events.filter((e) => e.trigger === 'interact'));
    for (const e of options) expect([e.id, words(e.text) <= 20, words(e.label ?? '') <= 6]).toEqual([e.id, true, true]);
    const worded = new Set(parsedCreatures.flatMap((c) => Object.values(worldCreature(c.id).intents)));
    expect(parsedCreatures.flatMap((c) => Object.values(c.moves).map((m) => m.line)).filter((line) => !worded.has(line))).toEqual(['The arms come down. The stair shuts like a gate.']);
    for (const c of parsedCreatures) expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
  });

  test('ids this unit coined (WORLD/STORY have none for them): encounter ids, the two option events, the gate’s once-per-echo flag, the Warden’s phase ids, the art keys', () => {
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.id))).toEqual([
      'enc_silver_gate_halberdiers', 'enc_walks_hounds', 'enc_scholars_adept', 'enc_grand_library_adepts', 'enc_bells_watch', 'enc_hall_knight', 'enc_danthe_pillar',
      'enc_conflux_warden', 'enc_conflux_pillars',
    ]);
    const wordedEvents = new Set(Object.values(WL).flatMap((w) => Object.keys(w.events)));
    expect(parsedLocations.flatMap((l) => l.events.map((e) => e.id)).filter((id) => !wordedEvents.has(id))).toEqual(['ev_library_cradle_seed', 'ev_plaza_blade', 'ev_archives_fair_copy', 'ev_conflux_cradle']);
    const flags = ids(JSON.stringify(locations), 'flag').sort();
    // the two `flag_scene_done_*` are C-58's engine-written scene flags (U58's attempts, once a loop each)
    expect(flags).toEqual(['flag_before_gate_whole', 'flag_entered_before_via_apex', 'flag_entered_before_via_nexus', 'flag_scene_done_scene_ritual_break_cradle', 'flag_scene_done_scene_ritual_steal_record', 'flag_visited_before', 'flag_wanted_in_silverwood']);
    expect(flags.filter((f) => !WORLD.includes(f))).toEqual(['flag_before_gate_whole', 'flag_scene_done_scene_ritual_break_cradle', 'flag_scene_done_scene_ritual_steal_record']);
    expect(cr(WARDEN).phases.map((p) => p.id)).toEqual(['uw_keep_the_line', 'uw_without_fear', 'uw_the_last_order']);
    for (const c of parsedCreatures) for (const id of Object.keys(c.moves)) expect([c.id, id, WORLD.includes(`\`${id}\``)]).toEqual([c.id, id, true]);
    expect(parsedLocations.map((l) => l.art.silhouettes.length)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 4, 4]);
  });
});
