// The button every management panel shares (Inventory, Abilities, Merchant, Forge, Camp; D-104, D-107): a label, the engine
// action it dispatches, whether it is enabled and — when it is not — the sentence that says why (the engine's own rejection
// text, so the panel never invents a rule), and an optional question to ask first. `useRunAction` runs one: it asks through
// the Shell's confirm dialog when there is a question, then dispatches.
import { useCallback } from 'react';
import type { Action } from '@engine/index';
import { useShell } from '../shellContext';
import { useStore } from '../store/useGame';

export interface PanelAction {
  /** Stable handle (and the e2e handle): `equip`, `drop`, `buy`, `unlock-rgr_x` … */
  id: string;
  label: string;
  action: Action;
  enabled: boolean;
  /** Why it is off (shown beside the button, read with it); null when enabled. */
  reason: string | null;
  /** Ask first: the button destroys, spends heavily or cannot be undone. */
  confirm: string | null;
  /** The confirming button's text (default "Yes"). */
  yes?: string;
  danger?: boolean;
  primary?: boolean;
}

/** An action that checks `problem` (the engine's rejection text, or null when it is fine) and legality. */
export function panelAction(
  id: string,
  label: string,
  action: Action,
  isLegal: (a: Action) => boolean,
  problem: string | null,
  extra: { confirm?: string | null; yes?: string; danger?: boolean; primary?: boolean } = {},
): PanelAction {
  const enabled = problem === null && isLegal(action);
  const out: PanelAction = {
    id,
    label,
    action,
    enabled,
    reason: enabled ? null : (problem ?? 'Not now.'),
    confirm: enabled ? (extra.confirm ?? null) : null,
  };
  if (extra.yes !== undefined) out.yes = extra.yes;
  if (extra.danger === true) out.danger = true;
  if (extra.primary === true) out.primary = true;
  return out;
}

/** Runs a panel action: ask first if it has a question, then dispatch. Does nothing for a disabled one. */
export function useRunAction(): (row: PanelAction) => void {
  const store = useStore();
  const shell = useShell();
  return useCallback(
    (row: PanelAction) => {
      if (!row.enabled) return;
      if (row.confirm === null) {
        store.dispatch(row.action);
        return;
      }
      void shell.confirm(row.confirm, row.yes === undefined ? {} : { yes: row.yes }).then((yes) => {
        if (yes) store.dispatch(row.action);
      });
    },
    [store, shell],
  );
}

/** Why the game is not in a state to change things: a fight is on, or it is not the explore screen. */
export function notExploring(mode: string): string | null {
  if (mode === 'explore') return null;
  return mode === 'combat' ? 'Not in a fight. Use the Item action instead.' : 'Not now.';
}
