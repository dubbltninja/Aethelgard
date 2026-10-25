// U51: the records around the loop — the three factions, the fifteen Attunements, the six challenge modifiers, the forty
// achievements, and the eight ending and closer records — against the documents, read at test time: BIBLE §6.3 (factions),
// DESIGN §10.7 / §15.1 / §15.2 (Attunements, modifiers, achievements), STORY §10 and §7.7 (endings and fates) and §4.2 /
// §10.7 (closers). The ending texts are held to be substrings of STORY's own, so U62 (the final ending scenes) starts from
// text the document owns. The Attunements and modifiers are held to the engine's own fixture (tests/fixtures/
// thresholdContent.ts) too, which the Threshold reducer tests drive. A last block runs the records through the engine:
// the ending slides, the closers' lead-ins, and a few achievement conditions evaluated on the real pack.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, parseContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { achievements } from '@content/shared/achievements';
import { attunements } from '@content/shared/attunements';
import { endings } from '@content/shared/endings';
import { factions } from '@content/shared/factions';
import { modifiers } from '@content/shared/modifiers';
import { ATTUNEMENT_IDS, validateContent } from '@content/validate';
import { CLOSER_TEXT, MODIFIER_RESONANCE_MULT, XP_BONUS_CAP, endingSlides, evaluate, type GameState } from '@engine/index';
import { CHECKPOINTS } from '@schema/achievement';
import type { Condition } from '@schema/condition';
import { ENDING_LETTERS, FallReason } from '@schema/ending';
import { ENGINE_WRITTEN_FLAGS } from '@schema/flags';
import { REQUIRED_MODIFIERS } from '@schema/modifier';
import { factionRemnants } from '@tests/unit/content/examples';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { thresholdAttunements, thresholdModifiers } from '@tests/fixtures/thresholdContent';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const STORY = read('docs/STORY.md');
const DESIGN = read('docs/DESIGN.md');
const BIBLE = read('docs/BIBLE.md');
const pack = buildContentPack();

const cut = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start + from.length);
  expect(start, from).toBeGreaterThanOrEqual(0);
  expect(end, to).toBeGreaterThan(start);
  return text.slice(start, end);
};
const cells = (line: string): string[] => line.split('|').slice(1, -1).map((c) => c.trim());
const tableRows = (text: string, first: RegExp): string[][] => text.split('\n').filter((l) => l.startsWith('|')).map(cells).filter((c) => first.test(c[0] ?? ''));
const plain = (s: string): string => s.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
/** For "is this text STORY's?": no markup, one line, lower case. */
const norm = (s: string): string => s.replace(/[*_]/g, '').replace(/\s+/g, ' ').toLowerCase().trim();
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// ---- Factions (BIBLE §6.3) ---------------------------------------------------------------------------------------------------

