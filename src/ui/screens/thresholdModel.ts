// What the Threshold screen shows (DESIGN §10.6–10.9, §15.1, §16.3 `screen_threshold_*`; WORLD §3.12; D-083, U68): four places,
// one at a time —
//   the Still Shore   who is there, to talk to; the last loop in a line; the shore's own lines
//   the Gallery       one card per loop (the run records), the seven marks, and the Archive: the Echoes held, by kind
//   the Loom          Resonance, the Attunements (buy · equip · unpick) in five slots, the challenge modifiers, New Game+
//   the Far Light     the class to wake as, its kit and mastery, what the loop will carry, and *Step into the light*
// Every button is a `PanelAction`: the engine action it sends, whether it is on, and — when it is off — the engine's own
// rejection text (`spendProblem`, `equipProblem` …), so the screen never invents a rule. Pure functions of the state, the pack
// and the profile.
import {
  THRESHOLD_AREAS,
  boughtThisVisit,
  chooseClassProblem,
  chosenClass,
  equipProblem,
  newGamePlusProblem,
  newLoopProblem,
  npcsAt,
  refundProblem,
  resonanceMultiplier,
  spendProblem,
  talkProblem,
  thresholdArea,
  thresholdLocationId,
  toggleProblem,
  MODIFIER_RESONANCE_MULT,
  type Action,
  type ContentPack,
  type GameState,
  type Profile,
  type ThresholdArea,
} from '@engine/index';
import { ECHO_CATEGORIES } from '@schema/echo';
import { panelAction, type PanelAction } from '../panels/panelAction';
import type { TabItem } from '../components/lore/Tabs';
import { classOption, type ClassOption } from './classOptions';
import { cap, classNameOf, idWords, outcomeText, plural, TYRANT_WORDS, type OutcomeText } from './runSummaryModel';

export type IsLegal = (a: Action) => boolean;

// ---- the four places -----------------------------------------------------------------------------------------------------------

export const PLACE_LABELS: Readonly<Record<ThresholdArea, string>> = {
  still_shore: 'Still Shore',
  gallery: 'Gallery',
  loom: 'Loom',
  far_light: 'Far Light',
};

/** DESIGN §10.8's order, as tabs (←/→ between them). */
export function placeTabs(): TabItem<ThresholdArea>[] {
  return THRESHOLD_AREAS.map((id) => ({ id, label: PLACE_LABELS[id] }));
}

export interface ThresholdHeader {
  area: ThresholdArea;
  locationId: string;
  placeName: string;
  description: string;
  /** The loop the Far Light opens. */
  nextLoop: number;
  resonance: number;
}

export function thresholdHeader(s: GameState, content: ContentPack, profile: Readonly<Profile>): ThresholdHeader {
  const locationId = thresholdLocationId(s);
  const loc = content.locations[locationId];
  const area = thresholdArea(s);
  return {
    area,
    locationId,
    placeName: loc?.name ?? PLACE_LABELS[area],
    description: loc?.description ?? '',
    nextLoop: s.meta.loop,
    resonance: profile.resonance,
  };
}

// ---- the Still Shore -----------------------------------------------------------------------------------------------------------

export interface ShorePerson {
  id: string;
  name: string;
  role: string | null;
  talk: PanelAction;
}

export interface ShoreEcho {
  id: string;
  name: string;
  codexLine: string;
}

export interface ShoreModel {
  /** How the Wayfinder came: "The Fall · Let go", "The Warden's Vigil". */
  came: OutcomeText | null;
  /** The record's one line ("Loop 2 · Ranger · Fall (released) · Day 1"). */
  summary: string | null;
  echoes: ShoreEcho[];
  lines: { key: string; text: string }[];
  people: ShorePerson[];
  /** "You carry 3 glimpses of the Tyrant." (DESIGN §10.8), or null. */
  glimpses: string | null;
  canSummary: boolean;
}

export function shoreModel(s: GameState, content: ContentPack, profile: Readonly<Profile>, isLegal: IsLegal): ShoreModel {
  const record = profile.runHistory[profile.runHistory.length - 1] ?? null;
  const pending = s.pendingEnding;
  const came = pending !== null ? outcomeText(pending.outcome, pending.reason, content) : record === null ? null : outcomeText(record.outcome, record.reason, content);
  const people = npcsAt(s, content, profile, thresholdLocationId(s)).map((id): ShorePerson => {
    const npc = content.npcs[id];
    const name = npc?.name ?? id;
    const role = npc?.roles[0];
    return {
      id,
      name,
      role: role === undefined ? null : cap(role),
      talk: panelAction(`talk-${id}`, `Talk to ${name}`, { type: 'talk', npcId: id }, isLegal, talkProblem(s, content, profile, id)),
    };
  });
  const glimpseCount = profile.echoes.filter((id) => id.startsWith('echo_tyrant_')).length;
  const from = Math.max(0, s.recentLog.length - 7);
  return {
    came,
    summary: record?.summary ?? null,
    echoes: (record?.echoesGained ?? []).map((id) => ({ id, name: content.echoes[id]?.name ?? idWords(id), codexLine: content.echoes[id]?.codexLine ?? '' })),
    lines: s.recentLog.slice(from).map((e, i) => ({ key: `${e.step}:${from + i}`, text: e.text })),
    people,
    glimpses: glimpseCount === 0 ? null : `You carry ${plural(glimpseCount, 'glimpse')} of the Tyrant.`,
    canSummary: record !== null,
  };
}

