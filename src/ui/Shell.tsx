// The Shell (PLAN §6.2): the frame every screen renders inside. It owns
//   - the layout and landmarks: skip link, `<main id="main">` for the active screen, the dock (U69: the tab bar on the
//     Explore screen, then the key legend footer);
//   - the document: theme, motion and text-size attributes on <html>, and a page title that follows mode and place;
//   - the one keydown listener (hotkeys.ts / useHotkeys.ts) and the global keys: `?` keys, Ctrl+S, Ctrl+L, Ctrl+M (mute);
//   - sound (U74, hooks/useAudio.ts): the first gesture starts it, each step's events play through the event map, and a
//     panel opening or closing ticks;
//   - overlays: the active panel (PanelHost), the confirm dialog, toasts, and the polite live region that reads one
//     sentence per step.
// Pattern for later screens: render inside <Shell> (App does), declare keys with useHotkeys, open panels with
// useShell().openPanel, ask yes/no with useShell().confirm, and never manage focus by hand: give the view's first
// control `data-autofocus` (or rely on its heading) and the Shell focuses it when the screen changes.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { announceStep } from './a11y/announce';
import { focusView, isTextEntry, nativeKeysOf } from './a11y/focus';
import { LiveRegion, type Announcement } from './a11y/LiveRegion';
import { SkipLink } from './a11y/SkipLink';
import { Button } from './components/Button';
import { Callouts } from './components/Callouts';
import { DOCK_SLOT_ID } from './components/DockPortal';
import { KeyLegend } from './components/KeyLegend';
import { Modal } from './components/Modal';
import { TabBar } from './components/TabBar';
import { Toasts, noticeLifetime } from './components/Toasts';
import { toastsFor } from './components/toastModel';
import { EMPTY_QUEUE, PHONE_LIFETIME_SCALE, dismiss as dismissToast, enqueue, expire, nextExpiry } from './components/toastQueue';
import { sharedAudio, useAudio } from './hooks/useAudio';
import { useMediaQuery, useReducedMotion } from './hooks/useMediaQuery';
import { resolveHotkey, type HotkeyMap } from './hooks/hotkeys';
import { HotkeyRegistryContext, createHotkeyRegistry, useHotkeyLayers, useHotkeys, type HotkeyRegistry } from './hooks/useHotkeys';
import { PANEL_COMPONENTS, PanelHost } from './panels/PanelHost';
import { PANEL_KEYS, PANEL_TITLES, legalPanels, type PanelId } from './panels/panels';
import { ShellContext, type ConfirmOptions, type ShellApi } from './shellContext';
import type { GameStore } from './store/gameStore';
import { useGame, useGameEvents, useNotices, useProfile, useStore } from './store/useGame';
import { useProsePreload } from './text/prose';
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
  const [toastQueue, setToastQueue] = useState(EMPTY_QUEUE);
  const reducedMotion = useReducedMotion();
  const phone = useMediaQuery(PHONE_WIDTH_QUERY);
  const [toastsOpen, setToastsOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  useAudio(settings, reducedMotion);

  // ---- document ----
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') applyRootAttributes(document.documentElement, settings);
  }, [settings]);
  useEffect(() => {
    document.title = documentTitle(mode, place);
  }, [mode, place]);

  // ---- text chunks (U62a): the region's conversations and the endings, loaded ahead of need ----
  const regionId = useGame((s) => (s.mode === 'title' ? null : (store.getContent().locations[s.world.currentLocationId]?.regionId ?? null)));
  useProsePreload(regionId);

  // ---- focus: a new screen takes focus, so screen readers announce it (sub-views use useViewFocus) ----
  useEffect(() => {
    // a dialog that opened with the new screen (U65: the fight's summary) keeps focus; it returns focus when it closes
    if (document.activeElement?.closest('[role="dialog"], [role="alertdialog"]') != null) return;
    focusView(mainRef.current, { fromTop: true });
  }, [mode]);

  // ---- panels ----
  const canOpen = useCallback((id: PanelId) => PANEL_COMPONENTS[id] !== undefined && legalPanels(mode).includes(id), [mode]);
  useEffect(() => {
    if (panel !== null && !legalPanels(mode).includes(panel)) setPanel(null);
  }, [mode, panel]);
  const hadPanel = useRef(false);
  useEffect(() => {
    if ((panel !== null) !== hadPanel.current) sharedAudio().play(panel !== null ? 'sfx_ui_confirm' : 'sfx_ui_back', { vel: 0.6 });
    hadPanel.current = panel !== null;
  }, [panel]);

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
    // DESIGN §18.5: mute at once, remembered with the other settings
    'ctrl+m': {
      run: () => {
        const muted = !store.getProfile().settings.muted;
        store.shell.updateSettings({ muted });
        store.notify(muted ? 'Sound muted. Ctrl+M turns it back on.' : 'Sound on.', 'info');
      },
      label: 'Mute or unmute sound',
      group: 'system',
    },
  };
  // DESIGN §16.4 panel letters (I, Q, C, B, M, L): a panel's key works once its component is registered and the mode
  // allows it; in a fight it needs Shift (the resolver's `panel` group).
  for (const [id, key] of Object.entries(PANEL_KEYS) as [PanelId, string][]) {
    global[key] = { run: () => api.openPanel(id), label: PANEL_TITLES[id], group: 'panel', when: () => canOpen(id) };
  }

  // ---- live region and toasts ----
  useGameEvents((events, state) => {
    const text = announceStep(events, state, store.getContent(), { intentNumbers: store.getProfile().settings.showIntentNumbers });
    if (text !== null) setAnnouncement((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }));
    // the events that earn a toast (U70): a repeat merges into the one already showing (toastQueue.ts)
    const specs = toastsFor(events, store.getContent(), state.meta.loop);
    if (specs.length > 0) {
      const now = Date.now();
      const scale = phone ? PHONE_LIFETIME_SCALE : 1;
      setToastQueue((queue) => specs.reduce((acc, spec) => enqueue(acc, spec, now, scale), queue));
    }
  });
  const toastCount = notices.length + toastQueue.items.length;
  const toastPlacement = useToastAnchor(toastCount > 0, `${mode}:${place ?? ''}:${panel ?? ''}`);
  useEffect(() => {
    if (toastCount <= 1) setToastsOpen(false);
  }, [toastCount]);
  useEffect(() => {
    const at = nextExpiry(toastQueue);
    if (at === null) return undefined;
    const timer = setTimeout(() => setToastQueue((queue) => expire(queue, Date.now())), Math.max(0, at - Date.now()) + 20);
    return () => clearTimeout(timer);
  }, [toastQueue]);
  useEffect(() => {
    const timers = notices.map((n) => setTimeout(() => store.dismissNotice(n.id), noticeLifetime(n, phone ? PHONE_LIFETIME_SCALE : 1)));
    return () => timers.forEach(clearTimeout);
  }, [notices, store, phone]);

  return (
    <HotkeyRegistryContext value={registry}>
      <ShellContext value={api}>
        <GlobalKeys map={global} />
        <div className="app" data-mode={mode}>
          <SkipLink />
          <main id="main" ref={mainRef} className="screen-host" tabIndex={-1}>
            {children}
          </main>
          <div className="dock">
            <Callouts />
            <div id={DOCK_SLOT_ID} className="dock__slot" />
            {mode === 'explore' ? <TabBar /> : null}
            <footer className="legend-bar">
              <LegendFromRegistry inCombat={mode === 'combat'} />
            </footer>
          </div>
        </div>
        <Toasts
          notices={notices}
          onDismiss={(id) => store.dismissNotice(id)}
          items={toastQueue.items}
          onDismissItem={(id) => setToastQueue((queue) => dismissToast(queue, id))}
          reducedMotion={reducedMotion}
          expanded={toastsOpen}
          onToggleExpanded={() => setToastsOpen((open) => !open)}
          {...(toastPlacement === null ? {} : { placement: toastPlacement })}
        />
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

function LegendFromRegistry({ inCombat }: { inCombat: boolean }): ReactNode {
  return <KeyLegend layers={useHotkeyLayers()} inCombat={inCombat} />;
}

/** U84a: the phone breakpoint (DESIGN §16.1, 760 px). */
export const PHONE_WIDTH_QUERY = '(max-width: 759.98px)';

/**
 * U84a: where the toast stack goes — the top corner of the screen's `[data-toast-anchor]` (the place's scene, the fight's
 * stage), which holds no text, map or control; on a short screen whose band is too small, the top of the log
 * (`[data-toast-anchor-alt]`); null (the stylesheet's corner) when the screen has neither. Measured when toasts appear, when
 * the screen or panel changes and on resize.
 */
function useToastAnchor(showing: boolean, screenKey: string): CSSProperties | null {
  const [placement, setPlacement] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!showing) return undefined;
    const fits = (r: DOMRect | undefined): r is DOMRect => r !== undefined && r.width >= 160 && r.height >= 64 && r.bottom > 0 && r.top < window.innerHeight;
    const place = (): void => {
      const main = document.querySelector<HTMLElement>('[data-toast-anchor]')?.getBoundingClientRect();
      const alt = document.querySelector<HTMLElement>('[data-toast-anchor-alt]')?.getBoundingClientRect();
      const r = fits(main) ? main : fits(alt) ? alt : undefined;
      if (r === undefined) {
        setPlacement(null);
        return;
      }
      const inset = 8;
      const top = Math.max(inset, r.top + inset);
      setPlacement({
        top: `${Math.round(top)}px`,
        right: `${Math.round(Math.max(inset, window.innerWidth - r.right + inset))}px`,
        bottom: 'auto',
        left: 'auto',
        width: `${Math.round(Math.min(r.width - 2 * inset, 384))}px`,
        maxHeight: `${Math.round(Math.max(48, r.bottom - top - inset))}px`,
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [showing, screenKey]);
  return showing ? placement : null;
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
