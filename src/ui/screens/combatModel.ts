// What the Combat screen draws (PLAN §6.3 `CombatScreen`, DESIGN §4 and §16.5), as pure functions of the state, the
// pack, the profile and the legal-action list — the same split as exploreModel.ts (D-104, D-107). Nothing here decides
// legality: a control is enabled only when its action is in `legal`; a disabled one says why with the engine's own
// predicate (`combatAbilityProblem`, `fleeProblem`, `communeProblem` …), and every number a chip shows (projected damage,
// the Guard preview, flee odds, costs) comes from the helpers the reducers use, so what the player reads is what happens.
import {
  INTERPLAY_TABLE,
  STANCES,
  availableAnswers,
  availableOffers,
  blocksAction,
  combatAbilityCost,
  combatAbilityProblem,
  combatantByUid,
  commandProblem,
  communeProblem,
  communionBoss,
  communionRejected,
  currentActor,
  currentQuestion,
  effectiveResistance,
  eligibleOutcomes,
  explain,
  fleeChanceIn,
  fleeProblem,
  foreseenMove,
  foreseesFor,
  intentTarget,
  isActive,
  isBoss,
  isEliteVariant,
  knownAbilities,
  moveDamageType,
  openProblem,
  phasesOf,
  playerOf,
  projectIntent,
  stanceProblem,
  aimOfIntent,
  type Action,
  type Combatant,
  type CombatState,
  type ContentPack,
  type DamageType,
  type GameEvent,
  type GameState,
  type Intent,
  type Profile,
  type Resistance,
  type Stance,
  type StatusInstance,
} from '@engine/index';
import type { Ability } from '@schema/ability';
import { damageIcon, statusIcon, type IconKind } from '../art/Icon';
import type { SigilSpec } from '../art/CreatureSigil';
import { legalSet } from './exploreModel';

type Pr = Readonly<Profile>;
type Legal = readonly Action[];

const cap = (s: string): string => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1));
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
/** "14–17", or "9" for a fixed number. */
export const rangeText = ([lo, hi]: readonly [number, number]): string => (lo === hi ? `${lo}` : `${lo}–${hi}`);
const spokenRange = ([lo, hi]: readonly [number, number]): string => (lo === hi ? `${lo}` : `${lo} to ${hi}`);

export const DAMAGE_TYPE_NAMES: Readonly<Record<DamageType, string>> = {
  physical: 'Physical',
  fire: 'Fire',
  storm: 'Storm',
  ley: 'Ley',
  void: 'Void',
  chrono: 'Chrono',
};
const RESIST_WORDS: Readonly<Record<Resistance, string>> = { weak: 'weak', neutral: 'neutral', resist: 'resists', immune: 'immune' };
const RESIST_MULTS: Readonly<Record<Resistance, string>> = { weak: '×1.5', neutral: '×1', resist: '×0.5', immune: '×0' };

/** The log's visible length (DESIGN §16.5: the last 8 lines, legacy `COMBAT_LOG_LIMIT`) and its expanded length. */
export const COMBAT_LOG_LINES = 8;
export const COMBAT_LOG_EXPANDED = 60;

// ---- statuses (DESIGN §4.5, §17.5: icon + text, never colour alone) -------------------------------------------------------

export interface StatusChipModel {
  id: string;
  name: string;
  icon: IconKind;
  kind: 'buff' | 'debuff';
  stacks: number;
  /** Turns left; null for a status that does not count down. */
  turns: number | null;
  /** A Shield's pool or a tick's size, when it has one worth showing. */
  amount: number | null;
  /** Visible text: "Bleed ×2 · 3", "Shield 16 · 3". */
  text: string;
  /** Spoken: "Bleed, 2 stacks, 3 turns left". */
  label: string;
}

export function statusChips(content: ContentPack, statuses: readonly StatusInstance[]): StatusChipModel[] {
  return statuses.map((st) => {
    const def = content.statuses[st.statusId];
    const name = def?.name ?? st.statusId;
    const turns = st.duration > 0 ? st.duration : null;
    const amount = st.statusId === 'status_shield' && st.tick !== undefined ? st.tick : null;
    const stackText = st.stacks > 1 ? ` ×${st.stacks}` : '';
    const text = `${name}${amount === null ? '' : ` ${amount}`}${stackText}${turns === null ? '' : ` · ${turns}`}`;
    const label = [name, amount === null ? null : `${amount} points`, st.stacks > 1 ? `${st.stacks} stacks` : null, turns === null ? null : `${plural(turns, 'turn')} left`]
      .filter((x) => x !== null)
      .join(', ');
    return { id: st.statusId, name, icon: statusIcon(st.statusId), kind: def?.kind === 'buff' ? 'buff' : 'debuff', stacks: st.stacks, turns, amount, text, label };
  });
}

// ---- intents (DESIGN §4.2: type glyph, name, effect tag, projected range, target; "?" when hidden) --------------------------

export interface IntentChipModel {
  /** The move id (a question id for a communion question). */
  moveId: string;
  hidden: boolean;
  /** "Maul", "Question", or "?" when hidden. */
  name: string;
  glyph: IconKind;
  damageType: DamageType | null;
  /** "14–17"; "—" for a non-damaging move. */
  range: string;
  /** The Guard preview for a hit on the player ("7–9"); null otherwise. */
  guarded: string | null;
  /** "you", "Ilyra", "ALL", "itself", an ally's name. */
  target: string;
  targetKind: 'player' | 'companion' | 'all' | 'self' | 'ally';
  /** Effect tags ('may Weaken', 'Shield', 'winding up' …), without the area marker. */
  tags: string[];
  /** The telegraph line (WORLD §6). */
  line: string;
  /** What a wind-up releases ("Chrono-Strike", "?" when that move is hidden). */
  windUpThen: string | null;
  question: boolean;
  /** The dimmed next-next chip (Foresight, Hunter's Eye, a creature that telegraphs two). */
  next: boolean;
  /** "Intent: Maul, physical, 14 to 17 damage, targeting you, may Weaken." */
  label: string;
}

