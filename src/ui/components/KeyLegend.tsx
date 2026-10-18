// The visible key legend (PLAN §6.6): the keys that work right now, read from the same registry the keys resolve
// against. It lists every layer down to the first modal one, so a panel's legend replaces the screen's. Touch-only
// devices hide it (components.css); `?` opens the full list.
import type { ReactNode } from 'react';
import { keyLabel, legendEntries, type HotkeyLayer } from '../hooks/hotkeys';

export interface LegendItem {
  keys: string[];
  label: string;
}

/** Legend rows for the active layers (top first, stopping after the first modal), without duplicate labels. */
export function legendItems(layers: readonly HotkeyLayer[], max = 8): LegendItem[] {
  const out: LegendItem[] = [];
  for (const layer of layers) {
    for (const entry of legendEntries(layer.map)) {
      if (!out.some((o) => o.label === entry.label)) out.push({ keys: entry.keys, label: entry.label });
    }
    if (layer.modal) break;
  }
  return out.slice(0, max);
}

export function KeyLegend({ layers }: { layers: readonly HotkeyLayer[] }): ReactNode {
  const items = legendItems(layers);
  if (items.length === 0) return null;
  return (
    <ul className="key-legend" aria-label="Keys you can press">
      {items.map((item) => (
        <li key={item.label} className="key-legend__item">
          {item.keys.map((key, i) => (
            <span key={key}>
              {i > 0 ? '/' : ''}
              <kbd>{keyLabel(key)}</kbd>
            </span>
          ))}{' '}
          <span className="key-legend__label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
