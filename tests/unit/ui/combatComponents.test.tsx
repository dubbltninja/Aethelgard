// The Combat screen's components (U65; PLAN §8.3 `enemyCard` / `abilityBar`): render, interaction and accessible names,
// driven through tests/unit/ui/tree.ts (the components are pure). Also the art they draw: <CreatureSigil> and the
// damage-type and status glyphs.
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Action } from '@engine/index';
import { CreatureSigil, animatedDetail, familyGlyph } from '@ui/art/CreatureSigil';
import { ICON_KINDS, damageIcon, statusIcon } from '@ui/art/Icon';
import { AbilityBar, tierDots, tileGroups } from '@ui/components/combat/AbilityBar';
import { CombatLog } from '@ui/components/combat/CombatLog';
import { CombatSummaryView } from '@ui/components/combat/CombatSummary';
import { CommunionBar, ResolveMeter, communionButtonName } from '@ui/components/combat/CommunionBar';
import { CompanionCard, commandName } from '@ui/components/combat/CompanionCard';
import { EnemyCard, SegmentedBar, enemySelectName } from '@ui/components/combat/EnemyCard';
import { IntentChip } from '@ui/components/combat/IntentChip';
import { PlayerPanel, fleeName, guardName } from '@ui/components/combat/PlayerPanel';
import { StatusChips } from '@ui/components/combat/StatusChips';
import { TurnOrder } from '@ui/components/combat/TurnOrder';
import {
  communionButtons,
  type AbilityTileModel,
  type CommunionModel,
  type CompanionCardModel,
  type EnemyCardModel,
  type IntentChipModel,
  type StatusChipModel,
} from '@ui/screens/combatModel';
import { all, byName, call, expand, fakeEvent, nameOf } from './tree';

const bleed: StatusChipModel = { id: 'status_bleed', name: 'Bleed', icon: 'status_bleed', kind: 'debuff', stacks: 2, turns: 3, amount: null, text: 'Bleed ×2 · 3', label: 'Bleed, 2 stacks, 3 turns left' };
const intent: IntentChipModel = {
  moveId: 'brute_maul',
  hidden: false,
  name: 'Maul',
  glyph: 'dmg_physical',
  damageType: 'physical',
  range: '14–17',
  guarded: '7–9',
  target: 'you',
  targetKind: 'player',
  tags: ['may Weaken', 'winding up'],
  line: 'It rears back.',
  windUpThen: 'Crush',
  question: false,
  next: false,
  label: 'Intent: Maul, physical, 14 to 17 damage, targeting you, may Weaken.',
};
const enemy: EnemyCardModel = {
  uid: 'c5',
  creatureId: 'cr_wildling_brute',
  name: 'Wildling Brute',
  level: 4,
  rank: 'Boss',
  hp: 40,
  hpMax: 64,
  alive: true,
  segments: [0.66, 0.33],
  phase: { index: 1, count: 3, name: 'The Fracture' },
  statuses: [bleed],
  resistances: [{ type: 'fire', name: 'Fire', level: 'weak', text: 'weak Fire' }],
  intent,
  next: { ...intent, next: true, name: 'Strike', label: 'Then: Strike, physical.', range: '' },
  sigil: { base: 'triangle', accent: 'ironclad', details: ['double_outline', 'drip'] },
  family: 'fam_wilds',
  selected: true,
  targetable: true,
  acting: false,
};

describe('StatusChips and IntentChip', () => {
  test('a status chip is glyph + text, with a spoken label; none renders nothing', () => {
    const html = renderToStaticMarkup(<StatusChips statuses={[bleed]} label="Brute: statuses" />);
    expect(html).toContain('aria-label="Brute: statuses"');
    expect(html).toContain('data-icon="status_bleed"');
    expect(html).toContain('Bleed ×2 · 3');
    expect(html).toContain('Bleed, 2 stacks, 3 turns left');
    expect(renderToStaticMarkup(<StatusChips statuses={[]} label="x" />)).toBe('');
  });

  test('the intent chip: glyph, name, range, target, tags and the wind-up; hidden is "?" only; next is dimmed', () => {
    const tree = expand(<IntentChip intent={intent} />);
    const chip = all(tree, 'p').find((n) => n.props.role === 'img')!;
    expect(nameOf(chip)).toBe(intent.label);
    const html = renderToStaticMarkup(<IntentChip intent={intent} />);
    for (const bit of ['Maul', '14–17', '→ you', 'may Weaken · winding up → Crush', 'It rears back.', 'data-damage-type="physical"']) expect(html).toContain(bit);
    const hidden = renderToStaticMarkup(<IntentChip intent={{ ...intent, hidden: true, name: '?', label: 'Intent: hidden.' }} />);
    expect(hidden).toContain('intent--hidden');
    expect(hidden).not.toContain('14–17');
    expect(hidden).not.toContain('It rears back.');
    const area = renderToStaticMarkup(<IntentChip intent={{ ...intent, targetKind: 'all', target: 'ALL', tags: [] }} withLine={false} />);
    expect(area).toContain('>ALL<');
    expect(area).not.toContain('It rears back.');
    const next = renderToStaticMarkup(<IntentChip intent={{ ...intent, next: true }} />);
    expect(next).toContain('intent--next');
    expect(next).toContain('Then');
  });
});

