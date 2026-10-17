// U43: Mistwood & the Ironclad Reach — checked against the documents at test time (WORLD §2.2, §3.2, §4, §6, §10.1, §10.3,
// §11.1–11.3, §12.1; PLAN Appendix A; DESIGN §6.2, §6.5, §17.1; STORY's codex id). The legacy text is checked against the
// Python source in tests/unit/content/legacy.test.ts. The pattern is U42's (silverwood_ruins.test.ts): read the region's
// WORLD blocks with regions/worldDoc.ts, hold every record to them field by field, prove reachability from the start across
// both landed regions, then build the real pack and pin what `npm run validate` and the engine say about it while other
// tables are still being authored. Where a record departs from the letter of WORLD (a reading the schema forces), the test
// pins the departure so a later edit cannot move it silently.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { REGION_FOLDERS } from '@content/regions';
import { creatures } from '@content/regions/mistwood_ironclad_reach/creatures';
import { items } from '@content/regions/mistwood_ironclad_reach/items';
import { locations } from '@content/regions/mistwood_ironclad_reach/locations';
import { npcs } from '@content/regions/mistwood_ironclad_reach/npcs';
import { region } from '@content/regions/mistwood_ironclad_reach/region';
import { locations as ruinsLocations } from '@content/regions/silverwood_ruins/locations';
import { companions } from '@content/shared/companions';
import { validateContent } from '@content/validate';
import { evaluate, legalActions, step, type GameState } from '@engine/index';
import { CreatureSchema, walkSteps, type Creature, type Step } from '@schema/creature';
import { LocationSchema, type Location } from '@schema/location';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { main as validateCli } from '../../../../tools/validate-content';
import { WORLD, appendixLegacyLocations, ids, section, tableRows, unquote, worldCreature, worldCreatureTable, worldEdges, worldLocations, worldNodes } from './worldDoc';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');
const LEGACY_PY = fs.readFileSync(path.join(ROOT, 'legacy/echoes_of_aethelgard.py'), 'utf8');

const REGION = 'region_mistwood_ironclad_reach';
const RUINS_REGION = 'region_silverwood_ruins';
const REACH = section(WORLD, '### 3.2 Mistwood & the Ironclad Reach', '### 3.3');
const WL = Object.fromEntries(worldLocations(REACH).map((l) => [l.id, l]));
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
const words = (text: string): number => text.split(/\s+/).length;
const here = new Set<string>(locations.map((l) => l.id));

const MP = 'loc_mistwood_path';
const WY = 'loc_wayfarers_respite';
const IC = 'loc_ironclad_camp';
const BP = 'loc_barren_peaks';
const BO = 'loc_blighted_outpost';
const EF = 'loc_emberforge';
const WR = 'loc_whispering_ruins';

// ---- Engine helpers -----------------------------------------------------------------------------------------------------------

type QuestSpec = 'active' | 'completed';
const questState = (status: QuestSpec) => ({ status, stage: 'u43', startedDay: 1, endedDay: status === 'completed' ? 1 : null, counters: {}, objectivesDone: [] as string[] });

interface At {
  seed?: string;
  loop?: number;
  flags?: Record<string, boolean>;
  quests?: Record<string, QuestSpec>;
  /** Echoes granted this loop (the pack has no echo records yet, so they are set directly). */
  echoes?: string[];
  /** The `horde_moves` counter (engine-written once a Horde runs). */
  hordeMoves?: number;
}

/** A state on the real pack, standing at `locationId`, with the given flags, quests, Echoes and Horde counter. */
function stateAt(locationId: string, o: At = {}): GameState {
  const overrides: StateOverrides = {
    locationId,
    seed: o.seed ?? 'u43',
    ...(o.loop === undefined ? {} : { loop: o.loop }),
    flags: o.flags ?? {},
    patch: (s) => {
      for (const [id, status] of Object.entries(o.quests ?? {})) s.quests[id] = questState(status);
      for (const id of o.echoes ?? []) s.echoesThisLoop.push(id);
      if (o.hordeMoves !== undefined) s.counters.custom['horde_moves'] = o.hordeMoves;
    },
  };
  return makeState(overrides, { content: pack });
}
const profileOf = (o: At = {}) => freshProfile({ loopCounter: o.loop ?? 1 });
const holds = (cond: Parameters<typeof evaluate>[0], locationId: string, o: At = {}): boolean => evaluate(cond, stateAt(locationId, o), profileOf(o), pack);
/** Walk to `to` from the state `from` stands in. */
const arrive = (from: string, to: string, o: At = {}) => step(stateAt(from, o), { type: 'move', to }, pack, profileOf(o)).state;
const movesFrom = (locationId: string, o: At = {}): string[] =>
  legalActions(stateAt(locationId, o), pack, profileOf(o))
    .filter((a) => a.type === 'move')
    .map((a) => (a as { to: string }).to)
    .sort();

// ---- The region ---------------------------------------------------------------------------------------------------------------

