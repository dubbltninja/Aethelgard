// The Threshold (PLAN §6.3, DESIGN §10.6–10.9, §15.1, §16.3 `screen_threshold_*`; WORLD §3.12; D-083; U68): the place between loops,
// one screen with its four places as tabs — the Still Shore (who is here, the last loop in a line), the Gallery of Loops (the
// run records, the seven marks, the Archive of Echoes), the Loom (Attunements, challenge modifiers, New Game+) and the Far Light
// (the class to wake as, then *Step into the light*). Only the engine's Threshold actions change anything; every button carries
// the engine's own reason when it is off (`thresholdModel.ts`).
//
// Keys: ←/→ move between the places (on a tab the tabs do it themselves), Enter or a tap presses a button. Touch: the places are
// a tab bar fixed to the bottom edge on a phone. Reduced motion: the scene is still.
//
// Pattern (D-104): `ThresholdScreen` holds the hooks; `ThresholdView` and the four place views take props only.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { thresholdArea, thresholdLocationId, type ThresholdArea } from '@engine/index';
import { RegionPalette } from '../art/RegionPalette';
import { Scene, type SceneState } from '../art/Scene';
import type { Backdrop } from '../art/backdropChooser';
import { useBackdrop } from '../art/useBackdrop';
import { Button, cx } from '../components/Button';
import { ActionButtons } from '../components/items/ItemCard';
import { Tabs, tabId, tabPanelId, type TabItem } from '../components/lore/Tabs';
import { useHotkeys } from '../hooks/useHotkeys';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useViewFocus } from '../hooks/useViewFocus';
import { useRunAction, type PanelAction } from '../panels/panelAction';
import type { PanelId } from '../panels/panels';
import { useShell } from '../shellContext';
import { useContent, useGame, useLegal, useProfile, useStore } from '../store/useGame';
import { ClassDetail } from './ClassSelectScreen';
import { legalSet, resolvedArt } from './exploreModel';
import { RunSummaryDialog } from './RunSummary';
import {
  farLightModel,
  galleryModel,
  loomModel,
  placeTabs,
  shoreModel,
  thresholdHeader,
  type FarLightModel,
  type GalleryModel,
  type LoomModel,
  type ShoreModel,
  type ThresholdHeader,
} from './thresholdModel';

// ---- the Still Shore ------------------------------------------------------------------------------------------------------------

export interface ShoreViewProps {
  model: ShoreModel;
  onRun: (row: PanelAction) => void;
  onSummary: () => void;
}

