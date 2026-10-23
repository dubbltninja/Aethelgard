// The Combat screen as a whole (U65): `CombatView` built from the model of a real fixture fight (landmarks, names,
// every control reaching its handler), the FALLEN view, the item sheet, the per-step hit record, and the App routing
// combat mode to the screen inside the Shell (server render). Keys, focus and live play are e2e's (tests/e2e/combat.spec.ts).
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalActions, memoryStorage, type Action, type GameEvent } from '@engine/index';
import { loadScenario } from '@sim/scenarios';
import { App } from '@ui/App';
import { CombatView, ItemSheet, hitsOf, type CombatViewProps } from '@ui/screens/CombatScreen';
import {
  abilityTiles,
  combatItems,
  combatLogLines,
  communionButtons,
  communionModel,
  companionCard,
  effectiveTarget,
  enemyCards,
  fightTitle,
  fleeModel,
  guardModel,
  playerPanel,
  turnOrder,
} from '@ui/screens/combatModel';
import { createGameStore } from '@ui/store/gameStore';
import { GameProvider } from '@ui/store/useGame';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, nameOf } from './tree';

const content = fixturePack();
const { state, profile } = loadScenario('first_fight', content, { companionId: 'ilyra' });
const legal = legalActions(state, content, profile);
const combat = state.combat!;
const target = effectiveTarget(combat, null);
const calls: string[] = [];
const log = (what: string) => () => void calls.push(what);

const props: CombatViewProps = {
  title: fightTitle(combat),
  regionId: content.locations[combat.locationId]?.regionId ?? '',
  round: combat.round,
  turns: turnOrder(combat),
  banner: { title: 'Boss · Phase 2 of 3: X', lines: ['The water rises.'] },
  enemies: enemyCards(state, content, profile, legal, target),
  hits: {},
  reducedMotion: true,
  player: playerPanel(state, content)!,
  guard: guardModel(state, content, profile, legal),
  flee: fleeModel(state, content, legal),
  itemCount: 1,
  canItem: true,
  tiles: abilityTiles(state, content, legal, target),
  targetName: 'Corrupted Shade A',
  companion: companionCard(state, content, legal, target),
  communion: communionModel(state, content, profile, legal),
  communionButtons: communionButtons(null),
  showAbilities: false,
  log: combatLogLines(combat, 8),
  logExpanded: false,
  fallen: null,
  menu: { inventory: false, bestiary: false, help: true, settings: true },
  onSelectTarget: (uid) => calls.push(`target ${uid}`),
  onTile: (tile) => calls.push(`tile ${tile.id}`),
  onGuard: log('guard'),
  onFlee: log('flee'),
  onItems: log('items'),
  onStance: (st) => calls.push(`stance ${st}`),
  onAct: (a: Action) => calls.push(`act ${a.type}`),
  onToggleCommuneView: log('view'),
  onToggleLog: log('log'),
  onMenu: (id) => calls.push(`menu ${id}`),
  onLoad: (slot) => calls.push(`load ${slot}`),
  onTitle: log('title'),
};

