// U22: the profile file and the settings mirror (PLAN §4.12, §8.1: "profile file round-trip; settings mirror").
import { describe, expect, test } from 'bun:test';
import {
  PROFILE_VERSION,
  ProfileFileSchema,
  deserializeProfile,
  exportProfile,
  importProfile,
  parseSettingsMirror,
  profileMigrations,
  serializeProfile,
  serializeSettingsMirror,
  type DeserializeProfileResult,
  type Profile,
  type SettingsMirrorResult,
} from '@engine/index';
import { deepFreeze } from '@engine/util/clone';
import { freshProfile } from '@tests/fixtures/helpers';
import { fullProfile } from '../types/handmade';
import { del, set, type Obj } from './json';

function ok(r: DeserializeProfileResult): { profile: Profile; migratedFrom: number | null } {
  if ('error' in r) throw new Error(r.error);
  return r;
}
const errorOf = (r: DeserializeProfileResult): string => {
  if (!('error' in r)) throw new Error('expected an error');
  return r.error;
};
const mirrorError = (r: SettingsMirrorResult): string => {
  if (!('error' in r)) throw new Error('expected an error');
  return r.error;
};
const fileJson = (profile: Profile, mutate?: (f: Obj) => void): Obj => {
  const f = JSON.parse(JSON.stringify(serializeProfile(profile))) as Obj;
  mutate?.(f);
  return f;
};

describe('profile file round-trip', () => {
  for (const [name, profile] of [['fresh', freshProfile()], ['full', fullProfile()]] as const) {
    test(`${name} profile: object and text round-trips deep-equal`, () => {
      const viaObject = ok(deserializeProfile(JSON.parse(JSON.stringify(serializeProfile(profile)))));
      expect(viaObject.profile).toEqual(profile);
      expect(viaObject.migratedFrom).toBeNull();
      expect(ok(importProfile(exportProfile(profile))).profile).toEqual(profile);
      expect(serializeProfile(profile)).toMatchObject({ kind: 'profile', version: PROFILE_VERSION });
      expect(exportProfile(profile)).toContain('\n  '); // pretty-printed (DESIGN §14.3)
    });
  }

  test('serialize copies; a frozen profile is fine', () => {
    const profile = deepFreeze(fullProfile());
    const file = serializeProfile(profile);
    expect(file.profile).toEqual(profile);
    expect(file.profile).not.toBe(profile);
    expect(ProfileFileSchema.safeParse(file).success).toBe(true);
    expect(profileMigrations).toEqual({});
  });
});

describe('tampered profile files', () => {
  test('bad JSON, oversized, wrong version', () => {
    expect(errorOf(importProfile('{"kind":'))).toMatch(/^Profile file is not valid JSON/);
    expect(errorOf(importProfile('x'.repeat(1_000_001)))).toMatch(/^Profile file is too large/);
    expect(errorOf(deserializeProfile(fileJson(freshProfile(), (f) => set(f, 'version', 5))))).toMatch(/Profile rejected: version: this profile was written by a newer version/);
    expect(errorOf(deserializeProfile(fileJson(freshProfile(), (f) => set(f, 'version', 0))))).toMatch(/v0, which is too old to open/);
  });

  test('missing, wrong-typed and unknown fields are named', () => {
    expect(errorOf(deserializeProfile(fileJson(freshProfile(), (f) => del(f, 'profile.echoes'))))).toBe('Profile rejected: profile.echoes: is missing (expected array)');
    expect(errorOf(deserializeProfile(fileJson(freshProfile(), (f) => set(f, 'profile.settings.volumes.master', 3))))).toMatch(/profile\.settings\.volumes\.master: Number must be less than or equal to 1/);
    expect(errorOf(deserializeProfile(fileJson(freshProfile(), (f) => set(f, 'profile.settings.textScale', 2))))).toMatch(/profile\.settings\.textScale: matches none of the allowed shapes/);
    expect(errorOf(deserializeProfile(fileJson(freshProfile(), (f) => set(f, 'profile.loopCounter', 0))))).toMatch(/profile\.loopCounter: Number must be greater than or equal to 1/);
    expect(errorOf(deserializeProfile(fileJson(freshProfile(), (f) => set(f, 'profile.cheats', true))))).toBe("Profile rejected: profile: unknown field 'cheats'");
    expect(errorOf(deserializeProfile(fileJson(freshProfile(), (f) => set(f, 'profile.runHistory', Array.from({ length: 201 }, () => ({}))))))).toMatch(/profile\.runHistory/);
  });

  test('a run save is pointed to the slots', () => {
    expect(errorOf(deserializeProfile({ kind: 'run', version: 1 }))).toBe('Profile rejected: this is a run save, not a profile file (load it into a slot)');
  });

  test('the chain also runs for profiles', () => {
    const v0 = { version: 0, kind: 'profile', profile: { ...freshProfile(), loopCounter: undefined, loops: 3 } };
    const migrations = {
      0: (o: unknown) => {
        const file = o as { profile: { loops: number } };
        const { loops, ...rest } = file.profile;
        return { ...file, profile: { ...rest, loopCounter: loops } };
      },
    };
    const out = ok(deserializeProfile(v0, { migrations }));
    expect(out.migratedFrom).toBe(0);
    expect(out.profile.loopCounter).toBe(3);
  });
});

describe('settings mirror', () => {
  test('round-trips the settings, and only the settings', () => {
    const settings = { ...freshProfile().settings, textScale: 1.5 as const, highContrast: true, muted: true };
    const text = serializeSettingsMirror(settings);
    expect(JSON.parse(text)).toEqual({ kind: 'settings', version: 1, settings });
    expect(parseSettingsMirror(text)).toEqual({ settings });
  });

  test('a damaged mirror is an error, not an exception', () => {
    expect(mirrorError(parseSettingsMirror('nope'))).toMatch(/^Settings mirror file is not valid JSON/);
    const bad = JSON.stringify({ kind: 'settings', version: 1, settings: { ...freshProfile().settings, logLength: 7 } });
    expect(mirrorError(parseSettingsMirror(bad))).toMatch(/^Settings mirror rejected: settings\.logLength/);
  });

  test('a corrupt profile still restores accessibility settings from the mirror', () => {
    const profile = { ...freshProfile(), settings: { ...freshProfile().settings, textScale: 1.25 as const, reducedMotion: 'on' as const } };
    const mirror = serializeSettingsMirror(profile.settings);
    const damaged = exportProfile(profile).replace('"echoes"', '"echos"');
    expect(errorOf(importProfile(damaged))).toMatch(/profile\.echoes: is missing/);
    expect(parseSettingsMirror(mirror)).toEqual({ settings: profile.settings });
  });
});
