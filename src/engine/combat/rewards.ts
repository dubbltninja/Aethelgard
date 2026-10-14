// The end of a won fight and the bestiary (DESIGN §6.2 kill XP, §6.6 loop nudge, §7.2–7.3 rarity and affixes, §7.8 the
// pack, §9 gold, §4.2 bestiary reveals, §10.6 Resonance, §16.3 bestiary screen; D-055; PLAN §4.10, §8.1).
//
// Spoils (`rollSpoils`, the reducer's victory): per fallen enemy in slot order — its gold roll (`rng.int(min, max)`, no
// draw when min = max), then its loot rows in order (each `when`, then its `chance`, then for gear that rolls its rarity
// the rarity and affix draws, per piece), then its `onDefeat` effects; the kill XP is summed (Pacifist's Vow: 0). A
// withdrawn creature (`leaveCombat`) and a survival win give nothing. D-055 (the first Corrupted Shade each loop always
// drops `item_dark_spellbook`, later ones 50 %) is data: two loot rows gated on `flag_spellbook_dropped`, which the
// Shade's `onDefeat` sets (PLAN §5.4); run flags reset with the loop.
// Kill XP (DESIGN §6.2): the creature's authored `xp` × the loop nudge (§6.6). The role multipliers — elite ×1.8,
// anomaly ×1.3 — are part of that authored number (WORLD §6: the L6 elite Golem 200, the L4 anomaly Wisp 92), so the
// engine does not apply them again; `expectedKillXp` is DESIGN's formula for content checks. The fight's summed kill XP
// then gains the best equipped `kill_xp` bonus (U26b, DESIGN §7.3 `affix_of_echoes`: a trinket's `custom` passive
// `{ scriptId: 'kill_xp', params: { pct: 0.1 } }`, a `unique` affix — "not stackable": one copy counts, and bonuses from
// several sources do not add up), rounded half-up.
// Rarity (DESIGN §7.2): a weapon/armor/trinket whose `rarityRule` is 'rolled' and whose loot row names no rarity draws
// one from `config.rarityWeights` for the fight's band — the location's level band minimum, else its region's — and
// then its affixes (§7.3): Uncommon 50 % one, Rare one, Epic one or two, Legendary two; distinct, among the affixes that
// have an effect on that slot, after any `fixedAffixes`, never more than the rarity allows.
// The pack (DESIGN §7.8): what fits goes in (stacks first, then free slots of the 40; Satchel items always fit); the
// rest is left on the ground at the fight's node (effects.ts `leaveOnGround`) with a log line — the player takes it
// later, before the next dawn (reducers/loop.ts `expireGroundLoot`, U26b).
//
// The bestiary (profile, written through the lazy draft; PLAN §4.3 `BestiaryEntry`):
//   kills    at the moment of the kill (`recordKill`, from the reducer's knock-out): killed + 1; resistances are shown
//            from the first kill (`revealed` ≥ 'resist'; DESIGN §4.2 "after the first kill of that family", so the
//            family's other entries rise too, and a new entry of that family starts at 'resist'); deeper reveals at the
//            creature's own `bestiary.reveals` kill counts ('pattern', 'all'); the first entry of an id ever (kill or
//            spare) pays `config.resonance.bestiary` (+3) once, keyed `kill:<id>` in `profile.discoveries` (§10.6)
//   seen     when the fight ends, however it ends: + 1 per creature that stood in it (adds included)
//   intents  each intent chip the player sees at the start of a turn (not hidden) adds its move id to `intentsSeen`
// Echo-Sense (U31, DESIGN §10.7 `att_echo_sense`): while it is active, every creature in sight at a player turn has its
// resistances revealed at once (`revealed` ≥ 'resist'). The kill XP bonus also counts Quick Study (`xp_pct`): at most
// +20 % from all sources (runRules.ts `xpBonus`).
import type { Item } from '@schema/item';
import type { Creature } from '@schema/creature';
import type { Effect } from '@schema/effect';
import { claimBeforeSpoils } from '../before';
import { evaluate } from '../conditions';
import type { ContentPack, StepCtx } from '../ctx';
import { derive } from '../derived';
import { addItem, apply, applyAll, leaveOnGround } from '../effects';
import { lootBand, rollAffixes, rollRarity } from '../rarity';
import { PACK_SLOTS, inSatchel, packSlotsUsed } from '../reducers/inventory';
import { ATT_SCRIPT, attunementScript, xpBonus } from '../runRules';
import type { BestiaryEntry } from '../types/profile';
import type { CombatState, GameState, ItemInstance, Rarity } from '../types/state';
import { round } from '../util/math';
import { roundHalfUp } from './damage';
import { loopNudge } from './turnOrder';

