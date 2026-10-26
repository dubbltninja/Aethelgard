// The sound audition page (U74, dev and e2e builds only: `?audition`, wired in main.tsx; production drops it): a button
// per sound and per variant, so a person can hear all 30 (and the two percussion hits) by name and say what to change.
// U75 adds the region beds, the Threshold drone and the Tyrant theme (with a phase and a communion-resolve control).
// Plain DOM, no React, so the same module also bundles on its own.
import { NO_SCENE, type Ambient, type AmbientScene } from '../ambient/ambient';
import type { AudioEngine } from '../engine/engine';
import type { SoundId, SoundParams } from './sfx';

interface Entry extends SoundParams {
  id: SoundId;
  note: string;
}

const E = (id: SoundId, note: string, p: SoundParams = {}): Entry => ({ id, note, ...p });

/** The page's groups (a function, so a production bundle that never mounts the page keeps none of it). */
export const auditionGroups = (): readonly (readonly [string, readonly Entry[]])[] => [
  ['Interface', [E('sfx_ui_tick', 'a line of dialogue, equip'), E('sfx_ui_confirm', 'item taken, quest advanced, a panel opens'), E('sfx_ui_back', 'a panel closes, unequip'), E('sfx_ui_error', 'an action refused')]],
  ['World', [E('sfx_travel', 'entering a place'), E('sfx_rest_dawn', 'resting; a new loop'), E('sfx_coin', 'gold, buying, selling'), E('sfx_forge_hammer', 'crafting, upgrading')]],
  [
    'Blows',
    [
      E('sfx_hit_physical', 'physical'),
      E('sfx_hit_fire', 'fire'),
      E('sfx_hit_storm', 'storm'),
      E('sfx_hit_ley', 'ley'),
      E('sfx_hit_void', 'void; Corruption rises'),
      E('sfx_hit_chrono', 'chrono'),
      E('sfx_crit', 'critical (physical)'),
      E('sfx_crit', 'critical (fire)', { variant: 'fire' }),
      E('sfx_crit', 'critical (void)', { variant: 'void' }),
      E('sfx_miss', 'a miss, a failed flight'),
    ],
  ],
  [
    'Defence and statuses',
    [
      E('sfx_guard', 'Guard; a blow absorbed'),
      E('sfx_shield_up', 'Shield applied'),
      E('sfx_shield_break', 'Shield breaks'),
      E('sfx_status_apply', 'a status (plain)'),
      E('sfx_status_apply', 'Burn', { variant: 'burn' }),
      E('sfx_status_apply', 'Bleed', { variant: 'bleed' }),
      E('sfx_status_apply', 'Shock', { variant: 'shock' }),
      E('sfx_heal', 'healed'),
      E('sfx_intent_flip', 'a creature sets or changes its plan'),
    ],
  ],
  ['Fights', [E('sfx_combat_start', 'a fight begins'), E('sfx_victory', 'a fight won'), E('sfx_ko', 'a combatant falls'), E('sfx_perc_kick', 'percussion: a new round (music bus)'), E('sfx_perc_hat', 'percussion: each turn (off under reduced motion)')]],
  [
    'Progress and the loop',
    [
      E('sfx_level_up', 'level up, achievement'),
      E('sfx_echo_gain', 'an Echo; the communion’s Listen'),
      E('sfx_resonance', 'Resonance ×1'),
      E('sfx_resonance', 'Resonance ×3', { n: 3 }),
      E('sfx_clock_warning', 'Breach Clock warning'),
      E('sfx_clock_warning', 'late warning; boss phase; the loop’s end', { variant: 'late' }),
      E('sfx_breach_tear', 'the clock runs out; the Horde; the portal'),
    ],
  ],
];

