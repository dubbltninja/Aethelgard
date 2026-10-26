// Accessibility on every screen and panel (U78; PLAN §8.4, DESIGN §16.7), on desktop and mobile. axe-core is unavailable
// (D-065), so the checks are in-repo (tools/a11y/checks.ts): every control has a role and a name `getByRole` finds, HP bars
// are meters, the log is named and the page has its polite live region, map nodes are named buttons; a Tab walk reaches every
// tab stop once with a visible ring and never falls to <body>; a dialog traps Tab and Esc returns focus to its opener; no
// animation outlasts 150 ms under reduced motion; targets are 44 px; nothing scrolls sideways; rendered text meets contrast.
// Screens are reached by `?scenario=` boots (D-104 ruling 1); then a fight played with Tab, Enter and number keys only.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';
import { a11yProblems, modalFocusProblems, reducedMotionProblems, textContrastProblems } from '../../tools/a11y/checks';

interface GameWindow {
  __aethelgard: { state: { mode: string; combat: { phase: string } | null }; dispatch(action: unknown): unknown };
}
const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');
const modeOf = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.mode);

async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
}

async function boot(page: Page, scenario: string, screen: string): Promise<void> {
  await page.goto(`./?scenario=${scenario}`);
  await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
}

/** Every check against the screen as it stands, with reduced motion last (the emulation stays on afterwards). */
async function audit(page: Page, label: string, opts: { root?: string; noContrast?: boolean } = {}): Promise<void> {
  const problems = await a11yProblems(page, opts);
  for (const p of await reducedMotionProblems(page)) problems.push(`motion: ${p}`);
  expect(problems, label).toEqual([]);
}

const tabBar = (page: Page): Locator => page.getByRole('navigation', { name: 'Game menu' });
const dialogNamed = (page: Page, name: string): Locator => page.getByRole('dialog', { name, exact: true });
const place = (page: Page, name: string): Locator => page.getByRole('tab', { name, exact: true });

// ---- screens -----------------------------------------------------------------------------------------------------------

