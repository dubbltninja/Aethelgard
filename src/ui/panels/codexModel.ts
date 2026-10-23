// What the Codex draws (PLAN §6.3 `CodexPanel`, DESIGN §16.3 `screen_codex`, STORY §14; hotkey C): the entries the profile
// has unlocked, by category and by voice (D-020: the Remnant Archive, the Ironclad Telling, the Weaver Fragments and the
// Wayfinder's Notes each read differently), the ones not yet found as silhouettes with a hint that spoils nothing, which
// are new, where an opened entry came from, and the entries it points to. An entry is unlocked when the profile lists it
// (the `unlockCodex` effect, which Echoes and scenes apply) or the content marks it unlocked at the start; `unlockWhen`
// is documentation of the trigger and is read only to word the source and the hint. Pure.
import type { ContentPack, Profile } from '@engine/index';
import type { Condition } from '@schema/condition';
import { CODEX_CATEGORIES, type CodexEntry } from '@schema/codex';

type Pr = Readonly<Profile>;
export type Voice = CodexEntry['voice'];
export type Category = CodexEntry['category'];

export const VOICE_IDS: readonly Voice[] = ['remnant_archive', 'ironclad_telling', 'weaver_fragment', 'wayfinder_notes'];

export const VOICE_LABELS: Readonly<Record<Voice, string>> = {
  remnant_archive: 'Remnant Archive',
  ironclad_telling: 'Ironclad Telling',
  weaver_fragment: 'Weaver Fragment',
  wayfinder_notes: 'Wayfinder’s Notes',
};

/** DESIGN D-020's two-letter tags (also the compact tag in the list). */
export const VOICE_TAGS: Readonly<Record<Voice, string>> = { remnant_archive: 'RA', ironclad_telling: 'IT', weaver_fragment: 'WF', wayfinder_notes: 'WN' };

/** How each voice is said, in words, for the filter and the entry's byline. */
export const VOICE_BLURBS: Readonly<Record<Voice, string>> = {
  remnant_archive: 'Dated, careful, kept in a ledger.',
  ironclad_telling: 'Told aloud, plain and warm.',
  weaver_fragment: 'Broken lines, half heard.',
  wayfinder_notes: 'Your own notes, in the margins.',
};

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  history: 'History',
  the_nine: 'The Nine',
  wayfinders: 'Wayfinders',
  factions: 'Factions',
  people: 'People',
  places: 'Places',
  creatures: 'Creatures',
  magic: 'Magic',
  items: 'Items',
  loops: 'The Loop',
};

export interface CodexRow {
  id: string;
  /** Null while locked: a locked entry shows no title. */
  title: string | null;
  voice: Voice;
  voiceLabel: string;
  voiceTag: string;
  category: Category;
  categoryLabel: string;
  unlocked: boolean;
  /** Unlocked and not yet opened. */
  isNew: boolean;
  date: string | null;
  /** Paragraphs of the body (blank-line separated); empty while locked. */
  paragraphs: string[];
  /** "Learned through: …" for an unlocked entry whose trigger the profile can name. */
  source: string | null;
  /** A hint for a locked entry; it names no Echo, quest or place. */
  hint: string | null;
  /** The entries it points to: titles only for the unlocked ones. */
  related: { id: string; title: string | null; unlocked: boolean }[];
}

export const isUnlocked = (entry: CodexEntry, profile: Pr): boolean => entry.unlockedAtStart || profile.codexUnlocked.includes(entry.id);

// ---- the hint and the source --------------------------------------------------------------------------------------------------

/** Every atom key in a condition tree, in order (`all`, `any`, `not` unwrapped). */
export function atomKeys(when: Condition | undefined): string[] {
  if (when === undefined) return [];
  const out: string[] = [];
  const walk = (c: unknown): void => {
    if (typeof c !== 'object' || c === null) return;
    for (const [key, value] of Object.entries(c)) {
      if (key === 'all' || key === 'any') (value as unknown[]).forEach(walk);
      else if (key === 'not') walk(value);
      else out.push(key);
    }
  };
  walk(when);
  return out;
}

/** Every Echo id a condition mentions. */
export function echoesIn(when: Condition | undefined): string[] {
  const out: string[] = [];
  const walk = (c: unknown): void => {
    if (typeof c !== 'object' || c === null) return;
    for (const [key, value] of Object.entries(c)) {
      if (key === 'all' || key === 'any') (value as unknown[]).forEach(walk);
      else if (key === 'not') walk(value);
      else if (key === 'echo' && typeof value === 'string') out.push(value);
    }
  };
  walk(when);
  return [...new Set(out)];
}

const HINT_BY_ATOM: Readonly<Record<string, string>> = {
  echo: 'Something you learn in one loop and carry into the next.',
  quest: 'Told once a quest has been seen through.',
  companion: 'A companion at your side may know it.',
  corruption: 'Dark books and darker choices may bring it to light.',
  location: 'It waits in a place you have not stood.',
  visited: 'It waits in a place you have not stood.',
  item: 'Something you carry, or have read, may open it.',
  killed: 'A creature may give it up.',
};

/** A hint that spoils nothing: one phrase per kind of trigger (at most two), else a general line. */
export function unlockHint(entry: CodexEntry): string {
  const phrases = [...new Set(atomKeys(entry.unlockWhen).map((k) => HINT_BY_ATOM[k]).filter((p): p is string => p !== undefined))];
  return phrases.length === 0 ? 'Not found yet.' : phrases.slice(0, 2).join(' ');
}

