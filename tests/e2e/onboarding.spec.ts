// Onboarding, toasts and the Breach on the map (U70; DESIGN §16.8, §16.6, §16.7; D-120's open focus item), on desktop and
// mobile, through accessible names and `?scenario=` boots (D-104 ruling 1):
//   - the first fight's callouts in order (the intent, then Guard, lit), each cleared by acting, and not repeated after a reload;
//   - the first camp's callout (the Camp row lit) and, after the rest, the clock chip, once;
//   - Loop 2 Day 1 shows the Breach Clock callout alone; "Tutorials: off" shows none, and survives a reload;
//   - a toast on an item pickup and on the level-1 AP point; the toast's Dismiss;
//   - the Fall forecast (hatched Apex, a note) and then the running Horde (hatched infected places, the Library's way out);
//   - Menu → Saves → Esc returns focus to the Menu tab (D-120's open item);
//   - C4: a fresh Loop 1 from the Title, played through the UI alone to its first loop end (the Horde, the corridor, the Fall),
//     and the Breach Clock callout greeting Loop 2.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface GameWindow {
  __aethelgard: {
    state: { mode: string; meta: { loop: number }; clock: { ticks: number; limitTicks: number }; world: { currentLocationId: string; hordeActive: boolean }; combat: { phase: string; round: number } | null };
    store: { getState(): GameWindow['__aethelgard']['state'] };
  };
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

async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
}

const hint = (page: Page, title: string): Locator => page.getByRole('note', { name: `Hint: ${title}` });
const anyHint = (page: Page): Locator => page.getByRole('note');
const frame = (page: Page): Locator => page.locator('.app');
const tabBar = (page: Page): Locator => page.getByRole('navigation', { name: 'Game menu' });
const dialog = (page: Page, name: string): Locator => page.getByRole('dialog', { name });
const toasts = (page: Page): Locator => page.locator('.toasts');

async function boot(page: Page, scenario: string, screen: 'combat' | 'explore'): Promise<void> {
  await page.goto(`./?scenario=${scenario}`);
  await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
}