type Read = { s: GameState; profile: Pr; content: ContentPack };

function effectGlyph(tags: readonly string[]): IconKind {
  if (tags.some((t) => t.includes('Shield') || t.includes('shield'))) return 'status_shield';
  if (tags.some((t) => t.startsWith('heals'))) return 'heal';
  if (tags.includes('summons')) return 'summon';
  return 'buff';
}

function targetOf(combat: CombatState, enemy: Combatant, intent: Intent): { target: string; kind: IntentChipModel['targetKind'] } {
  const aim = aimOfIntent(combat, enemy, intent);
  if (aim === 'all') return { target: 'ALL', kind: 'all' };
  if (aim === 'self') return { target: 'itself', kind: 'self' };
  const t = intentTarget(combat, enemy, intent);
  if (aim === 'ally') return { target: t?.name ?? 'an ally', kind: 'ally' };
  if (t?.kind === 'companion') return { target: t.name, kind: 'companion' };
  return { target: 'you', kind: 'player' };
}

/** The chip for an enemy's committed intent. */
export function intentChip(r: Read, combat: CombatState, enemy: Combatant, intent: Intent): IntentChipModel {
  const creature = r.content.creatures[enemy.refId];
  const move = creature?.moves[intent.moveId];
  const question = intent.tags.includes('question');
  const type = move === undefined ? null : (moveDamageType(r, combat, move) ?? null);
  const damaging = intent.projected[1] > 0 || (move?.power !== undefined && type !== null);
  const tags = intent.tags.filter((t) => t !== 'ALL' && t !== 'question');
  const { target, kind } = targetOf(combat, enemy, intent);
  const typed = type !== null && (move?.power !== undefined || damaging);
  const glyph: IconKind = question ? 'commune' : typed ? damageIcon(type) : effectGlyph(tags);
  if (intent.hidden) {
    const typeWord = type === null ? '' : `, ${DAMAGE_TYPE_NAMES[type].toLowerCase()}`;
    return {
      moveId: intent.moveId,
      hidden: true,
      name: '?',
      glyph,
      damageType: type,
      range: '?',
      guarded: null,
      target: '?',
      targetKind: kind,
      tags: [],
      line: '',
      windUpThen: null,
      question: false,
      next: false,
      label: `Intent: hidden${typeWord}. It shows itself before it lands.`,
    };
  }
  // Settings → "Show exact intent damage": off hides every number but keeps the words (type, target, tags)
  const numbers = r.profile.settings.showIntentNumbers;
  const range = damaging ? (numbers ? rangeText(intent.projected) : 'damage') : '—';
  // the communion's press ignores Guard (D-081): no preview for the communing creature's beats
  const communing = combat.communion !== null && creature?.communion !== undefined;
  const hitsPlayer = damaging && !communing && (kind === 'player' || kind === 'all');
  const guarded = hitsPlayer && numbers ? rangeText(projectIntent(r, combat, enemy, intent, { guard: true })) : null;
  const then = move?.windUp?.then;
  const thenMove = then === undefined ? undefined : creature?.moves[then];
  const windUpThen = then === undefined ? null : thenMove?.hidden === true ? '?' : (thenMove?.name ?? then);
  const name = question ? 'Question' : (move?.name ?? intent.moveId);
  const parts = [`Intent: ${name}`];
  if (typed) parts.push(DAMAGE_TYPE_NAMES[type].toLowerCase());
  if (damaging) parts.push(numbers ? `${spokenRange(intent.projected)} damage` : 'damage');
  parts.push(kind === 'all' ? 'targeting everyone' : kind === 'self' ? 'on itself' : `targeting ${target}`);
  if (tags.length > 0) parts.push(tags.join(', '));
  if (windUpThen !== null) parts.push(`then ${windUpThen === '?' ? 'something hidden' : windUpThen}`);
  return {
    moveId: intent.moveId,
    hidden: false,
    name,
    glyph,
    damageType: type,
    range,
    guarded,
    target,
    targetKind: kind,
    tags,
    line: intent.text,
    windUpThen,
    question,
    next: false,
    label: `${parts.join(', ')}.`,
  };
}

/** The dimmed second chip (DESIGN §4.2): the move after the committed one, when the party foresees it. */
export function nextChip(r: Read, combat: CombatState, enemy: Combatant): IntentChipModel | null {
  if (!foreseesFor(r.content, combat, enemy) || combat.communion !== null) return null;
  const moveId = foreseenMove(r, combat, enemy);
  const move = moveId === null ? undefined : r.content.creatures[enemy.refId]?.moves[moveId];
  if (moveId === null || move === undefined) {
    return { moveId: '?', hidden: true, name: '?', glyph: 'unknown', damageType: null, range: '?', guarded: null, target: '?', targetKind: 'player', tags: [], line: '', windUpThen: null, question: false, next: true, label: 'Then: something you cannot read yet.' };
  }
  const type = moveDamageType(r, combat, move) ?? null;
  const glyph: IconKind = type !== null && move.power !== undefined ? damageIcon(type) : effectGlyph([]);
  const typeWord = type !== null && move.power !== undefined ? `, ${DAMAGE_TYPE_NAMES[type].toLowerCase()}` : '';
  return { moveId, hidden: false, name: move.name, glyph, damageType: type, range: '', guarded: null, target: '', targetKind: 'player', tags: [], line: move.line, windUpThen: null, question: false, next: true, label: `Then: ${move.name}${typeWord}.` };
}

// ---- enemy cards (DESIGN §16.5 top row) ---------------------------------------------------------------------------------------

export interface PhaseInfo {
  /** 0-based. */
  index: number;
  count: number;
  name: string;
}

