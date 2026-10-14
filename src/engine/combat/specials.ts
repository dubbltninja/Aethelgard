// Engine-coded hooks — "specials" (PLAN §5.4 Move.special, §5.7 Ability.special, §5.8 Status.special, §5.19 rule 3;
// D-072: the registry has 15 ids). A special names a scripted mechanic the declarative fields cannot express. The
// content schema keeps the list content may use (`src/content/schema/specials.ts`, which cannot import the engine);
// `SPECIALS` here is the engine's copy, in the same order — the mirror test (tests/unit/engine/combat/specials.test.ts)
// asserts the two lists and every id's scopes are equal. Adding a special = add it to both, in the same change.
//
// One entry per id (SPECIAL_HOOKS), each a set of hooks at fixed points of a resolution (combat/abilities.ts for an
// ability, combat/intents.ts `executeIntent` for a move):
//   before   before any hit (chain: was the target Soaked or Shocked when it was struck?)
//   hit      per hit, may rewrite the hit (mark_execute: a guaranteed crit against a Marked target)
//   replace  instead of the declarative resolution (hour_presses, bound_mage)
//   after    after the hits, status rows, heals and shields (the rest)
//   field    out of combat (trap: set at this node)
// Status-scope ids (rewind, phase, taunt) also name a status rule; that rule lives with the status in statuses.ts.
//
// This file also carries the rest of a move's U26 parts (D-077): the combat-scope `effects` (multiHit — the number of
// hits; stripBuffs; healOnDamage; D-069.9) and `riposte`, and the counter-hit reaction the reducer's `applyHit` calls
// after every hit (`reactToHit`: counter_stance while the holder Guards; a move's riposte).
//
// Timers live in cooldown tables (the player's: `CombatState.cooldowns`; anyone else's: `Combatant.cooldowns`), which
// count down at the end of the holder's turns (D-076 keeps Stun's recovery window there too): `counter:<id>`,
// `riposte:<move>`, `foresight`. A key set during the holder's own turn gets +1, so it lasts through the turns after it;
// the stances (counter, riposte, a stronger Guard) end when the holder's next turn begins (`expireStances`).
import type { Move, StatusApply } from '@schema/creature';
import type { SpecialId, SpecialScope } from '@schema/specials';
import type { StepCtx } from '../ctx';
import { locationState } from '../effects';
import type { ResourceEventName } from '../progression';
import type { Combatant, CombatState, DamageType } from '../types/state';
import { buffReactions } from './buffHooks';
import { resourceMultOf } from './buffs';
import { GUARD_VALUE_KEY, hasStatus, resolveHit, resolveTick, roundHalfUp, statusMods, type HitResult, type HitSpec, type ScaleStat } from './damage';
import { STATUS, applyStatus, applyStatusRows, cleanse, cooldownsOf, isBoss, isOwnTurn, removeStatus } from './statuses';
import { combatLog, isActive } from './turnOrder';

/** What a hit is, for events and counters (`damageDealt.kind`). */
export type HitKind = 'basic' | 'ability' | 'item' | 'intent';
/** The reducer's hit application (reducers/combat.ts `applyHit`), passed in to keep the import graph acyclic. */
export type HitApplierAny = (ctx: StepCtx, combat: CombatState, attacker: Combatant, target: Combatant, spec: HitSpec, result: HitResult, kind: HitKind) => void;

/** The reducer's operations the combat modules need (reducers/combat.ts builds it; passing it in avoids an import cycle). */
export interface CombatOps {
  applyHit: HitApplierAny;
  /** The player's class resource for one event (0 for anyone else). */
  gainResource: (ctx: StepCtx, combat: CombatState, c: Combatant, on: ResourceEventName) => number;
  /** MP for a party combatant, capped; emits `resourceGained`. */
  addMp: (ctx: StepCtx, combat: CombatState, c: Combatant, amount: number, reason: string) => number;
}

