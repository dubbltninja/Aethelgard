// U26b: every DESIGN §5 class ability is either fully expressed by its data fields or scripted by id (the completeness
// test, over the 75 rows read from DESIGN.md itself), one representative cast of each through the real reducer, and the
// behavior of every scripted row (DESIGN §5.2–5.6; D-078) — plus affix_of_echoes (§7.3), a boss phase's onEnter area move
// (§4.10) and ground loot expiring at the next dawn (§7.8).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { SCRIPTED_ABILITIES } from '@schema/ability';
import type { Ability } from '@schema/ability';
import { CreatureSchema } from '@schema/creature';
import {
  ABILITY_SCRIPTS,
  BUFFS,
  BUFF_KEY,
  FREE_CAST_TAG,
  LEFT_ON_GROUND,
  NEXT_CRIT_TAG,
  abilitySpec,
  applyStatus,
  beginCombat,
  critChanceOf,
  currentActor,
  dealtMultOf,
  effectiveResistance,
  expireGroundLoot,
  findStatus,
  hitChanceOf,
  locationState,
  placeLoot,
  legalActions,
  playerOf,
  runCombat,
  step,
  type Action,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState, play, type StateOverrides } from '@tests/fixtures/helpers';
import { D, DUELIST, QUAKE, combatPack, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';

const content = combatPack();
const profile = freshProfile();
const ROOT = path.resolve(import.meta.dirname, '../../../..');
const ILYRA = { id: 'ilyra', recruited: true, loyalty: 0, hp: 80, hpMax: 80, ko: false, dead: false, stance: 'guarded' as const, cooldowns: {}, waitingAt: null, arcFlags: {} };

const state = (o: StateOverrides = {}): GameState => makeState(o, { content });
const withIlyra = (o: StateOverrides = {}): GameState =>
  state({ ...o, patch: (st) => void ((st.companions.recruited.ilyra = { ...ILYRA }), (st.companions.activeId = 'ilyra'), o.patch?.(st)) });
const spec = (groups: EncounterSpec['groups'], over: Partial<EncounterSpec> = {}): EncounterSpec => ({
  id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [], ...over,
});
type Groups = EncounterSpec['groups'];
const one = (creatureId: string, count = 1): Groups => [{ creatureId, count }];

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });
/** A hit with variance `v` and no crit; a crit; a miss. */
const HIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(99)];
const CRIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(0)];
const MISS = [D.pct(99)];

/** A fight at the player's first turn: the player first (d4 4), the companion next (d4 3), every enemy last (d4 1). */
function fight(s: GameState, groups: Groups, opts: { keepIntents?: boolean } = {}): GameState {
  const companion = s.companions.activeId !== null;
  const draws = [D.d4(4), ...(companion ? [D.d4(3)] : []), ...groups.flatMap((g) => Array.from({ length: g.count }, () => D.d4(1)))];
  const ctx = scriptedCtx(s, draws, content, profile);
  beginCombat(ctx, spec(groups));
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  if (!opts.keepIntents) (ctx.s.combat as CombatState).intents = {};
  return ctx.s;
}

function patched(s: GameState, edit: (c: CombatState, s: GameState) => void): GameState {
  const out = clone(s);
  edit(out.combat as CombatState, out);
  return out;
}
/** The enemies hold still on their next turn. */
const quiet = (s: GameState): GameState => patched(s, (c) => void (c.intents = {}));
const enemy = (s: GameState, i = 0): Combatant => (s.combat as CombatState).enemies[i] as Combatant;
const me = (s: GameState): Combatant => playerOf(s.combat as CombatState);
const ally = (s: GameState): Combatant => (s.combat as CombatState).party[1] as Combatant;
function act(s: GameState, action: Action, draws: readonly number[] = []) {
  const out = scriptedStep(s, action, draws, content, profile);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}
const rejected = (s: GameState, action: Action): string | null => scriptedStep(s, action, [], content, profile).rejected;
const ability = (abilityId: string, targetUid?: string): Action => (targetUid === undefined ? { type: 'ability', abilityId } : { type: 'ability', abilityId, targetUid });
const dealt = (events: readonly GameEvent[]) => ofType(events, 'damageDealt').map((e) => [e.refId, e.amount]);
const gains = (events: readonly GameEvent[]) => ofType(events, 'resourceGained').map((e) => [e.reason, e.amount]);
const buffLeft = (c: Combatant, id: string): number | undefined => c.cooldowns[`${BUFF_KEY}${id}`];
const GUARD: Action = { type: 'guard' };

// ---- DESIGN §5, read from the document -------------------------------------------------------------------------------------

interface DesignRow {
  id: string;
  branch: string;
  tier: number;
  mp: number;
  target: string;
  type: string;
  power: string;
  status: string;
  cd: number;
}

/** Every class ability row of DESIGN §5.2–5.6 (the `| \`rgr_…\` |` table lines). */
function designRows(): DesignRow[] {
  const text = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
  const section = text.slice(text.indexOf('## 5. Classes and ability trees'), text.indexOf('### 5.7 Basic attacks'));
  const rows: DesignRow[] = [];
  for (const line of section.split('\n')) {
    if (!/^\| `(rgr|wiz|elf|wrd|wvr)_/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    const [id = '', , branch = '', tier = '', mp = '', target = '', type = '', power = '', status = '', cd = ''] = cells;
    rows.push({
      id: id.replace(/`/g, ''),
      branch: branch.toLowerCase().replace(/ /g, '_'),
      tier: Number(tier),
      mp: Number(mp),
      target,
      type,
      power,
      status,
      cd: cd === '—' ? 0 : Number(cd),
    });
  }
  return rows;
}

const ROWS = designRows();
const TARGETS: Readonly<Record<string, Ability['target']>> = { single: 'enemy', self: 'self', 'self/ally': 'self_or_ally', all: 'all_enemies', party: 'party' };
const DAMAGE_TYPES = ['physical', 'fire', 'storm', 'ley', 'void', 'chrono'];
/** Statuses a special applies (specials.ts): the row may name them without a status row. */
const SPECIAL_STATUS: Readonly<Record<string, string>> = { rewind: 'status_rewind', phase: 'status_phase', taunt: 'status_taunt' };

/**
 * What each scripted row needs a script for: the DESIGN clause no field or special can say. Every other row is expressed
 * by its data fields (power, bonuses, statuses with `when`, heal, shield, selfCost, onKill, interrupt, cooldown) and
 * the 15 specials, with the generic status and interplay rules (Temporal Drag's "removes Haste" is interplay 6, Chain
 * Tempest's ×1.25 vs Shocked is Shock's own +25 % Storm, Feast of Moments' 60 % and overheal Shield are the drain
 * special's constants).
 */
