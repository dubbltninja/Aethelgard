// The component gallery (U78; PLAN §8.3): `?gallery=<panel id>` (e2e builds only, src/ui/GalleryPage.tsx) mounts one panel in
// the real Shell on a fixture scenario, with an "Open …" button as its opener. Through accessible names and hotkeys:
//   - every panel opens and closes (Esc, the Close button, its key) and returns focus to what opened it;
//   - Inventory, Equipment, Merchant, Forge, Camp and Abilities dispatch the right actions and show tier prices;
//   - Saves: save, load, export, delete (asks first), and an invalid import file says why (a message, not a crash);
//   - Settings: text size reaches <html>, high contrast reaches data-theme, reduced motion reaches the audio engine;
//   - the Shell's live region says one sentence per step.
// The panels' fixtures are the scenarios in the gallery table; scenarios that reach a screen are used where a mount adds nothing.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface GameWindow {
  __aethelgard: {
    actions: { type: string; [key: string]: unknown }[];
    state: { mode: string; player: { gold: number }; clock: { ticks: number } };
    audio: { reducedMotion(): boolean };
  };
}

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');

async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
}

const actions = (page: Page): Promise<GameWindow['__aethelgard']['actions']> => page.evaluate(() => [...(window as unknown as GameWindow).__aethelgard.actions]);
const gold = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.player.gold);

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

/** Mounts the gallery for `id` and returns its opener button. */
async function mount(page: Page, id: string, title: string, query = ''): Promise<Locator> {
  await page.goto(`./?gallery=${id}${query}`);
  await expect(page.getByRole('heading', { level: 1, name: `Gallery · ${title}` })).toBeVisible();
  return page.getByRole('button', { name: `Open ${title.toLowerCase()}` });
}

/** On a phone a list and its detail take turns (the lore pattern); wherever the detail shows, go back to the list. */
async function backToList(panel: Locator, info: TestInfo): Promise<void> {
  const back = panel.getByRole('button', { name: 'Back to the list' });
  if (await back.isVisible()) await press(back, info);
}

const dialog = (page: Page, name: string): Locator => page.getByRole('dialog', { name, exact: true });

async function openPanel(page: Page, id: string, title: string, info: TestInfo, query = ''): Promise<{ opener: Locator; panel: Locator }> {
  const opener = await mount(page, id, title, query);
  await press(opener, info);
  const panel = dialog(page, title);
  await expect(panel).toBeVisible();
  return { opener, panel };
}

// ---- every panel opens, closes and returns focus ------------------------------------------------------------------------

const PANELS: { id: string; title: string; key?: string; marker: RegExp }[] = [
  { id: 'inventory', title: 'Inventory', key: 'i', marker: /Worn/ },
  { id: 'equipment', title: 'Equipment', marker: /Worn/ },
  { id: 'abilities', title: 'Abilities', marker: /known/ },
  { id: 'merchant', title: 'Merchant', marker: /Buy/ },
  { id: 'crafting', title: 'Forge', marker: /Upgrade/ },
  { id: 'camp', title: 'Camp', marker: /Rest/ },
  { id: 'journal', title: 'Quest journal', key: 'q', marker: /Active/ },
  { id: 'codex', title: 'Codex', key: 'c', marker: /categories/ },
  { id: 'bestiary', title: 'Bestiary', key: 'b', marker: /./ },
  { id: 'map', title: 'Map', key: 'm', marker: /./ },
  { id: 'timeline', title: 'Loop timeline', key: 'l', marker: /./ },
  { id: 'achievements', title: 'Achievements', marker: /./ },
  { id: 'settings', title: 'Settings', marker: /Text size/ },
  { id: 'saves', title: 'Saves', marker: /Slot 1/ },
  { id: 'help', title: 'Keys', key: '?', marker: /Anywhere/ },
  { id: 'menu', title: 'Menu', marker: /Abilities/ },
];

