// Shared policy pieces for the U38 bots (caster, explorer, speedrunner, pacifist; PLAN §7.2). `melee` (U37) keeps its own
// private copies of the same rows and is untouched; these are the same rules with the knobs the four new bots turn
// (which stat, which branch, how often to rest, what to buy, how to answer a dialogue, how to leave the Threshold), plus
// the pieces only they need: the death memory over several loops, fight-or-flight, the Apex plan and the communion
// (DESIGN §4.11). Pure readers of (state, legal, content, profile) plus the bot's notes; no randomness here.
//
// Where PLAN §7.2 is silent the rule is `melee`'s, and the bot's header says so.
import {
  APEX_FACE_IT,
  APEX_LOCATION_ID,
  APEX_NOT_YET,
  PORTAL_LOCATION_ID,
  communionBoss,
  communionRejected,
  currentQuestion,
  dayOf,
  evaluate,
  explain,
  isApexPromptOpen,
  masteredFor,
  playerOf,
  questJournal,
  unlockCostHalf,
  upgradeQuote,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
  type StatName,
} from '@engine/index';
import type { Ability } from '@schema/ability';
import type { Condition } from '@schema/condition';
import type { Effect } from '@schema/effect';
import {
  allOf,
  bedStep,
  hordeRoute,
  bfsPath,
  byId,
  firstOf,
  healAmount,
  healingCarried,
  healthFraction,
  isShellAction,
  itemOf,
  locationThreat,
  manaFraction,
  nearestWhere,
  pendingFights,
  questSignature,
  restAvailable,
  scoreEquipment,
  stepAlong,
  type PathOptions,
} from './shared';
import { idleRoam, MELEE, MELEE_BRANCHES } from './melee';
import { classFight, classStat, classUnlockRank, type ClassFightCfg } from './classFight';
import { acceptable, questTargets } from './questFollow';
import { dangerAt, fellRecently } from './danger';
import { shop } from './shopping';
export { FALLEN_LEVELS, fellRecently } from './danger';
import type { BotMemory } from './types';

// ---- notes -------------------------------------------------------------------------------------------------------------

/** What a bot remembers between choices (in `BotMemory[key]`; survives reloads and loops, like the player's own memory). */
export interface Notes {
  /** npcId → `${runId}|${quest signature}` at the last talk. */
  talked: Record<string, string>;
  /** `${runId}|${scene}|${quest signature}` of the scenes already played (the explorer's "until no new scene appears"). */
  scenes: string[];
  /** `${runId}|${location}|${event}|${quest signature}` already interacted with. */
  interacted: string[];
  /** hint location → quest signature when it was last reached as a hint. */
  hintsReached: Record<string, string>;
  /** location → the highest player level at which the player fell there (any loop). */
  fellAt: Record<string, number>;
  /** runId of the loop in which the Apex was faced (no return that loop). */
  apexFaced: string | null;
  /** `${runId}:${level}` at which the Apex prompt was declined (try again only after a level up). */
  apexDeclined: string | null;
  /** Where the player stood and how strong it was at the previous choice (to place a death that happened since). */
  lastHere: string | null;
  lastLevel: number;
  lastFightAt: string | null;
  /** `${kind}:${id}` already examined (the explorer). */
  examined: string[];
  /** `${scene}:${node}:${choice}` taken at any time in the run (the explorer's coverage of the dialogue). */
  choicesTaken: string[];
  /** `${runId}|${location}` → fights fled there this loop (a place that keeps turning the bot back is given up). */
  bounces: Record<string, number>;
  /** U81b2: idle full rests (melee.ts `idleRoam`). */
  idleRests?: number;
  /** U82: every item id the player has held in the run (the explorer's collection, shopping.ts `collectNew`). */
  held?: string[];
  /** Fights the bot started a blow in (the pacifist's "forced" count). */
  forced: number;
  /** `${runId}|${stage}` communion actions already tried this loop (guards against a loop in the policy). */
  tried: string[];
}

export function notesOf(memory: BotMemory, key: string): Notes {
  const have = memory[`notes:${key}`] as Notes | undefined;
  if (have !== undefined) return have;
  const fresh: Notes = {
    talked: {},
    scenes: [],
    interacted: [],
    hintsReached: {},
    fellAt: {},
    apexFaced: null,
    apexDeclined: null,
    lastHere: null,
    lastLevel: 1,
    lastFightAt: null,
    examined: [],
    choicesTaken: [],
    bounces: {},
    forced: 0,
    tried: [],
  };
  memory[`notes:${key}`] = fresh;
  return fresh;
}

/** Reads the events since the last choice: where fights started, and where the player fell (a reload may follow). */
export function digest(n: Notes, events: readonly GameEvent[], runId = ''): void {
  let at = n.lastHere;
  for (const e of events) {
    if (e.t === 'locationEntered') at = e.locationId;
    else if (e.t === 'combatStarted') n.lastFightAt = at;
    else if (e.t === 'combatEnded' && e.result === 'fled' && n.lastFightAt !== null) {
      const key = `${runId}|${n.lastFightAt}`;
      n.bounces[key] = (n.bounces[key] ?? 0) + 1;
    } else if (e.t === 'playerDied') {
      const where = n.lastFightAt ?? at;
      if (where !== null) n.fellAt[where] = Math.max(n.fellAt[where] ?? 0, n.lastLevel);
      // U81b1: a lost Apex fight is not "faced" for the loop: the reload stands before it, and the death note sets the level to retry at
      n.apexFaced = null;
    }
  }
}

