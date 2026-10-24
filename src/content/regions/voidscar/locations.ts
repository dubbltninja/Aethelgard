// The Voidscar — the two locations (WORLD §3.3 blocks; coordinates WORLD §11.1; edges WORLD §11.2; gates WORLD §11.3; state
// table WORLD §12.1; legacy text legacy/aethelgard_data.py LOCATION_DEFS, verbatim, with WORLD's `+` sentence appended; the
// Chasm's lock line legacy/echoes_of_aethelgard.py `move_player`). Encounter notation and ids are the Ruins'
// (../silverwood_ruins/locations.ts header): `first: X (100%)` a plain group, `return: X (p%)` = `chance: p, respawn:
// 'on_return'`, the wandering pool the region's (region.ts). Legacy event ids take the `ev_` prefix the schema requires.
//
// The Hollow's two groups (WORLD §3.3, §10.4: "two groups; R10-1 rules the Stalkers `scatter`"): group A ×2 and group B ×1 are two
// fixed encounters. The engine fires one fixed group per arrival (reducers/combat.ts `arrivalEncounter`), so A is the first
// visit's fight and B the next arrival's; a flight from A scatters A alone and B stands for the next arrival. Weavers Wary
// or Hostile in Loop 2+, B is the same stalker with a Veil Sentry beside it (WORLD §12.1 `ws_weavers_wary`); the plain B
// waits on `not` that, and a victory in either B scatters the other, so the slot is paid once however the standing moves.
//
// The Weavers-Wary pool (WORLD §10.1): the pool cannot be conditioned, so (as U42's Plaza and U45's Nexus) a pool share is a
// location encounter ahead of the pool roll. At the Hollow the sentry's 40 % of the pool's 20 % return rolls is 8 % per return
// visit (the pool keeps rolling its 20 % after it, as the Plaza's does). At the Chasm WORLD names no pool unless Nyx
// withdraws her protection, so the Chasm is `safe` (no pool) and carries the whole Wary pool as two Wary-gated encounters:
// the sentry at 8 % and the stalker at 12 % of what is left (a second roll of p / (1 − p1), as U43's Rootlings).
//
// WORLD §12.1 `ws_heartstone_exploited`'s "Void-touched +1 level variants" at the Hollow are the location's `levelBonus`
// (U34e, D-098/D-105; the brighter glow is the art patch). Not expressible (listed in the U44 reply): `q_lightless_stair`
// "begins here, at the curtain" (a quest giver is the quest unit's; the gate below already reads it); the Void-chill (region.ts).
// Exits to other regions name their WORLD ids and stay pending until those units land (D-090).
import type { Condition } from '@schema/condition';
import type { HazardInput, LocationInput } from '@schema/location';

/** WORLD §12.1 `ws_weavers_wary`: `{rep:{faction:"weavers",max:-10}}`: Wary is −39..−10, Hostile ≤ −40. */
const WEAVERS_WARY: Condition = { rep: { faction: 'weavers', max: -10 } };
/** WORLD §3.3: "Weavers Wary/Hostile, Loop 2+: cr_veil_sentry ×1 joins group B." */
const SENTRY_JOINS_B: Condition = { all: [{ loop: { min: 2 } }, WEAVERS_WARY] };
/** WORLD §11.3 `gate_veil_curtain`: the Trusted, those who know the hand-sign, or `q_lightless_stair` once in the journal (W12). */
const VEIL_CURTAIN: Condition = { any: [{ rep: { faction: 'weavers', min: 20 } }, { echo: 'echo_weaver_sign' }, { quest: { id: 'q_lightless_stair' } }] };


// U34e (D-094): the Void-chill (WORLD §2.3): standing in the Hollow more than two watches without moving applies Weaken
// for 1 turn at the next combat.
const VOID_CHILL: Omit<HazardInput, 'id'> = {
  on: 'linger',
  watches: 2,
  status: { id: 'status_weaken', duration: 1, to: 'player' },
  text: 'The cold of the Hollow has found its way under your skin.',
};

