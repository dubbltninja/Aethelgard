// U34e item 6 — anomalies (D-087, D-091 gap 4, D-097; DESIGN §6.6, WORLD §6.8, §10.2): the Unmade and WORLD §10.2's sixteen
// `cr_anomaly_*` variants on the real pack (region, Loop, base numbers, XP ×1.3, the guaranteed material), their spawn on an
// arrival that starts no fixed fight (the chance by loop and watch, the region and `when` filters, its own Rng stream), and
// each twist the engine reads, with scripted draws.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { validateContent } from '@content/validate';
import {
  ANOMALY_ENCOUNTER_ID,
  TAG_AGAIN,
  anomaliesAt,
  anomalyChance,
  applyHit,
  applyStatus,
  arrivalEncounter,
  beginCombat,
  evalCombatWhen,
  fixedHit,
  foreseesFor,
  generateIntent,
  hasStatus,
  phaseEvades,
  playerOf,
  refreshIntents,
  runCombat,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameState,
  type StepCtx,
} from '@engine/index';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';

const pack = buildContentPack();
const profile = freshProfile();
const WORLD = fs.readFileSync(path.join(path.resolve(import.meta.dirname, '../../../..'), 'docs/WORLD.md'), 'utf8');
type Overrides = Parameters<typeof makeState>[0];
const at = (o: Overrides = {}): GameState => makeState({ level: 12, ...o }, { content: pack, profile });
const MANY = Array.from({ length: 80 }, () => 0.5);
const spec = (creatureId: string, count = 1): EncounterSpec => ({
  id: 'enc_u34e_anomaly', groups: [{ creatureId, count }], fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [],
});
/** A fight with the player first by initiative (one d4 per combatant), then neutral draws. */
function fight(s: GameState, creatureId: string, count = 1): { ctx: StepCtx; combat: CombatState } {
  const ctx = scriptedCtx(s, [D.d4(4), ...Array.from({ length: count }, () => D.d4(1)), ...MANY], pack, profile);
  return { ctx, combat: beginCombat(ctx, spec(creatureId, count)) };
}
const def = (id: string) => {
  const c = pack.creatures[id];
  if (c === undefined) throw new Error(`no ${id}`);
  return c;
};

/** WORLD §10.2's table: id → region, base, loop. */
const TABLE = [...WORLD.slice(WORLD.indexOf('### 10.2 Anomaly variants'), WORLD.indexOf('### 10.3')).matchAll(/^\| `(cr_anomaly_[a-z_]+)` \| ([a-z_]+) \| `?(cr_[a-z_]+)`?(?: ×(\d))? \| [^|]+ \| (\d) \|$/gm)].map((m) => ({
  id: m[1] as string,
  region: `region_${m[2]}`,
  base: m[3] as string,
  count: Number(m[4] ?? 1),
  loop: Number(m[5]),
}));

