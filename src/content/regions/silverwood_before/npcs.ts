// Silverwood Before — the NPCs whose home is in the region (WORLD §4 rows, in WORLD's order: ids, placement, descriptions and
// sample lines; names and roles are STORY's, D-062; BIBLE §3.1–3.4 for the Nine and the others, ages). Sixteen: Caelum; all nine
// of the Circle (Veyran, young Nyxaria, Oriel, Korr, Vane, Hallow, Aulde, Sallow, Masque); and the six who were not of the Nine
// (D-063): Bryn Dunn, Anso, Tobrin Vask, Dreyl, Ilsabet Rhune, Hadrek. None is a legacy character, so there is no `legacyName`;
// the descriptions are WORLD's §4 cells made into sentences (the Ruins' reading) and the barks are WORLD's sample lines,
// verbatim.
//
// Each NPC's home is the first location of WORLD's Location cell, and the location lists it (locations.ts). Where WORLD moves
// them by Bell or hour (Caelum to the Plaza on First Bell and the Archive stair at Last Bell's dusk, young Nyxaria to the Plaza
// at night, Tobrin to the Conflux on Second Bell, the Nine to the plinths on Last Bell) a placement has no condition: those
// are the dialogue units' scenes and the engine's (U52–U59), and listed in the U48b reply.
//
// Faction: WORLD's "—" for every one of them (the Circle, the Watch and the city are not reputation tracks): `neutral`. Their
// portraits are `{ sigil }` alone, as Dask's: Caelum's is his companion record's (D-088's handshake, `companionId: 'caelum'`).
// Roles: "flavor" with a beat (an Echo, a codex fragment, a quest attempt, an item they give) is `lore`, as U46 read Ferrin,
// Oma and Ketch; the gate-captain is `keeper` ("gatekeeper"); Anso is the Before's merchant (his stock is WORLD §9's, U50's).
import type { NpcInput } from '@schema/npc';

