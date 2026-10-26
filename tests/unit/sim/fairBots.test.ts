// U81b1 (D-145): fair bots, so BALANCE.md measures the game, not the bots. One test (or a few) per policy change: the
// class-aware fight every fighting bot shares (a Wizard and a Weaver cast under every bot; the Weaver's Blood price when HP is
// comfortable; setups on their cooldowns, not every turn), the speedrunner (fights what it meets, takes every counted quest,
// the Apex at L9), danger (flee ≥ level + 4 and where it fell; a place with such a fight is left for later; the Horde's road
// around a boss), quest following (the giver of a stage with no hint, the hidden item searched, the objective's item bought),
// the pacifist's walled-in flight (D-144), the scenario kit, the communion scenario's lost walk, and the Escape metric.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { legalActions, playerAbilityCost, playerOf, step, type Action, type ContentPack, type GameState, type Profile } from '@engine/index';
import { casterBot } from '@sim/bots/caster';
import { CLASS_FIGHT, bloodComfortable, classFight, classStat, classUnlockRank, hitMult, paysBlood, targetHasNow } from '@sim/bots/classFight';
import { DANGER_MARGIN, dangerAt } from '@sim/bots/danger';
import { explorerBot } from '@sim/bots/explorer';
import { meleeBot } from '@sim/bots/melee';
import { PACIFIST, pacifistBot } from '@sim/bots/pacifist';
import { apexSettled, fellHere, notesOf, type Env } from '@sim/bots/policy';
import { npcWhere, questErrand, questTargets, wantedItems } from '@sim/bots/questFollow';
import { actionKey, bedStep, hordeRoute, pendingFights } from '@sim/bots/shared';
import { SPEEDRUNNER, speedrunnerBot } from '@sim/bots/speedrunner';
import type { Bot, BotContext, BotMemory } from '@sim/bots/types';
import { computeMetrics } from '@sim/metrics';
import { loadScenario, powerStat, typicalUnlockRank } from '@sim/scenarios';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { hordePack } from '@tests/fixtures/hordeContent';
import { batchRun, blankLoop, blankResult } from './helpers';

const ctxOf = (p: Profile): BotContext => ({ profile: p, rngSeed: 'test', step: 0, recentEvents: [] });
const edit = <T,>(s: T, fn: (d: T) => void): T => {
  const d = structuredClone(s);
  fn(d);
  return d;
};
function pick(bot: Bot, s: GameState, c: ContentPack, p: Profile, memory: BotMemory = {}): Action {
  const legal = legalActions(s, c, p);
  const a = bot.choose(s, legal, c, memory, ctxOf(p));
  expect(legal.map(actionKey)).toContain(actionKey(a));
  return a;
}
const combatOf = (s: GameState): NonNullable<GameState['combat']> => s.combat as NonNullable<GameState['combat']>;
/** The Contained Tyrant's fight, its first turn, for `classId` (the horde fixture pack). */
const tyrantFight = (classId: string, level = 13) => {
  const h = hordePack();
  const { state, profile } = loadScenario(level === 11 ? 'pre_tyrant_l11_ranger' : 'pre_tyrant_l13_ranger', h, { classId });
  return { h, profile, s: step(state, { type: 'choose', choiceId: 'face_it' }, h, profile).state };
};
const isCast = (h: ContentPack, a: Action): boolean => a.type === 'ability' && h.abilities[a.abilityId]?.ownerId !== undefined;