describe('the records (WORLD §6.8, §10.2)', () => {
  test('sixteen variants, as WORLD §10.2: region, Loop, the base’s level and family, XP ×1.3 of the base, the guaranteed material only', () => {
    expect(TABLE.length).toBe(16);
    const variants = Object.values(pack.creatures).filter((c) => c.id.startsWith('cr_anomaly_'));
    expect(variants.map((c) => c.id).sort()).toEqual(TABLE.map((r) => r.id).sort());
    for (const row of TABLE) {
      const c = def(row.id);
      const base = def(row.base);
      // the Rootbound Pack is the three Rootlings as one combatant (one HP pool): ×3 HP, XP, gold; the others field `count`
      const pooled = row.id === 'cr_anomaly_rootbound_pack' ? row.count : 1;
      expect([row.id, c.role, c.anomaly?.region, c.anomaly?.loop, c.anomaly?.count ?? 1]).toEqual([row.id, 'anomaly', row.region, row.loop, row.count / pooled]);
      expect([row.id, c.level, c.family, c.stats.hp]).toEqual([row.id, base.level, base.family, base.stats.hp * pooled]);
      expect([row.id, c.xp]).toEqual([row.id, Math.round(base.xp * pooled * 1.3)]);
      expect([row.id, c.loot]).toEqual([row.id, [{ itemId: 'mat_frayed_moment', chance: 1, count: 1 }]]);
      expect([row.id, c.gold]).toEqual([row.id, { min: base.gold.min * pooled, max: base.gold.max * pooled }]);
      expect([row.id, c.tags.includes('anomaly'), c.bestiary.voice]).toEqual([row.id, true, 'wayfinder_notes']);
    }
  });

  test('the Unmade as WORLD §6.8 writes it: L13, Loop 3+ (its placements say so), HP 160 · ATK 24 · DEF 0/6 · AGI 7, XP 425', () => {
    const u = def('cr_unmade');
    expect([u.role, u.level, u.xp, u.family, u.anomaly]).toEqual(['anomaly', 13, 425, 'fam_unravelled', undefined]);
    expect(u.stats).toEqual({ hp: 160, atk: 24, sp: 24, armor: 0, ward: 6, agi: 7 });
    expect(u.resistances).toEqual({ ley: 'weak', chrono: 'resist', void: 'resist' });
    expect(Object.keys(u.moves)).toEqual(['unmade_undo', 'unmade_erase', 'unmade_absence']);
    expect(u.loot.map((l) => [l.itemId, l.chance])).toEqual([['mat_frayed_moment', 1], ['mat_breach_glass', 0.5], ['mat_shadow_ash', 0.3]]);
    expect(u.gold).toEqual({ min: 29, max: 45 });
    // the Depths (exploited) and the Scriptorium place it from Loop 3
    const placed = Object.values(pack.locations).filter((l) => l.encounters.some((e) => e.groups.some((g) => g.creatureId === 'cr_unmade'))).map((l) => l.id);
    expect(placed.sort()).toEqual(['loc_heartstone_depths', 'loc_sunken_scriptorium']);
  });

  test('the validator counts WORLD §6’s 57 creatures and the 16 variants apart; no creature reference is pending', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    const issues = [...report.errors, ...report.warnings];
    expect(report.errors).toEqual([]);
    expect(issues.filter((i) => i.rule === 'rule-21' && i.table === 'creatures')).toEqual([]);
    expect(Object.keys(pack.creatures).length).toBe(57 + 16);
    expect(issues.filter((i) => /'cr_[a-z_]+' not found/.test(i.message))).toEqual([]);
  });
});

