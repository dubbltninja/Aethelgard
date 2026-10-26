// What the live region says after a step (PLAN §6.7): one sentence (or a few joined) per dispatch, never one per
// event, so a screen reader is not flooded. U63 covers arrival, narration and the shell's own events; U70 adds combat
// ("You hit the Corrupted Shade for 12. The Corrupted Shade readies Wail, 6 to 7 damage, at you. Your turn.") and the
// ends of a fight. Damage and healing are named from the event, who from the fight's combatants (a fight that has just
// ended is spoken from the creature ids on its events). Rewards, reputation and level-ups are the toasts' (a live
// region of their own), so they are not repeated here.
import { WATCH_NAMES, dayOf, watchOf, type Combatant, type ContentPack, type GameEvent, type GameState } from '@engine/index';
import { proseText } from '../text/prose';

export interface AnnounceOptions {
  /** Settings → "Show exact damage on enemy intents": when off, an intent is named without its numbers. */
  intentNumbers?: boolean;
}

/** The most combat sentences one step says; the rest are in the log. */
const MAX_COMBAT_SENTENCES = 6;

/** The four places, as the live region says them (the Threshold screen's tabs use short forms). */
const THRESHOLD_PLACE_NAMES = { still_shore: 'The Still Shore', gallery: 'The Gallery of Loops', loom: 'The Loom', far_light: 'The Far Light' } as const;

const NARRATED: ReadonlySet<string> = new Set(['narration', 'event', 'system', 'dialogue', 'combat']);

/** The fight's people by uid, with how to speak of them. */
function speakers(events: readonly GameEvent[], state: GameState, content: ContentPack): (uid: string) => { name: string; you: boolean; combatant: Combatant | null } {
  const known = new Map<string, Combatant>();
  for (const c of [...(state.combat?.party ?? []), ...(state.combat?.enemies ?? [])]) known.set(c.uid, c);
  const started = new Map<string, string>();
  for (const e of events) if (e.t === 'combatStarted') for (const en of e.enemies) started.set(en.uid, content.creatures[en.creatureId]?.name ?? 'the enemy');
  return (uid) => {
    const c = known.get(uid) ?? null;
    if (c !== null) return { name: c.name, you: c.kind === 'player', combatant: c };
    return { name: started.get(uid) ?? 'the enemy', you: false, combatant: null };
  };
}

