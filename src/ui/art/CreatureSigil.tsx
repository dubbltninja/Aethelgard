// <CreatureSigil> (PLAN §6.4, DESIGN §17.3): a 96 × 96 SVG sigil per creature — a bold outer shape from the content's
// `sigil.base` (circle for the breach-born, hexagon for constructs, teardrop for void, triangle for beasts, rhombus for the
// aetherial, spiral for chrono, a portrait frame for people), filled in the region's mid colour; an inner glyph per
// family in the accent (the `sigil.accent` faction tint, else the region's); and at most one animated detail (flicker,
// slow rotation, drip, ember drift). Elites (`double_outline`) add a thin second outline, bosses (`segmented_ring`) a
// segmented ring. Reduced motion draws the same picture without the moving parts. Colours come from CSS custom
// properties (combat.css), so the high-contrast theme can make it solid. Decorative unless `title` names it.
import type { ReactNode } from 'react';
import { uiRng } from './uiRng';

export type SigilSize = 'sm' | 'md' | 'lg';
export type SigilState = 'idle' | 'telegraph' | 'hit' | 'ko';

export const SIGIL_PX: Readonly<Record<SigilSize, number>> = { sm: 40, md: 64, lg: 96 };

export interface SigilSpec {
  base: string;
  accent?: string;
  details: readonly string[];
}

export interface CreatureSigilProps {
  creatureId: string;
  /** The creature's `sigil` record; absent → a circle. */
  sigil?: SigilSpec;
  /** `fam_*`: picks the inner glyph (unknown → one chosen from the creature id). */
  family?: string;
  size?: SigilSize;
  state?: SigilState;
  reducedMotion?: boolean;
  /** Names the sigil (role="img"); omit when the creature's name is beside it. */
  title?: string;
}

/** Outer shapes by `sigil.base` (DESIGN §17.3), on a 96 × 96 box centred at 48, 48. */
export const SHAPES: Readonly<Record<string, string>> = {
  circle: 'M48 10 A 38 38 0 1 1 47.99 10 Z',
  circle_lit: 'M48 10 A 38 38 0 1 1 47.99 10 Z',
  broken_circle: 'M48 10 A 38 38 0 1 1 47.99 10 Z',
  circle_waterline: 'M48 10 A 38 38 0 1 1 47.99 10 Z',
  spiral: 'M48 10 A 38 38 0 1 1 47.99 10 Z',
  hexagon: 'M48 8 L83 28 L83 68 L48 88 L13 68 L13 28 Z',
  teardrop: 'M48 6 C 64 30, 80 46, 80 60 A 32 32 0 0 1 16 60 C 16 46, 32 30, 48 6 Z',
  triangle: 'M48 9 L87 82 L9 82 Z',
  rhombus: 'M48 5 L87 48 L48 91 L9 48 Z',
  portrait: 'M22 12 L74 12 Q 84 12, 84 22 L84 78 Q 84 88, 74 88 L22 88 Q 12 88, 12 78 L12 22 Q 12 12, 22 12 Z',
};

/** What a base adds on top of its shape (the lit core, the gaps, the waterline, the spiral arm). */
function baseExtra(base: string): ReactNode {
  switch (base) {
    case 'circle_lit':
      return <circle className="sigil__glow" cx={48} cy={48} r={27} />;
    case 'circle_waterline':
      return <path className="sigil__line" d="M12 60 C 22 54, 32 66, 42 60 C 52 54, 62 66, 72 60 C 78 57, 82 59, 85 61" />;
    case 'spiral':
      return <path className="sigil__line" d="M48 48 C 48 44, 54 44, 54 48 C 54 54, 42 54, 42 48 C 42 38, 60 38, 60 48 C 60 62, 34 62, 34 48 C 34 30, 70 30, 72 46" />;
    default:
      return null;
  }
}

