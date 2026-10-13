import { describe, expect, test } from 'bun:test';
import { pure } from '@engine/clean';

describe('fixture', () => {
  test('tests may import anything and use @ts-expect-error with a reason', () => {
    // @ts-expect-error — the argument is deliberately wrong to prove the type is strict
    expect(pure(1, [])).toBe(0);
  });
});
