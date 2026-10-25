// The five class mini-quests (STORY §11.8: `q_class_ranger`, `q_class_wizard`, `q_class_elf`, `q_class_ironclad_warden`,
// `q_class_shadow_weaver`; DESIGN §10.9 "available only while playing that class, only from Loop 2, and grant the class's
// badge"; D-008, D-069.7; outside D-045's 44). Their scenes are ../dialogues/classes.ts; the conventions both follow are
// ./index.ts and ../dialogues/index.ts (U52's pattern, D-105, D-109, D-112–D-115, D-122, D-123).
//
// Each quest is its class's: `classId` locks it (reducers/quests.ts `questStartProblem`: "not for your class"), every gate
// reads `FROM_LOOP_2` (D-067.17, D-069.7), and the record is the class's `uniqueQuestId` (shared/classes.ts). The badge
// (DESIGN §10.9) is the completed quest itself, data only: a completion writes `quest:q_class_<class>` into the profile's
// `discoveries` and the run's `questsCompleted` (effects.ts `questDoneEarlier` reads both), which the Far Light's class
// cards (DESIGN §10.9, §16.3 "mastery badges") can read; no engine field is added (C1, D-073). Pacifist unless STORY says
// otherwise (the Warden's is not). Quest XP: DESIGN §6.2 gives the mini-quests no tier of their own; 150, the first rung of
// the faction and companion ladders (listed in the U59 reply).
//
// Text: `name` and the first stage's journal are STORY's (tag `story`); the later journals are written (tag `written`,
// listed in the U59 reply); `description` is the giver's ask, or the place's, in one sentence. Each quest plays to its class
// (DESIGN §3, D-008): the Ranger reads the ground and snares (Hunt, Wildcraft), the Wizard reads a page by ley-light, the Elf
// draws or stands still (Bladesong, Shadowstep), the Warden is a wall (Bulwark: three waves at the gap), the Weaver hexes
// (Hex) and takes nothing.
//
// How each hooks in (each region edit is listed in the U59 reply):
//   - q_class_ranger: Kaelen's ask at the Respite; the ground is read by an interact at the Mistwood Path (`ev_mistwood_read_ground`:
//     the marks, then the snare at the drag-line — one watch passes in the waiting); the runner is brought home to Kaelen.
//     "Kaelen's prices −5% this loop; `echo_kaelen_ledger` if not held": the Echo is the price cut (economy.ts `ECHO_LEDGER`,
//     for good; no loop-scoped cut exists), granted as a reward (idempotent when held).
//   - q_class_wizard: Tamsin's ask at the Plaza; the page is read by an interact at the fountain at night (`ev_plaza_ley_light`,
//     once the stage is reached there at night): Korr's hand; copy it (Corruption +1, `echo_korr_marginalia`) or burn it
//     (Remnants +5) — the outcome rides on the choice. The page is not an item (listed).
//   - q_class_elf: a discovery at the Crumbling Archway (`ev_archway_follow`, Elf only: the whisper says follow to Silverwood
//     blood); at dusk the Plaza's flagstone (`ev_plaza_duelling_ground`) opens the buried duelling-ground; draw (the
//     encounter below, `onVictory` → `won`) or stand still (`passed`). Both outcomes cut the first Wayfinder's mark and open
//     `codex_seven_wayfinders`. "Without taking a hit" has no condition atom (listed: a win is a win).
//   - q_class_ironclad_warden: Brak's ask at the Camp (his hub chains to it, the one edit to companions_u54.ts); the night
//     hold is an interact at the Camp (`ev_camp_barricade_gap`): three waves chained by `onVictory` (the Day of Teeth's form,
//     D-109), counted by kills; Borin tempers the plate at the Emberforge (no watch gate: the scene says dawn; listed).
//   - q_class_shadow_weaver: Nyx's ask at the Chasm; the seam is an interact at the Hollow (`ev_hollow_feel_seam`): a Stalker
//     comes to the hand, the hex turns it on its pack (narrated: no atom reads a cast), the pack dies in the scree; leave
//     the Shard (`return`: Weavers +5 and the line she says to no one else) or take it (`return_took`: no line, no +5).
import type { EncounterInput } from '@schema/encounter';
import type { QuestInput } from '@schema/quest';
import { FROM_LOOP_2 } from '../dialogues/common';

/** The badge is the completed quest (see the header); DESIGN §6.2 gives no mini-quest tier: the first rung. */
const CLASS_QUEST_XP = 150;

