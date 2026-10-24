// The onboarding model (DESIGN §16.8; U70): which one-time callout, if any, the player should see now. Pure functions of a
// snapshot of the game (what the screen shows) and of what was already seen — so the sequencing, the once-only rule, the
// "Tutorials: off" switch and the Loop 2+ suppression are all unit-tested without React. The container (`Callouts.tsx`)
// builds the snapshot, remembers what was dismissed (`store/tutorials.ts`) and draws `Callout`.
//
// The sequence (DESIGN §16.8):
//   first fight   `intent`   what an intent chip says                     (the fight's first turn)
//                 `guard`    Guard halves the number — the button glows   (after the player's first action)
//   `status`      the first time any status shows: its name and what it does
//   `branching`   the first creature that changes plans below half health (the Wildling Brute)
//   first camp    `camp`     resting carries you to the next dawn          (a camp fire, after the first fight)
//                 `clock`    the clock chip, once: "Days pass. Nothing more — for now."
//   Loop 2        `breach_clock`  the Breach Clock and the Loop Timeline   (the first Explore view from Loop 2)
//                 `echo_glyph`    what an Echo-marked answer is           (the first Echo-tagged dialogue choice)
// From Loop 2 on only the Breach Clock one (and the Echo glyph, which can only exist from there) is ever shown.
import type { Mode } from '@engine/index';

export type CalloutId = 'intent' | 'guard' | 'status' | 'branching' | 'camp' | 'clock' | 'breach_clock' | 'echo_glyph';

/** What the callout points at: the Shell sets `data-callout="<id>"` on the frame and the stylesheet lights the target. */
export type CalloutTarget = 'intent' | 'guard' | 'status' | 'rest' | 'clock' | 'none';

export interface CalloutDef {
  id: CalloutId;
  title: string;
  text: string;
  target: CalloutTarget;
  /** What closes it besides its button: the player's next action (the fight's callouts: "callouts dismiss on action"), or a rest (the camp one). */
  dismissOn: 'action' | 'rest';
}

export const CALLOUTS: Readonly<Record<CalloutId, CalloutDef>> = {
  intent: {
    id: 'intent',
    title: 'Reading an intent',
    text: 'An intent shows what the enemy will do next: type, target, number.',
    target: 'intent',
    dismissOn: 'action',
  },
  guard: {
    id: 'guard',
    title: 'Guard',
    text: 'Guard halves the number and builds your resource.',
    target: 'guard',
    dismissOn: 'action',
  },
  status: {
    id: 'status',
    title: 'A status',
    // the container fills in the status' own name and description
    text: 'A status changes how a fight goes for as long as it lasts.',
    target: 'status',
    dismissOn: 'action',
  },
  branching: {
    id: 'branching',
    title: 'Changing plans',
    text: 'Some creatures change plans below half health.',
    target: 'intent',
    dismissOn: 'action',
  },
  camp: {
    id: 'camp',
    title: 'Camp',
    text: 'Resting carries you to the next dawn. The day counter ticks from Day 1 to Day 2.',
    target: 'rest',
    dismissOn: 'rest',
  },
  clock: {
    id: 'clock',
    title: 'The clock',
    text: 'Days pass. Nothing more — for now.',
    target: 'clock',
    dismissOn: 'action',
  },
  breach_clock: {
    id: 'breach_clock',
    title: 'The Breach Clock',
    text: 'The Breach Clock counts the dawns left before the sky tears open. The Loop Timeline (L) lays every loop side by side.',
    target: 'clock',
    dismissOn: 'action',
  },
  echo_glyph: {
    id: 'echo_glyph',
    title: 'Echo answers',
    text: 'An answer marked Echo draws on something you remember from an earlier loop.',
    target: 'none',
    dismissOn: 'action',
  },
};

/** What the container reads off the screen. Every field is plain data. */
export interface OnboardingSnapshot {
  mode: Mode;
  /** `state.meta.loop`, 1-based. */
  loop: number;
  /** The clock's day, 1-based. */
  day: number;
  combat: CombatSnapshot | null;
  /** Explore: a full rest is legal here and the place is a camp fire or an inn. */
  atCamp: boolean;
  /** The Wayfinder has already won or scattered a fixed fight this loop. */
  firstFightDone: boolean;
  /** Dialogue: the node on screen offers an Echo-tagged answer (usable or greyed). */
  echoChoice: boolean;
  /** Unspent ability points, in half-points (1 AP = 2). */
  apHalf: number;
}

