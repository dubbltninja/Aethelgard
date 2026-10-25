// U58: the four loop-only quests and their scenes (src/content/shared/{quests,dialogues}/loop.ts), held to their sources read at
// test time: STORY (§11.1's table, §11.5's blocks — stage journals, prerequisites, consequences, rewards — §9.4 the ritual's
// four attempts and Masque's line, §12's Echo rows, §2.3's verses), DESIGN (§6.2 the loop-only tier) and the two barrel
// headers' conventions (D-105). The hooks in the regions (each a listed edit) are pinned, then the scenes are played through
// the engine on the real pack (makeState + play): the count's watch, the attempts' Echoes and the Last Bell that holds, the
// carrel without drawing.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { dialogues as RAW_SCENES } from '@content/shared/dialogues/loop';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { RITUAL_ATTEMPT_SCENES, quests as RAW_QUESTS } from '@content/shared/quests/loop';
import { FLAG_ENTERED_VIA_NEXUS, ritualResolved } from '@engine/before';
import { legalActions, type Action, type GameEvent, type GameState } from '@engine/index';
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
const loopScenes = RAW_SCENES.map((s) => scene(s.id));
const loopQuests = RAW_QUESTS.map((q) => quest(q.id));

const QUEST_IDS = ['q_the_thirtieth_dawn', 'q_what_the_crystal_heard', 'q_stop_the_ritual', 'q_the_first_drowned'];
const SCENE_IDS = [
  'scene_dray_thirtieth_dawn_offer',
  'scene_dray_thirtieth_dawn_waiting',
  'scene_dray_thirtieth_dawn_report',
  'scene_dray_thirtieth_dawn_after',
  'scene_depths_count_beats',
  'scene_ritual_warn_veyran',
  'scene_ritual_keep_hallow',
  'scene_ritual_steal_record',
  'scene_ritual_break_cradle',
  'scene_masque_roof',
  'scene_oriel_carrel_again',
];
/** The scenes a place opens (no `npcId`): the region's event that opens each (each a listed edit). */
const PLACE_SCENES: Record<string, [locationId: string, eventId: string]> = {
  scene_depths_count_beats: ['loc_heartstone_depths', 'ev_depths_count_beats'],
  scene_ritual_steal_record: ['loc_archives_of_danthe', 'ev_archives_fair_copy'],
  scene_ritual_break_cradle: ['loc_conflux_chamber', 'ev_conflux_cradle'],
  scene_masque_roof: ['loc_ninefold_hall', 'ev_hall_masque_roof'],
  scene_oriel_carrel_again: ['loc_sunken_archives', 'ev_archives_oriel_carrel'],
};

// ---- Reading STORY ---------------------------------------------------------------------------------------------------------------

