// The Threshold — item records. Empty: "no items to take except Attunements" (WORLD §3.12), and Attunements are their own
// table (DESIGN §10.7). The export keeps every region folder's shape identical (PLAN §10.3).
import type { ItemInput } from '@schema/item';

export const items = [] satisfies ItemInput[];
