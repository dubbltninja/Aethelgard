// The Explore screen and the map (U64; PLAN §6.3, §6.6–6.8, §8.3–8.4; DESIGN §16.2–16.7), on desktop and mobile, driven
// through accessible names: a new game on a fixed seed, two moves by keyboard (arrows focus an exit, Enter travels),
// one by tap, then the map — open it, choose a place and travel there by tapping it twice, choose the way north
// with the arrow keys and Enter, close it. Then a `?scenario=` boot (D-104 ruling 1) at the last night of Loop 1 and
// the Horde's map; then the in-repo a11y checks for the screen.
//
// The seed `explore` is fixed so the route meets no fight: Ruins → Sunken Archives → Ruins → Mistwood Path → the
// Wayfarer's Respite → Mistwood Path → (map) is checked against the real pack's encounter rolls.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface GameWindow {
  __aethelgard: { state: { mode: string; clock: { ticks: number; limitTicks: number; expired: boolean }; world: { currentLocationId: string; hordeActive: boolean } } };
}

async function gameState(page: Page): Promise<GameWindow['__aethelgard']['state']> {
  return page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state);
}

/**
 * U62b: Continue through a scene the engine opened (STORY §13: the thirtieth dawn's `scene_clock_expiry`, Loop 2's waking at the
 * Ruins) back to the place.
 */
async function throughScene(page: Page): Promise<void> {
  const mode = (): Promise<string> => page.evaluate(() => (window as unknown as { __aethelgard: { state: { mode: string } } }).__aethelgard.state.mode);
  for (let i = 0; i < 12 && (await mode()) === 'dialogue'; i++) await page.getByRole('button', { name: /^(Continue|End the conversation)/ }).first().click();
  await expect.poll(mode).toBe('explore');
}

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');

/** A tap on touch devices, a click elsewhere. */
async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
}

async function newGame(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByText('Seed (optional)').click();
  await page.getByRole('textbox', { name: 'Seed' }).fill('explore');
  await page.getByRole('button', { name: /^Begin as / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();
}

const place = (page: Page, name: string): Locator => page.getByRole('heading', { level: 1, name });
const exits = (page: Page): Locator => page.getByRole('navigation', { name: 'Ways on' });

/** Visible controls smaller than 44 × 44 CSS px (PLAN §6.7) in the screen and its dialogs. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main button, main summary, main [tabindex="0"], [role="dialog"] button, [role="dialog"] summary')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ el, box }) => `${el.outerHTML.slice(0, 70)} ${Math.round(box.width)}×${Math.round(box.height)}`),
  );
}

/** Every focusable control has a non-empty accessible name. */
async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const textOf = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const nameOf = (el: HTMLElement): string => {
      const label = el.getAttribute('aria-label');
      if (label) return label.trim();
      const by = el.getAttribute('aria-labelledby');
      if (by) return by.split(/\s+/).map((id) => textOf(document.getElementById(id))).join(' ').trim();
      return textOf(el);
    };
    const controls = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')];
    return controls.filter((el) => el.getClientRects().length > 0 && nameOf(el) === '').map((el) => el.outerHTML.slice(0, 80));
  });
}

