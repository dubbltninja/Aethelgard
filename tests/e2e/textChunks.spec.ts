// U62a Part B (D-131): the long prose lives in hashed JSON text chunks beside the bundle, loaded on first use. With every
// chunk request held back, a Codex entry and a conversation open cold: each shows a quiet loading line, and its words appear
// once its chunk is let through. The chunks come from the Pages sub-path's assets/ folder, like the bundle.
import { expect, test, type Locator, type Page, type Route, type TestInfo } from 'playwright/test';

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');

async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
}

/** Holds every text-chunk request until its chunk is released; records the URLs asked for. */
async function holdChunks(page: Page): Promise<{ release: (chunk: string) => Promise<void>; releaseAll: () => Promise<void>; asked: string[] }> {
  const held: { chunk: string; route: Route }[] = [];
  const open = new Set<string>();
  const asked: string[] = [];
  const chunkOf = (url: string): string => /text-(.+)-[0-9a-f]{10}\.json$/.exec(url)?.[1] ?? url;
  await page.route('**/assets/text-*.json', async (route) => {
    const chunk = chunkOf(route.request().url());
    asked.push(route.request().url());
    if (open.has(chunk)) await route.continue();
    else held.push({ chunk, route });
  });
  const release = async (chunk: string): Promise<void> => {
    open.add(chunk);
    for (const h of held.filter((x) => x.chunk === chunk)) await h.route.continue();
    held.splice(0, held.length, ...held.filter((x) => x.chunk !== chunk));
  };
  const releaseAll = async (): Promise<void> => {
    for (const chunk of new Set(held.map((h) => h.chunk))) await release(chunk);
  };
  return { release, releaseAll, asked };
}

test.describe('text chunks', () => {
  test('a Codex entry and a conversation open cold: a quiet loading line, then the words', async ({ page }, info) => {
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
    });
    page.on('pageerror', (e) => problems.push(e.message));
    const chunks = await holdChunks(page);

    await page.goto('./?scenario=loop1_day1');
    await expect(page.locator('[data-screen="explore"]')).toBeVisible();

    // the Codex: the entry's body waits for the codex chunk
    await press(page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Menu' }), info);
    await press(page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: /^Codex/ }), info);
    const codex = page.getByRole('dialog', { name: 'Codex' });
    await press(codex.getByRole('button', { name: /^The Temporal Breach, Remnant Archive/ }), info);
    await expect(codex.getByRole('heading', { level: 3, name: 'The Temporal Breach' })).toBeVisible();
    await expect(codex.getByTestId('text-loading')).toBeVisible();
    await expect(codex.getByTestId('text-loading')).toHaveAttribute('aria-busy', 'true');
    await expect(codex.getByText(/the hour tore and the city followed/)).toHaveCount(0);
    await chunks.release('codex');
    await expect(codex.getByText(/the hour tore and the city followed/)).toBeVisible();
    await expect(codex.getByTestId('text-loading')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(codex).toBeHidden();

    // a conversation: Ilyra's first line waits for the Ruins' dialogue chunk
    await press(page.getByRole('button', { name: /^Talk to Ilyra/ }), info);
    await expect(page.locator('[data-screen="dialogue"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'The whispers are louder' })).toBeVisible();
    await expect(page.locator('.dialogue__line').getByTestId('text-loading')).toBeVisible();
    await chunks.release('dlg-region_silverwood_ruins');
    await expect(page.getByText('The whispers here are louder each day.', { exact: false }).first()).toBeVisible();
    await expect(page.locator('.dialogue__line').getByTestId('text-loading')).toHaveCount(0);

    // the chunks are static files under the sub-path's assets/, fetched once each
    expect(chunks.asked.length).toBeGreaterThan(0);
    for (const url of chunks.asked) expect(new URL(url).pathname).toMatch(/^\/Aethelgard\/assets\/text-[a-z0-9_-]+-[0-9a-f]{10}\.json$/);
    expect(new Set(chunks.asked).size).toBe(chunks.asked.length);
    await chunks.releaseAll();
    expect(problems).toEqual([]);
  });
});
