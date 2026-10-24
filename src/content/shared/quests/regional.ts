// The six regional quests (STORY §11.1's table, §11.3 the blocks: `q_bell_vault`, `q_bone_road`, `q_lightless_stair`,
// `q_the_drowned_lantern`, `q_high_mark`, `q_the_still_shore`; `q_echoing_heartbeat`, the seventh, is U52's in ./legacy.ts;
// DESIGN §6.2 "regional 200–350", §10.1 the Waystones road, §10.6–10.9 the Threshold, §13.3 `passWatches` "Bell Vault 4";
// BIBLE §7's place names: the Bell Vault is the Bell-Warden's Deep, Hallow's Cairn the Stormgate Cairns, the Lightless Stair
// the Stair of Unmaking, the Hollow Choir the Sanctum of Threads, the Reed Maze the Sporelight Shallows, the High Mark the
// Windward Stair). Their scenes are ../dialogues/regional.ts; the conventions both follow are ./index.ts and
// ../dialogues/index.ts (U52's pattern, D-105, D-109, D-112–D-115).
//
// Text: `name` and the first stage's journal are STORY's (tag `story`); the later journals are written (tag `written`, listed
// in the U57 reply); `description` is the giver's ask, or the place's, in one sentence. Loop 1 opens `q_bell_vault` and
// `q_high_mark` (D-067.17); the other four read `FROM_LOOP_2` (the Still Shore's state is already Loop 3's, D-082).
//
// A regional quest is a place's story, so its hooks live in the place (each a listed edit of the region's locations.ts):
//   - q_bell_vault: the flooded stair's ringing (`ev_stair_bell`, an interact at the Drowned Stair) opens the discovery; the three sunken bells
//     hang in the Warden's well (`ev_deep_bells`, an interact at the Bell-Warden's Deep) and the ringing scene decides. Keeper
//     Dray offers it too (Loop 1 included). The bells rung in Silverwood's order drop the water a level: four watches pass in
//     the dark (`passWatches` 4, D-069.5), the Cistern and the Door of Pages open (`echo_archive_door`), the bells are known
//     (`echo_bell_vault`). A wrong bell wakes the drowned (`enc_bell_vault_archivists`). The Bell-Warden's own toll, and the
//     Cistern Key it surrenders to one who knows the Warden of Waters' name, are the Deep's (`echo_rhune_choice`, U46).
//   - q_bone_road: Hadda's wagons; two cairn-ambushes on the road — the Bone Orchard's Brutes and the Stormgate Cairns'
//     Stalkers (`enc_bone_road_cairn_1`, `_2`, started by the stages as the Day of Teeth's waves are, D-109) — then
//     the ember-bowl inscription at Hallow's Cairn (`ev_hallows_ember_bowl`, an interact): verse IV of the Litany
//     (`echo_litany_verse_4`, STORY §12 "Hallow's Cairn (`q_bone_road`)"), `echo_hallows_ember`, and with Borin's forge-mark
//     in the pack `echo_iron_that_does_not_wish` (the Cairns' own `ev_hallows_cairn` grants it too). Borin hands the mark over
//     at the Emberforge while the quest runs (WORLD §3.7 "handed over by Borin at the Emberforge when `q_bone_road` is
//     accepted"): the optional objective. Hadda pays Ironclad +10, 40 gold, the Salt-Wind Cloak and the waystone order.
//   - q_lightless_stair: the Hollow's curtain opens the discovery from Loop 2 (`ev_hollow_curtain_stair`, an interact); the quest in the
//     journal opens the curtain (WORLD §11.3 `gate_veil_curtain`, U44). "Lanterns are extinguished; Blind applies" is a
//     hazard on the Veil Mouth and the Stair while the quest runs (Blind at a fight's opening), negated by Nyx in the party
//     (her signature) or by `echo_lightless_stair` (the Choir lights the stair thereafter). `Phase` negating it has no data
//     form (a status lives in fights only; listed in the reply). The Sanctum door's bar (Weavers ≥ −9) stays.
//   - q_the_drowned_lantern: the Reed Maze is the Sporelight Shallows; the boat is raised by an interact there
//     (`ev_shallows_lantern_boat`) and relit with one Glow Moss. "Mirelings follow but do not attack a lit party" is the scene's
//     telling (no "lit" state exists, U47). Wen's report sets `flag_lanternreed_trusts` (STORY: Glowfen folk Neutral → friendly).
//   - q_high_mark: the discovery is the Plateau's stair in the wind (`ev_plateau_stair`, an interact; STORY's "the Windward
//     Stair above the Plateau") or Dask at the Pass; the climb is the Stair (its own `ev_stair_breath` grants `echo_high_mark`
//     on arrival, U48a; the quest grants it again on completion for a loop that has it already); "look east" is an interact at the
//     Stair (`ev_stair_look_east`) whose scene shows the Breach's edge. The Talisman's "wind-kin" pass is the Plateau's
//     Sentinel, passive with `echo_high_mark` (DESIGN §10.5, U44); it is not changed here.
//   - q_the_still_shore: automatic on the first Fall — the Still Shore's arrival event starts it (`ev_shore_between`; a
//     `startWhen` cannot tell the Threshold from the Ruins: `location` reads the next loop's start node there, D-082). The
//     Gallery, the Loom and the Far Light each advance it on arrival (`ev_gallery_first_loop`, `ev_loom_one_thread`,
//     `ev_far_light_look_back`; the Threshold fires `enter` events, U34d). "Spend one Resonance" has no condition atom
//     (Attunements owned are not readable), so the Loom stage completes on arrival. Looking back at the water from the Far Light
//     sees the figure (`echo_six_in_the_mass`, STORY §12 "or `q_the_still_shore` (hint)"); either way `echo_threshold` is
//     granted (D-112: U57's). Once per profile (D-067.15: it belongs to the profile); `countsForApex: false`, because the
//     completed quest rides into the next loop's state (the Threshold's quests survive the Far Light) and must not count
//     toward the Heartbeat's two.
import type { EncounterInput } from '@schema/encounter';
import type { QuestInput } from '@schema/quest';
import { FROM_LOOP_2 } from '../dialogues/common';

