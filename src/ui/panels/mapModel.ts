// The illustrated node map's model (DESIGN §16.6, WORLD §11.0–11.6): which places are drawn and how, the edges between
// them, the route to a chosen node, and what travelling there costs — pure functions of the state, the pack and the
// profile, so the map's rules are unit-tested and the view only draws.
//
// Node states (WORLD §11.6; priority current > escape > infected > npc > visited > remembered > adjacent):
//   current     where the Wayfinder stands (a pulsing ring; static under reduced motion)
//   visited     entered this loop: full colour, with a check when its fixed fight is cleared or scattered, a danger pip
//               with the level band for one still standing, a crown for a boss
//   remembered  in the profile's map memory but not visited this loop (D-011): grey, named, with its rest / trader
//   adjacent    a neighbour of a visited node, not yet known: a "?" ghost, unnamed (the legacy minimap's discovery rule)
// Overlays: `infected` (drawn even under fog, hatched, a red label), `escape` (the Library while the Horde runs: always
// drawn), `npc` (someone is there), `unstable` (temporally unstable while Dask travels with you), `quests` (U66, D-107: a
// ring round a place that an active quest's open objective names with `hintLocationId`). The Fall forecast hatch and the
// Threshold inset are U70's layer (PLAN §9.2).
//
// Coordinates are WORLD's grid units (x step 8, y step 2); `GRID` turns them into pixels.
import {
  PORTAL_LOCATION_ID,
  evaluate,
  exitState,
  lockedReason,
  npcsAt,
  questJournal,
  type ContentPack,
  type GameState,
  type Profile,
} from '@engine/index';
import type { Dir, Exit, Location } from '@schema/location';
import { arrivalText } from '../screens/exploreModel';

type Pr = Readonly<Profile>;

/** Pixels per WORLD grid unit (x columns are 8 units apart, rows 2): 120 px between columns, 88 px between rows. */
export const GRID = { x: 15, y: 44, pad: 72 } as const;
/** The Threshold is an inset, not part of the main map (WORLD §11.4); explore never stands there. */
export const INSET_REGIONS: readonly string[] = ['region_threshold'];

export type NodeState = 'current' | 'visited' | 'remembered' | 'adjacent';

export interface MapNode {
  id: string;
  /** Unnamed ghosts show "?" (unless infected or the escape door). */
  name: string | null;
  regionId: string;
  /** Pixel centre inside the map canvas. */
  px: number;
  py: number;
  state: NodeState;
  infected: boolean;
  escape: boolean;
  npc: boolean;
  cleared: boolean;
  /** An uncleared fixed group: its level band ("Lv 3–5"). */
  danger: string | null;
  boss: boolean;
  unstable: boolean;
  /** Names of the active quests with an open objective that points at this place (D-107's quest rings). */
  quests: string[];
  rest: string | null;
  merchant: boolean;
  /** A neighbour of the current node: the exit's direction. */
  dir: Dir | null;
  /** Initials for the sigil ("WR"). */
  glyph: string;
}

export type EdgeState = 'known' | 'ghost' | 'remembered' | 'locked';

export interface MapEdge {
  key: string;
  a: string;
  b: string;
  state: EdgeState;
  kind: 'walk' | 'road' | 'portal';
  infected: boolean;
  /** The lock's reason, when `locked`. */
  reason: string | null;
}

export interface RegionLabel {
  regionId: string;
  name: string;
  px: number;
  py: number;
}

export interface MapModel {
  nodes: MapNode[];
  edges: MapEdge[];
  regions: RegionLabel[];
  width: number;
  height: number;
  currentId: string;
}

/** WORLD §11.4 label anchors (grid units, on odd rows at x ≡ 4 mod 8, where no node or edge lies). */
export const REGION_ANCHORS: Readonly<Record<string, { x: number; y: number }>> = {
  region_silverwood_ruins: { x: 4, y: -1 },
  region_mistwood_ironclad_reach: { x: 20, y: 1 },
  region_voidscar: { x: 20, y: -1 },
  region_aether_kissed_highlands: { x: 20, y: 9 },
  region_glowlands_nexus: { x: 36, y: 7 },
  region_drowned_reach: { x: -12, y: 7 },
  region_ashen_steppe: { x: 36, y: 1 },
  region_veil: { x: 36, y: -5 },
  region_glowfen: { x: 36, y: 11 },
  region_skyreach: { x: 20, y: 11 },
  region_silverwood_before: { x: 68, y: -1 },
};

