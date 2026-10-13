#!/usr/bin/env node
// Static file server for a built directory (PLAN §3.5): Playwright's webServer and `npm run preview`.
//
//   node tools/serve.mjs <dir> [port] [--base /Aethelgard/] [--host 127.0.0.1]
//
// With --base the site is served ONLY under that sub-path (as on GitHub Pages), which proves the build's relative
// asset URLs; `/` redirects to the base. Plain Node, no dependencies.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args.splice(i, 2)[1] : fallback;
};
const host = flag('--host', '127.0.0.1');
const base = `/${flag('--base', '/').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
const [dirArg = 'dist', portArg = '4173'] = args;
const dir = path.resolve(dirArg);
const port = Number(portArg);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

if (!fs.existsSync(path.join(dir, 'index.html'))) {
  console.error(`serve: ${dir}/index.html not found — build first (npm run build, or bun tools/build.ts --e2e)`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (`${pathname}/` === base) {
    res.writeHead(301, { location: base }).end();
    return;
  }
  if (!pathname.startsWith(base)) {
    if (pathname === '/') res.writeHead(302, { location: base }).end();
    else res.writeHead(404, { 'content-type': 'text/plain' }).end(`not found (site is served under ${base})`);
    return;
  }
  let file = path.join(dir, pathname.slice(base.length));
  if (file !== dir && !file.startsWith(dir + path.sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (error, body) => {
    if (error) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(req.method === 'HEAD' ? undefined : body);
  });
});

server.listen(port, host, () => {
  console.log(`serve: ${path.relative(process.cwd(), dir) || '.'} at http://${host}:${port}${base}`);
});
