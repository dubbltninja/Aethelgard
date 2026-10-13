// Engine-free smoke for the unit-test pipeline: bun runs TSX through tsconfig, React 19 renders on the server,
// bunfig [define] provides the build constants, and coverage is collected (PLAN §3.3).
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScaffoldPage, TITLE } from '../../../src/main';

test('build constants are defined for bun', () => {
  expect(__DEV__).toBe(true);
  expect(__E2E__).toBe(false);
  expect(__VERSION__).toBe('test');
});

test('the scaffold page renders an accessible heading, version and live status', () => {
  const html = renderToStaticMarkup(<ScaffoldPage version="2.0.0" />);
  expect(html).toContain(`<h1 id="title">${TITLE}</h1>`);
  expect(html).toContain('<main');
  expect(html).toContain('aria-labelledby="title"');
  expect(html).toContain('Version 2.0.0');
  expect(html).toContain('<button type="button"');
  expect(html).toContain('role="status" aria-live="polite">The bell is silent.</p>');
});
