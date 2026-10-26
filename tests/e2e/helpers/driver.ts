// A GameDriver for the Playwright flows (U77; PLAN §8.3 `flows.spec.ts`): it drives the UI the way a player does — by the
// accessible names of buttons, tabs, dialogs and landmarks, never by CSS classes — and reads `window.__aethelgard.state` only
// to decide what to do next (HP, the mode, the phase), never to change anything. New specs use it; the older specs keep their
// own small helpers (they were written before it and still pass).
//
// A tap on touch projects (Pixel 7) and a click elsewhere: `press`.
import { expect, type Locator, type Page, type TestInfo } from 'playwright/test';

export interface SeenState {
  mode: string;
  clock: { ticks: number; limitTicks: number };
  meta: { loop: number };
  world: { currentLocationId: string; hordeActive: boolean };
  player: { classId: string; name: string; level: number; hp: number; hpMax: number; gold: number; inventory: { itemId: string; qty: number }[] };
  combat: { phase: string; round: number } | null;
  pendingEnding: { outcome: string } | null;
  [key: string]: unknown;
}

interface GameWindow {
  __aethelgard: { state: SeenState; dispatch(action: unknown): unknown };
}

export type FightEnd = 'victory' | 'left' | 'defeat';

export class GameDriver {
  readonly problems: string[] = [];

  constructor(
    readonly page: Page,
    readonly info: TestInfo,
  ) {}

  // ---- plumbing ------------------------------------------------------------------------------------------------------------

  get mobile(): boolean {
    return this.info.project.name.startsWith('mobile');
  }

  /** A tap on touch devices, a click elsewhere. */
  async press(target: Locator): Promise<void> {
    if (this.mobile) await target.tap();
    else await target.click();
  }

