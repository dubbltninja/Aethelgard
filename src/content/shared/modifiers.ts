// The six challenge modifiers (DESIGN §15.1, D-021; PLAN §5.13). Toggled at the Loom, fixed for the loop. `description` is the
// DESIGN "Exact effect" cell in play words; `rules` are the generic rule kinds the engine reads (engine/runRules.ts, the
// header there lists where each acts). The Resonance multipliers (×1.25 / ×1.5, capped at ×3.0 together) are engine constants
// (`MODIFIER_RESONANCE_MULT`, D-082), not fields of this record.
//
//   mod_iron_loop     disable_attunements        equipped Attunements are inactive for the loop
//   mod_frayed_clock  clock_base_watches 80      base clock 20 days (DESIGN §10.1); every other clock modifier halved toward zero
//   mod_mute_ley      disable_echo_shortcuts     `quest.shortcuts` and the rep starts off; routes, dialogue and ending flags stay
//   mod_horde_rising  elite_chance 0.3           +1 enemy (max 3) per non-boss encounter and 30 % of fodder elite (reducers/combat.ts)
//   mod_glass         damage_multiplier 2 / 2    pipeline step 7 ×2 both ways, DoT ticks included
//   mod_pacifist      xp_sources quest+discovery kill XP 0; the other XP ×2; gold from kills unchanged
//
// `achievementId` ties a modifier to the achievement that needs it (DESIGN §15.1: "recorded … on achievements that require
// them"): Glass → `ach_glass_boss`, Pacifist's Vow → `ach_pacifist_loop`, and both halves of `ach_iron_frayed`.
import type { ModifierInput } from '@schema/modifier';

export const modifiers = [
  {
    id: 'mod_iron_loop',
    name: 'Iron Loop',
    description: 'Your equipped Attunements are inactive for the whole loop.',
    rules: [{ kind: 'disable_attunements' }],
    achievementId: 'ach_iron_frayed',
    icon: 'iron_loop',
  },
  {
    id: 'mod_frayed_clock',
    name: 'Frayed Clock',
    description: 'The Breach Clock starts at 20 days instead of 30, and every other clock modifier is halved toward zero.',
    rules: [{ kind: 'clock_base_watches', watches: 80, halveOthers: true }],
    achievementId: 'ach_iron_frayed',
    icon: 'frayed_clock',
  },
  {
    id: 'mod_mute_ley',
    name: 'Mute Ley',
    description:
      'Echo shortcuts and reputation starts are disabled for the loop. Dialogue unlocks, routes and ending flags still work, so every ending stays reachable.',
    rules: [{ kind: 'disable_echo_shortcuts' }],
    icon: 'mute_ley',
  },
  {
    id: 'mod_horde_rising',
    name: 'Horde Rising',
    description:
      'Every encounter that is not a boss gains one more enemy, up to three, drawn from the region pool. 30% of fodder arrive as elites: +40% HP, +20% ATK, and 1.8 times the XP.',
    rules: [{ kind: 'elite_chance', pct: 0.3 }],
    icon: 'horde_rising',
  },
  {
    id: 'mod_glass',
    name: 'Glass',
    description: 'All damage is doubled in both directions, damage over time included.',
    rules: [{ kind: 'damage_multiplier', outgoing: 2, incoming: 2 }],
    achievementId: 'ach_glass_boss',
    icon: 'glass',
  },
  {
    id: 'mod_pacifist',
    name: "Pacifist's Vow",
    description: 'Kills give no XP. XP from quests and discoveries is doubled. Gold from kills is unchanged.',
    rules: [{ kind: 'xp_sources', allow: ['quest', 'discovery'] }],
    achievementId: 'ach_pacifist_loop',
    icon: 'pacifist',
  },
] satisfies ModifierInput[];
