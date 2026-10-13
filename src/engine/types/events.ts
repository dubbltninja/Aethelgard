// GameEvent union (PLAN §4.5). Events are the engine's only channel to UI, audio and logs. They are *descriptive*
// (what happened), never *imperative* (no "play sound X"). Every event has `t: string` (its type) so UI switch
// statements are exhaustive.
import type { Action, SaveSlot } from './actions';
import type { RunRecord } from './profile';
import type {
  DamageType,
  EndingPending,
  EquipSlot,
  FactionId,
  HeartstoneState,
  Intent,
  ItemInstance,
  LogEntry,
  Mode,
  StatName,
  ThresholdArea,
  TyrantState,
  Watch,
} from './state';

export type AutosaveReason = 'locationEntered' | 'combatEnded' | 'dayAdvanced' | 'questCompleted' | 'rest';

export type GameEvent =
  | { t: 'actionRejected'; action: Action; reason: string }
  | { t: 'log'; text: string; kind: LogEntry['kind'] }
  | { t: 'modeChanged'; from: Mode; to: Mode }
  // world & time
  | { t: 'locationEntered'; locationId: string; firstVisit: boolean; regionId: string }
  | { t: 'locationDiscovered'; locationId: string }
  | { t: 'watchAdvanced'; day: number; watch: Watch }
  | { t: 'dayAdvanced'; day: number; daysLeft: number }
  /** Emitted at 10, 5, 2, 1 dawns left (DESIGN §10.1). */
  | { t: 'clockWarning'; daysLeft: number }
  | { t: 'clockChanged'; deltaWatches: number; limitTicks: number; floored: boolean }
  | { t: 'clockExpired' }
  | { t: 'beforeDayAdvanced'; day: 1 | 2 | 3; resets: number }
  | { t: 'beforeReset'; resets: number }
  | { t: 'rested'; locationId: string; hpRestored: number; mpRestored: number }
  | { t: 'eventFired'; locationId: string; eventId: string; text: string }
  | { t: 'exitUnlocked'; from: string; to: string }
  | { t: 'hordeStarted'; cause: 'tyrant' | 'expiry'; delay: number }
  | { t: 'hordeSpread'; infected: string[] }
  | { t: 'encounterScattered'; locationId: string; encounterId: string }
  | { t: 'npcMoved'; npcId: string; to: string | null }
  // items & economy
  | { t: 'itemTaken'; item: ItemInstance }
  | { t: 'itemGiven'; item: ItemInstance; source: string }
  | { t: 'itemLost'; itemId: string; qty: number; reason: 'used' | 'sold' | 'dropped' | 'taken' | 'crafted' }
  | { t: 'itemEquipped'; slot: EquipSlot; item: ItemInstance }
  | { t: 'itemUnequipped'; slot: EquipSlot }
  | { t: 'goldChanged'; delta: number; total: number }
  | { t: 'purchased'; itemId: string; price: number }
  | { t: 'sold'; itemId: string; price: number }
  | { t: 'crafted'; recipeId: string; item: ItemInstance }
  | { t: 'upgraded'; item: ItemInstance }
  | { t: 'merchantRestocked'; merchantId: string }
  // character
  | { t: 'xpGained'; amount: number }
  | { t: 'levelUp'; level: number; statPoints: number; apHalf: number }
  | { t: 'statAllocated'; stat: StatName; value: number }
  | { t: 'abilityUnlocked'; abilityId: string }
  | { t: 'corruptionChanged'; value: number; delta: number }
  | { t: 'reputationChanged'; faction: FactionId; delta: number; value: number; tierBefore: string; tierAfter: string }
  // companions
  | { t: 'companionRecruited'; companionId: string }
  | { t: 'companionDismissed'; companionId: string }
  | { t: 'companionSwapped'; activeId: string | null }
  | { t: 'loyaltyChanged'; companionId: string; delta: number; value: number }
  | { t: 'companionKo'; companionId: string }
  | { t: 'companionDied'; companionId: string }
  // combat
  | { t: 'combatStarted'; encounterId: string; enemies: { uid: string; creatureId: string }[]; ambush: boolean }
  | { t: 'turnStarted'; uid: string; round: number }
  | { t: 'intentRevealed'; uid: string; intent: Intent }
  | { t: 'attackResolved'; sourceUid: string; targetUid: string; hit: boolean; crit: boolean }
  | {
      t: 'damageDealt';
      sourceUid: string;
      targetUid: string;
      amount: number;
      damageType: DamageType;
      mitigated: number;
      absorbed: number;
      kind: 'basic' | 'ability' | 'status' | 'item' | 'intent';
      refId: string | null;
    }
  | { t: 'healed'; targetUid: string; amount: number; source: string }
  | { t: 'statusApplied'; targetUid: string; statusId: string; stacks: number; duration: number }
  | { t: 'statusExpired'; targetUid: string; statusId: string }
  | { t: 'statusTicked'; targetUid: string; statusId: string; amount: number }
  /** 'storm_on_soaked', 'fire_on_soaked', 'chrono_on_haste', 'void_on_shield' … */
  | { t: 'interplay'; rule: string; targetUid: string }
  | { t: 'guarded'; uid: string }
  | { t: 'resourceGained'; uid: string; amount: number; reason: string }
  | { t: 'abilityUsed'; uid: string; abilityId: string }
  | { t: 'fleeAttempt'; success: boolean; chance: number }
  | { t: 'combatantDefeated'; uid: string; refId: string }
  | { t: 'bossPhase'; uid: string; phase: number; text: string }
  | { t: 'addsSummoned'; uids: string[] }
  | { t: 'resolveChanged'; delta: number; value: number; movement: 1 | 2 | 3; reason: string }
  | { t: 'movementEnded'; movement: 1 | 2 | 3; resolve: number }
  | { t: 'communionRejected'; reason: 'resolve' | 'lies' }
  | { t: 'combatEnded'; result: 'victory' | 'defeat' | 'fled'; rounds: number; xp: number; gold: number; loot: ItemInstance[] }
  | { t: 'playerDied'; loop: number }
  // dialogue & quests
  | { t: 'dialogueStarted'; sceneId: string; npcId: string | null }
  | { t: 'dialogueNode'; nodeId: string; speaker: string; text: string }
  | { t: 'dialogueEnded'; sceneId: string }
  | { t: 'questStarted'; questId: string }
  | { t: 'questAdvanced'; questId: string; stage: string; journal: string }
  | { t: 'questObjective'; questId: string; objectiveId: string; done: boolean }
  | { t: 'questCompleted'; questId: string }
  | { t: 'questFailed'; questId: string }
  | { t: 'heartstoneResolved'; outcome: HeartstoneState }
  | { t: 'tyrantResolved'; outcome: TyrantState }
  // persistence layer (profile)
  | { t: 'echoGained'; echoId: string; firstEver: boolean }
  | { t: 'codexUnlocked'; codexId: string }
  | { t: 'bestiaryUpdated'; creatureId: string; field: 'seen' | 'killed' | 'intent' | 'weakness' }
  | { t: 'achievementUnlocked'; achievementId: string }
  | { t: 'resonanceGained'; amount: number; reason: string; total: number }
  | { t: 'attunementBought'; attunementId: string }
  | { t: 'attunementEquipped'; attunementId: string; on: boolean }
  | { t: 'modifierToggled'; modifierId: string; on: boolean }
  // loop
  | { t: 'portalEntered' }
  | { t: 'loopEnded'; loop: number; outcome: EndingPending['outcome']; reason?: EndingPending['reason']; record: RunRecord }
  | { t: 'endingReached'; endingId: string }
  | { t: 'endingSlide'; endingId: string; index: number; text: string }
  | { t: 'loopStarted'; loop: number; classId: string }
  | { t: 'thresholdEntered'; area: ThresholdArea }
  // shell requests
  | { t: 'saveRequested'; slot: SaveSlot }
  | { t: 'saveLoaded'; version: number; migratedFrom: number | null }
  | { t: 'autosaveCheckpoint'; reason: AutosaveReason };

export type GameEventType = GameEvent['t'];
/** The variant of `GameEvent` whose `t` is `K`. */
export type EventOf<K extends GameEventType> = Extract<GameEvent, { t: K }>;
