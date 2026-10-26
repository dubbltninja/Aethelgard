// U52: the six legacy quests and their scenes (src/content/shared/{quests,dialogues}/legacy.ts), held to their sources read
// at test time: the Python (legacy/echoes_of_aethelgard.py `Quest(…)` constructors and the printed lines of `handle_ilyra`,
// `handle_brak`, `handle_nyx`, `handle_heartstone`, `check_heartstone_unlock`; the NPC greetings in aethelgard_data.py),
// STORY (§11 table and stage wording, §13's new lines, the Litany's verse I), DESIGN (§6.2 quest XP, §11.2 deltas, §12.5
// loyalty, §13.1 rewards, §13.3 ex. 1 and 8) and Appendix A (validator LEGACY_QUESTS). Then the scenes are played through
// the engine on the real pack (makeState + play) for what the numbers do.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { dialogues as RAW_SCENES } from '@content/shared/dialogues/legacy';
import { FROM_LOOP_2, LOYALTY_AGAINST, LOYALTY_ALIGNED, NOT_IN_HORDE, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { quests as RAW_QUESTS } from '@content/shared/quests/legacy';
import { LEGACY_QUESTS } from '@content/validate';
import { choiceViews, derive, legalActions, type Action, type GameState } from '@engine/index';
import type { DialogueScene } from '@schema/dialogue';
import type { Effect } from '@schema/effect';
import type { Quest } from '@schema/quest';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const GAME = read('legacy/echoes_of_aethelgard.py');
const DATA = read('legacy/aethelgard_data.py');
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
/** The file's records as the pack parsed them (defaults applied), in the file's order. */
const legacyScenes = RAW_SCENES.map((s) => scene(s.id));
const legacyQuests = RAW_QUESTS.map((q) => quest(q.id));

const QUEST_IDS = ['q_echo_crystal', 'q_lost_scroll', 'q_clear_path', 'q_blighted_outpost', 'q_void_shards', 'q_echoing_heartbeat'];
const SCENE_IDS = [
  'scene_first_meeting_ilyra',
  'scene_ilyra_echo_crystal_waiting',
  'scene_echo_crystal',
  'scene_ilyra_crystal_deciphered',
  'scene_ilyra_lost_scroll_offer',
  'scene_ilyra_lost_scroll_waiting',
  'scene_ilyra_lost_scroll_return',
  'scene_ilyra_conflux',
  'scene_brak_clear_path_offer',
  'scene_brak_clear_path_waiting',
  'scene_brak_clear_path_report',
  'scene_brak_blighted_outpost_offer',
  'scene_brak_blighted_outpost_waiting',
  'scene_brak_blighted_outpost_report',
  'scene_brak_peaks_quiet',
  'scene_nyx_void_shards_offer',
  'scene_nyx_void_shards_waiting',
  'scene_nyx_void_shards_return',
  'scene_nyx_void_sings',
  'scene_nyx_lost_scroll',
  'scene_heartstone_choice',
  'scene_brak_twenty_dawns',
  'scene_borin_twenty_dawns',
];

// ---- Reading the Python -------------------------------------------------------------------------------------------------------

/** A Python string token: its text (escapes read), whether it is an f-string, and where it sits in the source. */
interface PyString {
  text: string;
  f: boolean;
  start: number;
  end: number;
}

/** The string tokens of a Python source (comments skipped; triple quotes, prefixes and escapes read; raw strings kept raw). */
function pyStrings(src: string): PyString[] {
  const out: PyString[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i] as string;
    if (ch === '#') {
      const eol = src.indexOf('\n', i);
      if (eol < 0) break;
      i = eol;
      continue;
    }
    if (ch !== '"' && ch !== "'") {
      i++;
      continue;
    }
    let p = i;
    while (p > 0 && /[rRbBfFuU]/.test(src[p - 1] as string)) p--;
    const prefix = p > 0 && /[A-Za-z0-9_]/.test(src[p - 1] as string) ? '' : src.slice(p, i);
    const quote = src.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch;
    const raw = /r/i.test(prefix);
    let j = i + quote.length;
    let text = '';
    while (j < src.length && !src.startsWith(quote, j)) {
      if (src[j] === '\\') {
        const next = src[j + 1] ?? '';
        text += raw ? `\\${next}` : next === 'n' ? '\n' : next;
        j += 2;
      } else text += src[j++];
    }
    out.push({ text, f: /f/i.test(prefix), start: i - prefix.length, end: j + quote.length });
    i = j + quote.length;
  }
  return out;
}

/** The literals of a Python source, adjacent ones joined (implicit concatenation); a group holding an f-string is left out. */
function pyLiterals(src: string): string[] {
  const out: string[] = [];
  let group: PyString[] = [];
  const flush = () => {
    if (group.length > 0 && !group.some((t) => t.f)) out.push(group.map((t) => t.text).join(''));
    group = [];
  };
  for (const tok of pyStrings(src)) {
    const last = group.at(-1);
    if (last !== undefined && !/^\s*$/.test(src.slice(last.end, tok.start))) flush();
    group.push(tok);
  }
  flush();
  return out;
}

/** The body of `def name(self…)` in the game file (to the next method). */
function pyMethod(name: string): string {
  const start = GAME.indexOf(`    def ${name}(`);
  if (start < 0) throw new Error(`no method ${name}`);
  const end = GAME.indexOf('\n    def ', start + 10);
  return GAME.slice(start, end < 0 ? undefined : end);
}

/** What a method prints or prompts: the literals inside each print(…) / safe_input(…) call, joined. */
function pyShown(name: string): string[] {
  const body = pyMethod(name);
  const strings = pyStrings(body);
  const inString = (at: number): PyString | undefined => strings.find((t) => at >= t.start && at < t.end);
  const out: string[] = [];
  for (const m of body.matchAll(/\b(print|safe_input)\(/g)) {
    if (inString(m.index ?? 0) !== undefined) continue;
    let depth = 0;
    let i = (m.index ?? 0) + m[0].length - 1;
    const open = i;
    for (; i < body.length; i++) {
      const str = inString(i);
      if (str !== undefined) {
        i = str.end - 1;
        continue;
      }
      if (body[i] === '(') depth++;
      else if (body[i] === ')' && --depth === 0) break;
    }
    const lits = pyLiterals(body.slice(open, i + 1));
    if (lits.length > 0) out.push(lits.join(''));
  }
  return out;
}

/** A shown line as content writes it: no "Name: " prefix, no "(yes/no): " / ": " prompt tail, no "1) " menu number. */
const normal = (line: string): string =>
  line
    .replace(/^(Ilyra|Brak|Nyx|Kaelen): /, '')
    .replace(/\s*\(yes\/no\):\s*$/, '')
    .replace(/^\d\) /, '')
    .trim();

