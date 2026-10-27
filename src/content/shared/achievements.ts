// The forty achievements (DESIGN §15.2, REGISTRY-DRAFT §18 for the corrected conditions; PLAN §5.13; D-021). An achievement is a
// Condition checked at its checkpoints; the first time it holds in a profile it is earned. The ids, names, hidden marks and
// the condition in words are DESIGN §15.2's; the three "Sworn" ids sharing a row are three records (`ach_sworn_remnant`,
// `ach_sworn_weaver`, `ach_sworn_ironclad`). `description` is the DESIGN condition in play words (hidden ones show "?" until
// earned, DESIGN §16.3); `icon` is the id without its prefix (the icon registry is U73's).
//
// Resonance. DESIGN §10.6 lists every Resonance source and achievements are not among them (its "expected income" figures are
// computed without them), so every record pays 0 here, not the schema's default 10: forty times ten would almost buy the whole
// Attunement shop (440). The same reasoning as D-082 for Echoes; a balance pass may raise it.
//
// Conditions. The Condition vocabulary reads the run (and, through `echo`, the profile). Where DESIGN's wording is a fact the
// vocabulary can say, the record says it: `echo_ending_a`…`_f` are the engine's "Witnessed" Echoes, granted at each true ending
// (reducers/loop.ts), so the ending achievements and "Every Door" read them; `flag_clock_expired`, `flag_tyrant_dead` are
// engine-written flags; `counter` reads `quests_completed` (D-048). Where it is a profile or combat fact no atom reads, the
// record uses a `counter` whose name starts with `tally_`: a count the achievement engine (src/engine/achievements.ts, U81a)
// writes into the run's counters every step from the profile and the run. Those names and what each counts:
//   tally_closer_escape      loops closed by the Library portal (closer_escape), profile lifetime
//   tally_boss_untouched     boss fights won without taking damage, profile lifetime
//   tally_mastery_peak       the most abilities mastered in any one class (of 15), profile
//   tally_classes_finished   classes with a finished loop (of 5), profile
//   tally_capstones_held     capstones (tier-5 abilities) held at once in one class this loop, 0–3
//   tally_echoes_complete    1 once the profile holds every Echo
//   tally_bestiary_complete  1 once every creature id is in the bestiary, profile
//   tally_codex_complete     1 once every codex entry is unlocked, profile
//   tally_map_complete       1 once all 73 locations are in map memory, profile
//   tally_legendary_owned    Legendary items owned right now
//   tally_voidforged_crafted void-forged items crafted, profile lifetime
//   tally_kills              kills this loop (the Pacifist's Vow row reads `max: 0`, with the modifier)
//   tally_new_game_plus      New Game+ starts, profile lifetime
// Two flags are for content to set: `flag_named_nyx` (the dialogue choice that speaks "I know what you are, Nyx", U52+) and
// `flag_corruption_cleansed` (Elder Wen's cleansing; STORY §10.5 reads it too). Each record's `notes` says where its condition
// is an approximation.
import type { Condition } from '@schema/condition';
import type { AchievementInput } from '@schema/achievement';

const ENDING_ECHOES = ['echo_ending_a', 'echo_ending_b', 'echo_ending_c', 'echo_ending_d', 'echo_ending_e', 'echo_ending_f'] as const;
const COMPANIONS = ['ilyra', 'brak', 'nyx', 'dask', 'mireya', 'caelum'] as const;
const FACTIONS = ['remnants', 'weavers', 'ironclad'] as const;

/** A true ending has been reached in this profile (its "Witnessed" Echo is held). */
const anyEnding: Condition = { any: ENDING_ECHOES.map((echo) => ({ echo })) };
/** DESIGN §11.4: Sworn is 60 and above (`GameConfig.reputation`). */
const sworn = (faction: (typeof FACTIONS)[number]): Condition => ({ rep: { faction, min: 60 } });

