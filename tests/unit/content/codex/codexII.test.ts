// U61: Codex II (src/content/shared/codex/{places,creatures,magic,items,loops}.ts) against the documents, the way codexI.test.ts
// checks Codex I. Every expectation STORY gives is read from STORY.md at test time: §14.1's table (ids, titles, voices, unlock
// cells), §14.2's two sample entries of these kinds (verbatim bodies), §12's "codex" Echoes and §15.1's banned words. Each
// unlock cell is parsed and matched against the entry's Condition: Echo ids, "Day 1", "Enter …" (a location, or a region
// with more than one door), "Kill or … a <creature>" (the bestiary, any loop, plus the Echo that spares it), "Take …" / "Hold
// one" / "Forge it" (the item), "Reach the Depths", "Witness the Horde, or reach the Apex", "First Echo gained" (any of the
// 103) and "Read one" (an `unlockCodex` on the Spellbook's read). Reachability is checked atom by atom: every Echo an entry
// reads is granted somewhere, every location, region, item and creature it names exists in the real pack, and the validator
// has no rule-17 complaint. The bodies are checked for length, voice signature and the style guide; the real pack builds with
// no codex warning at all, which is why `codex` left INCOMPLETE_TABLES.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { anyEcho, codex, codexI, codexII, creaturesCodex, itemsCodex, loopsCodex, magicCodex, placesCodex } from '@content/shared/codex';
import { echoes } from '@content/shared/echoes';
import { validateContent } from '@content/validate';
import { CODEX_BODY_MAX_WORDS, CODEX_CATEGORIES, CodexSchema, wordCount, type CodexEntryInput } from '@schema/codex';
import type { Condition } from '@schema/condition';
import { ENGINE_GRANTED_ECHOES } from '@schema/echo';
import { Voice } from '@schema/primitives';

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
/** The entries as the schema's input type (the `satisfies` arrays carry narrower literal types). */
const II: readonly CodexEntryInput[] = codexII;
const I: readonly CodexEntryInput[] = codexI;
const ALL: readonly CodexEntryInput[] = codex;
const byId = new Map<string, CodexEntryInput>(II.map((c) => [c.id, c]));
const entry = (id: string): CodexEntryInput => {
  const found = byId.get(id);
  if (!found) throw new Error(`no Codex II entry ${id}`);
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

/** Codex II's kinds (the same test as codexI.test.ts draws the line with). */
const U61_KINDS = /^codex_(?:region_|place_|creatures_|item_|breach_clock$|loop$|echoes$|threshold_shore$|anchors$)/;
const U61_STORY_IDS = ALL_STORY_IDS.filter((id) => U61_KINDS.test(id));

const VOICE: Record<string, string> = { RA: 'remnant_archive', IT: 'ironclad_telling', WF: 'weaver_fragment', WN: 'wayfinder_notes' };

/**
 * STORY §14.1 names a place by its STORY name; BIBLE §7 maps the STORY names onto WORLD's ids (the Ring of Wagons = Hearthring,
 * the Hollow Choir = the Sanctum of Threads). "Enter <region>" for a region with more than one door is the `region` atom.
 */
const ENTER: Record<string, Condition> = {
  codex_region_mistwood_reach: { location: 'loc_mistwood_path' },
  codex_region_voidscar: { location: 'loc_chasm_of_whispers' },
  codex_region_highlands: { location: 'loc_shimmering_pass' },
  codex_region_glowlands_nexus: { location: 'loc_veridian_glowlands' },
  codex_region_drowned_reach: { region: 'region_drowned_reach' },
  codex_region_ashen_steppe: { region: 'region_ashen_steppe' },
  codex_region_veil: { region: 'region_veil' },
  codex_region_glowfen: { region: 'region_glowfen' },
  codex_region_skyreach: { region: 'region_skyreach' },
  codex_place_shattered_library: { location: 'loc_shattered_library' },
  codex_place_silverwood_plaza: { location: 'loc_silverwood_plaza' },
  codex_place_sunken_archives: { location: 'loc_sunken_archives' },
  codex_place_heartstone_depths: { location: 'loc_heartstone_depths' },
  codex_place_chasm_of_whispers: { location: 'loc_chasm_of_whispers' },
  codex_place_emberforge: { location: 'loc_emberforge' },
  codex_place_chronos_nexus: { location: 'loc_chronos_nexus' },
  codex_place_aetherium_spires: { location: 'loc_aetherium_spires' },
  codex_place_wayfarers_respite: { location: 'loc_wayfarers_respite' },
  codex_place_lanternreed: { location: 'loc_lanternreed' },
  codex_place_ring_of_wagons: { location: 'loc_hearthring' },
  codex_place_hollow_choir: { location: 'loc_sanctum_of_threads' },
};

/** STORY §12 Echoes whose "Unlocks" cell says "codex" and that §14.1 gives no row: each is an alternate on the entry it is about. */
const SECTION_12_CODEX: Record<string, string> = {
  echo_day_of_teeth: 'codex_creatures_unravelled',
  echo_ninth_verse_unfinished: 'codex_item_echo_crystal',
  echo_heartstone_triune: 'codex_item_heartstone',
  echo_shard_moments: 'codex_item_void_shard',
  echo_hadrek_clockwright: 'codex_place_chronos_nexus',
};
/** Other alternates, each D-108's kind of reading ("Take the Crystal" once is `echo_crystal_location`; "Reach" is the shortcut too). */
const OTHER_ALTERNATES: Record<string, string[]> = {
  codex_item_echo_crystal: ['echo_crystal_location'],
  codex_item_heartstone: ['echo_heartstone_path'],
  codex_creatures_unravelled: ['echo_horde_path', 'echo_apex_resonance'], // "Witness the Horde" is its Echo; "reach the Apex" its shortcut
  codex_creatures_drowned: ['echo_oriel_drowned'],
  codex_creatures_wards: ['echo_stone_hide_origin'],
};

// ---- Condition readers -------------------------------------------------------------------------------------------------------

type Atom = { key: string; value: unknown };
function atoms(c: Condition | undefined): Atom[] {
  if (c === undefined) return [];
  const key = Object.keys(c)[0] as keyof Condition;
  const value = (c as Record<string, unknown>)[key];
  if (key === 'all' || key === 'any') return (value as Condition[]).flatMap(atoms);
  if (key === 'not') return atoms(value as Condition);
  return [{ key, value }];
}
const echoesIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'echo').map((a) => a.value as string);
const itemsIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'item').map((a) => (a.value as { id: string }).id);
const killedIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'killed').map((a) => (a.value as { id: string }).id);
const locationsIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'location').map((a) => a.value as string);
const regionsIn = (c: Condition | undefined): string[] => atoms(c).filter((a) => a.key === 'region').map((a) => a.value as string);
const branches = (c: Condition | undefined): Condition[] => (c !== undefined && 'any' in c ? c.any : c === undefined ? [] : [c]);

