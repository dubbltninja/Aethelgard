// The Fall forecast and the Breach overlay (U70; DESIGN §10.1, §10.2, §16.6, §17.2, §17.7): the places the expiry Horde will
// reach (one step per day from the Apex, from five dawns before the limit), drawn as a lighter hatch on the real pack’s map;
// the running Horde’s hatch and the Library’s way out from a real Horde state; the overlay’s value, which only moves with the
// day. Fixture states come from the real pack’s scenarios.
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { HORDE_SOURCE_ID, TICKS_PER_DAY, type GameState, type Profile } from '@engine/index';
import { loadScenario } from '@sim/scenarios';
import { breachOverlay, HORDE_LEVEL, INFECTED_LEVEL } from '@ui/art/breachOverlay';
import { MapView, ForecastNote } from '@ui/panels/MapPanel';
import { FORECAST_DAWNS, buildMap, forecastReach, nodeLabel } from '@ui/panels/mapModel';
import { pack } from './panelFixtures';

const base = loadScenario('loop1_day1', pack);

/** Every place the pack draws on the main map is known, so the forecast has somewhere to show. */
function atDawns(dawns: number, over: (s: GameState) => void = () => undefined): { state: GameState; profile: Profile } {
  const state = structuredClone(base.state);
  state.clock.ticks = state.clock.limitTicks - dawns * TICKS_PER_DAY;
  over(state);
  const profile: Profile = { ...structuredClone(base.profile), mapKnowledge: Object.keys(pack.locations) };
  return { state, profile };
}

const forecastIds = (at: { state: GameState; profile: Profile }): string[] => buildMap(at.state, pack, at.profile).nodes.filter((n) => n.forecast !== null).map((n) => n.id);

describe('forecastReach', () => {
  test('nothing before five dawns; the Apex alone at five; one more step a day', () => {
    expect(forecastReach(atDawns(6).state, pack, base.profile)).toBeNull();
    expect(FORECAST_DAWNS).toBe(5);
    const sizes = [5, 4, 3, 2, 1].map((d) => forecastReach(atDawns(d).state, pack, base.profile)?.size ?? 0);
    expect(sizes[0]).toBe(1);
    for (let i = 1; i < sizes.length; i += 1) expect(sizes[i]).toBeGreaterThan(sizes[i - 1] as number);
    expect([...(forecastReach(atDawns(5).state, pack, base.profile) ?? new Map()).keys()]).toEqual([HORDE_SOURCE_ID]);
  });

  test('it is the Horde’s own reach: no portal edges, never the Before or the Threshold, a step count per place', () => {
    const reach = forecastReach(atDawns(1).state, pack, base.profile) as Map<string, number>;
    expect(reach.get(HORDE_SOURCE_ID)).toBe(0);
    for (const id of reach.keys()) {
      const region = pack.locations[id]?.regionId;
      expect(['region_silverwood_before', 'region_threshold']).not.toContain(region);
    }
    expect(Math.max(...reach.values())).toBeLessThanOrEqual(4);
    expect(reach.has('loc_shattered_library')).toBe(false); // behind a portal edge or too far: the Library is the way out
  });

  test('it ends where the Horde begins: none once the clock has expired or a Horde runs, none at the limit', () => {
    expect(forecastReach(atDawns(3, (s) => { s.world.hordeActive = true; }).state, pack, base.profile)).toBeNull();
    expect(forecastReach(atDawns(3, (s) => { s.clock.expired = true; }).state, pack, base.profile)).toBeNull();
    expect(forecastReach(atDawns(0).state, pack, base.profile)).toBeNull();
  });
});

