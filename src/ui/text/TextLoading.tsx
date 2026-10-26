// U62a: the quiet line shown while a text chunk is on its way (src/ui/text/prose.ts) — a dim ellipsis that breathes, and
// "Loading" for a screen reader. Pure.
import type { ReactNode } from 'react';

export function TextLoading({ className }: { className?: string }): ReactNode {
  return (
    <p className={className === undefined ? 'text-loading' : `${className} text-loading`} aria-busy="true" data-testid="text-loading">
      <span className="text-loading__dots" aria-hidden="true">
        …
      </span>
      <span className="sr-only">Loading</span>
    </p>
  );
}
