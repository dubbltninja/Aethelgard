// The Horde (DESIGN §4.7, §10.2; WORLD §10.7, §12.1 `ws_horde` / `ws_infected` / `ws_brak_at_apex` / `ws_portal_ilyra`;
// STORY §4.1 beats 13–16, §4.3, §8.6, §10.7; PLAN §4.11; D-060, D-066 #7, D-069.6, WORLD R10-3). U30.
//
// Start — when either Tyrant dies in combat (`hordePostStep`, the first step the fight is over: delay 1, legacy) or at
// clock expiry (`expireClock`, reducers/loop.ts: delay 3). A Horde already running is never restarted. On start:
// `hordeActive`, its cause and delay, the Apex infected, `flag_horde_active` and `flag_library_portal_open` (WORLD
// §12.1), Ilyra moves to the Shattered Library to hold the portal, `echo_horde_path` ("witness the Horde once",
// STORY §12), and any autosave checkpoint of that step is withdrawn (D-067.1). A kill also sets `world.tyrant`
// 'defeated' (`tyrantResolved`) and plays the legacy defeat sequence; where WORLD's `ws_brak_at_apex` holds — both of
// Brak's legacy quests done this loop and not `flag_brak_kept_away`; not when `echo_brak_lives` was earned this loop
// (he holds the Nexus, STORY §7.2 C) — Brak makes his last stand: he leaves his home node, dies holding the line
// (`companionDied` if recruited) and `echo_brak_death` is granted.
//
// Spread (legacy `spread_horde`, WORLD §10.7) — once per player move (`move` / `retreat` arrivals, an ARRIVAL_HOOKS
// entry run before Dask's rule and the encounter roll): the first `hordeDelay` moves only count down; then pending
// edges resolve, then every node infected before this move infects its neighbours over every present-day exit except
// portal edges (locks ignored; a road only once its gate holds; never into Silverwood Before or the Threshold). A slow
// edge (`HORDE_EDGE_DELAYS`) holds its neighbour back that many extra moves. Entering an infected node costs
// ⌈max HP × `hordeDamagePctMaxHp`⌉ (⅓) and skips that move's spread; at 0 HP the player dies in the Horde:
// `closer_fall`, reason `expiry` in an expiry Horde and `death` in a Tyrant Horde — in Loop 1 too (no FALLEN screen).
//
// The portal — `enterPortal` at the Library while the Horde runs, or when content opened it on purpose with
// `flag_library_portal_open` (Ilyra's deliberate tear, STORY §10.7) → `portalEntered`, `closer_escape`.
//
// Engine-granted Echoes are granted only when the pack defines them (`grantKnownEcho`), so a partial pack never
// carries an Echo id it cannot describe.
import type { Exit } from '@schema/location';
import { evaluate } from './conditions';
import type { ContentPack, StepCtx } from './ctx';
import { apply, locationState } from './effects';
import type { Enumerator } from './legalActions';
import type { ArrivalHook } from './reducers/explore';
import type { PostStepHook } from './step';
import type { CloserReason } from './types/ids';
import type { Profile } from './types/profile';
import type { GameState } from './types/state';

/** Where every Horde starts (WORLD §3.5): the Tyrant's node. */
export const HORDE_SOURCE_ID = 'loc_temporal_breach_apex';
/** Ilyra's portal (WORLD §3.1): the Shattered Library. */
export const PORTAL_LOCATION_ID = 'loc_shattered_library';
/** The legacy one-move delay after a Tyrant kill (`handle_chronos_tyrant_defeat`; WORLD R10-3). */
export const TYRANT_HORDE_DELAY = 1;
/** WORLD §12.1 `ws_horde`: set for the loop when a Horde starts. */
export const FLAG_HORDE_ACTIVE = 'flag_horde_active';
/** WORLD §12.1: the Library portal is open (any Horde; content may also set it for Ilyra's deliberate tear). */
export const FLAG_LIBRARY_PORTAL_OPEN = 'flag_library_portal_open';
/**
 * Moves made since the Horde began (a `counters.custom` entry content reads with `{ counter: { name: 'horde_moves' } }`):
 * WORLD §3.1 / §11 — the Unraveling Tide blocks the Darkened Corridor after move 14 (U42, D-091).
 */
