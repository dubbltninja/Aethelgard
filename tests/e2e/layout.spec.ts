// A stable, thumb-friendly layout (U84a, D-147): the controls a player reaches for never move under the hand.
//   - The movement pad: every direction has a fixed slot, so across moves to places with different exits each slot keeps its
//     box (±1 px), and an absent direction keeps its (empty) slot.
//   - Combat: Attack, Guard, Item and the first ability (the Abilities opener on a phone) keep their boxes across turns,
//     through a boss's phase change and its banner.
//   - Phones: in explore and in a fight the page itself does not scroll; the text scrolls inside its own region.
//   - Toasts never cover the HUD clock, the map or the pad.
// On desktop (1280 × 800) and on phones (390 × 844, 390 × 664, and 844 × 390 landscape).
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';
import { GameDriver } from './helpers/driver';

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SLOTS = ['north', 'south', 'east', 'west', 'up', 'down', 'in', 'out', 'portal', 'path'] as const;

async function boxOf(target: Locator): Promise<Box> {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

function expectSame(a: Box, b: Box, what: string): void {
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(a[k] - b[k]), `${what}: ${k} ${a[k].toFixed(1)} → ${b[k].toFixed(1)}`).toBeLessThanOrEqual(1);
}

/** Every pad slot's box, keyed by direction, and the directions that have a way on right now. */
async function padState(page: Page): Promise<{ boxes: Record<string, Box>; open: string[] }> {
  const pad = page.getByRole('navigation', { name: 'Ways on' });
  await expect(pad).toBeVisible();
  const boxes: Record<string, Box> = {};
  for (const dir of SLOTS) {
    const slot = pad.locator(`[data-pad-slot="${dir}"]`);
    await expect(slot, `the ${dir} slot is always there`).toHaveCount(1);
    boxes[dir] = await boxOf(slot);
    expect(boxes[dir].w, `the ${dir} slot has a size`).toBeGreaterThan(0);
  }
  const open = await pad.locator('[data-pad-slot] button[data-exit-dir]').evaluateAll((els) => els.map((el) => el.getAttribute('data-exit-dir') ?? ''));
  return { boxes, open: open.sort() };
}

const pageScrolls = (page: Page): Promise<{ sh: number; ih: number }> =>
  page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight }));