const isMain = (loc: Location): boolean => !INSET_REGIONS.includes(loc.regionId);

/** "Whispering Ruins" → "WR"; one word → its first two letters. */
export function initials(name: string): string {
  const words = name.replace(/^The\s+/i, '').replace(/['’]/g, '').split(/[\s-]+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0] as string).slice(0, 2).toUpperCase();
  return `${(words[0] as string)[0]}${(words[1] as string)[0]}`.toUpperCase();
}

/** The exits of `from` as the state sees them from there (hidden ones and roads that do not exist yet are left out). */
export function seenExits(s: GameState, content: ContentPack, profile: Pr, from: string): { exit: Exit; state: 'open' | 'locked' }[] {
  const out: { exit: Exit; state: 'open' | 'locked' }[] = [];
  for (const exit of content.locations[from]?.exits ?? []) {
    const state = exitState(s, content, profile, from, exit);
    if (state !== 'hidden') out.push({ exit, state });
  }
  return out;
}

const visitedThisLoop = (s: GameState, id: string): boolean => s.world.locationStates[id]?.visited === true || s.world.discovered.includes(id);

function encounterMarks(s: GameState, content: ContentPack, profile: Pr, loc: Location): { cleared: boolean; danger: string | null; boss: boolean } {
  const ls = s.world.locationStates[loc.id];
  const done = (id: string): boolean => (ls?.encountersCleared.includes(id) ?? false) || (ls?.scattered.includes(id) ?? false);
  const fixed = loc.encounters.filter((e) => e.once && e.respawn === 'never' && e.chance >= 1 && (e.when === undefined || evaluate(e.when, s, profile, content)));
  if (fixed.length === 0) return { cleared: false, danger: null, boss: false };
  const standing = fixed.filter((e) => !done(e.id));
  const band = loc.levelBand ?? content.regions[loc.regionId]?.levelBand;
  const bandText = band === undefined ? 'danger' : band.min === band.max ? `Lv ${band.min}` : `Lv ${band.min}–${band.max}`;
  const boss = standing.some((e) => e.groups.some((g) => content.creatures[g.creatureId]?.role === 'boss'));
  return { cleared: standing.length === 0, danger: standing.length > 0 ? bandText : null, boss };
}

/** Place id → names of the active quests whose open objectives point at it (the journal's read model, D-107). */
export function questHints(s: GameState, content: ContentPack): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const entry of questJournal(s, content)) {
    if (entry.status !== 'active') continue;
    for (const o of entry.objectives) {
      if (o.done || o.hintLocationId === undefined) continue;
      const names = out.get(o.hintLocationId) ?? [];
      if (!names.includes(entry.name)) out.set(o.hintLocationId, [...names, entry.name]);
    }
  }
  return out;
}