async function newGame(page: Page, seed: string): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByText('Seed (optional)').click();
  await page.getByRole('textbox', { name: 'Seed' }).fill(seed);
  await page.getByRole('button', { name: /^Begin as / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();
}

const outline = (target: Locator): Promise<string> => target.evaluate((el) => getComputedStyle(el).outlineStyle);

test.describe('onboarding', () => {
  test('the first fight: the intent hint, then Guard (lit); acting clears each, and a reload does not repeat them', async ({ page }, info) => {
    await boot(page, 'first_fight', 'combat');
    const intent = hint(page, 'Reading an intent');
    await expect(intent).toContainText('An intent shows what the enemy will do next: type, target, number.');
    await expect(frame(page)).toHaveAttribute('data-callout', 'intent');
    await expect(anyHint(page)).toHaveCount(1);

    // the first action clears the intent hint and the round turns: Guard is next, and its button is lit
    await press(page.getByRole('button', { name: /^1: Attack, at Corrupted Shade/ }), info);
    const guard = hint(page, 'Guard');
    await expect(guard).toContainText('Guard halves the number and builds your resource.');
    await expect(intent).toHaveCount(0);
    await expect(frame(page)).toHaveAttribute('data-callout', 'guard');
    expect(await outline(page.locator('[data-action="guard"]'))).toBe('dashed');

    await press(page.getByRole('button', { name: /^G: Guard/ }), info);
    await expect(guard).toHaveCount(0);
    await expect(frame(page)).not.toHaveAttribute('data-callout', 'guard');

    // what was read stays read
    await page.reload();
    await expect(page.locator('[data-screen="combat"]')).toBeVisible();
    // the reload boots the scenario again: the first Shade's opening intent, Wail (U81a, D-121)
    await expect(page.getByRole('img', { name: /^Intent: Wail/ })).toBeVisible();
    await expect(hint(page, 'Reading an intent')).toHaveCount(0);
    await press(page.getByRole('button', { name: /^1: Attack, at Corrupted Shade/ }), info);
    await expect.poll(async () => (await gameState(page)).combat?.round ?? 0).toBeGreaterThanOrEqual(2);
    await expect(hint(page, 'Guard')).toHaveCount(0);
  });

  test('"Got it" reads a hint; "Turn tutorials off" ends them all, and the Settings switch brings them back', async ({ page }, info) => {
    await boot(page, 'first_fight', 'combat');
    await press(hint(page, 'Reading an intent').getByRole('button', { name: 'Got it' }), info);
    await expect(anyHint(page)).toHaveCount(0);

    await press(page.getByRole('button', { name: /^1: Attack, at Corrupted Shade/ }), info);
    await expect(hint(page, 'Guard')).toBeVisible();
    await press(hint(page, 'Guard').getByRole('button', { name: 'Turn tutorials off' }), info);
    await expect(anyHint(page)).toHaveCount(0);

    // Settings (open in a fight) shows the switch off; none comes back after a reload
    await press(page.getByRole('button', { name: /Settings/ }).first(), info);
    const settings = dialog(page, 'Settings');
    await expect(settings.getByRole('checkbox', { name: 'Show tutorial hints' })).not.toBeChecked();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('[data-screen="combat"]')).toBeVisible();
    await expect(anyHint(page)).toHaveCount(0);

    // turn them back on in Settings and forget what was read: the first hint is back
    await press(page.getByRole('button', { name: /Settings/ }).first(), info);
    await press(dialog(page, 'Settings').getByRole('button', { name: 'Show the hints again' }), info);
    await expect(dialog(page, 'Settings').getByRole('checkbox', { name: 'Show tutorial hints' })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(hint(page, 'Reading an intent')).toBeVisible();
  });

  test('the first camp: the Camp row is lit; the rest clears it, and the clock chip is pointed out once', async ({ page }, info) => {
    await boot(page, 'loop1_emberforge', 'explore');
    const camp = hint(page, 'Camp');
    await expect(camp).toContainText('Resting carries you to the next dawn.');
    await expect(frame(page)).toHaveAttribute('data-callout', 'rest');
    expect(await outline(page.locator('[data-action-id="rest-full"]'))).toBe('dashed');
    await expect(hint(page, 'The clock')).toHaveCount(0);

    const before = (await gameState(page)).clock.ticks;
    await press(page.getByRole('button', { name: /^\d: Full rest/ }), info);
    await expect.poll(async () => (await gameState(page)).clock.ticks).toBeGreaterThan(before);
    await expect(camp).toHaveCount(0);
    const clock = hint(page, 'The clock');
    await expect(clock).toContainText('Days pass. Nothing more — for now.');
    await expect(frame(page)).toHaveAttribute('data-callout', 'clock');
    expect(await outline(page.getByTestId('clock-chip'))).toBe('dashed');

    // once: the next action reads it, and it does not return
    await press(clock.getByRole('button', { name: 'Got it' }), info);
    await expect(anyHint(page)).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-screen="explore"]')).toBeVisible();
    await expect(anyHint(page)).toHaveCount(0);
  });

  test('Loop 2 Day 1: the Breach Clock hint alone, even at a camp; once read it is gone', async ({ page }, info) => {
    await boot(page, 'loop2_day1', 'explore');
    const breach = hint(page, 'The Breach Clock');
    await expect(breach).toContainText('Loop Timeline');
    await expect(anyHint(page)).toHaveCount(1);
    await expect(frame(page)).toHaveAttribute('data-callout', 'clock');
    expect((await gameState(page)).meta.loop).toBeGreaterThanOrEqual(2);
    await press(breach.getByRole('button', { name: 'Got it' }), info);
    await expect(anyHint(page)).toHaveCount(0);
  });
});

test.describe('onboarding a11y', () => {
  test('a hint is a named note with 44 px controls; nothing scrolls sideways at 150 % text; reduced motion stills the glow', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, 'first_fight', 'combat');
    const note = hint(page, 'Reading an intent');
    await expect(note).toBeVisible();
    await expect(page.locator('.callouts')).toHaveAttribute('aria-live', 'polite');
    const small = await note.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('button')].map((b) => ({ name: b.textContent, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })).filter((b) => b.w < 44 || b.h < 44),
    );
    expect(small).toEqual([]);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '150%';
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    // no animation runs under reduced motion: neither the hint's entry nor the glow on the intent
    const moving = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && Number(a.effect?.getComputedTiming().duration ?? 0) > 150).length);
    expect(moving).toBe(0);
    // colour is not the only cue: the lit thing has an outline
    expect(await outline(page.locator('.enemy-card .intent').first())).toBe('dashed');
  });
});