describe('EnemyCard', () => {
  test('one select button named by the enemy; the HP meter; phase, statuses, resistances, both intents', () => {
    const select = mock((_uid: string) => undefined);
    const tree = expand(<EnemyCard enemy={enemy} reducedMotion={false} hit={{ amount: 12, crit: true, nonce: 1 }} onSelect={select} />);
    const button = byName(tree, 'button', 'Target Wildling Brute, level 4, boss');
    expect(button.props['aria-pressed']).toBe(true);
    call(button, 'onClick');
    expect(select.mock.calls).toEqual([['c5']]);
    const meter = all(tree, 'div').find((n) => n.props.role === 'meter')!;
    expect(meter.props['aria-label']).toBe('Wildling Brute HP');
    expect(meter.props['aria-valuenow']).toBe(40);
    const html = renderToStaticMarkup(<EnemyCard enemy={enemy} reducedMotion={false} hit={{ amount: 12, crit: true, nonce: 1 }} onSelect={select} />);
    for (const bit of ['Phase 2 of 3: The Fracture', 'hp-bar__tick', 'left:66%', 'weak Fire', 'Then', 'float-number--crit', '−12', 'creature-sigil--hit', '>Target<']) expect(html).toContain(bit);
    // reduced motion: no floating number, no animated detail
    const still = renderToStaticMarkup(<EnemyCard enemy={enemy} reducedMotion hit={{ amount: 12, crit: false, nonce: 2 }} onSelect={select} />);
    expect(still).not.toContain('float-number');
    expect(still).not.toContain('sigil__drip');
  });

  test('a fallen enemy is "down": not pressable, no intent', () => {
    const select = mock((_uid: string) => undefined);
    const down = { ...enemy, alive: false, selected: false, intent: null, next: null, rank: null, phase: null, resistances: null };
    const tree = expand(<EnemyCard enemy={down} reducedMotion onSelect={select} />);
    const button = byName(tree, 'button', 'Wildling Brute, down');
    expect(button.props['aria-disabled']).toBe('true');
    call(button, 'onClick');
    expect(select.mock.calls).toHaveLength(0);
    const html = renderToStaticMarkup(<EnemyCard enemy={down} reducedMotion onSelect={select} />);
    expect(html).toContain('>Down<');
    expect(html).toContain('creature-sigil--ko');
    expect(enemySelectName({ ...enemy, rank: null })).toBe('Target Wildling Brute, level 4');
    expect(renderToStaticMarkup(<SegmentedBar label="x" value={5} max={0} />)).toContain('width:0%');
  });
});

