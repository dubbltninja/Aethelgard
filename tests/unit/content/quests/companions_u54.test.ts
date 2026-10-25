// U54: Ilyra's and Brak's arcs — six companion quests and their scenes (src/content/shared/{quests,dialogues}/companions_u54.ts),
// held to their sources read at test time: STORY (§11.1's table, §11.4's blocks, §7.1–§7.2 the arcs and recruitment, §5.2 and
// §6.4 the déjà vu lines, §13 the two key scenes, §2.3 verse I), DESIGN (§6.2 the arc tiers, §11.2 Brak's +10, §12.1
// recruitment, §12.5 loyalty, §12.7 camp conversations, §13.3 ex. 5), the Python (the two legacy lines) and the conventions of
// the two barrel headers (U52's pattern, D-105; U53's, D-109). Then the scenes are played through the engine on the real pack
// (makeState + play): recruitment, the camp conversations at a rest, each decision and what it pays, the Exploit that sends
// Ilyra away, the carrel's scene, the Ring, the Line's three ends.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { dialogues as RAW_SCENES } from '@content/shared/dialogues/companions_u54';
import { FROM_LOOP_2, LOYALTY_AGAINST, LOYALTY_ALIGNED, NOT_IN_HORDE, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { LOYALTY_STAGE, SALT, quests as RAW_QUESTS } from '@content/shared/quests/companions_u54';
import { companions } from '@content/shared/companions';
import { CAMP_LOYALTY, choiceViews, legalActions, type Action, type GameEvent, type GameState } from '@engine/index';
import type { DialogueScene } from '@schema/dialogue';
import type { Effect } from '@schema/effect';
import type { Quest } from '@schema/quest';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const STORY = read('docs/STORY.md');
const DESIGN = read('docs/DESIGN.md');
const GAME = read('legacy/echoes_of_aethelgard.py');
const DATA = read('legacy/aethelgard_data.py');
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

const QUEST_IDS = ['q_voices_in_the_stacks', 'q_the_danthe_line', 'q_the_keepers_price', 'q_the_scouts_oath', 'q_blood_and_salt', 'q_the_line_he_holds'];
const SCENE_IDS = [
  'scene_ilyra_deja_vu',
  'scene_ilyra_arc',
  'scene_ilyra_voices_waiting',
  'scene_ilyra_voices_ask',
  'scene_ilyra_danthe_line_waiting',
  'scene_the_first_drowned',
  'scene_dray_offers',
  'scene_dray_keepers_price',
  'scene_ilyra_camp_1',
  'scene_ilyra_camp_2',
  'scene_ilyra_camp_3',
  'scene_brak_deja_vu',
  'scene_brak_arc',
  'scene_brak_scouts_oath_waiting',
  'scene_hadda_scouts_oath',
  'scene_brak_blood_and_salt_offer',
  'scene_kaelen_blood_and_salt_offer',
  'scene_braks_brother',
  'scene_brak_blood_and_salt_report',
  'scene_brak_camp_1',
  'scene_brak_camp_2',
  'scene_brak_camp_3',
  'scene_kaelen_deja_vu',
  'scene_borin_oath',
];
const CAMP_IDS = ['scene_ilyra_camp_1', 'scene_ilyra_camp_2', 'scene_ilyra_camp_3', 'scene_brak_camp_1', 'scene_brak_camp_2', 'scene_brak_camp_3'];
/** Scenes no NPC opens: the carrel's event and the rests. */
const NO_NPC = ['scene_the_first_drowned', ...CAMP_IDS];

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
/** DESIGN §12.1's row for a companion. */
const designRecruitRow = (id: string): string => need(DESIGN_SECTION('### 12.1', '### 12.2').split('\n').find((l) => l.startsWith(`| \`${id}\``)), `§12.1 ${id}`);

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

// ---- Where each decision lives ---------------------------------------------------------------------------------------------------

const WHAT_WOULD = choice('scene_ilyra_voices_ask', 'question', 'what_would').effects;
const READ_ALOUD = choice('scene_ilyra_voices_ask', 'heard', 'read_aloud');
const TAKE = choice('scene_the_first_drowned', 'ring', 'take').effects;
const LEAVE = choice('scene_the_first_drowned', 'ring', 'leave').effects;
const KEEPER = choice('scene_dray_keepers_price', 'choose', 'keeper').effects;
const NEVER = choice('scene_dray_keepers_price', 'choose', 'never').effects;
const WORD = choice('scene_hadda_scouts_oath', 'word', 'word').effects;
const KEEP_WORD = choice('scene_hadda_scouts_oath', 'word', 'keep').effects;
const SAID_IT = choice('scene_braks_brother', 'coat', 'said_it');
const ONLY_SALT = choice('scene_braks_brother', 'coat', 'only_salt').effects;
const SPOKE = node('scene_brak_blood_and_salt_report', 'market').onEnter;
const FINE = node('scene_brak_blood_and_salt_report', 'fine').onEnter;
const TELL = choice('scene_brak_arc', 'look', 'tell').effects;
const STAY = choice('scene_brak_arc', 'choose', 'stay').effects;
const COME_ANYWAY = choice('scene_brak_arc', 'choose', 'come_anyway').effects;
const NEXUS = choice('scene_brak_arc', 'choose', 'nexus');

// ---- The quests -----------------------------------------------------------------------------------------------------------------

describe('the six arc quests (STORY §11.1, §11.4; DESIGN §6.2)', () => {
  const table = STORY.slice(STORY.indexOf('### 11.1 Table'), STORY.indexOf('### 11.2'));
  const row = (id: string): string[] => need(table.split('\n').find((l) => l.startsWith(`| \`${id}\``)), id).split('|').map((c) => c.trim());
  const GIVER: Record<string, string> = { Ilyra: 'npc_ilyra', 'Keeper Dray / Ilyra': 'npc_ansel_dray', Brak: 'npc_brak', 'Brak / Kaelen': 'npc_brak' };

  test('all six are registered as companion quests, in arc order, with STORY’s names, givers, companions and loops; each on its companion record', () => {
    expect(arcQuests.map((q) => q.id)).toEqual(QUEST_IDS);
    for (const id of QUEST_IDS) {
      const q = quest(id);
      const r = row(id);
      expect([id, q.name, q.category, q.giverNpcId]).toEqual([id, r[2], 'companion', GIVER[r[4] as string]]);
      const who = (r[3] ?? '').split(' ')[0]?.toLowerCase();
      expect([id, q.companionId, q.factionId]).toEqual([id, who, who === 'ilyra' ? 'remnants' : 'ironclad']);
      expect([id, (r[6] ?? '').startsWith(id === 'q_blood_and_salt' ? '**1+' : '2+')]).toEqual([id, true]);
      expect([id, r[7]]).toEqual([id, id === 'q_the_scouts_oath' ? 'no' : 'yes']);
    }
    for (const c of companions.filter((c) => c.id === 'ilyra' || c.id === 'brak')) {
      expect([c.id, c.arcQuestIds]).toEqual([c.id, QUEST_IDS.filter((id) => quest(id).companionId === c.id)]);
      expect([c.id, c.campScenes]).toEqual([c.id, CAMP_IDS.filter((id) => id.startsWith(`scene_${c.id}_`))]);
    }
    expect(quest('q_the_scouts_oath').botHint).toBe('melee'); // STORY "Bots: M C"
    for (const id of QUEST_IDS.filter((id) => id !== 'q_the_scouts_oath')) expect([id, quest(id).botHint]).toEqual([id, 'explorer']);
  });

  test('prereqs are STORY §11.4’s: Loop 2+ (Blood and Salt in Loop 1, D-067.17), the Crystal, loyalty 25 and the Door’s key, Loyal and the cost, the Outpost, Brak’s death', () => {
    expect(quest('q_voices_in_the_stacks').availableWhen).toEqual({ all: [FROM_LOOP_2, { quest: { id: 'q_echo_crystal', status: 'completed' } }] });
    expect(storyBlock('q_voices_in_the_stacks')).toContain('Giver: Ilyra, after `q_echo_crystal`, Loop 2+.');
    expect(quest('q_the_danthe_line').availableWhen).toEqual({
      all: [FROM_LOOP_2, { loyalty: { companion: 'ilyra', min: 25 } }, { any: [{ echo: 'echo_archive_door' }, { item: { id: 'item_bell_vault_key' } }] }],
    });
    expect(storyBlock('q_the_danthe_line')).toContain('Prereq: `echo_archive_door` or Bell-Vault Key; Ilyra loyalty ≥ 25.');
    expect(quest('q_the_keepers_price').availableWhen).toEqual({
      all: [FROM_LOOP_2, { loyalty: { companion: 'ilyra', min: 50 } }, { any: [{ echo: 'echo_ilyra_cost' }, { quest: { id: 'q_keepers_ledger', status: 'completed' } }] }],
    });
    expect(storyBlock('q_the_keepers_price')).toContain('Prereq: Ilyra Loyal; `echo_ilyra_cost` or `q_keepers_ledger` complete.');
    expect(DESIGN).toContain('50 → arc stage 3');
    expect(DESIGN).toContain('25 → camp conversation 2 and the companion\'s arc stage 2 available');
    expect(quest('q_the_scouts_oath').availableWhen).toEqual({ all: [FROM_LOOP_2, { quest: { id: 'q_blighted_outpost', status: 'completed' } }] });
    expect(storyBlock('q_the_scouts_oath')).toContain('Giver: Brak after `q_blighted_outpost`. Ashen Steppe. Prereq: `{ loop: { min: 2 } }`.');
    expect(quest('q_blood_and_salt').availableWhen).toBeUndefined();
    expect(STORY).toContain('`q_blood_and_salt`, `q_bell_vault`, `q_lantern_in_the_reeds`, `q_high_mark` (marked\n**1+ (L1 open)** below)');
    // STORY's condition, verbatim
    expect(quest('q_the_line_he_holds').availableWhen).toEqual({ all: [{ echo: 'echo_brak_death' }, { quest: { id: 'q_blighted_outpost', status: 'completed' } }] });
    expect(storyBlock('q_the_line_he_holds')).toContain('Prereq: `{ all: [ { echo: "echo_brak_death" }, { quest: { id: "q_blighted_outpost", status: "completed" } } ] }`.');
    for (const id of QUEST_IDS) expect([id, quest(id).startWhen]).toEqual([id, undefined]);
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

  test('DESIGN §6.2 tier XP: an arc’s first quest pays 150, its second 250, its third 400; nothing pays gold or Resonance', () => {
    expect(DESIGN).toContain('companion arc 150/250/400');
    for (const c of ['ilyra', 'brak']) {
      const [one, two, three] = QUEST_IDS.filter((id) => quest(id).companionId === c);
      expect([c, quest(one as string).rewards.xp, quest(two as string).rewards.xp, quest(three as string).rewards.xp]).toEqual([c, 150, 250, 400]);
    }
    for (const q of arcQuests) expect([q.id, q.rewards.gold, q.rewards.resonance]).toEqual([q.id, 0, 0]);
  });

  test('STORY’s rewards and consequences every outcome pays ride on `rewards`: the watchword and Remnants +5, the First Drowned, the whistle, Ironclad +5 and the dropped name, Kaelen’s ledger', () => {
    expect(quest('q_voices_in_the_stacks').rewards).toMatchObject({ rep: [{ faction: 'remnants', delta: 5 }], echoes: ['echo_ilyra_watchword'], items: [] });
    expect(storyBlock('q_voices_in_the_stacks')).toContain('Consequences. `echo_ilyra_watchword` (usable from the next loop); Ilyra recruitable; Remnants +5.');
    expect(quest('q_the_danthe_line').rewards).toMatchObject({ rep: [], echoes: ['echo_oriel_drowned'], items: [] });
    expect(storyBlock('q_the_danthe_line')).toContain('Consequences. `echo_oriel_lineage`; `echo_oriel_drowned`; Remnants +10 or −5; Ilyra Loyal.');
    expect(stage('q_the_danthe_line', 'carrel').onEnter).toEqual([{ grantEcho: 'echo_oriel_lineage' }]);
    expect(quest('q_the_keepers_price').rewards).toMatchObject({ rep: [], echoes: [], items: [] });
    expect(quest('q_the_scouts_oath').rewards).toMatchObject({ items: [{ itemId: 'item_scouts_whistle', count: 1 }], rep: [{ faction: 'ironclad', delta: 5 }], echoes: ['echo_brak_birth_name'] });
    expect(storyBlock('q_the_scouts_oath')).toContain('Consequences. `echo_brak_birth_name`; Ironclad +5;');
    expect(storyBlock('q_the_scouts_oath')).toContain("Rewards. Scout's Whistle (call Brak to the active slot at any camp).");
    expect(quest('q_blood_and_salt').rewards).toMatchObject({ rep: [], echoes: ['echo_kaelen_ledger'], items: [] });
    expect(storyBlock('q_blood_and_salt')).toContain("Consequences. `echo_kaelen_ledger` (Kaelen's prices −5% for good).");
    expect(quest('q_the_line_he_holds').rewards).toMatchObject({ rep: [], echoes: [], items: [] });
    // the caravan (WORLD §12.1 ws_caravan) on the Oath's completion
    expect(stage('q_the_scouts_oath', 'named').onEnter).toEqual([{ setFlag: 'flag_hearthring_caravan' }]);
  });

  test('the stage graphs: objectives where STORY sends you; a stage a scene ends waits; every decision ends with the questAdvance into its outcome', () => {
    expect(stage('q_voices_in_the_stacks', 'stacks').objectives.map((o) => o.when)).toEqual([{ location: 'loc_shattered_library' }]);
    expect(stage('q_voices_in_the_stacks', 'second_watch').objectives.map((o) => o.when)).toEqual([{ all: [{ location: 'loc_shattered_library' }, { watch: 'night' }] }]);
    expect(stage('q_voices_in_the_stacks', 'ask').onEnter).toEqual([{ grantEcho: 'echo_litany_verse_1' }]);
    expect(storyBlock('q_voices_in_the_stacks')).toContain('Rest in the Shattered Library; the whispers resolve into verse 1, looped.');
    expect(stage('q_the_danthe_line', 'door').objectives.map((o) => o.when)).toEqual([{ all: [{ location: 'loc_sunken_scriptorium' }, { companion: { id: 'ilyra' } }] }]);
    expect(storyBlock('q_the_danthe_line')).toContain('Open the Door of Pages (`loc_sunken_scriptorium`)');
    expect(stage('q_the_scouts_oath', 'ride').objectives.map((o) => o.when)).toEqual([{ location: 'loc_scorched_gate' }]);
    expect(stage('q_the_scouts_oath', 'flats').objectives.map((o) => o.when)).toEqual([{ location: 'loc_ash_wind_flats' }]);
    expect(stage('q_the_scouts_oath', 'ring').objectives.map((o) => o.when)).toEqual([{ location: 'loc_hearthring' }]);
    expect(stage('q_the_scouts_oath', 'ride').onEnter).toEqual([
      { spawn: { creature: 'cr_salt_jackal', location: 'loc_scorched_gate' } },
      { spawn: { creature: 'cr_steppe_harrier', location: 'loc_ash_wind_flats' } },
    ]);
    expect(storyBlock('q_the_scouts_oath')).toContain('Two Steppe ambushes.');
    expect(stage('q_blood_and_salt', 'salt').objectives.map((o) => o.when)).toEqual([{ item: { id: SALT } }]);
    expect(stage('q_blood_and_salt', 'salt').advanceWhen).toEqual({ item: { id: SALT } });
    expect(pack.items[SALT]?.value).toBe(4); // STORY: "Steppe salt, 4 gold"
    expect(quest('q_blood_and_salt').shortcuts).toEqual([{ echo: 'echo_brak_birth_name', skipTo: 'kaelen', text: 'Kaelen knows who the salt is for.' }]);
    expect(storyBlock('q_blood_and_salt')).toContain('(or Kaelen, with `echo_brak_birth_name`, which starts it at stage 2)');
    const waits: [string, string][] = [
      ['q_voices_in_the_stacks', 'ask'],
      ['q_the_danthe_line', 'carrel'],
      ['q_the_danthe_line', 'oriel'],
      ['q_the_keepers_price', 'hear_him'],
      ['q_the_keepers_price', 'telling'],
      ['q_the_keepers_price', 'choose'],
      ['q_the_scouts_oath', 'oath'],
      ['q_blood_and_salt', 'kaelen'],
      ['q_blood_and_salt', 'to_brak_spoke'],
      ['q_blood_and_salt', 'to_brak_refused'],
      ['q_the_line_he_holds', 'tell'],
      ['q_the_line_he_holds', 'proof'],
      ['q_the_line_he_holds', 'choose'],
    ];
    for (const [questId, stageId] of waits) {
      const st = stage(questId, stageId);
      expect([questId, stageId, st.objectives.length, typeof st.next, st.advanceWhen]).toEqual([questId, stageId, 0, 'string', undefined]);
    }
    const ends: [readonly Effect[], string, string][] = [
      [WHAT_WOULD, 'q_voices_in_the_stacks', 'watchword'],
      [TAKE, 'q_the_danthe_line', 'taken'],
      [LEAVE, 'q_the_danthe_line', 'left'],
      [KEEPER, 'q_the_keepers_price', 'keeper'],
      [NEVER, 'q_the_keepers_price', 'unbound_hand'],
      [WORD, 'q_the_scouts_oath', 'named'],
      [KEEP_WORD, 'q_the_scouts_oath', 'named'],
      [SPOKE, 'q_blood_and_salt', 'spoke'],
      [FINE, 'q_blood_and_salt', 'fine'],
      [STAY, 'q_the_line_he_holds', 'kept_away'],
      [COME_ANYWAY, 'q_the_line_he_holds', 'comes_anyway'],
      [NEXUS.effects, 'q_the_line_he_holds', 'holds_nexus'],
    ];
    for (const [effects, questId, stageId] of ends) {
      expect([questId, stageId, effects.at(-1)]).toEqual([questId, stageId, { questAdvance: { quest: questId, stage: stageId } }]);
      expect([questId, stageId, stage(questId, stageId).outcome]).toEqual([questId, stageId, 'complete']);
    }
    // the passes a scene drives from inside
    expect(node('scene_the_first_drowned', 'written').onEnter).toEqual([{ grantEcho: 'echo_oriel_drowned' }, { questAdvance: { quest: 'q_the_danthe_line', stage: 'oriel' } }]);
    expect(node('scene_dray_keepers_price', 'years').onEnter).toEqual([{ grantEcho: 'echo_ilyra_cost' }, { questAdvance: { quest: 'q_the_keepers_price', stage: 'telling' } }]);
    expect(node('scene_dray_keepers_price', 'choose').onEnter).toEqual([{ questAdvance: { quest: 'q_the_keepers_price', stage: 'choose' } }]);
    expect(node('scene_brak_arc', 'prove').onEnter).toEqual([{ questAdvance: { quest: 'q_the_line_he_holds', stage: 'proof' } }]);
    for (const id of ['colour', 'words']) expect(choice('scene_brak_arc', 'prove', id).effects).toEqual([{ questAdvance: { quest: 'q_the_line_he_holds', stage: 'choose' } }]);
    expect(SAID_IT.effects.at(-1)).toEqual({ questAdvance: { quest: 'q_blood_and_salt', stage: 'to_brak_spoke' } });
    expect(ONLY_SALT.at(-1)).toEqual({ questAdvance: { quest: 'q_blood_and_salt', stage: 'to_brak_refused' } });
    // STORY "fails if Brak dies": the Tyrant killed while the quest still runs (no engine flag says `flag_brak_dead`)
    expect(quest('q_the_line_he_holds').failWhen).toEqual({ flag: 'flag_tyrant_dead' });
    expect(storyBlock('q_the_line_he_holds')).toContain('Fails if Brak dies (`flag_brak_dead`).');
    // no quest opens a scene (the barrel's rule); rule 18 is satisfied by the arcs' branching outcomes
    for (const q of arcQuests) expect([q.id, JSON.stringify(q.stages).includes('startDialogue')]).toEqual([q.id, false]);
    for (const q of arcQuests.filter((q) => q.id !== 'q_voices_in_the_stacks' && q.id !== 'q_the_scouts_oath')) expect([q.id, q.stages.filter((s) => s.outcome !== undefined).length >= 2]).toEqual([q.id, true]);
  });
});

// ---- DESIGN §12.5, §11.2, §11.3 and §13.3 ex. 5 ----------------------------------------------------------------------------------

describe('loyalty (DESIGN §12.5), reputation (STORY §11.4; DESIGN §11.2) and DESIGN §13.3 ex. 5', () => {
  test('§12.5 "personal quest stage completed +5": every stage that is not an outcome pays it on exit, except the Line’s decision, whose choices carry it', () => {
    expect(DESIGN_SECTION('### 12.5 Loyalty', '### 12.6')).toContain(`| personal quest stage completed | +${LOYALTY_STAGE} |`);
    for (const q of arcQuests) {
      for (const st of q.stages) {
        const expected = st.outcome !== undefined || (q.id === 'q_the_line_he_holds' && st.id === 'choose') ? [] : [{ loyalty: { companion: q.companionId, delta: LOYALTY_STAGE } }];
        expect([q.id, st.id, st.onExit]).toEqual([q.id, st.id, expected]);
      }
    }
    for (const effects of [STAY, COME_ANYWAY, NEXUS.effects]) expect(loyaltyOf(effects)).toEqual({ brak: LOYALTY_STAGE });
  });

  test('§12.5 "aligned +3" on STORY §7’s loyalty beats: the Litany read aloud (once a loop), the salt carried to Kaelen, the truth told, the oath-brother’s word; nothing here is against a value', () => {
    expect(STORY_FLAT).toContain('letting her read the Litany aloud in the Shattered Library');
    expect([loyaltyOf(READ_ALOUD.effects), READ_ALOUD.oncePerLoop]).toEqual([{ ilyra: LOYALTY_ALIGNED }, true]);
    expect(STORY_FLAT).toContain('carrying salt to Kaelen; not lying to him about the Apex; letting him choose.');
    expect(loyaltyOf(SAID_IT.effects)).toEqual({ brak: LOYALTY_ALIGNED });
    expect(loyaltyOf(ONLY_SALT)).toEqual({ brak: LOYALTY_ALIGNED });
    expect(loyaltyOf(TELL)).toEqual({ brak: LOYALTY_ALIGNED });
    expect(loyaltyOf(WORD)).toEqual({ brak: LOYALTY_ALIGNED });
    expect(loyaltyOf(KEEP_WORD)).toEqual({});
    const all = arcScenes.flatMap((s) => s.nodes.flatMap((n) => [...n.onEnter, ...n.choices.flatMap((c) => c.effects)]));
    expect(all.filter((e) => 'loyalty' in e && e.loyalty.delta < 0)).toEqual([]);
    expect(all.filter((e) => 'loyalty' in e && e.loyalty.delta === LOYALTY_AGAINST)).toEqual([]);
    // the camp conversations earn the engine's +2 and carry no loyalty of their own
    expect(DESIGN_SECTION('### 12.5 Loyalty', '### 12.6')).toContain(`| camp conversation (max one per full rest, needs new content) | +${CAMP_LOYALTY} |`);
    for (const id of CAMP_IDS) expect([id, scene(id).nodes.some((n) => [...n.onEnter, ...n.choices.flatMap((c) => c.effects)].some((e) => 'loyalty' in e))]).toEqual([id, false]);
  });

  test('reputation: Remnants +10 for the ring or −5 for leaving it, +15 for the Keeper; Ironclad +10 for the brothers (A only) and +10 on every end of the Line (DESIGN §11.2)', () => {
    expect(repOf(TAKE)).toEqual({ remnants: 10 });
    expect(repOf(LEAVE)).toEqual({ remnants: -5 });
    expect(storyBlock('q_the_danthe_line')).toContain('Remnants +10 or −5');
    expect(repOf(KEEPER)).toEqual({ remnants: 15 });
    expect(repOf(NEVER)).toEqual({});
    expect(storyBlock('q_the_keepers_price')).toContain('Keeper (stage `keeper`): path to E; Remnants +15;');
    expect(repOf(SPOKE)).toEqual({ ironclad: 10 });
    expect(repOf(FINE)).toEqual({});
    expect(storyBlock('q_blood_and_salt')).toContain("A: the brothers speak; Father's Whetstone to Brak; Ironclad +10. B: Kaelen refuses; nothing;");
    for (const effects of [STAY, COME_ANYWAY, NEXUS.effects]) expect(repOf(effects)).toEqual({ ironclad: 10 });
    expect(DESIGN_SECTION('### 11.2', '### 11.3')).toContain('| Telling Brak the truth with `echo_brak_death` | — | — | +10 | Brak survives the Apex |');
    // nothing else in these scenes moves reputation
    const all = arcScenes.flatMap((s) => s.nodes.flatMap((n) => [...n.onEnter, ...n.choices.flatMap((c) => c.effects)]));
    expect(all.filter((e) => 'rep' in e).length).toBe(7);
  });

  test('DESIGN §13.3 ex. 5, exactly: "Brak stays away" is its when and its three effects, then he leaves the party and the quest ends', () => {
    const ex5 = need(DESIGN.split('\n').find((l) => l.startsWith('5. **Brak stays away**')), 'ex. 5');
    const parse = (src: string): unknown => JSON.parse(src.replace(/([{,]\s*)([a-zA-Z]+):/g, '$1"$2":'));
    const whenSrc = /`when: (\{.*?\})` →/.exec(ex5)?.[1];
    const effectsSrc = /→ `(\[.*\])`/.exec(ex5)?.[1];
    expect(quest('q_the_line_he_holds').availableWhen).toEqual(parse(need(whenSrc, 'ex. 5 when')));
    expect(STAY.slice(0, 3)).toEqual(parse(need(effectsSrc, 'ex. 5 effects')) as Effect[]);
    expect(STAY.slice(3)).toEqual([{ dismiss: 'brak' }, { questAdvance: { quest: 'q_the_line_he_holds', stage: 'kept_away' } }]);
    expect(STORY_FLAT).toContain('he believes you and stays at the Ring of Wagons (`flag_brak_kept_away`; he lives; you lose his aid at the Apex)');
    expect(has(NEXUS.effects, { grantEcho: 'echo_brak_lives' }) && !COME_ANYWAY.some((e) => 'grantEcho' in e) && !STAY.some((e) => 'grantEcho' in e)).toBe(true);
    expect([NEXUS.disabledWhen, NEXUS.disabledText]).toEqual([{ not: { quest: { id: 'q_blood_and_salt', stage: 'spoke' } } }, "(He would need his brother's salt, and his brother's word)"]);
    expect(STORY_FLAT).toContain('Outcome C (needs `q_blood_and_salt` A): he comes with Kaelen\'s salt and holds the line at the Nexus instead');
  });

  test('the Keeper’s Echo at Remnants Trusted, checked after the +15; the First Drowned gives the scroll if the quest is open; Listen gives verse I', () => {
    expect(KEEPER[1]).toEqual({ onlyIf: { when: { rep: { faction: 'remnants', min: 20 } }, effects: [{ grantEcho: 'echo_portal_tear' }] } });
    expect(storyBlock('q_the_keepers_price')).toContain('with Remnants ≥ 20, `echo_portal_tear`');
    expect(node('scene_the_first_drowned', 'scroll').onEnter).toEqual([{ onlyIf: { when: { quest: { id: 'q_lost_scroll', stage: 'recover' } }, effects: [{ giveItem: { item: 'item_scholars_lost_scroll' } }] } }]);
    expect(STORY_FLAT).toContain('Effect: `echo_oriel_drowned`; `q_lost_scroll` stage 2 if open.');
    expect(node('scene_the_first_drowned', 'verse').onEnter).toEqual([{ grantEcho: 'echo_litany_verse_1' }]);
    expect(has(TAKE, { giveItem: { item: 'item_oriels_ring' } }) && !LEAVE.some((e) => 'giveItem' in e)).toBe(true);
    // Kaelen: the salt if none is carried, the whetstone; Brak takes both on A, the salt on B
    expect(SAID_IT.effects.slice(0, 2)).toEqual([{ onlyIf: { when: { not: { item: { id: SALT } } }, effects: [{ giveItem: { item: SALT } }] } }, { giveItem: { item: 'item_fathers_whetstone' } }]);
    expect(SPOKE.slice(0, 2)).toEqual([{ takeItem: { item: SALT } }, { takeItem: { item: 'item_fathers_whetstone' } }]);
    expect(FINE[0]).toEqual({ takeItem: { item: SALT } });
  });
});

// ---- The scenes ------------------------------------------------------------------------------------------------------------------

describe('the scenes (the conventions of src/content/shared/dialogues/index.ts; DESIGN §12.1, §12.7; STORY §5.2, §6.4, §7, §13)', () => {
  test('the listed scenes, all registered; NPC scenes closed in the Horde, every priority a band; the carrel’s and the camps’ have no NPC', () => {
    expect(arcScenes.map((s) => s.id)).toEqual(SCENE_IDS);
    const bands = Object.values(SCENE_PRIORITY) as number[];
    for (const s of arcScenes) {
      if (NO_NPC.includes(s.id)) {
        expect([s.id, s.npcId]).toEqual([s.id, undefined]);
        continue;
      }
      expect([s.id, bands.includes(s.priority), typeof s.npcId]).toEqual([s.id, true, 'string']);
      expect([s.id, JSON.stringify(s.when).startsWith(`{"all":[${JSON.stringify(NOT_IN_HORDE)}`)]).toEqual([s.id, true]);
    }
    const band = (id: string) => scene(id).priority;
    expect(['scene_ilyra_arc', 'scene_brak_arc', 'scene_kaelen_blood_and_salt_offer', 'scene_dray_keepers_price'].map(band)).toEqual(Array(4).fill(SCENE_PRIORITY.offer));
    expect(SCENE_IDS.filter((id) => id.endsWith('_waiting')).map(band)).toEqual(Array(3).fill(SCENE_PRIORITY.waiting));
    expect(SCENE_IDS.filter((id) => id.endsWith('_deja_vu')).map(band)).toEqual(Array(3).fill(SCENE_PRIORITY.dejaVu));
    expect(['scene_ilyra_voices_ask', 'scene_the_first_drowned', 'scene_braks_brother'].map(band)).toEqual(Array(3).fill(SCENE_PRIORITY.decision));
    expect(['scene_hadda_scouts_oath', 'scene_brak_blood_and_salt_offer', 'scene_brak_blood_and_salt_report'].map(band)).toEqual(Array(3).fill(SCENE_PRIORITY.report));
    expect(band('scene_borin_oath')).toBe(SCENE_PRIORITY.payoff);
    // the déjà vu band: under every offer and report, above the reminders
    expect(SCENE_PRIORITY.dejaVu > SCENE_PRIORITY.waiting && SCENE_PRIORITY.dejaVu < SCENE_PRIORITY.offer).toBe(true);
    for (const id of SCENE_IDS.filter((id) => id.endsWith('_deja_vu') || id === 'scene_borin_oath')) expect([id, scene(id).repeatable]).toEqual([id, false]);
  });

  test('DESIGN §12.1 recruitment: Ilyra Loop 2+ after the Crystal (or the watchword), Remnants ≥ Neutral, believing you; Brak after q_clear_path in any loop, Ironclad ≥ Neutral', () => {
    expect(designRecruitRow('ilyra')).toContain('**Loop 2+** (D-069.4; STORY wins) — after `q_echo_crystal` resolved (either way) and `q_lost_scroll` accepted; Remnants ≥ Neutral');
    expect(STORY_FLAT).toContain('Loop 2+: after `q_echo_crystal` resolves either way and the player tells her about the loop, or immediately with `echo_ilyra_watchword`.');
    const come = choice('scene_ilyra_arc', 'hub', 'come');
    expect(come.effects).toEqual([{ recruit: 'ilyra' }]);
    expect(come.when).toEqual({
      all: [
        FROM_LOOP_2,
        { rep: { faction: 'remnants', min: -9 } },
        { not: { companion: { id: 'ilyra', state: 'recruited' } } },
        { not: { flag: 'flag_heartstone_exploited' } },
        { any: [{ flag: 'flag_ilyra_told' }, { flag: 'flag_choice_scene_first_meeting_ilyra_watchword' }, { quest: { id: 'q_voices_in_the_stacks', status: 'completed' } }] },
        { any: [{ flag: 'flag_choice_scene_first_meeting_ilyra_watchword' }, { quest: { id: 'q_echo_crystal', status: 'completed' } }] },
      ],
    });
    expect(choice('scene_ilyra_arc', 'again', 'come').when).toEqual(come.when);
    expect(choice('scene_ilyra_arc', 'hub', 'tell').effects).toEqual([{ setFlag: 'flag_ilyra_told' }]);
    expect(choice('scene_ilyra_deja_vu', 'tier5', 'tell').effects).toEqual([{ setFlag: 'flag_ilyra_told' }]);
    expect(designRecruitRow('brak')).toContain('after `q_clear_path`; Ironclad ≥ Neutral');
    expect(STORY_FLAT).toContain('After `q_clear_path` in any loop (Loop 1 included; he joins for the Outpost); Ironclad ≥ Neutral.');
    const brak = choice('scene_brak_arc', 'hub', 'come');
    expect(brak.effects).toEqual([{ recruit: 'brak' }]);
    expect(brak.when).toEqual({ all: [{ quest: { id: 'q_clear_path', status: 'completed' } }, { rep: { faction: 'ironclad', min: -9 } }, { not: { companion: { id: 'brak', state: 'recruited' } } }] });
    expect(DESIGN_SECTION('### 11.1', '### 11.2')).toContain('Neutral −9..19');
    // the Oath recruits him on accepting ("ride with him")
    expect(choice('scene_brak_arc', 'ask_ring', 'yes').effects).toEqual([{ recruit: 'brak' }, { questStart: 'q_the_scouts_oath' }]);
    // the hubs open only while one of their offers does
    expect(scene('scene_ilyra_arc').when).toEqual({ all: [NOT_IN_HORDE, { any: ['tell', 'come', 'voices', 'door', 'tear'].map((id) => choice('scene_ilyra_arc', 'hub', id).when) }] });
    expect(scene('scene_brak_arc').when).toEqual({ all: [NOT_IN_HORDE, { any: ['come', 'ring', 'salt', 'apex'].map((id) => choice('scene_brak_arc', 'hub', id).when) }] });
  });

  test('DESIGN §12.7 camp conversations: no NPC, once a loop, the first with the companion in the party, the second from loyalty 25, the third from 50, in that order', () => {
    expect(DESIGN).toContain('Each full rest with an active companion offers at most one conversation node, gated by `{ companion: { id } }` and `{ loyalty: { companion, min } }`');
    for (const c of ['ilyra', 'brak']) {
      const [one, two, three] = CAMP_IDS.filter((id) => id.startsWith(`scene_${c}_`)).map(scene);
      expect([c, one?.when, two?.when, three?.when]).toEqual([
        c,
        { companion: { id: c } },
        { all: [{ companion: { id: c } }, { loyalty: { companion: c, min: 25 } }] },
        { all: [{ companion: { id: c } }, { loyalty: { companion: c, min: 50 } }] },
      ]);
      expect([c, one?.priority, two?.priority, three?.priority]).toEqual([c, 3, 2, 1]);
      for (const s of [one, two, three]) expect([s?.id, s?.repeatable, s?.npcId]).toEqual([s?.id, false, undefined]);
    }
  });

  test('every node is tagged by its source: story text is STORY’s, legacy text the Python’s, written text the pinned list (each ≤ 30 words)', () => {
    for (const s of arcScenes) {
      for (const n of s.nodes) {
        const tag = n.tags[0];
        if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else if (tag === 'legacy') expect([s.id, n.id, DATA.includes(n.text) || GAME.includes(n.text)]).toEqual([s.id, n.id, true]);
        else expect([s.id, n.id, tag, WRITTEN.nodes.includes(n.text)]).toEqual([s.id, n.id, 'written', true]);
        for (const v of n.textVariants) expect([s.id, n.id, WRITTEN.variants.includes(v.text)]).toEqual([s.id, n.id, true]);
      }
    }
    const legacyNodes = arcScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'legacy').map((n) => [s.id, n.id]));
    expect(legacyNodes).toEqual([
      ['scene_the_first_drowned', 'sodden'],
      ['scene_braks_brother', 'greeting'],
    ]);
    expect(DATA).toContain('"description": "A sodden scholar bound to drowned pages, still guarding secrets."');
    expect(GAME).toContain('print(npc_name("Kaelen: Steel and salt are all that keep you breathing out here."))');
    const storyNodes = arcScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'story').map((n) => `${s.id}.${n.id}`));
    expect(storyNodes).toEqual([
      'scene_ilyra_deja_vu.hands',
      'scene_ilyra_deja_vu.dream',
      'scene_ilyra_deja_vu.tier3',
      'scene_ilyra_deja_vu.tier5',
      'scene_ilyra_voices_ask.verse',
      'scene_the_first_drowned.reading',
      'scene_the_first_drowned.ours',
      'scene_the_first_drowned.lifts',
      'scene_the_first_drowned.written',
      'scene_the_first_drowned.nobody',
      'scene_the_first_drowned.scroll',
      'scene_the_first_drowned.verse',
      'scene_dray_keepers_price.ilyra',
      'scene_ilyra_camp_1.ninth',
      'scene_ilyra_camp_3.listen',
      'scene_brak_deja_vu.fire',
      'scene_brak_deja_vu.ache',
      'scene_brak_deja_vu.tier3',
      'scene_brak_deja_vu.tier5',
      'scene_kaelen_blood_and_salt_offer.name',
      'scene_braks_brother.sack',
      'scene_braks_brother.dont_have',
      'scene_braks_brother.hands',
      'scene_braks_brother.coat',
      'scene_braks_brother.did_he',
      'scene_braks_brother.free',
      'scene_braks_brother.four_gold',
      'scene_brak_camp_1.steel',
      'scene_brak_camp_1.glow',
      'scene_brak_camp_2.salt',
      'scene_brak_camp_3.man',
      'scene_brak_camp_3.pack',
      'scene_kaelen_deja_vu.look',
      'scene_kaelen_deja_vu.tier3',
      'scene_kaelen_deja_vu.tier5',
    ]);
  });

  test('STORY’s lines sit where STORY puts them: the déjà vu by loop tier (§5.2, §6.4), the key scenes’ words (§13), the voices (§7), verse I (§2.3)', () => {
    for (const [id, who, loop2] of [['scene_ilyra_deja_vu', 'Ilyra', 'hands'], ['scene_brak_deja_vu', 'Brak', 'fire'], ['scene_kaelen_deja_vu', 'Kaelen', 'look']] as const) {
      const s = scene(id);
      expect(s.entry).toEqual([{ when: { loop: { min: 5 } }, node: 'tier5' }, { when: { loop: { min: 3 } }, node: 'tier3' }, { when: { all: [] }, node: loop2 }]);
      const tiers = STORY.slice(STORY.indexOf(`**${who}**\n- Tier 2:`), STORY.indexOf('\n\n', STORY.indexOf(`**${who}**\n- Tier 2:`)));
      expect(tiers).toContain(`- Tier 3–4: "${node(id, 'tier3').text.slice(0, 20)}`);
      expect(tiers).toContain(`- Tier 5+: "${node(id, 'tier5').text.slice(0, 20)}`);
    }
    expect(node('scene_ilyra_deja_vu', 'hands').textVariants).toEqual([{ when: { echo: 'echo_litany_verse_1' }, text: `${node('scene_ilyra_deja_vu', 'hands').text} You hummed something just now. Where did you hear that? I have never... I think I have always known it.` }]);
    expect(STORY_FLAT).toContain('With `echo_litany_verse_1`: "You hummed something just now. Where did you hear that? I have never... I think I have always known it."');
    expect(scene('scene_ilyra_deja_vu').when).toEqual({ all: [NOT_IN_HORDE, FROM_LOOP_2, { flag: 'flag_scene_done_scene_first_meeting_ilyra' }] });
    expect(scene('scene_brak_deja_vu').when).toEqual({ all: [NOT_IN_HORDE, FROM_LOOP_2, { flag: 'flag_scene_done_scene_brak_clear_path_offer' }] });
    // the key scenes, in STORY's order
    expect(scene('scene_the_first_drowned').nodes.map((n) => n.id)).toEqual(['sodden', 'reading', 'seal_up', 'ours', 'lifts', 'voice', 'written', 'nobody', 'scroll', 'ring', 'listened', 'verse', 'took', 'left']);
    expect(node('scene_the_first_drowned', 'written').speaker).toBe('cr_drowned_archivist');
    expect(STORY_FLAT).toContain('Oriel: (a voice like a page turning) Let it be written as it is done. You have my hands. Who taught you to hold a pen like that?');
    expect(scene('scene_braks_brother').nodes.map((n) => n.id)).toEqual(['greeting', 'sack', 'dont_have', 'hands', 'coat', 'did_he', 'free', 'four_gold']);
    expect(SAID_IT.text).toBe('He said it once. At the Ring, in the dark. Stonehand.');
    expect(STORY_FLAT).toContain('Wayfinder: He said it once. At the Ring, in the dark. Stonehand.');
    expect([SAID_IT.echoHint, SAID_IT.disabledWhen, SAID_IT.when, SAID_IT.tags]).toEqual(['echo_brak_birth_name', { not: { echo: 'echo_brak_birth_name' } }, FROM_LOOP_2, ['echo']]);
    expect(STORY_FLAT).toContain('Choices: [`echo_brak_birth_name`] "He said it." → outcome A (whetstone; the brothers will speak). Without the Echo: Kaelen: "Salt\'s four gold. Don\'t come back with messages." → outcome B.');
    // verse I, STORY §2.3
    expect(node('scene_ilyra_voices_ask', 'verse').text).toBe('Let it be written as it is done.\nLet the hand fail and the word stand.\nWhat we do here, we do before the stone.');
    expect(node('scene_the_first_drowned', 'verse').text).toBe(node('scene_ilyra_voices_ask', 'verse').text);
    // the name, said once, in the dark; Hadda's "Brak of the Ironclad"
    expect(node('scene_hadda_scouts_oath', 'name').text).toBe('Stonehand.');
    expect(node('scene_hadda_scouts_oath', 'names').text.startsWith('Brak of the Ironclad.')).toBe(true);
    expect(STORY_FLAT).toContain('At the Ring, Hadda calls him "Brak of the Ironclad"; that night he says the other name once.');
    expect(node('scene_ilyra_voices_ask', 'answer').text).toContain('The ink still holds.');
    expect(STORY_FLAT).toContain('She chooses: "the ink still holds."');
    // the Keeper's table carries her stance (STORY §7.1) and Brak's camp his (§7.2)
    expect(node('scene_dray_keepers_price', 'ilyra').text).toBe("I don't want to hold the door forever. I want to understand why it needs holding.");
    expect(node('scene_brak_camp_3', 'man').text).toBe("Then it's a man standing in a door. I've done that. You don't shoot the man. You find out what's behind him.");
    expect(scene('scene_brak_camp_3').entry).toEqual([{ when: { flag: 'flag_heartstone_exploited' }, node: 'pack' }, { when: { echo: 'echo_tyrant_jailer' }, node: 'man' }, { when: { all: [] }, node: 'word' }]);
  });

  test('the Echoes read here resolve D-105/D-109’s open items: the bond, the oath-brother, the ledger, the cost, the tear, the Choir refusal has no hook', () => {
    expect(node('scene_ilyra_camp_1', 'copies').textVariants.map((v) => v.when)).toEqual([{ echo: 'echo_ilyra_bond' }]);
    expect(node('scene_hadda_scouts_oath', 'word').textVariants.map((v) => v.when)).toEqual([{ echo: 'echo_ironclad_oath' }]);
    expect(node('scene_kaelen_deja_vu', 'look').textVariants.map((v) => v.when)).toEqual([{ echo: 'echo_kaelen_ledger' }]);
    expect(scene('scene_dray_keepers_price').when).toEqual({
      all: [
        NOT_IN_HORDE,
        FROM_LOOP_2,
        { loyalty: { companion: 'ilyra', min: 50 } },
        { companion: { id: 'ilyra' } },
        { any: [{ echo: 'echo_ilyra_cost' }, { quest: { id: 'q_keepers_ledger', status: 'completed' } }] },
        { not: { quest: { id: 'q_the_keepers_price' } } },
      ],
    });
    expect(choice('scene_ilyra_arc', 'hub', 'tear').when).toEqual({
      all: [FROM_LOOP_2, { echo: 'echo_portal_tear' }, { rep: { faction: 'remnants', min: 20 } }, { not: { quest: { id: 'q_the_keepers_price', stage: 'unbound_hand' } } }, { not: { flag: 'flag_library_portal_open' } }],
    });
    expect(choice('scene_ilyra_arc', 'thin', 'open').effects).toEqual([{ setFlag: 'flag_library_portal_open' }]);
    expect(STORY_FLAT).toContain('from Loop 2 with Remnants Trusted and `echo_portal_tear`, a portal Ilyra opens on purpose');
    expect(node('scene_borin_oath', 'oath').onEnter).toEqual([{ grantEcho: 'echo_borin_oath' }]);
    expect(scene('scene_borin_oath').when).toEqual({ all: [NOT_IN_HORDE, { quest: { id: 'q_blighted_outpost', status: 'completed' } }, { not: { echo: 'echo_borin_oath' } }] });
    expect(STORY).toContain('| `echo_borin_oath` | Borin\'s Oath | `q_blighted_outpost` complete, then talk to Borin |');
    // Ilyra leaves after an Exploit (STORY §7.1): the Heartstone scene's onEnd, and her reaction
    expect(scene('scene_heartstone_choice').onEnd).toEqual([{ onlyIf: { when: { all: [{ flag: 'flag_heartstone_exploited' }, { companion: { id: 'ilyra', state: 'recruited' } }] }, effects: [{ dismiss: 'ilyra' }] } }]);
    expect(STORY_FLAT).toContain('Will not help exploit the Heartstone and leaves the party for the loop if the player does.');
    // the carrel's event (regions/silverwood_ruins) opens the First Drowned with her in the party; Brak waits at Hearthring kept away
    expect(pack.locations['loc_sunken_archives']?.events.find((e) => e.id === 'ev_archives_first_drowned')).toMatchObject({
      once: false,
      when: { all: [{ quest: { id: 'q_the_danthe_line', stage: 'carrel' } }, { companion: { id: 'ilyra' } }] },
      effects: [{ startDialogue: 'scene_the_first_drowned' }],
    });
    expect(pack.npcs['npc_brak']?.schedule).toEqual([{ when: { flag: 'flag_brak_kept_away' }, at: ['loc_hearthring'] }]);
  });

  test('choice texts and the other written words are exactly the pinned lists (the lead checks them)', () => {
    const nodes = arcScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'written').map((n) => n.text));
    const choices = arcScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.map((c) => c.text)));
    const journals = arcQuests.flatMap((q) => q.stages.filter((st) => st.tags?.[0] === 'written').map((st) => st.journal));
    const variants = arcScenes.flatMap((s) => s.nodes.flatMap((n) => n.textVariants.map((v) => v.text)));
    expect([...new Set(nodes)].sort()).toEqual([...WRITTEN.nodes].sort());
    expect([...new Set(choices)].sort()).toEqual([...WRITTEN.choices].sort());
    expect([...new Set(journals)].sort()).toEqual([...WRITTEN.journals].sort());
    expect([...new Set(variants)].sort()).toEqual([...WRITTEN.variants].sort());
    const other = [...arcQuests.map((q) => q.description), ...arcQuests.flatMap((q) => q.shortcuts.map((s) => s.text)), ...arcScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.flatMap((c) => (c.disabledText === undefined ? [] : [c.disabledText]))))];
    expect([...new Set(other)].sort()).toEqual([...WRITTEN.other].sort());
    for (const t of [...WRITTEN.nodes, ...WRITTEN.choices, ...WRITTEN.journals, ...WRITTEN.other]) expect([t, words(t) <= 30]).toEqual([t, true]);
    for (const t of WRITTEN.variants) expect([t, words(t) <= 36]).toEqual([t, true]); // STORY's hummed line appended to STORY's hands line
    // STORY §15.1's banned words stay out of the new text; Brak Stonehand is never said in dialogue (BIBLE §7)
    const banned = /\b(fabric of (reality|existence)|eldritch|unspeakable|unimaginable|nightmarish|epic|suddenly|very|literally|ancient|mysterious|ethereal)\b|!|You feel a sense of|Brak Stonehand/i;
    for (const t of [...WRITTEN.nodes, ...WRITTEN.choices, ...WRITTEN.journals, ...WRITTEN.other, ...WRITTEN.variants]) expect([t, banned.test(t)]).toEqual([t, false]);
  });
});

