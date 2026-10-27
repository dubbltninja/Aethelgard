// The real pack's ending proofs (PLAN §7.8; U58): one `EndingScript` per true ending (STORY §10 A–F) and per loop closer
// (§10.7 `closer_escape`, `closer_fall`), played by `pathBot` through `runEndingScript` (../run.ts) on `buildContentPack()`.
// `npm run sim:endings` (src/sim/cli.ts `endings`) runs them and prints one line each; tests/unit/sim/endings.reachable.test.ts
// runs them in CI; `npm run sim:batch` loads this export for the real pack (src/sim/batch.ts `defaultScripts('real')`).
//
// Routes (the quest proofs' own, ../quests.ts, so a route is written once):
//   closer_escape     Loop 3, the Keeper's way: Ilyra tears the Library portal on purpose (STORY §10.7; an expiry's Horde kills a
//                     carry-over party on the way to the Library: a balance flag)
//   closer_fall       `expiry_minus_1`: the thirtieth dawn's Horde, fought to the end (STORY §10.7 `expiry`)
//   A  wardens_vigil  Loop 4 with every verse: Dask's ask at the Pass, the communion past six, "I'm sure." (quest proof A)
//   B  mending        the sim's `ending_b_ready` (the Resolution with the Mending on offer; its words clicked back): consent — the
//                     played route (the Before's pin with Caelum, the forge, the Apex) needs the Unbroken Warden beaten or the ward
//                     seal, which lies behind the stair it unlocks (listed in the U58 reply)
//   C  weavers_dawn   Loop 2 with the sign and Nyx's bond: her arc, the Heartstone exploited, her ask, the Apex (quest proof C)
//   D  iron_silence   Loop 3 with the oath, the iron and the design: the anchor's makings gathered before the Heartstone is
//                     destroyed, Hadda's ask, the forge, the Apex with Brak, the iron shown in communion (quest proof D; U81a,
//                     D-123: by play, on Day 13 of the twenty the Destroy leaves)
//   E  long_archive   Loop 3 with Ilyra's bond: the Keeper, the Heartstone stabilized, Dray's ask, the vigil (quest proof E)
//   F  unbound        Loop 2 with the Tyrant's Echo: the road east, the communion with silence at the gaps, the tear (quest proof F)
import type { Action, ContentPack } from '@engine/index';
import { IRON_SILENCE_ECHOES, SIN_ECHOES, ironSilence, keepersPrice, longArchive, unbound, wardensVigil, weaversDawn } from '../quests';
import { runEndingScript } from '../run';
import type { EndingScript } from '../types';

const CLASS = 'ranger';
const speak = (answerId: string): Action => ({ type: 'commune', act: 'speak', answerId });

