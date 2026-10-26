// U62b: D-127's loose Echoes, played on the real pack (STORY §12 for what grants each and what each unlocks). The five that
// nothing granted — the Breach-door at the Nexus, Hadrek's key in the Ninefold Hall, the Emberforge's vein, Ferrin's
// trail-signs, the Chasm bridge — and the reads that are more than a line: Borin's Three Beats anchor, the pin set without
// Caelum, the Amulet's Listen in the Library once the Crystal was seeded, the two communion answers, the Horde's forecast on
// the map. The scenes' words (src/content/shared/dialogues/echoes.ts) are pinned here.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { dialogues as ECHO_SCENES } from '@content/shared/dialogues/echoes';
import { legalActions, type Action, type GameEvent, type GameState, type Profile } from '@engine/index';
import { freshProfile, makeState, play, type PlayEntry } from '@tests/fixtures/helpers';
import { buildMap, hordePathReach } from '@ui/panels/mapModel';

const pack = buildContentPack();

type LocState = GameState['world']['locationStates'][string];
/** A location already stood in, its first-visit fights behind it. */
const been = (cleared: string[] = []): LocState => ({
  visited: true,
  visitCount: 1,
  items: [],
  itemsSpawned: true,
  encountersCleared: cleared,
  encounterClearedDay: {},
  eventsFired: [],
  flags: {},
  unlockedExits: [],
  lockedExits: [],
  scattered: [],
  encounterHp: {},
});

interface At {
  loop?: number;
  echoes?: string[];
  items?: string[];
  quests?: Record<string, string>;
  reputation?: Partial<GameState['reputation']>;
  /** Locations stood in this loop, with the encounters behind you there. */
  cleared?: Record<string, string[]>;
  patch?: (s: GameState) => void;
}
const profileOf = (o: At): Profile => freshProfile({ loopCounter: o.loop ?? 2, echoes: o.echoes ?? [] });
function at(locationId: string, o: At = {}): GameState {
  return makeState(
    {
      locationId,
      loop: o.loop ?? 2,
      level: 15,
      seed: 'u62b',
      items: o.items ?? [],
      echoes: o.echoes ?? [],
      quests: o.quests ?? {},
      ...(o.reputation === undefined ? {} : { reputation: o.reputation }),
      patch: (s) => {
        for (const [id, cleared] of Object.entries(o.cleared ?? {})) s.world.locationStates[id] = been(cleared);
        o.patch?.(s);
      },
    },
    { content: pack, profile: profileOf(o) },
  );
}
const run = (s: GameState, actions: PlayEntry[], o: At = {}) => play(s, actions, { content: pack, profile: profileOf(o) });
const gained = (events: readonly GameEvent[]): string[] => events.flatMap((e) => (e.t === 'echoGained' ? [e.echoId] : []));
const move = (to: string): Action => ({ type: 'move', to });
const interact = (eventId: string): Action => ({ type: 'interact', eventId });
const go: Action = { type: 'continue' };
const count = (s: GameState, itemId: string): number => s.player.inventory.filter((i) => i.itemId === itemId).reduce((n, i) => n + i.qty, 0);

