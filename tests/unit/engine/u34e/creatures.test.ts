// U34e item 3 — creature mechanics the region units could only approximate (D-091, D-092, D-094, D-096, D-097, D-098), played
// on the real pack's creatures with scripted draws: `allyDown` / `allyBelow`, `repeatPrevious`, `deathMove`, `clockCost`,
// `consumesAlly`, a phase's `statusImmunities` and `roundStatuses`, `missesIfGuarded`, `hpLines`, `damage.pctMax` with a
// location's `fleeEffects`, construct Bleed immunity, `killed.anyLoop` and `diedHere` (profile `lastDeathLocation`), the
// `class_mirror` and `last_spell` specials, the `drowned` tag and the ambush tag.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import {
  AMBUSH_TAG,
  BLEED_IMMUNE_TAGS,
  HP_LINE_TAG,
  TAG_AGAIN,
  applyHit,
  applyStatus,
  arrivalEncounter,
  beginCombat,
  evalCombatWhen,
  evaluate,
  executeIntent,
  findStatus,
  fixedHit,
  generateIntent,
  hasTag,
  moveDamageType,
  noteLastAbility,
  playerOf,
  roundStartStatuses,
  runCombat,
  statusImmunities,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameState,
  type HitSpec,
  type StepCtx,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { D, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';

const pack = buildContentPack();
const profile = freshProfile();
const at = (overrides: Parameters<typeof makeState>[0] = {}): GameState => makeState({ level: 12, ...overrides }, { content: pack, profile });
const spec = (groups: { creatureId: string; count: number }[], ambush = false): EncounterSpec => ({
  id: 'enc_u34e_test', groups, fleeable: true, onFlee: 'scatter', ambush, onVictory: [], onDefeat: [], onFleeEffects: [],
});
/** Neutral draws: every percentage roll 50 (hits land, 30 % statuses fail), variance ×1.0, no crit. */
const MANY = Array.from({ length: 80 }, () => 0.5);
function fight(s: GameState, groups: { creatureId: string; count: number }[], o: { ambush?: boolean; p?: typeof profile } = {}): { ctx: StepCtx; combat: CombatState } {
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1), D.d4(1), D.d4(1), ...MANY], pack, o.p ?? profile);
  return { ctx, combat: beginCombat(ctx, spec(groups, o.ambush)) };
}
const one = (creatureId: string, count = 1) => [{ creatureId, count }];
const hit = (source: string): HitSpec => ({ source, type: 'physical', base: 0, coef: 1, stat: 'atk' });
const scope = (self: Combatant) => ({ self, target: null, turn: 1, round: 1 });
const emptyLocation = () => ({
  visited: true, visitCount: 1, items: [], itemsSpawned: true, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
  unlockedExits: [], lockedExits: [], scattered: [] as string[], encounterHp: {},
});
const hitsOn = (ctx: StepCtx, from: Combatant, to: Combatant) => ctx.events.filter((e) => e.t === 'damageDealt' && e.sourceUid === from.uid && e.targetUid === to.uid);

describe('construct Bleed immunity (D-094: WORLD §6 "`construct`: Poison and Bleed immune")', () => {
  test('every construct is Bleed- and Poison-immune by its tag, whatever its record writes', () => {
    expect(BLEED_IMMUNE_TAGS).toEqual(['construct']);
    const constructs = Object.values(pack.creatures).filter((c) => c.tags.includes('construct'));
    expect(constructs.length).toBeGreaterThan(10);
    for (const c of constructs) {
      const { ctx, combat } = fight(at(), one(c.id));
      const immune = statusImmunities(ctx.s, pack, combat.enemies[0]!);
      expect([c.id, immune.includes('status_bleed'), immune.includes('status_poison')]).toEqual([c.id, true, true]);
    }
  });
});

