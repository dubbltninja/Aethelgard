// The Combat screen (U65; PLAN §6.3, §6.6–6.8, §8.3–8.4; DESIGN §4, §16.5, §16.7), on desktop and mobile, driven through
// accessible names and `?scenario=` boots (D-104 ruling 1): the first fight won by keyboard (1 attacks the target) and by
// tap, a hit's explanation in the log, the summary dialog and the way back to explore; a boss after its phase change
// (the Bell-Warden in Phase 2: the banner, the phase line, the segmented bar, the Guard preview); one communion act
// against the Unveiled Tyrant in Movement II (greyed answers say what they need; Listen raises Resolve); then the in-repo
// a11y checks and reduced motion.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface GameWindow {
  __aethelgard: { state: { mode: string; combat: { phase: string; round: number; communion: { resolve: number } | null } | null } };
}

async function gameState(page: Page): Promise<GameWindow['__aethelgard']['state']> {
  return page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state);
}

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');

async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
}

async function boot(page: Page, scenario: string): Promise<void> {
  await page.goto(`./?scenario=${scenario}`);
  await expect(page.locator('[data-screen="combat"]')).toBeVisible();
}

const victory = (page: Page): Locator => page.getByRole('dialog', { name: 'Victory' });

/** Acts until the summary dialog shows (a fresh Level 1 Wayfinder against one Corrupted Shade always wins). */
async function fightUntilWon(page: Page, act: () => Promise<void>): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (await victory(page).isVisible()) return;
    await act();
    await expect.poll(async () => (await victory(page).isVisible()) || (await gameState(page)).combat?.phase === 'playerTurn').toBe(true);
  }
  await expect(victory(page)).toBeVisible();
}

async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main button, main summary, main input, [role="dialog"] button')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ el, box: (el.closest('label') ?? el).getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ el, box }) => `${el.outerHTML.slice(0, 70)} ${Math.round(box.width)}×${Math.round(box.height)}`),
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
      if (el.tagName === 'INPUT') return textOf(el.closest('label'));
      return textOf(el);
    };
    const controls = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')];
    return controls.filter((el) => el.getClientRects().length > 0 && nameOf(el) === '').map((el) => el.outerHTML.slice(0, 80));
  });
}

