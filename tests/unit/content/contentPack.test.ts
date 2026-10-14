// U17: buildContentPack (PLAN §5.18, §4.8) — an empty pack builds; every table is keyed by id; duplicate ids and schema
// failures are reported together; the index is derived; lookups never reach Object.prototype.
import { describe, expect, test } from 'bun:test';
import {
  CONTENT_VERSION,
  ContentError,
  buildContentPack,
  buildIndex,
  contentTables,
  formatIssue,
  lookup,
  need,
  parseContentPack,
  type ContentTables,
} from '@content/index';
import { configInput, gameConfig } from '@content/shared/config';
import { TABLE_NAMES } from '@schema/contentPack';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { EchoInput } from '@schema/echo';
import type { EncounterInput } from '@schema/encounter';
import type { QuestInput } from '@schema/quest';
import {
  abilityMarkedShot,
  achievementTwoOaths,
  attunementSteadyHand,
  attunementSteadyHours,
  classRanger,
  closerEscape,
  codexNinefoldCircle,
  echoLitanyVerse1,
  endingWardensVigil,
  factionRemnants,
  locationWhisperingRuins,
  merchantKaelen,
  modifierFrayedClock,
  npcIlyra,
  npcKaelen,
  questEchoCrystal,
  recipeEmberFlask,
  regionSilverwoodRuins,
  sceneFirstMeetingIlyra,
} from './examples';

/** One record in every table the U17 examples cover, plus the minimal region/location/class/ability/recipe. */
const populated = (): Partial<ContentTables> => ({
  regions: [regionSilverwoodRuins],
  locations: [locationWhisperingRuins],
  recipes: [recipeEmberFlask],
  abilities: [abilityMarkedShot],
  classes: [classRanger],
  quests: [questEchoCrystal],
  dialogues: [sceneFirstMeetingIlyra],
  npcs: [npcIlyra, npcKaelen],
  echoes: [echoLitanyVerse1],
  codex: [codexNinefoldCircle],
  achievements: [achievementTwoOaths],
  attunements: [attunementSteadyHand, attunementSteadyHours],
  modifiers: [modifierFrayedClock],
  endings: [endingWardensVigil, closerEscape],
  merchants: [merchantKaelen],
  factions: [factionRemnants],
});

// These tests build deliberately partial packs (a location without its NPCs …), so cross-validation (U19) is off here;
// tests/unit/content/crossrefs.test.ts covers the validator.
const RAW = { validate: false } as const;

const errorsOf = (tables: Partial<ContentTables>): string[] => parseContentPack(tables, RAW).report.errors.map(formatIssue);

describe('an empty pack', () => {
  test('builds: every table is an empty record, the config is the DESIGN defaults, the index is empty', () => {
    const pack = buildContentPack({});
    expect(pack.version).toBe(CONTENT_VERSION);
    for (const name of TABLE_NAMES) expect(pack[name], name).toEqual({});
    expect(pack.config).toEqual(gameConfig);
    expect(pack.index).toEqual({
      exitsFrom: {},
      locationsByRegion: {},
      scenesByNpc: {},
      questsByGiver: {},
      abilitiesByClass: {},
      recipesByStation: { emberforge: [] },
      creatureIds: [],
      itemIds: [],
      questIds: [],
      locationIds: [],
      endingIds: [],
      startLocationId: 'loc_whispering_ruins',
    });
  });

  test('buildContentPack() with no arguments builds the authored tables (empty until the content units land)', () => {
    const pack = buildContentPack();
    expect(Object.keys(contentTables).sort()).toEqual([...TABLE_NAMES, 'config'].sort());
    for (const name of TABLE_NAMES) expect(Object.keys(pack[name]), name).toHaveLength(contentTables[name].length);
    expect(contentTables.config).toBe(configInput);
  });

  test('parseContentPack reports nothing for it, and the version can be set', () => {
    const { pack, report } = parseContentPack({}, { version: '9.9.9' });
    expect(report).toEqual({ errors: [], warnings: [] });
    expect(pack.version).toBe('9.9.9');
  });
});

