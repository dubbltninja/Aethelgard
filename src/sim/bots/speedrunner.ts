// The `speedrunner` bot (PLAN §7.2; DESIGN §19 #5, #11): the fewest days to the Apex and to a loop's end. It walks the
// shortest open route (Echo shortcuts and revealed doors included — the map search reads them), flees every fight it can
// flee, fights only what blocks the way, completes exactly the quests `config.apexGate` asks for (the ones whose first hint
// is nearest), rests only when nearly dead, and from Loop 2 aims at the ending with the fewest unmet requirement parts.
// Deterministic: it reads the state and keeps notes in its memory; no draws at all.
//
// Policy, in the order a step is decided (PLAN §7.2's rows; where PLAN is silent, `melee`'s, marked "melee" below; two
// readings of U38 are marked "U38"):
//   combat     the communion first (Loop 2+, the Tyrant: Commune, then Speak/Listen/Offer as the caster does, a blow to forfeit
//              a question nothing can answer; at the Resolution the ending with the fewest unmet requirement parts, `explain()`,
//              ties in letter order); a rejected communion is left at once (`flee`: the fastest loop end). Otherwise `flee`
//              whenever the fight can be fled — after a draught below 30 % hp (melee) — and fight what cannot be fled (the
//              boss, a story gate) with melee's rows.
//   dialogue   the Loop 1 Apex prompt: *Face it* when there is no fight there or level ≥ the fight − 3 (melee), else *Not yet*;
//              accepts a quest only while the gate still needs one (the nearest first hint first); questStart is worth
//              10 − distance while the gate needs a quest, otherwise nothing; the Heartstone: destroy by Day 10, else stabilize
//              (melee: the clock it takes off helps a speed run, and the rule is melee's).
//   threshold  melee's: the cheapest Attunement while Resonance ≥ 10, wear up to 5, keep the class, start the next loop.
//   explore    the portal when it opens; in a Horde, straight to the portal; stat points → AGI (U38: the flee chance reads AGI),
//              the cheapest Steel/Breaker ability (melee), better gear on, everything on the ground taken; a bed only below
//              25 % hp; no shopping, no gathering; talk to each NPC once per quest state (a conversation costs no time) and
//              interact only where a quest hint points; then travel: the Apex as soon as the gate is open (and the Loop 1 fight
//              there, if any, is within reach: level ≥ the fight − 3, or a conversation from Loop 2) → else the quest hint
//              nearest by route → else the nearest unvisited place (to find a giver) → else pass the time at a bed.
//   routing    through everything, except a place where the player fell at its current level or above (melee's death note) or
//              one that has turned it back 4 times by wanderers it fled (U38: `shunned`).
import { APEX_LOCATION_ID, sceneForNpc, type Action } from '@engine/index';
import { APEX_MARGIN, MELEE } from './melee';
import {
  MELEE_THRESHOLD,
  apexCommunion,
  apexGateOpen,
  apexReadyBy,
  apexSettled,
  communion,
  fallback,
  forfeitBlow,
  head,
  healItems,
  hintTargets,
  meleeFight,
  meleeUnlockRank,
  needsQuest,
  notesOf,
  passTime,
  questDistance,
  rankEndings,
  recover,
  shunned,
  social,
  talkThrough,
  thresholdStep,
  towardHint,
  track,
  type DialogueCfg,
  type Env,
  type Notes,
  type RestCfg,
  type SocialCfg,
} from './policy';
import { bfsPath, firstOf, healthFraction, nearestUnvisited, pendingFights, pressOn, stepAlong, type PathOptions } from './shared';
import type { Bot, BotMemory } from './types';

export const SPEEDRUNNER = {
  /** A bed only below this fraction of max HP (PLAN §7.2). */
  restHpBelow: 0.25,
} as const;

const REST: RestCfg = { hpBelow: SPEEDRUNNER.restHpBelow, mpBelow: 0, drinkBelow: SPEEDRUNNER.restHpBelow };

const notes = (memory: BotMemory): Notes => notesOf(memory, 'speedrunner');

/** Worth walking to the Apex: nothing there to fight now, or a conversation (Loop 2+), or strong enough by melee's rule. */
function ready(env: Env): boolean {
  const { s, content, profile } = env;
  return pendingFights(s, content, profile, APEX_LOCATION_ID).length === 0 || apexCommunion(env) || apexReadyBy(env, APEX_MARGIN);
}

const DIALOGUE: DialogueCfg = {
  apexReady: ready,
  heartstone: 'melee',
  quest: (questId, env) => (needsQuest(env) ? 10 - questDistance(env, questId) : 0),
  accept: (questId, env) => needsQuest(env) && env.content.quests[questId]?.countsForApex !== false,
  acceptRank: (questId, env) => questDistance(env, questId),
};

const SOCIAL = (env: Env): SocialCfg => ({
  talk: 'npc',
  heartstone: 'melee',
  // events only where a quest hint points (they may be the objective); never gather
  interact: hintTargets(env.s, env.content).some((h) => h.locationId === env.s.world.currentLocationId),
  gather: false,
});

function fight(env: Env, memory: BotMemory): Action {
  const { s, legal } = env;
  const ranked = rankEndings(env).map((e) => e.endingId);
  memory['target'] = ranked[0] ?? null;
  const talk = communion(env, { endings: ranked });
  if (talk.kind === 'act') return talk.action;
  if (talk.kind === 'stuck') return forfeitBlow(env);
  const flee = firstOf(legal, 'flee');
  if (talk.kind === 'rejected' && flee !== undefined) return flee;
  const hp = healthFraction(s);
  // flee every fight that can be fled — but a draught first when the blows have been landing
  return meleeFight(env, (e) => hp >= MELEE.healItemBelow || healItems(e).length === 0);
}

function explore(env: Env): Action {
  const { s, legal, content, profile } = env;
  const here = s.world.currentLocationId;

  const early = head(env, { stat: 'agility', unlock: meleeUnlockRank });
  if (early !== undefined) return early;

  const fell = (id: string): boolean => shunned(env, id);
  const opts: PathOptions = { avoid: fell };
  const recovery = recover(env, REST, opts);
  if (recovery !== undefined) return recovery;
  const people = social(env, SOCIAL(env), (npcId) => sceneForNpc(s, content, profile, npcId)?.id);
  if (people !== undefined) return people;

  // the Apex as soon as the gate is open
  if (apexGateOpen(env) && !apexSettled(env) && ready(env)) {
    const toApex = stepAlong(legal, bfsPath(s, content, profile, here, APEX_LOCATION_ID, opts));
    if (toApex !== undefined) return toApex;
  }
  // the gate wants quests (or the Apex wants strength): the nearest hint by route, else look for a giver
  if (!apexGateOpen(env) || needsQuest(env)) {
    const dist = (h: { locationId: string }): number => bfsPath(s, content, profile, here, h.locationId, opts)?.length ?? 99;
    const hinted = towardHint(env, dist, (id) => !fell(id), opts);
    if (hinted !== undefined) return hinted;
    const go = stepAlong(legal, nearestUnvisited(s, content, profile, (id) => !fell(id) && id !== APEX_LOCATION_ID, opts)?.path ?? null);
    if (go !== undefined) return go;
  }
  return passTime(env, opts);
}

export function speedrunnerBot(): Bot {
  return {
    name: 'speedrunner',
    preferredClasses: ['ranger', 'ironclad_warden'],
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
          return explore(env);
        default:
          return fallback(legal);
      }
    },
  };
}
