// U59: the five class mini-quests and their scenes (src/content/shared/{quests,dialogues}/classes.ts), held to their sources read
// at test time: STORY (§11.8's blocks — giver, stage journals, choices, consequences, rewards, bots), DESIGN (§10.9: only while
// playing the class, only from Loop 2, the badge) and the two barrel headers' conventions (D-105). The class and loop gates are
// checked through the engine (`questStartProblem`: each quest is refused to the other four classes and in Loop 1), the hooks in
// the regions and in Brak's hub (each a listed edit) are pinned, then the scenes are played through the engine on the real pack
// (makeState + play): the ground read and the snare, the page by ley-light, the duel drawn or let pass, the gap and its waves,
// the seam and the line Nyx says to no one else.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { dialogues as RAW_SCENES } from '@content/shared/dialogues/classes';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { CLASS_FIGHT_INTROS, encounters as RAW_ENCOUNTERS, quests as RAW_QUESTS } from '@content/shared/quests/classes';
import { evaluate, legalActions, questStartProblem, type Action, type GameEvent, type GameState } from '@engine/index';
import type { Condition } from '@schema/condition';
import { ClassId } from '@schema/primitives';
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
const classScenes = RAW_SCENES.map((s) => scene(s.id));
const classQuests = RAW_QUESTS.map((q) => quest(q.id));

const CLASSES = ClassId.options;
const QUEST_IDS = ['q_class_ranger', 'q_class_wizard', 'q_class_elf', 'q_class_ironclad_warden', 'q_class_shadow_weaver'];
const SCENE_IDS = [
  'scene_kaelen_unmarked_trail_offer',
  'scene_kaelen_unmarked_trail_waiting',
  'scene_mistwood_read_ground',
  'scene_kaelen_unmarked_trail_report',
  'scene_kaelen_unmarked_trail_after',
  'scene_tamsin_seventh_page_offer',
  'scene_tamsin_seventh_page_waiting',
  'scene_plaza_ley_light',
  'scene_tamsin_seventh_page_after',
  'scene_archway_follow',
  'scene_plaza_last_duel',
  'scene_brak_wall_offer',
  'scene_brak_wall_waiting',
  'scene_camp_barricade_night',
  'scene_borin_wall_tempered',
  'scene_borin_wall_after',
  'scene_nyx_unlit_thread_offer',
  'scene_nyx_unlit_thread_waiting',
  'scene_hollow_unlit_thread',
  'scene_nyx_unlit_thread_report',
  'scene_nyx_unlit_thread_after',
];
/** The scenes a place opens (no `npcId`): the region's event that opens each (each a listed edit). */
const PLACE_SCENES: Record<string, [locationId: string, eventId: string]> = {
  scene_mistwood_read_ground: ['loc_mistwood_path', 'ev_mistwood_read_ground'],
  scene_plaza_ley_light: ['loc_silverwood_plaza', 'ev_plaza_ley_light'],
  scene_archway_follow: ['loc_crumbling_archway', 'ev_archway_follow'],
  scene_plaza_last_duel: ['loc_silverwood_plaza', 'ev_plaza_duelling_ground'],
  scene_camp_barricade_night: ['loc_ironclad_camp', 'ev_camp_barricade_gap'],
  scene_hollow_unlit_thread: ['loc_voidscar_hollow', 'ev_hollow_feel_seam'],
};

// ---- Reading STORY ---------------------------------------------------------------------------------------------------------------

