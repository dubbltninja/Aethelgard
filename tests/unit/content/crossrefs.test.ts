// U19: validateContent (PLAN §5.19), rules 1–22. The unmodified fixture pack (tests/fixtures/miniContent.ts) validates with
// no errors and no warnings; each rule then has at least one failing example made by editing a structuredClone of the
// fixture's tables (or, for invariants the schemas already refuse, of the assembled pack) and asserts that exactly the
// expected rules fire. Completeness-count rules are strict-mode only; `pending` turns their errors into warnings.
import { describe, expect, test } from 'bun:test';
import { ContentError, buildContentPack, contentTables, formatIssue, parseContentPack, type ContentPack, type ContentReport, type ContentTables } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import {
  ATTUNEMENT_IDS,
  EXPECTED_COUNTS,
  LEGACY_CLASSES,
  LEGACY_CREATURES,
  LEGACY_ITEMS,
  LEGACY_LOCATIONS,
  LEGACY_NPCS,
  LEGACY_QUESTS,
  RULES,
  validateContent,
  type ValidateOptions,
} from '@content/validate';
import { fixturePack, miniContentTables } from '@tests/fixtures/miniContent';
import { main } from '../../../tools/validate-content';

// ---- Helpers ---------------------------------------------------------------------------------------------------------

type Tables = { -readonly [K in keyof ContentTables]: ContentTables[K] extends readonly (infer U)[] ? U[] : ContentTables[K] };

/** A mutable structuredClone of the fixture's authored tables, edited by `edit`. */
function editedTables(edit: (t: Tables) => void): ContentTables {
  const tables = structuredClone(miniContentTables) as unknown as Tables;
  edit(tables);
  return tables;
}

function row<T extends { id: string }>(rows: readonly T[], id: string): T {
  const found = rows.find((r) => r.id === id);
  if (!found) throw new Error(`fixture has no row ${id}`);
  return found;
}

function get<T>(record: Record<string, T>, id: string): T {
  const found = record[id];
  if (found === undefined) throw new Error(`fixture has no record ${id}`);
  return found;
}

/** Edit the authored tables, parse them (the edit must still satisfy every schema), validate the result. */
function viaTables(edit: (t: Tables) => void, options: ValidateOptions = {}): ContentReport {
  const { pack, report } = parseContentPack(editedTables(edit), { validate: false });
  expect(report.errors.map(formatIssue)).toEqual([]);
  return validateContent(pack, options);
}

/** Edit an unfrozen deep copy of the assembled pack: for invariants the schemas already refuse to parse. */
function viaPack(edit: (p: ContentPack) => void, options: ValidateOptions = {}): ContentReport {
  const pack = structuredClone(fixturePack());
  edit(pack);
  return validateContent(pack, options);
}

const rulesOf = (r: ContentReport): string[] => [...new Set([...r.errors, ...r.warnings].map((i) => i.rule))].sort();
const wordsOf = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

// ---- The fixture is clean ----------------------------------------------------------------------------------------------

describe('the fixture pack', () => {
  test('validates with no errors and no warnings', () => {
    expect(validateContent(fixturePack())).toEqual({ errors: [], warnings: [] });
    expect(validateContent(fixturePack(), { strict: false, registries: {} })).toEqual({ errors: [], warnings: [] });
  });

  test('is what buildContentPack validates by default (and `validate: false` skips)', () => {
    expect(() => buildContentPack(miniContentTables)).not.toThrow();
    const broken = editedTables((t) => {
      row(t.locations, 'loc_shattered_library').npcs = ['npc_ghost'];
    });
    expect(() => buildContentPack(broken)).toThrow(ContentError);
    expect(() => buildContentPack(broken)).toThrow(/rule-01: locations\.loc_shattered_library\.npcs\.0: npc 'npc_ghost' not found in npcs/);
    expect(() => buildContentPack(broken, { validate: false })).not.toThrow();
  });

  test('the real pack (regions still being authored, D-090) has no errors and passes strict with the rest pending', () => {
    const pack = buildContentPack(contentTables);
    expect(validateContent(pack, { incompleteTables: INCOMPLETE_TABLES }).errors).toEqual([]);
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(strict.errors).toEqual([]);
    const pending = strict.warnings.filter((w) => w.message.startsWith('pending — content not yet authored'));
    expect(pending.length).toBeGreaterThan(100);
    expect(pending.some((w) => w.message.startsWith('pending — content not yet authored (reference): '))).toBe(true);
    // the only real warnings are flags later units set (rule 2) and WORLD's deliberately out-of-band placements (rule 11)
    expect(strict.warnings.filter((w) => !pending.includes(w)).every((w) => w.rule === 'rule-02' || w.rule === 'rule-11')).toBe(true);
  });

  test('the rule table lists rules 1–22 in order, with the completeness rules marked', () => {
    expect(RULES.map((r) => r.rule)).toEqual(Array.from({ length: 22 }, (_, i) => `rule-${String(i + 1).padStart(2, '0')}`));
    expect(RULES.filter((r) => r.counts).map((r) => r.rule)).toEqual(['rule-13', 'rule-14', 'rule-15', 'rule-18', 'rule-19', 'rule-21', 'rule-22']);
    expect(new Set(RULES.map((r) => r.title)).size).toBe(22);
  });

  test('Appendix A tables hold the counts of D-001 / PLAN rule 22', () => {
    expect(Object.keys(LEGACY_LOCATIONS)).toHaveLength(21);
    expect(Object.keys(LEGACY_CREATURES)).toHaveLength(12); // 11 + the Contained Tyrant; the Unveiled form is separate
    expect(Object.keys(LEGACY_ITEMS)).toHaveLength(26);
    expect(Object.keys(LEGACY_NPCS)).toHaveLength(5);
    expect(Object.keys(LEGACY_QUESTS)).toHaveLength(6);
    expect(LEGACY_CLASSES).toHaveLength(3);
    expect(ATTUNEMENT_IDS).toHaveLength(15);
    expect(EXPECTED_COUNTS.locations).toBe(73);
  });
});

// ---- One failing example per rule ----------------------------------------------------------------------------------------

interface Example {
  rule: string;
  title: string;
  report: () => ContentReport;
  /** Every rule that fires (default: just `rule`). */
  fires?: string[];
  /** Substrings of formatted issues, all of which must appear in `level`. */
  says: string[];
  level?: 'errors' | 'warnings';
}

const library = 'loc_shattered_library';
const plaza = 'loc_silverwood_plaza';
const apex = 'loc_temporal_breach_apex';
const nexus = 'loc_chronos_nexus';
const ruins = 'loc_whispering_ruins';
const quest = 'q_echo_crystal';
const scene = 'scene_first_meeting_ilyra';
const tyrant = 'cr_chronos_tyrant_unveiled';

/** An effect or condition added to a location description variant / event of the library, as a quick place to put one. */
const withLibraryEvent = (effects: Tables['locations'][number]['events']): ((t: Tables) => void) => (t) => {
  const loc = row(t.locations, library);
  loc.events = [...(loc.events ?? []), ...(effects ?? [])];
};
const withLibraryVariant = (when: unknown): ((t: Tables) => void) => (t) => {
  const loc = row(t.locations, library);
  loc.descriptionVariants = [...(loc.descriptionVariants ?? []), { when: when as never, text: 'A variant.' }];
};

