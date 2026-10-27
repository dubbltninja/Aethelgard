// The Veil — the NPCs whose home is in the region (WORLD §4 rows: ids, placement, descriptions and sample lines; names and roles
// are STORY's, D-062). All three live in the Sanctum of Threads (STORY's Hollow Choir). None is a legacy character, so there is
// no `legacyName`; the descriptions are WORLD's §4 cells made into sentences (the Ruins' reading) and the barks are WORLD's
// sample lines. Hollis's `merchantId` is the key of his stock (WORLD §9; the merchant record is U50's, a pending reference until
// then). Sethe and Ysmay give quests (WORLD: "quest giver (q_hollow_choir, q_unlidded_eye)", "quest giver (Veil regional
// errands)"; Ysmay also gives `item_weavers_thread_ring` at Trusted, which is the Sanctum's placed item, locations.ts). BIBLE
// gives no age for any of the three. Nyx's home is the Chasm (the Voidscar's); her Loop 2+ scenes in the Sanctum and at Where She
// Fell are the dialogue units' (U52–U59) and not a second static placement. Scenes are the dialogue units'.
import type { NpcInput } from '@schema/npc';

export const npcs = [
  {
    id: 'npc_sethe_unlidded',
    name: 'Sethe the Unlidded',
    description: 'A Weaver lieutenant who cut away her eyelids to keep watch between moments. She wants to see what Nyx has seen.',
    factionId: 'weavers',
    homeLocationId: 'loc_sanctum_of_threads',
    portrait: { sigil: 'sethe_unlidded', accent: 'weavers' },
    // quest giver: q_hollow_choir, q_unlidded_eye (WORLD §4)
    roles: ['questgiver'],
    barks: [
      { text: 'Bring one thing torn from a moment. Bring it, bring it torn.' },
      { text: 'Nyx looks at the seam. I want to look where she looks.' },
    ],
    tags: ['questgiver', 'weavers', 'lieutenant'],
  },
  {
    id: 'npc_ysmay',
    name: 'Ysmay, the Thread-Mother',
    description: 'The ritual elder of the Hollow Choir. She has no eyes, and she holds the one thread that all the others are tied to.',
    factionId: 'weavers',
    homeLocationId: 'loc_sanctum_of_threads',
    portrait: { sigil: 'ysmay', accent: 'weavers' },
    // "quest giver (Veil regional errands); flavor; gives item_weavers_thread_ring at Trusted" (WORLD §4)
    roles: ['questgiver'],
    barks: [
      { text: 'You are knotted. Someone has tied you to the same day eight times.' },
      { text: 'Hold the thread. If it pulls, you are still here.' },
    ],
    tags: ['questgiver', 'weavers', 'thread_mother'],
  },
  {
    id: 'npc_hollis_cade',
    name: 'Hollis Cade',
    description: "The Weavers' quartermaster, in grey thread.",
    factionId: 'weavers',
    homeLocationId: 'loc_sanctum_of_threads',
    portrait: { sigil: 'hollis_cade', accent: 'weavers' },
    // merchant (DESIGN's `npc_veil_vendor`; WORLD §9 stock: Weavers ≥ Neutral or Corruption ≥ 3)
    roles: ['merchant'],
    merchantId: 'npc_hollis_cade',
    barks: [
      { text: 'A Spellbook, uncharred. Fifteen of your blood to read it, more of your gold to own it.' },
      { text: 'We sell the thread. The dark is free.' },
    ],
    tags: ['merchant', 'weavers', 'quartermaster'],
  },
] satisfies NpcInput[];