const STORY_FLAT = STORY.replace(/\n\s*>?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ');
const inStory = (text: string): boolean => text.split('\n').every((line) => STORY_FLAT.includes(line));
const SECTION = STORY.slice(STORY.indexOf('### 11.8 Class mini-quests'), STORY.indexOf('## 12. Echo catalog'));
function storyBlock(questId: string): string {
  const start = SECTION.indexOf(`#### \`${questId}\``);
  if (start < 0) throw new Error(`no STORY §11.8 block for ${questId}`);
  const end = SECTION.indexOf('\n#### ', start + 10);
  return SECTION.slice(start, end < 0 ? undefined : end).replace(/\n\s*/g, ' ').replace(/\*/g, '');
}
const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const grantsOf = (effects: readonly Effect[]): string[] => effects.flatMap((e) => ('grantEcho' in e ? [e.grantEcho] : 'onlyIf' in e ? grantsOf(e.onlyIf.effects) : []));

// ---- The quests -----------------------------------------------------------------------------------------------------------------

describe('the five class mini-quests (STORY §11.8; DESIGN §10.9; D-008, D-069.7)', () => {
  test('one per class, in STORY’s order, STORY’s names and givers; each is its class’s (`classId`, `uniqueQuestId`) and Loop 2+; outside D-045’s 44', () => {
    expect(classQuests.map((q) => q.id)).toEqual(QUEST_IDS);
    expect(Object.values(pack.quests).filter((q) => q.category === 'class').map((q) => q.id)).toEqual(QUEST_IDS);
    expect(Object.values(pack.quests).filter((q) => q.category !== 'class').length).toBe(44);
    expect(SECTION).toContain('(5; outside the 44, D-008, C-15)');
    expect(DESIGN).toContain('are available only while playing that class, **only from Loop 2** (D-069.7');
    const names: Record<string, string> = {
      q_class_ranger: 'The Unmarked Trail',
      q_class_wizard: 'The Seventh Page',
      q_class_elf: 'Bladesong at the Archway',
      q_class_ironclad_warden: 'The Wall That Holds',
      q_class_shadow_weaver: 'The Unlit Thread',
    };
    const givers: Record<string, string | undefined> = {
      q_class_ranger: 'npc_kaelen_stonehand',
      q_class_wizard: 'npc_tamsin_reed',
      q_class_elf: undefined, // "discovery at the Crumbling Archway"
      q_class_ironclad_warden: 'npc_brak',
      q_class_shadow_weaver: 'npc_nyx',
    };
    for (const [i, id] of QUEST_IDS.entries()) {
      const q = quest(id);
      expect(SECTION).toContain(`#### \`${id}\` — ${names[id]}`);
      expect([id, q.name, q.giverNpcId, q.classId, q.availableWhen, q.startWhen]).toEqual([id, names[id], givers[id], CLASSES[i], FROM_LOOP_2, undefined]);
      expect([id, q.repeatablePerLoop, q.countsForApex]).toEqual([id, true, true]);
      expect(need(pack.classes[CLASSES[i] as string], CLASSES[i] as string).uniqueQuestId).toBe(id);
    }
    expect(storyBlock('q_class_ranger')).toContain('Giver: Kaelen, the Respite.');
    expect(storyBlock('q_class_wizard')).toContain('Giver: Scribe Tamsin Reed, the Plaza.');
    expect(storyBlock('q_class_elf')).toContain('Giver: discovery at the Crumbling Archway');
    expect(storyBlock('q_class_ironclad_warden')).toContain('Giver: Brak, Ironclad Camp.');
    expect(storyBlock('q_class_shadow_weaver')).toContain('Giver: Nyx, the Chasm.');
    // bots: X / C / M (P by standing still) / M, not pacifist / C
    expect(QUEST_IDS.map((id) => quest(id).botHint)).toEqual(['explorer', 'caster', 'melee', 'melee', 'caster']);
    expect(storyBlock('q_class_ironclad_warden')).toContain('Not pacifist.');
  });

  test('the engine refuses each quest to the other four classes and in Loop 1; its own class may start it from Loop 2 (DESIGN §10.9)', () => {
    for (const [i, id] of QUEST_IDS.entries()) {
      const own = CLASSES[i] as string;
      for (const classId of CLASSES) {
        const profile = freshProfile({ loopCounter: 2 });
        const s = makeState({ classId, loop: 2, locationId: 'loc_whispering_ruins' }, { content: pack, profile });
        const problem = questStartProblem(s, pack, profile, id);
        expect([id, classId, problem]).toEqual([id, classId, classId === own ? null : `${quest(id).name} is not for your class`]);
      }
      const loop1 = freshProfile();
      const s1 = makeState({ classId: own, loop: 1, locationId: 'loc_whispering_ruins' }, { content: pack, profile: loop1 });
      expect([id, questStartProblem(s1, pack, loop1, id)]).toEqual([id, `${quest(id).name} is not offered yet`]);
    }
  });

  test('the first stage’s journal is STORY’s stage 1 journal, verbatim (tag story); every other journal is written, pinned and ≤ 40 words', () => {
    for (const q of classQuests) {
      const first = q.stages[0] as Quest['stages'][number];
      expect([q.id, first.tags, inStory(first.journal)]).toEqual([q.id, ['story'], true]);
      expect(storyBlock(q.id)).toContain(`Journal: "${first.journal}"`);
      for (const st of q.stages.slice(1)) expect([q.id, st.id, st.tags, WRITTEN.journals.includes(st.journal)]).toEqual([q.id, st.id, ['written'], true]);
      for (const st of q.stages) expect([q.id, st.id, words(st.journal) <= 40]).toEqual([q.id, st.id, true]);
      expect([q.id, WRITTEN.other.includes(q.description)]).toEqual([q.id, true]);
    }
  });

  test('STORY’s rewards are items that exist; the consequences ride where STORY puts them (the ledger, Korr’s margins or Remnants +5, the mark, Ironclad +5, Weavers +5)', () => {
    const rewards: Record<string, string> = {
      q_class_ranger: 'item_harrier_bow',
      q_class_wizard: 'item_scriptorium_staff',
      q_class_elf: 'item_elven_bow',
      q_class_ironclad_warden: 'item_ironclad_hammer',
      q_class_shadow_weaver: 'item_chasmglass_focus',
    };
    const names: Record<string, string> = { item_harrier_bow: 'Harrier Bow', item_scriptorium_staff: 'Scriptorium Staff', item_elven_bow: 'Elven Bow', item_ironclad_hammer: 'Ironclad Hammer', item_chasmglass_focus: 'Chasmglass Focus' };
    for (const q of classQuests) {
      const itemId = rewards[q.id] as string;
      expect([q.id, q.rewards.items, q.rewards.xp, q.rewards.gold]).toEqual([q.id, [{ itemId, count: 1 }], 150, 0]);
      expect([q.id, pack.items[itemId]?.name]).toEqual([q.id, names[itemId]]);
      expect(storyBlock(q.id)).toContain(`Rewards. ${names[itemId]}.`);
    }
    // the Ranger: Kaelen's prices −5 % is the Echo (economy.ts ECHO_LEDGER), granted if not held
    expect(quest('q_class_ranger').rewards.echoes).toEqual(['echo_kaelen_ledger']);
    expect(storyBlock('q_class_ranger')).toContain("Consequences. Kaelen's prices −5% this loop; `echo_kaelen_ledger` if not held.");
    expect(read('src/engine/reducers/economy.ts')).toContain("echo_kaelen_ledger: { merchantId: 'npc_kaelen_stonehand', pct: 0.05 }");
    // the Wizard: copy (Corruption +1, the margins) or burn (Remnants +5), on the choice, the advance last
    expect(choice('scene_plaza_ley_light', 'choose', 'copy').effects).toEqual([{ corruption: 1 }, { grantEcho: 'echo_korr_marginalia' }, { questAdvance: { quest: 'q_class_wizard', stage: 'copied' } }]);
    expect(choice('scene_plaza_ley_light', 'choose', 'burn').effects).toEqual([{ rep: { faction: 'remnants', delta: 5 } }, { questAdvance: { quest: 'q_class_wizard', stage: 'burned' } }]);
    expect(storyBlock('q_class_wizard')).toContain('Copy it (Corruption +1; `echo_korr_marginalia`) or burn it (Remnants +5).');
    expect(quest('q_class_wizard').rewards.rep).toEqual([]);
    // the Elf: the first Wayfinder's mark, the codex entry, either way
    for (const id of ['won', 'passed']) expect([id, stage('q_class_elf', id).onEnter]).toEqual([id, [{ unlockCodex: 'codex_seven_wayfinders' }]]);
    expect(pack.codex.codex_seven_wayfinders).toBeDefined();
    expect(storyBlock('q_class_elf')).toContain("Consequences. The first Wayfinder's mark; `codex_seven_wayfinders` opens.");
    // the Warden: Ironclad +5
    expect(quest('q_class_ironclad_warden').rewards.rep).toEqual([{ faction: 'ironclad', delta: 5 }]);
    expect(storyBlock('q_class_ironclad_warden')).toContain('Consequences. Ironclad +5.');
    // the Weaver: Weavers +5 on the line, which only the clean return hears
    expect(node('scene_nyx_unlit_thread_report', 'one_of_us').onEnter).toEqual([{ rep: { faction: 'weavers', delta: 5 } }, { questAdvance: { quest: 'q_class_shadow_weaver', stage: 'one_of_us' } }]);
    expect(node('scene_nyx_unlit_thread_report', 'focus_cold').onEnter).toEqual([{ questAdvance: { quest: 'q_class_shadow_weaver', stage: 'remembered' } }]);
    expect(storyBlock('q_class_shadow_weaver')).toContain('Consequences. Weavers +5.');
    expect(quest('q_class_shadow_weaver').rewards.rep).toEqual([]);
    const granted = [...classQuests.flatMap((q) => q.rewards.echoes), ...classScenes.flatMap((s) => s.nodes.flatMap((n) => [...grantsOf(n.onEnter), ...n.choices.flatMap((c) => grantsOf(c.effects))]))];
    for (const id of granted) expect([id, pack.echoes[id] !== undefined]).toEqual([id, true]);
  });

  test('the stage graphs: STORY’s stages, the night and dusk gates, the three waves counted, a stage a scene ends waits; no quest opens a scene', () => {
    expect(quest('q_class_ranger').stages.map((s) => s.id)).toEqual(['read_ground', 'snare', 'bring_home', 'home']);
    expect(storyBlock('q_class_ranger')).toContain("2. Follow the Prowler's marks (Hunt); set a snare at the drag-line (Wildcraft). 3. Bring the runner home.");
    expect(stage('q_class_ranger', 'bring_home').objectives.map((o) => o.when)).toEqual([{ location: 'loc_wayfarers_respite' }]);
    expect(quest('q_class_wizard').stages.map((s) => s.id)).toEqual(['ley_light', 'read', 'copied', 'burned']);
    expect(stage('q_class_wizard', 'ley_light').objectives.map((o) => o.when)).toEqual([{ all: [{ location: 'loc_silverwood_plaza' }, { watch: 'night' }] }]);
    expect(quest('q_class_elf').stages.map((s) => s.id)).toEqual(['follow', 'duel', 'won', 'passed']);
    expect(stage('q_class_elf', 'follow').objectives.map((o) => o.when)).toEqual([{ all: [{ location: 'loc_silverwood_plaza' }, { watch: 'dusk' }] }]);
    expect(storyBlock('q_class_elf')).toContain('3. Win it without taking a hit (Bladesong), or stand still and let it pass (Shadowstep).');
    expect(quest('q_class_ironclad_warden').stages.map((s) => s.id)).toEqual(['be_a_wall', 'hold', 'dawn', 'tempered']);
    expect(stage('q_class_ironclad_warden', 'be_a_wall').objectives.map((o) => o.when)).toEqual([{ all: [{ location: 'loc_ironclad_camp' }, { watch: 'night' }] }]);
    expect(stage('q_class_ironclad_warden', 'hold').objectives.map((o) => o.when)).toEqual([
      { all: [{ killed: { id: 'cr_mistwood_prowler', count: 4, sinceStage: true } }, { killed: { id: 'cr_wildling_brute', count: 3, sinceStage: true } }] },
    ]);
    expect(storyBlock('q_class_ironclad_warden')).toContain('2. Hold the barricade for the night (three waves; Guard and Taunt count). 3. Borin tempers the shield at dawn.');
    expect(stage('q_class_ironclad_warden', 'dawn').objectives.map((o) => o.when)).toEqual([{ location: 'loc_emberforge' }]);
    expect(quest('q_class_shadow_weaver').stages.map((s) => s.id)).toEqual(['seam', 'hex', 'return', 'return_took', 'one_of_us', 'remembered']);
    expect(stage('q_class_shadow_weaver', 'seam').objectives.map((o) => o.when)).toEqual([{ all: [{ location: 'loc_voidscar_hollow' }, { watch: 'night' }] }]);
    expect(storyBlock('q_class_shadow_weaver')).toContain('2. Hex one Void-Touched Stalker so it turns on its pack (Hex); take nothing from the fight.');
    // the stages a scene ends: no required objective, a plain next
    for (const [questId, stageId] of [['q_class_ranger', 'read_ground'], ['q_class_ranger', 'snare'], ['q_class_wizard', 'read'], ['q_class_elf', 'duel'], ['q_class_shadow_weaver', 'hex']]) {
      const st = stage(questId as string, stageId as string);
      expect([questId, stageId, st.objectives.length, typeof st.next]).toEqual([questId, stageId, 0, 'string']);
    }
    const ends: [readonly Effect[], string, string][] = [
      [node('scene_mistwood_read_ground', 'marks').onEnter, 'q_class_ranger', 'snare'],
      [node('scene_mistwood_read_ground', 'taken').onEnter, 'q_class_ranger', 'bring_home'],
      [node('scene_kaelen_unmarked_trail_report', 'ledger').onEnter, 'q_class_ranger', 'home'],
      [node('scene_plaza_last_duel', 'still').onEnter, 'q_class_elf', 'passed'],
      [need(pack.encounters.enc_plaza_last_duel, 'the duel').onVictory, 'q_class_elf', 'won'],
      [node('scene_borin_wall_tempered', 'hammer').onEnter, 'q_class_ironclad_warden', 'tempered'],
      [choice('scene_hollow_unlit_thread', 'pack', 'leave').effects, 'q_class_shadow_weaver', 'return'],
      [choice('scene_hollow_unlit_thread', 'pack', 'take').effects, 'q_class_shadow_weaver', 'return_took'],
    ];
    for (const [effects, questId, stageId] of ends) expect([questId, stageId, effects.at(-1)]).toEqual([questId, stageId, { questAdvance: { quest: questId, stage: stageId } }]);
    for (const [questId, stageId] of [['q_class_ranger', 'home'], ['q_class_wizard', 'copied'], ['q_class_wizard', 'burned'], ['q_class_elf', 'won'], ['q_class_elf', 'passed'], ['q_class_ironclad_warden', 'tempered'], ['q_class_shadow_weaver', 'one_of_us'], ['q_class_shadow_weaver', 'remembered']]) {
      expect([questId, stageId, stage(questId as string, stageId as string).outcome]).toEqual([questId, stageId, 'complete']);
    }
    for (const q of classQuests) expect([q.id, JSON.stringify(q.stages).includes('startDialogue')]).toEqual([q.id, false]);
  });

  test('the fights: the duel is a story gate that holds; the Camp’s three waves chain by onVictory (the Day of Teeth’s form) and are what the hold counts', () => {
    expect(RAW_ENCOUNTERS.map((e) => e.id)).toEqual(['enc_plaza_last_duel', 'enc_camp_wall_wave_1', 'enc_camp_wall_wave_2', 'enc_camp_wall_wave_3']);
    for (const e of RAW_ENCOUNTERS) {
      const enc = need(pack.encounters[e.id], e.id);
      expect([e.id, enc.fleeable, enc.onFlee]).toEqual([e.id, false, 'hold']);
      expect([e.id, CLASS_FIGHT_INTROS.includes(enc.intro as (typeof CLASS_FIGHT_INTROS)[number]), words(enc.intro ?? '') <= 30]).toEqual([e.id, true, true]);
    }
    expect(need(pack.encounters.enc_plaza_last_duel, 'duel').groups).toEqual([{ creatureId: 'cr_shimmering_phantom', count: 1 }]);
    expect(need(pack.encounters.enc_camp_wall_wave_1, 'w1').onVictory).toEqual([{ startCombat: 'enc_camp_wall_wave_2' }]);
    expect(need(pack.encounters.enc_camp_wall_wave_2, 'w2').onVictory).toEqual([{ startCombat: 'enc_camp_wall_wave_3' }]);
    expect(need(pack.encounters.enc_camp_wall_wave_3, 'w3').onVictory).toEqual([]);
    const waves = ['enc_camp_wall_wave_1', 'enc_camp_wall_wave_2', 'enc_camp_wall_wave_3'].flatMap((id) => need(pack.encounters[id], id).groups);
    const count = (creatureId: string) => waves.filter((g) => g.creatureId === creatureId).reduce((n, g) => n + g.count, 0);
    expect([count('cr_mistwood_prowler'), count('cr_wildling_brute')]).toEqual([4, 3]);
    expect(choice('scene_camp_barricade_night', 'gap', 'take').effects).toEqual([{ startCombat: 'enc_camp_wall_wave_1' }]);
    expect(choice('scene_plaza_last_duel', 'phantom', 'draw').effects).toEqual([{ startCombat: 'enc_plaza_last_duel' }]);
  });

  test('INCOMPLETE_TABLES: with the five, every quest STORY names is authored — `quests` is off the list, and nothing pending pointed into it', () => {
    expect(INCOMPLETE_TABLES).not.toContain('quests');
    expect(Object.keys(pack.quests)).toHaveLength(49);
  });
});

// ---- The scenes -----------------------------------------------------------------------------------------------------------------

describe('the scenes (STORY §11.8; the barrel’s conventions; D-008 class lines)', () => {
  test('the twenty-one scenes are registered; every NPC scene is closed in the Horde and sits in its band; the place scenes have no npcId and an interact each', () => {
    expect(classScenes.map((s) => s.id)).toEqual(SCENE_IDS);
    for (const s of classScenes) {
      if (s.npcId === undefined) {
        expect([s.id, s.id in PLACE_SCENES]).toEqual([s.id, true]);
        const [locationId, eventId] = PLACE_SCENES[s.id] as [string, string];
        const ev = event(locationId, eventId);
        expect([s.id, ev.trigger, ev.once, JSON.stringify(ev.effects)]).toEqual([s.id, 'interact', false, JSON.stringify([{ startDialogue: s.id }])]);
      } else {
        expect([s.id, JSON.stringify(s.when).startsWith(JSON.stringify({ all: [NOT_IN_HORDE] }).slice(0, -2))]).toEqual([s.id, true]);
        expect([s.id, Object.values(SCENE_PRIORITY).includes(s.priority as never)]).toEqual([s.id, true]);
      }
    }
    // the offers: Loop 2+, the class, the quest not yet in the journal (D-008, D-069.7)
    const offers: [string, string, string][] = [
      ['scene_kaelen_unmarked_trail_offer', 'ranger', 'q_class_ranger'],
      ['scene_tamsin_seventh_page_offer', 'wizard', 'q_class_wizard'],
      ['scene_brak_wall_offer', 'ironclad_warden', 'q_class_ironclad_warden'],
      ['scene_nyx_unlit_thread_offer', 'shadow_weaver', 'q_class_shadow_weaver'],
    ];
    for (const [id, classId, questId] of offers) {
      expect([id, scene(id).priority]).toEqual([id, SCENE_PRIORITY.offer]);
      expect([id, JSON.stringify(scene(id).when).startsWith(JSON.stringify({ all: [NOT_IN_HORDE, FROM_LOOP_2, { class: classId }, { not: { quest: { id: questId } } }] }).slice(0, -2))]).toEqual([id, true]);
      expect([id, choice(id, 'ask', 'yes').effects]).toEqual([id, [{ questStart: questId }]]);
    }
    for (const id of ['scene_kaelen_unmarked_trail_report', 'scene_borin_wall_tempered', 'scene_nyx_unlit_thread_report']) expect([id, scene(id).priority]).toEqual([id, SCENE_PRIORITY.report]);
    for (const id of ['scene_kaelen_unmarked_trail_after', 'scene_tamsin_seventh_page_after', 'scene_borin_wall_after', 'scene_nyx_unlit_thread_after']) expect([id, scene(id).priority]).toEqual([id, SCENE_PRIORITY.after]);
    // the Elf's discovery: an Elf, from Loop 2, until the quest is in the journal
    expect(event('loc_crumbling_archway', 'ev_archway_follow').when).toEqual({ all: [{ loop: { min: 2 } }, { class: 'elf' }, { not: { quest: { id: 'q_class_elf' } } }] });
    expect(choice('scene_archway_follow', 'follow', 'follow').effects).toEqual([{ questStart: 'q_class_elf' }]);
    // the other interacts wait for their stage
    expect(event('loc_mistwood_path', 'ev_mistwood_read_ground').when).toEqual({ any: [{ quest: { id: 'q_class_ranger', stage: 'read_ground' } }, { quest: { id: 'q_class_ranger', stage: 'snare' } }] });
    expect(event('loc_silverwood_plaza', 'ev_plaza_ley_light').when).toEqual({ quest: { id: 'q_class_wizard', stage: 'read' } });
    expect(event('loc_silverwood_plaza', 'ev_plaza_duelling_ground').when).toEqual({ quest: { id: 'q_class_elf', stage: 'duel' } });
    expect(event('loc_ironclad_camp', 'ev_camp_barricade_gap').when).toEqual({ quest: { id: 'q_class_ironclad_warden', stage: 'hold' } });
    expect(event('loc_voidscar_hollow', 'ev_hollow_feel_seam').when).toEqual({ quest: { id: 'q_class_shadow_weaver', stage: 'hex' } });
    // Brak's hub chains to the Wall (the one edit to companions_u54.ts): the Warden's choice, Loop 2+, until the quest is in the journal
    const wall = choice('scene_brak_arc', 'hub', 'wall');
    expect([wall.when, wall.effects, wall.tags, wall.next]).toEqual([
      { all: [FROM_LOOP_2, { class: 'ironclad_warden' }, { not: { quest: { id: 'q_class_ironclad_warden' } } }] },
      [{ startDialogue: 'scene_brak_wall_offer' }],
      ['class'],
      'end',
    ]);
  });

  test('every node is tagged; the one story node is STORY’s line verbatim, in Nyx’s mouth; written nodes are the pinned ones; the class lines check the class (D-008)', () => {
    const written: string[] = [];
    for (const s of classScenes) {
      for (const n of s.nodes) {
        expect([s.id, n.id, n.tags.length]).toEqual([s.id, n.id, 1]);
        const tag = n.tags[0];
        if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else {
          expect([s.id, n.id, tag]).toEqual([s.id, n.id, 'written']);
          written.push(`${s.id}.${n.id}`);
        }
        expect([s.id, n.id, n.textVariants]).toEqual([s.id, n.id, []]);
      }
    }
    expect(written.sort()).toEqual([...WRITTEN.nodes].sort());
    expect(classScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'story').map((n) => `${s.id}.${n.id}`))).toEqual(['scene_nyx_unlit_thread_report.one_of_us']);
    expect(node('scene_nyx_unlit_thread_report', 'one_of_us')).toMatchObject({ speaker: 'npc_nyx', text: 'You could have been one of us. Of the nine, I mean.' });
    expect(storyBlock('q_class_shadow_weaver')).toContain('she says the thing she says to no one else: "You could have been one of us. Of the nine, I mean."');
    // the class-tagged lines each check their class
    const classLines = classScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.filter((c) => c.tags.includes('class')).map((c) => [s.id, c.id, c.when] as const)));
    expect(classLines).toEqual([
      ['scene_mistwood_read_ground', 'read_marks', { class: 'ranger' }],
      ['scene_mistwood_read_ground', 'snare', { class: 'ranger' }],
      ['scene_plaza_ley_light', 'copy', { class: 'wizard' }],
      ['scene_archway_follow', 'follow', { class: 'elf' }],
      ['scene_plaza_last_duel', 'draw', { class: 'elf' }],
      ['scene_plaza_last_duel', 'still', { class: 'elf' }],
      ['scene_camp_barricade_night', 'take', { class: 'ironclad_warden' }],
      ['scene_hollow_unlit_thread', 'hex', { class: 'shadow_weaver' }],
    ]);
    // choice texts, pinned
    const choices = classScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.map((c) => c.text)));
    expect([...new Set(choices)].sort()).toEqual([...WRITTEN.choices].sort());
  });

  test('written words are short and in voice: Kaelen weighs and prices; Tamsin’s Year 500; Brak counts and jokes once; Borin speaks plain; Nyx says "the void remembers" and never shouts', () => {
    expect(node('scene_kaelen_unmarked_trail_offer', 'runner').text).toContain('eleven gold');
    expect(node('scene_kaelen_unmarked_trail_report', 'weighed').text).toContain('the boy was heavier');
    expect(node('scene_tamsin_seventh_page_offer', 'page').text).toContain('Year 500');
    expect(node('scene_brak_wall_offer', 'ask').text).toContain('Three waves, if the scouts can count.');
    expect(node('scene_borin_wall_tempered', 'plate').text.startsWith('Speak plain.')).toBe(true);
    expect(node('scene_borin_wall_tempered', 'temper').text).toContain('quench');
    expect(node('scene_nyx_unlit_thread_offer', 'ask').text).toContain('the void remembers');
    for (const s of classScenes) {
      for (const n of s.nodes) {
        expect([s.id, n.id, words(n.text) <= 80]).toEqual([s.id, n.id, true]);
        if (n.speaker === 'npc_nyx') expect([s.id, n.id, n.text.includes('!')]).toEqual([s.id, n.id, false]);
        for (const banned of ['eldritch', 'unspeakable', 'suddenly', 'literally', 'nightmarish', 'mysterious', 'very']) {
          expect([s.id, n.id, banned, new RegExp(`\\b${banned}\\b`, 'i').test(n.text)]).toEqual([s.id, n.id, banned, false]);
        }
      }
    }
  });
});

