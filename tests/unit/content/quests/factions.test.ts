// U53: the four faction chain quests and their scenes (src/content/shared/{quests,dialogues}/factions.ts), held to their sources
// read at test time: STORY (§11.1's table, §11.2's stage journals, choices and deltas, §5.2 and §5.6's lines, §11's Loop 1
// refusal, §2.3's eighth verse), DESIGN (§6.2 the chain tiers, §11.3 the chain deltas, §11.5 the cross-faction costs, §10.1 the
// Day of Teeth's clock, §12.5 loyalty, §13.3 ex. 4) and the conventions of the two barrel headers (U52's pattern, D-105). Then
// the scenes are played through the engine on the real pack (makeState + play) for what the numbers do, the Horde-echo's
// waves included.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { dialogues as RAW_SCENES } from '@content/shared/dialogues/factions';
import { FROM_LOOP_2, LOYALTY_AGAINST, LOYALTY_ALIGNED, NOT_IN_HORDE, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { WAVE_INTROS, encounters as RAW_ENCOUNTERS, quests as RAW_QUESTS } from '@content/shared/quests/factions';
import { choiceViews, legalActions, type Action, type GameEvent, type GameState } from '@engine/index';
import { clone } from '@engine/util/clone';
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
const factionScenes = RAW_SCENES.map((s) => scene(s.id));
const factionQuests = RAW_QUESTS.map((q) => quest(q.id));

const QUEST_IDS = ['q_keepers_ledger', 'q_day_of_teeth', 'q_hollow_choir', 'q_unlidded_eye'];
const SCENE_IDS = [
  'scene_dray_keepers_ledger_offer',
  'scene_dray_keepers_ledger_waiting',
  'scene_dray_keepers_ledger_copy',
  'scene_dray_keepers_ledger_after',
  'scene_dray_idle',
  'scene_hadda_day_of_teeth_offer',
  'scene_hadda_day_of_teeth_waiting',
  'scene_hadda_day_of_teeth_return',
  'scene_hadda_day_of_teeth_after',
  'scene_hadda_idle',
  'scene_sethe_hollow_choir_offer',
  'scene_sethe_hollow_choir_rite',
  'scene_sethe_hollow_choir_after',
  'scene_sethe_unlidded_eye_offer',
  'scene_sethe_unlidded_eye_waiting',
  'scene_sethe_unlidded_eye_return',
  'scene_sethe_unlidded_eye_after',
  'scene_sethe_void_resonance',
  'scene_sethe_idle',
];
const WAVES = ['enc_day_of_teeth_wave_1', 'enc_day_of_teeth_wave_2', 'enc_day_of_teeth_wave_3'];

// ---- Reading STORY and DESIGN -------------------------------------------------------------------------------------------------

/** STORY as one line of prose: wrapped lines joined, markdown emphasis dropped. */
const STORY_FLAT = STORY.replace(/\n\s*>?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ');
const inStory = (text: string): boolean => text.split('\n').every((line) => STORY_FLAT.includes(line));
/** STORY §11.2's block for one quest, flattened. */
function storyBlock(questId: string): string {
  const start = STORY.indexOf(`#### \`${questId}\``);
  if (start < 0) throw new Error(`no STORY §11.2 block for ${questId}`);
  const end = STORY.indexOf('\n#### ', start + 10);
  return STORY.slice(start, end < 0 ? undefined : end).replace(/\n\s*/g, ' ').replace(/\*/g, '');
}
/** The faction delta STORY gives right after `label` in a quest block ("Whole: Remnants +25"). */
function storyDelta(questId: string, label: string, faction: 'Remnants' | 'Weavers' | 'Ironclad'): number {
  const block = storyBlock(questId);
  const at = block.indexOf(label);
  if (at < 0) throw new Error(`STORY ${questId}: no "${label}"`);
  const m = new RegExp(`${faction} ([+−-]\\d+)`).exec(block.slice(at, at + 160));
  return Number(need(m?.[1], `${questId} ${label} ${faction}`).replace('−', '-'));
}
/** DESIGN §11.3's table: chain quest → its delta. */
function designChainDeltas(): Map<string, number> {
  const start = DESIGN.indexOf('### 11.3 Rep budget');
  const text = DESIGN.slice(start, DESIGN.indexOf('### 11.4', start));
  return new Map([...text.matchAll(/`(q_[a-z_]+)` \+(\d+)/g)].map((m) => [m[1] as string, Number(m[2])]));
}
const DESIGN_SECTION = (from: string, to: string): string => DESIGN.slice(DESIGN.indexOf(from), DESIGN.indexOf(to));

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

const LEDGER_READ = node('scene_dray_keepers_ledger_offer', 'reads').onEnter;
const WHOLE = choice('scene_dray_keepers_ledger_copy', 'ask', 'whole').effects;
const VERSE_ONE = choice('scene_dray_keepers_ledger_copy', 'ask', 'verse_one').effects;
const TRUTH = choice('scene_hadda_day_of_teeth_return', 'what', 'truth');
const MONSTER = choice('scene_hadda_day_of_teeth_return', 'what', 'monster').effects;
const CORRECT = choice('scene_sethe_hollow_choir_rite', 'heard', 'correct');
const SILENT = choice('scene_sethe_hollow_choir_rite', 'heard', 'silent').effects;
const WARN = choice('scene_sethe_unlidded_eye_return', 'eye', 'warn').effects;
const LOOK = choice('scene_sethe_unlidded_eye_return', 'eye', 'look').effects;
const ASK_NOTE = choice('scene_sethe_void_resonance', 'listen', 'ask_note');

// ---- The quests -----------------------------------------------------------------------------------------------------------------

describe('the four faction chain quests (STORY §11.1–§11.2)', () => {
  const table = STORY.slice(STORY.indexOf('### 11.1 Table'), STORY.indexOf('### 11.2'));
  const row = (id: string): string[] => need(table.split('\n').find((l) => l.startsWith(`| \`${id}\``)), id).split('|').map((c) => c.trim());
  const NPC: Record<string, string> = { 'Keeper Ansel Dray': 'npc_ansel_dray', 'Hadda Ironvow': 'npc_hadda_ironvow', 'Sethe the Unlidded': 'npc_sethe_unlidded', Sethe: 'npc_sethe_unlidded' };

  test('all four are registered as faction quests, in STORY order, with STORY’s names, givers, factions and Loop 2+', () => {
    expect(factionQuests.map((q) => q.id)).toEqual(QUEST_IDS);
    for (const id of QUEST_IDS) {
      const q = quest(id);
      const r = row(id);
      expect([id, q.name, q.category, q.giverNpcId]).toEqual([id, r[2], 'faction', NPC[r[4] as string]]);
      expect([id, r[6]]).toEqual([id, '2+']);
      expect([id, q.factionId, (r[3] ?? '').split(' ')[0]?.toLowerCase()]).toEqual([id, q.factionId, q.factionId]);
    }
    expect(quest('q_keepers_ledger').botHint).toBe('explorer'); // STORY "Bots: X S P"; Pacifist yes
    expect(quest('q_hollow_choir').botHint).toBe('explorer'); // "X S P C"; Pacifist yes
    expect(quest('q_day_of_teeth').botHint).toBe('melee'); // "M C"; Pacifist no
    expect(quest('q_unlidded_eye').botHint).toBe('melee'); // "M C"; Pacifist no
    for (const id of QUEST_IDS) expect([id, row(id)[7]]).toEqual([id, id === 'q_keepers_ledger' || id === 'q_hollow_choir' ? 'yes' : 'no']);
  });

  test('prereqs are STORY §11.2’s: Remnants ≥ 20 and Loop 2+; Ironclad ≥ 20 and Loop 2+; Weavers ≥ −9 and Loop 2+; after the Choir at Weavers ≥ 20', () => {
    expect(quest('q_keepers_ledger').availableWhen).toEqual({ all: [FROM_LOOP_2, { rep: { faction: 'remnants', min: 20 } }] });
    expect(storyBlock('q_keepers_ledger')).toContain('Prereq: Remnants ≥ 20 and `{ loop: { min: 2 } }`');
    expect(quest('q_day_of_teeth').availableWhen).toEqual({ all: [FROM_LOOP_2, { rep: { faction: 'ironclad', min: 20 } }] });
    expect(storyBlock('q_day_of_teeth')).toContain('Prereq: Ironclad ≥ 20, `{ loop: { min: 2 } }`');
    expect(quest('q_hollow_choir').availableWhen).toEqual({ all: [FROM_LOOP_2, { rep: { faction: 'weavers', min: -9 } }] });
    expect(storyBlock('q_hollow_choir')).toContain('Prereq: Weavers ≥ −9; `{ loop: { min: 2 } }`');
    expect(quest('q_unlidded_eye').availableWhen).toEqual({ all: [{ quest: { id: 'q_hollow_choir', status: 'completed' } }, { rep: { faction: 'weavers', min: 20 } }] });
    expect(storyBlock('q_unlidded_eye')).toContain('Giver: Sethe after `q_hollow_choir`. Veil → Nexus. Prereq: Weavers ≥ 20.');
    for (const id of QUEST_IDS) expect([id, quest(id).startWhen]).toEqual([id, undefined]);
  });

  test('the first stage’s journal is STORY’s stage 1 journal, verbatim (tag story); every other journal is written, pinned and ≤ 40 words', () => {
    for (const q of factionQuests) {
      const first = q.stages[0] as Quest['stages'][number];
      expect([q.id, first.tags, inStory(first.journal)]).toEqual([q.id, ['story'], true]);
      expect(storyBlock(q.id)).toContain(`Journal: "${first.journal}"`);
      for (const st of q.stages.slice(1)) expect([q.id, st.id, st.tags, WRITTEN.journals.includes(st.journal)]).toEqual([q.id, st.id, ['written'], true]);
      for (const st of q.stages) expect([q.id, st.id, words(st.journal) <= 40]).toEqual([q.id, st.id, true]);
      expect([q.id, WRITTEN.other.includes(q.description)]).toEqual([q.id, true]);
    }
  });

  test('DESIGN §6.2 tier XP: the faction chain’s second quest pays 250, its third 400', () => {
    expect(DESIGN).toContain('faction chain 150/250/400');
    expect(quest('q_hollow_choir').rewards.xp).toBe(250);
    for (const id of ['q_keepers_ledger', 'q_day_of_teeth', 'q_unlidded_eye']) expect([id, quest(id).rewards.xp]).toEqual([id, 400]);
    for (const q of factionQuests) expect([q.id, q.rewards.gold, q.rewards.resonance]).toEqual([q.id, 0, 0]);
  });

  test('DESIGN §11.5 cross-faction costs ride on every completion: −5 (a chain’s second quest), −8 (its third), to the two other factions', () => {
    expect(DESIGN_SECTION('### 11.5', '### 11.6')).toContain('costs the two other factions −3 (quest 1), −5 (quest 2), −8 (quest 3)');
    const costs = (id: string): Record<string, number> => repOf(quest(id).rewards.rep.map((r) => ({ rep: r })));
    expect(costs('q_keepers_ledger')).toEqual({ weavers: -8, ironclad: -8 });
    expect(costs('q_day_of_teeth')).toEqual({ remnants: -8, weavers: -8 });
    expect(costs('q_hollow_choir')).toEqual({ remnants: -5, ironclad: -5 });
    expect(costs('q_unlidded_eye')).toEqual({ remnants: -8, ironclad: -8 });
  });

  test('STORY’s rewards: the Keeper’s Copy, the Choir Mask and the hand-sign, the Unlidded Eye; Blackreed’s Axe is put in the hand at the Nexus', () => {
    expect(quest('q_keepers_ledger').rewards.items).toEqual([{ itemId: 'item_keepers_copy', count: 1 }]);
    expect(storyBlock('q_keepers_ledger')).toContain("Rewards. Keeper's Copy (quest item: re-read any verse Echo)");
    expect(quest('q_hollow_choir').rewards.items).toEqual([{ itemId: 'item_choir_mask', count: 1 }]);
    expect(quest('q_hollow_choir').rewards.echoes).toEqual(['echo_weaver_sign']);
    expect(storyBlock('q_hollow_choir')).toContain('Consequences. `echo_weaver_sign`');
    expect(quest('q_unlidded_eye').rewards.items).toEqual([{ itemId: 'item_unlidded_eye', count: 1 }]);
    expect(storyBlock('q_unlidded_eye')).toContain('Rewards. Unlidded Eye');
    expect(quest('q_day_of_teeth').rewards.items).toEqual([]);
    expect(stage('q_day_of_teeth', 'recover_axe').onEnter).toEqual([{ giveItem: { item: 'item_blackreeds_axe' } }]);
    expect(storyBlock('q_day_of_teeth')).toContain("Rewards. Blackreed's Axe");
    for (const id of ['q_keepers_ledger', 'q_day_of_teeth', 'q_unlidded_eye']) expect([id, quest(id).rewards.echoes]).toEqual([id, []]);
  });

  test('the stage graphs: a stage a scene ends waits (no required objective, a plain next); every decision ends with the questAdvance into its outcome', () => {
    const waits: [string, string][] = [['q_keepers_ledger', 'hear_ledger'], ['q_keepers_ledger', 'choose_copy'], ['q_day_of_teeth', 'return'], ['q_hollow_choir', 'torn_thing'], ['q_hollow_choir', 'offered'], ['q_unlidded_eye', 'return']];
    for (const [questId, stageId] of waits) {
      const st = stage(questId, stageId);
      expect([questId, stageId, st.objectives.filter((o) => !o.optional).length, typeof st.next, st.advanceWhen]).toEqual([questId, stageId, 0, 'string', undefined]);
    }
    const ends: [readonly Effect[], string, string][] = [
      [WHOLE, 'q_keepers_ledger', 'whole'],
      [VERSE_ONE, 'q_keepers_ledger', 'verse_one'],
      [TRUTH.effects, 'q_day_of_teeth', 'told_truth'],
      [MONSTER, 'q_day_of_teeth', 'told_monster'],
      [CORRECT.effects, 'q_hollow_choir', 'corrected'],
      [SILENT, 'q_hollow_choir', 'silent'],
      [WARN, 'q_unlidded_eye', 'warned'],
      [LOOK, 'q_unlidded_eye', 'looked'],
    ];
    for (const [effects, questId, stageId] of ends) {
      expect([questId, stageId, effects.at(-1)]).toEqual([questId, stageId, { questAdvance: { quest: questId, stage: stageId } }]);
      expect([questId, stageId, stage(questId, stageId).outcome]).toEqual([questId, stageId, 'complete']);
    }
    // the passes a scene drives from inside: the Ledger read, the offering
    expect(node('scene_dray_keepers_ledger_offer', 'cistern').onEnter).toEqual([{ questAdvance: { quest: 'q_keepers_ledger', stage: 'recover_day_count' } }]);
    for (const id of ['shard', 'verse']) expect(choice('scene_sethe_hollow_choir_rite', 'offering', id).effects.at(-1)).toEqual({ questAdvance: { quest: 'q_hollow_choir', stage: 'offered' } });
    // objectives: the case, the Nexus, the three Husks, the axe, the Aberration (since the stage began), the Eye
    expect(stage('q_keepers_ledger', 'recover_day_count').objectives.map((o) => o.when)).toEqual([{ item: { id: 'item_pells_day_count' } }]);
    expect(stage('q_day_of_teeth', 'hear_telling').objectives.map((o) => o.when)).toEqual([{ location: 'loc_chronos_nexus' }]);
    expect(stage('q_day_of_teeth', 'horde_echo').objectives.map((o) => o.when)).toEqual([{ killed: { id: 'cr_horde_husk', count: 3, sinceStage: true } }]);
    expect(stage('q_day_of_teeth', 'recover_axe').objectives.map((o) => o.when)).toEqual([{ item: { id: 'item_blackreeds_axe' } }]);
    expect(stage('q_unlidded_eye', 'lens').objectives.map((o) => o.when)).toEqual([{ killed: { id: 'cr_temporal_aberration', count: 1, sinceStage: true } }]);
    expect(stage('q_unlidded_eye', 'take_eye').objectives.map((o) => o.when)).toEqual([{ item: { id: 'item_aberrant_eye' } }]);
    expect(storyBlock('q_day_of_teeth')).toContain('three waves of Unravelled: `cr_horde_husk`');
    expect(storyBlock('q_unlidded_eye')).toContain('Kill a Temporal Aberration at the Nexus and take an Aberrant Eye');
    // no quest opens a scene (the barrel's rule)
    for (const q of factionQuests) expect([q.id, JSON.stringify(q.stages).includes('startDialogue')]).toEqual([q.id, false]);
  });

  test('the Horde-echo: three table encounters of one Husk, story gates that hold, chained by onVictory; the stage starts the first (WORLD §6.8)', () => {
    expect(RAW_ENCOUNTERS.map((e) => e.id)).toEqual(WAVES);
    expect(Object.keys(pack.encounters).slice(0, 3)).toEqual(WAVES); // U57's cairn-ambushes and the Vault's drowned follow
    WAVES.forEach((id, i) => {
      const enc = need(pack.encounters[id], id);
      expect([id, enc.groups, enc.fleeable, enc.onFlee, enc.intro]).toEqual([id, [{ creatureId: 'cr_horde_husk', count: 1 }], false, 'hold', WAVE_INTROS[i]]);
      expect([id, enc.onVictory]).toEqual([id, i < 2 ? [{ startCombat: WAVES[i + 1] }] : []]);
    });
    expect(stage('q_day_of_teeth', 'horde_echo').onEnter).toEqual([{ startCombat: WAVES[0] }]);
    expect(pack.creatures['cr_horde_husk']?.family).toBe('fam_unravelled');
  });

  test('the Unlidded Eye: accepting with the Nexus Aberration already dead this loop places a second one there; the Eye is its quest drop', () => {
    expect(stage('q_unlidded_eye', 'lens').onEnter).toEqual([
      { onlyIf: { when: { killed: { id: 'cr_temporal_aberration' } }, effects: [{ spawn: { creature: 'cr_temporal_aberration', location: 'loc_chronos_nexus' } }] } },
    ]);
    const drop = pack.creatures['cr_temporal_aberration']?.loot.find((l) => l.itemId === 'item_aberrant_eye');
    expect(drop?.when).toEqual({ quest: { id: 'q_unlidded_eye', status: 'active' } });
    expect(pack.locations['loc_chronos_nexus']?.encounters.find((e) => e.id === 'enc_nexus_aberration')?.once).toBe(true);
  });

  test("Pell Ashcombe's Day-Count lies in the Cistern of Names while the quest is active (WORLD §9's placement)", () => {
    expect(pack.locations['loc_cistern_of_names']?.items.find((i) => i.itemId === 'item_pells_day_count')?.when).toEqual({ quest: { id: 'q_keepers_ledger', status: 'active' } });
    expect(pack.items['item_pells_day_count']?.sources).toContain('loc:loc_cistern_of_names');
  });
});

// ---- DESIGN §11.3, §11.5, §10.1 and §12.5 ----------------------------------------------------------------------------------------

describe('reputation (DESIGN §11.3; STORY §11.2), the clock (DESIGN §10.1) and loyalty (DESIGN §12.5) at every faction decision', () => {
  test('each chain delta is DESIGN §11.3’s, on the choice STORY names it for; the lesser choices are STORY’s', () => {
    const chain = designChainDeltas();
    expect(repOf(WHOLE)).toEqual({ remnants: need(chain.get('q_keepers_ledger'), 'ledger') });
    expect(repOf(WHOLE)).toEqual({ remnants: storyDelta('q_keepers_ledger', 'Whole:', 'Remnants') });
    expect(repOf(VERSE_ONE)).toEqual({ remnants: storyDelta('q_keepers_ledger', 'Verse 1 only:', 'Remnants') });
    expect(repOf(TRUTH.effects)).toEqual({ ironclad: need(chain.get('q_day_of_teeth'), 'teeth') });
    expect(repOf(TRUTH.effects)).toEqual({ ironclad: storyDelta('q_day_of_teeth', 'Tell her the truth', 'Ironclad') });
    expect(repOf(MONSTER)).toEqual({ ironclad: storyDelta('q_day_of_teeth', 'Tell her it is a monster:', 'Ironclad') });
    expect(repOf(CORRECT.effects)).toEqual({ weavers: need(chain.get('q_hollow_choir'), 'choir') });
    expect(repOf(CORRECT.effects)).toEqual({ weavers: storyDelta('q_hollow_choir', 'Correct them', 'Weavers') });
    expect(repOf(SILENT)).toEqual({ weavers: storyDelta('q_hollow_choir', 'Say nothing:', 'Weavers') });
    expect(repOf(LOOK)).toEqual({ weavers: need(chain.get('q_unlidded_eye'), 'eye') });
    expect(repOf(LOOK)).toEqual({ weavers: storyDelta('q_unlidded_eye', 'Let Sethe look:', 'Weavers') });
    expect(repOf(WARN)).toEqual({ weavers: storyDelta('q_unlidded_eye', 'Warn Nyx first:', 'Weavers') });
    // nothing else in these scenes moves reputation
    const all = factionScenes.flatMap((s) => s.nodes.flatMap((n) => [...n.onEnter, ...n.choices.flatMap((c) => c.effects)]));
    const counted = [WHOLE, VERSE_ONE, TRUTH.effects, MONSTER, CORRECT.effects, SILENT, WARN, LOOK].flat().filter((e) => 'rep' in e).length;
    expect(all.filter((e) => 'rep' in e).length).toBe(counted);
  });

  test('a monster: Hadda’s scouts thin the hold, Clock −2 days (−8 watches); the truth moves no clock', () => {
    expect(DESIGN_SECTION('### 10.1', '### 10.2')).toContain('| `q_day_of_teeth` (Hadda sends scouts east; STORY) | −2 days |');
    expect(has(MONSTER, { clockWatches: -8 })).toBe(true);
    expect(TRUTH.effects.some((e) => 'clockWatches' in e)).toBe(false);
    expect(storyBlock('q_day_of_teeth')).toContain('she sends scouts east; Clock −2 days');
  });

  test('§12.5: Ilyra against the Litany locked away and with verse one (STORY §7.1); Brak for an Ironclad quest; Nyx for her secret kept, against it told', () => {
    const table = DESIGN_SECTION('### 12.5 Loyalty', '### 12.6');
    expect(table).toContain(`| ${LOYALTY_ALIGNED > 0 ? '+' : ''}${LOYALTY_ALIGNED} |`);
    expect(table).toContain(`| −${-LOYALTY_AGAINST} (`);
    expect(STORY_FLAT).toContain('standing with her against Keeper Dray when he wants the Litany copied and locked away (she wants it used)');
    expect(loyaltyOf(WHOLE)).toEqual({ ilyra: LOYALTY_AGAINST });
    expect(loyaltyOf(VERSE_ONE)).toEqual({ ilyra: LOYALTY_ALIGNED });
    expect(table).toContain('Brak: Ironclad quests');
    expect(loyaltyOf(TRUTH.effects)).toEqual({ brak: LOYALTY_ALIGNED });
    expect(loyaltyOf(MONSTER)).toEqual({ brak: LOYALTY_ALIGNED });
    expect(STORY_FLAT).toContain('not telling the Choir what she is');
    expect(loyaltyOf(WARN)).toEqual({ nyx: LOYALTY_ALIGNED });
    expect(loyaltyOf(LOOK)).toEqual({ nyx: LOYALTY_AGAINST });
    expect(loyaltyOf(CORRECT.effects)).toEqual({});
    expect(loyaltyOf(SILENT)).toEqual({});
  });

  test('the Echoes and the flag: the Ledger read, the Day of Teeth told true, the Choir told, the hand-sign, the Note of Closing; the Remnants hold the Litany', () => {
    expect(LEDGER_READ).toEqual([{ grantEcho: 'echo_seven_wayfinders' }]);
    expect(storyBlock('q_keepers_ledger')).toContain('Hear the Ledger read: seven names, seven years (`echo_seven_wayfinders`)');
    expect(has(WHOLE, { setFlag: 'flag_remnants_hold_litany' }) && !VERSE_ONE.some((e) => 'setFlag' in e)).toBe(true);
    expect(has(TRUTH.effects, { grantEcho: 'echo_day_of_teeth' }) && !MONSTER.some((e) => 'grantEcho' in e)).toBe(true);
    expect(has(LOOK, { grantEcho: 'echo_choir_knows' }) && !WARN.some((e) => 'grantEcho' in e)).toBe(true);
    expect(ASK_NOTE.effects).toEqual([{ grantEcho: 'echo_void_resonance' }]);
    expect(has(WHOLE, { takeItem: { item: 'item_pells_day_count' } }) && has(VERSE_ONE, { takeItem: { item: 'item_pells_day_count' } })).toBe(true);
    expect(has(WARN, { takeItem: { item: 'item_aberrant_eye' } }) && has(LOOK, { takeItem: { item: 'item_aberrant_eye' } })).toBe(true);
    expect(choice('scene_sethe_hollow_choir_rite', 'offering', 'shard').effects[0]).toEqual({ takeItem: { item: 'item_void_shard' } });
    expect(choice('scene_sethe_hollow_choir_rite', 'offering', 'verse').effects.some((e) => 'takeItem' in e)).toBe(false); // "it is not lost"
  });

  test('DESIGN §13.3 ex. 4, exactly: Sethe’s void resonance is a choice `when` at Weavers Trusted, after the Eye, in the Sanctum', () => {
    const ex4 = need(DESIGN.split('\n').find((l) => l.startsWith("4. **Sethe's void resonance**")), 'ex. 4');
    const parse = (src: string): unknown => JSON.parse(src.replace(/([{,]\s*)([a-zA-Z]+):/g, '$1"$2":'));
    const [whenSrc, effectsSrc] = [...ex4.matchAll(/`(\{.*?\}|\[.*?\])`/g)].map((m) => m[1] as string);
    expect(ASK_NOTE.when).toEqual(parse(need(whenSrc, 'ex. 4 when')));
    expect(ASK_NOTE.effects).toEqual(parse(need(effectsSrc, 'ex. 4 effects')));
    // the scene itself closes for good once the Echo is held, in any loop
    expect(scene('scene_sethe_void_resonance').when).toEqual({ all: [NOT_IN_HORDE, ASK_NOTE.when as Condition, { not: { echo: 'echo_void_resonance' } }] });
    expect(scene('scene_sethe_void_resonance').priority).toBe(SCENE_PRIORITY.payoff);
  });
});

// ---- The scenes ------------------------------------------------------------------------------------------------------------------

describe('the scenes (the conventions of src/content/shared/dialogues/index.ts; STORY §5.2, §5.6, §11)', () => {
  test('the listed scenes, all registered, all NPC scenes closed in the Horde, every priority a band', () => {
    expect(factionScenes.map((s) => s.id)).toEqual(SCENE_IDS);
    const bands = Object.values(SCENE_PRIORITY) as number[];
    for (const s of factionScenes) {
      expect([s.id, bands.includes(s.priority), typeof s.npcId]).toEqual([s.id, true, 'string']);
      expect([s.id, JSON.stringify(s.when).startsWith(`{"all":[${JSON.stringify(NOT_IN_HORDE)}`)]).toEqual([s.id, true]);
    }
    const band = (id: string) => scene(id).priority;
    expect(SCENE_IDS.filter((id) => id.endsWith('_offer')).map(band)).toEqual(Array(4).fill(SCENE_PRIORITY.offer));
    expect(SCENE_IDS.filter((id) => id.endsWith('_waiting')).map(band)).toEqual(Array(3).fill(SCENE_PRIORITY.waiting));
    expect(SCENE_IDS.filter((id) => id.endsWith('_after')).map(band)).toEqual(Array(4).fill(SCENE_PRIORITY.after));
    expect(SCENE_IDS.filter((id) => id.endsWith('_idle')).map(band)).toEqual(Array(3).fill(SCENE_PRIORITY.idle));
    for (const id of ['scene_dray_keepers_ledger_copy', 'scene_hadda_day_of_teeth_return', 'scene_sethe_hollow_choir_rite', 'scene_sethe_unlidded_eye_return']) expect([id, band(id)]).toEqual([id, SCENE_PRIORITY.decision]);
  });

  test('the offers read FROM_LOOP_2 and the faction standing, and close once the quest is in the journal', () => {
    expect(scene('scene_dray_keepers_ledger_offer').when).toEqual({ all: [NOT_IN_HORDE, FROM_LOOP_2, { rep: { faction: 'remnants', min: 20 } }, { not: { quest: { id: 'q_keepers_ledger' } } }] });
    expect(scene('scene_hadda_day_of_teeth_offer').when).toEqual({ all: [NOT_IN_HORDE, FROM_LOOP_2, { rep: { faction: 'ironclad', min: 20 } }, { not: { quest: { id: 'q_day_of_teeth' } } }] });
    expect(scene('scene_sethe_hollow_choir_offer').when).toEqual({ all: [NOT_IN_HORDE, FROM_LOOP_2, { rep: { faction: 'weavers', min: -9 } }, { not: { quest: { id: 'q_hollow_choir' } } }] });
    expect(scene('scene_sethe_unlidded_eye_offer').when).toEqual({
      all: [NOT_IN_HORDE, { quest: { id: 'q_hollow_choir', status: 'completed' } }, { rep: { faction: 'weavers', min: 20 } }, { not: { quest: { id: 'q_unlidded_eye' } } }],
    });
    for (const [id, questId] of [['scene_dray_keepers_ledger_offer', 'q_keepers_ledger'], ['scene_hadda_day_of_teeth_offer', 'q_day_of_teeth'], ['scene_sethe_hollow_choir_offer', 'q_hollow_choir'], ['scene_sethe_unlidded_eye_offer', 'q_unlidded_eye']] as const) {
      expect(choice(id, 'ask', 'yes').effects).toEqual([{ questStart: questId }]);
      expect(choice(id, 'ask', 'no').effects).toEqual([]);
    }
  });

  test('every node is tagged by its source: story text is STORY’s, written text is the pinned list (each ≤ 30 words)', () => {
    for (const s of factionScenes) {
      for (const n of s.nodes) {
        const tag = n.tags[0];
        if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else expect([s.id, n.id, tag, WRITTEN.nodes.includes(n.text)]).toEqual([s.id, n.id, 'written', true]);
        // a variant appends STORY's sentence to the line
        for (const v of n.textVariants) {
          expect([s.id, n.id, v.text.startsWith(`${n.text} `)]).toEqual([s.id, n.id, true]);
          expect([s.id, n.id, inStory(v.text.slice(n.text.length + 1))]).toEqual([s.id, n.id, true]);
        }
      }
    }
    const storyNodes = factionScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'story').map((n) => [s.id, n.id]));
    expect(storyNodes).toEqual([
      ['scene_dray_keepers_ledger_copy', 'held_well'],
      ['scene_dray_idle', 'come_back'],
      ['scene_hadda_day_of_teeth_return', 'cut_the_line'],
      ['scene_hadda_idle', 'come_back'],
      ['scene_sethe_idle', 'come_back'],
    ]);
  });

  test('STORY’s lines sit where STORY puts them: Dray’s pattern and notes (§5.2), the ending proposals (§5.6), Ilyra’s approval, the Loop 1 refusal (§11)', () => {
    const read = node('scene_dray_keepers_ledger_offer', 'reads');
    expect(read.textVariants).toEqual([{ when: { echo: 'echo_thirtieth_dawn' }, text: `${read.text} Thirty, every time. And every time, someone like you was taken before it came.` }]);
    expect(STORY_FLAT).toContain('With `echo_thirtieth_dawn` and the Ledger together, the pattern (D-067.11): "Thirty, every time. And every time, someone like you was taken before it came."');
    const kase = node('scene_dray_keepers_ledger_copy', 'case');
    expect(kase.textVariants).toEqual([{ when: { any: [{ echo: 'echo_thirtieth_dawn' }, { echo: 'echo_breach_clock' }] }, text: `${kase.text} He counted thirty. Nobody understood why.` }]);
    expect(STORY_FLAT).toContain('with `echo_thirtieth_dawn` or `echo_breach_clock` he produces Pell Ashcombe\'s notes: "He counted thirty. Nobody understood why."');
    expect(node('scene_dray_keepers_ledger_copy', 'held_well').text).toBe('If the hour must be held, let it be held well. Let someone remember.');
    expect(STORY_FLAT).toContain('E · Long Archive — Keeper Dray: "If the hour must be held, let it be held well. Let someone remember."');
    expect(node('scene_hadda_day_of_teeth_return', 'cut_the_line').text).toBe('Cut the line under it. No ley, no Breach, no Tyrant.');
    expect(STORY_FLAT).toContain('D · Iron Silence — Hadda Ironvow: "Cut the line under it. No ley, no Breach, no Tyrant."');
    expect(scene('scene_dray_keepers_ledger_copy').companionReactions).toEqual([{ companionId: 'ilyra', when: { quest: { id: 'q_keepers_ledger', stage: 'verse_one' } }, text: 'Ilyra: "The ink is not ours to lock away."', loyalty: 0 }]);
    expect(storyBlock('q_keepers_ledger')).toContain('Ilyra approves ("The ink is not ours to lock away")');
    for (const id of ['scene_dray_idle', 'scene_hadda_idle', 'scene_sethe_idle']) {
      expect(node(id, 'come_back').text).toBe("Come back when you've seen more.");
      expect(scene(id).entry).toEqual([{ when: FROM_LOOP_2, node: 'later' }, { when: { all: [] }, node: 'come_back' }]);
    }
    expect(STORY_FLAT).toContain('their givers say "Come back when you\'ve seen more."');
    // the Shards' one note, STORY §11.2's words as her line
    expect(node('scene_sethe_void_resonance', 'one_note').text).toBe('The Shards sing one note; it is the note of the tear closing, not opening.');
    expect(storyBlock('q_unlidded_eye')).toContain('("the Shards sing one note; it is the note of the tear closing, not opening")');
    // the eighth verse sung wrong turns STORY §2.3's last line around
    expect(STORY_FLAT).toContain('There is a dark between one moment and the next. We name it, and so we may enter it. Open, and be entered.');
    expect(node('scene_sethe_hollow_choir_rite', 'verse_wrong').text).toBe('There is a dark between one moment and the next.\nWe name it, and it enters us.\nOpen, and enter.');
    expect(CORRECT.text).toContain('Open, and be entered.');
  });

  test('Echo lines are echoLocked (the Jailer for the truth, verse 8 for the correction); the verse offering is greyed until a verse is held; the Shard offering hides without one', () => {
    expect([TRUTH.echoHint, TRUTH.disabledWhen, TRUTH.when, TRUTH.tags]).toEqual(['echo_tyrant_jailer', { not: { echo: 'echo_tyrant_jailer' } }, FROM_LOOP_2, ['echo']]);
    expect(storyBlock('q_day_of_teeth')).toContain('Tell her the truth (needs `echo_tyrant_jailer`)');
    expect([CORRECT.echoHint, CORRECT.disabledWhen, CORRECT.when, CORRECT.tags]).toEqual(['echo_litany_verse_8', { not: { echo: 'echo_litany_verse_8' } }, FROM_LOOP_2, ['echo']]);
    expect(storyBlock('q_hollow_choir')).toContain('Correct them (needs `echo_litany_verse_8`)');
    const verse = choice('scene_sethe_hollow_choir_rite', 'offering', 'verse');
    expect(verse.disabledWhen).toEqual({ not: { any: Array.from({ length: 9 }, (_, i) => ({ echo: `echo_litany_verse_${i + 1}` })) } });
    expect([verse.when, verse.tags, verse.disabledText]).toEqual([FROM_LOOP_2, ['echo'], '(You hold no verse to offer)']);
    expect(choice('scene_sethe_hollow_choir_rite', 'offering', 'shard').when).toEqual({ item: { id: 'item_void_shard' } });
    expect(storyBlock('q_hollow_choir')).toContain('Offer a Void Shard, or (Loop 2+) Listen with the Amulet and offer an Echo (any `echo_litany_verse_`; it is not lost)'); // STORY_FLAT drops the `*`
  });

  test('choice texts and the other written words are exactly the pinned lists (the lead checks them)', () => {
    const nodes = factionScenes.flatMap((s) => s.nodes.filter((n) => n.tags[0] === 'written').map((n) => n.text));
    const choices = factionScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.map((c) => c.text)));
    const journals = factionQuests.flatMap((q) => q.stages.filter((st) => st.tags?.[0] === 'written').map((st) => st.journal));
    expect([...new Set(nodes)].sort()).toEqual([...WRITTEN.nodes].sort());
    expect([...new Set(choices)].sort()).toEqual([...WRITTEN.choices].sort());
    expect([...new Set(journals)].sort()).toEqual([...WRITTEN.journals].sort());
    const other = [...factionQuests.map((q) => q.description), ...WAVE_INTROS, ...factionScenes.flatMap((s) => s.nodes.flatMap((n) => n.choices.flatMap((c) => (c.disabledText === undefined ? [] : [c.disabledText]))))];
    expect([...new Set(other)].sort()).toEqual([...WRITTEN.other].sort());
    for (const t of [...WRITTEN.nodes, ...WRITTEN.choices, ...WRITTEN.journals, ...WRITTEN.other]) expect([t, words(t) <= 30]).toEqual([t, true]);
    // STORY §15.1's banned words stay out of the new text
    const banned = /\b(fabric of (reality|existence)|eldritch|unspeakable|unimaginable|nightmarish|epic|suddenly|very|literally|ancient|mysterious|ethereal)\b|!|You feel a sense of/i;
    for (const t of [...WRITTEN.nodes, ...WRITTEN.choices, ...WRITTEN.journals, ...WRITTEN.other]) expect([t, banned.test(t)]).toEqual([t, false]);
  });
});

