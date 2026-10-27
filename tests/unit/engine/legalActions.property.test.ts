// U35 — the C2 engine checkpoint (PLAN §4.7, §9.2–9.3; D-043): legalActions is complete and exact, and agrees with
// `step`, over a corpus of states reached by seeded random legal walks from `newRun` on every fixture pack (mini,
// combat, companion, horde, before, threshold, story, economy) in both loop regimes (Loop 1; Loop 2+ with Resonance, an
// ending reached and the Tyrant's Echoes). Walks start at the title (→ newGame), as a rich explorer (every consumable,
// gear, materials, every companion), at the Threshold, below the Apex (the communion), at the forge, and in a Horde; the
// policy favours unvisited nodes, and states offering a rare action are sampled more often. For every sampled state:
//   (a) every listed action (examine included) is accepted by `step` and `isLegal` says so;
//   (b) ≥ 200 generated actions that are not listed — wrong mode, bad ids, Object.prototype names, out-of-range
//       parameters, mutations and near misses of listed ones (an optional parameter dropped or spelled out) — are
//       rejected by `step` with the very same state/profile references and exactly one `actionRejected` event, and
//       `isLegal` is false for each; the only accepted unlisted actions are the documented aliases (legalActions.ts
//       header: another spelling of a listed action), and `isLegal` is true for them;
//   (c) legalActions is never empty, and outside the title and the Loop 1 FALLEN screen it lists a game action besides
//       the shell's save/load/newGame/returnToTitle (the bots never pick those, PLAN §7.2).
// The disagreements this found are pinned below ('U35 fixes'). Local deep run (every parameterization of every type,
// ~5 min): U35_SHARE=3000 U35_DUMP=1 bun test tests/unit/engine/legalActions.property.test.ts
import { describe, expect, test } from 'bun:test';
import {
  ACTION_MODES,
  Ctx,
  EQUIP_SLOTS,
  STANCES,
  STAT_NAMES,
  THRESHOLD_AREAS,
  Rng,
  isLegal,
  legalActions,
  newRun,
  reservedParam,
  serialize,
  startHorde,
  step,
  type Action,
  type ActionType,
  type ContentPack,
  type GameState,
  type ItemInstance,
  type Mode,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { canonicalJson } from '@engine/util/hash';
import { beforePack } from '@tests/fixtures/beforeContent';
import { combatPack } from '@tests/fixtures/combatContent';
import { companionPack } from '@tests/fixtures/companionContent';
import { economyPack } from '@tests/fixtures/economyContent';
import { freshProfile } from '@tests/fixtures/helpers';
import { hordePack } from '@tests/fixtures/hordeContent';
import { fixturePack } from '@tests/fixtures/miniContent';
import { storyPack } from '@tests/fixtures/storyContent';
import { thresholdPack } from '@tests/fixtures/thresholdContent';

// ---- the corpus ---------------------------------------------------------------------------------------------------------

const PACKS: readonly { name: string; content: () => ContentPack }[] = [
  { name: 'mini', content: fixturePack },
  { name: 'combat', content: () => combatPack() },
  { name: 'companion', content: () => companionPack() },
  { name: 'horde', content: hordePack },
  { name: 'before', content: beforePack },
  { name: 'threshold', content: thresholdPack },
  { name: 'story', content: storyPack },
  { name: 'economy', content: economyPack },
];

/** Walk length (steps) and sampling period; 8 packs × 9 walks × ≥ 9 samples ≥ 300 states. */
const WALK_STEPS = 140;
const SAMPLE_EVERY = 28;
/** Generated non-listed actions per state: in-mode (sampled per type), mutations of listed ones, wrong-mode per type; ≥ 200 illegal. */
const IN_MODE_PER_STATE = 260;
const MUTATIONS_PER_STATE = 150;
const WRONG_MODE_PER_TYPE = 6;
const ILLEGAL_PER_STATE = 200;

interface Sample {
  pack: string;
  walk: string;
  at: number;
  s: GameState;
  profile: Profile;
  content: ContentPack;
  /** Save files of explore/threshold states met earlier in the walk (for `load` candidates in title mode). */
  saves: unknown[];
}

type Regime = 1 | 2;

/** Commune's opening Echo and the fixture Tyrant's answer Echoes, Movements I–II (communion.test.ts): Loop 2+ profiles hold them. */
const ANSWER_ECHOES = ['echo_tyrant_speaks', 'echo_tyrant_jailer', 'echo_thirtieth_dawn', 'echo_seven_wayfinders', 'echo_litany_verse_2', 'echo_ritual_inevitable', 'echo_hallow_said_stop'];

function profileFor(content: ContentPack, regime: Regime): Profile {
  if (regime === 1) return freshProfile();
  const ending = content.index.endingIds[0];
  return freshProfile({
    loopCounter: 3,
    resonance: 400,
    resonanceEarnedTotal: 400,
    endingsReached: ending === undefined ? [] : [ending],
    echoes: ANSWER_ECHOES.filter((id) => content.echoes[id] !== undefined),
  });
}

type Variant = 'title' | 'rich' | 'threshold' | 'apex' | 'forge' | 'horde';

const APEX = 'loc_temporal_breach_apex';
const NEXUS = 'loc_chronos_nexus';

/** Every companion of the pack recruited (level-1 records), one of them active. */
function recruitAll(s: GameState, content: ContentPack, rng: Rng): GameState['companions'] {
  const ids = Object.keys(content.companions).sort();
  if (ids.length === 0) return s.companions;
  const recruited = { ...s.companions.recruited };
  for (const id of ids) {
    const hp = content.companions[id]!.stats.hp;
    recruited[id] = { id, recruited: true, loyalty: 30, hp, hpMax: hp, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} };
  }
  return { ...s.companions, recruited, activeId: rng.pick(ids) };
}

