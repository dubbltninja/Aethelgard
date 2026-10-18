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

/**
 * Echoes the engine grants by itself (horde.ts, reducers/loop.ts, communion.ts, reducers/inventory.ts, echoes.ts,
 * before.ts) rather than through a content effect. The validator treats them as granted (D-082). Keep in sync with the
 * engine (a test checks the literals).
 */
export const ENGINE_GRANTED_ECHOES: readonly string[] = [
  'echo_amulet_memory', 'echo_brak_death', 'echo_brak_lives', 'echo_horde_path', 'echo_korr_marginalia',
  'echo_thirtieth_dawn', 'echo_tyrant_rejected', 'echo_tyrant_speaks',
  'echo_ending_a', 'echo_ending_b', 'echo_ending_c', 'echo_ending_d', 'echo_ending_e', 'echo_ending_f',
  // U32: the two-of-five rule (D-067.16), the loop-end bonds and oaths (STORY §12), the Before's entry and Anchors
  'echo_tyrant_jailer', 'echo_nyx_bond', 'echo_ilyra_bond', 'echo_dask_bond', 'echo_mireya_bond', 'echo_caelum_bond',
  'echo_ironclad_oath', 'echo_weaver_sign', 'echo_before_route', 'echo_anchor_mechanic',
  // U34e (D-101): three Dark Spellbooks read in one loop (WORLD §7.10; Korr's Marginalia counts as one)
  'echo_litany_verse_2',
];

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
  /** First-time Resonance. DESIGN §10.6 pays nothing for Echoes, so the default is 0 (D-082). */
  resonance: z.number().int().min(0).default(0),
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