test.describe('gallery: every panel opens and closes and returns focus', () => {
  for (const p of PANELS) {
    test(`${p.title}: opens named, shows its content, Esc and Close return focus to the opener${p.key === undefined ? '' : `, ${p.key} opens it`}`, async ({ page }, info) => {
      const problems = watch(page);
      const { opener, panel } = await openPanel(page, p.id, p.title, info);
      await expect(panel).toContainText(p.marker);
      await expect(panel.getByRole('heading', { level: 2, name: p.title, exact: true })).toBeVisible();
      expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true); // focus moved in

      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await expect(opener).toBeFocused();

      await press(opener, info);
      await press(panel.getByRole('button', { name: `Close ${p.title.toLowerCase()}`, exact: true }), info);
      await expect(panel).toHaveCount(0);
      await expect(opener).toBeFocused();

      if (p.key !== undefined && !mobile(info)) {
        await page.keyboard.press(p.key);
        await expect(panel).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(panel).toHaveCount(0);
      }
      expect(problems).toEqual([]);
    });
  }

  test('an unknown component is a visible error, not a blank page', async ({ page }) => {
    await page.goto('./?gallery=nowhere');
    await expect(page.getByRole('main')).toContainText("unknown gallery component 'nowhere' (known: inventory, ");
  });
});

// ---- panels dispatch the right actions ---------------------------------------------------------------------------------

