// The illustrated node map (U64; DESIGN §16.6, WORLD §11.0–11.6): node states and their priority, fog and "?" ghosts,
// remembered places from the profile, infection and the Library's way out, locked/road edges, routes and the travel
// preview; then MapView's buttons and names. Fixture pack, plus the real pack's 73 places for the layout.
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildContentPack, contentTables } from '@content/index';
import { type GameState, type Profile } from '@engine/index';
import { MapView, centerOn } from '@ui/panels/MapPanel';
import { GRID, INSET_REGIONS, buildMap, initials, neighbourIn, nodeLabel, routeTo, travelPreview, type MapNode } from '@ui/panels/mapModel';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, nameOf } from './tree';

const content = fixturePack();
/** A literal string as a RegExp source. */
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function started(): { state: GameState; profile: Profile } {
  const store = createGameStore(content, freshProfile('m'), { storage: null });
  store.shell.newGame('Ann', 'ranger', 'map');
  return { state: store.getState(), profile: store.getProfile() };
}

function edit(state: GameState, fn: (s: GameState) => void): GameState {
  const s = structuredClone(state);
  fn(s);
  return s;
}

/** Visits `ids` this loop (as the engine records it) and stands at the last. */
const walked = (state: GameState, ids: string[]): GameState =>
  edit(state, (s) => {
    for (const id of ids) {
      if (!s.world.discovered.includes(id)) s.world.discovered.push(id);
    }
    s.world.previousLocationId = ids.length > 1 ? (ids[ids.length - 2] as string) : s.world.currentLocationId;
    s.world.currentLocationId = ids[ids.length - 1] as string;
  });

const yes = (): boolean => true;
const node = (nodes: readonly MapNode[], id: string): MapNode | undefined => nodes.find((n) => n.id === id);

