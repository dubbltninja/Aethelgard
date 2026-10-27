// U52: the quest proofs (src/sim/scripts/quests.ts; PLAN §7.8, DESIGN §13.4). Every legacy quest has a pathBot script per outcome
// that something later reads, and each completes its quest on the real pack; `npm run sim -- quest` runs them; the `trained`
// wrapper plays the character rows and never touches the script's own steps.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { main } from '@sim/cli';
import { pathBot } from '@sim/bots/pathBot';
import { QUEST_SCRIPTS, TRAINED_REST_BELOW, runQuestScript, trained } from '@sim/scripts/quests';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { fixturePack } from '@tests/fixtures/miniContent';
import type { Action } from '@engine/index';
import { legalActions } from '@engine/index';

const pack = buildContentPack();
/** A proof plays a few hundred steps under __DEV__'s deep-freeze; the shared 2-core box is slow (D-103). */
const PROOF_MS = 120_000;

async function cli(argv: string[]): Promise<{ code: number; out: string[] }> {
  const out: string[] = [];
  const code = await main(argv, (line) => out.push(line));
  return { code, out };
}

describe('the legacy quests’ proofs', () => {
  test('each of the six has a script per outcome other content reads (the Crystal, the scroll, the shards, each Heartstone path)', () => {
    const outcomes = (questId: string): string[] => [...new Set(QUEST_SCRIPTS.filter((s) => s.questId === questId).map((s) => s.outcome))].sort();
    expect(outcomes('q_echo_crystal')).toEqual(['given', 'kept']);
    expect(outcomes('q_lost_scroll')).toEqual(['to_ilyra', 'to_nyx']);
    expect(outcomes('q_clear_path')).toEqual(['done']);
    expect(outcomes('q_blighted_outpost')).toEqual(['done']);
    expect(outcomes('q_void_shards')).toEqual(['given', 'refused']);
    expect(outcomes('q_echoing_heartbeat')).toEqual(['done_destroy', 'done_exploit', 'done_stabilize']);
    // every script ends on its assertion, and names a real outcome stage that completes the quest
    for (const s of QUEST_SCRIPTS) {
      expect([s.name, 'assert' in (s.steps.at(-1) ?? {})]).toEqual([s.name, true]);
      expect([s.name, pack.quests[s.questId]?.stages.find((st) => st.id === s.outcome)?.outcome]).toEqual([s.name, 'complete']);
    }
    expect(new Set(QUEST_SCRIPTS.map((s) => s.seed)).size).toBe(QUEST_SCRIPTS.length);
  });

  for (const script of QUEST_SCRIPTS) {
    test(
      `${script.questId} · ${script.name}`,
      () => {
        const proof = runQuestScript(script, pack);
        expect([script.name, proof.detail, new RegExp(`^${script.questId} ${script.outcome} in \\d+ steps`).test(proof.detail)]).toEqual([script.name, proof.detail, true]);
        expect(proof.completed).toBe(true);
        expect(proof.result.questsCompleted).toContain(script.questId);
        expect(proof.result.softLock.detected).toBe(false);
      },
      PROOF_MS,
    );
  }

  test(
    'a proof that cannot hold says why: a failed assertion, an error, a fall',
    () => {
      const base = { questId: 'q_echo_crystal' as const, outcome: 'given', name: 'x', classId: 'ranger', seed: 'quest:fail' };
      const asserted = runQuestScript({ ...base, steps: [{ assert: { quest: { id: 'q_echo_crystal', status: 'completed' } }, message: 'not yet' }] }, pack);
      expect([asserted.completed, asserted.detail]).toEqual([false, 'script_assert: not yet']);
      const capped = runQuestScript({ ...base, maxSteps: 3, steps: [{ goto: 'loc_shattered_library' }, { assert: { level: { min: 99 } }, message: 'never' }] }, pack);
      expect(capped.completed).toBe(false);
      expect(capped.detail).toMatch(/^max_steps \(final explore at loc_/);
    },
    PROOF_MS,
  );
});

describe('`npm run sim -- quest`', () => {
  test(
    'runs the named quest’s proofs on the real pack and exits 0',
    async () => {
      const { code, out } = await cli(['quest', 'q_echo_crystal']);
      expect(code).toBe(0);
      expect(out.filter((l) => l.startsWith('ok   q_echo_crystal'))).toHaveLength(QUEST_SCRIPTS.filter((s) => s.questId === 'q_echo_crystal').length);
      expect(out.at(-1)).toBe('sim quest: 3/3 proof(s) completed');
    },
    PROOF_MS,
  );

  test(
    'a failing proof exits 1 (the fixture pack has no legacy quests); usage errors exit 2',
    async () => {
      const failed = await cli(['quest', 'q_clear_path', '--pack', 'fixture', '--verbose']);
      expect(failed.code).toBe(1);
      expect(failed.out[0]).toMatch(/^FAIL q_clear_path/);
      expect((await cli(['quest', 'q_nope'])).code).toBe(2);
      expect((await cli(['quest', 'q_nope'])).out[0]).toMatch(/^sim quest: no script for q_nope \(scripted: q_echo_crystal, /);
      expect((await cli(['quest', '--bogus'])).out).toEqual(['sim quest: unknown option --bogus']);
      expect((await cli(['quest', '--pack', 'no/such/pack.ts'])).code).toBe(2);
    },
    PROOF_MS,
  );
});

describe('trained(): the character rows in front of the script', () => {
  const content = fixturePack();
  const ctx = { profile: freshProfile(), rngSeed: 'x', step: 0, recentEvents: [] };
  const script: Action = { type: 'wait' };

  /** No ability point to spend (newRun gives one at level 1). */
  const noPoints = { patch: (st: { player: { apHalf: number } }) => void (st.player.apHalf = 0) };

  test('in explore mode: a stat point, then an ability point, then the script; outside explore the script alone', () => {
    const bot = trained(pathBot([script]));
    const memory = bot.init?.('x') ?? {};
    const levelled = makeState({ level: 3 }, { content });
    expect(bot.choose(levelled, legalActions(levelled, content, ctx.profile), content, memory, ctx)).toMatchObject({ type: 'allocateStat', stat: 'strength' });
    const fresh = makeState({}, { content });
    expect(bot.choose(fresh, legalActions(fresh, content, ctx.profile), content, memory, ctx)).toMatchObject({ type: 'unlockAbility' });
    expect(bot.examines).toBe(true);
    const spent = makeState(noPoints, { content });
    expect(bot.choose(spent, legalActions(spent, content, ctx.profile), content, memory, ctx)).toEqual(script);
    const talking = makeState({ ...noPoints, level: 3, mode: 'dialogue' }, { content });
    expect(trained(pathBot([script])).choose(talking, [script], content, {}, ctx)).toEqual(script);
  });

  test(`rests where a bed is listed while HP is under ${TRAINED_REST_BELOW * 100} %`, () => {
    const s = makeState({ ...noPoints, locationId: 'loc_whispering_ruins', hp: 5 }, { content });
    const legal = legalActions(s, content, ctx.profile);
    if (!legal.some((a) => a.type === 'rest')) throw new Error('the fixture start has no rest spot');
    const bot = trained(pathBot([script]));
    expect(bot.choose(s, legal, content, bot.init?.('x') ?? {}, ctx)).toMatchObject({ type: 'rest' });
  });
});
