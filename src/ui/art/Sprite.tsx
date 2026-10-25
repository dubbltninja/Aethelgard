// <Sprite> (U73a; docs/ART-2.md §1, §7; D-128): a cut-out pixel figure, or — when the build has no file for it, or the file
// fails to load — the code sigil the caller passes as `fallback` (CreatureSigil, NpcSigil, ClassSigil), so a figure is never
// empty and never a broken-image icon. Pure: the manifest is inlined at build time (spriteManifest.ts) and a failed load swaps to
// the sigil in place (the error handler flips `data-failed` on the host, which CSS reads) and is remembered, so every later
// render draws the sigil straight away.
//
// The code effects of the anomaly variants (sprites.ts) are drawn here, over the base creature's file:
//   doubled  — 1 or 2 ghost copies offset behind it, stuttering;   phase   — it flickers and leaves a faint ghost;
//   tint     — a colour filter (flat, unfiled, early, still, seeding); split — its two halves pulled apart along a bright seam;
//   tethered — a cold rim (the stage draws the line between two);  painted — a flat dark shape until it is cracked;
//   wayfinder — the class sprite, greyed and flickering.
// Movement in them stops under reduced motion (themes.css): the ghosts and tints stay, still.
// Smooth scaling, like the backdrops (D-125): the figures are shown at fractional scales.
import type { ReactNode, SyntheticEvent } from 'react';
import { chooseSprite, markFigureFailed, type SpriteManifest } from './spriteManifest';
import type { SpriteEffect } from './sprites';

export interface SpriteProps {
  /** The file id (`cr_*`, `class_*`, `companion_*`); null draws the fallback. */
  file: string | null;
  /** Mirror the stored figure. */
  flip?: boolean;
  effect?: SpriteEffect | null;
  /** The code sigil drawn when there is no figure. */
  fallback: ReactNode;
  /** Bestiary: a creature not met yet shows only its outline. */
  silhouette?: boolean;
  /** Painted-over (the Unlit Lantern): cracked once it has taken a wound. */
  revealed?: boolean;
  className?: string;
  /** Tests pass a manifest; the app uses the inlined one. */
  manifest?: SpriteManifest;
}

/** The ghost copies an effect draws behind the figure. */
export function ghostCount(effect: SpriteEffect | null | undefined): number {
  if (effect == null) return 0;
  if (effect.kind === 'doubled') return effect.copies - 1;
  if (effect.kind === 'phase' || effect.kind === 'split') return 1;
  return 0;
}

/** The host's classes for an effect. */
export function effectClasses(effect: SpriteEffect | null | undefined, revealed: boolean): string[] {
  if (effect == null) return [];
  const out = [`sprite--fx-${effect.kind}`];
  if (effect.kind === 'tint') out.push(`sprite--tint-${effect.tint}`);
  if (effect.kind === 'painted' && revealed) out.push('sprite--cracked');
  return out;
}

/** An image failed: show the sigil in place now (no re-render needed) and never ask for it again. */
export function figureError(event: SyntheticEvent<HTMLImageElement>, src: string): void {
  markFigureFailed(src);
  const host = event.currentTarget.closest('[data-art]');
  host?.setAttribute('data-failed', 'true');
  host?.setAttribute('data-art', 'sigil');
}

export function Sprite({ file, flip = false, effect = null, fallback, silhouette = false, revealed = false, className, manifest }: SpriteProps): ReactNode {
  const art = chooseSprite(file, manifest);
  if (art === null) {
    return (
      <span className={['sprite', 'sprite--sigil', className].filter(Boolean).join(' ')} data-art="sigil" data-file={file ?? undefined} aria-hidden="true">
        {fallback}
      </span>
    );
  }
  const ghosts = ghostCount(effect);
  const classes = ['sprite', flip ? 'sprite--flip' : null, silhouette ? 'sprite--silhouette' : null, ...effectClasses(effect, revealed), className].filter(Boolean).join(' ');
  const img = (cls: string, key?: number): ReactNode => (
    <img
      key={key}
      className={cls}
      src={art.src}
      alt=""
      width={art.w}
      height={art.h}
      decoding="async"
      draggable={false}
      onError={(e) => figureError(e, art.src)}
    />
  );
  return (
    <span className={classes} data-art="sprite" data-file={file ?? undefined} data-effect={effect?.kind} aria-hidden="true">
      <span className="sprite__fig">
        {Array.from({ length: ghosts }, (_, i) => img(`sprite__img sprite__ghost sprite__ghost--${i + 1}`, i))}
        {img('sprite__img sprite__main')}
      </span>
      <span className="sprite__fallback">{fallback}</span>
    </span>
  );
}
