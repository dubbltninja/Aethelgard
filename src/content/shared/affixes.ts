// The twelve affixes (DESIGN §7.3; PLAN §5.18 table `affixes`; D-044 `affix_` ids). An affix appends its suffix to the
// item's name ("Warrior's Sword of Embers") and does one thing per slot; a slot it lacks is a "—" cell in the DESIGN table
// (it cannot roll there). `text` is the DESIGN cell, word for word (the Gale's trinket cell "both" is spelled out).
//
// Effects use the item vocabulary (ItemStatsSchema stats, resist steps, passives). Four cells no passive kind can say are
// `custom` scripts with their numbers in `params`; the engine implements them by `scriptId`:
//   kill_xp            affix_of_echoes trinket: kill XP × (1 + pct) — implemented (combat/rewards.ts, U26b);
//   basic_attack_rider affix_of_embers weapon: a basic attack adds `pct` of its damage as `damageType`;
//   damage_vs_status   affix_of_iron weapon: +`pct` damage against a target holding `status`;
//   reflect_melee      affix_of_thorns armor: `pct` of the damage a melee hit deals you goes back as `damageType`.
// The last three, like the statusOnHit / regen passives, are read by the engine's gear hooks (engine/combat/gear.ts and
// damage.ts `gearStatusMults`, U34b); the data is final.
import type { AffixInput } from '@schema/affix';

export const affixes = [
  {
    id: 'affix_of_embers',
    suffix: 'of Embers',
    weapon: {
      text: 'basic attacks add 15% of damage as Fire',
      passives: [{ kind: 'custom', scriptId: 'basic_attack_rider', params: { damageType: 'fire', pct: 0.15 } }],
    },
    armor: { text: 'one resistance step vs Fire', resistSteps: ['fire'] },
    trinket: { text: '+10% Fire damage dealt', passives: [{ kind: 'damageBonus', damageType: 'fire', pct: 0.1 }] },
  },
  {
    id: 'affix_of_the_gale',
    suffix: 'of the Gale',
    weapon: { text: '+2 initiative', stats: { initiative: 2 } },
    armor: { text: '+5 evasion', stats: { evasion: 5 } },
    trinket: { text: '+2 initiative, +5 evasion', stats: { initiative: 2, evasion: 5 } },
  },
  {
    id: 'affix_of_ley',
    suffix: 'of the Ley',
    weapon: { text: '+10% Ley damage dealt', passives: [{ kind: 'damageBonus', damageType: 'ley', pct: 0.1 }] },
    armor: { text: '+5 max MP', stats: { mpMax: 5 } },
    trinket: { text: '+5 max MP', stats: { mpMax: 5 } },
  },
  {
    id: 'affix_of_the_void',
    suffix: 'of the Void',
    weapon: { text: '15% chance on hit to apply Curse (3)', passives: [{ kind: 'statusOnHit', status: 'status_curse', chance: 0.15, duration: 3 }] },
    armor: { text: 'one step vs Void', resistSteps: ['void'] },
    trinket: { text: '+10% Void damage dealt', passives: [{ kind: 'damageBonus', damageType: 'void', pct: 0.1 }] },
  },
  {
    id: 'affix_of_moments',
    suffix: 'of Moments',
    weapon: { text: '10% chance on hit to apply Slow (2)', passives: [{ kind: 'statusOnHit', status: 'status_slow', chance: 0.1, duration: 2 }] },
    armor: { text: 'one step vs Chrono', resistSteps: ['chrono'] },
    trinket: { text: '+1 initiative', stats: { initiative: 1 } },
  },
  {
    id: 'affix_of_iron',
    suffix: 'of Iron',
    weapon: {
      text: '+10% damage vs Armor Broken',
      passives: [{ kind: 'custom', scriptId: 'damage_vs_status', params: { status: 'status_armor_break', pct: 0.1 } }],
    },
    armor: { text: '+2 armor', stats: { armor: 2 } },
    trinket: { text: '+1 armor', stats: { armor: 1 } },
  },
  {
    id: 'affix_of_the_hunt',
    suffix: 'of the Hunt',
    weapon: { text: '+5 crit chance', stats: { crit: 5 } },
    trinket: { text: '+3 crit chance', stats: { crit: 3 } },
  },
  {
    id: 'affix_of_vigor',
    suffix: 'of Vigor',
    armor: { text: '+8% max HP', stats: { hpMaxPct: 0.08 } },
    trinket: { text: '+5% max HP', stats: { hpMaxPct: 0.05 } },
  },
  {
    id: 'affix_of_the_wellspring',
    suffix: 'of the Wellspring',
    weapon: { text: 'class resource generation +25%', passives: [{ kind: 'resourceGain', pct: 0.25 }] },
    armor: { text: '+2 MP regen per turn', passives: [{ kind: 'regen', mp: 2 }] },
    trinket: { text: '+2 MP regen per turn', passives: [{ kind: 'regen', mp: 2 }] },
  },
  {
    id: 'affix_of_thorns',
    suffix: 'of Thorns',
    weapon: { text: '10% chance on hit to Bleed (3)', passives: [{ kind: 'statusOnHit', status: 'status_bleed', chance: 0.1, duration: 3 }] },
    armor: {
      text: 'reflect 10% of melee damage taken as Physical',
      passives: [{ kind: 'custom', scriptId: 'reflect_melee', params: { damageType: 'physical', pct: 0.1 } }],
    },
  },
  {
    id: 'affix_of_the_warden',
    suffix: 'of the Warden',
    // `guardValue` is the resulting reduction (0.60 instead of the base 0.50; DESIGN §3.2).
    armor: { text: 'Guard reduces 60% instead of 50%', passives: [{ kind: 'guardValue', pct: 0.6 }] },
    trinket: { text: 'Guard reduces 55%', passives: [{ kind: 'guardValue', pct: 0.55 }] },
  },
  {
    id: 'affix_of_echoes',
    suffix: 'of Echoes',
    // Only one equipped copy counts ("not stackable").
    unique: true,
    trinket: { text: '+10% XP from kills (not stackable)', passives: [{ kind: 'custom', scriptId: 'kill_xp', params: { pct: 0.1 } }] },
  },
] satisfies AffixInput[];
