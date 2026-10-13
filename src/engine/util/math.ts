// Small numeric helpers (PLAN §2 `util/math.ts`). Pure and deterministic.

/** `value` limited to [min, max]. Throws RangeError if min > max. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new RangeError(`clamp(${value}, ${min}, ${max})`);
  return value < min ? min : value > max ? max : value;
}

/** Round half away from zero to `digits` decimals (default 0): round(2.5) = 3, round(-2.5) = -3. Never returns -0. */
export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  const r = (Math.sign(value) * Math.round(Math.abs(value) * f)) / f;
  return r === 0 ? 0 : r;
}

/** `part` as a percentage of `whole` (0–100 scale, unrounded); 0 when `whole` is 0. */
export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}