export interface EnemyCardModel {
  uid: string;
  creatureId: string;
  name: string;
  level: number;
  rank: 'Boss' | 'Elite' | null;
  hp: number;
  hpMax: number;
  alive: boolean;
  /** HP-fraction thresholds where later phases begin (DESIGN §4.10: segmented bars), highest first. */
  segments: number[];
  phase: PhaseInfo | null;
  statuses: StatusChipModel[];
  /** Known resistances (after the first kill of its kind, DESIGN §4.2); null while unknown. */
  resistances: { type: DamageType; name: string; level: Resistance; text: string }[] | null;
  intent: IntentChipModel | null;
  next: IntentChipModel | null;
  sigil: SigilSpec | undefined;
  family: string | undefined;
  /** It is the target the number keys and the ability tiles act on. */
  selected: boolean;
  /** The player can attack it now. */
  targetable: boolean;
  /** Its turn is now (the screen is between dispatches only at the player's turn, so rarely). */
  acting: boolean;
}

/** The thresholds (fractions of max HP) where a boss's later phases begin, highest first. */
export function phaseSegments(content: ContentPack, c: Pick<Combatant, 'kind' | 'refId'>): number[] {
  const out: number[] = [];
  for (const phase of phasesOf(content, c)) {
    for (const t of phase.enterWhen) if ('hpBelow' in t && typeof t.hpBelow === 'number') out.push(t.hpBelow);
  }
  return [...new Set(out)].sort((a, b) => b - a);
}

function knownResistances(profile: Pr, c: Combatant): EnemyCardModel['resistances'] {
  const entry = profile.bestiary[c.refId];
  if (entry === undefined || entry.revealed === 'none') return null;
  return (Object.entries(c.resistances) as [DamageType, Resistance][])
    .filter(([, level]) => level !== 'neutral')
    .map(([type, level]) => ({ type, name: DAMAGE_TYPE_NAMES[type], level, text: `${RESIST_WORDS[level]} ${DAMAGE_TYPE_NAMES[type]}` }));
}

export function enemyCards(s: GameState, content: ContentPack, profile: Pr, legal: Legal, selectedUid: string | null): EnemyCardModel[] {
  const combat = s.combat;
  if (combat === null) return [];
  const r: Read = { s, profile, content };
  const isLegal = legalSet(legal);
  const actor = currentActor(combat);
  return combat.enemies
    .filter((e) => !e.fledOrGone)
    .map((e) => {
      const def = content.creatures[e.refId];
      const phases = phasesOf(content, e);
      const intent = combat.intents[e.uid];
      return {
        uid: e.uid,
        creatureId: e.refId,
        name: e.name,
        level: e.level,
        rank: isBoss(content, e) ? 'Boss' : def?.role === 'elite' || isEliteVariant(e) ? 'Elite' : null,
        hp: Math.max(0, e.hp),
        hpMax: e.hpMax,
        alive: isActive(e),
        segments: phaseSegments(content, e),
        phase: phases.length > 1 ? { index: e.phase, count: phases.length, name: phases[e.phase]?.name ?? '' } : null,
        statuses: statusChips(content, e.statuses),
        resistances: knownResistances(profile, e),
        intent: intent === undefined || !isActive(e) ? null : intentChip(r, combat, e, intent),
        next: isActive(e) ? nextChip(r, combat, e) : null,
        sigil: def?.sigil,
        family: def?.family,
        selected: e.uid === selectedUid,
        targetable: isActive(e) && isLegal({ type: 'attack', targetUid: e.uid }),
        acting: actor?.uid === e.uid,
      };
    });
}

/**
 * The enemy the number keys act on (DESIGN §4.8): the chosen one while it stands, else the leftmost standing enemy.
 * `chosen` is the screen's own memory of the last target.
 */
export function effectiveTarget(combat: CombatState | null, chosen: string | null): string | null {
  if (combat === null) return null;
  const standing = combat.enemies.filter(isActive);
  return standing.find((e) => e.uid === chosen)?.uid ?? standing[0]?.uid ?? null;
}

/** The next (or previous) standing enemy after `from`, wrapping (← / → cycle the target). */
export function cycleTarget(combat: CombatState | null, from: string | null, step: 1 | -1): string | null {
  if (combat === null) return null;
  const standing = combat.enemies.filter(isActive);
  if (standing.length === 0) return null;
  const at = standing.findIndex((e) => e.uid === from);
  const next = at < 0 ? 0 : (at + step + standing.length) % standing.length;
  return standing[next]?.uid ?? null;
}

// ---- the turn order strip -----------------------------------------------------------------------------------------------------

export interface TurnEntry {
  uid: string;
  name: string;
  kind: Combatant['kind'];
  current: boolean;
  /** Already acted this round. */
  done: boolean;
}

export function turnOrder(combat: CombatState | null): TurnEntry[] {
  if (combat === null) return [];
  return combat.turnOrder.flatMap((uid, i) => {
    const c = combatantByUid(combat, uid);
    if (c === undefined || !isActive(c)) return [];
    const name = c.kind === 'player' ? 'You' : c.name;
    return [{ uid, name, kind: c.kind, current: i === combat.turnIndex, done: i < combat.turnIndex }];
  });
}

// ---- the player panel, Guard, Flee (DESIGN §16.5 bottom left) ------------------------------------------------------------------

export interface PlayerPanelModel {
  name: string;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  resourceName: string;
  statuses: StatusChipModel[];
  guarding: boolean;
}

export function playerPanel(s: GameState, content: ContentPack): PlayerPanelModel | null {
  const combat = s.combat;
  if (combat === null) return null;
  const p = playerOf(combat);
  return {
    name: p.name,
    hp: Math.max(0, p.hp),
    hpMax: p.hpMax,
    mp: p.mp,
    mpMax: p.mpMax,
    resourceName: content.classes[s.player.classId]?.resource.name ?? 'Mana',
    statuses: statusChips(content, p.statuses),
    guarding: p.guarding,
  };
}

