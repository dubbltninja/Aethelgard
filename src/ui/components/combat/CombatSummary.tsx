// After a fight (DESIGN §4.1, §16.5): a victory, a flight or an arrest takes the game back to explore at once (the engine
// closes the fight in the same step), so the summary is a dialog over the Explore screen — what was won (XP, gold, loot,
// level-ups) or that you got away — opened from that step's `combatEnded`. The Loop 1 FALLEN screen is the Combat screen's
// own (the fight stays on screen in phase 'defeat'); a Fall in Loop 2+ goes to the ending screens. App renders
// <CombatAftermath/> beside the screen. `CombatSummaryView` is pure.
import { useState, type ReactNode } from 'react';
import { focusView } from '../../a11y/focus';
import { Icon } from '../../art/Icon';
import { aftermathModel, type AftermathModel } from '../../screens/combatModel';
import { useContent, useGameEvents } from '../../store/useGame';
import { Button } from '../Button';
import { Modal } from '../Modal';

export function CombatSummaryView({ summary, onContinue }: { summary: AftermathModel; onContinue: () => void }): ReactNode {
  return (
    <div className={`combat-summary combat-summary--${summary.result}`} data-result={summary.result}>
      <ul className="combat-summary__lines">
        {summary.lines.map((line, i) => (
          <li key={`${i}:${line}`}>
            {i === 0 ? null : <Icon kind={line.startsWith('+') && line.endsWith('gold') ? 'gold' : line.startsWith('+') ? 'xp' : line.startsWith('Level') ? 'level' : 'item'} size={18} />}
            {line}
          </li>
        ))}
      </ul>
      <div className="button-row">
        <Button variant="primary" onClick={onContinue} data-autofocus="">
          Continue
        </Button>
      </div>
    </div>
  );
}

/** Listens for the end of a fight and shows its summary until the player continues. */
export function CombatAftermath(): ReactNode {
  const content = useContent();
  const [summary, setSummary] = useState<AftermathModel | null>(null);
  useGameEvents((events, state) => {
    if (state.mode !== 'explore') return;
    const next = aftermathModel(events, content);
    if (next !== null) setSummary(next);
  });
  if (summary === null) return null;
  const close = (): void => {
    setSummary(null);
    // the opener (an ability tile) left with the fight: give focus back to the screen
    requestAnimationFrame(() => focusView(document.getElementById('main')));
  };
  return (
    <Modal title={summary.title} onClose={close} level="dialog" className="combat-summary-dialog" hideClose>
      <CombatSummaryView summary={summary} onContinue={close} />
    </Modal>
  );
}
