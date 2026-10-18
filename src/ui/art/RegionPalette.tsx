// <RegionPalette> (PLAN §6.4): sets the region's colours as custom properties on a wrapper, so a screen's frame, the
// map's region tints and the scene agree: --region-bg / --region-fg / --region-accent / --region-glow, plus the
// scene rows (--region-sky-top, --region-sky-bottom, --region-far, --region-near). Art colours only: text keeps the
// contrast-checked --text-* tokens, and the high-contrast theme ignores these (themes.css).
import type { CSSProperties, ReactNode } from 'react';
import type { Region } from '@schema/region';
import { scenePalette } from './palettes';

export function regionStyle(regionId: string, region?: Pick<Region, 'palette'>): CSSProperties {
  const p = scenePalette(regionId, region);
  return {
    '--region-bg': region?.palette.bg ?? p.skyTop,
    '--region-fg': region?.palette.fg ?? p.mid,
    '--region-accent': region?.palette.accent ?? p.accent,
    '--region-glow': region?.palette.glow ?? p.accent,
    '--region-sky-top': p.skyTop,
    '--region-sky-bottom': p.skyBottom,
    '--region-far': p.far,
    '--region-near': p.near,
  } as CSSProperties;
}

export interface RegionPaletteProps {
  regionId: string;
  region?: Pick<Region, 'palette'>;
  children?: ReactNode;
  className?: string;
}

export function RegionPalette({ regionId, region, children, className }: RegionPaletteProps): ReactNode {
  return (
    <div className={className === undefined ? 'region-palette' : `region-palette ${className}`} data-region={regionId} style={regionStyle(regionId, region)}>
      {children}
    </div>
  );
}
