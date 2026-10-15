// The `random` bot (PLAN §7.2): a weighted draw over the legal actions — the baseline for crash and soft-lock detection,
// and the floor the policy bots' coverage is calibrated against. Deterministic: the draw comes from the bot's own Rng
// (seeded from `ctx.rngSeed`), so a seed replays.
//
// Weights. PLAN §7.2's: `drop` 0.1, `sell` 0.3, `flee` 0.3, the shell's `save`/`load`/`returnToTitle`/`newGame` 0 (the
// runner plays the title and FALLEN screens), everything else 1. U37 adds a second group so the bot does not spend its
// steps flipping menu toggles that change nothing, nor end loops the instant they are offered:
//   - menu toggles: `setStance` 0.05, `toggleModifier` 0.05, `equipAttunement` 0.1, `thresholdRefund` 0.1,
//     `chooseClass` 0.1, `unequip` 0.2, `swapCompanion` 0.2, `respec` 0.1, `thresholdGo` 0.3 (three of them are listed
//     at once in the Threshold; together they still move it on);
//   - loop enders and skips: `letGo` 0.05 (closes a Loop 2+ at once), `keepVigil` 0.05 (skips to the last dawn),
//     `newGamePlus` 0.05 (wipes the profile's progress);
//   - `examine` 0 (listed only on request; it never changes the game).
// With these, a 5,000-step fixture run spends most of its steps in the world and in fights rather than at the Loom.
// If every listed action weighs 0 the bot falls back to a uniform draw over the non-shell ones, then over all of them.
import type { Action, ActionType } from '@engine/index';
import { botRng, isShellAction } from './shared';
import type { Bot } from './types';

export const RANDOM_WEIGHTS: Readonly<Partial<Record<ActionType, number>>> = {
  // PLAN §7.2
  drop: 0.1,
  sell: 0.3,
  flee: 0.3,
  save: 0,
  load: 0,
  returnToTitle: 0,
  newGame: 0,
  // U37: menu toggles
  setStance: 0.05,
  toggleModifier: 0.05,
  equipAttunement: 0.1,
  thresholdRefund: 0.1,
  chooseClass: 0.1,
  unequip: 0.2,
  swapCompanion: 0.2,
  respec: 0.1,
  thresholdGo: 0.3,
  // U37: loop enders and skips
  letGo: 0.05,
  keepVigil: 0.05,
  newGamePlus: 0.05,
  examine: 0,
};

/** PLAN §7.6 rule 1: `random` dithers legitimately, so its stall window is 200 steps (policy bots: 60). */
export const RANDOM_STALL_STEPS = 200;

export const weightOf = (a: Action): number => RANDOM_WEIGHTS[a.type] ?? 1;

export function randomBot(): Bot {
  return {
    name: 'random',
    stallSteps: RANDOM_STALL_STEPS,
    init: () => ({}),
    choose(_state, legal, _content, memory, ctx) {
      const rng = botRng(memory, ctx.rngSeed);
      const weighted = legal.map((value) => ({ weight: weightOf(value), value }));
      if (weighted.some((e) => e.weight > 0)) return rng.weighted(weighted);
      const game = legal.filter((a) => !isShellAction(a));
      return rng.pick(game.length > 0 ? game : legal);
    },
  };
}
