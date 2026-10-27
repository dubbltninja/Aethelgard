import { expect, test } from 'bun:test';

test('expect-error without a reason', () => {
  // @ts-expect-error
  expect(Number('1')).toBe(1);
});
