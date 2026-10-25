// U58: the six ending quests, their scenes and the Tyrant's words (src/content/shared/quests/endings.ts,
// src/content/shared/dialogues/{endings,tyrant}.ts; the Unveiled Tyrant's communion in glowlands_nexus/creatures.ts), held to
// their sources read at test time: STORY (§11.1's table, §11.6's blocks, §13's seven scenes line for line, §8.2 what it says by
// loop, §5.6 how each path opens, §12's Echo rows), DESIGN (§6.2 the ending tier, §4.11 the Resolution) and the barrels'
// conventions (D-105). The hooks (the Apex's two arrivals, Ilyra's schedule, `onSpared`, the outcomes, the anchor's Offer, the
// silences; each a listed edit) are pinned, then played through the engine on the real pack: the first words by loop, Leave and
// the return, the Dawn's arrival and its waves, the vigil's days and the Archive's choice, the three Resolution scenes.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { DERIVE_LITANY, DERIVE_SCHEMA, LITANY_KNOWN, RESOLUTION_ENDINGS, SCHEMA_KNOWN, dialogues as RAW_ENDING_SCENES } from '@content/shared/dialogues/endings';
import { dialogues as RAW_TYRANT_SCENES } from '@content/shared/dialogues/tyrant';
import { DAWN_WAVE_INTROS, encounters as RAW_ENCOUNTERS, quests as RAW_QUESTS } from '@content/shared/quests/endings';
import { daysLeft, legalActions, makeCtx, openScene, type Action, type CompanionRunState, type GameEvent, type GameState } from '@engine/index';
import { clone } from '@engine/util/clone';
import type { Creature } from '@schema/creature';
import type { DialogueScene } from '@schema/dialogue';
import type { Effect } from '@schema/effect';
import { CLOSER_IDS, TRUE_ENDING_IDS } from '@schema/ending';
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
const endingScenes = RAW_ENDING_SCENES.map((s) => scene(s.id));
const tyrantScenes = RAW_TYRANT_SCENES.map((s) => scene(s.id));
const endingQuests = RAW_QUESTS.map((q) => quest(q.id));

const APEX = 'loc_temporal_breach_apex';
const NEXUS = 'loc_chronos_nexus';
const DEPTHS = 'loc_heartstone_depths';
const UNVEILED = 'cr_chronos_tyrant_unveiled';
const tyrant = (): Creature => need(pack.creatures[UNVEILED], UNVEILED);
const communion = () => need(tyrant().communion, 'the communion');

const QUEST_IDS = ['q_wardens_vigil', 'q_the_mending', 'q_weavers_dawn', 'q_iron_silence', 'q_long_archive', 'q_unbound'];
const ENDING_OF: Record<string, string> = {
  q_wardens_vigil: 'ending_wardens_vigil',
  q_the_mending: 'ending_mending',
  q_weavers_dawn: 'ending_weavers_dawn',
  q_iron_silence: 'ending_iron_silence',
  q_long_archive: 'ending_long_archive',
  q_unbound: 'ending_unbound',
};
const SCENE_IDS = [
  'scene_dask_wardens_vigil_offer',
  'scene_dask_wardens_vigil_waiting',
  'scene_caelum_mending_offer',
  'scene_anchor_in_the_conflux',
  'scene_borin_anchor',
  'scene_nyx_weavers_dawn_offer',
  'scene_ending_dawn',
  'scene_hadda_iron_silence_offer',
  'scene_hadda_iron_silence_waiting',
  'scene_ending_silence',
  'scene_dray_long_archive_offer',
  'scene_ilyra_keep_the_vigil',
  'scene_ending_archive',
  'scene_ending_vigil',
  'scene_ending_mending',
  'scene_ending_unbound',
];
/** STORY §13's seven scenes of this unit, line for line. */
const STORY_SCENES = ['scene_tyrant_first_words', 'scene_anchor_in_the_conflux', 'scene_ending_vigil', 'scene_ending_mending', 'scene_ending_dawn', 'scene_ending_silence', 'scene_ending_archive', 'scene_ending_unbound'];
/** The scenes no NPC opens: who does (a place's event, the Tyrant's data). */
const OPENED_BY: Record<string, string> = {
  scene_anchor_in_the_conflux: 'loc_conflux_chamber.ev_conflux_pin',
  scene_ending_dawn: `${APEX}.ev_apex_dawn`,
  scene_ending_silence: 'the anchor Offer',
  scene_ending_vigil: 'onSpared',
  scene_ending_mending: 'onSpared',
  scene_ending_unbound: 'onSpared',
  scene_tyrant_first_words: `${APEX}.ev_apex_first_words`,
};

// ---- Reading STORY ---------------------------------------------------------------------------------------------------------------