describe('CombatWhen: allyDown and allyBelow (D-091, D-092, D-094)', () => {
  test('allyDown holds once an ally has fallen (a withdrawn one has not); allyBelow reads a living ally’s HP share', () => {
    const { ctx, combat } = fight(at(), one('cr_rootling', 3));
    const [a, b, c] = combat.enemies as [Combatant, Combatant, Combatant];
    expect(evalCombatWhen(ctx, combat, { allyDown: true }, scope(a))).toBe(false);
    b.fledOrGone = true;
    expect(evalCombatWhen(ctx, combat, { allyDown: true }, scope(a))).toBe(false);
    b.fledOrGone = false;
    Object.assign(b, { alive: false, hp: 0 });
    expect(evalCombatWhen(ctx, combat, { allyDown: true }, scope(a))).toBe(true);
    expect(evalCombatWhen(ctx, combat, { allyBelow: 0.5 }, scope(a))).toBe(false);
    c.hp = Math.floor(0.4 * c.hpMax);
    expect(evalCombatWhen(ctx, combat, { allyBelow: 0.5 }, scope(a))).toBe(true);
    expect(evalCombatWhen(ctx, combat, { allyBelow: 0.3 }, scope(a))).toBe(false);
    expect(evalCombatWhen(ctx, combat, { allyBelow: 0.5 }, scope(c))).toBe(false); // itself excluded
  });
});

describe('moves', () => {
  test('repeatPrevious: the Stutter Hound’s Echo plays its last move again — skipped before it has one — with its own line', () => {
    const { ctx, combat } = fight(at(), one('cr_stutter_hound'));
    const hound = combat.enemies[0]!;
    hound.hp = Math.floor(0.4 * hound.hpMax); // the Echo's condition holds from the start
    hound.pattern.pointer = 0;
    const first = generateIntent(ctx, combat, hound);
    expect(first?.moveId).toBe('stutter_bite'); // no previous move: the Echo is skipped
    executeIntent(ctx, combat, hound, applyHit);
    hound.pattern.turnsTaken += 1;
    const again = generateIntent(ctx, combat, hound);
    expect(again).toMatchObject({ moveId: 'stutter_bite', text: 'It does the last thing again, exactly.' });
    expect(again?.tags).toContain(TAG_AGAIN);
    expect(again?.projected).toEqual(first?.projected);
  });

  test('deathMove: a Spore Drift bursts as it falls — Ley on every opponent and Poison (100 %) — before the fight closes', () => {
    const { ctx, combat } = fight(at(), one('cr_spore_drift'));
    const me = playerOf(combat);
    me.statuses = [];
    const drift = combat.enemies[0]!;
    applyHit(ctx, combat, me, drift, hit('basic'), fixedHit(drift.hp, false, []), 'basic');
    expect(drift.alive).toBe(false);
    expect(hitsOn(ctx, drift, me).length).toBe(1);
    expect(findStatus(me, 'status_poison')).toBeDefined();
    expect(combat.log.some((l) => l.text === 'Spore Drift: It bursts, sweetly.')).toBe(true);
    // a Glass Mote shatters the same way
    const mote = fight(at(), one('cr_glass_mote'));
    const m = mote.combat.enemies[0]!;
    applyHit(mote.ctx, mote.combat, playerOf(mote.combat), m, hit('basic'), fixedHit(m.hp, false, []), 'basic');
    expect(hitsOn(mote.ctx, m, playerOf(mote.combat)).length).toBe(1);
  });

  test('clockCost: the Hour Leech’s Drink the Hour moves the Breach Clock one watch earlier, once a fight', () => {
    const { ctx, combat } = fight(at(), one('cr_hour_leech'));
    const leech = combat.enemies[0]!;
    const limit = ctx.s.clock.limitTicks;
    for (const turn of [3, 6]) {
      leech.pattern.turnsTaken = turn - 1;
      expect(generateIntent(ctx, combat, leech)?.moveId).toBe('leech_drink_hour');
      executeIntent(ctx, combat, leech, applyHit);
    }
    expect(ctx.s.clock.limitTicks).toBe(limit - 1);
    expect(ctx.events.filter((e) => e.t === 'clockChanged')).toEqual([{ t: 'clockChanged', deltaWatches: -1, limitTicks: limit - 1, floored: false }]);
  });

  test('consumesAlly: the Matron’s Drink takes the toad out of the fight (not a kill) and heals her', () => {
    const { ctx, combat } = fight(at(), [{ creatureId: 'cr_lantern_matron', count: 1 }, { creatureId: 'cr_lantern_toad', count: 1 }]);
    const [matron, toad] = combat.enemies as [Combatant, Combatant];
    matron.phase = 1;
    matron.hp = Math.floor(matron.hpMax / 2);
    expect(generateIntent(ctx, combat, matron)?.moveId).toBe('matron_drink');
    const before = matron.hp;
    executeIntent(ctx, combat, matron, applyHit);
    expect([toad.fledOrGone, toad.alive]).toEqual([true, true]);
    expect(ctx.s.counters.kills['cr_lantern_toad']).toBeUndefined();
    expect(matron.hp).toBeGreaterThan(before);
    // no toad left: no Drink
    expect(generateIntent(ctx, combat, matron)?.moveId).not.toBe('matron_drink');
  });

  test('a phase’s statusImmunities: in She Wants More the Matron refuses Shield and Regen from any source', () => {
    const { ctx, combat } = fight(at(), one('cr_lantern_matron'));
    const matron = combat.enemies[0]!;
    matron.phase = 1;
    expect(applyStatus(ctx, combat, matron, matron, 'status_shield', { amount: 10 }).outcome).toBe('applied');
    matron.statuses = [];
    matron.phase = 2;
    expect(applyStatus(ctx, combat, matron, matron, 'status_shield', { amount: 10 }).outcome).toBe('immune');
    expect(applyStatus(ctx, combat, matron, matron, 'status_regen', { amount: 5 }).outcome).toBe('immune');
  });

  test('missesIfGuarded: the Cinderback’s Stampede misses a Guarding player entirely (no damage, no Burn); unguarded it lands', () => {
    for (const guarding of [true, false]) {
      const { ctx, combat } = fight(at(), one('cr_cinderback'));
      const me = playerOf(combat);
      me.statuses = [];
      const bull = combat.enemies[0]!;
      expect(generateIntent(ctx, combat, bull)?.moveId).toBe('cinder_stampede');
      me.guarding = guarding;
      const hp = me.hp;
      executeIntent(ctx, combat, bull, applyHit);
      const dealt = hitsOn(ctx, bull, me);
      if (guarding) {
        expect([me.hp, dealt.length, findStatus(me, 'status_burn')]).toEqual([hp, 0, undefined]);
        expect(combat.log.some((l) => l.text.endsWith('Stampede misses entirely.'))).toBe(true);
      } else expect(me.hp).toBeLessThan(hp);
    }
  });
});

