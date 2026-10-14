// Abilities in play — the player's, a companion's signature on the player's command, item-granted ones — plus combat
// items and set traps (DESIGN §4.1 the action table, §4.8 targeting, §5.1–5.7, §7.9, §12.4; PLAN §4.10, §8.1;
// D-066 #2/#3/#5/#12, D-067.19, D-074 cost helpers, D-076 status API, D-077).
//
// Availability (`combatAbilityProblem`): the ability is the player's (unlocked, or granted by carried gear: the Amulet's
// `itm_echo_bolt`), no status blocks abilities, it is off cooldown, its cost is payable (progression `playerAbilityCost`:
// staff reduction, Veil-touched, Heartstone Ley +25 %, Blood price; a total HP cost ≥ current HP reads "Not enough
// blood" — a self-cost never kills, D-066 #5), and the target fits. Out of combat (`fieldAbilityProblem`) only abilities
// with `outOfCombat` effects (DESIGN §5.1 `field`) or a trap special, at their MP cost, with no target.
//
// Targets (DESIGN §4.8): `enemy` — the given living enemy (default the leftmost); `all_enemies` — every living enemy;
// `self`; `party` — every living party member; `ally` / `self_or_ally` — the given party member (default: the companion
// if it stands, else the caster; for a companion caster, the player).
//
// Resolution (`castAbility` → `resolveAbility`), in this order:
//   cost (MP, then the HP self-cost and Blood price) → cooldown (`cooldown` caster turns: +1 on its own turn, so a
//   1-turn cooldown blocks exactly the next turn, D-067.19) → `abilityUsed` → special `before` →
//   hits — power on `enemy`/`all_enemies` abilities only (on self/ally abilities it is the special's power, e.g. a
//     counter stance): per target in slot order, `power.hits` hits (each its own hit/variance/crit; `perHitCrit: false`
//     → the first hit's crit decides the rest), `selfCost.hpPerHit` paid per hit while it leaves ≥ 1 HP, bonuses whose
//     `when` holds for that target (×1.25 vs Marked …) as step-7 multipliers, the special's `hit` rewrite
//     (mark_execute); a crit gains the class `crit` resource (Elf +6) →
//   status rows — `target` rows on each recipient (a damaging ability: only where a hit connected), each row's `when`
//     evaluated per recipient (CombatWhen: `targetIsBoss`, `targetHas` …), then the strike coatings (Venom Coat) →
//   heal (`heal.stat` atk | sp | max(STR, AGI); party / chosen ally / self), Shield (`shield`, same recipients) →
//   scripted cleanses → the other rows once (self, all_allies …) → `interrupt` (an enemy whose intent survives the rows)
//   → special `after` → `onKill` refunds (MP; HP spent unless the unmaking special already did) → Warden Grit per enemy
//   Taunted → the script's tail (guard value, resource, flee, coat timer).
//
// DESIGN rows the declarative fields and the 15 specials cannot express are scripted here by ability id
// (ABILITY_SCRIPTS), like interplay row 16's `wiz_immolate` in statuses.ts: Venom Coat's coating, Doom Sigil's delay
// (fired at the start of the target's turn, `fireDelayed`), Smoke Bomb / Veilwalk's sure flee, the exact cleanses of
// Field Dressing / Veilwalk / Steady Breath, Iron Guard's 65 % Guard and +12 Grit, Exsanguinate, Collapse, Unravel.
// Not scripted (reported to the lead): Hunter's Eye's crit, Dancer's Guard, Flurry's 4th hit, Crescendo, Final Verse's
// last crit, Shadowstep's next crit, Blink Strike, Moment Between, Apex Predator, Cinder Shield's counter, Skyfall's
// fork, Heart of the Grove's Ley bonus, Unbroken, Null Plate, Spellbreaker, Oathbound's immunity, Iron Silence, Last
// Bastion, Mountainfall's no-Guard, Leech Veil's heal, Soul Tether, Breach Echo's free cast, Ninefold Hex's spread,
// Iron Guard's companion −25 %, Crushing Blow's −5 accuracy (no ability accuracy field).
import type { Ability } from '@schema/ability';
import type { CombatWhen } from '@schema/creature';
import type { Item } from '@schema/item';
import type { ContentPack, StepCtx } from '../ctx';
import { derive } from '../derived';
import { apply, applyAll } from '../effects';
import { playerAbilityCost } from '../progression';
import type { ActionOf } from '../types/actions';
import type { Combatant, CombatState, GameState } from '../types/state';
import { GUARD_VALUE_KEY, resolveHeal, resolveHit, resolveTick, type HealSpec, type HitSpec } from './damage';
import { grantFleeAuto } from './flee';
import { compilePattern, evalCombatWhen, interruptIntent, patternOf, type IntentRead } from './intents';
import { STATUS, applyStatus, applyStatusRows, blocksAction, cleanse, cooldownsOf, findStatus, removeStatus, skipsTurn, type WhenEval } from './statuses';
import { FORESIGHT_KEY, TRAP_FLAG, fixedHit, healFlat, hooksOf, setTimer, struckSince, type CombatOps, type HitKind, type SpecialUse } from './specials';
import { combatLog, combatantByUid, isActive, playerOf } from './turnOrder';