const STORY_FLAT = STORY.replace(/\n\s*>?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ');
/** STORY's bracketed stage directions ("(He sets the pin on the rim.)") are not spoken: the lines around them join. */
const unstaged = (text: string): string => text.replace(/ \([^()]*\)/g, '');
const STORY_SPOKEN = unstaged(STORY_FLAT);
const inStory = (text: string): boolean => text.split('\n').every((line) => STORY_FLAT.includes(line) || STORY_SPOKEN.includes(line));
function storyBlock(questId: string): string {
  const start = STORY.indexOf(`#### \`${questId}\``);
  if (start < 0) throw new Error(`no STORY §11.6 block for ${questId}`);
  const end = STORY.indexOf('\n#### ', start + 10);
  return STORY.slice(start, end < 0 ? undefined : end).replace(/\n\s*/g, ' ').replace(/\*/g, '');
}
/** STORY §13's block for a scene: its bullet lines, emphasis dropped, the speaker labels kept. */
function storyScene(sceneId: string): string[] {
  const start = STORY.indexOf(`#### \`${sceneId}\``);
  if (start < 0) throw new Error(`no STORY §13 scene ${sceneId}`);
  const ends = ['\n#### ', '\n## ', '\n---'].map((m) => STORY.indexOf(m, start + 10)).filter((i) => i >= 0);
  return STORY.slice(start, ends.length === 0 ? undefined : Math.min(...ends))
    .split('\n- ')
    .slice(1)
    .map((l) => unstaged(l.replace(/\n\s*/g, ' ').replace(/\*/g, '').trim()));
}
/** STORY §12's row for an Echo: its cells. */
function echoRow(id: string): string[] {
  const catalog = STORY.slice(STORY.indexOf('## 12. Echo catalog'), STORY.indexOf('## 13. Key scenes'));
  return need(catalog.split('\n').find((l) => l.startsWith(`| \`${id}\``)), `STORY §12 ${id}`).split('|').map((c) => c.trim());
}
const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const grantsOf = (effects: readonly Effect[]): string[] => effects.flatMap((e) => ('grantEcho' in e ? [e.grantEcho] : 'onlyIf' in e ? grantsOf(e.onlyIf.effects) : []));
const endingsOf = (effects: readonly Effect[]): string[] => effects.flatMap((e) => ('ending' in e ? [e.ending] : 'onlyIf' in e ? endingsOf(e.onlyIf.effects) : []));
const openedBy = (effects: readonly Effect[]): string[] => effects.flatMap((e) => ('startDialogue' in e ? [e.startDialogue] : 'onlyIf' in e ? openedBy(e.onlyIf.effects) : []));

// ---- The quests -----------------------------------------------------------------------------------------------------------------

describe('the six ending quests (STORY §11.1, §11.6; DESIGN §6.2)', () => {
  const table = STORY.slice(STORY.indexOf('### 11.1 Table'), STORY.indexOf('### 11.2'));
  const row = (id: string): string[] => need(table.split('\n').find((l) => l.startsWith(`| \`${id}\``)), id).split('|').map((c) => c.trim());
  const GIVER: Record<string, string | undefined> = {
    Dask: 'npc_dask',
    'Borin / Caelum / Ilyra': 'npc_caelum',
    Nyx: 'npc_nyx',
    'Hadda Ironvow': 'npc_hadda_ironvow',
    'Keeper Dray': 'npc_ansel_dray',
    'the Tyrant': undefined,
  };

  test('the six are registered as ending quests A–F in STORY order, one per true ending, with STORY’s names, givers and Loop 2 gates', () => {
    expect(endingQuests.map((q) => q.id)).toEqual(QUEST_IDS);
    expect(STORY).toContain('ending 6');
    expect(Object.values(pack.quests).filter((q) => q.category === 'ending').map((q) => q.id)).toEqual(QUEST_IDS);
    expect(Object.values(ENDING_OF).sort()).toEqual([...TRUE_ENDING_IDS].sort());
    for (const [i, id] of QUEST_IDS.entries()) {
      const q = quest(id);
      const r = row(id);
      expect([id, q.name, r[3], q.giverNpcId]).toEqual([id, r[2], `Ending ${'ABCDEF'[i]}`, GIVER[r[4] as string]]);
      expect([id, (r[6] ?? '').startsWith('2+')]).toEqual([id, true]);
      expect([id, JSON.stringify(q.availableWhen).includes(JSON.stringify(FROM_LOOP_2))]).toEqual([id, true]);
      expect([id, q.startWhen, q.repeatablePerLoop, q.countsForApex]).toEqual([id, undefined, true, true]);
      expect([id, pack.endings[ENDING_OF[id] as string] !== undefined]).toEqual([id, true]);
    }
    // Pacifist: yes for all but the Dawn and the Silence (the table's last column); the bots are the table's
    for (const id of QUEST_IDS) expect([id, row(id)[7]]).toEqual([id, id === 'q_weavers_dawn' || id === 'q_iron_silence' ? 'no' : 'yes']);
    expect(QUEST_IDS.map((id) => quest(id).botHint)).toEqual(['pacifist', 'pacifist', 'melee', 'melee', 'pacifist', 'speedrunner']);
  });

  test('prereqs are STORY §11.6’s, and the endings’ records agree where they overlap', () => {
    expect(quest('q_wardens_vigil').availableWhen).toEqual({ all: [FROM_LOOP_2, { echo: 'echo_litany_complete' }] });
    expect(storyBlock('q_wardens_vigil')).toContain('Giver: Dask. Prereq: `echo_litany_complete`.');
    expect(quest('q_the_mending').availableWhen).toEqual({
      all: [FROM_LOOP_2, { echo: 'echo_anchor_mechanic' }, { echo: 'echo_heartstone_resonance' }, { echo: 'echo_void_resonance' }, { echo: 'echo_litany_complete' }, { echo: 'echo_anchor_schema' }],
    });
    expect(storyBlock('q_the_mending')).toContain('Prereq: `echo_anchor_mechanic`, `echo_heartstone_resonance`, `echo_void_resonance`, `echo_litany_complete`, `echo_anchor_schema`.');
    expect(quest('q_weavers_dawn').availableWhen).toEqual({
      all: [
        FROM_LOOP_2,
        { rep: { faction: 'weavers', min: 60 } },
        { flag: 'flag_heartstone_exploited' },
        { item: { id: 'item_heartstone_core' } },
        { loyalty: { companion: 'nyx', min: 50 } },
        { quest: { id: 'q_what_she_would_undo', stage: 'agreed' } },
        { not: { flag: 'flag_tyrant_dead' } },
      ],
    });
    expect(storyBlock('q_weavers_dawn')).toContain('Prereq: Weavers ≥ 60; `flag_heartstone_exploited`; Nyx Loyal; `q_what_she_would_undo` agreed; the Tyrant alive.');
    expect(DESIGN).toContain('50 → arc stage 3'); // DESIGN §12.5's loyalty thresholds: Loyal is 50
    expect(quest('q_weavers_dawn').failWhen).toEqual({ flag: 'flag_tyrant_dead' }); // D-067.13
    expect(quest('q_iron_silence').availableWhen).toEqual({
      all: [FROM_LOOP_2, { rep: { faction: 'ironclad', min: 60 } }, { flag: 'flag_heartstone_destroyed' }, { echo: 'echo_iron_that_does_not_wish' }, { echo: 'echo_anchor_schema' }],
    });
    expect(storyBlock('q_iron_silence')).toContain('Prereq: Ironclad ≥ 60; `flag_heartstone_destroyed`; `echo_iron_that_does_not_wish`; `echo_anchor_schema`.');
    expect(quest('q_long_archive').availableWhen).toEqual({
      all: [
        FROM_LOOP_2,
        { rep: { faction: 'remnants', min: 60 } },
        { flag: 'flag_heartstone_stabilized' },
        { echo: 'echo_heartstone_resonance' },
        { any: [{ not: { corruption: { min: 6 } } }, { flag: 'flag_corruption_cleansed' }] },
        { companion: { id: 'ilyra', state: 'recruited' } },
        { quest: { id: 'q_the_keepers_price', stage: 'keeper' } },
      ],
    });
    expect(storyBlock('q_long_archive')).toContain('Prereq: Remnants ≥ 60; `flag_heartstone_stabilized`; Corruption < 6 or `flag_corruption_cleansed`; Ilyra recruited; `q_the_keepers_price` → `keeper`.');
    expect(quest('q_unbound').availableWhen).toEqual({ all: [FROM_LOOP_2, { flag: 'flag_tyrant_spared' }, { location: APEX }] });
    expect(quest('q_unbound').failWhen).toEqual({ not: { location: APEX } });
    expect(storyBlock('q_unbound')).toContain('Giver: none (the Tyrant\'s offer). Prereq: Loop 2+; Tyrant spared; at the Apex.');
    // the records (U51): every requirement the quest reads is in its ending's requirements too, Sworn = 60
    expect(JSON.stringify(pack.endings.ending_weavers_dawn?.requirements)).toContain('"faction":"weavers","min":60');
    expect(JSON.stringify(pack.endings.ending_iron_silence?.requirements)).toContain('"faction":"ironclad","min":60');
    expect(JSON.stringify(pack.endings.ending_long_archive?.requirements)).toContain('"faction":"remnants","min":60');
  });

  test('the first stage’s journal is STORY’s stage 1 journal, verbatim (tag story); every other journal is written, pinned and ≤ 40 words', () => {
    for (const q of endingQuests) {
      const first = q.stages[0] as Quest['stages'][number];
      expect([q.id, first.tags, inStory(first.journal)]).toEqual([q.id, ['story'], true]);
      expect(storyBlock(q.id)).toContain(`Journal: "${first.journal}"`);
      for (const st of q.stages.slice(1)) expect([q.id, st.id, st.tags, WRITTEN.journals.includes(st.journal)]).toEqual([q.id, st.id, ['written'], true]);
      for (const st of q.stages) expect([q.id, st.id, words(st.journal) <= 40]).toEqual([q.id, st.id, true]);
      expect([q.id, WRITTEN.other.includes(q.description)]).toEqual([q.id, true]);
    }
  });

  test('DESIGN §6.2: ending quests 600; the ending is the reward (STORY), nothing else', () => {
    expect(DESIGN).toContain('ending quests 600');
    for (const q of endingQuests) {
      expect([q.id, q.rewards]).toEqual([q.id, { xp: 600, gold: 0, items: [], rep: [], echoes: [], resonance: 0 }]);
      expect(storyBlock(q.id)).toContain(`Rewards. \`${ENDING_OF[q.id]}\`.`);
    }
  });

  test('the outcome stage is reached by the { ending } effect’s own step, wherever it sits: the Resolution’s outcomes (A, B, F), the words (A, B, F, D, E), the second wave (C)', () => {
    const last = (questId: string) => need(quest(questId).stages.find((s) => s.outcome === 'complete'), `${questId} outcome`).id;
    const carries = (effects: readonly Effect[], questId: string) =>
      expect([questId, effects.some((e) => JSON.stringify(e) === JSON.stringify({ questAdvance: { quest: questId, stage: last(questId) } })), endingsOf(effects)]).toEqual([questId, true, [ENDING_OF[questId]]]);
    const outcome = (choiceId: string) => need(communion().outcomes.find((o) => o.choiceId === choiceId), choiceId).effects;
    carries(outcome('take_its_place'), 'q_wardens_vigil');
    carries(outcome('consent_mending'), 'q_the_mending');
    carries(outcome('pass_beyond'), 'q_unbound');
    for (const [sceneId, nodeId, choiceId, endingId] of RESOLUTION_ENDINGS) {
      const q = need(QUEST_IDS.find((id) => ENDING_OF[id] === endingId), endingId);
      carries(choice(sceneId, nodeId, choiceId).effects, q);
    }
    carries(choice('scene_ending_silence', 'word', 'now').effects, 'q_iron_silence');
    for (const id of ['stay', 'leave']) carries(choice('scene_ending_archive', 'kinder', id).effects, 'q_long_archive');
    carries(need(pack.encounters.enc_weavers_dawn_wave_2, 'wave 2').onVictory, 'q_weavers_dawn');
    // the way back sorts before the ending's choice (legal actions sort by canonical JSON): a bot that clicks first goes back
    for (const [sceneId, nodeId, choiceId] of RESOLUTION_ENDINGS) {
      const ids = node(sceneId, nodeId).choices.map((c) => c.id);
      expect([sceneId, [...ids].sort()[0] !== choiceId, ids.at(-1)]).toEqual([sceneId, true, choiceId]);
    }
    // no { ending } anywhere else in this unit's content
    const elsewhere = [...endingScenes, ...tyrantScenes].flatMap((s) => s.nodes.flatMap((n) => [...endingsOf(n.onEnter), ...n.choices.flatMap((c) => endingsOf(c.effects))]));
    expect(elsewhere.sort()).toEqual(['ending_iron_silence', 'ending_long_archive', 'ending_long_archive', 'ending_mending', 'ending_unbound', 'ending_wardens_vigil']);
    expect(Object.values(pack.encounters).flatMap((e) => endingsOf(e.onVictory))).toEqual(['ending_weavers_dawn']);
    expect(CLOSER_IDS.length).toBe(2);
  });

  test('the stage graphs: A’s road, B’s fixed order (D-067.8), C’s Core and Nyx, D’s iron and Brak, E’s last dawn (D-066.8), F from the tear', () => {
    expect(quest('q_wardens_vigil').stages.map((s) => s.id)).toEqual(['go_and_see', 'communion', 'stepped_in']);
    expect(stage('q_wardens_vigil', 'go_and_see').objectives.map((o) => o.when)).toEqual([{ location: APEX }]);
    expect(quest('q_the_mending').stages.map((s) => s.id)).toEqual(['both_ends', 'anchor_the_conflux', 'crossing', 'forge', 'apex', 'mended']);
    expect(STORY).toContain('Stage order is fixed (REVIEW #3, D-067.8): the Before first, then the forge, then the Apex.');
    expect(stage('q_the_mending', 'both_ends').objectives.map((o) => o.when)).toEqual([{ item: { id: 'item_caelums_anchor_token' } }, { all: [{ location: 'loc_conflux_chamber' }, { companion: { id: 'caelum', state: 'active' } }] }]);
    expect(stage('q_the_mending', 'anchor_the_conflux').objectives.map((o) => o.when)).toEqual([{ flag: 'flag_cradle_pin_anchored' }]);
    expect(stage('q_the_mending', 'forge').objectives.map((o) => o.when)).toEqual([{ item: { id: 'item_breach_anchor' } }]);
    expect(node('scene_anchor_in_the_conflux', 'steadies').onEnter).toEqual([{ clockWatches: 12 }, { questAdvance: { quest: 'q_the_mending', stage: 'forge' } }]);
    expect(storyBlock('q_the_mending')).toContain('`flag_cradle_pin_anchored`; Breach Clock +3 days, DESIGN §10.1');
    expect(pack.recipes.recipe_breach_anchor?.output).toEqual({ itemId: 'item_breach_anchor', count: 1 });
    expect(quest('q_weavers_dawn').stages.map((s) => s.id)).toEqual(['his_face', 'apex', 'dawn']);
    expect(stage('q_weavers_dawn', 'his_face').objectives.map((o) => o.when)).toEqual([{ item: { id: 'item_heartstone_core' } }, { companion: { id: 'nyx', state: 'active' } }]);
    expect(quest('q_iron_silence').stages.map((s) => s.id)).toEqual(['cut_the_line', 'apex', 'silence']);
    expect(stage('q_iron_silence', 'cut_the_line').objectives.map((o) => o.when)).toEqual([{ item: { id: 'item_breach_anchor' } }]);
    expect(stage('q_iron_silence', 'apex').objectives.map((o) => [o.when, o.optional])).toEqual([[{ companion: { id: 'brak', state: 'active' } }, true]]);
    expect(quest('q_long_archive').stages.map((s) => s.id)).toEqual(['last_dawn', 'archive', 'remembered']);
    expect(stage('q_long_archive', 'last_dawn').objectives.map((o) => o.when)).toEqual([{ all: [{ location: DEPTHS }, { clock: { daysLeft: { max: 1 } } }, { companion: { id: 'ilyra', state: 'active' } }] }]);
    expect(storyBlock('q_long_archive')).toContain('Done: `{ all: [ { location: "loc_heartstone_depths" }, { clock: { daysLeft: { max: 1 } } } ] }` (D-066.8)');
    expect(quest('q_unbound').stages.map((s) => s.id)).toEqual(['tear_open', 'gone']);
    expect(node('scene_ending_unbound', 'quiet').onEnter).toEqual([{ questStart: 'q_unbound' }]);
    // no quest opens a scene (the barrel's rule); the givers' offers start them
    for (const q of endingQuests) expect([q.id, JSON.stringify(q.stages).includes('startDialogue')]).toEqual([q.id, false]);
    const starts = endingScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.flatMap((c) => c.effects.flatMap((e) => ('questStart' in e ? [[s.id, e.questStart]] : [])))));
    expect(starts).toEqual([
      ['scene_dask_wardens_vigil_offer', 'q_wardens_vigil'],
      ['scene_caelum_mending_offer', 'q_the_mending'],
      ['scene_nyx_weavers_dawn_offer', 'q_weavers_dawn'],
      ['scene_hadda_iron_silence_offer', 'q_iron_silence'],
      ['scene_dray_long_archive_offer', 'q_long_archive'],
    ]);
  });

  test('the Weaver’s Dawn’s two waves (STORY §10.3): Horde Husks ×2 then ×2, not fleeable, the second’s victory the ending', () => {
    expect(RAW_ENCOUNTERS.map((e) => e.id)).toEqual(['enc_weavers_dawn_wave_1', 'enc_weavers_dawn_wave_2']);
    expect(STORY).toContain('two waves of the hold');
    for (const [i, id] of RAW_ENCOUNTERS.map((e) => e.id).entries()) {
      const enc = need(pack.encounters[id], id);
      expect([id, enc.groups, enc.fleeable, enc.intro]).toEqual([id, [{ creatureId: 'cr_horde_husk', count: 2 }], false, DAWN_WAVE_INTROS[i]]);
    }
    expect(pack.encounters.enc_weavers_dawn_wave_1?.onVictory).toEqual([{ startCombat: 'enc_weavers_dawn_wave_2' }]);
    expect(choice('scene_ending_dawn', 'speak', 'give').effects).toEqual([{ startCombat: 'enc_weavers_dawn_wave_1' }]);
    expect(choice('scene_ending_dawn', 'version', 'give').effects).toEqual([{ startCombat: 'enc_weavers_dawn_wave_1' }]);
    expect(choice('scene_ending_dawn', 'speak', 'refuse').effects).toEqual([{ setFlag: 'flag_nyx_hostile' }, { loyalty: { companion: 'nyx', delta: -100 } }, { dismiss: 'nyx' }, { questFail: 'q_weavers_dawn' }]);
    expect(choice('scene_ending_dawn', 'speak', 'seen').when).toEqual({ echo: 'echo_ritual_inevitable' }); // STORY §12: "refuse Nyx with truth"
  });

  test('two derived Echoes (D-100): the offers that read the Litany or the schema derive them from their parts on entry', () => {
    expect([echoRow('echo_litany_complete')[3], echoRow('echo_anchor_schema')[3]]).toEqual(['Hold all nine', 'Hold both halves (any loops)']);
    expect(LITANY_KNOWN).toEqual({ any: [{ echo: 'echo_litany_complete' }, { all: Array.from({ length: 9 }, (_, i) => ({ echo: `echo_litany_verse_${i + 1}` })) }] });
    expect(SCHEMA_KNOWN).toEqual({ any: [{ echo: 'echo_anchor_schema' }, { all: [{ echo: 'echo_anchor_half_a' }, { echo: 'echo_anchor_half_b' }] }] });
    expect(node('scene_dask_wardens_vigil_offer', 'nine').onEnter).toEqual([DERIVE_LITANY]);
    expect(node('scene_caelum_mending_offer', 'chamber').onEnter).toEqual([DERIVE_LITANY, DERIVE_SCHEMA]);
    expect(node('scene_borin_anchor', 'note').onEnter).toEqual([DERIVE_SCHEMA]);
    expect(node('scene_hadda_iron_silence_offer', 'dark').onEnter).toEqual([DERIVE_SCHEMA]);
    expect(grantsOf([DERIVE_LITANY, DERIVE_SCHEMA])).toEqual(['echo_litany_complete', 'echo_anchor_schema']);
    for (const id of ['echo_litany_complete', 'echo_anchor_schema', 'echo_tyrant_consent', 'echo_tyrant_speaks', 'echo_litany_verse_9']) expect([id, pack.echoes[id] !== undefined]).toEqual([id, true]);
  });
});

