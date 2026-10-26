// The scenes D-127's loose Echoes needed (STORY §12; U62b, the finisher of U62): a grant that is a person teaching you something,
// and a read that is a scene of its own. The conventions are this folder's index.ts; every line is `written` (STORY §12 gives the
// effect, not the words) and pinned by tests/unit/content/scenes.test.ts.
//   Ferrin   scene_ferrin_trail_signs (the Scorched Gate, Ironclad ≥ Neutral: the trail-signs → `echo_nomad_signs`; WORLD §4)
//   place    scene_pin_alone (the Conflux's `ev_conflux_pin_alone`: `echo_caelum_stayed` — he stayed, so the pin is set without
//            him, STORY §7.6 "the pin must be placed by the player"; the hour steadies by three days, as with him)
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import { NOT_IN_HORDE, SCENE_PRIORITY } from './common';

const FERRIN = 'npc_scout_ferrin';
/** DESIGN §11.1 tiers (D-014): Neutral is −9 and up. */
const IRONCLAD_NEUTRAL: Condition = { rep: { faction: 'ironclad', min: -9 } };

export const dialogues = [
  // ==== Scout Ferrin · the trail-signs (STORY §12 `echo_nomad_signs`: "Scout Ferrin at the Scorched Gate (Ironclad ≥ Neutral)") ====
  {
    id: 'scene_ferrin_trail_signs',
    npcId: FERRIN,
    title: 'Trail-signs',
    when: { all: [NOT_IN_HORDE, IRONCLAD_NEUTRAL, { not: { echo: 'echo_nomad_signs' } }] },
    priority: SCENE_PRIORITY.offer,
    entry: 'signs',
    nodes: [
      {
        id: 'signs',
        tags: ['written'],
        speaker: FERRIN,
        text: "You'll be back on this grass; everyone is. So learn it. A cut turf is water. Three stones is a camp that will feed you. A thorn tied in a knot means the herd-path is safe.",
        onEnter: [{ grantEcho: 'echo_nomad_signs' }],
        next: 'gates',
      },
      {
        id: 'gates',
        tags: ['written'],
        speaker: FERRIN,
        text: 'Read them and the Steppe lets you in: this gate to any rider who knows them, and the bone road to the Herd-Grave. Two notes means friend. Learn that too.',
        next: 'end',
      },
    ],
  },

  // ==== The pin set alone (STORY §7.6 Caelum B, §12 `echo_caelum_stayed`: "Harder Mending (player places pin)") ======================
  // `q_the_mending` at `crossing` without Caelum beside you, in a loop after he stayed with his city: the place's event opens this.
  {
    id: 'scene_pin_alone',
    title: 'Iron that does not wish',
    entry: 'whole',
    nodes: [
      {
        id: 'whole',
        tags: ['written'],
        speaker: 'narrator',
        text: "The Heartstone beats slow and even in Hallow's iron. The pin lies on the rim where you set it, and nobody is beside you to look at it.",
        mood: 'cold',
        next: 'stayed',
      },
      {
        id: 'stayed',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Up in the city a boy is carrying a message he has carried before. He stayed. The pin is here because he lent it, and that will have to do.',
        mood: 'grim',
        next: 'steadies',
      },
      {
        id: 'steadies',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Far ahead of you, at the other end of five hundred years, something that has been bracing leans a little of its weight on the pin, and the hour steadies by three days.',
        onEnter: [{ clockWatches: 12 }, { questAdvance: { quest: 'q_the_mending', stage: 'forge' } }],
        next: 'end',
      },
    ],
  },
] satisfies DialogueSceneInput[];