describe('the five grants (STORY §12 "How earned")', () => {
  test('`echo_breach_door`: the Nexus with the Lens and verse 1, from Loop 2; then the door opens without the glass', () => {
    const o: At = { items: ['item_chronos_lens'], echoes: ['echo_litany_verse_1'], cleared: { loc_chronos_nexus: ['enc_nexus_aberration'] } };
    const out = run(at('loc_veridian_glowlands', o), [move('loc_chronos_nexus')], o);
    expect(gained(out.events)).toContain('echo_breach_door');
    // a later loop, no Lens, no verse: the Echo is the route
    const later: At = { loop: 3, echoes: ['echo_breach_door'] };
    const s = at('loc_chronos_nexus', later);
    expect(legalActions(s, pack, profileOf(later))).toContainEqual(move('loc_silver_gate'));
    const without = at('loc_chronos_nexus', { loop: 3 });
    expect(legalActions(without, pack, profileOf({ loop: 3 }))).not.toContainEqual(move('loc_silver_gate'));
    // Loop 1 never: neither the grant nor the door
    const one: At = { loop: 1, items: ['item_chronos_lens'], echoes: ['echo_litany_verse_1'], cleared: o.cleared };
    expect(gained(run(at('loc_veridian_glowlands', one), [move('loc_chronos_nexus')], one).events)).not.toContain('echo_breach_door');
  });

  test('`echo_hadrek_clockwright`: Hadrek in the Ninefold Hall on First Bell; his key sits in the chair in the loops after', () => {
    const before = (day: 1 | 2 | 3) => (s: GameState): void => {
      s.before = { day, resets: 0 };
      s.clock.frozen = true;
      s.flags[`flag_before_day_${day}`] = true;
      s.flags.flag_entered_before_via_nexus = true;
    };
    const s = at('loc_ninefold_hall', { patch: before(1), cleared: { loc_ninefold_hall: [] } });
    expect(legalActions(s, pack, profileOf({}))).toContainEqual(interact('ev_hall_hadrek'));
    expect(gained(run(s, [interact('ev_hall_hadrek')]).events)).toEqual(['echo_hadrek_clockwright']);
    // Second Bell: he is not there
    expect(legalActions(at('loc_ninefold_hall', { patch: before(2), cleared: { loc_ninefold_hall: ['enc_hall_knight'] } }), pack, profileOf({}))).not.toContainEqual(interact('ev_hall_hadrek'));
    // the key (WORLD §3.11 "100% if `echo_hadrek_clockwright`") is the Hall's First Bell item from then on
    expect(pack.locations.loc_ninefold_hall?.items.find((i) => i.itemId === 'item_orrery_key')?.when).toEqual({ all: [{ beforeDay: 1 }, { echo: 'echo_hadrek_clockwright' }] });
  });

  test('`echo_emberforge_vein`: the Emberforge’s third visit in one loop; the vein gives 3 ore a loop, 8 with the Echo', () => {
    // three arrivals from the Outpost (stood back there each time without its roll: the Forge's count is what is measured)
    let s = at('loc_blighted_outpost', { loop: 1 });
    const visits: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const there = run(s, [move('loc_emberforge')], { loop: 1 });
      visits.push(gained(there.events));
      s = structuredClone(there.state);
      s.world.currentLocationId = 'loc_blighted_outpost';
    }
    expect(visits).toEqual([[], [], ['echo_emberforge_vein']]);
    expect(s.counters.custom.emberforge_visits).toBe(3);
    // the vein, once a loop: 3 without the Echo, 8 with it
    const plain = at('loc_emberforge');
    const worked = run(plain, [interact('ev_forge_vein')]);
    expect(count(worked.state, 'mat_ember_ore') - count(plain, 'mat_ember_ore')).toBe(3);
    expect(legalActions(worked.state, pack, profileOf({}))).not.toContainEqual(interact('ev_forge_vein'));
    const known: At = { echoes: ['echo_emberforge_vein'] };
    const rich = at('loc_emberforge', known);
    expect(legalActions(rich, pack, profileOf(known))).not.toContainEqual(interact('ev_forge_vein'));
    expect(count(run(rich, [interact('ev_forge_vein_known')], known).state, 'mat_ember_ore') - count(rich, 'mat_ember_ore')).toBe(8);
  });

  test('`echo_nomad_signs`: Scout Ferrin at the Scorched Gate teaches them at Ironclad Neutral or better; Wary, he has nothing to say', () => {
    const s = at('loc_scorched_gate');
    const out = run(s, [{ type: 'talk', npcId: 'npc_scout_ferrin' }, go, go]);
    expect(out.events.some((e) => e.t === 'dialogueNode' && e.nodeId === 'signs')).toBe(true);
    expect(gained(out.events)).toEqual(['echo_nomad_signs']);
    // the Steppe's gates read it (WORLD §11.3): the Herd-Grave's road and the Scorched Gate from the Reach
    expect(JSON.stringify(pack.locations)).toContain('{"echo":"echo_nomad_signs"}');
    // Wary: he has nothing to teach (his barks are the map's), and nothing is granted
    const wary = at('loc_scorched_gate', { reputation: { ironclad: -20 } });
    const refused = run(wary, [{ reject: { type: 'talk', npcId: 'npc_scout_ferrin' } }], { reputation: { ironclad: -20 } });
    expect(gained(refused.events)).toEqual([]);
  });

  test('`echo_hollow_path`: crossing the Chasm bridge once; then the bridge opens without Nyx’s errand', () => {
    const o: At = { quests: { q_void_shards: 'gather' }, cleared: { loc_voidscar_hollow: ['enc_hollow_stalkers_a'] } };
    const s = at('loc_chasm_of_whispers', o);
    expect(gained(run(s, [move('loc_voidscar_hollow')], o).events)).toContain('echo_hollow_path');
    const later: At = { loop: 3, echoes: ['echo_hollow_path'] };
    expect(legalActions(at('loc_chasm_of_whispers', later), pack, profileOf(later))).toContainEqual(move('loc_voidscar_hollow'));
    expect(legalActions(at('loc_chasm_of_whispers', { loop: 3 }), pack, profileOf({ loop: 3 }))).not.toContainEqual(move('loc_voidscar_hollow'));
  });
});

