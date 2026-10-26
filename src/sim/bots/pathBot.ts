// The scripted bot (PLAN §7.8; U38): `pathBot(script)` plays a `ScriptStep[]` — exact actions, travel, fights, talks,
// stretches handed to a policy bot, proof checkpoints, rests and loop ends. It is for proofs (an ending can be reached, a
// quest can be completed), not for statistics, so it is not in the registry.
//
// How a step runs (one `choose` call asks the current step for an action; a step that is done hands over to the next):
//   Action      the exact action, which must be listed; else the run ends with `script_assert`.
//   goto        BFS to the location over open exits; combat → the fight policy; dialogue → *Continue* (else the first choice).
//   fight       sets the policy (`melee`, `caster`, `flee`; flee falls back to melee when the fight cannot be fled, or when it
//               is a `hold` group that would only re-fire on the next arrival, D-143) used by
//               goto/loopEnd/rest from here on, and plays the fight on screen with it; with no fight on screen it only sets it.
//   talk+pick   the `talk` action (the NPC must be here), then each pick in order when offered, *Continue* otherwise; the
//               dialogue must end with every pick used and no choice left unmatched.
//   until       the condition is checked before each choice (true → next step); until then the named bot (or a `Bot`) plays,
//               with a memory of its own for this step. `maxSteps` (default 400) bounds the choices spent.
//   assert      the condition must hold: the run ends with `script_assert` and the step's message.
//   rest N      N rests (a full one where listed, else a short one).
//   loopEnd     the loop ends by:
//                 portal  pass time to the Horde if it is not on (a full rest where listed, else a short one, else *Wait*), walk to
//                         the Library portal, `enterPortal` → `closer_escape`;
//                 clock   pass time until the clock expires, then die in the Horde → `closer_fall` (expiry);
//                 death   the Horde (any cause) or, outside one, the most dangerous fight the map holds, met with attack-only
//                         play until the player falls → `closer_fall` (death in Loop 2+; the Tyrant's Horde either way).
//               It then acknowledges the closer's slides and is done when the next loop (or the Threshold) is on screen.
// A script that runs out ends the run with `script_done`; any failure ends it with `script_assert` and a message naming the
// step. Everything is a pure function of (state, legal, memory): there is no randomness here (the delegates have theirs, via
// `botRng`, each in a memory of its own).
import { PORTAL_LOCATION_ID, evaluate, type Action, type ContentPack, type GameState } from '@engine/index';
import type { Condition } from '@schema/condition';
import { DEFAULT_SCRIPT_STEPS, type DelegateName, type FightPolicy, type ScriptStep } from '../scripts/types';
import { casterBot } from './caster';
import { explorerBot } from './explorer';
import { meleeBot } from './melee';
import { pacifistBot } from './pacifist';
import { actionKey, allOf, bfsPath, firstOf, locationThreat, nearestWhere, routes, stepAlong } from './shared';
import { speedrunnerBot } from './speedrunner';
import type { Bot, BotContext, BotFactory, BotHalt, BotMemory } from './types';

const DELEGATES: Readonly<Record<DelegateName, BotFactory>> = {
  melee: meleeBot,
  explorer: explorerBot,
  caster: casterBot,
  speedrunner: speedrunnerBot,
  pacifist: pacifistBot,
};

/** Where the script stands (in `BotMemory['pathBot']`, so it survives everything the player's memory does). */
interface PathState {
  /** The step being played. */
  i: number;
  /** Choices spent on it (what `maxSteps` bounds). */
  n: number;
  /** A per-step counter: rests made, picks taken. */
  k: number;
  /** talk: the dialogue has begun. */
  talking: boolean;
  /** loopEnd: the loop number when the step began (0 = not begun). */
  loop0: number;
  /** The policy for encounters. */
  fight: FightPolicy;
  halt: BotHalt | null;
  /** Memories of the bots played for it, by key (`fight:melee`, `until:<step>`). */
  subs: Record<string, BotMemory>;
}

const KEY = 'pathBot';

const fresh = (): PathState => ({ i: 0, n: 0, k: 0, talking: false, loop0: 0, fight: 'melee', halt: null, subs: {} });

