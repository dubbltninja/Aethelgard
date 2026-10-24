// Focus return when a panel's opener cannot take it back (D-120's open item; U70): the rule of `focusFallback`, over a
// duck-typed document so it runs without a DOM. The real thing is onboarding.spec.ts.
import { describe, expect, test } from 'bun:test';
import { focusFallback, type FocusDoc } from '@ui/a11y/focus';

interface FakeEl {
  tagName: string;
  isConnected: boolean;
  attrs: Record<string, string>;
  focused: boolean;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  focus(): void;
}

const el = (tagName: string, isConnected = true): FakeEl => {
  const attrs: Record<string, string> = {};
  const self: FakeEl = {
    tagName,
    isConnected,
    attrs,
    focused: false,
    getAttribute: (n) => attrs[n] ?? null,
    hasAttribute: (n) => n in attrs,
    setAttribute: (n, v) => void (attrs[n] = v),
    focus: () => void (self.focused = true),
  };
  return self;
};

function doc(over: { active?: FakeEl | null; menu?: FakeEl | null; heading?: FakeEl | null }): { d: FocusDoc; body: FakeEl } {
  const body = el('BODY');
  const d: FocusDoc = {
    activeElement: over.active === undefined ? body : over.active,
    body,
    querySelector: (selector) => (selector.includes('data-tab="menu"') ? (over.menu ?? null) : selector.includes('h1') ? (over.heading ?? null) : null),
  };
  return { d, body };
}

describe('focusFallback', () => {
  test('an opener that vanished (it sat in the Menu panel): the Menu tab', () => {
    const menu = el('BUTTON');
    const heading = el('H1');
    focusFallback(true, doc({ menu, heading }).d);
    expect(menu.focused).toBe(true);
    expect(heading.focused).toBe(false);
  });

  test('no opener at all (a key pressed with nothing focused): the screen’s heading, made focusable', () => {
    const menu = el('BUTTON');
    const heading = el('H1');
    focusFallback(false, doc({ menu, heading }).d);
    expect(heading.focused).toBe(true);
    expect(heading.attrs.tabindex).toBe('-1');
    expect(menu.focused).toBe(false);
  });

  test('each falls back to the other; nothing at all is fine', () => {
    const menu = el('BUTTON');
    focusFallback(false, doc({ menu }).d);
    expect(menu.focused).toBe(true);
    const heading = el('H2');
    focusFallback(true, doc({ heading }).d);
    expect(heading.focused).toBe(true);
    expect(() => focusFallback(true, doc({}).d)).not.toThrow();
  });

  test('focus still inside the panel that is closing is not "somewhere real"', () => {
    const heading = el('H1');
    const inside = el('BUTTON');
    focusFallback(false, doc({ active: inside, heading }).d, { contains: (n) => n === inside });
    expect(heading.focused).toBe(true);
    const outside = el('BUTTON');
    const other = el('H1');
    focusFallback(false, doc({ active: outside, heading: other }).d, { contains: (n) => n === inside });
    expect(other.focused).toBe(false);
  });

  test('focus that is already somewhere real is left alone; a disconnected element does not count', () => {
    const menu = el('BUTTON');
    const there = el('BUTTON');
    focusFallback(true, doc({ active: there, menu }).d);
    expect(menu.focused).toBe(false);
    const gone = el('BUTTON', false);
    focusFallback(true, doc({ active: gone, menu }).d);
    expect(menu.focused).toBe(true);
    const nothing = el('BUTTON');
    focusFallback(true, doc({ active: null, menu: nothing }).d);
    expect(nothing.focused).toBe(true);
  });
});
