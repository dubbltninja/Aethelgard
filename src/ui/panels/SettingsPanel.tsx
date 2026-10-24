// Settings (DESIGN §16.3 `screen_settings`, §16.7, D-035): every switch that does something today, applied at once and
// persisted (settings are not gameplay, so they skip the engine): text size, motion, high contrast, autosave, exact
// intent numbers, the flee question and the log length. The four volumes and mute are stored for the audio unit (U74)
// and say so. Keybinds and a screen-reader verbosity are not in `Settings` (C1 freeze, D-073), so they wait for a unit
// that may reshape it. The profile block exports, imports (merge or replace) and deletes the profile file.
// Pattern: container (store, files, confirms) → pure `SettingsForm` / `ProfileSection`.
import { useState, type ChangeEvent, type ReactNode } from 'react';
import { importProfile as parseProfile, exportFileName, type Settings } from '@engine/index';
import { Button } from '../components/Button';
import { useShell } from '../shellContext';
import type { ProfileImportMode } from '../store/gameStore';
import { TEXT_SCALES } from '../store/profile';
import { useProfile, useStore } from '../store/useGame';
import { downloadText, readFileText } from '../util/files';
import { DELETE_PROFILE_ASKS, LOG_LENGTHS, VOLUMES, profileSummary, volumeFromPercent, volumePercent, type ProfileDraft } from './settingsModel';

export interface ProfileSectionProps {
  draft: ProfileDraft;
  mode: ProfileImportMode;
  canPersist: boolean;
  onMode: (mode: ProfileImportMode) => void;
  onExport: () => void;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export interface SettingsFormProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  /** The profile block; the form shows it only when given (a bare form is what the unit tests render). */
  profile?: ProfileSectionProps;
}

const MOTION: { value: Settings['reducedMotion']; label: string }[] = [
  { value: 'system', label: 'Follow this device' },
  { value: 'on', label: 'Reduce motion' },
  { value: 'off', label: 'Full motion' },
];

