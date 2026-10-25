// The scene manifest (U71, docs/ART.md §1, §7; D-124): which painted backdrops exist. tools/build.ts lists the art folder
// (`public/art/`, or `tests/fixtures/art/` for the e2e build) at build time with `buildSceneManifest` and inlines the result as
// the `__SCENE_MANIFEST__` constant, so the app knows on its first render which places are painted: no fetch, no flash of the
// fallback, no request for a file that is not there. Inlined rather than fetched because it stays small — ids and paths only,
// about 1.5 kB gzip for all 77 images (tests/unit/ui/art/sceneManifest.test.ts holds it under 2 kB).
//
// File names (ART §1): `scenes/<locationId>.webp` (1440 × 600) + `scenes/<locationId>@sm.webp` (720 × 300); Heartstone state
// variants `scenes/<locationId>~<state>.webp` (+ `@sm`); the Title's key art `title.webp` (+ `title@sm.webp`). Paths are relative
// to the page (index.html), like every asset URL the build writes, so they work under any GitHub Pages sub-path.

/** One image in its two sizes: `lg` for 760 px and wider, `sm` below (the same file when only one size exists). */
export interface ArtFiles {
  lg: string;
  sm: string;
}

export interface SceneArtEntry extends ArtFiles {
  /** `~<state>` variants by state (the Heartstone Depths: `stabilized`, `exploited`, `destroyed`). */
  variants: Readonly<Record<string, ArtFiles>>;
}

export interface SceneManifest {
  /** By location id. */
  scenes: Readonly<Record<string, SceneArtEntry>>;
  /** The Title's key art, or null. */
  title: ArtFiles | null;
}

export const EMPTY_MANIFEST: SceneManifest = { scenes: {}, title: null };

/** Where the art folder is served, relative to index.html. */
export const ART_BASE = 'art/';

const SCENE_FILE = /^([a-z0-9_]+)(?:~([a-z0-9_]+))?(@sm)?\.webp$/;

interface Sizes {
  lg?: string;
  sm?: string;
}

const both = (s: Sizes): ArtFiles | null => {
  const lg = s.lg ?? s.sm;
  const sm = s.sm ?? s.lg;
  return lg === undefined || sm === undefined ? null : { lg, sm };
};

/**
 * The manifest from the art folder's file names: `sceneFiles` in `scenes/`, `rootFiles` at the art root. Names that do not
 * follow ART §1 are ignored; a missing size borrows the other; a variant whose base image is missing is dropped (the base is
 * what every other place falls back to). Keys come out sorted, so the same folder always gives the same bundle.
 */
export function buildSceneManifest(sceneFiles: readonly string[], rootFiles: readonly string[] = [], base: string = ART_BASE): SceneManifest {
  const found = new Map<string, { own: Sizes; variants: Map<string, Sizes> }>();
  for (const name of [...sceneFiles].sort()) {
    const m = SCENE_FILE.exec(name);
    if (m === null) continue;
    const [, id, state, small] = m as unknown as [string, string, string | undefined, string | undefined];
    let entry = found.get(id);
    if (entry === undefined) {
      entry = { own: {}, variants: new Map() };
      found.set(id, entry);
    }
    let sizes = entry.own;
    if (state !== undefined) {
      sizes = entry.variants.get(state) ?? {};
      entry.variants.set(state, sizes);
    }
    sizes[small === undefined ? 'lg' : 'sm'] = `${base}scenes/${name}`;
  }
  const scenes: Record<string, SceneArtEntry> = {};
  for (const id of [...found.keys()].sort()) {
    const entry = found.get(id) as { own: Sizes; variants: Map<string, Sizes> };
    const own = both(entry.own);
    if (own === null) continue;
    const variants: Record<string, ArtFiles> = {};
    for (const state of [...entry.variants.keys()].sort()) {
      const files = both(entry.variants.get(state) as Sizes);
      if (files !== null) variants[state] = files;
    }
    scenes[id] = { ...own, variants };
  }
  const title = both({
    ...(rootFiles.includes('title.webp') ? { lg: `${base}title.webp` } : {}),
    ...(rootFiles.includes('title@sm.webp') ? { sm: `${base}title@sm.webp` } : {}),
  });
  return { scenes, title };
}

/** How many images the manifest names (both sizes of one image count once). */
export function paintingCount(manifest: SceneManifest): number {
  let n = manifest.title === null ? 0 : 1;
  for (const entry of Object.values(manifest.scenes)) n += 1 + Object.keys(entry.variants).length;
  return n;
}

/** DESIGN/ART §8: the Credits name Grok Imagine only once a painting ships. */
export const hasPaintings = (manifest: SceneManifest): boolean => paintingCount(manifest) > 0;

// Set by tools/build.ts and tools/dev.ts (esbuild `define`); absent under `bun test`, where callers pass a manifest.
declare const __SCENE_MANIFEST__: SceneManifest | undefined;

/** The manifest this build was made with (empty when the build had no art). */
export function sceneManifest(): SceneManifest {
  return typeof __SCENE_MANIFEST__ === 'undefined' ? EMPTY_MANIFEST : __SCENE_MANIFEST__;
}
