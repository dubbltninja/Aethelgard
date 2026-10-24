// U69 Settings panel: the model (volume maths, import summary), the pure form and profile block, the settings that reach the
// game (exact intent numbers, the flee question's setting), and the container over a live store.
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { memoryStorage, SETTINGS_MIRROR_KEY } from '@engine/index';
import { PanelHost } from '@ui/panels/PanelHost';
import { ProfileSection, SettingsForm } from '@ui/panels/SettingsPanel';
import { DELETE_PROFILE_ASKS, LOG_LENGTHS, VOLUMES, profileSummary, volumeFromPercent, volumePercent } from '@ui/panels/settingsModel';
import { legalActions } from '@engine/index';
import { loadScenario } from '@sim/scenarios';
import { guardModel, intentChip } from '@ui/screens/combatModel';
import { createGameStore } from '@ui/store/gameStore';
import { DEFAULT_SETTINGS, freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { fixturePack } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, nameOf } from './tree';

describe('settingsModel', () => {
  test('volumes round to steps of five and stay in 0..1', () => {
    expect(volumePercent(0.8)).toBe(80);
    expect(volumePercent(2)).toBe(100);
    expect(volumePercent(-1)).toBe(0);
    expect(volumeFromPercent(63)).toBe(0.65);
    expect(volumeFromPercent(100)).toBe(1);
    expect(volumeFromPercent(-5)).toBe(0);
    expect(VOLUMES.map((v) => v.key)).toEqual(['master', 'ambient', 'sfx', 'music']);
    expect(LOG_LENGTHS).toEqual([50, 100, 200]);
  });

  test('a profile summary reads in the singular and the plural', () => {
    const p = freshProfile('x');
    expect(profileSummary(p)).toEqual(['Loop 1', '0 Echoes, 0 codex entries', '0 achievements, 0 runs on record']);
    expect(profileSummary({ ...p, echoes: ['a'], codexUnlocked: ['c'], newGamePlus: 2, loopCounter: 4 })).toEqual(['Loop 4, New Game+ 2', '1 Echo, 1 codex entry', '0 achievements, 0 runs on record']);
  });

  test('deleting the profile asks twice, the second time naming the exported file', () => {
    expect(DELETE_PROFILE_ASKS.first).toContain('Your run saves are kept');
    expect(DELETE_PROFILE_ASKS.second('p.json')).toContain('A copy was saved as p.json');
  });
});

describe('SettingsForm', () => {
  test('every control has a name and reaches onChange with the right patch', () => {
    const changes: unknown[] = [];
    const tree = expand(<SettingsForm settings={DEFAULT_SETTINGS} onChange={(p) => changes.push(p)} />);
    expect(all(tree, 'input').every((i) => nameOf(i) !== '')).toBe(true);
    call(byName(tree, 'input', 'Show exact damage on enemy intents'), 'onChange');
    call(byName(tree, 'input', 'Ask before fleeing a fight'), 'onChange');
    call(byName(tree, 'input', '200 lines'), 'onChange');
    call(byName(tree, 'input', 'Mute all sound'), 'onChange');
    expect(changes).toEqual([{ showIntentNumbers: false }, { confirmFlee: false }, { logLength: 200 }, { muted: true }]);
  });

  test('a volume slider moves in steps and keeps the other three volumes', () => {
    const changes: { volumes: Record<string, number> }[] = [];
    const tree = expand(<SettingsForm settings={DEFAULT_SETTINGS} onChange={(p) => changes.push(p as { volumes: Record<string, number> })} />);
    const music = byName(tree, 'input', 'Music volume');
    expect(music.props.type).toBe('range');
    expect(music.props.value).toBe(50);
    expect(music.props['aria-valuetext']).toBe('50 percent');
    call(music, 'onChange', { currentTarget: { value: '73' } });
    expect(changes[0]?.volumes).toEqual({ master: 0.8, ambient: 0.6, sfx: 0.8, music: 0.75 });
  });

  test('the sound block says nothing plays yet', () => {
    expect(renderToStaticMarkup(<SettingsForm settings={DEFAULT_SETTINGS} onChange={() => undefined} />)).toContain('The game makes no sound yet');
  });

  test('without a profile block the form has none', () => {
    expect(all(expand(<SettingsForm settings={DEFAULT_SETTINGS} onChange={() => undefined} />), 'legend').map((l) => l.text)).not.toContain('Your profile');
  });
});