describe('the spawn (DESIGN §6.6)', () => {
  test('the chance: none in Loop 1, then 10 % + 5 %·(loop − 1) capped at 30 %, +10 % at night (DESIGN §10.1)', () => {
    const chance = (loop: number, watch: 0 | 1 | 2 | 3 = 1) => anomalyChance(at({ loop, watch }), pack);
    expect([1, 2, 3, 5, 6, 9].map((l) => Math.round(chance(l) * 100))).toEqual([0, 15, 20, 30, 30, 30]);
    expect([chance(1, 3), chance(2, 3), chance(6, 3)].map((x) => Math.round(x * 100))).toEqual([0, 25, 40]);
  });

  test('what can spawn: the region’s variants from their Loop, while their `when` holds (the Nexus pair, the First Bell hound)', () => {
    const ids = (locationId: string, o: Overrides = {}) => {
      const s = at({ locationId, ...o });
      return anomaliesAt(scriptedCtx(s, [], pack, profile), pack.locations[locationId]!).map((c) => c.id).sort();
    };
    expect(ids('loc_voidscar_hollow', { loop: 2 })).toEqual(['cr_anomaly_phase_stalker']);
    expect(ids('loc_voidscar_hollow', { loop: 3 })).toEqual(['cr_anomaly_phase_stalker', 'cr_anomaly_tethered_stalkers']);
    expect(ids('loc_veridian_glowlands', { loop: 3 })).toEqual(['cr_anomaly_late_mireling']);
    expect(ids('loc_chronos_nexus', { loop: 3 })).toEqual(['cr_anomaly_aberration_pair', 'cr_anomaly_late_mireling']);
    expect(ids('loc_outer_walks', { loop: 2 })).toEqual([]); // no First Bell (the Before is not running)
    expect(ids('loc_whispering_ruins', { loop: 2 })).toEqual(['cr_anomaly_echoed_shade', 'cr_anomaly_split_wisp']);
  });

  test('an arrival that starts no fixed fight rolls it, on its own stream: ≈ 15 % in Loop 2, never in Loop 1, nothing on a retreat', () => {
    const roll = (loop: number, seed: string, via: 'move' | 'retreat' = 'move') => {
      const cleared = pack.locations.loc_voidscar_hollow!.encounters.map((e) => e.id); // its fixed fights are behind it
      const s = at({
        loop,
        seed,
        locationId: 'loc_voidscar_hollow',
        patch: (st) => {
          st.counters.travels = 7;
          st.world.locationStates.loc_voidscar_hollow = {
            visited: true, visitCount: 2, items: [], itemsSpawned: true, encountersCleared: cleared, encounterClearedDay: {}, eventsFired: [], flags: {},
            unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
          };
        },
      });
      const ctx = scriptedCtx(s, Array.from({ length: 20 }, () => D.no), pack, profile); // the wandering pool never rolls
      const out = arrivalEncounter(ctx, { locationId: 'loc_voidscar_hollow', via, firstVisit: false });
      return { out };
    };
    const N = 300;
    const loop2 = Array.from({ length: N }, (_, i) => roll(2, `anomaly-${i}`));
    const hits = loop2.filter((r) => r.out?.id === ANOMALY_ENCOUNTER_ID);
    expect(Math.abs(hits.length / N - 0.15)).toBeLessThan(0.06);
    for (const r of hits) expect(r.out?.groups).toEqual([{ creatureId: 'cr_anomaly_phase_stalker', count: 1 }]);
    expect(loop2.every((r) => r.out === null || r.out.id === ANOMALY_ENCOUNTER_ID)).toBe(true);
    expect(Array.from({ length: 60 }, (_, i) => roll(1, `anomaly-${i}`).out?.id ?? null).every((id) => id !== ANOMALY_ENCOUNTER_ID)).toBe(true);
    // the same seed spawns the same way; a retreat rolls nothing
    expect(roll(2, 'anomaly-3').out).toEqual(roll(2, 'anomaly-3').out);
    expect(hits.length).toBeGreaterThan(0);
    const seedHit = loop2.findIndex((r) => r.out?.id === ANOMALY_ENCOUNTER_ID);
    expect(roll(2, `anomaly-${seedHit}`, 'retreat').out?.id ?? null).not.toBe(ANOMALY_ENCOUNTER_ID);
  });
});

