// The onboarding container (DESIGN §16.8; U70): reads the game, asks the pure model which hint is due (`pickCallout`),
// shows it in the dock beside the screen, and remembers what was read (`store/tutorials.ts`). A hint closes on the player's
// next action (or a rest, for the camp one), on "Got it", or for good on "Turn tutorials off". The frame gets
// `data-callout="<target>"` while one shows, which the stylesheet uses to light the Guard button, the intent chip, the
// rest row or the clock chip.
import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { pickCallout, type CalloutDef } from '../onboarding/model';
import { onboardingSnapshot } from '../onboarding/snapshot';
import { sharedTutorialStore, type TutorialStore } from '../store/tutorials';
import { useContent, useGame, useGameEvents, useLegal, useProfile } from '../store/useGame';
import { CalloutRegion, CalloutView } from './Callout';

/** The callout the game calls for right now (null when none), with the tutorial state it was picked under. */
export function useCallout(tutorials: TutorialStore = sharedTutorialStore()): { callout: CalloutDef | null; dismiss: () => void; turnOff: () => void } {
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  const legal = useLegal();
  const profileId = profile.profileId;
  const seen = useSyncExternalStore(tutorials.subscribe, () => tutorials.seen(profileId), () => tutorials.seen(profileId));
  const off = useSyncExternalStore(tutorials.subscribe, tutorials.off, tutorials.off);

  const callout = useMemo(() => pickCallout(onboardingSnapshot(state, content, profile, legal), seen, off), [state, content, profile, legal, seen, off]);

  // the next action reads the hint (a rejected one does not)
  const current = useRef(callout);
  current.current = callout;
  useGameEvents((events) => {
    const shown = current.current;
    if (shown === null || events.some((e) => e.t === 'actionRejected')) return;
    if (shown.dismissOn === 'rest' ? events.some((e) => e.t === 'rested') : events.length > 0) tutorials.markSeen(profileId, shown.id);
  });

  return {
    callout,
    dismiss: () => {
      if (callout !== null) tutorials.markSeen(profileId, callout.id);
    },
    turnOff: () => tutorials.setOff(true),
  };
}

/** Marks the frame (`.app`) with what the hint points at, so the stylesheet can light it. */
function useTargetMark(callout: CalloutDef | null): void {
  const id = callout?.id ?? null;
  const target = callout?.target ?? null;
  useEffect(() => {
    const frame = document.querySelector<HTMLElement>('.app');
    if (frame === null || id === null || target === null || target === 'none') return undefined;
    frame.dataset.callout = target;
    return () => {
      delete frame.dataset.callout;
    };
  }, [id, target]);
}

export function Callouts(): ReactNode {
  const { callout, dismiss, turnOff } = useCallout();
  useTargetMark(callout);
  return <CalloutRegion>{callout === null ? null : <CalloutView key={callout.id} callout={callout} onDismiss={dismiss} onTurnOff={turnOff} />}</CalloutRegion>;
}