test.describe('toasts', () => {
  test('a new game: the AP point is explained once; picking things up is a toast, which can be dismissed', async ({ page }, info) => {
    await newGame(page, 'onboarding');
    const ap = toasts(page).getByText(/^You have an ability point to spend\. Abilities open in tiers: more open at levels 4, 8, 12 and 16\.$/);
    await expect(ap).toBeVisible();
    await press(toasts(page).getByRole('button', { name: /^Dismiss: You have an ability point/ }), info);
    await expect(ap).toHaveCount(0);

    await press(page.getByRole('button', { name: /^\d: Take everything/ }), info);
    const picked = toasts(page).locator('.toast', { hasText: /^(Picked up|Received) / });
    await expect(picked.first()).toBeVisible();
    await expect(toasts(page)).toHaveAttribute('aria-live', 'polite');
    // it leaves by itself after a while (5 s)
    await expect(picked.first()).toBeHidden({ timeout: 9000 });

    // a reload keeps the AP point read: no second toast
    await page.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Menu' }).click();
    await expect(dialog(page, 'Menu')).toBeVisible();
    await expect(ap).toHaveCount(0);
  });
});

test.describe('the Breach on the map', () => {
  /** Moves the clock to `dawns` before the limit (a test-only edit of the live state), then a Look makes the screen redraw. */
  async function setDawnsLeft(page: Page, dawns: number): Promise<void> {
    await page.evaluate((d) => {
      const s = (window as unknown as GameWindow).__aethelgard.store.getState();
      s.clock.ticks = s.clock.limitTicks - d * 4;
    }, dawns);
  }

  test('five dawns out the Apex is hatched with a forecast note; at the limit the Horde’s hatch and the Library’s way out show', async ({ page }, info) => {
    // the scenario stands at the Apex with the Face it / Not yet prompt: "Not yet" goes back with nothing started
    await page.goto('./?scenario=pre_tyrant_l11_ranger');
    await press(page.getByRole('button', { name: /Not yet/ }).first(), info);
    await expect(page.locator('[data-screen="explore"]')).toBeVisible();

    await setDawnsLeft(page, 3);
    await press(page.getByRole('button', { name: /^\d: Look around/ }), info);
    await press(tabBar(page).getByRole('button', { name: 'Map' }), info);
    const map = dialog(page, 'Map');
    await expect(map.getByText(/^The Breach tears open in 3 dawns\./)).toBeVisible();
    await expect(map.getByRole('button', { name: /^The Temporal Breach Apex, .*the Horde will reach it/ })).toBeVisible();
    await expect(map.locator('.map-node--forecast').first()).toBeVisible();
    await expect(map.locator('.map-node--infected')).toHaveCount(0);
    await expect(map.getByText('Light hatch: the Horde is forecast to reach it', { exact: false })).toBeAttached();
    await page.keyboard.press('Escape');
    await expect(map).toHaveCount(0);

    // the limit: the clock expires, the Horde starts; hatched infected places and the way out, no forecast any more
    await setDawnsLeft(page, 1);
    await page.evaluate(() => {
      const s = (window as unknown as GameWindow).__aethelgard.store.getState();
      s.clock.ticks = s.clock.limitTicks - 1;
    });
    await press(page.getByRole('button', { name: /^\d: Wait/ }), info);
    await expect.poll(async () => (await gameState(page)).world.hordeActive).toBe(true);
    await throughScene(page); // the thirtieth dawn (STORY §13 `scene_clock_expiry`)
    await press(tabBar(page).getByRole('button', { name: 'Map' }), info);
    await expect(map.locator('.map-node--infected').first()).toBeVisible();
    await expect(map.getByRole('button', { name: /^The Temporal Breach Apex, .*infected/ })).toBeVisible();
    await expect(map.getByRole('button', { name: /^Shattered Library, .*the way out/ })).toBeVisible();
    await expect(map.locator('.map-node--forecast')).toHaveCount(0);
    await expect(map.getByText(/The Breach tears open/)).toHaveCount(0);
  });
});

