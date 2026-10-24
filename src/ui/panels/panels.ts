// Panels (PLAN §6.2–6.3): overlay state local to the Shell (`activePanel`), never engine state, so opening one never
// changes GameState or a replay trace. Each mode allows its own set (`legalPanels`); a panel opens only when it is
// allowed in the mode and its component exists (PanelHost's registry). Later units add their component to
// PANEL_COMPONENTS in PanelHost.tsx and their hotkey to SHELL panel keys; the ids and titles are fixed here.
import type { Mode } from '@engine/index';

export type PanelId =
  | 'inventory'
  | 'equipment'
  | 'abilities'
  | 'journal'
  | 'codex'
  | 'bestiary'
  | 'timeline'
  | 'achievements'
  | 'settings'
  | 'saves'
  | 'merchant'
  | 'crafting'
  | 'camp'
  | 'companion'
  | 'map'
  | 'menu'
  | 'help';

export const PANEL_TITLES: Record<PanelId, string> = {
  inventory: 'Inventory',
  equipment: 'Equipment',
  abilities: 'Abilities',
  journal: 'Quest journal',
  codex: 'Codex',
  bestiary: 'Bestiary',
  timeline: 'Loop timeline',
  achievements: 'Achievements',
  settings: 'Settings',
  saves: 'Saves',
  merchant: 'Merchant',
  crafting: 'Forge',
  camp: 'Camp',
  companion: 'Companion',
  map: 'Map',
  menu: 'Menu',
  help: 'Keys',
};

/** DESIGN §16.4 panel letters; in a fight they need Shift (D-066 #13, enforced by the resolver's `panel` group). */
export const PANEL_KEYS: Partial<Record<PanelId, string>> = {
  inventory: 'i',
  abilities: 'k', // WASD move on the map, so 'a' is taken (D-104: a letter that is free)
  journal: 'q',
  codex: 'c',
  bestiary: 'b',
  map: 'm',
  timeline: 'l',
};

const ALL: readonly PanelId[] = Object.keys(PANEL_TITLES) as PanelId[];

/**
 * Panels a mode allows (PLAN §6.3): in combat only Inventory (read-only), Bestiary, Help, Settings; in dialogue only
 * Help and Settings; at the title only Settings, Saves, Codex (and Help). The Threshold and the ending screens allow
 * the reading panels and the shell's own.
 */
export function legalPanels(mode: Mode): readonly PanelId[] {
  switch (mode) {
    case 'title':
      return ['settings', 'saves', 'codex', 'achievements', 'help'];
    case 'combat':
      return ['inventory', 'bestiary', 'help', 'settings'];
    case 'dialogue':
      return ['help', 'settings'];
    case 'threshold':
      return ['codex', 'bestiary', 'timeline', 'achievements', 'journal', 'settings', 'saves', 'help'];
    case 'ending':
      return ['settings', 'help'];
    case 'explore':
      return ALL;
  }
}
