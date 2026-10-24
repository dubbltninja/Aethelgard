// What the Ending screen shows (DESIGN §10.2, §16.3 `screen_ending`; STORY §10, D-100, U68): the pending outcome's slides one at a
// time — the record's sequence, then the epilogues whose condition holds — then the Run Summary, then on: to the Threshold, to
// Loop 2 Day 1 after the first loop's closer (D-049), and to New Game+ where a true ending offers it (D-021). The engine owns the
// slide index (`pendingEnding.slideIndex`, `acknowledgeEnding`); the screen only adds one step of its own — the summary after
// the last slide — which is local view state, never engine state. Pure functions of the state, the pack and the profile.
import { endingSlides, evaluate, type Action, type ContentPack, type GameState, type Profile } from '@engine/index';
import { panelAction, type PanelAction } from '../panels/panelAction';
import { cap, factionName, idWords, outcomeText, type OutcomeText } from './runSummaryModel';

export type SlideKind = 'lead' | 'scene' | 'epilogue';

export interface EndingSlide {
  text: string;
  kind: SlideKind;
  /** "Epilogue · Brak" for an epilogue with a subject; null otherwise. */
  label: string | null;
  /** The record's `art` / `mood` keys, for the backdrop's tone. */
  mood: string | null;
}

/** Who an epilogue is about: a companion's or person's name, a faction's, else null (`world` and the like). */
function subjectName(subject: string, content: ContentPack): string | null {
  if (subject === 'world') return 'The world';
  const npc = content.npcs[`npc_${subject}`]?.name;
  if (npc !== undefined) return npc;
  const companion = content.companions[subject];
  if (companion !== undefined) return content.npcs[companion.npcId]?.name ?? companion.name;
  if (subject === 'remnants' || subject === 'weavers' || subject === 'ironclad') return factionName(content, subject);
  return content.locations[subject]?.name ?? (subject.includes('_') ? idWords(subject) : cap(subject));
}

/** The slides with their kinds. Its texts are exactly the engine's `endingSlides` (a test holds the two together). */
export function endingSlideList(s: GameState, content: ContentPack, profile: Readonly<Profile>): EndingSlide[] {
  const pending = s.pendingEnding;
  if (pending === null) return [];
  const texts = endingSlides(s, content, profile);
  const def = content.endings[pending.outcome];
  if (def === undefined) {
    // No record in the pack: the engine's own lines (a closer's last threshold, then the shear)
    return texts.map((text, i) => ({ text, kind: i === 0 ? 'lead' : 'scene', label: null, mood: null }));
  }
  const lead = pending.outcome === 'closer_fall' ? 1 : 0;
  const out: EndingSlide[] = [];
  if (lead === 1) out.push({ text: texts[0] ?? '', kind: 'lead', label: null, mood: null });
  for (const seq of def.sequence) out.push({ text: seq.text, kind: 'scene', label: null, mood: seq.mood ?? seq.art ?? null });
  for (const ep of def.epilogues) {
    if (ep.when !== undefined && !evaluate(ep.when, s, profile, content)) continue;
    const who = subjectName(ep.subject, content);
    out.push({ text: ep.text, kind: 'epilogue', label: who === null ? 'Epilogue' : `Epilogue · ${who}`, mood: null });
  }
  return out;
}

export type EndingPhase = 'slides' | 'summary';

export interface EndingModel {
  outcome: OutcomeText;
  /** The letter of a true ending ("Ending A"), else null. */
  letter: string | null;
  index: number;
  total: number;
  slide: EndingSlide;
  last: boolean;
  /** "a game by Tim Dibert" under the last slide of a true ending (D-027). */
  credits: boolean;
  /** Where Continue leads after the summary: the Threshold, or Loop 2 Day 1 after Loop 1. */
  onward: { label: string; note: string };
  /** The button of the slides step. */
  next: { label: string };
  /** New Game+ (true endings only), when the engine offers it. */
  newGamePlus: PanelAction | null;
  /** The engine's `acknowledgeEnding`, enabled when legal. */
  advance: PanelAction;
}

export function endingModel(s: GameState, content: ContentPack, profile: Readonly<Profile>, isLegal: (a: Action) => boolean): EndingModel | null {
  const pending = s.pendingEnding;
  if (pending === null) return null;
  const slides = endingSlideList(s, content, profile);
  if (slides.length === 0) return null;
  const index = Math.min(Math.max(0, pending.slideIndex), slides.length - 1);
  const slide = slides[index] as EndingSlide;
  const def = content.endings[pending.outcome];
  const last = index === slides.length - 1;
  const firstLoop = s.meta.loop === 1;
  const ng = panelAction(
    'new-game-plus',
    'Begin New Game+',
    { type: 'newGamePlus' },
    isLegal,
    isLegal({ type: 'newGamePlus' }) ? null : 'New Game+ follows a true ending.',
    {
      danger: true,
      confirm: 'Begin New Game+? You keep every Echo, the codex, your achievements and settings. Resonance, Attunements, mastery, the bestiary, the map and your run history start over.',
      yes: 'Begin New Game+',
    },
  );
  return {
    outcome: outcomeText(pending.outcome, pending.reason, content),
    letter: def?.letter === undefined ? null : `Ending ${def.letter}`,
    index,
    total: slides.length,
    slide,
    last,
    credits: last && def?.credits === true,
    onward: firstLoop
      ? { label: 'Wake in Loop 2', note: 'The Amulet is warm against your throat. The first loop is over; the second begins at dawn.' }
      : { label: 'On to the Threshold', note: 'The Still Shore waits.' },
    next: { label: last ? 'See how the loop went' : 'Continue' },
    newGamePlus: isLegal({ type: 'newGamePlus' }) ? ng : null,
    advance: panelAction('advance', 'Continue', { type: 'acknowledgeEnding' }, isLegal, null, { primary: true }),
  };
}
