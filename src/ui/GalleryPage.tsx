// The component gallery (U78; PLAN §8.3 `gallery.spec.ts`): `?gallery=<panel id>` in an e2e build mounts one panel inside
// the real Shell on a fixture state (a scenario the page boots from, `?scenario=` overrides it) so a test can open it, use
// it through accessible names and hotkeys, and read back what it dispatched. Nothing here ships: `src/main.tsx` imports this
// module behind `__E2E__`, so a production bundle drops it (tests/unit/ui/galleryBoot.test.ts proves it).
//
// The stage is a heading and one "Open <panel>" button. The button is the opener, so the page can show that a panel returns
// focus to what opened it. Every action the panels dispatch is recorded on `window.__aethelgard.actions`.
import { useMemo, type ReactNode } from 'react';
import type { Action } from '@engine/index';
import { Button } from './components/Button';
import { PANEL_COMPONENTS } from './panels/PanelHost';
import { PANEL_TITLES, type PanelId } from './panels/panels';
import { Shell } from './Shell';
import { useShell } from './shellContext';
import type { GameStore } from './store/gameStore';
import { useStore } from './store/useGame';

export interface GalleryEntry {
  panel: PanelId;
  /** The scenario the page boots from: one whose mode allows the panel and whose place gives it something to show. */
  scenario: string;
}

const entry = (panel: PanelId, scenario: string): [PanelId, GalleryEntry] => [panel, { panel, scenario }];

/** Every panel that has a component, with the fixture state it is shown on. */
export const GALLERY: Readonly<Record<string, GalleryEntry>> = Object.fromEntries([
  entry('inventory', 'loop1_respite'), // a worn set, spare gear to wear and sell
  entry('equipment', 'loop1_respite'),
  entry('abilities', 'loop1_respite'), // points left unspent
  entry('merchant', 'loop1_respite'), // Kaelen's wagon, gold in hand
  entry('crafting', 'loop1_emberforge'), // the forge, ember ore
  entry('camp', 'loop1_respite'),
  entry('journal', 'loop1_day1'),
  entry('codex', 'loop1_day1'),
  entry('bestiary', 'loop1_day1'),
  entry('map', 'loop1_day1'),
  entry('timeline', 'loop2_day1'),
  entry('achievements', 'loop1_day1'),
  entry('settings', 'loop1_day1'),
  entry('saves', 'loop1_day1'),
  entry('help', 'loop1_day1'),
  entry('menu', 'loop1_day1'),
]);

/** The gallery entry for `?gallery=<id>`; an id with no component is an error naming the known ones. */
export function galleryEntry(id: string): GalleryEntry {
  const found = GALLERY[id];
  if (found === undefined || PANEL_COMPONENTS[found.panel] === undefined) throw new Error(`unknown gallery component '${id}' (known: ${Object.keys(GALLERY).join(', ')})`);
  return found;
}

const wrapped = new WeakSet<GameStore>();

/** Records every dispatched action on `window.__aethelgard.actions` (panels call `store.dispatch` when clicked). */
function recordActions(store: GameStore): Action[] {
  const w = window as unknown as { __aethelgard?: { actions?: Action[] } };
  const log: Action[] = (w.__aethelgard ??= {}).actions ?? [];
  if (!wrapped.has(store)) {
    wrapped.add(store);
    const real = store.dispatch.bind(store);
    store.dispatch = (action) => {
      log.push(action);
      return real(action);
    };
  }
  (w.__aethelgard as { actions?: Action[] }).actions = log;
  return log;
}

function Stage({ panel }: { panel: PanelId }): ReactNode {
  const shell = useShell();
  const title = PANEL_TITLES[panel];
  return (
    <section className="gallery" data-screen="gallery" aria-labelledby="gallery-heading">
      <h1 id="gallery-heading">{`Gallery · ${title}`}</h1>
      <p>{`Fixture state for the ${title.toLowerCase()} panel.`}</p>
      <Button variant="primary" onClick={() => shell.openPanel(panel)} data-autofocus="">
        {`Open ${title.toLowerCase()}`}
      </Button>
    </section>
  );
}

export function GalleryApp({ id }: { id: string }): ReactNode {
  const { panel } = galleryEntry(id);
  const store = useStore();
  useMemo(() => recordActions(store), [store]);
  return (
    <Shell>
      <Stage panel={panel} />
    </Shell>
  );
}