describe('factions', () => {
  const table = cut(BIBLE, '### 6.3 Factions', '## 7. Terminology');
  const bible = tableRows(table, /^(Remnants|Shadow|Ironclad)/);

  test('three records, named as BIBLE §6.3 names them', () => {
    expect(bible).toHaveLength(3);
    expect(factions.map((f) => f.id)).toEqual(['remnants', 'weavers', 'ironclad']);
    for (const f of factions) {
      const row = bible.find((r) => (r[2] ?? '').includes(`\`${f.id}\``)) as string[];
      expect(row, f.id).toBeDefined();
      expect(f.name).toBe(row[0] as string);
      // "the Remnants" → "Remnants"; "the Ironclad / Nomads" → "Ironclad"
      expect(f.shortName).toBe(((row[1] as string).split('/')[0] as string).trim().replace(/^the /, ''));
    }
    expect(Object.keys(pack.factions).sort()).toEqual(['ironclad', 'remnants', 'weavers']);
  });

  test('five tier lines each, distinct, in the faction colour; the Remnants lines are the DESIGN example', () => {
    const colours = new Set<string>();
    const lines = new Set<string>();
    for (const f of Object.values(pack.factions)) {
      expect(Object.keys(f.tierTexts).sort()).toEqual(['hostile', 'neutral', 'sworn', 'trusted', 'wary']);
      for (const t of Object.values(f.tierTexts)) {
        expect(t.length).toBeGreaterThan(10);
        lines.add(t);
      }
      expect(f.color).toMatch(/^#[0-9a-f]{6}$/i);
      colours.add(f.color);
      expect(f.description.length).toBeGreaterThan(60);
    }
    expect(colours.size).toBe(3);
    expect(lines.size).toBe(15);
    expect(pack.factions.remnants?.tierTexts).toEqual(factionRemnants.tierTexts);
    expect(pack.factions.remnants?.color).toBe(factionRemnants.color);
  });

  test("the tier boundaries BIBLE quotes are the game's (GameConfig)", () => {
    expect(table).toContain('Hostile ≤ −40 · Wary −39..−10 · Neutral −9..19 · Trusted 20..59 · Sworn ≥ 60');
    expect(pack.config.repTiers).toEqual({ hostile: -100, wary: -39, neutral: -9, trusted: 20, sworn: 60 });
  });
});

// ---- Attunements (DESIGN §10.7) ----------------------------------------------------------------------------------------------

describe('attunements', () => {
  const section = cut(DESIGN, '### 10.7 Attunements (15)', '### 10.8');
  const design = tableRows(section, /^`att_/);

  test('fifteen, in DESIGN order, with its names and costs (the rows add up to 430)', () => {
    expect(design).toHaveLength(15);
    expect(attunements.map((a) => a.id)).toEqual(design.map((r) => plain(r[0] as string)));
    expect(attunements.map((a) => a.id)).toEqual([...ATTUNEMENT_IDS]);
    for (const [i, a] of attunements.entries()) {
      expect([a.id, a.name, a.cost]).toEqual([a.id, (design[i] as string[])[1] as string, Number((design[i] as string[])[2])]);
      expect(a.icon).toBe(a.id.slice(4));
    }
    // DESIGN's prose says "Total cost of all fifteen: 440", but its own rows add up to 430 (found by this test, U51); the rows are
    // the numbers (D-062: DESIGN owns them; the engine fixture, tests/fixtures/thresholdContent.ts, uses the same rows)
    const stated = Number((section.match(/Total cost of all fifteen: (\d+)/) as RegExpMatchArray)[1]);
    const rowTotal = design.reduce((n, r) => n + Number(r[2]), 0);
    expect(rowTotal).toBe(430);
    expect([430, 440]).toContain(stated);
    expect(attunements.reduce((n, a) => n + a.cost, 0)).toBe(rowTotal);
    expect(Object.keys(pack.attunements)).toHaveLength(15);
  });

  test("the effects are the engine's own fixture (the shapes the Threshold reducer tests drive)", () => {
    expect(thresholdAttunements).toHaveLength(15);
    for (const a of attunements) {
      const f = thresholdAttunements.find((x) => x.id === a.id);
      expect([a.id, a.effects]).toEqual([a.id, f?.effects]);
      expect([a.id, 'requires' in a ? a.requires : undefined]).toEqual([a.id, f?.requires]);
    }
  });

  test('Steady Hours is a day (4 watches) and needs the Breach Clock; the HP, MP and XP caps hold', () => {
    const hours = pack.attunements.att_steady_hours;
    expect(hours?.effects).toEqual([{ kind: 'clock_watches', watches: 4 }]);
    expect(hours?.requires).toEqual({ echo: 'echo_breach_clock' });
    expect(pack.echoes.echo_breach_clock).toBeDefined();
    const sum = (kind: string): number =>
      Object.values(pack.attunements)
        .flatMap((a) => a.effects)
        .reduce((n, e) => n + (e.kind === kind ? (e as { pct: number }).pct : 0), 0);
    expect(sum('hp_max_pct')).toBeCloseTo(0.05);
    expect(sum('mp_max_pct')).toBeCloseTo(0.05);
    expect(sum('xp_pct')).toBeLessThanOrEqual(XP_BONUS_CAP);
  });
});

// ---- Modifiers (DESIGN §15.1) ------------------------------------------------------------------------------------------------

describe('modifiers', () => {
  const design = tableRows(cut(DESIGN, '### 15.1 Challenge modifiers', '### 15.2 Achievements'), /^`mod_/);

  test("six, as DESIGN §15.1 names them, with the engine's multipliers and the fixture's rules", () => {
    expect(design).toHaveLength(6);
    expect(modifiers.map((m) => m.id)).toEqual(design.map((r) => plain(r[0] as string)));
    expect(modifiers.map((m) => m.id)).toEqual([...REQUIRED_MODIFIERS]);
    for (const [i, m] of modifiers.entries()) {
      const row = design[i] as string[];
      expect([m.id, m.name]).toEqual([m.id, row[1] as string]);
      expect([m.id, MODIFIER_RESONANCE_MULT[m.id]]).toEqual([m.id, Number((row[3] as string).replace('×', ''))]);
      expect([m.id, m.rules]).toEqual([m.id, thresholdModifiers.find((x) => x.id === m.id)?.rules]);
      expect(m.icon).toBe(m.id.slice(4));
    }
  });

  test('the achievement a modifier is recorded on exists and names the modifier (DESIGN: "recorded … on achievements that require them")', () => {
    expect(Object.fromEntries(modifiers.filter((m) => m.achievementId).map((m) => [m.id, m.achievementId]))).toEqual({
      mod_iron_loop: 'ach_iron_frayed',
      mod_frayed_clock: 'ach_iron_frayed',
      mod_glass: 'ach_glass_boss',
      mod_pacifist: 'ach_pacifist_loop',
    });
    for (const m of Object.values(pack.modifiers)) {
      if (m.achievementId === undefined) continue;
      expect(JSON.stringify(pack.achievements[m.achievementId]?.when)).toContain(`"modifier":"${m.id}"`);
    }
  });
});

// ---- Achievements (DESIGN §15.2) ---------------------------------------------------------------------------------------------

describe('achievements', () => {
  const rows = tableRows(cut(DESIGN, '### 15.2 Achievements (40)', '(Three "Sworn" ids'), /^`ach_/);
  /** `[id, name, hidden]` with the Sworn row (three ids sharing one) expanded. */
  const design: [string, string, boolean][] = rows.flatMap((r) => {
    const ids = [...(r[0] as string).matchAll(/`(ach_[a-z0-9_]+)`/g)].map((m) => m[1] as string);
    return ids.map((id) => [id, ids.length > 1 ? `Sworn to ${id.slice('ach_sworn_'.length)}` : (r[1] as string), (r[3] as string) === 'yes'] as [string, string, boolean]);
  });

  test('forty: the ids, names and hidden marks of DESIGN §15.2', () => {
    expect(design).toHaveLength(40);
    expect(achievements).toHaveLength(40);
    expect(achievements.map((a) => a.id)).toEqual(design.map((d) => d[0]));
    for (const a of achievements) {
      const d = design.find((x) => x[0] === a.id) as [string, string, boolean];
      if (a.id.startsWith('ach_sworn_')) expect(a.name.startsWith('Sworn to the ')).toBe(true);
      else expect([a.id, a.name]).toEqual([a.id, d[1]]);
      expect([a.id, a.hidden ?? false]).toEqual([a.id, d[2]]);
      expect(a.icon).toBe(a.id.slice(4));
      expect(a.description.length).toBeGreaterThan(8);
    }
    expect(achievements.filter((a) => a.hidden).length).toBe(design.filter((d) => d[2]).length);
  });

  test("none pays Resonance (DESIGN §10.6 lists no such source); checkpoints are the engine's", () => {
    for (const a of Object.values(pack.achievements)) {
      expect(a.resonance).toBe(0);
      for (const c of a.checkpoints) expect(CHECKPOINTS).toContain(c);
    }
  });

  test('every id a condition names exists: Echoes, modifiers, locations, factions, companions, engine flags and counters', () => {
    const atoms = (c: Condition): Condition[] => {
      if ('all' in c) return c.all.flatMap(atoms);
      if ('any' in c) return c.any.flatMap(atoms);
      if ('not' in c) return atoms(c.not);
      return [c];
    };
    const all = achievements.flatMap((a) => atoms(a.when as Condition));
    const tallies = new Set<string>();
    for (const c of all) {
      if ('echo' in c) expect([c.echo, pack.echoes[c.echo] !== undefined]).toEqual([c.echo, true]);
      if ('modifier' in c) expect(pack.modifiers[c.modifier]).toBeDefined();
      if ('location' in c) expect(pack.locations[c.location]).toBeDefined();
      if ('rep' in c) expect(pack.factions[c.rep.faction]).toBeDefined();
      if ('quest' in c) expect(STORY).toContain(`#### \`${c.quest.id}\``);
      if ('flag' in c) {
        // set by the engine, or by content that a later unit authors (`flag_named_nyx`, `flag_corruption_cleansed`)
        expect(ENGINE_WRITTEN_FLAGS.includes(c.flag) || ['flag_named_nyx', 'flag_corruption_cleansed'].includes(c.flag)).toBe(true);
      }
      if ('counter' in c) {
        if (c.counter.name === 'quests_completed') continue;
        expect(c.counter.name).toMatch(/^tally_[a-z_]+$/);
        tallies.add(c.counter.name);
      }
    }
    // the header of achievements.ts lists every tally the achievement engine must keep, and no other
    const header = read('src/content/shared/achievements.ts').split('\n').filter((l) => /^\/\/ {3}tally_/.test(l));
    expect(header.map((l) => (l.match(/tally_[a-z_]+/) as RegExpMatchArray)[0]).sort()).toEqual([...tallies].sort());
  });

  test('the ending achievements read the "Witnessed" Echo of their ending; Every Door reads all six', () => {
    const byLetter: Record<string, string> = { a: 'ach_vigil', b: 'ach_mending', c: 'ach_weavers_dawn', d: 'ach_iron_silence', e: 'ach_long_archive', f: 'ach_unbound' };
    for (const [l, id] of Object.entries(byLetter)) {
      expect(pack.achievements[id]?.when).toEqual({ echo: `echo_ending_${l}` });
      expect(pack.achievements[id]?.checkpoints).toEqual(['ending']);
    }
    expect(pack.achievements.ach_all_endings?.when).toEqual({ all: Object.keys(byLetter).map((l) => ({ echo: `echo_ending_${l}` })) });
  });

  // evaluated by the engine on the real pack
  const at = (o: Parameters<typeof makeState>[0] = {}, p = freshProfile()): { s: GameState; hold: (id: string) => boolean } => {
    const s = makeState(o, { content: pack, profile: p });
    return { s, hold: (id) => evaluate(pack.achievements[id]?.when as Condition, s, p, pack) };
  };

  test('First Steps: true once the Wayfinder is anywhere but the Ruins', () => {
    expect(at().hold('ach_first_steps')).toBe(false);
    expect(at({ locationId: 'loc_shattered_library' }).hold('ach_first_steps')).toBe(true);
  });

  test('Two Oaths needs two factions at 60; one is not enough; Sworn reads 60', () => {
    expect(at({ reputation: { remnants: 60 } }).hold('ach_two_oaths')).toBe(false);
    expect(at({ reputation: { remnants: 60, weavers: 59 } }).hold('ach_two_oaths')).toBe(false);
    expect(at({ reputation: { weavers: 60, ironclad: 75 } }).hold('ach_two_oaths')).toBe(true);
    expect(at({ reputation: { ironclad: 60 } }).hold('ach_sworn_ironclad')).toBe(true);
    expect(at({ reputation: { ironclad: 59 } }).hold('ach_sworn_ironclad')).toBe(false);
  });

  test('Day One, Again, Marked, The Anchor, The Thirtieth Dawn, Glass Cannon', () => {
    expect(at({ loop: 1 }).hold('ach_loop_two')).toBe(false);
    expect(at({ loop: 2 }, freshProfile({ loopCounter: 2 })).hold('ach_loop_two')).toBe(true);
    expect(at({ corruption: 5 }).hold('ach_corrupted')).toBe(false);
    expect(at({ corruption: 6 }).hold('ach_corrupted')).toBe(true);
    expect(at({ flags: { flag_clock_expired: true } }).hold('ach_the_fall')).toBe(true);
    expect(at().hold('ach_the_fall')).toBe(false);
    expect(at({ flags: { flag_tyrant_dead: true } }).hold('ach_glass_boss')).toBe(false);
    expect(at({ flags: { flag_tyrant_dead: true }, patch: (s) => void s.meta.modifiers.push('mod_glass') }).hold('ach_glass_boss')).toBe(true);
  });

  test('the endings: the Echo makes the achievement; Before the Tenth Dawn also needs Day 10; Bare and Hurried needs both modifiers', () => {
    const withEnding = freshProfile({ echoes: ['echo_ending_b'] });
    expect(at({}, withEnding).hold('ach_mending')).toBe(true);
    expect(at({}, withEnding).hold('ach_vigil')).toBe(false);
    expect(at({ day: 10 }, withEnding).hold('ach_speedrun')).toBe(true);
    expect(at({ day: 11 }, withEnding).hold('ach_speedrun')).toBe(false);
    expect(at({ day: 3 }).hold('ach_speedrun')).toBe(false); // a closer, no ending yet
    const both = (s: GameState): void => void s.meta.modifiers.push('mod_iron_loop', 'mod_frayed_clock');
    expect(at({ patch: both }, withEnding).hold('ach_iron_frayed')).toBe(true);
    expect(at({ patch: both }).hold('ach_iron_frayed')).toBe(false);
    expect(at({}, withEnding).hold('ach_iron_frayed')).toBe(false);
  });

  test('A Bond Kept: any companion at loyalty 100', () => {
    const recruit = (id: string, loyalty: number) => (s: GameState): void => {
      s.companions.recruited[id] = { id, recruited: true, loyalty, hp: 10, hpMax: 10, ko: false, dead: false, stance: 'support', cooldowns: {}, waitingAt: null, arcFlags: {} };
    };
    expect(at({ patch: recruit('nyx', 99) }).hold('ach_bond_any')).toBe(false);
    expect(at({ patch: recruit('nyx', 100) }).hold('ach_bond_any')).toBe(true);
    expect(at().hold('ach_bond_any')).toBe(false);
  });
});

