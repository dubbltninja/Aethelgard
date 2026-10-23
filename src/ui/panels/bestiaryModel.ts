// What the Bestiary draws (PLAN §6.3 `BestiaryPanel`, DESIGN §4.2, §16.3 `screen_bestiary`, §17.3; hotkey B): the creatures
// the Wayfinder has met, by family, and for each one what is known and what is not. Knowledge grows with kills (the
// profile's `revealed`: `none` → `resist` → `pattern` → `all`, engine/combat/rewards.ts `revealAt`): seen only (name,
// level, its voiced summary, the moves met in fights), resistances and immunities, its tactics, then every move, its stats
// and its drops. What is unknown is shown as a question mark and, when the next reveal is a kill count away, how many
// kills it takes. Nothing here is hidden knowledge: an unmet creature is not listed at all, and a family appears once one
// of its creatures has been met. Pure functions of the state (for the fight in progress), the pack and the profile.
import type { ContentPack, DamageType, GameState, Profile, Resistance } from '@engine/index';
import type { Creature } from '@schema/creature';
import type { SigilSpec } from '../art/CreatureSigil';
import { DAMAGE_TYPE_NAMES } from '../screens/combatModel';
import { readable } from '../screens/dialogueModel';

type Pr = Readonly<Profile>;
type Reveal = Profile['bestiary'][string]['revealed'];

export const REVEAL_ORDER: readonly Reveal[] = ['none', 'resist', 'pattern', 'all'];
const rank = (r: Reveal): number => REVEAL_ORDER.indexOf(r);

export const KNOWLEDGE_LABELS: Readonly<Record<Reveal, string>> = {
  none: 'Only seen',
  resist: 'Resistances known',
  pattern: 'Tactics known',
  all: 'Fully known',
};

const VOICE_LABELS: Readonly<Record<Creature['bestiary']['voice'], string>> = {
  remnant_archive: 'Remnant Archive',
  ironclad_telling: 'Ironclad Telling',
  weaver_fragment: 'Weaver Fragment',
  wayfinder_notes: 'Wayfinder’s Notes',
};

const ROLE_LABELS: Readonly<Record<string, string>> = { elite: 'Elite', boss: 'Boss', anomaly: 'Anomaly' };

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export const familyName = (familyId: string): string => readable(familyId);

// ---- one creature ----------------------------------------------------------------------------------------------------------

export interface MoveRow {
  id: string;
  known: boolean;
  /** "Maul", or null while unknown. */
  name: string | null;
  /** The telegraph line. */
  line: string | null;
  /** "Physical" for a damaging move. */
  type: string | null;
}

export interface CreatureCard {
  id: string;
  name: string;
  level: number;
  family: string;
  familyName: string;
  rank: string | null;
  sigil: SigilSpec;
  seen: number;
  killed: number;
  spared: number;
  knowledge: Reveal;
  knowledgeLabel: string;
  /** The voice the summary is written in. */
  voice: string;
  voiceId: Creature['bestiary']['voice'];
  summary: string;
  /** From `pattern` on. */
  tactics: string | null;
  /** From `resist` on: "Weak to Fire", "Resists Physical". Null = not yet known. */
  resistances: string[] | null;
  /** From `resist` on: statuses it cannot be given. */
  immunities: string[] | null;
  moves: MoveRow[];
  movesSeen: number;
  /** From `all` on. */
  stats: { label: string; value: string }[] | null;
  drops: string[] | null;
  /** "Defeat it 2 more times to learn its tactics", or null when nothing more can be learned. */
  nextReveal: string | null;
  /** The family's codex entry, if the creature names one. */
  codex: { id: string; title: string; unlocked: boolean } | null;
  /** It stands in the fight on screen. */
  present: boolean;
}

function resistLines(c: Creature): string[] {
  const out: string[] = [];
  for (const [type, level] of Object.entries(c.resistances) as [DamageType, Resistance][]) {
    const name = DAMAGE_TYPE_NAMES[type];
    if (level === 'weak') out.push(`Weak to ${name}`);
    else if (level === 'resist') out.push(`Resists ${name}`);
    else if (level === 'immune') out.push(`Immune to ${name}`);
  }
  return out;
}

const REVEAL_THINGS: Readonly<Record<Exclude<Reveal, 'none'>, string>> = {
  resist: 'resistances',
  pattern: 'tactics',
  all: 'every move, its stats and its drops',
};

function nextRevealText(c: Creature, killed: number, level: Reveal): string | null {
  const next = [...c.bestiary.reveals].sort((a, b) => a.kills - b.kills).find((r) => r.kills > killed && rank(r.reveal) > rank(level));
  if (next === undefined) return null;
  const more = next.kills - killed;
  return `Defeat it ${more === 1 ? 'once more' : `${more} more times`} to learn its ${REVEAL_THINGS[next.reveal]}.`;
}

/** What the profile (or, for a creature in the fight on screen with no entry yet, its family) says is revealed. */
export function knowledgeOf(content: ContentPack, profile: Pr, creatureId: string): Reveal {
  const entry = profile.bestiary[creatureId];
  if (entry !== undefined) return entry.revealed;
  const family = content.creatures[creatureId]?.family;
  const familyKnown = Object.entries(profile.bestiary).some(([id, e]) => e.killed > 0 && content.creatures[id]?.family === family);
  return familyKnown ? 'resist' : 'none';
}

