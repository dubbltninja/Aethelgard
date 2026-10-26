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
interface GameWindow {
  __aethelgard: { audio: AudioSpy; state: { mode: string; combat: { phase: string } | null } };
}

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
});
