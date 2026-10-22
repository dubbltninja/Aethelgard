// The six companions (DESIGN §12.1 roles, §12.3 stats, §12.4 abilities, §12.5 loyalty, §12.8 Dask; STORY §7 and §11.4 arcs;
// D-013, D-053, D-059, D-066 #12, D-080). Plain ids (D-044); each companion's NPC record is `npc_<name>` with
// `companion: "<id>"` (WORLD §4). Their 24 abilities are in src/content/abilities/companions.ts.
//
// Registered since D-111 (authored by U41, held back by D-088 until the six NPCs existed): a companion record names its NPC,
// its three arc quests and its camp scenes, and every `comp_` ability needs its companion record (validator rule 1). The arc
// quests and camp scenes are pending references (D-090) until their unit lands them: U54 Ilyra and Brak (done), U55 Nyx and
// Dask, U56 Mireya and Caelum.
//
// What the arc units use (the ids below are the contract):
//   npcId         `npc_<id>`: the region unit that authors the NPC uses this id and sets `companionId` back (WORLD §4 ids).
//   arcQuestIds   STORY §11.4's three quests per companion, in arc order (shared/quests/companions_u5<n>.ts).
//   campScenes    `scene_<id>_camp_1…3`, in the order they are offered: STORY names no camp scenes, so these ids are U41's (the
//                 pattern is the companion schema test's `scene_brak_camp_1`; U54 kept them). The arc units author them
//                 (shared/dialogues/companions_u5<n>.ts): no `npcId`, a full rest with the companion in the party opens the best
//                 fresh one (reducers/dialogue.ts), so their priorities descend (3, 2, 1) and they come in order: the first plays
//                 at a rest with the companion, the second from loyalty 25, the third from 50 (DESIGN §12.5, §12.7). A unit that
//                 wants more or fewer edits this list.
// Fields left to their defaults: `stances` (the engine's §4.9 numbers are constants, D-080), `startingLoyalty` 0 (the bond
// Echoes raise it to 25), `banter` (the engine reads none yet). STORY §7's refusals of places (Ilyra: the Veil; Brak: the Hollow
// Choir, Nyx behind him, the Apex after an Exploit) have no form in data: only Dask's rule (`requiresTemporallyUnstable`) keeps a
// companion out of a place; a `refusesWhen` on the record read by `companionAllowedAt` would carry them (the U54 reply lists it).
// The signature cooldown is the record's (the ability row has none); loyalty ≥ 50 shortens it by 1 (DESIGN §12.5, engine).
import type { CompanionInput } from '@schema/companion';

