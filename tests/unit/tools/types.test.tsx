// Keeps the in-repo type shims strict (PLAN §3.7). tsc checks this file (`npm run typecheck`): every expected
// error below must stay an error, or the unused directive itself fails the typecheck.
// bun only runs the trivial test at the bottom; the probes live in a function that is never called.
import { expect, test } from 'bun:test';
import { createContext, useContext, useRef, useState, type CSSProperties } from 'react';
import { ScaffoldPage } from '../../../src/main';

export function typeProbes(): unknown[] {
  const [count] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const Ctx = createContext('text');
  const ok: CSSProperties = { color: 'red', '--accent': '#fff', marginTop: 4 };
  return [
    count,
    ok,
    <div ref={ref} data-testid="ok" aria-label="ok" key="k" />,
    <Ctx value="x">{useContext(Ctx)}</Ctx>,
    // @ts-expect-error — useState's value is a number, not a string
    ((): string => count)(),
    // @ts-expect-error — tabIndex is a number
    <div tabIndex="0" />,
    // @ts-expect-error — not an intrinsic element in the shim
    <blink />,
    // @ts-expect-error — ScaffoldPage requires `version`
    <ScaffoldPage />,
    // @ts-expect-error — `version` is a string
    <ScaffoldPage version={2} />,
    // @ts-expect-error — unknown CSS property
    { colr: 'red' } satisfies CSSProperties,
    // @ts-expect-error — the ref is for a div, not an input
    <input ref={ref} />,
    // @ts-expect-error — onClick receives a MouseEvent, which has no `key`
    <button type="button" onClick={(event) => event.key} />,
  ];
}

test('type probes compile (checked by tsc, not executed)', () => {
  expect(typeof typeProbes).toBe('function');
});
