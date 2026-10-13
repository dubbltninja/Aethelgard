import { describe, expect, test } from 'bun:test';

describe.only('focused suite', () => {
  test.only('focused test', () => {
    expect(1).toBe(1);
  });
});