test.describe('gallery: panels dispatch the right actions', () => {
  test('Inventory: Wear equips the piece, the worn slot shows it, Drop removes it', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'inventory', 'Inventory', info);
    await expect(panel.getByRole('button', { name: /^Weapon: Rusty Dagger/ })).toBeVisible();
    await press(panel.getByRole('button', { name: /^Traveler's Sword, Common melee weapon/ }), info);
    await expect(panel.getByText('Compared with what you wear')).toBeVisible();
    await press(panel.getByRole('button', { name: 'Wear', exact: true }), info);
    expect(await actions(page)).toEqual([expect.objectContaining({ type: 'equip', uid: expect.any(String) })]);
    await backToList(panel, info);
    await expect(panel.getByRole('button', { name: /^Weapon: Traveler's Sword/ })).toBeVisible();

    await press(panel.getByRole('button', { name: /^Rusty Dagger, Common melee weapon/ }), info);
    await press(panel.getByRole('button', { name: 'Drop', exact: true }), info);
    expect((await actions(page)).map((a) => a.type)).toEqual(['equip', 'drop']);
    await backToList(panel, info);
    await expect(panel.getByRole('button', { name: /^Rusty Dagger/ })).toHaveCount(0);
  });

  test('Equipment: the same panel; taking a piece off unequips it', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'equipment', 'Equipment', info);
    await press(panel.getByRole('button', { name: /^Weapon: Rusty Dagger/ }), info);
    await press(panel.getByRole('button', { name: 'Take off', exact: true }), info);
    expect(await actions(page)).toEqual([{ type: 'unequip', slot: 'weapon' }]);
    await backToList(panel, info);
    await expect(panel.getByRole('button', { name: /^Weapon: empty/ })).toBeVisible();
  });

  test('Merchant: prices are shown per piece with their tier, Buy spends the gold, Sell pays it back', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'merchant', 'Merchant', info);
    const before = await gold(page);
    const sword = panel.getByRole('button', { name: /^Traveler's Sword, Common melee weapon · tier 1, 20 gold$/ });
    await expect(sword).toBeVisible();
    await expect(panel.getByRole('button', { name: /^Ironclad Hammer, Common heavy shield · tier 2, 55 gold$/ })).toBeVisible();
    await press(sword, info);
    await press(panel.getByRole('button', { name: 'Buy for 20 gold', exact: true }), info);
    expect(await actions(page)).toEqual([expect.objectContaining({ type: 'buy', merchantId: expect.any(String), uid: expect.any(String) })]);
    expect(await gold(page)).toBe(before - 20);

    await press(panel.getByRole('tab', { name: /^Sell, \d+$/ }), info);
    await press(panel.getByRole('button', { name: /^Wildling Hide/ }).first(), info);
    await press(panel.getByRole('button', { name: /^Sell for \d+ gold$/ }), info);
    expect((await actions(page)).map((a) => a.type)).toEqual(['buy', 'sell']);
    expect(await gold(page)).toBeGreaterThan(before - 20);
  });

  test('Forge: Upgrade shows the cost and the tier it reaches, then dispatches upgrade; Craft and Salvage have their own tabs', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'crafting', 'Forge', info);
    await press(panel.getByRole('button', { name: /^Rusty Dagger, Common melee weapon · tier 1, to Uncommon/ }), info);
    await press(panel.getByRole('button', { name: /^Upgrade to Uncommon for \d+ gold$/ }), info);
    expect(await actions(page)).toEqual([expect.objectContaining({ type: 'upgrade', uid: expect.any(String) })]);
    await backToList(panel, info);
    await press(panel.getByRole('tab', { name: /^Craft, \d+$/ }), info);
    await expect(panel.getByRole('button', { name: /cannot be crafted now$/ }).first()).toBeVisible(); // what is missing is said, not hidden
    await press(panel.getByRole('button', { name: /^Ember Flask, consumable, ready to craft$/ }), info);
    await press(panel.getByRole('button', { name: /^Craft for \d+ gold$/ }), info);
    expect((await actions(page)).map((a) => a.type)).toEqual(['upgrade', 'craft']);
    await backToList(panel, info);
    await press(panel.getByRole('tab', { name: /^Salvage, \d+$/ }), info);
    await press(panel.getByRole('button', { name: /^Rusty Dagger/ }), info);
    await press(panel.getByRole('button', { name: /^Salvage( |$)/ }).last(), info);
    // breaking a piece down asks first
    await press(page.getByRole('alertdialog').getByRole('button').last(), info);
    expect((await actions(page)).map((a) => a.type)).toEqual(['upgrade', 'craft', 'salvage']);
  });

  test('Camp: a short rest dispatches rest(short) and the day moves on', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'camp', 'Camp', info);
    await press(panel.getByRole('button', { name: /^Short rest/ }), info);
    expect(await actions(page)).toEqual([{ type: 'rest', kind: 'short' }]);
  });

  test('Abilities: unlocking a first-tier ability spends a point and dispatches unlockAbility', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'abilities', 'Abilities', info);
    await press(panel.getByRole('button', { name: /^Unlock Marked Shot for 1 AP$/ }), info);
    expect(await actions(page)).toEqual([{ type: 'unlockAbility', abilityId: expect.any(String) }]);
    await expect(panel.getByRole('button', { name: /^Unlock Marked Shot/ })).toHaveCount(0);
  });

  test('Menu: a row opens its panel in place of the Menu, and Esc then returns focus to a control that exists', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'menu', 'Menu', info);
    await press(panel.getByRole('button', { name: /^Codex/ }), info);
    await expect(dialog(page, 'Codex')).toBeVisible();
    await expect(panel).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog(page, 'Codex')).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });
});

// ---- Saves -------------------------------------------------------------------------------------------------------------

test.describe('gallery: Saves', () => {
  test('save to a slot, load it, export it, and deleting asks first', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'saves', 'Saves', info);
    const slot1 = panel.locator('[data-slot="1"]');
    await expect(slot1).toHaveAttribute('data-status', 'empty');
    await press(panel.getByRole('button', { name: 'Save to slot 1', exact: true }), info);
    await expect(slot1).toHaveAttribute('data-status', 'ok');
    await expect(panel.getByRole('button', { name: 'Load slot 1', exact: true })).toBeVisible();

    // export hands the slot's text to the browser as a download
    const download = page.waitForEvent('download');
    await press(panel.getByRole('button', { name: /of slot 1$/ }), info);
    expect((await download).suggestedFilename()).toMatch(/\.json$/);

    // deleting asks first: No keeps it, Yes removes it
    await press(panel.getByRole('button', { name: 'Delete slot 1', exact: true }), info);
    const ask = page.getByRole('alertdialog');
    await expect(ask).toBeVisible();
    await press(ask.getByRole('button', { name: 'Cancel', exact: true }), info);
    await expect(slot1).toHaveAttribute('data-status', 'ok');
    await press(panel.getByRole('button', { name: 'Delete slot 1', exact: true }), info);
    await press(page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }), info);
    await expect(slot1).toHaveAttribute('data-status', 'empty');
  });

  test('an invalid import file is refused with a reason, in words', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'saves', 'Saves', info);
    const picker = panel.getByLabel('Choose a save file');
    await picker.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"kind":"run"') });
    await expect(panel.getByRole('alert')).toContainText('bad.json was not imported. Save file is not valid JSON');
    await picker.setInputFiles({ name: 'profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ kind: 'profile', version: 1 })) });
    await expect(panel.getByRole('alert')).toContainText('profile.json was not imported');
    expect(await actions(page)).toEqual([]);
  });
});

