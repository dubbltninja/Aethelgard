// What the Explore screen draws (PLAN §6.3 `ExploreScreen`, DESIGN §16.2–16.3), as pure functions of the state, the
// pack, the profile and the legal-action list — so the screen's rules are unit-tested without React, and the view
// stays a function of props. Nothing here decides legality: an action is offered only if it is in `legal` (or, for
// `examine`, which legalActions lists only on request, `examinable`). Everything a button shows (cost, arrival time,
// lock reason) is read from the same engine helpers the reducers use.
import {
  BELL_NAMES,
  dawnsLeft,
  dayOf,
  describeLocation,
  evaluate,
  lockedReason,
  npcsAt,
  playerAbilityCost,
  visibleExits,
  watchNow,
  watchOf,
  xpToNext,
  type Action,
  type ContentPack,
  type GameState,
  type Profile,
  type Watch,
} from '@engine/index';
import type { Dir, LocationArt } from '@schema/location';
import { patchArt } from '../art/Scene';
import type { IconKind } from '../art/Icon';

type Pr = Readonly<Profile>;

const cap = (s: string): string => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1));
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The legal list as a membership test (actions compared by their canonical JSON). */
export function legalSet(legal: readonly Action[]): (action: Action) => boolean {
  const keys = new Set(legal.map(keyOf));
  return (action) => keys.has(keyOf(action));
}

