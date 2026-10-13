// Playwright (PLAN §3.7). The runner comes from `playwright/test` (`@playwright/test` is not installed, D-065);
// Chromium from PLAYWRIGHT_BROWSERS_PATH (/opt/pw-browsers in the sandbox; CI installs it, PLAN §11).
// `npm run test:e2e` builds dist-e2e/ first; the web server serves it under the GitHub Pages sub-path, so every
// e2e run also proves that the build's relative asset URLs work away from the domain root.
import { defineConfig, devices } from 'playwright/test';

export const BASE_PATH = '/Aethelgard/';
const PORT = 4173;
const ORIGIN = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `${ORIGIN}${BASE_PATH}`, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `node tools/serve.mjs dist-e2e ${PORT} --base ${BASE_PATH}`,
    url: `${ORIGIN}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
  },
});
