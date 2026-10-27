// U57: the six regional quests and their scenes (src/content/shared/{quests,dialogues}/regional.ts), held to their sources read
// at test time: STORY (§11.1's table, §11.3's blocks — stage journals, prerequisites, consequences, rewards — §12's Echo rows,
// §10.7's figure on the water, §2.3's fourth verse, §11's Loop 1 refusal), DESIGN (§6.2 the regional tier, §10.1 the Waystones
// road, §13.3 the Bell Vault's four watches) and the conventions of the two barrel headers (U52's pattern, D-105). The hooks in
// the regions (each a listed edit) are pinned here, and then the scenes are played through the engine on the real pack
// (makeState + play) for what the numbers do: the bells, the mark, the boat, the stair's Blind, the Far Light.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { dialogues as RAW_SCENES } from '@content/shared/dialogues/regional';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { AMBUSH_INTROS, encounters as RAW_ENCOUNTERS, quests as RAW_QUESTS } from '@content/shared/quests/regional';
import { choiceViews, legalActions, type Action, type GameEvent, type GameState } from '@engine/index';
import type { Condition } from '@schema/condition';
import type { DialogueScene } from '@schema/dialogue';
import type { Effect } from '@schema/effect';
import type { Quest } from '@schema/quest';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const STORY = read('docs/STORY.md');
const DESIGN = read('docs/DESIGN.md');
const pack = buildContentPack();

const need = <T>(v: T | undefined, what: string): T => {
  if (v === undefined) throw new Error(`missing ${what}`);
  return v;
};
const quest = (id: string): Quest => need(pack.quests[id], id);
const scene = (id: string): DialogueScene => need(pack.dialogues[id], id);
const node = (sceneId: string, nodeId: string) => need(scene(sceneId).nodes.find((n) => n.id === nodeId), `${sceneId}.${nodeId}`);
const choice = (sceneId: string, nodeId: string, choiceId: string) => need(node(sceneId, nodeId).choices.find((c) => c.id === choiceId), `${sceneId}.${nodeId}.${choiceId}`);
const stage = (questId: string, stageId: string) => need(quest(questId).stages.find((s) => s.id === stageId), `${questId}.${stageId}`);
const loc = (id: string) => need(pack.locations[id], id);
const event = (locationId: string, id: string) => need(loc(locationId).events.find((e) => e.id === id), `${locationId}.${id}`);
const regionalScenes = RAW_SCENES.map((s) => scene(s.id));
const regionalQuests = RAW_QUESTS.map((q) => quest(q.id));

const QUEST_IDS = ['q_bell_vault', 'q_bone_road', 'q_lightless_stair', 'q_the_drowned_lantern', 'q_high_mark', 'q_the_still_shore'];
const SCENE_IDS = [
  'scene_dray_bell_vault_offer',
  'scene_dray_bell_vault_waiting',
  'scene_dray_bell_vault_after',
  'scene_bell_vault_discovery',
  'scene_bell_vault_bells',
  'scene_hadda_bone_road_offer',
  'scene_hadda_bone_road_waiting',
  'scene_hadda_bone_road_report',
  'scene_hadda_bone_road_after',
  'scene_borin_forge_mark',
  'scene_hallows_cairn_inscription',
  'scene_hollow_curtain_stair',
  'scene_ysmay_lightless_stair',
  'scene_wen_drowned_lantern_offer',
  'scene_wen_drowned_lantern_waiting',
  'scene_wen_drowned_lantern_report',
  'scene_wen_drowned_lantern_after',
  'scene_wen_idle',
  'scene_lantern_boat',
  'scene_plateau_stair',
  'scene_dask_high_mark',
  'scene_high_mark_look_east',
  'scene_far_light_look_back',
];
/** The scenes a place opens (no `npcId`): the region's event that opens each. */
const PLACE_SCENES: Record<string, [locationId: string, eventId: string]> = {
  scene_bell_vault_discovery: ['loc_drowned_stair', 'ev_stair_bell'],
  scene_bell_vault_bells: ['loc_bell_wardens_deep', 'ev_deep_bells'],
  scene_hallows_cairn_inscription: ['loc_stormgate_cairns', 'ev_hallows_ember_bowl'],
  scene_hollow_curtain_stair: ['loc_voidscar_hollow', 'ev_hollow_curtain_stair'],
  scene_lantern_boat: ['loc_sporelight_shallows', 'ev_shallows_lantern_boat'],
  scene_plateau_stair: ['loc_sky_whisper_plateau', 'ev_plateau_stair'],
  scene_high_mark_look_east: ['loc_windward_stair', 'ev_stair_look_east'],
  scene_far_light_look_back: ['loc_far_light', 'ev_far_light_look_back'],
};
const ENCOUNTER_IDS = ['enc_bone_road_cairn_1', 'enc_bone_road_cairn_2', 'enc_bell_vault_archivists'];

// ---- Reading STORY and DESIGN -------------------------------------------------------------------------------------------------