const SCRIPTED: Readonly<Record<string, string>> = {
  rgr_hunters_eye: '+20 crit, crit ×1.75 for 3 turns',
  rgr_venom_coat: 'attacks and Hunt/Steel abilities apply Poison for 3 turns',
  rgr_field_dressing: 'removes Bleed and Poison',
  rgr_smoke_bomb: 'your next flee auto-succeeds',
  rgr_exsanguinate: 'consume all Bleed: 2× the remaining tick total',
  rgr_apex_predator: 'DoTs you applied tick twice; Focus generation ×2',
  wiz_cinder_shield: 'melee attackers take 0.5·SP Fire and Burn 50%, 3',
  wiz_skyfall: 'if Soaked: forks to all enemies at 50%',
  elf_dancers_guard: '+25 evasion; each dodge grants +5 extra MP',
  elf_flurry: 'a crit adds a 4th hit (max one)',
  elf_crescendo: '+15% per Bladesong ability used earlier this fight (cap +60%)',
  elf_final_verse: 'last hit guaranteed crit',
  elf_heart_of_the_grove: 'Ley damage dealt +30%',
  elf_shadowstep: 'your next attack is a guaranteed crit',
  elf_blink_strike: 'you act first next round',
  elf_veilwalk: 'removes Mark/Taunt; next flee auto-succeeds',
  elf_moment_between: 'take a second full action immediately (cannot chain itself)',
  wrd_iron_guard: 'Guard at 65%; +12 Grit; companion takes −25% this round',
  wrd_unbroken: 'no single hit may exceed 25% of max HP; immune to Stun and Slow',
  wrd_last_bastion: 'revive a KO\'d companion at 40% (or heal 30%); reflect 25% of damage taken',
  wrd_crushing_blow: 'accuracy −5',
  wrd_mountainfall: 'you cannot Guard next turn',
  wrd_steady_breath: 'removes one negative status, first found in that order',
  wrd_null_plate: 'one resistance step against Fire, Storm, Ley, Void, Chrono',
  wrd_spellbreaker: 'if the intent is non-Physical, interrupt it and gain 10 Grit',
  wrd_oathbound: 'both immune to new statuses for 1 turn',
  wrd_iron_silence: 'dispel Shield, Regen, Haste, Rewind, Phase; self immune to Fire/Storm/Ley/Void/Chrono',
  wvr_doom_sigil: 'after 3 of the target\'s turns',
  wvr_ninefold_hex: 'each already-Cursed enemy deals 0.5·SP Void to every other enemy',
  wvr_leech_veil: '30% of damage the Shield absorbs heals you',
  wvr_soul_tether: '40% of all damage the target takes heals your party',
  wvr_breach_echo: 'your next Unmaking ability costs 0 MP',
  wvr_collapse: '+1% per 1% of your HP missing (cap +50%)',
  wvr_unravel: 'removes Shield/Regen/Rewind/Haste; ×1.5 if something was removed',
};

/** The first `a·STAT (+ b)` of a cell, with a leading "N hits ×". */
function formula(cell: string): { coef: number; stat: string; base: number; hits: number } | null {
  const m = /(?:(\d+) hits × )?`(?:(\d+(?:\.\d+)?) \+ )?(\d+(?:\.\d+)?)·(ATK|SP)(?: \+ (\d+(?:\.\d+)?))?`/.exec(cell);
  if (!m) return null;
  return { hits: Number(m[1] ?? 1), coef: Number(m[3]), stat: (m[4] ?? '').toLowerCase(), base: Number(m[5] ?? m[2] ?? 0) };
}

describe('every DESIGN §5 class ability is data or script (U26b completeness)', () => {
  test('DESIGN §5 has 75 class rows — 15 per class — and the fixture has every one, with its branch, tier, MP, cooldown and target', () => {
    expect(ROWS).toHaveLength(75);
    for (const prefix of ['rgr_', 'wiz_', 'elf_', 'wrd_', 'wvr_']) expect(ROWS.filter((r) => r.id.startsWith(prefix))).toHaveLength(15);
    const fixtureClassIds = Object.values(content.abilities).filter((a) => a.tier !== undefined).map((a) => a.id).sort();
    expect(fixtureClassIds).toEqual(ROWS.map((r) => r.id).sort());
    for (const r of ROWS) {
      const a = content.abilities[r.id] as Ability;
      // U81b2: DESIGN gave Piercing Arrow, Lightning Bolt and Flurry a 1-turn cooldown; the fixture keeps 0 (its traces, its scripts)
      const cd = ['rgr_piercing_arrow', 'wiz_lightning_bolt', 'elf_flurry'].includes(r.id) ? 0 : r.cd;
      expect([r.id, a.branch, a.tier, a.mp, a.cooldown, a.target]).toEqual([r.id, r.branch, r.tier, r.mp, cd, TARGETS[r.target]]);
    }
  });

  test('the data columns: damage type, power formula and hits, heal, Shield, self-cost, kill refund and every status the row names', () => {
    for (const r of ROWS) {
      const a = content.abilities[r.id] as Ability;
      const type = r.type.toLowerCase();
      if (DAMAGE_TYPES.includes(type)) expect([r.id, a.damageType]).toEqual([r.id, type as Ability['damageType']]);
      if (type === 'heal') expect([r.id, a.heal !== undefined]).toEqual([r.id, true]);
      const f = DAMAGE_TYPES.includes(type) && !r.power.startsWith('Shield') ? formula(r.power) : null;
      if (f && a.power) expect([r.id, a.power.coef, a.power.stat, a.power.base, a.power.hits]).toEqual([r.id, f.coef, f.stat as 'atk' | 'sp', f.base, f.hits]);
      if (f && !a.power) expect([r.id, 'spread']).toEqual([r.id, ABILITY_SCRIPTS[r.id]?.spread ? 'spread' : 'missing power']);
      const shield = /Shield `(?:(\d+) \+ )?(\d+(?:\.\d+)?)·(SP|ATK)(?: \+ (\d+))?`/.exec(r.power + r.status);
      if (shield) expect([r.id, a.shield?.base, a.shield?.coef, a.shield?.stat]).toEqual([r.id, Number(shield[1] ?? shield[4] ?? 0), Number(shield[2]), (shield[3] ?? '').toLowerCase() as 'sp' | 'atk']);
      const heal = type === 'heal' ? /`(\d+) \+ (\d+(?:\.\d+)?)·(SP|ATK|max\(STR,AGI\))`/.exec(r.power) : null;
      if (heal) expect([r.id, a.heal?.base, a.heal?.coef, a.heal?.stat]).toEqual([r.id, Number(heal[1]), Number(heal[2]), ({ SP: 'sp', ATK: 'atk' } as const)[heal[3] as 'SP' | 'ATK'] ?? 'maxStrAgi']);
      const pct = /costs (\d+)% (?:of your )?max HP/.exec(r.power + r.status);
      if (pct) expect([r.id, a.selfCost?.hpPctMax]).toEqual([r.id, Number(pct[1]) / 100]);
      if (/of \*\*current\*\* HP/.test(r.power)) expect([r.id, a.selfCost?.hpPctCur]).toEqual([r.id, 0.4]);
      const refund = /refunds (\d+) MP|and (\d+) MP/.exec(r.power);
      if (refund) expect([r.id, a.onKill?.refundMp]).toEqual([r.id, Number(refund[1] ?? refund[2])]);
      for (const m of (r.power + ' ' + r.status).matchAll(/`(status_[a-z_]+)`(?: (\d+)%)?(?:,? (\d+)(?![%·\d.]))?/g)) {
        const [, id = '', chance, turns] = m;
        const row = a.statuses.find((st) => st.status === id);
        const bySpecial = a.special !== undefined && SPECIAL_STATUS[a.special] === id;
        expect([r.id, id, row !== undefined || bySpecial]).toEqual([r.id, id, true]);
        if (row && chance !== undefined) expect([r.id, id, row.chance]).toEqual([r.id, id, Number(chance) / 100]);
        if (row && turns !== undefined) expect([r.id, id, row.duration]).toEqual([r.id, id, Number(turns)]);
      }
    }
  });

  test('the scripted rows are exactly ABILITY_SCRIPTS, mirrored by the content schema (SCRIPTED_ABILITIES); buffs have their numbers', () => {
    const designIds = new Set(ROWS.map((r) => r.id));
    for (const id of Object.keys(SCRIPTED)) expect([id, designIds.has(id)]).toEqual([id, true]);
    for (const r of ROWS) expect([r.id, ABILITY_SCRIPTS[r.id] !== undefined]).toEqual([r.id, SCRIPTED[r.id] !== undefined]);
    expect(Object.keys(ABILITY_SCRIPTS).sort()).toEqual(Object.keys(SCRIPTED).sort());
    expect([...SCRIPTED_ABILITIES].sort()).toEqual(Object.keys(ABILITY_SCRIPTS).sort());
    const buffed = Object.entries(ABILITY_SCRIPTS).filter(([, s]) => s.buff !== undefined).map(([id]) => id);
    expect(Object.keys(BUFFS).sort()).toEqual(buffed.sort());
    const header = fs.readFileSync(path.join(ROOT, 'src/engine/combat/abilities.ts'), 'utf8');
    expect(header).not.toContain('Not scripted');
  });

  test('one representative cast of each of the 75 through the real reducer: accepted, used, no throw', () => {
    const casts: string[] = [];
    for (const r of ROWS) {
      const classId = content.abilities[r.id]?.ownerId as string;
      const s = fight(withIlyra({ classId, level: 16, abilities: [r.id] }), one(DUELIST, 2));
      const a = content.abilities[r.id] as Ability;
      const action: Action = a.target === 'enemy' ? { type: 'ability', abilityId: r.id, targetUid: s.combat!.enemies[0]!.uid } : { type: 'ability', abilityId: r.id };
      const out = step(s, action, content, profile);
      expect([r.id, out.events.find((e) => e.t === 'actionRejected')]).toEqual([r.id, undefined]);
      expect([r.id, out.events.some((e) => e.t === 'abilityUsed' && e.abilityId === r.id)]).toEqual([r.id, true]);
      casts.push(r.id);
    }
    expect(casts).toHaveLength(75);
  });
});

