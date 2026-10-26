// U22: run saves (PLAN §4.12, §8.1): 50 sim-snapshot round-trips, the envelope, and tampered files that fail with a
// message naming the field and the reason.
import { describe, expect, test } from 'bun:test';
import {
  MAX_FILE_CHARS,
  SAVE_VERSION,
  SaveFileSchema,
  deserialize,
  exportRun,
  importRun,
  migrations,
  serialize,
  summarize,
  type DeserializeResult,
  type GameState,
  type LoadedRun,
} from '@engine/index';
import { canonicalJson, stateHash } from '@engine/util/hash';
import { deepFreeze } from '@engine/util/clone';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';
import { fullState } from '../types/handmade';
import { del, get, list, set, type Obj } from './json';
import { snapshot } from './snapshots';

const content = fixturePack();
const AT = '2026-10-13T09:30:00Z';

function loaded(result: DeserializeResult): LoadedRun {
  if ('error' in result) throw new Error(`expected a loaded run, got: ${result.error}`);
  return result;
}
const errorOf = (result: DeserializeResult): string => {
  if (!('error' in result)) throw new Error('expected an error, but the save loaded');
  return result.error;
};

/** The JSON a shell would hold for `state`: serialize → text → parsed value, ready to tamper with. */
function fileJson(state: GameState = makeState(), mutate?: (f: Obj) => void): Obj {
  const file = JSON.parse(JSON.stringify(serialize(state, freshProfile(), content, AT))) as Obj;
  mutate?.(file);
  return file;
}

