// Typed id aliases (PLAN §4 intro, D-044). Ids are plain strings whose type prefix is part of the id, so content
// literals need no casts and a wrong prefix is a type error wherever an alias is used. Not branded.
// The GameState/Profile/Action shapes of PLAN §4.2–4.5 keep `string` fields (ids arrive from zod-parsed content and
// player input); these aliases are for signatures, content literals and tests that want the stronger check.

export type RegionId = `region_${string}`;
export type LocationId = `loc_${string}`;
export type CreatureId = `cr_${string}`;
/** All items incl. quest/key/recipe/tome; materials may use `mat_`. */
export type ItemId = `item_${string}` | `mat_${string}`;
export type RecipeId = `recipe_${string}`;
export type NpcId = `npc_${string}`;
export type QuestId = `q_${string}`;
export type EchoId = `echo_${string}`;
export type SceneId = `scene_${string}`;
export type CodexId = `codex_${string}`;
export type EndingId = `ending_${string}`;
export type CloserId = 'closer_escape' | 'closer_fall';
export type StatusId = `status_${string}`;
export type AffixId = `affix_${string}`;
export type AttunementId = `att_${string}`;
export type AchievementId = `ach_${string}`;
export type ModifierId = `mod_${string}`;
export type SfxId = `sfx_${string}`;
export type ScreenId = `screen_${string}`;
/** Location event / interactable ids. */
export type EventId = `ev_${string}`;
export type FlagId = `flag_${string}`;
/** Class abilities (`rgr_`, `wiz_`, `elf_`, `wrd_`, `wvr_`), companion abilities and item-granted abilities. */
export type AbilityId =
  | `rgr_${string}`
  | `wiz_${string}`
  | `elf_${string}`
  | `wrd_${string}`
  | `wvr_${string}`
  | `comp_${string}`
  | `itm_${string}`;

// Plain (unprefixed) ids, D-044.
export type ClassId = 'ranger' | 'wizard' | 'elf' | 'ironclad_warden' | 'shadow_weaver';
export type CompanionId = 'ilyra' | 'brak' | 'nyx' | 'dask' | 'mireya' | 'caelum';

/** A run outcome: an ending or one of the two closers (PLAN §4.2 `EndingPending.outcome`). */
export type OutcomeId = CloserId | EndingId;
/** `closer_fall` reasons (D-066 #7, D-067.14). */
export type CloserReason = 'death' | 'expiry' | 'rejected' | 'released';