describe('one record per table', () => {
  test('builds, keyed by id, with schema defaults applied', () => {
    const pack = buildContentPack(populated(), RAW);
    expect(Object.keys(pack.quests)).toEqual(['q_echo_crystal']);
    expect(pack.quests.q_echo_crystal?.rewards).toEqual({ xp: 120, gold: 20, items: [], rep: [], echoes: [], resonance: 0 });
    expect(pack.dialogues.scene_first_meeting_ilyra?.priority).toBe(0);
    expect(Object.keys(pack.npcs)).toEqual(['npc_ilyra', 'npc_kaelen_stonehand']);
    expect(Object.keys(pack.merchants)).toEqual(['npc_kaelen_stonehand']);
    expect(pack.merchants.npc_kaelen_stonehand?.npcId).toBe('npc_kaelen_stonehand');
    expect(pack.echoes.echo_litany_verse_1?.resonance).toBe(0); // D-082
    expect(pack.codex.codex_ninefold_circle?.voice).toBe('remnant_archive');
    expect(pack.achievements.ach_two_oaths?.resonance).toBe(10);
    expect(Object.keys(pack.attunements)).toEqual(['att_steady_hand', 'att_steady_hours']);
    expect(pack.modifiers.mod_frayed_clock?.rules).toHaveLength(1);
    expect(Object.keys(pack.endings)).toEqual(['ending_wardens_vigil', 'closer_escape']);
    expect(pack.factions.remnants?.shortName).toBe('Remnants');
    expect(pack.abilities.rgr_marked_shot).toMatchObject({ levelReq: 1, costHalf: 2, cooldown: 0 });
  });

  test('the same input is the same pack (no shared mutable state between builds)', () => {
    const a = buildContentPack(populated(), RAW);
    const b = buildContentPack(populated(), RAW);
    expect(a).toEqual(b);
    expect(a.quests).not.toBe(b.quests);
  });

  test('index: exits, regions, scenes by priority, quest givers, class abilities, the single station, id lists', () => {
    const base = populated();
    const high: DialogueSceneInput = { ...sceneFirstMeetingIlyra, id: 'scene_ilyra_high', priority: 10 };
    const low: DialogueSceneInput = { ...sceneFirstMeetingIlyra, id: 'scene_ilyra_low', priority: -5 };
    const tied: DialogueSceneInput = { ...sceneFirstMeetingIlyra, id: 'scene_ilyra_tied' };
    const loose: DialogueSceneInput = { ...sceneFirstMeetingIlyra, id: 'scene_unattached', npcId: undefined };
    const { index } = buildContentPack({ ...base, dialogues: [low, sceneFirstMeetingIlyra, high, tied, loose] }, RAW);
    expect(index.exitsFrom.loc_whispering_ruins?.map((e) => e.to)).toEqual(['loc_crumbling_archway', 'loc_mistwood_path']);
    expect(index.locationsByRegion).toEqual({ region_silverwood_ruins: ['loc_whispering_ruins'] });
    expect(index.scenesByNpc).toEqual({ npc_ilyra: ['scene_ilyra_high', 'scene_first_meeting_ilyra', 'scene_ilyra_tied', 'scene_ilyra_low'] });
    expect(index.questsByGiver).toEqual({ npc_ilyra: ['q_echo_crystal'] });
    expect(index.abilitiesByClass).toEqual({ ranger: ['rgr_marked_shot'] });
    expect(index.recipesByStation).toEqual({ emberforge: ['recipe_ember_flask'] });
    expect(index.questIds).toEqual(['q_echo_crystal']);
    expect(index.locationIds).toEqual(['loc_whispering_ruins']);
    expect(index.endingIds).toEqual(['ending_wardens_vigil', 'closer_escape']);
    expect(index.creatureIds).toEqual([]);
    expect(index.startLocationId).toBe('loc_whispering_ruins');
  });

  test('index: a location in an undeclared region still gets a bucket; a region without locations has an empty one', () => {
    const stray = { ...locationWhisperingRuins, regionId: 'region_elsewhere' } as const;
    const pack = buildContentPack({ regions: [regionSilverwoodRuins], locations: [stray] }, RAW);
    expect(pack.index.locationsByRegion).toEqual({ region_silverwood_ruins: [], region_elsewhere: ['loc_whispering_ruins'] });
    expect(buildIndex(pack).startLocationId).toBe(gameConfig.startLocationId);
  });

  test('a custom config replaces the defaults, and its start location reaches the index', () => {
    const pack = buildContentPack({ config: { ...configInput, startLocationId: 'loc_still_shore', clock: { baseLimitTicks: 80 } } });
    expect(pack.config.clock.baseLimitTicks).toBe(80);
    expect(pack.config.clock.floorDawns).toBe(3);
    expect(pack.index.startLocationId).toBe('loc_still_shore');
  });
});

