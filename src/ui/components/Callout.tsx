// The onboarding callout (DESIGN §16.8; U70): one short hint beside the thing it explains. A `note` that never takes focus
// and never blocks play — the next action dismisses it, or "Got it", or "Turn tutorials off" (the Settings switch too).
// It sits in an always-present polite live region (`Callouts`), so a new hint is read out once. Pure.
import type { ReactNode } from 'react';
import type { CalloutDef } from '../onboarding/model';
import { Icon } from '../art/Icon';
import { Button } from './Button';

export interface CalloutViewProps {
  callout: CalloutDef;
  onDismiss: () => void;
  onTurnOff: () => void;
}

export function CalloutView({ callout, onDismiss, onTurnOff }: CalloutViewProps): ReactNode {
  return (
    <section className="callout" role="note" aria-label={`Hint: ${callout.title}`} data-callout-id={callout.id}>
      <Icon kind="journal" size={20} className="callout__icon" />
      <div className="callout__body">
        <p className="callout__title">{callout.title}</p>
        <p className="callout__text">{callout.text}</p>
      </div>
      <div className="callout__actions">
        <Button variant="secondary" className="callout__dismiss" onClick={onDismiss}>
          Got it
        </Button>
        <Button variant="quiet" className="callout__off" onClick={onTurnOff}>
          Turn tutorials off
        </Button>
      </div>
    </section>
  );
}

/** The always-present live region the hint appears in. */
export function CalloutRegion({ children }: { children?: ReactNode }): ReactNode {
  return (
    <div className="callouts" aria-live="polite" aria-atomic="false">
      {children}
    </div>
  );
}
