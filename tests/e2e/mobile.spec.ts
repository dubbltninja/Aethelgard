// The phone layout end to end (U77; PLAN §8.3 `mobile.spec.ts`, D-120, D-130/D-131), mobile project only (Pixel 7, 390 × 844),
// through accessible names and `?scenario=` boots:
//   - the bottom tab bar (Explore · Journal · Pack · Map · Menu) is pinned to the bottom edge, each tab reveals its region, and
//     it leaves with the screens that have their own layout (a fight, a conversation);
//   - the phone action bar in a fight: Attack · Guard · Item · Flee, and Abilities as a sheet, pinned above nothing but the edge;
//   - at 1.5× text nothing scrolls sideways on any screen or panel a phone reaches;
//   - every control a thumb must hit — the action bar, the ability tiles, the exits, the tabs — is at least 44 CSS px square.
import { expect, test, type Locator, type Page } from 'playwright/test';
import { GameDriver } from './helpers/driver';

test.beforeEach(({}, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'the phone layout is tested on phones');
});

const MIN = 44;

interface Box {
  name: string;
  w: number;
  h: number;
}

/** Visible controls of `scope` smaller than 44 × 44, named for the failure message. */
async function small(scope: Locator, selector = 'button, [role="tab"], summary, select, input'): Promise<string[]> {
  const boxes: Box[] = await scope.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => {
        const r = (el.closest('label') ?? el).getBoundingClientRect();
        return { name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40), w: r.width, h: r.height };
      }),
  );
  expect(boxes.length, 'there are controls to measure').toBeGreaterThan(0);
  return boxes.filter((b) => b.w < MIN - 0.5 || b.h < MIN - 0.5).map((b) => `${b.name} ${Math.round(b.w)}×${Math.round(b.h)}`);
}

const noSidewaysScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const dialogFits = (page: Page): Promise<boolean> => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[role="dialog"], .modal__body')].every((el) => el.scrollWidth <= el.clientWidth + 1));

/** 150 % text through the Settings panel on the Title, the way a player sets it (it is kept in the profile for what follows). */
async function textAt150(g: GameDriver): Promise<void> {
  const { page } = g;
  await page.goto('./');
  await g.press(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: /^Settings/ }));
  await g.press(g.dialog('Settings').getByRole('radio', { name: '150%' }));
  await expect(page.locator('html')).toHaveCSS('font-size', '24px');
  await g.press(g.dialog('Settings').getByRole('button', { name: 'Close settings' }));
  await expect(g.dialog('Settings')).toHaveCount(0);
}