// ---- The scenes -----------------------------------------------------------------------------------------------------------------

describe('the scenes (STORY §13 line for line, §5.6, §8.2; the barrel’s conventions)', () => {
  test('sixteen ending scenes and the first words are registered; NPC scenes are closed in the Horde and sit in a band; the rest are opened by a place or the Tyrant’s data', () => {
    expect(endingScenes.map((s) => s.id)).toEqual(SCENE_IDS);
    expect(tyrantScenes.map((s) => s.id)).toEqual(['scene_tyrant_first_words']);
    for (const s of [...endingScenes, ...tyrantScenes]) {
      if (s.npcId === undefined) expect([s.id, typeof OPENED_BY[s.id]]).toEqual([s.id, 'string']);
      else {
        expect([s.id, JSON.stringify(s.when).startsWith(JSON.stringify({ all: [NOT_IN_HORDE] }).slice(0, -2))]).toEqual([s.id, true]);
        expect([s.id, Object.values(SCENE_PRIORITY).includes(s.priority as never)]).toEqual([s.id, true]);
      }
    }
    // an ending's offer outranks a standing side-offer: the `report` band; the words on the last dawn decide
    for (const id of ['scene_dask_wardens_vigil_offer', 'scene_caelum_mending_offer', 'scene_nyx_weavers_dawn_offer', 'scene_hadda_iron_silence_offer', 'scene_dray_long_archive_offer', 'scene_borin_anchor', 'scene_ilyra_keep_the_vigil']) {
      expect([id, scene(id).priority]).toEqual([id, SCENE_PRIORITY.report]);
    }
    expect(scene('scene_ending_archive').priority).toBe(SCENE_PRIORITY.decision);
    for (const id of ['scene_dask_wardens_vigil_waiting', 'scene_hadda_iron_silence_waiting']) expect([id, scene(id).priority]).toEqual([id, SCENE_PRIORITY.waiting]);
    // STORY §13 names the seven, and their titles are STORY's
    for (const id of STORY_SCENES) expect([id, STORY.includes(`#### \`${id}\` — ${scene(id).title ?? ''}`)]).toEqual([id, true]);
  });

  test('every node is tagged; story nodes are STORY’s lines verbatim; written nodes are the pinned ones; nothing is unmarked', () => {
    const written: string[] = [];
    for (const s of [...endingScenes, ...tyrantScenes]) {
      for (const n of s.nodes) {
        expect([s.id, n.id, n.tags.length]).toEqual([s.id, n.id, 1]);
        const tag = n.tags[0];
        if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else {
          expect([s.id, n.id, tag]).toEqual([s.id, n.id, 'written']);
          written.push(`${s.id}.${n.id}`);
        }
        for (const v of n.textVariants) expect([s.id, n.id, WRITTEN.variants.includes(v.text)]).toEqual([s.id, n.id, true]);
      }
    }
    expect(written.sort()).toEqual([...WRITTEN.nodes].sort());
  });

  test('STORY §13’s seven scenes, line for line: every sentence of every spoken line is in the scene, in its speaker’s mouth; the Wayfinder’s lines are its choices', () => {
    const SPEAKER: Record<string, string[]> = {
      'The Tyrant': [UNVEILED],
      Caelum: ['npc_caelum', 'caelum'],
      Ilyra: ['npc_ilyra', 'ilyra'],
      Dask: ['npc_dask', 'dask'],
      Nyx: ['npc_nyx', 'nyx'],
      Brak: ['npc_brak', 'brak'],
    };
    const labels = new RegExp(`(?:^|\\s)(${[...Object.keys(SPEAKER), 'Wayfinder'].join('|')}): `, 'g');
    /** A bullet's segments: (speaker, text), the leading [condition] tag dropped. */
    const segments = (line: string): [string, string][] => {
      const bare = line.replace(/^\[[^\]]*\]\s*/, '');
      const parts: [string, string][] = [];
      let idx = 0;
      let speaker = 'narrator';
      for (const m of bare.matchAll(labels)) {
        const text = bare.slice(idx, m.index).trim();
        if (text !== '') parts.push([speaker, text]);
        speaker = m[1] as string;
        idx = (m.index ?? 0) + m[0].length;
      }
      const tail = bare.slice(idx).trim();
      if (tail !== '') parts.push([speaker, tail]);
      return parts;
    };
    const sentences = (text: string): string[] => text.split(/(?<=[.?!—])\s+/).map((t) => t.trim()).filter((t) => t !== '');
    for (const id of STORY_SCENES) {
      const sc = scene(id);
      const story = sc.nodes.filter((n) => n.tags[0] === 'story');
      const variants = sc.nodes.flatMap((n) => n.textVariants.map((v) => v.text));
      const choices = sc.nodes.flatMap((n) => n.choices.map((c) => c.text.replace(/^\[[^\]]*\]\s*/, '')));
      const lines = storyScene(id).filter((l) => !l.startsWith('Purpose.') && !l.startsWith('Choices:') && !l.includes('[legacy]'));
      for (const line of lines) {
        for (const [speaker, text] of segments(line)) {
          const said = text.replace(/^\[[^\]]*\]\s*/, '');
          if (speaker === 'Wayfinder') {
            expect([id, said, choices.includes(said)]).toEqual([id, said, true]);
            continue;
          }
          const mouths = speaker === 'narrator' ? ['narrator'] : (SPEAKER[speaker] as string[]);
          for (const sentence of sentences(said)) {
            const inNodes = story.some((n) => mouths.includes(n.speaker) && n.text.replace(/\n/g, ' ').includes(sentence));
            const inVariants = variants.some((v) => v.includes(sentence));
            expect([id, speaker, sentence, inNodes || inVariants]).toEqual([id, speaker, sentence, true]);
          }
        }
      }
    }
  });

  test('the first words by loop (STORY §8.2, §13): Loop 2 whole, Loop 3–4 "Again", Loop 5+ "count by you"; Veyran’s name is Echo-locked; Fight, Listen, Leave', () => {
    const fw = scene('scene_tyrant_first_words');
    expect(fw.entry).toEqual([
      { when: { flag: 'flag_scene_done_scene_tyrant_first_words' }, node: 'still_here' },
      { when: { loop: { min: 5 } }, node: 'count_by_you' },
      { when: { loop: { min: 3 } }, node: 'again' },
      { when: { all: [] }, node: 'whole' },
    ]);
    const by = STORY.slice(STORY.indexOf('### 8.2 What it says, by loop'), STORY.indexOf('### 8.3'));
    expect(by.replace(/\n\s+/g, ' ')).toContain(`**Loop 3:** "${node('scene_tyrant_first_words', 'again').text}"`);
    expect(by.replace(/\n\s+/g, ' ')).toContain(`**Loop 5+:** "${node('scene_tyrant_first_words', 'count_by_you').text}"`);
    const veyran = choice('scene_tyrant_first_words', 'cannot_ask', 'veyran');
    expect([veyran.when, veyran.disabledWhen, veyran.echoHint, veyran.tags]).toEqual([FROM_LOOP_2, { not: { echo: 'echo_tyrant_name' } }, 'echo_tyrant_name', ['echo']]);
    for (const n of ['cannot_ask', 'nobody_said', 'again', 'count_by_you', 'still_here']) {
      const ids = node('scene_tyrant_first_words', n).choices.map((c) => c.id);
      expect([n, ids.slice(-3)]).toEqual([n, ['fight', 'listen', 'leave']]);
    }
    expect(choice('scene_tyrant_first_words', 'again', 'fight').effects).toEqual([{ startCombat: 'enc_apex_unveiled' }]);
    expect(choice('scene_tyrant_first_words', 'again', 'listen').effects).toEqual([{ grantEcho: 'echo_tyrant_speaks' }, { startCombat: 'enc_apex_unveiled' }]);
    expect(choice('scene_tyrant_first_words', 'again', 'leave').next).toBe('lets_you');
    expect(STORY).toContain('Fight → Phase 1. Listen → communion Movement I; `echo_tyrant_speaks`. Leave → it lets you.');
  });

  test('STORY §5.6’s lines open each path in the giver’s mouth; the written words are short, in voice, and never apologise for the Tyrant to the living', () => {
    const how = STORY.slice(STORY.indexOf('### 5.6'), STORY.indexOf('### 5.7'));
    const opens: [string, string, string][] = [
      ['scene_dask_wardens_vigil_offer', 'place', 'Someone could take his place. Someone who knew the words.'],
      ['scene_caelum_mending_offer', 'pin', 'Both ends'],
      ['scene_borin_anchor', 'note', "Hallow's note says iron that does not wish. I can make that."],
      ['scene_nyx_weavers_dawn_offer', 'open', 'Open it all the way, and I will go back and stop them.'],
      ['scene_hadda_iron_silence_offer', 'line', 'Cut the line under it. No ley, no Breach, no Tyrant.'],
      ['scene_dray_long_archive_offer', 'held_well', 'If the hour must be held, let it be held well. Let someone remember.'],
    ];
    for (const [sceneId, nodeId, line] of opens) {
      expect([sceneId, node(sceneId, nodeId).text.includes(line)]).toEqual([sceneId, true]);
      expect([sceneId, how.replace(/\n\s*/g, ' ').replace(/\*/g, '').includes(line)]).toEqual([sceneId, true]);
    }
    for (const s of [...endingScenes, ...tyrantScenes]) for (const n of s.nodes) expect([s.id, n.id, words(n.text) <= 90]).toEqual([s.id, n.id, true]);
    // STORY §8.1: it never says "I am sorry" to the living — only to Caelum, in STORY's own line
    const sorry = [...endingScenes, ...tyrantScenes].flatMap((s) => s.nodes.filter((n) => n.speaker === UNVEILED && /sorry/i.test(n.text)).map((n) => `${s.id}.${n.id}`));
    expect(sorry).toEqual(['scene_ending_mending.sorry']);
    expect(node('scene_ending_mending', 'sorry').tags).toEqual(['story']);
    for (const banned of ['eldritch', 'unspeakable', 'suddenly', 'literally', 'nightmarish']) {
      for (const s of [...endingScenes, ...tyrantScenes]) for (const n of s.nodes) expect([s.id, n.id, banned, n.text.toLowerCase().includes(banned)]).toEqual([s.id, n.id, banned, false]);
    }
  });

  test('the Resolution scenes’ companions (STORY §10.2, §11.6): Ilyra’s oath, Dask’s staying and Caelum’s forgiveness colour the Mending and gate nothing; Caelum answers for the pin when present', () => {
    expect(STORY_FLAT).toContain("Ilyra's oath, Dask's staying and Caelum's forgiveness colour the scene and gate nothing.");
    expect(scene('scene_ending_mending').companionReactions.map((r) => [r.companionId, r.when])).toEqual([
      ['ilyra', { quest: { id: 'q_the_keepers_price', stage: 'unbound_hand' } }],
      ['dask', { flag: 'flag_dask_anchor' }],
      ['caelum', { echo: 'echo_caelum_forgives' }],
    ]);
    expect(scene('scene_ending_mending').entry).toEqual([
      { when: { companion: { id: 'caelum', state: 'active' } }, node: 'both_ends_caelum' },
      { when: { all: [] }, node: 'both_ends' },
    ]);
    expect(node('scene_ending_mending', 'forgiving').textVariants.map((v) => v.when)).toEqual([{ echo: 'echo_caelum_cannot' }]);
    expect(choice('scene_ending_mending', 'anchor', 'set_it').effects[0]).toEqual({ grantEcho: 'echo_tyrant_consent' });
    // the vigil's Ilyra and Dask lines are STORY's: interjection nodes of absent companions are skipped by the engine (played below)
    for (const [sceneId, nodeId, speaker] of [['scene_ending_vigil', 'ilyra', 'ilyra'], ['scene_ending_vigil', 'ilyra_stays', 'ilyra'], ['scene_ending_vigil', 'dask', 'dask'], ['scene_ending_unbound', 'fair', 'dask']]) {
      const n = node(sceneId as string, nodeId as string);
      expect([sceneId, nodeId, n.speaker, n.choices.length, typeof n.next]).toEqual([sceneId, nodeId, speaker, 0, 'string']);
    }
  });
});