describe('every bot plays its class (classFight)', () => {
  const FIGHTERS: [string, () => Bot][] = [
    ['melee', meleeBot],
    ['explorer', explorerBot],
    ['speedrunner', speedrunnerBot],
    ['caster', casterBot],
  ];
  test.each(FIGHTERS)('%s: a Wizard and a Weaver cast at the Tyrant (U80: the non-caster bots cast in 0–5 % of their actions)', (_name, make) => {
    for (const classId of ['wizard', 'shadow_weaver']) {
      const { h, profile, s } = tyrantFight(classId);
      const a = pick(make(), s, h, profile);
      expect(isCast(h, a)).toBe(true);
    }
  });

  test('a basic attack that finishes the target spends no resource', () => {
    const { h, profile, s } = tyrantFight('ironclad_warden');
    const weak = edit(s, (d) => {
      const boss = combatOf(d).enemies.find((e) => e.alive) as NonNullable<GameState['combat']>['enemies'][number];
      boss.hp = 1;
    });
    const a = classFight(weak, legalActions(weak, h, profile), h, {}, { lean: 'weapon', healBelow: 0.3 });
    expect(a.type).toBe('attack');
  });

  test('a setup ability is not cast twice in a row, nor on a foe nearly dead', () => {
    const { h, profile, s } = tyrantFight('ranger');
    const memory: BotMemory = {};
    const first = classFight(s, legalActions(s, h, profile), h, memory, { lean: 'weapon', healBelow: 0.3 });
    const setup = (a: Action): boolean => a.type === 'ability' && h.abilities[a.abilityId]?.power === undefined;
    expect(setup(first)).toBe(true); // Venom Coat
    {
      const next = edit(s, (d) => (combatOf(d).round += 1));
      expect(setup(classFight(next, legalActions(next, h, profile), h, memory, { lean: 'weapon', healBelow: 0.3 }))).toBe(false);
    }
    const dying = edit(s, (d) => {
      for (const e of combatOf(d).enemies) e.hp = 5;
    });
    expect(setup(classFight(dying, legalActions(dying, h, profile), h, {}, { lean: 'weapon', healBelow: 0.3 }))).toBe(false);
  });

  test('an authored bonus counts when the target carries its status; a Storm spell on a Soaked foe is worth half again', () => {
    const { h, s } = tyrantFight('wizard');
    const foe = combatOf(s).enemies[0] as NonNullable<GameState['combat']>['enemies'][number];
    expect(targetHasNow({ targetHas: 'status_armor_break' }, foe)).toBe(false);
    const broken = { ...foe, statuses: [{ statusId: 'status_armor_break', duration: 2, stacks: 1, sourceUid: null }] } as unknown as typeof foe;
    expect(targetHasNow({ any: [{ targetHas: 'status_armor_break' }, { targetHas: 'status_stun' }] }, broken)).toBe(true);
    const storm = Object.values(h.abilities).find((a) => a?.damageType === 'storm');
    if (storm !== undefined) {
      const soaked = { ...foe, resistances: {}, statuses: [{ statusId: 'status_soaked', duration: 2, stacks: 1, sourceUid: null }] } as unknown as typeof foe;
      expect(hitMult(h, storm, soaked)).toBeCloseTo(CLASS_FIGHT.soakedStormMult * hitMult(h, storm, { ...soaked, statuses: [] }));
    }
  });

  test('the build fits the class: a caster class raises MAG under any bot, its own damaging abilities first', () => {
    const real = buildContentPack();
    expect(classStat(real, 'wizard', 'strength')).toBe('magic');
    expect(classStat(real, 'ranger', 'magic')).toBe('strength');
    expect(classStat(real, 'ranger', 'agility')).toBe('agility');
    const rank = classUnlockRank(real, 'wizard', ['steel', 'breaker']);
    const fire = Object.values(real.abilities).find((a) => a?.ownerId === 'wizard' && a.power?.stat === 'sp');
    const util = Object.values(real.abilities).find((a) => a?.ownerId === 'wizard' && a.power === undefined && a.heal === undefined && a.shield === undefined);
    expect(fire).toBeDefined();
    expect(rank(fire!)).toBeLessThan(rank(util!));
    expect(rank(real.abilities['rgr_smoke_bomb']!)).toBe(6);
  });
});

describe("the Weaver's Blood price (DESIGN §5.6)", () => {
  test('comfortable: at least 40 % of max HP left and above the telegraphed blows; a small cost needs 25 %', () => {
    const me = { hp: 100, hpMax: 100 } as Parameters<typeof bloodComfortable>[0];
    expect(bloodComfortable(me, 0, 999)).toBe(true);
    expect(bloodComfortable(me, 20, 10)).toBe(true);
    expect(bloodComfortable(me, 70, 10)).toBe(false);
    expect(bloodComfortable(me, 20, 85)).toBe(false);
    expect(bloodComfortable({ ...me, hp: 30 }, 4, 0)).toBe(true);
    expect(bloodComfortable({ ...me, hp: 28 }, 4, 0)).toBe(false);
  });

  test('short of MP with HP to spare, a Weaver pays in blood rather than wait', () => {
    const { h, profile, s } = tyrantFight('shadow_weaver');
    const dry = edit(s, (d) => {
      const me = playerOf(combatOf(d));
      me.mp = 0;
      me.hp = me.hpMax;
    });
    const a = pick(casterBot(), dry, h, profile);
    expect(a.type).toBe('ability');
    expect(paysBlood(dry, h, playerOf(combatOf(dry)), (a as Extract<Action, { type: 'ability' }>).abilityId)).toBe(true);
    // at a third of its HP it does not bleed for it
    const low = edit(dry, (d) => {
      const me = playerOf(combatOf(d));
      me.hp = Math.floor(me.hpMax * 0.36);
    });
    const b = pick(casterBot(), low, h, profile);
    if (b.type === 'ability') {
      const cost = playerAbilityCost(low, h, b.abilityId, playerOf(combatOf(low)));
      expect(cost.mpPaid).toBe(cost.mp);
    }
  });
});