// ---- the scripted rows, through the reducer ----------------------------------------------------------------------------------

describe('Ranger and Wizard scripts (DESIGN §5.2–5.3)', () => {
  test("Hunter's Eye: +20 crit and crits × 1.75 for 3 of the Ranger's turns (a buff on its own table), beside the foresight", () => {
    const s = fight(state({ abilities: ['rgr_hunters_eye'] }), one(DUELIST));
    const eye = act(s, ability('rgr_hunters_eye'));
    expect(buffLeft(me(eye.state), 'rgr_hunters_eye')).toBe(3);
    const basic = { source: 'basic', type: 'physical' as const, base: 0, coef: 1, stat: 'atk' as const };
    expect([critChanceOf(content, me(s), basic), critChanceOf(content, me(eye.state), basic)]).toEqual([9, 29]);
    // a crit roll of 28 (< 29): 14 × 1.75 = 24.5 − armor 1 = 23.5 → 24 (× 1.5 would be 20)
    const hit = act(quiet(eye.state), { type: 'attack', targetUid: enemy(s).uid }, [D.pct(0), D.variance(1), D.pct(28)]);
    expect(dealt(hit.events)).toEqual([[null, 24]]);
    expect(buffLeft(me(hit.state), 'rgr_hunters_eye')).toBe(2);
    let t = hit.state;
    for (let i = 0; i < 2; i++) t = act(quiet(t), GUARD).state;
    expect(buffLeft(me(t), 'rgr_hunters_eye')).toBeUndefined(); // gone after its third turn
    expect(critChanceOf(content, me(t), basic)).toBe(9);
    expect(ofType(act(quiet(eye.state), GUARD).events, 'resourceGained')).toEqual([{ t: 'resourceGained', uid: me(s).uid, amount: 5, reason: 'guard' }]);
  });

  test('Apex Predator: for 4 turns the DoTs the Ranger applied tick twice, and its Focus generation is doubled', () => {
    const s = patched(fight(state({ abilities: ['rgr_apex_predator'], mp: 20 }), one(DUELIST)), (c) => {
      c.enemies[0]!.statuses.push(status('status_bleed', { sourceUid: c.party[0]!.uid, tick: 3, duration: 3 }), status('status_poison', { tick: 2, duration: 3 }));
    });
    const apex = act(s, ability('rgr_apex_predator'));
    // the Duelist's turn: its Bleed (the Ranger's) ticks twice, the Poison of no one once
    expect(ofType(apex.events, 'statusTicked').map((e) => [e.statusId, e.amount])).toEqual([['status_bleed', 3], ['status_bleed', 3], ['status_poison', 2]]);
    expect(enemy(apex.state).hp).toBe(60 - 8);
    // a basic hit: +8 Focus, and 8 more at the end of the turn
    const hit = act(quiet(apex.state), { type: 'attack', targetUid: enemy(s).uid }, HIT());
    expect(gains(hit.events)).toEqual([['basic_hit', 8], ['rgr_apex_predator', 8]]);
    expect(me(hit.state).mp).toBe(20 - 20 + 16);
  });

  test("Apex Predator doubles Riposte Stance's counter Focus too (+16 per counter)", () => {
    const s = fight(state({ abilities: ['rgr_apex_predator', 'rgr_riposte_stance'], mp: 40 }), one(DUELIST));
    const apex = act(s, ability('rgr_apex_predator'));
    const out = act(patched(apex.state, (c) => void (c.party[0]!.mp = 20)), ability('rgr_riposte_stance'), [...HIT(), ...HIT(), ...HIT(), ...HIT()]);
    expect(gains(out.events)).toEqual([['counter:rgr_riposte_stance', 16], ['counter:rgr_riposte_stance', 16]]);
  });

  test("Cinder Shield: each Physical blow on the Wizard meets 0.5·SP Fire (cannot miss) and Burn 50 % — not a counter's", () => {
    const s = fight(state({ classId: 'wizard', abilities: ['wiz_cinder_shield'] }), one(DUELIST), { keepIntents: true });
    // Lunge × 2 into the 28 Shield; each answered: 0.5 × 12 = 6 − ward 1 = 5, then Burn (10 < 50, then 60 ≥ 50)
    const answer = (burn: number) => [D.variance(1), D.pct(99), D.pct(burn)];
    const out = act(s, ability('wiz_cinder_shield'), [...HIT(), ...answer(10), ...HIT(), ...answer(60)]);
    expect(dealt(out.events)).toEqual([['duel_lunge', 0], ['counter:wiz_cinder_shield', 5], ['duel_lunge', 0], ['counter:wiz_cinder_shield', 5]]);
    expect(findStatus(enemy(out.state), 'status_burn')).toMatchObject({ duration: 3 });
    expect(findStatus(me(out.state), 'status_shield')?.tick).toBe(28 - 10);
    expect(buffLeft(me(out.state), 'wiz_cinder_shield')).toBe(3);
  });

  test('Skyfall: on a Soaked target Stun 1 and a fork to every other enemy at × 0.5; on a dry one, neither', () => {
    const soaked = patched(fight(state({ classId: 'wizard', abilities: ['wiz_skyfall'] }), one(DUELIST, 2)), (c) => void c.enemies[0]!.statuses.push(status('status_soaked', { duration: 3 })));
    const out = act(soaked, ability('wiz_skyfall', enemy(soaked).uid), [...HIT(), ...HIT()]);
    // 2.6 × 12 + 8 = 39.2; × 1.5 Storm on Soaked − ward 1 = 57.8 → 58; the fork: 39.2 × 0.5 × 1.25 (Shocked by the spread) − 1 = 23.5 → 24
    expect(dealt(out.events)).toEqual([['wiz_skyfall', 58], ['wiz_skyfall', 24]]);
    const stunned = (events: readonly GameEvent[]) => ofType(events, 'statusApplied').filter((e) => e.statusId === 'status_stun').map((e) => e.targetUid);
    expect(stunned(out.events)).toEqual([enemy(soaked).uid]); // it loses its turn (and the Stun wears off at its end)
    expect(me(out.state).mp).toBe(72 - 27 + 3); // staff −10 %; +3 regen at its next turn
    const dry = fight(state({ classId: 'wizard', abilities: ['wiz_skyfall'] }), one(DUELIST, 2));
    const plain = act(dry, ability('wiz_skyfall', enemy(dry).uid), HIT());
    expect(dealt(plain.events)).toEqual([['wiz_skyfall', 38]]);
    expect(stunned(plain.events)).toEqual([]);
  });
});

