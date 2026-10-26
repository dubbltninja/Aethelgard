// U62b: the eight endings' text (U62, ✦ Fable) against STORY §10 and §10.7, read at test time. The slides keep STORY's words
// verbatim where STORY gives them and join them in the house voice, so the test holds what STORY owns: every quoted line on a
// slide is STORY's, every quoted line of a numbered step is said (on a slide, or by the ending's scene), each step has a slide,
// the world / faction / Wayfinder epilogues are STORY's word for word, the tag line is the "Tone". Every slide shows a painting
// (docs/ART.md §5: `public/art/scenes/<locationId>.webp`), and every mood is one of the dialogue moods.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { endings } from '@content/shared/endings';
import { Mood } from '@schema/dialogue';
import { ENDING_LETTERS } from '@schema/ending';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');
const PAINTED = new Set(
  fs
    .readdirSync(path.join(ROOT, 'public/art/scenes'))
    .map((f) => /^(loc_[a-z0-9_]+)\.webp$/.exec(f)?.[1])
    .filter((id): id is string => id !== undefined),
);
const pack = buildContentPack();

/** No markup, curly quotes straightened, one line, lower case. */
const norm = (s: string): string =>
  s
    .replace(/[*_`]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
/** The double-quoted spans of a text (the speech STORY gives verbatim). */
const quotes = (s: string): string[] => [...norm(s).matchAll(/"([^"]+)"/g)].map((m) => (m[1] as string).replace(/[,.]$/, '').trim()).filter((q) => q.length > 0);

const END = (() => {
  const from = STORY.indexOf('## 10. Endings');
  return STORY.slice(from, STORY.indexOf('## 11. Quest catalog', from));
})();
const section = (letter: string): string => {
  const id = ENDING_LETTERS[letter as keyof typeof ENDING_LETTERS];
  const from = END.indexOf(`\`${id}\` — ${letter} ·`);
  expect(from, id).toBeGreaterThan(0);
  const next = END.indexOf('\n### ', from);
  return END.slice(from, next < 0 ? undefined : next);
};
/** The numbered steps of a section's "Final sequence", each joined onto one line. */
const steps = (letter: string): string[] => {
  const s = section(letter);
  const body = s.slice(s.indexOf('**Final sequence.**'), s.indexOf('**Epilogue slides.**'));
  return body
    .split(/\n(?=\d+\. )/)
    .slice(1)
    .map((x) => x.replace(/\s+/g, ' ').trim());
};

const trueEndings = endings.filter((e) => e.kind === 'true');
/** Everything the scenes say, their companion reactions too (STORY §10.2's step-1 lines are `scene_ending_mending`'s, dialogues/endings.ts). */
const sceneTexts = norm(
  Object.values(pack.dialogues)
    .flatMap((d) => [...(d?.nodes.flatMap((n) => [n.text, ...n.textVariants.map((v) => v.text)]) ?? []), ...(d?.companionReactions.map((r) => r.text) ?? [])])
    .join(' \n '),
);