const stateOf = (memory: BotMemory): PathState => {
  const have = memory[KEY] as PathState | undefined;
  if (have !== undefined) return have;
  const made = fresh();
  memory[KEY] = made;
  return made;
};

/** What a step answers: the action to play (`done`: the step needs no second look), `next`, or a failure. */
type Answer = { act: Action; done?: boolean } | 'next' | { fail: string };

interface Turn {
  s: GameState;
  legal: readonly Action[];
  content: ContentPack;
  ctx: BotContext;
  p: PathState;
}

const act = (a: Action | undefined, none: string): Answer => (a === undefined ? { fail: none } : { act: a });

/** A bot's choice in its own memory (made on first use). */
function play(t: Turn, key: string, make: () => Bot): Action {
  const bot = make();
  const sub = (t.p.subs[key] ??= bot.init?.(t.ctx.rngSeed) ?? {});
  return bot.choose(t.s, t.legal, t.content, sub, t.ctx);
}

/** The classes `casterBot` plays (its `preferredClasses`). */
const CASTER_CLASSES: readonly string[] = casterBot().preferredClasses ?? [];

/** The fight policy's action in the fight on screen. */
function fightAction(t: Turn): Action {
  // U81c (D-143): a held group re-fires on every arrival until dawn, so fleeing it never gets past: it is fought, by the
  // class's own bot (caster for its preferred classes, else melee)
  const held = t.p.fight === 'flee' && t.s.combat?.onFlee === 'hold';
  const flee = t.p.fight === 'flee' && !held ? firstOf(t.legal, 'flee') : undefined;
  if (flee !== undefined) return flee;
  const caster = t.p.fight === 'caster' || (held && CASTER_CLASSES.includes(t.s.player.classId));
  return play(t, `fight:${caster ? 'caster' : 'melee'}`, caster ? casterBot : meleeBot);
}

/** Attack-only play, to the end: no healing, no guarding, no running. */
function fallAction(t: Turn): Action {
  return allOf(t.legal, 'attack')[0] ?? firstOf(t.legal, 'ability') ?? firstOf(t.legal, 'guard') ?? (t.legal[0] as Action);
}

/** A dialogue that wandered in (an event on the road): *Continue*, else the first choice offered. */
const dialogueAction = (t: Turn): Action | undefined => firstOf(t.legal, 'continue') ?? firstOf(t.legal, 'choose');

/** The modes every travelling step shares: a fight is played, a dialogue is walked through; null = explore. */
function interrupt(t: Turn, label: string, fall = false): Answer | null {
  switch (t.s.mode) {
    case 'explore':
      return null;
    case 'combat':
      return { act: fall ? fallAction(t) : fightAction(t) };
    case 'dialogue':
      return act(dialogueAction(t), `${label}: a dialogue offers no way on`);
    default:
      return { fail: `${label}: cannot go on in mode '${t.s.mode}'` };
  }
}

const limitOf = (step: { maxSteps?: number }): number => step.maxSteps ?? DEFAULT_SCRIPT_STEPS;

/** A rest: full where listed, else short. */
const restAction = (legal: readonly Action[]): Action | undefined =>
  legal.find((a) => a.type === 'rest' && a.kind === 'full') ?? legal.find((a) => a.type === 'rest' && a.kind === 'short');

/** Time passing in place: a rest, else *Wait*. */
const idleAction = (legal: readonly Action[]): Action | undefined => restAction(legal) ?? firstOf(legal, 'wait');

// ---- the steps ---------------------------------------------------------------------------------------------------------------

function exact(t: Turn, step: Action): Answer {
  const listed = t.legal.find((a) => actionKey(a) === actionKey(step));
  if (listed === undefined) return { fail: `${JSON.stringify(step)} is not legal here (mode '${t.s.mode}')` };
  return { act: listed, done: true };
}

function goto(t: Turn, step: { goto: string; maxSteps?: number }): Answer {
  const label = `goto ${step.goto}`;
  if (t.s.mode === 'explore' && t.s.world.currentLocationId === step.goto) return 'next';
  if (t.p.n >= limitOf(step)) return { fail: `${label}: not reached within ${limitOf(step)} steps` };
  const other = interrupt(t, label);
  if (other !== null) return other;
  const path = bfsPath(t.s, t.content, t.ctx.profile, t.s.world.currentLocationId, step.goto);
  if (path === null) return { fail: `${label}: no open route from ${t.s.world.currentLocationId}` };
  return act(stepAlong(t.legal, path), `${label}: the move to ${path[0]} is not legal`);
}

