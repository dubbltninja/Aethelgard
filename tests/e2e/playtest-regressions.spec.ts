// Regressions from the independent playtest: inspect without acting, text reflow and live Guard reconciliation.
import { expect, test } from 'playwright/test';
import * as esbuild from 'esbuild';
import { GameDriver } from './helpers/driver';

test('ability effects can be inspected without spending a turn or resource, then used normally', async ({ page }, info) => {
  const g = new GameDriver(page, info).watch();
  await g.boot('combat_tyrant_contained_p2', 'combat');
  await g.tutorialsOff();
  const opener = page.getByRole('button', { name: /^Abilities, / });
  if (await opener.count()) await g.press(opener);
  const tile = page.locator('li').filter({ has: page.locator('[data-tile="rgr_marked_shot"]') }).last();
  const before = await g.state();
  await g.press(tile.locator('summary'));
  await expect(tile.locator('.ability-effects p')).toBeVisible();
  await expect(tile.locator('.ability-effects p')).toContainText(/Mark/);
  expect(await g.state()).toEqual(before);
  await g.press(tile.getByRole('button', { name: /^2: Marked Shot/ }));
  await expect.poll(async () => (await g.state()).combat?.round ?? 0).toBeGreaterThan(before.combat?.round ?? 0);
  await expect(page.getByRole('log')).toContainText('Marked Shot');
  g.expectClean();
});

test('combat items show their numerical effects before use', async ({ page }, info) => {
  const g = new GameDriver(page, info).watch();
  await g.boot('combat_tyrant_contained_p2', 'combat');
  await g.tutorialsOff();
  const before = await g.state();
  await g.press(page.getByRole('button', { name: /^I: Item/ }));
  await expect(g.dialog('Use an item')).toContainText(/Restores \d+ HP/);
  expect(await g.state()).toEqual(before);
  await g.press(g.dialog('Use an item').getByRole('button', { name: 'Close use an item' }));
  g.expectClean();
});

test('short touch landscape keeps turn controls pinned and usable at enlarged text', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'touch layout');
  await page.setViewportSize({ width: 844, height: 390 });
  const g = new GameDriver(page, info).watch();
  await g.boot('first_fight', 'combat');
  await g.tutorialsOff();
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  const bar = page.getByRole('group', { name: 'Turn actions' });
  await expect(bar).toBeVisible();
  const bounds = await bar.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(390);
  await expect(bar).toContainText(/Flee \d+%/);
  await g.press(bar.getByRole('button', { name: /^G: Guard/ }));
  await expect(page.getByRole('log')).toContainText('Wayfinder guards.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  g.expectClean();
});

test('class selection at landscape 150% keeps Seed, Begin and stat labels separate', async ({ page }, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const g = new GameDriver(page, info).watch();
  await page.goto('./');
  await g.press(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: /^Settings/ }));
  await g.press(g.dialog('Settings').getByRole('radio', { name: '150%' }));
  await g.press(g.dialog('Settings').getByRole('button', { name: 'Close settings' }));
  await g.press(page.getByRole('button', { name: 'New game' }));
  const seed = page.locator('.advanced summary');
  const begin = page.getByRole('button', { name: /^Begin as / });
  const s = await seed.boundingBox();
  const b = await begin.boundingBox();
  expect(s!.width).toBeGreaterThan(100);
  expect(s!.x + s!.width <= b!.x || s!.y + s!.height <= b!.y || b!.y + b!.height <= s!.y).toBe(true);
  const overflowing = await page.locator('.stat-grid dt').evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
  expect(overflowing).toEqual([]);
  await g.press(seed);
  await page.getByRole('textbox', { name: 'Seed' }).fill('playtest-landscape');
  await g.press(begin);
  await expect(g.placeHeading('Whispering Ruins')).toBeVisible();
  g.expectClean();
});

test('320px combat at enlarged text has no horizontal overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const g = new GameDriver(page, info).watch();
  await g.boot('combat_tyrant_contained_p2', 'combat');
  await g.tutorialsOff();
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await g.press(page.getByRole('button', { name: /^Abilities, / }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  g.expectClean();
});

test('Guard predictions reconcile identical attacks, changed attacks and a defeated enemy without stale spans', async ({ page }) => {
  const bundle = await esbuild.build({
    stdin: {
      resolveDir: process.cwd(), loader: 'tsx',
      contents: `import React, {useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import {PlayerPanel} from './src/ui/components/combat/PlayerPanel';
        const rows = [['Slam 20 → 10', 'Slam 20 → 10'], ['Slam 20 → 10', 'Grind 12 → 6'], ['Grind 12 → 6'], ['Slam 20 → 10', 'Slam 20 → 10'], ['Grind 12 → 6']];
        function Harness() {
          const [step, setStep] = useState(0);
          return <><button onClick={() => setStep(i => i + 1)}>Next prediction</button>
            <PlayerPanel player={{name:'Wayfinder', hp:100, hpMax:100, mp:30, mpMax:30, resourceName:'Focus', statuses:[], guarding:false}}
              guard={{enabled:true, reason:null, previews:rows[step]}} flee={{shown:false}} itemCount={0} canItem={false} />
          </>;
        }
        createRoot(document.getElementById('test')).render(<Harness/>);`,
    },
    bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' },
  });
  await page.goto('about:blank');
  await page.setContent('<div id="test"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  const previews = page.locator('[data-action="guard"] .combat-action__detail');
  await expect(previews).toHaveText(['Slam 20 → 10', 'Slam 20 → 10']);
  for (const expected of [['Slam 20 → 10', 'Grind 12 → 6'], ['Grind 12 → 6'], ['Slam 20 → 10', 'Slam 20 → 10'], ['Grind 12 → 6']]) {
    await page.getByRole('button', { name: 'Next prediction' }).click();
    await expect(previews).toHaveText(expected);
  }
});