describe('the endings’ text (STORY §10, read at test time)', () => {
  test('six true endings and two closers, one record each', () => {
    expect(trueEndings.map((e) => e.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(endings.filter((e) => e.kind === 'closer').map((e) => e.id)).toEqual(['closer_escape', 'closer_fall']);
  });

  test('every quoted line on a slide is STORY’s own words', () => {
    for (const e of trueEndings) {
      const story = norm(section(e.letter as string));
      for (const s of e.sequence) for (const q of quotes(s.text)) expect([e.id, q, story.includes(q)]).toEqual([e.id, q, true]);
    }
  });

  test('each numbered step has a slide, and every line a step quotes is said: on a slide, or by the ending’s scene', () => {
    for (const e of trueEndings) {
      const list = steps(e.letter as string);
      expect([e.id, list.length > 0]).toEqual([e.id, true]);
      expect([e.id, e.sequence.length >= list.length]).toEqual([e.id, true]);
      const slides = norm(e.sequence.map((s) => s.text).join(' \n '));
      for (const step of list) for (const q of quotes(step)) expect([e.id, q, slides.includes(q) || sceneTexts.includes(q)]).toEqual([e.id, q, true]);
    }
  });

  test('the world, faction and Wayfinder epilogues are STORY’s, word for word; the tag line is its "Tone"', () => {
    for (const e of trueEndings) {
      const s = section(e.letter as string);
      const story = norm(s);
      const subjects = (e.epilogues ?? []).map((x) => x.subject);
      for (const want of ['world', 'remnants', 'weavers', 'ironclad', 'wayfinder']) expect([e.id, want, subjects.includes(want)]).toEqual([e.id, want, true]);
      for (const ep of e.epilogues ?? []) {
        if (!['world', 'remnants', 'weavers', 'ironclad', 'wayfinder'].includes(ep.subject)) continue;
        // "World: …" is the label STORY gives; the words after it are STORY's (C's three factions share its one line)
        const words = norm(ep.text.replace(/^[A-Za-z]+: /, ''));
        expect([e.id, ep.subject, story.includes(words) || story.includes(words.replace(/^"|"$/g, ''))]).toEqual([e.id, ep.subject, true]);
      }
      const tone = (s.match(/\*\*Tone:\*\* ([^\n]+)/) as RegExpMatchArray)[1] as string;
      expect(norm(e.tagline)).toBe(norm(tone));
    }
  });

  test('the last slide of each sequence is STORY’s last step (its Slide: line, where it has one)', () => {
    for (const e of trueEndings) {
      const list = steps(e.letter as string);
      const last = list.at(-1) as string;
      const lastSlide = norm((e.sequence.at(-1) as { text: string }).text);
      const quoted = quotes(last);
      if (quoted.length > 0) for (const q of quoted) expect([e.id, q, lastSlide.includes(q)]).toEqual([e.id, q, true]);
      else expect([e.id, lastSlide.length > 20]).toEqual([e.id, true]);
    }
  });

  test('every slide shows a painting: its `art` is a location id with a picture in public/art/scenes (ART §5); moods are dialogue moods', () => {
    expect(PAINTED.size).toBeGreaterThan(60);
    for (const e of endings) {
      for (const [i, s] of e.sequence.entries()) {
        expect([e.id, i, typeof s.art]).toEqual([e.id, i, 'string']);
        expect([e.id, i, s.art, pack.locations[s.art as string] !== undefined, PAINTED.has(s.art as string)]).toEqual([e.id, i, s.art, true, true]);
        if (s.mood !== undefined) expect([e.id, i, Mood.options.includes(s.mood as never)]).toEqual([e.id, i, true]);
      }
    }
  });

  test('Mireya’s fen (STORY §12 `echo_glowfen_dammed` / `_let_run`): in A and F a chosen-fen line beside §7.7’s, never two at once', () => {
    for (const id of ['ending_wardens_vigil', 'ending_unbound'] as const) {
      const lines = (pack.endings[id]?.epilogues ?? []).filter((x) => x.subject === 'mireya');
      expect([id, lines.length]).toEqual([id, 3]);
      expect(JSON.stringify(lines[1]?.when)).toContain('echo_glowfen_dammed');
      expect(JSON.stringify(lines[2]?.when)).toContain('echo_glowfen_let_run');
    }
  });

  test('the closers stay brief: two slides and one Fall slide, STORY §4.2’s words', () => {
    const escape = pack.endings.closer_escape;
    const fall = pack.endings.closer_fall;
    expect(escape?.sequence).toHaveLength(2);
    expect(fall?.sequence).toHaveLength(1);
    const s42 = norm(STORY.slice(STORY.indexOf('### 4.2'), STORY.indexOf('### 4.3')));
    expect(s42).toContain(norm('The stillness breaks. Something behind you has not finished speaking.'));
    expect(norm(fall?.sequence[0]?.text ?? '')).toBe(norm(escape?.sequence[1]?.text ?? '-'));
  });
});
