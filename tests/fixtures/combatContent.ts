// Combat fixtures (U23; PLAN §8, §9.1 "later units may append fixtures for their own systems"). Kept beside the shared
// fixture pack rather than inside it so the explore/saves walks keep their map:
//   combatPack()      — the fixture pack plus what DESIGN §4.12's worked example and the combat tests need: the Wildling
//                       Brute, the Traveler's Sword and the other weapon types, the Elf / Warden / Weaver classes, the
//                       Mistwood Path (a return node on the Mistwood wandering pool, east of the Ruins), a table
//                       encounter for `startCombat`, and the Glass / Pacifist modifiers.
//   ScriptedRng, D    — an Rng that returns queued draws (the example's printed rolls), and the draw for each roll kind.
//   scriptedStep      — `step`'s accept path (handlers, post-step hooks) over a ScriptedRng.
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import type { ClassInput } from '@schema/class';
import type { CreatureInput } from '@schema/creature';
import type { EncounterInput } from '@schema/encounter';
import type { ItemInput } from '@schema/item';
import type { LocationInput } from '@schema/location';
import type { ModifierInput } from '@schema/modifier';
import type { RegionInput } from '@schema/region';
import {
  Ctx,
  HANDLERS,
  POST_STEP_HOOKS,
  RejectSignal,
  Rng,
  type Action,
  type GameEvent,
  type GameState,
  type Profile,
  type StepCtx,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { FIXTURE_VERSION, miniContentTables } from './miniContent';

export const MISTWOOD = 'loc_mistwood_path';
export const BRUTE = 'cr_wildling_brute';
export const SHADE = 'cr_corrupted_shade';

/** DESIGN §4.12: L4 fodder, HP 64, ATK 11, armor 3, ward 0, AGI 3; strike → strike → maul → {hp < 50 %: root_knit | strike}. */
const wildlingBrute = {
  id: BRUTE,
  name: 'Wildling Brute',
  legacyName: 'Wildling Brute',
  description: 'A hulking, savage creature from the Mistwood, covered in coarse fur and twisted bark.',
  family: 'fam_wilds',
  materialKin: 'wildling',
  role: 'fodder',
  level: 4,
  stats: { hp: 64, atk: 11, armor: 3, ward: 0, agi: 3 },
  moves: {
    brute_strike: { name: 'Strike', line: 'It swings a knotted fist.', type: 'physical', power: { coef: 1.0, stat: 'atk' } },
    brute_maul: { name: 'Maul', line: 'It rears back with both arms.', type: 'physical', power: { coef: 1.6, stat: 'atk' } },
    brute_root_knit: {
      name: 'Root Knit',
      line: 'Bark creeps over its wounds.',
      statuses: [{ status: 'status_regen', duration: 2, target: 'self', power: { base: 3 } }],
    },
  },
  pattern: [
    { move: 'brute_strike', target: 'player' },
    { move: 'brute_strike', target: 'player' },
    { move: 'brute_maul', target: 'player' },
    { if: { hpBelow: 0.5 }, then: [{ move: 'brute_root_knit', target: 'self' }], else: [{ move: 'brute_strike', target: 'player' }] },
  ],
  loot: [
    { itemId: 'item_ley_touched_tonic', chance: 0.6 },
    { itemId: 'item_wildling_hide_armor', chance: 0.25 },
    { itemId: 'mat_wildling_hide', chance: 0.8 },
  ],
  gold: { min: 11, max: 18 },
  xp: 71,
  bestiary: { voice: 'wayfinder_notes', summary: 'Fixture: the §4.12 Brute.' },
  sigil: { base: 'brute' },
} satisfies CreatureInput;

const items = [
  {
    id: 'item_travelers_sword', name: "Traveler's Sword", legacyName: "Traveler's Sword", type: 'weapon', slot: 'weapon', weaponType: 'melee', tier: 1,
    description: 'A reliable, if unremarkable, blade.', stats: { power: 5 }, value: 20, art: { icon: 'sword' },
  },
  {
    id: 'item_primitive_bow', name: 'Primitive Bow', type: 'weapon', slot: 'weapon', weaponType: 'ranged_bow', tier: 1,
    description: 'Fixture: a bent stave and gut string.', stats: { power: 4 }, value: 12, art: { icon: 'bow' },
  },
  {
    id: 'item_nomads_maul', name: "Nomad's Maul", type: 'weapon', slot: 'weapon', weaponType: 'shield_heavy', tier: 1,
    description: 'Fixture: a hammer the size of a door handle.', stats: { power: 5 }, value: 20, art: { icon: 'maul' },
  },
  {
    id: 'item_cracked_void_focus', name: 'Cracked Void Focus', type: 'weapon', slot: 'weapon', weaponType: 'void_focus', tier: 1,
    description: 'Fixture: a split stone that hums.', stats: { power: 2, spellPower: 2 }, value: 20, art: { icon: 'focus' },
  },
  { id: 'mat_wildling_hide', name: 'Wildling Hide', type: 'material', tier: 1, description: 'Fixture: coarse hide.', value: 4, art: { icon: 'hide' } },
] satisfies ItemInput[];

const branch = (id: string, name: string) => ({ id, name, description: `The ${name} branch.` });

/** DESIGN §3.3 / §5.4–5.6 base stats and resource rules (no trees: the combat tests need only the resources). */
const classes = [
  {
    id: 'elf', name: 'Elf', title: 'ley-duelist', legacy: true, sigil: 'elf', dialogueTag: 'elf', description: 'Fixture.', intro: 'Fixture.',
    baseStats: { hp: 90, mp: 44, strength: 7, magic: 7, agility: 10 },
    growth: { hp: 7, mp: 4 },
    resource: { name: 'Mana', rules: [{ on: 'dodge', amount: 10 }, { on: 'crit', amount: 6 }, { on: 'guard', amount: 5 }] },
    branches: [branch('bladesong', 'Bladesong'), branch('leyweave', 'Leyweave'), branch('shadowstep', 'Shadowstep')],
    starterItems: [{ itemId: 'item_primitive_bow', equip: true }],
  },
  {
    id: 'ironclad_warden', name: 'Ironclad Warden', title: "the Nomads' wall", sigil: 'warden', dialogueTag: 'warden', description: 'Fixture.', intro: 'Fixture.',
    baseStats: { hp: 116, mp: 30, strength: 12, magic: 5, agility: 7 },
    growth: { hp: 11, mp: 2 },
    resource: { name: 'Grit', rules: [{ on: 'hit_taken', amount: 6 }, { on: 'guard', amount: 8 }, { on: 'taunt', amount: 4 }] },
    branches: [branch('bulwark', 'Bulwark'), branch('breaker', 'Breaker'), branch('iron_will', 'Iron Will')],
    starterItems: [{ itemId: 'item_nomads_maul', equip: true }],
  },
  {
    id: 'shadow_weaver', name: 'Shadow Weaver', title: 'void-touched', sigil: 'weaver', dialogueTag: 'weaver', description: 'Fixture.', intro: 'Fixture.',
    baseStats: { hp: 90, mp: 48, strength: 6, magic: 10, agility: 8 },
    growth: { hp: 7, mp: 4 },
    resource: { name: 'Mana', rules: [{ on: 'guard', amount: 5 }], bloodPrice: { hpPerMp: 2 } },
    branches: [branch('hex', 'Hex'), branch('drain', 'Drain'), branch('unmaking', 'Unmaking')],
    starterItems: [{ itemId: 'item_cracked_void_focus', equip: true }],
  },
] satisfies ClassInput[];

/** WORLD §2.2 shape; the return chance is 100 % so a return visit always rolls the pool. */
const mistwood = {
  id: 'region_mistwood_ironclad_reach',
  name: 'Mistwood & the Ironclad Reach',
  description: 'Fixture: the wood past the Ruins.',
  order: 2,
  levelBand: { min: 2, max: 6 },
  legacy: true,
  palette: { bg: '#1E2B1E', bgAlt: '#2F4A2F', fg: '#4F6F4F', accent: '#B5D99C', glow: '#B5D99C' },
  ambient: 'mistwood_rain',
  wanderingPool: [
    { creatureId: BRUTE, weight: 1 },
    { creatureId: SHADE, weight: 1 },
  ],
  returnEncounterChance: 1,
} satisfies RegionInput;

const mistwoodPath = {
  id: MISTWOOD,
  regionId: 'region_mistwood_ironclad_reach',
  name: 'Mistwood Path',
  description: 'Fixture: a muddy trail under dripping branches.',
  exits: [{ dir: 'west', to: 'loc_whispering_ruins' }],
  art: { template: 'forest' },
  map: { x: 8, y: 6 },
} satisfies LocationInput;

/** For `startCombat` effects (ids are global across the table and location encounters). */
const encounters = [{ id: 'enc_brute_ambush', groups: [{ creatureId: BRUTE }], intro: 'Something heavy breaks through the ferns.' }] satisfies EncounterInput[];

const modifiers = [
  { id: 'mod_glass', name: 'Glass', description: 'Everything deals double damage.', rules: [{ kind: 'damage_multiplier', outgoing: 2, incoming: 2 }], icon: 'glass' },
  { id: 'mod_pacifist', name: "Pacifist's Vow", description: 'Kill XP 0.', rules: [{ kind: 'xp_sources', allow: ['quest', 'discovery'] }], icon: 'vow' },
] satisfies ModifierInput[];

/** The combat tables: the fixture's plus the records above (the Ruins gain an exit east to the Mistwood Path). */
export function combatTables(patch: (t: { locations: LocationInput[] }) => void = () => {}): ContentTables {
  const locations: LocationInput[] = miniContentTables.locations.map((loc) =>
    loc.id === 'loc_whispering_ruins' ? { ...clone(loc), exits: [...clone(loc.exits ?? []), { dir: 'east', to: MISTWOOD }] } : clone(loc),
  );
  locations.push(clone(mistwoodPath));
  patch({ locations });
  return {
    ...miniContentTables,
    regions: [...miniContentTables.regions, mistwood],
    locations,
    creatures: [...miniContentTables.creatures, wildlingBrute],
    items: [...miniContentTables.items, ...items],
    classes: [...miniContentTables.classes, ...classes],
    encounters: [...miniContentTables.encounters, ...encounters],
    modifiers: [...miniContentTables.modifiers, ...modifiers],
  };
}

let cached: ContentPack | null = null;

/** The combat pack (built and validated like the fixture pack); `patch` builds an uncached variant. */
export function combatPack(patch?: (t: { locations: LocationInput[] }) => void): ContentPack {
  if (patch) return buildContentPack(combatTables(patch), { version: FIXTURE_VERSION });
  cached ??= buildContentPack(combatTables(), { version: FIXTURE_VERSION });
  return cached;
}

// ---- scripted rolls ---------------------------------------------------------------------------------------------------

/** An Rng whose `next()` returns queued draws in order; running out throws, so a test pins the exact draw count. */
export class ScriptedRng extends Rng {
  readonly queue: number[];
  constructor(draws: readonly number[]) {
    super([1, 2, 3, 4]);
    this.queue = [...draws];
  }
  override next(): number {
    const v = this.queue.shift();
    if (v === undefined) throw new Error('ScriptedRng: out of draws');
    return v;
  }
}

/** The `next()` value that makes each kind of roll come out as wanted (Rng.int/chance/weighted map draws linearly). */
export const D = {
  /** `rng.int(0, 99)` → `roll` (the percentage rolls: hit, crit, status chances). */
  pct: (roll: number): number => (roll + 0.5) / 100,
  /** `rng.int(min, max)` → `k`. */
  int: (k: number, min: number, max: number): number => (k - min + 0.5) / (max - min + 1),
  /** The initiative d4. */
  d4: (k: number): number => (k - 0.5) / 4,
  /** Variance U(0.90, 1.10) → `v`. */
  variance: (v: number): number => (v - 0.9) / 0.2,
  /** `rng.chance(p)` / `weighted` first entry: passes; `no` fails any p < 1. */
  yes: 0,
  no: 0.999999,
};

class ScriptedCtx extends Ctx {
  readonly #scripted: Rng;
  constructor(s: GameState, profile: Profile, content: ContentPack, rng: Rng) {
    super(s, profile, content);
    this.#scripted = rng;
  }
  override get rng(): Rng {
    return this.#scripted;
  }
}

/** A StepCtx over a clone of `state` with scripted draws (for calling setup and pipeline functions directly). */
export function scriptedCtx(state: GameState, draws: readonly number[], content: ContentPack, profile: Profile): StepCtx & { rng: ScriptedRng } {
  return new ScriptedCtx(clone(state), profile, content, new ScriptedRng(draws)) as unknown as StepCtx & { rng: ScriptedRng };
}

export interface ScriptedResult {
  state: GameState;
  events: GameEvent[];
  rejected: string | null;
  /** Draws left unused. */
  left: number;
}

/** `step`'s accept path (the action's handler, then POST_STEP_HOOKS) with scripted draws; no mode gate or freeze. */
export function scriptedStep(state: GameState, action: Action, draws: readonly number[], content: ContentPack, profile: Profile): ScriptedResult {
  const ctx = scriptedCtx(state, draws, content, profile);
  try {
    (HANDLERS[action.type] as (c: StepCtx, a: Action) => void)(ctx, action);
    for (const hook of POST_STEP_HOOKS) hook(ctx);
  } catch (e) {
    if (e instanceof RejectSignal) return { state, events: [], rejected: e.reason, left: ctx.rng.queue.length };
    throw e;
  }
  ctx.s.meta.stepCount += 1;
  return { state: ctx.s, events: ctx.events, rejected: null, left: ctx.rng.queue.length };
}