/** The drawn map (see the header). */
export function buildMap(s: GameState, content: ContentPack, profile: Pr): MapModel {
  const here = s.world.currentLocationId;
  const memory = new Set(profile.mapKnowledge);
  const states = new Map<string, NodeState>();
  const all = Object.values(content.locations).filter((l): l is Location => l !== undefined && isMain(l));
  for (const loc of all) {
    if (loc.id === here) states.set(loc.id, 'current');
    else if (visitedThisLoop(s, loc.id)) states.set(loc.id, 'visited');
    else if (memory.has(loc.id)) states.set(loc.id, 'remembered');
  }
  // ghosts: neighbours of nodes visited this loop
  for (const [id, st] of [...states]) {
    if (st !== 'current' && st !== 'visited') continue;
    for (const { exit } of seenExits(s, content, profile, id)) {
      const to = content.locations[exit.to];
      if (to !== undefined && isMain(to) && !states.has(exit.to)) states.set(exit.to, 'adjacent');
    }
  }
  const infected = new Set(s.world.infected);
  const escapeId = s.world.hordeActive ? PORTAL_LOCATION_ID : null;
  for (const id of infected) if (!states.has(id) && content.locations[id] !== undefined && isMain(content.locations[id] as Location)) states.set(id, 'adjacent');
  if (escapeId !== null && !states.has(escapeId) && content.locations[escapeId] !== undefined) states.set(escapeId, 'adjacent');

  const drawn = all.filter((l) => states.has(l.id));
  const xs = drawn.map((l) => l.map.x);
  const ys = drawn.map((l) => l.map.y);
  const here0 = content.locations[here]?.map ?? { x: 0, y: 0 };
  const minX = Math.min(...xs, here0.x);
  const minY = Math.min(...ys, here0.y);
  const maxX = Math.max(...xs, here0.x);
  const maxY = Math.max(...ys, here0.y);
  const px = (x: number): number => Math.round((x - minX) * GRID.x + GRID.pad);
  const py = (y: number): number => Math.round((y - minY) * GRID.y + GRID.pad);

  const currentExits = new Map<string, Dir>();
  for (const { exit } of seenExits(s, content, profile, here)) if (!currentExits.has(exit.to)) currentExits.set(exit.to, exit.dir);
  const dask = s.companions.activeId === 'dask';
  const hinted = questHints(s, content);

  const nodes: MapNode[] = drawn.map((loc) => {
    const state = states.get(loc.id) as NodeState;
    const known = state !== 'adjacent';
    const isInfected = infected.has(loc.id);
    const isEscape = loc.id === escapeId;
    const marks = state === 'visited' || state === 'current' ? encounterMarks(s, content, profile, loc) : { cleared: false, danger: null, boss: false };
    return {
      id: loc.id,
      name: known || isInfected || isEscape ? loc.name : null,
      regionId: loc.regionId,
      px: px(loc.map.x),
      py: py(loc.map.y),
      state,
      infected: isInfected,
      escape: isEscape,
      npc: (state === 'current' || state === 'visited') && npcsAt(s, content, profile, loc.id).length > 0,
      ...marks,
      unstable: dask && loc.temporallyUnstable,
      quests: hinted.get(loc.id) ?? [],
      rest: known && loc.rest !== undefined ? loc.rest.kind : null,
      merchant: known && loc.merchantId !== undefined,
      dir: currentExits.get(loc.id) ?? null,
      glyph: known || isInfected || isEscape ? initials(loc.name) : '?',
    };
  });

  const edges = new Map<string, MapEdge>();
  const put = (from: string, exit: Exit, locked: boolean, reason: string | null): void => {
    const a = from < exit.to ? from : exit.to;
    const b = from < exit.to ? exit.to : from;
    const sa = states.get(a);
    const sb = states.get(b);
    if (sa === undefined || sb === undefined) return;
    const key = `${a}|${b}`;
    const kind: MapEdge['kind'] = exit.kind === 'road' ? 'road' : exit.dir === 'portal' ? 'portal' : 'walk';
    const state: EdgeState = locked
      ? 'locked'
      : sa === 'adjacent' || sb === 'adjacent'
        ? 'ghost'
        : sa === 'remembered' || sb === 'remembered'
          ? 'remembered'
          : 'known';
    const prev = edges.get(key);
    // A lock seen from one end wins over the open way back from the other (the lock is what stops the traveller).
    if (prev !== undefined && !(state === 'locked' && prev.state !== 'locked')) return;
    edges.set(key, { key, a, b, state, kind, infected: infected.has(a) && infected.has(b), reason });
  };
  for (const node of nodes) {
    if (node.state === 'current' || node.state === 'visited') {
      for (const { exit, state } of seenExits(s, content, profile, node.id)) {
        put(node.id, exit, state === 'locked', state === 'locked' ? lockedReason(s, content, profile, node.id, exit) : null);
      }
    } else if (node.state === 'remembered') {
      // Known from memory (D-011): the remembered place's ways to other known places, without their present locks.
      for (const exit of content.locations[node.id]?.exits ?? []) {
        if (exit.kind === 'road' || exit.hidden) continue;
        const other = states.get(exit.to);
        if (other !== undefined && other !== 'adjacent') put(node.id, exit, false, null);
      }
    }
  }

  // A region is labelled once any of its places is named, at WORLD §11.4's anchor (odd rows, between columns), else
  // above its topmost named node.
  const regionLabels = new Map<string, RegionLabel>();
  for (const node of nodes) {
    if (node.name === null || regionLabels.has(node.regionId)) continue;
    const anchor = REGION_ANCHORS[node.regionId];
    const top = nodes.filter((n) => n.regionId === node.regionId && n.name !== null).reduce((a, b) => (b.py < a.py || (b.py === a.py && b.px < a.px) ? b : a));
    regionLabels.set(node.regionId, {
      regionId: node.regionId,
      name: content.regions[node.regionId]?.name ?? node.regionId,
      px: anchor === undefined ? top.px : px(anchor.x),
      py: anchor === undefined ? top.py - GRID.y : py(anchor.y),
    });
  }

  const width = px(maxX) + GRID.pad;
  const height = py(maxY) + GRID.pad;
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
  return {
    nodes,
    edges: [...edges.values()],
    regions: [...regionLabels.values()].map((r) => ({ ...r, px: clamp(r.px, GRID.pad, width - GRID.pad), py: clamp(r.py, 16, height - 16) })),
    width,
    height,
    currentId: here,
  };
}

