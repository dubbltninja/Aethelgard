// The `caster` bot (PLAN §7.2; DESIGN §19 #3, #10): a spell-caster that fights with the element the foe is weak to, soaks
// before it storms, weakens the boss first, keeps one spell's worth of mana in hand, explores like `melee` but follows the
// Shadow Weavers' and Remnants' quests, reads the Dark Spellbooks up to corruption 4, spends stat points on MAG, keeps the
// Echo Crystal, exploits the Heartstone, and — from Loop 2 — talks the Tyrant down (DESIGN §4.11) instead of fighting it.
// Deterministic: it reads the state and keeps notes in its memory; no draws at all.
//
// Policy, in the order a step is decided (PLAN §7.2's rows; where PLAN is silent, `melee`'s, marked "melee" below):
//   combat     the communion first (Loop 2+, the Tyrant: *Commune* on the first turn, then every held answer Echo — Speak, else
//              Listen, else Offer; a question nothing can answer is forfeited with a blow; at the Resolution the ending it likes
//              best: C, B, A, F, E, D); a rejected communion is fought on (PLAN: "else fights"). Otherwise: flee a fight ≥ 3 levels
//              above it when rushing to the Apex, or with the companion down below 20 % hp (melee); heal below 35 % (a draught,
//              else a self-heal spell; melee's draught-before-spell order); Guard below 25 % with no draught (melee); a boss
//              gets Weaken/Curse (a `hex` spell) first; Soaked then a Storm spell when the pack has both; else the spell with
//              the most expected damage (× 1.5 on a weakness, × 0.5 on a resistance, never on an immunity), a damaging spell
//              always, any other spell only when mana stays ≥ the cheapest damaging spell afterwards; with nothing affordable,
//              Guard when hp < 50 % (it feeds the mana pool) else a basic attack. A Weaver (blood price) or any self-cost spell
//              is cast only above 60 % hp.
//   dialogue   the Loop 1 Apex prompt as melee; accepts every quest; questStart > Remnants/Weavers reputation > first, with the
//              Echo Crystal kept (`keep`), the Heartstone exploited, untaken choices first (melee).
//   threshold  melee's with a caster's lean (Deep Well, Quick Study first); keeps the class (melee).
//   explore    the portal when it opens; in a Horde, straight to the portal; stat points → MAG, the cheapest Pyre/Storm (Wizard)
//              or Hex/Drain (Weaver) spell, else any other damaging non-physical one; better gear on; everything on the ground
//              taken; `readBook` up to corruption 4; hp < 50 % or mp < 30 % → rest (melee); merchant: melee's, plus up to 3 Mana
//              Bloom and 3 Chronal Dust (when the stock has them); talk to each NPC once per quest state, interact once, gather;
//              then travel: from Loop 2 with the Tyrant to talk to, straight to the Apex once it is open (level bands and fleeable
//              fights do not matter to a conversation) — otherwise quest hints (Weavers' and Remnants' quests first) → the nearest
//              unvisited place whose band starts at most 2 above the player's → the Apex when level ≥ the fight − 3 → pass the
//              time at a bed (melee).
//   routing    melee's: never through a place whose band starts more than 2 above the player's level, nor one where the player
//              fell at its current level or above, nor one that has turned it back 4 times by wanderers it fled (U38: `shunned`,
//              since fleeing returns the party to the previous node); a Horde, and the rush to a conversation, lift the band rule.
import { APEX_LOCATION_ID, playerOf, sceneForNpc, type Action, type ContentPack, type GameState } from '@engine/index';
import type { Ability } from '@schema/ability';
import { APEX_MARGIN, MELEE } from './melee';
import {
  MELEE_REST,
  MELEE_TRADE,
  apexCommunion,
  apexReadyBy,
  apexSettled,
  communion,
  fallback,
  foeLevel,
  forfeitBlow,
  head,
  healItems,
  mendAbility,
  companionDown,
  notesOf,
  passTime,
  pickBook,
  pickTrade,
  recover,
  shunned,
  social,
  talkThrough,
  thresholdStep,
  towardHint,
  track,
  type CommuneCfg,
  type DialogueCfg,
  type Env,
  type Notes,
  type SocialCfg,
  type ThresholdCfg,
  type TradeCfg,
} from './policy';
import {
  allOf,
  appliesStatus,
  bfsPath,
  canReachApex,
  firstOf,
  foesOf,
  expectedDamage,
  hasStatus,
  healthFraction,
  levelBand,
  nearestUnvisited,
  pressOn,
  resistanceOf,
  stepAlong,
  type PathOptions,
} from './shared';
import type { Bot, BotMemory } from './types';