export const ENDING_SCRIPTS: readonly EndingScript[] = [
  {
    // STORY §10.7: "from Loop 2 with Remnants Trusted and `echo_portal_tear`, a portal Ilyra opens on purpose" — the Keeper's way
    // (U54's proof). An expiry's Horde kills a carry-over party between the Ruins and the Library on this pack (level 10, the
    // cap: a balance flag), so the deliberate tear is the escape a proof can make.
    endingId: 'closer_escape',
    name: "Loop 3: Ilyra the Keeper tears the Library portal on purpose",
    classId: CLASS,
    seed: 'quest:keeper:keeper',
    profile: { loop: 3, echoes: ['echo_ilyra_watchword', 'echo_crystal_location', 'echo_archive_door', 'echo_ilyra_bond', 'echo_ilyra_cost'], bestLevel: 17 },
    loops: [
      [
        ...keepersPrice('keeper', 'keeper'),
        { assert: { echo: 'echo_portal_tear' }, message: "the Keeper's Echo was not granted" },
        { goto: 'loc_whispering_ruins' },
        { talk: 'npc_ilyra', pick: ['tear', 'open'] },
        { assert: { flag: 'flag_library_portal_open' }, message: 'the portal was not torn' },
        { goto: 'loc_shattered_library' },
        { loopEnd: 'portal' },
      ],
    ],
  },
  {
    endingId: 'closer_fall',
    name: 'the Horde of the thirtieth dawn',
    classId: CLASS,
    seed: 'script:real:closer_fall',
    scenario: 'expiry_minus_1',
    loops: [[{ loopEnd: 'clock' }]],
  },
  {
    endingId: 'ending_wardens_vigil',
    name: "Loop 4 with every verse: Dask's ask, the communion past six, the ninth said",
    classId: CLASS,
    seed: 'quest:vigil',
    profile: { loop: 4, echoes: [...SIN_ECHOES.filter((e) => e !== 'echo_caelum_bond'), 'echo_dask_bond', 'echo_litany_verse_5', 'echo_litany_verse_8', 'echo_litany_verse_9'], bestLevel: 17 },
    loops: [wardensVigil],
  },
  {
    endingId: 'ending_mending',
    name: 'the Resolution with the Mending on offer (ending_b_ready): consent',
    classId: CLASS,
    seed: 'script:real:ending_mending',
    scenario: 'ending_b_ready',
    loops: [[{ assert: { all: [{ item: { id: 'item_breach_anchor' } }, { flag: 'flag_cradle_pin_anchored' }, { resolve: { min: 8 } }] }, message: 'the Mending is on offer' }, speak('consent_mending')]],
  },
  {
    endingId: 'ending_weavers_dawn',
    name: "Loop 2 with the sign and Nyx's bond: her arc, the Heartstone exploited, her ask, the hold's failing",
    classId: CLASS,
    seed: 'quest:dawn:c:4:u9', // U81b2 re-seed (cooldowns, the Tyrant, the lethal fights retuned); // U81c re-seed: a flight now falls back and a quest-drop group regroups at dawn (D-143, D-144)
    profile: { loop: 2, echoes: ['echo_crystal_location', 'echo_nyx_bond', 'echo_weaver_sign', 'echo_apex_resonance'], bestLevel: 20 },
    loops: [weaversDawn],
  },
  {
    endingId: 'ending_iron_silence',
    name: "Loop 3 with the oath, the iron and the design: the makings first, the Heartstone destroyed, Hadda's ask, the forge, the Apex with Brak",
    classId: 'ironclad_warden',
    seed: 'quest:silence',
    profile: { loop: 3, echoes: IRON_SILENCE_ECHOES, bestLevel: 20 },
    loops: [ironSilence],
  },
  {
    endingId: 'ending_long_archive',
    name: "Loop 3 with Ilyra's bond: the Keeper, the Heartstone stabilized, Dray's ask, the vigil to the last dawn",
    classId: CLASS,
    seed: 'quest:archive',
    profile: { loop: 3, echoes: ['echo_ilyra_watchword', 'echo_crystal_location', 'echo_archive_door', 'echo_ilyra_bond', 'echo_ilyra_cost'], bestLevel: 17 },
    loops: [longArchive],
  },
  {
    endingId: 'ending_unbound',
    name: "Loop 2 with the Tyrant's Echo: the road east, the communion with silence at the gaps, the tear stepped through",
    classId: CLASS,
    seed: 'quest:unbound',
    profile: { loop: 2, echoes: ['echo_tyrant_speaks', 'echo_apex_resonance'], bestLevel: 17 },
    loops: [unbound],
  },
];

/** The scripts that do not reach their ending yet, with why (tests pin them so a fix is noticed). */
export const KNOWN_GAPS: Readonly<Record<string, string>> = {}; // U81a (D-123): ending D is reached by play; no gap is left

/**
 * `npm run sim:endings [-- <endingId>…] [--pack <spec>]` (src/sim/cli.ts `endings`): runs the ending proofs (all, or those of the
 * named endings) on the pack (default `real`) and prints one line each. Exit 0 = every proof outside KNOWN_GAPS reached its
 * ending; 1 = one did not; 2 = a usage error.
 */
export async function endingsMain(argv: readonly string[], write: (line: string) => void, loadPack: (spec: string) => Promise<ContentPack>): Promise<number> {
  const ids: string[] = [];
  let packSpec = 'real';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--pack') packSpec = argv[++i] ?? '';
    else if (arg.startsWith('--')) {
      write(`sim endings: unknown option ${arg}`);
      return 2;
    } else ids.push(arg);
  }
  const unknown = ids.filter((id) => !ENDING_SCRIPTS.some((s) => s.endingId === id));
  if (unknown.length > 0) {
    write(`sim endings: no script for ${unknown.join(', ')} (scripted: ${[...new Set(ENDING_SCRIPTS.map((s) => s.endingId))].join(', ')})`);
    return 2;
  }
  const scripts = ids.length === 0 ? ENDING_SCRIPTS : ENDING_SCRIPTS.filter((s) => ids.includes(s.endingId));
  let content: ContentPack;
  try {
    content = await loadPack(packSpec);
  } catch (e) {
    write(`sim endings: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  let failed = 0;
  for (const script of scripts) {
    const proof = runEndingScript(script, content, { maxSteps: 9000 });
    const gap = KNOWN_GAPS[script.endingId];
    if (!proof.reached && gap === undefined) failed += 1;
    write(`${proof.reached ? 'ok  ' : gap === undefined ? 'FAIL' : 'gap '} ${script.endingId}${script.name === undefined ? '' : ` · ${script.name}`} — ${proof.detail}`);
  }
  write(`sim endings: ${scripts.length - failed}/${scripts.length} proof(s) reached their ending or are known gaps`);
  return failed === 0 ? 0 : 1;
}
