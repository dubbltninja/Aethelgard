// The painted scene backdrops (U71; docs/ART.md §7, D-124) on desktop and mobile, with the fixture art the e2e build ships
// (tests/fixtures/art: the Whispering Ruins, the Heartstone Depths and its three variants, the Title — 240 × 100 large and
// 120 × 50 small, so the test can tell which file loaded). A painted place shows its picture under the code overlays; an
// unpainted Ruins place borrows its nearest painted mate; a region with none draws U64's SVG; a 404 falls back; the Depths
// change picture with the Heartstone's state; only the exits' paintings are preloaded; the Title shows its key art and the
// Grok credit; and Explore keeps no sideways scroll at 1.5× text. U72's overlays (src/ui/art/overlays.ts): particles and the
// focal glow animate and are stilled under reduced motion, the hour's tint skips timeless interiors, the Depths' paintings
// each carry their own glow, the Library marks Ilyra's portal once a Horde runs, and an infected place is darkened and hatched.
import { expect, test, type Page, type TestInfo } from 'playwright/test';

/**
 * U62b: Continue through a scene the engine opened (STORY §13: the thirtieth dawn's `scene_clock_expiry`, Loop 2's waking at the
 * Ruins) back to the place.
 */
async function throughScene(page: Page): Promise<void> {
  const mode = (): Promise<string> => page.evaluate(() => (window as unknown as { __aethelgard: { state: { mode: string } } }).__aethelgard.state.mode);
  for (let i = 0; i < 12 && (await mode()) === 'dialogue'; i++) await page.getByRole('button', { name: /^(Continue|End the conversation)/ }).first().click();
  await expect.poll(mode).toBe('explore');
}

interface GameWindow {
  __aethelgard: {
    store: {
      shell: {
        exportSave(): string;
        importSave(json: string): { ok: boolean; error?: string };
        updateSettings(patch: Record<string, unknown>): void;
      };
    };
  };
}

const mobile = (info: TestInfo): boolean => info.project.name.startsWith('mobile');
const frame = (page: Page) => page.locator('.place__scene .scene');

async function newGame(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: /^Begin as / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();
}

/** Put the running game at `id` (and the Heartstone in `heartstone`) through a save round-trip. */
async function teleport(page: Page, id: string, heartstone?: string, infected = false): Promise<void> {
  const result = await page.evaluate(
    ([to, hs, infect]) => {
      const shell = (window as unknown as GameWindow).__aethelgard.store.shell;
      const file = JSON.parse(shell.exportSave()) as unknown;
      const walk = (o: unknown): boolean => {
        if (o === null || typeof o !== 'object') return false;
        const world = (o as { world?: { currentLocationId?: unknown; heartstone?: string; infected?: string[] } }).world;
        if (world !== undefined && typeof world.currentLocationId === 'string') {
          world.currentLocationId = to;
          if (hs !== null) world.heartstone = hs;
          if (infect) world.infected = [...new Set([...(world.infected ?? []), to as string])];
          return true;
        }
        return Object.values(o).some(walk);
      };
      walk(file);
      return shell.importSave(JSON.stringify(file));
    },
    [id, heartstone ?? null, infected] as const,
  );
  expect(result.ok, result.error).toBe(true);
}