const creatureByName = (name: string): string => {
  const found = Object.values(pack.creatures).find((cr) => cr.name === name);
  if (!found) throw new Error(`no creature named ${name}`);
  return found.id;
};

/** What grants each Echo: the engine's list, every grantEcho effect in the pack, every quest reward. */
const grantedEchoes = (() => {
  const out = new Set<string>(ENGINE_GRANTED_ECHOES);
  const { echoes: _skip, ...rest } = pack;
  for (const m of JSON.stringify(rest).matchAll(/"grantEcho":"(echo_[a-z0-9_]+)"/g)) out.add(m[1] as string);
  for (const q of Object.values(pack.quests)) for (const id of q.rewards.echoes) out.add(id);
  return out;
})();
/** Creatures that appear somewhere a player can fight them: a location's encounters, a regional boss, or an anomaly variant. */
const fightable = new Set<string>(JSON.stringify(Object.values(pack.locations)).match(/cr_[a-z0-9_]+/g) ?? []);

/** An atom the real pack can satisfy: the Echo is granted, the place/region/item/creature exists (and can be found). */
function liveAtom(a: Atom): boolean {
  if (a.key === 'echo') return pack.echoes[a.value as string] !== undefined && grantedEchoes.has(a.value as string);
  if (a.key === 'location') return pack.locations[a.value as string] !== undefined;
  if (a.key === 'region') return pack.regions[a.value as string] !== undefined;
  if (a.key === 'item') {
    const item = pack.items[(a.value as { id: string }).id];
    return item !== undefined && item.sources.length > 0;
  }
  if (a.key === 'killed') return fightable.has((a.value as { id: string }).id);
  return false;
}
function live(c: Condition): boolean {
  if ('all' in c) return c.all.every(live);
  if ('any' in c) return c.any.some(live);
  if ('not' in c) return true;
  return liveAtom(atoms(c)[0] as Atom);
}

