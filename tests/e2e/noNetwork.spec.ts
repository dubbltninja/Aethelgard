// The game never talks to anyone else (U77; PLAN §8.3 `noNetwork.spec.ts`, §1.1 "no network at runtime"), on desktop and mobile:
// every request to an origin other than the page's is failed on the way out; fifty steps are played through the UI — a new
// game, moves, a fight, a conversation, the Codex, the journal, the pack, the map, rests and a save — and no foreign request
// was attempted. The game's own requests are allowed and expected: its script, its styles, the art, and the prose chunks the
// UI fetches lazily (D-133: the Codex's, the endings', the region's dialogue), all from the page's own origin.
import { expect, test } from 'playwright/test';
import { GameDriver } from './helpers/driver';

test.describe('no network', () => {
  test('fifty steps through the UI make no request to another origin', async ({ page, baseURL }, info) => {
    test.setTimeout(180_000);
    const own = new URL(baseURL ?? 'http://127.0.0.1:4173/').origin;
    const foreign: string[] = [];
    const ownRequests: string[] = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === own) {
        ownRequests.push(url);
        return route.continue();
      }
      foreign.push(url);
      return route.abort();
    });
    page.on('request', (r) => {
      const url = r.url();
      if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== own && !foreign.includes(url)) foreign.push(url);
    });

    const g = new GameDriver(page, info).watch();
    let steps = 0;
    const step = async (what: () => Promise<unknown>, n = 1): Promise<void> => {
      await what();
      steps += n;
    };

    // a new game: Title → New game → class → Begin (4 steps)
    await step(() => g.newGame({ seed: 'no-network', className: 'Ranger' }), 4);
    await g.tutorialsOff();

    // a conversation: Ilyra at the Ruins, an answer, the end (4)
    await step(() => g.press(page.getByRole('button', { name: 'Talk to Ilyra' })));
    await expect(g.screen('dialogue')).toBeVisible();
    await step(() => g.press(page.getByRole('button', { name: /^Continue/ })));
    await step(() => g.press(page.getByRole('button', { name: '2: No.' })));
    await step(() => g.press(page.getByRole('button', { name: /^End the conversation/ })));
    await expect(g.screen('explore')).toBeVisible();

    // the Codex: its prose is a lazy chunk fetched from the page's own origin (4)
    await step(() => g.fromMenu(/^Codex/), 2);
    const codex = g.dialog('Codex');
    await expect(codex).toBeVisible();
    await step(() => g.press(codex.getByRole('button', { name: /^The Temporal Breach, Remnant Archive/ })));
    await expect(codex.getByRole('heading', { level: 3, name: 'The Temporal Breach' })).toBeVisible();
    await step(() => page.keyboard.press('Escape'));
    await expect(codex).toBeHidden();

    // the journal, the pack and the map open and close (6)
    for (const [tab, region] of [
      ['Journal', 'Quest journal'],
      ['Pack', 'Inventory'],
      ['Map', 'Map'],
    ] as const) {
      await step(() => g.press(g.tabBar().getByRole('button', { name: tab })));
      await expect(g.dialog(region)).toBeVisible();
      await step(() => page.keyboard.press('Escape'));
      await expect(g.dialog(region)).toHaveCount(0);
    }

    // a fight: north to the Archway (its Prowler, if the seed rolls it) and the Darkened Corridor's Corrupted Shade (3 + the blows)
    await step(() => g.moveTo('Crumbling Archway'));
    if ((await g.mode()) === 'combat') await fightOut(g, () => steps++);
    await expect(g.placeHeading('Crumbling Archway')).toBeVisible();
    await step(() => g.moveTo('Darkened Corridor'));
    await expect(g.screen('combat')).toBeVisible();
    await fightOut(g, () => steps++);

    // back to the camp, rest, save (6)
    await step(() => g.moveTo('Crumbling Archway', 'Crumbling Archway'));
    await step(() => g.moveTo('Whispering Ruins', 'Whispering Ruins'));
    await step(() => g.shortRest());
    await step(() => g.saveToSlot(1), 3);

    // more of the world until fifty: rests, looking around and walking to the Archives and back
    for (let i = 0; steps < 50 && i < 40; i++) {
      if (i % 3 === 0) await step(() => g.shortRest());
      else if (i % 3 === 1) await step(() => g.moveTo('Sunken Archives'));
      else await step(() => g.press(g.exits().getByRole('button').first()));
      if ((await g.mode()) === 'combat') await fightOut(g, () => steps++);
      if ((await g.mode()) === 'dialogue') await g.throughScenes();
    }

    expect(steps, 'fifty steps were played').toBeGreaterThanOrEqual(50);
    expect(ownRequests.some((u) => /\.js(\?|$)/.test(u)), 'the game itself was fetched from the page’s origin').toBe(true);
    expect(ownRequests.some((u) => /\.json(\?|$)/.test(u)), 'the Codex chunk came from the page’s origin').toBe(true);
    expect(foreign, 'requests to another origin').toEqual([]);
    g.expectClean();
  });
});

/** Fights the fight on screen to its end and past the summary; `count` counts each blow as a step. */
async function fightOut(g: GameDriver, count: () => number): Promise<void> {
  const end = await g.fight();
  count();
  if (end === 'victory') await g.continueVictory();
  expect(end === 'victory' || end === 'left', `the fight ended in ${end}`).toBe(true);
}
