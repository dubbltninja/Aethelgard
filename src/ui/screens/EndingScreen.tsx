// The Ending screen (PLAN §6.3, DESIGN §10.2, §16.3 `screen_ending`; STORY §10, D-100; U68): a loop's last scene. The slides come one
// at a time over the place where it ended — the ending's sequence, then its epilogues — and after the last one the Run Summary,
// and then on: to the Threshold (Loop 2 and after), to Loop 2 Day 1 (the first loop's closer, D-049), or, after a true ending, to
// New Game+. The engine owns the slide (`pendingEnding.slideIndex`, `acknowledgeEnding`); the only thing this screen keeps
// itself is whether the summary is showing.
//
// Keys: Enter or Space go on (a focused button does its own); Esc, in the summary, goes back to the last slide. Touch: the big
// button under the text. Reduced motion: the slide's fade (150 ms at most) and the scene's drift stop.
//
// Pattern (D-104): `EndingScreen` holds the hooks; `EndingView` takes props only.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { RegionPalette } from '../art/RegionPalette';
import { Scene, type SceneState } from '../art/Scene';
import type { Backdrop } from '../art/backdropChooser';
import { useBackdrop } from '../art/useBackdrop';
import { Button } from '../components/Button';
import { ActionButtons } from '../components/items/ItemCard';
import { useHotkeys } from '../hooks/useHotkeys';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useViewFocus } from '../hooks/useViewFocus';
import { useRunAction, type PanelAction } from '../panels/panelAction';
import { useContent, useGame, useLegal, useProfile } from '../store/useGame';
import { ENDINGS_PROSE, useProse } from '../text/prose';
import { TextLoading } from '../text/TextLoading';
import { endingModel, type EndingModel, type EndingPhase } from './endingModel';
import { legalSet } from './exploreModel';
import { RunSummaryView } from './RunSummary';
import { runSummaryModel, summarySource, type RunSummaryModel } from './runSummaryModel';

export interface EndingSceneProps {
  location: Parameters<typeof Scene>[0]['location'];
  region: Parameters<typeof Scene>[0]['region'];
  state: SceneState;
  seed: string;
  /** U71: the painting, if any (null → the parametric scene). */
  backdrop?: Backdrop | null;
}

export interface EndingViewProps {
  phase: EndingPhase;
  model: EndingModel;
  summary: RunSummaryModel | null;
  scene: EndingSceneProps | null;
  reducedMotion: boolean;
  /** Slides step: the next slide (the engine) or, after the last, the summary (local). */
  onNext: () => void;
  onBack: () => void;
  onRun: (row: PanelAction) => void;
}