const PLAZA = 'loc_silverwood_plaza';
const forgeOf = (content: ContentPack): string | undefined => content.index.locationIds.find((id) => content.locations[id]?.craftingStation !== undefined);

/**
 * A walk's first state: `newRun`, then the start variant — title (→ newGame), a rich explorer (gold, levels, points,
 * every consumable, materials, gear, every companion, somewhere on the map), the Threshold, Loop 2+ walking up into the Apex with the
 * Tyrant's answer Echoes (the communion), at the forge with every material and the Ironclad's trust, or in a Horde
 * (the engine's own `startHorde`) a node from the Library portal.
 */
function startState(content: ContentPack, profile: Profile, variant: Variant, seed: string, rng: Rng): GameState {
  const classId = rng.pick(Object.keys(content.classes).sort());
  const s = newRun(seed, classId, content, profile);
  if (variant === 'title') return { ...s, mode: 'title' };
  if (variant === 'threshold') return { ...s, mode: 'threshold', threshold: { visited: ['still_shore'], spentThisVisit: 0, pendingClassId: null } };
  const consumables = Object.values(content.items).filter((d) => d.type === 'consumable');
  const others = Object.values(content.items).filter((d) => d.type === 'material' || d.type === 'tome');
  const inventory: ItemInstance[] = [...s.player.inventory];
  let uid = s.meta.nextUid;
  for (const def of [...consumables, ...rng.shuffle(others).slice(0, 6)]) {
    inventory.push({ uid: `i${uid++}`, itemId: def.id, qty: def.stackable ? 2 : 1, rarity: def.fixedRarity ?? 'common', affixes: [...def.fixedAffixes] });
  }
  const gear = Object.values(content.items).filter((d) => d.slot !== undefined);
  for (const def of rng.shuffle(gear).slice(0, 3)) {
    inventory.push({ uid: `i${uid++}`, itemId: def.id, qty: 1, rarity: def.fixedRarity ?? 'common', affixes: [...def.fixedAffixes] });
  }
  const apex = variant === 'apex';
  if (variant === 'forge') {
    for (const def of Object.values(content.items).filter((d) => d.type === 'material')) {
      inventory.push({ uid: `i${uid++}`, itemId: def.id, qty: Math.min(5, def.maxStack), rarity: def.fixedRarity ?? 'common', affixes: [...def.fixedAffixes] });
    }
  }
  const spot = apex ? NEXUS : variant === 'forge' ? forgeOf(content) : variant === 'horde' ? PLAZA : undefined;
  // never a Threshold place (U34c's Still Shore): it is reached only by a loop's end, never stood on in explore mode
  const onMap = (id: string): boolean => !id.includes('before') && id !== APEX && !(content.locations[id]?.tags.includes('threshold') ?? false);
  const locationId = spot ?? rng.pick(content.index.locationIds.filter(onMap));
  let out: GameState = {
    ...s,
    meta: { ...s.meta, nextUid: uid },
    player: { ...s.player, gold: variant === 'forge' ? 3000 : 400, level: apex ? 18 : 5, statPoints: 2, apHalf: 8, inventory },
    world: { ...s.world, currentLocationId: locationId, discovered: [...new Set([...s.world.discovered, locationId])] },
    companions: recruitAll(s, content, rng),
    echoesThisLoop: apex ? [...new Set([...s.echoesThisLoop, 'echo_apex_resonance'])] : s.echoesThisLoop,
    reputation: variant === 'forge' ? { ...s.reputation, ironclad: 60 } : s.reputation,
  };
  if (variant === 'horde') {
    const ctx = new Ctx(clone(out), profile, content);
    ctx.s.world.tyrant = 'defeated';
    startHorde(ctx, 'tyrant', 0);
    out = ctx.s;
  }
  if (apex) {
    const up = step(out, { type: 'move', to: APEX }, content, profile); // the Unveiled Tyrant: the fight opens at once
    if (up.events[0]?.t !== 'actionRejected') out = up.state;
  }
  return out;
}

