// Test builders over the fixture pack (PLAN §8, §4.13): `freshProfile`, `makeState` (a `newRun` state plus overrides
// keyed by content ids) and `play` (runs `step` over a script, failing on any rejection the script did not expect).
// Every id passed in is checked against the pack, so a typo fails where it is written, not deep inside a reducer.
import { need } from '@content/index';
import {
  GameStateSchema,
  baseMaxima,
  defaultRarity,
  newRun,
  step,
  type Action,
  type ContentPack,
  type FactionId,
  type FlagValue,
  type GameEvent,
  type GameState,
  type ItemInstance,
  type Mode,
  type Profile,
  type QuestState,
  type Rarity,
  type StepFn,
  type Watch,
} from '@engine/index';
import { fixturePack } from './miniContent';

// ---- Profile ----------------------------------------------------------------------------------------------------------

/** A brand-new profile (Loop 1, nothing known, default settings), with optional top-level overrides. */
export function freshProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    version: 1,
    profileId: 'fixture',
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
    ...overrides,
  };
}

// ---- State ------------------------------------------------------------------------------------------------------------

/** An item to place: an id (one, or one stack), or a spec. `equip` puts gear in its slot (trinkets: first free). */
export interface ItemSpec {
  itemId: string;
  qty?: number;
  rarity?: Rarity;
  affixes?: string[];
  equip?: boolean;
}

export interface StateOverrides {
  /** Run seed (default 'fixture'). */
  seed?: string;
  /** Default 'ranger'. */
  classId?: string;
  /** The run's loop (newRun reads it from `profile.loopCounter`). Default: the profile's, else 1. */
  loop?: number;
  /** Level with that level's base maxima, full HP/MP, stat and ability points (as newRun's carry-over does). */
  level?: number;
  /** Current location (also marked discovered). */
  locationId?: string;
  /** Breach Clock day (1-based) and watch (0 dawn … 3 night): ticks = (day − 1)·4 + watch. */
  day?: number;
  watch?: Watch;
  mode?: Mode;
  hp?: number;
  mp?: number;
  gold?: number;
  corruption?: number;
  /** Added after the class starter kit, in order. */
  items?: readonly (string | ItemSpec)[];
  abilities?: readonly string[];
  flags?: Readonly<Record<string, FlagValue>>;
  /** Granted this loop (`echoesThisLoop`); Echoes from earlier loops belong in the profile. */
  echoes?: readonly string[];
  /** Quest id → stage id (active at that stage), or a partial QuestState (stage defaults to the first stage). */
  quests?: Readonly<Record<string, string | Partial<QuestState>>>;
  reputation?: Partial<Record<FactionId, number>>;
  /** Last word: any edit the fields above do not cover. */
  patch?: (s: GameState) => void;
}

export interface MakeStateOptions {
  /** Default: the fixture pack. */
  content?: ContentPack;
  /** Default: `freshProfile` at the requested loop. */
  profile?: Profile;
}

/**
 * A valid GameState: `newRun` on the fixture pack, then the overrides. Unknown content ids throw, and the result must
 * pass `GameStateSchema`. The state is a fresh, mutable object.
 */
export function makeState(overrides: StateOverrides = {}, opts: MakeStateOptions = {}): GameState {
  const o = overrides;
  const content = opts.content ?? fixturePack();
  const base = opts.profile ?? freshProfile();
  const profile = o.loop === undefined ? base : { ...base, loopCounter: o.loop };
  const s = newRun(o.seed ?? 'fixture', o.classId ?? 'ranger', content, profile);
  const p = s.player;

  if (o.level !== undefined) {
    const { hpMax, mpMax } = baseMaxima(need(content, 'classes', p.classId), o.level);
    Object.assign(p, { level: o.level, xp: 0, hpMax, mpMax, hp: hpMax, mp: mpMax, apHalf: 2 * o.level, statPoints: o.level - 1 });
  }
  if (o.locationId !== undefined) {
    need(content, 'locations', o.locationId);
    s.world.currentLocationId = o.locationId;
    if (!s.world.discovered.includes(o.locationId)) s.world.discovered.push(o.locationId);
  }
  if (o.day !== undefined || o.watch !== undefined) s.clock.ticks = ((o.day ?? 1) - 1) * 4 + (o.watch ?? 0);
  const day = Math.floor(s.clock.ticks / 4) + 1;

  for (const entry of o.items ?? []) addItem(s, content, typeof entry === 'string' ? { itemId: entry } : entry);
  for (const id of o.abilities ?? []) {
    need(content, 'abilities', id);
    if (!p.abilitiesUnlocked.includes(id)) p.abilitiesUnlocked.push(id);
  }
  Object.assign(s.flags, o.flags);
  for (const id of o.echoes ?? []) {
    need(content, 'echoes', id);
    if (!s.echoesThisLoop.includes(id)) s.echoesThisLoop.push(id);
  }
  for (const [id, spec] of Object.entries(o.quests ?? {})) {
    const quest = need(content, 'quests', id);
    const given = typeof spec === 'string' ? { stage: spec } : spec;
    const stage = given.stage ?? quest.firstStage ?? quest.stages[0]!.id;
    if (!quest.stages.some((st) => st.id === stage)) throw new Error(`makeState: quest ${id} has no stage '${stage}'`);
    s.quests[id] = { status: 'active', startedDay: day, endedDay: null, counters: {}, objectivesDone: [], ...given, stage };
  }
  Object.assign(s.reputation, o.reputation);
  if (o.hp !== undefined) p.hp = o.hp;
  if (o.mp !== undefined) p.mp = o.mp;
  if (o.gold !== undefined) p.gold = o.gold;
  if (o.corruption !== undefined) p.corruption = o.corruption;
  if (o.mode !== undefined) s.mode = o.mode;
  o.patch?.(s);

  const parsed = GameStateSchema.safeParse(s);
  if (!parsed.success) {
    throw new Error(`makeState: not a valid GameState:\n  ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')}`);
  }
  return s;
}