async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test.describe('explore', () => {
  test('move by keyboard and by tap, then open and use the map', async ({ page }, info) => {
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
    });
    page.on('pageerror', (e) => problems.push(e.message));
    await newGame(page);
    await expect(page).toHaveTitle('Whispering Ruins · Echoes of Aethelgard');
    const clock = page.getByTestId('clock-chip');
    await expect(clock).toContainText('Day 1 · Dawn');
    await expect(page.getByRole('meter', { name: 'HP' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Whispering Ruins' })).toBeVisible();

    // keyboard: ↓ chooses the way south, Enter travels; ↑ and Enter come back
    await page.keyboard.press('ArrowDown');
    await expect(exits(page).getByRole('button', { name: /^South: Sunken Archives, (Dangerous \(L\d+\+\), )?1 watch/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(place(page, 'Sunken Archives')).toBeVisible();
    await expect(place(page, 'Sunken Archives')).toBeFocused(); // the new place's heading takes focus
    await expect(clock).toContainText('Day 1 · Day');
    await page.keyboard.press('ArrowUp');
    await expect(exits(page).getByRole('button', { name: /^North: Whispering Ruins/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(place(page, 'Whispering Ruins')).toBeVisible();
    await expect(clock).toContainText('Day 1 · Dusk');

    // tap (click on desktop): east to Mistwood Path
    await press(exits(page).getByRole('button', { name: /^East: Mistwood Path/ }), info);
    await expect(place(page, 'Mistwood Path')).toBeVisible();
    expect((await gameState(page)).world.currentLocationId).toBe('loc_mistwood_path');
    const live = page.getByTestId('live-region');
    await expect(live).toContainText('Mistwood Path. Day 1, night.');

    // the map: M on desktop, the Map button on touch
    if (mobile(info)) await press(page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Map' }), info);
    else await page.keyboard.press('m');
    const map = page.getByRole('dialog', { name: 'Map' });
    await expect(map).toBeVisible();
    const here = map.getByRole('button', { name: /^Mistwood Path, you are here/ });
    await expect(here).toBeFocused();
    await expect(here).toHaveAttribute('aria-current', 'location');
    await expect(map.getByRole('button', { name: /^Whispering Ruins, visited, west/ })).toBeVisible();
    await expect(map.getByRole('button', { name: /^Sunken Archives, visited/ })).toBeVisible();

    // choose the unexplored place south — the preview tells the cost — and tap it again to go
    const south = map.getByRole('button', { name: /^Unknown place, unexplored, south/ });
    await press(south, info);
    await expect(map.getByText(/1 watch · Night → Day 2 · Dawn/)).toBeVisible();
    await expect(map.getByRole('button', { name: 'Go to An unknown place' })).toBeVisible();
    await press(map.getByRole('button', { name: /^Unknown place, unexplored, south/ }), info);
    await expect.poll(async () => (await gameState(page)).world.currentLocationId).toBe('loc_wayfarers_respite');
    await expect(map.getByRole('button', { name: /^The Wayfarer's Respite, you are here/ })).toBeVisible();
    await expect(place(page, "The Wayfarer's Respite")).toBeAttached();

    // keyboard on the map: ↑ chooses the way north (and focuses it), Enter travels
    await map.getByRole('button', { name: /^The Wayfarer's Respite, you are here/ }).focus();
    await page.keyboard.press('ArrowUp');
    const north = map.getByRole('button', { name: /^Mistwood Path, visited, north/ });
    await expect(north).toBeFocused();
    await expect(map.getByText('Go to Mistwood Path')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await gameState(page)).world.currentLocationId).toBe('loc_mistwood_path');

    // Esc closes it and focus goes back where it was
    await page.keyboard.press('Escape');
    await expect(map).toBeHidden();
    await expect(place(page, 'Mistwood Path')).toBeVisible();
    expect((await gameState(page)).mode).toBe('explore');
    expect(problems).toEqual([]);
  });

  test('?scenario= boots the last night of Loop 1; resting into the limit starts the Horde, and the map shows it', async ({ page }) => {
    await page.goto('./?scenario=expiry_minus_1');
    await expect(place(page, 'Whispering Ruins')).toBeVisible();
    const clock = page.getByTestId('clock-chip');
    await expect(clock).toContainText('Day 29 · Night');
    const before = await gameState(page);
    expect(before.clock.ticks).toBe(before.clock.limitTicks - 1);

    await page.getByRole('button', { name: /^\d: Short rest/ }).click();
    await expect.poll(async () => (await gameState(page)).world.hordeActive).toBe(true);
    await throughScene(page); // the thirtieth dawn (STORY §13 `scene_clock_expiry`)
    await expect(clock).toContainText('Day 30 · Dawn');
    await expect(page.getByRole('button', { name: /Short rest/ })).toHaveCount(0); // no rest while the Horde runs

    await page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Map' }).click();
    const map = page.getByRole('dialog', { name: 'Map' });
    await expect(map.getByRole('button', { name: /^The Temporal Breach Apex, unexplored, infected/ })).toBeVisible();
    await expect(map.getByRole('button', { name: /^Shattered Library, unexplored, the way out/ })).toBeVisible();
  });

  test('a11y: names, roles, 44 px targets, no sideways scroll at 150 %, a visible focus ring', async ({ page }, info) => {
    await newGame(page);
    expect(await unnamedControls(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);
    await expect(page.getByRole('meter')).toHaveCount(3); // XP, HP, the class resource
    await expect(page.getByRole('log')).toBeAttached();

    // the map's controls too
    await page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Map' }).click();
    const map = page.getByRole('dialog', { name: 'Map' });
    await expect(map).toBeVisible();
    expect(await unnamedControls(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    await page.keyboard.press('Escape');

    // 150 % text: nothing scrolls sideways
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '150%';
    });
    expect(await noHorizontalScroll(page)).toBe(true);

    if (!mobile(info)) {
      await page.keyboard.press('ArrowDown');
      const focused = await page.evaluate(() => parseFloat(getComputedStyle(document.activeElement as HTMLElement).outlineWidth));
      expect(focused).toBeGreaterThanOrEqual(2);
    }
  });

  test('reduced motion: the scene and the map hold still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await newGame(page);
    await page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Map' }).click();
    await expect(page.getByRole('dialog', { name: 'Map' })).toBeVisible();
    const long = await page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => Number(a.effect?.getComputedTiming().duration ?? 0))
        .filter((d) => d > 150),
    );
    expect(long).toEqual([]);
  });
});