/** Walk policy weights: explore the graph and fight; rarely leave for the title or end the loop on purpose. */
const WEIGHT: Partial<Record<ActionType, number>> = {
  returnToTitle: 0.02,
  save: 0.05,
  load: 0,
  letGo: 0.05,
  keepVigil: 0.1,
  newGamePlus: 0.1,
  drop: 0.2,
  sell: 0.3,
  flee: 0.4,
  wait: 0.3,
  move: 3,
  take: 1.5,
  takeAll: 1.5,
  talk: 2,
  choose: 2,
  continue: 2,
  attack: 2,
  ability: 1.5,
  interact: 2,
  commune: 6,
  companionCommand: 1.5,
};

/** Actions few states offer: a state listing one is also sampled at this chance, on top of the regular period. */
const RARE_CHANCE = 0.07;
const RARE: readonly ActionType[] = ['enterPortal', 'craft', 'upgrade', 'salvage', 'commune', 'acceptQuest', 'interact', 'choose', 'continue', 'acknowledgeEnding', 'letGo', 'keepVigil', 'respec', 'gather'];

function corpus(): Sample[] {
  const out: Sample[] = [];
  for (const { name, content: make } of PACKS) {
    const content = make();
    const hasApex = content.locations[APEX] !== undefined && content.locations[NEXUS] !== undefined && content.echoes.echo_apex_resonance !== undefined;
    const walks: { regime: Regime; variant: Variant }[] = [
      { regime: 1, variant: 'title' },
      { regime: 1, variant: 'rich' },
      { regime: 1, variant: 'rich' },
      { regime: 2, variant: 'title' },
      { regime: 2, variant: 'rich' },
      { regime: 2, variant: 'threshold' },
      { regime: 2, variant: hasApex ? 'apex' : 'rich' },
      { regime: 1, variant: forgeOf(content) !== undefined ? 'forge' : 'rich' },
      { regime: 2, variant: content.locations[PLAZA] !== undefined && hasApex ? 'horde' : 'rich' },
    ];
    walks.forEach(({ regime, variant }, w) => {
      const walk = `${name}/L${regime === 1 ? 1 : '2+'}/${variant}#${w}`;
      const rng = Rng.fromSeed(`u35:${walk}`);
      let profile = profileFor(content, regime);
      let s = startState(content, profile, variant, `u35:${walk}`, rng);
      const saves: unknown[] = [];
      for (let i = 0; i < WALK_STEPS; i++) {
        if (s.mode === 'explore' || s.mode === 'threshold') {
          if (i % 5 === 0) saves.push(serialize(s, profile, content, '2026-10-15T00:00:00Z'));
        } else if (s.mode === 'combat' && i % 7 === 0) saves.push(serialize(s, profile, content, '2026-10-15T00:00:00Z'));
        const legal = legalActions(s, content, profile);
        const rare = legal.some((a) => RARE.includes(a.type)) && rng.chance(RARE_CHANCE);
        if (i % SAMPLE_EVERY === SAMPLE_EVERY - 1 || i === 0 || rare) out.push({ pack: name, walk, at: i, s, profile, content, saves: [...saves] });
        if (legal.length === 0) break;
        const fresh = (a: Action): boolean => a.type === 'move' && s.world.locationStates[a.to]?.visited !== true;
        const action = rng.weighted(legal.map((a) => ({ weight: (WEIGHT[a.type] ?? 1) * (fresh(a) ? 4 : 1), value: a })));
        const next = step(s, action, content, profile);
        if (next.events[0]?.t === 'actionRejected') throw new Error(`walk ${walk} #${i}: listed ${JSON.stringify(action)} was rejected`);
        s = next.state;
        profile = next.profile;
      }
      out.push({ pack: name, walk, at: WALK_STEPS, s, profile, content, saves: [...saves] });
    });
  }
  return out;
}

// ---- candidates -----------------------------------------------------------------------------------------------------------

/** Ids that name no content record: unknown, empty, and Object.prototype members (content rule-06 reserves them). */
const BOGUS = ['nope', '', 'toString', 'constructor', '__proto__', 'hasOwnProperty'];

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

/** Every item uid the state holds (pack, equipment, ground here, merchants' stock) plus bogus ones. */
function uidsOf(s: GameState): string[] {
  const here = s.world.locationStates[s.world.currentLocationId]?.items ?? [];
  const equipped = Object.values(s.player.equipment).filter((i): i is ItemInstance => i !== null);
  const stock = Object.values(s.merchants).flatMap((m) => m?.stock ?? []);
  return uniq([...s.player.inventory, ...equipped, ...here, ...stock].map((i) => i.uid).concat(['i0', 'i99999', ...BOGUS]));
}

function combatantUids(s: GameState): (string | undefined)[] {
  const c = s.combat;
  return [undefined, 'player', 'c99999', ...BOGUS, ...(c ? [...c.party, ...c.enemies].map((x) => x.uid) : [])];
}

