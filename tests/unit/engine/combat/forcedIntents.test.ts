// U81a (D-121, DESIGN §16.8): the first fight's forced intents. Loop 1's first Corrupted Shade (the Darkened Corridor) shows Wail,
// then Rake, so Guard visibly halves the second; then its own pattern from the start (Rake, Wail, …). A data hook, the encounter's
// `forcedIntents`, with no draw: the same seed plays the same fight. Only Loop 1: from Loop 2 the Shade opens with its pattern.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { EncounterSchema } from '@schema/encounter';
import {
  beginCombat,
  encounterSpec,
  findEncounter,
  makeCtx,
  runCombat,
  step,
  type Action,
  type ContentPack,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import { loadScenario } from '@sim/scenarios';
import { freshProfile, makeState } from '@tests/fixtures/helpers';

const pack: ContentPack = buildContentPack();
const SHADE = 'cr_corrupted_shade';

const shadeIntent = (s: GameState): string | undefined => {
  const shade = s.combat?.enemies.find((e) => e.refId === SHADE && e.alive);
  return shade === undefined ? undefined : s.combat?.intents[shade.uid]?.moveId;
};

/** The corridor's fight started on a built Loop `loop` state (the engine's own beginCombat, run to the player's first turn). */
function corridorFight(loop: number): { s: GameState; p: Profile } {
  const p = freshProfile({ loopCounter: loop });
  const s0 = makeState({ loop, locationId: 'loc_darkened_corridor', level: 3 }, { content: pack, profile: p });
  const found = findEncounter(pack, 'enc_corridor_shade', 'loc_darkened_corridor');
  if (found === undefined) throw new Error('no corridor shade');
  const ctx = makeCtx(clone(s0), p, pack);
  beginCombat(ctx, encounterSpec(found.enc));
  runCombat(ctx);
  return { s: ctx.s, p: ctx.commit().profile };
}

/** Guards until the Shade has played `n` more moves (its intents in order, as each became the next). */
function guardThrough(s0: GameState, p: Profile, n: number): { intents: string[]; events: GameEvent[]; s: GameState } {
  let s = s0;
  const intents: string[] = [shadeIntent(s) ?? '-'];
  const events: GameEvent[] = [];
  for (let i = 0; i < 12 && intents.length <= n; i++) {
    const out = step(s, { type: 'guard' } as Action, pack, p);
    expect(out.events.some((e) => e.t === 'actionRejected')).toBe(false);
    events.push(...out.events);
    s = out.state;
    const now = shadeIntent(s);
    if (now === undefined) break;
    if (out.events.some((e) => e.t === 'intentRevealed')) intents.push(now);
  }
  return { intents, events, s };
}

describe("the first fight's forced intents (DESIGN §16.8)", () => {
  test('the content: the corridor Shade, Loop 1 only, Wail then Rake — moves the Shade has', () => {
    const enc = pack.locations['loc_darkened_corridor']?.encounters.find((e) => e.id === 'enc_corridor_shade');
    expect(enc?.forcedIntents).toEqual({ when: { loop: { max: 1 } }, moves: ['shade_wail', 'shade_rake'] });
    for (const m of enc?.forcedIntents?.moves ?? []) expect(pack.creatures[SHADE]?.moves[m]).toBeDefined();
    // every forcedIntents in the pack names moves of its own creatures
    for (const loc of Object.values(pack.locations)) {
      for (const e of loc?.encounters ?? []) {
        for (const m of e.forcedIntents?.moves ?? []) expect([e.id, m, e.groups.some((g) => pack.creatures[g.creatureId]?.moves[m] !== undefined)]).toEqual([e.id, m, true]);
      }
    }
  });

  test('Loop 1: the Shade opens with Wail; Guard; then Rake (halved by the Guard); then its pattern from the start', () => {
    const { s, p } = corridorFight(1);
    expect(shadeIntent(s)).toBe('shade_wail');
    const run = guardThrough(s, p, 3);
    expect(run.intents.slice(0, 4)).toEqual(['shade_wail', 'shade_rake', 'shade_rake', 'shade_wail']);
    // the Rake that came second landed on a Guard: the hit was mitigated by it
    expect(run.events.some((e) => e.t === 'guarded')).toBe(true);
  });

  test('U84 (REPORT U79 #3): the player acts first in round 1 of the taught fight, so Wail is read before it lands', () => {
    const { s } = corridorFight(1);
    const combat = s.combat!;
    expect(combat.round).toBe(1);
    expect(combat.turnOrder[combat.turnIndex]).toBe(combat.party[0]?.uid);
    expect(combat.log.some((l) => /Wail/.test(l.text) && /Shade/.test(l.text))).toBe(false); // nothing has landed yet
  });

  test("U84: the Archway's Prowler waits for Loop 2, so Loop 1's first fight is the corridor Shade", () => {
    const prowler = pack.locations['loc_crumbling_archway']?.encounters.find((e) => e.id === 'enc_archway_prowler');
    expect(prowler?.when).toEqual({ loop: { min: 2 } });
  });

  test('Loop 2: no forcing — the Shade opens with its pattern (Rake)', () => {
    const { s } = corridorFight(2);
    expect(shadeIntent(s)).toBe('shade_rake');
  });

  test('other Shade fights are untouched; the field is optional and strict', () => {
    const depths = pack.locations['loc_heartstone_depths']?.encounters.find((e) => e.id === 'enc_depths_shades');
    expect(depths?.forcedIntents).toBeUndefined();
    expect(EncounterSchema.safeParse({ id: 'enc_x', groups: [{ creatureId: SHADE }], forcedIntents: { moves: [] } }).success).toBe(false);
    expect(EncounterSchema.safeParse({ id: 'enc_x', groups: [{ creatureId: SHADE }], forcedIntents: { moves: ['shade_wail'], extra: 1 } }).success).toBe(false);
    expect(EncounterSchema.safeParse({ id: 'enc_x', groups: [{ creatureId: SHADE }], forcedIntents: { moves: ['shade_wail'] } }).success).toBe(true);
  });

  test('the played first fight (the first_fight scenario: title → newGame → the walk) opens with Wail, the same on every build', () => {
    const a = loadScenario('first_fight', pack);
    const b = loadScenario('first_fight', pack);
    expect(a.state.combat?.encounterId).toBe('enc_corridor_shade');
    expect(shadeIntent(a.state)).toBe('shade_wail');
    expect(b.state.rng).toEqual(a.state.rng);
  });
});
