// U56: Mireya's and Caelum's arc quests, their scenes and camp conversations (src/content/shared/{quests,dialogues}/companions_u56.ts),
// held to their sources read at test time: STORY (§11.1's table, §11.4's blocks, §13's crossing and the Mending's lines to
// Caelum, §7.5 / §7.6's samples, §2.3's verses), DESIGN (§6.2 the arc tiers, §12.1 recruitment, §12.5 loyalty and its
// thresholds, §12.7 camp conversations) and the conventions of the two barrel headers (U52's pattern, D-105, D-109; U54's
// and U55's tests are the model). Then the scenes are played through the engine on the real pack (makeState + play) for
// what the numbers do, the two NPC schedules (D-102) are checked for where the companions stand, and shared2.test.ts's
// open-companion pin is closed here: all six companions are authored.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { companions } from '@content/shared/companions';
import { dialogues as RAW_SCENES } from '@content/shared/dialogues/companions_u56';
import { FROM_LOOP_2, LOYALTY_AGAINST, LOYALTY_ALIGNED, NOT_IN_HORDE, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { quests as RAW_QUESTS } from '@content/shared/quests/companions_u56';
import { validateContent } from '@content/validate';
import { choiceViews, npcsAt, type Action, type CompanionRunState, type GameEvent, type GameState } from '@engine/index';
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
/** The file's records as the pack parsed them (defaults applied), in the file's order. */
const arcScenes = RAW_SCENES.map((s) => scene(s.id));
const arcQuests = RAW_QUESTS.map((q) => quest(q.id));

const MIREYA_QUESTS = ['q_lantern_in_the_reeds', 'q_what_the_light_takes', 'q_preserve_or_heal'];
const CAELUM_QUESTS = ['q_the_apprentices_errand', 'q_a_boy_from_a_doomed_city', 'q_his_masters_sin'];
const QUEST_IDS = [...MIREYA_QUESTS, ...CAELUM_QUESTS];
const SCENE_IDS = [
  'scene_mireya_lantern_offer',
  'scene_mireya_recruit',
  'scene_mireya_lantern_waiting',
  'scene_mireya_tending',
  'scene_mireya_light_offer',
  'scene_mireya_light_waiting',
  'scene_mireya_breathing_pool',
  'scene_mireya_preserve_offer',
  'scene_mireya_preserve_or_heal',
  'scene_mireya_lanternreed',
  'scene_mireya_camp_1',
  'scene_mireya_camp_2',
  'scene_mireya_camp_3',
  'scene_caelum_errand_offer',
  'scene_caelum_errand_waiting',
  'scene_caelum_spire_yard',
  'scene_caelum_recruit',
  'scene_caelum_boy_offer',
  'scene_caelum_boy_waiting',
  'scene_caelum_crossing',
  'scene_caelum_garret',
  'scene_caelum_sin_offer',
  'scene_caelum_sin_waiting',
  'scene_caelum_his_masters_sin',
  'scene_caelum_present',
  'scene_caelum_camp_1',
  'scene_caelum_camp_2',
  'scene_caelum_camp_3',
];
const CAMP_IDS = SCENE_IDS.filter((id) => /_camp_\d$/.test(id));

// ---- Reading STORY and DESIGN -------------------------------------------------------------------------------------------------

/** STORY as one line of prose: wrapped lines joined, markdown emphasis dropped. */
const STORY_FLAT = STORY.replace(/\n\s*>?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ');
const inStory = (text: string): boolean => text.split('\n').every((line) => STORY_FLAT.includes(line));
/** STORY §11.4's block for one quest, flattened. */
function storyBlock(questId: string): string {
  const start = STORY.indexOf(`#### \`${questId}\``);
  if (start < 0) throw new Error(`no STORY §11.4 block for ${questId}`);
  const end = STORY.indexOf('\n#### ', start + 10);
  return STORY.slice(start, end < 0 ? undefined : end).replace(/\n\s*/g, ' ').replace(/\*/g, '');
}
const DESIGN_SECTION = (from: string, to: string): string => DESIGN.slice(DESIGN.indexOf(from), DESIGN.indexOf(to));
const S121 = DESIGN_SECTION('### 12.1 Recruitment', '### 12.2');
const S125 = DESIGN_SECTION('### 12.5 Loyalty', '### 12.6');

const loyaltyOf = (effects: readonly Effect[]): Record<string, number> =>
  Object.fromEntries(effects.flatMap((e) => ('loyalty' in e ? [[e.loyalty.companion, e.loyalty.delta] as const] : [])));
const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const last = (effects: readonly Effect[]): Effect | undefined => effects.at(-1);

// ---- Where each decision lives ---------------------------------------------------------------------------------------------------

const HOLD = choice('scene_mireya_tending', 'stars', 'hold').effects;
const BACK = choice('scene_mireya_tending', 'stars', 'back').effects;
const SALLOW = choice('scene_mireya_breathing_pool', 'name', 'sallow').effects;
const NOTHING = choice('scene_mireya_breathing_pool', 'name', 'nothing').effects;
const ASK_THEM = choice('scene_mireya_preserve_or_heal', 'fen', 'ask_them').effects;
const DAM = choice('scene_mireya_preserve_or_heal', 'choice', 'dam');
const DAM_DEAD = choice('scene_mireya_preserve_or_heal', 'choice', 'dam_dead');
const RUN = choice('scene_mireya_preserve_or_heal', 'choice', 'run').effects;
const HONEST = choice('scene_caelum_spire_yard', 'begin', 'honest').effects;
const LIE = choice('scene_caelum_spire_yard', 'begin', 'lie').effects;
const WALK = choice('scene_caelum_spire_yard', 'until_dusk', 'walk').effects;
const LATER = choice('scene_caelum_spire_yard', 'until_dusk', 'later').effects;
const COME = choice('scene_caelum_crossing', 'come', 'come').effects;
const STAY = choice('scene_caelum_crossing', 'come', 'stay').effects;
const SPEAK = choice('scene_caelum_sin_offer', 'let_me', 'yes').effects;
const KNOWN = choice('scene_mireya_lantern_offer', 'three', 'known');

// ---- The quests -----------------------------------------------------------------------------------------------------------------

describe('the six arc quests (STORY §11.1, §11.4; DESIGN §6.2)', () => {
  const table = STORY.slice(STORY.indexOf('### 11.1 Table'), STORY.indexOf('### 11.2'));
  const row = (id: string): string[] => need(table.split('\n').find((l) => l.startsWith(`| \`${id}\``)), id).split('|').map((c) => c.replace(/\*/g, '').trim());

  test('all six are registered as companion quests, in STORY order, with STORY’s names, givers and the companion; Loop 1 open for the first, 2+ for the rest', () => {
    expect(arcQuests.map((q) => q.id)).toEqual(QUEST_IDS);
    expect(companions.find((c) => c.id === 'mireya')?.arcQuestIds).toEqual(MIREYA_QUESTS);
    expect(companions.find((c) => c.id === 'caelum')?.arcQuestIds).toEqual(CAELUM_QUESTS);
    for (const id of QUEST_IDS) {
      const q = quest(id);
      const r = row(id);
      const who = MIREYA_QUESTS.includes(id) ? 'mireya' : 'caelum';
      expect([id, q.name, q.category, q.giverNpcId, q.companionId]).toEqual([id, r[2], 'companion', `npc_${who}`, who]);
      expect([id, r[4]]).toEqual([id, who === 'mireya' ? 'Mireya' : 'Caelum']);
      expect([id, (r[6] ?? '').startsWith(id === 'q_lantern_in_the_reeds' ? '1+' : '2+')]).toEqual([id, true]);
      // the Glowfen folk and the Circle are not reputation tracks
      expect([id, q.factionId, q.startWhen, q.legacyId, q.repeatablePerLoop]).toEqual([id, undefined, undefined, undefined, true]);
    }
    // STORY "Bots: all … Pacifist." → pacifist; "X P" → explorer
    for (const id of ['q_preserve_or_heal', 'q_his_masters_sin']) expect([id, quest(id).botHint]).toEqual([id, 'pacifist']);
    for (const id of ['q_lantern_in_the_reeds', 'q_what_the_light_takes', 'q_the_apprentices_errand', 'q_a_boy_from_a_doomed_city']) expect([id, quest(id).botHint]).toEqual([id, 'explorer']);
    // D-067.17: the lantern is one of Loop 1's four open quests
    expect(quest('q_lantern_in_the_reeds').availableWhen).toBeUndefined();
    expect(STORY_FLAT).toContain('`q_lantern_in_the_reeds` | Lantern in the Reeds | Mireya 1 | Mireya | The Glowfen | 1+ (L1 open)');
  });

  test('prereqs: STORY §11.4’s givers and Echoes, DESIGN §12.5’s loyalty thresholds where STORY asks them (Mireya 25 then 50, Caelum Loyal for the third)', () => {
    expect(S125).toContain('25 → camp conversation 2 and the companion\'s arc stage 2 available; 50 → arc stage 3');
    expect(quest('q_what_the_light_takes').availableWhen).toEqual({ all: [FROM_LOOP_2, { quest: { id: 'q_lantern_in_the_reeds', status: 'completed' } }, { loyalty: { companion: 'mireya', min: 25 } }] });
    expect(storyBlock('q_what_the_light_takes')).toContain('Giver: Mireya after stage 1; Mireya loyalty ≥ 25. The Glowfen. Prereq: `{ loop: { min: 2 } }`.');
    expect(quest('q_preserve_or_heal').availableWhen).toEqual({ all: [{ echo: 'echo_breathing_pool' }, { loyalty: { companion: 'mireya', min: 50 } }] });
    expect(storyBlock('q_preserve_or_heal')).toContain('Giver: Mireya / Elder Wen. Prereq: `echo_breathing_pool`; Mireya Loyal.');
    expect(quest('q_the_apprentices_errand').availableWhen).toEqual({ echo: 'echo_before_route' });
    expect(storyBlock('q_the_apprentices_errand')).toContain('Prereq: `echo_before_route`.');
    // STORY gives the boy's quest no loyalty gate; "the pin set before he crosses" when the loop is headed for the Mending (U58's quest)
    expect(quest('q_a_boy_from_a_doomed_city').availableWhen).toEqual({
      all: [{ quest: { id: 'q_the_apprentices_errand', status: 'completed' } }, { any: [{ not: { quest: { id: 'q_the_mending' } } }, { flag: 'flag_cradle_pin_anchored' }] }],
    });
    expect(storyBlock('q_a_boy_from_a_doomed_city')).toContain('Giver: Caelum after the errand. Silverwood Before. Prereq: `flag_cradle_pin_anchored` if the loop is headed for the Mending (the pin is set before he crosses, D-067.9); otherwise none.');
    // "in the present" is read through the stage (the Echo alone is the profile's, any loop)
    expect(quest('q_his_masters_sin').availableWhen).toEqual({
      all: [{ echo: 'echo_caelum_unanchored' }, { quest: { id: 'q_a_boy_from_a_doomed_city', stage: 'crossed', status: 'completed' } }, { loyalty: { companion: 'caelum', min: 50 } }],
    });
    expect(storyBlock('q_his_masters_sin')).toContain('Giver: Caelum in the present. Prereq: `echo_caelum_unanchored`; Caelum Loyal; at the Apex in communion.');
    // the Echo shortcut (STORY §12): with `echo_glowlands_leak` the lantern opens at the gathering
    expect(quest('q_lantern_in_the_reeds').shortcuts).toEqual([{ echo: 'echo_glowlands_leak', skipTo: 'gather', text: 'Mireya knows you know what the light is.' }]);
    expect(storyBlock('q_lantern_in_the_reeds')).toContain('With `echo_glowlands_leak` the quest opens at stage 2');
  });

  test('the first stage’s journal is STORY’s stage 1 journal, verbatim (tag story); every other journal is written, pinned and ≤ 40 words', () => {
    for (const q of arcQuests) {
      const first = q.stages[0] as Quest['stages'][number];
      expect([q.id, first.tags, inStory(first.journal)]).toEqual([q.id, ['story'], true]);
      expect(storyBlock(q.id)).toContain(`Journal: "${first.journal}"`);
      for (const st of q.stages.slice(1)) expect([q.id, st.id, st.tags, WRITTEN.journals.includes(st.journal)]).toEqual([q.id, st.id, ['written'], true]);
      for (const st of q.stages) expect([q.id, st.id, words(st.journal) <= 40]).toEqual([q.id, st.id, true]);
      expect([q.id, WRITTEN.other.includes(q.description)]).toEqual([q.id, true]);
    }
  });

  test('DESIGN §6.2 tier XP: an arc’s first quest pays 150, its second 250, its third 400; STORY’s rewards: Fenlight Salve ×3, else tier XP only', () => {
    expect(DESIGN).toContain('companion arc 150/250/400');
    for (const [a, b, c] of [MIREYA_QUESTS, CAELUM_QUESTS]) expect([quest(a as string).rewards.xp, quest(b as string).rewards.xp, quest(c as string).rewards.xp]).toEqual([150, 250, 400]);
    expect(quest('q_lantern_in_the_reeds').rewards.items).toEqual([{ itemId: 'item_fenlight_salve', count: 3 }]);
    expect(storyBlock('q_lantern_in_the_reeds')).toContain('Rewards. Fenlight Salve ×3.');
    for (const id of QUEST_IDS.filter((q) => q !== 'q_lantern_in_the_reeds')) {
      expect([id, quest(id).rewards.items, quest(id).rewards.resonance]).toEqual([id, [], 0]);
      expect(storyBlock(id)).toContain('Rewards. tier XP only.');
    }
    for (const q of arcQuests) expect([q.id, q.rewards.gold, q.rewards.rep, q.rewards.echoes]).toEqual([q.id, 0, [], []]);
  });

  test('DESIGN §12.5 "personal quest stage completed +5": every stage pays +5 to its companion — on exit, or on entering an outcome', () => {
    expect(S125).toContain('| personal quest stage completed | +5 |');
    for (const q of arcQuests) {
      const who = q.companionId as string;
      for (const st of q.stages) {
        const where = st.outcome === undefined ? st.onExit : st.onEnter;
        expect([q.id, st.id, where.filter((e) => 'loyalty' in e)]).toEqual([q.id, st.id, [{ loyalty: { companion: who, delta: 5 } }]]);
      }
    }
    // STORY: `flag_lanternreed_trusts` on the lantern's completion
    expect(stage('q_lantern_in_the_reeds', 'tended').onEnter).toEqual([{ loyalty: { companion: 'mireya', delta: 5 } }, { setFlag: 'flag_lanternreed_trusts' }]);
    expect(storyBlock('q_lantern_in_the_reeds')).toContain('Consequences. Mireya recruitable after stage 1; `flag_lanternreed_trusts`;');
  });

  test('the stage graphs: a stage a scene ends waits (no required objective, a plain next); every decision ends with the questAdvance into its outcome; the objectives', () => {
    const waits: [string, string][] = [
      ['q_lantern_in_the_reeds', 'sick'],
      ['q_lantern_in_the_reeds', 'tend'],
      ['q_what_the_light_takes', 'listen'],
      ['q_preserve_or_heal', 'choose'],
      ['q_the_apprentices_errand', 'errand'],
      ['q_the_apprentices_errand', 'spire_yard'],
      ['q_a_boy_from_a_doomed_city', 'asked'],
      ['q_a_boy_from_a_doomed_city', 'glimpse'],
      ['q_his_masters_sin', 'sorry'],
    ];
    for (const [questId, stageId] of waits) {
      const st = stage(questId, stageId);
      expect([questId, stageId, st.objectives.filter((o) => !o.optional).length, typeof st.next, st.advanceWhen]).toEqual([questId, stageId, 0, 'string', undefined]);
    }
    const ends: [readonly Effect[], string, string][] = [
      [HOLD, 'q_lantern_in_the_reeds', 'tended'],
      [BACK, 'q_lantern_in_the_reeds', 'tended'],
      [SALLOW, 'q_what_the_light_takes', 'heard'],
      [NOTHING, 'q_what_the_light_takes', 'heard'],
      [DAM.effects, 'q_preserve_or_heal', 'dammed'],
      [DAM_DEAD.effects, 'q_preserve_or_heal', 'dammed_dark'],
      [RUN, 'q_preserve_or_heal', 'let_run'],
      [WALK, 'q_the_apprentices_errand', 'joined'],
      [LATER, 'q_the_apprentices_errand', 'joined'],
      [COME, 'q_a_boy_from_a_doomed_city', 'crossed'],
      [STAY, 'q_a_boy_from_a_doomed_city', 'stayed'],
    ];
    for (const [effects, questId, stageId] of ends) {
      expect([questId, stageId, last(effects)]).toEqual([questId, stageId, { questAdvance: { quest: questId, stage: stageId } }]);
      expect([questId, stageId, stage(questId, stageId).outcome]).toEqual([questId, stageId, 'complete']);
    }
    // the passes a scene drives from inside: the elders' telling, the walk, what you know, his two answers
    expect(node('scene_mireya_lantern_offer', 'elders').onEnter).toEqual([{ grantEcho: 'echo_glowlands_leak' }, { questAdvance: { quest: 'q_lantern_in_the_reeds', stage: 'gather' } }]);
    expect(choice('scene_caelum_errand_offer', 'message', 'yes').effects).toEqual([{ questStart: 'q_the_apprentices_errand' }, { questAdvance: { quest: 'q_the_apprentices_errand', stage: 'cross' } }]);
    expect(choice('scene_caelum_boy_offer', 'door', 'show').effects).toEqual([{ questStart: 'q_a_boy_from_a_doomed_city' }, { questAdvance: { quest: 'q_a_boy_from_a_doomed_city', stage: 'door' } }]);
    expect(node('scene_caelum_his_masters_sin', 'forgives').onEnter).toEqual([{ grantEcho: 'echo_caelum_forgives' }, { questAdvance: { quest: 'q_his_masters_sin', stage: 'forgiven' } }]);
    expect(node('scene_caelum_his_masters_sin', 'cannot').onEnter).toEqual([{ grantEcho: 'echo_caelum_cannot' }, { questAdvance: { quest: 'q_his_masters_sin', stage: 'cannot' } }]);
    for (const id of ['forgiven', 'cannot']) expect([id, stage('q_his_masters_sin', id).outcome]).toEqual([id, 'complete']);
    // objectives: three moss and two bitterroot (Antidote Root); the Reed Maze then the Pool; the Pool; the Plaza at noon on Last Bell;
    // the Gate on Last Bell after dusk with Caelum; the communion through with Caelum beside you
    expect(stage('q_lantern_in_the_reeds', 'gather').objectives.map((o) => o.when)).toEqual([{ item: { id: 'item_glow_moss', count: 3 } }, { item: { id: 'item_antidote_root', count: 2 } }]);
    expect(stage('q_lantern_in_the_reeds', 'gather').advanceWhen).toEqual({ all: [{ item: { id: 'item_glow_moss', count: 3 } }, { item: { id: 'item_antidote_root', count: 2 } }] });
    expect(storyBlock('q_lantern_in_the_reeds')).toContain('2. Gather 3 Glow Moss + 2 Bitterroot (Reed Maze).');
    expect(pack.items['item_antidote_root']?.description).toBe('A bitter knuckle of root. Chew, spit, keep walking.');
    expect(stage('q_what_the_light_takes', 'forbidden').objectives.map((o) => o.when)).toEqual([{ location: 'loc_sporelight_shallows' }]);
    expect(stage('q_what_the_light_takes', 'pool').objectives.map((o) => o.when)).toEqual([{ location: 'loc_breathing_pool' }]);
    expect(storyBlock('q_what_the_light_takes')).toContain("2. Reach the Pool through the Drowned Lantern's route. 3. Listen: Sallow's verse, breathing.");
    expect(stage('q_preserve_or_heal', 'dam_or_run').objectives.map((o) => o.when)).toEqual([{ location: 'loc_breathing_pool' }]);
    expect(storyBlock('q_preserve_or_heal')).toContain('2. Choose at the Pool.');
    expect(stage('q_the_apprentices_errand', 'cross').objectives.map((o) => o.when)).toEqual([{ all: [{ location: 'loc_plaza_of_bells' }, { beforeDay: 3 }, { watch: 'day' }] }]);
    expect(storyBlock('q_the_apprentices_errand')).toContain('2. Cross the Plaza at noon on Last Bell to the east terrace.');
    expect(stage('q_a_boy_from_a_doomed_city', 'door').objectives.map((o) => o.when)).toEqual([
      { all: [{ location: 'loc_silver_gate' }, { beforeDay: 3 }, { any: [{ watch: 'dusk' }, { watch: 'night' }] }, { companion: { id: 'caelum' } }] },
    ]);
    expect(STORY_FLAT).toContain('The Breach-door, Before side, Last Bell, with the dusk message in his hand.');
    expect(stage('q_his_masters_sin', 'let_him').objectives.map((o) => o.when)).toEqual([{ flag: 'flag_tyrant_spared' }, { companion: { id: 'caelum' } }]);
    expect(storyBlock('q_his_masters_sin')).toContain("2. Movement II: Caelum answers Masque's question himself. 3. Veyran says the one thing he will not say to the living, to him.");
    // no quest opens a scene (the barrel's rule)
    for (const q of arcQuests) expect([q.id, JSON.stringify(q.stages).includes('startDialogue')]).toEqual([q.id, false]);
  });

  test('Movement II is his: the Tyrant’s Masque question has Caelum’s answer while the quest runs and he stands beside you', () => {
    const tyrant = need(pack.creatures['cr_chronos_tyrant_unveiled']?.communion, 'the communion');
    const masque = need(tyrant.movements[1]?.questions.find((q) => q.id === 'tyr_q_masque'), 'tyr_q_masque');
    const answer = need(masque.answers.find((a) => a.id === 'caelum_answers'), 'caelum_answers');
    expect([answer.when, answer.resolve, answer.lie]).toEqual([{ all: [{ companion: { id: 'caelum', state: 'active' } }, { quest: { id: 'q_his_masters_sin', status: 'active' } }] }, 1, false]);
    expect(answer.text).toBe("Caelum answers for you: 'The far side is a boy on a stair, Master Masque. You taught me to look. I looked.'");
    expect(words(answer.text)).toBeLessThanOrEqual(25);
    expect(storyBlock('q_his_masters_sin')).toContain("Caelum answers Masque's question himself");
  });

  test('rule 18 is met for every companion (two outcomes per arc) and rule 15/16 pending counts fell: the arcs’ Echoes are granted and read; the open-companion set is empty', () => {
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(strict.errors).toEqual([]);
    expect(strict.warnings.filter((w) => w.rule === 'rule-18')).toEqual([]);
    const granted = new Set(strict.warnings.filter((w) => w.rule === 'rule-16' && w.message.includes('no grantEcho')).map((w) => w.id));
    for (const id of ['echo_glowlands_leak', 'echo_litany_verse_6', 'echo_breathing_pool', 'echo_glowfen_dammed', 'echo_glowfen_let_run', 'echo_litany_verse_5', 'echo_caelum_unanchored', 'echo_caelum_stayed', 'echo_caelum_forgives', 'echo_caelum_cannot']) {
      expect([id, granted.has(id)]).toEqual([id, false]);
    }
    const idle = new Set(strict.warnings.filter((w) => w.rule === 'rule-16' && w.message.includes('gates nothing')).map((w) => w.id));
    for (const id of ['echo_glowlands_leak', 'echo_breathing_pool', 'echo_before_route', 'echo_caelum_unanchored', 'echo_mireya_bond', 'echo_caelum_bond']) expect([id, idle.has(id)]).toEqual([id, false]);
    expect(strict.warnings.filter((w) => w.rule === 'rule-16').length).toBeLessThanOrEqual(39); // 51 before U56
    // shared2.test.ts's pin: every companion is authored whole
    const authored = (c: (typeof companions)[number]): boolean => c.arcQuestIds.every((q) => q in pack.quests) && (c.campScenes ?? []).every((d) => d in pack.dialogues);
    expect(companions.filter((c) => !authored(c)).map((c) => c.id)).toEqual([]);
    expect(strict.warnings.filter((w) => w.table === 'companions')).toEqual([]);
  });
});

// ---- DESIGN §12.5 at every decision --------------------------------------------------------------------------------------------

describe('loyalty, Echoes and flags at every decision (STORY §7.5, §7.6, §11.4, §13; DESIGN §12.5)', () => {
  test('Mireya’s beats: steady hands +3 (or −10); Sallow’s name brought back +3; Lanternreed asked +3; the dam takes either fragment, the fen’s Echo rides on the choice', () => {
    expect(STORY_FLAT).toContain('Loyalty beats. Healing the changed without flinching; bringing Imre Sallow\'s name back from the Breathing Pool; letting Lanternreed decide for itself.');
    expect(loyaltyOf(HOLD)).toEqual({ mireya: LOYALTY_ALIGNED });
    expect(loyaltyOf(BACK)).toEqual({ mireya: LOYALTY_AGAINST });
    expect(node('scene_mireya_tending', 'sit').onEnter).toEqual([{ takeItem: { item: 'item_glow_moss', count: 3 } }, { takeItem: { item: 'item_antidote_root', count: 2 } }]);
    expect(node('scene_mireya_breathing_pool', 'verse').onEnter).toEqual([{ grantEcho: 'echo_litany_verse_6' }]);
    expect(node('scene_mireya_breathing_pool', 'name').onEnter).toEqual([{ grantEcho: 'echo_breathing_pool' }]);
    expect(storyBlock('q_what_the_light_takes')).toContain('Consequences. `echo_breathing_pool`, `echo_litany_verse_6`.');
    expect(loyaltyOf(SALLOW)).toEqual({ mireya: LOYALTY_ALIGNED });
    expect(loyaltyOf(NOTHING)).toEqual({});
    expect(loyaltyOf(ASK_THEM)).toEqual({ mireya: LOYALTY_ALIGNED });
    expect(DAM.effects).toEqual([{ takeItem: { item: 'item_heartstone_fragment_stable' } }, { grantEcho: 'echo_glowfen_dammed' }, { questAdvance: { quest: 'q_preserve_or_heal', stage: 'dammed' } }]);
    expect(DAM_DEAD.effects).toEqual([{ takeItem: { item: 'item_heartstone_fragment_dead' } }, { grantEcho: 'echo_glowfen_dammed' }, { questAdvance: { quest: 'q_preserve_or_heal', stage: 'dammed_dark' } }]);
    expect(RUN).toEqual([{ grantEcho: 'echo_glowfen_let_run' }, { questAdvance: { quest: 'q_preserve_or_heal', stage: 'let_run' } }]);
    // greyed without the fragment, as DESIGN §13.2's Echo lines are
    expect([DAM.disabledWhen, DAM_DEAD.disabledWhen]).toEqual([{ not: { item: { id: 'item_heartstone_fragment_stable' } } }, { not: { item: { id: 'item_heartstone_fragment_dead' } } }]);
    expect(storyBlock('q_preserve_or_heal')).toContain('Dam (needs a Heartstone fragment, stable or dead, D-052; the dam takes one of the two): `echo_glowfen_dammed`; the glow fades; some sicken; with the dead fragment the fen goes dark for good; Elder Wen Hostile. Let run: `echo_glowfen_let_run`;');
    expect(STORY_FLAT).toContain('Mireya accepts either and never says you chose right.');
    // the dam or the letting-run carries no loyalty: she stands by either
    for (const effects of [DAM.effects, DAM_DEAD.effects, RUN]) expect(loyaltyOf(effects)).toEqual({});
    expect(S125).toContain('Mireya: cleanse, protect the Glowfen');
  });

  test('Caelum’s beats: the honest answer +3 (a lie −10); the Library seen +3 at the glimpse; letting him speak +3; his Echoes ride on come/stay and forgive/cannot; stayed, he leaves the party', () => {
    expect(STORY_FLAT).toContain('Loyalty beats. Not lying to him about the city; letting him see the Shattered Library; letting him speak to the Tyrant.');
    expect(loyaltyOf(HONEST)).toEqual({ caelum: LOYALTY_ALIGNED });
    expect(loyaltyOf(LIE)).toEqual({ caelum: LOYALTY_AGAINST });
    expect(node('scene_caelum_crossing', 'library').onEnter).toEqual([{ loyalty: { companion: 'caelum', delta: LOYALTY_ALIGNED } }]);
    expect(SPEAK).toEqual([{ loyalty: { companion: 'caelum', delta: LOYALTY_ALIGNED } }, { questStart: 'q_his_masters_sin' }]);
    expect(COME).toEqual([{ grantEcho: 'echo_caelum_unanchored' }, { questAdvance: { quest: 'q_a_boy_from_a_doomed_city', stage: 'crossed' } }]);
    expect(STAY).toEqual([{ grantEcho: 'echo_caelum_stayed' }, { dismiss: 'caelum' }, { questAdvance: { quest: 'q_a_boy_from_a_doomed_city', stage: 'stayed' } }]);
    expect(storyBlock('q_a_boy_from_a_doomed_city')).toContain('A: `echo_caelum_unanchored`; Caelum crosses and is a present-day companion. B: `echo_caelum_stayed`.');
    expect(storyBlock('q_his_masters_sin')).toContain('Consequences. `echo_caelum_forgives` or `echo_caelum_cannot`; the Mending\'s final scene is warm or cold; consent does not depend on it.');
    expect(node('scene_caelum_spire_yard', 'verse').onEnter).toEqual([{ grantEcho: 'echo_litany_verse_5' }]);
    expect(storyBlock('q_the_apprentices_errand')).toContain('Consequences. `echo_litany_verse_5`; Caelum joins as a companion inside the Before (D-067.9).');
    expect(S125).toContain('Caelum: attempt the anchor');
    // nothing else in these scenes moves loyalty beyond the beats and the recruitments
    const known = [HOLD, BACK, SALLOW, ASK_THEM, HONEST, LIE, SPEAK].map((e) => JSON.stringify(e));
    for (const s of arcScenes) {
      for (const n of s.nodes) {
        if (n.onEnter.some((e) => 'loyalty' in e)) expect([s.id, n.id]).toEqual(['scene_caelum_crossing', 'library']);
        for (const c of n.choices) if (c.effects.some((e) => 'loyalty' in e)) expect([s.id, n.id, c.id, known.includes(JSON.stringify(c.effects))]).toEqual([s.id, n.id, c.id, true]);
        for (const c of n.choices) expect([s.id, n.id, c.id, c.effects.some((e) => 'rep' in e)]).toEqual([s.id, n.id, c.id, false]);
      }
    }
  });

  test('recruitment (DESIGN §12.1, STORY §7.5, §7.6): Mireya after stage 1, not Hostile with the Remnants, in the offer and again behind it; Caelum at the Yard after the errand (D-067.9) and again at the Garret', () => {
    expect(S121).toContain('| `mireya` | Mireya of Lanternreed | Lanternreed (Glowfen) | `q_lantern_in_the_reeds` stage 1; not Hostile with Remnants |');
    expect(STORY_FLAT).toContain('Recruitment. Reach Lanternreed and finish stage 1 of `q_lantern_in_the_reeds` (any loop;');
    // the offer: the elders' telling passes stage 1, then she offers to come; the Echo line skips the telling (the quest opens at the gathering)
    expect(node('scene_mireya_lantern_offer', 'three').choices.map((c) => [c.id, c.next])).toEqual([['yes', 'elders'], ['known', 'hands'], ['no', 'refused']]);
    expect([KNOWN.echoHint, KNOWN.disabledWhen, KNOWN.tags, KNOWN.when]).toEqual(['echo_glowlands_leak', { not: { echo: 'echo_glowlands_leak' } }, ['echo'], FROM_LOOP_2]);
    expect(choice('scene_mireya_lantern_offer', 'hands', 'come').effects).toEqual([{ recruit: 'mireya' }]);
    expect(scene('scene_mireya_recruit').when).toEqual({
      all: [NOT_IN_HORDE, { location: 'loc_lanternreed' }, { not: { companion: { id: 'mireya', state: 'recruited' } } }, { rep: { faction: 'remnants', min: -39 } }, { quest: { id: 'q_lantern_in_the_reeds' } }, { not: { quest: { id: 'q_lantern_in_the_reeds', stage: 'sick' } } }],
    });
    expect(DESIGN).toContain('Hostile ≤ −40');
    expect(choice('scene_mireya_recruit', 'ask', 'come').effects).toEqual([{ recruit: 'mireya' }]);
    expect(scene('scene_mireya_recruit').entry).toEqual([{ when: { echo: 'echo_mireya_bond' }, node: 'before' }, { when: { quest: { id: 'q_lantern_in_the_reeds', status: 'completed' } }, node: 'after' }, { when: { all: [] }, node: 'gather' }]);
    expect(S121).toContain('| `caelum` | Caelum Vesper | Silverwood Before | crosses forward by his own choice in `q_a_boy_from_a_doomed_city`');
    expect(STORY_FLAT).toContain('Recruitment. Inside Silverwood Before, after `q_the_apprentices_errand` (he joins as a companion in the Before and stays in the Before; D-067.9).');
    expect(WALK).toEqual([{ recruit: 'caelum' }, { questAdvance: { quest: 'q_the_apprentices_errand', stage: 'joined' } }]);
    expect(scene('scene_caelum_recruit').when).toEqual({
      all: [NOT_IN_HORDE, { any: [{ beforeDay: 1 }, { beforeDay: 2 }, { beforeDay: 3 }] }, { quest: { id: 'q_the_apprentices_errand', status: 'completed' } }, { not: { companion: { id: 'caelum', state: 'recruited' } } }, { not: { quest: { id: 'q_a_boy_from_a_doomed_city', stage: 'stayed', status: 'completed' } } }],
    });
    expect(choice('scene_caelum_recruit', 'nobodys', 'come').effects).toEqual([{ recruit: 'caelum' }]);
    // no other recruit anywhere in the file
    const recruits = arcScenes.flatMap((s) => s.nodes.flatMap((n) => [...n.onEnter, ...n.choices.flatMap((c) => c.effects)])).filter((e) => 'recruit' in e);
    expect(recruits).toHaveLength(4);
  });
});

// ---- The scenes ------------------------------------------------------------------------------------------------------------------

describe('the scenes (the conventions of src/content/shared/dialogues/index.ts; DESIGN §12.7; STORY §13)', () => {
  test('the listed scenes, all registered; NPC scenes closed in the Horde, every priority a band; the camp scenes have no NPC, play once, and sit at 1–3', () => {
    expect(arcScenes.map((s) => s.id)).toEqual(SCENE_IDS);
    const bands = Object.values(SCENE_PRIORITY) as number[];
    for (const s of arcScenes) {
      if (CAMP_IDS.includes(s.id)) {
        expect([s.id, s.npcId, s.repeatable, [1, 2, 3].includes(s.priority)]).toEqual([s.id, undefined, false, true]);
        continue;
      }
      expect([s.id, bands.includes(s.priority), s.npcId]).toEqual([s.id, true, s.id.startsWith('scene_mireya') ? 'npc_mireya' : 'npc_caelum']);
      expect([s.id, JSON.stringify(s.when).startsWith(`{"all":[${JSON.stringify(NOT_IN_HORDE)}`)]).toEqual([s.id, true]);
    }
    const band = (id: string) => scene(id).priority;
    expect(SCENE_IDS.filter((id) => id.endsWith('_offer')).map(band)).toEqual(Array(6).fill(SCENE_PRIORITY.offer));
    expect(SCENE_IDS.filter((id) => id.endsWith('_waiting')).map(band)).toEqual(Array(5).fill(SCENE_PRIORITY.waiting));
    for (const id of ['scene_mireya_tending', 'scene_mireya_breathing_pool', 'scene_mireya_preserve_or_heal', 'scene_caelum_spire_yard', 'scene_caelum_crossing', 'scene_caelum_his_masters_sin']) {
      expect([id, band(id)]).toEqual([id, SCENE_PRIORITY.decision]);
    }
    // the recruit asks ride in the waiting band ahead of the waiting lines; the "nothing pending" lines come last in their band
    for (const id of ['scene_mireya_recruit', 'scene_caelum_recruit', 'scene_mireya_lanternreed']) expect([id, band(id)]).toEqual([id, SCENE_PRIORITY.waiting]);
    for (const id of ['scene_caelum_garret', 'scene_caelum_present']) expect([id, band(id)]).toEqual([id, SCENE_PRIORITY.idle]);
    expect(SCENE_IDS.indexOf('scene_mireya_recruit')).toBeLessThan(SCENE_IDS.indexOf('scene_mireya_lantern_waiting'));
    expect(SCENE_IDS.indexOf('scene_mireya_lanternreed')).toBeGreaterThan(SCENE_IDS.indexOf('scene_mireya_light_waiting'));
    expect(SCENE_IDS.indexOf('scene_caelum_recruit')).toBeLessThan(SCENE_IDS.indexOf('scene_caelum_boy_waiting'));
    // every NPC scene is repeatable but the camps: a decision closes by its quest stage, an offer by the quest started
    for (const s of arcScenes) if (!CAMP_IDS.includes(s.id)) expect([s.id, s.repeatable]).toEqual([s.id, true]);
  });

  test('camp conversations (DESIGN §12.5, §12.7): the first at a rest with the companion, the second from loyalty 25, the third from 50; they are the records’ campScenes', () => {
    expect(S125).toContain('25 → camp conversation 2');
    expect(DESIGN_SECTION('### 12.7', '### 12.8')).toContain('gated by `{ companion: { id } }` and `{ loyalty: { companion, min } }`');
    for (const who of ['mireya', 'caelum'] as const) {
      expect(companions.find((c) => c.id === who)?.campScenes).toEqual([1, 2, 3].map((n) => `scene_${who}_camp_${n}`));
      expect(scene(`scene_${who}_camp_1`).when).toEqual({ companion: { id: who } });
      expect(scene(`scene_${who}_camp_2`).when).toEqual({ all: [{ companion: { id: who } }, { loyalty: { companion: who, min: 25 } }] });
      const third = scene(`scene_${who}_camp_3`).when as { all: Condition[] };
      expect(third.all.slice(0, 2)).toEqual([{ companion: { id: who } }, { loyalty: { companion: who, min: 50 } }]);
      for (const n of [1, 2, 3]) expect([who, n, scene(`scene_${who}_camp_${n}`).priority]).toEqual([who, n, n]);
      // the companion speaks (plain id: an interjection the engine skips when they are absent), never the NPC
      for (const n of [1, 2, 3]) for (const nd of scene(`scene_${who}_camp_${n}`).nodes) expect([nd.id, nd.speaker]).toEqual([nd.id, who]);
      // each is a conversation: a choice the Wayfinder makes
      for (const n of [1, 2, 3]) expect([who, n, scene(`scene_${who}_camp_${n}`).nodes.some((nd) => nd.choices.length >= 2)]).toEqual([who, n, true]);
    }
    // Mireya's third once the Pool is heard; Caelum's once he has crossed this loop (read through the stage: he is remade each loop, D-067.4)
    expect((scene('scene_mireya_camp_3').when as { all: Condition[] }).all[2]).toEqual({ quest: { id: 'q_what_the_light_takes', status: 'completed' } });
    expect((scene('scene_caelum_camp_3').when as { all: Condition[] }).all[2]).toEqual({ quest: { id: 'q_a_boy_from_a_doomed_city', stage: 'crossed', status: 'completed' } });
  });

  test('where they stand (D-102, the NPC schedules): Mireya at the Pool while her quests run; Caelum at the Plaza, the Gate, and — crossed — the Nexus and the Apex, never the Before', () => {
    expect(pack.npcs['npc_mireya']?.schedule).toEqual([
      { when: { any: [{ quest: { id: 'q_what_the_light_takes', status: 'active' } }, { quest: { id: 'q_preserve_or_heal', status: 'active' } }] }, at: ['loc_lanternreed', 'loc_breathing_pool'] },
    ]);
    expect(pack.npcs['npc_caelum']?.schedule).toEqual([
      { when: { quest: { id: 'q_a_boy_from_a_doomed_city', stage: 'crossed', status: 'completed' } }, at: ['loc_chronos_nexus', 'loc_temporal_breach_apex'] },
      { when: { quest: { id: 'q_the_apprentices_errand', status: 'active' } }, at: ['loc_apprentices_garret', 'loc_plaza_of_bells'] },
      { when: { quest: { id: 'q_a_boy_from_a_doomed_city', status: 'active' } }, at: ['loc_apprentices_garret', 'loc_silver_gate'] },
      { when: { all: [{ beforeDay: 3 }, { watch: 'dusk' }] }, at: ['loc_archives_of_danthe'] },
      { when: { all: [{ beforeDay: 1 }, { watch: 'day' }] }, at: ['loc_plaza_of_bells'] },
    ]);
    expect(STORY_FLAT).toContain('Mireya is going anyway.');
    expect(STORY_FLAT).toContain("For the rest of a loop in which he has crossed, the Before's stair at dusk has no boy on it");
    // the real pack: who stands where, by quest state
    const at = (o: StateOverrides, locationId: string) => npcsAt(makeState({ ...o, loop: 2 }, { content: pack, profile: freshProfile({ loopCounter: 2 }) }), pack, freshProfile({ loopCounter: 2 }), locationId);
    expect(at({ locationId: 'loc_lanternreed' }, 'loc_lanternreed')).toContain('npc_mireya');
    expect(at({ locationId: 'loc_breathing_pool' }, 'loc_breathing_pool')).toEqual(['npc_elder_wen']);
    expect(at({ locationId: 'loc_breathing_pool', quests: { q_what_the_light_takes: 'pool' } }, 'loc_breathing_pool')).toEqual(['npc_elder_wen', 'npc_mireya']);
    expect(at({ locationId: 'loc_lanternreed', quests: { q_preserve_or_heal: 'choose' } }, 'loc_lanternreed')).toContain('npc_mireya');
    expect(at({ locationId: 'loc_chronos_nexus' }, 'loc_chronos_nexus')).not.toContain('npc_caelum');
    expect(at({ locationId: 'loc_chronos_nexus', quests: { q_a_boy_from_a_doomed_city: { status: 'completed', stage: 'crossed' } } }, 'loc_chronos_nexus')).toContain('npc_caelum');
    expect(at({ locationId: 'loc_temporal_breach_apex', quests: { q_a_boy_from_a_doomed_city: { status: 'completed', stage: 'crossed' } } }, 'loc_temporal_breach_apex')).toContain('npc_caelum');
    expect(at({ locationId: 'loc_apprentices_garret', quests: { q_a_boy_from_a_doomed_city: { status: 'completed', stage: 'crossed' } } }, 'loc_apprentices_garret')).not.toContain('npc_caelum');
    expect(at({ locationId: 'loc_silver_gate', quests: { q_a_boy_from_a_doomed_city: 'door' } }, 'loc_silver_gate')).toContain('npc_caelum');
    expect(at({ locationId: 'loc_plaza_of_bells', quests: { q_the_apprentices_errand: 'cross' } }, 'loc_plaza_of_bells')).toContain('npc_caelum');
  });

  test('every node is tagged by its source: story text is STORY’s, written text is the pinned list; a variant is a line of its own', () => {
    for (const s of arcScenes) {
      for (const n of s.nodes) {
        const tag = n.tags[0];
        if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else expect([s.id, n.id, tag, WRITTEN.nodes.includes(n.text)]).toEqual([s.id, n.id, 'written', true]);
        for (const v of n.textVariants) expect([s.id, n.id, WRITTEN.variants.includes(v.text)]).toEqual([s.id, n.id, true]);
      }
    }
    const storyNodes = arcScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'story').map((n) => `${s.id}.${n.id}`));
    expect(storyNodes).toEqual([
      'scene_mireya_lantern_offer.knees',
      'scene_mireya_breathing_pool.verse', 'scene_mireya_breathing_pool.person',
      'scene_mireya_lanternreed.grandmother',
      'scene_mireya_camp_2.preserve',
      'scene_caelum_spire_yard.verse',
      'scene_caelum_crossing.library', 'scene_caelum_crossing.carrel', 'scene_caelum_crossing.city', 'scene_caelum_crossing.nobody', 'scene_caelum_crossing.come', 'scene_caelum_crossing.it_is',
      'scene_caelum_garret.holding',
      'scene_caelum_his_masters_sin.did_you', 'scene_caelum_his_masters_sin.nobody_did', 'scene_caelum_his_masters_sin.sorry', 'scene_caelum_his_masters_sin.cannot',
      'scene_caelum_camp_2.pack',
    ]);
  });

  test('STORY’s lines sit where STORY puts them: the crossing line for line (§13), the Mending’s lines to Caelum (§13, §11.4), the verses (§2.3), "It’s a person" (§11.4), the samples (§7.5, §7.6)', () => {
    expect(scene('scene_caelum_crossing').nodes.map((n) => n.id)).toEqual(['library', 'carrel', 'city', 'nobody', 'come', 'through', 'it_is']);
    expect(node('scene_caelum_crossing', 'library').text).toBe('Through the door the Shattered Library: collapsed shelves, dust motes, pages turning on their own.');
    expect(choice('scene_caelum_crossing', 'carrel', 'five_hundred').text).toBe("It's five hundred years from now. It's what's left.");
    expect(node('scene_caelum_crossing', 'come').choices.map((c) => c.text)).toEqual(['Come.', "Stay. It's your city."]);
    expect(STORY_FLAT).toContain('Choices: "Come." → `echo_caelum_unanchored`; he steps through holding the message. "Stay. It\'s your city." → Caelum: "It is. Thank you for asking." `echo_caelum_stayed`.');
    expect(node('scene_caelum_crossing', 'it_is').text).toBe('It is. Thank you for asking.');
    // the one thing he will not say to the living (§8.1), in the words STORY gives the Mending's end
    expect(scene('scene_caelum_his_masters_sin').nodes.slice(1, 4).map((n) => [n.speaker, n.text])).toEqual([
      ['cr_chronos_tyrant_unveiled', 'Caelum. The message. Did you—'],
      ['npc_caelum', 'No. Nobody did.'],
      ['cr_chronos_tyrant_unveiled', 'Good. It said begin. I am sorry, boy. I say it to you because you are the only one here I am allowed to say it to.'],
    ]);
    expect(STORY_FLAT).toContain('He never says "I am sorry," because he does not believe it is his to say to the living; he says it, once, to Caelum.');
    expect(node('scene_caelum_his_masters_sin', 'cannot').text).toBe("I don't forgive you, Master Thal.");
    expect(STORY_FLAT).toContain('There is no second test (REVIEW #3).');
    expect(scene('scene_caelum_his_masters_sin').nodes.some((n) => /second test/i.test(n.text))).toBe(false);
    // the verses, whole, in their singers' mouths
    expect([node('scene_caelum_spire_yard', 'verse').speaker, node('scene_caelum_spire_yard', 'verse').text]).toEqual(['npc_seraphine_aulde', 'Rise, lines, and be lifted. Sing the one note the world was tuned to. Let the sky hear what the ground has always known.']);
    expect([node('scene_mireya_breathing_pool', 'verse').speaker, node('scene_mireya_breathing_pool', 'verse').text]).toEqual(['npc_imre_sallow', 'Green, take what the stone cannot. Breathe in what burns; breathe out what grows. Let what lives carry what does not.']);
    expect(node('scene_mireya_breathing_pool', 'person').text).toBe("It's a person. It's been a person the whole time.");
    expect(storyBlock('q_what_the_light_takes')).toContain('Mireya: "It\'s a person. It\'s been a person the whole time."');
    expect(node('scene_mireya_breathing_pool', 'edge').choices.map((c) => c.text)).toEqual(['Listen.']);
    // the samples
    expect(node('scene_mireya_lantern_offer', 'knees').text).toBe('Glow Moss for the wound, bitterroot for the fever, and sit down, I can see your knees.');
    expect(node('scene_mireya_lanternreed', 'grandmother').text).toBe('My grandmother glowed at the end. We said it was holiness. It was the water.');
    expect(node('scene_mireya_camp_2', 'preserve').text).toBe("You keep saying preserve. The fen doesn't preserve anything. It changes it or it eats it.");
    expect(node('scene_caelum_garret', 'holding').text).toBe("Master Thal says the Holding is a kindness to the hour. Is it? You look like someone who's seen the hour afterward.");
    expect(node('scene_caelum_camp_2', 'pack').text).toBe("Everything in your pack is older than my city. That isn't possible. I'm holding it.");
    // the errand on Last Bell at noon, the Garret where his schedule has him (D-102)
    expect(scene('scene_caelum_errand_offer').when).toEqual({ all: [NOT_IN_HORDE, { location: 'loc_apprentices_garret' }, { beforeDay: 3 }, { watch: 'day' }, { echo: 'echo_before_route' }, { not: { quest: { id: 'q_the_apprentices_errand' } } }] });
    expect(storyBlock('q_the_apprentices_errand')).toContain('Giver: Caelum, the Plaza of Bells or the Garret, Silverwood Before, on Last Bell at noon.');
    // Wen's refusal in her own voice (BIBLE: short, flat refusals)
    expect([node('scene_mireya_light_offer', 'anyway').speaker, node('scene_mireya_light_offer', 'anyway').text]).toEqual(['npc_elder_wen', 'No.']);
    expect(node('scene_mireya_preserve_or_heal', 'mat').speaker).toBe('npc_elder_wen');
    // the child's eyes (STORY §11.4 stage 3)
    expect(node('scene_mireya_tending', 'child').text).toContain('Mireling-green');
    expect(storyBlock('q_lantern_in_the_reeds')).toContain("a child's eyes go Mireling-green and she says she can see the stars under the water.");
  });

  test('choice texts and the other written words are exactly the pinned lists (the lead checks them); STORY §15.1’s banned words stay out; the voices hold', () => {
    const nodes = arcScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'written').map((n) => n.text));
    const choices = arcScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.map((c) => c.text)));
    const journals = arcQuests.flatMap((q) => q.stages.filter((st) => st.tags?.[0] === 'written').map((st) => st.journal));
    const variants = arcScenes.flatMap((s) => s.nodes.flatMap((n) => n.textVariants.map((v) => v.text)));
    expect([...new Set(nodes)].sort()).toEqual([...WRITTEN.nodes].sort());
    expect([...new Set(choices)].sort()).toEqual([...WRITTEN.storyChoices, ...WRITTEN.choices].sort());
    expect([...new Set(journals)].sort()).toEqual([...WRITTEN.journals].sort());
    expect([...new Set(variants)].sort()).toEqual([...WRITTEN.variants].sort());
    for (const t of WRITTEN.storyChoices) expect([t, inStory(t)]).toEqual([t, true]);
    const other = [...arcQuests.map((q) => q.description), ...arcScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.flatMap((c) => (c.disabledText === undefined ? [] : [c.disabledText]))))];
    expect([...new Set(other)].sort()).toEqual([...WRITTEN.other].sort());
    for (const t of WRITTEN.nodes) expect([t, words(t) <= 50]).toEqual([t, true]);
    for (const t of WRITTEN.variants) expect([t, words(t) <= 75]).toEqual([t, true]);
    for (const t of [...WRITTEN.choices, ...WRITTEN.journals, ...WRITTEN.other]) expect([t, words(t) <= 40]).toEqual([t, true]);
    const banned = /\b(fabric of (reality|existence)|eldritch|unspeakable|unimaginable|nightmarish|epic|suddenly|very|literally|ancient|mysterious|ethereal)\b|!|You feel a sense of/i;
    for (const t of [...WRITTEN.nodes, ...WRITTEN.variants, ...WRITTEN.choices, ...WRITTEN.journals, ...WRITTEN.other]) expect([t, banned.test(t)]).toEqual([t, false]);
    // BIBLE: Caelum says "Master —" and never "sir"; Mireya's kindness is instruction, never softness ("dear", "sweet")
    for (const s of arcScenes) {
      for (const n of s.nodes) {
        if (n.speaker === 'npc_caelum' || n.speaker === 'caelum') expect([s.id, n.id, /\bsir\b/i.test(n.text)]).toEqual([s.id, n.id, false]);
        if (n.speaker === 'npc_mireya' || n.speaker === 'mireya') expect([s.id, n.id, /\b(dear|sweetheart|honey)\b/i.test(n.text)]).toEqual([s.id, n.id, false]);
      }
    }
    const caelumSays = arcScenes.flatMap((s) => s.nodes.filter((n) => n.speaker === 'npc_caelum' || n.speaker === 'caelum').map((n) => n.text)).join(' ');
    expect(/Master (Thal|Masque|Korr|Vane|Hallow)/.test(caelumSays)).toBe(true);
  });
});