describe('Elf scripts (DESIGN §5.4)', () => {
  test("Dancer's Guard: +25 evasion for 2 turns; each blow that misses pays +5 MP on top of the Elf's +10 dodge", () => {
    const s = fight(state({ classId: 'elf', abilities: ['elf_dancers_guard'], mp: 20 }), one(DUELIST), { keepIntents: true });
    const lunge = { source: 'duel_lunge', type: 'physical' as const, base: 0, coef: 0.5, stat: 'atk' as const };
    expect(hitChanceOf(content, enemy(s), me(s), lunge)).toBe(82);
    const out = act(s, ability('elf_dancers_guard'), [D.pct(60), D.pct(60)]); // 60 < 82 would hit; ≥ 57 misses
    expect(hitChanceOf(content, enemy(out.state), me(out.state), lunge)).toBe(57);
    expect(gains(out.events)).toEqual([['elf_dancers_guard', 5], ['dodge', 10], ['elf_dancers_guard', 5], ['dodge', 10]]);
    expect(me(out.state).mp).toBe(20 - 8 + 30);
    expect(buffLeft(me(out.state), 'elf_dancers_guard')).toBe(2);
  });

  test('Flurry: three hits; a crit adds a fourth, once', () => {
    const s = fight(state({ classId: 'elf', abilities: ['elf_flurry'] }), one(DUELIST));
    const target = enemy(s).uid;
    // 0.55 × 11 = 6.05 − 1 → 5; a crit 9.075 − 1 → 8
    expect(dealt(act(s, ability('elf_flurry', target), [...HIT(), ...HIT(), ...HIT()]).events)).toEqual([['elf_flurry', 5], ['elf_flurry', 5], ['elf_flurry', 5]]);
    expect(dealt(act(s, ability('elf_flurry', target), [...HIT(), ...CRIT(), ...HIT(), ...HIT()]).events)).toEqual([['elf_flurry', 5], ['elf_flurry', 8], ['elf_flurry', 5], ['elf_flurry', 5]]);
    expect(dealt(act(s, ability('elf_flurry', target), [...CRIT(), ...CRIT(), ...CRIT(), ...CRIT()]).events)).toHaveLength(4);
  });

  test('Crescendo: +15 % per distinct Bladesong ability used earlier this fight (itself included), at most +60 %', () => {
    const s = fight(state({ classId: 'elf', abilities: ['elf_crescendo', 'elf_twin_strike'], mp: 50 }), one(DUELIST, 2));
    // 0.8 × 11 = 8.8 − 1 → 8 on each
    const first = act(s, ability('elf_crescendo'), [...HIT(), ...HIT()]);
    expect(dealt(first.events)).toEqual([['elf_crescendo', 8], ['elf_crescendo', 8]]);
    expect(me(first.state).pattern.firedOnce).toContain('used:elf_crescendo');
    const twin = act(quiet(first.state), ability('elf_twin_strike', enemy(s).uid), [...HIT(), ...HIT()]);
    // Crescendo and Twin Strike before: × 1.3 → 11.44 − 1 → 10
    expect(dealt(act(quiet(twin.state), ability('elf_crescendo'), [...HIT(), ...HIT()]).events)).toEqual([['elf_crescendo', 10], ['elf_crescendo', 10]]);
    const all = patched(twin.state, (c) => {
      c.intents = {};
      c.party[0]!.pattern.firedOnce.push('used:elf_dancers_guard', 'used:elf_flurry', 'used:elf_final_verse', 'used:elf_ley_mend');
    });
    // five Bladesong verses = +75 %, capped at +60 % (Ley Mend is not Bladesong): 14.08 − 1 → 13
    expect(dealt(act(all, ability('elf_crescendo'), [...HIT(), ...HIT()]).events)).toEqual([['elf_crescendo', 13], ['elf_crescendo', 13]]);
  });

  test('Final Verse: five hits, the last a guaranteed crit (no crit roll); Haste on the Elf', () => {
    const s = fight(state({ classId: 'elf', abilities: ['elf_final_verse'] }), one(DUELIST));
    const out = act(s, ability('elf_final_verse', enemy(s).uid), [...HIT(), ...HIT(), ...HIT(), ...HIT(), D.pct(0), D.variance(1)]);
    // 0.5 × 11 = 5.5 − 1 = 4.5 → 5; the crit 8.25 − 1 = 7.25 → 7
    expect(dealt(out.events)).toEqual([['elf_final_verse', 5], ['elf_final_verse', 5], ['elf_final_verse', 5], ['elf_final_verse', 5], ['elf_final_verse', 7]]);
    expect(gains(out.events)).toEqual([['crit', 6]]);
    expect(findStatus(me(out.state), 'status_haste')).toBeDefined();
  });

  test('Heart of the Grove: Regen and Shield on both, and their Ley damage × 1.3 for 3 turns (Ilyra\'s dart: 10 × 1.3 − 1 = 12)', () => {
    const s = fight(withIlyra({ classId: 'elf', abilities: ['elf_heart_of_the_grove', 'elf_thornlash'] }), one(DUELIST));
    const out = act(s, ability('elf_heart_of_the_grove'), HIT()); // then Ilyra's own turn: her Ley Dart
    expect(dealt(out.events)).toEqual([['comp_ilyra_ley_dart', 12]]);
    for (const c of [me(out.state), ally(out.state)]) {
      expect([findStatus(c, 'status_regen')?.tick, findStatus(c, 'status_shield')?.tick]).toEqual([14, 31]); // 8 + 0.8 × 7; 20 + 1.5 × 7
      expect(dealtMultOf(c, 'ley')).toBe(1.3);
      expect(dealtMultOf(c, 'physical')).toBe(1);
    }
    // the Elf's Thornlash: (1.3 × 7 + 4) × 1.3 − 1 = 16.03 → 16 (12 without)
    const lash = act(quiet(out.state), ability('elf_thornlash', enemy(s).uid), [...HIT(), ...MISS]);
    expect(dealt(lash.events)[0]).toEqual(['elf_thornlash', 16]);
  });

  test("Shadowstep: Phase, and the Elf's next attack is a guaranteed crit — spent by its first hit", () => {
    const s = fight(state({ classId: 'elf', abilities: ['elf_shadowstep', 'elf_twin_strike'], mp: 20 }), one(DUELIST));
    const step1 = act(s, ability('elf_shadowstep'));
    expect(me(step1.state).pattern.firedOnce).toContain(NEXT_CRIT_TAG);
    // the first hit draws no crit roll: 7.15 × 1.5 − 1 → 10; the second rolls as usual: 6.15 → 6
    const out = act(quiet(step1.state), ability('elf_twin_strike', enemy(s).uid), [D.pct(0), D.variance(1), ...HIT()]);
    expect(dealt(out.events)).toEqual([['elf_twin_strike', 10], ['elf_twin_strike', 6]]);
    expect(me(out.state).pattern.firedOnce).not.toContain(NEXT_CRIT_TAG);
  });

  test('Blink Strike: Weaken, and the Elf acts first next round whatever the initiative; the round after, initiative again', () => {
    const s = patched(fight(state({ classId: 'elf', abilities: ['elf_blink_strike'] }), one(DUELIST)), (c) => void (c.enemies[0]!.initiative = 99));
    const out = act(s, ability('elf_blink_strike', enemy(s).uid), HIT());
    expect(findStatus(enemy(out.state), 'status_weaken')).toBeDefined();
    expect([out.state.combat!.round, out.state.combat!.turnOrder]).toEqual([2, [me(s).uid, enemy(s).uid]]);
    const next = act(quiet(out.state), GUARD, [...MISS, ...MISS]); // round 3: the Duelist first, its Lunge misses twice
    expect([next.state.combat!.round, next.state.combat!.turnOrder]).toEqual([3, [enemy(s).uid, me(s).uid]]);
  });

  test('The Moment Between: a second full action at once — one turn: no second tick, no cooldown or status lost; it cannot follow itself', () => {
    const s = patched(fight(state({ classId: 'elf', abilities: ['elf_moment_between', 'elf_twin_strike'], mp: 50 }), one(DUELIST)), (c) => {
      c.party[0]!.statuses.push(status('status_poison', { tick: 2, duration: 3 }), status('status_haste', { duration: 2 }));
      c.cooldowns.elf_shadowstep = 2;
    });
    const mb = act(s, ability('elf_moment_between'));
    const c1 = mb.state.combat!;
    expect([c1.phase, currentActor(c1)?.uid, c1.round]).toEqual(['playerTurn', me(s).uid, 1]);
    expect(ofType(mb.events, 'statusTicked')).toEqual([]);
    expect([findStatus(me(mb.state), 'status_poison')?.duration, findStatus(me(mb.state), 'status_haste')?.duration]).toEqual([3, 2]);
    expect(c1.cooldowns).toEqual({ elf_moment_between: 6, elf_shadowstep: 2 });
    expect(me(mb.state).pattern.turnsTaken).toBe(0);
    expect(legalActions(mb.state, content, profile).some((a) => a.type === 'ability' && a.abilityId === 'elf_moment_between')).toBe(false);
    expect(rejected(patched(mb.state, (c) => void delete c.cooldowns.elf_moment_between), ability('elf_moment_between'))).toBe('The Moment Between cannot follow itself');
    // the second action, then the round goes on: the Poison ticks once at the Elf's next turn; everything counted once
    const two = act(quiet(mb.state), ability('elf_twin_strike', enemy(s).uid), [...HIT(), ...HIT()]);
    expect(ofType(two.events, 'abilityUsed').map((e) => e.abilityId)).toEqual(['elf_twin_strike']);
    expect(ofType(two.events, 'statusTicked').map((e) => [e.statusId, e.amount])).toEqual([['status_poison', 2]]);
    expect([findStatus(me(two.state), 'status_poison')?.duration, findStatus(me(two.state), 'status_haste')?.duration]).toEqual([2, 1]);
    expect(two.state.combat!.cooldowns).toEqual({ elf_moment_between: 5, elf_shadowstep: 1 });
    expect([two.state.combat!.round, me(two.state).pattern.turnsTaken, me(two.state).cooldowns]).toEqual([2, 1, {}]);
  });
});