// ---- scripts --------------------------------------------------------------------------------------------------------------

export interface AbilityScript {
  /** The ability's `target` status rows coat the caster's strikes — basic attacks and abilities of these branches — for n of its turns instead of landing now (Venom Coat). */
  coat?: { turns: number; branches: readonly string[] };
  /** The hit and its rows land after n of the target's turns, at the start of its next one (Doom Sigil). */
  delay?: number;
  /** The player's next flee this fight succeeds without a roll (Smoke Bomb, Veilwalk; DESIGN §4.7). */
  fleeAuto?: true;
  /** Exactly these statuses leave the caster's side of the recipients (Field Dressing: Bleed, Poison; Veilwalk: Mark, Taunt). */
  cleanse?: readonly string[];
  /** The first of these found leaves (Steady Breath). */
  cleanseFirst?: readonly string[];
  /** The caster Guards this round at this value (Iron Guard 65 %). */
  guardValue?: number;
  /** Class resource on use (Iron Guard +12 Grit). */
  resource?: number;
  /** The target's Bleed is consumed for n × its remaining tick total, at once (Exsanguinate). */
  consumeBleed?: number;
  /** +1 % damage per 1 % of the caster's HP missing, up to this (Collapse +50 %). */
  missingHpCap?: number;
  /** These leave the target before the hit; ×mult if any did (Unravel). */
  strip?: { statuses: readonly string[]; mult: number };
}

export const ABILITY_SCRIPTS: Readonly<Record<string, AbilityScript>> = {
  rgr_venom_coat: { coat: { turns: 3, branches: ['hunt', 'steel'] } },
  rgr_field_dressing: { cleanse: [STATUS.bleed, STATUS.poison] },
  rgr_smoke_bomb: { fleeAuto: true },
  rgr_exsanguinate: { consumeBleed: 2 },
  elf_veilwalk: { fleeAuto: true, cleanse: [STATUS.mark, STATUS.taunt] },
  wrd_iron_guard: { guardValue: 0.65, resource: 12 },
  wrd_steady_breath: { cleanseFirst: [STATUS.burn, STATUS.bleed, STATUS.poison, STATUS.curse, STATUS.blind, STATUS.weaken, STATUS.slow, STATUS.shock] },
  wvr_doom_sigil: { delay: 3 },
  wvr_collapse: { missingHpCap: 0.5 },
  wvr_unravel: { strip: { statuses: [STATUS.shield, STATUS.regen, STATUS.rewind, STATUS.haste], mult: 1.5 } },
};

/** `coat:<ability id>` in the caster's cooldown table while a coating lasts. */
export const COAT_KEY = 'coat:';
/** `delay:<ability id>:<caster uid>` in the target's cooldown table: n + 1 at cast, fires at the start of its turn at 1. */
export const DELAY_KEY = 'delay:';

// ---- what the player has -------------------------------------------------------------------------------------------------

/** The player's abilities: unlocked ones, then those granted by carried gear (the Amulet's bolt). */
export function knownAbilities(s: GameState, content: ContentPack): string[] {
  const out = s.player.abilitiesUnlocked.filter((id) => content.abilities[id] !== undefined);
  for (const id of derive(s.player, content).grantedAbilities) if (!out.includes(id) && content.abilities[id]) out.push(id);
  return out;
}

// ---- targets ----------------------------------------------------------------------------------------------------------------

export interface Picked {
  /** The single target (null for area, self and party abilities). */
  primary: Combatant | null;
  recipients: Combatant[];
}

const foesOf = (combat: CombatState, c: Combatant): Combatant[] => (c.kind === 'enemy' ? combat.party : combat.enemies).filter(isActive);
const sideOf = (combat: CombatState, c: Combatant): Combatant[] => (c.kind === 'enemy' ? combat.enemies : combat.party).filter(isActive);

/** DESIGN §4.8: an ally ability defaults to the companion if it stands, else the caster; a companion's to the player. */
function defaultAlly(combat: CombatState, caster: Combatant): Combatant {
  const side = sideOf(combat, caster);
  return caster.kind === 'player' ? (side.find((c) => c.kind === 'companion') ?? caster) : (side.find((c) => c !== caster) ?? caster);
}

/** Who an ability resolves on (see the file header), or why the target does not fit. */
export function pickTargets(combat: CombatState, caster: Combatant, ability: Ability, targetUid?: string): Picked | string {
  const chosen = targetUid === undefined ? undefined : combatantByUid(combat, targetUid);
  const none = (): string | null => (targetUid === undefined ? null : `${ability.name} takes no target`);
  switch (ability.target) {
    case 'enemy': {
      const foes = foesOf(combat, caster);
      const t = targetUid === undefined ? foes[0] : foes.find((f) => f === chosen);
      if (!t) return targetUid === undefined ? 'There is no one to target' : `There is no enemy '${targetUid}' to target`;
      return { primary: t, recipients: [t] };
    }
    case 'all_enemies':
      return none() ?? { primary: null, recipients: foesOf(combat, caster) };
    case 'self':
      return none() ?? { primary: null, recipients: [caster] };
    case 'party':
      return none() ?? { primary: null, recipients: sideOf(combat, caster) };
    default: {
      const t = targetUid === undefined ? defaultAlly(combat, caster) : sideOf(combat, caster).find((c) => c === chosen);
      if (!t) return `'${targetUid ?? ''}' is not one of your party`;
      return { primary: t, recipients: [t] };
    }
  }
}