describe('errors', () => {
  test('duplicate ids fail, naming the table, the id and the record number', () => {
    const tables = { quests: [questEchoCrystal, questEchoCrystal], npcs: [npcIlyra, npcKaelen, npcIlyra] };
    // Tables are reported in TABLE_NAMES order.
    expect(errorsOf(tables)).toEqual([
      "rule-06: quests.q_echo_crystal.id: duplicate id 'q_echo_crystal' (record #1; ids are unique within a table)",
      "rule-06: npcs.npc_ilyra.id: duplicate id 'npc_ilyra' (record #2; ids are unique within a table)",
    ]);
    expect(() => buildContentPack(tables)).toThrow(ContentError);
  });

  test('the same id may appear in two different tables (NPC and its merchant record)', () => {
    expect(errorsOf({ npcs: [npcKaelen], merchants: [merchantKaelen] })).toEqual([]);
  });

  test('the first record of a duplicate pair is the one kept', () => {
    const first = { ...echoLitanyVerse1, name: 'First' };
    const second = { ...echoLitanyVerse1, name: 'Second' };
    const { pack, report } = parseContentPack({ echoes: [first, second] });
    expect(report.errors).toHaveLength(1);
    expect(pack.echoes.echo_litany_verse_1?.name).toBe('First');
  });

  test('schema failures carry the table, record id and field path; every failing record is reported', () => {
    const badQuest: QuestInput = { ...questEchoCrystal, id: 'q_broken', stages: [{ id: 'a', journal: 'x', next: 'b' }] };
    const badEcho = { ...echoLitanyVerse1, id: 'echo_broken', category: 'trivia' } as unknown as EchoInput;
    const { report } = parseContentPack({ quests: [badQuest], echoes: [badEcho, echoLitanyVerse1] });
    expect(report.errors.map((e) => [e.rule, e.table, e.id, e.path])).toEqual([
      ['schema', 'quests', 'q_broken', 'stages.0.next'],
      ['schema', 'quests', 'q_broken', 'shortcuts.0.skipTo'],
      ['schema', 'echoes', 'echo_broken', 'category'],
    ]);
    expect(report.errors[0]?.message).toBe("'b' is not a stage of q_broken");
  });

  test('a record that is not an object, or has no usable id, is reported by its position', () => {
    const { report } = parseContentPack({ quests: [42 as never, { name: 'No id' } as never] });
    expect([...new Set(report.errors.map((e) => `${e.table}.${e.id}`))]).toEqual(['quests.#0', 'quests.#1']);
    expect(report.errors.every((e) => e.rule === 'schema')).toBe(true);
  });

  test('a failing record is absent from the diagnostic pack, which still has everything else', () => {
    const { pack } = parseContentPack({ npcs: [npcIlyra, { ...npcKaelen, merchantId: 'npc_other' }] });
    expect(Object.keys(pack.npcs)).toEqual(['npc_ilyra']);
  });

  test('ids that would shadow Object.prototype members are refused', () => {
    const enc: EncounterInput = { id: 'constructor', groups: [{ creatureId: 'cr_wildling_brute' }] };
    expect(errorsOf({ encounters: [enc] })).toEqual(["rule-06: encounters.constructor.id: 'constructor' is reserved (it names an Object.prototype member)"]);
    expect(errorsOf({ encounters: [{ ...enc, id: 'enc_constructor' }] })).toEqual([]);
  });

  test('an invalid config is an error in the config table, and the pack falls back to the defaults', () => {
    const { pack, report } = parseContentPack({ config: { ...configInput, critBase: 99 } });
    expect(report.errors.map(formatIssue)).toEqual(['schema: config.-.critBase: critBase must be ≤ critCap']);
    expect(pack.config).toEqual(gameConfig);
  });

  test('ContentError lists the first ten errors and counts the rest; the report is attached', () => {
    const quests = Array.from({ length: 12 }, (_, i): QuestInput => ({ ...questEchoCrystal, id: `q_dup_${i % 2}`, stages: [] }));
    let thrown: unknown;
    try {
      buildContentPack({ quests });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ContentError);
    const error = thrown as ContentError;
    expect(error.name).toBe('ContentError');
    expect(error.report.errors.length).toBeGreaterThan(10);
    expect(error.message.startsWith(`content has ${error.report.errors.length} error(s):`)).toBe(true);
    expect(error.message).toContain('stages: Array must contain at least 1 element(s)');
    expect(error.message).toContain(`… and ${error.report.errors.length - 10} more`);
  });
});