describe('Ironclad Warden scripts (DESIGN §5.5)', () => {
  const warden = (o: StateOverrides = {}) => state({ classId: 'ironclad_warden', ...o });
  const ilyraFirst = (s: GameState): GameState => patched(s, (c) => void (c.intents[c.enemies[0]!.uid]!.targetUid = c.party[1]!.uid));

  test("Iron Guard: the companion takes −25 % this round (0.5 × 10 × 0.75 − 1 → 3, not 4); it ends when the Warden's next turn begins", () => {
    const s = ilyraFirst(fight(withIlyra({ ...{ classId: 'ironclad_warden' }, abilities: ['wrd_iron_guard'] }), one(DUELIST), { keepIntents: true }));
    const out = act(s, ability('wrd_iron_guard'), [...MISS, ...HIT(), ...HIT()]); // Ilyra's dart misses; the Lunge on Ilyra
    expect(dealt(out.events)).toEqual([['duel_lunge', 3], ['duel_lunge', 3]]);
    expect(buffLeft(ally(out.state), 'wrd_iron_guard')).toBeUndefined();
    const bare = act(patched(s, (c) => void (c.party[0]!.mp = 0)), GUARD, [...MISS, ...HIT(), ...HIT()]);
    expect(dealt(bare.events)).toEqual([['duel_lunge', 4], ['duel_lunge', 4]]);
  });

  test('Crushing Blow: accuracy −5 on its hit (86 → 81)', () => {
    const s = fight(warden({ abilities: ['wrd_crushing_blow'] }), one(DUELIST));
    const blow = abilitySpec(content.abilities.wrd_crushing_blow!)!;
    expect(blow.accuracy).toBe(-5);
    expect([hitChanceOf(content, me(s), enemy(s), { ...blow, accuracy: 0 }), hitChanceOf(content, me(s), enemy(s), blow)]).toEqual([86, 81]);
    expect(dealt(act(s, ability('wrd_crushing_blow', enemy(s).uid), [D.pct(81)]).events)).toEqual([]); // 81 misses
  });

  test('Unbroken: for 2 turns no single hit takes more than 25 % of max HP (35 of 140); Stun and Slow cannot land', () => {
    const s = patched(fight(warden({ abilities: ['wrd_unbroken'] }), one(DUELIST), { keepIntents: true }), (c) => void (c.enemies[0]!.atk = 100));
    const out = act(s, ability('wrd_unbroken'), [...HIT(), ...HIT()]); // Lunge: 0.5 × 100 = 50 per hit
    expect(dealt(out.events)).toEqual([['duel_lunge', 35], ['duel_lunge', 35]]);
    const ctx = scriptedCtx(out.state, [], content, profile);
    const p = playerOf(ctx.s.combat!);
    expect(['status_stun', 'status_slow', 'status_weaken'].map((id) => applyStatus(ctx, ctx.s.combat!, null, p, id, { duration: 1 }).outcome)).toEqual(['immune', 'immune', 'applied']);
    const bare = act(patched(s, (c) => void (c.party[0]!.mp = 0)), GUARD, [...HIT(), ...HIT()]);
    expect(dealt(bare.events)).toEqual([['duel_lunge', 25], ['duel_lunge', 25]]); // Guarded 50 × 0.5, under the cap anyway
  });

  test('Null Plate: one resistance step against Fire, Storm, Ley, Void and Chrono for 3 turns — DoT ticks too (a Burn of 6 → 3)', () => {
    const s = patched(fight(warden({ abilities: ['wrd_null_plate'] }), one(DUELIST)), (c) => {
      c.party[0]!.resistances = { ley: 'weak' };
      c.party[0]!.statuses.push(status('status_burn', { tick: 6, duration: 3 }));
    });
    const out = act(s, ability('wrd_null_plate'));
    const p = me(out.state);
    expect(['fire', 'ley', 'chrono', 'physical'].map((t) => effectiveResistance(p, t as 'fire'))).toEqual(['resist', 'neutral', 'resist', 'neutral']);
    expect(ofType(out.events, 'statusTicked').map((e) => [e.statusId, e.amount])).toEqual([['status_burn', 3]]);
  });

  test('Iron Silence: Shield, Regen, Haste, Rewind and Phase dispelled from every enemy, Weaken 3 on all, the Warden immune to magic for 2 turns', () => {
    const buffs = ['status_shield', 'status_regen', 'status_haste', 'status_rewind', 'status_phase'];
    const s = patched(fight(warden({ abilities: ['wrd_iron_silence'] }), one(DUELIST, 2)), (c) => {
      for (const e of c.enemies) e.statuses.push(...buffs.map((id) => status(id, { tick: 5, snapshotHp: 60 })));
    });
    const out = act(s, ability('wrd_iron_silence'));
    for (const i of [0, 1]) expect(enemy(out.state, i).statuses.map((st) => st.statusId)).toEqual(['status_weaken']);
    expect(['void', 'chrono', 'physical'].map((t) => effectiveResistance(me(out.state), t as 'void'))).toEqual(['immune', 'immune', 'neutral']);
    expect(buffLeft(me(out.state), 'wrd_iron_silence')).toBe(2);
  });

  test("Last Bastion: a KO'd companion stands at 40 %, Shield on both, Taunt on all (+4 Grit each); 25 % of each blow (Shield included) goes back", () => {
    const s = patched(fight(withIlyra({ classId: 'ironclad_warden', abilities: ['wrd_last_bastion'] }), one(DUELIST), { keepIntents: true }), (c) => {
      Object.assign(c.party[1]!, { alive: false, hp: 0 });
    });
    // Ilyra (back up, her slot still to come) misses; the taunted Duelist's Lunge × 2 into the 56 Shield: 25 % of 5 → 1 back each
    const out = act(s, ability('wrd_last_bastion'), [...MISS, ...HIT(), ...HIT()]);
    expect([ally(out.state).alive, ally(out.state).hp]).toEqual([true, 32]);
    expect([findStatus(me(out.state), 'status_shield')?.tick, findStatus(ally(out.state), 'status_shield')?.tick]).toEqual([56 - 10, 56]);
    expect(findStatus(enemy(out.state), 'status_taunt')?.sourceUid).toBe(me(s).uid);
    expect(dealt(out.events)).toEqual([['duel_lunge', 0], ['counter:wrd_last_bastion', 1], ['duel_lunge', 0], ['counter:wrd_last_bastion', 1]]);
    expect(gains(out.events)[0]).toEqual(['taunt', 4]);
    expect(buffLeft(me(out.state), 'wrd_last_bastion')).toBe(2);
    // a standing companion heals 30 % of its max HP instead (24 of 80)
    const hurt = patched(s, (c) => void Object.assign(c.party[1]!, { alive: true, hp: 40 }));
    const healed = act(hurt, ability('wrd_last_bastion'), [...MISS, ...HIT(), ...HIT()]);
    expect(ofType(healed.events, 'healed').find((e) => e.source === 'wrd_last_bastion')).toEqual({ t: 'healed', targetUid: ally(s).uid, amount: 24, source: 'wrd_last_bastion' });
  });

  test('Mountainfall: Armor Break and Stun on a non-boss, a Stagger on a boss; the Warden cannot Guard on its next turn', () => {
    const s = fight(warden({ abilities: ['wrd_mountainfall'], mp: 40 }), one(DUELIST, 2));
    const out = act(s, ability('wrd_mountainfall', enemy(s).uid), HIT()); // 2.6 × 17 = 44.2 − 1 → 43
    expect(dealt(out.events)).toEqual([['wrd_mountainfall', 43]]);
    expect(ofType(out.events, 'statusApplied').map((e) => e.statusId)).toEqual(['status_armor_break', 'status_stun']);
    expect(legalActions(out.state, content, profile).some((a) => a.type === 'guard')).toBe(false);
    expect(rejected(out.state, GUARD)).toBe('You cannot guard now');
    const after = act(quiet(out.state), { type: 'attack', targetUid: enemy(s, 1).uid }, [...HIT(), D.pct(99)]); // the maul's 10 % Stun roll fails
    expect(legalActions(after.state, content, profile).some((a) => a.type === 'guard')).toBe(true);
    const boss = fight(warden({ abilities: ['wrd_mountainfall'], mp: 40 }), one(QUAKE), { keepIntents: true });
    const staggered = act(boss, ability('wrd_mountainfall', enemy(boss).uid), [...HIT(), ...MISS]);
    expect(ofType(staggered.events, 'statusApplied').map((e) => e.statusId)).toEqual(['status_armor_break']);
    expect(staggered.state.combat!.log.some((l) => l.text.includes('staggers'))).toBe(true);
  });

  test("Spellbreaker: a non-Physical intent is interrupted by the hit and pays 10 Grit; a Physical one is not", () => {
    const s = fight(warden({ abilities: ['wrd_spellbreaker'], mp: 20 }), one(DUELIST), { keepIntents: true });
    const leech = patched(s, (c) => void (c.intents[c.enemies[0]!.uid]!.moveId = 'duel_leech'));
    const out = act(leech, ability('wrd_spellbreaker', enemy(s).uid), [...HIT(), ...MISS, ...MISS]); // 18.7 − 1 → 18; then its next step, the Lunge, misses twice
    expect(dealt(out.events)).toEqual([['wrd_spellbreaker', 18]]);
    expect(gains(out.events)).toEqual([['wrd_spellbreaker', 10]]);
    const plain = act(s, ability('wrd_spellbreaker', enemy(s).uid), [...HIT(), ...MISS, ...MISS]);
    expect(gains(plain.events)).toEqual([]);
    expect(plain.state.combat!.log.some((l) => l.text.includes('interrupted'))).toBe(false);
  });

  test('Oathbound: every negative status leaves both, and for a turn no new one lands on them (a Shield still does)', () => {
    const s = patched(fight(withIlyra({ classId: 'ironclad_warden', abilities: ['wrd_oathbound'] }), one(DUELIST)), (c) => {
      c.party[0]!.statuses.push(status('status_weaken'), status('status_blind'));
      c.party[1]!.statuses.push(status('status_slow'));
    });
    const out = act(s, ability('wrd_oathbound'), MISS);
    expect([me(out.state).statuses, ally(out.state).statuses]).toEqual([[], []]);
    const ctx = scriptedCtx(out.state, [], content, profile);
    const [p, i] = ctx.s.combat!.party as [Combatant, Combatant];
    expect([applyStatus(ctx, ctx.s.combat!, null, p, 'status_weaken').outcome, applyStatus(ctx, ctx.s.combat!, null, p, 'status_shield', { amount: 10 }).outcome]).toEqual(['immune', 'applied']);
    // counted in each holder's turns (like a status): the Warden's lasts through its next turn; Ilyra's ended with hers
    expect([buffLeft(p, 'wrd_oathbound'), buffLeft(i, 'wrd_oathbound')]).toEqual([1, undefined]);
  });
});