export const HORDE_MOVES_COUNTER = 'horde_moves';
/** reducers/combat.ts `FLAG_TYRANT_DEAD` (not imported: import cycle). */
const FLAG_TYRANT_DEAD = 'flag_tyrant_dead';
/** STORY §7.2 outcome A of `q_the_line_he_holds`. */
export const FLAG_BRAK_KEPT_AWAY = 'flag_brak_kept_away';
/** WORLD §12.1 `ws_brak_at_apex`: Brak comes to the Apex when both his legacy quests are done this loop (D-017). */
export const BRAK_QUESTS: readonly string[] = ['q_clear_path', 'q_blighted_outpost'];
export const BRAK_COMPANION_ID = 'brak';
export const BRAK_NPC_ID = 'npc_brak';
export const ILYRA_NPC_ID = 'npc_ilyra';
export const ECHO_HORDE_PATH = 'echo_horde_path';
export const ECHO_BRAK_DEATH = 'echo_brak_death';
export const ECHO_BRAK_LIVES = 'echo_brak_lives';
/** WORLD §10.7: the spread never reaches the Before or the Threshold (they lie behind portal edges). */
export const NEVER_INFECTED_REGIONS: readonly string[] = ['region_silverwood_before', 'region_threshold'];
/**
 * WORLD §10.7 slow edges, `from->to` → extra moves: the legacy Mistwood Path → Silverwood Plaza (2) and the Emberforge's
 * heat (1). Engine constants: the exit schema has no field for them (C1).
 */
export const HORDE_EDGE_DELAYS: Readonly<Record<string, number>> = {
  'loc_mistwood_path->loc_silverwood_plaza': 2,
  'loc_blighted_outpost->loc_emberforge': 1,
};

/** Engine-only markers in `LocationState.flags`. */
const MARK_BRAK_STOOD = 'horde:brak_stood';
const MARK_BRAK_MOURNED = 'horde:brak_mourned';
const MARK_ILYRA_BRIEFED = 'horde:ilyra_briefed';

/** The lines the Horde plays (legacy verbatim unless marked; the legacy "dust,," typo corrected, STORY §4.1 beat 13). */
export const HORDE_TEXT = {
  tyrantFalls: [
    'As the Chronos Tyrant begins to crumble into a pile of temporal dust, a guttural, echoing scream tears through the Apex.',
    "'You have undone the threads! Now, witness the unraveling!' it shrieks, its voice a chorus of countless dying moments.",
  ],
  brakArrives: 'Brak Stonehand, his face grim and scarred, bursts into the Apex, his heavy axe already drawn.',
  collapse: [
    'The very air shatters, and from the newly formed chasms, a cacophony of screeches erupts! A tide of grotesque creatures, their eyes burning with hunger, surges towards you.',
    'The Temporal Breach spills outward in a cascading collapse. The creatures surge forth, tearing at the fabric of stable reality.',
  ],
  brakSpeech: [
    "Brak: Wayfinder! There's no time! The Tyrant's defeat has shattered its hold, and the Temporal Breach is fully unraveling! Reality itself is collapsing! A raw portal has just bloomed in the Shattered Library - Ilyra is there, Wayfinder, using all her Remnant power to hold it open! It's your only way out! You must reach it before this unraveling chaos, the true horrors of the Sundering, swallows the path and seals your last escape!",
    "Brak: Go! I'll hold them back as long as I can! Don't look back, Wayfinder! Run!",
  ],
  portalPulse:
    'A new pulse blooms in the Shattered Library, a raw portal clawing at the air. Its light flickers like a heartbeat on the verge of collapse. Reach it before the unraveling swallows the path and the last escape seals.',
  brakMourned:
    'Brak gave me a chance to get out of there and make it to the portal before the unraveling swallows Aethelgard. His sacrifice will not be forgotten.',
  /** STORY §4.3 (new; reuses legacy phrases). */
  expiry:
    'The thirtieth dawn does not come up. The sky tears instead, east to west, a seam of no-colour. From the Apex, across every mile between, a scream reaches you: guttural, echoing, a chorus of countless dying moments. The Tyrant has not been touched. It is screaming anyway.',
  lash: (damage: number): string =>
    `The temporal collapse lashes out as you push through. Reality frays around you, and claws rake your skin, leaving bloody lacerations. You take ${damage} damage.`,
  ilyraAtPortal:
    "Ilyra: Wayfinder! You made it! This portal... it's not just a way from Aethelgard, it's a tear through the Temporal Breach itself!... Go! Escape... and remember!",
  noPortal: 'There is no portal to enter.',
  noPortalHere: 'You see no portal here.',
} as const;