describe('region_mistwood_ironclad_reach vs WORLD §2.2, §10.1, DESIGN §6.5, §17.1', () => {
  const S22 = section(WORLD, '### 2.2 `region_mistwood_ironclad_reach`', '### 2.3');

  test('id, name, legacy, faction, band, description (WORLD’s theme text), order and codex entry', () => {
    expect(region.id).toBe(REGION);
    expect(S22).toContain(`### 2.2 \`${REGION}\` — ${region.name}`);
    expect(region.legacy).toBe(true);
    expect(region.factionId).toBe('ironclad');
    expect(S22).toContain('Ironclad Nomads (Camp, Outpost, Emberforge)');
    expect(S22).toContain('| Level band | 2–6 |');
    expect(region.levelBand).toEqual({ min: 2, max: 6 });
    expect(S22.replace(/\n/g, ' ')).toContain(region.description);
    expect(region.order).toBe(2);
    expect(region.codexId).toBe('codex_region_mistwood_reach');
    expect(STORY).toContain('`codex_region_mistwood_reach`');
    expect(DESIGN).toMatch(/\| Mistwood & the Ironclad Reach \| `region_mistwood_ironclad_reach` \| 2–6 \|/);
  });

  test('the six locations WORLD lists, in WORLD’s order, all in the region; the Ruins’ band ends where this one starts overlapping', () => {
    const listed = /\| Locations \(6\) \| ([^|]+) \|/.exec(S22)?.[1]?.split(',').map((s) => s.trim()) ?? [];
    expect(listed).toEqual([MP, WY, IC, BP, BO, EF]);
    expect(locations.map((l) => l.id)).toEqual(listed);
    for (const l of locations) expect(l.regionId).toBe(REGION);
    expect(Object.keys(WL)).toEqual(listed);
    for (const l of locations) expect([l.id, l.levelBand.min >= region.levelBand.min && l.levelBand.max <= region.levelBand.max]).toEqual([l.id, true]);
  });

  test('the wandering pool is WORLD §10.1’s pool_mistwood_ironclad_reach, weight for weight; return chance 20 %; every entry is in-band fodder', () => {
    const row = tableRows(section(WORLD, '### 10.1 Wandering pools', '### 10.2')).find((c) => unquote(c[0] ?? '') === 'pool_mistwood_ironclad_reach');
    expect(row).toBeDefined();
    const entries = [...(row?.[1] ?? '').matchAll(/(cr_[a-z_]+) (\d+)/g)].map((m) => ({ creatureId: m[1], weight: Number(m[2]) }));
    expect(entries).toHaveLength(3);
    expect(region.wanderingPool).toEqual(entries);
    expect(region.returnEncounterChance).toBe(0.2);
    // "Only fodder whose level sits in the band" (§10.1); the Prowler is the Ruins' record
    for (const e of entries) {
      const c = pack.creatures[e.creatureId ?? ''];
      expect([e.creatureId, c?.role, (c?.level ?? 0) >= 2 && (c?.level ?? 99) <= 6]).toEqual([e.creatureId, 'fodder', true]);
    }
    // the Peaks' Loop 2+ hound is a location encounter (the pool has no per-location entries)
    expect(row?.[2]).toContain('loc_barren_peaks Loop 2+: 15% cr_stutter_hound');
  });

  test('palette: DESIGN §17.1’s Mistwood row (sky top, sky bottom, mid, accent = glow)', () => {
    const row = tableRows(section(DESIGN, '### 17.1 Palettes', '### 17.2')).find((c) => c[0] === 'Mistwood & the Ironclad Reach');
    const hex = (row ?? []).slice(1).map((c) => /#[0-9A-Fa-f]{6}/.exec(c)?.[0]);
    expect(hex).toHaveLength(6);
    expect(region.palette).toEqual({ bg: hex[0], bgAlt: hex[1], fg: hex[3], accent: hex[5], glow: hex[5] });
  });
});

// ---- The locations ------------------------------------------------------------------------------------------------------------

describe('the six locations vs WORLD §3.2 blocks', () => {
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
      const got = l.exits.map((e) => ({ dir: e.dir, to: e.to, conditional: e.when !== undefined }));
      expect([l.id, got]).toEqual([l.id, WL[l.id]?.exits]);
    }
    // only the Peaks pass and the scorched gate are gated; every exit costs one watch (§11.2)
    const gated = parsedLocations.flatMap((l) => l.exits.filter((e) => e.when !== undefined).map((e) => `${l.id}>${e.to}`));
    expect(gated).toEqual([`${IC}>${BP}`, `${BO}>loc_scorched_gate`]);
    for (const l of parsedLocations) for (const e of l.exits) expect([l.id, e.to, e.travelWatches]).toEqual([l.id, e.to, 1]);
  });

  test('rest points and merchants as WORLD says; the Camp has no stall of its own (the caravan is a later unit’s)', () => {
    const merchantOf = (id: string): string | null => WL[id]?.merchant ?? /Merchant\/crafter: yes\*\* \((npc_[a-z_]+)/.exec(WL[id]?.block ?? '')?.[1] ?? null;
    for (const l of parsedLocations) {
      const rest = l.rest === undefined ? 'no' : l.rest.when === undefined ? 'yes' : 'cond';
      expect([l.id, rest, l.merchantId ?? null]).toEqual([l.id, WL[l.id]?.rest, merchantOf(l.id)]);
    }
    expect(parsedLocations.map((l) => [l.id, l.rest?.kind ?? null])).toEqual([[MP, null], [WY, 'inn'], [IC, 'inn'], [BP, null], [BO, null], [EF, 'camp']]);
    expect(byId(parsedLocations, WY).rest?.cost).toBe(10); // DESIGN §9.5 / WORLD §9.1: Kaelen's Inn, 10 gold
    expect(byId(parsedLocations, IC).rest?.cost).toBe(10);
    expect(byId(parsedLocations, EF).craftingStation).toBe('forge');
    expect(parsedLocations.filter((l) => l.craftingStation !== undefined).map((l) => l.id)).toEqual([EF]); // "the only crafter" (DESIGN §8)
  });

  test('every item WORLD places is placed, and nothing else; the Mistwood node gathers the Rootbone', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const placed = new Set(l.items.map((i) => i.itemId));
      const expected = new Set(w?.itemIds ?? []);
      if (l.id === MP) {
        // gathering is a node, not a placed item (schema: one item per node, 1–2 a day); the Ley Resin is not gatherable here
        expect(l.gather).toEqual({ itemId: 'mat_rootbone', perDay: 1 });
        expect(expected.has('mat_rootbone') && expected.has('mat_ley_resin')).toBe(true);
        expected.delete('mat_rootbone');
        expected.delete('mat_ley_resin');
      } else expect(l.gather).toBeUndefined();
      if (l.id === BO) {
        // Tobrin's failsafe copy is in the Events bullet, not the Items bullet
        expect(w?.block).toContain('`item_breach_anchor_schematic_b` (100%, once per loop');
        expected.add('item_breach_anchor_schematic_b');
      }
      expect([l.id, [...placed].sort()]).toEqual([l.id, [...expected].sort()]);
    }
    // what lies on the ground at the first entry is the legacy Tonic only; the rest is found by examining
    expect(byId(parsedLocations, MP).items).toHaveLength(1);
    expect(byId(parsedLocations, MP).items[0]).toMatchObject({ itemId: 'item_ley_touched_tonic', hidden: false, count: 1 });
    const hidden = (loc: string) => byId(parsedLocations, loc).items.filter((i) => i.hidden).map((i) => i.itemId);
    expect([hidden(BP), hidden(BO)]).toEqual([['mat_wildling_hide'], ['mat_slate_core', 'item_breach_anchor_schematic_b']]);
    expect(byId(parsedLocations, BP).items[0]?.when).toEqual({ killed: { id: 'cr_wildling_brute' } });
    expect(byId(parsedLocations, BO).items[0]?.when).toEqual({ killed: { id: 'cr_stone_hide_golem', count: 2 } }); // "after both Golems fall"
    expect(byId(parsedLocations, BO).items[1]?.when).toEqual({ all: [{ loop: { min: 2 } }, { echo: 'echo_vask_seal' }] });
    expect(byId(parsedLocations, EF).items[0]).toMatchObject({ itemId: 'item_tobrins_warding_primer', when: { all: [{ loop: { min: 2 } }, { echo: 'echo_vask_seal' }] } });
  });

  test('every creature WORLD names in a block’s Encounters line is in that location’s encounters, and vice versa', () => {
    for (const l of parsedLocations) {
      const got = new Set(l.encounters.flatMap((e) => e.groups.map((g) => g.creatureId)));
      expect([l.id, [...got].sort()]).toEqual([l.id, [...(WL[l.id]?.creatureIds ?? [])].sort()]);
    }
  });

  test('first-visit fights: Prowlers ×2 at 50 %, else Rootlings ×3 at 30 % overall (a sequential roll); none once the Heartstone is destroyed', () => {
    const [prowlers, rootlings] = byId(parsedLocations, MP).encounters;
    expect(prowlers).toMatchObject({ id: 'enc_mistwood_prowlers', groups: [{ creatureId: 'cr_mistwood_prowler', count: 2 }], chance: 0.5, once: true, respawn: 'never', fleeable: true, onFlee: 'scatter' });
    expect(rootlings).toMatchObject({ id: 'enc_mistwood_rootlings', groups: [{ creatureId: 'cr_rootling', count: 3 }], respawn: 'never', fleeable: true });
    // the engine runs the first group whose roll succeeds: the second's own chance is 0.3 / (1 − 0.5)
    expect((1 - (prowlers?.chance ?? 0)) * (rootlings?.chance ?? 0)).toBeCloseTo(0.3, 10);
    for (const e of [prowlers, rootlings]) expect(e?.when).toEqual({ not: { flag: 'flag_heartstone_destroyed' } });
    expect(REACH).toContain('first: cr_mistwood_prowler ×2 (50%) or cr_rootling ×3 (30%)');
  });

  test('story gates and Horde fights hold (R10-1): the Brute under q_clear_path, the Golems under q_blighted_outpost, the Camp’s husks', () => {
    const peaks = byId(parsedLocations, BP);
    expect(byId(peaks.encounters, 'enc_peaks_brute_gate')).toMatchObject({
      groups: [{ creatureId: 'cr_wildling_brute', count: 1 }],
      when: { quest: { id: 'q_clear_path', status: 'active' } },
      fleeable: false,
      onFlee: 'hold',
      onVictory: [{ scatter: { location: BP } }],
    });
    // the gate comes first and its victory scatters the plain group, so one kill is paid once
    expect(peaks.encounters.map((e) => e.id)).toEqual(['enc_peaks_brute_gate', 'enc_peaks_brute', 'enc_peaks_stutter_hound']);
    expect(byId(peaks.encounters, 'enc_peaks_brute')).toMatchObject({ chance: 1, fleeable: true, onFlee: 'scatter', once: true });
    expect(byId(peaks.encounters, 'enc_peaks_brute').when).toBeUndefined();

    const outpost = byId(parsedLocations, BO);
    expect(byId(outpost.encounters, 'enc_outpost_golems_gate')).toMatchObject({
      groups: [{ creatureId: 'cr_stone_hide_golem', count: 2 }], // one group of two (WORLD)
      when: { quest: { id: 'q_blighted_outpost', status: 'active' } },
      optionalWhen: { echo: 'echo_stone_hide_origin' }, // DESIGN §13.3 #8
      fleeable: false,
      onFlee: 'hold',
      onVictory: [{ scatter: { location: BO } }],
    });
    expect(byId(outpost.encounters, 'enc_outpost_golems')).toMatchObject({ groups: [{ creatureId: 'cr_stone_hide_golem', count: 2 }], chance: 1, fleeable: true, onFlee: 'scatter' });
    expect(outpost.encounters.map((e) => e.id)).toEqual(['enc_outpost_golems_gate', 'enc_outpost_golems', 'enc_outpost_pillar']);

    const camp = byId(parsedLocations, IC);
    expect(camp.encounters).toHaveLength(1);
    expect(camp.encounters[0]).toMatchObject({ id: 'enc_camp_husks', groups: [{ creatureId: 'cr_horde_husk', count: 2 }], fleeable: false, onFlee: 'hold' });
    expect(camp.safe).toBe(true);
  });

  test('return fights: the Pillar at 30 % on the Outpost, the Loop 2+ Hound at 15 % on the Peaks; both ahead of the pool’s 20 %', () => {
    const pillar = byId(byId(parsedLocations, BO).encounters, 'enc_outpost_pillar');
    expect(pillar).toMatchObject({ groups: [{ creatureId: 'cr_warding_pillar', count: 1 }], chance: 0.3, once: false, respawn: 'on_return' });
    const hound = byId(byId(parsedLocations, BP).encounters, 'enc_peaks_stutter_hound');
    expect(hound).toMatchObject({ groups: [{ creatureId: 'cr_stutter_hound', count: 1 }], chance: 0.15, once: false, respawn: 'on_return', when: { loop: { min: 2 } } });
    expect(WL[BO]?.block).toContain('return: cr_warding_pillar ×1 (30%, it was always there, dormant) or pool 20%');
    expect(WL[BP]?.block).toContain('Loop 2+ 15% cr_stutter_hound ×1');
  });

  test('settlements spawn no fights: the Respite, the Camp and the Emberforge are `safe`; the other three are not', () => {
    expect(parsedLocations.filter((l) => l.safe).map((l) => l.id)).toEqual([WY, IC, EF]);
    expect(WL[WY]?.block).toContain('none, ever (neutral ground, D-014)');
    expect(WL[EF]?.block).toContain('**Encounters:** none.');
    expect(byId(parsedLocations, WY).encounters).toEqual([]);
    expect(byId(parsedLocations, EF).encounters).toEqual([]);
  });

  test('events: every WORLD event, its text verbatim, legacy ids with the ev_ prefix, once; the Forge’s Heartstone texts are three coined companions', () => {
    for (const l of parsedLocations) {
      const w = WL[l.id];
      const got = Object.fromEntries(l.events.filter((e) => !e.id.startsWith('ev_forge_pulse_')).map((e) => [e.id, e.text]));
      const expected = Object.fromEntries(Object.entries(w?.events ?? {}).map(([id, text]) => [id.startsWith('ev_') ? id : `ev_${id}`, text]));
      expect([l.id, got]).toEqual([l.id, expected]);
      for (const e of l.events) {
        expect([e.id, e.trigger, e.once]).toEqual([e.id, 'enter', true]);
        expect(e.id.startsWith('ev_')).toBe(true);
      }
    }
    const ev = (loc: string, id: string) => byId(byId(parsedLocations, loc).events, id);
    expect(ev(WY, 'ev_respite_brother').when).toEqual({ quest: { id: 'q_clear_path', status: 'completed' } });
    expect(ev(IC, 'ev_camp_bull').when).toEqual({ flag: 'flag_hearthring_caravan' });
    expect(ev(BP, 'ev_peaks_den').when).toEqual({ killed: { id: 'cr_wildling_brute' } });
    expect(ev(BO, 'ev_outpost_seal')).toMatchObject({ when: { killed: { id: 'cr_stone_hide_golem' } }, effects: [{ grantEcho: 'echo_vask_seal' }] });
    for (const id of ['ev_mistwood_herbs', 'ev_mistwood_shapes']) expect(ev(MP, id).when).toBeUndefined();
  });

  test('the Forge pulse: WORLD’s one event varies by Heartstone state — the base text, the two quoted words, the destroyed line; exactly one holds in each state', () => {
    const forge = byId(parsedLocations, EF);
    const base = WL[EF]?.events['ev_forge_pulse'] ?? '';
    expect(base).toContain('Heartstone\'s beating fast tonight');
    expect(WL[EF]?.block).toContain('(stabilized: "slow and sure"; exploited: "wrong"; destroyed: "The veins are cold. Borin does not look up.")');
    const text = (id: string) => byId(forge.events, id).text;
    expect(text('ev_forge_pulse')).toBe(base);
    expect(text('ev_forge_pulse_stabilized')).toBe(base.replace('fast', 'slow and sure'));
    expect(text('ev_forge_pulse_exploited')).toBe(base.replace('fast', 'wrong'));
    expect(text('ev_forge_pulse_destroyed')).toBe('The veins are cold. Borin does not look up.');
    const pulse = forge.events.filter((e) => e.id.startsWith('ev_forge_pulse'));
    expect(pulse.map((e) => e.id)).toEqual(['ev_forge_pulse', 'ev_forge_pulse_stabilized', 'ev_forge_pulse_exploited', 'ev_forge_pulse_destroyed']);
    const states: [string, Record<string, boolean>][] = [
      ['ev_forge_pulse', {}],
      ['ev_forge_pulse_stabilized', { flag_heartstone_stabilized: true }],
      ['ev_forge_pulse_exploited', { flag_heartstone_exploited: true }],
      ['ev_forge_pulse_destroyed', { flag_heartstone_destroyed: true }],
    ];
    for (const [want, flags] of states) {
      const firing = pulse.filter((e) => e.when !== undefined && holds(e.when, EF, { flags })).map((e) => e.id);
      expect([want, firing]).toEqual([want, [want]]);
    }
  });

  test('NPC placement: WORLD’s first NPC of each block is placed here; the others (Tessaly’s caravan) are runtime moves', () => {
    for (const l of parsedLocations) {
      const first = WL[l.id]?.npcIds[0];
      if (first === undefined) expect([l.id, l.npcs]).toEqual([l.id, []]);
      else {
        expect([l.id, l.npcs[0]]).toEqual([l.id, first]);
        for (const n of l.npcs) expect(WL[l.id]?.npcIds).toContain(n);
      }
    }
    for (const n of npcs) expect(byId(parsedLocations, n.homeLocationId).npcs).toContain(n.id);
    expect(WL[IC]?.npcIds).toEqual(['npc_brak', 'npc_tessaly_varr']);
    expect(byId(parsedLocations, IC).npcs).toEqual(['npc_brak']);
  });

  test('art: WORLD’s horizon per block; the Emberforge carries DESIGN §17.2’s hand-authored hearth', () => {
    for (const l of parsedLocations) expect([l.id, l.art.horizon]).toEqual([l.id, WL[l.id]?.horizon]);
    expect(parsedLocations.map((l) => l.art.template)).toEqual(['forest', 'camp', 'camp', 'peaks', 'ruins', 'cavern']);
    expect(byId(parsedLocations, EF).art.focal).toBe('emberforge');
    expect(WL[EF]?.block).toContain('horizon 0.52 (cavern)');
  });

  test('state text (WORLD §3.2, §12.1): the Camp doubles after Brak’s two quests, the legacy text kept ahead of the new sentences', () => {
    const camp = byId(parsedLocations, IC);
    const doubled = /\*\*State \(after Brak's two quests\):\*\* `\+` "([^"]+)"/.exec(WL[IC]?.block ?? '')?.[1] ?? 'missing';
    expect(camp.descriptionVariants).toHaveLength(1);
    expect(camp.descriptionVariants[0]?.text).toBe(`${WL[IC]?.description} ${doubled}`);
    expect(camp.descriptionVariants[0]?.when).toEqual({ all: [{ quest: { id: 'q_clear_path', status: 'completed' } }, { quest: { id: 'q_blighted_outpost', status: 'completed' } }] });
    for (const l of parsedLocations) if (l.id !== IC) expect([l.id, l.descriptionVariants]).toEqual([l.id, []]);
  });

  test('Appendix A: the six legacy ids carry their legacy names and region', () => {
    const appendix = appendixLegacyLocations();
    for (const l of locations) expect([l.id, l.legacyName, l.regionId]).toEqual([l.id, appendix[l.id]?.name, appendix[l.id]?.region]);
  });
});