// ---- Played on the real pack ---------------------------------------------------------------------------------------------------

describe('played on the real pack (makeState + play: the engine runs the scenes)', () => {
  type Ev = GameEvent;
  const at = (o: StateOverrides, loop = 2, echoes: string[] = []) => {
    const profile = freshProfile({ loopCounter: loop, echoes });
    return { s: makeState({ loop, level: 12, ...o }, { content: pack, profile }), profile };
  };
  const talk = (npcId: string): Action => ({ type: 'talk', npcId });
  const pick = (choiceId: string): Action => ({ type: 'choose', choiceId });
  const interact = (eventId: string): Action => ({ type: 'interact', eventId });
  const go: Action = { type: 'continue' };
  const nodesSeen = (events: readonly Ev[]): string[] => events.flatMap((e) => (e.t === 'dialogueNode' ? [e.nodeId] : []));
  const legalIds = (s: GameState, profile: ReturnType<typeof freshProfile>) => legalActions(s, pack, profile).flatMap((a) => (a.type === 'choose' ? [a.choiceId] : []));
  /** The entry node Nyx's after-scene would open at (its entry rules, by stage). */
  const afterEntry = (s: GameState, profile: ReturnType<typeof freshProfile>): string | undefined => {
    const entry = scene('scene_nyx_unlit_thread_after').entry;
    return typeof entry === 'string' ? entry : entry.find((e) => evaluate(e.when, s, profile, pack))?.node;
  };

  test('the Ranger: Kaelen’s ask from Loop 2 (a Wizard is not asked); the ground read at the Path, the snare takes a watch, the runner home pays the ledger and the bow', () => {
    const { s, profile } = at({ classId: 'ranger', locationId: 'loc_wayfarers_respite' });
    const asked = play(s, [talk('npc_kaelen_stonehand'), go, pick('yes'), go], { content: pack, profile });
    expect(nodesSeen(asked.events)).toEqual(['runner', 'ask', 'agree']);
    expect(asked.state.quests.q_class_ranger).toMatchObject({ status: 'active', stage: 'read_ground' });
    const wizard = at({ classId: 'wizard', locationId: 'loc_wayfarers_respite' });
    expect(play(wizard.s, [talk('npc_kaelen_stonehand')], { content: pack, profile: wizard.profile }).state.dialogue?.sceneId).not.toBe('scene_kaelen_unmarked_trail_offer');
    const path = at({ classId: 'ranger', locationId: 'loc_mistwood_path', quests: { q_class_ranger: 'read_ground' }, day: 2, watch: 1 });
    expect(legalActions(path.s, pack, path.profile)).toContainEqual(interact('ev_mistwood_read_ground'));
    const read = play(path.s, [interact('ev_mistwood_read_ground'), pick('read_marks'), go], { content: pack, profile: path.profile });
    expect(nodesSeen(read.events)).toEqual(['ground', 'marks', 'line']);
    expect(read.state.quests.q_class_ranger).toMatchObject({ stage: 'snare' });
    const snared = play(read.state, [pick('snare'), go, go], { content: pack, profile: path.profile });
    expect(snared.state.clock.ticks - path.s.clock.ticks).toBe(1);
    expect(snared.state.quests.q_class_ranger).toMatchObject({ status: 'active', stage: 'bring_home' });
    // leaving the scene at the drag-line: the interact comes back at the snare stage, at the line
    const left = play(read.state, [pick('leave')], { content: pack, profile: path.profile });
    expect(nodesSeen(play(left.state, [interact('ev_mistwood_read_ground')], { content: pack, profile: path.profile }).events)).toEqual(['line']);
    const home = at({ classId: 'ranger', locationId: 'loc_wayfarers_respite', quests: { q_class_ranger: 'bring_home' }, flags: { flag_scene_done_scene_kaelen_deja_vu: true } }); // his déjà vu already said (it outranks the after band)
    const paid = play(home.s, [talk('npc_kaelen_stonehand'), go, go], { content: pack, profile: home.profile });
    expect(nodesSeen(paid.events)).toEqual(['weighed', 'ledger']);
    expect(paid.state.quests.q_class_ranger).toMatchObject({ status: 'completed', stage: 'home' });
    expect(paid.state.echoesThisLoop).toContain('echo_kaelen_ledger');
    expect(paid.state.player.inventory.some((i) => i.itemId === 'item_harrier_bow')).toBe(true);
    expect(nodesSeen(play(paid.state, [talk('npc_kaelen_stonehand')], { content: pack, profile: home.profile }).events)).toEqual(['mending']);
  });

  test('the Wizard: the fountain at night opens the reading; Korr’s hand copied costs Corruption and pays the margins, or burned pays the Remnants; Tamsin’s after-lines', () => {
    const { s, profile } = at({ classId: 'wizard', locationId: 'loc_silverwood_plaza' });
    const asked = play(s, [talk('npc_tamsin_reed'), go, pick('yes'), go], { content: pack, profile });
    expect(asked.state.quests.q_class_wizard).toMatchObject({ status: 'active', stage: 'ley_light' });
    expect(legalActions(asked.state, pack, profile)).not.toContainEqual(interact('ev_plaza_ley_light')); // not night
    const night = at({ classId: 'wizard', locationId: 'loc_silverwood_plaza', quests: { q_class_wizard: 'ley_light' }, day: 2, watch: 3 });
    const there = play(night.s, [{ type: 'examine', target: { kind: 'location' } }], { content: pack, profile: night.profile });
    expect(there.state.quests.q_class_wizard).toMatchObject({ stage: 'read' });
    expect(legalActions(there.state, pack, night.profile)).toContainEqual(interact('ev_plaza_ley_light'));
    const opened = play(there.state, [interact('ev_plaza_ley_light'), go, go], { content: pack, profile: night.profile });
    expect(legalIds(opened.state, night.profile).sort()).toEqual(['burn', 'copy']);
    const copied = play(opened.state, [pick('copy'), go], { content: pack, profile: night.profile });
    expect(copied.state.quests.q_class_wizard).toMatchObject({ status: 'completed', stage: 'copied' });
    expect([copied.state.player.corruption - there.state.player.corruption, copied.state.echoesThisLoop.includes('echo_korr_marginalia')]).toEqual([1, true]);
    expect(copied.state.player.inventory.some((i) => i.itemId === 'item_scriptorium_staff')).toBe(true);
    expect(nodesSeen(play(copied.state, [talk('npc_tamsin_reed')], { content: pack, profile: night.profile }).events)).toEqual(['dry']);
    const burned = play(opened.state, [pick('burn'), go], { content: pack, profile: night.profile });
    expect(burned.state.quests.q_class_wizard).toMatchObject({ status: 'completed', stage: 'burned' });
    expect(burned.state.reputation.remnants - there.state.reputation.remnants).toBe(5);
    expect(burned.state.player.corruption).toBe(there.state.player.corruption);
    expect(nodesSeen(play(burned.state, [talk('npc_tamsin_reed')], { content: pack, profile: night.profile }).events)).toEqual(['ash']);
  });

  test('the Elf: the Archway’s whisper (an Elf only) starts it; the Plaza at dusk opens the duelling-ground; standing still passes and cuts the mark, drawing starts the duel whose victory wins', () => {
    const { s, profile } = at({ classId: 'elf', locationId: 'loc_crumbling_archway' });
    expect(legalActions(s, pack, profile)).toContainEqual(interact('ev_archway_follow'));
    const ranger = at({ classId: 'ranger', locationId: 'loc_crumbling_archway' });
    expect(legalActions(ranger.s, pack, ranger.profile)).not.toContainEqual(interact('ev_archway_follow'));
    const followed = play(s, [interact('ev_archway_follow'), pick('follow'), go], { content: pack, profile });
    expect(followed.state.quests.q_class_elf).toMatchObject({ status: 'active', stage: 'follow' });
    const dusk = at({ classId: 'elf', locationId: 'loc_silverwood_plaza', quests: { q_class_elf: 'follow' }, day: 2, watch: 2 });
    const there = play(dusk.s, [{ type: 'examine', target: { kind: 'location' } }], { content: pack, profile: dusk.profile });
    expect(there.state.quests.q_class_elf).toMatchObject({ stage: 'duel' });
    const down = play(there.state, [interact('ev_plaza_duelling_ground'), go], { content: pack, profile: dusk.profile });
    expect(legalIds(down.state, dusk.profile).sort()).toEqual(['back', 'draw', 'still']);
    const still = play(down.state, [pick('still'), go, go], { content: pack, profile: dusk.profile });
    expect(nodesSeen(still.events)).toEqual(['still', 'mark']);
    expect(still.state.quests.q_class_elf).toMatchObject({ status: 'completed', stage: 'passed' });
    expect(still.profile.codexUnlocked).toContain('codex_seven_wayfinders');
    expect(still.state.player.inventory.some((i) => i.itemId === 'item_elven_bow')).toBe(true);
    const drawn = play(down.state, [pick('draw')], { content: pack, profile: dusk.profile });
    expect([drawn.state.mode, drawn.state.combat?.encounterId]).toEqual(['combat', 'enc_plaza_last_duel']);
    expect(drawn.state.quests.q_class_elf).toMatchObject({ status: 'active', stage: 'duel' });
  });

  test('the Warden: the Peaks offer first, then the hub’s "About the barricade." chains to the Wall; the gap at night starts wave 1 of three; Borin tempers and pays', () => {
    const { s, profile } = at({ classId: 'ironclad_warden', locationId: 'loc_ironclad_camp' });
    const peaks = play(s, [talk('npc_brak'), go, pick('yes')], { content: pack, profile });
    expect(peaks.state.quests.q_clear_path).toMatchObject({ status: 'active' });
    const hub = play(peaks.state, [talk('npc_brak')], { content: pack, profile });
    expect([hub.state.dialogue?.sceneId, legalIds(hub.state, profile).includes('wall')]).toEqual(['scene_brak_arc', true]);
    const asked = play(hub.state, [pick('wall'), go, pick('yes'), go], { content: pack, profile });
    expect(nodesSeen(asked.events)).toEqual(['pack', 'ask', 'agree']);
    expect(asked.state.quests.q_class_ironclad_warden).toMatchObject({ status: 'active', stage: 'be_a_wall' });
    // a Ranger's hub has no such line
    const ranger = play(at({ classId: 'ranger', locationId: 'loc_ironclad_camp', quests: { q_clear_path: 'hunt' } }).s, [talk('npc_brak')], { content: pack, profile: freshProfile({ loopCounter: 2 }) });
    expect(legalIds(ranger.state, freshProfile({ loopCounter: 2 }))).not.toContain('wall');
    const night = at({ classId: 'ironclad_warden', locationId: 'loc_ironclad_camp', quests: { q_class_ironclad_warden: 'be_a_wall' }, day: 2, watch: 3 });
    const there = play(night.s, [{ type: 'examine', target: { kind: 'location' } }], { content: pack, profile: night.profile });
    expect(there.state.quests.q_class_ironclad_warden).toMatchObject({ stage: 'hold' });
    const wave = play(there.state, [interact('ev_camp_barricade_gap'), pick('take')], { content: pack, profile: night.profile });
    expect([wave.state.mode, wave.state.combat?.encounterId]).toEqual(['combat', 'enc_camp_wall_wave_1']);
    const dawn = at({ classId: 'ironclad_warden', locationId: 'loc_emberforge', quests: { q_class_ironclad_warden: 'dawn' } });
    const tempered = play(dawn.s, [talk('npc_borin_stonefist'), go, go, go], { content: pack, profile: dawn.profile });
    expect(nodesSeen(tempered.events)).toEqual(['plate', 'temper', 'hammer']);
    expect(tempered.state.quests.q_class_ironclad_warden).toMatchObject({ status: 'completed', stage: 'tempered' });
    expect(tempered.state.reputation.ironclad - dawn.s.reputation.ironclad).toBe(5);
    expect(tempered.state.player.inventory.some((i) => i.itemId === 'item_ironclad_hammer')).toBe(true);
    expect(nodesSeen(play(tempered.state, [talk('npc_borin_stonefist')], { content: pack, profile: dawn.profile }).events)).toEqual(['holding']);
  });

  test('the Weaver: Nyx asks once the shards are in the journal; the seam at night, the hex, the Shard left (Weavers +5, the line) or taken (no line, no +5)', () => {
    const { s, profile } = at({ classId: 'shadow_weaver', locationId: 'loc_chasm_of_whispers', quests: { q_void_shards: 'gather' }, flags: { flag_scene_done_scene_nyx_deja_vu: true } });
    const asked = play(s, [talk('npc_nyx'), go, pick('yes'), go], { content: pack, profile });
    expect(nodesSeen(asked.events)).toEqual(['hand', 'ask', 'agree']);
    expect(asked.state.quests.q_class_shadow_weaver).toMatchObject({ status: 'active', stage: 'seam' });
    const night = at({ classId: 'shadow_weaver', locationId: 'loc_voidscar_hollow', quests: { q_class_shadow_weaver: 'seam' }, day: 2, watch: 3 });
    const there = play(night.s, [{ type: 'examine', target: { kind: 'location' } }], { content: pack, profile: night.profile });
    expect(there.state.quests.q_class_shadow_weaver).toMatchObject({ stage: 'hex' });
    const hexed = play(there.state, [interact('ev_hollow_feel_seam'), go, pick('hex'), go], { content: pack, profile: night.profile });
    expect(nodesSeen(hexed.events)).toEqual(['seam', 'stalker', 'turns', 'pack']);
    expect(hexed.state.counters.kills.cr_void_touched_stalker ?? 0).toBe(0); // pacifist: the pack kills itself
    const left = play(hexed.state, [pick('leave'), go], { content: pack, profile: night.profile });
    expect([left.state.quests.q_class_shadow_weaver?.stage, left.state.player.inventory.some((i) => i.itemId === 'item_void_shard')]).toEqual(['return', false]);
    const took = play(hexed.state, [pick('take'), go], { content: pack, profile: night.profile });
    expect([took.state.quests.q_class_shadow_weaver?.stage, took.state.player.inventory.some((i) => i.itemId === 'item_void_shard')]).toEqual(['return_took', true]);
    // the lip: the line she says to no one else, and the lens; or the thief's
    const clean = at({ classId: 'shadow_weaver', locationId: 'loc_chasm_of_whispers', quests: { q_class_shadow_weaver: 'return' }, flags: { flag_scene_done_scene_nyx_deja_vu: true } });
    const said = play(clean.s, [talk('npc_nyx'), go, go, go], { content: pack, profile: clean.profile });
    expect(nodesSeen(said.events)).toEqual(['knows', 'one_of_us', 'focus']);
    expect(said.state.quests.q_class_shadow_weaver).toMatchObject({ status: 'completed', stage: 'one_of_us' });
    expect(said.state.reputation.weavers - clean.s.reputation.weavers).toBe(5);
    expect(said.state.player.inventory.some((i) => i.itemId === 'item_chasmglass_focus')).toBe(true);
    // her after-line waits behind the legacy shard offer (the offer band) in this state: its own `when` holds, at its entry
    expect([evaluate(scene('scene_nyx_unlit_thread_after').when as Condition, said.state, clean.profile, pack), afterEntry(said.state, clean.profile)]).toEqual([true, 'once']);
    const thief = at({ classId: 'shadow_weaver', locationId: 'loc_chasm_of_whispers', quests: { q_class_shadow_weaver: 'return_took' }, flags: { flag_scene_done_scene_nyx_deja_vu: true } });
    const unsaid = play(thief.s, [talk('npc_nyx'), go, go], { content: pack, profile: thief.profile });
    expect(nodesSeen(unsaid.events)).toEqual(['thief', 'focus_cold']);
    expect(unsaid.state.quests.q_class_shadow_weaver).toMatchObject({ status: 'completed', stage: 'remembered' });
    expect(unsaid.state.reputation.weavers).toBe(thief.s.reputation.weavers);
    expect(unsaid.state.player.inventory.some((i) => i.itemId === 'item_chasmglass_focus')).toBe(true);
    expect([evaluate(scene('scene_nyx_unlit_thread_after').when as Condition, unsaid.state, thief.profile, pack), afterEntry(unsaid.state, thief.profile)]).toEqual([true, 'sleeves']);
  });
});