// ---- The hooks ------------------------------------------------------------------------------------------------------------------

describe('the hooks (each a listed edit): the Apex’s two arrivals, Ilyra’s schedule, onSpared, the outcomes, the Offer, the silences', () => {
  test('the Apex: the first words on every Loop 2+ arrival while it stands unresolved (not for the Dawn); the Dawn’s arrival with the quest at the Apex', () => {
    const first = event(APEX, 'ev_apex_first_words');
    expect([first.trigger, first.once, first.effects]).toEqual(['enter', false, [{ startDialogue: 'scene_tyrant_first_words' }]]);
    expect(first.when).toEqual({
      all: [{ loop: { min: 2 } }, { not: { flag: 'flag_tyrant_spared' } }, { not: { flag: 'flag_tyrant_dead' } }, { not: { flag: 'flag_horde_active' } }, { not: { quest: { id: 'q_weavers_dawn', stage: 'apex' } } }],
    });
    const dawn = event(APEX, 'ev_apex_dawn');
    expect([dawn.trigger, dawn.once, dawn.effects]).toEqual(['enter', false, [{ startDialogue: 'scene_ending_dawn' }]]);
    expect(dawn.when).toEqual({ all: [{ quest: { id: 'q_weavers_dawn', stage: 'apex' } }, { not: { flag: 'flag_tyrant_dead' } }, { not: { flag: 'flag_horde_active' } }] });
    for (const id of ['ev_apex_first_words', 'ev_apex_dawn']) expect(loc(APEX).events.map((e) => e.id)).toContain(id);
    // the Conflux's pin (U56's event) opens the anchor scene
    expect(openedBy(event('loc_conflux_chamber', 'ev_conflux_pin').effects)).toContain('scene_anchor_in_the_conflux');
  });

  test('Ilyra (D-102): at the Depths too while the Long Archive runs', () => {
    expect(pack.npcs.npc_ilyra?.schedule).toEqual([{ when: { quest: { id: 'q_long_archive', status: 'active' } }, at: ['loc_whispering_ruins', 'loc_heartstone_depths'] }]);
  });

  test('the Unveiled Tyrant (DESIGN §4.11 "the Resolution dialogue follows"): onSpared opens the Mending’s words, else the Vigil’s, else the tear’s; the anchor shown with Brak opens the Silence; verse IX at Resolve 6', () => {
    const spec = communion();
    expect(DESIGN).toContain('the Resolution dialogue follows');
    expect(spec.onSpared[0]).toEqual({ loyalty: { companion: 'dask', delta: 3 } });
    const opens: { when: unknown; scenes: string[] }[] = spec.onSpared.slice(1).map((e) => ('onlyIf' in e ? { when: e.onlyIf.when, scenes: openedBy(e.onlyIf.effects) } : { when: null, scenes: [] }));
    expect(opens.map((o) => o.scenes)).toEqual([['scene_ending_mending'], ['scene_ending_vigil'], ['scene_ending_unbound']]);
    const mending = opens[0]?.when as { all: unknown[] };
    const vigil = { all: [{ resolve: { min: 6 } }, { echo: 'echo_litany_complete' }] };
    for (const c of [{ resolve: { min: 8 } }, { item: { id: 'item_breach_anchor' } }, { flag: 'flag_cradle_pin_anchored' }, { echo: 'echo_litany_complete' }]) expect(mending.all).toContainEqual(c);
    expect(opens[1]?.when).toEqual({ all: [vigil, { not: mending }] });
    expect(opens[2]?.when).toEqual({ all: [{ not: vigil }, { not: mending }] });
    // the outcomes' gates are the same conditions (ending A at 6 with the Litany, B at 8 with the rest)
    expect(need(spec.outcomes.find((o) => o.choiceId === 'take_its_place'), 'A')).toMatchObject({ minResolve: 6, when: { echo: 'echo_litany_complete' } });
    expect(need(spec.outcomes.find((o) => o.choiceId === 'consent_mending'), 'B').minResolve).toBe(8);
    // the anchor's Offer: STORY §11.6 D's talk branch
    const anchor = need(spec.offers.find((o) => o.itemId === 'item_breach_anchor'), 'the anchor');
    expect(anchor.effects).toEqual([
      { setFlag: 'flag_anchor_offered' },
      { onlyIf: { when: { all: [{ quest: { id: 'q_iron_silence', stage: 'apex' } }, { item: { id: 'item_breach_anchor' } }, { companion: { id: 'brak', state: 'active' } }] }, effects: [{ startDialogue: 'scene_ending_silence' }] } },
    ]);
    expect(storyBlock('q_iron_silence')).toContain('Apex with Brak active (D-067.7); fight the Tyrant to Phase 2 or talk it to Movement II; drive the anchor (`scene_ending_silence`).');
    // Movement III's Listen: the ninth verse at Resolve ≥ 6 (STORY §12)
    expect(echoRow('echo_litany_verse_9')[3]).toContain('Tyrant, Movement III (Resolve ≥ 6)');
    expect(spec.movements[2]?.listen?.effects.at(-1)).toEqual({ onlyIf: { when: { resolve: { min: 6 } }, effects: [{ grantEcho: 'echo_litany_verse_9' }] } });
  });

  test('the silences (STORY §8.2 "it falls silent at the gaps"): every Echo-gated question takes a +0 answer, so a gap can be passed without striking; the lines are the chorus’s and Veyran’s', () => {
    expect(STORY).toContain('it falls silent at the gaps');
    const questions = communion().movements.flatMap((m) => m.questions);
    const open = (a: { when?: unknown }) => a.when === undefined || JSON.stringify(a.when) === JSON.stringify({ all: [] });
    for (const q of questions) {
      const silence = q.answers.filter((a) => a.id.endsWith('_silence'));
      if (silence.length === 0) expect([q.id, q.answers.some((a) => open(a) || !JSON.stringify(a.when).includes('"echo"'))]).toEqual([q.id, true]);
      else {
        // a silence only where every other answer is gated; one each, +0, in the listed words
        expect([q.id, silence.map((a) => [open(a), a.resolve, WRITTEN.silences.includes(a.text)])]).toEqual([q.id, [[true, 0, true]]]);
        expect([q.id, q.answers.filter((a) => !a.id.endsWith('_silence')).every((a) => !open(a))]).toEqual([q.id, true]);
      }
    }
    // Movement III: below Resolve 3 the only answer is to give it up (the rejection, STORY §8.5)
    const last = need(questions.find((q) => q.answers.some((a) => a.id === 'choose')), 'the last question');
    expect(last.answers.map((a) => [a.id, a.when, a.resolve])).toEqual([
      ['choose', { resolve: { min: 3 } }, 0],
      ['nothing_left', { resolve: { max: 2 } }, 0],
    ]);
    for (const line of WRITTEN.questionLines) expect(questions.some((q) => q.line === line)).toBe(true);
    expect(questions.map((q) => q.line).filter((l) => WRITTEN.questionLines.includes(l)).length).toBe(WRITTEN.questionLines.length);
  });
});

