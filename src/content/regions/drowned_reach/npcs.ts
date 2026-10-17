// The Drowned Reach — the NPCs whose home is in the region (WORLD §4 rows: ids, placement, descriptions and sample lines;
// names and roles are STORY's, D-062). Both live at Lamplighters' Rest. Neither is a legacy character, so there is no
// `legacyName`; the descriptions are WORLD's §4 cells made into sentences (the Ruins' reading) and the barks are WORLD's
// sample lines. Sedge's `merchantId` is the key of his stock (WORLD §9; the merchant record is U50's, a pending reference
// until then); Pellam is the rest keeper (BIBLE: "Remnants · rest keeper"). Scenes are the dialogue units' (U52–U59).
import type { NpcInput } from '@schema/npc';

export const npcs = [
  {
    id: 'npc_sedge_marrow',
    name: 'Sedge Marrow',
    description: 'A Remnant diver who outfits the lamplighters. He sells to the Weavers too, and says so.',
    factionId: 'remnants',
    homeLocationId: 'loc_lamplighters_rest',
    portrait: { sigil: 'sedge_marrow', accent: 'remnants' },
    // merchant: diver gear, lamp oil, brine draughts; buys drowned vellum (WORLD §4, §9)
    roles: ['merchant'],
    merchantId: 'npc_sedge_marrow',
    barks: [
      { text: 'Vellum from the Hall? Dry it slow or it curls. Four for it.' },
      { text: "The dead don't like the dark either. Buy oil." },
    ],
    tags: ['merchant', 'remnants'],
  },
  {
    id: 'npc_pellam',
    name: 'Pellam',
    description: 'A lamplighter. He keeps the lamps on every ninth step lit and counts the bell.',
    factionId: 'remnants',
    homeLocationId: 'loc_lamplighters_rest',
    portrait: { sigil: 'pellam', accent: 'remnants' },
    // "flavor (rest keeper; Remnant Archive voice)" (WORLD §4)
    roles: ['keeper'],
    barks: [
      { text: 'The bell rang twice last night. It never rings twice.' },
      { text: 'Ninth-step lamp went out at the third watch. Relit. Note the hour.' },
    ],
    tags: ['keeper', 'remnants'],
  },
] satisfies NpcInput[];