describe('the forecast on the map', () => {
  test('at five dawns only the Apex node is forecast, and the summary says how many dawns are left', () => {
    const at = atDawns(5);
    const map = buildMap(at.state, pack, at.profile);
    expect(forecastIds(at)).toEqual([HORDE_SOURCE_ID]);
    expect(map.forecast).toMatchObject({ dawnsLeft: 5, reach: 0 });
    expect(map.forecast?.places).toEqual([pack.locations[HORDE_SOURCE_ID]?.name]);
  });

  test('two dawns on: the Apex and the places three steps round it; edges between forecast places are marked too', () => {
    const at = atDawns(2);
    const map = buildMap(at.state, pack, at.profile);
    const ids = forecastIds(at);
    expect(ids.length).toBeGreaterThan(1);
    expect(ids).toContain(HORDE_SOURCE_ID);
    expect(map.forecast).toMatchObject({ dawnsLeft: 2, reach: 3 });
    const marked = map.edges.filter((e) => e.forecast);
    expect(marked.length).toBeGreaterThan(0);
    for (const e of marked) {
      expect(ids).toContain(e.a);
      expect(ids).toContain(e.b);
    }
  });

  test('places that are not on the map are not given away', () => {
    const at = atDawns(2);
    const sparse: Profile = { ...at.profile, mapKnowledge: [] };
    const map = buildMap(at.state, pack, sparse);
    expect(map.nodes.every((n) => n.forecast === null || n.state !== 'adjacent' || n.name === null)).toBe(true);
    expect(map.nodes.map((n) => n.id)).not.toContain(HORDE_SOURCE_ID);
  });

  test('a node button says it in words (colour and hatch are not the only cue)', () => {
    const at = atDawns(5);
    const apex = buildMap(at.state, pack, at.profile).nodes.find((n) => n.id === HORDE_SOURCE_ID);
    expect(apex).toBeDefined();
    expect(nodeLabel(apex as NonNullable<typeof apex>)).toContain('the Horde will reach it');
  });

  test('MapView draws the hatch classes, the forecast note and a legend line', () => {
    const at = atDawns(2);
    const model = buildMap(at.state, pack, at.profile);
    const html = renderToStaticMarkup(
      <MapView model={model} selected={null} preview={null} route={null} onNode={() => undefined} onGo={() => undefined} onCenter={() => undefined} />,
    );
    expect(html).toContain('map-node--forecast');
    expect(html).toContain('map-edge--forecast');
    expect(html).toContain('map__forecast');
    expect(html).toContain('The Breach tears open in 2 dawns.');
    expect(html).toContain('Light hatch: the Horde is forecast to reach it');
    expect(html).toContain('the Horde will reach it');
  });

  test('no forecast, no note; the docked map keeps it short; one dawn is "one dawn"', () => {
    const calm = atDawns(12);
    const model = buildMap(calm.state, pack, calm.profile);
    expect(model.forecast).toBeNull();
    expect(renderToStaticMarkup(<MapView model={model} selected={null} preview={null} route={null} onNode={() => undefined} onGo={() => undefined} onCenter={() => undefined} />)).not.toContain('map__forecast');
    const note = renderToStaticMarkup(<ForecastNote forecast={{ dawnsLeft: 1, reach: 4, places: ['A', 'B'] }} docked />);
    expect(note).toContain('The Breach tears open in one dawn.');
    expect(note).not.toContain('On your map');
    expect(renderToStaticMarkup(<ForecastNote forecast={{ dawnsLeft: 1, reach: 4, places: ['A', 'B'] }} docked={false} />)).toContain('On your map: A, B.');
  });
});

describe('a running Horde on the map (the hatched nodes and the way out)', () => {
  test('infected places are hatched and named under fog, the Library is the way out, the forecast has given way', () => {
    const at = atDawns(0, (s) => {
      s.clock.expired = true;
      s.world.hordeActive = true;
      s.world.hordeCause = 'expiry';
      s.world.infected = [HORDE_SOURCE_ID];
    });
    const model = buildMap(at.state, pack, { ...at.profile, mapKnowledge: [] });
    const apex = model.nodes.find((n) => n.id === HORDE_SOURCE_ID);
    const library = model.nodes.find((n) => n.escape);
    expect(apex).toMatchObject({ infected: true, forecast: null });
    expect(apex?.name).toBe(pack.locations[HORDE_SOURCE_ID]?.name);
    expect(library?.id).toBe('loc_shattered_library');
    expect(model.forecast).toBeNull();
    const html = renderToStaticMarkup(
      <MapView model={model} selected={null} preview={null} route={null} onNode={() => undefined} onGo={() => undefined} onCenter={() => undefined} />,
    );
    expect(html).toContain('map-node--infected');
    expect(html).toContain('map-node--escape');
    expect(html).not.toContain('map-node--forecast');
    expect(nodeLabel(apex as NonNullable<typeof apex>)).toContain('infected');
    expect(nodeLabel(library as NonNullable<typeof library>)).toContain('the way out');
  });
});

describe('breachOverlay: a value only, moving with the day', () => {
  const clock = (dawns: number, expired = false): { ticks: number; limitTicks: number; expired: boolean } => ({ ticks: 0, limitTicks: dawns * TICKS_PER_DAY, expired });
  const level = (dawns: number): number => breachOverlay({ clock: clock(dawns), hordeActive: false, infected: false });

  test('nothing beyond five dawns, a thin tinge from five that grows each dawn', () => {
    expect(level(30)).toBe(0);
    expect(level(6)).toBe(0);
    const ramp = [5, 4, 3, 2, 1].map(level);
    expect(ramp[0]).toBeGreaterThan(0);
    for (let i = 1; i < ramp.length; i += 1) expect(ramp[i]).toBeGreaterThan(ramp[i - 1] as number);
    expect(Math.max(...ramp)).toBeLessThan(HORDE_LEVEL);
  });

  test('the Horde, the expiry and an infected place have their own levels', () => {
    expect(breachOverlay({ clock: clock(0, true), hordeActive: false, infected: false })).toBe(HORDE_LEVEL);
    expect(breachOverlay({ clock: clock(3), hordeActive: true, infected: false })).toBe(HORDE_LEVEL);
    expect(breachOverlay({ clock: clock(3), hordeActive: true, infected: true })).toBe(INFECTED_LEVEL);
    expect(INFECTED_LEVEL).toBeGreaterThan(HORDE_LEVEL);
  });

  test('within a day it does not move: every watch of one day gives the same value', () => {
    const limit = 10 * TICKS_PER_DAY;
    const values = [0, 1, 2, 3].map((w) => breachOverlay({ clock: { ticks: 6 * TICKS_PER_DAY + w, limitTicks: limit, expired: false }, hordeActive: false, infected: false }));
    expect(new Set(values).size).toBeLessThanOrEqual(2); // dawn of the next day may step it, a watch never does inside the day
    expect(values[1]).toBe(values[0] as number);
  });
});