function choiceIds(content: ContentPack): string[] {
  const ids = Object.values(content.dialogues).flatMap((scene) => scene.nodes.flatMap((n) => n.choices.map((c) => c.id)));
  return uniq([...ids, 'face_it', 'not_yet', ...BOGUS]);
}

function communionIds(content: ContentPack): { answers: string[]; items: string[] } {
  const answers: string[] = [];
  const items: string[] = [];
  for (const cr of Object.values(content.creatures)) {
    const c = cr.communion;
    if (!c) continue;
    for (const m of c.movements) for (const q of m.questions) answers.push(...q.answers.map((a) => a.id));
    answers.push(...c.outcomes.map((o) => o.choiceId));
    items.push(...c.offers.map((o) => o.itemId));
  }
  return { answers: uniq([...answers, ...BOGUS]), items: uniq([...items, ...BOGUS]) };
}

const keys = (table: object): string[] => Object.keys(table);

/** Every parameterization worth trying for `type` in this state (a superset of what `step` could accept). */
function domain(type: ActionType, s: GameState, content: ContentPack, saves: readonly unknown[]): Action[] {
  const uids = uidsOf(s);
  const ids = (table: object) => uniq([...keys(table), ...BOGUS]);
  const qtys = [undefined, 1, 2, 0, -1, 1.5, 999];
  switch (type) {
    case 'newGame':
      return [...ids(content.classes)].flatMap((classId) => [
        { type, name: 'Wayfinder', classId },
        { type, name: '', classId, seed: 'u35' },
      ]);
    case 'chooseClass':
      return ids(content.classes).map((classId) => ({ type, classId }));
    case 'save':
      return ([1, 2, 3, 'auto', 0, 4, 'slot'] as unknown[]).map((slot) => ({ type, slot }) as Action);
    case 'load': {
      // the walk's latest saves (explore/threshold resume; a combat save does not), else a fresh run's, and junk
      const files = saves.length > 0 ? saves.slice(-3) : [serialize(newRun('u35:load', Object.keys(content.classes).sort()[0] as string, content, freshProfile()), freshProfile(), content, 'now')];
      return [...files, null, 42, 'save', {}, { version: 1 }].map((save) => ({ type, save }));
    }
    case 'move':
      return ids(content.locations).map((to) => ({ type, to }));
    case 'examine':
      return [
        { type, target: { kind: 'location' } },
        ...ids(content.locations).map((to): Action => ({ type, target: { kind: 'exit', to } })),
        ...uids.map((uid): Action => ({ type, target: { kind: 'item', uid } })),
        ...ids(content.npcs).map((id): Action => ({ type, target: { kind: 'npc', id } })),
      ];
    case 'take':
    case 'readBook':
    case 'salvage':
      return uids.map((uid) => ({ type, uid }) as Action);
    case 'rest':
      return (['short', 'full', 'long'] as const).map((kind) => ({ type, kind }) as Action);
    case 'talk':
      return ids(content.npcs).map((npcId) => ({ type, npcId }));
    case 'interact':
      return uniq([...Object.values(content.locations).flatMap((l) => l.events.map((e) => e.id)), ...BOGUS]).map((eventId) => ({ type, eventId }));
    case 'use':
      return uids.flatMap((uid) => [{ type, uid }, { type, uid, targetUid: 'player' }] as Action[]);
    case 'equip':
      return uids.flatMap((uid) => [undefined, ...EQUIP_SLOTS, 'pocket'].map((slot) => (slot === undefined ? { type, uid } : { type, uid, slot }) as Action));
    case 'unequip':
      return [...EQUIP_SLOTS, 'pocket'].map((slot) => ({ type, slot }) as Action);
    case 'drop':
      return uids.flatMap((uid) => qtys.map((qty) => (qty === undefined ? { type, uid } : { type, uid, qty })));
    case 'allocateStat':
      return [...STAT_NAMES, 'luck'].map((stat) => ({ type, stat }) as Action);
    case 'unlockAbility':
      return ids(content.abilities).map((abilityId) => ({ type, abilityId }));
    case 'buy':
    case 'sell':
      return ids(content.merchants).flatMap((merchantId) => uids.flatMap((uid) => qtys.map((qty) => (qty === undefined ? { type, merchantId, uid } : { type, merchantId, uid, qty }) as Action)));
    case 'craft':
      return ids(content.recipes).map((recipeId) => ({ type, recipeId }));
    case 'upgrade':
      return uids.flatMap((uid) => [undefined, ...keys(content.affixes), 'nope'].map((affixId) => (affixId === undefined ? { type, uid } : { type, uid, affixId })));
    case 'choose':
      return choiceIds(content).map((choiceId) => ({ type, choiceId }));
    case 'acceptQuest':
      return ids(content.quests).map((questId) => ({ type, questId }));
    case 'attack':
      return combatantUids(s).map((targetUid) => ({ type, targetUid: targetUid ?? 'player' }));
    case 'ability':
      return ids(content.abilities).flatMap((abilityId) => combatantUids(s).map((targetUid) => (targetUid === undefined ? { type, abilityId } : { type, abilityId, targetUid })));
    case 'item':
      return uids.flatMap((uid) => combatantUids(s).map((targetUid) => (targetUid === undefined ? { type, uid } : { type, uid, targetUid })));
    case 'companionCommand':
      return (['signature', 'focus', 'hold', 'dance'] as const).flatMap((command) =>
        combatantUids(s).map((targetUid) => (targetUid === undefined ? { type, command } : { type, command, targetUid }) as Action),
      );
    case 'setStance':
      return [...STANCES, 'reckless'].map((stance) => ({ type, stance }) as Action);
    case 'commune': {
      const { answers, items } = communionIds(content);
      const acts = ['toggle', 'speak', 'listen', 'offer', 'resist', 'sing'] as const;
      return acts.flatMap((act) => [
        { type, act } as Action,
        ...answers.map((answerId) => ({ type, act, answerId }) as Action),
        ...items.map((itemId) => ({ type, act, itemId }) as Action),
      ]);
    }
    case 'swapCompanion':
      return [null, ...ids(content.companions)].map((companionId) => ({ type, companionId }));
    case 'thresholdGo':
      return [...THRESHOLD_AREAS, 'nowhere'].map((to) => ({ type, to }) as Action);
    case 'thresholdSpend':
    case 'thresholdRefund':
      return ids(content.attunements).map((attunementId) => ({ type, attunementId }) as Action);
    case 'equipAttunement':
      return ids(content.attunements).flatMap((attunementId) => ([true, false, 'yes'] as unknown[]).map((on) => ({ type, attunementId, on }) as Action));
    case 'toggleModifier':
      return ids(content.modifiers).map((modifierId) => ({ type, modifierId }));
    default:
      return [{ type } as Action];
  }
}

