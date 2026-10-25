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
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildSceneManifest, paintingCount, type SceneManifest } from '../src/ui/art/sceneManifest';

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
}

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

  const result = await esbuild.build(
    esbuildOptions({
      root,
      entry: options.entry ?? 'src/main.tsx',
      assetsDir: path.join(outdir, 'assets'),
      mode: e2e ? 'e2e' : 'production',
      version: options.version ?? readVersion(root),
      sceneManifest,
    }),
  );
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
  if (jsGzipBytes > budget) {
    throw new Error(`JS budget exceeded: ${(jsGzipBytes / 1000).toFixed(1)} kB gzip > ${(budget / 1000).toFixed(0)} kB`);
  }
  log(`build: ok — JS ${(jsGzipBytes / 1000).toFixed(1)} kB gzip (budget ${Number.isFinite(budget) ? `${(budget / 1000).toFixed(0)} kB` : 'none: e2e'})`);
  return { outdir, ...assets, jsGzipBytes, art };
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