/** A bare location cut from the Library (no exits, items, encounters or legacy name). */
const bareLocation = (t: Tables, id: string, overrides: Partial<Tables['locations'][number]> = {}): void => {
  const copy = { ...structuredClone(row(t.locations, library)), id, exits: [], items: [], encounters: [], events: [], npcs: [], ...overrides } as Tables['locations'][number];
  delete copy.legacyName;
  t.locations.push(copy);
};

const EXAMPLES: Example[] = [
  // ---- rule 1: every id reference resolves
  ...(
    [
      ['exit', (t: Tables) => { const l = row(t.locations, library); l.exits = [...(l.exits ?? []), { dir: 'up', to: 'loc_nowhere' }]; }, "exit 'up' → 'loc_nowhere' not found in locations"],
      ['location npc', (t: Tables) => { row(t.locations, library).npcs = ['npc_ghost']; }, "npc 'npc_ghost' not found in npcs"],
      ['location region', (t: Tables) => { row(t.locations, library).regionId = 'region_ghost'; }, "regionId 'region_ghost' not found in regions"],
      ['loot item', (t: Tables) => { row(t.creatures, 'cr_corrupted_shade').loot?.push({ itemId: 'item_ghost' }); }, "loot item 'item_ghost' not found in items"],
      ['phase add', (t: Tables) => { const p = row(t.creatures, tyrant).phases?.[1]; if (p) p.adds = [{ creatureId: 'cr_ghost', count: 1 }]; }, "phase tyr_movement_2 add 'cr_ghost' not found in creatures"],
      ['communion offer', (t: Tables) => { row(t.creatures, tyrant).communion?.offers.push({ itemId: 'item_ghost', resolve: 1, effects: [] }); }, "communion offer 'item_ghost' not found in items"],
      ['ability branch', (t: Tables) => { row(t.abilities, 'rgr_marked_shot').branch = 'nope'; }, "branch 'nope' is not a branch of ranger"],
      ['class starter item', (t: Tables) => { row(t.classes, 'ranger').starterItems.push({ itemId: 'item_ghost' }); }, "starter item 'item_ghost' not found in items"],
      ['quest giver', (t: Tables) => { row(t.quests, quest).giverNpcId = 'npc_ghost'; }, "giverNpcId 'npc_ghost' not found in npcs"],
      ['quest hint location', (t: Tables) => { const o = row(t.quests, quest).stages[0]?.objectives?.[0]; if (o) o.hintLocationId = 'loc_ghost'; }, "hintLocationId 'loc_ghost' not found in locations"],
      ['dialogue echo hint', (t: Tables) => { const c = row(t.dialogues, scene).nodes[0]?.choices?.[3]; if (c) c.echoHint = 'echo_ghost'; }, "echoHint 'echo_ghost' not found in echoes"],
      ['companion signature', (t: Tables) => { row(t.companions, 'ilyra').signature.abilityId = 'comp_ilyra_ghost'; }, "signature ability 'comp_ilyra_ghost' not found in abilities"],
      ['companion arc quest', (t: Tables) => { row(t.companions, 'ilyra').arcQuestIds.push('q_ghost'); }, "arc quest 'q_ghost' not found in quests"],
      ['npc home', (t: Tables) => { row(t.npcs, 'npc_ilyra').homeLocationId = 'loc_ghost'; }, "homeLocationId 'loc_ghost' not found in locations"],
      ['merchant stock', (t: Tables) => { row(t.merchants, 'npc_tamsin_reed').stock.push({ itemId: 'item_ghost' }); }, "stock item 'item_ghost' not found in items"],
      ['recipe output', (t: Tables) => { row(t.recipes, 'recipe_glyphbound_lantern').output.itemId = 'item_ghost'; }, "output 'item_ghost' not found in items"],
      ['wandering pool', (t: Tables) => { row(t.regions, 'region_glowlands_nexus').wanderingPool?.push({ creatureId: 'cr_ghost' }); }, "wandering creature 'cr_ghost' not found in creatures"],
      ['echo requiredForEndings', (t: Tables) => { row(t.echoes, 'echo_tyrant_speaks').requiredForEndings = ['ending_ghost']; }, "requiredForEndings 'ending_ghost' not found in endings"],
      ['item passive ability', (t: Tables) => { row(t.items, 'item_chronos_lens').passives = [{ kind: 'grantAbility', abilityId: 'itm_ghost' }]; }, "granted ability 'itm_ghost' not found in abilities"],
      ['item source', (t: Tables) => { row(t.items, 'item_glow_moss').sources = ['drop:cr_ghost']; }, "source 'drop:cr_ghost' → 'cr_ghost' not found in creatures"],
      ['start item', (t: Tables) => { t.config.startItems = [{ itemId: 'item_ghost' }]; }, "start item 'item_ghost' not found in items"],
    ] as const
  ).map(([title, edit, says]): Example => ({ rule: 'rule-01', title, report: () => viaTables(edit), says: [says], ...(title === 'location region' ? { fires: ['rule-01', 'rule-22'] } : {}) })),
  {
    rule: 'rule-01',
    title: 'a pattern step naming a move the creature lacks',
    report: () => viaPack((p) => { get(p.creatures, 'cr_corrupted_shade').pattern[0] = { move: 'nope', target: 'player' }; }),
    says: ["pattern step move 'nope' not found in moves"],
  },
  {
    rule: 'rule-01',
    title: 'a quest stage target that is no stage (the schema refuses it, the pack check still catches it)',
    report: () => viaPack((p) => { const s = get(p.quests, quest).stages[0]; if (s) s.next = 'stage_ghost'; }),
    fires: ['rule-01', 'rule-09'],
    says: ["next 'stage_ghost' is not a stage of q_echo_crystal"],
  },
  {
    rule: 'rule-01',
    title: 'a companion that does not point back at its NPC',
    report: () => viaTables((t) => { delete row(t.npcs, 'npc_ilyra').companionId; }),
    says: ['npc_ilyra does not point back at companion ilyra (npc.companionId)'],
  },

  // ---- rule 2: ids inside conditions and effects
  { rule: 'rule-02', title: 'a quest condition naming a stage the quest lacks', report: () => viaTables(withLibraryVariant({ quest: { id: quest, stage: 'nope' } })), says: ["condition quest 'q_echo_crystal' has no stage 'nope'"] },
  { rule: 'rule-02', title: 'an echo condition naming no Echo', report: () => viaTables(withLibraryVariant({ echo: 'echo_ghost' })), says: ["condition echo 'echo_ghost' not found in echoes"] },
  { rule: 'rule-02', title: 'a nested condition (not / any) is walked', report: () => viaTables(withLibraryVariant({ not: { any: [{ killed: { id: 'cr_ghost' } }] } })), says: ["condition killed 'cr_ghost' not found in creatures"] },
  {
    rule: 'rule-02',
    title: 'questAdvance to a missing stage',
    report: () => viaTables(withLibraryEvent([{ id: 'ev_advance', text: 'x', effects: [{ questAdvance: { quest, stage: 'nope' } }] }])),
    says: ["effect questAdvance: 'q_echo_crystal' has no stage 'nope'"],
  },
  {
    rule: 'rule-02',
    title: 'unlockExit for an exit the origin lacks',
    report: () => viaTables(withLibraryEvent([{ id: 'ev_unlock', text: 'x', effects: [{ unlockExit: { from: library, to: apex } }] }])),
    says: [`effect unlockExit: ${library} has no exit to ${apex} to unlock`],
  },
  {
    rule: 'rule-02',
    title: 'startCombat / startDialogue / unlockCodex / recruit / spawn / teleport with unknown ids',
    report: () =>
      viaTables(
        withLibraryEvent([
          {
            id: 'ev_ghosts',
            text: 'x',
            effects: [
              { startCombat: 'enc_ghost' },
              { startDialogue: 'scene_ghost' },
              { unlockCodex: 'codex_ghost' },
              { unlockRecipe: 'recipe_ghost' },
              { recruit: 'brak' },
              { spawn: { creature: 'cr_ghost', location: 'loc_ghost' } },
              { teleport: 'loc_ghost' },
              { scatter: { location: 'loc_ghost' } },
              { questStart: 'q_ghost' },
              { giveItem: { item: 'item_ghost' } },
              { grantEcho: 'echo_ghost' },
              { ending: 'ending_ghost' },
              { rep: { faction: 'weavers', delta: 1 } },
              { loyalty: { companion: 'brak', delta: 1 } },
            ],
          },
        ]),
      ),
    says: [
      "effect startCombat encounter 'enc_ghost' not found",
      "effect startDialogue 'scene_ghost' not found in dialogues",
      "effect unlockCodex 'codex_ghost' not found in codex",
      "effect unlockRecipe 'recipe_ghost' not found in recipes",
      "effect recruit 'brak' not found in companions",
      "effect spawn 'cr_ghost' not found in creatures",
      "effect spawn location 'loc_ghost' not found in locations",
      "effect teleport 'loc_ghost' not found in locations",
      "effect scatter 'loc_ghost' not found in locations",
      "effect questStart 'q_ghost' not found in quests",
      "effect giveItem 'item_ghost' not found in items",
      "effect grantEcho 'echo_ghost' not found in echoes",
      "effect ending 'ending_ghost' not found in endings",
      "effect rep faction 'weavers' not found in factions",
      "effect loyalty companion 'brak' not found in companions",
    ],
  },
  {
    rule: 'rule-02',
    title: 'a config condition (the Apex gate) is walked',
    report: () => viaTables((t) => { t.config.apexGate = { any: [{ counter: { name: 'quests_completed', min: 1 } }, { echo: 'echo_ghost' }] }; }),
    says: ["condition echo 'echo_ghost' not found in echoes"],
  },
  {
    rule: 'rule-02',
    title: 'a flag that is tested but never set (a warning: flags are free)',
    report: () => viaTables(withLibraryVariant({ flag: 'flag_never_set' })),
    says: ["flag 'flag_never_set' is tested but no setFlag effect anywhere sets it"],
    level: 'warnings',
  },

  // ---- rule 3: specials
  { rule: 'rule-03', title: 'an unknown ability special', report: () => viaPack((p) => { get(p.abilities, 'rgr_rend').special = 'nonsense' as never; }), says: ["special 'nonsense' is not in SPECIALS"] },
  { rule: 'rule-03', title: 'a special of the wrong scope (an ability-only special on a move)', report: () => viaPack((p) => { const m = get(get(p.creatures, 'cr_corrupted_shade').moves, 'shade_fade'); m.special = 'trap' as never; }), says: ["special 'trap' is not usable on move"] },
  { rule: 'rule-03', title: 'a status special that is registered for another scope', report: () => viaPack((p) => { get(p.statuses, 'status_bleed').special = 'cleanse'; }), says: ["special 'cleanse' is not usable on status"] },

  // ---- rules 4 and 5: registries supplied by the UI/audio layers (warnings)
  {
    rule: 'rule-04',
    title: 'art keys missing from the art registry',
    report: () =>
      viaTables((t) => { row(t.locations, library).art.focal = 'ghost_piece'; }, {
        registries: { silhouettes: ['dead_tree', 'tablet', 'arch_broken'], focal: ['archive_window'], sigilBases: ['shade'], icons: ['dagger'] },
      }),
    says: ["silhouette 'shelf_ridge'", "focal piece 'ghost_piece'", "sigil base 'mireling'", "icon 'staff'"],
    level: 'warnings',
  },
  {
    rule: 'rule-05',
    title: 'ambient presets missing from the audio registry',
    report: () => viaTables((t) => { row(t.locations, library).ambient = 'hush'; }, { registries: { ambient: ['silverwood_drone', 'glowlands_pulse'] } }),
    says: ["ambient preset 'hush' is not in the audio registry"],
    level: 'warnings',
  },

  // ---- rule 6: ids
  { rule: 'rule-06', title: 'a record filed under another key', report: () => viaPack((p) => { p.items.item_renamed = get(p.items, 'item_glow_moss'); }), says: ["record is filed under 'item_renamed' but its id is 'item_glow_moss'"] },
  { rule: 'rule-06', title: 'an id that does not match the D-044 shape of its table', report: () => viaPack((p) => { p.items.mat_ley_spark = { ...get(p.items, 'mat_ley_spark'), id: 'mat_Ley_Spark' }; }), says: ["id 'mat_Ley_Spark' does not match the D-044 shape for items"] },
  {
    rule: 'rule-06',
    title: 'the same encounter id on two locations',
    report: () => viaTables((t) => { const e = row(t.locations, library).encounters?.[0]; if (e) e.id = 'enc_nexus_aberration'; }),
    says: ["encounter id 'enc_nexus_aberration' is already used by locations.loc_shattered_library"],
  },

  {
    rule: 'rule-06',
    title: 'a nested id that names an Object.prototype member (D-085)',
    report: () => viaPack((p) => {
      const scene = get(p.dialogues, 'scene_first_meeting_ilyra');
      const nodes = scene.nodes.map((n) => ({ ...n, choices: n.choices.map((c) => ({ ...c })) }));
      const choice = nodes.find((n) => n.choices.length > 0)?.choices[0];
      if (choice) choice.id = 'constructor';
      p.dialogues.scene_first_meeting_ilyra = { ...scene, nodes };
    }),
    says: ["'constructor' is reserved (it names an Object.prototype member)"],
  },

  // ---- rule 7: exits
  {
    rule: 'rule-07',
    title: 'no reverse exit, but a way back exists (warning)',
    report: () => viaTables((t) => { row(t.locations, plaza).exits = [{ dir: 'east', to: 'loc_veridian_glowlands', label: 'the long road east' }]; }),
    says: [`${plaza} has no reverse exit`],
    level: 'warnings',
  },
  { rule: 'rule-07', title: 'a destination with no way back (error)', report: () => viaTables((t) => { row(t.locations, apex).exits = []; }), says: [`${apex} has no way back to ${nexus}`] },
  {
    rule: 'rule-07',
    title: 'tagged one_way_ok, the same dead end is only a warning',
    report: () => viaTables((t) => { const a = row(t.locations, apex); a.exits = []; a.tags = [...(a.tags ?? []), 'one_way_ok']; }),
    says: [`${apex} has no reverse exit`],
    level: 'warnings',
  },
  {
    rule: 'rule-07',
    title: 'a road whose reverse carries another gate',
    report: () => viaTables((t) => { const road = row(t.locations, nexus).exits?.find((x) => x.kind === 'road'); if (road) road.gate = { echo: 'echo_tyrant_speaks' }; }),
    says: ['the reverse exit on loc_chronos_nexus must be a road with the same gate', 'the reverse exit on loc_whispering_ruins must be a road with the same gate'],
  },
  {
    rule: 'rule-07',
    title: 'a road without a gate',
    report: () => viaPack((p) => { const road = get(p.locations, ruins).exits.find((x) => x.kind === 'road'); if (road) delete road.gate; }),
    says: ['a road needs a gate (D-069.9)'],
  },
  {
    rule: 'rule-07',
    title: 'a plain exit that carries a gate',
    report: () => viaPack((p) => { const e = get(p.locations, ruins).exits[0]; if (e) e.gate = { echo: 'echo_apex_resonance' }; }),
    says: ["gate is only for kind 'road'"],
  },
  {
    rule: 'rule-07',
    title: 'an exit to itself, and a repeated direction',
    report: () =>
      viaPack((p) => {
        const loc = get(p.locations, library);
        loc.exits.push({ dir: 'up', to: library, hidden: false, travelWatches: 1, oneWay: false, kind: 'path' });
        loc.exits.push({ dir: 'south', to: ruins, hidden: false, travelWatches: 1, oneWay: false, kind: 'path' });
      }),
    says: ['an exit cannot lead to its own location', "direction 'south' is used by two exits"],
  },
  {
    rule: 'rule-07',
    title: 'a plain exit whose reverse is a road',
    report: () => viaPack((p) => { const back = get(p.locations, library).exits.find((x) => x.to === ruins); if (back) { back.kind = 'road'; back.gate = { echo: 'echo_apex_resonance' }; } }),
    says: ['the reverse exit on loc_shattered_library is a road, expected a plain exit'],
  },

  // ---- rule 8: reachability
  {
    rule: 'rule-08',
    title: 'a location nothing leads to',
    report: () => viaTables((t) => bareLocation(t, 'loc_island')),
    says: ['loc_island: unreachable from the start location loc_whispering_ruins'],
  },
  {
    rule: 'rule-08',
    title: 'a hidden exit with no `when` and no unlockExit (warning)',
    report: () => viaTables((t) => { const l = row(t.locations, library); l.exits = [...(l.exits ?? []), { dir: 'up', to: ruins, hidden: true }]; }),
    says: ['is hidden with no `when` and no unlockExit effect: it can never appear'],
    level: 'warnings',
  },
  {
    rule: 'rule-08',
    title: 'legacy locations unreachable in a synthetic Loop 1 (an Echo-gated bridge)',
    report: () => viaTables((t) => { const e = row(t.locations, plaza).exits?.find((x) => x.dir === 'east'); if (e) e.when = { echo: 'echo_tyrant_speaks' }; }),
    says: [`${nexus}: legacy location unreachable in Loop 1`, 'loc_veridian_glowlands: legacy location unreachable in Loop 1', `${apex}: legacy location unreachable in Loop 1`],
  },
  { rule: 'rule-08', title: 'a start location that does not exist', report: () => viaTables((t) => { t.config.startLocationId = 'loc_still_shore'; }), says: ["start location 'loc_still_shore' not found in locations"] },
  {
    rule: 'rule-08',
    title: 'Threshold locations without a Still Shore',
    report: () => viaTables((t) => bareLocation(t, 'loc_loom', { tags: ['threshold'] })),
    says: ["Threshold locations exist but 'loc_still_shore' does not"],
  },
  {
    rule: 'rule-08',
    title: 'a Threshold location its Still Shore does not lead to',
    report: () => viaTables((t) => { bareLocation(t, 'loc_still_shore', { tags: ['threshold'] }); bareLocation(t, 'loc_loom', { tags: ['threshold'] }); }),
    says: ['loc_loom: Threshold location unreachable from loc_still_shore'],
  },
  {
    rule: 'rule-08',
    title: 'a location in a gated region with no door in (warning)',
    report: () =>
      viaTables((t) => {
        t.regions.push({ ...structuredClone(row(t.regions, 'region_silverwood_ruins')), id: 'region_before', unlockWhen: { loop: { min: 2 } }, legacy: false });
        bareLocation(t, 'loc_before_gate', { regionId: 'region_before' });
      }),
    says: ['region region_before is gated (unlockWhen) and this location has no exit leading to it'],
    level: 'warnings',
  },

  // ---- rule 9: quest graph
  {
    rule: 'rule-09',
    title: 'a stage nothing leads to',
    report: () => viaTables((t) => { row(t.quests, quest).stages.push({ id: 'orphan', journal: 'Nobody gets here.', outcome: 'fail' }); }),
    says: ["stage 'orphan' is unreachable from 'find_crystal'"],
  },
  {
    rule: 'rule-09',
    title: 'no reachable stage completes the quest',
    report: () => viaTables((t) => { const s = row(t.quests, quest).stages[1]; if (s) s.outcome = 'fail'; }),
    says: ["no reachable terminal stage with outcome 'complete'"],
  },
  {
    rule: 'rule-09',
    title: 'every branch condition is never true',
    report: () => viaTables((t) => { const s = row(t.quests, quest).stages[0]; if (s) s.next = [{ when: { not: { all: [] } }, to: 'crystal_found' }]; }),
    says: ["stage 'find_crystal': every branch condition is never true"],
  },
  {
    rule: 'rule-09',
    title: 'a stage with neither next nor outcome (warning)',
    report: () =>
      viaTables((t) => {
        const q = row(t.quests, quest);
        const first = q.stages[0];
        if (first) Object.assign(first, { timeLimitDays: 3, onTimeoutTo: 'limbo' });
        q.stages.push({ id: 'limbo', journal: 'Nothing follows.' });
      }),
    says: ["stage 'limbo' has neither next nor outcome"],
    level: 'warnings',
  },
  {
    rule: 'rule-09',
    title: 'a stage with both an outcome and a next',
    report: () => viaPack((p) => { const s = get(p.quests, quest).stages[1]; if (s) s.next = 'find_crystal'; }),
    says: ["stage 'crystal_found' has both an outcome and a next"],
  },
  {
    rule: 'rule-09',
    title: 'a stage that only a questAdvance effect reaches counts as reachable',
    report: () =>
      viaTables((t) => {
        row(t.quests, quest).stages.push({ id: 'shortcut_only', journal: 'Reached by an effect.', outcome: 'complete' });
        withLibraryEvent([{ id: 'ev_jump', text: 'x', effects: [{ questAdvance: { quest, stage: 'shortcut_only' } }] }])(t);
        row(t.quests, quest).stages.push({ id: 'orphan', journal: 'Nobody gets here.', outcome: 'fail' });
      }),
    says: ["stage 'orphan' is unreachable"],
  },

  // ---- rule 10: dialogue graph
  {
    rule: 'rule-10',
    title: 'a node no entry leads to',
    report: () => viaTables((t) => { row(t.dialogues, scene).nodes.push({ id: 'orphan', speaker: 'narrator', text: 'Unheard.', next: 'end' }); }),
    says: ["node 'orphan' is unreachable from the scene's entry"],
  },
  {
    rule: 'rule-10',
    title: 'a choice-less node with no next',
    report: () =>
      viaTables((t) => {
        const s = row(t.dialogues, scene);
        s.nodes.push({ id: 'mute', speaker: 'narrator', text: 'Silence.' });
        const declined = s.nodes.find((n) => n.id === 'declined');
        if (declined) declined.next = 'mute';
      }),
    says: ["node 'mute' has no choices and no next"],
  },
  {
    rule: 'rule-10',
    title: 'an infinite continue (a cycle of choice-less nodes)',
    report: () =>
      viaTables((t) => {
        const s = row(t.dialogues, scene);
        s.nodes.push({ id: 'loop_a', speaker: 'narrator', text: 'A.', next: 'loop_b' }, { id: 'loop_b', speaker: 'narrator', text: 'B.', next: 'loop_a' });
        const declined = s.nodes.find((n) => n.id === 'declined');
        if (declined) declined.next = 'loop_a';
      }),
    says: ['is part of a cycle of choice-less nodes (an infinite continue)'],
  },
  {
    rule: 'rule-10',
    title: 'a speaker that is no NPC, companion or creature',
    report: () => viaTables((t) => { const n = row(t.dialogues, scene).nodes[0]; if (n) n.speaker = 'npc_ghost'; }),
    says: ["speaker 'npc_ghost' is not an npc, companion or creature id"],
  },
  {
    rule: 'rule-10',
    title: 'a hotkey reused in one node',
    report: () => viaPack((p) => { const c = get(p.dialogues, scene).nodes[0]?.choices; if (c?.[1]) c[1].hotkey = '1'; }),
    says: ["node 'greet' reuses a choice hotkey"],
  },

  // ---- rule 11: creatures
  {
    rule: 'rule-11',
    title: 'a boss with too many phases, hpBelow triggers that do not decrease',
    report: () => viaPack((p) => { const c = get(p.creatures, tyrant); c.phases.push(structuredClone(c.phases[1]!), structuredClone(c.phases[1]!)); }),
    says: ['a boss has 2–4 phases; got 5', 'is not below the previous phase'],
  },
  { rule: 'rule-11', title: 'a boss that can be fled', report: () => viaPack((p) => { get(p.creatures, tyrant).fleeable = true; }), says: ['a boss is not fleeable'] },
  { rule: 'rule-11', title: 'a phase with an empty pattern', report: () => viaPack((p) => { const ph = get(p.creatures, tyrant).phases[0]; if (ph) ph.pattern = []; }), says: ["phase 'tyr_movement_1' has an empty pattern"] },
  {
    rule: 'rule-11',
    title: 'a combat-scope effect outside creature data',
    report: () => viaTables(withLibraryEvent([{ id: 'ev_multi', text: 'x', effects: [{ multiHit: { hits: 2 } }] }])),
    says: ["combat-scope effect 'multiHit' is legal only in a creature move's effects or a phase's onEnter"],
  },
  {
    rule: 'rule-11',
    title: 'surviveRounds outside a boss’s first phase, and with rounds < 1',
    report: () =>
      viaPack((p) => {
        const phases = get(p.creatures, tyrant).phases;
        const second = phases[1];
        const first = phases[0];
        if (second) second.onEnter = [{ surviveRounds: { rounds: 2 } }];
        if (first) first.onEnter = [{ surviveRounds: { rounds: 0 } }];
      }),
    says: ["'surviveRounds' is legal only in a boss's first phase", "'surviveRounds' needs rounds >= 1"],
  },
  {
    rule: 'rule-11',
    title: 'a non-boss placed far outside its band (warning)',
    report: () => viaTables((t) => { const c = row(t.creatures, 'cr_corrupted_shade'); c.level = 9; }),
    says: ['level 9 is outside the 2–3 band of loc_shattered_library by more than 2'],
    level: 'warnings',
  },
  {
    rule: 'rule-11',
    title: 'a regional boss not 2 levels above its band top (warning)',
    report: () => viaTables((t) => { const a = row(t.locations, apex); a.tags = (a.tags ?? []).filter((x) => x !== 'apex'); }),
    says: [`regional boss at ${apex} is level 18; the band tops at 18, so expected 20`],
    level: 'warnings',
  },

  // ---- rule 12: items
  { rule: 'rule-12', title: 'a weapon without a weaponType', report: () => viaPack((p) => { delete get(p.items, 'item_rusty_dagger').weaponType; }), says: ['a weapon needs a weaponType'] },
  { rule: 'rule-12', title: 'a weaponType on armor', report: () => viaPack((p) => { get(p.items, 'item_ironclad_mail').weaponType = 'melee'; }), says: ['weaponType is only for weapons'] },
  { rule: 'rule-12', title: 'equipment without its slot', report: () => viaPack((p) => { delete get(p.items, 'item_ironclad_mail').slot; }), says: ["needs slot 'armor'"] },
  { rule: 'rule-12', title: 'a consumable with no onUse', report: () => viaPack((p) => { get(p.items, 'item_mana_bloom').onUse = []; }), says: ['a consumable needs onUse effects'] },
  { rule: 'rule-12', title: 'a sellable item worth nothing', report: () => viaPack((p) => { get(p.items, 'item_glow_moss').value = 0; }), says: ['a sellable item needs value > 0'] },
  { rule: 'rule-12', title: 'a rolled rarity on a material', report: () => viaPack((p) => { get(p.items, 'mat_ley_spark').rarityRule = 'rolled'; }), says: ["only weapon, armor and trinket roll a rarity"] },
  { rule: 'rule-12', title: 'a slot on a consumable', report: () => viaPack((p) => { get(p.items, 'item_glow_moss').slot = 'trinket'; }), says: ['a consumable has no equipment slot'] },

  // ---- rule 13: abilities
  { rule: 'rule-13', title: 'a wrong tier gate', report: () => viaPack((p) => { get(p.abilities, 'rgr_piercing_arrow').levelReq = 5; }), says: ['tier 2 unlocks at level 4, not 5'] },
  { rule: 'rule-13', title: 'a wrong half-point cost', report: () => viaPack((p) => { get(p.abilities, 'rgr_marked_shot').costHalf = 4; }), says: ['tier 1 costs 2 half-points, not 4'] },
  { rule: 'rule-13', title: 'a class ability that costs no MP', report: () => viaPack((p) => { get(p.abilities, 'rgr_rend').mp = 0; }), says: ['costs no MP and is not a resource converter'] },
  {
    rule: 'rule-13',
    title: 'an ability that does nothing',
    report: () => viaPack((p) => { const a = get(p.abilities, 'rgr_rend'); delete a.power; a.statuses = []; }),
    says: ['does nothing: needs power, heal, shield, statuses or a special'],
  },
  {
    rule: 'rule-13',
    title: 'two abilities in one branch tier',
    report: () => viaPack((p) => { p.abilities.rgr_twin = { ...structuredClone(get(p.abilities, 'rgr_marked_shot')), id: 'rgr_twin' }; }),
    says: ['rgr_marked_shot already fills ranger hunt tier 1'],
  },
  {
    rule: 'rule-13',
    title: 'a tier-3 ability whose branch lacks the lower tiers (DESIGN §5.1 prerequisites)',
    report: () =>
      viaTables((t) => {
        t.abilities.push({ ...structuredClone(row(t.abilities, 'wiz_fireball')), id: 'wiz_inferno', tier: 3, name: 'Inferno', mp: 20 });
      }),
    says: ['tier 3 needs the tier 2 ability of wizard pyre to exist'],
  },
  {
    rule: 'rule-13',
    title: 'itm_echo_bolt granted by the wrong item',
    report: () => viaPack((p) => { get(p.abilities, 'itm_echo_bolt').ownerId = 'item_echo_crystal'; }),
    says: ["itm_echo_bolt is granted by 'item_amulet_of_echoes' (D-047)"],
  },
  {
    rule: 'rule-13',
    title: 'the Amulet that does not grant itm_echo_bolt',
    report: () => viaPack((p) => { get(p.items, 'item_amulet_of_echoes').passives = []; }),
    says: ["item_amulet_of_echoes does not grant 'itm_echo_bolt' (D-047)"],
  },

  // ---- rule 14: statuses
  { rule: 'rule-14', title: 'a stackable status that cannot stack', report: () => viaPack((p) => { get(p.statuses, 'status_bleed').maxStacks = 1; }), says: ['a stackable status needs maxStacks > 1'] },

  // ---- rule 15: endings
  {
    rule: 'rule-15',
    title: 'a true ending whose requirements name no echo or flag',
    report: () => viaTables((t) => { row(t.endings, 'ending_unbound').requirements = { all: [{ loop: { min: 2 } }, { not: { location: apex } }] }; }),
    says: ['a true ending must require at least one echo or flag'],
  },
  {
    rule: 'rule-15',
    title: 'a true ending no { ending } effect reaches',
    report: () => viaTables((t) => { const o = row(t.creatures, tyrant).communion?.outcomes[0]; if (o) o.effects = [{ setFlag: 'flag_tyrant_spared' }, { setFlag: 'flag_refused_all_paths' }]; }),
    says: ["no { ending: 'ending_unbound' } effect anywhere in content"],
  },

  // ---- rule 16: echoes
  {
    rule: 'rule-16',
    title: 'an Echo nothing grants',
    // echo_tyrant_speaks is engine-granted (D-082), so the example uses a content-only Echo nobody grants.
    report: () => viaTables((t) => { t.echoes.push({ id: 'echo_orphan', name: 'Orphan', codexLine: 'Nothing grants me.', category: 'lore', obtainedBy: ['event:none'] }); }),
    says: ['no grantEcho effect and no quest reward grants this Echo'],
  },
  {
    rule: 'rule-16',
    title: 'an Echo that gates nothing (warning)',
    report: () =>
      viaTables((t) => {
        t.echoes.push({ id: 'echo_unused', name: 'Unused', codexLine: 'Nothing reads me.', category: 'lore', obtainedBy: ['quest:q_echo_crystal'] });
        row(t.quests, quest).rewards = { xp: 120, gold: 20, echoes: ['echo_unused'] };
      }),
    says: ['this Echo gates nothing'],
    level: 'warnings',
  },
  {
    rule: 'rule-16',
    title: 'exclusiveWith that is not symmetric',
    report: () =>
      viaTables((t) => {
        row(t.echoes, 'echo_tyrant_speaks').exclusiveWith = ['echo_apex_resonance'];
      }),
    says: ['exclusiveWith is not symmetric: echo_apex_resonance does not list echo_tyrant_speaks'],
  },
  {
    rule: 'rule-16',
    title: 'an Echo that claims to be required for an ending whose requirements never read it',
    report: () => viaTables((t) => { row(t.echoes, 'echo_tyrant_speaks').requiredForEndings = ['ending_unbound']; }),
    says: ['ending_unbound lists this Echo as required but its requirements never read echo_tyrant_speaks'],
  },

  // ---- rule 17: codex
  {
    rule: 'rule-17',
    title: 'a body over 220 words',
    report: () => viaTables((t) => { t.codex.push({ id: 'codex_long', title: 'Long', voice: 'wayfinder_notes', category: 'history', body: wordsOf(221), unlockedAtStart: true }); }),
    says: ['body is 221 words; the limit is 220'],
  },
  {
    rule: 'rule-17',
    title: 'an entry nothing unlocks',
    report: () => viaTables((t) => { t.codex.push({ id: 'codex_lost', title: 'Lost', voice: 'wayfinder_notes', category: 'history', body: 'Nobody can read this.' }); }),
    says: ['unreachable lore'],
  },
  {
    rule: 'rule-17',
    title: 'a voice under 10% of the entries (warning)',
    report: () =>
      viaTables((t) => {
        for (let i = 0; i < 10; i++) t.codex.push({ id: `codex_note_${i}`, title: `Note ${i}`, voice: 'wayfinder_notes', category: 'history', body: 'Short.', unlockedAtStart: true });
      }),
    says: ["voice 'remnant_archive' has 1 of 15 entries (7%), under 10%", "voice 'weaver_fragment' has 1 of 15 entries"], // U29: the fixture's 5 Tyrant entries
    level: 'warnings',
  },

  // ---- rule 18: companions (the full six and the arcs are strict-only)
  {
    rule: 'rule-18',
    title: 'a companion ability owned by someone else',
    report: () => viaPack((p) => { get(p.abilities, 'comp_ilyra_mend').ownerId = 'nyx'; }),
    fires: ['rule-01', 'rule-18'],
    says: ["ability 'comp_ilyra_mend' has ownerId nyx, expected ilyra"],
  },
  {
    rule: 'rule-18',
    title: 'a signature ability owned by someone else',
    report: () => viaPack((p) => { get(p.abilities, 'comp_ilyra_archive_light').ownerId = 'nyx'; }),
    fires: ['rule-01', 'rule-18'],
    says: ["signature ability 'comp_ilyra_archive_light' has ownerId nyx, expected ilyra"],
  },

  // ---- rule 19: attunements (the fifteen and the modifiers are strict-only)
  { rule: 'rule-19', title: 'an equip cap other than 5', report: () => viaTables((t) => { t.config.attunementEquipCap = 6; }), says: ['attunementEquipCap is 6; it must be 5 (C-41)'] },

  // ---- rule 20: merchants
  {
    rule: 'rule-20',
    title: 'a location merchant who is not among its NPCs',
    report: () => viaTables((t) => { row(t.locations, plaza).npcs = []; }),
    says: ['merchant npc_tamsin_reed is not among the npcs at loc_silverwood_plaza'],
  },
  {
    rule: 'rule-20',
    title: 'a merchant NPC without the merchant role',
    report: () => viaTables((t) => { row(t.npcs, 'npc_tamsin_reed').roles = ['lore']; }),
    says: ["npc_tamsin_reed does not have the 'merchant' role"],
  },
  { rule: 'rule-20', title: 'a quest item in stock', report: () => viaTables((t) => { row(t.merchants, 'npc_tamsin_reed').stock.push({ itemId: 'item_echo_crystal' }); }), says: ['item_echo_crystal is a quest item and cannot be stocked'] },
  { rule: 'rule-20', title: 'an unsellable item in the rolled pool', report: () => viaTables((t) => { row(t.merchants, 'npc_tamsin_reed').rollStock?.pool.push('item_heartstone_core'); }), says: ['item_heartstone_core is not sellable'] },

  // ---- rule 22: legacy preservation (existence and missing names are strict-only)
  { rule: 'rule-22', title: 'a legacy location renamed', report: () => viaTables((t) => { row(t.locations, plaza).legacyName = 'Silverwood Square'; }), says: ["legacyName is 'Silverwood Square'; Appendix A says 'Silverwood Plaza'"] },
  { rule: 'rule-22', title: 'a legacy name on the wrong id', report: () => viaTables((t) => { row(t.items, 'mat_ley_spark').legacyName = 'Glow Moss'; }), says: ["legacyName 'Glow Moss' belongs to item_glow_moss in Appendix A, not mat_ley_spark"] },
  { rule: 'rule-22', title: 'a legacy name nobody in Appendix A owns', report: () => viaTables((t) => { row(t.items, 'mat_ley_spark').legacyName = 'Ley Spark'; }), says: ["legacyName 'Ley Spark' is not a legacy name in Appendix A"] },
  { rule: 'rule-22', title: 'a legacy location in the wrong region', report: () => viaTables((t) => { row(t.locations, ruins).regionId = 'region_glowlands_nexus'; }), says: ['legacy location belongs to region_silverwood_ruins (Appendix A.2)'] },
  { rule: 'rule-22', title: 'a legacy quest renamed', report: () => viaTables((t) => { row(t.quests, quest).name = 'Echoes in the Archive'; }), says: ["legacy quest is named 'Echoes in the Archive'"] },
  { rule: 'rule-22', title: 'a legacyId on the wrong quest', report: () => viaTables((t) => { row(t.quests, quest).legacyId = 'lost_scroll'; }), says: ["legacyId 'lost_scroll' belongs to q_lost_scroll in Appendix A, not q_echo_crystal"] },
  { rule: 'rule-22', title: 'a legacyId that is no legacy quest', report: () => viaTables((t) => { row(t.quests, quest).legacyId = 'mystery'; }), says: ["legacyId 'mystery' is not a legacy quest in Appendix A"] },
  { rule: 'rule-22', title: 'a legacy class not flagged legacy', report: () => viaTables((t) => { row(t.classes, 'ranger').legacy = false; }), says: ['ranger is a legacy class: legacy must be true'] },
  { rule: 'rule-22', title: 'a new class flagged legacy', report: () => viaTables((t) => { t.classes.push({ ...structuredClone(row(t.classes, 'ranger')), id: 'elf', legacy: true }, { ...structuredClone(row(t.classes, 'ranger')), id: 'shadow_weaver', legacy: true }); }), says: ['shadow_weaver is not a legacy class (Appendix A.5): legacy must be false'] },
];