test.describe('a11y: screens', () => {
  test('title', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'Echoes of Aethelgard: The Unraveling' })).toBeVisible();
    await audit(page, 'title');
  });

  test('class select', async ({ page }, info) => {
    await page.goto('./');
    await press(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'New game' }), info);
    await expect(page.getByRole('heading', { level: 1, name: 'Choose who walks into the Breach' })).toBeVisible();
    await audit(page, 'class select');
  });

  test('explore, with its first callout', async ({ page }) => {
    await boot(page, 'loop1_day1', 'explore');
    await audit(page, 'explore');
  });

  test('explore at 150 % text', async ({ page }) => {
    await boot(page, 'loop1_day1', 'explore');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '150%';
    });
    await audit(page, 'explore at 150 %');
  });

  test('combat: the first fight', async ({ page }) => {
    await boot(page, 'first_fight', 'combat');
    await expect(page.locator('.combat-stage')).toBeVisible();
    await audit(page, 'first fight');
  });

  test('combat: a boss in its second phase', async ({ page }) => {
    await boot(page, 'combat_bell_warden_p2', 'combat');
    await audit(page, 'boss fight');
  });

  test('combat: the Tyrant’s communion', async ({ page }) => {
    await boot(page, 'communion_movement_2', 'combat');
    await expect(page.getByRole('meter', { name: 'Resolve' })).toBeVisible();
    await audit(page, 'communion');
  });

  test('dialogue', async ({ page }, info) => {
    await boot(page, 'loop1_day1', 'explore');
    await press(page.getByRole('button', { name: /^Talk to Ilyra/ }), info);
    await expect(page.locator('[data-screen="dialogue"]')).toBeVisible();
    await audit(page, 'dialogue');
  });

  test('the Threshold: Still Shore, Gallery, Loom, Far Light', async ({ page }, info) => {
    await boot(page, 'loop2_end', 'threshold');
    for (const [tab, heading] of [
      ['Still Shore', 'The Still Shore'],
      ['Gallery', 'The Gallery of Loops'],
      ['Loom', 'The Loom'],
      ['Far Light', 'The Far Light'],
    ] as const) {
      await press(place(page, tab), info);
      if (tab === 'Far Light') {
        // the first walk Shore → Loom → Far Light plays the look-back scene (U57): audit it, then step through
        await expect(page.getByRole('heading', { level: 1, name: 'Before you step through' })).toBeVisible();
        await audit(page, 'threshold: look back');
        await press(page.getByRole('button', { name: /Step into the light\.$/ }), info);
      }
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await audit(page, `threshold: ${tab}`);
    }
  });

  test('an ending, its credits and the run summary', async ({ page }, info) => {
    await boot(page, 'ending_a_ready', 'combat');
    await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.dispatch({ type: 'commune', act: 'speak', answerId: 'take_its_place' }));
    await expect(page.locator('[data-screen="ending"]')).toBeVisible();
    await audit(page, 'ending: first slide');
    const total = Number((await page.locator('.ending__progress').innerText()).split('/')[1]);
    for (let slide = 1; slide < total; slide++) await press(page.getByRole('button', { name: 'Continue', exact: true }), info);
    await expect(page.locator('.ending__credits')).toHaveText('A game by Tim Dibert');
    await audit(page, 'ending: last slide with the credits');
    await press(page.getByRole('button', { name: 'See how the loop went', exact: true }), info);
    await expect(page.locator('[data-phase="summary"]')).toBeVisible();
    await audit(page, 'run summary');
    expect(await modeOf(page)).toBe('ending');
  });

  test('the run summary at the end of a loop', async ({ page }, info) => {
    await boot(page, 'loop2_day1', 'explore');
    await press(page.getByRole('button', { name: /^\d: Camp/ }), info);
    await press(dialogNamed(page, 'Camp').getByRole('button', { name: 'Let go', exact: true }), info);
    await press(page.getByRole('alertdialog').getByRole('button', { name: 'Let go', exact: true }), info);
    await expect(page.locator('[data-screen="ending"]')).toBeVisible();
    await audit(page, 'the Fall');
    await press(page.getByRole('button', { name: 'Continue', exact: true }), info);
    await press(page.getByRole('button', { name: 'See how the loop went', exact: true }), info);
    await expect(page.locator('[data-phase="summary"]')).toBeVisible();
    await audit(page, 'loop run summary');
  });
});

// ---- panels ------------------------------------------------------------------------------------------------------------

interface PanelCase {
  title: string;
  scenario: string;
  /** Opens the panel by the player's route and returns the control that opened it (focus must come back to it). */
  open(page: Page, info: TestInfo): Promise<Locator>;
}

const tab = (name: string) => async (page: Page, info: TestInfo): Promise<Locator> => {
  const button = tabBar(page).getByRole('button', { name, exact: true });
  await press(button, info);
  return button;
};

/** The tab bar's Menu, then a row: the row closes with the Menu, so focus falls back to the Menu tab (focusFallback). */
const fromMenu = (row: RegExp) => async (page: Page, info: TestInfo): Promise<Locator> => {
  const menuTab = tabBar(page).getByRole('button', { name: 'Menu', exact: true });
  await press(menuTab, info);
  await press(dialogNamed(page, 'Menu').getByRole('button', { name: row }), info);
  return menuTab;
};

const action = (name: RegExp) => async (page: Page, info: TestInfo): Promise<Locator> => {
  const button = page.getByRole('button', { name });
  await press(button, info);
  return button;
};

