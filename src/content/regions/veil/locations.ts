// The Veil — the eight locations (WORLD §3.8 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates WORLD §11.3; state
// texts WORLD §12.1). New locations: the descriptions are WORLD's, character for character (no `+` sentence, no `legacyName`;
// the one decision reference in Where She Fell's description is dropped). Encounter notation and the ids are the Ruins'
// (../silverwood_ruins/locations.ts header): `first: X (p%)` is `chance: p` (rolls once, on the first visit; a 100 % group
// stays until cleared or scattered), `return: X (p%)` is `chance: p, respawn: 'on_return'`, "or pool 20 %" is the region's
// wandering pool (region.ts) behind it; the boss holds (R10-1). The schema's `once` is per loop, so WORLD's "once" and "once
// per loop" are the same field.
//
// Readings (each repeated where it applies; listed in the U47 reply):
//   - the pool nodes: the Mouth, the Stair, the Shelf and the Gallery are the four nodes WORLD gives "or pool 20 %"; the
//     Sanctum ("none"), the Orchard, the Eye ("forced boss") and Where She Fell ("none (she warded it)") name none and are
//     `safe`, and WORLD §10.3's sweep (1.4 expected return fights: 0.2 + 0.2 + 0.2 + 0.44 + 0.35) counts exactly that;
//   - the Weavers-Wary pool (WORLD §10.1: "Weavers ≤ Wary: sentry 50", against 25 in the plain pool): the pool cannot be
//     conditioned, so (as the Voidscar's Hollow) the sentry's extra 25 weight is a Wary-gated location encounter ahead of the
//     pool roll at the three nodes that roll the pool and are not the Mouth: 25 of the Wary pool's 125 is 20 % of the pool's
//     20 % return rolls, 4 % per return visit, and the pool keeps rolling after it. At the Mouth the Wary and Hostile meet
//     two sentries on every visit (WORLD), which leaves nothing for the pool's share to add;
//   - the Mouth's sentries "(100 %, every visit)" are a standing group, `once: false`, ahead of the first-visit lanterns
//     (the Archives' Archivist form, the Ruins); a flight scatters them for the loop, as every fixed group; carrying
//     `item_veil_sigil` skips them while the Weavers are Wary, not Hostile (WORLD §7: "while carried, cr_veil_sentry encounters
//     at loc_veil_mouth are skipped when Weavers are Wary (not Hostile)"), an `optionalWhen`;
//   - the Sanctum's inn is open "Weavers ≥ −9" (WORLD §10.3): `rest.when` repeats the door's condition, for a Wayfinder who
//     falls to Wary inside; the door itself is WORLD §11.3 `gate_sanctum_door`;
//   - an event whose text or effects change by loop or standing is two events with complementary `when`s, the WORLD id on the
//     one that WORLD's row describes in effect (the spawn, the Loop 1 line) and a coined `_plain` or `_again` id on the other
//     (an event has one text), as the Reach's Names event. D-098 (U34d) added a per-effect condition (`onlyIf`), but the pairs
//     stay: their texts differ, and a `once` event that fired without the condition could not grant on a later visit;
//   - the Eye: the Umbra's own loot (creatures.ts) pays the mirror and the thread for the fight; the same two placed here are
//     the bypass's (Nyx calls the shadow back and the fight is skipped, the Reach's Deep form), so the two never both pay;
//   - Where She Fell: the Litany page and the shardglass are gated as WORLD says ("opens with {any:[rep ≥ 20, the Echo]}";
//     "Weavers Sworn only" is rep ≥ 60). `ev_fell_names` is `q_the_dark_between` stage 2 in STORY: the event carries WORLD's
//     text and its Loop 2+ gate, and the quest advance is the quest unit's (a `questAdvance` needs the stage id that unit mints).
//
// The Unmaking and the Gallery's Blind at an ambush are the places' `hazards` (U34e, D-096; UNMAKING below).
// Not expressible yet (listed in the U47 reply): Nyx's
// permanent stance bonus when she calls the shadow back (the companion unit's), "Weavers Trusted: Veil Sentries are neutral" (a
// Trusted player meets no sentry at the Mouth, which the Wary-gated sentries already say; the pool's sentry at 25 % has no
// standing condition), the Sworn void-forged thread at the Sanctum (the merchant record, U50).
// Exits to other regions name their WORLD ids and stay pending until those units land (D-090); the Voidscar's Hollow already
// names the Mouth and the Shelf.
import type { Condition } from '@schema/condition';
import type { HazardInput, LocationInput } from '@schema/location';

