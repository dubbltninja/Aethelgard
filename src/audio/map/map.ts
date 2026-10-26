// The engine's events → sounds (PLAN §6.5, DESIGN §18.3). Events stay descriptive (events.ts); this table is the only
// place that decides what is heard. Every `GameEvent` kind has a row — a sound, a rule, or `null` (silent) — and
// tests/unit/audio/map.test.ts fails when a new event kind has none.
//
// One dispatch can carry a whole round, so the cues are put in the same beats as the combat stage (U73a,
// src/ui/art/stageMotion.ts): each turn that did something starts a new beat, and a blow lands a third of a beat in.
// Within a beat, a repeated sound plays once (a multi-hit does not stack ten clicks) and later sounds are staggered a
// little; a step yields at most MAX_CUES. The engine then throttles and caps voices (engine.ts).
import type { EventOf, GameEvent, GameEventType } from '@engine/types/events';
import type { SoundId, SoundParams } from '../sfx/sfx';

export interface Cue extends SoundParams {
  id: SoundId;
  /** Seconds after the step. */
  at: number;
  /** 0..1 loudness (default 1). */
  vel?: number;
  /** −1 (left, the party's side) .. 1 (right, the foes'). */
  pan?: number;
}

type Out = SoundId | Omit<Cue, 'at'> | null;
interface MapCtx {
  /** The pending crit of the attack roll just resolved. */
  crit: boolean;
  /** −1 for the party, 1 for a foe, 0 when unknown. */
  side: (uid: string) => number;
}
type Rule<K extends GameEventType> = Out | ((e: EventOf<K>, x: MapCtx) => Out);

/** U73a's beat (stageMotion.ts BEAT_MS, MAX_BEATS): sound and figures move together. */
export const BEAT = 0.42;
const MAX_BEATS = 5;
const STAGGER = 0.07;
export const MAX_CUES = 10;

const STATUS_TAILS: Record<string, string> = { status_burn: 'burn', status_bleed: 'bleed', status_shock: 'shock' };
const hitOf = (type: string): SoundId => `sfx_hit_${type}` as SoundId;

export const EVENT_SOUNDS: { readonly [K in GameEventType]: Rule<K> } = {
  actionRejected: 'sfx_ui_error',
  log: null,
  modeChanged: null,
  // world & time
  locationEntered: 'sfx_travel',
  locationDiscovered: null,
  watchAdvanced: null,
  dayAdvanced: null,
  clockWarning: (e) => ({ id: 'sfx_clock_warning', ...(e.daysLeft <= 2 ? { variant: 'late' } : {}) }),
  clockChanged: null,
  clockExpired: 'sfx_breach_tear',
  beforeDayAdvanced: null,
  beforeReset: null,
  rested: 'sfx_rest_dawn',
  eventFired: null,
  exitUnlocked: 'sfx_ui_confirm',
  hordeStarted: 'sfx_breach_tear',
  hordeSpread: null,
  encounterScattered: null,
  npcMoved: null,
  // items & economy
  itemTaken: 'sfx_ui_confirm',
  itemGiven: 'sfx_ui_confirm',
  itemLost: null,
  itemEquipped: 'sfx_ui_tick',
  itemUnequipped: 'sfx_ui_back',
  goldChanged: (e) => (e.delta > 0 ? 'sfx_coin' : null),
  purchased: 'sfx_coin',
  sold: 'sfx_coin',
  crafted: 'sfx_forge_hammer',
  upgraded: 'sfx_forge_hammer',
  merchantRestocked: null,
  // character
  xpGained: null,
  levelUp: 'sfx_level_up',
  statAllocated: 'sfx_ui_tick',
  abilityUnlocked: 'sfx_ui_confirm',
  corruptionChanged: (e) => (e.delta > 0 ? { id: 'sfx_hit_void', vel: 0.5 } : null),
  reputationChanged: null,
  // companions
  companionRecruited: 'sfx_ui_confirm',
  companionDismissed: 'sfx_ui_back',
  companionSwapped: 'sfx_ui_tick',
  loyaltyChanged: null,
  companionKo: 'sfx_ko',
  companionDied: 'sfx_ko',
  // combat
  combatStarted: 'sfx_combat_start',
  turnStarted: 'sfx_perc_hat',
  intentRevealed: { id: 'sfx_intent_flip', vel: 0.6 },
  attackResolved: (e, x) => (e.hit ? null : { id: 'sfx_miss', pan: x.side(e.targetUid) }),
  damageDealt: (e, x) => {
    const pan = x.side(e.targetUid);
    if (e.amount <= 0) return e.absorbed > 0 ? { id: 'sfx_guard', pan } : null;
    if (e.kind === 'status') return { id: hitOf(e.damageType), vel: 0.45, pan };
    return x.crit ? { id: 'sfx_crit', variant: e.damageType, pan } : { id: hitOf(e.damageType), pan };
  },
  healed: (e, x) => (e.amount > 0 ? { id: 'sfx_heal', pan: x.side(e.targetUid) } : null),
  statusApplied: (e, x) => {
    if (e.statusId === 'status_shield') return { id: 'sfx_shield_up', pan: x.side(e.targetUid) };
    const tail = STATUS_TAILS[e.statusId];
    return { id: 'sfx_status_apply', pan: x.side(e.targetUid), ...(tail === undefined ? {} : { variant: tail }) };
  },
  statusExpired: (e) => (e.statusId === 'status_shield' ? 'sfx_shield_break' : null),
  statusTicked: null,
  interplay: (e) => (e.rule === 'void_on_shield' ? 'sfx_shield_break' : null),
  guarded: (e, x) => ({ id: 'sfx_guard', pan: x.side(e.uid) }),
  resourceGained: null,
  abilityUsed: null,
  fleeAttempt: (e) => (e.success ? 'sfx_travel' : 'sfx_miss'),
  combatantDefeated: (e, x) => ({ id: 'sfx_ko', pan: x.side(e.uid) }),
  bossPhase: { id: 'sfx_clock_warning', variant: 'late' },
  addsSummoned: { id: 'sfx_combat_start', vel: 0.7 },
  resolveChanged: (e) => {
    if (e.reason.startsWith('listen')) return 'sfx_echo_gain';
    return e.delta > 0 ? { id: 'sfx_resonance', n: e.delta } : e.delta < 0 ? 'sfx_ui_back' : null;
  },
  movementEnded: 'sfx_clock_warning',
  communionRejected: 'sfx_hit_void',
  combatEnded: (e) => (e.result === 'victory' ? 'sfx_victory' : null),
  playerDied: 'sfx_ko',
  // dialogue & quests
  dialogueStarted: null,
  dialogueNode: { id: 'sfx_ui_tick', vel: 0.6 },
  dialogueEnded: null,
  questStarted: 'sfx_ui_confirm',
  questAdvanced: 'sfx_ui_confirm',
  questObjective: (e) => (e.done ? 'sfx_ui_tick' : null),
  questCompleted: { id: 'sfx_victory', vel: 0.7 },
  questFailed: { id: 'sfx_ko', vel: 0.6 },
  heartstoneResolved: 'sfx_echo_gain',
  tyrantResolved: 'sfx_echo_gain',
  // persistence layer (profile)
  echoGained: 'sfx_echo_gain',
  codexUnlocked: 'sfx_resonance',
  bestiaryUpdated: null,
  achievementUnlocked: { id: 'sfx_level_up', vel: 0.8 },
  resonanceGained: (e) => ({ id: 'sfx_resonance', n: e.amount }),
  attunementBought: 'sfx_coin',
  attunementEquipped: (e) => (e.on ? 'sfx_ui_confirm' : 'sfx_ui_back'),
  modifierToggled: 'sfx_ui_tick',
  // loop
  portalEntered: 'sfx_breach_tear',
  loopEnded: { id: 'sfx_clock_warning', variant: 'late' },
  endingReached: 'sfx_echo_gain',
  endingSlide: null,
  loopStarted: 'sfx_rest_dawn',
  thresholdEntered: null,
  // shell requests
  saveRequested: null,
  saveLoaded: null,
  autosaveCheckpoint: null,
};