/** The target choices an enumerator lists for an ability: each living enemy, each party member, or none. */
function targetOptions(combat: CombatState, caster: Combatant, ability: Ability): (string | undefined)[] {
  if (ability.target === 'enemy') return foesOf(combat, caster).map((c) => c.uid);
  if (ability.target === 'ally' || ability.target === 'self_or_ally') return sideOf(combat, caster).map((c) => c.uid);
  return [undefined];
}

// ---- availability -----------------------------------------------------------------------------------------------------------

/** Why the player cannot use `abilityId` (at `targetUid`) on this turn of `combat`, or null. */
export function combatAbilityProblem(s: GameState, content: ContentPack, combat: CombatState, abilityId: string, targetUid?: string): string | null {
  const ability = content.abilities[abilityId];
  if (!ability || !knownAbilities(s, content).includes(abilityId)) return `You do not know '${abilityId}'`;
  const player = playerOf(combat);
  if (blocksAction(content, player, 'ability')) return 'You cannot use abilities now';
  const cd = combat.cooldowns[abilityId] ?? 0;
  if (cd > 0) return `${ability.name} is recharging (${cd})`;
  const cost = playerAbilityCost(s, content, abilityId, player);
  if (!cost.ok) return cost.reason ?? 'You cannot pay for that';
  const picked = pickTargets(combat, player, ability, targetUid);
  return typeof picked === 'string' ? picked : null;
}

/** Every ability action the player may take on this turn of `combat` (one per target choice). */
export function combatAbilityActions(s: GameState, content: ContentPack, combat: CombatState): ActionOf<'ability'>[] {
  const out: ActionOf<'ability'>[] = [];
  const player = playerOf(combat);
  for (const abilityId of knownAbilities(s, content)) {
    const ability = content.abilities[abilityId] as Ability;
    for (const targetUid of targetOptions(combat, player, ability)) {
      if (combatAbilityProblem(s, content, combat, abilityId, targetUid) !== null) continue;
      out.push(targetUid === undefined ? { type: 'ability', abilityId } : { type: 'ability', abilityId, targetUid });
    }
  }
  return out;
}

/** Why the player cannot use `abilityId` out of combat now (DESIGN §5.1 `field`), or null. */
export function fieldAbilityProblem(s: GameState, content: ContentPack, abilityId: string, targetUid?: string): string | null {
  if (targetUid !== undefined) return 'There is nothing to target outside combat';
  const ability = content.abilities[abilityId];
  if (!ability || !knownAbilities(s, content).includes(abilityId)) return `You do not know '${abilityId}'`;
  if (ability.outOfCombat.length === 0 && hooksOf(ability.special)?.field === undefined) return `${ability.name} can only be used in a fight`;
  const cost = playerAbilityCost(s, content, abilityId);
  return cost.ok ? null : (cost.reason ?? 'You cannot pay for that');
}

export function fieldAbilityActions(s: GameState, content: ContentPack): ActionOf<'ability'>[] {
  return knownAbilities(s, content)
    .filter((abilityId) => fieldAbilityProblem(s, content, abilityId) === null)
    .map((abilityId) => ({ type: 'ability', abilityId }));
}

/** An ability out of combat: its MP (and HP) cost, then its `outOfCombat` effects and its special's field hook. */
export function useFieldAbility(ctx: StepCtx, action: ActionOf<'ability'>): void {
  const { s, content } = ctx;
  const why = fieldAbilityProblem(s, content, action.abilityId, action.targetUid);
  if (why !== null) ctx.reject(why);
  const ability = content.abilities[action.abilityId] as Ability;
  const cost = playerAbilityCost(s, content, ability.id);
  s.player.mp -= cost.mpPaid;
  s.player.hp -= cost.hp;
  s.counters.abilitiesUsed[ability.id] = (s.counters.abilitiesUsed[ability.id] ?? 0) + 1;
  ctx.emit({ t: 'abilityUsed', uid: 'player', abilityId: ability.id });
  ctx.log(`You use ${ability.name}.`, 'event');
  applyAll(ability.outOfCombat, ctx, { source: `ability:${ability.id}` });
  hooksOf(ability.special)?.field?.(ctx, ability.id);
}

// ---- resolution -------------------------------------------------------------------------------------------------------------

/** CombatWhen for an ability's bonuses and rows: about the caster, against each recipient. */
function whenOf(ctx: StepCtx, combat: CombatState, caster: Combatant): WhenEval {
  return (when: CombatWhen, recipient: Combatant) =>
    evalCombatWhen(ctx, combat, when, { self: caster, target: recipient, turn: caster.pattern.turnsTaken + 1, round: combat.round });
}

