// The Voidscar — the NPCs whose home is in the region (WORLD §4 row: id, faction, placement, roles, sample lines; names and roles
// are STORY's, D-062; BIBLE §3.2 age). Nyx is a legacy character, so her description is verbatim from aethelgard_data.py and
// `legacyName` is set (validator rule 22). WORLD's longer description ("Nyxaria Vell … of the Nine, flung forward") is the
// Loop 2+ unmasking (STORY, D-067.13): the player-facing record keeps the legacy line. `companionId` is the handshake with
// shared/companions.ts (D-088: `npcId: 'npc_nyx'` ↔ `companionId: 'nyx'`). Her Loop 2+ scenes at the Sanctum of Threads and
// Where She Fell are the dialogue units' (U52–U59) and the Veil unit's placements, not a second home. Barks are WORLD's
// sample lines, verbatim.
import type { NpcInput } from '@schema/npc';

export const npcs = [
  {
    id: 'npc_nyx',
    name: 'Nyx',
    legacyName: 'Nyx',
    description: 'A shadow-wrapped figure whose eyes burn with quiet starlight.',
    factionId: 'weavers',
    homeLocationId: 'loc_chasm_of_whispers',
    portrait: { sigil: 'nyx', accent: 'weavers' },
    // quest giver: q_void_shards, the Nyx arc, q_weavers_dawn (WORLD §4)
    roles: ['companion', 'questgiver'],
    companionId: 'nyx',
    barks: [
      { text: 'Three shards. The void remembers where it was torn.' },
      { text: 'He is still holding it. Ask what he is holding it against.' },
    ],
    age: 70,
    tags: ['legacy', 'companion_anchor', 'weavers'],
  },
] satisfies NpcInput[];