// ---- shared helpers --------------------------------------------------------------------------------------------------

/** Grants an engine-sourced Echo (STORY §12) if the pack defines it; returns whether it did. */
export function grantKnownEcho(ctx: StepCtx, echoId: string, source: string): boolean {
  if (ctx.content.echoes[echoId] === undefined) return false;
  apply({ grantEcho: echoId as `echo_${string}` }, ctx, { source });
  return true;
}

/** Moves an NPC (null = gone from the map) if the pack knows them; emits `npcMoved` on a change. */
function moveNpc(ctx: StepCtx, npcId: string, to: string | null): void {
  if (ctx.content.npcs[npcId] === undefined) return;
  const overrides = ctx.s.world.npcOverrides;
  const current = overrides[npcId];
  if (current !== undefined && current.location === to) return;
  overrides[npcId] = { location: to };
  ctx.emit({ t: 'npcMoved', npcId, to });
}

/** `closer_fall`'s reason for a death while a Horde runs (DESIGN §10.2; PLAN §4.11). */
export const hordeFallReason = (s: GameState): CloserReason => (s.world.hordeCause === 'expiry' ? 'expiry' : 'death');

/** WORLD §10.7: ⌈max HP × pct⌉, at least 1 (rounded at 6 places first so ⅓ of 99 is 33, not 34). */
export function hordeEntryDamage(hpMax: number, pct: number): number {
  return Math.max(1, Math.ceil(Math.round(hpMax * pct * 1e6) / 1e6));
}

// ---- start ----------------------------------------------------------------------------------------------------------

/** Starts the Horde at the Apex (see the file header); a Horde already running is left as it is. */
export function startHorde(ctx: StepCtx, cause: 'tyrant' | 'expiry', delay: number): void {
  const { s } = ctx;
  const w = s.world;
  if (w.hordeActive) return;
  w.hordeActive = true;
  w.hordeCause = cause;
  w.hordeDelay = delay;
  w.infected = [HORDE_SOURCE_ID];
  w.hordePending = {};
  s.flags[FLAG_HORDE_ACTIVE] = true;
  s.flags[FLAG_LIBRARY_PORTAL_OPEN] = true;
  // D-067.1, PLAN §4.12: no autosave in a Horde — a checkpoint this step emitted before it began (the fight's end, the
  // arrival that crossed the limit) is withdrawn, since the state the step returns is already in the Horde.
  for (let i = ctx.events.length - 1; i >= 0; i--) if (ctx.events[i]?.t === 'autosaveCheckpoint') ctx.events.splice(i, 1);
  ctx.emit({ t: 'hordeStarted', cause, delay });
  ctx.emit({ t: 'hordeSpread', infected: [HORDE_SOURCE_ID] });
  moveNpc(ctx, ILYRA_NPC_ID, PORTAL_LOCATION_ID);
  grantKnownEcho(ctx, ECHO_HORDE_PATH, 'horde');
}

/** WORLD §12.1 `ws_brak_at_apex` (+ STORY §7.2 outcome C): does Brak stand at the Apex when the Tyrant falls? */
export function brakComesToApex(s: GameState): boolean {
  return BRAK_QUESTS.every((q) => s.quests[q]?.status === 'completed') && s.flags[FLAG_BRAK_KEPT_AWAY] !== true && !s.echoesThisLoop.includes(ECHO_BRAK_LIVES);
}

