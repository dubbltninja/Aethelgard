// U45: Glowlands & Nexus — the Apex road's end, both Chronos Tyrants and the Unveiled's communion — checked against the
// documents at test time, U42's pattern (regions/silverwood_ruins.test.ts): WORLD §2.5, §3.5, §4, §6, §10.1, §11.1–11.3,
// §12.1; DESIGN §4.10 (the Tyrants' numbers, field by field), §4.11 (the communion), §6.2, §17.1; STORY §2.3, §8.3,
// §10.2, §14; PLAN Appendix A. The legacy text is checked against the Python sources here and in legacy.test.ts. Patterns
// are walked turn by turn by the engine (`generateIntent`), so every WORLD cadence word is held to what the game does.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures as folderCreatures } from '@content/regions/glowlands_nexus/creatures';
import { locations } from '@content/regions/glowlands_nexus/locations';
import { npcs } from '@content/regions/glowlands_nexus/npcs';
import { region } from '@content/regions/glowlands_nexus/region';
import { gameConfig } from '@content/shared/config';
import { validateContent } from '@content/validate';
import {
  APEX_FACE_IT,
  APEX_NOT_YET,
  beginCombat,
  generateIntent,
  isApexPromptOpen,
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
import { fireEvent } from '@engine/reducers/explore';
import type { CodexEntryInput } from '@schema/codex';
import type { Condition } from '@schema/condition';
import { CreatureSchema, walkSteps, type Creature, type Step } from '@schema/creature';
import { LocationSchema, type Location } from '@schema/location';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { CONTAINED as FIXTURE_CONTAINED, combatTables } from '@tests/fixtures/combatContent';
import { miniContentTables } from '@tests/fixtures/miniContent';
import { main as validateCli } from '../../../../tools/validate-content';
import { PLAN, WORLD, appendixLegacyLocations, ids, section, tableRows, unquote, worldCreature, worldCreatureTable, worldEdges, worldLocations, worldNodes } from './worldDoc';

// U34e (D-087): WORLD §10.2's anomaly variants live in this folder too; WORLD §6's checks below are on the
// others (tests/unit/engine/u34e/anomalies.test.ts checks the variants).
const creatures = folderCreatures.filter((c) => !c.id.startsWith('cr_anomaly_'));

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');
const GAME = fs.readFileSync(path.join(ROOT, 'legacy/echoes_of_aethelgard.py'), 'utf8');
const DECISIONS = fs.readFileSync(path.join(ROOT, 'docs/DECISIONS.md'), 'utf8');

const REGION = 'region_glowlands_nexus';
const GLOWLANDS = 'loc_veridian_glowlands';
const NEXUS = 'loc_chronos_nexus';
const APEX = 'loc_temporal_breach_apex';
const CONTAINED = 'cr_chronos_tyrant_contained';
const UNVEILED = 'cr_chronos_tyrant_unveiled';
const TYRANTS: readonly string[] = [CONTAINED, UNVEILED];

const S35 = section(WORLD, '### 3.5 Glowlands & Nexus', '### 3.6');
const WL = Object.fromEntries(worldLocations(S35).map((l) => [l.id, l]));
const NODES = worldNodes();
const EDGES = worldEdges();
const CREATURE_TABLE = worldCreatureTable();
const pack = buildContentPack();
const parsedLocations: Location[] = locations.map((l) => LocationSchema.parse(l));
const parsedCreatures: Creature[] = creatures.map((c) => CreatureSchema.parse(c));
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
  return flat((end < 0 ? rest : rest.slice(0, end)).replace(/^- \*\*[^*]+\*\*\s*(\([^)]*\))?:?\s*/, ''));
}
/** WORLD's condition notation (`{loop:{min:2}}`, unquoted keys) as data; `{item:"x"}` is the schema's `{item:{id:"x"}}`. */
function worldCondition(text: string): Condition {
  const json = text.replace(/([{,])([a-zA-Z_]+):/g, '$1"$2":');
  const fix = (c: unknown): unknown => {
    if (Array.isArray(c)) return c.map(fix);
    if (typeof c !== 'object' || c === null) return c;
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, k === 'item' && typeof v === 'string' ? { id: v } : fix(v)]));
  };
  return fix(JSON.parse(json)) as Condition;
}

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_glowlands_nexus vs WORLD §2.5, §10.1 and DESIGN §6.5, §17.1', () => {
  const S25 = section(WORLD, '### 2.5 `region_glowlands_nexus`', '### 2.6');

  test('id, name, legacy (Appendix A.1), no faction, the band without the Apex, WORLD’s theme text, order, codex', () => {
    expect(region.id).toBe(REGION);
    expect(S25).toContain(`### 2.5 \`${REGION}\` — ${region.name}`);
    expect(section(PLAN, '### A.1 Regions', '### A.2')).toContain(`| \`${REGION}\` | ${region.name} | yes |`);
    expect(region.legacy).toBe(true);
    expect(S25).toContain('| Factions | None.');
    expect('factionId' in region).toBe(false);
    // "9–13; the Apex 15–18": the region's band; the Apex's is its own location band (DESIGN §6.5 lists it apart)
    expect(S25).toContain('| Level band | 9–13; the Apex 15–18 |');
    expect(region.levelBand).toEqual({ min: 9, max: 13 });
    expect(loc(APEX).levelBand).toEqual({ min: 15, max: 18 });
    expect(flat(S25)).toContain(region.description);
    expect(region.order).toBe(5);
    expect(region.codexId).toBe('codex_region_glowlands_nexus');
    expect(STORY).toContain('| `codex_region_glowlands_nexus` |');
  });

  test('the three locations WORLD lists, in WORLD’s order, all in the region', () => {
    const listed = /\| Locations \(3\) \| ([^|]+) \|/.exec(S25)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual([GLOWLANDS, NEXUS, APEX]);
    expect(locations.map((l) => l.id)).toEqual(listed);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of locations) expect(l.regionId).toBe(REGION);
  });

  test('the pool is WORLD §10.1’s pool_glowlands_nexus with the crawler’s weight on the mireling outside the Nexus; the Nexus keeps its share', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_glowlands_nexus');
    expect(row?.[2]).toBe('crawler at loc_chronos_nexus only (its weight goes to mireling elsewhere)');
    const entries = [...(row?.[1] ?? '').matchAll(/(cr_[a-z_]+) (\d+)/g)].map((m) => ({ creatureId: m[1] ?? '', weight: Number(m[2]) }));
    expect(entries.map((e) => e.creatureId)).toEqual(['cr_glowfen_mireling', 'cr_lantern_toad', 'cr_spore_drift', 'cr_hourglass_crawler']);
    const crawler = entries[3]?.weight ?? 0;
    const total = entries.reduce((n, e) => n + e.weight, 0);
    const elsewhere = entries.slice(0, 3).map((e) => (e.creatureId === 'cr_glowfen_mireling' ? { ...e, weight: e.weight + crawler } : e));
    expect(region.wanderingPool).toEqual(elsewhere);
    expect(region.returnEncounterChance).toBe(0.2);
    // at the Nexus: the crawler's share of the pool's return rolls, ahead of the pool
    const nexusPool = byId(loc(NEXUS).encounters, 'enc_nexus_pool_crawler');
    expect([nexusPool.groups, nexusPool.chance, nexusPool.respawn, nexusPool.once]).toEqual([[{ creatureId: 'cr_hourglass_crawler', count: 1 }], (region.returnEncounterChance * crawler) / total, 'on_return', false]);
    // only fodder of this unit, inside the band ± 2 (validator rule 11)
    for (const e of region.wanderingPool) {
      const c = cr(e.creatureId);
      expect([c.id, c.role, c.level >= region.levelBand.min - 2 && c.level <= region.levelBand.max + 2]).toEqual([c.id, 'fodder', true]);
    }
    // the Apex has no wandering roll (WORLD names none there)
    expect([loc(APEX).safe, loc(GLOWLANDS).safe, loc(NEXUS).safe]).toEqual([true, false, false]);
  });

  test('palette: DESIGN §17.1’s Glowlands & Nexus row (sky top, sky bottom, mid, accent); the ambient presets', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'Glowlands & Nexus');
    const hex = (row ?? []).slice(1).map((c) => /`(#[0-9A-F]{6})`/.exec(c)?.[1]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
    expect(tableRows(section(DESIGN, '### 18.2 Per-region ambient recipes', '### 18.3')).some((c) => c[0] === 'Glowlands & Nexus')).toBe(true);
    expect(region.ambient).toBe('ambient_glowlands_nexus');
    // WORLD §2.5's Ambient row: the Nexus and the Apex replace the swamp's recipe
    const ambient = tableRows(S25).find((c) => c[0] === 'Ambient audio')?.[1] ?? '';
    expect(ambient).toContain('at the Nexus replace with ticking');
    expect(ambient).toContain('at the Apex a chorus');
    expect([loc(GLOWLANDS).ambient, loc(NEXUS).ambient, loc(APEX).ambient]).toEqual([undefined, 'ambient_chronos_nexus', 'ambient_temporal_breach_apex']);
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the three locations vs WORLD §3.5 blocks', () => {
  test('names, bands, coordinates and region', () => {
    for (const l of locations) {
      const w = WL[l.id];
      expect([l.id, l.name, l.regionId, l.levelBand, l.map]).toEqual([l.id, w?.name, w?.regionId, w?.band, w?.map]);
    }
  });

  test('descriptions: the legacy text with WORLD’s `+` sentence appended, character for character', () => {
    for (const l of locations) expect([l.id, l.description]).toEqual([l.id, WL[l.id]?.description]);
  });

  test('exits: every walkable WORLD exit in order, gated ones with a `when`; the two portal edges are 0-watch exits hidden until their gates hold', () => {
    const portal = (e: Location['exits'][number]): boolean => e.travelWatches === 0;
    for (const l of parsedLocations) {
      const got = l.exits.filter((e) => !portal(e)).map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.exits]);
    }
    const portals = parsedLocations.flatMap((l) => l.exits.filter(portal).map((e) => [l.id, e.dir, e.to, e.hidden, e.label, e.when !== undefined]));
    expect(portals).toEqual([
      [NEXUS, 'east', 'loc_silver_gate', true, 'the Breach-door', true],
      [APEX, 'portal', 'loc_conflux_chamber', true, 'through the tear', true],
    ]);
    // WORLD's rows: "east ⟂ (Breach-door)", "through the tear ⟂"; the ending exit "beyond ⟂" is the communion's outcome
    expect(WL[NEXUS]?.block).toContain('| east ⟂ (Breach-door) | loc_silver_gate |');
    expect(WL[APEX]?.block).toContain('| through the tear ⟂ | loc_conflux_chamber |');
    expect(WL[APEX]?.block).toContain('| beyond ⟂ | ending F |');
    expect(loc(APEX).exits.some((e) => e.to.includes('ending'))).toBe(false);
  });

  test('rest points and merchants as WORLD says: the astronomers’ cell; none at the Apex ("cannot rest")', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, w?.rest, w?.merchant]);
    }
    expect(loc(NEXUS).rest?.kind).toBe('camp');
    expect(WL[APEX]?.block).toContain('Rest: **no** (cannot rest)');
  });

  test('every item WORLD places is placed (the Tyrant Shards as the Unveiled’s loot), with WORLD’s conditions', () => {
    for (const l of parsedLocations) {
      const expected = new Set(WL[l.id]?.itemIds ?? []);
      if (l.id === APEX) {
        expected.delete('mat_tyrant_shard'); // "only from the Unveiled Tyrant, one per phase cleared"
        expect(cr(UNVEILED).loot.map((r) => r.itemId)).toContain('mat_tyrant_shard');
      }
      expect([l.id, l.items.map((i) => i.itemId).sort()]).toEqual([l.id, [...expected].sort()]);
    }
    const item = (o: object) => ({ count: 1, hidden: false, once: true, chance: 1, onTake: [], ...o }); // U34d's defaults
    expect(loc(NEXUS).items).toEqual([item({ itemId: 'item_chronos_lens' }), item({ itemId: 'item_orrery_key', when: { loop: { min: 2 } } })]);
    // "After either Tyrant falls: mat_frayed_moment ×3" — D-098: the entry waits for the fall, hidden for the examine after it
    expect(loc(APEX).items).toEqual([item({ itemId: 'mat_frayed_moment', count: 3, hidden: true, when: { flag: 'flag_tyrant_dead' } })]);
    // ×1 (50 %): the item's own `chance` (D-098; it lay hidden at 100 %, D-091 gap 1)
    expect(loc(GLOWLANDS).items.find((i) => i.itemId === 'mat_glow_gland')).toEqual(item({ itemId: 'mat_glow_gland', chance: 0.5 }));
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa', () => {
    for (const l of parsedLocations) {
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      expect([l.id, [...got].sort()]).toEqual([l.id, [...(WL[l.id]?.creatureIds ?? [])].sort()]);
    }
  });

  test('the legacy fixed fights (the Mireling, the Aberration): 100 %, once, on the first visit, `scatter` (WORLD §10.5)', () => {
    for (const [l, id, creature] of [
      [GLOWLANDS, 'enc_glowlands_mireling', 'cr_glowfen_mireling'],
      [NEXUS, 'enc_nexus_aberration', 'cr_temporal_aberration'],
    ] as const) {
      const e = byId(loc(l).encounters, id);
      expect([id, e.groups, e.chance, e.once, e.respawn, e.fleeable, e.onFlee, e.when]).toEqual([id, [{ creatureId: creature, count: 1 }], 1, true, 'never', true, 'scatter', undefined]);
      expect(loc(l).encounters[0]?.id).toBe(id);
    }
    expect(flat(section(WORLD, '### 10.5', '### 10.6'))).toContain('the legacy Apex-road fights (Phantom, Weaver, Sentinel, Mireling, Aberration) are `scatter`');
  });

  test('return rolls at WORLD’s chances; the Hour Leech (Loop 4+) first so its 15 % is WORLD’s; the Knight only while the key is untaken', () => {
    const at = (l: string, id: string) => byId(loc(l).encounters, id);
    expect(WL[GLOWLANDS]?.block).toContain('return: cr_lantern_toad ×1 + cr_spore_drift ×1 (30%) or pool 20%');
    expect(at(GLOWLANDS, 'enc_glowlands_toad_spore')).toMatchObject({ chance: 0.3, respawn: 'on_return', once: false });
    expect(at(GLOWLANDS, 'enc_glowlands_toad_spore').groups).toEqual([{ creatureId: 'cr_lantern_toad', count: 1 }, { creatureId: 'cr_spore_drift', count: 1 }]);
    const nexus = WL[NEXUS]?.block ?? '';
    expect(nexus).toContain('return: cr_hourglass_crawler ×2 (35%) or cr_orrery_knight ×1 (20%, only if `item_orrery_key` not yet taken) or pool 20%. Loop 4+: cr_hour_leech ×1 (15%).');
    expect(at(NEXUS, 'enc_nexus_crawlers')).toMatchObject({ chance: 0.35, respawn: 'on_return', once: false });
    expect(at(NEXUS, 'enc_nexus_crawlers').groups).toEqual([{ creatureId: 'cr_hourglass_crawler', count: 2 }]);
    expect(at(NEXUS, 'enc_nexus_orrery_knight')).toMatchObject({ chance: 0.2, respawn: 'on_return', once: false });
    expect(at(NEXUS, 'enc_nexus_orrery_knight').when).toEqual({ not: { item: { id: 'item_orrery_key' } } });
    expect(at(NEXUS, 'enc_nexus_hour_leech')).toMatchObject({ chance: 0.15, respawn: 'on_return', once: false });
    expect(at(NEXUS, 'enc_nexus_hour_leech').when).toEqual({ loop: { min: 4 } });
    expect(loc(NEXUS).encounters.map((e) => e.id)).toEqual(['enc_nexus_aberration', 'enc_nexus_hour_leech', 'enc_nexus_crawlers', 'enc_nexus_orrery_knight', 'enc_nexus_pool_crawler']);
  });

  test('the Apex: the Contained Tyrant in Loop 1, the Unveiled from Loop 2 (D-051); bosses hold; the legacy encounter line; tagged `apex`', () => {
    const apex = loc(APEX);
    expect(apex.encounters.map((e) => [e.id, e.groups, e.when, e.fleeable, e.onFlee, e.once, e.chance])).toEqual([
      ['enc_apex_contained', [{ creatureId: CONTAINED, count: 1 }], { loop: { max: 1 } }, false, 'hold', true, 1],
      ['enc_apex_unveiled', [{ creatureId: UNVEILED, count: 1 }], { loop: { min: 2 } }, false, 'hold', true, 1],
    ]);
    // echoes_of_aethelgard.py: `threat_name` is the name itself when it starts with "The " (the Tyrant's case)
    expect(GAME).toContain('print(danger(f"You sense danger... {threat_name} approaches!"))');
    expect(GAME).toContain('if lower_name.startswith(("the ", "a ", "an ")):\n                            threat_name = encounter_name');
    for (const e of apex.encounters) expect(e.intro).toBe('You sense danger... The Chronos Tyrant approaches!');
    expect(STORY).toContain('- You sense danger... The Chronos Tyrant approaches! **[legacy]**');
    expect(apex.tags).toContain('apex');
    expect(WL[APEX]?.block).toContain('Horde: none (the Apex is the source)');
  });

  test('events: every WORLD event, its text verbatim, legacy ids with the ev_ prefix, once; WORLD’s conditions and grants', () => {
    for (const l of parsedLocations) {
      const got = Object.fromEntries(l.events.map((e) => [e.id, e.text]));
      const expected = Object.fromEntries(Object.entries(WL[l.id]?.events ?? {}).map(([id, text]) => [id.startsWith('ev_') ? id : `ev_${id}`, text]));
      expect([l.id, got]).toEqual([l.id, expected]);
      for (const e of l.events) expect([e.id, e.trigger, e.once]).toEqual([e.id, 'enter', true]);
    }
    const ev = (l: string, id: string) => byId(loc(l).events, id);
    expect(ev(GLOWLANDS, 'ev_glowlands_leak').when).toEqual({ loop: { min: 2 } });
    expect(ev(NEXUS, 'ev_nexus_door').when).toEqual({ item: { id: 'item_chronos_lens' } });
    // D-098 (U34d): "item_chronal_dust ×2 with the key" is the event's second effect, under its own condition (`onlyIf`)
    expect(ev(NEXUS, 'ev_nexus_orrery')).toMatchObject({
      when: { any: [{ item: { id: 'item_chronos_lens' } }, { item: { id: 'item_orrery_key' } }] },
      effects: [
        { grantEcho: 'echo_eye_of_masque' },
        { onlyIf: { when: { item: { id: 'item_orrery_key' } }, effects: [{ giveItem: { item: 'item_chronal_dust', count: 2 } }] } },
      ],
    });
    expect(WL[NEXUS]?.block).toContain('requires `{any:[{item:"item_chronos_lens"},{item:"item_orrery_key"}]}`; grants `echo_eye_of_masque`');
    expect(WL[NEXUS]?.block).toContain('and, with the key, `item_chronal_dust` ×2.');
    // PLAN A.5 `apex_first_entry` → the `echo_apex_resonance` grant; STORY §12 "Stand at the Apex once"
    expect(ev(APEX, 'ev_apex_rend').effects).toEqual([{ grantEcho: 'echo_apex_resonance' }]);
    expect(PLAN).toContain('`apex_first_entry` → location flag + `echo_apex_resonance` grant');
    expect(STORY).toContain('| `echo_apex_resonance` | The Way Up | Stand at the Apex once |');
    expect(ev(APEX, 'ev_apex_watched').when).toEqual({ loop: { min: 2 } });
    expect(ev(APEX, 'ev_apex_names').when).toEqual({ flag: 'flag_visited_before' });
  });

  test('NPCs: none placed — every NPC WORLD names here is at home in another region and comes and goes at runtime', () => {
    const rows = Object.fromEntries(tableRows(section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families')).map((c) => [unquote(c[0] ?? ''), c]));
    const named = [...new Set(parsedLocations.flatMap((l) => WL[l.id]?.npcIds ?? []))].sort();
    expect(named).toEqual(['npc_brak', 'npc_dask', 'npc_mireya']);
    for (const id of named) {
      const home = /loc_[a-z_]+/.exec(rows[id]?.[3] ?? '')?.[0];
      expect([id, home !== undefined && !locations.some((l) => l.id === home)]).toEqual([id, true]);
    }
    for (const l of parsedLocations) expect([l.id, l.npcs]).toEqual([l.id, []]);
    expect(npcs).toEqual([]);
  });

  test('art: WORLD’s horizons and templates; the Apex has none ("horizon none (abstract)")', () => {
    expect(parsedLocations.map((l) => [l.id, l.art.template, WL[l.id]?.horizon])).toEqual([
      [GLOWLANDS, 'swamp', 0.6],
      [NEXUS, 'observatory', 0.55],
      [APEX, 'breach', null],
    ]);
    for (const l of parsedLocations) if (WL[l.id]?.horizon !== null) expect(l.art.horizon).toBe(WL[l.id]?.horizon ?? -1);
    expect(WL[APEX]?.block).toContain('horizon none (abstract)');
  });

  test('legacy lines (echoes_of_aethelgard.py): the Apex’s Horde text and the Nexus → Apex refusal', () => {
    const apexHorde = /elif location\.name == "The Temporal Breach Apex" and self\.horde_active:\n\s+description = danger\(\n\s+"([^"]+)"\n\s+"([^"]+)"/.exec(GAME);
    expect(apexHorde).not.toBeNull();
    const horde = `${apexHorde?.[1] ?? ''}${apexHorde?.[2] ?? ''}`;
    expect(loc(APEX).descriptionVariants).toEqual([{ when: { flag: 'flag_horde_active' }, text: horde }]);
    expect(WL[APEX]?.block).toContain(`**Horde state (legacy, verbatim):** "${horde}"`);
    const refusal = /elif destination == "The Temporal Breach Apex" and location\.name == "The Chronos Nexus":\n\s+print\("([^"]+)"\)/.exec(GAME)?.[1];
    expect(refusal).toBe("I can't help but feeling I need to go back and see what else needs done first.");
    expect(loc(NEXUS).exits.find((e) => e.to === APEX)?.lockedText).toBe(refusal);
  });

  test('Appendix A: the three legacy ids carry their legacy names and region', () => {
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

  test('§11.2 edges: every walk and portal edge of the region with its direction, cost and gate; reverse exits inside the region match', () => {
    const here = new Set<string>(locations.map((l) => l.id));
    const edges = EDGES.filter((e) => (e.kind === 'walk' || e.kind === 'portal') && (here.has(e.from) || here.has(e.to)));
    expect(edges.map((e) => `${e.from}>${e.to}:${e.kind}`)).toEqual([
      'loc_sky_whisper_plateau>loc_veridian_glowlands:walk',
      'loc_veridian_glowlands>loc_chronos_nexus:walk',
      'loc_veridian_glowlands>loc_reedmarch_descent:walk',
      'loc_veridian_glowlands>loc_lantern_causeway:walk',
      'loc_chronos_nexus>loc_temporal_breach_apex:walk',
      'loc_chronos_nexus>loc_silver_gate:portal',
      'loc_temporal_breach_apex>loc_conflux_chamber:portal',
    ]);
    for (const e of edges) {
      const dir = (d: string): string => (d === 'through the tear' ? 'portal' : d);
      if (here.has(e.from)) {
        const exit = loc(e.from).exits.find((x) => x.to === e.to);
        expect([e.from, e.to, exit?.dir, exit?.travelWatches, exit?.when !== undefined]).toEqual([e.from, e.to, dir(e.dir), e.cost, e.gate !== 'open']);
      }
      if (here.has(e.to)) {
        const back = loc(e.to).exits.find((x) => x.to === e.from);
        expect([e.to, e.from, back?.dir, back?.travelWatches, back?.when !== undefined]).toEqual([e.to, e.from, dir(e.reverseDir), e.reverseCost, e.reverseGate !== 'open']);
      }
    }
  });

  test('§11.3 gates: the Apex gate is D-048’s data form and config.apexGate; the Breach-door and the tear carry WORLD’s conditions', () => {
    const gates = Object.fromEntries(tableRows(section(WORLD, '### 11.3 Gate conditions', '### 11.4')).map((c) => [unquote(c[0] ?? ''), unquote(c[2] ?? '')]));
    const exit = (from: string, to: string) => loc(from).exits.find((e) => e.to === to)?.when;
    expect(exit(NEXUS, APEX)).toEqual(worldCondition(gates['gate_apex'] ?? ''));
    expect(exit(NEXUS, APEX)).toEqual(gameConfig.apexGate);
    expect(exit(NEXUS, 'loc_silver_gate')).toEqual(worldCondition(gates['gate_breach_door'] ?? ''));
    expect(exit(APEX, 'loc_conflux_chamber')).toEqual(worldCondition(gates['gate_tyrant_tear'] ?? ''));
  });

  test('reachability inside the region: the Glowlands (the road’s door from the Plateau) reach the Nexus, and the Apex once its gate holds', () => {
    const inRegion = new Map<string, Location>(parsedLocations.map((l) => [l.id, l]));
    const reach = (from: string, open: (when: Condition) => boolean): string[] => {
      const seen = new Set<string>([from]);
      const queue = [from];
      for (let i = 0; i < queue.length; i++) {
        for (const e of inRegion.get(queue[i] ?? '')?.exits ?? []) {
          if (!inRegion.has(e.to) || seen.has(e.to) || (e.when !== undefined && !open(e.when))) continue;
          seen.add(e.to);
          queue.push(e.to);
        }
      }
      return [...seen].sort();
    };
    // Loop 1 terms: no Echoes, no Before; the quest counter is satisfiable (six completed quests)
    const loop1 = (when: Condition): boolean => JSON.stringify(when).includes('"counter"');
    expect(reach(GLOWLANDS, loop1)).toEqual([APEX, NEXUS, GLOWLANDS].sort());
    expect(reach(GLOWLANDS, () => false)).toEqual([NEXUS, GLOWLANDS].sort());
    expect(reach(APEX, () => false)).toEqual([APEX, NEXUS, GLOWLANDS].sort()); // the way back down is open
    // WORLD §3.13: the Apex road ends … Glowlands → Nexus → Apex (8 watches from the Ruins, W10)
    expect(section(WORLD, '### 3.13', '### Conventions for §4–6')).toContain('| loc_temporal_breach_apex | … Glowlands → Nexus → Apex (8; W10) |');
  });

  test('from loc_whispering_ruins the Apex is reachable through a neighbouring region once one lands (the Highlands’ Plateau, U44; the Steppe’s Reedmarch Descent, U46); until then rule 8 reports it pending, never an error', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    const mineIds = new Set([GLOWLANDS, NEXUS, APEX]);
    const r8 = report.warnings.filter((w) => w.rule === 'rule-08' && mineIds.has(w.id));
    // the same pack read as complete (no incomplete tables): those are the errors rule 8 exists for
    const strictErrors = validateContent(pack, { strict: false }).errors.filter((e) => e.rule === 'rule-08' && mineIds.has(e.id));
    if (pack.locations['loc_sky_whisper_plateau'] !== undefined || pack.locations['loc_reedmarch_descent'] !== undefined) {
      // order-agnostic (U44, U46): the road is whole, so the three are reachable and rule 8 says nothing about them
      expect(r8).toEqual([]);
      expect(strictErrors).toEqual([]);
    } else {
      expect(r8.map((w) => w.id)).toEqual([GLOWLANDS, NEXUS, APEX, GLOWLANDS, NEXUS, APEX]);
      for (const w of r8) {
        expect(w.message.startsWith('pending — content not yet authored (reference): ')).toBe(true);
        expect(w.message).toContain('loc_sky_whisper_plateau'); // WORLD §3.13: … Plateau → Glowlands → Nexus → Apex
        expect(w.message).toMatch(/not found in locations$/);
      }
      expect(strictErrors.map((e) => [e.id, e.message.split(' (')[0]])).toEqual([
        [GLOWLANDS, 'unreachable from the start location loc_whispering_ruins'],
        [NEXUS, 'unreachable from the start location loc_whispering_ruins'],
        [APEX, 'unreachable from the start location loc_whispering_ruins'],
        [GLOWLANDS, 'legacy location unreachable in Loop 1'],
        [NEXUS, 'legacy location unreachable in Loop 1'],
        [APEX, 'legacy location unreachable in Loop 1'],
      ]);
    }
    // and a pack whose locations are all authored and connected has nothing to report (the fixture's road joins them)
    const fixture = buildContentPack(miniContentTables, { validate: false });
    expect(validateContent(fixture, { incompleteTables: INCOMPLETE_TABLES }).warnings.filter((w) => w.rule === 'rule-08')).toEqual([]);
  });
});

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6', () => {
  /** Every creature but the Tyrants, whose stat lines carry SP (worldDoc's reader is for the SP = ATK lines). */
  const plain = parsedCreatures.filter((c) => !TYRANTS.includes(c.id));

  test('exactly the creatures whose first region is the Glowlands, the Nexus or the Apex (D-090), with the Tyrant’s Reach and the Horde Husk (the brief, D-091)', () => {
    const first = Object.values(CREATURE_TABLE).filter((r) => /^(Glowlands|Nexus|Chronos Nexus|Apex)\b/.test(r.regions)).map((r) => r.id);
    expect(first.sort()).toEqual(
      ['cr_chronos_tyrant_contained', 'cr_chronos_tyrant_unveiled', 'cr_glowfen_mireling', 'cr_hour_leech', 'cr_hourglass_crawler', 'cr_lantern_toad', 'cr_orrery_knight', 'cr_spore_drift', 'cr_temporal_aberration'].sort(),
    );
    expect(CREATURE_TABLE['cr_tyrants_reach']?.regions).toBe('Highlands; Unveiled Tyrant add');
    expect(CREATURE_TABLE['cr_horde_husk']?.regions).toBe('Horde (any infected node)');
    expect(DECISIONS.slice(DECISIONS.indexOf('### D-091'))).toContain('`cr_horde_husk` has no first region in WORLD §6');
    expect(creatures.map((c) => c.id).sort()).toEqual([...first, 'cr_tyrants_reach', 'cr_horde_husk'].sort());
  });

  test('name, family, role, level and XP as WORLD’s table (the Orrery Knight’s XP by DESIGN §6.2, D-062)', () => {
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, row?.name.startsWith(c.name), c.family, c.role, c.level]).toEqual([c.id, true, row?.family, row?.role, row?.level]);
      if (c.id !== 'cr_orrery_knight') expect([c.id, c.xp]).toEqual([c.id, row?.xp]);
    }
    // WORLD writes 588 (326.8 × 1.8); DESIGN §6.2's rounded fodder × 1.8 is 589 (the engine's expectedKillXp)
    expect([CREATURE_TABLE['cr_orrery_knight']?.xp, byId(creatures, 'cr_orrery_knight').xp]).toEqual([588, 589]);
  });

  test('XP follows DESIGN §6.2: fodder round(20 + 8L + 1.2L²), elite ×1.8, anomaly ×1.3 of the rounded fodder; the Tyrants 900 / 1,600', () => {
    const fodder = (L: number): number => Math.round(20 + 8 * L + 1.2 * L * L);
    const mult = { fodder: 1, elite: 1.8, anomaly: 1.3 } as const;
    for (const c of creatures) if (c.role !== 'boss') expect([c.id, c.xp]).toEqual([c.id, Math.round(fodder(c.level) * mult[c.role as keyof typeof mult])]);
    expect(section(DESIGN, '### 6.2 XP sources', '### 6.3')).toContain('Contained Tyrant 900; Unveiled 1,600');
    expect([byId(creatures, CONTAINED).xp, byId(creatures, UNVEILED).xp]).toEqual([900, 1600]);
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK (the Tyrants’ SP is DESIGN’s, below)', () => {
    for (const c of plain) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
  });

  test('resistances and immunities as WORLD’s Resist line; breach-born and construct carry theirs', () => {
    const resistLine = (id: string) => {
      const text = bullet(block(id), 'Resist:');
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
      if (c.tags.includes('breach_born')) expect(c.statusImmunities).toContain('status_poison');
      if (c.tags.includes('construct')) expect((['status_poison', 'status_bleed'] as const).every((x) => c.statusImmunities.includes(x))).toBe(true);
    }
    expect(bullet(block(CONTAINED), 'Resist:')).toContain('Taunt ignored; Stagger allowed');
    for (const id of TYRANTS) expect([id, cr(id).tauntImmune, cr(id).interruptible, cr(id).fleeable]).toEqual([id, true, true, false]);
  });

  test('moves: every WORLD intent id with its telegraph verbatim; every move reached by a pattern (but the Spore Drift’s death burst); telegraphs ≤ 12 words', () => {
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
      if (c.communion) used.add(c.communion.pressMove);
      const unused = Object.keys(c.moves).filter((id) => !used.has(id));
      expect([c.id, unused]).toEqual([c.id, c.id === 'cr_spore_drift' ? ['spore_burst'] : []]);
      for (const m of Object.values(c.moves)) expect([c.id, m.line, words(m.line) <= 12]).toEqual([c.id, m.line, true]);
    }
    // WORLD's `onDeath`: no pattern condition or hook fires at death (DESIGN §4.2) — the burst waits for one
    expect(block('cr_spore_drift')).toContain('`spore_burst` · "It bursts, sweetly." · 0.8× all · poison 100% 4 · onDeath');
    // the Contained form's Phase 2 and the Unveiled's Phases 1–3 name the Contained's moves "as Contained": same records
    for (const id of ['tyr_grasp', 'tyr_shear', 'tyr_time_lash', 'tyr_remember', 'tyr_gather', 'tyr_chrono_strike', 'tyr_unraveling']) {
      expect([id, cr(UNVEILED).moves[id]]).toEqual([id, cr(CONTAINED).moves[id]]);
    }
  });

  test('moves carry WORLD’s numbers: the multiplier and stat, type, statuses and their chances, hidden chips', () => {
    const m = (c: string, id: string) => cr(c).moves[id];
    const hit = (c: string, id: string) => [m(c, id)?.type, m(c, id)?.power?.coef, m(c, id)?.power?.stat];
    const rows = (c: string, id: string) => m(c, id)?.statuses.map((s) => [s.status.slice('status_'.length), s.chance, s.duration, s.target]);
    expect(hit('cr_glowfen_mireling', 'mireling_spit')).toEqual(['ley', 0.9, 'sp']);
    expect(rows('cr_glowfen_mireling', 'mireling_spit')).toEqual([['poison', 0.5, 4, 'target']]);
    expect(hit('cr_glowfen_mireling', 'mireling_drag')).toEqual(['physical', 1.1, 'atk']);
    expect(rows('cr_glowfen_mireling', 'mireling_breathe_in')).toEqual([['regen', 1, 3, 'self']]);
    expect(m('cr_glowfen_mireling', 'mireling_breathe_in')?.statuses[0]?.power).toEqual({ base: 0, coef: 0.3, stat: 'atk' }); // regen 0.3×/3
    expect(m('cr_lantern_toad', 'toad_swallow_light')?.shield?.power).toEqual({ base: 0, coef: 1, stat: 'atk', hits: 1 }); // shield self 1.0×
    expect(rows('cr_lantern_toad', 'toad_lure')).toEqual([['blind', 0.5, 2, 'target']]);
    expect(rows('cr_spore_drift', 'spore_bloom')).toEqual([['blind', 0.4, 1, 'target']]);
    expect(hit('cr_temporal_aberration', 'aberration_flicker_strike')).toEqual(['chrono', 1.3, 'sp']);
    expect([m('cr_temporal_aberration', 'aberration_flicker_strike')?.hidden, m('cr_temporal_aberration', 'aberration_future_blow')?.hidden]).toEqual([true, true]);
    expect(hit('cr_hourglass_crawler', 'crawler_pincer')).toEqual(['physical', 1.2, 'atk']);
    expect(rows('cr_hourglass_crawler', 'crawler_pincer')).toEqual([['armor_break', 0.3, 2, 'target']]);
    expect(rows('cr_orrery_knight', 'orrery_align')).toEqual([['mark', 1, 3, 'target']]);
    expect(hit('cr_orrery_knight', 'orrery_conjunction')).toEqual(['chrono', 1.8, 'sp']);
    expect(hit('cr_orrery_knight', 'orrery_epicycle')).toEqual(['physical', 1.1, 'atk']);
    expect(m('cr_hour_leech', 'leech_drink_hour')?.effects).toEqual([{ healOnDamage: { pct: 0.5 } }]); // heals self for 50 % of damage
    expect(Object.values(cr('cr_horde_husk').moves).map((x) => [x.type, x.power?.coef, x.hidden])).toEqual([
      ['physical', 1.1, true],
      ['chrono', 0.8, true],
      ['void', 1.4, true],
    ]);
    expect(m('cr_tyrants_reach', 'reach_dead_spell')?.special).toBe('bound_mage');
    expect(m('cr_tyrants_reach', 'reach_withdraw')?.leaveCombat).toBe(true);
    for (const id of ['aberration_rewind', 'crawler_turn_over', 'orrery_retrograde', 'leech_coil']) {
      const owner = parsedCreatures.find((c) => id in c.moves) as Creature;
      expect([id, rows(owner.id, id)]).toEqual([id, [['rewind', 1, 2, 'self']]]);
    }
  });

  test('loot: gold ranges and every item WORLD lists, with WORLD’s gates (the anomalies’ guaranteed material at 100 %)', () => {
    for (const c of plain) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      const loot = new Set<string>(c.loot.map((l) => l.itemId));
      for (const id of w.lootIds) expect([c.id, id, loot.has(id)]).toEqual([c.id, id, true]);
      expect([c.id, [...loot].sort()]).toEqual([c.id, [...new Set(w.lootIds)].sort()]);
    }
    const row = (c: string, item: string) => cr(c).loot.filter((l) => l.itemId === item).map((l) => [l.chance, l.count, l.when]);
    expect(row('cr_temporal_aberration', 'item_aberrant_eye')).toEqual([[1, 1, { quest: { id: 'q_unlidded_eye', status: 'active' } }]]);
    expect(row('cr_tyrants_reach', 'item_aetherium_shard')).toEqual([[0.5, 1, { location: 'loc_aetherium_spires' }]]);
    expect(row('cr_tyrants_reach', 'mat_frayed_moment')).toEqual([[1, 1, undefined]]);
    expect(row('cr_hour_leech', 'mat_frayed_moment')).toEqual([[1, 2, undefined]]);
    expect(row('cr_orrery_knight', 'item_chronal_dust')).toEqual([[1, 2, undefined]]);
    expect(row('cr_lantern_toad', 'mat_glow_gland')).toEqual([[0.5, 1, undefined], [0.3, 1, undefined]]);
    // the Tyrants: none for the Contained (legacy); the Unveiled's shards (one per phase, four on a kill) and Frayed Moments
    expect(bullet(block(CONTAINED), 'Loot:')).toContain('none (legacy)');
    expect([cr(CONTAINED).loot, cr(CONTAINED).gold]).toEqual([[], { min: 0, max: 0 }]);
    expect(bullet(block(UNVEILED), 'Loot:')).toContain('`mat_tyrant_shard` 1 per phase cleared (DESIGN §8.2; max 4) · `mat_frayed_moment` ×3');
    expect(cr(UNVEILED).loot.map((l) => [l.itemId, l.count, l.chance])).toEqual([['mat_tyrant_shard', cr(UNVEILED).phases.length, 1], ['mat_frayed_moment', 3, 1]]);
  });

  test('legacy descriptions verbatim (the Mireling, the Aberration, the Tyrant); bestiary voice, entry and tactics verbatim; family codex entries', () => {
    for (const c of parsedCreatures) {
      const b = block(c.id);
      const legacy = /- \*\*Legacy description:\*\* "([^"]+)"/.exec(b)?.[1];
      if (legacy !== undefined) expect([c.id, c.description]).toEqual([c.id, flat(legacy)]);
      else if (c.id === UNVEILED) expect(c.description).toBe(cr(CONTAINED).description); // the same mass
      else expect([c.id, words(c.description) <= 30]).toEqual([c.id, true]);
      const voice = /- \*\*Bestiary\*\* \((Remnant Archive|Wayfinder's Notes)\)/.exec(b)?.[1];
      expect([c.id, c.bestiary.voice]).toEqual([c.id, voice === 'Remnant Archive' ? 'remnant_archive' : 'wayfinder_notes']);
      expect([c.id, c.bestiary.summary]).toEqual([c.id, playText(bullet(b, 'Bestiary'))]);
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, playText(bullet(b, 'Tactics:'))]);
      expect(c.bestiary.codexId).toBe(`codex_creatures_${c.family.slice('fam_'.length)}`);
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
    }
    expect([cr('cr_glowfen_mireling').legacyName, cr('cr_temporal_aberration').legacyName, cr(CONTAINED).legacyName, cr(UNVEILED).legacyName]).toEqual([
      'Glowfen Mireling',
      'Temporal Aberration',
      'The Chronos Tyrant',
      undefined,
    ]);
  });
});

