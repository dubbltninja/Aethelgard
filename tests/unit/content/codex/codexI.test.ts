// U60: Codex I (src/content/shared/codex/{nine,history,people}.ts) against the documents. Every expectation that STORY gives is
// read from STORY.md at test time: §14.1's table (ids, titles, voices, unlock conditions), §14.2's sample entries (verbatim
// bodies), §11.1's quest givers (the "Meet all four" unlock), §12's Echo rows (the D-101 trio's traces) and §15.1's banned words.
// What STORY does not give (categories, cross-links, the shape of a "Meet"/"Recruit"/"Trade with" condition) is checked for
// shape: every id resolves, every body is 60–220 words, every voice holds at least a tenth of the entries, and the real pack
// builds with no codex error (the three tomes' and the Tyrant's `unlockCodex` effects resolve, which is what stopped the
// real-pack sim before U60, D-101).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { codex, codexI, historyCodex, litanyCodex, nineCodex, peopleCodex } from '@content/shared/codex';
import { MET_ALL_FOUR } from '@content/shared/codex/people';
import { anyTwoVerses } from '@content/shared/codex/nine';
import { validateContent } from '@content/validate';
import { CODEX_BODY_MAX_WORDS, CODEX_CATEGORIES, CodexSchema, wordCount, type CodexEntryInput } from '@schema/codex';
import type { Condition } from '@schema/condition';
import { CompanionId, Voice } from '@schema/primitives';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');
const pack = buildContentPack();

const cut = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start + from.length);
  expect(start, from).toBeGreaterThanOrEqual(0);
  expect(end, to).toBeGreaterThan(start);
  return text.slice(start, end);
};
const cells = (line: string): string[] => line.split('|').slice(1, -1).map((c) => c.trim());
const plain = (s: string): string => s.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
const byId = new Map<string, CodexEntryInput>(codexI.map((c) => [c.id, c]));
const entry = (id: string): CodexEntryInput => {
  const found = byId.get(id);
  if (!found) throw new Error(`no Codex I entry ${id}`);
  return found;
};

// ---- STORY §14.1 -------------------------------------------------------------------------------------------------------------

interface Row {
  ids: string[];
  title: string;
  voice: string;
  unlock: string;
  gist: string;
}
const LITANY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `codex_litany_${n}`);
const TABLE = cut(STORY, '### 14.1 Table', '### 14.2 Sample entries');
const rows: Row[] = TABLE.split('\n')
  .filter((line) => line.startsWith('| `codex_'))
  .map((line) => {
    const c = cells(line);
    const first = c[0] ?? '';
    const ids = first.includes('..') ? LITANY_IDS : [...first.matchAll(/`(codex_[a-z0-9_]+)`/g)].map((m) => m[1] as string);
    return { ids, title: c[1] ?? '', voice: c[2] ?? '', unlock: c[3] ?? '', gist: c[4] ?? '' };
  });
const rowOf = new Map<string, Row>(rows.flatMap((r) => r.ids.map((id) => [id, r] as const)));
const ALL_STORY_IDS = [...rowOf.keys()];

/** U61's kinds (places, regions, creatures, items, magic and the loop); everything else in §14.1 is U60's. */
const U61_KINDS = /^codex_(?:region_|place_|creatures_|item_|breach_clock$|loop$|echoes$|threshold_shore$|anchors$)/;
const U60_STORY_IDS = ALL_STORY_IDS.filter((id) => !U61_KINDS.test(id));
/** D-101: STORY §14.1 has no row for them; STORY §12 gives each a trace Echo whose row says "codex". */
const D101 = { codex_corvin_dreyl: 'echo_dreyl_brand', codex_ilsabet_rhune: 'echo_rhune_choice', codex_tobrin_vask: 'echo_vask_seal' } as const;

const VOICE: Record<string, string> = { RA: 'remnant_archive', IT: 'ironclad_telling', WF: 'weaver_fragment', WN: 'wayfinder_notes' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

// ---- Condition readers -------------------------------------------------------------------------------------------------------

type Atom = { key: string; value: unknown };
/** Every atom of a Condition tree, in order (`all`/`any`/`not` descend). */
function atoms(c: Condition | undefined): Atom[] {
  if (c === undefined) return [];
  const key = Object.keys(c)[0] as keyof Condition;
  const value = (c as Record<string, unknown>)[key];
  if (key === 'all' || key === 'any') return (value as Condition[]).flatMap(atoms);
  if (key === 'not') return atoms(value as Condition);
  return [{ key, value }];
}
const echoesIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'echo').map((a) => a.value as string);
const questsIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'quest').map((a) => (a.value as { id: string }).id);
const companionsIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'companion').map((a) => (a.value as { id: string }).id);
const locationsIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'location').map((a) => a.value as string);
const flagsIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'flag').map((a) => a.value as string);

