// U17: EchoSchema and CodexSchema (PLAN §5.12) — STORY §12 / §14 records parse; limits bite.
import { describe, expect, test } from 'bun:test';
import { CODEX_BODY_MAX_WORDS, CodexSchema, wordCount } from '@schema/codex';
import { ECHO_CODEX_LINE_MAX_WORDS, EchoSchema } from '@schema/echo';
import { codexNinefoldCircle, echoLitanyVerse1 } from '../examples';

const issuesOf = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } } }, value: unknown): string[] => {
  const r = schema.safeParse(value);
  return r.success ? [] : (r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`);
};
const expectIssue = (schema: Parameters<typeof issuesOf>[0], value: unknown, path: string, fragment: string) => {
  const found = issuesOf(schema, value);
  expect(found.some((i) => i.startsWith(`${path}: `) && i.includes(fragment)), `wanted "${path}: …${fragment}…", got ${JSON.stringify(found)}`).toBe(true);
};

describe('EchoSchema', () => {
  test('STORY §12 echo_litany_verse_1 parses with defaults', () => {
    const e = EchoSchema.parse(echoLitanyVerse1);
    expect(e).toMatchObject({ name: 'The Witness', category: 'lore', exclusiveWith: [], onGrant: [], resonance: 0, requiredForEndings: [], timelineGroup: 'litany' });
    expect(e.obtainedBy).toHaveLength(3);
  });

  test('ids, categories and sources', () => {
    expectIssue(EchoSchema, { ...echoLitanyVerse1, id: 'litany_verse_1' }, 'id', 'echo_');
    expectIssue(EchoSchema, { ...echoLitanyVerse1, category: 'trivia' }, 'category', 'Invalid enum value');
    expectIssue(EchoSchema, { ...echoLitanyVerse1, obtainedBy: [] }, 'obtainedBy', 'at least 1');
    expectIssue(EchoSchema, { ...echoLitanyVerse1, requiredForEndings: ['echo_x'] }, 'requiredForEndings.0', 'ending_');
    expectIssue(EchoSchema, { ...echoLitanyVerse1, resonance: -1 }, 'resonance', '');
  });

  test('codexLine is at most 40 words (PLAN §5.12)', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
    expect(ECHO_CODEX_LINE_MAX_WORDS).toBe(40);
    expect(EchoSchema.safeParse({ ...echoLitanyVerse1, codexLine: words(40) }).success).toBe(true);
    expectIssue(EchoSchema, { ...echoLitanyVerse1, codexLine: words(41) }, 'codexLine', 'is 41 words; the limit is 40');
    expect(wordCount('  two   words\n')).toBe(2);
    expect(wordCount('   ')).toBe(0);
    expect(CODEX_BODY_MAX_WORDS).toBe(220);
  });

  test('exclusiveWith names other Echoes, once each', () => {
    const e = { ...echoLitanyVerse1, id: 'echo_a' };
    expect(EchoSchema.safeParse({ ...e, exclusiveWith: ['echo_b'] }).success).toBe(true);
    expectIssue(EchoSchema, { ...e, exclusiveWith: ['echo_a'] }, 'exclusiveWith.0', 'exclusive with itself');
    expectIssue(EchoSchema, { ...e, exclusiveWith: ['echo_b', 'echo_b'] }, 'exclusiveWith.1', 'duplicate');
  });

  test('onGrant is an effect list', () => {
    expect(EchoSchema.safeParse({ ...echoLitanyVerse1, onGrant: [{ unlockCodex: 'codex_ninefold_circle' }] }).success).toBe(true);
    expectIssue(EchoSchema, { ...echoLitanyVerse1, onGrant: [{ unlockCodex: 'ninefold' }] }, 'onGrant.0.unlockCodex', 'codex_');
  });
});

describe('CodexSchema', () => {
  test('a Remnant Archive entry parses with defaults', () => {
    const c = CodexSchema.parse(codexNinefoldCircle);
    expect(c).toMatchObject({ voice: 'remnant_archive', category: 'the_nine', unlockedAtStart: false, related: [], order: 0, date: 'Year 412 of the Sundering' });
    expect(c.unlockWhen).toEqual({ echo: 'echo_litany_verse_1' });
  });

  test('voices and categories are closed sets (D-020); ids and links carry prefixes', () => {
    expectIssue(CodexSchema, { ...codexNinefoldCircle, voice: 'narrator' }, 'voice', 'Invalid enum value');
    expectIssue(CodexSchema, { ...codexNinefoldCircle, category: 'recipes' }, 'category', 'Invalid enum value');
    expectIssue(CodexSchema, { ...codexNinefoldCircle, id: 'ninefold_circle' }, 'id', 'codex_');
    expectIssue(CodexSchema, { ...codexNinefoldCircle, related: ['ninefold'] }, 'related.0', 'codex_');
    expectIssue(CodexSchema, { ...codexNinefoldCircle, related: ['codex_ninefold_circle'] }, 'related.0', 'itself');
    expectIssue(CodexSchema, { ...codexNinefoldCircle, body: '' }, 'body', '');
  });

  test('the four voices all parse', () => {
    for (const voice of ['remnant_archive', 'ironclad_telling', 'weaver_fragment', 'wayfinder_notes']) {
      expect(CodexSchema.safeParse({ ...codexNinefoldCircle, voice }).success).toBe(true);
    }
  });
});