// ---- the Gallery of Loops ----------------------------------------------------------------------------------------------------

export interface LoopGlyph {
  id: string;
  /** A short mark; always paired with its words. */
  mark: string;
  text: string;
}

export interface LoopCard {
  key: string;
  loop: number;
  className: string;
  classId: string;
  days: number;
  level: number;
  outcome: OutcomeText;
  glyphs: LoopGlyph[];
  echoCount: number;
  questCount: number;
  summary: string;
}

export interface MarksModel {
  /** Seven frames, each scratched once the quest has shown them. */
  frames: { n: number; marked: boolean }[];
  text: string;
}

export interface ArchiveGroup {
  category: string;
  label: string;
  echoes: ShoreEcho[];
}

export interface GalleryModel {
  cards: LoopCard[];
  marks: MarksModel | null;
  /** "Endings reached: 2 of 6" and what the profile still lacks for the ones it has not met (names kept back). */
  endings: { reached: number; total: number; hints: string[] };
  archive: { held: number; total: number; groups: ArchiveGroup[] };
  achievements: { earned: number; total: number };
}

export const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  lore: 'Lore',
  route: 'Ways opened',
  shortcut: 'Shortcuts',
  dialogue: 'Things said',
  ending: 'Endings',
  character: 'People',
  secret: 'Secrets',
};

const MARKS_QUEST = 'q_seven_marks';
const MARKS_ECHO = 'echo_seven_wayfinders';

export function marksModel(s: GameState, profile: Readonly<Profile>): MarksModel | null {
  const quest = s.quests[MARKS_QUEST];
  const held = profile.echoes.includes(MARKS_ECHO) || s.echoesThisLoop.includes(MARKS_ECHO);
  if (quest === undefined && !held && !profile.discoveries.includes(`quest:${MARKS_QUEST}`)) return null;
  const seen = held || quest?.status === 'completed' || (quest !== undefined && quest.stage !== 'six_known');
  return {
    frames: Array.from({ length: 7 }, (_, i) => ({ n: i + 1, marked: seen })),
    text: seen
      ? 'Seven frames carry a scratch in the gilt, low on the left, where a hand would rest. The same hand.'
      : 'The first seven frames hang a little apart from the rest. Something about them asks to be looked at closely.',
  };
}

/** A loop's key choices as marks with words (DESIGN §10.8: "key choices as glyphs"): the Tyrant, the Heartstone, the modifiers. */
export function recordGlyphs(r: Profile['runHistory'][number], content: ContentPack): LoopGlyph[] {
  const glyphs: LoopGlyph[] = [];
  if (r.tyrant !== 'untouched') glyphs.push({ id: 'tyrant', mark: r.tyrant === 'spared' ? '☾' : '⚔', text: `Tyrant: ${TYRANT_WORDS[r.tyrant]}` });
  if (r.heartstone !== 'intact') glyphs.push({ id: 'heartstone', mark: '◆', text: `Heartstone: ${idWords(r.heartstone)}` });
  for (const id of r.modifiers) glyphs.push({ id, mark: '▲', text: content.modifiers[id]?.name ?? idWords(id) });
  return glyphs;
}

function loopCard(r: Profile['runHistory'][number], content: ContentPack): LoopCard {
  const glyphs = recordGlyphs(r, content);
  return {
    key: r.runId,
    loop: r.loop,
    className: classNameOf(content, r.classId),
    classId: r.classId,
    days: r.daysUsed,
    level: r.level,
    outcome: outcomeText(r.outcome, r.reason, content),
    glyphs,
    echoCount: r.echoesGained.length,
    questCount: r.questsCompleted.length,
    summary: r.summary,
  };
}

/** Hints for the endings the profile has not reached: only what the profile itself can answer (an Echo it lacks). */
export function endingHints(content: ContentPack, profile: Readonly<Profile>): string[] {
  const out: string[] = [];
  for (const def of Object.values(content.endings)) {
    if (def === undefined || def.kind !== 'true' || profile.endingsReached.includes(def.id)) continue;
    for (const t of def.requirementTexts) {
      const w = t.when;
      if ('not' in w && 'echo' in w.not && !profile.echoes.includes(w.not.echo) && !out.includes(t.text)) out.push(t.text);
    }
  }
  return out;
}

