// The audio wiring (U74; PLAN §6.5, DESIGN §18.1, §18.5): one engine per page, shared by the Shell, the Settings panel
// and (in e2e builds) `window.__aethelgard.audio`. The Shell's `useAudio` unlocks the context on the first user gesture,
// keeps the levels and reduced motion in step with the settings, suspends audio while the tab is hidden, and turns each
// step's events into sounds through the event map. Audio never throws into the UI (the engine swallows its errors).
import { useEffect, useMemo, useRef } from 'react';
import { createAudioEngine, type AudioEngine } from '@audio/engine/engine';
import { createCueMapper } from '@audio/map/map';
import type { GameState, Settings } from '@engine/index';
import { useGameEvents } from '../store/useGame';

let shared: AudioEngine | null = null;

export function sharedAudio(): AudioEngine {
  shared ??= createAudioEngine();
  return shared;
}

/** The input events that count as a user gesture for starting audio (HTML's activation-triggering events). */
export const GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const;

/** Which side of the stage a combatant is on: −1 the party (left), 1 a foe (right), 0 when not in a fight. */
export function sideOf(state: GameState): (uid: string) => number {
  const combat = state.combat;
  if (combat === null) return () => 0;
  return (uid) => (combat.party.some((c) => c.uid === uid) ? -0.35 : combat.enemies.some((c) => c.uid === uid) ? 0.35 : 0);
}

export function useAudio(settings: Settings, reducedMotion: boolean, audio: AudioEngine = sharedAudio()): void {
  const mapper = useMemo(createCueMapper, []);
  const { volumes, muted } = settings;
  useEffect(() => audio.setLevels({ volumes, muted }), [audio, volumes, muted]);
  useEffect(() => audio.setReducedMotion(reducedMotion), [audio, reducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const unlock = (): void => {
      void audio.unlock().then((running) => {
        if (running || audio.state() === 'unavailable') for (const g of GESTURES) window.removeEventListener(g, unlock, true);
      });
    };
    const visibility = (): void => (document.hidden ? audio.suspend() : audio.resume());
    for (const g of GESTURES) window.addEventListener(g, unlock, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      for (const g of GESTURES) window.removeEventListener(g, unlock, true);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [audio]);

  useGameEvents((events, state) => audio.playCues(mapper(events, sideOf(state))));
}

/** A test sound shortly after a Settings change (debounced, so dragging a slider plays once when it settles). */
export function useTestSound(audio: AudioEngine = sharedAudio(), delayMs = 250): (bus: 'master' | 'sfx' | 'ambient' | 'music') => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current !== null && clearTimeout(timer.current)), []);
  return (bus) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (bus === 'music') audio.play('sfx_perc_kick');
      else audio.play('sfx_ui_confirm', bus === 'ambient' ? { bus: 'ambient' } : { bus: 'sfx' });
    }, delayMs);
  };
}
