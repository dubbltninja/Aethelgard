// U14: schema primitives (PLAN §5.1, D-044).
import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import {
  Base,
  ClassId,
  CompanionId,
  FactionId,
  Id,
  ItemId,
  PId,
  Pct,
  RangeSchema,
  Tags,
  oneKeyUnion,
} from '@schema/primitives';

const ok = (schema: z.ZodTypeAny, value: unknown) => schema.safeParse(value).success;
const messages = (schema: z.ZodTypeAny, value: unknown): string[] => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('ids (D-044)', () => {
  test('Id: lowercase snake_case', () => {
    for (const good of ['ranger', 'ironclad_warden', 'enc_library_wraiths', 'a1']) expect(ok(Id, good)).toBe(true);
    for (const bad of ['Ranger', '1abc', 'kebab-case', '', 'has space', 'x.y']) expect(ok(Id, bad)).toBe(false);
  });

  test('PId: the prefix is part of the id', () => {
    const Loc = PId('loc_');
    expect(ok(Loc, 'loc_whispering_ruins')).toBe(true);
    for (const bad of ['whispering_ruins', 'loc_', 'loc_Whispering', 'region_x', 42, null]) expect(ok(Loc, bad)).toBe(false);
    expect(messages(Loc, 'ruins')).toEqual([': expected an id with prefix loc_ (lowercase snake_case, D-044)']);
  });

  test('ItemId: item_ or mat_', () => {
    expect(ok(ItemId, 'item_amulet_of_echoes')).toBe(true);
    expect(ok(ItemId, 'mat_ember_ore')).toBe(true);
    expect(ok(ItemId, 'material_ember_ore')).toBe(false);
    expect(messages(ItemId, 'ore')[0]).toContain('item_ or mat_');
  });

  test('plain-id enums', () => {
    expect(ClassId.options).toEqual(['ranger', 'wizard', 'elf', 'ironclad_warden', 'shadow_weaver']);
    expect(CompanionId.options).toEqual(['ilyra', 'brak', 'nyx', 'dask', 'mireya', 'caelum']);
    expect(FactionId.options).toEqual(['remnants', 'weavers', 'ironclad']);
  });
});

describe('small shapes', () => {
  test('RangeSchema: strict, both bounds optional, min ≤ max', () => {
    expect(ok(RangeSchema, {})).toBe(true);
    expect(ok(RangeSchema, { min: 2 })).toBe(true);
    expect(ok(RangeSchema, { min: 2, max: 2 })).toBe(true);
    expect(ok(RangeSchema, { min: 3, max: 2 })).toBe(false);
    expect(ok(RangeSchema, { minimum: 2 })).toBe(false);
  });

  test('Pct, Tags default, Base', () => {
    expect(ok(Pct, 0.5)).toBe(true);
    expect(ok(Pct, 1.5)).toBe(false);
    expect(Tags.parse(undefined)).toEqual([]);
    expect(Base.parse({ id: 'thing' })).toEqual({ id: 'thing', tags: [] });
  });
});

describe('oneKeyUnion', () => {
  const U = oneKeyUnion<{ a: number } | { b: string }>('thing', () => ({ a: z.number(), b: z.object({ c: z.string() }).strict() }));

  test('accepts exactly one known key with a valid value', () => {
    expect(ok(U, { a: 1 })).toBe(true);
    expect(ok(U, { b: { c: 'x' } })).toBe(true);
  });

  test('errors name the problem and the path', () => {
    expect(messages(U, 'a')).toEqual([': a thing is an object with exactly one key, e.g. { flag: "flag_x" }']);
    expect(messages(U, [])).toHaveLength(1);
    expect(messages(U, {})[0]).toContain('exactly one key; got none');
    expect(messages(U, { a: 1, b: 2 })[0]).toContain('got a, b');
    expect(messages(U, { z: 1 })).toEqual(["z: unknown thing atom 'z' (expected one of: a, b)"]);
    expect(messages(U, { toString: 1 })[0]).toContain("unknown thing atom 'toString'");
    expect(messages(U, { b: { c: 1 } })[0]).toMatch(/^b\.c: /);
    expect(messages(U, { b: { c: 'x', d: 1 } })[0]).toMatch(/^b: Unrecognized key/);
  });
});