/** What one struck target took from a resolution. */
export interface Struck {
  target: Combatant;
  /** HP lost (after Shield and mitigation), summed over the hits. */
  amount: number;
  /** Down afterwards. */
  killed: boolean;
}

/** One use of an ability or a move, as the hooks see it. */
export interface SpecialUse {
  readonly ctx: StepCtx;
  readonly combat: CombatState;
  readonly ops: CombatOps;
  readonly user: Combatant;
  readonly scope: 'ability' | 'move';
  /** The ability or move id (also the hit's `source`). */
  readonly id: string;
  readonly kind: HitKind;
  /** The single target picked (null for an area or self use). */
  readonly primary: Combatant | null;
  /** Everyone the use resolves on: the struck opponents, or the user and its allies. */
  readonly recipients: readonly Combatant[];
  /** The hit's definition before per-target rewrites (null for a non-damaging use). */
  readonly spec: HitSpec | null;
  /** Filled before `after` runs (from the events since `from`). */
  struck: Struck[];
  /** HP paid on the cost (Blood price, % HP self-costs). */
  readonly hpPaid: number;
  /** `ctx.events.length` when the use began. */
  readonly from: number;
  /** Notes a hook leaves for its own later stages. */
  readonly memo: Record<string, boolean>;
}

export interface SpecialHooks {
  readonly scopes: readonly SpecialScope[];
  /** The rule, in the engine's words (SPECIAL_INFO holds the content-facing summary). */
  readonly rule: string;
  readonly before?: (u: SpecialUse) => void;
  readonly hit?: (u: SpecialUse, spec: HitSpec, target: Combatant) => HitSpec;
  readonly replace?: (u: SpecialUse) => void;
  readonly after?: (u: SpecialUse) => void;
  readonly field?: (ctx: StepCtx, abilityId: string) => void;
}

// ---- constants ----------------------------------------------------------------------------------------------------------

/** `counter:<ability or move id>`: the holder counters while it Guards (counter_stance). */
export const COUNTER_KEY = 'counter:';
/** `riposte:<move id>`: Move.riposte — the holder strikes back at Physical damage. */
export const RIPOSTE_KEY = 'riposte:';
/** A counter-hit's `HitSpec.source` prefix (counters are never countered). */
export const COUNTER_SOURCE = 'counter:';
/** The party sees next-next intents while this key is in the player's cooldown table (foresight). */
export const FORESIGHT_KEY = 'foresight';
/** DESIGN §5.2 Hunter's Eye / §12.4 Glimpse: the foresight lasts 3 of the caster's turns. */
export const FORESIGHT_TURNS = 3;
/** A location flag `trap:<ability id>`: the trap set there springs at the next fight (trap). */
export const TRAP_FLAG = 'trap:';
/** chain: the repeated hit's share. */
export const CHAIN_MULT = 0.5;
/** drain: the default share of damage dealt that heals the user (Siphon 50 %); per-ability shares below. */
export const DRAIN_SHARE = 0.5;
export const DRAIN_SHARES: Readonly<Record<string, number>> = { wvr_feast_of_moments: 0.6, comp_nyx_drink: 0.6 };
/** DESIGN §5.6 Feast of Moments: its drain overheal becomes Shield (3). */
export const DRAIN_OVERHEAL_SHIELD: readonly string[] = ['wvr_feast_of_moments'];
export const DRAIN_OVERHEAL_TURNS = 3;
/** DESIGN §5.6 Blood Pact: pay 15 % max HP (its self-cost) → gain 30 % max MP. */
export const RESOURCE_CONVERT_MP_PCT = 0.3;
/** DESIGN §5.2 Riposte Stance: +8 Focus per counter. */
export const COUNTER_MP: Readonly<Record<string, number>> = { rgr_riposte_stance: 8 };
/** D-067.3 `tyr_hour_presses`: Chrono 8 % of the target's max HP × (1 − Resolve/8); cannot kill while Resolve ≥ 3. */
export const HOUR_PRESSES_PCT = 0.08;
export const HOUR_PRESSES_RESOLVE_MAX = 8;
export const HOUR_PRESSES_SPARE_RESOLVE = 3;
/** `stripBuffs` kinds → status ids (D-069.9). */
export const STRIP_KINDS = { shield: STATUS.shield, regen: STATUS.regen, haste: STATUS.haste, rewind: STATUS.rewind } as const;