describe('the reads (STORY §12 "Unlocks")', () => {
  const ANCHOR_BILL = ['item_aetherium_shard', 'item_aetherium_shard', 'item_aetherium_shard', 'item_void_shard', 'item_void_shard', 'item_void_shard', 'mat_silverwood_heartwood'];
  const anchorRun = (echoes: string[]): { s: GameState; o: At } => {
    const o: At = { echoes, quests: { q_the_mending: 'forge' }, patch: (s) => void s.player.inventory.push({ uid: 'ore', itemId: 'mat_ember_ore', qty: 3, rarity: 'common', affixes: [] }) };
    return { s: at('loc_emberforge', { ...o, items: ANCHOR_BILL }), o };
  };

  test('`echo_heartstone_triune`: Borin tempers the anchor with no piece of the Heartstone for hands that know the three beats', () => {
    const { s, o } = anchorRun(['echo_anchor_schema', 'echo_heartstone_triune']);
    const out = run(s, [{ type: 'craft', recipeId: 'recipe_breach_anchor_triune' }], o);
    expect(count(out.state, 'item_breach_anchor')).toBe(1);
    // without the three beats the shortcut is closed, and the anchor's own recipe still wants a fragment
    const plain = anchorRun(['echo_anchor_schema']);
    expect(legalActions(plain.s, pack, profileOf(plain.o))).not.toContainEqual({ type: 'craft', recipeId: 'recipe_breach_anchor_triune' });
    expect(legalActions(plain.s, pack, profileOf(plain.o))).not.toContainEqual({ type: 'craft', recipeId: 'recipe_breach_anchor' });
    // his line says so (dialogues/endings.ts `scene_borin_anchor`)
    const recipe = pack.dialogues.scene_borin_anchor?.nodes.find((n) => n.id === 'recipe');
    expect(recipe?.textVariants[0]?.when).toEqual({ echo: 'echo_heartstone_triune' });
  });

  test('`echo_caelum_stayed`: the pin set on the rim without him — the hour steadies by three days, and the forge is next', () => {
    const o: At = {
      echoes: ['echo_caelum_stayed'],
      quests: { q_the_mending: 'crossing' },
      patch: (s) => {
        s.before = { day: 3, resets: 0 };
        s.clock.frozen = true;
        s.flags.flag_before_day_3 = true;
        s.flags.flag_entered_before_via_nexus = true;
      },
      cleared: { loc_conflux_chamber: ['enc_conflux_warden', 'enc_conflux_pillars'] },
    };
    const s = at('loc_conflux_chamber', o);
    expect(legalActions(s, pack, profileOf(o))).toContainEqual(interact('ev_conflux_pin_alone'));
    expect(legalActions(s, pack, profileOf(o))).not.toContainEqual(interact('ev_conflux_pin'));
    const out = run(s, [interact('ev_conflux_pin_alone'), go, go, go], o);
    expect(out.events.filter((e) => e.t === 'dialogueNode').map((e) => (e as { nodeId: string }).nodeId)).toEqual(['whole', 'stayed', 'steadies']);
    expect(out.state.quests.q_the_mending?.stage).toBe('forge');
    expect(out.state.clock.limitTicks - s.clock.limitTicks).toBe(12);
    // without the Echo the pin waits for Caelum
    const plain = at('loc_conflux_chamber', { ...o, echoes: [] });
    expect(legalActions(plain, pack, profileOf({ ...o, echoes: [] }))).not.toContainEqual(interact('ev_conflux_pin_alone'));
  });

  test('`echo_crystal_seeded` and `echo_amulet_memory`: the Amulet’s Listen in the Library yields the nine voices, Crystal kept or not', () => {
    const o: At = { echoes: ['echo_amulet_memory', 'echo_crystal_seeded'], cleared: { loc_shattered_library: ['enc_library_corruption'] } };
    const s = at('loc_shattered_library', o);
    expect(legalActions(s, pack, profileOf(o))).toContainEqual(interact('ev_library_listen'));
    expect(gained(run(s, [interact('ev_library_listen')], o).events)).toEqual(['echo_nine_voices']);
    for (const echoes of [['echo_amulet_memory'], ['echo_crystal_seeded']]) {
      const without = { ...o, echoes };
      expect(legalActions(at('loc_shattered_library', without), pack, profileOf(without))).not.toContainEqual(interact('ev_library_listen'));
    }
    // the Crystal's own Listen is the Amulet's too
    expect(pack.dialogues.scene_echo_crystal?.nodes.find((n) => n.id === 'kept_stirs')?.choices.find((c) => c.id === 'listen')?.when).toEqual({ all: [{ loop: { min: 2 } }, { echo: 'echo_amulet_memory' }] });
  });

  test('`echo_ninth_verse_unfinished` and `echo_breach_recoil`: Movement I answers, +1 each (DESIGN §4.11), in U62’s words', () => {
    const why = pack.creatures.cr_chronos_tyrant_unveiled?.communion?.movements[0]?.questions.find((q) => q.id === 'tyr_q_why');
    expect(why?.answers.filter((a) => a.id === 'ninth_verse_unfinished' || a.id === 'breach_recoil').map((a) => [a.when, a.resolve, a.lie, a.text])).toEqual([
      [{ echo: 'echo_ninth_verse_unfinished' }, 1, false, 'The ninth verse was never finished. I am still saying it.'],
      [{ echo: 'echo_breach_recoil' }, 1, false, 'She was thrown forward because she named it. I was not thrown anywhere. I named nothing; I only held.'],
    ]);
  });

  test('`echo_horde_path`: during any Horde the map forecasts the next moves of its spread; without the Echo, nothing', () => {
    const horde = (s: GameState): void => {
      s.world.hordeActive = true;
      s.world.hordeCause = 'expiry';
      s.world.hordeDelay = 0;
      s.world.infected = ['loc_temporal_breach_apex'];
      s.world.hordePending = {};
      s.flags.flag_horde_active = true;
    };
    const seen = { echoes: ['echo_horde_path'], patch: horde };
    const s = at('loc_chronos_nexus', seen);
    const reach = hordePathReach(s, pack, profileOf(seen));
    expect(reach?.get('loc_chronos_nexus')).toBe(1);
    expect([...(reach?.values() ?? [])].every((n) => n >= 1 && n <= 3)).toBe(true);
    expect(buildMap(s, pack, profileOf(seen)).nodes.find((n) => n.id === 'loc_chronos_nexus')?.forecast).toBe(1);
    const blind = { patch: horde };
    expect(hordePathReach(at('loc_chronos_nexus', blind), pack, profileOf(blind))).toBeNull();
    expect(buildMap(at('loc_chronos_nexus', blind), pack, profileOf(blind)).nodes.every((n) => n.forecast === null)).toBe(true);
    // no Horde, no forecast (the Fall forecast before the limit is U70's)
    expect(hordePathReach(at('loc_chronos_nexus', { echoes: ['echo_horde_path'] }), pack, profileOf({ echoes: ['echo_horde_path'] }))).toBeNull();
  });
});