describe('Codex II is the rest of STORY §14.1', () => {
  test('48 entries: every §14.1 id of these kinds, once; with Codex I the table is STORY\'s 87 plus D-101\'s three', () => {
    expect(U61_STORY_IDS).toHaveLength(48);
    expect(codexII).toHaveLength(48);
    expect(codexII.map((c) => c.id).sort()).toEqual([...U61_STORY_IDS].sort());
    expect(new Set(codex.map((c) => c.id)).size).toBe(codexI.length + codexII.length);
    expect(codex).toEqual([...codexI, ...codexII]);
    expect(ALL_STORY_IDS).toHaveLength(87);
    expect(Object.keys(pack.codex)).toHaveLength(90);
    for (const id of ALL_STORY_IDS) expect([id, pack.codex[id] !== undefined]).toEqual([id, true]);
  });

  test('the files: regions then places (places), the eight families (creatures), the clock and the anchors (magic), the eight items, the loop', () => {
    expect(placesCodex.map((c) => c.id)).toEqual([...U61_STORY_IDS.filter((id) => id.startsWith('codex_region_')), ...U61_STORY_IDS.filter((id) => id.startsWith('codex_place_'))]);
    expect(creaturesCodex.map((c) => c.id)).toEqual(U61_STORY_IDS.filter((id) => id.startsWith('codex_creatures_')));
    expect(creaturesCodex).toHaveLength(8); // WORLD §5's eight families, C-19
    expect(magicCodex.map((c) => c.id)).toEqual(['codex_breach_clock', 'codex_anchors']);
    expect(itemsCodex.map((c) => c.id)).toEqual(U61_STORY_IDS.filter((id) => id.startsWith('codex_item_')));
    expect(loopsCodex.map((c) => c.id)).toEqual(['codex_loop', 'codex_echoes', 'codex_threshold_shore']);
    for (const c of placesCodex) expect([c.id, c.category]).toEqual([c.id, 'places']);
    for (const c of creaturesCodex) expect([c.id, c.category]).toEqual([c.id, 'creatures']);
    for (const c of magicCodex) expect([c.id, c.category]).toEqual([c.id, 'magic']);
    for (const c of itemsCodex) expect([c.id, c.category]).toEqual([c.id, 'items']);
    for (const c of loopsCodex) expect([c.id, c.category]).toEqual([c.id, 'loops']);
  });

  test('every entry: the title is STORY\'s and the voice is STORY\'s tag; the one exception is `codex_breach_clock`, whose §14.2 sample is Wayfinder\'s Notes in the first person while its §14.1 cell says RA', () => {
    for (const id of U61_STORY_IDS) {
      const row = rowOf.get(id) as Row;
      const c = entry(id);
      expect([id, c.title]).toEqual([id, row.title]);
      if (id === 'codex_breach_clock') {
        expect(row.voice).toBe('RA');
        expect(c.voice).toBe('wayfinder_notes');
      } else {
        expect([id, c.voice]).toEqual([id, VOICE[row.voice]]);
      }
    }
  });

  test('§14.2: the sample entries of these kinds are the bodies, verbatim, in the sample\'s voice', () => {
    const samples = cut(STORY, '### 14.2 Sample entries', '## 15. Style guide');
    const blocks = [...samples.matchAll(/\*\*`(codex_[a-z0-9_]+)` — ([^*]+)\*\* \*\(([^)]+)\)\*\n\n((?:>.*\n?)+)/g)];
    const ours = blocks.filter((b) => byId.has(b[1] as string));
    expect(ours.map((b) => b[1])).toEqual(['codex_item_void_shard', 'codex_breach_clock']);
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
  test('the Unlock cell of every row is read and matched; a cell this test cannot read fails here', () => {
    for (const id of U61_STORY_IDS) {
      const row = rowOf.get(id) as Row;
      const c = entry(id);
      const cell = row.unlock;
      const expectedEchoes = [...cell.matchAll(/`(echo_[a-z0-9_]+)`/g)].map((m) => m[1] as string);
      let understood = expectedEchoes.length > 0;
      for (const e of expectedEchoes) expect([id, e, echoesIn(c.unlockWhen).includes(e)]).toEqual([id, e, true]);
      // nothing beyond the cell except the §12 "codex" Echoes and D-108's readings
      const allowed = new Set([...expectedEchoes, ...(OTHER_ALTERNATES[id] ?? []), ...Object.entries(SECTION_12_CODEX).filter(([, target]) => target === id).map(([e]) => e)]);
      if (id !== 'codex_echoes') for (const e of echoesIn(c.unlockWhen)) expect([id, e, allowed.has(e)]).toEqual([id, e, true]);
      if (/^Day 1/.test(cell)) {
        understood = true;
        expect([id, c.unlockedAtStart, c.unlockWhen]).toEqual([id, true, undefined]);
      } else {
        expect([id, c.unlockedAtStart ?? false]).toEqual([id, false]);
      }
      if (/^Enter\b/.test(cell)) {
        understood = true;
        const expected = ENTER[id];
        expect([id, expected !== undefined]).toEqual([id, true]);
        expect([id, branches(c.unlockWhen).some((b) => JSON.stringify(b) === JSON.stringify(expected))]).toEqual([id, true]);
        // "Enter <location>" names a location of the region the entry is about; "Enter the <region>" names the region
        const name = /^Enter (?:the )?(.+)$/.exec(cell)?.[1] ?? '';
        if (name !== '' && 'location' in (expected as { location?: string })) {
          const loc = pack.locations[(expected as { location: string }).location];
          expect([id, (loc?.name ?? '').includes(name.replace(/^the /, ''))]).toEqual([id, true]); // "the Chasm" is the Chasm of Whispers; "the Glowlands" the Veridian Glowlands
        }
      }
      const kill = /^Kill(?: or (?:spare|calm|still|pass))? (?:an? )?(.+)$/.exec(cell);
      if (kill) {
        understood = true;
        const names = (kill[1] as string).split(/, | or /).map((n) => n.replace(/^an? /, ''));
        expect([id, killedIn(c.unlockWhen).sort()]).toEqual([id, names.map(creatureByName).sort()]);
        for (const a of atoms(c.unlockWhen).filter((x) => x.key === 'killed')) expect([id, (a.value as { anyLoop?: boolean }).anyLoop]).toEqual([id, true]);
      }
      const take = /^(?:Take the (Crystal|scroll|Lens)|Hold one|Forge it)$/.exec(cell);
      if (take) {
        understood = true;
        const item = { Crystal: 'item_echo_crystal', scroll: 'item_scholars_lost_scroll', Lens: 'item_chronos_lens' }[take[1] ?? ''] ?? (cell === 'Hold one' ? 'item_void_shard' : 'item_breach_anchor');
        expect([id, itemsIn(c.unlockWhen)]).toEqual([id, [item]]);
      }
      if (/^Reach the Depths$/.test(cell)) {
        understood = true;
        expect([id, locationsIn(c.unlockWhen)]).toEqual([id, ['loc_heartstone_depths']]);
        expect([id, echoesIn(c.unlockWhen).includes('echo_heartstone_path')]).toEqual([id, true]);
      }
      if (/^Witness the Horde, or reach the Apex$/.test(cell)) {
        understood = true;
        expect([id, locationsIn(c.unlockWhen)]).toEqual([id, ['loc_temporal_breach_apex']]);
        expect([id, echoesIn(c.unlockWhen).includes('echo_horde_path'), echoesIn(c.unlockWhen).includes('echo_apex_resonance')]).toEqual([id, true, true]);
      }
      if (/^First Echo gained$/.test(cell)) {
        understood = true;
        expect(c.unlockWhen).toEqual(anyEcho());
        expect(echoesIn(c.unlockWhen).sort()).toEqual(echoes.map((e) => e.id).sort());
        expect(echoesIn(c.unlockWhen)).toHaveLength(103);
      }
      if (/^Read one$/.test(cell)) {
        understood = true;
        expect([id, c.unlockWhen]).toEqual([id, undefined]);
        const readers = contentTables.items.filter((i) => i.onUse?.some((e) => 'unlockCodex' in e && e.unlockCodex === id)).map((i) => i.id);
        expect(readers.sort()).toEqual(['item_dark_spellbook', 'item_korrs_marginalia']);
      }
      expect([id, cell, understood]).toEqual([id, cell, true]);
    }
  });

  test('STORY §12: the "codex" Echoes §14.1 gives no row are alternates on the entry each is about (D-108 flagged the Clockwright\'s)', () => {
    const echoTable = cut(STORY, '## 12. Echo catalog', '## 13. Key scenes');
    for (const [echo, target] of Object.entries(SECTION_12_CODEX)) {
      const row = echoTable.split('\n').find((l) => l.startsWith(`| \`${echo}\``));
      expect([echo, (cells(row ?? '')[3] ?? '').toLowerCase().includes('codex')]).toEqual([echo, true]);
      expect([echo, echoesIn(entry(target).unlockWhen).includes(echo)]).toEqual([echo, true]);
    }
    expect(entry('codex_place_chronos_nexus').body).toContain('Hadrek the Clockwright');
  });

  test('every Echo, item, location, region and creature an unlock names exists in the real pack', () => {
    for (const c of II) {
      for (const e of echoesIn(c.unlockWhen)) expect([c.id, e, pack.echoes[e] !== undefined]).toEqual([c.id, e, true]);
      for (const i of itemsIn(c.unlockWhen)) expect([c.id, i, pack.items[i] !== undefined]).toEqual([c.id, i, true]);
      for (const l of locationsIn(c.unlockWhen)) expect([c.id, l, pack.locations[l] !== undefined]).toEqual([c.id, l, true]);
      for (const r of regionsIn(c.unlockWhen)) expect([c.id, r, pack.regions[r] !== undefined]).toEqual([c.id, r, true]);
      for (const k of killedIn(c.unlockWhen)) expect([c.id, k, pack.creatures[k] !== undefined]).toEqual([c.id, k, true]);
      for (const a of atoms(c.unlockWhen)) expect(['echo', 'item', 'location', 'region', 'killed']).toContain(a.key);
    }
  });

  test('reachable: every entry is unlocked at the start, or by an unlockCodex effect, or by a condition with a live branch (its Echo granted, its place in the map, its item with a source, its creature fightable); the validator agrees', () => {
    const hooked = new Set((JSON.stringify(contentTables).match(/"unlockCodex":"(codex_[a-z0-9_]+)"/g) ?? []).map((m) => m.slice('"unlockCodex":"'.length, -1)));
    for (const c of II) {
      const how = c.unlockedAtStart ? 'start' : hooked.has(c.id) ? 'hook' : c.unlockWhen !== undefined && live(c.unlockWhen) ? 'condition' : 'unreachable';
      expect([c.id, how]).not.toEqual([c.id, 'unreachable']);
    }
    expect(hooked.has('codex_item_dark_spellbook')).toBe(true);
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors.filter((e) => e.table === 'codex')).toEqual([]);
    expect(report.warnings.filter((w) => w.table === 'codex')).toEqual([]);
  });
});