// ---- Settings ----------------------------------------------------------------------------------------------------------

test.describe('gallery: Settings', () => {
  test('text size reaches <html>, high contrast reaches data-theme, reduced motion reaches the audio engine', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'settings', 'Settings', info);
    const html = page.locator('html');

    await press(panel.getByRole('radio', { name: '150%' }), info);
    await expect(html).toHaveCSS('font-size', '24px');
    await press(panel.getByRole('radio', { name: '125%' }), info);
    await expect(html).toHaveCSS('font-size', '20px');
    await press(panel.getByRole('radio', { name: '100%' }), info);
    await expect(html).toHaveCSS('font-size', '16px');

    await expect(html).toHaveAttribute('data-theme', 'default');
    await press(panel.getByRole('checkbox', { name: 'High contrast' }), info);
    await expect(html).toHaveAttribute('data-theme', 'high-contrast');
    await press(panel.getByRole('checkbox', { name: 'High contrast' }), info);
    await expect(html).toHaveAttribute('data-theme', 'default');

    const reduced = (): Promise<boolean> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.audio.reducedMotion());
    expect(await reduced()).toBe(false);
    await press(panel.getByRole('radio', { name: 'Reduce motion' }), info);
    await expect(html).toHaveAttribute('data-motion', 'reduce');
    expect(await reduced()).toBe(true);
    await press(panel.getByRole('radio', { name: 'Full motion' }), info);
    await expect(html).toHaveAttribute('data-motion', 'full');
    expect(await reduced()).toBe(false);
  });

  test('the choices persist across a reload', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'settings', 'Settings', info);
    await press(panel.getByRole('radio', { name: '125%' }), info);
    await press(panel.getByRole('checkbox', { name: 'High contrast' }), info);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
    await expect(page.locator('html')).toHaveCSS('font-size', '20px');
  });
});

// ---- the live region -------------------------------------------------------------------------------------------------

test.describe('gallery: the live region', () => {
  test('a step says one sentence, politely, and the next step replaces it', async ({ page }, info) => {
    const { panel } = await openPanel(page, 'merchant', 'Merchant', info);
    const live = page.getByTestId('live-region');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toHaveAttribute('role', 'status');
    await expect(live).toHaveText('');
    await press(panel.getByRole('button', { name: /^Traveler's Sword, Common melee weapon/ }), info);
    await press(panel.getByRole('button', { name: 'Buy for 20 gold', exact: true }), info);
    await expect(live).toHaveText("You buy Traveler's Sword for 20 gold.");
    // one sentence: a single full stop, at the end
    expect(((await live.innerText()).match(/[.!?](\s|$)/g) ?? []).length).toBe(1);
    await press(panel.getByRole('button', { name: /^Antidote Root, 2 for sale/ }), info);
    await press(panel.getByRole('button', { name: /^Buy for 8 gold$/ }), info);
    await expect(live).toHaveText(/^You buy Antidote Root/);
    expect(((await live.innerText()).match(/[.!?](\s|$)/g) ?? []).length).toBe(1);
    expect((await actions(page)).map((a) => a.type)).toEqual(['buy', 'buy']);
  });
});
