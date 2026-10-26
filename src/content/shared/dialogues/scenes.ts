// The key scenes no quest owns (STORY §13: `scene_tyrant_defeat`, `scene_braks_stand`, `scene_ilyra_portal`,
// `scene_waking_loop_2`, `scene_clock_expiry`; §4.1 beats 13–16, §4.2, §4.3, §5.1; legacy/echoes_of_aethelgard.py
// `handle_chronos_tyrant_defeat`, `handle_ilyra`, `talk_to_npc`), and the legacy Horde line every NPC says. U62. The
// conventions are this folder's index.ts; the engine opens four of these itself where it used to log the same words
// (horde.ts, reducers/loop.ts: a pack that carries the scene has the scene say them, so nothing is said twice):
//   engine   scene_tyrant_defeat (hordePostStep, after Brak's stand and the Horde's start; Loop 2+: "You knew."; with Brak at
//            the Apex: Run, or stay one watch) → scene_braks_stand (from the Nexus; `echo_brak_death`)
//   Ilyra    scene_ilyra_portal (the Library while the Horde runs — her Horde scene, the `urgent` band: the six-Spellbook lore
//            once, the legacy line, Loop 2+ with `flag_ilyra_told` her new sentence, Enter the portal? → `closer_escape`;
//            from Loop 2 `echo_ilyra_cost`)
//   place    scene_waking_loop_2 (the Ruins' `ev_ruins_waking`, Loop 2's first arrival: the Amulet, the clock, Ilyra)
//   engine   scene_clock_expiry (expireClock, the thirtieth dawn: the tear, the scream, whoever is present; `echo_thirtieth_dawn`)
//   NPCs     scene_horde_<npc> for every present-day NPC but Ilyra (legacy `talk_to_npc`: "Go, Wayfinder! The horde approaches!")
//
// What the engine still does at those moments is the engine's: Brak's stand (horde.ts `brakStand`: he is gone, dead if
// recruited, `echo_brak_death`), the Horde's start and spread, the portal (`enterPortal`), the loop's close. The scenes say
// what STORY §13 gives them (tags `legacy` and `story`, verbatim) and a few joins (tag `written`, pinned by
// tests/unit/content/scenes.test.ts). §13's lines that are a place's description, an event's text or an encounter's intro
// (the Ruins, the Library, the Apex) stay where they are and are not said twice; the test names each.
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import { FROM_LOOP_2, SCENE_PRIORITY, type NodeInput } from './common';

const ILYRA = 'npc_ilyra';
const BRAK = 'npc_brak';
const TYRANT = 'cr_chronos_tyrant_unveiled';
const NEXUS = 'loc_chronos_nexus';
const LIBRARY = 'loc_shattered_library';

const HORDE_ACTIVE: Condition = { flag: 'flag_horde_active' };
const completed = (id: `q_${string}`): Condition => ({ quest: { id, status: 'completed' } });

/**
 * WORLD §12.1 `ws_brak_at_apex`, as the engine reads it (horde.ts `brakComesToApex`): both legacy quests done this loop,
 * not kept away (`q_the_line_he_holds` A), not holding the Nexus (its C, which grants `echo_brak_lives` this loop).
 */
export const BRAK_AT_THE_APEX: Condition = {
  all: [completed('q_clear_path'), completed('q_blighted_outpost'), { not: { flag: 'flag_brak_kept_away' } }, { not: { quest: { id: 'q_the_line_he_holds', stage: 'holds_nexus' } } }],
};
/** STORY §13: the Loop 2+ breath in which the chorus is one voice — once it has spoken to you. */
const IT_KNEW: Condition = { all: [FROM_LOOP_2, { echo: 'echo_tyrant_speaks' }] };

// ---- The legacy lines (legacy/echoes_of_aethelgard.py; the "dust,," typo corrected, STORY §13) ------------------------------------