// ---- Played on the real pack ---------------------------------------------------------------------------------------------------

describe('played on the real pack (makeState + play: the engine runs the scenes)', () => {
  type Ev = GameEvent;
  type P = ReturnType<typeof freshProfile>;
  const runState = (id: string, over: Partial<CompanionRunState> = {}): CompanionRunState => {
    const hp = pack.companions[id]?.stats.hp ?? 80;
    return { id, recruited: true, loyalty: 60, hp, hpMax: hp, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {}, ...over };
  };
  const stood = (): GameState['world']['locationStates'][string] => ({
    visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: ['enc_nexus_aberration'], encounterClearedDay: {}, eventsFired: [], flags: {},
    unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
  });
  /** A Loop `loop` level-20 Wayfinder with `echo_apex_resonance` (the Apex's gate) and the Echoes given, the Nexus stood on; `party` is the active companion. */
  const at = (o: StateOverrides, loop = 2, echoes: string[] = [], party: string | null = null) => {
    const profile = freshProfile({ loopCounter: loop, echoes: ['echo_apex_resonance', ...echoes] });
    const s = makeState(
      {
        loop,
        level: 20,
        ...o,
        patch: (st) => {
          st.world.locationStates[NEXUS] = stood();
          if (party !== null) {
            st.companions.recruited[party] = runState(party);
            st.companions.activeId = party;
          }
          o.patch?.(st);
        },
      },
      { content: pack, profile },
    );
    return { s, profile };
  };
  const talk = (npcId: string): Action => ({ type: 'talk', npcId });
  const pick = (choiceId: string): Action => ({ type: 'choose', choiceId });
  const move = (to: string): Action => ({ type: 'move', to });
  const go: Action = { type: 'continue' };
  const nodesSeen = (events: readonly Ev[]): string[] => events.flatMap((e) => (e.t === 'dialogueNode' ? [e.nodeId] : []));
  const textsSeen = (events: readonly Ev[]): string[] => events.flatMap((e) => (e.t === 'dialogueNode' ? [e.text] : []));
  const legalIds = (s: GameState, profile: P) => legalActions(s, pack, profile).flatMap((a) => (a.type === 'choose' ? [a.choiceId] : []));
  /** Through open dialogue: each pick chosen as soon as it is legal (continuing until it is). */
  const drive = (s: GameState, profile: P, picks: readonly string[]): ReturnType<typeof play> => {
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
    // then on to the next choice, or the scene's end
    for (let i = 0; i < 20 && cur.mode === 'dialogue' && legalIds(cur, profile).length === 0; i++) {
      script.push(go);
      cur = play(cur, [go], { content: pack, profile }).state;
    }
    return play(s, script, { content: pack, profile });
  };
  /** A Resolution scene opened the way `onSpared` opens it (the Tyrant spared, the Apex), from explore. */
  const resolution = (sceneId: string, o: StateOverrides = {}, echoes: string[] = [], party: string | null = null) => {
    const { s, profile } = at({ locationId: APEX, flags: { flag_tyrant_spared: true, ...(o.flags ?? {}) }, ...o }, 2, echoes, party);
    const ctx = makeCtx(clone(s), profile, pack);
    openScene(ctx, sceneId);
    return { s: ctx.s, profile, events: ctx.events };
  };

  test('the first words: Loop 2 at the Apex the scene opens whole and nothing strikes; Leave lets you go; back again it is "still here"; Listen starts the fight with the Echo', () => {
    const { s, profile } = at({ locationId: NEXUS });
    const up = play(s, [move(APEX)], { content: pack, profile });
    expect([up.state.mode, up.state.dialogue?.sceneId]).toEqual(['dialogue', 'scene_tyrant_first_words']);
    expect(up.state.combat).toBeNull();
    const words = play(up.state, [go, go, go, go, go], { content: pack, profile });
    expect(nodesSeen(up.events).concat(nodesSeen(words.events))).toEqual(['whole', 'held_breath', 'one_voice', 'crossed', 'finish_it', 'cannot_ask']);
    expect(legalIds(words.state, profile)).toEqual(['fight', 'leave', 'listen']); // Veyran's name waits on its Echo
    const left = drive(words.state, profile, ['leave']);
    expect([left.state.mode, left.state.world.currentLocationId, left.state.flags.flag_scene_done_scene_tyrant_first_words]).toEqual(['explore', APEX, true]);
    const back = play(left.state, [move(NEXUS), move(APEX)], { content: pack, profile });
    expect(nodesSeen(back.events)).toEqual(['still_here']);
    const fight = play(back.state, [pick('listen')], { content: pack, profile });
    expect([fight.state.mode, fight.state.combat?.enemies[0]?.refId, fight.state.echoesThisLoop.includes('echo_tyrant_speaks')]).toEqual(['combat', UNVEILED, true]);
    expect(legalActions(fight.state, pack, fight.profile)).toContainEqual({ type: 'commune', act: 'listen' });
    // with its name: "Veyran." then "Nobody has said that here"
    const named = at({ locationId: NEXUS }, 2, ['echo_tyrant_name']);
    const said = play(named.s, [move(APEX), go, go, go, go, go, pick('veyran')], { content: pack, profile: named.profile });
    expect(nodesSeen(said.events).at(-1)).toBe('nobody_said');
    expect(legalIds(said.state, named.profile)).toEqual(['fight', 'leave', 'listen']);
  });

  test('the first words by loop: Loop 3 "Again", Loop 5 "count by you"; Loop 1 and the spared or dead Tyrant open nothing', () => {
    for (const [loop, entry] of [
      [3, 'again'],
      [4, 'again'],
      [5, 'count_by_you'],
      [9, 'count_by_you'],
    ] as const) {
      const { s, profile } = at({ locationId: NEXUS }, loop);
      expect([loop, nodesSeen(play(s, [move(APEX)], { content: pack, profile }).events)]).toEqual([loop, [entry]]);
    }
    const spared = at({ locationId: NEXUS, flags: { flag_tyrant_spared: true } }, 3);
    expect(play(spared.s, [move(APEX)], { content: pack, profile: spared.profile }).state.dialogue?.sceneId).not.toBe('scene_tyrant_first_words');
  });

  test('the Weaver’s Dawn at the Apex (STORY §13 scene_ending_dawn): her face, the Core given, the first wave of two Husks; or refused, and she is gone', () => {
    const dawn = at({ locationId: NEXUS, items: ['item_heartstone_core'], quests: { q_weavers_dawn: 'apex' }, flags: { flag_heartstone_exploited: true }, reputation: { weavers: 70 } }, 2, [], 'nyx');
    const up = play(dawn.s, [move(APEX)], { content: pack, profile: dawn.profile });
    expect([up.state.mode, up.state.dialogue?.sceneId]).toEqual(['dialogue', 'scene_ending_dawn']);
    const spoke = play(up.state, [go, go, go, go], { content: pack, profile: dawn.profile });
    expect(nodesSeen(up.events).concat(nodesSeen(spoke.events))).toEqual(['edge', 'me', 'name', 'will_not', 'speak']);
    expect(legalIds(spoke.state, dawn.profile)).toEqual(['give', 'refuse']); // "I've seen it" waits on echo_ritual_inevitable
    const gave = play(spoke.state, [pick('give')], { content: pack, profile: dawn.profile });
    expect([gave.state.mode, gave.state.combat?.encounterId, gave.state.combat?.enemies.map((e) => e.refId)]).toEqual(['combat', 'enc_weavers_dawn_wave_1', ['cr_horde_husk', 'cr_horde_husk']]);
    expect(gave.state.quests.q_weavers_dawn).toMatchObject({ status: 'active', stage: 'apex' });
    const refused = drive(spoke.state, dawn.profile, ['refuse']);
    expect([refused.state.mode, refused.state.flags.flag_nyx_hostile, refused.state.companions.recruited.nyx, refused.state.quests.q_weavers_dawn?.status]).toEqual(['explore', true, undefined, 'failed']);
    // with the ritual seen: the truth, then her answer
    const seen = at({ locationId: NEXUS, items: ['item_heartstone_core'], quests: { q_weavers_dawn: 'apex' } }, 2, ['echo_ritual_inevitable'], 'nyx');
    const truth = play(seen.s, [move(APEX), go, go, go, go, pick('seen')], { content: pack, profile: seen.profile });
    expect(nodesSeen(truth.events).at(-1)).toBe('version');
    expect(legalIds(truth.state, seen.profile)).toEqual(['give', 'refuse']);
  });

  test('the Long Archive at the Depths: Keep the vigil passes the days in whole dawns, never past the last; on the last dawn the stage turns and Ilyra sets the stone; stay or leave is the ending', () => {
    const vigil = at({ locationId: DEPTHS, day: 5, items: ['item_stabilized_heartstone'], quests: { q_long_archive: 'last_dawn', q_echoing_heartbeat: { status: 'completed', stage: 'done_stabilize' } }, flags: { flag_heartstone_stabilized: true } }, 2, ['echo_heartstone_resonance'], 'ilyra');
    const opened = play(vigil.s, [talk('npc_ilyra')], { content: pack, profile: vigil.profile });
    expect([opened.state.dialogue?.sceneId, nodesSeen(opened.events)]).toEqual(['scene_ilyra_keep_the_vigil', ['vigil']]);
    expect(legalIds(opened.state, vigil.profile)).toEqual(['not_now', 'ten_days']);
    const before = daysLeft(opened.state.clock);
    const ten = play(opened.state, [pick('ten_days')], { content: pack, profile: vigil.profile });
    expect(daysLeft(ten.state.clock)).toBe(before - 10);
    // the days pass until the last dawn, each choice the one its range allows
    let cur = ten;
    const taken: string[] = [];
    for (let i = 0; i < 12 && cur.state.mode === 'dialogue'; i++) {
      const ids = legalIds(cur.state, vigil.profile).filter((id) => id !== 'not_now');
      expect([i, ids.length]).toEqual([i, 1]);
      const id = ids[0] as string;
      taken.push(id);
      cur = play(cur.state, [pick(id)], { content: pack, profile: vigil.profile });
      if (id === 'last_dawn') cur = play(cur.state, [go], { content: pack, profile: vigil.profile });
    }
    expect(taken.at(-1)).toBe('last_dawn');
    expect(taken.filter((t) => t === 'one_day').length).toBeGreaterThan(0);
    expect([daysLeft(cur.state.clock) <= 1, cur.state.clock.expired, cur.state.mode]).toEqual([true, false, 'explore']);
    expect(cur.state.quests.q_long_archive).toMatchObject({ status: 'active', stage: 'archive' });
    // the words (STORY §13), and the thirty-first day
    const archive = play(cur.state, [talk('npc_ilyra')], { content: pack, profile: vigil.profile });
    expect(archive.state.dialogue?.sceneId).toBe('scene_ending_archive');
    const stayed = drive(archive.state, vigil.profile, ['yes', 'stay']);
    expect(nodesSeen(archive.events).concat(nodesSeen(stayed.events))).toEqual(['sets', 'time', 'dawns', 'remember', 'kinder']);
    expect([stayed.state.mode, stayed.state.pendingEnding?.outcome]).toEqual(['ending', 'ending_long_archive']);
    expect(stayed.state.quests.q_long_archive).toMatchObject({ status: 'completed', stage: 'remembered' });
    expect(stayed.profile.endingsReached).toContain('ending_long_archive');
    const left = drive(archive.state, vigil.profile, ['yes', 'leave']);
    expect([left.state.mode, left.state.pendingEnding?.outcome]).toEqual(['ending', 'ending_long_archive']);
  });

  test('the Mending’s pin on the rim (STORY §13 scene_anchor_in_the_conflux): the drop is the engine’s Anchor; with Caelum beside you the words follow, the hour steadies by three days, the forge is next', () => {
    const { s, profile } = at(
      {
        locationId: 'loc_conflux_chamber',
        items: ['item_caelums_anchor_token'],
        quests: { q_the_mending: 'anchor_the_conflux', q_the_apprentices_errand: { status: 'completed', stage: 'joined' } },
        patch: (st) => {
          st.before = { day: 3, resets: 0 };
          st.clock.frozen = true;
          st.flags.flag_before_day_3 = true;
          st.flags.flag_entered_before_via_nexus = true;
        },
      },
      2,
      ['echo_before_route', 'echo_anchor_mechanic'],
      'caelum',
    );
    const pin = need(s.player.inventory.find((i) => i.itemId === 'item_caelums_anchor_token'), 'the pin');
    expect(legalActions(s, pack, profile)).not.toContainEqual({ type: 'interact', eventId: 'ev_conflux_pin' });
    const dropped = play(s, [{ type: 'drop', uid: pin.uid }], { content: pack, profile });
    expect([dropped.state.flags.flag_cradle_pin_anchored, dropped.state.flags.flag_conflux_anchored]).toEqual([true, true]);
    expect(dropped.state.quests.q_the_mending).toMatchObject({ status: 'active', stage: 'crossing' });
    expect(legalActions(dropped.state, pack, profile)).toContainEqual({ type: 'interact', eventId: 'ev_conflux_pin' });
    const limit = dropped.state.clock.limitTicks;
    const words = drive(play(dropped.state, [{ type: 'interact', eventId: 'ev_conflux_pin' }], { content: pack, profile }).state, profile, ['stole', 'only_thing']);
    expect(nodesSeen(words.events)).toEqual(['forged', 'borrowed', 'still', 'here', 'steadies']); // 'whole' opened with the interact
    expect([words.state.mode, words.state.clock.limitTicks - limit, words.state.flags.flag_scene_done_scene_anchor_in_the_conflux]).toEqual(['explore', 12, true]);
    expect(words.state.quests.q_the_mending).toMatchObject({ status: 'active', stage: 'forge' });
    expect(legalActions(words.state, pack, profile)).not.toContainEqual({ type: 'interact', eventId: 'ev_conflux_pin' });
  });

  test('the Resolution’s words, A (STORY §13 scene_ending_vigil): the absent are skipped, Not yet goes back, I’m sure is the Warden’s Vigil and the quest’s last stage however you came', () => {
    const alone = resolution('scene_ending_vigil');
    expect(nodesSeen(alone.events)).toEqual(['nine']);
    const sure = drive(alone.s, alone.profile, ['understand']);
    expect(nodesSeen(sure.events)).toEqual(['only_thing', 'sure']); // no Ilyra, no Dask
    expect(legalIds(sure.state, alone.profile)).toEqual(['not_yet', 'say_it']);
    const back = drive(sure.state, alone.profile, ['not_yet']);
    expect([nodesSeen(back.events), back.state.mode]).toEqual([['not_yet'], 'explore']);
    const stepped = play(sure.state, [pick('say_it')], { content: pack, profile: alone.profile });
    expect([stepped.state.mode, stepped.state.pendingEnding?.outcome]).toEqual(['ending', 'ending_wardens_vigil']);
    expect(stepped.state.quests.q_wardens_vigil).toMatchObject({ status: 'completed', stage: 'stepped_in' });
    // with Dask beside you his line is said; Ilyra's with her
    const withDask = resolution('scene_ending_vigil', {}, [], 'dask');
    expect(nodesSeen(drive(withDask.s, withDask.profile, ['understand']).events)).toEqual(['only_thing', 'dask', 'sure']);
    const withIlyra = resolution('scene_ending_vigil', {}, [], 'ilyra');
    expect(nodesSeen(drive(withIlyra.s, withIlyra.profile, ['understand']).events)).toEqual(['only_thing', 'ilyra', 'ilyra_stays', 'sure']);
  });

  test('the Resolution’s words, B (STORY §13 scene_ending_mending): with Caelum he answers for the pin and hears "I am sorry"; without him you do; hesitate goes back; the anchor driven is the Mending and his consent', () => {
    const withCaelum = resolution('scene_ending_mending', { items: ['item_breach_anchor'] }, ['echo_caelum_cannot'], 'caelum');
    const asked = drive(withCaelum.s, withCaelum.profile, ['let_go']);
    expect(nodesSeen(withCaelum.events).concat(nodesSeen(asked.events))).toEqual(['both_ends_caelum', 'i_did', 'laugh', 'message', 'nobody', 'sorry', 'forgiving', 'will_you', 'drive_it', 'anchor']);
    expect(textsSeen(asked.events)).toContain("Caelum: 'I don't forgive you, Master Thal.' The Tyrant: 'No. Set it anyway. That is the only kind of forgiving I was ever going to get.'");
    const alone = resolution('scene_ending_mending', { items: ['item_breach_anchor'] });
    const told = drive(alone.s, alone.profile, ['a_boy', 'let_go']);
    expect(nodesSeen(alone.events).concat(nodesSeen(told.events))).toEqual(['both_ends', 'twice', 'will_you', 'drive_it', 'anchor']);
    expect(legalIds(told.state, alone.profile)).toEqual(['hesitate', 'set_it']);
    const back = drive(told.state, alone.profile, ['hesitate']);
    expect([nodesSeen(back.events), back.state.mode]).toEqual([['watch'], 'explore']);
    const set = play(told.state, [pick('set_it')], { content: pack, profile: alone.profile });
    expect([set.state.mode, set.state.pendingEnding?.outcome, set.state.echoesThisLoop.includes('echo_tyrant_consent')]).toEqual(['ending', 'ending_mending', true]);
    expect(set.state.quests.q_the_mending).toMatchObject({ status: 'completed', stage: 'mended' });
  });

  test('the Resolution’s words, F (STORY §13 scene_ending_unbound): the tear starts the Unbound; turn back goes back and leaving the Apex declines it; step through is the ending', () => {
    const tear = resolution('scene_ending_unbound', {}, [], 'dask');
    expect(tear.s.quests.q_unbound).toMatchObject({ status: 'active', stage: 'tear_open' });
    const open = drive(tear.s, tear.profile, ['hold']);
    expect(nodesSeen(tear.events).concat(nodesSeen(open.events))).toEqual(['quiet', 'city', 'or_go', 'until', 'fair', 'tear']);
    expect(legalIds(open.state, tear.profile)).toEqual(['turn_back', 'walk_through']);
    const back = drive(open.state, tear.profile, ['turn_back']);
    expect([nodesSeen(back.events), back.state.mode, back.state.quests.q_unbound?.status]).toEqual([['turned'], 'explore', 'active']);
    const declined = play(back.state, [move(NEXUS)], { content: pack, profile: tear.profile });
    expect(declined.state.quests.q_unbound?.status).toBe('failed');
    const through = play(open.state, [pick('walk_through')], { content: pack, profile: tear.profile });
    expect([through.state.mode, through.state.pendingEnding?.outcome, through.state.flags.flag_refused_all_paths]).toEqual(['ending', 'ending_unbound', true]);
    expect(through.state.quests.q_unbound).toMatchObject({ status: 'completed', stage: 'gone' });
  });

  test('the Iron Silence’s words (STORY §13 scene_ending_silence): Wait is his line and the way back; Now is the ending and the quest’s last stage', () => {
    const silence = resolution('scene_ending_silence', { items: ['item_breach_anchor'], quests: { q_iron_silence: 'apex' } }, [], 'brak');
    const word = drive(silence.s, silence.profile, ['wait']);
    expect(nodesSeen(silence.events).concat(nodesSeen(word.events))).toEqual(['that', 'iron', 'man', 'was', 'word', 'long']);
    expect(word.state.mode).toBe('explore');
    const again = resolution('scene_ending_silence', { items: ['item_breach_anchor'], quests: { q_iron_silence: 'apex' } }, [], 'brak');
    const now = drive(again.s, again.profile, ['now']);
    expect([now.state.mode, now.state.pendingEnding?.outcome]).toEqual(['ending', 'ending_iron_silence']);
    expect(now.state.quests.q_iron_silence).toMatchObject({ status: 'completed', stage: 'silence' });
  });
});