describe('Shadow Weaver scripts (DESIGN §5.6)', () => {
  const weaver = (o: StateOverrides = {}) => state({ classId: 'shadow_weaver', ...o });

  test('Ninefold Hex: each already-Cursed enemy deals 0.5·SP Void to every other (cannot miss), then the four rows on all; 15 % max HP', () => {
    const s = patched(fight(weaver({ abilities: ['wvr_ninefold_hex'] }), one(DUELIST, 2)), (c) => void c.enemies[0]!.statuses.push(status('status_curse', { tick: 2, duration: 3 })));
    const out = act(s, ability('wvr_ninefold_hex'), [D.variance(1), D.pct(99)]); // 6 − ward 1 = 5 on the other Duelist
    expect(dealt(out.events)).toEqual([['wvr_ninefold_hex', 5]]);
    expect(ofType(out.events, 'attackResolved')).toEqual([{ t: 'attackResolved', sourceUid: me(s).uid, targetUid: enemy(s, 1).uid, hit: true, crit: false }]);
    for (const i of [0, 1]) expect(enemy(out.state, i).statuses.map((st) => st.statusId).sort()).toEqual(['status_armor_break', 'status_blind', 'status_curse', 'status_weaken']);
    expect(me(out.state).hp).toBe(102 - 15);
  });

  test('Leech Veil: a 1.2·SP + 8 Shield for 3 turns; 30 % of what it absorbs heals the Weaver (5 → 1.5 → 2 per blow)', () => {
    const s = patched(fight(weaver({ abilities: ['wvr_leech_veil'] }), one(DUELIST), { keepIntents: true }), (c) => void (c.party[0]!.hp = 50));
    const out = act(s, ability('wvr_leech_veil'), [...HIT(), ...HIT()]);
    expect(ofType(out.events, 'healed').map((e) => [e.source, e.amount])).toEqual([['wvr_leech_veil', 2], ['wvr_leech_veil', 2]]);
    expect([me(out.state).hp, findStatus(me(out.state), 'status_shield')?.tick]).toEqual([54, 22 - 10]);
  });

  test('Soul Tether: for 3 of the target\'s turns, 40 % of all damage it takes — hits and DoT ticks — heals the party, split evenly', () => {
    const s = patched(fight(withIlyra({ classId: 'shadow_weaver', abilities: ['wvr_soul_tether'] }), one(DUELIST)), (c) => {
      c.party[0]!.hp = 50;
      c.party[1]!.hp = 40;
      c.enemies[0]!.statuses.push(status('status_bleed', { tick: 4, duration: 3 }));
    });
    // the Tether's own hit (0.6 × 12 = 7.2 − 1 → 6) lands before it binds; Ilyra's dart: 9 × 0.4 / 2 = 1.8 → 2 each; the Bleed: 4 × 0.4 / 2 → 1 each
    const out = act(s, ability('wvr_soul_tether', enemy(s).uid), [...HIT(), ...HIT()]);
    expect(dealt(out.events)).toEqual([['wvr_soul_tether', 6], ['comp_ilyra_ley_dart', 9]]);
    expect(ofType(out.events, 'healed').map((e) => [e.targetUid, e.amount])).toEqual([[me(s).uid, 2], [ally(s).uid, 2], [me(s).uid, 1], [ally(s).uid, 1]]);
    expect(buffLeft(enemy(out.state), 'wvr_soul_tether')).toBe(2);
  });

  test('Breach Echo: Phase, and the next Unmaking ability costs no MP (its % HP self-cost stays); the one after pays', () => {
    const s = fight(weaver({ abilities: ['wvr_breach_echo', 'wvr_void_lance'] }), one(DUELIST));
    const echo = act(s, ability('wvr_breach_echo'));
    expect([me(echo.state).mp, me(echo.state).hp]).toEqual([68 - 10, 102 - 5]);
    expect(me(echo.state).pattern.firedOnce).toContain(`${FREE_CAST_TAG}unmaking`);
    const free = act(quiet(echo.state), ability('wvr_void_lance', enemy(s).uid), HIT());
    expect([me(free.state).mp, me(free.state).hp]).toEqual([58, 97 - 8]);
    expect(me(free.state).pattern.firedOnce).not.toContain(`${FREE_CAST_TAG}unmaking`);
    const paid = act(quiet(free.state), ability('wvr_void_lance', enemy(s).uid), HIT());
    expect(me(paid.state).mp).toBe(58 - 10);
  });
});

