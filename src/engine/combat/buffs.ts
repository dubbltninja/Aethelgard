// Scripted buffs (U26b; DESIGN §5 rows whose numbers no declarative field can carry; D-078). What each one does is
// BUFFS[ability id] below; who receives it and for how long is the ability's script (abilities.ts ABILITY_SCRIPTS `buff`).
//
// A buff is a fight timer `buff:<ability id>` in its HOLDER's own `Combatant.cooldowns`, counted in the holder's turns like
// a status (+1 when set during the holder's own turn, D-066 #4): an enemy's or a companion's table counts down at its turn
// end (reducers/combat.ts); the player's own Combatant table — otherwise unused, the player's ability cooldowns and fight
// timers live in `CombatState.cooldowns` — counts down at the player's turn end (buffHooks.ts). Keeping the timer on the
// holder lets the damage pipeline read a buff from the Combatant alone (damage.ts: crit, evasion, resistance steps, the hit
// cap, dealt/taken multipliers). A `round` buff (Iron Guard's companion) ends when the player's next turn begins.
//
// One-shot effects that wait until used are tags on the holder's `pattern.firedOnce` (fight-scoped, like flee.ts's sure
// flee): the next attack crits (Shadowstep), the next ability of a branch costs no MP (Breach Echo), and the abilities used
// so far this fight (Crescendo's verses). A bonus action (The Moment Between) is `bonus:<ability id>` in the player's own
// table: pending until the turn that cast it ends, active through the bonus action (buffHooks.ts).
//
// Pure: no rng, no events, no import of another combat module (damage.ts, statuses.ts and turnOrder.ts read this one).
import type { Combatant, DamageType, Resistance } from '../types/state';

type Holder = Pick<Combatant, 'cooldowns'>;
type Tagged = Pick<Combatant, 'pattern'>;

/** `buff:<ability id>` in the holder's `Combatant.cooldowns`: turns left. */
export const BUFF_KEY = 'buff:';
/** `bonus:<ability id>` in the player's `Combatant.cooldowns`: a bonus action, pending (1) or active (2). */
export const BONUS_KEY = 'bonus:';
export const BONUS_PENDING = 1;
export const BONUS_ACTIVE = 2;
/** What a `round` buff is set to: it survives the turn ends before the player's next turn begins, which clears it. */
export const ROUND_BUFF_TURNS = 2;
/** Tag: the holder's next attack is a guaranteed crit (Shadowstep). */
export const NEXT_CRIT_TAG = 'next_crit';
/** Tag prefix `free_cast:<branch>`: the holder's next ability of that branch costs no MP (Breach Echo). */
export const FREE_CAST_TAG = 'free_cast:';
/** Tag prefix `used:<ability id>`: the player has used that ability in this fight (Crescendo's verses). */
export const USED_TAG = 'used:';
/** A counter-hit's `HitSpec.source` prefix (= specials.ts COUNTER_SOURCE): it never spends a held crit nor is reflected. */
export const COUNTER_PREFIX = 'counter:';

/** DESIGN §5.5 Null Plate / Iron Silence: the magical damage types. */
export const MAGIC_TYPES: readonly DamageType[] = ['fire', 'storm', 'ley', 'void', 'chrono'];
/** DESIGN §4.4: the resistance ladder, one step at a time toward immune. */
export const RESIST_LADDER: readonly Resistance[] = ['weak', 'neutral', 'resist', 'immune'];

/** The actions a buff may forbid (statuses.ts `blocksAction`). */
export type BlockableAction = 'ability' | 'item' | 'flee' | 'guard';

/** A heat aura: an opponent's Physical single-target blow that connects is answered (Cinder Shield). */
export interface Aura {
  type: DamageType;
  coef: number;
  stat: 'atk' | 'sp';
  /** The status the answer may leave on the attacker, its chance and turns. */
  status: string;
  chance: number;
  duration: number;
}

export interface BuffEffect {
  /** + crit chance (Hunter's Eye +20). */
  critFlat?: number;
  /** The crit multiplier is at least this (Hunter's Eye ×1.75). */
  critMult?: number;
  /** + evasion (Dancer's Guard +25). */
  evasionFlat?: number;
  /** MP on each blow that misses the holder (Dancer's Guard +5, on top of the Elf's dodge resource). */
  dodgeMp?: number;
  /** The holder's class resource generation × this (Apex Predator ×2). */
  resourceMult?: number;
  /** The DoTs the holder applied tick twice per turn (Apex Predator). */
  dotsTwice?: true;
  aura?: Aura;
  /** Damage the holder deals, by type (Heart of the Grove: Ley ×1.3). */
  dealtMult?: Partial<Record<DamageType, number>>;
  /** Damage the holder takes from hits (Iron Guard's companion ×0.75). */
  takenMult?: number;
  /** Ends when the player's next turn begins ("this round"). */
  round?: true;
  /** No single hit takes more than this share of the holder's max HP (Unbroken 25 %). */
  hitCapPctMax?: number;
  /** Statuses the holder cannot be given: a list (Unbroken: Stun, Slow) or every debuff (Oathbound). */
  immune?: readonly string[] | 'debuffs';
  /** One resistance step toward immune against these types (Null Plate). */
  resistStep?: readonly DamageType[];
  /** Immune to these types (Iron Silence). */
  immuneTo?: readonly DamageType[];
  /** This share of each hit's damage (HP and Shield) goes back to the attacker as Physical (Last Bastion). */
  reflectPct?: number;
  /** This share of what the holder's Shield absorbs heals it (Leech Veil). */
  absorbHealPct?: number;
  /** This share of all damage the holder takes heals its opponents, split evenly (Soul Tether, on the target). */
  tetherPct?: number;
  /** The holder acts first in the next round's order (Blink Strike). */
  actsFirst?: true;
  /** Actions the holder cannot take (Mountainfall: no Guard next turn). */
  blocks?: readonly BlockableAction[];
}

