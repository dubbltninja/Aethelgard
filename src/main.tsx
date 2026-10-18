// React root (PLAN §2, §6): stylesheets, the store bootstrap and <App/>. The audio unlock listener arrives with the
// audio engine (U74). e2e builds also expose `window.__aethelgard` for Playwright (PLAN §4.13).
import './ui/styles/tokens.css';
import './ui/styles/themes.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/components.css';
import './ui/styles/screens.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { bootGame, type Booted } from './ui/boot';
import { GameProvider } from './ui/store/useGame';
import { GAME_TITLE, applyRootAttributes } from './ui/theme';

export const TITLE = GAME_TITLE;

/** Shown when the game cannot start at all (a content error in a dev build, a browser without ES2022). */
export function BootFailure({ message }: { message: string }): ReactNode {
  return (
    <main className="boot-failure" aria-labelledby="boot-failure-heading">
      <h1 id="boot-failure-heading">{TITLE}</h1>
      <p>The game could not start: {message}</p>
    </main>
  );
}

const container = typeof document === 'undefined' ? null : document.getElementById('root');
if (container) {
  const root = createRoot(container);
  let booted: Booted | null = null;
  try {
    booted = bootGame();
  } catch (error) {
    root.render(<BootFailure message={error instanceof Error ? error.message : String(error)} />);
  }
  if (booted !== null) {
    const { store } = booted;
    applyRootAttributes(document.documentElement, store.getProfile().settings);
    if (__E2E__) {
      (window as unknown as { __aethelgard: unknown }).__aethelgard = {
        store,
        dispatch: store.dispatch,
        get state() {
          return store.getState();
        },
      };
    }
    root.render(
      <StrictMode>
        <GameProvider value={store}>
          <App />
        </GameProvider>
      </StrictMode>,
    );
  }
}
