// Production / e2e build (PLAN §3.5): esbuild bundles src/main.tsx into content-hashed assets, then index.html is
// written with RELATIVE asset URLs so dist/ works under any GitHub Pages path (e.g. /Aethelgard/) and from a local
// static server. There is no router and no base-path variable.
//
//   bun tools/build.ts          → dist/      (minified, __E2E__ = false)
//   bun tools/build.ts --e2e    → dist-e2e/  (unminified, __E2E__ = true: dev hooks for Playwright, PLAN §4.13)
//   bun tools/build.ts --e2e --real-art      the e2e build with public/art/ instead of the fixture art (for looking at it)
//
// Scene art (U71, docs/ART.md §7): the art folder's file names become the scene manifest, inlined as `__SCENE_MANIFEST__`
// (src/ui/art/sceneManifest.ts). Production and dev use public/art/; the e2e build uses tests/fixtures/art/ (copied to
// art/ in place of public/art/), so the e2e tests pass whatever the art session adds. Images are separate files, outside
// PLAN §1.1's JS budget (D-124); the build reports their total.
//
// Figures (U73a, docs/ART-2.md §1): `sprites/*.webp` and `portraits/*.webp` in the same folder become the sprite manifest,
// inlined as `__SPRITE_MANIFEST__` (src/ui/art/spriteManifest.ts) with each sprite's stored size (read from the file's header),
// so the stage lays a figure out before it loads. A sprite whose stored height is not its size class's (src/ui/art/sprites.ts)
// is reported, not refused: the game scales it all the same.
//
// Text chunks (U62a, D-115, D-131): the production and e2e builds replace src/content/tables.ts with a generated copy whose
// long prose — codex bodies, dialogue node text, ending slides and epilogues — is a reference (src/content/prose.ts), and
// write the words to hashed JSON chunks beside the bundle (`assets/text-<chunk>-<hash>.json`), named to the app in
// `__PROSE_MANIFEST__` (src/ui/text/prose.ts loads them on first use). The chunks are outside the JS budget, like the art;
// the build reports their total. Dev (tools/dev.ts) bundles the tables as written.
import * as esbuild from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildSceneManifest, paintingCount, type SceneManifest } from '../src/ui/art/sceneManifest';
import { EMPTY_SPRITE_MANIFEST, buildSpriteManifest, figureCount, type SizedFile, type SpriteManifest } from '../src/ui/art/spriteManifest';
import { CREATURE_SPRITES, SIZE_PX } from '../src/ui/art/sprites';
import { splitProse, type ProseChunks } from '../src/content/prose';
import type { ContentTables } from '../src/content/tables';

export const ROOT = path.resolve(import.meta.dirname, '..');
/** PLAN §1.1 bundle budget: total gzip size of every emitted .js file. */
export const JS_BUDGET_BYTES = 600_000;

export interface BuildOptions {
  root?: string;
  entry?: string;
  outdir?: string;
  e2e?: boolean;
  html?: string;
  publicDir?: string;
  budgetBytes?: number;
  version?: string;
  log?: (line: string) => void;
  /** The scene art folder, relative to `root` (default: public/art, or tests/fixtures/art for e2e). */
  artDir?: string;
  /**
   * U62a: the tables whose prose moves to text chunks, and the module (relative to `root`) the build replaces with the split
   * copy. Default: the authored tables (src/content/tables.ts) when building this project; `false`: no split.
   */
  prose?: ProseSource | false;
}

export interface ProseSource {
  tables: ContentTables;
  module: string;
}

/** The module the build replaces (U62a). */
export const TABLES_MODULE = 'src/content/tables.ts';

export const ART_DIR = 'public/art';
export const FIXTURE_ART_DIR = 'tests/fixtures/art';

export interface BuildResult {
  outdir: string;
  /** Asset URLs as written into index.html, relative to it (`./assets/app-<hash>.js`). */
  scripts: string[];
  styles: string[];
  jsGzipBytes: number;
  /** The scene art shipped: images in the manifest and the bytes of every file under art/. */
  art: { images: number; bytes: number };
  /** U73a: the sprites and portraits in the sprite manifest. */
  figures: number;
  /** U62a: the text chunks written beside the bundle (outside the JS budget); zero when the build split no prose. */
  prose: { chunks: number; bytes: number; gzipBytes: number };
}

/** Chunk name → its file's URL relative to the app script (both live in assets/). */
export type ProseManifest = Record<string, string>;