test.describe('focus', () => {
  test('Menu → Saves → Esc: focus returns to the Menu tab; Menu → Esc too (D-120’s open item)', async ({ page }, info) => {
    await newGame(page, 'focus');
    const menuTab = tabBar(page).getByRole('button', { name: 'Menu' });
    await press(menuTab, info);
    await expect(dialog(page, 'Menu')).toBeVisible();
    await press(dialog(page, 'Menu').getByRole('button', { name: /^Saves/ }), info);
    await expect(dialog(page, 'Saves')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page, 'Saves')).toHaveCount(0);
    await expect(menuTab).toBeFocused();

    await press(menuTab, info);
    await press(dialog(page, 'Menu').getByRole('button', { name: /^Settings/ }), info);
    await expect(dialog(page, 'Settings')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menuTab).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog(page, 'Menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menuTab).toBeFocused();
  });

  test('a panel opened with nothing focused returns focus to the screen’s heading, not to the page', async ({ page }) => {
    test.skip(await page.evaluate(() => matchMedia('(hover: none)').matches), 'Ctrl+L needs a keyboard');
    await newGame(page, 'focus-none');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press('Control+l');
    await expect(dialog(page, 'Saves')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page, 'Saves')).toHaveCount(0);
    await expect(page.locator('#place-heading')).toBeFocused();
  });
});

test.describe('C4: a fresh Loop 1, from the Title to its first loop end, through the UI alone', () => {
  test('rest to the thirtieth dawn, meet the Horde in the corridor, fall, and Loop 2 opens with the Breach Clock hint', async ({ page }, info) => {
    test.setTimeout(120_000);
    await newGame(page, 'c4');
    // Loop 1 keeps the clock subtle: the chip shows the day and the watch, never a countdown
    const chip = page.getByTestId('clock-chip');
    await expect(chip).toContainText('Day 1 · Dawn');

    // Shift+R: a full rest, a whole day at a time, until the sky tears
    for (let i = 0; i < 40; i++) {
      const s = await gameState(page);
      if (s.world.hordeActive) break;
      if (s.mode === 'dialogue') await throughScene(page); // a scene a rest's dawn opened
      expect(s.mode).toBe('explore');
      const ticks = s.clock.ticks;
      await page.keyboard.press('Shift+R');
      await expect.poll(async () => (await gameState(page)).clock.ticks).toBeGreaterThan(ticks);
    }
    expect((await gameState(page)).world.hordeActive).toBe(true);
    await throughScene(page); // the thirtieth dawn (STORY §13 `scene_clock_expiry`)
    await expect(chip).toContainText('Day 30');

    // the way out is the Shattered Library: Ruins → Crumbling Archway → Darkened Corridor, where the Horde stands
    const goTo = async (name: string): Promise<void> => {
      await press(page.getByRole('navigation', { name: 'Ways on' }).getByRole('button', { name: new RegExp(name) }), info);
    };
    await goTo('Crumbling Archway');
    await expect.poll(async () => (await gameState(page)).world.currentLocationId).toBe('loc_crumbling_archway');
    await goTo('Darkened Corridor');
    await expect.poll(async () => (await gameState(page)).mode).toBe('combat');
    await expect(page.locator('[data-screen="combat"]')).toBeVisible();

    // fight on with the keyboard until the loop ends (the Horde's husks are far past a Level 1 Wayfinder)
    for (let i = 0; i < 60 && (await gameState(page)).meta.loop === 1; i++) {
      const s = await gameState(page);
      if (s.mode === 'combat') await page.keyboard.press(s.combat?.phase === 'playerTurn' ? '1' : 'Shift');
      else if (s.mode === 'ending') {
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(60);
    }
    // the ending slides and the run summary may need a few Enters / Continue presses; the Threshold is skipped in Loop 1
    for (let i = 0; i < 40 && (await gameState(page)).mode !== 'explore'; i++) {
      const next = page.getByRole('button', { name: /^(Continue|Next|Begin|Enter|Step|Start|Onward|Carry on)/i }).first();
      if (await next.isVisible().catch(() => false)) await next.click().catch(() => undefined);
      else await page.keyboard.press('Enter');
      await page.waitForTimeout(80);
    }
    const loop2 = await gameState(page);
    expect(loop2.mode).toBe('explore');
    expect(loop2.meta.loop).toBe(2);
    await expect(hint(page, 'The Breach Clock')).toBeVisible();
    await expect(anyHint(page)).toHaveCount(1);
  });
});
