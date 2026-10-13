// U13: newRun minimum (PLAN §4.11, §8.1 "newRun"; D-047, D-067.2, D-070.5).
import { describe, expect, test } from 'bun:test';
import {
  GameStateSchema,
  STATE_VERSION,
  baseMaxima,
  carryOverLevel,
  newRun,
  seedFromString,
  type ContentPack,
  type Profile,
} from '@engine/index';
import { deepFreeze } from '@engine/util/clone';
import { stateHash } from '@engine/util/hash';
import { minimalProfile } from './types/handmade';
import { standInPack } from './standInPack';

const content = deepFreeze(standInPack());
const profileWith = (patch: Partial<Profile>): Profile => deepFreeze({ ...minimalProfile(), ...patch });
const mastery = (bestLevel: number) => ({ loopsPlayed: 1, mastered: [], endings: [], bestLevel, bestDays: null });

describe('Loop 1 start', () => {
  const profile = deepFreeze(minimalProfile());
  const s = newRun('aethelgard', 'ranger', content, profile);

  test('validates against GameStateSchema', () => {
    const parsed = GameStateSchema.safeParse(s);
    if (!parsed.success) throw new Error(parsed.error.message);
    expect(parsed.success).toBe(true);
  });

  test('Day 1 Dawn at the start location, exploring, base clock', () => {
    expect(s.mode).toBe('explore');
    expect(s.world.currentLocationId).toBe('loc_whispering_ruins');
    expect(s.world.discovered).toEqual(['loc_whispering_ruins']);
    expect(s.clock).toEqual({ ticks: 0, limitTicks: 116, modifiers: [], frozen: false, expired: false });
    expect(s.before).toBeNull();
    expect(s.meta).toMatchObject({ seed: 'aethelgard', loop: 1, version: STATE_VERSION, stepCount: 0, runId: 'aethelgard:1', modifiers: [] });
    expect(s.rng).toEqual(seedFromString('aethelgard'));
  });

  test('class base stats and DESIGN §3.3 L1 maxima (Ranger 120/48)', () => {
    expect(s.player).toMatchObject({
      name: 'Wayfinder',
      classId: 'ranger',
      level: 1,
      xp: 0,
      stats: { strength: 10, magic: 6, agility: 8 },
      hp: 120,
      hpMax: 120,
      mp: 48,
      mpMax: 48,
      gold: 30,
      corruption: 0,
      apHalf: 2,
      statPoints: 0,
    });
  });

  test('starter items: equipped where asked, stackables as one stack, no Amulet in Loop 1', () => {
    expect(s.player.equipment.weapon).toMatchObject({ itemId: 'item_hunting_bow', qty: 1, rarity: 'common' });
    expect(s.player.equipment.armor).toMatchObject({ itemId: 'item_leather_armor' });
    expect(s.player.inventory).toEqual([{ uid: 'i3', itemId: 'item_ley_touched_tonic', qty: 2, rarity: 'common', affixes: [] }]);
    expect(s.meta.nextUid).toBe(4);
  });

  test('world, reputation, quests and flags start empty', () => {
    expect(s.reputation).toEqual({ remnants: 0, weavers: 0, ironclad: 0 });
    expect(s.quests).toEqual({});
    expect(s.flags).toEqual({});
    expect(s.companions).toEqual({ recruited: {}, activeId: null });
    expect(s.world.hordeActive).toBe(false);
    expect(s.combat).toBeNull();
  });

  test('pure and deterministic: frozen inputs untouched, same args → same state', () => {
    const again = newRun('aethelgard', 'ranger', content, profile);
    expect(again).toEqual(s);
    expect(stateHash(again)).toBe(stateHash(s));
    expect(again.player.inventory).not.toBe(s.player.inventory);
  });

  test('player name option; startingAbilities copied; unknown class throws', () => {
    const w = newRun('x', 'wizard', content, profile, { playerName: 'Oriel' });
    expect(w.player.name).toBe('Oriel');
    expect(w.meta.playerName).toBe('Oriel');
    expect(w.player.abilitiesUnlocked).toEqual(['wiz_echo_bolt']);
    expect(w.player.gold).toBe(30);
    expect(() => newRun('x', 'bard', content, profile)).toThrow("unknown class 'bard'");
  });
});