export const npcs = [
  {
    id: 'npc_caelum',
    name: 'Caelum Vesper',
    description: "Veyran's errand-boy, unanchored by the Breach's first breath. The only one in the Before who remembers you.",
    factionId: 'neutral', // "— (Circle apprentice)"
    homeLocationId: 'loc_apprentices_garret',
    portrait: { sigil: 'caelum' },
    // companion anchor `caelum`; quest giver (Caelum arc: q_the_apprentices_errand, q_a_boy_from_a_doomed_city, q_his_masters_sin)
    roles: ['companion', 'questgiver'],
    companionId: 'caelum',
    barks: [
      { text: 'Master Thal says the Holding is a kindness to the hour. Is it?' },
      { text: 'You were here yesterday. No one else remembers. Why do I?' },
    ],
    age: 16, // "~16" (WORLD §4, BIBLE §3.2)
    tags: ['companion_anchor', 'apprentice'],
  },
  {
    id: 'npc_bryn_dunn',
    name: 'Gate-Captain Bryn Dunn',
    description: 'Gate-captain under Captain Corvin Dreyl. She takes the Wayfinder for a foreign scholar.',
    factionId: 'neutral', // "— (Silverwood Watch)"
    homeLocationId: 'loc_silver_gate',
    portrait: { sigil: 'bryn_dunn' },
    // "flavor; gatekeeper (issues the visitor's pass that keeps `flag_wanted_in_silverwood` off); no quest"
    roles: ['keeper'],
    barks: [
      { text: "Papers. Scholar? From where? No — don't tell me. I'd have to write it down." },
      { text: "Blades sheathed in the Plaza. Captain Dreyl's order, not mine." },
    ],
    tags: ['watch', 'gatekeeper'],
  },
  {
    id: 'npc_bellwright_anso',
    name: 'Anso the Bellwright',
    description: "The bellwright who casts the Plaza's nine bells and sells charms beneath them.",
    factionId: 'neutral', // "— (Silverwood)"
    homeLocationId: 'loc_plaza_of_bells',
    portrait: { sigil: 'bellwright_anso' },
    // merchant: charms, bell-bronze, honeycake (WORLD §4, §9; restocks each Before day, D-083)
    roles: ['merchant'],
    merchantId: 'npc_bellwright_anso',
    barks: [
      { text: 'Bell-charm, scholar? Rung once on First Bell, it keeps the luck all year.' },
      { text: 'The ninth bell is flat. I told them. Nobody listens to a bellwright.' },
    ],
    tags: ['merchant'],
  },
  {
    id: 'npc_veyran_thal',
    name: 'Archmagus Veyran Thal',
    description: 'Leader of the Nine, whole. Kind to apprentices, certain a mind large enough can hold anything.',
    factionId: 'neutral', // "— (Ninefold Circle)"
    homeLocationId: 'loc_ninefold_hall',
    portrait: { sigil: 'veyran_thal' },
    // "flavor; q_stop_the_ritual attempt 1; `ev_hall_veyran` grants `echo_tyrant_name`"; Days 1–2 (Day 3: the Conflux)
    roles: ['lore'],
    barks: [
      { text: 'You are not from the city. You are not from the year.' },
      { text: 'The Holding is a kindness to the hour. We keep it still and look at it. That is all.' },
    ],
    tags: ['ninefold_circle'],
  },
  {
    id: 'npc_nyxaria_vell_before',
    name: 'Nyxaria Vell',
    description: 'Youngest of the Nine, eyes still ordinary. The only one who looks at you twice.',
    factionId: 'neutral', // "— (Ninefold Circle)"
    homeLocationId: 'loc_ninefold_hall',
    portrait: { sigil: 'nyxaria_vell_before' },
    // "flavor; Nyx-arc scenes"; Days 1–2 (nights: the Plaza of Bells). Nyx in the present is `npc_nyx` (the Voidscar's).
    roles: ['lore'],
    barks: [
      { text: "You're from the far side of something. I can see the seam on you." },
      { text: 'There is a dark between one moment and the next. Nobody else wants to talk about it.' },
    ],
    age: 30, // "~30" (WORLD §4, BIBLE §3.1)
    tags: ['ninefold_circle'],
  },
  {
    id: 'npc_oriel_danthe',
    name: 'Oriel Danthe',
    description: "The Circle's archivist, writing the Litany in fair copy in case. She has Ilyra's hands.",
    factionId: 'neutral', // "— (Ninefold Circle)"
    homeLocationId: 'loc_archives_of_danthe',
    portrait: { sigil: 'oriel_danthe' },
    // "flavor; gives `item_litany_page_3`; `ev_archives_oriel` grants `echo_oriel_lineage`"; Days 1–3
    roles: ['lore'],
    barks: [
      { text: 'You have my hands. No. Someone with my hands sent you.' },
      { text: 'Let it be written as it is done. Pass me the blotter.' },
    ],
    tags: ['ninefold_circle'],
  },
  {
    id: 'npc_maelis_korr',
    name: 'Maelis Korr',
    description: 'Author of the Dark Spellbooks. He annotates an uncharred workbook while his students listen.',
    factionId: 'neutral', // "— (Ninefold Circle)"
    homeLocationId: 'loc_scholars_corridor',
    portrait: { sigil: 'maelis_korr' },
    // "flavor (Corruption beats; `echo_korr_marginalia`)"; Days 1–2, lecturing at the clean wall
    roles: ['lore'],
    barks: [
      { text: 'What is read is owed. Read it twice and you owe it twice.' },
      { text: 'Margins are where the honest work is. Mind the ink.' },
    ],
    tags: ['ninefold_circle'],
  },
  {
    id: 'npc_haldric_vane',
    name: 'Haldric Vane',
    description: 'The Warder. He trusts stone over people.',
    factionId: 'neutral', // "— (Ninefold Circle)"
    homeLocationId: 'loc_ninefold_hall',
    portrait: { sigil: 'haldric_vane' },
    // "flavor (`echo_stone_hide_origin` beat)"; Days 1–2, golem sigils on the floor-map
    roles: ['lore'],
    barks: [
      { text: 'Stone does not tire of an order. That is the whole of its virtue.' },
      { text: 'Keep the line and hold the gate. I wrote that for them, not for us.' },
    ],
    tags: ['ninefold_circle'],
  },
  {
    id: 'npc_durn_hallow',
    name: 'Durn Hallow',
    description: 'The Circle\'s smith, fitting the iron cradle. The one who will say "Stop."',
    factionId: 'neutral', // "— (Ninefold Circle)"
    homeLocationId: 'loc_conflux_chamber',
    portrait: { sigil: 'durn_hallow' },
    // "flavor; q_stop_the_ritual attempt 2 (`echo_hallow_said_stop`)"; Days 1–2, at his field-forge by the stair
    roles: ['lore'],
    barks: [
      { text: "Iron that does not wish. That's what I made. Don't ask it to want things." },
      { text: 'Held is not the same as holding. Nobody hears the difference but me.' },
    ],
    tags: ['ninefold_circle', 'smith'],
  },
  {
    id: 'npc_seraphine_aulde',
    name: 'Seraphine Aulde',
    description: 'The Spire-builder. She loves one note above all others.',
    factionId: 'neutral', // "— (Ninefold Circle)"
    homeLocationId: 'loc_outer_walks',
    portrait: { sigil: 'seraphine_aulde' },
    // "flavor (`echo_spire_note` beat)"; Days 1–2, tuning the Spires from the east terrace
    roles: ['lore'],
    barks: [
      { text: 'Listen. East. That is the note. Everything else is tuning.' },
      { text: 'Rise, lines. Not yet. Tomorrow.' },
    ],
    tags: ['ninefold_circle'],
  },
  {
    id: 'npc_imre_sallow',
    name: 'Imre Sallow',
    description: 'Life-mage and gardener. She agreed only if the overflow went to living things.',
    factionId: 'neutral', // "— (Ninefold Circle)"
    homeLocationId: 'loc_cistern_gardens',
    portrait: { sigil: 'imre_sallow' },
    // "flavor (`echo_breathing_pool` beat)"; Days 1–2, the Green Court beds
    roles: ['lore'],
    barks: [
      { text: 'Green takes what stone cannot. I made them promise.' },
      { text: 'Seedlings, not soldiers. Hold this one by the root.' },
    ],
    tags: ['ninefold_circle'],
  },
  {
    id: 'npc_tovren_masque',
    name: 'Tovren Masque',
    description: 'Astronomer. He has read the sky twice, and it said no.',
    factionId: 'neutral', // "— (Ninefold Circle)"
    homeLocationId: 'loc_grand_library',
    portrait: { sigil: 'tovren_masque' },
    // "flavor; q_stop_the_ritual final beat (`echo_ritual_inevitable`)"; on the glass roof, Days 1–3
    roles: ['lore'],
    barks: [
      { text: 'It fails. I have read it twice. I will read it again because he asked.' },
      { text: 'You see it too now. From the far side.' },
    ],
    tags: ['ninefold_circle'],
  },
  {
    id: 'npc_tobrin_vask',
    name: 'Tobrin Vask',
    description: "Haldric Vane's apprentice ward-engineer, who keeps the failsafe's second half.",
    factionId: 'neutral', // "— (Silverwood; not of the Nine, D-063)"
    homeLocationId: 'loc_ninefold_hall',
    portrait: { sigil: 'tobrin_vask' },
    // "flavor; Breach-anchor schematic B"; Day 2 here, and at the Conflux with the ward seal (`echo_vask_seal`)
    roles: ['lore'],
    barks: [
      { text: 'Master Vane says a ward is a promise stone makes for you. I check the promises.' },
      { text: 'Take the seal. If it goes wrong, someone should be able to open the door.' },
    ],
    tags: ['ward_engineer'],
  },
  {
    id: 'npc_corvin_dreyl',
    name: 'Captain Corvin Dreyl',
    description: "Captain of the Silverwood Watch. His pyre-ward, built to Vane's design, will turn outward and burn the Steppe.",
    factionId: 'neutral', // "— (Silverwood Watch; not of the Nine, D-063)"
    homeLocationId: 'loc_plaza_of_bells',
    portrait: { sigil: 'corvin_dreyl' },
    // "flavor; arrests (`flag_wanted_in_silverwood`); trace of `echo_dreyl_brand`"; the Watch post, Days 1–3
    roles: ['lore'],
    barks: [
      { text: 'Blades sheathed in the Plaza. I will not ask twice. I will have you carried.' },
      { text: "The ward rings the city. Nothing crosses it that it doesn't burn." },
    ],
    tags: ['watch'],
  },
  {
    id: 'npc_ilsabet_rhune',
    name: 'Ilsabet Rhune, Warden of Waters',
    description: "She checks every sluice-wheel twice and does not sleep. She will open the cisterns to drown the Conflux's fire.",
    factionId: 'neutral', // "— (Silverwood civic office; not of the Nine, D-063)"
    homeLocationId: 'loc_cistern_gardens',
    portrait: { sigil: 'ilsabet_rhune' },
    // "flavor; gives `item_cistern_key` (with `echo_rhune_choice`)"; Day 2
    roles: ['lore'],
    barks: [
      { text: 'If it fails, I will drown the fire. The city will forgive me or it will not be there to.' },
      { text: 'You will need this where you are going. I will not.' },
    ],
    tags: ['civic', 'warden_of_waters'],
  },
  {
    id: 'npc_hadrek',
    name: 'Hadrek the Clockwright',
    description: "Tovren Masque's orrery-maker.",
    factionId: 'neutral', // "— (Silverwood; not of the Nine, D-063)"
    homeLocationId: 'loc_ninefold_hall',
    portrait: { sigil: 'hadrek' },
    // "flavor; `item_orrery_key` duplicate (with `echo_hadrek_clockwright`)"; Day 1, servicing the floor-map from Masque's chair
    roles: ['lore'],
    barks: [
      { text: 'Every gear in the Nexus orrery is mine. The sky is his. I only make it turn.' },
      { text: "His chair. He's on the roof again. Sit if you like. He won't." },
    ],
    tags: ['clockwright'],
  },
] satisfies NpcInput[];