/** DESIGN §5.2–5.6, the rows whose buff no declarative field can carry, by ability id (durations: ABILITY_SCRIPTS). */
export const BUFFS: Readonly<Record<string, BuffEffect>> = {
  rgr_hunters_eye: { critFlat: 20, critMult: 1.75 },
  rgr_apex_predator: { dotsTwice: true, resourceMult: 2 },
  wiz_cinder_shield: { aura: { type: 'fire', coef: 0.5, stat: 'sp', status: 'status_burn', chance: 0.5, duration: 3 } },
  elf_dancers_guard: { evasionFlat: 25, dodgeMp: 5 },
  elf_heart_of_the_grove: { dealtMult: { ley: 1.3 } },
  elf_blink_strike: { actsFirst: true },
  wrd_iron_guard: { takenMult: 0.75, round: true },
  wrd_unbroken: { hitCapPctMax: 0.25, immune: ['status_stun', 'status_slow'] },
  wrd_last_bastion: { reflectPct: 0.25 },
  wrd_mountainfall: { blocks: ['guard'] },
  wrd_null_plate: { resistStep: MAGIC_TYPES },
  wrd_oathbound: { immune: 'debuffs' },
  wrd_iron_silence: { immuneTo: MAGIC_TYPES },
  wvr_leech_veil: { absorbHealPct: 0.3 },
  wvr_soul_tether: { tetherPct: 0.4 },
};

// ---- reading ---------------------------------------------------------------------------------------------------------------

export interface ActiveBuff {
  id: string;
  effect: BuffEffect;
}

/** The holder's buffs with turns left (tolerates a holder without a table: an out-of-combat resistance holder). */
export function buffsOn(c: Partial<Holder>): ActiveBuff[] {
  const out: ActiveBuff[] = [];
  for (const [key, left] of Object.entries(c.cooldowns ?? {})) {
    if (!key.startsWith(BUFF_KEY) || !(left > 0)) continue;
    const id = key.slice(BUFF_KEY.length);
    const effect = BUFFS[id];
    if (effect) out.push({ id, effect });
  }
  return out;
}

const sum = (c: Partial<Holder>, f: (e: BuffEffect) => number | undefined): number => buffsOn(c).reduce((n, b) => n + (f(b.effect) ?? 0), 0);
const product = (c: Partial<Holder>, f: (e: BuffEffect) => number | undefined): number => buffsOn(c).reduce((n, b) => n * (f(b.effect) ?? 1), 1);
const first = <T>(c: Partial<Holder>, f: (e: BuffEffect) => T | undefined): { id: string; value: T } | null => {
  for (const b of buffsOn(c)) {
    const value = f(b.effect);
    if (value !== undefined) return { id: b.id, value };
  }
  return null;
};

export const critBonusOf = (c: Partial<Holder>): number => sum(c, (e) => e.critFlat);
export const evasionBonusOf = (c: Partial<Holder>): number => sum(c, (e) => e.evasionFlat);
export const dodgeMpOf = (c: Partial<Holder>): { id: string; value: number } | null => first(c, (e) => e.dodgeMp);
export const dealtMultOf = (c: Partial<Holder>, type: DamageType): number => product(c, (e) => e.dealtMult?.[type]);
export const takenMultOf = (c: Partial<Holder>): number => product(c, (e) => e.takenMult);
export const resourceMultOf = (c: Partial<Holder>): { id: string; value: number } | null => first(c, (e) => e.resourceMult);
export const dotsTwice = (c: Partial<Holder>): boolean => buffsOn(c).some((b) => b.effect.dotsTwice === true);
export const auraOf = (c: Partial<Holder>): { id: string; value: Aura } | null => first(c, (e) => e.aura);
export const reflectOf = (c: Partial<Holder>): { id: string; value: number } | null => first(c, (e) => e.reflectPct);
export const absorbHealOf = (c: Partial<Holder>): { id: string; value: number } | null => first(c, (e) => e.absorbHealPct);
export const tetherOf = (c: Partial<Holder>): { id: string; value: number } | null => first(c, (e) => e.tetherPct);
export const actsFirst = (c: Partial<Holder>): boolean => buffsOn(c).some((b) => b.effect.actsFirst === true);
export const buffBlocks = (c: Partial<Holder>, action: BlockableAction): boolean => buffsOn(c).some((b) => b.effect.blocks?.includes(action) ?? false);

