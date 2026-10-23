// What the Abilities panel draws (PLAN §6.3 `AbilityTreePanel`, DESIGN §5.1, §6.3–6.4, §3.2): the class's three branches
// as ladders of five tiers (level gates 1 · 4 · 8 · 12 · 16; the third tier needs two abilities of the branch already
// known, the fourth three, the capstone all four), each ability with what it costs, what it does and — when it is shut —
// the engine's own reason; and a Character tab with the unspent stat points (what one more point in each stat would do to
// the derived numbers), the derived numbers themselves, and the camp-fire respec. Costs are half-points underneath (1 AP = 2),
// halved for an ability mastered in an earlier loop. Pure functions of the state and the pack.
import {
  RESPEC_GOLD_PER_LEVEL,
  STAT_NAMES,
  checkAllocate,
  checkRespec,
  derive,
  isTreeAbility,
  masteredFor,
  playerAbilityCost,
  unlockCostHalf,
  unlockProblem,
  type Action,
  type ContentPack,
  type Derived,
  type GameState,
  type Profile,
  type StatName,
} from '@engine/index';
import type { Ability } from '@schema/ability';
import { deltaRows, type DeltaRow } from './itemModel';
import { notExploring, panelAction, type PanelAction } from './panelAction';

/** "½ AP", "1 AP", "1½ AP". */
export function apText(half: number): string {
  const whole = Math.floor(half / 2);
  const part = half % 2 === 1 ? '½' : '';
  return `${whole === 0 && part !== '' ? '' : whole}${part} AP`;
}

const TARGET_TEXT: Readonly<Record<Ability['target'], string>> = {
  enemy: 'One enemy',
  all_enemies: 'All enemies',
  self: 'You',
  ally: 'An ally',
  self_or_ally: 'You or an ally',
  party: 'The party',
};

export type AbilityState = 'unlocked' | 'ready' | 'locked';

export interface AbilityRowModel {
  id: string;
  name: string;
  tier: number;
  levelReq: number;
  state: AbilityState;
  /** Known from the start (the class's starting ability): it cost nothing and respec keeps it. */
  starting: boolean;
  description: string;
  flavor: string | null;
  /** "1 AP", "½ AP (mastered)". */
  costText: string;
  mastered: boolean;
  /** Chips: "8 Focus", "Cooldown 3", "Fire", "All enemies". */
  facts: string[];
  /** Why it is shut (the engine's text); null when unlocked or ready. */
  lockedReason: string | null;
  unlock: PanelAction | null;
}

export interface BranchModel {
  id: string;
  name: string;
  description: string;
  rows: AbilityRowModel[];
  unlocked: number;
  total: number;
}

export interface StatRowModel {
  stat: StatName;
  label: string;
  value: number;
  /** What one more point does: "Max HP +2, Attack +1". */
  effect: string;
  allocate: PanelAction;
}

export interface DerivedLine {
  label: string;
  value: string;
}

export interface RespecModel {
  cost: number;
  /** "Gives back 3 AP from 3 abilities" while it can be done, else the reason. */
  summary: string;
  action: PanelAction;
}

export interface CharacterModel {
  stats: StatRowModel[];
  derived: DerivedLine[];
  respec: RespecModel;
}

export type AbilitiesTab = string;

export interface AbilitiesModel {
  className: string;
  level: number;
  apHalf: number;
  /** "2 AP", "0 AP". */
  apLabel: string;
  statPoints: number;
  branches: BranchModel[];
  character: CharacterModel;
  tabs: { id: AbilitiesTab; label: string; count: number | null }[];
  /** A fight is on or this is not the explore screen: nothing can be spent. */
  readOnly: string | null;
}

export const CHARACTER_TAB = 'character';

const STAT_LABEL: Readonly<Record<StatName, string>> = { strength: 'Strength', magic: 'Magic', agility: 'Agility' };
const EFFECT_LABELS: Readonly<Partial<Record<keyof Derived, string>>> = {
  hpMax: 'Max HP',
  mpMax: 'Max MP',
  atk: 'Attack',
  sp: 'Spell power',
  accuracy: 'Accuracy',
  evasion: 'Evasion',
  crit: 'Crit chance',
  initiative: 'Initiative',
};

function abilityFacts(s: GameState, content: ContentPack, a: Ability): string[] {
  const out: string[] = [];
  const resource = content.classes[s.player.classId]?.resource.name ?? 'MP';
  const cost = playerAbilityCost(s, content, a.id, { hp: 1_000_000, hpMax: 1_000_000, mp: 1_000_000 });
  if (cost.mp > 0) out.push(`${cost.mp} ${resource}`);
  if (a.selfCost?.hpPctMax !== undefined) out.push(`${Math.round(a.selfCost.hpPctMax * 100)}% of max HP`);
  if (a.selfCost?.hpPctCur !== undefined) out.push(`${Math.round(a.selfCost.hpPctCur * 100)}% of current HP`);
  if (a.cooldown > 0) out.push(`Cooldown ${a.cooldown}`);
  out.push(TARGET_TEXT[a.target]);
  if (a.damageType !== undefined) out.push(`${a.damageType.charAt(0).toUpperCase()}${a.damageType.slice(1)} damage`);
  if (a.outOfCombat.length > 0) out.push('Usable out of a fight');
  return out;
}

/** The change in each derived number from one more point in `stat`. */
function statEffect(s: GameState, content: ContentPack, stat: StatName): { text: string; rows: DeltaRow[] } {
  const before = derive(s.player, content);
  const after = derive({ ...s.player, stats: { ...s.player.stats, [stat]: s.player.stats[stat] + 1 } }, content);
  const rows = deltaRows(before, after).filter((r) => r.key in EFFECT_LABELS);
  return { text: rows.length === 0 ? 'No change to your numbers' : rows.map((r) => `${EFFECT_LABELS[r.key as keyof Derived]} ${r.delta > 0 ? '+' : '−'}${Math.abs(r.delta)}`).join(', '), rows };
}

