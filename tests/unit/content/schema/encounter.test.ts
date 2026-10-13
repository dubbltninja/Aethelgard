// U15: EncounterSchema (PLAN §5.3, WORLD §10, D-071.1: onFlee vs onFleeEffects).
import { describe, expect, test } from 'bun:test';
import { EncounterSchema, type EncounterInput } from '@schema/encounter';

const messages = (value: unknown): string[] => {
  const r = EncounterSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

/** WORLD §3.1 Darkened Corridor, first visit: cr_corrupted_shade ×1 (legacy). */
const shade: EncounterInput = {
  id: 'enc_corridor_shade',
  groups: [{ creatureId: 'cr_corrupted_shade' }],
  onVictory: [{ xp: 35 }],
};

/** WORLD §3.7 Scorched Gate, Horde state. */
const hordeHusks: EncounterInput = {
  id: 'enc_gate_husks',
  groups: [{ creatureId: 'cr_horde_husk', count: 2 }],
  when: { flag: 'flag_tyrant_dead' },
  ambush: true,
  intro: 'The grey grass moves against the wind.',
  onFlee: 'scatter',
  onFleeEffects: [{ passWatches: 2 }, { scatter: { location: 'loc_scorched_gate' } }],
  onDefeat: [{ endLoop: { closer: 'closer_fall', reason: 'death' } }],
};

/** DESIGN §13.3 #8: the Golem shortcut — a story gate that can be bypassed with the Echo. */
const golems: EncounterInput = {
  id: 'enc_outpost_golems',
  groups: [{ creatureId: 'cr_stone_hide_golem', count: 2 }],
  fleeable: false,
  onFlee: 'hold',
  optionalWhen: { echo: 'echo_stone_hide_origin' },
  once: true,
};

describe('EncounterSchema', () => {
  test('shade, horde husks and golem gate parse', () => {
    for (const e of [shade, hordeHusks, golems]) expect(messages(e)).toEqual([]);
  });

  test('defaults: certain, once, scatter, fleeable, not an ambush, no effects', () => {
    const e = EncounterSchema.parse(shade);
    expect(e.groups[0]?.count).toBe(1);
    expect(e.chance).toBe(1);
    expect(e.once).toBe(true);
    expect(e.respawn).toBe('never');
    expect(e.fleeable).toBe(true);
    expect(e.onFlee).toBe('scatter');
    expect(e.ambush).toBe(false);
    expect(e.elite).toBe(false);
    expect(e.onFleeEffects).toEqual([]);
    expect(e.onDefeat).toEqual([]);
    expect(e.onVictory).toEqual([{ xp: 35 }]);
  });

  test('onFlee (mode) and onFleeEffects (effects) are separate fields (D-071.1)', () => {
    const e = EncounterSchema.parse(hordeHusks);
    expect(e.onFlee).toBe('scatter');
    expect(e.onFleeEffects).toHaveLength(2);
    expect(messages({ ...shade, onFlee: [{ passWatches: 1 }] })).not.toEqual([]);
    expect(messages({ ...shade, onFleeEffects: 'scatter' })).not.toEqual([]);
    expect(messages({ ...shade, onFlee: 'run' })).not.toEqual([]);
    expect(EncounterSchema.parse({ ...shade, onFlee: 'previous' }).onFlee).toBe('previous');
  });

  test('effects and conditions are the canonical ones from U14', () => {
    expect(messages({ ...shade, onVictory: [{ gold: 5, xp: 3 }] })[0]).toContain('exactly one key');
    expect(messages({ ...shade, onVictory: [{ giveLoot: 'item_x' }] })[0]).toContain("unknown effect atom 'giveLoot'");
    expect(messages({ ...shade, when: { flags: 'flag_x' } })[0]).toContain("unknown condition atom 'flags'");
  });

  test('bad ids fail: creature prefix, encounter id shape', () => {
    expect(messages({ ...shade, groups: [{ creatureId: 'corrupted_shade' }] })[0]).toContain('expected an id with prefix cr_');
    expect(messages({ ...shade, groups: [{ creatureId: 'item_rusty_dagger' }] })).not.toEqual([]);
    expect(messages({ ...shade, id: 'Enc-Shade' })).not.toEqual([]);
  });

  test('missing groups, counts out of 1–3, bad chance and unknown keys fail', () => {
    const { groups: _g, ...noGroups } = shade as Record<string, unknown>;
    expect(messages(noGroups).join()).toContain('groups');
    expect(messages({ ...shade, groups: [] })).not.toEqual([]);
    expect(messages({ ...shade, groups: [{ creatureId: 'cr_corrupted_shade', count: 4 }] })).not.toEqual([]);
    expect(messages({ ...shade, groups: [{ creatureId: 'cr_corrupted_shade', count: 0 }] })).not.toEqual([]);
    expect(messages({ ...shade, chance: 1.5 })).not.toEqual([]);
    expect(messages({ ...shade, bossy: true })).not.toEqual([]);
  });

  test('1–3 enemies in slots (DESIGN §4.8) and no creature in two groups', () => {
    const two = { creatureId: 'cr_corrupted_shade', count: 2 };
    expect(messages({ ...shade, groups: [two, { creatureId: 'cr_arcane_wisp', count: 2 }] })).toEqual([
      'groups: an encounter fields 1–3 enemies in slots (DESIGN §4.8); got 4',
    ]);
    expect(messages({ ...shade, groups: [{ creatureId: 'cr_corrupted_shade', count: 2 }, { creatureId: 'cr_arcane_wisp' }] })).toEqual([]);
    expect(messages({ ...shade, groups: [{ creatureId: 'cr_corrupted_shade' }, { creatureId: 'cr_corrupted_shade' }] })).toEqual([
      'groups.1.creatureId: cr_corrupted_shade appears in two groups; raise its count instead',
    ]);
  });
});