/** The optional parameters of each action (PLAN §4.4): dropping one, or spelling one out, is a near miss worth trying. */
const OPTIONAL: Partial<Record<ActionType, readonly string[]>> = {
  newGame: ['seed'],
  use: ['targetUid'],
  equip: ['slot'],
  drop: ['qty'],
  buy: ['qty'],
  sell: ['qty'],
  upgrade: ['affixId'],
  ability: ['targetUid'],
  item: ['targetUid'],
  companionCommand: ['targetUid'],
  commune: ['answerId', 'itemId'],
};

/**
 * Mutations of a listed action: each string parameter replaced by a bogus id, each number pushed out of range, each
 * boolean flipped; each optional parameter dropped, or spelled out with every plausible value (the near misses that
 * separate an alias from a parameter the reducer should refuse).
 */
function mutations(a: Action, x: Sample, listed: readonly Action[]): Action[] {
  const out: Action[] = [];
  const rec = a as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    if (k === 'type') continue;
    if (typeof v === 'string') for (const b of ['nope', 'toString']) out.push({ ...a, [k]: b } as Action);
    if (typeof v === 'number') for (const b of [0, -1, v + 1000]) out.push({ ...a, [k]: b } as Action);
    if (typeof v === 'boolean') out.push({ ...a, [k]: !v } as Action);
  }
  const parties = combatantUids(x.s).filter((u): u is string => u !== undefined && !BOGUS.includes(u));
  const params = listed.flatMap((l) => Object.entries(l as unknown as Record<string, unknown>));
  for (const k of OPTIONAL[a.type] ?? []) {
    if (k in rec) {
      const { [k]: _gone, ...rest } = rec;
      out.push(rest as unknown as Action);
      continue;
    }
    const values: unknown[] =
      k === 'targetUid' ? parties
      : k === 'slot' ? [...EQUIP_SLOTS]
      : k === 'qty' ? [1, 2, 3]
      : k === 'seed' ? ['u35']
      : k === 'affixId' ? keys(x.content.affixes).slice(0, 4)
      : uniq(params.filter(([pk]) => pk === k).map(([, pv]) => pv)).concat('nope');
    for (const v of values) out.push({ ...a, [k]: v } as Action);
  }
  return out;
}

const ALL_TYPES = Object.keys(ACTION_MODES) as ActionType[];