export interface GuardModel {
  enabled: boolean;
  reason: string | null;
  /** DESIGN §4.7: "Maul 14–17 → 7–9" for every incoming hit on you. */
  previews: string[];
}

export function guardModel(s: GameState, content: ContentPack, profile: Pr, legal: Legal): GuardModel {
  const combat = s.combat;
  const enabled = legalSet(legal)({ type: 'guard' });
  if (combat === null) return { enabled, reason: null, previews: [] };
  const r: Read = { s, profile, content };
  const previews: string[] = [];
  for (const e of combat.enemies) {
    const intent = combat.intents[e.uid];
    if (intent === undefined || intent.hidden || !isActive(e)) continue;
    const chip = intentChip(r, combat, e, intent);
    if (chip.guarded !== null && chip.range !== '—') previews.push(`${chip.name} ${chip.range} → ${chip.guarded}`);
  }
  const reason = enabled ? null : blocksAction(content, playerOf(combat), 'guard') ? 'You cannot guard now' : 'Not your turn';
  return { enabled, reason, previews };
}

export interface FleeModel {
  /** Shown at all: the fight can be fled, or left after a rejection. */
  shown: boolean;
  enabled: boolean;
  /** 0–100. */
  chance: number;
  reason: string | null;
  /** After the Tyrant's rejection, Flee is "Leave" (no roll; it ends the loop). */
  leave: boolean;
  label: string;
}

export function fleeModel(s: GameState, content: ContentPack, legal: Legal): FleeModel {
  const combat = s.combat;
  const enabled = legalSet(legal)({ type: 'flee' });
  if (combat === null) return { shown: false, enabled: false, chance: 0, reason: null, leave: false, label: 'Flee' };
  if (communionRejected(combat)) return { shown: true, enabled, chance: 100, reason: null, leave: true, label: 'Leave (the loop ends)' };
  const problem = fleeProblem(content, combat);
  const chance = Math.round(fleeChanceIn(content, combat));
  return {
    shown: combat.canFlee,
    enabled,
    chance,
    reason: enabled ? null : (problem ?? 'Not your turn'),
    leave: false,
    label: `Flee · ${chance}%`,
  };
}

// ---- the ability bar (DESIGN §16.5 bottom centre) -------------------------------------------------------------------------------

export type TileTarget = 'enemy' | 'ally' | 'none';

export interface AbilityTileModel {
  /** 'attack' or the ability id. */
  id: string;
  kind: 'attack' | 'ability';
  name: string;
  description: string;
  branch: string | null;
  branchName: string;
  /** 0–2: the class branch's place (its colour); 3 for gear-granted. */
  branchIndex: number;
  tier: number | null;
  /** "6 Focus" / "4 Focus + 12 HP"; null when free. */
  cost: string | null;
  /** The cost is paid in blood (DESIGN §16.5: red). */
  blood: boolean;
  cooldown: number;
  target: TileTarget;
  damageType: DamageType | null;
  enabled: boolean;
  reason: string | null;
  /** The number key (1 attack, 2–9 abilities in displayed order); null past nine. */
  key: string | null;
}

function targetKind(ability: Pick<Ability, 'target'>): TileTarget {
  if (ability.target === 'enemy') return 'enemy';
  if (ability.target === 'ally' || ability.target === 'self_or_ally') return 'ally';
  return 'none';
}

/** DESIGN §16.5's disabled texts: "Needs 12 Focus", "Cooldown 2", "Not enough blood"; else the engine's sentence. */
function tileReason(problem: string, mp: number, resource: string, cooldown: number): string {
  if (problem === 'Not enough MP') return `Needs ${mp} ${resource}`;
  if (cooldown > 0 && problem.includes('recharging')) return `Cooldown ${cooldown}`;
  return problem;
}

/** The tiles in displayed order: Attack, then the abilities by class branch (then gear-granted), each branch by tier. */
export function abilityTiles(s: GameState, content: ContentPack, legal: Legal, target: string | null): AbilityTileModel[] {
  const combat = s.combat;
  const cls = content.classes[s.player.classId];
  const resource = cls?.resource.name ?? 'MP';
  const branches = cls?.branches ?? [];
  const isLegal = legalSet(legal);
  const myTurn = combat !== null && legal.some((a) => a.type === 'attack' || a.type === 'guard' || a.type === 'ability');
  const attackEnabled = target !== null && isLegal({ type: 'attack', targetUid: target });
  const tiles: AbilityTileModel[] = [
    {
      id: 'attack',
      kind: 'attack',
      name: 'Attack',
      description: 'Your weapon’s basic attack at the target. It builds your class resource.',
      branch: null,
      branchName: 'Weapon',
      branchIndex: -1,
      tier: null,
      cost: null,
      blood: false,
      cooldown: 0,
      target: 'enemy',
      damageType: 'physical',
      enabled: attackEnabled,
      reason: attackEnabled ? null : myTurn ? 'No target' : 'Not your turn',
      key: '1',
    },
  ];
  if (combat === null) return tiles;
  const player = playerOf(combat);
  const order = (a: Ability): [number, number] => {
    const at = branches.findIndex((b) => b.id === a.branch);
    return [at < 0 ? branches.length : at, a.tier ?? 9];
  };
  const known = knownAbilities(s, content)
    .map((id) => content.abilities[id])
    .filter((a): a is Ability => a !== undefined)
    .sort((a, b) => {
      const [ab, at] = order(a);
      const [bb, bt] = order(b);
      return ab - bb || at - bt;
    });
  known.forEach((ability, i) => {
    const kind = targetKind(ability);
    const enabled =
      kind === 'enemy'
        ? target !== null && isLegal({ type: 'ability', abilityId: ability.id, targetUid: target })
        : kind === 'ally'
          ? legal.some((a) => a.type === 'ability' && a.abilityId === ability.id)
          : isLegal({ type: 'ability', abilityId: ability.id });
    const cost = combatAbilityCost(s, content, player, ability);
    const cooldown = combat.cooldowns[ability.id] ?? 0;
    const parts: string[] = [];
    if (cost.mp > 0) parts.push(`${cost.mp} ${resource}`);
    if (cost.hp > 0) parts.push(`${cost.hp} HP`);
    const problem = enabled ? null : myTurn ? combatAbilityProblem(s, content, combat, ability.id, kind === 'enemy' ? (target ?? undefined) : undefined) : 'Not your turn';
    const at = branches.findIndex((b) => b.id === ability.branch);
    tiles.push({
      id: ability.id,
      kind: 'ability',
      name: ability.name,
      description: ability.description,
      branch: ability.branch ?? null,
      branchName: at < 0 ? 'Gear' : (branches[at]?.name ?? ''),
      branchIndex: at < 0 ? 3 : at,
      tier: ability.tier ?? null,
      cost: parts.length === 0 ? null : parts.join(' + '),
      blood: cost.hp > 0,
      cooldown,
      target: kind,
      damageType: ability.damageType ?? null,
      enabled,
      reason: problem === null ? null : tileReason(problem, cost.mp, resource, cooldown),
      key: i + 2 <= 9 ? String(i + 2) : null,
    });
  });
  return tiles;
}

