// U15: LocationSchema (PLAN §5.3, §5.17) — WORLD §3 locations parse; per-record refinements bite.
import { describe, expect, test } from 'bun:test';
import { ExitSchema, LocationEventSchema, LocationSchema, type LocationInput } from '@schema/location';

const messages = (value: unknown): string[] => {
  const r = LocationSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

/** PLAN §5.17, the authoring-style example (WORLD §3.1). */
const whisperingRuins: LocationInput = {
  id: 'loc_whispering_ruins',
  regionId: 'region_silverwood_ruins',
  name: 'Whispering Ruins',
  legacyName: 'Whispering Ruins',
  description:
    'The air smells of ozone and decay, and a chill wind carries faint whispers. Twisted trees reach into a twilight sky, their branches dotted with glowing crystals. Broken stone tablets litter the ground, etched with worn sigils.',
  descriptionVariants: [{ when: { loop: { min: 2 } }, text: 'The whispers are the same. The sky is the same. You have stood here before, and the stones know it.' }],
  exits: [
    { dir: 'north', to: 'loc_crumbling_archway' },
    { dir: 'east', to: 'loc_mistwood_path' },
    { dir: 'south', to: 'loc_sunken_archives' },
  ],
  items: [{ itemId: 'item_amulet_of_echoes', when: { loop: { max: 1 } } }],
  npcs: ['npc_ilyra'],
  events: [{ id: 'ev_ruins_echo', text: 'A low, resonant hum vibrates under your skin, as if the stones are breathing.' }],
  art: { template: 'ruins', silhouettes: ['dead_tree', 'tablet', 'arch_broken'], particles: 'motes', timeOfDay: 'dusk' },
  rest: { kind: 'camp', text: 'You make camp beneath the twisted trees. The whispers keep you company.' },
  map: { x: 0, y: 6 },
  safe: true,
  tags: ['start', 'legacy', 'remnants'],
};

/**
 * WORLD §3.7 `loc_scorched_gate`: four ordinary exits plus the Waystone road (D-069.9), a gather node, an NPC, an event, a
 * Horde-state encounter (WORLD: "Horde: cr_horde_husk ×2") with `onFlee` and `onFleeEffects`, description and art variants.
 * The Horde description variant and the art patch are test-only additions.
 */
const scorchedGate: LocationInput = {
  id: 'loc_scorched_gate',
  regionId: 'region_ashen_steppe',
  name: 'The Scorched Gate',
  description:
    "The Outpost's east gate burned and was never rebuilt, so the Nomads built a smaller one inside its frame. Two scouts, a brazier, a horn. Beyond the gate the grass is grey to the horizon and the sky is white with falling ash.",
  descriptionVariants: [
    { when: { flag: 'flag_tyrant_dead' }, text: 'The brazier is out. The horn lies where it fell, and the grass beyond the gate is moving.' },
    { when: { all: [{ loop: { min: 3 } }, { echo: 'echo_nomad_signs' }] }, text: 'Ferrin raises two fingers before you reach the gate. Friend.' },
  ],
  exits: [
    { dir: 'west', to: 'loc_blighted_outpost' },
    { dir: 'east', to: 'loc_ash_wind_flats' },
    { dir: 'north', to: 'loc_bone_orchard' },
    { dir: 'south', to: 'loc_watchfire_ridge', dangerText: 'Grey shapes crowd the ridge road.' },
    {
      dir: 'path',
      to: 'loc_reedmarch_descent',
      label: 'the waystone road',
      kind: 'road',
      gate: { echo: 'echo_steppe_waystones' },
      travelWatches: 1,
    },
    { dir: 'portal', to: 'loc_still_shore', hidden: true, when: { flag: 'flag_scorched_gate_rift' }, lockedText: 'The air here is still.', oneWay: true },
  ],
  items: [{ itemId: 'item_nomad_hardtack', count: 2 }],
  gather: { itemId: 'mat_ember_ore', perDay: 1 },
  encounters: [
    {
      id: 'enc_gate_husks',
      groups: [{ creatureId: 'cr_horde_husk', count: 2 }],
      when: { flag: 'flag_tyrant_dead' },
      ambush: true,
      onFlee: 'scatter',
      onFleeEffects: [{ passWatches: 2 }, { scatter: { location: 'loc_scorched_gate' } }],
      onVictory: [{ xp: 40 }],
    },
  ],
  npcs: ['npc_scout_ferrin'],
  events: [
    {
      id: 'ev_gate_horn',
      text: "Ferrin blows two notes on the horn. Far off, two notes answer. 'Hearthring knows you're coming,' he says.",
      trigger: 'enter',
      once: false,
    },
    {
      id: 'ev_gate_brazier',
      text: 'The slag heap by the brazier is still warm.',
      trigger: 'interact',
      label: 'Search the slag heap',
      effects: [{ giveItem: { item: 'mat_ember_ore' } }],
    },
  ],
  art: {
    template: 'steppe',
    horizon: 0.58,
    silhouettes: ['gate_in_gate', 'brazier', 'scouts_leaning'],
    particles: 'ash',
    timeOfDay: 'dusk',
    variants: [{ when: { flag: 'flag_tyrant_dead' }, patch: { particles: 'embers', timeOfDay: 'night' } }],
  },
  map: { x: 32, y: 4 },
  levelBand: { min: 7, max: 7 },
  tags: ['steppe', 'gate'],
};

describe('LocationSchema', () => {
  test('loc_whispering_ruins (PLAN §5.17) parses', () => {
    expect(messages(whisperingRuins)).toEqual([]);
    const loc = LocationSchema.parse(whisperingRuins);
    expect(loc.exits.map((e) => e.dir)).toEqual(['north', 'east', 'south']);
    expect(loc.safe).toBe(true);
    expect(loc.exits[0]?.travelWatches).toBe(1);
    expect(loc.exits[0]?.kind).toBe('path');
    expect(loc.exits[0]?.hidden).toBe(false);
    expect(loc.events[0]?.trigger).toBe('enter');
    expect(loc.events[0]?.once).toBe(true);
    expect(loc.art.horizon).toBe(0.6);
    expect(loc.rest?.cost).toBe(0);
    expect(loc.rest?.healPct).toBe(1);
    expect(loc.waitable).toBe(false);
    expect(loc.temporallyUnstable).toBe(false);
    expect(loc.encounters).toEqual([]);
  });

  test('loc_scorched_gate: road exit with a gate, encounter with onFlee/onFleeEffects, events, variants', () => {
    expect(messages(scorchedGate)).toEqual([]);
    const loc = LocationSchema.parse(scorchedGate);
    const road = loc.exits.find((e) => e.kind === 'road');
    expect(road).toBeDefined();
    expect(road?.gate).toEqual({ echo: 'echo_steppe_waystones' });
    expect(road?.to).toBe('loc_reedmarch_descent');
    expect(road?.travelWatches).toBe(1);
    expect(loc.exits.filter((e) => e.kind === 'path')).toHaveLength(5);
    const husks = loc.encounters[0];
    expect(husks?.onFlee).toBe('scatter');
    expect(husks?.onFleeEffects).toEqual([{ passWatches: 2 }, { scatter: { location: 'loc_scorched_gate' } }]);
    expect(husks?.fleeable).toBe(true);
    expect(loc.events.map((e) => e.trigger)).toEqual(['enter', 'interact']);
    expect(loc.events[0]?.once).toBe(false);
    expect(loc.descriptionVariants).toHaveLength(2);
    expect(loc.art.variants).toHaveLength(1);
    expect(loc.gather).toEqual({ itemId: 'mat_ember_ore', perDay: 1 });
    expect(loc.levelBand).toEqual({ min: 7, max: 7 });
  });

  test('the road gate is any Condition', () => {
    const r = ExitSchema.safeParse({ dir: 'path', to: 'loc_a', kind: 'road', gate: { any: [{ echo: 'echo_x' }, { flag: 'flag_y' }] } });
    expect(r.success).toBe(true);
  });

  test('bad id prefixes fail', () => {
    expect(messages({ ...whisperingRuins, id: 'whispering_ruins' })[0]).toContain('prefix loc_');
    expect(messages({ ...whisperingRuins, regionId: 'silverwood_ruins' })[0]).toContain('prefix region_');
    expect(messages({ ...whisperingRuins, exits: [{ dir: 'north', to: 'crumbling_archway' }] })[0]).toContain('prefix loc_');
    expect(messages({ ...whisperingRuins, npcs: ['ilyra'] })[0]).toContain('prefix npc_');
    expect(messages({ ...whisperingRuins, items: [{ itemId: 'amulet_of_echoes' }] })[0]).toContain('prefix item_ or mat_');
    expect(messages({ ...whisperingRuins, events: [{ id: 'ruins_echo', text: 'x' }] })[0]).toContain('prefix ev_');
    expect(messages({ ...whisperingRuins, merchantId: 'tamsin' })[0]).toContain('prefix npc_');
    expect(messages({ ...scorchedGate, encounters: [{ id: 'enc_x', groups: [{ creatureId: 'husk' }] }] })[0]).toContain('prefix cr_');
  });

  test('missing required fields and unknown keys/enums fail', () => {
    for (const key of ['regionId', 'name', 'description', 'art', 'map'] as const) {
      const copy: Record<string, unknown> = { ...whisperingRuins };
      delete copy[key];
      expect(messages(copy).join()).toContain(key);
    }
    expect(messages({ ...whisperingRuins, exits: [{ dir: 'northeast', to: 'loc_a' }] })).not.toEqual([]);
    expect(messages({ ...whisperingRuins, exits: [{ dir: 'north', to: 'loc_a', speed: 2 }] })).not.toEqual([]);
    expect(messages({ ...whisperingRuins, art: { template: 'swamp-ish' } })).not.toEqual([]);
    expect(messages({ ...whisperingRuins, craftingStation: 'kiln' })).not.toEqual([]);
    expect(messages({ ...whisperingRuins, weather: 'rain' })).not.toEqual([]);
    expect(messages({ ...whisperingRuins, exits: [{ dir: 'north', to: 'loc_a', travelWatches: 9 }] })).not.toEqual([]);
    expect(messages({ ...whisperingRuins, gather: { itemId: 'mat_ember_ore', perDay: 3 } })).not.toEqual([]);
    expect(messages({ ...whisperingRuins, levelBand: { min: 4, max: 2 } })[0]).toContain('level band min must be ≤ max');
  });

  test('kind: road ⇔ gate (D-069.9)', () => {
    const exit = { dir: 'path', to: 'loc_reedmarch_descent' } as const;
    expect(messages({ ...scorchedGate, exits: [{ ...exit, kind: 'road' }] })).toEqual(['exits.0.gate: a road exit needs a `gate` (D-069.9)']);
    expect(messages({ ...scorchedGate, exits: [{ ...exit, gate: { echo: 'echo_steppe_waystones' } }] })).toEqual([
      "exits.0.kind: `gate` is only for kind: 'road' (use `when` for ordinary locks)",
    ]);
    expect(messages({ ...scorchedGate, exits: [{ ...exit, kind: 'road', gate: { echo: 'echo_steppe' } }] })).toEqual([]);
    expect(messages({ ...scorchedGate, exits: [{ ...exit, kind: 'road', gate: { echo: 'steppe' } }] })).not.toEqual([]);
    expect(messages({ ...scorchedGate, exits: [{ ...exit, kind: 'track' }] })).not.toEqual([]);
  });

  test('an exit never leads to its own location; directions are unique except path', () => {
    expect(messages({ ...whisperingRuins, exits: [{ dir: 'north', to: 'loc_whispering_ruins' }] })).toEqual([
      'exits.0.to: an exit cannot lead to its own location',
    ]);
    expect(
      messages({ ...whisperingRuins, exits: [{ dir: 'south', to: 'loc_watchfire_ridge' }, { dir: 'south', to: 'loc_reedmarch_descent' }] }),
    ).toEqual(["exits.1.dir: direction 'south' is used by two exits; use 'path' for extra routes"]);
    const twoPaths = [{ dir: 'path', to: 'loc_a' }, { dir: 'path', to: 'loc_b' }];
    expect(messages({ ...whisperingRuins, exits: twoPaths })).toEqual([]);
  });

  test('duplicate encounter ids and event ids within a location fail', () => {
    const enc = { id: 'enc_a', groups: [{ creatureId: 'cr_corrupted_shade' }] };
    expect(messages({ ...whisperingRuins, encounters: [enc, enc] })).toEqual(["encounters.1.id: duplicate encounter id 'enc_a' in this location"]);
    const ev = { id: 'ev_a', text: 'x' };
    expect(messages({ ...whisperingRuins, events: [ev, ev] })).toEqual(["events.1.id: duplicate event id 'ev_a' in this location"]);
  });

  test('an interact event needs a button label', () => {
    expect(LocationEventSchema.safeParse({ id: 'ev_touch', text: 'x', trigger: 'interact' }).success).toBe(false);
    expect(LocationEventSchema.safeParse({ id: 'ev_touch', text: 'x', trigger: 'interact', label: 'Touch the Heartstone' }).success).toBe(true);
    expect(LocationEventSchema.safeParse({ id: 'ev_touch', text: 'x', trigger: 'sing' }).success).toBe(false);
    expect(LocationEventSchema.safeParse({ id: 'ev_touch', text: '' }).success).toBe(false);
  });

  test('conditions and effects inside a location are the canonical atoms', () => {
    expect(messages({ ...whisperingRuins, descriptionVariants: [{ when: { loops: { min: 2 } }, text: 'x' }] })[0]).toContain("unknown condition atom 'loops'");
    expect(messages({ ...whisperingRuins, events: [{ id: 'ev_a', text: 'x', effects: [{ giveGold: 5 }] }] })[0]).toContain("unknown effect atom 'giveGold'");
    expect(messages({ ...whisperingRuins, exits: [{ dir: 'north', to: 'loc_a', when: { all: [], flag: 'flag_x' } }] })).not.toEqual([]);
  });
});