export const companions = [
  {
    id: 'ilyra',
    npcId: 'npc_ilyra',
    name: 'Ilyra',
    role: 'support',
    damageType: 'ley',
    stats: { hp: 80, atk: 6, sp: 10, agi: 7, armor: 1, ward: 3, evasion: 0 },
    perLevel: { hp: 6, atk: 0.5, sp: 1 },
    abilities: ['comp_ilyra_ley_dart', 'comp_ilyra_ward', 'comp_ilyra_mend'],
    signature: { abilityId: 'comp_ilyra_archive_light', cooldown: 4 },
    startingLoyalty: 0,
    deathRule: 'ko',
    arcQuestIds: ['q_voices_in_the_stacks', 'q_the_danthe_line', 'q_the_keepers_price'],
    campScenes: ['scene_ilyra_camp_1', 'scene_ilyra_camp_2', 'scene_ilyra_camp_3'],
    portrait: { sigil: 'ilyra', accent: 'remnants' },
  },
  {
    id: 'brak',
    npcId: 'npc_brak',
    name: 'Brak',
    role: 'bruiser',
    damageType: 'physical',
    stats: { hp: 130, atk: 12, sp: 0, agi: 5, armor: 4, ward: 0, evasion: 0 },
    perLevel: { hp: 10, atk: 1, sp: 0 },
    abilities: ['comp_brak_axe', 'comp_brak_cleave', 'comp_brak_shieldbreak'],
    signature: { abilityId: 'comp_brak_hold_the_line', cooldown: 4 },
    startingLoyalty: 0,
    // DESIGN §12.6: no permadeath except by story: Brak at the Apex when the Tyrant falls and he was not kept away.
    deathRule: 'permadeath_scripted',
    arcQuestIds: ['q_the_scouts_oath', 'q_blood_and_salt', 'q_the_line_he_holds'],
    campScenes: ['scene_brak_camp_1', 'scene_brak_camp_2', 'scene_brak_camp_3'],
    portrait: { sigil: 'brak', accent: 'ironclad' },
  },
  {
    id: 'nyx',
    npcId: 'npc_nyx',
    name: 'Nyx',
    role: 'caster',
    damageType: 'void',
    stats: { hp: 90, atk: 5, sp: 11, agi: 8, armor: 1, ward: 2, evasion: 0 },
    perLevel: { hp: 6, atk: 0.5, sp: 1 },
    abilities: ['comp_nyx_void_needle', 'comp_nyx_hex', 'comp_nyx_drink'],
    signature: { abilityId: 'comp_nyx_unmaking', cooldown: 4 },
    startingLoyalty: 0,
    deathRule: 'ko',
    arcQuestIds: ['q_tears_of_the_breach', 'q_the_dark_between', 'q_what_she_would_undo'],
    campScenes: ['scene_nyx_camp_1', 'scene_nyx_camp_2', 'scene_nyx_camp_3'],
    portrait: { sigil: 'nyx', accent: 'weavers' },
  },
  {
    id: 'dask',
    npcId: 'npc_dask',
    name: 'Dask',
    role: 'skirmisher',
    damageType: 'chrono',
    // The innate +20 evasion is "flickering" (DESIGN §12.3).
    stats: { hp: 70, atk: 6, sp: 10, agi: 12, armor: 0, ward: 2, evasion: 20 },
    perLevel: { hp: 5, atk: 0.5, sp: 1 },
    abilities: ['comp_dask_flicker_strike', 'comp_dask_stall', 'comp_dask_glimpse'],
    signature: { abilityId: 'comp_dask_between_instants', cooldown: 5 },
    startingLoyalty: 0,
    // DESIGN §12.8: no region list; active only where `location.temporallyUnstable || location.infected` (D-059, D-066 #12).
    requiresTemporallyUnstable: true,
    constraintText: 'Dask flickers and cannot follow.',
    deathRule: 'ko',
    arcQuestIds: ['q_the_flickering_man', 'q_seven_marks', 'q_the_last_instant'],
    campScenes: ['scene_dask_camp_1', 'scene_dask_camp_2', 'scene_dask_camp_3'],
    portrait: { sigil: 'dask' },
  },
  {
    id: 'mireya',
    npcId: 'npc_mireya',
    name: 'Mireya',
    role: 'support',
    damageType: 'ley',
    stats: { hp: 95, atk: 6, sp: 9, agi: 6, armor: 2, ward: 2, evasion: 0 },
    perLevel: { hp: 7, atk: 0.5, sp: 1 },
    abilities: ['comp_mireya_glowsalve', 'comp_mireya_spore_cloud', 'comp_mireya_lantern_light'],
    signature: { abilityId: 'comp_mireya_lanternreed_bloom', cooldown: 5 },
    // DESIGN §12.3: immune to Poison.
    statusImmunities: ['status_poison'],
    startingLoyalty: 0,
    deathRule: 'ko',
    arcQuestIds: ['q_lantern_in_the_reeds', 'q_what_the_light_takes', 'q_preserve_or_heal'],
    campScenes: ['scene_mireya_camp_1', 'scene_mireya_camp_2', 'scene_mireya_camp_3'],
    portrait: { sigil: 'mireya' },
  },
  {
    id: 'caelum',
    npcId: 'npc_caelum',
    name: 'Caelum',
    role: 'caster',
    damageType: 'chrono',
    stats: { hp: 75, atk: 5, sp: 11, agi: 8, armor: 1, ward: 3, evasion: 0 },
    perLevel: { hp: 5, atk: 0.5, sp: 1 },
    abilities: ['comp_caelum_chrono_shard', 'comp_caelum_haste', 'comp_caelum_foresight'],
    signature: { abilityId: 'comp_caelum_stutter', cooldown: 4 },
    startingLoyalty: 0,
    deathRule: 'ko',
    arcQuestIds: ['q_the_apprentices_errand', 'q_a_boy_from_a_doomed_city', 'q_his_masters_sin'],
    campScenes: ['scene_caelum_camp_1', 'scene_caelum_camp_2', 'scene_caelum_camp_3'],
    portrait: { sigil: 'caelum' },
  },
] satisfies CompanionInput[];
