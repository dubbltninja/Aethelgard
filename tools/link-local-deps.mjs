#!/usr/bin/env node
// Offline bootstrap (PLAN §3.6, D-065): the npm registry is blocked in the build sandbox, so instead of
// `npm install` this script symlinks the pinned packages (and their dependency closure) from a local store
// into node_modules/, links the CLI binaries, and verifies every version.
//
//   node tools/link-local-deps.mjs                # link + verify (sandbox)
//   node tools/link-local-deps.mjs --verify-only  # verify what is already in node_modules (CI, after npm install)
//
// Idempotent. A package that is already a real directory in node_modules (e.g. installed by npm in CI) is
// left alone and only verified. Never touches the network. Store: $LOCAL_NPM_TOOLS or /opt/npm-tools/node_modules.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = process.env.LOCAL_NPM_TOOLS || '/opt/npm-tools/node_modules';
const NM = path.join(ROOT, 'node_modules');
const BINS = ['tsc', 'esbuild', 'playwright', 'tsx'];
const verifyOnly = process.argv.includes('--verify-only');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const pkg = readJson(path.join(ROOT, 'package.json'));
const pins = { ...pkg.dependencies, ...pkg.devDependencies };

/** Minimal semver range check: exact `x.y.z`, `^x.y.z`, `~x.y.z`, `*` (all the closure needs). */
function satisfies(version, range) {
  const parse = (v) => v.replace(/^[\^~=v]+/, '').split('-')[0].split('.').map((n) => Number(n) || 0);
  if (range === '*' || range === 'latest' || range === '') return true;
  const [a, b, c] = parse(version);
  const [x, y, z] = parse(range);
  const ge = a > x || (a === x && (b > y || (b === y && c >= z)));
  if (range.startsWith('^')) return ge && (x > 0 ? a === x : y > 0 ? a === 0 && b === y : a === 0 && b === 0 && c === z);
  if (range.startsWith('~')) return ge && a === x && b === y;
  return a === x && b === y && c === z;
}

/** Optional dependencies for another platform (esbuild's per-platform binaries, fsevents) are skipped. */
function wantedOptional(name) {
  if (name === 'fsevents') return process.platform === 'darwin';
  if (name.startsWith('@esbuild/')) return name === `@esbuild/${process.platform}-${process.arch}`;
  return true;
}

/** Where a package's manifest is read from: node_modules for --verify-only or a real install, else the store. */
function source(name) {
  const local = path.join(NM, name);
  if (verifyOnly) return local;
  const stat = fs.lstatSync(local, { throwIfNoEntry: false });
  return stat && !stat.isSymbolicLink() ? local : path.join(STORE, name);
}

/** Dependency closure: name → range, walking each package's own (optional) dependencies. */
function closure() {
  const want = new Map(Object.entries(pins));
  const queue = [...want.keys()];
  const missing = [];
  while (queue.length > 0) {
    const name = queue.shift();
    const manifest = path.join(source(name), 'package.json');
    if (!fs.existsSync(manifest)) {
      missing.push(name);
      continue;
    }
    const meta = readJson(manifest);
    const required = Object.entries(meta.dependencies ?? {});
    const optional = Object.entries(meta.optionalDependencies ?? {})
      .filter(([dep]) => wantedOptional(dep) && !Object.hasOwn(meta.dependencies ?? {}, dep))
      .filter(([dep]) => fs.existsSync(path.join(source(dep), 'package.json')));   // absent optional deps are fine
    for (const [dep, range] of [...required, ...optional]) {
      if (want.has(dep)) continue;
      want.set(dep, range);
      queue.push(dep);
    }
  }
  return { want, missing };
}

function link(name) {
  const target = path.join(STORE, name);
  const dest = path.join(NM, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const stat = fs.lstatSync(dest, { throwIfNoEntry: false });
  if (stat && !stat.isSymbolicLink()) return 'kept';          // a real install (CI): leave it, verify below
  if (stat && fs.readlinkSync(dest) === target) return 'ok';
  if (stat) fs.unlinkSync(dest);
  fs.symlinkSync(target, dest, 'dir');
  return 'linked';
}

function linkBins() {
  const binDir = path.join(NM, '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  for (const name of Object.keys(pins)) {
    const meta = readJson(path.join(NM, name, 'package.json'));
    const bins = typeof meta.bin === 'string' ? { [meta.name.split('/').pop()]: meta.bin } : (meta.bin ?? {});
    for (const [bin, rel] of Object.entries(bins)) {
      if (!BINS.includes(bin)) continue;
      const dest = path.join(binDir, bin);
      const target = path.join('..', name, rel);
      const stat = fs.lstatSync(dest, { throwIfNoEntry: false });
      if (stat && !stat.isSymbolicLink()) continue;
      if (stat && fs.readlinkSync(dest) === target) continue;
      if (stat) fs.unlinkSync(dest);
      fs.symlinkSync(target, dest);
    }
  }
}

const { want, missing } = closure();
const counts = { linked: 0, ok: 0, kept: 0 };
if (!verifyOnly && missing.length === 0) {
  for (const name of want.keys()) counts[link(name)] += 1;
  linkBins();
}

const problems = missing.map((name) => `${name}: not found in ${verifyOnly ? NM : STORE}`);
for (const [name, range] of want) {
  const manifest = path.join(NM, name, 'package.json');
  if (!fs.existsSync(manifest)) {
    if (!missing.includes(name)) problems.push(`${name}: missing from node_modules`);
    continue;
  }
  const { version } = readJson(manifest);
  const pinned = Object.hasOwn(pins, name);
  if (pinned ? version !== range : !satisfies(version, range)) {
    problems.push(`${name}: found ${version}, ${pinned ? 'pinned' : 'required'} ${range}`);
  }
}
if (!verifyOnly) {
  for (const bin of BINS) {
    if (!fs.existsSync(path.join(NM, '.bin', bin))) problems.push(`.bin/${bin}: not linked`);
  }
}

if (problems.length > 0) {
  console.error(`link-local-deps: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
const summary = verifyOnly
  ? `verified ${want.size} packages against the pins`
  : `${want.size} packages (${counts.linked} linked, ${counts.ok} already linked, ${counts.kept} real installs kept), bins: ${BINS.join(', ')}`;
console.log(`link-local-deps: ok — ${summary}`);