describe('CombatView', () => {
  test('landmarks and names: one h1 (the fight), enemies as a list, sections by heading, the log as a log', () => {
    const tree = expand(<CombatView {...props} />);
    const h1 = all(tree, 'h1');
    expect(h1.map(nameOf)).toEqual(['Corrupted Shade A and Corrupted Shade B']);
    expect(all(tree, 'ul').find((n) => n.props['aria-label'] === 'Enemies')?.children).toHaveLength(2);
    expect(all(tree, 'h2').map(nameOf)).toEqual(['Wayfinder', 'Attack and abilities', 'Ilyra', 'Combat log']);
    expect(all(tree, 'ol').find((n) => n.props.role === 'log')).toBeDefined();
    expect(all(tree, 'aside').map((n) => n.props['aria-label'])).toEqual(['What changed', 'Combat log']);
    const html = renderToStaticMarkup(<CombatView {...props} />);
    expect(html).toContain('data-screen="combat"');
    expect(html).toContain('The water rises.');
    // every button and radio has a name
    for (const n of [...all(tree, 'button'), ...all(tree, 'input')]) expect(nameOf(n)).not.toBe('');
  });

  test('every control reaches its handler', () => {
    calls.length = 0;
    const tree = expand(<CombatView {...props} />);
    call(byName(tree, 'button', /^Target Corrupted Shade B/), 'onClick');
    call(byName(tree, 'button', /^1: Attack, at Corrupted Shade A/), 'onClick');
    call(byName(tree, 'button', /^G: Guard/), 'onClick');
    call(byName(tree, 'button', /^F: Flee/), 'onClick');
    call(byName(tree, 'button', /^I: Item/), 'onClick');
    call(byName(tree, 'button', 'Show more'), 'onClick');
    call(byName(tree, 'button', 'Keys'), 'onClick');
    call(byName(tree, 'button', 'Settings'), 'onClick');
    call(byName(tree, 'button', /^Focus on/), 'onClick');
    const free = all(tree, 'input').find((n) => n.props.disabled === false && n.props.checked === false)!;
    call(free, 'onChange');
    expect(calls).toEqual([
      `target ${combat.enemies[1]!.uid}`,
      'tile attack',
      'guard',
      'flee',
      'items',
      'log',
      'menu help',
      'menu settings',
      'act companionCommand',
      `stance ${String(free.props.value)}`,
    ]);
  });

  test('FALLEN: the loads and the title, the bars gone', () => {
    calls.length = 0;
    const fallen = { loads: [{ slot: 'auto' as const, label: 'Load the autosave' }, { slot: 2 as const, label: 'Load slot 2' }], canTitle: true };
    const tree = expand(<CombatView {...props} fallen={fallen} />);
    expect(all(tree, 'h2').map(nameOf)).toContain('FALLEN');
    expect(all(tree, 'button').some((n) => /^1: Attack/.test(nameOf(n)))).toBe(false);
    const auto = byName(tree, 'button', 'Load the autosave');
    expect(auto.props['data-autofocus']).toBe('');
    call(auto, 'onClick');
    call(byName(tree, 'button', 'Load slot 2'), 'onClick');
    call(byName(tree, 'button', 'Return to title'), 'onClick');
    expect(calls).toEqual(['load auto', 'load 2', 'title']);
    const bare = expand(<CombatView {...props} fallen={{ loads: [], canTitle: true }} />);
    expect(byName(bare, 'button', 'Return to title').props['data-autofocus']).toBe('');
  });

  test('while communing the communion takes the bar; "Show abilities" brings it back', () => {
    const { state: cs, profile: cp } = loadScenario('communion_movement_2', content);
    const cl = legalActions(cs, content, cp);
    const m = communionModel(cs, content, cp, cl);
    const communing = { ...props, communion: m, communionButtons: communionButtons(m) };
    const tree = expand(<CombatView {...communing} />);
    expect(all(tree, 'h2').map(nameOf)).toContain('Communion with The Chronos Tyrant');
    expect(all(tree, 'button').some((n) => /^1: Attack/.test(nameOf(n)))).toBe(false);
    expect(all(tree, 'button').some((n) => /^\d: Listen$/.test(nameOf(n)))).toBe(true);
    const back = expand(<CombatView {...communing} showAbilities />);
    expect(all(back, 'button').some((n) => /^1: Attack/.test(nameOf(n)))).toBe(true);
  });
});

