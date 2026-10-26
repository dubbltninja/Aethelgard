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
import { APEX_LOCATION_ID, dayOf, sceneForNpc, type Action } from '@engine/index';
import { APEX_MARGIN } from './melee';
import {
  MELEE_REST,
  MELEE_THRESHOLD,
  MELEE_TRADE,
  apexReadyBy,
  apexSettled,
  fallback,
  foeLevel,
  head,
  meleeFight,
  meleeUnlockRank,
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
import { bfsPath, firstOf, healthFraction, nearestUnvisited, pressOn, questHints, questSignature, stepAlong, type PathOptions } from './shared';
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
} as const;

const DIALOGUE: DialogueCfg = { apexReady: (env) => apexReadyBy(env, APEX_MARGIN), heartstone: 'stabilize', coverage: true };

const SOCIAL: SocialCfg = { talk: 'scene', heartstone: 'stabilize', interact: true, gather: true };

const notes = (memory: BotMemory): Notes => notesOf(memory, 'explorer');

function explore(env: Env): Action {
  const { s, legal, content, profile, n } = env;
  const here = s.world.currentLocationId;

  const early = head(env, { stat: 'strength', unlock: meleeUnlockRank });
  if (early !== undefined) return early;

  const examine = pickExamine(env);
  if (examine !== undefined) return examine;
  const book = pickBook(env, EXPLORER.maxCorruption);
  if (book !== undefined) return book;

  const fell = (id: string): boolean => shunned(env, id);
  const opts: PathOptions = { avoid: fell };

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

  // where next: the nearest place not yet entered → quest hints → the Apex → pass the time
  const day = dayOf(s.clock.ticks);
  if (day < EXPLORER.visitUntilDay) {
    const go = stepAlong(legal, nearestUnvisited(s, content, profile, (id) => !fell(id) && id !== APEX_LOCATION_ID, opts)?.path ?? null);
    if (go !== undefined) return go;
  }
  const qsig = questSignature(s);
  if (questHints(s, content).includes(here)) n.hintsReached[here] = qsig;
  for (const hint of questHints(s, content)) {
    if (hint === here || n.hintsReached[hint] === qsig || fell(hint)) continue;
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
          return pressOn(memory, state, legal, content, meleeFight(env, (e) => foeLevel(e.s) >= e.s.player.level + EXPLORER.fleeMargin));
        case 'dialogue':
          return talkThrough(env, DIALOGUE);
        case 'threshold':
          return thresholdStep(env, MELEE_THRESHOLD);
        case 'ending':
          return firstOf(legal, 'acknowledgeEnding') ?? fallback(legal);
        case 'explore':
          return explore(env);
        default:
          return fallback(legal);
      }
    },
  };
}
