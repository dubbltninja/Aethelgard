// U81c (D-143, D-144, DESIGN §4.7): fleeing never loses a quest's items, and never blocks a road. The audit of the real pack:
// every quest objective with an `item` condition whose item drops (any chance) from a creature placed in a location's (fixed)
// encounter. Every such fleeable group must `regroup` (gone until the next dawn, then back whole with its drops): never
// `scatter` (the drops gone for the loop) nor `hold` (a wall until beaten). Then `q_void_shards` is played on the engine: the
// Hollow's Stalkers fled and gone that day, back whole after a night's sleep, beaten; three shards; Nyx paid.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { grantFleeAuto, legalActions, playerOf, type Action, type ContentPack, type GameState } from '@engine/index';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';

const pack: ContentPack = buildContentPack();

/** Item ids named by an `item` condition anywhere in a quest objective's `when`. */
function objectiveItems(): Set<string> {
  const out = new Set<string>();
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x !== 'object' || x === null) return;
    const item = (x as { item?: { id?: unknown } }).item;
    if (typeof item?.id === 'string') out.add(item.id);
    Object.values(x).forEach(walk);
  };
  for (const q of Object.values(pack.quests)) for (const st of q.stages) for (const ob of st.objectives) walk(ob.when);
  return out;
}

interface QuestDrop {
  encounter: string;
  onFlee: string;
  fleeable: boolean;
  items: string[];
}

/** The audit: every location encounter with a creature that can drop (any chance) an item a quest objective needs. */
function questDrops(): QuestDrop[] {
  const needed = objectiveItems();
  const out: QuestDrop[] = [];
  for (const loc of Object.values(pack.locations)) {
    for (const enc of loc.encounters) {
      const loot = enc.groups.flatMap((g) => (pack.creatures[g.creatureId]?.loot ?? []).filter((l) => needed.has(l.itemId)));
      if (loot.length === 0) continue;
      out.push({ encounter: enc.id, onFlee: enc.onFlee, fleeable: enc.fleeable, items: [...new Set(loot.map((l) => l.itemId))].sort() });
    }
  }
  return out;
}

describe('the quest-drop audit (D-143, D-144, DESIGN §4.7)', () => {
  const drops = questDrops();
  const fleeable = drops.filter((d) => d.fleeable);

  test('no fleeable quest-drop group scatters or holds: every one regroups at dawn', () => {
    expect(fleeable.filter((d) => d.onFlee !== 'regroup').map((d) => `${d.encounter} ${d.onFlee}`)).toEqual([]);
  });

  test('the 36 quest-drop groups by name (34 regroup; the unfleeable Archivist and the Umbra hold as bosses)', () => {
    expect(drops.filter((d) => !d.fleeable).map((d) => `${d.encounter} ${d.onFlee}`).sort()).toEqual(['enc_archives_archivist hold', 'enc_eye_umbra hold']);
    expect(fleeable.map((d) => `${d.encounter} ${d.items.join(',')}`).sort()).toEqual([
      'enc_bellmouth_ringer item_scholars_lost_scroll',
      'enc_cairns_harriers mat_steppe_salt',
      'enc_chasm_sentry item_void_shard',
      'enc_chasm_stalker item_void_shard',
      'enc_flats_harriers mat_steppe_salt',
      'enc_flats_jackals mat_steppe_salt',
      'enc_gallery_pool_sentry item_void_shard',
      'enc_glowlands_mireling item_glow_moss',
      'enc_glowlands_toad_spore item_antidote_root',
      'enc_gullet_mirelings item_glow_moss',
      'enc_hollow_group_b item_void_shard',
      'enc_hollow_group_b_sentry item_void_shard',
      'enc_hollow_pool_sentry item_void_shard',
      'enc_hollow_stalker item_void_shard',
      'enc_hollow_stalkers_a item_void_shard',
      'enc_mangrove_stalker_mireling item_glow_moss',
      'enc_mouth_sentries item_void_shard',
      'enc_nexus_aberration item_aberrant_eye',
      'enc_orchard_jackals mat_steppe_salt',
      'enc_orchard_null_mouth_return item_void_shard',
      'enc_orchard_null_mouths item_void_shard',
      'enc_pan_jackals mat_steppe_salt',
      'enc_pan_jackals_return mat_steppe_salt',
      'enc_plateau_harriers mat_steppe_salt',
      'enc_ridge_harriers mat_steppe_salt',
      'enc_scriptorium_archivists item_scholars_lost_scroll',
      'enc_scriptorium_choir item_scholars_lost_scroll',
      'enc_shallows_mirelings item_glow_moss',
      'enc_shallows_spore_drifts item_antidote_root',
      'enc_shelf_pool_sentry item_void_shard',
      'enc_shelf_stalkers item_void_shard',
      'enc_stair_null_mouth item_void_shard',
      'enc_stair_pool_sentry item_void_shard',
      'enc_tidewell_clerk_archivist item_scholars_lost_scroll',
    ]);
  });

  test('only quest-drop groups regroup (the mode is not spent elsewhere)', () => {
    const regrouping = Object.values(pack.locations).flatMap((l) => l.encounters.filter((e) => e.onFlee === 'regroup').map((e) => e.id));
    expect(regrouping.sort()).toEqual(fleeable.map((d) => d.encounter).sort());
  });

  test("the Hollow's other shard sources stand: the loose shard in the crystal, the return Stalker, the Veil's drops", () => {
    const hollow = pack.locations.loc_voidscar_hollow;
    expect(hollow?.items.map((i) => i.itemId)).toContain('item_void_shard');
    expect(hollow?.encounters.find((e) => e.id === 'enc_hollow_stalker')).toMatchObject({ respawn: 'on_return', onFlee: 'regroup' });
    expect(pack.regions.region_voidscar?.wanderingPool.map((e) => e.creatureId)).toEqual(['cr_void_touched_stalker']);
    const veil = Object.values(pack.locations).filter((l) => l.regionId === 'region_veil');
    const veilShardGroups = drops.filter((d) => d.items.includes('item_void_shard') && veil.some((l) => l.encounters.some((e) => e.id === d.encounter)));
    expect(veilShardGroups.length).toBeGreaterThan(3);
  });
});

