// U18: the fixture pack (tests/fixtures/miniContent.ts) builds and parses, holds what PLAN §8 / the U18 brief list,
// and refers only to its own records; the helpers (makeState, play, freshProfile) and the soft collector work.
import { describe, expect, test } from 'bun:test';
import { ContentError, buildContentPack, parseContentPack, type ContentPack } from '@content/index';
import { COMMUNION_MOVEMENTS } from '@schema/creature';
import { CANONICAL_STATUSES } from '@schema/status';
import { HANDLERS, createStep, type Action, type HandlerTable } from '@engine/index';
import { FIXTURE_APEX_GATE, FIXTURE_VERSION, fixturePack, miniContentTables } from '@tests/fixtures/miniContent';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';
import { releaseGate, resetSoft, soft, softFailures, softSummary } from '@tests/fixtures/soft';

const pack = fixturePack();
const count = (table: keyof ContentPack) => Object.keys(pack[table] as object).length;
const values = <T>(table: Record<string, T>): T[] => Object.values(table);

describe('the fixture pack builds through buildContentPack', () => {
  test('parses with no errors or warnings, and the cached pack is frozen', () => {
    const { report } = parseContentPack(miniContentTables, { version: FIXTURE_VERSION });
    expect(report).toEqual({ errors: [], warnings: [] });
    expect(fixturePack()).toBe(pack);
    expect(pack.version).toBe(FIXTURE_VERSION);
    expect(Object.isFrozen(pack.items.item_rusty_dagger)).toBe(true);
    expect(Object.isFrozen(miniContentTables.items)).toBe(true);
  });

  test('a broken variant fails loudly', () => {
    const broken = { ...miniContentTables, items: [...miniContentTables.items, { id: 'item_bad', name: 'Bad' }] };
    expect(() => buildContentPack(broken as typeof miniContentTables)).toThrow(ContentError);
  });

  test('the brief’s inventory', () => {
    expect([count('regions'), count('locations'), count('creatures'), count('classes')]).toEqual([2, 6, 4, 2]);
    expect(Object.keys(pack.statuses).sort()).toEqual([...CANONICAL_STATUSES].sort());
    for (const slot of ['weapon', 'armor', 'trinket'] as const) {
      expect(values(pack.items).filter((i) => i.slot === slot).length).toBeGreaterThanOrEqual(2);
    }
    expect([count('recipes'), count('quests'), count('dialogues'), count('echoes'), count('merchants'), count('modifiers'), count('endings')]).toEqual([
      1, 1, 1, 2, 1, 1, 1,
    ]);
    expect(pack.quests.q_echo_crystal!.stages).toHaveLength(2);
    expect(Object.keys(pack.factions)).toEqual(['remnants']);
    expect(Object.keys(pack.companions)).toEqual(['ilyra']);
    for (const cls of ['ranger', 'wizard']) expect(pack.index.abilitiesByClass[cls]!.length).toBeGreaterThanOrEqual(3);
    expect(pack.index.startLocationId).toBe('loc_whispering_ruins');
    expect(pack.config.apexGate).toEqual(FIXTURE_APEX_GATE);
  });

  test('a rest point, a merchant, a gated exit and a road', () => {
    const locs = values(pack.locations);
    expect(locs.filter((l) => l.rest).map((l) => l.id)).toEqual(['loc_whispering_ruins']);
    expect(locs.filter((l) => l.merchantId).map((l) => l.merchantId)).toEqual(['npc_tamsin_reed']);
    const exits = locs.flatMap((l) => l.exits.map((x) => ({ from: l.id, ...x })));
    expect(exits.filter((x) => x.when).map((x) => `${x.from}→${x.to}`)).toEqual(['loc_chronos_nexus→loc_temporal_breach_apex']);
    expect(exits.filter((x) => x.kind === 'road').map((x) => `${x.from}→${x.to}`).sort()).toEqual([
      'loc_chronos_nexus→loc_whispering_ruins',
      'loc_whispering_ruins→loc_chronos_nexus',
    ]);
    // every exit has its way back (PLAN §5.19 rule 7)
    for (const x of exits) expect(pack.locations[x.to]!.exits.some((back) => back.to === x.from)).toBe(true);
  });

  test('fodder, elite, wandering and a three-phase boss whose Movements mirror its phases', () => {
    const roles = Object.fromEntries(values(pack.creatures).map((c) => [c.id, c.role]));
    expect(roles).toEqual({
      cr_corrupted_shade: 'fodder',
      cr_glowfen_mireling: 'fodder',
      cr_temporal_aberration: 'elite',
      cr_chronos_tyrant_unveiled: 'boss',
    });
    expect(pack.regions.region_glowlands_nexus!.wanderingPool.map((w) => w.creatureId)).toEqual(['cr_glowfen_mireling']);
    const boss = pack.creatures.cr_chronos_tyrant_unveiled!;
    expect(boss.phases.map((p) => p.id)).toEqual([...COMMUNION_MOVEMENTS]);
    expect(boss.communion?.movements.map((m) => m.id)).toEqual([...COMMUNION_MOVEMENTS]);
    expect(boss.phases[1]!.adds[0]).toMatchObject({ creatureId: 'cr_temporal_aberration', count: 2, countSolo: 1 });
  });

  test('every id-shaped string in the pack names a record of the pack (until U19’s validator)', () => {
    const TABLE_OF: [RegExp, keyof ContentPack][] = [
      [/^loc_/, 'locations'], [/^region_/, 'regions'], [/^cr_/, 'creatures'], [/^(item|mat)_/, 'items'], [/^recipe_/, 'recipes'],
      [/^(rgr|wiz|elf|wrd|wvr|itm|comp)_/, 'abilities'], [/^status_/, 'statuses'], [/^q_/, 'quests'], [/^scene_/, 'dialogues'],
      [/^npc_/, 'npcs'], [/^echo_/, 'echoes'], [/^codex_/, 'codex'], [/^mod_/, 'modifiers'], [/^(ending|closer)_/, 'endings'], [/^affix_/, 'affixes'],
    ];
    const dangling: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (typeof node === 'string') {
        const hit = TABLE_OF.find(([re]) => re.test(node) && /^[a-z0-9_]+$/.test(node));
        if (hit && !Object.hasOwn(pack[hit[1]] as object, node)) dangling.push(`${path}: ${node}`);
      } else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}.${i}`));
      else if (typeof node === 'object' && node !== null) for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
    };
    const { index: _index, ...tables } = pack;
    walk(tables, 'pack');
    expect(dangling).toEqual([]);
  });
});

describe('makeState / freshProfile', () => {
  test('default: Loop 1 Ranger at the start, DESIGN §3.3 maxima and starter kit', () => {
    const s = makeState();
    expect(s.meta).toMatchObject({ seed: 'fixture', loop: 1 });
    expect(s.world.currentLocationId).toBe('loc_whispering_ruins');
    expect(s.player).toMatchObject({ classId: 'ranger', level: 1, hp: 120, hpMax: 120, mp: 48, mpMax: 48, gold: 30 });
    expect(s.player.equipment.weapon?.itemId).toBe('item_rusty_dagger');
    expect(s.player.inventory.map((i) => [i.itemId, i.qty])).toEqual([['item_ley_touched_tonic', 2]]);
  });

  test('overrides keyed by content ids', () => {
    const s = makeState({
      classId: 'wizard',
      loop: 2,
      level: 12,
      locationId: 'loc_chronos_nexus',
      day: 3,
      watch: 2,
      items: ['item_echo_crystal', { itemId: 'item_chronos_lens', equip: true }, { itemId: 'item_glow_moss', qty: 3 }],
      abilities: ['wiz_fireball'],
      flags: { flag_spellbook_dropped: true },
      echoes: ['echo_apex_resonance'],
      quests: { q_echo_crystal: 'crystal_found' },
      reputation: { remnants: 25 },
      corruption: 3,
      patch: (st) => void (st.player.gold = 99),
    });
    expect(s.meta.loop).toBe(2);
    expect(s.player).toMatchObject({ level: 12, hpMax: 162, mpMax: 127, apHalf: 24, statPoints: 11, gold: 99, corruption: 3 });
    expect(s.world.discovered).toEqual(['loc_whispering_ruins', 'loc_chronos_nexus']);
    expect(s.clock.ticks).toBe(10);
    // Loop 2: the Amulet is in the starter inventory (D-047) before the added items
    expect(s.player.inventory.map((i) => i.itemId)).toEqual(['item_mana_bloom', 'item_ley_touched_tonic', 'item_amulet_of_echoes', 'item_echo_crystal', 'item_glow_moss']);
    expect(s.player.equipment.trinket1?.itemId).toBe('item_chronos_lens');
    expect(new Set([...s.player.inventory, s.player.equipment.weapon!, s.player.equipment.trinket1!].map((i) => i.uid)).size).toBe(7);
    expect(s.quests.q_echo_crystal).toEqual({ status: 'active', stage: 'crystal_found', startedDay: 3, endedDay: null, counters: {}, objectivesDone: [] });
    expect([s.player.abilitiesUnlocked, s.echoesThisLoop, s.flags, s.reputation.remnants]).toEqual([
      ['wiz_fireball'],
      ['echo_apex_resonance'],
      { flag_spellbook_dropped: true },
      25,
    ]);
    expect(makeState({ quests: { q_echo_crystal: { status: 'completed' } } }).quests.q_echo_crystal?.stage).toBe('find_crystal');
  });

  test('typos and impossible states throw where they are written', () => {
    expect(() => makeState({ locationId: 'loc_nowhere' })).toThrow("unknown locations id 'loc_nowhere'");
    expect(() => makeState({ items: ['item_excalibur'] })).toThrow("unknown items id 'item_excalibur'");
    expect(() => makeState({ quests: { q_echo_crystal: 'done' } })).toThrow("has no stage 'done'");
    expect(() => makeState({ items: [{ itemId: 'item_rusty_dagger', qty: 2 }] })).toThrow('does not stack');
    expect(() => makeState({ items: [{ itemId: 'item_glow_moss', equip: true }] })).toThrow('no equipment slot');
    const lens = { itemId: 'item_chronos_lens', equip: true };
    expect(() => makeState({ items: [lens, lens, lens] })).toThrow('both trinket slots are full');
    expect(() => makeState({ hp: Number.NaN })).toThrow('not a valid GameState:\n  player.hp:');
  });

  test('equipping a weapon over the starter one moves the old one to the inventory', () => {
    const s = makeState({ items: [{ itemId: 'item_apprentice_staff', equip: true }] });
    expect(s.player.equipment.weapon?.itemId).toBe('item_apprentice_staff');
    expect(s.player.inventory.map((i) => i.itemId)).toContain('item_rusty_dagger');
  });

  test('freshProfile: a new profile with overrides; a given profile’s loop is kept', () => {
    expect(freshProfile()).toMatchObject({ loopCounter: 1, echoes: [], profileId: 'fixture' });
    expect(freshProfile({ echoes: ['echo_tyrant_speaks'], loopCounter: 3 })).toMatchObject({ echoes: ['echo_tyrant_speaks'], loopCounter: 3 });
    expect(makeState({}, { profile: freshProfile({ loopCounter: 4 }) }).meta.loop).toBe(4);
  });
});

describe('play', () => {
  /** Stand-in reducers until U20 lands: `wait` passes a watch; `examine` writes the profile (map knowledge). */
  const handlers: HandlerTable = {
    ...HANDLERS,
    wait: (ctx) => {
      ctx.s.clock.ticks += 1;
      ctx.log('You wait.');
    },
    examine: (ctx) => {
      ctx.profileDraft().mapKnowledge.push(ctx.s.world.currentLocationId);
    },
  };
  const standIn = createStep(handlers);
  const wait: Action = { type: 'wait' };

  test('runs the script in order, threading state and profile, collecting every event', () => {
    const start = makeState();
    const out = play(start, [wait, { type: 'examine', target: { kind: 'location' } }, wait], { step: standIn });
    expect(out.state.clock.ticks).toBe(2);
    expect(out.state.meta.stepCount).toBe(3);
    expect(out.profile.mapKnowledge).toEqual(['loc_whispering_ruins']);
    expect(out.events.map((e) => e.t)).toEqual(['log', 'log']);
    expect(start.clock.ticks).toBe(0);
  });

  test('expected rejections pass (optionally matching the reason); the real step rejects unbuilt reducers', () => {
    const out = play(makeState(), [{ reject: { type: 'move', to: 'loc_shattered_library' }, reason: /not implemented yet \(U20\)/ }]);
    expect(out.events).toHaveLength(1);
    expect(out.events[0]).toMatchObject({ t: 'actionRejected' });
    expect(play(makeState(), [{ reject: { type: 'attack', targetUid: 'c1' }, reason: 'explore mode' }]).state.meta.stepCount).toBe(0);
  });

  test('an unexpected outcome throws, naming the script entry', () => {
    expect(() => play(makeState(), [wait])).toThrow('play: #0 {"type":"wait"} was rejected: \'wait\' is not implemented yet (U20)');
    expect(() => play(makeState(), [wait, { reject: wait }], { step: standIn })).toThrow('play: #1 {"type":"wait"} was accepted; the script expected a rejection');
    expect(() => play(makeState(), [{ reject: wait, reason: 'too tired' }])).toThrow('expected too tired');
  });
});

describe('soft assertions (PLAN §8.2)', () => {
  test('a failing block is recorded, not thrown; the summary lists it on one line', () => {
    const before = softFailures().length;
    expect(soft('passes', () => expect(1).toBe(1))).toBe(true);
    expect(soft('fails', () => expect(1).toBe(2))).toBe(false);
    expect(softFailures().slice(before).map((f) => f.name)).toEqual(['fails']);
    expect(softSummary(softFailures().slice(before))).toMatch(/^1 soft assertion\(s\) failed .*\n {2}1\. fails: expect\(received\)\.toBe\(expected\) · Expected: 2 · Received: 1$/);
    resetSoft(before);
    expect(softFailures()).toHaveLength(before);
    expect(softSummary([])).toBeNull();
  });

  test('RELEASE_GATE=1 makes a soft failure fail', () => {
    const saved = process.env.RELEASE_GATE;
    process.env.RELEASE_GATE = '1';
    try {
      expect(releaseGate()).toBe(true);
      expect(() => soft('gate', () => expect(1).toBe(2))).toThrow();
    } finally {
      if (saved === undefined) delete process.env.RELEASE_GATE;
      else process.env.RELEASE_GATE = saved;
    }
    expect(releaseGate()).toBe(saved === '1');
  });
});