export const quests = [
  // ---- The Unmarked Trail — Ranger (STORY §11.8; giver Kaelen, the Respite; Mistwood & Reach) ----------------------------------
  {
    id: 'q_class_ranger',
    name: 'The Unmarked Trail',
    description: 'Kaelen asks you to read the Mistwood Path for his salt-runner, who went out at dawn and did not come back.',
    category: 'class',
    botHint: 'explorer',
    classId: 'ranger',
    giverNpcId: 'npc_kaelen_stonehand',
    availableWhen: FROM_LOOP_2,
    stages: [
      {
        id: 'read_ground',
        tags: ['story'],
        journal: "Kaelen's salt-runner never came back from the Mistwood Path. Read the ground.",
        // scene_mistwood_read_ground (ev_mistwood_read_ground): the marks read → snare
        next: 'snare',
      },
      {
        id: 'snare',
        tags: ['written'],
        journal: "A Prowler's marks, and a drag-line going off the trail into the bark-glow. Set a snare where the line runs, and wait for it.",
        // the same scene: the snare set, one watch → bring_home
        next: 'bring_home',
      },
      {
        id: 'bring_home',
        tags: ['written'],
        journal: 'The runner is alive under the roots, salt and all, and the Prowler is in your snare. Bring him home to the Respite.',
        objectives: [{ id: 'obj_respite', text: "Bring the runner home to the Wayfarer's Respite", when: { location: 'loc_wayfarers_respite' }, hintLocationId: 'loc_wayfarers_respite' }],
        // scene_kaelen_unmarked_trail_report → home
        next: 'home',
      },
      {
        id: 'home',
        tags: ['written'],
        journal: 'Kaelen has the runner back and has put him in the ledger. His prices have come down a twentieth for you.',
        outcome: 'complete',
      },
    ],
    // STORY: the Harrier Bow; Kaelen's prices −5 % (the Echo, economy.ts `ECHO_LEDGER`; `echo_kaelen_ledger` if not held)
    rewards: { xp: CLASS_QUEST_XP, items: [{ itemId: 'item_harrier_bow' }], echoes: ['echo_kaelen_ledger'] },
  },

  // ---- The Seventh Page — Wizard (STORY §11.8; giver Scribe Tamsin Reed, the Plaza; Silverwood Ruins) --------------------------
  {
    id: 'q_class_wizard',
    name: 'The Seventh Page',
    description: 'Scribe Tamsin has a page no Remnant can read, and wants it read by ley-light at the fountain, at night.',
    category: 'class',
    botHint: 'caster',
    classId: 'wizard',
    giverNpcId: 'npc_tamsin_reed',
    factionId: 'remnants',
    availableWhen: FROM_LOOP_2,
    stages: [
      {
        id: 'ley_light',
        tags: ['story'],
        journal: 'Tamsin has a page no Remnant can read. Read it by ley-light at the fountain, at night.',
        objectives: [{ id: 'obj_fountain', text: 'Be at the Silverwood Plaza fountain at night', when: { all: [{ location: 'loc_silverwood_plaza' }, { watch: 'night' }] }, hintLocationId: 'loc_silverwood_plaza' }],
        next: 'read',
      },
      {
        id: 'read',
        tags: ['written'],
        journal: "The fountain's ley-light is up. Hold the page over the water and read what the ink does under it.",
        // scene_plaza_ley_light (ev_plaza_ley_light) decides: copy → copied, burn → burned
        next: 'copied',
      },
      {
        id: 'copied',
        tags: ['written'],
        journal: "Maelis Korr's hand, the seventh page of a book bound with six. You copied it. The copy is in your head now, and so is he.",
        outcome: 'complete',
      },
      {
        id: 'burned',
        tags: ['written'],
        journal: "Maelis Korr's hand. You burned it on the fountain's rim and gave Tamsin the ash. The Remnants will not read it, and neither will anyone else.",
        outcome: 'complete',
      },
    ],
    // STORY: the Scriptorium Staff; Corruption +1 and `echo_korr_marginalia` ride on the copy, Remnants +5 on the burning
    rewards: { xp: CLASS_QUEST_XP, items: [{ itemId: 'item_scriptorium_staff' }] },
  },

  // ---- Bladesong at the Archway — Elf (STORY §11.8; discovery at the Crumbling Archway; Silverwood Ruins) ------------------------
  {
    id: 'q_class_elf',
    name: 'Bladesong at the Archway',
    description: 'The whisper under the Crumbling Archway says follow, and it says it to Silverwood blood.',
    category: 'class',
    botHint: 'melee',
    classId: 'elf',
    availableWhen: FROM_LOOP_2,
    stages: [
      {
        id: 'follow',
        tags: ['story'],
        journal: "The Archway's whisper follows you. Follow it back at dusk.",
        objectives: [{ id: 'obj_dusk', text: "Keep the whisper's pace to the Silverwood Plaza at dusk", when: { all: [{ location: 'loc_silverwood_plaza' }, { watch: 'dusk' }] }, hintLocationId: 'loc_silverwood_plaza' }],
        next: 'duel',
      },
      {
        id: 'duel',
        tags: ['written'],
        journal: "At dusk the whisper went down under the Plaza, where the fountains' old stone is. A duelling-ground is buried there, and something is still fighting on it.",
        // scene_plaza_last_duel (ev_plaza_duelling_ground) decides: draw (enc_plaza_last_duel, onVictory → won) or stand still → passed
        next: 'won',
      },
      {
        id: 'won',
        tags: ['written'],
        journal: "Sael Orrin's last duel is over, five hundred years late, and you ended it. His mark is cut in the floor where he stood. Seven stood after him.",
        // STORY: the first Wayfinder's mark; `codex_seven_wayfinders` opens
        onEnter: [{ unlockCodex: 'codex_seven_wayfinders' }],
        outcome: 'complete',
      },
      {
        id: 'passed',
        tags: ['written'],
        journal: "You stood still, and the Phantom struck where you were, five hundred years ago. Sael Orrin's mark is cut in the floor where he stood. Seven stood after him.",
        onEnter: [{ unlockCodex: 'codex_seven_wayfinders' }],
        outcome: 'complete',
      },
    ],
    // STORY: the Elven Bow
    rewards: { xp: CLASS_QUEST_XP, items: [{ itemId: 'item_elven_bow' }] },
  },

  // ---- The Wall That Holds — Ironclad Warden (STORY §11.8; giver Brak, Ironclad Camp; Mistwood & Reach; not pacifist) -----------
  {
    id: 'q_class_ironclad_warden',
    name: 'The Wall That Holds',
    description: "Brak wants a wall in the barricade's gap tonight, when the Wildling pack comes.",
    category: 'class',
    botHint: 'melee',
    classId: 'ironclad_warden',
    giverNpcId: 'npc_brak',
    factionId: 'ironclad',
    availableWhen: FROM_LOOP_2,
    stages: [
      {
        id: 'be_a_wall',
        tags: ['story'],
        journal: 'A Wildling pack comes at the barricade tonight. Brak wants a wall. Be one.',
        objectives: [{ id: 'obj_night', text: 'Be at the Ironclad Camp at night', when: { all: [{ location: 'loc_ironclad_camp' }, { watch: 'night' }] }, hintLocationId: 'loc_ironclad_camp' }],
        next: 'hold',
      },
      {
        id: 'hold',
        tags: ['written'],
        journal: 'Night at the Camp. Take the gap in the barricade when the pack comes, and hold it. Three waves; Guard and Taunt count. Nothing goes past you.',
        // scene_camp_barricade_night (ev_camp_barricade_gap) starts wave 1; the waves chain (encounters below)
        objectives: [
          {
            id: 'obj_waves',
            text: 'Hold the gap through the three waves',
            when: { all: [{ killed: { id: 'cr_mistwood_prowler', count: 4, sinceStage: true } }, { killed: { id: 'cr_wildling_brute', count: 3, sinceStage: true } }] },
            hintLocationId: 'loc_ironclad_camp',
          },
        ],
        next: 'dawn',
      },
      {
        id: 'dawn',
        tags: ['written'],
        journal: 'The gap held. Take the plate you held it with to Borin at the Emberforge; he tempers at dawn.',
        objectives: [{ id: 'obj_emberforge', text: 'Take the plate to Borin at the Emberforge', when: { location: 'loc_emberforge' }, hintLocationId: 'loc_emberforge' }],
        // scene_borin_wall_tempered → tempered
        next: 'tempered',
      },
      {
        id: 'tempered',
        tags: ['written'],
        journal: 'Borin tempered the plate while the fire was at its morning heat, and put a hammer in your hand. The Camp has a wall, and it has your name.',
        outcome: 'complete',
      },
    ],
    // STORY: Ironclad +5; the Ironclad Hammer
    rewards: { xp: CLASS_QUEST_XP, items: [{ itemId: 'item_ironclad_hammer' }], rep: [{ faction: 'ironclad', delta: 5 }] },
  },

  // ---- The Unlit Thread — Shadow Weaver (STORY §11.8; giver Nyx, the Chasm; Voidscar) --------------------------------------------
  {
    id: 'q_class_shadow_weaver',
    name: 'The Unlit Thread',
    description: "Nyx wants to see whether the void knows your hand: feel for the seam at the Hollow's edge at night.",
    category: 'class',
    botHint: 'caster',
    classId: 'shadow_weaver',
    giverNpcId: 'npc_nyx',
    factionId: 'weavers',
    availableWhen: FROM_LOOP_2,
    stages: [
      {
        id: 'seam',
        tags: ['story'],
        journal: "Nyx wants to see whether the void knows your hand. Go to the Hollow's edge at night and feel for the seam.",
        objectives: [{ id: 'obj_hollow', text: "Be at the Voidscar Hollow's far edge at night", when: { all: [{ location: 'loc_voidscar_hollow' }, { watch: 'night' }] }, hintLocationId: 'loc_voidscar_hollow' }],
        next: 'hex',
      },
      {
        id: 'hex',
        tags: ['written'],
        journal: "The seam is at the Hollow's far edge, under the curtain. A Stalker will come to your hand. Hex it so it turns on its pack. Take nothing from the fight.",
        // scene_hollow_unlit_thread (ev_hollow_feel_seam) decides: the Shard left → return, taken → return_took
        next: 'return',
      },
      {
        id: 'return',
        tags: ['written'],
        journal: 'The pack tore itself apart in the scree, and you took nothing. Go back to the Chasm and tell Nyx what the void did.',
        objectives: [{ id: 'obj_chasm', text: 'Return to Nyx at the Chasm of Whispers', when: { location: 'loc_chasm_of_whispers' }, hintLocationId: 'loc_chasm_of_whispers' }],
        // scene_nyx_unlit_thread_report → one_of_us
        next: 'one_of_us',
      },
      {
        id: 'return_took',
        tags: ['written'],
        journal: 'The pack tore itself apart in the scree. You took a Shard from it. Go back to the Chasm; Nyx will know.',
        objectives: [{ id: 'obj_chasm_took', text: 'Return to Nyx at the Chasm of Whispers', when: { location: 'loc_chasm_of_whispers' }, hintLocationId: 'loc_chasm_of_whispers' }],
        // scene_nyx_unlit_thread_report → remembered
        next: 'remembered',
      },
      {
        id: 'one_of_us',
        tags: ['written'],
        journal: 'She said it to you and to no one else: you could have been one of the nine. The void remembers your hand now.',
        outcome: 'complete',
      },
      {
        id: 'remembered',
        tags: ['written'],
        journal: 'You took from the fight. She did not say the thing she says to no one else, and she will not. The void remembers your hand, and what it held.',
        outcome: 'complete',
      },
    ],
    // STORY: the Chasmglass Focus; Weavers +5 rides on the clean return (the report's line)
    rewards: { xp: CLASS_QUEST_XP, items: [{ itemId: 'item_chasmglass_focus' }] },
  },
] satisfies QuestInput[];