describe('each rule has a failing example', () => {
  for (const ex of EXAMPLES) {
    test(`${ex.rule}: ${ex.title}`, () => {
      const report = ex.report();
      expect(rulesOf(report)).toEqual((ex.fires ?? [ex.rule]).slice().sort());
      const level = report[ex.level ?? 'errors'];
      expect(level.length).toBeGreaterThan(0);
      const text = level.map(formatIssue).join('\n');
      for (const needle of ex.says) expect(text).toContain(needle);
      if (ex.level === 'warnings') expect(report.errors).toEqual([]);
    });
  }

  test('a repaired edit validates clean again (the examples are not vacuous)', () => {
    // the same shapes of edit that are fine: an engine flag, a started combat that exists, a rolled stock item that is sellable
    const report = viaTables((t) => {
      withLibraryVariant({ flag: 'flag_scene_done_scene_first_meeting_ilyra' })(t);
      withLibraryEvent([{ id: 'ev_fight', text: 'x', effects: [{ startCombat: 'enc_library_shades' }, { setFlag: 'flag_new' }] }])(t);
      withLibraryVariant({ flag: 'flag_new' })(t);
      row(t.merchants, 'npc_tamsin_reed').rollStock?.pool.push('item_mana_bloom');
      const nexusRoad = row(t.locations, nexus).exits?.find((x) => x.kind === 'road');
      if (nexusRoad) nexusRoad.gate = { echo: 'echo_apex_resonance' };
      // a one-way exit needs no way back
      const apexLoc = row(t.locations, apex);
      apexLoc.exits = [];
      const toApex = row(t.locations, nexus).exits?.find((x) => x.to === apex);
      if (toApex) toApex.oneWay = true;
    });
    expect(report).toEqual({ errors: [], warnings: [] });
  });
});

