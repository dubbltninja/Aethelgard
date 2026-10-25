// <Icon> (PLAN §6.4; DESIGN §17.5): single-stroke 24 × 24 glyphs in `currentColor`. A glyph never carries meaning on
// its own (D-035): it sits beside a text label, so it is decorative (`aria-hidden`) unless a `title` names it. U64's
// first set covers the HUD, the exits, the actions and the map; U65 adds DESIGN §17.5's six damage types and eighteen
// statuses and the combat controls. U73 adds item icons.
import type { ReactNode } from 'react';

export const ICON_KINDS = [
  // HUD
  'hp', 'mp', 'gold', 'xp', 'day', 'night', 'clock', 'echo', 'corruption', 'loop', 'level',
  // statuses (DESIGN §4.5, §17.5), keyed by status id
  'status_poison', 'status_bleed', 'status_curse', 'status_rested',
  'status_burn', 'status_shock', 'status_soaked', 'status_slow', 'status_haste', 'status_stun', 'status_weaken',
  'status_armor_break', 'status_mark', 'status_shield', 'status_regen', 'status_taunt', 'status_phase', 'status_rewind',
  'status_blind',
  // damage types (DESIGN §4.4, §17.5)
  'dmg_physical', 'dmg_fire', 'dmg_storm', 'dmg_ley', 'dmg_void', 'dmg_chrono',
  // combat (DESIGN §4.1, §4.2 intent effects, §4.11 communion)
  'attack', 'guard', 'flee', 'heal', 'buff', 'summon', 'command', 'commune', 'listen', 'offer', 'resist', 'fallen',
  // directions (location exits)
  'north', 'south', 'east', 'west', 'up', 'down', 'in', 'out', 'portal', 'path',
  // actions and places
  'rest', 'rest_full', 'talk', 'take', 'gather', 'wait', 'look', 'interact', 'retreat', 'leave', 'vigil', 'ability',
  'merchant', 'forge', 'map', 'menu', 'keys', 'save', 'settings', 'title', 'center',
  // map states
  'lock', 'danger', 'check', 'crown', 'npc', 'unknown', 'hourglass', 'door', 'infected', 'item', 'quest', 'journal', 'codex', 'bestiary',
] as const;
export type IconKind = (typeof ICON_KINDS)[number];

const arrow = (rotate: number): ReactNode => (
  <g transform={`rotate(${rotate} 12 12)`}>
    <path d="M12 19 L12 5 M6 11 L12 5 L18 11" />
  </g>
);

/** Whether a kind has a drawing (the registry test: every IconKind is drawn). */
export const isDrawn = (kind: IconKind): boolean => GLYPHS[kind] !== undefined;

