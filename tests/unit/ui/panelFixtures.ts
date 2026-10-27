// Shared set-up for the U67 panel tests: the real pack (the item panels name real things — Kaelen, the Emberforge — and the
// real affix and recipe tables) and the two scenario states that stand at them, built once and handed out as copies.
import { isLegal, type Action, type ContentPack, type GameState, type ItemInstance, type Profile } from '@engine/index';
import { buildContentPack } from '@content/index';
import { loadScenario } from '@sim/scenarios';

export const pack: ContentPack = buildContentPack();

export interface Place {
  state: GameState;
  profile: Profile;
}

const cache = new Map<string, Place>();

/** A scenario's state, as a copy the test may edit. */
export function place(id: 'loop1_respite' | 'loop1_emberforge'): Place {
  let built = cache.get(id);
  if (built === undefined) {
    built = loadScenario(id, pack);
    cache.set(id, built);
  }
  return { state: structuredClone(built.state), profile: structuredClone(built.profile) };
}

/** The engine's own legality check for `at`'s state: what a panel's store.isLegal does. */
export const legalFor =
  (at: Place) =>
  (a: Action): boolean =>
    isLegal(at.state, a, pack, at.profile);

/** The first instance in the pack (or worn) of `itemId`. */
export function find(state: GameState, itemId: string): ItemInstance {
  const inst = [...state.player.inventory, ...Object.values(state.player.equipment).filter((i): i is ItemInstance => i !== null)].find((i) => i.itemId === itemId);
  if (inst === undefined) throw new Error(`no ${itemId} in the pack`);
  return inst;
}

/** Adds an item to the pack as its own stack (a test fixture; nothing is checked). */
export function give(state: GameState, itemId: string, patch: Partial<ItemInstance> = {}): ItemInstance {
  const inst: ItemInstance = { uid: `t${state.meta.nextUid++}`, itemId, qty: 1, rarity: 'common', affixes: [], ...patch };
  state.player.inventory.push(inst);
  return inst;
}
