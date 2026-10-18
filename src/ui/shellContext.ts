// What the Shell offers the screens and panels inside it (PLAN §6.2): the active panel, and the confirm dialog that
// Delete-to-drop, slot deletion and flee confirmation share. Outside a Shell (unit tests) every call is a no-op.
import { createContext, useContext } from 'react';
import type { PanelId } from './panels/panels';

export interface ConfirmOptions {
  /** The confirming button's text (default "Yes"). */
  yes?: string;
  /** The cancelling button's text (default "Cancel"). */
  no?: string;
}

export interface ShellApi {
  activePanel: PanelId | null;
  /** Opens a panel if the mode allows it and it exists; returns whether it opened. */
  openPanel(id: PanelId): boolean;
  closePanel(): void;
  canOpen(id: PanelId): boolean;
  /** An accessible yes/no dialog; resolves false on Esc or Cancel. */
  confirm(message: string, options?: ConfirmOptions): Promise<boolean>;
}

export const NO_SHELL: ShellApi = {
  activePanel: null,
  openPanel: () => false,
  closePanel: () => undefined,
  canOpen: () => false,
  confirm: () => Promise.resolve(false),
};

export const ShellContext = createContext<ShellApi>(NO_SHELL);

export function useShell(): ShellApi {
  return useContext(ShellContext);
}