// ---- Map data (WORLD §11) -------------------------------------------------------------------------------------------------------

describe('WORLD §11 map data', () => {
  test('§11.1 nodes: coordinates, band, rest, merchant, settlement, temporallyUnstable', () => {
    for (const l of parsedLocations) {
      const n = NODES[l.id];
      expect(n, l.id).toBeDefined();
      expect([l.id, l.map, l.levelBand, l.temporallyUnstable]).toEqual([l.id, { x: n?.x, y: n?.y }, n?.band, n?.temporallyUnstable]);
      const rest = l.rest === undefined ? '—' : l.rest.when === undefined ? l.rest.kind : 'cond';
      // the Camp's merchant cell is `cond:npc_tessaly_varr` (the caravan after `flag_hearthring_caravan`): no stall in the record
      const merchant = n?.merchant.startsWith('cond:') ? '—' : n?.merchant;
      expect([l.id, rest, l.merchantId ?? '—']).toEqual([l.id, n?.rest, merchant]);
      expect([l.id, l.tags.includes('settlement'), l.safe]).toEqual([l.id, n?.settlement, n?.settlement]);
    }
    expect(NODES[IC]?.merchant).toBe('cond:npc_tessaly_varr');
  });

  test('§11.2 edges: every walk edge touching the region exists with its direction, cost and gate on both sides', () => {
    const walks = EDGES.filter((e) => e.kind === 'walk' && (here.has(e.from) || here.has(e.to)));
    expect(walks).toHaveLength(9); // WR–MP, SP–MP, MP–WY, MP–IC, IC–BP, BP–BO, BO–EF, BO–SW, BO–SG
    for (const e of walks) {
      if (here.has(e.from)) {
        const exit = byId(parsedLocations, e.from).exits.find((x) => x.to === e.to);
        expect([e.from, e.to, exit?.dir, exit?.travelWatches, exit?.when !== undefined]).toEqual([e.from, e.to, e.dir, e.cost, e.gate !== 'open']);
      }
      if (here.has(e.to)) {
        const back = byId(parsedLocations, e.to).exits.find((x) => x.to === e.from);
        expect([e.to, e.from, back?.dir, back?.travelWatches, back?.when !== undefined]).toEqual([e.to, e.from, e.reverseDir, e.reverseCost, e.reverseGate !== 'open']);
      }
    }
    // the Ruins' side of the two cross-region edges (U42 wrote it; it resolves now)
    const ruins = (id: string) => byId(ruinsLocations, id);
    expect(ruins(WR).exits.find((x) => x.to === MP)?.dir).toBe('east');
    expect(ruins('loc_silverwood_plaza').exits.find((x) => x.to === MP)?.dir).toBe('south');
  });

  test('§11.3 gates: the Peaks pass and the scorched gate carry WORLD’s conditions; the pass refuses with the legacy line', () => {
    const gates = section(WORLD, '### 11.3 Gate conditions', '### 11.4');
    const pass = gates.split('\n').find((l) => l.startsWith('| `gate_peaks_pass`')) ?? '';
    const scorched = gates.split('\n').find((l) => l.startsWith('| `gate_scorched_gate`')) ?? '';
    expect(pass).toContain('{any:[{quest:"q_clear_path",stage:"accepted"},{echo:"echo_ironclad_passwords"}]}');
    expect(scorched).toContain('{any:[{quest:"q_blighted_outpost",stage:"completed"},{echo:"echo_nomad_signs"}]}');
    const peaksExit = byId(parsedLocations, IC).exits.find((x) => x.to === BP);
    // "accepted" = in the journal, accepted or later (WORLD §3): the schema's `quest` with neither stage nor status
    expect(peaksExit?.when).toEqual({ any: [{ quest: { id: 'q_clear_path' } }, { echo: 'echo_ironclad_passwords' }] });
    const line = 'I should talk to Brak before going this way.';
    expect(peaksExit?.lockedText).toBe(line);
    expect(pass).toContain(`"${line}"`);
    expect(LEGACY_PY).toContain(`print("${line}")`);
    expect(byId(parsedLocations, BO).exits.find((x) => x.to === 'loc_scorched_gate')?.when).toEqual({
      any: [{ quest: { id: 'q_blighted_outpost', status: 'completed' } }, { echo: 'echo_nomad_signs' }],
    });
  });

  test('exits resolve: the Ruins’ east exit and the Plaza’s south exit reach the Path; only the two Steppe/Highlands targets are still pending', () => {
    const targets = new Set<string>([...locations.flatMap((l) => l.exits.map((e) => e.to)), ...ruinsLocations.flatMap((l) => l.exits.map((e) => e.to))]);
    const unresolved = [...targets].filter((t) => pack.locations[t] === undefined).sort();
    expect(unresolved).toContain('loc_sky_whisper_plateau');
    expect(unresolved).toContain('loc_scorched_gate');
    expect(unresolved).not.toContain(MP);
    for (const t of locations.flatMap((l) => l.exits.map((e) => e.to))) if (!here.has(t) && t !== WR && t !== 'loc_silverwood_plaza') expect(['loc_sky_whisper_plateau', 'loc_scorched_gate']).toContain(t);
    expect(pack.locations[MP]?.exits.map((e) => e.to)).toContain(WR);
  });

  // The BFS runs over every landed location (the Ruins and this region): D-090 keeps the other regions out of the pack.
  const landed = new Map<string, Location>([...ruinsLocations.map((l) => LocationSchema.parse(l)), ...parsedLocations].map((l) => [l.id, l]));
  const reach = (open: (cond: NonNullable<Location['exits'][number]['when']>) => boolean): Map<string, number> => {
    const dist = new Map<string, number>([[WR, 0]]);
    const queue = [WR];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i] ?? '';
      for (const exit of landed.get(at)?.exits ?? []) {
        if (!landed.has(exit.to) || dist.has(exit.to)) continue;
        if (exit.when !== undefined && !open(exit.when)) continue;
        dist.set(exit.to, (dist.get(at) ?? 0) + exit.travelWatches);
        queue.push(exit.to);
      }
    }
    return dist;
  };

  test('reachability: all thirteen landed locations from loc_whispering_ruins in Loop 1 terms (quest gates satisfiable, Echo-only gates closed); the Reach’s depths are WORLD’s 3, 4 and 5 watches', () => {
    const loop1 = reach((cond) => !JSON.stringify(cond).includes('"echo"') || JSON.stringify(cond).includes('"quest"'));
    expect([...loop1.keys()].sort()).toEqual([...landed.keys()].sort());
    expect(landed.size).toBe(13);
    expect([MP, WY, IC, BP, BO, EF].map((id) => loop1.get(id))).toEqual([1, 2, 2, 3, 4, 5]);
    // §10.3 through-route "WR→MP→IC→BP→BO (→EF)": 4 watches (5)
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'mistwood_ironclad_reach');
    expect(row?.[3]).toBe('WR→MP→IC→BP→BO (→EF)');
    expect(row?.[4]).toBe('4 (5)');
    expect([loop1.get(BO), loop1.get(EF)]).toEqual([4, 5]);
  });

  test('with no gate open the Peaks, the Outpost and the Emberforge are closed: the pass needs Brak’s job or the scouts’ words', () => {
    const none = reach(() => false);
    expect([MP, WY, IC].map((id) => none.has(id))).toEqual([true, true, true]);
    expect([BP, BO, EF].map((id) => none.has(id))).toEqual([false, false, false]);
    // the Loop 2+ way: the scouts' challenge words open the pass with no quest
    const words = reach((cond) => JSON.stringify(cond).includes('echo_ironclad_passwords'));
    expect([BP, BO, EF].map((id) => words.has(id))).toEqual([true, true, true]);
  });

  test('§10.3 row: 6 nodes, sweep 6 watches, fights 2.8 first / 0.8 return, worst node 1 from a rest point, rest points WY inn · IC inn · EF camp', () => {
    const row = tableRows(section(WORLD, '### 10.3 Traversal per region', '### 10.4')).find((c) => c[0] === 'mistwood_ironclad_reach') ?? [];
    expect(row.slice(1, 3)).toEqual(['2–6', '6']);
    // the region's own graph is a tree: the shortest walk that visits every node from the gateway is 2·(n − 1) − the longest branch
    const inside = new Map<string, string[]>(parsedLocations.map((l) => [l.id, l.exits.map((e) => e.to).filter((t) => here.has(t))]));
    const edges = [...inside.values()].reduce((n, to) => n + to.length, 0) / 2;
    expect(edges).toBe(parsedLocations.length - 1);
    const depth = (from: string, seen = new Set<string>([from])): number => Math.max(0, ...(inside.get(from) ?? []).filter((t) => !seen.has(t)).map((t) => 1 + depth(t, new Set([...seen, t]))));
    expect(2 * edges - depth(MP)).toBe(Number(row[6]));
    expect(row[6]).toBe('6');

    // expected fights in Loop 1 with no quest open: a fixed group at its chance, the first group that rolls wins (sequential)
    const firstVisit = parsedLocations.reduce((sum, l) => {
      if (l.safe) return sum;
      let left = 1;
      let total = 0;
      for (const e of l.encounters) {
        const text = JSON.stringify(e.when ?? {});
        if (e.respawn === 'on_return' || text.includes('"loop"') || text.includes('"quest"') || text.includes('flag_horde_active')) continue;
        total += left * e.chance;
        left *= 1 - e.chance;
      }
      return sum + total;
    }, 0);
    const returning = parsedLocations.reduce((sum, l) => {
      if (l.safe) return sum;
      const own = l.encounters.filter((e) => e.respawn === 'on_return' && !JSON.stringify(e.when ?? {}).includes('"loop"'));
      const none = own.reduce((p, e) => p * (1 - e.chance), 1) * (1 - region.returnEncounterChance);
      return sum + (1 - none);
    }, 0);
    expect(firstVisit.toFixed(1)).toBe('2.8');
    expect(returning.toFixed(1)).toBe('0.8');
    expect(row[5]).toBe('2.8 / 0.8');
    expect(row[7]).toBe('2.8 / 0.8');

    // "to rest": the worst node's distance to a rest point
    const rests = parsedLocations.filter((l) => l.rest !== undefined).map((l) => l.id);
    const toRest = Math.max(...parsedLocations.map((l) => (rests.includes(l.id) ? 0 : Math.min(...rests.map((r) => bfs(inside, l.id, r))))));
    expect(toRest).toBe(Number(row[8]));
    expect(row[9]).toBe('WY inn, IC inn, EF camp');
  });
});

