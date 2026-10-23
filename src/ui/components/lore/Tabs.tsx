// <Tabs> (PLAN §6.7; the ARIA tabs pattern) for the reading panels: a tablist of real buttons with roving tabindex, ←/→
// (and Home/End) to move between them, and the active one marked `aria-selected`. Each tab names the panel it controls
// (`${idPrefix}-panel`); the caller renders that panel with `role="tabpanel"` and `aria-labelledby={tabId(...)}`. Pure.
import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../Button';

export interface TabItem<Id extends string = string> {
  id: Id;
  label: string;
  /** A count shown beside the label and read with it ("Active, 3"). */
  count?: number | null;
}

export const tabId = (idPrefix: string, id: string): string => `${idPrefix}-tab-${id}`;
export const tabPanelId = (idPrefix: string): string => `${idPrefix}-panel`;

/** The tab a key moves to from `active` (←/→ wrap, Home/End), or null for any other key. */
export function tabKeyTarget<Id extends string>(tabs: readonly TabItem<Id>[], active: Id, key: string): Id | null {
  const at = tabs.findIndex((t) => t.id === active);
  if (at < 0 || tabs.length === 0) return null;
  const pick = (i: number): Id => (tabs[(i + tabs.length) % tabs.length] as TabItem<Id>).id;
  if (key === 'ArrowRight') return pick(at + 1);
  if (key === 'ArrowLeft') return pick(at - 1);
  if (key === 'Home') return pick(0);
  if (key === 'End') return pick(tabs.length - 1);
  return null;
}

export interface TabsProps<Id extends string> {
  tabs: readonly TabItem<Id>[];
  active: Id;
  /** Names the tablist ("Quest groups"). */
  label: string;
  idPrefix: string;
  onSelect: (id: Id) => void;
  className?: string;
}

export function Tabs<Id extends string>({ tabs, active, label, idPrefix, onSelect, className }: TabsProps<Id>): ReactNode {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const next = tabKeyTarget(tabs, active, event.key);
    if (next === null) return;
    event.preventDefault();
    onSelect(next);
    event.currentTarget.parentElement?.querySelector<HTMLElement>(`[id="${tabId(idPrefix, next)}"]`)?.focus();
  };
  return (
    <div className={cx('tabs', className)} role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            className={cx('tab', selected && 'tab--active')}
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix)}
            aria-label={tab.count === null || tab.count === undefined ? tab.label : `${tab.label}, ${tab.count}`}
            tabIndex={selected ? 0 : -1}
            data-autofocus={selected ? '' : undefined}
            onClick={() => onSelect(tab.id)}
            onKeyDown={onKeyDown}
          >
            {tab.label}
            {tab.count === null || tab.count === undefined ? null : <span className="tab__count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
