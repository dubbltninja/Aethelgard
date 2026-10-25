// What the stage's figures do after a step (U73a; DESIGN §17.7; docs/ART-2.md §7). Pure: read from the combat `events[]` the
// screen already receives. One dispatch can carry a whole round (your blow, then each enemy's turn), so the cues are put in
// beats — each turn that did something starts a new beat — and the stage plays them in order with CSS animation delays.
//
//   - lunge: an attacker steps toward its target (heroes right, enemies left);
//   - hit:   a white flash and a ≤ 2 px shake, with the damage number floating from the figure for 600 ms (a crit scales 1.2×
//            once);
//   - ko:    the figure fades and drops;
//   - flare: a boss changes phase.
//
// None of it plays under reduced motion: the stage then draws no cue at all (and themes.css stops every animation besides).
import type { GameEvent } from '@engine/index';

/** One beat's length, ms: long enough to read a lunge and a hit, short enough that a round of four plays in under 2 s. */
export const BEAT_MS = 420;
/** Later beats all start here at the latest, so a long round never leaves the screen animating for seconds. */
export const MAX_BEATS = 5;
/** DESIGN §17.7: damage numbers float for 600 ms. */
export const FLOAT_MS = 600;

export interface HitCue {
  amount: number;
  crit: boolean;
  delay: number;
}

export interface FigureCues {
  /** Ms after the step at which it lunges, if it attacked. */
  lunge: number | null;
  /** Each hit it took (the first one flashes and shakes; each floats its number). */
  hits: HitCue[];
  ko: number | null;
  flare: number | null;
}

export interface StageCues {
  /** Changes with every step, so the same cue on the next step plays again (CSS restarts on the class change). */
  nonce: number;
  byUid: Readonly<Record<string, FigureCues>>;
}

export const NO_CUES: StageCues = { nonce: 0, byUid: {} };

const empty = (): FigureCues => ({ lunge: null, hits: [], ko: null, flare: null });

/** The cues of one step's events. `nonce` is the screen's step counter. */
export function stageCues(events: readonly GameEvent[], nonce: number): StageCues {
  const byUid: Record<string, FigureCues> = {};
  const of = (uid: string): FigureCues => (byUid[uid] ??= empty());
  let beat = 0;
  let busy = false; // something happened in the current beat
  let crit = false;
  const at = (): number => Math.min(beat, MAX_BEATS) * BEAT_MS;
  for (const e of events) {
    switch (e.t) {
      case 'turnStarted':
        if (busy) beat += 1;
        busy = false;
        break;
      case 'attackResolved': {
        const c = of(e.sourceUid);
        if (e.sourceUid !== e.targetUid && c.lunge === null) c.lunge = at();
        crit = e.crit;
        busy = true;
        break;
      }
      case 'damageDealt': {
        if (e.amount <= 0) break;
        // a blow that came without an attack roll (an ability, a foe's intent) still steps in
        if (e.sourceUid !== e.targetUid && e.kind !== 'status' && e.kind !== 'item' && of(e.sourceUid).lunge === null) of(e.sourceUid).lunge = at();
        of(e.targetUid).hits.push({ amount: e.amount, crit: crit && e.kind !== 'status', delay: at() + (e.sourceUid === e.targetUid ? 0 : BEAT_MS / 3) });
        crit = false;
        busy = true;
        break;
      }
      case 'combatantDefeated':
        of(e.uid).ko = at() + BEAT_MS / 2;
        busy = true;
        break;
      case 'bossPhase':
        of(e.uid).flare = at();
        busy = true;
        break;
      default:
        break;
    }
  }
  return { nonce, byUid };
}

/** The animation-name suffix that alternates every step, so CSS restarts an animation the step repeats. */
export const cueParity = (nonce: number): 'a' | 'b' => (nonce % 2 === 0 ? 'a' : 'b');
