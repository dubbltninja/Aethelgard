// The Explore screen's views (U64; PLAN §8.3): render + interaction + accessible names for the ExitBar, the ActionBar,
// the HUD (StatusBar, meters, the clock chip) and the whole ExploreView, driven through tests/unit/ui/tree.ts (views
// are pure). The container's keys and focus are e2e's (tests/e2e/explore.spec.ts).
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { legalActions, memoryStorage } from '@engine/index';
import { App } from '@ui/App';
import { ActionBar, actionKey } from '@ui/components/ActionBar';
import { ClockWidget } from '@ui/components/ClockWidget';
import { ExitBar, exitName } from '@ui/components/ExitBar';
import { Meter, StatusBar } from '@ui/components/StatusBar';
import { ExploreView, type ExploreViewProps } from '@ui/screens/ExploreScreen';
import { actionRows, clockModel, exitRows, hudModel, itemRows, npcRows, placeModel, type ActionRow, type ExitRow } from '@ui/screens/exploreModel';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, nameOf } from './tree';

const content = fixturePack();

const open: ExitRow = {
  to: 'loc_a',
  dir: 'north',
  dirLabel: 'North',
  name: 'Crumbling Archway',
  label: null,
  watches: 1,
  cost: '1 watch',
  arrive: 'Dusk',
  state: 'open',
  canGo: true,
  reason: null,
  danger: null,
  road: false,
};
const locked: ExitRow = { ...open, to: 'loc_b', dir: 'east', dirLabel: 'East', name: 'Barren Peaks', state: 'locked', canGo: false, reason: 'I should talk to Brak before going this way.', arrive: null };
const infected: ExitRow = { ...open, to: 'loc_c', dir: 'path', dirLabel: 'Path', name: 'Ironclad Camp', label: 'the old road', danger: '⚠ −33% HP: the Horde is there', road: true };

describe('ExitBar', () => {
  test('one named button per exit: direction, place, cost, arrival; travel only through open legal exits', () => {
    const travel = mock((_to: string) => undefined);
    const inspect = mock((_to: string) => undefined);
    const tree = expand(<ExitBar exits={[open, locked, infected]} onTravel={travel} onInspect={inspect} />);
    expect(all(tree, 'nav')[0]?.props['aria-labelledby']).toBe('exits-heading');
    const north = byName(tree, 'button', 'North: Crumbling Archway, 1 watch, arrive Dusk');
    expect(north.props['data-exit-dir']).toBe('north');
    call(north, 'onClick');
    expect(travel.mock.calls).toEqual([['loc_a']]);
    // a locked exit stays focusable, says why, and asks the engine to explain instead of travelling
    const east = byName(tree, 'button', 'East: Barren Peaks, locked');
    expect(east.props['aria-disabled']).toBe('true');
    expect(east.props['aria-describedby']).toBe('exit-reason-loc_b');
    expect(renderToStaticMarkup(<ExitBar exits={[locked]} onTravel={travel} onInspect={inspect} />)).toContain('I should talk to Brak before going this way.');
    call(east, 'onClick');
    expect(inspect.mock.calls).toEqual([['loc_b']]);
    expect(travel.mock.calls).toHaveLength(1);
    // the Horde's warning is part of the name
    expect(nameOf(byName(tree, 'button', /Ironclad Camp/))).toBe('Path: Ironclad Camp, 1 watch, arrive Dusk. ⚠ −33% HP: the Horde is there');
  });

  test('an open exit the engine does not list is disabled and does nothing', () => {
    const travel = mock((_to: string) => undefined);
    const tree = expand(<ExitBar exits={[{ ...open, canGo: false }]} onTravel={travel} onInspect={() => undefined} />);
    const button = byName(tree, 'button', /Crumbling Archway/);
    expect(button.props['aria-disabled']).toBe('true');
    call(button, 'onClick');
    expect(travel.mock.calls).toHaveLength(0);
    expect(renderToStaticMarkup(<ExitBar exits={[]} onTravel={travel} onInspect={() => undefined} />)).toContain('There is no way on from here.');
  });

  test('exitName with no arrival (a frozen clock)', () => {
    expect(exitName({ ...open, cost: 'No time passes', arrive: null })).toBe('North: Crumbling Archway, No time passes');
  });
});

