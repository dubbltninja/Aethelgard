// U34e item 7 — the cleanup list: the Outpost's plain Golems stilled by the word (D-105), the Depths' choice line once (D-105),
// a Hostile Hollis trading at Corruption 3 (D-101), Kaelen's list over his rule (D-101), Foresight never showing a hidden move
// (D-091 gap 8), pathBot's `talk` at the Threshold (D-091 gap 7), and the cadence re-check of the Ruins and Mistwood (D-092).
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import {
  REVEAL_KEY,
  arrivalEncounter,
  beginCombat,
  fireEvent,
  foreseenMove,
  generateIntent,
  legalActions,
  merchantRefusal,
  type CombatState,
  type EncounterSpec,
  type GameState,
  type StepCtx,
} from '@engine/index';
import { pathBot } from '@sim/bots/pathBot';
import { loadScenario } from '@sim/scenarios';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { thresholdPack } from '@tests/fixtures/thresholdContent';

const pack = buildContentPack();
const profile = freshProfile();
type Overrides = Parameters<typeof makeState>[0];
const at = (o: Overrides = {}): GameState => makeState({ level: 12, ...o }, { content: pack, profile });
const MANY = Array.from({ length: 80 }, () => 0.5);
const spec = (creatureId: string, count = 1): EncounterSpec => ({
  id: 'enc_u34e_cleanup', groups: [{ creatureId, count }], fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [],
});
function fight(s: GameState, creatureId: string): { ctx: StepCtx; combat: CombatState } {
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1), ...MANY], pack, profile);
  return { ctx, combat: beginCombat(ctx, spec(creatureId)) };
}
const visited = (encountersCleared: string[] = []) => ({
  visited: true, visitCount: 2, items: [], itemsSpawned: true, encountersCleared, encounterClearedDay: {}, eventsFired: [], flags: {},
  unlockedExits: [], lockedExits: [], scattered: [] as string[], encounterHp: {},
});

describe('the Outpost Golems and the warder’s word (D-105; DESIGN §13.3 #8)', () => {
  const arrival = (o: Overrides) => {
    const s = at({ locationId: 'loc_blighted_outpost', ...o, patch: (st) => void (st.world.locationStates.loc_blighted_outpost = visited()) });
    return arrivalEncounter(scriptedCtx(s, Array.from({ length: 10 }, () => D.no), pack, profile), { locationId: 'loc_blighted_outpost', via: 'move', firstVisit: false });
  };
  test('with the word neither pair fights — the gate (quest open) nor the plain scatter pair; without it they do', () => {
    expect(arrival({ quests: { q_blighted_outpost: { status: 'active' } } })?.id).toBe('enc_outpost_golems_gate');
    expect(arrival({})?.id).toBe('enc_outpost_golems');
    const word = { loop: 2, echoes: ['echo_stone_hide_origin'] };
    expect(arrival({ ...word, quests: { q_blighted_outpost: { status: 'active' } } })?.id ?? null).toBeNull();
    expect(arrival(word)?.id ?? null).toBeNull();
  });
});

describe('the Depths’ choice line, once (D-105)', () => {
  test('an event that opens a scene saying the same words logs nothing itself; any other event logs its line', () => {
    const depths = pack.locations.loc_heartstone_depths!;
    const choice = depths.events.find((e) => e.id === 'ev_depths_choice')!;
    const ctx = scriptedCtx(at({ locationId: 'loc_heartstone_depths', quests: { q_echoing_heartbeat: { status: 'active' } } }), [], pack, profile);
    fireEvent(ctx, depths.id, choice);
    expect(ctx.events.filter((e) => e.t === 'log' && e.text === choice.text)).toEqual([]);
    expect(ctx.events.some((e) => e.t === 'eventFired' && e.eventId === 'ev_depths_choice')).toBe(true);
    expect(ctx.s.dialogue?.sceneId).toBe('scene_heartstone_choice');
    const plain = depths.events.find((e) => e.id !== 'ev_depths_choice' && !e.effects.some((x) => 'startDialogue' in x))!;
    const ctx2 = scriptedCtx(at({ locationId: depths.id }), [], pack, profile);
    fireEvent(ctx2, depths.id, plain);
    expect(ctx2.events.filter((e) => e.t === 'log' && e.text === plain.text).length).toBe(1);
  });
});

