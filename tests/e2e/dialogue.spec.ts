// The Dialogue screen and the reading panels (U66; PLAN §6.3, §8.3–8.4; DESIGN §13, §16.3), on desktop and mobile, driven
// through accessible names and `?scenario=` boots (D-104 ruling 1): talk to Ilyra on the first day and answer by keyboard
// (Enter continues, 1 takes the answer, arrows move) and by tap; the Quest journal shows the quest she gave; a Codex entry
// opens (and a locked one stays a silhouette with a hint); the Bestiary shows the Shade after the first fight; the Title's
// "Lore" opens the Codex; then the in-repo a11y checks (names, 44 px targets, no sideways scroll) and reduced motion.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface GameWindow {
  __aethelgard: { state: { mode: string; quests: Record<string, { status: string }>; combat: { phase: string } | null } };
}

async function gameState(page: Page): Promise<GameWindow['__aethelgard']['state']> {
  return page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state);
}

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

async function boot(page: Page, scenario: string, screen: string): Promise<void> {
  await page.goto(`./?scenario=${scenario}`);
  await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
}

const talkToIlyra = async (page: Page, info: TestInfo): Promise<void> => {
  await press(page.getByRole('button', { name: /^Talk to Ilyra/ }), info);
  await expect(page.locator('[data-screen="dialogue"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'The whispers are louder' })).toBeVisible();
};

/** Visible controls smaller than 44 × 44 CSS px (PLAN §6.7) in the screen and its dialogs. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main button, main summary, main select, [role="dialog"] button, [role="dialog"] summary, [role="dialog"] select')]
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
      if (el.tagName === 'SELECT' || el.tagName === 'INPUT') return textOf(el.closest('label'));
      return textOf(el);
    };
    const controls = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')];
    return controls.filter((el) => el.getClientRects().length > 0 && nameOf(el) === '').map((el) => el.outerHTML.slice(0, 80));
  });
}

const noHorizontalScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe('dialogue', () => {
  test('talk to Ilyra by keyboard: Enter continues, arrows move between answers, 1 takes one; the quest lands in the journal', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop1_day1', 'explore');
    await talkToIlyra(page, info);
    await expect(page).toHaveTitle('Conversation · Echoes of Aethelgard');
    await expect(page.getByRole('region', { name: 'The whispers are louder' })).toBeVisible();
    await expect(page.getByText('The whispers here are louder each day.', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Ilyra', { exact: true }).first()).toBeVisible();

    const cont = page.getByRole('button', { name: /^Continue/ });
    await expect(cont).toBeFocused(); // the first control takes focus, so Enter just works
    await page.keyboard.press('Enter');

    const yes = page.getByRole('button', { name: '1: Yes.' });
    const no = page.getByRole('button', { name: '2: No.' });
    await expect(yes).toBeFocused();
    await expect(page.getByText('Accept her request to recover an Echo Crystal?')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(no).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(yes).toBeFocused(); // wraps
    await page.keyboard.press('ArrowUp');
    await expect(no).toBeFocused();
    await expect(page.getByText('Earlier in this conversation (1)')).toBeVisible();

    await page.keyboard.press('1');
    await expect(page.locator('[data-screen="explore"]')).toBeVisible();
    expect((await gameState(page)).quests.q_echo_crystal?.status).toBe('active');
    await expect(page.locator('#place-heading')).toBeFocused();

    // the Quest journal (Q) shows it, with its objective and where to go
    await page.keyboard.press('q');
    const journal = page.getByRole('dialog', { name: 'Quest journal' });
    await expect(journal).toBeVisible();
    await expect(journal.getByRole('tab', { name: 'Active, 1' })).toHaveAttribute('aria-selected', 'true');
    await press(journal.getByRole('button', { name: /^Echoes in the Library/ }), info); // a phone shows the list, then the quest
    await expect(journal.getByRole('heading', { level: 3, name: 'Echoes in the Library' })).toBeVisible();
    await expect(journal.getByText('Where it stands')).toBeVisible();
    await expect(journal.getByText(/near .*Library/).first()).toBeVisible();
    if (mobile(info)) await press(journal.getByRole('button', { name: 'Back to quests' }), info);
    await journal.getByRole('tab', { name: 'People' }).click();
    await expect(journal.getByRole('meter', { name: /standing$/ }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(journal).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('talk to Ilyra by tap (click on desktop): refuse, the narrator answers, the conversation ends', async ({ page }, info) => {
    await boot(page, 'loop1_day1', 'explore');
    await talkToIlyra(page, info);
    await press(page.getByRole('button', { name: /^Continue/ }), info);
    await press(page.getByRole('button', { name: '2: No.' }), info);
    await expect(page.getByText('Ilyra nods, her eyes shadowed with disappointment.')).toBeVisible();
    await press(page.getByRole('button', { name: /^End the conversation/ }), info);
    await expect(page.locator('[data-screen="explore"]')).toBeVisible();
    expect((await gameState(page)).quests.q_echo_crystal?.status ?? 'inactive').toBe('inactive');
    // nothing started: the journal says so
    await press(page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Journal' }), info);
    await expect(page.getByRole('dialog', { name: 'Quest journal' }).getByText(/No quest is under way/)).toBeVisible();
  });

  test('accessibility: named, ≥ 44 px answers, no sideways scroll, and a still portrait under reduced motion', async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, 'loop1_day1', 'explore');
    await talkToIlyra(page, info);
    await press(page.getByRole('button', { name: /^Continue/ }), info);
    await expect(page.getByRole('button', { name: '1: Yes.' })).toBeVisible();
    expect(await unnamedControls(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => (a.effect?.getTiming().iterations ?? 1) === Infinity).length)).toBe(0);
    await expect(page.locator('.dialogue__portrait svg').first()).toBeVisible();
    // the answers and the portrait sit inside the screen (nothing clipped on a phone)
    const box = await page.getByRole('button', { name: '1: Yes.' }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  });
});

test.describe('codex', () => {
  test('an entry opens and is read; a locked one stays a silhouette with a hint', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop1_day1', 'explore');
    await openFromMenu(page, 'Codex', info);
    const codex = page.getByRole('dialog', { name: 'Codex' });
    await expect(codex).toBeVisible();
    await expect(codex.getByText(/entries found/)).toBeVisible();
    const breach = codex.getByRole('button', { name: /^The Temporal Breach, Remnant Archive/ });
    await expect(breach).toBeVisible();
    await press(breach, info);
    await expect(codex.getByRole('heading', { level: 3, name: 'The Temporal Breach' })).toBeVisible();
    await expect(codex.getByText('Year 500 of the Sundering')).toBeVisible();
    await expect(codex.getByText(/the hour tore and the city followed/)).toBeVisible();
    await expect(codex.getByText('Remnant Archive · History')).toBeVisible();
    expect(await unnamedControls(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);

    // back to the list on a phone; a locked entry shows no title, only a hint
    if (mobile(info)) await press(codex.getByRole('button', { name: 'Back to entries' }), info);
    const locked = codex.getByRole('button', { name: /^Locked entry, / }).first();
    await expect(locked).toBeVisible();
    await press(locked, info);
    await expect(codex.getByRole('heading', { level: 3, name: 'Locked entry' })).toBeVisible();
    await expect(codex.locator('.codex-entry__hint')).not.toBeEmpty();
    // the breach has been read: it is no longer new
    if (mobile(info)) await press(codex.getByRole('button', { name: 'Back to entries' }), info);
    await expect(codex.getByRole('button', { name: 'The Temporal Breach, Remnant Archive', exact: true })).toBeVisible();
    // filters
    await codex.getByLabel('Voice').selectOption('wayfinder_notes');
    await expect(codex.getByRole('button', { name: /Remnant Archive/ })).toHaveCount(0);
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(codex).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('the Title’s "Lore" opens the Codex without a game', async ({ page }, info) => {
    await page.goto('./');
    await press(page.getByRole('button', { name: 'Lore' }), info);
    const codex = page.getByRole('dialog', { name: 'Codex' });
    await expect(codex).toBeVisible();
    await expect(codex.getByRole('button', { name: /^The Temporal Breach/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(codex).toBeHidden();
  });
});

test.describe('bestiary', () => {
  const victory = (page: Page): Locator => page.getByRole('dialog', { name: 'Victory' });

  test('shows the creature in the fight at once, and records it with its first kill', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'first_fight', 'combat');
    // in a fight the panel key needs Shift; the creature on screen is listed before it is recorded
    await page.keyboard.press('Shift+B');
    const bestiary = page.getByRole('dialog', { name: 'Bestiary' });
    await expect(bestiary).toBeVisible();
    await expect(bestiary.getByRole('button', { name: /^Corrupted Shade, level 2, defeated 0, in this fight/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(bestiary).toBeHidden();

    for (let i = 0; i < 40; i++) {
      if (await victory(page).isVisible()) break;
      await page.keyboard.press('1');
      await expect.poll(async () => (await victory(page).isVisible()) || (await gameState(page)).combat?.phase === 'playerTurn').toBe(true);
    }
    await expect(victory(page)).toBeVisible();
    await press(victory(page).getByRole('button', { name: 'Continue' }), info);
    await expect(page.locator('[data-screen="explore"]')).toBeVisible();

    await openFromMenu(page, 'Bestiary', info);
    await expect(bestiary).toBeVisible();
    const shade = bestiary.getByRole('button', { name: /^Corrupted Shade, level 2, defeated 1/ });
    await expect(shade).toBeVisible();
    await press(shade, info);
    await expect(bestiary.getByRole('heading', { level: 3, name: 'Corrupted Shade' })).toBeVisible();
    await expect(bestiary.getByText(/^Weak to /).first()).toBeVisible(); // one kill teaches the resistances
    await expect(bestiary.getByText('Learned with more kills.')).toBeVisible(); // what is not known yet says so
    await expect(bestiary.getByText(/more times to learn its/)).toBeVisible();
    expect(await unnamedControls(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(bestiary).toBeHidden();
    expect(problems).toEqual([]);
  });
});
