// Focus helpers (PLAN §6.7): what the focused element does with keys on its own, what can take focus inside a
// container, and where focus goes when a screen or panel opens. Element-shaped inputs are duck-typed so the rules are
// unit-tested without a DOM.

/** The parts of an Element these helpers read. */
export interface FocusTarget {
  tagName: string;
  getAttribute(name: string): string | null;
  isContentEditable?: boolean;
}

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'number', 'password', 'tel', 'url', 'date', 'time', 'datetime-local', 'month', 'week']);
const ARROWS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

/** A field the player types into: hotkeys are off while it has focus (PLAN §6.6). */
export function isTextEntry(el: FocusTarget | null | undefined): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag !== 'input') return false;
  return TEXT_INPUT_TYPES.has((el.getAttribute('type') ?? '').toLowerCase());
}

/** Normalized keys (hotkeys.ts `normalizeKey`) the element handles natively, so hotkeys leave them alone. */
export function nativeKeysOf(el: FocusTarget | null | undefined): readonly string[] {
  if (!el) return [];
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  if (tag === 'button' || tag === 'summary' || (tag === 'a' && el.getAttribute('href') !== null) || role === 'button') return ['enter', 'space'];
  if (tag === 'select') return ['enter', 'space', ...ARROWS];
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? '').toLowerCase();
    if (type === 'checkbox') return ['space'];
    if (type === 'radio') return ['space', ...ARROWS];
    if (type === 'range') return [...ARROWS, 'home', 'end', 'pageup', 'pagedown'];
    if (type === 'button' || type === 'submit' || type === 'reset' || type === 'file') return ['enter', 'space'];
  }
  if (role === 'slider' || role === 'radio' || role === 'tab') return ['space', ...ARROWS];
  return [];
}

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Visible, enabled, tabbable elements inside `root`, in DOM order. */
export function focusablesIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((el) => !el.closest('[inert]') && el.getClientRects().length > 0);
}

/**
 * Where a newly shown view puts focus: its `[data-autofocus]` element if there is one, else its first heading made
 * focusable (`tabindex="-1"`), else its first focusable. Screen readers then announce the new view. `fromTop`: the view
 * is a new screen, so the page scrolls to the top and focus does not scroll it.
 */
export function focusView(root: HTMLElement | null, opts: { fromTop?: boolean } = {}): void {
  if (!root) return;
  // A new screen starts at its top (D-129): focusing a control further down (combat's Attack) must not scroll the stage —
  // the picture of the fight — off the screen. Panels and sub-views keep scrolling their target into view.
  if (opts.fromTop === true && typeof window !== 'undefined') window.scrollTo({ top: 0 });
  const preferred = root.querySelector<HTMLElement>('[data-autofocus]');
  const heading = root.querySelector<HTMLElement>('h1, h2');
  const target = preferred ?? heading ?? focusablesIn(root)[0] ?? null;
  if (target === heading && heading !== null && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  target?.focus({ preventScroll: opts.fromTop === true });
}

/** The parts of a Document `focusFallback` reads (so the rule is unit-tested without a DOM). */
export interface FocusDoc {
  activeElement: (FocusTarget & { isConnected: boolean }) | null;
  body: unknown;
  querySelector(selector: string): (FocusTarget & { focus(): void; hasAttribute(name: string): boolean; setAttribute(name: string, value: string): void }) | null;
}

/**
 * Where focus goes when a panel closes and the element that opened it cannot take focus back: `vanished` says it was there
 * but is gone (it sat inside another panel that closed with it, D-120's open item), so the tab bar's Menu tab is the nearest
 * place; with no opener at all (a key pressed with nothing focused) the screen's heading is. Each falls back to the other.
 * Does nothing when focus is already somewhere real — not on the page, not inside the panel that is `closing`.
 */
export function focusFallback(vanished: boolean, doc: FocusDoc = document as unknown as FocusDoc, closing?: { contains(node: unknown): boolean }): void {
  const active = doc.activeElement;
  if (active !== null && active !== doc.body && active.isConnected && closing?.contains(active) !== true) return;
  const menu = doc.querySelector('.tab-bar [data-tab="menu"]:not([disabled])');
  const heading = doc.querySelector('#main h1, #main h2');
  const target = vanished ? (menu ?? heading) : (heading ?? menu);
  if (target === null) return;
  if (target === heading && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus();
}
