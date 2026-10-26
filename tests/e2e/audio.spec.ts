// Sound (U74; DESIGN §18.1, §18.5), on desktop and mobile, spying on the engine layer (`window.__aethelgard.audio`), not
// the speakers: nothing starts before the first gesture and the first click starts it; a fight's blow schedules its
// sound; Ctrl+M mutes at once (nothing more is scheduled) and is remembered; volumes apply to the buses, play a test
// sound, and survive a reload; the `?audition` page plays a sound by name. No console errors or warnings throughout.
import { expect, test, type Locator, type Page, type TestInfo } from 'playwright/test';

interface AudioSpy {
  state(): string;
  played(): string[];
  bus(name: string): { gain: { value: number } } | null;
}
interface AmbientSpy {
  current(): { bed: string | null; interior: boolean; infected: boolean; theme: { phase: number; purity: number } | null; ducked: boolean; layers: number };
}
interface GameWindow {
  __aethelgard: { audio: AudioSpy; ambient: AmbientSpy; dispatch(action: unknown): void; state: { mode: string; combat: { phase: string } | null; world: { currentLocationId: string } } };
}
type Status = ReturnType<AmbientSpy['current']>;

const ambientNow = (page: Page): Promise<Status> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.ambient.current());
const travel = (page: Page, to: string): Promise<void> => page.evaluate((t) => (window as unknown as GameWindow).__aethelgard.dispatch({ type: 'move', to: t }), to);
const where = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.world.currentLocationId);

const audioState = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.audio.state());
const played = (page: Page): Promise<string[]> => page.evaluate(() => [...(window as unknown as GameWindow).__aethelgard.audio.played()]);
const busGain = (page: Page, name: string): Promise<number> => page.evaluate((n) => (window as unknown as GameWindow).__aethelgard.audio.bus(n)?.gain.value ?? -1, name);
const phase = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state.combat?.phase ?? 'over');
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

const BLOW = /^sfx_(hit_|crit|miss|guard)/;

