// What the Camp panel draws (PLAN §6.3, DESIGN §2.1, §6.3, §10.2, §12; D-059, D-067.14; opened from the Explore screen's
// "Camp" row at any place with a rest spot): the two rests with their time, what they restore and what a bed costs; the
// camp conversation a full rest will open (named only as "something to say", never what it is); who travels with you and who
// could; the camp-fire respec (it lives in the Abilities panel, this points to it); and, from the second loop, *Keep the
// vigil* and *Let go* each behind its question. Every button carries the engine's own reason when it is off. Pure
// functions of the state, the pack and the profile.
import {
  BELL_NAMES,
  CAMP_ACTIONS_FROM_LOOP,
  campProblem,
  campSceneFor,
  checkRespec,
  swapProblem,
  vigilProblem,
  watchOf,
  type Action,
  type ContentPack,
  type GameState,
  type Profile,
} from '@engine/index';
import { arrivalText } from '../screens/exploreModel';
import { notExploring, panelAction, type PanelAction } from './panelAction';

const cap = (s: string): string => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1));
const KIND_LABEL = { camp: 'Camp fire', inn: 'Inn', sanctum: 'Sanctum', wild: 'Wild camp' } as const;

export interface CampModel {
  placeName: string;
  kind: string;
  /** The place's own words for the spot (its `rest.text`), if any. */
  blurb: string | null;
  vitals: { hp: number; hpMax: number; mp: number; mpMax: number; gold: number };
  rests: PanelAction[];
  /** Under each rest, the words about its time and what it restores (same order). */
  restNotes: string[];
  /** "Brak has something to say. It comes after a full rest." / null. */
  conversation: string | null;
  swaps: PanelAction[];
  withYou: string;
  respec: { available: boolean; text: string };
  /** From the second loop at a camp fire. */
  loop: { shown: boolean; note: string; vigil: PanelAction; letGo: PanelAction } | null;
  readOnly: string | null;
}

function restProblem(s: GameState, content: ContentPack, kind: 'short' | 'full', isLegal: (a: Action) => boolean): string | null {
  const rest = content.locations[s.world.currentLocationId]?.rest;
  if (isLegal({ type: 'rest', kind })) return null;
  if (rest === undefined) return 'There is nowhere to rest here.';
  if (s.world.hordeActive) return 'No time for that. You must run!';
  if (kind === 'full' && rest.cost > 0 && s.player.gold < rest.cost) return `A bed here costs ${rest.cost} gold.`;
  return 'You cannot rest here now.';
}

function fullUntil(s: GameState): string {
  const ticks = s.clock.ticks;
  if (s.before !== null) return s.before.day < 3 ? `until ${BELL_NAMES[(s.before.day + 1) as 2 | 3]}` : 'until Last Bell’s dusk';
  return `until ${arrivalText(ticks, 4 - watchOf(ticks))}`;
}

export function campModel(s: GameState, content: ContentPack, profile: Readonly<Profile>, isLegal: (a: Action) => boolean): CampModel | null {
  const loc = content.locations[s.world.currentLocationId];
  const rest = loc?.rest;
  if (loc === undefined || rest === undefined) return null;
  const gate = notExploring(s.mode);
  const ticks = s.clock.ticks;
  const frozen = s.clock.frozen;
  const shortPct = Math.round(content.config.restShortPct * 100);
  const fullPct = Math.round(rest.healPct * 100);

  const shortWhy = gate ?? restProblem(s, content, 'short', isLegal);
  const fullWhy = gate ?? restProblem(s, content, 'full', isLegal);
  const rests: PanelAction[] = [
    panelAction('rest-short', 'Short rest', { type: 'rest', kind: 'short' }, isLegal, shortWhy),
    panelAction('rest-full', rest.kind === 'inn' ? 'Take a bed' : 'Full rest', { type: 'rest', kind: 'full' }, isLegal, fullWhy, { primary: true }),
  ];
  const restNotes = [
    `${frozen ? 'No time passes here' : `1 watch, until ${arrivalText(ticks, 1)}`}. Restores ${shortPct}% of your HP and MP.`,
    `${frozen ? 'The day ends' : `Sleep ${fullUntil(s)}`}. Restores ${fullPct >= 100 ? 'all' : `${fullPct}%`} of your HP and MP${rest.cost > 0 ? `. A bed costs ${rest.cost} gold` : ''}${rest.kind === 'inn' ? '. You wake Rested' : ''}.`,
  ];

  const scene = campSceneFor(s, content, profile);
  const activeId = s.companions.activeId;
  const active = activeId === null ? undefined : content.companions[activeId];
  const activeName = active === undefined ? null : (content.npcs[active.npcId]?.name ?? active.name);
  const conversation =
    scene !== undefined && activeName !== null
      ? `${activeName} has something to say. It comes after a full rest.`
      : activeName !== null
        ? `${activeName} has nothing more to say tonight.`
        : null;

  const swapIds: (string | null)[] = [null, ...Object.keys(s.companions.recruited)];
  const swaps = swapIds
    .filter((id) => id !== activeId && (id !== null || activeId !== null))
    .map((id) => {
      const def = id === null ? undefined : content.companions[id];
      const name = def === undefined ? 'someone' : (content.npcs[def.npcId]?.name ?? def.name);
      return panelAction(`swap-${id ?? 'alone'}`, id === null ? 'Go on alone' : `Travel with ${name}`, { type: 'swapCompanion', companionId: id }, isLegal, gate ?? swapProblem(s, content, profile, id));
    });

  const respecCheck = checkRespec(s, content, profile);
  const respec =
    typeof respecCheck === 'string'
      ? { available: false, text: `${respecCheck}.` }
      : { available: true, text: `You can rethink your path here for ${respecCheck.cost} gold and take back ${respecCheck.plan.refundHalf / 2} ability points.` };

  const camp = campProblem(s, content, profile);
  const showLoop = s.meta.loop >= CAMP_ACTIONS_FROM_LOOP && camp !== 'Only at a camp fire';
  const loop = showLoop
    ? {
        shown: true,
        note: 'The Amulet is warm. You may end the loop here or wait for the last dawn.',
        vigil: panelAction('vigil', 'Keep the vigil', { type: 'keepVigil' }, isLegal, gate ?? vigilProblem(s, content, profile), {
          confirm: 'Keep the vigil? The days pass until the last dawn.',
          yes: 'Keep the vigil',
        }),
        letGo: panelAction('let-go', 'Let go', { type: 'letGo' }, isLegal, gate ?? camp, {
          danger: true,
          confirm: 'Let go? This loop ends here, at once, and earns no Resonance.',
          yes: 'Let go',
        }),
      }
    : null;

  return {
    placeName: loc.name,
    kind: KIND_LABEL[rest.kind],
    blurb: rest.text ?? null,
    vitals: { hp: s.player.hp, hpMax: s.player.hpMax, mp: s.player.mp, mpMax: s.player.mpMax, gold: s.player.gold },
    rests,
    restNotes,
    conversation,
    swaps,
    withYou: activeName === null ? 'You travel alone.' : `${cap(activeName)} travels with you.`,
    respec,
    loop,
    readOnly: gate,
  };
}