describe('boss lines at HP thresholds (hpLines)', () => {
  test('Ashmaw: the moment its HP falls under 15 % its next action is the Grief, once', () => {
    const { ctx, combat } = fight(at(), one('cr_ashmaw'));
    const ashmaw = combat.enemies[0]!;
    ashmaw.phase = 2;
    generateIntent(ctx, combat, ashmaw);
    expect(combat.intents[ashmaw.uid]?.moveId).not.toBe('ashmaw_grief');
    const me = playerOf(combat);
    const toLow = ashmaw.hp - Math.floor(0.12 * ashmaw.hpMax);
    applyHit(ctx, combat, me, ashmaw, hit('basic'), fixedHit(toLow, false, []), 'basic');
    expect(combat.intents[ashmaw.uid]?.moveId).toBe('ashmaw_grief');
    expect(ashmaw.pattern.firedOnce).toContain(`${HP_LINE_TAG}0`);
    // its own turn's end keeps the forced move until it is played; then the pattern resumes, and the line never fires again
    expect(generateIntent(ctx, combat, ashmaw)?.moveId).toBe('ashmaw_grief');
    executeIntent(ctx, combat, ashmaw, applyHit);
    ashmaw.pattern.turnsTaken += 1;
    expect(generateIntent(ctx, combat, ashmaw)?.moveId).not.toBe('ashmaw_grief');
    applyHit(ctx, combat, me, ashmaw, hit('basic'), fixedHit(1, false, []), 'basic');
    expect(combat.intents[ashmaw.uid]?.moveId).not.toBe('ashmaw_grief');
  });

  test('the Unveiled Tyrant: "If you finish this, run" at 10 % HP, once', () => {
    const p2 = freshProfile({ loopCounter: 2 });
    const s = makeState({ loop: 2, level: 16 }, { content: pack, profile: p2 });
    const { ctx, combat } = fight(s, one('cr_chronos_tyrant_unveiled'), { p: p2 });
    const tyrant = combat.enemies[0]!;
    tyrant.phase = 3;
    const me = playerOf(combat);
    const line = "'If you finish this, run,' says the voice under the chorus. 'I mean that kindly.'";
    applyHit(ctx, combat, me, tyrant, hit('basic'), fixedHit(tyrant.hp - Math.floor(0.2 * tyrant.hpMax), false, []), 'basic');
    expect(combat.log.some((l) => l.text === line)).toBe(false);
    applyHit(ctx, combat, me, tyrant, hit('basic'), fixedHit(Math.floor(0.15 * tyrant.hpMax), false, []), 'basic');
    applyHit(ctx, combat, me, tyrant, hit('basic'), fixedHit(1, false, []), 'basic');
    expect(combat.log.filter((l) => l.text === line).length).toBe(1);
    expect(ctx.s.recentLog.filter((l) => l.text === line).length).toBe(1);
  });
});

