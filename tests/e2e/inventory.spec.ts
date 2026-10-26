// The management panels (U67; PLAN §6.3, §8.3–8.4; DESIGN §5.1, §6.3, §7–§9, §16.3), on desktop and mobile, through
// accessible names and `?scenario=` boots (D-104 ruling 1): put on a found piece in the Inventory; spend a stat point and
// unlock an ability in the Abilities panel; buy and sell at Kaelen's wagon; upgrade a piece at the Emberforge; rest at its
// camp; then the in-repo a11y checks (names, 44 px targets, no sideways scroll) in each panel.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface Inst {
  uid: string;
  itemId: string;
  qty: number;
  rarity: string;
}
interface GameWindow {
  __aethelgard: {
    state: {
      mode: string;
      clock: { ticks: number };
      player: {
        gold: number;
        statPoints: number;
        apHalf: number;
        hp: number;
        hpMax: number;
        stats: Record<string, number>;
        abilitiesUnlocked: string[];
        inventory: Inst[];
        equipment: Record<string, Inst | null>;
      };
    };
  };
}
type Player = GameWindow['__aethelgard']['state']['player'];

const player = (page: Page): Promise<Player> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.player);
const ticks = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.clock.ticks);

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');

async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
}

/** The Menu tab, then one of its rows (U69: Abilities, Codex, Bestiary and the rest live behind the tab bar's Menu). */
async function openFromMenu(page: Page, row: string, info: TestInfo): Promise<void> {
  await press(page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Menu' }), info);
  await press(page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: new RegExp(`^${row}`) }), info);
}

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

async function boot(page: Page, scenario: string): Promise<void> {
  await page.goto(`./?scenario=${scenario}`);
  await expect(page.locator('[data-screen="explore"]')).toBeVisible();
}

const dialog = (page: Page, name: string): Locator => page.getByRole('dialog', { name, exact: true });

/** Visible controls smaller than 44 × 44 CSS px (PLAN §6.7) in the open dialog. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] summary, [role="dialog"] select, [role="dialog"] [role="tab"]')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ el, box }) => `${el.outerHTML.slice(0, 90)} ${Math.round(box.width)}×${Math.round(box.height)}`),
  );
}

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
    const controls = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] [role="tab"], [role="dialog"] [tabindex]:not([tabindex="-1"])')];
    return controls.filter((el) => el.getClientRects().length > 0 && nameOf(el) === '').map((el) => el.outerHTML.slice(0, 90));
  });
}

const noHorizontalScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** The dialog's own horizontal overflow (a panel wider than the screen). */
const dialogFits = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const d = document.querySelector<HTMLElement>('[role="dialog"]');
    return d === null || d.scrollWidth <= d.clientWidth + 1;
  });

async function checkPanel(page: Page, name: string): Promise<void> {
  expect(await smallTargets(page), `${name}: controls under 44 px`).toEqual([]);
  expect(await unnamedControls(page), `${name}: controls without a name`).toEqual([]);
  expect(await noHorizontalScroll(page), `${name}: page scrolls sideways`).toBe(true);
  expect(await dialogFits(page), `${name}: the panel is wider than itself`).toBe(true);
}