/** Every word U54 wrote (the reply lists them). */
const WRITTEN = {
  nodes: [
    'Then I will hold you to it, and I will try to hold you to it gently.',
    'Yes, Wayfinder? Ask. I have ink enough for one more answer tonight.',
    '...Then say it again when it is true, and I will know it. I think I half know it now.',
    'Then I will bring ink. Something should be written down as it is done.',
    'Then I will be here, with the ink, until you change your mind.',
    'At night the Library speaks. One voice, over and over, and it is mine, Wayfinder. I have never set foot in there after dark.',
    'Wait with me there past the second watch. I want to hear what it says when it thinks no one is listening. Will you?',
    'Be in the stacks when the night watch comes, and do not light the lamp. I will find you; I know the shelves blind.',
    'Then it can go on talking to itself. It has had five hundred years of practice.',
    "The Keeper says the Door of Pages opens to one seal, and no one living carries it. This is the Remnants' seal. I have worn it since I was twelve.",
    'Come down to the Reach with me and let me try it on the door. If it opens, I want to know why. Will you?',
    'Below the Archives, past the lamps. Keep the lantern lit; I will keep the seal dry.',
    'Then the door keeps its secret a little longer. It is good at that.',
    'I know where the Library is thin now. I can open it on purpose, Wayfinder, if you need to go. It will cost what it costs.',
    'Then go to the Library. I will be there before you, and I will hold it until you step through.',
    'The stacks, after dark. Wait through the night watch; it does not speak to anyone in a hurry.',
    'I sat where you sat. The stone kept it: one verse, over and over, in a voice I know in the dark. It is mine, and older than I am.',
    'Say it, then. You have been carrying a question since the Ruins.',
    '...The ink still holds. Nobody has heard me say it. If you ever come to me with those words, Wayfinder, I will believe whatever follows them.',
    "The Scriptorium, west of the Lamplighters' Rest. Take me to the door; I will not try the seal without you.",
    'The carrel under the east stair, where the Archivist reads. Take me there. I think she is waiting.',
    'Ilyra holds up the seal.',
    'When she speaks it is a voice like a page turning.',
    "On the carrel, by the scroll, a seal-ring. The Archivist's hand has slipped off it.",
    'You hold the Amulet to the water, and the verse comes up through it in her voice.',
    'It fits. Of course it fits. Then I am hers, and I will carry it where she cannot.',
    'No. She can keep her ring and her claim. I hold a pen the way I hold it; nobody taught me, and nobody owns it.',
    // U34f: Dray's hub while both of his offers stand (D-113 "Dray's tie")
    'Two pages open on my table tonight: the empty line in the Ledger, and what Ilyra should hear from me. Which first?',
    'Sit, both of you. Ilyra, you will tear the Library open one day; every strong Ley-hand in my book did. I know what it costs. You do not.',
    'Let her hear it from me, Wayfinder, before she learns it from her hands. Will you?',
    'Every Ley-hand who tore that portal is in my book: the year she tore it, the year she died. Each one costs years she will not get back.',
    "There is another way. The Keeper's. It costs everything and keeps everything: a Keeper remembers every day of every year, and tears nothing.",
    'Then understand it from inside, or swear off it. The eighth line is yours to fill either way, Ilyra. Choose.',
    'Then I will be the one who remembers. Write it in pencil, Keeper; I will ink it myself when I know how it ends.',
    'Good. Then I will show you where the Library is thin, and you will open it only on purpose, and only once you are sure.',
    'Never again. Not this loop; not while there is another way. If the day comes, Wayfinder, I will stand beside you with my hands at my sides.',
    'An unbound hand. The Archive has had Keepers; it has not had one of those. I will write that down too.',
    'Then she will learn it the way the others did. I will keep the page ruled.',
    'Ilyra copies a page by the fire, her lips moving with the lines.',
    "Oriel Danthe's record of the Conflux, the part we have. The ninth copy says Witness where the eighth said Watcher. I did not change it.",
    'I will keep both. The Archive keeps everything, and one of them is a lie I cannot find yet.',
    'I will, when the ink dries. Go on. The whispers keep me company; they always have.',
    'The Remnants say the thing at the Apex is a wound with a lid on it. I said it too. Now I think it is a hand on the lid.',
    'Hold it better. Not kill it; nothing we have killed here has stayed dead. Hold it so that it does not hurt. I do not know yet what that means.',
    'My hands know something I do not. When I am near the Library they ache. I would like to understand why, before they decide for me.',
    "There. Under the fire's noise. Someone said a verse here once, and the stones are still saying it back, slower each year.",
    'That is enough for tonight. Sleep, Wayfinder. I will listen a little longer; it is what I am for.',
    '...What.',
    "Peaks are quiet. The Outpost won't be. Two golems, and you. I'm coming. Don't argue; I've packed.",
    'Good. Steel in front, you behind. Try not to glow at anything that bites.',
    "Camp reports to the Ring every season. Season's up. Two days of ash east, and things on it that bite.",
    "Ride with me. I'd sooner have you at my back than the wind. Will you?",
    "Dawn, then. Off-foot back on the ash; it slides. If a jackal gets up, it's not alone.",
    'Then I ride alone. Faster, anyway. Quieter.',
    "Camp's short of salt. Kaelen sells it, down at the Respite. Four gold the sack.",
    "I'm not asking him. Somebody has to carry it. You've got the legs and nobody's name. Will you?",
    "Good. Don't tell him who it's for. He'll weigh you for it.",
    "I won't. That's the point.",
    "You've got that look again. Like you've watched me do something stupid and can't decide whether to say so.",
    "...No. I'd remember dying. ...Say it again.",
    'He does not believe it. His shoulders do; they have set themselves the way scouts are taught, the off-foot back.',
    "Prove it. What colour's the floor up there? Or tell me what I said. I'd have said something.",
    "...That's what I'd say. That's exactly what I'd say. All right. All right, then.",
    "Then it's mine to choose. Tell me what you'd have me do, and I'll tell you what I'll do.",
    "The Ring. I'll sit at Hadda's fire and hate every hour of it. Go on without me, Wayfinder. Don't look back; I said that already, apparently.",
    "I'm coming anyway. To see it. If it goes the way you say, it goes the way you say. One of them runs out.",
    "The Nexus, then. Kaelen's salt in my pack and his whetstone on my axe. The Horde's thinner there; I'll hold it where it can be held.",
    'East. The Gate, the Flats, the Ring. Stop talking to me here and ride.',
    'Brak of the Ironclad. Sit. You rode the Flats with a stranger at your back and lost nothing; the fire will hear your report.',
    'He reports: the Peaks, the Outpost, the count of the dead, in fragments. Hadda hears it to the end and nods once.',
    'That night the fire burns low. Brak sits with his back to a stone and his axe across his knees, and says the other name once.',
    'Stonehand.',
    "Don't say it back. Say it once and you give it away; that's the oath. Your word now, Wayfinder. Oath-brother's. You don't repeat it either.",
    "Then that's two of us holding it. Here. The whistle. One note at any fire, and I come.",
    'Fair. A word kept is a word kept. Here. The whistle, anyway. One note at any fire, and I come.',
    'He sees you look at the salt sacks, and then at him, and he knows what you nearly said.',
    'Whatever he needs, it goes on the counter at the price on the board. Say what it is.',
    "Then it's a sack of salt, and we'll see about the price.",
    'You set the sack down, and the whetstone on top of it. Brak looks at the stone a long time before he looks at you.',
    "That's Father's. He kept it. ...Needs oiling. He'd say that. He'd say I never oiled anything.",
    "Tell him— no. I'll tell him. Market day. I'll stand at his counter and find the name for it.",
    'You set the sack down. Brak counts it with his eyes and does not ask.',
    "Good. Camp's short. ...He say anything? No. He wouldn't. It's fine.",
    'It is not.',
    'Brak sharpens the chipped axe by the fire. It is not getting sharper.',
    "I'll take the first watch. Scouts don't sleep first. Scouts don't sleep much.",
    "The oath takes it. You come to the fire with nothing; the clan gives you a name that's only yours. He left before the fire. Kept Father's.",
    "He says I gave it back like a coat. Maybe. It was warm. It wasn't mine.",
    "The thing at the Apex. Everyone's got a word for it. The Remnants say wound. The Weavers say gate. We say kill it.",
    "Kill it, then. Properly, with the hand that's for it. If it bleeds it dies; if it dies the Horde dies with it. That's the Telling.",
    "Whatever's behind him, it's worse than him. That's what a door's for. I'll hold the one I'm given and let you look.",
    "I'll walk as far as the Nexus. I won't walk into the Apex behind that. Find somebody who glows more than you do.",
    "Brak says you held the Outpost. The fire's taken your measure, then; she doesn't take it twice.",
    "Speak plain, after this: the void-forged work is yours without the clan's say. That's my oath, not theirs. Don't make me regret it.",
  ],
  choices: [
    'The empty line.', // U34f: scene_dray_offers
    'What Ilyra should hear.',
    'Neither, tonight.',
    "I'll tell you. All of it.",
    'Not here. Not yet.',
    "Ilyra, I've done this before.",
    'Come with me.',
    'About the voice in the Library.',
    'About the Door of Pages.',
    'Open the Library.',
    'Nothing. The whispers.',
    'Not yet.',
    "I'll wait with you.",
    'Not tonight.',
    "We'll try it.",
    'Open it.',
    'Not now.',
    'Read it to me.',
    'Go on.',
    'What would you say to someone who claimed to know you?',
    'Nothing yet.',
    'Listen.',
    'Take the ring.',
    'Leave it.',
    'Tell her.',
    "Let her take the Keeper's way.",
    'Let her swear it: never again.',
    'What is the page?',
    'Sleep, Ilyra.',
    'What would you do with it?',
    'Sleep on it.',
    'Later.',
    'About the Ring of Wagons.',
    'About the barricade.', // U59: the hub's way to the Warden's quest
    'About the salt.',
    'About the Apex.',
    'Nothing.',
    "I'll ride with you.",
    'Not this season.',
    "I'll carry it.",
    'Carry it yourself.',
    "You die at the Apex. I've watched it.",
    'No colour. There is no floor up there, only seams folding under your feet.',
    "You said: go. I'll hold them back as long as I can. Don't look back.",
    'Stay at the Ring. Live.',
    'Come anyway. See it.',
    'Hold the Nexus instead. The Horde is thinner there.',
    'You have my word.',
    'I keep my word to myself.',
    'Your brother needs salt for the camp.',
    'Nothing. Salt for the road.',
    'Your brother.',
    'Nobody. Not yet.',
    'He said it once. At the Ring, in the dark. Stonehand.',
    'I only carry the salt.',
    'And me?',
    'Sleep, Brak.',
    'Why did you give the name back?',
    "I'll leave it.",
  ],
  journals: [
    'Wait in the Shattered Library past the second watch. What speaks there speaks at night.',
    'The whispers settled into one verse, looped, in her own voice. Ask Ilyra what she would say to someone who claimed to know her.',
    'The ink still holds. Ilyra has said it aloud once, to you.',
    "The Door opened to her seal; Oriel Danthe's hand is on every shelf. Take Ilyra back to the carrel under the east stair of the Sunken Archives.",
    "Oriel Danthe knows Ilyra's hands. Let Ilyra answer her.",
    "Ilyra took Oriel's ring, and the line that comes with it, openly.",
    'Ilyra left the ring where it lay. A dead woman has no claim on her hands.',
    "Each portal costs years she will not get back. The Keeper's way costs everything and keeps everything.",
    'Ilyra chooses: the Keeper who remembers, or never again.',
    'Ilyra will be the Keeper who remembers. With the Remnants Trusted she can open the Library portal on purpose.',
    'Ilyra has sworn never to tear a portal again. Not this loop.',
    'The Ash-Wind Flats: herd-paths, grey ash, things that bite. Hearthring is east over them.',
    'Hearthring, the Ring of Wagons. Bring Brak to the fire; the clan-mother has his report to hear.',
    'Hadda Ironvow has the word for him. Stand with Brak at the fire, and stay the night.',
    'Brak said the name once, in the dark: Stonehand. The Ring has his report, and you have his whistle.',
    'Take the salt to Kaelen at the Respite. He will want to know who it is for.',
    "Kaelen gave the salt free, and their father's whetstone with it. Bring both to Brak at the Camp.",
    'Kaelen sold the salt and sent no word with it. Bring it to Brak at the Camp.',
    "The brothers will speak. Brak has their father's whetstone, and it needs oiling.",
    'Brak has the salt and no word from his brother. He says it is fine.',
    'He does not believe it. Name the colour of the Apex floor, or the words he said there.',
    'He believes you. He remembers it anyway, in his shoulders. Let him choose.',
    'Brak stays at the Ring of Wagons. He lives, and you go to the Apex without him.',
    'Brak comes anyway, to see it. If the Tyrant falls, he dies as before.',
    "Brak holds the line at the Nexus instead, with Kaelen's salt, where the Horde is thinner. He lives.",
  ],
  other: [
    "(He would need his brother's salt, and his brother's word)",
    'Ilyra asks you to wait with her in the Shattered Library past the second watch.',
    "Ilyra wants to try the Remnants' seal on the Door of Pages.",
    'Keeper Dray wants Ilyra to hear from him what tearing a portal costs.',
    'Brak asks you to ride with him across the Steppe to the Ring of Wagons.',
    'Brak needs salt for the camp and will not ask Kaelen for it. Carry it.',
    'Kaelen knows who the salt is for.',
    'Tell Brak how he dies at the Apex, and let him choose.',
  ],
  variants: [
    'You keep looking at my hands. Is something wrong with them? You hummed something just now. Where did you hear that? I have never... I think I have always known it.',
    'Good. When the Remnants trust you as I do, I will show you where the Library is thin. Not before.',
    'Ilyra copies a page by the fire, her lips moving with the lines. She sits as if she had sat at this fire with you before.',
    "There. Under the fire's noise. Someone said a verse here once, and the stones are still saying it back. I know the voice now; I was born with it.",
    "Don't say it back. Say it once and you give it away; that's the oath. Your word now, Wayfinder. Oath-brother's. I'd swear you've given it to me before.",
    "You've got a look I don't like. Who's it for.",
    "My brother sells salt to people who are going to die anyway. Somebody has to. You know his name. Mine, once. Don't use it.",
    "You've got a look like a man who's already bought what he came for. The ledger says you're good for it, and I don't remember writing that.",
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
  const fullRest: Action = { type: 'rest', kind: 'full' };
  const nodesSeen = (events: readonly GameEvent[]): string[] => events.flatMap((e) => (e.t === 'dialogueNode' ? [e.nodeId] : []));
  const scenesOpened = (events: readonly GameEvent[]): string[] => events.flatMap((e) => (e.t === 'dialogueStarted' ? [e.sceneId] : []));
  const xpOf = (events: readonly GameEvent[]): number => events.reduce((t, e) => t + (e.t === 'xpGained' ? e.amount : 0), 0);
  const carries = (s: GameState, itemId: string): number => s.player.inventory.filter((i) => i.itemId === itemId).reduce((t, i) => t + i.qty, 0);
  const loyalty = (s: GameState, id: string): number | undefined => s.companions.recruited[id]?.loyalty;
  /** A recruited companion in the party (or waiting, `active: false`) at `loyalty`. */
  const withCompanion =
    (id: 'ilyra' | 'brak', value = 0, active = true) =>
    (s: GameState): void => {
      const hp = pack.companions[id]?.stats.hp ?? 80;
      s.companions.recruited[id] = { id, recruited: true, loyalty: value, hp, hpMax: hp, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} };
      if (active) s.companions.activeId = id;
    };
  const CRYSTAL_GIVEN = { q_echo_crystal: { status: 'completed', stage: 'given' } } as const;

  test('Ilyra, Loop 2 after the Crystal: her offers open; told here she asks to come; Wary, or after an Exploit, she will not', () => {
    const { s, profile } = at({ locationId: 'loc_whispering_ruins', quests: { ...CRYSTAL_GIVEN, q_lost_scroll: 'descend' } });
    const opened = play(s, [talk('npc_ilyra')], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_ilyra_arc');
    expect(choiceViews(opened.state, pack, profile).map((v) => v.id)).toEqual(['tell', 'voices', 'nothing']);
    const told = play(opened.state, [pick('tell')], { content: pack, profile });
    expect([told.state.flags.flag_ilyra_told, choiceViews(told.state, pack, profile).map((v) => v.id)]).toEqual([true, ['come', 'not_yet']]);
    const joined = play(told.state, [pick('come'), go], { content: pack, profile });
    expect([joined.state.companions.activeId, loyalty(joined.state, 'ilyra'), joined.state.mode]).toEqual(['ilyra', 0, 'explore']);
    expect(joined.events.some((e) => e.t === 'companionRecruited' && e.companionId === 'ilyra')).toBe(true);
    // once she is in the party the hub offers only her quests
    expect(choiceViews(play(joined.state, [talk('npc_ilyra')], { content: pack, profile }).state, pack, profile).map((v) => v.id)).toEqual(['voices', 'nothing']);
    // Wary (DESIGN §12.1 "Remnants ≥ Neutral"), or the Heartstone exploited (STORY §7.1): no "Come with me."
    const wary = at({ locationId: 'loc_whispering_ruins', reputation: { remnants: -10 }, flags: { flag_ilyra_told: true }, quests: { ...CRYSTAL_GIVEN, q_lost_scroll: 'descend' } });
    expect(choiceViews(play(wary.s, [talk('npc_ilyra')], { content: pack, profile: wary.profile }).state, pack, wary.profile).map((v) => v.id)).toEqual(['voices', 'nothing']);
    const exploited = at({ locationId: 'loc_whispering_ruins', flags: { flag_ilyra_told: true, flag_heartstone_exploited: true }, quests: { ...CRYSTAL_GIVEN, q_lost_scroll: 'descend' } });
    expect(choiceViews(play(exploited.s, [talk('npc_ilyra')], { content: pack, profile: exploited.profile }).state, pack, exploited.profile).map((v) => v.id)).toEqual(['voices', 'nothing']);
    // Loop 1: the legacy game, nothing of hers (the scroll offer)
    const one = at({ locationId: 'loc_whispering_ruins', quests: CRYSTAL_GIVEN }, 1);
    expect(play(one.s, [talk('npc_ilyra')], { content: pack, profile: one.profile }).state.dialogue?.sceneId).toBe('scene_ilyra_lost_scroll_offer');
  });

  test('camp conversations (DESIGN §12.7): a full rest with her opens the first, +2; the second needs loyalty 25, the third 50; each once a loop', () => {
    const { s, profile } = at({ locationId: 'loc_whispering_ruins', patch: withCompanion('ilyra', 0) });
    const first = play(s, [fullRest], { content: pack, profile });
    expect([first.state.dialogue?.sceneId, loyalty(first.state, 'ilyra')]).toEqual(['scene_ilyra_camp_1', CAMP_LOYALTY]);
    const heard = play(first.state, [go, pick('what_page'), go, go], { content: pack, profile });
    expect([heard.state.mode, nodesSeen(heard.events)]).toEqual(['explore', ['ninth', 'page', 'keep']]);
    // nothing new at loyalty 2; from 25 the second; from 50 the third; a played scene never again this loop
    expect(play(heard.state, [fullRest], { content: pack, profile }).state.dialogue).toBeNull();
    const second = at({ locationId: 'loc_whispering_ruins', patch: withCompanion('ilyra', 25), flags: { flag_scene_done_scene_ilyra_camp_1: true } });
    expect(play(second.s, [fullRest], { content: pack, profile: second.profile }).state.dialogue?.sceneId).toBe('scene_ilyra_camp_2');
    const third = at({ locationId: 'loc_whispering_ruins', patch: withCompanion('ilyra', 50), flags: { flag_scene_done_scene_ilyra_camp_1: true, flag_scene_done_scene_ilyra_camp_2: true } });
    expect(play(third.s, [fullRest], { content: pack, profile: third.profile }).state.dialogue?.sceneId).toBe('scene_ilyra_camp_3');
    // at 50 with none played, they still come in order
    const fresh = at({ locationId: 'loc_whispering_ruins', patch: withCompanion('ilyra', 50) });
    expect(play(fresh.s, [fullRest], { content: pack, profile: fresh.profile }).state.dialogue?.sceneId).toBe('scene_ilyra_camp_1');
    // Brak's, at the Camp's inn
    const brak = at({ locationId: 'loc_ironclad_camp', gold: 50, patch: withCompanion('brak', 0) });
    const fire = play(brak.s, [fullRest, go, pick('and_me'), go], { content: pack, profile: brak.profile });
    expect([scenesOpened(fire.events), nodesSeen(fire.events), loyalty(fire.state, 'brak')]).toEqual([['scene_brak_camp_1'], ['sharpens', 'steel', 'glow', 'watch'], CAMP_LOYALTY]);
  });

  test('the Voices: the Library past the second watch moves the quest on (verse I); the verse read aloud +3; the watchword ends it with Remnants +5, 150 XP, the Echo; then she comes', () => {
    const night = at({ locationId: 'loc_shattered_library', day: 3, watch: 2, quests: { ...CRYSTAL_GIVEN, q_voices_in_the_stacks: 'second_watch' }, patch: withCompanion('ilyra', 0) });
    const waited = play(night.s, [{ type: 'wait' }], { content: pack, profile: night.profile });
    expect(waited.state.quests.q_voices_in_the_stacks).toMatchObject({ status: 'active', stage: 'ask' });
    expect([waited.state.echoesThisLoop.includes('echo_litany_verse_1'), loyalty(waited.state, 'ilyra')]).toEqual([true, LOYALTY_STAGE]);
    const { s, profile } = at({ locationId: 'loc_whispering_ruins', quests: { ...CRYSTAL_GIVEN, q_voices_in_the_stacks: 'ask' }, patch: withCompanion('ilyra', 0) });
    const opened = play(s, [talk('npc_ilyra')], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_ilyra_voices_ask');
    const heard = play(opened.state, [pick('read_aloud'), go, pick('what_would'), go], { content: pack, profile });
    expect(nodesSeen(heard.events)).toEqual(['verse', 'question', 'answer']);
    expect(heard.state.quests.q_voices_in_the_stacks).toMatchObject({ status: 'completed', stage: 'watchword' });
    expect([heard.state.reputation.remnants, xpOf(heard.events), loyalty(heard.state, 'ilyra')]).toEqual([5, 150, LOYALTY_ALIGNED + LOYALTY_STAGE]);
    expect(heard.state.echoesThisLoop).toContain('echo_ilyra_watchword');
    // "Ilyra recruitable" (STORY §11.4): not yet in the party, the Voices done, she asks to come
    const after = at({ locationId: 'loc_whispering_ruins', quests: { ...CRYSTAL_GIVEN, q_lost_scroll: 'descend', q_voices_in_the_stacks: { status: 'completed', stage: 'watchword' } } });
    expect(choiceViews(play(after.s, [talk('npc_ilyra')], { content: pack, profile: after.profile }).state, pack, after.profile).map((v) => v.id)).toEqual(['come', 'nothing']);
  });

  test("the First Drowned: the carrel opens the scene on arrival with Ilyra in the party (not without); Listen gives verse I; the ring taken pays Remnants +10, Oriel's Ring, the scroll if open, 250 XP", () => {
    const base = { locationId: 'loc_drowned_stair', items: ['item_glyphbound_lantern'], quests: { ...CRYSTAL_GIVEN, q_lost_scroll: 'recover', q_the_danthe_line: 'carrel' } } as const;
    const alone = at({ ...base, patch: withCompanion('ilyra', 30, false) });
    const noScene = play(alone.s, [{ type: 'move', to: 'loc_sunken_archives' }], { content: pack, profile: alone.profile });
    expect(scenesOpened(noScene.events)).toEqual([]);
    const { s, profile } = at({ ...base, patch: withCompanion('ilyra', 30) });
    const arrived = play(s, [{ type: 'move', to: 'loc_sunken_archives' }], { content: pack, profile });
    expect([arrived.state.dialogue?.sceneId, arrived.state.mode]).toEqual(['scene_the_first_drowned', 'dialogue']);
    const spoke = play(arrived.state, Array<Action>(9).fill(go), { content: pack, profile });
    expect(nodesSeen(spoke.events)).toEqual(['reading', 'seal_up', 'ours', 'lifts', 'voice', 'written', 'nobody', 'scroll', 'ring']);
    expect(spoke.state.quests.q_the_danthe_line).toMatchObject({ status: 'active', stage: 'oriel' });
    expect([spoke.state.echoesThisLoop.includes('echo_oriel_drowned'), carries(spoke.state, 'item_scholars_lost_scroll'), spoke.state.quests.q_lost_scroll?.stage]).toEqual([true, 1, 'deliver']);
    expect(choiceViews(spoke.state, pack, profile).map((v) => v.id)).toEqual(['listen', 'take', 'leave']);
    const listened = play(spoke.state, [pick('listen'), go, go], { content: pack, profile });
    expect([nodesSeen(listened.events), listened.state.echoesThisLoop.includes('echo_litany_verse_1')]).toEqual([['listened', 'verse', 'ring'], true]);
    expect(choiceViews(listened.state, pack, profile).map((v) => v.id)).toEqual(['take', 'leave']);
    const taken = play(listened.state, [pick('take'), go], { content: pack, profile });
    expect(taken.state.quests.q_the_danthe_line).toMatchObject({ status: 'completed', stage: 'taken' });
    expect([taken.state.reputation.remnants, carries(taken.state, 'item_oriels_ring'), xpOf(taken.events), taken.state.mode]).toEqual([10, 1, 250, 'explore']);
    expect(loyalty(taken.state, 'ilyra')).toBe(30 + 2 * LOYALTY_STAGE); // the `carrel` and `oriel` stages passed
    // left: Remnants −5, no ring
    const left = play(spoke.state, [pick('leave'), go], { content: pack, profile });
    expect(left.state.quests.q_the_danthe_line).toMatchObject({ status: 'completed', stage: 'left' });
    expect([left.state.reputation.remnants, carries(left.state, 'item_oriels_ring')]).toEqual([-5, 0]);
    // the Archivist's fight is optional from now on (the carrel's Echo)
    expect(pack.locations['loc_sunken_archives']?.encounters.find((e) => e.id === 'enc_archives_archivist')?.optionalWhen).toEqual({ echo: 'echo_oriel_drowned' });
  });

  test("the Keeper's table: the telling (the cost) and her choice; the Keeper at Trusted pays +15, the Echo, 400 XP; never again closes the tear for the loop; the tear opens the Library", () => {
    const base = { locationId: 'loc_shattered_library', quests: { ...CRYSTAL_GIVEN, q_keepers_ledger: { status: 'completed', stage: 'whole' } }, patch: withCompanion('ilyra', 50) } as const;
    const { s, profile } = at({ ...base, reputation: { remnants: 20 } });
    const opened = play(s, [talk('npc_ansel_dray'), go], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_dray_keepers_price');
    const told = play(opened.state, [pick('yes'), go, go, go], { content: pack, profile });
    expect(nodesSeen(told.events)).toEqual(['years', 'keeper_way', 'ilyra', 'choose']);
    expect([told.state.quests.q_the_keepers_price?.stage, told.state.echoesThisLoop.includes('echo_ilyra_cost')]).toEqual(['choose', true]);
    const keeper = play(told.state, [pick('keeper'), go, go], { content: pack, profile });
    expect(keeper.state.quests.q_the_keepers_price).toMatchObject({ status: 'completed', stage: 'keeper' });
    expect([keeper.state.reputation.remnants, xpOf(keeper.events), loyalty(keeper.state, 'ilyra')]).toEqual([35, 400, 50 + 3 * LOYALTY_STAGE]);
    expect(keeper.state.echoesThisLoop).toContain('echo_portal_tear');
    expect(nodesSeen(keeper.events)).toEqual(['remembers', 'thin']);
    // the tear, from the hub: the Library portal opens on purpose
    const home = at({ locationId: 'loc_whispering_ruins', reputation: { remnants: 35 }, echoes: ['echo_portal_tear'], quests: { ...CRYSTAL_GIVEN, q_lost_scroll: 'descend', q_the_keepers_price: { status: 'completed', stage: 'keeper' } }, patch: withCompanion('ilyra', 65) });
    const tear = play(home.s, [talk('npc_ilyra'), pick('tear'), pick('open'), go], { content: pack, profile: home.profile });
    expect([tear.state.flags.flag_library_portal_open, tear.state.mode]).toEqual([true, 'explore']);
    const library = at({ locationId: 'loc_shattered_library', flags: { flag_library_portal_open: true } });
    expect(legalActions(library.s, pack, library.profile).some((a) => a.type === 'enterPortal')).toBe(true);
    expect(choiceViews(play(tear.state, [talk('npc_ilyra')], { content: pack, profile: home.profile }).state, pack, home.profile).map((v) => v.id)).not.toContain('tear');
    // below Trusted after the +15: no Echo, and Dray says so
    const low = at({ ...base, reputation: { remnants: 0 } });
    const kept = play(low.s, [talk('npc_ansel_dray'), go, pick('yes'), go, go, go, pick('keeper'), go], { content: pack, profile: low.profile });
    expect([kept.state.reputation.remnants, kept.state.echoesThisLoop.includes('echo_portal_tear')]).toEqual([15, false]);
    expect((kept.events.find((e) => e.t === 'dialogueNode' && e.nodeId === 'thin') as { text: string } | undefined)?.text).toContain('Not before.');
    // never again: no Remnants, no Echo; with the Echo from an earlier loop the tear stays closed this loop
    const sworn = at({ ...base, reputation: { remnants: 20 } }, 2, ['echo_portal_tear']);
    const never = play(sworn.s, [talk('npc_ansel_dray'), go, pick('yes'), go, go, go, pick('never'), go, go], { content: pack, profile: sworn.profile });
    expect(never.state.quests.q_the_keepers_price).toMatchObject({ status: 'completed', stage: 'unbound_hand' });
    expect([never.state.reputation.remnants, nodesSeen(never.events).slice(-2)]).toEqual([20, ['sworn', 'unbound']]);
    const oath = at({ locationId: 'loc_whispering_ruins', reputation: { remnants: 35 }, quests: { ...CRYSTAL_GIVEN, q_lost_scroll: 'descend', q_the_keepers_price: { status: 'completed', stage: 'unbound_hand' } }, patch: withCompanion('ilyra', 65) }, 2, ['echo_portal_tear']);
    const hub = play(oath.s, [talk('npc_ilyra')], { content: pack, profile: oath.profile });
    expect(hub.state.dialogue?.sceneId).toBe('scene_ilyra_arc');
    expect(choiceViews(hub.state, pack, oath.profile).map((v) => v.id)).not.toContain('tear');
    // without Ilyra in the party, or below Loyal, Dray has no table for her
    const away = at({ ...base, reputation: { remnants: 20 }, patch: withCompanion('ilyra', 50, false) });
    expect(play(away.s, [talk('npc_ansel_dray')], { content: pack, profile: away.profile }).state.dialogue?.sceneId).not.toBe('scene_dray_keepers_price');
  });

  test('an Exploit of the Heartstone with Ilyra in the party: her line, and she leaves for the loop', () => {
    const { s, profile } = at({ locationId: 'loc_sunken_archives', quests: { ...CRYSTAL_GIVEN, q_echoing_heartbeat: 'descend' }, patch: withCompanion('ilyra', 10) });
    const down = play(s, [{ type: 'move', to: 'loc_heartstone_depths' }], { content: pack, profile });
    expect(down.state.dialogue?.sceneId).toBe('scene_heartstone_choice');
    const wrenched = play(down.state, [pick('exploit'), go, go], { content: pack, profile });
    expect([wrenched.state.flags.flag_heartstone_exploited, wrenched.state.companions.recruited.ilyra, wrenched.state.companions.activeId]).toEqual([true, undefined, null]);
    expect(wrenched.events.some((e) => e.t === 'companionDismissed' && e.companionId === 'ilyra')).toBe(true);
    expect(wrenched.events.some((e) => e.t === 'log' && e.text.startsWith('Ilyra: "No. Not with my hands near it.'))).toBe(true);
    // stabilized: she stays, and says STORY's line
    const soothed = play(down.state, [pick('stabilize'), go, go, go], { content: pack, profile });
    expect([soothed.state.companions.activeId, soothed.events.some((e) => e.t === 'log' && e.text.startsWith("Ilyra: \"It's keeping time"))]).toEqual(['ilyra', true]);
  });

  test('Brak, after the Peaks: "Come with me." in any loop at Ironclad ≥ Neutral; the Peaks-refuser is offered the salt over the Peaks, once; the hub carries the salt after', () => {
    const { s, profile } = at({ locationId: 'loc_ironclad_camp', quests: { q_clear_path: { status: 'completed', stage: 'done' }, q_blighted_outpost: 'golems' } }, 1);
    const opened = play(s, [talk('npc_brak')], { content: pack, profile });
    expect([opened.state.dialogue?.sceneId, choiceViews(opened.state, pack, profile).map((v) => v.id)]).toEqual(['scene_brak_arc', ['come', 'salt', 'nothing']]);
    const joined = play(opened.state, [pick('come'), go, go], { content: pack, profile });
    expect([joined.state.companions.activeId, loyalty(joined.state, 'brak'), nodesSeen(joined.events)]).toEqual(['brak', 0, ['packed', 'front']]);
    const wary = at({ locationId: 'loc_ironclad_camp', reputation: { ironclad: -10 }, quests: { q_clear_path: { status: 'completed', stage: 'done' }, q_blighted_outpost: 'golems' } }, 1);
    expect(choiceViews(play(wary.s, [talk('npc_brak')], { content: pack, profile: wary.profile }).state, pack, wary.profile).map((v) => v.id)).toEqual(['salt', 'nothing']);
    // the Peaks refused (WORLD §10.8's pacifist): the salt is offered over the Peaks offer; refused once, the Peaks offer is back
    const refuser = at({ locationId: 'loc_ironclad_camp', flags: { flag_scene_done_scene_brak_clear_path_offer: true } }, 1);
    const salt = play(refuser.s, [talk('npc_brak'), go], { content: pack, profile: refuser.profile });
    expect([salt.state.dialogue?.sceneId, choiceViews(salt.state, pack, refuser.profile).map((v) => v.id)]).toEqual(['scene_brak_blood_and_salt_offer', ['yes', 'no']]);
    const carried = play(salt.state, [pick('yes'), go], { content: pack, profile: refuser.profile });
    expect(carried.state.quests.q_blood_and_salt).toMatchObject({ status: 'active', stage: 'salt' });
    const declined = play(salt.state, [pick('no'), go, talk('npc_brak')], { content: pack, profile: refuser.profile });
    expect(declined.state.dialogue?.sceneId).toBe('scene_brak_clear_path_offer');
    // a Peaks-taker is never offered it that way: the hub carries it
    const taker = at({ locationId: 'loc_ironclad_camp', flags: { flag_scene_done_scene_brak_clear_path_offer: true }, quests: { q_clear_path: 'hunt' } }, 1);
    expect(play(taker.s, [talk('npc_brak')], { content: pack, profile: taker.profile }).state.dialogue?.sceneId).toBe('scene_brak_arc');
  });

  test("Kaelen: with the dropped name his door opens the quest at his counter (the shortcut) and the brothers speak; without it four gold and no messages; Brak's report pays", () => {
    const named = at({ locationId: 'loc_wayfarers_respite' }, 2, ['echo_brak_birth_name']);
    const opened = play(named.s, [talk('npc_kaelen_stonehand'), go, go], { content: pack, profile: named.profile });
    expect([opened.state.dialogue?.sceneId, nodesSeen(opened.events)]).toEqual(['scene_kaelen_blood_and_salt_offer', ['nearly', 'name', 'ask']]);
    const started = play(opened.state, [pick('salt'), go], { content: pack, profile: named.profile });
    expect(started.state.quests.q_blood_and_salt).toMatchObject({ status: 'active', stage: 'kaelen' });
    const spoke = play(started.state, [talk('npc_kaelen_stonehand'), go, pick('brother'), go, go, pick('said_it'), go, go], { content: pack, profile: named.profile });
    expect(nodesSeen(spoke.events)).toEqual(['greeting', 'sack', 'dont_have', 'hands', 'coat', 'did_he', 'free']);
    expect((spoke.events.find((e) => e.t === 'dialogueNode' && e.nodeId === 'sack') as { text: string } | undefined)?.text).toBe("You've got a look I don't like. Who's it for.");
    expect(spoke.state.quests.q_blood_and_salt).toMatchObject({ status: 'active', stage: 'to_brak_spoke' });
    expect([carries(spoke.state, SALT), carries(spoke.state, 'item_fathers_whetstone')]).toEqual([1, 1]);
    const spokeAtCamp = at({ locationId: 'loc_ironclad_camp', items: [SALT, 'item_fathers_whetstone'], quests: { q_blood_and_salt: 'to_brak_spoke' }, patch: withCompanion('brak', 0) });
    const done = play(spokeAtCamp.s, [talk('npc_brak'), go, go, go], { content: pack, profile: spokeAtCamp.profile });
    expect(nodesSeen(done.events)).toEqual(['stone', 'fathers', 'market']);
    expect(done.state.quests.q_blood_and_salt).toMatchObject({ status: 'completed', stage: 'spoke' });
    expect([done.state.reputation.ironclad, carries(done.state, SALT), carries(done.state, 'item_fathers_whetstone'), xpOf(done.events)]).toEqual([10, 0, 0, 250]);
    expect([done.state.echoesThisLoop.includes('echo_kaelen_ledger'), loyalty(done.state, 'brak')]).toEqual([true, LOYALTY_STAGE]);
    // without the name: the salt in hand, "I only carry the salt."; Brak says it is fine
    const plain = at({ locationId: 'loc_wayfarers_respite', items: [SALT], quests: { q_blood_and_salt: 'kaelen' }, patch: withCompanion('brak', 0) });
    const asked = play(plain.s, [talk('npc_kaelen_stonehand'), go, pick('brother'), go, go], { content: pack, profile: plain.profile });
    expect(choiceViews(asked.state, pack, plain.profile).map((v) => [v.id, v.enabled])).toEqual([['said_it', false], ['only_salt', true]]);
    const refused = play(asked.state, [pick('only_salt'), go], { content: pack, profile: plain.profile });
    expect([refused.state.quests.q_blood_and_salt?.stage, nodesSeen(refused.events), loyalty(refused.state, 'brak')]).toEqual(['to_brak_refused', ['four_gold'], LOYALTY_ALIGNED + LOYALTY_STAGE]);
    const fine = at({ locationId: 'loc_ironclad_camp', items: [SALT], quests: { q_blood_and_salt: 'to_brak_refused' }, patch: withCompanion('brak', 0) });
    const said = play(fine.s, [talk('npc_brak'), go, go], { content: pack, profile: fine.profile });
    expect([nodesSeen(said.events), said.state.quests.q_blood_and_salt?.stage, said.state.reputation.ironclad, carries(said.state, SALT)]).toEqual([['sack', 'fine', 'not'], 'fine', 0, 0]);
    expect(said.state.echoesThisLoop).toContain('echo_kaelen_ledger');
  });

  test('the Oath: accepting recruits him and places the two ambushes; at the Ring with him, Hadda names him, the name once, the word; the whistle, Ironclad +5, the caravan', () => {
    const { s, profile } = at({ locationId: 'loc_ironclad_camp', quests: { q_clear_path: { status: 'completed', stage: 'done' }, q_blighted_outpost: { status: 'completed', stage: 'done' }, q_blood_and_salt: 'salt' } });
    const opened = play(s, [talk('npc_brak')], { content: pack, profile });
    expect(choiceViews(opened.state, pack, profile).map((v) => v.id)).toEqual(['come', 'ring', 'nothing']);
    const rode = play(opened.state, [pick('ring'), go, pick('yes'), go], { content: pack, profile });
    expect([rode.state.quests.q_the_scouts_oath?.stage, rode.state.companions.activeId, loyalty(rode.state, 'brak')]).toEqual(['ride', 'brak', 0]);
    expect(Object.fromEntries(Object.entries(rode.state.world.pendingEncounters).map(([k, v]) => [k, v.map((sp) => sp.groups)]))).toEqual({
      loc_scorched_gate: [[{ creatureId: 'cr_salt_jackal', count: 1 }]],
      loc_ash_wind_flats: [[{ creatureId: 'cr_steppe_harrier', count: 1 }]],
    });
    const ring = at({ locationId: 'loc_hearthring', quests: { q_blighted_outpost: { status: 'completed', stage: 'done' }, q_the_scouts_oath: 'oath' }, patch: withCompanion('brak', 15) });
    const named = play(ring.s, [talk('npc_hadda_ironvow'), go, go, go, go, pick('word'), go], { content: pack, profile: ring.profile });
    expect([named.state.dialogue?.sceneId, nodesSeen(named.events)]).toEqual([undefined, ['names', 'report', 'night', 'name', 'word', 'kept']]);
    expect(named.state.quests.q_the_scouts_oath).toMatchObject({ status: 'completed', stage: 'named' });
    expect([named.state.reputation.ironclad, carries(named.state, 'item_scouts_whistle'), named.state.flags.flag_hearthring_caravan, xpOf(named.events)]).toEqual([5, 1, true, 150]);
    expect([named.state.echoesThisLoop.includes('echo_brak_birth_name'), loyalty(named.state, 'brak')]).toEqual([true, 15 + LOYALTY_ALIGNED + LOYALTY_STAGE]);
    // with the oath-brother's word remembered (echo_ironclad_oath), his ask says so; without him at the fire, Hadda has no scene of hers for it
    const sworn = at({ locationId: 'loc_hearthring', quests: { q_the_scouts_oath: 'oath' }, patch: withCompanion('brak', 0) }, 3, ['echo_ironclad_oath']);
    const asked = play(sworn.s, [talk('npc_hadda_ironvow'), go, go, go, go], { content: pack, profile: sworn.profile });
    expect((asked.events.find((e) => e.t === 'dialogueNode' && e.nodeId === 'word') as { text: string } | undefined)?.text.endsWith("I'd swear you've given it to me before.")).toBe(true);
    const away = at({ locationId: 'loc_hearthring', quests: { q_the_scouts_oath: 'oath' }, patch: withCompanion('brak', 0, false) });
    expect(play(away.s, [talk('npc_hadda_ironvow')], { content: pack, profile: away.profile }).state.dialogue?.sceneId).not.toBe('scene_hadda_scouts_oath');
  });

  test('the Line: told (+3), proved, chosen; A keeps him away, pays +10 and sends him from the party; C needs the brothers’ word and pays echo_brak_lives; the Tyrant killed meanwhile fails it', () => {
    const base = { locationId: 'loc_ironclad_camp', quests: { q_clear_path: { status: 'completed', stage: 'done' }, q_blighted_outpost: { status: 'completed', stage: 'done' }, q_the_scouts_oath: { status: 'completed', stage: 'named' } } } as const;
    const { s, profile } = at({ ...base, quests: { ...base.quests, q_blood_and_salt: 'salt' }, patch: withCompanion('brak', 20) }, 2, ['echo_brak_death']);
    const opened = play(s, [talk('npc_brak')], { content: pack, profile });
    expect(choiceViews(opened.state, pack, profile).map((v) => v.id)).toEqual(['apex', 'nothing']);
    const told = play(opened.state, [pick('apex'), pick('tell'), go, go], { content: pack, profile });
    expect([nodesSeen(told.events), told.state.quests.q_the_line_he_holds?.stage, loyalty(told.state, 'brak')]).toEqual([['look', 'no_i_would', 'shoulders', 'prove'], 'proof', 20 + LOYALTY_ALIGNED + LOYALTY_STAGE]);
    const proved = play(told.state, [pick('words'), go], { content: pack, profile });
    expect([nodesSeen(proved.events), proved.state.quests.q_the_line_he_holds?.stage]).toEqual([['believes', 'choose'], 'choose']);
    expect(choiceViews(proved.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['stay', true], ['come_anyway', true], ['nexus', false]]);
    expect(choiceViews(proved.state, pack, profile)[2]?.disabledText).toBe("(He would need his brother's salt, and his brother's word)");
    const stayed = play(proved.state, [pick('stay'), go], { content: pack, profile });
    expect(stayed.state.quests.q_the_line_he_holds).toMatchObject({ status: 'completed', stage: 'kept_away' });
    expect([stayed.state.flags.flag_brak_kept_away, stayed.state.reputation.ironclad, stayed.state.companions.recruited.brak, xpOf(stayed.events)]).toEqual([true, 10, undefined, 400]);
    expect(stayed.events.some((e) => e.t === 'companionDismissed' && e.companionId === 'brak')).toBe(true);
    const came = play(proved.state, [pick('come_anyway'), go], { content: pack, profile });
    expect([came.state.quests.q_the_line_he_holds?.stage, came.state.flags.flag_brak_kept_away, came.state.companions.activeId, loyalty(came.state, 'brak')]).toEqual(['comes_anyway', undefined, 'brak', 20 + LOYALTY_ALIGNED + 3 * LOYALTY_STAGE]);
    // C, with Blood and Salt's A behind you
    const brothers = at({ ...base, quests: { ...base.quests, q_blood_and_salt: { status: 'completed', stage: 'spoke' } }, patch: withCompanion('brak', 20) }, 2, ['echo_brak_death']);
    const nexus = play(brothers.s, [talk('npc_brak'), pick('apex'), pick('tell'), go, go, pick('colour'), go, pick('nexus'), go], { content: pack, profile: brothers.profile });
    expect(nexus.state.quests.q_the_line_he_holds).toMatchObject({ status: 'completed', stage: 'holds_nexus' });
    expect([nexus.state.echoesThisLoop.includes('echo_brak_lives'), nexus.state.companions.activeId, nexus.state.reputation.ironclad]).toEqual([true, 'brak', 10]);
    // the Tyrant falls while the quest still runs: it fails
    const late = at({ ...base, quests: { ...base.quests, q_the_line_he_holds: 'tell' }, flags: { flag_tyrant_dead: true }, patch: withCompanion('brak', 20) }, 2, ['echo_brak_death']);
    expect(play(late.s, [{ type: 'wait' }], { content: pack, profile: late.profile }).state.quests.q_the_line_he_holds?.status).toBe('failed');
  });

  test('déjà vu (STORY §5.2, §6.4): once a loop, after the legacy greeting, under the offers and over the reminders; by loop tier; Borin’s oath once', () => {
    const brak = { locationId: 'loc_ironclad_camp', flags: { flag_scene_done_scene_brak_clear_path_offer: true }, quests: { q_clear_path: 'hunt', q_blood_and_salt: 'salt' } } as const;
    const two = at(brak, 2);
    const fire = play(two.s, [talk('npc_brak'), go, go], { content: pack, profile: two.profile });
    expect([scenesOpened(fire.events), nodesSeen(fire.events), fire.state.mode]).toEqual([['scene_brak_deja_vu'], ['fire', 'ache'], 'explore']);
    expect(play(fire.state, [talk('npc_brak')], { content: pack, profile: two.profile }).state.dialogue?.sceneId).toBe('scene_brak_clear_path_waiting');
    const three = at(brak, 3);
    expect(nodesSeen(play(three.s, [talk('npc_brak')], { content: pack, profile: three.profile }).events)).toEqual(['tier3']);
    const five = at(brak, 5);
    expect(nodesSeen(play(five.s, [talk('npc_brak')], { content: pack, profile: five.profile }).events)).toEqual(['tier5']);
    const one = at(brak, 1);
    expect(play(one.s, [talk('npc_brak')], { content: pack, profile: one.profile }).state.dialogue?.sceneId).toBe('scene_brak_clear_path_waiting');
    // Ilyra, Loop 2 on the Crystal hunt: the hands (with verse I, the hummed line), the dream; Loop 5+ she asks to be told
    const ilyra = { locationId: 'loc_whispering_ruins', flags: { flag_scene_done_scene_first_meeting_ilyra: true }, quests: { q_echo_crystal: 'reach_library' } } as const;
    const hands = at(ilyra, 2, ['echo_litany_verse_1']);
    const heard = play(hands.s, [talk('npc_ilyra'), go, go], { content: pack, profile: hands.profile });
    expect(nodesSeen(heard.events)).toEqual(['hands', 'dream']);
    expect((heard.events.find((e) => e.t === 'dialogueNode' && e.nodeId === 'hands') as { text: string } | undefined)?.text).toContain('You hummed something just now.');
    const late = at(ilyra, 5);
    const toldLate = play(late.s, [talk('npc_ilyra'), pick('tell'), go], { content: pack, profile: late.profile });
    expect([nodesSeen(toldLate.events), toldLate.state.flags.flag_ilyra_told]).toEqual([['tier5', 'held_to_it'], true]);
    // Kaelen, Loop 2 with the ledger remembered (a Wizard: for a Ranger his class quest's offer comes first, U59, as any offer does)
    const kaelen = at({ locationId: 'loc_wayfarers_respite', classId: 'wizard' }, 2, ['echo_kaelen_ledger']);
    const look = play(kaelen.s, [talk('npc_kaelen_stonehand'), go], { content: pack, profile: kaelen.profile });
    expect((look.events.find((e) => e.t === 'dialogueNode' && e.nodeId === 'look') as { text: string } | undefined)?.text).toContain('The ledger says');
    expect(play(look.state, [{ type: 'rest', kind: 'short' }], { content: pack, profile: kaelen.profile }).state.dialogue).toBeNull();
    // Borin: the Outpost done, then a word; the Echo, and never again
    const borin = at({ locationId: 'loc_emberforge', quests: { q_blighted_outpost: { status: 'completed', stage: 'done' } } }, 1);
    const oath = play(borin.s, [talk('npc_borin_stonefist'), go, go], { content: pack, profile: borin.profile });
    expect([scenesOpened(oath.events), oath.state.echoesThisLoop.includes('echo_borin_oath')]).toEqual([['scene_borin_oath'], true]);
    expect(legalActions(oath.state, pack, borin.profile).some((a) => a.type === 'talk' && a.npcId === 'npc_borin_stonefist')).toBe(false);
  });
});