/** Every legacy literal (both files), raw and normalised. */
const LEGACY_TEXT = new Set([...pyLiterals(GAME), ...pyLiterals(DATA)].flatMap((l) => [l, normal(l)]));

/** The NPCs' greetings, aethelgard_data.py LOCATION_DEFS `"dialogue"`. */
function greeting(name: string): string {
  const at = DATA.indexOf(`"name": "${name}"`);
  const block = DATA.slice(at, DATA.indexOf('}', at));
  return need(pyLiterals(block.slice(block.indexOf('"dialogue"') + '"dialogue"'.length))[0], `${name}'s greeting`);
}

// ---- Reading STORY and DESIGN -------------------------------------------------------------------------------------------------

/** STORY as one line of prose: wrapped lines joined, markdown emphasis dropped. */
const STORY_FLAT = STORY.replace(/\n\s*>?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ');
const inStory = (text: string): boolean => text.split('\n').every((line) => STORY_FLAT.includes(line));

/** DESIGN §11.2's table: row label → faction → delta (— = 0, the Unicode minus read). */
function designDeltas(): Map<string, Record<string, number>> {
  const start = DESIGN.indexOf('### 11.2 Exact deltas');
  const text = DESIGN.slice(start, DESIGN.indexOf('### 11.3', start));
  const rows = new Map<string, Record<string, number>>();
  for (const line of text.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Choice') && !l.startsWith('|---'))) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const num = (cell: string): number => (/^[+−-]?\d+/.test(cell) ? Number((/^[+−-]?\d+/.exec(cell) as RegExpExecArray)[0].replace('−', '-')) : 0);
    const deltas: Record<string, number> = {};
    (['remnants', 'weavers', 'ironclad'] as const).forEach((faction, i) => {
      const n = num(cells[i + 1] ?? '');
      if (n !== 0) deltas[faction] = n;
    });
    rows.set(cells[0] ?? '', deltas);
  }
  return rows;
}

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

// ---- Where each decision lives (the effects that DESIGN's rows describe) ------------------------------------------------------

const GIVE = choice('scene_echo_crystal', 'ask', 'give').effects;
const KEEP = choice('scene_echo_crystal', 'ask', 'keep').effects;
const LISTEN = choice('scene_echo_crystal', 'kept_stirs', 'listen').effects;
const SCROLL_TO_ILYRA = node('scene_ilyra_lost_scroll_return', 'thanks').onEnter;
const SCROLL_TO_NYX = choice('scene_nyx_lost_scroll', 'wax', 'read').effects;
const SHARDS_GIVE = choice('scene_nyx_void_shards_return', 'hand', 'yes').effects;
const SHARDS_REFUSE = choice('scene_nyx_void_shards_return', 'hand', 'no').effects;
const STABILIZE = choice('scene_heartstone_choice', 'pulse', 'stabilize').effects;
const EXPLOIT = choice('scene_heartstone_choice', 'pulse', 'exploit').effects;
const DESTROY = choice('scene_heartstone_choice', 'pulse', 'destroy').effects;
const OUTPOST_REPORT = node('scene_brak_blighted_outpost_report', 'plate').onEnter;
const PEAKS_REPORT = node('scene_brak_clear_path_report', 'mail').onEnter;

// ---- The quests -----------------------------------------------------------------------------------------------------------------

describe('the six legacy quests (STORY §11.2–§11.3, Appendix A.5, the Python Quest records)', () => {
  test('all six are registered, legacy, in STORY order, and nothing else is in the file', () => {
    expect(legacyQuests.map((q) => q.id)).toEqual(QUEST_IDS);
    for (const id of QUEST_IDS) expect([id, quest(id).category]).toEqual([id, 'legacy']);
  });

  test("name and legacyId are Appendix A's; the name and the first stage's journal are the Python Quest(…) name and description", () => {
    const records = [...GAME.matchAll(/Quest\(\s*"([a-z_]+)",\s*"([^"]+)",\s*"([^"]+)",/g)].map((m) => ({ legacyId: m[1], name: m[2], description: m[3] }));
    expect(records.map((r) => r.legacyId).sort()).toEqual(Object.values(LEGACY_QUESTS).map((l) => l.legacyId).sort());
    for (const id of QUEST_IDS) {
      const q = quest(id);
      const want = need(LEGACY_QUESTS[id], id);
      const py = need(records.find((r) => r.legacyId === want.legacyId), want.legacyId);
      expect([id, q.name, q.legacyId]).toEqual([id, want.name, want.legacyId]);
      expect([id, q.name, q.stages[0]?.journal, q.stages[0]?.tags]).toEqual([id, py.name, py.description, ['legacy']]);
    }
  });

  test("givers are STORY §11.1's; the heartbeat has none and starts by itself after two completed quests (legacy check_heartstone_unlock)", () => {
    const table = STORY.slice(STORY.indexOf('### 11.1 Table'), STORY.indexOf('### 11.2'));
    const NPC: Record<string, string> = { Ilyra: 'npc_ilyra', Brak: 'npc_brak', Nyx: 'npc_nyx' };
    for (const id of QUEST_IDS) {
      const row = need(table.split('\n').find((l) => l.startsWith(`| \`${id}\``)), id);
      const giver = row.split('|')[4]?.trim() ?? '';
      expect([id, quest(id).giverNpcId]).toEqual([id, NPC[giver]]);
    }
    expect(quest('q_echoing_heartbeat').startWhen).toEqual({ counter: { name: 'quests_completed', min: 2 } });
    expect(GAME).toContain('if self.count_completed_quests() < 2:');
    expect(quest('q_lost_scroll').availableWhen).toEqual({ quest: { id: 'q_echo_crystal', status: 'completed' } });
    expect(quest('q_blighted_outpost').availableWhen).toEqual({ quest: { id: 'q_clear_path', status: 'completed' } });
  });

  test('description: the giver’s legacy offer prompt without its "Accept? (yes/no)" (q_echo_crystal’s prompt is a question: written)', () => {
    for (const id of QUEST_IDS) {
      const d = quest(id).description;
      if (id === 'q_echo_crystal') expect(d).toBe('Ilyra asks you to recover an Echo Crystal.');
      else expect([id, [...LEGACY_TEXT].some((l) => l.startsWith(d))]).toEqual([id, true]);
    }
  });

  test("every stage journal is tagged by its source: legacy lines are the Python's, story lines are STORY's, the rest is the written list", () => {
    for (const q of legacyQuests) {
      for (const st of q.stages) {
        const tag = st.tags?.[0];
        if (tag === 'legacy') expect([q.id, st.id, LEGACY_TEXT.has(st.journal)]).toEqual([q.id, st.id, true]);
        else if (tag === 'story') expect([q.id, st.id, inStory(st.journal.replace(/\.$/, ''))]).toEqual([q.id, st.id, true]);
        else expect([q.id, st.id, WRITTEN.journals.includes(st.journal)]).toEqual([q.id, st.id, true]);
      }
    }
  });

  test('DESIGN §6.2 quest XP: 120 (60 if kept), 150, 120, 220, 260, 400', () => {
    const line = need(DESIGN.split('\n').find((l) => l.includes('Legacy re-rated: `q_echo_crystal`')), '§6.2 row');
    const xp = Object.fromEntries([...line.matchAll(/`(q_[a-z_]+)` (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    for (const id of QUEST_IDS) expect(Object.keys(xp)).toContain(id);
    const extra = (effects: readonly Effect[]): number => effects.reduce((t, e) => t + ('xp' in e ? e.xp : 0), 0);
    expect(quest('q_echo_crystal').rewards.xp + extra(GIVE)).toBe(xp.q_echo_crystal);
    expect(line).toContain('60 if kept');
    expect(quest('q_echo_crystal').rewards.xp + extra(KEEP)).toBe(60);
    for (const id of QUEST_IDS.slice(1)) expect([id, quest(id).rewards.xp]).toEqual([id, xp[id]]);
  });

  test("DESIGN §13.1's rewards: 20 gold on Give (none on Keep: legacy), Mail, Plate and +15 max HP, +1 MAG and a Mana Bloom, the Dagger on Give", () => {
    expect(has(GIVE, { gold: 20 })).toBe(true);
    expect(KEEP.some((e) => 'gold' in e)).toBe(false);
    expect(pyMethod('handle_ilyra')).toContain('self.player.gain_experience(quest.rewards["exp"] // 2)');
    expect(quest('q_clear_path').rewards.items).toEqual([{ itemId: 'item_ironclad_mail', count: 1 }]);
    expect(quest('q_blighted_outpost').rewards.items).toEqual([{ itemId: 'item_ironclad_plate_armor', count: 1 }]);
    expect(has(OUTPOST_REPORT, { statBonus: { stat: 'hpMax', delta: 15 } })).toBe(true);
    expect(has(SCROLL_TO_ILYRA, { statBonus: { stat: 'magic', delta: 1 } }) && has(SCROLL_TO_ILYRA, { giveItem: { item: 'item_mana_bloom' } })).toBe(true);
    expect(has(SHARDS_GIVE, { giveItem: { item: 'item_shadow_kissed_dagger' } })).toBe(true);
    expect(has(DESTROY, { statBonus: { stat: 'hpMax', delta: 20 } })).toBe(true);
    // the legacy numbers these keep
    expect(pyMethod('handle_brak')).toContain('{"exp": 80, "item": "Ironclad Plate Armor", "health": 15}');
    expect(pyMethod('handle_heartstone')).toContain('self.player.max_health += 20');
    expect(pyMethod('handle_ilyra')).toContain('self.player.magic += 1');
  });

  test('Echo shortcuts (D-010, STORY §11.2, DESIGN §13.3 ex. 8): the alcove opens at the Crystal; the warder’s word stills the Golems', () => {
    expect(quest('q_echo_crystal').shortcuts).toEqual([{ echo: 'echo_crystal_location', skipTo: 'take_crystal', text: 'Third alcove, behind the fallen shelf.' }]);
    expect(quest('q_blighted_outpost').shortcuts.map((s) => [s.echo, s.skipTo])).toEqual([['echo_stone_hide_origin', 'speak_warder_word']]);
    const word = need(quest('q_blighted_outpost').stages.find((s) => s.id === 'speak_warder_word'), 'speak_warder_word');
    expect([word.onExit, word.next]).toEqual([[{ setFlag: 'flag_outpost_golems_stilled' }], 'cleared']);
    expect(DESIGN).toContain('`[{ setFlag: "flag_outpost_golems_stilled" }, { questAdvance: { quest: "q_blighted_outpost", stage: "cleared" } }]`');
  });

  test('every decision ends with the questAdvance into its outcome stage; a stage a scene ends waits (no required objective, a plain next)', () => {
    const ends: [readonly Effect[], string, string][] = [
      [GIVE, 'q_echo_crystal', 'given'],
      [KEEP, 'q_echo_crystal', 'kept'],
      [SCROLL_TO_ILYRA, 'q_lost_scroll', 'to_ilyra'],
      [SCROLL_TO_NYX, 'q_lost_scroll', 'to_nyx'],
      [SHARDS_GIVE, 'q_void_shards', 'given'],
      [SHARDS_REFUSE, 'q_void_shards', 'refused'],
      [STABILIZE, 'q_echoing_heartbeat', 'done_stabilize'],
      [EXPLOIT, 'q_echoing_heartbeat', 'done_exploit'],
      [DESTROY, 'q_echoing_heartbeat', 'done_destroy'],
      [PEAKS_REPORT, 'q_clear_path', 'done'],
      [OUTPOST_REPORT, 'q_blighted_outpost', 'done'],
    ];
    for (const [effects, questId, stage] of ends) {
      expect([questId, stage, effects.at(-1)]).toEqual([questId, stage, { questAdvance: { quest: questId, stage } }]);
      const target = need(quest(questId).stages.find((s) => s.id === stage), stage);
      expect([questId, stage, target.outcome]).toEqual([questId, stage, 'complete']);
    }
    for (const [questId, stageId] of [['q_echo_crystal', 'return'], ['q_lost_scroll', 'deliver'], ['q_void_shards', 'return'], ['q_echoing_heartbeat', 'choose'], ['q_clear_path', 'report'], ['q_blighted_outpost', 'cleared']] as const) {
      const st = need(quest(questId).stages.find((s) => s.id === stageId), stageId);
      expect([questId, stageId, st.objectives.filter((o) => !o.optional).length, typeof st.next, st.advanceWhen]).toEqual([questId, stageId, 0, 'string', undefined]);
    }
    // DESIGN §13.3 ex. 1, in its order (then the legacy max HP and heal, loyalty, the Three Beats check)
    const ex1 = need(DESIGN.split('\n').find((l) => l.startsWith('1. **Heartstone Destroy**')), 'ex. 1');
    const listed = JSON.parse(need(/`(\[.*\])`/.exec(ex1)?.[1], 'ex. 1 list').replace(/([{,]\s*)([a-zA-Z]+):/g, '$1"$2":')) as Effect[];
    const shown = DESTROY.filter((e) => listed.some((l) => JSON.stringify(l) === JSON.stringify(e)));
    expect(shown).toEqual(listed);
  });
});

// ---- DESIGN §11.2 and §12.5 ------------------------------------------------------------------------------------------------------

describe('reputation (DESIGN §11.2) and loyalty (DESIGN §12.5) at every legacy decision', () => {
  const rows = designDeltas();
  const row = (label: string): Record<string, number> => need(rows.get(label), label);

  test('each §11.2 row is exactly the rep the decision applies', () => {
    const cases: [string, Record<string, number>][] = [
      ['Heartstone — Stabilize', repOf(STABILIZE)],
      ['Heartstone — Exploit', repOf(EXPLOIT)],
      ['Heartstone — Destroy', repOf(DESTROY)],
      ['Echo Crystal — give', repOf(GIVE)],
      ['Echo Crystal — keep', repOf(KEEP)],
      ['Void Shards — give', repOf(SHARDS_GIVE)],
      ['Void Shards — refuse', repOf(SHARDS_REFUSE)],
      ['`q_lost_scroll` — scroll to Ilyra', repOf(SCROLL_TO_ILYRA)],
      ['`q_lost_scroll` — scroll to Nyx (STORY)', repOf(SCROLL_TO_NYX)],
      ['`q_clear_path` complete', repOf(quest('q_clear_path').rewards.rep.map((r) => ({ rep: r })))],
      ['`q_blighted_outpost` complete', repOf(quest('q_blighted_outpost').rewards.rep.map((r) => ({ rep: r })))],
    ];
    for (const [label, got] of cases) expect([label, got]).toEqual([label, row(label)]);
    // nothing else in the legacy scenes moves reputation, but Ilyra's watchword (STORY §13: Remnants +10)
    const all = legacyScenes.flatMap((s) => s.nodes.flatMap((n) => [...(n.onEnter ?? []), ...(n.choices ?? []).flatMap((c) => c.effects ?? [])]));
    const counted = [STABILIZE, EXPLOIT, DESTROY, GIVE, KEEP, SHARDS_GIVE, SHARDS_REFUSE, SCROLL_TO_ILYRA, SCROLL_TO_NYX].flat().filter((e) => 'rep' in e).length;
    expect(all.filter((e) => 'rep' in e).length).toBe(counted + 1);
    expect(choice('scene_first_meeting_ilyra', 'ask', 'watchword').effects).toEqual([{ rep: { faction: 'remnants', delta: 10 } }]);
    expect(STORY_FLAT).toContain('Ilyra recruitable; Remnants +10.');
  });

  test('§12.5: +3 to the companions whose value the choice is, −10 to those whose value is another option; refusing the shards costs Nyx 15', () => {
    const table = DESIGN.slice(DESIGN.indexOf('### 12.5 Loyalty'), DESIGN.indexOf('### 12.6'));
    expect(table).toContain('| choice aligned with their value (Ilyra: stabilize/give crystal; Brak: Ironclad quests, destroy; Nyx: keep crystal, give shards, exploit;');
    expect(table).toContain(`| ${LOYALTY_ALIGNED > 0 ? '+' : ''}${LOYALTY_ALIGNED} |`);
    expect(table).toContain(`| −${-LOYALTY_AGAINST} (Dask: killing the Tyrant −30; Nyx: refusing shards −15) |`);
    expect(loyaltyOf(GIVE)).toEqual({ ilyra: 3, nyx: -10 });
    expect(loyaltyOf(KEEP)).toEqual({ nyx: 3, ilyra: -10 });
    expect(loyaltyOf(STABILIZE)).toEqual({ ilyra: 3, nyx: -10, brak: -10 });
    expect(loyaltyOf(EXPLOIT)).toEqual({ nyx: 3, ilyra: -10, brak: -10 });
    expect(loyaltyOf(DESTROY)).toEqual({ brak: 3, ilyra: -10, nyx: -10 });
    expect(loyaltyOf(SHARDS_GIVE)).toEqual({ nyx: 3 });
    expect(loyaltyOf(SHARDS_REFUSE)).toEqual({ nyx: -15 });
    expect(loyaltyOf(PEAKS_REPORT)).toEqual({ brak: 3 });
    expect(loyaltyOf(OUTPOST_REPORT)).toEqual({ brak: 3 });
    // STORY §7.1: giving her the scroll is one of Ilyra's loyalty beats; reading it to Nyx is against it
    expect(loyaltyOf(SCROLL_TO_ILYRA)).toEqual({ ilyra: 3 });
    expect(loyaltyOf(SCROLL_TO_NYX)).toEqual({ ilyra: -10 });
    expect(STORY_FLAT).toContain('Loyalty beats. Giving her the Crystal; giving her the scroll;');
  });

  test("D-017's other consequences: the flags others read, the Echoes, the clock (DESIGN §10.1), the items", () => {
    expect(has(GIVE, { setFlag: 'flag_crystal_given' }) && has(KEEP, { setFlag: 'flag_kept_echo_crystal' })).toBe(true);
    expect(LISTEN).toEqual([{ grantEcho: 'echo_litany_verse_1' }, { grantEcho: 'echo_nine_voices' }]);
    expect(has(SHARDS_REFUSE, { setFlag: 'flag_shards_refused' })).toBe(true); // DESIGN §8's void-forged recipes read it
    expect(pack.recipes['recipe_voidforged_edge']?.requires).toBeDefined();
    expect(has(STABILIZE, { clockWatches: 24 }) && has(EXPLOIT, { clockWatches: -20 }) && has(DESTROY, { clockWatches: -40 })).toBe(true);
    expect(has(STABILIZE, { grantEcho: 'echo_heartstone_resonance' }) && has(EXPLOIT, { grantEcho: 'echo_heartstone_hunger' }) && has(DESTROY, { grantEcho: 'echo_heartstone_silence' })).toBe(true);
    expect(has(STABILIZE, { giveItem: { item: 'item_stabilized_heartstone' } }) && has(STABILIZE, { giveItem: { item: 'item_heartstone_fragment_stable', count: 2 } })).toBe(true);
    expect(has(EXPLOIT, { giveItem: { item: 'item_heartstone_core' } })).toBe(true);
    for (const flag of ['flag_heartstone_stabilized', 'flag_heartstone_exploited', 'flag_heartstone_destroyed']) {
      expect([flag, [STABILIZE, EXPLOIT, DESTROY].filter((list) => has(list, { setFlag: flag as `flag_${string}` })).length]).toEqual([flag, 1]);
    }
    // the Three Beats: checked after each of the three is granted
    for (const list of [STABILIZE, EXPLOIT, DESTROY]) {
      const i = list.findIndex((e) => 'onlyIf' in e);
      expect(list[i]).toEqual({
        onlyIf: {
          when: { all: [{ echo: 'echo_heartstone_resonance' }, { echo: 'echo_heartstone_hunger' }, { echo: 'echo_heartstone_silence' }] },
          effects: [{ grantEcho: 'echo_heartstone_triune' }],
        },
      });
      expect(list.findIndex((e) => 'grantEcho' in e)).toBeLessThan(i);
    }
    expect(has(SCROLL_TO_NYX, { grantEcho: 'echo_breach_recoil' }) && has(SCROLL_TO_NYX, { grantEcho: 'echo_litany_verse_8' })).toBe(true);
    expect(has(SCROLL_TO_ILYRA, { grantEcho: 'echo_oriel_lineage' }) && has(SCROLL_TO_ILYRA, { grantEcho: 'echo_archive_door' })).toBe(true);
  });
});

// ---- The scenes ------------------------------------------------------------------------------------------------------------------

describe('the scenes (STORY §13; legacy handle_* lines; the conventions of src/content/shared/dialogues/index.ts)', () => {
  test('the listed scenes, all registered; every NPC scene is closed in the Horde; priorities are the bands', () => {
    expect(legacyScenes.map((s) => s.id)).toEqual(SCENE_IDS);
    const bands = Object.values(SCENE_PRIORITY) as number[];
    for (const s of SCENE_IDS.map(scene)) {
      expect([s.id, bands.includes(s.priority)]).toEqual([s.id, true]);
      if (s.npcId === undefined) continue;
      const when = JSON.stringify(s.when);
      expect([s.id, when.startsWith(`{"all":[${JSON.stringify(NOT_IN_HORDE)}`)]).toEqual([s.id, true]);
    }
    expect(scene('scene_heartstone_choice').npcId).toBeUndefined();
    expect(pack.locations['loc_heartstone_depths']?.events.find((e) => e.id === 'ev_depths_choice')?.effects).toEqual([{ startDialogue: 'scene_heartstone_choice' }]);
  });

  test('STORY §13’s three key scenes keep their ids and titles', () => {
    for (const [id, title] of [
      ['scene_first_meeting_ilyra', 'The whispers are louder'],
      ['scene_echo_crystal', 'The Crystal choice'],
      ['scene_heartstone_choice', 'Soothe, seize, or shatter'],
    ] as const) {
      expect([id, scene(id).title]).toEqual([id, title]);
      expect(STORY).toContain(`#### \`${id}\` — ${title}`);
    }
  });

  test('every node is tagged by its source: legacy text is the Python’s, story text is STORY’s, written text is the pinned list', () => {
    for (const s of legacyScenes) {
      for (const n of s.nodes) {
        const tag = n.tags?.[0];
        if (tag === 'legacy') expect([s.id, n.id, LEGACY_TEXT.has(n.text)]).toEqual([s.id, n.id, true]);
        else if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else expect([s.id, n.id, tag, WRITTEN.nodes.includes(n.text)]).toEqual([s.id, n.id, 'written', true]);
        // a variant appends STORY's sentence to the legacy line
        for (const v of n.textVariants ?? []) {
          expect(v.text.startsWith(`${n.text} `)).toBe(true);
          const added = v.text.slice(n.text.length + 1);
          expect([s.id, n.id, inStory(added) || WRITTEN.variants.includes(added)]).toEqual([s.id, n.id, true]);
        }
      }
    }
  });

  test('choice texts: the legacy menu lines, "Yes."/"No." for a legacy yes/no (DESIGN §13.2), STORY’s lines, or the pinned written ones', () => {
    for (const s of legacyScenes) {
      for (const n of s.nodes) {
        for (const c of n.choices ?? []) {
          const ok = LEGACY_TEXT.has(c.text) || c.text === 'Yes.' || c.text === 'No.' || inStory(`"${c.text}"`) || WRITTEN.choices.includes(c.text);
          expect([s.id, c.id, c.text, ok]).toEqual([s.id, c.id, c.text, true]);
        }
      }
    }
    expect(DESIGN).toContain('Legacy yes/no prompts become two-choice nodes');
  });

  test('companion lines (STORY §13 "[X present]") are reactions in STORY’s words; nothing a companion says is a node yet (D-088)', () => {
    // U54 added Ilyra's leaving line on an Exploit (written; STORY §7.1 "leaves the party for the loop"): its own test holds it
    const reactions = scene('scene_heartstone_choice').companionReactions.filter((r) => !(r.companionId === 'ilyra' && JSON.stringify(r.when) === JSON.stringify({ flag: 'flag_heartstone_exploited' })));
    expect(reactions.map((r) => [r.companionId, r.when])).toEqual([
      ['ilyra', { flag: 'flag_heartstone_stabilized' }],
      ['nyx', { flag: 'flag_heartstone_exploited' }],
      ['brak', { flag: 'flag_heartstone_destroyed' }],
    ]);
    for (const r of reactions) expect(inStory(need(/"(.*)"$/.exec(r.text)?.[1], r.text))).toBe(true);
    for (const s of legacyScenes) for (const n of s.nodes) expect(['ilyra', 'brak', 'nyx', 'dask', 'mireya', 'caelum', 'companion']).not.toContain(n.speaker);
  });

  test('the NPCs’ legacy greetings open their offer scenes (legacy talk_to_npc prints them first)', () => {
    expect(GAME).toContain('print(npc_name(f"{npc.name}: {npc.dialogue}"))');
    const opens: [string, string, string][] = [
      ['scene_first_meeting_ilyra', 'greeting', 'Ilyra'],
      ['scene_ilyra_lost_scroll_offer', 'greeting', 'Ilyra'],
      ['scene_brak_clear_path_offer', 'greeting', 'Brak'],
      ['scene_brak_blighted_outpost_offer', 'greeting', 'Brak'],
      ['scene_nyx_void_shards_offer', 'greeting', 'Nyx'],
    ];
    for (const [sceneId, nodeId, name] of opens) expect([sceneId, node(sceneId, nodeId).text]).toEqual([sceneId, greeting(name)]);
  });

  test('every line the legacy handlers show is in a scene or a quest, except the ones left to other units (each named)', () => {
    const corpus = new Set<string>();
    for (const s of legacyScenes) {
      for (const n of s.nodes) {
        corpus.add(n.text);
        for (const v of n.textVariants ?? []) corpus.add(v.text);
        for (const c of n.choices ?? []) corpus.add(c.text);
      }
    }
    for (const q of legacyQuests) {
      corpus.add(q.description);
      for (const st of q.stages) corpus.add(st.journal);
    }
    const covered = (line: string): boolean => corpus.has(line) || [...corpus].some((c) => c.startsWith(`${line} `));
    const ELSEWHERE: Readonly<Record<string, string>> = {
      'Enter the portal?': 'scene_ilyra_portal (U62)',
      'Choose 1 or 2:': 'a prompt; the choices are the menu lines',
      'Choose 1, 2, or 3 (or press Enter to wait):': 'a prompt; Enter is the written choice "Wait."',
      'Ilyra waits for a clearer answer.': 'no invalid answer exists among choices',
      'The Heartstone': 'the headline: the scene title is STORY’s',
      'A Distant Pulse': 'the headline: the questStarted toast',
    };
    const shown = ['handle_ilyra', 'handle_brak', 'handle_nyx', 'handle_heartstone', 'check_heartstone_unlock'].flatMap(pyShown).map(normal);
    const left = shown.filter((line) => !covered(line) && ELSEWHERE[line] === undefined && !OTHER_UNITS.some((frag) => line.includes(frag)));
    expect(left).toEqual([]);
    expect(shown.length).toBeGreaterThan(40);
  });

  test('Echo lines are echoLocked (from Loop 2, greyed until known, the Echo sigil); Loop 2+ lines read FROM_LOOP_2', () => {
    const locked = [choice('scene_first_meeting_ilyra', 'ask', 'watchword'), choice('scene_first_meeting_ilyra', 'ask', 'third_alcove')];
    expect(locked.map((c) => [c.echoHint, c.disabledWhen, c.when, c.tags])).toEqual([
      ['echo_ilyra_watchword', { not: { echo: 'echo_ilyra_watchword' } }, FROM_LOOP_2, ['echo']],
      ['echo_crystal_location', { not: { echo: 'echo_crystal_location' } }, FROM_LOOP_2, ['echo']],
    ]);
    expect(choice('scene_first_meeting_ilyra', 'ask', 'done_this_before').when).toEqual(FROM_LOOP_2);
    // U62b (STORY §5.1, §12 `echo_amulet_memory`: "Listen action"): the Amulet's Listen, which wakes with you in Loop 2
    expect(choice('scene_echo_crystal', 'kept_stirs', 'listen').when).toEqual({ all: [FROM_LOOP_2, { echo: 'echo_amulet_memory' }] });
    expect(scene('scene_nyx_lost_scroll').when).toEqual({ all: [NOT_IN_HORDE, FROM_LOOP_2, { quest: { id: 'q_lost_scroll', stage: 'deliver' } }, { item: { id: 'item_scholars_lost_scroll' } }] });
  });

  test('the written words are exactly the pinned list (the lead checks them), each short', () => {
    const nodes = legacyScenes.flatMap((s) => s.nodes.filter((n) => n.tags?.[0] === 'written').map((n) => n.text));
    const choices = legacyScenes.flatMap((s) => s.nodes.flatMap((n) => (n.choices ?? []).map((c) => c.text))).filter((t) => WRITTEN.choices.includes(t));
    const journals = legacyQuests.flatMap((q) => q.stages.filter((st) => st.tags?.[0] === 'written').map((st) => st.journal));
    expect([...new Set(nodes)].sort()).toEqual([...WRITTEN.nodes].sort());
    expect([...new Set(choices)].sort()).toEqual([...WRITTEN.choices].sort());
    expect([...new Set(journals)].sort()).toEqual([...WRITTEN.journals].sort());
    for (const t of [...WRITTEN.nodes, ...WRITTEN.choices, ...WRITTEN.journals, ...WRITTEN.other]) expect([t, t.split(/\s+/).length <= 20]).toEqual([t, true]);
    expect(quest('q_blighted_outpost').shortcuts[0]?.text).toBe(WRITTEN.other[0]);
  });
});

/** The legacy handler lines another unit owns (fragments): the portal, the six-Spellbook lore, the Pass's random lines, the toasts. */
const OTHER_UNITS = [
  'Wayfinder! You made it!', // scene_ilyra_portal (U62)
  "I've been studying the fragments of lore", // Ilyra's spellbook lore (the portal scene, her idle talk)
  'The veil between moments feels thinner', // the Shimmering Pass lines, at random (no "visited" condition, no randomness)
  'The air feels wrong in the east',
  'The eastern lands grow... vibrant',
  'Quest accepted:', // the questStarted toast
];

/** Every word U52 wrote (the reply lists them). */
const WRITTEN = {
  nodes: [
    'I listened to it all night. One voice is clearer than the others. She is reading something aloud.',
    'Ilyra sees the Remnant wax on the scroll.',
    "Nyx's eyes go to the Remnant wax on the scroll.",
  ],
  choices: ['Leave it be.', 'Wait.', 'Give her the scroll.', 'Not yet.', 'Read it to her.', 'Not now.', 'Listen.'],
  journals: ["You read Oriel's scroll to Nyx.", "Go to the Blighted Outpost and speak the warder's word.", 'Return to Nyx with the three shards.'],
  other: ["You know the warder's word that stills Vane's golems.", 'Ilyra asks you to recover an Echo Crystal.'],
  // U62 (STORY §12 `echo_crystal_seeded`): appended to the legacy line, as STORY's Loop 2+ sentence is
  variants: ['The Crystal is warm against the Amulet before you touch it: it knows your voice. You told it, in a library that still had a roof, what it would hear.'],
};

// ---- Played through the engine on the real pack ---------------------------------------------------------------------------------

describe('played on the real pack (makeState + play: the engine runs the scenes)', () => {
  // from Loop 2 the profile holds what waking gave it (`echo_amulet_memory`, reducers/loop.ts `beginLoop`)
  const profileAt = (loop: number) => freshProfile({ loopCounter: loop, echoes: loop >= 2 ? ['echo_amulet_memory'] : [] });
  const at = (overrides: Parameters<typeof makeState>[0], loop = 1) => makeState({ ...overrides, loop }, { content: pack, profile: profileAt(loop) });
  const run = (s: GameState, actions: Action[], loop = 1) => play(s, actions, { content: pack, profile: profileAt(loop) });
  const talk = (npcId: string): Action => ({ type: 'talk', npcId });
  const pick = (choiceId: string): Action => ({ type: 'choose', choiceId });
  const go: Action = { type: 'continue' };
  /** What `statBonus` added to a stat: derive() with and without the loop's passive bonuses (level-ups from quest XP aside). */
  const bonusOf = (s: GameState, stat: 'hpMax' | 'magic'): number => derive(s.player, pack)[stat] - derive({ ...s.player, passiveBonuses: {} }, pack)[stat];

  test('Loop 1 Ilyra: the legacy offer only (no Loop 2+ or Echo line), "No." re-asks next time; "Yes." starts the quest', () => {
    const s = at({});
    const opened = run(s, [talk('npc_ilyra'), go]);
    expect(opened.state.dialogue?.sceneId).toBe('scene_first_meeting_ilyra');
    expect(choiceViews(opened.state, pack, freshProfile()).map((v) => v.id)).toEqual(['yes', 'no']);
    const refused = run(opened.state, [pick('no'), go]);
    expect(refused.state.mode).toBe('explore');
    const again = run(refused.state, [talk('npc_ilyra'), go, pick('yes')]);
    expect(again.state.quests.q_echo_crystal?.stage).toBe('reach_library');
  });

  test('Loop 2: the smudge, "I’ve done this before" (once), and the Echo lines greyed until known; the alcove opens the quest at the Crystal', () => {
    const profile = freshProfile({ loopCounter: 2, echoes: ['echo_crystal_location'] });
    const s = makeState({ loop: 2 }, { content: pack, profile });
    const opened = play(s, [talk('npc_ilyra'), go, go], { content: pack, profile });
    expect(opened.events.filter((e) => e.t === 'dialogueNode').map((e) => (e as { nodeId: string }).nodeId)).toEqual(['greeting_again', 'smudge', 'ask']);
    const views = choiceViews(opened.state, pack, profile);
    expect(views.map((v) => [v.id, v.enabled])).toEqual([['yes', true], ['no', true], ['done_this_before', true], ['watchword', false], ['third_alcove', true]]);
    expect(views.find((v) => v.id === 'watchword')?.disabledText).toBe('(You do not yet know this)');
    const told = play(opened.state, [pick('done_this_before')], { content: pack, profile });
    expect(told.state.flags.flag_ilyra_told).toBe(true);
    const back = play(told.state, [go], { content: pack, profile });
    expect(choiceViews(back.state, pack, profile).map((v) => v.id)).not.toContain('done_this_before');
    const alcove = play(back.state, [pick('third_alcove')], { content: pack, profile });
    expect(alcove.state.quests.q_echo_crystal?.stage).toBe('take_crystal');
  });

  test('the Crystal given: Remnants +15, the Crystal taken, 120 XP and 20 gold; verse I on the next talk (once); then the scroll is offered', () => {
    const s = at({ locationId: 'loc_whispering_ruins', items: ['item_echo_crystal'], quests: { q_echo_crystal: 'return' } });
    const gold = s.player.gold;
    const out = run(s, [talk('npc_ilyra'), pick('give'), go, go]);
    expect(out.state.reputation.remnants).toBe(15);
    expect(out.state.quests.q_echo_crystal?.status).toBe('completed');
    expect(out.state.player.inventory.some((i) => i.itemId === 'item_echo_crystal')).toBe(false);
    expect(out.state.player.gold).toBe(gold + 20);
    expect(out.events.filter((e) => e.t === 'xpGained').reduce((t, e) => t + (e as { amount: number }).amount, 0)).toBe(120);
    const next = run(out.state, [talk('npc_ilyra'), go, go]);
    expect(next.events.some((e) => e.t === 'echoGained' && e.echoId === 'echo_litany_verse_1')).toBe(true);
    const then = run(next.state, [talk('npc_ilyra')]);
    expect(then.state.dialogue?.sceneId).toBe('scene_ilyra_lost_scroll_offer');
  });

  test('the Crystal kept: Weavers +10, Remnants −10, 60 XP, no gold; Loop 1 offers no Listen; Loop 2 adds the Amulet’s line and Listen', () => {
    const s = at({ locationId: 'loc_whispering_ruins', items: ['item_echo_crystal'], quests: { q_echo_crystal: 'return' } });
    const out = run(s, [talk('npc_ilyra'), pick('keep'), go]);
    expect([out.state.reputation.weavers, out.state.reputation.remnants]).toEqual([10, -10]);
    expect(out.state.player.gold).toBe(s.player.gold);
    expect(out.events.filter((e) => e.t === 'xpGained').reduce((t, e) => t + (e as { amount: number }).amount, 0)).toBe(60);
    expect(choiceViews(out.state, pack, freshProfile())).toEqual([]);
    expect(legalActions(out.state, pack, freshProfile())).toContainEqual(go);
    const s2 = at({ locationId: 'loc_whispering_ruins', items: ['item_echo_crystal'], quests: { q_echo_crystal: 'return' } }, 2);
    const two = run(s2, [talk('npc_ilyra'), pick('keep'), go], 2);
    expect(two.events.at(-1)).toMatchObject({ t: 'dialogueNode', nodeId: 'kept_stirs', text: node('scene_echo_crystal', 'kept_stirs').textVariants.at(-1)?.text });
    const heard = run(two.state, [pick('listen'), go], 2);
    for (const echo of ['echo_litany_verse_1', 'echo_nine_voices']) expect(heard.state.echoesThisLoop).toContain(echo);
  });

  test('the scroll to Ilyra (Loop 1, no prompt): +1 MAG for the loop, a Mana Bloom, Remnants +10, Weavers −3, the legacy revelation', () => {
    const s = at({ locationId: 'loc_whispering_ruins', items: ['item_scholars_lost_scroll'], quests: { q_lost_scroll: 'deliver' } });
    const out = run(s, [talk('npc_ilyra'), go, go, go]);
    expect(out.state.quests.q_lost_scroll).toMatchObject({ status: 'completed', stage: 'to_ilyra' });
    expect([bonusOf(s, 'magic'), bonusOf(out.state, 'magic')]).toEqual([0, 1]);
    expect(out.state.player.inventory.some((i) => i.itemId === 'item_mana_bloom')).toBe(true);
    expect([out.state.reputation.remnants, out.state.reputation.weavers]).toEqual([10, -3]);
    expect(out.events.some((e) => e.t === 'dialogueNode' && e.nodeId === 'unseals')).toBe(true);
  });

  test('the Heartstone: Destroy moves the limit −40 watches and adds 20 max HP (full); Stabilize +24 and the stone with two fragments; Wait leaves it', () => {
    const base = { locationId: 'loc_sunken_archives', quests: { q_echoing_heartbeat: 'descend' } } as const;
    const s = at(base);
    const limit = s.clock.limitTicks;
    const entered = run(s, [{ type: 'move', to: 'loc_heartstone_depths' }]);
    expect(entered.state.dialogue?.sceneId).toBe('scene_heartstone_choice');
    expect(entered.state.quests.q_echoing_heartbeat?.stage).toBe('choose');
    const destroyed = run(entered.state, [pick('destroy'), go, go]);
    expect(destroyed.state.clock.limitTicks).toBe(limit - 40);
    expect(bonusOf(destroyed.state, 'hpMax')).toBe(20);
    expect([destroyed.state.player.hpMax, destroyed.state.player.hp]).toEqual([derive(destroyed.state.player, pack).hpMax, destroyed.state.player.hpMax]);
    expect([destroyed.state.reputation.ironclad, destroyed.state.reputation.remnants, destroyed.state.reputation.weavers]).toEqual([20, -25, -10]);
    expect(destroyed.state.quests.q_echoing_heartbeat).toMatchObject({ status: 'completed', stage: 'done_destroy' });
    const stabilized = run(entered.state, [pick('stabilize'), go, go]);
    expect(stabilized.state.clock.limitTicks).toBe(limit + 24);
    expect(stabilized.state.player.inventory.filter((i) => i.itemId === 'item_heartstone_fragment_stable').reduce((t, i) => t + i.qty, 0)).toBe(2);
    const waited = run(entered.state, [pick('wait'), go]);
    expect(waited.state.quests.q_echoing_heartbeat?.stage).toBe('choose');
    expect(waited.state.mode).toBe('explore');
  });

  test('Brak after the Outpost: +15 max HP and a full heal (legacy), the Plate; in the Horde no NPC scene opens', () => {
    const s = at({ locationId: 'loc_ironclad_camp', quests: { q_clear_path: { status: 'completed', stage: 'done' }, q_blighted_outpost: 'cleared' }, hp: 10 });
    const out = run(s, [talk('npc_brak'), go, go]);
    expect(bonusOf(out.state, 'hpMax')).toBe(15);
    expect([out.state.player.hpMax, out.state.player.hp]).toEqual([derive(out.state.player, pack).hpMax, out.state.player.hpMax]);
    expect(out.state.player.inventory.some((i) => i.itemId === 'item_ironclad_plate_armor')).toBe(true);
    expect([out.state.reputation.ironclad, out.state.reputation.weavers]).toEqual([15, -3]);
    const horde = at({ locationId: 'loc_whispering_ruins', flags: { flag_horde_active: true } });
    expect(legalActions(horde, pack, freshProfile()).some((a) => a.type === 'talk' && a.npcId === 'npc_ilyra')).toBe(false);
  });

  test('Nyx: the kept-Crystal line follows her greeting; Refuse keeps the shards, Ironclad +5, Weavers −20 and the recipes’ flag', () => {
    const kept = run(at({ locationId: 'loc_chasm_of_whispers', flags: { flag_kept_echo_crystal: true } }), [talk('npc_nyx'), go]);
    expect(kept.events.filter((e) => e.t === 'dialogueNode').map((e) => (e as { nodeId: string }).nodeId)).toEqual(['greeting_kept', 'kept']);
    const s = at({ locationId: 'loc_chasm_of_whispers', items: [{ itemId: 'item_void_shard', qty: 3 }], quests: { q_void_shards: 'return' } });
    const out = run(s, [talk('npc_nyx'), pick('no'), go]);
    expect([out.state.reputation.ironclad, out.state.reputation.weavers, out.state.flags.flag_shards_refused]).toEqual([5, -20, true]);
    expect(out.state.player.inventory.filter((i) => i.itemId === 'item_void_shard').reduce((t, i) => t + i.qty, 0)).toBe(3);
    expect(out.state.quests.q_void_shards).toMatchObject({ status: 'completed', stage: 'refused' });
  });
});