export function creatureCard(content: ContentPack, profile: Pr, creatureId: string, present = false): CreatureCard | null {
  const c = content.creatures[creatureId];
  if (c === undefined) return null;
  const entry = profile.bestiary[creatureId];
  const seen = entry?.seen ?? 0;
  const killed = entry?.killed ?? 0;
  const knowledge = knowledgeOf(content, profile, creatureId);
  const intentsSeen = entry?.intentsSeen ?? [];
  const all = rank(knowledge) >= rank('all');
  const moves: MoveRow[] = Object.entries(c.moves).map(([id, move]) => {
    const known = all || intentsSeen.includes(id);
    return {
      id,
      known,
      name: known ? move.name : null,
      line: known ? move.line : null,
      type: known && move.type !== undefined && move.power !== undefined ? DAMAGE_TYPE_NAMES[move.type] : null,
    };
  });
  const codexId = c.bestiary.codexId;
  const codexDef = codexId === undefined ? undefined : content.codex[codexId];
  const statusName = (id: string): string => content.statuses[id]?.name ?? readable(id.replace(/^status_/, ''));
  return {
    id: c.id,
    name: c.name,
    level: c.level,
    family: c.family,
    familyName: familyName(c.family),
    rank: ROLE_LABELS[c.role] ?? null,
    sigil: c.sigil,
    seen,
    killed,
    spared: entry?.spared ?? 0,
    knowledge,
    knowledgeLabel: KNOWLEDGE_LABELS[knowledge],
    voice: VOICE_LABELS[c.bestiary.voice],
    voiceId: c.bestiary.voice,
    summary: c.bestiary.summary,
    tactics: rank(knowledge) >= rank('pattern') ? (c.bestiary.tactics ?? null) : null,
    resistances: rank(knowledge) >= rank('resist') ? resistLines(c) : null,
    immunities: rank(knowledge) >= rank('resist') ? c.statusImmunities.map(statusName) : null,
    moves,
    movesSeen: moves.filter((m) => m.known).length,
    stats: all
      ? [
          { label: 'Health', value: String(c.stats.hp) },
          { label: 'Armor', value: String(c.stats.armor) },
          { label: 'Ward', value: String(c.stats.ward) },
          { label: 'Agility', value: String(c.stats.agi) },
        ]
      : null,
    drops: all ? c.loot.map((l) => content.items[l.itemId]?.name ?? l.itemId).filter((name, i, a) => a.indexOf(name) === i) : null,
    nextReveal: nextRevealText(c, killed, knowledge),
    codex: codexDef === undefined ? null : { id: codexDef.id, title: codexDef.title, unlocked: profile.codexUnlocked.includes(codexDef.id) || codexDef.unlockedAtStart },
    present,
  };
}

// ---- the list ----------------------------------------------------------------------------------------------------------------

export interface CreatureRow {
  id: string;
  name: string;
  level: number;
  killed: number;
  present: boolean;
}

export interface FamilyGroup {
  id: string;
  name: string;
  /** Creatures of the family the Wayfinder has met. */
  known: number;
  /** Creatures of the family in the game. */
  total: number;
  creatures: CreatureRow[];
}

export interface BestiaryModel {
  families: FamilyGroup[];
  cards: Record<string, CreatureCard>;
  /** "7 of 73 creatures met". */
  summary: string;
  /** The first creature to show: one in the fight on screen, else the first listed. */
  firstId: string | null;
}

/** Whether the profile has met `creatureId` (seen, killed or spared once). */
export const isMet = (profile: Pr, creatureId: string): boolean => {
  const e = profile.bestiary[creatureId];
  return e !== undefined && (e.seen > 0 || e.killed > 0 || e.spared > 0);
};

/** The creatures standing in the fight on screen (they are listed before they are recorded). */
export function presentIds(state: GameState): string[] {
  return [...new Set((state.combat?.enemies ?? []).filter((e) => !e.fledOrGone).map((e) => e.refId))];
}

export function bestiaryModel(state: GameState, content: ContentPack, profile: Pr): BestiaryModel {
  const present = new Set(presentIds(state));
  const met = Object.values(content.creatures).filter((c): c is Creature => c !== undefined && (isMet(profile, c.id) || present.has(c.id)));
  const totals = new Map<string, number>();
  for (const c of Object.values(content.creatures)) if (c !== undefined) totals.set(c.family, (totals.get(c.family) ?? 0) + 1);
  const byFamily = new Map<string, Creature[]>();
  for (const c of met) byFamily.set(c.family, [...(byFamily.get(c.family) ?? []), c]);
  const byName = (a: { name: string; level: number }, b: { name: string; level: number }): number => a.level - b.level || a.name.localeCompare(b.name);
  const families: FamilyGroup[] = [...byFamily.entries()]
    .map(([id, list]) => ({
      id,
      name: familyName(id),
      known: list.length,
      total: totals.get(id) ?? list.length,
      creatures: list
        .map((c) => ({ id: c.id, name: c.name, level: c.level, killed: profile.bestiary[c.id]?.killed ?? 0, present: present.has(c.id) }))
        .sort(byName),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cards: Record<string, CreatureCard> = {};
  for (const c of met) {
    const card = creatureCard(content, profile, c.id, present.has(c.id));
    if (card !== null) cards[c.id] = card;
  }
  const firstPresent = families.flatMap((f) => f.creatures).find((c) => c.present);
  const first = firstPresent ?? families[0]?.creatures[0];
  const total = Object.keys(content.creatures).length;
  return {
    families,
    cards,
    summary: met.length === 0 ? 'No creature met yet.' : `${plural(met.length, 'creature')} met of ${total}`,
    firstId: first?.id ?? null,
  };
}
