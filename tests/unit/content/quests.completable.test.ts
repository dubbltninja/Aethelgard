// U76 (PLAN §8.2 `quests.completable.test.ts`): every quest of the real pack has a passing proof in src/sim/scripts/quests.ts —
// one `pathBot` script that plays it to a completing stage on the real engine — run here with a 10 s budget per quest.
// There is no recorded batch fixture (`tests/fixtures/coverage.json`) yet, so the scripts are the whole evidence.
//
// Sampling: a quest can have several scripts (one per outcome that later content reads). This file runs the FIRST script of
// each quest, which is a full proof that the quest is completable (~10 s for all 48 on an idle box); every script, outcome by
// outcome, is run by tests/unit/sim/questScripts.test.ts, so nothing is dropped from `npm test`.
//
// `q_iron_silence` (ending D) was D-123's known gap until U81a: its proof now gathers the anchor's makings before the Heartstone is
// destroyed and reaches the Apex on Day 13 of twenty. Every quest has a proof; `KNOWN_QUEST_GAPS` is empty.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { QUEST_SCRIPTS, runQuestScript } from '@sim/scripts/quests';
import { KNOWN_GAPS } from '@sim/scripts/endings/index';

const pack = buildContentPack();
const BUDGET_MS = 10_000;

/** Quests whose completion is the known gap of an ending (D-123), by quest id. */
const KNOWN_QUEST_GAPS: Record<string, string> = {};

const firstScript = new Map<string, (typeof QUEST_SCRIPTS)[number]>();
for (const s of QUEST_SCRIPTS) if (!firstScript.has(s.questId)) firstScript.set(s.questId, s);

describe('every quest has a passing proof (PLAN §8.2)', () => {
  test('the proofs name real quests and real completing stages; the quests without one are exactly the known gaps', () => {
    for (const s of QUEST_SCRIPTS) {
      expect([s.name, pack.quests[s.questId] !== undefined]).toEqual([s.name, true]);
      expect([s.name, pack.quests[s.questId]?.stages.find((st) => st.id === s.outcome)?.outcome]).toEqual([s.name, 'complete']);
    }
    const without = Object.keys(pack.quests).filter((id) => !firstScript.has(id));
    expect(without).toEqual(Object.keys(KNOWN_QUEST_GAPS));
    expect(Object.keys(KNOWN_GAPS)).toEqual([]);
  });

  for (const quest of Object.values(pack.quests)) {
    const script = firstScript.get(quest.id);
    if (script === undefined) {
      test.todo(`${quest.id} — no proof: ${KNOWN_QUEST_GAPS[quest.id] ?? 'missing'}`);
      continue;
    }
    test(
      `${quest.id} completes (${script.outcome}) within ${BUDGET_MS / 1000} s`,
      () => {
        const t0 = performance.now();
        const proof = runQuestScript(script, pack);
        expect([quest.id, proof.detail, proof.completed]).toEqual([quest.id, proof.detail, true]);
        expect(proof.result.questsCompleted).toContain(quest.id);
        expect(proof.result.softLock.detected).toBe(false);
        expect(proof.result.errors).toEqual([]);
        expect([quest.id, performance.now() - t0 < BUDGET_MS]).toEqual([quest.id, true]);
      },
      BUDGET_MS,
    );
  }
});
