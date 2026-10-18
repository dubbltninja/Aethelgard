// The MapPanel (PLAN §6.3, DESIGN §16.6): the illustrated node map of the places this Wayfinder knows — visited and
// remembered ones named, their unexplored neighbours as "?" ghosts, the Horde's infected nodes hatched, the Library's
// way out marked while the Horde runs. Every node is a real button with its name and state ("Crumbling Archway,
// visited, north, cleared"). Travel: choose a node (click/tap, or the arrow keys and WASD with the map focused) to see
// the route preview — watches and the time it lands on, the risk, a lock's reason, a companion's restriction — then
// choose it again, press Enter, or Go. A node further away routes over known ways and Go takes the first step.
//
// Two placements, one component: the overlay panel (M, the Map button; PANEL_COMPONENTS) and, on wide desktops,
// docked in the Explore screen's side column (PLAN §6.3 "docked on desktop ≥ 1100px"). The container holds the
// selection and the keys; `MapView` is pure.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { Icon } from '../art/Icon';
import { scenePalette } from '../art/palettes';
import { Button, cx } from '../components/Button';
import { useHotkeys, type HotkeyLevel } from '../hooks/useHotkeys';
import { legalSet } from '../screens/exploreModel';
import { useContent, useGame, useLegal, useProfile, useStore } from '../store/useGame';
import {
  buildMap,
  neighbourIn,
  nodeLabel,
  routeTo,
  travelPreview,
  type MapEdge,
  type MapModel,
  type MapNode,
  type Route,
  type TravelPreview,
} from './mapModel';
import type { Dir } from '@schema/location';

export interface MapViewProps {
  model: MapModel;
  selected: string | null;
  preview: TravelPreview | null;
  route: Route | null;
  /** In the Explore screen's side column (no autofocus, a smaller frame). */
  docked?: boolean;
  onNode: (id: string) => void;
  onGo: () => void;
  onCenter: () => void;
  viewportRef?: Ref<HTMLDivElement>;
}

function edgePath(edge: MapEdge, a: MapNode, b: MapNode): string {
  if (edge.kind === 'walk') return `M${a.px} ${a.py} L${b.px} ${b.py}`;
  // roads and portals bow away from the straight line, so no node lies on them (WORLD §11.2, §11.4)
  const mx = (a.px + b.px) / 2;
  const my = (a.py + b.py) / 2;
  const dx = b.px - a.px;
  const dy = b.py - a.py;
  const len = Math.max(1, Math.hypot(dx, dy));
  const bow = edge.kind === 'road' ? 0.22 : 0.3;
  return `M${a.px} ${a.py} Q ${Math.round(mx - (dy / len) * len * bow)} ${Math.round(my + (dx / len) * len * bow)} ${b.px} ${b.py}`;
}

const onRoute = (route: Route | null, edge: MapEdge): boolean =>
  route?.legs.some((l) => (l.from === edge.a && l.to === edge.b) || (l.from === edge.b && l.to === edge.a)) ?? false;

