// `useHotkeys` (PLAN §6.6): a screen, panel or dialog declares its keys as a map; the Shell's single keydown listener
// resolves each key against every registered map (hotkeys.ts) and runs the winner. The key legend and the `?`
// overlay render from the same registry, so what the player reads is exactly what the keys do.
//
// Pattern for later screens:
//   useHotkeys({ g: { run: guard, label: 'Guard', group: 'action', when: () => canGuard } }, { scope: 'Combat' });
// Keys are normalized names (`i`, `shift+i`, `arrowup`, `1`…`9`, `escape`, `?`, `space`, `enter`, `ctrl+s`).
// Number keys follow displayed order: build the map from the list you render, and put the number in the label.
import { createContext, useContext, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createEmitter } from '../store/eventBus';
import type { HotkeyLayer, HotkeyMap } from './hotkeys';

/** Layer order: dialogs over panels over the screen over the Shell's global keys. */
export const HOTKEY_LEVELS = { global: 0, screen: 10, panel: 20, dialog: 30 } as const;
export type HotkeyLevel = keyof typeof HOTKEY_LEVELS;

interface Entry {
  id: string;
  level: number;
  order: number;
  layer: () => HotkeyLayer;
}

export interface HotkeyRegistry {
  register(id: string, level: HotkeyLevel, layer: () => HotkeyLayer): () => void;
  /** Registered layers, top first (higher level, then later registration). */
  layers(): HotkeyLayer[];
  subscribe(listener: () => void): () => void;
  /** Changes whenever a layer is added, removed or relabelled. */
  version(): number;
  /** A layer's labels changed: re-render the legend. */
  touch(): void;
}

export function createHotkeyRegistry(): HotkeyRegistry {
  const entries: Entry[] = [];
  const changed = createEmitter<[]>();
  let order = 0;
  let version = 0;
  const bump = (): void => {
    version += 1;
    changed.emit();
  };
  return {
    register(id, level, layer) {
      const entry: Entry = { id, level: HOTKEY_LEVELS[level], order: order++, layer };
      entries.push(entry);
      bump();
      return () => {
        const at = entries.indexOf(entry);
        if (at >= 0) entries.splice(at, 1);
        bump();
      };
    },
    layers: () => [...entries].sort((a, b) => b.level - a.level || b.order - a.order).map((e) => e.layer()),
    subscribe: (listener) => changed.on(listener),
    version: () => version,
    touch: bump,
  };
}

export const HotkeyRegistryContext = createContext<HotkeyRegistry | null>(null);

export interface UseHotkeysOptions {
  enabled?: boolean;
  /** The overlay's heading for this map. */
  scope?: string;
  level?: HotkeyLevel;
  /** Hide every layer below (open panels and dialogs). */
  modal?: boolean;
}

/** Registers `map` while the component is mounted (and `enabled`); the latest map is always the one consulted. */
export function useHotkeys(map: HotkeyMap, opts: UseHotkeysOptions = {}): void {
  const registry = useContext(HotkeyRegistryContext);
  const { enabled = true, scope = 'Screen', level = 'screen', modal = false } = opts;
  const id = useId();
  const mapRef = useRef(map);
  mapRef.current = map;
  useLayoutEffect(() => {
    if (registry === null || !enabled) return undefined;
    return registry.register(id, level, () => ({ id, scope, map: mapRef.current, modal }));
  }, [registry, enabled, id, level, scope, modal]);
  const signature = Object.entries(map)
    .map(([key, h]) => `${key}=${h.label}${h.hidden ? '~' : ''}`)
    .join('|');
  useLayoutEffect(() => {
    registry?.touch();
  }, [registry, signature]);
}

const NO_LAYERS: HotkeyLayer[] = [];

/** The registered layers, top first; re-renders when they change (for the legend and the `?` overlay). */
export function useHotkeyLayers(): HotkeyLayer[] {
  const registry = useContext(HotkeyRegistryContext);
  const version = useSyncExternalStore(
    registry?.subscribe ?? noopSubscribe,
    registry?.version ?? zero,
    registry?.version ?? zero,
  );
  const cache = useRef<{ version: number; layers: HotkeyLayer[] } | null>(null);
  if (registry === null) return NO_LAYERS;
  if (cache.current === null || cache.current.version !== version) cache.current = { version, layers: registry.layers() };
  return cache.current.layers;
}

const noopSubscribe = (): (() => void) => () => undefined;
const zero = (): number => 0;
