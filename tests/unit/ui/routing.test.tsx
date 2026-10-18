// Routing by `state.mode` (PLAN §6.2, §8.3 `routing.test.tsx`): each mode renders its screen's root inside the Shell's
// landmarks; the page title, theme attributes and live-region phrasing follow the state.
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryStorage, type GameEvent, type Mode } from '@engine/index';
import { App, ScreenFor } from '@ui/App';
import { announceStep } from '@ui/a11y/announce';
import { LiveRegion } from '@ui/a11y/LiveRegion';
import { SkipLink } from '@ui/a11y/SkipLink';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { PlaceholderView } from '@ui/screens/PlaceholderScreen';
import { legalPanels } from '@ui/panels/panels';
import { applyRootAttributes, documentTitle, motionReduced, rootAttributes } from '@ui/theme';
import { fixturePack } from '@tests/fixtures/miniContent';
import { byName, call, expand } from './tree';

const content = fixturePack();
const MODES: Mode[] = ['title', 'explore', 'combat', 'dialogue', 'threshold', 'ending'];

function renderIn(mode: Mode): string {
  const store = createGameStore(content, freshProfile('r'), { storage: memoryStorage(), rethrow: false });
  if (mode !== 'title') store.shell.newGame('Ann', 'ranger');
  const live = createGameStore(content, store.getProfile(), { initialState: { ...store.getState(), mode }, storage: null });
  return renderToStaticMarkup(
    <GameProvider value={live}>
      <App />
    </GameProvider>,
  );
}

describe('App', () => {
  test.each(MODES)('%s renders its screen root inside <main id="main">', (mode) => {
    const html = renderIn(mode);
    expect(html).toContain('<main id="main"');
    expect(html).toContain(`data-screen="${mode}"`);
    expect(html).toContain('<h1');
    expect(html).toContain('href="#main"'); // skip link
    expect(html).toContain('aria-live="polite"'); // live region and toasts are always present
    expect(html.match(/<main/g)).toHaveLength(1);
  });

  test('explore names the place, the loop and the day, and offers the way back to the title (U64)', () => {
    const html = renderIn('explore');
    expect(html).toContain(content.locations[content.config.startLocationId]!.name);
    expect(html).toContain('Return to title');
    expect(html).toContain('Loop 1');
    expect(html).toContain('Day 1, dawn.');
  });

  test('ScreenFor covers every mode', () => {
    for (const mode of MODES) expect(ScreenFor({ mode })).toBeTruthy();
  });

  test('the placeholder view hides "Return to title" where the engine does not allow it', () => {
    const left: string[] = [];
    const props = { mode: 'combat' as const, place: null, loop: 2, day: 4, watch: 'night', onLeave: () => left.push('x') };
    expect(renderToStaticMarkup(<PlaceholderView {...props} canLeave={false} />)).not.toContain('Return to title');
    const tree = expand(<PlaceholderView {...props} canLeave />);
    call(byName(tree, 'button', 'Return to title'), 'onClick');
    expect(left).toEqual(['x']);
  });
});

describe('panels by mode (PLAN §6.3)', () => {
  test('combat, dialogue and title allow only their sets', () => {
    expect(legalPanels('combat')).toEqual(['inventory', 'bestiary', 'help', 'settings']);
    expect(legalPanels('dialogue')).toEqual(['help', 'settings']);
    expect(legalPanels('title')).toEqual(['settings', 'saves', 'codex', 'help']);
    expect(legalPanels('explore')).toContain('map');
    expect(legalPanels('threshold')).toContain('timeline');
    expect(legalPanels('ending')).toEqual(['settings', 'help']);
  });
});

describe('document', () => {
  test('rootAttributes and applyRootAttributes map the settings onto <html>', () => {
    expect(rootAttributes({ highContrast: false, reducedMotion: 'system', textScale: 1 })).toEqual({ theme: 'default', motion: 'system', fontSize: '100%' });
    expect(rootAttributes({ highContrast: true, reducedMotion: 'on', textScale: 1.25 })).toEqual({ theme: 'high-contrast', motion: 'reduce', fontSize: '125%' });
    const root = { dataset: {} as Record<string, string | undefined>, style: { fontSize: '' } };
    applyRootAttributes(root, { highContrast: false, reducedMotion: 'off', textScale: 1.5 });
    expect(root).toEqual({ dataset: { theme: 'default', motion: 'full' }, style: { fontSize: '150%' } });
  });

  test('motionReduced: the setting wins, "system" follows the device', () => {
    expect(motionReduced('on', false)).toBe(true);
    expect(motionReduced('off', true)).toBe(false);
    expect(motionReduced('system', true)).toBe(true);
    expect(motionReduced('system', false)).toBe(false);
  });

  test('the page title follows the mode and the place (PLAN §6.7)', () => {
    expect(documentTitle('title', null)).toBe('Echoes of Aethelgard');
    expect(documentTitle('explore', 'Whispering Ruins')).toBe('Whispering Ruins · Echoes of Aethelgard');
    expect(documentTitle('combat', 'Whispering Ruins')).toBe('Combat · Echoes of Aethelgard');
    expect(documentTitle('somewhere', null)).toBe('somewhere · Echoes of Aethelgard');
  });
});

describe('live region', () => {
  test('one message per step: arrival, narration, loads, the title, rejections', () => {
    const store = createGameStore(content, freshProfile('a'), { storage: null });
    const events = store.dispatch({ type: 'newGame', name: 'Ann', classId: 'ranger' });
    const said = announceStep(events, store.getState(), content);
    expect(said).toContain(`${content.locations[content.config.startLocationId]!.name}. Day 1, dawn.`);
    const more: GameEvent[] = [
      { t: 'saveLoaded', version: 1, migratedFrom: null },
      { t: 'modeChanged', from: 'explore', to: 'title' },
      { t: 'actionRejected', action: { type: 'wait' }, reason: 'not here' },
      { t: 'goldChanged', delta: 1, total: 2 },
    ];
    expect(announceStep(more, store.getState(), content)).toBe('Save loaded. Title screen. That cannot be done: not here.');
    expect(announceStep([], store.getState(), content)).toBeNull();
  });

  test('LiveRegion is a polite atomic status that re-announces by nonce; SkipLink targets main', () => {
    const html = renderToStaticMarkup(<LiveRegion announcement={{ text: 'Hello.', nonce: 2 }} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('Hello.');
    expect(renderToStaticMarkup(<LiveRegion announcement={null} />)).not.toContain('<span');
    expect(renderToStaticMarkup(<SkipLink />)).toBe('<a class="skip-link" href="#main">Skip to the game</a>');
  });
});