type Row = { status: string; chance: number; duration: number };
interface BoundMage {
  /** A hit on the target: damage type and ATK coefficient. */
  hit?: { type: DamageType; coef: number };
  /** On an ally (a boss ally first, else itself): a Shield of `coef`·ATK, a Regen of `coef`·ATK per turn, or a Rewind. */
  ally?: { status: string; coef?: number; duration: number };
  /** On the target (after a landed hit, or without a hit roll). */
  rows: Row[];
}
/** WORLD §6.8 `reach_dead_spell` by bound mage (rolled on the Reach's first cast; no repeats among the Reaches of a fight). */
export const BOUND_MAGES: Readonly<Record<string, BoundMage>> = {
  korr: { hit: { type: 'fire', coef: 1.2 }, rows: [{ status: STATUS.burn, chance: 0.6, duration: 3 }] },
  vane: { hit: { type: 'physical', coef: 1.2 }, rows: [{ status: STATUS.armorBreak, chance: 0.5, duration: 2 }] },
  aulde: { ally: { status: STATUS.shield, coef: 1.5, duration: 3 }, rows: [] },
  sallow: { ally: { status: STATUS.regen, coef: 0.4, duration: 3 }, rows: [{ status: STATUS.poison, chance: 0.5, duration: 4 }] },
  masque: { ally: { status: STATUS.rewind, duration: 2 }, rows: [{ status: STATUS.mark, chance: 1, duration: 2 }] },
};
export const BOUND_MAGE_TAG = 'bound_mage:';

// ---- helpers --------------------------------------------------------------------------------------------------------------

const foesOf = (combat: CombatState, c: Combatant): Combatant[] => (c.kind === 'enemy' ? combat.party : combat.enemies);
const sideOf = (combat: CombatState, c: Combatant): Combatant[] => (c.kind === 'enemy' ? combat.enemies : combat.party);
const sameSide = (a: Combatant, b: Combatant): boolean => (a.kind === 'enemy') === (b.kind === 'enemy');
const atkScale = (coef: number): { base: number; coef: number; stat: ScaleStat } => ({ base: 0, coef, stat: 'atk' });

/** The recipients on the user's own side (self, allies), or the user alone. */
function ownSide(u: SpecialUse): Combatant[] {
  const mine = u.recipients.filter((c) => sameSide(c, u.user) && isActive(c));
  return mine.length > 0 ? mine : [u.user];
}

/** Sets a timer in the holder's cooldown table that lasts `turns` of its turns after this one (+1 on its own turn). */
export function setTimer(combat: CombatState, holder: Combatant, key: string, turns: number): void {
  cooldownsOf(combat, holder)[key] = turns + (isOwnTurn(combat, holder) ? 1 : 0);
}

export const timerActive = (combat: CombatState, holder: Combatant, key: string): boolean => (cooldownsOf(combat, holder)[key] ?? 0) > 0;

/** What each target lost to `user`'s hits with `source` since event index `from` (counters and chains included). */
export function struckSince(ctx: StepCtx, combat: CombatState, from: number, user: Combatant, source: string): Struck[] {
  const out = new Map<string, Struck>();
  for (let i = from; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e?.t !== 'damageDealt' || e.sourceUid !== user.uid || e.refId !== source) continue;
    const target = [...combat.party, ...combat.enemies].find((c) => c.uid === e.targetUid);
    if (!target) continue;
    const row = out.get(target.uid) ?? { target, amount: 0, killed: false };
    row.amount += e.amount;
    out.set(target.uid, row);
  }
  for (const row of out.values()) row.killed = !row.target.alive;
  return [...out.values()];
}

