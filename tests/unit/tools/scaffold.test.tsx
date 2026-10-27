// Engine-free smoke for the unit-test pipeline: bun runs TSX through tsconfig (including the stylesheet imports of
// src/main.tsx), React 19 renders on the server, bunfig [define] provides the build constants, and coverage is
// collected (PLAN §3.3). U63 replaced the U10 scaffold page with <App/>; the boot-failure page is the one main.tsx
// renders itself.
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BootFailure, TITLE } from '../../../src/main';

test('build constants are defined for bun', () => {
  expect(__DEV__).toBe(true);
  expect(__E2E__).toBe(false);
  expect(__VERSION__).toBe('test');
});

test('the boot-failure page names the game and the reason in a main landmark', () => {
  const html = renderToStaticMarkup(<BootFailure message="no storage" />);
  expect(html).toContain(`<h1 id="boot-failure-heading">${TITLE}</h1>`);
  expect(html).toContain('<main');
  expect(html).toContain('aria-labelledby="boot-failure-heading"');
  expect(html).toContain('The game could not start: no storage');
});