async function expectNoPageScroll(page: Page, what: string): Promise<void> {
  const { sh, ih } = await pageScrolls(page);
  expect(sh, `${what}: the page itself does not scroll (scrollHeight ${sh} > innerHeight ${ih})`).toBeLessThanOrEqual(ih);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${what}: no sideways scroll`).toBe(true);
}

/** Walks `moves` steps from the current place, preferring places not yet seen, and fights or talks through whatever happens. */
async function walk(g: GameDriver, moves: number, onArrive: (step: number) => Promise<void>): Promise<void> {
  const { page } = g;
  const seen = new Set<string>([(await g.state()).world.currentLocationId]);
  for (let step = 1; step <= moves; step++) {
    const pad = page.getByRole('navigation', { name: 'Ways on' });
    const exits = await pad.locator('button[data-exit-to]:not([aria-disabled="true"])').evaluateAll((els) => els.map((el) => el.getAttribute('data-exit-to') ?? ''));
    expect(exits.length, `step ${step}: a way on`).toBeGreaterThan(0);
    const to = exits.find((id) => !seen.has(id)) ?? (exits[0] as string);
    seen.add(to);
    await g.press(pad.locator(`button[data-exit-to="${to}"]`));
    await expect.poll(async () => (await g.state()).world.currentLocationId).toBe(to);
    for (let guard = 0; guard < 6 && (await g.mode()) !== 'explore'; guard++) {
      if ((await g.mode()) === 'combat') {
        expect(await g.fight({ abilities: true }), `step ${step}: a fight on the way`).not.toBe('defeat');
        if (await g.victory().isVisible()) await g.continueVictory();
      } else if ((await g.mode()) === 'dialogue') {
        await g.throughScenes();
      }
    }
    expect(await g.mode()).toBe('explore');
    await g.tutorialsOff();
    await onArrive(step);
  }
}

// ---- the movement pad ------------------------------------------------------------------------------------------------------

function padSuite(label: string): void {
  test(`${label}: every pad slot keeps its box across five moves to places with different exits`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const g = new GameDriver(page, info).watch();
    await g.boot('loop1_emberforge', 'explore');
    await g.tutorialsOff();
    const first = await padState(page);
    const sets = new Set<string>([first.open.join(',')]);
    if (mobile(info)) await expectNoPageScroll(page, 'explore');
    await walk(g, 5, async (step) => {
      const now = await padState(page);
      sets.add(now.open.join(','));
      for (const dir of SLOTS) expectSame(first.boxes[dir] as Box, now.boxes[dir] as Box, `step ${step}, ${dir} (${now.open.includes(dir) ? 'open' : 'absent'})`);
      if (mobile(info)) await expectNoPageScroll(page, `explore, step ${step}`);
    });
    expect(sets.size, `the walk crossed different exit sets: ${[...sets].join(' | ')}`).toBeGreaterThan(1);
    g.expectClean();
  });
}

test.describe('the movement pad', () => {
  padSuite('this viewport');
});

test.describe('the movement pad on a short phone', () => {
  test.use({ viewport: { width: 390, height: 664 } });
  test.beforeEach(({}, info) => test.skip(!mobile(info), 'a phone size'));
  padSuite('390 × 664');
});

test.describe('the movement pad on a phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test.beforeEach(({}, info) => test.skip(!mobile(info), 'a phone size'));
  padSuite('844 × 390');
});

// ---- combat ----------------------------------------------------------------------------------------------------------------

function turnControls(page: Page, info: TestInfo): Record<string, Locator> {
  const controls: Record<string, Locator> = {
    attack: page.getByRole('button', { name: /^1: Attack/ }),
    guard: page.getByRole('button', { name: /^G: Guard/ }),
    item: page.getByRole('button', { name: /^I: Item/ }),
  };
  controls.ability = mobile(info) ? page.locator('#dock-slot').getByRole('button', { name: /^Abilities, / }) : page.getByRole('button', { name: /^2: / });
  return controls;
}

async function controlBoxes(controls: Record<string, Locator>): Promise<Record<string, Box>> {
  const out: Record<string, Box> = {};
  for (const [name, loc] of Object.entries(controls)) {
    await expect(loc, name).toHaveCount(1);
    await expect(loc, name).toBeVisible();
    out[name] = await boxOf(loc);
  }
  return out;
}

const bossPhase = (g: GameDriver): Promise<number> =>
  g.page.evaluate(() => (window as unknown as { __aethelgard: { state: { combat: { enemies: { phase: number }[] } | null } } }).__aethelgard.state.combat?.enemies[0]?.phase ?? -1);

function combatSuite(label: string): void {
  test(`${label}: Attack, Guard, Item and the first ability keep their boxes for six turns, through a phase change and its banner`, async ({ page }, info) => {
    test.setTimeout(90_000);
    const g = new GameDriver(page, info).watch();
    await g.boot('combat_bell_warden_p2', 'combat', 'level=16');
    await g.tutorialsOff();
    const banner = page.getByRole('complementary', { name: 'What changed' });
    await expect(banner).toBeVisible();
    const controls = turnControls(page, info);
    const first = await controlBoxes(controls);
    if (mobile(info)) await expectNoPageScroll(page, 'a boss fight');
    const startPhase = await bossPhase(g);
    let phaseChanged = false;
    let turns = 0;
    for (let turn = 1; turn <= 6; turn++) {
      const round = (await g.state()).combat?.round ?? 0;
      await g.press(turn % 3 === 2 ? controls.guard! : controls.attack!);
      await expect.poll(async () => {
        const s = await g.state();
        return s.combat === null || s.combat.phase !== 'playerTurn' ? 'wait' : s.combat.round > round ? 'next' : 'wait';
      }, { timeout: 20_000 }).toBe('next').catch(() => undefined);
      const s = await g.state();
      if (s.combat === null || s.combat.phase !== 'playerTurn') break;
      turns = turn;
      if ((await bossPhase(g)) !== startPhase) phaseChanged = true;
      const now = await controlBoxes(controls);
      for (const name of Object.keys(first)) expectSame(first[name] as Box, now[name] as Box, `turn ${turn}, ${name}`);
      if (mobile(info)) await expectNoPageScroll(page, `a boss fight, turn ${turn}`);
    }
    expect(turns, 'turns played').toBeGreaterThanOrEqual(4);
    expect(phaseChanged, 'the boss changed phase during the turns').toBe(true);
    g.expectClean();
  });

  test(`${label}: the whole turn fits — the stage, the target's intent, both HP bars and the controls`, async ({ page }, info) => {
    const g = new GameDriver(page, info).watch();
    await g.boot('first_fight', 'combat');
    const parts = [
      page.locator('.combat-stage'),
      page.locator('.combat__enemies .intent').first(),
      page.getByRole('meter', { name: 'Corrupted Shade HP' }),
      ...Object.values(turnControls(page, info)).slice(0, 3),
    ];
    const height = page.viewportSize()?.height ?? 0;
    for (const part of parts) {
      await expect(part.first()).toBeVisible();
      const b = await boxOf(part.first());
      expect(b.y, 'starts on screen').toBeGreaterThanOrEqual(0);
      expect(b.y + b.h, 'ends on screen').toBeLessThanOrEqual(height + 1);
    }
    // the player's HP: the panel's meter on a desktop, the dock's copy on a phone
    const hp = mobile(info) ? page.locator('#dock-slot .phone-vitals .meter--hp') : page.getByRole('meter', { name: /^HP$/ });
    const b = await boxOf(hp.first());
    expect(b.y + b.h).toBeLessThanOrEqual(height + 1);
    expect(b.y).toBeGreaterThanOrEqual(0);
    if (mobile(info)) await expectNoPageScroll(page, 'the first fight');
    g.expectClean();
  });
}

