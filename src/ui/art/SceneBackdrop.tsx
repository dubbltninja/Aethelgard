// <SceneBackdrop> (U71; docs/ART.md §7, D-124): a painted backdrop under the code layers. Pure, like <Scene>, which renders it
// when the container passes a `backdrop`.
//
// The frame is the same 12:5 box as the parametric scene. Bottom to top:
//   1. the painting — a <picture>: the `@sm` file below 760 px (DESIGN §16.1's breakpoint), the 1440 × 600 file above it;
//      `object-fit: cover`, centred (explore.css); decorative (`alt=""`, aria-hidden), lazy, decoded off the main thread. A
//      failed load marks the image failed (backdropChooser.ts), and the container steps to the next candidate.
//   2. the region tint, only on a region-mate's borrowed painting (ART §7);
//   3. the hour's wash (not on timeless places);
//   4. the legibility gradient on the top and bottom 15 %;
//   5. particles (≤ 24; none at all under reduced motion: still dots would sit on the pixel art like dust);
//   6. the Breach hatch (U70's value; it changes only when a day does, DESIGN §17.7).
// The parametric sky / far / mid / near layers are not drawn: the painting is the place.
//
// Pixel art (ART §3, Tim's 2026-10-25 ruling): the WebPs carry their grain at ~2 screen px per art pixel at 1440 wide. The frame
// shows them at fractional scales (≈0.45–0.9 on desktop, ≈1.3 device px per file px on a phone), so `image-rendering` stays the
// browser's smooth default: `pixelated` at those scales makes uneven pixel columns. Judged in screenshots (U71 reply).
import type { ReactNode } from 'react';
import type { Backdrop } from './backdropChooser';
import { markBackdropFailed } from './backdropChooser';
import { scenePalette } from './palettes';
import type { SceneProps } from './Scene';
import { HatchPattern, PAINT_WASH, ParticlesLayer, SCENE_H, SCENE_W, breachLevel, idOf, makeParticles } from './sceneLayers';
import { uiRng } from './uiRng';

/** DESIGN §16.1: one column under 760 px — and the small file. */
export const SMALL_MEDIA = '(max-width: 759.98px)';
/** ART §1: the large and small files' sizes. */
export const LARGE_SIZE = { width: 1440, height: 600 } as const;

/** How dark the legibility bands get at the frame's very edge. */
export const LEGIBILITY_EDGE = 0.55;
/** The borrowed painting's region tint. */
export const REGION_TINT = 0.3;

export type SceneBackdropProps = SceneProps & { backdrop: Backdrop };

export function SceneBackdrop({ location, region, art: artIn, state, reducedMotion, seed, className, backdrop }: SceneBackdropProps): ReactNode {
  const art = artIn ?? location.art;
  const p = scenePalette(location.regionId, region);
  const id = `scene-${idOf(location.id)}`;
  const timeless = art.timeOfDay === 'timeless';
  const wash = PAINT_WASH[state.watch];
  const breach = breachLevel(state);
  const particles = reducedMotion ? null : makeParticles(art.particles, uiRng(`${seed}:${location.id}:paint`));
  const classes = ['scene', 'scene--painted', className].filter((c) => c !== undefined).join(' ');
  return (
    <div
      className={classes}
      role="img"
      aria-label={location.name}
      data-template={art.template}
      data-motion={reducedMotion ? 'off' : 'on'}
      data-backdrop={backdrop.source}
      data-backdrop-key={backdrop.key}
    >
      <picture className="scene__backdrop" aria-hidden="true">
        <source media={SMALL_MEDIA} srcSet={backdrop.sm} />
        <img
          key={backdrop.key}
          className="scene__painting"
          src={backdrop.lg}
          alt=""
          width={LARGE_SIZE.width}
          height={LARGE_SIZE.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => markBackdropFailed(backdrop.key)}
        />
      </picture>
      <svg className="scene__overlay" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-legible`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity={LEGIBILITY_EDGE} />
            <stop offset="0.15" stopColor="#000" stopOpacity={0} />
            <stop offset="0.85" stopColor="#000" stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={LEGIBILITY_EDGE} />
          </linearGradient>
          {breach > 0 ? <HatchPattern id={`${id}-hatch`} /> : null}
        </defs>
        {backdrop.source === 'region' ? <rect width={SCENE_W} height={SCENE_H} fill={p.skyTop} opacity={REGION_TINT} data-layer="tint" /> : null}
        {timeless ? null : <rect width={SCENE_W} height={SCENE_H} fill={wash.color} opacity={wash.opacity} className="scene__wash" data-layer="wash" />}
        <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id}-legible)`} data-layer="legibility" />
        {particles === null ? null : (
          <g data-layer="particles">
            <ParticlesLayer set={particles} fill={p.accent} reducedMotion={false} />
          </g>
        )}
        {breach > 0 ? <rect width={SCENE_W} height={SCENE_H} fill={`url(#${id}-hatch)`} opacity={breach} data-breach="" data-layer="breach" /> : null}
      </svg>
    </div>
  );
}

/**
 * The Title's art covers the whole window, so the small file serves only a small window at least as wide as 12:5: on a portrait
 * phone, covering the height would blow the 300 px-tall file up about 7× (judged in a screenshot: mush), so it takes the large one.
 */
export const TITLE_SMALL_MEDIA = '(max-width: 759.98px) and (min-aspect-ratio: 12/5)';

/** The Title's key art (ART §1): the same picture treatment behind the title card; null when there is none. */
export function TitleBackdrop({ files, onError }: { files: { lg: string; sm: string }; onError: () => void }): ReactNode {
  return (
    <div className="title-backdrop" aria-hidden="true">
      <picture>
        <source media={TITLE_SMALL_MEDIA} srcSet={files.sm} />
        <img className="title-backdrop__painting" src={files.lg} alt="" width={LARGE_SIZE.width} height={LARGE_SIZE.height} decoding="async" draggable={false} onError={onError} />
      </picture>
    </div>
  );
}