/** STORY as one line of prose: wrapped lines joined, markdown emphasis dropped. */
const STORY_FLAT = STORY.replace(/\n\s*>?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ');
const inStory = (text: string): boolean => text.split('\n').every((line) => STORY_FLAT.includes(line));
/** STORY §11.3's block for one quest, flattened. */
function storyBlock(questId: string): string {
  const start = STORY.indexOf(`#### \`${questId}\``);
  if (start < 0) throw new Error(`no STORY §11.3 block for ${questId}`);
  const end = STORY.indexOf('\n#### ', start + 10);
  return STORY.slice(start, end < 0 ? undefined : end).replace(/\n\s*/g, ' ').replace(/\*/g, '');
}
/** STORY §12's row for an Echo: its cells. */
function echoRow(id: string): string[] {
  const catalog = STORY.slice(STORY.indexOf('## 12. Echo catalog'), STORY.indexOf('## 13. Key scenes'));
  return need(catalog.split('\n').find((l) => l.startsWith('| `') && l.includes(`\`${id}\``)), `STORY §12 ${id}`).split('|').map((c) => c.trim());
}
const has = (effects: readonly Effect[], effect: Effect): boolean => effects.some((e) => JSON.stringify(e) === JSON.stringify(effect));
const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const grantsOf = (effects: readonly Effect[]): string[] =>
  effects.flatMap((e) => ('grantEcho' in e ? [e.grantEcho] : 'onlyIf' in e ? grantsOf(e.onlyIf.effects) : []));

// ---- The quests -----------------------------------------------------------------------------------------------------------------

describe('the six regional quests (STORY §11.1, §11.3)', () => {
  const table = STORY.slice(STORY.indexOf('### 11.1 Table'), STORY.indexOf('### 11.2'));
  const row = (id: string): string[] => need(table.split('\n').find((l) => l.startsWith(`| \`${id}\``)), id).split('|').map((c) => c.trim());
  const GIVER: Record<string, string | undefined> = {
    'discovery / Keeper Dray': 'npc_ansel_dray',
    'Hadda Ironvow': 'npc_hadda_ironvow',
    "discovery (the Hollow's curtain)": undefined,
    'Elder Wen Thistlecourt': 'npc_elder_wen',
    'discovery / Dask': 'npc_dask',
    'auto (first Fall)': undefined,
  };

  test('the six are registered as regional quests after the Heartbeat, in STORY order, with STORY’s names, givers and loop gates', () => {
    expect(regionalQuests.map((q) => q.id)).toEqual(QUEST_IDS);
    expect(STORY).toContain('regional 7');
    const regional = Object.values(pack.quests).filter((q) => q.category === 'regional').map((q) => q.id);
    expect(regional).toEqual(QUEST_IDS);
    expect(quest('q_echoing_heartbeat').category).toBe('legacy'); // the seventh is U52's (STORY: "Regional: Silverwood Ruins (legacy)")
    for (const id of QUEST_IDS) {
      const q = quest(id);
      const r = row(id);
      expect([id, q.name, (r[3] ?? '').startsWith('Regional:'), q.giverNpcId]).toEqual([id, r[2], true, GIVER[r[4] as string]]);
      expect(id in GIVER || Object.keys(GIVER).includes(r[4] as string)).toBe(true);
      if (r[6] === '2+') expect([id, JSON.stringify(q.availableWhen).includes(JSON.stringify(FROM_LOOP_2))]).toEqual([id, true]);
      else {
        expect([id, (r[6] ?? '').replace(/\*/g, '')]).toEqual([id, '1+ (L1 open)']);
        expect([id, JSON.stringify(q.availableWhen ?? {}).includes('"loop"')]).toEqual([id, false]);
      }
      expect([id, q.startWhen]).toEqual([id, undefined]); // the Shore's hook starts the Still Shore (see below)
    }
    expect(STORY_FLAT).toContain('`q_blood_and_salt`, `q_bell_vault`, `q_lantern_in_the_reeds`, `q_high_mark` (marked 1+ (L1 open) below)');
    // bots: "M C X" / "X S P" / "X P (all)" / "all"; Pacifist no for the Vault and the Road
    for (const id of QUEST_IDS) expect([id, quest(id).botHint]).toEqual([id, id === 'q_bell_vault' || id === 'q_bone_road' ? 'melee' : 'explorer']);
    for (const id of QUEST_IDS) expect([id, row(id)[7]]).toEqual([id, id === 'q_bell_vault' || id === 'q_bone_road' ? 'no' : 'yes']);
  });

  test('prereqs are STORY §11.3’s: the Door of Pages or the scroll; Loop 2+ for the Road, the Stair, the Lantern and the Shore; Loop 1 for the High Mark', () => {
    expect(quest('q_bell_vault').availableWhen).toEqual({ any: [{ echo: 'echo_archive_door' }, { quest: { id: 'q_lost_scroll', status: 'completed' } }] });
    expect(storyBlock('q_bell_vault')).toContain('Prereq: `{ any: [ { echo: "echo_archive_door" }, { quest: { id: "q_lost_scroll", status: "completed" } } ] }`');
    expect(quest('q_bone_road').availableWhen).toEqual(FROM_LOOP_2);
    expect(storyBlock('q_bone_road')).toContain('Prereq: reached the Ring of Wagons; `{ loop: { min: 2 } }`');
    expect(quest('q_lightless_stair').availableWhen).toEqual(FROM_LOOP_2);
    expect(quest('q_the_drowned_lantern').availableWhen).toEqual(FROM_LOOP_2);
    expect(storyBlock('q_the_drowned_lantern')).toContain('Prereq: `{ loop: { min: 2 } }`');
    expect(quest('q_high_mark').availableWhen).toBeUndefined();
    expect(quest('q_the_still_shore').availableWhen).toEqual(FROM_LOOP_2);
    expect(storyBlock('q_the_still_shore')).toContain('Prereq: `{ loop: { min: 2 } }`');
    // D-067.15: a quest started at the Threshold belongs to the profile; it rides into the next loop's state, so it is not one
    // of the Heartbeat's two
    expect([quest('q_the_still_shore').repeatablePerLoop, quest('q_the_still_shore').countsForApex]).toEqual([false, false]);
    expect(storyBlock('q_the_still_shore')).toContain('Quests started here belong to the profile and survive the Far Light (D-067.15)');
    for (const id of QUEST_IDS.filter((x) => x !== 'q_the_still_shore')) expect([id, quest(id).repeatablePerLoop, quest(id).countsForApex]).toEqual([id, true, true]);
  });

  test('the first stage’s journal is STORY’s stage 1 journal, verbatim (tag story); every other journal is written, pinned and ≤ 40 words', () => {
    for (const q of regionalQuests) {
      const first = q.stages[0] as Quest['stages'][number];
      expect([q.id, first.tags, inStory(first.journal)]).toEqual([q.id, ['story'], true]);
      expect(storyBlock(q.id)).toContain(`Journal: "${first.journal}"`);
      for (const st of q.stages.slice(1)) expect([q.id, st.id, st.tags, WRITTEN.journals.includes(st.journal)]).toEqual([q.id, st.id, ['written'], true]);
      for (const st of q.stages) expect([q.id, st.id, words(st.journal) <= 40]).toEqual([q.id, st.id, true]);
      expect([q.id, WRITTEN.other.includes(q.description)]).toEqual([q.id, true]);
    }
  });

  test('DESIGN §6.2: the regional tier is 200–350; STORY’s rewards — the key and the lantern; 40 gold and the cloak; XP only; the boots; the cloak; 5 Resonance', () => {
    expect(DESIGN).toContain('regional 200–350');
    for (const q of regionalQuests) expect([q.id, q.rewards.xp >= 200 && q.rewards.xp <= 350]).toEqual([q.id, true]);
    expect(quest('q_bell_vault').rewards.items).toEqual([{ itemId: 'item_bell_vault_key', count: 1 }, { itemId: 'item_glyphbound_lantern', count: 1 }]);
    expect(storyBlock('q_bell_vault')).toContain('Rewards. Bell-Vault Key; Glyphbound Lantern.');
    expect([quest('q_bone_road').rewards.gold, quest('q_bone_road').rewards.items, quest('q_bone_road').rewards.rep]).toEqual([40, [{ itemId: 'item_salt_wind_cloak', count: 1 }], [{ faction: 'ironclad', delta: 10 }]]);
    expect(storyBlock('q_bone_road')).toContain('Consequences. Ironclad +10;');
    expect(storyBlock('q_bone_road')).toContain('Rewards. 40 gold; Salt-Wind Cloak.');
    expect(quest('q_lightless_stair').rewards).toMatchObject({ gold: 0, items: [], rep: [], echoes: [], resonance: 0 });
    expect(storyBlock('q_lightless_stair')).toContain('Rewards. tier XP only.');
    expect(quest('q_the_drowned_lantern').rewards.items).toEqual([{ itemId: 'item_stiltwalkers_boots', count: 1 }]);
    expect(storyBlock('q_the_drowned_lantern')).toContain("Rewards. Stilt-walker's Boots (+AGI, no Soaked).");
    expect(pack.items['item_stiltwalkers_boots']?.passives).toEqual([{ kind: 'statusImmunity', status: 'status_soaked' }]);
    expect(quest('q_high_mark').rewards.items).toEqual([{ itemId: 'item_sky_whisper_cloak', count: 1 }]);
    expect(storyBlock('q_high_mark')).toContain('Rewards. Sky-Whisper Cloak.');
    expect([quest('q_the_still_shore').rewards.resonance, quest('q_the_still_shore').rewards.items]).toEqual([5, []]);
    expect(storyBlock('q_the_still_shore')).toContain('Rewards. 5 Resonance.');
    for (const q of regionalQuests) for (const it of q.rewards.items) expect([q.id, it.itemId, pack.items[it.itemId] !== undefined]).toEqual([q.id, it.itemId, true]);
  });

  test('the Echoes each quest grants are STORY §11.3’s consequences and §12’s sources', () => {
    expect(quest('q_bell_vault').rewards.echoes).toEqual(['echo_bell_vault', 'echo_archive_door']);
    expect(storyBlock('q_bell_vault')).toContain('`echo_bell_vault`; `echo_archive_door`.');
    expect(echoRow('echo_archive_door')[3]).toBe('Scroll to Ilyra; or `q_bell_vault`');
    expect(quest('q_bone_road').rewards.echoes).toEqual(['echo_steppe_waystones']);
    expect(storyBlock('q_bone_road')).toContain('`echo_steppe_waystones` (the waystone order; the Steppe\'s short road, D-068.1)');
    // the Cairn's inscription: verse IV (§12: "Hallow's Cairn (`q_bone_road`)"), the ember, and the iron with the forge-mark
    const verse = node('scene_hallows_cairn_inscription', 'verse');
    expect(verse.onEnter).toEqual([{ grantEcho: 'echo_litany_verse_4' }, { grantEcho: 'echo_hallows_ember' }]);
    expect(echoRow('echo_litany_verse_4')[3]).toBe("Hallow's Cairn (`q_bone_road`); or Before");
    expect(storyBlock('q_bone_road')).toContain('`echo_hallows_ember`; with Borin\'s forge-mark in inventory, `echo_iron_that_does_not_wish`');
    const ember = node('scene_hallows_cairn_inscription', 'ember');
    expect(ember.onEnter[0]).toEqual({ onlyIf: { when: { item: { id: 'item_borins_forge_mark' } }, effects: [{ grantEcho: 'echo_iron_that_does_not_wish' }] } });
    expect(stage('q_lightless_stair', 'choir').onEnter).toEqual([{ grantEcho: 'echo_lightless_stair' }]);
    expect(storyBlock('q_lightless_stair')).toContain('Consequences. `echo_lightless_stair`');
    expect(quest('q_high_mark').rewards.echoes).toEqual(['echo_breach_clock', 'echo_high_mark']);
    expect(storyBlock('q_high_mark')).toContain('`echo_breach_clock` (if not already); `echo_high_mark`');
    expect(echoRow('echo_breach_clock')[3]).toContain('`q_high_mark`');
    // the Shore: `echo_threshold` either way (D-112: U57 grants it); the figure seen is the hint of six (§12 "(hint)")
    expect(quest('q_the_still_shore').rewards.echoes).toEqual(['echo_threshold']);
    expect(echoRow('echo_threshold')[3]).toBe('First Fall');
    expect(read('docs/DECISIONS.md')).toContain('`echo_threshold` and `echo_ritual_inevitable` are granted by U57/U58.');
    expect(node('scene_far_light_look_back', 'six').onEnter[0]).toEqual({ grantEcho: 'echo_six_in_the_mass' });
    expect(echoRow('echo_six_in_the_mass')[3]).toBe('Communion Movement II complete; or `q_the_still_shore` (hint)');
    expect(choice('scene_far_light_look_back', 'door', 'step').effects.some((e) => 'grantEcho' in e)).toBe(false);
    // every Echo named exists
    const granted = [...regionalQuests.flatMap((q) => q.rewards.echoes), ...regionalScenes.flatMap((s) => s.nodes.flatMap((n) => [...grantsOf(n.onEnter), ...n.choices.flatMap((c) => grantsOf(c.effects))]))];
    for (const id of granted) expect([id, pack.echoes[id] !== undefined]).toEqual([id, true]);
  });

  test('the stage graphs: objectives are the places and the kills STORY names; a stage a scene ends waits; every outcome is reached by a questAdvance last', () => {
    expect(stage('q_bell_vault', 'flooded_stair').objectives.map((o) => o.when)).toEqual([{ location: 'loc_bell_wardens_deep' }]);
    expect(STORY).toContain('the Bell Vault is `loc_bell_wardens_deep`, C-37');
    expect(stage('q_bone_road', 'ride_ahead').objectives.map((o) => [o.when, o.optional])).toEqual([[{ location: 'loc_bone_orchard' }, false], [{ item: { id: 'item_borins_forge_mark' } }, true]]);
    expect(stage('q_bone_road', 'first_cairn').objectives.map((o) => o.when)).toEqual([{ killed: { id: 'cr_wildling_brute', count: 2, sinceStage: true } }]);
    expect(stage('q_bone_road', 'storm_cairn').objectives.map((o) => o.when)).toEqual([{ location: 'loc_stormgate_cairns' }]);
    expect(stage('q_bone_road', 'second_cairn').objectives.map((o) => o.when)).toEqual([{ killed: { id: 'cr_void_touched_stalker', count: 2, sinceStage: true } }]);
    expect(storyBlock('q_bone_road')).toContain('Clear two cairn-ambushes (Wildling Brutes, Void-Touched Stalkers)');
    expect(storyBlock('q_bone_road')).toContain("At Hallow's Cairn (`loc_stormgate_cairns`, `ev_hallows_cairn`), read the ember-bowl inscription");
    expect(stage('q_lightless_stair', 'descend').objectives.map((o) => o.when)).toEqual([{ location: 'loc_stair_of_unmaking' }]);
    expect(stage('q_lightless_stair', 'halfway').objectives.map((o) => o.when)).toEqual([{ location: 'loc_sanctum_of_threads' }]);
    expect(storyBlock('q_lightless_stair')).toContain('the stair is `loc_stair_of_unmaking`');
    expect(read('docs/WORLD.md')).toContain('| the Hollow Choir | loc_sanctum_of_threads |');
    expect(stage('q_the_drowned_lantern', 'reed_maze').objectives.map((o) => o.when)).toEqual([{ location: 'loc_sporelight_shallows' }]);
    expect(storyBlock('q_the_drowned_lantern')).toContain('Navigate the Reed Maze (`loc_sporelight_shallows`');
    expect(stage('q_high_mark', 'markers').objectives.map((o) => o.when)).toEqual([{ location: 'loc_windward_stair' }]);
    expect(storyBlock('q_high_mark')).toContain('Climb the Windward Stair');
    // the Shore's four places have no objective a condition could read (the Threshold's state is the next loop's, D-082): the
    // places' events move it
    for (const st of quest('q_the_still_shore').stages) expect([st.id, st.objectives]).toEqual([st.id, []]);
    const waits: [string, string][] = [['q_bell_vault', 'ring_bells'], ['q_bone_road', 'read_inscription'], ['q_bone_road', 'return'], ['q_the_drowned_lantern', 'raise_boat'], ['q_the_drowned_lantern', 'return'], ['q_high_mark', 'look_east'], ['q_the_still_shore', 'walk'], ['q_the_still_shore', 'gallery'], ['q_the_still_shore', 'loom'], ['q_the_still_shore', 'far_light']];
    for (const [questId, stageId] of waits) {
      const st = stage(questId, stageId);
      expect([questId, stageId, st.objectives.filter((o) => !o.optional).length, typeof st.next, st.advanceWhen]).toEqual([questId, stageId, 0, 'string', undefined]);
    }
    const ends: [readonly Effect[], string, string][] = [
      [choice('scene_bell_vault_bells', 'bells', 'fountain_order').effects, 'q_bell_vault', 'water_drops'],
      [choice('scene_bell_vault_bells', 'bells', 'known_order').effects, 'q_bell_vault', 'water_drops'],
      [choice('scene_bell_vault_bells', 'plaza_rung', 'then_gate').effects, 'q_bell_vault', 'water_drops'],
      [node('scene_hallows_cairn_inscription', 'ember').onEnter, 'q_bone_road', 'return'],
      [node('scene_hadda_bone_road_report', 'waystones').onEnter, 'q_bone_road', 'done'],
      [choice('scene_lantern_boat', 'bow_post', 'raise').effects, 'q_the_drowned_lantern', 'return'],
      [node('scene_wen_drowned_lantern_report', 'hands').onEnter, 'q_the_drowned_lantern', 'done'],
      [node('scene_high_mark_look_east', 'spent').onEnter, 'q_high_mark', 'seen'],
      [choice('scene_far_light_look_back', 'door', 'step').effects, 'q_the_still_shore', 'done'],
      [node('scene_far_light_look_back', 'six').onEnter, 'q_the_still_shore', 'done_looked'],
    ];
    for (const [effects, questId, stageId] of ends) expect([questId, stageId, effects.at(-1)]).toEqual([questId, stageId, { questAdvance: { quest: questId, stage: stageId } }]);
    for (const [questId, stageId] of [['q_bell_vault', 'water_drops'], ['q_bone_road', 'done'], ['q_lightless_stair', 'choir'], ['q_the_drowned_lantern', 'done'], ['q_high_mark', 'seen'], ['q_the_still_shore', 'done'], ['q_the_still_shore', 'done_looked']]) {
      expect([questId, stageId, stage(questId as string, stageId as string).outcome]).toEqual([questId, stageId, 'complete']);
    }
    // no quest opens a scene (the barrel's rule); the ambushes are the stages' fights
    for (const q of regionalQuests) expect([q.id, JSON.stringify(q.stages).includes('startDialogue')]).toEqual([q.id, false]);
    expect(stage('q_bone_road', 'first_cairn').onEnter).toEqual([{ startCombat: 'enc_bone_road_cairn_1' }]);
    expect(stage('q_bone_road', 'second_cairn').onEnter).toEqual([{ startCombat: 'enc_bone_road_cairn_2' }]);
  });

  test('the ambushes and the drowned: table encounters, the two cairn fights story gates that hold, the Vault’s drowned a fight to flee', () => {
    expect(RAW_ENCOUNTERS.map((e) => e.id)).toEqual(ENCOUNTER_IDS);
    for (const id of ENCOUNTER_IDS) expect([id, pack.encounters[id] !== undefined]).toEqual([id, true]);
    expect(need(pack.encounters['enc_bone_road_cairn_1'], 'c1')).toMatchObject({ groups: [{ creatureId: 'cr_wildling_brute', count: 2 }], fleeable: false, onFlee: 'hold', intro: AMBUSH_INTROS[0] });
    expect(need(pack.encounters['enc_bone_road_cairn_2'], 'c2')).toMatchObject({ groups: [{ creatureId: 'cr_void_touched_stalker', count: 2 }], fleeable: false, onFlee: 'hold', intro: AMBUSH_INTROS[1] });
    expect(need(pack.encounters['enc_bell_vault_archivists'], 'd')).toMatchObject({ groups: [{ creatureId: 'cr_drowned_archivist', count: 2 }], fleeable: true, intro: AMBUSH_INTROS[2] });
    expect(storyBlock('q_bell_vault')).toContain('Drowned Archivists stir');
    expect(node('scene_bell_vault_bells', 'wrong').onEnter).toEqual([{ startCombat: 'enc_bell_vault_archivists' }]);
  });

  test('the Bell Vault’s day in the dark: `passWatches` 4 on the ringing, not the limit (STORY; DESIGN §13.3)', () => {
    expect(storyBlock('q_bell_vault')).toContain('A day passes in the dark (time, not the limit: `passWatches` 4)');
    expect(DESIGN).toContain('the Bell Vault descent 4');
    for (const [nodeId, choiceId] of [['bells', 'fountain_order'], ['bells', 'known_order'], ['plaza_rung', 'then_gate']]) {
      expect([choiceId, has(choice('scene_bell_vault_bells', nodeId as string, choiceId as string).effects, { passWatches: 4 })]).toEqual([choiceId, true]);
    }
    const all = regionalScenes.flatMap((s) => s.nodes.flatMap((n) => [...n.onEnter, ...n.choices.flatMap((c) => c.effects)]));
    expect(all.filter((e) => 'clockWatches' in e)).toEqual([]);
    expect(all.filter((e) => 'passWatches' in e)).toHaveLength(3);
  });
});

// ---- The hooks in the regions ------------------------------------------------------------------------------------------------------

describe('the hooks in the regions (each a listed U57 edit): the events that open the places’ scenes or move the Shore’s quest, and the stair’s Blind', () => {
  test('each place scene is opened by its region’s event, an interact while the quest asks it (the discoveries until it is in the journal)', () => {
    for (const [sceneId, [locationId, eventId]] of Object.entries(PLACE_SCENES)) {
      const ev = event(locationId, eventId);
      expect([sceneId, scene(sceneId).npcId, ev.effects]).toEqual([sceneId, undefined, [{ startDialogue: sceneId }]]);
      // the event says the scene's first line, so the engine logs it once (U34e's `sceneSaysIt`)
      const first = scene(sceneId);
      expect([sceneId, ev.text]).toEqual([sceneId, first.nodes.find((n) => n.id === first.entry)?.text]);
    }
    const interacts = ['ev_stair_bell', 'ev_deep_bells', 'ev_hallows_ember_bowl', 'ev_hollow_curtain_stair', 'ev_shallows_lantern_boat', 'ev_plateau_stair', 'ev_stair_look_east'];
    for (const [, [locationId, eventId]] of Object.entries(PLACE_SCENES)) {
      const ev = event(locationId, eventId);
      if (interacts.includes(eventId)) expect([eventId, ev.trigger, ev.once, typeof ev.label]).toEqual([eventId, 'interact', false, 'string']);
      else expect([eventId, ev.trigger, ev.once]).toEqual([eventId, 'enter', true]);
    }
    expect(event('loc_drowned_stair', 'ev_stair_bell').when).toEqual({ all: [quest('q_bell_vault').availableWhen as Condition, { not: { quest: { id: 'q_bell_vault' } } }] });
    expect(event('loc_bell_wardens_deep', 'ev_deep_bells').when).toEqual({ quest: { id: 'q_bell_vault', stage: 'ring_bells' } });
    expect(event('loc_stormgate_cairns', 'ev_hallows_ember_bowl').when).toEqual({ quest: { id: 'q_bone_road', stage: 'read_inscription' } });
    expect(event('loc_voidscar_hollow', 'ev_hollow_curtain_stair').when).toEqual({ all: [{ loop: { min: 2 } }, { not: { quest: { id: 'q_lightless_stair' } } }] });
    expect(event('loc_sporelight_shallows', 'ev_shallows_lantern_boat').when).toEqual({ quest: { id: 'q_the_drowned_lantern', stage: 'raise_boat' } });
    expect(event('loc_sky_whisper_plateau', 'ev_plateau_stair').when).toEqual({ not: { quest: { id: 'q_high_mark' } } });
    expect(event('loc_windward_stair', 'ev_stair_look_east').when).toEqual({ quest: { id: 'q_high_mark', stage: 'look_east' } });
    expect(event('loc_far_light', 'ev_far_light_look_back').when).toEqual({ quest: { id: 'q_the_still_shore', stage: 'loom' } });
    // the Voidscar's curtain already opens for the quest in the journal (WORLD §11.3 `gate_veil_curtain`, U44)
    expect(JSON.stringify(loc('loc_voidscar_hollow').exits.find((e) => e.to === 'loc_veil_mouth')?.when)).toContain('"q_lightless_stair"');
    expect(storyBlock('q_lightless_stair')).toContain('Accepting it opens the curtain without Weavers Trusted.');
  });

  test('the Still Shore: the Shore starts the quest; the Gallery, the Loom and the Far Light each move it on arrival (the Threshold fires `enter` events, U34d)', () => {
    expect(event('loc_still_shore', 'ev_shore_between')).toMatchObject({ trigger: 'enter', once: true, effects: [{ questStart: 'q_the_still_shore' }] });
    expect(event('loc_gallery_of_loops', 'ev_gallery_first_loop')).toMatchObject({ when: { quest: { id: 'q_the_still_shore', stage: 'walk' } }, effects: [{ questAdvance: { quest: 'q_the_still_shore', stage: 'gallery' } }] });
    expect(event('loc_loom', 'ev_loom_one_thread')).toMatchObject({ when: { quest: { id: 'q_the_still_shore', stage: 'gallery' } }, effects: [{ questAdvance: { quest: 'q_the_still_shore', stage: 'loom' } }] });
    expect(storyBlock('q_the_still_shore')).toContain('2. The Gallery of Loops (see Loop 1 recorded). 3. The Loom (spend one Resonance). 4. The Far Light; before stepping through, look back at the water.');
    for (const [l, id] of [['loc_still_shore', 'ev_shore_between'], ['loc_gallery_of_loops', 'ev_gallery_first_loop'], ['loc_loom', 'ev_loom_one_thread'], ['loc_far_light', 'ev_far_light_look_back']]) {
      expect([id, WRITTEN.other.includes(event(l as string, id as string).text) || WRITTEN.nodes.includes(event(l as string, id as string).text)]).toEqual([id, true]);
    }
  });

  test('the Lightless Stair’s Blind: on the Veil Mouth and the Stair, at a fight’s opening, while the quest runs, unless Nyx is in the party or the Choir lights it', () => {
    expect(storyBlock('q_lightless_stair')).toContain('Descend without a light source (lanterns are extinguished; Blind applies; `Phase` or Nyx\'s signature negates)');
    for (const id of ['loc_veil_mouth', 'loc_stair_of_unmaking']) {
      const h = need(loc(id).hazards.find((x) => x.id === 'lightless'), `${id} lightless`);
      expect([id, h.on, h.status, h.when]).toEqual([
        id,
        'fight',
        { id: 'status_blind', duration: 1, to: 'player' },
        { all: [{ quest: { id: 'q_lightless_stair', status: 'active' } }, { not: { companion: { id: 'nyx' } } }, { not: { echo: 'echo_lightless_stair' } }] },
      ]);
      expect([id, WRITTEN.other.includes(h.text ?? '')]).toEqual([id, true]);
    }
  });
});

// ---- The scenes ------------------------------------------------------------------------------------------------------------------

describe('the scenes (the conventions of src/content/shared/dialogues/index.ts; STORY §10.7, §2.3, §11)', () => {
  test('the listed scenes, all registered; NPC scenes closed in the Horde and in a band; place scenes have no npcId', () => {
    expect(regionalScenes.map((s) => s.id)).toEqual(SCENE_IDS);
    const bands = Object.values(SCENE_PRIORITY) as number[];
    for (const s of regionalScenes) {
      if (s.id in PLACE_SCENES) {
        expect([s.id, s.npcId, s.when]).toEqual([s.id, undefined, undefined]);
        continue;
      }
      expect([s.id, bands.includes(s.priority), typeof s.npcId]).toEqual([s.id, true, 'string']);
      expect([s.id, JSON.stringify(s.when).startsWith(`{"all":[${JSON.stringify(NOT_IN_HORDE)}`)]).toEqual([s.id, true]);
    }
    const band = (id: string) => scene(id).priority;
    expect(SCENE_IDS.filter((id) => id.endsWith('_offer') || id === 'scene_dask_high_mark').map(band)).toEqual(Array(4).fill(SCENE_PRIORITY.offer));
    expect(SCENE_IDS.filter((id) => id.endsWith('_waiting')).map(band)).toEqual(Array(3).fill(SCENE_PRIORITY.waiting));
    expect(SCENE_IDS.filter((id) => id.endsWith('_report') || id === 'scene_borin_forge_mark').map(band)).toEqual(Array(3).fill(SCENE_PRIORITY.report));
    expect(SCENE_IDS.filter((id) => id.endsWith('_after')).map(band)).toEqual(Array(3).fill(SCENE_PRIORITY.after));
    expect([band('scene_wen_idle'), band('scene_ysmay_lightless_stair'), scene('scene_ysmay_lightless_stair').repeatable]).toEqual([SCENE_PRIORITY.idle, SCENE_PRIORITY.payoff, false]);
  });

  test('the offers: Dray’s at the Vault’s prerequisite (Loop 1 included); Hadda’s and Wen’s from Loop 2; Dask’s after his introduction and before his own quest', () => {
    expect(scene('scene_dray_bell_vault_offer').when).toEqual({ all: [NOT_IN_HORDE, quest('q_bell_vault').availableWhen as Condition, { not: { quest: { id: 'q_bell_vault' } } }] });
    expect(scene('scene_hadda_bone_road_offer').when).toEqual({ all: [NOT_IN_HORDE, FROM_LOOP_2, { not: { quest: { id: 'q_bone_road' } } }] });
    expect(scene('scene_wen_drowned_lantern_offer').when).toEqual({ all: [NOT_IN_HORDE, FROM_LOOP_2, { not: { quest: { id: 'q_the_drowned_lantern' } } }] });
    expect(scene('scene_dask_high_mark').when).toEqual({
      all: [NOT_IN_HORDE, FROM_LOOP_2, { location: 'loc_shimmering_pass' }, { flag: 'flag_scene_done_scene_dask_introduction' }, { not: { quest: { id: 'q_the_flickering_man' } } }, { not: { quest: { id: 'q_high_mark' } } }],
    });
    for (const [id, questId] of [['scene_dray_bell_vault_offer', 'q_bell_vault'], ['scene_hadda_bone_road_offer', 'q_bone_road'], ['scene_wen_drowned_lantern_offer', 'q_the_drowned_lantern'], ['scene_dask_high_mark', 'q_high_mark']] as const) {
      expect(choice(id, 'ask', 'yes').effects).toEqual([{ questStart: questId }]);
      expect(choice(id, 'ask', 'no').effects).toEqual([]);
    }
    // the discoveries start theirs too
    expect(choice('scene_bell_vault_discovery', 'ringing', 'follow').effects).toEqual([{ questStart: 'q_bell_vault' }]);
    expect(choice('scene_hollow_curtain_stair', 'figures', 'go_down').effects).toEqual([{ questStart: 'q_lightless_stair' }]);
    expect(choice('scene_plateau_stair', 'steps', 'climb').effects).toEqual([{ questStart: 'q_high_mark' }]);
    // Borin's mark, while the Road runs and the mark is not carried (WORLD §3.7)
    expect(scene('scene_borin_forge_mark').when).toEqual({ all: [NOT_IN_HORDE, { quest: { id: 'q_bone_road', status: 'active' } }, { not: { quest: { id: 'q_bone_road', stage: 'return' } } }, { not: { item: { id: 'item_borins_forge_mark' } } }] });
    expect(node('scene_borin_forge_mark', 'warm').onEnter).toEqual([{ giveItem: { item: 'item_borins_forge_mark' } }]);
    expect(read('docs/WORLD.md')).toContain('`item_borins_forge_mark` is handed over by Borin at the Emberforge when `q_bone_road` is accepted');
    expect(storyBlock('q_bone_road')).toContain('"to show the Cairn who sent you."');
    expect(node('scene_borin_forge_mark', 'mark').text).toContain('so the stone knows who sent you');
  });

  test('every node is tagged by its source: story text is STORY’s (the fourth verse, the figure, the two journals, the Loop 1 refusal); written text is the pinned list', () => {
    for (const s of regionalScenes) {
      for (const n of s.nodes) {
        const tag = n.tags[0];
        if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else expect([s.id, n.id, tag, WRITTEN.nodes.includes(n.text)]).toEqual([s.id, n.id, 'written', true]);
        // a variant appends to the line, and the whole is pinned
        for (const v of n.textVariants) expect([s.id, n.id, v.text.startsWith(`${n.text} `), WRITTEN.nodes.includes(v.text)]).toEqual([s.id, n.id, true, true]);
      }
    }
    const storyNodes = regionalScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'story').map((n) => [s.id, n.id]));
    expect(storyNodes).toEqual([
      ['scene_hallows_cairn_inscription', 'verse'],
      ['scene_hollow_curtain_stair', 'stair'],
      ['scene_wen_idle', 'come_back'],
      ['scene_plateau_stair', 'markers'],
      ['scene_far_light_look_back', 'figure'],
    ]);
    expect(node('scene_hallows_cairn_inscription', 'verse').text).toBe('Iron that does not wish, hold the heart.\nTake the weight and do not want it.\nWhat the hand would grasp, let the cradle only carry.');
    expect(STORY).toContain('**IV. The Cradle** (Durn Hallow)');
    expect(node('scene_far_light_look_back', 'figure').text).toBe('Far out on the water, a figure holds something up with both hands. It does not move.');
    expect(STORY_FLAT).toContain('4. Far out on the water, a figure holds something up with both hands. It does not move.');
    expect(node('scene_wen_idle', 'come_back').text).toBe("Come back when you've seen more.");
    expect(scene('scene_wen_idle').entry).toEqual([{ when: FROM_LOOP_2, node: 'later' }, { when: { all: [] }, node: 'come_back' }]);
    expect(STORY_FLAT).toContain('their givers say "Come back when you\'ve seen more."');
  });

  test('Echo lines are echoLocked: the fountain’s order (the Bells) and the bells known (the Vault); the moss line is greyed without Glow Moss', () => {
    const fountain = choice('scene_bell_vault_bells', 'bells', 'fountain_order');
    expect([fountain.echoHint, fountain.disabledWhen, fountain.when, fountain.tags]).toEqual(['echo_bells_of_silverwood', { not: { echo: 'echo_bells_of_silverwood' } }, FROM_LOOP_2, ['echo']]);
    expect(storyBlock('q_bell_vault')).toContain('the order is written on the Plaza fountain; `echo_bells_of_silverwood` knows it');
    const known = choice('scene_bell_vault_bells', 'bells', 'known_order');
    expect([known.echoHint, known.disabledWhen, known.when, known.tags]).toEqual(['echo_bell_vault', { not: { echo: 'echo_bell_vault' } }, FROM_LOOP_2, ['echo']]);
    expect(echoRow('echo_bell_vault')[4]).toContain('bells known');
    const raise = choice('scene_lantern_boat', 'bow_post', 'raise');
    expect([raise.disabledWhen, raise.disabledText, raise.effects[0]]).toEqual([{ not: { item: { id: 'item_glow_moss' } } }, '(You carry no Glow Moss)', { takeItem: { item: 'item_glow_moss' } }]);
    expect(storyBlock('q_the_drowned_lantern')).toContain('relight the Lantern of Lanternreed with Glow Moss');
  });

  test('the companions’ lines are reactions: Mireya at the boat and at Wen’s mat, Dask at the High Mark; Wen’s report sets the flag STORY names', () => {
    expect(scene('scene_lantern_boat').companionReactions.map((r) => [r.companionId, r.when])).toEqual([['mireya', { quest: { id: 'q_the_drowned_lantern', stage: 'return' } }]]);
    expect(scene('scene_wen_drowned_lantern_report').companionReactions.map((r) => r.companionId)).toEqual(['mireya']);
    expect(scene('scene_high_mark_look_east').companionReactions.map((r) => r.companionId)).toEqual(['dask']);
    expect(node('scene_wen_drowned_lantern_report', 'hands').onEnter[0]).toEqual({ setFlag: 'flag_lanternreed_trusts' });
    expect(storyBlock('q_the_drowned_lantern')).toContain('Glowfen folk Neutral→friendly (not a faction; flag `flag_lanternreed_trusts`)');
    // nothing here moves reputation or loyalty: STORY gives these quests no faction deltas beyond the Road's +10 (its rewards)
    const all = regionalScenes.flatMap((s) => s.nodes.flatMap((n) => [...n.onEnter, ...n.choices.flatMap((c) => c.effects)]));
    expect(all.filter((e) => 'rep' in e || 'loyalty' in e)).toEqual([]);
  });

  test('choice texts and the other written words are exactly the pinned lists (the lead checks them)', () => {
    const nodes = regionalScenes.flatMap((s) => s.nodes.flatMap((n) => [...(n.tags[0] === 'written' ? [n.text] : []), ...n.textVariants.map((v) => v.text)]));
    const choices = regionalScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.map((c) => c.text)));
    const journals = regionalQuests.flatMap((q) => q.stages.filter((st) => st.tags?.[0] === 'written').map((st) => st.journal));
    expect([...new Set(nodes)].sort()).toEqual([...WRITTEN.nodes].sort());
    expect([...new Set(choices)].sort()).toEqual([...WRITTEN.choices].sort());
    expect([...new Set(journals)].sort()).toEqual([...WRITTEN.journals].sort());
    const hooks = ['ev_shore_between', 'ev_gallery_first_loop', 'ev_loom_one_thread'].map((id) => event(id === 'ev_shore_between' ? 'loc_still_shore' : id === 'ev_gallery_first_loop' ? 'loc_gallery_of_loops' : 'loc_loom', id).text);
    const other = [
      ...regionalQuests.map((q) => q.description),
      ...AMBUSH_INTROS,
      ...regionalScenes.flatMap((s) => [...s.companionReactions.map((r) => r.text), ...s.nodes.flatMap((n) => n.choices.flatMap((c) => (c.disabledText === undefined ? [] : [c.disabledText])))]),
      ...hooks,
      need(loc('loc_stair_of_unmaking').hazards.find((h) => h.id === 'lightless')?.text, 'the Blind line'),
      ...['ev_stair_bell', 'ev_deep_bells', 'ev_hallows_ember_bowl', 'ev_hollow_curtain_stair', 'ev_shallows_lantern_boat', 'ev_plateau_stair', 'ev_stair_look_east'].map((id) => need(Object.values(pack.locations).flatMap((l) => l.events).find((e) => e.id === id)?.label, id)),
    ];
    expect([...new Set(other)].sort()).toEqual([...WRITTEN.other].sort());
    for (const t of [...WRITTEN.nodes, ...WRITTEN.choices, ...WRITTEN.journals, ...WRITTEN.other]) expect([t, words(t) <= 65]).toEqual([t, true]);
    // STORY §15.1's banned words stay out of the new text
    const banned = /\b(fabric of (reality|existence)|eldritch|unspeakable|unimaginable|nightmarish|epic|suddenly|very|literally|ancient|mysterious|ethereal)\b|!|You feel a sense of/i;
    for (const t of [...WRITTEN.nodes, ...WRITTEN.choices, ...WRITTEN.journals, ...WRITTEN.other]) expect([t, banned.test(t)]).toEqual([t, false]);
  });
});