// ---- Strict mode: the completeness-count rules --------------------------------------------------------------------------------

interface StrictExample {
  rule: string;
  title: string;
  /** The same pack validated in the given mode: strict reports the count failures, lenient must stay silent about them. */
  report: (strict: boolean) => ContentReport;
  says: string[];
}

const STRICT_EXAMPLES: StrictExample[] = [
  {
    rule: 'rule-13',
    title: '15 abilities per class, three branches of five tiers, all five classes',
    report: (strict) => validateContent(fixturePack(), { strict }),
    says: ['classes.ranger: 3 abilities; expected 15', "branch 'hunt' lacks tier 3, 4, 5", "class 'elf' does not exist", "class 'shadow_weaver' does not exist"],
  },
  {
    rule: 'rule-13',
    title: 'itm_echo_bolt and the Amulet must exist (D-047)',
    report: (strict) =>
      viaTables((t) => {
        row(t.locations, ruins).items = [];
        t.config.startItems = t.config.startItems.filter((x) => x.itemId !== 'item_amulet_of_echoes');
        t.abilities = t.abilities.filter((x) => x.id !== 'itm_echo_bolt');
        t.items = t.items.filter((x) => x.id !== 'item_amulet_of_echoes');
      }, { strict }),
    says: ["abilities.itm_echo_bolt: 'itm_echo_bolt' does not exist (D-047)", "items.item_amulet_of_echoes: 'item_amulet_of_echoes' does not exist (D-047)"],
  },
  { rule: 'rule-14', title: 'all 19 canonical statuses', report: (strict) => viaPack((p) => { delete p.statuses.status_rested; }, { strict }), says: ["canonical status 'status_rested' is missing"] },
  {
    rule: 'rule-15',
    title: 'six true endings and two closers',
    report: (strict) => validateContent(fixturePack(), { strict }),
    says: ["ending record 'ending_weavers_dawn' is missing", "ending record 'closer_escape' is missing", "ending record 'closer_fall' is missing"],
  },
  {
    rule: 'rule-18',
    title: 'six companions, three arc quests, two terminal outcomes',
    report: (strict) => validateContent(fixturePack(), { strict }),
    says: ["companion 'brak' is missing (D-013: six)", '1 arc quests; at least 3 are required', 'fewer than two distinct terminal outcomes'],
  },
  {
    rule: 'rule-19',
    title: 'the required modifiers and the fifteen attunements',
    report: (strict) => viaTables((t) => { t.attunements.push({ id: 'att_extra', name: 'Extra', description: 'Not in DESIGN.', cost: 5, effects: [{ kind: 'start_gold', amount: 1 }], icon: 'x' }); }, { strict }),
    says: ["required modifier 'mod_iron_loop' is missing", "attunement 'att_steady_hand' (DESIGN §10.7) is missing", "'att_extra' is not one of the fifteen Attunements of DESIGN §10.7"],
  },
  {
    rule: 'rule-21',
    title: 'the game-wide counts',
    report: (strict) => validateContent(fixturePack(), { strict }),
    says: [
      '2 regions; expected 12',
      '6 locations; expected 73',
      '1 story quests (D-045, legacy six included); expected 44',
      '0 class mini-quests; expected 5',
      '5 codex entries; expected at least 85',
      '17 echoes; expected 103',
      '4 creatures (anomaly variants apart); expected 57',
      '0 anomaly variants; expected 16',
      '20 items; expected at least 120',
      '0 achievements; expected 40',
      '6 class abilities; expected 75',
      '4 companion abilities; expected 24',
      '3 ending records; expected 8',
      '1 factions; expected 3',
      '0 attunements; expected 15',
      '1 companions; expected 6',
      '2 classes; expected 5',
    ],
  },
  {
    rule: 'rule-22',
    title: 'every Appendix A record exists with its legacy name or id',
    report: (strict) => viaTables((t) => { delete row(t.locations, library).legacyName; delete row(t.items, 'item_glow_moss').legacyName; }, { strict }),
    says: [
      "legacy location 'loc_crumbling_archway' ('Crumbling Archway') does not exist (Appendix A)",
      "locations.loc_shattered_library.legacyName: legacyName is missing; Appendix A says 'Shattered Library'",
      "items.item_glow_moss.legacyName: legacyName is missing; Appendix A says 'Glow Moss'",
      "legacy creature 'cr_wildling_brute' ('Wildling Brute') does not exist (Appendix A)",
      "legacy creature 'cr_chronos_tyrant_contained' ('The Chronos Tyrant') does not exist (Appendix A)",
      "legacy quest 'q_lost_scroll' ('The Scholar's Lost Scroll') does not exist (Appendix A.5)",
      "quests.q_echo_crystal.legacyId: legacyId is missing; Appendix A says 'echo_crystal'",
      "legacy class 'elf' does not exist (Appendix A.5)",
      "npcs.npc_brak: legacy npc 'npc_brak' ('Brak') does not exist (Appendix A)",
    ],
  },
];

