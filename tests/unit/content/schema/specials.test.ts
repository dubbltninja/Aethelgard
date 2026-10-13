// U16: the content-side SPECIALS registry (PLAN §5.19 rule 3). The engine mirror test (schema list = engine list)
// lands with src/engine/combat/specials.ts in U26.
import { describe, expect, test } from 'bun:test';
import { SPECIALS, SPECIAL_INFO, SpecialFor, SpecialIdSchema, specialsFor } from '@schema/specials';

describe('SPECIALS registry', () => {
  test('ids are unique snake_case with at least one scope and a summary', () => {
    expect(new Set(SPECIALS).size).toBe(SPECIALS.length);
    for (const id of SPECIALS) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(SPECIAL_INFO[id].scopes.length).toBeGreaterThan(0);
      expect(SPECIAL_INFO[id].summary.length).toBeGreaterThan(10);
    }
  });

  test('PLAN §5.7’s ability hooks are all present', () => {
    for (const id of ['rewind', 'phase', 'taunt', 'cleanse', 'trap', 'mark_execute', 'chain', 'counter_stance', 'drain', 'unmaking']) {
      expect(specialsFor('ability')).toContain(id);
    }
    expect(specialsFor('move')).toContain('hour_presses');
    expect(specialsFor('move')).not.toContain('mark_execute');
    expect(specialsFor('status')).toEqual(['rewind', 'phase', 'taunt']);
  });

  test('scoped schemas accept their own ids and explain rejections', () => {
    expect(SpecialFor('ability').safeParse('drain').success).toBe(true);
    expect(SpecialFor('status').safeParse('drain').error?.issues[0]?.message).toBe("special 'drain' is not usable on a status (allowed: rewind, phase, taunt)");
    expect(SpecialFor('move').safeParse(3).error?.issues[0]?.message).toContain('unknown special 3 for a move');
    expect(SpecialIdSchema.safeParse('bound_mage').success).toBe(true);
    expect(SpecialIdSchema.safeParse('bound').error?.issues[0]?.message).toContain('unknown special "bound"');
  });
});