test.describe('the phone layout', () => {
  test('the bottom tab bar: five tabs pinned to the edge, each opening its region, gone in a fight and a conversation', async ({ page }, info) => {
    const g = new GameDriver(page, info).watch();
    await g.boot('loop1_day1', 'explore');
    const bar = g.tabBar();
    await expect(bar.getByRole('button')).toHaveText(['Explore', 'Journal', 'Pack', 'Map', 'Menu']);
    await expect(bar.getByRole('button', { name: 'Explore' })).toHaveAttribute('aria-current', 'page');
    const gap = await page.evaluate(() => Math.abs((document.querySelector('.dock')?.getBoundingClientRect().bottom ?? 0) - window.innerHeight));
    expect(gap, 'the dock sits on the bottom edge').toBeLessThanOrEqual(1);
    expect(await small(bar), 'tab bar targets').toEqual([]);

    for (const [tab, region] of [
      ['Journal', 'Quest journal'],
      ['Pack', 'Inventory'],
      ['Map', 'Map'],
      ['Menu', 'Menu'],
    ] as const) {
      await g.press(bar.getByRole('button', { name: tab }));
      await expect(g.dialog(region)).toBeVisible();
      expect(await dialogFits(page), `${region} fits the width`).toBe(true);
      await page.keyboard.press('Escape');
      await expect(g.dialog(region)).toHaveCount(0);
      await expect(bar.getByRole('button', { name: tab })).toBeFocused(); // focus returns to the tab that opened it
    }

    // a conversation takes the whole screen: the bar leaves, and comes back with the map
    await g.press(page.getByRole('button', { name: 'Talk to Ilyra' }));
    await expect(g.screen('dialogue')).toBeVisible();
    await expect(bar).toHaveCount(0);
    await g.throughScenes().catch(() => undefined);
    await g.boot('first_fight', 'combat');
    // (a fight has its own small menu under the same name: Inventory, Bestiary, Keys, Settings — no tabs)
    await expect(g.tabBar().getByRole('button', { name: 'Journal' })).toHaveCount(0);
    await expect(g.tabBar().getByRole('button', { name: 'Explore' })).toHaveCount(0);
    g.expectClean();
  });

  test('a fight from the phone action bar: Attack · Guard · Item · Flee pinned to the edge, Abilities as a sheet', async ({ page }, info) => {
    const g = new GameDriver(page, info).watch();
    await g.boot('first_fight', 'combat');
    await g.tutorialsOff();
    const bar = page.locator('#dock-slot').getByRole('group', { name: 'Turn actions' });
    await expect(bar).toBeVisible();
    for (const name of [/^1: Attack, at Corrupted Shade/, /^G: Guard/, /^I: Item/, /^F: Flee, \d+% chance/]) await expect(bar.getByRole('button', { name })).toBeVisible();
    const view = page.viewportSize();
    const edge = await page.locator('#dock-slot').evaluate((el) => el.getBoundingClientRect().bottom);
    expect(Math.abs(edge - (view?.height ?? 0))).toBeLessThanOrEqual(1);
    expect(await small(bar), 'action bar targets').toEqual([]);

    // Guard from the bar, then the fight is won with Attack alone, the page never scrolled
    await g.press(bar.getByRole('button', { name: /^G: Guard/ }));
    await expect(page.getByRole('log')).toContainText('Wayfinder guards.');
    expect(await g.fight()).toBe('victory');
    await g.continueVictory();
    expect((await g.state()).mode).toBe('explore');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // the sheet: a stronger fight has abilities; the opener names how many are ready, the sheet's tiles are thumb-sized
    await g.boot('combat_tyrant_contained_p2', 'combat');
    await g.tutorialsOff();
    const opener = page.locator('#dock-slot').getByRole('button', { name: /^Abilities, \d+ ready$/ });
    await g.press(opener);
    const sheet = g.dialog('Abilities');
    await expect(sheet).toBeVisible();
    expect(await small(sheet), 'ability tiles').toEqual([]);
    expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    g.expectClean();
  });

  test('at 1.5× text nothing scrolls sideways: the explore screen and its panels, a fight, a conversation, the Threshold', async ({ page }, info) => {
    const g = new GameDriver(page, info).watch();
    await textAt150(g);

    await g.boot('loop1_respite', 'explore');
    await expect(page.locator('html')).toHaveCSS('font-size', '24px');
    expect(await noSidewaysScroll(page), 'explore').toBe(true);
    for (const [tab, region] of [
      ['Journal', 'Quest journal'],
      ['Pack', 'Inventory'],
      ['Map', 'Map'],
      ['Menu', 'Menu'],
    ] as const) {
      await g.press(g.tabBar().getByRole('button', { name: tab }));
      await expect(g.dialog(region)).toBeVisible();
      expect(await noSidewaysScroll(page), `${region} at 150 %`).toBe(true);
      expect(await dialogFits(page), `${region} content at 150 %`).toBe(true);
      await page.keyboard.press('Escape');
      await expect(g.dialog(region)).toHaveCount(0);
    }

    await g.boot('combat_tyrant_contained_p2', 'combat');
    await g.tutorialsOff();
    expect(await noSidewaysScroll(page), 'a boss fight').toBe(true);
    expect(await small(page.locator('#dock-slot')), 'action bar at 150 %').toEqual([]);
    await g.press(page.locator('#dock-slot').getByRole('button', { name: /^Abilities, / }));
    expect(await noSidewaysScroll(page), 'the abilities sheet').toBe(true);
    expect(await small(g.dialog('Abilities')), 'ability tiles at 150 %').toEqual([]);

    await g.boot('loop1_day1', 'explore');
    await g.press(page.getByRole('button', { name: 'Talk to Ilyra' }));
    await expect(g.screen('dialogue')).toBeVisible();
    expect(await noSidewaysScroll(page), 'a conversation').toBe(true);

    await g.boot('loop2_end', 'threshold');
    expect(await noSidewaysScroll(page), 'the Threshold').toBe(true);
    g.expectClean();
  });

  test('every exit, action, ability and tab is at least 44 px: the places a thumb goes', async ({ page }, info) => {
    const g = new GameDriver(page, info).watch();
    await g.boot('loop1_respite', 'explore');
    expect(await small(g.exits()), 'exits').toEqual([]);
    expect(await small(page.getByRole('region', { name: 'What you can do' })), 'actions').toEqual([]);
    expect(await small(g.tabBar()), 'tabs').toEqual([]);
    // a place on, with its own exits and actions (a stop that is not a fight)
    await g.press(g.exits().getByRole('button').first());
    if ((await g.mode()) === 'explore') {
      expect(await small(g.exits()), 'exits elsewhere').toEqual([]);
      expect(await small(page.getByRole('region', { name: 'What you can do' })), 'actions elsewhere').toEqual([]);
    }
    g.expectClean();
  });
});