describe('strict mode runs the completeness-count rules', () => {
  for (const ex of STRICT_EXAMPLES) {
    test(`${ex.rule}: ${ex.title}`, () => {
      const mine = ex.report(true).errors.filter((e) => e.rule === ex.rule).map(formatIssue).join('\n');
      for (const needle of ex.says) expect(mine).toContain(needle);
    });
  }

  test('without strict the same packs are clean: the counts are skipped, every other rule still runs', () => {
    for (const ex of STRICT_EXAMPLES) expect(ex.report(false)).toEqual({ errors: [], warnings: [] });
  });

  test('strict does not invent problems: the satisfied halves of each rule stay silent', () => {
    const strict = validateContent(fixturePack(), { strict: true }).errors;
    const said = strict.map(formatIssue).join('\n');
    expect(strict.filter((e) => e.rule === 'rule-14')).toEqual([]); // the fixture has all 19 statuses
    expect(said).not.toContain("'itm_echo_bolt' does not exist"); // D-047: the bolt and its Amulet are there
    expect(said).not.toContain("companion 'ilyra' is missing");
    expect(said).not.toContain("legacy location 'loc_whispering_ruins'"); // the fixture holds six of the 21 legacy locations
    expect(said).not.toContain("legacy location 'loc_shattered_library'");
    expect(said).not.toContain("required modifier 'mod_frayed_clock'");
    expect([...new Set(strict.map((e) => e.rule))].sort()).toEqual(['rule-13', 'rule-15', 'rule-18', 'rule-19', 'rule-21', 'rule-22']);
  });

  test('pending: completeness failures become "pending — content not yet authored" warnings; real defects stay errors', () => {
    const clean = validateContent(fixturePack(), { strict: true, pending: true });
    expect(clean.errors).toEqual([]);
    expect(clean.warnings.length).toBeGreaterThan(50);
    expect(clean.warnings.every((w) => w.message.startsWith('pending — content not yet authored: '))).toBe(true);
    expect([...new Set(clean.warnings.map((w) => w.rule))].sort()).toEqual(['rule-13', 'rule-15', 'rule-18', 'rule-19', 'rule-21', 'rule-22']);
    // the same count findings, one for one, as strict reports them
    expect(clean.warnings.length).toBe(validateContent(fixturePack(), { strict: true }).errors.length);
    const broken = viaTables((t) => { row(t.locations, library).npcs = ['npc_ghost']; }, { strict: true, pending: true });
    expect(broken.errors.map((e) => e.rule)).toEqual(['rule-01']);
  });
});

