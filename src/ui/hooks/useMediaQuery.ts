// `useMediaQuery` and `useReducedMotion` (PLAN §6.7–6.8). The breakpoint and the motion preference are the only
// viewport-dependent behaviour; everything else is CSS.
import { useSyncExternalStore } from 'react';
import { useProfile } from '../store/useGame';
import { motionReduced } from '../theme';

interface MediaQueryListLike {
  matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

function queryList(query: string): MediaQueryListLike | null {
  const mm = (globalThis as { matchMedia?: (q: string) => MediaQueryListLike }).matchMedia;
  return typeof mm === 'function' ? mm(query) : null;
}

/** Live `matchMedia(query).matches`; false where there is no `matchMedia` (server render, tests). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = queryList(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    () => queryList(query)?.matches ?? false,
    () => false,
  );
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The effective reduced-motion switch: the setting, else the system preference (D-035). */
export function useReducedMotion(): boolean {
  const setting = useProfile((p) => p.settings.reducedMotion);
  const prefers = useMediaQuery(REDUCED_MOTION_QUERY);
  return motionReduced(setting, prefers);
}
