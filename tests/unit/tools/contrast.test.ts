// tools/a11y/contrast.ts (PLAN §8.4): the WCAG maths against reference values, and every token pair of both themes
// against the thresholds of DESIGN §16.7 (text 4.5:1, glyphs and the focus ring 3:1, 7:1 for text in high contrast).
import { describe, expect, test } from 'bun:test';
import { checkAllThemes, checkTheme, composite, contrast, describeFailures, loadThemes, luminance, parseColor } from '../../../tools/a11y/contrast';

describe('the maths', () => {
  test('matches WCAG reference ratios', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#336699', '#336699')).toBe(1);
    expect(luminance('#ffffff')).toBeCloseTo(1, 6);
    expect(luminance('#000000')).toBe(0);
  });

  test('parses hex, short hex, hex with alpha and rgb() in both syntaxes', () => {
    expect(parseColor('#0e0f14')).toEqual({ r: 14, g: 15, b: 20, a: 1 });
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#00000080').a).toBeCloseTo(0.502, 3);
    expect(parseColor('rgb(23 25 34 / 0.9)')).toEqual({ r: 23, g: 25, b: 34, a: 0.9 });
    expect(parseColor('rgba(1, 2, 3, 50%)')).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseColor('rgb(1 2 3)').a).toBe(1);
    expect(() => parseColor('red')).toThrow();
  });

  test('composite lays a translucent colour over an opaque one', () => {
    const out = composite({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 });
    expect(out).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
    expect(contrast(out, '#000000')).toBeGreaterThan(5);
  });

  test('a failing pair is reported by name', () => {
    const results = checkTheme('default', { '--surface-base': '#000000', '--text-dim': '#111111', '--glyph-x': '#ffffff', '--focus-ring': '#ffffff', '--line-strong': '#ffffff' });
    expect(describeFailures(results)).toEqual(['[default] --text-dim on --surface-base: 1.11 < 4.5']);
  });
});

describe.each(['default', 'high-contrast'] as const)('%s theme tokens', (name) => {
  const high = name === 'high-contrast';
  const results = checkAllThemes().filter((r) => r.theme === name);
  const of = (kind: string) => results.filter((r) => r.kind === kind);

  test('covers every text, on-fill, glyph, focus and line pair', () => {
    const t = loadThemes()[name];
    const surfaces = Object.keys(t).filter((k) => k.startsWith('--surface-')).length;
    expect(surfaces).toBeGreaterThanOrEqual(2);
    expect(of('text').length).toBe(Object.keys(t).filter((k) => k.startsWith('--text-')).length * surfaces);
    expect(of('glyph').length).toBe(Object.keys(t).filter((k) => k.startsWith('--glyph-')).length * surfaces);
    expect(of('on-fill').length).toBe(Object.keys(t).filter((k) => k.startsWith('--fill-')).length);
    expect(of('focus').length).toBe(surfaces);
    expect(of('line').length).toBe(surfaces);
  });

  test(`text is >= ${high ? 7 : 4.5}:1 on every surface and on its fill`, () => {
    const text = [...of('text'), ...of('on-fill')];
    expect(text.every((r) => r.min === (high ? 7 : 4.5))).toBe(true);
    expect(describeFailures(text)).toEqual([]);
  });

  test('glyphs, the focus ring and control borders are >= 3:1 on every surface', () => {
    const ui = [...of('glyph'), ...of('focus'), ...of('line')];
    expect(ui.every((r) => r.min === 3)).toBe(true);
    expect(describeFailures(ui)).toEqual([]);
  });

  test('the focus ring is at least 2 px wide', () => {
    expect(parseFloat(loadThemes()[name]['--focus-width'] as string)).toBeGreaterThanOrEqual(2);
  });
});
