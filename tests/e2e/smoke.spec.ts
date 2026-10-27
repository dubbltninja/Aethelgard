// Smoke (PLAN §8.3, §11.1): the built page loads from the Pages sub-path on desktop and mobile, React renders and
// responds to input (New game → class → the first location), every asset resolves relative to the sub-path, and the
// console stays clean. U63 replaced the U10 scaffold page with the game's Title.
import { expect, test, type ConsoleMessage, type Response } from 'playwright/test';

test.describe('smoke', { tag: '@smoke' }, () => {
  test('loads from the sub-path, starts a game, no console errors', async ({ page, baseURL }) => {
    const problems: string[] = [];
    const failed: string[] = [];
    page.on('console', (message: ConsoleMessage) => {
      if (message.type() === 'error' || message.type() === 'warning') problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error: Error) => problems.push(`pageerror: ${error.message}`));
    page.on('response', (response: Response) => {
      if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => failed.push(`failed ${request.url()}`));

    const response = await page.goto('./');
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/Aethelgard/');
    expect(baseURL).toMatch(/\/Aethelgard\/$/);

    await expect(page).toHaveTitle('Echoes of Aethelgard');
    await expect(page.getByRole('heading', { level: 1, name: 'Echoes of Aethelgard: The Unraveling' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();

    // the bundle and its stylesheet are served from the sub-path through relative URLs
    const scripts = await page.locator('script[type="module"]').evaluateAll((nodes) =>
      nodes.map((node) => [node.getAttribute('src') ?? '', (node as HTMLScriptElement).src]),
    );
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.[0]).toMatch(/^\.\/assets\/app-[A-Z0-9]+\.js$/);
    expect(new URL(scripts[0]?.[1] ?? '').pathname).toMatch(/^\/Aethelgard\/assets\//);
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
    expect(styles).toHaveLength(1);
    expect(styles[0]).toMatch(/^\.\/assets\/app-[A-Z0-9]+\.css$/);

    // React is live: New game → Class Select → Begin lands on the first location
    await page.getByRole('button', { name: 'New game' }).click();
    await page.getByRole('button', { name: /^Begin as / }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();

    expect(failed).toEqual([]);
    expect(problems).toEqual([]);
  });
});