describe('Codex I is STORY §14.1', () => {
  test('87 entries in §14.1 (79 rows; the Litany row is nine); Codex I takes the 39 that are not places, regions, creatures, items, magic or the loop, plus the D-101 three', () => {
    expect(rows).toHaveLength(79);
    expect(ALL_STORY_IDS).toHaveLength(87);
    expect(U60_STORY_IDS).toHaveLength(39);
    expect(codexI).toHaveLength(42);
    expect(codexI.map((c) => c.id).sort()).toEqual([...U60_STORY_IDS, ...Object.keys(D101)].sort());
    expect(new Set(codexI.map((c) => c.id)).size).toBe(42);
    for (const id of Object.keys(D101)) expect([id, rowOf.has(id)]).toEqual([id, false]); // when STORY adds a row, this says so
    expect(codex).toEqual(codexI); // U61 appends; until then the table is Codex I
    expect(Object.keys(pack.codex).sort()).toEqual(codexI.map((c) => c.id).sort());
  });

  test('every row entry: the title is STORY\'s (the Litany: "The Litany, Verse N · <verse title>"), the voice is STORY\'s tag', () => {
    for (const id of U60_STORY_IDS) {
      const row = rowOf.get(id) as Row;
      const c = entry(id);
      if (LITANY_IDS.includes(id)) {
        const n = Number(id.slice('codex_litany_'.length));
        expect(row.title).toBe('The Litany, Verses I–IX');
        expect(row.voice).toBe('RA (text) + WN (note)');
        expect([id, c.voice]).toEqual([id, 'remnant_archive']);
        expect([id, c.title.startsWith(`The Litany, Verse ${ROMAN[n - 1]} · `)]).toEqual([id, true]);
        // the WN note after the dash, in italics
        expect([id, /\n\n— \*[^*]+\*$/.test(c.body)]).toEqual([id, true]);
      } else {
        expect([id, c.title]).toEqual([id, row.title]);
        expect([id, c.voice]).toEqual([id, VOICE[row.voice]]);
      }
    }
  });

  test('the Litany entries carry STORY §2.3\'s canonical verse text, three lines in italics, and the speaker', () => {
    const litany = cut(STORY, '### 2.3 The Litany of the Conflux', '### 2.4 ');
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const block = cut(litany, `**${ROMAN[n - 1]}. `, n < 9 ? `**${ROMAN[n]}. ` : 'The ninth verse has no last line');
      const heading = /^\*\*[IVX]+\. (.+?)\*\* \((.+?)\)/.exec(block.trim());
      const [, verseTitle, speaker] = heading ?? [];
      const lines = block.split('\n').filter((l) => l.startsWith('> ')).map((l) => l.slice(2).trim());
      expect(lines).toHaveLength(3);
      const c = entry(`codex_litany_${n}`);
      expect(c.title).toBe(`The Litany, Verse ${ROMAN[n - 1]} · ${verseTitle}`);
      expect(c.body).toContain(`*${lines[0]}*\n*${lines[1]}*\n*${lines[2]}*`);
      expect([n, c.body.includes(speaker as string)]).toEqual([n, true]);
      expect(c.unlockWhen).toEqual({ echo: `echo_litany_verse_${n}` });
    }
    expect(litanyCodex.map((c) => c.id)).toEqual(LITANY_IDS);
  });

  test('§14.2: the sample entries of these kinds are the bodies, verbatim', () => {
    const samples = cut(STORY, '### 14.2 Sample entries', '## 15. Style guide');
    const blocks = [...samples.matchAll(/\*\*`(codex_[a-z0-9_]+)` — ([^*]+)\*\* \*\(([^)]+)\)\*\n\n((?:>.*\n?)+)/g)];
    expect(blocks.map((b) => b[1])).toEqual(['codex_tyrant_naming', 'codex_oriel_danthe', 'codex_durn_hallow', 'codex_item_void_shard', 'codex_breach_clock', 'codex_dask']);
    const ours = blocks.filter((b) => byId.has(b[1] as string));
    expect(ours.map((b) => b[1])).toEqual(['codex_tyrant_naming', 'codex_oriel_danthe', 'codex_durn_hallow', 'codex_dask']);
    for (const [, id, title, voice, quote] of ours) {
      const c = entry(id as string);
      const sample = (quote as string)
        .split('\n')
        .map((l) => l.replace(/^> ?/, ''))
        .join('\n')
        .trim();
      expect([id, c.title]).toEqual([id, title]);
      expect([id, c.voice]).toEqual([id, VOICE[{ 'Remnant Archive': 'RA', 'Ironclad Telling': 'IT', 'Weaver Fragment': 'WF', "Wayfinder's Notes": 'WN' }[voice as string] as string]]);
      expect([id, plain(c.body)]).toEqual([id, plain(sample)]);
    }
  });
});