/** The duel's and the waves' intro lines (written; listed in the U59 reply). */
export const CLASS_FIGHT_INTROS = [
  'The Phantom turns to you for the first time in five hundred years, and its guard changes.',
  'Two grey cats come out of the fog at a run, low, and the first one is already at the gap.',
  'The fog spits two more, and behind them something heavier is pushing the trees apart.',
  'Roots and bone, two of them, shoulder to shoulder, and the gap is exactly as wide as they are.',
] as const;

/**
 * q_class_elf's duel (STORY §11.8 "a Shimmering Phantom fights Sael Orrin's last duel over again"), a story gate that holds,
 * started by the duelling-ground's choice (`onVictory` → `won`); and q_class_ironclad_warden's three waves (STORY "Hold the
 * barricade for the night (three waves)"), the Day of Teeth's form (../quests/factions.ts, D-109): each wave's `onVictory`
 * starts the next so no step passes between them, and the stage counts the kills. Table encounters are global ids (PLAN §5.19 rule 6).
 */
export const encounters = [
  {
    id: 'enc_plaza_last_duel',
    groups: [{ creatureId: 'cr_shimmering_phantom' }],
    fleeable: false,
    onFlee: 'hold',
    intro: CLASS_FIGHT_INTROS[0],
    onVictory: [{ questAdvance: { quest: 'q_class_elf', stage: 'won' } }],
  },
  {
    id: 'enc_camp_wall_wave_1',
    groups: [{ creatureId: 'cr_mistwood_prowler', count: 2 }],
    fleeable: false,
    onFlee: 'hold',
    intro: CLASS_FIGHT_INTROS[1],
    onVictory: [{ startCombat: 'enc_camp_wall_wave_2' }],
  },
  {
    id: 'enc_camp_wall_wave_2',
    groups: [
      { creatureId: 'cr_mistwood_prowler', count: 2 },
      { creatureId: 'cr_wildling_brute', count: 1 },
    ],
    fleeable: false,
    onFlee: 'hold',
    intro: CLASS_FIGHT_INTROS[2],
    onVictory: [{ startCombat: 'enc_camp_wall_wave_3' }],
  },
  {
    id: 'enc_camp_wall_wave_3',
    groups: [{ creatureId: 'cr_wildling_brute', count: 2 }],
    fleeable: false,
    onFlee: 'hold',
    intro: CLASS_FIGHT_INTROS[3],
  },
] satisfies EncounterInput[];
