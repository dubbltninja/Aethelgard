// The `pacifist` bot (PLAN §7.2; DESIGN §19 #12, §15.1 Pacifist's Vow): never raises a hand against anything it can leave. It
// guards, drinks, orders its companion to hold, and flees at the first chance; takes only the quests that need no kill; earns
// its experience from the quests and the places it finds; takes the Vow when the Threshold offers it; leaves the Heartstone
// stabilized; and talks the Tyrant down (DESIGN §4.11) instead of fighting it, aiming at the endings F, then A, then E.
// Deterministic: it reads the state and keeps notes in its memory; no draws at all.
//
// Policy, in the order a step is decided (PLAN §7.2's rows; where PLAN is silent, `melee`'s, marked "melee" below; readings
// of U38 are marked "U38"):
//   combat     the communion first (Loop 2+, the Tyrant: Commune, then Speak/Listen/Offer as the caster does; at the Resolution
//              the ending F, A or E, else another; U38: a question nothing can answer is forfeited with one basic attack — the
//              only blow it strikes by choice); a rejected communion is left (`flee`). Otherwise: order the companion to hold
//              (free); `flee` whenever it is listed (but see `walledIn` under routing); with no way out, Guard while the telegraphed
//              blows (the intents' numbers, halved by Guard) leave HP standing — after a draught below 50 % when it covers
//              the blow — and only when even Guard would not survive them (or after 40 rounds of Guarding, U38's stall
//              breaker), the strike promising the most damage: a forced fight, counted in `forced`. Its hp-below-30 % draught
//              and Field Dressing are melee's.
//   dialogue   the Loop 1 Apex prompt: *Face it* only where no fight would start (U38), else *Not yet*; accepts a quest only
//              when no objective, branch or advance condition of it names a kill; a choice that starts a fight is worth −10 and
//              a quest that needs a kill −8; questStart +4 otherwise; the Heartstone: stabilize.
//   threshold  melee's with the Vow switched on (`mod_pacifist` when the pack has it) and a lean to Quick Study (the Vow doubles
//              the experience it lives on); keeps the class (melee).
//   explore    the portal when it opens; in a Horde, straight to the portal; stat points → AGI (U38: it lives on the flee chance),
//              the cheapest defensive ability (heal, shield, a flee aid), better gear on, everything on the ground taken; rest
//              at hp < 50 % or mp < 30 % (melee); merchant: sell materials, stock healing (melee; no forge); talk to each NPC
//              once per quest state, interact (skipping events that start a fight), gather; then travel: the Apex (U38: when
//              nothing would fight it there — or it can be talked to, from Loop 2) → quest hints of no-kill quests → the nearest
//              unvisited place → pass the time at a bed.
//   routing    through everything but a place where the player fell at its current level or above (melee's death note) and
//              a place with a fight that cannot be fled and cannot be talked to (U38). No level-band rule: the pacifist
//              does not level, it leaves. Also not through a place that has turned it back 4 times by wanderers it fled (U38:
//              `shunned`; fleeing returns the party to the previous node). When such a place is the only way home from where
//              it would flee to (the economy pack's Mistwood Path: every arrival there starts a wandering fight), it stands
//              and fights instead (`walledIn`): a forced fight, counted in `forced`.
import { APEX_LOCATION_ID, PORTAL_LOCATION_ID, playerOf, sceneForNpc, type Action } from '@engine/index';
import type { Ability } from '@schema/ability';
import { MELEE } from './melee';
import {
  BOUNCE_LIMIT,
  MELEE_REST,
  MELEE_TRADE,
  apexCommunion,
  apexSettled,
  communion,
  fallback,
  forfeitBlow,
  head,
  healItems,
  mendAbility,
  notesOf,
  passTime,
  pickTrade,
  questNeedsKill,
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
  type SocialCfg,
  type ThresholdCfg,
  type TradeCfg,
} from './policy';
import { allOf, bfsPath, firstOf, foesOf, healthFraction, nearestUnvisited, pendingFights, stepAlong, type PathOptions } from './shared';
import type { Bot, BotMemory } from './types';