const the = (name: string): string => (/^(the|a|an)\s/i.test(name) ? name : `the ${name}`);
const The = (name: string): string => {
  const t = the(name);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Combat, spoken: one sentence per thing that happened (capped), in the order it happened. */
function combatSentences(events: readonly GameEvent[], state: GameState, content: ContentPack, options: AnnounceOptions): string[] {
  const who = speakers(events, state, content);
  const out: string[] = [];
  const playerUid = state.combat?.party.find((c) => c.kind === 'player')?.uid ?? null;
  let yourTurn = false;
  for (const e of events) {
    switch (e.t) {
      case 'combatStarted': {
        const names = e.enemies.map((en) => content.creatures[en.creatureId]?.name ?? 'an enemy');
        out.push(`${e.ambush ? 'Ambush! ' : ''}A fight begins: ${names.join(', ')}.`);
        break;
      }
      case 'attackResolved':
        if (!e.hit) {
          const from = who(e.sourceUid);
          const to = who(e.targetUid);
          out.push(from.you ? `You miss ${the(to.name)}.` : `${The(from.name)} misses ${to.you ? 'you' : the(to.name)}.`);
        }
        break;
      case 'damageDealt': {
        const from = who(e.sourceUid);
        const to = who(e.targetUid);
        const target = to.you ? 'you' : the(to.name);
        const crit = e.amount > 0 && events.some((x) => x.t === 'attackResolved' && x.sourceUid === e.sourceUid && x.targetUid === e.targetUid && x.crit);
        if (e.kind === 'status') out.push(`${to.you ? 'You take' : `${The(to.name)} takes`} ${e.amount} ${e.damageType} damage.`);
        else if (from.you && e.kind === 'ability') out.push(`${content.abilities[e.refId ?? '']?.name ?? 'Your ability'} hits ${target} for ${e.amount}${crit ? ', a critical hit' : ''}.`);
        else if (from.you) out.push(`You hit ${target} for ${e.amount}${crit ? ', a critical hit' : ''}.`);
        else {
          const move = from.combatant === null || e.refId === null ? undefined : content.creatures[from.combatant.refId]?.moves[e.refId]?.name;
          out.push(`${The(from.name)}${move === undefined ? ' hits' : ` uses ${move} on`} ${target}${move === undefined ? '' : ','} for ${e.amount}${e.mitigated > 0 && to.you ? ` (${e.mitigated} blocked)` : ''}.`);
        }
        break;
      }
      case 'guarded':
        if (who(e.uid).you) out.push('You guard.');
        break;
      case 'healed': {
        const to = who(e.targetUid);
        out.push(`${to.you ? 'You recover' : `${The(to.name)} recovers`} ${e.amount}.`);
        break;
      }
      case 'statusApplied': {
        const to = who(e.targetUid);
        const name = content.statuses[e.statusId]?.name ?? 'a status';
        out.push(`${to.you ? 'You are' : `${The(to.name)} is`} now ${name}.`);
        break;
      }
      case 'combatantDefeated': {
        const name = who(e.uid).combatant?.name ?? content.creatures[e.refId]?.name ?? 'The enemy';
        out.push(`${The(name)} falls.`);
        break;
      }
      case 'bossPhase':
        out.push(e.text);
        break;
      case 'fleeAttempt':
        out.push(e.success ? 'You get away.' : 'You cannot get away.');
        break;
      case 'intentRevealed': {
        const from = who(e.uid);
        if (from.combatant === null || from.combatant.kind !== 'enemy') break;
        if (e.intent.hidden) {
          out.push(`${The(from.name)} readies something unseen.`);
          break;
        }
        const move = content.creatures[from.combatant.refId]?.moves[e.intent.moveId]?.name ?? 'a move';
        const target = e.intent.targetUid === null ? '' : e.intent.targetUid === playerUid ? ', at you' : `, at ${the(who(e.intent.targetUid).name)}`;
        const [lo, hi] = e.intent.projected;
        const numbers = options.intentNumbers === false || hi <= 0 ? '' : `, ${lo === hi ? lo : `${lo} to ${hi}`} damage`;
        out.push(`${The(from.name)} readies ${move}${numbers}${target}.`);
        break;
      }
      case 'turnStarted':
        yourTurn = playerUid !== null && e.uid === playerUid;
        break;
      case 'combatEnded':
        out.push(e.result === 'victory' ? `Victory. ${e.xp} experience, ${e.gold} gold.` : e.result === 'fled' ? 'You got away.' : 'You are defeated.');
        break;
      case 'playerDied':
        out.push('You fall.');
        break;
      default:
        break;
    }
  }
  if (yourTurn && state.combat !== null && state.combat.phase !== 'victory' && state.combat.phase !== 'defeat') out.push('Your turn.');
  return out.length > MAX_COMBAT_SENTENCES ? [...out.slice(0, MAX_COMBAT_SENTENCES - 1), ...out.slice(-1)] : out;
}

export function announceStep(events: readonly GameEvent[], state: GameState, content: ContentPack, options: AnnounceOptions = {}): string | null {
  const parts: string[] = [];
  for (const event of events) {
    switch (event.t) {
      case 'locationEntered': {
        const name = content.locations[event.locationId]?.name ?? event.locationId;
        parts.push(`${name}. Day ${dayOf(state.clock.ticks)}, ${WATCH_NAMES[watchOf(state.clock.ticks)]}.`);
        break;
      }
      case 'log':
        if (NARRATED.has(event.kind)) parts.push(event.text);
        break;
      case 'endingSlide': {
        // U62a: a split build's slide is a text-chunk reference; while its chunk loads the screen's own line says it
        const words = proseText(event.text);
        if (words !== null) parts.push(words);
        break;
      }
      case 'attunementEquipped':
        parts.push(`${content.attunements[event.attunementId]?.name ?? 'Attunement'} ${event.on ? 'equipped' : 'unequipped'}.`);
        break;
      case 'modifierToggled':
        parts.push(`${content.modifiers[event.modifierId]?.name ?? 'Modifier'} ${event.on ? 'on' : 'off'}.`);
        break;
      case 'thresholdEntered':
        // the Still Shore's arrival lines are logged (and so spoken) by the engine; the other places say their name
        if (event.area !== 'still_shore') parts.push(`${THRESHOLD_PLACE_NAMES[event.area]}.`);
        break;
      case 'saveLoaded':
        parts.push('Save loaded.');
        break;
      case 'modeChanged':
        if (event.to === 'title') parts.push('Title screen.');
        break;
      case 'actionRejected':
        parts.push(`That cannot be done: ${event.reason}.`);
        break;
      default:
        break;
    }
  }
  parts.push(...combatSentences(events, state, content, options));
  return parts.length === 0 ? null : parts.join(' ');
}