/** Events that make a beat busy (stageMotion.ts): the next turn starts a new beat after one of these. */
const BUSY = new Set<GameEventType>(['attackResolved', 'damageDealt', 'combatantDefeated', 'bossPhase']);

export type CueMapper = (events: readonly GameEvent[], side?: (uid: string) => number) => Cue[];

/**
 * A mapper keeps one thing between steps: the fight's round, so the kick sounds on each new round (DESIGN §18.3's
 * percussion; the first round has the combat drum instead).
 */
export function createCueMapper(): CueMapper {
  let round = 0;
  return (events, side = () => 0) => {
    const cues: Cue[] = [];
    const seen = new Map<string, Cue>();
    let beat = 0;
    let inBeat = 0;
    let busy = false;
    const x: MapCtx = { crit: false, side };
    const add = (out: Out, extra: number): void => {
      if (out === null || cues.length >= MAX_CUES) return;
      const cue: Cue = { ...(typeof out === 'string' ? { id: out } : out), at: 0 };
      const key = `${beat}:${cue.id}:${cue.variant ?? ''}`;
      const twin = seen.get(key);
      if (twin !== undefined) {
        twin.vel = Math.max(twin.vel ?? 1, cue.vel ?? 1);
        return;
      }
      const perc = cue.id.startsWith('sfx_perc');
      cue.at = Math.min(beat, MAX_BEATS) * BEAT + extra + (perc ? 0 : Math.min(inBeat, 4) * STAGGER);
      if (!perc) inBeat += 1;
      seen.set(key, cue);
      cues.push(cue);
    };
    for (const e of events) {
      if (e.t === 'turnStarted') {
        if (busy) beat += 1;
        busy = false;
        inBeat = 0;
        if (e.round !== round) add('sfx_perc_kick', 0);
        round = e.round;
      } else if (e.t === 'combatStarted') {
        round = 1;
      }
      const rule = EVENT_SOUNDS[e.t] as Rule<typeof e.t>;
      const out = typeof rule === 'function' ? (rule as (e: GameEvent, x: MapCtx) => Out)(e, x) : rule;
      const blow = e.t === 'damageDealt' && e.sourceUid !== e.targetUid;
      add(out, blow ? BEAT / 3 : 0);
      if (e.t === 'attackResolved') x.crit = e.hit && e.crit;
      if (e.t === 'damageDealt') x.crit = false;
      if (BUSY.has(e.t)) busy = true;
    }
    return cues;
  };
}