/** Every word U56 wrote (the reply lists them). */
const WRITTEN = {
  nodes: [
    // Mireya at Lanternreed
    'Three of us are sick with the shining. Not fever-sick; the light has got into them and wants out through the skin. I need three Glow Moss, two bitterroot, and a pair of hands that do not shake. Yours look steady enough.',
    'The glow is the Breach. It leaks, and we drink it. The Apex is failing on its own; it never needed a hand.',
    'There. Now you know what we are. I am coming with you for the moss; you would bring me parsnip and call it bitterroot.',
    'Good. Rain by dusk; we go now and we come back dry. Do not touch the shelves that glow blue.',
    'Then three moss, two roots, and back before the rain. The Shallows grow both, if you can hold your breath; Fennick sells both, if you cannot.',
    'Then keep your hands in your pockets. The sick will keep too; that is what the shining does, it keeps them.',
    'I do not know you. My hands do; they went to your pack for the salve before I thought. Come on, then.',
    'Still here, still short of hands. I am coming with you for the moss; nobody finds bitterroot by looking for it.',
    "The fever's broken and the village is kind to you now, which it is not to many. Take me east when you go. I want to see where the light comes from, and Wen will not tell me.",
    'She has her basket already.',
    'Good. Boots on; the Causeway floods by dusk.',
    'Then I will be here, picking moss in the rain.',
    'You had three moss and two roots and now you have fewer. Fetch them again; the sick do not get better on good intentions.',
    'Three moss, two bitterroot. The Shallows grow both under the shelves, and Fennick sells both at a price. Go on; the light does not wait.',
    'Good. Moss here, root here, hands here. Sit her up for me.',
    'The girl is nine and lit from the throat down. Mireya chews the root and spits it into the moss and binds it on, and the light under the skin pulls back from it like a tide. Then the girl opens her eyes, and they are Mireling-green, and she smiles.',
    "'I can see the stars,' she says. 'Under the water. There's so many.'",
    "That's it. Steady. She will see in the dark now, and she will never be cold, and in a year she will not be anyone's daughter. Hold her anyway. Salve's on the shelf; take three, you earned them.",
    "Then look at the wall and hold her hand where you cannot see it. She was a person last spring. She is a person now. Salve's on the shelf; take it and think about that.",
    'The Pool is where the glow is born. Below the village, where the water breathes. Wen keeps her mat at the edge and nobody goes past the mat.',
    'No.',
    "I am going anyway. I want to know what it is before it finishes with us. The lantern-boat's way, through the Maze; that is how the village used to go, before Wen. Come with me.",
    'The Shallows first. Hold your breath where the dust is thick, and follow the pulses; they go the right way.',
    'Then I go alone, and Wen can say no to the water.',
    "The Maze first, the lantern-boat's way. I am not sneaking past Wen's mat with you watching.",
    'I have gone ahead to the Pool. Come down when you can breathe again.',
    // Mireya at the Pool
    'The well of light inhales for six heartbeats and exhales for six. Mireya kneels at the edge with her sleeves pushed up, and the light under her forearms keeps the same time.',
    'It is breathing. It has been breathing into us for five hundred years and we called it holy. Who was she? Did she have a name, where you come from?',
    'Imre Sallow. Then that is who the fen has been carrying. I will take it up to the village and say it at the mat, and Wen can sit on it.',
    'It matters to me. Keep it, then. I will take the breath up to the village and call it what we have always called it, and know better.',
    'I have thought about it since the Pool. The leak can be dammed. A piece of the Heartstone in the well, stable or dead, and the breath stops; the changed stop changing, and some sicken for it. Or we let it run, and the fen becomes what it is becoming.',
    'I will stand by either. Wen will not; she has already said no to a thing nobody has asked her. Come down to the Pool and choose. It is yours; I have had my hands in it too long to see it.',
    'Bring the fragment if you mean to dam it. The well does not take promises.',
    'Then it runs a while longer. It has run five hundred years; it can wait on you.',
    'No. The glow stays. Whatever it costs.',
    'She has said no to it for forty years and it has gone on leaking. Nothing here keeps. It changes, or it is eaten, and that is the only choice the fen has ever offered anyone.',
    'She goes up the ladder and comes back with the answer the village gave, which is three answers. The girl with the green eyes wants the stars. Her mother wants her daughter. Elder Tam said not yet.',
    'Then say it. Stone in the well, or hands off.',
    "The fragment goes into the light and the light closes over it, and the Pool breathes slower, and slower. Wen does not get up. The glow in Mireya's forearms dims by a shade, and she watches it go.",
    "The dead stone goes in and the light goes with it, all at once, the way a lamp goes. The Pool is water. Wen says something in the dark that is not a word. Mireya's arms are only arms.",
    'You take your hands off it. The Pool breathes in, and out, and the light climbs a little higher up the stilts than it did yesterday. Somewhere above, the girl with green eyes laughs.',
    'Done, then. Some of them will sicken; I will sit with them. Do not ask me if it was right. I said I would stand by it, and I am standing.',
    "Done, then. They will be bright, and kind, and not quite anyone's. Do not ask me if it was right. I said I would stand by it, and I am standing.",
    'We light real lanterns now. Oil, and wicks. The children think it is a game.',
    'It is fading. Slow. Tam says it is the weather. Let him.',
    'Rain by dusk, and the water brighter every night. Tam has stopped saying not yet.',
    'I keep hearing her when the Pool breathes. Imre. Sit down; you are standing like the news is bad.',
    'The three are up and walking. The girl walks at night now; she says it is easier.',
    // Mireya at camp
    'Sit down; I can see you favouring the left knee. No, there. Ask me whatever you have been not asking since the Causeway; I would rather it than the fire.',
    'No. That is the worst of it. It is warm, and it is kind, and my grandmother went into it smiling. Pain I could treat. Comfort I do not have a herb for.',
    'Because the moss grows better where you have been; I have no idea why and I want to. And because Wen said no to it, and I am tired of her saying no for all of us.',
    "Something that sees in the dark and does not feel the cold and forgets its mother's face in about a year. The elders call it chosen. I call it Tuesday. Go to sleep; the rain will be in by the second watch.",
    "My grandmother. Two of the lantern-boat's crew, before it sank. Sulis, who was a mother to half the village and is a hall full of lanterns now. It does not eat quickly. That is the kindness, and I hate it.",
    'It was a person. I keep coming back to that, nights. A healer, and she said yes to a thing only if the overflow went to living things, and we are the living things. I have been her overflow since I was born.',
    'I do not care what it is. I care what it leaks, and who it leaks into. If stopping the Breach stops the leak, then yes, and I will grieve the light after. Ask me what it is again and I will put you to bed.',
    'Wen knows what Tam knows and says less. She has cleansed people at that mat for forty years; she thinks the light is a gift because it has only ever been kind to her. She never asked it its name. I did. Go to sleep.',
    // Caelum in the Before
    "Master Thal has given me a message for the Spire Yard, for Mistress Aulde, and told me to walk, not run. I have never been told to walk before. Will you walk with me? I'd rather not carry it alone, and I don't know why.",
    "Across the Plaza, east, to the terrace. She'll be tuning; she is always tuning. Don't speak to her before she has read it, she doesn't like that.",
    "Then I'll walk it alone, and walk slowly, as he said. If you change your mind, the Yard is the east terrace.",
    "The east terrace. Walk; I'm not to run with it. He said walk twice, which he never does.",
    'Aulde has read it. She is still laughing, one note, with the paper against her chest; then she turns to the Spires, and the boy, and sings it to him as if he had asked.',
    "Begin at the ninth bell. That's all it said; I read it upside down on the stair, I'm not proud. She laughed. Why would she laugh at begin? You look like someone who knows what it begins.",
    'Fails. ...Thank you for not telling me it goes well. Everyone here tells me things go well.',
    'A joke. Yes. Masters have those. ...You looked at the Spires when you said it, not at me.',
    "I've a second message at dusk, up the Archive stair, and until then nobody will look for me. Let me walk with you. I'm Chrono-trained; Master Thal says I can buy a moment, which is a thing you look like you need.",
    "Then I'm yours till the bell. Don't let me run.",
    "At dusk, then. I'll be on the stair, three steps up, where I always am; you'll know me by the message.",
    "Still here, still nobody's till the bell. Take me with you; I've the stair at dusk and nothing before it, and I've never seen past the Walks.",
    'Good. Which way is past the Walks?',
    "You came in by a door nobody looks at, with Breach-eyes, and you know things; you knew what begin meant. What's on the far side of that door? Tell me, or show me. I'd rather be shown.",
    "After dusk. When I have the second message, then. ...I've never been through the Gate the wrong way. Nobody has.",
    "That's not no. I'll ask again; I remember the asking even when you don't.",
    "Last Bell, after dusk, at the Gate. I'll have the message by then. I'll walk, I promise; I'm not to run with it.",
    'He takes the message in both hands and steps up to the door beside you, and does not look back at the bells.',
    "I'm staying. Don't ask twice; I'd say yes the second time, and then who'd be on the stair.",
    "The dusk message at the ninth bell, up the Archive stair. I'll be three steps up. I'm always three steps up.",
    "Master Thal has a message for the Yard at noon. Find me at the Garret then, if you're still in the city; I'd like the company.",
    'You were here before the bells went back. You stood just there. Nobody else kept it. Why did I?',
    // Caelum in the present
    "Master Thal is in that. I worked it out on the Glowlands, from the way the light leans. He's been holding it since the stair, and he never— he doesn't know I didn't deliver it. I want to tell him. I want to speak to him, when it speaks.",
    "Let me. When the Nine ask through him, let me answer the one that's mine; Master Masque taught me the far side, I can answer that. And after, if he'll say anything to me, let me hear it.",
    "Thank you. I'll stand at your shoulder and I won't run.",
    "Then I'll stand behind you and say nothing, as I did on the stair.",
    "Support, if you'll have me there. I can buy you a moment in the hour; it's the errand, it's what I'm for.",
    'The chorus has gone under. What is left looks at the boy for a long moment, the way a man looks at a door he forgot he left open. A sound comes out of it that was once a laugh.',
    "He said it. He's never— Master Thal doesn't say that. ...I don't know what I say back. Tell me what you'd say.",
    '...I forgive you, Master Thal. For the stair, and the message, and the hour. Put it down when you can.',
    '...The hour hears it. I had not thought it would. Go on, Caelum. The stair is not the same stair.',
    'No. I did not think you would. That you said it to my face is more than the hour has given me.',
    "It's all older than my city. The stones, the dome, you. I keep waiting to be frightened and I'm only tired, which Master Masque says is the same thing arriving late.",
    "He heard me. I don't know what that's worth to a man who can't put anything down. Something, I think.",
    "I said it to his face. I'd say it again. ...I'd like him to be allowed to stop, all the same. Both are true; Master Masque says that's most things.",
    // Caelum at camp
    "I don't sleep much; I read. Master Thal says the Litany should be in me like my own name by the Conflux. ...May I ask you something I'm afraid of? You needn't answer.",
    "Does it go well? The Conflux. Everyone says it goes well and nobody says it the way people say things that go well. You don't have to answer. Your not answering is an answer; I'm not slow.",
    "Which? I have all but the ninth; he keeps that in his study and says it isn't finished. Go to sleep and I'll read quietly. I always do.",
    "What's left. ...I'd thought the city was the kind of thing that stays. Master Vane builds for a thousand years; he says so at dinner. Is his wall there? Don't tell me. Tell me.",
    "Put back. Yes. ...It had a maker's mark on it, the one on the buckle. Anso's. He's across the Plaza now, selling charms. He'll be dead a long time where you come from, and I've just held his buckle.",
    "Master Thal is in that thing. It's him; I know his voice under a chorus the way you'd know your father's under a crowd. He's been holding since I was on the stair. I want him allowed to stop. Is that a terrible thing to want for a teacher?",
    "Then I'll want it, and say so to his face if the hour lets me. He never let me finish a sentence in the Hall. He'll let me finish this one.",
    "He chose. He also sent a boy up a stair with a message he knew nobody would read, because he didn't want the boy in the room. I worked that out on the Glowlands. I'm not angry. I'm trying not to be.",
  ],
  /** The player's lines STORY gives (§13 the crossing). */
  storyChoices: ["It's five hundred years from now. It's what's left.", 'Come.', "Stay. It's your city."],
  choices: [
    "I'll bring them.",
    'I know what the light is. Tell me what you need.',
    'Not now.',
    'Come, then.',
    "I'll manage alone.",
    'Later.',
    "Hold her still. Don't let go.",
    "I can't look at that.",
    "I'll come.",
    'Listen.',
    'Imre Sallow. A healer, and a gardener. She agreed to it only if the overflow went to living things.',
    'Does it matter what she was called?',
    "I'll choose at the Pool.",
    'Not yet.',
    "It's their water. Ask Lanternreed.",
    "I'll decide.",
    'Dam it with the stable fragment.',
    'Dam it with the dead fragment.',
    'Let it run.',
    'Does it hurt? The light.',
    'Why come with me?',
    'What does it change you into?',
    'What has it eaten?',
    'Would you stop it, if you could?',
    'What does Wen know?',
    "I'll walk with you.",
    'The ritual. It begins at dusk, at the ninth bell, and it fails.',
    'A joke between masters. Nothing more.',
    'Walk with me, then.',
    'Deliver the dusk one first.',
    'Come with me.',
    "I'll show you. The Silver Gate, on Last Bell, after dusk.",
    "There's nothing there you'd want to see.",
    'Speak to him.',
    'Forgive him. He held the door five hundred years for a boy on a stair.',
    "You don't have to forgive him.",
    'Ask.',
    'Read me a verse instead.',
    "It's what's left of it.",
    'Put it back.',
    "It's the kindest thing you could want.",
    'He chose to hold it.',
  ],
  journals: [
    'Three Glow Moss and two bitterroot. The Reed Maze grows both; Fennick sells both. Bring them to Mireya.',
    'Mireya has her hands full and needs yours. Tend the sick with her at Lanternreed.',
    "The fever broke. A child's eyes have gone Mireling-green, and she says she can see the stars under the water.",
    'The Maze is behind you. The Pool is below Lanternreed, where the water breathes. Mireya has gone ahead.',
    'The Pool inhales for six heartbeats and exhales for six. Stand at the edge with Mireya and listen to it.',
    "The glow is a woman's breath, still leaking. Imre Sallow. Mireya has her name now, and does not know what to do with it.",
    'Wen sits on her mat and says no. Mireya says it is yours. A Heartstone fragment, stable or dead, would dam it; or let it run.',
    'The stable fragment sits in the well and the Pool breathes slower. The glow is fading. Some of the changed will sicken.',
    'The dead fragment took the light with it. The fen is going dark, and it will not come back.',
    'You let it run. The fen folk are brightening into something new, and Mireya has not said you chose right.',
    'Cross the Plaza of Bells at noon on Last Bell to the east terrace, where Aulde tunes the Spires.',
    'Aulde read it and laughed. Begin at the ninth bell. Stay with Caelum on the terrace; she is singing.',
    'The Spire has her verse and so do you. Caelum walks with you until the dusk message calls him.',
    'On Last Bell, once the dusk message is in his hand, bring Caelum to the Silver Gate and open the Breach-door from this side.',
    'The door is open on the far side of five hundred years. Let him look once, and let him choose.',
    'Caelum came through beside you with the dusk message still in his hand. Nobody delivered it. Nobody ever did.',
    'He stayed. It is his city, and he thanked you for asking. The cradle-pin, if the Mending needs it, is yours to set.',
    'The chorus has quieted. Veyran has one thing to say that he will not say to the living, and Caelum is not the living. Stay with him at the Apex.',
    'Caelum forgave him. Master Thal heard it, which is more than the hour has given him in five hundred years.',
    'Caelum could not forgive him, and said so to his face. Veyran accepted it. The Mending, if it comes, will be colder.',
  ],
  variants: [
    "Still here, still nobody's till the bell. You stand as if you expect me beside you; I don't know why, and I'd like to. Take me with you; I've the stair at dusk and nothing before it.",
    "You were here before the bells went back. I remember it; nobody else does. Master Korr looked at me as if I'd said the sky was green. You know what's on the far side of the door you came in by. Tell me, or show me; I'd rather be shown.",
  ],
  other: [
    'Mireya needs Glow Moss, bitterroot and a pair of steady hands for the sick of Lanternreed.',
    'Mireya is going to the Breathing Pool, where the glow is born, whatever Elder Wen says.',
    'Dam the leak at the Breathing Pool with a piece of the Heartstone, or let it run.',
    "Caelum carries Master Thal's noon message to the Spire Yard; walk with him across the Plaza.",
    'Caelum has asked what you know. Show him the present through the Breach-door and let him choose.',
    'Caelum wants to speak to Master Thal at the Apex, in communion. Let him.',
    '(You carry no stable Heartstone fragment)',
    '(You carry no dead Heartstone fragment)',
  ],
};

