// The onboarding container (DESIGN §16.8; U70): reads the game, asks the pure model which hint is due (`pickCallout`),
// shows it in the dock beside the screen, and remembers what was read (`store/tutorials.ts`). A hint closes on the player's
// next action (or a rest, for the camp one), on "Got it", or for good on "Turn tutorials off". The frame gets
// `data-callout="<target>"` while one shows, which the stylesheet uses to light the Guard button, the intent chip, the
// rest row or the clock chip.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { AP_TOAST, pickApToast, pickCallout, type CalloutDef } from '../onboarding/model';
import { onboardingSnapshot } from '../onboarding/snapshot';
import { sharedTutorialStore, type TutorialStore } from '../store/tutorials';
import { useContent, useGame, useGameEvents, useLegal, useProfile, useStore } from '../store/useGame';
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

/**
 * U84a (D-147): on a wide screen the hint floats where it hides neither words nor controls — in explore over the foot of
 * the place's scene band (the pad and the actions never move or hide under it), in a fight over the top of the log column
 * (the stage runs above it, the controls below). A phone keeps it in the dock, above the pinned controls. Null = the stylesheet.
 */
function useCalloutPlacement(id: string | null): CSSProperties | null {
  const mode = useGame((s) => s.mode);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const wide = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 760px)').matches;
    if (id === null || (mode !== 'explore' && mode !== 'combat') || !wide) {
      setStyle(null);
      return undefined;
    }
    const place = (): void => {
      const inset = 8;
      if (mode === 'combat') {
        // a wide fight: over the top of the log column (the stage runs above it, the controls below)
        const side = document.querySelector('.combat[data-layout="wide"] .combat__side')?.getBoundingClientRect();
        setStyle(
          side === undefined || side.width === 0
            ? null
            : { position: 'fixed', left: `${Math.round(side.left)}px`, right: 'auto', top: `${Math.round(side.top)}px`, bottom: 'auto', width: `${Math.round(side.width)}px` },
        );
        return;
      }
      const r = document.querySelector('.explore .place__scene')?.getBoundingClientRect();
      if (r === undefined || r.width === 0) {
        setStyle(null);
        return;
      }
      setStyle({
        position: 'fixed',
        left: `${Math.round(r.left + inset)}px`,
        right: 'auto',
        top: 'auto',
        bottom: `${Math.round(Math.max(inset, window.innerHeight - r.bottom + inset))}px`,
        width: `${Math.round(Math.min(r.width - 2 * inset, 640))}px`,
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [id, mode]);
  return style;
}

export function Callouts(): ReactNode {
  const { callout, dismiss, turnOff } = useCallout();
  useTargetMark(callout);
  const placement = useCalloutPlacement(callout?.id ?? null);
  return (
    <CalloutRegion placement={placement}>
      {callout === null ? null : <CalloutView key={callout.id} callout={callout} onDismiss={dismiss} onTurnOff={turnOff} />}
    </CalloutRegion>
  );
}
