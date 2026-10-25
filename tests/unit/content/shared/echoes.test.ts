// U51: the Echo catalog (src/content/shared/echoes.ts) against the documents. Every expectation is read from STORY.md §12
// (ids, titles, "How earned", "Unlocks", "Exclusive with") and DESIGN.md §10.5 at test time, so an edit of either the content
// or the document fails here. What STORY does not give (the 103 codex lines, the category and timeline group of each
// Echo) is checked for shape only: ≤ 40 words, a known category, a group.
//
// Also here: the engine's own Echo tables name only catalog ids, the ending-requirement links hold both ways, D-097 (where
// `echo_sky_oath` is earned) is pinned to the authored regions, and rule 16 reports the Echoes no content grants yet as
// pending (not errors) while `quests` or `dialogues` are still being authored.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { echoes } from '@content/shared/echoes';
import { validateContent } from '@content/validate';
import { BOND_ECHOES, ECHO_REP_STARTS, JAILER_SOURCES, LOOP_END_REP_ECHOES } from '@engine/index';
import { ECHO_CATEGORIES, ECHO_CODEX_LINE_MAX_WORDS, ENGINE_GRANTED_ECHOES } from '@schema/echo';
import { wordCount } from '@schema/codex';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const STORY = read('docs/STORY.md');
const DESIGN = read('docs/DESIGN.md');
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

// ---- STORY §12 ---------------------------------------------------------------------------------------------------------------

interface Row {
  ids: string[];
  title: string;
  earned: string;
  unlocks: string;
  exclusive: string;
}
const ENDING_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
const ECHO_SECTION = cut(STORY, '## 12. Echo catalog', '## 13. Key scenes');
const rows: Row[] = ECHO_SECTION.split('\n')
  .filter((line) => line.startsWith('| `echo_'))
  .map((line) => {
    const c = cells(line);
    const first = c[0] ?? '';
    // "`echo_ending_a` .. `echo_ending_f`" is a range; every other multi-id row lists its ids with " / "
    const ids = first.includes('..') ? ENDING_LETTERS.map((l) => `echo_ending_${l}`) : [...first.matchAll(/`(echo_[a-z0-9_]+)`/g)].map((m) => m[1] as string);
    return { ids, title: c[1] ?? '', earned: c[2] ?? '', unlocks: c[3] ?? '', exclusive: c[4] ?? '' };
  });
const rowOf = new Map<string, Row>(rows.flatMap((r) => r.ids.map((id) => [id, r] as const)));

const ID_PREFIX = '(?:q|item|scene|ev|echo|loc|cr|flag|npc|mat|recipe|codex)';
const BACKTICKED_ID = new RegExp(`\`(${ID_PREFIX}_[a-z0-9_]+)\``, 'g');
const BARE_ID = new RegExp(`\\b${ID_PREFIX}_[a-z0-9_]+`, 'g');

