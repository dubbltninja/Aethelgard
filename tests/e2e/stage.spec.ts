// The combat stage, sprites and portraits (U73a; docs/ART-2.md §7; D-128) on desktop and mobile, with the fixture figures the
// e2e build ships (tests/fixtures/art/sprites and portraits: the five classes, Ilyra and Brak, the Shade, the Prowler, the
// Brute, the Arcane Wisp, the Aberration, the Tyrant's Reach, both Tyrants and the Bell-Warden at their size classes;
// `cr_rootling` left out on purpose). The first fight stands the player and the Shade on the stage; a sprite click targets as
// the cards and ← / → do; a hit flashes and floats its number, and under reduced motion nothing on the stage moves; the Tyrant
// stands huge and unclipped; an anomaly wears its base sprite with its effect; a missing or failing sprite shows its sigil;
// Dialogue shows Ilyra's portrait over the dimmed painting; and nothing scrolls sideways at 1.5× text.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface GameWindow {
  __aethelgard: {
    state: { mode: string; combat: { phase: string; round: number; enemies: { uid: string }[] } | null };
    store: { getProfile(): unknown };
  };
}

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');
const stage = (page: Page): Locator => page.locator('.combat-stage');
const fig = (page: Page, uid: string): Locator => stage(page).locator(`[data-uid="${uid}"]`);

async function press(target: Locator, info: TestInfo): Promise<void> {
  if (mobile(info)) await target.tap();
  else await target.click();
}

async function boot(page: Page, scenario: string): Promise<void> {
  await page.goto(`./?scenario=${scenario}`);
  await expect(page.locator('[data-screen="combat"]')).toBeVisible();
  await expect(stage(page)).toBeVisible();
}

async function combatState(page: Page): Promise<NonNullable<GameWindow['__aethelgard']['state']['combat']>> {
  const c = await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.combat);
  if (c === null) throw new Error('not in a fight');
  return c;
}

interface Reshape {
  /** Replace the first enemy's creature (an anomaly over a base sprite). */
  first?: { refId: string; name: string };
  /** More enemies, cloned from the first. */
  more?: { refId: string; name: string }[];
  /** Ilyra in the party. */
  companion?: boolean;
}

/**
 * Reshape the running fight (the scenarios have one enemy and no companion). A save cannot be loaded in the middle of a fight,
 * so the edited state boots through the e2e build's `?start=session` seam (src/main.tsx).
 */
async function reshape(page: Page, o: Reshape): Promise<void> {
  await page.evaluate((opts: Reshape) => {
    const game = (window as unknown as GameWindow).__aethelgard;
    type Bag = Record<string, unknown>;
    const s = structuredClone(game.state) as unknown as Bag;
    const c = s.combat as { enemies: Bag[]; party: Bag[]; turnOrder: string[]; intents: Record<string, Bag> };
    const first = c.enemies[0] as Bag;
    const intent = c.intents[first.uid as string];
    if (opts.first !== undefined) Object.assign(first, opts.first);
    (opts.more ?? []).forEach((e, i) => {
      const uid = `c${90 + i}`;
      c.enemies.push({ ...structuredClone(first), ...e, uid });
      c.turnOrder.push(uid);
      if (intent !== undefined) c.intents[uid] = { ...intent };
    });
    if (opts.companion === true) {
      const you = c.party[0] as Bag;
      c.party.push({ ...structuredClone(you), uid: 'c99', kind: 'companion', refId: 'ilyra', name: 'Ilyra', hp: 40, hpMax: 40, mp: 0, mpMax: 0, statuses: [], cooldowns: {} });
      c.turnOrder.push('c99');
      s.companions = {
        recruited: { ilyra: { id: 'ilyra', recruited: true, loyalty: 30, hp: 40, hpMax: 40, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} } },
        activeId: 'ilyra',
      };
    }
    sessionStorage.setItem('aethelgard.e2e.start', JSON.stringify({ state: s, profile: game.store.getProfile() }));
  }, o);
  await page.goto('./?start=session');
  await expect(page.locator('[data-screen="combat"]')).toBeVisible();
  await expect(stage(page)).toBeVisible();
}

/** The four-enemy fight: the Shade, a Rootling (no file), a Brute and a Wisp, with Ilyra beside you. */
async function fourFight(page: Page): Promise<string[]> {
  await boot(page, 'first_fight');
  await reshape(page, {
    more: [
      { refId: 'cr_rootling', name: 'Rootling' },
      { refId: 'cr_wildling_brute', name: 'Wildling Brute' },
      { refId: 'cr_arcane_wisp', name: 'Arcane Wisp' },
    ],
    companion: true,
  });
  await expect(stage(page).locator('.stage-fig--enemy')).toHaveCount(4);
  return (await combatState(page)).enemies.map((e) => e.uid);
}