describe('buildMap', () => {
  const { state, profile } = started();

  test('a new loop: the current node, its neighbour as an unnamed "?" ghost, nothing else (fog)', () => {
    const map = buildMap(state, content, profile);
    expect(map.currentId).toBe('loc_whispering_ruins');
    expect(map.nodes.map((n) => [n.id, n.state])).toEqual([
      ['loc_whispering_ruins', 'current'],
      ['loc_shattered_library', 'adjacent'],
    ]);
    const ghost = node(map.nodes, 'loc_shattered_library');
    expect(ghost).toMatchObject({ name: null, glyph: '?', dir: 'north' });
    expect(map.edges).toEqual([{ key: 'loc_shattered_library|loc_whispering_ruins', a: 'loc_shattered_library', b: 'loc_whispering_ruins', state: 'ghost', kind: 'walk', infected: false, forecast: false, reason: null }]);
    const here = node(map.nodes, 'loc_whispering_ruins');
    expect(here).toMatchObject({ name: 'Whispering Ruins', glyph: 'WR', npc: true, rest: 'camp', cleared: false, danger: null });
  });

  test('visited places are named; a standing fixed fight shows its band, a cleared one a check; neighbours of visited nodes are ghosts', () => {
    const s = walked(state, ['loc_whispering_ruins', 'loc_shattered_library', 'loc_silverwood_plaza']);
    const map = buildMap(s, content, profile);
    expect(map.nodes.map((n) => [n.id, n.state])).toEqual([
      ['loc_whispering_ruins', 'visited'],
      ['loc_shattered_library', 'visited'],
      ['loc_silverwood_plaza', 'current'],
      ['loc_veridian_glowlands', 'adjacent'],
    ]);
    expect(node(map.nodes, 'loc_shattered_library')).toMatchObject({ danger: 'Lv 2–3', cleared: false, boss: false });
    expect(node(map.nodes, 'loc_silverwood_plaza')).toMatchObject({ merchant: true, npc: true });
    const cleared = edit(s, (x) => {
      x.world.locationStates.loc_shattered_library = { ...structuredClone(x.world.locationStates.loc_whispering_ruins!), encountersCleared: ['enc_library_shades'] };
    });
    expect(node(buildMap(cleared, content, profile).nodes, 'loc_shattered_library')).toMatchObject({ danger: null, cleared: true });
    expect(neighbourIn(map, 'west')).toBe('loc_shattered_library');
    expect(neighbourIn(map, 'east')).toBe('loc_veridian_glowlands');
    expect(neighbourIn(map, 'north')).toBeNull();
  });

  test('remembered places (profile map memory, D-011) are named and grey; remembered beats a ghost', () => {
    const p: Profile = { ...profile, mapKnowledge: ['loc_shattered_library', 'loc_silverwood_plaza'] };
    const map = buildMap(state, content, p);
    expect(node(map.nodes, 'loc_shattered_library')).toMatchObject({ state: 'remembered', name: 'Shattered Library' });
    expect(node(map.nodes, 'loc_silverwood_plaza')).toMatchObject({ state: 'remembered', name: 'Silverwood Plaza', merchant: true });
    expect(map.edges.find((e) => e.key === 'loc_shattered_library|loc_silverwood_plaza')?.state).toBe('remembered');
    expect(map.edges.find((e) => e.key === 'loc_shattered_library|loc_whispering_ruins')?.state).toBe('remembered');
  });

  test('a lock seen from a visited place is drawn with its reason; a road appears with its gate; boss crowns', () => {
    const s = walked(state, ['loc_veridian_glowlands', 'loc_chronos_nexus']);
    const map = buildMap(s, content, profile);
    const lock = map.edges.find((e) => e.key === 'loc_chronos_nexus|loc_temporal_breach_apex');
    expect(lock?.state).toBe('locked');
    expect(String(lock?.reason)).toMatch(new RegExp(`^${escape('The stair up into the Breach will not hold you yet.')}`));
    expect(map.edges.some((e) => e.kind === 'road')).toBe(false);
    const p: Profile = { ...profile, echoes: ['echo_apex_resonance'] };
    const withRoad = buildMap(s, content, p);
    expect(withRoad.edges.find((e) => e.kind === 'road')?.key).toBe('loc_chronos_nexus|loc_whispering_ruins');
    const loop2 = edit(walked(state, ['loc_chronos_nexus', 'loc_temporal_breach_apex']), (x) => {
      x.meta.loop = 2;
    });
    expect(node(buildMap(loop2, content, p).nodes, 'loc_temporal_breach_apex')).toMatchObject({ boss: true, danger: 'Lv 15–18' });
  });

  test('the Horde: infected nodes are drawn even under fog, named and hatched; the Library is the way out', () => {
    const s = edit(state, (x) => {
      x.world.hordeActive = true;
      x.world.infected = ['loc_temporal_breach_apex', 'loc_chronos_nexus'];
    });
    const map = buildMap(s, content, profile);
    expect(node(map.nodes, 'loc_temporal_breach_apex')).toMatchObject({ infected: true, name: 'The Temporal Breach Apex', state: 'adjacent' });
    expect(node(map.nodes, 'loc_shattered_library')).toMatchObject({ escape: true, name: 'Shattered Library' });
    expect(map.edges.find((e) => e.key === 'loc_chronos_nexus|loc_temporal_breach_apex')).toBeUndefined(); // no known end
    const dask = edit(walked(s, ['loc_veridian_glowlands', 'loc_chronos_nexus']), (x) => {
      x.companions.activeId = 'dask';
    });
    const m2 = buildMap(dask, content, profile);
    expect(node(m2.nodes, 'loc_chronos_nexus')).toMatchObject({ unstable: true, infected: true });
    expect(m2.edges.find((e) => e.key === 'loc_chronos_nexus|loc_temporal_breach_apex')?.infected).toBe(true);
  });

  test('pixels follow WORLD’s grid; region labels are placed once', () => {
    const s = walked(state, ['loc_whispering_ruins', 'loc_shattered_library']);
    const map = buildMap(s, content, profile);
    const ruins = node(map.nodes, 'loc_whispering_ruins')!;
    const library = node(map.nodes, 'loc_shattered_library')!;
    expect(ruins.py - library.py).toBe(6 * GRID.y);
    expect(ruins.px).toBe(library.px);
    expect(map.regions.map((r) => r.name)).toEqual(['Silverwood Ruins']);
    expect(map.width).toBeGreaterThan(GRID.pad);
  });
});