/** The beds the page plays, by the preset id that content names (src/audio/ambient/recipes.ts). */
export const auditionBeds = (): readonly (readonly [string, string])[] => [
  ['ambient_silverwood_ruins', 'Silverwood Ruins: whispering stone'],
  ['ambient_mistwood_ironclad_reach', 'Mistwood and the Ironclad Reach: wind, a distant hammer'],
  ['ambient_voidscar', 'The Voidscar: a cold beating void'],
  ['ambient_aether_kissed_highlands', 'Aether-Kissed Highlands: shimmer chord'],
  ['ambient_glowlands_nexus', 'Glowlands: breathing glow, water drips'],
  ['ambient_chronos_nexus', 'Chronos Nexus: the Glowlands with a clock tick'],
  ['ambient_temporal_breach_apex', 'Temporal Breach Apex: detuned saws, a stutter gate'],
  ['ambient_drowned_reach', 'The Drowned Reach: submerged'],
  ['ambient_ashen_steppe', 'The Ashen Steppe: dry wind, gusts'],
  ['ambient_veil', 'The Veil: a hushed sanctum'],
  ['ambient_glowfen', 'The Glowfen: humid night, insects'],
  ['ambient_skyreach', 'The Skyreach: thin air'],
  ['ambient_silverwood_before', 'Silverwood Before: the living city, bells'],
  ['ambient_threshold', 'The Threshold: the still shore (the drone)'],
];

/** Fills `root` with the audition page; the first press starts the engine. Returns a cleanup. */
export function mountAudition(root: HTMLElement, engine: AudioEngine, ambient?: Ambient): () => void {
  const doc = root.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    node.textContent = text;
    if (className !== '') node.className = className;
    return node;
  };
  const timers: ReturnType<typeof setTimeout>[] = [];
  const groups = auditionGroups();
  const play = (entry: Entry): void => {
    void engine.unlock().then(() => {
      engine.setLevels({ volumes: { master: 0.8, sfx: 0.8, ambient: 0.6, music: 0.5 }, muted: false });
      engine.play(entry.id, entry);
      status.textContent = `${entry.id}${entry.variant !== undefined ? ` (${entry.variant})` : ''}${entry.n !== undefined ? ` ×${entry.n}` : ''} — engine ${engine.state()}`;
    });
  };
  const main = el('main', '', 'audition');
  main.style.cssText = 'max-width:46rem;margin:0 auto;padding:1rem';
  main.append(el('h1', 'Sound audition'), el('p', 'Every sound is synthesised in the browser. Press one to hear it at the default volumes (master 80 %, effects 80 %).'));
  const status = el('p', 'Nothing played yet.', 'audition__status');
  status.setAttribute('role', 'status');
  const all = el('button', 'Play every sound in order', 'btn btn--primary');
  all.type = 'button';
  all.addEventListener('click', () => {
    let at = 0;
    for (const [, entries] of groups) {
      for (const entry of entries) {
        timers.push(setTimeout(() => play(entry), at));
        at += entry.id === 'sfx_breach_tear' || entry.id === 'sfx_echo_gain' ? 2600 : 1100;
      }
    }
  });
  main.append(all, status);
  for (const [title, entries] of groups) {
    const section = el('section');
    section.append(el('h2', title));
    const list = el('ul', '', 'audition__list');
    list.style.cssText = 'list-style:none;padding:0;display:grid;gap:.5rem';
    for (const entry of entries) {
      const item = el('li');
      const button = el('button', entry.note, 'btn');
      button.type = 'button';
      button.dataset.sound = entry.id;
      button.addEventListener('click', () => play(entry));
      item.append(button, el('code', ` ${entry.id}`));
      list.append(item);
    }
    section.append(list);
    main.append(section);
  }
  if (ambient !== undefined) main.append(ambientSection(doc, engine, ambient, status));
  root.replaceChildren(main);
  return () => {
    timers.forEach(clearTimeout);
    ambient?.set(NO_SCENE);
    root.replaceChildren();
  };
}

