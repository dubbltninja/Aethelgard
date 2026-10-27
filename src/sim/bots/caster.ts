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
//              above it when rushing to the Apex, any fight ≥ 4 levels above it (U81b1, D-066's explorer rule: deaths should
//              come from fights a player would take), or with the companion down below 20 % hp (melee); then the class-aware
//              fight (`classFight`, U81b1) with a spell lean and a heal below 35 %: a draught, else a self-heal spell; Guard
//              below 25 % with no draught; the class's debuffs (Weaken/Curse on a boss first, Soaked before Storm) and buffs on
//              their cooldowns while one damaging spell's mana stays in hand; else the strike worth the most (× 1.5 on a
//              weakness, × 0.5 on a resistance, never on an immunity); with nothing affordable, Guard when hp < 50 % (it feeds
//              the mana pool) else a basic attack. The Weaver's Blood price (and any self-cost spell) is paid when HP stays
//              comfortable (U81b1: ≥ 40 % of max after the cost and above the telegraphed blows; before U81b1 only above 60 %
//              hp, which the Weaver never was when short of mana: 0 of 47,083 casts, D-145). Played on a martial class it
//              uses that class's kit.
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
//              time at a bed (melee). U81b2: with ≤ 10 dawns left (`apexDue`) the Apex, when ready, comes first.
//   routing    melee's: never through a place whose band starts more than 2 above the player's level, nor one where the player
//              fell at its current level or above, nor one that has turned it back 4 times by wanderers it fled (U38: `shunned`,
//              since fleeing returns the party to the previous node); a Horde, and the rush to a conversation, lift the band rule.
import { APEX_LOCATION_ID, sceneForNpc, type Action } from '@engine/index';
import type { Ability } from '@schema/ability';
import { classFight, healRow, type ClassFightCfg } from './classFight';
import { APEX_MARGIN, FOCUS_HEARTSTONE, MELEE } from './melee';
import {
  MELEE_REST,
  MELEE_TRADE,
  apexCommunion,
  apexReadyBy,
  apexSettled,
  classHead,
  fellHere,
  communion,
  fallback,
  foeLevel,
  forfeitBlow,
  head,
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
import { apexDue, bfsPath, canReachApex, firstOf, healthFraction, levelBand, nearestUnvisited, pressOn, stepAlong, type PathOptions } from './shared';
import { dangerAt, DANGER_MARGIN } from './danger';
import { questErrand } from './questFollow';
import type { Bot, BotMemory } from './types';

export const CASTER = {
  /** Heal below this fraction of max HP. */
  healBelow: 0.35,
  /** Rushing to the Apex: flee a fight whose strongest foe is this many levels above the player. */
  rushFleeMargin: 3,
  /** Never read a book that would take corruption past this. */
  maxCorruption: 4,
} as const;

/** The caster's fight (`classFight`): spells first, heal below 35 %. */
export const SPELL_FIGHT: ClassFightCfg = { lean: 'spell', healBelow: CASTER.healBelow, hexBossFirst: true };

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

const SOCIAL: SocialCfg = { talk: 'npc', heartstone: FOCUS_HEARTSTONE, interact: true, gather: true };

/** The factions whose quests the caster follows first (PLAN §7.2), and whose reputation it likes. */
const LEAN = ['weavers', 'remnants'] as const;

const DIALOGUE: DialogueCfg = {
  apexReady: (env) => rushing(env) || apexReadyBy(env, APEX_MARGIN),
  heartstone: FOCUS_HEARTSTONE,
  factions: { weavers: 2, remnants: 2 },
  // the Echo Crystal: keep it (PLAN §7.2); no effect schema says "keep", so it is read from the choice id
  score: (choiceId) => (/(^|_)keep(_|$)/.test(choiceId) ? 3 : 0),
};

const notes = (memory: BotMemory): Notes => notesOf(memory, 'caster');

/** From Loop 2, with the Tyrant at the Apex to be talked to: a conversation needs no level, so the caster goes straight there. */
export const rushing = (env: Env): boolean => env.s.meta.loop >= 2 && apexCommunion(env);

/** Pyre/Storm/Hex/Drain spells first, then any other non-physical damaging spell (the caster's own lean; `classUnlockRank` fits it to the class). */
export function casterUnlockRank(ab: Ability): number | undefined {
  if (ab.branch !== undefined && CASTER_BRANCHES.includes(ab.branch)) return 0;
  return ab.power !== undefined && ab.damageType !== undefined && ab.damageType !== 'physical' ? 1 : undefined;
}

// ---- combat --------------------------------------------------------------------------------------------------------------------

function fight(env: Env, memory: BotMemory): Action {
  const { s, legal, content } = env;
  const combat = s.combat;
  if (combat === null) return fallback(legal);

  // the conversation (Loop 2+)
  const talk = communion(env, COMMUNE);
  if (talk.kind === 'act') return talk.action;
  if (talk.kind === 'stuck') return healRow(s, legal, content, CASTER.healBelow) ?? forfeitBlow(env);

  const hp = healthFraction(s);
  const flee = firstOf(legal, 'flee');
  if (flee !== undefined && combat.canFlee) {
    if (rushing(env) && foeLevel(s) >= s.player.level + CASTER.rushFleeMargin) return flee;
    if (foeLevel(s) >= s.player.level + DANGER_MARGIN || fellHere(env)) return flee;
    if (companionDown(s) && hp < MELEE.fleeBelow) return flee;
  }
  return classFight(s, legal, content, memory, SPELL_FIGHT);
}

// ---- explore ---------------------------------------------------------------------------------------------------------------------

function explore(env: Env, memory: BotMemory): Action {
  const { s, legal, content, profile } = env;
  const here = s.world.currentLocationId;
  const level = s.player.level;
  const rush = rushing(env);

  const early = head(env, classHead(env, 'magic', CASTER_BRANCHES));
  if (early !== undefined) return early;
  const book = pickBook(env, CASTER.maxCorruption);
  if (book !== undefined) return book;

  const fell = (id: string): boolean => shunned(env, id);
  // U81b1 (danger.ts): never through an unfleeable fight ≥ level + 4; never to a place with any such fight
  const tooHard = (id: string): boolean => (levelBand(content, id)?.min ?? 0) > level + MELEE.bandSlack || dangerAt(s, content, profile, id, 'pass');
  const opts: PathOptions = { avoid: (id) => fell(id) || tooHard(id) };
  const safe = (id: string): boolean => !fell(id) && !tooHard(id) && !dangerAt(s, content, profile, id, 'visit');

  const recovery = recover(env, MELEE_REST, opts);
  if (recovery !== undefined) return recovery;
  const trade = pickTrade(env, TRADE);
  if (trade !== undefined) return trade;
  const people = social(env, SOCIAL, (npcId) => sceneForNpc(s, content, profile, npcId)?.id);
  if (people !== undefined) return people;
  const errand = questErrand(s, legal, content, memory); // U81b1: search a hint for an objective's item, or buy it (questFollow.ts)
  if (errand !== undefined) return errand;

  // where next
  const ready = !apexSettled(env) && (rush || apexReadyBy(env, APEX_MARGIN));
  // U81b2: once the Apex is due (≤ 10 dawns left) a ready caster goes there before hints and unvisited places
  if (ready && !rush && apexDue(s)) {
    const toApex = stepAlong(legal, bfsPath(s, content, profile, here, APEX_LOCATION_ID, opts));
    if (toApex !== undefined) return toApex;
  }
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
    examines: true, // U81b1: only to search a quest hint (questErrand)
    init: () => ({}),
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
          return thresholdStep(env, THRESHOLD);
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
