// Routing by `state.mode` (PLAN §6.2): no router library — there is one page and the game's own mode is the route.
// The Title includes Class Select as a sub-view; every mode has its screen now (PlaceholderScreen is kept for tests).
// Pattern: a new screen replaces its placeholder line in `ScreenFor`, and nothing else here changes. <CombatAftermath/>
// (U65) sits beside the screen: a fight that ends in a victory or a flight has already left combat mode, so its summary is
// a dialog over the next screen.
import type { ReactNode } from 'react';
import type { Mode } from '@engine/index';
import { CombatAftermath } from './components/combat/CombatSummary';
import { CombatScreen } from './screens/CombatScreen';
import { DialogueScreen } from './screens/DialogueScreen';
import { EndingScreen } from './screens/EndingScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { ThresholdScreen } from './screens/ThresholdScreen';
import { TitleScreen } from './screens/TitleScreen';
import { Shell } from './Shell';
import { useGame } from './store/useGame';

export function ScreenFor({ mode }: { mode: Mode }): ReactNode {
  switch (mode) {
    case 'title':
      return <TitleScreen />;
    case 'explore':
      return <ExploreScreen />;
    case 'combat':
      return <CombatScreen />;
    case 'dialogue':
      return <DialogueScreen />;
    case 'threshold':
      return <ThresholdScreen />;
    case 'ending':
      return <EndingScreen />;
  }
}

export function App(): ReactNode {
  const mode = useGame((s) => s.mode);
  return (
    <Shell>
      <ScreenFor mode={mode} />
      <CombatAftermath />
    </Shell>
  );
}