describe('routes and the travel preview (DESIGN §16.6)', () => {
  const { state, profile } = started();
  const s = walked(state, ['loc_whispering_ruins', 'loc_shattered_library', 'loc_silverwood_plaza', 'loc_shattered_library', 'loc_whispering_ruins']);
  const map = buildMap(s, content, profile);

  test('next door: one watch, the time it lands on, the risk', () => {
    const preview = travelPreview(s, content, profile, map, 'loc_shattered_library', yes);
    expect(preview).toMatchObject({ name: 'Shattered Library', next: 'loc_shattered_library', cost: '1 watch · Dawn → Day', risk: 'Lv 2–3 · a fight waits there', locked: null, canGo: true });
  });

  test('further away: the cheapest known route; Go takes its first step', () => {
    const route = routeTo(s, content, profile, map, 'loc_veridian_glowlands');
    expect(route?.legs.map((l) => l.to)).toEqual(['loc_shattered_library', 'loc_silverwood_plaza', 'loc_veridian_glowlands']);
    expect(route?.watches).toBe(3);
    const preview = travelPreview(s, content, profile, map, 'loc_veridian_glowlands', yes);
    expect(preview).toMatchObject({ name: 'An unknown place', next: 'loc_shattered_library', nextName: 'Shattered Library', cost: '3 watches over 3 steps · Dawn → Night', risk: 'Lv 9–10 · unknown' });
    expect(travelPreview(s, content, profile, map, 'loc_veridian_glowlands', () => false)?.canGo).toBe(false);
    expect(routeTo(s, content, profile, map, 'loc_whispering_ruins')).toBeNull(); // already there
    expect(travelPreview(s, content, profile, map, 'loc_whispering_ruins', yes)).toMatchObject({ cost: 'You are here', canGo: false });
    expect(travelPreview(s, content, profile, map, 'loc_nowhere', yes)).toBeNull();
  });

  test('a locked way says why; a safe place says so; the Horde’s ground warns; Dask cannot follow where time is steady', () => {
    const atNexus = walked(state, ['loc_veridian_glowlands', 'loc_chronos_nexus']);
    const p: Profile = { ...profile, mapKnowledge: ['loc_temporal_breach_apex'] };
    const m = buildMap(atNexus, content, p);
    const apex = travelPreview(atNexus, content, p, m, 'loc_temporal_breach_apex', yes);
    expect(String(apex?.locked)).toMatch(new RegExp(`^${escape('The stair up into the Breach will not hold you yet.')}`));
    expect(apex?.canGo).toBe(false);
    expect(apex?.cost).toBeNull();
    const ruins = travelPreview(s, content, profile, map, 'loc_whispering_ruins', yes);
    expect(ruins?.risk).toBeNull();
    const hordeDask = edit(s, (x) => {
      x.world.infected = ['loc_shattered_library'];
      x.companions.activeId = 'dask';
    });
    const hm = buildMap(hordeDask, content, profile);
    expect(travelPreview(hordeDask, content, profile, hm, 'loc_shattered_library', yes)?.danger).toBe('⚠ −33% HP: the Horde holds it');
    expect(travelPreview(hordeDask, content, profile, hm, 'loc_silverwood_plaza', yes)?.companion).toBe('Dask cannot follow you where time is steady.');
    const safeRuins = walked(state, ['loc_shattered_library']);
    const sm = buildMap(safeRuins, content, profile);
    expect(travelPreview(safeRuins, content, profile, sm, 'loc_whispering_ruins', yes)?.risk).toBe('Safe');
  });

  test('a frozen clock costs no time; no known way says so', () => {
    const frozen = edit(s, (x) => {
      x.clock.frozen = true;
    });
    expect(travelPreview(frozen, content, profile, buildMap(frozen, content, profile), 'loc_silverwood_plaza', yes)?.cost).toBe('No time passes · 2 steps');
    const p: Profile = { ...profile, mapKnowledge: ['loc_temporal_breach_apex'] };
    const m = buildMap(state, content, p);
    expect(travelPreview(state, content, p, m, 'loc_temporal_breach_apex', yes)?.locked).toBe('No way you know leads there yet.');
  });

  test('node names carry the state (DESIGN §16.7: "Barren Peaks, remembered, 1 watch")', () => {
    const n = node(map.nodes, 'loc_shattered_library')!;
    expect(nodeLabel(n, { cost: '1 watch · Dawn → Day' })).toBe('Shattered Library, visited, north, Dangerous (L2+), danger, Lv 2–3, 1 watch · Dawn → Day');
    expect(nodeLabel(node(map.nodes, 'loc_whispering_ruins')!)).toBe('Whispering Ruins, you are here, someone is here, camp');
    expect(nodeLabel({ ...n, name: null, state: 'adjacent', danger: null, cleared: false, infected: true, escape: true, boss: false, npc: false, rest: null, merchant: true, unstable: true, dir: null, threat: null })).toBe(
      'Unknown place, unexplored, the way out, infected, trader, time is loose here',
    );
    expect(nodeLabel({ ...n, boss: true })).toContain('a boss waits');
    expect(nodeLabel({ ...n, danger: null, cleared: true })).toContain('cleared');
  });

  test('initials', () => {
    expect(initials('Whispering Ruins')).toBe('WR');
    expect(initials('The Chronos Nexus')).toBe('CN');
    expect(initials("The Wayfarer's Respite")).toBe('WR');
    expect(initials('Hearthring')).toBe('HE');
    expect(initials('')).toBe('?');
  });
});