/** What a won fight pays (the `combatEnded` numbers). */
export interface Spoils {
  xp: number;
  gold: number;
  /** Every drop: what went into the pack and what was left on the ground. */
  loot: ItemInstance[];
}

/** `profile.discoveries` key prefix of a first bestiary entry (DESIGN §10.6). */
export const BESTIARY_DISCOVERY = 'kill:';

// ---- XP -----------------------------------------------------------------------------------------------------------------

/** DESIGN §6.2 kill XP: the creature's XP × the loop nudge (§6.6), rounded half-up. */
export function creatureXp(s: GameState, content: ContentPack, creatureId: string): number {
  const def = content.creatures[creatureId];
  return def ? round(def.xp * loopNudge(s, content)) : 0;
}

/** DESIGN §7.3 `affix_of_echoes`: the `custom` passive script id of a kill-XP bonus (`params.pct`). */
export const KILL_XP_SCRIPT = 'kill_xp';

/** The best kill-XP bonus the player's gear carries (`kill_xp` passives; a unique affix counts once, bonuses do not stack). */
export function killXpBonus(s: GameState, content: ContentPack): number {
  let best = 0;
  for (const p of derive(s.player, content).passives) {
    const pct = p.kind === 'custom' && p.scriptId === KILL_XP_SCRIPT ? p.params.pct : undefined;
    if (typeof pct === 'number' && pct > best) best = pct;
  }
  return best;
}

/** Pacifist's Vow and friends: a run modifier `xp_sources` that does not allow 'combat' zeroes kill XP (DESIGN §6.2). */
export function combatXpAllowed(s: GameState, content: ContentPack): boolean {
  return !s.meta.modifiers.some((id) => content.modifiers[id]?.rules.some((r) => r.kind === 'xp_sources' && !r.allow.includes('combat')) ?? false);
}

/**
 * DESIGN §6.2's formula for a creature's authored XP: the fodder value round(a + b·L + c·L²), elites × 1.8 and anomalies
 * × 1.3 of that value, rounded (WORLD §6: L12 anomaly 289 × 1.3 = 376). Bosses are hand-set (null).
 */
export function expectedKillXp(def: Pick<Creature, 'role' | 'level'>, content: ContentPack): number | null {
  const { a, b, c, eliteMult, anomalyMult } = content.config.fodderXp;
  if (def.role === 'boss') return null;
  const mult = def.role === 'elite' ? eliteMult : def.role === 'anomaly' ? anomalyMult : 1;
  return round(round(a + b * def.level + c * def.level * def.level) * mult);
}

// ---- rarity and affixes -------------------------------------------------------------------------------------------------------

// The rolls live in the leaf module ../rarity.ts (U34: the `giveItem` effect and merchant stock share them); re-exported.
export { UNCOMMON_AFFIX_CHANCE, affixCount, lootBand, rollAffixes, rollRarity } from '../rarity';

// ---- the pack -----------------------------------------------------------------------------------------------------------------

/** How many of `qty` × `def` (at `rarity`) fit in the pack: existing stacks, then free slots (DESIGN §7.8). */
export function packRoom(s: GameState, content: ContentPack, def: Item, rarity: Rarity, qty: number): number {
  if (inSatchel(def)) return qty;
  const free = Math.max(0, PACK_SLOTS - packSlotsUsed(s, content));
  if (!def.stackable) return Math.min(qty, free);
  let room = free * def.maxStack;
  for (const stack of s.player.inventory) if (stack.itemId === def.id && stack.rarity === rarity) room += Math.max(0, def.maxStack - stack.qty);
  return Math.min(qty, room);
}

const copyItem = (i: ItemInstance): ItemInstance => ({ ...i, affixes: [...i.affixes] });

/**
 * Puts `qty` × `itemId` (at `rarity`, with `affixes` for gear) into the pack as far as it fits — `itemGiven` with
 * `source` — and the rest on the ground at `locationId`. Returns the loot entries (pack part, then ground part).
 */