export interface CombatSnapshot {
  /** The combat round (1 = nobody has acted yet). */
  round: number;
  /** An enemy shows an intent. */
  intentShown: boolean;
  /** Guard is enabled. */
  guardEnabled: boolean;
  /** The first status on screen (the player's or an enemy's), if any. */
  status: { id: string; name: string; description: string } | null;
  /** The name of an enemy that changes plans below half health, if one stands. */
  conditional: string | null;
}

/** The empty snapshot (a title screen): nothing to teach. */
export const NOTHING: OnboardingSnapshot = { mode: 'title', loop: 1, day: 1, combat: null, atCamp: false, firstFightDone: false, echoChoice: false, apHalf: 0 };

/** From Loop 2 the only callouts left (DESIGN §16.8: "never appear in Loop 2+ except the Breach Clock one"; the Echo glyph cannot exist before Loop 2). */
export const LOOP_2_PLUS: ReadonlySet<CalloutId> = new Set<CalloutId>(['breach_clock', 'echo_glyph']);

/** Whether `id` may show in `loop` at all. */
export function allowedInLoop(id: CalloutId, loop: number): boolean {
  if (id === 'breach_clock') return loop >= 2;
  return loop <= 1 || LOOP_2_PLUS.has(id);
}

/** The candidates in the order they are offered; the first whose moment has come and that was not seen wins. */
const ORDER: readonly CalloutId[] = ['intent', 'guard', 'status', 'branching', 'camp', 'clock', 'breach_clock', 'echo_glyph'];

function due(id: CalloutId, s: OnboardingSnapshot, seen: ReadonlySet<string>): boolean {
  const fight = s.combat;
  switch (id) {
    case 'intent':
      return s.mode === 'combat' && fight !== null && fight.round <= 1 && fight.intentShown;
    case 'guard':
      return s.mode === 'combat' && fight !== null && fight.round >= 2 && fight.guardEnabled;
    case 'status':
      return s.mode === 'combat' && fight?.status != null;
    case 'branching':
      return s.mode === 'combat' && fight?.conditional != null;
    case 'camp':
      return s.mode === 'explore' && s.atCamp && s.firstFightDone;
    case 'clock':
      return s.mode === 'explore' && seen.has('camp') && s.day >= 2;
    case 'breach_clock':
      return s.mode === 'explore';
    case 'echo_glyph':
      return s.mode === 'dialogue' && s.echoChoice;
  }
}

/** The callout to show now, or null: tutorials off, nothing due, or everything due was already seen. */
export function pickCallout(snapshot: OnboardingSnapshot, seen: ReadonlySet<string>, off: boolean): CalloutDef | null {
  if (off) return null;
  for (const id of ORDER) {
    if (seen.has(id) || !allowedInLoop(id, snapshot.loop) || !due(id, snapshot, seen)) continue;
    const def = CALLOUTS[id];
    if (id === 'status' && snapshot.combat?.status != null) {
      const st = snapshot.combat.status;
      return { ...def, title: st.name, text: `${st.name}: ${st.description}` };
    }
    if (id === 'branching' && snapshot.combat?.conditional != null) {
      return { ...def, text: `${snapshot.combat.conditional}: ${def.text}` };
    }
    return def;
  }
  return null;
}

/**
 * Whether `snapshot` has moved on so that the shown callout no longer applies (the fight ended, the player left Explore):
 * the container drops a stale callout without marking it seen, so it comes back at its next moment.
 */
export function stillApplies(def: CalloutDef, snapshot: OnboardingSnapshot, seen: ReadonlySet<string>): boolean {
  return due(def.id, snapshot, seen) && allowedInLoop(def.id, snapshot.loop);
}

/** The level-1 AP toast (DESIGN §16.8: "the level-1 AP toast explains tiers"). A toast, not a callout: it rides the notices. */
export const AP_TOAST = { id: 'ap_toast', text: 'You have an ability point to spend. Abilities open in tiers: more open at levels 4, 8, 12 and 16.' } as const;

/** The AP toast's text when it is due: Loop 1, on the map, with a point to spend, tutorials on, not yet shown. */
export function pickApToast(snapshot: OnboardingSnapshot, seen: ReadonlySet<string>, off: boolean): string | null {
  if (off || seen.has(AP_TOAST.id) || snapshot.loop > 1 || snapshot.mode !== 'explore' || snapshot.apHalf <= 0) return null;
  return AP_TOAST.text;
}