/** An ability's hit before per-target rewrites. */
export function abilitySpec(ability: Ability): HitSpec | null {
  const p = ability.power;
  if (!p || !ability.damageType) return null;
  const spec: HitSpec = { source: ability.id, type: ability.damageType, base: p.base, coef: p.coef, stat: p.stat };
  if (p.maxOf) spec.maxOf = { ...p.maxOf };
  if (ability.spell) spec.spell = true;
  if (p.ignoresArmor) spec.ignoresArmor = true;
  if (ability.target === 'all_enemies') spec.aoe = true;
  return spec;
}

/** Step-7 multipliers for one target: bonuses whose `when` holds, Collapse's missing HP, Unravel's strip. */
function targetMults(u: SpecialUse, ability: Ability, target: Combatant, evalWhen: WhenEval): { name: string; mult: number }[] {
  const out = ability.bonuses.filter((b) => evalWhen(b.when, target)).map((b) => ({ name: ability.id, mult: b.mult }));
  const script = ABILITY_SCRIPTS[ability.id];
  if (script?.missingHpCap !== undefined) {
    const missing = Math.min(script.missingHpCap, Math.max(0, 1 - u.user.hp / u.user.hpMax));
    if (missing > 0) out.push({ name: 'missing hp', mult: 1 + missing });
  }
  if (script?.strip && u.memo[`strip:${target.uid}`]) out.push({ name: 'stripped', mult: script.strip.mult });
  return out;
}

/** One target's hits (see the file header); true when one connected. */
function strike(u: SpecialUse, ability: Ability, target: Combatant, base: HitSpec, evalWhen: WhenEval): boolean {
  const { ctx, combat, ops, user } = u;
  const power = ability.power as NonNullable<Ability['power']>;
  const hook = hooksOf(ability.special)?.hit;
  const strip = ABILITY_SCRIPTS[ability.id]?.strip;
  if (strip) {
    const gone = cleanse(ctx, combat, target, strip.statuses);
    if (gone.length > 0) u.memo[`strip:${target.uid}`] = true;
  }
  let landed = false;
  let firstCrit: boolean | null = null;
  for (let h = 0; h < power.hits && isActive(target) && isActive(user); h++) {
    const perHit = ability.selfCost?.hpPerHit ?? 0;
    if (perHit > 0) {
      if (user.hp <= perHit) break; // a self-cost never kills (D-066 #5)
      user.hp -= perHit;
    }
    let spec: HitSpec = { ...base };
    const mults = targetMults(u, ability, target, evalWhen);
    if (mults.length > 0) spec.mults = mults;
    if (!power.perHitCrit && firstCrit !== null) spec = firstCrit ? { ...spec, guaranteedCrit: true } : { ...spec, critBonus: -1000 };
    if (hook) spec = hook(u, spec, target);
    const r = resolveHit(ctx, user, target, spec);
    ops.applyHit(ctx, combat, user, target, spec, r, u.kind);
    if (r.hit && firstCrit === null) firstCrit = r.crit;
    if (r.hit && r.crit) ops.gainResource(ctx, combat, user, 'crit');
    landed ||= r.hit && !r.immune;
  }
  return landed;
}

/** Venom Coat and the like: a strike that connected carries the striker's active coatings (basic attacks: branch null). */
export function applyCoats(ctx: StepCtx, combat: CombatState, striker: Combatant, target: Combatant, branch: string | null): void {
  const table = cooldownsOf(combat, striker);
  for (const key of Object.keys(table)) {
    if (!key.startsWith(COAT_KEY) || !((table[key] ?? 0) > 0) || !isActive(target)) continue;
    const id = key.slice(COAT_KEY.length);
    const coat = ABILITY_SCRIPTS[id]?.coat;
    const ability = ctx.content.abilities[id];
    if (!coat || !ability || (branch !== null && !coat.branches.includes(branch))) continue;
    applyStatusRows(ctx, combat, striker, target, ability.statuses.filter((r) => r.target === 'target'), whenOf(ctx, combat, striker));
  }
}

/** The heal's scale: `heal.stat` atk | sp, or max(STR, AGI) folded into the base (the player's derived primaries). */
function healSpecOf(ctx: StepCtx, caster: Combatant, heal: NonNullable<Ability['heal']>): HealSpec {
  if (heal.stat !== 'maxStrAgi') return { base: heal.base, coef: heal.coef, stat: heal.stat };
  const d = caster.kind === 'player' ? derive(ctx.s.player, ctx.content) : null;
  const best = d ? Math.max(d.strength, d.agility) : Math.max(caster.atk, caster.agi);
  return { base: heal.base + heal.coef * best, coef: 0, stat: 'atk' };
}

/** Who a heal or Shield lands on: the party for party abilities (and party heals), the chosen ally, else the caster. */
function supportTargets(combat: CombatState, caster: Combatant, ability: Ability, picked: Picked, party: boolean): Combatant[] {
  if (party || ability.target === 'party') return sideOf(combat, caster);
  if (ability.target === 'ally' || ability.target === 'self_or_ally') return picked.recipients.filter(isActive);
  return [caster];
}

/** Doom Sigil: the hit and its rows wait in the target's cooldown table (see DELAY_KEY). */
function plantDelayed(combat: CombatState, caster: Combatant, target: Combatant, ability: Ability, turns: number): void {
  cooldownsOf(combat, target)[`${DELAY_KEY}${ability.id}:${caster.uid}`] = turns + 1;
  combatLog(combat, `${ability.name} is written on ${target.name}. It will be read in ${turns} turns.`, 'status');
}

