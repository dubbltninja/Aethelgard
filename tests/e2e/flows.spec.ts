// The whole game's flows, played through the UI with a `GameDriver` (U77; PLAN §8.3, §1.3), on desktop and mobile:
//   1. title → class → north to the Darkened Corridor and the Corrupted Shade → back and rest → save to slot 1 → reload → load
//      slot 1 → the state is exactly what was saved;
//   2. `?scenario=pre_tyrant_l13_ranger` → the Contained Tyrant → its defeat scene → the Horde → the Shattered Library's portal →
//      Loop 2 Day 1 (the waking scene, no Threshold);
//   3. `?scenario=loop2_end` → the Threshold: spend Resonance, equip an Attunement, the Far Light → Loop 3 Day 1;
//   4. `?scenario=ending_a_ready` → the ending's slides over their paintings → the credits, "a game by Tim Dibert".
//
// Deviation (flow 2): at Level 13 the Contained Tyrant beats a button-pressing player on the scenario's own seed (the melee bot
// loses there too), so the scenario boots at Level 20 through the e2e-only `&level=` switch (src/main.tsx); everything after
// the boot is the UI, the fights included.
import { expect, test } from 'playwright/test';
import { GameDriver, type SeenState } from './helpers/driver';

test.describe('flows', () => {
  test('the first day: the Shade, a rest, a save, a reload, a load — the state comes back exactly', async ({ page }, info) => {
    test.setTimeout(120_000);
    const g = new GameDriver(page, info).watch();
    await g.newGame({ seed: 'flow-first-day', className: 'Ranger' });
    await g.tutorialsOff();

    // north twice: the Crumbling Archway, then the Darkened Corridor, where the Corrupted Shade steps out of the wall
    await g.moveTo('Crumbling Archway');
    if ((await g.mode()) === 'combat') await finishFight(g, await g.fight()); // (the Archway's Prowler, when the seed rolls it)
    await expect(g.placeHeading('Crumbling Archway')).toBeVisible();
    await g.moveTo('Darkened Corridor');
    await expect(g.screen('combat')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Corrupted Shade' })).toBeVisible();
    expect(await g.fight()).toBe('victory');
    await expect(g.victory().getByText(/^\+\d+ XP$/)).toBeVisible();
    await g.continueVictory();
    await expect(g.placeHeading('Darkened Corridor')).toBeVisible();

    // back to the camp at the Ruins, and rest
    await g.moveTo('Crumbling Archway', 'Crumbling Archway');
    await g.moveTo('Whispering Ruins', 'Whispering Ruins');
    await g.shortRest();

    // save to slot 1, remember exactly what the game is, reload the page, and load slot 1 from the Title
    await g.saveToSlot(1);
    const saved = await g.state();
    expect(saved.mode).toBe('explore');
    expect(saved.player.level).toBe(1);
    expect(saved.world.currentLocationId).toBe('loc_whispering_ruins');
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
    await g.loadFromTitle(1);
    await expect(g.placeHeading('Whispering Ruins')).toBeVisible();
    const loaded = await g.state();
    expect(loaded).toEqual(saved);
    g.expectClean();
  });

  test('the Tyrant, the Horde and the portal: Loop 1 ends and Loop 2 Day 1 begins at the Ruins, with no Threshold between', async ({ page }, info) => {
    test.setTimeout(180_000);
    const g = new GameDriver(page, info).watch();
    await g.boot('pre_tyrant_l13_ranger', 'dialogue', 'level=20');
    await expect(page.getByText(/Face it, or not yet\?/)).toBeVisible();
    await g.tutorialsOff();
    await g.press(page.getByRole('button', { name: /^1: Face it/ }));
    await expect(g.screen('combat')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /The Chronos Tyrant/ })).toBeVisible();

    // the Tyrant falls, and the scene says so; the Horde has started
    expect(await g.fight({ abilities: true })).toBe('left');
    expect(await g.mode()).toBe('dialogue');
    await expect(page.getByText(/begins to crumble into a pile of temporal dust/)).toBeVisible();
    const toRun = page.getByRole('button', { name: /^1: Run\./ });
    for (let i = 0; i < 12 && !(await toRun.isVisible()); i++) await g.press(page.getByRole('button', { name: /^Continue/ }).first());
    await expect(page.getByText(/Go! I'll hold them back/)).toBeVisible();
    await g.press(toRun);
    await expect(g.screen('explore')).toBeVisible();
    expect((await g.state()).world.hordeActive).toBe(true);

    // run for the Library: the road the Horde has not reached yet; a fight on the way is fought
    for (const place of ['The Chronos Nexus', 'Veridian Glowlands', 'Sky-Whisper Plateau', 'Blighted Outpost', 'Barren Peaks', 'Ironclad Camp', 'Mistwood Path', 'Silverwood Plaza', 'Shattered Library']) {
      await g.moveTo(place);
      await finishFight(g, (await g.mode()) === 'combat' ? await g.fight({ abilities: true }) : 'left');
      await expect(g.placeHeading(place)).toBeVisible();
      // the Horde holds the place behind us: the way back to the Apex says what it costs
      if (place === 'The Chronos Nexus') await expect(g.exits().getByRole('button', { name: /the Horde is there/ })).toBeVisible(); // (U84a: the pad's fixed-size button hatches the slot and names the cost)
    }
    await expect(page.getByText(/Ilyra stands before it/)).toBeVisible();

    // the portal: the closer's slides, then Loop 2's first morning — the waking scene, and the Ruins; the Threshold is skipped in Loop 1
    await g.press(page.getByRole('button', { name: /^\d: Step through the portal/ }));
    await expect(page.getByRole('alertdialog')).toContainText('Step through the portal? This loop ends.');
    await g.press(page.getByRole('alertdialog').getByRole('button', { name: 'Step through the portal' }));
    await expect(g.screen('ending')).toBeVisible();
    for (let i = 0; i < 40 && (await g.mode()) === 'ending'; i++) {
      const next = page.getByRole('button', { name: /^(Continue|Next|On to|Begin|Step|Wake)/i }).first();
      if (await next.isVisible()) await g.press(next);
      else await page.keyboard.press('Enter');
      await page.waitForTimeout(60);
    }
    await expect.poll(() => g.mode()).toBe('dialogue');
    await expect(page.getByText(/The Amulet of Echoes is warm against your throat/)).toBeVisible();
    await g.throughScenes();
    const loop2 = await g.state();
    expect(loop2.meta.loop).toBe(2);
    expect(loop2.world.currentLocationId).toBe('loc_whispering_ruins');
    expect(loop2.world.hordeActive).toBe(false);
    await expect(g.placeHeading('Whispering Ruins')).toBeVisible();
    await expect(page.getByTestId('clock-chip')).toContainText('Day 1');
    await expect(g.screen('threshold')).toHaveCount(0);
    g.expectClean();
  });

  test('the Threshold: spend Resonance on an Attunement, equip it, step into the Far Light → Loop 3 Day 1', async ({ page }, info) => {
    const g = new GameDriver(page, info).watch();
    await g.boot('loop2_end', 'threshold');
    await expect(page.getByText('The Threshold · before Loop 3')).toBeVisible();

    await g.press(page.getByRole('tab', { name: 'Loom', exact: true }));
    await expect(g.placeHeading('The Loom')).toBeVisible();
    const resonance = page.getByTestId('loom-resonance');
    await expect(resonance).toHaveAttribute('aria-label', 'Resonance 100');
    const hand = page.locator('[data-attunement="att_steady_hand"]');
    await g.press(hand.getByRole('button', { name: 'Weave Steady Hand (20)' }));
    await expect(resonance).toHaveAttribute('aria-label', 'Resonance 80');
    await g.press(hand.getByRole('button', { name: 'Equip Steady Hand' }));
    await expect(hand).toContainText('Equipped');

    await g.press(page.getByRole('tab', { name: 'Far Light', exact: true }));
    // the first walk to the Far Light plays the "look back" scene (U57); step past it
    if (await page.getByRole('heading', { level: 1, name: 'Before you step through' }).isVisible()) {
      await g.press(page.getByRole('button', { name: /Step into the light\.$/ }));
    }
    await expect(g.placeHeading('The Far Light')).toBeVisible();
    await expect(page.getByLabel('Carried into the next loop')).toContainText('Steady Hand');
    await g.press(page.getByRole('button', { name: 'Step into the light: begin Loop 3' }));

    await expect(g.screen('explore')).toBeVisible();
    const state = await g.state();
    expect(state.mode).toBe('explore');
    expect(state.meta.loop).toBe(3);
    expect(state.world.currentLocationId).toBe('loc_whispering_ruins');
    expect((state.player as SeenState['player'] & { attunements?: string[] }).attunements).toEqual(['att_steady_hand']);
    await expect(page.getByTestId('clock-chip')).toContainText('Day 1');
    g.expectClean();
  });

  test('an ending: its slides over their paintings, then the credits — a game by Tim Dibert', async ({ page }, info) => {
    const g = new GameDriver(page, info).watch();
    await g.boot('ending_a_ready', 'combat');
    await g.press(page.getByRole('button', { name: /^3: Take its place/ }));
    await expect(g.screen('ending')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: "The Warden's Vigil" })).toBeVisible();

    const total = Number((await page.locator('.ending__progress').innerText()).split('/')[1]);
    expect(total).toBeGreaterThan(3);
    const paintings = new Set<string>();
    for (let slide = 1; slide < total; slide++) {
      // every slide is a figure of words over a painting (the painting is decoration: aria-hidden, a location's scene)
      const figure = page.locator('figure.ending__slide');
      await expect(figure).toBeVisible();
      await expect(figure.locator('.ending__text')).not.toBeEmpty();
      await expect(page.locator('.ending__scene > *').first()).toBeAttached();
      paintings.add((await figure.getAttribute('data-art')) ?? 'the place the loop ended');
      await expect(page.locator('.ending__progress')).toHaveText(`${slide} / ${total}`);
      await g.press(page.getByRole('button', { name: 'Continue', exact: true }));
    }
    expect(paintings.size, 'the slides are laid over more than one painting').toBeGreaterThan(1);
    await expect(page.locator('.ending__progress')).toHaveText(`${total} / ${total}`);
    await expect(page.locator('.ending__credits')).toHaveText('A game by Tim Dibert');
    g.expectClean();
  });
});

/** The end of a fight on the road: a win is acknowledged, anything else is a failure of the flow. */
async function finishFight(g: GameDriver, end: Awaited<ReturnType<GameDriver['fight']>>): Promise<void> {
  if (end === 'victory') await g.continueVictory();
  else expect(end, 'a fight on the way was lost').toBe('left');
}
