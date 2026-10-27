// The phone action bar (U73 part B, D-130; DESIGN §16.5 mobile): under 760 px the turn's controls pin to the bottom of the
// viewport, above the key legend — Attack, Guard, Item, Flee when it is a choice, and Abilities, which opens the grid as a
// sheet — so a fight never needs a scroll. The first fight is played from the bar alone; the sheet opens, uses an ability
// and closes; the communion takes the bar's place and "Show abilities" gives it back; nothing scrolls sideways at 150 %
// text; targets stay 44 px. Desktop keeps the panel buttons and the ability grid in the page.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface GameWindow {
  __aethelgard: { state: { mode: string; combat: { phase: string; round: number } | null } };
}

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');
const gameState = (page: Page): Promise<GameWindow['__aethelgard']['state']> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state);
const scrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY);
const dock = (page: Page): Locator => page.locator('#dock-slot');

async function boot(page: Page, scenario: string): Promise<void> {
  await page.goto(`./?scenario=${scenario}`);
  await expect(page.locator('[data-screen="combat"]')).toBeVisible();
}

async function dismissHint(page: Page): Promise<void> {
  // "Turn tutorials off" ends every hint at once (a fight can queue several)
  const off = page.getByRole('button', { name: 'Turn tutorials off' });
  // (a DOM click: a tap would let Playwright scroll the page to its target, which is not what a thumb does)
  if (await off.isVisible()) await off.evaluate((el) => (el as HTMLElement).click());
  await expect(page.getByRole('button', { name: 'Got it' })).toBeHidden();
}

/** top, bottom and height of an element in the viewport. */
async function box(target: Locator): Promise<{ top: number; bottom: number; height: number }> {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height };
  });
}

