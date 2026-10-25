// The phone action bar (U73 part B, D-130): its model splits the ability tiles (Attack in the bar, the rest in the sheet);
// the bar keeps every desktop name and key and reaches the same handlers; a phone's CombatView draws the bar and no second
// Guard, Attack or ability grid, and a desktop's draws none of it; the communion takes the bar's place.
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalActions } from '@engine/index';
import { loadScenario } from '@sim/scenarios';
import { PhoneBar } from '@ui/components/combat/PhoneBar';
import { abilitiesName, guardNote, phoneBarModel } from '@ui/components/combat/phoneBarModel';
import { CombatView, type CombatViewProps } from '@ui/screens/CombatScreen';
import {
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
  combatLogLines,
  type AbilityTileModel,
} from '@ui/screens/combatModel';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand } from './tree';

const content = fixturePack();
const { state, profile } = loadScenario('first_fight', content, { companionId: 'ilyra' });
const legal = legalActions(state, content, profile);
const combat = state.combat!;
const target = effectiveTarget(combat, null);
const calls: string[] = [];

const tile = (over: Partial<AbilityTileModel>): AbilityTileModel => ({
  id: 'ab',
  kind: 'ability',
  name: 'Marked Shot',
  description: '',
  branch: null,
  branchName: 'Hunt',
  branchIndex: 0,
  tier: 1,
  cost: '8 Focus',
  blood: false,
  cooldown: 0,
  target: 'enemy',
  damageType: 'physical',
  enabled: true,
  reason: null,
  key: '2',
  ...over,
});
const attackTile = tile({ id: 'attack', kind: 'attack', name: 'Attack', cost: null, key: '1', branchName: 'Basic', tier: null });

