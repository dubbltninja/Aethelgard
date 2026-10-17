// The Glowfen — the NPCs whose home is in the region (WORLD §4 rows: ids, placement, roles, descriptions and sample lines; names and
// roles are STORY's, D-062): Mireya (the companion anchor) and Old Fennick at Lanternreed, Elder Tam at Lanternreed, Elder Wen at
// the Breathing Pool (she "sits with the elders at loc_lanternreed", so Lanternreed's block lists her too: locations.ts). None is a
// legacy character, so there is no `legacyName`; the descriptions are WORLD's §4 cells made into sentences (the Ruins' and the
// Veil's reading) and the barks are WORLD's sample lines, markdown emphasis dropped as in the bestiary text (Mireya's "Sit *down*").
// BIBLE gives Mireya only "~30s" and no age for the others, so none is set. `companionId` is the handshake with
// shared/companions.ts (D-088: `npcId: 'npc_mireya'` ↔ `companionId: 'mireya'`); she gathers on the Glowlands' edge as flavor
// (WORLD §3.5), the engine's placement, not a second record. Fennick's `merchantId` is the key of his stock (WORLD §9; the
// merchant record is U50's, a pending reference until then). Wen cleanses Corruption: the Breathing Pool's rest and events
// (locations.ts). Scenes, quests and dialogue are the later units'.
import type { NpcInput } from '@schema/npc';

export const npcs = [
  {
    id: 'npc_mireya',
    name: 'Mireya of Lanternreed',
    description: 'A herbalist with light under the skin of her own wrists.',
    factionId: 'neutral', // WORLD §4: faction "— (Glowfen folk)"
    homeLocationId: 'loc_lanternreed',
    portrait: { sigil: 'mireya' },
    // companion anchor `mireya`; quest giver (the Mireya arc) (WORLD §4)
    roles: ['companion', 'questgiver'],
    companionId: 'mireya',
    barks: [
      { text: "Sit down. Feverfew, then water, then you tell me where you've been." },
      { text: 'Rain by dusk. Bring the moss in before it drinks the light.' },
    ],
    tags: ['companion_anchor', 'glowfen'],
  },
  {
    id: 'npc_elder_wen',
    name: 'Elder Wen Thistlecourt',
    description: 'The Glowfen elder at the reed mat by the Pool. She would keep the glow, whatever it costs.',
    factionId: 'neutral', // WORLD §4: faction "— (Glowfen folk)"
    homeLocationId: 'loc_breathing_pool',
    portrait: { sigil: 'elder_wen' },
    // quest giver (q_the_drowned_lantern); cleanses Corruption (D-017, D-064) (WORLD §4)
    roles: ['questgiver', 'healer'],
    barks: [{ text: 'No.' }, { text: 'Hands in the light. Six breaths. Then go.' }],
    tags: ['questgiver', 'healer', 'glowfen', 'elder'],
  },
  {
    id: 'npc_elder_tam',
    name: 'Elder Tam',
    description: 'The eldest of Lanternreed, so far into the glow that the tree answers for him.',
    factionId: 'neutral', // WORLD §4: faction "— (Glowfen folk)"
    homeLocationId: 'loc_lanternreed',
    portrait: { sigil: 'elder_tam' },
    // flavor: the Mangrove speaks in his voice (`ev_mangrove_answer`) (WORLD §4)
    roles: ['lore'],
    barks: [{ text: 'Not yet.' }, { text: 'The pool breathes. We breathe with it. Lately it breathes for us.' }],
    tags: ['lore', 'glowfen', 'elder'],
  },
  {
    id: 'npc_old_fennick',
    name: 'Old Fennick',
    description: 'The stall-keeper on the stilts, who trades moss for Nomad salt through the Reedmarch baskets.',
    factionId: 'neutral', // WORLD §4: faction "— (Glowfen folk)"
    homeLocationId: 'loc_lanternreed',
    portrait: { sigil: 'old_fennick' },
    // merchant (DESIGN's `npc_mireya_stall`; WORLD §9 stock)
    roles: ['merchant'],
    merchantId: 'npc_old_fennick',
    barks: [{ text: 'Moss is three a bundle. The salts are dear; the light goes into them.' }, { text: 'Never met a Nomad. Good salt, though.' }],
    tags: ['merchant', 'glowfen'],
  },
] satisfies NpcInput[];