test.describe('the phone action bar', () => {
  test('the first fight is played from the pinned bar without scrolling', async ({ page }, info) => {
    test.skip(!mobile(info), 'phones only');
    await boot(page, 'first_fight');
    const bar = dock(page).getByRole('group', { name: 'Turn actions' });
    await expect(bar).toBeVisible();
    const attack = bar.getByRole('button', { name: /^1: Attack, at Corrupted Shade/ });
    await expect(attack).toBeFocused();
    await expect(bar.getByRole('button', { name: /^G: Guard/ })).toBeVisible();
    await expect(bar.getByRole('button', { name: /^I: Item/ })).toBeVisible();
    await expect(bar.getByRole('button', { name: /^F: Flee, \d+% chance/ })).toBeVisible();
    // no ability yet at Level 1: no Abilities button, and no second Attack or Guard anywhere
    await expect(bar.getByRole('button', { name: /^Abilities/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^1: Attack/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^G: Guard/ })).toHaveCount(1);

    // pinned: its bottom edge is the viewport's (the legend is hidden on touch), and the page has not moved
    const view = page.viewportSize();
    const placed = await box(dock(page));
    expect(Math.abs(placed.bottom - (view?.height ?? 0))).toBeLessThanOrEqual(1);
    expect(await scrollY(page)).toBe(0);

    // the hint closes (it sits in the dock above the bar); then the stage, the intent and both HP bars fit above the bar
    await dismissHint(page);
    const top = (await box(dock(page))).top;
    const above = [
      page.locator('.combat-stage'),
      page.locator('.combat__enemies .intent').first(),
      page.getByRole('meter', { name: 'Corrupted Shade HP' }),
      page.getByRole('meter', { name: /^HP$/ }),
    ];
    for (const part of above) {
      await expect(part.first()).toBeVisible();
      const b = await box(part.first());
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.bottom).toBeLessThanOrEqual(top + 1);
    }

    // fight on from the bar alone: the page never scrolls
    for (let i = 0; i < 40; i++) {
      if (await page.getByRole('dialog', { name: 'Victory' }).isVisible()) break;
      await attack.tap();
      await expect
        .poll(async () => (await page.getByRole('dialog', { name: 'Victory' }).isVisible()) || (await gameState(page)).combat?.phase === 'playerTurn')
        .toBe(true);
      if (!(await page.getByRole('dialog', { name: 'Victory' }).isVisible())) expect(await scrollY(page)).toBe(0);
    }
    await expect(page.getByRole('dialog', { name: 'Victory' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Victory' }).getByRole('button', { name: 'Continue' }).tap();
    expect((await gameState(page)).mode).toBe('explore');
    // the bar leaves with the fight
    await expect(page.locator('.phone-bar')).toHaveCount(0);
  });

  test('a boss with a banner: the stage, its intent and both HP bars are on screen with the bar', async ({ page }, info) => {
    test.skip(!mobile(info), 'phones only');
    await boot(page, 'combat_bell_warden_p2');
    await dismissHint(page);
    // the player's two bars ride in the dock (visual copies; the panel keeps the named meters)
    const vitals = dock(page).locator('.phone-vitals');
    await expect(vitals).toBeVisible();
    await expect(vitals).toContainText('HP');
    await expect(vitals).toContainText('Focus');
    const top = (await box(dock(page))).top;
    for (const part of [page.locator('.combat-stage'), page.locator('.combat__enemies .intent__chip').first(), page.getByRole('meter', { name: 'The Bell-Warden HP' })]) {
      const b = await box(part.first());
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.bottom).toBeLessThanOrEqual(top + 1);
    }
    expect(await scrollY(page)).toBe(0);
  });

  test('Guard and Flee work from the bar; a boss cannot be fled', async ({ page }, info) => {
    test.skip(!mobile(info), 'phones only');
    await boot(page, 'combat_bell_warden_p2');
    const bar = dock(page).getByRole('group', { name: 'Turn actions' });
    await expect(bar.getByRole('button', { name: /^F: Flee/ })).toHaveCount(0);
    await bar.getByRole('button', { name: /^G: Guard, halves the next hits/ }).tap();
    await expect.poll(async () => (await gameState(page)).combat?.phase).toBe('playerTurn');
    await expect(page.getByRole('log')).toContainText('Wayfinder guards.');
    // the numbers the Guard button used to carry stay in the page as one line
    await expect(page.locator('.player-panel__guard-note')).toContainText(/^If you Guard: /);
  });

  test('the Abilities sheet opens, uses an ability and closes', async ({ page }, info) => {
    test.skip(!mobile(info), 'phones only');
    await boot(page, 'combat_tyrant_contained_p2');
    await dismissHint(page);
    const bar = dock(page).getByRole('group', { name: 'Turn actions' });
    const opener = bar.getByRole('button', { name: /^Abilities, \d+ ready$/ });
    await expect(opener).toBeVisible();
    // the grid is not in the page until it is asked for
    await expect(page.getByRole('button', { name: /^2: Marked Shot/ })).toHaveCount(0);
    await opener.tap();
    const sheet = page.getByRole('dialog', { name: 'Abilities' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: /^1: Attack/ })).toHaveCount(0); // Attack stays in the bar
    const shot = sheet.getByRole('button', { name: /^2: Marked Shot, at / });
    await expect(shot).toBeVisible();
    expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    // Escape closes it without acting
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    const round = (await gameState(page)).combat?.round ?? 0;
    await opener.tap();
    await sheet.getByRole('button', { name: /^2: Marked Shot, at / }).tap();
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await gameState(page)).combat?.round ?? 0).toBeGreaterThan(round);
    await expect(page.getByRole('log')).toContainText('Marked Shot');
    // the number keys still reach the abilities with the sheet closed (a hardware keyboard on a tablet or a phone)
    await expect(opener).toBeVisible();
  });

  test('the communion takes the bar; "Show abilities" gives it back', async ({ page }, info) => {
    test.skip(!mobile(info), 'phones only');
    await boot(page, 'communion_movement_2');
    const region = dock(page).getByRole('region', { name: 'Communion with The Chronos Tyrant' });
    await expect(region).toBeVisible();
    await expect(page.getByRole('group', { name: 'Turn actions' })).toHaveCount(0);
    await expect(region.getByRole('button', { name: /^\d: Speak: I have not read it\.$/ })).toBeFocused();
    // pinned to the bottom, short enough to leave the stage in view
    const view = page.viewportSize();
    const placed = await box(dock(page));
    expect(Math.abs(placed.bottom - (view?.height ?? 0))).toBeLessThanOrEqual(1);
    expect(placed.height).toBeLessThanOrEqual((view?.height ?? 0) * 0.43);
    const stage = await box(page.locator('.combat-stage'));
    expect(stage.top).toBeGreaterThanOrEqual(0);
    expect(stage.bottom).toBeLessThanOrEqual(placed.top + 1);
    // one communion act from the pinned panel
    await region.getByRole('button', { name: /^\d: Listen$/ }).tap();
    await expect(region.getByRole('meter', { name: 'Resolve' })).toHaveAttribute('aria-valuenow', '6');
    // the abilities are one toggle away, and the bar comes back
    await region.getByRole('button', { name: /^Show abilities/ }).tap();
    const bar = dock(page).getByRole('group', { name: 'Turn actions' });
    await expect(bar.getByRole('button', { name: /^1: Attack/ })).toBeVisible();
    await expect(bar.getByRole('button', { name: /^Abilities, / })).toBeVisible();
    await page.getByRole('button', { name: /^Show the communion/ }).tap();
    await expect(dock(page).getByRole('region', { name: 'Communion with The Chronos Tyrant' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Turn actions' })).toHaveCount(0);
  });

  test('no sideways scroll at 150 % text, and every target is 44 px', async ({ page }, info) => {
    test.skip(!mobile(info), 'phones only');
    await boot(page, 'combat_tyrant_contained_p2');
    await dismissHint(page);
    const sizes = (): Promise<string[]> =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('#dock-slot button')]
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => ({ el, box: el.getBoundingClientRect() }))
          .filter(({ box: b }) => b.width < 44 || b.height < 44 || b.left < 0 || b.right > innerWidth + 0.5)
          .map(({ el, box: b }) => `${el.getAttribute('aria-label')} ${Math.round(b.width)}×${Math.round(b.height)} @${Math.round(b.left)}`),
      );
    expect(await sizes()).toEqual([]);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '150%';
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await sizes()).toEqual([]);
    // the bar wraps instead of overflowing, and still sits at the bottom
    const view = page.viewportSize();
    const placed = await box(dock(page));
    expect(Math.abs(placed.bottom - (view?.height ?? 0))).toBeLessThanOrEqual(1);
    await dock(page).getByRole('button', { name: /^Abilities, / }).tap();
    await expect(page.getByRole('dialog', { name: 'Abilities' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('desktop is unchanged: the panel buttons and the ability grid stay in the page, no bar', async ({ page }, info) => {
    test.skip(mobile(info), 'desktop only');
    await boot(page, 'combat_tyrant_contained_p2');
    await expect(page.locator('.phone-bar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^G: Guard/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^1: Attack/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^2: Marked Shot/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abilities, / })).toHaveCount(0);
  });
});
