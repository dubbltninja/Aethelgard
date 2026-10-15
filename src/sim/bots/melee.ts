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
  playerOf,
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
  bfsPath,
  enemyWeakness,
  expectedDamage,
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
  nearestWhere,
  questHints,
  questSignature,
  restAvailable,
  scoreEquipment,
  type PathOptions,
} from './shared';
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
    }
  }
}

const fallback = (legal: readonly Action[]): Action => legal.find((a) => !isShellAction(a)) ?? (legal[0] as Action);

// ---- combat --------------------------------------------------------------------------------------------------------------

function fight(s: GameState, legal: readonly Action[], content: ContentPack): Action {
  const combat = s.combat;
  if (combat === null) return fallback(legal);
  const me = playerOf(combat);
  const hp = healthFraction(s);
  const heals = allOf(legal, 'item')
    .filter((a) => a.targetUid === undefined || a.targetUid === me.uid)
    .map((a) => ({ a, hp: healAmount(content, itemOf(s, a.uid)?.itemId ?? '') }))
    .filter((x) => x.hp > 0)
    .sort((x, y) => y.hp - x.hp);
  if (hp < MELEE.healItemBelow && heals[0] !== undefined) return heals[0].a;
  // U37 reading: with no draught left, a self-heal ability (Field Dressing) before Guard
  const mend = allOf(legal, 'ability').find((a) => content.abilities[a.abilityId]?.heal !== undefined && (a.targetUid === undefined || a.targetUid === me.uid));
  if (hp < MELEE.healItemBelow && mend !== undefined) return mend;
  const companionDown = combat.party.some((c) => c.kind === 'companion' && !c.alive);
  const flee = firstOf(legal, 'flee');
  if (companionDown && hp < MELEE.fleeBelow && combat.canFlee && flee !== undefined) return flee;
  if (hp < MELEE.guardBelow && heals.length === 0 && firstOf(legal, 'guard') !== undefined) return { type: 'guard' };

  const foes = foesOf(s);
  const weak = (uid: string): boolean => {
    const foe = foes.find((f) => f.uid === uid);
    return foe !== undefined && (foe.resistances.physical === 'weak' || enemyWeakness(content, foe.refId).includes('physical'));
  };
  const hpOf = (uid: string | undefined): number => foes.find((f) => f.uid === uid)?.hp ?? Number.POSITIVE_INFINITY;
  const target = [...foes].sort((a, b) => Number(weak(b.uid)) - Number(weak(a.uid)) || a.hp - b.hp)[0];
  const strikes = legal.filter((a) => {
    if (a.type === 'attack') return true;
    if (a.type !== 'ability') return false;
    const ab = content.abilities[a.abilityId];
    return ab?.power !== undefined && ab.damageType === 'physical' && (a.targetUid === undefined || foes.some((f) => f.uid === a.targetUid));
  });
  const aim = (a: Action): string | undefined => (a.type === 'attack' || a.type === 'ability' ? a.targetUid : undefined);
  const onTarget = strikes.filter((a) => aim(a) === undefined || aim(a) === target?.uid);
  const pool = onTarget.length > 0 ? onTarget : strikes;
  const best = [...pool].sort((a, b) => expectedDamage(content, me, b, foes.length) - expectedDamage(content, me, a, foes.length) || hpOf(aim(a)) - hpOf(aim(b)))[0];
  if (best !== undefined && expectedDamage(content, me, best, foes.length) > 0) return best;
  return firstOf(legal, 'guard') ?? fallback(legal);
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

function explore(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile, n: Notes): Action {
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
  if (horde) return step(bfsPath(s, content, profile, here, PORTAL_LOCATION_ID)) ?? firstOf(legal, 'wait') ?? fallback(legal);

  // the character
  const stat = legal.find((a) => a.type === 'allocateStat' && a.stat === 'strength') ?? firstOf(legal, 'allocateStat');
  if (stat !== undefined) return stat;
  const unlock = pickUnlock(s, legal, content, profile);
  if (unlock !== undefined) return unlock;
  const gear = pickEquip(s, legal, content);
  if (gear !== undefined) return gear;
  const takeAll = firstOf(legal, 'takeAll');
  if (takeAll !== undefined) return takeAll;

  // routing rules (see the header)
  const fell = (id: string): boolean => (n.fellAt[id] ?? 0) >= level;
  const tooHard = (id: string): boolean => (levelBand(content, id)?.min ?? 0) > level + MELEE.bandSlack;
  const opts: PathOptions = { avoid: (id) => fell(id) || tooHard(id) };
  const safe = (id: string): boolean => !fell(id) && !tooHard(id);

  // hurt or drained: a bed here, a draught, or the walk to the nearest bed
  const hp = healthFraction(s);
  if (hp < MELEE.restHpBelow || manaFraction(s) < MELEE.restMpBelow) {
    const bed = legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? firstOf(legal, 'rest');
    if (bed !== undefined) return bed;
    if (hp < MELEE.drinkBelow) {
      const drink = allOf(legal, 'use')
        .map((a) => ({ a, hp: healAmount(content, itemOf(s, a.uid)?.itemId ?? '') }))
        .filter((x) => x.hp > 0)
        .sort((x, y) => y.hp - x.hp)[0];
      if (drink !== undefined) return drink.a;
    }
    const walk = step(nearestWhere(s, content, profile, (id) => restAvailable(s, content, profile, id), opts)?.path ?? null);
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

  // where next: quest hints → the nearest unvisited place in reach → the Apex → pass the time
  const qsig = questSignature(s);
  if (questHints(s, content).includes(here)) n.hintsReached[here] = qsig;
  for (const hint of questHints(s, content)) {
    if (hint === here || n.hintsReached[hint] === qsig || !safe(hint)) continue;
    const go = step(bfsPath(s, content, profile, here, hint, opts));
    if (go !== undefined) return go;
  }
  const fresh = nearestUnvisited(s, content, profile, safe, opts);
  const go = step(fresh?.path ?? null);
  if (go !== undefined) return go;
  if (n.apexFaced !== s.meta.runId && n.apexDeclined !== `${s.meta.runId}:${level}` && apexReady(s, content, profile)) {
    const toApex = step(bfsPath(s, content, profile, here, APEX_LOCATION_ID, opts));
    if (toApex !== undefined) return toApex;
  }
  const bed = legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? firstOf(legal, 'rest') ?? firstOf(legal, 'wait');
  if (bed !== undefined) return bed;
  const toBed = step(nearestWhere(s, content, profile, (id) => restAvailable(s, content, profile, id), opts)?.path ?? null);
  return toBed ?? firstOf(legal, 'move') ?? fallback(legal);
}

/** PLAN §7.2: the cheapest Steel/Breaker ability it qualifies for; failing those, the cheapest physical damage one. */
function pickUnlock(s: GameState, legal: readonly Action[], content: ContentPack, profile: Profile): Action | undefined {
  const mastered = masteredFor(profile, s.player.classId);
  const options = allOf(legal, 'unlockAbility').flatMap((a) => {
    const ab = content.abilities[a.abilityId];
    if (ab === undefined) return [];
    const melee = ab.branch !== undefined && MELEE_BRANCHES.includes(ab.branch);
    const physical = ab.power !== undefined && ab.damageType === 'physical';
    return melee || physical ? [{ a, rank: melee ? 0 : 1, cost: unlockCostHalf(ab, mastered) }] : [];
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
    init: () => ({}),
    choose(state, legal, content, memory, ctx) {
      const n = notes(memory);
      digest(n, ctx.recentEvents);
      n.lastHere = state.world.currentLocationId;
      n.lastLevel = state.player.level;
      if (state.combat !== null) n.lastFightAt = state.combat.locationId;
      switch (state.mode) {
        case 'combat':
          return fight(state, legal, content);
        case 'dialogue':
          return talkThrough(state, legal, content, ctx.profile, n);
        case 'threshold':
          return threshold(state, legal, content, ctx.profile);
        case 'ending':
          return firstOf(legal, 'acknowledgeEnding') ?? fallback(legal);
        case 'explore':
          return explore(state, legal, content, ctx.profile, n);
        default:
          return fallback(legal);
      }
    },
  };
}
