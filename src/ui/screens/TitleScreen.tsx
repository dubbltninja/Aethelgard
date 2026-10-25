// Title (PLAN §6.3, DESIGN §16.3 `screen_title`): the wordmark over the Ruins, and the menu — Continue (the
// autosave), New game (→ Class Select), Load (→ Saves panel), Settings (→ Settings panel), Credits. ↑/↓ move through
// the menu, Enter chooses. Class Select and Credits are sub-views here, before the first `newGame` (PLAN §6.2).
import { useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from 'react';
import { TitleBackdrop } from '../art/SceneBackdrop';
import { hasPaintings, sceneManifest } from '../art/sceneManifest';
import { useTitleArt } from '../art/useBackdrop';
import { Button } from '../components/Button';
import { useHotkeys } from '../hooks/useHotkeys';
import { useViewFocus } from '../hooks/useViewFocus';
import { useShell } from '../shellContext';
import type { SlotInfo } from '../store/gameStore';
import { useStore } from '../store/useGame';
import { GAME_TITLE } from '../theme';
import { ClassSelectScreen } from './ClassSelectScreen';
import { TitleArt } from './TitleArt';

export type TitleMenuId = 'continue' | 'new' | 'load' | 'settings' | 'achievements' | 'lore' | 'credits';

export interface TitleMenuItem {
  id: TitleMenuId;
  label: string;
  /** A second line under the label (the autosave's place, or why the item is off). */
  detail?: string;
  disabled?: boolean;
}

export interface TitleMenuInput {
  continueSlot: SlotInfo | null;
  /** Any slot holds something (Load has something to show). */
  anySaved: boolean;
  canPersist: boolean;
}

/** The menu in DESIGN §16.3's order; Continue resumes the autosave and is off until one exists. */
export function titleMenu({ continueSlot, anySaved, canPersist }: TitleMenuInput): TitleMenuItem[] {
  const resume: TitleMenuItem =
    continueSlot !== null && continueSlot.status === 'ok'
      ? { id: 'continue', label: 'Continue', detail: continueSlot.summary.title }
      : { id: 'continue', label: 'Continue', detail: canPersist ? 'No autosave yet' : 'This browser keeps no saves', disabled: true };
  return [
    resume,
    { id: 'new', label: 'New game' },
    anySaved ? { id: 'load', label: 'Load' } : { id: 'load', label: 'Load', detail: 'No saves yet', disabled: true },
    { id: 'settings', label: 'Settings' },
    // DESIGN §16.3: the forty badges, read-only (U68)
    { id: 'achievements', label: 'Achievements' },
    // DESIGN §16.3 (D-104 ruling 2): Lore opens the Codex over the title, with whatever this profile has found
    { id: 'lore', label: 'Lore' },
    { id: 'credits', label: 'Credits' },
  ];
}

/** The first item a keyboard player lands on: the first one that is on. */
export function firstEnabled(items: readonly TitleMenuItem[]): TitleMenuId | null {
  return items.find((i) => !i.disabled)?.id ?? null;
}

export function Wordmark(): ReactNode {
  return (
    // The three lines are blocks, so the name is spelled out once (block spans would read as "Aethelgard : The …").
    <h1 className="wordmark" id="title-heading" aria-label={GAME_TITLE}>
      <span className="wordmark__pre">Echoes of</span>{' '}
      <span className="wordmark__name">
        <span className="wordmark__echo wordmark__echo--far" aria-hidden="true">
          Aethelgard
        </span>
        <span className="wordmark__echo wordmark__echo--near" aria-hidden="true">
          Aethelgard
        </span>
        Aethelgard
      </span>
      <span className="wordmark__sub">The Unraveling</span>
    </h1>
  );
}

export interface TitleMenuViewProps {
  items: readonly TitleMenuItem[];
  onChoose: (id: TitleMenuId) => void;
  version: string;
  menuRef?: Ref<HTMLUListElement>;
}

export function TitleMenuView({ items, onChoose, version, menuRef }: TitleMenuViewProps): ReactNode {
  const focusFirst = firstEnabled(items);
  return (
    <section className="title-card" aria-labelledby="title-heading">
      <Wordmark />
      <nav className="title-menu" aria-label="Main menu">
        <ul ref={menuRef} className="title-menu__list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="title-menu__item"
                disabled={item.disabled}
                onClick={() => onChoose(item.id)}
                aria-describedby={item.detail === undefined ? undefined : `title-menu-${item.id}-detail`}
                data-autofocus={item.id === focusFirst ? '' : undefined}
                data-menu-id={item.id}
              >
                <span className="title-menu__label">{item.label}</span>
                {item.detail === undefined ? null : (
                  <span className="title-menu__detail" id={`title-menu-${item.id}-detail`}>
                    {item.detail}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="title-card__version">Version {version}</p>
    </section>
  );
}

/** ART §8: xAI asks that Grok's output be attributed; shown once the build carries a painting. */
export const ART_CREDIT = 'Scene backdrops made with Grok Imagine; art direction by Tim Dibert.';

export function CreditsView({ onBack, artCredit = false }: { onBack: () => void; artCredit?: boolean }): ReactNode {
  return (
    <section className="title-card title-card--credits" aria-labelledby="title-heading">
      <Wordmark />
      <div className="credits" aria-labelledby="credits-heading">
        <h2 id="credits-heading" className="credits__heading">
          Credits
        </h2>
        <p className="credits__byline">A game by Tim Dibert.</p>
        <p>
          It began as a text adventure in Python. This rebuild keeps its places, its people and their lines, and turns the
          Breach into a loop you live through again and again.
        </p>
        {artCredit ? <p className="credits__art">{ART_CREDIT}</p> : null}
        <Button onClick={onBack} data-autofocus="">
          Back to title
        </Button>
      </div>
    </section>
  );
}

type TitleView = 'menu' | 'class' | 'credits';

/** ↑/↓ through the enabled menu buttons, wrapping; from outside the menu, the first (↓) or last (↑). */
export function moveMenuFocus(list: HTMLElement | null, by: 1 | -1): void {
  if (list === null) return;
  const buttons = [...list.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
  if (buttons.length === 0) return;
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = at < 0 ? (by > 0 ? 0 : buttons.length - 1) : (at + by + buttons.length) % buttons.length;
  buttons[next]?.focus();
}

export function TitleScreen({ version = __VERSION__ }: { version?: string }): ReactNode {
  const store = useStore();
  const shell = useShell();
  const [view, setView] = useState<TitleView>('menu');
  const slots = useSyncExternalStore(store.subscribe, store.shell.listSlots, store.shell.listSlots);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const titleArt = useTitleArt();
  useViewFocus(rootRef, view);

  const continueSlot = slots.find((s) => s.slot === 'auto' && s.status === 'ok') ?? null;
  const items = titleMenu({ continueSlot, anySaved: slots.some((s) => s.status !== 'empty'), canPersist: store.shell.canPersist() });
  const choose = (id: TitleMenuId): void => {
    if (id === 'continue') {
      const result = store.shell.load('auto');
      if (!result.ok) store.notify(result.error, 'error');
    } else if (id === 'new') setView('class');
    else if (id === 'load') shell.openPanel('saves');
    else if (id === 'settings') shell.openPanel('settings');
    else if (id === 'achievements') shell.openPanel('achievements');
    else if (id === 'lore') shell.openPanel('codex');
    else setView('credits');
  };

  useHotkeys(
    {
      arrowup: { run: () => moveMenuFocus(menuRef.current, -1), label: 'Move', group: 'menu' },
      arrowdown: { run: () => moveMenuFocus(menuRef.current, 1), label: 'Move', group: 'menu' },
      enter: {
        run: () => {
          const id = firstEnabled(items);
          if (id !== null) choose(id);
        },
        label: 'Choose',
        group: 'menu',
      },
    },
    { scope: 'Title', enabled: view === 'menu' },
  );
  useHotkeys({ escape: { run: () => setView('menu'), label: 'Back to title', group: 'system' } }, { scope: 'Credits', enabled: view === 'credits' });

  return (
    <div ref={rootRef} className="screen screen--title" data-screen="title" data-view={view} data-painted={titleArt.files === null ? undefined : ''}>
      {titleArt.files === null ? <TitleArt /> : <TitleBackdrop files={titleArt.files} onError={titleArt.onError} />}
      {view === 'class' ? (
        <ClassSelectScreen onBack={() => setView('menu')} />
      ) : view === 'credits' ? (
        <CreditsView onBack={() => setView('menu')} artCredit={hasPaintings(sceneManifest())} />
      ) : (
        <TitleMenuView items={items} onChoose={choose} version={version} menuRef={menuRef} />
      )}
    </div>
  );
}