describe('ActionBar', () => {
  const rows: ActionRow[] = Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, label: `Action ${i}`, detail: i === 0 ? 'No time passes' : null, icon: 'look', action: { type: 'wait' } }));

  test('numbers follow displayed order, 1–9; the number is part of the name; a press reports its row', () => {
    const run = mock((_row: ActionRow) => undefined);
    const tree = expand(<ActionBar actions={rows} onRun={run} />);
    const buttons = all(tree, 'button');
    expect(buttons).toHaveLength(10);
    expect(nameOf(buttons[0]!)).toBe('1: Action 0, No time passes');
    expect(nameOf(buttons[9]!)).toBe('Action 9');
    expect(buttons[8]?.props['aria-keyshortcuts']).toBe('9');
    expect(buttons[9]?.props['aria-keyshortcuts']).toBeUndefined();
    call(byName(tree, 'button', '3: Action 2'), 'onClick');
    expect(run.mock.calls[0]?.[0]?.id).toBe('a2');
    expect([0, 8, 9].map(actionKey)).toEqual(['1', '9', null]);
  });

  test('a loop-ender is marked as dangerous', () => {
    const html = renderToStaticMarkup(<ActionBar actions={[{ id: 'let-go', label: 'Let go', detail: null, icon: 'leave', action: { type: 'letGo' }, danger: true }]} onRun={() => undefined} />);
    expect(html).toContain('action--danger');
  });
});

describe('HUD (StatusBar, meters, clock chip)', () => {
  const store = createGameStore(content, freshProfile('h'), { storage: null });
  store.shell.newGame('Ann', 'wizard');
  const hud = hudModel(store.getState(), content);

  test('HP and the class resource are labelled meters with their numbers (DESIGN §16.7)', () => {
    const html = renderToStaticMarkup(<StatusBar hud={hud} />);
    expect(html).toContain('aria-label="Status"');
    expect(html).toContain(`role="meter" aria-label="HP" aria-valuemin="0" aria-valuemax="${hud.hpMax}" aria-valuenow="${hud.hp}"`);
    expect(html).toContain(`aria-label="${hud.resourceName}"`);
    expect(html).toContain('Loop 1');
    expect(html).toContain(`${hud.gold} gold`);
    expect(html).not.toContain('Corruption');
    expect(html).toContain('Day 1, dawn.'); // the chip's sentence for screen readers
  });

  test('detail (H) shows the stats; Corruption pips, statuses, points and the companion card when present', () => {
    const rich = {
      ...hud,
      showCorruption: true,
      corruption: 2,
      statPoints: 1,
      abilityPoints: 1.5,
      statuses: [{ id: 'status_poison', name: 'Poison', left: 3, icon: 'status_poison' as const }],
      companion: { name: 'Ilyra', hp: 30, hpMax: 40, stance: 'Support', ko: false },
    };
    const html = renderToStaticMarkup(<StatusBar hud={rich} detail />);
    expect(html).toContain('aria-label="Corruption 2 of 6"');
    expect(html.match(/pip pip--on/g)).toHaveLength(2);
    expect(html).toContain('Poison · 3');
    expect(html).toContain('1 stat point · 1.5 AP to spend');
    expect(html).toContain('aria-label="Ilyra"');
    expect(html).toContain('30 / 40 · Support');
    expect(html).toContain('<dt>Magic</dt>');
    expect(renderToStaticMarkup(<StatusBar hud={{ ...rich, companion: { ...rich.companion, ko: true } }} />)).toContain('Knocked out');
  });

  test('Meter clamps its bar and keeps its numbers; the clock chip lists what moved the clock in detail', () => {
    expect(renderToStaticMarkup(<Meter kind="hp" label="HP" value={50} max={40} />)).toContain('width:100%');
    expect(renderToStaticMarkup(<Meter kind="hp" label="HP" value={0} max={0} />)).toContain('width:0%');
    const clock = clockModel({ loop: 2, ticks: 96, limitTicks: 116, frozen: false, expired: false, hordeActive: false, before: null, modifiers: [{ source: 'Destroyed the Heartstone', watches: -40 }] });
    const html = renderToStaticMarkup(<ClockWidget clock={clock} detail />);
    expect(html).toContain('data-level="amber-pulse"');
    expect(html).toContain('Breach Clock · Day 25 · 5 dawns left');
    expect(html).toContain('Destroyed the Heartstone: −10 days');
    expect(renderToStaticMarkup(<ClockWidget clock={clock} />)).not.toContain('Destroyed the Heartstone');
  });
});