/** A flat heal (drain, healOnDamage): × the holder's healing modifiers (Curse ×0.5), rounded, clamped to missing HP. */
export function healFlat(ctx: StepCtx, combat: CombatState, target: Combatant, raw: number, source: string): { amount: number; overheal: number } {
  let x = raw;
  for (const pct of statusMods(target, ctx.content).healing) x *= 1 + pct;
  const rounded = Math.max(0, roundHalfUp(x));
  const amount = Math.min(rounded, Math.max(0, target.hpMax - target.hp));
  if (!isActive(target) || rounded <= 0) return { amount: 0, overheal: 0 };
  target.hp += amount;
  if (amount > 0) ctx.emit({ t: 'healed', targetUid: target.uid, amount, source });
  combatLog(combat, `${target.name} recovers ${amount} HP.`, 'heal');
  return { amount, overheal: rounded - amount };
}

/** A hit whose amount is fixed (communion pressure, consumed DoTs), applied through the reducer like any other. */
export function fixedHit(amount: number, immune: boolean, steps: HitResult['steps']): HitResult {
  return { hit: true, phased: false, crit: false, immune, hitChance: 100, critChance: 0, variance: null, amount, absorbed: 0, shieldBroken: false, mitigated: 0, steps };
}

const guardUser = (u: SpecialUse): void => {
  u.user.guarding = true;
  u.ctx.emit({ t: 'guarded', uid: u.user.uid });
  combatLog(u.combat, `${u.user.name} guards.`, 'info');
};

// ---- the registry -----------------------------------------------------------------------------------------------------------

/** The bound mage of a Tyrant's Reach: kept on its pattern record; rolled at its first cast among those not yet taken. */
export function boundMageOf(ctx: StepCtx, combat: CombatState, c: Combatant): string {
  const tagged = (x: Combatant): string | undefined => x.pattern.firedOnce.find((k) => k.startsWith(BOUND_MAGE_TAG))?.slice(BOUND_MAGE_TAG.length);
  const mine = tagged(c);
  if (mine !== undefined) return mine;
  const taken = combat.enemies.filter((e) => e !== c && e.refId === c.refId).map(tagged);
  const all = Object.keys(BOUND_MAGES);
  const free = all.filter((m) => !taken.includes(m));
  const pool = free.length > 0 ? free : all;
  const pick = pool.length === 1 ? (pool[0] as string) : (pool[ctx.rng.int(0, pool.length - 1)] as string);
  c.pattern.firedOnce.push(`${BOUND_MAGE_TAG}${pick}`);
  combatLog(combat, `${c.name} carries ${pick[0]?.toUpperCase()}${pick.slice(1)}.`, 'intent');
  return pick;
}

function boundMage(u: SpecialUse): void {
  const { ctx, combat, user } = u;
  const mage = BOUND_MAGES[boundMageOf(ctx, combat, user)];
  if (!mage) return;
  const target = u.primary && isActive(u.primary) ? u.primary : (foesOf(combat, user).find((f) => isActive(f) && f.kind === 'player') ?? foesOf(combat, user).find(isActive));
  let landed = mage.hit === undefined;
  if (mage.hit && target) {
    const spec: HitSpec = { source: u.id, type: mage.hit.type, base: 0, coef: mage.hit.coef, stat: 'atk' };
    const r = resolveHit(ctx, user, target, spec);
    u.ops.applyHit(ctx, combat, user, target, spec, r, u.kind);
    landed = r.hit && !r.immune;
  }
  if (mage.ally) {
    const ally = sideOf(combat, user).find((a) => a !== user && isActive(a) && isBoss(ctx.content, a)) ?? user;
    const opts = mage.ally.coef === undefined ? { duration: mage.ally.duration } : { duration: mage.ally.duration, power: atkScale(mage.ally.coef) };
    applyStatus(ctx, combat, user, ally, mage.ally.status, opts);
  }
  if (landed && target && isActive(target) && isActive(user)) {
    applyStatusRows(ctx, combat, user, target, mage.rows.map((r) => ({ ...r, stacks: 1, target: 'target' }) as StatusApply));
  }
}