test.describe('combat controls', () => {
  combatSuite('this viewport');
});

test.describe('combat controls on a short phone', () => {
  test.use({ viewport: { width: 390, height: 664 } });
  test.beforeEach(({}, info) => test.skip(!mobile(info), 'a phone size'));
  combatSuite('390 × 664');
});

// ---- phones: one screen per view -------------------------------------------------------------------------------------------

for (const size of [
  { width: 390, height: 844 },
  { width: 390, height: 664 },
  { width: 844, height: 390 },
]) {
  test.describe(`one screen per view at ${size.width} × ${size.height}`, () => {
    test.use({ viewport: size });
    test.beforeEach(({}, info) => test.skip(!mobile(info), 'phones'));

    test('explore and combat: the page does not scroll; the text scrolls inside its own region', async ({ page }, info) => {
      const g = new GameDriver(page, info).watch();
      await g.boot('loop1_emberforge', 'explore');
      await g.tutorialsOff();
      await expectNoPageScroll(page, 'explore');
      // the narration region scrolls by itself, and scrolling it leaves the page where it is
      const region = page.locator('[data-scroll-region="explore"]');
      await expect(region).toBeVisible();
      expect(await region.evaluate((el) => getComputedStyle(el).overflowY)).toMatch(/auto|scroll/);
      await region.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      // the people, things and actions are one tap away
      await expect(page.getByRole('region', { name: 'What you can do' })).toBeAttached();
      await expect(page.getByRole('navigation', { name: 'Ways on' })).toBeInViewport();

      await g.boot('combat_bell_warden_p2', 'combat');
      await g.tutorialsOff();
      await expectNoPageScroll(page, 'a boss fight');
      await g.boot('first_fight', 'combat');
      await expectNoPageScroll(page, 'the first fight, with its hint');
      g.expectClean();
    });
  });
}

// ---- desktops: one screen, the width used ----------------------------------------------------------------------------------

