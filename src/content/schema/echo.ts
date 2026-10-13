// EchoSchema (PLAN §5.12). STORY §12 is the Echo catalog (D-062, 103 entries after D-069.1); mechanical effects follow
// DESIGN §10.4–10.5. `codexLine` (≤ 40 words) is checked here; the codex-body limit is `validateContent()` rule 17.
import { z } from 'zod';
import { wordCount } from './codex';
import { dupes } from './creature';
import { Effects } from './effect';
import { Base, EchoId, EndingId, Text } from './primitives';

const custom = z.ZodIssueCode.custom;

export const ECHO_CODEX_LINE_MAX_WORDS = 40;
export const ECHO_CATEGORIES = ['lore', 'route', 'shortcut', 'dialogue', 'ending', 'character', 'secret'] as const;
export const EchoCategory = z.enum(ECHO_CATEGORIES);

export const EchoSchema = Base.extend({
  id: EchoId,
  name: Text,
  /** Wayfinder's Notes voice, ≤ 40 words. */
  codexLine: Text,
  description: z.string().optional(),
  category: EchoCategory,
  /** Cannot both be gained in one loop (D-010); symmetric (the validator checks). */
  exclusiveWith: z.array(EchoId).default([]),
  /** E.g. `unlockCodex`, reveal. */
  onGrant: Effects,
  /** First-time Resonance. */
  resonance: z.number().int().min(0).default(5),
  /** Documentation: 'dialogue:nyx_truth:choice_know' | 'quest:…' | 'event:…'. The validator cross-checks that some content grants it. */
  obtainedBy: z.array(Text).min(1),
  /** Loop Timeline grouping label. */
  timelineGroup: z.string().optional(),
  /** Documentation + validator: ending requirements reference this Echo. */
  requiredForEndings: z.array(EndingId).default([]),
})
  .strict()
  .superRefine((e, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
    const words = wordCount(e.codexLine);
    if (words > ECHO_CODEX_LINE_MAX_WORDS) issue(['codexLine'], `codexLine is ${words} words; the limit is ${ECHO_CODEX_LINE_MAX_WORDS} (PLAN §5.12)`);
    e.exclusiveWith.forEach((other, i) => {
      if (other === e.id) issue(['exclusiveWith', i], 'an Echo cannot be exclusive with itself');
    });
    dupes(e.exclusiveWith).forEach((i) => issue(['exclusiveWith', i], 'duplicate entry'));
    dupes(e.requiredForEndings).forEach((i) => issue(['requiredForEndings', i], 'duplicate entry'));
  });

export type Echo = z.output<typeof EchoSchema>;
export type EchoInput = z.input<typeof EchoSchema>;