function hourPresses(u: SpecialUse): void {
  const { ctx, combat, user } = u;
  const target = u.primary && isActive(u.primary) ? u.primary : (foesOf(combat, user).find((f) => isActive(f) && f.kind === 'player') ?? foesOf(combat, user).find(isActive));
  if (!target) return;
  const resolve = combat.communion?.resolve ?? 0;
  const raw = HOUR_PRESSES_PCT * target.hpMax * (1 - resolve / HOUR_PRESSES_RESOLVE_MAX);
  const tick = raw > 0 ? resolveTick(target, raw, 'chrono') : { amount: 0, immune: false, steps: [{ name: 'tick', value: 0 }] };
  const amount = resolve >= HOUR_PRESSES_SPARE_RESOLVE ? Math.min(tick.amount, Math.max(0, target.hp - 1)) : tick.amount;
  const spec: HitSpec = { source: u.id, type: 'chrono', base: raw, coef: 0, stat: 'sp', cannotMiss: true };
  u.ops.applyHit(ctx, combat, user, target, spec, fixedHit(amount, tick.immune, tick.steps), u.kind);
}

/**
 * One entry per SPECIALS id (the content list, same order). `satisfies` makes a missing or unknown id a compile error;
 * the mirror test checks the order and the scopes.
 */
