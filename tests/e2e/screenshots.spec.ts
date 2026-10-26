// Screenshots for the fun-review rounds and the release (U78; PLAN §8.3 `screenshots.spec.ts` @screens). Deterministic: the
// scenarios' own seeds, reduced motion on, images decoded before each shot. It writes
// `docs/screenshots/{desktop,mobile}/NN-<screen>.png` from whatever build the server serves, so it is meant for the real
// painted art:
//
//   bun tools/build.ts --e2e --real-art && SCREENSHOTS=1 npx playwright test tests/e2e/screenshots.spec.ts --reporter=line
//   (then `bun tools/build.ts --e2e` again for the default fixture-art build)
//
// The default e2e run skips it (no SCREENSHOTS, and `--grep-invert @screens` also drops it), and `docs/` is the lead's: the
// PNGs are left in the worktree for review and are not committed by the unit that makes them.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

const OUT = path.resolve(import.meta.dirname, '../../docs/screenshots');
const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');

test.describe('screenshots', { tag: '@screens' }, () => {
  test.skip(process.env.SCREENSHOTS !== '1', 'set SCREENSHOTS=1 (and serve a --real-art build) to capture');
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  async function press(target: Locator, info: TestInfo): Promise<void> {
    if (mobile(info)) await target.tap();
    else await target.click();
  }

  /** Waits for every image and the fonts, lets the layout settle, scrolls to the top and writes the PNG. */
  async function shoot(page: Page, info: TestInfo, name: string): Promise<void> {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)));
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(250);
    const dir = path.join(OUT, mobile(info) ? 'mobile' : 'desktop');
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
  }

  async function boot(page: Page, scenario: string, screen: string): Promise<void> {
    await page.goto(`./?scenario=${scenario}`);
    await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
  }

  test('01 title', async ({ page }, info) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'Echoes of Aethelgard: The Unraveling' })).toBeVisible();
    await shoot(page, info, '01-title');
  });

  test('02 class select', async ({ page }, info) => {
    await page.goto('./');
    await press(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'New game' }), info);
    await expect(page.getByRole('heading', { level: 1, name: 'Choose who walks into the Breach' })).toBeVisible();
    await shoot(page, info, '02-class-select');
  });

  test('03 explore: the Whispering Ruins', async ({ page }, info) => {
    await boot(page, 'loop1_day1', 'explore');
    await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();
    await shoot(page, info, '03-explore-whispering-ruins');
  });

  test('04 explore: the Emberforge, a second region', async ({ page }, info) => {
    await boot(page, 'loop1_emberforge', 'explore');
    await expect(page.getByRole('heading', { level: 1, name: 'The Emberforge' })).toBeVisible();
    await shoot(page, info, '04-explore-emberforge');
  });

  test('05 the first fight', async ({ page }, info) => {
    await boot(page, 'first_fight', 'combat');
    await expect(page.locator('.combat-stage')).toBeVisible();
    await shoot(page, info, '05-first-fight');
  });

  test('06 a boss fight', async ({ page }, info) => {
    await boot(page, 'combat_bell_warden_p2', 'combat');
    await expect(page.getByRole('heading', { level: 1, name: 'The Bell-Warden' })).toBeVisible();
    await shoot(page, info, '06-boss-fight');
  });

  test('07 dialogue', async ({ page }, info) => {
    await boot(page, 'loop1_day1', 'explore');
    await press(page.getByRole('button', { name: /^Talk to Ilyra/ }), info);
    await expect(page.locator('[data-screen="dialogue"]')).toBeVisible();
    await shoot(page, info, '07-dialogue');
  });

  test('08 the codex', async ({ page }, info) => {
    await boot(page, 'loop1_day1', 'explore');
    await press(page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Menu', exact: true }), info);
    await press(page.getByRole('dialog', { name: 'Menu', exact: true }).getByRole('button', { name: /^Codex/ }), info);
    await expect(page.getByRole('dialog', { name: 'Codex', exact: true })).toBeVisible();
    await shoot(page, info, '08-codex');
  });

  test('09 the inventory', async ({ page }, info) => {
    await boot(page, 'loop1_respite', 'explore');
    await press(page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Pack', exact: true }), info);
    await expect(page.getByRole('dialog', { name: 'Inventory', exact: true })).toBeVisible();
    await shoot(page, info, '09-inventory');
  });

  test('10 the Threshold', async ({ page }, info) => {
    await boot(page, 'loop2_end', 'threshold');
    await expect(page.getByRole('heading', { level: 1, name: 'The Still Shore' })).toBeVisible();
    await shoot(page, info, '10-threshold');
  });

  test('11 an ending', async ({ page }, info) => {
    await boot(page, 'ending_a_ready', 'combat');
    await page.evaluate(() => (window as unknown as { __aethelgard: { dispatch(a: unknown): unknown } }).__aethelgard.dispatch({ type: 'commune', act: 'speak', answerId: 'take_its_place' }));
    await expect(page.locator('[data-screen="ending"]')).toBeVisible();
    await shoot(page, info, '11-ending');
  });
});