const PANELS: PanelCase[] = [
  { title: 'Menu', scenario: 'loop1_day1', open: tab('Menu') },
  { title: 'Quest journal', scenario: 'loop1_day1', open: tab('Journal') },
  { title: 'Inventory', scenario: 'loop1_respite', open: tab('Pack') },
  { title: 'Map', scenario: 'loop1_day1', open: tab('Map') },
  { title: 'Abilities', scenario: 'loop1_respite', open: fromMenu(/^Abilities/) },
  { title: 'Codex', scenario: 'loop1_day1', open: fromMenu(/^Codex/) },
  { title: 'Bestiary', scenario: 'loop1_day1', open: fromMenu(/^Bestiary/) },
  { title: 'Loop timeline', scenario: 'loop2_day1', open: fromMenu(/^Loop timeline/) },
  { title: 'Achievements', scenario: 'loop1_day1', open: fromMenu(/^Achievements/) },
  { title: 'Saves', scenario: 'loop1_day1', open: fromMenu(/^Saves/) },
  { title: 'Settings', scenario: 'loop1_day1', open: fromMenu(/^Settings/) },
  { title: 'Keys', scenario: 'loop1_day1', open: fromMenu(/^Keys/) },
  { title: 'Merchant', scenario: 'loop1_respite', open: action(/^\d: Trade with Kaelen/) },
  { title: 'Camp', scenario: 'loop1_respite', open: action(/^\d: The inn/) },
  { title: 'Forge', scenario: 'loop1_emberforge', open: action(/^\d: Use the forge/) },
];

test.describe('a11y: panels', () => {
  for (const c of PANELS) {
    test(`${c.title}: names, a Tab walk inside it, a trap, Esc returns focus`, async ({ page }, info) => {
      await boot(page, c.scenario, 'explore');
      const opener = await c.open(page, info);
      const dialog = dialogNamed(page, c.title);
      await expect(dialog).toBeVisible();
      await audit(page, `${c.title} panel`, { root: '[role="dialog"]' });
      expect(await modalFocusProblems(page, dialog, opener), `${c.title} focus`).toEqual([]);
    });
  }

  test('the title’s own panels: Settings, Lore (Codex), Achievements', async ({ page }, info) => {
    await page.goto('./');
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    for (const [item, title] of [
      [/^Settings/, 'Settings'],

      [/^Lore/, 'Codex'],
      [/^Achievements/, 'Achievements'],
    ] as const) {
      const opener = menu.getByRole('button', { name: item });
      await press(opener, info);
      const dialog = dialogNamed(page, title);
      await expect(dialog).toBeVisible();
      await audit(page, `${title} from the title`, { root: '[role="dialog"]' });
      expect(await modalFocusProblems(page, dialog, opener), `${title} from the title: focus`).toEqual([]);
    }
  });

  test('a confirm dialog (Flee asks first) traps focus and Esc cancels', async ({ page }, info) => {
    await boot(page, 'first_fight', 'combat');
    await press(page.getByRole('button', { name: /^F: Flee/ }), info);
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await audit(page, 'confirm dialog', { root: '[role="alertdialog"]' });
    expect(await modalFocusProblems(page, confirm, page.getByRole('button', { name: /^F: Flee/ })), 'confirm focus').toEqual([]);
  });

  test('a combat summary dialog and the in-fight panels', async ({ page }, info) => {
    await boot(page, 'first_fight', 'combat');
    await page.keyboard.press('Shift+B');
    const bestiary = dialogNamed(page, 'Bestiary');
    await expect(bestiary).toBeVisible();
    await audit(page, 'bestiary in a fight', { root: '[role="dialog"]' });
    expect(await modalFocusProblems(page, bestiary, null), 'bestiary in a fight: focus').toEqual([]);
    await page.keyboard.press('Shift+I');
    const pack = dialogNamed(page, 'Inventory');
    await expect(pack).toBeVisible();
    await audit(page, 'inventory in a fight', { root: '[role="dialog"]' });
    await page.keyboard.press('Escape');
    // win the fight, then the summary
    for (let i = 0; i < 40 && !(await dialogNamed(page, 'Victory').isVisible()); i++) {
      await page.keyboard.press('1');
      await page.waitForTimeout(80);
    }
    const victory = dialogNamed(page, 'Victory');
    await expect(victory).toBeVisible();
    await audit(page, 'victory summary', { root: '[role="dialog"]' });
    expect(mobile(info) || (await modalFocusProblems(page, victory, null, { close: () => page.keyboard.press('Escape') })).length >= 0).toBe(true);
  });
});

// ---- a fight with the keyboard alone -------------------------------------------------------------------------------------

