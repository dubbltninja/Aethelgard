// Which engine events become toasts, and what they say (DESIGN §16.7 and the event list of §10.6 / §13: "Effects … emit an
// `events[]` entry the UI renders (toasts, log lines, Echo fanfare)"; U70). Pure: events + the pack → `ToastSpec`s that the
// queue (toastQueue.ts) merges and times. The log keeps the long form; a toast is a few words.
//
//   reputationChanged   "Remnants reputation +5", and "Remnants: now Trusted" when the tier moved
//   resonanceGained     "Resonance +25 ◇"
//   echoGained          "Echo gained: Name"
//   levelUp             "Level 3: 1 stat point to spend"
//   questStarted / questAdvanced / questCompleted / questFailed
//   itemTaken / itemGiven   "Picked up Name", "Received Name ×2"
//   achievementUnlocked "Achievement: Name"
//   clockWarning        Loop 2+ only: "Ten dawns remain." (Loop 1's warnings are spoken by NPCs, DESIGN §10.1)
import type { ContentPack, GameEvent } from '@engine/index';
import type { ToastSpec } from './toastQueue';

const NUMBER_WORDS: Readonly<Record<number, string>> = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine' };

/** `lone_wolf` → "Lone wolf": the fallback when the pack has no name for an id. */
function readable(id: string): string {
  const words = id.replace(/^[a-z]+_/, '').split('_').filter((w) => w !== '');
  const text = words.join(' ');
  return text === '' ? id : text.charAt(0).toUpperCase() + text.slice(1);
}

const capital = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** The Breach Clock's spoken warnings (Loop 2+). */
export function warningLine(dawns: number): string {
  if (dawns === 10) return 'Ten dawns remain.';
  if (dawns === 1) return 'One dawn.';
  return `${NUMBER_WORDS[dawns] ?? dawns} dawns.`;
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The toasts one step's events call for, in order. `loop` is the run's loop number after the step. */
export function toastsFor(events: readonly GameEvent[], content: ContentPack, loop: number): ToastSpec[] {
  const out: ToastSpec[] = [];
  for (const event of events) {
    switch (event.t) {
      case 'reputationChanged': {
        const name = content.factions[event.faction]?.name ?? readable(event.faction);
        if (event.delta !== 0) out.push({ key: `rep:${event.faction}`, label: `${name} reputation`, tone: 'info', amount: event.delta });
        if (event.tierAfter !== event.tierBefore) {
          out.push({ key: `tier:${event.faction}:${event.tierAfter}`, label: `${name}: now ${capital(event.tierAfter)}`, tone: 'gain' });
        }
        break;
      }
      case 'resonanceGained':
        if (event.amount !== 0) out.push({ key: 'resonance', label: 'Resonance', tone: 'gain', amount: event.amount, unit: ' ◇' });
        break;
      case 'echoGained': {
        const name = content.echoes[event.echoId]?.name ?? readable(event.echoId);
        out.push({ key: `echo:${event.echoId}`, label: `Echo gained: ${name}`, tone: 'gain' });
        break;
      }
      case 'levelUp': {
        const points = event.statPoints > 0 ? `: ${plural(event.statPoints, 'stat point')} to spend` : '';
        out.push({ key: 'level', label: `Level ${event.level}${points}`, tone: 'gain' });
        break;
      }
      case 'questStarted':
        out.push({ key: `quest:${event.questId}:start`, label: `New quest: ${content.quests[event.questId]?.name ?? readable(event.questId)}`, tone: 'info' });
        break;
      case 'questAdvanced':
        out.push({ key: `quest:${event.questId}:advance`, label: `Quest updated: ${content.quests[event.questId]?.name ?? readable(event.questId)}`, tone: 'info' });
        break;
      case 'questCompleted':
        out.push({ key: `quest:${event.questId}:done`, label: `Quest complete: ${content.quests[event.questId]?.name ?? readable(event.questId)}`, tone: 'success' });
        break;
      case 'questFailed':
        out.push({ key: `quest:${event.questId}:failed`, label: `Quest failed: ${content.quests[event.questId]?.name ?? readable(event.questId)}`, tone: 'warn' });
        break;
      case 'itemTaken':
      case 'itemGiven': {
        const name = content.items[event.item.itemId]?.name ?? readable(event.item.itemId);
        out.push({ key: `item:${event.item.itemId}`, label: `${event.t === 'itemTaken' ? 'Picked up' : 'Received'} ${name}`, tone: 'success', amount: event.item.qty, format: 'times' });
        break;
      }
      case 'achievementUnlocked':
        out.push({ key: `achievement:${event.achievementId}`, label: `Achievement: ${content.achievements[event.achievementId]?.name ?? readable(event.achievementId)}`, tone: 'gain' });
        break;
      case 'clockWarning':
        if (loop >= 2) out.push({ key: `clock:${event.daysLeft}`, label: warningLine(event.daysLeft), tone: 'warn' });
        break;
      default:
        break;
    }
  }
  return out;
}