export const achievements = [
  {
    id: 'ach_first_steps',
    name: 'First Steps',
    description: 'Leave the Whispering Ruins.',
    when: { not: { location: 'loc_whispering_ruins' } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'first_steps',
  },
  {
    id: 'ach_echo_in_the_library',
    name: 'Echoes in the Library',
    description: 'Finish "Echoes in the Library".',
    when: { quest: { id: 'q_echo_crystal', status: 'completed' } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'echo_in_the_library',
  },
  {
    id: 'ach_six_quests',
    name: 'The Apex Opens',
    description: 'Complete six quests in Loop 1.',
    when: { all: [{ loop: { max: 1 } }, { counter: { name: 'quests_completed', min: 6 } }] },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'six_quests',
  },
  {
    id: 'ach_the_escape',
    name: 'The Escape',
    description: 'Close a loop by the Library portal.',
    when: { counter: { name: 'tally_closer_escape', min: 1 } },
    checkpoints: ['loop_end'],
    resonance: 0,
    icon: 'the_escape',
    notes: 'Reads a tally: no atom says which closer ended the loop (closer_escape, D-049).',
  },
  {
    id: 'ach_the_fall',
    name: 'The Thirtieth Dawn',
    description: 'See the thirtieth dawn: the Breach Clock runs out.',
    when: { flag: 'flag_clock_expired' },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'the_fall',
  },
  {
    id: 'ach_loop_two',
    name: 'Day One, Again',
    description: 'Begin Loop 2.',
    hidden: true,
    when: { loop: { min: 2 } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'loop_two',
  },
  {
    id: 'ach_i_know_what_you_are',
    name: 'I Know What You Are',
    description: 'Tell Nyx you know what she is.',
    hidden: true,
    when: { all: [{ echo: 'echo_nyx_is_of_the_nine' }, { flag: 'flag_named_nyx' }] },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'i_know_what_you_are',
    notes: 'The choice that speaks the line sets flag_named_nyx (dialogue content, U52+).',
  },
  {
    id: 'ach_brak_lives',
    name: 'Stonehand Lives',
    description: 'End a loop with Brak alive after the Tyrant has fallen.',
    when: { all: [{ flag: 'flag_tyrant_dead' }, { echo: 'echo_brak_lives' }] },
    checkpoints: ['loop_end', 'ending'],
    resonance: 0,
    icon: 'brak_lives',
    notes: 'Approximation: `echo` also sees earlier loops, so a Brak lost in a later loop can still satisfy it once the Echo is held.',
  },
  {
    id: 'ach_two_brothers',
    name: 'The Brothers Stonehand',
    description: 'Finish "Blood and Salt".',
    when: { quest: { id: 'q_blood_and_salt', status: 'completed' } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'two_brothers',
  },
  {
    id: 'ach_vigil',
    name: "The Warden's Vigil",
    description: "Reach ending A, The Warden's Vigil.",
    when: { echo: 'echo_ending_a' },
    checkpoints: ['ending'],
    resonance: 0,
    icon: 'vigil',
  },
  {
    id: 'ach_mending',
    name: 'The Mending',
    description: 'Reach ending B, The Mending.',
    when: { echo: 'echo_ending_b' },
    checkpoints: ['ending'],
    resonance: 0,
    icon: 'mending',
  },
  {
    id: 'ach_weavers_dawn',
    name: "The Weaver's Dawn",
    description: "Reach ending C, The Weaver's Dawn.",
    when: { echo: 'echo_ending_c' },
    checkpoints: ['ending'],
    resonance: 0,
    icon: 'weavers_dawn',
  },
  {
    id: 'ach_iron_silence',
    name: 'The Iron Silence',
    description: 'Reach ending D, The Iron Silence.',
    when: { echo: 'echo_ending_d' },
    checkpoints: ['ending'],
    resonance: 0,
    icon: 'iron_silence',
  },
  {
    id: 'ach_long_archive',
    name: 'The Long Archive',
    description: 'Reach ending E, The Long Archive.',
    when: { echo: 'echo_ending_e' },
    checkpoints: ['ending'],
    resonance: 0,
    icon: 'long_archive',
  },
  {
    id: 'ach_unbound',
    name: 'The Unbound',
    description: 'Reach ending F, The Unbound.',
    when: { echo: 'echo_ending_f' },
    checkpoints: ['ending'],
    resonance: 0,
    icon: 'unbound',
  },
  {
    id: 'ach_all_endings',
    name: 'Every Door',
    description: 'Reach all six endings.',
    when: { all: ENDING_ECHOES.map((echo) => ({ echo })) },
    checkpoints: ['ending'],
    resonance: 0,
    icon: 'all_endings',
  },
  {
    id: 'ach_commune',
    name: 'It Listens',
    description: 'Reach Resolve 8 in communion with the Tyrant.',
    hidden: true,
    when: { resolve: { min: 8 } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'commune',
  },
  {
    id: 'ach_speedrun',
    name: 'Before the Tenth Dawn',
    description: 'Reach any ending by Day 10.',
    when: { all: [{ day: { max: 10 } }, anyEnding] },
    checkpoints: ['ending'],
    resonance: 0,
    icon: 'speedrun',
    notes: 'The ending Echo is granted before the checkpoint runs, so `anyEnding` holds at a true ending; the guard keeps a closer in a profile with no ending yet from earning it.',
  },
  {
    id: 'ach_untouched',
    name: 'Untouched',
    description: 'Win a boss fight without taking damage.',
    hidden: true,
    when: { counter: { name: 'tally_boss_untouched', min: 1 } },
    checkpoints: ['combat_end'],
    resonance: 0,
    icon: 'untouched',
    notes: 'Reads a tally: damage taken per fight is combat state, not a Condition atom.',
  },
  {
    id: 'ach_sworn_remnant',
    name: 'Sworn to the Remnants',
    description: 'Reach Sworn with the Remnants of Aethelgard.',
    when: sworn('remnants'),
    checkpoints: ['step'],
    resonance: 0,
    icon: 'sworn_remnant',
  },
  {
    id: 'ach_sworn_weaver',
    name: 'Sworn to the Weavers',
    description: 'Reach Sworn with the Shadow Weavers.',
    when: sworn('weavers'),
    checkpoints: ['step'],
    resonance: 0,
    icon: 'sworn_weaver',
  },
  {
    id: 'ach_sworn_ironclad',
    name: 'Sworn to the Ironclad',
    description: 'Reach Sworn with the Ironclad Nomads.',
    when: sworn('ironclad'),
    checkpoints: ['step'],
    resonance: 0,
    icon: 'sworn_ironclad',
  },
  {
    id: 'ach_two_oaths',
    name: 'Two Oaths',
    description: 'Be Sworn with two factions in one loop.',
    hidden: true,
    when: {
      any: [
        { all: [sworn('remnants'), sworn('ironclad')] },
        { all: [sworn('remnants'), sworn('weavers')] },
        { all: [sworn('weavers'), sworn('ironclad')] },
      ],
    },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'two_oaths',
  },
  {
    id: 'ach_mastery_any',
    name: 'Mastered',
    description: 'Master all fifteen abilities of one class.',
    when: { counter: { name: 'tally_mastery_peak', min: 15 } },
    checkpoints: ['loop_end', 'ending'],
    resonance: 0,
    icon: 'mastery_any',
    notes: 'Reads a tally: mastery is written to the profile at the loop end (DESIGN §10.3).',
  },
  {
    id: 'ach_five_classes',
    name: 'Every Life',
    description: 'Finish a loop with each of the five classes.',
    when: { counter: { name: 'tally_classes_finished', min: 5 } },
    checkpoints: ['loop_end', 'ending'],
    resonance: 0,
    icon: 'five_classes',
    notes: 'Reads a tally: no atom reads class mastery or the run history.',
  },
  {
    id: 'ach_capstone_trio',
    name: 'Three Capstones',
    description: 'Hold all three capstone abilities of a class in one loop.',
    when: { counter: { name: 'tally_capstones_held', min: 3 } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'capstone_trio',
    notes: 'Reads a tally: no atom reads the abilities the player holds.',
  },
  {
    id: 'ach_bestiary_full',
    name: 'The Whole Horde',
    description: 'Fill the bestiary: every creature recorded.',
    when: { counter: { name: 'tally_bestiary_complete', min: 1 } },
    resonance: 0,
    icon: 'bestiary_full',
    notes: 'Reads a tally the engine sets when every creature id is in the bestiary.',
  },
  {
    id: 'ach_codex_full',
    name: 'The Long Reading',
    description: 'Unlock every codex entry.',
    when: { counter: { name: 'tally_codex_complete', min: 1 } },
    resonance: 0,
    icon: 'codex_full',
    notes: 'Reads a tally the engine sets when every codex entry is unlocked.',
  },
  {
    id: 'ach_all_echoes',
    name: 'Nothing Forgotten',
    description: 'Hold every Echo.',
    when: { counter: { name: 'tally_echoes_complete', min: 1 } },
    resonance: 0,
    icon: 'all_echoes',
    notes: 'Reads a tally the engine sets when the profile holds every Echo (a list of 103 `echo` atoms would also make rule 16\'s "gates nothing" check pass for every Echo).',
  },
  {
    id: 'ach_cartographer',
    name: 'Cartographer',
    description: 'Have all 73 places in your map memory.',
    when: { counter: { name: 'tally_map_complete', min: 1 } },
    resonance: 0,
    icon: 'cartographer',
    notes: 'Reads a tally the engine sets when all 73 locations are in map memory.',
  },
  {
    id: 'ach_legendary',
    name: 'Legend-Forged',
    description: 'Own a Legendary item.',
    when: { counter: { name: 'tally_legendary_owned', min: 1 } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'legendary',
    notes: 'Reads a tally: no atom reads an item tier.',
  },
  {
    id: 'ach_breach_anchor',
    name: 'The Anchor',
    description: 'Forge the Breach-anchor.',
    when: { item: { id: 'item_breach_anchor' } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'breach_anchor',
  },
  {
    id: 'ach_voidforged',
    name: 'Void-Forged',
    description: 'Craft a void-forged item.',
    when: { counter: { name: 'tally_voidforged_crafted', min: 1 } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'voidforged',
    notes: 'Reads a tally: no atom reads a crafting history.',
  },
  {
    id: 'ach_corrupted',
    name: 'Marked',
    description: 'Reach Corruption 6.',
    hidden: true,
    when: { corruption: { min: 6 } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'corrupted',
  },
  {
    id: 'ach_cleansed',
    name: 'Lanternreed Light',
    description: 'Have Elder Wen cleanse your Corruption at the Breathing Pool.',
    hidden: true,
    when: { flag: 'flag_corruption_cleansed' },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'cleansed',
    notes: 'Elder Wen at loc_breathing_pool sets the flag (D-064); STORY §10.5 reads it for ending E.',
  },
  {
    id: 'ach_pacifist_loop',
    name: 'The Vow Kept',
    description: "Finish a loop under Pacifist's Vow with no kills.",
    when: { all: [{ modifier: 'mod_pacifist' }, { counter: { name: 'tally_kills', max: 0 } }] },
    checkpoints: ['loop_end', 'ending'],
    resonance: 0,
    icon: 'pacifist_loop',
    notes: 'Reads the loop\'s kill tally (the engine\'s, U81a) with the modifier on.',
  },
  {
    id: 'ach_glass_boss',
    name: 'Glass Cannon',
    description: 'Defeat the Unveiled Tyrant with Glass active.',
    when: { all: [{ modifier: 'mod_glass' }, { flag: 'flag_tyrant_dead' }] },
    checkpoints: ['combat_end'],
    resonance: 0,
    icon: 'glass_boss',
  },
  {
    id: 'ach_iron_frayed',
    name: 'Bare and Hurried',
    description: 'Reach an ending with Iron Loop and Frayed Clock both on.',
    when: { all: [{ modifier: 'mod_iron_loop' }, { modifier: 'mod_frayed_clock' }, anyEnding] },
    checkpoints: ['ending'],
    resonance: 0,
    icon: 'iron_frayed',
  },
  {
    id: 'ach_bond_any',
    name: 'A Bond Kept',
    description: 'Bring any companion to loyalty 100.',
    when: { any: COMPANIONS.map((companion) => ({ loyalty: { companion, min: 100 } })) },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'bond_any',
  },
  {
    id: 'ach_ng_plus',
    name: 'The Ring Turns',
    description: 'Start New Game+.',
    when: { counter: { name: 'tally_new_game_plus', min: 1 } },
    checkpoints: ['step'],
    resonance: 0,
    icon: 'ng_plus',
    notes: 'Reads a tally: New Game+ is a profile fact (D-083, reducers/threshold.ts).',
  },
] satisfies AchievementInput[];
