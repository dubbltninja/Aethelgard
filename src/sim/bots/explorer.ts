// The `explorer` bot (PLAN §7.2; DESIGN §19 coverage rows): visits every reachable place before Day 26 and then the Apex,
// opens every panel-equivalent action (examines each thing and person once, reads the books, interacts with every event),
// talks to everyone until no new scene appears, and picks the dialogue choice it has never taken, so a run walks as much of
// the content as it can. It fights like `melee` and runs from a fight that is 4 levels above it.
// Deterministic: it reads the state and keeps notes in its memory; no draws at all.
//
// Policy, in the order a step is decided (PLAN §7.2's rows; where PLAN is silent, `melee`'s, marked "melee" below):
//   combat     melee's rows (heal below 30 %, Guard below 25 % with no draught, the strike promising the most damage on the
//              foe weak to physical, else the weakest) and, first, `flee` from a fight whose strongest foe is ≥ level + 4
//              (when the fight can be fled). Never communes (melee).
//   dialogue   the Loop 1 Apex prompt as melee (*Face it* when level ≥ the strongest fight there − 3); accepts every quest;
//              the choice it has never taken anywhere in the run, else questStart, else first; the Heartstone: stabilize.
//   threshold  melee's: the cheapest Attunement while Resonance ≥ 10, wear up to 5, keep the class, start the next loop.
//   explore    the portal when it opens; in a Horde, straight to the portal; stat points → STR, the cheapest Steel/Breaker
//              ability (melee), better gear on, everything on the ground taken; `examine` each item and person once and each
//              place once; `readBook` up to corruption 4 (the caster's bound; PLAN gives none); a bed at hp < 70 % when one is
//              here, else hp < 50 % or mp < 30 % → a draught or the walk to the nearest bed (melee); the merchant (melee);
//              talk to each scene once per quest state; interact with every event once per quest state; gather; then travel:
//              the nearest unvisited place (backtracking by BFS) until none is left or Day 26, then the quest hints not yet
//              reached, then the Apex when level ≥ the fight − 3 (melee), otherwise pass the time at a bed.
//   routing    through everything, except a place where the player fell at its current level or above (melee's death note,
//              which survives reloads) or one that has turned it back 4 times by wanderers it fled (U38: `shunned`). No level-band
//              rule: the explorer's job is to see the world.
import { APEX_LOCATION_ID, BEFORE_REGION_ID, dayOf, sceneForNpc, type Action } from '@engine/index';
import { APEX_MARGIN, MELEE_BRANCHES } from './melee';
import {
  MELEE_REST,
  MELEE_THRESHOLD,
  MELEE_TRADE,
  apexReadyBy,
  apexSettled,
  fallback,
  foeLevel,
  head,
  fightWithFlight,
  classHead,
  notesOf,
  passTime,
  pickBook,
  pickExamine,
  pickTrade,
  recover,
  shunned,
  social,
  talkThrough,
  thresholdStep,
  track,
  type DialogueCfg,
  type Env,
  type Notes,
  type SocialCfg,
} from './policy';
import { bfsPath, firstOf, healthFraction, nearestUnvisited, nearestWhere, pressOn, questSignature, stepAlong, type PathOptions } from './shared';
import { dangerAt } from './danger';
import { questErrand, questTargets } from './questFollow';
import type { Bot, BotMemory } from './types';

export const EXPLORER = {
  /** Flee a fight whose strongest foe is at least this many levels above the player. */
  fleeMargin: 4,
  /** Visit everything before this day, then the Apex. */
  visitUntilDay: 26,
  /** Rest at a bed that is here below this fraction of max HP. */
  bedHere: 0.7,
  /** Never read a book that would take corruption past this. */
  maxCorruption: 4,
  /** U81b1: choices a loop the explorer spends inside Silverwood Before before it walks out. */
  beforeSteps: 150,
} as const;

const DIALOGUE: DialogueCfg = { apexReady: (env) => apexReadyBy(env, APEX_MARGIN), heartstone: 'stabilize', coverage: true };

const SOCIAL: SocialCfg = { talk: 'scene', heartstone: 'stabilize', interact: true, gather: true };

const notes = (memory: BotMemory): Notes => notesOf(memory, 'explorer');