export function ShoreView({ model, onRun, onSummary }: ShoreViewProps): ReactNode {
  return (
    <div className="threshold__place threshold__place--shore">
      <section className="threshold__block" aria-labelledby="shore-came">
        <h2 id="shore-came" className="threshold__h">
          How you came
        </h2>
        {model.came === null ? (
          <p className="threshold__none">You arrived here standing, with nothing in your hands.</p>
        ) : (
          <>
            <p className="threshold__lead">{model.came.label}</p>
            {model.summary === null ? null : <p className="threshold__muted">{model.summary}</p>}
          </>
        )}
        {model.canSummary ? (
          <div className="panel-actions">
            <div className="panel-actions__one">
              <Button variant="secondary" onClick={onSummary} data-action-id="run-summary">
                Run summary
              </Button>
            </div>
          </div>
        ) : null}
        {model.glimpses === null ? null : <p className="threshold__muted">{model.glimpses}</p>}
      </section>
      <section className="threshold__block" aria-labelledby="shore-echoes">
        <h2 id="shore-echoes" className="threshold__h">
          Echoes gained<span className="threshold__count"> · {model.echoes.length}</span>
        </h2>
        {model.echoes.length === 0 ? (
          <p className="threshold__none">No Echo came back with you.</p>
        ) : (
          <ul className="threshold__echoes">
            {model.echoes.map((e) => (
              <li key={e.id}>
                <span className="threshold__echo-name">{e.name}</span>
                {e.codexLine === '' ? null : <span className="threshold__echo-line">{e.codexLine}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="threshold__block" aria-labelledby="shore-people">
        <h2 id="shore-people" className="threshold__h">
          Who is here
        </h2>
        {model.people.length === 0 ? (
          <p className="threshold__none">No one else is here.</p>
        ) : (
          <ul className="threshold__people">
            {model.people.map((p) => (
              <li key={p.id} className="threshold__person">
                <p className="threshold__lead">
                  {p.name}
                  {p.role === null ? null : <span className="threshold__muted"> · {p.role}</span>}
                </p>
                <ActionButtons actions={[p.talk]} onRun={onRun} label={p.name} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {model.lines.length === 0 ? null : (
        <section className="threshold__block" aria-labelledby="shore-lines">
          <h2 id="shore-lines" className="threshold__h">
            What the shore shows
          </h2>
          <ol className="threshold__lines">
            {model.lines.map((l) => (
              <li key={l.key}>{l.text}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

// ---- the Gallery of Loops -------------------------------------------------------------------------------------------------------

export interface GalleryViewProps {
  model: GalleryModel;
  canTimeline: boolean;
  canAchievements: boolean;
  onOpenPanel: (id: PanelId) => void;
}

export function GalleryView({ model, canTimeline, canAchievements, onOpenPanel }: GalleryViewProps): ReactNode {
  return (
    <div className="threshold__place threshold__place--gallery">
      <section className="threshold__block" aria-labelledby="gallery-loops">
        <h2 id="gallery-loops" className="threshold__h">
          The loops<span className="threshold__count"> · {model.cards.length}</span>
        </h2>
        {model.cards.length === 0 ? (
          <p className="threshold__none">The colonnade is empty. A painting hangs here for each loop that ends.</p>
        ) : (
          <ol className="gallery__cards" aria-label="One painting per loop">
            {model.cards.map((c) => (
              <li key={c.key} className="loop-card" data-outcome={c.outcome.kind} data-loop={c.loop}>
                <p className="loop-card__loop">Loop {c.loop}</p>
                <p className="loop-card__outcome">{c.outcome.label}</p>
                <p className="loop-card__line">
                  {c.className} · level {c.level} · {c.days === 1 ? '1 day' : `${c.days} days`}
                </p>
                <p className="loop-card__line">
                  {c.echoCount === 1 ? '1 Echo' : `${c.echoCount} Echoes`} · {c.questCount === 1 ? '1 quest' : `${c.questCount} quests`}
                </p>
                {c.glyphs.length === 0 ? null : (
                  <ul className="loop-card__glyphs" aria-label="Key choices">
                    {c.glyphs.map((g) => (
                      <li key={g.id}>
                        <span aria-hidden="true" className="loop-card__mark">
                          {g.mark}
                        </span>{' '}
                        {g.text}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className="panel-actions">
          <div className="panel-actions__one">
            <Button variant="secondary" disabled={!canTimeline} onClick={() => onOpenPanel('timeline')} data-action-id="open-timeline">
              Loop timeline
            </Button>
          </div>
          <div className="panel-actions__one">
            <Button variant="secondary" disabled={!canAchievements} onClick={() => onOpenPanel('achievements')} data-action-id="open-achievements">
              Achievements: {model.achievements.earned} of {model.achievements.total}
            </Button>
          </div>
        </div>
      </section>
      {model.marks === null ? null : (
        <section className="threshold__block" aria-labelledby="gallery-marks">
          <h2 id="gallery-marks" className="threshold__h">
            The seven marks
          </h2>
          <ul className="gallery__frames" aria-label="Seven frames">
            {model.marks.frames.map((f) => (
              <li key={f.n} className="gallery__frame" data-marked={f.marked ? 'true' : 'false'}>
                <span className="sr-only">Frame {f.n}: {f.marked ? 'scratched' : 'plain'}</span>
                <span aria-hidden="true">{f.marked ? '▮' : '▯'}</span>
              </li>
            ))}
          </ul>
          <p className="threshold__muted">{model.marks.text}</p>
        </section>
      )}
      <section className="threshold__block" aria-labelledby="gallery-endings">
        <h2 id="gallery-endings" className="threshold__h">
          Endings
        </h2>
        <p className="threshold__lead">
          Reached: {model.endings.reached} of {model.endings.total}
        </p>
        {model.endings.hints.length === 0 ? null : (
          <ul className="threshold__hints" aria-label="What the profile still lacks">
            {model.endings.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="threshold__block" aria-labelledby="gallery-archive">
        <h2 id="gallery-archive" className="threshold__h">
          The Archive<span className="threshold__count"> · {model.archive.held} of {model.archive.total} Echoes</span>
        </h2>
        {model.archive.groups.length === 0 ? (
          <p className="threshold__none">No Echo is held yet.</p>
        ) : (
          model.archive.groups.map((g) => (
            <details key={g.category} className="archive__group" data-category={g.category}>
              <summary>
                {g.label}
                <span className="threshold__count"> · {g.echoes.length}</span>
              </summary>
              <ul className="threshold__echoes">
                {g.echoes.map((e) => (
                  <li key={e.id}>
                    <span className="threshold__echo-name">{e.name}</span>
                    {e.codexLine === '' ? null : <span className="threshold__echo-line">{e.codexLine}</span>}
                  </li>
                ))}
              </ul>
            </details>
          ))
        )}
      </section>
    </div>
  );
}

// ---- the Loom --------------------------------------------------------------------------------------------------------------------

export interface LoomViewProps {
  model: LoomModel;
  onRun: (row: PanelAction) => void;
}

export function LoomView({ model, onRun }: LoomViewProps): ReactNode {
  const equipped = model.slots.filter((s) => s !== null).length;
  return (
    <div className="threshold__place threshold__place--loom">
      <div className="panel-bar">
        <span className="panel-bar__chip" data-testid="loom-resonance" aria-label={`Resonance ${model.resonance}`}>
          ◇ {model.resonance} Resonance
        </span>
        <span className="panel-bar__chip">
          {equipped} of {model.cap} woven in
        </span>
        {model.spentThisVisit === 0 ? null : <span className="panel-bar__chip">{model.spentThisVisit} spent this visit</span>}
      </div>
      <section className="threshold__block" aria-labelledby="loom-slots">
        <h2 id="loom-slots" className="threshold__h">
          Worn into the next loop
        </h2>
        <ol className="loom__slots" aria-label="Attunement slots">
          {model.slots.map((slot, i) => (
            <li key={slot?.id ?? `empty-${i}`} className="loom__slot" data-filled={slot === null ? 'false' : 'true'}>
              <span className="loom__slot-n" aria-hidden="true">
                {i + 1}
              </span>
              {slot === null ? <span className="loom__slot-name">Empty slot {i + 1}</span> : <span className="loom__slot-name">{slot.name}</span>}
            </li>
          ))}
        </ol>
        {model.ironLoop ? (
          <p className="panel-note panel-note--warn" role="note">
            Iron Loop is on: the Attunements stay on the loom for that loop.
          </p>
        ) : null}
      </section>
      <section className="threshold__block" aria-labelledby="loom-attunements">
        <h2 id="loom-attunements" className="threshold__h">
          Attunements
        </h2>
        <ul className="loom__list">
          {model.attunements.map((a) => (
            <li key={a.id} className="attunement" data-state={a.state} data-attunement={a.id}>
              <div className="attunement__text">
                <h3 className="attunement__name">
                  {a.name}
                  <span className="attunement__cost"> · {a.cost}</span>
                </h3>
                <p className="attunement__desc">{a.description}</p>
                <p className="attunement__state" data-state-text="">
                  {a.stateText}
                </p>
              </div>
              <ActionButtons actions={[a.buy, a.equip, a.unpick].filter((x): x is PanelAction => x !== null)} onRun={onRun} label={a.name} />
            </li>
          ))}
        </ul>
      </section>
      <section className="threshold__block" aria-labelledby="loom-modifiers">
        <h2 id="loom-modifiers" className="threshold__h">
          Challenge modifiers
        </h2>
        <p className="threshold__muted">Set here, fixed for the loop, and each one multiplies the Resonance the loop earns.</p>
        <ul className="loom__list">
          {model.modifiers.map((m) => (
            <li key={m.id} className="modifier" data-modifier={m.id} data-on={m.on ? 'true' : 'false'}>
              <div className="attunement__text">
                <h3 className="attunement__name">
                  {m.name}
                  <span className="attunement__cost"> · {m.multText}</span>
                </h3>
                <p className="attunement__desc">{m.description}</p>
              </div>
              <div className="panel-actions__one">
                <Button
                  variant={m.on ? 'primary' : 'secondary'}
                  aria-pressed={m.on}
                  aria-label={`${m.name}, ${m.multText} Resonance`}
                  disabled={!m.toggle.enabled}
                  data-action-id={m.toggle.id}
                  onClick={() => onRun(m.toggle)}
                >
                  {m.on ? 'On' : 'Off'}
                </Button>
                {m.toggle.enabled || m.toggle.reason === null ? null : <span className="panel-actions__why">{m.toggle.reason}</span>}
              </div>
            </li>
          ))}
        </ul>
        <p className="threshold__lead" data-testid="loom-multiplier">
          {model.totalText}
        </p>
      </section>
      {model.newGamePlus === null ? null : (
        <section className="threshold__block" aria-labelledby="loom-plus">
          <h2 id="loom-plus" className="threshold__h">
            New Game+
          </h2>
          <p className="threshold__muted">An ending is behind you. New Game+ starts a fresh profile that keeps every Echo, the codex, achievements and settings.</p>
          <ActionButtons actions={[model.newGamePlus]} onRun={onRun} label="New Game+" />
        </section>
      )}
    </div>
  );
}

// ---- the Far Light ----------------------------------------------------------------------------------------------------------------

export interface FarLightViewProps {
  model: FarLightModel;
  onRun: (row: PanelAction) => void;
}

export function FarLightView({ model, onRun }: FarLightViewProps): ReactNode {
  return (
    <div className="threshold__place threshold__place--far-light">
      <section className="threshold__block" aria-labelledby="light-class">
        <h2 id="light-class" className="threshold__h">
          Who wakes
        </h2>
        <p className="threshold__muted">The Wayfinder re-manifests: the new class's body, its kit, one ability point and thirty gold. Mastery stays with each class.</p>
        <ul className="classes" aria-label="Classes">
          {model.choices.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="class-pick"
                aria-pressed={c.chosen}
                data-class={c.id}
                data-chosen={c.chosen ? 'true' : 'false'}
                disabled={!c.chosen && !c.pick.enabled}
                onClick={() => (c.chosen ? undefined : onRun(c.pick))}
              >
                <span className="class-pick__name">{c.name}</span>
                <span className="class-pick__title">{c.title}</span>
                <span className="class-pick__vitals">
                  {c.hp} HP · {c.mp} {c.resourceName}
                </span>
                <span className="class-pick__mastery">
                  Mastered {c.mastery.mastered} of {c.mastery.total} · {c.mastery.loops === 1 ? '1 loop' : `${c.mastery.loops} loops`}
                  {c.mastery.loops === 0 ? '' : ` · best level ${c.mastery.bestLevel}`} · {c.mastery.endings === 1 ? '1 ending' : `${c.mastery.endings} endings`}
                </span>
                <span className={cx('class-pick__flag')}>{c.chosen ? (c.justPlayed ? 'Chosen · the class you just played' : 'Chosen') : c.justPlayed ? 'The class you just played' : 'Choose'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {model.detail === null ? null : <ClassDetail option={model.detail} />}
      <section className="threshold__block" aria-labelledby="light-carry">
        <h2 id="light-carry" className="threshold__h">
          What you carry into Loop {model.nextLoop}
        </h2>
        <dl className="summary__facts" aria-label="Carried into the next loop">
          <div className="summary__fact">
            <dt>Attunements</dt>
            <dd>{model.carried.length === 0 ? (model.ironLoop && model.idle.length > 0 ? 'None: Iron Loop keeps them on the loom' : 'None woven in') : model.carried.join(', ')}</dd>
          </div>
          <div className="summary__fact">
            <dt>Challenge modifiers</dt>
            <dd>{model.modifiers.length === 0 ? 'None' : `${model.modifiers.join(', ')} (${model.multText ?? ''})`}</dd>
          </div>
        </dl>
        <div className="panel-actions threshold__begin">
          <div className="panel-actions__one">
            <Button variant="primary" disabled={!model.begin.enabled} onClick={() => onRun(model.begin)} data-action-id="begin-loop">
              {model.begin.label}
            </Button>
            {model.begin.enabled || model.begin.reason === null ? null : <span className="panel-actions__why">{model.begin.reason}</span>}
          </div>
        </div>
      </section>
    </div>
  );
}

// ---- the screen ----------------------------------------------------------------------------------------------------------------------

export type PlaceBody =
  | { area: 'still_shore'; model: ShoreModel }
  | { area: 'gallery'; model: GalleryModel }
  | { area: 'loom'; model: LoomModel }
  | { area: 'far_light'; model: FarLightModel };

export interface ThresholdSceneProps {
  location: Parameters<typeof Scene>[0]['location'];
  region: Parameters<typeof Scene>[0]['region'];
  art: Parameters<typeof Scene>[0]['art'];
  state: SceneState;
  /** U71: the painting, if any (null → the parametric scene). */
  backdrop?: Backdrop | null;
}

export interface ThresholdViewProps {
  header: ThresholdHeader;
  tabs: readonly TabItem<ThresholdArea>[];
  body: PlaceBody;
  scene: ThresholdSceneProps | null;
  reducedMotion: boolean;
  onGo: (area: ThresholdArea) => void;
  onRun: (row: PanelAction) => void;
  onSummary: () => void;
  onOpenPanel: (id: PanelId) => void;
  canOpenPanel: (id: PanelId) => boolean;
}

export function ThresholdView(p: ThresholdViewProps): ReactNode {
  const { header, body } = p;
  return (
    <RegionPalette regionId="region_threshold" {...(p.scene?.region === undefined ? {} : { region: p.scene.region })} className="screen screen--threshold">
      <section className="threshold" data-screen="threshold" data-place={header.area} aria-labelledby="threshold-heading">
        <header className="threshold__head">
          <p className="threshold__eyebrow">The Threshold · before Loop {header.nextLoop}</p>
          <h1 id="threshold-heading" className="threshold__title" tabIndex={-1}>
            {header.placeName}
          </h1>
          <p className="threshold__resonance" aria-label={`Resonance ${header.resonance}`}>
            ◇ {header.resonance}
          </p>
        </header>
        <Tabs tabs={p.tabs} active={header.area} label="The four places" idPrefix="threshold" onSelect={p.onGo} className="threshold__tabs" />
        <div role="tabpanel" id={tabPanelId('threshold')} aria-labelledby={tabId('threshold', header.area)} className="threshold__panel">
          {p.scene === null ? null : (
            <div className="threshold__scene" aria-hidden="true">
              <Scene location={p.scene.location} {...(p.scene.region === undefined ? {} : { region: p.scene.region })} {...(p.scene.art === undefined ? {} : { art: p.scene.art })} state={p.scene.state} reducedMotion={p.reducedMotion} seed={header.locationId} backdrop={p.scene.backdrop ?? null} />
            </div>
          )}
          {header.description === '' ? null : <p className="threshold__description">{header.description}</p>}
          {body.area === 'still_shore' ? (
            <ShoreView model={body.model} onRun={p.onRun} onSummary={p.onSummary} />
          ) : body.area === 'gallery' ? (
            <GalleryView model={body.model} canTimeline={p.canOpenPanel('timeline')} canAchievements={p.canOpenPanel('achievements')} onOpenPanel={p.onOpenPanel} />
          ) : body.area === 'loom' ? (
            <LoomView model={body.model} onRun={p.onRun} />
          ) : (
            <FarLightView model={body.model} onRun={p.onRun} />
          )}
        </div>
      </section>
    </RegionPalette>
  );
}

/** The place to the left (-1) or right (+1) of `area`, or null at an end (the four places are a row, not a ring). */
export function neighbourPlace(tabs: readonly TabItem<ThresholdArea>[], area: ThresholdArea, by: 1 | -1): ThresholdArea | null {
  const at = tabs.findIndex((t) => t.id === area);
  return tabs[at + by]?.id ?? null;
}

export function ThresholdScreen(): ReactNode {
  const store = useStore();
  const shell = useShell();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  const legal = useLegal();
  const run = useRunAction();
  const reducedMotion = useReducedMotion();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isLegal = useMemo(() => legalSet(legal), [legal]);
  const area = thresholdArea(state);
  useViewFocus(rootRef, area);

  const tabs = useMemo(() => placeTabs(), []);
  const header = useMemo(() => thresholdHeader(state, content, profile), [state, content, profile]);
  const body = useMemo<PlaceBody>(() => {
    switch (area) {
      case 'still_shore':
        return { area, model: shoreModel(state, content, profile, isLegal) };
      case 'gallery':
        return { area, model: galleryModel(state, content, profile) };
      case 'loom':
        return { area, model: loomModel(state, content, profile, isLegal) };
      case 'far_light':
        return { area, model: farLightModel(state, content, profile, isLegal) };
    }
  }, [area, state, content, profile, isLegal]);

  const locationId = thresholdLocationId(state);
  const location = content.locations[locationId];
  const backdrop = useBackdrop(location, state.world.heartstone, content.locations);
  const scene: ThresholdSceneProps | null =
    location === undefined
      ? null
      : {
          location,
          region: content.regions[location.regionId],
          art: resolvedArt(state, content, profile, locationId),
          state: { horde: false, heartstone: state.world.heartstone, watch: 3, loop: state.meta.loop },
          backdrop,
        };

  const go = (to: ThresholdArea): void => {
    if (to !== area) void store.dispatch({ type: 'thresholdGo', to });
  };
  const step = (by: 1 | -1): void => {
    const to = neighbourPlace(tabs, area, by);
    if (to !== null) go(to);
  };
  useHotkeys(
    {
      arrowleft: { run: () => step(-1), label: 'Previous place', group: 'list', when: () => neighbourPlace(tabs, area, -1) !== null },
      arrowright: { run: () => step(1), label: 'Next place', group: 'list', when: () => neighbourPlace(tabs, area, 1) !== null },
    },
    { scope: 'Threshold', enabled: !summaryOpen },
  );

  return (
    <div ref={rootRef} className="threshold-root">
      <ThresholdView
        header={header}
        tabs={tabs}
        body={body}
        scene={scene}
        reducedMotion={reducedMotion}
        onGo={go}
        onRun={run}
        onSummary={() => setSummaryOpen(true)}
        onOpenPanel={(id) => void shell.openPanel(id)}
        canOpenPanel={(id) => shell.canOpen(id)}
      />
      {summaryOpen ? <RunSummaryDialog onClose={() => setSummaryOpen(false)} /> : null}
    </div>
  );
}