describe('the speedrunner runs', () => {
  test('it fights what it meets on the road (a flight falls back a node, D-143) and flees only ≥ 3 levels above it', () => {
    const { h, profile, s } = tyrantFight('ranger');
    const fodder = edit(s, (d) => {
      const c = combatOf(d);
      c.canFlee = true;
      for (const e of c.enemies) e.level = d.player.level + SPEEDRUNNER.fleeMargin - 1;
    });
    const legal = legalActions(fodder, h, profile);
    expect(legal.some((a) => a.type === 'flee')).toBe(true);
    {
      expect(pick(speedrunnerBot(), fodder, h, profile).type).not.toBe('flee');
      const big = edit(fodder, (d) => {
        for (const e of combatOf(d).enemies) e.level = d.player.level + SPEEDRUNNER.fleeMargin;
      });
      expect(pick(speedrunnerBot(), big, h, profile)).toEqual({ type: 'flee' });
    }
  });

  test('it faces the Apex at the fight − 5 (DESIGN §19 #11: the speedrunner at the Apex at ≥ 9)', () => {
    expect(SPEEDRUNNER.apexMargin).toBe(5);
  });
});

describe('bots respect danger', () => {
  const env = (s: GameState, c: ContentPack, p: Profile): Env => ({ s, legal: legalActions(s, c, p), content: c, profile: p, n: notesOf({}, 'test') });

  test('a fight ≥ level + 4 is fled by the melee bot (D-066), and one where it fell at this level', () => {
    const { h, profile, s } = tyrantFight('ranger');
    const fleeable = edit(s, (d) => (combatOf(d).canFlee = true));
    expect(legalActions(fleeable, h, profile).some((a) => a.type === 'flee')).toBe(true);
    const high = edit(fleeable, (d) => {
      for (const e of combatOf(d).enemies) e.level = d.player.level + DANGER_MARGIN;
    });
    expect(pick(meleeBot(), high, h, profile)).toEqual({ type: 'flee' });
    const e = env(fleeable, h, profile);
    expect(fellHere(e)).toBe(false);
    e.n.fellAt[combatOf(fleeable).locationId] = fleeable.player.level;
    expect(fellHere(e)).toBe(true);
  });

  test('dangerAt: a place to visit with a fight far above is left for later; one to pass through only if the fight is unfleeable', () => {
    const h = hordePack();
    const p = freshProfile();
    const s = makeState({ level: 1 }, { content: h });
    const far = Object.keys(h.locations).find((id) => pendingFights(s, h, p, id).some((f) => f.level >= 1 + DANGER_MARGIN));
    expect(far).toBeDefined();
    if (far === undefined) return;
    expect(dangerAt(s, h, p, far, 'visit')).toBe(true);
    const unfleeable = pendingFights(s, h, p, far).some((f) => !f.fleeable && f.level >= 1 + DANGER_MARGIN);
    expect(dangerAt(s, h, p, far, 'pass')).toBe(unfleeable);
    const grown = edit(s, (d) => (d.player.level = 30));
    expect(dangerAt(grown, h, p, far, 'visit')).toBe(false);
  });

  test('a lost Apex fight is retried only after a level up', () => {
    const h = hordePack();
    const p = freshProfile();
    const s = makeState({ level: 9 }, { content: h });
    const e = env(s, h, p);
    expect(apexSettled(e)).toBe(false);
    e.n.fellAt['loc_temporal_breach_apex'] = 9;
    expect(apexSettled(e)).toBe(true);
    e.n.fellAt['loc_temporal_breach_apex'] = 8;
    expect(apexSettled(e)).toBe(false);
  });

  test("the Horde's road to the portal goes around a place an unfleeable fight holds, and a hurt bot's bed is one no fight guards", () => {
    const real = buildContentPack();
    const p = freshProfile();
    const s = makeState({ locationId: 'loc_where_she_fell', level: 5 }, { content: real });
    const route = hordeRoute(s, real, p, 'loc_shattered_library');
    expect(route).not.toBeNull();
    expect(route).not.toContain('loc_eye_of_the_scar');
    const step1 = bedStep(s, legalActions(s, real, p), real, p, {});
    expect(step1 === undefined || step1.type === 'move').toBe(true);
  });
});