// ---- travel and routes -------------------------------------------------------------------------------------------------------

export interface RouteLeg {
  from: string;
  to: string;
  watches: number;
}

export interface Route {
  target: string;
  legs: RouteLeg[];
  watches: number;
}

/**
 * The cheapest route in watches from where the Wayfinder stands to `target`, over ways that are open now, through
 * places they know (visited this loop or remembered), arriving at `target` (which may be a "?" ghost). Null when no
 * known way leads there.
 */
export function routeTo(s: GameState, content: ContentPack, profile: Pr, model: MapModel, target: string): Route | null {
  const start = s.world.currentLocationId;
  if (target === start) return null;
  const stateOf = new Map(model.nodes.map((n) => [n.id, n.state] as const));
  if (!stateOf.has(target)) return null;
  const frozen = s.clock.frozen;
  const dist = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, RouteLeg>();
  const open = new Set<string>([start]);
  while (open.size > 0) {
    let at: string | null = null;
    for (const id of open) if (at === null || (dist.get(id) as number) < (dist.get(at) as number)) at = id;
    if (at === null) break;
    open.delete(at);
    if (at === target) break;
    const st = stateOf.get(at);
    if (at !== start && st !== 'visited' && st !== 'remembered') continue; // never route through a ghost
    for (const { exit, state } of seenExits(s, content, profile, at)) {
      if (state !== 'open' || !stateOf.has(exit.to)) continue;
      const watches = frozen ? 0 : exit.travelWatches;
      const d = (dist.get(at) as number) + watches + 0.001; // fewer legs on ties
      if (d < (dist.get(exit.to) ?? Infinity)) {
        dist.set(exit.to, d);
        prev.set(exit.to, { from: at, to: exit.to, watches });
        open.add(exit.to);
      }
    }
  }
  if (!prev.has(target)) return null;
  const legs: RouteLeg[] = [];
  for (let at = target; at !== start; ) {
    const leg = prev.get(at) as RouteLeg;
    legs.unshift(leg);
    at = leg.from;
  }
  return { target, legs, watches: legs.reduce((n, l) => n + l.watches, 0) };
}

export interface TravelPreview {
  target: string;
  name: string;
  /** The first step a Go button takes (the target itself when it is next door). */
  next: string | null;
  nextName: string | null;
  /** "1 watch · Dusk → Night" or "3 watches over 3 legs · Day 2 · Dawn". */
  cost: string | null;
  /** "Lv 2–4 · wandering", "Lv 3–4 · a fight waits", "Safe". */
  risk: string | null;
  /** Why the way is shut (lockedText + what is missing). */
  locked: string | null;
  /** "⚠ −33% HP" on infected ground. */
  danger: string | null;
  /** D-059: Dask cannot follow where time is steady. */
  companion: string | null;
  canGo: boolean;
}