test.describe('sound', () => {
  test('the first click starts audio; a blow schedules its sound; Ctrl+M mutes at once and is remembered', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('./?scenario=first_fight');
    await expect(page.locator('[data-screen="combat"]')).toBeVisible();
    expect(await audioState(page)).toBe('locked'); // nothing is created before a gesture
    expect(await played(page)).toEqual([]);

    await press(page.getByRole('heading', { level: 1, name: 'Corrupted Shade' }), info);
    await expect.poll(() => audioState(page)).toBe('running');

    // blows until one is heard (a hit, a crit, a miss or a guard, on either side)
    const attack = page.getByRole('button', { name: /^1: Attack/ });
    for (let i = 0; i < 4 && !(await played(page)).some((id) => BLOW.test(id)); i++) {
      await press(attack, info);
      await expect.poll(() => phase(page)).not.toBe('enemyTurn');
    }
    expect((await played(page)).some((id) => BLOW.test(id))).toBe(true);

    await page.keyboard.press('Control+m');
    await expect(page.getByText('Sound muted. Ctrl+M turns it back on.')).toBeVisible();
    const before = (await played(page)).length;
    for (let i = 0; i < 2 && (await phase(page)) === 'playerTurn'; i++) {
      await press(attack, info);
      await expect.poll(() => phase(page)).not.toBe('enemyTurn');
    }
    expect((await played(page)).length).toBe(before); // muted: nothing is scheduled at all

    await page.reload();
    await expect(page.locator('[data-screen="combat"]')).toBeVisible();
    await press(page.getByRole('heading', { level: 1, name: 'Corrupted Shade' }), info);
    await expect.poll(() => audioState(page)).toBe('running');
    await press(attack, info);
    await expect.poll(() => phase(page)).not.toBe('enemyTurn');
    expect(await played(page)).toEqual([]); // still muted after the reload
    expect(problems).toEqual([]);
  });

  test('volumes reach the buses, play a test sound, and survive a reload', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('./');
    await press(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: /^Settings/ }), info);
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings).toBeVisible();
    await expect(settings.getByText('The game makes no sound yet')).toHaveCount(0);
    await expect.poll(() => audioState(page)).toBe('running');

    await settings.getByRole('slider', { name: 'Effects volume' }).fill('40');
    await expect.poll(() => busGain(page, 'sfx')).toBeCloseTo(0.16, 2);
    await expect.poll(() => played(page)).toContain('sfx_ui_confirm'); // the debounced test sound
    await settings.getByRole('slider', { name: 'Music volume' }).fill('0');
    await expect.poll(() => busGain(page, 'music')).toBeCloseTo(0, 3);

    await page.reload();
    await press(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: /^Settings/ }), info);
    await expect(page.getByRole('dialog', { name: 'Settings' }).getByRole('slider', { name: 'Effects volume' })).toHaveValue('40');
    await expect.poll(() => audioState(page)).toBe('running');
    await expect.poll(() => busGain(page, 'sfx')).toBeCloseTo(0.16, 2);
    await expect.poll(() => busGain(page, 'music')).toBeCloseTo(0, 3);
    expect(problems).toEqual([]);
  });

  test('the audition page plays each sound by name', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('./?audition');
    await expect(page.getByRole('heading', { level: 1, name: 'Sound audition' })).toBeVisible();
    const buttons = page.locator('button[data-sound]');
    await expect(buttons).toHaveCount(39);
    const ids = new Set(await buttons.evaluateAll((all) => all.map((b) => (b as HTMLElement).dataset.sound)));
    expect(ids.size).toBe(32); // the 30 and the two percussion hits
    await press(page.locator('button[data-sound="sfx_echo_gain"]').first(), info);
    await expect(page.getByRole('status')).toContainText('sfx_echo_gain');
    expect(await played(page)).toEqual(['sfx_echo_gain']);
    await press(page.locator('button[data-sound="sfx_status_apply"]').nth(1), info);
    await expect(page.getByRole('status')).toContainText('sfx_status_apply (burn)');
    expect(problems).toEqual([]);
  });

  test('ambient: silent on the Title; a region’s bed starts on the first gesture and switches when the region changes', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('./');
    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
    await press(page.getByRole('heading', { level: 1 }), info);
    await expect.poll(() => audioState(page)).toBe('running');
    expect(await ambientNow(page)).toMatchObject({ bed: null, theme: null, layers: 0 }); // the Title plays nothing

    await page.goto('./?scenario=loop1_day1');
    await expect(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' })).toBeVisible();
    expect(await ambientNow(page)).toMatchObject({ bed: null, layers: 0 }); // nothing before the first gesture
    await press(page.getByRole('heading', { level: 1, name: 'Whispering Ruins' }), info);
    await expect.poll(async () => (await ambientNow(page)).bed).toBe('ambient_silverwood_ruins');

    // an interior in the same region darkens the bed in place: still one layer, the same bed
    await travel(page, 'loc_sunken_archives');
    await expect.poll(() => where(page)).toBe('loc_sunken_archives');
    expect(await ambientNow(page)).toMatchObject({ bed: 'ambient_silverwood_ruins', interior: true, layers: 1 });
    await travel(page, 'loc_whispering_ruins');
    await expect.poll(() => where(page)).toBe('loc_whispering_ruins');
    expect(await ambientNow(page)).toMatchObject({ bed: 'ambient_silverwood_ruins', interior: false, layers: 1 });

    // another region: the bed crossfades (two layers for about two seconds), then only the new one remains
    await travel(page, 'loc_mistwood_path');
    await expect.poll(async () => (await ambientNow(page)).bed).toBe('ambient_mistwood_ironclad_reach');
    expect((await ambientNow(page)).layers).toBe(2);
    await expect.poll(async () => (await ambientNow(page)).layers, { timeout: 8000 }).toBe(1);
    expect(problems).toEqual([]);
  });

  test('ambient: the Tyrant’s fight plays the theme, thinned by the communion; mute stops both', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('./?scenario=combat_tyrant_contained_p2');
    await expect(page.locator('[data-screen="combat"]')).toBeVisible();
    expect(await ambientNow(page)).toMatchObject({ theme: null });
    await press(page.getByRole('heading', { level: 1, name: 'The Chronos Tyrant' }), info);
    await expect.poll(async () => (await ambientNow(page)).theme?.phase).toBe(1); // the second phase
    expect(await ambientNow(page)).toMatchObject({ bed: 'ambient_temporal_breach_apex', ducked: true, theme: { purity: 0 } });

    await page.keyboard.press('Control+m');
    await expect(page.getByText('Sound muted. Ctrl+M turns it back on.')).toBeVisible();
    expect(await ambientNow(page)).toMatchObject({ bed: null, theme: null }); // both stop at once
    await page.keyboard.press('Control+m');
    await expect.poll(async () => (await ambientNow(page)).theme?.phase).toBe(1);
    expect((await ambientNow(page)).bed).toBe('ambient_temporal_breach_apex');

    // the communion (Resolve 5 in Movement II) thins the same theme
    await page.goto('./?scenario=communion_movement_2');
    await expect(page.locator('[data-screen="combat"]')).toBeVisible();
    await press(page.getByRole('heading', { level: 1 }), info);
    await expect.poll(async () => (await ambientNow(page)).theme?.purity ?? 0).toBeGreaterThan(0.4);
    expect((await ambientNow(page)).theme?.phase).toBe(1);
    expect(problems).toEqual([]);
  });

  test('the audition page plays each bed and the Tyrant theme', async ({ page }, info) => {
    const problems = watch(page);
    await page.goto('./?audition');
    const beds = page.locator('button[data-bed]:not([data-bed=""])');
    await expect(beds).toHaveCount(14);
    await press(beds.first(), info);
    await expect.poll(async () => (await ambientNow(page)).bed).toBe('ambient_silverwood_ruins');
    await press(page.locator('button[data-bed="ambient_threshold"]'), info);
    await expect.poll(async () => (await ambientNow(page)).bed).toBe('ambient_threshold');
    await press(page.getByLabel(/Infected/), info);
    await expect.poll(async () => (await ambientNow(page)).infected).toBe(true);
    await press(page.locator('button[data-theme="play"]'), info);
    await expect.poll(async () => (await ambientNow(page)).theme?.phase).toBe(0);
    await page.getByRole('combobox').selectOption('3');
    await expect.poll(async () => (await ambientNow(page)).theme?.phase).toBe(3);
    await page.getByRole('slider', { name: /Communion resolve/ }).fill('8');
    await expect.poll(async () => (await ambientNow(page)).theme?.purity).toBe(1);
    await press(page.locator('button[data-theme="stop"]'), info);
    await expect.poll(async () => (await ambientNow(page)).theme).toBeNull();
    await press(page.locator('button[data-bed=""]'), info);
    await expect.poll(async () => (await ambientNow(page)).bed).toBeNull();
    expect(problems).toEqual([]);
  });
});