// ---- Shape, voice and the real pack ------------------------------------------------------------------------------------------

describe('bodies, voices, cross-links and the real pack', () => {
  test('every body is 60–220 words (D-020: ≤ 220) and parses with the schema; `order` is unique within a category across the whole codex', () => {
    for (const c of II) {
      const words = wordCount(c.body);
      expect([c.id, words <= CODEX_BODY_MAX_WORDS, words >= 60]).toEqual([c.id, true, true]);
      expect(CodexSchema.safeParse(c).success).toBe(true);
      expect(CODEX_CATEGORIES).toContain(c.category);
    }
    for (const cat of CODEX_CATEGORIES) {
      const orders = ALL.filter((c) => c.category === cat).map((c) => c.order ?? 0);
      expect([cat, new Set(orders).size]).toEqual([cat, orders.length]);
    }
  });

  test('voice spread: Codex II by voice, and all four voices at a tenth or more of the whole codex (rule 17 warns under 10%)', () => {
    const count = (list: readonly CodexEntryInput[]) => {
      const m = new Map<string, number>();
      for (const c of list) m.set(c.voice, (m.get(c.voice) ?? 0) + 1);
      return Object.fromEntries([...m].sort());
    };
    expect(count(II)).toEqual({ ironclad_telling: 11, remnant_archive: 15, wayfinder_notes: 13, weaver_fragment: 9 });
    expect(count(ALL)).toEqual({ ironclad_telling: 19, remnant_archive: 37, wayfinder_notes: 20, weaver_fragment: 14 });
    for (const v of Voice.options) expect([v, (count(ALL)[v] ?? 0) / ALL.length >= 0.1]).toEqual([v, true]);
    const voices = validateContent(pack, { incompleteTables: INCOMPLETE_TABLES }).warnings.filter((w) => w.rule === 'rule-17' && /voice/.test(w.message));
    expect(voices).toEqual([]);
  });

  test('Remnant Archive entries date themselves; no other voice carries a date', () => {
    for (const c of II) {
      if (c.voice === 'remnant_archive') expect([c.id, c.date]).toEqual([c.id, 'Year 500 of the Sundering']);
      else expect([c.id, c.date]).toEqual([c.id, undefined]);
    }
  });

  test('cross-links: every `related` id is a codex id, never itself; every Codex II entry is linked to by another entry', () => {
    const known = new Set(ALL.map((c) => c.id));
    const linkedTo = new Set<string>();
    for (const c of ALL) for (const r of c.related ?? []) linkedTo.add(r);
    for (const c of II) {
      expect([c.id, (c.related ?? []).length >= 3]).toEqual([c.id, true]);
      for (const r of c.related ?? []) expect([c.id, r, known.has(r), r !== c.id]).toEqual([c.id, r, true, true]);
      expect([c.id, linkedTo.has(c.id)]).toEqual([c.id, true]);
    }
    // Codex I's links into Codex II all resolve now
    for (const c of I) for (const r of c.related ?? []) expect([c.id, r, known.has(r)]).toEqual([c.id, r, true]);
  });

  test('STORY §15.1: no banned word in any body, no exclamation mark, no "You feel a sense of", no "ancient" as a default adjective', () => {
    const style = cut(STORY, '### 15.1 House voice', '### 15.2 Per-character voice notes');
    const banned = ['eldritch', 'unspeakable', 'unimaginable', 'nightmarish', 'epic', 'suddenly', 'very', 'literally', 'mysterious', 'ethereal', 'ancient'];
    for (const w of banned) expect(style).toContain(`*${w}*`);
    const re = new RegExp(`\\b(?:${banned.join('|')})\\b|fabric of (?:reality|existence)|!|You feel a sense of`, 'i');
    for (const c of II) expect([c.id, re.exec(c.body)?.[0] ?? null]).toEqual([c.id, null]);
  });

  test('the voices sound like themselves: RA cites a year and signs "Keeper\'s hand"; IT addresses "you"; WF opens on an imperative and never says "I"; WN is first person and never signs', () => {
    for (const c of II) {
      const body = c.body;
      if (c.voice === 'remnant_archive') {
        expect([c.id, /Year \d+/.test(body) && /the Archive|the order/.test(body)]).toEqual([c.id, true]);
        expect([c.id, /— \*Keeper's hand, Year 500\.\*$/.test(body) || /The present Keeper/.test(body)]).toEqual([c.id, true]);
      }
      if (c.voice === 'ironclad_telling') expect([c.id, /^You'll\b|\byou\b/.test(body)]).toEqual([c.id, true]);
      if (c.voice === 'weaver_fragment') {
        expect([c.id, /^(?:Do not|Open|Stand|Come|Cut|Hold|A shard)\b/.test(body)]).toEqual([c.id, true]);
        expect([c.id, /\bI\b/.test(body)]).toEqual([c.id, false]);
      }
      if (c.voice === 'wayfinder_notes') {
        expect([c.id, /\bI\b/.test(body)]).toEqual([c.id, true]);
        expect([c.id, /Keeper's hand/.test(body)]).toEqual([c.id, false]);
      }
    }
  });

  test('an "Enter" entry read on Day 1 keeps what the unlock has not earned: the Library does not name the portal, the Archives do not name Oriel as the reader, the Emberforge does not name Hallow', () => {
    expect(entry('codex_place_shattered_library').body).not.toMatch(/portal/i);
    expect(entry('codex_place_sunken_archives').body).not.toMatch(/Oriel/);
    expect(entry('codex_place_emberforge').body).not.toMatch(/Hallow/);
    expect(entry('codex_place_chasm_of_whispers').body).not.toMatch(/Nyxaria|Vell\b/);
  });

  test('the real pack builds with no codex error or warning and nothing pending into any table; `codex` is off INCOMPLETE_TABLES', () => {
    expect(INCOMPLETE_TABLES).not.toContain('codex');
    const { report } = parseContentPack();
    expect(report.errors).toEqual([]);
    expect(report.warnings.filter((w) => w.table === 'codex')).toEqual([]);
    expect(report.warnings.filter((w) => w.message.includes('not found in codex'))).toEqual([]);
    expect(report.warnings.filter((w) => w.message.startsWith('pending — content not yet authored (reference)'))).toEqual([]);
  });
});