const DUST = 'As the Chronos Tyrant begins to crumble into a pile of temporal dust, a guttural, echoing scream tears through the Apex.';
const SHRIEKS = "'You have undone the threads! Now, witness the unraveling!' it shrieks, its voice a chorus of countless dying moments.";
const BRAK_ARRIVES = 'Brak Stonehand, his face grim and scarred, bursts into the Apex, his heavy axe already drawn.';
const SHATTERS = 'The very air shatters, and from the newly formed chasms, a cacophony of screeches erupts! A tide of grotesque creatures, their eyes burning with hunger, surges towards you.';
const SPILLS = 'The Temporal Breach spills outward in a cascading collapse. The creatures surge forth, tearing at the fabric of stable reality.';
const NO_TIME =
  "Wayfinder! There's no time! The Tyrant's defeat has shattered its hold, and the Temporal Breach is fully unraveling! Reality itself is collapsing! A raw portal has just bloomed in the Shattered Library - Ilyra is there, Wayfinder, using all her Remnant power to hold it open! It's your only way out! You must reach it before this unraveling chaos, the true horrors of the Sundering, swallows the path and seals your last escape!";
const RUN = "Go! I'll hold them back as long as I can! Don't look back, Wayfinder! Run!";
const PULSE = 'A new pulse blooms in the Shattered Library, a raw portal clawing at the air. Its light flickers like a heartbeat on the verge of collapse. Reach it before the unraveling swallows the path and the last escape seals.';
const SPELLBOOK_LORE =
  "Wayfinder, I've been studying the fragments of lore we've gathered. The mages who caused the Sundering... they didn't just seek power, they sought to command time itself. But their research notes, their rituals... many of them were recorded in tomes much like the 'Dark Spellbooks' you carry. They delved deeper and deeper, believing they were mastering time, but the books, the forbidden knowledge, slowly mastered them. It warped their judgment, consumed their ethics, and blinded them to the true danger of tearing at the fabric of existence. The cost to your vitality when you read them... it's a small echo of the price they paid, and the price Aethelgard is still paying.";
const MADE_IT =
  "Wayfinder! You made it! This portal... it's not just a way from Aethelgard, it's a tear through the Temporal Breach itself! I can't hold it much longer! The unraveling... it's consuming everything! You must step through! Carry the truth of Aethelgard's folly, the knowledge of this collapsing reality, to wherever it leads! Go! Escape... and remember!";
/** STORY §13 (new): Loop 2+, once she has been told. Appended to the legacy line (one speaker, two lines: index.ts). */
const REMEMBER_ME = "You said you'd done this. Did I say remember? ...Then remember me, this time. The ink still holds.";
const HORDE_LINE = 'Go, Wayfinder! The horde approaches!';

/** The Wayfinder's lines of the Horde: the first ones of a Tyrant's fall. `knew`: the Loop 2+ breath between the dust and the shriek. */
const fall = (suffix: string, knew: boolean, next: string): NodeInput[] => [
  { id: `dust${suffix}`, tags: ['legacy'], speaker: 'narrator', text: DUST, mood: 'urgent', next: knew ? `breath${suffix}` : `shrieks${suffix}` },
  ...(knew
    ? ([
        { id: `breath${suffix}`, tags: ['story'], speaker: 'narrator', text: 'For one breath it is one voice:', mood: 'grim', next: `knew${suffix}` },
        { id: `knew${suffix}`, tags: ['story'], speaker: TYRANT, text: 'You knew.', mood: 'grim', next: `shrieks${suffix}` },
      ] satisfies NodeInput[])
    : []),
  { id: `shrieks${suffix}`, tags: ['legacy'], speaker: 'narrator', text: SHRIEKS, mood: 'urgent', next },
];