function fight(t: Turn, step: { fight: FightPolicy }): Answer {
  if (t.p.n === 0) t.p.fight = step.fight;
  return t.s.mode === 'combat' ? { act: fightAction(t) } : 'next';
}

/** The open dialogue is `who`'s: theirs by npc, or a scene in which they speak. */
function voicedBy(t: Turn, who: string): boolean {
  const d = t.s.dialogue;
  if (d === null) return false;
  if (d.npcId === who) return true;
  return t.content.dialogues[d.sceneId]?.nodes.some((n) => n.speaker === who) ?? false;
}

function talk(t: Turn, step: { talk: string; pick: string[] }): Answer {
  const label = `talk ${step.talk}`;
  if (t.s.mode === 'dialogue') {
    // U62: a dialogue that wandered in before the talk began and is not theirs (Loop 2's waking at the Ruins: nobody in it
    // speaks as `step.talk`) is walked through; a scene they speak in is adopted (the Tyrant's first words, U58)
    if (!t.p.talking && !voicedBy(t, step.talk)) return act(dialogueAction(t), `${label}: a dialogue offers no way on`);
    t.p.talking = true;
    const want = step.pick[t.p.k];
    const choice = want === undefined ? undefined : t.legal.find((a) => a.type === 'choose' && a.choiceId === want);
    if (choice !== undefined) {
      t.p.k += 1;
      return { act: choice };
    }
    const go = firstOf(t.legal, 'continue');
    if (go !== undefined) return { act: go };
    const offered = allOf(t.legal, 'choose').map((a) => a.choiceId);
    return { fail: `${label}: ${want === undefined ? 'every pick is used and' : `'${want}' is not offered and`} the dialogue offers [${offered.join(', ')}]` };
  }
  if (t.p.talking) {
    return t.p.k < step.pick.length ? { fail: `${label}: the dialogue ended with picks left: [${step.pick.slice(t.p.k).join(', ')}]` } : 'next';
  }
  // U34e (D-091 gap 7): wherever `talk` is legal — explore, and the Threshold's places (Dask, D-084)
  if (t.s.mode !== 'explore' && t.s.mode !== 'threshold') return { fail: `${label}: cannot talk in mode '${t.s.mode}'` };
  const where = t.s.mode === 'threshold' ? 'the Threshold' : t.s.world.currentLocationId;
  return act(
    t.legal.find((a) => a.type === 'talk' && a.npcId === step.talk),
    `${label}: they are not here (${where})`,
  );
}

function until(t: Turn, step: { until: Condition; do: Bot | DelegateName; maxSteps?: number }): Answer {
  if (evaluate(step.until, t.s, t.ctx.profile, t.content)) return 'next';
  if (t.p.n >= limitOf(step)) return { fail: `until ${JSON.stringify(step.until)}: not reached within ${limitOf(step)} steps` };
  const make: BotFactory = typeof step.do === 'string' ? DELEGATES[step.do] : () => step.do as Bot;
  return { act: play(t, `until:${t.p.i}`, make) };
}

function rest(t: Turn, step: { rest: number }): Answer {
  if (t.p.k >= step.rest) return 'next';
  const other = interrupt(t, 'rest');
  if (other !== null) return other;
  const a = restAction(t.legal);
  if (a === undefined) return { fail: 'rest: no rest is listed here' };
  t.p.k += 1;
  return { act: a };
}

/** Walks toward the nearest location that passes `pred` (a step at a time), else idles. */
function walkTo(t: Turn, pred: (id: string) => boolean): Action | undefined {
  const near = nearestWhere(t.s, t.content, t.ctx.profile, pred);
  return stepAlong(t.legal, near?.path ?? null);
}

/** The reachable location whose fights are the strongest (threat > 0), excluding here. */
function deadliest(t: Turn): string | null {
  let best: string | null = null;
  let top = 0;
  for (const id of routes(t.s, t.content, t.ctx.profile, t.s.world.currentLocationId).keys()) {
    const threat = locationThreat(t.s, t.content, t.ctx.profile, id);
    if (threat > top) {
      top = threat;
      best = id;
    }
  }
  return best;
}

