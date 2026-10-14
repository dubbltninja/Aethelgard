// What the Loom sets for a run (U31; DESIGN §10.7 Attunements, §15.1 challenge modifiers; D-011, D-021, D-082): the
// readers every system uses. A leaf module (types, content and util only) so `derive`, effects, combat and the Threshold
// reducer can all read it without an import cycle.
//
// Attunements. A run's active set is fixed when it starts (`newRun`, from `loopAttunements`): the profile's equipped
// ones (at most `config.attunementEquipCap`) that the pack knows, none under a `disable_attunements` modifier (Iron
// Loop); stored in `player.attunements`. Their effects, by where they act:
//   loop start (newRun)   start_gold, start_item, stat (as `passiveBonuses`), ability_points, clock_watches (halved toward
//                         zero by Frayed Clock, DESIGN §10.1), reveal_region (the region's places discovered)
//   derive()              hp_max_pct, mp_max_pct, custom `crit` { amount } (Keen Eye)
//   XP                    xp_pct — with the gear's kill-XP bonus at most +20 % (DESIGN §10.7 hard cap, XP_BONUS_CAP)
//   combat                custom `second_wind` (reducers/combat.ts), `reveal_resistances` (Echo-Sense, combat/rewards.ts)
//   explore               custom `travel_regen` { hpPct, mpPct } (Light Step), `remembered_steps`, `free_inn_rest` (Old
//                         Road) — reducers/explore.ts
//   not read yet          shop_discount_pct and custom `forge_discount` { pct } (economy/crafting, U34), custom
//                         `foresight` (intents), custom `loyalty_gain` { pct } and loyalty_start (recruitment and the
//                         loyalty effect, U32/U33), rest_heal_pct, flee_pct (no DESIGN row uses them)
// Modifiers (`meta.modifiers`, copied from the profile's toggles when the run starts): `clock_base_watches` (newRun) and
// its halving (effects.ts `changeLimit`, and the Attunement clock above), `damage_multiplier` (combat/damage.ts on hits,
// `modifierDamageMult` on DoT ticks), `xp_sources` (no kill XP; the other XP ×2, VOW_XP_MULT), `disable_attunements`
// (here), `disable_echo_shortcuts` (Mute Ley: echoes.ts, U32). Not read yet: `elite_chance` (Horde Rising: +1 enemy
// from the region pool and 30 % elite variants — encounter setup has no elite-variant form). Their Resonance
// multipliers are engine constants (`MODIFIER_RESONANCE_MULT`, no schema field, D-082), applied to the loop's total at
// its end (reducers/threshold.ts).
import type { Attunement, AttunementEffect } from '@schema/attunement';
import type { ModifierRule } from '@schema/modifier';
import type { ContentPack } from './ctx';
import type { Profile } from './types/profile';
import type { PlayerState } from './types/state';
import { round } from './util/math';

/** DESIGN §10.7: "XP bonuses from all sources ≤ +20 %". */
export const XP_BONUS_CAP = 0.2;
/** DESIGN §15.1 Pacifist's Vow: quest and discovery XP ×2 while kill XP is 0. */
export const VOW_XP_MULT = 2;
/** DESIGN §15.1: each modifier's Resonance multiplier (no schema field; D-082). Unknown ids multiply by 1. */
export const MODIFIER_RESONANCE_MULT: Readonly<Record<string, number>> = {
  mod_iron_loop: 1.25,
  mod_frayed_clock: 1.25,
  mod_mute_ley: 1.25,
  mod_horde_rising: 1.25,
  mod_glass: 1.5,
  mod_pacifist: 1.5,
};
/** DESIGN §15.1: "Multipliers stack multiplicatively, capped at ×3.0". */
export const RESONANCE_MULT_CAP = 3;

/** `custom` Attunement script ids (AttunementSchema `custom.scriptId`; DESIGN §10.7). */
export const ATT_SCRIPT = {
  /** Keen Eye: `{ amount: 3 }` crit chance. */
  crit: 'crit',
  /** Second Wind: once per loop from Loop 2, a killing blow leaves 1 HP. */
  secondWind: 'second_wind',
  /** Echo-Sense: creature resistances shown on first sight (not `echo_…`: that prefix is the Echo ids'). */
  echoSense: 'reveal_resistances',
  /** Light Step: `{ hpPct: 0.05, mpPct: 0.1 }` more travel regen per watch. */
  travelRegen: 'travel_regen',
  /** Remembered Steps: once per day the first travel along a remembered edge costs no watch. */
  rememberedSteps: 'remembered_steps',
  /** Old Road: one free inn rest per loop. */
  freeInnRest: 'free_inn_rest',
  /** Foresight (not read yet): intents one turn earlier. */
  foresight: 'foresight',
  /** Borin's Favor (not read yet, U34): `{ pct: 0.15 }` off Emberforge fees. */
  forgeDiscount: 'forge_discount',
  /** Companion's Trust (not read yet, U32/U33): `{ pct: 0.25 }` more loyalty gained. */
  loyaltyGain: 'loyalty_gain',
} as const;

// ---- challenge modifiers --------------------------------------------------------------------------------------------------