/** Key order independent: `{ type, to }` and `{ to, type }` are the same action. */
function keyOf(action: Action): string {
  const entries = Object.entries(action).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

// ---- time --------------------------------------------------------------------------------------------------------------------

export const WATCH_LABELS: Readonly<Record<Watch, string>> = { 0: 'Dawn', 1: 'Day', 2: 'Dusk', 3: 'Night' };

/** "Dusk" (same day) or "Day 8 · Dawn" (a later day) — where `ticks + watches` lands. */
export function arrivalText(ticks: number, watches: number): string {
  const at = ticks + watches;
  const label = WATCH_LABELS[watchOf(at)];
  return dayOf(at) === dayOf(ticks) ? label : `Day ${dayOf(at)} · ${label}`;
}

// ---- the clock chip (DESIGN §16.2, §10.1) -----------------------------------------------------------------------------

/** DESIGN §10.1's HUD column: amber from 10 dawns, pulsing from 5, red from 2, bold red on the last. */
export type ClockLevel = 'calm' | 'amber' | 'amber-pulse' | 'red' | 'red-bold' | 'expired';

export interface ClockModel {
  /** `loop1`: the small "Day 7 · Dusk"; `breach`: Loop 2+ "Breach Clock · Day 7 · 23 dawns left"; `before`: the echo's Bells. */
  kind: 'loop1' | 'breach' | 'before';
  /** The chip's visible text. */
  text: string;
  /** The full sentence for assistive tech. */
  label: string;
  level: ClockLevel;
  day: number;
  watch: string;
  dawnsLeft: number;
  /** HUD detail: the clock's audit trail ("Heartstone stabilized: +6 days"). */
  modifiers: string[];
}

export interface ClockInput {
  loop: number;
  ticks: number;
  limitTicks: number;
  frozen: boolean;
  expired: boolean;
  hordeActive: boolean;
  before: { day: 1 | 2 | 3; resets: number } | null;
  /** The Before's own hour (conditions.ts `watchNow`); defaults to the clock's watch. */
  watch?: Watch;
  modifiers?: readonly { source: string; watches: number }[];
}

export function clockLevel(dawns: number, expired: boolean): ClockLevel {
  if (expired || dawns <= 0) return 'expired';
  if (dawns <= 1) return 'red-bold';
  if (dawns <= 2) return 'red';
  if (dawns <= 5) return 'amber-pulse';
  if (dawns <= 10) return 'amber';
  return 'calm';
}

function modifierText(m: { source: string; watches: number }): string {
  const days = m.watches / 4;
  const amount = Number.isInteger(days) ? plural(Math.abs(days), 'day') : plural(Math.abs(m.watches), 'watch', 'watches');
  return `${m.source}: ${m.watches >= 0 ? '+' : '−'}${amount}`;
}

export function clockModel(c: ClockInput): ClockModel {
  const day = dayOf(c.ticks);
  const watchIndex = c.watch ?? watchOf(c.ticks);
  const watch = WATCH_LABELS[watchIndex];
  const dawns = Math.max(0, dawnsLeft(c));
  const modifiers = (c.modifiers ?? []).map(modifierText);
  if (c.before !== null) {
    const bell = BELL_NAMES[c.before.day];
    return {
      kind: 'before',
      text: `${bell} · ${watch}`,
      label: `Silverwood Before, ${bell}, ${watch.toLowerCase()}. The Breach Clock is still here.`,
      level: 'calm',
      day,
      watch,
      dawnsLeft: dawns,
      modifiers,
    };
  }
  if (c.loop <= 1) {
    // Loop 1 keeps the counter subtle (DESIGN §10.1): the day and the watch, no countdown, no colour.
    return { kind: 'loop1', text: `Day ${day} · ${watch}`, label: `Day ${day}, ${watch.toLowerCase()}.`, level: 'calm', day, watch, dawnsLeft: dawns, modifiers };
  }
  const level = clockLevel(dawns, c.expired);
  const left = level === 'expired' ? 'the Breach is open' : `${plural(dawns, 'dawn')} left`;
  return {
    kind: 'breach',
    text: `Breach Clock · Day ${day} · ${left}`,
    label: `Breach Clock: day ${day}, ${watch.toLowerCase()}, ${left}.${c.hordeActive ? ' The Horde is moving.' : ''}`,
    level,
    day,
    watch,
    dawnsLeft: dawns,
    modifiers,
  };
}

// ---- the HUD (DESIGN §16.2) ------------------------------------------------------------------------------------------------

export interface HudStatus {
  id: string;
  name: string;
  /** Watches or turns left, when the status counts down. */
  left: number | null;
  icon: IconKind;
}

export interface HudModel {
  name: string;
  className: string;
  level: number;
  xp: number;
  /** XP to the next level; null at the cap. */
  xpNext: number | null;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  resourceName: string;
  gold: number;
  loop: number;
  corruption: number;
  corruptionMax: number;
  /** DESIGN §16.2: the pips appear after the first spellbook (or once there is any Corruption). */
  showCorruption: boolean;
  statuses: HudStatus[];
  /** `npcId`: the companion's person, whose small portrait the chip shows (U73a). */
  companion: { name: string; hp: number; hpMax: number; stance: string; ko: boolean; npcId?: string } | null;
  statPoints: number;
  /** Unspent ability points (whole and half points, DESIGN §5.1). */
  abilityPoints: number;
  stats: { strength: number; magic: number; agility: number };
  clock: ClockModel;
}

const STATUS_ICONS: Readonly<Record<string, IconKind>> = {
  status_poison: 'status_poison',
  status_bleed: 'status_bleed',
  status_curse: 'status_curse',
  status_rested: 'status_rested',
};

export function hudModel(s: GameState, content: ContentPack): HudModel {
  const p = s.player;
  const cls = content.classes[p.classId];
  const active = s.companions.activeId === null ? undefined : s.companions.recruited[s.companions.activeId];
  const companionDef = active === undefined ? undefined : content.companions[active.id];
  return {
    name: p.name,
    className: cls?.name ?? p.classId,
    level: p.level,
    xp: p.xp,
    xpNext: xpToNext(p.level, content) ?? null,
    hp: p.hp,
    hpMax: p.hpMax,
    mp: p.mp,
    mpMax: p.mpMax,
    resourceName: cls?.resource.name ?? 'Mana',
    gold: p.gold,
    loop: s.meta.loop,
    corruption: p.corruption,
    corruptionMax: content.config.corruptionMax,
    showCorruption: p.corruption > 0 || (p.uses.spellbooksRead?.count ?? 0) > 0,
    statuses: p.statuses.map((st) => ({
      id: st.statusId,
      name: content.statuses[st.statusId]?.name ?? st.statusId,
      left: st.duration > 0 ? st.duration : null,
      icon: STATUS_ICONS[st.statusId] ?? 'danger',
    })),
    companion:
      active === undefined
        ? null
        : {
            name: companionDef?.name ?? active.id,
            hp: active.hp,
            hpMax: active.hpMax,
            stance: cap(active.stance),
            ko: active.ko,
            ...(companionDef === undefined ? {} : { npcId: companionDef.npcId }),
          },
    statPoints: p.statPoints,
    abilityPoints: p.apHalf / 2,
    stats: { ...p.stats },
    clock: clockModel({
      loop: s.meta.loop,
      ticks: s.clock.ticks,
      limitTicks: s.clock.limitTicks,
      frozen: s.clock.frozen,
      expired: s.clock.expired,
      hordeActive: s.world.hordeActive,
      before: s.before,
      watch: watchNow(s),
      modifiers: s.clock.modifiers,
    }),
  };
}

// ---- the place --------------------------------------------------------------------------------------------------------------

export interface PlaceModel {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
  /** "Lv 1–2". */
  band: string;
  /** Short facts beside the name: "Camp", "Inn · 10 gold", "Safe", "Forge". */
  facts: string[];
  /** The description now: its first matching variant, + the infected line (engine `describeLocation`). */
  description: string;
  /** What happened here on the last step: the location's event lines (arrival, rest, interact). */
  notes: string[];
  art: LocationArt;
  infected: boolean;
}

/** The location's art with every variant whose condition holds applied in order. */
export function resolvedArt(s: GameState, content: ContentPack, profile: Pr, locationId: string): LocationArt | undefined {
  const loc = content.locations[locationId];
  if (loc === undefined) return undefined;
  return loc.art.variants.reduce((art, v) => (evaluate(v.when, s, profile, content) ? patchArt(art, v.patch) : art), loc.art);
}

export function placeModel(s: GameState, content: ContentPack, profile: Pr): PlaceModel | null {
  const loc = content.locations[s.world.currentLocationId];
  if (loc === undefined) return null;
  const region = content.regions[loc.regionId];
  const band = loc.levelBand ?? region?.levelBand;
  const facts: string[] = [];
  // U84 (REPORT U79 #13): a rest whose `when` fails is not shown (the Library's nook said "Camp" before Ilyra opened it)
  const rest = loc.rest !== undefined && (loc.rest.when === undefined || evaluate(loc.rest.when, s, profile, content)) ? loc.rest : undefined;
  if (rest !== undefined) facts.push(rest.kind === 'inn' ? `Inn · ${plural(rest.cost, 'gold', 'gold')}` : rest.kind === 'wild' ? 'Wild camp' : cap(rest.kind));
  if (loc.merchantId !== undefined) facts.push(`Trader: ${content.npcs[loc.merchantId]?.name ?? loc.merchantId}`);
  if (loc.craftingStation !== undefined) facts.push(loc.craftingStation === 'forge' ? 'Forge' : cap(loc.craftingStation));
  if (loc.safe) facts.push('Safe');
  const last = s.meta.stepCount - 1;
  const notes = s.recentLog.filter((e) => e.step === last && e.kind === 'event').map((e) => e.text);
  return {
    id: loc.id,
    name: loc.name,
    regionId: loc.regionId,
    regionName: region?.name ?? loc.regionId,
    band: band === undefined ? '' : band.min === band.max ? `Lv ${band.min}` : `Lv ${band.min}–${band.max}`,
    facts,
    description: describeLocation(s, content, profile, loc),
    notes,
    art: resolvedArt(s, content, profile, loc.id) ?? loc.art,
    infected: s.world.infected.includes(loc.id),
  };
}

// ---- the danger cue (U84, D-149 #1; DESIGN §16.6) -----------------------------------------------------------------------------

/**
 * A place whose level band starts above the party's level, in words (never colour alone): "Dangerous (L8+)" when it
 * starts 1–2 levels above, "Deadly (L12+)" when 3 or more; null at or below the party's level, or for a safe place.
 */
export function threatCue(content: ContentPack, locationId: string, level: number): string | null {
  const loc = content.locations[locationId];
  if (loc === undefined || loc.safe) return null;
  const band = loc.levelBand ?? content.regions[loc.regionId]?.levelBand;
  if (band === undefined || band.min <= level) return null;
  return `${band.min - level >= 3 ? 'Deadly' : 'Dangerous'} (L${band.min}+)`;
}

// ---- exits (ExitBar) ---------------------------------------------------------------------------------------------------------

export const DIR_ORDER: readonly Dir[] = ['north', 'east', 'south', 'west', 'up', 'down', 'in', 'out', 'portal', 'path'];
export const DIR_LABELS: Readonly<Record<Dir, string>> = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
  up: 'Up',
  down: 'Down',
  in: 'In',
  out: 'Out',
  portal: 'Portal',
  path: 'Path',
};
/** Arrow keys select the exit with this direction (DESIGN §16.3: WASD/arrows select exit, Enter travels). */
export const ARROW_DIRS: Readonly<Record<string, Dir>> = { arrowup: 'north', arrowdown: 'south', arrowleft: 'west', arrowright: 'east' };

