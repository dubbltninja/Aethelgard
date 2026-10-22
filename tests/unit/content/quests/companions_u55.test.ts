// U55: Nyx's and Dask's arc quests, their scenes and camp conversations (src/content/shared/{quests,dialogues}/companions_u55.ts),
// held to their sources read at test time: STORY (§11.1's table, §11.4's blocks, §13's two key scenes, §5.2 / §6.4 / §7.3 /
// §7.4 / §10.7's lines), DESIGN (§6.2 the arc tiers, §12.1 recruitment, §12.5 loyalty and its thresholds, §12.7 camp
// conversations, §12.8 Dask's places) and the conventions of the two barrel headers (U52's pattern, D-105, D-109). Then the
// scenes are played through the engine on the real pack (makeState + play) for what the numbers do, and the two NPC schedules
// (D-102) are checked for where the companions stand while their quests run.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { companions } from '@content/shared/companions';
import { gameConfig } from '@content/shared/config';
import { dialogues as RAW_SCENES } from '@content/shared/dialogues/companions_u55';
import { FROM_LOOP_2, LOYALTY_AGAINST, LOYALTY_ALIGNED, NOT_IN_HORDE, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { quests as RAW_QUESTS } from '@content/shared/quests/companions_u55';
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

const NYX_QUESTS = ['q_tears_of_the_breach', 'q_the_dark_between', 'q_what_she_would_undo'];
const DASK_QUESTS = ['q_the_flickering_man', 'q_seven_marks', 'q_the_last_instant'];
const QUEST_IDS = [...NYX_QUESTS, ...DASK_QUESTS];
const SCENE_IDS = [
  'scene_nyx_deja_vu',
  'scene_nyx_walk_with_me',
  'scene_nyx_walk_with_me_again',
  'scene_nyx_tears_offer',
  'scene_nyx_tears_waiting',
  'scene_nyx_tears_reading',
  'scene_nyx_dark_between_offer',
  'scene_nyx_unmasking',
  'scene_nyx_undo_offer',
  'scene_nyx_undo_plan',
  'scene_nyx_sanctum_eye',
  'scene_nyx_chasm',
  'scene_nyx_camp_1',
  'scene_nyx_camp_2',
  'scene_nyx_camp_3',
  'scene_dask_introduction',
  'scene_dask_recruit',
  'scene_dask_moment_spires',
  'scene_dask_moment_plateau',
  'scene_dask_moment_nexus',
  'scene_dask_flickering_man_waiting',
  'scene_dask_flickering_man_sentence',
  'scene_dask_last_instant_offer',
  'scene_dask_last_instant_waiting',
  'scene_dask_last_instant_choice',
  'scene_dask_pass',
  'scene_dask_shore',
  'scene_dask_seven_marks_offer',
  'scene_dask_seven_marks_waiting',
  'scene_dask_seven_marks_symptom',
  'scene_dask_seven_marks_eighth',
  'scene_dask_camp_1',
  'scene_dask_camp_2',
  'scene_dask_camp_3',
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
const S125 = DESIGN_SECTION('### 12.5 Loyalty', '### 12.6');

/** The rep deltas of an effect list (onlyIf included), faction → delta. */
function repOf(effects: readonly Effect[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of effects) {
    if ('rep' in e) out[e.rep.faction] = (out[e.rep.faction] ?? 0) + e.rep.delta;
    if ('onlyIf' in e) for (const [f, d] of Object.entries(repOf(e.onlyIf.effects))) out[f] = (out[f] ?? 0) + d;
  }
  return out;
}
const loyaltyOf = (effects: readonly Effect[]): Record<string, number> =>
  Object.fromEntries(effects.flatMap((e) => ('loyalty' in e ? [[e.loyalty.companion, e.loyalty.delta] as const] : [])));
const has = (effects: readonly Effect[], effect: Effect): boolean => effects.some((e) => JSON.stringify(e) === JSON.stringify(effect));
const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const last = (effects: readonly Effect[]): Effect | undefined => effects.at(-1);
/** The `questAdvance` an outcome choice ends with, plain or (the unmasking) inside `onlyIf` while the quest runs. */
const advanceOf = (effects: readonly Effect[]): Effect | undefined => {
  const e = last(effects);
  return e !== undefined && 'onlyIf' in e ? last(e.onlyIf.effects) : e;
};

// ---- Where each decision lives ---------------------------------------------------------------------------------------------------

const WHOSE = choice('scene_nyx_tears_reading', 'torn', 'whose').effects;
const SAFE = choice('scene_nyx_unmasking', 'veyran', 'safe').effects;
const CHOIR = choice('scene_nyx_unmasking', 'veyran', 'choir').effects;
const PLAN = choice('scene_nyx_unmasking', 'veyran', 'plan');
const AGREED = choice('scene_nyx_undo_plan', 'sixth', 'agreed').effects;
const TRUTH = choice('scene_nyx_undo_plan', 'sixth', 'truth');
const REFUSED = choice('scene_nyx_undo_plan', 'sixth', 'refused').effects;
const REST = choice('scene_dask_last_instant_choice', 'one_thing', 'rest').effects;
const STAY = choice('scene_dask_last_instant_choice', 'one_thing', 'stay').effects;
const I_KNOW = choice('scene_nyx_deja_vu', 'stirs', 'i_know');

// ---- The quests -----------------------------------------------------------------------------------------------------------------

describe('the six arc quests (STORY §11.1, §11.4; DESIGN §6.2)', () => {
  const table = STORY.slice(STORY.indexOf('### 11.1 Table'), STORY.indexOf('### 11.2'));
  const row = (id: string): string[] => need(table.split('\n').find((l) => l.startsWith(`| \`${id}\``)), id).split('|').map((c) => c.trim());

  test('all six are registered as companion quests, in STORY order, with STORY’s names, givers, the companion, and Loop 2+', () => {
    expect(arcQuests.map((q) => q.id)).toEqual(QUEST_IDS);
    expect(companions.find((c) => c.id === 'nyx')?.arcQuestIds).toEqual(NYX_QUESTS);
    expect(companions.find((c) => c.id === 'dask')?.arcQuestIds).toEqual(DASK_QUESTS);
    for (const id of QUEST_IDS) {
      const q = quest(id);
      const r = row(id);
      const who = NYX_QUESTS.includes(id) ? 'nyx' : 'dask';
      expect([id, q.name, q.category, q.giverNpcId, q.companionId]).toEqual([id, r[2], 'companion', `npc_${who}`, who]);
      expect([id, r[4]]).toEqual([id, who === 'nyx' ? 'Nyx' : 'Dask']);
      expect([id, (r[6] ?? '').startsWith('2+')]).toEqual([id, true]);
      expect([id, q.factionId]).toEqual([id, who === 'nyx' ? 'weavers' : undefined]);
      expect([id, q.startWhen, q.legacyId]).toEqual([id, undefined, undefined]);
    }
    // STORY "Bots: all … Pacifist." → pacifist; "X P S" / "X P" → explorer
    for (const id of ['q_tears_of_the_breach', 'q_the_dark_between', 'q_what_she_would_undo', 'q_the_last_instant']) expect([id, quest(id).botHint]).toEqual([id, 'pacifist']);
    for (const id of ['q_the_flickering_man', 'q_seven_marks']) expect([id, quest(id).botHint]).toEqual([id, 'explorer']);
  });

  test('prereqs: STORY §11.4’s givers and Echoes, DESIGN §12.5’s loyalty thresholds (arc stage 2 at 25, stage 3 at 50)', () => {
    expect(S125).toContain('25 → camp conversation 2 and the companion\'s arc stage 2 available; 50 → arc stage 3');
    expect(quest('q_tears_of_the_breach').availableWhen).toEqual({ all: [FROM_LOOP_2, { quest: { id: 'q_void_shards', stage: 'given' } }] });
    expect(storyBlock('q_tears_of_the_breach')).toContain('Giver: Nyx after `q_void_shards` (given). Voidscar. Prereq: `{ loop: { min: 2 } }`.');
    expect(quest('q_the_dark_between').availableWhen).toEqual({
      all: [FROM_LOOP_2, { any: [{ quest: { id: 'q_tears_of_the_breach', status: 'completed' } }, { echo: 'echo_nine_voices' }] }, { loyalty: { companion: 'nyx', min: 25 } }],
    });
    expect(storyBlock('q_the_dark_between')).toContain('Giver: Nyx, Loop 2+, after `q_tears_of_the_breach` or with `echo_nine_voices`; Nyx loyalty ≥ 25.');
    expect(quest('q_what_she_would_undo').availableWhen).toEqual({ all: [{ echo: 'echo_nyx_is_of_the_nine' }, { loyalty: { companion: 'nyx', min: 50 } }] });
    expect(storyBlock('q_what_she_would_undo')).toContain('Giver: Nyx. Prereq: `echo_nyx_is_of_the_nine`; Nyx Loyal.');
    expect(quest('q_the_flickering_man').availableWhen).toEqual(FROM_LOOP_2);
    expect(storyBlock('q_the_flickering_man')).toContain('Giver: Dask, Shimmering Pass, Loop 2+.');
    // the Threshold's state is the next loop's (D-082): "Dask loyalty ≥ 25" is the bond Echo, or his arc's first Echo
    expect(quest('q_seven_marks').availableWhen).toEqual({ all: [{ loop: { min: 3 } }, { echo: 'echo_threshold' }, { any: [{ echo: 'echo_dask_bond' }, { echo: 'echo_flickering_man' }] }] });
    expect(storyBlock('q_seven_marks')).toContain('Giver: Dask at the Threshold or the High Mark. Prereq: `echo_threshold`; Dask loyalty ≥ 25.');
    expect(S125).toContain('`echo_dask_bond`');
    expect(quest('q_seven_marks').repeatablePerLoop).toBe(false); // D-067.15: it belongs to the profile
    expect(storyBlock('q_seven_marks')).toContain('The quest belongs to the profile and survives the Far Light');
    expect(quest('q_the_last_instant').availableWhen).toEqual({ all: [{ echo: 'echo_tyrant_speaks' }, { loyalty: { companion: 'dask', min: 50 } }] });
    expect(storyBlock('q_the_last_instant')).toContain('Giver: Dask. Prereq: `echo_tyrant_speaks`; Dask Loyal; at the Apex in communion.');
    for (const id of QUEST_IDS.filter((q) => q !== 'q_seven_marks')) expect([id, quest(id).repeatablePerLoop]).toEqual([id, true]);
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

  test('DESIGN §6.2 tier XP: an arc’s first quest pays 150, its second 250, its third 400; STORY’s rewards: a Void Shard, the Scout Badge, 10 Resonance', () => {
    expect(DESIGN).toContain('companion arc 150/250/400');
    for (const [a, b, c] of [NYX_QUESTS, DASK_QUESTS]) expect([quest(a as string).rewards.xp, quest(b as string).rewards.xp, quest(c as string).rewards.xp]).toEqual([150, 250, 400]);
    expect(quest('q_tears_of_the_breach').rewards.items).toEqual([{ itemId: 'item_void_shard', count: 1 }]);
    expect(storyBlock('q_tears_of_the_breach')).toContain('Rewards. one Void Shard.');
    expect(quest('q_the_flickering_man').rewards.items).toEqual([{ itemId: 'item_dasks_scout_badge', count: 1 }]);
    expect(storyBlock('q_the_flickering_man')).toContain("Rewards. Dask's Scout Badge (Chrono resist)");
    expect(quest('q_seven_marks').rewards.resonance).toBe(10);
    expect(storyBlock('q_seven_marks')).toContain('Rewards. 10 Resonance.');
    for (const id of ['q_the_dark_between', 'q_what_she_would_undo', 'q_the_last_instant']) {
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
  });

  test('the stage graphs: a stage a scene ends waits (no required objective, a plain next); every decision ends with the questAdvance into its outcome; the objectives', () => {
    const waits: [string, string][] = [
      ['q_tears_of_the_breach', 'read'],
      ['q_the_dark_between', 'names'],
      ['q_what_she_would_undo', 'plan'],
      ['q_what_she_would_undo', 'heard'],
      ['q_the_flickering_man', 'sentence'],
      ['q_seven_marks', 'six_known'],
      ['q_seven_marks', 'marks_seen'],
      ['q_seven_marks', 'high_mark'],
      ['q_the_last_instant', 'gathered'],
    ];
    for (const [questId, stageId] of waits) {
      const st = stage(questId, stageId);
      expect([questId, stageId, st.objectives.filter((o) => !o.optional).length, typeof st.next, st.advanceWhen]).toEqual([questId, stageId, 0, 'string', undefined]);
    }
    const ends: [readonly Effect[], string, string][] = [
      [WHOSE, 'q_tears_of_the_breach', 'unanswered'],
      [SAFE, 'q_the_dark_between', 'kept'],
      [CHOIR, 'q_the_dark_between', 'told'],
      [AGREED, 'q_what_she_would_undo', 'agreed'],
      [TRUTH.effects, 'q_what_she_would_undo', 'refused_truth'],
      [REFUSED, 'q_what_she_would_undo', 'refused'],
      [REST, 'q_the_last_instant', 'rests'],
      [STAY, 'q_the_last_instant', 'stays'],
    ];
    for (const [effects, questId, stageId] of ends) {
      expect([questId, stageId, advanceOf(effects)]).toEqual([questId, stageId, { questAdvance: { quest: questId, stage: stageId } }]);
      expect([questId, stageId, stage(questId, stageId).outcome]).toEqual([questId, stageId, 'complete']);
    }
    // the unmasking opens from the Chasm too (the Crystal route): its advance waits for the quest to be running
    for (const effects of [SAFE, CHOIR]) expect((last(effects) as { onlyIf: { when: Condition } }).onlyIf.when).toEqual({ quest: { id: 'q_the_dark_between', status: 'active' } });
    // the passes a scene drives from inside: the plan heard, the whole sentence, the symptom, the eighth frame
    expect(node('scene_nyx_undo_plan', 'door').onEnter).toEqual([{ grantEcho: 'echo_what_she_would_undo' }, { questAdvance: { quest: 'q_what_she_would_undo', stage: 'heard' } }]);
    expect(node('scene_dask_flickering_man_sentence', 'whole').onEnter).toEqual([{ grantEcho: 'echo_flickering_man' }, { questAdvance: { quest: 'q_the_flickering_man', stage: 'heard' } }]);
    expect(node('scene_dask_seven_marks_symptom', 'symptom').onEnter).toEqual([{ grantEcho: 'echo_wayfinder_symptom' }, { questAdvance: { quest: 'q_seven_marks', stage: 'high_mark' } }]);
    expect(node('scene_dask_seven_marks_eighth', 'blank').onEnter).toEqual([{ questAdvance: { quest: 'q_seven_marks', stage: 'eighth_blank' } }]);
    expect(stage('q_seven_marks', 'eighth_blank').outcome).toBe('complete');
    // objectives: a Shard at the Chasm's edge at night; Where She Fell; his three moments (their scenes done, C-58); the communion through with Dask
    expect(stage('q_tears_of_the_breach', 'shard_at_night').objectives.map((o) => o.when)).toEqual([{ item: { id: 'item_void_shard' } }, { all: [{ location: 'loc_chasm_of_whispers' }, { watch: 'night' }] }]);
    expect(storyBlock('q_tears_of_the_breach')).toContain("Bring one to the Chasm's edge at night.");
    expect(stage('q_the_dark_between', 'asked_in').objectives.map((o) => o.when)).toEqual([{ location: 'loc_where_she_fell' }]);
    for (const place of ['spires', 'plateau', 'nexus']) expect([place, stage('q_the_flickering_man', place).objectives.map((o) => o.when)]).toEqual([place, [{ flag: `flag_scene_done_scene_dask_moment_${place}` }]]);
    expect(storyBlock('q_the_flickering_man')).toContain('2–4. Moments at the Spires, the Plateau, the Nexus (each: approach, Listen).');
    expect(stage('q_the_last_instant', 'ask_it').objectives.map((o) => o.when)).toEqual([{ flag: 'flag_tyrant_spared' }, { companion: { id: 'dask' } }]);
    expect(storyBlock('q_the_last_instant')).toContain('2. In Movement III, ask. 3. Dask chooses (7.4 A/B).');
    // no quest opens a scene (the barrel's rule)
    for (const q of arcQuests) expect([q.id, JSON.stringify(q.stages).includes('startDialogue')]).toEqual([q.id, false]);
  });

  test('the Gallery of Loops advances Seven Marks (the Threshold’s `ev_gallery_marks`: the seven marks seen, `echo_seven_wayfinders`)', () => {
    const ev = need(pack.locations['loc_gallery_of_loops']?.events.find((e) => e.id === 'ev_gallery_marks'), 'ev_gallery_marks');
    expect(ev.when).toEqual({ all: [{ loop: { min: 3 } }, { quest: { id: 'q_seven_marks', status: 'active' } }] });
    expect(ev.effects).toEqual([{ grantEcho: 'echo_seven_wayfinders' }, { questAdvance: { quest: 'q_seven_marks', stage: 'marks_seen' } }]);
    expect(storyBlock('q_seven_marks')).toContain('2. Find the marks in the Gallery of Loops (they are the Gallery\'s first seven frames).');
    expect(storyBlock('q_seven_marks')).toContain('Consequences. `echo_seven_wayfinders`, `echo_wayfinder_symptom`');
  });

  test('rule 18 is met for Nyx and Dask (each arc has two outcomes), and rule 15/16 pending counts fell: the arcs’ Echoes are granted', () => {
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(strict.errors).toEqual([]);
    expect(strict.warnings.filter((w) => w.rule === 'rule-18' && (w.id === 'nyx' || w.id === 'dask'))).toEqual([]);
    const granted = new Set(strict.warnings.filter((w) => w.rule === 'rule-16' && w.message.includes('no grantEcho')).map((w) => w.id));
    for (const id of ['echo_shard_moments', 'echo_nyx_is_of_the_nine', 'echo_litany_verse_8', 'echo_tyrant_name', 'echo_choir_knows', 'echo_what_she_would_undo', 'echo_void_resonance', 'echo_flickering_man', 'echo_seven_wayfinders', 'echo_wayfinder_symptom', 'echo_dask_rest']) {
      expect([id, granted.has(id)]).toEqual([id, false]);
    }
    const idle = new Set(strict.warnings.filter((w) => w.rule === 'rule-16' && w.message.includes('gates nothing')).map((w) => w.id));
    for (const id of ['echo_shard_moments', 'echo_choir_knows', 'echo_what_she_would_undo', 'echo_nyx_bond', 'echo_dask_bond', 'echo_flickering_man', 'echo_wayfinder_symptom', 'echo_threshold', 'echo_tyrant_speaks']) {
      expect([id, idle.has(id)]).toEqual([id, false]);
    }
    expect(strict.warnings.filter((w) => w.rule === 'rule-16').length).toBeLessThanOrEqual(66); // 75 before U55
    // `flag_named_nyx` (D-100) is set by the line that names her
    expect(strict.warnings.filter((w) => w.rule === 'rule-02').map((w) => w.message).join('\n')).not.toContain('flag_named_nyx');
  });
});

// ---- DESIGN §12.5 at every decision --------------------------------------------------------------------------------------------

describe('reputation, loyalty, Echoes and flags at every decision (STORY §11.4, §13; DESIGN §12.5)', () => {
  test('a Shard read: Weavers +5 and `echo_shard_moments`; the unmasking: her Echoes, then keep (+10, Nyx aligned) or tell (−20, the Choir knows, Hostile, she leaves)', () => {
    expect(repOf(WHOSE)).toEqual({ weavers: 5 });
    expect(storyBlock('q_tears_of_the_breach')).toContain('She does not answer. Weavers +5.');
    expect(node('scene_nyx_tears_reading', 'torn').onEnter).toEqual([{ grantEcho: 'echo_shard_moments' }]);
    expect(node('scene_nyx_unmasking', 'vell').onEnter).toEqual([{ grantEcho: 'echo_nyx_is_of_the_nine' }, { grantEcho: 'echo_litany_verse_8' }]);
    expect(node('scene_nyx_unmasking', 'veyran').onEnter).toEqual([{ grantEcho: 'echo_tyrant_name' }]);
    expect(STORY_FLAT).toContain('Effect: `echo_nyx_is_of_the_nine`, `echo_litany_verse_8`, `echo_tyrant_name` if asked.');
    expect(repOf(SAFE)).toEqual({ weavers: 10 });
    expect(loyaltyOf(SAFE)).toEqual({ nyx: LOYALTY_ALIGNED });
    expect(repOf(CHOIR)).toEqual({ weavers: -20 });
    expect(loyaltyOf(CHOIR)).toEqual({ nyx: LOYALTY_AGAINST });
    expect(has(CHOIR, { grantEcho: 'echo_choir_knows' }) && has(CHOIR, { setFlag: 'flag_nyx_hostile' }) && has(CHOIR, { dismiss: 'nyx' })).toBe(true);
    expect(SAFE.some((e) => 'grantEcho' in e || 'setFlag' in e || 'dismiss' in e)).toBe(false);
    expect(storyBlock('q_the_dark_between')).toContain('Keep her secret: Weavers +10; Nyx Loyal. Tell Sethe: Weavers −20; `echo_choir_knows`; Nyx Hostile this loop.');
    expect(S125).toContain('Nyx: keep crystal, give shards, exploit');
    expect(STORY_FLAT).toContain('not telling the Choir what she is');
    // "What's the plan?" opens her third quest, greyed until she is Loyal (STORY §11.4's prereq)
    expect([PLAN.effects, PLAN.when, PLAN.disabledText, PLAN.once]).toEqual([[{ questStart: 'q_what_she_would_undo' }], { all: [{ companion: { id: 'nyx', state: 'recruited' } }, { loyalty: { companion: 'nyx', min: 50 } }] }, '(She will not say it to you yet)', true]);
    expect(STORY_FLAT).toContain('"What\'s the plan?" → `q_what_she_would_undo` opens.');
  });

  test('the plan: agreed Weavers +15 (Nyx aligned); refused with the truth (`echo_ritual_inevitable`): the Note of Closing at Weavers Trusted; refused flatly −10 (against)', () => {
    expect(repOf(AGREED)).toEqual({ weavers: 15 });
    expect(loyaltyOf(AGREED)).toEqual({ nyx: LOYALTY_ALIGNED });
    expect([TRUTH.echoHint, TRUTH.disabledWhen, TRUTH.when, TRUTH.tags]).toEqual(['echo_ritual_inevitable', { not: { echo: 'echo_ritual_inevitable' } }, FROM_LOOP_2, ['echo']]);
    expect(TRUTH.effects[0]).toEqual({ onlyIf: { when: { rep: { faction: 'weavers', min: 20 } }, effects: [{ grantEcho: 'echo_void_resonance' }] } });
    expect(repOf(TRUTH.effects)).toEqual({});
    expect(repOf(REFUSED)).toEqual({ weavers: -10 });
    expect(loyaltyOf(REFUSED)).toEqual({ nyx: LOYALTY_AGAINST });
    expect(storyBlock('q_what_she_would_undo')).toContain('Agreed (stage `agreed`): path to C; Weavers +15. Refused with the truth (`echo_ritual_inevitable`): she breaks, then thanks you; if Weavers ≥ 20, `echo_void_resonance`. Refused flatly: Weavers −10.');
    // her "so that someone closes it who knows what it is" rides on the thanks at Trusted
    expect(node('scene_nyx_undo_plan', 'thanks').textVariants).toEqual([{ when: { rep: { faction: 'weavers', min: 20 } }, text: expect.stringContaining('Let someone close it who knows what it is.') }]);
    // nothing else in these scenes moves reputation: every effect list that does is one of the decisions above (the unmasking's two sit on two nodes)
    const known = [WHOSE, SAFE, CHOIR, AGREED, TRUTH.effects, REFUSED].map((e) => JSON.stringify(e));
    for (const s of arcScenes) {
      for (const n of s.nodes) {
        expect([s.id, n.id, n.onEnter.some((e) => 'rep' in e)]).toEqual([s.id, n.id, false]);
        for (const c of n.choices) if (c.effects.some((e) => 'rep' in e)) expect([s.id, n.id, c.id, known.includes(JSON.stringify(c.effects))]).toEqual([s.id, n.id, c.id, true]);
      }
    }
  });

  test('Dask’s choice: rest → `echo_dask_rest` and he is gone; stay → `flag_dask_anchor`; the whole sentence pays `echo_flickering_man`', () => {
    expect(REST).toEqual([{ grantEcho: 'echo_dask_rest' }, { dismiss: 'dask' }, { questAdvance: { quest: 'q_the_last_instant', stage: 'rests' } }]);
    expect(STAY).toEqual([{ setFlag: 'flag_dask_anchor' }, { questAdvance: { quest: 'q_the_last_instant', stage: 'stays' } }]);
    expect(storyBlock('q_the_last_instant')).toContain('A: `echo_dask_rest`; Phase 3 one voice quieter. B: `flag_dask_anchor` (he stays "until it\'s done"');
    expect(storyBlock('q_the_flickering_man')).toContain('Consequences. `echo_flickering_man`');
  });

  test('recruitment (DESIGN §12.1, STORY §7.3, §7.4): Nyx after the shards at Neutral or once unmasked (Wary with the Choir knowing); Dask at the Pass from Loop 2 after the introduction', () => {
    expect(DESIGN).toContain('| `nyx` | Nyx | Chasm of Whispers | after `q_void_shards` (given) or Loop 2+ with `echo_nyx_is_of_the_nine`; Weavers ≥ Neutral |');
    expect(STORY_FLAT).toContain('Loop 2+ with `echo_nyx_is_of_the_nine`: recruitable after `scene_nyx_unmasking` even if shards are refused, Wary.');
    // one purpose, two scenes: the first ask ahead of her offers; turned down once a loop (C-58's choice flag), it waits behind them
    for (const [id, turnedDown] of [['scene_nyx_walk_with_me', { not: { flag: 'flag_choice_scene_nyx_walk_with_me_no' } }], ['scene_nyx_walk_with_me_again', { flag: 'flag_choice_scene_nyx_walk_with_me_no' }]] as const) {
      expect([id, scene(id).when]).toEqual([
        id,
        {
          all: [
            NOT_IN_HORDE,
            { location: 'loc_chasm_of_whispers' },
            { not: { companion: { id: 'nyx', state: 'recruited' } } },
            { not: { flag: 'flag_nyx_hostile' } },
            turnedDown,
            { any: [{ all: [{ quest: { id: 'q_void_shards', stage: 'given' } }, { rep: { faction: 'weavers', min: -9 } }] }, { all: [{ echo: 'echo_nyx_is_of_the_nine' }, { flag: 'flag_scene_done_scene_nyx_unmasking' }] }] },
          ],
        },
      ]);
      expect(choice(id, 'ask', 'yes').effects).toEqual([{ recruit: 'nyx' }, { onlyIf: { when: { echo: 'echo_choir_knows' }, effects: [{ loyalty: { companion: 'nyx', delta: LOYALTY_AGAINST } }] } }]);
      expect([id, choice(id, 'ask', 'no').oncePerLoop, scene(id).priority]).toEqual([id, id === 'scene_nyx_walk_with_me', id === 'scene_nyx_walk_with_me' ? SCENE_PRIORITY.report : SCENE_PRIORITY.waiting]);
    }
    expect(DESIGN).toContain('| `dask` | Dask | Shimmering Pass | **Loop 2+ only**');
    expect(STORY_FLAT).toContain('Recruitment. Loop 2+, Shimmering Pass, after `scene_dask_introduction`. No quest needed');
    expect(choice('scene_dask_introduction', 'not_what_i_did', 'come').effects).toEqual([{ recruit: 'dask' }]);
    expect(choice('scene_dask_introduction', 'not_what_i_did', 'where').effects).toEqual([{ questStart: 'q_the_flickering_man' }]);
    expect(scene('scene_dask_recruit').when).toEqual({
      all: [NOT_IN_HORDE, FROM_LOOP_2, { location: 'loc_shimmering_pass' }, { flag: 'flag_scene_done_scene_dask_introduction' }, { not: { companion: { id: 'dask', state: 'recruited' } } }],
    });
    expect(choice('scene_dask_recruit', 'still_here', 'come').effects).toEqual([{ recruit: 'dask' }]);
    // no other recruit anywhere in the file
    const recruits = arcScenes.flatMap((s) => s.nodes.flatMap((n) => [...n.onEnter, ...n.choices.flatMap((c) => c.effects)])).filter((e) => 'recruit' in e);
    expect(recruits).toHaveLength(4);
  });

  test('"I know what you are, Nyx" (D-010, DESIGN §12.7): Echo-locked on `echo_nine_voices`, sets `flag_named_nyx` (D-100) and opens the unmasking, once a loop', () => {
    expect([I_KNOW.echoHint, I_KNOW.disabledWhen, I_KNOW.tags]).toEqual(['echo_nine_voices', { not: { echo: 'echo_nine_voices' } }, ['echo']]);
    expect(I_KNOW.when).toEqual({ all: [FROM_LOOP_2, { all: [{ not: { flag: 'flag_scene_done_scene_nyx_unmasking' } }, { not: { flag: 'flag_nyx_hostile' } }] }] });
    expect(I_KNOW.effects).toEqual([{ setFlag: 'flag_named_nyx' }, { startDialogue: 'scene_nyx_unmasking' }]);
    expect(STORY_FLAT).toContain('With `echo_nine_voices`: "I know what you are, Nyx." → `scene_nyx_unmasking` opens early (or via `q_the_dark_between`).');
    expect(pack.achievements['ach_i_know_what_you_are']?.when).toEqual({ all: [{ echo: 'echo_nyx_is_of_the_nine' }, { flag: 'flag_named_nyx' }] });
    // the line is offered wherever she has nothing else pending at the lip
    for (const n of scene('scene_nyx_chasm').nodes.filter((n) => n.id !== 'hostile')) expect([n.id, n.choices.map((c) => c.id)]).toEqual([n.id, ['i_know', 'nothing']]);
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
      expect([s.id, bands.includes(s.priority), s.npcId]).toEqual([s.id, true, s.id.startsWith('scene_nyx') ? 'npc_nyx' : 'npc_dask']);
      expect([s.id, JSON.stringify(s.when).startsWith(`{"all":[${JSON.stringify(NOT_IN_HORDE)}`)]).toEqual([s.id, true]);
    }
    const band = (id: string) => scene(id).priority;
    expect(SCENE_IDS.filter((id) => id.endsWith('_offer')).map(band)).toEqual(Array(5).fill(SCENE_PRIORITY.offer));
    expect(SCENE_IDS.filter((id) => id.endsWith('_waiting')).map(band)).toEqual(Array(4).fill(SCENE_PRIORITY.waiting));
    for (const id of ['scene_nyx_tears_reading', 'scene_nyx_unmasking', 'scene_nyx_undo_plan', 'scene_dask_moment_spires', 'scene_dask_moment_plateau', 'scene_dask_moment_nexus', 'scene_dask_last_instant_choice', 'scene_dask_seven_marks_eighth']) {
      expect([id, band(id)]).toEqual([id, SCENE_PRIORITY.decision]);
    }
    for (const id of ['scene_dask_flickering_man_sentence', 'scene_dask_seven_marks_symptom']) expect([id, band(id)]).toEqual([id, SCENE_PRIORITY.report]);
    expect([band('scene_nyx_deja_vu'), band('scene_dask_shore')]).toEqual([SCENE_PRIORITY.payoff, SCENE_PRIORITY.idle]);
    // the "nothing pending" lines ride in the waiting band, after the waiting scenes (the legacy after-line would win a tie at `after`)
    for (const id of ['scene_nyx_walk_with_me_again', 'scene_nyx_sanctum_eye', 'scene_nyx_chasm', 'scene_dask_recruit', 'scene_dask_pass']) expect([id, band(id)]).toEqual([id, SCENE_PRIORITY.waiting]);
    expect(band('scene_nyx_walk_with_me')).toBe(SCENE_PRIORITY.report);
    expect(SCENE_IDS.indexOf('scene_nyx_chasm')).toBeGreaterThan(SCENE_IDS.indexOf('scene_nyx_tears_waiting'));
    expect(SCENE_IDS.indexOf('scene_dask_pass')).toBeGreaterThan(SCENE_IDS.indexOf('scene_dask_last_instant_waiting'));
    // once a loop: the déjà vu, the introduction, his three moments
    for (const id of ['scene_nyx_deja_vu', 'scene_dask_introduction', 'scene_dask_moment_spires', 'scene_dask_moment_plateau', 'scene_dask_moment_nexus']) expect([id, scene(id).repeatable]).toEqual([id, false]);
  });

  test('camp conversations (DESIGN §12.5, §12.7): the first at a rest with the companion, the second from loyalty 25, the third from 50; they are the records’ campScenes', () => {
    expect(S125).toContain('25 → camp conversation 2');
    expect(DESIGN_SECTION('### 12.7', '### 12.8')).toContain('gated by `{ companion: { id } }` and `{ loyalty: { companion, min } }`');
    for (const who of ['nyx', 'dask'] as const) {
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
    // Nyx's third is said unmasked
    expect((scene('scene_nyx_camp_3').when as { all: Condition[] }).all[2]).toEqual({ echo: 'echo_nyx_is_of_the_nine' });
  });

  test('where they stand (D-102, the NPC schedules): Nyx at the crater, the Hollow, the Sanctum; Dask at his moments, the Stair, the Apex; else home', () => {
    expect(pack.npcs['npc_nyx']?.schedule).toEqual([
      { when: { quest: { id: 'q_the_dark_between', status: 'active' } }, at: ['loc_where_she_fell'] },
      { when: { quest: { id: 'q_what_she_would_undo', status: 'active' } }, at: ['loc_voidscar_hollow'] },
      { when: { quest: { id: 'q_unlidded_eye', status: 'active' } }, at: ['loc_chasm_of_whispers', 'loc_sanctum_of_threads'] },
    ]);
    expect(pack.npcs['npc_dask']?.schedule).toEqual([
      { when: { loop: { max: 1 } }, at: [] },
      { when: { quest: { id: 'q_the_flickering_man', status: 'active' } }, at: ['loc_shimmering_pass', 'loc_aetherium_spires', 'loc_sky_whisper_plateau', 'loc_chronos_nexus'] },
      { when: { quest: { id: 'q_seven_marks', stage: 'high_mark' } }, at: ['loc_shimmering_pass', 'loc_still_shore', 'loc_windward_stair'] },
      { when: { quest: { id: 'q_the_last_instant', status: 'active' } }, at: ['loc_shimmering_pass', 'loc_temporal_breach_apex'] },
    ]);
    expect(STORY_FLAT).toContain('she teaches you to read a Shard');
    expect(STORY_FLAT).toContain('Where She Fell, in the Veil (`loc_where_she_fell`');
    expect(STORY_FLAT).toContain('2. Hear the plan at the Hollow');
    expect(STORY_FLAT).toContain('Dask is in four places at once, mid-sentence.');
    expect(STORY_FLAT).toContain('3. At the High Mark, Dask scratches the eighth frame');
    // the real pack: who stands where, by quest state
    const at = (o: StateOverrides, locationId: string) => npcsAt(makeState({ ...o, loop: 2 }, { content: pack, profile: freshProfile({ loopCounter: 2 }) }), pack, freshProfile({ loopCounter: 2 }), locationId);
    expect(at({ locationId: 'loc_chasm_of_whispers' }, 'loc_chasm_of_whispers')).toContain('npc_nyx');
    expect(at({ locationId: 'loc_where_she_fell' }, 'loc_where_she_fell')).not.toContain('npc_nyx');
    expect(at({ locationId: 'loc_where_she_fell', quests: { q_the_dark_between: 'asked_in' } }, 'loc_where_she_fell')).toContain('npc_nyx');
    expect(at({ locationId: 'loc_chasm_of_whispers', quests: { q_the_dark_between: 'asked_in' } }, 'loc_chasm_of_whispers')).not.toContain('npc_nyx');
    expect(at({ locationId: 'loc_voidscar_hollow', quests: { q_what_she_would_undo: 'plan' } }, 'loc_voidscar_hollow')).toContain('npc_nyx');
    expect(at({ locationId: 'loc_sanctum_of_threads', quests: { q_unlidded_eye: 'lens' } }, 'loc_sanctum_of_threads')).toContain('npc_nyx');
    expect(at({ locationId: 'loc_aetherium_spires' }, 'loc_aetherium_spires')).not.toContain('npc_dask');
    for (const loc of ['loc_shimmering_pass', 'loc_aetherium_spires', 'loc_sky_whisper_plateau', 'loc_chronos_nexus']) {
      expect([loc, at({ locationId: loc, quests: { q_the_flickering_man: 'spires' } }, loc)]).toEqual([loc, ['npc_dask']]);
    }
    expect(at({ locationId: 'loc_windward_stair', quests: { q_seven_marks: 'high_mark' } }, 'loc_windward_stair')).toEqual(['npc_dask']);
    expect(at({ locationId: 'loc_temporal_breach_apex', quests: { q_the_last_instant: 'gathered' } }, 'loc_temporal_breach_apex')).toEqual(['npc_dask']);
    // the Shore is read as the run's start location (D-082), where he never stands in the world
    expect(scene('scene_dask_shore').when).toEqual({ all: [NOT_IN_HORDE, { loop: { min: 3 } }, { location: gameConfig.startLocationId }] });
    expect(pack.locations[gameConfig.startLocationId]?.npcs).not.toContain('npc_dask');
    expect(pack.locations['loc_still_shore']?.npcs).toContain('npc_dask');
  });

  test('every node is tagged by its source: story text is STORY’s, written text is the pinned list; a variant appends to its line', () => {
    for (const s of arcScenes) {
      for (const n of s.nodes) {
        const tag = n.tags[0];
        if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else expect([s.id, n.id, tag, WRITTEN.nodes.includes(n.text)]).toEqual([s.id, n.id, 'written', true]);
        // a variant appends to its line, or is a line of its own (the Shard offer, the Choir told at the lip, her chair pushed back)
        for (const v of n.textVariants) {
          expect([s.id, n.id, WRITTEN.variants.includes(v.text)]).toEqual([s.id, n.id, true]);
          expect([s.id, n.id, v.text.startsWith(n.text) || ['ear', 'told', 'kept'].includes(n.id)]).toEqual([s.id, n.id, true]);
        }
      }
    }
    const storyNodes = arcScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'story').map((n) => `${s.id}.${n.id}`));
    expect(storyNodes).toEqual([
      'scene_nyx_deja_vu.crossed', 'scene_nyx_deja_vu.stirs', 'scene_nyx_deja_vu.true_name', 'scene_nyx_deja_vu.how_many',
      'scene_nyx_unmasking.crater', 'scene_nyx_unmasking.listen', 'scene_nyx_unmasking.stop', 'scene_nyx_unmasking.vell', 'scene_nyx_unmasking.veyran',
      'scene_nyx_chasm.stirs',
      'scene_nyx_camp_2.bear', 'scene_nyx_camp_3.there', 'scene_nyx_camp_3.ready',
      'scene_dask_introduction.fractures', 'scene_dask_introduction.still_there', 'scene_dask_introduction.see_me', 'scene_dask_introduction.scout', 'scene_dask_introduction.skip', 'scene_dask_introduction.not_what_i_did',
      'scene_dask_moment_spires.piece', 'scene_dask_moment_plateau.piece', 'scene_dask_moment_nexus.piece',
      'scene_dask_flickering_man_sentence.the_sentence', 'scene_dask_flickering_man_sentence.whole',
      'scene_dask_last_instant_choice.afternoon',
      'scene_dask_shore.nicer',
      'scene_dask_camp_2.remembers',
    ]);
  });

  test('STORY’s lines sit where STORY puts them: the déjà vu by tier (§5.2, §6.4), the two key scenes (§13), the sentence (§11.4), the Shore (§10.7), the samples (§7.3, §7.4)', () => {
    expect(scene('scene_nyx_deja_vu').entry).toEqual([
      { when: { loop: { min: 5 } }, node: 'how_many' },
      { when: { all: [{ loop: { min: 3 } }, { echo: 'echo_nyx_is_of_the_nine' }] }, node: 'true_name' },
      { when: { all: [] }, node: 'crossed' },
    ]);
    expect(node('scene_nyx_deja_vu', 'crossed').text).toBe('You are standing differently. Something has crossed you.');
    expect(STORY_FLAT).toContain('Nyx: "You are standing differently. Something has crossed you."');
    expect(STORY_FLAT).toContain('Tier 2: "The void stirs when you breathe. It knows you. I would like to know why."');
    expect(STORY_FLAT).toContain('Tier 5+: "How many times, Wayfinder?');
    // the unmasking: the Veil route's crater or the Crystal route's Listen, then her lines in order
    expect(scene('scene_nyx_unmasking').entry).toEqual([{ when: { location: 'loc_where_she_fell' }, node: 'crater' }, { when: { all: [] }, node: 'listen' }]);
    expect(STORY_FLAT).toContain('[Veil route] A crater of starlight glass with the print of a body in it.');
    expect(STORY_FLAT).toContain('[Crystal route] You hold the Crystal up and Listen, and the eighth voice fills the Chasm, and it is hers.');
    expect(scene('scene_nyx_unmasking').nodes.slice(2, 5).map((n) => n.id)).toEqual(['stop', 'vell', 'veyran']);
    for (const [n, c, text] of [['stop', 'nine', "You're one of the Nine."], ['vell', 'tyrant', 'The Tyrant—']] as const) expect(choice('scene_nyx_unmasking', n, c).text).toBe(text);
    expect(node('scene_nyx_unmasking', 'veyran').choices.map((c) => c.text)).toEqual(["Your secret's safe.", 'The Choir should know.', "What's the plan?"]);
    // Sethe steps in on the Veil route only
    expect(node('scene_nyx_unmasking', 'told').text).toContain('Sethe steps in from the rim');
    expect(node('scene_nyx_unmasking', 'told').textVariants[0]?.when).toEqual({ not: { location: 'loc_where_she_fell' } });
    expect(STORY_FLAT).toContain('"The Choir should know." → [Veil route] Sethe steps in');
    // Dask's introduction, line for line, the two player lines as choices
    expect(scene('scene_dask_introduction').nodes.map((n) => n.id)).toEqual(['fractures', 'still_there', 'see_me', 'scout', 'skip', 'not_what_i_did', 'rule', 'four']);
    expect(choice('scene_dask_introduction', 'see_me', 'who').text).toBe('Who are you?');
    expect(choice('scene_dask_introduction', 'skip', 'what_do_i_do').text).toBe('Then what do I do?');
    expect(node('scene_dask_introduction', 'not_what_i_did').choices.map((c) => c.text)).toEqual(['Come with me.', 'Where are the other three of you?']);
    expect(STORY_FLAT).toContain('Choices: "Come with me." → Dask recruited (he cannot leave the Pass until you reach another unstable place; he explains the rule). "Where are the other three of you?" → `q_the_flickering_man`.');
    // the three pieces are the whole sentence; the Pass says the sentence, then the whole of it
    const pieces = ['spires', 'plateau', 'nexus'].map((p) => node(`scene_dask_moment_${p}`, 'piece').text);
    const whole = node('scene_dask_flickering_man_sentence', 'whole').text;
    for (const piece of pieces) expect([piece, whole.includes(piece)]).toEqual([piece, true]);
    expect(node('scene_dask_flickering_man_sentence', 'the_sentence').text).toBe("Don't kill it; it's the only thing holding the door, and I think it knows my name.");
    expect(STORY_FLAT).toContain('The whole sentence, at the end of `q_the_flickering_man`: "It isn\'t guarding the door.');
    for (const p of ['spires', 'plateau', 'nexus']) expect(node(`scene_dask_moment_${p}`, 'there').choices.map((c) => c.text)).toEqual(['Listen.']);
    // the Shore: STORY §10.7's line when he has walked with you; a stranger's otherwise
    expect(scene('scene_dask_shore').entry.slice(1)).toEqual([{ when: { any: [{ echo: 'echo_dask_bond' }, { echo: 'echo_flickering_man' }] }, node: 'nicer' }, { when: { all: [] }, node: 'stranger' }]);
    expect(node('scene_dask_shore', 'nicer').text).toBe('So this is where you go. Huh. Nicer than mine.');
    expect(STORY_FLAT).toContain('Dask, if recruited this loop, stands at the water\'s edge: "So this is where you go. Huh. Nicer than mine."');
    // the samples: hers at camp, his at camp and at the end
    expect(node('scene_nyx_camp_2', 'bear').text).toBe('I have told the Choir what they could bear. You, I think, can bear a little more.');
    expect(node('scene_nyx_camp_3', 'there').text).toBe('I was there. Do not ask me to be sorry in a way you can use.');
    expect(node('scene_nyx_camp_3', 'ready').text).toBe('I am not ready to see his face. I was never ready. That is why I am here and he is there.');
    expect(node('scene_dask_camp_2', 'remembers').text).toBe("You've got a thing round your neck that remembers. I'd have killed for that. Did, in a way.");
    expect(node('scene_dask_last_instant_choice', 'afternoon').text).toBe("Seventy years. Felt like an afternoon. A long one. Don't do what I did. Don't do what I nearly did either.");
    // the Wayfinder's words from the ending-C scene serve the truth
    expect(TRUTH.text).toBe("It was always going to fail. I've seen it.");
    expect(STORY_FLAT).toContain('[`echo_ritual_inevitable`] Wayfinder: It was always going to fail. I\'ve seen it.');
  });

  test('choice texts and the other written words are exactly the pinned lists (the lead checks them); STORY §15.1’s banned words stay out', () => {
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
    // BIBLE: Nyx says "he" of Veyran, never "it"; no exclamation anywhere in her mouth
    for (const s of arcScenes) for (const n of s.nodes) if (n.speaker === 'npc_nyx' || n.speaker === 'nyx') expect([s.id, n.id, /!/.test(n.text)]).toEqual([s.id, n.id, false]);
  });
});

/** Every word U55 wrote (the reply lists them). */
const WRITTEN = {
  nodes: [
    // Nyx at the lip
    'Then we are both old in this day. Sit a while. The void remembers you; let it remember you resting.',
    'You gave the dark what it was owed. Walk with me a while; it listens better when there are two of us.',
    'You know what I am and you came back down to the lip. Walk with me. I would rather be watched by you than by the Choir.',
    'The Choir looks at me now the way I look at the seam. Someone showed them. Walk with me anyway; I have nowhere left that is only mine.',
    'You have walked beside me before. I do not remember it; the void does, and it has stopped flinching when you breathe. Walk with me.',
    'She does not hold out a hand. She waits.',
    'Then the void walks with you. Do not thank it. It is not a compliment.',
    'Then I keep the lip. It has kept me forty years; it can keep me another day.',
    'Three Shards, and you handed them over without once holding one to your ear. I will teach you to read one. Bring a Shard to the edge, at night, when the Chasm breathes slowest.',
    'The Stalkers in the Hollow carry them. So does the Shelf, if you can bear the Shelf. Come at night. By day the Chasm only breathes.',
    'Then keep your ears shut a while longer. The void is patient. It remembers.',
    'Night, Wayfinder, and a Shard in your hand. The Chasm breathes slowest then, and you can hear what is caught in it.',
    'Hold it. Not to the light; to the ear. Now I speak, and you do not.',
    'A stair. A boy on the third step, looking up. A bell that has not finished ringing. Then the Shard is a shard again, cold in your palm.',
    'A moment, torn out of a night and kept. Every one of them is. The Choir calls them tears; they are not wrong, and they are not right.',
    'She does not answer. She looks at the Shard in your hand the way you would look at a door you shut yourself.',
    'Keep that one. The void remembers where it was torn. Now so do you.',
    'There is a place in the Veil I keep. No one enters it. The Weavers think it is warded, and it is, but not against them. I would like you to see it.',
    'Past the Orchard, north, where the glass is. I will go ahead. Come alone, or with whoever you trust more than the Choir.',
    'Then I am already there.',
    'The glass keeps. So do I.',
    'Not on the rim. Walk with me to the Hollow, where I came in, and I will say it where only the dark listens.',
    'She waits for what you will do with her name.',
    'Then it is yours to keep, and mine to go on carrying. The void remembers you, Wayfinder. Tonight that is a compliment.',
    'Sethe steps in from the rim, lidless, and does not look at you. She looks at the seam on Nyx, and finds it, and sings one note. Nyx is gone from your side before it ends.',
    'I want to go back. Not to the night; to the verse. To stand at the stone where I stood and say what Hallow said, and this time give them the reason.',
    'He has to be alive for it. The door is him. Come to the Hollow, where I came in, and I will show you the shape of it.',
    'The Hollow. Where the dark is thinnest, because it has already been through once.',
    'Then I keep carrying it. I am used to the weight.',
    'Hear the rule first, because the whole of it rests there. The door to the past is him. It exists while he holds it, and not one breath longer.',
    'The Heartstone Core pries it wide. Kill him and it slams shut, and there is no past to go back to; only the dark he was holding out.',
    'I go through. I stand at the stone at the sixth verse and I say what Hallow said, stop, with the reason he did not have. Then there is no Breach, no Tyrant, no you. Will you stand beside me?',
    'Then we need the Core in your hand, the Choir sworn to us, and him alive when we reach the Apex. Do not be quick there. I have waited forty years for a door; I can wait for you.',
    'She does not believe you. Then she does. She sits down on the scree with a Shard still in her hand, and for a while the Hollow is the only thing that breathes.',
    '...Thank you. No one has told me that in forty years. No one could.',
    'No. ...Then I asked the wrong Wayfinder. There will be another. There is always another; that is the one thing I know about this day.',
    'Sethe wants the eye of a warden, so she can look where I look. Let her. The seam is there; I have never pretended it was not. What she will not see is what is on the far side of it.',
    'You told them. Go down the stair, then; they will be glad of you. I will not.',
    'We go to the Apex together, and not before the Core is in your hand. I have waited forty years; I can wait for a stone.',
    'I keep thinking about the version where I was not there. Go on, Wayfinder. I am still deciding what to do with my hands.',
    'You said no. The void remembers that too.',
    'The glass keeps my name. So do you. That is two more than I meant.',
    'The Choir looks at me now. You let them. Do not ask me to be sorry in a way you can use.',
    'You came to me first. I did not thank you. I am not going to; take it from the fact that I came back.',
    'You have read one Shard. Do not read them all. Some of those seconds are mine.',
    // Nyx at camp
    'I do not sleep. Do not let it trouble you; the dark sleeps for me, and it is a light sleeper. Ask what you are going to ask.',
    'Because the void remembers you, and it does not remember many. Because you go east, and I have not gone east in forty years. One of those is the reason. I have not decided which.',
    'A night. Always the same night, in pieces, and one of the pieces is a boy on a stair. I have told the Choir what they could bear. You, I think, can bear a little more. Not tonight.',
    'They hold eleven thousand Shards and call them tears, and sing the eighth verse wrong every night, and I let them. A people need a wrong thing to be sure of. I gave them one. What I kept is worse.',
    'That the far side of the tear is not power. It is a room with nine chairs and one of them pushed back. Sleep, Wayfinder. I will watch the fire; it is the one thing out here that is honest.',
    'Because the right thing has no handle on it. You cannot carry it down a stair, or sing it in a hall, or sell it to the Remnants for thread. Wrong things keep. I know; I have kept one for forty years.',
    'When I have a reason to stand in front of him that is better than looking. Not before. He held the door for me; the least I owe him is a plan.',
    'Tell me if he is tired. No. Do not tell me. I know he is tired; I have known for forty years, and I sat on the lip of a hole and let him be.',
    // Dask at the Pass and his moments
    "I'll come. Mind the rule, though: I'm only anywhere the hour's loose. Walk me somewhere it holds steady and I go, and I don't choose where. I come back when it slips again.",
    "The Spires. The Plateau, where the wind keeps the time. The Nexus, under the dome. Go up to each and stand still, and listen. I'm mid-word in all of them.",
    "Still here. Still four of me; this one's the talker. You'll want company on that road, and I'd like to see where it goes for once.",
    'He is here too, in the hum between the Spires, with one hand up. His mouth is in the middle of a word.',
    'The word ends and so does he. The hand is still up when he goes.',
    'On the Plateau the wind keeps the time, and he keeps the wind: a man in old leathers, half turned, mid-word.',
    'The gust crosses and takes the rest of him with it. The markers go on ticking.',
    'Under the broken dome he stands where the orrery would show the Apex, facing it, a word already on its way out.',
    'The dome flickers between one tick and the next, and when it settles he is not in it.',
    "Three more of me out there, mid-word. Go and stand still in front of them. I'll keep this bit of the sentence warm.",
    "You found them. All four, then. Hells. Hold still; I've got the whole of it now and I don't know how long I've got it for.",
    "Take the badge. Scout's. It kept me pointed at the right hour once; it'll do the same for you, and the Pass won't lie to you about the path again.",
    "It spoke to you. It's known my name seventy years; I think it could gather me. One instant, all of me in it, the way a hand closes.",
    "I can't ask it. Asking's letting go of something, and I'm not holding anything. You are. Ask it for me, at the end, when it's listening. Will you?",
    "Then let's go and see the door. I'd like to be there when you ask. I'd like to be anywhere, properly, once.",
    "Fair. It's a lot to ask for a man who's mostly elsewhere.",
    "The Apex. Walk me there the loose way, by the Spires, or I'll drop out on the swamp and meet you under the dome.",
    'The chorus has gone quiet. Under it, the one voice said yes, the way it says everything: as if it cost a day.',
    "It can do it. I felt it start; every bit of me leaned the same way for once. So. Rest, and be one thing for about a second, and then nothing. Or stay, flickering, till it's done. Your call, or mine?",
    'Then he is in one place, and the hour closes on it like a hand. The chorus is one voice quieter.',
    "Until it's done, then. I'll be about. Not anywhere, but about.",
    "Still about. Told you. The door's holding and so am I, which is one more than I expected.",
    "Four of me and you've met the lot. That's more than I managed. Don't kill it, mind. I know I said. I'll keep saying.",
    "Cleft's always the same temperature. Seventy years and I've never once been cold in it. That's the one thing I'd keep.",
    // Dask on the Shore and at the Stair
    "Eighth frame's still empty, last I looked. Good. Keep it that way as long as you can stand to.",
    "You're new. Or I am; hard to tell on this sand. Stand still a minute. The water shows what happened, if you can stand to watch it.",
    "There's a hall of paintings down the sand. Every one of them's you. Seven have a scratch in the gilt, low on the left, where a hand rests. I know where six came from.",
    "The seventh's mine. Year 430; I'd just worked out what it was and I wanted somebody to know I'd been. Go and look at them. Then come and tell me what you make of the eighth. Will you?",
    "Low on the left. Don't hurry; the hall's as long as it needs to be.",
    "They'll keep. Paint keeps better than people.",
    'Down the sand, west. Seven scratches. Count them for me; I never could get past my own.',
    "Seven, and the eighth frame's clean. You saw it. Seven of us walked up to that door, and every one of us thought we'd been sent.",
    "We weren't. We're not chosen. We're a symptom. The hold weakens and the land runs a fever, and the fever's a person with the lines in them. Nothing picked us. Nothing's that organised.",
    "That's the freeing part, if you want it. Nobody's waiting on you to be what they meant. Come up to the High Mark with me next time round, where the wind keeps the stair, and I'll show you what I'd cut for the eighth.",
    "He has a scout's knife out and the rock in front of him, and the wind decides where his hand goes. He cuts four lines. A frame, the size of a hand, with nothing in it.",
    "Eighth. That's yours, or it's nobody's. I'm not putting a mark in it; you'll do that or you won't. Either way it's the first one that's a choice.",
    // Dask at camp
    "I don't sleep. Haven't since 430. I sit, and the fire does the sleeping, and about once a watch I'm somewhere else for the length of a word. Ask; I'm here for a bit.",
    "Like being interrupted. By yourself, mostly. You start a thing and another of you's already at the end of it, and neither of you gets the middle. I've had seventy years of middles.",
    "Like a hand in the small of the back. Hearthring to the Ruins, the Ruins to the east, east to the door. I thought it was a calling. It was a direction. There's a difference, and I found it out late.",
    "Walked up to it and started talking. I'd worked out what it was, see, and I wanted to tell it I knew. It's got a reflex, like a knee. That's all it was. A reflex, and seventy years.",
    "What I nearly did was worse. I had my hand on my knife and I thought, a man could end this. I didn't know what this was yet. Nearly's the only thing that saved it, and nearly's not a thing I'd lean on twice.",
    "Somebody could take his place. I've said it to three of you; you're the one that stood still for it. It should be me. I know the words. I'm not anywhere long enough to say them, and I'm ashamed of that, if you want the truth.",
    "Kind of you. Wrong, but kind. Seven of us went up that road and one of us had the sense to stop and ask, and it still wasn't enough. Get some sleep. I'll be here, mostly.",
    "Someone who knew the words and had the neck for the door. That's a short list, and you're standing on it. Don't look like that. I didn't say you had to. I said you could, which is the thing nobody said to me.",
  ],
  variants: [
    'You hold your hands like someone who has read one. Bring a Shard to the edge, at night, when the Chasm breathes slowest, and we will see if the dark remembers you.',
    'You will carry it down the stair to the Choir, and she knows it. She does not stop you. She is gone from your side before you reach the Hollow.',
    '...Thank you. No one has told me that in forty years. No one could. Take the note, then. The Shards sing one note; it is the tear closing, not opening. Let someone close it who knows what it is.',
    'That the far side of the tear is not power. It is a room with nine chairs and one of them pushed back. Mine. Sleep, Wayfinder. I will watch the fire; it is the one thing out here that is honest.',
    'When I have a reason to stand in front of him that is better than looking. Not before. He held the door for me; the least I owe him is a plan. You have heard it. When the Core is in your hand, we go.',
    "Somebody could take his place. I've said it to three of you; you're the one that stood still for it. It should be me. I know the words. I'm not anywhere long enough to say them, and I'm ashamed of that, if you want the truth. The Weaver woman knows them too. She hasn't said so where I can hear; till she does I've nothing to say to her.",
  ],
  /** The Wayfinder's lines STORY §13 gives (and the ending-C words that serve the truth). */
  storyChoices: [
    'I know what you are, Nyx.',
    "You're one of the Nine.",
    'The Tyrant—',
    "Your secret's safe.",
    'The Choir should know.',
    "What's the plan?",
    "It was always going to fail. I've seen it.",
    'Who are you?',
    'Then what do I do?',
    'Come with me.',
    'Where are the other three of you?',
  ],
  choices: [
    'Nothing more.',
    'More than I can count.',
    'Walk with me.',
    'Not yet.',
    'I will bring one.',
    'Whose moment is it?',
    'I will come.',
    'Show me.',
    'Not now.',
    'I will stand beside you.',
    'No.',
    'Why do you walk with me?',
    'What do you hear, when the void stirs?',
    'What did you keep?',
    'Why let them be wrong?',
    'Come to the Apex and look.',
    'Then stay here, and let me look for you.',
    'Later.',
    'Listen.',
    'I will ask it.',
    "Rest. You've earned the one second.",
    "Stay. Until it's done.",
    'I will look.',
    "What's it like, being in four places?",
    'What was it like, being a Wayfinder?',
    'What did you do?',
    'What did you nearly do?',
    "It's not a thing to be ashamed of.",
    'Then who?',
  ],
  journals: [
    'Hold the Shard while she speaks. Nyx waits at the lip of the Chasm.',
    'A stair, a boy, a bell. You asked whose moment it is. She did not answer.',
    'Nine names in chalk on the rim, eight crossed out. Ask her whose the ninth is.',
    'You keep her name from the Choir. The glass keeps it too.',
    'You told the Choir what she is. She is gone from your side for the loop.',
    'The door to the past is him. The Core pries it wide; killing him slams it shut. Answer her.',
    'You will stand beside her at the stone. The Weavers have their dawn to work for.',
    'You told her it was always going to fail. She did not believe you, and then she did.',
    'You refused her. She will ask another Wayfinder, some other day.',
    'Another of him stands on the Sky-Whisper Plateau, mid-word, where the wind keeps the time.',
    'The third of him is at the Chronos Nexus, under the broken dome, a step from the door.',
    'You have heard three of him. Go back to the Pass; the one that talks can finish the sentence now.',
    'It is the door, and it knows his name. Someone who knew the words could take its place.',
    'Seven frames, one scratch each, low on the left. Tell Dask on the Shore what you saw.',
    'The eighth frame has no mark. Climb to the High Mark, the Windward Stair, and let Dask show you what he would cut.',
    'At the High Mark Dask cut the outline of an eighth frame and left it empty.',
    'It can gather him; it has said so. Ask Dask, at the Apex, what he wants.',
    'Dask rests. One instant, then none. The chorus is one voice quieter.',
    'Dask stays, flickering, until it is done.',
  ],
  other: [
    "Nyx will teach you to read a Void Shard at the Chasm's edge at night.",
    'Nyx has asked you into the place in the Veil she keeps.',
    'Nyx asks for help going back to the sixth verse, with the Breach open and Veyran alive to hold the door.',
    'Dask is in four places at once; find the other three and hear the end of his sentence.',
    'Dask knows where six of the seven Wayfinders left their marks; the seventh is his.',
    'Dask has asked you to ask the Tyrant to gather him into one instant.',
    '(She will not say it to you yet)',
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

  test('Loop 2 at the Chasm: the déjà vu first, once, with the Echo line greyed; then the legacy offer; Loop 5 asks how many times', () => {
    const { s, profile } = at({ locationId: 'loc_chasm_of_whispers' });
    const opened = play(s, [talk('npc_nyx'), go], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_nyx_deja_vu');
    expect(nodesSeen(opened.events)).toEqual(['crossed', 'stirs']);
    expect(choiceViews(opened.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['i_know', false], ['nothing', true]]);
    const closed = play(opened.state, [pick('nothing')], { content: pack, profile });
    expect(closed.state.mode).toBe('explore');
    expect(play(closed.state, [talk('npc_nyx')], { content: pack, profile }).state.dialogue?.sceneId).toBe('scene_nyx_void_shards_offer');
    const five = at({ locationId: 'loc_chasm_of_whispers' }, 5);
    expect(nodesSeen(play(five.s, [talk('npc_nyx')], { content: pack, profile: five.profile }).events)).toEqual(['how_many']);
    // Loop 1: the legacy game, untouched
    const one = at({ locationId: 'loc_chasm_of_whispers' }, 1);
    expect(play(one.s, [talk('npc_nyx')], { content: pack, profile: one.profile }).state.dialogue?.sceneId).toBe('scene_nyx_void_shards_offer');
  });

  test('the shards given at Neutral: "Walk with me" comes before her offer and recruits her (at 25 with the bond); turned down it waits behind the offer; refused and Wary she is not offered; with the Choir knowing she joins at −10', () => {
    const given = at({ locationId: 'loc_chasm_of_whispers', quests: { q_void_shards: { status: 'completed', stage: 'given' } }, flags: { flag_scene_done_scene_nyx_deja_vu: true } });
    const walk = play(given.s, [talk('npc_nyx'), go], { content: pack, profile: given.profile });
    expect([walk.state.dialogue?.sceneId, nodesSeen(walk.events)]).toEqual(['scene_nyx_walk_with_me', ['owed', 'ask']]);
    const joined = play(walk.state, [pick('yes'), go], { content: pack, profile: given.profile });
    expect([joined.state.companions.activeId, loyalty(joined.state, 'nyx'), joined.state.mode]).toEqual(['nyx', 0, 'explore']);
    expect(play(joined.state, [talk('npc_nyx')], { content: pack, profile: given.profile }).state.dialogue?.sceneId).toBe('scene_nyx_tears_offer');
    // turned down once: her offer comes first from then on, and the ask waits behind it
    const later = play(walk.state, [pick('no'), go, talk('npc_nyx')], { content: pack, profile: given.profile });
    expect([later.state.flags.flag_choice_scene_nyx_walk_with_me_no, later.state.dialogue?.sceneId]).toEqual([true, 'scene_nyx_tears_offer']);
    const taken = play(later.state, [pick('yes'), go, talk('npc_nyx')], { content: pack, profile: given.profile });
    expect(taken.state.dialogue?.sceneId).toBe('scene_nyx_walk_with_me_again');
    const bond = at({ locationId: 'loc_chasm_of_whispers', quests: { q_void_shards: { status: 'completed', stage: 'given' } }, flags: { flag_scene_done_scene_nyx_deja_vu: true } }, 3, ['echo_nyx_bond']);
    const bonded = play(bond.s, [talk('npc_nyx'), go, pick('yes'), go], { content: pack, profile: bond.profile });
    expect([nodesSeen(bonded.events)[0], loyalty(bonded.state, 'nyx')]).toEqual(['before', 25]);
    const refused = at({ locationId: 'loc_chasm_of_whispers', reputation: { weavers: -20 }, quests: { q_void_shards: { status: 'completed', stage: 'refused' } }, flags: { flag_scene_done_scene_nyx_deja_vu: true } });
    expect(play(refused.s, [talk('npc_nyx')], { content: pack, profile: refused.profile }).state.dialogue?.sceneId).toBe('scene_nyx_chasm');
    // unmasked this loop, Wary, the shards refused: still offered (STORY §7.3); the Choir knowing costs her 10 on joining
    const known = at({ locationId: 'loc_chasm_of_whispers', reputation: { weavers: -20 }, quests: { q_void_shards: { status: 'completed', stage: 'refused' } }, flags: { flag_scene_done_scene_nyx_deja_vu: true, flag_scene_done_scene_nyx_unmasking: true } }, 2, ['echo_nyx_is_of_the_nine', 'echo_choir_knows']);
    const wary = play(known.s, [talk('npc_nyx'), go, pick('yes'), go], { content: pack, profile: known.profile });
    expect([nodesSeen(wary.events)[0], wary.state.companions.activeId, loyalty(wary.state, 'nyx')]).toEqual(['watched', 'nyx', 0]); // clamped at 0
  });

  test('the Shard read: a Shard at the edge at night opens the reading; whose moment → Weavers +5, `echo_shard_moments`, 150 XP, a Shard paid, +15 loyalty over the stages', () => {
    const base = {
      locationId: 'loc_chasm_of_whispers',
      watch: 2 as const,
      items: ['item_void_shard'],
      quests: { q_void_shards: { status: 'completed' as const, stage: 'given' }, q_tears_of_the_breach: 'shard_at_night' },
      flags: { flag_scene_done_scene_nyx_deja_vu: true },
      patch: withCompanion('nyx'),
    };
    const { s, profile } = at(base);
    // dusk; a wait brings night, and the sweep after it advances the stage
    const waited = play(s, [{ type: 'wait' }], { content: pack, profile });
    expect(waited.state.quests.q_tears_of_the_breach?.stage).toBe('read');
    expect(loyalty(waited.state, 'nyx')).toBe(5);
    const read = play(waited.state, [talk('npc_nyx'), go, go, pick('whose'), go, go], { content: pack, profile });
    expect(read.state.quests.q_tears_of_the_breach).toMatchObject({ status: 'completed', stage: 'unanswered' });
    expect(nodesSeen(read.events)).toEqual(['hold', 'moment', 'torn', 'no_answer', 'keep']);
    expect([read.state.reputation.weavers, carries(read.state, 'item_void_shard'), xpOf(read.events), loyalty(read.state, 'nyx')]).toEqual([5, 2, 150, 15]);
    expect(read.state.echoesThisLoop).toContain('echo_shard_moments');
    expect(nodesSeen(play(read.state, [talk('npc_nyx')], { content: pack, profile }).events)).toEqual(['tears_done']);
    // by day the stage waits, and she says so
    const day = at({ ...base, watch: 0 });
    const idle = play(day.s, [{ type: 'wait' }, talk('npc_nyx')], { content: pack, profile: day.profile });
    expect([idle.state.quests.q_tears_of_the_breach?.stage, nodesSeen(idle.events)]).toEqual(['shard_at_night', ['night']]);
  });

  test('the unmasking at the crater: her Echoes, then kept → Weavers +10, Nyx +3, 250 XP; or the Choir told → −20, the Choir knows, Hostile, she leaves the party', () => {
    const base = { locationId: 'loc_where_she_fell', quests: { q_the_dark_between: 'names' }, patch: withCompanion('nyx', { loyalty: 40 }) };
    const { s, profile } = at(base);
    const opened = play(s, [talk('npc_nyx'), go], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_nyx_unmasking');
    expect(nodesSeen(opened.events)).toEqual(['crater', 'stop']);
    const told = play(opened.state, [pick('nine'), pick('tyrant')], { content: pack, profile });
    expect(told.state.echoesThisLoop).toEqual(expect.arrayContaining(['echo_nyx_is_of_the_nine', 'echo_litany_verse_8', 'echo_tyrant_name']));
    expect(choiceViews(told.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['safe', true], ['choir', true], ['plan', false]]);
    const kept = play(told.state, [pick('safe'), go], { content: pack, profile });
    expect(kept.state.quests.q_the_dark_between).toMatchObject({ status: 'completed', stage: 'kept' });
    expect([kept.state.reputation.weavers, loyalty(kept.state, 'nyx'), xpOf(kept.events), kept.state.mode]).toEqual([10, 40 + 3 + 5 + 5, 250, 'explore']);
    const choir = play(told.state, [pick('choir'), go], { content: pack, profile });
    expect(choir.state.quests.q_the_dark_between).toMatchObject({ status: 'completed', stage: 'told' });
    expect([choir.state.reputation.weavers, choir.state.flags.flag_nyx_hostile, choir.state.companions.recruited.nyx, choir.state.companions.activeId]).toEqual([-20, true, undefined, null]);
    expect(choir.state.echoesThisLoop).toContain('echo_choir_knows');
    expect(nodesSeen(choir.events).at(-1)).toBe('told');
    // hostile, she has one line at the lip and no offers
    const after = play(choir.state, [{ type: 'move', to: 'loc_null_orchard' }], { content: pack, profile });
    const lip = at({ locationId: 'loc_chasm_of_whispers', flags: { ...after.state.flags, flag_scene_done_scene_nyx_deja_vu: true }, quests: { q_void_shards: { status: 'completed', stage: 'given' } } });
    expect(nodesSeen(play(lip.s, [talk('npc_nyx')], { content: pack, profile: lip.profile }).events)).toEqual(['hostile']);
    // Loyal at the rim: "What's the plan?" opens her third quest
    const loyal = at({ ...base, patch: withCompanion('nyx', { loyalty: 60 }) });
    const asked = play(loyal.s, [talk('npc_nyx'), go, pick('nine'), pick('tyrant'), pick('plan'), go], { content: pack, profile: loyal.profile });
    expect([asked.state.quests.q_what_she_would_undo?.stage, nodesSeen(asked.events).slice(-2)]).toEqual(['plan', ['plan_later', 'decide']]);
    expect(choiceViews(asked.state, pack, loyal.profile).map((v) => v.id)).toEqual(['safe', 'choir']);
  });

  test('the Crystal route: "I know what you are, Nyx" at the lip with `echo_nine_voices` names her (the flag), opens the unmasking by its Listen, and leaves her quest untouched', () => {
    const { s, profile } = at({ locationId: 'loc_chasm_of_whispers' }, 2, ['echo_nine_voices']);
    const opened = play(s, [talk('npc_nyx'), go], { content: pack, profile });
    expect(choiceViews(opened.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['i_know', true], ['nothing', true]]);
    const named = play(opened.state, [pick('i_know'), go, pick('nine'), pick('tyrant'), pick('safe'), go], { content: pack, profile });
    expect(nodesSeen(named.events)).toEqual(['listen', 'stop', 'vell', 'veyran', 'kept']);
    expect([named.state.flags.flag_named_nyx, named.state.quests.q_the_dark_between, named.state.reputation.weavers]).toEqual([true, undefined, 10]);
    expect(named.state.echoesThisLoop).toContain('echo_nyx_is_of_the_nine');
    // unmasked, she offers to walk (STORY §7.3: even with the shards refused); once unmasked, the line is gone from the lip for the loop
    const again = play(named.state, [talk('npc_nyx')], { content: pack, profile });
    expect([again.state.dialogue?.sceneId, nodesSeen(again.events)]).toEqual(['scene_nyx_walk_with_me', ['known']]);
    const settled = at(
      { locationId: 'loc_chasm_of_whispers', quests: { q_void_shards: { status: 'completed', stage: 'given' }, q_tears_of_the_breach: { status: 'completed', stage: 'unanswered' } }, flags: { flag_scene_done_scene_nyx_deja_vu: true, flag_scene_done_scene_nyx_unmasking: true }, patch: withCompanion('nyx') },
      2,
      ['echo_nine_voices', 'echo_nyx_is_of_the_nine'],
    );
    const lip = play(settled.s, [talk('npc_nyx')], { content: pack, profile: settled.profile });
    expect([lip.state.dialogue?.sceneId, choiceViews(lip.state, pack, settled.profile).map((v) => v.id)]).toEqual(['scene_nyx_chasm', ['nothing']]);
    // the Choir told at the lip: the Crystal route's words
    const other = at({ locationId: 'loc_chasm_of_whispers' }, 2, ['echo_nine_voices']);
    const toldHere = play(other.s, [talk('npc_nyx'), go, pick('i_know'), go, pick('nine'), pick('tyrant'), pick('choir')], { content: pack, profile: other.profile });
    const said = toldHere.events.findLast((e) => e.t === 'dialogueNode') as { text: string } | undefined;
    expect(said?.text.startsWith('You will carry it down the stair to the Choir')).toBe(true);
  });

  test('the plan at the Hollow: `echo_what_she_would_undo`; agreed +15 and Nyx +3; the truth greyed without the Echo, with it and Trusted the Note of Closing; no → −10, Nyx −10', () => {
    const base = { locationId: 'loc_voidscar_hollow', quests: { q_what_she_would_undo: 'plan' }, patch: withCompanion('nyx', { loyalty: 60 }) } as const;
    const { s, profile } = at(base);
    const opened = play(s, [talk('npc_nyx'), go, go], { content: pack, profile });
    expect([opened.state.dialogue?.sceneId, nodesSeen(opened.events)]).toEqual(['scene_nyx_undo_plan', ['door', 'core', 'sixth']]);
    expect(opened.state.quests.q_what_she_would_undo?.stage).toBe('heard');
    expect(opened.state.echoesThisLoop).toContain('echo_what_she_would_undo');
    expect(choiceViews(opened.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['agreed', true], ['truth', false], ['refused', true]]);
    const agreed = play(opened.state, [pick('agreed'), go], { content: pack, profile });
    expect(agreed.state.quests.q_what_she_would_undo).toMatchObject({ status: 'completed', stage: 'agreed' });
    expect([agreed.state.reputation.weavers, loyalty(agreed.state, 'nyx'), xpOf(agreed.events)]).toEqual([15, 60 + 5 + 5 + 3 + 5, 400]);
    const refused = play(opened.state, [pick('refused'), go], { content: pack, profile });
    expect([refused.state.quests.q_what_she_would_undo?.stage, refused.state.reputation.weavers, loyalty(refused.state, 'nyx')]).toEqual(['refused', -10, 60 + 5 + 5 - 10 + 5]);
    // with the Echo: the truth; the Note of Closing only at Weavers Trusted
    const trusted = at({ ...base, reputation: { weavers: 20 } }, 3, ['echo_ritual_inevitable']);
    const truth = play(trusted.s, [talk('npc_nyx'), go, go, pick('truth'), go, go], { content: pack, profile: trusted.profile });
    expect(truth.state.quests.q_what_she_would_undo).toMatchObject({ status: 'completed', stage: 'refused_truth' });
    expect([truth.state.echoesThisLoop.includes('echo_void_resonance'), truth.state.reputation.weavers, nodesSeen(truth.events).slice(-2)]).toEqual([true, 20, ['breaks', 'thanks']]);
    expect((truth.events.findLast((e) => e.t === 'dialogueNode') as { text: string }).text).toContain('Let someone close it who knows what it is.');
    const neutral = at(base, 3, ['echo_ritual_inevitable']);
    const plain = play(neutral.s, [talk('npc_nyx'), go, go, pick('truth'), go, go], { content: pack, profile: neutral.profile });
    expect(plain.state.echoesThisLoop).not.toContain('echo_void_resonance');
    expect((plain.events.findLast((e) => e.t === 'dialogueNode') as { text: string }).text).toBe('...Thank you. No one has told me that in forty years. No one could.');
  });

  test("Dask at the Pass, Loop 2: the introduction; Come with me recruits him (the rule); Where are the other three starts the quest; his moments count by their scenes", () => {
    const { s, profile } = at({ locationId: 'loc_shimmering_pass' });
    const opened = play(s, [talk('npc_dask'), go, go], { content: pack, profile });
    expect([opened.state.dialogue?.sceneId, nodesSeen(opened.events)]).toEqual(['scene_dask_introduction', ['fractures', 'still_there', 'see_me']]);
    const met = play(opened.state, [pick('who'), go, pick('what_do_i_do'), pick('come')], { content: pack, profile });
    expect([met.state.companions.activeId, nodesSeen(met.events).at(-1)]).toEqual(['dask', 'rule']);
    const quested = play(met.state, [pick('where'), go], { content: pack, profile });
    expect([quested.state.quests.q_the_flickering_man?.stage, quested.state.mode]).toEqual(['spires', 'explore']);
    // the next talk: the waiting line (the introduction is once a loop; the recruit line is for the unrecruited)
    expect(nodesSeen(play(quested.state, [talk('npc_dask')], { content: pack, profile }).events)).toEqual(['warm']);
    // the Spires: the first moment; the Plateau waits its turn
    const spires = at({ locationId: 'loc_aetherium_spires', quests: { q_the_flickering_man: 'spires' }, patch: withCompanion('dask') });
    const heard = play(spires.s, [talk('npc_dask'), pick('listen'), go, go], { content: pack, profile: spires.profile });
    expect([nodesSeen(heard.events), heard.state.quests.q_the_flickering_man?.stage, loyalty(heard.state, 'dask')]).toEqual([['there', 'piece', 'gone'], 'plateau', 5]);
    const plateauEarly = at({ locationId: 'loc_sky_whisper_plateau', quests: { q_the_flickering_man: 'spires' } });
    expect(play(plateauEarly.s, [{ reject: talk('npc_dask'), reason: 'nothing more to say' }], { content: pack, profile: plateauEarly.profile }).state.mode).toBe('explore');
    // the Pass with all three heard: the sentence, the Echo, the badge, 150 XP
    const sentence = at({ locationId: 'loc_shimmering_pass', quests: { q_the_flickering_man: 'sentence' }, flags: { flag_scene_done_scene_dask_introduction: true }, patch: withCompanion('dask', { loyalty: 15 }) });
    const whole = play(sentence.s, [talk('npc_dask'), go, go, go, go], { content: pack, profile: sentence.profile });
    expect(whole.state.quests.q_the_flickering_man).toMatchObject({ status: 'completed', stage: 'heard' });
    expect([whole.state.echoesThisLoop.includes('echo_flickering_man'), carries(whole.state, 'item_dasks_scout_badge'), xpOf(whole.events), loyalty(whole.state, 'dask')]).toEqual([true, 1, 150, 25]);
    expect(nodesSeen(play(whole.state, [talk('npc_dask')], { content: pack, profile: sentence.profile }).events)).toEqual(['met_them']);
    // Loop 1: a flicker, not a conversation
    const one = at({ locationId: 'loc_shimmering_pass' }, 1);
    expect(play(one.s, [{ reject: talk('npc_dask'), reason: 'is not here' }], { content: pack, profile: one.profile }).state.mode).toBe('explore');
  });

  test('the last instant at the Apex: the communion done with Dask beside you opens his choice; rest → `echo_dask_rest`, he is gone, 400 XP; stay → `flag_dask_anchor`', () => {
    const base = { locationId: 'loc_temporal_breach_apex', quests: { q_the_last_instant: 'ask_it' }, flags: { flag_tyrant_spared: true }, patch: withCompanion('dask', { loyalty: 55 }) };
    const { s, profile } = at(base, 3, ['echo_tyrant_speaks']);
    // the Apex cannot be waited in: any step sweeps the quest on
    const look: Action = { type: 'examine', target: { kind: 'location' } };
    const swept = play(s, [look], { content: pack, profile }).state.quests.q_the_last_instant?.stage;
    expect(swept).toBe('gathered');
    const opened = play(s, [look, talk('npc_dask'), go], { content: pack, profile });
    expect([opened.state.dialogue?.sceneId, nodesSeen(opened.events)]).toEqual(['scene_dask_last_instant_choice', ['said_yes', 'one_thing']]);
    const rests = play(opened.state, [pick('rest'), go, go], { content: pack, profile });
    expect(rests.state.quests.q_the_last_instant).toMatchObject({ status: 'completed', stage: 'rests' });
    expect([rests.state.echoesThisLoop.includes('echo_dask_rest'), rests.state.companions.recruited.dask, xpOf(rests.events), nodesSeen(rests.events).slice(-2)]).toEqual([true, undefined, 400, ['afternoon', 'gathered']]);
    const stays = play(opened.state, [pick('stay'), go], { content: pack, profile });
    expect(stays.state.quests.q_the_last_instant).toMatchObject({ status: 'completed', stage: 'stays' });
    expect([stays.state.flags.flag_dask_anchor, stays.state.companions.activeId, loyalty(stays.state, 'dask')]).toEqual([true, 'dask', 55 + 5 + 5 + 5]);
    // without him beside you the ask waits
    const alone = at({ locationId: 'loc_temporal_breach_apex', quests: { q_the_last_instant: 'ask_it' }, flags: { flag_tyrant_spared: true } }, 3, ['echo_tyrant_speaks']);
    expect(play(alone.s, [look], { content: pack, profile: alone.profile }).state.quests.q_the_last_instant?.stage).toBe('ask_it');
  });

  test('camp conversations: a full rest with Nyx opens the first (+2), the second needs 25, the third 50 and the unmasking; each plays once; Dask alike', () => {
    const rest: Action = { type: 'rest', kind: 'full' };
    const camp = (id: 'nyx' | 'dask', o: Partial<CompanionRunState>, flags: Record<string, true> = {}, echoes: string[] = []) =>
      at({ locationId: id === 'nyx' ? 'loc_chasm_of_whispers' : 'loc_shimmering_pass', flags, patch: withCompanion(id, o) }, 2, echoes);
    const first = camp('nyx', {});
    const one = play(first.s, [rest], { content: pack, profile: first.profile });
    expect([one.state.dialogue?.sceneId, loyalty(one.state, 'nyx')]).toEqual(['scene_nyx_camp_1', 2]);
    expect(choiceViews(one.state, pack, first.profile).map((v) => v.id)).toEqual(['why_walk', 'what_hear']);
    const done = play(one.state, [pick('what_hear'), go], { content: pack, profile: first.profile });
    expect([done.state.mode, nodesSeen(done.events)]).toEqual(['explore', ['hear']]);
    // spent: the next night offers nothing below 25
    expect(play(done.state, [rest], { content: pack, profile: first.profile }).state.mode).toBe('explore');
    const second = camp('nyx', { loyalty: 30 }, { flag_scene_done_scene_nyx_camp_1: true });
    const two = play(second.s, [rest, go, pick('what_kept')], { content: pack, profile: second.profile });
    expect([two.state.dialogue?.sceneId, nodesSeen(two.events)]).toEqual(['scene_nyx_camp_2', ['bear', 'eleven', 'kept']]);
    const third = camp('nyx', { loyalty: 60 }, { flag_scene_done_scene_nyx_camp_1: true, flag_scene_done_scene_nyx_camp_2: true });
    expect(play(third.s, [rest], { content: pack, profile: third.profile }).state.mode).toBe('explore'); // not unmasked
    const unmasked = camp('nyx', { loyalty: 60 }, { flag_scene_done_scene_nyx_camp_1: true, flag_scene_done_scene_nyx_camp_2: true }, ['echo_nyx_is_of_the_nine']);
    const three = play(unmasked.s, [rest, go], { content: pack, profile: unmasked.profile });
    expect([three.state.dialogue?.sceneId, nodesSeen(three.events)]).toEqual(['scene_nyx_camp_3', ['there', 'ready']]);
    // Dask in his cleft
    const dask = camp('dask', { loyalty: 25 }, { flag_scene_done_scene_dask_camp_1: true });
    const his = play(dask.s, [rest, pick('nearly_did')], { content: pack, profile: dask.profile });
    expect([his.state.dialogue?.sceneId, nodesSeen(his.events)]).toEqual(['scene_dask_camp_2', ['remembers', 'nearly']]);
    const third_d = camp('dask', { loyalty: 50 }, { flag_scene_done_scene_dask_camp_1: true, flag_scene_done_scene_dask_camp_2: true }, ['echo_nyx_is_of_the_nine']);
    const nyxKnown = play(third_d.s, [rest], { content: pack, profile: third_d.profile });
    expect((nyxKnown.events.findLast((e) => e.t === 'dialogueNode') as { text: string }).text).toContain('The Weaver woman knows them too.');
  });

  test("Nyx's side of the Eye (D-109): in the Sanctum while Sethe's Eye is sought; afterwards, at the lip, the Choir looking or her coming back", () => {
    const sanctum = at({ locationId: 'loc_sanctum_of_threads', reputation: { weavers: 20 }, quests: { q_void_shards: { status: 'completed', stage: 'given' }, q_unlidded_eye: 'lens' } });
    expect(nodesSeen(play(sanctum.s, [talk('npc_nyx')], { content: pack, profile: sanctum.profile }).events)).toEqual(['seam']);
    for (const [stage, nodeId] of [['looked', 'eye_looked'], ['warned', 'eye_warned']] as const) {
      const lip = at({
        locationId: 'loc_chasm_of_whispers',
        quests: { q_void_shards: { status: 'completed', stage: 'given' }, q_tears_of_the_breach: { status: 'completed', stage: 'unanswered' }, q_unlidded_eye: { status: 'completed', stage } },
        flags: { flag_scene_done_scene_nyx_deja_vu: true },
        patch: withCompanion('nyx'),
      });
      expect([stage, nodesSeen(play(lip.s, [talk('npc_nyx')], { content: pack, profile: lip.profile }).events)]).toEqual([stage, [nodeId]]);
    }
  });
});
