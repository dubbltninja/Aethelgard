// EndingSchema (PLAN §5.14; STORY §10 endings A–F and §10.7 loop closers; DESIGN §2.2 flow, D-049, D-060, D-066 #7,
// D-067.14). Eight records: six true endings (A–F) and the two loop closers. The flow after an ending is fixed by the
// engine, not data: Loop 1 closers → Loop 2 Day 1 (D-049); every other closer and every true ending → (sequence,
// epilogues) → Threshold, where New Game+ is offered after a true ending.
import { z } from 'zod';
import { AchievementId } from './achievement';
import { ConditionSchema } from './condition';
import { Base, Id, Text } from './primitives';

const custom = z.ZodIssueCode.custom;

/** STORY §10: letter → ending id. */
export const ENDING_LETTERS = {
  A: 'ending_wardens_vigil',
  B: 'ending_mending',
  C: 'ending_weavers_dawn',
  D: 'ending_iron_silence',
  E: 'ending_long_archive',
  F: 'ending_unbound',
} as const;
export const TRUE_ENDING_IDS = [
  'ending_wardens_vigil',
  'ending_mending',
  'ending_weavers_dawn',
  'ending_iron_silence',
  'ending_long_archive',
  'ending_unbound',
] as const;
export const CLOSER_IDS = ['closer_escape', 'closer_fall'] as const;
export const ENDING_IDS = [...TRUE_ENDING_IDS, ...CLOSER_IDS] as const;

/** The id of an ending record: a true ending (`ending_*`) or a loop closer (`closer_*`). */
export const EndingRecordId = z.enum(['ending_wardens_vigil', 'ending_mending', 'ending_weavers_dawn', 'ending_iron_silence', 'ending_long_archive', 'ending_unbound', 'closer_escape', 'closer_fall']);
export type EndingRecordId = z.infer<typeof EndingRecordId>;
export const EndingLetter = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);
/** `closer_fall` reasons (D-066 #7; `released` = *Let go* at a camp, D-067.14). */
export const FallReason = z.enum(['death', 'expiry', 'rejected', 'released']);

export const EndingSchema = Base.extend({
  id: EndingRecordId,
  letter: EndingLetter.optional(),
  kind: z.enum(['true', 'closer']),
  /** `closer_fall` only. */
  reasons: z.array(FallReason).default([]),
  /** "The Warden's Vigil". */
  name: Text,
  tagline: Text,
  /** Documentation + Threshold eligibility panel + validator (must be satisfiable per pathBot). Closers: `{ all: [] }`. */
  requirements: ConditionSchema,
  /** Human-readable "what you still need". */
  requirementTexts: z.array(z.object({ when: ConditionSchema, text: Text }).strict()).default([]),
  sequence: z
    .array(z.object({ text: Text, art: z.string().optional(), sfx: z.string().optional(), mood: z.string().optional() }).strict())
    .min(1),
  /** Per companion / faction / place. */
  epilogues: z.array(z.object({ subject: Id, when: ConditionSchema.optional(), text: Text }).strict()).default([]),
  achievementId: AchievementId.optional(),
  resonance: z.number().int().min(0).default(0),
  /** Show the "a game by Tim Dibert" roll (D-027). */
  credits: z.boolean().default(false),
})
  .strict()
  .superRefine((e, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: custom, path, message });
    const isCloser = e.id.startsWith('closer_');
    if (e.kind !== (isCloser ? 'closer' : 'true')) issue(['kind'], `${e.id} is a ${isCloser ? 'closer' : 'true ending'}: kind must be '${isCloser ? 'closer' : 'true'}'`);
    if (isCloser) {
      if (e.letter !== undefined) issue(['letter'], 'loop closers have no letter');
    } else {
      const expected = (Object.keys(ENDING_LETTERS) as (keyof typeof ENDING_LETTERS)[]).find((l) => ENDING_LETTERS[l] === e.id);
      if (e.letter !== expected) issue(['letter'], `${e.id} is ending ${expected} (STORY §10)`);
    }
    if (e.reasons.length > 0 && e.id !== 'closer_fall') issue(['reasons'], '`reasons` is for closer_fall only (D-066 #7)');
  });

export type Ending = z.output<typeof EndingSchema>;
export type EndingInput = z.input<typeof EndingSchema>;