const GLYPHS: Record<IconKind, ReactNode> = {
  hp: <path d="M12 20 C 5 15, 3 11, 3 8 C 3 5.5, 5 4, 7.2 4 C 9.2 4, 11 5.4, 12 7.2 C 13 5.4, 14.8 4, 16.8 4 C 19 4, 21 5.5, 21 8 C 21 11, 19 15, 12 20 Z" />,
  mp: <path d="M12 3 L18 11 L12 21 L6 11 Z M12 3 L12 21" />,
  gold: (
    <>
      <circle cx={12} cy={12} r={8} />
      <path d="M12 7.5 L12 16.5 M9.5 9.5 C 9.5 8, 14.5 8, 14.5 10 C 14.5 12, 9.5 12, 9.5 14 C 9.5 16, 14.5 16, 14.5 14.5" />
    </>
  ),
  xp: <path d="M12 3 L14.6 9 L21 9.6 L16.2 13.8 L17.6 20.2 L12 16.9 L6.4 20.2 L7.8 13.8 L3 9.6 L9.4 9 Z" />,
  day: (
    <>
      <circle cx={12} cy={12} r={4} />
      <path d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7 7 M17 17 L18.7 18.7 M5.3 18.7 L7 17 M17 7 L18.7 5.3" />
    </>
  ),
  night: <path d="M15.5 3.5 A 8.5 8.5 0 1 0 20.5 15 A 7 7 0 0 1 15.5 3.5 Z" />,
  clock: (
    <>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M12 7 L12 12 L15.5 14" />
    </>
  ),
  echo: (
    <>
      <circle cx={12} cy={12} r={2.2} />
      <path d="M7.5 7.5 A 6.4 6.4 0 0 0 7.5 16.5 M16.5 7.5 A 6.4 6.4 0 0 1 16.5 16.5 M4.6 4.6 A 10.5 10.5 0 0 0 4.6 19.4 M19.4 4.6 A 10.5 10.5 0 0 1 19.4 19.4" />
    </>
  ),
  corruption: (
    <>
      <path d="M17.5 5.5 A 8.5 8.5 0 1 0 20.4 13.5" />
      <circle cx={12} cy={12} r={2.5} />
    </>
  ),
  loop: <path d="M19 12 A 7 7 0 1 1 16.9 7 M17 3 L17 7.2 L12.8 7.2" />,
  level: <path d="M5 19 L12 5 L19 19 M8.5 13 L15.5 13" />,
  status_poison: (
    <>
      <path d="M7 11 C 7 6, 17 6, 17 11 C 17 13.5, 15.5 14.5, 15 15.5 L 15 18 L 9 18 L 9 15.5 C 8.5 14.5, 7 13.5, 7 11 Z" />
      <circle cx={10} cy={11} r={1} />
      <circle cx={14} cy={11} r={1} />
      <circle cx={19.5} cy={19.5} r={1.2} />
    </>
  ),
  status_bleed: <path d="M12 3 C 16 9, 18 12, 18 15 A 6 6 0 0 1 6 15 C 6 12, 8 9, 12 3 Z" />,
  status_curse: (
    <>
      <path d="M3 12 C 7 6, 17 6, 21 12 C 17 18, 7 18, 3 12 Z" />
      <circle cx={12} cy={12} r={2.6} />
      <path d="M12 3 L12 6 M12 18 L12 21" />
    </>
  ),
  status_rested: <path d="M4 17 L20 17 M6 17 L6 11 L18 11 L18 17 M8 11 C 8 9, 10 8, 12 8 M15 4 L18 4 L15 7 L18 7" />,
  // DESIGN §17.5: Burn flame-with-base, Shock small bolt in a circle, Soaked droplet with ripple, Slow hourglass
  // bottom-heavy, Haste top-heavy with motion lines, Stun starburst, Weaken down-arrow, Armor Break cracked plate, Mark
  // crosshair, Shield hexagon, Regen leaf, Taunt horn, Phase dashed figure, Rewind counter-clockwise spiral, Blind eye shut.
  status_burn: <path d="M12 3 C 16 8, 17 11, 15.5 14 C 15 12.5, 14 12, 13 12 C 14 15, 11 16, 10 14 C 9 15, 8.5 16, 9 17 C 7 15, 7 11, 12 3 Z M5 20 L19 20" />,
  status_shock: (
    <>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M13.5 5.5 L8.5 12.8 L12.8 12.8 L10.5 18.5" />
    </>
  ),
  status_soaked: <path d="M12 3 C 15 8, 16.5 10, 16.5 12.5 A 4.5 4.5 0 0 1 7.5 12.5 C 7.5 10, 9 8, 12 3 Z M4 19 C 7 17.5, 9 20.5, 12 19 C 15 17.5, 17 20.5, 20 19" />,
  // U73: Slow was an hourglass like Haste, Wait, Chrono and the clock-face; a snail (shell, foot, one horn) reads apart at 16 px
  status_slow: (
    <>
      <circle cx={9.5} cy={11} r={6} />
      <path d="M9.5 11 C 9.5 9.8, 11.2 9.8, 11.2 11 C 11.2 13, 7.6 13, 7.6 11" />
      <path d="M2.5 19.5 L17.5 19.5 C 21.5 19.5, 21.5 14, 18 14 M19.5 14.5 L21 11" />
    </>
  ),  status_haste: <path d="M9 3 L19 3 M9 21 L19 21 M10 3 C 10 8, 14 9, 14 12 C 14 15, 10 16, 10 21 M18 3 C 18 8, 14 9, 14 12 C 14 15, 18 16, 18 21 M11 4.5 L17 4.5 L14 7.5 Z M2 9 L6 9 M3 13 L7 13 M2 17 L6 17" />,
  status_stun: <path d="M12 2.5 L13.6 8.6 L19.5 6 L15.6 11 L21 14 L14.8 14.5 L16 20.5 L12 15.8 L8 20.5 L9.2 14.5 L3 14 L8.4 11 L4.5 6 L10.4 8.6 Z" />,
  status_weaken: <path d="M12 3 L12 19 M6 13 L12 19 L18 13 M5 22 L19 22" />,
  status_armor_break: <path d="M5 4 L19 4 L19 12 C 19 16, 16 19, 12 21 C 8 19, 5 16, 5 12 Z M12 4 L10 9 L14 12 L11 16 L12 21" />,
  status_mark: (
    <>
      <circle cx={12} cy={12} r={7} />
      <circle cx={12} cy={12} r={1.5} />
      <path d="M12 2 L12 7 M12 17 L12 22 M2 12 L7 12 M17 12 L22 12" />
    </>
  ),
  status_shield: <path d="M12 2.5 L20.5 7.3 L20.5 16.7 L12 21.5 L3.5 16.7 L3.5 7.3 Z" />,
  status_regen: <path d="M5 19 C 5 10, 11 5, 19 5 C 19 13, 14 19, 5 19 Z M5 19 L13 11 M10 14 L10 10 M12.5 11.5 L16 11.5" />,
  status_taunt: <path d="M4 20 C 6 12, 10 7, 19 4 C 16 9, 15 12, 15 15 C 12 14, 9 16, 8 20 Z" />,
  status_phase: (
    <>
      <circle cx={12} cy={6.5} r={3} strokeDasharray="2.5 2" />
      <path d="M5 21 C 5 13, 19 13, 19 21" strokeDasharray="2.5 2" />
    </>
  ),
  // U73: the spiral clogged at 16 px; a counter-clockwise arrow round a clock hand says the same ("time runs back")
  status_rewind: <path d="M4.5 12 A 7.5 7.5 0 1 0 7 6.5 M7 2.5 L7 7 L11.5 7 M12 8 L12 12.5 L15 14" />,
  status_blind: <path d="M3 10 C 7 15, 17 15, 21 10 M6.5 13 L5 16 M12 14.5 L12 17.5 M17.5 13 L19 16" />,
  // DESIGN §17.5: Physical diagonal blade, Fire three-tongue flame, Storm jagged bolt, Ley flowing double wave, Void
  // ring with a missing arc, Chrono hourglass-spiral.
  dmg_physical: <path d="M19 3 L21 3 L21 5 L9 17 L7 15 Z M5 15 L9 19 M3 21 L6.5 17.5" />,
  dmg_fire: <path d="M12 21 C 7 21, 5 17, 6 13 C 6.5 11, 8 10, 8 7 C 10 9, 10.5 11, 10 12.5 C 11.5 10, 12 6, 11 2.5 C 15 5, 18 9, 18 14 C 18 18, 15.5 21, 12 21 Z M12 21 C 10 20, 10 17, 12 15 C 14 17, 14 20, 12 21" />,
  dmg_storm: <path d="M14 2 L6 13 L11 13 L9 22 L18 9 L13 9 L15 2 Z" />,
  dmg_ley: <path d="M2 9 C 5 5, 8 13, 12 9 C 16 5, 19 13, 22 9 M2 15 C 5 11, 8 19, 12 15 C 16 11, 19 19, 22 15" />,
  dmg_void: <path d="M17.3 5.2 A 8.5 8.5 0 1 0 20.4 13.2 M12 9.5 L12 14.5" />,
  dmg_chrono: <path d="M6 3 L18 3 M6 21 L18 21 M7 3 C 7 8, 12 10, 12 12 C 12 14, 7 16, 7 21 M17 3 C 17 8, 12 10, 12 12 M12 12 C 15 12.5, 16 15, 15 17 C 14 18.5, 12 18, 12.5 16.5" />,
  attack: <path d="M14.5 3 L21 3 L21 9.5 L10 20.5 L3.5 14 Z M7 17 L3 21 M13 6 L18 11" />,
  guard: <path d="M12 2.5 L19.5 5.5 L19.5 11.5 C 19.5 16, 16.5 19.5, 12 21.5 C 7.5 19.5, 4.5 16, 4.5 11.5 L4.5 5.5 Z M12 6.5 L12 17.5 M8 11 L16 11" />,
  flee: <path d="M13 4.5 A 1.6 1.6 0 1 0 13 4.49 M6 21 L10 15.5 L13 17 L15 12 L11 9 L8 12 M15 12 L18.5 13.5 M13 17 L14.5 21 M17 7 L22 7 M18 10 L22 10" />,
  heal: <path d="M9 3 L15 3 L15 9 L21 9 L21 15 L15 15 L15 21 L9 21 L9 15 L3 15 L3 9 L9 9 Z" />,
  buff: (
    <>
      <path d="M2.5 12 C 6 6.5, 18 6.5, 21.5 12 C 18 17.5, 6 17.5, 2.5 12 Z" />
      <circle cx={12} cy={12} r={3} />
    </>
  ),
  summon: <path d="M12 3 L12 21 M3 12 L21 12 M6 6 L18 18 M18 6 L6 18" />,
  command: <path d="M5 21 L5 3 M5 4 L18 4 L15 8.5 L18 13 L5 13" />,
  commune: <path d="M4 5 L20 5 L20 15 L13 15 L8 20 L8 15 L4 15 Z M9 10 L9.01 10 M12 10 L12.01 10 M15 10 L15.01 10" />,
  listen: <path d="M8 9 C 8 5, 11 3, 13.5 3 C 17 3, 19 5.5, 19 9 C 19 13, 15 14, 15 17 C 15 19.5, 13 21, 11 21 C 9 21, 8 19.5, 8 18.5 M11.5 9 C 11.5 7.5, 15.5 7.5, 15.5 10 C 15.5 12, 13 12, 13 13.5" />,
  offer: <path d="M3 14 L7 14 L11 17 L16 17 C 17 17, 17 15.5, 16 15.5 L12 15.5 M7 14 L7 20 L3 20 M16 15.5 L20 12.5 C 21 11.8, 22 13, 21 14 L16 19 L8 19 M13 4 L16 7 L13 10 L10 7 Z" />,
  resist: <path d="M12 21 L12 13 M7 21 L17 21 M12 13 C 6 13, 4 8, 4 3 C 8 3, 11 5, 12 9 C 13 5, 16 3, 20 3 C 20 8, 18 13, 12 13" />,
  fallen: <path d="M8 21 L8 17 C 4.5 15, 4 12, 4 9.5 A 8 8 0 0 1 20 9.5 C 20 12, 19.5 15, 16 17 L16 21 Z M9 10.5 L9.01 10.5 M15 10.5 L15.01 10.5 M12 21 L12 18" />,
  north: arrow(0),
  east: arrow(90),
  south: arrow(180),
  west: arrow(270),
  up: <path d="M4 19 L9 19 L9 14 L14 14 L14 9 L19 9 L19 4 M15 4 L19 4 L19 8" />,
  down: <path d="M4 5 L9 5 L9 10 L14 10 L14 15 L19 15 L19 20 M15 20 L19 20 L19 16" />,
  in: <path d="M14 4 L19 4 L19 20 L14 20 M4 12 L14 12 M10 8 L14 12 L10 16" />,
  out: <path d="M10 4 L5 4 L5 20 L10 20 M9 12 L20 12 M16 8 L20 12 L16 16" />,
  portal: (
    <>
      <ellipse cx={12} cy={12} rx={6} ry={9} />
      <path d="M12 7 C 14.5 9, 14.5 15, 12 17 C 9.5 15, 9.5 9, 12 7" />
    </>
  ),
  path: <path d="M6 21 C 6 15, 18 15, 18 9 C 18 6, 14 3, 12 3 M9 6 L12 3 L15 6" />,
  rest: (
    <>
      <path d="M4 20 L20 16 M4 16 L20 20" />
      <path d="M12 14 C 9 11, 10 8, 12 4 C 14 8, 15 11, 12 14 Z" />
    </>
  ),
  rest_full: (
    <>
      <path d="M4 20 L20 16 M4 16 L20 20" />
      <path d="M12 14 C 9 11, 10 8, 12 4 C 14 8, 15 11, 12 14 Z M17 4 A 3 3 0 1 0 20 8 A 2.4 2.4 0 0 1 17 4" />
    </>
  ),
  talk: <path d="M4 5 L20 5 L20 16 L11 16 L6 20 L6 16 L4 16 Z M8 9 L16 9 M8 12 L13 12" />,
  take: <path d="M7 9 L17 9 L19 20 L5 20 Z M9.5 9 C 9.5 5, 14.5 5, 14.5 9 M12 12 L12 17 M9.5 14.5 L12 17 L14.5 14.5" />,
  gather: <path d="M5 19 C 5 10, 11 5, 19 5 C 19 13, 14 19, 5 19 Z M5 19 L13 11" />,
  wait: <path d="M7 3 L17 3 M7 21 L17 21 M8 3 C 8 9, 16 9, 16 12 C 16 15, 8 15, 8 21 M16 3 C 16 9, 8 9, 8 12 C 8 15, 16 15, 16 21" />,
  look: (
    <>
      <circle cx={10.5} cy={10.5} r={6} />
      <path d="M15 15 L20.5 20.5" />
    </>
  ),
  interact: <path d="M9 11 L9 4.5 A 1.5 1.5 0 0 1 12 4.5 L12 10 L12 8.5 A 1.5 1.5 0 0 1 15 8.5 L15 10.5 A 1.5 1.5 0 0 1 18 10.5 L18 15 C 18 18.5, 16 21, 12.5 21 C 9.5 21, 8 19.5, 6.5 17 L4.8 13.5 A 1.5 1.5 0 0 1 7.5 12.3 Z" />,
  retreat: <path d="M20 12 L5 12 M10 7 L5 12 L10 17 M20 6 L20 18" />,
  leave: (
    <>
      <circle cx={12} cy={12} r={8.5} strokeDasharray="3 3" />
      <path d="M8.5 12 L15.5 12 M12.5 9 L15.5 12 L12.5 15" />
    </>
  ),
  vigil: (
    <>
      <path d="M12 21 L12 13 M9 21 L15 21" />
      <path d="M12 13 C 9.5 10.5, 10 7.5, 12 4 C 14 7.5, 14.5 10.5, 12 13 Z" />
    </>
  ),
  ability: <path d="M13 2 L5 13 L11 13 L10 22 L19 10 L13 10 Z" />,
  merchant: <path d="M12 4 L12 20 M7 20 L17 20 M4 8 L20 8 M6 8 L3.5 14 C 4.5 16, 7.5 16, 8.5 14 L6 8 M18 8 L15.5 14 C 16.5 16, 19.5 16, 20.5 14 L18 8" />,
  forge: <path d="M3 8 L15 8 C 15 11, 17 12, 21 12 L21 14 L16 14 L14 17 L16 20 L7 20 L9 17 L7 14 L6 14 C 4 14, 3 11, 3 8 Z" />,
  map: <path d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z M9 4 L9 18 M15 6 L15 20" />,
  menu: <path d="M4 7 L20 7 M4 12 L20 12 M4 17 L20 17" />,
  keys: (
    <>
      <rect x={3} y={6} width={18} height={12} rx={2} />
      <path d="M7 10 L7.01 10 M11 10 L11.01 10 M15 10 L15.01 10 M8 14 L16 14" />
    </>
  ),
  save: <path d="M5 4 L16 4 L20 8 L20 20 L4 20 L4 5 Z M8 4 L8 9 L15 9 L15 4 M8 20 L8 14 L16 14 L16 20" />,
  settings: (
    <>
      <circle cx={12} cy={12} r={3} />
      <path d="M12 2.5 L12 5.5 M12 18.5 L12 21.5 M2.5 12 L5.5 12 M18.5 12 L21.5 12 M5.3 5.3 L7.4 7.4 M16.6 16.6 L18.7 18.7 M5.3 18.7 L7.4 16.6 M16.6 7.4 L18.7 5.3" />
    </>
  ),
  title: <path d="M4 11 L12 4 L20 11 M6 9.5 L6 20 L18 20 L18 9.5 M10 20 L10 14 L14 14 L14 20" />,
  center: (
    <>
      <circle cx={12} cy={12} r={6.5} />
      <circle cx={12} cy={12} r={1.6} />
      <path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12" />
    </>
  ),
  lock: (
    <>
      <rect x={5} y={10.5} width={14} height={10} rx={1.5} />
      <path d="M8 10.5 L8 7.5 A 4 4 0 0 1 16 7.5 L16 10.5 M12 14 L12 17" />
    </>
  ),
  danger: <path d="M12 3.5 L21.5 20 L2.5 20 Z M12 9.5 L12 14.5 M12 17 L12 17.01" />,
  check: <path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" />,
  crown: <path d="M3.5 18 L5 8 L9.5 12 L12 5.5 L14.5 12 L19 8 L20.5 18 Z" />,
  npc: (
    <>
      <circle cx={12} cy={8} r={3.6} />
      <path d="M4.5 20.5 C 5.5 15, 18.5 15, 19.5 20.5" />
    </>
  ),
  unknown: <path d="M8.5 9 C 8.5 4.5, 15.5 4.5, 15.5 9 C 15.5 12, 12 12, 12 15 M12 18.5 L12 18.51" />,
  hourglass: <path d="M6 3 L18 3 M6 21 L18 21 M7 3 L7 6 C 7 9, 12 10, 12 12 C 12 14, 7 15, 7 18 L7 21 M17 3 L17 6 C 17 9, 12 10, 12 12 C 12 14, 17 15, 17 18 L17 21" />,
  door: <path d="M6 21 L6 4 L16 3 L16 21 M16 21 L19 21 M3 21 L6 21 M12.5 12 L12.5 13" />,
  infected: (
    <>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M6 18 L18 6 M3.8 13.2 L13.2 3.8 M10.8 20.2 L20.2 10.8" />
    </>
  ),
  item: <path d="M6 9 L18 9 L19.5 20 L4.5 20 Z M9 9 L9 6.5 C 9 4.5, 15 4.5, 15 6.5 L15 9" />,
  // U66: a quest (a banner on a pole), and the three reading panels
  quest: <path d="M7 21 L7 3 M7 4.5 L18.5 4.5 L15.5 9 L18.5 13.5 L7 13.5" />,
  journal: <path d="M6 3.5 L18 3.5 L18 20.5 L6 20.5 Z M9.5 8 L14.5 8 M9.5 12 L14.5 12 M9.5 16 L12.5 16" />,
  codex: <path d="M4 5 C 7.5 4, 10.5 4.5, 12 6.5 C 13.5 4.5, 16.5 4, 20 5 L20 19 C 16.5 18, 13.5 18.5, 12 20.5 C 10.5 18.5, 7.5 18, 4 19 Z M12 6.5 L12 20.5" />,
  bestiary: (
    <>
      <path d="M12 3.5 L20 8 L20 16 L12 20.5 L4 16 L4 8 Z" />
      <circle cx={12} cy={12} r={2.4} />
    </>
  ),
};

