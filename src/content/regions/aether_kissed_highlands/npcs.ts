// Aether-Kissed Highlands — the NPCs whose home is in the region (WORLD §4 row: id, placement, roles, description, sample lines;
// names and roles are STORY's, D-062). Dask is new (no legacy record), so there is no `legacyName`. `companionId` is the
// handshake with shared/companions.ts (D-088: `npcId: 'npc_dask'` ↔ `companionId: 'dask'`). He "may remain in any
// `temporallyUnstable` location" (D-059) and drops out on the Glowlands (D-068.2): the engine's rule, not a second placement.
// In Loop 1 he is a flicker the player cannot speak to; Loop 2+ only, and his first scene gives only the warning (STORY §4.4,
// D-066.12, D-067.16): D-098 (U34d) his `schedule` stands him nowhere in Loop 1 (the Pass's `ev_pass_flicker` is the
// glimpse); his first scene is the dialogue units' (U52–U59). The barks are WORLD's sample lines, verbatim. No age: BIBLE
// gives none ("Died Year 430; seventh Wayfinder").
import type { NpcInput } from '@schema/npc';

export const npcs = [
  {
    id: 'npc_dask',
    name: 'Dask',
    description: 'The seventh Wayfinder, Year 430, scattered across moments by a chrono-strike.',
    factionId: 'neutral', // WORLD §4: faction "—"
    homeLocationId: 'loc_shimmering_pass',
    portrait: { sigil: 'dask' },
    // quest giver: the Dask arc, q_high_mark, q_wardens_vigil (WORLD §4)
    roles: ['companion', 'questgiver'],
    companionId: 'dask',
    barks: [
      { text: 'Hells of a road, this. I walked it seventy years ago. Or — tomorrow.' },
      { text: "Don't strike it first. It won't strike what keeps its distance." },
    ],
    // D-098 (U34d): WORLD §3.4 "in Loop 1 he is a flicker the player cannot speak to — Loop 2+ only". U55 (D-102): while his
    // arc quests run he is also where their scenes find him — his other three selves at the Spires, the Plateau and the
    // Nexus (`q_the_flickering_man`), the Windward Stair for the eighth frame (`q_seven_marks`, with the Shore he already
    // stands on), the Apex for his choice (`q_the_last_instant`); otherwise the Pass and the Still Shore place him.
    schedule: [
      { when: { loop: { max: 1 } }, at: [] },
      { when: { quest: { id: 'q_the_flickering_man', status: 'active' } }, at: ['loc_shimmering_pass', 'loc_aetherium_spires', 'loc_sky_whisper_plateau', 'loc_chronos_nexus'] },
      { when: { quest: { id: 'q_seven_marks', stage: 'high_mark' } }, at: ['loc_shimmering_pass', 'loc_still_shore', 'loc_windward_stair'] },
      { when: { quest: { id: 'q_the_last_instant', status: 'active' } }, at: ['loc_shimmering_pass', 'loc_temporal_breach_apex'] },
    ],
    tags: ['companion_anchor'],
  },
] satisfies NpcInput[];