describe('quest following (questFollow.ts)', () => {
  const real = buildContentPack();
  const p = freshProfile();

  test('wantedItems reads item atoms through all/any, never under a not', () => {
    expect([...wantedItems({ all: [{ item: { id: 'item_a' } }, { any: [{ item: { id: 'item_b' } }, { flag: 'x' }] }] } as never)].sort()).toEqual(['item_a', 'item_b']);
    expect([...wantedItems({ not: { item: { id: 'item_c' } } } as never)]).toEqual([]);
  });

  test('a stage with no hint points at its giver ("Return to Ilyra and choose")', () => {
    const s = makeState({ locationId: 'loc_shattered_library', quests: { q_echo_crystal: 'return' } }, { content: real });
    const targets = questTargets(s, real, p);
    const where = npcWhere(s, real, p, 'npc_ilyra');
    expect(where.length).toBeGreaterThan(0);
    for (const at of where) expect(targets.map((t) => t.locationId)).toContain(at);
  });

  test('at the hint of an item objective it searches the place once per quest state', () => {
    const s = makeState({ locationId: 'loc_shattered_library', quests: { q_echo_crystal: 'take_crystal' } }, { content: real });
    const legal = legalActions(s, real, p, { includeExamine: true });
    const memory: BotMemory = {};
    const a = questErrand(s, legal, real, memory);
    expect(a).toEqual({ type: 'examine', target: { kind: 'location' } });
    expect(questErrand(s, legal, real, memory)).toBeUndefined();
  });

  test("an objective's item on the merchant's shelf is bought", () => {
    // Kaelen's shelf, built: the sack of Steppe salt Brak's quest asks for, beside a draught (only the salt is bought)
    const base = makeState({ locationId: 'loc_wayfarers_respite', gold: 500, quests: { q_blood_and_salt: 'salt' } }, { content: real });
    const s = edit(base, (d) => {
      d.merchants['npc_kaelen_stonehand'] = { stock: [{ uid: 'm1', itemId: 'item_ley_touched_tonic', qty: 1, rarity: 'common', affixes: [] }, { uid: 'm2', itemId: 'mat_steppe_salt', qty: 1, rarity: 'common', affixes: [] }] } as never;
    });
    const legal: Action[] = [
      { type: 'buy', merchantId: 'npc_kaelen_stonehand', uid: 'm1' },
      { type: 'buy', merchantId: 'npc_kaelen_stonehand', uid: 'm2' },
    ] as Action[];
    expect(questErrand(s, legal, real, {})).toEqual({ type: 'buy', merchantId: 'npc_kaelen_stonehand', uid: 'm2' });
    const done = edit(s, (d) => d.player.inventory.push({ uid: 'x', itemId: 'mat_steppe_salt', qty: 1, rarity: 'common', affixes: [] } as never));
    expect(questErrand(done, legal, real, {})).toBeUndefined();
  });
});

describe('the pacifist (D-144)', () => {
  test('walled in, a forced fight it cannot win is left after the stall breaker and its strikes', () => {
    expect(PACIFIST.guardRounds + PACIFIST.strikeRounds).toBeLessThan(60);
    const { h, profile, s } = tyrantFight('ironclad_warden');
    const late = edit(s, (d) => {
      const c = combatOf(d);
      c.canFlee = true;
      c.round = PACIFIST.guardRounds + PACIFIST.strikeRounds;
    });
    expect(pick(pacifistBot(), late, h, profile)).toEqual({ type: 'flee' });
  });
});

describe('the scenario kit (scenarios.ts)', () => {
  const real = buildContentPack();
  test('a typical player raises the power stat its damage reads and unlocks its damaging abilities first', () => {
    expect(powerStat(real, 'wizard')).toBe('magic');
    expect(powerStat(real, 'elf')).toBe('strength');
    expect(typicalUnlockRank(real, 'ironclad_warden', 'wrd_crushing_blow')).toBe(0);
    expect(typicalUnlockRank(real, 'ironclad_warden', 'wrd_challenge')).toBeGreaterThan(0);
  });

  test('communion_movement_2 survives a Wayfinder felled on the walk (U80: caster ranger balS:16 crashed)', () => {
    const r = loadScenario('communion_movement_2', real, { seed: 'balS:16', classId: 'ranger' });
    expect(r.state.mode).toBe('combat');
  });
});

describe('the Escape metric (DESIGN §19 #1)', () => {
  test('the portal reached with the Tyrant untouched is an expiry, not an Escape', () => {
    const runs = [
      batchRun(blankResult({ bot: 'melee', seed: 's:0', loops: [blankLoop({ outcome: 'closer_escape', tyrant: 'untouched' })] })),
      batchRun(blankResult({ bot: 'melee', seed: 's:1', loops: [blankLoop({ outcome: 'closer_escape', tyrant: 'defeated' })] })),
    ];
    const m = computeMetrics({ pack: 'p', content: hordePack(), runs, determinism: null });
    const cell = m.byClassBot['ranger:melee'];
    expect(cell?.loop1EscapeRate).toBeCloseTo(0.5);
    expect(cell?.loop1ExpiryRate).toBeCloseTo(0.5);
  });
});