/** "1: Attack, Corrupted Shade" — the number first, then the name, then the cost or why it is unavailable. */
export function tileName(tile: AbilityTileModel, targetName: string | null): string {
  const bits = [`${tile.key === null ? '' : `${tile.key}: `}${tile.name}`];
  if (tile.target === 'enemy' && targetName !== null && tile.enabled) bits.push(`at ${targetName}`);
  if (tile.cost !== null) bits.push(tile.cost);
  if (tile.reason !== null) bits.push(tile.reason);
  return bits.join(', ');
}

/** The party members an ally ability (or a healing item) can go to, as legal actions: [label, action]. */
export function allyChoices(s: GameState, legal: Legal, abilityId: string): { uid: string; label: string; action: Action }[] {
  const combat = s.combat;
  if (combat === null) return [];
  return legal.flatMap((a) => {
    if (a.type !== 'ability' || a.abilityId !== abilityId || a.targetUid === undefined) return [];
    const c = combatantByUid(combat, a.targetUid);
    if (c === undefined || c.kind === 'enemy') return [];
    return [{ uid: c.uid, label: c.kind === 'player' ? 'Yourself' : c.name, action: a }];
  });
}

// ---- items (DESIGN §4.1 `I`: the consumables sheet) ----------------------------------------------------------------------------

export interface ItemChoiceModel {
  label: string;
  action: Action;
}

export interface CombatItemModel {
  uid: string;
  name: string;
  qty: number;
  description: string;
  /** One button per way to use it now (on yourself, on the companion, at the target). */
  uses: ItemChoiceModel[];
}

/** Consumables the player may use now, each with its legal uses (an enemy-aimed item at the current target only). */
export function combatItems(s: GameState, content: ContentPack, legal: Legal, target: string | null): CombatItemModel[] {
  const combat = s.combat;
  if (combat === null) return [];
  const out: CombatItemModel[] = [];
  for (const inst of s.player.inventory) {
    const uses: ItemChoiceModel[] = [];
    for (const a of legal) {
      if (a.type !== 'item' || a.uid !== inst.uid) continue;
      const c = a.targetUid === undefined ? undefined : combatantByUid(combat, a.targetUid);
      if (c?.kind === 'enemy' && a.targetUid !== target) continue;
      const label = c === undefined ? 'Use' : c.kind === 'player' ? 'Use on yourself' : c.kind === 'companion' ? `Use on ${c.name}` : `Use at ${c.name}`;
      uses.push({ label, action: a });
    }
    if (uses.length === 0) continue;
    const def = content.items[inst.itemId];
    out.push({ uid: inst.uid, name: def?.name ?? inst.itemId, qty: inst.qty, description: def?.description ?? '', uses });
  }
  return out;
}

// ---- the companion card (DESIGN §16.5 bottom right, §4.9) ----------------------------------------------------------------------

export interface CompanionCardModel {
  uid: string;
  companionId: string;
  name: string;
  hp: number;
  hpMax: number;
  ko: boolean;
  stance: Stance;
  stances: { stance: Stance; label: string; enabled: boolean; current: boolean }[];
  stanceNote: string | null;
  signature: { name: string; description: string; cooldown: number; enabled: boolean; reason: string | null; target: TileTarget; action: Action | null } | null;
  focus: { enabled: boolean; action: Action | null; label: string };
  hold: { enabled: boolean; action: Action | null };
  statuses: StatusChipModel[];
}

const STANCE_LABELS: Readonly<Record<Stance, string>> = { aggressive: 'Aggressive', guarded: 'Guarded', support: 'Support' };