describe('the real world map (WORLD §11.1)', () => {
  const real = buildContentPack(contentTables, { validate: false });
  const store = createGameStore(real, freshProfile('r'), { storage: null });
  store.shell.newGame('Ann', 'ranger', 'world');
  const everything = Object.keys(real.locations);

  test('with every place remembered, all main-map places are drawn, none on the same spot, the Threshold left to its inset', () => {
    const p: Profile = { ...store.getProfile(), mapKnowledge: everything };
    const map = buildMap(store.getState(), real, p);
    const inset = Object.values(real.locations).filter((l) => l !== undefined && INSET_REGIONS.includes(l.regionId)).length;
    expect(inset).toBe(4);
    expect(map.nodes).toHaveLength(everything.length - inset);
    expect(new Set(map.nodes.map((n) => `${n.px},${n.py}`)).size).toBe(map.nodes.length);
    for (const n of map.nodes) {
      expect(n.px).toBeGreaterThanOrEqual(GRID.pad);
      expect(n.px).toBeLessThanOrEqual(map.width - GRID.pad);
      expect(n.py).toBeLessThanOrEqual(map.height - GRID.pad);
    }
    expect(map.regions.length).toBe(11);
  });
});

describe('MapView', () => {
  const { state, profile } = started();
  const s = walked(state, ['loc_whispering_ruins', 'loc_shattered_library']);
  const map = buildMap(s, content, profile);
  const preview = travelPreview(s, content, profile, map, 'loc_silverwood_plaza', yes);
  const route = routeTo(s, content, profile, map, 'loc_silverwood_plaza');

  test('every node is a named button; the current one is marked and takes focus in the panel', () => {
    const onNode = mock((_id: string) => undefined);
    const tree = expand(<MapView model={map} selected={null} preview={null} route={null} onNode={onNode} onGo={() => undefined} onCenter={() => undefined} />);
    const nodes = all(tree, 'button').filter((b) => b.props['data-node'] !== undefined);
    expect(nodes.map(nameOf)).toEqual([
      'Whispering Ruins, visited, south, someone is here, camp',
      'Shattered Library, you are here, danger, Lv 2–3',
      'Unknown place, unexplored, east, Dangerous (L2+)', // U84: the danger cue (a Level 1 party, a band from L2)
    ]);
    const current = byName(tree, 'button', /you are here/);
    expect(current.props['aria-current']).toBe('location');
    expect(current.props['data-autofocus']).toBe('');
    call(byName(tree, 'button', /^Unknown place/), 'onClick');
    expect(onNode.mock.calls).toEqual([['loc_silverwood_plaza']]);
    const scope = all(tree, 'div').find((d) => d.props['data-hotkey-scope'] === 'map');
    expect(scope).toBeDefined(); // WASD works only with focus inside this element
    expect(renderToStaticMarkup(<MapView model={map} selected={null} preview={null} route={null} onNode={onNode} onGo={() => undefined} onCenter={() => undefined} />)).toContain('You are at Shattered Library.');
  });

  test('a chosen node shows the route preview with Go; Center on me; the legend', () => {
    const go = mock(() => undefined);
    const center = mock(() => undefined);
    const tree = expand(<MapView model={map} selected="loc_silverwood_plaza" preview={preview} route={route} onNode={() => undefined} onGo={go} onCenter={center} />);
    call(byName(tree, 'button', 'Go to An unknown place'), 'onClick');
    call(byName(tree, 'button', 'Center on me'), 'onClick');
    expect(go.mock.calls).toHaveLength(1);
    expect(center.mock.calls).toHaveLength(1);
    expect(nameOf(byName(tree, 'button', /^Unknown place/))).toContain('1 watch · Dawn → Day');
    const html = renderToStaticMarkup(<MapView model={map} selected="loc_silverwood_plaza" preview={preview} route={route} onNode={() => undefined} onGo={go} onCenter={center} />);
    expect(html).toContain('map-edge--route');
    expect(html).toContain('map-node--selected');
    expect(html).toContain('<summary>Legend</summary>');
    expect(html).toContain('aria-live="polite"');
  });

  test('a far target’s Go names the first step; locks and dangers are listed; docked has no autofocus and no legend', () => {
    const far = { ...preview!, target: 'loc_x', next: 'loc_silverwood_plaza', nextName: 'Silverwood Plaza', danger: '⚠ −33% HP', companion: 'Dask cannot follow you where time is steady.', locked: null };
    const tree = expand(<MapView model={map} selected={null} preview={far} route={null} docked onNode={() => undefined} onGo={() => undefined} onCenter={() => undefined} />);
    expect(all(tree, 'button').some((b) => nameOf(b) === 'Go: first to Silverwood Plaza')).toBe(true);
    expect(all(tree, 'button').some((b) => b.props['data-autofocus'] !== undefined)).toBe(false);
    const html = renderToStaticMarkup(<MapView model={map} selected={null} preview={{ ...far, canGo: false, locked: 'Shut.' }} route={null} docked onNode={() => undefined} onGo={() => undefined} onCenter={() => undefined} />);
    expect(html).toContain('Shut.');
    expect(html).toContain('⚠ −33% HP');
    expect(html).not.toContain('Legend');
    expect(html).not.toContain('Go:');
  });

  test('locked edges get a lock glyph; centerOn scrolls a viewport to a node', () => {
    const atNexus = walked(state, ['loc_veridian_glowlands', 'loc_chronos_nexus']);
    const m = buildMap(atNexus, content, profile);
    expect(renderToStaticMarkup(<MapView model={m} selected={null} preview={null} route={null} onNode={() => undefined} onGo={() => undefined} onCenter={() => undefined} />)).toContain('class="map__lock"');
    const calls: unknown[] = [];
    const viewport = { clientWidth: 200, clientHeight: 100, scrollTo: (o: unknown) => calls.push(o) } as unknown as HTMLElement;
    centerOn(viewport, { px: 300, py: 250 });
    centerOn(null, { px: 1, py: 1 });
    centerOn(viewport, undefined);
    expect(calls).toEqual([{ left: 200, top: 200 }]);
  });
});