for (const size of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test.describe(`one screen on a desktop at ${size.width} × ${size.height}`, () => {
    test.use({ viewport: size });
    test.beforeEach(({}, info) => test.skip(mobile(info), 'desktops'));

    test('explore, a boss fight and the big panels fit the screen; the columns use the width', async ({ page }, info) => {
      const g = new GameDriver(page, info).watch();
      await g.boot('loop1_emberforge', 'explore');
      await g.tutorialsOff();
      await expectNoPageScroll(page, 'explore');
      // three columns from 1200 px: the place, then the map / who is here / the log, then the actions and the pad
      await expect(page.locator('.explore[data-layout="triple"]')).toBeVisible();
      const place = await boxOf(page.locator('.place__scene'));
      const middle = await boxOf(page.locator('.explore__middle'));
      const pad = await boxOf(page.getByRole('navigation', { name: 'Ways on' }));
      expect(place.x + place.w, 'the scene is left of the middle column').toBeLessThanOrEqual(middle.x);
      expect(middle.x + middle.w, 'the middle column is left of the pad').toBeLessThanOrEqual(pad.x);
      // no big empty gutters: the screen's content spans nearly the whole width
      const used = await page.locator('.explore').evaluate((el) => el.getBoundingClientRect().width);
      expect(used / size.width, 'the explore screen uses the width').toBeGreaterThan(0.95);
      // the words, the log and the actions scroll inside their own regions
      for (const sel of ['[data-scroll-region="explore"]', '.explore__middle .event-log__list', '.explore__actions']) {
        expect(await page.locator(sel).evaluate((el) => getComputedStyle(el).overflowY), sel).toMatch(/auto|scroll/);
      }

      // a panel uses the width too and scrolls inside itself
      await page.locator('#place-heading').focus();
      await page.keyboard.press('c');
      const codex = g.dialog('Codex');
      await expect(codex).toBeVisible();
      const panel = await boxOf(codex);
      expect(panel.w / size.width, 'the Codex uses the width').toBeGreaterThan(0.85);
      expect(panel.y + panel.h).toBeLessThanOrEqual(size.height);
      await expectNoPageScroll(page, 'the Codex');
      await page.keyboard.press('Escape');

      await g.boot('combat_bell_warden_p2', 'combat');
      await g.tutorialsOff();
      await expectNoPageScroll(page, 'a boss fight');
      const stage = await boxOf(page.locator('.combat-stage'));
      expect(stage.w / size.width, 'the stage runs across the top').toBeGreaterThan(0.9);
      for (const part of [page.locator('.combat__enemies .intent__chip').first(), page.getByRole('meter', { name: 'The Bell-Warden HP' }), page.getByRole('button', { name: /^1: Attack/ })]) {
        const b = await boxOf(part);
        expect(b.y, 'on screen').toBeGreaterThanOrEqual(0);
        expect(b.y + b.h, 'on screen').toBeLessThanOrEqual(size.height);
      }
      // the boss's intent is in view without scrolling the cards' region
      const cards = await boxOf(page.locator('.combat__main'));
      const intent = await boxOf(page.locator('.combat__enemies .intent__chip').first());
      expect(intent.y + intent.h, 'the intent shows in the cards region').toBeLessThanOrEqual(cards.y + cards.h + 1);
      g.expectClean();
    });
  });
}

// ---- toasts ----------------------------------------------------------------------------------------------------------------

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

test.describe('toasts', () => {
  test('toasts never cover the HUD clock, the map or the pad', async ({ page }, info) => {
    const g = new GameDriver(page, info).watch();
    await g.boot('loop1_day1', 'explore');
    // the level-1 ability point notice, an item gained, and a sound notice
    await g.press(page.getByRole('button', { name: 'Take Amulet of Echoes' }));
    await page.keyboard.press('Control+m');
    const toasts = page.locator('.toasts .toast:visible');
    await expect.poll(() => toasts.count()).toBeGreaterThan(0);
    const keep: Box[] = [await boxOf(page.locator('.clock-chip').first()), await boxOf(page.getByRole('navigation', { name: 'Ways on' }))];
    const map = page.locator('.explore__map');
    if ((await map.count()) > 0) keep.push(await boxOf(map));
    for (const box of await toasts.evaluateAll((els) => els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }))) {
      for (const k of keep) expect(overlaps(box, k), `a toast at ${JSON.stringify(box)} covers ${JSON.stringify(k)}`).toBe(false);
    }
    // one compact stack: the older ones fold into a count
    expect(await toasts.count()).toBeLessThanOrEqual(1);
    g.expectClean();
  });
});