export interface ExitRow {
  to: string;
  dir: Dir;
  dirLabel: string;
  name: string;
  /** The exit's own words ("a hard climb north"), when content gives them. */
  label: string | null;
  watches: number;
  /** "1 watch", "2 watches", or "No time passes" while the clock is frozen. */
  cost: string;
  /** Where the clock lands: "Dusk", "Day 8 · Dawn" (null when no time passes). */
  arrive: string | null;
  state: 'open' | 'locked';
  /** `move` is legal now. */
  canGo: boolean;
  /** Locked: `lockedText` and the failing conditions (engine `lockedReason`). */
  reason: string | null;
  /** The destination is Horde-infected: entering costs HP. */
  danger: string | null;
  /** U84: the destination's band starts above the party's level: "Dangerous (L8+)" / "Deadly (L12+)" (`threatCue`). */
  threat?: string | null;
  road: boolean;
}

export function exitRows(s: GameState, content: ContentPack, profile: Pr, legal: readonly Action[]): ExitRow[] {
  const isLegal = legalSet(legal);
  const here = s.world.currentLocationId;
  const seen = new Set<string>();
  const rows: ExitRow[] = [];
  const hpPct = Math.round(content.config.hordeDamagePctMaxHp * 100);
  for (const { exit, state } of visibleExits(s, content, profile)) {
    if (seen.has(exit.to)) continue;
    seen.add(exit.to);
    const watches = s.clock.frozen ? 0 : exit.travelWatches;
    const infected = s.world.infected.includes(exit.to);
    rows.push({
      to: exit.to,
      dir: exit.dir,
      dirLabel: DIR_LABELS[exit.dir],
      name: content.locations[exit.to]?.name ?? exit.to,
      label: exit.label ?? null,
      watches,
      cost: watches === 0 ? 'No time passes' : plural(watches, 'watch', 'watches'),
      arrive: watches === 0 ? null : arrivalText(s.clock.ticks, watches),
      state,
      canGo: isLegal({ type: 'move', to: exit.to }),
      reason: state === 'locked' ? lockedReason(s, content, profile, here, exit) : null,
      danger: infected ? exit.dangerText ?? `⚠ −${hpPct}% HP: the Horde is there` : null,
      threat: threatCue(content, exit.to, s.player.level),
      road: exit.kind === 'road',
    });
  }
  const order = (d: Dir): number => DIR_ORDER.indexOf(d);
  return rows.sort((a, b) => order(a.dir) - order(b.dir));
}