function derivedLines(d: Derived, resource: string): DerivedLine[] {
  return [
    { label: 'Max HP', value: String(d.hpMax) },
    { label: `Max ${resource}`, value: String(d.mpMax) },
    { label: 'Attack', value: String(d.atk) },
    { label: 'Spell power', value: String(d.sp) },
    { label: 'Armor', value: String(d.armor) },
    { label: 'Ward', value: String(d.ward) },
    { label: 'Accuracy', value: String(d.accuracy) },
    { label: 'Evasion', value: String(d.evasion) },
    { label: 'Crit chance', value: `${d.crit}%` },
    { label: 'Initiative', value: String(d.initiative) },
  ];
}

export function abilitiesModel(s: GameState, content: ContentPack, profile: Readonly<Profile>, isLegal: (a: Action) => boolean): AbilitiesModel {
  const player = s.player;
  const cls = content.classes[player.classId];
  const mastered = masteredFor(profile, player.classId);
  const gate = notExploring(s.mode);
  const starting = cls?.startingAbilities ?? [];
  const ids = (content.index.abilitiesByClass[player.classId] ?? []).filter((id) => isTreeAbility(content.abilities[id], player.classId));
  const branches: BranchModel[] = (cls?.branches ?? []).map((b) => {
    const rows = ids
      .map((id) => content.abilities[id] as Ability)
      .filter((a) => a.branch === b.id)
      .sort((x, y) => (x.tier ?? 0) - (y.tier ?? 0))
      .map((a): AbilityRowModel => {
        const known = player.abilitiesUnlocked.includes(a.id);
        const half = unlockCostHalf(a, mastered);
        const isMastered = mastered.includes(a.id);
        const problem = known ? null : unlockProblem(s, content, profile, a.id);
        const action: Action = { type: 'unlockAbility', abilityId: a.id };
        const state: AbilityState = known ? 'unlocked' : problem === null ? 'ready' : 'locked';
        return {
          id: a.id,
          name: a.name,
          tier: a.tier ?? 1,
          levelReq: a.levelReq,
          state,
          starting: starting.includes(a.id),
          description: a.description,
          flavor: a.flavor ?? null,
          costText: `${apText(half)}${isMastered ? ' (mastered)' : ''}`,
          mastered: isMastered,
          facts: abilityFacts(s, content, a),
          lockedReason: problem,
          unlock: known ? null : panelAction(`unlock-${a.id}`, 'Unlock', action, isLegal, gate ?? problem, { primary: true }),
        };
      });
    return { id: b.id, name: b.name, description: b.description, rows, unlocked: rows.filter((r) => r.state === 'unlocked').length, total: rows.length };
  });

  const resource = cls?.resource.name ?? 'MP';
  const stats: StatRowModel[] = STAT_NAMES.map((stat) => {
    const a: Action = { type: 'allocateStat', stat };
    return {
      stat,
      label: STAT_LABEL[stat],
      value: player.stats[stat],
      effect: statEffect(s, content, stat).text,
      allocate: panelAction(`allocate-${stat}`, `Add a point to ${STAT_LABEL[stat]}`, a, isLegal, gate ?? checkAllocate(s, { type: 'allocateStat', stat }), { primary: true }),
    };
  });

  const respecCheck = checkRespec(s, content, profile);
  const respecAction: Action = { type: 'respec' };
  const cost = RESPEC_GOLD_PER_LEVEL * player.level;
  const respec: RespecModel =
    typeof respecCheck === 'string'
      ? { cost, summary: respecCheck, action: panelAction('respec', `Rethink your path (${cost} gold)`, respecAction, isLegal, gate ?? respecCheck, { danger: true }) }
      : {
          cost: respecCheck.cost,
          summary: `Gives back ${apText(respecCheck.plan.refundHalf)} from ${respecCheck.plan.refunded.length} abilit${respecCheck.plan.refunded.length === 1 ? 'y' : 'ies'}. Stat points stay where they are.`,
          action: panelAction('respec', `Rethink your path (${respecCheck.cost} gold)`, respecAction, isLegal, gate, {
            danger: true,
            confirm: `Let go of ${respecCheck.plan.refunded.length} abilit${respecCheck.plan.refunded.length === 1 ? 'y' : 'ies'} for ${respecCheck.cost} gold? You get ${apText(respecCheck.plan.refundHalf)} back to spend again. You can do this once a day.`,
            yes: 'Rethink',
          }),
        };

  const character: CharacterModel = { stats, derived: derivedLines(derive(player, content), resource), respec };
  return {
    className: cls?.name ?? player.classId,
    level: player.level,
    apHalf: player.apHalf,
    apLabel: apText(player.apHalf),
    statPoints: player.statPoints,
    branches,
    character,
    tabs: [
      ...branches.map((b) => ({ id: b.id, label: b.name, count: b.unlocked })),
      { id: CHARACTER_TAB, label: 'Character', count: player.statPoints > 0 ? player.statPoints : null },
    ],
    readOnly: gate,
  };
}

/** "Hunter's Eye, tier 2, ready to unlock, 1 AP" — the accessible name of an ability node. */
export function abilityLabel(row: AbilityRowModel): string {
  const state = row.state === 'unlocked' ? 'unlocked' : row.state === 'ready' ? 'ready to unlock' : 'locked';
  return `${row.name}, tier ${row.tier}, ${state}${row.state === 'unlocked' ? '' : `, ${row.costText}`}`;
}
