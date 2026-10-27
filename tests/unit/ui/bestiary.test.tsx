// The Bestiary (U66; DESIGN §4.2, §16.3 `screen_bestiary`): what is known grows with kills, what is not is a question mark
// in words, creatures in the fight on screen are listed before they are recorded; then BestiaryView's list and card driven
// through tests/unit/ui/tree.ts, and the panel in a live store.
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryStorage, type GameState, type Profile } from '@engine/index';
import { BestiaryView, CreatureDetail } from '@ui/panels/BestiaryPanel';
import { PanelHost } from '@ui/panels/PanelHost';
import { KNOWLEDGE_LABELS, bestiaryModel, creatureCard, familyName, isMet, knowledgeOf, presentIds } from '@ui/panels/bestiaryModel';
import { resetSharedCodexReadStore } from '@ui/store/codexRead';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, nameOf } from './tree';

const content = fixturePack();
const SHADE = 'cr_corrupted_shade';

type Entry = Profile['bestiary'][string];
const entry = (over: Partial<Entry> = {}): Entry => ({ seen: 1, killed: 0, spared: 0, revealed: 'none', intentsSeen: [], ...over });
const profileOf = (bestiary: Profile['bestiary'], codexUnlocked: string[] = []): Profile => ({ ...freshProfile('b'), bestiary, codexUnlocked });

function started(): GameState {
  const store = createGameStore(content, freshProfile('b'), { storage: null });
  store.shell.newGame('Ann', 'ranger', 'best');
  return store.getState();
}

describe('creatureCard', () => {
  test('a creature’s family kills teach a newcomer of the same family its resistances', () => {
    const profile = profileOf({ cr_corrupted_shade: entry({ killed: 1, revealed: 'resist' }) });
    expect(knowledgeOf(content, profile, 'cr_corrupted_shade')).toBe('resist');
    const sibling = { ...content, creatures: { ...content.creatures, cr_kin: { ...content.creatures.cr_corrupted_shade!, id: 'cr_kin' as const } } };
    expect(knowledgeOf(sibling, profile, 'cr_kin')).toBe('resist');
    expect(knowledgeOf(sibling, freshProfile('b'), 'cr_kin')).toBe('none');
  });
});

describe('creatureCard (cards)', () => {
  test('seen only: name, level, its summary in its voice; resistances, tactics, stats and drops are question marks', () => {
    const card = creatureCard(content, profileOf({ [SHADE]: entry() }), SHADE)!;
    expect(card).toMatchObject({ name: 'Corrupted Shade', level: 2, family: 'fam_hollowed', familyName: 'Hollowed', knowledge: 'none', knowledgeLabel: 'Only seen', voice: 'Remnant Archive', seen: 1, killed: 0 });
    expect(card.summary).toContain('Year 212');
    expect([card.resistances, card.immunities, card.tactics, card.stats, card.drops]).toEqual([null, null, null, null, null]);
    expect(card.moves.every((m) => !m.known && m.name === null && m.line === null && m.type === null)).toBe(true);
    expect(card.movesSeen).toBe(0);
    expect(card.nextReveal).toBe('Defeat it once more to learn its resistances.');
  });

  test('moves met in a fight are known with their telegraph line and damage type', () => {
    const card = creatureCard(content, profileOf({ [SHADE]: entry({ intentsSeen: ['shade_rake', 'shade_fade'] }) }), SHADE)!;
    expect(card.moves.filter((m) => m.known).map((m) => [m.name, m.type])).toEqual([
      ['Rake', 'Physical'],
      ['Fade', null],
    ]);
    expect(card.moves.find((m) => m.id === 'shade_rake')?.line).toContain('long fingers');
    expect(card.movesSeen).toBe(2);
  });

  test('after kills: resistances and immunities, then (fully known) every move, the stats and the drops', () => {
    const resist = creatureCard(content, profileOf({ [SHADE]: entry({ killed: 1, revealed: 'resist' }) }), SHADE)!;
    expect(resist.resistances).toEqual(['Weak to Ley', 'Weak to Fire', 'Resists Void']);
    expect(resist.immunities).toHaveLength(1);
    expect(resist.tactics).toBeNull();
    expect(resist.nextReveal).toBe('Defeat it 2 more times to learn its every move, its stats and its drops.');
    const all3 = creatureCard(content, profileOf({ [SHADE]: entry({ killed: 3, revealed: 'all' }) }), SHADE)!;
    expect(all3.tactics).toContain('Hit hard');
    expect(all3.moves.every((m) => m.known)).toBe(true);
    expect(all3.stats?.map((s) => s.label)).toEqual(['Health', 'Armor', 'Ward', 'Agility']);
    expect(all3.drops).toHaveLength(2); // the Spellbook (listed once for its two rules) and the Ash
    expect(all3.nextReveal).toBeNull();
    expect(creatureCard(content, freshProfile('b'), 'cr_nobody')).toBeNull();
  });

  test('knowledge falls back to the family’s first kill for a creature standing in the fight but not yet recorded', () => {
    expect(knowledgeOf(content, freshProfile('b'), SHADE)).toBe('none');
    const kin = profileOf({ cr_other: entry({ killed: 1, revealed: 'resist' }) });
    expect(knowledgeOf(content, kin, SHADE)).toBe('none'); // an id outside the pack counts for nothing
    expect(knowledgeOf(content, profileOf({ [SHADE]: entry({ revealed: 'pattern' }) }), SHADE)).toBe('pattern');
    expect(KNOWLEDGE_LABELS.all).toBe('Fully known');
    expect(familyName('fam_hollowed')).toBe('Hollowed');
  });
});

