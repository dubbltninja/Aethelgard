// Production / e2e build (PLAN §3.5): esbuild bundles src/main.tsx into content-hashed assets, then index.html is
// written with RELATIVE asset URLs so dist/ works under any GitHub Pages path (e.g. /Aethelgard/) and from a local
// static server. There is no router and no base-path variable.
//
//   bun tools/build.ts          → dist/      (minified, __E2E__ = false)
//   bun tools/build.ts --e2e    → dist-e2e/  (unminified, __E2E__ = true: dev hooks for Playwright, PLAN §4.13)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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
}

export interface BuildResult {
  outdir: string;
  /** Asset URLs as written into index.html, relative to it (`./assets/app-<hash>.js`). */
  scripts: string[];
  styles: string[];
  jsGzipBytes: number;
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

export function copyDir(from: string, to: string): number {
  if (!fs.existsSync(from)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
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
  const budget = options.budgetBytes ?? JS_BUDGET_BYTES;

  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });

  const result = await esbuild.build(
    esbuildOptions({
      root,
      entry: options.entry ?? 'src/main.tsx',
      assetsDir: path.join(outdir, 'assets'),
      mode: e2e ? 'e2e' : 'production',
      version: options.version ?? readVersion(root),
    }),
  );
  const metafile = result.metafile;
  if (!metafile) throw new Error('esbuild returned no metafile');

  const assets = entryAssets(metafile, root, outdir);
  if (assets.scripts.length === 0) throw new Error('esbuild emitted no entry script');
  const template = fs.readFileSync(path.resolve(root, options.html ?? 'index.html'), 'utf8');
  fs.writeFileSync(path.join(outdir, 'index.html'), injectAssets(template, assets));
  const copied = copyDir(path.resolve(root, options.publicDir ?? 'public'), outdir);

  let jsGzipBytes = 0;
  for (const file of Object.keys(metafile.outputs)) {
    if (!file.endsWith('.js')) continue;
    const gz = zlib.gzipSync(fs.readFileSync(path.resolve(root, file)), { level: 9 }).length;
    jsGzipBytes += gz;
    log(`  ${path.relative(root, path.resolve(root, file))}  ${(gz / 1000).toFixed(1)} kB gzip`);
  }
  for (const href of assets.styles) log(`  ${path.relative(root, path.join(outdir, href))}`);
  log(`  index.html + ${copied} public file(s) → ${path.relative(root, outdir) || '.'}/`);
  if (jsGzipBytes > budget) {
    throw new Error(`JS budget exceeded: ${(jsGzipBytes / 1000).toFixed(1)} kB gzip > ${(budget / 1000).toFixed(0)} kB`);
  }
  log(`build: ok — JS ${(jsGzipBytes / 1000).toFixed(1)} kB gzip (budget ${(budget / 1000).toFixed(0)} kB)`);
  return { outdir, ...assets, jsGzipBytes };
}

if (import.meta.main) {
  try {
    await buildApp({ e2e: process.argv.includes('--e2e'), log: (line) => process.stdout.write(`${line}\n`) });
  } catch (error) {
    process.stderr.write(`build: FAILED — ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