describe('a share of max HP and the Stair’s flee (D-097)', () => {
  test('fleeing a fight on the Windward Stair costs 10 % of max HP (any fight fled there); elsewhere nothing', () => {
    expect(pack.locations['loc_windward_stair']?.fleeEffects).toEqual([{ damage: { pctMax: 0.1 } }]);
    for (const [where, cost] of [['loc_windward_stair', true], ['loc_sky_whisper_plateau', false]] as const) {
      const { ctx, combat } = fight(at({ locationId: where }), one('cr_gale_kite'));
      const me = playerOf(combat);
      Object.assign(combat, { phase: 'playerTurn', turnOrder: [me.uid, combat.enemies[0]!.uid], turnIndex: 0 });
      ctx.s.mode = 'combat';
      const hp = me.hp;
      const out = scriptedStep(ctx.s, { type: 'flee' }, [D.pct(0), ...MANY], pack, profile);
      expect(out.rejected).toBeNull();
      expect(out.state.combat).toBeNull();
      expect([where, out.state.player.hp]).toEqual([where, cost ? hp - Math.floor(0.1 * out.state.player.hpMax) : hp]);
    }
  });
});

describe('across loops: killed.anyLoop and diedHere (D-091, D-096)', () => {
  test('a death writes the profile’s lastDeathLocation; `diedHere` holds there in a later loop', () => {
    const p2 = freshProfile({ loopCounter: 2 });
    const s = makeState({ loop: 2, locationId: 'loc_whispering_ruins' }, { content: pack, profile: p2 });
    const { ctx, combat } = fight(s, one('cr_corrupted_shade'), { p: p2 });
    const me = playerOf(combat);
    applyHit(ctx, combat, combat.enemies[0]!, me, hit('shade_rake'), fixedHit(me.hp, false, []), 'intent');
    runCombat(ctx);
    expect(ctx.profile.lastDeathLocation).toBe('loc_whispering_ruins');
    const later = makeState({ loop: 4, locationId: 'loc_whispering_ruins' }, { content: pack, profile: ctx.profile });
    expect(evaluate({ diedHere: true }, later, ctx.profile, pack)).toBe(true);
    const elsewhere = clone(later);
    elsewhere.world.currentLocationId = 'loc_mistwood_path';
    expect(evaluate({ diedHere: true }, elsewhere, ctx.profile, pack)).toBe(false);
    // the Ruins' Redundant Wayfinder waits on it (WORLD §3.1)
    expect(pack.locations['loc_whispering_ruins']?.encounters.find((e) => e.id === 'enc_ruins_redundant_stand')?.when).toEqual({ all: [{ loop: { min: 4 } }, { diedHere: true }] });
  });

  test('Vell’s Umbra opens on Phase 2 once it has been killed in any loop (the profile’s bestiary)', () => {
    const before = freshProfile({ loopCounter: 3 });
    const killed = freshProfile({ loopCounter: 3, bestiary: { cr_vells_umbra: { seen: 1, killed: 1, spared: 0, revealed: 'resist', intentsSeen: [] } } });
    for (const [p, phase] of [[before, 0], [killed, 1]] as const) {
      const s = makeState({ loop: 3, level: 16, locationId: 'loc_eye_of_the_scar' }, { content: pack, profile: p });
      const { ctx, combat } = fight(s, one('cr_vells_umbra'), { p });
      runCombat(ctx);
      expect(combat.enemies[0]!.phase).toBe(phase);
    }
  });
});

