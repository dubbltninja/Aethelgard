// The Settings panel's model (DESIGN §16.3 `screen_settings`, §16.7, D-035): the choices each setting offers, the volume
// maths, and the words for an imported profile's preview. Pure.
import type { Profile, Settings } from '@engine/index';

export const LOG_LENGTHS: readonly Settings['logLength'][] = [50, 100, 200];

export type VolumeKey = keyof Settings['volumes'];

export const VOLUMES: readonly { key: VolumeKey; label: string }[] = [
  { key: 'master', label: 'Master volume' },
  { key: 'ambient', label: 'Ambient volume' },
  { key: 'sfx', label: 'Effects volume' },
  { key: 'music', label: 'Music volume' },
];

/** 0..1 → a whole percent for the slider and its spoken value. */
export const volumePercent = (volume: number): number => Math.round(Math.min(1, Math.max(0, volume)) * 100);

/** A slider's percent → the stored 0..1 (a step of 5 keeps the stored numbers short). */
export const volumeFromPercent = (percent: number): number => Math.min(1, Math.max(0, Math.round(percent / 5) * 5 / 100));

/** What an imported profile file holds, for the preview before it is merged or swapped in. */
export function profileSummary(profile: Profile): string[] {
  const achievements = Object.keys(profile.achievements).length;
  return [
    `Loop ${profile.loopCounter}${profile.newGamePlus > 0 ? `, New Game+ ${profile.newGamePlus}` : ''}`,
    `${profile.echoes.length} Echo${profile.echoes.length === 1 ? '' : 'es'}, ${profile.codexUnlocked.length} codex entr${profile.codexUnlocked.length === 1 ? 'y' : 'ies'}`,
    `${achievements} achievement${achievements === 1 ? '' : 's'}, ${profile.runHistory.length} run${profile.runHistory.length === 1 ? '' : 's'} on record`,
  ];
}

export type ProfileDraft =
  | { status: 'none' }
  | { status: 'refused'; fileName: string; error: string }
  | { status: 'ready'; fileName: string; text: string; facts: string[] };

/** The two questions before the profile is deleted (DESIGN §14.2: "asks twice and exports first"). */
export const DELETE_PROFILE_ASKS = {
  first: 'Delete your profile? Every Echo, codex entry, achievement and attunement is erased and you return to the title. Your run saves are kept.',
  second: (fileName: string): string => `A copy was saved as ${fileName}. Delete the profile from this browser now? This cannot be undone.`,
} as const;