/** WORLD §12.1 `ws_weavers_wary`: `{rep:{faction:"weavers",max:-10}}`: Wary is −39..−10, Hostile ≤ −40. */
const WEAVERS_WARY: Condition = { rep: { faction: 'weavers', max: -10 } };
/** WORLD §7 `item_veil_sigil`: carried, the Mouth's sentries are skipped while the Weavers are Wary (−39..−10), not Hostile (≤ −40). */
const VEIL_SIGIL: Condition = { all: [{ item: { id: 'item_veil_sigil' } }, { rep: { faction: 'weavers', min: -39 } }] };
/** WORLD §11.3 `gate_sanctum_door`: barred to the Wary and Hostile. */
const SANCTUM_OPEN: Condition = { rep: { faction: 'weavers', min: -9 } };
const SANCTUM_LOCKED = 'The thread across the Sanctum door does not part for you.';
/** Trusted is 20..59, Sworn ≥ 60 (DESIGN §11.1, D-014). */
const WEAVERS_TRUSTED: Condition = { rep: { faction: 'weavers', min: 20 } };
const WEAVERS_SWORN: Condition = { rep: { faction: 'weavers', min: 60 } };
/** WORLD §3.8: with Nyx as active companion and `echo_nyx_is_of_the_nine`, she calls the shadow back. */
const NYX_CALLS_IT_BACK: Condition = { all: [{ companion: { id: 'nyx' } }, { echo: 'echo_nyx_is_of_the_nine' }] };
/** WORLD §3.8 `item_litany_page_2`: "opens with {any:[{rep:{faction:"weavers",min:20}},{echo:"echo_nyx_is_of_the_nine"}]}". */
const CASE_OPENS: Condition = { any: [WEAVERS_TRUSTED, { echo: 'echo_nyx_is_of_the_nine' }] };
/** WORLD §3.8 `ev_gallery_reflection`: "Loop 4+ this spawns cr_redundant_wayfinder ×1". */
const LOOP_4: Condition = { loop: { min: 4 } };


// U34e (D-096): WORLD §2.9's hazards. The Unmaking: each watch spent in the Null Orchard or the Eye costs 5 % of max HP
// (never the last point), given back on arriving anywhere it is not; the Weaver's Thread Ring is immune
// (`hazard_immunity`, items/trinkets.ts). The Gallery: Blind on the first turn of any ambush there (the Hollow Lantern
// Focus's Blind immunity keeps it off).
const UNMAKING: Omit<HazardInput, 'id'> = { on: 'watch', hpPctMax: 0.05, restoreOnLeave: true };
const GALLERY_BLIND: Omit<HazardInput, 'id'> = { on: 'ambush', status: { id: 'status_blind', duration: 1, to: 'player' } };
// U57 (STORY §11.3 `q_lightless_stair` stage 2: "Descend without a light source (lanterns are extinguished; Blind applies;
// `Phase` or Nyx's signature negates)"): on the Mouth and the Stair while the quest runs, Blind at a fight's opening, unless
// Nyx is in the party or the Choir already lights the stair (`echo_lightless_stair`). `Phase` is a status that lives in fights
// only, so it has no form here (the U57 reply).
const LIGHTLESS: Omit<HazardInput, 'id'> = {
  on: 'fight',
  when: { all: [{ quest: { id: 'q_lightless_stair', status: 'active' } }, { not: { companion: { id: 'nyx' } } }, { not: { echo: 'echo_lightless_stair' } }] },
  status: { id: 'status_blind', duration: 1, to: 'player' },
  text: 'You came down without a light, and the dark is in your eyes.',
};

