// Stand-ins for the screens later units build (Explore U64, Combat U65, Dialogue U66, Threshold and Ending U68):
// each names where the run stands and offers the one way out the engine allows, so the route works end to end.
import type { ReactNode } from 'react';
import { WATCH_NAMES, dayOf, watchOf, type Mode } from '@engine/index';
import { Button } from '../components/Button';
import { useContent, useGame, useIsLegal, useStore } from '../store/useGame';

const HEADINGS: Record<Exclude<Mode, 'title'>, string> = {
  explore: 'Exploring',
  combat: 'A fight',
  dialogue: 'A conversation',
  threshold: 'The Threshold',
  ending: 'An ending',
};

const BUILT_BY: Record<Exclude<Mode, 'title'>, string> = {
  explore: 'The explore screen',
  combat: 'The combat screen',
  dialogue: 'The dialogue screen',
  threshold: 'The Threshold screens',
  ending: 'The ending screen',
};

export interface PlaceholderViewProps {
  mode: Exclude<Mode, 'title'>;
  place: string | null;
  loop: number;
  day: number;
  watch: string;
  canLeave: boolean;
  onLeave: () => void;
}

export function PlaceholderView({ mode, place, loop, day, watch, canLeave, onLeave }: PlaceholderViewProps): ReactNode {
  const heading = mode === 'explore' && place !== null ? place : HEADINGS[mode];
  return (
    <section className="screen screen--placeholder" data-screen={mode} aria-labelledby="screen-heading">
      <div className="placeholder-card">
        <h1 id="screen-heading" className="placeholder-card__heading">
          {heading}
        </h1>
        <p className="placeholder-card__when">
          Loop {loop}, day {day}, {watch}.
        </p>
        <p>{BUILT_BY[mode]} is still being built. Your run has started and is saved at each checkpoint.</p>
        {canLeave ? (
          <div className="button-row">
            <Button onClick={onLeave}>Return to title</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PlaceholderScreen({ mode }: { mode: Exclude<Mode, 'title'> }): ReactNode {
  const store = useStore();
  const content = useContent();
  const locationId = useGame((s) => s.world.currentLocationId);
  const loop = useGame((s) => s.meta.loop);
  const ticks = useGame((s) => s.clock.ticks);
  const canLeave = useIsLegal({ type: 'returnToTitle' });
  return (
    <PlaceholderView
      mode={mode}
      place={content.locations[locationId]?.name ?? null}
      loop={loop}
      day={dayOf(ticks)}
      watch={WATCH_NAMES[watchOf(ticks)] ?? ''}
      canLeave={canLeave}
      onLeave={() => store.dispatch({ type: 'returnToTitle' })}
    />
  );
}
