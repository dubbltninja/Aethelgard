// U34c: the two companion signature clauses DESIGN §12.4 states and the ability fields cannot (D-089), scripted by ability
// id (combat/abilities.ts COMPANION_SCRIPTS) and cast on the player's action through the real reducer with scripted draws:
//   Lanternreed Bloom (Mireya)  "party heal 30% max HP; cleanse; Regen" — each living party member heals 30 % of its own
//                               max HP, rounded down, × Trusted and its healing modifiers (Curse ×0.5: the heal lands
//                               before the cleanse), never above max HP; no draw; on top of the row's cleanse and Regen.
//   Archive Light (Ilyra)       "cleanse party; Shield on both; all hidden intents revealed for 2 turns" — the hidden
//                               intents clear at once (`intentRevealed`), and for the player's next 2 turns every intent
//                               is generated, and shown, unhidden (specials.ts REVEAL_KEY, a fight timer like Foresight's).
import { describe, expect, test } from 'bun:test';
import {
  COMPANION_SCRIPTS,
  HOLD_TAG,
  REVEAL_KEY,
  TRUSTED_MULT,
  beginCombat,
  intentsRevealed,
  playerOf,
  refreshIntents,
  revealIntents,
  runCombat,
  type Action,
  type CombatState,
  type Combatant,
  type CompanionRunState,
  type EncounterSpec,
  type GameEvent,
  type GameState,
  type StatusInstance,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { ABERRATION, D, SHADE, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';
import { companionPack } from '@tests/fixtures/companionContent';

const content = companionPack();
const profile = freshProfile();
const BLOOM = 'comp_mireya_lanternreed_bloom';
const ARCHIVE = 'comp_ilyra_archive_light';
const SIG: Action = { type: 'companionCommand', command: 'signature' };
const GUARD: Action = { type: 'guard' };
const MISS = [D.pct(99)];
/** The fixture player's max HP at level 1 (a Ranger, makeState's default). */
const PLAYER_MAX = 120;

const ofType = <T extends GameEvent['t']>(events: readonly GameEvent[], t: T) => events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
const status = (statusId: string, over: Partial<StatusInstance> = {}): StatusInstance => ({ statusId, stacks: 1, duration: 2, sourceUid: null, appliedOnOwnTurn: false, ...over });

function withCompanion(id: string, over: Partial<CompanionRunState> = {}): GameState {
  const hp = content.companions[id]!.stats.hp;
  const run: CompanionRunState = { id, recruited: true, loyalty: 0, hp, hpMax: hp, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {}, ...over };
  return makeState({ patch: (st) => void ((st.companions.recruited[id] = run), (st.companions.activeId = id)) }, { content });
}
const spec = (groups: EncounterSpec['groups']): EncounterSpec => ({ id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] });

/** A fight at the player's first turn: the player first (d4 4), the companion next (d4 3), the enemy last (d4 1). */
function fight(s: GameState, creatureId: string): GameState {
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(3), D.d4(1)], content, profile);
  beginCombat(ctx, spec([{ creatureId, count: 1 }]));
  runCombat(ctx);
  expect(ctx.rng.queue).toEqual([]);
  return ctx.s;
}
function patched(s: GameState, edit: (c: CombatState, s: GameState) => void): GameState {
  const out = clone(s);
  edit(out.combat as CombatState, out);
  return out;
}
const me = (s: GameState): Combatant => playerOf(s.combat as CombatState);
const ally = (s: GameState): Combatant => (s.combat as CombatState).party[1] as Combatant;
const foe = (s: GameState): Combatant => (s.combat as CombatState).enemies[0] as Combatant;
/** The companion holds (Guards) on its next turn and the enemy has no intent: nothing after the player's action draws. */
const still = (s: GameState): GameState =>
  patched(s, (c) => {
    c.intents = {};
    c.party[1]!.pattern.firedOnce.push(HOLD_TAG);
  });
function act(s: GameState, action: Action, draws: readonly number[] = []) {
  const out = scriptedStep(s, action, draws, content, profile);
  expect(out.rejected).toBeNull();
  expect(out.left).toBe(0);
  return out;
}
const bloomHeals = (events: readonly GameEvent[]) => ofType(events, 'healed').filter((e) => e.source === BLOOM).map((e) => [e.targetUid, e.amount]);

// ---- Lanternreed Bloom ------------------------------------------------------------------------------------------------------

