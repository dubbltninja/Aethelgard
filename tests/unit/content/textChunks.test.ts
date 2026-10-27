// U62a Part B (D-115, D-131): the long prose leaves the bundle for lazily loaded text chunks. `splitProse` turns codex bodies,
// dialogue node text and ending slides into references; every reference resolves from its chunk to the authored words; the
// engine and the sims never need a chunk (a run on the split pack ends in the same state as on the authored one); the UI
// reads the words through the chunk cache and shows a loading line until the chunk is there.
import { afterEach, describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, type ContentPack } from '@content/index';
import {
  CODEX_CHUNK,
  DIALOGUE_COMMON_CHUNK,
  ENDINGS_CHUNK,
  dialogueChunk,
  isProseRef,
  parseProseRef,
  proseRef,
  resolveProse,
  sceneChunks,
  splitProse,
  type ProseChunks,
} from '@content/prose';
import type { ContentTables } from '@content/tables';
import { endingSlides, legalActions, step, type GameState, type Profile } from '@engine/index';
import { BOTS } from '@sim/bots/index';
import { runLoop } from '@sim/runner';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { codexModel, NO_FILTER } from '@ui/panels/codexModel';
import { dialogueModel, rawLine } from '@ui/screens/dialogueModel';
import { endingSlideList } from '@ui/screens/endingModel';
import { loadProse, preloadProse, primeProse, proseChunkOf, proseLoaded, proseText, regionProse, resetProse } from '@ui/text/prose';
import { announceStep } from '@ui/a11y/announce';

const split = splitProse(contentTables);
const splitPack: ContentPack = buildContentPack(split.tables, { validate: false });
const fullPack: ContentPack = buildContentPack();