// ---- Patterns, walked by the engine ------------------------------------------------------------------------------------------

/** WORLD's cadence words, turn by turn: the moves `id` commits to (by `generateIntent`), its phase and HP set per turn. */
function plan(
  id: string,
  turns: number,
  o: { phase?: number; from?: number; before?: (turn: number, foe: Combatant, combat: CombatState, s: GameState) => void } = {},
): string[] {
  const profile = freshProfile();
  const s = makeState({ level: 12 }, { content: pack, profile });
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1)], pack, profile);
  const combat = beginCombat(ctx, { id: 'enc_test', groups: [{ creatureId: id, count: 1 }], fleeable: false, onFlee: 'hold', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] } satisfies EncounterSpec);
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
/** A location the player has already stood at this loop: its items spawned, its first-visit fight behind it. */
const stood = (): GameState['world']['locationStates'][string] => ({
  visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: ['enc_nexus_aberration'], encounterClearedDay: {}, eventsFired: [], flags: {},
  unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
});

describe('patterns: WORLD’s cadence words hold turn by turn (first-match on every turn; two cycled moves alternate)', () => {
  test('the Green: Breathe In first; Glow Burst / Flop / Bloom on every third turn; Swallow Light while you are Blinded', () => {
    expect(plan('cr_glowfen_mireling', 9)).toEqual(seq('breathe_in drag glow_burst drag spit glow_burst spit drag glow_burst'));
    expect(plan('cr_lantern_toad', 6, { before: (t, _f, c) => withStatus(player(c), 'status_blind', t === 2 || t === 3) })).toEqual(seq('lure swallow_light swallow_light tongue tongue flop'));
    expect(plan('cr_spore_drift', 6)).toEqual(seq('sweet_air settle bloom settle sweet_air bloom'));
  });

  test('Watch-wardens: the Aberration’s Future Blow every third turn and one Rewind below half; the self-Rewinds wait while theirs runs', () => {
    expect(plan('cr_temporal_aberration', 8, { before: (t, f) => hpAt(t >= 4 ? 0.4 : 1)(f) })).toEqual(seq('flicker_strike past_blow future_blow rewind flicker_strike future_blow flicker_strike past_blow'));
    expect(plan('cr_hourglass_crawler', 8)).toEqual(seq('sand pincer sand dig_in sand pincer sand dig_in'));
    const rewound = (t: number, f: Combatant): void => {
      hpAt(0.4)(f);
      withStatus(f, 'status_rewind', t === 6);
    };
    expect(plan('cr_hourglass_crawler', 4, { from: 5, before: rewound })).toEqual(seq('turn_over pincer turn_over turn_over'));
    const marked = (t: number, f: Combatant, c: CombatState): void => {
      withStatus(player(c), 'status_mark', t <= 3);
      hpAt(t >= 7 ? 0.4 : 1)(f);
    };
    expect(plan('cr_orrery_knight', 7, { before: marked })).toEqual(
      seq('align epicycle conjunction epicycle epicycle epicycle retrograde'),
    );
    expect(plan('cr_hour_leech', 6)).toEqual(seq('attach attach drink_hour attach attach drink_hour'));
    expect(plan('cr_hour_leech', 2, { from: 4, before: (_t, f) => hpAt(0.4)(f) })).toEqual(seq('coil coil'));
  });

  test('the Unravelled: the Husk Comes Apart below a third; the Reach casts its dead spell every second turn and withdraws at the Spires from round 4', () => {
    expect(plan('cr_horde_husk', 5, { before: (t, f) => hpAt(t >= 4 ? 0.25 : 1)(f) })).toEqual(seq('claw flicker claw come_apart come_apart'));
    expect(plan('cr_tyrants_reach', 4)).toEqual(seq('grasp dead_spell grasp dead_spell'));
    const spires = (t: number, _f: Combatant, _c: CombatState, s: GameState) => void (s.world.currentLocationId = t >= 5 ? 'loc_aetherium_spires' : APEX);
    expect(plan('cr_tyrants_reach', 6, { before: spires })).toEqual(seq('grasp dead_spell grasp dead_spell withdraw dead_spell'));
  });

  test('the Contained Tyrant: Brace on every second turn between the three strikes; the Fracture’s rotation with one Remember; the Nine Speak', () => {
    expect(plan(CONTAINED, 7)).toEqual(seq('grasp brace shear brace time_lash brace grasp'));
    expect(plan(CONTAINED, 16, { phase: 1 })).toEqual(seq('korr_burns vane_closes gather gather chrono_strike aulde_sings sallow_breathes remember korr_burns vane_closes gather gather chrono_strike aulde_sings sallow_breathes korr_burns'));
    expect(plan(CONTAINED, 4, { phase: 2 })).toEqual(seq('remember unraveling unraveling unraveling'));
  });

  test('the Unveiled Tyrant: it speaks while unhurt, then the Phase 1 moves; Remember and Gather every third turn among them; Unraveling every turn', () => {
    expect(plan(UNVEILED, 6, { before: (t, f) => hpAt(t >= 4 ? 0.99 : 1)(f) })).toEqual(seq('speak speak speak time_lash grasp shear'));
    expect(plan(UNVEILED, 11, { phase: 1, from: 5 })).toEqual(seq('time_lash remember grasp shear remember time_lash grasp remember shear time_lash remember'));
    // the wind-up holds it two turns and the strike lands on the third; a Gather begins on every third turn it reaches
    expect(plan(UNVEILED, 12, { phase: 2, from: 7 })).toEqual(seq('time_lash grasp gather gather chrono_strike shear time_lash grasp gather gather chrono_strike shear'));
    expect(plan(UNVEILED, 3, { phase: 3 })).toEqual(seq('unraveling unraveling unraveling'));
  });
});

