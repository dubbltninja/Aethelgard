// Token contrast (PLAN §6.7, §8.4; DESIGN §16.7): WCAG relative-luminance contrast for every token pair the naming
// contract in tokens.css promises, in the default and the high-contrast theme. axe-core is unavailable (D-065), so
// the math is here; U78 may lift it into tools/a11y/contrast.ts.
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

const STYLES = path.resolve(import.meta.dirname,'../../../src/ui/styles');
const read = (file: string): string => fs.readFileSync(path.join(STYLES, file), 'utf8');

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

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1] as string, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const defaults = tokensOf(read('tokens.css'), ':root');
const themes = {
  default: defaults,
  'high-contrast': { ...defaults, ...tokensOf(read('themes.css'), ':root[data-theme="high-contrast"]') },
};

const pick = (t: Record<string, string>, prefix: string): [string, string][] => Object.entries(t).filter(([k]) => k.startsWith(prefix));

describe.each(Object.entries(themes))('%s theme', (name, t) => {
  const high = name === 'high-contrast';
  const textMin = high ? 7 : 4.5;
  const surfaces = pick(t, '--surface-');

  test('has surfaces, text, glyphs and a focus ring', () => {
    expect(surfaces.length).toBeGreaterThanOrEqual(2);
    expect(pick(t, '--text-').length).toBeGreaterThanOrEqual(4);
    expect(pick(t, '--glyph-').length).toBeGreaterThanOrEqual(5);
    expect(t['--focus-ring']).toBeDefined();
  });

  test(`every --text-* is >= ${textMin}:1 on every --surface-*`, () => {
    const bad: string[] = [];
    for (const [tk, tv] of pick(t, '--text-')) {
      for (const [sk, sv] of surfaces) if (contrast(tv, sv) < textMin) bad.push(`${tk} on ${sk}: ${contrast(tv, sv).toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  });

  test('every --glyph-*, the focus ring and control borders are >= 3:1 on every --surface-*', () => {
    const bad: string[] = [];
    const ui = [...pick(t, '--glyph-'), ['--focus-ring', t['--focus-ring'] as string], ['--line-strong', t['--line-strong'] as string]] as [string, string][];
    for (const [gk, gv] of ui) {
      for (const [sk, sv] of surfaces) if (contrast(gv, sv) < 3) bad.push(`${gk} on ${sk}: ${contrast(gv, sv).toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  });

  test(`every --on-fill-X is >= ${textMin}:1 on its --fill-X`, () => {
    const fills = pick(t, '--fill-');
    expect(fills.length).toBeGreaterThanOrEqual(2);
    for (const [fk, fv] of fills) {
      const on = t[`--on-${fk.slice(2)}`];
      expect(on).toBeDefined();
      expect(contrast(on as string, fv)).toBeGreaterThanOrEqual(textMin);
    }
  });

  test('the focus ring is at least 2 px wide', () => {
    expect(parseFloat(t['--focus-width'] as string)).toBeGreaterThanOrEqual(2);
  });
});

test('high contrast removes translucency', () => {
  const hc = themes['high-contrast'];
  for (const key of ['--veil', '--backdrop']) expect(hc[key]).toMatch(/^#[0-9a-f]{6}$/i);
});

test('touch targets: the shared minimum is 44 px and every control rule uses it', () => {
  expect(defaults['--target-min']).toBe('44px');
  const components = read('components.css');
  for (const selector of ['.btn {', '.field__input {', '.choice {', 'details > summary {']) {
    const at = components.indexOf(selector);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(components.slice(at, components.indexOf('}', at))).toContain('min-height: var(--target-min)');
  }
  const screens = read('screens.css');
  const menu = screens.slice(screens.indexOf('.title-menu__item {'));
  expect(menu.slice(0, menu.indexOf('}'))).toContain('min-height: 3.25rem');
});

test('motion: reduced motion zeroes durations both by setting and by system preference', () => {
  const css = read('themes.css');
  expect(css).toContain(':root[data-motion="reduce"]');
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  expect(css).toContain(':root:not([data-motion="full"])');
  expect(css.match(/animation: none !important/g)?.length).toBe(2);
});

test('the contrast math matches WCAG reference values', () => {
  expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
  expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  expect(() => luminance('red')).toThrow();
});