describe('Loop 2+ (D-047) and modifiers', () => {
  test('the Amulet of Echoes is carried from Loop 2, at its fixed rarity', () => {
    const s = newRun('p1:2', 'ranger', content, profileWith({ loopCounter: 2 }));
    expect(s.meta.loop).toBe(2);
    expect(s.meta.runId).toBe('p1:2:2');
    expect(s.player.inventory.map((i) => i.itemId)).toEqual(['item_ley_touched_tonic', 'item_amulet_of_echoes']);
    expect(s.player.inventory[1]!.rarity).toBe('legendary');
    expect(GameStateSchema.safeParse(s).success).toBe(true);
  });

  test('active modifiers are copied sorted; Frayed Clock sets the base limit to 80 ticks', () => {
    const s = newRun('m', 'ranger', content, profileWith({ modifiers: { mod_glass: true, mod_frayed_clock: true, mod_iron_loop: false } }));
    expect(s.meta.modifiers).toEqual(['mod_frayed_clock', 'mod_glass']);
    expect(s.clock.limitTicks).toBe(80);
    const plain = newRun('m', 'ranger', content, profileWith({ modifiers: { mod_glass: true } }));
    expect(plain.clock.limitTicks).toBe(116);
  });
});

describe('level carry-over (D-067.2, D-070.5)', () => {
  test('⌊0.6 × best level over all classes⌋, min 1, cap 10', () => {
    const cases: [Record<string, number>, number][] = [
      [{}, 1],
      [{ ranger: 1 }, 1],
      [{ ranger: 3 }, 1],
      [{ ranger: 4 }, 2],
      [{ ranger: 13 }, 7],
      [{ ranger: 5, wizard: 13 }, 7],
      [{ ranger: 17 }, 10],
      [{ wizard: 20 }, 10],
    ];
    for (const [best, level] of cases) {
      const classMastery = Object.fromEntries(Object.entries(best).map(([id, lvl]) => [id, mastery(lvl)]));
      expect(carryOverLevel(profileWith({ classMastery }))).toBe(level);
    }
  });

  test('a carried-over start has that level’s maxima, stat points and ability points', () => {
    const profile = profileWith({ loopCounter: 2, classMastery: { ranger: mastery(13) } });
    const s = newRun('p1:2', 'wizard', content, profile);
    expect(s.player.level).toBe(7);
    // wizard: 84 + 6·6 + 2·6 = 132 HP; 50 + 5·6 + 2·11 = 102 MP
    expect(s.player).toMatchObject({ hp: 132, hpMax: 132, mp: 102, mpMax: 102, statPoints: 6, apHalf: 14, xp: 0 });
    expect(GameStateSchema.safeParse(s).success).toBe(true);
  });

  test('baseMaxima reproduces DESIGN §3.3 reference values (before stat points and gear)', () => {
    const { ranger, wizard } = content.classes;
    expect(baseMaxima(ranger!, 4)).toEqual({ hpMax: 144, mpMax: 57 });
    expect(baseMaxima(ranger!, 8)).toEqual({ hpMax: 176, mpMax: 69 });
    expect(baseMaxima(wizard!, 12)).toEqual({ hpMax: 162, mpMax: 127 });
  });
});

describe('equipping starter items', () => {
  test('two trinket slots, then inventory; slotless or occupied → inventory; fixed affixes copied', () => {
    const base = standInPack();
    const pack: ContentPack = {
      ...base,
      classes: {
        ...base.classes,
        ranger: {
          ...base.classes.ranger!,
          starterItems: [
            { itemId: 'item_silver_ring', equip: true, count: 3 },
            { itemId: 'item_hunting_bow', equip: true },
            { itemId: 'item_apprentice_staff', equip: true },
            { itemId: 'item_chronos_lens', equip: true },
          ],
        },
      },
    };
    const s = newRun('e', 'ranger', pack, minimalProfile());
    expect(s.player.equipment.trinket1).toMatchObject({ itemId: 'item_silver_ring', rarity: 'uncommon', affixes: ['affix_of_embers'] });
    expect(s.player.equipment.trinket2).toMatchObject({ itemId: 'item_silver_ring' });
    expect(s.player.equipment.weapon).toMatchObject({ itemId: 'item_hunting_bow' });
    expect(s.player.inventory.map((i) => i.itemId)).toEqual(['item_silver_ring', 'item_apprentice_staff', 'item_chronos_lens']);
    expect(new Set([...s.player.inventory, s.player.equipment.trinket1!, s.player.equipment.trinket2!].map((i) => i.uid)).size).toBe(5);
    expect(GameStateSchema.safeParse(s).success).toBe(true);
  });
});
