// U62a Part B: the build replaces the content tables module with its prose-split copy, writes the text chunks as hashed
// JSON files beside the bundle, names them in `__PROSE_MANIFEST__`, and reports their total outside the JS budget. On this
// project the shipped bundle holds none of the moved prose.
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contentTables, type ContentTables } from '@content/index';
import { isProseRef, splitProse } from '@content/prose';
import { buildApp, ROOT, writeProseChunks } from '../../../tools/build';

const tmp = (prefix: string): string => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

const BODY = 'The Breach opened at dawn and the whole sky went the colour of old pewter.';
const LINE = 'You came back. They always come back, the ones with the Amulet.';
const SLIDE = 'The light takes the last of the city, and then it takes you.';

/** A tiny tables module: one codex entry, one scene, one ending. */
function tinyTables(): ContentTables {
  return {
    codex: [{ id: 'codex_a', title: 'A', voice: 'remnant_archive', category: 'history', body: BODY }],
    dialogues: [{ id: 'scene_a', entry: 'n1', nodes: [{ id: 'n1', speaker: 'narrator', text: LINE, next: 'end' }] }],
    endings: [{ id: 'ending_a', name: 'A', tagline: 'A.', sequence: [{ text: SLIDE }], epilogues: [] }],
    npcs: [],
    locations: [],
  } as unknown as ContentTables;
}

function fixtureRoot(): string {
  const root = tmp('prose-build-');
  const write = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  write('package.json', JSON.stringify({ name: 'fixture', version: '1.0.0' }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: {} }));
  write('index.html', '<!doctype html>\n<html>\n  <head>\n    <title>t</title>\n  </head>\n  <body></body>\n</html>\n');
  write('src/tables.ts', `export const contentTables = ${JSON.stringify(tinyTables())};\n`);
  write('src/main.ts', "import { contentTables } from './tables';\ndocument.title = contentTables.codex[0].body + JSON.stringify(__PROSE_MANIFEST__);\n");
  return root;
}

describe('the prose split in the build', () => {
  test('the tables module is replaced by its split copy; the chunks are hashed files named in the manifest', async () => {
    const root = fixtureRoot();
    const log: string[] = [];
    const result = await buildApp({ root, entry: 'src/main.ts', prose: { tables: tinyTables(), module: 'src/tables.ts' }, log: (l) => log.push(l) });
    const js = fs.readFileSync(path.join(root, 'dist', result.scripts[0]!), 'utf8');
    for (const text of [BODY, LINE, SLIDE]) expect(js).not.toContain(text.slice(0, 40));
    expect(js).toContain('\u0001codex#0');
    expect(result.prose.chunks).toBe(3);
    const files = fs.readdirSync(path.join(root, 'dist/assets')).filter((f) => f.startsWith('text-'));
    expect(files.sort().map((f) => f.replace(/-[0-9a-f]{10}\.json$/, ''))).toEqual(['text-codex', 'text-dlg-common', 'text-endings']);
    for (const file of files) expect(js).toContain(`./${file}`);
    const codexFile = files.find((f) => f.startsWith('text-codex-'))!;
    expect(JSON.parse(fs.readFileSync(path.join(root, 'dist/assets', codexFile), 'utf8'))).toEqual([BODY]);
    expect(log.some((l) => /^ {2}text: 3 chunk\(s\), [\d.]+ kB gzip, [\d.]+ kB raw \(outside the JS budget\)$/.test(l))).toBe(true);
    // the e2e build splits the same way
    const e2e = await buildApp({ root, entry: 'src/main.ts', e2e: true, prose: { tables: tinyTables(), module: 'src/tables.ts' } });
    expect(e2e.prose.chunks).toBe(3);
    expect(fs.readFileSync(path.join(root, 'dist-e2e', e2e.scripts[0]!), 'utf8')).not.toContain(BODY.slice(0, 40));
  });

  test('without a tables module (another project) nothing is split; the manifest is empty', async () => {
    const root = fixtureRoot();
    fs.writeFileSync(path.join(root, 'src/main.ts'), 'document.title = JSON.stringify(__PROSE_MANIFEST__);\n');
    const result = await buildApp({ root, entry: 'src/main.ts' });
    expect(result.prose).toEqual({ chunks: 0, bytes: 0, gzipBytes: 0 });
    expect(fs.readdirSync(path.join(root, 'dist/assets')).some((f) => f.startsWith('text-'))).toBe(false);
  });

  test('chunk files are content-hashed: the same words give the same name, other words another', () => {
    const dir = tmp('prose-chunks-');
    const a = writeProseChunks({ codex: ['x'] }, dir).manifest;
    const b = writeProseChunks({ codex: ['x'] }, dir).manifest;
    const c = writeProseChunks({ codex: ['y'] }, dir).manifest;
    expect(a).toEqual(b);
    expect(a.codex).not.toBe(c.codex);
  });

  test('this project: the production bundle holds none of the moved prose', async () => {
    const outdir = tmp('prose-real-');
    const empty = tmp('prose-public-');
    const result = await buildApp({ root: ROOT, outdir, publicDir: empty, artDir: path.join(empty, 'art') });
    const js = fs.readFileSync(path.join(outdir, result.scripts[0]!), 'utf8');
    const { tables } = splitProse(contentTables);
    const moved: string[] = [];
    contentTables.codex.forEach((e) => moved.push(e.body));
    contentTables.dialogues.forEach((d, i) => d.nodes.forEach((n, j) => isProseRef(tables.dialogues[i]!.nodes[j]!.text) && moved.push(n.text)));
    contentTables.endings.forEach((e) => [...(e.sequence ?? []), ...(e.epilogues ?? [])].forEach((x) => moved.push(x.text)));
    expect(moved.length).toBeGreaterThan(500);
    // esbuild escapes non-ASCII and quotes: look for each text's longest plain-ASCII run of 30+ characters (a text that
    // the bundle also says elsewhere — an event, a journal line, an engine or UI line — is skipped)
    const code = (dir: string): string =>
      fs.readdirSync(dir, { withFileTypes: true }).map((d) => (d.isDirectory() ? code(path.join(dir, d.name)) : fs.readFileSync(path.join(dir, d.name), 'utf8'))).join('\n');
    const kept = JSON.stringify(tables) + code(path.join(ROOT, 'src/engine')) + code(path.join(ROOT, 'src/ui'));
    let checked = 0;
    for (const text of moved) {
      const run = (text.match(/[A-Za-z0-9 ,.;:!?()-]{30,}/g) ?? []).sort((a, b) => b.length - a.length)[0];
      if (run === undefined || kept.includes(run)) continue;
      checked += 1;
      expect(js.includes(run) ? text : null).toBeNull();
    }
    expect(checked).toBeGreaterThan(400);
    expect(result.prose.chunks).toBeGreaterThan(3);
    fs.rmSync(outdir, { recursive: true, force: true });
  }, 60_000);
});