/** The ambient controls: a bed per region (with indoors and infected switches), the Tyrant theme with its phase and resolve. */
function ambientSection(doc: Document, engine: AudioEngine, ambient: Ambient, status: HTMLElement): HTMLElement {
  const section = doc.createElement('section');
  const scene: AmbientScene = { ...NO_SCENE };
  const apply = (message: string): void => {
    void engine.unlock().then(() => {
      engine.setLevels({ volumes: { master: 0.8, sfx: 0.8, ambient: 0.6, music: 0.5 }, muted: false });
      ambient.set(scene);
      status.textContent = `${message} — engine ${engine.state()}`;
    });
  };
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = ''): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    node.textContent = text;
    return node;
  };
  const button = (label: string, onPress: () => void): HTMLButtonElement => {
    const b = make('button', label);
    b.type = 'button';
    b.className = 'btn';
    b.addEventListener('click', onPress);
    return b;
  };
  const check = (label: string, onChange: (on: boolean) => void): HTMLLabelElement => {
    const l = make('label');
    const box = make('input');
    box.type = 'checkbox';
    box.addEventListener('change', () => onChange(box.checked));
    l.append(box, ` ${label}  `);
    return l;
  };
  section.append(make('h2', 'Region beds'), make('p', 'Each bed loops until you press Stop or another bed; a new bed crossfades over about two seconds. The ambient volume is 60 %.'));
  const switches = make('p');
  switches.append(
    check('Indoors (a darker filter)', (on) => {
      scene.interior = on;
      if (scene.bed !== null) apply(`${scene.bed} ${on ? 'indoors' : 'outdoors'}`);
    }),
    check('Infected (the unease layer)', (on) => {
      scene.infected = on;
      if (scene.bed !== null) apply(`${scene.bed} ${on ? 'infected' : 'clean'}`);
    }),
    check('Reduced motion (no pulse)', (on) => engine.setReducedMotion(on)),
  );
  section.append(switches);
  const list = make('ul');
  list.style.cssText = 'list-style:none;padding:0;display:grid;gap:.5rem';
  for (const [id, label] of auditionBeds()) {
    const item = make('li');
    const b = button(label, () => {
      scene.bed = id;
      apply(id);
    });
    b.dataset.bed = id;
    item.append(b, make('code', ` ${id}`));
    list.append(item);
  }
  const stop = button('Stop the bed', () => {
    scene.bed = null;
    apply('bed stopped');
  });
  stop.dataset.bed = '';
  section.append(list, stop);

  section.append(make('h2', 'The Tyrant theme'), make('p', 'On the music bus (50 %); the bed ducks under it. Phase 1 to 4 add voices; Resolve above 1 plays the communion, which thins the theme toward a pure C minor.'));
  const phase = make('select');
  for (let i = 1; i <= 4; i++) phase.append(Object.assign(make('option', `Phase ${i}`), { value: String(i - 1) }));
  const resolve = make('input');
  resolve.type = 'range';
  resolve.min = '0';
  resolve.max = '8';
  resolve.value = '0';
  resolve.setAttribute('aria-label', 'Communion resolve (0 = a plain fight)');
  const update = (): void => {
    if (scene.tyrant < 0) return;
    scene.tyrant = Number(phase.value);
    scene.resolve = Number(resolve.value) > 0 ? Number(resolve.value) : -1;
    apply(`Tyrant theme, phase ${scene.tyrant + 1}, resolve ${resolve.value}`);
  };
  phase.addEventListener('change', update);
  resolve.addEventListener('input', update);
  const play = button('Play the Tyrant theme', () => {
    scene.tyrant = 0;
    update();
  });
  play.dataset.theme = 'play';
  const off = button('Stop the theme', () => {
    scene.tyrant = -1;
    scene.resolve = -1;
    apply('theme stopped');
  });
  off.dataset.theme = 'stop';
  const row = make('p');
  row.append(play, off, make('br'), make('label', 'Phase: '), phase, make('br'), make('label', 'Communion resolve (0 = none): '), resolve);
  section.append(row);
  return section;
}
