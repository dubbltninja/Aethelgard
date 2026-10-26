// U81a (D-110): bots stop guarding forever. The real-pack sims stalled past round 60 (the soft-lock detector's combat stall)
// with a bot guarding turn after turn: a caster ranger against the Stair lampreys, an explorer Warden at the Barrows, and, on
// later seeds, the Tidewell clerk and archivist, the Spires' Aetherial Weaver and the Lantern Matron (a summoner whose adds the
// bot kept killing while she healed). Each fight is started here on the real pack and played by the bots to its end.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import {
  beginCombat,
  encounterSpec,
  findEncounter,
  legalActions,
  makeCtx,
  playerOf,
  runCombat,
  step,
  type Action,
  type GameState,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { BOTS } from '@sim/bots/index';
import { GUARD_STREAK_MAX, PRESS_ROUND, guardStreak, pressOn } from '@sim/bots/shared';
import type { Bot, BotMemory } from '@sim/bots/types';
import { runLoop } from '@sim/runner';
import { loadScenario } from '@sim/scenarios';
import { COMBAT_ROUND_LIMIT } from '@sim/softlock';

const pack = buildContentPack();

/** The fights that stalled, with a level in (or near) their band. */
const FIGHTS: readonly { enc: string; level: number }[] = [
  { enc: 'enc_stair_lampreys', level: 6 },
  { enc: 'enc_barrows_light_night', level: 9 },
  { enc: 'enc_tidewell_clerk_archivist', level: 7 },
  { enc: 'enc_spires_weaver', level: 8 },
  { enc: 'enc_hall_matron', level: 12 },
];
const CASES: readonly { bot: string; classId: string }[] = [
  { bot: 'caster', classId: 'ranger' },
  { bot: 'caster', classId: 'ironclad_warden' },
  { bot: 'explorer', classId: 'ironclad_warden' },
  { bot: 'explorer', classId: 'elf' },
  { bot: 'melee', classId: 'ranger' },
];

const starts = new Map<string, { state: GameState; profile: Profile }>();
/** A built character of this class and level at the Respite, then put into the encounter where it is placed. */
function fightStart(classId: string, level: number, encId: string): { state: GameState; profile: Profile } {
  const key = `${classId}:${level}`;
  let base = starts.get(key);
  if (base === undefined) {
    base = loadScenario('loop1_respite', pack, { classId, level, seed: 'guard-stall' });
    starts.set(key, base);
  }
  const found = findEncounter(pack, encId, base.state.world.currentLocationId);
  if (found === undefined) throw new Error(`no encounter ${encId}`);
  const s = clone(base.state);
  s.world.currentLocationId = found.locationId ?? s.world.currentLocationId;
  const ctx = makeCtx(s, clone(base.profile), pack);
  beginCombat(ctx, encounterSpec(found.enc));
  runCombat(ctx);
  const { profile } = ctx.commit();
  return { state: ctx.s, profile };
}

/** Plays the fight with the bot to its end (or 200 choices); the longest run of Guards and the last round. */
function playOut(botName: string, start: { state: GameState; profile: Profile }): { rounds: number; maxStreak: number; mode: string; phase: string | undefined } {
  const bot = (BOTS[botName] as () => Bot)();
  const memory: BotMemory = bot.init?.('guard-stall') ?? {};
  let s = start.state;
  let p = start.profile;
  let streak = 0;
  let maxStreak = 0;
  for (let i = 0; i < 200 && s.mode === 'combat' && s.combat !== null && s.combat.phase !== 'defeat'; i++) {
    const legal = legalActions(s, pack, p);
    const a = bot.choose(s, legal, pack, memory, { profile: p, rngSeed: 'guard-stall', step: i, recentEvents: [] });
    streak = a.type === 'guard' ? streak + 1 : 0;
    maxStreak = Math.max(maxStreak, streak);
    const r = step(s, a, pack, p);
    s = r.state;
    p = r.profile;
  }
  return { rounds: s.combat?.round ?? 0, maxStreak, mode: s.mode, phase: s.combat?.phase };
}

describe('U81a (D-110): no bot guards a fight forever', () => {
  for (const { enc, level } of FIGHTS) {
    for (const { bot, classId } of CASES) {
      test(`${bot} ${classId} L${level} at ${enc}: the fight ends by round ${COMBAT_ROUND_LIMIT}, never more than ${GUARD_STREAK_MAX} Guards in a row`, () => {
        const out = playOut(bot, fightStart(classId, level, enc));
        expect(out.maxStreak).toBeLessThanOrEqual(GUARD_STREAK_MAX);
        expect(out.rounds).toBeLessThanOrEqual(COMBAT_ROUND_LIMIT);
        // over: won or fled (explore), or fallen (the defeat screen)
        expect(out.mode !== 'combat' || out.phase === 'defeat').toBe(true);
      });
    }
  }
});