/** Writes each chunk to `assets/text-<name>-<hash>.json`; returns the manifest and the sizes. */
export function writeProseChunks(chunks: Readonly<ProseChunks>, assetsDir: string): { manifest: ProseManifest; bytes: number; gzipBytes: number } {
  fs.mkdirSync(assetsDir, { recursive: true });
  const manifest: ProseManifest = {};
  let bytes = 0;
  let gzipBytes = 0;
  for (const name of Object.keys(chunks).sort()) {
    const json = JSON.stringify(chunks[name]);
    const hash = crypto.createHash('sha256').update(json).digest('hex').slice(0, 10);
    const file = `text-${name}-${hash}.json`;
    fs.writeFileSync(path.join(assetsDir, file), json);
    manifest[name] = `./${file}`;
    bytes += Buffer.byteLength(json);
    gzipBytes += zlib.gzipSync(json, { level: 9 }).length;
  }
  return { manifest, bytes, gzipBytes };
}

/** An esbuild plugin that serves `module` (absolute) as `export const contentTables = <tables>`. */
export function tablesPlugin(module: string, tables: ContentTables): esbuild.Plugin {
  const filter = new RegExp(`^${module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  return {
    name: 'prose-split-tables',
    setup(build) {
      build.onLoad({ filter }, () => ({ contents: `export const contentTables = ${JSON.stringify(tables)};\n`, loader: 'js' }));
    },
  };
}

async function defaultProse(root: string): Promise<ProseSource | false> {
  const module = path.join(root, TABLES_MODULE);
  if (path.resolve(root) !== ROOT || !fs.existsSync(module)) return false;
  const { contentTables } = (await import(module)) as { contentTables: ContentTables };
  return { tables: contentTables, module: TABLES_MODULE };
}

/** The pixel size of a WebP (VP8, VP8L, VP8X) or PNG file from its header; null for anything else. */
export function imageSize(buf: Uint8Array): { width: number; height: number } | null {
  const ascii = (at: number, n: number): string => String.fromCharCode(...buf.subarray(at, at + n));
  const u16 = (at: number): number => (buf[at] ?? 0) | ((buf[at + 1] ?? 0) << 8);
  const u24 = (at: number): number => u16(at) | ((buf[at + 2] ?? 0) << 16);
  if (buf.length >= 24 && buf[0] === 0x89 && ascii(1, 3) === 'PNG') {
    const be = (at: number): number => (((buf[at] ?? 0) << 24) | ((buf[at + 1] ?? 0) << 16) | ((buf[at + 2] ?? 0) << 8) | (buf[at + 3] ?? 0)) >>> 0;
    return { width: be(16), height: be(20) };
  }
  if (buf.length < 30 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') return null;
  const chunk = ascii(12, 4);
  if (chunk === 'VP8X') return { width: u24(24) + 1, height: u24(27) + 1 };
  if (chunk === 'VP8L') {
    const b = (i: number): number => buf[21 + i] ?? 0;
    return { width: 1 + (((b(1) & 0x3f) << 8) | b(0)), height: 1 + (((b(3) & 0xf) << 10) | (b(2) << 2) | ((b(1) & 0xc0) >> 6)) };
  }
  if (chunk === 'VP8 ') return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff };
  return null;
}

/** The sprite manifest of an art folder (`sprites/*.webp` with their sizes, `portraits/*.webp`); empty when missing. */
export function readSpriteManifest(artDir: string): SpriteManifest {
  const list = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isFile()) : []);
  const spriteDir = path.join(artDir, 'sprites');
  const sprites: SizedFile[] = list(spriteDir).flatMap((name) => {
    const size = name.endsWith('.webp') ? imageSize(fs.readFileSync(path.join(spriteDir, name))) : null;
    return size === null ? [] : [{ name, ...size }];
  });
  const manifest = buildSpriteManifest(sprites, list(path.join(artDir, 'portraits')));
  return Object.keys(manifest.sprites).length + Object.keys(manifest.portraits).length === 0 ? EMPTY_SPRITE_MANIFEST : manifest;
}

/** Sprites whose stored height is not their size class's (ART-2 §2): `id: 400 px, medium is 384`. */
export function sizeClassMismatches(manifest: SpriteManifest): string[] {
  const out: string[] = [];
  for (const [id, art] of Object.entries(manifest.sprites)) {
    const size = id.startsWith('cr_') ? CREATURE_SPRITES[id]?.size : 'medium';
    if (size === undefined) out.push(`${id}: not in the sprite registry`);
    else if (Math.abs(art.h - SIZE_PX[size]) > 2) out.push(`${id}: ${art.h} px, ${size} is ${SIZE_PX[size]}`);
  }
  return out;
}