/** Updates the position notes at the top of every `choose`. */
export function track(n: Notes, s: GameState, events: readonly GameEvent[]): void {
  digest(n, events, s.meta.runId);
  n.lastHere = s.world.currentLocationId;
  n.lastLevel = s.player.level;
  if (s.combat !== null) n.lastFightAt = s.combat.locationId;
}

/** A place that has turned the bot back this many times in a loop (fleeing wanderers on every arrival) is given up for the loop. */
export const BOUNCE_LIMIT = 4;

/** Places the bot will not route through: where it fell less than FALLEN_LEVELS levels ago, or that keeps turning it back. */
export const shunned = (env: Env, id: string): boolean => fellRecently(env.n.fellAt, id, env.s.player.level) || (env.n.bounces[`${env.s.meta.runId}|${id}`] ?? 0) >= BOUNCE_LIMIT;

/** Everything a policy row reads. */
export interface Env {
  s: GameState;
  legal: readonly Action[];
  content: ContentPack;
  profile: Profile;
  n: Notes;
}

/** The first listed action that is not the shell's nor an `examine`; the shell's own if nothing else is listed. */
export const fallback = (legal: readonly Action[]): Action => legal.find((a) => !isShellAction(a) && a.type !== 'examine') ?? (legal[0] as Action);

/** Is the player in a Loop 1 Horde-free state where a place's fights can start? (A Horde lifts routing rules: no fights start in one.) */
export const hordeOn = (s: GameState): boolean => s.world.hordeActive;

// ---- the character -----------------------------------------------------------------------------------------------------------

/** `allocateStat` on `stat` if listed, else on any stat. */
export function pickStat(legal: readonly Action[], stat: StatName): Action | undefined {
  return legal.find((a) => a.type === 'allocateStat' && a.stat === stat) ?? firstOf(legal, 'allocateStat');
}

/**
 * The listed `unlockAbility` that `rank` likes best (lower is better; undefined = not wanted), ties by half-point cost
 * (masteries applied) and then by id.
 */
export function pickUnlock(env: Env, rank: (ab: Ability) => number | undefined): Action | undefined {
  const mastered = masteredFor(env.profile, env.s.player.classId);
  const options = allOf(env.legal, 'unlockAbility').flatMap((a) => {
    const ab = env.content.abilities[a.abilityId];
    const r = ab === undefined ? undefined : rank(ab);
    return ab === undefined || r === undefined ? [] : [{ a, rank: r, cost: unlockCostHalf(ab, mastered) }];
  });
  options.sort((x, y) => x.rank - y.rank || x.cost - y.cost || byId(x.a.abilityId, y.a.abilityId));
  return options[0]?.a;
}