describe('the scenes’ words (dialogues/echoes.ts: every line `written`, pinned)', () => {
  const WRITTEN = [
    "You'll be back on this grass; everyone is. So learn it. A cut turf is water. Three stones is a camp that will feed you. A thorn tied in a knot means the herd-path is safe.",
    'Read them and the Steppe lets you in: this gate to any rider who knows them, and the bone road to the Herd-Grave. Two notes means friend. Learn that too.',
    "The Heartstone beats slow and even in Hallow's iron. The pin lies on the rim where you set it, and nobody is beside you to look at it.",
    'Up in the city a boy is carrying a message he has carried before. He stayed. The pin is here because he lent it, and that will have to do.',
    'Far ahead of you, at the other end of five hundred years, something that has been bracing leans a little of its weight on the pin, and the hour steadies by three days.',
  ];
  test('two scenes, every node tagged `written`, the lines the pinned ones (each ≤ 40 words)', () => {
    expect(ECHO_SCENES.map((d) => d.id)).toEqual(['scene_ferrin_trail_signs', 'scene_pin_alone']);
    const lines = ECHO_SCENES.flatMap((d) => d.nodes.map((n) => [n.tags, n.text]));
    expect(lines).toEqual(WRITTEN.map((t) => [['written'], t]));
    for (const t of WRITTEN) expect([t, t.split(/\s+/).length <= 40]).toEqual([t, true]);
    // the last line is the Mending's own (scene_anchor_in_the_conflux), the same hour with or without him
    expect(pack.dialogues.scene_anchor_in_the_conflux?.nodes.find((n) => n.id === 'steadies')?.text).toBe(WRITTEN[4]);
  });
});