export const CASTER = {
  /** Heal below this fraction of max HP. */
  healBelow: 0.35,
  /** A Weaver pays blood (and any self-cost spell is cast) only above this fraction. */
  bloodAbove: 0.6,
  /** Guard for mana when nothing is affordable and hp is below this. */
  guardForManaBelow: 0.5,
  /** Rushing to the Apex: flee a fight whose strongest foe is this many levels above the player. */
  rushFleeMargin: 3,
  /** Never read a book that would take corruption past this. */
  maxCorruption: 4,
  /** Weakness / resistance multipliers on a spell's expected damage. */
  weakMult: 1.5,
  resistMult: 0.5,
  /** A Storm spell on a Soaked foe. */
  soakedStormMult: 1.5,
  /** The statuses a `hex` spell is used for on a boss. */
  hexStatuses: ['status_weaken', 'status_curse'],
  soaked: 'status_soaked',
  /** The damage types of the combo. */
  storm: 'storm',
} as const;

/** PLAN §7.2: Pyre/Storm (Wizard) and Hex/Drain (Weaver). */
export const CASTER_BRANCHES: readonly string[] = ['pyre', 'storm', 'hex', 'drain'];

/** Ending preference at the Resolution (the caster's lean: Weaver's Dawn, the Mending, the Vigil, the Unbound, the Archive, the Silence). */
export const CASTER_ENDINGS: readonly string[] = ['ending_weavers_dawn', 'ending_mending', 'ending_wardens_vigil', 'ending_unbound', 'ending_long_archive', 'ending_iron_silence'];

const COMMUNE: CommuneCfg = { endings: CASTER_ENDINGS };

const TRADE: TradeCfg = {
  ...MELEE_TRADE,
  upgrade: false,
  stock: [
    { itemId: 'item_mana_bloom', max: 3 },
    { itemId: 'item_chronal_dust', max: 3 },
  ],
};

const THRESHOLD: ThresholdCfg = { prefer: ['att_deep_well', 'att_quick_study'], modifiers: [], keepResonance: MELEE.thresholdKeepResonance, slots: MELEE.attunementSlots };

const SOCIAL: SocialCfg = { talk: 'npc', heartstone: 'exploit', interact: true, gather: true };

/** The factions whose quests the caster follows first (PLAN §7.2), and whose reputation it likes. */
const LEAN = ['weavers', 'remnants'] as const;

const DIALOGUE: DialogueCfg = {
  apexReady: (env) => rushing(env) || apexReadyBy(env, APEX_MARGIN),
  heartstone: 'exploit',
  factions: { weavers: 2, remnants: 2 },
  // the Echo Crystal: keep it (PLAN §7.2); no effect schema says "keep", so it is read from the choice id
  score: (choiceId) => (/(^|_)keep(_|$)/.test(choiceId) ? 3 : 0),
};

const notes = (memory: BotMemory): Notes => notesOf(memory, 'caster');

/** From Loop 2, with the Tyrant at the Apex to be talked to: a conversation needs no level, so the caster goes straight there. */
export const rushing = (env: Env): boolean => env.s.meta.loop >= 2 && apexCommunion(env);

/** Pyre/Storm/Hex/Drain spells first, then any other non-physical damaging spell. */
export function casterUnlockRank(ab: Ability): number | undefined {
  if (ab.branch !== undefined && CASTER_BRANCHES.includes(ab.branch)) return 0;
  return ab.power !== undefined && ab.damageType !== undefined && ab.damageType !== 'physical' ? 1 : undefined;
}

// ---- combat --------------------------------------------------------------------------------------------------------------------

/** What the spell costs in blood (Weaver) or self-harm, as a reason to wait for a healthy moment. */
function bloody(env: Env, ab: Ability, mp: number): boolean {
  const weaver = env.content.classes[env.s.player.classId]?.resource.bloodPrice !== undefined;
  return ab.selfCost !== undefined || (weaver && ab.mp > mp);
}

