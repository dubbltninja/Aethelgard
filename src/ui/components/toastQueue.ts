// The toast queue (PLAN §6.1, DESIGN §16.7; U70): what the engine's events become on screen and how long they stay. Pure, so
// the timing is unit-tested without a clock: every function takes `now` (ms). A repeat of a toast already showing (same
// `key`) merges into it — a counted amount ("+10", "+25") adds up, a plain line gets "×2" — and its time starts over, so a
// burst of pickups is one toast, not a wall. The newest few stay; the oldest drop first.
export type ToastTone = 'info' | 'success' | 'gain' | 'warn' | 'error';

/** What a producer asks for. With an `amount` the toast is `${label} ${signed total}${unit}`; without, `label` is the text. */
export interface ToastSpec {
  /** Repeats with the same key merge. */
  key: string;
  label: string;
  tone: ToastTone;
  amount?: number;
  /** Appended to a counted amount ("◇", " gold"). */
  unit?: string;
  /** How a counted amount reads: `signed` "+25" (default), or `times` "×3" (shown only above 1). */
  format?: 'signed' | 'times';
}

export interface ToastItem extends ToastSpec {
  id: number;
  /** How many specs merged into it (1 = just one). */
  count: number;
  /** `now` at which it goes. */
  expiresAt: number;
}

export interface ToastQueue {
  items: readonly ToastItem[];
  nextId: number;
}

export const EMPTY_QUEUE: ToastQueue = { items: [], nextId: 1 };

/** The most toasts on screen at once; a newer one pushes the oldest out. */
export const MAX_TOASTS = 4;

/** How long a toast stays (ms): an error and a warning longer, so they can be read. */
export function lifetime(tone: ToastTone): number {
  return tone === 'error' ? 12_000 : tone === 'warn' ? 10_000 : 5_000;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** The words of a toast: a counted amount reads "Resonance +25 ◇", a repeated plain line "Picked up Ember Ore ×3". */
export function toastText(item: Pick<ToastItem, 'label' | 'amount' | 'unit' | 'count' | 'format'>): string {
  if (item.amount !== undefined && item.format === 'times') return item.amount > 1 ? `${item.label} ×${item.amount}` : item.label;
  if (item.amount !== undefined) return `${item.label} ${signed(item.amount)}${item.unit ?? ''}`;
  return item.count > 1 ? `${item.label} ×${item.count}` : item.label;
}

/** Adds a toast, or merges it into the live one with the same key. */
export function enqueue(queue: ToastQueue, spec: ToastSpec, now: number): ToastQueue {
  const expiresAt = now + lifetime(spec.tone);
  const at = queue.items.findIndex((t) => t.key === spec.key && t.expiresAt > now);
  if (at >= 0) {
    const live = queue.items[at] as ToastItem;
    const merged: ToastItem = {
      ...live,
      label: spec.label,
      tone: spec.tone,
      count: live.count + 1,
      expiresAt,
      ...(live.amount !== undefined || spec.amount !== undefined ? { amount: (live.amount ?? 0) + (spec.amount ?? 0) } : {}),
    };
    return { ...queue, items: queue.items.map((t, i) => (i === at ? merged : t)) };
  }
  const fresh: ToastItem = { ...spec, id: queue.nextId, count: 1, expiresAt };
  return { items: [...queue.items, fresh].slice(-MAX_TOASTS), nextId: queue.nextId + 1 };
}

export function dismiss(queue: ToastQueue, id: number): ToastQueue {
  const items = queue.items.filter((t) => t.id !== id);
  return items.length === queue.items.length ? queue : { ...queue, items };
}

/** Drops what has run out. Returns the same queue when nothing has. */
export function expire(queue: ToastQueue, now: number): ToastQueue {
  const items = queue.items.filter((t) => t.expiresAt > now);
  return items.length === queue.items.length ? queue : { ...queue, items };
}

/** When the next toast runs out (ms), or null when the queue is empty. */
export function nextExpiry(queue: ToastQueue): number | null {
  return queue.items.length === 0 ? null : Math.min(...queue.items.map((t) => t.expiresAt));
}