function loopEnd(t: Turn, step: { loopEnd: 'portal' | 'clock' | 'death'; maxSteps?: number }): Answer {
  const { s, legal } = t;
  const label = `loopEnd ${step.loopEnd}`;
  if (t.p.loop0 === 0) t.p.loop0 = s.meta.loop;
  if (s.meta.loop !== t.p.loop0 || s.mode === 'threshold') return 'next';
  if (s.mode === 'ending') {
    const ack = firstOf(legal, 'acknowledgeEnding');
    return act(ack, `${label}: the slides offer no way on`);
  }
  if (t.p.n >= limitOf(step)) return { fail: `${label}: the loop did not end within ${limitOf(step)} steps` };
  const horde = s.world.hordeActive;
  const falling = step.loopEnd !== 'portal';
  // the fight to fall in: any in a Horde, and (death) in Loop 2+ the one sought out; Loop 1 outside a Horde is FALLEN, not a closer
  const seeking = step.loopEnd === 'death' && s.meta.loop >= 2;
  const other = interrupt(t, label, falling && (horde || seeking));
  if (other !== null) return other;

  const portal = firstOf(legal, 'enterPortal');
  if (!falling && portal !== undefined) return { act: portal };
  if (!horde) {
    const target = seeking ? deadliest(t) : null;
    if (target !== null) return act(stepAlong(legal, bfsPath(s, t.content, t.ctx.profile, s.world.currentLocationId, target)), `${label}: no way to ${target}`);
    return act(idleAction(legal), `${label}: no way to pass the time`);
  }
  if (!falling) {
    const way = bfsPath(s, t.content, t.ctx.profile, s.world.currentLocationId, PORTAL_LOCATION_ID);
    return way === null ? { fail: `${label}: no open route to the portal` } : act(stepAlong(legal, way), `${label}: the move to ${way[0]} is not legal`);
  }
  // in the Horde, to the nearest infected place that is not this one (each arrival costs hp and starts a fight)
  const infected = new Set(s.world.infected);
  const to = walkTo(t, (id) => infected.has(id) && id !== s.world.currentLocationId) ?? firstOf(legal, 'move') ?? idleAction(legal);
  return act(to, `${label}: nowhere to go`);
}

function run(t: Turn, step: ScriptStep): Answer {
  if ('type' in step) return exact(t, step);
  if ('goto' in step) return goto(t, step);
  if ('fight' in step) return fight(t, step);
  if ('talk' in step) return talk(t, step);
  if ('until' in step) return until(t, step);
  if ('assert' in step) return evaluate(step.assert, t.s, t.ctx.profile, t.content) ? 'next' : { fail: step.message };
  if ('rest' in step) return rest(t, step);
  return loopEnd(t, step);
}

/** Builds the bot for a script. Pass `script` flat; `runEndingScript` flattens an `EndingScript`'s loops. */
export function pathBot(script: readonly ScriptStep[]): Bot {
  return {
    name: 'pathBot',
    init: () => ({ [KEY]: fresh() }),
    choose(state, legal, content, memory, ctx) {
      const p = stateOf(memory);
      const t: Turn = { s: state, legal, content, ctx, p };
      const stop = (halt: BotHalt): Action => {
        p.halt = halt;
        return legal[0] as Action;
      };
      // every `next` moves on a step, so the loop ends at the script's end (script_done)
      for (;;) {
        const step = script[p.i];
        if (p.halt !== null) return legal[0] as Action;
        if (step === undefined) return stop({ reason: 'script_done' });
        const answer = run(t, step);
        if (answer === 'next') {
          Object.assign(p, { i: p.i + 1, n: 0, k: 0, talking: false, loop0: 0 });
          continue;
        }
        if ('fail' in answer) {
          // an `assert` step's message is the author's own; every other failure names its step
          const message = 'assert' in step ? answer.fail : `step ${p.i}: ${answer.fail}`;
          return stop({ reason: 'script_assert', message });
        }
        if (answer.done === true) Object.assign(p, { i: p.i + 1, n: 0, k: 0, talking: false, loop0: 0 });
        else p.n += 1;
        return answer.act;
      }
    },
    halt: (memory) => stateOf(memory).halt,
  };
}