  /** Records console errors/warnings and uncaught page errors; `expectClean()` asserts there were none. */
  watch(): this {
    this.page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') this.problems.push(m.text());
    });
    this.page.on('pageerror', (e) => this.problems.push(e.message));
    return this;
  }

  expectClean(): void {
    expect(this.problems).toEqual([]);
  }

  state(): Promise<SeenState> {
    return this.page.evaluate(() => (window as unknown as GameWindow).__aethelgard.state);
  }

  async mode(): Promise<string> {
    return (await this.state()).mode;
  }

  // ---- landmarks -----------------------------------------------------------------------------------------------------------

  screen = (name: string): Locator => this.page.locator(`[data-screen="${name}"]`);
  tabBar = (): Locator => this.page.getByRole('navigation', { name: 'Game menu' });
  exits = (): Locator => this.page.getByRole('navigation', { name: 'Ways on' });
  dialog = (name: string | RegExp): Locator => this.page.getByRole('dialog', { name });
  placeHeading = (name: string): Locator => this.page.getByRole('heading', { level: 1, name });

  // ---- starting ------------------------------------------------------------------------------------------------------------

  /** A `?scenario=` boot (D-104 ruling 1), waiting for the screen the scenario lands on. `extra`: more query (`level=20`). */
  async boot(scenario: string, screen: 'explore' | 'combat' | 'dialogue' | 'threshold' | 'ending', extra = ''): Promise<void> {
    await this.page.goto(`./?scenario=${scenario}${extra === '' ? '' : `&${extra}`}`);
    await expect(this.screen(screen)).toBeVisible();
  }

  /** Title → New game → (class) → Begin. Seed and class name are optional; the class is picked by its radio's name. */
  async newGame(opts: { seed?: string; className?: string; name?: string } = {}): Promise<void> {
    const { page } = this;
    await page.goto('./');
    await this.press(page.getByRole('button', { name: 'New game' }));
    await expect(page.getByRole('heading', { level: 1, name: 'Choose who walks into the Breach' })).toBeVisible();
    if (opts.className !== undefined) await this.press(page.getByRole('radio', { name: opts.className }));
    if (opts.name !== undefined) await page.getByRole('textbox', { name: 'Name' }).fill(opts.name);
    if (opts.seed !== undefined) {
      await page.getByText('Seed (optional)').click();
      await page.getByRole('textbox', { name: 'Seed' }).fill(opts.seed);
    }
    await this.press(page.getByRole('button', { name: /^Begin as / }));
    await expect(this.placeHeading('Whispering Ruins')).toBeVisible();
  }

  /** "Turn tutorials off": the hints (several can queue in a fight) never get in the way of a scripted play. */
  async tutorialsOff(): Promise<void> {
    const off = this.page.getByRole('button', { name: 'Turn tutorials off' });
    // (a DOM click: a tap would let Playwright scroll the page to the button, which a thumb does not)
    if (await off.isVisible()) await off.evaluate((el) => (el as HTMLElement).click());
  }

  // ---- exploring -----------------------------------------------------------------------------------------------------------

  /** Takes the exit whose name matches ("Crumbling Archway", /^North/), and waits until the new place's heading shows. */
  async moveTo(exit: string | RegExp, arrives?: string): Promise<void> {
    const name = typeof exit === 'string' ? new RegExp(`^\\w+: ${exit}`) : exit;
    await this.press(this.exits().getByRole('button', { name }));
    if (arrives !== undefined) await expect(this.placeHeading(arrives)).toBeVisible();
  }

  /** The Rest camp row's short rest (`N: Short rest`). */
  async shortRest(): Promise<void> {
    const before = (await this.state()).clock.ticks;
    await this.press(this.page.getByRole('button', { name: /^\d: Short rest/ }));
    await expect.poll(async () => (await this.state()).clock.ticks).toBeGreaterThan(before);
  }

  /** Continue through scenes the engine opened (a dawn, a portal, a defeat scene) until the mode is `until` (default explore). */
  async throughScenes(until = 'explore', limit = 40): Promise<void> {
    for (let i = 0; i < limit && (await this.mode()) === 'dialogue'; i++) {
      const next = this.page.getByRole('button', { name: /^(Continue|End the conversation)/ }).first();
      if (await next.isVisible()) await this.press(next);
      else await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(40);
    }
    await expect.poll(() => this.mode()).toBe(until);
  }

  // ---- panels --------------------------------------------------------------------------------------------------------------

  /** Menu tab → one of its rows (Saves, Settings, Codex, Return to title …). */
  async fromMenu(row: RegExp): Promise<void> {
    await this.press(this.tabBar().getByRole('button', { name: 'Menu' }));
    await this.press(this.dialog('Menu').getByRole('button', { name: row }));
  }

  slotCard = (slot: number): Locator => this.dialog('Saves').locator(`li.slot[data-slot="${slot}"]`);

  async saveToSlot(slot: number): Promise<void> {
    await this.fromMenu(/^Saves/);
    await expect(this.dialog('Saves')).toBeVisible();
    await this.press(this.slotCard(slot).getByRole('button', { name: `Save to slot ${slot}` }));
    await expect(this.slotCard(slot)).toHaveAttribute('data-status', 'ok');
    await this.press(this.dialog('Saves').getByRole('button', { name: 'Close saves' }));
    await expect(this.dialog('Saves')).toHaveCount(0);
  }

  /** From the Title: Load → Load slot N. */
  async loadFromTitle(slot: number): Promise<void> {
    await this.press(this.page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: /^Load/ }));
    await this.press(this.slotCard(slot).getByRole('button', { name: `Load slot ${slot}` }));
  }

  async returnToTitle(): Promise<void> {
    await this.fromMenu(/^Return to title/);
    await expect(this.page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
  }

  // ---- fighting ------------------------------------------------------------------------------------------------------------

  victory = (): Locator => this.dialog('Victory');

  /** One round trip: what a player reads off the screen to decide the next move. */
  private glance(): Promise<{ mode: string; phase: string | null; hp: number }> {
    return this.page.evaluate(() => {
      const s = (window as unknown as GameWindow).__aethelgard.state as unknown as {
        mode: string;
        player: { hp: number; hpMax: number };
        combat: { phase: string; party: { kind: string; hp: number; hpMax: number }[] } | null;
      };
      const me = s.combat?.party.find((c) => c.kind === 'player') ?? s.player;
      return { mode: s.mode, phase: s.combat?.phase ?? null, hp: me.hpMax > 0 ? me.hp / me.hpMax : 1 };
    });
  }

  /** Waits for the next decision point: the player's turn, the Victory summary, or the end of combat mode (or the Fallen screen). */
  private async settleTurn(): Promise<{ at: 'turn' | 'victory' | 'over'; hp: number }> {
    let last: { at: 'turn' | 'victory' | 'over'; hp: number } = { at: 'over', hp: 1 };
    await expect
      .poll(
        async () => {
          const g = await this.glance();
          if (g.mode !== 'combat' || g.phase === 'defeat') return (last = { at: 'over', hp: g.hp }).at;
          if (g.phase === 'victory') return (last = { at: 'victory', hp: g.hp }).at;
          if (g.phase === 'playerTurn') return (last = { at: 'turn', hp: g.hp }).at;
          return 'waiting';
        },
        { timeout: 20_000, intervals: [25, 50, 100, 250] },
      )
      .not.toBe('waiting');
    return last;
  }

  /** Drinks a healing consumable through the Item sheet; false when there is none to use on yourself. */
  async heal(): Promise<boolean> {
    const item = this.page.getByRole('button', { name: /^I: Item, [1-9]/ });
    if (!(await item.isVisible()) || (await item.getAttribute('aria-disabled')) === 'true') return false;
    await this.press(item);
    const sheet = this.dialog('Use an item');
    await expect(sheet).toBeVisible();
    const use = sheet.getByRole('button', { name: /^Use( on yourself)?: .*(Potion|Tonic|Salve|Draught|Elixir|Bandage|Dressing)/i }).first();
    if ((await use.count()) === 0) {
      await this.page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      return false;
    }
    await this.press(use);
    await expect(sheet).toBeHidden();
    return true;
  }

  /**
   * Fights the current combat through the buttons: the strongest ready damaging ability (`abilities`) else Attack, a healing
   * item below `healBelow` of HP. Stops at the Victory summary (not dismissed), at the end of combat mode ('left'), at the
   * Fallen screen ('defeat'), or after `maxActions` ('defeat').
   */
  async fight(opts: { healBelow?: number; abilities?: boolean; maxActions?: number } = {}): Promise<FightEnd> {
    const healBelow = opts.healBelow ?? 0.35;
    for (let i = 0; i < (opts.maxActions ?? 300); i++) {
      await this.tutorialsOff();
      const { at, hp } = await this.settleTurn();
      if (at === 'victory') return 'victory';
      if (at === 'over') {
        const mode = (await this.state()).mode;
        if (mode === 'combat') return 'defeat';
        // the fight is over: back on the map the Victory summary opens over it (a scene a win opened shows none)
        if (mode === 'explore' && (await this.victory().waitFor({ state: 'visible', timeout: 2000 }).then(() => true, () => false))) return 'victory';
        return 'left';
      }
      if (hp < healBelow && (await this.heal())) continue;
      if (opts.abilities === true && (await this.useAbility())) continue;
      await this.press(this.page.getByRole('button', { name: /^1: Attack/ }));
    }
    return 'defeat';
  }

  /** Uses the highest-numbered damaging ability that is ready (desktop: the grid; phone: the Abilities sheet). */
  async useAbility(): Promise<boolean> {
    const { page } = this;
    let scope: Locator = page.getByRole('region', { name: 'Attack and abilities' });
    if (this.mobile) {
      const opener = page.getByRole('button', { name: /^Abilities, [1-9]/ });
      if (!(await opener.isVisible())) return false;
      await this.press(opener);
      scope = this.dialog('Abilities');
      await expect(scope).toBeVisible();
    }
    const tiles = scope.getByRole('button', { name: /^[2-9]: / });
    const named = await tiles.evaluateAll((els) => els.map((el) => ({ title: el.getAttribute('title') ?? '', off: el.getAttribute('aria-disabled') === 'true' })));
    // what the tile's tooltip says it does: "1.5·ATK Physical to one enemy, …" — the ready one with the biggest multiplier wins
    const power = (title: string): number => Number(/(\d+(?:\.\d+)?)·[A-Z]+ /.exec(title)?.[1] ?? 0);
    const ready = named.map((t, index) => ({ index, power: t.off ? 0 : power(t.title) })).filter((t) => t.power > 0);
    const pick = ready.reduce<(typeof ready)[number] | undefined>((best, t) => (best === undefined || t.power > best.power ? t : best), undefined);
    if (pick === undefined) {
      if (this.mobile) {
        await page.keyboard.press('Escape');
        await expect(scope).toBeHidden();
      }
      return false;
    }
    await this.press(tiles.nth(pick.index));
    if (this.mobile) await expect(scope).toBeHidden();
    return true;
  }

  /** The Victory summary's Continue, waiting for the screen to change. */
  async continueVictory(): Promise<void> {
    await expect(this.victory()).toBeVisible();
    await this.press(this.victory().getByRole('button', { name: 'Continue' }));
    await expect(this.victory()).toBeHidden();
  }
}