function bfs(graph: Map<string, string[]>, from: string, to: string): number {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i] ?? '';
    for (const next of graph.get(at) ?? []) {
      if (dist.has(next)) continue;
      dist.set(next, (dist.get(at) ?? 0) + 1);
      queue.push(next);
    }
  }
  return dist.get(to) ?? Infinity;
}

// ---- The creatures -----------------------------------------------------------------------------------------------------------

describe('the creatures vs WORLD §6', () => {
  const fodder = (L: number) => Math.round(20 + 8 * L + 1.2 * L * L);
  const lootRows = (id: string): [string, number][] => {
    const text = /- \*\*Loot:\*\*([\s\S]*?)\n- \*\*/.exec(worldCreature(id).block)?.[1] ?? '';
    return [...text.matchAll(/`((?:item|mat)_[a-z_]+)` (\d+)%/g)].map((m) => [m[1] ?? '', Number(m[2]) / 100]);
  };

  test('exactly the creatures whose first region is Mistwood (D-090), with WORLD’s name, family, role, level and XP; the Prowler stays in the Ruins', () => {
    const mine = Object.values(CREATURE_TABLE).filter((r) => /^Mistwood/.test(r.regions)).map((r) => r.id);
    expect(mine).toHaveLength(5);
    expect(creatures.map((c) => c.id).sort()).toEqual(mine.sort());
    for (const c of creatures) {
      const row = CREATURE_TABLE[c.id];
      expect([c.id, c.name, c.family, c.role, c.level, c.xp]).toEqual([c.id, row?.name, row?.family, row?.role, row?.level, row?.xp]);
    }
    expect(creatures.map((c) => c.id as string)).not.toContain('cr_mistwood_prowler');
    expect(pack.creatures['cr_mistwood_prowler']).toBeDefined();
    expect(CREATURE_TABLE['cr_mistwood_prowler']?.regions).toBe('Silverwood Ruins, Mistwood');
  });

  test('stats: HP · ATK · DEF armor/ward · AGI, with SP = ATK (WORLD: ATK doubles as SP) — including the Golem’s annotated HP line', () => {
    for (const c of creatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.stats]).toEqual([c.id, { hp: w.stats.hp, atk: w.stats.atk, sp: w.stats.atk, armor: w.stats.armor, ward: w.stats.ward, agi: w.stats.agi }]);
    }
    expect(byId(creatures, 'cr_stone_hide_golem').stats.hp).toBe(130); // DESIGN §6.5: Mistwood elite
    expect(DESIGN).toContain('| 40–80 (elite 130) |');
  });

  test('resistances and immunities are exactly WORLD’s Resist line', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      const weak = Object.entries(c.resistances).filter(([, r]) => r === 'weak').map(([t]) => t).sort();
      const resist = Object.entries(c.resistances).filter(([, r]) => r === 'resist').map(([t]) => t).sort();
      expect([c.id, weak, resist]).toEqual([c.id, [...w.weak].sort(), [...w.resist].sort()]);
      expect([c.id, [...c.statusImmunities].sort()]).toEqual([c.id, w.immune.map((s) => `status_${s}`).sort()]);
    }
  });

  test('moves: exactly WORLD’s intent ids with their telegraph lines verbatim; every move used by a pattern; telegraphs ≤ 12 words', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, Object.keys(c.moves).sort()]).toEqual([c.id, Object.keys(w.intents).sort()]);
      for (const [id, line] of Object.entries(w.intents)) expect([c.id, id, c.moves[id]?.line]).toEqual([c.id, id, line]);
      const used = new Set<string>();
      const visit = (s: Step) => {
        if ('move' in s) used.add(s.move);
      };
      walkSteps(c.pattern, [], visit);
      for (const ph of c.phases) walkSteps(ph.pattern, [], visit);
      for (const m of Object.values(c.moves)) if (m.windUp) used.add(m.windUp.then);
      expect([c.id, Object.keys(c.moves).filter((id) => !used.has(id))]).toEqual([c.id, []]);
      for (const m of Object.values(c.moves)) expect(words(m.line)).toBeLessThanOrEqual(12);
    }
  });

  test('loot: gold ranges, every item WORLD lists and its chance (100 % = guaranteed); nothing else', () => {
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      expect([c.id, c.gold]).toEqual([c.id, w.gold]);
      const want = lootRows(c.id);
      expect(want.length).toBeGreaterThan(0);
      expect([c.id, c.loot.map((l) => [l.itemId, l.chance])]).toEqual([c.id, want]);
    }
    // the Brute's armor drops at 25 % (WORLD; legacy 50 %), the Pillar's dust only in the Before (Days 1–3), the Hound's moment is guaranteed
    expect(byId(parsedCreatures, 'cr_wildling_brute').loot.find((l) => l.itemId === 'item_wildling_hide_armor')?.chance).toBe(0.25);
    expect(byId(parsedCreatures, 'cr_warding_pillar').loot.find((l) => l.itemId === 'item_chronal_dust')?.when).toEqual({ any: [{ beforeDay: 1 }, { beforeDay: 2 }, { beforeDay: 3 }] });
    expect(byId(parsedCreatures, 'cr_stutter_hound').loot.find((l) => l.itemId === 'mat_frayed_moment')?.chance).toBe(1);
    expect(byId(parsedCreatures, 'cr_stone_hide_golem').loot.find((l) => l.itemId === 'mat_slate_core')?.chance).toBe(1);
  });

  test('XP and gold follow DESIGN §6.2: fodder round(20 + 8L + 1.2L²), elite ×1.8, anomaly ×1.3; gold [3 + 2L, 6 + 3L], elite ×2', () => {
    const goldOf = (c: Creature) => ({ min: (3 + 2 * c.level) * (c.role === 'elite' ? 2 : 1), max: (6 + 3 * c.level) * (c.role === 'elite' ? 2 : 1) });
    for (const c of parsedCreatures) {
      const factor = c.role === 'elite' ? 1.8 : c.role === 'anomaly' ? 1.3 : 1;
      expect([c.id, c.xp]).toEqual([c.id, Math.round(fodder(c.level) * factor)]);
      expect([c.id, c.gold]).toEqual([c.id, goldOf(c)]);
    }
    expect(parsedCreatures.map((c) => c.xp)).toEqual([71, 41, 200, 111, 117]);
  });

  test('legacy descriptions verbatim (Brute, Golem); bestiary and tactics are WORLD’s text, voice and family codex entry; reveals at 1 and 3 kills', () => {
    const flat = (t: string) => t.replace(/\s*\n\s*/g, ' ').trim();
    for (const c of parsedCreatures) {
      const w = worldCreature(c.id);
      if (w.legacyDescription !== null) expect([c.id, c.description]).toEqual([c.id, w.legacyDescription]);
      expect([c.id, c.bestiary.voice]).toEqual([c.id, w.voice]);
      expect(c.bestiary.codexId).toBe(`codex_creatures_${c.family.slice('fam_'.length)}`);
      const summary = /- \*\*Bestiary\*\* \([^)]*\): ([\s\S]*?)\n- \*\*Tactics/.exec(w.block)?.[1] ?? 'missing';
      expect([c.id, c.bestiary.summary]).toEqual([c.id, flat(summary)]);
      const tactics = /- \*\*Tactics:\*\* ([\s\S]*?)\s*$/.exec(w.block.trimEnd())?.[1] ?? 'missing';
      // (backticks dropped, and the one cross-reference WORLD adds to the Pillar's tactics)
      expect([c.id, c.bestiary.tactics]).toEqual([c.id, flat(tactics).replace(/`/g, '').replace(' (WORLD §3.11)', '')]);
      expect(c.bestiary.reveals).toEqual([{ kills: 1, reveal: 'resist' }, { kills: 3, reveal: 'all' }]);
    }
    expect(['cr_wildling_brute', 'cr_stone_hide_golem'].map((id) => byId(parsedCreatures, id).legacyName)).toEqual(['Wildling Brute', 'Stone-Hide Golem']);
    for (const id of ['cr_rootling', 'cr_warding_pillar', 'cr_stutter_hound']) expect(byId(parsedCreatures, id).legacyName).toBeUndefined();
    // WORLD's legacy line for the Golem keeps its old numbers; the record uses the new ones (D-062)
    expect(worldCreature('cr_stone_hide_golem').block).toContain('legacy: HP 50 · dmg 12 · def 5 · agi 2 · XP 85 · magic resistance 80%');
  });

  test('the Brute (DESIGN §4.12): strike, strike, maul, then Root Knit below half HP or another strike; the knit is Regen 3 for 2 turns on itself; fire is weak', () => {
    const b = byId(parsedCreatures, 'cr_wildling_brute');
    expect(b.pattern).toHaveLength(4);
    expect(b.pattern.slice(0, 3).map((s) => ('move' in s ? s.move : '?'))).toEqual(['brute_strike', 'brute_strike', 'brute_maul']);
    expect(b.pattern[3]).toMatchObject({ if: { hpBelow: 0.5 }, then: [{ move: 'brute_root_knit', target: 'self' }], else: [{ move: 'brute_strike', target: 'player' }] });
    expect(b.moves['brute_strike']?.power).toMatchObject({ coef: 1.0, stat: 'atk' });
    expect(b.moves['brute_maul']?.power).toMatchObject({ coef: 1.6, stat: 'atk' });
    expect(b.moves['brute_root_knit']?.statuses.map((s) => [s.status, s.target, s.duration, s.power?.base])).toEqual([['status_regen', 'self', 2, 3]]);
    expect(b.resistances).toEqual({ fire: 'weak' });
  });

  test('the Rootling: Burrow only once an ally is down (fewer than two of three left), then Trip, then Jab; the statuses are WORLD’s percentages', () => {
    const r = byId(parsedCreatures, 'cr_rootling');
    expect(r.pattern.map((s) => ('move' in s ? s.move : '?'))).toEqual(['rootling_burrow', 'rootling_trip', 'rootling_jab']);
    expect(r.pattern[0]).toMatchObject({ target: 'self', when: { allyCountBelow: 2 } });
    expect(r.moves['rootling_burrow']?.shield?.power).toMatchObject({ coef: 1.0, stat: 'atk' });
    expect(r.moves['rootling_trip']?.statuses.map((s) => [s.status, s.chance, s.duration])).toEqual([['status_slow', 0.4, 2]]);
    expect(r.moves['rootling_jab']?.statuses.map((s) => [s.status, s.chance, s.duration])).toEqual([['status_bleed', 0.25, 2]]);
    expect(r.moves['rootling_trip']?.power).toMatchObject({ coef: 0.7 });
  });

  test('the Golem: Harden when Armor Break lands (cleanses and shields itself), Cover for an ally, then Slam and Grind; elite, construct, immune to Poison and Bleed', () => {
    const g = byId(parsedCreatures, 'cr_stone_hide_golem');
    expect(g.role).toBe('elite');
    expect(g.pattern[0]).toMatchObject({ move: 'golem_harden', target: 'self', when: { selfHas: 'status_armor_break' } });
    expect(g.pattern[1]).toMatchObject({ move: 'golem_cover', target: 'ally', when: { allyPresent: true } });
    expect(g.pattern.slice(2).map((s) => ('move' in s ? s.move : '?'))).toEqual(['golem_slam', 'golem_grind']);
    expect(g.moves['golem_harden']).toMatchObject({ cleanseSelf: true, shield: { power: { coef: 1.0, stat: 'atk' } } });
    expect(g.moves['golem_cover']?.shieldAlly?.power).toMatchObject({ coef: 1.0, stat: 'atk' });
    expect(g.moves['golem_slam']?.statuses.map((s) => [s.status, s.chance, s.duration])).toEqual([['status_stun', 0.2, 1]]);
    expect(g.moves['golem_grind']?.statuses.map((s) => [s.status, s.chance, s.duration])).toEqual([['status_armor_break', 0.4, 2]]);
    expect([g.moves['golem_slam']?.power?.coef, g.moves['golem_grind']?.power?.coef]).toEqual([1.2, 0.9]);
  });

  test('the Pillar: Ward for an ally, Discharge every third turn on everyone, Seal from round 6 when alone, else Hum; weak to Storm, ley-typed', () => {
    const p = byId(parsedCreatures, 'cr_warding_pillar');
    expect(p.pattern).toEqual([
      { move: 'pillar_ward', target: 'ally', when: { allyPresent: true } },
      { move: 'pillar_discharge', target: 'all', when: { everyNth: 3 } },
      { move: 'pillar_seal', target: 'self', when: { all: [{ roundAtLeast: 6 }, { not: { allyPresent: true } }] } },
      { move: 'pillar_hum', target: 'all' },
    ]);
    expect(p.moves['pillar_seal']?.leaveCombat).toBe(true);
    expect(p.moves['pillar_discharge']).toMatchObject({ type: 'ley', power: { coef: 0.8, stat: 'sp' } });
    expect(p.moves['pillar_hum']?.statuses.map((s) => [s.status, s.chance, s.duration])).toEqual([['status_slow', 0.6, 2]]);
    expect(p.moves['pillar_ward']?.shieldAlly).toBeDefined();
    expect(p.resistances['storm']).toBe('weak');
  });

  test('the Hound: Skip every third turn, Echo below half HP, else Bite (two hits of 0.6× at SP, Bleed 30 %); an anomaly, Loop 2+, weak to Void', () => {
    const h = byId(parsedCreatures, 'cr_stutter_hound');
    expect(h.role).toBe('anomaly');
    expect(h.pattern).toEqual([
      { move: 'stutter_skip', target: 'self', when: { everyNth: 3 } },
      { move: 'stutter_echo', target: 'player', when: { hpBelow: 0.5 } },
      { move: 'stutter_bite', target: 'player' },
    ]);
    expect(h.moves['stutter_bite']).toMatchObject({ type: 'chrono', power: { coef: 0.6, stat: 'sp', hits: 2 } });
    expect(h.moves['stutter_bite']?.statuses.map((s) => [s.status, s.chance, s.duration])).toEqual([['status_bleed', 0.3, 2]]);
    expect(h.moves['stutter_skip']?.statuses.map((s) => [s.status, s.target, s.duration])).toEqual([['status_phase', 'self', 1]]);
    // "repeats its previous move" has no atom; the Echo is the Bite again (the move WORLD's own tactics say it repeats)
    expect(h.moves['stutter_echo']).toMatchObject({ type: 'chrono', power: { coef: 0.6, stat: 'sp', hits: 2 } });
    expect(h.resistances).toEqual({ void: 'weak', chrono: 'resist' });
  });

  test('descriptions written for the three records without a legacy line are drawn from their bestiary entry and short', () => {
    for (const c of parsedCreatures) {
      if (worldCreature(c.id).legacyDescription !== null) continue;
      expect([c.id, c.bestiary.summary.includes(c.description.replace(/\.$/, ''))]).toEqual([c.id, true]);
      expect(words(c.description)).toBeLessThanOrEqual(30);
    }
  });
});

// ---- The NPCs -----------------------------------------------------------------------------------------------------------------

describe('the NPCs vs WORLD §4', () => {
  const S4 = section(WORLD, '## 4. Non-companion NPCs', '## 5. Creature families');
  const rows = Object.fromEntries(tableRows(S4).filter((c) => unquote(c[0] ?? '').startsWith('npc_')).map((c) => [unquote(c[0] ?? ''), c]));
  /** The row's Location cell without the merchant mark-up: `**stall: loc_x** (…)` → `loc_x (…)`. */
  const home = (c: string[]): string => (c[3] ?? '').replace(/\*\*stall: /, '').replace(/\*\*/g, '');

  test('exactly the NPCs whose home is in the region: Kaelen Stonehand, Brak, Borin Stonefist (Tessaly’s home is Hearthring)', () => {
    const homes = Object.values(rows).filter((c) => /^loc_(mistwood_path|wayfarers_respite|ironclad_camp|barren_peaks|blighted_outpost|emberforge)\b/.test(home(c)));
    expect(npcs.map((n) => n.id).sort()).toEqual(homes.map((c) => unquote(c[0] ?? '')).sort());
    expect(npcs.map((n) => n.id)).toEqual(['npc_kaelen_stonehand', 'npc_brak', 'npc_borin_stonefist']);
    expect(home(rows['npc_tessaly_varr'] ?? [])).toMatch(/^loc_hearthring/);
  });

  test('names, factions, ages, home locations and sample lines as WORLD’s row', () => {
    for (const n of npcs) {
      const row = rows[n.id];
      expect(row, n.id).toBeDefined();
      expect([n.id, n.name]).toEqual([n.id, row?.[1]]);
      // Kaelen's faction cell is `— (neutral ground)`: neutral ground, D-014
      expect([n.id, row?.[2]]).toEqual([n.id, n.id === 'npc_kaelen_stonehand' ? '— (neutral ground)' : n.factionId]);
      expect([n.id, home(row ?? []).startsWith(n.homeLocationId)]).toEqual([n.id, true]);
      expect([n.id, (row?.[5] ?? '').includes(`~${n.age}`)]).toEqual([n.id, true]);
      expect(n.barks).toHaveLength(2);
      for (const b of n.barks ?? []) expect([n.id, (row?.[6] ?? '').includes(`"${b.text}"`)]).toEqual([n.id, true]);
    }
    expect(byId(npcs, 'npc_kaelen_stonehand').factionId).toBe('neutral');
  });

  test('roles and records: two merchants with their stall, the crafter, two quest givers; Brak’s companion handshake with shared/companions (D-088)', () => {
    const kaelen = byId(npcs, 'npc_kaelen_stonehand');
    const brak = byId(npcs, 'npc_brak');
    const borin = byId(npcs, 'npc_borin_stonefist');
    expect(kaelen.roles).toEqual(['merchant', 'questgiver']);
    expect(brak.roles).toEqual(['companion', 'questgiver']);
    expect(borin.roles).toEqual(['smith', 'merchant', 'questgiver']);
    expect([kaelen.merchantId, borin.merchantId, brak.merchantId]).toEqual(['npc_kaelen_stonehand', 'npc_borin_stonefist', undefined]);
    for (const [npc, loc] of [[kaelen, WY], [borin, EF]] as const) expect([npc.id, byId(parsedLocations, loc).merchantId]).toEqual([npc.id, npc.id]);
    expect(brak.companionId).toBe('brak');
    expect(companions.find((c) => c.id === 'brak')?.npcId).toBe('npc_brak');
    expect(WORLD).toContain('companion anchor `brak`');
    for (const n of npcs) expect(n.legacyName).toBe(n.name); // legacy characters (validator rule 22)
  });
});

// ---- The real pack ------------------------------------------------------------------------------------------------------------

describe('the real pack with the region registered (D-090)', () => {
  test('builds; the barrel holds this folder after the Ruins; the region tables are in `contentTables` and the index', () => {
    const folders = REGION_FOLDERS.map((f) => f.region.id);
    expect(folders).toContain(REGION);
    expect(folders.indexOf(RUINS_REGION)).toBeLessThan(folders.indexOf(REGION));
    expect(REGION_FOLDERS.find((f) => f.region.id === REGION)?.region).toEqual(region);
    expect(contentTables.regions.find((r) => r.id === REGION)).toEqual(region);
    expect(pack.regions[REGION]?.name).toBe('Mistwood & the Ironclad Reach');
    expect(pack.index.locationsByRegion[REGION]).toEqual(locations.map((l) => l.id));
    for (const c of creatures) expect(pack.creatures[c.id]?.name).toBe(c.name);
    for (const n of npcs) expect(pack.npcs[n.id]?.name).toBe(n.name);
    expect(items).toEqual([]); // the items tables are U49/U50's; this region owns none
    expect(pack.index.startLocationId).toBe(WR);
  });

  test('validates with 0 errors; pending references name only tables still being authored; this region’s own real warnings are the known ones', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    const pending = report.warnings.filter((w) => w.message.startsWith('pending — content not yet authored (reference): '));
    expect(pending.length).toBeGreaterThan(50);
    for (const w of pending) {
      const table = /not found in ([a-z]+)$/.exec(w.message)?.[1];
      expect([w.message, INCOMPLETE_TABLES.includes(table as (typeof INCOMPLETE_TABLES)[number])]).toEqual([w.message, true]);
    }
    const mine = new Set<string>([...locations.map((l) => l.id), ...creatures.map((c) => c.id), ...npcs.map((n) => n.id)]);
    const real = report.warnings.filter((w) => !w.message.startsWith('pending — content not yet authored') && mine.has(w.id));
    expect(real.map((w) => `${w.rule} ${w.id} ${w.path}`).sort()).toEqual(
      [
        // Tessaly's caravan flag is a later unit's to set; the engine's own (Horde, Brak kept away, the expiry) are
        // ENGINE_WRITTEN_FLAGS and raise nothing. The Heartstone flags the Forge reads raise rule-02 once per flag, at their
        // first use in table order, which is the Ruins' Depths (silverwood_ruins.test.ts pins those three).
        'rule-02 loc_ironclad_camp events.1.when.flag',
      ].sort(),
    );
  });

  test('`npm run validate`: exit 0, 0 errors, the pending references listed', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/ regions \d+ · locations \d+ · creatures \d+ · /);
    expect(text).toMatch(/pending rule-01: \d+ reference\(s\) into tables still being authored/);
    expect(text).toMatch(/validate: ok — 0 errors, \d+ warning\(s\), \d+ pending completeness check\(s\), \d+ pending reference\(s\)/);
  });

  test('this region’s pending references name only ids WORLD/STORY/DESIGN spell (other regions’ locations, items, quests, Echoes, the Husk, codex entries); the Ruins and the Path now resolve', () => {
    const { report } = parseContentPack(contentTables);
    const mine = new Set<string>([REGION, ...locations.map((l) => l.id), ...creatures.map((c) => c.id), ...npcs.map((n) => n.id)]);
    const targets = new Set(
      report.warnings.filter((w) => w.message.includes('(reference)') && mine.has(w.id)).map((w) => /'([a-z_0-9]+)' not found/.exec(w.message)?.[1] ?? w.message),
    );
    // Later units resolve these one by one (regions U44–U48, items U49/U50, quests U52–U59): the list may only shrink
    const known = new Set([
      'loc_sky_whisper_plateau', 'loc_scorched_gate',
      'item_wildling_hide_armor', 'item_chronal_dust', 'item_tobrins_warding_primer', 'item_breach_anchor_schematic_b',
      'mat_wildling_hide', 'mat_rootbone', 'mat_ley_resin', 'mat_slate_core', 'mat_iron_rivet', 'mat_silverwood_heartwood', 'mat_frayed_moment',
      'cr_horde_husk',
      'q_clear_path', 'q_blighted_outpost',
      'echo_ironclad_passwords', 'echo_nomad_signs', 'echo_vask_seal', 'echo_stone_hide_origin',
      'npc_kaelen_stonehand', 'npc_borin_stonefist', // the merchant records (WORLD §9)
      'brak', // the companion record (D-088: registered by U56)
      'ironclad', // the faction record (region.factionId, npc factions)
      'codex_region_mistwood_reach', 'codex_creatures_wilds', 'codex_creatures_wards', 'codex_creatures_watch_wardens',
    ]);
    expect([...targets].filter((t) => !known.has(t)).sort()).toEqual([]);
    expect(targets.has(WR)).toBe(false);
    expect(targets.has(MP)).toBe(false);
    expect(targets.has('item_ley_touched_tonic')).toBe(false);
  });
});

// ---- The engine on the real pack ------------------------------------------------------------------------------------------------

describe('the region in the engine (real pack, seeded)', () => {
  test('the Ruins’ east exit opens onto the Path; the Path’s four exits are legal; the Respite is a dead end', () => {
    expect(movesFrom(WR)).toContain(MP);
    expect(arrive(WR, MP).world.currentLocationId).toBe(MP);
    expect(movesFrom(MP)).toEqual([IC, 'loc_silverwood_plaza', WR, WY].sort());
    expect(movesFrom(WY)).toEqual([MP]);
  });

  test('the first visit to the Path (400 seeds): about 50 % Prowlers, 30 % Rootlings, 20 % nothing — and nothing once the Heartstone is destroyed', () => {
    const tally = { prowlers: 0, rootlings: 0, none: 0, other: 0 };
    const N = 400;
    for (let i = 0; i < N; i++) {
      const s = arrive(WR, MP, { seed: `u43-${i}` });
      if (s.mode !== 'combat') tally.none += 1;
      else if (s.combat?.encounterId === 'enc_mistwood_prowlers') tally.prowlers += 1;
      else if (s.combat?.encounterId === 'enc_mistwood_rootlings') tally.rootlings += 1;
      else tally.other += 1;
    }
    expect(tally.other).toBe(0);
    expect(tally.prowlers / N).toBeGreaterThan(0.41);
    expect(tally.prowlers / N).toBeLessThan(0.59);
    expect(tally.rootlings / N).toBeGreaterThan(0.21);
    expect(tally.rootlings / N).toBeLessThan(0.39);
    expect(tally.none / N).toBeGreaterThan(0.12);
    expect(tally.none / N).toBeLessThan(0.28);
    // the fights are WORLD's: two Prowlers, three Rootlings, both fleeable
    const fights = new Map<string, number[]>();
    for (let i = 0; i < 60 && fights.size < 2; i++) {
      const s = arrive(WR, MP, { seed: `u43-${i}` });
      if (s.mode === 'combat' && s.combat) {
        fights.set(s.combat.encounterId, s.combat.enemies.map(() => 1));
        expect(s.combat.canFlee).toBe(true);
      }
    }
    expect([...fights].map(([id, e]) => [id, e.length]).sort()).toEqual([['enc_mistwood_prowlers', 2], ['enc_mistwood_rootlings', 3]]);
    for (let i = 0; i < 100; i++) expect(arrive(WR, MP, { seed: `u43-${i}`, flags: { flag_heartstone_destroyed: true } }).mode).toBe('explore');
  });

  test('the Peaks pass: shut without Brak’s job or the scouts’ words; open with q_clear_path accepted or echo_ironclad_passwords', () => {
    expect(movesFrom(IC)).toEqual([MP]);
    expect(movesFrom(IC, { quests: { q_clear_path: 'active' } })).toEqual([BP, MP].sort());
    expect(movesFrom(IC, { quests: { q_clear_path: 'completed' } })).toEqual([BP, MP].sort());
    expect(movesFrom(IC, { loop: 2, echoes: ['echo_ironclad_passwords'] })).toEqual([BP, MP].sort());
    // the other quest is not the key
    expect(movesFrom(IC, { quests: { q_blighted_outpost: 'active' } })).toEqual([MP]);
  });

  test('the Brute holds you while q_clear_path is open; without the quest (the passwords) it is a fleeable scatter fight', () => {
    const gated = arrive(IC, BP, { quests: { q_clear_path: 'active' } });
    expect(gated.mode).toBe('combat');
    expect(gated.combat).toMatchObject({ encounterId: 'enc_peaks_brute_gate', canFlee: false, onFlee: 'hold' });
    expect(gated.combat?.enemies.map((e) => e.refId)).toEqual(['cr_wildling_brute']);
    const plain = arrive(IC, BP, { loop: 2, echoes: ['echo_ironclad_passwords'], seed: 'u43-plain' });
    expect(plain.mode).toBe('combat');
    // (Loop 2: the 15 % Hound is a return encounter, never on the first visit)
    expect(plain.combat).toMatchObject({ encounterId: 'enc_peaks_brute', canFlee: true, onFlee: 'scatter' });
  });

  test('the Golems hold you while q_blighted_outpost is open; the Warder’s word lifts the hold; otherwise they are a fleeable scatter pair', () => {
    const gated = arrive(BP, BO, { quests: { q_blighted_outpost: 'active' } });
    expect(gated.combat).toMatchObject({ encounterId: 'enc_outpost_golems_gate', canFlee: false, onFlee: 'hold' });
    expect(gated.combat?.enemies.map((e) => e.refId)).toEqual(['cr_stone_hide_golem', 'cr_stone_hide_golem']);
    const stilled = arrive(BP, BO, { loop: 2, quests: { q_blighted_outpost: 'active' }, echoes: ['echo_stone_hide_origin'] });
    expect(stilled.combat).toMatchObject({ encounterId: 'enc_outpost_golems', canFlee: true, onFlee: 'scatter' });
    const free = arrive(BP, BO, { seed: 'u43-free' });
    expect(free.combat).toMatchObject({ encounterId: 'enc_outpost_golems', canFlee: true, onFlee: 'scatter' });
  });

  test('the scorched gate: closed until q_blighted_outpost is done or the trail-signs are known (its target is still pending, so the condition is read directly)', () => {
    const gate = byId(parsedLocations, BO).exits.find((x) => x.to === 'loc_scorched_gate')?.when;
    expect(gate).toBeDefined();
    if (gate === undefined) return;
    expect(holds(gate, BO)).toBe(false);
    expect(holds(gate, BO, { quests: { q_blighted_outpost: 'active' } })).toBe(false);
    expect(holds(gate, BO, { quests: { q_blighted_outpost: 'completed' } })).toBe(true);
    expect(holds(gate, BO, { loop: 2, echoes: ['echo_nomad_signs'] })).toBe(true);
  });

  test('the Hound is Loop 2+ only (a return roll, 15 %)', () => {
    const when = byId(byId(parsedLocations, BP).encounters, 'enc_peaks_stutter_hound').when;
    expect(when).toBeDefined();
    if (when === undefined) return;
    expect(holds(when, BP)).toBe(false);
    expect(holds(when, BP, { loop: 2 })).toBe(true);
  });

  test('the Camp’s husks (R10-1): only in a Horde, only once the Camp is infected, only with Brak gone; the move counts are WORLD §10.4’s 7 (kill) and 9 (expiry)', () => {
    const husks = byId(byId(parsedLocations, IC).encounters, 'enc_camp_husks').when;
    expect(husks).toBeDefined();
    if (husks === undefined) return;
    const both: Record<string, QuestSpec> = { q_clear_path: 'completed', q_blighted_outpost: 'completed' };
    const horde = { flag_horde_active: true };
    // no Horde: never
    expect(holds(husks, IC, { quests: both, hordeMoves: 20 })).toBe(false);
    // a Tyrant-kill Horde, both quests done: Brak is at the Apex; infected from move 8 on (the Camp falls at move 7, then the arrival counts)
    expect(holds(husks, IC, { flags: horde, quests: both, hordeMoves: 7 })).toBe(false);
    expect(holds(husks, IC, { flags: horde, quests: both, hordeMoves: 8 })).toBe(true);
    // Brak still here (one quest open or none): the Camp is held, however late
    expect(holds(husks, IC, { flags: horde, quests: { q_clear_path: 'completed' }, hordeMoves: 30 })).toBe(false);
    expect(holds(husks, IC, { flags: horde, hordeMoves: 30 })).toBe(false);
    // kept away (he waits at Hearthring): absent whatever the quests say
    expect(holds(husks, IC, { flags: { ...horde, flag_brak_kept_away: true }, hordeMoves: 7 })).toBe(false);
    expect(holds(husks, IC, { flags: { ...horde, flag_brak_kept_away: true }, hordeMoves: 8 })).toBe(true);
    // the expiry Horde (R10-3: two moves later) does not move him; kept away he is still gone
    expect(holds(husks, IC, { flags: { ...horde, flag_clock_expired: true }, quests: both, hordeMoves: 30 })).toBe(false);
    expect(holds(husks, IC, { flags: { ...horde, flag_clock_expired: true, flag_brak_kept_away: true }, hordeMoves: 9 })).toBe(false);
    expect(holds(husks, IC, { flags: { ...horde, flag_clock_expired: true, flag_brak_kept_away: true }, hordeMoves: 10 })).toBe(true);
    expect(WORLD).toContain('cr_horde_husk ×2 if infected and Brak is absent');
    expect(section(WORLD, '### 10.4 Elites', '### 10.5')).toContain('IC, EF 7');
  });
});

// ---- Words this unit wrote (not in the documents): kept short, listed in the U43 reply ------------------------------------------

describe('authored words outside the documents are few and short', () => {
  test('encounter intros are ≤ 30 words; the coined ids are the listed ones', () => {
    const intros = parsedLocations.flatMap((l) => l.encounters.map((e) => e.intro)).filter((t): t is string => t !== undefined);
    expect(intros).toHaveLength(9); // every encounter carries one
    for (const t of intros) expect(words(t)).toBeLessThanOrEqual(30);
    const encounters = parsedLocations.flatMap((l) => l.encounters.map((e) => e.id));
    expect(encounters).toEqual([
      'enc_mistwood_prowlers', 'enc_mistwood_rootlings', 'enc_camp_husks', 'enc_peaks_brute_gate', 'enc_peaks_brute', 'enc_peaks_stutter_hound',
      'enc_outpost_golems_gate', 'enc_outpost_golems', 'enc_outpost_pillar',
    ]);
    // event ids WORLD does not spell: the three Heartstone variants of the Forge pulse
    const wordedEvents = new Set(Object.values(WL).flatMap((w) => Object.keys(w.events).map((id) => (id.startsWith('ev_') ? id : `ev_${id}`))));
    const coined = parsedLocations.flatMap((l) => l.events.map((e) => e.id)).filter((id) => !wordedEvents.has(id));
    expect(coined).toEqual(['ev_forge_pulse_stabilized', 'ev_forge_pulse_exploited', 'ev_forge_pulse_destroyed']);
    // no move, phase or counter id is coined in this region: the creatures use WORLD's intent ids only (tested above); the
    // Horde-moves counter is the engine's
    expect(ids(JSON.stringify(locations), 'horde')).toEqual(['horde_moves']);
  });
});