export function placeLoot(ctx: StepCtx, locationId: string, itemId: string, qty: number, rarity: Rarity, affixes: readonly string[], source: string): ItemInstance[] {
  const { s, content } = ctx;
  const def = content.items[itemId];
  if (!def) throw new Error(`rewards: unknown item '${itemId}'`);
  const out: ItemInstance[] = [];
  const fit = packRoom(s, content, def, rarity, qty);
  const give = (item: ItemInstance): void => {
    out.push(item);
    ctx.emit({ t: 'itemGiven', item: copyItem(item), source });
  };
  if (fit > 0 && def.stackable) give({ ...copyItem(addItem(ctx, itemId, fit, rarity)[0] as ItemInstance), qty: fit });
  for (let k = 0; k < fit && !def.stackable; k++) {
    const item: ItemInstance = { uid: ctx.uid('i'), itemId, qty: 1, rarity, affixes: [...affixes] };
    s.player.inventory.push(item);
    give(copyItem(item));
  }
  const rest = qty - fit;
  if (rest > 0) {
    for (let left = rest; left > 0; ) {
      const n = def.stackable ? Math.min(left, def.maxStack) : 1;
      const item: ItemInstance = { uid: ctx.uid('i'), itemId, qty: n, rarity, affixes: [...affixes] };
      leaveOnGround(ctx, locationId, item);
      out.push(copyItem(item));
      left -= n;
    }
    ctx.log(`Your pack is full: ${def.name}${rest > 1 ? ` ×${rest}` : ''} is left on the ground.`, 'system');
  }
  return out;
}

// ---- spoils ---------------------------------------------------------------------------------------------------------------------

/** One loot row's drop (its `when` and `chance` already passed): gear rolls rarity and affixes per piece. */
function dropRow(ctx: StepCtx, combat: CombatState, creature: Creature, row: Creature['loot'][number]): ItemInstance[] {
  const def = ctx.content.items[row.itemId];
  if (!def) throw new Error(`rewards: unknown item '${row.itemId}'`);
  const source = `loot:${creature.id}`;
  if (def.stackable || !def.slot) return placeLoot(ctx, combat.locationId, row.itemId, row.count, row.rarity ?? def.fixedRarity, def.fixedAffixes, source);
  const out: ItemInstance[] = [];
  for (let i = 0; i < row.count; i++) {
    const rolled = def.rarityRule === 'rolled';
    const rarity = row.rarity ?? (rolled ? rollRarity(ctx, lootBand(ctx.content, combat.locationId, creature.level)) : def.fixedRarity);
    const affixes = rolled ? rollAffixes(ctx, def, rarity) : def.fixedAffixes;
    out.push(...placeLoot(ctx, combat.locationId, row.itemId, 1, rarity, affixes, source));
  }
  return out;
}

/**
 * A won fight's spoils (see the file header for the order of draws): per fallen enemy its gold, loot and `onDefeat`
 * effects; the summed kill XP with the gear's kill-XP bonus. Applies loot and `onDefeat`; the caller pays gold and XP.
 */
export function rollSpoils(ctx: StepCtx, combat: CombatState): Spoils {
  const { s, content } = ctx;
  const spoils: Spoils = { xp: 0, gold: 0, loot: [] };
  const xpAllowed = combatXpAllowed(s, content);
  const pays = claimBeforeSpoils(ctx, combat.locationId, combat.encounterId); // U32: the Before pays once per loop (D-067.5)
  for (const enemy of combat.enemies.filter((e) => !e.alive)) {
    const def = content.creatures[enemy.refId];
    if (!def) continue;
    if (xpAllowed && pays) spoils.xp += creatureXp(s, content, enemy.refId);
    if (pays) spoils.gold += def.gold.min === def.gold.max ? def.gold.min : ctx.rng.int(def.gold.min, def.gold.max);
    for (const row of pays ? def.loot : []) {
      if (row.when !== undefined && !evaluate(row.when, s, ctx.profile, content)) continue;
      if (!ctx.rng.chance(row.chance)) continue;
      spoils.loot.push(...dropRow(ctx, combat, def, row));
    }
    applyAll(def.onDefeat as Effect[], ctx, { source: `creature:${enemy.refId}` });
  }
  const bonus = spoils.xp > 0 ? xpBonus(s.player, content, killXpBonus(s, content)) : 0;
  if (bonus > 0) spoils.xp = roundHalfUp(spoils.xp * (1 + bonus)); // affix_of_echoes (U26b), Quick Study (U31)
  return spoils;
}

// ---- the bestiary -------------------------------------------------------------------------------------------------------------

export type Reveal = BestiaryEntry['revealed'];
/** Bestiary knowledge levels, lowest first. */
export const REVEAL_ORDER: readonly Reveal[] = ['none', 'resist', 'pattern', 'all'];
const rank = (r: Reveal): number => REVEAL_ORDER.indexOf(r);