/** The crit multiplier: the holder's own, or a buff's if larger (Hunter's Eye). */
export function critMultOf(c: Partial<Holder> & Pick<Combatant, 'critMult'>): number {
  return buffsOn(c).reduce((m, b) => Math.max(m, b.effect.critMult ?? 0), c.critMult);
}

/** The most HP one hit may take from the holder (Unbroken: ⌊25 % of max HP⌋, at least 1), or null. */
export function hitCapOf(c: Partial<Holder> & Pick<Combatant, 'hpMax'>): number | null {
  const pcts = buffsOn(c).flatMap((b) => (b.effect.hitCapPctMax === undefined ? [] : [b.effect.hitCapPctMax]));
  return pcts.length === 0 ? null : Math.max(1, Math.floor(Math.min(...pcts) * c.hpMax));
}

/** `base` (DESIGN §4.4 step 5, after D-067.18) under the holder's buffs: immune (Iron Silence), else one step per buff (Null Plate). */
export function buffedResistance(c: Partial<Holder>, type: DamageType, base: Resistance): Resistance {
  const buffs = buffsOn(c);
  if (buffs.length === 0) return base;
  if (buffs.some((b) => b.effect.immuneTo?.includes(type))) return 'immune';
  const steps = buffs.filter((b) => b.effect.resistStep?.includes(type)).length;
  return RESIST_LADDER[Math.min(RESIST_LADDER.length - 1, RESIST_LADDER.indexOf(base) + steps)] ?? base;
}

/** Can a buff keep `statusId` (of content kind `kind`) off the holder (Unbroken: Stun/Slow; Oathbound: every debuff)? */
export function buffImmune(c: Partial<Holder>, statusId: string, kind: string | undefined): boolean {
  return buffsOn(c).some(({ effect: e }) => (e.immune === 'debuffs' ? kind === 'debuff' : (e.immune?.includes(statusId) ?? false)));
}

// ---- tags ------------------------------------------------------------------------------------------------------------------

export const hasTag = (c: Partial<Tagged>, tag: string): boolean => c.pattern?.firedOnce.includes(tag) ?? false;

/** The holder's next attack crits (Shadowstep) — not a counter-hit. */
export const holdsNextCrit = (c: Partial<Tagged>, source: string): boolean => !source.startsWith(COUNTER_PREFIX) && hasTag(c, NEXT_CRIT_TAG);

export function addTag(c: Tagged, tag: string): void {
  if (!c.pattern.firedOnce.includes(tag)) c.pattern.firedOnce.push(tag);
}

export function removeTag(c: Tagged, tag: string): boolean {
  const i = c.pattern.firedOnce.indexOf(tag);
  if (i < 0) return false;
  c.pattern.firedOnce.splice(i, 1);
  return true;
}

// ---- writing timers ----------------------------------------------------------------------------------------------------------

/** Puts buff `id` on the holder for `turns` of its turns (+1 when set during its own turn); 'round': until the player's next turn. */
export function setBuff(holder: Holder, id: string, turns: number | 'round', ownTurn: boolean): number {
  const value = turns === 'round' ? ROUND_BUFF_TURNS : turns + (ownTurn ? 1 : 0);
  holder.cooldowns[`${BUFF_KEY}${id}`] = value;
  return value;
}

/** One turn off each of the holder's buff timers (the player's own table only; others count down in the reducer). Returns the ids that ended. */
export function countDownBuffs(holder: Holder): string[] {
  const ended: string[] = [];
  for (const key of Object.keys(holder.cooldowns)) {
    if (!key.startsWith(BUFF_KEY)) continue;
    const left = (holder.cooldowns[key] ?? 0) - 1;
    if (left > 0) holder.cooldowns[key] = left;
    else {
      delete holder.cooldowns[key];
      ended.push(key.slice(BUFF_KEY.length));
    }
  }
  return ended;
}

/** Removes the holder's `round` buffs (the player's turn begins). Returns their ids. */
export function clearRoundBuffs(holder: Holder): string[] {
  const ended: string[] = [];
  for (const key of Object.keys(holder.cooldowns)) {
    const id = key.startsWith(BUFF_KEY) ? key.slice(BUFF_KEY.length) : null;
    if (id === null || !BUFFS[id]?.round) continue;
    delete holder.cooldowns[key];
    ended.push(id);
  }
  return ended;
}

// ---- the bonus action (The Moment Between) ------------------------------------------------------------------------------------

/** The holder's bonus action: pending (granted this turn), active (being taken), or none. */
export function bonusState(c: Partial<Holder>): 'pending' | 'active' | null {
  for (const [key, v] of Object.entries(c.cooldowns ?? {})) {
    if (!key.startsWith(BONUS_KEY)) continue;
    if (v === BONUS_PENDING) return 'pending';
    if (v === BONUS_ACTIVE) return 'active';
  }
  return null;
}