describe('AbilityBar (PLAN §8.3 abilityBar.test)', () => {
  const tile = (over: Partial<AbilityTileModel>): AbilityTileModel => ({
    id: 'attack',
    kind: 'attack',
    name: 'Attack',
    description: '',
    branch: null,
    branchName: 'Weapon',
    branchIndex: -1,
    tier: null,
    cost: null,
    blood: false,
    bloodable: false,
    empowered: false,
    cooldown: 0,
    target: 'enemy',
    damageType: 'physical',
    enabled: true,
    reason: null,
    key: '1',
    ...over,
  });
  const tiles = [
    tile({}),
    tile({ id: 'rgr_marked_shot', kind: 'ability', name: 'Marked Shot', branch: 'hunt', branchName: 'Hunt', branchIndex: 0, tier: 1, cost: '8 Focus', key: '2', description: 'Prey.' }),
    tile({ id: 'rgr_rend', kind: 'ability', name: 'Rend', branch: 'steel', branchName: 'Steel', branchIndex: 1, tier: 2, cost: '6 Focus', cooldown: 2, enabled: false, reason: 'Cooldown 2', key: '3' }),
    tile({ id: 'wvr_blood', kind: 'ability', name: 'Blood Rite', branchName: 'Steel', branchIndex: 1, tier: 3, cost: '4 HP', blood: true, enabled: false, reason: 'Not enough blood', key: '4', target: 'ally', damageType: null }),
  ];

  test('tiles grouped by branch, numbered in displayed order, disabled ones say why and do nothing', () => {
    const use = mock((_t: AbilityTileModel) => undefined);
    const tree = expand(<AbilityBar tiles={tiles} targetName="Corrupted Shade" onUse={use} />);
    expect(all(tree, 'div').filter((n) => n.props.role === 'group').map(nameOf)).toEqual(['Weapon', 'Hunt', 'Steel']);
    const attack = byName(tree, 'button', '1: Attack, at Corrupted Shade');
    expect(attack.props['data-autofocus']).toBe('');
    expect(attack.props['aria-keyshortcuts']).toBe('1');
    call(attack, 'onClick');
    call(byName(tree, 'button', '2: Marked Shot, at Corrupted Shade, 8 Focus'), 'onClick');
    const rend = byName(tree, 'button', '3: Rend, 6 Focus, Cooldown 2');
    expect(rend.props['aria-disabled']).toBe('true');
    call(rend, 'onClick');
    call(byName(tree, 'button', '4: Blood Rite, 4 HP, Not enough blood'), 'onClick');
    expect(use.mock.calls.map((c) => c[0].id)).toEqual(['attack', 'rgr_marked_shot']);
    const html = renderToStaticMarkup(<AbilityBar tiles={tiles} targetName={null} onUse={use} extra={<span>extra</span>} />);
    for (const bit of ['●○○○○', '●●○○○', 'tile__cost--blood', 'tile__cooldown', 'Not enough blood', 'title="Prey."', '<span>extra</span>']) expect(html).toContain(bit);
    expect(tileGroups(tiles).map((g) => g.tiles.length)).toEqual([1, 1, 2]);
    expect(tierDots(null)).toBe('');
  });
});

describe('PlayerPanel', () => {
  const player = { name: 'Wayfinder', hp: 90, hpMax: 120, mp: 20, mpMax: 48, resourceName: 'Focus', statuses: [bleed], guarding: true };
  const guard = { enabled: true, reason: null, previews: ['Maul 14–17 → 7–9'] };
  const flee = { shown: true, enabled: true, chance: 55, reason: null, leave: false, label: 'Flee · 55%' };

  test('meters, Guard with its previews, Flee with its odds, Item; each runs only when enabled', () => {
    const calls: string[] = [];
    const props = { player, guard, flee, itemCount: 2, canItem: true, onGuard: () => calls.push('guard'), onFlee: () => calls.push('flee'), onItems: () => calls.push('items') };
    const tree = expand(<PlayerPanel {...props} />);
    expect(all(tree, 'div').filter((n) => n.props.role === 'meter').map(nameOf)).toEqual(['HP', 'Focus']);
    call(byName(tree, 'button', 'G: Guard, halves the next hits, Maul 14–17 → 7–9'), 'onClick');
    call(byName(tree, 'button', 'F: Flee, 55% chance'), 'onClick');
    call(byName(tree, 'button', 'I: Item, 2 you can use'), 'onClick');
    expect(calls).toEqual(['guard', 'flee', 'items']);
    expect(renderToStaticMarkup(<PlayerPanel {...props} />)).toContain('· Guarding');

    calls.length = 0;
    const off = expand(<PlayerPanel {...props} guard={{ enabled: false, reason: 'Not your turn', previews: [] }} flee={{ ...flee, enabled: false, reason: 'You are slowed and cannot flee' }} itemCount={0} canItem={false} />);
    for (const n of all(off, 'button')) call(n, 'onClick');
    expect(calls).toEqual([]);
    expect(nameOf(byName(off, 'button', /^I: Item/))).toBe('I: Item, nothing you can use');
    expect(guardName({ enabled: false, reason: 'Not your turn', previews: [] })).toBe('G: Guard, halves the next hits, Not your turn');
    expect(fleeName({ ...flee, leave: true })).toBe('F: Leave. The loop ends.');
    expect(renderToStaticMarkup(<PlayerPanel {...props} flee={{ ...flee, shown: false }} />)).not.toContain('data-action="flee"');
    expect(renderToStaticMarkup(<PlayerPanel {...props} flee={{ ...flee, leave: true }} />)).toContain('combat-action--danger');
  });
});

