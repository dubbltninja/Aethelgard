// Engine-coded hooks ("specials", PLAN §5.4 Move.special, §5.7 Ability.special, §5.8 Status.special, §5.19 rule 3).
// A special names a scripted mechanic the declarative fields cannot express; the combat unit (U26) implements one
// function per id in `src/engine/combat/specials.ts` and its `SPECIALS` list must equal this one (content cannot import
// the engine, so the schema keeps this copy; `tests/unit/content/specials.test.ts` asserts the two are equal).
// Adding a special = add it here AND in the engine list, in the same change.
import { z } from 'zod';

export type SpecialScope = 'ability' | 'move' | 'status';

/** id → where content may use it, and what the engine does (one line; the engine file holds the rule). */
export const SPECIAL_INFO = {
  rewind: { scopes: ['ability', 'status'], summary: 'snapshot HP on application; on expiry HP = max(now, snapshot), cleanse Bleed/Burn/Poison (boss cap 10% max HP)' },
  phase: { scopes: ['ability', 'status'], summary: 'the next single-target attack against the holder misses and consumes it; AoE and Chrono ignore it' },
  taunt: { scopes: ['ability', 'status'], summary: 'single-target enemy intents retarget to the taunter at generation and execution' },
  cleanse: { scopes: ['ability', 'move'], summary: 'remove every negative status from the ability’s targets' },
  trap: { scopes: ['ability'], summary: 'a trap set out of combat springs at the start of the next fight at this node' },
  mark_execute: { scopes: ['ability'], summary: 'guaranteed crit against a Marked target' },
  chain: { scopes: ['ability', 'move'], summary: 'on a Soaked or Shocked target, repeat the hit at 50% on one other enemy' },
  counter_stance: { scopes: ['ability', 'move'], summary: 'Guard this round; each melee attacker takes the ability’s power as a counter-hit' },
  drain: { scopes: ['ability', 'move'], summary: 'heal the user for a share of the damage dealt' },
  unmaking: { scopes: ['ability', 'move'], summary: 'if the target dies, refund the HP spent on the cost' },
  resource_convert: { scopes: ['ability'], summary: 'pay the self-cost to gain resource (Blood Pact); exempt from the MP > 0 rule' },
  foresight: { scopes: ['ability'], summary: 'the party sees each enemy’s next-next intent as a dimmed second chip' },
  guard: { scopes: ['ability', 'move'], summary: 'the user also Guards this round' },
  hour_presses: { scopes: ['move'], summary: 'communion pressure: Chrono 8% of target max HP × (1 − Resolve/8); cannot kill while Resolve ≥ 3 (D-067.3)' },
  bound_mage: { scopes: ['move'], summary: 'Tyrant’s Reach dead spell: the variant is the bound mage rolled on spawn, no repeats at the Apex (WORLD §6.8)' },
  // U34e (D-091): the two specials the Ruins' anomalies needed
  class_mirror: { scopes: ['move'], summary: "the move deals the player's class type (Redundant Wayfinder, WORLD §6.8), and the creature resists that type" },
  last_spell: { scopes: ['move'], summary: "the move deals the damage type of the player's last ability this fight, else its own (Paradox Wisp, WORLD §6.5)" },
} as const satisfies Record<string, { scopes: readonly SpecialScope[]; summary: string }>;

export type SpecialId = keyof typeof SPECIAL_INFO;

/** The flat registry the engine mirrors. */
export const SPECIALS = Object.keys(SPECIAL_INFO) as SpecialId[];

/** Specials legal in one scope, for error messages and tests. */
export const specialsFor = (scope: SpecialScope): SpecialId[] =>
  SPECIALS.filter((id) => (SPECIAL_INFO[id].scopes as readonly SpecialScope[]).includes(scope));

/** A special id usable in `scope` (Ability.special → 'ability', Move.special → 'move', Status.special → 'status'). */
export function SpecialFor(scope: SpecialScope): z.ZodType<SpecialId> {
  const allowed = new Set<string>(specialsFor(scope));
  const where = scope === 'ability' ? 'an ability' : `a ${scope}`;
  return z.custom<SpecialId>((v) => typeof v === 'string' && allowed.has(v), (v: unknown) => ({
    message:
      typeof v === 'string' && Object.prototype.hasOwnProperty.call(SPECIAL_INFO, v)
        ? `special '${v}' is not usable on ${where} (allowed: ${[...allowed].join(', ')})`
        : `unknown special ${JSON.stringify(v)} for ${where} (expected one of: ${[...allowed].join(', ')}; new ones go in SPECIALS)`,
  }));
}

export const SpecialIdSchema: z.ZodType<SpecialId> = z.custom<SpecialId>(
  (v) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(SPECIAL_INFO, v),
  (v: unknown) => ({ message: `unknown special ${JSON.stringify(v)} (expected one of: ${SPECIALS.join(', ')})` }),
);