/** Interplay-free consumption of the target's Bleed for `mult` × its remaining ticks (Exsanguinate). */
function consumeBleed(u: SpecialUse, target: Combatant, mult: number): void {
  const bleed = findStatus(target, STATUS.bleed);
  if (!bleed || !isActive(target)) return;
  const per = bleed.tick ?? u.ctx.content.statuses[STATUS.bleed]?.tick?.damage?.base ?? 0;
  const raw = mult * per * bleed.stacks * Math.max(0, bleed.duration);
  removeStatus(u.ctx, u.combat, target, STATUS.bleed, `${target.name}'s wounds open all at once.`);
  const tick = resolveTick(target, raw, 'physical');
  const spec: HitSpec = { source: u.id, type: 'physical', base: raw, coef: 0, stat: 'atk', ignoresArmor: true };
  u.ops.applyHit(u.ctx, u.combat, u.user, target, spec, fixedHit(tick.amount, tick.immune, tick.steps), u.kind);
}

/** Resolves an ability already paid for (see the file header). `kind` is the hits' event kind ('item' for an item's). */
export function resolveAbility(ops: CombatOps, ctx: StepCtx, combat: CombatState, caster: Combatant, ability: Ability, picked: Picked, hpPaid: number, kind: HitKind = 'ability'): void {
  const script = ABILITY_SCRIPTS[ability.id] ?? {};
  const hooks = hooksOf(ability.special);
  const offensive = ability.target === 'enemy' || ability.target === 'all_enemies';
  const spec = offensive ? abilitySpec(ability) : null;
  const u: SpecialUse = { ctx, combat, ops, user: caster, scope: 'ability', id: ability.id, kind, primary: picked.primary, recipients: picked.recipients, spec, struck: [], hpPaid, from: ctx.events.length, memo: {} };
  const evalWhen = whenOf(ctx, combat, caster);
  hooks?.before?.(u);

  if (script.delay !== undefined) {
    for (const t of picked.recipients) if (isActive(t)) plantDelayed(combat, caster, t, ability, script.delay);
  } else {
    const landed = new Set<Combatant>();
    if (spec) for (const t of picked.recipients) if (isActive(t) && strike(u, ability, t, spec, evalWhen)) landed.add(t);
    const targetRows = ability.statuses.filter((r) => r.target === 'target');
    const otherRows = ability.statuses.filter((r) => r.target !== 'target');
    if (!script.coat) {
      for (const t of picked.recipients) {
        if (isActive(t) && (spec === null || landed.has(t)) && targetRows.length > 0) applyStatusRows(ctx, combat, caster, t, targetRows, evalWhen);
      }
    }
    for (const t of landed) applyCoats(ctx, combat, caster, t, ability.branch ?? null);
    if (ability.heal) {
      for (const t of supportTargets(combat, caster, ability, picked, ability.heal.target === 'party')) {
        const r = resolveHeal(ctx, caster, t, healSpecOf(ctx, caster, ability.heal));
        t.hp += r.amount;
        if (r.amount > 0) ctx.emit({ t: 'healed', targetUid: t.uid, amount: r.amount, source: ability.id });
        combatLog(combat, `${t.name} recovers ${r.amount} HP.`, 'heal');
      }
    }
    if (ability.shield) {
      const { base, coef, stat, turns } = ability.shield;
      for (const t of supportTargets(combat, caster, ability, picked, false)) applyStatus(ctx, combat, caster, t, STATUS.shield, { power: { base, coef, stat }, duration: turns });
    }
    const mine = picked.recipients.filter((c) => !offensive && isActive(c));
    for (const t of mine.length > 0 ? mine : [caster]) {
      if (script.cleanse) cleanse(ctx, combat, t, script.cleanse);
      const first = script.cleanseFirst?.find((id) => findStatus(t, id) !== undefined);
      if (first !== undefined) cleanse(ctx, combat, t, [first]);
    }
    if (!script.coat && otherRows.length > 0) applyStatusRows(ctx, combat, caster, picked.primary, otherRows, evalWhen);
    const primary = picked.primary;
    if (ability.interrupt && primary?.kind === 'enemy' && isActive(primary) && (spec === null || landed.has(primary)) && combat.intents[primary.uid]) {
      interruptIntent(ctx, combat, primary);
    }
    if (script.consumeBleed !== undefined && primary && landed.has(primary)) consumeBleed(u, primary, script.consumeBleed);
  }

  u.struck = struckSince(ctx, combat, u.from, caster, ability.id);
  hooks?.after?.(u);
  const killed = struckSince(ctx, combat, u.from, caster, ability.id).some((s) => s.killed);
  if (killed && ability.onKill && isActive(caster)) {
    if (ability.onKill.refundMp) ops.addMp(ctx, combat, caster, ability.onKill.refundMp, `onKill:${ability.id}`);
    if (ability.onKill.refundHp === 'spent' && ability.special !== 'unmaking' && hpPaid > 0) {
      const back = Math.min(hpPaid, caster.hpMax - caster.hp);
      caster.hp += back;
      if (back > 0) ctx.emit({ t: 'healed', targetUid: caster.uid, amount: back, source: ability.id });
    }
  }
  const taunted = ctx.events.slice(u.from).filter((e) => e.t === 'statusApplied' && e.statusId === STATUS.taunt && combat.enemies.some((x) => x.uid === e.targetUid));
  for (let i = 0; i < taunted.length; i++) ops.gainResource(ctx, combat, caster, 'taunt'); // Warden: +4 Grit per enemy Taunted
  if (script.guardValue !== undefined && isActive(caster)) {
    setTimer(combat, caster, `${GUARD_VALUE_KEY}${Math.round(script.guardValue * 100)}`, 1);
    if (!caster.guarding) {
      caster.guarding = true;
      ctx.emit({ t: 'guarded', uid: caster.uid });
    }
  }
  if (script.resource !== undefined) ops.addMp(ctx, combat, caster, script.resource, ability.id);
  if (script.fleeAuto && caster.kind === 'player') grantFleeAuto(caster);
  if (script.coat) {
    setTimer(combat, caster, `${COAT_KEY}${ability.id}`, script.coat.turns);
    combatLog(combat, `${caster.name}'s strikes are coated for ${script.coat.turns} turns.`, 'status');
  }
}