/** Candidates for a state: the in-mode domains, mutations of listed actions, and every type in a mode it is not for. */
function candidates(x: Sample, listed: readonly Action[], rng: Rng): Action[] {
  const inMode = ALL_TYPES.filter((t) => ACTION_MODES[t].includes(x.s.mode));
  const wrongMode = ALL_TYPES.filter((t) => !ACTION_MODES[t].includes(x.s.mode));
  // in mode: every type gets an even share of the budget (a type's domain can be thousands: buy = merchants × uids × qty)
  const share = Number(process.env.U35_SHARE ?? 0) || Math.ceil(IN_MODE_PER_STATE / Math.max(1, inMode.length));
  const pool: Action[] = [];
  for (const t of inMode) pool.push(...rng.shuffle(domain(t, x.s, x.content, x.saves)).slice(0, share));
  pool.push(...rng.shuffle(listed.flatMap((a) => mutations(a, x, listed))).slice(0, MUTATIONS_PER_STATE));
  const wrong: Action[] = [];
  for (const t of wrongMode) wrong.push(...rng.shuffle(domain(t, x.s, x.content, x.saves)).slice(0, WRONG_MODE_PER_TYPE));
  return [...pool, ...wrong];
}

// ---- checks ---------------------------------------------------------------------------------------------------------------

const key = (a: Action): string => canonicalJson(a);

/**
 * The documented aliases (legalActions.ts header): an accepted, unlisted action must be another spelling of a listed one —
 * free text, the payload, another stack or quantity of a listed item, a slot or target spelled out at its default.
 */
function aliasOfListed(x: Sample, a: Action, listed: readonly Action[]): boolean {
  const same = <T extends ActionType>(t: T, f: (l: Extract<Action, { type: T }>) => boolean): boolean =>
    listed.some((l) => l.type === t && f(l as Extract<Action, { type: T }>));
  const itemOf = (uid: string): string | undefined => x.s.player.inventory.find((i) => i.uid === uid)?.itemId;
  const playerUid = x.s.combat?.party.find((c) => c.kind === 'player')?.uid;
  switch (a.type) {
    case 'newGame':
      return same('newGame', (l) => l.classId === a.classId);
    case 'load':
      return true; // never listed: the payload is the shell's file
    case 'drop':
      return same('drop', (l) => itemOf(l.uid) === itemOf(a.uid));
    case 'sell':
      return same('sell', (l) => l.merchantId === a.merchantId && itemOf(l.uid) === itemOf(a.uid));
    case 'buy':
      return same('buy', (l) => l.merchantId === a.merchantId && l.uid === a.uid);
    case 'equip': // a weapon's own slot spelled out, or a trinket's slot left to the first free one
      return same('equip', (l) => l.uid === a.uid && ((l.slot === undefined && a.slot !== undefined) || (l.slot !== undefined && a.slot === undefined)));
    case 'ability':
      return a.targetUid === undefined && same('ability', (l) => l.abilityId === a.abilityId && l.targetUid !== undefined);
    case 'item': // a thrown item's default target, or a heal aimed at the player by name
      if (a.targetUid === undefined) return same('item', (l) => l.uid === a.uid && l.targetUid !== undefined);
      return a.targetUid === playerUid && same('item', (l) => l.uid === a.uid && l.targetUid === undefined);
    case 'companionCommand':
      return a.command === 'signature' && a.targetUid === undefined && same('companionCommand', (l) => l.command === 'signature' && l.targetUid !== undefined);
    default:
      return false;
  }
}

/** Shell actions (PLAN §7.2: the bots never pick them); a reachable state always offers a game action besides. */
const SHELL: readonly ActionType[] = ['save', 'load', 'newGame', 'returnToTitle'];
/** The Loop 1 FALLEN screen (D-082): the fight lost, `returnToTitle` is the acknowledgement and the only action. */
const fallen = (s: GameState): boolean => s.mode === 'combat' && s.combat?.phase === 'defeat';

interface Problem {
  where: string;
  action: Action;
  what: string;
}

function check(x: Sample, rng: Rng): { problems: Problem[]; illegal: number; listed: number } {
  const problems: Problem[] = [];
  const where = `${x.walk} @${x.at} (${x.s.mode}${x.s.combat ? `/${x.s.combat.phase}` : ''} at ${x.s.world.currentLocationId})`;
  const listed = legalActions(x.s, x.content, x.profile, { includeExamine: true });
  const listedKeys = new Set(listed.map(key));
  if (listed.length === 0) problems.push({ where, action: { type: 'continue' }, what: 'legalActions is empty' });
  if (x.s.mode !== 'title' && !fallen(x.s) && listed.every((a) => SHELL.includes(a.type))) {
    problems.push({ where, action: listed[0] ?? { type: 'continue' }, what: `only shell actions are listed (${listed.map((a) => a.type).join(', ')})` });
  }
  for (const a of listed) {
    if (!isLegal(x.s, a, x.content, x.profile)) problems.push({ where, action: a, what: 'listed but isLegal is false' });
    const out = step(x.s, a, x.content, x.profile);
    const rej = out.events.find((e) => e.t === 'actionRejected');
    if (rej) problems.push({ where, action: a, what: `listed but rejected: ${rej.t === 'actionRejected' ? rej.reason : ''}` });
  }
  let illegal = 0;
  const seen = new Set<string>(listedKeys);
  for (const a of candidates(x, listed, rng)) {
    const k = key(a);
    if (seen.has(k)) continue;
    seen.add(k);
    let legal: boolean;
    let out: ReturnType<typeof step>;
    try {
      legal = isLegal(x.s, a, x.content, x.profile);
      out = step(x.s, a, x.content, x.profile);
    } catch (e) {
      problems.push({ where, action: a, what: `threw: ${(e as Error).message}` });
      continue;
    }
    const accepted = out.events[0]?.t !== 'actionRejected';
    if (accepted !== legal) problems.push({ where, action: a, what: `isLegal ${legal} but step ${accepted ? 'accepts' : `rejects (${(out.events[0] as { reason?: string }).reason})`}` });
    if (accepted) {
      if (!aliasOfListed(x, a, listed)) problems.push({ where, action: a, what: 'accepted but not listed (and not a documented alias)' });
      continue;
    }
    illegal += 1;
    if (out.state !== x.s || out.profile !== x.profile || out.events.length !== 1) {
      problems.push({ where, action: a, what: 'rejected without returning the same references and one event' });
    }
  }
  return { problems, illegal, listed: listed.length };
}

