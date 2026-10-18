// The Shell (PLAN §6.2): the frame every screen renders inside. It owns
//   - the layout and landmarks: skip link, `<main id="main">` for the active screen, the key legend footer;
//   - the document: theme, motion and text-size attributes on <html>, and a page title that follows mode and place;
//   - the one keydown listener (hotkeys.ts / useHotkeys.ts) and the global keys: `?` keys, Ctrl+S, Ctrl+L;
//   - overlays: the active panel (PanelHost), the confirm dialog, toasts, and the polite live region that reads one
//     sentence per step.
// Pattern for later screens: render inside <Shell> (App does), declare keys with useHotkeys, open panels with
// useShell().openPanel, ask yes/no with useShell().confirm, and never manage focus by hand: give the view's first
// control `data-autofocus` (or rely on its heading) and the Shell focuses it when the screen changes.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { announceStep } from './a11y/announce';
import { focusView, isTextEntry, nativeKeysOf } from './a11y/focus';
import { LiveRegion, type Announcement } from './a11y/LiveRegion';
import { SkipLink } from './a11y/SkipLink';
import { Button } from './components/Button';
import { KeyLegend } from './components/KeyLegend';
import { Modal } from './components/Modal';
import { Toasts, noticeLifetime } from './components/Toasts';
import { resolveHotkey, type HotkeyMap } from './hooks/hotkeys';
import { HotkeyRegistryContext, createHotkeyRegistry, useHotkeyLayers, useHotkeys, type HotkeyRegistry } from './hooks/useHotkeys';
import { PANEL_COMPONENTS, PanelHost } from './panels/PanelHost';
import { legalPanels, type PanelId } from './panels/panels';
import { ShellContext, type ConfirmOptions, type ShellApi } from './shellContext';
import type { GameStore } from './store/gameStore';
import { useGame, useGameEvents, useNotices, useProfile, useStore } from './store/useGame';
import { applyRootAttributes, documentTitle } from './theme';

interface PendingConfirm {
  message: string;
  options: ConfirmOptions;
  resolve: (yes: boolean) => void;
}

export function Shell({ children }: { children?: ReactNode }): ReactNode {
  const store = useStore();
  const mode = useGame((s) => s.mode);
  const place = useGame((s) => store.getContent().locations[s.world.currentLocationId]?.name ?? null);
  const settings = useProfile((p) => p.settings);
  const notices = useNotices();
  const registry = useMemo(createHotkeyRegistry, []);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // ---- document ----
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') applyRootAttributes(document.documentElement, settings);
  }, [settings]);
  useEffect(() => {
    document.title = documentTitle(mode, place);
  }, [mode, place]);

  // ---- focus: a new screen takes focus, so screen readers announce it (sub-views use useViewFocus) ----
  useEffect(() => {
    focusView(mainRef.current);
  }, [mode]);

  // ---- panels ----
  const canOpen = useCallback((id: PanelId) => PANEL_COMPONENTS[id] !== undefined && legalPanels(mode).includes(id), [mode]);
  useEffect(() => {
    if (panel !== null && !legalPanels(mode).includes(panel)) setPanel(null);
  }, [mode, panel]);

  const confirm = useCallback(
    (message: string, options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        setPending({ message, options, resolve });
      }),
    [],
  );
  const answer = (yes: boolean): void => {
    pending?.resolve(yes);
    setPending(null);
  };

  const api = useMemo<ShellApi>(
    () => ({
      activePanel: panel,
      openPanel: (id) => {
        if (!canOpen(id)) return false;
        setPanel(id);
        return true;
      },
      closePanel: () => setPanel(null),
      canOpen,
      confirm,
    }),
    [panel, canOpen, confirm],
  );

  // ---- keys ----
  useHotkeyListener(registry, store, confirm);
  const global: HotkeyMap = {
    '?': { run: () => api.openPanel('help'), label: 'All keys', group: 'system', when: () => canOpen('help') },
    'ctrl+s': {
      run: () => void store.shell.save('auto'),
      label: 'Save to the autosave slot',
      group: 'system',
      when: () => store.isLegal({ type: 'save', slot: 'auto' }),
    },
    'ctrl+l': { run: () => api.openPanel('saves'), label: 'Saves', group: 'system', when: () => canOpen('saves') },
  };

  // ---- live region and toasts ----
  useGameEvents((events, state) => {
    const text = announceStep(events, state, store.getContent());
    if (text !== null) setAnnouncement((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }));
  });
  useEffect(() => {
    const timers = notices.map((n) => setTimeout(() => store.dismissNotice(n.id), noticeLifetime(n)));
    return () => timers.forEach(clearTimeout);
  }, [notices, store]);

  return (
    <HotkeyRegistryContext value={registry}>
      <ShellContext value={api}>
        <GlobalKeys map={global} />
        <div className="app" data-mode={mode}>
          <SkipLink />
          <main id="main" ref={mainRef} className="screen-host" tabIndex={-1}>
            {children}
          </main>
          <footer className="legend-bar">
            <LegendFromRegistry />
          </footer>
        </div>
        <Toasts notices={notices} onDismiss={(id) => store.dismissNotice(id)} />
        <LiveRegion announcement={announcement} />
        {panel !== null ? <PanelHost id={panel} onClose={() => setPanel(null)} /> : null}
        {pending !== null ? (
          <Modal title="Are you sure?" role="alertdialog" level="dialog" onClose={() => answer(false)} hideClose className="confirm">
            <p className="confirm__message">{pending.message}</p>
            <div className="button-row">
              <Button onClick={() => answer(false)} data-autofocus="">
                {pending.options.no ?? 'Cancel'}
              </Button>
              <Button variant="danger" onClick={() => answer(true)}>
                {pending.options.yes ?? 'Yes'}
              </Button>
            </div>
          </Modal>
        ) : null}
      </ShellContext>
    </HotkeyRegistryContext>
  );
}

/** The Shell's own map lives in a child so it registers inside the registry context. */
function GlobalKeys({ map }: { map: HotkeyMap }): ReactNode {
  useHotkeys(map, { scope: 'Anywhere', level: 'global' });
  return null;
}

function LegendFromRegistry(): ReactNode {
  return <KeyLegend layers={useHotkeyLayers()} />;
}

/** One window keydown listener for the whole app: resolve against the registry, then run (or ask, then run). */
function useHotkeyListener(registry: HotkeyRegistry, store: GameStore, confirm: (message: string) => Promise<boolean>): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing) return;
      const active = document.activeElement;
      const found = resolveHotkey(registry.layers(), event, {
        inCombat: store.getState().mode === 'combat',
        focusInInput: isTextEntry(active),
        nativeKeys: nativeKeysOf(active),
        onMap: active?.closest('[data-hotkey-scope="map"]') != null,
      });
      if (found === null) return;
      event.preventDefault();
      if (found.confirm === undefined) {
        found.hotkey.run();
        return;
      }
      void confirm(found.confirm).then((yes) => {
        if (yes) found.hotkey.run();
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [registry, store, confirm]);
}
