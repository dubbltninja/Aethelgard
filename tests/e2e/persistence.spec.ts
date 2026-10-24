// Saves, Settings, persistence and the tab bar (U69; DESIGN §14, §16.1, §16.3, §16.7; PLAN §6.8, RISKS #3), on desktop and
// mobile, through accessible names: save to a slot, reload the page, Continue and Load restore it; export a slot and
// import the file into another; a corrupted slot shows as damaged and restores from its backup; refused imports say why;
// settings survive a reload (and a profile that cannot be read keeps them); the tab bar's five tabs; and, at 150 % text on the
// phone viewport, no sideways scroll on Title, Explore, Combat, the Threshold and the panels.
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface GameState {
  mode: string;
  clock: { ticks: number };
  world: { currentLocationId: string };
}
interface GameWindow {
  __aethelgard: { state: GameState; store: { shell: { updateSettings(patch: object): void } } };
}

const gameState = (page: Page): Promise<GameState> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state);
const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');

/** A tap on touch devices, a click elsewhere. */
async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
}

const tabBar = (page: Page): Locator => page.getByRole('navigation', { name: 'Game menu' });
const dialog = (page: Page, name: string): Locator => page.getByRole('dialog', { name });
const slotCard = (page: Page, slot: string): Locator => dialog(page, 'Saves').locator(`li.slot[data-slot="${slot}"]`);

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

async function newGame(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByText('Seed (optional)').click();
  await page.getByRole('textbox', { name: 'Seed' }).fill('persist');
  await page.getByRole('button', { name: /^Begin as / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();
}

/** Menu tab → one of its rows (Saves, Settings, Return to title, …). */
async function fromMenu(page: Page, row: RegExp, info: TestInfo): Promise<void> {
  await press(tabBar(page).getByRole('button', { name: 'Menu' }), info);
  await press(dialog(page, 'Menu').getByRole('button', { name: row }), info);
}

async function openSavesInGame(page: Page, info: TestInfo): Promise<void> {
  await fromMenu(page, /^Saves/, info);
  await expect(dialog(page, 'Saves')).toBeVisible();
}

async function openFromTitle(page: Page, item: RegExp, panel: string, info: TestInfo): Promise<void> {
  await press(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: item }), info);
  await expect(dialog(page, panel)).toBeVisible();
}

async function close(page: Page, panel: string, info: TestInfo): Promise<void> {
  await press(dialog(page, panel).getByRole('button', { name: `Close ${panel.toLowerCase()}` }), info);
  await expect(dialog(page, panel)).toHaveCount(0);
}

const shortRest = (page: Page): Locator => page.getByRole('button', { name: /^\d: Short rest/ });

