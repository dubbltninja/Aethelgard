// CodexSchema (PLAN §5.12; STORY §14 codex plan: 87 entries; D-020 four voices, ≤ 220 words). Entries unlock by their
// `unlockWhen` condition, by being `unlockedAtStart`, or by an explicit `unlockCodex` effect; the first unlock in a profile
// pays Resonance and XP (DESIGN §6.2, §10.6). The ≤ 220-word body limit and "reachable lore" are `validateContent()`
// rule 17 (`CODEX_BODY_MAX_WORDS` and `wordCount` are shared with it).
import { z } from 'zod';
import { ConditionSchema } from './condition';
import { Base, CodexId, Text, Voice } from './primitives';

const custom = z.ZodIssueCode.custom;

/** Whitespace-separated words (the unit of the codex and codexLine limits). */
export function wordCount(text: string): number {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

/** D-020; enforced by `validateContent()` rule 17. */
export const CODEX_BODY_MAX_WORDS = 220;

export const CODEX_CATEGORIES = ['history', 'the_nine', 'wayfinders', 'factions', 'people', 'places', 'creatures', 'magic', 'items', 'loops'] as const;
export const CodexCategory = z.enum(CODEX_CATEGORIES);

export const CodexSchema = Base.extend({
  id: CodexId,
  title: Text,
  voice: Voice,
  category: CodexCategory,
  /** Validator: ≤ 220 words (D-020). */
  body: Text,
  /** Absent → unlocked by an explicit `unlockCodex` effect only. */
  unlockWhen: ConditionSchema.optional(),
  unlockedAtStart: z.boolean().default(false),
  related: z.array(CodexId).default([]),
  order: z.number().int().default(0),
  /** Remnant Archive dating ("Year 412 of the Sundering"). */
  date: z.string().optional(),
})
  .strict()
  .superRefine((c, ctx) => {
    c.related.forEach((r, i) => {
      if (r === c.id) ctx.addIssue({ code: custom, path: ['related', i], message: 'an entry cannot list itself as related' });
    });
  });

export type CodexEntry = z.output<typeof CodexSchema>;
export type CodexEntryInput = z.input<typeof CodexSchema>;
