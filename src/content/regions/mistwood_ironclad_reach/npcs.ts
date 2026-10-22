// Mistwood & the Ironclad Reach — the NPCs whose home is in the region (WORLD §4 rows: ids, placement, sample lines;
// names and roles are STORY's, D-062; BIBLE ages). The three are legacy characters, so each description is verbatim from
// aethelgard_data.py and `legacyName` is set (validator rule 22). Brak's `companionId` is the handshake with
// shared/companions.ts (D-088: `npcId: 'npc_brak'` ↔ `companionId: 'brak'`). Runtime moves are engine `npcOverrides`, not
// placement: Brak leaves the Camp in the Tyrant-kill Horde when both his quests are done, or waits at Hearthring when
// kept away (horde.ts `brakStand`); Tessaly's caravan at the Camp is her NPC schedule (../ashen_steppe/npcs.ts, D-098).
// Barks are WORLD's sample lines; scenes are the dialogue units' (U52–U59).
import type { NpcInput } from '@schema/npc';

export const npcs = [
  {
    id: 'npc_kaelen_stonehand',
    name: 'Kaelen Stonehand',
    legacyName: 'Kaelen Stonehand',
    description: 'A broad-shouldered trader with weathered hands and a sharper gaze.',
    factionId: 'neutral', // neutral ground (D-014)
    homeLocationId: 'loc_wayfarers_respite',
    portrait: { sigil: 'kaelen_stonehand', accent: 'neutral' },
    // merchant (DESIGN's `npc_kaelen`, WORLD §9 stock); quest giver for q_blood_and_salt, with Brak (WORLD §4)
    roles: ['merchant', 'questgiver'],
    merchantId: 'npc_kaelen_stonehand',
    barks: [
      { text: "Tonic's three. Fair weight. The road east is not." },
      { text: 'My brother? I sell salt, Wayfinder, not news.' },
    ],
    age: 44,
    tags: ['legacy', 'merchant'],
  },
  {
    id: 'npc_brak',
    name: 'Brak',
    legacyName: 'Brak',
    description: 'A scarred Ironclad scout sharpening a chipped axe.',
    factionId: 'ironclad',
    homeLocationId: 'loc_ironclad_camp',
    portrait: { sigil: 'brak', accent: 'ironclad' },
    // quest giver: q_clear_path, q_blighted_outpost and the Brak arc (WORLD §4)
    roles: ['companion', 'questgiver'],
    companionId: 'brak',
    // U54 (WORLD §12.1 `ws_brak_kept_away`; STORY §7.2 outcome A): kept away, he waits at Hearthring for the loop (D-102 schedule)
    schedule: [{ when: { flag: 'flag_brak_kept_away' }, at: ['loc_hearthring'] }],
    barks: [
      { text: 'Peaks first. Then the Outpost. Then we talk.' },
      { text: 'Two golems. One of you. I like the odds less than you do.' },
    ],
    age: 40,
    tags: ['legacy', 'companion_anchor', 'ironclad'],
  },
  {
    id: 'npc_borin_stonefist',
    name: 'Borin Stonefist',
    legacyName: 'Borin Stonefist',
    description: 'A gruff blacksmith with soot-darkened arms and a steady, appraising gaze.',
    factionId: 'ironclad',
    homeLocationId: 'loc_emberforge',
    portrait: { sigil: 'borin_stonefist', accent: 'ironclad' },
    // crafter (the only one, DESIGN §8) and merchant (forge goods); gives the q_the_mending stage (WORLD §4)
    roles: ['smith', 'merchant', 'questgiver'],
    merchantId: 'npc_borin_stonefist',
    barks: [
      { text: 'Speak plain. What do you want tempered?' },
      { text: "The fire's older than us. She doesn't like being asked how old." },
    ],
    age: 55,
    tags: ['legacy', 'merchant', 'smith', 'ironclad'],
  },
] satisfies NpcInput[];
