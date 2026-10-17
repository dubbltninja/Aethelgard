// The Ashen Steppe — the NPCs whose home is in the region (WORLD §4 rows: ids, placement, descriptions and sample lines;
// names and roles are STORY's, D-062; BIBLE ages). Ferrin stands at the Scorched Gate; Hadda, Oma, Tessaly and Ketch at
// Hearthring. None is a legacy character, so there is no `legacyName`; the descriptions are WORLD's §4 cells made into
// sentences (the Ruins' and the Reach's reading) and the barks are WORLD's sample lines. Tessaly's `merchantId` is the key of
// her stock (WORLD §9; the merchant record is U50's, a pending reference until then); her caravan stall at the Ironclad Camp
// after `flag_hearthring_caravan` is the caravan unit's (U43's note). Roles: Ferrin teaches the trail-signs and Oma and Ketch
// tell (WORLD: "flavor; teller", "flavor (skald …)"), so all three are `lore`. Hadda's age is BIBLE's (~50); WORLD and BIBLE
// give no other. Scenes are the dialogue units' (U52–U59).
import type { NpcInput } from '@schema/npc';

export const npcs = [
  {
    id: 'npc_scout_ferrin',
    name: 'Scout Ferrin',
    description: 'A gate scout at the smaller gate inside the burned one. He keeps a brazier and a horn.',
    factionId: 'ironclad',
    homeLocationId: 'loc_scorched_gate',
    portrait: { sigil: 'scout_ferrin', accent: 'ironclad' },
    // "flavor; teaches the trail-signs (`echo_nomad_signs`, Ironclad ≥ Neutral)" (WORLD §4)
    roles: ['lore'],
    barks: [
      { text: 'Two notes means friend. One means run. Learn it.' },
      { text: 'Grass is grey to the edge of the world. Mind the herd-paths.' },
    ],
    tags: ['gate', 'ironclad'],
  },
  {
    id: 'npc_hadda_ironvow',
    name: 'Hadda Ironvow',
    description: 'Clan-mother and warchief of the Steppe. She wants the Day of Teeth avenged.',
    factionId: 'ironclad',
    homeLocationId: 'loc_hearthring',
    portrait: { sigil: 'hadda_ironvow', accent: 'ironclad' },
    // quest giver: q_bone_road, q_day_of_teeth, q_iron_silence (WORLD §4; STORY's Ring of Wagons)
    roles: ['questgiver'],
    barks: [
      { text: 'Steel sings louder than fear. Sing, then.' },
      { text: 'Twenty held it a day. I have two hundred. Tell me why I wait.' },
    ],
    age: 50,
    tags: ['questgiver', 'ironclad', 'clan_mother'],
  },
  {
    id: 'npc_oma_varr',
    name: 'Oma Varr',
    description: "The Steppe's old teller. She knew the Stonehand brothers as boys.",
    factionId: 'ironclad',
    homeLocationId: 'loc_hearthring',
    portrait: { sigil: 'oma_varr', accent: 'ironclad' },
    // "flavor; teller (`ev_hearthring_fire`, Brak's lineage)" (WORLD §4)
    roles: ['lore'],
    barks: [
      { text: 'That fire was lit from the last ember of the Burned Hall. Sit. You smell of the Breach.' },
      { text: 'Two boys. One kept the name, one kept the road. Both kept the sulk.' },
    ],
    tags: ['teller', 'ironclad'],
  },
  {
    id: 'npc_tessaly_varr',
    name: 'Tessaly Varr',
    description: "Caravan master and quartermaster, and Oma's granddaughter.",
    factionId: 'ironclad',
    homeLocationId: 'loc_hearthring',
    portrait: { sigil: 'tessaly_varr', accent: 'ironclad' },
    // merchant (DESIGN's `npc_ironclad_quartermaster`; WORLD §9 stock)
    roles: ['merchant'],
    merchantId: 'npc_tessaly_varr',
    barks: [
      { text: 'Rivets by the fist, salt by the sack. Coin first.' },
      { text: "The wagons roll at the salt-wind. You're on them or you're not." },
    ],
    tags: ['merchant', 'ironclad', 'caravan'],
  },
  {
    id: 'npc_ketch',
    name: 'Ketch',
    description: 'A skald with a frame drum. He sings the Day of Teeth.',
    factionId: 'ironclad',
    homeLocationId: 'loc_hearthring',
    portrait: { sigil: 'ketch', accent: 'ironclad' },
    // "flavor (skald; Ironclad Telling codex)" (WORLD §4)
    roles: ['lore'],
    barks: [
      { text: 'Twenty stood where the floor was the sky. Count them home with me.' },
      { text: "I know a verse about two brothers. You won't like the end." },
    ],
    tags: ['skald', 'ironclad'],
  },
] satisfies NpcInput[];
