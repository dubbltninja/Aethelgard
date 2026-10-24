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
import { RegionPalette } from '../art/RegionPalette';
import { Scene } from '../art/Scene';
import { ActionBar, actionKey } from '../components/ActionBar';
import { Button } from '../components/Button';
import { ExitBar } from '../components/ExitBar';
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
import { watchNow } from '@engine/index';
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
}

export function ExploreView(p: ExploreViewProps): ReactNode {
  const { place, hud } = p;
  return (
    <RegionPalette regionId={place.regionId} region={p.region} className="screen screen--explore">
      <section className="explore" data-screen="explore" aria-labelledby="place-heading" data-infected={place.infected ? 'true' : undefined}>
        <StatusBar hud={hud} detail={p.hudDetail} />
        <div className="explore__grid">
          <div className="explore__main">
            <header className="place">
              <p className="place__region">
                {place.regionName}
                {place.band === '' ? null : <span className="place__band"> · {place.band}</span>}
              </p>
              <h1 id="place-heading" className="place__name" tabIndex={-1}>
                {place.name}
              </h1>
              {place.facts.length === 0 ? null : (
                <ul className="place__facts" aria-label="About this place">
                  {place.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              )}
            </header>
            <div className="place__scene">
              <Scene location={p.location} region={p.region} art={place.art} state={p.scene} reducedMotion={p.reducedMotion} seed={p.seed} />
            </div>
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
            {p.npcs.length === 0 && p.items.length === 0 ? null : (
              <section className="here" aria-labelledby="here-heading">
                <h2 id="here-heading" className="section-heading">
                  Here
                </h2>
                <ul className="here__list">
                  {p.npcs.map((npc) => (
                    <li key={npc.id} className="here-chip here-chip--npc">
                      <Icon kind="npc" size={18} />
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
            )}
            <ExitBar exits={p.exits} onTravel={p.onTravel} onInspect={p.onInspectExit} />
            <ActionBar actions={p.actions} onRun={p.onAction} />
          </div>
          <aside className="explore__side" aria-label="Map and log">
            {p.dockedMap === undefined || p.dockedMap === null ? null : <div className="explore__map">{p.dockedMap}</div>}
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
          </aside>
        </div>
      </section>
    </RegionPalette>
  );
}

/** Focus the heading of a new place unless the traveller is busy in a dialog or on the map. */
function focusHeadingAfterMove(root: HTMLElement | null): void {
  if (root === null) return;
  const active = document.activeElement;
  const elsewhere = active !== null && active !== document.body && document.contains(active) && !root.contains(active);
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
    rootRef.current?.querySelector<HTMLElement>(`.exit-bar [data-exit-dir="${dir}"]`)?.focus();
  };
  const talkTo = firstTalk(model.npcs);
  const keys: HotkeyMap = {};
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
        }}
        seed={location.id}
        reducedMotion={reducedMotion}
        hud={model.hud}
        hudDetail={hudDetail}
        npcs={model.npcs}
        items={model.items}
        exits={model.exits}
        actions={model.actions}
        log={model.log}
        dockedMap={wide && shell.activePanel !== 'map' ? <MapPanel docked /> : null}
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
