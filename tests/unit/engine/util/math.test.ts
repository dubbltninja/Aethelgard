// U12: numeric helpers (src/engine/util/math.ts).
import { describe, expect, test } from 'bun:test';
import { clamp, pct, round } from '@engine/util/math';

describe('math', () => {
  test('clamp limits to [min, max] and rejects min > max', () => {
    expect(clamp(5, 0, 8)).toBe(5);
    expect(clamp(-2, 0, 8)).toBe(0);
    expect(clamp(9, 0, 8)).toBe(8);
    expect(clamp(3, 3, 3)).toBe(3);
    expect(() => clamp(1, 2, 1)).toThrow(RangeError);
  });

  test('round is half away from zero, supports decimals, never returns -0', () => {
    expect(round(2.5)).toBe(3);
    expect(round(-2.5)).toBe(-3);
    expect(round(2.4)).toBe(2);
    expect(round(-2.4)).toBe(-2);
    expect(Object.is(round(-0.4), 0)).toBe(true);
    expect(Object.is(round(-0), 0)).toBe(true);
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(0.125, 2)).toBe(0.13);
    expect(round(1250, -2)).toBe(1300);
  });

  test('pct is part/whole on a 0–100 scale and 0 for an empty whole', () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(3, 2)).toBe(150);
    expect(pct(5, 0)).toBe(0);
  });
});