/** An `equip` that beats what the slot holds now (scoreEquipment), best improvement first. */
export function pickEquip(env: Env): Action | undefined {
  const { s, content } = env;
  const classId = s.player.classId;
  let best: { a: Action; gain: number } | undefined;
  for (const a of allOf(env.legal, 'equip')) {
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

/** The corruption a Dark Spellbook adds when read (its `onUse` `corruption` effects). */
export function bookCorruption(content: ContentPack, itemId: string): number {
  const def = content.items[itemId];
  if (def === undefined || def.type !== 'tome') return 0;
  let c = 0;
  for (const e of def.onUse) if ('corruption' in e) c += e.corruption;
  return c;
}

// ---- recovery and trade ------------------------------------------------------------------------------------------------------

export interface RestCfg {
  /** Rest (or walk to a bed) below this fraction of max HP / MP. */
  hpBelow: number;
  mpBelow: number;
  /** Out of combat, drink a healing item before walking to a bed below this. */
  drinkBelow: number;
}

/** The best out-of-combat heal in the pack (`use`), if any. */
export function bestDrink(env: Env): Action | undefined {
  return allOf(env.legal, 'use')
    .map((a) => ({ a, hp: healAmount(env.content, itemOf(env.s, a.uid)?.itemId ?? '') }))
    .filter((x) => x.hp > 0)
    .sort((x, y) => y.hp - x.hp)[0]?.a;
}

/** Hurt or drained: a bed here, a draught, or the walk to the nearest bed. */
export function recover(env: Env, cfg: RestCfg, opts: PathOptions): Action | undefined {
  const { s, content, legal } = env;
  const hp = healthFraction(s);
  // U81b1: a Blood-price class (the Weaver) does not stop for mana: it pays the shortfall in HP when HP is comfortable
  const mpBelow = content.classes[s.player.classId]?.resource.bloodPrice !== undefined ? 0 : cfg.mpBelow;
  if (hp >= cfg.hpBelow && manaFraction(s) >= mpBelow) return undefined;
  const bed = legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? firstOf(legal, 'rest');
  if (bed !== undefined) return bed;
  if (hp < cfg.drinkBelow) {
    const drink = bestDrink(env);
    if (drink !== undefined) return drink;
  }
  return walkToBed(env, opts);
}

/** U81b1: the walk to the nearest bed no fight guards (`bedStep`). */
export const walkToBed = (env: Env, opts: PathOptions): Action | undefined => bedStep(env.s, env.legal, env.content, env.profile, opts);

export interface TradeCfg {
  sellBelowGold: number;
  buyFromGold: number;
  healingStock: number;
  upgradeMargin: number;
  /** Consumables bought as well, in this order, up to `max` carried (the caster's Mana Bloom and Chronal Dust). */
  stock?: readonly { itemId: string; max: number }[];
  /** Upgrade the weapon at the forge (melee: yes). */
  upgrade: boolean;
  /** U82 (D-149 #5): buy what it needs after the rows above — inns, patterns, forge work, shelf gear, mana (shopping.ts `shop`). */
  shop?: boolean;
}

/** Sell materials/spare gear when poor, stock healing (and `stock`) when flush, upgrade the weapon with a margin. */
export function pickTrade(env: Env, cfg: TradeCfg): Action | undefined {
  const { s, content, profile, legal } = env;
  const gold = s.player.gold;
  const classId = s.player.classId;
  if (gold < cfg.sellBelowGold) {
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
  if (gold >= cfg.buyFromGold) {
    const carried = (itemId: string): number => s.player.inventory.filter((i) => i.itemId === itemId).reduce((t, i) => t + i.qty, 0);
    const stockOf = (a: Extract<Action, { type: 'buy' }>): string => s.merchants[a.merchantId]?.stock.find((i) => i.uid === a.uid)?.itemId ?? '';
    for (const want of cfg.stock ?? []) {
      if (carried(want.itemId) >= want.max) continue;
      const buy = allOf(legal, 'buy').find((a) => stockOf(a) === want.itemId);
      if (buy !== undefined) return buy;
    }
    if (healingCarried(s, content) < cfg.healingStock) {
      const buy = allOf(legal, 'buy')
        .map((a) => ({ a, hp: healAmount(content, stockOf(a)) }))
        .filter((x) => x.hp > 0)
        .sort((x, y) => y.hp - x.hp)[0];
      if (buy !== undefined) return buy.a;
    }
  }
  const weapon = s.player.equipment.weapon;
  if (cfg.upgrade && weapon !== null) {
    const up = allOf(legal, 'upgrade').find((a) => a.uid === weapon.uid);
    const quote = up === undefined ? undefined : upgradeQuote(s, content, profile, weapon.uid);
    if (up !== undefined && quote !== undefined && typeof quote !== 'string' && gold >= quote.fee + cfg.upgradeMargin) return up;
  }
  return cfg.shop === true ? shop(s, legal, content, profile) : undefined;
}

// ---- quests --------------------------------------------------------------------------------------------------------------------

/** Every atom key found in a condition tree (through all/any/not). */
function atoms(c: Condition, into: Set<string>): void {
  const [key, value] = Object.entries(c)[0] as [string, unknown];
  into.add(key);
  if (key === 'all' || key === 'any') for (const child of value as Condition[]) atoms(child, into);
  else if (key === 'not') atoms(value as Condition, into);
}

/** PLAN §7.2 (pacifist): does any condition that moves the quest on (objectives, `advanceWhen`, branches) need a kill? */
export function questNeedsKill(content: ContentPack, questId: string): boolean {
  const quest = content.quests[questId];
  if (quest === undefined) return false;
  const seen = new Set<string>();
  for (const stage of quest.stages) {
    for (const o of stage.objectives) if (!o.optional) atoms(o.when, seen);
    if (stage.advanceWhen !== undefined) atoms(stage.advanceWhen, seen);
    if (Array.isArray(stage.next)) for (const b of stage.next) atoms(b.when, seen);
  }
  return seen.has('killed');
}

/** True if any of the effects begins a fight. */
export const startsFight = (effects: readonly Effect[]): boolean => effects.some((e) => 'startCombat' in e);

/** The quest ids a list of effects starts. */
export const questsStarted = (effects: readonly Effect[]): string[] => effects.flatMap((e) => ('questStart' in e ? [e.questStart] : []));

/**
 * D-048: how many completed quests `config.apexGate` asks for — the smallest `quests_completed` minimum found in it
 * (the gate is `any` of that count and an Echo in Loop 2+); undefined if the gate names no such counter.
 */
export function gateQuestCount(content: ContentPack): number | undefined {
  let best: number | undefined;
  const walk = (c: Condition): void => {
    const [key, value] = Object.entries(c)[0] as [string, unknown];
    if (key === 'counter') {
      const k = value as { name: string; min?: number };
      if (k.name === 'quests_completed' && k.min !== undefined) best = best === undefined ? k.min : Math.min(best, k.min);
    } else if (key === 'all' || key === 'any') for (const child of value as Condition[]) walk(child);
    else if (key === 'not') walk(value as Condition);
  };
  walk(content.config.apexGate);
  return best;
}

// ---- the Apex ------------------------------------------------------------------------------------------------------------------

/** Faces the Loop 1 Apex prompt as `ready` says (*Face it* when ready, else *Not yet*), noting the answer. */
export function apexPrompt(env: Env, ready: boolean): Action {
  const { s, legal, n } = env;
  const notYet = legal.find((a) => a.type === 'choose' && a.choiceId === APEX_NOT_YET);
  if (!ready && notYet !== undefined) {
    n.apexDeclined = `${s.meta.runId}:${s.player.level}`;
    return notYet;
  }
  n.apexFaced = s.meta.runId;
  return legal.find((a) => a.type === 'choose' && a.choiceId === APEX_FACE_IT) ?? fallback(legal);
}

/** Has the bot already been to (or turned back from) the Apex at this strength this loop? */
export const apexSettled = (env: Env): boolean =>
  env.n.apexFaced === env.s.meta.runId ||
  env.n.apexDeclined === `${env.s.meta.runId}:${env.s.player.level}` ||
  // U81b1: lost there at this level (a retry waits for a level up)
  (env.n.fellAt[APEX_LOCATION_ID] ?? 0) >= env.s.player.level;

// ---- people and things here ----------------------------------------------------------------------------------------------------

export type HeartstoneIntent = 'stabilize' | 'destroy' | 'exploit';
/** `melee` reads the day: destroy only by this day (WORLD §10.8, REVIEW-DESIGN-PLAN F20), otherwise stabilize. */
export const HEARTSTONE_DESTROY_BY_DAY = 10;

/** What a choice or location event does to the Heartstone (D-017), read from the flags it sets, else from its id; undefined if nothing. */
export function heartstoneIntent(id: string, effects: readonly Effect[]): HeartstoneIntent | undefined {
  for (const e of effects) {
    if (!('setFlag' in e)) continue;
    if (e.setFlag === 'flag_heartstone_stabilized') return 'stabilize';
    if (e.setFlag === 'flag_heartstone_destroyed') return 'destroy';
    if (e.setFlag === 'flag_heartstone_exploited') return 'exploit';
  }
  if (/destroy/.test(id)) return 'destroy';
  if (/exploit/.test(id)) return 'exploit';
  if (/stabili[sz]e/.test(id)) return 'stabilize';
  return undefined;
}

export type HeartstonePolicy = HeartstoneIntent | 'melee';

/** The Heartstone intent a policy wants today. */
export const wantedHeartstone = (policy: HeartstonePolicy, day: number): HeartstoneIntent =>
  policy === 'melee' ? (day <= HEARTSTONE_DESTROY_BY_DAY ? 'destroy' : 'stabilize') : policy;

export interface DialogueCfg {
  /** The Loop 1 Apex prompt: ready to face the Tyrant? */
  apexReady(env: Env): boolean;
  heartstone: HeartstonePolicy;
  /** Faction → weight of a point of reputation gained (a negative gain counts against). */
  factions?: Readonly<Record<string, number>>;
  /** The worth of starting quest `questId` through a choice (default +4: PLAN §7.2 "questStart"). */
  quest?(questId: string, env: Env): number;
  /** Extra worth of a choice, by its id and effects. */
  score?(choiceId: string, effects: readonly Effect[], env: Env): number;
  /** Prefer choices never taken before in the whole run (the explorer's coverage). */
  coverage?: boolean;
  /** Worth of a choice that starts a fight (the pacifist: very negative). Default 0. */
  fightScore?: number;
  /** Accept this quest when the scene offers it (`acceptQuest`); default every quest. */
  accept?(questId: string, env: Env): boolean;
  /** Among the quests worth accepting, the lowest rank first (default: the listed order). */
  acceptRank?(questId: string, env: Env): number;
}

/** The ids of the current dialogue node's choices that are listed, scored for `cfg`; the best first (ties: authored order). */
export function pickChoice(env: Env, cfg: DialogueCfg): Action {
  const { s, content, n } = env;
  const choices = allOf(env.legal, 'choose');
  const d = s.dialogue;
  const node = d === null ? undefined : content.dialogues[d.sceneId]?.nodes.find((x) => x.id === d.nodeId);
  const order = node?.choices.map((c) => c.id) ?? [];
  const day = dayOf(s.clock.ticks);
  const score = (choiceId: string): number => {
    const c = node?.choices.find((x) => x.id === choiceId);
    let v = 0;
    if (c !== undefined) {
      for (const q of questsStarted(c.effects)) v += cfg.quest === undefined ? 4 : cfg.quest(q, env);
      for (const e of c.effects) if ('rep' in e) v += (cfg.factions?.[e.rep.faction] ?? 0) * Math.sign(e.rep.delta);
      if (startsFight(c.effects)) v += cfg.fightScore ?? 0;
      v += cfg.score?.(choiceId, c.effects, env) ?? 0;
      const intent = heartstoneIntent(choiceId, c.effects);
      if (intent !== undefined) v += intent === wantedHeartstone(cfg.heartstone, day) ? 3 : -3;
    }
    if (d !== null && node !== undefined) {
      if (d.choicesTaken.includes(`${node.id}:${choiceId}`)) v -= 1;
      if (cfg.coverage === true && !n.choicesTaken.includes(`${d.sceneId}:${node.id}:${choiceId}`)) v += 6;
    }
    return v;
  };
  const rank = (id: string): number => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  const pick = [...choices].sort((a, b) => score(b.choiceId) - score(a.choiceId) || rank(a.choiceId) - rank(b.choiceId))[0] as Extract<Action, { type: 'choose' }>;
  if (d !== null && node !== undefined) n.choicesTaken.push(`${d.sceneId}:${node.id}:${pick.choiceId}`);
  return pick;
}

/** Dialogue mode: the Apex prompt, an offered quest worth taking, a choice, or on. */
export function talkThrough(env: Env, cfg: DialogueCfg): Action {
  const { s, legal } = env;
  if (isApexPromptOpen(s)) return apexPrompt(env, cfg.apexReady(env));
  const accept = allOf(legal, 'acceptQuest')
    .filter((a) => acceptable(env.content, a.questId) && (cfg.accept === undefined || cfg.accept(a.questId, env)))
    .sort((a, b) => (cfg.acceptRank?.(a.questId, env) ?? 0) - (cfg.acceptRank?.(b.questId, env) ?? 0))[0];
  if (accept !== undefined) return accept;
  if (allOf(legal, 'choose').length > 0) return pickChoice(env, cfg);
  return firstOf(legal, 'continue') ?? fallback(legal);
}

export interface SocialCfg {
  /** `npc`: each NPC once per quest state (melee); `scene`: each scene once per quest state, so a new scene is always played. */
  talk: 'npc' | 'scene' | 'none';
  /** Which Heartstone choice an `interact` event may make. */
  heartstone: HeartstonePolicy;
  /** Skip an NPC (the pacifist's fighters, the speedrunner's idlers). */
  skipNpc?(npcId: string, env: Env): boolean;
  /** Interact with events / gather at all. */
  interact: boolean;
  gather: boolean;
  /** Never interact with an event that starts a fight (the pacifist). */
  avoidFights?: boolean;
}

/** Talk, interact, gather: each once per quest state (see `SocialCfg`). */
export function social(env: Env, cfg: SocialCfg, sceneOf: (npcId: string) => string | undefined): Action | undefined {
  const { s, content, legal, n } = env;
  const here = s.world.currentLocationId;
  const sig = `${s.meta.runId}|${questSignature(s)}`;
  if (cfg.talk !== 'none') {
    const talk = allOf(legal, 'talk').find((a) => {
      if (cfg.skipNpc?.(a.npcId, env) === true) return false;
      if (cfg.talk === 'npc') return n.talked[a.npcId] !== sig;
      const scene = sceneOf(a.npcId);
      return scene !== undefined && !n.scenes.includes(`${sig}|${scene}`);
    });
    if (talk !== undefined) {
      if (cfg.talk === 'npc') n.talked[talk.npcId] = sig;
      else n.scenes.push(`${sig}|${sceneOf(talk.npcId) as string}`);
      return talk;
    }
  }
  if (cfg.interact) {
    const day = dayOf(s.clock.ticks);
    const events = content.locations[here]?.events ?? [];
    const touch = allOf(legal, 'interact').find((a) => {
      if (n.interacted.includes(`${sig}|${here}|${a.eventId}`)) return false;
      const ev = events.find((e) => e.id === a.eventId);
      if (cfg.avoidFights === true && startsFight(ev?.effects ?? [])) return false;
      const intent = ev === undefined ? heartstoneIntent(a.eventId, []) : heartstoneIntent(ev.id, ev.effects ?? []);
      return intent === undefined || intent === wantedHeartstone(cfg.heartstone, day);
    });
    if (touch !== undefined) {
      n.interacted.push(`${sig}|${here}|${touch.eventId}`);
      return touch;
    }
  }
  return cfg.gather ? firstOf(legal, 'gather') : undefined;
}

// ---- the Threshold ---------------------------------------------------------------------------------------------------------------

export interface ThresholdCfg {
  /** Attunements bought first (the bot's lean, in order), then the cheapest. */
  prefer: readonly string[];
  /** Modifiers switched on for the next loop (the pacifist's Vow); ids the pack lacks are skipped. */
  modifiers: readonly string[];
  /** Spend Resonance only while at least this much is held (melee: keep 10). */
  keepResonance: number;
  /** Attunements worn at once (DESIGN §10.7: five). */
  slots: number;
}

/** At the Threshold: toggle the wanted modifiers, buy, wear, then through to the Far Light and the next loop. */
export function thresholdStep(env: Env, cfg: ThresholdCfg): Action {
  const { s, legal, content, profile } = env;
  const cost = (id: string): number => content.attunements[id]?.cost ?? Number.POSITIVE_INFINITY;
  const lean = (id: string): number => {
    const i = cfg.prefer.indexOf(id);
    return i < 0 ? cfg.prefer.length : i;
  };
  const toggle = allOf(legal, 'toggleModifier').find((a) => cfg.modifiers.includes(a.modifierId) && profile.modifiers[a.modifierId] !== true);
  if (toggle !== undefined) return toggle;
  if (profile.resonance >= cfg.keepResonance) {
    const buy = allOf(legal, 'thresholdSpend').sort((a, b) => lean(a.attunementId) - lean(b.attunementId) || cost(a.attunementId) - cost(b.attunementId) || byId(a.attunementId, b.attunementId))[0];
    if (buy !== undefined) return buy;
  }
  if (profile.attunements.equipped.length < cfg.slots) {
    const wear = allOf(legal, 'equipAttunement').filter((a) => a.on)[0];
    if (wear !== undefined) return wear;
  }
  const visited = s.threshold?.visited ?? [];
  const affordable = Object.values(content.attunements).some((a) => !profile.attunements.owned.includes(a.id) && a.cost <= profile.resonance);
  const unworn = profile.attunements.owned.some((id) => !profile.attunements.equipped.includes(id));
  const unset = cfg.modifiers.some((id) => content.modifiers[id] !== undefined && profile.modifiers[id] !== true);
  const loom = legal.find((a) => a.type === 'thresholdGo' && a.to === 'loom');
  if (!visited.includes('loom') && loom !== undefined && ((affordable && profile.resonance >= cfg.keepResonance) || unworn || unset)) return loom;
  return firstOf(legal, 'newLoop') ?? legal.find((a) => a.type === 'thresholdGo' && a.to === 'far_light') ?? fallback(legal);
}

// ---- combat: the common rows ---------------------------------------------------------------------------------------------------------

/** Listed healing items aimed at the player, the biggest heal first. */
export function healItems(env: Env): { a: Extract<Action, { type: 'item' }>; hp: number }[] {
  const { s, content } = env;
  const me = s.combat === null ? undefined : playerOf(s.combat);
  return allOf(env.legal, 'item')
    .filter((a) => a.targetUid === undefined || a.targetUid === me?.uid)
    .map((a) => ({ a, hp: healAmount(content, itemOf(s, a.uid)?.itemId ?? '') }))
    .filter((x) => x.hp > 0)
    .sort((x, y) => y.hp - x.hp);
}

/** A listed self-heal ability (Field Dressing, Ley Mend …). */
export function mendAbility(env: Env): Extract<Action, { type: 'ability' }> | undefined {
  const me = env.s.combat === null ? undefined : playerOf(env.s.combat);
  return allOf(env.legal, 'ability').find((a) => env.content.abilities[a.abilityId]?.heal !== undefined && (a.targetUid === undefined || a.targetUid === me?.uid));
}

/** A companion of the party stands knocked out. */
export const companionDown = (s: GameState): boolean => s.combat?.party.some((c) => c.kind === 'companion' && !c.alive) ?? false;

/** The highest creature level among the standing foes (0 outside a fight). */
export function foeLevel(s: GameState): number {
  return Math.max(0, ...(s.combat?.enemies.filter((e) => e.alive && !e.fledOrGone).map((e) => e.level) ?? []));
}

/** Pass the time where it is safe: a bed here (full rest, else a rest, else a wait), the walk to the nearest bed, else any move. */
export function passTime(env: Env, opts: PathOptions): Action {
  const { s, content, profile, legal } = env;
  const bed = legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? firstOf(legal, 'rest') ?? firstOf(legal, 'wait');
  // U81b2: not ready for the Apex and nothing left in reach: roam for the wanderers' XP (melee.ts `idleRoam`)
  const roam = idleRoam(s, legal, content, profile, opts, env.n.apexFaced === s.meta.runId, env.n);
  if (roam !== undefined) return roam;
  if (bed !== undefined) return bed;
  return (
    stepAlong(legal, nearestWhere(s, content, profile, (id) => restAvailable(s, content, profile, id) && opts.avoid?.(id) !== true, opts)?.path ?? null) ??
    // U81b1: a step that is not into a place it avoids first
    allOf(legal, 'move').find((a) => opts.avoid?.(a.to) !== true) ??
    // every way is one it avoids: not back where it fell, nor into an unfleeable fight far above it (Vell's Umbra beside Where She
    // Fell); a band above it is the lesser risk (the Spires' only other way out is the Pass where the Moths felled it)
    allOf(legal, 'move').find((a) => !shunned(env, a.to) && !dangerAt(s, content, profile, a.to, 'pass')) ??
    allOf(legal, 'move').find((a) => !dangerAt(s, content, profile, a.to, 'pass')) ??
    firstOf(legal, 'move') ??
    fallback(legal)
  );
}

// ---- the communion (DESIGN §4.11, D-081) ---------------------------------------------------------------------------------------------

export interface CommuneCfg {
  /** Ending ids in order of preference at the Resolution (other endings next, outcomes without an ending last). */
  endings: readonly string[];
}

/** What the communion asks of the bot this turn. */
export type CommuneStep =
  /** Play this dialogue action. */
  | { kind: 'act'; action: Action }
  /** Communing, but nothing is left to say: only a blow forfeits the unanswerable question and moves the Movement on. */
  | { kind: 'stuck' }
  /** The Tyrant turned from the player in this fight: leave (`flee`) or fight on. */
  | { kind: 'rejected' }
  /** No communion here (not Loop 2+, no such creature, the window closed). */
  | { kind: 'none' };

const NONE: CommuneStep = { kind: 'none' };

/** The ending an outcome's effects bring about, if any. */
export const outcomeEnding = (effects: readonly Effect[]): string | undefined => {
  const e = effects.find((x) => 'ending' in x);
  return e !== undefined && 'ending' in e ? e.ending : undefined;
};

/**
 * Plays DESIGN §4.11 the way PLAN §7.2 reads it (caster; pacifist and speedrunner too): open at once with *Commune* (or
 * *Listen* when the Echo is missing) — the window is the first player turn —, then every held answer Echo (*Speak*, never a
 * lie or a loss), else *Listen*, else *Offer* an item that helps; with nothing left a blow forfeits the question
 * (`stuck`). At the Resolution it picks the outcome whose ending `cfg.endings` ranks first.
 */
export function communion(env: Env, cfg: CommuneCfg): CommuneStep {
  const { s, content, legal } = env;
  const combat = s.combat;
  if (combat === null) return NONE;
  const cb = communionBoss(content, combat);
  if (cb === null) return NONE;
  const dialogue = allOf(legal, 'commune');
  const act = (action: Action | undefined): CommuneStep => (action === undefined ? NONE : { kind: 'act', action });
  if (combat.communion === null) {
    const open = dialogue.find((a) => a.act === 'toggle') ?? dialogue.find((a) => a.act === 'listen');
    if (open !== undefined) return act(open);
    return communionRejected(combat) ? { kind: 'rejected' } : NONE;
  }
  if (s.world.tyrant === 'spared') {
    const rank = (a: Extract<Action, { type: 'commune' }>): number => {
      const ending = outcomeEnding(cb.spec.outcomes.find((o) => o.choiceId === a.answerId)?.effects ?? []);
      if (ending === undefined) return cfg.endings.length + 1;
      const i = cfg.endings.indexOf(ending);
      return i < 0 ? cfg.endings.length : i;
    };
    return act([...dialogue].sort((a, b) => rank(a) - rank(b))[0]);
  }
  const q = currentQuestion(cb.spec, combat.communion);
  const answers = dialogue
    .filter((a) => a.act === 'speak')
    .flatMap((a) => {
      const answer = q?.answers.find((x) => x.id === a.answerId);
      return answer === undefined || answer.lie === true || answer.resolve < 0 ? [] : [{ a, resolve: answer.resolve }];
    })
    .sort((x, y) => y.resolve - x.resolve);
  if (answers[0] !== undefined) return act(answers[0].a);
  const listen = dialogue.find((a) => a.act === 'listen');
  if (listen !== undefined) return act(listen);
  const offer = dialogue
    .filter((a) => a.act === 'offer')
    .flatMap((a) => {
      const row = cb.spec.offers.find((o) => o.itemId === a.itemId);
      return row === undefined || row.resolve <= 0 ? [] : [{ a, resolve: row.resolve }];
    })
    .sort((x, y) => y.resolve - x.resolve)[0];
  return offer !== undefined ? act(offer.a) : { kind: 'stuck' };
}

/** The listed basic attack on the communing creature (a blow that forfeits the question), else on any foe. */
export function forfeitBlow(env: Env): Action {
  const { s, content, legal } = env;
  const boss = s.combat === null ? null : communionBoss(content, s.combat);
  const hits = allOf(legal, 'attack');
  return hits.find((a) => a.targetUid === boss?.boss.uid) ?? hits[0] ?? firstOf(legal, 'guard') ?? fallback(legal);
}

// ---- combat: the fighter's rows (a flight test injected, then the class-aware fight) -------------------------------------------------

/**
 * U81b1: flee when `fleeIf` says so, or where the player fell at this level (`fellHere`), when the fight can be fled; else the class-aware fight (`classFight`: heal, Guard, the
 * class's setup abilities on their cooldowns, the strike worth the most among its attacks and ALL its damaging abilities, the
 * Blood price when HP is comfortable). Before U81b1 this was `meleeFight`, melee's physical-only rows, so a Wizard or a Weaver
 * played by the explorer or the speedrunner almost never cast (D-145).
 */
export function fightWithFlight(env: Env, memory: BotMemory, fleeIf: (env: Env) => boolean, cfg: ClassFightCfg = WEAPON_FIGHT): Action {
  const { s, legal, content } = env;
  const combat = s.combat;
  if (combat === null) return fallback(legal);
  const flee = firstOf(legal, 'flee');
  if (flee !== undefined && combat.canFlee && (fleeIf(env) || fellHere(env))) return flee;
  return classFight(s, legal, content, memory, cfg);
}

/** U81b1: the player fell in this place (U82: less than FALLEN_LEVELS levels ago; a reload stands next to it): this fight is left, not replayed. */
export const fellHere = (env: Env): boolean => env.s.combat !== null && fellRecently(env.n.fellAt, env.s.combat.locationId, env.s.player.level);

/** The physical fighter's fight cfg (melee's heal threshold). */
export const WEAPON_FIGHT: ClassFightCfg = { lean: 'weapon', healBelow: MELEE.healItemBelow };

/** U81b1: the head's stat and unlock rows for a bot that leans to `stat` and `branches`, fitted to the class (`classStat`, `classUnlockRank`). */
export function classHead(env: Env, stat: 'strength' | 'magic' | 'agility', branches: readonly string[]): HeadCfg {
  const classId = env.s.player.classId;
  return { stat: classStat(env.content, classId, stat), unlock: classUnlockRank(env.content, classId, branches) };
}

// ---- the Apex, the rest ------------------------------------------------------------------------------------------------------------

/** Ready for the Apex by `melee`'s rule: level ≥ the strongest fight it would start now − `margin` (no fight there: always ready). */
export function apexReadyBy(env: Env, margin: number): boolean {
  return env.s.player.level >= locationThreat(env.s, env.content, env.profile, APEX_LOCATION_ID) - margin;
}

/** `melee`'s unlock rank (PLAN §7.2): Steel/Breaker first, then any physical damage ability. */
export function meleeUnlockRank(ab: Ability): number | undefined {
  if (ab.branch !== undefined && MELEE_BRANCHES.includes(ab.branch)) return 0;
  return ab.power !== undefined && ab.damageType === 'physical' ? 1 : undefined;
}

/** `melee`'s trade rows (PLAN §7.2). */
export const MELEE_TRADE: TradeCfg = {
  sellBelowGold: MELEE.sellBelowGold,
  buyFromGold: MELEE.buyFromGold,
  healingStock: MELEE.healingStock,
  upgradeMargin: MELEE.upgradeMargin,
  upgrade: true,
  shop: true,
};

/** `melee`'s rest rows (PLAN §7.2). */
export const MELEE_REST: RestCfg = { hpBelow: MELEE.restHpBelow, mpBelow: MELEE.restMpBelow, drinkBelow: MELEE.drinkBelow };

/** `melee`'s Threshold rows (PLAN §7.2). */
export const MELEE_THRESHOLD: ThresholdCfg = { prefer: [], modifiers: [], keepResonance: MELEE.thresholdKeepResonance, slots: MELEE.attunementSlots };

// ---- explore: the head of every bot's turn ----------------------------------------------------------------------------------------------

export interface HeadCfg {
  stat: StatName;
  /** unlockAbility rank (see `pickUnlock`). */
  unlock(ab: Ability): number | undefined;
}

/**
 * The first rows of an explore turn, the same for every bot (melee's order): the portal when it opens; in a Horde, straight
 * to the portal; stat points; the cheapest ability it likes; better gear on; everything on the ground taken.
 */
export function head(env: Env, cfg: HeadCfg): Action | undefined {
  const { s, legal, content, profile } = env;
  const portal = firstOf(legal, 'enterPortal');
  if (portal !== undefined) return portal;
  if (hordeOn(s)) return stepAlong(legal, hordeRoute(s, content, profile, PORTAL_LOCATION_ID)) ?? firstOf(legal, 'wait') ?? fallback(legal);
  return pickStat(legal, cfg.stat) ?? pickUnlock(env, cfg.unlock) ?? pickEquip(env) ?? firstOf(legal, 'takeAll');
}

/** A listed `readBook` whose pages keep corruption at or under `max` and that the HP can pay for. */
export function pickBook(env: Env, max: number): Action | undefined {
  const { s, content } = env;
  if (healthFraction(s) < 0.5) return undefined;
  return allOf(env.legal, 'readBook').find((a) => {
    const item = itemOf(s, a.uid);
    return item !== undefined && s.player.corruption + bookCorruption(content, item.itemId) <= max;
  });
}

/** A listed `examine` of something not yet examined (`examines` bots only), noted. */
export function pickExamine(env: Env): Action | undefined {
  const { s, n } = env;
  const key = (t: Extract<Action, { type: 'examine' }>['target']): string => {
    switch (t.kind) {
      case 'item':
        return `item:${itemOf(s, t.uid)?.itemId ?? t.uid}`;
      case 'npc':
        return `npc:${t.id}`;
      case 'exit':
        return `exit:${s.world.currentLocationId}->${t.to}`;
      case 'location':
        return `location:${s.world.currentLocationId}`;
    }
  };
  for (const a of allOf(env.legal, 'examine')) {
    const k = key(a.target);
    if (n.examined.includes(k)) continue;
    n.examined.push(k);
    return a;
  }
  return undefined;
}

// ---- the way there -------------------------------------------------------------------------------------------------------------------------

/** The active quests' open hint places in journal order, each with its quest (deduplicated by place; the first quest keeps it). */
export function hintTargets(s: GameState, content: ContentPack): { locationId: string; questId: string }[] {
  const out: { locationId: string; questId: string }[] = [];
  for (const entry of questJournal(s, content)) {
    if (entry.status !== 'active') continue;
    for (const o of entry.objectives) {
      if (o.done || o.hintLocationId === undefined || content.locations[o.hintLocationId] === undefined) continue;
      if (!out.some((x) => x.locationId === o.hintLocationId)) out.push({ locationId: o.hintLocationId, questId: entry.questId });
    }
  }
  return out;
}

/** Is a fight at the Apex one the player can talk down (Loop 2+; DESIGN §4.11)? */
export function apexCommunion(env: Env): boolean {
  return pendingFights(env.s, env.content, env.profile, APEX_LOCATION_ID).some((f) => f.communion);
}

/**
 * A step toward the best-ranked quest hint not yet reached (`rank`: lower first; ties keep the journal's order), marking a
 * hint reached when the player stands on it. `safe` filters places; `opts` shapes the route.
 */
export function towardHint(env: Env, rank: (h: { locationId: string; questId: string }) => number, safe: (id: string) => boolean, opts: PathOptions): Action | undefined {
  const { s, content, profile, legal, n } = env;
  const here = s.world.currentLocationId;
  const qsig = questSignature(s);
  const hints = questTargets(s, content, profile); // U81b1: the givers of stages with no hint too (questFollow.ts)
  if (hints.some((h) => h.locationId === here)) n.hintsReached[here] = qsig;
  const ordered = hints.map((h, i) => ({ h, i })).sort((a, b) => rank(a.h) - rank(b.h) || a.i - b.i);
  for (const { h } of ordered) {
    if (h.locationId === here || n.hintsReached[h.locationId] === qsig || !safe(h.locationId)) continue;
    const go = stepAlong(legal, bfsPath(s, content, profile, here, h.locationId, opts));
    if (go !== undefined) return go;
  }
  return undefined;
}

// ---- the Apex gate and the endings (speedrunner) ----------------------------------------------------------------------------------------

/** Does `config.apexGate` (D-048) hold now? */
export const apexGateOpen = (env: Env): boolean => evaluate(env.content.config.apexGate, env.s, env.profile, env.content);

/** The quests that count for the gate and have started this loop (active or completed). */
export function questsHeld(s: GameState, content: ContentPack): number {
  return Object.entries(s.quests).filter(([id, q]) => (q.status === 'active' || q.status === 'completed') && content.quests[id]?.countsForApex !== false).length;
}

/**
 * Does the bot still need to start a quest for the gate (PLAN §7.2 speedrunner: exactly the quests `config.apexGate` asks
 * for)? True while the gate is shut, names a quest count, and fewer quests than that are held; a gate without a count
 * (or one that is open) needs none.
 */
export function needsQuest(env: Env): boolean {
  if (apexGateOpen(env)) return false;
  const need = gateQuestCount(env.content);
  return need === undefined ? true : questsHeld(env.s, env.content) < need;
}

/** Steps from here to the nearest first-stage hint of `questId` (locked exits count), 99 when it has none or none is reachable. */
export function questDistance(env: Env, questId: string): number {
  const { s, content, profile } = env;
  const quest = content.quests[questId];
  const stage = quest?.stages.find((x) => x.id === (quest.firstStage ?? quest.stages[0]?.id));
  let best = 99;
  for (const o of stage?.objectives ?? []) {
    if (o.hintLocationId === undefined) continue;
    const path = bfsPath(s, content, profile, s.world.currentLocationId, o.hintLocationId, { allowLocked: true });
    if (path !== null) best = Math.min(best, path.length);
  }
  return best;
}

/**
 * PLAN §7.2 (speedrunner, Loop 2+): the true endings, the one with the fewest unmet requirement parts first
 * (`explain()`; ties in letter order A–F). The communion's `resolve` part is counted unmet for every ending alike.
 */
export function rankEndings(env: Env): { endingId: string; unmet: number }[] {
  const { s, profile, content } = env;
  return Object.values(content.endings)
    .filter((e) => e.kind === 'true')
    .map((e) => ({ endingId: e.id as string, letter: e.letter ?? 'Z', unmet: explain(e.requirements, s, profile, content).parts.filter((p) => !p.ok).length }))
    .sort((a, b) => a.unmet - b.unmet || byId(a.letter, b.letter))
    .map(({ endingId, unmet }) => ({ endingId, unmet }));
}