export const SPECIAL_HOOKS = {
  rewind: {
    scopes: ['ability', 'status'],
    rule: "ability: Rewind (its default 2 turns) on the user's side of the recipients; status: statuses.ts (snapshot, restore, boss cap)",
    after: (u) => {
      for (const c of ownSide(u)) applyStatus(u.ctx, u.combat, u.user, c, STATUS.rewind);
    },
  },
  phase: {
    scopes: ['ability', 'status'],
    rule: "ability: Phase (1) on the user's side of the recipients; status: damage.ts hit% and statuses.ts consumption",
    after: (u) => {
      for (const c of ownSide(u)) applyStatus(u.ctx, u.combat, u.user, c, STATUS.phase);
    },
  },
  taunt: {
    scopes: ['ability', 'status'],
    rule: 'ability: Taunt (source = the user) on the opposing recipients, else on every opponent; status: intents.ts retargeting',
    after: (u) => {
      const foes = u.recipients.filter((c) => !sameSide(c, u.user) && isActive(c));
      for (const c of foes.length > 0 ? foes : foesOf(u.combat, u.user).filter(isActive)) applyStatus(u.ctx, u.combat, u.user, c, STATUS.taunt);
    },
  },
  cleanse: {
    scopes: ['ability', 'move'],
    rule: "every debuff-kind status leaves the user's side of the recipients (the user alone when it targets opponents)",
    after: (u) => {
      for (const c of ownSide(u)) {
        const debuffs = c.statuses.filter((st) => u.ctx.content.statuses[st.statusId]?.kind === 'debuff').map((st) => st.statusId);
        cleanse(u.ctx, u.combat, c, debuffs);
      }
    },
  },
  trap: {
    scopes: ['ability'],
    rule: 'out of combat: a location flag trap:<id>; the next fight there opens with the ability on the leftmost enemy, free (abilities.ts springTraps); in combat it resolves as written',
    field: (ctx, abilityId) => {
      locationState(ctx, ctx.s.world.currentLocationId).flags[`${TRAP_FLAG}${abilityId}`] = true;
      ctx.log('You set a trap and cover it over.', 'event');
    },
  },
  mark_execute: {
    scopes: ['ability'],
    rule: 'a guaranteed crit against a Marked target',
    hit: (_u, spec, target) => (hasStatus(target, STATUS.mark) ? { ...spec, guaranteedCrit: true } : spec),
  },
  chain: {
    scopes: ['ability', 'move'],
    rule: 'if the single target was Soaked or Shocked when struck, the hit repeats at ×0.5 on the next living combatant of its side (own rolls)',
    before: (u) => {
      if (u.primary && (hasStatus(u.primary, STATUS.soaked) || hasStatus(u.primary, STATUS.shock))) u.memo.chain = true;
    },
    after: (u) => {
      const { ctx, combat, user, primary } = u;
      if (!u.memo.chain || !u.spec || !primary || !isActive(user)) return;
      const other = sideOf(combat, primary).find((c) => c !== primary && isActive(c));
      if (!other) return;
      const spec: HitSpec = { ...u.spec, mults: [...(u.spec.mults ?? []), { name: 'chain', mult: CHAIN_MULT }] };
      combatLog(combat, `The ${u.kind === 'intent' ? 'blow' : 'spell'} leaps to ${other.name}.`, 'damage');
      u.ops.applyHit(ctx, combat, user, other, spec, resolveHit(ctx, user, other, spec), u.kind);
    },
  },
  counter_stance: {
    scopes: ['ability', 'move'],
    rule: "the user Guards this round; a Physical single-target hit from an opponent that connects meanwhile is answered with the ability's (move's) power as a counter-hit",
    after: (u) => {
      guardUser(u);
      setTimer(u.combat, u.user, `${COUNTER_KEY}${u.id}`, 1);
    },
  },
  drain: {
    scopes: ['ability', 'move'],
    rule: "the user heals a share of the damage this use dealt (50 %; Feast 60 %, overheal → Shield 3; a move's healOnDamage pct wins)",
    after: (u) => {
      const dealt = u.struck.reduce((n, s) => n + s.amount, 0);
      if (dealt <= 0 || !isActive(u.user)) return;
      const share = DRAIN_SHARES[u.id] ?? DRAIN_SHARE;
      const r = healFlat(u.ctx, u.combat, u.user, dealt * share, u.id);
      if (r.overheal > 0 && DRAIN_OVERHEAL_SHIELD.includes(u.id)) applyStatus(u.ctx, u.combat, u.user, u.user, STATUS.shield, { amount: r.overheal, duration: DRAIN_OVERHEAL_TURNS });
    },
  },
  unmaking: {
    scopes: ['ability', 'move'],
    rule: 'if a target died to this use, the HP paid on its cost comes back (never above max HP)',
    after: (u) => {
      if (u.hpPaid <= 0 || !u.struck.some((s) => s.killed) || !isActive(u.user)) return;
      const back = Math.min(u.hpPaid, u.user.hpMax - u.user.hp);
      u.user.hp += back;
      if (back > 0) u.ctx.emit({ t: 'healed', targetUid: u.user.uid, amount: back, source: u.id });
      combatLog(u.combat, `The word takes nothing from you: ${back} HP returns.`, 'heal');
    },
  },
  resource_convert: {
    scopes: ['ability'],
    rule: 'the self-cost is paid → the user gains 30 % of its max MP (Blood Pact)',
    after: (u) => {
      u.ops.addMp(u.ctx, u.combat, u.user, Math.floor(RESOURCE_CONVERT_MP_PCT * u.user.mpMax), 'resource_convert');
    },
  },
  foresight: {
    scopes: ['ability'],
    rule: "the party sees each enemy's next-next intent for 3 of the caster's turns (FORESIGHT_KEY; abilities.ts foreseenIntent)",
    after: (u) => {
      const player = u.combat.party.find((c) => c.kind === 'player');
      if (player) u.combat.cooldowns[FORESIGHT_KEY] = FORESIGHT_TURNS + (isOwnTurn(u.combat, player) ? 1 : 0);
    },
  },
  guard: {
    scopes: ['ability', 'move'],
    rule: 'the user also Guards this round (until its next turn begins)',
    after: guardUser,
  },
  hour_presses: {
    scopes: ['move'],
    rule: "communion pressure: Chrono 8 % of the target's max HP × (1 − Resolve/8), resistance step only; it stops at 1 HP while Resolve ≥ 3 (D-067.3)",
    replace: hourPresses,
  },
  bound_mage: {
    scopes: ['move'],
    rule: "Tyrant's Reach dead spell: the bound mage (rolled at its first cast, no repeats in the fight) decides the spell (WORLD §6.8)",
    replace: boundMage,
  },
} satisfies Record<SpecialId, SpecialHooks>;