// ---- the property ------------------------------------------------------------------------------------------------------------

const SAMPLES = corpus();

if (process.env.U35_DUMP) {
  const types: Record<string, number> = {};
  for (const x of SAMPLES) for (const a of legalActions(x.s, x.content, x.profile, { includeExamine: true })) types[a.type] = (types[a.type] ?? 0) + 1;
  console.log(`U35 corpus: ${SAMPLES.length} states; listed`, JSON.stringify(Object.entries(types).sort()));
}

describe('legalActions ⇔ step over the fixture corpus (C2 engine)', () => {
  test('the corpus: ≥ 300 states, every pack, both loop regimes, every mode, every listable action type', () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(300);
    expect(new Set(SAMPLES.map((x) => x.pack)).size).toBe(PACKS.length);
    expect(new Set(SAMPLES.map((x) => x.s.meta.loop > 1))).toEqual(new Set([false, true]));
    const modes = new Set<Mode>(SAMPLES.map((x) => x.s.mode));
    expect(['title', 'explore', 'combat', 'dialogue', 'threshold', 'ending'].filter((m) => !modes.has(m as Mode))).toEqual([]);
    const listed = new Set(SAMPLES.flatMap((x) => legalActions(x.s, x.content, x.profile, { includeExamine: true }).map((a) => a.type)));
    expect(ALL_TYPES.filter((t) => !listed.has(t))).toEqual(['load']); // `load` is never listed (its payload is the shell's file)
  });

  for (const { name } of PACKS) {
    test(`${name}: every listed action is accepted, ≥ ${ILLEGAL_PER_STATE} unlisted ones are rejected with the same refs, never empty`, () => {
      const rng = Rng.fromSeed(`u35:check:${name}`);
      const problems: Problem[] = [];
      const short: string[] = [];
      for (const x of SAMPLES.filter((y) => y.pack === name)) {
        const r = check(x, rng);
        problems.push(...r.problems);
        if (r.illegal < ILLEGAL_PER_STATE) short.push(`${x.walk} @${x.at}: ${r.illegal} illegal`);
      }
      if (process.env.U35_DUMP) for (const p of problems) console.log(`${p.where}: ${JSON.stringify(p.action)} — ${p.what}`);
      expect(short).toEqual([]);
      expect(problems.slice(0, 40).map((p) => `${p.where}: ${JSON.stringify(p.action)} — ${p.what}`)).toEqual([]);
    }, 120_000);
  }
});

// ---- the disagreements U35 found and fixed (each pinned on a corpus state) ----------------------------------------------------

