// Class Select's view model (PLAN §6.3, DESIGN §16.3 `screen_class_select`): everything a class card and the detail
// pane show, read from the content pack and computed with the engine's own `newRun`, so the numbers on the card are
// exactly the ones the run starts with (level carry-over, gear and all). Pure; the screen only renders it.
import { newRun, type ContentPack, type Profile } from '@engine/index';
import type { Class } from '@schema/class';

export interface KitLine {
  itemId: string;
  name: string;
  count: number;
  equipped: boolean;
}

export interface BranchPreview {
  id: string;
  name: string;
  description: string;
  /** The branch's abilities by tier (1–5), as the tree preview lists them. */
  abilities: { id: string; name: string; tier: number }[];
}

export interface ClassOption {
  id: string;
  name: string;
  title: string;
  description: string;
  intro: string;
  sigil: string;
  level: number;
  hp: number;
  mp: number;
  resourceName: string;
  stats: { strength: number; magic: number; agility: number };
  /** One line per resource rule ("+8 Focus on a basic hit"). */
  resourceRules: string[];
  gold: number;
  kit: KitLine[];
  branches: BranchPreview[];
  /** From the profile (Loop 2+): shown as a badge. */
  mastery: { loopsPlayed: number; mastered: number; bestLevel: number } | null;
}

const EVENT_TEXT: Record<string, string> = {
  basic_hit: 'on a basic hit',
  basic_crit: 'on a basic critical hit',
  crit: 'on any critical hit',
  guard: 'when you Guard',
  hit_taken: 'each time you are hit',
  dodge: 'each time an attack misses you',
  taunt: 'per enemy you Taunt',
  turn_start: 'at the start of each turn',
};

/** "+8 Focus on a basic hit", "+3 Mana at the start of each turn (+1 every 4 levels)". */
export function resourceRuleText(cls: Pick<Class, 'resource'>): string[] {
  const name = cls.resource.name;
  const lines = cls.resource.rules.map((rule) => {
    const amount = rule.amount !== undefined ? `+${rule.amount}` : '';
    const pct = rule.pctMax !== undefined ? `${amount === '' ? '+' : ' and '}${rule.pctMax}% of max` : '';
    const growth = rule.perLevel !== undefined ? ` (+${rule.perLevel.add} every ${rule.perLevel.every} levels)` : '';
    return `${amount}${pct} ${name} ${EVENT_TEXT[rule.on] ?? rule.on}${growth}`;
  });
  if (cls.resource.bloodPrice !== undefined) {
    lines.push(`Short of ${name}, abilities cost ${cls.resource.bloodPrice.hpPerMp} HP per missing point`);
  }
  return lines;
}

export function classOptions(content: ContentPack, profile: Profile): ClassOption[] {
  return Object.values(content.classes).map((cls) => classOption(cls, content, profile));
}

export function classOption(cls: Class, content: ContentPack, profile: Profile): ClassOption {
  const start = newRun(`preview:${cls.id}`, cls.id, content, profile).player;
  const abilities = (content.index.abilitiesByClass[cls.id] ?? []).flatMap((id) => {
    const a = content.abilities[id];
    return a === undefined || a.branch === undefined ? [] : [a];
  });
  const mastery = profile.classMastery[cls.id];
  return {
    id: cls.id,
    name: cls.name,
    title: cls.title,
    description: cls.description,
    intro: cls.intro,
    sigil: cls.sigil,
    level: start.level,
    hp: start.hpMax,
    mp: start.mpMax,
    resourceName: cls.resource.name,
    stats: { ...start.stats },
    resourceRules: resourceRuleText(cls),
    gold: start.gold,
    kit: cls.starterItems.map((s) => ({
      itemId: s.itemId,
      name: content.items[s.itemId]?.name ?? s.itemId,
      count: s.count,
      equipped: s.equip,
    })),
    branches: cls.branches.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      abilities: abilities
        .filter((a) => a.branch === b.id)
        .map((a) => ({ id: a.id, name: a.name, tier: a.tier ?? 1 }))
        .sort((x, y) => x.tier - y.tier || (x.name < y.name ? -1 : 1)),
    })),
    mastery:
      mastery === undefined || mastery.loopsPlayed === 0
        ? null
        : { loopsPlayed: mastery.loopsPlayed, mastered: mastery.mastered.length, bestLevel: mastery.bestLevel },
  };
}

// ---- local view state ------------------------------------------------------------------------------------------------

export interface ClassSelectState {
  selected: string;
  name: string;
  seed: string;
}

export type ClassSelectAction =
  | { type: 'select'; classId: string }
  | { type: 'step'; by: 1 | -1; order: readonly string[] }
  | { type: 'name'; value: string }
  | { type: 'seed'; value: string };

/** Starts on the class played last, else the first. */
export function initialClassSelect(options: readonly Pick<ClassOption, 'id'>[], lastClassId: string | null): ClassSelectState {
  const selected = options.find((o) => o.id === lastClassId)?.id ?? options[0]?.id ?? '';
  return { selected, name: '', seed: '' };
}

export function classSelectReducer(state: ClassSelectState, action: ClassSelectAction): ClassSelectState {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.classId };
    case 'step': {
      const n = action.order.length;
      if (n === 0) return state;
      const at = Math.max(0, action.order.indexOf(state.selected));
      return { ...state, selected: action.order[(at + action.by + n) % n] ?? state.selected };
    }
    case 'name':
      return { ...state, name: action.value };
    case 'seed':
      return { ...state, seed: action.value };
  }
}

export const NAME_MAX = 24;

/** What `newGame` receives: a trimmed name (the engine defaults an empty one to Wayfinder) and an optional seed. */
export function beginArgs(state: ClassSelectState): { name: string; classId: string; seed?: string } {
  const name = state.name.trim().slice(0, NAME_MAX);
  const seed = state.seed.trim();
  return seed === '' ? { name, classId: state.selected } : { name, classId: state.selected, seed };
}