/** Every word U57 wrote (the reply lists them). */
const WRITTEN = {
  nodes: [
    // Dray
    'There is a stair under the Archives that the water took in Year 0, and a bell under the stair that it did not. It rings on the hour. I have timed it; it runs four minutes slow, and has since 309.',
    "Silverwood hung three bells: Plaza, Gate, Archive. Ring them as the city rang them and the sluices will answer. Ashcombe's notes say the order is cut on the Plaza fountain. Will you go down?",
    'Take a lantern. Take two. And count the hours while you are under; the bell will not count them for you.',
    'Then it rings on. It has rung five hundred years without you.',
    'Plaza, Gate, Archive, if the fountain is to be believed. Ashcombe believed it. He never went down.',
    'The bell has stopped. I have the hour of it written down: the first silence under the Archives since Year 0.',
    // the flooded stair and the bells (narrator)
    'Under the ninth lamp the stair goes on down, and from under the water a bell speaks one low note. It is the hour. Something down there is keeping it.',
    'You count the lamps as you go. The bell does not ring twice.',
    'Three bells hang in the well under the water, each the size of a cart, and a rope runs up from each. Their lips are cut with names: PLAZA. GATE. ARCHIVE.',
    'The Plaza bell speaks, and the water takes the note and carries it along the walls. Two ropes left.',
    'Gate, then Archive. The third note goes down the well and something under the well opens. The water drops a hand, a step, a level, and does not come back. A day goes by in the dark while it falls.',
    'Gate, then Archive. The third note goes down the well and something under the well opens. The water drops a hand, a step, a level, and does not come back. A day goes by in the dark while it falls. In the well the Warden lifts the clapper and tolls the hour once, for the Warden of Waters, by her name.',
    'The note goes down the well and does not come back up the same.',
    // Hadda
    'The salt-wind comes off the Pan in three days, and the wagons go north before it or they do not go. The Bone Road runs past the cairns, and something has made the cairns its own.',
    'Ride ahead and clear them. A road is cleared by the one in front, not the twenty behind. Will you ride?',
    "The Orchard first, then the Cairns. And if Borin at the Emberforge knows your face, carry his mark: Hallow's stone has waited five hundred years for a hand it knows.",
    'Then walk behind the wagons with the goats.',
    "The Orchard, then the Cairns, then Hallow's stone. The wind does not wait for riders who talk.",
    "The road is clear? Then the wagons roll at dawn. Forty in silver, and a rider's cloak; the salt is in it already, and ash slides off it.",
    "The road is clear? Then the wagons roll at dawn. Forty in silver, and a rider's cloak; the salt is in it already, and ash slides off it. And Hallow's stone spoke to you. It has not spoken to us.",
    'And the waystones. Gate, Ridge, Reed: pass each on your left hand and the Steppe is one watch wide. The Nomads do not give that to strangers. You are not one.',
    'The wagons are north of the Pan. Ride the short road; you paid for it.',
    // Borin
    "Hadda's road? Speak plain, then: take this. My mark, struck over Hallow's. Show it to the Cairn, so the stone knows who sent you.",
    'The iron up there is still warm. The fire says so, and she was lit from it. Five hundred years she has wanted that bowl back; she will settle for word of it.',
    // Hallow's Cairn (narrator)
    "The ember-bowl on Hallow's Cairn is iron, and warm, and the hand's width of ash in it has not gone cold in five hundred years. Around the rim, cut deep, the fourth verse.",
    'Hallow carried the fire north and did not set it down. He set it here, in the bowl, and lay down beside it.',
    "Hallow carried the fire north and did not set it down. He set it here, in the bowl, and lay down beside it. Borin's mark is warm in your pack, and under it Hallow's own, struck when this iron was still wished for. The bowl knows the hand: the cradle was made of iron that was asked.",
    // the curtain (narrator)
    'The two figures in grey thread stand either side of the seam and do not look at you. One holds a lantern that is not lit. The other holds nothing, and holds it out.',
    'You put the light out. The seam parts for a thing that carries none, and on the other side the dark goes down in steps.',
    // Ysmay
    'You came down with nothing in your hand. I felt the thread go slack where you did not hold it. Whole, and in the dark; that is rarer than Trusted.',
    'The Choir will keep a light on the stair for you from now. It will not be a light you can see. Hold the thread anyway.',
    // Wen
    'The lantern-boat sank. The Reed Maze, second night of the rains. Without it the village cannot find the Pool at night, and the Pool is where the sick go.',
    'Raise it. Light it. Bring it back lit. Will you?',
    'Follow the pulses in the reeds, not the Mirelings; the Mirelings follow you. Take moss for the wick.',
    'No, then.',
    'The pulses. Not the Mirelings. Moss for the wick.',
    'Lit. Good.',
    'The boat goes out at dusk with the elders in it. Go where you like in the fen now; no one here will watch your hands again. Take the boots. Cork. You walk over the water, not through it.',
    'The boat is out. Go on.',
    'Nothing for you. The Pool is for the marked; go in, or go on.',
    // the boat (narrator)
    'Where the glow pulses stop, a bow-post stands out of the mud with a ring of lantern-glass still on it. Two Mirelings stand up in the shallows, lit from the throat down. They watch the glass. They do not come closer.',
    'The boat comes up by the bow-post with the mud running off it. The moss takes. The glass fills, and the pulses in the reeds answer it one after another, back toward Lanternreed. The Mirelings turn and follow the light.',
    // the stair in the wind and the High Mark (narrator)
    'On the southern lip the steps show when a gust crosses them, and not otherwise. Eleven of them, then cloud.',
    'You wait for the gust. The first step holds.',
    'East, past the Glowlands and the broken dome, the sky has an edge. It is a line, and it is not where it was when you started counting. It creeps.',
    'Thirty dawns from the Ruins, the Nomads say. From here you can watch them being spent.',
    // Dask
    "There's a stair above the Plateau, cut in the wind. I went up it in 430, before the. Before. From the top you can see the thing's edge, and you can see it move.",
    "Go up and look east from it. Then you'll know what I keep counting. Will you go?",
    "Step when the gust says. If the Talisman's on your neck it'll tell you; if it isn't, the Sentinel will, and not kindly.",
    "Later, then. It'll still be creeping. That's the one thing it does.",
    // the Far Light (narrator)
    'The light is a door, and the door is a morning. Behind you the water has not moved, and it is waiting to be looked at.',
    'What it holds is not one thing. It is a mass, and there are shapes in the mass, and you count six of them before the light takes your eyes.',
  ],
  choices: [
    'I will go down.',
    'Not now.',
    'Follow the ringing down.',
    'Ring them as the fountain says: Plaza, Gate, Archive.',
    'You have rung these before. Plaza, Gate, Archive.',
    'Ring the Plaza bell first.',
    'Ring the Gate bell first.',
    'Ring the Archive bell first.',
    'Leave them.',
    'Then the Gate.',
    'Then the Archive.',
    'I will ride.',
    'Put out your light and go down.',
    'Not yet.',
    'I will raise it.',
    'No.',
    'Haul the boat up and pack the wick with Glow Moss.',
    'Leave it in the mud.',
    'Climb when the wind says.',
    'I will go up.',
    'Later.',
    'Look back at the water.',
    'Step into the light.',
  ],
  journals: [
    "Three sunken bells hang in the Warden's well. Ring them in Silverwood's order; the Plaza fountain wrote it down.",
    'The water has dropped a level. The Cistern of Names and the Door of Pages are open, and the drowned are stirring.',
    'Brutes have come down off the Peaks and made a lair of the cairn in the Bone Orchard. Clear them.',
    'One cairn is left: the Stormgate Cairns north of Hearthring, where the road turns for the Pan. Something waits between the spikes.',
    'Stalkers from the Voidscar have found the Stormgate Cairns. Nothing from the Hollow may hold the road.',
    "The road is clear. Hallow's Cairn stands apart among the Stormgate Cairns; read the ember-bowl inscription.",
    'Tell Hadda at Hearthring that the Bone Road is clear. She will give you the waystones.',
    'The wagons roll before the salt-wind. You know the waystone order: the short road across the Steppe is yours.',
    'Halfway down you cannot see your feet. Keep one hand on the thread. The Choir is at the bottom.',
    'You came down the Lightless Stair with no light and are still whole. The Choir will keep it lit for you now.',
    'The boat is under the mud where the pulses stop. Raise it, and relight the Lantern of Lanternreed with Glow Moss.',
    'The lantern is lit. Tell Elder Wen the village can find the Pool at night again.',
    'The lantern-boat rides at Lanternreed again. The fen folk have stopped watching your hands.',
    'You are on the Windward Stair, the High Mark. Look east.',
    "You have seen the Breach's edge from the High Mark: a line in the sky, creeping. The stair knows your weight now.",
    'Loop 1 hangs in the Gallery, painted and numbered. Go on to the Loom and pull one thread taut.',
    'Spend one Resonance at the Loom if you have it. Then walk to the Far Light.',
    'Before you step through, look back at the water.',
    'You stepped into the light without looking back. The water is behind you, and it will be there next time.',
    'You looked back. Far out on the water a figure holds something up with both hands, and it does not move.',
  ],
  other: [
    // the quests' descriptions
    'Something rings on the hour under the flooded stair below the Archives.',
    'Hadda Ironvow asks you to ride ahead of her wagons and clear the cairns on the Bone Road.',
    'A stair goes down from the Hollow into the Veil, and nothing lit survives it.',
    "Elder Wen asks you to raise Lanternreed's lantern-boat from the Reed Maze and light it again.",
    'The markers above the Plateau point up a stair cut into the wind, to where the sky can be seen from its edge.',
    'Grey water, no horizon, a far light. You are between loops.',
    // the ambushes' and the drowned's intros
    'Two Brutes come out from behind the cairn, between the stone bison, ash on their shoulders. They have been living here.',
    'Between the spikes the ash tears open. Two shapes step out of it, eyes like cold stars, and the ash does not take their prints.',
    'The wrong bell. The water shudders, and along the rim of the well the drowned stand up, a finger on the line.',
    // the companions' reactions, the greyed line
    'Mireya: "Sit down. You are wet to the hip, and she will not say thank you twice."',
    'Mireya: "Keep it high. They follow the glass, not you; let them think it is theirs."',
    'Dask: "There. That\'s the. That\'s what I count. Thirty, give or take the bits I lose."',
    '(You carry no Glow Moss)',
    // the Threshold's hooks, the Blind line
    'The sand takes no print. Four places, and no hour to be late for in any of them.',
    'The first frame is the smallest. A library, a cold fire, a stranger with your face. Beneath it, a number of days, and a cause.',
    'One thread hangs slack where the others are taut. It is the one you have not pulled yet.',
    'You came down without a light, and the dark is in your eyes.',
    // the interact buttons
    'Listen for the bell',
    'Ring the sunken bells',
    'Read the ember-bowl inscription',
    'Go to the seam in the curtain',
    'Raise the lantern-boat',
    'Look up the stair in the wind',
    'Look east',
  ],
};