// ---- Played through the engine on the real pack ---------------------------------------------------------------------------------

describe('played on the real pack (makeState + play: the engine runs the scenes)', () => {
  const profileAt = (loop: number, echoes: string[] = []) => freshProfile({ loopCounter: loop, echoes });
  const at = (overrides: StateOverrides, loop = 2, echoes: string[] = []) => {
    const profile = profileAt(loop, echoes);
    return { s: makeState({ ...overrides, loop }, { content: pack, profile }), profile };
  };
  const talk = (npcId: string): Action => ({ type: 'talk', npcId });
  const pick = (choiceId: string): Action => ({ type: 'choose', choiceId });
  const go: Action = { type: 'continue' };
  const nodesSeen = (events: readonly GameEvent[]): string[] => events.flatMap((e) => (e.t === 'dialogueNode' ? [e.nodeId] : []));
  const lastSaid = (events: readonly GameEvent[]): { text: string } | undefined => [...events].reverse().find((e): e is Extract<GameEvent, { t: 'dialogueNode' }> => e.t === 'dialogueNode');
  const xpOf = (events: readonly GameEvent[]): number => events.reduce((t, e) => t + (e.t === 'xpGained' ? e.amount : 0), 0);
  const carries = (s: GameState, itemId: string): number => s.player.inventory.filter((i) => i.itemId === itemId).reduce((t, i) => t + i.qty, 0);
  const companion = (id: string, o: Partial<CompanionRunState> = {}): CompanionRunState => ({
    id, recruited: true, loyalty: 0, hp: 90, hpMax: 90, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {}, ...o,
  });
  /** The companion recruited and standing in the party. */
  const withCompanion = (id: string, o: Partial<CompanionRunState> = {}) => (s: GameState): void => {
    s.companions.recruited[id] = companion(id, o);
    s.companions.activeId = id;
  };
  const loyalty = (s: GameState, id: string): number | undefined => s.companions.recruited[id]?.loyalty;
  /** Inside the Before (D-095, D-102): the echo's day and hour, come by the Nexus door. */
  const inBefore = (day: 1 | 2 | 3, hour: 0 | 1 | 2 | 3, resets = 0) => (s: GameState): void => {
    s.before = { day, resets };
    s.clock.frozen = true;
    s.flags[`flag_before_day_${day}`] = true;
    s.flags['flag_entered_before_via_nexus'] = true;
    s.counters.custom['before_watch'] = hour;
    s.counters.custom['before_resets'] = resets;
  };
  const both = (...fs: ((s: GameState) => void)[]) => (s: GameState): void => fs.forEach((f) => f(s));

  test('Loop 1 at Lanternreed: her ask; the elders say what the light is, the quest moves on and she offers to come; she joins at 0; refused, she is asked again behind her waiting line', () => {
    const { s, profile } = at({ locationId: 'loc_lanternreed' }, 1);
    const opened = play(s, [talk('npc_mireya'), go], { content: pack, profile });
    expect([opened.state.dialogue?.sceneId, nodesSeen(opened.events)]).toEqual(['scene_mireya_lantern_offer', ['knees', 'three']]);
    // Loop 1: the Echo line is hidden (DESIGN §13.2: offered from Loop 2, greyed until held)
    expect(choiceViews(opened.state, pack, profile).map((v) => v.id)).toEqual(['yes', 'no']);
    const told = play(opened.state, [pick('yes'), go], { content: pack, profile });
    expect([told.state.quests.q_lantern_in_the_reeds?.stage, told.state.echoesThisLoop.includes('echo_glowlands_leak'), nodesSeen(told.events)]).toEqual(['gather', true, ['elders', 'hands']]);
    const joined = play(told.state, [pick('come'), go], { content: pack, profile });
    expect([joined.state.companions.activeId, loyalty(joined.state, 'mireya'), joined.state.mode]).toEqual(['mireya', 0, 'explore']);
    expect(nodesSeen(play(joined.state, [talk('npc_mireya')], { content: pack, profile }).events)).toEqual(['short']);
    const alone = play(told.state, [pick('alone'), go, talk('npc_mireya')], { content: pack, profile });
    expect([alone.state.companions.activeId, alone.state.dialogue?.sceneId, nodesSeen(alone.events).at(-1)]).toEqual([null, 'scene_mireya_recruit', 'gather']);
    // Hostile with the Remnants she is not offered (DESIGN §12.1)
    const hostile = at({ locationId: 'loc_lanternreed', reputation: { remnants: -40 }, quests: { q_lantern_in_the_reeds: 'gather' } }, 1);
    expect(play(hostile.s, [talk('npc_mireya')], { content: pack, profile: hostile.profile }).state.dialogue?.sceneId).toBe('scene_mireya_lantern_waiting');
    // Loop 2 with the Echo: the line is live and skips the telling; the quest opens at the gathering (its shortcut)
    const known = at({ locationId: 'loc_lanternreed' }, 2, ['echo_glowlands_leak']);
    const skipped = play(known.s, [talk('npc_mireya'), go, pick('known')], { content: pack, profile: known.profile });
    expect([skipped.state.quests.q_lantern_in_the_reeds?.stage, nodesSeen(skipped.events).at(-1)]).toEqual(['gather', 'hands']);
    // the bond (DESIGN §12.5): she starts at 25, and knows your hands
    const bond = at({ locationId: 'loc_lanternreed', quests: { q_lantern_in_the_reeds: 'gather' } }, 3, ['echo_mireya_bond']);
    const bonded = play(bond.s, [talk('npc_mireya'), go, pick('come'), go], { content: pack, profile: bond.profile });
    expect([nodesSeen(bonded.events)[0], loyalty(bonded.state, 'mireya')]).toEqual(['before', 25]);
  });

  test('the tending: the moss and the root taken, the child; steady hands → Mireya +3, +15 over the stages, 150 XP, three salves, Lanternreed trusts you; flinching −10 (clamped)', () => {
    const base = { locationId: 'loc_lanternreed', items: ['item_glow_moss', 'item_glow_moss', 'item_glow_moss', 'item_antidote_root', 'item_antidote_root'], quests: { q_lantern_in_the_reeds: 'gather' }, patch: withCompanion('mireya') };
    const { s, profile } = at(base, 1);
    const swept = play(s, [{ type: 'examine', target: { kind: 'location' } }], { content: pack, profile });
    expect([swept.state.quests.q_lantern_in_the_reeds?.stage, loyalty(swept.state, 'mireya')]).toEqual(['tend', 5]);
    const moss = carries(swept.state, 'item_glow_moss');
    const held = play(swept.state, [talk('npc_mireya'), go, go, pick('hold'), go], { content: pack, profile });
    expect(held.state.quests.q_lantern_in_the_reeds).toMatchObject({ status: 'completed', stage: 'tended' });
    expect(nodesSeen(held.events)).toEqual(['sit', 'child', 'stars', 'steady']);
    expect([carries(held.state, 'item_glow_moss'), carries(held.state, 'item_antidote_root'), carries(held.state, 'item_fenlight_salve')]).toEqual([moss - 3, 0, 3]);
    expect([loyalty(held.state, 'mireya'), xpOf(held.events), held.state.flags.flag_lanternreed_trusts]).toEqual([5 + 5 + 3 + 5, 150, true]);
    expect(nodesSeen(play(held.state, [talk('npc_mireya')], { content: pack, profile }).events)).toEqual(['fever']);
    const flinched = play(swept.state, [talk('npc_mireya'), go, go, pick('back'), go], { content: pack, profile });
    expect([flinched.state.quests.q_lantern_in_the_reeds?.stage, loyalty(flinched.state, 'mireya'), nodesSeen(flinched.events).at(-1)]).toEqual(['tended', 10, 'flinch']); // 5 − 10 → 0, +5 +5
    // without the moss she waits
    const short = at({ locationId: 'loc_lanternreed', quests: { q_lantern_in_the_reeds: 'tend' }, patch: withCompanion('mireya') }, 1);
    expect(nodesSeen(play(short.s, [talk('npc_mireya')], { content: pack, profile: short.profile }).events)).toEqual(['bring']);
  });

  test('the Pool: Wen’s No. in the offer at 25; the Listen gives verse VI, "It’s a person", `echo_breathing_pool`; her name +3; 250 XP; then the third offer at Loyal', () => {
    const offer = at({ locationId: 'loc_lanternreed', quests: { q_lantern_in_the_reeds: { status: 'completed', stage: 'tended' } }, patch: withCompanion('mireya', { loyalty: 30 }) });
    const asked = play(offer.s, [talk('npc_mireya'), go, go, pick('yes'), go], { content: pack, profile: offer.profile });
    expect([asked.state.dialogue, nodesSeen(asked.events), asked.state.quests.q_what_the_light_takes?.stage]).toEqual([null, ['born', 'anyway', 'going', 'maze'], 'forbidden']);
    expect(nodesSeen(play(asked.state, [talk('npc_mireya')], { content: pack, profile: offer.profile }).events)).toEqual(['maze_first']);
    const below = at({ locationId: 'loc_lanternreed', quests: { q_lantern_in_the_reeds: { status: 'completed', stage: 'tended' } }, patch: withCompanion('mireya', { loyalty: 20 }) });
    expect(play(below.s, [talk('npc_mireya')], { content: pack, profile: below.profile }).state.dialogue?.sceneId).toBe('scene_mireya_lanternreed');
    const pool = at({ locationId: 'loc_breathing_pool', quests: { q_what_the_light_takes: 'listen' }, patch: withCompanion('mireya', { loyalty: 40 }) });
    const heard = play(pool.s, [talk('npc_mireya'), pick('listen'), go, go, pick('sallow'), go], { content: pack, profile: pool.profile });
    expect(heard.state.quests.q_what_the_light_takes).toMatchObject({ status: 'completed', stage: 'heard' });
    expect(nodesSeen(heard.events)).toEqual(['edge', 'verse', 'person', 'name', 'carry']);
    for (const id of ['echo_litany_verse_6', 'echo_breathing_pool']) expect(heard.state.echoesThisLoop).toContain(id);
    expect([loyalty(heard.state, 'mireya'), xpOf(heard.events)]).toEqual([40 + 5 + 3 + 5, 250]);
    // Loyal: the third quest's offer at Lanternreed; below 50 only her line about the Pool
    const loyal = at({ locationId: 'loc_lanternreed', quests: { q_lantern_in_the_reeds: { status: 'completed', stage: 'tended' }, q_what_the_light_takes: { status: 'completed', stage: 'heard' } }, echoes: ['echo_breathing_pool'], patch: withCompanion('mireya', { loyalty: 55 }) });
    expect(play(loyal.s, [talk('npc_mireya')], { content: pack, profile: loyal.profile }).state.dialogue?.sceneId).toBe('scene_mireya_preserve_offer');
    const notYet = at({ locationId: 'loc_lanternreed', quests: { q_lantern_in_the_reeds: { status: 'completed', stage: 'tended' }, q_what_the_light_takes: { status: 'completed', stage: 'heard' } }, echoes: ['echo_breathing_pool'], patch: withCompanion('mireya', { loyalty: 45 }) });
    expect(nodesSeen(play(notYet.s, [talk('npc_mireya')], { content: pack, profile: notYet.profile }).events)).toEqual(['breath']);
  });

  test('the choice at the Pool: Lanternreed asked +3; the dam greyed without a fragment, takes one and grants `echo_glowfen_dammed` (dark with the dead one); let run grants its Echo; 400 XP; she never says you chose right', () => {
    const earlier = { q_lantern_in_the_reeds: { status: 'completed' as const, stage: 'tended' }, q_what_the_light_takes: { status: 'completed' as const, stage: 'heard' } };
    const base = { locationId: 'loc_breathing_pool', quests: { ...earlier, q_preserve_or_heal: 'choose' }, patch: withCompanion('mireya', { loyalty: 60 }) };
    // done, she goes home to Lanternreed (her schedule holds her at the Pool only while a quest runs)
    const home: Action = { type: 'move', to: 'loc_lanternreed' };
    const bare = at(base);
    const asked = play(bare.s, [talk('npc_mireya'), go, pick('ask_them'), go], { content: pack, profile: bare.profile });
    expect([nodesSeen(asked.events), loyalty(asked.state, 'mireya')]).toEqual([['mat', 'fen', 'village', 'choice'], 63]);
    expect(choiceViews(asked.state, pack, bare.profile).map((v) => [v.id, v.enabled])).toEqual([['dam', false], ['dam_dead', false], ['run', true]]);
    const ran = play(asked.state, [pick('run'), go, go], { content: pack, profile: bare.profile });
    expect(ran.state.quests.q_preserve_or_heal).toMatchObject({ status: 'completed', stage: 'let_run' });
    expect([ran.state.echoesThisLoop.includes('echo_glowfen_let_run'), xpOf(ran.events), loyalty(ran.state, 'mireya'), nodesSeen(ran.events).slice(-2)]).toEqual([true, 400, 63 + 5 + 5, ['runs', 'either_bright']]);
    expect(nodesSeen(play(ran.state, [home, talk('npc_mireya')], { content: pack, profile: bare.profile }).events)).toEqual(['brighter']);
    // with both fragments: the stable one dams, the dead one is left; the dead one dams dark
    const stocked = at({ ...base, items: ['item_heartstone_fragment_stable', 'item_heartstone_fragment_dead'] });
    const dammed = play(stocked.s, [talk('npc_mireya'), go, pick('mine'), pick('dam'), go, go], { content: pack, profile: stocked.profile });
    expect(dammed.state.quests.q_preserve_or_heal).toMatchObject({ status: 'completed', stage: 'dammed' });
    expect([carries(dammed.state, 'item_heartstone_fragment_stable'), carries(dammed.state, 'item_heartstone_fragment_dead'), dammed.state.echoesThisLoop.includes('echo_glowfen_dammed')]).toEqual([0, 1, true]);
    expect(nodesSeen(dammed.events).slice(-2)).toEqual(['slower', 'either_sicken']);
    const dark = play(stocked.s, [talk('npc_mireya'), go, pick('mine'), pick('dam_dead'), go, go], { content: pack, profile: stocked.profile });
    expect(dark.state.quests.q_preserve_or_heal).toMatchObject({ status: 'completed', stage: 'dammed_dark' });
    expect([carries(dark.state, 'item_heartstone_fragment_dead'), nodesSeen(dark.events).slice(-2)]).toEqual([0, ['dark', 'either_sicken']]);
    expect(nodesSeen(play(dark.state, [home, talk('npc_mireya')], { content: pack, profile: stocked.profile }).events)).toEqual(['went_dark']);
    // the two Echoes are exclusive in a loop (STORY §12)
    expect(dark.state.echoesThisLoop).not.toContain('echo_glowfen_let_run');
    for (const r of [ran, dammed, dark]) expect(/right/.test(lastSaid(r.events)?.text ?? '')).toBe(true);
  });

  test('Last Bell at noon at the Garret: the errand; the Plaza reaches the Yard; the verse, the honest answer +3, he joins and the outcome pays him 5; a lie costs 10; elsewhen he only hints', () => {
    const ROUTE = ['echo_before_route'];
    const garret = at({ locationId: 'loc_apprentices_garret', patch: inBefore(3, 1) }, 2, ROUTE);
    const asked = play(garret.s, [talk('npc_caelum'), pick('yes'), go], { content: pack, profile: garret.profile });
    expect([asked.state.dialogue, nodesSeen(asked.events), asked.state.quests.q_the_apprentices_errand?.stage]).toEqual([null, ['message', 'walk'], 'cross']);
    expect(nodesSeen(play(asked.state, [talk('npc_caelum')], { content: pack, profile: garret.profile }).events)).toEqual(['terrace']);
    const plaza = play(asked.state, [{ type: 'move', to: 'loc_plaza_of_bells' }], { content: pack, profile: garret.profile });
    expect([plaza.state.quests.q_the_apprentices_errand?.stage, plaza.state.echoesThisLoop.includes('echo_litany_verse_5')]).toEqual(['spire_yard', true]);
    const joined = play(plaza.state, [talk('npc_caelum'), go, go, pick('honest'), go, pick('walk'), go], { content: pack, profile: garret.profile });
    expect(joined.state.quests.q_the_apprentices_errand).toMatchObject({ status: 'completed', stage: 'joined' });
    expect(nodesSeen(joined.events)).toEqual(['read', 'verse', 'begin', 'fails', 'until_dusk', 'joined']);
    expect([joined.state.companions.activeId, loyalty(joined.state, 'caelum'), xpOf(joined.events)]).toEqual(['caelum', 5 + 5, 150]); // +3 before he joined is lost; the last stage's exit and the outcome pay him 5 each
    const lied = play(plaza.state, [talk('npc_caelum'), go, go, pick('lie'), go, pick('later'), go], { content: pack, profile: garret.profile });
    expect([lied.state.companions.activeId, nodesSeen(lied.events).slice(2), lied.state.quests.q_the_apprentices_errand?.status]).toEqual([null, ['begin', 'joke', 'until_dusk', 'later'], 'completed']);
    // sent away or turned down: at the Garret his second quest's ask comes first (the offer band), then he asks to come again
    const back = play(lied.state, [{ type: 'move', to: 'loc_apprentices_garret' }, talk('npc_caelum')], { content: pack, profile: garret.profile });
    expect([back.state.dialogue?.sceneId, nodesSeen(back.events)]).toEqual(['scene_caelum_boy_offer', ['door']]);
    const again = play(back.state, [pick('show'), go, talk('npc_caelum'), pick('come'), go], { content: pack, profile: garret.profile });
    expect([nodesSeen(again.events), again.state.companions.activeId, again.state.quests.q_a_boy_from_a_doomed_city?.stage]).toEqual([['after_dusk', 'nobodys', 'good'], 'caelum', 'door']);
    // Second Bell, or Last Bell at dawn: no errand yet
    const early = at({ locationId: 'loc_apprentices_garret', patch: inBefore(2, 1) });
    expect(nodesSeen(play(early.s, [talk('npc_caelum')], { content: pack, profile: early.profile }).events)).toEqual(['holding']);
    const dawn = at({ locationId: 'loc_apprentices_garret', patch: inBefore(3, 0) });
    expect(nodesSeen(play(dawn.s, [talk('npc_caelum')], { content: pack, profile: dawn.profile }).events)).toEqual(['noon_message']);
    const reset = at({ locationId: 'loc_apprentices_garret', patch: inBefore(1, 0, 1) });
    expect(nodesSeen(play(reset.s, [talk('npc_caelum')], { content: pack, profile: reset.profile }).events)).toEqual(['again']);
  });

  test('the crossing: what you know at the Garret; the Gate on Last Bell after dusk with him opens the door; the Library seen +3; come → his Echo, 250 XP, he walks out with you; stay → his other Echo, he leaves the party', () => {
    // Last Bell at noon at the Garret (at dusk his schedule takes him up the Archive stair)
    const base = { quests: { q_the_apprentices_errand: { status: 'completed' as const, stage: 'joined' } }, patch: both(inBefore(3, 1), withCompanion('caelum', { loyalty: 20 })) };
    const garret = at({ ...base, locationId: 'loc_apprentices_garret' });
    const shown = play(garret.s, [talk('npc_caelum'), pick('show'), go], { content: pack, profile: garret.profile });
    expect([nodesSeen(shown.events), shown.state.quests.q_a_boy_from_a_doomed_city?.stage, loyalty(shown.state, 'caelum')]).toEqual([['door', 'after_dusk'], 'door', 25]);
    // a short rest on the Garret's cot passes the echo's hour to dusk (before.ts); then the Walks and the Gate
    const dusk = play(shown.state, [{ type: 'rest', kind: 'short' }], { content: pack, profile: garret.profile });
    expect([dusk.state.before?.day, dusk.state.quests.q_a_boy_from_a_doomed_city?.stage]).toEqual([3, 'door']);
    const gate = play(dusk.state, [{ type: 'move', to: 'loc_outer_walks' }, { type: 'move', to: 'loc_silver_gate' }], { content: pack, profile: garret.profile });
    expect(gate.state.quests.q_a_boy_from_a_doomed_city?.stage).toBe('glimpse');
    const came = play(gate.state, [talk('npc_caelum'), go, pick('five_hundred'), go, go, pick('come'), go], { content: pack, profile: garret.profile });
    expect(came.state.quests.q_a_boy_from_a_doomed_city).toMatchObject({ status: 'completed', stage: 'crossed' });
    expect(nodesSeen(came.events)).toEqual(['library', 'carrel', 'city', 'nobody', 'come', 'through']);
    expect([came.state.echoesThisLoop.includes('echo_caelum_unanchored'), loyalty(came.state, 'caelum'), xpOf(came.events), came.state.companions.activeId]).toEqual([true, 25 + 5 + 3 + 5 + 5, 250, 'caelum']);
    // out through the door: the present, with him; he stands at the Nexus now and nowhere in the Before
    const out = play(came.state, [{ type: 'move', to: 'loc_chronos_nexus' }], { content: pack, profile: garret.profile });
    expect([out.state.before, out.state.companions.activeId, npcsAt(out.state, pack, garret.profile, 'loc_chronos_nexus').includes('npc_caelum')]).toEqual([null, 'caelum', true]);
    const stayed = play(gate.state, [talk('npc_caelum'), go, pick('five_hundred'), go, go, pick('stay'), go], { content: pack, profile: garret.profile });
    expect(stayed.state.quests.q_a_boy_from_a_doomed_city).toMatchObject({ status: 'completed', stage: 'stayed' });
    expect([stayed.state.echoesThisLoop.includes('echo_caelum_stayed'), stayed.state.companions.recruited.caelum, nodesSeen(stayed.events).at(-1)]).toEqual([true, undefined, 'it_is']);
    // stayed, he keeps his dusk on the Archive stair (his schedule), and says so
    expect([npcsAt(stayed.state, pack, garret.profile, 'loc_silver_gate').includes('npc_caelum'), npcsAt(stayed.state, pack, garret.profile, 'loc_archives_of_danthe').includes('npc_caelum')]).toEqual([false, true]);
    const stair = at({ locationId: 'loc_archives_of_danthe', quests: { ...base.quests, q_a_boy_from_a_doomed_city: { status: 'completed', stage: 'stayed' } }, patch: inBefore(3, 2) });
    expect(nodesSeen(play(stair.s, [talk('npc_caelum')], { content: pack, profile: stair.profile }).events)).toEqual(['staying']);
    // by day the door waits, and he says so
    const day = at({ ...base, locationId: 'loc_silver_gate', quests: { ...base.quests, q_a_boy_from_a_doomed_city: 'door' }, patch: both(inBefore(3, 1), withCompanion('caelum')) });
    expect(nodesSeen(play(day.s, [{ type: 'examine', target: { kind: 'location' } }, talk('npc_caelum')], { content: pack, profile: day.profile }).events)).toEqual(['gate']);
    expect(day.s.quests.q_a_boy_from_a_doomed_city?.stage).toBe('door');
    // the Mending running without the pin set: not offered (STORY: the pin is set before he crosses)
    // (q_the_mending is U58's and not in the pack yet: its state is written by hand)
    const mending = at({ ...base, locationId: 'loc_apprentices_garret', patch: both(base.patch, (s) => {
      s.quests['q_the_mending'] = { status: 'active', stage: 'anchor_the_conflux', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] };
    }) });
    expect(play(mending.s, [talk('npc_caelum')], { content: pack, profile: mending.profile }).state.dialogue?.sceneId).toBe('scene_caelum_garret');
  });

  test('in the present, crossed and Loyal: the ask at the Nexus +3; the communion through with him beside you; the one thing; forgives → his Echo, 400 XP; cannot → the other', () => {
    const crossed = { q_a_boy_from_a_doomed_city: { status: 'completed' as const, stage: 'crossed' } };
    const nexus = at({ locationId: 'loc_chronos_nexus', quests: crossed, patch: withCompanion('caelum', { loyalty: 55 }) }, 3, ['echo_caelum_unanchored']);
    const asked = play(nexus.s, [talk('npc_caelum'), go, pick('yes'), go], { content: pack, profile: nexus.profile });
    expect([asked.state.dialogue?.sceneId, nodesSeen(asked.events), asked.state.quests.q_his_masters_sin?.stage, loyalty(asked.state, 'caelum')]).toEqual([undefined, ['in_it', 'let_me', 'shoulder'], 'let_him', 58]);
    expect(nodesSeen(play(asked.state, [talk('npc_caelum')], { content: pack, profile: nexus.profile }).events)).toEqual(['support']);
    // not Loyal, or not crossed this loop (the Echo from an earlier loop): only his line
    const cool = at({ locationId: 'loc_chronos_nexus', quests: crossed, patch: withCompanion('caelum', { loyalty: 40 }) }, 3, ['echo_caelum_unanchored']);
    expect(nodesSeen(play(cool.s, [talk('npc_caelum')], { content: pack, profile: cool.profile }).events)).toEqual(['older']);
    // the Apex after the communion: the stage swept on, the one thing
    const apex = at({ locationId: 'loc_temporal_breach_apex', quests: { ...crossed, q_his_masters_sin: 'let_him' }, flags: { flag_tyrant_spared: true }, patch: withCompanion('caelum', { loyalty: 58 }) }, 3, ['echo_caelum_unanchored', 'echo_tyrant_speaks']);
    const look: Action = { type: 'examine', target: { kind: 'location' } };
    const swept = play(apex.s, [look], { content: pack, profile: apex.profile });
    expect(swept.state.quests.q_his_masters_sin?.stage).toBe('sorry');
    const forgave = play(swept.state, [talk('npc_caelum'), go, go, go, go, pick('forgive'), go, go], { content: pack, profile: apex.profile });
    expect(forgave.state.quests.q_his_masters_sin).toMatchObject({ status: 'completed', stage: 'forgiven' });
    expect(nodesSeen(forgave.events)).toEqual(['quiet', 'did_you', 'nobody_did', 'sorry', 'say_back', 'forgives', 'heard']);
    expect([forgave.state.echoesThisLoop.includes('echo_caelum_forgives'), xpOf(forgave.events), loyalty(forgave.state, 'caelum')]).toEqual([true, 400, 58 + 5 + 5 + 5]);
    expect(nodesSeen(play(forgave.state, [talk('npc_caelum')], { content: pack, profile: apex.profile }).events)).toEqual(['he_heard']);
    const cannot = play(swept.state, [talk('npc_caelum'), go, go, go, go, pick('cannot'), go, go], { content: pack, profile: apex.profile });
    expect(cannot.state.quests.q_his_masters_sin).toMatchObject({ status: 'completed', stage: 'cannot' });
    expect([cannot.state.echoesThisLoop.includes('echo_caelum_cannot'), cannot.state.echoesThisLoop.includes('echo_caelum_forgives'), nodesSeen(cannot.events).slice(-2)]).toEqual([true, false, ['cannot', 'to_my_face']]);
    expect(nodesSeen(play(cannot.state, [talk('npc_caelum')], { content: pack, profile: apex.profile }).events)).toEqual(['said_it']);
    // without him beside you the ask waits
    const alone = at({ locationId: 'loc_temporal_breach_apex', quests: { ...crossed, q_his_masters_sin: 'let_him' }, flags: { flag_tyrant_spared: true } }, 3, ['echo_caelum_unanchored']);
    expect(play(alone.s, [look], { content: pack, profile: alone.profile }).state.quests.q_his_masters_sin?.stage).toBe('let_him');
  });

  test('camp conversations: a full rest with Mireya opens the first (+2), the second needs 25, the third 50 and the Pool heard; Caelum alike at the Garret, his third once crossed', () => {
    const rest: Action = { type: 'rest', kind: 'full' };
    const first = at({ locationId: 'loc_lanternreed', patch: withCompanion('mireya') });
    const one = play(first.s, [rest], { content: pack, profile: first.profile });
    expect([one.state.dialogue?.sceneId, loyalty(one.state, 'mireya')]).toEqual(['scene_mireya_camp_1', 2]);
    expect(choiceViews(one.state, pack, first.profile).map((v) => v.id)).toEqual(['hurt', 'why']);
    const done = play(one.state, [pick('hurt'), go], { content: pack, profile: first.profile });
    expect([done.state.mode, nodesSeen(done.events)]).toEqual(['explore', ['hurts']]);
    expect(play(done.state, [rest], { content: pack, profile: first.profile }).state.mode).toBe('explore');
    const second = at({ locationId: 'loc_lanternreed', flags: { flag_scene_done_scene_mireya_camp_1: true }, patch: withCompanion('mireya', { loyalty: 30 }) });
    const two = play(second.s, [rest, pick('eaten')], { content: pack, profile: second.profile });
    expect([two.state.dialogue?.sceneId, nodesSeen(two.events)]).toEqual(['scene_mireya_camp_2', ['preserve', 'slowly']]);
    const unheard = at({ locationId: 'loc_lanternreed', flags: { flag_scene_done_scene_mireya_camp_1: true, flag_scene_done_scene_mireya_camp_2: true }, patch: withCompanion('mireya', { loyalty: 60 }) });
    expect(play(unheard.s, [rest], { content: pack, profile: unheard.profile }).state.mode).toBe('explore');
    const heard = at({ locationId: 'loc_lanternreed', flags: { flag_scene_done_scene_mireya_camp_1: true, flag_scene_done_scene_mireya_camp_2: true }, quests: { q_what_the_light_takes: { status: 'completed', stage: 'heard' } }, patch: withCompanion('mireya', { loyalty: 60 }) });
    const three = play(heard.s, [rest, pick('stop')], { content: pack, profile: heard.profile });
    expect([three.state.dialogue?.sceneId, nodesSeen(three.events)]).toEqual(['scene_mireya_camp_3', ['person', 'leaks']]);
    // Caelum under the eaves: the Garret's night brings the next Bell and his first conversation
    const cot = at({ locationId: 'loc_apprentices_garret', patch: both(inBefore(1, 0), withCompanion('caelum')) });
    const night = play(cot.s, [rest, pick('ask')], { content: pack, profile: cot.profile });
    expect([night.state.dialogue?.sceneId, nodesSeen(night.events), night.state.before?.day, loyalty(night.state, 'caelum')]).toEqual(['scene_caelum_camp_1', ['cot', 'goes_well'], 2, 2]);
    const held = at({ locationId: 'loc_apprentices_garret', flags: { flag_scene_done_scene_caelum_camp_1: true }, patch: both(inBefore(1, 0), withCompanion('caelum', { loyalty: 25 })) });
    expect(nodesSeen(play(held.s, [rest, pick('back'), go], { content: pack, profile: held.profile }).events)).toEqual(['pack', 'buckle']);
    const present = at({ locationId: 'loc_chronos_nexus', flags: { flag_scene_done_scene_caelum_camp_1: true, flag_scene_done_scene_caelum_camp_2: true }, quests: { q_a_boy_from_a_doomed_city: { status: 'completed', stage: 'crossed' } }, patch: withCompanion('caelum', { loyalty: 50 }) });
    expect(nodesSeen(play(present.s, [rest, pick('chose'), go], { content: pack, profile: present.profile }).events)).toEqual(['teacher', 'not_angry']);
  });
});