/** Stroke in viewBox units. 2 is 2 px at 24; below 20 px a 2-unit stroke falls under 1.5 px and blurs, so small glyphs get 2.25. */
export const strokeFor = (size: number): number => (size < 20 ? 2.25 : 2);

export interface IconProps {
  kind: IconKind;
  size?: number;
  /** Names the glyph (role="img"); omit when a visible label sits beside it. */
  title?: string;
  className?: string;
}

export function Icon({ kind, size = 20, title, className }: IconProps): ReactNode {
  const named = title !== undefined && title !== '';
  return (
    <svg
      className={className === undefined ? 'icon' : `icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeFor(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={named ? 'img' : undefined}
      aria-label={named ? title : undefined}
      aria-hidden={named ? undefined : 'true'}
      data-icon={kind}
    >
      {GLYPHS[kind]}
    </svg>
  );
}

/** The glyph of a status id (DESIGN §17.5); a status this set does not draw yet falls back to the warning triangle. */
export function statusIcon(statusId: string): IconKind {
  return (ICON_KINDS as readonly string[]).includes(statusId) ? (statusId as IconKind) : 'danger';
}

/** The glyph of a damage type (DESIGN §17.5). */
export function damageIcon(type: string): IconKind {
  const kind = `dmg_${type}`;
  return (ICON_KINDS as readonly string[]).includes(kind) ? (kind as IconKind) : 'attack';
}

/** An Icon kind for an exit direction (schema `Dir`). */
export function dirIcon(dir: string): IconKind {
  return (ICON_KINDS as readonly string[]).includes(dir) ? (dir as IconKind) : 'path';
}
