// Action union (PLAN §4.4). Every player input is an Action. Actions carry *ids*, never indices, so a recorded
// trace stays valid when the UI reorders lists.
import type { EquipSlot, Stance, StatName, ThresholdArea } from './state';

export type SaveSlot = 1 | 2 | 3 | 'auto';

export type ExamineTarget =
  | { kind: 'item'; uid: string }
  | { kind: 'npc'; id: string }
  | { kind: 'exit'; to: string }
  | { kind: 'location' };

export type Action =
  // meta / shell-facing
  | { type: 'newGame'; name: string; classId: string; seed?: string }
  /** Title (before first explore) and Threshold Far Light. */
  | { type: 'chooseClass'; classId: string }
  /** Engine emits saveRequested; shell performs IO. */
  | { type: 'save'; slot: SaveSlot }
  /** Parsed SaveFile supplied by shell; engine validates + migrates. */
  | { type: 'load'; save: unknown }
  | { type: 'returnToTitle' }
  // explore
  /** Adjacent LocationId (UI maps arrow keys via exit.dir). */
  | { type: 'move'; to: string }
  | { type: 'examine'; target: ExamineTarget }
  | { type: 'take'; uid: string }
  | { type: 'takeAll' }
  /** short = 1 watch +30 % HP/MP; full = to next dawn (DESIGN §2.1, §10.1). */
  | { type: 'rest'; kind: 'short' | 'full' }
  /** Back along the arrival edge, 1 watch, no encounter roll (DESIGN §4.7). */
  | { type: 'retreat' }
  /** Gathering node at this location, 1–2 per day (DESIGN §8.2). U34d: `itemId` names the node where there are several. */
  | { type: 'gather'; itemId?: string }
  | { type: 'talk'; npcId: string }
  /** Library portal during a Horde → closer_escape. */
  | { type: 'enterPortal' }
  /** Content-defined interactable (altar, Heartstone, anchor). */
  | { type: 'interact'; eventId: string }
  /** Advance one watch in place (only where location.rest or tags has 'waitable'). */
  | { type: 'wait' }
  /** D-067.14: at any camp from Loop 2 → endLoop({ closer: 'closer_fall', reason: 'released' }). */
  | { type: 'letGo' }
  /** D-067.14: at a camp; ending E — skips the clock to the last dawn (daysLeft 1). */
  | { type: 'keepVigil' }
  // inventory / character
  | { type: 'use'; uid: string; targetUid?: string }
  | { type: 'equip'; uid: string; slot?: EquipSlot }
  | { type: 'unequip'; slot: EquipSlot }
  | { type: 'drop'; uid: string; qty?: number }
  | { type: 'allocateStat'; stat: StatName }
  | { type: 'unlockAbility'; abilityId: string }
  /** Dark Spellbooks: corruption + unlocks (D-017). */
  | { type: 'readBook'; uid: string }
  /** AP refund at a camp fire, 50 × level gold, once per day (DESIGN §6.3). */
  | { type: 'respec' }
  // economy / crafting
  | { type: 'buy'; merchantId: string; uid: string; qty?: number }
  | { type: 'sell'; merchantId: string; uid: string; qty?: number }
  | { type: 'craft'; recipeId: string }
  /**
   * Rarity tier-up (DESIGN §8.3). U34 (C1 addition): `affixId` picks the new affix slot's affix from the three offered
   * (reducers/crafting.ts `upgradeQuote`); required exactly when the tier-up adds a slot.
   */
  | { type: 'upgrade'; uid: string; affixId?: string }
  /** DESIGN §8.4. */
  | { type: 'salvage'; uid: string }
  // dialogue
  | { type: 'choose'; choiceId: string }
  /** Advance a node that has no choices. */
  | { type: 'continue' }
  /** Used by UI "Accept" buttons when a scene offers a quest without a choice node. */
  | { type: 'acceptQuest'; questId: string }
  // combat
  | { type: 'attack'; targetUid: string }
  /**
   * U84 (C1 addition, D-149 #4): `blood: true` pays the whole MP cost in HP (the Shadow Weaver's Blood price, DESIGN §5.6)
   * even with MP to spare; any Blood-priced cast is empowered (×1.25). A modifier: legalActions lists the plain spelling.
   */
  | { type: 'ability'; abilityId: string; targetUid?: string; blood?: boolean }
  | { type: 'guard' }
  | { type: 'item'; uid: string; targetUid?: string }
  | { type: 'flee' }
  | { type: 'companionCommand'; command: 'signature' | 'focus' | 'hold'; targetUid?: string }
  | { type: 'setStance'; stance: Stance }
  /** Communion choices (DESIGN §4.11). */
  | { type: 'commune'; act: 'toggle' | 'speak' | 'listen' | 'offer' | 'resist'; answerId?: string; itemId?: string }
  /** At rest locations only. */
  | { type: 'swapCompanion'; companionId: string | null }
  // loop / threshold
  /** Advance ending slides; last slide → threshold or title. */
  | { type: 'acknowledgeEnding' }
  | { type: 'thresholdGo'; to: ThresholdArea }
  /** Buy (owned forever). */
  | { type: 'thresholdSpend'; attunementId: string }
  /** Only within the same visit (spentThisVisit). */
  | { type: 'thresholdRefund'; attunementId: string }
  /** Cap 5 equipped (DESIGN §10.7). */
  | { type: 'equipAttunement'; attunementId: string; on: boolean }
  | { type: 'toggleModifier'; modifierId: string }
  /** Far Light → Day 1. */
  | { type: 'newLoop' }
  /** From ending screen after a true ending (D-021). */
  | { type: 'newGamePlus' };

export type ActionType = Action['type'];
/** The variant of `Action` whose `type` is `K` (for reducers that receive a narrowed action). */
export type ActionOf<K extends ActionType> = Extract<Action, { type: K }>;
