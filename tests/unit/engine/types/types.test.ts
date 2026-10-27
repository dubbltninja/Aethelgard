// U11: the engine types compile, serialize, and the GameStateSchema stub round-trips hand-made states.
// Compile-time checks (exhaustiveness, JSON-safety) run under `npm run typecheck`; bun runs the value checks.
import { describe, expect, test } from 'bun:test';
import { GameStateSchema, type Action, type GameEvent, type GameState, type Profile } from '@engine/index';
import type { ActionOf, EventOf, LocationId, QuestId } from '@engine/types';
import { fullProfile, fullState, minimalProfile, minimalState } from './handmade';

// ---- compile-time: every Action['type'] and GameEvent['t'] listed exactly once (missing or extra keys fail tsc) ----

const ACTION_TYPES: Record<Action['type'], true> = {
  newGame: true, chooseClass: true, save: true, load: true, returnToTitle: true,
  move: true, examine: true, take: true, takeAll: true, rest: true, retreat: true, gather: true, talk: true,
  enterPortal: true, interact: true, wait: true, letGo: true, keepVigil: true,
  use: true, equip: true, unequip: true, drop: true, allocateStat: true, unlockAbility: true, readBook: true, respec: true,
  buy: true, sell: true, craft: true, upgrade: true, salvage: true,
  choose: true, continue: true, acceptQuest: true,
  attack: true, ability: true, guard: true, item: true, flee: true, companionCommand: true, setStance: true,
  commune: true, swapCompanion: true,
  acknowledgeEnding: true, thresholdGo: true, thresholdSpend: true, thresholdRefund: true, equipAttunement: true,
  toggleModifier: true, newLoop: true, newGamePlus: true,
};

const EVENT_TYPES: Record<GameEvent['t'], true> = {
  actionRejected: true, log: true, modeChanged: true,
  locationEntered: true, locationDiscovered: true, watchAdvanced: true, dayAdvanced: true, clockWarning: true,
  clockChanged: true, clockExpired: true, beforeDayAdvanced: true, beforeReset: true, rested: true, eventFired: true,
  exitUnlocked: true, hordeStarted: true, hordeSpread: true, encounterScattered: true, npcMoved: true,
  itemTaken: true, itemGiven: true, itemLost: true, itemEquipped: true, itemUnequipped: true, goldChanged: true,
  purchased: true, sold: true, crafted: true, upgraded: true, merchantRestocked: true,
  xpGained: true, levelUp: true, statAllocated: true, abilityUnlocked: true, corruptionChanged: true, reputationChanged: true,
  companionRecruited: true, companionDismissed: true, companionSwapped: true, loyaltyChanged: true, companionKo: true,
  companionDied: true,
  combatStarted: true, turnStarted: true, intentRevealed: true, attackResolved: true, damageDealt: true, healed: true,
  statusApplied: true, statusExpired: true, statusTicked: true, interplay: true, guarded: true, resourceGained: true,
  abilityUsed: true, fleeAttempt: true, combatantDefeated: true, bossPhase: true, addsSummoned: true, resolveChanged: true,
  movementEnded: true, communionRejected: true, combatEnded: true, playerDied: true,
  dialogueStarted: true, dialogueNode: true, dialogueEnded: true, questStarted: true, questAdvanced: true,
  questObjective: true, questCompleted: true, questFailed: true, heartstoneResolved: true, tyrantResolved: true,
  echoGained: true, codexUnlocked: true, bestiaryUpdated: true, achievementUnlocked: true, resonanceGained: true,
  attunementBought: true, attunementEquipped: true, modifierToggled: true,
  portalEntered: true, loopEnded: true, endingReached: true, endingSlide: true, loopStarted: true, thresholdEntered: true,
  saveRequested: true, saveLoaded: true, autosaveCheckpoint: true,
};

