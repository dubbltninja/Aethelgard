// Which painting a scene shows (U71; docs/ART.md §7, D-124). Pure, apart from the small failure registry at the end.
//
// The fallback order is fixed: the place's own painting (its `~<state>` variant first when the Heartstone's state has one) →
// a region-mate's painting, nearest by map distance (ties by id, so it is deterministic), drawn with the region tint → U64's
// parametric SVG (`null`). `backdropChain` lists the candidates in that order; `chooseBackdrop` takes the first one that has
// not failed to load. A failed load (`<img onError>`) is recorded once per page in the registry, and the containers re-render
// through `useBackdrop`, so the frame steps down the chain and is never empty and never a broken-image icon.
import type { HeartstoneState } from '@engine/index';
import { sceneManifest, type ArtFiles, type SceneManifest } from './sceneManifest';

/** `own` and `variant` are the place's own paintings; `region` is borrowed from a region-mate (drawn with the region tint). */
export type BackdropSource = 'own' | 'variant' | 'region';

export interface Backdrop extends ArtFiles {
  /** The image's id in the registry: `<locationId>` or `<locationId>~<state>`. */
  key: string;
  /** Whose painting it is. */
  locationId: string;
  source: BackdropSource;
}

export interface PlacedLocation {
  id: string;
  regionId: string;
  map: { x: number; y: number };
}

/** How many region-mates a chain tries before giving up on paintings (a 404 storm stays short). */
export const MAX_MATES = 3;

/** The variant key a state asks for: the Heartstone's state when it is not intact (ART §1). */
export const variantFor = (heartstone: HeartstoneState | undefined): string | null =>
  heartstone === undefined || heartstone === 'intact' ? null : heartstone;

/** The candidates for `location`, best first (empty → the SVG). */
export function backdropChain(
  location: PlacedLocation,
  heartstone: HeartstoneState | undefined,
  locations: Readonly<Record<string, PlacedLocation>>,
  manifest: SceneManifest = sceneManifest(),
): Backdrop[] {
  const out: Backdrop[] = [];
  const own = manifest.scenes[location.id];
  if (own !== undefined) {
    const v = variantFor(heartstone);
    const files = v === null ? undefined : own.variants[v];
    if (v !== null && files !== undefined) out.push({ key: `${location.id}~${v}`, locationId: location.id, source: 'variant', lg: files.lg, sm: files.sm });
    out.push({ key: location.id, locationId: location.id, source: 'own', lg: own.lg, sm: own.sm });
  }
  const d2 = (o: PlacedLocation): number => (o.map.x - location.map.x) ** 2 + (o.map.y - location.map.y) ** 2;
  const mates = Object.values(locations)
    .filter((o) => o.regionId === location.regionId && o.id !== location.id && manifest.scenes[o.id] !== undefined)
    .sort((a, b) => d2(a) - d2(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, MAX_MATES);
  for (const mate of mates) {
    const art = manifest.scenes[mate.id] as ArtFiles;
    out.push({ key: mate.id, locationId: mate.id, source: 'region', lg: art.lg, sm: art.sm });
  }
  return out;
}

/** The first candidate that has not failed, or null for the parametric SVG. */
export function chooseBackdrop(chain: readonly Backdrop[], failed: ReadonlySet<string>): Backdrop | null {
  return chain.find((b) => !failed.has(b.key)) ?? null;
}

/** The Title's key art, unless it failed. */
export function chooseTitleArt(manifest: SceneManifest, failed: ReadonlySet<string>): ArtFiles | null {
  return manifest.title === null || failed.has(TITLE_KEY) ? null : manifest.title;
}

export const TITLE_KEY = 'title';

/**
 * The images to warm for the next step: the first choice of each exit's destination (ART §7: "paintings preload for the
 * current location's exits only"), one size, no repeats, never the current place's own.
 */
export function preloadUrls(
  exitIds: readonly string[],
  hereId: string,
  heartstone: HeartstoneState | undefined,
  locations: Readonly<Record<string, PlacedLocation>>,
  failed: ReadonlySet<string>,
  small: boolean,
  manifest: SceneManifest = sceneManifest(),
): string[] {
  const urls: string[] = [];
  const here = locations[hereId];
  const current = here === undefined ? null : chooseBackdrop(backdropChain(here, heartstone, locations, manifest), failed);
  for (const id of exitIds) {
    const to = locations[id];
    if (to === undefined) continue;
    const pick = chooseBackdrop(backdropChain(to, heartstone, locations, manifest), failed);
    if (pick === null || pick.key === current?.key) continue;
    const url = small ? pick.sm : pick.lg;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

// ---- the failure registry (one per page; a 404 is not asked for twice) ----------------------------------------------------

let failures: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export function markBackdropFailed(key: string): void {
  if (failures.has(key)) return;
  failures = new Set([...failures, key]);
  for (const listener of listeners) listener();
}

export const backdropFailures = (): ReadonlySet<string> => failures;

export function subscribeBackdropFailures(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests only: forget every failure. */
export function resetBackdropFailures(): void {
  failures = new Set();
  for (const listener of listeners) listener();
}
