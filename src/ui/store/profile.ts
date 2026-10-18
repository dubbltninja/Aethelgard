// A brand-new Profile (PLAN §4.3, DESIGN §14.1) and its id. The engine has no profile factory (the sim and the test
// fixtures each keep their own); the shell owns this one because only the shell may read a random source for the id.
import type { Profile, Settings } from '@engine/index';

/** DESIGN §16.3 Settings defaults; `reducedMotion: 'system'` follows `prefers-reduced-motion`. */
export const DEFAULT_SETTINGS: Settings = {
  textScale: 1,
  highContrast: false,
  reducedMotion: 'system',
  volumes: { master: 0.8, ambient: 0.6, sfx: 0.8, music: 0.5 },
  muted: false,
  autosave: true,
  showIntentNumbers: true,
  confirmFlee: true,
  logLength: 100,
};

/** Text scale steps (PLAN §6.7: 1 / 1.25 / 1.5). */
export const TEXT_SCALES: readonly Settings['textScale'][] = [1, 1.25, 1.5];

/**
 * Eight hex digits from `random` (default: `crypto.getRandomValues` where it exists, else `Math.random`). The id seeds
 * every Loop 2+ run (`${profileId}:${loop}`, PLAN §4.11), so two players' profiles should not collide.
 */
export function newProfileId(random: () => number = defaultRandom): string {
  return Math.floor(random() * 0x1_0000_0000)
    .toString(16)
    .padStart(8, '0')
    .slice(-8);
}

function defaultRandom(): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0]! / 0x1_0000_0000;
  return Math.random();
}

/** A profile with nothing known yet: Loop 1, no Echoes, default (or carried-over) settings. */
export function freshProfile(profileId: string, settings: Settings = DEFAULT_SETTINGS): Profile {
  return {
    version: 1,
    profileId,
    echoes: [],
    codexUnlocked: [],
    bestiary: {},
    achievements: {},
    resonance: 0,
    resonanceEarnedTotal: 0,
    attunements: { owned: [], equipped: [] },
    classMastery: {},
    runHistory: [],
    settings: { ...settings, volumes: { ...settings.volumes } },
    modifiers: {},
    mapKnowledge: [],
    discoveries: [],
    endingsReached: [],
    loopCounter: 1,
    newGamePlus: 0,
    lastClassId: null,
  };
}

/** `settings` with `patch` applied; `volumes` merges key by key. */
export function patchSettings(settings: Settings, patch: Partial<Settings>): Settings {
  return { ...settings, ...patch, volumes: { ...settings.volumes, ...(patch.volumes ?? {}) } };
}
