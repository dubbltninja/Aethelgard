// The first stop of the Tab order: jumps past the chrome to the active screen (PLAN §6.7). Hidden until focused.
import type { ReactNode } from 'react';

export function SkipLink({ target = 'main', children = 'Skip to the game' }: { target?: string; children?: ReactNode }): ReactNode {
  return (
    <a className="skip-link" href={`#${target}`}>
      {children}
    </a>
  );
}