// ---- The Tyrants vs DESIGN §4.10 ---------------------------------------------------------------------------------------------

describe('the Tyrants vs DESIGN §4.10, field by field (D-062: DESIGN owns the numbers)', () => {
  const S410 = section(DESIGN, '### 4.10 Boss framework', '### 4.11');
  const row = (id: string): string => flat(tableRows(S410).find((c) => c[0] === `\`${id}\``)?.join(' | ') ?? '');
  const C1 = row(CONTAINED);
  const U2 = row(UNVEILED);

  test('stats: HP / ATK / SP / armor / ward / AGI', () => {
    for (const [id, text] of [[CONTAINED, C1], [UNVEILED, U2]] as const) {
      const n = /\| (\d+) \/ (\d+) \/ (\d+) \/ (\d+) \/ (\d+) \/ (\d+) \|/.exec(text)?.slice(1).map(Number);
      expect([id, cr(id).stats]).toEqual([id, { hp: n?.[0], atk: n?.[1], sp: n?.[2], armor: n?.[3], ward: n?.[4], agi: n?.[5] }]);
    }
    expect(C1).toContain('XP 900');
    expect(U2).toContain('XP 1,600');
    expect(C1).toContain('Immune Stun/Slow/Poison/Bleed; Taunt ignored; Stagger allowed. Resist Chrono, Void; weak Ley.');
  });

  test('every move’s type, multiplier and stat as DESIGN writes it; statuses with their chances and durations', () => {
    const TYPE: Record<string, string> = { Physical: 'physical', Chrono: 'chrono', Fire: 'fire', Ley: 'ley' };
    const hits = [...C1.matchAll(/`(tyr_[a-z_]+)` \((?:hidden 2-turn wind-up; )?(Physical|Chrono|Fire|Ley) `(\d\.\d)·(ATK|SP)`/g)].map((m) => [m[1], TYPE[m[2] ?? ''], Number(m[3]), (m[4] ?? '').toLowerCase()]);
    expect(hits.map((h) => h[0])).toEqual(['tyr_grasp', 'tyr_shear', 'tyr_time_lash', 'tyr_korr_burns', 'tyr_vane_closes', 'tyr_chrono_strike', 'tyr_sallow_breathes', 'tyr_unraveling']);
    for (const [id, type, coef, stat] of hits) {
      const m = cr(CONTAINED).moves[id as string];
      expect([id, m?.type, m?.power?.coef, m?.power?.stat]).toEqual([id, type, coef, stat]);
    }
    const shields = [...C1.matchAll(/`(tyr_[a-z_]+)` \(shield self `(\d\.\d)·SP`\)/g)].map((m) => [m[1], Number(m[2])]);
    expect(shields).toEqual([['tyr_brace', 0.6], ['tyr_aulde_sings', 1.0]]);
    for (const [id, coef] of shields) expect([id, cr(CONTAINED).moves[id as string]?.shield?.power]).toEqual([id, { base: 0, coef, stat: 'sp', hits: 1 }]);
    const rows = (id: string) => cr(CONTAINED).moves[id]?.statuses.map((s) => [s.status, s.chance, s.duration, s.target, s.when]);
    for (const [id, snippet, expected] of [
      ['tyr_grasp', 'Slow 100% 2', [['status_slow', 1, 2, 'target', undefined]]],
      ['tyr_korr_burns', 'Burn 60% 3', [['status_burn', 0.6, 3, 'target', undefined]]],
      ['tyr_vane_closes', 'Armor Break 60% 3', [['status_armor_break', 0.6, 3, 'target', undefined]]],
      ['tyr_chrono_strike', 'Stun 1 unless the target Guarded', [['status_stun', 1, 1, 'target', { playerGuarding: false }]]],
      ['tyr_sallow_breathes', 'Poison 70% 4; **no regen**', [['status_poison', 0.7, 4, 'target', undefined]]],
      ['tyr_remember', '`tyr_remember` (self Rewind 2)', [['status_rewind', 1, 2, 'self', undefined]]],
      ['tyr_unraveling', 'Armor Break 100% 2) every turn', [['status_armor_break', 1, 2, 'target', undefined]]],
    ] as const) {
      expect(C1).toContain(snippet);
      expect([id, rows(id)]).toEqual([id, expected]);
    }
    expect(C1).toContain('`tyr_gather` → `tyr_chrono_strike` (hidden 2-turn wind-up');
    expect(cr(CONTAINED).moves['tyr_gather']).toMatchObject({ hidden: true, windUp: { turns: 2, then: 'tyr_chrono_strike' } });
    expect(cr(CONTAINED).moves['tyr_chrono_strike']?.hidden).toBe(true);
  });

  test('the Contained’s phases: ids, names, triggers, the Aberrations at 40 % (one solo), ×1.5 taken in Phase 3; WORLD’s transition lines', () => {
    const c = cr(CONTAINED);
    expect(c.phases.map((p) => [p.id, p.name, p.enterWhen])).toEqual([
      ['tyr_movement_1', 'The Holding', []],
      ['tyr_movement_2', 'The Fracture', [{ hpBelow: 0.66 }]],
      ['tyr_movement_3', 'The Nine Speak', [{ hpBelow: 0.33 }, { round: 12 }]],
    ]);
    for (const s of ['**`tyr_movement_1` The Holding** (100–66%)', '**`tyr_movement_2` The Fracture** (`hpBelow 0.66`)', '**`tyr_movement_3` The Nine Speak** (`hpBelow 0.33` OR `round 12`)']) expect(C1).toContain(s);
    expect(C1).toContain('`onEnter` spawn 2× `cr_temporal_aberration` at 40% HP (1 if no companion)');
    expect(c.phases[1]?.adds).toEqual([{ creatureId: 'cr_temporal_aberration', count: 2, countSolo: 1, hpPct: 0.4 }]);
    expect(C1).toContain('takes ×1.5 damage');
    expect(c.phases.map((p) => p.damageTakenMult)).toEqual([1, 1, 1.5]);
    // Remember once in each phase it appears in (a step-scoped once-key per phase)
    expect(c.phases.map((p) => JSON.stringify(p.pattern).includes('"oncePerFight":true'))).toEqual([false, true, true]);
    expect(JSON.stringify(c.phases[2]?.pattern)).not.toContain('tyr_brace'); // "no more Brace"
    const W = block(CONTAINED);
    expect(flat(W)).toContain(`*Transition (<66%):* "${c.phases[1]?.line}"`);
    expect(flat(W)).toContain(`*Transition (<33% or round 12):* "${c.phases[2]?.line}"`);
  });

  test('the Contained’s effective HP stays inside DESIGN §6.6’s budget (≤ 850 for a level-11 party)', () => {
    const c = cr(CONTAINED);
    const sp = c.stats.sp;
    const brace = 2 * 0.6 * sp; // "0.6·SP every second P1 turn, ≈30"
    const aulde = 2 * 1.0 * sp; // "1.0·SP per P2 rotation, ≈26–52"
    const rewinds = 2 * 0.1 * c.stats.hp; // two Rewinds capped at 10 %
    const adds = 2 * 0.4 * cr('cr_temporal_aberration').stats.hp; // 2 × 112
    const p3Bonus = 0.33 * c.stats.hp * (1 - 1 / 1.5); // the P3 ×1.5 taken
    const effective = c.stats.hp + brace + aulde + rewinds + adds - p3Bonus;
    expect(section(DESIGN, '### 6.6', '### 6.7')).toContain('≈ **≤ 850**');
    expect(effective).toBeLessThanOrEqual(850);
    expect(Math.round(effective)).toBe(809);
  });

  test('the Unveiled’s phases: Lament, the Nine Surface (two Reaches, max 2 alive, 5 in all), Chrono-Strike, the Hold Fails (+10 % per round)', () => {
    const u = cr(UNVEILED);
    expect(u.phases.map((p) => [p.id, p.name, p.enterWhen])).toEqual([
      ['tyr_movement_1', 'Lament', []],
      ['tyr_movement_2', 'The Nine Surface', [{ hpBelow: 0.75 }]],
      ['tyr_movement_3', 'Chrono-Strike', [{ hpBelow: 0.5 }]],
      ['tyr_phase_4', 'The Hold Fails', [{ hpBelow: 0.25 }, { round: 20 }]],
    ]);
    for (const s of ['**`tyr_movement_1`** "Lament" (100–75%)', '**`tyr_movement_2`** "The Nine Surface" (`hpBelow 0.75`)', '**`tyr_movement_3`** "Chrono-Strike" (`hpBelow 0.5`)', '**`tyr_phase_4`** "The Hold Fails" (`hpBelow 0.25` OR `round 20`)']) {
      expect(U2).toContain(s);
    }
    expect(U2).toContain('spawn 2× `cr_tyrants_reach` (90 HP each; bound mages rolled without repeat; one more each time one dies, max 2 alive and 5 in total');
    expect(u.phases[1]?.adds).toEqual([{ creatureId: 'cr_tyrants_reach', count: 2, hpPct: 1, reinforce: { maxAlive: 2, total: 5 } }]);
    expect(cr('cr_tyrants_reach').stats.hp).toBe(90);
    expect(U2).toContain('outgoing damage +10% per round in this phase (uncapped)');
    expect(u.phases.map((p) => p.damageDealtRampPerRound)).toEqual([0, 0, 0, 0.1]);
    expect(U2).toContain('`tyr_speak` first (no action)');
    expect(u.moves['tyr_speak']).toMatchObject({ line: "It speaks: 'You have crossed. So.'", statuses: [] });
    expect(u.moves['tyr_speak']?.power).toBeUndefined();
    const W = flat(block(UNVEILED));
    for (const [i, from] of [[1, '<75%'], [2, '<50%'], [3, '<25% or round 20']] as const) expect(W).toContain(`*Transition (${from}):* "${u.phases[i]?.line}"`);
  });

  test('the fixture Tyrants (tests/fixtures, checked against DESIGN) agree where they model the same thing; the cut-down parts are DESIGN’s here', () => {
    const fixture = buildContentPack(combatTables(), { validate: false });
    const fc = fixture.creatures[FIXTURE_CONTAINED] as Creature;
    const fu = fixture.creatures[UNVEILED] as Creature;
    expect(cr(CONTAINED).stats).toEqual(fc.stats);
    expect(cr(UNVEILED).stats).toEqual(fu.stats);
    for (const [id, m] of Object.entries(fc.moves)) {
      expect([id, cr(CONTAINED).moves[id]?.type, cr(CONTAINED).moves[id]?.power, cr(CONTAINED).moves[id]?.shield, cr(CONTAINED).moves[id]?.statuses]).toEqual([id, m.type, m.power, m.shield, m.statuses]);
    }
    expect(cr(CONTAINED).phases.map((p) => [p.enterWhen, p.adds, p.damageTakenMult])).toEqual(fc.phases.map((p) => [p.enterWhen, p.adds, p.damageTakenMult]));
    // DESIGN over the fixture: four phases, the Reaches as Phase 2's adds, no round trigger before Phase 4
    expect([fu.phases.length, cr(UNVEILED).phases.length]).toEqual([3, 4]);
    expect(fu.phases[1]?.adds[0]?.creatureId).toBe('cr_temporal_aberration');
  });
});

// ---- The communion vs DESIGN §4.11, WORLD §6.8 and STORY §8.3 ---------------------------------------------------------------

describe('the Unveiled Tyrant’s communion vs DESIGN §4.11, WORLD §6.8’s table and STORY §8.3', () => {
  const spec = cr(UNVEILED).communion;
  const table = tableRows(block(UNVEILED)).filter((c) => (c[0] ?? '').startsWith('`tyr_movement_'));
  const S411 = flat(section(DESIGN, '### 4.11 Communion', '### 4.12'));

  test('opens with echo_tyrant_speaks (Listen opens it otherwise); the press is tyr_hour_presses, WORLD’s line', () => {
    expect(spec?.opensWith).toEqual([{ echo: 'echo_tyrant_speaks' }]);
    expect(S411).toContain('once the player holds `echo_tyrant_speaks`, or from the moment the player chooses **Listen**');
    expect(spec?.pressMove).toBe('tyr_hour_presses');
    expect(cr(UNVEILED).moves['tyr_hour_presses']).toMatchObject({ special: 'hour_presses', type: 'chrono' });
    expect(flat(block(UNVEILED))).toContain(`\`tyr_hour_presses\` · "${cr(UNVEILED).moves['tyr_hour_presses']?.line}"`);
  });

  test('three Movements mirroring the phases, with WORLD’s question ids and lines in WORLD’s order', () => {
    expect(spec?.movements.map((m) => m.id)).toEqual(table.map((c) => /`(tyr_movement_\d)`/.exec(c[0] ?? '')?.[1]));
    spec?.movements.forEach((m, i) => {
      const questions = [...(table[i]?.[1] ?? '').matchAll(/`(tyr_q_[a-z]+)` "([^"]+)"/g)].map((q) => [q[1], q[2]]);
      expect([m.id, m.questions.map((q) => [q.id, q.line])]).toEqual([m.id, questions]);
    });
    expect(S411).toContain('Movement I has three questions, Movement II six (five askers plus Hallow\'s silence), Movement III one (the choice)');
  });

  test('answers: WORLD’s Echoes (+1), the two perfect ones (+2), the honest answer (+1), a lie (−2), Korr by Corruption, Mireya by presence; verse IV for Hallow (STORY §12)', () => {
    const answers = Object.fromEntries((spec?.movements ?? []).flatMap((m) => m.questions.map((q) => [q.id, q.answers.map((a) => [a.id, a.when, a.resolve, a.lie])])));
    const e = (echo: string, resolve = 1) => [echo.replace('echo_', ''), { echo }, resolve, false];
    expect(answers).toEqual({
      tyr_q_why: [e('echo_tyrant_jailer'), ['to_kill_you', { all: [] }, 1, false], ['lie_lost', { all: [] }, -2, true], e('echo_tyrant_never_struck')],
      tyr_q_hour: [e('echo_thirtieth_dawn')],
      tyr_q_before: [e('echo_seven_wayfinders')],
      tyr_q_korr: [e('echo_litany_verse_2'), e('echo_korr_marginalia'), ['corruption', { corruption: { min: 3 } }, 1, false]],
      tyr_q_vane: [e('echo_litany_verse_3'), e('echo_stone_hide_origin')],
      tyr_q_aulde: [e('echo_litany_verse_5'), e('echo_spire_note')],
      tyr_q_sallow: [e('echo_litany_verse_6'), e('echo_breathing_pool'), ['mireya_present', { companion: { id: 'mireya', state: 'active' } }, 1, false]],
      // U56 (STORY §11.4 `q_his_masters_sin` stage 2): Caelum answers Masque himself (pinned in companions_u56.test.ts)
      tyr_q_masque: [
        e('echo_litany_verse_7'),
        e('echo_eye_of_masque'),
        e('echo_ritual_inevitable', 2),
        ['caelum_answers', { all: [{ companion: { id: 'caelum', state: 'active' } }, { quest: { id: 'q_his_masters_sin', status: 'active' } }] }, 1, false],
      ],
      tyr_q_hallow: [e('echo_hallow_said_stop', 2), e('echo_litany_verse_4')],
      tyr_q_choice: [['choose', { resolve: { min: 3 } }, 0, false]],
    });
    const cell = (i: number): string => table[i]?.[2] ?? '';
    for (const s of ['`echo_tyrant_jailer` +1', 'the honest "to kill you" +1; a lie −2', '`echo_thirtieth_dawn` +1', '`echo_seven_wayfinders` +1', '`echo_tyrant_never_struck` also answers `tyr_q_why`, +1']) expect(cell(0)).toContain(s);
    for (const s of ['verse 2 or `echo_korr_marginalia` +1 (Corruption ≥ 3 also +1 here', 'verse 3 or `echo_stone_hide_origin` +1', 'verse 5 or `echo_spire_note` +1', 'verse 6 or `echo_breathing_pool` +1 (automatic with Mireya active)', 'verse 7 or `echo_eye_of_masque` +1, `echo_ritual_inevitable` +2', '`echo_hallow_said_stop` +2']) {
      expect(cell(1)).toContain(s);
    }
    expect(cell(2)).toContain('Resolve ≥ 3: let you pass');
    expect(STORY).toContain('| `echo_litany_verse_4` | The Cradle | Hallow\'s Cairn (`q_bone_road`); or Before | Answers Hallow\'s silence;');
    // the verse answers speak STORY §2.3's canonical text
    const litany = flat(section(STORY, '### 2.3 The Litany of the Conflux', '### 2.4'));
    for (const q of spec?.movements[1]?.questions ?? []) for (const a of q.answers) if (a.id.startsWith('litany_verse_')) expect([a.id, litany.includes(a.text.split('. ')[0] ?? '')]).toEqual([a.id, true]);
    // STORY §10.1: Masque's perfect answer
    expect(STORY).toContain('Key line (Masque): "Tell us true." Player: "It failed."');
    expect(spec?.movements[1]?.questions.find((q) => q.id === 'tyr_q_masque')?.answers.find((a) => a.id === 'ritual_inevitable')?.text).toBe('It failed.');
  });

  test('Offer: DESIGN’s four items and values, never consumed; the anchor sets flag_anchor_offered', () => {
    expect(spec?.offers).toEqual([
      { itemId: 'item_chronos_lens', resolve: 1, effects: [] },
      { itemId: 'item_stabilized_heartstone', resolve: 1, effects: [] },
      { itemId: 'item_breach_anchor', resolve: 2, effects: [{ setFlag: 'flag_anchor_offered' }] },
      { itemId: 'item_heartstone_core', resolve: -2, effects: [] },
    ]);
    expect(S411).toContain('`item_chronos_lens` +1; `item_stabilized_heartstone` +1; `item_breach_anchor` +2 (sets `flag_anchor_offered`); `item_heartstone_core` **−2**');
  });

  test('Listen speaks a codex fragment per Movement (STORY §14’s Tyrant entries); no lash rides on it (D-069.8, D-081)', () => {
    expect(spec?.movements.map((m) => m.listen?.effects)).toEqual([[{ unlockCodex: 'codex_tyrant_holding' }], [{ unlockCodex: 'codex_tyrant_six' }], [{ unlockCodex: 'codex_veyran_thal' }]]);
    for (const id of ['codex_tyrant_holding', 'codex_tyrant_six', 'codex_veyran_thal']) expect(STORY).toContain(`| \`${id}\` |`);
    expect(S411).toContain('no damage rider (D-069.8)');
  });

  test('the Resolution: pass into the Before or beyond (F) at ≥ 3, take its place (A) at ≥ 6 with the Litany, the Mending (B) at 8 with STORY §10.2’s requirements', () => {
    expect(spec?.outcomes.map((o) => [o.choiceId, o.minResolve, o.effects])).toEqual([
      ['pass_into_before', 3, []],
      ['pass_beyond', 3, [{ setFlag: 'flag_refused_all_paths' }, { ending: 'ending_unbound' }]],
      ['take_its_place', 6, [{ ending: 'ending_wardens_vigil' }]],
      ['consent_mending', 8, [{ grantEcho: 'echo_tyrant_consent' }, { ending: 'ending_mending' }]],
    ]);
    expect(spec?.outcomes[2]?.when).toEqual({ echo: 'echo_litany_complete' });
    // STORY §10.2's block, less what the Resolution itself is (Resolve 8, spared, at the Apex)
    const b = /### 10\.2 `ending_mending`[\s\S]*?```\n([\s\S]*?)```/.exec(STORY)?.[1] ?? '';
    const reqs = worldCondition(flat(b).replace(/\s/g, '')) as { all: Condition[] };
    const rest = reqs.all.filter((c) => !('resolve' in c) && !('location' in c) && JSON.stringify(c) !== JSON.stringify({ flag: 'flag_tyrant_spared' }));
    expect(spec?.outcomes[3]?.when).toEqual({ all: rest });
    // F: STORY §10.6 "refusing every other offer sets flag_refused_all_paths"; WORLD's ending exit reads it
    expect(STORY).toContain('then refusing every other offer sets\n`flag_refused_all_paths`');
    expect(WL[APEX]?.block).toContain('| beyond ⟂ | ending F | `{all:[{loop:{min:2}},{flag:"flag_tyrant_spared"},{flag:"flag_refused_all_paths"}]}`');
  });

  test('in the engine: Loop 2 at the Apex the fight opens on its words, it does not strike while unhurt, Listen opens Movement I and answers count', () => {
    const stub = (id: `codex_${string}`): CodexEntryInput => ({ id, title: 'Test stub', voice: 'wayfinder_notes', category: 'the_nine', body: 'Test stub.' });
    const withCodex = buildContentPack({ ...contentTables, codex: (['codex_tyrant_holding', 'codex_tyrant_six', 'codex_veyran_thal'] as const).map(stub) }, { incompleteTables: INCOMPLETE_TABLES });
    const prof: Profile = freshProfile({ loopCounter: 2, echoes: ['echo_apex_resonance'] });
    const s0 = makeState({ loop: 2, level: 18, locationId: NEXUS }, { content: withCodex, profile: prof });
    let out = step(s0, { type: 'move', to: APEX }, withCodex, prof);
    const rejected = (events: readonly GameEvent[]) => events.filter((e) => e.t === 'actionRejected');
    expect(rejected(out.events)).toEqual([]);
    expect(out.state.mode).toBe('combat');
    const tyrant = () => (out.state.combat as CombatState).enemies[0] as Combatant;
    expect(tyrant().refId).toBe(UNVEILED);
    expect(out.state.combat?.intents[tyrant().uid]?.moveId).toBe('tyr_speak');
    const commune = (a: Action) => legalActions(out.state, withCodex, out.profile).some((l) => JSON.stringify(l) === JSON.stringify(a));
    expect(commune({ type: 'commune', act: 'listen' })).toBe(true);
    out = step(out.state, { type: 'commune', act: 'listen' }, withCodex, out.profile);
    expect(rejected(out.events)).toEqual([]);
    expect(out.state.combat?.communion).toMatchObject({ movement: 1, resolve: 2, questionIndex: 0 });
    expect(out.profile.codexUnlocked).toContain('codex_tyrant_holding');
    out = step(out.state, { type: 'commune', act: 'speak', answerId: 'to_kill_you' }, withCodex, out.profile);
    expect(rejected(out.events)).toEqual([]);
    expect(out.state.combat?.communion).toMatchObject({ resolve: 3, answered: ['tyr_q_why'] });
    // Guard instead of a blow: it speaks again rather than strike first (D-067.12)
    const guarded = step(s0, { type: 'move', to: APEX }, withCodex, prof);
    const after = step(guarded.state, { type: 'guard' }, withCodex, guarded.profile);
    expect(rejected(after.events)).toEqual([]);
    expect(after.events.filter((e) => e.t === 'damageDealt' && e.sourceUid === ((after.state.combat as CombatState).enemies[0] as Combatant).uid)).toEqual([]);
  });

  test('in the engine: Loop 1 the Apex asks Face it / Not yet; Face it starts the Contained Tyrant, Not yet walks back to the Nexus', () => {
    const prof: Profile = freshProfile({ echoes: ['echo_apex_resonance'] }); // the gate's Echo branch, for the test (D-048)
    // stood at the Nexus already (its first-entry items are not authored yet, D-090)
    const s0 = makeState({ level: 11, locationId: NEXUS, patch: (st) => void (st.world.locationStates[NEXUS] = stood()) }, { content: pack, profile: prof });
    const up = step(s0, { type: 'move', to: APEX }, pack, prof);
    expect(isApexPromptOpen(up.state)).toBe(true);
    expect(up.events.some((e) => e.t === 'eventFired' && e.eventId === 'ev_apex_rend')).toBe(true);
    const face = step(up.state, { type: 'choose', choiceId: APEX_FACE_IT }, pack, up.profile);
    expect(face.state.mode).toBe('combat');
    expect(((face.state.combat as CombatState).enemies[0] as Combatant).refId).toBe(CONTAINED);
    const back = step(up.state, { type: 'choose', choiceId: APEX_NOT_YET }, pack, up.profile);
    expect([back.state.mode, back.state.world.currentLocationId]).toEqual(['explore', NEXUS]);
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the real pack with Glowlands & Nexus registered (D-090)', () => {
  test('builds; the barrel carries the folder; the region’s three locations, eleven creatures and no NPCs are in the pack', () => {
    expect(REGION_FOLDERS.some((f) => f.region === region)).toBe(true);
    expect(pack.regions[REGION]?.name).toBe('Glowlands & Nexus');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.id).toBe(c.id);
    expect(contentTables.regions).toContain(region);
  });

  test('validates with 0 errors; nothing real is reported about the region; its pending references name only tables still being authored', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const about = report.warnings.filter((w) => mine.has(w.id) || locations.some((l) => w.message.includes(` ${l.id}`)));
    const real = about.filter((w) => !w.message.startsWith('pending — content not yet authored'));
    // the only real warnings are placements of this region's creatures in other regions (the exploited-Depths crawlers), pinned
    // in that region's test; D-098 (U34d) left the Horde's own placements (the husks at the Corridor, the Camp and the Gate) out
    // of rule 11 (D-091 gap 6)
    expect([...new Set(real.map((w) => `${w.rule} ${w.id}`))].sort()).toEqual(['rule-11 cr_hourglass_crawler']);
    for (const w of real) expect(w.message).toMatch(/loc_(darkened_corridor|heartstone_depths|ironclad_camp|scorched_gate)/);
    for (const w of about.filter((x) => x.message.startsWith('pending — content not yet authored (reference): '))) {
      const table = /not found in ([a-z]+)$/.exec(w.message)?.[1];
      expect([w.message, INCOMPLETE_TABLES.includes(table as (typeof INCOMPLETE_TABLES)[number])]).toEqual([w.message, true]);
    }
  });

  test('`npm run validate`: exit 0, 0 errors', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    expect(out.join('\n')).toMatch(/validate: ok — 0 errors, \d+ warning\(s\)/);
    // order-agnostic (U44): before the Highlands landed the road to the Apex was pending (six rule-08 references); with them
    // landed it is whole, and whatever rule 8 still reports belongs to regions not yet authored (the line says only a count)
    if (pack.locations['loc_sky_whisper_plateau'] === undefined && pack.locations['loc_reedmarch_descent'] === undefined) {
      expect(out.join('\n')).toMatch(/pending rule-08: 6 reference\(s\) into tables still being authored/);
    }
  });

  test('the pending references are exactly the ids WORLD/STORY/DESIGN spell: neighbouring locations, quests, codex entries (items since U49/U50, Echoes and endings since U51, Mireya since D-111 resolve)', () => {
    const { report } = parseContentPack(contentTables);
    const targets = new Set(report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message));
    // the neighbouring locations drop out as their regions land (the Steppe's Reedmarch Descent, U46; the Highlands' Plateau, U44), and
    // the codex entries as the codex units land them (the Tyrant's three, U60; the region's and the creature families', U61)
    const stillPending = (id: string): boolean =>
      !((id.startsWith('loc_') && pack.locations[id] !== undefined) || (id.startsWith('codex_') && pack.codex[id] !== undefined));
    expect([...targets].sort()).toEqual(
      [
        'loc_sky_whisper_plateau', 'loc_reedmarch_descent', 'loc_lantern_causeway', 'loc_silver_gate', 'loc_conflux_chamber', 'loc_aetherium_spires',
        // (every item and material dropped out when U49 authored the gear and U50 the rest: the items table is complete; the
        // Aberration's quest drop resolved when U53 authored `q_unlidded_eye`)
        'codex_region_glowlands_nexus', 'codex_creatures_green', 'codex_creatures_watch_wardens', 'codex_creatures_unravelled',
        'codex_tyrant_holding', 'codex_tyrant_six', 'codex_veyran_thal',
        // (`mireya`, the companion record, dropped out when D-111 registered the six companions)
      ]
        .filter(stillPending)
        .sort(),
    );
    expect(targets.has('mireya')).toBe(false);
    expect(pack.companions['mireya']?.npcId).toBe('npc_mireya');
    // every one is an id the documents spell
    const docs = `${WORLD}\n${STORY}\n${DESIGN}`;
    for (const id of targets) expect([id, docs.includes(id)]).toEqual([id, true]);
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U45 reply -----------------------------------------

describe('authored words outside the documents are few and short; coined ids are the listed ones', () => {
  test('encounter intros, the rest text, the non-legacy descriptions, the Reach’s dead-spell and the Chrono-Strike telegraphs, the answer texts', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro)).filter((t): t is string => t !== undefined);
    expect(intros.length).toBe(9);
    for (const t of intros) expect([t, words(t) <= 30]).toEqual([t, true]);
    expect(loc(NEXUS).rest?.text).toBe("You rest in the astronomers' cell, where time is honest.");
    expect(WL[NEXUS]?.block).toContain("(the astronomers' cell, where time is honest)");
    expect([cr('cr_tyrants_reach').moves['reach_dead_spell']?.line, cr(CONTAINED).moves['tyr_chrono_strike']?.line]).toEqual(['The limb works a spell that is not its own.', 'The hour falls.']);
    // (U56's `caelum_answers` is Caelum's own line, not this unit's: companions_u56.test.ts pins it)
    for (const q of (cr(UNVEILED).communion?.movements ?? []).flatMap((m) => m.questions)) for (const a of q.answers) if (a.id !== 'caelum_answers') expect([a.id, words(a.text) <= 20]).toEqual([a.id, true]);
  });

  test('ids this unit coined (WORLD/STORY have none for them): encounter ids, answer and outcome ids, two ambient overrides', () => {
    expect(parsedLocations.flatMap((l) => l.encounters.map((e) => e.id))).toEqual([
      'enc_glowlands_mireling', 'enc_glowlands_toad_spore',
      'enc_nexus_aberration', 'enc_nexus_hour_leech', 'enc_nexus_crawlers', 'enc_nexus_orrery_knight', 'enc_nexus_pool_crawler',
      'enc_apex_contained', 'enc_apex_unveiled',
    ]);
    expect(cr(UNVEILED).communion?.outcomes.map((o) => o.choiceId)).toEqual(['pass_into_before', 'pass_beyond', 'take_its_place', 'consent_mending']);
    expect(ids(JSON.stringify(locations), 'ambient')).toEqual(['ambient_chronos_nexus', 'ambient_temporal_breach_apex']);
    // every move id but the Chrono-Strike's own (DESIGN names it) and the Reach's dead spell is WORLD's
    for (const c of parsedCreatures) for (const id of Object.keys(c.moves)) expect([c.id, id, WORLD.includes(`\`${id}\``)]).toEqual([c.id, id, true]);
  });
});

