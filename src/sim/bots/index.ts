// The bot registry (PLAN §7.2; U37 registered melee and random, U38 adds the other four). `pathBot` is the seventh bot,
// built from a script (PLAN §7.8) for proofs rather than statistics: it is not registered here.
import { casterBot } from './caster';
import { explorerBot } from './explorer';
import { meleeBot } from './melee';
import { pacifistBot } from './pacifist';
import { randomBot } from './random';
import { speedrunnerBot } from './speedrunner';
import type { BotFactory } from './types';

/** The bots the CLI and the batch runner can name. */
export const BOTS: Readonly<Record<string, BotFactory>> = { melee: meleeBot, random: randomBot, caster: casterBot, explorer: explorerBot, speedrunner: speedrunnerBot, pacifist: pacifistBot };
