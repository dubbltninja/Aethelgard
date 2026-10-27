// The Explore screen (PLAN §6.3, DESIGN §16.1–16.3 `screen_explore`): the HUD; the place — region, name, level band,
// its scene and its text (variants, what just happened here); who is here and what lies here; the ExitBar; the
// ActionBar; the event log; and the map (docked on wide desktops, an overlay panel otherwise). It enables only what
// the engine lists (`useLegal`), and every input is an Action through `store.dispatch`.
//
// Keys (DESIGN §16.4, PLAN §6.6): arrows focus the exit in their direction and Enter travels; on the map, arrows and
// WASD choose a neighbour. T talks to the first person who will talk, R rests (Shift+R full rest), E takes everything,
// 1–9 press the ActionBar in displayed order, H toggles the HUD detail, M opens the map (the Shell's panel keys).
//
// Pattern for later screens (D-104): the container gathers hooks, builds a model with pure helpers (exploreModel.ts)
// and renders `ExploreView`, which takes props only. After a move the new place's heading takes focus, unless focus
// is in a dialog or on the map (the traveller is still choosing there).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Icon } from '../art/Icon';
import { Portrait } from '../art/Portrait';
import { breachOverlay } from '../art/breachOverlay';
import { RegionPalette } from '../art/RegionPalette';
import { Scene } from '../art/Scene';
import type { Backdrop } from '../art/backdropChooser';
import { useBackdrop, usePreloadExits } from '../art/useBackdrop';
import { ActionBar, actionKey } from '../components/ActionBar';
import { Button } from '../components/Button';
import { DockPortal } from '../components/DockPortal';
import { MovePad } from '../components/MovePad';
import { StatusBar } from '../components/StatusBar';
import type { HotkeyMap } from '../hooks/hotkeys';
import { useHotkeys } from '../hooks/useHotkeys';
import { useMediaQuery, useReducedMotion } from '../hooks/useMediaQuery';
import { MapPanel } from '../panels/MapPanel';
import { useShell } from '../shellContext';
import { useContent, useGame, useLegal, useProfile, useStore } from '../store/useGame';
import {
  ARROW_DIRS,
  actionRows,
  exitRows,
  firstTalk,
  hudModel,
  itemRows,
  legalSet,
  logLines,
  npcRows,
  placeModel,
  type ActionRow,
  type ExitRow,
  type HudModel,
  type ItemRow,
  type LogLine,
  type NpcRow,
  type PlaceModel,
} from './exploreModel';
import { portalIsOpen, watchNow } from '@engine/index';
import type { Region } from '@schema/region';
import type { Location } from '@schema/location';
import type { SceneState } from '../art/Scene';

/** PLAN §6.3: the map docks in the side column from this width. */
export const DOCK_MAP_QUERY = '(min-width: 1100px)';

export interface ExploreViewProps {
  place: PlaceModel;
  location: Pick<Location, 'id' | 'name' | 'regionId' | 'art'>;
  region?: Pick<Region, 'palette'>;
  scene: SceneState;
  /** U71: the painting under the scene's code layers (null → the parametric scene). */
  backdrop?: Backdrop | null;
  seed: string;
  reducedMotion: boolean;
  hud: HudModel;
  hudDetail: boolean;
  npcs: readonly NpcRow[];
  items: readonly ItemRow[];
  exits: readonly ExitRow[];
  actions: readonly ActionRow[];
  log: readonly LogLine[];
  /** The docked map (wide desktops), rendered by the container. */
  dockedMap?: ReactNode;
  onTravel: (to: string) => void;
  onInspectExit: (to: string) => void;
  onAction: (row: ActionRow) => void;
  onTalk: (npcId: string) => void;
  onTake: (uid: string) => void;
  logRef?: RefObject<HTMLOListElement | null>;
  /**
   * U84a, where things go (D-147):
   *   - `phone` (under 760 px): the pad in the pinned dock under the thumb; the words, who is here, the actions and the log in
   *     one scroll region;
   *   - `wide` (760 px up; the default): the place and its actions on the left, the map, the log and the pad (at its foot)
   *     on the right;
   *   - `triple` (1200 px up, not short): three columns that use the width — the scene and the words; the map, who is here
   *     and the log; the actions and, at the foot, the pad.
   * The pad's spot depends only on the viewport, never on what a place says.
   */
  layout?: ExploreLayout;
}