describe('U35 fixes', () => {
  const find = (what: string, f: (x: Sample) => boolean): Sample => {
    const x = SAMPLES.find(f);
    if (x === undefined) throw new Error(`no corpus state with ${what}`);
    return x;
  };
  const listing = <T extends ActionType>(x: Sample, t: T): Extract<Action, { type: T }>[] =>
    legalActions(x.s, x.content, x.profile, { includeExamine: true }).filter((a): a is Extract<Action, { type: T }> => a.type === t);
  /** Rejected with the same references and one event, and not legal. */
  const refused = (x: Sample, a: Action): boolean => {
    const out = step(x.s, a, x.content, x.profile);
    return out.events.length === 1 && out.events[0]?.t === 'actionRejected' && out.state === x.s && out.profile === x.profile && !isLegal(x.s, a, x.content, x.profile);
  };
  /** Accepted, and legal. */
  const taken = (x: Sample, a: Action): boolean => step(x.s, a, x.content, x.profile).events[0]?.t !== 'actionRejected' && isLegal(x.s, a, x.content, x.profile);
  const defOf = (x: Sample, uid: string) => x.content.items[x.s.player.inventory.find((i) => i.uid === uid)?.itemId ?? '']!;

  test('rest: an unknown kind is refused (it was a short rest)', () => {
    const x = find('a rest spot', (y) => listing(y, 'rest').length > 0);
    expect(refused(x, { type: 'rest', kind: 'long' } as unknown as Action)).toBe(true);
  });

  test('an id naming an Object.prototype member is refused up front (newGame/buy/sell threw; toggleModifier, thresholdSpend, chooseClass took it)', () => {
    const title = find('the title', (y) => y.s.mode === 'title');
    expect(refused(title, { type: 'newGame', name: 'Wayfinder', classId: 'toString' })).toBe(true);
    const loom = find('the Loom', (y) => listing(y, 'toggleModifier').length > 0 && listing(y, 'thresholdSpend').length > 0);
    expect(refused(loom, { type: 'toggleModifier', modifierId: 'toString' })).toBe(true);
    expect(refused(loom, { type: 'thresholdSpend', attunementId: 'constructor' })).toBe(true);
    const shop = find('a merchant', (y) => listing(y, 'buy').length > 0);
    expect(refused(shop, { type: 'buy', merchantId: '__proto__', uid: listing(shop, 'buy')[0]!.uid })).toBe(true);
    expect(reservedParam({ type: 'examine', target: { kind: 'npc', id: 'valueOf' } })).toBe('valueOf');
    expect(reservedParam({ type: 'newGame', name: 'constructor', classId: 'ranger', seed: 'toString' })).toBeNull(); // free text
  });

  test('companionCommand: an unknown command is refused (it was a focus order)', () => {
    const x = find('a focus order', (y) => listing(y, 'companionCommand').some((a) => a.command === 'focus' && a.targetUid !== undefined));
    const focus = listing(x, 'companionCommand').find((a) => a.command === 'focus' && a.targetUid !== undefined)!;
    expect(taken(x, focus)).toBe(true);
    expect(refused(x, { ...focus, command: 'dance' } as unknown as Action)).toBe(true);
  });

  test('commune: a parameter its act does not take is refused (it was ignored)', () => {
    const x = find('a communion', (y) => listing(y, 'commune').some((a) => a.act === 'listen' || a.act === 'resist' || a.act === 'toggle'));
    const acts = listing(x, 'commune');
    for (const a of acts) {
      if (a.act !== 'speak') expect({ a, refused: refused(x, { ...a, answerId: 'x' }) }).toEqual({ a, refused: true });
      if (a.act !== 'offer') expect({ a, refused: refused(x, { ...a, itemId: 'x' }) }).toEqual({ a, refused: true });
    }
    expect(refused(x, { type: 'commune', act: 'sing' } as unknown as Action)).toBe(true);
  });

  test('item: a target for an item that neither heals nor is thrown is refused (it was ignored)', () => {
    const plain = (y: Sample, uid: string): boolean => {
      const def = defOf(y, uid);
      return !def.onUse.some((e) => 'heal' in e) && !def.passives.some((p) => p.kind === 'grantAbility');
    };
    const x = find('a plain combat item', (y) => listing(y, 'item').some((a) => plain(y, a.uid)));
    const use = listing(x, 'item').find((a) => plain(x, a.uid))!;
    for (const c of x.s.combat!.party) expect(refused(x, { ...use, targetUid: c.uid })).toBe(true);
  });

  test('the documented aliases are legal and accepted (legalActions.ts header)', () => {
    const title = find('the title', (y) => y.s.mode === 'title');
    const classId = listing(title, 'newGame')[0]!.classId;
    expect(taken(title, { type: 'newGame', name: 'Tim', classId, seed: 'any' })).toBe(true);
    const explore = find('a run to save', (y) => y.pack === title.pack && y.s.mode === 'explore');
    expect(taken(title, { type: 'load', save: serialize(explore.s, explore.profile, title.content, 'now') })).toBe(true);
    const weapon = find('a weapon to equip', (y) => listing(y, 'equip').some((a) => defOf(y, a.uid).slot === 'weapon'));
    const w = listing(weapon, 'equip').find((a) => defOf(weapon, a.uid).slot === 'weapon')!;
    expect(taken(weapon, { ...w, slot: 'weapon' })).toBe(true);
    const stack = find('a stack to drop', (y) => listing(y, 'drop').some((a) => (y.s.player.inventory.find((i) => i.uid === a.uid)?.qty ?? 0) > 1));
    const d = listing(stack, 'drop').find((a) => (stack.s.player.inventory.find((i) => i.uid === a.uid)?.qty ?? 0) > 1)!;
    expect(taken(stack, { ...d, qty: 1 })).toBe(true);
    const fight = find('an aimed ability', (y) => y.s.mode === 'combat' && listing(y, 'ability').some((a) => a.targetUid !== undefined));
    const aimed = listing(fight, 'ability').find((a) => a.targetUid !== undefined)!;
    expect(taken(fight, { type: 'ability', abilityId: aimed.abilityId })).toBe(true);
  });
});