test.describe('inventory and the other management panels', () => {
  test('@smoke put on a found piece: Inventory lists the pack by rarity, Wear moves it to its slot (I opens it on a keyboard)', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop1_respite');
    const before = await player(page);
    const spare = before.inventory.find((i) => i.itemId === 'item_scribes_robe') ?? before.inventory.find((i) => i.itemId !== 'mat_wildling_hide' && i.rarity === 'common');
    expect(spare, 'the scenario leaves unworn gear in the pack').toBeDefined();
    if (mobile(info)) await press(page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Pack' }), info);
    else await page.keyboard.press('i');
    const panel = dialog(page, 'Inventory');
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/Pack \d+ \/ 40/).first()).toBeVisible();
    await expect(panel.getByRole('button', { name: /^Weapon: / })).toBeVisible();
    await checkPanel(page, 'Inventory');

    // the piece lying in the pack: its card, the rarity in words, and what it would change
    const row = panel.locator(`[data-item-id="${spare?.uid}"]`);
    await press(row, info);
    await expect(panel.getByText('Compared with what you wear')).toBeVisible();
    await expect(panel.getByRole('heading', { name: /./, level: 3 }).first()).toBeVisible();
    await checkPanel(page, 'Inventory (an item)');
    const wear = panel.getByRole('button', { name: 'Wear', exact: true });
    await expect(wear).toBeEnabled();
    await press(wear, info);
    await expect.poll(async () => Object.values((await player(page)).equipment).some((i) => i?.uid === spare?.uid)).toBe(true);
    // it is worn now: the same card offers Take off, and the slot row names it
    await expect(panel.getByRole('button', { name: 'Take off', exact: true })).toBeVisible();
    if (!mobile(info)) await expect(panel.getByRole('button', { name: /^Armor: .+, \w+ /, exact: false }).first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('drop asks first when it matters, and Esc closes the panel', async ({ page }, info) => {
    await boot(page, 'loop1_respite');
    if (mobile(info)) await press(page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Pack' }), info);
    else await page.keyboard.press('i');
    const panel = dialog(page, 'Inventory');
    const before = await player(page);
    const hide = before.inventory.find((i) => i.itemId === 'mat_wildling_hide');
    expect(hide).toBeDefined();
    await press(panel.locator(`[data-item-id="${hide?.uid}"]`), info);
    const dropOne = panel.getByRole('button', { name: 'Drop one', exact: true });
    await expect(dropOne).toBeEnabled();
    await press(dropOne, info);
    await expect.poll(async () => (await player(page)).inventory.find((i) => i.itemId === 'mat_wildling_hide')?.qty ?? 0).toBe((hide?.qty ?? 0) - 1);
    if (!mobile(info)) {
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }
  });

  test('spend a stat point on the Character tab and unlock an ability on its branch', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop1_respite');
    await openFromMenu(page, 'Abilities', info);
    const panel = dialog(page, 'Abilities');
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/AP to spend/)).toBeVisible();
    await checkPanel(page, 'Abilities (a branch)');
    const start = await player(page);
    expect(start.statPoints).toBeGreaterThan(0);

    // an ability: the first branch's ready one says what it costs and unlocks
    const unlock = panel.getByRole('button', { name: /^Unlock .* for \d/ }).and(panel.locator(':enabled')).first();
    await expect(unlock).toBeVisible();
    await press(unlock, info);
    await expect.poll(async () => (await player(page)).abilitiesUnlocked.length).toBe(start.abilitiesUnlocked.length + 1);
    expect((await player(page)).apHalf).toBeLessThan(start.apHalf);

    // a stat point: the tab shows what one more point does to the numbers
    await press(panel.getByRole('tab', { name: /^Character/ }), info);
    await expect(panel.getByText(/One more: /).first()).toBeVisible();
    await checkPanel(page, 'Abilities (character)');
    await press(panel.getByRole('button', { name: 'Add a point to Strength' }), info);
    await expect.poll(async () => (await player(page)).statPoints).toBe(start.statPoints - 1);
    expect((await player(page)).stats.strength).toBe((start.stats.strength ?? 0) + 1);
    // not at an inn: the respec says where it can be done
    await expect(panel.getByTestId('respec-summary')).toContainText('camp fire');
    expect(problems).toEqual([]);
  });

  test('buy and sell at Kaelen: prices with the standing, a quantity, gold in and out', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop1_respite');
    await press(page.getByRole('button', { name: /^\d: Trade with Kaelen/ }), info);
    const panel = dialog(page, 'Merchant');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('standing')).toContainText(/prices/);
    await checkPanel(page, 'Merchant (buy)');
    const start = await player(page);

    // buy: the cheapest stack item, two of it
    const buyRow = panel.locator('[data-item="item_antidote_root"], [data-item="mat_ley_resin"]').first();
    await press(buyRow, info);
    const more = panel.getByRole('button', { name: 'More quantity to buy' });
    await press(more, info);
    const buy = panel.getByRole('button', { name: /^Buy 2 for \d+ gold$/ });
    await expect(buy).toBeEnabled();
    const cost = Number(/for (\d+) gold/.exec((await buy.textContent()) ?? '')?.[1]);
    await press(buy, info);
    await expect.poll(async () => (await player(page)).gold).toBe(start.gold - cost);

    // sell: the hides, all of them
    await press(panel.getByRole('tab', { name: /^Sell/ }), info);
    await checkPanel(page, 'Merchant (sell)');
    const afterBuy = await player(page);
    const hide = afterBuy.inventory.find((i) => i.itemId === 'mat_wildling_hide');
    expect(hide).toBeDefined();
    await press(panel.locator(`[data-item-id="${hide?.uid}"]`), info);
    const sell = panel.getByRole('button', { name: /^Sell( \d+)? for \d+ gold$/ });
    await expect(sell).toBeEnabled();
    const gain = Number(/for (\d+) gold/.exec((await sell.textContent()) ?? '')?.[1]);
    await press(sell, info);
    await expect.poll(async () => (await player(page)).gold).toBe(afterBuy.gold + gain);
    expect(problems).toEqual([]);
  });

  test('upgrade a piece at the Emberforge: Uncommon for gold, then Rare with ore and an affix chosen from three', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop1_emberforge');
    await press(page.getByRole('button', { name: /^\d: Use the forge/ }), info);
    const panel = dialog(page, 'Forge');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('tab', { name: /^Upgrade/ })).toHaveAttribute('aria-selected', 'true');
    const start = await player(page);
    const piece = start.equipment.weapon as Inst;
    await press(panel.locator(`[data-item-id="${piece.uid}"]`), info);
    await expect(panel.getByRole('heading', { name: /Upgrade to Uncommon/ })).toBeVisible();
    await expect(panel.getByText('Gold only: no materials are needed.')).toBeVisible();
    await checkPanel(page, 'Forge (upgrade)');
    const toUncommon = panel.getByRole('button', { name: /^Upgrade to Uncommon for \d+ gold$/ });
    await expect(toUncommon).toBeEnabled();
    const fee = Number(/for (\d+) gold/.exec((await toUncommon.textContent()) ?? '')?.[1]);
    await press(toUncommon, info);
    await expect.poll(async () => (await player(page)).equipment.weapon?.rarity).toBe('uncommon');
    const mid = await player(page);
    expect(mid.equipment.weapon?.uid).toBe(piece.uid);
    expect(mid.gold).toBe(start.gold - fee);

    // the same piece again: Rare takes two Ember Ore and opens a slot, the affix is chosen from three offered
    await expect(panel.getByRole('heading', { name: /Upgrade to Rare/ })).toBeVisible();
    await expect(panel.getByText(/Ember Ore/).first()).toBeVisible();
    const toRare = panel.getByRole('button', { name: /^Upgrade to Rare for \d+ gold$/ });
    await expect(toRare).toBeDisabled();
    await expect(panel.getByText('Choose an affix for the new slot').first()).toBeVisible();
    expect(await panel.locator('[data-affix-id]').count()).toBe(3);
    const offer = panel.locator('[data-affix-id]').first();
    const affixId = await offer.getAttribute('data-affix-id');
    await press(offer, info);
    await expect(offer).toHaveAttribute('aria-pressed', 'true');
    await expect(toRare).toBeEnabled();
    await press(toRare, info);
    await expect.poll(async () => (await player(page)).equipment.weapon?.rarity).toBe('rare');
    const end = await player(page);
    expect(end.equipment.weapon).toMatchObject({ uid: piece.uid });
    expect((end.equipment.weapon as unknown as { affixes: string[] }).affixes).toContain(affixId as string);
    expect(end.inventory.find((i) => i.itemId === 'mat_ember_ore')?.qty).toBe((start.inventory.find((i) => i.itemId === 'mat_ember_ore')?.qty ?? 0) - 2);
    expect(problems).toEqual([]);
  });

  test('the Forge also crafts and salvages, each with what it needs against what you carry', async ({ page }, info) => {
    await boot(page, 'loop1_emberforge');
    await press(page.getByRole('button', { name: /^\d: Use the forge/ }), info);
    const panel = dialog(page, 'Forge');
    await press(panel.getByRole('tab', { name: /^Craft/ }), info);
    const recipe = panel.locator('[data-list-item]').first();
    await press(recipe, info);
    await expect(panel.getByText(/Borin’s fee|No fee/).first()).toBeVisible();
    await expect(panel.locator('.needs .need').first()).toBeVisible();
    await checkPanel(page, 'Forge (craft)');
    await press(panel.getByRole('tab', { name: /^Salvage/ }), info);
    await checkPanel(page, 'Forge (salvage)');
  });

  test('rest at a camp: the Camp panel offers the two rests with their time, a full rest passes the night', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop1_emberforge');
    // U62b: the Emberforge's vein (`ev_forge_vein`) is one more row, so the Camp may be past the ninth numbered key
    await press(page.getByRole('button', { name: /^(\d: )?Camp\b/ }), info);
    const panel = dialog(page, 'Camp');
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/Restores .* of your HP and MP/).first()).toBeVisible();
    await expect(panel.getByTestId('camp-respec')).toContainText('rethink your path');
    await checkPanel(page, 'Camp');
    const start = await ticks(page);
    await press(panel.getByRole('button', { name: 'Full rest', exact: true }), info);
    await expect.poll(() => ticks(page)).toBeGreaterThan(start);
    const after = await player(page);
    expect(after.hp).toBe(after.hpMax);
    expect(problems).toEqual([]);
  });

  test('the camp’s respec is behind a question; the Abilities panel opens from the Camp', async ({ page }, info) => {
    await boot(page, 'loop1_emberforge');
    await press(page.getByRole('button', { name: /^(\d: )?Camp\b/ }), info);
    const camp = dialog(page, 'Camp');
    await press(camp.getByRole('button', { name: 'Open Abilities' }), info);
    const panel = dialog(page, 'Abilities');
    await expect(panel).toBeVisible();
    await press(panel.getByRole('tab', { name: /^Character/ }), info);
    const respec = panel.getByRole('button', { name: /^Rethink your path/ });
    await expect(respec).toBeEnabled();
    await press(respec, info);
    const ask = page.getByRole('alertdialog');
    await expect(ask).toBeVisible();
    await press(ask.getByRole('button', { name: 'Cancel' }), info);
    await expect(ask).toBeHidden();
  });

  test('reduced motion and high contrast keep every panel readable', async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, 'loop1_respite');
    await openFromMenu(page, 'Abilities', info);
    await expect(dialog(page, 'Abilities')).toBeVisible();
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[role="dialog"] *')].filter((el) => {
        const s = getComputedStyle(el);
        return s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.1;
      }).length,
    );
    expect(moving).toBe(0);
  });
});