describe('the catalog is STORY §12', () => {
  test('103 Echoes: the 95 table rows read as 103 ids, each in the pack once', () => {
    expect(rows).toHaveLength(95);
    expect(rowOf.size).toBe(103);
    expect(echoes).toHaveLength(103);
    expect(Object.keys(pack.echoes).sort()).toEqual([...rowOf.keys()].sort());
  });

  test('every title: a single-id row is named exactly as STORY titles it', () => {
    for (const e of echoes) {
      const row = rowOf.get(e.id) as Row;
      if (row.ids.length === 1) expect([e.id, e.name]).toEqual([e.id, row.title]);
      else if (row.title === "Mireya's Choice") expect(e.name.startsWith(row.title)).toBe(true);
      else if (row.title === 'Witnessed') expect(e.name.startsWith('Witnessed: ')).toBe(true);
      else expect(row.title).toBe('Regional marks'); // the three marks are named for their quests
      expect(e.name.length).toBeLessThanOrEqual(40); // DESIGN §10.4: ≤ 40 characters
    }
  });

  test('the High Mark, Bell Vault and Lightless Stair rows say "their regional quests": q_high_mark, q_bell_vault, q_lightless_stair', () => {
    for (const q of ['q_high_mark', 'q_bell_vault', 'q_lightless_stair']) expect(STORY).toContain(`#### \`${q}\``);
  });

  test('description is the "Unlocks" cell, markup removed', () => {
    for (const e of echoes) expect([e.id, e.description]).toEqual([e.id, plain((rowOf.get(e.id) as Row).unlocks)]);
  });

  test('exclusiveWith is the "Exclusive with" cell, on both sides', () => {
    const expected = (id: string): string[] => {
      const row = rowOf.get(id) as Row;
      const named = [...row.exclusive.matchAll(/`(echo_[a-z0-9_]+)`/g)].map((m) => m[1] as string);
      // the three Heartstone beats name each other as bare words ("hunger, silence (per loop)")
      const beats = (['resonance', 'hunger', 'silence'] as const).filter((w) => new RegExp(`\\b${w}\\b`).test(row.exclusive)).map((w) => `echo_heartstone_${w}`);
      const eachOther = row.exclusive.includes('each other') ? row.ids.filter((x) => x !== id) : [];
      return [...named, ...beats, ...eachOther].sort();
    };
    for (const e of echoes) expect([e.id, [...(e.exclusiveWith ?? [])].sort()]).toEqual([e.id, expected(e.id)]);
    // the three that name a state or a flag, not an Echo, say so
    for (const id of ['echo_nine_voices', 'echo_brak_death', 'echo_dask_rest']) expect(pack.echoes[id]?.notes).toBeTruthy();
    expect(Object.values(pack.echoes).filter((e) => e.exclusiveWith.length > 0)).toHaveLength(11); // the 3 beats, lineage/recoil, the 4 Caelum, the Glowfen pair
  });

  test('obtainedBy: its ids are the ids in the "How earned" cell (D-097 and the three regional marks apart)', () => {
    // `echo_sky_oath`: STORY says the Perch with no id; the authored regions grant it at the Ashen Cairns (D-097, see below).
    // The marks: "Their regional quests" is the quest of the same name.
    const override: Record<string, string[]> = {
      echo_sky_oath: ['ev_cairns_strike'],
      echo_high_mark: ['q_high_mark'],
      echo_bell_vault: ['q_bell_vault'],
      echo_lightless_stair: ['q_lightless_stair'],
    };
    for (const e of echoes) {
      const row = rowOf.get(e.id) as Row;
      const fromStory = [...row.earned.matchAll(BACKTICKED_ID)].map((m) => m[1] as string);
      const want = [...new Set(override[e.id] ?? fromStory)].sort();
      const have = [...new Set(e.obtainedBy.flatMap((s) => s.match(BARE_ID) ?? []))].sort();
      expect([e.id, have]).toEqual([e.id, want]);
      for (const s of e.obtainedBy) expect(s).toMatch(/^[a-z]+:[a-z0-9_:]+$/); // `kind:token`
    }
  });
});

describe('each record is well formed', () => {
  test('codexLine: 1–40 words; category known; a Loop Timeline group; no Resonance, no onGrant (D-082)', () => {
    for (const e of echoes) {
      const words = wordCount(e.codexLine);
      expect([e.id, words >= 4 && words <= ECHO_CODEX_LINE_MAX_WORDS]).toEqual([e.id, true]);
      expect(ECHO_CATEGORIES).toContain(e.category);
      expect(e.timelineGroup).toMatch(/^[a-z_]+$/);
    }
    for (const e of Object.values(pack.echoes)) {
      expect(e.resonance).toBe(0);
      expect(e.onGrant).toEqual([]);
    }
  });

  test('the Echo catalog uses every category and every line is its own', () => {
    expect(new Set(echoes.map((e) => e.category))).toEqual(new Set(ECHO_CATEGORIES));
    expect(new Set(echoes.map((e) => e.codexLine)).size).toBeGreaterThan(90); // the five bonds and six "Witnessed" lines share a shape, not words
  });

  test('exclusiveWith is symmetric', () => {
    for (const e of Object.values(pack.echoes)) for (const o of e.exclusiveWith) expect([e.id, pack.echoes[o]?.exclusiveWith.includes(e.id)]).toEqual([e.id, true]);
  });

  test('requiredForEndings is exactly the endings whose requirements read the Echo', () => {
    const reads = (c: unknown, id: string): boolean => JSON.stringify(c).includes(`{"echo":"${id}"}`);
    for (const e of Object.values(pack.echoes)) {
      const want = Object.values(pack.endings).filter((end) => reads(end.requirements, e.id)).map((end) => end.id).sort();
      expect([e.id, [...e.requiredForEndings].sort()]).toEqual([e.id, want]);
    }
    expect(Object.values(pack.echoes).filter((e) => e.requiredForEndings.length > 0).map((e) => e.id).sort()).toEqual([
      'echo_anchor_mechanic',
      'echo_heartstone_resonance',
      'echo_iron_that_does_not_wish',
      'echo_litany_complete',
      'echo_void_resonance',
    ]);
  });
});

