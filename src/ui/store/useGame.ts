// React bindings for the store (PLAN §6.1) over `useSyncExternalStore`. Selectors keep re-renders scoped: a component
// re-renders only when its selected value changes (by `Object.is`, or the `isEqual` it passes).
//
// Pattern for later screens: select the smallest value you draw (`useGame((s) => s.player.hp)`); a selector that
// builds a new object or array each time must pass `isEqual` (e.g. `shallowEqual`), or it re-renders on every step.
import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Action, ContentPack, GameEvent, GameState, Profile } from '@engine/index';
import type { GameStore, Notice } from './gameStore';

export const StoreContext = createContext<GameStore | null>(null);

/** `<GameProvider store={store}>` (React 19 renders a context as its own provider). */
export const GameProvider = StoreContext;

export function useStore(): GameStore {
  const store = useContext(StoreContext);
  if (store === null) throw new Error('useStore: no <GameProvider> above this component');
  return store;
}

/** Shallow equality for selectors that return arrays or flat objects. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every((k) => Object.hasOwn(rb, k) && Object.is(ra[k], rb[k]));
}

/**
 * A memoized snapshot reader: recomputes only when the source reference changes, and keeps the previous selection
 * when `isEqual` says the new one is the same (so `useSyncExternalStore` sees a stable value).
 */
export function selectorSnapshot<S, T>(read: () => S, selector: (s: S) => T, isEqual: (a: T, b: T) => boolean = Object.is): () => T {
  let last: { source: S; value: T } | null = null;
  return () => {
    const source = read();
    if (last !== null && last.source === source) return last.value;
    const value = selector(source);
    if (last !== null && isEqual(last.value, value)) {
      last = { source, value: last.value };
      return last.value;
    }
    last = { source, value };
    return value;
  };
}

function useSelected<S, T>(read: (store: GameStore) => S, selector: (s: S) => T, isEqual?: (a: T, b: T) => boolean): T {
  const store = useStore();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const snapshotRef = useRef<{ store: GameStore; get: () => T } | null>(null);
  if (snapshotRef.current === null || snapshotRef.current.store !== store) {
    snapshotRef.current = { store, get: selectorSnapshot(() => read(store), (s) => selectorRef.current(s), isEqual) };
  }
  const get = snapshotRef.current.get;
  return useSyncExternalStore(store.subscribe, get, get);
}

export function useGame<T>(selector: (s: GameState) => T, isEqual?: (a: T, b: T) => boolean): T {
  return useSelected((store) => store.getState(), selector, isEqual);
}

export function useProfile<T>(selector: (p: Profile) => T, isEqual?: (a: T, b: T) => boolean): T {
  return useSelected((store) => store.getProfile(), selector, isEqual);
}

export function useContent(): ContentPack {
  return useStore().getContent();
}

export function useDispatch(): (action: Action) => void {
  const store = useStore();
  return useCallback((action: Action) => void store.dispatch(action), [store]);
}

export function useLegal(): Action[] {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getLegal, store.getLegal);
}

/** True when `action` is legal now (re-evaluated on every state change). */
export function useIsLegal(action: Action): boolean {
  const store = useStore();
  useLegal(); // subscribes, so the answer is re-read on every state change
  return store.isLegal(action);
}

export function useNotices(): readonly Notice[] {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getNotices, store.getNotices);
}

/** Effect-scoped event subscription (audio, toasts, announcer); the latest handler is always the one called. */
export function useGameEvents(handler: (events: GameEvent[], state: GameState) => void): void {
  const store = useStore();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => store.onEvents((events, state) => ref.current(events, state)), [store]);
}
