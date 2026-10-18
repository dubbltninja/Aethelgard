// The clock chip (DESIGN §16.2, §10.1): Loop 1 shows a small "Day 7 · Dusk"; from Loop 2 the Breach Clock counts the
// dawns left, amber from 10, pulsing from 5 (static under reduced motion), red from 2, bold on the last; inside
// Silverwood Before it shows the echo's Bell. Colour is never the only signal: the text says the same thing, and the
// chip carries one full sentence for screen readers. Pure; the model is `clockModel` (screens/exploreModel.ts).
import type { ReactNode } from 'react';
import { Icon } from '../art/Icon';
import type { ClockModel } from '../screens/exploreModel';

export function ClockWidget({ clock, detail = false }: { clock: ClockModel; detail?: boolean }): ReactNode {
  const icon = clock.kind === 'breach' ? 'clock' : clock.watch === 'Night' || clock.watch === 'Dusk' ? 'night' : 'day';
  return (
    <div className={`clock-chip clock-chip--${clock.kind}`} data-level={clock.level} data-testid="clock-chip">
      <Icon kind={icon} size={18} />
      <span className="sr-only">{clock.label}</span>
      <span className="clock-chip__text" aria-hidden="true">
        {clock.text}
      </span>
      {detail && clock.modifiers.length > 0 ? (
        <ul className="clock-chip__modifiers" aria-label="What has moved the clock">
          {clock.modifiers.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