export const locations = [
  // ---- The Veil Mouth — the curtain of dark; the two sentries who count you in (WORLD §3.8, §12.1) ---------------------------
  {
    id: 'loc_veil_mouth',
    regionId: 'region_veil',
    name: 'The Veil Mouth',
    description:
      'The curtain of dark parts and closes behind you. There is ground, and it is black glass. There is a sky, and the stars in it are wrong. Two Weavers in grey thread stand at the mouth and count you in.',
    exits: [
      { dir: 'west', to: 'loc_voidscar_hollow' },
      { dir: 'east', to: 'loc_stair_of_unmaking' },
      { dir: 'north', to: 'loc_voidglass_gallery' },
    ],
    encounters: [
      // Weavers Wary/Hostile: Veil Sentries ×2 (100 %, every visit)
      {
        id: 'enc_mouth_sentries',
        groups: [{ creatureId: 'cr_veil_sentry', count: 2 }],
        when: WEAVERS_WARY,
        optionalWhen: VEIL_SIGIL,
        once: false,
        intro: 'The two Weavers at the mouth stop counting. They have a different number for you.',
      },
      // first: Hollow Lanterns ×2 (50 %); return: the pool at 20 %
      {
        id: 'enc_mouth_lanterns',
        groups: [{ creatureId: 'cr_hollow_lantern', count: 2 }],
        chance: 0.5,
        intro: 'Two lanterns drift out of the curtain. Their glass is lit with dark.',
      },
    ],
    // the sentries are set-dressing when neutral (WORLD: "NPCs: none")
    events: [
      { id: 'ev_mouth_count', text: "'Eight,' says one sentry to the other as you pass. You do not ask eight of what.", when: { not: { loop: { min: 2 } } } },
      // WORLD §3.8: "Loop 2+ the line is 'Eight again.'"; §12.1 `ws_loop_2`
      { id: 'ev_mouth_count_again', text: "'Eight again.'", when: { loop: { min: 2 } } },
    ],
    art: { template: 'void', horizon: 0.5, silhouettes: ['parted_curtain_of_dark', 'two_thread_wrapped_figures', 'glass_ground'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 10, max: 10 },
    hazards: [{ id: 'lightless', ...LIGHTLESS }], // U57
    map: { x: 32, y: 0 },
    tags: ['entrance', 'weavers'],
  },

  // ---- Stair of Unmaking — the steps that are each a little less there; the Sanctum door (WORLD §3.8, §11.3) ---------------
  {
    id: 'loc_stair_of_unmaking',
    regionId: 'region_veil',
    name: 'Stair of Unmaking',
    description:
      'Steps cut down into the scar. Each step is a little less there than the one above. Halfway down you cannot see your feet. The Weavers run a thread along the wall for the hand to follow.',
    exits: [
      { dir: 'west', to: 'loc_veil_mouth' },
      // WORLD §11.3 `gate_sanctum_door`: barred to the Wary and Hostile
      { dir: 'east', to: 'loc_sanctum_of_threads', when: SANCTUM_OPEN, lockedText: SANCTUM_LOCKED },
      { dir: 'north', to: 'loc_null_orchard' },
    ],
    items: [{ itemId: 'mat_umbral_thread', count: 2 }],
    encounters: [
      // first: a Null Mouth (60 %)
      {
        id: 'enc_stair_null_mouth',
        groups: [{ creatureId: 'cr_null_mouth' }],
        chance: 0.6,
        intro: 'Halfway down, the wall opens a mouth where the thread ends.',
      },
      // return: the pool at 20 %, whose Weavers-Wary sentry share is this group at 4 % ahead of it (see the header)
      {
        id: 'enc_stair_pool_sentry',
        groups: [{ creatureId: 'cr_veil_sentry' }],
        chance: 0.04,
        when: WEAVERS_WARY,
        once: false,
        respawn: 'on_return',
        intro: 'A Weaver follows the thread down the wall, hand over hand, counting the steps behind you.',
      },
    ],
    events: [{ id: 'ev_stair_thread', text: 'The thread along the wall is warm. Someone is holding the other end.' }],
    art: { template: 'void', horizon: 0.6, silhouettes: ['descending_steps_fading_to_nothing', 'wall_thread'], particles: 'static', timeOfDay: 'timeless' },
    levelBand: { min: 10, max: 11 },
    hazards: [{ id: 'lightless', ...LIGHTLESS }], // U57
    map: { x: 40, y: 0 },
    tags: ['stair', 'weavers'],
  },

  // ---- Sanctum of Threads — the woven hall; the Thread-Mother; the only inn (WORLD §3.8, §9, §10.3) -------------------------
  {
    id: 'loc_sanctum_of_threads',
    regionId: 'region_veil',
    name: 'Sanctum of Threads',
    description:
      'A hall woven, not built. Threads of grey and violet run from wall to wall in thousands and the walls themselves are more thread. Weavers sit in the web and work. At the center an old woman with no eyes holds the one thread that all the others are tied to.',
    exits: [{ dir: 'west', to: 'loc_stair_of_unmaking' }],
    // "item_weavers_thread_ring (gift at Trusted)": Ysmay gives it (npcs.ts)
    items: [{ itemId: 'item_weavers_thread_ring', when: WEAVERS_TRUSTED }],
    // "Encounters: none"
    safe: true,
    // npc_nyx's Loop 2+ scenes here are the dialogue units' (npcs.ts)
    npcs: ['npc_sethe_unlidded', 'npc_ysmay', 'npc_hollis_cade'],
    events: [
      // once per loop, Loop 2+
      {
        id: 'ev_sanctum_thread',
        text: "The Thread-Mother turns her face to you. 'You are knotted,' she says. 'Someone has tied you to the same day eight times.'",
        when: { loop: { min: 2 } },
      },
    ],
    art: { template: 'sanctum', horizon: 0.55, silhouettes: ['radial_threads_converging', 'seated_weavers', 'central_figure'], particles: 'motes', timeOfDay: 'timeless' },
    // the inn: DESIGN §9.5 (full rest 10 gold); "ST inn (Weavers ≥ −9)" (WORLD §10.3)
    rest: { kind: 'inn', cost: 10, when: SANCTUM_OPEN },
    merchantId: 'npc_hollis_cade',
    levelBand: { min: 11, max: 11 },
    map: { x: 48, y: 0 },
    tags: ['inn', 'merchant', 'settlement', 'weavers'],
  },

  // ---- The Scar Shelf — the ledge above the Hollow; the seam (WORLD §3.8) ------------------------------------------------------
  {
    id: 'loc_scar_shelf',
    regionId: 'region_veil',
    name: 'The Scar Shelf',
    description:
      'A ledge above the Hollow where the obsidian has flowed and frozen in sheets. From here you can see down into the Hollow and up into the Veil at once, and they do not meet where they should.',
    exits: [
      { dir: 'south', to: 'loc_voidscar_hollow' },
      { dir: 'east', to: 'loc_voidglass_gallery' },
    ],
    // "item_void_shard ×1 (first visit), mat_breach_glass ×1"
    items: [{ itemId: 'item_void_shard' }, { itemId: 'mat_breach_glass' }],
    encounters: [
      // first: Void-Touched Stalkers ×2 (60 %)
      {
        id: 'enc_shelf_stalkers',
        groups: [{ creatureId: 'cr_void_touched_stalker', count: 2 }],
        onFlee: 'hold', // D-143: a certain drop of a quest item (the Void Shard); never scatters
        chance: 0.6,
        intro: 'Two shapes come over the lip of the ledge, eyes like cold stars.',
      },
      // return: the pool at 20 %, plus the Wary sentry share (see the header)
      {
        id: 'enc_shelf_pool_sentry',
        groups: [{ creatureId: 'cr_veil_sentry' }],
        chance: 0.04,
        when: WEAVERS_WARY,
        once: false,
        respawn: 'on_return',
        intro: 'A Weaver stands on the frozen sheets above you, where the seam is. She is counting.',
      },
    ],
    events: [
      {
        id: 'ev_shelf_seam',
        text: "The Hollow below and the Veil above overlap like two pages held to the light. The seam between them is a woman's height.",
      },
    ],
    art: { template: 'void', horizon: 0.45, silhouettes: ['frozen_obsidian_sheets', 'ledge_edge', 'overlapping_skylines'], particles: 'ash', timeOfDay: 'timeless' },
    levelBand: { min: 10, max: 10 },
    map: { x: 24, y: -2 },
    tags: ['ledge', 'seam'],
  },

  // ---- Voidglass Gallery — the long hall that shows nothing; the Starved Shadow; the reflection (WORLD §3.8, §12.1) -----------
  {
    id: 'loc_voidglass_gallery',
    regionId: 'region_veil',
    name: 'Voidglass Gallery',
    description:
      'A long hall of black glass that shows nothing. Not darkness: nothing. Walk along it and your reflection does not walk with you. The Weavers come here to practise being unseen.',
    exits: [
      { dir: 'west', to: 'loc_scar_shelf' },
      { dir: 'south', to: 'loc_veil_mouth' },
      { dir: 'east', to: 'loc_null_orchard' },
      { dir: 'north', to: 'loc_eye_of_the_scar' },
    ],
    items: [
      { itemId: 'mat_breach_glass', count: 2 },
      { itemId: 'mat_shadow_ash', count: 2 },
    ],
    encounters: [
      // first: a Starved Shadow (70 %)
      {
        id: 'enc_gallery_shadow',
        groups: [{ creatureId: 'cr_starved_shadow' }],
        chance: 0.7,
        intro: 'Your light bends toward the far glass. Something thin and patient leans to meet it.',
      },
      // return: Hollow Lanterns ×2 (30 %), then the Wary sentry share, then the pool at 20 %
      {
        id: 'enc_gallery_lanterns',
        groups: [{ creatureId: 'cr_hollow_lantern', count: 2 }],
        chance: 0.3,
        once: false,
        respawn: 'on_return',
        intro: 'Two lanterns float out of the glass, lit with dark.',
      },
      {
        id: 'enc_gallery_pool_sentry',
        groups: [{ creatureId: 'cr_veil_sentry' }],
        chance: 0.04,
        when: WEAVERS_WARY,
        once: false,
        respawn: 'on_return',
        intro: 'A Weaver steps out of the black glass. You did not see her in it.',
      },
    ],
    events: [
      // once; Loop 4+ this spawns cr_redundant_wayfinder ×1 (WORLD §3.8, §12.1 `ws_loop_4`)
      {
        id: 'ev_gallery_reflection',
        text: 'At the far end of the gallery your reflection is waiting for you. It arrived first.',
        when: LOOP_4,
        effects: [{ spawn: { creature: 'cr_redundant_wayfinder' } }],
      },
      {
        id: 'ev_gallery_reflection_plain',
        text: 'At the far end of the gallery your reflection is waiting for you. It arrived first.',
        when: { not: LOOP_4 },
      },
    ],
    // "particles: none (deliberate)"
    art: { template: 'void', horizon: 0.6, silhouettes: ['long_hall', 'no_reflections', 'far_door'], particles: 'none', timeOfDay: 'timeless' },
    levelBand: { min: 11, max: 12 },
    hazards: [{ id: 'gallery_blind', ...GALLERY_BLIND }], // U34e (D-096)
    map: { x: 32, y: -2 },
    tags: ['gallery', 'elite'],
  },

  // ---- The Null Orchard — the trees cut out of the world; the Null Mouths (WORLD §3.8, §10.4) ---------------------------------
  {
    id: 'loc_null_orchard',
    regionId: 'region_veil',
    name: 'The Null Orchard',
    description:
      'Trees grew here once. What stands now is the shape of each tree cut out of the world: trunk-shaped, branch-shaped absences you can walk around but not through. Fruit-shaped holes hang from them. The Weavers harvest the holes.',
    exits: [
      { dir: 'west', to: 'loc_voidglass_gallery' },
      { dir: 'south', to: 'loc_stair_of_unmaking' },
      { dir: 'north', to: 'loc_where_she_fell' },
    ],
    items: [{ itemId: 'mat_breach_glass' }, { itemId: 'item_void_shard' }],
    encounters: [
      // first: Null Mouths ×2 (100 %; a scatter node, WORLD §10.4)
      {
        id: 'enc_orchard_null_mouths',
        groups: [{ creatureId: 'cr_null_mouth', count: 2 }],
        intro: 'Between two trees that are not there, two mouths with no heads turn toward the sound of your breathing.',
      },
      // return: a Null Mouth (35 %), and no pool (see the header)
      {
        id: 'enc_orchard_null_mouth_return',
        groups: [{ creatureId: 'cr_null_mouth' }],
        chance: 0.35,
        once: false,
        respawn: 'on_return',
        intro: 'A mouth opens in the shape of a branch.',
      },
    ],
    safe: true,
    events: [
      {
        id: 'ev_orchard_fruit',
        text: 'A Weaver picks a hole from a branch and eats it. Afterward there is slightly less of her, and she looks pleased.',
      },
    ],
    art: { template: 'void', horizon: 0.55, silhouettes: ['tree_shaped_cut_outs', 'wrong_stars_through_them'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 12, max: 12 },
    hazards: [{ id: 'unmaking', ...UNMAKING }], // U34e (D-096)
    map: { x: 40, y: -2 },
    tags: ['orchard', 'unmaking'],
  },

  // ---- Eye of the Scar — the shadow no one casts; the regional boss (WORLD §3.8, §6.1, §10.5) -------------------------------
  {
    id: 'loc_eye_of_the_scar',
    regionId: 'region_veil',
    name: 'Eye of the Scar',
    description:
      "The scar's deepest point. A round floor of glass and a round sky of nothing and, between them, a shadow that no one casts. It has her shape. It has been waiting forty years for her to come back for it, and it has stopped being patient.",
    exits: [
      { dir: 'south', to: 'loc_voidglass_gallery' },
      { dir: 'east', to: 'loc_where_she_fell' },
    ],
    // The fight's loot (the mirror, the thread) is the Umbra's (creatures.ts). Placed here: the bypass's share, when Nyx calls the
    // shadow back and the fight is skipped, so nothing is paid twice.
    items: [
      { itemId: 'item_umbral_mirror', when: NYX_CALLS_IT_BACK },
      { itemId: 'mat_umbral_thread', count: 3, when: NYX_CALLS_IT_BACK },
    ],
    encounters: [
      // the forced boss (WORLD §10.5): without Nyx active and `echo_nyx_is_of_the_nine`; with both she calls it back and the
      // encounter is skipped (`optionalWhen`). Bosses hold (R10-1); the lanterns are the Umbra's own adds (creatures.ts).
      {
        id: 'enc_eye_umbra',
        groups: [{ creatureId: 'cr_vells_umbra' }],
        optionalWhen: NYX_CALLS_IT_BACK,
        fleeable: false,
        onFlee: 'hold',
        intro: 'The shadow on the glass unfolds and does not stop unfolding.',
      },
    ],
    safe: true,
    events: [{ id: 'ev_eye_shape', text: "The shadow stands up. It is a woman's. You know the woman." }],
    art: { template: 'void', horizon: 0.5, silhouettes: ['circular_glass_floor', 'single_tall_shadow_with_no_caster'], particles: 'motes', timeOfDay: 'timeless' },
    levelBand: { min: 13, max: 13 },
    hazards: [{ id: 'unmaking', ...UNMAKING }], // U34e (D-096)
    map: { x: 32, y: -4 },
    tags: ['boss', 'regional_boss', 'unmaking'],
  },

  // ---- Where She Fell — the crater; the print; the nine names; Nyx's cell (WORLD §3.8, §12.1; STORY C-37) -------------------
  {
    id: 'loc_where_she_fell',
    regionId: 'region_veil',
    name: 'Where She Fell',
    description:
      "A crater of fused starlight glass, forty paces across, forty years old. In the center, the print of a body that landed from very far away and very long ago, and got up, and crawled toward the Hollow. Around the rim, in a hand you have seen in a Dark Spellbook's margins, notes. On the rim, in her hand, nine names in chalk, eight crossed out; cut into the crater's east wall, a cell with a bed of thread and a lamp.",
    exits: [
      { dir: 'west', to: 'loc_eye_of_the_scar' },
      { dir: 'south', to: 'loc_null_orchard' },
    ],
    items: [
      // "100 %, in a glass case Nyxaria made": the case opens to Trusted Weavers or those who know whose it is
      { itemId: 'item_litany_page_2', when: CASE_OPENS },
      // "void_focus; Weavers Sworn only"
      { itemId: 'item_nyxs_shardglass', when: WEAVERS_SWORN },
    ],
    // "Encounters: none (she warded it)"
    safe: true,
    // npc_nyx's Loop 2+ confrontation scene is the dialogue units' (npcs.ts)
    events: [
      {
        id: 'ev_fell_notes',
        text: "The notes on the rim are dated. The first says: 'Year 460 of the Sundering. It worked. It worked and I am alone.'",
        effects: [{ grantEcho: 'echo_nyx_is_of_the_nine' }],
      },
      {
        id: 'ev_fell_resonance',
        text: 'You put your hand in the print. For a moment you fall for five hundred years. You understand what a Void Shard is.',
        when: WEAVERS_TRUSTED,
        effects: [{ grantEcho: 'echo_void_resonance' }],
      },
      // once, Loop 2+; `q_the_dark_between` stage 2 (the quest unit advances it)
      {
        id: 'ev_fell_names',
        text: 'Nine names in chalk on the rim. Eight are struck through. The ninth is hers, and the line through it stops halfway.',
        when: { loop: { min: 2 } },
      },
    ],
    // "Heartstone exploited: Where She Fell glows" (WORLD §2.9): a patch of glints, the glow itself the UI unit's
    art: {
      template: 'void',
      horizon: 0.5,
      silhouettes: ['crater_rim_with_notes', 'central_body_print', 'glass_glint'],
      particles: 'motes',
      timeOfDay: 'timeless',
      variants: [{ when: { flag: 'flag_heartstone_exploited' }, patch: { particles: 'shards' } }],
    },
    levelBand: { min: 12, max: 13 },
    map: { x: 40, y: -4 },
    tags: ['crater', 'nyx', 'echo_site'],
  },
] satisfies LocationInput[];