describe('q_void_shards with a flight (D-144): flee the Stalkers, gone that day, back whole at dawn, beaten, three shards, Nyx', () => {
  const HOLLOW = 'loc_voidscar_hollow';
  const CHASM = 'loc_chasm_of_whispers';
  const profile = freshProfile();
  const run = (s: GameState, actions: Action[]) => play(s, actions, { content: pack, profile }).state;
  /** A sure flight (a Smoke Bomb's), so the test draws nothing for it. */
  const flee = (s: GameState): GameState => {
    const c = structuredClone(s);
    grantFleeAuto(playerOf(c.combat!));
    return run(c, [{ type: 'flee' }]);
  };
  /** Plays the fight on screen to its end: attacks only, the enemies left at 1 HP so it is short. */
  function win(s0: GameState): GameState {
    let s = s0;
    for (let i = 0; i < 40 && s.mode === 'combat'; i++) {
      s = structuredClone(s);
      for (const e of s.combat?.enemies ?? []) e.hp = Math.min(e.hp, 1);
      const attack = legalActions(s, pack, profile).find((a) => a.type === 'attack');
      s = run(s, [attack ?? { type: 'guard' }]);
    }
    return s;
  }
  const shards = (s: GameState): number => s.player.inventory.filter((i) => i.itemId === 'item_void_shard').reduce((n, i) => n + i.qty, 0);

  test('fled, the pair is gone that day (no scatter, no loot); slept to dawn, it is back whole; beaten, it pays two shards', () => {
    const s0 = makeState({ level: 9, locationId: CHASM, quests: { q_void_shards: 'gather' } }, { content: pack, profile });
    const met = run(s0, [{ type: 'move', to: HOLLOW }]);
    expect(met.combat).toMatchObject({ encounterId: 'enc_hollow_stalkers_a', onFlee: 'regroup', canFlee: true });
    const wounded = structuredClone(met);
    wounded.combat!.enemies[0]!.hp = 20;
    const fled = flee(wounded);
    expect(fled.mode).toBe('explore');
    expect(fled.world.currentLocationId).toBe(CHASM);
    expect(fled.clock.ticks - met.clock.ticks).toBe(3);
    expect(fled.world.locationStates[HOLLOW]).toMatchObject({ scattered: [], encounterHp: {} });
    expect(shards(fled)).toBe(0);
    expect(fled.quests.q_void_shards?.stage).toBe('gather');
    // that day: back in, the pair is away (group B, the third Stalker, meets the next arrival); fled too, the way is open
    const b = run(fled, [{ type: 'move', to: HOLLOW }]);
    expect(b.combat?.encounterId).toBe('enc_hollow_group_b');
    const open = run(flee(b), [{ type: 'move', to: HOLLOW }]);
    expect([open.mode, open.world.currentLocationId]).toEqual(['explore', HOLLOW]);
    // a night's sleep at the lip: at dawn the pair is back, whole, its shards with it
    const rested = run(open, [{ type: 'move', to: CHASM }, { type: 'rest', kind: 'full' }]);
    const back = run(rested, [{ type: 'move', to: HOLLOW }]);
    expect(back.combat?.encounterId).toBe('enc_hollow_stalkers_a');
    expect(back.combat?.enemies.every((e) => e.hp === e.hpMax)).toBe(true);
    const won = win(back);
    expect(won.mode).toBe('explore');
    expect(won.world.locationStates[HOLLOW]?.encountersCleared).toContain('enc_hollow_stalkers_a');
    expect(shards(won)).toBe(2);
    // the loose shard in the crystal makes three; the quest turns to Nyx, and she is paid
    const three = run(won, [{ type: 'takeAll' }]);
    expect(shards(three)).toBe(3);
    expect(three.quests.q_void_shards?.stage).toBe('return');
    let s = run(three, [{ type: 'move', to: CHASM }, { type: 'talk', npcId: 'npc_nyx' }]);
    for (let i = 0; i < 12 && s.mode === 'dialogue'; i++) {
      const legal = legalActions(s, pack, profile);
      s = run(s, [legal.find((a) => a.type === 'choose' && a.choiceId === 'yes') ?? legal.find((a) => a.type === 'continue') ?? (legal[0] as Action)]);
    }
    expect(s.quests.q_void_shards).toMatchObject({ status: 'completed', stage: 'given' });
    expect(shards(s)).toBe(0);
  });
});