export function companionCard(s: GameState, content: ContentPack, legal: Legal, target: string | null): CompanionCardModel | null {
  const combat = s.combat;
  if (combat === null) return null;
  const c = combat.party.find((p) => p.kind === 'companion');
  if (c === undefined) return null;
  const isLegal = legalSet(legal);
  const run = s.companions.recruited[c.refId];
  const stance = run?.stance ?? 'guarded';
  const def = content.companions[c.refId];
  const sigAbility = def === undefined ? undefined : content.abilities[def.signature.abilityId];
  let signature: CompanionCardModel['signature'] = null;
  if (sigAbility !== undefined) {
    const kind = targetKind(sigAbility);
    const action: Action | null =
      kind === 'enemy'
        ? target === null
          ? null
          : { type: 'companionCommand', command: 'signature', targetUid: target }
        : (legal.find((a) => a.type === 'companionCommand' && a.command === 'signature') ?? { type: 'companionCommand', command: 'signature' });
    const enabled = action !== null && isLegal(action);
    const problem = enabled ? null : commandProblem(content, combat, (action as Extract<Action, { type: 'companionCommand' }> | null) ?? { type: 'companionCommand', command: 'signature' });
    signature = {
      name: sigAbility.name,
      description: sigAbility.description,
      cooldown: c.cooldowns[sigAbility.id] ?? 0,
      enabled,
      reason: problem === null ? null : problem.includes('recharging') ? `Cooldown ${c.cooldowns[sigAbility.id] ?? 0}` : problem,
      target: kind,
      action: enabled ? action : null,
    };
  }
  const stances = STANCES.map((st) => ({ stance: st, label: STANCE_LABELS[st], enabled: isLegal({ type: 'setStance', stance: st }), current: st === stance }));
  const stanceNote = stances.some((x) => x.enabled) || !isActive(c) ? null : stanceProblem(s, stances.find((x) => !x.current)?.stance ?? 'guarded');
  const focusAction: Action | null = target === null ? null : { type: 'companionCommand', command: 'focus', targetUid: target };
  const targetName = target === null ? null : (combatantByUid(combat, target)?.name ?? null);
  const holdAction: Action = { type: 'companionCommand', command: 'hold' };
  return {
    uid: c.uid,
    companionId: c.refId,
    name: c.name,
    hp: Math.max(0, c.hp),
    hpMax: c.hpMax,
    ko: !c.alive,
    stance,
    stances,
    stanceNote,
    signature,
    focus: { enabled: focusAction !== null && isLegal(focusAction), action: focusAction, label: targetName === null ? 'Focus' : `Focus on ${targetName}` },
    hold: { enabled: isLegal(holdAction), action: holdAction },
    statuses: statusChips(content, c.statuses),
  };
}

// ---- communion (DESIGN §4.11, §16.5) ---------------------------------------------------------------------------------------------

export interface CommunionChoice {
  id: string;
  text: string;
  enabled: boolean;
  reason: string | null;
  action: Action;
}

export interface CommunionModel {
  bossName: string;
  /** Communing now (the bar swaps the abilities for Speak/Listen/Offer/Resist). */
  active: boolean;
  /** Not yet communing: the free Commune toggle, or Listen as the opener. */
  canToggle: boolean;
  canOpenByListening: boolean;
  /** Why it cannot open now (null while it can, or while it runs). */
  openReason: string | null;
  movement: number;
  resolve: number;
  resolveMax: number;
  /** "Question 1 of 6". */
  questionIndex: number;
  questionCount: number;
  question: string | null;
  answers: CommunionChoice[];
  listen: { enabled: boolean; reason: string | null };
  offers: CommunionChoice[];
  resist: boolean;
  /** The Resolution: the outcomes on offer; null before it. */
  resolution: CommunionChoice[] | null;
  lies: number;
}

/** "pass_into_before" → "Pass into before". */
export const humanize = (id: string): string => cap(id.replace(/_/g, ' '));

export const RESOLVE_MAX = 8;

/** The communion bar, or null when this fight has no creature that communes. */
export function communionModel(s: GameState, content: ContentPack, profile: Pr, legal: Legal): CommunionModel | null {
  const combat = s.combat;
  if (combat === null) return null;
  const cb = communionBoss(content, combat);
  if (cb === null) return null;
  const isLegal = legalSet(legal);
  const communion = combat.communion;
  const playerTurn = legal.some((a) => a.type === 'commune' || a.type === 'guard' || a.type === 'attack');
  if (communion === null) {
    if (s.meta.loop < 2) return null; // the Tyrant cannot hear anyone in Loop 1 (STORY §8): no bar at all
    const canToggle = isLegal({ type: 'commune', act: 'toggle' });
    const canListen = isLegal({ type: 'commune', act: 'listen' });
    const openReason = canToggle || canListen ? null : playerTurn ? openProblem(s, content, profile, combat, 'listen') : 'Not your turn';
    return {
      bossName: cb.boss.name,
      active: false,
      canToggle,
      canOpenByListening: canListen,
      openReason,
      movement: 0,
      resolve: 0,
      resolveMax: RESOLVE_MAX,
      questionIndex: 0,
      questionCount: 0,
      question: null,
      answers: [],
      listen: { enabled: canListen, reason: null },
      offers: [],
      resist: false,
      resolution: null,
      lies: 0,
    };
  }
  const spec = cb.spec;
  const movement = spec.movements[communion.movement - 1];
  const q = currentQuestion(spec, communion);
  const resolving = s.world.tyrant === 'spared';
  const usable = new Set(availableAnswers(s, profile, content, spec, communion).map((a) => a.id));
  const answers: CommunionChoice[] = resolving
    ? []
    : (q?.answers ?? []).map((a) => {
        const action: Action = { type: 'commune', act: 'speak', answerId: a.id };
        const enabled = isLegal(action);
        let reason: string | null = null;
        if (!enabled) {
          if (communion.usedAnswers.includes(a.id)) reason = 'Already said';
          else if (!usable.has(a.id)) {
            const missing = explain(a.when, s, profile, content).parts.filter((p) => !p.ok).map((p) => p.text);
            reason = missing.length > 0 ? `Needs ${missing.join('; ')}` : 'You cannot say this';
          } else reason = playerTurn ? (communeProblem(s, content, profile, combat, action as Extract<Action, { type: 'commune' }>) ?? null) : 'Not your turn';
        }
        return { id: a.id, text: a.text, enabled, reason, action };
      });
  const held = new Set(availableOffers(s, spec, communion).map((o) => o.itemId));
  const offers: CommunionChoice[] = resolving
    ? []
    : spec.offers.map((o) => {
        const action: Action = { type: 'commune', act: 'offer', itemId: o.itemId };
        const enabled = isLegal(action);
        const reason = enabled ? null : communion.usedAnswers.includes(o.itemId) ? 'Already shown' : !held.has(o.itemId) ? 'You do not carry it' : 'Not your turn';
        return { id: o.itemId, text: content.items[o.itemId]?.name ?? o.itemId, enabled, reason, action };
      });
  const listenAction: Action = { type: 'commune', act: 'listen' };
  const listenEnabled = !resolving && isLegal(listenAction);
  const resolution = resolving
    ? eligibleOutcomes(s, profile, content, spec, communion).map((o) => {
        const action: Action = { type: 'commune', act: 'speak', answerId: o.choiceId };
        return { id: o.choiceId, text: humanize(o.choiceId), enabled: isLegal(action), reason: null, action };
      })
    : null;
  return {
    bossName: cb.boss.name,
    active: true,
    canToggle: false,
    canOpenByListening: false,
    openReason: null,
    movement: communion.movement,
    resolve: communion.resolve,
    resolveMax: RESOLVE_MAX,
    questionIndex: q === undefined ? (movement?.questions.length ?? 0) : communion.questionIndex + 1,
    questionCount: movement?.questions.length ?? 0,
    question: q?.line ?? null,
    answers,
    listen: { enabled: listenEnabled, reason: listenEnabled ? null : communion.listened ? 'You have listened in this Movement' : resolving ? 'Only your answer remains' : 'Not your turn' },
    offers,
    resist: !resolving && isLegal({ type: 'commune', act: 'resist' }),
    resolution,
    lies: communion.lies,
  };
}