function explore(env: Env, memory: BotMemory): Action {
  const { s, legal, content, profile, n } = env;
  const here = s.world.currentLocationId;

  const early = head(env, classHead(env, 'strength', MELEE_BRANCHES));
  if (early !== undefined) return early;

  const examine = pickExamine(env);
  if (examine !== undefined) return examine;
  const book = pickBook(env, EXPLORER.maxCorruption);
  if (book !== undefined) return book;

  // U81b1 (danger.ts): never through an unfleeable fight ≥ level + 4; never to a place with any such fight (it is left for later)
  const fell = (id: string): boolean => shunned(env, id) || dangerAt(s, content, profile, id, 'pass');
  const unsafe = (id: string): boolean => fell(id) || dangerAt(s, content, profile, id, 'visit');
  const opts: PathOptions = { avoid: fell };
  // U81b1 (D-145 item 6): Silverwood Before (Caelum, the ritual, the Conflux) is part of the world to see — from Loop 2, once its
  // door is open, the explorer walks it (its clock is frozen) for at most `beforeSteps` choices a loop, then walks out
  const inBefore = content.locations[here]?.regionId === BEFORE_REGION_ID;
  const beforeKey = `explorer:before:${s.meta.runId}`;
  if (inBefore) memory[beforeKey] = ((memory[beforeKey] as number | undefined) ?? 0) + 1;
  const beforeOpen = ((memory[beforeKey] as number | undefined) ?? 0) < EXPLORER.beforeSteps;
  const wide: PathOptions = { ...opts, enterBefore: beforeOpen || inBefore };

  // a bed here at hp < 70 %, else the melee rows (draught, the walk to a bed)
  if (healthFraction(s) < EXPLORER.bedHere) {
    const bed = legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? firstOf(legal, 'rest');
    if (bed !== undefined) return bed;
  }
  const recovery = recover(env, MELEE_REST, opts);
  if (recovery !== undefined) return recovery;
  const trade = pickTrade(env, MELEE_TRADE);
  if (trade !== undefined) return trade;
  const people = social(env, SOCIAL, (npcId) => sceneForNpc(s, content, profile, npcId)?.id);
  if (people !== undefined) return people;
  const errand = questErrand(s, legal, content, memory); // U81b1: search a hint for an objective's item, or buy it (questFollow.ts)
  if (errand !== undefined) return errand;

  // where next: the nearest place not yet entered → quest hints → the Apex → pass the time
  const day = dayOf(s.clock.ticks);
  if (day < EXPLORER.visitUntilDay) {
    const inside = (id: string): boolean => content.locations[id]?.regionId === BEFORE_REGION_ID;
    const fresh = (id: string): boolean => !unsafe(id) && id !== APEX_LOCATION_ID && (beforeOpen || !inside(id));
    const go = stepAlong(legal, nearestUnvisited(s, content, profile, fresh, wide)?.path ?? null);
    if (go !== undefined) return go;
  }
  // inside the Before with nothing left to see (or its steps spent): back out by the door it came in
  if (inBefore) {
    const out = stepAlong(legal, nearestWhere(s, content, profile, (id) => content.locations[id]?.regionId !== BEFORE_REGION_ID, { ...opts, enterBefore: true })?.path ?? null);
    if (out !== undefined) return out;
  }
  const qsig = questSignature(s);
  if (questTargets(s, content, profile).map((t) => t.locationId).includes(here)) n.hintsReached[here] = qsig;
  for (const hint of questTargets(s, content, profile).map((t) => t.locationId)) {
    if (hint === here || n.hintsReached[hint] === qsig || unsafe(hint)) continue;
    const go = stepAlong(legal, bfsPath(s, content, profile, here, hint, opts));
    if (go !== undefined) return go;
  }
  if (!apexSettled(env) && apexReadyBy(env, APEX_MARGIN)) {
    const toApex = stepAlong(legal, bfsPath(s, content, profile, here, APEX_LOCATION_ID, opts));
    if (toApex !== undefined) return toApex;
  }
  return passTime(env, opts);
}

export function explorerBot(): Bot {
  return {
    name: 'explorer',
    preferredClasses: ['ranger'],
    examines: true,
    init: () => ({}),
    choose(state, legal, content, memory, ctx) {
      const n = notes(memory);
      track(n, state, ctx.recentEvents);
      const env: Env = { s: state, legal, content, profile: ctx.profile, n };
      switch (state.mode) {
        case 'combat':
          return pressOn(memory, state, legal, content, fightWithFlight(env, memory, (e) => foeLevel(e.s) >= e.s.player.level + EXPLORER.fleeMargin));
        case 'dialogue':
          return talkThrough(env, DIALOGUE);
        case 'threshold': {
          // U81b1: every room of the Threshold once (the Gallery, the Loom, the Far Light: coverage), then melee's rows
          const seen = state.threshold?.visited ?? [];
          const room = legal.find((a) => a.type === 'thresholdGo' && !seen.includes(a.to));
          return room ?? thresholdStep(env, MELEE_THRESHOLD);
        }
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