export const quests = [
  // ---- The Bell Vault — Drowned Reach (STORY §11.3; discovery at the flooded stair, or Keeper Dray; Loop 1 open) -------------
  {
    id: 'q_bell_vault',
    name: 'The Bell Vault',
    description: 'Something rings on the hour under the flooded stair below the Archives.',
    category: 'regional',
    botHint: 'melee',
    giverNpcId: 'npc_ansel_dray',
    factionId: 'remnants',
    availableWhen: { any: [{ echo: 'echo_archive_door' }, { quest: { id: 'q_lost_scroll', status: 'completed' } }] },
    stages: [
      {
        id: 'flooded_stair',
        tags: ['story'],
        journal: 'A flooded stair drops below the Archives. Something rings down there on the hour.',
        objectives: [{ id: 'obj_deep', text: "Follow the ringing to the Bell-Warden's Deep", when: { location: 'loc_bell_wardens_deep' }, hintLocationId: 'loc_bell_wardens_deep' }],
        next: 'ring_bells',
      },
      {
        id: 'ring_bells',
        tags: ['written'],
        journal: "Three sunken bells hang in the Warden's well. Ring them in Silverwood's order; the Plaza fountain wrote it down.",
        // scene_bell_vault_bells (ev_deep_bells) decides: the right order → water_drops
        next: 'water_drops',
      },
      {
        id: 'water_drops',
        tags: ['written'],
        journal: 'The water has dropped a level. The Cistern of Names and the Door of Pages are open, and the drowned are stirring.',
        outcome: 'complete',
      },
    ],
    // DESIGN §6.2 regional 200–350; STORY: the Bell-Vault Key and a Glyphbound Lantern; `echo_bell_vault`, `echo_archive_door`
    rewards: {
      xp: 300,
      items: [{ itemId: 'item_bell_vault_key' }, { itemId: 'item_glyphbound_lantern' }],
      echoes: ['echo_bell_vault', 'echo_archive_door'],
    },
  },

  // ---- The Bone Road — Ashen Steppe (STORY §11.3; giver Hadda Ironvow at Hearthring, Loop 2+) ---------------------------------
  {
    id: 'q_bone_road',
    name: 'The Bone Road',
    description: 'Hadda Ironvow asks you to ride ahead of her wagons and clear the cairns on the Bone Road.',
    category: 'regional',
    botHint: 'melee',
    giverNpcId: 'npc_hadda_ironvow',
    factionId: 'ironclad',
    availableWhen: FROM_LOOP_2,
    stages: [
      {
        id: 'ride_ahead',
        tags: ['story'],
        journal: "Hadda's wagons must cross the Bone Road before the salt-wind. Ride ahead and clear the cairns.",
        objectives: [
          { id: 'obj_orchard', text: 'Ride to the Bone Orchard, where the road enters the stone herds', when: { location: 'loc_bone_orchard' }, hintLocationId: 'loc_bone_orchard' },
          // WORLD §3.7: Borin hands the mark over at the Emberforge while the quest runs (scene_borin_forge_mark)
          { id: 'obj_forge_mark', text: "Carry Borin's Forge-Mark, to show the Cairn who sent you", when: { item: { id: 'item_borins_forge_mark' } }, optional: true, hintLocationId: 'loc_emberforge' },
        ],
        next: 'first_cairn',
      },
      {
        // the first ambush, at the Orchard's cairn (the stage starts it, as the Day of Teeth's waves; D-109)
        id: 'first_cairn',
        tags: ['written'],
        journal: 'Brutes have come down off the Peaks and made a lair of the cairn in the Bone Orchard. Clear them.',
        onEnter: [{ startCombat: 'enc_bone_road_cairn_1' }],
        objectives: [{ id: 'obj_brutes', text: 'Clear the Brutes from the Bone Orchard', when: { killed: { id: 'cr_wildling_brute', count: 2, sinceStage: true } }, hintLocationId: 'loc_bone_orchard' }],
        next: 'storm_cairn',
      },
      {
        id: 'storm_cairn',
        tags: ['written'],
        journal: 'One cairn is left: the Stormgate Cairns north of Hearthring, where the road turns for the Pan. Something waits between the spikes.',
        objectives: [{ id: 'obj_cairns', text: 'Ride to the Stormgate Cairns', when: { location: 'loc_stormgate_cairns' }, hintLocationId: 'loc_stormgate_cairns' }],
        next: 'second_cairn',
      },
      {
        id: 'second_cairn',
        tags: ['written'],
        journal: 'Stalkers from the Voidscar have found the Stormgate Cairns. Nothing from the Hollow may hold the road.',
        onEnter: [{ startCombat: 'enc_bone_road_cairn_2' }],
        objectives: [{ id: 'obj_stalkers', text: 'Clear the Stalkers from the Stormgate Cairns', when: { killed: { id: 'cr_void_touched_stalker', count: 2, sinceStage: true } }, hintLocationId: 'loc_stormgate_cairns' }],
        next: 'read_inscription',
      },
      {
        id: 'read_inscription',
        tags: ['written'],
        journal: "The road is clear. Hallow's Cairn stands apart among the Stormgate Cairns; read the ember-bowl inscription.",
        // scene_hallows_cairn_inscription (ev_hallows_ember_bowl) → return
        next: 'return',
      },
      {
        id: 'return',
        tags: ['written'],
        journal: 'Tell Hadda at Hearthring that the Bone Road is clear. She will give you the waystones.',
        // scene_hadda_bone_road_report → done
        next: 'done',
      },
      { id: 'done', tags: ['written'], journal: 'The wagons roll before the salt-wind. You know the waystone order: the short road across the Steppe is yours.', outcome: 'complete' },
    ],
    // DESIGN §6.2 regional; STORY: Ironclad +10, 40 gold, the Salt-Wind Cloak, `echo_steppe_waystones` (DESIGN §10.1's road)
    rewards: {
      xp: 300,
      gold: 40,
      items: [{ itemId: 'item_salt_wind_cloak' }],
      rep: [{ faction: 'ironclad', delta: 10 }],
      echoes: ['echo_steppe_waystones'],
    },
  },

  // ---- The Lightless Stair — the Veil (STORY §11.3; discovery at the Hollow's curtain, Loop 2+) ---------------------------------
  {
    id: 'q_lightless_stair',
    name: 'The Lightless Stair',
    description: 'A stair goes down from the Hollow into the Veil, and nothing lit survives it.',
    category: 'regional',
    botHint: 'explorer',
    factionId: 'weavers',
    availableWhen: FROM_LOOP_2,
    stages: [
      {
        id: 'descend',
        tags: ['story'],
        journal: 'A stair goes down from the Hollow into the Veil. Nothing lit survives it.',
        objectives: [{ id: 'obj_stair', text: 'Go down to the Stair of Unmaking without a light', when: { location: 'loc_stair_of_unmaking' }, hintLocationId: 'loc_stair_of_unmaking' }],
        next: 'halfway',
      },
      {
        id: 'halfway',
        tags: ['written'],
        journal: 'Halfway down you cannot see your feet. Keep one hand on the thread. The Choir is at the bottom.',
        objectives: [{ id: 'obj_choir', text: 'Reach the Hollow Choir', when: { location: 'loc_sanctum_of_threads' }, hintLocationId: 'loc_sanctum_of_threads' }],
        next: 'choir',
      },
      {
        id: 'choir',
        tags: ['written'],
        journal: 'You came down the Lightless Stair with no light and are still whole. The Choir will keep it lit for you now.',
        // STORY: `echo_lightless_stair` (the stair is lit for you by the Choir thereafter)
        onEnter: [{ grantEcho: 'echo_lightless_stair' }],
        outcome: 'complete',
      },
    ],
    // STORY: tier XP only
    rewards: { xp: 250 },
  },

  // ---- The Drowned Lantern — the Glowfen (STORY §11.3; giver Elder Wen Thistlecourt, Loop 2+) -----------------------------------
  {
    id: 'q_the_drowned_lantern',
    name: 'The Drowned Lantern',
    description: "Elder Wen asks you to raise Lanternreed's lantern-boat from the Reed Maze and light it again.",
    category: 'regional',
    botHint: 'explorer',
    giverNpcId: 'npc_elder_wen',
    availableWhen: FROM_LOOP_2,
    stages: [
      {
        id: 'reed_maze',
        tags: ['story'],
        journal: "Lanternreed's lantern-boat sank in the Reed Maze. Without it the village cannot find the Breathing Pool at night.",
        objectives: [{ id: 'obj_maze', text: 'Follow the glow pulses into the Sporelight Shallows', when: { location: 'loc_sporelight_shallows' }, hintLocationId: 'loc_sporelight_shallows' }],
        next: 'raise_boat',
      },
      {
        id: 'raise_boat',
        tags: ['written'],
        journal: 'The boat is under the mud where the pulses stop. Raise it, and relight the Lantern of Lanternreed with Glow Moss.',
        // scene_lantern_boat (ev_shallows_lantern_boat) → return
        next: 'return',
      },
      {
        id: 'return',
        tags: ['written'],
        journal: 'The lantern is lit. Tell Elder Wen the village can find the Pool at night again.',
        // scene_wen_drowned_lantern_report → done
        next: 'done',
      },
      { id: 'done', tags: ['written'], journal: 'The lantern-boat rides at Lanternreed again. The fen folk have stopped watching your hands.', outcome: 'complete' },
    ],
    // DESIGN §6.2 regional; STORY: Stilt-walker's Boots; the flag rides on Wen's report
    rewards: { xp: 250, items: [{ itemId: 'item_stiltwalkers_boots' }] },
  },

  // ---- The High Mark — Skyreach (STORY §11.3; discovery at the Plateau's stair, or Dask; Loop 1 open) ---------------------------
  {
    id: 'q_high_mark',
    name: 'The High Mark',
    description: 'The markers above the Plateau point up a stair cut into the wind, to where the sky can be seen from its edge.',
    category: 'regional',
    botHint: 'explorer',
    giverNpcId: 'npc_dask',
    stages: [
      {
        id: 'markers',
        tags: ['story'],
        journal: 'Above the plateau the markers point up. The Nomads say the sky can be seen from its edge.',
        objectives: [{ id: 'obj_climb', text: 'Climb the Windward Stair', when: { location: 'loc_windward_stair' }, hintLocationId: 'loc_windward_stair' }],
        next: 'look_east',
      },
      {
        id: 'look_east',
        tags: ['written'],
        journal: 'You are on the Windward Stair, the High Mark. Look east.',
        // scene_high_mark_look_east (ev_stair_look_east) → seen
        next: 'seen',
      },
      { id: 'seen', tags: ['written'], journal: "You have seen the Breach's edge from the High Mark: a line in the sky, creeping. The stair knows your weight now.", outcome: 'complete' },
    ],
    // DESIGN §6.2 regional; STORY: the Sky-Whisper Cloak; `echo_breach_clock` (if not already), `echo_high_mark`
    rewards: { xp: 250, items: [{ itemId: 'item_sky_whisper_cloak' }], echoes: ['echo_breach_clock', 'echo_high_mark'] },
  },

  // ---- The Still Shore — the Threshold (STORY §11.3; automatic on the first Fall; once per profile, D-067.15) -------------------
  {
    id: 'q_the_still_shore',
    name: 'The Still Shore',
    description: 'Grey water, no horizon, a far light. You are between loops.',
    category: 'regional',
    botHint: 'explorer',
    availableWhen: FROM_LOOP_2,
    repeatablePerLoop: false,
    // the completed quest rides into the next loop's state (newLoop keeps the Threshold's quests): not one of the Heartbeat's two
    countsForApex: false,
    stages: [
      {
        id: 'walk',
        tags: ['story'],
        journal: 'Grey water, no horizon, a far light. You are between loops. Walk the four places.',
        // ev_gallery_first_loop → gallery
        next: 'gallery',
      },
      {
        id: 'gallery',
        tags: ['written'],
        journal: 'Loop 1 hangs in the Gallery, painted and numbered. Go on to the Loom and pull one thread taut.',
        // ev_loom_one_thread → loom
        next: 'loom',
      },
      {
        id: 'loom',
        tags: ['written'],
        journal: 'Spend one Resonance at the Loom if you have it. Then walk to the Far Light.',
        // ev_far_light_look_back opens scene_far_light_look_back → far_light
        next: 'far_light',
      },
      {
        id: 'far_light',
        tags: ['written'],
        journal: 'Before you step through, look back at the water.',
        // the scene decides: look back → done_looked; step through → done
        next: 'done',
      },
      { id: 'done', tags: ['written'], journal: 'You stepped into the light without looking back. The water is behind you, and it will be there next time.', outcome: 'complete' },
      { id: 'done_looked', tags: ['written'], journal: 'You looked back. Far out on the water a figure holds something up with both hands, and it does not move.', outcome: 'complete' },
    ],
    // DESIGN §6.2 regional (the low end: no road, no fight); STORY: 5 Resonance; `echo_threshold`
    rewards: { xp: 200, resonance: 5, echoes: ['echo_threshold'] },
  },
] satisfies QuestInput[];

