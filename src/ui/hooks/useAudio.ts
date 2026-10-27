// The audio wiring (U74; PLAN §6.5, DESIGN §18.1, §18.5): one engine per page, shared by the Shell, the Settings panel
// and (in e2e builds) `window.__aethelgard.audio`. The Shell's `useAudio` unlocks the context on the first user gesture,
// keeps the levels and reduced motion in step with the settings, suspends audio while the tab is hidden, and turns each
// step's events into sounds through the event map. Audio never throws into the UI (the engine swallows its errors).
// U75 adds the ambient layer: `sceneOf` turns the state into where the player is and what is happening, and `useAudio`
// hands each change to the controller in `@audio/ambient` (the region bed, the Threshold drone, the Tyrant theme).
import { useEffect, useMemo, useRef } from 'react';
import { createAmbient, NO_SCENE, type Ambient, type AmbientScene } from '@audio/ambient/ambient';
import { createAudioEngine, type AudioEngine } from '@audio/engine/engine';
import { createCueMapper } from '@audio/map/map';
import type { ContentPack, GameState, Settings } from '@engine/index';
import { shallowEqual, useContent, useGame, useGameEvents } from '../store/useGame';

let shared: AudioEngine | null = null;

export function sharedAudio(): AudioEngine {
  shared ??= createAudioEngine();
  return shared;
}

const ambients = new WeakMap<AudioEngine, Ambient>();

/** The ambient layer of an engine (one each; the page's shared engine has the page's shared one). */
export function ambientFor(audio: AudioEngine): Ambient {
  let a = ambients.get(audio);
  if (a === undefined) {
    a = createAmbient(audio);
    ambients.set(audio, a);
  }
  return a;
}

export const sharedAmbient = (): Ambient => ambientFor(sharedAudio());

/** Art templates that are indoors: their region's bed plays through a darker filter (DESIGN §18.2 gives interiors none). */
const INTERIORS: ReadonlySet<string> = new Set(['cavern', 'archive', 'sanctum', 'undercity', 'observatory']);
const FIGHT_OVER: ReadonlySet<string> = new Set(['victory', 'defeat', 'fled']);

/**
 * What the ambient layer needs to know (a flat object, so `shallowEqual` keeps the hook from re-rendering): the place's
 * bed (its own preset, else its region's), whether it is indoors or infected, and the Tyrant's fight (DESIGN §18.4).
 * Silence on the Title (no world has begun, and it is where volumes are set) and in the endings.
 */
export function sceneOf(state: GameState, content: ContentPack): AmbientScene {
  if (state.mode === 'title' || state.mode === 'ending') return NO_SCENE;
  const here = state.world.currentLocationId;
  const loc = content.locations[here];
  const combat = state.combat;
  const tyrant =
    state.mode === 'combat' && combat !== null && !FIGHT_OVER.has(combat.phase) ? combat.enemies.find((e) => e.alive && e.refId.startsWith('cr_chronos_tyrant')) : undefined;
  return {
    bed: loc === undefined ? null : (loc.ambient ?? content.regions[loc.regionId]?.ambient ?? null),
    interior: loc !== undefined && INTERIORS.has(loc.art.template),
    infected: state.world.hordeActive || state.world.infected.includes(here),
    tyrant: tyrant === undefined || combat === null ? -1 : combat.communion !== null ? combat.communion.movement - 1 : tyrant.phase,
    resolve: tyrant === undefined || combat === null ? -1 : (combat.communion?.resolve ?? -1),
  };
}

/** The input events that count as a user gesture for starting audio (HTML's activation-triggering events). */
export const GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const;

/** Which side of the stage a combatant is on: −1 the party (left), 1 a foe (right), 0 when not in a fight. */
export function sideOf(state: GameState): (uid: string) => number {
  const combat = state.combat;
  if (combat === null) return () => 0;
  return (uid) => (combat.party.some((c) => c.uid === uid) ? -0.35 : combat.enemies.some((c) => c.uid === uid) ? 0.35 : 0);
}

export function useAudio(settings: Settings, reducedMotion: boolean, audio: AudioEngine = sharedAudio(), ambient: Ambient = ambientFor(audio)): void {
  const mapper = useMemo(createCueMapper, []);
  const content = useContent();
  const scene = useGame((s) => sceneOf(s, content), shallowEqual);
  useEffect(() => ambient.set(scene), [ambient, scene]);
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
