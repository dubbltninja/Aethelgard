// The quest tables (PLAN §5.9, §7.8, §10.4; DESIGN §13.1, §13.4; STORY §11). U52 wrote the first file (legacy.ts) and these
// conventions; the quest units U53–U59 add one file each here and one spread in `quests` below (and their scenes in
// ../dialogues/, the same file name). Regional quests may instead live in a region folder's `quests.ts` (PLAN §10.3).
//
// Files: legacy.ts (U52) · factions.ts (U53) · companions_<a>_<b>.ts (U54–U56) · regional.ts (U57) · loop.ts, endings.ts
// (U58) · class.ts (U59). Each exports `quests` (`satisfies QuestInput[]`), in STORY §11's order.
//
// Conventions (the scene side is ../dialogues/index.ts):
//   - Ids, names and the givers are STORY §11's exactly (D-090: no id is coined unless listed in the unit's reply). Stage ids are
//     plain snake_case, unique in the quest; objective ids are `obj_<thing>`; a decision's outcome stages are named for the
//     outcome (`given`/`kept`, `done_stabilize`). The six legacy quests carry `legacyId` (validator rule 22).
//   - Text: legacy lines verbatim (legacy/*.py is law, D-001); STORY's lines verbatim (markdown emphasis dropped); words neither
//     gives are short, in the BIBLE's voice, and listed in the reply. Every stage is tagged with where its journal comes from:
//     `legacy`, `story` or `written` (tests read the first two against their sources).
//   - `name` and the first stage's journal are STORY's (for a legacy quest: the Python `Quest(…)` name and description).
//     `description` is the giver's ask in one sentence: the legacy offer prompt without "Accept? (yes/no)" where there is one.
//   - `rewards` holds what EVERY completion pays: DESIGN §6.2's tier XP, and the items, rep and Echoes that do not depend on the
//     outcome. What only one outcome pays (DESIGN §11.2's rep per choice, items, Echoes, flags, `statBonus`) rides on the
//     choice that picks it (or, when nothing is chosen, the node that pays it), consequences first and the `questAdvance` that
//     enters the outcome stage last (DESIGN §13.3 ex. 1).
//   - The stage graph: objective stages advance by themselves (give one an `advanceWhen` when its goal may already hold at the
//     start, e.g. the item is carried). A stage a scene ends has no required objective and a plain `next` to its first outcome:
//     it waits (reducers/quests.ts) until a scene's `questAdvance` moves it; validator rule 9 counts `questAdvance` targets as
//     reachable, so the other outcomes need no `next` pointing at them.
//   - Never open a scene from a quest (`startDialogue` in a stage's onEnter/onExit, onFail, or the first stage of a `startWhen`
//     quest): the sweep also runs while a scene is open, and would replace it mid-line. Scenes open by `talk`, a location event
//     or a choice; an auto-started quest announces itself through its `description` and journal (the `questStarted` toast).
//   - Echo shortcuts (D-010) are `shortcuts`: the engine opens the quest at `skipTo` when it starts with the Echo held, however it
//     starts. `skipTo` must come later in `stages` than the stage it skips from (echoes.ts `applyShortcut`).
//   - Loyalty (DESIGN §12.5): ../dialogues/common.ts `loyaltyFor` — +3 to each companion whose value a choice is, −10 to each
//     whose value is another option of the same choice; a personal quest stage completed is +5 (the arc units).
//   - Gates: `availableWhen` for a quest offered after another; `startWhen` for one that starts by itself. Loop 1 opens only the
//     legacy six and D-067.17's four; every other quest's `availableWhen`/`startWhen` reads `{ loop: { min: 2 } }` or an Echo.
//   - No `recruit` until U56 registers the companions (the effect throws on an unknown companion, D-088).
//   - Proof: each quest gets a `pathBot` script in src/sim/scripts/quests.ts (PLAN §7.8) that completes it on the real pack —
//     every outcome a later quest or ending reads — run by `npm run sim -- quest <id>` and tests/unit/sim/questScripts.test.ts.
import type { QuestInput } from '@schema/quest';
import { quests as legacy } from './legacy';

/** Every shared quest, in STORY §11 order. U52: the six legacy quests. */
export const quests: readonly QuestInput[] = [...legacy];
