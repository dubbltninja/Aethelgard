// Fixture `EndingScript`s (PLAN §7.8; U38): one proof per ending and loop closer the fixture packs can express. Every script
// names content ids only and runs on all nine fixture packs (they share the Apex, the Tyrant's communion and its three
// outcomes: `let_pass` → ending_unbound, `take_place` → ending_wardens_vigil, `mending` → ending_mending).
//
//   closer_escape   the Library portal after the thirtieth dawn: from `expiry_minus_1`, and from the title screen
//   closer_fall     the Horde that the clock raised (expiry), a death sought out in Loop 2, and *Let go* at a camp (released)
//   ending_unbound  the Resolution's *let_pass* (from `ending_a_ready`), and the whole route: Loop 1's portal, then Loop 2's
//                   communion played by the pacifist
//   ending_wardens_vigil / ending_mending   the Resolution of `ending_a_ready` / `ending_b_ready`
//
// The Tyrant's own Horde (a closer after the Contained Tyrant falls) is not scripted: only four fixture packs place that
// fight at the Apex and the melee policy does not win it at Level 13; `tests/unit/engine/horde.test.ts` proves that Horde.
import type { Action, ContentPack } from '@engine/index';
import type { EndingScript } from '@sim/scripts/types';
import { beforePack } from '../beforeContent';
import { combatPack } from '../combatContent';
import { companionPack } from '../companionContent';
import { beforeEconomyPack, economyPack } from '../economyContent';
import { hordePack } from '../hordeContent';
import { fixturePack } from '../miniContent';
import { storyPack } from '../storyContent';
import { thresholdPack } from '../thresholdContent';

/** The nine fixture packs by their `--pack` names (src/sim/cli.ts FIXTURE_PACKS). */
export const FIXTURE_PACK_FACTORIES = {
  fixture: fixturePack,
  combat: combatPack,
  companion: companionPack,
  horde: hordePack,
  story: storyPack,
  threshold: thresholdPack,
  economy: economyPack,
  before: beforePack,
  before_economy: beforeEconomyPack,
} as const satisfies Record<string, () => ContentPack>;

export type FixturePackName = keyof typeof FIXTURE_PACK_FACTORIES;

const speak = (answerId: string): Action => ({ type: 'commune', act: 'speak', answerId });
const CLASS = 'ranger';

export const FIXTURE_ENDING_SCRIPTS: readonly EndingScript[] = [
  {
    endingId: 'closer_escape',
    name: 'the portal after the thirtieth dawn',
    classId: CLASS,
    seed: 'script:closer_escape:expiry',
    scenario: 'expiry_minus_1',
    loops: [
      [
        { assert: { loop: { min: 1, max: 1 } }, message: 'the scenario starts in Loop 1' },
        { assert: { clock: { daysLeft: { max: 1 } } }, message: 'the clock is about to expire' },
        { loopEnd: 'portal' },
      ],
    ],
  },
  {
    endingId: 'closer_escape',
    name: 'from the title screen: wait out the clock, then the portal',
    classId: CLASS,
    seed: 'script:closer_escape:title',
    loops: [[{ loopEnd: 'portal' }]],
  },
  {
    endingId: 'closer_fall',
    name: 'the Horde of the thirtieth dawn',
    classId: CLASS,
    seed: 'script:closer_fall:expiry',
    scenario: 'expiry_minus_1',
    loops: [[{ loopEnd: 'clock' }]],
  },
  {
    endingId: 'closer_fall',
    name: 'a death sought out in Loop 2',
    classId: CLASS,
    seed: 'script:closer_fall:death',
    scenario: 'loop2_day1',
    loops: [[{ assert: { loop: { min: 2 } }, message: 'the scenario starts in Loop 2 or later' }, { loopEnd: 'death' }]],
  },
  {
    endingId: 'closer_fall',
    name: 'Let go at a camp (released)',
    classId: CLASS,
    seed: 'script:closer_fall:released',
    scenario: 'loop2_day1',
    loops: [[{ assert: { loop: { min: 2 } }, message: 'letting go is Loop 2+' }, { type: 'letGo' }]],
  },
  {
    endingId: 'ending_unbound',
    name: 'the Resolution: let the Tyrant pass',
    classId: CLASS,
    seed: 'script:ending_unbound:resolution',
    scenario: 'ending_a_ready',
    loops: [[{ assert: { resolve: { min: 3 } }, message: 'the Resolution is reached with Resolve of 3 or more' }, speak('let_pass')]],
  },
  {
    endingId: 'ending_unbound',
    name: "Loop 1's portal, then Loop 2's communion (the pacifist plays it)",
    classId: CLASS,
    seed: 'script:ending_unbound:route',
    loops: [
      [{ loopEnd: 'portal' }],
      [{ assert: { loop: { min: 2 } }, message: 'Loop 2 is on' }, { until: { level: { min: 99 } }, do: 'pacifist', maxSteps: 3000 }],
    ],
  },
  {
    endingId: 'ending_wardens_vigil',
    classId: CLASS,
    seed: 'script:ending_wardens_vigil',
    scenario: 'ending_a_ready',
    loops: [
      [
        { assert: { echo: 'echo_litany_complete' }, message: 'the Litany is complete' },
        { assert: { resolve: { min: 6 } }, message: 'Resolve of 6 or more' },
        speak('take_place'),
      ],
    ],
  },
  {
    endingId: 'ending_mending',
    classId: CLASS,
    seed: 'script:ending_mending',
    scenario: 'ending_b_ready',
    loops: [
      [
        { assert: { item: { id: 'item_breach_anchor' } }, message: 'the Breach Anchor is carried' },
        { assert: { resolve: { min: 6 } }, message: 'Resolve of 6 or more' },
        speak('mending'),
      ],
    ],
  },
];