/** The scene manifest of an art folder (`scenes/*.webp` + the root's `title*.webp`); empty when the folder is missing. */
export function readSceneManifest(artDir: string): SceneManifest {
  const list = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isFile()) : []);
  return buildSceneManifest(list(path.join(artDir, 'scenes')), list(artDir));
}

/** Total bytes of the files under `dir`. */
export function dirBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    bytes += entry.isDirectory() ? dirBytes(full) : fs.statSync(full).size;
  }
  return bytes;
}

export function readVersion(root: string = ROOT): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: string };
  return pkg.version ?? '0.0.0';
}

/** esbuild options shared by build.ts and dev.ts. */
export function esbuildOptions(opts: {
  root: string;
  entry: string;
  assetsDir: string;
  mode: 'production' | 'e2e' | 'dev';
  version: string;
  /** Inlined as `__SCENE_MANIFEST__` (empty when absent). */
  sceneManifest?: SceneManifest;
  /** Inlined as `__SPRITE_MANIFEST__` (empty when absent). */
  spriteManifest?: SpriteManifest;
  /** U62a: inlined as `__PROSE_MANIFEST__` (empty when absent: no text chunks, the tables carry their words). */
  proseManifest?: ProseManifest;
}): esbuild.BuildOptions {
  const dev = opts.mode === 'dev';
  return {
    absWorkingDir: opts.root,
    entryPoints: { app: opts.entry },
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    jsx: 'automatic',
    tsconfig: path.join(opts.root, 'tsconfig.json'),
    minify: opts.mode === 'production',
    sourcemap: 'linked',
    metafile: true,
    outdir: opts.assetsDir,
    entryNames: dev ? '[name]' : '[name]-[hash]',
    assetNames: dev ? '[name]' : '[name]-[hash]',
    define: {
      'process.env.NODE_ENV': dev ? '"development"' : '"production"',
      __DEV__: String(dev),
      __E2E__: String(opts.mode !== 'production'),
      __VERSION__: JSON.stringify(opts.version),
      __SCENE_MANIFEST__: JSON.stringify(opts.sceneManifest ?? { scenes: {}, title: null }),
      __SPRITE_MANIFEST__: JSON.stringify(opts.spriteManifest ?? EMPTY_SPRITE_MANIFEST),
      __PROSE_MANIFEST__: JSON.stringify(opts.proseManifest ?? {}),
    },
    logLevel: 'warning',
  };
}

/** Entry chunk(s) and their CSS bundles from an esbuild metafile, as URLs relative to `htmlDir`. */
export function entryAssets(metafile: esbuild.Metafile, root: string, htmlDir: string): { scripts: string[]; styles: string[] } {
  const scripts: string[] = [];
  const styles: string[] = [];
  const rel = (file: string) => `./${path.relative(htmlDir, path.resolve(root, file)).split(path.sep).join('/')}`;
  for (const [file, output] of Object.entries(metafile.outputs)) {
    if (!output.entryPoint || !file.endsWith('.js')) continue;
    scripts.push(rel(file));
    if (output.cssBundle) styles.push(rel(output.cssBundle));
  }
  return { scripts, styles };
}

/** Inject the stylesheet links and module scripts just before </head>. */
export function injectAssets(html: string, assets: { scripts: string[]; styles: string[] }): string {
  const marker = html.indexOf('</head>');
  if (marker < 0) throw new Error('index.html has no </head> to inject assets before');
  const indent = '    ';
  const tags = [
    ...assets.styles.map((href) => `${indent}<link rel="stylesheet" href="${href}" />`),
    ...assets.scripts.map((src) => `${indent}<script type="module" src="${src}"></script>`),
  ];
  const before = html.slice(0, marker).replace(/[ \t]*$/, '');
  return `${before}${tags.join('\n')}\n  ${html.slice(marker)}`;
}

export function copyDir(from: string, to: string, skip: readonly string[] = []): number {
  if (!fs.existsSync(from)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      count += copyDir(src, dest);
    } else {
      fs.copyFileSync(src, dest);
      count += 1;
    }
  }
  return count;
}