// ---- Unlocks -----------------------------------------------------------------------------------------------------------------

describe('every unlock is §14.1\'s, as a Condition', () => {
  /** STORY §11.1: quest id → giver cell. */
  const givers = new Map<string, string>(
    cut(STORY, '### 11.1 Table', '### 11.2 Faction chains')
      .split('\n')
      .filter((l) => l.startsWith('| `q_'))
      .map((l) => cells(l))
      .map((c) => [plain(c[0] ?? ''), c[3] ?? ''] as const),
  );
  const questsGivenBy = (who: RegExp): string[] => [...givers].filter(([, g]) => who.test(g)).map(([id]) => id);

  test('the Unlock cell of every row is read and matched; a cell this test cannot read fails here', () => {
    for (const id of U60_STORY_IDS) {
      const row = rowOf.get(id) as Row;
      const c = entry(id);
      const cell = row.unlock;
      // the Litany row's cell is "The matching `echo_litany_verse_1` .. `_9`": each entry's own verse (checked above)
      const echoIds = LITANY_IDS.includes(id) ? [`echo_litany_verse_${id.slice('codex_litany_'.length)}`] : [...cell.matchAll(/`(echo_[a-z0-9_]+)`/g)].map((m) => m[1] as string);
      const questIds = [...cell.matchAll(/`(q_[a-z0-9_]+)`/g)].map((m) => m[1] as string);
      let understood = echoIds.length > 0 || questIds.length > 0;
      for (const e of echoIds) expect([id, e, echoesIn(c.unlockWhen).includes(e)]).toEqual([id, e, true]);
      for (const q of questIds) expect([id, q, questsIn(c.unlockWhen).includes(q)]).toEqual([id, q, true]);
      if (/Day 1/.test(cell)) {
        understood = true;
        expect([id, c.unlockedAtStart, c.unlockWhen]).toEqual([id, true, undefined]);
      } else {
        expect([id, c.unlockedAtStart ?? false]).toEqual([id, false]);
        expect([id, c.unlockWhen !== undefined]).toEqual([id, true]);
      }
      if (/Corruption ≥ 3/.test(cell)) {
        understood = true;
        expect([id, atoms(c.unlockWhen).some((a) => a.key === 'corruption' && JSON.stringify(a.value) === '{"min":3}')]).toEqual([id, true]);
      }
      if (/any two verse Echoes/.test(cell)) {
        understood = true;
        const when = c.unlockWhen as { any: Condition[] };
        expect(when.any.slice(1)).toEqual(anyTwoVerses());
        expect(anyTwoVerses()).toHaveLength(36);
        expect(new Set(anyTwoVerses().map((p) => JSON.stringify(p))).size).toBe(36);
      }
      if (/Reach the Apex/.test(cell)) {
        understood = true;
        expect([id, locationsIn(c.unlockWhen)]).toEqual([id, ['loc_temporal_breach_apex']]);
        expect([id, echoesIn(c.unlockWhen)]).toEqual([id, ['echo_apex_resonance']]); // "Stand at the Apex once" (STORY §12)
      }
      if (/or Keeper Dray/.test(cell)) {
        understood = true;
        expect([id, questsIn(c.unlockWhen)]).toEqual([id, ['q_keepers_ledger']]); // his Ledger read (STORY §11.2)
      }
      if (/^Recruit$/.test(cell)) {
        understood = true;
        const companion = id.slice('codex_'.length);
        expect(CompanionId.options).toContain(companion);
        expect([id, c.unlockWhen]).toEqual([id, { companion: { id: companion, state: 'recruited' } }]);
      }
      const meet = /^Meet (Nyx|Brak)$/.exec(cell);
      if (meet) {
        understood = true;
        const who = (meet[1] as string).toLowerCase();
        const quest = who === 'nyx' ? 'q_void_shards' : 'q_clear_path';
        const scene = who === 'nyx' ? 'scene_nyx_void_shards_offer' : 'scene_brak_clear_path_offer';
        expect([id, companionsIn(c.unlockWhen)]).toEqual([id, [who]]);
        expect([id, questsIn(c.unlockWhen)]).toEqual([id, [quest]]);
        expect([id, flagsIn(c.unlockWhen)]).toEqual([id, [`flag_scene_done_${scene}`]]);
        expect(pack.dialogues[scene]?.npcId).toBe(`npc_${who}`);
        expect(pack.quests[quest]?.giverNpcId).toBe(`npc_${who}`);
      }
      if (/^Meet all four$/.test(cell)) {
        understood = true;
        expect(row.title).toBe('Dray, Ironvow, Sethe, Thistlecourt');
        expect(c.unlockWhen).toEqual(MET_ALL_FOUR);
        const members = (MET_ALL_FOUR as { all: Condition[] }).all.map((m) => questsIn(m).sort());
        expect(members).toEqual([questsGivenBy(/Dray/), questsGivenBy(/Hadda Ironvow/), questsGivenBy(/Sethe/), questsGivenBy(/Elder Wen/)].map((q) => q.sort()));
        for (const m of members) expect(m.length).toBeGreaterThan(0);
      }
      if (/^Trade with Borin$/.test(cell)) {
        understood = true;
        expect([id, locationsIn(c.unlockWhen)]).toEqual([id, ['loc_emberforge']]);
        expect(pack.npcs['npc_borin_stonefist']?.homeLocationId).toBe('loc_emberforge');
        expect(pack.npcs['npc_borin_stonefist']?.merchantId).toBe('npc_borin_stonefist');
        for (const e of echoesIn(c.unlockWhen)) expect(['echo_borin_oath', 'echo_emberforge_vein']).toContain(e); // only Borin hands these over
      }
      expect([id, cell, understood]).toEqual([id, cell, true]);
    }
  });

  test('the D-101 three unlock on the trace Echo STORY §12 gives each (Dreyl\'s and Rhune\'s rows say "codex"; Vask\'s is D-101\'s), in the voice the documents imply', () => {
    const echoTable = cut(STORY, '## 12. Echo catalog', '## 13. Key scenes');
    const DECISIONS = fs.readFileSync(path.join(ROOT, 'docs/DECISIONS.md'), 'utf8');
    expect(cut(DECISIONS, '### D-101 ', '### D-102 ')).toContain('STORY §14.1 also lacks Vask, Rhune and Dreyl');
    for (const [id, echo] of Object.entries(D101)) {
      const c = entry(id);
      expect([id, c.unlockWhen]).toEqual([id, { echo }]);
      const row = echoTable.split('\n').find((l) => l.startsWith(`| \`${echo}\``));
      expect([echo, row !== undefined]).toEqual([echo, true]);
      if (echo !== 'echo_vask_seal') expect([echo, (cells(row ?? '')[3] ?? '').includes('codex')]).toEqual([echo, true]);
      expect(pack.echoes[echo]).toBeDefined();
    }
    expect(entry('codex_corvin_dreyl').voice).toBe('ironclad_telling'); // the Steppe is the Nomads' telling (WORLD §2.8)
    expect(entry('codex_ilsabet_rhune').voice).toBe('remnant_archive'); // the Tidewell ledger; the Archive's own drowning (WORLD §2.7)
    expect(entry('codex_tobrin_vask').voice).toBe('wayfinder_notes'); // the seal and the failsafe found under Vane's Watch
    expect(entry('codex_corvin_dreyl').body).toContain('flame inside a ring');
    expect(entry('codex_ilsabet_rhune').body).toContain('by her own choice');
    expect(entry('codex_tobrin_vask').body).toContain('square inside a circle');
  });

  test('every Echo named by an unlock is in the catalog; every quest is STORY §11.1\'s; every companion is one of the six; every flag is a legacy scene\'s done flag', () => {
    const storyQuests = new Set(givers.keys());
    for (const c of codexI) {
      for (const e of echoesIn(c.unlockWhen)) expect([c.id, e, pack.echoes[e] !== undefined]).toEqual([c.id, e, true]);
      for (const q of questsIn(c.unlockWhen)) expect([c.id, q, storyQuests.has(q)]).toEqual([c.id, q, true]);
      for (const k of companionsIn(c.unlockWhen)) expect(CompanionId.options).toContain(k);
      for (const f of flagsIn(c.unlockWhen)) {
        const scene = /^flag_scene_done_(scene_[a-z0-9_]+)$/.exec(f)?.[1] ?? '';
        expect([c.id, f, pack.dialogues[scene] !== undefined]).toEqual([c.id, f, true]);
      }
      for (const l of locationsIn(c.unlockWhen)) expect([c.id, l, pack.locations[l] !== undefined]).toEqual([c.id, l, true]);
    }
  });

  test('the Litany verses and the Nine: each verse entry unlocks on its verse Echo; each of the Nine on the Echo §14.1 names (the Tyrant\'s communion and the tomes also unlock three)', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) expect(entry(`codex_litany_${n}`).unlockWhen).toEqual({ echo: `echo_litany_verse_${n}` });
    const tomes = contentTables.items.filter((i) => i.onUse?.some((e) => 'unlockCodex' in e));
    const tomeTargets = tomes.flatMap((i) => (i.onUse ?? []).map((e) => ('unlockCodex' in e ? e.unlockCodex : '')).filter(Boolean));
    expect(tomeTargets.sort()).toEqual(['codex_maelis_korr', 'codex_oriel_danthe', 'codex_seraphine_aulde']);
    for (const t of tomeTargets) expect(pack.codex[t]).toBeDefined();
    const unveiled = pack.creatures['cr_chronos_tyrant_unveiled'];
    const listens = (unveiled?.communion?.movements ?? []).flatMap((m) => (m.listen?.effects ?? []).map((e) => ('unlockCodex' in e ? e.unlockCodex : '')));
    expect(listens).toEqual(['codex_tyrant_holding', 'codex_tyrant_six', 'codex_veyran_thal']);
    for (const t of listens) expect(pack.codex[t]).toBeDefined();
  });
});