/** The tooltip of DESIGN §16.6: cost and resulting time, risk, a lock's reason, a companion restriction. */
export function travelPreview(
  s: GameState,
  content: ContentPack,
  profile: Pr,
  model: MapModel,
  target: string,
  canMove: (to: string) => boolean,
): TravelPreview | null {
  const loc = content.locations[target];
  const node = model.nodes.find((n) => n.id === target);
  if (loc === undefined || node === undefined) return null;
  const name = node.name ?? 'An unknown place';
  const here = s.world.currentLocationId;
  if (target === here) return { target, name, next: null, nextName: null, cost: 'You are here', risk: null, locked: null, danger: null, companion: null, canGo: false };
  const direct = seenExits(s, content, profile, here).filter((e) => e.exit.to === target);
  const lockedExit = direct.find((e) => e.state === 'locked');
  const route = routeTo(s, content, profile, model, target);
  const band = loc.levelBand ?? content.regions[loc.regionId]?.levelBand;
  const bandText = band === undefined ? null : band.min === band.max ? `Lv ${band.min}` : `Lv ${band.min}–${band.max}`;
  const known = node.state !== 'adjacent';
  const risk = loc.safe
    ? 'Safe'
    : node.danger !== null
      ? `${node.danger} · a fight waits there`
      : bandText === null
        ? null
        : `${bandText} · ${known ? 'wandering' : 'unknown'}`;
  const hpPct = Math.round(content.config.hordeDamagePctMaxHp * 100);
  const daskHere = s.companions.activeId === 'dask';
  const companion = daskHere && !loc.temporallyUnstable && !node.infected ? 'Dask cannot follow you where time is steady.' : null;
  const lockReason = route === null && lockedExit !== undefined ? lockedReason(s, content, profile, here, lockedExit.exit) : null;
  const next = route?.legs[0]?.to ?? null;
  const cost =
    route === null
      ? null
      : route.watches === 0
        ? `No time passes${route.legs.length > 1 ? ` · ${route.legs.length} steps` : ''}`
        : `${route.watches} ${route.watches === 1 ? 'watch' : 'watches'}${route.legs.length > 1 ? ` over ${route.legs.length} steps` : ''} · ${arrivalText(s.clock.ticks, 0)} → ${arrivalText(s.clock.ticks, route.watches)}`;
  return {
    target,
    name,
    next,
    nextName: next === null ? null : content.locations[next]?.name ?? next,
    cost,
    risk,
    locked: lockReason ?? (route === null && lockedExit === undefined ? 'No way you know leads there yet.' : null),
    danger: node.infected ? `⚠ −${hpPct}% HP: the Horde holds it` : null,
    companion,
    canGo: next !== null && canMove(next),
  };
}

/** The neighbour of the current node in direction `dir` (arrow keys / WASD on the map). */
export function neighbourIn(model: MapModel, dir: Dir): string | null {
  return model.nodes.find((n) => n.dir === dir && n.id !== model.currentId)?.id ?? null;
}

/** "Crumbling Archway, visited, north, cleared" — a node button's accessible name (DESIGN §16.7). */
export function nodeLabel(node: MapNode, preview?: { cost: string | null } | null): string {
  const parts: string[] = [node.name ?? 'Unknown place'];
  parts.push(node.state === 'current' ? 'you are here' : node.state === 'adjacent' ? 'unexplored' : node.state);
  if (node.dir !== null && node.state !== 'current') parts.push(node.dir);
  if (node.escape) parts.push('the way out');
  if (node.infected) parts.push('infected');
  if (node.boss) parts.push('a boss waits');
  else if (node.danger !== null) parts.push(`danger, ${node.danger}`);
  else if (node.cleared) parts.push('cleared');
  if (node.npc) parts.push('someone is here');
  if (node.rest !== null) parts.push(node.rest);
  if (node.merchant) parts.push('trader');
  if (node.unstable) parts.push('time is loose here');
  if (node.quests.length > 0) parts.push(`quest: ${node.quests.join(' and ')}`);
  if (preview?.cost) parts.push(preview.cost);
  return parts.join(', ');
}