describe('merchants (D-101)', () => {
  test('Hollis trades at Weavers Neutral or at Corruption 3 — a Hostile Wayfinder too — and refuses otherwise', () => {
    const hollis = pack.merchants.npc_hollis_cade!;
    const refused = (weavers: number, corruption: number) =>
      merchantRefusal(at({ reputation: { weavers }, corruption }), pack, profile, hollis) !== null;
    expect([refused(0, 0), refused(-20, 0), refused(-60, 0), refused(-60, 3), refused(-20, 3)]).toEqual([false, true, true, false, false]);
  });

  test('Kaelen’s pool is WORLD’s list (the rule would add two pieces whose Sources never name him)', () => {
    const pool = pack.merchants.npc_kaelen_stonehand?.rollStock?.pool ?? [];
    expect(pool).toHaveLength(14);
    for (const id of ['item_scrap_harness', 'item_divers_coat']) {
      expect(pool).not.toContain(id);
      expect(pack.items[id]?.sources).not.toContain('merchant:npc_kaelen_stonehand');
    }
  });
});

describe('Foresight and hidden intents (D-091 gap 8)', () => {
  test('the second chip is never a hidden move — unless Archive Light reveals every intent — nor an unlit creature’s', () => {
    const { ctx, combat } = fight(at(), 'cr_temporal_aberration');
    const ab = combat.enemies[0]!;
    ab.pattern.turnsTaken = 1; // the move after next falls on its third turn: the hidden Future Blow
    expect(foreseenMove(ctx, combat, ab)).toBeNull();
    combat.cooldowns[REVEAL_KEY] = 2;
    expect(foreseenMove(ctx, combat, ab)).toBe('aberration_future_blow');
    delete combat.cooldowns[REVEAL_KEY];
    ab.pattern.turnsTaken = 0; // turn 2: the Past Blow, which hides nothing
    expect(foreseenMove(ctx, combat, ab)).toBe('aberration_past_blow');
    const unlit = fight(at(), 'cr_anomaly_unlit_lantern');
    expect(foreseenMove(unlit.ctx, unlit.combat, unlit.combat.enemies[0]!)).toBeNull();
  });
});

describe('pathBot talks at the Threshold (D-091 gap 7)', () => {
  test('a `talk` step reaches whoever stands at the Threshold (Dask on the Still Shore, Loop 3)', () => {
    const tpack = thresholdPack();
    const { state, profile: p } = loadScenario('loop2_end', tpack);
    expect(state.mode).toBe('threshold');
    const legal = legalActions(state, tpack, p);
    const bot = pathBot([{ talk: 'npc_dask', pick: [] }]);
    const memory = bot.init?.('path') ?? {};
    const a = bot.choose(state, legal, tpack, memory, { profile: p, rngSeed: 'path', step: 0, recentEvents: [] });
    expect(legal).toContainEqual({ type: 'talk', npcId: 'npc_dask' });
    expect(a).toEqual({ type: 'talk', npcId: 'npc_dask' });
  });
});

describe('cadence re-check, the Ruins and Mistwood (D-092)', () => {
  test('the Rootling reads its Burrow condition on every turn; the Tide’s Undertow its Rise before each cycled move', () => {
    const rootling = pack.creatures.cr_rootling!;
    expect(rootling.pattern).toHaveLength(1);
    expect(rootling.pattern[0]).toMatchObject({ if: { all: [{ allyDown: true }, { not: { selfHas: 'status_shield' } }] } });
    const undertow = pack.creatures.cr_unraveling_tide!.phases[1]!;
    expect(undertow.pattern.map((s) => ('move' in s ? [s.move, s.when ?? null] : '?'))).toEqual([
      ['tide_rise', { everyNth: 3 }],
      ['tide_pull', null],
      ['tide_rise', { everyNth: 3 }],
      ['tide_wash', null],
    ]);
  });

  test('a Rootling whose pack-mate fell Burrows on an even turn too (the pointer walk waited for its next odd turn)', () => {
    const s = at();
    const ctx = scriptedCtx(s, [D.d4(4), D.d4(1), D.d4(1), ...MANY], pack, profile);
    const combat = beginCombat(ctx, spec('cr_rootling', 2));
    const [a, b] = combat.enemies;
    Object.assign(b!, { alive: false, hp: 0 });
    a!.pattern.turnsTaken = 1; // its second turn
    expect(generateIntent(ctx, combat, a!)?.moveId).toBe('rootling_burrow');
  });
});