describe('Lanternreed Bloom: party heal 30 % max HP, then the cleanse and the Regen of its data (DESIGN §12.4)', () => {
  const s0 = fight(withCompanion('mireya'), SHADE);
  const hurt = (o: { player?: number; mireya?: number; statuses?: StatusInstance[] } = {}) =>
    still(
      patched(s0, (c) => {
        c.party[0]!.hp = o.player ?? 10;
        c.party[1]!.hp = o.mireya ?? 20;
        c.party[0]!.statuses.push(...(o.statuses ?? []));
      }),
    );

  test('each living party member heals 30 % of its own max HP, rounded down; no draw; Regen and the cleanse follow', () => {
    const s = hurt({ statuses: [status('status_weaken')] });
    const out = act(s, SIG);
    const pMax = me(s).hpMax;
    expect([pMax, ally(s).hpMax]).toEqual([PLAYER_MAX, 95]);
    expect(bloomHeals(out.events)).toEqual([
      [me(s).uid, Math.floor(0.3 * pMax)],
      [ally(s).uid, 28], // ⌊0.3 × 95⌋ = ⌊28.5⌋
    ]);
    // the order of the resolution: the heal, the Regen rows, then the cleanse special
    const at = (pred: (e: GameEvent) => boolean) => out.events.findIndex(pred);
    const healed = at((e) => e.t === 'healed' && e.source === BLOOM);
    const regen = at((e) => e.t === 'statusApplied' && e.statusId === 'status_regen');
    const cleansed = at((e) => e.t === 'statusExpired' && e.statusId === 'status_weaken');
    expect(healed).toBeGreaterThan(-1);
    expect([healed < regen, regen < cleansed]).toEqual([true, true]);
    expect(me(out.state).statuses.map((st) => st.statusId)).toEqual(['status_regen']);
    expect(out.state.combat!.log.filter((l) => l.kind === 'heal').map((l) => l.text).slice(0, 2)).toEqual([
      `${me(s).name} recovers ${Math.floor(0.3 * pMax)} HP.`,
      'Mireya recovers 28 HP.',
    ]);
  });

  test('never above max HP: a member 3 short heals 3; one at full HP heals nothing (no event)', () => {
    const s = hurt({ player: PLAYER_MAX - 3, mireya: 95 });
    expect(bloomHeals(act(s, SIG).events)).toEqual([[me(s).uid, 3]]);
  });

  test('healing modifiers apply: Curse halves it (the cleanse comes after the heal and then lifts the Curse)', () => {
    const s = hurt({ statuses: [status('status_curse', { tick: 2 })] });
    const out = act(s, SIG);
    expect(bloomHeals(out.events)).toEqual([
      [me(s).uid, Math.floor(0.3 * PLAYER_MAX * 0.5)],
      [ally(s).uid, 28],
    ]);
    expect(me(out.state).statuses.map((st) => st.statusId)).not.toContain('status_curse');
  });

  test('Trusted (loyalty ≥ 75) adds its +10 % to the heal, like every companion heal', () => {
    const trusted = still(patched(fight(withCompanion('mireya', { loyalty: 75 }), SHADE), (c) => void ((c.party[0]!.hp = 10), (c.party[1]!.hp = 20))));
    expect(bloomHeals(act(trusted, SIG).events)).toEqual([
      [me(trusted).uid, Math.floor(0.3 * PLAYER_MAX * TRUSTED_MULT)],
      [ally(trusted).uid, 31], // ⌊0.3 × 95 × 1.1⌋ = ⌊31.35⌋
    ]);
  });
});

// ---- Archive Light ----------------------------------------------------------------------------------------------------------