// ---- Pinned written words (listed in the U58 reply) ------------------------------------------------------------------------------

const WRITTEN = {
  journals: [
    'Carry the communion to the end of the Nine Speak with the words whole and Resolve of six or more. Then, if you are sure, step in.',
    'You said the ninth verse, and you hold. It is heavier than it looks. It is lighter than it was.',
    "Set Hallow's Cradle-Pin down on the cradle's rim, with Caelum beside you. What is set down there is set down in every instant at once.",
    'The pin is on the rim, and Caelum has something to say about it. Then let him cross if he will, and go home by the door: the pin will be lying in the Depths.',
    "Forge the Breach-anchor at the Emberforge: Aetherium Shards, a Heartstone fragment, Void Shards, ember ore and heartwood. Borin's fire knows iron that does not wish.",
    'Both ends are ready. To the Apex: the communion to Resolve eight, with Dask or Caelum in Support if you have them; then his consent, and the anchor driven in.',
    'Hour, go. The Breach is closed from both ends, and for the first time there is a thirty-first day.',
    'To the Apex with the Core and Nyx beside you. The hold will fail as she works; hold the floor while it does.',
    'She went back to stop them, and it failed as it fails, and the circle closed with one more in it.',
    'The iron is forged. Take Brak to the Apex; fight the thing to its fracture or talk it to the Nine, then drive the anchor and let him swing.',
    'The line is cut. The Breach closed like a mouth with nothing to say, and the world is quiet.',
    'The last dawn. Ilyra is here, and the Stabilized Heartstone is in your hands. Let her set it, and choose whether you stay.',
    'The thirtieth dawn came up and went down and came up again as the first. Nothing unravelled. Ilyra remembers.',
    'You stepped past it, into the Breach, toward somewhere that is not Aethelgard. You remember all of it.',
  ],
  other: [
    "Dask says someone who knows all nine verses could take the Tyrant's place. Go to the Apex and see if it is you.",
    "Close the Breach from both ends: Hallow's cradle-pin on the rim in the Before, and a Breach-anchor from Borin's fire for the Apex.",
    'Nyx is ready to look at his face. Take the Heartstone Core to the Apex with her and tear the hold open.',
    'Hadda Ironvow wants the ley line cut under the Apex, and Borin can forge the iron that cuts it.',
    'Keeper Dray asks you to set the Stabilized Heartstone back in its cradle on the last dawn before the thirtieth, with Ilyra.',
    'The Tyrant, spared, has opened the tear. Nothing is stopping you from stepping past it, into somewhere that is not Aethelgard.',
  ],
  variants: [
    'Close now. Two more dawns, perhaps three. Sit with me; the stone keeps better time than the sky does.',
    'The days are going by like pages turned in another room. I have been counting them on the plinths. Keep the vigil a little longer.',
    "Caelum: 'I don't forgive you, Master Thal.' The Tyrant: 'No. Set it anyway. That is the only kind of forgiving I was ever going to get.'",
  ],
  nodes: [
    'scene_dask_wardens_vigil_offer.nine',
    'scene_dask_wardens_vigil_offer.place',
    'scene_dask_wardens_vigil_offer.ask',
    'scene_dask_wardens_vigil_offer.go',
    'scene_dask_wardens_vigil_offer.refused',
    'scene_dask_wardens_vigil_waiting.waiting',
    'scene_caelum_mending_offer.chamber',
    'scene_caelum_mending_offer.pin',
    'scene_caelum_mending_offer.ask',
    'scene_caelum_mending_offer.borrow',
    'scene_caelum_mending_offer.refused',
    'scene_anchor_in_the_conflux.steadies',
    'scene_borin_anchor.note',
    'scene_borin_anchor.recipe',
    'scene_borin_anchor.not_yet',
    'scene_nyx_weavers_dawn_offer.forty',
    'scene_nyx_weavers_dawn_offer.open',
    'scene_nyx_weavers_dawn_offer.ask',
    'scene_nyx_weavers_dawn_offer.beside',
    'scene_nyx_weavers_dawn_offer.refused',
    'scene_ending_dawn.refused',
    'scene_hadda_iron_silence_offer.dark',
    'scene_hadda_iron_silence_offer.line',
    'scene_hadda_iron_silence_offer.ask',
    'scene_hadda_iron_silence_offer.swing',
    'scene_hadda_iron_silence_offer.refused',
    'scene_hadda_iron_silence_waiting.waiting',
    'scene_dray_long_archive_offer.held_well',
    'scene_dray_long_archive_offer.stone',
    'scene_dray_long_archive_offer.ask',
    'scene_dray_long_archive_offer.dawn',
    'scene_dray_long_archive_offer.refused',
    'scene_ilyra_keep_the_vigil.vigil',
    'scene_ilyra_keep_the_vigil.here',
    'scene_ending_vigil.sure',
    'scene_ending_vigil.not_yet',
    'scene_ending_mending.laugh',
    'scene_ending_mending.forgiving',
    'scene_ending_mending.will_you',
    'scene_ending_mending.anchor',
    'scene_ending_unbound.quiet',
    'scene_ending_unbound.city',
    'scene_ending_unbound.tear',
    'scene_ending_unbound.turned',
    'scene_tyrant_first_words.still_here',
    'scene_tyrant_first_words.lets_you',
  ],
  // the communion (glowlands_nexus/creatures.ts, the Unveiled Tyrant): the silences and the questions' lines in its voice
  silenceIds: ['hour_silence', 'before_silence', 'korr_silence', 'vane_silence', 'aulde_silence', 'sallow_silence', 'masque_silence', 'hallow_silence'],
  silences: ['I do not know what day it is.', 'I do not know who came before me.', 'I have not read it.', 'I do not have that verse.', 'I have not seen it from there.', 'You leave the gap where it is.'],
  questionLines: [
    "The chorus asks, and one voice under it waits for the answer: 'Why have you come? Say it. The hour will know if you do not.'",
    "'What day is it, where you stand? I have had one day for five hundred years. Tell me yours.'",
    "'Seven have stood where you stand. Do you know their names, or only that they stopped coming?'",
    'The chorus leaves a gap where a sixth voice should be, and waits in it. Nobody asks. The one who would have asked walked up the stair.',
    "The chorus stops. One voice, alone, asks: 'What will you do? I cannot ask you for anything. I can ask you that.'",
  ],
};