// ---- D-098 (U34d): the orrery's dust "with the key" --------------------------------------------------------------------------

describe('the orrery (D-098, U34d: a condition on one effect of an event)', () => {
  test('`ev_nexus_orrery` grants the eyepiece’s Echo with the Lens or the key, and the two Chronal Dust only with the key', () => {
    const stand = (id: `item_${string}`, name: string) => ({ id, name, type: 'key' as const, tier: 0, description: 'Stand-in (test only).', value: 1, art: { icon: 'key' }, tags: [] });
    const extra = [stand('item_orrery_key', 'Orrery Key'), { ...stand('item_chronal_dust', 'Chronal Dust'), type: 'material' as const, stackable: true }];
    const epack = buildContentPack({ ...contentTables, items: [...contentTables.items, ...extra.filter((i) => pack.items[i.id] === undefined)] }, { validate: false });
    const orrery = byId(loc(NEXUS).events, 'ev_nexus_orrery');
    const fire = (carry: string[]) => {
      const ctx = scriptedCtx(makeState({ loop: 2, locationId: NEXUS, items: carry }, { content: epack }), [], epack, freshProfile({ loopCounter: 2 }));
      fireEvent(ctx, NEXUS, orrery);
      return { echoes: ctx.s.echoesThisLoop, dust: ctx.s.player.inventory.filter((i) => i.itemId === 'item_chronal_dust').reduce((n, i) => n + i.qty, 0) };
    };
    const echo = epack.echoes['echo_eye_of_masque'] === undefined ? [] : ['echo_eye_of_masque'];
    expect(fire(['item_chronos_lens'])).toEqual({ echoes: echo, dust: 0 });
    expect(fire(['item_orrery_key'])).toEqual({ echoes: echo, dust: 2 });
    expect(fire(['item_chronos_lens', 'item_orrery_key'])).toEqual({ echoes: echo, dust: 2 });
  });
});
