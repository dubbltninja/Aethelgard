// The game menu (DESIGN §16.1 mobile tab bar, D-107's open question settled in U69): five tabs, and what the Menu tab
// holds. Pure: the Shell decides which panels can open; these turn that into the tabs and the list.
import type { IconKind } from '../art/Icon';
import type { PanelId } from './panels';

export type TabId = 'explore' | 'journal' | 'pack' | 'map' | 'menu';

export interface TabItem {
  id: TabId;
  label: string;
  icon: IconKind;
  /** The panel the tab opens; null for Explore (it closes whatever is open). */
  panel: PanelId | null;
  /** The tab the player is on: Explore with nothing open, else the tab whose panel is open. */
  current: boolean;
  disabled: boolean;
}

const TABS: readonly { id: TabId; label: string; icon: IconKind; panel: PanelId | null }[] = [
  { id: 'explore', label: 'Explore', icon: 'look', panel: null },
  { id: 'journal', label: 'Journal', icon: 'journal', panel: 'journal' },
  { id: 'pack', label: 'Pack', icon: 'item', panel: 'inventory' },
  { id: 'map', label: 'Map', icon: 'map', panel: 'map' },
  { id: 'menu', label: 'Menu', icon: 'menu', panel: 'menu' },
];

/** Panels the screen itself opens (a merchant's stock, the forge, the fire): they leave the Explore tab current. */
const SCENE_PANELS: readonly PanelId[] = ['merchant', 'crafting', 'camp', 'companion'];

/** The tab a panel belongs to: Journal, Pack and Map own theirs, the Menu owns the rest, scene panels belong to Explore. */
export function tabOfPanel(panel: PanelId | null): TabId {
  if (panel === null || SCENE_PANELS.includes(panel)) return 'explore';
  if (panel === 'journal') return 'journal';
  if (panel === 'inventory' || panel === 'equipment') return 'pack';
  if (panel === 'map') return 'map';
  return 'menu';
}

export function tabBarItems(canOpen: (panel: PanelId) => boolean, activePanel: PanelId | null): TabItem[] {
  const current = tabOfPanel(activePanel);
  return TABS.map((tab) => ({ ...tab, current: tab.id === current, disabled: tab.panel !== null && !canOpen(tab.panel) }));
}

export interface MenuEntry {
  /** A panel id, or `title` for "Return to title". */
  id: PanelId | 'title';
  label: string;
  icon: IconKind;
  hint: string;
}

const ENTRIES: readonly MenuEntry[] = [
  { id: 'abilities', label: 'Abilities', icon: 'ability', hint: 'Spend points, learn and respec' },
  { id: 'codex', label: 'Codex', icon: 'codex', hint: 'What the world has told you' },
  { id: 'bestiary', label: 'Bestiary', icon: 'bestiary', hint: 'What you know of the creatures' },
  { id: 'timeline', label: 'Loop timeline', icon: 'loop', hint: 'Every loop side by side' },
  { id: 'achievements', label: 'Achievements', icon: 'crown', hint: 'Badges earned and hidden' },
  { id: 'saves', label: 'Saves', icon: 'save', hint: 'Save, load, export, import' },
  { id: 'settings', label: 'Settings', icon: 'settings', hint: 'Text size, motion, sound' },
  { id: 'help', label: 'Keys', icon: 'keys', hint: 'Every key and what it does' },
];

/** The Menu list: each panel the Shell can open now, then "Return to title" where the game may leave. */
export function menuEntries(canOpen: (panel: PanelId) => boolean, canLeave: boolean): MenuEntry[] {
  const out = ENTRIES.filter((e) => e.id !== 'title' && canOpen(e.id));
  if (canLeave) out.push({ id: 'title', label: 'Return to title', icon: 'title', hint: 'Your autosave is kept' });
  return out;
}
