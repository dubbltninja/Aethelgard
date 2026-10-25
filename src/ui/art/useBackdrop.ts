// The containers' side of the painted backdrops (U71): which painting a scene shows right now (re-chosen when one fails to
// load), and warming the next step's paintings. Views stay pure; they get the pick as a prop.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { HeartstoneState } from '@engine/index';
import {
  TITLE_KEY,
  backdropChain,
  backdropFailures,
  chooseBackdrop,
  chooseTitleArt,
  markBackdropFailed,
  preloadUrls,
  subscribeBackdropFailures,
  type Backdrop,
  type PlacedLocation,
} from './backdropChooser';
import { SMALL_MEDIA } from './SceneBackdrop';
import { sceneManifest, type ArtFiles } from './sceneManifest';

export function useBackdropFailures(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeBackdropFailures, backdropFailures, backdropFailures);
}

/** The painting for `location` (null → the parametric scene). */
export function useBackdrop(
  location: PlacedLocation | undefined,
  heartstone: HeartstoneState | undefined,
  locations: Readonly<Record<string, PlacedLocation | undefined>>,
): Backdrop | null {
  const failed = useBackdropFailures();
  const chain = useMemo(
    () => (location === undefined ? [] : backdropChain(location, heartstone, locations as Readonly<Record<string, PlacedLocation>>)),
    [location, heartstone, locations],
  );
  return chooseBackdrop(chain, failed);
}

/** The Title's key art and what to do when it fails (fall back to the drawn Title art). */
export function useTitleArt(): { files: ArtFiles | null; onError: () => void } {
  const failed = useBackdropFailures();
  return { files: chooseTitleArt(sceneManifest(), failed), onError: () => markBackdropFailed(TITLE_KEY) };
}

const warmed = new Set<string>();

/** ART §7: preload the paintings of the current location's exits only (one size, each URL once per page). */
export function usePreloadExits(
  exitIds: readonly string[],
  hereId: string,
  heartstone: HeartstoneState | undefined,
  locations: Readonly<Record<string, PlacedLocation | undefined>>,
): void {
  const failed = useBackdropFailures();
  const key = exitIds.join('|');
  useEffect(() => {
    if (typeof Image === 'undefined') return;
    const small = typeof matchMedia === 'function' && matchMedia(SMALL_MEDIA).matches;
    const ids = key === '' ? [] : key.split('|');
    for (const url of preloadUrls(ids, hereId, heartstone, locations as Readonly<Record<string, PlacedLocation>>, failed, small)) {
      if (warmed.has(url)) continue;
      warmed.add(url);
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }, [key, hereId, heartstone, locations, failed]);
}
