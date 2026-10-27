// Mireya's and Caelum's arcs: the six companion quests (STORY §11.4 `q_lantern_in_the_reeds`, `q_what_the_light_takes`,
// `q_preserve_or_heal`, `q_the_apprentices_errand`, `q_a_boy_from_a_doomed_city`, `q_his_masters_sin`; §7.5–§7.6 the arcs;
// §9.6 how Caelum comes forward; DESIGN §6.2 "companion arc 150/250/400", §12.1 recruitment, §12.5 loyalty — +5 per arc
// stage, stage 2 at 25, stage 3 at 50; D-052 either fragment dams; D-067.9 the two messages; D-095/D-102 the Before's
// Bells and hours; D-111 the companions are registered). Their scenes are ../dialogues/companions_u56.ts; the conventions
// both follow are ./index.ts and ../dialogues/index.ts (U52's pattern, D-105, D-109; U54's and U55's companion files are
// the model, D-112, D-113). U56.
//
// Text: `name` and the first stage's journal are STORY's (tag `story`); the later journals are written (tag `written`,
// listed in the U56 reply); `description` is the giver's ask in one sentence. `q_lantern_in_the_reeds` is open in Loop 1
// (D-067.17, STORY "L1 open"); the other five are Loop 2+ by the Before (`echo_before_route` is granted on entering it) or
// the Echo and loyalty they need.
//
// Loyalty (DESIGN §12.5 "personal quest stage completed +5", U55's reading): every stage pays +5 to its companion — a
// stage that is left in `onExit`, an outcome stage in `onEnter` — and a `loyalty` effect changes a recruited companion
// only, so the stage Mireya's first quest passes before she joins (STORY: "recruitable after stage 1") and the errand's
// stages before Caelum joins pay nothing. The aligned +3 / against −10 of STORY §7.5–§7.6's loyalty beats ride on the
// choices (../dialogues/companions_u56.ts, `loyaltyFor`).
//
// Thresholds: Mireya's second quest asks loyalty ≥ 25 and her third ≥ 50, Caelum's third ≥ 50 — STORY's own prereqs and
// DESIGN §12.5's tiers (D-113). `q_a_boy_from_a_doomed_city` carries no loyalty gate: STORY gives it none, and the Mending
// (STORY §10.2: the pin set, Caelum crosses, in one loop) would be unreachable behind one — Caelum is remade each loop
// (D-067.4) and the errand pays him 5 at most before he joins. The arithmetic both arcs leave for the balance unit is in
// the U56 reply (without the bond Echo neither companion reaches 25 in a loop).
//
// Readings (listed in the U56 reply):
//   - q_lantern_in_the_reeds: "bitterroot" has no item of its own; it is `item_antidote_root` ("a bitter knuckle of root",
//     WORLD §9: Lanternreed's ground and Fennick's stall). Stage 1 is the ask and the elders' telling, passed through in
//     the offer scene (`echo_glowlands_leak` there, STORY §12 "stage 1"); with the Echo the quest opens at the gathering
//     (`shortcuts`). The tending is a scene at Lanternreed with the moss and the root carried. `flag_lanternreed_trusts`
//     (STORY, also `q_the_drowned_lantern`'s) is set on completion.
//   - q_what_the_light_takes: "the Drowned Lantern's route" is the Reed Maze (WORLD §3.12: `loc_sporelight_shallows`),
//     then the Pool; Mireya goes ahead (her NPC `schedule`, the Glowfen's npcs.ts). The Listen at the Pool is her scene:
//     verse VI there, `echo_breathing_pool` at "It's a person".
//   - q_preserve_or_heal: Mireya gives it (STORY "Mireya / Elder Wen"); Wen's refusal is her voice in the choice at the
//     Pool. The dam takes one fragment of either kind (D-052) and the dead one is its own outcome (`dammed_dark`: "the fen
//     goes dark for good" is read through the stage, as the endings read `echo_glowfen_dammed`). "Elder Wen Hostile" has
//     no data form (an NPC's standing is not a state); "Lanternreed Bloom also Hastes" needs a conditional status on the
//     ability (listed as a gap).
//   - q_the_apprentices_errand: offered at the Garret on Last Bell at noon (his schedule puts him there; STORY's "the
//     Plaza or the Garret" — the Plaza's Last Bell noon is pinned to Aulde alone, regions/silverwood_before.test.ts), the
//     crossing of the Plaza is an objective (Last Bell, `watch: 'day'`, D-102), `ev_plaza_spire_yard` tells Aulde's laugh
//     on arrival and the scene at the Yard sings her verse (`echo_litany_verse_5`, idempotent) and recruits him.
//   - q_a_boy_from_a_doomed_city: "if the loop is headed for the Mending" is `q_the_mending` running (U58's quest, a pending
//     reference until it lands); the Breach-door "from the Before side" is the Silver Gate on Last Bell from dusk (the dusk
//     message in his hand, STORY §13); the crossing is `scene_caelum_crossing`; he walks out beside you (no teleport: the
//     door is the Gate's own exit). Stayed, he leaves the party (`dismiss`).
//   - q_his_masters_sin: "in the present" is read through the stage (`crossed` completed this loop; the Echo alone is the
//     profile's, any loop). "Movement II: Caelum answers Masque's question himself" is an answer row on the Tyrant (the
//     Nexus' creatures.ts) and the stage is the communion carried through with him beside you (`flag_tyrant_spared`,
//     U55's reading for Dask); the one thing Veyran says, and his answer, are a talk at the Apex after.
import type { Effect } from '@schema/effect';
import type { QuestInput } from '@schema/quest';
import { FROM_LOOP_2 } from '../dialogues/common';