/** Every word U53 wrote (the reply lists them). */
const WRITTEN = {
  nodes: [
    // Dray
    'The Ledger of Wayfinders. Seven entries, Year 44 to Year 430. The eighth line is ruled and empty, and I would rather write it before it is needed than after.',
    'Help me fill it. Hear the seven read, and fetch me the one count that was never entered. Will you?',
    'Sael Orrin, 44. Hesper Vayle, 110. Corwen Blackreed, 178. Ysolde Marr, 243. Pell Ashcombe, 309. Rook Tallis, 371. Dask, 430. Every one at the Apex, or near enough.',
    'Ashcombe counted the days, and his count went down with the divers. The Cistern of Names, under the Reach. Bring me the case.',
    'Then the line stays empty. It has waited seventy years. It can wait for you.',
    "The Cistern is south of the Drowned Stair, past the ninth lamp. Take Ilyra's lantern from the Archives; the dark there is not ordinary.",
    "Thirty strokes in a waterproof case. Ashcombe's hand; I know it from his notes.",
    'Now the Ledger asks a copy of you. What you carry of the Litany, every verse of it, entered and kept dry. Or the first verse alone.',
    'Entered. Year 500, the eighth hand. Now hear what I would do with it.',
    "One verse. Ilyra's argument, in your mouth. So be it; the Archive has kept less and lasted.",
    'The eighth line is written in pencil. I will ink it when I know how it ends.',
    "Seven names in this book, and none of them knew me. Earn the Remnants' trust, Wayfinder, and I will read them to you.",
    // Hadda
    'Year 178. Corwen Blackreed went east with twenty of us and put an axe in the thing at the Apex. For one day the Nexus was teeth.',
    'Twenty held it with steel. Corwen died in what he let out, and his axe is still there. Steel remembers what the hand forgets.',
    "Bring me Blackreed's axe. Go through what is left of that day to get it. Will you?",
    'The Nexus. East past the Glowlands, where the dome broke. Sing louder than it.',
    'Then sit by the fire with the children. The axe has waited; so can I.',
    'The Nexus, Wayfinder. Twenty went. Come back with the axe or do not come back.',
    "Blackreed's axe. The notches are a count; he cut one for each of ours it took. Keep it. It has a day left in it.",
    'Now tell me, you who have stood in front of it. What is the thing at the Apex?',
    'A man in a door. Then Corwen put his axe in the door, and the door let go for a day.',
    'I will keep my people off the Apex road. Give me a line to hold instead, and I will tell you where I would cut.',
    'Then it dies properly. My scouts ride east tonight to find how it bleeds.',
    'Far to the east, the hold thins where the scouts cut at it. Two dawns come off the count.',
    'The axe sits well on you. My riders stay west of the Glowlands; that was the bargain.',
    'My scouts are east. If they find where it bleeds, you will hear the horns.',
    'The fire does not know you yet. Carry iron for us before you ask it anything.',
    // Sethe
    'You came down the stair and you are still whole. The Choir sings for the torn. Bring one thing torn from a moment and you may hear it.',
    'A Shard, torn from the night it fell out of. Or a memory the Amulet tore loose. Bring it torn, or do not bring it. Will you?',
    'The Shards are in the Hollow, in the things that feed there. The verses are in you, if you have listened. Come back torn.',
    'Then stay whole. Stay whole and stay deaf.',
    'Show me what you tore.',
    'A second of the last night, still bleeding. Yes. Sit in the web. Sit, and hear it.',
    'You hum it and the threads hum back. A verse, torn loose and kept. Keep it; the Choir only needs to hear it. Sit.',
    'Nine Weavers take up the thread, and the hall sings the eighth verse.',
    'There is a dark between one moment and the next.\nWe name it, and it enters us.\nOpen, and enter.',
    'That is the verse. Four hundred years we have sung it. You hear it, you hear it. Say what you hear.',
    'Backwards. Four hundred years, backwards. Who sang you the right way round? Not us.',
    'Not us, and not Nyx. Nyx has heard us sing it every night for thirty years and said nothing. Said nothing.',
    'You hear it. You hear it and you keep it. Then you are a little ours.',
    'The hand-sign. Two fingers across the mouth, the way the mask has none. The curtain knows it; now it knows you.',
    'The mask has no mouth. Wear it, wear it, and the Choir will sing through it.',
    'Nyx looks at the seam between one moment and the next. I cut my lids away to look where she looks, and still I see less than she does.',
    "Masque's wardens at the Nexus look between moments. Bring me the eye of one, and I will see what she sees. Will you?",
    'The Nexus. The wardens keep broken hours there, and one of them is looking at you already.',
    'Then I will keep looking with these. Keep looking, keep looking.',
    'The Nexus, under the broken dome. Kill a warden and take its eye while it is still looking.',
    'Still looking. Still looking at the second it died in. Hold it up; Nyx is in the web tonight, and I will look where she looks.',
    'You find Nyx first. She listens, and does not thank you, and is gone from the Sanctum for a day.',
    'There. There, on her, a seam. She is stitched to the night it opened. She was there, and she sings our verse wrong on purpose.',
    'The eye goes in silver, and the silver goes to you. It will not close, and after a while neither will you.',
    'Nyx looks at the seam. Now I look too, and she knows I look.',
    'Nyx came back. She looks at me now the way she looks at the seam.',
    'You hold the Shards the way I do now, close to the ear. Ask me what they sing. Ask.',
    'The Shards sing one note; it is the note of the tear closing, not opening.',
    'The thread does not part for the Wary. Mend what you are to us, and come down the stair again.',
  ],
  choices: [
    'Read them.',
    'Not now.',
    'Copy all of it.',
    'Verse one. The rest stays with me.',
    'I will bring it.',
    'Not yet.',
    'A man. He is holding the Breach shut, and has been since the Sundering.',
    'A monster. It must be killed properly.',
    'No.',
    'Offer a Void Shard.',
    'Listen with the Amulet, and offer a verse.',
    'You have the last line backwards. Open, and be entered.',
    'Say nothing.',
    'Warn Nyx first.',
    'Let Sethe look.',
    'What do the Shards sing?',
    'Later.',
  ],
  journals: [
    "Recover Pell Ashcombe's day-count from the Cistern of Names, under the Drowned Reach.",
    'Bring the day-count to Keeper Dray and choose what the Remnants may copy.',
    'The Remnants hold the whole Litany you carry.',
    'The Remnants copy verse one and no more.',
    'Fight through the Horde-echo of Year 178: three waves of the Unravelled.',
    "Blackreed's axe lies where the day left it. Take it up.",
    'Take the axe back to Hadda at Hearthring. She will ask what the Tyrant is.',
    'You told Hadda the truth. She will keep the Nomads from the Apex.',
    'You told Hadda it is a monster. Her scouts ride east tonight.',
    'The Choir takes up the thread. Hear the eighth verse.',
    'You corrected the Choir. Sethe suspects Nyx.',
    'You let the Choir sing the eighth verse wrong.',
    'Take the Aberrant Eye while it is still looking.',
    'Bring the Eye to Sethe at the Sanctum of Threads. Decide whether Nyx should hear of it first.',
    'You warned Nyx. She left the Sanctum for a day.',
    'Sethe looked through the Eye at Nyx and saw the seam.',
  ],
  other: [
    "Keeper Dray asks you to hear the Ledger read and to fetch Pell Ashcombe's day-count.",
    "Hadda Ironvow asks you to bring Corwen Blackreed's axe back from the Nexus.",
    'Sethe the Unlidded will let you hear the Choir for one thing torn from a moment.',
    'Sethe asks for the eye of a thing that looks between moments.',
    'The hold slips, the way it slipped in Year 178. Something with no next moment comes out of the broken hour.',
    'Another comes out of the day, flickering.',
    "The last of the day's teeth. Behind it, on the floor, iron.",
    '(You hold no verse to offer)',
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

  test('Loop 1: every giver says "Come back when you\'ve seen more."; Loop 2 below the standing: the written line', () => {
    for (const [npcId, locationId] of [['npc_ansel_dray', 'loc_shattered_library'], ['npc_hadda_ironvow', 'loc_hearthring'], ['npc_sethe_unlidded', 'loc_sanctum_of_threads']] as const) {
      const one = at({ locationId }, 1);
      const opened = play(one.s, [talk(npcId)], { content: pack, profile: one.profile });
      expect([npcId, nodesSeen(opened.events)]).toEqual([npcId, ['come_back']]);
      // U57: from Loop 2 Hadda offers the Bone Road at any standing (its offer, and its after line, outrank her idle line)
      const two = at({ locationId, reputation: { weavers: -20 } }, 2);
      expect([npcId, nodesSeen(play(two.s, [talk(npcId)], { content: pack, profile: two.profile }).events)]).toEqual([npcId, [npcId === 'npc_hadda_ironvow' ? 'wind' : 'later']]);
    }
  });

  test('Dray, Loop 2 at Remnants 20: the ask; Yes reads the Ledger (echo_seven_wayfinders) and sends you to the Cistern; with the thirtieth dawn, the pattern and (with the Recoil) the Jailer', () => {
    const { s, profile } = at({ locationId: 'loc_shattered_library', reputation: { remnants: 20 } });
    const opened = play(s, [talk('npc_ansel_dray'), go], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_dray_keepers_ledger_offer');
    expect(choiceViews(opened.state, pack, profile).map((v) => v.id)).toEqual(['yes', 'no']);
    const refused = play(opened.state, [pick('no'), go], { content: pack, profile });
    expect([refused.state.mode, refused.state.quests.q_keepers_ledger]).toEqual(['explore', undefined]);
    const read = play(opened.state, [pick('yes'), go, go], { content: pack, profile });
    expect(read.state.quests.q_keepers_ledger).toMatchObject({ status: 'active', stage: 'recover_day_count' });
    expect(read.state.echoesThisLoop).toContain('echo_seven_wayfinders');
    expect(read.state.echoesThisLoop).not.toContain('echo_tyrant_jailer');
    const plain = read.events.find((e) => e.t === 'dialogueNode' && e.nodeId === 'reads') as { text: string } | undefined;
    expect(plain?.text).toBe(node('scene_dray_keepers_ledger_offer', 'reads').text);
    // the Horde closes him; the waiting line while the case is out
    expect(nodesSeen(play(read.state, [talk('npc_ansel_dray')], { content: pack, profile }).events)).toEqual(['waiting']);
    // Loop 3 with the thirtieth dawn and Nyx's reading behind you: the pattern aloud, and the engine's Jailer (two of five sources)
    const known = at({ locationId: 'loc_shattered_library', reputation: { remnants: 20 } }, 3, ['echo_thirtieth_dawn', 'echo_breach_recoil']);
    const heard = play(known.s, [talk('npc_ansel_dray'), go, pick('yes'), go], { content: pack, profile: known.profile });
    const spoken = heard.events.find((e) => e.t === 'dialogueNode' && e.nodeId === 'reads') as { text: string } | undefined;
    expect(spoken?.text.endsWith('Thirty, every time. And every time, someone like you was taken before it came.')).toBe(true);
    expect(heard.events.some((e) => e.t === 'echoGained' && e.echoId === 'echo_tyrant_jailer')).toBe(true);
  });

  test("the Cistern: Pell Ashcombe's Day-Count lies there while the quest runs, and not otherwise", () => {
    const active = at({ locationId: 'loc_drowned_stair', items: ['item_glyphbound_lantern'], quests: { q_keepers_ledger: 'recover_day_count' } });
    const arrived = play(active.s, [{ type: 'move', to: 'loc_cistern_of_names' }], { content: pack, profile: active.profile });
    const ground = arrived.state.world.locationStates['loc_cistern_of_names']?.items.map((i) => i.itemId) ?? [];
    expect(ground).toContain('item_pells_day_count');
    const idle = at({ locationId: 'loc_drowned_stair', items: ['item_glyphbound_lantern'] });
    const plain = play(idle.s, [{ type: 'move', to: 'loc_cistern_of_names' }], { content: pack, profile: idle.profile });
    expect(plain.state.world.locationStates['loc_cistern_of_names']?.items.map((i) => i.itemId) ?? []).not.toContain('item_pells_day_count');
  });

  test('the copy: the whole Litany pays Remnants +25 and the flag, the Keeper’s Copy, 400 XP, −8 to the other two; verse one pays +10 and no flag; the case is his either way', () => {
    const base = { locationId: 'loc_shattered_library', items: ['item_pells_day_count'], quests: { q_keepers_ledger: 'choose_copy' } } as const;
    const { s, profile } = at(base);
    const opened = play(s, [talk('npc_ansel_dray'), go], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_dray_keepers_ledger_copy');
    const whole = play(opened.state, [pick('whole'), go, go], { content: pack, profile });
    expect(whole.state.quests.q_keepers_ledger).toMatchObject({ status: 'completed', stage: 'whole' });
    expect([whole.state.reputation.remnants, whole.state.reputation.weavers, whole.state.reputation.ironclad]).toEqual([25, -8, -8]);
    expect(whole.state.flags.flag_remnants_hold_litany).toBe(true);
    expect([carries(whole.state, 'item_keepers_copy'), carries(whole.state, 'item_pells_day_count')]).toEqual([1, 0]);
    expect(xpOf(whole.events)).toBe(400);
    expect(nodesSeen(whole.events)).toEqual(['entered', 'held_well']);
    expect(whole.state.mode).toBe('explore');
    expect(nodesSeen(play(whole.state, [talk('npc_ansel_dray')], { content: pack, profile }).events)).toEqual(['pencil']);
    const one = play(opened.state, [pick('verse_one'), go], { content: pack, profile });
    expect(one.state.quests.q_keepers_ledger).toMatchObject({ status: 'completed', stage: 'verse_one' });
    expect([one.state.reputation.remnants, one.state.flags.flag_remnants_hold_litany, carries(one.state, 'item_keepers_copy')]).toEqual([10, undefined, 1]);
    // with the Breach Clock known, he produces the notes
    const clock = at(base, 2, ['echo_breach_clock']);
    const shown = play(clock.s, [talk('npc_ansel_dray')], { content: pack, profile: clock.profile }).events.find((e) => e.t === 'dialogueNode') as { text: string } | undefined;
    expect(shown?.text.endsWith('He counted thirty. Nobody understood why.')).toBe(true);
  });

  test('Hadda: the Telling, Yes starts the quest at the Nexus objective; the waiting line; the return offers the truth greyed without the Jailer', () => {
    // the Bone Road done (U57): its offer would outrank the Telling's waiting line on the next talk
    const { s, profile } = at({ locationId: 'loc_hearthring', reputation: { ironclad: 20 }, quests: { q_bone_road: { stage: 'done', status: 'completed' } } });
    const opened = play(s, [talk('npc_hadda_ironvow'), go, go], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_hadda_day_of_teeth_offer');
    const started = play(opened.state, [pick('yes'), go], { content: pack, profile });
    expect(started.state.quests.q_day_of_teeth).toMatchObject({ status: 'active', stage: 'hear_telling' });
    expect(nodesSeen(play(started.state, [talk('npc_hadda_ironvow')], { content: pack, profile }).events)).toEqual(['waiting']);
    const back = at({ locationId: 'loc_hearthring', items: ['item_blackreeds_axe'], quests: { q_day_of_teeth: 'return' } });
    const asked = play(back.s, [talk('npc_hadda_ironvow'), go], { content: pack, profile: back.profile });
    expect(asked.state.dialogue?.sceneId).toBe('scene_hadda_day_of_teeth_return');
    const views = choiceViews(asked.state, pack, back.profile);
    expect(views.map((v) => [v.id, v.enabled])).toEqual([['truth', false], ['monster', true]]);
    expect(views[0]?.disabledText).toBe('(You do not yet know this)');
  });

  test('a monster: Ironclad +25 (−8 to the others), the clock limit −8 watches, the axe kept, 400 XP; the truth (with the Jailer): +25, echo_day_of_teeth, no clock', () => {
    // the Bone Road done (U57): its offer would outrank the after lines
    const base = { locationId: 'loc_hearthring', items: ['item_blackreeds_axe'], quests: { q_day_of_teeth: 'return', q_bone_road: { stage: 'done', status: 'completed' } } } as const;
    const { s, profile } = at(base);
    const limit = s.clock.limitTicks;
    const monster = play(s, [talk('npc_hadda_ironvow'), go, pick('monster'), go, go], { content: pack, profile });
    expect(monster.state.quests.q_day_of_teeth).toMatchObject({ status: 'completed', stage: 'told_monster' });
    expect([monster.state.reputation.ironclad, monster.state.reputation.remnants, monster.state.reputation.weavers]).toEqual([25, -8, -8]);
    expect(monster.state.clock.limitTicks).toBe(limit - 8);
    expect([carries(monster.state, 'item_blackreeds_axe'), xpOf(monster.events)]).toEqual([1, 400]);
    expect(monster.state.echoesThisLoop).not.toContain('echo_day_of_teeth');
    expect(nodesSeen(play(monster.state, [talk('npc_hadda_ironvow')], { content: pack, profile }).events)).toEqual(['horns']);
    const known = at(base, 2, ['echo_tyrant_jailer']);
    const truth = play(known.s, [talk('npc_hadda_ironvow'), go, pick('truth'), go, go, go], { content: pack, profile: known.profile });
    expect(truth.state.quests.q_day_of_teeth).toMatchObject({ status: 'completed', stage: 'told_truth' });
    expect([truth.state.reputation.ironclad, truth.state.clock.limitTicks]).toEqual([25, limit]);
    expect(truth.state.echoesThisLoop).toContain('echo_day_of_teeth');
    expect(nodesSeen(truth.events).slice(-3)).toEqual(['a_door', 'kept_back', 'cut_the_line']);
    expect(nodesSeen(play(truth.state, [talk('npc_hadda_ironvow')], { content: pack, profile: known.profile }).events)).toEqual(['west']);
  });

  test('the Horde-echo at the Nexus: arriving on the Telling stage starts wave 1; each victory starts the next; three Husks down puts the axe in your hand and the quest at its return', () => {
    const { s, profile } = at({ locationId: 'loc_chronos_nexus', level: 20, quests: { q_day_of_teeth: 'hear_telling' } });
    // the sweep after any step sees the Nexus reached: horde_echo opens and starts the first wave
    const waited = play(s, [{ type: 'wait' }], { content: pack, profile });
    expect(waited.state.quests.q_day_of_teeth?.stage).toBe('horde_echo');
    expect([waited.state.mode, waited.state.combat?.encounterId]).toEqual(['combat', WAVES[0]]);
    expect(waited.state.combat?.enemies.map((e) => e.refId)).toEqual(['cr_horde_husk']);
    // fight: every Husk is brought to its last point of health, then struck until it falls
    const fought: string[] = [];
    let cur = waited.state;
    for (let n = 0; n < 60 && cur.mode === 'combat' && cur.combat !== null; n++) {
      if (fought.at(-1) !== cur.combat.encounterId) fought.push(cur.combat.encounterId);
      const weak = clone(cur);
      for (const e of weak.combat?.enemies ?? []) e.hp = 1;
      const target = weak.combat?.enemies.find((e) => e.alive);
      const legal = legalActions(weak, pack, profile);
      const strike = legal.find((a) => a.type === 'attack' && a.targetUid === target?.uid) ?? legal.find((a) => a.type === 'attack') ?? legal.find((a) => a.type === 'guard');
      cur = play(weak, [need(strike, 'a combat action')], { content: pack, profile }).state;
    }
    expect(fought).toEqual(WAVES);
    expect(cur.mode).toBe('explore');
    expect(cur.counters.kills['cr_horde_husk']).toBe(3);
    expect(cur.quests.q_day_of_teeth).toMatchObject({ status: 'active', stage: 'return' });
    expect(carries(cur, 'item_blackreeds_axe')).toBe(1);
    expect(cur.world.locationStates['loc_chronos_nexus']?.encountersCleared).toEqual(WAVES);
  });

  test('Sethe, the rite: a Shard offered (taken), the Choir sings, the correction greyed without verse 8; nothing said: Weavers +10 (−5 to the others), the mask, the hand-sign, 250 XP', () => {
    const { s, profile } = at({ locationId: 'loc_sanctum_of_threads', items: ['item_void_shard'], quests: { q_hollow_choir: 'torn_thing' } });
    const opened = play(s, [talk('npc_sethe_unlidded')], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_sethe_hollow_choir_rite');
    expect(choiceViews(opened.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['shard', true], ['verse', false], ['not_yet', true]]);
    expect(choiceViews(opened.state, pack, profile)[1]?.disabledText).toBe('(You hold no verse to offer)');
    const sung = play(opened.state, [pick('shard'), go, go, go], { content: pack, profile });
    expect(sung.state.quests.q_hollow_choir?.stage).toBe('offered');
    expect(carries(sung.state, 'item_void_shard')).toBe(0);
    expect(nodesSeen(sung.events)).toEqual(['takes_shard', 'sings', 'verse_wrong', 'heard']);
    expect(choiceViews(sung.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['correct', false], ['silent', true]]);
    const silent = play(sung.state, [pick('silent'), go, go], { content: pack, profile });
    expect(silent.state.quests.q_hollow_choir).toMatchObject({ status: 'completed', stage: 'silent' });
    expect([silent.state.reputation.weavers, silent.state.reputation.remnants, silent.state.reputation.ironclad]).toEqual([10, -5, -5]);
    expect([carries(silent.state, 'item_choir_mask'), xpOf(silent.events)]).toEqual([1, 250]);
    expect(silent.state.echoesThisLoop).toContain('echo_weaver_sign');
    expect(nodesSeen(play(silent.state, [talk('npc_sethe_unlidded')], { content: pack, profile }).events)).toEqual(['mask']);
    // without a Shard, the Shard offering is hidden and "Not yet." leaves the quest where it was
    const empty = at({ locationId: 'loc_sanctum_of_threads', quests: { q_hollow_choir: 'torn_thing' } });
    const none = play(empty.s, [talk('npc_sethe_unlidded')], { content: pack, profile: empty.profile });
    expect(choiceViews(none.state, pack, empty.profile).map((v) => v.id)).toEqual(['verse', 'not_yet']);
    expect(play(none.state, [pick('not_yet')], { content: pack, profile: empty.profile }).state.quests.q_hollow_choir?.stage).toBe('torn_thing');
  });

  test('with verse 8 held: Listen and offer a verse (nothing taken), then correct them: Weavers +15, the correction heard', () => {
    const { s, profile } = at({ locationId: 'loc_sanctum_of_threads', quests: { q_hollow_choir: 'torn_thing' } }, 2, ['echo_litany_verse_8']);
    const opened = play(s, [talk('npc_sethe_unlidded')], { content: pack, profile });
    expect(choiceViews(opened.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['verse', true], ['not_yet', true]]);
    const sung = play(opened.state, [pick('verse'), go, go, go], { content: pack, profile });
    expect(choiceViews(sung.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['correct', true], ['silent', true]]);
    const corrected = play(sung.state, [pick('correct'), go, go, go], { content: pack, profile });
    expect(corrected.state.quests.q_hollow_choir).toMatchObject({ status: 'completed', stage: 'corrected' });
    expect(corrected.state.reputation.weavers).toBe(15);
    expect(nodesSeen(corrected.events)).toEqual(['backwards', 'not_nyx', 'sign']);
    // the Eye is offered now at Trusted (Weavers 20 after the Choir? 15 is not): a Trusted Wayfinder hears the ask
    const trusted = at({ locationId: 'loc_sanctum_of_threads', reputation: { weavers: 20 }, quests: { q_hollow_choir: { status: 'completed', stage: 'corrected' } } });
    expect(play(trusted.s, [talk('npc_sethe_unlidded')], { content: pack, profile: trusted.profile }).state.dialogue?.sceneId).toBe('scene_sethe_unlidded_eye_offer');
    expect(play(corrected.state, [talk('npc_sethe_unlidded')], { content: pack, profile }).state.dialogue?.sceneId).toBe('scene_sethe_hollow_choir_after');
  });

  test('the Eye accepted: with the Nexus Aberration already dead this loop a second one waits there; the waiting line', () => {
    const base = { locationId: 'loc_sanctum_of_threads', reputation: { weavers: 20 }, quests: { q_hollow_choir: { status: 'completed', stage: 'silent' } } } as const;
    const fresh = at(base);
    const started = play(fresh.s, [talk('npc_sethe_unlidded'), go, pick('yes'), go], { content: pack, profile: fresh.profile });
    expect(started.state.quests.q_unlidded_eye).toMatchObject({ status: 'active', stage: 'lens' });
    expect(started.state.world.pendingEncounters['loc_chronos_nexus']).toBeUndefined();
    expect(nodesSeen(play(started.state, [talk('npc_sethe_unlidded')], { content: pack, profile: fresh.profile }).events)).toEqual(['waiting']);
    const killed = at({ ...base, patch: (st) => void (st.counters.kills['cr_temporal_aberration'] = 1) });
    const again = play(killed.s, [talk('npc_sethe_unlidded'), go, pick('yes'), go], { content: pack, profile: killed.profile });
    expect(again.state.world.pendingEncounters['loc_chronos_nexus']?.map((sp) => sp.groups)).toEqual([[{ creatureId: 'cr_temporal_aberration', count: 1 }]]);
  });

  test('the Eye on Nyx: let Sethe look pays Weavers +20 (−8 to the others), echo_choir_knows, the Unlidded Eye, 400 XP; then the Note of Closing on the next talk, once', () => {
    const base = { locationId: 'loc_sanctum_of_threads', reputation: { weavers: 20 }, items: ['item_aberrant_eye'], quests: { q_hollow_choir: { status: 'completed', stage: 'silent' }, q_unlidded_eye: 'return' } } as const;
    const { s, profile } = at(base);
    const opened = play(s, [talk('npc_sethe_unlidded')], { content: pack, profile });
    expect(opened.state.dialogue?.sceneId).toBe('scene_sethe_unlidded_eye_return');
    const looked = play(opened.state, [pick('look'), go, go], { content: pack, profile });
    expect(looked.state.quests.q_unlidded_eye).toMatchObject({ status: 'completed', stage: 'looked' });
    expect([looked.state.reputation.weavers, looked.state.reputation.remnants, looked.state.reputation.ironclad]).toEqual([40, -8, -8]);
    expect(looked.state.echoesThisLoop).toContain('echo_choir_knows');
    expect([carries(looked.state, 'item_unlidded_eye'), carries(looked.state, 'item_aberrant_eye'), xpOf(looked.events)]).toEqual([1, 0, 400]);
    const note = play(looked.state, [talk('npc_sethe_unlidded')], { content: pack, profile });
    expect(note.state.dialogue?.sceneId).toBe('scene_sethe_void_resonance');
    expect(choiceViews(note.state, pack, profile).map((v) => [v.id, v.enabled])).toEqual([['ask_note', true], ['later', true]]);
    const later = play(note.state, [pick('later')], { content: pack, profile });
    expect(later.state.echoesThisLoop).not.toContain('echo_void_resonance');
    const heard = play(later.state, [talk('npc_sethe_unlidded'), pick('ask_note'), go], { content: pack, profile });
    expect(heard.state.echoesThisLoop).toContain('echo_void_resonance');
    expect(heard.state.mode).toBe('explore');
    expect(nodesSeen(play(heard.state, [talk('npc_sethe_unlidded')], { content: pack, profile }).events)).toEqual(['look_too']);
    // warn Nyx first: +10, no Echo of the Choir; the Eye still set in silver
    const other = at(base);
    const warned = play(other.s, [talk('npc_sethe_unlidded'), pick('warn'), go, go], { content: pack, profile: other.profile });
    expect(warned.state.quests.q_unlidded_eye).toMatchObject({ status: 'completed', stage: 'warned' });
    expect([warned.state.reputation.weavers, warned.state.echoesThisLoop.includes('echo_choir_knows'), carries(warned.state, 'item_unlidded_eye')]).toEqual([30, false, 1]);
    expect(nodesSeen(warned.events)).toEqual(['eye', 'gone', 'set_in_silver']);
    // below Trusted the Note is not offered: the after line instead
    const wary = at({ ...base, reputation: { weavers: 0 } });
    const low = play(wary.s, [talk('npc_sethe_unlidded'), pick('warn'), go, go, talk('npc_sethe_unlidded')], { content: pack, profile: wary.profile });
    expect(low.state.dialogue?.sceneId).toBe('scene_sethe_unlidded_eye_after');
  });
});
