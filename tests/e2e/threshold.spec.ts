// The loop's end and the Threshold between loops (U68; PLAN §6.3, §8.4; DESIGN §10.2–10.9, §15.3, §16.3, §16.7; STORY §10), on
// desktop and mobile, through accessible names and `?scenario=` boots (D-104 ruling 1):
//   - Loop 2's Let go at a camp → the closer's slides → the Run Summary → the Still Shore;
//   - at the Threshold (`loop2_end`): weave and equip an Attunement, turn on a modifier, change class, step into the light →
//     Loop 3 in the Ruins, with all three carried in;
//   - the Still Shore's people and summary, the Gallery, and the Loop Timeline and Achievements panels with content;
//   - an ending (`ending_a_ready` plus its last answer) through its slides, credits and epilogues, to New Game+ on offer;
//   - the in-repo a11y checks (names, 44 px targets, no sideways scroll, a keyboard walk) in each place.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface GameWindow {
  __aethelgard: {
    state: {
      mode: string;
      meta: { loop: number; modifiers: string[] };
      world: { currentLocationId: string };
      player: { classId: string; attunements?: string[]; level: number };
      pendingEnding: { outcome: string } | null;
    };
    store: { getProfile(): { resonance: number; attunements: { owned: string[]; equipped: string[] }; modifiers: Record<string, boolean>; endingsReached: string[] } };
    dispatch(action: unknown): unknown;
  };
}

const game = (page: Page): Promise<GameWindow['__aethelgard']['state']> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state);
const profile = (page: Page): Promise<ReturnType<GameWindow['__aethelgard']['store']['getProfile']>> =>
  page.evaluate(() => (window as unknown as GameWindow).__aethelgard.store.getProfile());

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');

async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
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

const place = (page: Page, name: string): Locator => page.getByRole('tab', { name, exact: true });

async function goTo(page: Page, name: string, heading: string, info: TestInfo): Promise<void> {
  await press(place(page, name), info);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(place(page, name)).toHaveAttribute('aria-selected', 'true');
}

/** Visible controls smaller than 44 × 44 CSS px (PLAN §6.7) inside `root`. */
async function smallTargets(page: Page, root: string): Promise<string[]> {
  return page.evaluate((r) => {
    const sel = ['button', 'summary', 'select', '[role="tab"]', 'a[href]'].map((s) => `${r} ${s}`).join(',');
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ el, box }) => `${el.outerHTML.slice(0, 90)} ${Math.round(box.width)}×${Math.round(box.height)}`);
  }, root);
}

async function unnamedControls(page: Page, root: string): Promise<string[]> {
  return page.evaluate((r) => {
    const textOf = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const nameOf = (el: HTMLElement): string => {
      const label = el.getAttribute('aria-label');
      if (label) return label.trim();
      const by = el.getAttribute('aria-labelledby');
      if (by) return by.split(/\s+/).map((id) => textOf(document.getElementById(id))).join(' ').trim();
      return textOf(el);
    };
    const sel = ['button', '[role="tab"]', 'summary', '[tabindex]:not([tabindex="-1"])'].map((s) => `${r} ${s}`).join(',');
    return [...document.querySelectorAll<HTMLElement>(sel)].filter((el) => el.getClientRects().length > 0 && nameOf(el) === '').map((el) => el.outerHTML.slice(0, 90));
  }, root);
}

const noHorizontalScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function checkScreen(page: Page, root: string, name: string): Promise<void> {
  expect(await smallTargets(page, root), `${name}: controls under 44 px`).toEqual([]);
  expect(await unnamedControls(page, root), `${name}: controls without a name`).toEqual([]);
  expect(await noHorizontalScroll(page), `${name}: page scrolls sideways`).toBe(true);
}

const dialog = (page: Page, name: string): Locator => page.getByRole('dialog', { name, exact: true });

