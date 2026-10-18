// Settings (DESIGN §16.3 `screen_settings`, D-035) — U63's first cut: the accessibility switches the tokens and
// themes need (text size, high contrast, reduced motion) and autosave. Changes apply at once and persist (they are
// not gameplay, so they skip the engine). U69 adds volumes, mute, keybinds, verbosity and profile export/import.
import type { ReactNode } from 'react';
import type { Settings } from '@engine/index';
import { TEXT_SCALES } from '../store/profile';
import { useProfile, useStore } from '../store/useGame';

export interface SettingsFormProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

const MOTION: { value: Settings['reducedMotion']; label: string }[] = [
  { value: 'system', label: 'Follow this device' },
  { value: 'on', label: 'Reduce motion' },
  { value: 'off', label: 'Full motion' },
];

/** Pure form (no hooks), so tests can render it and call its handlers. */
export function SettingsForm({ settings, onChange }: SettingsFormProps): ReactNode {
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
    </form>
  );
}

export function SettingsPanel(): ReactNode {
  const store = useStore();
  const settings = useProfile((p) => p.settings);
  return <SettingsForm settings={settings} onChange={(patch) => store.shell.updateSettings(patch)} />;
}