/** The engine's registry, in the content list's order (the mirror test compares the two). */
export const SPECIALS = Object.keys(SPECIAL_HOOKS) as SpecialId[];

/** The hooks of a special id (undefined for none or an unknown id). */
export function hooksOf(id: string | undefined): SpecialHooks | undefined {
  return id === undefined ? undefined : (SPECIAL_HOOKS as Readonly<Record<string, SpecialHooks>>)[id];
}

// ---- moves (D-077: move effects, special and riposte) ------------------------------------------------------------------------

/** D-069.9 `multiHit` (≡ `power.hits`): how many hits a move lands per target. */
export function moveHits(move: Move): number {
  for (const e of move.effects) if ('multiHit' in e) return e.multiHit.hits;
  return move.power?.hits ?? 1;
}

/** D-069.9 `healOnDamage` pct, if the move has one. */
export function healOnDamagePct(move: Move): number | undefined {
  for (const e of move.effects) if ('healOnDamage' in e) return e.healOnDamage.pct;
  return undefined;
}

/** Starts a move's use (intents.ts `executeIntent`): its special's `before`. */
export function beginMove(ctx: StepCtx, combat: CombatState, ops: CombatOps, c: Combatant, moveId: string, move: Move, aimed: Combatant | null, struck: readonly Combatant[], spec: HitSpec | null): SpecialUse {
  const u: SpecialUse = { ctx, combat, ops, user: c, scope: 'move', id: moveId, kind: 'intent', primary: aimed, recipients: struck, spec, struck: [], hpPaid: 0, from: ctx.events.length, memo: {} };
  hooksOf(move.special)?.before?.(u);
  return u;
}

/** A `replace` special plays instead of the move's declarative parts (true when one did). */
export function replaceMove(u: SpecialUse, move: Move): boolean {
  const replace = hooksOf(move.special)?.replace;
  if (!replace) return false;
  replace(u);
  return true;
}

/**
 * The rest of a move (after its hits, status rows, heal and shields): its special's `after`, then its combat-scope effects
 * in order — `stripBuffs` (default: the struck targets) and `healOnDamage` (the user heals pct of what the move dealt;
 * a `drain` special defers to it) — then `riposte` arms (`riposte:<move>` for `turns` of its turns). `leaveCombat` is U27's.
 */
export function finishMove(u: SpecialUse, move: Move): void {
  const { ctx, combat, user } = u;
  u.struck = struckSince(ctx, combat, u.from, user, u.id);
  const pct = healOnDamagePct(move);
  const hooks = hooksOf(move.special);
  if (hooks?.after && !(move.special === 'drain' && pct !== undefined)) hooks.after(u);
  for (const e of move.effects) {
    if ('stripBuffs' in e) {
      const ids = e.stripBuffs.kinds.map((k) => STRIP_KINDS[k]);
      for (const c of stripTargets(u, e.stripBuffs.target)) for (const id of ids) removeStatus(ctx, combat, c, id, `${c.name}'s ${ctx.content.statuses[id]?.name ?? id} is torn away.`);
    } else if ('healOnDamage' in e) {
      const dealt = u.struck.reduce((n, s) => n + s.amount, 0);
      if (dealt > 0 && isActive(user)) healFlat(ctx, combat, user, dealt * e.healOnDamage.pct, u.id);
    }
  }
  if (move.riposte && isActive(user)) setTimer(combat, user, `${RIPOSTE_KEY}${u.id}`, move.riposte.turns);
}

function stripTargets(u: SpecialUse, rule: 'target' | 'self' | 'all_enemies' | 'all_allies' | 'ally' | undefined): Combatant[] {
  const { combat, user } = u;
  switch (rule) {
    case 'self':
      return [user];
    case 'all_enemies':
      return foesOf(combat, user).filter(isActive);
    case 'all_allies':
      return sideOf(combat, user).filter(isActive);
    case 'ally':
      return [sideOf(combat, user).find((c) => c !== user && isActive(c)) ?? user];
    default: {
      const hit = u.recipients.filter(isActive);
      return hit.length > 0 ? hit : u.primary && isActive(u.primary) ? [u.primary] : [];
    }
  }
}

