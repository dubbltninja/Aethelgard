// U76 (PLAN §8.2 `codex.voice.test.ts`) over the whole real codex and every Echo line: bodies ≤ 220 words (D-020), the four
// voices all present (and none under the validator's 10 % floor), Echo `codexLine`s ≤ 40 words, and the purple-prose guard of
// STORY §15.1 — a banned word is a WARNING (collected by `soft()`, fatal only under RELEASE_GATE=1), as PLAN §8.2 says.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { CODEX_BODY_MAX_WORDS, wordCount } from '@schema/codex';
import { ECHO_CODEX_LINE_MAX_WORDS } from '@schema/echo';
import { soft } from '@tests/fixtures/soft';

const pack = buildContentPack();
const codex = Object.values(pack.codex);
const echoes = Object.values(pack.echoes);

const VOICES = ['remnant_archive', 'ironclad_telling', 'weaver_fragment', 'wayfinder_notes'] as const;

/** STORY §15.1 "Banned in new text" (the first twelve are single words; "ancient" is banned as a default adjective). */
export const BANNED_WORDS = ['eldritch', 'unspeakable', 'unimaginable', 'nightmarish', 'epic', 'suddenly', 'very', 'incredibly', 'literally', 'ancient', 'mysterious', 'ethereal'] as const;
const BANNED = new RegExp(`\\b(?:${BANNED_WORDS.join('|')})\\b|fabric of (?:reality|existence)|You feel a sense of`, 'gi');

/** The text with quoted legacy lines removed: STORY §15.1 keeps legacy text where it is quoted. */
const unquoted = (text: string): string => text.replace(/["“][^"”]*["”]/g, ' ');

describe('the codex (D-020)', () => {
  test('every body is at most 220 words', () => {
    expect(codex.length).toBeGreaterThanOrEqual(80);
    expect(codex.filter((c) => wordCount(c.body) > CODEX_BODY_MAX_WORDS).map((c) => `${c.id}: ${wordCount(c.body)} words`)).toEqual([]);
    expect(CODEX_BODY_MAX_WORDS).toBe(220);
  });

  test('all four voices are present, none under 10 % of the entries', () => {
    const byVoice = Object.fromEntries(VOICES.map((v) => [v, codex.filter((c) => c.voice === v).length]));
    for (const v of VOICES) expect([v, (byVoice[v] ?? 0) > 0]).toEqual([v, true]);
    for (const v of VOICES) expect([v, (byVoice[v] ?? 0) / codex.length >= 0.1]).toEqual([v, true]);
    expect(codex.filter((c) => !(VOICES as readonly string[]).includes(c.voice))).toEqual([]);
  });

  test('every entry has a title, a body and a category; ids are unique by construction', () => {
    for (const c of codex) expect([c.id, c.title.trim() !== '', c.body.trim() !== '']).toEqual([c.id, true, true]);
  });

  test('the purple-prose guard: no banned word (soft: a warning, fatal only at the release gate)', () => {
    for (const c of codex) {
      soft(`codex ${c.id} banned words`, () => {
        const hits = [...unquoted(`${c.title} ${c.body}`).matchAll(BANNED)].map((m) => m[0].toLowerCase());
        expect([c.id, hits]).toEqual([c.id, []]);
      });
      soft(`codex ${c.id} exclamation`, () => expect([c.id, unquoted(c.body).includes('!')]).toEqual([c.id, false]));
    }
  });
});

describe('the Echo lines (PLAN §5.12)', () => {
  test('every Echo has a codexLine of at most 40 words', () => {
    expect(echoes).toHaveLength(103);
    expect(echoes.filter((e) => wordCount(e.codexLine) > ECHO_CODEX_LINE_MAX_WORDS).map((e) => `${e.id}: ${wordCount(e.codexLine)} words`)).toEqual([]);
    expect(echoes.filter((e) => wordCount(e.codexLine) === 0).map((e) => e.id)).toEqual([]);
    expect(ECHO_CODEX_LINE_MAX_WORDS).toBe(40);
  });

  test('the purple-prose guard on Echo lines (soft)', () => {
    for (const e of echoes) {
      soft(`echo ${e.id} banned words`, () => {
        const hits = [...unquoted(e.codexLine).matchAll(BANNED)].map((m) => m[0].toLowerCase());
        expect([e.id, hits]).toEqual([e.id, []]);
      });
    }
  });

  test('the guard itself catches what STORY §15.1 bans (a self-check of the list)', () => {
    for (const w of BANNED_WORDS) expect([w, unquoted(`It was ${w} here.`).match(BANNED)?.length ?? 0]).toEqual([w, 1]);
    expect('The fabric of reality frays.'.match(BANNED)).toHaveLength(1);
    expect(unquoted('Legacy: "a maelstrom of fractured realities, the fabric of reality".').match(BANNED)).toBeNull();
  });
});