test.describe('the loop’s end and the Threshold', () => {
  test('@smoke Let go at the camp → the closer’s slides → the Run Summary → the Still Shore', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop2_day1', 'explore');
    await press(page.getByRole('button', { name: /^\d: Camp/ }), info);
    await press(dialog(page, 'Camp').getByRole('button', { name: 'Let go', exact: true }), info);
    await press(page.getByRole('alertdialog').getByRole('button', { name: 'Let go', exact: true }), info);

    // the closer's screens: the Fall's lead-in, then the shear
    await expect(page.locator('[data-screen="ending"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'The Fall · Let go' })).toBeVisible();
    await expect(page.locator('.ending__text')).toContainText('You let the day go');
    await expect(page.locator('.ending__progress')).toHaveText(/^1 \/ \d+$/);
    await press(page.getByRole('button', { name: 'Continue', exact: true }), info);
    await expect(page.locator('.ending__progress')).toHaveText(/^2 \/ \d+$/);
    await expect(page.locator('.ending__text')).toContainText('The stillness breaks');
    expect((await game(page)).mode).toBe('ending');

    // then the Run Summary (DESIGN §15.3)
    await press(page.getByRole('button', { name: 'See how the loop went', exact: true }), info);
    await expect(page.locator('[data-phase="summary"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Loop 2 · Ranger' })).toBeVisible();
    await expect(page.getByText('Days used')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Echoes gained · 1' })).toBeVisible();
    await expect(page.getByText('The Amulet Remembers').first()).toBeVisible();
    await expect(page.getByTestId('summary-resonance')).toBeVisible();
    await expect(page.getByText('A game by Tim Dibert')).toBeVisible();
    await checkScreen(page, '[data-screen="ending"]', 'Run Summary');

    // and on: the Still Shore, at the Threshold
    await press(page.getByRole('button', { name: 'On to the Threshold', exact: true }), info);
    await expect(page.locator('[data-screen="threshold"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'The Still Shore' })).toBeVisible();
    expect((await game(page)).mode).toBe('threshold');
    await expect(page.getByText('The Threshold · before Loop 3')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('@smoke at the Threshold: weave and equip an Attunement, turn on a modifier, change class, step into the light → Loop 3 in the Ruins', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop2_end', 'threshold');
    const before = await profile(page);
    expect(before.resonance).toBe(100);

    // the Loom
    await goTo(page, 'Loom', 'The Loom', info);
    await expect(page.getByTestId('loom-resonance')).toHaveAttribute('aria-label', 'Resonance 100');
    const hand = page.locator('[data-attunement="att_steady_hand"]');
    await expect(hand).toContainText('Costs 20');
    await press(hand.getByRole('button', { name: 'Weave Steady Hand (20)' }), info);
    await expect(hand).toContainText('Owned');
    await expect(page.getByTestId('loom-resonance')).toHaveAttribute('aria-label', 'Resonance 80');
    await press(hand.getByRole('button', { name: 'Equip Steady Hand' }), info);
    await expect(hand).toContainText('Equipped');
    await expect(page.getByRole('list', { name: 'Attunement slots' }).getByText('Steady Hand')).toBeVisible();
    expect((await profile(page)).attunements).toEqual({ owned: ['att_steady_hand'], equipped: ['att_steady_hand'] });

    // an Attunement bought this visit can be unpicked; one not owned cannot be equipped
    await expect(hand.getByRole('button', { name: 'Unpick Steady Hand' })).toBeEnabled();
    const wizardless = page.locator('[data-attunement="att_deep_well"]');
    await expect(wizardless.getByRole('button', { name: 'Equip Deep Well' })).toHaveCount(0);

    // a challenge modifier
    const frayed = page.getByRole('button', { name: 'Frayed Clock, ×1.25 Resonance' });
    await expect(frayed).toHaveAttribute('aria-pressed', 'false');
    await press(frayed, info);
    await expect(frayed).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('loom-multiplier')).toHaveText('All together: ×1.25');
    expect((await profile(page)).modifiers).toEqual({ mod_frayed_clock: true });

    // the Far Light: another class, then the light
    await goTo(page, 'Far Light', 'The Far Light', info);
    const chosenClass = page.locator('.class-pick[aria-pressed="true"]');
    await expect(chosenClass).toHaveAttribute('data-class', 'ranger');
    const other = page.locator('.class-pick[aria-pressed="false"]').first();
    const otherId = (await other.getAttribute('data-class')) as string;
    await press(other, info);
    await expect(page.locator(`.class-pick[data-class="${otherId}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.class-detail')).toHaveAttribute('data-class', otherId);
    await expect(page.getByLabel('Carried into the next loop')).toContainText('Steady Hand');
    await expect(page.getByLabel('Carried into the next loop')).toContainText('Frayed Clock');
    await press(page.getByRole('button', { name: 'Step into the light: begin Loop 3' }), info);

    await expect(page.locator('[data-screen="explore"]')).toBeVisible();
    const state = await game(page);
    expect(state.mode).toBe('explore');
    expect(state.meta.loop).toBe(3);
    expect(state.world.currentLocationId).toBe('loc_whispering_ruins');
    expect(state.player.classId).toBe(otherId);
    expect(state.player.attunements).toEqual(['att_steady_hand']);
    expect(state.meta.modifiers).toEqual(['mod_frayed_clock']);
    expect(problems).toEqual([]);
  });

  test('the Still Shore: Dask is there to talk to; the Run summary reopens; the Gallery holds both loops; the Timeline and Achievements open with content', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'loop2_end', 'threshold');
    await expect(page.getByRole('heading', { level: 2, name: 'How you came' })).toBeVisible();
    await expect(page.getByLabel('How you came').getByText('Loop 2 · Ranger · Fall (released) · Day 1')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Echoes gained · 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Talk to Dask' })).toBeVisible();

    await press(page.getByRole('button', { name: 'Run summary' }), info);
    const summary = dialog(page, 'Run summary');
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('heading', { level: 2, name: 'Loop 2 · Ranger' })).toBeVisible();
    await expect(summary.getByText('The Fall · Let go').first()).toBeVisible();
    await press(summary.getByRole('button', { name: 'Close run summary' }), info);
    await expect(summary).toHaveCount(0);

    await goTo(page, 'Gallery', 'The Gallery of Loops', info);
    await expect(page.locator('.loop-card')).toHaveCount(2);
    await expect(page.locator('.loop-card[data-loop="2"]')).toContainText('The Fall · Let go');
    await expect(page.getByRole('heading', { level: 2, name: /^The Archive/ })).toBeVisible();
    await expect(page.getByText('Reached: 0 of 6')).toBeVisible();

    await press(page.getByRole('button', { name: 'Loop timeline' }), info);
    const timeline = dialog(page, 'Loop timeline');
    await expect(timeline).toBeVisible();
    await expect(timeline.getByRole('heading', { level: 3, name: 'Loop 1' })).toBeVisible();
    await expect(timeline.getByRole('heading', { level: 3, name: 'Loop 2' })).toBeVisible();
    await expect(timeline.getByRole('meter', { name: 'Loop 2 days' })).toHaveAttribute('aria-valuetext', 'Day 1 of 30');
    await expect(timeline.getByText('The Amulet Remembers')).toBeVisible();
    expect(await smallTargets(page, '[role="dialog"]')).toEqual([]);
    await press(timeline.getByRole('button', { name: 'Close loop timeline' }), info);

    await press(page.getByRole('button', { name: /^Achievements: 0 of 40/ }), info);
    const ach = dialog(page, 'Achievements');
    await expect(ach).toBeVisible();
    await expect(ach.getByTestId('achievements-count')).toHaveText('0 of 40 earned');
    await expect(ach.getByRole('list', { name: 'Achievements' }).getByRole('listitem')).toHaveCount(40);
    await expect(ach.getByRole('heading', { level: 3, name: 'First Steps' })).toBeVisible();
    await expect(ach.getByRole('heading', { level: 3, name: '???' }).first()).toBeVisible();
    expect(await smallTargets(page, '[role="dialog"]')).toEqual([]);
    await press(ach.getByRole('button', { name: 'Close achievements' }), info);
    await expect(ach).toHaveCount(0);

    // talking to Dask hands the screen to the Dialogue, as in the Explore
    await goTo(page, 'Still Shore', 'The Still Shore', info);
    await press(page.getByRole('button', { name: 'Talk to Dask' }), info);
    await expect(page.locator('[data-screen="dialogue"]')).toBeVisible();
    expect((await game(page)).mode).toBe('dialogue');
    expect(problems).toEqual([]);
  });

  test('keyboard: ←/→ walk the four places, L opens the timeline, Esc closes it', async ({ page }, info) => {
    test.skip(mobile(info), 'keys');
    await boot(page, 'loop2_end', 'threshold');
    await expect(place(page, 'Still Shore')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { level: 1, name: 'The Gallery of Loops' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { level: 1, name: 'The Loom' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { level: 1, name: 'The Far Light' })).toBeVisible();
    // the row wraps, as every tab row does
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { level: 1, name: 'The Still Shore' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('heading', { level: 1, name: 'The Far Light' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('heading', { level: 1, name: 'The Loom' })).toBeVisible();
    await page.keyboard.press('l');
    await expect(dialog(page, 'Loop timeline')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page, 'Loop timeline')).toHaveCount(0);
  });

  test('an ending: the slides, the credits, the summary, New Game+ on offer, then the Threshold', async ({ page }, info) => {
    const problems = watch(page);
    await boot(page, 'ending_a_ready', 'combat');
    await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.dispatch({ type: 'commune', act: 'speak', answerId: 'take_its_place' }));
    await expect(page.locator('[data-screen="ending"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: "The Warden's Vigil" })).toBeVisible();
    await expect(page.getByText('Ending A')).toBeVisible();
    expect((await game(page)).pendingEnding?.outcome).toBe('ending_wardens_vigil');

    // every slide in turn: the keyboard goes on with Enter, a phone with a tap on the same button
    let slides = 1;
    const total = Number((await page.locator('.ending__progress').innerText()).split('/')[1]);
    expect(total).toBeGreaterThan(3);
    while (slides < total) {
      await expect(page.locator('.ending__progress')).toHaveText(`${slides} / ${total}`);
      if (mobile(info)) await page.getByRole('button', { name: 'Continue', exact: true }).tap();
      else await page.keyboard.press('Enter');
      slides += 1;
    }
    await expect(page.locator('.ending__progress')).toHaveText(`${total} / ${total}`);
    await expect(page.locator('.ending__credits')).toHaveText('A game by Tim Dibert');
    await expect(page.locator('figure.ending__slide[data-kind="epilogue"]')).toBeVisible();
    await checkScreen(page, '[data-screen="ending"]', 'Ending slide');

    await press(page.getByRole('button', { name: 'See how the loop went', exact: true }), info);
    await expect(page.locator('[data-phase="summary"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Echoes gained · 2' }).or(page.getByRole('heading', { level: 3, name: /^Echoes gained/ }))).toBeVisible();
    await expect(page.getByRole('button', { name: 'Begin New Game+' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to the ending' })).toBeVisible();
    await checkScreen(page, '[data-screen="ending"]', 'Ending summary');

    await press(page.getByRole('button', { name: 'On to the Threshold', exact: true }), info);
    await expect(page.locator('[data-screen="threshold"]')).toBeVisible();
    expect((await profile(page)).endingsReached).toEqual(['ending_wardens_vigil']);
    await goTo(page, 'Loom', 'The Loom', info);
    await expect(page.getByRole('button', { name: 'Begin New Game+' })).toBeVisible(); // offered once an ending has been reached
    await goTo(page, 'Gallery', 'The Gallery of Loops', info);
    await expect(page.getByText('Reached: 1 of 6')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('a11y: each place has names, 44 px targets and no sideways scroll; one h1; a visible focus ring', async ({ page }, info) => {
    await boot(page, 'loop2_end', 'threshold');
    for (const [tab, heading] of [
      ['Still Shore', 'The Still Shore'],
      ['Gallery', 'The Gallery of Loops'],
      ['Loom', 'The Loom'],
      ['Far Light', 'The Far Light'],
    ] as const) {
      await goTo(page, tab, heading, info);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('tablist', { name: 'The four places' })).toBeVisible();
      await checkScreen(page, '[data-screen="threshold"]', heading);
    }
    // a 150 % text size still fits
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '150%';
    });
    await goTo(page, 'Loom', 'The Loom', info);
    expect(await noHorizontalScroll(page), 'Loom at 150 %').toBe(true);
    await goTo(page, 'Far Light', 'The Far Light', info);
    expect(await noHorizontalScroll(page), 'Far Light at 150 %').toBe(true);
    if (!mobile(info)) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => parseFloat(getComputedStyle(document.activeElement as HTMLElement).outlineWidth));
      expect(ring).toBeGreaterThanOrEqual(2);
    } else {
      // the places are a bar fixed to the bottom edge on a phone
      const box = await place(page, 'Loom').boundingBox();
      expect(box).not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(780);
    }
  });
});