const STORY_FLAT = STORY.replace(/\n\s*>?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ');
const inStory = (text: string): boolean => text.split('\n').every((line) => STORY_FLAT.includes(line));
function storyBlock(questId: string): string {
  const start = STORY.indexOf(`#### \`${questId}\``);
  if (start < 0) throw new Error(`no STORY §11.5 block for ${questId}`);
  const end = STORY.indexOf('\n#### ', start + 10);
  return STORY.slice(start, end < 0 ? undefined : end).replace(/\n\s*/g, ' ').replace(/\*/g, '');
}
function echoRow(id: string): string[] {
  const catalog = STORY.slice(STORY.indexOf('## 12. Echo catalog'), STORY.indexOf('## 13. Key scenes'));
  return need(catalog.split('\n').find((l) => l.startsWith('| `') && l.includes(`\`${id}\``)), `STORY §12 ${id}`).split('|').map((c) => c.trim());
}
const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const grantsOf = (effects: readonly Effect[]): string[] => effects.flatMap((e) => ('grantEcho' in e ? [e.grantEcho] : 'onlyIf' in e ? grantsOf(e.onlyIf.effects) : []));

// ---- The quests -----------------------------------------------------------------------------------------------------------------

describe('the four loop-only quests (STORY §11.1, §11.5)', () => {
  const table = STORY.slice(STORY.indexOf('### 11.1 Table'), STORY.indexOf('### 11.2'));
  const row = (id: string): string[] => need(table.split('\n').find((l) => l.startsWith(`| \`${id}\``)), id).split('|').map((c) => c.trim());

  test('the four are registered as loop quests after the regional six, in STORY order, with STORY’s names, givers and Loop 2 gates', () => {
    expect(loopQuests.map((q) => q.id)).toEqual(QUEST_IDS);
    expect(STORY).toContain('loop-only 4');
    expect(Object.values(pack.quests).filter((q) => q.category === 'loop').map((q) => q.id)).toEqual(QUEST_IDS);
    const givers: Record<string, string | undefined> = { 'Keeper Dray': 'npc_ansel_dray', 'self (Amulet)': undefined, self: undefined, discovery: undefined };
    for (const id of QUEST_IDS) {
      const q = quest(id);
      const r = row(id);
      expect([id, q.name, r[3]?.startsWith('Loop-only'), q.giverNpcId]).toEqual([id, r[2], true, givers[r[4] as string]]);
      expect([id, (r[6] ?? '').startsWith('2+')]).toEqual([id, true]);
      expect([id, JSON.stringify(q.availableWhen ?? q.startWhen).includes('"loop"')]).toEqual([id, true]);
      expect([id, r[7]]).toEqual([id, 'yes']);
    }
    // bots: all / all / X P / P X
    expect(QUEST_IDS.map((id) => quest(id).botHint)).toEqual(['explorer', 'explorer', 'explorer', 'pacifist']);
  });

  test('prereqs are STORY §11.5’s: Dray’s any-of; the Nine Voices and the Crystal kept; the Before’s route; the First Drowned met', () => {
    expect(quest('q_the_thirtieth_dawn').availableWhen).toEqual({ any: [{ echo: 'echo_thirtieth_dawn' }, { echo: 'echo_breach_clock' }, { loop: { min: 2 } }] });
    expect(storyBlock('q_the_thirtieth_dawn')).toContain('Prereq: `{ any: [ { echo: "echo_thirtieth_dawn" }, { echo: "echo_breach_clock" }, { loop: { min: 2 } } ] }`');
    expect(quest('q_what_the_crystal_heard').startWhen).toEqual({ all: [FROM_LOOP_2, { echo: 'echo_nine_voices' }, { flag: 'flag_kept_echo_crystal' }] });
    expect(storyBlock('q_what_the_crystal_heard')).toContain('Prereq: `echo_nine_voices` and the Crystal kept this loop.');
    expect(quest('q_stop_the_ritual').startWhen).toEqual({ all: [FROM_LOOP_2, { region: 'region_silverwood_before' }, { echo: 'echo_before_route' }] });
    expect(storyBlock('q_stop_the_ritual')).toContain('Where: Silverwood Before. Prereq: `echo_before_route`.');
    expect(quest('q_the_first_drowned').availableWhen).toEqual({ all: [FROM_LOOP_2, { echo: 'echo_oriel_drowned' }] });
    expect(storyBlock('q_the_first_drowned')).toContain('Prereq: `echo_oriel_drowned`.');
    for (const q of loopQuests) expect([q.id, q.repeatablePerLoop, q.countsForApex]).toEqual([q.id, true, true]);
  });

  test('the first stage’s journal is STORY’s stage 1 journal, verbatim (tag story); every other journal is written, pinned and ≤ 40 words', () => {
    for (const q of loopQuests) {
      const first = q.stages[0] as Quest['stages'][number];
      expect([q.id, first.tags, inStory(first.journal)]).toEqual([q.id, ['story'], true]);
      expect(storyBlock(q.id)).toContain(`Journal: "${first.journal}"`);
      for (const st of q.stages.slice(1)) expect([q.id, st.id, st.tags, WRITTEN.journals.includes(st.journal)]).toEqual([q.id, st.id, ['written'], true]);
      for (const st of q.stages) expect([q.id, st.id, words(st.journal) <= 40]).toEqual([q.id, st.id, true]);
      expect([q.id, WRITTEN.other.includes(q.description)]).toEqual([q.id, true]);
    }
  });

  test('DESIGN §6.2: loop-only 300 XP; STORY’s rewards and consequences — the Breach Clock; Weavers −5 and the unfinished verse; 15 Resonance; Remnants +5', () => {
    expect(DESIGN).toContain('loop-only 300');
    for (const q of loopQuests) expect([q.id, q.rewards.xp]).toEqual([q.id, 300]);
    expect(quest('q_the_thirtieth_dawn').rewards.echoes).toEqual(['echo_breach_clock']);
    expect(storyBlock('q_the_thirtieth_dawn')).toContain('Consequences. `echo_breach_clock`; the Breach Clock shows every clock effect from now on.');
    expect(echoRow('echo_breach_clock')[3]).toContain('`q_the_thirtieth_dawn`');
    expect([quest('q_what_the_crystal_heard').rewards.rep, quest('q_what_the_crystal_heard').rewards.echoes]).toEqual([[{ faction: 'weavers', delta: -5 }], ['echo_ninth_verse_unfinished']]);
    expect(storyBlock('q_what_the_crystal_heard')).toContain('`echo_ninth_verse_unfinished` (a source of `echo_tyrant_jailer`); Weavers −5 (she is angry)');
    expect(quest('q_stop_the_ritual').rewards.resonance).toBe(15);
    expect(storyBlock('q_stop_the_ritual')).toContain('Rewards. 15 Resonance.');
    expect(quest('q_the_first_drowned').rewards.rep).toEqual([{ faction: 'remnants', delta: 5 }]);
    expect(storyBlock('q_the_first_drowned')).toContain('Remnants +5. Rewards. tier XP only.');
    for (const q of loopQuests) expect([q.id, q.rewards.items, q.rewards.gold]).toEqual([q.id, [], 0]);
  });

  test('the ritual’s Echoes are the attempts’ (STORY §9.4, §12): stop at attempt 2, the inevitable on the dome, verses IV, VII and IX heard', () => {
    expect(grantsOf(node('scene_ritual_keep_hallow', 'hollow').onEnter)).toEqual(['echo_hallow_said_stop']);
    expect(grantsOf(node('scene_ritual_keep_hallow', 'verse').onEnter)).toEqual(['echo_litany_verse_4']);
    expect(grantsOf(node('scene_ritual_warn_veyran', 'draft').onEnter)).toEqual(['echo_litany_verse_9']);
    expect(grantsOf(node('scene_masque_roof', 'verse').onEnter)).toEqual(['echo_litany_verse_7']);
    expect(grantsOf(node('scene_masque_roof', 'read').onEnter)).toEqual(['echo_ritual_inevitable']);
    expect(storyBlock('q_stop_the_ritual')).toContain('Consequences. `echo_hallow_said_stop` (attempt 2), `echo_ritual_inevitable` (attempt 4), verses 4, 7, 9 heard.');
    expect(echoRow('echo_hallow_said_stop')[3]).toContain('`q_stop_the_ritual`');
    expect(echoRow('echo_ritual_inevitable')[3]).toBe('`q_stop_the_ritual` attempt 4');
    expect(read('docs/DECISIONS.md')).toContain('`echo_threshold` and `echo_ritual_inevitable` are granted by U57/U58.');
    // the carrel: verse I either way (idempotent), the scroll either way
    for (const id of ['mine', 'verse_one']) expect([id, grantsOf(node('scene_oriel_carrel_again', id).onEnter)]).toEqual([id, ['echo_litany_verse_1']]);
    for (const id of ['mine', 'enough']) expect([id, node('scene_oriel_carrel_again', id).onEnter[0]]).toEqual([id, { giveItem: { item: 'item_scholars_lost_scroll' } }]);
    expect(choice('scene_oriel_carrel_again', 'ink', 'ring').when).toEqual({ item: { id: 'item_oriels_ring' } });
    expect(choice('scene_oriel_carrel_again', 'ink', 'listen').tags).toEqual(['echo']);
    const granted = [...loopQuests.flatMap((q) => q.rewards.echoes), ...loopScenes.flatMap((s) => s.nodes.flatMap((n) => [...grantsOf(n.onEnter), ...n.choices.flatMap((c) => grantsOf(c.effects))]))];
    for (const id of granted) expect([id, pack.echoes[id] !== undefined]).toEqual([id, true]);
  });

  test('the stage graphs: the Depths and the Library; the Chasm with the Crystal and the Echo line’s flag; the four attempts’ scene flags; a stage a scene ends waits', () => {
    expect(stage('q_the_thirtieth_dawn', 'drift').objectives.map((o) => o.when)).toEqual([{ location: 'loc_heartstone_depths' }]);
    expect(stage('q_the_thirtieth_dawn', 'compare').objectives.map((o) => o.when)).toEqual([{ location: 'loc_shattered_library' }]);
    expect(stage('q_what_the_crystal_heard', 'nine_voices').objectives.map((o) => o.when)).toEqual([{ all: [{ location: 'loc_chasm_of_whispers' }, { item: { id: 'item_echo_crystal' } }] }]);
    expect(stage('q_what_the_crystal_heard', 'listen').objectives.map((o) => o.when)).toEqual([{ flag: 'flag_named_nyx' }]);
    expect(stage('q_stop_the_ritual', 'try').objectives.map((o) => o.when)).toEqual(RITUAL_ATTEMPT_SCENES.map((id) => ({ flag: `flag_scene_done_${id}` })));
    expect(RITUAL_ATTEMPT_SCENES).toEqual(['scene_ritual_warn_veyran', 'scene_ritual_keep_hallow', 'scene_ritual_steal_record', 'scene_ritual_break_cradle']);
    expect(STORY).toContain('2–5. Warn Veyran; keep\nHallow; steal the record; break the cradle. 6. Masque, from the Hall\'s dome.');
    for (const [questId, stageId] of [['q_the_thirtieth_dawn', 'count'], ['q_stop_the_ritual', 'masque'], ['q_the_first_drowned', 'carrel']]) {
      const st = stage(questId as string, stageId as string);
      expect([questId, stageId, st.objectives.length, typeof st.next]).toEqual([questId, stageId, 0, 'string']);
    }
    const ends: [readonly Effect[], string, string][] = [
      [node('scene_depths_count_beats', 'number').onEnter, 'q_the_thirtieth_dawn', 'compare'],
      [node('scene_dray_thirtieth_dawn_report', 'clock').onEnter, 'q_the_thirtieth_dawn', 'done'],
      [node('scene_masque_roof', 'read').onEnter, 'q_stop_the_ritual', 'inevitable'],
      [node('scene_oriel_carrel_again', 'mine').onEnter, 'q_the_first_drowned', 'given'],
      [node('scene_oriel_carrel_again', 'enough').onEnter, 'q_the_first_drowned', 'given'],
    ];
    for (const [effects, questId, stageId] of ends) expect([questId, stageId, effects.at(-1)]).toEqual([questId, stageId, { questAdvance: { quest: questId, stage: stageId } }]);
    for (const [questId, stageId] of [['q_the_thirtieth_dawn', 'done'], ['q_what_the_crystal_heard', 'heard'], ['q_stop_the_ritual', 'inevitable'], ['q_the_first_drowned', 'given']]) {
      expect([questId, stageId, stage(questId as string, stageId as string).outcome]).toEqual([questId, stageId, 'complete']);
    }
    // no quest opens a scene (the barrel's rule)
    for (const q of loopQuests) expect([q.id, JSON.stringify(q.stages).includes('startDialogue')]).toEqual([q.id, false]);
  });
});

// ---- The scenes -----------------------------------------------------------------------------------------------------------------

describe('the scenes (STORY §9.4, §11.5, §13; the barrel’s conventions)', () => {
  test('the eleven scenes are registered; every NPC scene is closed in the Horde and sits in its band; the place scenes have no npcId and an event each', () => {
    expect(loopScenes.map((s) => s.id)).toEqual(SCENE_IDS);
    for (const s of loopScenes) {
      if (s.npcId === undefined) {
        expect([s.id, s.id in PLACE_SCENES]).toEqual([s.id, true]);
        const [locationId, eventId] = PLACE_SCENES[s.id] as [string, string];
        const ev = event(locationId, eventId);
        expect([s.id, JSON.stringify(ev.effects).includes(`"startDialogue":"${s.id}"`)]).toEqual([s.id, true]);
      } else {
        expect([s.id, JSON.stringify(s.when).startsWith(JSON.stringify({ all: [NOT_IN_HORDE] }).slice(0, -2))]).toEqual([s.id, true]);
        expect([s.id, Object.values(SCENE_PRIORITY).includes(s.priority as never)]).toEqual([s.id, true]);
      }
    }
    expect(scene('scene_dray_thirtieth_dawn_offer').priority).toBe(SCENE_PRIORITY.offer);
    expect(scene('scene_dray_thirtieth_dawn_report').priority).toBe(SCENE_PRIORITY.report);
    for (const id of ['scene_ritual_warn_veyran', 'scene_ritual_keep_hallow']) expect([id, scene(id).priority, scene(id).repeatable]).toEqual([id, SCENE_PRIORITY.decision, false]);
    // the Depths' count and the carrel are interacts; the dome is Last Bell's arrival; the attempts' interacts hide once played
    expect([event('loc_heartstone_depths', 'ev_depths_count_beats').trigger, event('loc_heartstone_depths', 'ev_depths_count_beats').when]).toEqual(['interact', { quest: { id: 'q_the_thirtieth_dawn', stage: 'count' } }]);
    expect(event('loc_sunken_archives', 'ev_archives_oriel_carrel').trigger).toBe('interact');
    expect(event('loc_ninefold_hall', 'ev_hall_masque_roof').effects).toEqual([{ onlyIf: { when: { quest: { id: 'q_stop_the_ritual', stage: 'masque' } }, effects: [{ startDialogue: 'scene_masque_roof' }] } }]);
    expect(event('loc_conflux_chamber', 'ev_conflux_cradle').when).toEqual({ all: [{ quest: { id: 'q_stop_the_ritual', stage: 'try' } }, { not: { flag: 'flag_scene_done_scene_ritual_break_cradle' } }] });
    // the Hall's Knight lets the fourth failure by (the quest is Pacifist)
    expect(loc('loc_ninefold_hall').encounters.find((e) => e.id === 'enc_hall_knight')?.optionalWhen).toEqual({ quest: { id: 'q_stop_the_ritual', stage: 'masque' } });
  });

  test('every node is tagged; story nodes are STORY’s lines verbatim; written nodes are the pinned ones; no node is unmarked', () => {
    const written: string[] = [];
    for (const s of loopScenes) {
      for (const n of s.nodes) {
        expect([s.id, n.id, n.tags.length]).toEqual([s.id, n.id, 1]);
        const tag = n.tags[0];
        if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else {
          expect([s.id, n.id, tag]).toEqual([s.id, n.id, 'written']);
          written.push(`${s.id}.${n.id}`);
        }
        for (const v of n.textVariants) expect([s.id, n.id, WRITTEN.variants.includes(v.text) || inStory(v.text)]).toEqual([s.id, n.id, true]);
      }
    }
    expect(written.sort()).toEqual([...WRITTEN.nodes].sort());
    // STORY §9.4's lines, where they fall
    expect(node('scene_ritual_warn_veyran', 'know').text).toBe('You have seen it fail. Then you have seen the version in which I did not know. Now I know.');
    expect(node('scene_ritual_break_cradle', 'wish').text).toBe('Iron that does not wish.');
    expect(node('scene_masque_roof', 'too').text).toBe('You see it too now. From the far side. It was always going to fail, and we were always going to do it.');
    expect(node('scene_masque_roof', 'too').speaker).toBe('npc_tovren_masque');
    // STORY §2.3's verses, whole
    const litany = STORY.slice(STORY.indexOf('### 2.3 The Litany'), STORY.indexOf('### 2.4'));
    for (const [id, n] of [['scene_ritual_keep_hallow', 'verse'], ['scene_masque_roof', 'verse'], ['scene_oriel_carrel_again', 'verse_one']]) {
      for (const line of node(id as string, n as string).text.split('\n')) expect([id, line, litany.includes(line)]).toEqual([id, line, true]);
    }
  });

  test('written words are short and in voice: Dray cites a year; Veyran is kind and certain; Hallow is forge-plain; the Tyrant\'s name is never "it" in Nyx\'s mouth (no Nyx here)', () => {
    expect(node('scene_dray_thirtieth_dawn_offer', 'ashcombe').text).toContain('309');
    expect(node('scene_dray_thirtieth_dawn_report', 'margin').text).toContain('Thirty from the first');
    expect(node('scene_ritual_warn_veyran', 'draft').text).toContain('The Holding is a kindness to the hour');
    expect(node('scene_ritual_keep_hallow', 'cradle').text).toContain("doesn't want anything");
    for (const s of loopScenes) for (const n of s.nodes) expect([s.id, n.id, words(n.text) <= 80]).toEqual([s.id, n.id, true]);
    for (const banned of ['eldritch', 'unspeakable', 'suddenly', 'literally', 'nightmarish']) {
      for (const s of loopScenes) for (const n of s.nodes) expect([s.id, n.id, banned, n.text.toLowerCase().includes(banned)]).toEqual([s.id, n.id, banned, false]);
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
  /** Standing in Silverwood Before on Bell `day` (the mirror flag, the frozen clock, the Nexus door behind), `echo_before_route` held. */
  const inBefore = (o: StateOverrides, day: 1 | 2 | 3) =>
    at(
      {
        ...o,
        patch: (s) => {
          s.before = { day, resets: 0 };
          s.clock.frozen = true;
          s.flags[`flag_before_day_${day}`] = true;
          s.flags[FLAG_ENTERED_VIA_NEXUS] = true;
          o.patch?.(s);
        },
      },
      2,
      ['echo_before_route'],
    );
  const talk = (npcId: string): Action => ({ type: 'talk', npcId });
  const pick = (choiceId: string): Action => ({ type: 'choose', choiceId });
  const interact = (eventId: string): Action => ({ type: 'interact', eventId });
  const go: Action = { type: 'continue' };
  const nodesSeen = (events: readonly Ev[]): string[] => events.flatMap((e) => (e.t === 'dialogueNode' ? [e.nodeId] : []));
  const legalIds = (s: GameState, profile: ReturnType<typeof freshProfile>) => legalActions(s, pack, profile).flatMap((a) => (a.type === 'choose' ? [a.choiceId] : []));
  /** Through open dialogue: each pick chosen as soon as it is legal (continuing until it is), the way the sim's `talk` step plays. */
  const drive = (s: GameState, profile: ReturnType<typeof freshProfile>, picks: readonly string[]): ReturnType<typeof play> => {
    const script: Action[] = [];
    let cur = s;
    for (const id of picks) {
      for (let i = 0; i < 20 && !legalIds(cur, profile).includes(id); i++) {
        if (cur.mode !== 'dialogue') throw new Error(`drive: ${id} never came up (mode ${cur.mode})`);
        script.push(go);
        cur = play(cur, [go], { content: pack, profile }).state;
      }
      script.push(pick(id));
      cur = play(cur, [pick(id)], { content: pack, profile }).state;
    }
    return play(s, script, { content: pack, profile });
  };

  test('the Thirtieth Dawn: Dray’s ask from Loop 2, one watch passes in the counting at the Depths, the number against the water pays the Breach Clock', () => {
    const { s, profile } = at({ locationId: 'loc_shattered_library' });
    const asked = play(s, [talk('npc_ansel_dray'), go, pick('yes'), go], { content: pack, profile });
    expect(asked.state.quests.q_the_thirtieth_dawn).toMatchObject({ status: 'active', stage: 'drift' });
    const depths = at({ locationId: 'loc_heartstone_depths', quests: { q_the_thirtieth_dawn: 'count' }, day: 3, watch: 1 });
    expect(legalActions(depths.s, pack, depths.profile)).toContainEqual(interact('ev_depths_count_beats'));
    const counted = play(depths.s, [interact('ev_depths_count_beats'), go, go], { content: pack, profile: depths.profile });
    expect(counted.state.clock.ticks - depths.s.clock.ticks).toBe(1);
    expect(counted.state.quests.q_the_thirtieth_dawn).toMatchObject({ status: 'active', stage: 'compare' });
    const library = at({ locationId: 'loc_shattered_library', quests: { q_the_thirtieth_dawn: 'compare' } });
    const paid = play(library.s, [talk('npc_ansel_dray'), go, go, go], { content: pack, profile: library.profile });
    expect(nodesSeen(paid.events)).toEqual(['number', 'margin', 'clock']);
    expect(paid.state.quests.q_the_thirtieth_dawn).toMatchObject({ status: 'completed', stage: 'done' });
    expect(paid.state.echoesThisLoop).toContain('echo_breach_clock');
    // a refusal steps the offer aside for the loop: the idle line next
    const refused = play(s, [talk('npc_ansel_dray'), go, pick('no'), go], { content: pack, profile });
    expect(refused.state.flags.flag_choice_scene_dray_thirtieth_dawn_offer_no).toBe(true);
    expect(nodesSeen(play(refused.state, [talk('npc_ansel_dray')], { content: pack, profile }).events)).toEqual(['later']);
  });

  test('the Crystal heard: the Amulet starts it from Loop 2 with the Nine Voices once the Crystal is kept; the lip’s Echo line completes it with the unmasking (U55’s scene)', () => {
    const { s, profile } = at({ locationId: 'loc_whispering_ruins', flags: { flag_kept_echo_crystal: true } }, 2, ['echo_nine_voices']);
    const started = play(s, [{ type: 'wait' }], { content: pack, profile });
    expect(started.state.quests.q_what_the_crystal_heard).toMatchObject({ status: 'active', stage: 'nine_voices' });
    const chasm = at({ locationId: 'loc_chasm_of_whispers', items: ['item_echo_crystal'], quests: { q_what_the_crystal_heard: 'nine_voices' }, flags: { flag_kept_echo_crystal: true } }, 2, ['echo_nine_voices']);
    const there = play(chasm.s, [{ type: 'wait' }], { content: pack, profile: chasm.profile });
    expect(there.state.quests.q_what_the_crystal_heard).toMatchObject({ stage: 'listen' });
    const talked = play(there.state, [talk('npc_nyx')], { content: pack, profile: chasm.profile });
    const said = drive(talked.state, chasm.profile, ['i_know']);
    expect(said.state.dialogue?.sceneId).toBe('scene_nyx_unmasking');
    expect(said.state.flags.flag_named_nyx).toBe(true);
    const heard = drive(said.state, chasm.profile, ['nine', 'tyrant', 'safe']);
    expect(heard.state.quests.q_what_the_crystal_heard).toMatchObject({ status: 'completed', stage: 'heard' });
    for (const id of ['echo_nyx_is_of_the_nine', 'echo_ninth_verse_unfinished']) expect(heard.state.echoesThisLoop).toContain(id);
    expect(heard.state.reputation.weavers).toBe(there.state.reputation.weavers - 5 + 10); // her anger, and her secret kept
  });

  test('the First Drowned: the carrel approached without drawing (an interact from Loop 2 with the Echo while the scroll is hers); the Amulet, verse I in her voice, the scroll; the fight never comes', () => {
    const { s, profile } = at({ locationId: 'loc_drowned_stair', quests: { q_lost_scroll: 'recover' } }, 2, ['echo_oriel_drowned']);
    const arrived = play(s, [{ type: 'move', to: 'loc_sunken_archives' }], { content: pack, profile });
    expect(arrived.state.mode).toBe('explore'); // the Archivist's fight is optional with the Echo
    expect(legalActions(arrived.state, pack, profile)).toContainEqual(interact('ev_archives_oriel_carrel'));
    const opened = play(arrived.state, [interact('ev_archives_oriel_carrel'), pick('approach')], { content: pack, profile });
    expect(opened.state.quests.q_the_first_drowned).toMatchObject({ status: 'active', stage: 'carrel' });
    expect(legalIds(opened.state, profile)).toEqual(['leave', 'listen']); // no ring in the pack
    const given = play(opened.state, [pick('listen'), go, go, go], { content: pack, profile });
    expect(given.state.quests.q_the_first_drowned).toMatchObject({ status: 'completed', stage: 'given' });
    expect(given.state.quests.q_lost_scroll).toMatchObject({ status: 'active', stage: 'deliver' });
    expect(given.state.echoesThisLoop).toContain('echo_litany_verse_1');
    expect(given.state.player.inventory.some((i) => i.itemId === 'item_scholars_lost_scroll')).toBe(true);
    expect(given.state.reputation.remnants - s.reputation.remnants).toBe(5);
    // with the ring, her ring's way
    const ringed = at({ locationId: 'loc_sunken_archives', quests: { q_lost_scroll: 'recover' }, items: ['item_oriels_ring'] }, 2, ['echo_oriel_drowned']);
    const mine = play(ringed.s, [interact('ev_archives_oriel_carrel'), pick('approach'), pick('ring'), go], { content: pack, profile: ringed.profile });
    expect(nodesSeen(mine.events)).toEqual(['reading', 'ink', 'mine']);
    expect(mine.state.quests.q_the_first_drowned).toMatchObject({ status: 'completed', stage: 'given' });
  });

  test('Stop the Ritual: each attempt once a loop, in any order; the four bring the dome; Masque pays the inevitable and Last Bell holds', () => {
    const base = inBefore({ locationId: 'loc_conflux_chamber', quests: { q_stop_the_ritual: 'try' } }, 3);
    // the cradle: Hallow's iron holds; the attempt's interact hides once played
    const cradle = play(base.s, [interact('ev_conflux_cradle'), pick('break'), go, go, go], { content: pack, profile: base.profile });
    expect(nodesSeen(cradle.events)).toEqual(['iron', 'holds', 'wish', 'wanting']);
    expect(cradle.state.flags.flag_scene_done_scene_ritual_break_cradle).toBe(true);
    expect(legalActions(cradle.state, pack, base.profile)).not.toContainEqual(interact('ev_conflux_cradle'));
    expect(cradle.state.quests.q_stop_the_ritual?.objectivesDone).toContain('obj_cradle');
    // Hallow at his forge: stop, and the fourth verse
    const hallow = play(cradle.state, [talk('npc_durn_hallow'), pick('stay'), go, go, go, go], { content: pack, profile: base.profile });
    for (const id of ['echo_hallow_said_stop', 'echo_litany_verse_4']) expect(hallow.state.echoesThisLoop).toContain(id);
    for (const id of ['obj_cradle', 'obj_hallow']) expect(hallow.state.quests.q_stop_the_ritual?.objectivesDone).toContain(id);
    expect(ritualResolved(hallow.state)).toBe(false);
    // the dome on Last Bell, the four done: Masque's inevitable, verse VII, the quest complete; Last Bell holds
    const done = inBefore({ locationId: 'loc_plaza_of_bells', quests: { q_stop_the_ritual: 'masque' } }, 3);
    const dome = play(done.s, [{ type: 'move', to: 'loc_ninefold_hall' }], { content: pack, profile: done.profile });
    expect(dome.state.mode).toBe('dialogue'); // the Knight lets this one visitor by
    expect(dome.state.dialogue?.sceneId).toBe('scene_masque_roof');
    const read = play(dome.state, [go, go, go, go], { content: pack, profile: done.profile });
    expect(nodesSeen(read.events)).toEqual(['four', 'too', 'verse', 'read']);
    for (const id of ['echo_litany_verse_7', 'echo_ritual_inevitable']) expect(read.state.echoesThisLoop).toContain(id);
    expect(read.state.quests.q_stop_the_ritual).toMatchObject({ status: 'completed', stage: 'inevitable' });
    expect(ritualResolved(read.state)).toBe(true);
    expect(read.profile.resonance - done.profile.resonance).toBe(15);
  });
});

// ---- Pinned written words (listed in the U58 reply) ------------------------------------------------------------------------------

const WRITTEN = {
  journals: [
    "Count the Heartstone's beats for one watch in the Depths. Keep still; the stone does not.",
    'Carry the count to the Library. Dray will set it against the water-clock; the difference is the days you have.',
    'The number is the days remaining. Dray has written it in the margin, and the Breach Clock shows every hour it loses or gains.',
    'Say it to her face at the lip of the Chasm, the Crystal in your hand: you know what she is. Then let the eighth voice speak.',
    'She heard the eighth verse in her own voice. The ninth voice on the Crystal has not finished its verse. Nyx is angry, and the Choir does not know.',
    'Four times, four ways, and the ninth bell still cracks. On Last Bell go up to the Hall. Masque is on the dome, and he has read it twice.',
    'It was always going to fail, and they were always going to do it. You see it from the far side now. Last Bell holds.',
    'She gave up the scroll without rising, and the first verse in her own voice. Nobody drew. Tell them the ink still holds.',
  ],
  other: [
    "Keeper Dray asks you to count the Heartstone's beats for one watch and set the count against his water-clock.",
    'The Crystal holds nine voices, and the Amulet knows one of them is in the Chasm.',
    'You are three days before the Sundering, and the Nine are alive. Try to stop them.',
    'The Drowned Archivist in the carrel under the east stair is Oriel Danthe, and she can be spoken to.',
  ],
  variants: [] as string[],
  nodes: [
    'scene_dray_thirtieth_dawn_offer.ashcombe',
    'scene_dray_thirtieth_dawn_offer.ask',
    'scene_dray_thirtieth_dawn_offer.agree',
    'scene_dray_thirtieth_dawn_offer.refused',
    'scene_dray_thirtieth_dawn_waiting.waiting',
    'scene_dray_thirtieth_dawn_report.number',
    'scene_dray_thirtieth_dawn_report.margin',
    'scene_dray_thirtieth_dawn_report.clock',
    'scene_dray_thirtieth_dawn_after.margin',
    'scene_depths_count_beats.still',
    'scene_depths_count_beats.number',
    'scene_ritual_warn_veyran.letter',
    'scene_ritual_warn_veyran.courteous',
    'scene_ritual_warn_veyran.draft',
    'scene_ritual_warn_veyran.anyway',
    'scene_ritual_keep_hallow.cradle',
    'scene_ritual_keep_hallow.how',
    'scene_ritual_keep_hallow.stays',
    'scene_ritual_keep_hallow.hollow',
    'scene_ritual_steal_record.desk',
    'scene_ritual_steal_record.memory',
    'scene_ritual_steal_record.footsteps',
    'scene_ritual_break_cradle.iron',
    'scene_ritual_break_cradle.holds',
    'scene_ritual_break_cradle.wanting',
    'scene_masque_roof.dome',
    'scene_masque_roof.four',
    'scene_masque_roof.read',
    'scene_oriel_carrel_again.reading',
    'scene_oriel_carrel_again.ink',
    'scene_oriel_carrel_again.mine',
    'scene_oriel_carrel_again.verse',
    'scene_oriel_carrel_again.enough',
  ],
};
