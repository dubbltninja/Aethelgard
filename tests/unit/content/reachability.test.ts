// U76 (PLAN §8.2 `reachability.test.ts`, validator rule 8): a BFS of its own over the real pack's exit graph — not the
// validator's — reaches all 73 locations; the 21 legacy locations are reachable in Loop 1 (loop = 1, no Echoes, nothing
// earned yet); every region has an entry from another region.
//
// Conditions follow rule 8's three-valued reading: a leaf is false when no Loop 1 can satisfy it (`echo`, `modifier`,
// `beforeDay`, `beforeResets`, `resolve`, and `loop` outside 1), true-or-unknown when the player can still earn it.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import type { ContentPack } from '@engine/index';
import { LEGACY_LOCATIONS } from '@content/validate';

const pack: ContentPack = buildContentPack();
const locations = Object.values(pack.locations);
const START = pack.config.startLocationId;
const THRESHOLD_DOOR = 'loc_still_shore';

type Tri = 'T' | 'F' | 'U';
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Whether `c` can hold in Loop 1 ('F' = never; 'T'/'U' = it can). */
function loopOne(c: unknown): Tri {
  if (!isObj(c)) return 'U';
  const [key, value] = Object.entries(c)[0] ?? [];
  if (key === undefined) return 'U';
  const list = (Array.isArray(value) ? value : []) as unknown[];
  if (key === 'all') return list.some((x) => loopOne(x) === 'F') ? 'F' : list.every((x) => loopOne(x) === 'T') ? 'T' : 'U';
  if (key === 'any') return list.some((x) => loopOne(x) === 'T') ? 'T' : list.every((x) => loopOne(x) === 'F') ? 'F' : 'U';
  if (key === 'not') return ((inner) => (inner === 'T' ? 'F' : inner === 'F' ? 'T' : 'U'))(loopOne(value));
  if (key === 'echo' || key === 'modifier' || key === 'beforeDay' || key === 'beforeResets' || key === 'resolve') return 'F';
  if (key === 'loop' && isObj(value)) {
    const { min, max } = value as { min?: number; max?: number };
    return (typeof min === 'number' && 1 < min) || (typeof max === 'number' && 1 > max) ? 'F' : 'T';
  }
  return 'U';
}

/** `unlockExit` effects anywhere in the pack: the hidden exits something can reveal. */
const unlocked = new Set<string>();
for (const m of JSON.stringify([pack.locations, pack.dialogues, pack.quests, pack.echoes, pack.items, pack.creatures]).matchAll(/"unlockExit":\{"from":"([a-z0-9_]+)","to":"([a-z0-9_]+)"\}/g)) {
  unlocked.add(`${m[1]}>${m[2]}`);
}

function bfs(starts: string[], mode: 'any' | 'loop1'): Set<string> {
  const seen = new Set(starts);
  const queue = [...starts];
  for (let i = 0; i < queue.length; i++) {
    for (const exit of pack.locations[queue[i] as string]?.exits ?? []) {
      if (seen.has(exit.to) || pack.locations[exit.to] === undefined) continue;
      if (exit.hidden && exit.when === undefined && !unlocked.has(`${queue[i]}>${exit.to}`)) continue;
      if (mode === 'loop1' && (loopOne(exit.when) === 'F' || (exit.kind === 'road' && loopOne(exit.gate) === 'F'))) continue;
      seen.add(exit.to);
      queue.push(exit.to);
    }
  }
  return seen;
}

describe('reachability of the real pack (PLAN §8.2, validator rule 8)', () => {
  test('there are 73 locations and the start and the Threshold door are among them', () => {
    expect(locations).toHaveLength(73);
    expect(pack.locations[START]).toBeDefined();
    expect(pack.locations[THRESHOLD_DOOR]).toBeDefined();
  });

  test('BFS from the start reaches every location outside the Threshold; the Threshold is reached from the Still Shore', () => {
    const fromStart = bfs([START], 'any');
    const threshold = locations.filter((l) => l.tags.includes('threshold'));
    expect(threshold.length).toBeGreaterThan(0);
    expect(locations.filter((l) => !fromStart.has(l.id) && !l.tags.includes('threshold')).map((l) => l.id)).toEqual([]);
    const fromShore = bfs([THRESHOLD_DOOR], 'any');
    expect(threshold.filter((l) => !fromShore.has(l.id)).map((l) => l.id)).toEqual([]);
    // the two roots together cover all 73, and the Threshold is not reachable from the start by walking (it is a loop's end)
    expect(new Set([...fromStart, ...fromShore]).size).toBe(73);
  });

  test('the 21 legacy locations are reachable in Loop 1 (loop 1, no Echoes, conditions the player can still earn left open)', () => {
    const legacy = locations.filter((l) => l.legacyName !== undefined || LEGACY_LOCATIONS[l.id] !== undefined);
    expect(legacy).toHaveLength(21);
    const loop1 = bfs([START], 'loop1');
    expect(legacy.filter((l) => !loop1.has(l.id)).map((l) => l.id)).toEqual([]);
  });

  test('Loop 1 does not reach the Echo-gated regions (the Silverwood Before and the Threshold wait for Loop 2)', () => {
    const loop1 = bfs([START], 'loop1');
    const gated = Object.values(pack.regions).filter((r) => r.unlockWhen !== undefined);
    expect(gated.length).toBeGreaterThan(0);
    for (const r of gated) {
      const inside = locations.filter((l) => l.regionId === r.id);
      expect([r.id, inside.every((l) => loop1.has(l.id))]).toEqual([r.id, false]);
    }
  });

  test('every region has an entry: an exit from a location in another region leads into it', () => {
    for (const region of Object.values(pack.regions)) {
      const entries = locations.flatMap((from) => from.exits.filter((e) => from.regionId !== region.id && pack.locations[e.to]?.regionId === region.id).map((e) => `${from.id}>${e.to}`));
      // the Threshold is entered from the loop's end, not by an exit from another region (rule 8: from the Still Shore)
      if (region.id === 'region_threshold') expect(locations.filter((l) => l.regionId === region.id).some((l) => l.id === THRESHOLD_DOOR)).toBe(true);
      else expect([region.id, entries.length > 0]).toEqual([region.id, true]);
    }
  });

  test('every region has a way out as well, except the Threshold: no region is a dead end', () => {
    for (const region of Object.values(pack.regions)) {
      if (region.id === 'region_threshold') continue;
      const out = locations.some((from) => from.regionId === region.id && from.exits.some((e) => pack.locations[e.to] !== undefined && pack.locations[e.to]?.regionId !== region.id));
      expect([region.id, out]).toEqual([region.id, true]);
    }
  });

  test('no exit leads to a missing location or to its own location, and each location has an exit or is a Threshold/ending place', () => {
    for (const l of locations) {
      for (const e of l.exits) expect([l.id, e.to, pack.locations[e.to] !== undefined, e.to !== l.id]).toEqual([l.id, e.to, true, true]);
    }
    const noExit = locations.filter((l) => l.exits.length === 0 && !l.tags.includes('threshold')).map((l) => l.id);
    expect(noExit).toEqual([]);
  });
});