test.describe('combat', () => {
  test('the first fight, won by keyboard: 1 attacks, the log explains the hit, the summary returns to explore', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
    });
    page.on('pageerror', (e) => problems.push(e.message));
    await boot(page, 'first_fight');
    await expect(page).toHaveTitle('Combat · Echoes of Aethelgard');
    await expect(page.getByRole('heading', { level: 1, name: 'Corrupted Shade' })).toBeVisible();
    const attack = page.getByRole('button', { name: /^1: Attack, at Corrupted Shade/ });
    await expect(attack).toBeFocused(); // the screen's first control takes focus
    await expect(page.getByRole('button', { name: /^Target Corrupted Shade/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('img', { name: /^Intent: Rake, physical, \d+ to \d+ damage, targeting you/ })).toBeVisible();
    await expect(page.getByRole('meter', { name: 'Corrupted Shade HP' })).toHaveAttribute('aria-valuenow', '36');
    await expect(page.getByRole('button', { name: /^F: Flee, \d+% chance/ })).toBeVisible();

    // blows until one lands (either way), then its explanation in the log (DESIGN §4.3 in plain words)
    const log = page.getByRole('log');
    const hit = log.locator('summary').filter({ hasText: / hits .+ for \d+/ });
    for (let i = 0; i < 6 && (await hit.count()) === 0; i++) {
      await page.keyboard.press('1');
      await expect.poll(async () => (await gameState(page)).combat?.phase ?? 'over').not.toBe('enemyTurn');
    }
    await page.getByRole('button', { name: 'Show more' }).click();
    await hit.last().click();
    await expect(log.getByText(/^\d+ damage to (you|Corrupted Shade)\.$/).first()).toBeVisible();
    await attack.focus();

    await fightUntilWon(page, () => page.keyboard.press('1'));
    const dialog = victory(page);
    await expect(dialog.getByText(/^Won in \d+ rounds?\.$/)).toBeVisible();
    await expect(dialog.getByText(/^\+\d+ XP$/)).toBeVisible();
    const cont = dialog.getByRole('button', { name: 'Continue' });
    await expect(cont).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    expect((await gameState(page)).mode).toBe('explore');
    await expect(page.locator('#place-heading')).toBeFocused();
    expect(problems).toEqual([]);
  });

  test('the first fight, won by tap (click on desktop)', async ({ page }, info) => {
    await boot(page, 'first_fight');
    await fightUntilWon(page, () => press(page.getByRole('button', { name: /^1: Attack/ }), info));
    await press(victory(page).getByRole('button', { name: 'Continue' }), info);
    await expect(victory(page)).toBeHidden();
    expect((await gameState(page)).mode).toBe('explore');
  });

  test('a boss phase change: the Bell-Warden in Phase 2', async ({ page }, info) => {
    await boot(page, 'combat_bell_warden_p2');
    const banner = page.getByRole('complementary', { name: 'What changed' });
    await expect(banner).toContainText('The Bell-Warden · Phase 2 of 3');
    await expect(banner).toContainText('The water in the well begins to rise.');
    const card = page.locator('.enemy-card').filter({ hasText: 'The Bell-Warden' });
    await expect(card.getByText(/^Phase 2 of 3: /)).toBeVisible();
    await expect(card.locator('.hp-bar__tick')).toHaveCount(2); // the bar is segmented at the later phases
    await expect(card.getByText('Boss')).toBeVisible();
    // an area intent, and the Guard button's post-Guard numbers for it
    await expect(page.getByRole('img', { name: /^Intent: Great Toll, .*targeting everyone/ })).toBeVisible();
    const guard = page.getByRole('button', { name: /^G: Guard, halves the next hits, Great Toll \d+–\d+ → \d+–\d+/ });
    await expect(guard).toBeVisible();
    // no fleeing a boss; out of Focus, the abilities say why
    await expect(page.getByRole('button', { name: /^F: Flee/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^2: Marked Shot, 8 Focus, Needs 8 Focus$/ })).toHaveAttribute('aria-disabled', 'true');
    // guard through the toll: the fight goes on and the round advances
    await press(guard, info);
    await expect.poll(async () => (await gameState(page)).combat?.phase).toBe('playerTurn');
    await expect(page.getByText(/^Round [5-9]/)).toBeVisible();
    await expect(page.getByRole('log')).toContainText('Wayfinder guards.');
  });

  test('communion: Movement II — greyed answers say what they need; Listen raises Resolve', async ({ page }, info) => {
    await boot(page, 'communion_movement_2');
    const bar = page.getByRole('region', { name: 'Communion with The Chronos Tyrant' });
    const resolve = bar.getByRole('meter', { name: 'Resolve' });
    await expect(resolve).toHaveAttribute('aria-valuenow', '5');
    await expect(bar.getByText(/^Movement 2 · question 1 of 6/)).toBeVisible();
    await expect(bar.getByText("'What is read is owed. What have you read?'")).toBeVisible();
    const korr = bar.getByRole('button', { name: /^\d: Speak: Your margins\. I read them, and I owe\., Needs / });
    await expect(korr).toHaveAttribute('aria-disabled', 'true');
    // the communion owns the number keys and the bar; the abilities are one toggle away
    await expect(page.getByRole('button', { name: /^1: Attack/ })).toHaveCount(0);
    // focus lands on the first answer that can be given: since U58 every question has a silence ("I have not read it.")
    await expect(bar.getByRole('button', { name: /^\d: Speak: I have not read it\.$/ })).toBeFocused();
    const listen = bar.getByRole('button', { name: /^\d: Listen$/ });
    await press(listen, info);
    await expect(resolve).toHaveAttribute('aria-valuenow', '6');
    await expect(page.getByRole('log')).toContainText('You listen.');
    await expect(bar.getByRole('button', { name: /^\d: Listen, You have listened in this Movement$/ })).toHaveAttribute('aria-disabled', 'true');
    expect((await gameState(page)).combat?.communion?.resolve).toBe(6);
    await press(bar.getByRole('button', { name: /^Show abilities/ }), info);
    await expect(page.getByRole('button', { name: /^1: Attack/ })).toBeVisible();
  });

  test('a11y: names, roles, 44 px targets, no sideways scroll at 150 %, a visible focus ring', async ({ page }, info) => {
    await boot(page, 'combat_tyrant_contained_p2');
    expect(await unnamedControls(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('log')).toBeAttached();
    // ← / → move the target between the Tyrant and its add
    if (!mobile(info)) {
      await expect(page.getByRole('button', { name: /^Target The Chronos Tyrant/ })).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('button', { name: /^Target Temporal Aberration/ })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: /^1: Attack, at Temporal Aberration/ })).toBeVisible();
      const ring = await page.evaluate(() => parseFloat(getComputedStyle(document.activeElement as HTMLElement).outlineWidth));
      expect(ring).toBeGreaterThanOrEqual(2);
    }
    // the item sheet is a dialog with named controls
    await press(page.getByRole('button', { name: /^I: Item/ }), info);
    const sheet = page.getByRole('dialog', { name: 'Use an item' });
    await expect(sheet).toBeVisible();
    expect(await unnamedControls(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '150%';
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('reduced motion: sigils hold still and no damage number floats', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, 'first_fight');
    await page.keyboard.press('1');
    await expect.poll(async () => (await gameState(page)).combat?.round ?? 0).toBeGreaterThan(1);
    await expect(page.locator('.float-number')).toHaveCount(0);
    const long = await page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => Number(a.effect?.getComputedTiming().duration ?? 0))
        .filter((d) => d > 150),
    );
    expect(long).toEqual([]);
  });
});