export interface CommunionButton {
  id: string;
  group: 'open' | 'speak' | 'listen' | 'offer' | 'resist' | 'resolution';
  label: string;
  enabled: boolean;
  reason: string | null;
  action: Action;
  /** 1–9 in displayed order while the communion runs (it owns the bar then); null before it opens. */
  key: string | null;
}

/** The communion bar's buttons in displayed order (DESIGN §4.11: Speak, Listen, Offer, Resist; then the Resolution). */
export function communionButtons(m: CommunionModel | null): CommunionButton[] {
  if (m === null) return [];
  const out: Omit<CommunionButton, 'key'>[] = [];
  if (!m.active) {
    if (m.canToggle) out.push({ id: 'toggle', group: 'open', label: 'Commune (free)', enabled: true, reason: null, action: { type: 'commune', act: 'toggle' } });
    if (m.canOpenByListening) out.push({ id: 'listen', group: 'open', label: 'Listen', enabled: true, reason: null, action: { type: 'commune', act: 'listen' } });
    return out.map((b) => ({ ...b, key: null }));
  }
  if (m.resolution !== null) {
    for (const c of m.resolution) out.push({ id: `outcome-${c.id}`, group: 'resolution', label: c.text, enabled: c.enabled, reason: c.reason, action: c.action });
  } else {
    for (const c of m.answers) out.push({ id: `speak-${c.id}`, group: 'speak', label: `Speak: ${c.text}`, enabled: c.enabled, reason: c.reason, action: c.action });
    out.push({ id: 'listen', group: 'listen', label: 'Listen', enabled: m.listen.enabled, reason: m.listen.reason, action: { type: 'commune', act: 'listen' } });
    for (const c of m.offers) out.push({ id: `offer-${c.id}`, group: 'offer', label: `Offer: ${c.text}`, enabled: c.enabled, reason: c.reason, action: c.action });
    out.push({ id: 'resist', group: 'resist', label: 'Resist', enabled: m.resist, reason: m.resist ? null : 'Not your turn', action: { type: 'commune', act: 'resist' } });
  }
  return out.map((b, i) => ({ ...b, key: i < 9 ? String(i + 1) : null }));
}

// ---- the log (DESIGN §16.5 centre; §4.3 explained) ------------------------------------------------------------------------------

export interface CombatLogLine {
  key: string;
  round: number;
  text: string;
  kind: string;
  /** The hit in plain words (DESIGN §4.3), when this session saw it happen. */
  explain: string[] | null;
}

/** The last `max` lines of the fight's log, oldest first, each with its explanation when one was recorded. */
export function combatLogLines(combat: CombatState | null, max: number, explained: ReadonlyMap<string, string[]> = new Map()): CombatLogLine[] {
  if (combat === null) return [];
  const from = Math.max(0, combat.log.length - max);
  return combat.log.slice(from).map((e, i) => {
    let found: string[] | null = null;
    for (const [prefix, steps] of explained) {
      if (prefix.startsWith(`${e.round}|`) && e.text.startsWith(prefix.slice(prefix.indexOf('|') + 1))) {
        found = steps;
        break;
      }
    }
    return { key: `${e.round}:${from + i}`, round: e.round, text: e.text, kind: e.kind, explain: found };
  });
}

const INTERPLAY_TEXT: ReadonlyMap<string, string> = new Map(INTERPLAY_TABLE.map((row) => [row.rule, `${row.trigger}: ${row.result}`]));

function sourceName(content: ContentPack, attacker: Combatant | undefined, kind: string, refId: string | null): string {
  if (refId === null) return kind === 'basic' ? 'Basic attack' : 'A blow';
  const ability = content.abilities[refId];
  if (ability !== undefined) return ability.name;
  const move = attacker === undefined ? undefined : content.creatures[attacker.refId]?.moves[refId];
  if (move !== undefined) return move.name;
  const status = content.statuses[refId];
  if (status !== undefined) return status.name;
  return content.items[refId]?.name ?? humanize(refId.replace(/^(itm|item|status)_/, ''));
}

/**
 * Each damaging hit of one step in plain words (DESIGN §4.3's steps the events and the state show: the source and its
 * type, a critical, the target's resistance, interplay, Weaken/Mark/Armor Break, what armor or ward and Guard took, what
 * a Shield took, the damage dealt). Keyed by `round|<the log line's opening>` ("3|Wayfinder hits Corrupted Shade for 12"),
 * which is how `combatLogLines` finds them. `before` is the state the step started from (names, statuses, Guard).
 */