export const PACIFIST = {
  /** Drink a draught that covers the coming blow below this fraction of max HP while Guarding (the Guard-and-heal loop). */
  drinkBelow: 0.5,
  /** Rounds of Guarding with no way out before it strikes (a stall breaker: PLAN §7.6 rule 4 calls round 60 a soft-lock). */
  guardRounds: 40,
  /** Worth of a choice that starts a fight, and of starting a quest that needs a kill. */
  fightScore: -10,
  killQuestScore: -8,
  /** Guard halves direct damage (DESIGN §4.7). */
  guardFactor: 0.5,
} as const;

/** PLAN §7.2: the endings F, then A, then E. */
export const PACIFIST_ENDINGS: readonly string[] = ['ending_unbound', 'ending_wardens_vigil', 'ending_long_archive'];

/** The Vow (DESIGN §15.1): kill XP 0, quest and discovery XP ×2. */
export const PACIFIST_VOW = 'mod_pacifist';

const TRADE: TradeCfg = { ...MELEE_TRADE, upgrade: false };

const THRESHOLD: ThresholdCfg = { prefer: ['att_quick_study'], modifiers: [PACIFIST_VOW], keepResonance: MELEE.thresholdKeepResonance, slots: MELEE.attunementSlots };

/** Talk to the Tyrant (Loop 2+), or nothing waits at the Apex: nothing there to fight. */
const safeApex = (env: Env): boolean => {
  const fights = pendingFights(env.s, env.content, env.profile, APEX_LOCATION_ID);
  return fights.length === 0 || fights.every((f) => f.communion || f.fleeable);
};

const DIALOGUE: DialogueCfg = {
  apexReady: safeApex,
  heartstone: 'stabilize',
  fightScore: PACIFIST.fightScore,
  quest: (questId, env) => (questNeedsKill(env.content, questId) ? PACIFIST.killQuestScore : 4),
  accept: (questId, env) => !questNeedsKill(env.content, questId),
};

const SOCIAL: SocialCfg = { talk: 'npc', heartstone: 'stabilize', interact: true, gather: true, avoidFights: true };

const notes = (memory: BotMemory): Notes => notesOf(memory, 'pacifist');

/** A defensive ability: heals, shields and the ones that make the next flee certain. */
export function pacifistUnlockRank(ab: Ability): number | undefined {
  if (ab.id === 'rgr_smoke_bomb' || ab.id === 'elf_veilwalk') return 0;
  if (ab.heal !== undefined) return 1;
  return ab.shield !== undefined ? 2 : undefined;
}

// ---- combat --------------------------------------------------------------------------------------------------------------------

/** The blow the foes have telegraphed for the player this round, at its worst (their intents' projected maxima). */
function incoming(env: Env): number {
  const combat = env.s.combat;
  if (combat === null) return 0;
  const me = playerOf(combat);
  let total = 0;
  for (const e of foesOf(env.s)) {
    const intent = combat.intents[e.uid];
    if (intent !== undefined && (intent.targetUid === null || intent.targetUid === me.uid)) total += intent.projected[1];
  }
  return total;
}

function fight(env: Env): Action {
  const { s, legal, n } = env;
  const combat = s.combat;
  if (combat === null) return fallback(legal);
  const talk = communion(env, { endings: PACIFIST_ENDINGS });
  if (talk.kind === 'act') return talk.action;
  const flee = firstOf(legal, 'flee');
  if (talk.kind === 'stuck') return forfeitBlow(env);
  if (talk.kind === 'rejected' && flee !== undefined) return flee;

  const hold = legal.find((a) => a.type === 'companionCommand' && a.command === 'hold');
  if (hold !== undefined) return hold;
  if (flee !== undefined && !walledIn(env)) return flee;

  const me = playerOf(combat);
  const hits = incoming(env);
  const guardOk = me.hp > hits * PACIFIST.guardFactor;
  const heals = healItems(env);
  const hp = healthFraction(s);
  if (hp < MELEE.healItemBelow && heals[0] !== undefined) return heals[0].a;
  const mend = mendAbility(env);
  if (hp < MELEE.healItemBelow && mend !== undefined) return mend;
  if (guardOk && combat.round < PACIFIST.guardRounds && firstOf(legal, 'guard') !== undefined) {
    if (hp < PACIFIST.drinkBelow && heals[0] !== undefined) return heals[0].a;
    return { type: 'guard' };
  }
  // no way out and Guard will not do: the only blows it strikes by choice
  const covering = heals.find((h) => me.hp + h.hp > hits * PACIFIST.guardFactor);
  if (!guardOk && covering !== undefined) return covering.a;
  n.forced += 1;
  return strongest(env);
}