/** Empty when the page does not scroll sideways; else the elements sticking out past the right edge (for the failure message). */
async function sidewaysOffenders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width) return [];
    const out = [`scrollWidth ${document.documentElement.scrollWidth} > ${width}`];
    const sticking = [...document.querySelectorAll<HTMLElement>('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > width + 1;
    });
    // the innermost ones name the cause; their ancestors only inherit the width
    for (const el of sticking.filter((e) => !sticking.some((o) => o !== e && e.contains(o)))) {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)} text="${(el.textContent ?? '').trim().slice(0, 30)}"`);
    }
    return out.slice(0, 8);
  });
}

/** A dialog's own content does not scroll sideways either. */
async function dialogFits(page: Page): Promise<boolean> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[role="dialog"], .modal__body')].every((el) => el.scrollWidth <= el.clientWidth + 1));
}

const stored = (page: Page, key: string): Promise<string | null> => page.evaluate((k) => localStorage.getItem(k), key);

test.describe('saves', () => {
  test('@smoke save to a slot, reload the page, then Continue and Load bring the game back', async ({ page }, info) => {
    const problems = watch(page);
    await newGame(page);
    await press(shortRest(page), info);
    const saved = (await gameState(page)).clock.ticks;
    expect(saved).toBeGreaterThan(0);

    await openSavesInGame(page, info);
    await expect(slotCard(page, '1')).toContainText('Empty');
    await press(slotCard(page, '1').getByRole('button', { name: 'Save to slot 1' }), info);
    await expect(slotCard(page, '1')).toHaveAttribute('data-status', 'ok');
    await expect(slotCard(page, '1')).toContainText(/Loop 1 · Day 1 · Whispering Ruins/);
    await expect(slotCard(page, '1')).toContainText(/level 1/);
    await close(page, 'Saves', info);

    await press(shortRest(page), info); // the world moves on after the save
    expect((await gameState(page)).clock.ticks).toBeGreaterThan(saved);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Echoes of Aethelgard: The Unraveling' })).toBeVisible();
    const resume = page.getByRole('button', { name: /^Continue/ });
    await expect(resume).toBeEnabled();
    await press(resume, info);
    await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();
    expect((await gameState(page)).mode).toBe('explore');

    // back to the title, and Load the manual slot: it is exactly the saved moment
    await fromMenu(page, /^Return to title/, info);
    await openFromTitle(page, /^Load/, 'Saves', info);
    await press(slotCard(page, '1').getByRole('button', { name: 'Load slot 1' }), info);
    await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();
    expect((await gameState(page)).clock.ticks).toBe(saved);
    expect(problems).toEqual([]);
  });

  test('saving over a slot asks first, in the page and not in a browser dialog', async ({ page }, info) => {
    let browserDialogs = 0;
    page.on('dialog', (d) => {
      browserDialogs += 1;
      void d.dismiss();
    });
    await newGame(page);
    await openSavesInGame(page, info);
    await press(slotCard(page, '2').getByRole('button', { name: 'Save to slot 2' }), info);
    await expect(slotCard(page, '2')).toHaveAttribute('data-status', 'ok');
    await press(slotCard(page, '2').getByRole('button', { name: 'Save to slot 2' }), info);
    const ask = page.getByRole('alertdialog');
    await expect(ask).toContainText('Slot 2 holds');
    await press(ask.getByRole('button', { name: 'Cancel' }), info);
    await press(slotCard(page, '2').getByRole('button', { name: 'Delete slot 2' }), info);
    await expect(page.getByRole('alertdialog')).toContainText('Delete slot 2? This cannot be undone.');
    await press(page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }), info);
    await expect(slotCard(page, '2')).toHaveAttribute('data-status', 'empty');
    expect(browserDialogs).toBe(0);
  });

  test('export a slot as a file, import it into another slot; bad files are refused with a reason', async ({ page }, info) => {
    await newGame(page);
    await openSavesInGame(page, info);
    await press(slotCard(page, '1').getByRole('button', { name: 'Save to slot 1' }), info);
    await expect(slotCard(page, '1')).toHaveAttribute('data-status', 'ok');

    const [download] = await Promise.all([page.waitForEvent('download'), press(slotCard(page, '1').getByRole('button', { name: 'Export of slot 1' }), info)]);
    expect(download.suggestedFilename()).toMatch(/^aethelgard-run-slot1-\d{8}-\d{4}\.json$/);
    const text = await readFile(await download.path(), 'utf8');
    expect(JSON.parse(text)).toMatchObject({ kind: 'run', version: 1 });
    expect(text).toContain('\n  '); // pretty-printed

    const picker = dialog(page, 'Saves').locator('input[type="file"]');
    await picker.setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(text) });
    const preview = dialog(page, 'Saves').getByRole('group', { name: /^Preview of aethelgard-run-slot1-/ });
    await expect(preview).toContainText('Loop 1 · Day 1 · Whispering Ruins');
    await expect(preview.getByRole('radio', { name: 'Slot 2' })).toBeChecked(); // the first empty slot
    await press(preview.getByRole('radio', { name: 'Slot 3' }), info);
    await press(preview.getByRole('button', { name: 'Import into slot 3' }), info);
    await expect(slotCard(page, '3')).toHaveAttribute('data-status', 'ok');
    await expect(slotCard(page, '3')).toContainText('Loop 1 · Day 1 · Whispering Ruins');
    expect(JSON.parse((await stored(page, 'aethelgard.run.slot3')) ?? 'null')).toEqual(JSON.parse((await stored(page, 'aethelgard.run.slot1')) ?? 'null'));
    expect((await gameState(page)).mode).toBe('explore'); // importing never touches the running game

    // refusals
    const refused = dialog(page, 'Saves').getByRole('alert');
    await picker.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"kind":"run"') });
    await expect(refused).toContainText('bad.json was not imported. Save file is not valid JSON');
    const future = { ...(JSON.parse(text) as object), version: 99 };
    await picker.setInputFiles({ name: 'future.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(future)) });
    await expect(refused).toContainText('written by a newer version of the game');
    await picker.setInputFiles({ name: 'profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ kind: 'profile', version: 1 })) });
    await expect(refused).toContainText('profile.json was not imported');
    await expect(slotCard(page, '2')).toHaveAttribute('data-status', 'empty');
  });

  test('a corrupted slot shows as damaged, exports its raw text, and restores from its backup', async ({ page }, info) => {
    await newGame(page);
    await openSavesInGame(page, info);
    const save = slotCard(page, '1').getByRole('button', { name: 'Save to slot 1' });
    await press(save, info);
    await expect(slotCard(page, '1')).toHaveAttribute('data-status', 'ok');
    await press(save, info);
    await press(page.getByRole('alertdialog').getByRole('button', { name: 'Save over it' }), info); // the second write keeps the first as .bak
    await expect.poll(() => stored(page, 'aethelgard.run.slot1.bak')).not.toBeNull();
    const backup = await stored(page, 'aethelgard.run.slot1.bak');
    await page.evaluate(() => localStorage.setItem('aethelgard.run.slot1', '{"kind":"run","version":1,"sta'));

    await page.reload();
    await openFromTitle(page, /^Load/, 'Saves', info);
    await expect(slotCard(page, '1')).toHaveAttribute('data-status', 'corrupted');
    await expect(slotCard(page, '1')).toContainText('Damaged');
    await expect(slotCard(page, '1').getByRole('button', { name: 'Load slot 1' })).toHaveCount(0);

    const [raw] = await Promise.all([page.waitForEvent('download'), press(slotCard(page, '1').getByRole('button', { name: 'Export raw text of slot 1' }), info)]);
    expect(raw.suggestedFilename()).toBe('aethelgard-run-slot1-unknown-time.json');
    expect(await readFile(await raw.path(), 'utf8')).toBe('{"kind":"run","version":1,"sta');

    await press(slotCard(page, '1').getByRole('button', { name: 'Restore the backup of slot 1' }), info);
    await expect(slotCard(page, '1')).toHaveAttribute('data-status', 'ok');
    expect(await stored(page, 'aethelgard.run.slot1')).toBe(backup);
    await press(slotCard(page, '1').getByRole('button', { name: 'Load slot 1' }), info);
    await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();
  });

  test('a page closed in the middle of a write leaves nothing behind', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() => localStorage.setItem('aethelgard.run.slot2.tmp', '{"kind":"run","vers'));
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Echoes of Aethelgard: The Unraveling' })).toBeVisible();
    expect(await stored(page, 'aethelgard.run.slot2.tmp')).toBeNull();
    expect(await stored(page, 'aethelgard.run.slot2')).toBeNull();
    await expect(page.getByRole('button', { name: /^Continue/ })).toBeEnabled();
  });
});

test.describe('settings', () => {
  test('survive a reload, reach the page, and a profile that cannot be read keeps them', async ({ page }, info) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    await page.goto('./');
    await openFromTitle(page, /^Settings/, 'Settings', info);
    const settings = dialog(page, 'Settings');
    await press(settings.getByRole('radio', { name: '150%' }), info);
    await press(settings.getByRole('checkbox', { name: 'High contrast' }), info);
    await press(settings.getByRole('checkbox', { name: 'Mute all sound' }), info);
    await press(settings.getByRole('checkbox', { name: 'Ask before fleeing a fight' }), info);
    await press(settings.getByRole('radio', { name: '50 lines' }), info);
    await settings.getByRole('slider', { name: 'Master volume' }).fill('35');
    await expect(settings.getByText('35%')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
    await expect(page.locator('html')).toHaveCSS('font-size', '24px');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
    await expect(page.locator('html')).toHaveCSS('font-size', '24px');
    await openFromTitle(page, /^Settings/, 'Settings', info);
    await expect(dialog(page, 'Settings').getByRole('radio', { name: '150%' })).toBeChecked();
    await expect(dialog(page, 'Settings').getByRole('checkbox', { name: 'Mute all sound' })).toBeChecked();
    await expect(dialog(page, 'Settings').getByRole('checkbox', { name: 'Ask before fleeing a fight' })).not.toBeChecked();
    await expect(dialog(page, 'Settings').getByRole('radio', { name: '50 lines' })).toBeChecked();
    await expect(dialog(page, 'Settings').getByRole('slider', { name: 'Master volume' })).toHaveValue('35');

    // a profile that cannot be read: a fresh one starts, with the same settings (the mirror)
    await page.evaluate(() => {
      localStorage.setItem('aethelgard.profile', '{"kind":"profile","vers');
      localStorage.removeItem('aethelgard.profile.bak');
    });
    await page.reload();
    await expect(page.getByText(/could not be read, so a new one was started/)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
    await expect(page.locator('html')).toHaveCSS('font-size', '24px');
    expect(problems).toEqual([]);
  });

  test('export the profile, then merge it back and replace with it; delete asks twice', async ({ page }, info) => {
    await page.goto('./');
    await openFromTitle(page, /^Settings/, 'Settings', info);
    const settings = dialog(page, 'Settings');
    const [download] = await Promise.all([page.waitForEvent('download'), press(settings.getByRole('button', { name: 'Export profile' }), info)]);
    expect(download.suggestedFilename()).toMatch(/^aethelgard-profile-\d{8}-\d{4}\.json$/);
    const path = await download.path();
    expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ kind: 'profile', version: 1 });

    const file = { name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(await readFile(path, 'utf8')) };
    await settings.locator('input[type="file"]').setInputFiles(file);
    const preview = settings.getByRole('group', { name: /^Preview of aethelgard-profile-/ });
    await expect(preview).toContainText('Loop 1');
    await expect(preview.getByRole('radio', { name: 'Merge with this profile' })).toBeChecked();
    await press(preview.getByRole('button', { name: 'Merge profile' }), info);
    await expect(page.getByText('Profile merged.')).toBeVisible();

    await settings.locator('input[type="file"]').setInputFiles(file);
    await press(settings.getByRole('radio', { name: 'Replace this profile' }), info);
    await press(settings.getByRole('button', { name: 'Replace profile' }), info);
    await expect(page.getByRole('alertdialog')).toContainText('Replace this profile with the file?');
    await press(page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }), info);
    await expect(page.getByText('Profile replaced.')).toBeVisible();

    const before = await stored(page, 'aethelgard.profile');
    await press(settings.getByRole('button', { name: 'Delete profile' }), info);
    await expect(page.getByRole('alertdialog')).toContainText('Delete your profile?');
    const [copy] = await Promise.all([page.waitForEvent('download'), press(page.getByRole('alertdialog').getByRole('button', { name: 'Export and continue' }), info)]);
    expect(copy.suggestedFilename()).toMatch(/^aethelgard-profile-/);
    await expect(page.getByRole('alertdialog')).toContainText(`A copy was saved as ${copy.suggestedFilename()}`);
    await press(page.getByRole('alertdialog').getByRole('button', { name: 'Keep my profile' }), info);
    expect(await stored(page, 'aethelgard.profile')).toBe(before); // saying no the second time keeps it
  });
});

test.describe('the tab bar', () => {
  test('five tabs, each opening its region; targets are 44 px; the bar clears the safe area', async ({ page }, info) => {
    await newGame(page);
    const bar = tabBar(page);
    await expect(bar.getByRole('button')).toHaveText(['Explore', 'Journal', 'Pack', 'Map', 'Menu']);
    await expect(bar.getByRole('button', { name: 'Explore' })).toHaveAttribute('aria-current', 'page');

    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.tab-bar button')].map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length,
    );
    expect(small).toBe(0);
    // the dock (tab bar, then the key legend where there is one) is stuck to the bottom of the viewport
    const dockGap = await page.evaluate(() => Math.abs((document.querySelector('.dock')?.getBoundingClientRect().bottom ?? 0) - window.innerHeight));
    expect(dockGap).toBeLessThanOrEqual(1);

    for (const [tab, panel] of [
      ['Journal', 'Quest journal'],
      ['Pack', 'Inventory'],
      ['Map', 'Map'],
      ['Menu', 'Menu'],
    ] as const) {
      await press(bar.getByRole('button', { name: tab }), info);
      await expect(dialog(page, panel)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog(page, panel)).toHaveCount(0);
    }
    // the Menu holds the rest, and a row replaces the Menu with its panel
    await fromMenu(page, /^Codex/, info);
    await expect(dialog(page, 'Codex')).toBeVisible();
    await expect(dialog(page, 'Menu')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await fromMenu(page, /^Settings/, info);
    await expect(dialog(page, 'Settings')).toBeVisible();
    await page.keyboard.press('Escape');
    await fromMenu(page, /^Return to title/, info);
    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
    await expect(bar).toHaveCount(0); // combat, dialogue and the title take over the screen
  });
});

test.describe('layout at 150 % text', () => {
  test('no sideways scroll on the title, explore, combat, the threshold, and the Saves, Settings and Menu panels', async ({ page }, info) => {
    await page.goto('./');
    await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.store.shell.updateSettings({ textScale: 1.5 }));
    await expect(page.locator('html')).toHaveCSS('font-size', '24px');
    await expect(page.getByRole('heading', { level: 1, name: 'Echoes of Aethelgard: The Unraveling' })).toBeVisible();
    expect(await sidewaysOffenders(page), 'title').toEqual([]);

    await openFromTitle(page, /^Settings/, 'Settings', info);
    expect(await sidewaysOffenders(page), 'Settings panel at the title').toEqual([]);
    expect(await dialogFits(page), 'Settings panel content at the title').toBe(true);
    await close(page, 'Settings', info);

    const screens: [string, string, string][] = [
      ['explore', 'loop1_respite', 'explore'],
      ['combat', 'first_fight', 'combat'],
      ['threshold', 'loop2_end', 'threshold'],
    ];
    for (const [label, scenario, screen] of screens) {
      await page.goto(`./?scenario=${scenario}`);
      await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.store.shell.updateSettings({ textScale: 1.5 }));
      await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
      await expect(page.locator('html')).toHaveCSS('font-size', '24px');
      expect(await sidewaysOffenders(page), label).toEqual([]);
    }

    // two panels over the explore screen, and the tab bar itself, at 150 %
    await page.goto('./?scenario=loop1_respite');
    await expect(page.locator('[data-screen="explore"]')).toBeVisible();
    await expect(page.locator('html')).toHaveCSS('font-size', '24px');
    expect(await sidewaysOffenders(page), 'explore with the tab bar').toEqual([]);
    const labelsFit = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.tab-bar__tab')].every((b) => b.scrollWidth <= b.clientWidth + 1));
    expect(labelsFit, 'tab labels fit their cells').toBe(true);
    await openSavesInGame(page, info);
    expect(await sidewaysOffenders(page), 'Saves panel').toEqual([]);
    expect(await dialogFits(page), 'Saves panel content').toBe(true);
    await close(page, 'Saves', info);
    await fromMenu(page, /^Settings/, info);
    await expect(dialog(page, 'Settings')).toBeVisible();
    expect(await sidewaysOffenders(page), 'Settings panel').toEqual([]);
    expect(await dialogFits(page), 'Settings panel content').toBe(true);
    await close(page, 'Settings', info);
    await press(tabBar(page).getByRole('button', { name: 'Menu' }), info);
    expect(await sidewaysOffenders(page), 'Menu panel').toEqual([]);
    expect(await dialogFits(page), 'Menu panel content').toBe(true);
  });
});
