// Silverwood Ruins — the NPCs whose home is in the Ruins (WORLD §4 rows: ids, placement, descriptions and sample lines;
// names and roles are STORY's, D-062; BIBLE §3.2–3.3 ages). Ilyra's `companionId` is the handshake with
// shared/companions.ts (D-088: `npcId: 'npc_ilyra'` ↔ `companionId: 'ilyra'`); her legacy description is verbatim from
// aethelgard_data.py. Runtime moves (Ilyra to the Library in a Horde, Tamsin to the Library when the Plaza is infected)
// are engine `npcOverrides`, not placement. Barks are WORLD's sample lines; scenes are the dialogue units' (U52–U59).
import type { NpcInput } from '@schema/npc';

export const npcs = [
  {
    id: 'npc_ilyra',
    name: 'Ilyra',
    legacyName: 'Ilyra',
    description: 'A Remnant scholar wrapped in faded robes, eyes bright with purpose.',
    factionId: 'remnants',
    homeLocationId: 'loc_whispering_ruins',
    portrait: { sigil: 'ilyra', accent: 'remnants' },
    roles: ['companion', 'questgiver'],
    companionId: 'ilyra',
    barks: [
      { text: 'The whispers are louder each day, Wayfinder. You hear them too, I think?' },
      { text: 'Ink remembers what hands forget. That is the whole of my faith.' },
    ],
    // U58 (STORY §11.6 E, D-102 schedules): while the Long Archive runs she is at the Depths too, to keep the vigil and set the stone
    schedule: [{ when: { quest: { id: 'q_long_archive', status: 'active' } }, at: ['loc_whispering_ruins', 'loc_heartstone_depths'] }],
    age: 30,
    tags: ['legacy', 'companion_anchor', 'remnants'],
  },
  {
    id: 'npc_tamsin_reed',
    name: 'Scribe Tamsin Reed',
    description: "A Remnant scribe who weighs ink against salt on the fountain's rim.",
    factionId: 'remnants',
    homeLocationId: 'loc_silverwood_plaza',
    portrait: { sigil: 'tamsin_reed', accent: 'remnants' },
    // merchant (DESIGN's `npc_remnant_archivist`, WORLD §9 stock); gives q_class_wizard (STORY §11.8, BIBLE §3.3)
    roles: ['merchant', 'questgiver'],
    merchantId: 'npc_tamsin_reed',
    barks: [
      { text: 'Ink by the dram, salt by the cup. The Keeper sets the rate, not me.' },
      { text: "Year 500. I write it at the top of every page so I don't forget." },
    ],
    tags: ['merchant', 'remnants'],
  },
  {
    id: 'npc_ansel_dray',
    name: 'Keeper Ansel Dray',
    description: "A Remnant Keeper of about seventy. He keeps the Ledger of Wayfinders and has read Pell Ashcombe's notes.",
    factionId: 'remnants',
    homeLocationId: 'loc_shattered_library',
    portrait: { sigil: 'ansel_dray', accent: 'remnants' },
    // quest giver: q_keepers_ledger, q_bell_vault, q_the_keepers_price, q_the_thirtieth_dawn, q_long_archive (WORLD §4)
    roles: ['questgiver', 'keeper', 'lore'],
    barks: [
      { text: 'Seven names. Years 44, 110, 178, 243, 309, 371, 430. I keep a line ruled for the eighth.' },
      { text: 'Ashcombe counted to thirty. I have checked his arithmetic every year since I was twelve.' },
    ],
    age: 70,
    tags: ['keeper', 'remnants'],
  },
] satisfies NpcInput[];
