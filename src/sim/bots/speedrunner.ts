// The `speedrunner` bot (PLAN §7.2; DESIGN §19 #5, #10, #11, #15): the fewest days to the Apex and to a loop's end. It walks the
// shortest open route (Echo shortcuts, revealed doors and conditional roads included — the map search reads them), skips the
// optional (no shopping, no gathering, no examining, no quests the Apex gate does not count), fights what it meets on the way
// with its class's kit, completes the quests `config.apexGate` asks for nearest-first, rests briefly, and from Loop 2 aims at
// the ending with the fewest unmet requirement parts.
// Deterministic: it reads the state and keeps notes in its memory; no draws at all.
//
// U81b1 (D-145): why it took 33 days. Before U81b1 it fled every fight it could flee. Since D-143/D-144 a successful flee falls
// back to the previous node and the group returns (scatter or regroup), so every road with a fight on it turned the bot back
// (88 % of its fights were flights), it stayed at level 2, could not finish a quest that needed a kill (the Barren Peaks
// gate, the Outpost, the Hollow's shards), and walked back and forth until the clock ran out (58 % expiry; median 33 days, the
// Stabilized limit). Fleeing is now the slow choice: it fights what it meets unless the fight is ≥ 3 levels above it.
//
// Policy, in the order a step is decided (PLAN §7.2's rows; where PLAN is silent, `melee`'s, marked "melee" below):
//   combat     the communion first (Loop 2+, the Tyrant: Commune, then Speak/Listen/Offer as the caster does, a blow to forfeit
//              a question nothing can answer; at the Resolution the ending with the fewest unmet requirement parts, `explain()`,
//              ties in letter order); a rejected communion is left at once (`flee`: the fastest loop end). Otherwise `flee` a
//              fight whose strongest foe is ≥ level + 3 (U81b1), else the class-aware fight (`classFight`, weapon lean).
//   dialogue   the Loop 1 Apex prompt: *Face it* when there is no fight there or level ≥ the fight − 3 (melee), else *Not yet*;
//              accepts every quest that counts for the Apex gate, the nearest first hint first (U81b1: before, only up to the
//              gate's count of quests held, so a held quest it could not finish blocked the gate); questStart is worth
//              10 − distance; the Heartstone stabilized (U81b1: +6 days of margin; destroying it by Day 10, melee's rule, cut
//              the limit to 20 days, which a speed run that has to level cannot afford).
//   threshold  melee's: the cheapest Attunement while Resonance ≥ 10, wear up to 5, keep the class, start the next loop.
//   explore    the portal when it opens; in a Horde, straight to the portal; stat points → the class's power stat (U81b1: STR, or
//              MAG for a caster class; AGI fed a flee chance it no longer lives on), the cheapest Steel/Breaker ability then the
//              class's own damaging ones (`classUnlockRank`), better gear on, everything on the ground taken; rest below 35 % hp
//              (or 20 % mp, never for the Weaver, who pays in blood): a short rest (one watch) where it can, a full one only below
//              20 % hp, a draught on the road, else the walk to the nearest bed; talk to each NPC once per quest state (a
//              conversation costs no time) and interact only where a quest hint points; then travel: the Apex as soon as the gate
//              is open and the Loop 1 fight there is within reach (level ≥ the fight − 3, or a conversation from Loop 2) → the
//              quest hint nearest by route → the nearest unvisited place in reach (givers, experience) → the nearest place with a
//              fight in reach (experience) → pass the time at a bed.
//   routing    never into or through a place whose band starts more than 2 above the player's level (melee), whose pending
//              fight is ≥ level + 4 (`dangerAt`), where the player fell at its current level, or that has turned it back 4 times
//              (`shunned`).
import { APEX_LOCATION_ID, sceneForNpc, type Action } from '@engine/index';
import { dangerAt } from './danger';
import { MELEE, MELEE_BRANCHES } from './melee';
import {
  MELEE_THRESHOLD,
  apexCommunion,
  apexGateOpen,
  apexReadyBy,
  apexSettled,
  bestDrink,
  walkToBed,
  classHead,
  communion,
  fallback,
  fightWithFlight,
  foeLevel,
  forfeitBlow,
  head,
  hintTargets,
  notesOf,
  passTime,
  questDistance,
  rankEndings,
  shunned,
  social,
  talkThrough,
  thresholdStep,
  towardHint,
  track,
  type DialogueCfg,
  type Env,
  type Notes,
  type SocialCfg,
} from './policy';
import { bfsPath, firstOf, healthFraction, levelBand, manaFraction, nearestUnvisited, nearestWhere, pendingFights, pressOn, stepAlong, type PathOptions } from './shared';
import { questErrand } from './questFollow';
import type { Bot, BotMemory } from './types';