// ---- affix_of_echoes, the onEnter area move, ground loot -------------------------------------------------------------------------

describe('affix_of_echoes (DESIGN §7.3): +10 % kill XP, not stackable', () => {
  const echoes = { itemId: 'item_chronos_lens', equip: true, affixes: ['affix_of_echoes'] };
  const killXp = (o: StateOverrides): number => {
    const s = patched(fight(state(o), one(DUELIST)), (c) => void (c.enemies[0]!.hp = 1));
    const out = act(s, { type: 'attack', targetUid: enemy(s).uid }, HIT());
    return ofType(out.events, 'combatEnded')[0]?.xp ?? -1;
  };

  test('the Duelist (10 XP) pays 11 with the affix, still 11 with two, 10 without', () => {
    expect(killXp({})).toBe(10);
    expect(killXp({ items: [echoes] })).toBe(11);
    expect(killXp({ items: [echoes, { ...echoes, itemId: 'item_glyphbound_lantern' }] })).toBe(11);
  });
});

describe('a boss phase onEnter area move (DESIGN §4.10 "AoE"; U26b `areaMove`)', () => {
  test("the Quake's Breaking: crossing 50 % arms its Shockwave, which lands on every opponent at the next turn's start (its rows too)", () => {
    const s = patched(fight(state(), one(QUAKE), { keepIntents: true }), (c) => void (c.enemies[0]!.hp = 101));
    // the Ranger's 14 → 87 (< 100): Breaking; the Quake's turn opens with the Shockwave (0.5 × 10 → 5, Slow), then its Stomp misses
    const out = act(s, { type: 'attack', targetUid: enemy(s).uid }, [...HIT(), ...HIT(), ...MISS]);
    expect(ofType(out.events, 'bossPhase').map((e) => e.phase)).toEqual([1]);
    expect(dealt(out.events)).toEqual([[null, 14], ['quake_shockwave', 5]]);
    const order = out.events.map((e) => e.t);
    expect(order.indexOf('damageDealt', order.indexOf('turnStarted'))).toBeLessThan(order.lastIndexOf('attackResolved'));
    expect(findStatus(me(out.state), 'status_slow')).toBeDefined();
    expect(Object.keys(enemy(out.state).cooldowns).filter((k) => k.startsWith('area:'))).toEqual([]);
  });

  test('the schema: areaMove names one of the boss\'s own moves, and only in a phase\'s onEnter', () => {
    const quake = {
      id: 'cr_x_quake', name: 'X', description: 'X.', family: 'fam_wilds', role: 'boss', level: 6, fleeable: false,
      stats: { hp: 100, atk: 10, armor: 0, ward: 0, agi: 0 },
      moves: { stomp: { name: 'Stomp', line: 'Stomp.', type: 'physical', power: { coef: 1, stat: 'atk' } } },
      phases: [
        { id: 'p1', name: 'P1', pattern: [{ move: 'stomp', target: 'player' }] },
        { id: 'p2', name: 'P2', enterWhen: [{ hpBelow: 0.5 }], onEnter: [{ areaMove: 'stomp' }], pattern: [{ move: 'stomp', target: 'player' }] },
      ],
      gold: { min: 0, max: 0 }, xp: 1, bestiary: { voice: 'wayfinder_notes', summary: 'X.' }, sigil: { base: 'x' },
    };
    expect(CreatureSchema.safeParse(quake).success).toBe(true);
    const unknown = clone(quake);
    unknown.phases[1]!.onEnter = [{ areaMove: 'quake' }];
    expect(CreatureSchema.safeParse(unknown).error?.issues.map((i) => i.message)).toEqual(["areaMove references unknown move 'quake'"]);
    const inMove = { ...clone(quake), moves: { stomp: { ...quake.moves.stomp, effects: [{ areaMove: 'stomp' }] } } };
    expect(CreatureSchema.safeParse(inMove).error?.issues.map((i) => i.message)).toEqual(['`areaMove` belongs in a boss phase’s onEnter, not in a move (DESIGN §4.10)']);
  });
});