describe('CompanionCard', () => {
  const companion: CompanionCardModel = {
    uid: 'c6',
    companionId: 'ilyra',
    name: 'Ilyra',
    hp: 30,
    hpMax: 40,
    ko: false,
    stance: 'guarded',
    stances: [
      { stance: 'aggressive', label: 'Aggressive', enabled: true, current: false },
      { stance: 'guarded', label: 'Guarded', enabled: false, current: true },
      { stance: 'support', label: 'Support', enabled: false, current: false },
    ],
    stanceNote: null,
    signature: { name: 'Archive Light', description: 'Light.', cooldown: 0, enabled: true, reason: null, target: 'none', action: { type: 'companionCommand', command: 'signature' } },
    focus: { enabled: true, action: { type: 'companionCommand', command: 'focus', targetUid: 'c5' }, label: 'Focus on Corrupted Shade' },
    hold: { enabled: false, action: { type: 'companionCommand', command: 'hold' } },
    statuses: [],
  };

  test('stance radios, Command, the orders', () => {
    const stances: string[] = [];
    const acts: Action[] = [];
    const tree = expand(<CompanionCard companion={companion} onStance={(s) => stances.push(s)} onCommand={(a) => acts.push(a)} />);
    const radios = all(tree, 'input');
    expect(radios.map(nameOf)).toEqual(['Aggressive', 'Guarded', 'Support']);
    expect(radios.map((r) => r.props.checked)).toEqual([false, true, false]);
    expect(radios.map((r) => r.props.disabled)).toEqual([false, false, true]);
    for (const r of radios) call(r, 'onChange', fakeEvent());
    expect(stances).toEqual(['aggressive']);
    call(byName(tree, 'button', 'C: Command Ilyra: Archive Light, uses your action'), 'onClick');
    call(byName(tree, 'button', 'Focus on Corrupted Shade'), 'onClick');
    call(byName(tree, 'button', 'Hold and guard'), 'onClick');
    expect(acts.map((a) => (a.type === 'companionCommand' ? a.command : a.type))).toEqual(['signature', 'focus']);
    expect(all(tree, 'div').find((n) => n.props.role === 'meter')?.props['aria-label']).toBe('Ilyra HP');
    expect(commandName({ ...companion, signature: { ...companion.signature!, enabled: false, reason: 'Cooldown 2' } })).toBe('C: Command Ilyra: Archive Light, uses your action, Cooldown 2');
    expect(commandName({ ...companion, signature: null })).toBe('C: Command');
  });

  test('knocked out: says so, no Command, no orders', () => {
    const html = renderToStaticMarkup(<CompanionCard companion={{ ...companion, ko: true, stanceNote: 'You have no companion with you' }} onStance={() => undefined} onCommand={() => undefined} />);
    expect(html).toContain('Knocked out');
    expect(html).not.toContain('data-action="command"');
    expect(html).not.toContain('Hold and guard');
    expect(html).toContain('You have no companion with you');
  });
});