/** A figure's sprite has loaded: its file and stored height. */
async function loaded(figure: Locator): Promise<{ file: string; height: number }> {
  const img = figure.locator('img.sprite__main');
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalHeight > 0)).toBe(true);
  return img.evaluate((el: HTMLImageElement) => ({ file: el.currentSrc.replace(/^.*\/art\//, 'art/'), height: el.naturalHeight }));
}

const rect = (l: Locator) => l.evaluate((el) => el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number });

async function noSidewaysScroll(page: Page): Promise<boolean> {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '150%';
  });
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test.describe('the combat stage', () => {
  test('the first fight: the painting behind, the player facing right, the Shade facing left with its badge and the ring', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(m.text());
    });
    await boot(page, 'first_fight');
    await expect(stage(page).locator('.scene')).toHaveCount(1);
    const you = stage(page).locator('[data-role="player"]');
    expect(await loaded(you)).toEqual({ file: 'art/sprites/class_ranger.webp', height: 384 });
    await expect(you.locator('.sprite')).not.toHaveClass(/sprite--flip/);
    const shade = stage(page).getByRole('button', { name: /^Target Corrupted Shade, level 2/ });
    expect(await loaded(shade)).toEqual({ file: 'art/sprites/cr_corrupted_shade.webp', height: 384 });
    await expect(shade).toHaveAttribute('aria-pressed', 'true');
    await expect(shade.locator('.stage-fig__ring')).toHaveCount(1);
    await expect(shade.locator('.stage-fig__badge svg.creature-sigil')).toHaveCount(1);
    // no companion in this fight
    await expect(stage(page).locator('[data-role="companion"]')).toHaveCount(0);
    // heroes left, enemies right, both on the floor, inside the band
    const band = await rect(stage(page));
    const a = await rect(you);
    const b = await rect(shade);
    expect(a.x + a.width).toBeLessThan(b.x);
    expect(Math.abs(a.y + a.height - (b.y + b.height))).toBeLessThan(2);
    for (const r of [a, b]) {
      expect(r.x).toBeGreaterThanOrEqual(band.x - 0.5);
      expect(r.y).toBeGreaterThanOrEqual(band.y - 0.5);
      expect(r.x + r.width).toBeLessThanOrEqual(band.x + band.width + 0.5);
      expect(r.y + r.height).toBeLessThanOrEqual(band.y + band.height + 0.5);
    }
    // the cards stay below for the numbers
    await expect(page.locator('.combat__enemies').getByRole('meter', { name: 'Corrupted Shade HP' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('a sprite click targets it, in step with ← / → and the cards; Ilyra stands beside you', async ({ page }, info) => {
    const uids = await fourFight(page);
    expect(await loaded(stage(page).locator('[data-role="companion"]'))).toEqual({ file: 'art/sprites/companion_ilyra.webp', height: 384 });
    const brute = fig(page, uids[2] as string);
    await press(brute, info);
    await expect(brute).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.combat__enemies').getByRole('button', { name: /^Target Wildling Brute/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^1: Attack, at Wildling Brute/ })).toBeVisible();
    await expect(stage(page).locator('.stage-fig__ring')).toHaveCount(1);
    await expect(brute.locator('.stage-fig__ring')).toHaveCount(1);
    // the card selects the stage's figure too
    await press(page.locator('.combat__enemies').getByRole('button', { name: /^Target Arcane Wisp/ }), info);
    await expect(fig(page, uids[3] as string)).toHaveAttribute('aria-pressed', 'true');
    await expect(brute).toHaveAttribute('aria-pressed', 'false');
    if (!mobile(info)) {
      await page.keyboard.press('ArrowRight'); // wraps to the first
      await expect(fig(page, uids[0] as string)).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('ArrowLeft');
      await expect(fig(page, uids[3] as string)).toHaveAttribute('aria-pressed', 'true');
    }
    // the sprites are out of the Tab order: the cards already carry the same control
    await expect(brute).toHaveAttribute('tabindex', '-1');
  });

  test('a hit flashes and floats its number from the figure', async ({ page }) => {
    await boot(page, 'first_fight');
    const flashed = stage(page).locator('.stage-fig[class*="stage-fig--hit-"]');
    for (let i = 0; i < 8 && (await flashed.count()) === 0; i++) {
      const round = (await combatState(page)).round;
      await page.keyboard.press('1');
      await expect.poll(async () => (await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.combat?.round ?? 99)) > round).toBe(true);
    }
    await expect(flashed.first()).toBeAttached();
    await expect(stage(page).locator('.stage-float').first()).toBeAttached();
    // the attacker stepped in
    await expect(stage(page).locator('.stage-fig[class*="stage-fig--lunge-"]').first()).toBeAttached();
  });

  test('reduced motion: nothing on the stage moves — no bob, no lunge, no flash, no number', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, 'first_fight');
    await expect(stage(page)).toHaveAttribute('data-motion', 'off');
    for (let i = 0; i < 3; i++) {
      const round = (await combatState(page)).round;
      await page.keyboard.press('1');
      await expect.poll(async () => (await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.combat?.round ?? 99)) > round).toBe(true);
    }
    await expect(stage(page).locator('.stage-fig[class*="stage-fig--"]').and(stage(page).locator('[class*="--hit-"], [class*="--lunge-"]'))).toHaveCount(0);
    await expect(stage(page).locator('.stage-float')).toHaveCount(0);
    const moving = await page.evaluate(() => document.getAnimations().filter((a) => ((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest('.combat-stage') != null).length);
    expect(moving).toBe(0);
  });

  test('the Tyrant stands huge, whole inside the band, over its add and over you', async ({ page }) => {
    await boot(page, 'combat_tyrant_contained_p2');
    const tyrant = stage(page).getByRole('button', { name: /^Target The Chronos Tyrant, level \d+, boss/ });
    await expect(tyrant).toHaveAttribute('data-size', 'huge');
    expect(await loaded(tyrant)).toEqual({ file: 'art/sprites/cr_chronos_tyrant_contained.webp', height: 768 });
    const add = stage(page).getByRole('button', { name: /^Target Temporal Aberration/ });
    await expect(add).toHaveAttribute('data-size', 'large');
    const band = await rect(stage(page));
    const t = await rect(tyrant);
    const img = await rect(tyrant.locator('img.sprite__main'));
    for (const r of [t, img]) {
      expect(r.y).toBeGreaterThanOrEqual(band.y - 0.5);
      expect(r.x).toBeGreaterThanOrEqual(band.x - 0.5);
      expect(r.x + r.width).toBeLessThanOrEqual(band.x + band.width + 0.5);
      expect(r.y + r.height).toBeLessThanOrEqual(band.y + band.height + 0.5);
    }
    const a = await rect(add);
    const you = await rect(stage(page).locator('[data-role="player"]'));
    expect(t.height).toBeGreaterThan(a.height);
    expect(a.height).toBeGreaterThan(you.height);
    expect(t.height).toBeGreaterThan(band.height * 0.7);
    expect(await noSidewaysScroll(page)).toBe(true);
  });

  test('an anomaly wears its base sprite with its effect', async ({ page }) => {
    await boot(page, 'first_fight');
    await reshape(page, { first: { refId: 'cr_anomaly_echoed_shade', name: 'Echoed Shade' } });
    const echoed = stage(page).getByRole('button', { name: /^Target Echoed Shade/ });
    expect(await loaded(echoed)).toEqual({ file: 'art/sprites/cr_corrupted_shade.webp', height: 384 });
    await expect(echoed.locator('.sprite')).toHaveAttribute('data-effect', 'doubled');
    await expect(echoed.locator('img')).toHaveCount(2); // the figure and its ghost
  });

  test('a missing sprite shows the sigil; a sprite that fails to load swaps to it', async ({ page }) => {
    await page.route('**/art/sprites/cr_wildling_brute.webp', (route) => route.fulfill({ status: 404, body: '' }));
    const uids = await fourFight(page);
    const rootling = fig(page, uids[1] as string);
    await expect(rootling.locator('.sprite')).toHaveAttribute('data-art', 'sigil');
    await expect(rootling.locator('svg.creature-sigil')).toHaveCount(2); // the figure is the sigil, plus its badge
    await expect(rootling.locator('img')).toHaveCount(0);
    const brute = fig(page, uids[2] as string);
    await expect(brute.locator('.sprite')).toHaveAttribute('data-art', 'sigil');
    await expect(brute.locator('.sprite__fallback svg.creature-sigil')).toBeVisible();
    await expect(brute.locator('img.sprite__main')).toBeHidden();
    // the wisp and the Shade are drawn
    expect((await loaded(fig(page, uids[3] as string))).height).toBe(256);
    expect(await noSidewaysScroll(page)).toBe(true);
  });
});

test.describe('portraits and figures elsewhere', () => {
  test('Dialogue shows Ilyra’s painted portrait over the dimmed painting of the place', async ({ page }, info) => {
    await page.goto('./?scenario=loop1_day1');
    await expect(page.locator('[data-screen="explore"]')).toBeVisible();
    // Explore's row shows her small portrait
    const row = page.locator('.here-chip--npc').filter({ hasText: 'Ilyra' });
    await expect(row.locator('.portrait img')).toHaveAttribute('src', /npc_ilyra@sm\.webp$/);
    await press(page.getByRole('button', { name: /^Talk to Ilyra/ }), info);
    await expect(page.locator('[data-screen="dialogue"]')).toBeVisible();
    const portrait = page.locator('.dialogue__portrait .portrait img');
    await expect.poll(() => portrait.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(512);
    await expect(page.locator('.dialogue__stage')).toHaveClass(/dialogue__stage--painted/);
    const backdrop = page.locator('.dialogue__backdrop img');
    await expect(backdrop).toBeAttached();
    expect(await backdrop.evaluate((el) => getComputedStyle(el).filter)).toContain('brightness');
    expect(await noSidewaysScroll(page)).toBe(true);
  });

  test('Class Select stands each class as its sprite', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'New game' }).click();
    const card = page.locator('.class-card[data-class="wizard"]');
    await expect(card.locator('img.sprite__main')).toHaveAttribute('src', /class_wizard\.webp$/);
    await page.getByRole('radio', { name: 'Wizard' }).check();
    await expect(page.getByRole('radio', { name: 'Wizard' })).toBeChecked();
  });
});