export const locations = [
  // ---- Chasm of Whispers — the rift, Nyx at the lip, the rope bridge (WORLD §3.3, §11.3 `gate_chasm_bridge`) ------------------
  {
    id: 'loc_chasm_of_whispers',
    regionId: 'region_voidscar',
    name: 'Chasm of Whispers',
    legacyName: 'Chasm of Whispers',
    description:
      'A jagged rift splits the earth, breathing air as cold as the void. Murmurs rise from below, promising power to those who listen. A single rope bridge crosses to the far lip, where the ground turns to glass.',
    exits: [
      { dir: 'west', to: 'loc_silverwood_plaza' },
      // WORLD §11.3 `gate_chasm_bridge` (legacy: Nyx's pact opens the bridge; Loop 2+: you know the way across). "accepted" is
      // "in the journal, accepted or later" (WORLD §3): the schema's `quest` with no stage and no status. The legacy refusal
      // line is echoes_of_aethelgard.py `move_player`.
      {
        dir: 'east',
        to: 'loc_voidscar_hollow',
        when: { any: [{ quest: { id: 'q_void_shards' } }, { echo: 'echo_hollow_path' }] },
        lockedText: 'I should talk with Nyx before going this way.',
      },
    ],
    // WORLD: "none at the lip. return: pool 20% only if Weavers ≤ Wary (Nyx withdraws her protection)": no pool roll (`safe`);
    // the Wary pool (sentry 40 · stalker 60 of the 20 % return rolls) is these two (see the header).
    encounters: [
      {
        id: 'enc_chasm_sentry',
        groups: [{ creatureId: 'cr_veil_sentry' }],
        chance: 0.08,
        when: WEAVERS_WARY,
        once: false,
        respawn: 'on_return',
        intro: 'A Weaver in grey thread has come to the lip. Nyx does not look up.',
      },
      {
        id: 'enc_chasm_stalker',
        groups: [{ creatureId: 'cr_void_touched_stalker' }],
        chance: 0.12 / 0.92,
        when: WEAVERS_WARY,
        once: false,
        respawn: 'on_return',
        intro: 'Something has crossed the bridge without a sound.',
      },
    ],
    safe: true,
    npcs: ['npc_nyx'],
    events: [
      { id: 'ev_chasm_hum', text: 'A low hum rises from the abyss, vibrating with hungry intent.' },
      {
        id: 'ev_chasm_name',
        text: 'The murmurs below say a name. Not yours. Hers.',
        when: { all: [{ loop: { min: 2 } }, { echo: 'echo_nine_voices' }] },
      },
    ],
    // WORLD's particles are "frost glitter falling upward"; motes is the nearest preset (the upward fall is the UI unit's).
    // "Starlight visible even by day" (WORLD §2.3): night.
    art: { template: 'void', horizon: 0.48, silhouettes: ['cliff_lips', 'rope_bridge', 'glass_plain'], particles: 'motes', timeOfDay: 'night' },
    // "a cold camp on the lip; Nyx permits it"
    rest: { kind: 'camp', text: 'You rest at the cold camp on the lip, where Nyx permits it.' },
    levelBand: { min: 4, max: 5 },
    map: { x: 16, y: 0 },
    tags: ['legacy', 'camp', 'companion_anchor'],
  },

  // ---- Voidscar Hollow — the Stalkers, the loose shard, the curtain of dark (WORLD §3.3, §11.3 `gate_veil_curtain`) -----------
  {
    id: 'loc_voidscar_hollow',
    regionId: 'region_voidscar',
    name: 'Voidscar Hollow',
    legacyName: 'Voidscar Hollow',
    description:
      "Beyond the chasm, the land collapses into a hollow of obsidian scree and bruised crystal. Corrupted creatures stalk the dim glow, their outlines fraying into smoke. At the hollow's far edge the scree stops at a curtain of dark that moves when nothing moves it.",
    exits: [
      { dir: 'west', to: 'loc_chasm_of_whispers' },
      { dir: 'east', to: 'loc_veil_mouth', when: VEIL_CURTAIN },
      { dir: 'north', to: 'loc_scar_shelf', when: VEIL_CURTAIN },
    ],
    // "item_void_shard ×1 lies loose in the crystal (first visit; the other shards drop from Stalkers)"
    items: [{ itemId: 'item_void_shard' }],
    // U34e (D-105): "Heartstone exploited: the Hollow's crystal glows brighter (Void-touched +1 level variant encounters)"
    levelBonus: [{ when: { flag: 'flag_heartstone_exploited' }, creatures: ['cr_void_touched_stalker'], levels: 1 }],
    encounters: [
      // first: group A ×2 (100 %), the legacy three's first two (the legacy fight, scatter: WORLD §10.4)
      {
        id: 'enc_hollow_stalkers_a',
        groups: [{ creatureId: 'cr_void_touched_stalker', count: 2 }],
        intro: 'Two shapes pull loose from the scree, eyes like cold stars.',
      },
      // then group B ×1 (100 %): with a sentry beside it in Loop 2+ while the Weavers are Wary or Hostile, else alone
      {
        id: 'enc_hollow_group_b_sentry',
        groups: [{ creatureId: 'cr_void_touched_stalker' }, { creatureId: 'cr_veil_sentry' }],
        when: SENTRY_JOINS_B,
        onVictory: [{ scatter: { location: 'loc_voidscar_hollow' } }],
        intro: 'A Weaver in grey thread stands beside it, counting.',
      },
      {
        id: 'enc_hollow_group_b',
        groups: [{ creatureId: 'cr_void_touched_stalker' }],
        when: { not: SENTRY_JOINS_B },
        onVictory: [{ scatter: { location: 'loc_voidscar_hollow' } }],
        intro: 'A third comes down the slope behind them, unhurried.',
      },
      // return: a Stalker (35 %), then the Wary pool share, then the pool's own 20 %
      {
        id: 'enc_hollow_stalker',
        groups: [{ creatureId: 'cr_void_touched_stalker' }],
        chance: 0.35,
        once: false,
        respawn: 'on_return',
        intro: 'A shape peels off the scree behind you.',
      },
      // Weavers ≤ Wary: the sentry's 40 % of the pool's 20 % return rolls = 8 % per return visit, ahead of the pool roll
      {
        id: 'enc_hollow_pool_sentry',
        groups: [{ creatureId: 'cr_veil_sentry' }],
        chance: 0.08,
        when: WEAVERS_WARY,
        once: false,
        respawn: 'on_return',
        intro: 'A Weaver in grey thread steps out of the dark. She is counting.',
      },
    ],
    events: [
      { id: 'ev_voidscar_thrum', text: 'The air tastes of ash and frost. Something in the hollow hisses your name.' },
      {
        id: 'ev_hollow_curtain',
        text: "The curtain of dark at the hollow's edge has a seam. Two figures in grey thread stand either side of it and do not look at you.",
      },
      // U57 (STORY §11.3 `q_lightless_stair`, "discovery at the Hollow's curtain", Loop 2+): the seam, until the quest is in the
      // journal (an interact, so an arrival's fixed fight still starts); the scene says the line (shared/dialogues/regional.ts)
      {
        id: 'ev_hollow_curtain_stair',
        trigger: 'interact',
        label: 'Go to the seam in the curtain',
        text: 'A stair goes down from the Hollow into the Veil. Nothing lit survives it.',
        once: false,
        when: { all: [{ loop: { min: 2 } }, { not: { quest: { id: 'q_lightless_stair' } } }] },
        effects: [{ startDialogue: 'scene_hollow_curtain_stair' }],
      },
    ],
    // WORLD's particles are "smoke wisps peeling off edges"; ash is the nearest preset. Heartstone exploited: "the Hollow's
    // crystal glows brighter" (WORLD §2.3): a patch of glints, the glow itself the UI unit's.
    art: {
      template: 'void',
      horizon: 0.5,
      silhouettes: ['obsidian_scree', 'leaning_crystals', 'dark_curtain'],
      particles: 'ash',
      timeOfDay: 'night',
      variants: [{ when: { flag: 'flag_heartstone_exploited' }, patch: { particles: 'shards' } }],
    },
    levelBand: { min: 5, max: 7 },
    hazards: [{ id: 'void_chill', ...VOID_CHILL }], // U34e (D-094)
    map: { x: 24, y: 0 },
    tags: ['legacy', 'shards'],
  },
] satisfies LocationInput[];
