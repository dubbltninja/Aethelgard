// U15: RegionSchema (PLAN §5.2) — WORLD §2 / DESIGN §17.1 regions parse.
import { describe, expect, test } from 'bun:test';
import { RegionSchema, type RegionInput } from '@schema/region';

const messages = (value: unknown): string[] => {
  const r = RegionSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

const silverwoodRuins: RegionInput = {
  id: 'region_silverwood_ruins',
  name: 'Silverwood Ruins',
  description: 'The capital, five hundred years dead. Marble under moss. Crystals growing where lanterns hung.',
  order: 1,
  levelBand: { min: 1, max: 4 },
  legacy: true,
  factionId: 'remnants',
  palette: { bg: '#1B1F3B', bgAlt: '#4A3F6B', fg: '#ECEFF4', accent: '#9FD8FF', glow: '#9FD8FF' },
  ambient: 'silverwood_drone',
  wanderingPool: [
    { creatureId: 'cr_corrupted_shade', weight: 2 },
    { creatureId: 'cr_arcane_wisp' },
  ],
  returnEncounterChance: 0.2,
  tags: ['legacy', 'remnants'],
};

/** WORLD §2.6: opens from Loop 2 (PLAN §5.2 example). */
const silverwoodBefore: RegionInput = {
  id: 'region_silverwood_before',
  name: 'Silverwood Before',
  description: 'The capital on the three days before the Sundering.',
  order: 6,
  levelBand: { min: 13, max: 17 },
  palette: { bg: '#2B2E5A', bgAlt: '#E0C27A', fg: '#FFF4D0', accent: '#FFF4D0', glow: '#E0C27A', danger: '#8B2E2E' },
  ambient: 'before_bells',
  codexId: 'codex_place_silverwood_before',
  unlockWhen: { loop: { min: 2 } },
};

describe('RegionSchema', () => {
  test('Silverwood Ruins and Silverwood Before parse', () => {
    expect(messages(silverwoodRuins)).toEqual([]);
    expect(messages(silverwoodBefore)).toEqual([]);
  });

  test('defaults: not legacy, 20% return encounters, empty pool, weight 1', () => {
    const before = RegionSchema.parse(silverwoodBefore);
    expect(before.legacy).toBe(false);
    expect(before.returnEncounterChance).toBe(0.2);
    expect(before.wanderingPool).toEqual([]);
    expect(before.unlockWhen).toEqual({ loop: { min: 2 } });
    expect(RegionSchema.parse(silverwoodRuins).wanderingPool[1]?.weight).toBe(1);
  });

  test('bad id prefixes fail', () => {
    expect(messages({ ...silverwoodRuins, id: 'silverwood_ruins' })[0]).toContain('expected an id with prefix region_');
    expect(messages({ ...silverwoodRuins, id: 'loc_silverwood_ruins' })).not.toEqual([]);
    expect(messages({ ...silverwoodRuins, wanderingPool: [{ creatureId: 'corrupted_shade' }] })[0]).toContain('prefix cr_');
    expect(messages({ ...silverwoodRuins, codexId: 'silverwood' })[0]).toContain('prefix codex_');
    expect(messages({ ...silverwoodRuins, ambient: 'Silverwood Drone' })).not.toEqual([]);
  });

  test('missing required fields, unknown faction and unknown keys fail', () => {
    const { palette: _p, ...noPalette } = silverwoodRuins as Record<string, unknown>;
    expect(messages(noPalette).join()).toContain('palette');
    const { levelBand: _l, ...noBand } = silverwoodRuins as Record<string, unknown>;
    expect(messages(noBand).join()).toContain('levelBand');
    expect(messages({ ...silverwoodRuins, factionId: 'nomads' })).not.toEqual([]);
    expect(messages({ ...silverwoodRuins, palette: { ...silverwoodRuins.palette, sky: '#000' } })).not.toEqual([]);
    expect(messages({ ...silverwoodRuins, climate: 'damp' })).not.toEqual([]);
    expect(messages({ ...silverwoodRuins, returnEncounterChance: 20 })).not.toEqual([]);
  });

  test('level band is 1+ and min ≤ max', () => {
    expect(messages({ ...silverwoodRuins, levelBand: { min: 5, max: 3 } })[0]).toContain('level band min must be ≤ max');
    expect(messages({ ...silverwoodRuins, levelBand: { min: 0, max: 3 } })).not.toEqual([]);
    expect(messages({ ...silverwoodRuins, levelBand: { min: 2.5, max: 3 } })).not.toEqual([]);
  });

  test('a creature appears once in the wandering pool', () => {
    const dup = [{ creatureId: 'cr_arcane_wisp' }, { creatureId: 'cr_arcane_wisp', weight: 2 }];
    expect(messages({ ...silverwoodRuins, wanderingPool: dup })).toEqual([
      'wanderingPool.1.creatureId: cr_arcane_wisp is in the wandering pool twice; raise its weight instead',
    ]);
    expect(messages({ ...silverwoodRuins, wanderingPool: [{ creatureId: 'cr_arcane_wisp', weight: 0 }] })).not.toEqual([]);
  });

  test('unlockWhen is a Condition', () => {
    expect(messages({ ...silverwoodBefore, unlockWhen: { loops: { min: 2 } } })[0]).toContain("unknown condition atom 'loops'");
  });
});
