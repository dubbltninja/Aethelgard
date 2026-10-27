// The Menu panel (U69): the tab bar's fifth tab. Everything that is not Journal, Pack or Map, as one list of large rows:
// the other reading panels, Saves, Settings, Keys and Return to title. A row opens its panel in place of this one.
// Pattern: container (Shell, store) → pure `MenuList` over `menuModel`.
import type { ReactNode } from 'react';
import { Icon } from '../art/Icon';
import { useShell } from '../shellContext';
import { useStore } from '../store/useGame';
import { menuEntries, type MenuEntry } from './menuModel';

export interface MenuListProps {
  entries: readonly MenuEntry[];
  onChoose: (entry: MenuEntry) => void;
}

/** Pure list (no hooks). The first row carries `data-autofocus`. */
export function MenuList({ entries, onChoose }: MenuListProps): ReactNode {
  return (
    <ul className="menu-list" aria-label="More of the game">
      {entries.map((entry, i) => (
        <li key={entry.id}>
          <button type="button" className="menu-row" onClick={() => onChoose(entry)} data-autofocus={i === 0 ? '' : undefined}>
            <Icon kind={entry.icon} size={22} />
            <span className="menu-row__label">{entry.label}</span>
            <span className="menu-row__hint">{entry.hint}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MenuPanel(): ReactNode {
  const store = useStore();
  const shell = useShell();
  const entries = menuEntries(shell.canOpen, store.isLegal({ type: 'returnToTitle' }));
  return (
    <MenuList
      entries={entries}
      onChoose={(entry) => {
        if (entry.id === 'title') store.dispatch({ type: 'returnToTitle' });
        else shell.openPanel(entry.id);
      }}
    />
  );
}