describe('the rest of the game names only catalog Echoes', () => {
  test('DESIGN §10.5: every Echo id in the mechanical-effects table is in the catalog', () => {
    const table = cut(DESIGN, '### 10.5 Echo effects', '**Retired DESIGN ids**'); // the retired ids that follow are not in the catalog
    const ids = new Set([...table.matchAll(/`(echo_[a-z0-9_]+)`/g)].map((m) => m[1] as string));
    expect(ids.size).toBeGreaterThan(60);
    // the two ranges ("verse_2 … verse_9", "ending_a … ending_f") are written with their end points only
    const missing = [...ids].filter((id) => pack.echoes[id] === undefined);
    expect(missing).toEqual([]);
  });

  test('the engine tables (rep starts, bonds, the Jailer sources, loop-end oaths) and ENGINE_GRANTED_ECHOES', () => {
    const named = [
      ...Object.keys(ECHO_REP_STARTS),
      ...Object.values(BOND_ECHOES),
      ...Object.keys(JAILER_SOURCES),
      ...Object.values(LOOP_END_REP_ECHOES),
      ...ENGINE_GRANTED_ECHOES,
    ];
    expect(named.length).toBeGreaterThan(30);
    expect(named.filter((id) => pack.echoes[id] === undefined)).toEqual([]);
  });

  test('every region file that names an Echo names a catalog one (no typos left to fix)', () => {
    const used = new Set<string>();
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const file = path.join(dir, name);
        if (fs.statSync(file).isDirectory()) walk(file);
        else if (file.endsWith('.ts')) for (const m of fs.readFileSync(file, 'utf8').matchAll(/\b(?:echo|grantEcho|echoHint):\s*'(echo_[a-z0-9_]+)'/g)) used.add(m[1] as string);
      }
    };
    walk(path.join(ROOT, 'src/content/regions'));
    expect(used.size).toBeGreaterThan(20);
    expect([...used].filter((id) => pack.echoes[id] === undefined)).toEqual([]);
  });
});

describe('D-097: `echo_sky_oath` is earned at the Ashen Cairns and spent at the Perch', () => {
  /** `[location, event]` of every location event that grants `id`. */
  const grantedAt = (id: string): string[][] =>
    Object.values(pack.locations).flatMap((loc) =>
      loc.events.filter((ev) => ev.effects.some((fx) => 'grantEcho' in fx && fx.grantEcho === id)).map((ev) => [loc.id, ev.id] as string[]),
    );

  test('the regions grant it once, at the Cairns, with the Talisman in the pack; the Perch only reads it', () => {
    const at = grantedAt('echo_sky_oath');
    expect(at).toHaveLength(1);
    const [locId, evId] = at[0] as string[];
    expect(evId).toBe('ev_cairns_strike');
    expect(pack.locations[locId as string]?.regionId).toBe('region_ashen_steppe');
    const ev = pack.locations[locId as string]?.events.find((x) => x.id === evId);
    expect(JSON.stringify(ev?.when)).toContain('item_sky_whisper_talisman');
    expect(grantedAt('echo_tyrant_never_struck').map((x) => x[0])).toEqual(['loc_stormcrowns_perch']);
    const perch = JSON.stringify(pack.locations.loc_stormcrowns_perch);
    expect(perch).toContain('echo_sky_oath');
    expect(perch).toContain('"loop":{"min":2}');
  });

  test('the Roost, one node before the Perch, already asks for it: a grant at the Perch could not serve both', () => {
    expect(JSON.stringify(pack.locations.loc_roost_of_sentinels)).toContain('echo_sky_oath');
    expect(pack.echoes.echo_sky_oath?.obtainedBy).toEqual(['event:ev_cairns_strike']);
    expect(pack.echoes.echo_sky_oath?.notes).toContain('D-097');
  });
});

// ---- Rule 16 -----------------------------------------------------------------------------------------------------------------