/**
 * The player's ability in a fight (the reducer checked `combatAbilityProblem`): pay (MP, then HP), start the cooldown,
 * count and announce it, resolve. (A trap springing and an item's ability call `resolveAbility` directly: free.)
 */
export function castAbility(ops: CombatOps, ctx: StepCtx, combat: CombatState, caster: Combatant, ability: Ability, picked: Picked): void {
  const { s, content } = ctx;
  const cost = playerAbilityCost(s, content, ability.id, caster);
  caster.mp -= cost.mpPaid;
  if (cost.hp > 0) {
    caster.hp -= cost.hp;
    combatLog(combat, `${ability.name} takes ${cost.hp} HP from ${caster.name}.`, 'info');
  }
  if (ability.cooldown > 0) setTimer(combat, caster, ability.id, ability.cooldown);
  s.counters.abilitiesUsed[ability.id] = (s.counters.abilitiesUsed[ability.id] ?? 0) + 1;
  ctx.emit({ t: 'abilityUsed', uid: caster.uid, abilityId: ability.id });
  combatLog(combat, `${caster.name} uses ${ability.name}.`, 'info');
  resolveAbility(ops, ctx, combat, caster, ability, picked, cost.hp);
}

/** `ability` in a fight: check, cast (the reducer ends the turn). */
export function usePlayerAbility(ops: CombatOps, ctx: StepCtx, combat: CombatState, action: ActionOf<'ability'>): void {
  const why = combatAbilityProblem(ctx.s, ctx.content, combat, action.abilityId, action.targetUid);
  if (why !== null) ctx.reject(why);
  const player = playerOf(combat);
  const ability = ctx.content.abilities[action.abilityId] as Ability;
  castAbility(ops, ctx, combat, player, ability, pickTargets(combat, player, ability, action.targetUid) as Picked);
}

// ---- delayed hits (Doom Sigil) ------------------------------------------------------------------------------------------------

/**
 * DESIGN §4.1 (1): at the start of `actor`'s turn (after DoTs, Regen and Rewind) every delayed hit on it whose countdown
 * has run out fires: the ability's hit from its caster (cannot miss; Phase still evades) and its rows, `when` read now
 * (Doom Sigil: Stun 1 if Cursed when it fires). A caster no longer in the fight takes its sigil with it.
 */
export function fireDelayed(ops: CombatOps, ctx: StepCtx, combat: CombatState, actor: Combatant): void {
  const table = cooldownsOf(combat, actor);
  for (const key of Object.keys(table)) {
    if (!key.startsWith(DELAY_KEY) || (table[key] ?? 0) > 1) continue;
    delete table[key];
    const [abilityId = '', casterUid = ''] = key.slice(DELAY_KEY.length).split(':');
    const ability = ctx.content.abilities[abilityId];
    const caster = combatantByUid(combat, casterUid);
    const spec = ability ? abilitySpec(ability) : null;
    if (!ability || !caster || !isActive(actor)) continue;
    combatLog(combat, `${ability.name} is read on ${actor.name}.`, 'status');
    let landed = spec === null;
    if (spec) {
      const sigil: HitSpec = { ...spec, cannotMiss: true };
      const r = resolveHit(ctx, caster, actor, sigil);
      ops.applyHit(ctx, combat, caster, actor, sigil, r, 'ability');
      landed = r.hit && !r.immune;
    }
    if (landed && isActive(actor)) applyStatusRows(ctx, combat, caster, actor, ability.statuses, whenOf(ctx, combat, caster));
  }
}

// ---- traps (the `trap` special) ---------------------------------------------------------------------------------------------