// ---- Played through the engine on the real pack ---------------------------------------------------------------------------------

describe('played on the real pack (makeState + play: the engine runs the scenes and the hooks)', () => {
  const profileAt = (loop: number, echoes: string[] = []) => freshProfile({ loopCounter: loop, echoes });
  const at = (overrides: StateOverrides, loop = 2, echoes: string[] = []) => {
    const profile = profileAt(loop, echoes);
    return { s: makeState({ ...overrides, loop }, { content: pack, profile }), profile };
  };
  const talk = (npcId: string): Action => ({ type: 'talk', npcId });
  const pick = (choiceId: string): Action => ({ type: 'choose', choiceId });
  const interact = (eventId: string): Action => ({ type: 'interact', eventId });
  const go: Action = { type: 'continue' };
  const nodesSeen = (events: readonly GameEvent[]): string[] => events.flatMap((e) => (e.t === 'dialogueNode' ? [e.nodeId] : []));
  const carries = (s: GameState, itemId: string): number => s.player.inventory.filter((i) => i.itemId === itemId).reduce((t, i) => t + i.qty, 0);
  const xpOf = (events: readonly GameEvent[]): number => events.reduce((t, e) => t + (e.t === 'xpGained' ? e.amount : 0), 0);
  const interactsAt = (s: GameState, profile: ReturnType<typeof profileAt>): string[] =>
    legalActions(s, pack, profile).flatMap((a) => (a.type === 'interact' ? [a.eventId] : []));

  test('Keeper Dray in Loop 1: "Come back" until the scroll is done, then the Vault’s offer; Yes starts it; the waiting line; the after line once it is done', () => {
    const early = at({ locationId: 'loc_shattered_library' }, 1);
    expect(nodesSeen(play(early.s, [talk('npc_ansel_dray')], { content: pack, profile: early.profile }).events)).toEqual(['come_back']);
    const { s, profile } = at({ locationId: 'loc_shattered_library', quests: { q_lost_scroll: { stage: 'to_ilyra', status: 'completed' } } }, 1);
    const opened = play(s, [talk('npc_ansel_dray'), go], { content: pack, profile });
    expect([opened.state.dialogue?.sceneId, nodesSeen(opened.events)]).toEqual(['scene_dray_bell_vault_offer', ['bell', 'ask']]);
    const started = play(opened.state, [pick('yes'), go], { content: pack, profile });
    expect(started.state.quests.q_bell_vault).toMatchObject({ status: 'active', stage: 'flooded_stair' });
    expect(nodesSeen(play(started.state, [talk('npc_ansel_dray')], { content: pack, profile }).events)).toEqual(['waiting']);
    const done = at({ locationId: 'loc_shattered_library', quests: { q_bell_vault: { stage: 'water_drops', status: 'completed' } } }, 1);
    expect(nodesSeen(play(done.s, [talk('npc_ansel_dray')], { content: pack, profile: done.profile }).events)).toEqual(['stopped']);
  });

  test('the flooded stair: the bell is an interact while the Vault is open and not in the journal; Follow starts it', () => {
    const closed = at({ locationId: 'loc_drowned_stair' }, 1);
    expect(interactsAt(closed.s, closed.profile)).toEqual([]);
    const open = at({ locationId: 'loc_drowned_stair', echoes: ['echo_archive_door'] });
    expect(interactsAt(open.s, open.profile)).toEqual(['ev_stair_bell']);
    const r = play(open.s, [interact('ev_stair_bell'), pick('follow'), go], { content: pack, profile: open.profile });
    expect([nodesSeen(r.events), r.state.quests.q_bell_vault?.stage, r.state.mode]).toEqual([['ringing', 'count'], 'flooded_stair', 'explore']);
    expect(interactsAt(r.state, open.profile)).toEqual([]);
  });

  test('the bells: a wrong bell wakes the drowned (the scene closes for the fight); Plaza, Gate, Archive drops the water: four watches, the key, the lantern, the Echoes, the XP', () => {
    const base = { locationId: 'loc_bell_wardens_deep', quests: { q_bell_vault: 'ring_bells' } } as const;
    const { s, profile } = at(base);
    expect(interactsAt(s, profile)).toEqual(['ev_deep_bells']);
    const wrong = play(s, [interact('ev_deep_bells'), pick('first_gate')], { content: pack, profile });
    expect([wrong.state.mode, wrong.state.combat?.encounterId, wrong.state.combat?.enemies.map((e) => e.refId)]).toEqual(['combat', 'enc_bell_vault_archivists', ['cr_drowned_archivist', 'cr_drowned_archivist']]);
    expect(wrong.state.quests.q_bell_vault?.stage).toBe('ring_bells');
    const one = at(base, 1);
    const views = choiceViews(play(one.s, [interact('ev_deep_bells')], { content: pack, profile: one.profile }).state, pack, one.profile);
    expect(views.map((v) => [v.id, v.enabled])).toEqual([['first_plaza', true], ['first_gate', true], ['first_archive', true], ['leave', true]]); // Loop 1: the Echo lines are hidden
    const ticks = s.clock.ticks;
    const right = play(s, [interact('ev_deep_bells'), pick('first_plaza'), pick('then_gate'), go], { content: pack, profile });
    expect([nodesSeen(right.events), right.state.mode]).toEqual([['bells', 'plaza_rung', 'rung'], 'explore']);
    expect(right.state.quests.q_bell_vault).toMatchObject({ status: 'completed', stage: 'water_drops' });
    expect([right.state.clock.ticks - ticks, right.state.clock.limitTicks - s.clock.limitTicks]).toEqual([4, 0]);
    expect([carries(right.state, 'item_bell_vault_key'), carries(right.state, 'item_glyphbound_lantern'), xpOf(right.events)]).toEqual([1, 1, 300]);
    for (const id of ['echo_bell_vault', 'echo_archive_door']) expect(right.state.echoesThisLoop).toContain(id);
  });

  test('the bells in Loop 2: the Echo lines show greyed, and open with the Echo held; with the Warden of Waters’ name the toll is told', () => {
    const plain = at({ locationId: 'loc_bell_wardens_deep', quests: { q_bell_vault: 'ring_bells' } });
    const views = choiceViews(play(plain.s, [interact('ev_deep_bells')], { content: pack, profile: plain.profile }).state, pack, plain.profile);
    expect(views.map((v) => [v.id, v.enabled])).toEqual([['fountain_order', false], ['known_order', false], ['first_plaza', true], ['first_gate', true], ['first_archive', true], ['leave', true]]);
    const known = at({ locationId: 'loc_bell_wardens_deep', quests: { q_bell_vault: 'ring_bells' } }, 2, ['echo_bells_of_silverwood', 'echo_rhune_choice']);
    const r = play(known.s, [interact('ev_deep_bells'), pick('fountain_order')], { content: pack, profile: known.profile });
    expect(r.state.quests.q_bell_vault).toMatchObject({ status: 'completed', stage: 'water_drops' });
    const said = r.events.find((e) => e.t === 'dialogueNode' && e.nodeId === 'rung');
    expect(said && 'text' in said ? said.text : '').toContain('for the Warden of Waters, by her name');
  });

  test('Hadda from Loop 2: the Road offered at any standing; Yes; the waiting line; Borin hands the mark over while it runs; the report pays the waystones, the cloak, the gold, Ironclad +10', () => {
    const { s, profile } = at({ locationId: 'loc_hearthring' });
    const opened = play(s, [talk('npc_hadda_ironvow'), go], { content: pack, profile });
    expect([opened.state.dialogue?.sceneId, nodesSeen(opened.events)]).toEqual(['scene_hadda_bone_road_offer', ['wind', 'ask']]);
    const started = play(opened.state, [pick('yes'), go], { content: pack, profile });
    expect(started.state.quests.q_bone_road).toMatchObject({ status: 'active', stage: 'ride_ahead' });
    expect(nodesSeen(play(started.state, [talk('npc_hadda_ironvow')], { content: pack, profile }).events)).toEqual(['waiting']);
    const forge = at({ locationId: 'loc_emberforge', quests: { q_bone_road: 'ride_ahead' } });
    const marked = play(forge.s, [talk('npc_borin_stonefist'), go, go], { content: pack, profile: forge.profile });
    expect([nodesSeen(marked.events), carries(marked.state, 'item_borins_forge_mark'), marked.state.mode]).toEqual([['mark', 'warm'], 1, 'explore']);
    expect(marked.state.quests.q_bone_road?.objectivesDone).toContain('obj_forge_mark'); // the optional objective
    expect(legalActions(marked.state, pack, forge.profile).some((a) => a.type === 'talk' && a.npcId === 'npc_borin_stonefist')).toBe(false); // the mark carried: nothing more to say
    const back = at({ locationId: 'loc_hearthring', quests: { q_bone_road: 'return' }, reputation: { ironclad: 5 }, gold: 0 });
    const paid = play(back.s, [talk('npc_hadda_ironvow'), go, go], { content: pack, profile: back.profile });
    expect([nodesSeen(paid.events), paid.state.quests.q_bone_road?.status, paid.state.quests.q_bone_road?.stage]).toEqual([['clear', 'waystones'], 'completed', 'done']);
    expect([paid.state.reputation.ironclad, paid.state.player.gold, carries(paid.state, 'item_salt_wind_cloak'), xpOf(paid.events)]).toEqual([15, 40, 1, 300]);
    expect(paid.state.echoesThisLoop).toContain('echo_steppe_waystones');
    expect(nodesSeen(play(paid.state, [talk('npc_hadda_ironvow')], { content: pack, profile: back.profile }).events)).toEqual(['east']);
  });

  test('Hallow’s Cairn: the inscription is an interact on the Road’s stage; verse IV and the ember; the iron only with the mark in the pack', () => {
    const plain = at({ locationId: 'loc_stormgate_cairns', quests: { q_bone_road: 'read_inscription' } });
    expect(interactsAt(plain.s, plain.profile)).toEqual(['ev_hallows_ember_bowl']);
    const read1 = play(plain.s, [interact('ev_hallows_ember_bowl'), go, go, go], { content: pack, profile: plain.profile });
    expect([nodesSeen(read1.events), read1.state.quests.q_bone_road?.stage]).toEqual([['bowl', 'verse', 'ember'], 'return']);
    for (const id of ['echo_litany_verse_4', 'echo_hallows_ember']) expect(read1.state.echoesThisLoop).toContain(id);
    expect(read1.state.echoesThisLoop).not.toContain('echo_iron_that_does_not_wish');
    const marked = at({ locationId: 'loc_stormgate_cairns', quests: { q_bone_road: 'read_inscription' }, items: ['item_borins_forge_mark'] });
    const read2 = play(marked.s, [interact('ev_hallows_ember_bowl'), go, go, go], { content: pack, profile: marked.profile });
    expect(read2.state.echoesThisLoop).toContain('echo_iron_that_does_not_wish');
    const said = read2.events.find((e) => e.t === 'dialogueNode' && e.nodeId === 'ember');
    expect(said && 'text' in said ? said.text : '').toContain("Borin's mark is warm in your pack");
  });

  test('the curtain: the seam is an interact from Loop 2 until the Stair is in the journal; going down starts it; the Mouth and the Stair Blind the lightless, not Nyx’s party', () => {
    const one = at({ locationId: 'loc_voidscar_hollow' }, 1);
    expect(interactsAt(one.s, one.profile)).toEqual([]);
    const { s, profile } = at({ locationId: 'loc_voidscar_hollow' });
    expect(interactsAt(s, profile)).toEqual(['ev_hollow_curtain_stair']);
    const down = play(s, [interact('ev_hollow_curtain_stair'), go, pick('go_down'), go], { content: pack, profile });
    expect([nodesSeen(down.events), down.state.quests.q_lightless_stair?.stage, down.state.mode]).toEqual([['stair', 'figures', 'dark'], 'descend', 'explore']);
    expect(legalActions(down.state, pack, profile).some((a) => a.type === 'move' && a.to === 'loc_veil_mouth')).toBe(true); // the curtain opens for the quest
    expect(interactsAt(down.state, profile)).toEqual([]);
    // the Blind hazard holds while the quest runs, not with Nyx beside you, not with the Choir's light
    const hazard = need(loc('loc_stair_of_unmaking').hazards.find((h) => h.id === 'lightless'), 'lightless');
    const holdsAt = (o: StateOverrides, echoes: string[] = []) => {
      const x = at(o, 2, echoes);
      return pack.locations['loc_stair_of_unmaking']?.hazards.includes(hazard) && (hazard.when === undefined ? true : (legalActions(x.s, pack, x.profile), evaluateHazard(x.s, x.profile)));
    };
    const evaluateHazard = (st: GameState, p: ReturnType<typeof profileAt>) => {
      const { evaluate } = require('@engine/conditions') as { evaluate: (c: Condition, s: GameState, p: unknown, c2: unknown) => boolean };
      return evaluate(hazard.when as Condition, st, p, pack);
    };
    expect(holdsAt({ locationId: 'loc_stair_of_unmaking', quests: { q_lightless_stair: 'halfway' } })).toBe(true);
    expect(holdsAt({ locationId: 'loc_stair_of_unmaking' })).toBe(false);
    expect(holdsAt({ locationId: 'loc_stair_of_unmaking', quests: { q_lightless_stair: 'halfway' } }, ['echo_lightless_stair'])).toBe(false);
    // reaching the Choir ends it with its Echo; Ysmay then speaks once
    const choir = at({ locationId: 'loc_stair_of_unmaking', quests: { q_lightless_stair: 'halfway' }, reputation: { weavers: 0 } });
    const arrived = play(choir.s, [{ type: 'move', to: 'loc_sanctum_of_threads' }], { content: pack, profile: choir.profile });
    expect(arrived.state.quests.q_lightless_stair).toMatchObject({ status: 'completed', stage: 'choir' });
    expect([arrived.state.echoesThisLoop.includes('echo_lightless_stair'), xpOf(arrived.events)]).toEqual([true, 250]);
    expect(arrived.state.mode).toBe('explore'); // the Sanctum: no fight
    const ysmay = play(arrived.state, [talk('npc_ysmay'), go, go], { content: pack, profile: choir.profile });
    expect([nodesSeen(ysmay.events), ysmay.state.mode, ysmay.state.flags.flag_scene_done_scene_ysmay_lightless_stair]).toEqual([['slack', 'lit'], 'explore', true]);
    expect(legalActions(ysmay.state, pack, choir.profile).some((a) => a.type === 'talk' && a.npcId === 'npc_ysmay')).toBe(false); // once a loop
  });

  test('Wen: "Come back" in Loop 1; the offer from Loop 2; the boat needs Glow Moss and takes one; the report sets the flag and pays the boots', () => {
    const one = at({ locationId: 'loc_breathing_pool' }, 1);
    expect(nodesSeen(play(one.s, [talk('npc_elder_wen')], { content: pack, profile: one.profile }).events)).toEqual(['come_back']);
    const { s, profile } = at({ locationId: 'loc_lanternreed' });
    const opened = play(s, [talk('npc_elder_wen'), go], { content: pack, profile });
    expect([opened.state.dialogue?.sceneId, nodesSeen(opened.events)]).toEqual(['scene_wen_drowned_lantern_offer', ['sank', 'ask']]);
    const started = play(opened.state, [pick('yes'), go], { content: pack, profile });
    expect(started.state.quests.q_the_drowned_lantern).toMatchObject({ status: 'active', stage: 'reed_maze' });
    const dry = at({ locationId: 'loc_sporelight_shallows', quests: { q_the_drowned_lantern: 'raise_boat' } });
    const noMoss = play(dry.s, [interact('ev_shallows_lantern_boat')], { content: pack, profile: dry.profile });
    expect(choiceViews(noMoss.state, pack, dry.profile).map((v) => [v.id, v.enabled, v.disabledText])).toEqual([['raise', false, '(You carry no Glow Moss)'], ['leave', true, undefined]]);
    const wet = at({ locationId: 'loc_sporelight_shallows', quests: { q_the_drowned_lantern: 'raise_boat' }, items: [{ itemId: 'item_glow_moss', qty: 2 }] });
    const raised = play(wet.s, [interact('ev_shallows_lantern_boat'), pick('raise'), go], { content: pack, profile: wet.profile });
    expect([nodesSeen(raised.events), raised.state.quests.q_the_drowned_lantern?.stage, carries(raised.state, 'item_glow_moss')]).toEqual([['bow_post', 'lit'], 'return', 1]);
    const back = at({ locationId: 'loc_breathing_pool', quests: { q_the_drowned_lantern: 'return' } });
    const paid = play(back.s, [talk('npc_elder_wen'), go, go], { content: pack, profile: back.profile });
    expect([nodesSeen(paid.events), paid.state.quests.q_the_drowned_lantern?.stage, paid.state.flags.flag_lanternreed_trusts, carries(paid.state, 'item_stiltwalkers_boots'), xpOf(paid.events)]).toEqual([['lit', 'hands'], 'done', true, 1, 250]);
    expect(nodesSeen(play(paid.state, [talk('npc_elder_wen')], { content: pack, profile: back.profile }).events)).toEqual(['out']);
  });

  test('the High Mark: the Plateau’s stair is an interact in Loop 1; the climb; "look east" at the Stair pays the cloak and the two Echoes', () => {
    const { s, profile } = at({ locationId: 'loc_sky_whisper_plateau' }, 1);
    expect(interactsAt(s, profile)).toEqual(['ev_plateau_stair']);
    const climbed = play(s, [interact('ev_plateau_stair'), go, pick('climb'), go], { content: pack, profile });
    expect([nodesSeen(climbed.events), climbed.state.quests.q_high_mark?.stage]).toEqual([['markers', 'steps', 'gust'], 'markers']);
    const up = at({ locationId: 'loc_windward_stair', quests: { q_high_mark: 'look_east' } }, 1);
    expect(interactsAt(up.s, up.profile)).toEqual(['ev_stair_look_east']);
    const seen = play(up.s, [interact('ev_stair_look_east'), go, go], { content: pack, profile: up.profile });
    expect([nodesSeen(seen.events), seen.state.quests.q_high_mark?.status, seen.state.quests.q_high_mark?.stage]).toEqual([['edge', 'spent'], 'completed', 'seen']);
    expect([carries(seen.state, 'item_sky_whisper_cloak'), xpOf(seen.events)]).toEqual([1, 250]);
    for (const id of ['echo_breach_clock', 'echo_high_mark']) expect(seen.state.echoesThisLoop).toContain(id);
  });

  test('the Still Shore at the Threshold: the Shore starts it, the Gallery and the Loom move it, the Far Light opens the look-back; looking back sees the six and pays 5 Resonance and the Echo', () => {
    const profile = profileAt(3);
    const s = makeState({ mode: 'threshold', loop: 3 }, { content: pack, profile });
    const shore = play(s, [{ type: 'thresholdGo', to: 'gallery' }, { type: 'thresholdGo', to: 'still_shore' }], { content: pack, profile });
    // the hook fires on the Shore's arrival event (the test state begins there with no arrival): the Gallery first, then the Shore starts it
    const started = play(shore.state, [{ type: 'thresholdGo', to: 'gallery' }], { content: pack, profile });
    expect(started.state.quests.q_the_still_shore).toMatchObject({ status: 'active', stage: 'gallery' });
    const loom = play(started.state, [{ type: 'thresholdGo', to: 'loom' }], { content: pack, profile });
    expect(loom.state.quests.q_the_still_shore?.stage).toBe('loom');
    const light = play(loom.state, [{ type: 'thresholdGo', to: 'far_light' }], { content: pack, profile });
    expect([light.state.mode, light.state.dialogue?.sceneId, light.state.quests.q_the_still_shore?.stage]).toEqual(['dialogue', 'scene_far_light_look_back', 'far_light']);
    const before = profile.resonance;
    expect(nodesSeen(light.events)).toEqual(['door']);
    const looked = play(light.state, [pick('look_back'), go, go], { content: pack, profile });
    expect([nodesSeen(looked.events), looked.state.mode]).toEqual([['figure', 'six'], 'threshold']);
    expect(looked.state.quests.q_the_still_shore).toMatchObject({ status: 'completed', stage: 'done_looked' });
    for (const id of ['echo_six_in_the_mass', 'echo_threshold']) expect(looked.state.echoesThisLoop).toContain(id);
    expect(looked.profile.resonance - before).toBe(5);
    for (const id of ['echo_six_in_the_mass', 'echo_threshold']) expect(looked.profile.echoes).toContain(id);
    // stepping through instead: the Echo, not the six
    const stepped = play(light.state, [pick('step')], { content: pack, profile });
    expect([stepped.state.quests.q_the_still_shore?.stage, stepped.state.echoesThisLoop.includes('echo_threshold'), stepped.state.echoesThisLoop.includes('echo_six_in_the_mass')]).toEqual(['done', true, false]);
    // the Far Light's "Step into the light" is then open again (the scene closed)
    expect(legalActions(stepped.state, pack, stepped.profile).some((a) => a.type === 'newLoop')).toBe(true);
  });
});