// ---- Endings and closers (STORY §10, §7.7, §4.2) -----------------------------------------------------------------------------

describe('endings', () => {
  const END_SECTION = cut(STORY, '## 10. Endings', '## 11. Quest catalog');
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
  const storySection = (letter: string): string => {
    const index = letters.indexOf(letter as (typeof letters)[number]);
    const start = END_SECTION.indexOf(`### 10.${index + 1} `);
    const end = END_SECTION.indexOf('### 10.', start + 5);
    return END_SECTION.slice(start, end);
  };
  const trueEndings = endings.filter((e) => e.kind === 'true');
  const closers = endings.filter((e) => e.kind === 'closer');

  /** STORY writes the requirements as a JS-ish object literal in a fenced block; read it as JSON. */
  const storyRequirements = (letter: string): unknown => {
    const block = (storySection(letter).match(/\*\*Requirements\.\*\*\n```\n([\s\S]*?)\n```/) as RegExpMatchArray)[1] as string;
    return JSON.parse(block.replace(/([{,]\s*)([A-Za-z_]+)(\s*:)/g, '$1"$2"$3'));
  };

  test('eight records: the six true endings of STORY §10 (letter, id, name) and the two closers', () => {
    expect(endings).toHaveLength(8);
    expect(Object.keys(pack.endings).sort()).toEqual([...Object.values(ENDING_LETTERS), 'closer_escape', 'closer_fall'].sort());
    for (const l of letters) {
      const e = trueEndings.find((x) => x.letter === l) as (typeof trueEndings)[number];
      const heading = storySection(l).split('\n')[0] as string;
      expect(heading).toBe(`### 10.${letters.indexOf(l) + 1} \`${e.id}\` — ${l} · ${e.name}${l === 'B' ? ' (true ending)' : ''}`);
      expect(e.id).toBe(ENDING_LETTERS[l]);
      expect(e.credits).toBe(true);
    }
    expect(closers.map((c) => c.id)).toEqual(['closer_escape', 'closer_fall']);
    for (const c of closers) expect([c.requirements, c.letter, c.credits ?? false]).toEqual([{ all: [] }, undefined, false]);
  });

  test("each true ending's requirements are STORY §10's, atom for atom", () => {
    for (const e of trueEndings) expect([e.id, e.requirements]).toEqual([e.id, storyRequirements(e.letter as string)]);
  });

  test('each "what you still need" line is the negation of one requirement, and each requirement has one', () => {
    for (const e of trueEndings) {
      const atoms = (e.requirements as { all: Condition[] }).all;
      const texts = e.requirementTexts ?? [];
      expect(texts.length, e.id).toBe(atoms.length);
      for (const t of texts) {
        const w = t.when as Condition;
        const explained =
          'not' in w ? atoms.some((a) => same(a, w.not)) : atoms.some((a) => same(a, { not: w })) || atoms.some((a) => 'any' in a && a.any.some((x) => same(x, { not: w })));
        expect([e.id, t.text, explained]).toEqual([e.id, t.text, true]);
        expect(t.text.length).toBeGreaterThan(10);
      }
      for (const a of atoms) {
        const covered = texts.some((t) => {
          const w = t.when as Condition;
          return same(w, { not: a }) || ('not' in a && same(w, a.not)) || ('any' in a && a.any.some((x) => 'not' in x && same(w, x.not)));
        });
        expect([e.id, JSON.stringify(a), covered]).toEqual([e.id, JSON.stringify(a), true]);
      }
    }
  });

  test('the sequences and epilogues are STORY §10 text, word for word; the tag line is its "Tone"', () => {
    for (const e of trueEndings) {
      const section = norm(storySection(e.letter as string));
      for (const s of e.sequence) expect([e.id, s.text, section.includes(norm(s.text))]).toEqual([e.id, s.text, true]);
      for (const ep of e.epilogues ?? []) {
        // the companion fates are held to the §7.7 table below
        if (['world', 'remnants', 'weavers', 'ironclad', 'wayfinder', 'factions'].includes(ep.subject)) {
          expect([e.id, ep.text, section.includes(norm(ep.text))]).toEqual([e.id, ep.text, true]);
        }
      }
      const tone = (storySection(e.letter as string).match(/\*\*Tone:\*\* ([^\n]+)/) as RegExpMatchArray)[1] as string;
      expect(norm(e.tagline)).toBe(norm(tone));
    }
  });

  test('the companion fates are the §7.7 table: one line per companion, shown for a companion recruited this loop', () => {
    const table = tableRows(cut(STORY, '### 7.7 Companion × ending', '\n---'), /^\*\*/);
    expect(table).toHaveLength(7);
    const names: Record<string, string> = { Ilyra: 'ilyra', Brak: 'brak', Nyx: 'nyx', Dask: 'dask', Mireya: 'mireya', Caelum: 'caelum', 'Kaelen / Borin': 'kaelen_borin' };
    for (const row of table) {
      const name = plain(row[0] as string);
      const subject = names[name] as string;
      for (const [i, l] of letters.entries()) {
        const e = trueEndings.find((x) => x.letter === l) as (typeof trueEndings)[number];
        const cell = plain((row[i + 1] as string).replace(/\s*\([^)]*\)/g, '')); // "(he was at your shoulder …)" is a stage direction
        const have = (e.epilogues ?? []).filter((x) => x.subject === subject);
        const label = name === 'Kaelen / Borin' ? 'Kaelen and Borin' : name;
        if (cell === 'One line each.') {
          expect([e.id, subject, have]).toEqual([e.id, subject, []]);
        } else if (name === 'Dask' && l === 'B') {
          expect(have.map((x) => x.text)).toEqual(['Dask: Fades with the Breach, content.', 'Dask: Rests.']);
          expect(have.map((x) => JSON.stringify(x.when))).toEqual([
            JSON.stringify({ all: [{ companion: { id: 'dask', state: 'recruited' } }, { not: { echo: 'echo_dask_rest' } }] }),
            JSON.stringify({ all: [{ companion: { id: 'dask', state: 'recruited' } }, { echo: 'echo_dask_rest' }] }),
          ]);
        } else {
          expect([e.id, subject, have.map((x) => x.text)]).toEqual([e.id, subject, [`${label}: ${cell}`]]);
          expect(have[0]?.when).toEqual(subject === 'kaelen_borin' ? undefined : { companion: { id: subject, state: 'recruited' } });
        }
      }
    }
  });

  test('each true ending pays the DESIGN §15.2 achievement of its letter; Resonance is the config default (50)', () => {
    expect(Object.fromEntries(trueEndings.map((e) => [e.letter, e.achievementId]))).toEqual({
      A: 'ach_vigil',
      B: 'ach_mending',
      C: 'ach_weavers_dawn',
      D: 'ach_iron_silence',
      E: 'ach_long_archive',
      F: 'ach_unbound',
    });
    for (const e of Object.values(pack.endings)) {
      expect(e.resonance).toBe(0);
      if (e.achievementId !== undefined) expect(pack.achievements[e.achievementId]).toBeDefined();
    }
    expect(pack.config.resonance.ending).toBe(50);
    expect(pack.config.resonance.closer).toBe(10);
    expect(closers.find((c) => c.id === 'closer_escape')?.achievementId).toBe('ach_the_escape');
    expect(closers.find((c) => c.id === 'closer_fall')?.achievementId).toBeUndefined(); // The Thirtieth Dawn is the clock running out, not every Fall
  });

  test('the closers: STORY §4.2 / §10.7 text and the four Fall reasons', () => {
    const escape = pack.endings.closer_escape;
    const fall = pack.endings.closer_fall;
    expect(escape?.sequence.map((s) => s.text)).toEqual([CLOSER_TEXT.lastThreshold, CLOSER_TEXT.shear]);
    expect(escape?.epilogues.map((x) => x.text)).toEqual([CLOSER_TEXT.shearUntouched]);
    expect(fall?.sequence.map((s) => s.text)).toEqual([CLOSER_TEXT.shear]);
    expect(fall?.reasons).toEqual(['death', 'expiry', 'rejected', 'released']);
    expect([...FallReason.options]).toEqual(fall?.reasons);
    expect(escape?.reasons).toEqual([]);
    const closers = cut(END_SECTION, '### 10.7 Loop-closers', '---');
    for (const r of fall?.reasons ?? []) expect(closers).toContain(`\`${r}\``);
    expect(norm(closers)).toContain(norm('The Still Shore: grey water, no horizon, a far light.'));
    expect(fall?.tagline).toBe('The Still Shore: grey water, no horizon, a far light.');
  });

  // ---- through the engine ----

  const slidesFor = (outcome: 'closer_escape' | 'closer_fall' | string, o: { reason?: 'death' | 'expiry' | 'rejected' | 'released'; flags?: Record<string, boolean>; companions?: string[] } = {}): string[] => {
    const s = makeState({ mode: 'ending', flags: o.flags, patch: (st) => {
      st.pendingEnding = { outcome, ...(o.reason === undefined ? {} : { reason: o.reason }), slideIndex: 0 } as never;
      for (const id of o.companions ?? []) {
        st.companions.recruited[id] = { id, recruited: true, loyalty: 50, hp: 10, hpMax: 10, ko: false, dead: false, stance: 'support', cooldowns: {}, waitingAt: null, arcFlags: {} };
      }
    } }, { content: pack });
    return endingSlides(s, pack, freshProfile());
  };

  test('closer_fall: the reason lead-in (the engine) then the shear; the thirtieth-dawn line follows when the Tyrant lives', () => {
    for (const reason of ['death', 'rejected', 'released'] as const) {
      expect(slidesFor('closer_fall', { reason })).toEqual([CLOSER_TEXT.fall[reason], CLOSER_TEXT.shear]);
    }
    expect(slidesFor('closer_fall', { reason: 'expiry', flags: { flag_clock_expired: true } })).toEqual([CLOSER_TEXT.fall.expiry, CLOSER_TEXT.shear, CLOSER_TEXT.shearUntouched]);
    expect(slidesFor('closer_fall', { reason: 'expiry', flags: { flag_clock_expired: true, flag_tyrant_dead: true } })).toEqual([CLOSER_TEXT.fall.expiry, CLOSER_TEXT.shear]);
  });

  test('closer_escape: the Last Threshold paragraph, the shear, and "It happened anyway" only after a clock expiry with the Tyrant alive', () => {
    expect(slidesFor('closer_escape')).toEqual([CLOSER_TEXT.lastThreshold, CLOSER_TEXT.shear]);
    expect(slidesFor('closer_escape', { flags: { flag_clock_expired: true } })).toEqual([CLOSER_TEXT.lastThreshold, CLOSER_TEXT.shear, CLOSER_TEXT.shearUntouched]);
  });

  test("a true ending: its sequence, the world's epilogues, and the fate of each companion recruited this loop only", () => {
    const def = pack.endings.ending_wardens_vigil;
    const bare = slidesFor('ending_wardens_vigil');
    expect(bare.slice(0, def?.sequence.length)).toEqual(def?.sequence.map((x) => x.text));
    expect(bare.some((t) => t.startsWith('Ilyra:'))).toBe(false);
    expect(bare).toContain('Kaelen and Borin: Trade and forge; the Respite stays neutral.');
    const company = slidesFor('ending_wardens_vigil', { companions: ['ilyra', 'nyx'] });
    expect(company.filter((t) => /^(Ilyra|Brak|Nyx|Dask|Mireya|Caelum):/.test(t))).toEqual([
      'Ilyra: Writes the eighth name in the Ledger; never tears another portal.',
      'Nyx: Weeps once, at the Chasm, where no one sees. Leads the Choir honestly.',
    ]);
  });

  test('rule 15: every ending has its { ending } effect — A, B and F in the Tyrant\'s communion outcomes, C, D and E in their quests\' scenes (U58)', () => {
    type Issue = { rule: string; id: string; message: string };
    const reach = (issues: readonly Issue[]): string[] => issues.filter((i) => i.rule === 'rule-15' && i.message.includes('effect anywhere')).map((i) => i.id).sort();
    const gate = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(reach(gate.errors)).toEqual([]);
    expect(reach(gate.warnings)).toEqual([]);
    expect(reach(parseContentPack().report.warnings)).toEqual([]);
    expect(reach(validateContent(pack, { incompleteTables: [] }).errors)).toEqual([]);
    // the three that arrive with their quests' scenes (U58): the Weaver's Dawn's second wave, the Iron Silence's "Now.", the Archive's choice
    const scenes = Object.values(pack.dialogues).flatMap((s) => s.nodes.flatMap((n) => n.choices.flatMap((c) => c.effects.flatMap((e) => ('ending' in e ? [e.ending] : [])))));
    expect(scenes).toContain('ending_iron_silence');
    expect(scenes).toContain('ending_long_archive');
    expect(Object.values(pack.encounters).flatMap((e) => e.onVictory.flatMap((x) => ('ending' in x ? [x.ending] : [])))).toEqual(['ending_weavers_dawn']);
  });
});

describe('the six tables are done', () => {
  test('off INCOMPLETE_TABLES, in the real pack, with the counts of rule 21', () => {
    for (const t of ['echoes', 'achievements', 'attunements', 'modifiers', 'endings', 'factions'] as const) expect(INCOMPLETE_TABLES).not.toContain(t);
    expect(Object.keys(pack.echoes)).toHaveLength(103);
    expect(Object.keys(pack.achievements)).toHaveLength(40);
    expect(Object.keys(pack.attunements)).toHaveLength(15);
    expect(Object.keys(pack.modifiers)).toHaveLength(6);
    expect(Object.keys(pack.endings)).toHaveLength(8);
    expect(Object.keys(pack.factions)).toHaveLength(3);
    const { report } = parseContentPack();
    expect(report.errors).toEqual([]);
    expect(report.warnings.filter((w) => w.rule === 'rule-21' && /echoes|achievements|attunements|endings|factions/.test(w.message))).toEqual([]);
  });
});