describe('phoneBarModel', () => {
  test('Attack is the bar\'s, every other tile is the sheet\'s, and ready counts the ones you can use', () => {
    const tiles = [attackTile, tile({ id: 'a' }), tile({ id: 'b', enabled: false, reason: 'Needs 8 Focus' }), tile({ id: 'c' })];
    const model = phoneBarModel(tiles);
    expect(model.attack?.id).toBe('attack');
    expect(model.abilities.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(model.ready).toBe(2);
    expect(abilitiesName(model)).toBe('Abilities, 2 ready');
    expect(abilitiesName(phoneBarModel([attackTile, tile({ enabled: false })]))).toBe('Abilities, none ready');
    expect(phoneBarModel([attackTile])).toEqual({ attack: attackTile, abilities: [], ready: 0 });
    expect(phoneBarModel([])).toEqual({ attack: null, abilities: [], ready: 0 });
  });

  test('the Guard numbers become one line for the panel', () => {
    expect(guardNote([])).toBeNull();
    expect(guardNote(['Rake 6–8 → 3–4', 'Maul 14–17 → 7–9'])).toBe('If you Guard: Rake 6–8 → 3–4; Maul 14–17 → 7–9');
  });
});

const baseProps = {
  title: fightTitle(combat),
  regionId: content.locations[combat.locationId]?.regionId ?? '',
  round: combat.round,
  turns: turnOrder(combat),
  banner: null,
  enemies: enemyCards(state, content, profile, legal, target),
  hits: {},
  reducedMotion: true,
  player: playerPanel(state, content)!,
  guard: guardModel(state, content, profile, legal),
  flee: fleeModel(state, content, legal),
  itemCount: 1,
  canItem: true,
  tiles: [attackTile, tile({ id: 'ab_one' }), tile({ id: 'ab_two', key: '3', name: 'Piercing Arrow', enabled: false, reason: 'Needs 12 Focus' })],
  targetName: 'Corrupted Shade A',
  companion: companionCard(state, content, legal, target),
  communion: communionModel(state, content, profile, legal),
  communionButtons: communionButtons(null),
  showAbilities: false,
  log: combatLogLines(combat, 8),
  logExpanded: false,
  fallen: null,
  menu: { inventory: false, bestiary: false, help: true, settings: true },
  onSelectTarget: () => undefined,
  onTile: (t: AbilityTileModel) => calls.push(`tile ${t.id}`),
  onGuard: () => calls.push('guard'),
  onFlee: () => calls.push('flee'),
  onItems: () => calls.push('items'),
  onStance: () => undefined,
  onAct: () => undefined,
  onToggleCommuneView: () => undefined,
  onToggleLog: () => undefined,
  onMenu: () => undefined,
  onLoad: () => undefined,
  onTitle: () => undefined,
} satisfies CombatViewProps;

describe('PhoneBar', () => {
  const bar = (over: Partial<Parameters<typeof PhoneBar>[0]> = {}) => (
    <PhoneBar
      model={phoneBarModel(baseProps.tiles)}
      targetName="Corrupted Shade A"
      guard={baseProps.guard}
      flee={baseProps.flee}
      itemCount={2}
      canItem
      onAttack={(t) => calls.push(`attack ${t.id}`)}
      onGuard={() => calls.push('guard')}
      onFlee={() => calls.push('flee')}
      onItems={() => calls.push('items')}
      onAbilities={() => calls.push('abilities')}
      {...over}
    />
  );

  test('every button keeps its desktop name and key and reaches its handler', () => {
    calls.length = 0;
    const tree = expand(bar());
    const group = all(tree, 'div').find((n) => n.props.role === 'group');
    expect(group?.props['aria-label']).toBe('Turn actions');
    const buttons = all(tree, 'button');
    expect(buttons.map((b) => b.props['data-action'])).toEqual(['attack', 'guard', 'items', 'flee', 'abilities']);
    const attack = byName(tree, 'button', /^1: Attack, at Corrupted Shade A/);
    expect(attack.props['data-autofocus']).toBe('');
    expect(attack.props['aria-keyshortcuts']).toBe('1');
    call(attack, 'onClick');
    call(byName(tree, 'button', /^G: Guard/), 'onClick');
    call(byName(tree, 'button', 'I: Item, 2 you can use'), 'onClick');
    call(byName(tree, 'button', /^F: Flee, \d+% chance/), 'onClick');
    call(byName(tree, 'button', 'Abilities, 1 ready'), 'onClick');
    expect(calls).toEqual(['attack attack', 'guard', 'items', 'flee', 'abilities']);
  });

  test('a button that cannot be used stays focusable, says so, and does nothing', () => {
    calls.length = 0;
    const tree = expand(bar({ canItem: false, itemCount: 0 }));
    const item = byName(tree, 'button', 'I: Item, nothing you can use');
    expect(item.props['aria-disabled']).toBe('true');
    expect(item.props.disabled).toBeUndefined();
    call(item, 'onClick');
    expect(calls).toEqual([]);
  });

  test('no Flee button when fleeing is not a choice, and no Abilities button without abilities', () => {
    const tree = expand(bar({ flee: { ...baseProps.flee, shown: false }, model: phoneBarModel([attackTile]) }));
    expect(all(tree, 'button').map((b) => b.props['data-action'])).toEqual(['attack', 'guard', 'items']);
  });

  test('Leaving the Tyrant is the danger style', () => {
    const tree = expand(bar({ flee: { ...baseProps.flee, shown: true, leave: true, enabled: true } }));
    expect(byName(tree, 'button', /^F: Leave/).props.className).toContain('phone-bar__btn--danger');
  });
});

describe('CombatView on a phone', () => {
  test('the bar is drawn, the panel buttons and the ability grid are not', () => {
    const phone = renderToStaticMarkup(<CombatView {...baseProps} phone />);
    expect(phone).toContain('class="phone-bar"');
    expect(phone.match(/data-action="guard"/g)).toHaveLength(1);
    expect(phone).not.toContain('Attack and abilities');
    expect(phone).not.toContain('data-tile=');
    expect(phone).toContain('class="player-panel__guard-note"');
    const desktop = renderToStaticMarkup(<CombatView {...baseProps} />);
    expect(desktop).not.toContain('phone-bar');
    expect(desktop).toContain('Attack and abilities');
    expect(desktop.match(/data-action="guard"/g)).toHaveLength(1);
    expect(desktop).not.toContain('player-panel__guard-note');
  });

  test('FALLEN has no bar, even on a phone', () => {
    const fallen = { loads: [], canTitle: true };
    expect(renderToStaticMarkup(<CombatView {...baseProps} phone fallen={fallen} />)).not.toContain('phone-bar');
  });

  test('the communion takes the bar\'s place while it runs; "show abilities" gives the bar back', () => {
    const communion = { ...baseProps.communion!, active: true, bossName: 'The Chronos Tyrant', resolve: 5, resolveMax: 8, movement: 2, questionIndex: 1, questionCount: 6, question: 'What have you read?', resolution: null, lies: 0, openReason: null };
    const buttons = [{ id: 'listen', key: '1', label: 'Listen', group: 'listen' as const, enabled: true, reason: null, action: { type: 'listen' } as never }];
    const running = renderToStaticMarkup(<CombatView {...baseProps} phone communion={communion} communionButtons={buttons} />);
    expect(running).toContain('phone-dock--communion');
    expect(running).not.toContain('class="phone-bar"');
    expect(running.match(/Communion with The Chronos Tyrant/g)).toHaveLength(1);
    const striking = renderToStaticMarkup(<CombatView {...baseProps} phone communion={communion} communionButtons={buttons} showAbilities />);
    expect(striking).toContain('class="phone-bar"');
    expect(striking).not.toContain('phone-dock--communion');
  });
});