describe('the class mirror and the last spell (D-091)', () => {
  test('the Redundant Wayfinder deals and resists the player’s class type: Wizard fire, Weaver void, Ranger physical', () => {
    for (const [classId, type] of [['wizard', 'fire'], ['shadow_weaver', 'void'], ['ranger', 'physical']] as const) {
      const { ctx, combat } = fight(at({ classId }), one('cr_redundant_wayfinder'));
      const w = combat.enemies[0]!;
      expect([classId, w.resistances[type]]).toEqual([classId, 'resist']);
      expect(w.resistances.ley).toBe('weak');
      expect(moveDamageType(ctx, combat, pack.creatures['cr_redundant_wayfinder']!.moves['redundant_your_move']!)).toBe(type);
    }
  });

  test('the Paradox Wisp’s Mirror deals the type of the player’s last ability this fight, Ley before one', () => {
    const { ctx, combat } = fight(at({ classId: 'wizard' }), one('cr_paradox_wisp'));
    const mirror = pack.creatures['cr_paradox_wisp']!.moves['paradox_mirror']!;
    expect(moveDamageType(ctx, combat, mirror)).toBe('ley');
    noteLastAbility(playerOf(combat), 'wiz_fireball');
    expect(moveDamageType(ctx, combat, mirror)).toBe('fire');
    noteLastAbility(playerOf(combat), 'wiz_echo_bolt');
    expect(moveDamageType(ctx, combat, mirror)).toBe('ley');
    expect(playerOf(combat).pattern.firedOnce.filter((t) => t.startsWith('last_ability:'))).toEqual(['last_ability:wiz_echo_bolt']);
  });
});

describe('the drowned tag, round statuses and the ambush tag', () => {
  test('`drowned`: a Tide Clerk is Soaked at the start of each of its turns', () => {
    const { ctx, combat } = fight(at(), one('cr_tide_clerk'));
    const clerk = combat.enemies[0]!;
    expect(findStatus(clerk, 'status_soaked')).toBeUndefined();
    combat.turnOrder = [clerk.uid, playerOf(combat).uid];
    runCombat(ctx);
    expect(findStatus(clerk, 'status_soaked')).toBeDefined();
    expect(combat.phase).toBe('playerTurn');
  });

  test('roundStatuses: in the Bell-Warden’s Phase 2 every combatant is Soaked as a round begins; not in Phase 1', () => {
    const { ctx, combat } = fight(at(), one('cr_bell_warden'));
    const warden = combat.enemies[0]!;
    roundStartStatuses(ctx, combat);
    expect(findStatus(playerOf(combat), 'status_soaked')).toBeUndefined();
    warden.phase = 1;
    roundStartStatuses(ctx, combat);
    for (const c of [...combat.party, ...combat.enemies]) expect(findStatus(c, 'status_soaked')).toBeDefined();
  });

  test('a fight that begins as an ambush tags the player (the onset hazards read it); a wandering roll is one', () => {
    expect(hasTag(playerOf(fight(at(), one('cr_corrupted_shade'), { ambush: true }).combat), AMBUSH_TAG)).toBe(true);
    expect(hasTag(playerOf(fight(at(), one('cr_corrupted_shade')).combat), AMBUSH_TAG)).toBe(false);
    // a return visit's wandering roll at the Mistwood Path (no fixed group left): an ambush
    const s = at({ locationId: 'loc_mistwood_path' });
    const ctx = scriptedCtx(s, [D.yes, D.no, D.yes], pack, profile);
    for (const enc of pack.locations['loc_mistwood_path']!.encounters) (ctx.s.world.locationStates['loc_mistwood_path'] ??= emptyLocation()).scattered.push(enc.id);
    const wandering = arrivalEncounter(ctx, { locationId: 'loc_mistwood_path', via: 'move', firstVisit: false });
    expect(wandering).toMatchObject({ id: 'wandering', ambush: true });
  });
});
