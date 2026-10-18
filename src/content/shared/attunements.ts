// The fifteen Attunements (DESIGN §10.7, D-011, D-066 #15, C-41; PLAN §5.13): permanent conveniences bought with Resonance
// at the Loom, owned forever with no ranks, at most five equipped (`GameConfig.attunementEquipCap`), the set fixed at the Far
// Light. The costs are DESIGN's rows, which add up to 430; DESIGN's prose says "440" (a slip: the rows are the numbers, D-062).
// Hard caps (DESIGN): HP and MP bonuses +5 % each, XP bonuses from all sources at most +20 % (the engine caps the sum,
// runRules.ts `XP_BONUS_CAP`).
//
// The effect kinds are the ones the engine reads (engine/runRules.ts header lists where each acts); the nine rows no plain
// kind can say are `custom` scripts keyed by `ATT_SCRIPT`, with their numbers in `params` (the same shapes as
// tests/fixtures/thresholdContent.ts, which the Threshold reducer tests drive):
//   att_old_road          free_inn_rest        att_remembered_steps  remembered_steps     att_second_wind    second_wind
//   att_foresight         foresight            att_echo_sense        reveal_resistances   att_keen_eye       crit { amount: 3 }
//   att_light_step        travel_regen { hpPct: 0.05, mpPct: 0.1 }                          att_borins_favor   forge_discount { pct: 0.15 }
//   att_companions_trust  loyalty_gain { pct: 0.25 }
// `att_steady_hours` is +1 day = 4 watches of `clock_watches` and needs `echo_breach_clock` to be bought (DESIGN §10.7).
// `description` is the DESIGN "Effect" cell in play words; `icon` is the id without its prefix, as the other shared records
// (the icon registry is U73's).
import type { AttunementInput } from '@schema/attunement';

export const attunements = [
  {
    id: 'att_steady_hand',
    name: 'Steady Hand',
    description: '+5% max HP.',
    cost: 20,
    effects: [{ kind: 'hp_max_pct', pct: 0.05 }],
    icon: 'steady_hand',
  },
  {
    id: 'att_deep_well',
    name: 'Deep Well',
    description: '+5% max MP.',
    cost: 20,
    effects: [{ kind: 'mp_max_pct', pct: 0.05 }],
    icon: 'deep_well',
  },
  {
    id: 'att_full_purse',
    name: 'Full Purse',
    description: 'Start each loop with 60 more gold.',
    cost: 15,
    effects: [{ kind: 'start_gold', amount: 60 }],
    icon: 'full_purse',
  },
  {
    id: 'att_old_road',
    name: 'Old Road',
    description: 'One free night at an inn each loop.',
    cost: 15,
    effects: [{ kind: 'custom', scriptId: 'free_inn_rest' }],
    icon: 'old_road',
  },
  {
    id: 'att_foresight',
    name: 'Foresight',
    description: 'Enemy intents are revealed one turn earlier; the one after next shows dimmed.',
    cost: 40,
    effects: [{ kind: 'custom', scriptId: 'foresight' }],
    icon: 'foresight',
  },
  {
    id: 'att_quick_study',
    name: 'Quick Study',
    description: '+10% XP.',
    cost: 30,
    effects: [{ kind: 'xp_pct', pct: 0.1 }],
    icon: 'quick_study',
  },
  {
    id: 'att_keen_eye',
    name: 'Keen Eye',
    description: '+3 crit chance.',
    cost: 25,
    effects: [{ kind: 'custom', scriptId: 'crit', params: { amount: 3 } }],
    icon: 'keen_eye',
  },
  {
    id: 'att_light_step',
    name: 'Light Step',
    description: 'Travel restores 5% more HP and 10% more MP per watch.',
    cost: 20,
    effects: [{ kind: 'custom', scriptId: 'travel_regen', params: { hpPct: 0.05, mpPct: 0.1 } }],
    icon: 'light_step',
  },
  {
    id: 'att_steady_hours',
    name: 'Steady Hours',
    description: 'The Breach Clock runs one day longer. You must know how the Breach Clock runs to buy it.',
    cost: 50,
    effects: [{ kind: 'clock_watches', watches: 4 }],
    requires: { echo: 'echo_breach_clock' },
    icon: 'steady_hours',
  },
  {
    id: 'att_borins_favor',
    name: "Borin's Favor",
    description: 'Emberforge fees are 15% lower.',
    cost: 25,
    effects: [{ kind: 'custom', scriptId: 'forge_discount', params: { pct: 0.15 } }],
    icon: 'borins_favor',
  },
  {
    id: 'att_kaelens_ledger',
    name: "Kaelen's Ledger",
    description: 'Merchant prices are 5% lower.',
    cost: 25,
    effects: [{ kind: 'shop_discount_pct', pct: 0.05 }],
    icon: 'kaelens_ledger',
  },
  {
    id: 'att_remembered_steps',
    name: 'Remembered Steps',
    description: 'Once a day, the first journey along a remembered road costs no watch.',
    cost: 40,
    effects: [{ kind: 'custom', scriptId: 'remembered_steps' }],
    icon: 'remembered_steps',
  },
  {
    id: 'att_echo_sense',
    name: 'Echo-Sense',
    description: "A creature's resistances are shown the first time you see it.",
    cost: 20,
    effects: [{ kind: 'custom', scriptId: 'reveal_resistances' }],
    icon: 'echo_sense',
  },
  {
    id: 'att_companions_trust',
    name: "Companion's Trust",
    description: 'Loyalty gains are 25% larger.',
    cost: 25,
    effects: [{ kind: 'custom', scriptId: 'loyalty_gain', params: { pct: 0.25 } }],
    icon: 'companions_trust',
  },
  {
    id: 'att_second_wind',
    name: 'Second Wind',
    description: 'Once per loop, from Loop 2, a killing blow leaves you at 1 HP instead.',
    cost: 60,
    effects: [{ kind: 'custom', scriptId: 'second_wind' }],
    icon: 'second_wind',
  },
] satisfies AttunementInput[];
