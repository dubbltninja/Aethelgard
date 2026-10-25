// U58: the real pack's ending proofs (src/sim/scripts/endings/index.ts; PLAN §7.8) — the six true endings (STORY §10 A–F) and
// the two loop closers (§10.7), each played by `pathBot` through `runEndingScript` on `buildContentPack()`. Every script reaches
// its ending, except the ones `KNOWN_GAPS` names, whose failure is pinned here so that a route that starts working is noticed
// (ending D: the Heartstone's silence leaves nineteen dawns, and the anchor's road takes a carry-over party longer).
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { CLOSER_IDS, TRUE_ENDING_IDS } from '@schema/ending';
import { main } from '@sim/cli';
import { ENDING_SCRIPTS, KNOWN_GAPS } from '@sim/scripts/endings/index';
import { isCloser, runEndingScript } from '@sim/scripts/run';

const pack = buildContentPack();
const PROOF_MS = 180_000;

describe('the real ending scripts (STORY §10, §10.7)', () => {
  test('one script per true ending and per closer; distinct seeds; a label each', () => {
    const ids = ENDING_SCRIPTS.map((s) => s.endingId);
    expect([...ids].sort()).toEqual([...TRUE_ENDING_IDS, ...CLOSER_IDS].sort());
    expect(new Set(ENDING_SCRIPTS.map((s) => s.seed)).size).toBe(ENDING_SCRIPTS.length);
    for (const s of ENDING_SCRIPTS) expect([s.endingId, typeof s.name]).toEqual([s.endingId, 'string']);
    for (const s of ENDING_SCRIPTS) expect([s.endingId, pack.endings[s.endingId] !== undefined]).toEqual([s.endingId, true]);
    // a Loop 2+ script starts from a constructed profile (its Echoes exist) or from a scenario
    for (const s of ENDING_SCRIPTS) for (const e of s.profile?.echoes ?? []) expect([s.endingId, e, pack.echoes[e] !== undefined]).toEqual([s.endingId, e, true]);
    expect(Object.keys(KNOWN_GAPS)).toEqual(['ending_iron_silence']);
  });

  for (const script of ENDING_SCRIPTS) {
    const gap = KNOWN_GAPS[script.endingId];
    test(
      `${script.endingId} — ${script.name}${gap === undefined ? '' : ' (KNOWN GAP)'}`,
      () => {
        const proof = runEndingScript(script, pack, { maxSteps: 9000 });
        if (gap === undefined) {
          expect([script.endingId, proof.detail.includes(`${script.endingId} reached`), proof.detail]).toEqual([script.endingId, true, proof.detail]);
          expect(proof.reached).toBe(true);
          expect(proof.result.errors).toEqual([]);
          expect(proof.result.softLock.detected).toBe(false);
          if (!isCloser(script.endingId)) expect(proof.result.stopReason).toBe('ending');
        } else {
          // the road as far as it goes, then the pinned failure: Hadda's ask is reached, the ending is not
          expect(proof.reached).toBe(false);
          expect(proof.result.errors).toEqual([]);
          expect(proof.detail).toBe("script_assert: ending D's road: the anchor's materials, Borin and the Apex lie past the nineteenth dawn");
          expect(proof.result.questsCompleted).not.toContain('q_iron_silence');
        }
      },
      PROOF_MS,
    );
  }

  test(
    '`npm run sim:endings` (the CLI) prints one line per script and exits 0 while every script outside the known gaps reaches its ending',
    async () => {
      const lines: string[] = [];
      const code = await main(['endings', 'closer_fall', 'ending_mending'], (l) => lines.push(l));
      expect(code).toBe(0);
      expect(lines.filter((l) => l.startsWith('ok  ')).length).toBe(2);
      expect(lines.at(-1)).toBe('sim endings: 2/2 proof(s) reached their ending or are known gaps');
      const unknown: string[] = [];
      expect(await main(['endings', 'ending_nothing'], (l) => unknown.push(l))).toBe(2);
      expect(unknown[0]).toContain('no script for ending_nothing');
    },
    PROOF_MS,
  );
});