/** The frame's painting: which file the browser chose and its decoded width (0 = not loaded). */
async function painting(page: Page): Promise<{ src: string; width: number }> {
  const img = frame(page).locator('img.scene__painting');
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  return img.evaluate((el: HTMLImageElement) => ({ src: el.currentSrc.replace(/^.*\/art\//, 'art/'), width: el.naturalWidth }));
}

test.describe('painted scenes', () => {
  test('a painted place shows its picture (the @sm file on a phone) under the overlays', async ({ page }, info) => {
    await newGame(page);
    const scene = frame(page);
    await expect(scene).toHaveAttribute('data-backdrop', 'own');
    await expect(scene).toHaveAttribute('data-backdrop-key', 'loc_whispering_ruins');
    await expect(page.getByRole('img', { name: 'Whispering Ruins' })).toBeVisible();
    const pic = await painting(page);
    expect(pic).toEqual(
      mobile(info) ? { src: 'art/scenes/loc_whispering_ruins@sm.webp', width: 120 } : { src: 'art/scenes/loc_whispering_ruins.webp', width: 240 },
    );
    // picture first, overlay above it, filling the same box; the parametric sky is gone
    const order = await scene.evaluate((el) => [...el.children].map((c) => c.getAttribute('class')));
    expect(order).toEqual(['scene__backdrop', 'scene__overlay']);
    const boxes = await scene.evaluate((el) => [el.querySelector('img'), el.querySelector('svg')].map((c) => JSON.stringify(c?.getBoundingClientRect())));
    expect(boxes[0]).toBe(boxes[1]);
    await expect(scene.locator('[data-layer="legibility"]')).toHaveCount(1);
    await expect(scene.locator('img')).toHaveAttribute('alt', '');
  });

  test('an unpainted Ruins place borrows its nearest painted mate; a region with none draws the SVG', async ({ page }) => {
    await newGame(page);
    await teleport(page, 'loc_crumbling_archway');
    await expect(page.getByRole('heading', { level: 1, name: 'Crumbling Archway' })).toBeVisible();
    await expect(frame(page)).toHaveAttribute('data-backdrop', 'region');
    await expect(frame(page)).toHaveAttribute('data-backdrop-key', 'loc_whispering_ruins');
    await expect(frame(page).locator('[data-layer="tint"]')).toHaveCount(1);
    await painting(page);

    await teleport(page, 'loc_mistwood_path');
    await expect(page.getByRole('heading', { level: 1, name: 'Mistwood Path' })).toBeVisible();
    await expect(page.locator('.place__scene svg.scene')).toBeVisible();
    await expect(page.locator('.place__scene img')).toHaveCount(0);
  });

  test('a 404 falls back down the chain, never to a broken image', async ({ page }) => {
    await page.route('**/art/scenes/loc_whispering_ruins*', (route) => route.fulfill({ status: 404, body: 'gone' }));
    await newGame(page);
    // the Ruins' own painting is missing → the nearest mate with a painting (the Depths, 4 away)
    await expect(frame(page)).toHaveAttribute('data-backdrop-key', 'loc_heartstone_depths');
    await expect(frame(page)).toHaveAttribute('data-backdrop', 'region');
    await painting(page);
    // and when the last painting fails too, the SVG (the Depths file is cached by now, so its error is raised by hand)
    await page.evaluate(() => document.querySelectorAll<HTMLImageElement>('.place__scene img').forEach((i) => i.dispatchEvent(new Event('error'))));
    await expect(page.locator('.place__scene svg.scene')).toBeVisible();
    const broken = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>('main img')].filter((i) => i.complete && i.naturalWidth === 0).length);
    expect(broken).toBe(0);
  });

  test('the Heartstone Depths change picture with the Heartstone’s state', async ({ page }) => {
    await newGame(page);
    for (const [state, key] of [
      ['intact', 'loc_heartstone_depths'],
      ['destroyed', 'loc_heartstone_depths~destroyed'],
      ['stabilized', 'loc_heartstone_depths~stabilized'],
      ['exploited', 'loc_heartstone_depths~exploited'],
    ] as const) {
      await teleport(page, 'loc_heartstone_depths', state);
      await expect(frame(page)).toHaveAttribute('data-backdrop-key', key);
      await expect(frame(page)).toHaveAttribute('data-backdrop', state === 'intact' ? 'own' : 'variant');
      expect((await painting(page)).src).toContain(key);
    }
  });

  test('only the current place and its exits’ paintings are fetched', async ({ page }) => {
    const fetched: string[] = [];
    page.on('request', (r) => {
      const m = /\/art\/scenes\/([^/]+)$/.exec(new URL(r.url()).pathname);
      if (m !== null) fetched.push((m[1] as string).replace(/@sm/, '').replace(/\.webp$/, ''));
    });
    await newGame(page);
    await painting(page);
    // Ruins → Archway (borrows the Ruins), Mistwood (none), Sunken Archives (2 from both the Ruins and the Depths: the
    // Depths by id) → the Depths' base is warmed; never a variant
    await expect.poll(() => [...new Set(fetched)].sort()).toEqual(['loc_heartstone_depths', 'loc_whispering_ruins']);
  });

  test('Explore keeps no sideways scroll at 1.5× text over a painted scene', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.store.shell.updateSettings({ textScale: 1.5 }));
    await painting(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the Title shows its key art, and the Credits name Grok Imagine', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('[data-screen="title"]')).toHaveAttribute('data-painted', '');
    const img = page.locator('.title-backdrop img');
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.title-art')).toHaveCount(0);
    await page.getByRole('button', { name: 'Credits' }).click();
    await expect(page.getByText('Scene backdrops made with Grok Imagine; art direction by Tim Dibert.')).toBeVisible();
  });

  test('a missing Title painting falls back to the drawn Title art', async ({ page }) => {
    await page.route('**/art/title*', (route) => route.fulfill({ status: 404, body: 'gone' }));
    await page.goto('./');
    await expect(page.locator('svg.title-art')).toBeVisible();
    await expect(page.locator('[data-screen="title"]')).not.toHaveAttribute('data-painted', '');
  });

  test('high contrast dims a framed painting', async ({ page }) => {
    await newGame(page);
    await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.store.shell.updateSettings({ highContrast: true }));
    await expect.poll(() => frame(page).locator('img').evaluate((el) => getComputedStyle(el).filter)).toContain('brightness(0.45)');
  });

  test.describe('overlays (U72)', () => {
    const layer = (page: Page, name: string) => frame(page).locator(`[data-layer="${name}"]`);

    test('the Ruins have particles and a pulsing glow; the Depths (a timeless interior) take no hour', async ({ page }) => {
      await newGame(page);
      await expect(layer(page, 'particles').locator('circle')).not.toHaveCount(0);
      expect(await layer(page, 'particles').locator('circle').count()).toBeLessThanOrEqual(24);
      await expect(layer(page, 'glow')).toHaveCount(1);
      await expect(layer(page, 'wash')).toHaveCount(1);
      expect(await layer(page, 'glow').evaluate((el) => getComputedStyle(el).animationName)).toBe('focus-pulse');
      expect(await layer(page, 'particles').locator('circle').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('mote-drift');
      await teleport(page, 'loc_heartstone_depths');
      await expect(frame(page)).toHaveAttribute('data-backdrop-key', 'loc_heartstone_depths');
      await expect(layer(page, 'wash')).toHaveCount(0);
      await expect(layer(page, 'glow')).toHaveCount(1);
    });

    test('reduced motion stills it all: no particles, a glow that does not pulse', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await newGame(page);
      await expect(frame(page)).toHaveAttribute('data-motion', 'off');
      await expect(layer(page, 'particles')).toHaveCount(0);
      await expect(layer(page, 'glow')).toHaveCount(1);
      expect(await layer(page, 'glow').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && Number(a.effect?.getComputedTiming().duration ?? 0) > 150).length);
      expect(running).toBe(0);
    });

    test('each Heartstone painting carries its own glow; the destroyed one has none', async ({ page }) => {
      await newGame(page);
      const colours: string[] = [];
      for (const state of ['intact', 'stabilized', 'exploited'] as const) {
        await teleport(page, 'loc_heartstone_depths', state);
        await expect(layer(page, 'glow')).toHaveCount(1);
        colours.push(await frame(page).locator('radialGradient[id$="-focus"] stop').first().getAttribute('stop-color') as string);
      }
      expect(new Set(colours).size).toBe(3);
      await teleport(page, 'loc_heartstone_depths', 'destroyed');
      await expect(frame(page)).toHaveAttribute('data-backdrop-key', 'loc_heartstone_depths~destroyed');
      await expect(layer(page, 'glow')).toHaveCount(0);
      await expect(layer(page, 'particles')).toHaveCount(0);
    });

    test('the Library marks Ilyra’s portal only once a Horde runs', async ({ page }) => {
      await newGame(page);
      await teleport(page, 'loc_shattered_library');
      await expect(page.getByRole('heading', { level: 1, name: 'Shattered Library' })).toBeVisible();
      await expect(layer(page, 'portal')).toHaveCount(0);
      await page.goto('./?scenario=expiry_minus_1');
      await page.getByRole('button', { name: /^\d: Short rest/ }).click();
      await throughScene(page); // the thirtieth dawn (STORY §13 `scene_clock_expiry`)
      await expect.poll(() => page.evaluate(() => document.querySelector('[data-screen="explore"]') !== null)).toBe(true);
      await teleport(page, 'loc_shattered_library');
      await expect(page.getByRole('heading', { level: 1, name: 'Shattered Library' })).toBeVisible();
      await expect(layer(page, 'portal')).toHaveCount(1);
      await expect(page.getByRole('img', { name: /Ilyra’s portal burns open here/ })).toBeVisible();
      await teleport(page, 'loc_whispering_ruins');
      await expect(layer(page, 'portal')).toHaveCount(0);
    });

    test('an infected place is darkened and hatched; a clean one is not; the hatch survives high contrast', async ({ page }) => {
      await newGame(page);
      await expect(layer(page, 'breach')).toHaveCount(0);
      await teleport(page, 'loc_whispering_ruins', undefined, true);
      await expect(page.locator('[data-screen="explore"]')).toHaveAttribute('data-infected', 'true');
      await expect(layer(page, 'breach')).toHaveCount(1);
      await expect(layer(page, 'breach-dark')).toHaveCount(1);
      expect(Number(await layer(page, 'breach').getAttribute('opacity'))).toBeGreaterThanOrEqual(0.5);
      await page.evaluate(() => (window as unknown as GameWindow).__aethelgard.store.shell.updateSettings({ highContrast: true }));
      await expect(layer(page, 'breach')).toBeVisible();
      await expect(layer(page, 'glow')).toBeHidden();
    });
  });
});