/** At the start of a fight (after the opening intents): each trap set at this node springs on the leftmost enemy, free. */
export function springTraps(ops: CombatOps, ctx: StepCtx, combat: CombatState): void {
  const ls = ctx.s.world.locationStates[combat.locationId];
  if (!ls) return;
  for (const key of Object.keys(ls.flags)) {
    if (!key.startsWith(TRAP_FLAG)) continue;
    delete ls.flags[key];
    const ability = ctx.content.abilities[key.slice(TRAP_FLAG.length)];
    const enemies = combat.enemies.filter(isActive);
    const first = enemies[0];
    if (!ability || !first) continue;
    combatLog(combat, `${ability.name} springs under ${first.name}.`, 'info');
    const picked: Picked = ability.target === 'all_enemies' ? { primary: null, recipients: enemies } : { primary: first, recipients: [first] };
    resolveAbility(ops, ctx, combat, playerOf(combat), ability, picked, 0);
  }
}

// ---- foresight (the `foresight` special) -----------------------------------------------------------------------------------

export const foresightActive = (combat: CombatState): boolean => (combat.cooldowns[FORESIGHT_KEY] ?? 0) > 0;

/**
 * The move a creature's pattern commits to after its current intent — the dimmed second chip of `foresight` (DESIGN
 * §4.2): the program from the pointer, conditions read now for the turn after next. Null when a weighted pick or a
 * phase hold decides it, or nothing is eligible. Pure.
 */
export function foreseenMove(r: IntentRead, combat: CombatState, c: Combatant): string | null {
  const prog = compilePattern(patternOf(r.content, c));
  const player = combat.party.find((p) => p.kind === 'player' && isActive(p)) ?? null;
  let pc = c.pattern.pointer;
  for (let n = 0; n <= 2 * prog.length; n++) {
    if (pc < 0 || pc >= prog.length) pc = 0;
    const ins = prog[pc];
    if (!ins) return null;
    const scope = (key: string) => ({ self: c, target: player, turn: c.pattern.turnsTaken + 2, round: combat.round + 1, onceKey: `${c.phase}:${key}` });
    switch (ins.op) {
      case 'move':
        if (ins.when === undefined || evalCombatWhen(r, combat, ins.when, scope(ins.key))) return ins.move;
        pc += 1;
        break;
      case 'branch':
        pc = evalCombatWhen(r, combat, ins.cond, scope(ins.key)) ? pc + 1 : ins.else;
        break;
      case 'jump':
        pc = ins.to;
        break;
      default:
        return null; // a weighted pick or a phase hold
    }
  }
  return null;
}

// ---- companion signature (DESIGN §4.1 `C`, §4.9) -------------------------------------------------------------------------

/** The standing companion and its signature ability. */
function signatureOf(content: ContentPack, combat: CombatState): { companion: Combatant; ability: Ability; cooldown: number } | string {
  const companion = combat.party.find((c) => c.kind === 'companion');
  if (!companion || !isActive(companion)) return 'You have no companion standing';
  const sig = content.companions[companion.refId]?.signature;
  const ability = sig ? content.abilities[sig.abilityId] : undefined;
  if (!sig || !ability) return `${companion.name} has no signature`;
  return { companion, ability, cooldown: sig.cooldown };
}

/** Why the player cannot command the companion's signature now, or null. `focus` / `hold` are not defined by DESIGN (U28). */
export function signatureProblem(content: ContentPack, combat: CombatState, action: ActionOf<'companionCommand'>): string | null {
  if (action.command !== 'signature') return `the '${action.command}' command is not defined (DESIGN §4.1 knows the signature; U28)`;
  const sig = signatureOf(content, combat);
  if (typeof sig === 'string') return sig;
  if (skipsTurn(content, sig.companion)) return `${sig.companion.name} is stunned`;
  const cd = sig.companion.cooldowns[sig.ability.id] ?? 0;
  if (cd > 0) return `${sig.ability.name} is recharging (${cd})`;
  const picked = pickTargets(combat, sig.companion, sig.ability, action.targetUid);
  return typeof picked === 'string' ? picked : null;
}

export function signatureActions(content: ContentPack, combat: CombatState): ActionOf<'companionCommand'>[] {
  const sig = signatureOf(content, combat);
  if (typeof sig === 'string') return [];
  return targetOptions(combat, sig.companion, sig.ability)
    .map((targetUid): ActionOf<'companionCommand'> => (targetUid === undefined ? { type: 'companionCommand', command: 'signature' } : { type: 'companionCommand', command: 'signature', targetUid }))
    .filter((a) => signatureProblem(content, combat, a) === null);
}

/**
 * The companion's signature on the player's action (DESIGN §4.1, §4.9): no MP (D-066 #12); its cooldown (the
 * companion record's) counts down in the companion's turns; it resolves like any ability with the companion as caster.
 */
export function useSignature(ops: CombatOps, ctx: StepCtx, combat: CombatState, action: ActionOf<'companionCommand'>): void {
  const why = signatureProblem(ctx.content, combat, action);
  if (why !== null) ctx.reject(why);
  const { companion, ability, cooldown } = signatureOf(ctx.content, combat) as Exclude<ReturnType<typeof signatureOf>, string>;
  companion.cooldowns[ability.id] = cooldown;
  ctx.s.counters.abilitiesUsed[ability.id] = (ctx.s.counters.abilitiesUsed[ability.id] ?? 0) + 1;
  ctx.emit({ t: 'abilityUsed', uid: companion.uid, abilityId: ability.id });
  combatLog(combat, `${playerOf(combat).name} calls on ${companion.name}: ${ability.name}.`, 'info');
  resolveAbility(ops, ctx, combat, companion, ability, pickTargets(combat, companion, ability, action.targetUid) as Picked, 0);
}