describe('rule coverage', () => {
  test('all 22 rules have a failing example', () => {
    const covered = new Set([...EXAMPLES, ...STRICT_EXAMPLES].map((e) => e.rule));
    expect(RULES.filter((r) => !covered.has(r.rule)).map((r) => r.rule)).toEqual([]);
    expect(EXAMPLES.length + STRICT_EXAMPLES.length).toBeGreaterThan(100);
  });

  test('rules 4 and 5 are inert without registries (content cannot import the ui/audio layers)', () => {
    const edited = viaTables((t) => { row(t.locations, library).art.focal = 'ghost_piece'; row(t.locations, library).ambient = 'hush'; });
    expect(edited).toEqual({ errors: [], warnings: [] });
  });
});

// ---- tools/validate-content.ts ------------------------------------------------------------------------------------------------

function run(argv: string[], tables?: Partial<ContentTables>): { code: number; out: string } {
  const out: string[] = [];
  const code = tables ? main(argv, (l) => out.push(l), tables) : main(argv, (l) => out.push(l));
  return { code, out: out.join('\n') };
}

describe('the validate CLI', () => {
  test('the real pack is still being authored (D-090): strict, exit 0, completeness rules and references pending', () => {
    const { code, out } = run([]);
    expect(code).toBe(0);
    expect(out).toContain('validate: 22 rules, strict');
    expect(out).toMatch(/ locations [1-9]\d* · /); // U42 landed the first region
    expect(out).toMatch(/pending rule-21: \d+ completeness check\(s\) — content not yet authored/);
    expect(out).toMatch(/pending rule-01: \d+ reference\(s\) into tables still being authored — content not yet authored/);
    expect(out).toMatch(/validate: ok — 0 errors, \d+ warning\(s\), \d+ pending completeness check\(s\), \d+ pending reference\(s\) \(\d+ table\(s\) still being authored\)/);
    expect(out).not.toContain('  error ');
  });

  test('--verbose lists each pending check, --lenient skips the counts but keeps the pending references', () => {
    const verbose = run(['--verbose']);
    expect(verbose.code).toBe(0);
    expect(verbose.out).toMatch(/pending rule-21: [a-z]+\.-: pending — content not yet authored: \d+ [a-z ]+; expected \d+/); // (regions and locations are complete since U48a)
    const lenient = run(['--lenient']);
    expect(lenient.code).toBe(0);
    expect(lenient.out).toContain('22 rules, lenient');
    expect(lenient.out).not.toMatch(/pending rule-\d+: \d+ completeness check/);
    expect(lenient.out).toMatch(/validate: ok — 0 errors, \d+ warning\(s\), 0 pending completeness check\(s\), \d+ pending reference\(s\)/);
  });

  test('once the pack has any content the counts are errors: the fixture fails strict, passes lenient', () => {
    const strict = run([], miniContentTables);
    expect(strict.code).toBe(1);
    expect(strict.out).toContain('error rule-21: locations.-: 6 locations; expected 73');
    expect(strict.out).toMatch(/validate: FAILED — \d+ error\(s\), 0 warning\(s\)/);
    expect(strict.out).not.toContain('pending');
    const lenient = run(['--lenient'], miniContentTables);
    expect(lenient.code).toBe(0);
    expect(lenient.out).toContain('validate: ok — 0 errors, 0 warning(s)');
  });

  test('warnings are listed and do not fail the run', () => {
    const tables = editedTables(withLibraryVariant({ flag: 'flag_never_set' }));
    const { code, out } = run(['--lenient'], tables);
    expect(code).toBe(0);
    expect(out).toContain("warning rule-02: locations.loc_shattered_library.descriptionVariants.0.when.flag: flag 'flag_never_set' is tested but no setFlag effect anywhere sets it");
    expect(out).toContain('validate: ok — 0 errors, 1 warning(s)');
  });

  test('a cross-reference error fails the run', () => {
    const tables = editedTables((t) => { row(t.locations, library).npcs = ['npc_ghost']; });
    const { code, out } = run(['--lenient'], tables);
    expect(code).toBe(1);
    expect(out).toContain("error rule-01: locations.loc_shattered_library.npcs.0: npc 'npc_ghost' not found in npcs");
    expect(out).toContain('validate: FAILED — 1 error(s), 0 warning(s)');
  });

  test('a schema error stops before the cross-reference rules run', () => {
    const tables = editedTables((t) => { row(t.items, 'item_glow_moss').value = -1; });
    const { code, out } = run([], tables);
    expect(code).toBe(1);
    expect(out).toContain('error schema: items.item_glow_moss.value');
    expect(out).toMatch(/validate: FAILED — \d+ schema error\(s\); cross-reference rules not run/);
  });
});