describe('ExploreView', () => {
  const store = createGameStore(content, freshProfile('v'), { storage: null });
  store.shell.newGame('Ann', 'ranger', 'view');
  const state = store.getState();
  const profile = store.getProfile();
  const legal = legalActions(state, content, profile);
  const location = content.locations[state.world.currentLocationId]!;
  const calls: string[] = [];
  const props: ExploreViewProps = {
    place: placeModel(state, content, profile)!,
    location,
    region: content.regions[location.regionId],
    scene: { horde: false, heartstone: 'intact', watch: 0, loop: 1 },
    seed: location.id,
    reducedMotion: true,
    hud: hudModel(state, content),
    hudDetail: false,
    npcs: npcRows(state, content, profile, legal),
    items: itemRows(state, content, legal),
    exits: exitRows(state, content, profile, legal),
    actions: actionRows(state, content, legal, { canLook: true, canOpenPanel: () => false }),
    log: [{ key: '0:0', text: 'A low hum.', kind: 'event' }],
    menu: { canMap: true, canSaves: true, canSettings: true, canHelp: true, canLeave: true },
    onTravel: (to) => calls.push(`travel ${to}`),
    onInspectExit: (to) => calls.push(`inspect ${to}`),
    onAction: (row) => calls.push(`action ${row.id}`),
    onTalk: (id) => calls.push(`talk ${id}`),
    onTake: (uid) => calls.push(`take ${uid}`),
    onMenu: (id) => calls.push(`menu ${id}`),
  };

  test('landmarks and names: one h1 (the place), the scene as a named image, sections by heading', () => {
    const tree = expand(<ExploreView {...props} />);
    const h1 = all(tree, 'h1');
    expect(h1).toHaveLength(1);
    expect(nameOf(h1[0]!)).toBe('Whispering Ruins');
    const scene = all(tree, 'svg').find((n) => n.props.role === 'img');
    expect(scene?.props['aria-label']).toBe('Whispering Ruins');
    expect(all(tree, 'h2').map(nameOf)).toEqual(['Here', 'Ways on', 'What you can do', 'What has happened']);
    const log = all(tree, 'ol').find((n) => n.props.role === 'log');
    expect(log?.props['aria-live']).toBe('off'); // the Shell's live region speaks; the list is the record
    expect(renderToStaticMarkup(<ExploreView {...props} />)).toContain('data-screen="explore"');
  });

  test('every control reaches its handler', () => {
    calls.length = 0;
    const tree = expand(<ExploreView {...props} />);
    call(byName(tree, 'button', /^North: Shattered Library/), 'onClick');
    call(byName(tree, 'button', 'Talk to Ilyra'), 'onClick');
    call(byName(tree, 'button', 'Take Amulet of Echoes'), 'onClick');
    call(byName(tree, 'button', /^1: Look around/), 'onClick');
    for (const name of ['Map', 'Saves', 'Settings', 'Keys', 'Return to title']) call(byName(tree, 'button', name), 'onClick');
    expect(calls[0]).toBe('travel loc_shattered_library');
    expect(calls[1]).toBe('talk npc_ilyra');
    expect(calls[2]).toMatch(/^take i\d+$/);
    expect(calls.slice(3)).toEqual(['action look', 'menu map', 'menu saves', 'menu settings', 'menu help', 'menu title']);
  });

  test('menu items the Shell cannot open are left out; a full pack says so; notes and docked map render', () => {
    const tree = expand(
      <ExploreView
        {...props}
        menu={{ canMap: false, canSaves: false, canSettings: false, canHelp: false, canLeave: false }}
        items={[{ uid: 'i9', name: 'Glow Moss', qty: 3, rarity: 'uncommon', canTake: false }]}
        npcs={[]}
        dockedMap={<p>docked</p>}
      />,
    );
    expect(all(tree, 'nav').find((n) => n.props['aria-label'] === 'Game menu')?.children).toEqual([]);
    const html = renderToStaticMarkup(<ExploreView {...props} items={[{ uid: 'i9', name: 'Glow Moss', qty: 3, rarity: 'uncommon', canTake: false }]} dockedMap={<p>docked</p>} />);
    expect(html).toContain('Glow Moss × 3');
    expect(html).toContain('Your pack is full');
    expect(html).toContain('<p>docked</p>');
    expect(html).toContain('A low, resonant hum');
  });

  test('the App renders the Explore screen for explore mode, in the Shell (server render)', () => {
    const live = createGameStore(content, profile, { initialState: state, storage: memoryStorage() });
    const html = renderToStaticMarkup(
      <GameProvider value={live}>
        <App />
      </GameProvider>,
    );
    expect(html).toContain('id="place-heading"');
    expect(html).toContain('class="explore-root"');
    // an unknown place still offers the way out
    const lost = createGameStore(content, profile, { initialState: { ...state, world: { ...state.world, currentLocationId: 'loc_nowhere' } }, storage: null });
    const lostHtml = renderToStaticMarkup(
      <GameProvider value={lost}>
        <App />
      </GameProvider>,
    );
    expect(lostHtml).toContain('Somewhere unknown');
    expect(lostHtml).toContain('Return to title');
  });
});