// ---- combat items (DESIGN §7.9) ------------------------------------------------------------------------------------------

/** The abilities a consumable unleashes (its `grantAbility` passives: throwables such as an Ember Flask). */
export function itemAbilities(def: Item, content: ContentPack): Ability[] {
  return def.passives.flatMap((p) => (p.kind === 'grantAbility' && content.abilities[p.abilityId] ? [content.abilities[p.abilityId] as Ability] : []));
}

interface ItemUse {
  def: Item;
  /** Who its heals land on. */
  receiver: Combatant;
  /** Its unleashed ability's targets (null without one). */
  picked: Picked | null;
}

function itemUse(s: GameState, content: ContentPack, combat: CombatState, action: ActionOf<'item'>): ItemUse | string {
  const inst = s.player.inventory.find((i) => i.uid === action.uid);
  if (!inst) return 'You are not carrying that';
  const def = content.items[inst.itemId];
  if (!def) return `Unknown item '${inst.itemId}'`;
  if (def.type !== 'consumable') return `${def.name} cannot be used in a fight`;
  if (!def.usableInCombat || def.onUse.length === 0) return `${def.name} cannot be used in a fight`;
  const player = playerOf(combat);
  if (blocksAction(content, player, 'item')) return 'You cannot use items now';
  const unleashed = itemAbilities(def, content)[0];
  if (unleashed) {
    const picked = pickTargets(combat, player, unleashed, action.targetUid);
    return typeof picked === 'string' ? picked : { def, receiver: player, picked };
  }
  if (action.targetUid === undefined) return { def, receiver: player, picked: null };
  const t = combat.party.find((c) => c.uid === action.targetUid && isActive(c));
  return t ? { def, receiver: t, picked: null } : `'${action.targetUid}' is not one of your party`;
}

export function combatItemProblem(s: GameState, content: ContentPack, combat: CombatState, action: ActionOf<'item'>): string | null {
  const use = itemUse(s, content, combat, action);
  return typeof use === 'string' ? use : null;
}

/** One action per usable stack: per target for an unleashing item, else for the player and each other party member it heals. */
export function combatItemActions(s: GameState, content: ContentPack, combat: CombatState): ActionOf<'item'>[] {
  const out: ActionOf<'item'>[] = [];
  const player = playerOf(combat);
  for (const inst of s.player.inventory) {
    const def = content.items[inst.itemId];
    if (!def) continue;
    const unleashed = itemAbilities(def, content)[0];
    const heals = def.onUse.some((e) => 'heal' in e);
    const targets = unleashed ? targetOptions(combat, player, unleashed) : [undefined, ...(heals ? sideOf(combat, player).filter((c) => c !== player).map((c) => c.uid) : [])];
    for (const targetUid of targets) {
      const a: ActionOf<'item'> = targetUid === undefined ? { type: 'item', uid: inst.uid } : { type: 'item', uid: inst.uid, targetUid };
      if (combatItemProblem(s, content, combat, a) === null) out.push(a);
    }
  }
  return out;
}

/**
 * `item` in a fight (DESIGN §7.9, the turn's action): one is consumed, then its `onUse` effects in order — `heal` on the
 * chosen party member (× its healing modifiers; MP only for the player), `damage` on the player (never below 1 HP),
 * anything else as a world effect — then the abilities it unleashes resolve, free, as the player's.
 */
export function useCombatItem(ops: CombatOps, ctx: StepCtx, combat: CombatState, action: ActionOf<'item'>): void {
  const use = itemUse(ctx.s, ctx.content, combat, action);
  if (typeof use === 'string') return ctx.reject(use);
  const { def, receiver } = use;
  const inventory = ctx.s.player.inventory;
  const inst = inventory.find((i) => i.uid === action.uid);
  if (inst && def.consumeOnUse) {
    inst.qty -= 1;
    if (inst.qty <= 0) inventory.splice(inventory.indexOf(inst), 1);
    ctx.emit({ t: 'itemLost', itemId: def.id, qty: 1, reason: 'used' });
  }
  const player = playerOf(combat);
  const source = `item:${def.id}`;
  combatLog(combat, `${player.name} uses ${def.name}.`, 'info');
  for (const e of def.onUse) {
    if ('heal' in e) {
      const { hp, mp } = e.heal;
      if (hp !== undefined) healFlat(ctx, combat, receiver, hp === 'full' ? receiver.hpMax : hp, source);
      if (mp !== undefined && receiver.mpMax > 0) ops.addMp(ctx, combat, receiver, mp === 'full' ? receiver.mpMax : mp, source);
    } else if ('damage' in e) {
      player.hp = Math.max(1, player.hp - e.damage.hp);
    } else apply(e, ctx, { source });
  }
  for (const ability of itemAbilities(def, ctx.content)) {
    const picked = use.picked ?? (pickTargets(combat, player, ability) as Picked);
    resolveAbility(ops, ctx, combat, player, ability, picked, 0, 'item');
  }
}
