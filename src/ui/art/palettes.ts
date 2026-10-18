// Region palettes (DESIGN §17.1, D-062: DESIGN owns the hex values). Each row: sky top · sky bottom · far silhouettes ·
// mid elements · near elements · accent. The content's `region.palette` carries only bg/bgAlt/fg/accent/glow (the far
// and near colours are "the UI unit's", silverwood_ruins/region.ts), so the scene reads this table first and falls
// back to the content palette for a region it does not list.
import type { Region } from '@schema/region';

export interface ScenePalette {
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  near: string;
  accent: string;
}

export const REGION_PALETTES: Readonly<Record<string, ScenePalette>> = {
  region_silverwood_ruins: { skyTop: '#1B1F3B', skyBottom: '#4A3F6B', far: '#2E2A4D', mid: '#5B5380', near: '#1A1826', accent: '#9FD8FF' },
  region_mistwood_ironclad_reach: { skyTop: '#2B3A3A', skyBottom: '#6E8C7A', far: '#3F5A4E', mid: '#5E7A68', near: '#1F2A24', accent: '#D98B3A' },
  region_voidscar: { skyTop: '#0B0A14', skyBottom: '#2A1B3D', far: '#1C1230', mid: '#3B2A57', near: '#070610', accent: '#7B3FE4' },
  region_aether_kissed_highlands: { skyTop: '#1E2A4A', skyBottom: '#7FA8D9', far: '#3C5A8A', mid: '#6E8FC4', near: '#1A2238', accent: '#E8F3FF' },
  region_glowlands_nexus: { skyTop: '#0F2A22', skyBottom: '#1F5C44', far: '#15382C', mid: '#2F7A5A', near: '#071A14', accent: '#7CFF9E' },
  region_drowned_reach: { skyTop: '#0D1B2A', skyBottom: '#1F4E6E', far: '#153A52', mid: '#2C6A8A', near: '#081219', accent: '#8FD3E8' },
  region_ashen_steppe: { skyTop: '#3A2E2A', skyBottom: '#B08A6A', far: '#6B4F40', mid: '#9C7A5F', near: '#2A1F1A', accent: '#E05A3A' },
  region_veil: { skyTop: '#120A1E', skyBottom: '#3A1F52', far: '#24143A', mid: '#4B2C6E', near: '#0A0612', accent: '#C86BFF' },
  region_glowfen: { skyTop: '#14261A', skyBottom: '#3E6E3A', far: '#244A2A', mid: '#4F8A44', near: '#0C1A10', accent: '#D9FF66' },
  region_skyreach: { skyTop: '#0E1C3A', skyBottom: '#9FC0E8', far: '#2F4F80', mid: '#7F9FD0', near: '#1A2A4A', accent: '#FFE9A8' },
  region_silverwood_before: { skyTop: '#2B2E5A', skyBottom: '#E0C27A', far: '#5A5E9A', mid: '#C9B47A', near: '#2A2440', accent: '#FFF4D0' },
  region_threshold: { skyTop: '#05060C', skyBottom: '#1A2140', far: '#0F1428', mid: '#283055', near: '#030408', accent: '#B8C7FF' },
};

/** The Ruins row: the fallback when neither the table nor the content knows the region. */
const DEFAULT_PALETTE = REGION_PALETTES.region_silverwood_ruins as ScenePalette;

/** A `#rrggbb` colour mixed toward black (`by` < 0) or white (`by` > 0), |by| ≤ 1. */
export function shade(hex: string, by: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1] as string, 16);
  const target = by < 0 ? 0 : 255;
  const t = Math.min(1, Math.abs(by));
  const mix = (c: number): string => Math.round(c + (target - c) * t).toString(16).padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/** The scene palette of `regionId`: DESIGN's row, else one derived from the content's palette, else the Ruins. */
export function scenePalette(regionId: string, region?: Pick<Region, 'palette'>): ScenePalette {
  const row = REGION_PALETTES[regionId];
  if (row !== undefined) return row;
  if (region === undefined) return DEFAULT_PALETTE;
  const p = region.palette;
  return { skyTop: p.bg, skyBottom: p.bgAlt, far: shade(p.fg, -0.35), mid: p.fg, near: shade(p.bg, -0.5), accent: p.accent };
}
