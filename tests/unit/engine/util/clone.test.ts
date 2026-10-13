// U12: structuredClone drafts and dev-only deepFreeze (src/engine/util/clone.ts, PLAN §4.6, D-065).
import { describe, expect, test } from 'bun:test';
import { clone, deepFreeze } from '@engine/util/clone';
import { fullProfile, fullState } from '../types/handmade';

describe('clone', () => {
  test('is deep-equal and fully independent of the original', () => {
    const original = fullState();
    const snapshot = JSON.stringify(original);
    const draft = clone(original);
    expect(draft).toStrictEqual(original);
    expect(draft).not.toBe(original);
    expect(draft.player).not.toBe(original.player);
    expect(draft.combat!.enemies[0]!.pattern).not.toBe(original.combat!.enemies[0]!.pattern);

    draft.player.hp = 1;
    draft.player.inventory.push({ uid: 'i99', itemId: 'item_x', qty: 1, rarity: 'common', affixes: [] });
    draft.world.locationStates.loc_shattered_library!.flags.flag_new = 1;
    draft.combat!.enemies[0]!.pattern.firedOnce.push('tyr_other');
    draft.rng = [9, 9, 9, 9];
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  test('a clone of a frozen value is mutable (the step pattern: frozen input → mutable draft)', () => {
    const frozen = deepFreeze(fullProfile());
    const draft = clone(frozen);
    expect(Object.isFrozen(draft)).toBe(false);
    expect(Object.isFrozen(draft.runHistory)).toBe(false);
    draft.resonance += 10;
    draft.echoes.push('echo_new');
    expect(frozen.resonance).toBe(95);
    expect(frozen.echoes).not.toContain('echo_new');
  });
});

describe('deepFreeze', () => {
  test('returns the same reference with every nested object and array frozen', () => {
    const s = fullState();
    const out = deepFreeze(s);
    expect(out).toBe(s);
    const stack: unknown[] = [s];
    let objects = 0;
    while (stack.length > 0) {
      const node = stack.pop();
      if (typeof node !== 'object' || node === null) continue;
      expect(Object.isFrozen(node)).toBe(true);
      objects++;
      stack.push(...Object.values(node));
    }
    expect(objects).toBeGreaterThan(50);
  });

  test('mutation throws in strict mode (ES modules are strict)', () => {
    const s = deepFreeze(fullState());
    const mutable = s as { player: { hp: number; inventory: unknown[] }; flags: Record<string, unknown> };
    expect(() => {
      mutable.player.hp = 0;
    }).toThrow(TypeError);
    expect(() => {
      mutable.player.inventory.push({});
    }).toThrow(TypeError);
    expect(() => {
      mutable.flags.flag_new = true;
    }).toThrow(TypeError);
    expect(() => {
      delete mutable.flags.flag_heartstone_stabilized;
    }).toThrow(TypeError);
    expect(s.player.hp).toBe(40);
  });

  test('handles primitives, null, shared references, cycles, and being called twice', () => {
    expect(deepFreeze(3)).toBe(3);
    expect(deepFreeze(null)).toBeNull();
    expect(deepFreeze('s')).toBe('s');
    const shared = { n: 1 };
    const cyclic: Record<string, unknown> = { shared, list: [shared] };
    cyclic.self = cyclic;
    deepFreeze(cyclic);
    deepFreeze(cyclic);
    expect(Object.isFrozen(cyclic)).toBe(true);
    expect(Object.isFrozen(shared)).toBe(true);
    expect(Object.isFrozen(cyclic.list)).toBe(true);
  });

  test('freezes children of an object that was already frozen shallowly', () => {
    const inner = { v: 1 };
    const outer = Object.freeze({ inner });
    deepFreeze(outer);
    expect(Object.isFrozen(inner)).toBe(true);
  });
});
