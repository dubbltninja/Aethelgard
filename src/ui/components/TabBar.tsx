// The tab bar (DESIGN §16.1; PLAN §6.8's bottom bar): Explore · Journal · Pack · Map · Menu, a `<nav>` of five real buttons.
// Under the 760 px breakpoint it is the bottom bar (≥ 44 px targets, safe-area insets); wider, the same nav sits as a
// toolbar above the key legend, so one set of controls serves every width. It shows on the Explore screen: combat and
// dialogue take over the screen (§16.1) and the Threshold has its own strip. Pure view + a Shell-facing container.
import type { ReactNode } from 'react';
import { Icon } from '../art/Icon';
import { tabBarItems, type TabItem } from '../panels/menuModel';
import { useShell } from '../shellContext';
import { cx } from './Button';

export interface TabBarViewProps {
  tabs: readonly TabItem[];
  onChoose: (tab: TabItem) => void;
}

/** Pure view (no hooks). The current tab says so with `aria-current`, not with colour alone (it is also underlined). */
export function TabBarView({ tabs, onChoose }: TabBarViewProps): ReactNode {
  return (
    <nav className="tab-bar" aria-label="Game menu">
      <ul className="tab-bar__list">
        {tabs.map((tab) => (
          <li key={tab.id} className="tab-bar__cell">
            <button
              type="button"
              className={cx('tab-bar__tab', tab.current && 'tab-bar__tab--current')}
              aria-current={tab.current ? 'page' : undefined}
              disabled={tab.disabled}
              onClick={() => onChoose(tab)}
            >
              <Icon kind={tab.icon} size={22} />
              <span className="tab-bar__label">{tab.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TabBar(): ReactNode {
  const shell = useShell();
  return (
    <TabBarView
      tabs={tabBarItems(shell.canOpen, shell.activePanel)}
      onChoose={(tab) => {
        if (tab.panel === null) {
          shell.closePanel();
          if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
        } else {
          shell.openPanel(tab.panel);
        }
      }}
    />
  );
}