describe('bestiaryModel', () => {
  test('nothing met: no families, no cards, a plain summary', () => {
    const model = bestiaryModel(started(), content, freshProfile('b'));
    expect(model).toMatchObject({ families: [], cards: {}, summary: 'No creature met yet.', firstId: null });
    expect(isMet(freshProfile('b'), SHADE)).toBe(false);
    expect(isMet(profileOf({ [SHADE]: entry({ seen: 0, spared: 1 }) }), SHADE)).toBe(true);
  });

  test('a creature met is listed under its family with the family’s known/total; unmet ones are not listed at all', () => {
    const model = bestiaryModel(started(), content, profileOf({ [SHADE]: entry({ killed: 2, revealed: 'resist' }) }));
    expect(model.summary).toBe('1 creature met of 4');
    expect(model.families).toEqual([{ id: 'fam_hollowed', name: 'Hollowed', known: 1, total: 1, creatures: [{ id: SHADE, name: 'Corrupted Shade', level: 2, killed: 2, present: false }] }]);
    expect(Object.keys(model.cards)).toEqual([SHADE]);
    expect(model.firstId).toBe(SHADE);
  });

  test('a fight on screen lists its creatures before they are recorded, and opens on one of them', () => {
    const s = structuredClone(started());
    s.combat = { enemies: [{ refId: 'cr_glowfen_mireling', fledOrGone: false }, { refId: 'cr_glowfen_mireling', fledOrGone: false }, { refId: SHADE, fledOrGone: true }] } as unknown as GameState['combat'];
    expect(presentIds(s)).toEqual(['cr_glowfen_mireling']);
    const model = bestiaryModel(s, content, profileOf({ [SHADE]: entry() }));
    expect(model.firstId).toBe('cr_glowfen_mireling');
    expect(model.cards.cr_glowfen_mireling).toMatchObject({ present: true, seen: 0 });
    expect(model.families.map((f) => f.name)).toEqual(['Green', 'Hollowed']);
  });
});

