// What U68 adds to the shell (D-104): the panels the Threshold and the title may open, the registry entries, the title menu's
// Achievements, and the live region's sentences for the Loom, the places and the ending slides.
import { describe, expect, test } from 'bun:test';
import type { GameEvent } from '@engine/index';
import { announceStep } from '@ui/a11y/announce';
import { PANEL_COMPONENTS } from '@ui/panels/PanelHost';
import { PANEL_KEYS, PANEL_TITLES, legalPanels } from '@ui/panels/panels';
import { titleMenu } from '@ui/screens/TitleScreen';
import { liveAt, pack, thresholdAt } from './thresholdFixtures';

describe('panels', () => {
  test('the Threshold reads the timeline and the achievements; the title reads the achievements; an ending reads neither', () => {
    for (const id of ['timeline', 'achievements', 'codex', 'bestiary'] as const) expect(legalPanels('threshold')).toContain(id);
    expect(legalPanels('title')).toContain('achievements');
    expect(legalPanels('ending')).toEqual(['settings', 'help']);
    expect(legalPanels('explore')).toContain('achievements');
    expect(legalPanels('combat')).not.toContain('timeline');
  });

  test('both panels are registered, titled, and the timeline keeps DESIGN §16.4’s L', () => {
    expect(PANEL_COMPONENTS.timeline).toBeDefined();
    expect(PANEL_COMPONENTS.achievements).toBeDefined();
    expect(PANEL_TITLES.achievements).toBe('Achievements');
    expect(PANEL_KEYS.timeline).toBe('l');
  });

  test('the title menu lists Achievements between Settings and Lore (DESIGN §16.3)', () => {
    const labels = titleMenu({ continueSlot: null, anySaved: false, canPersist: true }).map((i) => i.label);
    expect(labels.indexOf('Achievements')).toBe(labels.indexOf('Settings') + 1);
    expect(labels.indexOf('Lore')).toBe(labels.indexOf('Achievements') + 1);
  });
});

describe('the live region', () => {
  const say = (events: GameEvent[]): string | null => {
    const at = thresholdAt();
    return announceStep(events, at.state, pack);
  };

  test('an ending slide is read out', () => {
    expect(say([{ t: 'endingSlide', endingId: 'closer_fall', index: 0, text: 'You let the day go.' }])).toBe('You let the day go.');
  });

  test('the Loom says what was equipped and which modifier is on', () => {
    expect(say([{ t: 'attunementEquipped', attunementId: 'att_steady_hand', on: true }])).toBe('Steady Hand equipped.');
    expect(say([{ t: 'attunementEquipped', attunementId: 'att_steady_hand', on: false }])).toBe('Steady Hand unequipped.');
    expect(say([{ t: 'modifierToggled', modifierId: 'mod_glass', on: true }])).toBe('Glass on.');
    expect(say([{ t: 'modifierToggled', modifierId: 'mod_glass', on: false }])).toBe('Glass off.');
  });

  test('walking to a place says its name; the Still Shore’s own lines are the engine’s', () => {
    expect(say([{ t: 'thresholdEntered', area: 'loom' }])).toBe('The Loom.');
    expect(say([{ t: 'thresholdEntered', area: 'far_light' }])).toBe('The Far Light.');
    expect(say([{ t: 'thresholdEntered', area: 'still_shore' }])).toBeNull();
  });

  test('a live loop still announces nothing for these events', () => {
    expect(announceStep([{ t: 'thresholdEntered', area: 'still_shore' }], liveAt().state, pack)).toBeNull();
  });
});
