// Draft helpers for `step` (PLAN §4.6, D-065: structuredClone drafts, no immer). GameState and Profile are
// JSON-shaped (§4.2), so a structured clone is exact. `deepFreeze` is for dev/test builds only (`if (__DEV__)`):
// it makes a reducer that mutates its *input* throw at once in tests (ES modules run in strict mode).

/** A deep, independent copy of a JSON-shaped value: the draft a reducer may mutate freely. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Recursively `Object.freeze` every object and array reachable from `value` and return `value` itself.
 * Shared references and cycles are visited once; primitives pass through. Meant for plain JSON-shaped data
 * (a non-empty typed array cannot be frozen and would throw).
 */
export function deepFreeze<T>(value: T): T {
  const seen = new Set<object>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null || seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    for (const child of Object.values(node)) stack.push(child);
  }
  return value;
}
