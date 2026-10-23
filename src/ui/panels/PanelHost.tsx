// PanelHost (PLAN §6.2–6.3): renders the Shell's active panel inside the shared Modal (focus trap, Esc, aria-modal).
// Later units register their panel component here; until then a panel id without a component cannot be opened.
import type { ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { BestiaryPanel } from './BestiaryPanel';
import { CodexPanel } from './CodexPanel';
import { HelpPanel } from './HelpPanel';
import { JournalPanel } from './JournalPanel';
import { MapPanel } from './MapPanel';
import { PANEL_TITLES, type PanelId } from './panels';
import { SavesPanel } from './SavesPanel';
import { SettingsPanel } from './SettingsPanel';

export const PANEL_COMPONENTS: Partial<Record<PanelId, () => ReactNode>> = {
  help: HelpPanel,
  settings: SettingsPanel,
  saves: SavesPanel,
  map: MapPanel, // U64
  journal: JournalPanel, // U66
  codex: CodexPanel, // U66
  bestiary: BestiaryPanel, // U66
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