describe('cross-validation hook', () => {
  test('runs on a clean pack, and its findings join the report', () => {
    const seen: string[] = [];
    const validate = (pack: ReturnType<typeof buildContentPack>) => {
      seen.push(Object.keys(pack.quests).join(','));
      return {
        errors: [{ table: 'quests', id: 'q_echo_crystal', path: '', message: 'nope', rule: 'rule-09' }],
        warnings: [{ table: 'quests', id: 'q_echo_crystal', path: '', message: 'hmm', rule: 'rule-21' }],
      };
    };
    const { report } = parseContentPack({ quests: [questEchoCrystal] }, { validate });
    expect(seen).toEqual(['q_echo_crystal']);
    expect(report.errors.map(formatIssue)).toEqual(['rule-09: quests.q_echo_crystal: nope']);
    expect(report.warnings).toHaveLength(1);
    expect(() => buildContentPack({ quests: [questEchoCrystal] }, { validate })).toThrow(/rule-09/);
  });

  test('is skipped when a table failed to parse (cross-reference noise)', () => {
    let calls = 0;
    const validate = () => {
      calls++;
      return { errors: [], warnings: [] };
    };
    parseContentPack({ quests: [{ ...questEchoCrystal, stages: [] }] }, { validate });
    expect(calls).toBe(0);
    buildContentPack({}, { validate });
    expect(calls).toBe(1);
  });

  test('a clean validator leaves buildContentPack returning the pack', () => {
    const pack = buildContentPack(populated(), { validate: () => ({ errors: [], warnings: [] }) });
    expect(pack.index.questIds).toEqual(['q_echo_crystal']);
  });
});

describe('typed lookups', () => {
  const pack = buildContentPack(populated(), RAW);

  test('lookup returns the typed record, or undefined', () => {
    const quest = lookup(pack, 'quests', 'q_echo_crystal');
    expect(quest?.name).toBe('Echoes in the Library');
    expect(lookup(pack, 'quests', 'q_missing')).toBeUndefined();
    expect(lookup(pack, 'factions', 'remnants')?.shortName).toBe('Remnants');
    expect(lookup(pack, 'merchants', 'npc_kaelen_stonehand')?.regionMarkup).toBe(1);
  });

  test('lookups never reach Object.prototype', () => {
    for (const id of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(lookup(pack, 'quests', id), id).toBeUndefined();
      expect(() => need(pack, 'npcs', id), id).toThrow(/unknown npcs id/);
    }
  });

  test('need returns the record or throws a message naming the table and id', () => {
    expect(need(pack, 'npcs', 'npc_ilyra').name).toBe('Ilyra');
    expect(() => need(pack, 'echoes', 'echo_nope')).toThrow("content: unknown echoes id 'echo_nope'");
  });
});