// ---- people and things -------------------------------------------------------------------------------------------------------

export interface NpcRow {
  id: string;
  name: string;
  role: string | null;
  canTalk: boolean;
}

export function npcRows(s: GameState, content: ContentPack, profile: Pr, legal: readonly Action[]): NpcRow[] {
  const isLegal = legalSet(legal);
  return npcsAt(s, content, profile, s.world.currentLocationId).map((id) => {
    const npc = content.npcs[id];
    const role = npc?.roles[0];
    return { id, name: npc?.name ?? id, role: role === undefined ? null : cap(role), canTalk: isLegal({ type: 'talk', npcId: id }) };
  });
}

export interface ItemRow {
  uid: string;
  name: string;
  qty: number;
  rarity: string;
  canTake: boolean;
}

export function itemRows(s: GameState, content: ContentPack, legal: readonly Action[]): ItemRow[] {
  const isLegal = legalSet(legal);
  const ground = s.world.locationStates[s.world.currentLocationId]?.items ?? [];
  return ground.map((item) => ({
    uid: item.uid,
    name: content.items[item.itemId]?.name ?? item.itemId,
    qty: item.qty,
    rarity: item.rarity,
    canTake: isLegal({ type: 'take', uid: item.uid }),
  }));
}

// ---- actions (ActionBar) -----------------------------------------------------------------------------------------------------

