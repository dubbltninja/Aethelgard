// Token contrast (PLAN §8.4, DESIGN §16.7): WCAG 2.x relative-luminance maths over the custom properties in
// src/ui/styles/tokens.css (the default theme) and themes.css (high contrast). axe-core is unavailable (D-065), so the
// ratios are computed here and asserted by tests/unit/tools/contrast.test.ts. Pure: no DOM, no Playwright.
//
// Pairs checked, per theme:
//   --text-*    on every --surface-*   >= 4.5:1 (>= 7:1 in high contrast)
//   --on-fill-X on --fill-X            >= 4.5:1 (>= 7:1 in high contrast)
//   --glyph-*   on every --surface-*   >= 3:1   (icons, bars, pips, rarity frames)
//   --focus-ring, --line-strong on every --surface-*   >= 3:1
// Text over paintings is out of scope: the frames keep text off the art (D-125).
import fs from 'node:fs';
import path from 'node:path';

export type ThemeName = 'default' | 'high-contrast';

export interface Rgb {
  r: number;
  g: number;
  b: number;
  /** 0..1; 1 when the colour is opaque. */
  a: number;
}

export interface PairResult {
  theme: ThemeName;
  kind: 'text' | 'on-fill' | 'glyph' | 'focus' | 'line';
  foreground: string;
  background: string;
  ratio: number;
  min: number;
  ok: boolean;
}

/** The custom properties declared directly in the first block whose selector is exactly `selector`. */
export function tokensOf(css: string, selector: string): Record<string, string> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const at = clean.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no block ${selector}`);
  const body = clean.slice(clean.indexOf('{', at) + 1, clean.indexOf('}', at));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1] as string] = (m[2] as string).trim();
  return out;
}

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(r g b / a)`, `rgb(r, g, b)` and `rgba(...)` to channels. */
export function parseColor(value: string): Rgb {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) {
    const [r, g, b] = (m[1] as string).split('').map((c) => parseInt(c + c, 16)) as [number, number, number];
    return { r, g, b, a: 1 };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) {
    const n = parseInt(m[1] as string, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: m[2] === undefined ? 1 : parseInt(m[2], 16) / 255 };
  }
  m = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[/,]\s*(\d+(?:\.\d+)?%?))?\s*\)$/.exec(v);
  if (m) {
    const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: alpha };
  }
  throw new Error(`not a colour: ${value}`);
}

/** `top` laid over the opaque `under`. */
export function composite(top: Rgb, under: Rgb): Rgb {
  const a = top.a;
  return { r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1 };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque colour. */
export function luminance(colour: string | Rgb): number {
  const c = typeof colour === 'string' ? parseColor(colour) : colour;
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG contrast ratio, 1..21. */
export function contrast(a: string | Rgb, b: string | Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const STYLES = path.resolve(import.meta.dirname, '../../src/ui/styles');

/** Both themes' complete token maps, read from the stylesheets (the high-contrast block overrides the defaults). */
export function loadThemes(stylesDir: string = STYLES): Record<ThemeName, Record<string, string>> {
  const defaults = tokensOf(fs.readFileSync(path.join(stylesDir, 'tokens.css'), 'utf8'), ':root');
  const high = tokensOf(fs.readFileSync(path.join(stylesDir, 'themes.css'), 'utf8'), ':root[data-theme="high-contrast"]');
  return { default: defaults, 'high-contrast': { ...defaults, ...high } };
}

const entries = (t: Record<string, string>, prefix: string): [string, string][] => Object.entries(t).filter(([k]) => k.startsWith(prefix));

/** Every contrast pair the token naming contract promises, in one theme. */
export function checkTheme(theme: ThemeName, t: Record<string, string>): PairResult[] {
  const high = theme === 'high-contrast';
  const textMin = high ? 7 : 4.5;
  const surfaces = entries(t, '--surface-');
  const out: PairResult[] = [];
  const add = (kind: PairResult['kind'], fk: string, fv: string, bk: string, bv: string, min: number): void => {
    const ratio = contrast(fv, bv);
    out.push({ theme, kind, foreground: fk, background: bk, ratio, min, ok: ratio >= min });
  };
  for (const [tk, tv] of entries(t, '--text-')) for (const [sk, sv] of surfaces) add('text', tk, tv, sk, sv, textMin);
  for (const [fk, fv] of entries(t, '--fill-')) {
    const onKey = `--on-${fk.slice(2)}`;
    const on = t[onKey];
    if (on === undefined) throw new Error(`${fk} has no ${onKey}`);
    add('on-fill', onKey, on, fk, fv, textMin);
  }
  for (const [gk, gv] of entries(t, '--glyph-')) for (const [sk, sv] of surfaces) add('glyph', gk, gv, sk, sv, 3);
  for (const key of ['--focus-ring', '--line-strong'] as const) {
    const v = t[key];
    if (v === undefined) throw new Error(`no ${key}`);
    for (const [sk, sv] of surfaces) add(key === '--focus-ring' ? 'focus' : 'line', key, v, sk, sv, 3);
  }
  return out;
}

/** All pairs in both themes. */
export function checkAllThemes(themes: Record<ThemeName, Record<string, string>> = loadThemes()): PairResult[] {
  return (Object.entries(themes) as [ThemeName, Record<string, string>][]).flatMap(([name, t]) => checkTheme(name, t));
}

/** One line per failing pair, for a failure message. */
export function describeFailures(results: readonly PairResult[]): string[] {
  return results.filter((r) => !r.ok).map((r) => `[${r.theme}] ${r.foreground} on ${r.background}: ${r.ratio.toFixed(2)} < ${r.min}`);
}
