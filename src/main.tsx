// React root (PLAN §2, §6). U10 stub: a minimal accessible page that exercises the whole pipeline
// (tsc + React shim, esbuild bundle with relative URLs, bun test, Playwright on desktop and mobile).
// The UI units replace ScaffoldPage with <App/>, the store bootstrap and the audio unlock listener.
import { StrictMode, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

export const TITLE = 'Echoes of Aethelgard: The Unraveling';

const styles = {
  main: { maxWidth: '40rem', margin: '0 auto', padding: '3rem 1.25rem' },
  muted: { color: '#b9b0c9' },
  button: {
    minHeight: '44px',
    minWidth: '44px',
    padding: '0.5rem 1rem',
    font: 'inherit',
    color: '#14111c',
    background: '#9fd4c7',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
} as const;

export function ScaffoldPage({ version }: { version: string }): ReactNode {
  const [rings, setRings] = useState(0);
  return (
    <main style={styles.main} aria-labelledby="title">
      <h1 id="title">{TITLE}</h1>
      <p>Scaffold build — the rebuild is under construction. The original game lives in <code>legacy/</code>.</p>
      <p style={styles.muted}>Version {version}</p>
      <button type="button" style={styles.button} onClick={() => setRings((n) => n + 1)}>
        Ring the bell
      </button>
      <p role="status" aria-live="polite">
        {rings === 0 ? 'The bell is silent.' : `The bell has rung ${rings} ${rings === 1 ? 'time' : 'times'}.`}
      </p>
    </main>
  );
}

const container = typeof document === 'undefined' ? null : document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ScaffoldPage version={__VERSION__} />
    </StrictMode>,
  );
}