// ---- Pinned written words (listed in the U59 reply) ------------------------------------------------------------------------------

const WRITTEN = {
  journals: [
    "A Prowler's marks, and a drag-line going off the trail into the bark-glow. Set a snare where the line runs, and wait for it.",
    'The runner is alive under the roots, salt and all, and the Prowler is in your snare. Bring him home to the Respite.',
    'Kaelen has the runner back and has put him in the ledger. His prices have come down a twentieth for you.',
    "The fountain's ley-light is up. Hold the page over the water and read what the ink does under it.",
    "Maelis Korr's hand, the seventh page of a book bound with six. You copied it. The copy is in your head now, and so is he.",
    "Maelis Korr's hand. You burned it on the fountain's rim and gave Tamsin the ash. The Remnants will not read it, and neither will anyone else.",
    "At dusk the whisper went down under the Plaza, where the fountains' old stone is. A duelling-ground is buried there, and something is still fighting on it.",
    "Sael Orrin's last duel is over, five hundred years late, and you ended it. His mark is cut in the floor where he stood. Seven stood after him.",
    "You stood still, and the Phantom struck where you were, five hundred years ago. Sael Orrin's mark is cut in the floor where he stood. Seven stood after him.",
    'Night at the Camp. Take the gap in the barricade when the pack comes, and hold it. Three waves; Guard and Taunt count. Nothing goes past you.',
    'The gap held. Take the plate you held it with to Borin at the Emberforge; he tempers at dawn.',
    'Borin tempered the plate while the fire was at its morning heat, and put a hammer in your hand. The Camp has a wall, and it has your name.',
    "The seam is at the Hollow's far edge, under the curtain. A Stalker will come to your hand. Hex it so it turns on its pack. Take nothing from the fight.",
    'The pack tore itself apart in the scree, and you took nothing. Go back to the Chasm and tell Nyx what the void did.',
    'The pack tore itself apart in the scree. You took a Shard from it. Go back to the Chasm; Nyx will know.',
    'She said it to you and to no one else: you could have been one of the nine. The void remembers your hand now.',
    'You took from the fight. She did not say the thing she says to no one else, and she will not. The void remembers your hand, and what it held.',
  ],
  other: [
    'Kaelen asks you to read the Mistwood Path for his salt-runner, who went out at dawn and did not come back.',
    'Scribe Tamsin has a page no Remnant can read, and wants it read by ley-light at the fountain, at night.',
    'The whisper under the Crumbling Archway says follow, and it says it to Silverwood blood.',
    "Brak wants a wall in the barricade's gap tonight, when the Wildling pack comes.",
    "Nyx wants to see whether the void knows your hand: feel for the seam at the Hollow's edge at night.",
  ],
  choices: [
    'I will read the ground.',
    'Not now.',
    'Read the marks. (Hunt)',
    'Not yet.',
    'Set a snare across the drag-line. (Wildcraft)',
    'I will read it by ley-light.',
    'Copy it into your own book.',
    'Burn it on the rim.',
    'Follow it. (Silverwood blood)',
    'Draw, and sing it. (Bladesong)',
    'Stand still, and let it pass. (Shadowstep)',
    'Go back up.',
    'I will hold the gap.',
    'Not tonight.',
    'Plant your feet. (Bulwark)',
    'I will feel for the seam.',
    'Put the hex in it. (Hex)',
    'Take your hand back.',
    'Leave it. Take nothing.',
    'Take the Shard.',
  ],
  nodes: [
    'scene_kaelen_unmarked_trail_offer.runner',
    'scene_kaelen_unmarked_trail_offer.ask',
    'scene_kaelen_unmarked_trail_offer.agree',
    'scene_kaelen_unmarked_trail_offer.refused',
    'scene_kaelen_unmarked_trail_waiting.edges',
    'scene_mistwood_read_ground.ground',
    'scene_mistwood_read_ground.marks',
    'scene_mistwood_read_ground.line',
    'scene_mistwood_read_ground.set',
    'scene_mistwood_read_ground.taken',
    'scene_kaelen_unmarked_trail_report.weighed',
    'scene_kaelen_unmarked_trail_report.ledger',
    'scene_kaelen_unmarked_trail_after.mending',
    'scene_tamsin_seventh_page_offer.page',
    'scene_tamsin_seventh_page_offer.ask',
    'scene_tamsin_seventh_page_offer.agree',
    'scene_tamsin_seventh_page_offer.refused',
    'scene_tamsin_seventh_page_waiting.rim',
    'scene_plaza_ley_light.light',
    'scene_plaza_ley_light.hand',
    'scene_plaza_ley_light.choose',
    'scene_plaza_ley_light.copied',
    'scene_plaza_ley_light.burned',
    'scene_tamsin_seventh_page_after.dry',
    'scene_tamsin_seventh_page_after.ash',
    'scene_archway_follow.follow',
    'scene_archway_follow.dusk',
    'scene_plaza_last_duel.down',
    'scene_plaza_last_duel.phantom',
    'scene_plaza_last_duel.still',
    'scene_plaza_last_duel.mark',
    'scene_brak_wall_offer.pack',
    'scene_brak_wall_offer.ask',
    'scene_brak_wall_offer.agree',
    'scene_brak_wall_offer.refused',
    'scene_brak_wall_waiting.gap',
    'scene_camp_barricade_night.gap',
    'scene_borin_wall_tempered.plate',
    'scene_borin_wall_tempered.temper',
    'scene_borin_wall_tempered.hammer',
    'scene_borin_wall_after.holding',
    'scene_nyx_unlit_thread_offer.hand',
    'scene_nyx_unlit_thread_offer.ask',
    'scene_nyx_unlit_thread_offer.agree',
    'scene_nyx_unlit_thread_offer.refused',
    'scene_nyx_unlit_thread_waiting.colder',
    'scene_hollow_unlit_thread.seam',
    'scene_hollow_unlit_thread.stalker',
    'scene_hollow_unlit_thread.turns',
    'scene_hollow_unlit_thread.pack',
    'scene_hollow_unlit_thread.nothing',
    'scene_hollow_unlit_thread.took',
    'scene_nyx_unlit_thread_report.knows',
    'scene_nyx_unlit_thread_report.focus',
    'scene_nyx_unlit_thread_report.thief',
    'scene_nyx_unlit_thread_report.focus_cold',
    'scene_nyx_unlit_thread_after.once',
    'scene_nyx_unlit_thread_after.sleeves',
  ],
};