export async function buildApp(options: BuildOptions = {}): Promise<BuildResult> {
  const root = options.root ?? ROOT;
  const e2e = options.e2e ?? false;
  const outdir = path.resolve(root, options.outdir ?? (e2e ? 'dist-e2e' : 'dist'));
  const log = options.log ?? (() => {});
  // PLAN §1.1's budget is the shipped bundle's: the e2e build is unminified (dev hooks for Playwright), so it is checked
  // only when a budget is passed (U56: the content pushed it past 600 kB while production stays far inside)
  const budget = options.budgetBytes ?? (e2e ? Number.POSITIVE_INFINITY : JS_BUDGET_BYTES);

  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });
  const publicDir = path.resolve(root, options.publicDir ?? 'public');
  const artDir = path.resolve(root, options.artDir ?? (e2e ? FIXTURE_ART_DIR : ART_DIR));
  const sceneManifest = readSceneManifest(artDir);
  const spriteManifest = readSpriteManifest(artDir);

  // U62a: the prose split — the chunks first (their hashed names go into the bundle), then the bundle over the split tables
  const proseSource = options.prose ?? (await defaultProse(root));
  const assetsDir = path.join(outdir, 'assets');
  let proseManifest: ProseManifest = {};
  let prose: BuildResult['prose'] = { chunks: 0, bytes: 0, gzipBytes: 0 };
  const plugins: esbuild.Plugin[] = [];
  if (proseSource !== false) {
    const split = splitProse(proseSource.tables);
    const written = writeProseChunks(split.chunks, assetsDir);
    proseManifest = written.manifest;
    prose = { chunks: Object.keys(written.manifest).length, bytes: written.bytes, gzipBytes: written.gzipBytes };
    plugins.push(tablesPlugin(path.resolve(root, proseSource.module), split.tables));
  }

  const base = esbuildOptions({
    root,
    entry: options.entry ?? 'src/main.tsx',
    assetsDir,
    mode: e2e ? 'e2e' : 'production',
    version: options.version ?? readVersion(root),
    sceneManifest,
    spriteManifest,
    proseManifest,
  });
  const result = await esbuild.build({ ...base, plugins });
  const metafile = result.metafile;
  if (!metafile) throw new Error('esbuild returned no metafile');

  const assets = entryAssets(metafile, root, outdir);
  if (assets.scripts.length === 0) throw new Error('esbuild emitted no entry script');
  const template = fs.readFileSync(path.resolve(root, options.html ?? 'index.html'), 'utf8');
  fs.writeFileSync(path.join(outdir, 'index.html'), injectAssets(template, assets));
  // the art folder lands at art/ whatever its source (public/art is skipped when another folder stands in for it)
  const ownArt = artDir === path.join(publicDir, 'art');
  let copied = copyDir(publicDir, outdir, ownArt ? [] : ['art']);
  if (!ownArt && fs.existsSync(artDir)) {
    fs.mkdirSync(path.join(outdir, 'art'), { recursive: true });
    copied += copyDir(artDir, path.join(outdir, 'art'));
  }
  const art = { images: paintingCount(sceneManifest), bytes: dirBytes(path.join(outdir, 'art')) };
  const figures = figureCount(spriteManifest);

  let jsGzipBytes = 0;
  for (const file of Object.keys(metafile.outputs)) {
    if (!file.endsWith('.js')) continue;
    const gz = zlib.gzipSync(fs.readFileSync(path.resolve(root, file)), { level: 9 }).length;
    jsGzipBytes += gz;
    log(`  ${path.relative(root, path.resolve(root, file))}  ${(gz / 1000).toFixed(1)} kB gzip`);
  }
  for (const href of assets.styles) log(`  ${path.relative(root, path.join(outdir, href))}`);
  log(`  index.html + ${copied} public file(s) → ${path.relative(root, outdir) || '.'}/`);
  log(`  art: ${art.images} image(s) from ${path.relative(root, artDir) || '.'}/, ${(art.bytes / 1000).toFixed(1)} kB (outside the JS budget)`);
  log(`  art: ${figures} figure(s) (sprites + portraits)`);
  if (prose.chunks > 0) {
    log(`  text: ${prose.chunks} chunk(s), ${(prose.gzipBytes / 1000).toFixed(1)} kB gzip, ${(prose.bytes / 1000).toFixed(1)} kB raw (outside the JS budget)`);
  }
  for (const line of sizeClassMismatches(spriteManifest)) log(`  art: sprite size class — ${line}`);
  if (jsGzipBytes > budget) {
    throw new Error(`JS budget exceeded: ${(jsGzipBytes / 1000).toFixed(1)} kB gzip > ${(budget / 1000).toFixed(0)} kB`);
  }
  log(`build: ok — JS ${(jsGzipBytes / 1000).toFixed(1)} kB gzip (budget ${Number.isFinite(budget) ? `${(budget / 1000).toFixed(0)} kB` : 'none: e2e'})`);
  return { outdir, ...assets, jsGzipBytes, art, figures, prose };
}

if (import.meta.main) {
  try {
    await buildApp({
      e2e: process.argv.includes('--e2e'),
      ...(process.argv.includes('--real-art') ? { artDir: ART_DIR } : {}),
      log: (line) => process.stdout.write(`${line}\n`),
    });
  } catch (error) {
    process.stderr.write(`build: FAILED — ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