export const SPEEDRUNNER = {
  /** Flee a fight whose strongest foe is at least this many levels above the player. */
  fleeMargin: 3,
  /** Rest below this fraction of max HP (a short rest where it can) … */
  restHpBelow: 0.35,
  /** … or of max MP (not a Blood-price class). */
  restMpBelow: 0.2,
  /** A full rest (to the next dawn) only below this fraction of max HP. */
  fullRestBelow: 0.2,
  /**
   * U81b1: the Apex when level ≥ the fight there − this (L9 against the L14 Contained Tyrant: DESIGN §19 #11 reads the
   * speedrunner at the Apex at ≥ 9, D-066 #1; melee waits for L11, `APEX_MARGIN`).
   */
  apexMargin: 5,
} as const;

const notes = (memory: BotMemory): Notes => notesOf(memory, 'speedrunner');

/** Worth walking to the Apex: nothing there to fight now, or a conversation (Loop 2+), or strong enough by melee's rule. */
function ready(env: Env): boolean {
  const { s, content, profile } = env;
  return pendingFights(s, content, profile, APEX_LOCATION_ID).length === 0 || apexCommunion(env) || apexReadyBy(env, SPEEDRUNNER.apexMargin);
}

/** A quest the speedrunner takes: one the Apex gate counts. */
const counts = (env: Env, questId: string): boolean => env.content.quests[questId]?.countsForApex !== false;

const DIALOGUE: DialogueCfg = {
  apexReady: ready,
  heartstone: 'stabilize',
  quest: (questId, env) => (counts(env, questId) ? 10 - questDistance(env, questId) : 0),
  accept: (questId, env) => counts(env, questId),
  acceptRank: (questId, env) => questDistance(env, questId),
};

const SOCIAL = (env: Env): SocialCfg => ({
  talk: 'npc',
  heartstone: 'stabilize',
  // events only where a quest hint points (they may be the objective); never gather
  interact: hintTargets(env.s, env.content).some((h) => h.locationId === env.s.world.currentLocationId),
  gather: false,
});

function fight(env: Env, memory: BotMemory): Action {
  const { legal } = env;
  const ranked = rankEndings(env).map((e) => e.endingId);
  memory['target'] = ranked[0] ?? null;
  const talk = communion(env, { endings: ranked });
  if (talk.kind === 'act') return talk.action;
  if (talk.kind === 'stuck') return forfeitBlow(env);
  const flee = firstOf(legal, 'flee');
  if (talk.kind === 'rejected' && flee !== undefined) return flee;
  return fightWithFlight(env, memory, (e) => foeLevel(e.s) >= e.s.player.level + SPEEDRUNNER.fleeMargin);
}