describe('ProfileSection', () => {
  const props = { mode: 'merge' as const, canPersist: true, onMode: () => undefined, onExport: () => undefined, onPick: () => undefined, onImport: () => undefined, onCancel: () => undefined, onDelete: () => undefined };

  test('export and delete are buttons; the picker is named', () => {
    const exp = mock(() => undefined);
    const del = mock(() => undefined);
    const tree = expand(<ProfileSection {...props} draft={{ status: 'none' }} onExport={exp} onDelete={del} />);
    call(byName(tree, 'button', 'Export profile'), 'onClick');
    call(byName(tree, 'button', 'Delete profile'), 'onClick');
    expect(byName(tree, 'input', 'Choose a profile file').props.type).toBe('file');
    expect([exp.mock.calls.length, del.mock.calls.length]).toEqual([1, 1]);
  });

  test('a refused file is an alert; a good one offers merge (default) or replace', () => {
    const refused = expand(<ProfileSection {...props} draft={{ status: 'refused', fileName: 'x.json', error: 'Profile rejected: nope' }} />);
    expect(all(refused, 'p').find((p) => p.props.role === 'alert')?.text).toBe('x.json was not imported. Profile rejected: nope');
    const modes: string[] = [];
    const ready = expand(<ProfileSection {...props} draft={{ status: 'ready', fileName: 'p.json', text: '{}', facts: ['Loop 3'] }} onMode={(m) => modes.push(m)} />);
    expect(byName(ready, 'input', 'Merge with this profile').props.checked).toBe(true);
    call(byName(ready, 'input', 'Replace this profile'), 'onChange');
    expect(modes).toEqual(['replace']);
    expect(byName(ready, 'button', 'Merge profile')).toBeDefined();
    const replacing = expand(<ProfileSection {...props} mode="replace" draft={{ status: 'ready', fileName: 'p.json', text: '{}', facts: [] }} />);
    expect(byName(replacing, 'button', 'Replace profile')).toBeDefined();
  });

  test('without storage it warns that an export is the only copy', () => {
    expect(renderToStaticMarkup(<ProfileSection {...props} canPersist={false} draft={{ status: 'none' }} />)).toContain('only copy');
  });
});

describe('SettingsPanel in a live store', () => {
  const content = fixturePack();
  test('shows the stored settings, and a change is mirrored to storage at once', () => {
    const storage = memoryStorage();
    const store = createGameStore(content, freshProfile('p'), { storage });
    store.shell.updateSettings({ logLength: 50, volumes: { master: 0.3, ambient: 0.6, sfx: 0.8, music: 0.5 } });
    const html = renderToStaticMarkup(
      <GameProvider value={store}>
        <PanelHost id="settings" onClose={() => undefined} />
      </GameProvider>,
    );
    expect(html).toContain('Your profile');
    expect(html).toMatch(/name="log-length" checked="" value="50"/);
    expect(html).toContain('30%');
    expect(storage.getItem(SETTINGS_MIRROR_KEY)).toContain('"logLength":50');
  });
});

describe('the settings that reach the fight', () => {
  const content = fixturePack();
  const fight = () => loadScenario('first_fight', content);

  function chipFor(showIntentNumbers: boolean) {
    const { state, profile } = fight();
    const p = { ...profile, settings: { ...profile.settings, showIntentNumbers } };
    const combat = state.combat!;
    const enemy = combat.enemies[0]!;
    const intent = combat.intents[enemy.uid]!;
    return { chip: intentChip({ s: state, profile: p, content }, combat, enemy, intent), state, p };
  }

  test('with exact numbers on, the chip carries its range and its Guard preview', () => {
    const { chip } = chipFor(true);
    expect(chip.range).toMatch(/\d/);
    expect(chip.label).toMatch(/\d+ (to \d+ )?damage|\d+ damage/);
  });

  test('with them off, every digit is gone from the chip and the Guard previews', () => {
    const { chip, state, p } = chipFor(false);
    expect(chip.range).toBe('damage');
    expect(chip.guarded).toBeNull();
    expect(chip.label).not.toMatch(/\d/);
    const guard = guardModel(state, content, p, legalActions(state, content, p));
    expect(guard.previews.join(' ')).not.toMatch(/\d/);
  });
});