/** The cheapest damaging spell the player has unlocked (the mana it keeps in hand), 0 if none. */
function reserve(s: GameState, content: ContentPack): number {
  const costs = s.player.abilitiesUnlocked.map((id) => content.abilities[id]).filter((a): a is Ability => a?.power !== undefined && a.mp > 0).map((a) => a.mp);
  return costs.length === 0 ? 0 : Math.min(...costs);
}

function fight(env: Env): Action {
  const { s, legal, content } = env;
  const combat = s.combat;
  if (combat === null) return fallback(legal);

  // the conversation (Loop 2+)
  const talk = communion(env, COMMUNE);
  if (talk.kind === 'act') return talk.action;
  const stuck = talk.kind === 'stuck';

  const me = playerOf(combat);
  const hp = healthFraction(s);
  const foes = foesOf(s);
  const flee = firstOf(legal, 'flee');
  if (!stuck && flee !== undefined && combat.canFlee) {
    if (rushing(env) && foeLevel(s) >= s.player.level + CASTER.rushFleeMargin) return flee;
    if (companionDown(s) && hp < MELEE.fleeBelow) return flee;
  }
  const heals = healItems(env);
  if (hp < CASTER.healBelow && heals[0] !== undefined) return heals[0].a;
  const mend = mendAbility(env);
  if (hp < CASTER.healBelow && mend !== undefined) return mend;
  if (!stuck && hp < MELEE.guardBelow && heals.length === 0 && firstOf(legal, 'guard') !== undefined) return { type: 'guard' };

  const aimed = (a: Extract<Action, { type: 'ability' | 'attack' }>): ReturnType<typeof foesOf> => {
    if (a.targetUid !== undefined) return foes.filter((f) => f.uid === a.targetUid);
    const ab = a.type === 'ability' ? content.abilities[a.abilityId] : undefined;
    return ab?.target === 'all_enemies' ? foes : foes.slice(0, 1);
  };
  const spells = allOf(legal, 'ability').filter((a) => content.abilities[a.abilityId] !== undefined);
  const abilityOf = (a: Extract<Action, { type: 'ability' }>): Ability => content.abilities[a.abilityId] as Ability;
  const cheapestStrike = reserve(s, content);
  const blood = (ab: Ability): boolean => bloody(env, ab, me.mp);
  const healthy = hp > CASTER.bloodAbove;
  const allowed = (a: Extract<Action, { type: 'ability' }>): boolean => {
    const ab = abilityOf(a);
    if (blood(ab) && !healthy) return false;
    if (ab.power !== undefined) return true;
    return me.mp - ab.mp >= cheapestStrike; // keeps one damaging spell in hand
  };

  // a boss first gets Weaken / Curse (a `hex` spell), once
  if (!stuck) {
    const boss = foes.find((f) => content.creatures[f.refId]?.role === 'boss');
    if (boss !== undefined) {
      const hex = spells.find(
        (a) => (a.targetUid === undefined || a.targetUid === boss.uid) && allowed(a) && CASTER.hexStatuses.some((st) => appliesStatus(abilityOf(a), st) && !hasStatus(boss, st)),
      );
      if (hex !== undefined) return hex;
    }
    // Soaked, then Storm
    const stormy = spells.filter((a) => abilityOf(a).damageType === CASTER.storm && abilityOf(a).power !== undefined && allowed(a));
    if (stormy.length > 0) {
      const soak = spells.find((a) => appliesStatus(abilityOf(a), CASTER.soaked) && allowed(a));
      const dry = foes.find((f) => !hasStatus(f, CASTER.soaked));
      if (soak !== undefined && dry !== undefined && (soak.targetUid === undefined || foes.some((f) => f.uid === soak.targetUid && !hasStatus(f, CASTER.soaked)))) return soak;
    }
  }

  // the strike worth the most
  const value = (a: Extract<Action, { type: 'ability' | 'attack' }>): number => {
    const targets = aimed(a);
    if (targets.length === 0) return 0;
    const ab = a.type === 'ability' ? abilityOf(a) : undefined;
    let total = 0;
    for (const f of targets) {
      let mult = 1;
      if (ab?.damageType !== undefined) {
        const r = resistanceOf(content, f, ab.damageType);
        mult = r === 'weak' ? CASTER.weakMult : r === 'resist' ? CASTER.resistMult : r === 'immune' ? 0 : 1;
        if (ab.damageType === CASTER.storm && hasStatus(f, CASTER.soaked)) mult *= CASTER.soakedStormMult;
      } else {
        mult = resistanceOf(content, f, 'physical') === 'immune' ? 0 : 1;
      }
      total += mult;
    }
    const per = expectedDamage(content, me, a, foes.length);
    return per * (total / targets.length);
  };
  const hpOf = (a: Extract<Action, { type: 'ability' | 'attack' }>): number => aimed(a)[0]?.hp ?? Number.POSITIVE_INFINITY;
  const strikes = [...spells.filter((a) => abilityOf(a).power !== undefined && allowed(a)), ...allOf(legal, 'attack')].filter((a) => value(a) > 0);
  const best = [...strikes].sort((a, b) => value(b) - value(a) || hpOf(a) - hpOf(b))[0];
  const spell = best !== undefined && best.type === 'ability' ? best : undefined;
  if (stuck) return forfeitBlow(env);
  if (spell !== undefined) return spell;
  // nothing to cast: Guard feeds the mana pool — when mana is what is missing (U81a, D-110: a spell it holds costs more than it
  // has); a basic attack otherwise
  const starved = s.player.abilitiesUnlocked.some((id) => {
    const ab = content.abilities[id];
    return ab?.power !== undefined && ab.mp > me.mp;
  });
  if (starved && hp < CASTER.guardForManaBelow && firstOf(legal, 'guard') !== undefined) return { type: 'guard' };
  return best ?? firstOf(legal, 'guard') ?? fallback(legal);
}