describe('BestiaryView', () => {
  const profile = profileOf({ [SHADE]: entry({ killed: 1, revealed: 'resist', intentsSeen: ['shade_rake'] }) }, ['codex_tyrant_holding']);
  const model = bestiaryModel(started(), content, profile);
  const props = { model, selectedId: null, view: 'list' as const, canOpenCodex: true, onSelect: () => undefined, onBack: () => undefined, onOpenCodex: () => undefined };

  test('an empty bestiary says how creatures get recorded', () => {
    const html = renderToStaticMarkup(<BestiaryView {...props} model={bestiaryModel(started(), content, freshProfile('b'))} />);
    expect(html).toContain('No creature met yet.');
    expect(html).toContain('Creatures are recorded when you meet them in a fight.');
  });

  test('each creature is a named button under its family heading; picking one selects it', () => {
    const onSelect = mock((_id: string) => undefined);
    const tree = expand(<BestiaryView {...props} onSelect={onSelect} />);
    const item = byName(tree, 'button', 'Corrupted Shade, level 2, defeated 1');
    expect(item.props['data-creature-id']).toBe(SHADE);
    expect(item.props['data-autofocus']).toBe('');
    call(item, 'onClick');
    expect(onSelect.mock.calls).toEqual([[SHADE]]);
    expect(all(tree, 'h3').map(nameOf)).toContain('Hollowed 1 of 1');
    const onBack = mock(() => undefined);
    call(byName(expand(<BestiaryView {...props} view="detail" onBack={onBack} />), 'button', 'Back to creatures'), 'onClick');
    expect(onBack.mock.calls).toHaveLength(1);
  });

  test('the card keeps to what is known: a question mark in words for the rest, and the kills that would reveal it', () => {
    const html = renderToStaticMarkup(<BestiaryView {...props} />);
    expect(html).toContain('Weak to Ley');
    expect(html).toContain('Moves · 1 of 3 seen');
    expect(html).toContain('Not yet known');
    expect(html).toContain('A move not yet seen.');
    expect(html).toContain('Learned with more kills.');
    expect(html).toContain('Known once it is fully studied.');
    expect(html).toContain('Defeat it 2 more times');
    expect(html).toContain('in the voice of the Remnant Archive');
    expect(html).toContain('Cannot be');
  });

  test('a fully known card lists stats and drops; the Codex link shows only when the entry is found and the Codex can open', () => {
    const open = bestiaryModel(started(), content, profileOf({ [SHADE]: entry({ killed: 3, revealed: 'all' }) }));
    const card = { ...open.cards[SHADE]!, codex: { id: 'codex_tyrant_holding', title: 'The Holding', unlocked: true } };
    const onOpen = mock((_id: string) => undefined);
    const tree = expand(<CreatureDetail card={card} canOpenCodex onOpenCodex={onOpen} />);
    call(byName(tree, 'button', 'Read in the Codex: The Holding'), 'onClick');
    expect(onOpen.mock.calls).toEqual([['codex_tyrant_holding']]);
    const html = renderToStaticMarkup(<CreatureDetail card={card} canOpenCodex onOpenCodex={onOpen} />);
    expect(html).toContain('Health');
    expect(html).toContain('Drops: ');
    expect(renderToStaticMarkup(<CreatureDetail card={card} canOpenCodex={false} onOpenCodex={onOpen} />)).not.toContain('Read in the Codex');
    expect(renderToStaticMarkup(<CreatureDetail card={{ ...card, codex: { ...card.codex, unlocked: false } }} canOpenCodex onOpenCodex={onOpen} />)).not.toContain('Read in the Codex');
    const none = renderToStaticMarkup(<CreatureDetail card={{ ...card, drops: [], resistances: [], immunities: [], spared: 2, rank: 'Elite', present: true }} canOpenCodex onOpenCodex={onOpen} />);
    expect(none).toContain('It leaves nothing behind.');
    expect(none).toContain('No strong weakness or resistance.');
    expect(none).toContain('Spared');
    expect(none).toContain('In this fight');
  });
});

describe('BestiaryPanel in a live store', () => {
  test('renders in the shared modal with the creatures met', () => {
    resetSharedCodexReadStore(null);
    const profile = profileOf({ [SHADE]: entry({ killed: 1, revealed: 'resist' }) });
    const store = createGameStore(content, profile, { initialState: started(), storage: memoryStorage() });
    const html = renderToStaticMarkup(
      <GameProvider value={store}>
        <PanelHost id="bestiary" onClose={() => undefined} />
      </GameProvider>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Corrupted Shade');
    expect(html).toContain('1 creature met of 4');
  });
});
