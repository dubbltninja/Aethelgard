// Runs an `EndingScript` (PLAN §7.8; U38): flattens its loops into one `pathBot` script, plays it through the runner from the
// title screen (or from its `scenario`) and says whether the ending — or the loop closer — was reached.
//
// The run stops at the first ending (`stopAt: 'ending'`), on the Loop 1 FALLEN screen (a proof does not reload; it fails), when
// the script runs out (`script_done`) or when a step or checkpoint fails (`script_assert`, with the message).
import type { ContentPack } from '@engine/index';
import { pathBot } from '../bots/pathBot';
import { runLoop, type RunResult } from '../runner';
import type { EndingScript } from './types';

export interface ScriptProof {
  script: EndingScript;
  reached: boolean;
  /** One line: what was reached, or why not (the failed checkpoint's message, the stop reason, the first error). */
  detail: string;
  result: RunResult;
}

export interface ScriptRunOptions {
  /** The runner's step cap (default 6000). */
  maxSteps?: number;
}

/** `closer_escape` and `closer_fall` are loop closers (recorded in `closers`); every other id is a true ending. */
export const isCloser = (endingId: string): boolean => endingId === 'closer_escape' || endingId === 'closer_fall';

export function runEndingScript(script: EndingScript, content: ContentPack, opts: ScriptRunOptions = {}): ScriptProof {
  const bot = pathBot(script.loops.flat());
  const result = runLoop(
    {
      seed: script.seed,
      classId: script.classId,
      bot,
      stopAt: 'ending',
      maxLoops: script.loops.length + 2,
      onFallen: 'stop',
      ...(opts.maxSteps === undefined ? {} : { maxSteps: opts.maxSteps }),
      ...(script.scenario === undefined ? {} : { scenario: script.scenario }),
    },
    content,
  );
  const hit = isCloser(script.endingId) ? result.closers.includes(script.endingId) : result.endings.includes(script.endingId);
  const clean = result.errors.length === 0;
  const detail = hit
    ? clean
      ? `${script.endingId} reached in ${result.steps} steps`
      : `${script.endingId} reached, but the run had an error: ${result.errors[0]?.message ?? ''}`
    : result.stopReason === 'script_assert'
      ? `script_assert: ${result.stopMessage ?? ''}`
      : `${result.stopReason}: ${script.endingId} not reached (${result.errors[0]?.message ?? `final ${result.final.mode} at ${result.final.locationId}`})`;
  return { script, reached: hit && clean, detail, result };
}
