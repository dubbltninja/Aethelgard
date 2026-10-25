// loadScenario(id) — named jumps to game states for e2e flows, UI tests and the scenario sims (PLAN §4.13, §7, §8.3, §9.2
// U36; D-066 #18). DEV / E2E ONLY: `loadScenario` throws unless `__DEV__ || __E2E__`, so a production build (both literal
// `false`) keeps none of this — the body is unreachable and the builders below it are tree-shaken.
//
// Every scenario is a pure builder `(content, seed, opts) → { state, profile }` (same inputs, same output). A builder
// REACHES its target by playing legal actions through `step` — `legalActions` picks what is played, `isLegal` checks what
// is hand-written, a fight is played by `fightAction` (explicit targets, D-085), a walk by the content's exits — and falls
// back to direct construction only where a walk is impractical. Each such fallback is listed per scenario in
// `SCENARIOS[id].constructed` and is one of a small set of helpers below:
//   · level / stat points / kit      `setLevel`, `grantItem` (a Level 13 character cannot be played to; its points are then
//                                    SPENT through `allocateStat` / `unlockAbility`, so the build is a legal one)
//   · gates                           `ensure(condition)` edits state and the profile until a Condition holds (the Apex gate
//                                    of Loop 1, locked exits on a route, an ending's requirements, a communion answer's Echo)
//   · a companion                     `recruit` (the recruitment quests are not played)
//   · a boss fight the map never starts   `beginCombat` + `runCombat` (a boss that no location places)
//   · Resonance                       the Threshold scenario tops the profile up to `RESONANCE_FLOOR`
// Ids come from the pack, not from this file: the start location, the portal and the Apex are engine constants
// (explore.ts, horde.ts); everything else — the first fixed fight, the Tyrant's encounter and communion spec, the endings
// and their outcomes, the Bell-Warden, the Before's door and its rest point, healing consumables, the class's primary
// stat — is looked up. A pack that lacks what a scenario needs throws `ScenarioUnavailable` (a fixture pack without a
// Before has no `before_day_3`); a walk that fails throws `ScenarioError`; a lost fight is `ScenarioDefeat`, and
// `loadScenario` then retries with the next derived seed (a few times) before giving up.
import type { Condition, ConditionKey } from '@schema/condition';
import { ENDING_LETTERS } from '@schema/ending';
import type { CommunionSpec } from '@schema/creature';
import {
  APEX_LOCATION_ID,
  APEX_FACE_IT,
  BEFORE_REGION_ID,
  GameStateSchema,
  PORTAL_LOCATION_ID,
  TICKS_PER_DAY,
  TYRANT_IDS,
  atomOf,
  baseMaxima,
  beginCombat,
  dayOf,
  defaultRarity,
  evaluate,
  exitState,
  isActive,
  isApexPromptOpen,
  isLegal,
  legalActions,
  makeCtx,
  masteredFor,
  newRun,
  playerOf,
  runCombat,
  step,
  unlockCostHalf,
  watchOf,
  type Action,
  type CombatState,
  type Combatant,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';

// ---- public surface ------------------------------------------------------------------------------------------------------

/** PLAN §4.13's twelve, plus `first_fight` (the brief's "the first fight": a fresh Level 1 character at its first turn). */
export type ScenarioId =
  | 'loop1_day1'
  | 'first_fight'
  | 'pre_tyrant_l11_ranger'
  | 'pre_tyrant_l13_ranger'
  | 'combat_tyrant_contained_p2'
  | 'loop2_day1'
  | 'loop2_end'
  | 'communion_movement_2'
  | 'ending_a_ready'
  | 'ending_b_ready'
  | 'before_day_3'
  | 'combat_bell_warden_p2'
  | 'expiry_minus_1'
  | 'loop1_respite'
  | 'loop1_emberforge';

export interface ScenarioOptions {
  /** Default: `ranger` if the pack has it, else the first class by id. */
  classId?: string;
  /** Overrides the scenario's level (Level 11 / 13 for the pre-Tyrant pair; the boss's level for the fights). */
  level?: number;
  /** The run seed (default `scenario:<id>`). */
  seed?: string;
  /** A recruited companion who travels with the Wayfinder (PLAN §4.13 has none; DESIGN §19 #19 wants "with a companion"). */
  companionId?: string;
}

export interface ScenarioResult {
  /** Fresh, mutable and independent of the builder's internals (the caller may keep or edit them). */
  state: GameState;
  profile: Profile;
}

/** The pack cannot express this scenario (no Before, no Contained Tyrant, no placed boss …). */
export class ScenarioUnavailable extends Error {
  constructor(
    readonly scenario: string,
    message: string,
  ) {
    super(`scenario ${scenario}: unavailable: ${message}`);
    this.name = 'ScenarioUnavailable';
  }
}

/** A builder could not reach its target (a route is closed, a step was refused, a requirement cannot be satisfied). */
export class ScenarioError extends Error {
  constructor(
    readonly scenario: string,
    message: string,
  ) {
    super(`scenario ${scenario}: ${message}`);
    this.name = 'ScenarioError';
  }
}

/** The player fell during a played fight; `loadScenario` retries with another seed. */
export class ScenarioDefeat extends ScenarioError {
  constructor(scenario: string, message: string) {
    super(scenario, message);
    this.name = 'ScenarioDefeat';
  }
}

export interface ScenarioInfo {
  /** One line for pickers and docs. */
  summary: string;
  /** `played`: every step is a legal action; `mixed`: played, after the direct construction listed in `constructed`. */
  route: 'played' | 'mixed';
  /** What is constructed rather than played (empty when `route` is `played`). */
  constructed: string;
}

/** Resonance the Threshold scenario guarantees, so that spending it at the Loom is possible (a constructed top-up). */
export const RESONANCE_FLOOR = 100;
/** Default levels of the pre-Tyrant pair (DESIGN §19 #19). */
export const PRE_TYRANT_LEVELS = { pre_tyrant_l11_ranger: 11, pre_tyrant_l13_ranger: 13 } as const;
/** `loadScenario` retries a lost fight this many times with derived seeds. */
export const DEFEAT_RETRIES = 4;

// ---- the run: legal actions through `step` ---------------------------------------------------------------------------------

/** What `ensure` and the direct-construction helpers edit: the state and the profile, both mutable copies. */
interface World {
  s: GameState;
  p: Profile;
}

const MAX_STEPS = 6000;
const PREFERRED_CLASS = 'ranger';

type Fight = { stop: (s: GameState, combat: CombatState) => boolean };

class Run {
  s: GameState;
  profile: Profile;
  steps = 0;

  constructor(
    readonly id: ScenarioId,
    readonly content: ContentPack,
    s: GameState,
    profile: Profile,
  ) {
    this.s = s;
    this.profile = profile;
  }

  fail(message: string): ScenarioError {
    const where = `${this.s.mode} at ${this.s.world.currentLocationId}, Day ${dayOf(this.s.clock.ticks)}`;
    return new ScenarioError(this.id, `${message} (${where}, ${this.steps} steps)`);
  }

  unavailable(message: string): ScenarioUnavailable {
    return new ScenarioUnavailable(this.id, message);
  }

  legal(): Action[] {
    return legalActions(this.s, this.content, this.profile);
  }

  /** Plays one action that must be legal; returns its events. */
  act(action: Action): GameEvent[] {
    if (!isLegal(this.s, action, this.content, this.profile)) throw this.fail(`${JSON.stringify(action)} is not legal`);
    const out = step(this.s, action, this.content, this.profile);
    const rejected = out.events.find((e) => e.t === 'actionRejected');
    if (rejected?.t === 'actionRejected') throw this.fail(`${JSON.stringify(action)} was rejected: ${rejected.reason}`);
    this.s = out.state;
    this.profile = out.profile;
    if (++this.steps > MAX_STEPS) throw this.fail(`more than ${MAX_STEPS} steps`);
    return out.events;
  }

  /** Direct construction on mutable copies; the result must still be a valid GameState. */
  edit(fn: (w: World) => void): void {
    const w: World = { s: clone(this.s), p: clone(this.profile) };
    fn(w);
    const parsed = GameStateSchema.safeParse(w.s);
    if (!parsed.success) {
      throw this.fail(`a constructed state is invalid: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    this.s = w.s;
    this.profile = w.p;
  }

  /** Runs `fn` over a World and asserts that every Condition it was asked to satisfy now holds. */
  satisfy(label: string, conditions: readonly Condition[], skip: ReadonlySet<ConditionKey> = new Set()): void {
    const missing: string[] = [];
    this.edit((w) => {
      for (const c of conditions) ensure(c, w, this.content, skip);
      for (const c of conditions) if (!holds(c, w, this.content, skip)) missing.push(JSON.stringify(c));
    });
    if (missing.length > 0) throw this.fail(`cannot satisfy ${label}: ${missing.join(', ')}`);
  }

  // ---- settling: fights, dialogues -------------------------------------------------------------------------------------

  /**
   * Plays until the run is in explore mode (or at the Loop 1 Apex prompt): fights are fought by `fightAction`, dialogues
   * are clicked through. `fights: false` returns as soon as a fight begins.
   */
  settle(fights = true): void {
    for (let i = 0; i < 2000; i++) {
      const s = this.s;
      if (s.mode === 'combat') {
        if (!fights) return;
        this.act(this.fightAction());
      } else if (s.mode === 'dialogue') {
        if (isApexPromptOpen(s)) return;
        this.act(this.dialogueAction());
      } else return;
    }
    throw this.fail('a fight or dialogue never ended');
  }

  private dialogueAction(): Action {
    const legal = this.legal();
    const next = legal.find((a) => a.type === 'continue') ?? legal.find((a) => a.type === 'choose');
    if (next === undefined) throw this.fail('a dialogue offers neither continue nor a choice');
    return next;
  }

  /**
   * One player action of a fight (explicit targets): a healing consumable when low, else a basic attack on the weakest
   * enemy, else Guard. Anything else (a communion) is the caller's.
   */
  fightAction(): Action {
    const combat = this.s.combat;
    if (combat === null) throw this.fail('no fight');
    if (combat.phase === 'defeat') throw new ScenarioDefeat(this.id, 'the Wayfinder fell');
    const me = playerOf(combat);
    const legal = this.legal();
    if (me.hp < 0.4 * me.hpMax) {
      const heal = this.bestHeal(legal);
      if (heal !== null) return heal;
    }
    const foes = new Map(combat.enemies.filter(isActive).map((e) => [e.uid, e] as const));
    const hpOf = (a: Action): number => {
      const uid = a.type === 'attack' || a.type === 'ability' ? a.targetUid : undefined;
      return uid === undefined ? 0 : (foes.get(uid)?.hp ?? 0);
    };
    // the strongest damaging ability the pack's numbers promise (base + coef · ATK/SP, per hit), if it beats a basic attack
    const damage = (a: Action): number => {
      if (a.type === 'attack') return me.atk;
      if (a.type !== 'ability') return 0;
      const p = this.content.abilities[a.abilityId]?.power;
      return p === undefined ? 0 : (p.base + p.coef * (p.stat === 'atk' ? me.atk : me.sp)) * p.hits;
    };
    const strikes = legal
      .filter((a) => a.type === 'attack' || (a.type === 'ability' && (a.targetUid === undefined || foes.has(a.targetUid))))
      .sort((a, b) => damage(b) - damage(a) || hpOf(a) - hpOf(b));
    const strike = strikes[0];
    if (strike !== undefined && damage(strike) > 0) return strike;
    if (legal.some((a) => a.type === 'guard')) return { type: 'guard' };
    throw this.fail(`no way to fight on: ${JSON.stringify(legal.map((a) => a.type))}`);
  }

  /** The legal `item` action that heals the player most (a consumable whose onUse has `heal.hp`). */
  bestHeal(legal: readonly Action[]): Action | null {
    let best: { a: Action; hp: number } | null = null;
    for (const a of legal) {
      if (a.type !== 'item') continue;
      const inv = this.s.player.inventory.find((i) => i.uid === a.uid);
      const hp = inv === undefined ? 0 : healOf(this.content, inv.itemId);
      if (hp > 0 && (best === null || hp > best.hp)) best = { a, hp };
    }
    return best?.a ?? null;
  }

  /** Plays a fight (basic attacks) until `stop` holds on the player's turn; throws if it cannot. */
  fightUntil(fight: Fight): CombatState {
    for (let i = 0; i < 600; i++) {
      const combat = this.s.combat;
      if (combat === null) throw this.fail('the fight ended before the target state');
      if (combat.phase === 'playerTurn' && fight.stop(this.s, combat)) return combat;
      this.act(this.fightAction());
    }
    throw this.fail('the fight never reached the target state');
  }

  // ---- time ----------------------------------------------------------------------------------------------------------------

  /** Rests (full rests to the dawn, short ones for the last watches) at the current rest spot until `targetTick`. */
  restUntil(targetTick: number): void {
    for (let i = 0; i < 400 && this.s.clock.ticks < targetTick; i++) {
      this.settle();
      const ticks = this.s.clock.ticks;
      const full = ticks + (TICKS_PER_DAY - watchOf(ticks)) <= targetTick;
      this.act({ type: 'rest', kind: full ? 'full' : 'short' });
    }
    this.settle();
    if (this.s.clock.ticks < targetTick) throw this.fail(`could not rest until tick ${targetTick}`);
  }

  // ---- travel --------------------------------------------------------------------------------------------------------------

  /** The next location of a shortest route to `goal` (open exits first, then exits `ensure` could open), or null. */
  private route(goal: string): string[] | null {
    const { content } = this;
    const avoid = (id: string): boolean => {
      const region = content.locations[id]?.regionId;
      const target = content.locations[goal]?.regionId;
      return (region === BEFORE_REGION_ID || region === 'region_threshold') && region !== target;
    };
    for (const open of [true, false]) {
      const from = this.s.world.currentLocationId;
      const prev = new Map<string, string>();
      const queue = [from];
      const seen = new Set([from]);
      while (queue.length > 0) {
        const here = queue.shift() as string;
        if (here === goal) {
          const path: string[] = [];
          for (let at = goal; at !== from; at = prev.get(at) as string) path.unshift(at);
          return path;
        }
        for (const exit of content.locations[here]?.exits ?? []) {
          if (seen.has(exit.to) || content.locations[exit.to] === undefined || avoid(exit.to)) continue;
          if (open && exitState(this.s, content, this.profile, here, exit) !== 'open') continue;
          if (!open && exit.kind === 'road' && exitState(this.s, content, this.profile, here, exit) === 'hidden') continue;
          seen.add(exit.to);
          prev.set(exit.to, here);
          queue.push(exit.to);
        }
      }
    }
    return null;
  }

  /**
   * Walks to `goal` by `move`s, fighting what meets it; the last hop's fight is left to the caller with `fightAtGoal` false.
   * With `untilLoopEnds`, a walk that ends the loop on the way (the Horde fells the Wayfinder: a closer, DESIGN §10.2) stops
   * there in ending mode; otherwise that is an error.
   */
  walkTo(goal: string, fightAtGoal = true, untilLoopEnds = false): void {
    for (let i = 0; i < 200; i++) {
      if (this.s.world.currentLocationId === goal) return;
      if (untilLoopEnds && this.s.mode === 'ending') return;
      if (this.s.mode !== 'explore') throw this.fail(`cannot walk in ${this.s.mode} mode`);
      const path = this.route(goal);
      if (path === null) throw this.fail(`no route to ${goal}`);
      const to = path[0] as string;
      this.openExit(to);
      this.act({ type: 'move', to });
      const last = to === goal;
      this.settle(fightAtGoal || !last);
      if (this.s.mode !== 'explore' && last) return; // a prompt or a fight at the goal
    }
    throw this.fail(`never reached ${goal}`);
  }

  /** Opens the exit to `to` from here by satisfying its `when` / `gate` (a constructed gate), if it is not open. */
  private openExit(to: string): void {
    const here = this.s.world.currentLocationId;
    const exit = this.content.locations[here]?.exits.find((e) => e.to === to && exitState(this.s, this.content, this.profile, here, e) === 'open');
    if (exit !== undefined) return;
    const closed = this.content.locations[here]?.exits.find((e) => e.to === to);
    if (closed === undefined) throw this.fail(`${here} has no exit to ${to}`);
    const conditions = [closed.gate, closed.when].filter((c): c is Condition => c !== undefined);
    this.edit((w) => {
      for (const c of conditions) ensure(c, w, this.content, new Set());
      const ls = w.s.world.locationStates[here];
      if (ls !== undefined) ls.lockedExits = ls.lockedExits.filter((id) => id !== to);
    });
    if (exitState(this.s, this.content, this.profile, here, closed) !== 'open') {
      throw this.fail(`the exit ${here} → ${to} cannot be opened (${JSON.stringify(conditions)})`);
    }
  }

  /** Acknowledges ending screens until the next loop (or the Threshold) begins. */
  ackEndings(): void {
    for (let i = 0; i < 40 && this.s.mode === 'ending'; i++) this.act({ type: 'acknowledgeEnding' });
    if (this.s.mode === 'ending') throw this.fail('the ending screens never ended');
  }
}

// ---- reading the pack --------------------------------------------------------------------------------------------------------

/** The hp a consumable heals (0 if none). */
function healOf(content: ContentPack, itemId: string): number {
  const def = content.items[itemId];
  if (def === undefined || def.type !== 'consumable') return 0;
  let hp = 0;
  for (const e of def.onUse) if ('heal' in e && typeof e.heal.hp === 'number') hp = Math.max(hp, e.heal.hp);
  return hp;
}

function defaultClass(content: ContentPack, opts: ScenarioOptions, scenario: string): string {
  const id = opts.classId ?? (content.classes[PREFERRED_CLASS] !== undefined ? PREFERRED_CLASS : Object.keys(content.classes).sort()[0]);
  if (id === undefined || content.classes[id] === undefined) throw new ScenarioUnavailable(scenario, `the pack has no class '${String(opts.classId ?? PREFERRED_CLASS)}'`);
  return id;
}

/** The class's primary stat: its highest base stat (strength, then magic, then agility on a tie). */
function primaryStat(content: ContentPack, classId: string): 'strength' | 'magic' | 'agility' {
  const b = (content.classes[classId] as NonNullable<ContentPack['classes'][string]>).baseStats;
  if (b.strength >= b.magic && b.strength >= b.agility) return 'strength';
  return b.magic >= b.agility ? 'magic' : 'agility';
}

/** The Unveiled-style Tyrant: the creature with a communion spec, and the location whose encounter fields it. */
function communionBoss(content: ContentPack): { creatureId: string; spec: CommunionSpec; level: number; locationId: string } | undefined {
  for (const c of Object.values(content.creatures)) {
    if (c.communion === undefined) continue;
    const loc = Object.values(content.locations).find((l) => l.encounters.some((e) => e.groups.some((g) => g.creatureId === c.id)));
    if (loc !== undefined) return { creatureId: c.id, spec: c.communion, level: c.level, locationId: loc.id };
  }
  return undefined;
}

// ---- direct construction ------------------------------------------------------------------------------------------------------

/** newRun's own level formulas (DESIGN §3.3, §6.3): base maxima at `level`, full HP/MP, one stat point and AP per level. */
function setLevel(w: World, content: ContentPack, level: number): void {
  const p = w.s.player;
  const { hpMax, mpMax } = baseMaxima(content.classes[p.classId] as NonNullable<ContentPack['classes'][string]>, level);
  Object.assign(p, { level, xp: 0, hpMax, mpMax, hp: hpMax, mp: mpMax, apHalf: 2 * level, statPoints: level - 1 });
}

/** Puts `qty` of an item in the pack (a stack for stackables). Returns false for an unknown item. */
function grantItem(w: World, content: ContentPack, itemId: string, qty = 1): boolean {
  const def = content.items[itemId];
  if (def === undefined) return false;
  const make = (n: number) => ({ uid: `i${w.s.meta.nextUid++}`, itemId, qty: n, rarity: defaultRarity(def), affixes: [...def.fixedAffixes] });
  if (!def.stackable) {
    for (let i = 0; i < qty; i++) w.s.player.inventory.push(make(1));
    return true;
  }
  let left = qty;
  for (const stack of w.s.player.inventory) {
    if (left > 0 && stack.itemId === itemId && stack.rarity === defaultRarity(def) && stack.qty < def.maxStack) {
      const add = Math.min(left, def.maxStack - stack.qty);
      stack.qty += add;
      left -= add;
    }
  }
  while (left > 0) {
    const n = Math.min(left, def.maxStack);
    w.s.player.inventory.push(make(n));
    left -= n;
  }
  return true;
}

/** Recruits a companion as the active one (level-1 record; the recruitment quests are not played). */
function recruit(w: World, content: ContentPack, companionId: string): boolean {
  const def = content.companions[companionId];
  if (def === undefined) return false;
  w.s.companions.recruited[companionId] = {
    id: companionId,
    recruited: true,
    loyalty: 30,
    hp: def.stats.hp,
    hpMax: def.stats.hp,
    ko: false,
    dead: false,
    stance: 'guarded',
    cooldowns: {},
    waitingAt: null,
    arcFlags: {},
  };
  w.s.companions.activeId = companionId;
  return true;
}

/** Marks a quest with a status (completed/failed: at its last stage). */
function setQuest(w: World, content: ContentPack, id: string, status: 'active' | 'completed' | 'failed', stage?: string): boolean {
  const q = content.quests[id];
  if (q === undefined) return false;
  const last = q.stages[q.stages.length - 1];
  const day = dayOf(w.s.clock.ticks);
  w.s.quests[id] = {
    status,
    stage: stage ?? (status === 'active' ? (q.firstStage ?? q.stages[0]?.id ?? '') : (last?.id ?? '')),
    startedDay: day,
    endedDay: status === 'active' ? null : day,
    counters: {},
    objectivesDone: [],
  };
  if (status === 'completed') w.s.counters.questsCompleted += 1;
  return true;
}

const FACTION_IDS = ['remnants', 'weavers', 'ironclad'] as const;

/** Atoms whose truth `ensure` cannot arrange (they read where the player stands, the loop, the class, a communion …). */
const UNARRANGEABLE: ReadonlySet<ConditionKey> = new Set(['loop', 'class', 'location', 'beforeDay', 'beforeResets', 'resolve', 'modifier', 'not']);

/** True if `cond` holds in the world, treating `skip` atoms as held (they are arranged by play). */
function holds(cond: Condition, w: World, content: ContentPack, skip: ReadonlySet<ConditionKey>): boolean {
  const [key, value] = atomOf<ConditionKey>(cond, 'scenario');
  if (skip.has(key)) return true;
  if (key === 'all') return (value as Condition[]).every((c) => holds(c, w, content, skip));
  if (key === 'any') return (value as Condition[]).some((c) => holds(c, w, content, skip));
  return evaluate(cond, w.s, w.p, content);
}

/**
 * Edits the world until `cond` holds, if an edit can make it so (`holds` says whether it did). `all` satisfies every
 * member; `any` the first member that can be satisfied; `skip` atoms are left to play (a communion's `resolve`, the
 * Apex `location`). Atoms about where the player stands, the loop, the class and the like are never edited.
 */
function ensure(cond: Condition, w: World, content: ContentPack, skip: ReadonlySet<ConditionKey>): void {
  const [key, value] = atomOf<ConditionKey>(cond, 'scenario');
  if (skip.has(key) || holds(cond, w, content, skip)) return;
  const s = w.s;
  switch (key) {
    case 'all':
      for (const c of value as Condition[]) ensure(c, w, content, skip);
      return;
    case 'any':
      for (const c of value as Condition[]) {
        const trial: World = { s: clone(w.s), p: clone(w.p) };
        ensure(c, trial, content, skip);
        if (holds(c, trial, content, skip)) {
          w.s = trial.s;
          w.p = trial.p;
          return;
        }
      }
      return;
    case 'flag':
      s.flags[value as string] = true;
      return;
    case 'echo':
      if (!w.p.echoes.includes(value as string)) w.p.echoes.push(value as string);
      return;
    case 'quest': {
      const q = value as { id: string; stage?: string; status?: 'inactive' | 'active' | 'completed' | 'failed' };
      if (q.status === 'inactive') return;
      setQuest(w, content, q.id, q.status ?? 'active', q.stage);
      return;
    }
    case 'item': {
      const i = value as { id: string; count?: number };
      grantItem(w, content, i.id, (i.count ?? 1) - itemQty(s, i.id));
      return;
    }
    case 'rep': {
      const r = value as { faction: (typeof FACTION_IDS)[number]; min?: number; max?: number };
      if (r.min !== undefined && s.reputation[r.faction] < r.min) s.reputation[r.faction] = r.min;
      else if (r.max !== undefined && s.reputation[r.faction] > r.max) s.reputation[r.faction] = r.max;
      return;
    }
    case 'counter': {
      const c = value as { name: string; min?: number; max?: number };
      ensureCounter(w, content, c.name, c.min, c.max);
      return;
    }
    case 'level':
      if ((value as { min?: number }).min !== undefined && s.player.level < (value as { min: number }).min) setLevel(w, content, (value as { min: number }).min);
      return;
    case 'day': {
      const min = (value as { min?: number }).min;
      if (min !== undefined && dayOf(s.clock.ticks) < min) s.clock.ticks = (min - 1) * TICKS_PER_DAY;
      return;
    }
    case 'clock': {
      const max = (value as { daysLeft: { max?: number } }).daysLeft.max;
      if (max !== undefined) s.clock.ticks = Math.max(s.clock.ticks, s.clock.limitTicks - TICKS_PER_DAY * max);
      return;
    }
    case 'watch': {
      const watch = ['dawn', 'day', 'dusk', 'night'].indexOf(value as string);
      if (watch >= 0) s.clock.ticks = s.clock.ticks - watchOf(s.clock.ticks) + watch;
      return;
    }
    case 'corruption': {
      const r = value as { min?: number; max?: number };
      if (r.min !== undefined && s.player.corruption < r.min) s.player.corruption = r.min;
      else if (r.max !== undefined && s.player.corruption > r.max) s.player.corruption = r.max;
      return;
    }
    case 'stat': {
      const r = value as { name: 'strength' | 'magic' | 'agility'; min?: number };
      if (r.min !== undefined && s.player.stats[r.name] < r.min) s.player.stats[r.name] = r.min;
      return;
    }
    case 'companion': {
      const c = value as { id: string; state?: 'active' | 'recruited' | 'ko' };
      if (s.companions.recruited[c.id] === undefined) recruit(w, content, c.id);
      const run = s.companions.recruited[c.id];
      if (run === undefined) return;
      run.dead = false;
      if (c.state === 'ko') run.ko = true;
      else if ((c.state ?? 'active') === 'active') s.companions.activeId = c.id;
      return;
    }
    case 'loyalty': {
      const l = value as { companion: string; min?: number };
      if (s.companions.recruited[l.companion] === undefined) recruit(w, content, l.companion);
      const run = s.companions.recruited[l.companion];
      if (run !== undefined && l.min !== undefined && run.loyalty < l.min) run.loyalty = l.min;
      return;
    }
    case 'killed': {
      const k = value as { id: string; count?: number };
      s.counters.kills[k.id] = Math.max(s.counters.kills[k.id] ?? 0, k.count ?? 1);
      return;
    }
    default:
      if (UNARRANGEABLE.has(key)) return;
  }
}

function itemQty(s: GameState, itemId: string): number {
  let n = 0;
  for (const i of s.player.inventory) if (i.itemId === itemId) n += i.qty;
  for (const i of Object.values(s.player.equipment)) if (i?.itemId === itemId) n += i.qty;
  return n;
}

/** The engine counters (`quests_completed`, `factions_trusted`) are derived: arrange the facts they count. */
function ensureCounter(w: World, content: ContentPack, name: string, min?: number, max?: number): void {
  const s = w.s;
  if (name === 'quests_completed') {
    if (min === undefined) return;
    let have = Object.entries(s.quests).filter(([id, q]) => q.status === 'completed' && content.quests[id]?.countsForApex !== false).length;
    for (const q of Object.values(content.quests)) {
      if (have >= min) break;
      if (q.countsForApex === false || s.quests[q.id]?.status === 'completed') continue;
      if (setQuest(w, content, q.id, 'completed')) have += 1;
    }
  } else if (name === 'factions_trusted') {
    if (min === undefined) return;
    const trusted = content.config.repTiers.trusted;
    const ranked = [...FACTION_IDS].sort((a, b) => s.reputation[b] - s.reputation[a]);
    for (const f of ranked.slice(0, min)) s.reputation[f] = Math.max(s.reputation[f], trusted);
  } else if (min !== undefined) {
    s.counters.custom[name] = Math.max(s.counters.custom[name] ?? 0, min);
  } else if (max !== undefined) {
    s.counters.custom[name] = Math.min(s.counters.custom[name] ?? 0, max);
  }
}

/** Every `loop.min` in a condition tree (what loop an ending's requirements need). */
function loopMin(cond: Condition): number {
  const [key, value] = atomOf<ConditionKey>(cond, 'scenario');
  if (key === 'all' || key === 'any') return Math.max(1, ...(value as Condition[]).map(loopMin));
  if (key === 'loop') return (value as { min?: number }).min ?? 1;
  return 1;
}

// ---- starting points ------------------------------------------------------------------------------------------------------------

/**
 * A brand-new profile: nothing known, default settings, Loop 1 (src has no factory; mirrors the fixtures' `freshProfile`).
 * Its id is the scenario's seed, so the seeds of Loop 2 onward (`${profileId}:${loop}`, PLAN §4.11) follow `opts.seed` too.
 */
export function newProfile(profileId: string): Profile {
  return {
    version: 1,
    profileId,
    echoes: [],
    codexUnlocked: [],
    bestiary: {},
    achievements: {},
    resonance: 0,
    resonanceEarnedTotal: 0,
    attunements: { owned: [], equipped: [] },
    classMastery: {},
    runHistory: [],
    settings: {
      textScale: 1,
      highContrast: false,
      reducedMotion: 'system',
      volumes: { master: 0.8, ambient: 0.6, sfx: 0.8, music: 0.5 },
      muted: false,
      autosave: true,
      showIntentNumbers: true,
      confirmFlee: true,
      logLength: 100,
    },
    modifiers: {},
    mapKnowledge: [],
    discoveries: [],
    endingsReached: [],
    loopCounter: 1,
    newGamePlus: 0,
    lastClassId: null,
  };
}

/** A Run at the title screen of a brand-new profile. */
function atTitle(id: ScenarioId, content: ContentPack, seed: string, classId: string): Run {
  if (content.locations[content.config.startLocationId] === undefined) {
    throw new ScenarioUnavailable(id, `the pack has no start location '${content.config.startLocationId}' (no world authored yet)`);
  }
  const title: GameState = { ...newRun(seed, classId, content, newProfile(seed)), mode: 'title' };
  return new Run(id, content, title, newProfile(seed));
}

/** Title → `newGame`: Loop 1, Day 1, at the start location, nothing spent. */
function startLoop1(id: ScenarioId, content: ContentPack, seed: string, opts: ScenarioOptions): Run {
  const run = atTitle(id, content, seed, defaultClass(content, opts, id));
  run.act({ type: 'newGame', name: 'Wayfinder', classId: defaultClass(content, opts, id), seed });
  run.settle();
  return run;
}

// ---- the character ---------------------------------------------------------------------------------------------------------------

/** Healing consumables a pre-boss kit carries. */
const KIT_HEALS = 5;

/** WORLD "Tiers" (DESIGN §7.4, T5 from D-066 #22): the gear tier that belongs to a level band, T1 1–4 · T2 5–8 · T3 9–13 · T4 14–15 · T5 16–18. */
export function gearTierOf(level: number): number {
  return level <= 4 ? 1 : level <= 8 ? 2 : level <= 13 ? 3 : level <= 15 ? 4 : 5;
}

/**
 * The pack's best healing consumable for a character of `level`: the most HP among those that work in a fight and belong to its
 * band or below (a higher tier is not on the shelves yet; the Hardtack is for the road), then id. A pack none of whose potions
 * fits (a fixture's) falls back to its best.
 */
function bestPotion(content: ContentPack, level?: number): string | undefined {
  const all = Object.values(content.items)
    .filter((d) => d.usableInCombat)
    .map((d) => ({ id: d.id, hp: healOf(content, d.id), tier: d.tier }))
    .filter((x) => x.hp > 0);
  const inBand = level === undefined ? all : all.filter((x) => x.tier <= gearTierOf(level));
  return (inBand.length > 0 ? inBand : all).sort((a, b) => b.hp - a.hp || (a.id < b.id ? -1 : 1))[0]?.id;
}

type GearDef = ContentPack['items'][string];

/** What a character can wear at Common: rolled gear starts at Common, crafted and boss pieces are fixed Common; sellable means not a bound reward. */
function commonGear(d: GearDef, classId: string, level: number): boolean {
  if (d.type !== 'weapon' && d.type !== 'armor' && d.type !== 'trinket') return false;
  if (!d.sellable || d.requirements?.when !== undefined) return false;
  if (d.requirements?.classIds !== undefined && !(d.requirements.classIds as readonly string[]).includes(classId)) return false;
  if (d.requirements?.level !== undefined && d.requirements.level > level) return false;
  return d.rarityRule === 'rolled' || d.fixedRarity === 'common';
}

/**
 * The best band-appropriate Common gear the pack has for a class at `level` (D-092): the highest tier at or below the level's band
 * (WORLD's tier table), then the most of what the piece adds. The weapon is of the class's own type (the type of its starter
 * weapon), the armor is weighted to Armor for a martial class and to Ward for a caster, the two trinkets differ and lean to the
 * primary stat. A pack with no such piece (a fixture's) has none of that slot.
 */
export function bestGear(content: ContentPack, classId: string, level: number): { weapon?: string; armor?: string; trinkets: string[] } {
  const tier = gearTierOf(level);
  const primary = primaryStat(content, classId);
  const caster = primary === 'magic';
  const starter = (content.classes[classId]?.starterItems ?? []).map((k) => content.items[k.itemId]).find((d) => d?.type === 'weapon');
  const total = (d: GearDef): number =>
    d.stats.power + d.stats.spellPower + d.stats.armor + d.stats.ward + d.stats.strength + d.stats.magic + d.stats.agility + d.stats[primary] + (d.stats.hpMax + d.stats.mpMax) / 10;
  const armorScore = (d: GearDef): number => (caster ? 2 * d.stats.ward + d.stats.armor : 2 * d.stats.armor + d.stats.ward);
  const best = (list: GearDef[], score: (d: GearDef) => number): GearDef[] =>
    list.filter((d) => commonGear(d, classId, level) && d.tier >= 1 && d.tier <= tier).sort((a, b) => b.tier - a.tier || score(b) - score(a) || (a.id < b.id ? -1 : 1));
  const items = Object.values(content.items);
  const weapon = starter?.weaponType === undefined ? undefined : best(items.filter((d) => d.type === 'weapon' && d.weaponType === starter.weaponType), total)[0];
  const armor = best(items.filter((d) => d.type === 'armor'), armorScore)[0];
  const trinkets = best(items.filter((d) => d.type === 'trinket'), total).slice(0, 2);
  return { ...(weapon ? { weapon: weapon.id } : {}), ...(armor ? { armor: armor.id } : {}), trinkets: trinkets.map((d) => d.id) };
}

/** Grants the band's best Common gear (constructed) and puts it on with legal `equip` actions; a piece already worn stays. */
function equipBestGear(run: Run, level: number): void {
  const { content } = run;
  const pick = bestGear(content, run.s.player.classId, level);
  const wanted = [pick.weapon, pick.armor, ...pick.trinkets].filter((id): id is string => id !== undefined);
  const worn = (s: GameState, id: string): boolean => Object.values(s.player.equipment).some((i) => i?.itemId === id);
  run.edit((w) => {
    for (const id of wanted) if (!worn(w.s, id)) grantItem(w, content, id);
  });
  for (const id of wanted) {
    if (worn(run.s, id)) continue;
    const inst = run.s.player.inventory.find((i) => i.itemId === id);
    if (inst === undefined) continue;
    const action: Action = { type: 'equip', uid: inst.uid };
    if (isLegal(run.s, action, content, run.profile)) run.act(action);
  }
}

/** Before the boss: HP/MP and the companions full again, the potion stack back to `KIT_HEALS` (constructed: the walk's fights spent them). */
function restock(run: Run): void {
  const { content } = run;
  run.edit((w) => {
    const p = w.s.player;
    p.hp = p.hpMax;
    p.mp = p.mpMax;
    for (const c of Object.values(w.s.companions.recruited)) Object.assign(c, { hp: c.hpMax, ko: false });
    const potion = bestPotion(content, p.level);
    if (potion === undefined) return;
    const have = p.inventory.filter((i) => i.itemId === potion).reduce((n, i) => n + i.qty, 0);
    if (have < KIT_HEALS) grantItem(w, content, potion, KIT_HEALS - have);
  });
}

/**
 * A pre-boss character: `level` (constructed), its points then SPENT by legal actions — the primary stat for stat points,
 * the cheapest unlockable ability first for ability points — plus a stack of the best healing consumable the band has
 * (constructed), with `withGear` the band's best Common gear (granted — constructed — then worn by legal `equip` actions:
 * D-092; the Tyrant scenarios) and, with `companionId`, a recruited companion (constructed). The rest of the starter kit stays.
 */
function buildCharacter(run: Run, level: number, opts: ScenarioOptions, withGear = false): void {
  const { content } = run;
  run.edit((w) => {
    setLevel(w, content, level);
    const best = bestPotion(content, level);
    if (best !== undefined) grantItem(w, content, best, KIT_HEALS);
    if (opts.companionId !== undefined && !recruit(w, content, opts.companionId)) {
      throw new ScenarioUnavailable(run.id, `the pack has no companion '${opts.companionId}'`);
    }
  });
  spendPoints(run);
  if (withGear) equipBestGear(run, level);
}

/** Spends stat points on the primary stat and ability points on the cheapest unlockable abilities, all through `step`. */
function spendPoints(run: Run): void {
  const { content } = run;
  const stat = primaryStat(content, run.s.player.classId);
  while (run.s.player.statPoints > 0) run.act({ type: 'allocateStat', stat });
  for (let i = 0; i < 200; i++) {
    const mastered = masteredFor(run.profile, run.s.player.classId);
    const cost = (id: string): number => unlockCostHalf(content.abilities[id] as NonNullable<ContentPack['abilities'][string]>, mastered);
    const options = run
      .legal()
      .filter((a): a is Extract<Action, { type: 'unlockAbility' }> => a.type === 'unlockAbility')
      .sort((a, b) => cost(a.abilityId) - cost(b.abilityId) || (a.abilityId < b.abilityId ? -1 : 1));
    const next = options[0];
    if (next === undefined) return;
    run.act(next);
  }
}

/** `level`, a companion and nothing else, for the scenarios whose character is whatever play made of it. */
function applyOptions(run: Run, opts: ScenarioOptions): void {
  if (opts.level === undefined && opts.companionId === undefined) return;
  run.edit((w) => {
    if (opts.level !== undefined) setLevel(w, run.content, opts.level);
    if (opts.companionId !== undefined && !recruit(w, run.content, opts.companionId)) {
      throw new ScenarioUnavailable(run.id, `the pack has no companion '${opts.companionId}'`);
    }
  });
}

// ---- loops: the Horde and the portal, the camp's Let go, the Far Light --------------------------------------------------------

/**
 * Loop 1 → Loop 2 Day 1 by the quickest legal closer: full rests at the start's camp until the thirtieth dawn, the expiry
 * Horde (three moves before it spreads), the walk to the Library's portal, `enterPortal`, the closer's screens (D-049: no
 * Threshold after Loop 1). Everything is played. A Level 1 Wayfinder the Horde fells on the way (the real pack's Corridor)
 * closes the loop by The Fall (reason `expiry`) instead, which is a Loop 1 closer too (horde.ts; U34e, D-101).
 */
function playLoop1Out(run: Run): void {
  run.restUntil(run.s.clock.limitTicks);
  if (!run.s.world.hordeActive) throw run.fail('the clock expired without a Horde');
  run.walkTo(PORTAL_LOCATION_ID, true, true);
  if (run.s.mode === 'explore') run.act({ type: 'enterPortal' });
  run.ackEndings();
  if (run.s.mode !== 'explore' || run.s.meta.loop !== 2) throw run.fail('the closer did not lead to Loop 2 Day 1');
}

/** Loop 2+ → the Threshold: *Let go* at a camp (D-067.14), the closer's screens. */
function playLoopToThreshold(run: Run): void {
  run.act({ type: 'letGo' });
  run.ackEndings();
  if (run.s.mode !== 'threshold') throw run.fail('the loop did not end at the Threshold');
}

/** Threshold → the next loop's Day 1 (the Far Light, then `newLoop`). */
function playThresholdToLoop(run: Run): void {
  run.act({ type: 'thresholdGo', to: 'far_light' });
  run.act({ type: 'newLoop' });
  run.settle();
}

/** Plays loops out until the run is in `loop` (Loop 1 by the portal, later ones by *Let go*). */
function reachLoop(run: Run, loop: number): void {
  if (run.s.meta.loop < 2 && loop >= 2) playLoop1Out(run);
  while (run.s.meta.loop < loop) {
    playLoopToThreshold(run);
    playThresholdToLoop(run);
  }
}

// ---- communion ---------------------------------------------------------------------------------------------------------------------

type CommuneAction = Extract<Action, { type: 'commune' }>;

/** Atoms that play settles: the communion's Resolve, and standing at the Apex. */
const BY_PLAY: ReadonlySet<ConditionKey> = new Set(['resolve', 'location']);

/** The best answer of each question of the first `movements` Movements: highest `resolve`, no lies, first on a tie. */
function bestAnswers(spec: CommunionSpec, movements: number): { id: string; when: Condition; resolve: number }[] {
  const out: { id: string; when: Condition; resolve: number }[] = [];
  for (const m of spec.movements.slice(0, movements)) {
    for (const q of m.questions) {
      const honest = q.answers.filter((a) => a.lie !== true && a.resolve > 0);
      const best = honest.reduce<(typeof honest)[number] | undefined>((x, a) => (x === undefined || a.resolve > x.resolve ? a : x), undefined);
      if (best !== undefined) out.push({ id: best.id, when: best.when, resolve: best.resolve });
    }
  }
  return out;
}

/** Resolve gained by a Commune action (answer, offer, Listen), by the creature's spec; 0 for anything else. */
function gainOf(spec: CommunionSpec, a: CommuneAction): number {
  if (a.act === 'listen') return 1;
  if (a.act === 'offer') return spec.offers.find((o) => o.itemId === a.itemId)?.resolve ?? 0;
  if (a.act === 'speak') {
    for (const m of spec.movements) for (const q of m.questions) for (const ans of q.answers) if (ans.id === a.answerId) return ans.lie === true ? -99 : ans.resolve;
  }
  return 0;
}

/**
 * One turn of a communion: open it (Commune if the Echo is held, else Listen), then each turn Listen (once per Movement),
 * an Offer that raises Resolve, the best honest answer, a silent answer (Resolve 0, e.g. "Choose."), and last an attack
 * that forfeits an unanswerable question. A lie or a Resist is never played.
 */
function communeAction(run: Run, spec: CommunionSpec, bossUid: string): Action {
  const legal = run.legal();
  const commune = legal.filter((a): a is CommuneAction => a.type === 'commune');
  const me = playerOf(run.s.combat as CombatState);
  if (me.hp < 0.4 * me.hpMax) {
    const heal = run.bestHeal(legal);
    if (heal !== null) return heal;
  }
  const toggle = commune.find((a) => a.act === 'toggle');
  if (toggle !== undefined) return toggle;
  const listen = commune.find((a) => a.act === 'listen');
  if (listen !== undefined) return listen;
  const best = (acts: CommuneAction[]): CommuneAction | undefined => acts.sort((a, b) => gainOf(spec, b) - gainOf(spec, a))[0];
  const offer = best(commune.filter((a) => a.act === 'offer' && gainOf(spec, a) > 0));
  if (offer !== undefined) return offer;
  const speak = best(commune.filter((a) => a.act === 'speak' && gainOf(spec, a) >= 0));
  if (speak !== undefined) return speak;
  if (legal.some((a) => a.type === 'attack' && a.targetUid === bossUid)) return { type: 'attack', targetUid: bossUid };
  throw run.fail(`the communion offers nothing to play: ${JSON.stringify(legal)}`);
}

/**
 * Plays the Tyrant's communion until `done` holds on the player's turn. Prepares the Echoes (and whatever else the best
 * answers and the optional `extra` conditions need) first, walks to the Tyrant's node and plays `communeAction`s.
 */
function playCommunion(
  run: Run,
  boss: NonNullable<ReturnType<typeof communionBoss>>,
  prep: { movements: number; extra: readonly Condition[]; level?: number | undefined; opts: ScenarioOptions },
  done: (combat: CombatState) => boolean,
): CombatState {
  const { spec } = boss;
  buildCharacter(run, prep.level ?? boss.level, prep.opts);
  run.satisfy('the communion (opening Echo, best answers, requirements)', [
    { any: spec.opensWith as Condition[] },
    ...bestAnswers(spec, prep.movements).map((a) => a.when),
    ...prep.extra,
  ], BY_PLAY);
  run.walkTo(boss.locationId, false);
  if (run.s.mode !== 'combat') throw run.fail(`the Tyrant's fight did not start at ${boss.locationId}`);
  const bossOf = (c: CombatState): Combatant => c.enemies.find((e) => e.refId === boss.creatureId) as Combatant;
  for (let i = 0; i < 200; i++) {
    const combat = run.s.combat;
    if (combat === null) throw run.fail('the fight ended before the communion reached its target');
    if (combat.phase === 'defeat') throw new ScenarioDefeat(run.id, 'the Wayfinder fell');
    // U58: the Resolution's words open over the fight (the Unveiled Tyrant's `onSpared`); clicked through, the outcomes follow
    if ((run.s.mode as string) === 'dialogue') {
      run.settle(false);
      continue;
    }
    if (combat.communion !== null && done(combat)) return combat;
    run.act(communeAction(run, spec, bossOf(combat).uid));
  }
  throw run.fail('the communion never reached its target');
}

/** The endings' outcome in the Tyrant's communion: the choice whose effects end the game with `endingId`. */
function outcomeFor(spec: CommunionSpec, endingId: string): CommunionSpec['outcomes'][number] | undefined {
  return spec.outcomes.find((o) => o.effects.some((e) => 'ending' in e && e.ending === endingId));
}

// ---- builders ----------------------------------------------------------------------------------------------------------------------

type Builder = (content: ContentPack, seed: string, opts: ScenarioOptions) => Run;

const loop1Day1: Builder = (content, seed, opts) => {
  const run = startLoop1('loop1_day1', content, seed, opts);
  applyOptions(run, opts);
  return run;
};

/** The nearest location (by open exits) with a fixed, certain, non-boss fight that is on from the start. */
function nearestFight(run: Run): string | undefined {
  const { content } = run;
  const start = run.s.world.currentLocationId;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const here = queue.shift() as string;
    const loc = content.locations[here];
    const fight = loc?.encounters.some(
      (e) =>
        here !== start &&
        e.chance >= 1 &&
        e.once &&
        (e.when === undefined || evaluate(e.when, run.s, run.profile, content)) &&
        e.groups.every((g) => content.creatures[g.creatureId]?.role !== 'boss'),
    );
    if (fight) return here;
    for (const exit of loc?.exits ?? []) {
      if (seen.has(exit.to) || exitState(run.s, content, run.profile, here, exit) !== 'open') continue;
      seen.add(exit.to);
      queue.push(exit.to);
    }
  }
  return undefined;
}

const firstFight: Builder = (content, seed, opts) => {
  const run = startLoop1('first_fight', content, seed, opts);
  applyOptions(run, opts);
  const target = nearestFight(run);
  if (target === undefined) throw run.unavailable('no fixed fight within reach of the start');
  run.walkTo(target, false);
  if (run.s.mode !== 'combat') throw run.fail(`no fight started at ${target}`);
  return run;
};

/** The Apex prompt of Loop 1 (D-067.1) with a built character: needs the Contained Tyrant's Loop 1 encounter. */
function toApexPrompt(id: ScenarioId, content: ContentPack, seed: string, opts: ScenarioOptions, defaultLevel: number): Run {
  const apex = content.locations[APEX_LOCATION_ID];
  const contained = apex?.encounters.some((e) => e.groups.some((g) => g.creatureId === 'cr_chronos_tyrant_contained'));
  if (apex === undefined || !contained) throw new ScenarioUnavailable(id, "the pack has no Loop 1 encounter with the Contained Tyrant at the Apex");
  const run = startLoop1(id, content, seed, opts);
  buildCharacter(run, opts.level ?? defaultLevel, opts, true);
  run.walkTo(APEX_LOCATION_ID, false);
  if (!isApexPromptOpen(run.s)) throw run.fail('the Apex prompt did not open');
  restock(run);
  return run;
}

const preTyrant = (id: keyof typeof PRE_TYRANT_LEVELS): Builder => (content, seed, opts) => toApexPrompt(id, content, seed, opts, PRE_TYRANT_LEVELS[id]);

const combatTyrantContainedP2: Builder = (content, seed, opts) => {
  const run = toApexPrompt('combat_tyrant_contained_p2', content, seed, opts, PRE_TYRANT_LEVELS.pre_tyrant_l13_ranger);
  run.act({ type: 'choose', choiceId: APEX_FACE_IT });
  if (run.s.mode !== 'combat') throw run.fail('Face it did not start the fight');
  run.fightUntil({ stop: (_s, c) => (c.enemies.find((e) => TYRANT_IDS.includes(e.refId))?.phase ?? 0) >= 1 });
  return run;
};

const loop2Day1: Builder = (content, seed, opts) => {
  const run = startLoop1('loop2_day1', content, seed, opts);
  playLoop1Out(run);
  applyOptions(run, opts);
  return run;
};

const loop2End: Builder = (content, seed, opts) => {
  const run = startLoop1('loop2_end', content, seed, opts);
  playLoop1Out(run);
  applyOptions(run, opts);
  playLoopToThreshold(run);
  if (Object.keys(content.attunements).length > 0) {
    run.edit((w) => {
      w.p.resonance = Math.max(w.p.resonance, RESONANCE_FLOOR);
      w.p.resonanceEarnedTotal = Math.max(w.p.resonanceEarnedTotal, w.p.resonance);
    });
  }
  return run;
};

const expiryMinus1: Builder = (content, seed, opts) => {
  const run = startLoop1('expiry_minus_1', content, seed, opts);
  applyOptions(run, opts);
  run.restUntil(run.s.clock.limitTicks - 1);
  if (run.s.clock.expired || run.s.clock.ticks !== run.s.clock.limitTicks - 1) throw run.fail('not one watch before the thirtieth dawn');
  return run;
};

/** The Tyrant's communion in Movement II (question one pending), reached through Movement I. */
const communionMovement2: Builder = (content, seed, opts) => {
  const boss = communionBoss(content);
  if (boss === undefined) throw new ScenarioUnavailable('communion_movement_2', 'the pack has no creature with a communion');
  const run = startLoop1('communion_movement_2', content, seed, opts);
  reachLoop(run, 2);
  playCommunion(run, boss, { movements: 1, extra: [], level: opts.level, opts }, (c) => (c.communion?.movement ?? 0) >= 2);
  return run;
};

/** The Resolution of the Tyrant's communion with ending `letter`'s outcome on offer: the next Speak ends the game. */
const endingReady =
  (id: ScenarioId, letter: keyof typeof ENDING_LETTERS): Builder =>
  (content, seed, opts) => {
    const endingId = ENDING_LETTERS[letter];
    const ending = content.endings[endingId];
    const boss = communionBoss(content);
    if (ending === undefined || boss === undefined) throw new ScenarioUnavailable(id, `the pack has no ${endingId} or no communion`);
    const outcome = outcomeFor(boss.spec, endingId);
    if (outcome === undefined) throw new ScenarioUnavailable(id, `no communion outcome ends with ${endingId}`);
    const needs: Condition[] = [ending.requirements, ...(outcome.when === undefined ? [] : [outcome.when])];
    const run = startLoop1(id, content, seed, opts);
    reachLoop(run, Math.max(2, ...needs.map(loopMin)));
    playCommunion(run, boss, { movements: 3, extra: needs, level: opts.level, opts }, (c) =>
      run.legal().some((a) => a.type === 'commune' && a.act === 'speak' && a.answerId === outcome.choiceId && c.communion !== null),
    );
    return run;
  };

/** First Before location reached from outside, and the Before's rest point. */
function beforeDoor(content: ContentPack): { entry: string; rest: string } | undefined {
  const inBefore = (id: string): boolean => content.locations[id]?.regionId === BEFORE_REGION_ID;
  const entry = Object.values(content.locations)
    .filter((l) => !inBefore(l.id))
    .flatMap((l) => l.exits.map((e) => e.to))
    .find(inBefore);
  const rest = Object.values(content.locations).find((l) => inBefore(l.id) && l.rest !== undefined);
  return entry !== undefined && rest !== undefined ? { entry, rest: rest.id } : undefined;
}

const beforeDay3: Builder = (content, seed, opts) => {
  const door = beforeDoor(content);
  if (door === undefined) throw new ScenarioUnavailable('before_day_3', 'the pack has no Silverwood Before (a region of its own with a rest point)');
  const run = startLoop1('before_day_3', content, seed, opts);
  reachLoop(run, 2);
  const band = content.regions[BEFORE_REGION_ID]?.levelBand.max ?? 1;
  buildCharacter(run, opts.level ?? Math.max(run.s.player.level, band), opts);
  run.walkTo(door.entry);
  run.walkTo(door.rest);
  for (let i = 0; i < 4 && (run.s.before?.day ?? 0) < 3; i++) run.act({ type: 'rest', kind: 'full' });
  run.settle();
  if (run.s.before?.day !== 3) throw run.fail('the Before did not reach Last Bell');
  return run;
};

/** The Bell-Warden: `cr_bell_warden`, else a boss with "bell" in its id (the fixtures' `cr_fixture_bell`). */
function bellWarden(content: ContentPack): string | undefined {
  if (content.creatures.cr_bell_warden !== undefined) return 'cr_bell_warden';
  return Object.values(content.creatures).find((c) => c.role === 'boss' && c.id.includes('bell'))?.id;
}

const combatBellWardenP2: Builder = (content, seed, opts) => {
  const id = bellWarden(content);
  if (id === undefined) throw new ScenarioUnavailable('combat_bell_warden_p2', 'the pack has no Bell-Warden');
  const boss = content.creatures[id] as NonNullable<ContentPack['creatures'][string]>;
  const run = startLoop1('combat_bell_warden_p2', content, seed, opts);
  buildCharacter(run, opts.level ?? boss.level, opts);
  const home = Object.values(content.locations).find((l) => l.encounters.some((e) => e.groups.some((g) => g.creatureId === id)));
  if (home !== undefined) {
    run.walkTo(home.id, false);
    if (run.s.mode !== 'combat') throw run.fail(`the Bell-Warden's fight did not start at ${home.id}`);
  } else {
    startBossFight(run, id);
  }
  run.fightUntil({ stop: (_s, c) => (c.enemies.find((e) => e.refId === id)?.phase ?? 0) >= 1 });
  return run;
};

/** A fight the map never starts (a boss no location places): the engine's own `beginCombat`, run to the first turn. */
function startBossFight(run: Run, creatureId: string): void {
  const ctx = makeCtx(clone(run.s), clone(run.profile), run.content);
  beginCombat(ctx, {
    id: `enc_scenario_${creatureId}`,
    groups: [{ creatureId, count: 1 }],
    fleeable: false,
    onFlee: 'hold',
    ambush: false,
    onVictory: [],
    onDefeat: [],
    onFleeEffects: [],
  });
  runCombat(ctx);
  const { profile } = ctx.commit();
  ctx.s.meta.stepCount += 1;
  run.edit((w) => {
    w.s = ctx.s;
    w.p = profile;
  });
  if (run.s.mode !== 'combat') throw run.fail('the constructed fight did not start');
}

// ---- U67: the item panels' places (real pack only) ----------------------------------------------------------------------------

/** Kaelen's trading post and the Emberforge (WORLD §9.1): where the Merchant, Forge and Camp panels are played. */
const RESPITE_ID = 'loc_wayfarers_respite';
const EMBERFORGE_ID = 'loc_emberforge';

/** Gold in hand for the item panels' scenarios (constructed). */
const PANEL_GOLD = 600;

/**
 * Loop 1 at the Wayfarer's Respite (Kaelen's wagon, a safe place with an inn): Level 3 with its stat and ability points still
 * UNSPENT, 600 gold, a few potions, the band's best Common gear lying in the pack unworn (something to put on and something
 * to sell) and two Wildling Hides to sell. The walk there is played.
 */
const loop1Respite: Builder = (content, seed, opts) => {
  const id = 'loop1_respite';
  if (content.locations[RESPITE_ID]?.merchantId === undefined) throw new ScenarioUnavailable(id, "the pack has no Wayfarer's Respite with a trader");
  const run = startLoop1(id, content, seed, opts);
  const level = opts.level ?? 3;
  run.edit((w) => {
    setLevel(w, content, level);
    const potion = bestPotion(content, level);
    if (potion !== undefined) grantItem(w, content, potion, KIT_HEALS);
  });
  run.walkTo(RESPITE_ID);
  const pick = bestGear(content, run.s.player.classId, level);
  run.edit((w) => {
    const worn = (itemId: string): boolean => Object.values(w.s.player.equipment).some((i) => i?.itemId === itemId);
    for (const itemId of [pick.weapon, pick.armor, ...pick.trinkets]) if (itemId !== undefined && !worn(itemId)) grantItem(w, content, itemId);
    grantItem(w, content, 'mat_wildling_hide', 2);
    w.s.player.gold = Math.max(w.s.player.gold, PANEL_GOLD);
  });
  restock(run);
  return run;
};

/**
 * Loop 1 at the Emberforge (Borin's forge, a free camp): Level 5 in the band's best Common gear (worn), points spent, 600 gold,
 * five Ember Ore and a few potions. The walk there is played.
 */
const loop1Emberforge: Builder = (content, seed, opts) => {
  const id = 'loop1_emberforge';
  if (content.locations[EMBERFORGE_ID]?.craftingStation !== 'forge') throw new ScenarioUnavailable(id, 'the pack has no Emberforge');
  const run = startLoop1(id, content, seed, opts);
  buildCharacter(run, opts.level ?? 5, opts, true);
  run.walkTo(EMBERFORGE_ID);
  run.edit((w) => {
    grantItem(w, content, 'mat_ember_ore', 5);
    w.s.player.gold = Math.max(w.s.player.gold, PANEL_GOLD);
  });
  restock(run);
  return run;
};

// ---- the registry ----------------------------------------------------------------------------------------------------------------------

export const SCENARIOS: Record<ScenarioId, ScenarioInfo & { build: Builder }> = {
  loop1_day1: {
    summary: 'A fresh Loop 1: Day 1 dawn at the start location, the class kit, nothing spent.',
    route: 'played',
    constructed: '',
    build: loop1Day1,
  },
  first_fight: {
    summary: 'Level 1 at the first turn of the nearest fixed fight (title → newGame → walk).',
    route: 'played',
    constructed: '',
    build: firstFight,
  },
  pre_tyrant_l11_ranger: {
    summary: 'Loop 1, Level 11, standing at the Apex with the Face it / Not yet prompt open.',
    route: 'mixed',
    constructed: "the level, 5 healing consumables and the band's best Common gear (class-fit weapon, armor, two trinkets by WORLD's tier table; granted, then worn by legal equips), the Apex gate (quests marked complete); HP/MP and the potion stack are restored on arrival; points are spent by play, the walk is played",
    build: (c, s, o) => preTyrant('pre_tyrant_l11_ranger')(c, s, o),
  },
  pre_tyrant_l13_ranger: {
    summary: 'Loop 1, Level 13, standing at the Apex with the Face it / Not yet prompt open.',
    route: 'mixed',
    constructed: "the level, 5 healing consumables and the band's best Common gear (class-fit weapon, armor, two trinkets by WORLD's tier table; granted, then worn by legal equips), the Apex gate (quests marked complete); HP/MP and the potion stack are restored on arrival; points are spent by play, the walk is played",
    build: (c, s, o) => preTyrant('pre_tyrant_l13_ranger')(c, s, o),
  },
  combat_tyrant_contained_p2: {
    summary: 'The Contained Tyrant fight, played to its second phase, at the player turn.',
    route: 'mixed',
    constructed: 'as pre_tyrant_l13_ranger; Face it and the rounds are played',
    build: combatTyrantContainedP2,
  },
  loop2_day1: {
    summary: 'Loop 2 Day 1 after a real Loop 1 closer: the thirtieth dawn, the Horde, the Library portal (or a Fall on the way).',
    route: 'played',
    constructed: '',
    build: loop2Day1,
  },
  loop2_end: {
    summary: 'The Threshold after Loop 2 (Let go at the camp), with Resonance to spend.',
    route: 'mixed',
    constructed: 'Resonance topped up to RESONANCE_FLOOR when the pack has Attunements; Loop 1 and the closer are played',
    build: loop2End,
  },
  communion_movement_2: {
    summary: "Loop 2, the Tyrant's communion at the start of Movement II, reached through Movement I.",
    route: 'mixed',
    constructed: "the level, kit, the opening Echo and the Movement I answers' Echoes (profile), Apex access; Loop 1, the walk and the answers are played",
    build: communionMovement2,
  },
  ending_a_ready: {
    summary: "The Tyrant's Resolution with ending A's outcome on offer: the next Speak ends the game.",
    route: 'mixed',
    constructed: "the level, kit, every Echo/flag/item/reputation the ending, its outcome and the best answers need; the loops, the walk and the whole communion are played",
    build: (c, s, o) => endingReady('ending_a_ready', 'A')(c, s, o),
  },
  ending_b_ready: {
    summary: "The Tyrant's Resolution with ending B's outcome on offer: the next Speak ends the game.",
    route: 'mixed',
    constructed: "as ending_a_ready (ending B's requirements)",
    build: (c, s, o) => endingReady('ending_b_ready', 'B')(c, s, o),
  },
  before_day_3: {
    summary: "Loop 2 inside Silverwood Before on Last Bell (Day 3), at the Before's rest point.",
    route: 'mixed',
    constructed: 'the level and kit; Loop 1, the walk to the Breach-door and the two full rests are played',
    build: beforeDay3,
  },
  combat_bell_warden_p2: {
    summary: 'The Bell-Warden fight played to its second phase, at the player turn.',
    route: 'mixed',
    constructed: 'the level and kit; where no location places the boss (fixture packs) the fight itself is started with beginCombat',
    build: combatBellWardenP2,
  },
  expiry_minus_1: {
    summary: 'Loop 1, one watch before the thirtieth dawn: the next watch that passes expires the clock.',
    route: 'played',
    constructed: '',
    build: expiryMinus1,
  },
  loop1_respite: {
    summary: "Loop 1 at the Wayfarer's Respite (Kaelen's wagon): Level 3, points unspent, 600 gold, spare gear to wear and sell.",
    route: 'mixed',
    constructed: "the level (its stat and ability points left unspent), potions, 600 gold, the band's best Common gear in the pack unworn and two Wildling Hides; the walk is played",
    build: loop1Respite,
  },
  loop1_emberforge: {
    summary: "Loop 1 at Borin's Emberforge (forge and free camp): Level 5 in Common gear, 600 gold, five Ember Ore.",
    route: 'mixed',
    constructed: "the level, potions, the band's best Common gear (granted, then worn by legal equips), points spent by play, 600 gold and five Ember Ore; the walk is played",
    build: loop1Emberforge,
  },
};

export const SCENARIO_IDS = /* @__PURE__ */ Object.keys(SCENARIOS) as ScenarioId[];

const finish = (run: Run): ScenarioResult => {
  const parsed = GameStateSchema.safeParse(run.s);
  if (!parsed.success) throw run.fail(`not a valid GameState: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return { state: clone(run.s), profile: clone(run.profile) };
};

/**
 * Builds a scenario (PLAN §4.13). Dev/e2e builds only. A fight lost on the way retries the build with the next derived
 * seed (`<seed>#2` …, `DEFEAT_RETRIES` times); every other failure is thrown as it is.
 */
export function loadScenario(id: ScenarioId, content: ContentPack, opts: ScenarioOptions = {}): ScenarioResult {
  if (__DEV__ || __E2E__) {
    const def = SCENARIOS[id] as (ScenarioInfo & { build: Builder }) | undefined;
    if (def === undefined || !Object.prototype.hasOwnProperty.call(SCENARIOS, id)) throw new ScenarioError(String(id), 'unknown scenario');
    const base = opts.seed ?? `scenario:${id}`;
    for (let attempt = 0; ; attempt++) {
      try {
        return finish(def.build(content, attempt === 0 ? base : `${base}#${attempt + 1}`, opts));
      } catch (e) {
        if (!(e instanceof ScenarioDefeat) || attempt >= DEFEAT_RETRIES) throw e;
      }
    }
  }
  throw new Error('loadScenario is available in dev and e2e builds only (PLAN §4.13)');
}