/** The present-day NPCs the Horde line is for: every one but Ilyra (whose Horde scene is the portal's), the Before's and the Threshold's. */
export const HORDE_LINE_NPCS: readonly `npc_${string}`[] = [
  'npc_ansel_dray',
  'npc_tamsin_reed',
  'npc_kaelen_stonehand',
  'npc_brak',
  'npc_borin_stonefist',
  'npc_nyx',
  'npc_dask',
  'npc_sethe_unlidded',
  'npc_ysmay',
  'npc_hollis_cade',
  'npc_mireya',
  'npc_elder_wen',
  'npc_elder_tam',
  'npc_old_fennick',
  'npc_scout_ferrin',
  'npc_hadda_ironvow',
  'npc_oma_varr',
  'npc_tessaly_varr',
  'npc_ketch',
  'npc_sedge_marrow',
  'npc_pellam',
];

export const dialogues = [
  // ==== The Tyrant's fall (STORY §13 `scene_tyrant_defeat`; legacy climax, kept whole) ===========================================
  // Opened by the engine (horde.ts `hordePostStep`) once a Tyrant has died in a fight that is over: Brak has already made his stand
  // and the Horde has started. Four openings: with or without the Loop 2+ breath, with or without Brak; the tails rejoin.
  {
    id: 'scene_tyrant_defeat',
    title: 'Witness the unraveling',
    entry: [
      { when: { all: [IT_KNEW, BRAK_AT_THE_APEX] }, node: 'dust_knew_brak' },
      { when: IT_KNEW, node: 'dust_knew' },
      { when: BRAK_AT_THE_APEX, node: 'dust_brak' },
      { when: { all: [] }, node: 'dust' },
    ],
    nodes: [
      ...fall('_knew_brak', true, 'arrives'),
      ...fall('_knew', true, 'shatters_alone'),
      ...fall('_brak', false, 'arrives'),
      ...fall('', false, 'shatters_alone'),
      // ---- with Brak at the Apex (WORLD §12.1 `ws_brak_at_apex`) ----
      { id: 'arrives', tags: ['legacy'], speaker: 'narrator', text: BRAK_ARRIVES, mood: 'urgent', next: 'shatters' },
      { id: 'shatters', tags: ['legacy'], speaker: 'narrator', text: SHATTERS, mood: 'urgent', next: 'spills' },
      { id: 'spills', tags: ['legacy'], speaker: 'narrator', text: SPILLS, mood: 'urgent', next: 'no_time' },
      { id: 'no_time', tags: ['legacy'], speaker: BRAK, text: NO_TIME, mood: 'urgent', next: 'run' },
      {
        id: 'run',
        tags: ['legacy'],
        speaker: BRAK,
        text: RUN,
        mood: 'urgent',
        choices: [
          { id: 'run', text: 'Run.', next: 'end' },
          // STORY §13: Loop 2+, from the Nexus; the watch passes, the way down is the way the Horde will come
          {
            id: 'stay',
            text: 'Stay one watch.',
            when: FROM_LOOP_2,
            effects: [{ passWatches: 1 }, { teleport: NEXUS }, { startDialogue: 'scene_braks_stand' }],
            next: 'end',
          },
        ],
      },
      // ---- alone (legacy `portal_warning_given`: the Library's pulse) ----
      { id: 'shatters_alone', tags: ['legacy'], speaker: 'narrator', text: SHATTERS, mood: 'urgent', next: 'spills_alone' },
      { id: 'spills_alone', tags: ['legacy'], speaker: 'narrator', text: SPILLS, mood: 'urgent', next: 'pulse' },
      { id: 'pulse', tags: ['legacy'], speaker: 'narrator', text: PULSE, mood: 'urgent', next: 'end' },
    ],
  },

  // ==== Brak Stonehand (STORY §13 `scene_braks_stand`; §7.2) =====================================================================
  // From the Nexus, one watch after the fall (the choice above). No choice: the player goes on at any line; the Echo is the first
  // line's, so leaving early still earns it (the engine's `brakStand` has granted it too).
  {
    id: 'scene_braks_stand',
    title: 'Brak Stonehand',
    entry: 'wound',
    nodes: [
      {
        id: 'wound',
        tags: ['story'],
        speaker: 'narrator',
        text: 'From the Nexus the Apex is a wound with a man in it. He has set his feet the way scouts are taught, the off-foot back.',
        mood: 'grim',
        onEnter: [{ grantEcho: 'echo_brak_death' }],
        next: 'steel',
      },
      { id: 'steel', tags: ['story'], speaker: BRAK, text: "Steel and stubbornness. Come on, then. One of them's about to run out.", mood: 'wry', next: 'waves' },
      { id: 'waves', tags: ['story'], speaker: 'narrator', text: 'He takes the first wave. He takes the second. On the third he is laughing, which is how you know.', mood: 'grim', next: 'kaelen' },
      { id: 'kaelen', tags: ['story'], speaker: BRAK, text: "Tell Kaelen— no. Don't tell him anything. He'll know.", mood: 'grim', next: 'named' },
      {
        id: 'named',
        tags: ['story'],
        speaker: 'narrator',
        text: 'Brak Stonehand goes down holding the line, and the line holds a moment longer than he does.',
        mood: 'grim',
        next: 'spent',
      },
      {
        id: 'spent',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The watch is spent. What he held is coming down the stair now, and the Library is a long way west.',
        mood: 'urgent',
        next: 'end',
      },
    ],
  },

  // ==== The Last Threshold (STORY §13 `scene_ilyra_portal`; legacy `handle_ilyra` at the portal) ===================================
  // Ilyra at the Library while the Horde runs (the engine moves her there). The `urgent` band: her only scene in a Horde. The
  // Library's own words ("The Shattered Library. The air here crackles…") are the place's description while the portal stands open
  // (silverwood_ruins/locations.ts), so the scene does not say them again.
  {
    id: 'scene_ilyra_portal',
    npcId: ILYRA,
    title: 'The Last Threshold',
    when: { all: [HORDE_ACTIVE, { location: LIBRARY }] },
    priority: SCENE_PRIORITY.urgent,
    entry: [
      // legacy: six Dark Spellbooks read, said once (`ilyra_spellbook_lore`)
      { when: { all: [{ counter: { name: 'spellbooks_read', min: 6 } }, { not: { flag: 'flag_ilyra_spellbook_lore' } }] }, node: 'lore' },
      { when: { all: [] }, node: 'made_it' },
    ],
    nodes: [
      { id: 'lore', tags: ['legacy'], speaker: ILYRA, text: SPELLBOOK_LORE, mood: 'afraid', onEnter: [{ setFlag: 'flag_ilyra_spellbook_lore' }], next: 'made_it' },
      {
        id: 'made_it',
        tags: ['legacy'],
        speaker: ILYRA,
        text: MADE_IT,
        mood: 'urgent',
        // STORY §13 (new): Loop 2+, told at the Ruins that you had done this before (scene_first_meeting_ilyra, `flag_ilyra_told`)
        textVariants: [{ when: { all: [FROM_LOOP_2, { flag: 'flag_ilyra_told' }] }, text: `${MADE_IT} ${REMEMBER_ME}` }],
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['legacy'],
        speaker: 'narrator',
        text: 'Enter the portal?',
        mood: 'urgent',
        choices: [
          // STORY §4.2, §10.7: `closer_escape` (Loop 1 wakes in Loop 2; later loops land on the Still Shore); from Loop 2 what the door
          // costs is watched from its far side (STORY §12 `echo_ilyra_cost`; the engine's `enterPortal` grants it the same way)
          { id: 'yes', text: 'Yes.', effects: [{ onlyIf: { when: FROM_LOOP_2, effects: [{ grantEcho: 'echo_ilyra_cost' }] } }, { endLoop: { closer: 'closer_escape' } }], next: 'end' },
          { id: 'no', text: 'No.', next: 'hold' },
        ],
      },
      { id: 'hold', tags: ['written'], speaker: ILYRA, text: 'Then be quick about whatever keeps you, Wayfinder. I can hold it a little longer. Not much.', mood: 'urgent', next: 'end' },
    ],
  },

  // ==== The Amulet is warm (STORY §13 `scene_waking_loop_2`; §5.1) ===============================================================
  // The Ruins' `ev_ruins_waking` (silverwood_ruins/locations.ts), Loop 2's first arrival. The Ruins' description and its hum
  // (`ev_ruins_echo`) are the place's; the engine has granted `echo_amulet_memory` on waking and leaves the Amulet's line to this.
  {
    id: 'scene_waking_loop_2',
    title: 'The Amulet is warm',
    entry: 'warm',
    nodes: [
      {
        id: 'warm',
        tags: ['story'],
        speaker: 'narrator',
        text: 'The Amulet of Echoes is warm against your throat. You did not pick it up. It is simply there, as it was, as it will be. Your hands remember a portal. The stones remember nothing.',
        mood: 'cold',
        onEnter: [{ grantEcho: 'echo_amulet_memory' }],
        next: 'clock',
      },
      { id: 'clock', tags: ['story'], speaker: 'narrator', text: 'Breach Clock — Day 1 of 30.', mood: 'cold', next: 'ilyra' },
      { id: 'ilyra', tags: ['story'], speaker: 'narrator', text: 'Ilyra is standing where she stood. She has not seen you yet. She is about to.', mood: 'cold', next: 'end' },
    ],
  },

  // ==== The thirtieth dawn (STORY §13 `scene_clock_expiry`; §4.3) ================================================================
  // Opened by the engine (reducers/loop.ts `expireClock`) when the clock runs out with no Horde running; the Horde has started
  // (three moves). The companions' lines are theirs: a line voiced by a companion not standing in the party is skipped (index.ts).
  {
    id: 'scene_clock_expiry',
    title: 'The thirtieth dawn',
    entry: 'tears',
    nodes: [
      {
        id: 'tears',
        tags: ['story'],
        speaker: 'narrator',
        text: 'The thirtieth dawn does not come up. The sky tears instead, east to west, a seam of no-colour.',
        mood: 'cold',
        onEnter: [{ grantEcho: 'echo_thirtieth_dawn' }],
        next: 'scream',
      },
      {
        id: 'scream',
        tags: ['story'],
        speaker: 'narrator',
        text: 'From the Apex, across every mile between, a scream reaches you: guttural, echoing, a chorus of countless dying moments. The Tyrant has not been touched. It is screaming anyway.',
        mood: 'urgent',
        next: 'ilyra',
      },
      { id: 'ilyra', tags: ['story'], speaker: 'ilyra', text: "It wasn't us. We didn't— Wayfinder, it wasn't us.", mood: 'afraid', next: 'brak' },
      { id: 'brak', tags: ['story'], speaker: 'brak', text: "That's the Horde. I know the sound. Nobody did anything.", mood: 'grim', next: 'nyx' },
      { id: 'nyx', tags: ['story'], speaker: 'nyx', text: 'Thirty. Ashcombe counted thirty. I thought he was wrong by a lifetime.', mood: 'afraid', next: 'west' },
      {
        id: 'west',
        tags: ['written'],
        speaker: 'narrator',
        text: 'It is coming down from the Apex the way water comes down a stair. West, in the Shattered Library, one pair of hands is holding a door open. You have a few moves before the road is gone.',
        mood: 'urgent',
        next: 'end',
      },
    ],
  },

  // ==== The Horde's line (legacy `talk_to_npc`): every present-day NPC, while the Horde runs =========================================
  ...HORDE_LINE_NPCS.map(
    (npcId): DialogueSceneInput => ({
      id: `scene_horde_${npcId.slice('npc_'.length)}`,
      npcId,
      when: HORDE_ACTIVE,
      priority: SCENE_PRIORITY.urgent,
      entry: 'go',
      nodes: [{ id: 'go', tags: ['legacy'], speaker: npcId, text: HORDE_LINE, mood: 'urgent', next: 'end' }],
    }),
  ),
] satisfies DialogueSceneInput[];