/** Every rule of `kind` among the run's modifiers, in modifier order. */
export function modifierRules<K extends ModifierRule['kind']>(
  modifierIds: readonly string[],
  content: ContentPack,
  kind: K,
): Extract<ModifierRule, { kind: K }>[] {
  const out: Extract<ModifierRule, { kind: K }>[] = [];
  for (const id of modifierIds) {
    for (const rule of content.modifiers[id]?.rules ?? []) if (rule.kind === kind) out.push(rule as Extract<ModifierRule, { kind: K }>);
  }
  return out;
}

export const hasModifierRule = (modifierIds: readonly string[], content: ContentPack, kind: ModifierRule['kind']): boolean =>
  modifierRules(modifierIds, content, kind).length > 0;

/** The product of the modifiers' Resonance multipliers, capped at ×3 (DESIGN §15.1). */
export function resonanceMultiplier(modifierIds: readonly string[]): number {
  let mult = 1;
  for (const id of modifierIds) mult *= MODIFIER_RESONANCE_MULT[id] ?? 1;
  return Math.min(RESONANCE_MULT_CAP, mult);
}

/**
 * The run's `damage_multiplier` on damage a party member (`holderIsParty`) or an enemy takes from a DoT tick: Glass ×2
 * "both ways, including DoT ticks" (DESIGN §15.1) — incoming for the party, outgoing (the party's DoTs) for enemies.
 */
export function modifierDamageMult(modifierIds: readonly string[], content: ContentPack, holderIsParty: boolean): number {
  let mult = 1;
  for (const rule of modifierRules(modifierIds, content, 'damage_multiplier')) mult *= holderIsParty ? rule.incoming : rule.outgoing;
  return mult;
}

/** True when a run modifier withholds kill XP (Pacifist's Vow's `xp_sources` without 'combat'). */
export const killXpWithheld = (modifierIds: readonly string[], content: ContentPack): boolean =>
  modifierRules(modifierIds, content, 'xp_sources').some((r) => !r.allow.includes('combat'));

// ---- Attunements ------------------------------------------------------------------------------------------------------------

/**
 * The Attunements a loop starting now carries: the profile's equipped ones the pack knows, first `cap` of them; none
 * while a run modifier disables them (Iron Loop, DESIGN §15.1).
 */
export function loopAttunements(profile: Readonly<Profile>, content: ContentPack, modifierIds: readonly string[]): string[] {
  if (hasModifierRule(modifierIds, content, 'disable_attunements')) return [];
  const known = profile.attunements.equipped.filter((id, i, all) => content.attunements[id] !== undefined && all.indexOf(id) === i);
  return known.slice(0, content.config.attunementEquipCap);
}

export interface ActiveEffect {
  attunementId: string;
  effect: AttunementEffect;
}

/** Every effect of the player's active Attunements, in Attunement then effect order. */
export function attunementEffects(player: Pick<PlayerState, 'attunements'>, content: ContentPack): ActiveEffect[] {
  const out: ActiveEffect[] = [];
  for (const id of player.attunements ?? []) {
    const def: Attunement | undefined = content.attunements[id];
    for (const effect of def?.effects ?? []) out.push({ attunementId: id, effect });
  }
  return out;
}

type PctEffect = Extract<AttunementEffect, { pct: number }>;

/** The summed `pct` of the active Attunements' effects of `kind` (hp_max_pct, mp_max_pct, xp_pct …). */
export function attunementPct(player: Pick<PlayerState, 'attunements'>, content: ContentPack, kind: PctEffect['kind']): number {
  let sum = 0;
  for (const { effect } of attunementEffects(player, content)) if (effect.kind === kind) sum += (effect as PctEffect).pct;
  return sum;
}

/** The first active Attunement scripting `scriptId`, with its params; undefined when none does. */
export function attunementScript(
  player: Pick<PlayerState, 'attunements'>,
  content: ContentPack,
  scriptId: string,
): { attunementId: string; params: Record<string, unknown> } | undefined {
  for (const { attunementId, effect } of attunementEffects(player, content)) {
    if (effect.kind === 'custom' && effect.scriptId === scriptId) return { attunementId, params: effect.params };
  }
  return undefined;
}

/** A numeric script parameter (0 when the script is inactive or the param is missing). */
export function scriptNumber(player: Pick<PlayerState, 'attunements'>, content: ContentPack, scriptId: string, param: string): number {
  const value = attunementScript(player, content, scriptId)?.params[param];
  return typeof value === 'number' ? value : 0;
}

// ---- XP ---------------------------------------------------------------------------------------------------------------------

/** The XP bonus beside `other` bonuses (the gear's kill-XP): + the Attunements' xp_pct, capped at +20 % in all. */
export const xpBonus = (player: Pick<PlayerState, 'attunements'>, content: ContentPack, other = 0): number =>
  Math.min(XP_BONUS_CAP, other + attunementPct(player, content, 'xp_pct'));

/**
 * XP from anything but a kill (quests, discovery, events; the `xp` effect): the Attunements' bonus, and ×2 under
 * Pacifist's Vow (DESIGN §15.1), rounded half up. Kill XP has its own path (combat/rewards.ts).
 */
export function scaleXp(player: Pick<PlayerState, 'attunements'>, modifierIds: readonly string[], content: ContentPack, amount: number): number {
  if (amount <= 0) return amount;
  const vow = killXpWithheld(modifierIds, content) ? VOW_XP_MULT : 1;
  return round(amount * (1 + xpBonus(player, content)) * vow);
}