// ---- explore ---------------------------------------------------------------------------------------------------------------------

function explore(env: Env): Action {
  const { s, legal, content, profile } = env;
  const here = s.world.currentLocationId;
  const level = s.player.level;
  const rush = rushing(env);

  const early = head(env, { stat: 'magic', unlock: casterUnlockRank });
  if (early !== undefined) return early;
  const book = pickBook(env, CASTER.maxCorruption);
  if (book !== undefined) return book;

  const fell = (id: string): boolean => shunned(env, id);
  const tooHard = (id: string): boolean => (levelBand(content, id)?.min ?? 0) > level + MELEE.bandSlack;
  const opts: PathOptions = { avoid: (id) => fell(id) || tooHard(id) };
  const safe = (id: string): boolean => !fell(id) && !tooHard(id);

  const recovery = recover(env, MELEE_REST, opts);
  if (recovery !== undefined) return recovery;
  const trade = pickTrade(env, TRADE);
  if (trade !== undefined) return trade;
  const people = social(env, SOCIAL, (npcId) => sceneForNpc(s, content, profile, npcId)?.id);
  if (people !== undefined) return people;

  // where next
  const ready = !apexSettled(env) && (rush || apexReadyBy(env, APEX_MARGIN));
  if (rush && ready && canReachApex(s, content, profile, { avoid: fell })) {
    const toApex = stepAlong(legal, bfsPath(s, content, profile, here, APEX_LOCATION_ID, { avoid: fell }));
    if (toApex !== undefined) return toApex;
  }
  const lean = (h: { questId: string }): number => (LEAN.includes((content.quests[h.questId]?.factionId ?? '') as (typeof LEAN)[number]) ? 0 : 1);
  const hinted = towardHint(env, lean, safe, opts);
  if (hinted !== undefined) return hinted;
  const go = stepAlong(legal, nearestUnvisited(s, content, profile, safe, opts)?.path ?? null);
  if (go !== undefined) return go;
  if (ready) {
    const toApex = stepAlong(legal, bfsPath(s, content, profile, here, APEX_LOCATION_ID, opts));
    if (toApex !== undefined) return toApex;
  }
  return passTime(env, opts);
}

export function casterBot(): Bot {
  return {
    name: 'caster',
    preferredClasses: ['wizard', 'shadow_weaver'],
    init: () => ({}),
    choose(state, legal, content, memory, ctx) {
      const n = notes(memory);
      track(n, state, ctx.recentEvents);
      const env: Env = { s: state, legal, content, profile: ctx.profile, n };
      switch (state.mode) {
        case 'combat':
          return pressOn(memory, state, legal, content, fight(env));
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