// ---- counter-hits ----------------------------------------------------------------------------------------------------------

/** Stance keys: they last "this round", i.e. until the holder's next turn begins (a riposte with `turns` n: its n-th). */
const STANCE_KEYS: readonly string[] = [COUNTER_KEY, RIPOSTE_KEY, GUARD_VALUE_KEY];

/**
 * The start of `c`'s turn (the reducer's `startTurn`, where its Guard drops): counter stances, ripostes and stronger
 * Guards that have run their course end now rather than at the end of this turn.
 */
export function expireStances(combat: CombatState, c: Combatant): void {
  const table = cooldownsOf(combat, c);
  for (const key of Object.keys(table)) if (STANCE_KEYS.some((k) => key.startsWith(k)) && (table[key] ?? 0) <= 1) delete table[key];
}

/** The power a counter key answers with: the ability's (counter_stance) or the creature move's (its power, or its riposte). */
function counterPower(ctx: StepCtx, holder: Combatant, key: string): { power: { base: number; coef: number; stat: ScaleStat }; id: string } | null {
  const riposte = key.startsWith(RIPOSTE_KEY);
  const id = key.slice(riposte ? RIPOSTE_KEY.length : COUNTER_KEY.length);
  const move = holder.kind === 'enemy' ? ctx.content.creatures[holder.refId]?.moves[id] : undefined;
  const p = riposte ? move?.riposte?.power : (ctx.content.abilities[id]?.power ?? move?.power);
  return p ? { power: { base: p.base, coef: p.coef, stat: p.stat }, id } : null;
}

/**
 * The reducer's reaction hook after a hit (reducers/combat.ts `applyHit`): a Physical single-target hit from an opponent
 * that connected on a rolled hit (not a counter, not a fixed amount) against a holder that is still standing triggers its
 * counters — `counter:<id>` while it Guards (counter_stance) and `riposte:<move>` (Move.riposte) — each a Physical hit
 * back at the attacker with that power (Riposte Stance also +8 Focus).
 */
export function reactToHit(ctx: StepCtx, combat: CombatState, ops: CombatOps, attacker: Combatant, target: Combatant, spec: HitSpec, result: HitResult): void {
  buffReactions(ctx, combat, ops.applyHit, applyStatus, attacker, target, spec, result); // U26b: Last Bastion's reflect, Cinder Shield's heat
  if (!result.hit || result.immune || result.variance === null || spec.type !== 'physical' || spec.aoe || spec.source.startsWith(COUNTER_SOURCE)) return;
  if (sameSide(attacker, target) || !isActive(target) || !isActive(attacker)) return;
  const table = cooldownsOf(combat, target);
  for (const key of Object.keys(table)) {
    if (!((table[key] ?? 0) > 0) || !isActive(attacker)) continue;
    if (!(key.startsWith(RIPOSTE_KEY) || (key.startsWith(COUNTER_KEY) && target.guarding))) continue;
    const found = counterPower(ctx, target, key);
    if (!found) continue;
    const cspec: HitSpec = { source: `${COUNTER_SOURCE}${found.id}`, type: 'physical', ...found.power };
    combatLog(combat, `${target.name} answers ${attacker.name}'s blow.`, 'damage');
    const r = resolveHit(ctx, target, attacker, cspec);
    ops.applyHit(ctx, combat, target, attacker, cspec, r, target.kind === 'enemy' ? 'intent' : 'ability');
    const mp = (COUNTER_MP[found.id] ?? 0) * (resourceMultOf(target)?.value ?? 1); // U26b: Apex Predator doubles Focus
    if (mp > 0) ops.addMp(ctx, combat, target, mp, `counter:${found.id}`);
  }
}
