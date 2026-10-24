// The dialogue tables (PLAN §5.10, §10.4; DESIGN §13.2, §12.7; STORY §13). U52 wrote the first file (legacy.ts), the shared
// helpers (common.ts) and these conventions; the quest units U53–U59 and U62 add one file each here (named as their quest
// file in ../quests/) and one spread in `dialogues` below. A region's `dialogues.ts` (PLAN §10.3) follows the same rules.
//
// Conventions (the quest side is ../quests/index.ts):
//   - One scene per purpose per NPC — the offer, the reminder while it runs (`waiting`), the decision or the report, the line
//     once it is done (`after`), a one-time payoff — each with a narrow `when` and its band from common.ts `SCENE_PRIORITY`.
//     `talk` opens the highest available scene, so a later unit adds an NPC's scenes without touching these, and a higher
//     band wins the next talk (an arc unit's offer sits beside a legacy offer; a decision outranks both).
//   - Ids: STORY §13's key scenes keep theirs (`scene_echo_crystal` …); the others are `scene_<npc>_<quest or topic>[_<purpose>]`
//     (`scene_brak_clear_path_report`), listed in the unit's reply. Node and choice ids are plain, unique in their scene/node;
//     a legacy yes/no is `yes`/`no`.
//   - Every NPC scene's `when` starts with `NOT_IN_HORDE` (legacy: in the Horde every NPC says only "Go, Wayfinder! The horde
//     approaches!"; those lines and the portal are U62's). A scene with no `npcId` is opened only by `startDialogue`.
//   - Text: a node's speaker is an NPC id or `narrator`; the text carries no "Name:" prefix. Legacy narration and prompts are
//     `narrator`. A legacy yes/no prompt is the prompt line without "(yes/no):" on a narrator node with the two choices "Yes." /
//     "No." (DESIGN §13.2); the legacy refusal line follows "No.". An NPC's legacy greeting (aethelgard_data.py "dialogue")
//     opens their offer scenes, as legacy `talk_to_npc` printed it first; reminders and reports open on their own line (STORY
//     §13's scene_echo_crystal). Two lines of one speaker may share a node (a Loop 2+ variant appends STORY's new sentence).
//   - Every node is tagged with where its text comes from: `legacy` (verbatim from legacy/*.py), `story` (verbatim from STORY,
//     markdown emphasis dropped) or `written` (yours: short, in the BIBLE's voice, listed in the reply). Tests read the first two
//     against their sources at test time.
//   - Loop 1 is the legacy game (D-067.17): a Loop 2+ line or choice reads `FROM_LOOP_2`; an Echo line is `echoLocked(echo, …)`
//     (shown from Loop 2, greyed until the Echo is held, the Echo sigil and hint) — one place to change if the lead rules
//     Echo lines hidden instead of greyed.
//   - Consequences live on the choice that decides them (or the node that pays them when nothing is chosen), consequences
//     first and the quest's `questAdvance` last; rep per DESIGN §11.2, loyalty per DESIGN §12.5 (`loyaltyFor`). A flag is set
//     only when something reads it and the documents name it (`flag_crystal_given`, `flag_shards_refused`); otherwise a
//     decision is read through its quest's stage (`{ quest: { id, stage: 'given' } }`) or the engine's `flag_choice_<scene>_
//     <choice>` (an `oncePerLoop` choice) and `flag_scene_done_<scene>` (C-58).
//   - A line a companion says only when in the party is a `companionReactions` entry ("Name: "…""). The companions are
//     registered (D-111): a scene may `recruit`, and a companion's camp scenes (its record's `campScenes`; no `npcId`, opened
//     by a full rest with it in the party, once a loop each, in descending priority order) earn their +2 from the engine.
//   - A one-time payoff on "the next talk" is its own non-repeatable scene in the `payoff` band (scene_ilyra_crystal_deciphered,
//     the déjà vu lines).
import type { DialogueSceneInput } from '@schema/dialogue';
import { dialogues as companionsU54 } from './companions_u54';
import { dialogues as companionsU55 } from './companions_u55';
import { dialogues as companionsU56 } from './companions_u56';
import { dialogues as factions } from './factions';
import { dialogues as legacy } from './legacy';
import { dialogues as regional } from './regional';

/** Every shared scene. U52: the legacy quests' scenes. U53: the faction chain quests' scenes. U54: Ilyra's and Brak's arcs. U55: Nyx's and Dask's arcs and camps. U56: Mireya's and Caelum's arcs and camps. U57: the regional quests' scenes. */
export const dialogues: readonly DialogueSceneInput[] = [...legacy, ...factions, ...companionsU54, ...companionsU55, ...companionsU56, ...regional];