describe('CombatLog and TurnOrder', () => {
  test('the log is the record (role=log, not live); an explained hit expands; the toggle says what it does', () => {
    const toggle = mock(() => undefined);
    const lines = [
      { key: '1:0', round: 1, text: 'Something steps out.', kind: 'system', explain: null },
      { key: '1:1', round: 1, text: 'Wayfinder hits Corrupted Shade for 12.', kind: 'damage', explain: ['Basic attack: Physical damage.', '12 damage to Corrupted Shade.'] },
    ];
    const tree = expand(<CombatLog lines={lines} expanded={false} onToggle={toggle} />);
    const list = all(tree, 'ol').find((n) => n.props.role === 'log')!;
    expect(list.props['aria-live']).toBe('off');
    const button = byName(tree, 'button', 'Show more');
    expect(button.props['aria-expanded']).toBe(false);
    call(button, 'onClick');
    expect(toggle).toHaveBeenCalledTimes(1);
    const html = renderToStaticMarkup(<CombatLog lines={lines} expanded onToggle={toggle} />);
    expect(html).toContain('<summary>Wayfinder hits Corrupted Shade for 12.</summary>');
    expect(html).toContain('<li>12 damage to Corrupted Shade.</li>');
    expect(html).toContain('Show less');
    expect(html).toContain('data-expanded="true"');
  });

  test('the turn order marks the actor', () => {
    const html = renderToStaticMarkup(
      <TurnOrder
        round={2}
        entries={[
          { uid: 'a', name: 'You', kind: 'player', current: true, done: false },
          { uid: 'b', name: 'Shade', kind: 'enemy', current: false, done: false },
        ]}
      />,
    );
    expect(html).toContain('Round 2');
    expect(html).toContain('aria-label="Turn order, round 2"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('(acting now)');
  });
});

describe('CommunionBar', () => {
  const model: CommunionModel = {
    bossName: 'The Chronos Tyrant',
    active: true,
    canToggle: false,
    canOpenByListening: false,
    openReason: null,
    movement: 2,
    resolve: 5,
    resolveMax: 8,
    questionIndex: 1,
    questionCount: 6,
    question: "'What have you read?'",
    answers: [
      { id: 'a', text: 'Your margins.', enabled: false, reason: 'Needs Echo: The Margins', action: { type: 'commune', act: 'speak', answerId: 'a' } },
      { id: 'b', text: 'Enough to owe.', enabled: true, reason: null, action: { type: 'commune', act: 'speak', answerId: 'b' } },
    ],
    listen: { enabled: true, reason: null },
    offers: [{ id: 'item_lens', text: 'Chronos Lens', enabled: false, reason: 'You do not carry it', action: { type: 'commune', act: 'offer', itemId: 'item_lens' } }],
    resist: true,
    resolution: null,
    lies: 1,
  };

  test('Resolve as eight pips, the question, numbered acts with reasons; only enabled ones act; the view toggle', () => {
    const acts: Action[] = [];
    const view = mock(() => undefined);
    const buttons = communionButtons(model);
    const tree = expand(<CommunionBar model={model} buttons={buttons} showingAbilities={false} onAct={(a) => acts.push(a)} onToggleView={view} />);
    const meter = all(tree, 'div').find((n) => n.props.role === 'meter')!;
    expect(meter.props['aria-valuenow']).toBe(5);
    expect(meter.props['aria-valuemax']).toBe(8);
    const names = all(tree, 'button').map(nameOf);
    expect(names).toEqual([
      '1: Speak: Your margins., Needs Echo: The Margins',
      '2: Speak: Enough to owe.',
      '3: Listen',
      '4: Offer: Chronos Lens, You do not carry it',
      '5: Resist',
      'Show abilities (striking forfeits the question)',
    ]);
    for (const n of all(tree, 'button')) call(n, 'onClick');
    expect(acts.map((a) => (a.type === 'commune' ? a.act : a.type))).toEqual(['speak', 'listen', 'resist']);
    expect(view).toHaveBeenCalledTimes(1);
    expect(byName(tree, 'button', '2: Speak: Enough to owe.').props['data-autofocus']).toBe('');
    const html = renderToStaticMarkup(<CommunionBar model={model} buttons={buttons} showingAbilities={false} onAct={() => undefined} onToggleView={view} />);
    expect(html).toContain('Movement 2 · question 1 of 6 · 1 lie told');
    expect(html).toContain('What have you read?');
    expect(html.match(/resolve__pip--on/g)).toHaveLength(5);
    // showing the abilities hides the acts; the toggle says how to come back
    const back = renderToStaticMarkup(<CommunionBar model={model} buttons={buttons} showingAbilities onAct={() => undefined} onToggleView={view} />);
    expect(back).not.toContain('tile--commune');
    expect(back).toContain('Show the communion');
    expect(communionButtonName({ ...buttons[0]!, key: null, reason: null })).toBe('Speak: Your margins.');
  });

  test('closed: the reason or the openers; the Resolution: the outcomes only', () => {
    const closed = { ...model, active: false, openReason: 'Communion opens only on your first turn or at a phase transition' };
    const html = renderToStaticMarkup(<CommunionBar model={closed} buttons={communionButtons(closed)} showingAbilities={false} onAct={() => undefined} onToggleView={() => undefined} />);
    expect(html).toContain('Communion opens only on your first turn');
    expect(html).not.toContain('role="meter"');
    const spared = { ...model, resolution: [{ id: 'pass', text: 'Pass', enabled: true, reason: null, action: { type: 'commune', act: 'speak', answerId: 'pass' } as Action }] };
    const tree = expand(<CommunionBar model={spared} buttons={communionButtons(spared)} showingAbilities={false} onAct={() => undefined} onToggleView={() => undefined} />);
    expect(all(tree, 'button').map(nameOf)).toEqual(['1: Pass']);
    expect(renderToStaticMarkup(<ResolveMeter value={0} max={8} />)).not.toContain('resolve__pip--on');
  });
});

describe('CombatSummaryView', () => {
  test('lines with glyphs and a focused Continue', () => {
    const go = mock(() => undefined);
    const tree = expand(<CombatSummaryView summary={{ result: 'victory', title: 'Victory', lines: ['Won in 3 rounds.', '+40 XP', '+7 gold', 'Level 2! 1 stat point to spend.', 'Glow Moss'] }} onContinue={go} />);
    const cont = byName(tree, 'button', 'Continue');
    expect(cont.props['data-autofocus']).toBe('');
    call(cont, 'onClick');
    expect(go).toHaveBeenCalledTimes(1);
    const html = renderToStaticMarkup(<CombatSummaryView summary={{ result: 'victory', title: 'Victory', lines: ['Won in 3 rounds.', '+40 XP', '+7 gold', 'Level 2!', 'Glow Moss'] }} onContinue={go} />);
    for (const icon of ['xp', 'gold', 'level', 'item']) expect(html).toContain(`data-icon="${icon}"`);
  });
});

describe('art: CreatureSigil and the combat glyphs (DESIGN §17.3, §17.5)', () => {
  test('every base draws, details add outlines and rings, one animated detail, still under reduced motion', () => {
    for (const base of ['circle_lit', 'broken_circle', 'circle_waterline', 'hexagon', 'teardrop', 'triangle', 'rhombus', 'spiral', 'portrait', 'nonsense']) {
      const html = renderToStaticMarkup(<CreatureSigil creatureId="cr_x" sigil={{ base, details: [] }} />);
      expect(html).toContain('class="sigil__body"');
      expect(html).toContain('aria-hidden="true"');
    }
    const boss = renderToStaticMarkup(<CreatureSigil creatureId="cr_x" sigil={{ base: 'spiral', accent: 'weavers', details: ['segmented_ring', 'double_outline', 'starlit_eyes', 'slow_rotation'] }} size="lg" title="The Tyrant" />);
    for (const bit of ['sigil__ring', 'sigil__outline', 'sigil__dot', 'creature-sigil--rotate', 'data-accent="weavers"', 'role="img"', 'aria-label="The Tyrant"', 'width="96"']) expect(boss).toContain(bit);
    const still = renderToStaticMarkup(<CreatureSigil creatureId="cr_x" sigil={{ base: 'teardrop', details: ['drip'] }} reducedMotion />);
    expect(still).not.toContain('sigil__drip');
    expect(renderToStaticMarkup(<CreatureSigil creatureId="cr_x" sigil={{ base: 'hexagon', details: ['ember_seams'] }} size="sm" />)).toContain('sigil__embers');
    expect(renderToStaticMarkup(<CreatureSigil creatureId="cr_x" sigil={{ base: 'hexagon', accent: 'mystery', details: [] }} />)).not.toContain('data-accent');
    expect(animatedDetail(['wing_blur'])).toBe('flicker');
    expect(animatedDetail(['drip', 'flicker'])).toBe('drip');
    expect(animatedDetail(['bell'])).toBeNull();
    expect(familyGlyph('fam_wilds', 'a')).not.toBe(familyGlyph('fam_drowned', 'a'));
    expect(familyGlyph('fam_unknown', 'cr_a')).toBe(familyGlyph('fam_unknown', 'cr_a')); // seeded, stable
    expect(renderToStaticMarkup(<CreatureSigil creatureId="cr_x" state="ko" />)).toContain('sigil__ko');
  });

  test('six damage types and every DESIGN §4.5 status have a glyph', () => {
    for (const t of ['physical', 'fire', 'storm', 'ley', 'void', 'chrono']) expect(ICON_KINDS).toContain(damageIcon(t));
    expect(damageIcon('mystery')).toBe('attack');
    const statuses = ['bleed', 'burn', 'shock', 'soaked', 'slow', 'haste', 'stun', 'weaken', 'armor_break', 'mark', 'curse', 'shield', 'regen', 'taunt', 'phase', 'rewind', 'poison', 'blind', 'rested'];
    for (const s of statuses) expect(statusIcon(`status_${s}`)).toBe(`status_${s}` as never);
    expect(statusIcon('status_mystery')).toBe('danger');
  });
});