/** Hurt or drained: the shortest rest that will do here, a draught on the road, else the walk to the nearest bed. */
function rest(env: Env, opts: PathOptions): Action | undefined {
  const { s, legal, content } = env;
  const hp = healthFraction(s);
  const blood = content.classes[s.player.classId]?.resource.bloodPrice !== undefined;
  const drained = !blood && manaFraction(s) < SPEEDRUNNER.restMpBelow;
  if (hp >= SPEEDRUNNER.restHpBelow && !drained) return undefined;
  const full = legal.find((a) => a.type === 'rest' && a.kind === 'full');
  const short = legal.find((a) => a.type === 'rest' && a.kind === 'short');
  if (hp < SPEEDRUNNER.fullRestBelow && full !== undefined) return full;
  if (short !== undefined) return short;
  if (full !== undefined) return full;
  if (hp < SPEEDRUNNER.restHpBelow) {
    const drink = bestDrink(env);
    if (drink !== undefined) return drink;
  }
  return walkToBed(env, opts);
}

function explore(env: Env, memory: BotMemory): Action {
  const { s, legal, content, profile } = env;
  const here = s.world.currentLocationId;
  const level = s.player.level;

  const early = head(env, classHead(env, 'strength', MELEE_BRANCHES));
  if (early !== undefined) return early;

  const tooHard = (id: string): boolean => (levelBand(content, id)?.min ?? 0) > level + MELEE.bandSlack;
  const fell = (id: string): boolean => shunned(env, id) || tooHard(id) || dangerAt(s, content, profile, id, 'pass');
  const opts: PathOptions = { avoid: fell };
  const safe = (id: string): boolean => !fell(id) && !dangerAt(s, content, profile, id, 'visit');

  const recovery = rest(env, opts);
  if (recovery !== undefined) return recovery;
  const people = social(env, SOCIAL(env), (npcId) => sceneForNpc(s, content, profile, npcId)?.id);
  if (people !== undefined) return people;
  const errand = questErrand(s, legal, content, memory); // U81b1: search a hint for an objective's item, or buy it (questFollow.ts)
  if (errand !== undefined) return errand;

  // the Apex as soon as the gate is open and the fight there is within reach (shunned places only: it is the goal)
  if (apexGateOpen(env) && !apexSettled(env) && ready(env)) {
    const toApex = stepAlong(legal, bfsPath(s, content, profile, here, APEX_LOCATION_ID, { avoid: (id) => shunned(env, id) }));
    if (toApex !== undefined) return toApex;
  }
  // the quest hint nearest by route
  const dist = (h: { locationId: string }): number => bfsPath(s, content, profile, here, h.locationId, opts)?.length ?? 99;
  const hinted = towardHint(env, dist, safe, opts);
  if (hinted !== undefined) return hinted;
  // givers and experience: the nearest place not yet entered, then the nearest fight in reach
  const go = stepAlong(legal, nearestUnvisited(s, content, profile, (id) => safe(id) && id !== APEX_LOCATION_ID, opts)?.path ?? null);
  if (go !== undefined) return go;
  if (!ready(env)) {
    const fightAt = (id: string): boolean => id !== here && id !== APEX_LOCATION_ID && safe(id) && pendingFights(s, content, profile, id).some((f) => f.fleeable && f.level < level + SPEEDRUNNER.fleeMargin);
    const grind = stepAlong(legal, nearestWhere(s, content, profile, fightAt, opts)?.path ?? null);
    if (grind !== undefined) return grind;
  }
  return passTime(env, opts);
}

export function speedrunnerBot(): Bot {
  return {
    name: 'speedrunner',
    preferredClasses: ['ranger', 'ironclad_warden'],
    examines: true, // U81b1: only to search a quest hint (questErrand)
    init: () => ({ target: null }),
    choose(state, legal, content, memory, ctx) {
      const n = notes(memory);
      track(n, state, ctx.recentEvents);
      const env: Env = { s: state, legal, content, profile: ctx.profile, n };
      switch (state.mode) {
        case 'combat':
          return pressOn(memory, state, legal, content, fight(env, memory));
        case 'dialogue':
          return talkThrough(env, DIALOGUE);
        case 'threshold':
          return thresholdStep(env, MELEE_THRESHOLD);
        case 'ending':
          return firstOf(legal, 'acknowledgeEnding') ?? fallback(legal);
        case 'explore':
          return explore(env, memory);
        default:
          return fallback(legal);
      }
    },
  };
}