describe('ground loot expires at the next dawn (DESIGN §7.8)', () => {
  const full = { type: 'rest', kind: 'full' } as const;

  test('a drop lies here, marked with the day, until the next dawn; the node\'s own content items stay', () => {
    const amulet = { uid: 'iamulet', itemId: 'item_amulet_of_echoes', qty: 1, rarity: 'common' as const, affixes: [] };
    const s = makeState({
      watch: 1, // the fixture pack, at the Ruins, whose own Amulet lies there (spawned on entry, unmarked)
      patch: (st) => {
        st.world.locationStates[st.world.currentLocationId] = {
          visited: true, visitCount: 1, items: [amulet], itemsSpawned: true, encountersCleared: [], encounterClearedDay: {}, eventsFired: [], flags: {},
          unlockedExits: [], lockedExits: [], scattered: [], encounterHp: {},
        };
      },
    });
    const here = s.world.currentLocationId;
    const tonic = s.player.inventory.find((i) => i.itemId === 'item_ley_touched_tonic')!;
    const dropped = play(s, [{ type: 'drop', uid: tonic.uid }]).state;
    const ls = dropped.world.locationStates[here]!;
    expect(ls.items.map((i) => i.uid)).toContain(tonic.uid);
    expect(ls.flags[`${LEFT_ON_GROUND}${tonic.uid}`]).toBe(1);
    const own = ls.items.filter((i) => i.uid !== tonic.uid).map((i) => i.uid);
    expect(own).toEqual(['iamulet']);
    const slept = play(dropped, [full]);
    const after = slept.state.world.locationStates[here]!;
    expect(after.items.map((i) => i.uid)).toEqual(own);
    expect(Object.keys(after.flags).filter((k) => k.startsWith(LEFT_ON_GROUND))).toEqual([]);
    expect(ofType(slept.events, 'log').some((e) => e.text.includes('gone with the night'))).toBe(true);
  });

  test("a full pack's spoils are marked too; a dawn takes only what was left before its day (and drops stale marks)", () => {
    const rivets = Array.from({ length: 39 }, (_, i) => ({ uid: `r${i}`, itemId: 'mat_iron_rivet', qty: 99, rarity: 'common' as const, affixes: [] }));
    const ctx = scriptedCtx(state({ day: 3, patch: (st) => void st.player.inventory.push(...rivets) }), [], content, profile);
    const here = ctx.s.world.currentLocationId;
    const [ash] = placeLoot(ctx, here, 'mat_shadow_ash', 1, 'common', [], 'loot:test');
    const ls = locationState(ctx, here);
    expect(ls.flags[`${LEFT_ON_GROUND}${ash!.uid}`]).toBe(3);
    ls.items.push({ uid: 'iold', itemId: 'mat_shadow_ash', qty: 1, rarity: 'common', affixes: [] });
    Object.assign(ls.flags, { [`${LEFT_ON_GROUND}iold`]: 2, [`${LEFT_ON_GROUND}igone`]: 1 });
    expireGroundLoot(ctx, 3); // a dawn crossed earlier in the step that left the ash: the ash stays
    expect(ls.items.map((i) => i.uid)).toEqual([ash!.uid]);
    expect(Object.keys(ls.flags).filter((k) => k.startsWith(LEFT_ON_GROUND))).toEqual([`${LEFT_ON_GROUND}${ash!.uid}`]);
    expireGroundLoot(ctx, 4);
    expect([ls.items, ls.flags]).toEqual([[], {}]);
  });
});