describe('pressOn', () => {
  const start = (): { state: GameState; profile: Profile } => fightStart('ranger', 9, 'enc_barrows_light_night');
  const guard: Action = { type: 'guard' };

  test('a third Guard in a row becomes the strike worth the most; the streak restarts after it', () => {
    const { state, profile } = start();
    const legal = legalActions(state, pack, profile);
    const memory: BotMemory = {};
    let s = state;
    expect(pressOn(memory, s, legal, pack, guard)).toEqual(guard);
    s = { ...s, combat: { ...s.combat!, round: s.combat!.round + 1 } };
    expect(pressOn(memory, s, legal, pack, guard)).toEqual(guard);
    expect(guardStreak(memory, { ...s, combat: { ...s.combat!, round: s.combat!.round + 1 } })).toBe(2);
    s = { ...s, combat: { ...s.combat!, round: s.combat!.round + 1 } };
    const forced = pressOn(memory, s, legal, pack, guard);
    expect(['attack', 'ability']).toContain(forced.type);
    s = { ...s, combat: { ...s.combat!, round: s.combat!.round + 1 } };
    expect(guardStreak(memory, s)).toBe(0);
    expect(pressOn(memory, s, legal, pack, guard)).toEqual(guard);
  });

  test('a choice repeated in the same round does not count twice; a new fight starts a new streak', () => {
    const { state, profile } = start();
    const legal = legalActions(state, pack, profile);
    const memory: BotMemory = {};
    pressOn(memory, state, legal, pack, guard);
    pressOn(memory, state, legal, pack, guard);
    expect(guardStreak(memory, state)).toBe(1);
    const other = { ...state, combat: { ...state.combat!, encounterId: 'enc_other' } };
    expect(guardStreak(memory, other)).toBe(0);
  });

  test('any other action passes through untouched, and the player keeps its own hit points', () => {
    const { state, profile } = start();
    const legal = legalActions(state, pack, profile);
    const attack = legal.find((a) => a.type === 'attack') as Action;
    expect(pressOn({}, state, legal, pack, attack)).toEqual(attack);
    expect(playerOf(state.combat!).hp).toBeGreaterThan(0);
  });
});

describe('from PRESS_ROUND a fight is pressed to its end (the mend loops of the scenario sims)', () => {
  // the batch's scenario runs that stalled with a self-heal every other turn: the Hourglass Crawlers' Rewind, the Contained
  // Tyrant's Unravelling, the Orrery Knight
  const STALLED: readonly { bot: string; classId: string; seed: string; scenario: 'pre_tyrant_l11_ranger' | 'pre_tyrant_l13_ranger'; companionId?: string }[] = [
    { bot: 'melee', classId: 'elf', seed: 'bal:2', scenario: 'pre_tyrant_l11_ranger' },
    { bot: 'caster', classId: 'elf', seed: 'bal:0', scenario: 'pre_tyrant_l11_ranger' },
    { bot: 'caster', classId: 'elf', seed: 'bal:2', scenario: 'pre_tyrant_l11_ranger' },
    { bot: 'caster', classId: 'ironclad_warden', seed: 'bal:0', scenario: 'pre_tyrant_l11_ranger', companionId: 'brak' },
    { bot: 'melee', classId: 'elf', seed: 'bal:2', scenario: 'pre_tyrant_l13_ranger' },
  ];
  for (const c of STALLED) {
    test(`${c.bot} ${c.classId} ${c.seed} ${c.scenario}${c.companionId === undefined ? '' : ` with ${c.companionId}`}: no soft-lock`, () => {
      const bot = (BOTS[c.bot] as () => Bot)();
      const r = runLoop(
        { seed: c.seed, classId: c.classId, bot, maxSteps: 2500, maxLoops: 1, stopAt: 'loop_end', scenario: c.scenario, onFallen: 'stop', ...(c.companionId === undefined ? {} : { companionId: c.companionId }) },
        pack,
      );
      expect(r.softLock.detected).toBe(false);
      expect(r.errors).toEqual([]);
    });
  }

  test('past PRESS_ROUND a Guard (a mend, a draught) becomes a flight when the fight can be fled, else the best strike; a strike passes', () => {
    const { state, profile } = fightStart('ranger', 9, 'enc_barrows_light_night');
    const guard: Action = { type: 'guard' };
    const late: GameState = { ...state, combat: { ...state.combat!, round: PRESS_ROUND, canFlee: true } };
    const legal = legalActions(late, pack, profile);
    expect(pressOn({}, late, legal, pack, guard).type).toBe(legal.some((a) => a.type === 'flee') ? 'flee' : 'attack');
    const held: GameState = { ...late, combat: { ...late.combat!, canFlee: false } };
    expect(['attack', 'ability']).toContain(pressOn({}, held, legal.filter((a) => a.type !== 'flee'), pack, guard).type);
    const attack = legal.find((a) => a.type === 'attack') as Action;
    expect(pressOn({}, late, legal, pack, attack)).toEqual(attack);
    const early: GameState = { ...state, combat: { ...state.combat!, round: PRESS_ROUND - 1 } };
    expect(pressOn({}, early, legalActions(early, pack, profile), pack, guard)).toEqual(guard);
  });
});