/** A switch that must handle every action type; adding an Action without a case is a tsc error at `never`. */
function actionArea(a: Action): 'meta' | 'explore' | 'character' | 'economy' | 'dialogue' | 'combat' | 'loop' {
  switch (a.type) {
    case 'newGame': case 'chooseClass': case 'save': case 'load': case 'returnToTitle':
      return 'meta';
    case 'move': case 'examine': case 'take': case 'takeAll': case 'rest': case 'retreat': case 'gather': case 'talk':
    case 'enterPortal': case 'interact': case 'wait': case 'letGo': case 'keepVigil':
      return 'explore';
    case 'use': case 'equip': case 'unequip': case 'drop': case 'allocateStat': case 'unlockAbility': case 'readBook':
    case 'respec':
      return 'character';
    case 'buy': case 'sell': case 'craft': case 'upgrade': case 'salvage':
      return 'economy';
    case 'choose': case 'continue': case 'acceptQuest':
      return 'dialogue';
    case 'attack': case 'ability': case 'guard': case 'item': case 'flee': case 'companionCommand': case 'setStance':
    case 'commune': case 'swapCompanion':
      return 'combat';
    case 'acknowledgeEnding': case 'thresholdGo': case 'thresholdSpend': case 'thresholdRefund': case 'equipAttunement':
    case 'toggleModifier': case 'newLoop': case 'newGamePlus':
      return 'loop';
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

// ---- compile-time: GameState / Profile / Action / GameEvent hold only JSON values ----

type Primitive = string | number | boolean | null;
type NotJson = ((...args: never[]) => unknown) | Date | Map<unknown, unknown> | Set<unknown> | RegExp | bigint | symbol | undefined;
/** The non-JSON types reachable inside T (never = all JSON). `unknown` placeholders (Effect[] until U14) pass. */
type NonJson<T, D extends unknown[] = []> = D['length'] extends 12
  ? never
  : unknown extends T
    ? never
    : T extends Primitive
      ? never
      : T extends NotJson
        ? T
        : T extends readonly (infer U)[]
          ? NonJson<U, [...D, 1]>
          : T extends object
            ? { [K in keyof T]-?: NonJson<Exclude<T[K], undefined>, [...D, 1]> }[keyof T]
            : T;
type AssertNever<T extends never> = T;
export type JsonChecks = [
  AssertNever<NonJson<GameState>>,
  AssertNever<NonJson<Profile>>,
  AssertNever<NonJson<Action>>,
  AssertNever<NonJson<GameEvent>>,
  // the checker itself works:
  // @ts-expect-error — a Date is not JSON
  AssertNever<NonJson<{ when: Date }>>,
  // @ts-expect-error — nor is a Map nested in an array
  AssertNever<NonJson<{ list: Map<string, number>[] }>>,
];

// ---- compile-time: typed ids and narrowing helpers ----

export function idProbes(): unknown[] {
  const loc: LocationId = 'loc_whispering_ruins';
  const quest: QuestId = 'q_clear_path';
  const move: ActionOf<'move'> = { type: 'move', to: loc };
  const ev: EventOf<'questStarted'> = { t: 'questStarted', questId: quest };
  return [
    move,
    ev,
    // @ts-expect-error — wrong prefix
    ((): LocationId => 'cr_wildling_brute')(),
    // @ts-expect-error — `letGo` carries no fields
    { type: 'letGo', reason: 'released' } satisfies Action,
    // @ts-expect-error — events use `t`, not `type`
    { type: 'clockExpired' } satisfies GameEvent,
  ];
}

// ---- runtime ----

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('engine types (U11)', () => {
  test('every Action type and GameEvent t is listed once', () => {
    expect(Object.keys(ACTION_TYPES)).toHaveLength(51);
    expect(Object.keys(EVENT_TYPES)).toHaveLength(91);
    expect(actionArea({ type: 'letGo' })).toBe('explore');
    expect(actionArea({ type: 'commune', act: 'listen' })).toBe('combat');
    expect(actionArea({ type: 'newGamePlus' })).toBe('loop');
    expect(idProbes()).toHaveLength(5);
  });

  for (const [name, make] of [['minimal', minimalState], ['full', fullState]] as const) {
    test(`${name} GameState survives JSON and structuredClone unchanged`, () => {
      const s = make();
      expect(roundTrip(s)).toStrictEqual(s);
      expect(structuredClone(s)).toStrictEqual(s);
    });

    test(`${name} GameState round-trips through GameStateSchema`, () => {
      const s = make();
      const parsed = GameStateSchema.parse(roundTrip(s));
      expect(parsed).toStrictEqual(s);
    });
  }

  for (const [name, make] of [['minimal', minimalProfile], ['full', fullProfile]] as const) {
    test(`${name} Profile survives JSON and structuredClone unchanged`, () => {
      const p = make();
      expect(roundTrip(p)).toStrictEqual(p);
      expect(structuredClone(p)).toStrictEqual(p);
    });
  }

  test('every action and event value survives JSON', () => {
    const actions: Action[] = [
      { type: 'newGame', name: 'W', classId: 'ranger', seed: 's' },
      { type: 'examine', target: { kind: 'exit', to: 'loc_mistwood_path' } },
      { type: 'commune', act: 'offer', itemId: 'item_amulet_of_echoes' },
      { type: 'swapCompanion', companionId: null },
      { type: 'save', slot: 'auto' },
    ];
    const events: GameEvent[] = [
      { t: 'actionRejected', action: { type: 'flee' }, reason: 'boss' },
      { t: 'intentRevealed', uid: 'c30', intent: { moveId: 'm', targetUid: null, projected: [1, 2], hidden: true, text: '?', tags: [] } },
      { t: 'loopEnded', loop: 2, outcome: 'closer_fall', reason: 'released', record: fullProfile().runHistory[1]! },
      { t: 'thresholdEntered', area: 'far_light' },
    ];
    expect(roundTrip(actions)).toStrictEqual(actions);
    expect(roundTrip(events)).toStrictEqual(events);
  });

  describe('GameStateSchema rejects malformed states with a readable path', () => {
    const issuesOf = (value: unknown): string[] => {
      const result = GameStateSchema.safeParse(value);
      return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    };

    test('unknown key', () => {
      const bad = { ...minimalState(), player: { ...minimalState().player, mana: 3 } };
      expect(issuesOf(bad).join('\n')).toContain('player: Unrecognized key(s) in object');
    });

    test('missing key', () => {
      const rest: Partial<GameState> = minimalState();
      delete rest.clock;
      expect(issuesOf(rest).join('\n')).toContain('clock: Required');
    });

    test('all-zero rng state', () => {
      expect(issuesOf({ ...minimalState(), rng: [0, 0, 0, 0] })).toEqual(['rng: rng state must not be all zero']);
    });

    test('rng word outside uint32', () => {
      expect(issuesOf({ ...minimalState(), rng: [1, 2, 3, 2 ** 32] })[0]).toMatch(/^rng\.3:/);
    });

    test('bad ending id and reason', () => {
      const bad = { ...minimalState(), pendingEnding: { outcome: 'ending', reason: 'bored', slideIndex: 0 } };
      const issues = issuesOf(bad).join('\n');
      expect(issues).toContain('pendingEnding.outcome');
      expect(issues).toContain('pendingEnding.reason');
    });

    test('a valid ending id passes', () => {
      const ok = { ...minimalState(), pendingEnding: { outcome: 'ending_mending', slideIndex: 2 } };
      expect(issuesOf(ok)).toEqual([]);
    });

    test('non-finite numbers are rejected (JSON cannot carry them)', () => {
      const s = minimalState();
      s.player.hp = Number.NaN;
      expect(issuesOf(s)[0]).toMatch(/^player\.hp:/);
    });
  });
});