export function galleryModel(s: GameState, content: ContentPack, profile: Readonly<Profile>): GalleryModel {
  const held = [...new Set([...profile.echoes, ...s.echoesThisLoop])];
  const groups: ArchiveGroup[] = ECHO_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? idWords(category),
    echoes: held
      .filter((id) => content.echoes[id]?.category === category)
      .map((id) => ({ id, name: content.echoes[id]?.name ?? id, codexLine: content.echoes[id]?.codexLine ?? '' }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  })).filter((g) => g.echoes.length > 0);
  const trueEndings = Object.values(content.endings).filter((e) => e?.kind === 'true').length;
  return {
    cards: profile.runHistory.map((r) => loopCard(r, content)),
    marks: marksModel(s, profile),
    endings: { reached: profile.endingsReached.length, total: trueEndings, hints: profile.endingsReached.length >= trueEndings ? [] : endingHints(content, profile) },
    archive: { held: held.length, total: Object.keys(content.echoes).length, groups },
    achievements: { earned: Object.keys(profile.achievements).length, total: Object.keys(content.achievements).length },
  };
}

// ---- the Loom ----------------------------------------------------------------------------------------------------------------------

export type AttunementState = 'equipped' | 'owned' | 'available' | 'short' | 'locked';

export interface AttunementRow {
  id: string;
  name: string;
  description: string;
  cost: number;
  state: AttunementState;
  /** "Equipped", "Owned", "Costs 40 — you have 16". */
  stateText: string;
  /** What it asks for besides Resonance (its `requires`), when unmet. */
  needs: string | null;
  buy: PanelAction | null;
  equip: PanelAction | null;
  /** Only an Attunement woven during this visit can be unpicked. */
  unpick: PanelAction | null;
}

export interface ModifierRow {
  id: string;
  name: string;
  description: string;
  multiplier: number;
  multText: string;
  on: boolean;
  toggle: PanelAction;
}

export interface LoomModel {
  resonance: number;
  spentThisVisit: number;
  cap: number;
  slots: ({ id: string; name: string } | null)[];
  attunements: AttunementRow[];
  modifiers: ModifierRow[];
  /** All toggled modifiers together (capped at ×3). */
  totalMultiplier: number;
  totalText: string;
  /** Iron Loop on: the slots will be empty in the loop. */
  ironLoop: boolean;
  newGamePlus: PanelAction | null;
}

export const multText = (m: number): string => `×${Number.isInteger(m) ? m.toFixed(1) : String(m)}`;

export function loomModel(s: GameState, content: ContentPack, profile: Readonly<Profile>, isLegal: IsLegal): LoomModel {
  const att = profile.attunements;
  const bought = new Set(boughtThisVisit(s, content, profile));
  const capSlots = content.config.attunementEquipCap;
  const rows = Object.values(content.attunements)
    .filter((a): a is NonNullable<typeof a> => a !== undefined)
    .map((a): AttunementRow => {
      const owned = att.owned.includes(a.id);
      const equipped = att.equipped.includes(a.id);
      const why = owned ? null : spendProblem(s, content, profile, a.id);
      const short = !owned && profile.resonance < a.cost;
      const state: AttunementState = equipped ? 'equipped' : owned ? 'owned' : why === null ? 'available' : short ? 'short' : 'locked';
      const needs = !owned && why !== null && !short && why.startsWith(`${a.name} needs `) ? why.slice(a.name.length + 7) : null;
      const stateText = equipped
        ? 'Equipped'
        : owned
          ? 'Owned'
          : short
            ? `Costs ${a.cost}; you have ${profile.resonance}`
            : needs !== null
              ? `Needs ${needs}`
              : `Costs ${a.cost}`;
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        cost: a.cost,
        state,
        stateText,
        needs,
        buy: owned ? null : panelAction(`buy-${a.id}`, `Weave ${a.name} (${a.cost})`, { type: 'thresholdSpend', attunementId: a.id }, isLegal, why),
        equip: owned
          ? equipped
            ? panelAction(`unequip-${a.id}`, `Unequip ${a.name}`, { type: 'equipAttunement', attunementId: a.id, on: false }, isLegal, equipProblem(s, content, profile, a.id, false))
            : panelAction(`equip-${a.id}`, `Equip ${a.name}`, { type: 'equipAttunement', attunementId: a.id, on: true }, isLegal, equipProblem(s, content, profile, a.id, true))
          : null,
        unpick: bought.has(a.id)
          ? panelAction(`unpick-${a.id}`, `Unpick ${a.name}`, { type: 'thresholdRefund', attunementId: a.id }, isLegal, refundProblem(s, content, profile, a.id))
          : null,
      };
    });
  const slots = Array.from({ length: capSlots }, (_, i) => {
    const id = att.equipped[i];
    return id === undefined ? null : { id, name: content.attunements[id]?.name ?? idWords(id) };
  });
  const modifiers = Object.values(content.modifiers)
    .filter((m): m is NonNullable<typeof m> => m !== undefined)
    .map((m): ModifierRow => {
      const on = profile.modifiers[m.id] === true;
      const mult = MODIFIER_RESONANCE_MULT[m.id] ?? 1;
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        multiplier: mult,
        multText: multText(mult),
        on,
        toggle: panelAction(`toggle-${m.id}`, on ? `Turn off ${m.name}` : `Turn on ${m.name}`, { type: 'toggleModifier', modifierId: m.id }, isLegal, toggleProblem(s, content, m.id)),
      };
    });
  const active = modifiers.filter((m) => m.on).map((m) => m.id);
  const total = resonanceMultiplier(active);
  const ngWhy = newGamePlusProblem(s, profile);
  return {
    resonance: profile.resonance,
    spentThisVisit: s.threshold?.spentThisVisit ?? 0,
    cap: capSlots,
    slots,
    attunements: rows,
    modifiers,
    totalMultiplier: total,
    totalText: active.length === 0 ? 'No modifiers: ×1.0' : `All together: ${multText(total)}${total >= 3 ? ' (the most there is)' : ''}`,
    ironLoop: profile.modifiers['mod_iron_loop'] === true,
    newGamePlus:
      profile.endingsReached.length === 0
        ? null
        : panelAction('new-game-plus', 'Begin New Game+', { type: 'newGamePlus' }, isLegal, ngWhy, {
            danger: true,
            confirm:
              'Begin New Game+? You keep every Echo, the codex, your achievements and your settings. Resonance, Attunements, class mastery, the bestiary, the map and your run history start over.',
            yes: 'Begin New Game+',
          }),
  };
}