/** Pure form (no hooks), so tests can render it and call its handlers. */
export function SettingsForm({ settings, onChange, profile }: SettingsFormProps): ReactNode {
  return (
    <form className="settings-form" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="field-group">
        <legend>Text size</legend>
        <div className="choice-row">
          {TEXT_SCALES.map((scale) => (
            <label key={scale} className="choice">
              <input
                type="radio"
                name="text-scale"
                value={String(scale)}
                checked={settings.textScale === scale}
                onChange={() => onChange({ textScale: scale })}
              />
              <span>{Math.round(scale * 100)}%</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field-group">
        <legend>Motion</legend>
        <div className="choice-row">
          {MOTION.map((m) => (
            <label key={m.value} className="choice">
              <input type="radio" name="motion" value={m.value} checked={settings.reducedMotion === m.value} onChange={() => onChange({ reducedMotion: m.value })} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field-group">
        <legend>Display and saving</legend>
        <div className="choice-row">
          <label className="choice">
            <input type="checkbox" name="high-contrast" checked={settings.highContrast} onChange={() => onChange({ highContrast: !settings.highContrast })} />
            <span>High contrast</span>
          </label>
          <label className="choice">
            <input type="checkbox" name="autosave" checked={settings.autosave} onChange={() => onChange({ autosave: !settings.autosave })} />
            <span>Autosave at each checkpoint</span>
          </label>
        </div>
      </fieldset>
      <fieldset className="field-group">
        <legend>Play</legend>
        <div className="choice-row">
          <label className="choice">
            <input type="checkbox" name="intent-numbers" checked={settings.showIntentNumbers} onChange={() => onChange({ showIntentNumbers: !settings.showIntentNumbers })} />
            <span>Show exact damage on enemy intents</span>
          </label>
          <label className="choice">
            <input type="checkbox" name="confirm-flee" checked={settings.confirmFlee} onChange={() => onChange({ confirmFlee: !settings.confirmFlee })} />
            <span>Ask before fleeing a fight</span>
          </label>
        </div>
      </fieldset>
      <fieldset className="field-group">
        <legend>Log length</legend>
        <div className="choice-row">
          {LOG_LENGTHS.map((n) => (
            <label key={n} className="choice">
              <input type="radio" name="log-length" value={String(n)} checked={settings.logLength === n} onChange={() => onChange({ logLength: n })} />
              <span>{n} lines</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field-group">
        <legend>Sound</legend>
        <p className="field__hint">The game makes no sound yet. Your levels are saved now and apply when it does.</p>
        <div className="choice-row">
          <label className="choice">
            <input type="checkbox" name="mute" checked={settings.muted} onChange={() => onChange({ muted: !settings.muted })} />
            <span>Mute all sound</span>
          </label>
        </div>
        <div className="sliders">
          {VOLUMES.map(({ key, label }) => {
            const percent = volumePercent(settings.volumes[key]);
            return (
              <label key={key} className="slider">
                <span className="slider__label">{label}</span>
                <input
                  type="range"
                  name={`volume-${key}`}
                  aria-label={label}
                  min={0}
                  max={100}
                  step={5}
                  value={percent}
                  aria-valuetext={`${percent} percent`}
                  onChange={(e) => onChange({ volumes: { ...settings.volumes, [key]: volumeFromPercent(Number(e.currentTarget.value)) } })}
                />
                <output className="slider__value">{percent}%</output>
              </label>
            );
          })}
        </div>
      </fieldset>
      {profile === undefined ? null : <ProfileSection {...profile} />}
    </form>
  );
}

/** Pure profile block: export, import with merge or replace, delete. */
export function ProfileSection({ draft, mode, canPersist, onMode, onExport, onPick, onImport, onCancel, onDelete }: ProfileSectionProps): ReactNode {
  return (
    <fieldset className="field-group profile-block">
      <legend>Your profile</legend>
      <p className="field__hint">The profile holds what you carry between loops: Echoes, codex, achievements. Run saves are kept apart, in the Saves panel.</p>
      <div className="button-row">
        <Button onClick={onExport}>Export profile</Button>
        <label className="btn btn--secondary file-pick">
          <input className="file-pick__input" type="file" accept=".json,application/json" onChange={onPick} aria-label="Choose a profile file" />
          <span aria-hidden="true">Choose a profile file</span>
        </label>
      </div>
      {draft.status === 'refused' ? (
        <p className="import__refused" role="alert">
          {draft.fileName} was not imported. {draft.error}
        </p>
      ) : null}
      {draft.status === 'ready' ? (
        <div className="import__preview" role="group" aria-label={`Preview of ${draft.fileName}`}>
          <p className="import__file">{draft.fileName}</p>
          {draft.facts.map((fact) => (
            <p key={fact} className="slot__time">
              {fact}
            </p>
          ))}
          <div className="choice-row">
            <label className="choice">
              <input type="radio" name="profile-import-mode" value="merge" checked={mode === 'merge'} onChange={() => onMode('merge')} />
              <span>Merge with this profile</span>
            </label>
            <label className="choice">
              <input type="radio" name="profile-import-mode" value="replace" checked={mode === 'replace'} onChange={() => onMode('replace')} />
              <span>Replace this profile</span>
            </label>
          </div>
          <div className="button-row">
            <Button variant="primary" onClick={onImport}>
              {mode === 'merge' ? 'Merge profile' : 'Replace profile'}
            </Button>
            <Button variant="quiet" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {canPersist ? null : <p className="field__hint">This browser keeps no data for the page, so a profile exported here is the only copy.</p>}
      <div className="button-row">
        <Button variant="danger" onClick={onDelete}>
          Delete profile
        </Button>
      </div>
    </fieldset>
  );
}

export function SettingsPanel(): ReactNode {
  const store = useStore();
  const shell = useShell();
  const settings = useProfile((p) => p.settings);
  const [draft, setDraft] = useState<ProfileDraft>({ status: 'none' });
  const [mode, setMode] = useState<ProfileImportMode>('merge');

  const exportNow = (): string | null => {
    const name = exportFileName('profile', null, store.shell.timestamp());
    if (downloadText(name, store.shell.exportProfile())) return name;
    store.notify('This browser would not start the download.', 'error');
    return null;
  };
  const pick = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    void readFileText(file).then((text) => {
      input.value = '';
      if (text === null) {
        setDraft({ status: 'refused', fileName: file.name, error: 'The file could not be read.' });
        return;
      }
      const parsed = parseProfile(text);
      setDraft('error' in parsed ? { status: 'refused', fileName: file.name, error: parsed.error } : { status: 'ready', fileName: file.name, text, facts: profileSummary(parsed.profile) });
    });
  };
  const importNow = (): void => {
    if (draft.status !== 'ready') return;
    const apply = (): void => {
      const result = store.shell.importProfile(draft.text, mode);
      if (result.ok) {
        store.notify(mode === 'merge' ? 'Profile merged.' : 'Profile replaced.', 'success');
        setDraft({ status: 'none' });
      } else {
        store.notify(result.error, 'error');
      }
    };
    if (mode === 'merge') apply();
    else void shell.confirm('Replace this profile with the file? What this browser holds now is lost; export it first if you want a copy.', { yes: 'Replace' }).then((yes) => yes && apply());
  };
  const remove = (): void => {
    void shell.confirm(DELETE_PROFILE_ASKS.first, { yes: 'Export and continue', no: 'Keep my profile' }).then((first) => {
      if (!first) return;
      const name = exportNow();
      if (name === null) return;
      void shell.confirm(DELETE_PROFILE_ASKS.second(name), { yes: 'Delete profile', no: 'Keep my profile' }).then((second) => {
        if (!second) return;
        store.shell.resetProfile();
        shell.closePanel();
        store.notify('Profile deleted. A fresh one has begun.', 'info');
      });
    });
  };

  return (
    <SettingsForm
      settings={settings}
      onChange={(patch) => store.shell.updateSettings(patch)}
      profile={{
        draft,
        mode,
        canPersist: store.shell.canPersist(),
        onMode: setMode,
        onExport: () => {
          const name = exportNow();
          if (name !== null) store.notify(`Profile exported as ${name}.`, 'success');
        },
        onPick: pick,
        onImport: importNow,
        onCancel: () => setDraft({ status: 'none' }),
        onDelete: remove,
      }}
    />
  );
}