/**
 * Fleeing a wandering fight puts the party back where it came from, so a place that meets every arrival with one (the
 * economy pack's Mistwood Path) can never be passed by running: when it has turned the bot back `BOUNCE_LIMIT` times and
 * the way home from the node it would flee to is shut by places the bot gave up, it stands and fights (a forced fight).
 */
function walledIn(env: Env): boolean {
  const { s, content, profile, n } = env;
  const here = s.world.currentLocationId;
  const back = s.world.previousLocationId;
  if (back === null || (n.bounces[`${s.meta.runId}|${here}`] ?? 0) < BOUNCE_LIMIT) return false;
  return bfsPath(s, content, profile, back, PORTAL_LOCATION_ID, { avoid: (id) => id !== back && shunned(env, id) }) === null;
}

/** The listed strike promising the most damage (a forced fight). */
function strongest(env: Env): Action {
  const { s, legal, content } = env;
  const combat = s.combat;
  if (combat === null) return fallback(legal);
  const me = playerOf(combat);
  const foes = foesOf(s);
  const damage = (a: Action): number => {
    if (a.type === 'attack') return me.atk;
    if (a.type !== 'ability') return 0;
    const p = content.abilities[a.abilityId]?.power;
    return p === undefined ? 0 : (p.base + p.coef * (p.stat === 'sp' ? me.sp : me.atk)) * p.hits * (content.abilities[a.abilityId]?.target === 'all_enemies' ? foes.length : 1);
  };
  const strikes = [...allOf(legal, 'ability'), ...allOf(legal, 'attack')].filter((a) => damage(a) > 0);
  return [...strikes].sort((a, b) => damage(b) - damage(a))[0] ?? firstOf(legal, 'guard') ?? fallback(legal);
}

// ---- explore ---------------------------------------------------------------------------------------------------------------------

function explore(env: Env): Action {
  const { s, legal, content, profile } = env;
  const here = s.world.currentLocationId;

  const early = head(env, { stat: 'agility', unlock: pacifistUnlockRank });
  if (early !== undefined) return early;

  // a place with a fight that cannot be fled and cannot be talked to is not walked into (the Apex is handled below)
  const fell = (id: string): boolean => shunned(env, id);
  const blocked = (id: string): boolean => id !== here && pendingFights(s, content, profile, id).some((f) => !f.fleeable && !f.communion);
  const opts: PathOptions = { avoid: (id) => fell(id) || blocked(id) };
  const safe = (id: string): boolean => !fell(id) && !blocked(id);

  const recovery = recover(env, MELEE_REST, opts);
  if (recovery !== undefined) return recovery;
  const trade = pickTrade(env, TRADE);
  if (trade !== undefined) return trade;
  const people = social(env, SOCIAL, (npcId) => sceneForNpc(s, content, profile, npcId)?.id);
  if (people !== undefined) return people;

  // where next: the Apex when nothing there would fight → no-kill quest hints → the nearest unvisited place → pass the time
  if (!apexSettled(env) && safeApex(env) && (apexCommunion(env) || pendingFights(s, content, profile, APEX_LOCATION_ID).length === 0)) {
    const toApex = stepAlong(legal, bfsPath(s, content, profile, here, APEX_LOCATION_ID, { avoid: fell }));
    if (toApex !== undefined) return toApex;
  }
  const hinted = towardHint(env, (h) => (questNeedsKill(content, h.questId) ? 1 : 0), (id) => safe(id), opts);
  if (hinted !== undefined) return hinted;
  const go = stepAlong(legal, nearestUnvisited(s, content, profile, safe, opts)?.path ?? null);
  if (go !== undefined) return go;
  return passTime(env, opts);
}

export function pacifistBot(): Bot {
  return {
    name: 'pacifist',
    preferredClasses: ['ranger', 'ironclad_warden'],
    init: () => ({}),
    choose(state, legal, content, memory, ctx) {
      const n = notes(memory);
      track(n, state, ctx.recentEvents);
      const env: Env = { s: state, legal, content, profile: ctx.profile, n };
      switch (state.mode) {
        case 'combat':
          return fight(env);
        case 'dialogue':
          return talkThrough(env, DIALOGUE);
        case 'threshold':
          return thresholdStep(env, THRESHOLD);
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
