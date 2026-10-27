// U58: the real pack's ending proofs (src/sim/scripts/endings/index.ts; PLAN §7.8) — the six true endings (STORY §10 A–F) and
// the two loop closers (§10.7), each played by `pathBot` through `runEndingScript` on `buildContentPack()`. Every script reaches
// its ending. `KNOWN_GAPS` is empty since U81a (D-123): ending D is reached by play, the anchor's makings gathered before the
// Heartstone is destroyed. A gap added there again would be pinned here as a failure, so a route that starts working is noticed.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { evaluate } from '@engine/index';
import { CLOSER_IDS, TRUE_ENDING_IDS } from '@schema/ending';
import { pathBot } from '@sim/bots/pathBot';
import type { Bot } from '@sim/bots/types';
import { main } from '@sim/cli';
import { runLoop } from '@sim/runner';
import { newProfile } from '@sim/scenarios';
import { ENDING_SCRIPTS, KNOWN_GAPS } from '@sim/scripts/endings/index';
import { trained } from '@sim/scripts/quests';
import { isCloser, runEndingScript } from '@sim/scripts/run';
import { freshProfile, makeState } from '@tests/fixtures/helpers';

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
    expect(Object.keys(KNOWN_GAPS)).toEqual([]); // U81a (D-123): 8/8, no known gap
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
          // U62b (PLAN: "ending scripts show all slides"): every slide of the ending was shown, its sequence and more
          const seen = proof.result.slides?.find((x) => x.outcome === script.endingId);
          expect([script.endingId, seen !== undefined && seen.shown === seen.total]).toEqual([script.endingId, true]);
          expect((seen?.total ?? 0) >= (pack.endings[script.endingId]?.sequence.length ?? 1)).toBe(true);
          expect(proof.detail).toContain(`${seen?.total}/${seen?.total} slides shown`);
        } else {
          // a known gap: the road as far as it goes, then a pinned failure (none since U81a)
          expect(proof.reached).toBe(false);
          expect(proof.result.errors).toEqual([]);
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

// ---- U76 (PLAN §8.2): each true ending's `requirements` is false at Loop 1's start and true at its script's final state -------

/**
 * The script's play, watched: `requirements` is evaluated on every state the bot is asked to choose in. `atEnd` is its value at
 * the last choice before the ending (the final state the script reaches: the choice that fires the ending is taken in it).
 */
function watched(endingId: string): { reached: boolean; atEnd: boolean | undefined; everTrue: boolean } {
  const script = ENDING_SCRIPTS.find((s) => s.endingId === endingId);
  if (script === undefined) throw new Error(`no script for ${endingId}`);
  const requirements = pack.endings[endingId]?.requirements;
  if (requirements === undefined) throw new Error(`no ending ${endingId}`);
  const seen = { atEnd: undefined as boolean | undefined, everTrue: false, onScreen: false };
  const base = pathBot(script.loops.flat());
  let bot: Bot = base;
  let profile: ReturnType<typeof newProfile> | undefined;
  if (script.profile !== undefined) {
    // as scripts/run.ts `profileOf`: the loop counter, the Echoes earlier loops earned, the class's best level
    const { loop, echoes = [], bestLevel } = script.profile;
    const mastery = bestLevel === undefined ? {} : { [script.classId]: { loopsPlayed: loop - 1, mastered: [], endings: [], bestLevel, bestDays: null } };
    profile = { ...newProfile(script.seed), loopCounter: loop, echoes: [...echoes], classMastery: mastery };
    bot = trained(base);
  }
  // The ending's own effects may be what makes a requirement true (Ending F's flags are set by the communion outcome that ends
  // the game), so the state watched last is the ending screen's: the bot goes through the slides (as scripts/run.ts) and is
  // asked to choose on it.
  const watcher: Bot = {
    ...bot,
    choose: (s, legal, content, memory, ctx) => {
      const now = evaluate(requirements, s, ctx.profile, content);
      // `atEnd`: true on the last state before the ending fires, or on the first state of the ending screen (a communion's
      // `resolve` atom is false once the communion is left, a flag set by the outcome only holds after it)
      if (s.mode !== 'ending') seen.atEnd = now;
      else if (!seen.onScreen) seen.atEnd = seen.atEnd === true || now;
      seen.onScreen = s.mode === 'ending';
      if (now) seen.everTrue = true;
      memory['__u76_slides'] = s.mode === 'ending';
      const ack = s.mode === 'ending' ? legal.find((a) => a.type === 'acknowledgeEnding') : undefined;
      return ack ?? bot.choose(s, legal, content, memory, ctx);
    },
    halt: (memory) => (memory['__u76_slides'] === true ? null : (bot.halt?.(memory) ?? null)),
  };
  const result = runLoop(
    {
      seed: script.seed,
      classId: script.classId,
      bot: watcher,
      stopAt: 'ending',
      maxLoops: script.loops.length + 2,
      onFallen: 'stop',
      showSlides: true,
      maxSteps: 9000,
      ...(script.scenario === undefined ? {} : { scenario: script.scenario }),
      ...(profile === undefined ? {} : { profile }),
    },
    pack,
  );
  return { reached: result.endings.includes(endingId), atEnd: seen.atEnd, everTrue: seen.everTrue };
}

describe('ending requirements are honest (PLAN §8.2 endings.reachable)', () => {
  test('every true ending\'s requirements is false at the start of Loop 1: nobody stumbles into an ending', () => {
    const s = makeState({}, { content: pack, profile: freshProfile() });
    expect(s.player.level).toBeGreaterThanOrEqual(1);
    for (const id of TRUE_ENDING_IDS) {
      const requirements = pack.endings[id]?.requirements;
      expect([id, requirements !== undefined]).toEqual([id, true]);
      if (requirements !== undefined) expect([id, evaluate(requirements, s, freshProfile(), pack)]).toEqual([id, false]);
    }
  });

  test('the closers\' requirements are the empty `all` (nothing to earn), so they are not part of this rule', () => {
    for (const id of CLOSER_IDS) expect([id, pack.endings[id]?.requirements]).toEqual([id, { all: [] }]);
  });

  for (const id of TRUE_ENDING_IDS) {
    if (KNOWN_GAPS[id] !== undefined) {
      test.todo(`${id}: requirements true at the script's final state — a known gap: ${KNOWN_GAPS[id]}`);
      continue;
    }
    test(
      `${id}: requirements true at its script's final state`,
      () => {
        const w = watched(id);
        expect([id, w.reached]).toEqual([id, true]);
        expect([id, w.atEnd, w.everTrue]).toEqual([id, true, true]);
      },
      PROOF_MS,
    );
  }
});
