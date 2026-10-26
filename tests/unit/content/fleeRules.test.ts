// U81c (D-143, DESIGN §4.7): fleeing never loses a quest's items. The audit of the real pack: every quest objective with an
// `item` condition whose item drops (any chance) from a creature placed in a location's (fixed) encounter. A group whose drop
// of such an item is certain must be `hold` (never `scatter`), except on a node every road to the Apex runs through (WORLD
// §10.5's Apex road keeps `scatter`, so the finale is reachable without a fight). Then `q_void_shards` is played on the
// engine: the Hollow's Stalkers fled, met again wounded, beaten; three shards; Nyx paid.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { APEX_LOCATION_ID, grantFleeAuto, legalActions, playerOf, type Action, type ContentPack, type GameState } from '@engine/index';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';

const pack: ContentPack = buildContentPack();
const START = pack.config.startLocationId;

/** Item ids named by an `item` condition anywhere in a quest objective's `when`, with the objectives naming them. */
function objectiveItems(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const walk = (x: unknown, at: string): void => {
    if (Array.isArray(x)) return x.forEach((y) => walk(y, at));
    if (typeof x !== 'object' || x === null) return;
    const item = (x as { item?: { id?: unknown } }).item;
    if (typeof item?.id === 'string') out.set(item.id, [...new Set([...(out.get(item.id) ?? []), at])]);
    Object.values(x).forEach((y) => walk(y, at));
  };
  for (const q of Object.values(pack.quests)) for (const st of q.stages) for (const ob of st.objectives) walk(ob.when, `${q.id}/${ob.id}`);
  return out;
}

/** Nodes every road from the start to the Apex runs through (exits read open: the widest graph). */
function apexRoad(): Set<string> {
  const reaches = (blocked: string): boolean => {
    const seen = new Set([START]);
    const queue = [START];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (id === APEX_LOCATION_ID) return true;
      if (id === blocked) continue;
      for (const e of pack.locations[id]?.exits ?? []) if (!seen.has(e.to)) (seen.add(e.to), queue.push(e.to));
    }
    return false;
  };
  return new Set(Object.keys(pack.locations).filter((id) => id !== START && id !== APEX_LOCATION_ID && !reaches(id)));
}

interface QuestDrop {
  location: string;
  encounter: string;
  onFlee: string;
  fleeable: boolean;
  /** The highest chance among its quest-item drops. */
  chance: number;
  items: string[];
}

/** The audit: every location encounter with a creature that can drop an item a quest objective needs. */
function questDrops(): QuestDrop[] {
  const needed = objectiveItems();
  const out: QuestDrop[] = [];
  for (const loc of Object.values(pack.locations)) {
    for (const enc of loc.encounters) {
      const loot = enc.groups.flatMap((g) => (pack.creatures[g.creatureId]?.loot ?? []).filter((l) => needed.has(l.itemId)));
      if (loot.length === 0) continue;
      out.push({
        location: loc.id,
        encounter: enc.id,
        onFlee: enc.onFlee,
        fleeable: enc.fleeable,
        chance: Math.max(...loot.map((l) => l.chance)),
        items: [...new Set(loot.map((l) => l.itemId))].sort(),
      });
    }
  }
  return out;
}

describe('the quest-drop audit (D-143, DESIGN §4.7)', () => {
  const drops = questDrops();
  const road = apexRoad();
  const certain = drops.filter((d) => d.chance >= 1 && d.fleeable);

  test('the Apex road (past the start) is the Glowlands and the Nexus', () => {
    expect([...road].sort()).toEqual(['loc_chronos_nexus', 'loc_veridian_glowlands']);
  });

  test('no fleeable group with a certain quest drop scatters, off the Apex road: it holds (fleeing costs time, never the quest)', () => {
    const scattering = certain.filter((d) => !road.has(d.location) && d.onFlee === 'scatter').map((d) => d.encounter);
    expect(scattering).toEqual([]);
  });

  test('the held quest-drop groups, by name: the Stalkers (Void Shard) and the Drowned Archivists (the scroll)', () => {
    const held = certain.filter((d) => d.onFlee === 'hold').map((d) => `${d.encounter} ${d.items.join(',')}`);
    expect(held.sort()).toEqual([
      'enc_bellmouth_ringer item_scholars_lost_scroll',
      'enc_chasm_stalker item_void_shard',
      'enc_hollow_group_b item_void_shard',
      'enc_hollow_group_b_sentry item_void_shard',
      'enc_hollow_stalker item_void_shard',
      'enc_hollow_stalkers_a item_void_shard',
      'enc_scriptorium_archivists item_scholars_lost_scroll',
      'enc_scriptorium_choir item_scholars_lost_scroll',
      'enc_shelf_stalkers item_void_shard',
      'enc_tidewell_clerk_archivist item_scholars_lost_scroll',
    ]);
  });

  test('the exemptions: the Apex road keeps the Aberration `scatter`; chance drops (other sources) keep `scatter`', () => {
    expect(certain.filter((d) => road.has(d.location)).map((d) => `${d.encounter} ${d.onFlee}`)).toEqual(['enc_nexus_aberration scatter']);
    const chancy = drops.filter((d) => d.chance < 1);
    expect(chancy.length).toBeGreaterThan(0);
    expect(new Set(chancy.flatMap((d) => d.items))).toEqual(new Set(['item_antidote_root', 'item_glow_moss', 'item_void_shard', 'mat_steppe_salt']));
    // Steppe Salt is gathered at the Grey Salt Pan; Glow Moss and the Antidote Root drop in several places
    expect(pack.locations.loc_grey_salt_pan?.gather?.map((g) => g.itemId)).toContain('mat_steppe_salt');
  });

  test("the Hollow's other shard sources stand: the loose shard in the crystal, the return Stalker, the Veil's drops", () => {
    const hollow = pack.locations.loc_voidscar_hollow;
    expect(hollow?.items.map((i) => i.itemId)).toContain('item_void_shard');
    expect(hollow?.encounters.find((e) => e.id === 'enc_hollow_stalker')).toMatchObject({ respawn: 'on_return', onFlee: 'hold' });
    expect(pack.regions.region_voidscar?.wanderingPool.map((e) => e.creatureId)).toEqual(['cr_void_touched_stalker']);
    const veil = drops.filter((d) => pack.locations[d.location]?.regionId === 'region_veil' && d.items.includes('item_void_shard'));
    expect(veil.length).toBeGreaterThan(3);
  });
});