describe('the twists', () => {
  test('the Frayed Brute: Hasted from the opening and again each of its turns; it telegraphs two intents (the base does not)', () => {
    const { ctx, combat } = fight(at(), 'cr_anomaly_frayed_brute');
    runCombat(ctx);
    const brute = (ctx.s.combat as CombatState).enemies[0]!;
    expect(hasStatus(brute, 'status_haste')).toBe(true);
    expect(foreseesFor(pack, combat, brute)).toBe(true);
    const plain = fight(at(), 'cr_wildling_brute');
    expect(foreseesFor(pack, plain.combat, plain.combat.enemies[0]!)).toBe(false);
  });

  test('the Phase Stalker: a Phase stops a single hit, but Void still lands (the base’s Phase stops Void too)', () => {
    const phased = (id: string): Combatant => {
      const { ctx, combat } = fight(at(), id);
      const e = combat.enemies[0]!;
      applyStatus(ctx, combat, null, e, 'status_phase');
      return e;
    };
    const voidHit = { aoe: false, type: 'void' } as const;
    expect(phaseEvades(phased('cr_anomaly_phase_stalker'), voidHit, pack)).toBe(false);
    expect(phaseEvades(phased('cr_anomaly_phase_stalker'), { aoe: false, type: 'physical' }, pack)).toBe(true);
    expect(phaseEvades(phased('cr_void_touched_stalker'), voidHit, pack)).toBe(true);
    // its even turns Phase it as it bites
    expect(def('cr_anomaly_phase_stalker').moves.phase_half_here?.statuses.some((r) => r.status === 'status_phase' && r.target === 'self')).toBe(true);
  });

  test('the Tethered Stalkers: half of each blow (rounded down) crosses to the living twin; one alone takes it all', () => {
    const { ctx, combat } = fight(at(), 'cr_anomaly_tethered_stalkers', 2);
    const me = playerOf(combat);
    const [a, b] = combat.enemies as [Combatant, Combatant];
    const hit = { source: 'basic', type: 'physical', base: 0, coef: 1, stat: 'atk' } as const;
    applyHit(ctx, combat, me, a, hit, fixedHit(21, false, []), 'basic');
    expect([a.hpMax - a.hp, b.hpMax - b.hp]).toEqual([11, 10]);
    b.hp = 4;
    applyHit(ctx, combat, me, a, hit, fixedHit(10, false, []), 'basic');
    expect([a.hpMax - a.hp, b.alive]).toEqual([16, false]); // the twin fell through the tether
    applyHit(ctx, combat, me, a, hit, fixedHit(10, false, []), 'basic');
    expect(a.hpMax - a.hp).toBe(26);
  });

  test('the Paired Aberrations share one Rewind: once one has rewound, the other cannot', () => {
    const { ctx, combat } = fight(at(), 'cr_anomaly_aberration_pair', 2);
    const [a, b] = combat.enemies as [Combatant, Combatant];
    for (const e of [a, b]) e.hp = Math.floor(0.4 * e.hpMax);
    expect(generateIntent(ctx, combat, a)?.moveId).toBe('aberration_rewind');
    expect(generateIntent(ctx, combat, b)?.moveId).not.toBe('aberration_rewind');
    // the base Aberrations each have their own
    const base = fight(at(), 'cr_temporal_aberration', 2);
    const [x, y] = base.combat.enemies as [Combatant, Combatant];
    for (const e of [x, y]) e.hp = Math.floor(0.4 * e.hpMax);
    expect([generateIntent(base.ctx, base.combat, x)?.moveId, generateIntent(base.ctx, base.combat, y)?.moveId]).toEqual(['aberration_rewind', 'aberration_rewind']);
  });

  test('the One Herd: three jackals on one initiative (whatever each rolled)', () => {
    const s = at();
    const ctx = scriptedCtx(s, [D.d4(4), D.d4(1), D.d4(4), D.d4(2), ...MANY], pack, profile);
    const combat = beginCombat(ctx, spec('cr_anomaly_one_herd', 3));
    expect(new Set(combat.enemies.map((e) => e.initiative)).size).toBe(1);
    const base = beginCombat(scriptedCtx(s, [D.d4(4), D.d4(1), D.d4(4), D.d4(2), ...MANY], pack, profile), spec('cr_salt_jackal', 3));
    expect(new Set(base.enemies.map((e) => e.initiative)).size).toBeGreaterThan(1);
  });

  test('the Unlit Lantern: its intents hidden until it takes damage; then they show (the base’s never hide)', () => {
    const { ctx, combat } = fight(at(), 'cr_anomaly_unlit_lantern');
    const lantern = combat.enemies[0]!;
    expect(generateIntent(ctx, combat, lantern)?.hidden).toBe(true);
    refreshIntents(ctx, combat);
    expect(combat.intents[lantern.uid]?.hidden).toBe(true); // not even right before it acts
    lantern.hp -= 1;
    refreshIntents(ctx, combat);
    expect(combat.intents[lantern.uid]?.hidden).toBe(false);
    expect(generateIntent(ctx, combat, lantern)?.hidden).toBe(false);
    const plain = fight(at(), 'cr_hollow_lantern');
    expect(generateIntent(plain.ctx, plain.combat, plain.combat.enemies[0]!)?.hidden).toBe(false);
  });

  test('the Echoed Shade repeats; the Split Wisp splits at half; the Doubled Phantom calls its past self; the Late Mireling is late', () => {
    const shade = fight(at(), 'cr_anomaly_echoed_shade');
    const s = shade.combat.enemies[0]!;
    expect(generateIntent(shade.ctx, shade.combat, s)?.moveId).toBe('shade_rake');
    s.pattern.pointer = 1;
    s.pattern.firedOnce.push('prev:shade_rake');
    const again = generateIntent(shade.ctx, shade.combat, s);
    expect([again?.moveId, again?.tags.includes(TAG_AGAIN)]).toEqual(['shade_rake', true]);
    expect(def('cr_anomaly_split_wisp').hpLines).toEqual([{ below: 0.5, move: 'split_wisp_split' }]);
    expect(def('cr_anomaly_split_wisp').moves.split_wisp_split?.summon).toEqual({ creatureId: 'cr_arcane_wisp', count: 1, max: 1, hpPct: 0.4 });
    const phantom = fight(at(), 'cr_anomaly_doubled_phantom');
    expect(generateIntent(phantom.ctx, phantom.combat, phantom.combat.enemies[0]!)?.moveId).toBe('doubled_past_self');
    expect(def('cr_anomaly_doubled_phantom').moves.doubled_past_self?.summon).toMatchObject({ creatureId: 'cr_shimmering_phantom', hpPct: 0.5 });
    const late = fight(at(), 'cr_anomaly_late_mireling');
    expect(generateIntent(late.ctx, late.combat, late.combat.enemies[0]!)?.moveId).toBe('late_not_yet');
    expect(Object.values(def('cr_anomaly_late_mireling').moves).filter((m) => m.power).map((m) => m.power?.hits)).toEqual([2, 2]);
  });

  test('the Rootbound Pack strikes three times a turn; the Seeding Toad seeds a Drift with every move; the Still Kite cuts twice at dawn', () => {
    expect(Object.values(def('cr_anomaly_rootbound_pack').moves).map((m) => m.power?.hits)).toEqual([3, 3]);
    expect(Object.values(def('cr_anomaly_seeding_toad').moves).every((m) => m.summon?.creatureId === 'cr_spore_drift' && m.summon.max === 2)).toBe(true);
    const kite = def('cr_anomaly_still_kite');
    expect([kite.tags.includes('skyborn'), kite.moves.still_cut?.power?.hits]).toEqual([false, 2]);
    const dawn = fight(at({ watch: 0 }), 'cr_anomaly_still_kite');
    const k = dawn.combat.enemies[0]!;
    k.pattern.turnsTaken = 1; // past its opening Tether
    expect(generateIntent(dawn.ctx, dawn.combat, k)?.moveId).toBe('still_cut');
    const day = fight(at({ watch: 1 }), 'cr_anomaly_still_kite');
    day.combat.enemies[0]!.pattern.turnsTaken = 1;
    expect(generateIntent(day.ctx, day.combat, day.combat.enemies[0]!)?.moveId).toBe('kite_slice');
  });

  test('the Unfiled Archivist rewinds its most wounded ally instead of attacking', () => {
    const { ctx, combat } = fight(at(), 'cr_anomaly_unfiled_archivist', 2);
    const [a, b] = combat.enemies as [Combatant, Combatant];
    expect(generateIntent(ctx, combat, a)?.moveId).not.toBe('unfiled_unfile');
    b.hp = Math.floor(0.5 * b.hpMax);
    const intent = generateIntent(ctx, combat, a);
    expect([intent?.moveId, intent?.targetUid]).toEqual(['unfiled_unfile', b.uid]);
    expect(evalCombatWhen(ctx, combat, { allyBelow: 0.75 }, { self: a, target: null, turn: 1, round: 1 })).toBe(true);
  });
});
