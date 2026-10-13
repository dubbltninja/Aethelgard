// Dev server (PLAN §3.5): esbuild watch + serve with live reload through esbuild's own change stream (no HMR).
//
//   bun tools/dev.ts [--port 5173]
//
// Output goes to .dev/ (git-ignored) with un-hashed names, so .dev/index.html is written once.
// __DEV__ and __E2E__ are true: dev hooks such as ?scenario= and ?gallery= are available (PLAN §4.13, §8.3).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, copyDir, entryAssets, esbuildOptions, injectAssets, readVersion } from './build';

const portIndex = process.argv.indexOf('--port');
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 5173;
const outdir = path.join(ROOT, '.dev');

fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

const ctx = await esbuild.context({
  ...esbuildOptions({
    root: ROOT,
    entry: 'src/main.tsx',
    assetsDir: path.join(outdir, 'assets'),
    mode: 'dev',
    version: `${readVersion()}-dev`,
  }),
  banner: { js: "new EventSource('/esbuild').addEventListener('change', () => location.reload());" },
  logLevel: 'info',
});

const first = await ctx.rebuild();
if (!first.metafile) throw new Error('esbuild returned no metafile');
const template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
fs.writeFileSync(path.join(outdir, 'index.html'), injectAssets(template, entryAssets(first.metafile, ROOT, outdir)));
copyDir(path.join(ROOT, 'public'), outdir);

await ctx.watch();
const { hosts, port: actual } = await ctx.serve({ servedir: outdir, host: '127.0.0.1', port });
process.stdout.write(`dev: http://${hosts[0] ?? '127.0.0.1'}:${actual}/ (watching src/, live reload; Ctrl+C to stop)\n`);
