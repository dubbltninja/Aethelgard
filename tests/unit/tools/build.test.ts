// tools/build.ts: content-hashed assets, RELATIVE URLs in index.html (dist/ must work under any Pages sub-path),
// CSS bundle injection, public/ copy and the JS gzip budget (PLAN §3.5).
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp, injectAssets, readSceneManifest, readVersion } from '../../../tools/build';

function fixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-test-'));
  const write = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  write('package.json', JSON.stringify({ name: 'fixture', version: '9.8.7' }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@lib/*': ['./src/lib/*'] } } }));
  write('index.html', '<!doctype html>\n<html>\n  <head>\n    <title>t</title>\n  </head>\n  <body></body>\n</html>\n');
  write('src/lib/answer.ts', 'export const answer = 42;\n');
  write('src/style.css', 'body { color: rebeccapurple; }\n');
  write(
    'src/main.ts',
    "import './style.css';\nimport { answer } from '@lib/answer';\n" +
      'document.title = `${answer} ${__VERSION__} ${__E2E__} ${__DEV__}`;\n',
  );
  write('public/favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
  write('public/nested/info.txt', 'hello\n');
  return root;
}

describe('buildApp', () => {
  const root = fixtureRoot();

  test('emits hashed js + css, relative URLs, public files and the defines', async () => {
    const log: string[] = [];
    const result = await buildApp({ root, entry: 'src/main.ts', log: (line) => log.push(line) });
    expect(result.outdir).toBe(path.join(root, 'dist'));
    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0]).toMatch(/^\.\/assets\/app-[A-Z0-9]{8}\.js$/);
    expect(result.styles).toHaveLength(1);
    expect(result.styles[0]).toMatch(/^\.\/assets\/app-[A-Z0-9]{8}\.css$/);

    const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
    expect(html).toContain(`<link rel="stylesheet" href="${result.styles[0]}" />`);
    expect(html).toContain(`<script type="module" src="${result.scripts[0]}"></script>`);
    expect(html).not.toMatch(/(?:src|href)="\//);   // no absolute URLs: works under /Aethelgard/ or any path

    const js = fs.readFileSync(path.join(root, 'dist', result.scripts[0] ?? ''), 'utf8');
    expect(js).toContain('9.8.7');
    expect(js).toContain('42');
    expect(js).not.toContain('__VERSION__');
    expect(fs.existsSync(path.join(root, 'dist/favicon.svg'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'dist/nested/info.txt'))).toBe(true);
    expect(result.jsGzipBytes).toBeGreaterThan(0);
    expect(log.at(-1)).toMatch(/^build: ok — JS [\d.]+ kB gzip \(budget 600 kB\)$/);
  });

  test('--e2e builds to dist-e2e/ unminified with __E2E__ = true', async () => {
    const result = await buildApp({ root, entry: 'src/main.ts', e2e: true });
    expect(result.outdir).toBe(path.join(root, 'dist-e2e'));
    const js = fs.readFileSync(path.join(result.outdir, result.scripts[0] ?? ''), 'utf8');
    expect(js).toContain('${true} ${false}');   // `${__E2E__} ${__DEV__}` after define, not minified
    expect(js).toContain('// src/main.ts');
  });

  test('fails when the gzip budget is exceeded', async () => {
    await expect(buildApp({ root, entry: 'src/main.ts', budgetBytes: 10 })).rejects.toThrow('JS budget exceeded');
    // the e2e build (unminified) is held to a budget only when one is passed
    await expect(buildApp({ root, entry: 'src/main.ts', e2e: true, budgetBytes: 10 })).rejects.toThrow('JS budget exceeded');
    const log: string[] = [];
    await buildApp({ root, entry: 'src/main.ts', e2e: true, log: (line) => log.push(line) });
    expect(log.at(-1)).toContain('(budget none: e2e)');
  });

  test('U71: the art folder becomes the inlined scene manifest; e2e swaps in the fixture art at art/', async () => {
    const w = (rel: string) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), 'RIFF');
    };
    w('public/art/scenes/loc_real.webp');
    w('public/art/title.webp');
    w('tests/fixtures/art/scenes/loc_fake.webp');
    w('tests/fixtures/art/scenes/loc_fake@sm.webp');
    fs.writeFileSync(path.join(root, 'src/scene.ts'), 'document.title = JSON.stringify(__SCENE_MANIFEST__);\n');
    expect(Object.keys(readSceneManifest(path.join(root, 'public/art')).scenes)).toEqual(['loc_real']);
    expect(readSceneManifest(path.join(root, 'nowhere'))).toEqual({ scenes: {}, title: null });

    const log: string[] = [];
    const prod = await buildApp({ root, entry: 'src/scene.ts', log: (line) => log.push(line) });
    expect(fs.readFileSync(path.join(prod.outdir, prod.scripts[0] ?? ''), 'utf8')).toContain('art/scenes/loc_real.webp');
    expect(fs.existsSync(path.join(prod.outdir, 'art/scenes/loc_real.webp'))).toBe(true);
    expect(prod.art).toEqual({ images: 2, bytes: 8 });
    expect(log.some((l) => l.includes('art: 2 image(s) from public/art/'))).toBe(true);

    const e2e = await buildApp({ root, entry: 'src/scene.ts', e2e: true });
    const js = fs.readFileSync(path.join(e2e.outdir, e2e.scripts[0] ?? ''), 'utf8');
    expect(js).toContain('art/scenes/loc_fake@sm.webp');
    expect(js).not.toContain('loc_real');
    expect(fs.existsSync(path.join(e2e.outdir, 'art/scenes/loc_fake.webp'))).toBe(true);
    expect(fs.existsSync(path.join(e2e.outdir, 'art/scenes/loc_real.webp'))).toBe(false);
    expect(e2e.art.images).toBe(1);
    const real = await buildApp({ root, entry: 'src/scene.ts', e2e: true, artDir: 'public/art' });
    expect(fs.existsSync(path.join(real.outdir, 'art/scenes/loc_real.webp'))).toBe(true);
  });

  test('reads the version from package.json', () => {
    expect(readVersion(root)).toBe('9.8.7');
  });
});

describe('injectAssets', () => {
  test('inserts tags before </head> and requires one', () => {
    const html = injectAssets('<head>\n  <title>x</title>\n</head>', { scripts: ['./a.js'], styles: ['./a.css'] });
    expect(html).toBe(
      '<head>\n  <title>x</title>\n    <link rel="stylesheet" href="./a.css" />\n    <script type="module" src="./a.js"></script>\n  </head>',
    );
    expect(() => injectAssets('<body></body>', { scripts: [], styles: [] })).toThrow('no </head>');
  });
});