describe('round-trip over 50 sim snapshots', () => {
  const shots = Array.from({ length: 50 }, (_, i) => ({ i, ...snapshot(i) }));

  test('the snapshots are deterministic and varied', () => {
    expect(shots.map((s) => stateHash(s.state))).toEqual(Array.from({ length: 50 }, (_, i) => stateHash(snapshot(i).state)));
    expect(new Set(shots.map((s) => stateHash(s.state))).size).toBe(50);
    expect(new Set(shots.map((s) => s.state.world.currentLocationId)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(shots.map((s) => s.state.player.classId))).toEqual(new Set(['ranger', 'wizard']));
    // U30: a Loop 2 walk can Let go into the Threshold; U31: and walk on to the Far Light into the loop after
    expect(new Set(shots.map((s) => s.state.meta.loop))).toEqual(new Set([1, 2, 3, 4]));
    expect(shots.some((s) => s.state.mode === 'dialogue')).toBe(true); // ended at the Apex prompt
    expect(Math.max(...shots.map((s) => s.steps))).toBeGreaterThan(40);
  });

  for (const { i, state, profile } of shots) {
    test(`snapshot ${i}: object and file-text round-trips deep-equal`, () => {
      const file = serialize(state, profile, content, AT);
      const viaObject = loaded(deserialize(JSON.parse(JSON.stringify(file)), content));
      expect(viaObject.state).toEqual(state);
      expect(canonicalJson(viaObject.state)).toBe(canonicalJson(state));
      expect(stateHash(viaObject.state)).toBe(stateHash(state));

      const text = exportRun(state, profile, content, AT);
      expect(text.length).toBeLessThan(300_000); // PLAN §10 risk 3: a slot stays under 300 kB
      const viaText = loaded(importRun(text, content));
      expect(viaText.state).toEqual(state);
      expect(viaText.migratedFrom).toBeNull();
      expect(viaText.warnings).toEqual([]);
      expect(viaText.file.profileLoopAtSave).toBe(profile.loopCounter);
      expect(viaText.file.savedAt).toBe(AT);
    });
  }

  test('a frozen (dev-mode) state serializes and the file does not alias it', () => {
    const state = deepFreeze(snapshot(7).state);
    const file = serialize(state, freshProfile(), content, AT);
    expect(file.state).toEqual(state);
    expect(file.state).not.toBe(state);
    expect(file.state.player).not.toBe(state.player);
    expect(Object.isFrozen(file.state)).toBe(false);
  });
});

describe('the envelope', () => {
  test('serialize writes every PLAN §4.12 field', () => {
    const state = makeState({ locationId: 'loc_silverwood_plaza', day: 4, watch: 2, level: 3 });
    const file = serialize(state, freshProfile({ loopCounter: 2 }), content, AT);
    expect(file).toMatchObject({
      kind: 'run',
      version: SAVE_VERSION,
      seed: 'fixture',
      contentVersion: content.version,
      profileLoopAtSave: 2,
      savedAt: AT,
      savedStep: state.meta.stepCount,
      summary: {
        classId: 'ranger',
        level: 3,
        loop: 1,
        day: 4,
        watch: 2,
        locationId: 'loc_silverwood_plaza',
        title: `Loop 1 · Day 4 · ${content.locations.loc_silverwood_plaza?.name}`,
        playtimeSteps: state.meta.stepCount,
      },
    });
    expect(SaveFileSchema.safeParse(file).success).toBe(true);
    expect(SAVE_VERSION).toBe(1);
    expect(migrations).toEqual({});
  });

  test('summary titles: the Threshold, and a location the pack does not know', () => {
    expect(summarize(makeState({ mode: 'threshold' }), content).title).toBe('Loop 1 · Day 1 · The Threshold');
    const lost = makeState();
    lost.world.currentLocationId = 'loc_not_in_pack';
    expect(summarize(lost, content).title).toBe('Loop 1 · Day 1 · loc_not_in_pack');
  });

  test('a handmade state with every optional part populated survives the schema round-trip', () => {
    const state = fullState();
    const file = serialize(state, freshProfile(), content, AT);
    expect(SaveFileSchema.parse(JSON.parse(JSON.stringify(file))).state).toEqual(state);
  });

  test('deserialize does not mutate its input', () => {
    const json = deepFreeze(fileJson());
    expect(() => loaded(deserialize(json, content))).not.toThrow();
  });

  test('the loaded state is independent of the input object', () => {
    const json = fileJson();
    const gold = get(json, 'state.player.gold') as number;
    const out = loaded(deserialize(json, content));
    out.state.player.gold = gold + 9999;
    expect(get(json, 'state.player.gold')).toBe(gold);
  });
});

describe('tampered files fail with a message that names the field and the reason', () => {
  test('bad JSON text', () => {
    expect(errorOf(deserialize('{"version": 1, "state": ', content))).toMatch(/^Save file is not valid JSON \(/);
    expect(errorOf(deserialize('', content))).toMatch(/not valid JSON/);
    expect(errorOf(importRun('not json at all', content))).toMatch(/not valid JSON/);
  });

  test('oversized text is refused before it is parsed', () => {
    const big = JSON.stringify(fileJson(makeState(), (f) => set(f, 'state.recentLog', [{ step: 0, kind: 'narration', text: 'x'.repeat(MAX_FILE_CHARS) }])));
    expect(big.length).toBeGreaterThan(MAX_FILE_CHARS);
    const error = errorOf(deserialize(big, content));
    expect(error).toMatch(/too large/);
    expect(error).toMatch(/limit is 1000 kB/);
  });

  test('not an object', () => {
    for (const [value, what] of [[null, 'null'], [[], 'an array'], [42, 'number'], ['"text"', 'string']] as const) {
      expect(errorOf(deserialize(value, content))).toMatch(new RegExp(`not a JSON object \\(got ${what}`));
    }
  });

  test('versions: missing, wrong type, negative, newer, too old', () => {
    // U79: a file with no version is read as v1 when it has v1's shape (checkpoint.test.ts has the refusals)
    expect(loaded(deserialize(fileJson(makeState(), (f) => del(f, 'version')), content)).migratedFrom).toBe(0);
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'version', '1')), content))).toBe('Save rejected: version: expected a whole number ≥ 0, got "1"');
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'version', -1)), content))).toMatch(/version: expected a whole number ≥ 0, got -1/);
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'version', 1.5)), content))).toMatch(/got 1.5/);
    const newer = errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'version', 99)), content));
    expect(newer).toMatch(/newer version of the game \(file v99, this build reads up to v1\); update the game/);
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'version', 0)), content))).toMatch(/v0, which is too old to open \(no migration from v0\)/);
  });

  test('a missing field is named with its path', () => {
    expect(errorOf(deserialize(fileJson(makeState(), (f) => del(f, 'state.player.hp')), content))).toBe(
      'Save rejected: state.player.hp: is missing (expected number)',
    );
    expect(errorOf(deserialize(fileJson(makeState(), (f) => del(f, 'seed')), content))).toBe('Save rejected: seed: is missing (expected string)');
    expect(errorOf(deserialize(fileJson(makeState(), (f) => del(f, 'state')), content))).toMatch(/^Save rejected: state: is missing \(expected object\)/);
    expect(errorOf(deserialize(fileJson(makeState(), (f) => del(f, 'summary.title')), content))).toBe('Save rejected: summary.title: is missing (expected string)');
  });

  test('a wrong type is named with its path and what was found', () => {
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'state.player.hp', '40')), content))).toBe(
      'Save rejected: state.player.hp: expected number, got string',
    );
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'state.player.inventory.0.qty', null)), content))).toBe(
      'Save rejected: state.player.inventory[0].qty: expected number, got null',
    );
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'state.mode', 'sleeping')), content))).toMatch(
      /state\.mode: expected one of "title" \| "explore" \| "combat" \| "dialogue" \| "threshold" \| "ending", got "sleeping"/,
    );
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'state.player.stats.strength', 1e999)), content))).toMatch(/state\.player\.stats\.strength/);
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'kind', 'save')), content))).toBe('Save rejected: kind: expected "run", got "save"');
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'state.flags.flag_x', [])), content))).toMatch(/state\.flags\.flag_x: matches none of the allowed shapes/);
  });

  test('an unknown field is refused, not ignored', () => {
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'state.player.godMode', true)), content))).toBe(
      "Save rejected: state.player: unknown field 'godMode'",
    );
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'extra', 1)), content))).toBe("Save rejected: (file): unknown field 'extra'");
  });

  test('several problems are listed, then counted', () => {
    const error = errorOf(
      deserialize(
        fileJson(makeState(), (f) => {
          for (const field of ['hp', 'mp', 'gold', 'xp', 'level', 'corruption', 'name']) del(f, `state.player.${field}`);
        }),
        content,
      ),
    );
    expect(error.split('; ')).toHaveLength(6);
    expect(error).toMatch(/; and 2 more$/);
  });

  test('a profile file is pointed to the profile importer; the seed must agree with the state', () => {
    expect(errorOf(deserialize({ kind: 'profile', version: 1, profile: {} }, content))).toMatch(/this is a profile file, not a run save/);
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'seed', 'other')), content))).toBe(
      'Save rejected: seed: "other" does not match state.meta.seed "fixture"',
    );
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'state.meta.version', 7)), content))).toMatch(/state\.meta\.version: expected 1, got 7/);
  });

  test('a hostile __proto__ key cannot poison anything', () => {
    const text = JSON.stringify(fileJson()).replace('"flags":{}', '"flags":{"__proto__":{"polluted":true}}');
    expect(text).toContain('__proto__');
    deserialize(text, content);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('the state against the content pack (DESIGN §14.4)', () => {
  test('an unknown class or current location is fatal and says which', () => {
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'state.player.classId', 'bard')), content))).toBe(
      "Save rejected: state.player.classId: class 'bard' is not in this version of the game",
    );
    expect(errorOf(deserialize(fileJson(makeState(), (f) => set(f, 'state.world.currentLocationId', 'loc_gone')), content))).toBe(
      "Save rejected: state.world.currentLocationId: location 'loc_gone' is not in this version of the game",
    );
  });

  test('items, abilities, quests and a previous location the pack lost are dropped with a warning each', () => {
    const state = makeState({ items: [{ itemId: 'item_chronos_lens', equip: true }], quests: { q_echo_crystal: 'crystal_found' } });
    state.world.previousLocationId = 'loc_whispering_ruins';
    const json = fileJson(state, (f) => {
      const dropped = (uid: string, itemId: string) => ({ uid, itemId, qty: 1, rarity: 'common', affixes: [] });
      set(f, 'contentVersion', '0.0.1');
      list(f, 'state.player.inventory').push(dropped('i90', 'item_removed'));
      set(f, 'state.player.equipment.trinket1.itemId', 'item_removed_trinket');
      list(f, 'state.player.abilitiesUnlocked').push('ab_removed');
      set(f, 'state.quests.q_removed', { status: 'active', stage: 's', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [] });
      set(f, 'state.world.previousLocationId', 'loc_removed');
      set(f, 'state.world.locationStates.loc_whispering_ruins', {
        visited: true, visitCount: 1, itemsSpawned: true, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
        unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
        items: [dropped('i91', 'item_removed_ground')],
      });
      set(f, 'state.merchants.npc_old', { stock: [dropped('i92', 'item_removed_stock')], lastRestockDay: 1, purchasesThisLoop: 0 });
    });
    const out = loaded(deserialize(json, content));
    expect(out.warnings).toEqual([
      `saved with content 0.0.1; this build has ${content.version}`,
      "dropped unknown item 'item_removed' (inventory)",
      "dropped unknown item 'item_removed_trinket' (equipped trinket1)",
      "dropped unknown item 'item_removed_ground' (on the ground at loc_whispering_ruins)",
      "dropped unknown item 'item_removed_stock' (npc_old's stock)",
      "dropped unknown ability 'ab_removed'",
      "dropped unknown quest 'q_removed'",
      "forgot the previous location 'loc_removed' (not in this version of the game)",
    ]);
    expect(out.state.player.inventory.some((i) => i.itemId === 'item_removed')).toBe(false);
    expect(out.state.player.equipment.trinket1).toBeNull();
    expect(out.state.quests.q_removed).toBeUndefined();
    expect(out.state.quests.q_echo_crystal).toBeDefined();
    expect(out.state.merchants.npc_old?.stock).toEqual([]);
    expect(out.state.world.previousLocationId).toBeNull();
  });
});