/** The two cairn-ambushes' intro lines and the drowned's (written; listed in the U57 reply). */
export const AMBUSH_INTROS = [
  'Two Brutes come out from behind the cairn, between the stone bison, ash on their shoulders. They have been living here.',
  'Between the spikes the ash tears open. Two shapes step out of it, eyes like cold stars, and the ash does not take their prints.',
  'The wrong bell. The water shudders, and along the rim of the well the drowned stand up, a finger on the line.',
] as const;

/**
 * q_bone_road's two cairn-ambushes (STORY §11.3 "two cairn-ambushes (Wildling Brutes, Void-Touched Stalkers)"), story gates
 * that hold, each started by its stage on arriving at the cairn (the Day of Teeth's wave form, ../quests/factions.ts); and
 * the drowned a wrong bell wakes in the Bell Vault (STORY "Drowned Archivists stir"), started by the ringing scene and fled
 * like any fight. Table encounters are global ids (PLAN §5.19 rule 6).
 */
export const encounters = [
  {
    id: 'enc_bone_road_cairn_1',
    groups: [{ creatureId: 'cr_wildling_brute', count: 2 }],
    fleeable: false,
    onFlee: 'hold',
    intro: AMBUSH_INTROS[0],
  },
  {
    id: 'enc_bone_road_cairn_2',
    groups: [{ creatureId: 'cr_void_touched_stalker', count: 2 }],
    fleeable: false,
    onFlee: 'hold',
    intro: AMBUSH_INTROS[1],
  },
  {
    id: 'enc_bell_vault_archivists',
    groups: [{ creatureId: 'cr_drowned_archivist', count: 2 }],
    intro: AMBUSH_INTROS[2],
  },
] satisfies EncounterInput[];