/** Brak's last stand (D-017, STORY §4.1 beat 13, §7.2): gone from his home node, dead if recruited, `echo_brak_death`. */
function brakStand(ctx: StepCtx): void {
  const { s } = ctx;
  moveNpc(ctx, BRAK_NPC_ID, null);
  const brak = s.companions.recruited[BRAK_COMPANION_ID];
  if (brak !== undefined && !brak.dead) {
    brak.dead = true;
    brak.hp = 0;
    if (s.companions.activeId === BRAK_COMPANION_ID) s.companions.activeId = null;
    ctx.emit({ t: 'companionDied', companionId: BRAK_COMPANION_ID });
  }
  grantKnownEcho(ctx, ECHO_BRAK_DEATH, 'horde:brak');
  locationState(ctx, HORDE_SOURCE_ID).flags[MARK_BRAK_STOOD] = true;
}

/**
 * Post-step hook: the first step after a Tyrant died in combat and the fight is over (explore mode) resolves it as
 * defeated, plays the legacy defeat sequence (Brak's stand where it applies) and starts the Horde with the legacy delay.
 */
export const hordePostStep: PostStepHook = (ctx) => {
  const { s } = ctx;
  if (s.flags[FLAG_TYRANT_DEAD] !== true || s.world.tyrant === 'defeated' || s.combat !== null || s.mode !== 'explore') return;
  s.world.tyrant = 'defeated';
  ctx.emit({ t: 'tyrantResolved', outcome: 'defeated' });
  for (const line of HORDE_TEXT.tyrantFalls) ctx.log(line, 'event');
  const brak = brakComesToApex(s);
  if (brak) ctx.log(HORDE_TEXT.brakArrives, 'event');
  for (const line of HORDE_TEXT.collapse) ctx.log(line, 'event');
  if (brak) {
    brakStand(ctx);
    for (const line of HORDE_TEXT.brakSpeech) ctx.log(line, 'dialogue');
  }
  const fresh = !s.world.hordeActive;
  startHorde(ctx, 'tyrant', TYRANT_HORDE_DELAY);
  if (fresh && !brak) ctx.log(HORDE_TEXT.portalPulse, 'event');
};

// ---- spread ---------------------------------------------------------------------------------------------------------

/** The neighbours the Horde reaches from `from` (WORLD §10.7: no portal edges, locks ignored, open roads only). */
export function hordeNeighbours(s: GameState, content: ContentPack, profile: Readonly<Profile>, from: string): string[] {
  const out: string[] = [];
  const reaches = (exit: Exit): boolean => {
    if (exit.dir === 'portal') return false;
    if (exit.kind === 'road' && !(exit.gate !== undefined && evaluate(exit.gate, s, profile, content))) return false;
    const to = content.locations[exit.to];
    return to !== undefined && !NEVER_INFECTED_REGIONS.includes(to.regionId);
  };
  for (const exit of content.locations[from]?.exits ?? []) {
    if (reaches(exit) && !out.includes(exit.to)) out.push(exit.to);
  }
  return out;
}

/**
 * One move of the legacy spread (see the file header); returns the nodes infected by it (`hordeSpread` when any).
 * `delays` defaults to WORLD's slow edges.
 */
export function spreadHorde(ctx: StepCtx, delays: Readonly<Record<string, number>> = HORDE_EDGE_DELAYS): string[] {
  const w = ctx.s.world;
  if (!w.hordeActive) return [];
  if (w.hordeDelay > 0) {
    w.hordeDelay -= 1;
    return [];
  }
  const added: string[] = [];
  const infect = (id: string): void => {
    if (w.infected.includes(id)) return;
    w.infected.push(id);
    added.push(id);
  };
  for (const id of Object.keys(w.hordePending)) {
    const left = (w.hordePending[id] ?? 0) - 1;
    if (left > 0) {
      w.hordePending[id] = left;
      continue;
    }
    delete w.hordePending[id];
    infect(id);
  }
  for (const from of [...w.infected]) {
    for (const to of hordeNeighbours(ctx.s, ctx.content, ctx.profile, from)) {
      if (w.infected.includes(to)) continue;
      const slow = delays[`${from}->${to}`] ?? 0;
      if (slow > 0) {
        w.hordePending[to] ??= slow;
        continue;
      }
      delete w.hordePending[to];
      infect(to);
    }
  }
  if (added.length > 0) ctx.emit({ t: 'hordeSpread', infected: added });
  return added;
}