/** Every reference in the split tables, with the authored text it stands for. */
function pairs(): { ref: string; text: string; where: string }[] {
  const out: { ref: string; text: string; where: string }[] = [];
  const walk = (a: unknown, b: unknown, where: string): void => {
    if (typeof a === 'string' && typeof b === 'string') {
      if (isProseRef(a)) out.push({ ref: a, text: b, where });
    } else if (Array.isArray(a) && Array.isArray(b)) a.forEach((x, i) => walk(x, b[i], `${where}[${i}]`));
    else if (a && b && typeof a === 'object' && typeof b === 'object') for (const k of Object.keys(a)) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${where}.${k}`);
  };
  walk(split.tables, contentTables, '');
  return out;
}

afterEach(() => resetProse());

describe('splitProse', () => {
  test('references: a control-character mark, a chunk and an index; ordinary text is not one', () => {
    expect(proseRef('codex', 3)).toBe('\u0001codex#3');
    expect(parseProseRef('\u0001dlg-region_veil#12')).toEqual({ chunk: 'dlg-region_veil', index: 12 });
    expect(parseProseRef('Plain words #1')).toBeNull();
    expect(parseProseRef('\u0001broken')).toBeNull();
    expect(parseProseRef('\u0001x#-1')).toBeNull();
    expect(resolveProse('Plain words', {})).toBe('Plain words');
    expect(() => resolveProse('\u0001codex#999999', split.chunks)).toThrow('not in its chunk');
  });

  test('every codex body, dialogue line and ending slide is a reference that resolves to the authored words', () => {
    const all = pairs();
    for (const { ref, text, where } of all) expect([where, resolveProse(ref, split.chunks)]).toEqual([where, text]);
    const where = all.map((p) => p.where);
    expect(where.filter((w) => w.startsWith('.codex')).length).toBe(contentTables.codex.length);
    expect(where.some((w) => /^\.dialogues\[\d+\]\.nodes\[\d+\]\.text$/.test(w))).toBe(true);
    expect(where.some((w) => /textVariants\[\d+\]\.text$/.test(w))).toBe(true);
    expect(where.some((w) => /^\.endings\[\d+\]\.sequence/.test(w))).toBe(true);
    expect(where.some((w) => /^\.endings\[\d+\]\.epilogues/.test(w))).toBe(true);
    // nothing else moved: names, choices, events, descriptions stay
    expect(where.every((w) => /^\.(codex\[\d+\]\.body|dialogues\[\d+\]\.nodes\[\d+\]\.(text|textVariants\[\d+\]\.text)|endings\[\d+\]\.(sequence|epilogues)\[\d+\]\.text)$/.test(w))).toBe(true);
  });

  test('resolving every reference gives back the authored tables exactly; the input is untouched', () => {
    const back = JSON.parse(JSON.stringify(split.tables), (_k, v: unknown) => (typeof v === 'string' && isProseRef(v) ? resolveProse(v, split.chunks) : v)) as ContentTables;
    expect(back).toEqual(JSON.parse(JSON.stringify(contentTables)) as ContentTables);
    expect(contentTables.codex.every((e) => !isProseRef(e.body))).toBe(true);
  });

  test('chunks: the codex, the endings, one per region’s conversations and the common ones; texts unique within a chunk', () => {
    expect(Object.keys(split.chunks)).toContain(CODEX_CHUNK);
    expect(Object.keys(split.chunks)).toContain(ENDINGS_CHUNK);
    expect(Object.keys(split.chunks)).toContain(DIALOGUE_COMMON_CHUNK);
    expect(Object.keys(split.chunks)).toContain(dialogueChunk('region_silverwood_ruins'));
    for (const texts of Object.values(split.chunks)) expect(new Set(texts).size).toBe(texts.length);
    const chunkOf = sceneChunks(contentTables);
    const ilyra = contentTables.dialogues.find((d) => d.npcId === 'npc_ilyra');
    if (ilyra !== undefined) expect(chunkOf.get(ilyra.id)).toBe(dialogueChunk('region_silverwood_ruins'));
  });

  test('a node that says a location event’s words keeps them (the engine compares the two: explore.ts sceneSaysIt)', () => {
    const events = new Set(contentTables.locations.flatMap((l) => (l.events ?? []).map((e) => e.text)));
    const kept = split.tables.dialogues.flatMap((d) => d.nodes).filter((n) => !isProseRef(n.text));
    expect(kept.length).toBeGreaterThan(0);
    for (const node of kept) expect(events.has(node.text)).toBe(true);
  });

  test('the split tables still parse into a pack (the schemas are unchanged)', () => {
    expect(Object.keys(splitPack.codex)).toEqual(Object.keys(fullPack.codex));
    expect(isProseRef(Object.values(splitPack.codex)[0]!.body)).toBe(true);
  });
});

describe('the engine and the sims never need a chunk', () => {
  for (const bot of ['explorer', 'random'] as const) {
    test(`${bot}: a loop on the split pack ends in the same state as on the authored one`, () => {
      const run = (pack: ContentPack) => runLoop({ seed: `u62a:${bot}`, classId: 'auto', bot: BOTS[bot]!(), stopAt: 'loop_end', maxSteps: 700, maxFallen: 3 }, pack);
      const a = run(fullPack);
      const b = run(splitPack);
      expect(b.errors).toEqual([]);
      expect(b.steps).toBe(a.steps);
      expect(b.finalStateHash).toBe(a.finalStateHash);
      expect(b.codexUnlocked).toEqual(a.codexUnlocked);
      expect(b.choicesTaken).toEqual(a.choicesTaken);
      expect(a.codexUnlocked.length).toBeGreaterThan(0); // the run met the codex pass
      if (bot === 'explorer') expect(a.choicesTaken.length).toBeGreaterThan(0); // and spoke with someone
    }, 30_000); // two full loops: ~3 s alone, past bun's 5 s default on the shared 2-core machine
  }

  test('an ending’s slides are references on the split pack, the words on the authored one', () => {
    const s: GameState = makeState({ mode: 'ending', patch: (st) => void (st.pendingEnding = { outcome: 'closer_fall', reason: 'released', slideIndex: 0 }) }, { content: fullPack });
    const profile: Profile = freshProfile();
    const words = endingSlides(s, fullPack, profile);
    const refs = endingSlides(s, splitPack, profile);
    expect(refs).toHaveLength(words.length);
    expect(refs.map((r) => resolveProse(r, split.chunks))).toEqual(words);
  });
});

describe('the UI reads the words through the chunk cache', () => {
  const entry = Object.values(fullPack.codex).find((e) => e !== undefined && e.unlockedAtStart)!;

  test('proseText: ordinary text as is; a reference null until its chunk is cached', () => {
    const ref = splitPack.codex[entry.id]!.body;
    expect(proseText('Hello')).toBe('Hello');
    expect(proseChunkOf(ref)).toBe(CODEX_CHUNK);
    expect(proseChunkOf('Hello')).toBeNull();
    expect(proseText(ref)).toBeNull();
    primeProse(split.chunks);
    expect(proseText(ref)).toBe(entry.body);
    expect(proseLoaded(CODEX_CHUNK)).toBe(true);
    expect(regionProse('region_veil')).toEqual([dialogueChunk('region_veil'), DIALOGUE_COMMON_CHUNK]);
    expect(regionProse(null)).toEqual([DIALOGUE_COMMON_CHUNK]);
  });

  test('the codex: an unlocked entry is loading until the codex chunk lands, then shows its paragraphs', () => {
    const cold = codexModel(splitPack, freshProfile(), new Set(), NO_FILTER).rows.find((r) => r.id === entry.id)!;
    expect(cold).toMatchObject({ unlocked: true, loading: true, paragraphs: [] });
    primeProse({ [CODEX_CHUNK]: split.chunks[CODEX_CHUNK]! });
    const warm = codexModel(splitPack, freshProfile(), new Set(), NO_FILTER).rows.find((r) => r.id === entry.id)!;
    expect(warm.loading).toBe(false);
    expect(warm.paragraphs).toEqual(codexModel(fullPack, freshProfile(), new Set(), NO_FILTER).rows.find((r) => r.id === entry.id)!.paragraphs);
    const locked = codexModel(splitPack, freshProfile(), new Set(), NO_FILTER).rows.find((r) => !r.unlocked)!;
    expect(locked.loading).toBe(false);
  });

  test('a dialogue: the line is loading until its region’s chunk lands; the back-log reads through the cache too', () => {
    const scene = Object.values(splitPack.dialogues).find((d) => d !== undefined && d.npcId === 'npc_ilyra')!;
    let s = makeState({ locationId: fullPack.npcs['npc_ilyra']!.homeLocationId! }, { content: splitPack });
    const out = step(s, { type: 'talk', npcId: 'npc_ilyra' }, splitPack, freshProfile());
    s = out.state;
    expect(s.mode).toBe('dialogue');
    const raw = rawLine(s, splitPack, freshProfile())!;
    expect(isProseRef(raw)).toBe(true);
    expect(proseChunkOf(raw)).toBe(dialogueChunk(splitPack.locations[s.world.currentLocationId]!.regionId));
    const cold = dialogueModel(s, splitPack, freshProfile(), legalActions(s, splitPack, freshProfile()))!;
    expect(cold).toMatchObject({ loading: true, text: '' });
    primeProse(split.chunks);
    const warm = dialogueModel(s, splitPack, freshProfile(), legalActions(s, splitPack, freshProfile()))!;
    expect(warm.loading).toBe(false);
    expect(warm.text).toBe(resolveProse(raw, split.chunks));
    expect(scene.id.startsWith('scene_')).toBe(true);
  });

  test('the ending slides and their announcement read through the cache', () => {
    const s: GameState = makeState({ mode: 'ending', patch: (st) => void (st.pendingEnding = { outcome: 'closer_fall', reason: 'released', slideIndex: 0 }) }, { content: splitPack });
    const cold = endingSlideList(s, splitPack, freshProfile());
    expect(cold.some((x) => x.loading)).toBe(true);
    const ref = endingSlides(s, splitPack, freshProfile()).find(isProseRef)!;
    expect(announceStep([{ t: 'endingSlide', endingId: 'closer_fall', index: 1, text: ref }], s, splitPack)).toBeNull();
    primeProse(split.chunks);
    const warm = endingSlideList(s, splitPack, freshProfile());
    expect(warm.every((x) => !x.loading && x.text !== '')).toBe(true);
    expect(announceStep([{ t: 'endingSlide', endingId: 'closer_fall', index: 1, text: ref }], s, splitPack)).toBe(resolveProse(ref, split.chunks));
  });

  test('loadProse fetches a chunk once from the manifest, caches it, and retries after a failure', async () => {
    const chunks: ProseChunks = { codex: ['One body.'] };
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    let fail = true;
    globalThis.fetch = (async (url: URL | string) => {
      calls.push(String(url));
      if (fail) return new Response('nope', { status: 503 });
      return new Response(JSON.stringify(chunks.codex), { status: 200 });
    }) as typeof fetch;
    try {
      resetProse({ codex: './text-codex-abc.json' });
      await expect(loadProse('codex')).rejects.toThrow('HTTP 503');
      expect(proseLoaded('codex')).toBe(false);
      fail = false;
      await Promise.all([loadProse('codex'), loadProse('codex')]);
      expect(calls).toHaveLength(2);
      expect(calls[1]?.endsWith('/text-codex-abc.json')).toBe(true);
      expect(proseText(proseRef('codex', 0))).toBe('One body.');
      await loadProse('codex');
      await loadProse('not-in-the-manifest');
      preloadProse('codex', null, undefined);
      expect(calls).toHaveLength(2);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