export function EndingView({ phase, model, summary, scene, reducedMotion, onNext, onBack, onRun }: EndingViewProps): ReactNode {
  const { slide } = model;
  return (
    <RegionPalette regionId={scene?.location.regionId ?? 'region_threshold'} {...(scene?.region === undefined ? {} : { region: scene.region })} className="screen screen--ending">
      <section className="ending" data-screen="ending" data-phase={phase} data-outcome={model.outcome.kind} aria-labelledby="ending-heading">
        {scene === null ? null : (
          <div className="ending__scene" aria-hidden="true">
            <Scene location={scene.location} {...(scene.region === undefined ? {} : { region: scene.region })} state={scene.state} reducedMotion={reducedMotion} seed={scene.seed} backdrop={scene.backdrop ?? null} />
          </div>
        )}
        <div className="ending__panel">
          <header className="ending__head">
            <p className="ending__eyebrow">{model.letter ?? 'The loop closes'}</p>
            <h1 id="ending-heading" className="ending__title" tabIndex={-1}>
              {model.outcome.label}
            </h1>
            {model.outcome.tagline === null ? null : <p className="ending__tagline">{model.outcome.tagline}</p>}
          </header>
          {phase === 'slides' ? (
            <>
              <figure className="ending__slide" key={model.index} data-kind={slide.kind} data-mood={slide.mood ?? undefined}>
                {slide.label === null ? null : <figcaption className="ending__label">{slide.label}</figcaption>}
                {slide.loading ? <TextLoading className="ending__text" /> : <p className="ending__text">{slide.text}</p>}
              </figure>
              {model.credits ? <p className="ending__credits">A game by Tim Dibert</p> : null}
              <p className="ending__progress" aria-label={`Slide ${model.index + 1} of ${model.total}`}>
                {model.index + 1} / {model.total}
              </p>
              <div className="ending__actions">
                <Button variant="primary" onClick={onNext} data-autofocus="" data-action-id="ending-next">
                  {model.next.label}
                </Button>
              </div>
            </>
          ) : (
            <>
              {summary === null ? <p className="lore__empty">The loop left no record.</p> : <RunSummaryView model={summary} headingId="summary-heading" />}
              <p className="ending__onward">{model.onward.note}</p>
              <div className="ending__actions">
                <Button variant="primary" disabled={!model.advance.enabled} onClick={() => onRun({ ...model.advance, label: model.onward.label })} data-autofocus="" data-action-id="ending-onward">
                  {model.onward.label}
                </Button>
                <Button variant="quiet" onClick={onBack} data-action-id="ending-back">
                  Back to the ending
                </Button>
              </div>
              {model.newGamePlus === null ? null : (
                <section className="ending__plus" aria-labelledby="ending-plus-heading">
                  <h2 id="ending-plus-heading" className="summary__h">
                    Begin again
                  </h2>
                  <p className="panel-intro">A true ending is behind you. New Game+ starts a fresh profile that keeps every Echo.</p>
                  <ActionButtons actions={[model.newGamePlus]} onRun={onRun} label="New Game+" />
                </section>
              )}
            </>
          )}
        </div>
      </section>
    </RegionPalette>
  );
}

export function EndingScreen(): ReactNode {
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  const legal = useLegal();
  const run = useRunAction();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<EndingPhase>('slides');
  const rootRef = useRef<HTMLDivElement>(null);
  const isLegal = useMemo(() => legalSet(legal), [legal]);
  // U62a: the slides live in the endings text chunk (preloaded in the background since boot); its arrival re-runs the model
  const prose = useProse([], [ENDINGS_PROSE]);
  const model = useMemo(() => endingModel(state, content, profile, isLegal), [state, content, profile, isLegal, prose]);
  const summary = useMemo(() => {
    const source = summarySource(state, profile);
    return source === null ? null : runSummaryModel(source, content);
  }, [state, content, profile]);
  useViewFocus(rootRef, phase);

  const location = content.locations[state.world.currentLocationId];
  const backdrop = useBackdrop(location, state.world.heartstone, content.locations);
  const scene: EndingSceneProps | null =
    location === undefined
      ? null
      : {
          location,
          region: content.regions[location.regionId],
          state: { horde: state.world.hordeActive, heartstone: state.world.heartstone, watch: 2, loop: state.meta.loop },
          seed: location.id,
          backdrop,
        };

  const last = model?.last ?? false;
  const next = (): void => {
    if (model === null) return;
    if (!last) run(model.advance);
    else setPhase('summary');
  };
  const advance = (): void => {
    if (model !== null) run(model.advance);
  };
  useHotkeys(
    {
      enter: { run: phase === 'slides' ? next : advance, label: phase === 'slides' ? 'Go on' : (model?.onward.label ?? 'Go on'), group: 'action' },
      space: { run: phase === 'slides' ? next : advance, label: 'Go on', group: 'action', hidden: true },
    },
    { scope: 'Ending' },
  );
  useHotkeys({ escape: { run: () => setPhase('slides'), label: 'Back to the ending', group: 'system' } }, { scope: 'Ending', enabled: phase === 'summary' });

  if (model === null) {
    return (
      <section className="screen screen--ending" data-screen="ending" aria-labelledby="ending-heading">
        <div className="ending__panel">
          <h1 id="ending-heading" className="ending__title" tabIndex={-1}>
            The loop is over
          </h1>
          <p className="lore__empty">There is nothing more to show.</p>
        </div>
      </section>
    );
  }
  return (
    <div ref={rootRef} className="ending-root">
      <EndingView phase={phase} model={model} summary={summary} scene={scene} reducedMotion={reducedMotion} onNext={next} onBack={() => setPhase('slides')} onRun={run} />
    </div>
  );
}
