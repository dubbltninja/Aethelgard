// The hotkey resolver (PLAN §6.6, DESIGN §16.4, D-035, D-066 #13): pure, so the keyboard rules are unit-tested without
// a DOM. `useHotkeys` (useHotkeys.tsx) registers per-screen maps as layers; one window listener normalizes each
// keydown, asks `resolveHotkey` which binding (if any) it means, and runs it.
//
// Rules, in the order they apply:
//   - keys are normalized: lower case, `ctrl+`/`alt+`/`shift+` prefixes in that order (Cmd counts as Ctrl), names for
//     space/escape/arrows; Shift is implied (not written) for symbols such as `?`;
//   - while a text field has focus only `escape` resolves (hotkeys never eat typing);
//   - keys the focused control handles itself (Enter/Space on a button, arrows in a radio group) are left to it;
//   - layers are searched from the top; a modal layer (an open panel or dialog) hides everything below it;
//   - `panel` bindings (I, Q, C, B, M, L) answer to their Shift form always and to the plain letter only outside a
//     fight: in combat C, I, G, F are combat actions (D-066 #13);
//   - W, A, S, D resolve only while the map has focus (WASD works only on the map);
//   - Delete always asks first (a binding's `confirm` text, or "<label>?");
//   - auto-repeat only repeats arrow keys.

export type HotkeyGroup = 'menu' | 'action' | 'panel' | 'map' | 'list' | 'system';

export interface Hotkey {
  run: () => void;
  /** Shown in the key legend and the `?` overlay; also the confirm question for Delete. */
  label: string;
  /** Checked at key time; a false `when` lets the key fall through to lower layers. */
  when?: () => boolean;
  group?: HotkeyGroup;
  /** Ask before running (always on for Delete). */
  confirm?: string;
  /** Works but is not listed in the legend (e.g. the second spelling of a key). */
  hidden?: boolean;
}

export type HotkeyMap = Record<string, Hotkey>;

export interface HotkeyLayer {
  id: string;
  /** What the overlay calls this map ("Title", "Global", …). */
  scope: string;
  map: HotkeyMap;
  /** An open panel or dialog: layers below it do not receive keys. */
  modal?: boolean;
}

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
}

export interface HotkeyContext {
  /** A fight is on screen: panel letters need Shift. */
  inCombat: boolean;
  /** A text field (input, textarea, contenteditable) has focus. */
  focusInInput: boolean;
  /** The illustrated map has focus (WASD). */
  onMap?: boolean;
  /** Normalized keys the focused element handles natively (see `nativeKeysOf` in a11y/focus.ts). */
  nativeKeys?: readonly string[];
}

export interface HotkeyMatch {
  key: string;
  hotkey: Hotkey;
  layer: string;
  /** Ask this first; run only on yes. */
  confirm?: string;
}

const NAMED: Record<string, string> = {
  ' ': 'space',
  spacebar: 'space',
  esc: 'escape',
  del: 'delete',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
};
const MODIFIERS = new Set(['shift', 'control', 'alt', 'meta', 'os', 'altgraph', 'capslock', 'fn', 'hyper', 'super']);
const WASD = new Set(['w', 'a', 's', 'd']);
const ARROWS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

/** The canonical name of a keydown (`shift+i`, `ctrl+s`, `arrowup`, `?`, `1`), or null for a bare modifier. */
export function normalizeKey(e: KeyLike): string | null {
  if (e.key === '' || e.key === 'Unidentified' || e.key === 'Dead') return null;
  const lower = e.key.toLowerCase();
  const base = NAMED[lower] ?? lower;
  if (MODIFIERS.has(base)) return null;
  // Shift is written for letters and named keys; for symbols ('?', '!') it is part of the character.
  const shiftCounts = base.length > 1 || /^[a-z]$/.test(base);
  const prefix = `${e.ctrlKey || e.metaKey ? 'ctrl+' : ''}${e.altKey ? 'alt+' : ''}${e.shiftKey && shiftCounts ? 'shift+' : ''}`;
  return `${prefix}${base}`;
}

/** `shift+i` → `i`; anything else → null. */
function unshifted(key: string): string | null {
  const m = /^shift\+([a-z])$/.exec(key);
  return m ? (m[1] ?? null) : null;
}

function usable(binding: Hotkey | undefined): binding is Hotkey {
  return binding !== undefined && (binding.when === undefined || binding.when());
}

/** Finds the binding a keydown means under `ctx`, or null if none (the event is then left to the browser). */
export function resolveHotkey(maps: HotkeyMap | readonly HotkeyLayer[], event: KeyLike, ctx: HotkeyContext): HotkeyMatch | null {
  const key = normalizeKey(event);
  if (key === null) return null;
  if (ctx.focusInInput && key !== 'escape') return null;
  if (ctx.nativeKeys?.includes(key)) return null;
  if (event.repeat && !ARROWS.has(key)) return null;
  if (WASD.has(key) && !ctx.onMap) return null;

  const layers: readonly HotkeyLayer[] = Array.isArray(maps) ? maps : [{ id: 'map', scope: 'map', map: maps as HotkeyMap }];
  const plain = unshifted(key);
  for (const layer of layers) {
    const exact = layer.map[key];
    const blockedPanel = exact?.group === 'panel' && ctx.inCombat && plain === null;
    if (!blockedPanel && usable(exact)) return match(key, exact, layer);
    if (plain !== null) {
      const viaShift = layer.map[plain];
      if (viaShift?.group === 'panel' && usable(viaShift)) return match(key, viaShift, layer);
    }
    if (layer.modal) break;
  }
  return null;
}

function match(key: string, hotkey: Hotkey, layer: HotkeyLayer): HotkeyMatch {
  const confirm = hotkey.confirm ?? (key === 'delete' ? `${hotkey.label}?` : undefined);
  return confirm === undefined ? { key, hotkey, layer: layer.id } : { key, hotkey, layer: layer.id, confirm };
}

/** How a key is written in the legend: `shift+i` → `Shift+I`, `arrowup` → `↑`, `escape` → `Esc`. */
export function keyLabel(key: string): string {
  return key
    .split('+')
    .map((part) => KEY_WORDS[part] ?? (part.length === 1 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1)))
    .join('+');
}

const KEY_WORDS: Record<string, string> = {
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  escape: 'Esc',
  enter: 'Enter',
  space: 'Space',
  delete: 'Delete',
  tab: 'Tab',
};

/** Visible bindings of a map in legend order, with keys sharing a label grouped (`↑/↓ Move`). */
export function legendEntries(map: HotkeyMap): { keys: string[]; label: string; group?: HotkeyGroup }[] {
  const out: { keys: string[]; label: string; group?: HotkeyGroup }[] = [];
  for (const [key, hotkey] of Object.entries(map)) {
    if (hotkey.hidden || (hotkey.when !== undefined && !hotkey.when())) continue;
    const same = out.find((e) => e.label === hotkey.label);
    if (same) same.keys.push(key);
    else out.push(hotkey.group === undefined ? { keys: [key], label: hotkey.label } : { keys: [key], label: hotkey.label, group: hotkey.group });
  }
  return out;
}
