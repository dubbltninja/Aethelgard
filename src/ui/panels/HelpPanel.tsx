// The `?` overlay (PLAN §6.6 HelpPanel, DESIGN §16.4): every key that works right now, grouped by the map that
// declares it, rendered from the live hotkey registry (single source of truth). Its own Esc layer is left out.
import type { ReactNode } from 'react';
import { keyLabel, legendEntries, type HotkeyLayer } from '../hooks/hotkeys';
import { useHotkeyLayers } from '../hooks/useHotkeys';

export function HelpList({ layers }: { layers: readonly HotkeyLayer[] }): ReactNode {
  const groups = layers.map((layer) => ({ layer, entries: legendEntries(layer.map) })).filter((g) => g.entries.length > 0);
  if (groups.length === 0) return <p>No keys are active here.</p>;
  return (
    <div className="help-list">
      {groups.map(({ layer, entries }) => (
        <section key={layer.id} className="help-list__group" aria-labelledby={`help-${layer.id}`}>
          <h3 id={`help-${layer.id}`} className="help-list__scope">
            {layer.scope}
          </h3>
          <dl className="help-list__keys">
            {entries.map((entry) => (
              <div key={entry.label} className="help-list__row">
                <dt>
                  {entry.keys.map((key, i) => (
                    <span key={key}>
                      {i > 0 ? ' or ' : ''}
                      <kbd>{keyLabel(key)}</kbd>
                    </span>
                  ))}
                </dt>
                <dd>{entry.label}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** The layers under the help panel's own (it is the top modal layer while open). */
export function HelpPanel(): ReactNode {
  const layers = useHotkeyLayers();
  return (
    <>
      <p className="panel-intro">Keys work anywhere except while you are typing in a field. In a fight, panel keys need Shift.</p>
      <HelpList layers={layers.slice(1)} />
    </>
  );
}
