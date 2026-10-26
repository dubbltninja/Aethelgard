// Long prose out of the main bundle (U62a Part B, D-115, D-131). The build (tools/build.ts) runs `splitProse` over the
// authored tables: each moved text becomes a short reference, `\u0001<chunk>#<n>`, and its words go into a JSON chunk —
// a hashed static file beside the bundle that the UI loads on first use (src/ui/text/prose.ts). What moves:
//   - codex bodies                                   → chunk `codex`;
//   - dialogue node text and its variants' text      → chunk `dlg-<region>` of the scene's home (the NPC's home region, else
//                                                       the region of the place whose event opens it), else `dlg-common`;
//   - ending slides (`sequence`) and epilogues       → chunk `endings`.
// Everything the engine computes with stays: ids, conditions, effects, numbers, names, choice text, location and event
// text. The engine passes a reference through untouched (in an event's `text`, a model's text) and the UI resolves it;
// the engine never compares or logs moved prose — the one place it compares a node's words with an event's (explore.ts
// `sceneSaysIt`) is kept intact by leaving such a node's text in the bundle. The sims, the validator and the tests use the
// tables as written, so nothing they do depends on a chunk. Pure.
import type { ContentTables } from './tables';

/** The first character of a reference: a control character no authored text begins with. */
export const PROSE_MARK = '\u0001';
export const CODEX_CHUNK = 'codex';
export const ENDINGS_CHUNK = 'endings';
export const DIALOGUE_COMMON_CHUNK = 'dlg-common';
export const dialogueChunk = (regionId: string): string => `dlg-${regionId}`;

/** Chunk name → its texts, by index. */
export type ProseChunks = Record<string, string[]>;

export interface ProseRef {
  chunk: string;
  index: number;
}

export const proseRef = (chunk: string, index: number): string => `${PROSE_MARK}${chunk}#${index}`;
export const isProseRef = (text: string): boolean => text.charCodeAt(0) === 1;

/** The chunk and index of a reference; null for ordinary text. */
export function parseProseRef(text: string): ProseRef | null {
  if (!isProseRef(text)) return null;
  const hash = text.lastIndexOf('#');
  if (hash < 2) return null;
  const index = Number(text.slice(hash + 1));
  return Number.isInteger(index) && index >= 0 ? { chunk: text.slice(1, hash), index } : null;
}

/** A reference's words from `chunks` (ordinary text is returned as is); throws on a reference the chunks lack. */
export function resolveProse(text: string, chunks: Readonly<ProseChunks>): string {
  const ref = parseProseRef(text);
  if (ref === null) return text;
  const found = chunks[ref.chunk]?.[ref.index];
  if (found === undefined) throw new Error(`prose: '${ref.chunk}#${ref.index}' is not in its chunk`);
  return found;
}

/** Every `startDialogue` scene id under `value`. */
function scenesStarted(value: unknown, out: string[]): string[] {
  if (Array.isArray(value)) for (const v of value) scenesStarted(v, out);
  else if (typeof value === 'object' && value !== null) {
    for (const [key, v] of Object.entries(value)) {
      if (key === 'startDialogue' && typeof v === 'string') out.push(v);
      else scenesStarted(v, out);
    }
  }
  return out;
}

/** Scene id → the dialogue chunk it belongs to (see the header). */
export function sceneChunks(tables: Pick<ContentTables, 'dialogues' | 'npcs' | 'locations'>): Map<string, string> {
  const regionOfLocation = new Map(tables.locations.map((l) => [l.id, l.regionId] as const));
  const homeOfNpc = new Map(tables.npcs.map((n) => [n.id, n.homeLocationId] as const));
  const openedIn = new Map<string, string>();
  for (const loc of tables.locations) for (const scene of scenesStarted(loc, [])) if (!openedIn.has(scene)) openedIn.set(scene, loc.regionId);
  const out = new Map<string, string>();
  for (const scene of tables.dialogues) {
    const home = scene.npcId === undefined ? undefined : homeOfNpc.get(scene.npcId);
    const region = (home === undefined || home === null ? undefined : regionOfLocation.get(home)) ?? openedIn.get(scene.id);
    out.set(scene.id, region === undefined ? DIALOGUE_COMMON_CHUNK : dialogueChunk(region));
  }
  return out;
}

/** Location event texts: a node saying exactly one of them keeps its words in the bundle (explore.ts `sceneSaysIt`). */
function eventTexts(tables: Pick<ContentTables, 'locations'>): Set<string> {
  const out = new Set<string>();
  for (const loc of tables.locations) for (const ev of loc.events ?? []) out.add(ev.text);
  return out;
}

/**
 * The tables with their long prose replaced by references, and the chunks the references point into. The input is not
 * touched (the result is a JSON copy: every table is plain data). Chunk texts are unique within a chunk.
 */
export function splitProse(input: ContentTables): { tables: ContentTables; chunks: ProseChunks } {
  const tables = JSON.parse(JSON.stringify(input)) as ContentTables;
  const chunks: ProseChunks = {};
  const seen = new Map<string, Map<string, number>>();
  const put = (chunk: string, text: string): string => {
    const list = (chunks[chunk] ??= []);
    const at = seen.get(chunk) ?? new Map<string, number>();
    seen.set(chunk, at);
    let index = at.get(text);
    if (index === undefined) {
      index = list.length;
      list.push(text);
      at.set(text, index);
    }
    return proseRef(chunk, index);
  };

  for (const entry of tables.codex) entry.body = put(CODEX_CHUNK, entry.body);

  const chunkOf = sceneChunks(tables);
  const keep = eventTexts(tables);
  for (const scene of tables.dialogues) {
    const chunk = chunkOf.get(scene.id) ?? DIALOGUE_COMMON_CHUNK;
    for (const node of scene.nodes) {
      if (!keep.has(node.text)) node.text = put(chunk, node.text);
      for (const variant of node.textVariants ?? []) variant.text = put(chunk, variant.text);
    }
  }

  for (const ending of tables.endings) {
    for (const slide of ending.sequence ?? []) slide.text = put(ENDINGS_CHUNK, slide.text);
    for (const epilogue of ending.epilogues ?? []) epilogue.text = put(ENDINGS_CHUNK, epilogue.text);
  }
  return { tables, chunks };
}