describe('ItemSheet and hitsOf', () => {
  test('one button per use, named with the item', () => {
    const used: Action[] = [];
    const items = combatItems(state, content, legal, target);
    const tree = expand(<ItemSheet items={items} onUse={(a) => used.push(a)} />);
    const first = all(tree, 'button')[0]!;
    expect(nameOf(first)).toBe(`${items[0]!.uses[0]!.label}: ${items[0]!.name}`);
    expect(first.props['data-autofocus']).toBe('');
    call(first, 'onClick');
    expect(used[0]?.type).toBe('item');
    expect(renderToStaticMarkup(<ItemSheet items={[]} onUse={() => undefined} />)).toContain('You carry nothing you can use in a fight.');
  });

  test('the floating number sums a step’s hits on each enemy, and remembers a crit', () => {
    const [a, b] = combat.enemies.map((e) => e.uid) as [string, string];
    const p = combat.party[0]!.uid;
    const events: GameEvent[] = [
      { t: 'attackResolved', sourceUid: p, targetUid: a, hit: true, crit: true },
      { t: 'damageDealt', sourceUid: p, targetUid: a, amount: 7, damageType: 'physical', mitigated: 0, absorbed: 0, kind: 'basic', refId: null },
      { t: 'damageDealt', sourceUid: p, targetUid: a, amount: 3, damageType: 'physical', mitigated: 0, absorbed: 0, kind: 'status', refId: 'status_bleed' },
      { t: 'damageDealt', sourceUid: p, targetUid: b, amount: 2, damageType: 'fire', mitigated: 0, absorbed: 0, kind: 'ability', refId: null },
      { t: 'damageDealt', sourceUid: a, targetUid: p, amount: 6, damageType: 'physical', mitigated: 0, absorbed: 0, kind: 'intent', refId: null },
    ];
    expect(hitsOf(events, state, 4)).toEqual({ [a]: { amount: 10, crit: true, nonce: 4 }, [b]: { amount: 2, crit: false, nonce: 4 } });
  });
});

describe('routing', () => {
  test('the App renders the Combat screen for combat mode, in the Shell (server render)', () => {
    const store = createGameStore(content, profile, { initialState: state, storage: memoryStorage() });
    const html = renderToStaticMarkup(
      <GameProvider value={store}>
        <App />
      </GameProvider>,
    );
    expect(html).toContain('data-screen="combat"');
    expect(html).toContain('id="combat-heading"');
    expect(html).toContain('class="combat-root"');
    expect(html).not.toContain('role="dialog"'); // no summary until a fight ends
    // a Loop 1 death: the FALLEN screen, with the way to the title
    const dead = structuredClone(state);
    dead.combat!.phase = 'defeat';
    dead.combat!.party[0]!.alive = false;
    const fallen = createGameStore(content, profile, { initialState: dead, storage: memoryStorage() });
    const fallenHtml = renderToStaticMarkup(
      <GameProvider value={fallen}>
        <App />
      </GameProvider>,
    );
    expect(fallenHtml).toContain('FALLEN');
    expect(fallenHtml).toContain('Return to title');
    // combat mode with no fight left still offers a way out
    const empty = createGameStore(content, profile, { initialState: { ...state, combat: null }, storage: null });
    const emptyHtml = renderToStaticMarkup(
      <GameProvider value={empty}>
        <App />
      </GameProvider>,
    );
    expect(emptyHtml).toContain('The fight is over');
  });

  test('a store-driven fight: the summary model follows the engine’s own victory', () => {
    const store = createGameStore(content, profile, { initialState: structuredClone(state), storage: null });
    const seen: GameEvent[][] = [];
    store.onEvents((events) => seen.push(events));
    for (let i = 0; i < 80 && store.getState().mode === 'combat'; i++) {
      const s = store.getState();
      const t = effectiveTarget(s.combat, null);
      if (t === null) break;
      store.dispatch(store.isLegal({ type: 'attack', targetUid: t }) ? { type: 'attack', targetUid: t } : { type: 'guard' });
    }
    expect(store.getState().mode).toBe('explore');
    expect(seen.flat().some((e) => e.t === 'combatEnded' && e.result === 'victory')).toBe(true);
  });
});
