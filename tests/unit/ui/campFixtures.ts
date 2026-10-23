// A helper for the Camp test: the ActionBar row (exploreModel.actionRows) a panel button has, found by its id.
import { legalActions, type GameState } from '@engine/index';
import { actionRows, type ActionRow } from '@ui/screens/exploreModel';
import { pack, place } from './panelFixtures';

export function exploreModelPanelRow(state: GameState, id: string): ActionRow | undefined {
  const profile = place('loop1_respite').profile;
  return actionRows(state, pack, legalActions(state, pack, profile), { canLook: false, canOpenPanel: () => true }).find((r) => r.id === id);
}