// ---- Shape, voice and the real pack ------------------------------------------------------------------------------------------

describe('bodies, voices, cross-links and the real pack', () => {
  test('every body is 60–220 words (D-020: ≤ 220) and parses with the schema', () => {
    for (const c of codexI) {
      const words = wordCount(c.body);
      expect([c.id, words <= CODEX_BODY_MAX_WORDS, words >= 60]).toEqual([c.id, true, true]);
      expect(CodexSchema.safeParse(c).success).toBe(true);
      expect(CODEX_CATEGORIES).toContain(c.category);
    }
  });

  test('categories: the Nine and the Tyrant are the_nine; the Breach and the Litany are history; the Ledger entries wayfinders; the three orders factions; everyone else people', () => {
    expect(nineCodex.map((c) => c.category)).toEqual(nineCodex.map(() => 'the_nine'));
    expect(nineCodex.map((c) => c.id)).toEqual(U60_STORY_IDS.slice(0, 13));
    expect(historyCodex.filter((c) => c.category === 'history').map((c) => c.id)).toEqual(['codex_breach', ...LITANY_IDS]);
    expect(historyCodex.filter((c) => c.category === 'wayfinders').map((c) => c.id)).toEqual(['codex_wayfinder_nature', 'codex_wayfinder_symptom', 'codex_seven_wayfinders']);
    expect(historyCodex.filter((c) => c.category === 'factions').map((c) => c.id)).toEqual(['codex_remnants', 'codex_remnant_seal', 'codex_weavers', 'codex_weaver_choir', 'codex_ironclad', 'codex_ironclad_oath']);
    expect(peopleCodex.map((c) => c.category)).toEqual(peopleCodex.map(() => 'people'));
    expect(peopleCodex.map((c) => c.id)).toEqual([
      'codex_dask', 'codex_ilyra', 'codex_brak_and_kaelen', 'codex_borin', 'codex_mireya', 'codex_caelum', 'codex_present_leaders',
      'codex_corvin_dreyl', 'codex_ilsabet_rhune', 'codex_tobrin_vask',
    ]);
    // `order` sorts within a category and is unique there
    for (const cat of CODEX_CATEGORIES) {
      const orders = codexI.filter((c) => c.category === cat).map((c) => c.order ?? 0);
      expect([cat, new Set(orders).size]).toEqual([cat, orders.length]);
    }
  });

  test('voice spread: all four voices, each at least a tenth of Codex I (rule 17 warns under 10%); the Archive leads because §14.1 says so', () => {
    const count = new Map<string, number>();
    for (const c of codexI) count.set(c.voice, (count.get(c.voice) ?? 0) + 1);
    for (const v of Voice.options) expect([v, (count.get(v) ?? 0) / codexI.length >= 0.1]).toEqual([v, true]);
    expect(Object.fromEntries([...count].sort())).toEqual({ ironclad_telling: 8, remnant_archive: 22, wayfinder_notes: 7, weaver_fragment: 5 });
    const voices = validateContent(pack, { incompleteTables: INCOMPLETE_TABLES }).warnings.filter((w) => w.rule === 'rule-17' && /voice/.test(w.message));
    expect(voices).toEqual([]);
  });

  test('Remnant Archive entries date themselves where the fiction gives a year; no other voice carries a date', () => {
    for (const c of codexI) {
      if (c.date !== undefined) {
        expect([c.id, c.voice]).toEqual([c.id, 'remnant_archive']);
        expect(c.date).toMatch(/^Year \d+ of the Sundering$/);
      }
    }
    expect(entry('codex_tyrant_naming').date).toBe('Year 44 of the Sundering');
    expect(entry('codex_nine_overview').date).toBe('Year 0 of the Sundering');
  });

  test('cross-links: every `related` id is a §14.1 id or a Codex I id, never itself; every Codex I entry is linked to by another', () => {
    const known = new Set([...ALL_STORY_IDS, ...codexI.map((c) => c.id)]);
    const linkedTo = new Set<string>();
    for (const c of codexI) {
      expect([c.id, (c.related ?? []).length > 0]).toEqual([c.id, true]);
      for (const r of c.related ?? []) {
        expect([c.id, r, known.has(r), r !== c.id]).toEqual([c.id, r, true, true]);
        linkedTo.add(r);
      }
    }
    for (const c of codexI) expect([c.id, linkedTo.has(c.id)]).toEqual([c.id, true]);
  });

  test('STORY §15.1: no banned word in any body (the samples quote none either), no exclamation mark, no "You feel a sense of"', () => {
    const style = cut(STORY, '### 15.1 House voice', '### 15.2 Per-character voice notes');
    const banned = ['eldritch', 'unspeakable', 'unimaginable', 'nightmarish', 'epic', 'suddenly', 'very', 'literally', 'mysterious', 'ethereal'];
    for (const w of banned) expect(style).toContain(`*${w}*`);
    const re = new RegExp(`\\b(?:${banned.join('|')})\\b|fabric of (?:reality|existence)|!|You feel a sense of`, 'i');
    for (const c of codexI) expect([c.id, re.exec(c.body)?.[0] ?? null]).toEqual([c.id, null]);
  });

  test('the voices sound like themselves: RA cites a year or "the Archive"; IT addresses "you"; WF opens on an imperative; WN is first person', () => {
    for (const c of codexI) {
      const body = c.body;
      if (c.voice === 'remnant_archive') expect([c.id, /Year \d+|the Archive/.test(body)]).toEqual([c.id, true]);
      if (c.voice === 'ironclad_telling') expect([c.id, /\b[Yy]ou\b/.test(body)]).toEqual([c.id, true]);
      if (c.voice === 'weaver_fragment') expect([c.id, /^(?:Do not|Open|Stand|Come|We went)\b/.test(body)]).toEqual([c.id, true]);
      if (c.voice === 'wayfinder_notes') expect([c.id, /\bI\b/.test(body)]).toEqual([c.id, true]);
    }
  });

  test('the real pack builds; `codex` stays on INCOMPLETE_TABLES until U61; no codex error, and its only codex warnings are U61\'s pending cross-links and the quests/companions still being authored', () => {
    expect(INCOMPLETE_TABLES).toContain('codex');
    const { report } = parseContentPack();
    expect(report.errors).toEqual([]);
    const codexWarnings = report.warnings.filter((w) => w.table === 'codex');
    for (const w of codexWarnings) {
      expect([w.id, w.path, w.message.startsWith('pending — content not yet authored')]).toEqual([w.id, w.path, true]);
      const target = /'([a-z0-9_]+)' not found in (\w+)/.exec(w.message);
      const [, id, table] = target ?? [];
      if (table === 'codex') expect([w.id, id, U61_KINDS.test(id as string)]).toEqual([w.id, id, true]);
      else expect(['quests', 'companions']).toContain(table);
    }
    // nothing in the real pack points at a codex entry that does not exist in STORY §14.1 or Codex I
    const known = new Set([...ALL_STORY_IDS, ...codexI.map((c) => c.id)]);
    for (const w of report.warnings) {
      const m = /'(codex_[a-z0-9_]+)' not found in codex/.exec(w.message);
      if (m) expect([w.table, w.id, m[1], known.has(m[1] as string)]).toEqual([w.table, w.id, m[1], true]);
    }
  });
});