describe('rule 16 with the catalog in: what quests and dialogue will grant or read is pending while they are unauthored', () => {
  const grantedIds = (() => {
    const out = new Set<string>(ENGINE_GRANTED_ECHOES);
    const { echoes: _skip, ...rest } = pack;
    for (const m of JSON.stringify(rest).matchAll(/"grantEcho":"(echo_[a-z0-9_]+)"/g)) out.add(m[1] as string);
    for (const q of Object.values(pack.quests)) for (const id of q.rewards.echoes) out.add(id);
    return out;
  })();
  const ungranted = Object.keys(pack.echoes).filter((id) => !grantedIds.has(id)).sort();
  type Issue = { rule: string; id: string; message: string };
  const grants = (issues: readonly Issue[]): string[] => issues.filter((i) => i.rule === 'rule-16' && i.message.includes('no grantEcho effect')).map((i) => i.id).sort();
  const gates = (issues: readonly Issue[]): Issue[] => issues.filter((i) => i.rule === 'rule-16' && i.message.includes('gates nothing'));
  const PENDING = 'pending — content not yet authored: ';
  // U61: `codex_echoes` ("First Echo gained") reads every Echo of the catalog, so in the real pack nothing "gates nothing" any
  // more; the Echoes that only that entry reads are still worth seeing, so they are measured on a pack where it is unlocked at
  // the start instead
  const sansEchoesEntry = buildContentPack(
    { ...contentTables, codex: contentTables.codex.map((c) => (c.id === 'codex_echoes' ? { ...c, unlockWhen: undefined, unlockedAtStart: true } : c)) },
    { incompleteTables: INCOMPLETE_TABLES },
  );

  test('most of the catalog is granted by the engine or by region events; the rest waits for U52+ quests and dialogue', () => {
    expect(ungranted.length).toBeGreaterThan(0);
    expect(ungranted.length).toBeLessThan(103 - ENGINE_GRANTED_ECHOES.length);
    // the three "hold all of …" Echoes are derived by content: U52's Heartstone choice grants `echo_heartstone_triune` when the
    // three Heartstone Echoes are held; U58's ending offers grant `echo_litany_complete` (nine verses) and `echo_anchor_schema`
    // (both halves) on entry (D-100's gap)
    for (const id of ['echo_litany_complete', 'echo_anchor_schema', 'echo_heartstone_triune']) expect(ungranted).not.toContain(id);
  });

  test('the release gate (strict, pending): no errors; the ungranted Echoes and the Echoes nothing reads yet are pending warnings', () => {
    const r = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(grants(r.errors)).toEqual([]);
    expect(gates(r.errors)).toEqual([]);
    expect(grants(r.warnings)).toEqual(ungranted);
    expect(gates(r.warnings)).toEqual([]); // every Echo opens `codex_echoes`
    const probe = validateContent(sansEchoesEntry, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(gates(probe.warnings).length).toBeGreaterThan(0);
    for (const w of [...r.warnings, ...probe.warnings].filter((x) => x.rule === 'rule-16')) expect(w.message.startsWith(PENDING)).toBe(true);
  });

  test('the everyday build and a lenient run say nothing of them (a completeness check, like the counts)', () => {
    expect(parseContentPack().report.errors).toEqual([]);
    for (const r of [parseContentPack().report, validateContent(pack, { incompleteTables: INCOMPLETE_TABLES })]) {
      expect(r.warnings.filter((w) => w.rule === 'rule-16')).toEqual([]);
    }
  });

  test('once quests and dialogues are authored the ungranted are errors and the unread are plain warnings; an unrelated incomplete table does not relax them', () => {
    for (const incompleteTables of [[], ['items', 'npcs']] as const) {
      const r = validateContent(pack, { incompleteTables });
      expect(grants(r.errors)).toEqual(ungranted);
      expect(gates(r.warnings)).toEqual([]);
      const probe = validateContent(sansEchoesEntry, { incompleteTables });
      expect(gates(probe.warnings).length).toBeGreaterThan(0);
      for (const w of gates(probe.warnings)) expect(w.message.startsWith(PENDING)).toBe(false);
    }
    for (const incompleteTables of [['quests'], ['dialogues']] as const) {
      expect(grants(validateContent(pack, { strict: true, incompleteTables }).errors)).toEqual([]);
    }
  });
});
