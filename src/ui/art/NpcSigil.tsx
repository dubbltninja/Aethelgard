// <NpcSigil> (DESIGN §17.3, "Companions and NPCs get portrait sigils in the same grammar with a warm backing"): a 96 × 96
// portrait frame — the creature sigil's `portrait` shape — holding a bust on a warm glow. Every person has a `portrait.sigil`
// key in the content (npc.portrait); the key seeds the bust (hood, cap, long hair, crest, braid or bare head; a mark or a
// feature; the shoulders), so the same person always draws the same face and two people rarely share one. The faction
// accent (`portrait.accent`: remnants, weavers, ironclad, …) tints the frame. Static: a person does not flicker or spin.
// Colours come from CSS custom properties (dialogue.css), so the high-contrast theme can make it solid. Decorative unless
// `title` names it.
import type { ReactNode } from 'react';
import { uiRng } from './uiRng';
import { SIGIL_PX, type SigilSize } from './CreatureSigil';

export interface NpcSigilProps {
  /** `npc.portrait.sigil`, or a class id for the Wayfinder. */
  sigilKey: string;
  /** `npc.portrait.accent`. */
  accent?: string;
  size?: SigilSize;
  /** Names the sigil (role="img"); omit when the person's name is beside it. */
  title?: string;
}

export const FRAME = 'M22 12 L74 12 Q 84 12, 84 22 L84 78 Q 84 88, 74 88 L22 88 Q 12 88, 12 78 L12 22 Q 12 12, 22 12 Z';

/** What sits on the head, by variant (the head is a circle at 48, 38 with radius 13). */
const HEAD_GEAR: readonly { id: string; path: string }[] = [
  { id: 'hood', path: 'M33 44 C 31 24, 40 20, 48 20 C 56 20, 65 24, 63 44 C 60 36, 56 31, 48 31 C 40 31, 36 36, 33 44 Z' },
  { id: 'cap', path: 'M35 34 C 36 24, 60 24, 61 34 C 56 30, 40 30, 35 34 Z' },
  { id: 'long', path: 'M35 40 C 34 24, 62 24, 61 40 L 63 58 L 58 58 L 58 40 C 54 33, 42 33, 38 40 L 38 58 L 33 58 Z' },
  { id: 'crest', path: 'M38 28 L41 17 L45 26 L48 15 L51 26 L55 17 L58 28 C 54 25, 42 25, 38 28 Z' },
  { id: 'braid', path: 'M36 36 C 38 26, 58 26, 60 36 C 54 32, 42 32, 36 36 Z M62 40 C 68 46, 62 54, 67 62 M60 40 C 66 46, 60 54, 65 62' },
  { id: 'bare', path: 'M40 27 C 44 25, 52 25, 56 27' },
];

/** A feature on the face, by variant. */
const FACE_MARKS: readonly { id: string; path: string }[] = [
  { id: 'scar', path: 'M52 32 L58 44' },
  { id: 'veil', path: 'M37 41 C 43 47, 53 47, 59 41' },
  { id: 'beard', path: 'M38 42 C 38 55, 58 55, 58 42 C 54 47, 42 47, 38 42 Z' },
  { id: 'brow', path: 'M40 35 L46 36 M50 36 L56 35' },
  { id: 'rune', path: 'M48 27 L48 31 M46 29 L50 29' },
  { id: 'none', path: '' },
];

/** The shoulders, by variant. */
const SHOULDERS: readonly { id: string; path: string }[] = [
  { id: 'robe', path: 'M18 88 C 20 66, 38 60, 48 60 C 58 60, 76 66, 78 88 Z M48 60 L48 88' },
  { id: 'plate', path: 'M16 88 L 20 68 C 30 62, 66 62, 76 68 L80 88 Z M30 66 L34 76 M66 66 L62 76' },
  { id: 'collar', path: 'M20 88 C 22 68, 38 62, 48 64 C 58 62, 74 68, 76 88 Z M40 62 L48 74 L56 62' },
  { id: 'cloak', path: 'M14 88 C 18 64, 34 58, 48 58 C 62 58, 78 64, 82 88 Z M36 60 C 40 72, 56 72, 60 60' },
];

const pick = <T,>(items: readonly T[], seed: string): T => uiRng(seed).pick(items);

/** The three variants a key draws (exported for the tests: the same key always draws the same). */
export function portraitParts(sigilKey: string): { gear: string; mark: string; shoulders: string } {
  return {
    gear: pick(HEAD_GEAR, `${sigilKey}:gear`).id,
    mark: pick(FACE_MARKS, `${sigilKey}:mark`).id,
    shoulders: pick(SHOULDERS, `${sigilKey}:shoulders`).id,
  };
}

export const SIGIL_FACTIONS: readonly string[] = ['remnants', 'weavers', 'ironclad', 'neutral'];

export function NpcSigil({ sigilKey, accent, size = 'md', title }: NpcSigilProps): ReactNode {
  const gear = pick(HEAD_GEAR, `${sigilKey}:gear`);
  const mark = pick(FACE_MARKS, `${sigilKey}:mark`);
  const shoulders = pick(SHOULDERS, `${sigilKey}:shoulders`);
  const px = SIGIL_PX[size];
  const named = title !== undefined && title !== '';
  const tint = accent !== undefined && SIGIL_FACTIONS.includes(accent) ? accent : undefined;
  return (
    <svg
      className="npc-sigil"
      width={px}
      height={px}
      viewBox="0 0 96 96"
      focusable="false"
      role={named ? 'img' : undefined}
      aria-label={named ? title : undefined}
      aria-hidden={named ? undefined : 'true'}
      data-portrait={sigilKey}
      data-accent={tint}
    >
      <path className="npc-sigil__frame" d={FRAME} />
      <circle className="npc-sigil__warmth" cx={48} cy={46} r={30} />
      <path className="npc-sigil__body" d={shoulders.path} />
      <circle className="npc-sigil__head" cx={48} cy={38} r={13} />
      {gear.path === '' ? null : <path className="npc-sigil__gear" d={gear.path} />}
      {mark.path === '' ? null : <path className="npc-sigil__mark" d={mark.path} />}
    </svg>
  );
}