/** DESIGN §12.5 "personal quest stage completed". */
const STAGE_LOYALTY = 5;
const mireyaStage: Effect[] = [{ loyalty: { companion: 'mireya', delta: STAGE_LOYALTY } }];
const caelumStage: Effect[] = [{ loyalty: { companion: 'caelum', delta: STAGE_LOYALTY } }];

/** WORLD §9: "a bitter knuckle of root" — STORY's bitterroot. */
export const BITTERROOT = 'item_antidote_root';
export const GLOW_MOSS = 'item_glow_moss';

export const quests = [
  // ---- Lantern in the Reeds — Mireya 1 (STORY §11.4; giver Mireya, Lanternreed; Loop 1 open) ----------------------------------
  {
    id: 'q_lantern_in_the_reeds',
    name: 'Lantern in the Reeds',
    description: 'Mireya needs Glow Moss, bitterroot and a pair of steady hands for the sick of Lanternreed.',
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_mireya',
    companionId: 'mireya',
    stages: [
      {
        // scene_mireya_lantern_offer passes through it: the elders say what the light is (`echo_glowlands_leak`)
        id: 'sick',
        tags: ['story'],
        journal: 'Three of Lanternreed are sick with the shining. Mireya needs Glow Moss, bitterroot, and a pair of steady hands.',
        onExit: mireyaStage,
        next: 'gather',
      },
      {
        id: 'gather',
        tags: ['written'],
        journal: 'Three Glow Moss and two bitterroot. The Reed Maze grows both; Fennick sells both. Bring them to Mireya.',
        objectives: [
          { id: 'obj_moss', text: 'Gather three Glow Moss', when: { item: { id: GLOW_MOSS, count: 3 } }, hintLocationId: 'loc_sporelight_shallows' },
          { id: 'obj_root', text: 'Gather two bitterroot (Antidote Root)', when: { item: { id: BITTERROOT, count: 2 } }, hintLocationId: 'loc_sporelight_shallows' },
        ],
        // moss and root already carried move the quest straight on
        advanceWhen: { all: [{ item: { id: GLOW_MOSS, count: 3 } }, { item: { id: BITTERROOT, count: 2 } }] },
        onExit: mireyaStage,
        next: 'tend',
      },
      {
        // scene_mireya_tending: the moss, the root, the child
        id: 'tend',
        tags: ['written'],
        journal: 'Mireya has her hands full and needs yours. Tend the sick with her at Lanternreed.',
        onExit: mireyaStage,
        next: 'tended',
      },
      {
        id: 'tended',
        tags: ['written'],
        journal: "The fever broke. A child's eyes have gone Mireling-green, and she says she can see the stars under the water.",
        onEnter: [...mireyaStage, { setFlag: 'flag_lanternreed_trusts' }],
        outcome: 'complete',
      },
    ],
    // DESIGN §6.2 arc 1: 150 XP; STORY: Fenlight Salve ×3
    rewards: { xp: 150, items: [{ itemId: 'item_fenlight_salve', count: 3 }] },
    // STORY §11.4, §12: with the Echo "she already knows you know what the light is"
    shortcuts: [{ echo: 'echo_glowlands_leak', skipTo: 'gather', text: 'Mireya knows you know what the light is.' }],
  },

  // ---- What the Light Takes — Mireya 2 (STORY §11.4; giver Mireya; the Reed Maze, the Breathing Pool) --------------------------
  {
    id: 'q_what_the_light_takes',
    name: 'What the Light Takes',
    description: 'Mireya is going to the Breathing Pool, where the glow is born, whatever Elder Wen says.',
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_mireya',
    companionId: 'mireya',
    availableWhen: { all: [FROM_LOOP_2, { quest: { id: 'q_lantern_in_the_reeds', status: 'completed' } }, { loyalty: { companion: 'mireya', min: 25 } }] },
    stages: [
      {
        id: 'forbidden',
        tags: ['story'],
        journal: 'The Breathing Pool is where the glow is born. Elder Wen forbids it. Mireya is going anyway.',
        objectives: [{ id: 'obj_maze', text: "Take the lantern-boat's way through the Reed Maze", when: { location: 'loc_sporelight_shallows' }, hintLocationId: 'loc_sporelight_shallows' }],
        onExit: mireyaStage,
        next: 'pool',
      },
      {
        id: 'pool',
        tags: ['written'],
        journal: 'The Maze is behind you. The Pool is below Lanternreed, where the water breathes. Mireya has gone ahead.',
        objectives: [{ id: 'obj_pool', text: 'Reach the Breathing Pool', when: { location: 'loc_breathing_pool' }, hintLocationId: 'loc_breathing_pool' }],
        onExit: mireyaStage,
        next: 'listen',
      },
      {
        // scene_mireya_breathing_pool: Listen; Sallow's verse, breathing; the name
        id: 'listen',
        tags: ['written'],
        journal: 'The Pool inhales for six heartbeats and exhales for six. Stand at the edge with Mireya and listen to it.',
        onExit: mireyaStage,
        next: 'heard',
      },
      { id: 'heard', tags: ['written'], journal: "The glow is a woman's breath, still leaking. Imre Sallow. Mireya has her name now, and does not know what to do with it.", onEnter: mireyaStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 2: 250 XP; `echo_breathing_pool` and verse VI are the Listen's
    rewards: { xp: 250 },
  },

  // ---- Preserve or Heal — Mireya 3 (STORY §11.4; giver Mireya, Wen refusing; the dam at the Pool) ------------------------------
  {
    id: 'q_preserve_or_heal',
    name: 'Preserve or Heal',
    description: 'Dam the leak at the Breathing Pool with a piece of the Heartstone, or let it run.',
    category: 'companion',
    botHint: 'pacifist',
    giverNpcId: 'npc_mireya',
    companionId: 'mireya',
    availableWhen: { all: [{ echo: 'echo_breathing_pool' }, { loyalty: { companion: 'mireya', min: 50 } }] },
    stages: [
      {
        id: 'dam_or_run',
        tags: ['story'],
        journal: 'Dam the leak with a piece of the Heartstone, or let it run. Mireya will stand by either. Elder Wen will not.',
        objectives: [{ id: 'obj_pool', text: 'Go down to the Breathing Pool', when: { location: 'loc_breathing_pool' }, hintLocationId: 'loc_breathing_pool' }],
        onExit: mireyaStage,
        next: 'choose',
      },
      {
        // scene_mireya_preserve_or_heal decides: dam (stable → dammed; dead → dammed_dark) or let run
        id: 'choose',
        tags: ['written'],
        journal: 'Wen sits on her mat and says no. Mireya says it is yours. A Heartstone fragment, stable or dead, would dam it; or let it run.',
        onExit: mireyaStage,
        next: 'dammed',
      },
      { id: 'dammed', tags: ['written'], journal: 'The stable fragment sits in the well and the Pool breathes slower. The glow is fading. Some of the changed will sicken.', onEnter: mireyaStage, outcome: 'complete' },
      { id: 'dammed_dark', tags: ['written'], journal: 'The dead fragment took the light with it. The fen is going dark, and it will not come back.', onEnter: mireyaStage, outcome: 'complete' },
      { id: 'let_run', tags: ['written'], journal: 'You let it run. The fen folk are brightening into something new, and Mireya has not said you chose right.', onEnter: mireyaStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 3: 400 XP; the Glowfen's Echo rides on the choice
    rewards: { xp: 400 },
  },

  // ---- The Apprentice's Errand — Caelum 1 (STORY §11.4; giver Caelum, the Garret, Last Bell at noon) ----------------------------
  {
    id: 'q_the_apprentices_errand',
    name: "The Apprentice's Errand",
    description: "Caelum carries Master Thal's noon message to the Spire Yard; walk with him across the Plaza.",
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_caelum',
    companionId: 'caelum',
    availableWhen: { echo: 'echo_before_route' },
    stages: [
      {
        // scene_caelum_errand_offer passes through it; a generic Accept passes through it too (D-146 ruling 2, U81b2)
        id: 'errand',
        tags: ['story'],
        advanceWhen: { quest: { id: 'q_the_apprentices_errand', status: 'active' } },
        journal: "Caelum carries Master Thal's noon message to the Spire Yard. Walk with him.",
        onExit: caelumStage,
        next: 'cross',
      },
      {
        id: 'cross',
        tags: ['written'],
        journal: 'Cross the Plaza of Bells at noon on Last Bell to the east terrace, where Aulde tunes the Spires.',
        objectives: [{ id: 'obj_yard', text: 'Cross the Plaza to the Spire Yard at noon on Last Bell', when: { all: [{ location: 'loc_plaza_of_bells' }, { beforeDay: 3 }, { watch: 'day' }] }, hintLocationId: 'loc_plaza_of_bells' }],
        onExit: caelumStage,
        next: 'spire_yard',
      },
      {
        // scene_caelum_spire_yard: Aulde has read it; her verse; he joins
        id: 'spire_yard',
        tags: ['written'],
        journal: 'Aulde read it and laughed. Begin at the ninth bell. Stay with Caelum on the terrace; she is singing.',
        onExit: caelumStage,
        next: 'joined',
      },
      { id: 'joined', tags: ['written'], journal: 'The Spire has her verse and so do you. Caelum walks with you until the dusk message calls him.', onEnter: caelumStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 1: 150 XP; verse V is the Yard's
    rewards: { xp: 150 },
  },

  // ---- A Boy from a Doomed City — Caelum 2 (STORY §11.4, §9.6, §13; giver Caelum after the errand; the Breach-door) ----------
  {
    id: 'q_a_boy_from_a_doomed_city',
    name: 'A Boy from a Doomed City',
    description: 'Caelum has asked what you know. Show him the present through the Breach-door and let him choose.',
    category: 'companion',
    botHint: 'explorer',
    giverNpcId: 'npc_caelum',
    companionId: 'caelum',
    // STORY: the pin is set before he crosses when the loop is headed for the Mending (U58's quest), otherwise nothing
    availableWhen: {
      all: [{ quest: { id: 'q_the_apprentices_errand', status: 'completed' } }, { any: [{ not: { quest: { id: 'q_the_mending' } } }, { flag: 'flag_cradle_pin_anchored' }] }],
    },
    stages: [
      {
        // scene_caelum_boy_offer passes through it; a generic Accept passes through it too (D-146 ruling 2, U81b2)
        id: 'asked',
        tags: ['story'],
        advanceWhen: { quest: { id: 'q_a_boy_from_a_doomed_city', status: 'active' } },
        journal: 'Caelum remembers you between resets. He has asked what you know. Decide what to show him.',
        onExit: caelumStage,
        next: 'door',
      },
      {
        id: 'door',
        tags: ['written'],
        journal: 'On Last Bell, once the dusk message is in his hand, bring Caelum to the Silver Gate and open the Breach-door from this side.',
        objectives: [
          {
            id: 'obj_gate',
            text: 'Stand at the Silver Gate with Caelum on Last Bell, after dusk',
            when: { all: [{ location: 'loc_silver_gate' }, { beforeDay: 3 }, { any: [{ watch: 'dusk' }, { watch: 'night' }] }, { companion: { id: 'caelum' } }] },
            hintLocationId: 'loc_silver_gate',
          },
        ],
        onExit: caelumStage,
        next: 'glimpse',
      },
      {
        // scene_caelum_crossing: one glimpse of the Shattered Library; he chooses
        id: 'glimpse',
        tags: ['written'],
        journal: 'The door is open on the far side of five hundred years. Let him look once, and let him choose.',
        onExit: caelumStage,
        next: 'crossed',
      },
      { id: 'crossed', tags: ['written'], journal: 'Caelum came through beside you with the dusk message still in his hand. Nobody delivered it. Nobody ever did.', onEnter: caelumStage, outcome: 'complete' },
      { id: 'stayed', tags: ['written'], journal: 'He stayed. It is his city, and he thanked you for asking. The cradle-pin, if the Mending needs it, is yours to set.', onEnter: caelumStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 2: 250 XP; his Echo rides on the choice
    rewards: { xp: 250 },
  },

  // ---- His Masters' Sin — Caelum 3 (STORY §11.4; giver Caelum in the present; the Apex, in communion) ---------------------------
  {
    id: 'q_his_masters_sin',
    name: "His Masters' Sin",
    description: 'Caelum wants to speak to Master Thal at the Apex, in communion. Let him.',
    category: 'companion',
    botHint: 'pacifist',
    giverNpcId: 'npc_caelum',
    companionId: 'caelum',
    availableWhen: {
      all: [{ echo: 'echo_caelum_unanchored' }, { quest: { id: 'q_a_boy_from_a_doomed_city', stage: 'crossed', status: 'completed' } }, { loyalty: { companion: 'caelum', min: 50 } }],
    },
    stages: [
      {
        id: 'let_him',
        tags: ['story'],
        journal: 'Caelum wants to speak to Master Thal. Let him.',
        objectives: [
          { id: 'obj_communion', text: 'Carry the communion through with Caelum beside you; Movement II is his', when: { flag: 'flag_tyrant_spared' }, hintLocationId: 'loc_temporal_breach_apex' },
          { id: 'obj_caelum', text: 'Caelum at your shoulder when the Nine speak', when: { companion: { id: 'caelum' } }, hintLocationId: 'loc_temporal_breach_apex' },
        ],
        onExit: caelumStage,
        next: 'sorry',
      },
      {
        // scene_caelum_his_masters_sin at the Apex: the one thing Veyran says to him; forgives → forgiven, cannot → cannot
        id: 'sorry',
        tags: ['written'],
        journal: 'The chorus has quieted. Veyran has one thing to say that he will not say to the living, and Caelum is not the living. Stay with him at the Apex.',
        onExit: caelumStage,
        next: 'forgiven',
      },
      { id: 'forgiven', tags: ['written'], journal: 'Caelum forgave him. Master Thal heard it, which is more than the hour has given him in five hundred years.', onEnter: caelumStage, outcome: 'complete' },
      { id: 'cannot', tags: ['written'], journal: 'Caelum could not forgive him, and said so to his face. Veyran accepted it. The Mending, if it comes, will be colder.', onEnter: caelumStage, outcome: 'complete' },
    ],
    // DESIGN §6.2 arc 3: 400 XP; his Echo rides on the choice
    rewards: { xp: 400 },
  },
] satisfies QuestInput[];