function addItem(s: GameState, content: ContentPack, spec: ItemSpec): void {
  const def = need(content, 'items', spec.itemId);
  const item: ItemInstance = {
    uid: `i${s.meta.nextUid++}`,
    itemId: spec.itemId,
    qty: spec.qty ?? 1,
    rarity: spec.rarity ?? defaultRarity(def),
    affixes: spec.affixes ?? [...def.fixedAffixes],
  };
  if (item.qty > 1 && !def.stackable) throw new Error(`makeState: ${spec.itemId} does not stack (qty ${item.qty})`);
  if (!spec.equip) {
    s.player.inventory.push(item);
    return;
  }
  const eq = s.player.equipment;
  if (def.slot === 'weapon' || def.slot === 'armor') {
    const previous = eq[def.slot];
    if (previous) s.player.inventory.push(previous);
    eq[def.slot] = item;
  } else if (def.slot === 'trinket') {
    if (!eq.trinket1) eq.trinket1 = item;
    else if (!eq.trinket2) eq.trinket2 = item;
    else throw new Error(`makeState: both trinket slots are full (${spec.itemId})`);
  } else {
    throw new Error(`makeState: ${spec.itemId} is a ${def.type}; it has no equipment slot`);
  }
}

// ---- Playing a script -------------------------------------------------------------------------------------------------

/** A script entry: an action that must be accepted, or `{ reject }` for one that must be rejected (optionally why). */
export type PlayEntry = Action | { reject: Action; reason?: string | RegExp };

export interface PlayOptions {
  /** Default: `freshProfile` at the state's loop. */
  profile?: Profile;
  /** Default: the fixture pack. */
  content?: ContentPack;
  /** Default: the engine's `step`; tests pass a `createStep(...)` with stand-in reducers. */
  step?: StepFn;
}

export interface PlayResult {
  state: GameState;
  profile: Profile;
  /** Every event of every step, in order (expected rejections included). */
  events: GameEvent[];
}

type Rejected = Extract<GameEvent, { t: 'actionRejected' }>;

/** Runs `step` over the script in order; throws (naming the entry) on any unexpected outcome. */
export function play(state: GameState, script: readonly PlayEntry[], opts: PlayOptions = {}): PlayResult {
  const content = opts.content ?? fixturePack();
  const run = opts.step ?? step;
  let current = state;
  let profile = opts.profile ?? freshProfile({ loopCounter: state.meta.loop });
  const events: GameEvent[] = [];
  script.forEach((entry, i) => {
    const wanted = 'reject' in entry ? entry : null;
    const action = wanted ? wanted.reject : (entry as Action);
    const out = run(current, action, content, profile);
    const rejected = out.events.find((e): e is Rejected => e.t === 'actionRejected');
    const where = `play: #${i} ${JSON.stringify(action)}`;
    if (wanted && !rejected) throw new Error(`${where} was accepted; the script expected a rejection`);
    if (!wanted && rejected) throw new Error(`${where} was rejected: ${rejected.reason}`);
    if (wanted?.reason !== undefined && rejected && !matches(rejected.reason, wanted.reason)) {
      throw new Error(`${where} was rejected with "${rejected.reason}"; expected ${String(wanted.reason)}`);
    }
    events.push(...out.events);
    current = out.state;
    profile = out.profile;
  });
  return { state: current, profile, events };
}

const matches = (reason: string, want: string | RegExp): boolean => (typeof want === 'string' ? reason.includes(want) : want.test(reason));