/** "Learned through: Stone-Hide Origin, Hallow’s Ember" — the Echoes (up to three) the profile holds that this entry names. */
export function unlockSource(entry: CodexEntry, profile: Pr, content: ContentPack): string | null {
  const names = echoesIn(entry.unlockWhen)
    .filter((id) => profile.echoes.includes(id))
    .map((id) => content.echoes[id]?.name)
    .filter((n): n is string => n !== undefined);
  if (names.length === 0) return null;
  const shown = names.slice(0, 3).join(', ');
  return `Learned through: ${shown}${names.length > 3 ? ` and ${names.length - 3} more` : ''}`;
}

// ---- rows -----------------------------------------------------------------------------------------------------------------------

export function paragraphsOf(body: string): string[] {
  return body.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p !== '');
}

/** `*word*` → an emphasised run (the codex's only inline mark). */
export function inlineRuns(text: string): { text: string; em: boolean }[] {
  return text
    .split(/(\*[^*\n]+\*)/)
    .filter((part) => part !== '')
    .map((part) => (part.startsWith('*') && part.endsWith('*') && part.length > 2 ? { text: part.slice(1, -1), em: true } : { text: part, em: false }));
}

export function codexRow(entry: CodexEntry, content: ContentPack, profile: Pr, read: ReadonlySet<string>): CodexRow {
  const unlocked = isUnlocked(entry, profile);
  return {
    id: entry.id,
    title: unlocked ? entry.title : null,
    voice: entry.voice,
    voiceLabel: VOICE_LABELS[entry.voice],
    voiceTag: VOICE_TAGS[entry.voice],
    category: entry.category,
    categoryLabel: CATEGORY_LABELS[entry.category],
    unlocked,
    isNew: unlocked && !read.has(entry.id),
    date: unlocked ? (entry.date ?? null) : null,
    paragraphs: unlocked ? paragraphsOf(entry.body) : [],
    source: unlocked ? unlockSource(entry, profile, content) : null,
    hint: unlocked ? null : unlockHint(entry),
    related: unlocked
      ? entry.related.flatMap((id) => {
          const other = content.codex[id];
          if (other === undefined) return [];
          const open = isUnlocked(other, profile);
          return [{ id, title: open ? other.title : null, unlocked: open }];
        })
      : [],
  };
}

export interface CodexFilter {
  category: Category | 'all';
  voice: Voice | 'all';
}

export const NO_FILTER: CodexFilter = { category: 'all', voice: 'all' };

export interface CodexModel {
  rows: CodexRow[];
  /** The rows the filter keeps, unlocked first within each category, in the entries' own order. */
  shown: CodexRow[];
  unlocked: number;
  total: number;
  unread: number;
  categories: { id: Category | 'all'; label: string; found: number; total: number }[];
  voices: { id: Voice | 'all'; label: string; found: number; total: number }[];
}

export function codexModel(content: ContentPack, profile: Pr, read: ReadonlySet<string>, filter: CodexFilter = NO_FILTER): CodexModel {
  const catOrder = new Map<string, number>(CODEX_CATEGORIES.map((c, i) => [c, i]));
  const rows = Object.values(content.codex)
    .filter((e): e is CodexEntry => e !== undefined)
    .sort((a, b) => (catOrder.get(a.category) ?? 0) - (catOrder.get(b.category) ?? 0) || a.order - b.order || a.title.localeCompare(b.title))
    .map((e) => codexRow(e, content, profile, read));
  const keep = (r: CodexRow): boolean => (filter.category === 'all' || r.category === filter.category) && (filter.voice === 'all' || r.voice === filter.voice);
  const count = (pick: (r: CodexRow) => boolean): { found: number; total: number } => {
    const list = rows.filter(pick);
    return { found: list.filter((r) => r.unlocked).length, total: list.length };
  };
  // within a category the found entries come first; ties keep the entries' own order (the sort is stable)
  const shown = rows.filter(keep).sort((a, b) => (catOrder.get(a.category) ?? 0) - (catOrder.get(b.category) ?? 0) || Number(b.unlocked) - Number(a.unlocked));
  return {
    rows,
    shown,
    unlocked: rows.filter((r) => r.unlocked).length,
    total: rows.length,
    unread: rows.filter((r) => r.isNew).length,
    categories: [
      { id: 'all', label: 'All categories', ...count(() => true) },
      ...CODEX_CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id], ...count((r) => r.category === id) })).filter((c) => c.total > 0),
    ],
    voices: [{ id: 'all', label: 'All voices', ...count(() => true) }, ...VOICE_IDS.map((id) => ({ id, label: VOICE_LABELS[id], ...count((r) => r.voice === id) })).filter((v) => v.total > 0)],
  };
}

/** "Oriel Danthe, Remnant Archive, Year 0 of the Sundering, new" — a list line's name. */
export function rowName(row: CodexRow): string {
  if (!row.unlocked) return `Locked entry, ${row.categoryLabel}, ${row.voiceLabel}`;
  return [row.title, row.voiceLabel, row.isNew ? 'new' : null].filter((x) => x !== null).join(', ');
}