// ---- the Far Light -----------------------------------------------------------------------------------------------------------

export interface ClassChoice {
  id: string;
  name: string;
  title: string;
  hp: number;
  mp: number;
  resourceName: string;
  chosen: boolean;
  /** The class just played (the choice that needs no change). */
  justPlayed: boolean;
  mastery: { mastered: number; total: number; loops: number; bestLevel: number; endings: number };
  pick: PanelAction;
}

export interface FarLightModel {
  nextLoop: number;
  choices: ClassChoice[];
  detail: ClassOption | null;
  /** Attunements that will be carried (empty under Iron Loop). */
  carried: string[];
  idle: string[];
  modifiers: string[];
  ironLoop: boolean;
  multText: string | null;
  begin: PanelAction;
}

export function farLightModel(s: GameState, content: ContentPack, profile: Readonly<Profile>, isLegal: IsLegal): FarLightModel {
  const chosen = chosenClass(s);
  const played = s.player.classId;
  const choices = Object.values(content.classes)
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map((c): ClassChoice => {
      const m = profile.classMastery[c.id];
      const option = classOption(c, content, profile);
      return {
        id: c.id,
        name: c.name,
        title: c.title,
        hp: option.hp,
        mp: option.mp,
        resourceName: option.resourceName,
        chosen: c.id === chosen,
        justPlayed: c.id === played,
        mastery: {
          mastered: m?.mastered.length ?? 0,
          total: content.index.abilitiesByClass[c.id]?.length ?? 15,
          loops: m?.loopsPlayed ?? 0,
          bestLevel: m?.bestLevel ?? 0,
          endings: m?.endings.length ?? 0,
        },
        pick: panelAction(`class-${c.id}`, c.id === chosen ? `${c.name} (chosen)` : `Wake as ${c.name}`, { type: 'chooseClass', classId: c.id }, isLegal, chooseClassProblem(s, content, c.id)),
      };
    });
  const iron = profile.modifiers['mod_iron_loop'] === true;
  const equipped = profile.attunements.equipped.map((id) => content.attunements[id]?.name ?? idWords(id));
  const active = Object.keys(profile.modifiers).filter((id) => profile.modifiers[id] === true);
  const cls = content.classes[chosen];
  return {
    nextLoop: s.meta.loop,
    choices,
    detail: cls === undefined ? null : classOption(cls, content, profile),
    carried: iron ? [] : equipped,
    idle: iron ? equipped : [],
    modifiers: active.map((id) => content.modifiers[id]?.name ?? idWords(id)),
    ironLoop: iron,
    multText: active.length === 0 ? null : multText(resonanceMultiplier(active)),
    begin: panelAction('begin-loop', `Step into the light: begin Loop ${s.meta.loop}`, { type: 'newLoop' }, isLegal, newLoopProblem(s), { primary: true }),
  };
}
