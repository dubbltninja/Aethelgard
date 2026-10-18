// Settings → the document root (PLAN §6.7, DESIGN §16.7, D-035): the theme and motion attributes that tokens.css and
// themes.css key on, and the root font size that scales every rem. Applied by the Shell on every settings change and
// once by main.tsx before the first paint, so a high-contrast or 150 % player never sees a flash of the defaults.
import type { Settings } from '@engine/index';

export type ThemeName = 'default' | 'high-contrast';
/** `system` defers to `prefers-reduced-motion`; `reduce` and `full` override it. */
export type MotionMode = 'system' | 'reduce' | 'full';

export interface RootAttributes {
  theme: ThemeName;
  motion: MotionMode;
  /** `html { font-size }`: 100 % / 125 % / 150 %. */
  fontSize: string;
}

export function rootAttributes(settings: Pick<Settings, 'highContrast' | 'reducedMotion' | 'textScale'>): RootAttributes {
  return {
    theme: settings.highContrast ? 'high-contrast' : 'default',
    motion: settings.reducedMotion === 'on' ? 'reduce' : settings.reducedMotion === 'off' ? 'full' : 'system',
    fontSize: `${Math.round(settings.textScale * 100)}%`,
  };
}

/** The parts of `document.documentElement` this writes. */
export interface RootElement {
  dataset: Record<string, string | undefined>;
  style: { fontSize: string };
}

export function applyRootAttributes(root: RootElement, settings: Pick<Settings, 'highContrast' | 'reducedMotion' | 'textScale'>): void {
  const attrs = rootAttributes(settings);
  root.dataset.theme = attrs.theme;
  root.dataset.motion = attrs.motion;
  root.style.fontSize = attrs.fontSize;
}

/** Whether motion is off: the setting, else the system preference (`prefersReduced`). */
export function motionReduced(setting: Settings['reducedMotion'], prefersReduced: boolean): boolean {
  return setting === 'on' || (setting === 'system' && prefersReduced);
}

/** The page title for screen-reader context (PLAN §6.7: it follows the mode and the location). */
export const GAME_NAME = 'Echoes of Aethelgard';
/** The full title, as the Title screen's heading reads. */
export const GAME_TITLE = `${GAME_NAME}: The Unraveling`;

export function documentTitle(mode: string, place: string | null): string {
  if (mode === 'title') return GAME_NAME;
  const where = mode === 'explore' && place !== null ? place : MODE_TITLES[mode] ?? mode;
  return `${where} · ${GAME_NAME}`;
}

const MODE_TITLES: Record<string, string> = {
  explore: 'Exploring',
  combat: 'Combat',
  dialogue: 'Conversation',
  threshold: 'The Threshold',
  ending: 'Ending',
};
