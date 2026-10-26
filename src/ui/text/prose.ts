// The text chunks (U62a Part B, D-131): the long prose the build moved out of the bundle (src/content/prose.ts), loaded on
// first use and cached for the session. The build names each chunk's hashed file in `__PROSE_MANIFEST__` (relative to the
// app script, so it works under any Pages path and offline once cached by the browser). A text that is not a reference —
// every text in dev, the tests and the sims — is itself. Models resolve their texts with `proseText` (null while the chunk
// is loading: the view shows a quiet loading line); containers subscribe with `useProse`, which loads what is missing and
// re-renders when it lands; `preloadProse` warms the next likely chunk (the region's dialogue, the codex).
import { useEffect, useSyncExternalStore } from 'react';
import { DIALOGUE_COMMON_CHUNK, ENDINGS_CHUNK, dialogueChunk, parseProseRef, type ProseChunks } from '@content/prose';

declare const __PROSE_MANIFEST__: Record<string, string> | undefined;

export type ProseResolver = (text: string) => string | null;

const loaded = new Map<string, readonly string[]>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;
let manifestOverride: Record<string, string> | null = null;

function manifest(): Record<string, string> {
  if (manifestOverride !== null) return manifestOverride;
  return typeof __PROSE_MANIFEST__ === 'undefined' ? {} : __PROSE_MANIFEST__;
}

function changed(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/** A text's words: ordinary text as is; a reference's words once its chunk is loaded, else null. */
export const proseText: ProseResolver = (text) => {
  const ref = parseProseRef(text);
  if (ref === null) return text;
  return loaded.get(ref.chunk)?.[ref.index] ?? null;
};

/** The chunk a reference points into (null for ordinary text). */
export function proseChunkOf(text: string): string | null {
  return parseProseRef(text)?.chunk ?? null;
}

/** Loads a chunk once (a failed load may be retried); resolves when it is cached. Unknown chunks resolve at once. */
export function loadProse(chunk: string): Promise<void> {
  if (loaded.has(chunk)) return Promise.resolve();
  const running = inflight.get(chunk);
  if (running !== undefined) return running;
  const file = manifest()[chunk];
  if (file === undefined) return Promise.resolve();
  const url = new URL(file, import.meta.url);
  const job = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`text chunk '${chunk}': HTTP ${res.status}`);
      return res.json() as Promise<string[]>;
    })
    .then((texts) => {
      loaded.set(chunk, texts);
      changed();
    })
    .finally(() => inflight.delete(chunk));
  inflight.set(chunk, job);
  return job;
}

/** Retry delay after a failed load (offline, a flaky network): a view still waiting asks again. */
const RETRY_MS = 3000;

/** Starts loading chunks in the background; a failure is quiet and wakes the waiting views a little later to retry. */
export function preloadProse(...chunks: readonly (string | null | undefined)[]): void {
  for (const chunk of chunks) if (chunk) loadProse(chunk).catch(() => setTimeout(changed, RETRY_MS));
}

/** The chunks worth having before a conversation starts in `regionId`: its scenes and the camp/companion scenes. */
export function regionProse(regionId: string | null | undefined): string[] {
  return regionId ? [dialogueChunk(regionId), DIALOGUE_COMMON_CHUNK] : [DIALOGUE_COMMON_CHUNK];
}

export const ENDINGS_PROSE = ENDINGS_CHUNK;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = (): number => version;

/**
 * Subscribes a container to the chunk cache and loads the chunks of `texts` (and `extra`) that are missing. Returns the
 * cache version: use it as a memo dependency so a model computed with `proseText` is recomputed when a chunk lands.
 */
export function useProse(texts: readonly (string | null | undefined)[], extra: readonly string[] = []): number {
  const v = useSyncExternalStore(subscribe, snapshot, snapshot);
  const wanted = [...new Set([...extra, ...texts.map((t) => (t ? proseChunkOf(t) : null)).filter((c): c is string => c !== null)])].filter((c) => !loaded.has(c));
  const key = wanted.join('|');
  useEffect(() => {
    if (key !== '') preloadProse(...key.split('|'));
  }, [key, v]);
  return v;
}

// ---- tests ---------------------------------------------------------------------------------------------------------------------

/** Fills the cache synchronously (unit tests: the chunks from `splitProse`). */
export function primeProse(chunks: Readonly<ProseChunks>): void {
  for (const [name, texts] of Object.entries(chunks)) loaded.set(name, texts);
  changed();
}

/** Empties the cache; with a manifest, uses it in place of the build's (unit tests). */
export function resetProse(manifestForTests: Record<string, string> | null = null): void {
  loaded.clear();
  inflight.clear();
  manifestOverride = manifestForTests;
  changed();
}

/** Whether a chunk is cached (tests, the e2e hooks). */
export const proseLoaded = (chunk: string): boolean => loaded.has(chunk);

// ---- preloading ----------------------------------------------------------------------------------------------------------------

/** Delay before the background preload of the endings chunk (a closer can come at any time: Let go, the thirtieth dawn). */
export const ENDINGS_PRELOAD_MS = 2000;

/**
 * The Shell's preloads: the current region's conversations and the camp/companion scenes whenever the region changes, and
 * the endings a moment after the game starts. `regionId` is null off the map (the title).
 */
export function useProsePreload(regionId: string | null): void {
  useEffect(() => {
    if (regionId !== null) preloadProse(...regionProse(regionId));
  }, [regionId]);
  useEffect(() => {
    const timer = setTimeout(() => preloadProse(ENDINGS_CHUNK), ENDINGS_PRELOAD_MS);
    return () => clearTimeout(timer);
  }, []);
}
