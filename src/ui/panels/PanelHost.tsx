// PanelHost (PLAN §6.2–6.3): renders the Shell's active panel inside the shared Modal (focus trap, Esc, aria-modal).
// Later units register their panel component here; until then a panel id without a component cannot be opened.
import type { ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { AbilitiesPanel } from './AbilitiesPanel';
import { AchievementsPanel } from './AchievementsPanel';
import { BestiaryPanel } from './BestiaryPanel';
import { CampPanel } from './CampPanel';
import { CodexPanel } from './CodexPanel';
import { ForgePanel } from './ForgePanel';
import { HelpPanel } from './HelpPanel';
import { InventoryPanel } from './InventoryPanel';
import { JournalPanel } from './JournalPanel';
import { MapPanel } from './MapPanel';
import { MerchantPanel } from './MerchantPanel';
import { PANEL_TITLES, type PanelId } from './panels';
import { SavesPanel } from './SavesPanel';
import { SettingsPanel } from './SettingsPanel';
import { TimelinePanel } from './TimelinePanel';

export const PANEL_COMPONENTS: Partial<Record<PanelId, () => ReactNode>> = {
  help: HelpPanel,
  settings: SettingsPanel,
  saves: SavesPanel,
  map: MapPanel, // U64
  journal: JournalPanel, // U66
  codex: CodexPanel, // U66
  bestiary: BestiaryPanel, // U66
  inventory: InventoryPanel, // U67
  equipment: InventoryPanel, // U67: the same panel; the paper doll is its first group
  abilities: AbilitiesPanel, // U67
  merchant: MerchantPanel, // U67
  crafting: ForgePanel, // U67
  camp: CampPanel, // U67
  timeline: TimelinePanel, // U68
  achievements: AchievementsPanel, // U68
};

export function PanelHost({ id, onClose }: { id: PanelId; onClose: () => void }): ReactNode {
  const Panel = PANEL_COMPONENTS[id];
  if (Panel === undefined) return null;
  return (
    <Modal key={id} title={PANEL_TITLES[id]} onClose={onClose} className={`panel panel--${id}`}>
      <Panel />
    </Modal>
  );
}