/** Inner glyphs by family (WORLD §5's families), drawn in the accent. */
export const FAMILY_GLYPHS: Readonly<Record<string, string>> = {
  fam_hollowed: 'M32 44 A 6 6 0 1 1 31.99 44 Z M64 44 A 6 6 0 1 1 63.99 44 Z M37 63 Q 48 56, 59 63',
  fam_wilds: 'M34 30 L42 66 M47 28 L52 68 M60 30 L62 64',
  fam_green: 'M48 70 L48 40 M48 52 C 36 52, 31 42, 33 33 C 43 33, 48 41, 48 52 M48 45 C 58 45, 64 37, 62 28 C 52 28, 48 36, 48 45',
  fam_drowned: 'M28 42 C 34 36, 41 48, 48 42 C 55 36, 62 48, 68 42 M28 56 C 34 50, 41 62, 48 56 C 55 50, 62 62, 68 56',
  fam_spireborn: 'M48 24 L60 68 L36 68 Z M48 24 L48 68 M41 50 L55 50',
  fam_unravelled: 'M30 48 C 30 34, 64 34, 64 48 C 64 60, 40 60, 40 50 C 40 43, 54 43, 54 50 M64 48 L70 44 M64 52 L71 56',
  fam_wards: 'M48 26 L65 34 L65 50 C 65 59, 57 66, 48 70 C 39 66, 31 59, 31 50 L31 34 Z M48 37 L48 59 M39 46 L57 46',
  fam_watch_wardens: 'M35 62 C 35 44, 40 30, 48 30 C 56 30, 61 44, 61 62 Z M31 62 L65 62 M48 62 L48 68 M48 24 L48 30',
  fam_mortal: 'M48 32 A 8 8 0 1 1 47.99 32 Z M33 68 C 35 54, 61 54, 63 68',
};
const GLYPH_KEYS = Object.keys(FAMILY_GLYPHS);

export function familyGlyph(family: string | undefined, creatureId: string): string {
  const known = family === undefined ? undefined : FAMILY_GLYPHS[family];
  return known ?? (FAMILY_GLYPHS[uiRng(creatureId).pick(GLYPH_KEYS)] as string);
}

/** Faction tints for `sigil.accent` (DESIGN §17.1 accents); anything else keeps the region's accent. */
export const SIGIL_ACCENTS: readonly string[] = ['remnants', 'weavers', 'ironclad', 'chrono', 'neutral'];

/** The one moving part a sigil may have (DESIGN §17.7: one per creature card), by detail key; null for none. */
export function animatedDetail(details: readonly string[]): 'flicker' | 'rotate' | 'drip' | 'ember' | null {
  for (const d of details) {
    if (d === 'flicker' || d === 'after_image' || d === 'wing_blur') return 'flicker';
    if (d === 'slow_rotation' || d === 'spin' || d === 'rings') return 'rotate';
    if (d === 'drip') return 'drip';
    if (d === 'spark' || d === 'ember_seams' || d === 'coal_spine') return 'ember';
  }
  return null;
}

export function CreatureSigil({ creatureId, sigil, family, size = 'md', state = 'idle', reducedMotion = false, title }: CreatureSigilProps): ReactNode {
  const base = sigil?.base ?? 'circle';
  const shape = SHAPES[base] ?? (SHAPES.circle as string);
  const details = sigil?.details ?? [];
  const elite = details.includes('double_outline');
  const boss = details.includes('segmented_ring');
  const motion = reducedMotion ? null : animatedDetail(details);
  const px = SIGIL_PX[size];
  const named = title !== undefined && title !== '';
  const accent = sigil?.accent !== undefined && SIGIL_ACCENTS.includes(sigil.accent) ? sigil.accent : undefined;
  return (
    <svg
      className={`creature-sigil creature-sigil--${state}${motion === null ? '' : ` creature-sigil--${motion}`}`}
      width={px}
      height={px}
      viewBox="0 0 96 96"
      focusable="false"
      role={named ? 'img' : undefined}
      aria-label={named ? title : undefined}
      aria-hidden={named ? undefined : 'true'}
      data-creature={creatureId}
      data-base={base}
      data-accent={accent}
    >
      {boss ? <circle className="sigil__ring" cx={48} cy={48} r={46} strokeDasharray="20 4" /> : null}
      <path className="sigil__body" d={shape} strokeDasharray={base === 'broken_circle' ? '34 8' : undefined} />
      {elite ? <path className="sigil__outline" d={shape} transform="translate(48 48) scale(0.86) translate(-48 -48)" /> : null}
      {baseExtra(base)}
      <g className="sigil__glyph">
        <path d={familyGlyph(family, creatureId)} />
        {details.includes('starlit_eyes') ? (
          <>
            <circle cx={41} cy={40} r={1.6} className="sigil__dot" />
            <circle cx={55} cy={40} r={1.6} className="sigil__dot" />
          </>
        ) : null}
      </g>
      {motion === 'drip' ? <circle className="sigil__drip" cx={48} cy={74} r={3} /> : null}
      {motion === 'ember' ? (
        <g className="sigil__embers">
          <circle cx={38} cy={70} r={1.8} />
          <circle cx={56} cy={74} r={1.4} />
          <circle cx={48} cy={66} r={1.2} />
        </g>
      ) : null}
      {state === 'ko' ? <path className="sigil__ko" d="M22 22 L74 74 M74 22 L22 74" /> : null}
    </svg>
  );
}
