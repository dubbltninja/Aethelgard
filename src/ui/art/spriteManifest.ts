// The sprite and portrait manifest (U73a; docs/ART-2.md §1, §7; D-128): which figures exist. Like the scene manifest (U71,
// sceneManifest.ts), tools/build.ts lists the art folder at build time — `public/art/`, or `tests/fixtures/art/` for the e2e
// build — with `buildSpriteManifest` and inlines the result as `__SPRITE_MANIFEST__`, so the first render already knows which
// figures are drawn: no fetch, no flash of a sigil, no request for a file that is not there.
//
// File names (ART-2 §1): `sprites/<creatureId>.webp`, `sprites/class_<classId>.webp`, `sprites/companion_<companionId>.webp`
// (transparent, trimmed, stored at the size class's height); `portraits/<npcId>.webp` (512 × 512) + `portraits/<npcId>@sm.webp`
// (160 × 160). A sprite's entry keeps its stored width and height: the stage lays figures out by their aspect before the image
// has loaded, so nothing jumps and nothing is clipped. Paths are relative to index.html, like every asset URL the build writes.
import { ART_BASE, type ArtFiles } from './sceneManifest';

/** One cut-out figure: its URL and the stored size in px (the height is its size class, ART-2 §2). */
export interface SpriteArt {
  src: string;
  w: number;
  h: number;
}

export interface SpriteManifest {
  /** By file id: `cr_*`, `class_*`, `companion_*`. */
  sprites: Readonly<Record<string, SpriteArt>>;
  /** By npc id: the 512 px file (`lg`) and the 160 px file (`sm`); a missing size borrows the other. */
  portraits: Readonly<Record<string, ArtFiles>>;
}

export const EMPTY_SPRITE_MANIFEST: SpriteManifest = { sprites: {}, portraits: {} };

/** A file in `sprites/` with its pixel size, as tools/build.ts reads it. */
export interface SizedFile {
  name: string;
  width: number;
  height: number;
}

const SPRITE_FILE = /^((?:cr|class|companion)_[a-z0-9_]+)\.webp$/;
const PORTRAIT_FILE = /^(npc_[a-z0-9_]+)(@sm)?\.webp$/;

/**
 * The manifest from the art folder: `spriteFiles` in `sprites/` (with their sizes; a file whose size could not be read is
 * skipped), `portraitFiles` in `portraits/`. Names outside ART-2 §1 are ignored. Keys come out sorted, so the same folder always
 * gives the same bundle.
 */
export function buildSpriteManifest(spriteFiles: readonly SizedFile[], portraitFiles: readonly string[], base: string = ART_BASE): SpriteManifest {
  const sprites: Record<string, SpriteArt> = {};
  for (const file of [...spriteFiles].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const m = SPRITE_FILE.exec(file.name);
    if (m === null || !(file.width > 0) || !(file.height > 0)) continue;
    sprites[m[1] as string] = { src: `${base}sprites/${file.name}`, w: file.width, h: file.height };
  }
  const found = new Map<string, { lg?: string; sm?: string }>();
  for (const name of [...portraitFiles].sort()) {
    const m = PORTRAIT_FILE.exec(name);
    if (m === null) continue;
    const id = m[1] as string;
    const entry = found.get(id) ?? {};
    entry[m[2] === undefined ? 'lg' : 'sm'] = `${base}portraits/${name}`;
    found.set(id, entry);
  }
  const portraits: Record<string, ArtFiles> = {};
  for (const id of [...found.keys()].sort()) {
    const e = found.get(id) as { lg?: string; sm?: string };
    const lg = e.lg ?? e.sm;
    const sm = e.sm ?? e.lg;
    if (lg !== undefined && sm !== undefined) portraits[id] = { lg, sm };
  }
  return { sprites, portraits };
}

/** How many figures the manifest names (a portrait's two sizes count once). */
export const figureCount = (m: SpriteManifest): number => Object.keys(m.sprites).length + Object.keys(m.portraits).length;

// Set by tools/build.ts and tools/dev.ts (esbuild `define`); absent under `bun test`, where callers pass a manifest.
declare const __SPRITE_MANIFEST__: SpriteManifest | undefined;

/** The manifest this build was made with (empty when the build had no figures). */
export function spriteManifest(): SpriteManifest {
  return typeof __SPRITE_MANIFEST__ === 'undefined' ? EMPTY_SPRITE_MANIFEST : __SPRITE_MANIFEST__;
}

// ---- the failure registry (one per page; a figure that failed to load is not asked for again) ---------------------------------

let failures = new Set<string>();

/** Remember that `src` failed to load: every later render draws the sigil in its place. */
export function markFigureFailed(src: string): void {
  failures.add(src);
}

export const figureFailed = (src: string): boolean => failures.has(src);

/** Tests only: forget every failure. */
export function resetFigureFailures(): void {
  failures = new Set();
}

/** The sprite art for `file`, unless it is missing or failed. */
export function chooseSprite(file: string | null, manifest: SpriteManifest = spriteManifest()): SpriteArt | null {
  if (file === null) return null;
  const art = manifest.sprites[file];
  return art === undefined || failures.has(art.src) ? null : art;
}

/** The portrait files for `npcId`, unless missing or failed (a failed `sm` falls back to the large file, then to none). */
export function choosePortrait(npcId: string | null, manifest: SpriteManifest = spriteManifest()): ArtFiles | null {
  if (npcId === null) return null;
  const files = manifest.portraits[npcId];
  if (files === undefined) return null;
  const lgOk = !failures.has(files.lg);
  const smOk = !failures.has(files.sm);
  if (!lgOk && !smOk) return null;
  return { lg: lgOk ? files.lg : files.sm, sm: smOk ? files.sm : files.lg };
}
