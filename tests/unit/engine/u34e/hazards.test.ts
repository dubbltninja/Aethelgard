// U34e item 5 — weather and hazards (D-094, D-096, D-097; WORLD §2's "Weather / time" and "Hazards" rows): the schema's
// `HazardSchema`, the places of the real pack that carry them, and each trigger played with scripted draws — a fight's
// opening (the Reach's Soaked, the Glowfen's rain, the Pan's glare, the gale, the dusk storm, the Spires' static), an
// ambush's (ashfall by its cycle, the Gallery's Blind, the Shallows' spore-fog), a round's (the Cairns' lightning), the
// watches at a place (the Unmaking, restored on leaving; the Void-chill), leaving (the Pass's mirage paths) — and
// `hazard_immunity`.
import { describe, expect, test } from 'bun:test';
import { HazardSchema } from '@schema/location';
import { buildContentPack } from '@content/index';
import {
  HAZARD_LOST_KEY,
  HAZARD_PENDING_KEY,
  HAZARD_STILL_KEY,
  advanceTime,
  apply,
  applyStatus,
  beginCombat,
  findStatus,
  hazardAccuracy,
  hazardDealtMult,
  hazardImmune,
  hazardPostStep,
  hazardsAtOpening,
  hazardsAtRound,
  hitChanceOf,
  playerOf,
  runCombat,
  type CombatState,
  type EncounterSpec,
  type GameState,
  type HitSpec,
  type StepCtx,
} from '@engine/index';
import { D, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';

const pack = buildContentPack();
const profile = freshProfile();
type Overrides = Parameters<typeof makeState>[0];
const at = (locationId: string, o: Overrides = {}): GameState => makeState({ level: 12, locationId, ...o }, { content: pack, profile });
const MANY = Array.from({ length: 80 }, () => 0.5);
const spec = (groups: { creatureId: string; count: number }[], ambush: boolean): EncounterSpec => ({
  id: 'enc_u34e_hazard', groups, fleeable: true, onFlee: 'scatter', ambush, onVictory: [], onDefeat: [], onFleeEffects: [],
});
/** A fight with the player first by initiative; `after` are the draws that follow the initiative rolls. */
function fight(s: GameState, creatures: string[], o: { ambush?: boolean; after?: number[] } = {}): { ctx: StepCtx; combat: CombatState } {
  const ctx = scriptedCtx(s, [D.d4(4), ...creatures.map(() => D.d4(1)), ...(o.after ?? []), ...MANY], pack, profile);
  return { ctx, combat: beginCombat(ctx, spec(creatures.map((creatureId) => ({ creatureId, count: 1 })), o.ambush ?? false)) };
}
/** The fight's opening hazards, then the statuses on the player and the first enemy. */
function opened(s: GameState, creatures: string[], o: { ambush?: boolean; after?: number[] } = {}) {
  const f = fight(s, creatures, o);
  hazardsAtOpening(f.ctx, f.combat);
  return { ...f, me: playerOf(f.combat), foe: f.combat.enemies[0]! };
}
const has = (c: { statuses: { statusId: string }[] }, id: string): boolean => c.statuses.some((st) => st.statusId === id);
const ids = (locationId: string): string[] => (pack.locations[locationId]?.hazards ?? []).map((h) => h.id);
const inRegion = (regionId: string): string[] => Object.values(pack.locations).filter((l) => l.regionId === regionId).map((l) => l.id);
const DAWN = 0;
const DAY = 1;
const DUSK = 2;
const NIGHT = 3;

describe('HazardSchema (C1, D-094)', () => {
  test('defaults, and each trigger only with the effects it can carry', () => {
    expect(HazardSchema.parse({ id: 'h', on: 'fight', status: { id: 'status_soaked' } })).toMatchObject({
      chance: 1, firstVisit: false, restoreOnLeave: false, status: { to: 'party' },
    });
    const bad = [
      { id: 'h', on: 'leave', status: { id: 'status_soaked' } }, // a status needs a fight trigger; `leave` needs watches
      { id: 'h', on: 'watch' }, // hpPctMax
      { id: 'h', on: 'fight', strike: { type: 'storm', amount: 5 } }, // a strike needs `round`
      { id: 'h', on: 'round', accuracy: { amount: -10 } }, // accuracy needs a fight's opening
      { id: 'h', on: 'linger', watches: 2 }, // a status
      { id: 'h', on: 'fight' }, // no effect at all
    ];
    for (const h of bad) expect([h, HazardSchema.safeParse(h).success]).toEqual([h, false]);
  });
});

describe('the real pack places them as WORLD §2 says', () => {
  test('region-wide rows are on every place of the region; place rows on their place', () => {
    for (const id of inRegion('region_drowned_reach')) expect([id, ids(id)]).toEqual([id, ['reach_soaked']]);
    for (const id of inRegion('region_skyreach')) expect([id, ids(id)]).toEqual([id, ['gale', 'gale_haste', 'storm', 'storm_lightning']]);
    for (const id of inRegion('region_glowfen')) expect([id, ids(id)[0]]).toEqual([id, 'glowfen_rain']);
    for (const id of inRegion('region_ashen_steppe')) expect([id, ids(id)[0]]).toEqual([id, 'ashfall']);
    expect(inRegion('region_drowned_reach').length).toBe(8);
    expect(ids('loc_sporelight_shallows')).toEqual(['glowfen_rain', 'spore_fog', 'shallows_sinking']);
    expect(ids('loc_grey_salt_pan')).toEqual(['ashfall', 'salt_glare']);
    expect(ids('loc_stormgate_cairns')).toEqual(['ashfall', 'cairns_lightning', 'cairns_dry_lightning']);
    expect(ids('loc_voidscar_hollow')).toEqual(['void_chill']);
    expect(ids('loc_shimmering_pass')).toEqual(['mirage_paths']);
    expect(ids('loc_aetherium_spires')).toEqual(['spires_static']);
    expect(ids('loc_sky_whisper_plateau')).toEqual(['plateau_gale']);
    expect(ids('loc_veridian_glowlands')).toEqual(['glowlands_sinkholes']);
    expect(ids('loc_voidglass_gallery')).toEqual(['gallery_blind']);
    expect(ids('loc_null_orchard')).toEqual(['unmaking']);
    expect(ids('loc_eye_of_the_scar')).toEqual(['unmaking']);
    expect(ids('loc_scholars_corridor')).toEqual(['ley_flare']);
  });

  test("the Weaver's Thread Ring's `hazard_immunity` names the Unmaking", () => {
    const s = at('loc_null_orchard', { items: [{ itemId: 'item_weavers_thread_ring', equip: true }] });
    expect(hazardImmune(scriptedCtx(s, [], pack, profile), 'unmaking')).toBe(true);
    expect(hazardImmune(scriptedCtx(at('loc_null_orchard'), [], pack, profile), 'unmaking')).toBe(false);
  });
});

describe('a fight’s opening', () => {
  test('the Drowned Reach: the party opens every fight Soaked (through runCombat), the enemies do not', () => {
    const { ctx } = fight(at('loc_tidewell_hall'), ['cr_rootling']);
    runCombat(ctx);
    const combat = ctx.s.combat as CombatState;
    expect(combat.phase).toBe('playerTurn');
    expect(has(playerOf(combat), 'status_soaked')).toBe(true);
    expect(has(combat.enemies[0]!, 'status_soaked')).toBe(false);
    const dry = fight(at('loc_hearthring'), ['cr_rootling']);
    runCombat(dry.ctx);
    expect(has(playerOf(dry.ctx.s.combat as CombatState), 'status_soaked')).toBe(false);
  });

  test('the Glowfen rain: every second day everyone opens Soaked; the Shallows sink the party (Slow) at every fight', () => {
    const wet = opened(at('loc_lanternreed', { day: 2, watch: DAY }), ['cr_rootling']);
    expect([has(wet.me, 'status_soaked'), has(wet.foe, 'status_soaked')]).toEqual([true, true]);
    const dry = opened(at('loc_lanternreed', { day: 3, watch: DAY }), ['cr_rootling']);
    expect([has(dry.me, 'status_soaked'), has(dry.foe, 'status_soaked')]).toEqual([false, false]);
    const shallows = opened(at('loc_sporelight_shallows', { day: 1, watch: DAY }), ['cr_rootling']);
    expect([has(shallows.me, 'status_slow'), has(shallows.me, 'status_poison')]).toEqual([true, false]);
  });

  test("the Pan's glare by day: −10 accuracy for everyone, gone at night", () => {
    const day = opened(at('loc_grey_salt_pan', { watch: DAY }), ['cr_rootling']);
    expect([hazardAccuracy(day.me), hazardAccuracy(day.foe)]).toEqual([-10, -10]);
    const night = opened(at('loc_grey_salt_pan', { watch: NIGHT }), ['cr_rootling']);
    expect([hazardAccuracy(night.me), hazardAccuracy(night.foe)]).toEqual([0, 0]);
    const basic: HitSpec = { source: 'basic', type: 'physical', base: 0, coef: 1, stat: 'atk' };
    day.foe.evasion = day.me.accuracy - 60;
    night.foe.evasion = night.me.accuracy - 60;
    expect(hitChanceOf(pack, day.me, day.foe, basic)).toBe(hitChanceOf(pack, night.me, night.foe, basic) - 10);
  });

  test('the Skyreach gale (not at dawn): −10 on a bow only, Haste for Skyborn creatures; the dusk storm: Storm ×1.25 for everyone', () => {
    const bow = { items: [{ itemId: 'item_primitive_bow', equip: true }] };
    const gale = opened(at('loc_windward_stair', { watch: DAY, ...bow }), ['cr_gale_kite', 'cr_rootling']);
    expect(hazardAccuracy(gale.me)).toBe(-10);
    expect(gale.combat.enemies.map((e) => [e.refId, hazardAccuracy(e), has(e, 'status_haste')])).toEqual([
      ['cr_gale_kite', 0, true],
      ['cr_rootling', 0, false],
    ]);
    expect(hazardDealtMult(gale.me, 'storm')).toBe(1);
    const dagger = opened(at('loc_windward_stair', { watch: DAY }), ['cr_gale_kite']);
    expect(hazardAccuracy(dagger.me)).toBe(0);
    const still = opened(at('loc_windward_stair', { watch: DAWN, ...bow }), ['cr_gale_kite']);
    expect([hazardAccuracy(still.me), has(still.foe, 'status_haste')]).toEqual([0, false]);
    const storm = opened(at('loc_spire_crown', { watch: DUSK }), ['cr_gale_kite']);
    expect([hazardDealtMult(storm.me, 'storm'), hazardDealtMult(storm.foe, 'storm'), hazardDealtMult(storm.me, 'fire')]).toEqual([1.25, 1.25, 1]);
  });

  test("the Spires' static discharge: Shock for 1 turn from Loop 2 (cosmetic in Loop 1)", () => {
    expect(findStatus(opened(at('loc_aetherium_spires', { loop: 2 }), ['cr_rootling']).me, 'status_shock')?.duration).toBe(1);
    expect(has(opened(at('loc_aetherium_spires', { loop: 1 }), ['cr_rootling']).me, 'status_shock')).toBe(false);
  });
});

describe('an ambush’s opening', () => {
  test('ashfall: Blind for 1 turn on Days 1–2 of each three-day cycle, not on a plain fight, not once the Heartstone is destroyed', () => {
    const blind = (o: Overrides, ambush = true) => has(opened(at('loc_ash_wind_flats', o), ['cr_rootling'], { ambush }).me, 'status_blind');
    expect([1, 2, 3, 4, 5, 6].map((day) => blind({ day }))).toEqual([true, true, false, true, true, false]);
    expect(blind({ day: 1 }, false)).toBe(false);
    expect(blind({ day: 1, flags: { flag_heartstone_destroyed: true } })).toBe(false);
  });

  test('the Gallery: the player Blind on the first turn of an ambush; the Hollow Lantern Focus keeps it off', () => {
    const amb = opened(at('loc_voidglass_gallery'), ['cr_rootling'], { ambush: true });
    expect(findStatus(amb.me, 'status_blind')?.duration).toBe(1);
    expect(has(opened(at('loc_voidglass_gallery'), ['cr_rootling']).me, 'status_blind')).toBe(false);
    const focus = at('loc_voidglass_gallery', { classId: 'shadow_weaver', items: [{ itemId: 'item_hollow_lantern_focus', equip: true }] });
    expect(has(opened(focus, ['cr_rootling'], { ambush: true }).me, 'status_blind')).toBe(false);
  });

  test("the Shallows' spore-fog: Poison for 1 turn at an ambush's onset at dawn (with the sinking), not by day", () => {
    const dawn = opened(at('loc_sporelight_shallows', { day: 1, watch: DAWN }), ['cr_rootling'], { ambush: true });
    expect([findStatus(dawn.me, 'status_poison')?.duration, has(dawn.me, 'status_slow')]).toEqual([1, true]);
    expect(has(opened(at('loc_sporelight_shallows', { day: 1, watch: DAY }), ['cr_rootling'], { ambush: true }).me, 'status_poison')).toBe(false);
  });
});

describe('a round’s start', () => {
  test('the Cairns: lightning, 5 Storm to a Soaked combatant each round; at night the dry lightning Shocks a Soaked one at random', () => {
    const night = fight(at('loc_stormgate_cairns', { watch: NIGHT }), ['cr_rootling'], { after: [D.yes] });
    const me = playerOf(night.combat);
    const foe = night.combat.enemies[0]!;
    applyStatus(night.ctx, night.combat, null, me, 'status_soaked');
    const [hp, foeHp] = [me.hp, foe.hp];
    expect(hazardsAtRound(night.ctx, night.combat)).toEqual({ downed: [], struck: true });
    expect([hp - me.hp, foeHp - foe.hp]).toEqual([5, 0]);
    expect([has(me, 'status_shock'), has(foe, 'status_shock')]).toEqual([true, false]);
    const missed = fight(at('loc_stormgate_cairns', { watch: NIGHT }), ['cr_rootling'], { after: [D.no] });
    applyStatus(missed.ctx, missed.combat, null, playerOf(missed.combat), 'status_soaked');
    hazardsAtRound(missed.ctx, missed.combat);
    expect(has(playerOf(missed.combat), 'status_shock')).toBe(false);
    const dry = fight(at('loc_stormgate_cairns', { watch: DAY }), ['cr_rootling']);
    expect(hazardsAtRound(dry.ctx, dry.combat)).toEqual({ downed: [], struck: false });
  });

  test('a strike that empties a combatant is returned as downed', () => {
    const f = fight(at('loc_spire_crown', { watch: DUSK }), ['cr_rootling']);
    const foe = f.combat.enemies[0]!;
    applyStatus(f.ctx, f.combat, null, foe, 'status_soaked');
    foe.hp = 3;
    expect(hazardsAtRound(f.ctx, f.combat).downed.map((c) => c.uid)).toEqual([foe.uid]);
  });
});

describe('watches at a place, and leaving it', () => {
  test('the Unmaking: 5 % of max HP a watch in the Null Orchard (the road in included), given back on arriving where it is not', () => {
    const ctx = scriptedCtx(at('loc_null_orchard'), [], pack, profile);
    const max = ctx.s.player.hpMax;
    advanceTime(ctx, 2);
    hazardPostStep(ctx);
    const loss = 2 * Math.round(0.05 * max);
    expect(ctx.s.player.hp).toBe(max - loss);
    expect(ctx.s.player.uses[`${HAZARD_LOST_KEY}unmaking`]).toEqual({ count: loss });
    const eye = scriptedCtx(ctx.s, [], pack, profile);
    apply({ teleport: 'loc_eye_of_the_scar' }, eye); // the Eye unmakes too: nothing back
    hazardPostStep(eye);
    expect(eye.s.player.hp).toBe(max - loss);
    const out = scriptedCtx(eye.s, [], pack, profile);
    apply({ teleport: 'loc_voidglass_gallery' }, out);
    hazardPostStep(out);
    expect(out.s.player.hp).toBe(max);
    expect(out.s.player.uses[`${HAZARD_LOST_KEY}unmaking`]).toBeUndefined();
  });

  test("the Thread Ring's wearer is not unmade; a fight the step started takes the loss on the player's snapshot", () => {
    const ring = scriptedCtx(at('loc_null_orchard', { items: [{ itemId: 'item_weavers_thread_ring', equip: true }] }), [], pack, profile);
    advanceTime(ring, 1);
    hazardPostStep(ring);
    expect(ring.s.player.hp).toBe(ring.s.player.hpMax);
    const { ctx, combat } = fight(at('loc_null_orchard'), ['cr_null_mouth']);
    const me = playerOf(combat);
    advanceTime(ctx, 1);
    hazardPostStep(ctx);
    expect([me.hpMax - me.hp, ctx.s.player.hpMax - ctx.s.player.hp]).toEqual([Math.round(0.05 * me.hpMax), 0]);
  });

  test('the Void-chill: more than two watches standing in the Hollow, and the next fight opens with Weaken for 1 turn', () => {
    const two = scriptedCtx(at('loc_voidscar_hollow'), [], pack, profile);
    advanceTime(two, 2);
    hazardPostStep(two);
    expect(two.s.player.uses[`${HAZARD_PENDING_KEY}status_weaken`]).toBeUndefined();
    const three = scriptedCtx(two.s, [], pack, profile);
    advanceTime(three, 1);
    hazardPostStep(three);
    expect(three.s.player.uses[`${HAZARD_PENDING_KEY}status_weaken`]).toEqual({ count: 1 });
    const f = opened(three.s, ['cr_rootling']);
    expect(findStatus(f.me, 'status_weaken')?.duration).toBe(1);
    expect(f.ctx.s.player.uses[`${HAZARD_PENDING_KEY}status_weaken`]).toBeUndefined();
    // moving resets the count
    const moved = scriptedCtx(two.s, [], pack, profile);
    apply({ teleport: 'loc_chasm_of_whispers' }, moved);
    hazardPostStep(moved);
    expect(moved.s.player.uses[HAZARD_STILL_KEY]).toBeUndefined();
  });

  test("the Pass's mirage paths: on the first visit a 25 % chance the chosen exit costs a watch more; never with echo_flickering_man", () => {
    const visited = (visitCount: number) => ({
      visited: true, visitCount, items: [], itemsSpawned: true, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
      unlockedExits: [], lockedExits: [], scattered: [] as string[], encounterHp: {},
    });
    const pass = (o: Overrides = {}, visits = 1) =>
      at('loc_shimmering_pass', { ...o, patch: (s) => void (s.world.locationStates.loc_shimmering_pass = visited(visits)) });
    const watches = (s: GameState, draws: number[]) => {
      const out = scriptedStep(s, { type: 'move', to: 'loc_aetherium_spires' }, [...draws, ...MANY], pack, profile);
      expect(out.rejected).toBeNull();
      return out.state.clock.ticks - s.clock.ticks;
    };
    expect(watches(pass(), [D.yes])).toBe(2);
    expect(watches(pass(), [D.no])).toBe(1);
    expect(watches(pass({ echoes: ['echo_flickering_man'] }), [D.yes])).toBe(1);
    expect(watches(pass({}, 2), [D.yes])).toBe(1);
  });
});