export type ExploreLayout = 'phone' | 'wide' | 'triple';

/** U84a: the layouts' media queries (the 760 px breakpoint, DESIGN §16.1; three columns once there is room for them). */
export const EXPLORE_PHONE_QUERY = '(max-width: 759.98px)';
export const EXPLORE_TRIPLE_QUERY = '(min-width: 1200px) and (min-height: 560px)';

export function ExploreView(p: ExploreViewProps): ReactNode {
  const { place, hud } = p;
  const layout = p.layout ?? 'wide';
  const pad = <MovePad exits={p.exits} onTravel={p.onTravel} onInspect={p.onInspectExit} />;
  const actions = <ActionBar actions={p.actions} onRun={p.onAction} />;
  const map = p.dockedMap === undefined || p.dockedMap === null ? null : <div className="explore__map">{p.dockedMap}</div>;
  const facts =
    place.facts.length === 0 ? null : (
      <ul className="place__facts" aria-label="About this place">
        {place.facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
    );
  const log = (
    <section className="event-log" aria-labelledby="log-heading">
      <h2 id="log-heading" className="section-heading">
        What has happened
      </h2>
      {/* The Shell's live region speaks each step once; this list is the record, so it is not live itself. */}
      <ol className="event-log__list" role="log" aria-live="off" ref={p.logRef} tabIndex={0} aria-labelledby="log-heading">
        {p.log.map((line) => (
          <li key={line.key} className={`event-log__line event-log__line--${line.kind}`}>
            {line.text}
          </li>
        ))}
      </ol>
    </section>
  );
  const here =
    p.npcs.length === 0 && p.items.length === 0 ? null : (
      <section className="here" aria-labelledby="here-heading">
        <h2 id="here-heading" className="section-heading">
          Here
        </h2>
        <ul className="here__list">
          {p.npcs.map((npc) => (
            <li key={npc.id} className="here-chip here-chip--npc">
              <Portrait npcId={npc.id} size="sm" fallback={<Icon kind="npc" size={18} />} />
              <span className="here-chip__name">
                {npc.name}
                {npc.role === null ? null : <span className="here-chip__role"> · {npc.role}</span>}
              </span>
              {npc.canTalk ? (
                <Button className="here-chip__do" onClick={() => p.onTalk(npc.id)}>
                  Talk to {npc.name}
                </Button>
              ) : null}
            </li>
          ))}
          {p.items.map((item) => (
            <li key={item.uid} className="here-chip here-chip--item" data-rarity={item.rarity}>
              <Icon kind="item" size={18} />
              <span className="here-chip__name">
                {item.name}
                {item.qty > 1 ? ` × ${item.qty}` : ''}
                {item.rarity === 'common' ? null : <span className="here-chip__role"> · {item.rarity}</span>}
              </span>
              {item.canTake ? (
                <Button className="here-chip__do" onClick={() => p.onTake(item.uid)}>
                  Take {item.name}
                </Button>
              ) : (
                <span className="here-chip__note">Your pack is full</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  const triple = layout === 'triple';
  return (
    <RegionPalette regionId={place.regionId} region={p.region} className="screen screen--explore">
      <section className="explore" data-screen="explore" data-layout={layout} aria-labelledby="place-heading" data-infected={place.infected ? 'true' : undefined}>
        <StatusBar hud={hud} detail={p.hudDetail} />
        <header className="place">
          <p className="place__region">
            {place.regionName}
            {place.band === '' ? null : <span className="place__band"> · {place.band}</span>}
          </p>
          <h1 id="place-heading" className="place__name" tabIndex={-1}>
            {place.name}
          </h1>
          {layout === 'phone' ? null : facts}
        </header>
        {/* U84a: the scene band is fixed in the layout, and its top corner is where toasts appear (Shell) */}
        <div className="place__scene" data-toast-anchor="">
          <Scene location={p.location} region={p.region} art={place.art} state={p.scene} reducedMotion={p.reducedMotion} seed={p.seed} backdrop={p.backdrop ?? null} />
        </div>
        {/* the place's words (and, as the layout has it, who is here, the actions and the log) scroll here, never the page */}
        <div className="explore__body" data-scroll-region="explore">
          {/* (on a phone the place's tags open its words, so the header stays one line) */}
          {layout === 'phone' ? facts : null}
          <div className="place__text">
            <p className="place__description">{place.description}</p>
            {place.notes.length === 0 ? null : (
              <ul className="place__notes" aria-label="Just now">
                {place.notes.map((note, i) => (
                  <li key={`${i}:${note}`}>{note}</li>
                ))}
              </ul>
            )}
          </div>
          {triple ? null : here}
          {triple ? null : actions}
          {layout === 'phone' ? log : null}
        </div>
        {layout === 'wide' ? (
          <aside className="explore__side" aria-label="Map and log">
            {map}
            {log}
            <div className="explore__pad">{pad}</div>
          </aside>
        ) : null}
        {triple ? (
          <>
            <aside className="explore__middle" aria-label="Map, who is here, and the log">
              {map}
              {here}
              {log}
            </aside>
            <div className="explore__right">
              <div className="explore__actions">{actions}</div>
              <div className="explore__pad">{pad}</div>
            </div>
          </>
        ) : null}
      </section>
      {/* on a phone the pad rides in the pinned dock (Shell), under the thumb, as the fight's action bar does */}
      {layout === 'phone' ? (
        <DockPortal>
          <div className="explore-dock">{pad}</div>
        </DockPortal>
      ) : null}
    </RegionPalette>
  );
}

/** Focus the heading of a new place unless the traveller is busy in a dialog or on the map. */
function focusHeadingAfterMove(root: HTMLElement | null): void {
  if (root === null) return;
  const active = document.activeElement;
  // (the pad lives in the dock, outside the screen: a move from it still hands focus to the new place)
  const elsewhere = active !== null && active !== document.body && document.contains(active) && !root.contains(active) && active.closest('.pad') === null;
  if (elsewhere || active?.closest('[data-hotkey-scope="map"]') != null) return;
  root.querySelector<HTMLElement>('#place-heading')?.focus();
}

export function ExploreScreen(): ReactNode {
  const store = useStore();
  const shell = useShell();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  const legal = useLegal();
  const reducedMotion = useReducedMotion();
  const wide = useMediaQuery(DOCK_MAP_QUERY);
  const phone = useMediaQuery(EXPLORE_PHONE_QUERY);
  const short = useMediaQuery('(max-height: 559.98px)');
  const triple = useMediaQuery(EXPLORE_TRIPLE_QUERY);
  const layout: ExploreLayout = phone ? 'phone' : triple ? 'triple' : 'wide';
  const [hudDetail, setHudDetail] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLOListElement>(null);

  const here = state.world.currentLocationId;
  const location = content.locations[here];
  const isLegal = useMemo(() => legalSet(legal), [legal]);
  const model = useMemo(() => {
    const canLook = store.isLegal({ type: 'examine', target: { kind: 'location' } });
    return {
      place: placeModel(state, content, profile),
      hud: hudModel(state, content),
      npcs: npcRows(state, content, profile, legal),
      items: itemRows(state, content, legal),
      exits: exitRows(state, content, profile, legal),
      actions: actionRows(state, content, legal, { canLook, canOpenPanel: (id) => shell.canOpen(id) }),
      log: logLines(state, profile.settings.logLength),
    };
  }, [state, content, profile, legal, store, shell]);
  const backdrop = useBackdrop(location, state.world.heartstone, content.locations);
  const exitIds = useMemo(() => model.exits.filter((e) => e.state === 'open').map((e) => e.to), [model.exits]);
  usePreloadExits(exitIds, here, state.world.heartstone, content.locations);

  const dispatch = (action: Parameters<typeof store.dispatch>[0]): void => void store.dispatch(action);
  const run = (row: ActionRow): void => {
    if (row.panel !== undefined) {
      shell.openPanel(row.panel);
      return;
    }
    const action = row.action;
    if (action === undefined) return;
    if (row.confirm === undefined) {
      dispatch(action);
      return;
    }
    void shell.confirm(row.confirm, { yes: row.label }).then((yes) => {
      if (yes) dispatch(action);
    });
  };
  const travel = (to: string): void => dispatch({ type: 'move', to });
  const inspectExit = (to: string): void => {
    const action = { type: 'examine', target: { kind: 'exit', to } } as const;
    if (store.isLegal(action)) dispatch(action);
  };

  // ---- keys ----
  const inMap = (): boolean => document.activeElement?.closest('[data-hotkey-scope="map"]') != null;
  const focusExit = (dir: string): void => {
    document.querySelector<HTMLElement>(`.pad [data-exit-dir="${dir}"]`)?.focus();
  };
  const talkTo = firstTalk(model.npcs);
  const keys: HotkeyMap = {};
  // the arrows focus the pad's slot in their direction (on the map, they and WASD choose a neighbour instead, DESIGN §16.4)
  for (const [key, dir] of Object.entries(ARROW_DIRS)) {
    const exit = model.exits.find((e) => e.dir === dir);
    keys[key] = { run: () => focusExit(dir), label: 'Choose a way on', group: 'map', when: () => exit !== undefined && !inMap() };
  }
  if (talkTo !== undefined) keys.t = { run: () => dispatch({ type: 'talk', npcId: talkTo.id }), label: `Talk to ${talkTo.name}`, group: 'action' };
  if (isLegal({ type: 'rest', kind: 'short' })) keys.r = { run: () => dispatch({ type: 'rest', kind: 'short' }), label: 'Short rest', group: 'action' };
  if (isLegal({ type: 'rest', kind: 'full' })) keys['shift+r'] = { run: () => dispatch({ type: 'rest', kind: 'full' }), label: 'Full rest', group: 'action' };
  if (isLegal({ type: 'takeAll' })) keys.e = { run: () => dispatch({ type: 'takeAll' }), label: 'Take everything', group: 'action' };
  model.actions.forEach((row, i) => {
    const key = actionKey(i);
    if (key !== null) keys[key] = { run: () => run(row), label: 'Press an action by its number', group: 'action' };
  });
  keys.h = { run: () => setHudDetail((on) => !on), label: hudDetail ? 'Hide HUD detail' : 'Show HUD detail', group: 'system' };
  useHotkeys(keys, { scope: 'Explore' });

  // ---- focus and scroll ----
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    focusHeadingAfterMove(rootRef.current);
  }, [here]);
  useEffect(() => {
    const list = logRef.current;
    if (list !== null) list.scrollTop = list.scrollHeight;
  }, [model.log]);

  if (model.place === null || location === undefined) {
    return (
      <section className="screen screen--explore" data-screen="explore" aria-labelledby="place-heading">
        <h1 id="place-heading">Somewhere unknown</h1>
        <p>This place is not in the game’s world. Return to the title and load a save.</p>
        <Button onClick={() => dispatch({ type: 'returnToTitle' })}>Return to title</Button>
      </section>
    );
  }

  return (
    <div ref={rootRef} className="explore-root">
      <ExploreView
        place={model.place}
        location={location}
        region={content.regions[location.regionId]}
        scene={{
          horde: state.world.hordeActive,
          heartstone: state.world.heartstone,
          watch: watchNow(state),
          loop: state.meta.loop,
          infected: model.place.infected,
          portalOpen: portalIsOpen(state),
          breachOverlay: breachOverlay({ clock: state.clock, hordeActive: state.world.hordeActive, infected: model.place.infected }),
        }}
        backdrop={backdrop}
        seed={location.id}
        reducedMotion={reducedMotion}
        hud={model.hud}
        hudDetail={hudDetail}
        npcs={model.npcs}
        items={model.items}
        exits={model.exits}
        actions={model.actions}
        log={model.log}
        dockedMap={(wide || triple) && !short && shell.activePanel !== 'map' ? <MapPanel docked /> : null}
        layout={layout}
        onTravel={travel}
        onInspectExit={inspectExit}
        onAction={run}
        onTalk={(npcId) => dispatch({ type: 'talk', npcId })}
        onTake={(uid) => dispatch({ type: 'take', uid })}
        logRef={logRef}
      />
    </div>
  );
}
