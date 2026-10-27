// The onboarding container (DESIGN §16.8; U70): reads the game, asks the pure model which hint is due (`pickCallout`),
// shows it in the dock beside the screen, and remembers what was read (`store/tutorials.ts`). A hint closes on the player's
// next action (or a rest, for the camp one), on "Got it", or for good on "Turn tutorials off". The frame gets
// `data-callout="<target>"` while one shows, which the stylesheet uses to light the Guard button, the intent chip, the
// rest row or the clock chip.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AP_TOAST, pickApToast, pickCallout, type CalloutDef } from '../onboarding/model';
import { onboardingSnapshot } from '../onboarding/snapshot';
import { sharedTutorialStore, type TutorialStore } from '../store/tutorials';
import { useContent, useGame, useGameEvents, useLegal, useProfile, useStore } from '../store/useGame';
import { createPortal } from 'react-dom';
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

  const snapshot = useMemo(() => onboardingSnapshot(state, content, profile, legal), [state, content, profile, legal]);
  const callout = useMemo(() => pickCallout(snapshot, seen, off), [snapshot, seen, off]);

  // the level-1 AP toast rides the store's notices, once
  const store = useStore();
  const apText = pickApToast(snapshot, seen, off);
  useEffect(() => {
    if (apText === null || tutorials.seen(profileId).has(AP_TOAST.id)) return; // (StrictMode runs an effect twice)
    tutorials.markSeen(profileId, AP_TOAST.id);
    store.notify(apText, 'info');
  }, [apText, tutorials, profileId, store]);

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

/** U84a: a screen's reserved place for the hint (wide explore and combat screens draw it above their log). */
export const CALLOUT_SLOT_ID = 'callout-slot';

/**
 * U84a (D-147): a hint never hides or moves a control. A wide screen reserves room for it just above the log
 * (`#callout-slot`): the log gives way, and the pad, the actions and the turn's controls stay where they are. A phone keeps
 * it in the dock, above the pinned controls (the dock grows upward, so the controls under the thumb stay put).
 */
function useCalloutSlot(id: string | null): HTMLElement | null {
  const mode = useGame((s) => s.mode);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const find = (): void => setSlot(document.getElementById(CALLOUT_SLOT_ID));
    find();
    window.addEventListener('resize', find);
    return () => window.removeEventListener('resize', find);
  }, [id, mode]);
  return slot !== null && slot.isConnected ? slot : null;
}

export function Callouts(): ReactNode {
  const { callout, dismiss, turnOff } = useCallout();
  useTargetMark(callout);
  const slot = useCalloutSlot(callout?.id ?? null);
  const region = <CalloutRegion>{callout === null ? null : <CalloutView key={callout.id} callout={callout} onDismiss={dismiss} onTurnOff={turnOff} />}</CalloutRegion>;
  return slot === null ? region : createPortal(region, slot);
}
