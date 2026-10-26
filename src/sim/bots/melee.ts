// The `melee` bot (PLAN §7.2; DESIGN §19 #1, #9): a physical fighter that explores toward unvisited places and quest
// targets, fights with basic attacks and physical abilities, rests when low, drinks healing consumables, buys and equips
// gear, accepts every quest, and leaves Loop 1 by whatever closer the world hands it (the Tyrant's Horde or the clock's).
// Deterministic: it reads the state and keeps notes in its memory; no draws at all.
//
// Policy, in the order a step is decided (PLAN §7.2's rows, with U37's readings where PLAN is silent):
//   combat     hp < 30 % and a healing item → the biggest heal (none left: a self-heal ability such as Field Dressing);
//              hp < 25 % and no healing item → Guard; else the strike promising the
//              most damage (a physical ability if it beats a basic attack) on the foe weak to physical, else the weakest.
//              Flees only with the companion down, hp < 20 % and the fight fleeable. Never communes.
//   dialogue   the Loop 1 Apex prompt: *Face it* when ready (level ≥ the strongest fight there − APEX_MARGIN), else
//              *Not yet*; accepts every offered quest; picks choices by `questStart` > Ironclad rep > first, untaken first;
//              the Heartstone (no effect schema yet: read from choice ids) is destroyed only by Day 10, else stabilized.
//   threshold  buys the cheapest Attunement while Resonance ≥ 10, equips up to 5, keeps the class, starts the next loop.
//   explore    the portal when it opens; in a Horde, straight to the portal; stat points → STR; the cheapest Steel/Breaker
//              ability it qualifies for (else the cheapest physical one); better gear on; everything on the ground taken;
//              hp < 50 % or mp < 30 % → rest here or walk to the nearest rest spot (a healing item first below 35 % when
//              no bed is here); merchant: sell materials/spare gear when gold < 20, buy healing up to 3 when gold ≥ 40,
//              upgrade the weapon when gold ≥ fee + 30; talk to each NPC once per quest state; each interactable once per
//              quest state; gather; then travel: quest hints → the nearest unvisited place whose level band starts at most
//              2 above the player's → the Apex when ready → otherwise pass time at the nearest rest spot (the clock runs out
//              and the expiry Horde opens the portal).
//   routing    never through a place whose band starts more than 2 above the player's level, nor one where the player
//              fell at its current level or above (a death note survives the reload, so the same walk is not replayed);
//              a Horde lifts both (no fights start in one).
import {
  APEX_FACE_IT,
  APEX_LOCATION_ID,
  APEX_NOT_YET,
  PORTAL_LOCATION_ID,
  dayOf,
  isApexPromptOpen,
  masteredFor,
  unlockCostHalf,
  upgradeQuote,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import {
  allOf,
  bedStep,
  hordeRoute,
  bfsPath,
  firstOf,
  foesOf,
  healAmount,
  healingCarried,
  healthFraction,
  isShellAction,
  itemOf,
  levelBand,
  locationThreat,
  manaFraction,
  nearestUnvisited,
  pressOn,
  questSignature,
  scoreEquipment,
  type PathOptions,
} from './shared';
import { classFight, classStat, classUnlockRank, healRow } from './classFight';
import { DANGER_MARGIN, dangerAt } from './danger';
import { questErrand, questTargets } from './questFollow';
import type { Bot, BotMemory } from './types';

/** PLAN §7.2 thresholds (fractions of max). */
export const MELEE = {
  healItemBelow: 0.3,
  guardBelow: 0.25,
  fleeBelow: 0.2,
  restHpBelow: 0.5,
  restMpBelow: 0.3,
  /** Out of combat, drink before walking to a bed below this. */
  drinkBelow: 0.35,
  /** Explore places whose band starts at most this far above the player's level. */
  bandSlack: 2,
  sellBelowGold: 20,
  buyFromGold: 40,
  healingStock: 3,
  upgradeMargin: 30,
  heartstoneDestroyByDay: 10,
  thresholdKeepResonance: 10,
  attunementSlots: 5,
} as const;

/** The Apex is "ready" when the player's level is at least the strongest creature there minus this (L11 vs the L14 Contained Tyrant: DESIGN §19 #19's lower sim level). */
export const APEX_MARGIN = 3;

/** PLAN §7.2: Steel (ranger) and Breaker (warden) are the melee branches. */
export const MELEE_BRANCHES: readonly string[] = ['steel', 'breaker'];

/** The bot's notes (in `BotMemory.melee`). */
interface Notes {
  /** npcId → `${runId}|${quest signature}` at the last talk. */
  talked: Record<string, string>;
  /** `${runId}|${location}|${event}|${quest signature}` already interacted with. */
  interacted: string[];
  /** hint location → quest signature when it was last reached as a hint. */
  hintsReached: Record<string, string>;
  /** location → the highest player level at which the player fell there (any loop). */
  fellAt: Record<string, number>;
  /** runId of the loop in which the Apex was faced (no return that loop). */
  apexFaced: string | null;
  /** runId:level at which the Apex prompt was declined (try again only after a level up). */
  apexDeclined: string | null;
  /** Where the player stood and how strong it was at the previous choice (to place a death that happened since). */
  lastHere: string | null;
  lastLevel: number;
  lastFightAt: string | null;
}

function notes(memory: BotMemory): Notes {
  const have = memory['melee'] as Notes | undefined;
  if (have !== undefined) return have;
  const fresh: Notes = {
    talked: {},
    interacted: [],
    hintsReached: {},
    fellAt: {},
    apexFaced: null,
    apexDeclined: null,
    lastHere: null,
    lastLevel: 1,
    lastFightAt: null,
  };
  memory['melee'] = fresh;
  return fresh;
}

/** Reads the events since the last choice: where fights started, and where the player fell (a reload may follow). */
function digest(n: Notes, events: readonly GameEvent[]): void {
  let at = n.lastHere;
  for (const e of events) {
    if (e.t === 'locationEntered') at = e.locationId;
    else if (e.t === 'combatStarted') n.lastFightAt = at;
    else if (e.t === 'playerDied') {
      const where = n.lastFightAt ?? at;
      if (where !== null) n.fellAt[where] = Math.max(n.fellAt[where] ?? 0, n.lastLevel);
      // U81b1: a lost Apex fight is not "faced" for the loop: the reload stands before it, and the death note sets the level to retry at
      n.apexFaced = null;
    }
  }
}

const fallback = (legal: readonly Action[]): Action => legal.find((a) => !isShellAction(a) && a.type !== 'examine') ?? (legal[0] as Action);

// ---- combat --------------------------------------------------------------------------------------------------------------

/** The highest level among the standing foes. */
const strongestFoe = (s: GameState): number => Math.max(0, ...foesOf(s).map((f) => f.level));

/**
 * U81b1: a fight ≥ 4 levels above the player is left (D-066; `danger.ts`), and so is one where it fell at this level (a reload
 * stands next to it: the FALLEN loop replayed the same death up to 25 times); the draught (or self-heal) below 30 %; the flight
 * with the companion down below 20 %; then the class-aware fight (`classFight`) with a weapon lean — physical abilities first,
 * but a Wizard's or a Weaver's spells too (before U81b1 only physical strikes, D-145).
 */
function fight(s: GameState, legal: readonly Action[], content: ContentPack, memory: BotMemory, fellHere: boolean): Action {
  const combat = s.combat;
  if (combat === null) return fallback(legal);
  const hp = healthFraction(s);
  const flee = combat.canFlee ? firstOf(legal, 'flee') : undefined;
  if (flee !== undefined && (strongestFoe(s) >= s.player.level + DANGER_MARGIN || fellHere)) return flee;
  const heal = healRow(s, legal, content, MELEE.healItemBelow);
  if (heal !== undefined) return heal;
  const companionDown = combat.party.some((c) => c.kind === 'companion' && !c.alive);
  if (flee !== undefined && companionDown && hp < MELEE.fleeBelow) return flee;
  return classFight(s, legal, content, memory, { lean: 'weapon', healBelow: MELEE.healItemBelow });
}

// ---- dialogue ------------------------------------------------------------------------------------------------------------

/** Ready for the Apex: level ≥ the strongest fight it would start now − APEX_MARGIN (no fight there: always ready). */
function apexReady(s: GameState, content: ContentPack, profile: Profile): boolean {
  return s.player.level >= locationThreat(s, content, profile, APEX_LOCATION_ID) - APEX_MARGIN;
}

function talkThrough(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile, n: Notes): Action {
  if (isApexPromptOpen(s)) {
    const ready = apexReady(s, content, profile);
    const notYet = legal.find((a) => a.type === 'choose' && a.choiceId === APEX_NOT_YET);
    if (!ready && notYet !== undefined) {
      n.apexDeclined = `${s.meta.runId}:${s.player.level}`;
      return notYet;
    }
    n.apexFaced = s.meta.runId;
    return legal.find((a) => a.type === 'choose' && a.choiceId === APEX_FACE_IT) ?? fallback(legal);
  }
  const accept = firstOf(legal, 'acceptQuest');
  if (accept !== undefined) return accept;
  const choices = allOf(legal, 'choose');
  if (choices.length > 0) return pickChoice(s, choices, content);
  return firstOf(legal, 'continue') ?? fallback(legal);
}

/** PLAN §7.2: `questStart` > Ironclad rep gains > first option; choices not yet taken in this scene first. */
function pickChoice(s: GameState, choices: readonly Extract<Action, { type: 'choose' }>[], content: ContentPack): Action {
  const d = s.dialogue;
  const node = d === null ? undefined : content.dialogues[d.sceneId]?.nodes.find((x) => x.id === d.nodeId);
  const order = node?.choices.map((c) => c.id) ?? [];
  const day = dayOf(s.clock.ticks);
  const score = (choiceId: string): number => {
    const c = node?.choices.find((x) => x.id === choiceId);
    let v = 0;
    if (c !== undefined) {
      if (c.effects.some((e) => 'questStart' in e)) v += 4;
      if (c.effects.some((e) => 'rep' in e && e.rep.faction === 'ironclad' && e.rep.delta > 0)) v += 2;
    }
    // the Heartstone (D-017): destroy early, otherwise stabilize (REVIEW-DESIGN-PLAN F20); no effect schema yet
    if (/destroy/.test(choiceId)) v += day <= MELEE.heartstoneDestroyByDay ? 3 : -3;
    if (/stabili[sz]e/.test(choiceId)) v += day <= MELEE.heartstoneDestroyByDay ? 1 : 3;
    if (d !== null && node !== undefined && d.choicesTaken.includes(`${node.id}:${choiceId}`)) v -= 1;
    return v;
  };
  const rank = (id: string): number => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  return [...choices].sort((a, b) => score(b.choiceId) - score(a.choiceId) || rank(a.choiceId) - rank(b.choiceId))[0] as Action;
}

// ---- the Threshold -------------------------------------------------------------------------------------------------------

function threshold(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile): Action {
  const cost = (id: string): number => content.attunements[id]?.cost ?? Number.POSITIVE_INFINITY;
  if (profile.resonance >= MELEE.thresholdKeepResonance) {
    const buy = allOf(legal, 'thresholdSpend').sort((a, b) => cost(a.attunementId) - cost(b.attunementId) || (a.attunementId < b.attunementId ? -1 : 1))[0];
    if (buy !== undefined) return buy;
  }
  if (profile.attunements.equipped.length < MELEE.attunementSlots) {
    const wear = allOf(legal, 'equipAttunement').filter((a) => a.on);
    if (wear[0] !== undefined) return wear[0];
  }
  const visited = s.threshold?.visited ?? [];
  const affordable = Object.values(content.attunements).some((a) => !profile.attunements.owned.includes(a.id) && a.cost <= profile.resonance);
  const unworn = profile.attunements.owned.some((id) => !profile.attunements.equipped.includes(id));
  const loom = legal.find((a) => a.type === 'thresholdGo' && a.to === 'loom');
  if (!visited.includes('loom') && loom !== undefined && ((affordable && profile.resonance >= MELEE.thresholdKeepResonance) || unworn)) return loom;
  const next = firstOf(legal, 'newLoop');
  if (next !== undefined) return next;
  return legal.find((a) => a.type === 'thresholdGo' && a.to === 'far_light') ?? fallback(legal);
}

// ---- explore -------------------------------------------------------------------------------------------------------------

function explore(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile, n: Notes, memory: BotMemory): Action {
  const here = s.world.currentLocationId;
  const level = s.player.level;
  const horde = s.world.hordeActive;
  const sig = `${s.meta.runId}|${questSignature(s)}`;

  const portal = firstOf(legal, 'enterPortal');
  if (portal !== undefined) return portal;
  const step = (path: readonly string[] | null): Action | undefined => {
    const to = path?.[0];
    return to === undefined ? undefined : legal.find((a) => a.type === 'move' && a.to === to);
  };
  if (horde) return step(hordeRoute(s, content, profile, PORTAL_LOCATION_ID)) ?? firstOf(legal, 'wait') ?? fallback(legal);

  // the character
  const want = classStat(content, s.player.classId, 'strength');
  const stat = legal.find((a) => a.type === 'allocateStat' && a.stat === want) ?? firstOf(legal, 'allocateStat');
  if (stat !== undefined) return stat;
  const unlock = pickUnlock(s, legal, content, profile);
  if (unlock !== undefined) return unlock;
  const gear = pickEquip(s, legal, content);
  if (gear !== undefined) return gear;
  const takeAll = firstOf(legal, 'takeAll');
  if (takeAll !== undefined) return takeAll;

  // routing rules (see the header)
  const fell = (id: string): boolean => (n.fellAt[id] ?? 0) >= level;
  // U81b1 (danger.ts): never through an unfleeable fight ≥ level + 4; never to a place with any such fight
  const tooHard = (id: string): boolean => (levelBand(content, id)?.min ?? 0) > level + MELEE.bandSlack || dangerAt(s, content, profile, id, 'pass');
  const opts: PathOptions = { avoid: (id) => fell(id) || tooHard(id) };
  const safe = (id: string): boolean => !fell(id) && !tooHard(id) && !dangerAt(s, content, profile, id, 'visit');

  // hurt or drained: a bed here, a draught, or the walk to the nearest bed
  const hp = healthFraction(s);
  const mpBelow = content.classes[s.player.classId]?.resource.bloodPrice !== undefined ? 0 : MELEE.restMpBelow; // U81b1: the Weaver pays in blood
  if (hp < MELEE.restHpBelow || manaFraction(s) < mpBelow) {
    const bed = legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? firstOf(legal, 'rest');
    if (bed !== undefined) return bed;
    if (hp < MELEE.drinkBelow) {
      const drink = allOf(legal, 'use')
        .map((a) => ({ a, hp: healAmount(content, itemOf(s, a.uid)?.itemId ?? '') }))
        .filter((x) => x.hp > 0)
        .sort((x, y) => y.hp - x.hp)[0];
      if (drink !== undefined) return drink.a;
    }
    const walk = bedStep(s, legal, content, profile, opts); // U81b1: a bed no fight guards first
    if (walk !== undefined) return walk;
  }

  // the merchant, the forge
  const trade = pickTrade(s, legal, content, profile);
  if (trade !== undefined) return trade;

  // people and things here, once per quest state
  const talk = allOf(legal, 'talk').find((a) => n.talked[a.npcId] !== sig);
  if (talk !== undefined) {
    n.talked[talk.npcId] = sig;
    return talk;
  }
  const touch = allOf(legal, 'interact').find((a) => !n.interacted.includes(`${sig}|${here}|${a.eventId}`));
  if (touch !== undefined) {
    n.interacted.push(`${sig}|${here}|${touch.eventId}`);
    return touch;
  }
  const gather = firstOf(legal, 'gather');
  if (gather !== undefined) return gather;
  const errand = questErrand(s, legal, content, memory); // U81b1: search a hint for an objective's item, or buy it (questFollow.ts)
  if (errand !== undefined) return errand;

  // where next: quest hints → the nearest unvisited place in reach → the Apex → pass the time
  const qsig = questSignature(s);
  if (questTargets(s, content, profile).map((t) => t.locationId).includes(here)) n.hintsReached[here] = qsig;
  for (const hint of questTargets(s, content, profile).map((t) => t.locationId)) {
    if (hint === here || n.hintsReached[hint] === qsig || !safe(hint)) continue;
    const go = step(bfsPath(s, content, profile, here, hint, opts));
    if (go !== undefined) return go;
  }
  const fresh = nearestUnvisited(s, content, profile, safe, opts);
  const go = step(fresh?.path ?? null);
  if (go !== undefined) return go;
  if (n.apexFaced !== s.meta.runId && n.apexDeclined !== `${s.meta.runId}:${level}` && !fell(APEX_LOCATION_ID) && apexReady(s, content, profile)) {
    const toApex = step(bfsPath(s, content, profile, here, APEX_LOCATION_ID, opts));
    if (toApex !== undefined) return toApex;
  }
  const bed = legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? firstOf(legal, 'rest') ?? firstOf(legal, 'wait');
  if (bed !== undefined) return bed;
  const toBed = bedStep(s, legal, content, profile, opts);
  // U81b1: a step that is not into a place it avoids first (a dead end whose only way out is where it fell walked it back in)
  return (
    toBed ??
    allOf(legal, 'move').find((a) => opts.avoid?.(a.to) !== true) ??
    allOf(legal, 'move').find((a) => (n.fellAt[a.to] ?? 0) < level && !dangerAt(s, content, profile, a.to, 'pass')) ??
    allOf(legal, 'move').find((a) => !dangerAt(s, content, profile, a.to, 'pass')) ??
    firstOf(legal, 'move') ??
    fallback(legal)
  );
}

/**
 * PLAN §7.2: the cheapest Steel/Breaker ability it qualifies for; then (U81b1, `classUnlockRank`) the class's own damaging
 * abilities, the rest of its kit after them — before U81b1 a melee Wizard or Weaver learned nothing it could cast.
 */
function pickUnlock(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile): Action | undefined {
  const mastered = masteredFor(profile, s.player.classId);
  const rank = classUnlockRank(content, s.player.classId, MELEE_BRANCHES);
  const options = allOf(legal, 'unlockAbility').flatMap((a) => {
    const ab = content.abilities[a.abilityId];
    return ab === undefined ? [] : [{ a, rank: rank(ab), cost: unlockCostHalf(ab, mastered) }];
  });
  options.sort((x, y) => x.rank - y.rank || x.cost - y.cost || (x.a.abilityId < y.a.abilityId ? -1 : 1));
  return options[0]?.a;
}

/** An `equip` that beats what the slot holds now (scoreEquipment), best improvement first. */
function pickEquip(s: GameState, legal: readonly Action[], content: ContentPack): Action | undefined {
  const classId = s.player.classId;
  let best: { a: Action; gain: number } | undefined;
  for (const a of allOf(legal, 'equip')) {
    const item = itemOf(s, a.uid);
    const def = item === undefined ? undefined : content.items[item.itemId];
    if (item === undefined || def?.slot === undefined) continue;
    const slot = a.slot ?? (def.slot === 'trinket' ? 'trinket1' : def.slot);
    const worn = s.player.equipment[slot];
    const gain = scoreEquipment(content, item, classId) - (worn === null ? 0 : scoreEquipment(content, worn, classId));
    if (gain > 0 && (best === undefined || gain > best.gain)) best = { a, gain };
  }
  return best?.a;
}

/** PLAN §7.2 economy: sell materials/spare gear when poor, stock healing when flush, upgrade the weapon with a margin. */
function pickTrade(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile): Action | undefined {
  const gold = s.player.gold;
  const classId = s.player.classId;
  if (gold < MELEE.sellBelowGold) {
    const sell = allOf(legal, 'sell').find((a) => {
      const item = itemOf(s, a.uid);
      const def = item === undefined ? undefined : content.items[item.itemId];
      if (item === undefined || def === undefined) return false;
      if (def.type === 'material') return true;
      if (def.slot === undefined) return false;
      const slots = def.slot === 'trinket' ? (['trinket1', 'trinket2'] as const) : ([def.slot] as const);
      return slots.every((slot) => {
        const worn = s.player.equipment[slot];
        return worn !== null && scoreEquipment(content, worn, classId) >= scoreEquipment(content, item, classId);
      });
    });
    if (sell !== undefined) return sell;
  }
  if (gold >= MELEE.buyFromGold && healingCarried(s, content) < MELEE.healingStock) {
    const buy = allOf(legal, 'buy')
      .map((a) => ({ a, hp: healAmount(content, s.merchants[a.merchantId]?.stock.find((i) => i.uid === a.uid)?.itemId ?? '') }))
      .filter((x) => x.hp > 0)
      .sort((x, y) => y.hp - x.hp)[0];
    if (buy !== undefined) return buy.a;
  }
  const weapon = s.player.equipment.weapon;
  if (weapon !== null) {
    const up = allOf(legal, 'upgrade').find((a) => a.uid === weapon.uid);
    const quote = up === undefined ? undefined : upgradeQuote(s, content, profile, weapon.uid);
    if (up !== undefined && quote !== undefined && typeof quote !== 'string' && gold >= quote.fee + MELEE.upgradeMargin) return up;
  }
  return undefined;
}

// ---- the bot -------------------------------------------------------------------------------------------------------------

export function meleeBot(): Bot {
  return {
    name: 'melee',
    preferredClasses: ['ranger', 'ironclad_warden'],
    examines: true, // U81b1: only to search a quest hint (questErrand)
    init: () => ({}),
    choose(state, legal, content, memory, ctx) {
      const n = notes(memory);
      digest(n, ctx.recentEvents);
      n.lastHere = state.world.currentLocationId;
      n.lastLevel = state.player.level;
      if (state.combat !== null) n.lastFightAt = state.combat.locationId;
      switch (state.mode) {
        case 'combat':
          return pressOn(memory, state, legal, content, fight(state, legal, content, memory, (n.fellAt[state.combat?.locationId ?? ''] ?? 0) >= state.player.level));
        case 'dialogue':
          return talkThrough(state, legal, content, ctx.profile, n);
        case 'threshold':
          return threshold(state, legal, content, ctx.profile);
        case 'ending':
          return firstOf(legal, 'acknowledgeEnding') ?? fallback(legal);
        case 'explore':
          return explore(state, legal, content, ctx.profile, n, memory);
        default:
          return fallback(legal);
      }
    },
  };
}