describe('Archive Light: every hidden intent revealed for 2 turns (DESIGN §4.2, §12.4)', () => {
  const s0 = fight(withCompanion('ilyra'), ABERRATION); // its opening intent is the hidden Flicker Strike
  /** The opening chip as the player would see it on a turn before the one preceding the blow: "?". */
  const veiled = (s: GameState) => patched(s, (c) => void (c.intents[c.enemies[0]!.uid]!.hidden = true));

  test('the cast: the hidden intent clears at once (intentRevealed, unhidden); the reveal runs through the next 2 player turns', () => {
    const s = veiled(patched(s0, (c) => void c.party[1]!.pattern.firedOnce.push(HOLD_TAG)));
    expect(s.combat!.intents[foe(s).uid]).toMatchObject({ moveId: 'aberration_flicker_strike', hidden: true });
    const out = act(s, SIG, MISS); // the Aberration's Flicker Strike misses the player
    const used = out.events.findIndex((e) => e.t === 'abilityUsed' && e.abilityId === ARCHIVE);
    const revealed = ofType(out.events.slice(used), 'intentRevealed')[0];
    expect(revealed).toMatchObject({ uid: foe(s).uid, intent: { moveId: 'aberration_flicker_strike', hidden: false } });
    const lines = out.state.combat!.log.map((l) => l.text);
    expect(lines).toContain('Archive Light: every intent shows plainly for 2 turns.');
    expect(lines).toContain("Temporal Aberration's intent clears: Flicker Strike.");
    // set on the player's own turn (+1), one gone at that turn's end: the next 2 player turns remain
    expect(out.state.combat!.cooldowns[REVEAL_KEY]).toBe(2);
    expect(intentsRevealed(out.state.combat!)).toBe(true);
  });

  test('while it runs every intent is generated unhidden; from the third player turn on, hidden again', () => {
    /** Each step: the player acts, Ilyra holds, the Aberration (no intent) holds still and generates its next one. */
    const generated = (events: readonly GameEvent[]) => ofType(events, 'intentRevealed').map((e) => [e.intent.moveId, e.intent.hidden]);
    const t1 = act(still(s0), SIG); // cast on turn 1
    const t2 = act(still(t1.state), GUARD);
    const t3 = act(still(t2.state), GUARD);
    const t4 = act(still(t3.state), GUARD);
    expect([t1, t2, t3, t4].map((r) => r.state.combat!.cooldowns[REVEAL_KEY])).toEqual([2, 1, undefined, undefined]);
    // its pattern: Flicker Strike (hidden) / Future Blow on every 3rd turn (hidden, all), then Past Blow, and again
    expect(generated(t1.events)).toEqual([['aberration_past_blow', false]]);
    expect(generated(t2.events)).toEqual([['aberration_future_blow', false]]); // a hidden move, generated unhidden
    expect(generated(t3.events)).toEqual([['aberration_past_blow', false]]); // the reveal ended with turn 3
    // hidden at generation again; the next turn start clears it as DESIGN §4.2 says (it acts before the player's next turn)
    expect(generated(t4.events)).toEqual([
      ['aberration_flicker_strike', true],
      ['aberration_flicker_strike', false],
    ]);
  });

  test('a turn start inside the reveal clears a "?" whose creature acts only after the player\'s next turn; outside it, it stays', () => {
    // The Aberration already acted this round and will act after the player next round: DESIGN §4.2 keeps its chip hidden.
    const behind = (reveal: boolean) =>
      veiled(
        patched(s0, (c) => {
          c.turnOrder = [c.enemies[0]!.uid, c.party[0]!.uid, c.party[1]!.uid];
          c.turnIndex = 1;
          if (reveal) c.cooldowns[REVEAL_KEY] = 1;
        }),
      );
    const refresh = (s: GameState) => {
      const ctx = scriptedCtx(s, [], content, profile);
      refreshIntents(ctx, ctx.s.combat as CombatState);
      return { combat: ctx.s.combat as CombatState, events: ctx.events };
    };
    const plain = refresh(behind(false));
    expect(plain.combat.intents[foe(s0).uid]?.hidden).toBe(true);
    expect(ofType(plain.events, 'intentRevealed')).toEqual([]);
    const lit = refresh(behind(true));
    expect(lit.combat.intents[foe(s0).uid]?.hidden).toBe(false);
    expect(ofType(lit.events, 'intentRevealed')).toHaveLength(1);
  });

  test('revealIntents touches only hidden intents of standing enemies', () => {
    const ctx = scriptedCtx(s0, [], content, profile);
    revealIntents(ctx, ctx.s.combat as CombatState); // the opening chip is already shown (it acts this round)
    expect(ctx.events).toEqual([]);
    const down = scriptedCtx(patched(veiled(s0), (c) => void (c.enemies[0]!.alive = false)), [], content, profile);
    revealIntents(down, down.s.combat as CombatState);
    expect(down.events).toEqual([]);
  });

  test('the cleanse and the Shield on both still land (the row\'s data)', () => {
    const s = still(patched(s0, (c) => void c.party[0]!.statuses.push(status('status_weaken'))));
    const out = act(s, SIG);
    expect(me(out.state).statuses.map((st) => st.statusId)).toEqual(['status_shield']);
    expect(ally(out.state).statuses.map((st) => st.statusId)).toEqual(['status_shield']);
  });
});

describe('COMPANION_SCRIPTS: the two §12.4 signatures, nothing else', () => {
  test('each key is a companion\'s signature in the companion pack', () => {
    const signatures = Object.values(content.companions).map((c) => c.signature.abilityId);
    expect(Object.keys(COMPANION_SCRIPTS).sort()).toEqual([ARCHIVE, BLOOM]);
    for (const id of Object.keys(COMPANION_SCRIPTS)) expect(signatures).toContain(id);
  });
});