describe('q_void_shards with a flight (D-143): flee the Stalkers, come back, win, three shards, Nyx', () => {
  const HOLLOW = 'loc_voidscar_hollow';
  const CHASM = 'loc_chasm_of_whispers';
  const STALKER = 'cr_void_touched_stalker';
  const profile = freshProfile();
  const run = (s: GameState, actions: Action[]) => play(s, actions, { content: pack, profile }).state;
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

  test('the flight falls back to the lip with the pair wounded; back in, they stand as they were; beaten, they pay two shards', () => {
    const s0 = makeState({ level: 9, locationId: CHASM, quests: { q_void_shards: 'gather' } }, { content: pack, profile });
    const met = run(s0, [{ type: 'move', to: HOLLOW }]);
    expect(met.mode).toBe('combat');
    expect(met.combat).toMatchObject({ encounterId: 'enc_hollow_stalkers_a', onFlee: 'hold', canFlee: true });
    // wound them, then run (a Smoke Bomb's sure flight, so the test draws nothing)
    const wounded = structuredClone(met);
    const pair = wounded.combat!.enemies;
    pair[0]!.hp = 20;
    pair[1]!.hp = 33;
    grantFleeAuto(playerOf(wounded.combat!));
    const fled = run(wounded, [{ type: 'flee' }]);
    expect(fled.mode).toBe('explore');
    expect(fled.world.currentLocationId).toBe(CHASM);
    expect(fled.world.locationStates[HOLLOW]).toMatchObject({ scattered: [], encounterHp: { enc_hollow_stalkers_a: { [STALKER]: 20, [`${STALKER}#2`]: 33 } } });
    expect(shards(fled)).toBe(0);
    expect(fled.quests.q_void_shards?.stage).toBe('gather');
    // the journal still points east, and the Stalkers are still there
    const back = run(fled, [{ type: 'move', to: HOLLOW }]);
    expect(back.combat?.encounterId).toBe('enc_hollow_stalkers_a');
    expect(back.combat?.enemies.map((e) => e.hp)).toEqual([20, 33]);
    const won = win(back);
    expect(won.mode).toBe('explore');
    expect(won.world.locationStates[HOLLOW]?.encountersCleared).toContain('enc_hollow_stalkers_a');
    expect(won.world.locationStates[HOLLOW]?.encounterHp).toEqual({});
    expect(shards(won)).toBe(2);
    // the loose shard in the crystal makes three; the quest turns to Nyx, and she is paid
    const three = run(won, [{ type: 'takeAll' }]);
    expect(shards(three)).toBe(3);
    expect(three.quests.q_void_shards?.stage).toBe('return');
    let s = run(three, [{ type: 'move', to: CHASM }]);
    s = win(s); // the second group (B) waits for the next arrival at the Hollow, not here; the lip is safe
    s = run(s, [{ type: 'talk', npcId: 'npc_nyx' }]);
    for (let i = 0; i < 12 && s.mode === 'dialogue'; i++) {
      const legal = legalActions(s, pack, profile);
      s = run(s, [legal.find((a) => a.type === 'choose' && a.choiceId === 'yes') ?? legal.find((a) => a.type === 'continue') ?? (legal[0] as Action)]);
    }
    expect(s.quests.q_void_shards).toMatchObject({ status: 'completed', stage: 'given' });
    expect(shards(s)).toBe(0);
  });

  test('held, the pair waits only until dawn: a full rest at the lip and it stands again whole', () => {
    const s0 = makeState({ level: 9, locationId: CHASM, quests: { q_void_shards: 'gather' } }, { content: pack, profile });
    const met = structuredClone(run(s0, [{ type: 'move', to: HOLLOW }]));
    met.combat!.enemies[0]!.hp = 5;
    grantFleeAuto(playerOf(met.combat!));
    const fled = run(met, [{ type: 'flee' }]);
    const rested = run(fled, [{ type: 'rest', kind: 'full' }]);
    expect(rested.world.locationStates[HOLLOW]?.encounterHp).toEqual({});
    const again = run(rested, [{ type: 'move', to: HOLLOW }]);
    expect(again.combat?.encounterId).toBe('enc_hollow_stalkers_a');
    expect(again.combat?.enemies.every((e) => e.hp === e.hpMax)).toBe(true);
  });
});
