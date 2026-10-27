// <Portrait> (U73a; docs/ART-2.md §1, §7; D-128): a speaker's painted bust in a round-cornered frame — large in Dialogue (the
// 512 px file), small in Explore's rows and on the companion chip (the 160 px `@sm` file) — or the code sigil the caller passes
// when there is none or it fails to load (the same in-place swap as <Sprite>). Pure; decorative (the name is always beside it).
import type { ReactNode } from 'react';
import { figureError } from './Sprite';
import { choosePortrait, type SpriteManifest } from './spriteManifest';

export interface PortraitProps {
  /** The npc id the file is named after; null draws the fallback. */
  npcId: string | null;
  size: 'sm' | 'lg';
  fallback: ReactNode;
  /** `npc.portrait.accent` (the frame's tint). */
  accent?: string;
  className?: string;
  manifest?: SpriteManifest;
}

/** ART-2 §1: the stored sizes. */
export const PORTRAIT_PX = { lg: 512, sm: 160 } as const;

export function Portrait({ npcId, size, fallback, accent, className, manifest }: PortraitProps): ReactNode {
  const files = choosePortrait(npcId, manifest);
  const classes = ['portrait', `portrait--${size}`, className].filter(Boolean).join(' ');
  if (files === null) {
    return (
      <span className={`${classes} portrait--sigil`} data-art="sigil" data-npc={npcId ?? undefined} aria-hidden="true">
        {fallback}
      </span>
    );
  }
  const src = size === 'lg' ? files.lg : files.sm;
  return (
    <span className={classes} data-art="portrait" data-npc={npcId ?? undefined} data-accent={accent} aria-hidden="true">
      <img
        className="portrait__img"
        src={src}
        alt=""
        width={PORTRAIT_PX[size]}
        height={PORTRAIT_PX[size]}
        decoding="async"
        draggable={false}
        onError={(e) => figureError(e, src)}
      />
      <span className="portrait__fallback">{fallback}</span>
    </span>
  );
}
