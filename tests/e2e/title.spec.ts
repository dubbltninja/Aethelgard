// Title → Class Select → a new game (U63; PLAN §6.3, §6.7, §8.3–8.4), on desktop and mobile, driven through accessible
// names only. Also: Continue after a return to the title, a keyboard-only start, the `?` keys dialog, Settings
// (text size and high contrast reach <html>), and the in-repo a11y checks of §8.4 for these two screens.
import { expect, test, type Page } from 'playwright/test';

const START = 'Whispering Ruins';

interface GameWindow {
  __aethelgard: { state: { mode: string; player: { classId: string; name: string } } };
}

async function gameState(page: Page): Promise<GameWindow['__aethelgard']['state']> {
  return page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state);
}

/** Every focusable control has a non-empty accessible name (aria-label, aria-labelledby, its label, or its text). */
async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const textOf = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const nameOf = (el: HTMLElement): string => {
      const label = el.getAttribute('aria-label');
      if (label) return label.trim();
      const by = el.getAttribute('aria-labelledby');
      if (by) return by.split(/\s+/).map((id) => textOf(document.getElementById(id))).join(' ').trim();
      const labels = (el as HTMLInputElement).labels;
      if (labels && labels.length > 0) return textOf(labels[0] ?? null);
      return textOf(el);
    };
    const controls = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')];
    return controls.filter((el) => el.getClientRects().length > 0 && nameOf(el) === '').map((el) => el.outerHTML.slice(0, 80));
  });
}

/** Visible controls smaller than 44 × 44 CSS px (PLAN §6.7). */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main button, main input, main summary, main a[href], [role="dialog"] button, [role="dialog"] input')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ el, box: (el.closest('label.choice') ?? el).getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ el, box }) => `${el.outerHTML.slice(0, 60)} ${Math.round(box.width)}×${Math.round(box.height)}`),
  );
}

async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test.describe('title and class select', () => {
  test('a new game: Title → Class Select → explore, then Continue resumes it', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
    });
    page.on('pageerror', (e) => problems.push(e.message));

    await page.goto('./');
    await expect(page).toHaveTitle('Echoes of Aethelgard');
    await expect(page.getByRole('heading', { level: 1, name: 'Echoes of Aethelgard: The Unraveling' })).toBeVisible();
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await expect(menu.getByRole('button', { name: /^Continue/ })).toBeDisabled();
    await expect(menu.getByRole('button', { name: 'New game' })).toBeFocused();

    await menu.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Choose who walks into the Breach' })).toBeVisible();
    const classes = page.getByRole('radio');
    await expect(classes).toHaveCount(5);
    await expect(page.getByRole('radio', { name: 'Ranger' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Ranger' })).toBeFocused();

    await page.getByRole('radio', { name: 'Elf' }).check();
    await expect(page.getByRole('heading', { level: 2, name: 'Elf' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Ann');
    await page.getByRole('button', { name: 'Begin as Elf' }).click();

    await expect(page.getByRole('heading', { level: 1, name: START })).toBeVisible();
    await expect(page).toHaveTitle(`${START} · Echoes of Aethelgard`);
    expect(await gameState(page)).toMatchObject({ mode: 'explore', player: { classId: 'elf', name: 'Ann' } });

    await page.getByRole('button', { name: 'Return to title' }).click();
    const resume = page.getByRole('button', { name: /^Continue/ });
    await expect(resume).toBeEnabled();
    await expect(resume).toContainText(`Loop 1 · Day 1 · ${START}`);
    await resume.click();
    await expect(page.getByRole('heading', { level: 1, name: START })).toBeVisible();
    expect((await gameState(page)).mode).toBe('explore');
    expect(problems).toEqual([]);
  });

  test('keyboard only: Enter, arrows and Enter start a Wizard; ? lists the keys; Esc goes back', async ({ page }, info) => {
    test.skip(info.project.name.startsWith('mobile'), 'keyboard flow is a desktop concern');
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'New game' })).toBeFocused();
    await expect(page.getByRole('list', { name: 'Keys you can press' })).toContainText('Choose');

    await page.keyboard.press('?');
    const keys = page.getByRole('dialog', { name: 'Keys' });
    await expect(keys).toBeVisible();
    await expect(keys.getByRole('heading', { name: 'Title' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(keys).toBeHidden();
    await expect(page.getByRole('button', { name: 'New game' })).toBeFocused();

    await page.keyboard.press('ArrowDown'); // Load is off, so Settings
    await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: 'New game' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('radio', { name: 'Ranger' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
    await page.getByRole('button', { name: 'New game' }).press('Enter');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Wizard' })).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: START })).toBeVisible();
    expect((await gameState(page)).player.classId).toBe('wizard');
  });

  test('Settings: text size and high contrast reach <html> and persist; nothing scrolls sideways at 150 %', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('radio', { name: '150%' }).check();
    await settings.getByRole('checkbox', { name: 'High contrast' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
    expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe('150%');
    await settings.getByRole('button', { name: 'Close settings' }).click();
    await expect(settings).toBeHidden();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
    expect(await noHorizontalScroll(page)).toBe(true);

    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Choose who walks into the Breach' })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
    expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe('150%');
  });

  test('a11y: names, 44 px targets, focus ring and focus order on both screens', async ({ page }, info) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'New game' })).toBeFocused();
    expect(await unnamedControls(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);

    if (!info.project.name.startsWith('mobile')) {
      // Tab walks the enabled menu items in visual order, each with a visible ring of at least 2 px.
      const walk: { name: string; outline: number }[] = [];
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Tab');
        walk.push(
          await page.evaluate(() => {
            const el = document.activeElement as HTMLElement;
            return { name: (el.textContent ?? '').trim(), outline: parseFloat(getComputedStyle(el).outlineWidth) };
          }),
        );
      }
      expect(walk.map((w) => w.name)).toEqual(['Settings', 'Lore', 'Credits']);
      expect(walk.every((w) => w.outline >= 2)).toBe(true);
    }

    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('radio', { name: 'Ranger' })).toBeFocused();
    expect(await unnamedControls(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test('reduced motion: no animation longer than 150 ms', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'New game' })).toBeFocused();
    const long = await page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => Number(a.effect?.getComputedTiming().duration ?? 0))
        .filter((d) => d > 150),
    );
    expect(long).toEqual([]);
  });
});
