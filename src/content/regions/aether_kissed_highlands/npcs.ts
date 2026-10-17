// Aether-Kissed Highlands — the NPCs whose home is in the region (WORLD §4 row: id, placement, roles, description, sample lines;
// names and roles are STORY's, D-062). Dask is new (no legacy record), so there is no `legacyName`. `companionId` is the
// handshake with shared/companions.ts (D-088: `npcId: 'npc_dask'` ↔ `companionId: 'dask'`). He "may remain in any
// `temporallyUnstable` location" (D-059) and drops out on the Glowlands (D-068.2): the engine's rule, not a second placement.
// In Loop 1 he is a flicker the player cannot speak to; Loop 2+ only, and his first scene gives only the warning (STORY §4.4,
// D-066.12, D-067.16): a placement has no condition, so that is the dialogue and companion units' (U52–U59). The barks are
// WORLD's sample lines, verbatim. No age: BIBLE gives none ("Died Year 430; seventh Wayfinder").
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
    tags: ['companion_anchor'],
  },
] satisfies NpcInput[];
