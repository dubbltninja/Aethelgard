// Class sigils for Class Select: one bold outer shape and one inner glyph each, in the grammar of DESIGN §17.3/§17.5
// (Warden's hexagon, the Weaver's ring with a missing arc, …). Decorative: the class name beside it is the label.
import type { ReactNode } from 'react';

const GLYPHS: Record<string, ReactNode> = {
  // Ranger: a drawn bow and its arrow.
  ranger: (
    <>
      <path d="M16 8 C 34 16, 34 32, 16 40" />
      <path d="M16 8 L16 40" strokeWidth={1.5} />
      <path d="M10 24 L38 24 M33 19 L38 24 L33 29" />
    </>
  ),
  // Wizard: a flame inside the ley ring.
  wizard: (
    <>
      <circle cx={24} cy={24} r={16} />
      <path d="M24 13 C 30 20, 31 25, 28 30 C 27 33, 21 33, 20 30 C 18 26, 21 23, 22 19 C 23 23, 25 24, 24 13 Z" />
    </>
  ),
  // Elf: a crescent leaf and the line of a blade.
  elf: (
    <>
      <path d="M12 36 C 12 20, 22 10, 38 10 C 38 26, 28 36, 12 36 Z" />
      <path d="M14 34 L34 14" />
    </>
  ),
  // Ironclad Warden: the construct hexagon as a shield.
  ironclad_warden: (
    <>
      <path d="M24 7 L38 15 L38 31 L24 41 L10 31 L10 15 Z" />
      <path d="M24 15 L24 33 M17 21 L31 21" />
    </>
  ),
  // Shadow Weaver: the Void ring with a missing arc, a drop of blood in it.
  shadow_weaver: (
    <>
      <path d="M33 11 A 16 16 0 1 0 39 26" />
      <path d="M24 18 C 28 23, 29 26, 27 29 C 25 32, 21 31, 21 28 C 21 25, 23 22, 24 18 Z" />
    </>
  ),
};

/** The class ids that have a glyph of their own (the registry test checks every class in the content is here). */
export const CLASS_SIGIL_IDS: readonly string[] = Object.keys(GLYPHS);

export function ClassSigil({ classId, size = 48 }: { classId: string; size?: number }): ReactNode {
  return (
    <svg className="class-sigil" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      {GLYPHS[classId] ?? <circle cx={24} cy={24} r={14} />}
    </svg>
  );
}