/** The player dies in the Horde outside a fight: `playerDied`, then `closer_fall` (reason by the Horde's cause). */
export function dieInHorde(ctx: StepCtx): void {
  const { s } = ctx;
  s.counters.deathsThisLoop = 1;
  ctx.emit({ t: 'playerDied', loop: s.meta.loop });
  apply({ endLoop: { closer: 'closer_fall', reason: hordeFallReason(s) } }, ctx, { source: 'horde' });
}

/** Entering an infected node (WORLD §10.7): the lash; returns true if it killed. */
function lash(ctx: StepCtx): boolean {
  const { s } = ctx;
  const player = s.player;
  const damage = hordeEntryDamage(player.hpMax, ctx.content.config.hordeDamagePctMaxHp);
  const before = player.hp;
  player.hp = Math.max(0, before - damage);
  s.counters.damageTaken += before - player.hp;
  ctx.log(HORDE_TEXT.lash(damage), 'event');
  if (player.hp > 0) return false;
  dieInHorde(ctx);
  return true;
}

/**
 * ARRIVAL_HOOKS entry (reducers/explore.ts), first: on a move during the Horde, the lash on an infected node (the
 * spread skips that move) or else the spread; then Brak remembered on leaving the Apex, Ilyra at the portal.
 */
export const hordeArrivalHook: ArrivalHook = (ctx, arrival) => {
  const { s } = ctx;
  if (!s.world.hordeActive || (arrival.via !== 'move' && arrival.via !== 'retreat')) return;
  s.counters.custom[HORDE_MOVES_COUNTER] = (s.counters.custom[HORDE_MOVES_COUNTER] ?? 0) + 1; // before the encounter roll reads it
  if (s.world.infected.includes(arrival.locationId)) {
    if (lash(ctx)) return;
  } else {
    spreadHorde(ctx);
  }
  const apex = s.world.locationStates[HORDE_SOURCE_ID];
  if (s.world.previousLocationId === HORDE_SOURCE_ID && apex?.flags[MARK_BRAK_STOOD] === true && apex.flags[MARK_BRAK_MOURNED] !== true) {
    apex.flags[MARK_BRAK_MOURNED] = true;
    ctx.log(HORDE_TEXT.brakMourned, 'narration');
  }
  if (arrival.locationId === PORTAL_LOCATION_ID && s.world.npcOverrides[ILYRA_NPC_ID]?.location === PORTAL_LOCATION_ID) {
    const library = locationState(ctx, PORTAL_LOCATION_ID);
    if (library.flags[MARK_ILYRA_BRIEFED] !== true) {
      library.flags[MARK_ILYRA_BRIEFED] = true;
      ctx.log(HORDE_TEXT.ilyraAtPortal, 'dialogue');
    }
  }
};

// ---- the portal -------------------------------------------------------------------------------------------------------

/** The Library portal is open: a Horde runs, or content opened it on purpose (`flag_library_portal_open`). */
export const portalIsOpen = (s: GameState): boolean => s.world.hordeActive || s.flags[FLAG_LIBRARY_PORTAL_OPEN] === true;

/** Why `enterPortal` is not legal here, or null. */
export function portalProblem(s: GameState): string | null {
  if (!portalIsOpen(s)) return HORDE_TEXT.noPortal;
  if (s.world.currentLocationId !== PORTAL_LOCATION_ID) return HORDE_TEXT.noPortalHere;
  return null;
}

/** `enterPortal` (explore): through the Library portal → `portalEntered`, `closer_escape` (STORY §4.2, §10.7). */
export function enterPortalHandler(ctx: StepCtx): void {
  const why = portalProblem(ctx.s);
  if (why !== null) ctx.reject(why);
  ctx.emit({ t: 'portalEntered' });
  apply({ endLoop: { closer: 'closer_escape' } }, ctx, { source: 'portal' });
}

export const enterPortalEnumerator: Enumerator<'enterPortal'> = (s) => (portalProblem(s) === null ? [{ type: 'enterPortal' }] : []);