export function MapView({ model, selected, preview, route, docked = false, onNode, onGo, onCenter, viewportRef }: MapViewProps): ReactNode {
  const byId = new Map(model.nodes.map((n) => [n.id, n] as const));
  return (
    <div className={cx('map', docked && 'map--docked')} data-hotkey-scope="map">
      <div className="map__toolbar">
        <p className="map__hint">{docked ? 'Map' : 'Choose a place, then choose it again or press Go.'}</p>
        <Button variant="quiet" className="map__center" onClick={onCenter}>
          <Icon kind="center" size={18} />
          Center on me
        </Button>
      </div>
      <div className="map__viewport" ref={viewportRef}>
        <div className="map__canvas" style={{ width: model.width, height: model.height }}>
          <svg className="map__edges" width={model.width} height={model.height} aria-hidden="true" focusable="false">
            {model.edges.map((edge) => {
              const a = byId.get(edge.a);
              const b = byId.get(edge.b);
              if (a === undefined || b === undefined) return null;
              return (
                <path
                  key={edge.key}
                  d={edgePath(edge, a, b)}
                  className={cx('map-edge', `map-edge--${edge.state}`, `map-edge--${edge.kind}`, edge.infected && 'map-edge--infected', onRoute(route, edge) && 'map-edge--route')}
                />
              );
            })}
          </svg>
          {model.regions.map((r) => (
            <span key={r.regionId} className="map__region" style={{ left: r.px, top: r.py }} aria-hidden="true">
              {r.name}
            </span>
          ))}
          {model.edges
            .filter((e) => e.state === 'locked')
            .map((edge) => {
              const a = byId.get(edge.a);
              const b = byId.get(edge.b);
              if (a === undefined || b === undefined) return null;
              return (
                <span key={`lock-${edge.key}`} className="map__lock" style={{ left: (a.px + b.px) / 2, top: (a.py + b.py) / 2 }} aria-hidden="true">
                  <Icon kind="lock" size={14} />
                </span>
              );
            })}
          <ul className="map__nodes" aria-label="Places on the map">
            {model.nodes.map((node) => (
              <li key={node.id} className="map__node-slot" style={{ left: node.px, top: node.py }}>
                <button
                  type="button"
                  className={cx(
                    'map-node',
                    `map-node--${node.state}`,
                    node.infected && 'map-node--infected',
                    node.escape && 'map-node--escape',
                    node.id === selected && 'map-node--selected',
                  )}
                  data-node={node.id}
                  aria-label={nodeLabel(node, node.id === selected ? preview : null)}
                  aria-current={node.state === 'current' ? 'location' : undefined}
                  data-autofocus={!docked && node.state === 'current' ? '' : undefined}
                  style={{ '--node-tint': scenePalette(node.regionId).accent } as CSSProperties}
                  onClick={() => onNode(node.id)}
                >
                  <span className="map-node__sigil" aria-hidden="true">
                    {node.escape ? <Icon kind="door" size={18} /> : node.glyph}
                  </span>
                  {node.name === null ? null : (
                    <span className="map-node__name" aria-hidden="true">
                      {node.name}
                    </span>
                  )}
                  <span className="map-node__marks" aria-hidden="true">
                    {node.boss ? <Icon kind="crown" size={12} /> : node.danger !== null ? <Icon kind="danger" size={12} /> : node.cleared ? <Icon kind="check" size={12} /> : null}
                    {node.npc ? <Icon kind="npc" size={12} /> : null}
                    {node.unstable ? <Icon kind="hourglass" size={12} /> : null}
                    {node.infected ? <Icon kind="infected" size={12} /> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="map__preview" aria-live="polite">
        {preview === null ? (
          docked ? null : <p className="map__preview-empty">You are at {model.nodes.find((n) => n.id === model.currentId)?.name ?? 'an unknown place'}.</p>
        ) : (
          <MapPreview preview={preview} onGo={onGo} />
        )}
      </div>
      {docked ? null : <MapLegend />}
    </div>
  );
}

function MapPreview({ preview, onGo }: { preview: TravelPreview; onGo: () => void }): ReactNode {
  const far = preview.next !== null && preview.next !== preview.target;
  return (
    <div className="map-preview" data-target={preview.target}>
      <p className="map-preview__name">{preview.name}</p>
      <ul className="map-preview__facts">
        {preview.cost === null ? null : (
          <li>
            <Icon kind="clock" size={16} />
            {preview.cost}
          </li>
        )}
        {preview.risk === null ? null : (
          <li>
            <Icon kind="danger" size={16} />
            {preview.risk}
          </li>
        )}
        {preview.danger === null ? null : (
          <li className="map-preview__danger">
            <Icon kind="infected" size={16} />
            {preview.danger}
          </li>
        )}
        {preview.companion === null ? null : (
          <li>
            <Icon kind="npc" size={16} />
            {preview.companion}
          </li>
        )}
        {preview.locked === null ? null : (
          <li className="map-preview__locked">
            <Icon kind="lock" size={16} />
            {preview.locked}
          </li>
        )}
      </ul>
      {preview.canGo ? (
        <Button variant="primary" className="map-preview__go" onClick={onGo}>
          {far ? `Go: first to ${preview.nextName ?? ''}` : `Go to ${preview.name}`}
        </Button>
      ) : null}
    </div>
  );
}

function MapLegend(): ReactNode {
  return (
    <details className="map__legend">
      <summary>Legend</summary>
      <ul className="map__legend-list">
        <li>
          <span className="legend-swatch legend-swatch--current" aria-hidden="true" /> You are here
        </li>
        <li>
          <span className="legend-swatch legend-swatch--visited" aria-hidden="true" /> Visited this loop
        </li>
        <li>
          <span className="legend-swatch legend-swatch--remembered" aria-hidden="true" /> Remembered from an earlier loop
        </li>
        <li>
          <span className="legend-swatch legend-swatch--adjacent" aria-hidden="true" /> Not yet explored
        </li>
        <li>
          <Icon kind="check" size={14} /> Cleared · <Icon kind="danger" size={14} /> a fight waits · <Icon kind="crown" size={14} /> a boss
        </li>
        <li>
          <Icon kind="npc" size={14} /> Someone is there · <Icon kind="lock" size={14} /> a locked way
        </li>
        <li>
          <Icon kind="infected" size={14} /> The Horde has reached it · <Icon kind="door" size={14} /> the way out
        </li>
      </ul>
    </details>
  );
}

const MAP_KEYS: readonly [string, Dir, string][] = [
  ['arrowup', 'north', 'Select the way north'],
  ['arrowdown', 'south', 'Select the way south'],
  ['arrowleft', 'west', 'Select the way west'],
  ['arrowright', 'east', 'Select the way east'],
  ['w', 'north', 'Select the way north'],
  ['s', 'south', 'Select the way south'],
  ['a', 'west', 'Select the way west'],
  ['d', 'east', 'Select the way east'],
];

/** Centres `node` in `viewport` (instantly under reduced motion: smooth scrolling is off in themes.css). */
export function centerOn(viewport: HTMLElement | null, node: { px: number; py: number } | undefined): void {
  if (viewport === null || node === undefined) return;
  viewport.scrollTo({ left: node.px - viewport.clientWidth / 2, top: node.py - viewport.clientHeight / 2 });
}

export function MapPanel({ docked = false }: { docked?: boolean } = {}): ReactNode {
  const store = useStore();
  const content = useContent();
  const state = useGame((s) => s);
  const profile = useProfile((p) => p);
  const legal = useLegal();
  const [chosen, setChosen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const model = useMemo(() => buildMap(state, content, profile), [state, content, profile]);
  const isLegal = useMemo(() => legalSet(legal), [legal]);
  const selected = chosen !== null && chosen !== model.currentId && model.nodes.some((n) => n.id === chosen) ? chosen : null;
  const preview = selected === null ? null : travelPreview(state, content, profile, model, selected, (to) => isLegal({ type: 'move', to }));
  const route = selected === null ? null : routeTo(state, content, profile, model, selected);
  const current = model.nodes.find((n) => n.id === model.currentId);

  const go = (): void => {
    if (preview === null || !preview.canGo || preview.next === null) return;
    const arrived = preview.next === preview.target;
    store.dispatch({ type: 'move', to: preview.next });
    if (arrived) setChosen(null);
  };
  const onNode = (id: string): void => {
    if (id === model.currentId) setChosen(null);
    else if (id === selected && preview?.canGo === true) go();
    else setChosen(id);
  };
  const inMap = (): boolean => rootRef.current?.contains(document.activeElement) ?? false;
  const focusNode = (id: string): void => rootRef.current?.querySelector<HTMLElement>(`[data-node="${id}"]`)?.focus();
  const pick = (dir: Dir): void => {
    const id = neighbourIn(model, dir);
    if (id === null) return;
    setChosen(id);
    focusNode(id);
  };

  const keys = Object.fromEntries(
    MAP_KEYS.map(([key, dir, label]) => [key, { run: () => pick(dir), label, group: 'map' as const, when: inMap, hidden: key.length === 1 }]),
  );
  keys.enter = { run: go, label: 'Travel to the chosen place', group: 'map', when: () => inMap() && preview?.canGo === true, hidden: false };
  const level: HotkeyLevel = docked ? 'screen' : 'inPanel';
  useHotkeys(keys, { scope: 'Map', level });

  // Open centred on the Wayfinder, and follow them as they travel.
  useLayoutEffect(() => {
    centerOn(viewportRef.current, current);
  }, [current?.px, current?.py]);

  return (
    <div ref={rootRef} className="map-panel" data-docked={docked ? 'true' : 'false'}>
      <MapView
        model={model}
        selected={selected}
        preview={preview}
        route={route}
        docked={docked}
        onNode={onNode}
        onGo={go}
        onCenter={() => centerOn(viewportRef.current, current)}
        viewportRef={viewportRef}
      />
    </div>
  );
}