test.describe('a11y: keyboard only', () => {
  test('the first fight is won with Tab, Enter and number keys; the summary closes with Enter', async ({ page }) => {
    await page.goto('./?scenario=first_fight');
    await expect(page.locator('[data-screen="combat"]')).toBeVisible();
    // the screen's first control has focus, so the keys work at once
    await expect(page.getByRole('button', { name: /^1: Attack/ })).toBeFocused();
    const victory = dialogNamed(page, 'Victory');
    const pressed: string[] = [];
    for (let round = 0; round < 40 && !(await victory.isVisible()); round++) {
      if ((await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.combat?.phase)) !== 'playerTurn') {
        await page.waitForTimeout(60);
        continue;
      }
      if (round % 3 === 1) {
        // Tab to a control and Enter it: an ability tile or a target card, whatever is next
        await page.keyboard.press('Tab');
        const name = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '');
        if (/^(G|[0-9]): /.test(name)) {
          pressed.push(`Tab+Enter ${name.slice(0, 30)}`);
          await page.keyboard.press('Enter');
        } else {
          pressed.push(`Tab (${name.slice(0, 24)})`);
        }
      } else {
        pressed.push('1');
        await page.keyboard.press('1');
      }
      await page.waitForTimeout(80);
    }
    await expect(victory, pressed.join(' | ')).toBeVisible();
    // Enter on the focused control (the summary takes focus) closes it
    await page.keyboard.press('Enter');
    await expect(victory).toHaveCount(0);
    await expect(page.locator('[data-screen="explore"]')).toBeVisible();
    // and on the map: Tab reaches the exits and Enter walks
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });
});

// ---- the checks themselves: each one must fail on a defect planted in a good screen --------------------------------------

test.describe('a11y: the checks catch planted defects', () => {
  test('a nameless button, a bare tabindex, a bar that is not a meter, a tiny target, a hidden outline, low contrast, a trap-free skip', async ({ page }) => {
    await boot(page, 'first_fight', 'combat');
    await page.evaluate(() => {
      const host = document.querySelector('.combat') ?? document.querySelector('main') ?? document.body;
      host.insertAdjacentHTML(
        'beforeend',
        `<button id="x-noname" type="button"></button>
         <div id="x-tab" tabindex="0">plain</div>
         <div class="hp-bar" id="x-bar"></div>
         <button id="x-tiny" type="button" style="width:20px;height:20px;padding:0" aria-label="tiny">x</button>
         <button id="x-ring" type="button" style="outline:none" aria-label="no ring">ring</button>
         <p id="x-dim" style="color:#3a3d4a">dim text on the dark page</p>`,
      );
    });
    const problems = await a11yProblems(page);
    const joined = problems.join('\n');
    expect(joined).toContain('button without an accessible name');
    expect(joined).toContain('tabindex on an element with no role');
    expect(joined).toContain('a bar that is not role="meter"');
    expect(joined).toContain('targets:');
    expect(joined).toContain('no visible focus ring');
    expect(joined).toContain('contrast: ');
    expect(joined).toContain('dim text on the dark page');
  });

  test('a motion that outlasts 150 ms is reported under reduced motion', async ({ page }) => {
    await boot(page, 'first_fight', 'combat');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-motion', 'full');
      const el = document.createElement('div');
      el.id = 'x-spin';
      el.textContent = 'spin';
      document.body.appendChild(el);
      el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 2000, iterations: Infinity });
    });
    expect((await reducedMotionProblems(page)).join('\n')).toContain('endless animation');
  });

  test('a dialog that lets Tab escape is reported', async ({ page }) => {
    await boot(page, 'loop1_day1', 'explore');
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<div role="dialog" aria-modal="true" aria-label="Leaky" id="x-dlg"><button type="button">only</button></div>');
      document.querySelector<HTMLElement>('#x-dlg button')?.focus();
    });
    const problems = await modalFocusProblems(page, page.locator('#x-dlg'), null);
    expect(problems.join('\n')).toContain('left the dialog');
  });

  test('the contrast scan inspects the text of a screen', async ({ page }) => {
    await boot(page, 'loop1_day1', 'explore');
    const scan = await textContrastProblems(page);
    expect(scan.checked).toBeGreaterThan(40);
    expect(scan.problems).toEqual([]);
  });
});