export function explainHits(events: readonly GameEvent[], before: GameState, after: GameState, content: ContentPack): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const round = after.combat?.round ?? before.combat?.round ?? 0;
  const find = (uid: string): Combatant | undefined =>
    (before.combat === null ? undefined : combatantByUid(before.combat, uid)) ?? (after.combat === null ? undefined : combatantByUid(after.combat, uid));
  let crit = false;
  let interplay: string[] = [];
  let roundNow = round;
  for (const e of events) {
    if (e.t === 'turnStarted') roundNow = e.round;
    if (e.t === 'attackResolved') {
      crit = e.crit;
      interplay = [];
    }
    if (e.t === 'interplay') {
      const text = INTERPLAY_TEXT.get(e.rule);
      if (text !== undefined) interplay.push(text);
    }
    if (e.t !== 'damageDealt' || e.kind === 'status') continue;
    const attacker = find(e.sourceUid);
    const target = find(e.targetUid);
    if (attacker === undefined || target === undefined) continue;
    const steps: string[] = [];
    steps.push(`${sourceName(content, attacker, e.kind, e.refId)}: ${DAMAGE_TYPE_NAMES[e.damageType]} damage.`);
    if (crit) steps.push('A critical hit.');
    const resist = effectiveResistance(target, e.damageType);
    if (resist !== 'neutral') steps.push(`${target.name} is ${RESIST_WORDS[resist]}${resist === 'resist' ? '' : ' to'} ${DAMAGE_TYPE_NAMES[e.damageType]}: ${RESIST_MULTS[resist]}.`);
    for (const line of interplay) steps.push(`${line}.`);
    if (attacker.statuses.some((st) => st.statusId === 'status_weaken')) steps.push(`${attacker.name} is Weakened: ×0.75.`);
    if (target.statuses.some((st) => st.statusId === 'status_mark')) steps.push(`${target.name} is Marked: ×1.15.`);
    if (e.damageType === 'physical' && target.statuses.some((st) => st.statusId === 'status_armor_break')) steps.push('Armor Break: ×1.15, and armor does not count.');
    if (e.mitigated > 0) {
      const wall = e.damageType === 'physical' ? 'Armor' : 'Ward';
      steps.push(`${target.guarding ? `${wall} and Guard` : wall} took ${e.mitigated}.`);
    }
    if (e.absorbed > 0) steps.push(`The Shield took ${e.absorbed}.`);
    steps.push(`${e.amount} damage to ${target.kind === 'player' ? 'you' : target.name}.`);
    out.set(`${roundNow}|${attacker.name} hits ${target.name} for ${e.amount}`, steps);
    crit = false;
    interplay = [];
  }
  return out;
}

// ---- banners (DESIGN §4.10: phase changes and boss lines) ----------------------------------------------------------------------

export interface BannerModel {
  /** "Phase 2 of 3: The Fracture" when a boss entered a phase this round or the last. */
  title: string | null;
  lines: string[];
}

/** The phase change or boss line of this round or the last, read from the state (so a reload shows it too). */
export function bannerModel(combat: CombatState | null, content: ContentPack): BannerModel | null {
  if (combat === null) return null;
  const since = combat.round - 1;
  let title: string | null = null;
  for (const e of combat.enemies) {
    const phases = phasesOf(content, e);
    if (e.phase > 0 && phases.length > 1 && e.pattern.phaseEnteredRound >= since && isActive(e)) {
      title = `${e.name} · Phase ${e.phase + 1} of ${phases.length}: ${phases[e.phase]?.name ?? ''}`;
    }
  }
  const lines = combat.log.filter((l) => l.kind === 'phase' && l.round >= since).map((l) => l.text).slice(-3);
  return title === null && lines.length === 0 ? null : { title, lines };
}

// ---- the heading, the defeat, the aftermath ------------------------------------------------------------------------------------

/** "Corrupted Shade", "Corrupted Shade and Wildling Brute", "The Chronos Tyrant and 2 more". */
export function fightTitle(combat: CombatState | null): string {
  if (combat === null) return 'Combat';
  const names = [...new Set(combat.enemies.filter((e) => !e.fledOrGone).map((e) => e.name))];
  if (names.length === 0) return 'Combat';
  if (names.length === 1) return names[0] as string;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} more`;
}

export interface AftermathModel {
  result: 'victory' | 'fled' | 'defeat';
  title: string;
  lines: string[];
}

/** The summary after a fight that returned to explore (victory, flight, an arrest), from that step's events. */
export function aftermathModel(events: readonly GameEvent[], content: ContentPack): AftermathModel | null {
  const ended = events.find((e): e is Extract<GameEvent, { t: 'combatEnded' }> => e.t === 'combatEnded');
  if (ended === undefined) return null;
  const lines: string[] = [];
  const rounds = plural(ended.rounds, 'round');
  if (ended.result === 'victory') {
    lines.push(`Won in ${rounds}.`);
    if (ended.xp > 0) lines.push(`+${ended.xp} XP`);
    if (ended.gold > 0) lines.push(`+${ended.gold} gold`);
    for (const item of ended.loot) {
      const name = content.items[item.itemId]?.name ?? item.itemId;
      lines.push(`${name}${item.qty > 1 ? ` × ${item.qty}` : ''}${item.rarity === 'common' ? '' : ` (${item.rarity})`}`);
    }
    for (const e of events) if (e.t === 'levelUp') lines.push(`Level ${e.level}! ${plural(e.statPoints, 'stat point')} to spend.`);
    return { result: 'victory', title: 'Victory', lines };
  }
  if (ended.result === 'fled') return { result: 'fled', title: 'You got away', lines: [`After ${rounds}. No spoils.`] };
  return { result: 'defeat', title: 'Overcome', lines: [`After ${rounds}.`] };
}