export interface ActionRow {
  /** Stable key (and the e2e handle): `rest-short`, `gather-mat_x`, `interact-ev_y` … */
  id: string;
  label: string;
  detail: string | null;
  icon: IconKind;
  /** The engine action this button dispatches; absent for panel buttons. */
  action?: Action;
  /** A panel this button opens instead (merchant, forge) — offered only when it exists. */
  panel?: 'merchant' | 'crafting' | 'camp';
  /** Ask first: the button ends the loop or cannot be undone. */
  confirm?: string;
  danger?: boolean;
}

export interface ActionInput {
  /** `examine` the location (listed by legalActions only on request). */
  canLook: boolean;
  /** `shell.canOpen` for the merchant, forge and camp panels (U67). */
  canOpenPanel: (id: 'merchant' | 'crafting' | 'camp') => boolean;
}

/** Every location-level explore action that is legal now, in a fixed order (PLAN §6.3 ActionBar). */
export function actionRows(s: GameState, content: ContentPack, legal: readonly Action[], input: ActionInput): ActionRow[] {
  const isLegal = legalSet(legal);
  const loc = content.locations[s.world.currentLocationId];
  const rows: ActionRow[] = [];
  if (loc === undefined) return rows;
  const frozen = s.clock.frozen;
  const ticks = s.clock.ticks;

  if (input.canLook) rows.push({ id: 'look', label: 'Look around', detail: 'No time passes', icon: 'look', action: { type: 'examine', target: { kind: 'location' } } });
  if (isLegal({ type: 'takeAll' })) rows.push({ id: 'take-all', label: 'Take everything', detail: null, icon: 'take', action: { type: 'takeAll' } });

  for (const a of legal) {
    if (a.type !== 'gather') continue;
    const nodes = loc.gather ?? [];
    const node = a.itemId === undefined ? nodes[0] : nodes.find((n) => n.itemId === a.itemId);
    if (node === undefined) continue;
    const name = content.items[node.itemId]?.name ?? node.itemId;
    rows.push({ id: `gather-${node.itemId}`, label: `Gather ${name}`, detail: `Up to ${node.perDay} a day`, icon: 'gather', action: a });
  }

  const rest = loc.rest;
  if (rest !== undefined && isLegal({ type: 'rest', kind: 'short' })) {
    const heal = `+${Math.round(content.config.restShortPct * 100)}% HP and MP`;
    rows.push({
      id: 'rest-short',
      label: 'Short rest',
      detail: frozen ? heal : `1 watch → ${arrivalText(ticks, 1)} · ${heal}`,
      icon: 'rest',
      action: { type: 'rest', kind: 'short' },
    });
  }
  if (rest !== undefined && isLegal({ type: 'rest', kind: 'full' })) {
    const toDawn = 4 - watchOf(ticks);
    const where = rest.kind === 'inn' ? `A bed${rest.cost > 0 ? ` · ${rest.cost} gold` : ''}` : 'Sleep';
    const until = s.before !== null ? (s.before.day < 3 ? `until ${BELL_NAMES[(s.before.day + 1) as 2 | 3]}` : 'until Last Bell’s dusk') : `until ${arrivalText(ticks, toDawn)}`;
    rows.push({ id: 'rest-full', label: 'Full rest', detail: `${where} ${until}`, icon: 'rest_full', action: { type: 'rest', kind: 'full' } });
  }
  if (isLegal({ type: 'wait' })) rows.push({ id: 'wait', label: 'Wait', detail: `1 watch → ${arrivalText(ticks, 1)}`, icon: 'wait', action: { type: 'wait' } });
  if (isLegal({ type: 'retreat' }) && s.world.previousLocationId !== null) {
    const back = content.locations[s.world.previousLocationId]?.name ?? s.world.previousLocationId;
    rows.push({ id: 'retreat', label: `Go back to ${back}`, detail: 'The way you came, no new encounter', icon: 'retreat', action: { type: 'retreat' } });
  }
  for (const a of legal) {
    if (a.type !== 'interact') continue;
    const ev = loc.events.find((e) => e.id === a.eventId);
    rows.push({ id: `interact-${a.eventId}`, label: ev?.label ?? a.eventId, detail: null, icon: 'interact', action: a });
  }
  for (const a of legal) {
    if (a.type !== 'ability' || a.targetUid !== undefined) continue;
    const ability = content.abilities[a.abilityId];
    const cost = playerAbilityCost(s, content, a.abilityId);
    const parts: string[] = [];
    if (cost.mpPaid > 0) parts.push(`${cost.mpPaid} ${content.classes[s.player.classId]?.resource.name ?? 'MP'}`);
    if (cost.hp > 0) parts.push(`${cost.hp} HP`);
    rows.push({ id: `ability-${a.abilityId}`, label: ability?.name ?? a.abilityId, detail: parts.length > 0 ? parts.join(' · ') : null, icon: 'ability', action: a });
  }
  if (loc.merchantId !== undefined && input.canOpenPanel('merchant')) {
    rows.push({ id: 'merchant', label: `Trade with ${content.npcs[loc.merchantId]?.name ?? 'the merchant'}`, detail: null, icon: 'merchant', panel: 'merchant' });
  }
  if (loc.craftingStation !== undefined && input.canOpenPanel('crafting')) {
    rows.push({ id: 'forge', label: loc.craftingStation === 'forge' ? 'Use the forge' : 'Craft', detail: null, icon: 'forge', panel: 'crafting' });
  }
  if (rest !== undefined && input.canOpenPanel('camp')) {
    rows.push({ id: 'camp', label: rest.kind === 'inn' ? 'The inn' : 'Camp', detail: 'Rest, company, your path', icon: 'rest', panel: 'camp' });
  }
  if (isLegal({ type: 'enterPortal' })) {
    rows.push({ id: 'portal', label: 'Step through the portal', detail: 'Leave this loop', icon: 'portal', action: { type: 'enterPortal' }, confirm: 'Step through the portal? This loop ends.' });
  }
  if (isLegal({ type: 'keepVigil' })) {
    rows.push({ id: 'vigil', label: 'Keep the vigil', detail: 'Wait here for the last dawn', icon: 'vigil', action: { type: 'keepVigil' }, confirm: 'Keep the vigil? The days pass until the last dawn.' });
  }
  if (isLegal({ type: 'letGo' })) {
    rows.push({ id: 'let-go', label: 'Let go', detail: 'End this loop here', icon: 'leave', action: { type: 'letGo' }, confirm: 'Let go? This loop ends here.', danger: true });
  }
  return rows;
}

/** The first NPC `talk` reaches (T). */
export function firstTalk(npcs: readonly NpcRow[]): NpcRow | undefined {
  return npcs.find((n) => n.canTalk);
}

// ---- the log -----------------------------------------------------------------------------------------------------------------

export interface LogLine {
  key: string;
  text: string;
  kind: string;
}

/** The last `max` lines of the run's recent log, oldest first. */
export function logLines(s: GameState, max: number): LogLine[] {
  const from = Math.max(0, s.recentLog.length - max);
  return s.recentLog.slice(from).map((e, i) => ({ key: `${e.step}:${from + i}`, text: e.text, kind: e.kind }));
}
