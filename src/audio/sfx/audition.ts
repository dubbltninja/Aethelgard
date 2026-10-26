// The sound audition page (U74, dev and e2e builds only: `?audition`, wired in main.tsx; production drops it): a button
// per sound and per variant, so a person can hear all 30 (and the two percussion hits) by name and say what to change.
// Plain DOM, no React, so the same module also bundles on its own.
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

/** Fills `root` with the audition page; the first press starts the engine. Returns a cleanup. */
export function mountAudition(root: HTMLElement, engine: AudioEngine): () => void {
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
  root.replaceChildren(main);
  return () => {
    timers.forEach(clearTimeout);
    root.replaceChildren();
  };
}