/** DESIGN §4.2: what `killed` kills of `creatureId` reveal — resistances from the first, then its own `reveals` rows. */
export function revealAt(content: ContentPack, creatureId: string, killed: number): Reveal {
  let best: Reveal = killed >= 1 ? 'resist' : 'none';
  for (const r of content.creatures[creatureId]?.bestiary.reveals ?? []) if (killed >= r.kills && rank(r.reveal) > rank(best)) best = r.reveal;
  return best;
}

const familyOf = (content: ContentPack, creatureId: string): string | undefined => content.creatures[creatureId]?.family;

/** The draft entry of `creatureId`, created on first touch (at 'resist' when a creature of its family has been killed). */
function draftEntry(ctx: StepCtx, creatureId: string): BestiaryEntry {
  const bestiary = ctx.profileDraft().bestiary;
  const existing = bestiary[creatureId];
  if (existing) return existing;
  const family = familyOf(ctx.content, creatureId);
  const known = Object.entries(bestiary).some(([id, e]) => e.killed > 0 && familyOf(ctx.content, id) === family);
  const entry: BestiaryEntry = { seen: 0, killed: 0, spared: 0, revealed: known ? 'resist' : 'none', intentsSeen: [] };
  bestiary[creatureId] = entry;
  return entry;
}

function raise(ctx: StepCtx, creatureId: string, entry: BestiaryEntry, to: Reveal): void {
  if (rank(to) <= rank(entry.revealed)) return;
  entry.revealed = to;
  ctx.emit({ t: 'bestiaryUpdated', creatureId, field: 'weakness' });
}

/** DESIGN §10.6: the first bestiary entry of an id ever (first kill or spare) pays Resonance once. */
function firstEntry(ctx: StepCtx, creatureId: string): void {
  const key = `${BESTIARY_DISCOVERY}${creatureId}`;
  if (ctx.profile.discoveries.includes(key)) return;
  ctx.profileDraft().discoveries.push(key);
  const amount = ctx.content.config.resonance.bestiary;
  if (amount !== 0) apply({ resonance: amount }, ctx, { source: `bestiary:${creatureId}` });
}

/** A kill, at the moment it happens: killed + 1, reveals (its family's resistances too), first-entry Resonance. */
export function recordKill(ctx: StepCtx, creatureId: string): void {
  const entry = draftEntry(ctx, creatureId);
  entry.killed += 1;
  ctx.emit({ t: 'bestiaryUpdated', creatureId, field: 'killed' });
  raise(ctx, creatureId, entry, revealAt(ctx.content, creatureId, entry.killed));
  const family = familyOf(ctx.content, creatureId);
  for (const [id, other] of Object.entries(ctx.profileDraft().bestiary)) if (id !== creatureId && familyOf(ctx.content, id) === family) raise(ctx, id, other, 'resist');
  firstEntry(ctx, creatureId);
}

/** A creature spared (U29 communion, DESIGN §4.11): spared + 1 and the first-entry Resonance. */
export function recordSpared(ctx: StepCtx, creatureId: string): void {
  draftEntry(ctx, creatureId).spared += 1;
  firstEntry(ctx, creatureId);
}

/** The end of a fight, however it ends: every creature that stood in it (adds too) counts as seen once. */
export function recordSeen(ctx: StepCtx, combat: CombatState): void {
  const counts = new Map<string, number>();
  for (const e of combat.enemies) counts.set(e.refId, (counts.get(e.refId) ?? 0) + 1);
  for (const [creatureId, n] of counts) {
    if (!ctx.content.creatures[creatureId]) continue;
    draftEntry(ctx, creatureId).seen += n;
    ctx.emit({ t: 'bestiaryUpdated', creatureId, field: 'seen' });
  }
}

/** At the start of a player turn: each visible intent chip's move joins its creature's `intentsSeen` (profile untouched if nothing is new). */
export function noteIntentsSeen(ctx: StepCtx, combat: CombatState): void {
  const sense = attunementScript(ctx.s.player, ctx.content, ATT_SCRIPT.echoSense) !== undefined;
  for (const enemy of combat.enemies) {
    if (sense && ctx.content.creatures[enemy.refId] && (ctx.profile.bestiary[enemy.refId]?.revealed ?? 'none') === 'none') {
      raise(ctx, enemy.refId, draftEntry(ctx, enemy.refId), 'resist'); // Echo-Sense (U31)
    }
    const intent = combat.intents[enemy.uid];
    if (!intent || intent.hidden || (ctx.profile.bestiary[enemy.refId]?.intentsSeen.includes(intent.moveId) ?? false)) continue;
    draftEntry(ctx, enemy.refId).intentsSeen.push(intent.moveId);
    ctx.emit({ t: 'bestiaryUpdated', creatureId: enemy.refId, field: 'intent' });
  }
}
