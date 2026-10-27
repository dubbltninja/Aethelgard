// U84 (D-149 #4; DESIGN §4.1, §5.1, §5.6): the empowered Blood price. A Shadow Weaver may pay any ability's whole MP cost
// in HP (2 HP per MP) even with MP to spare (`blood: true`); any Blood-priced cast (by choice, or the missing part when MP
// is short) is empowered: damage, healing and Shield ×1.25. Self-cost rules stay: never lethal, "Not enough blood".
import { describe, expect, test } from 'bun:test';
import {
  beginCombat,
  combatAbilityProblem,
  findStatus,
  isLegal,
  legalActions,
  playerAbilityCost,
  playerOf,
  runCombat,
  type Action,
  type CombatState,
  type Combatant,
  type EncounterSpec,
  type GameEvent,
  type GameState,
} from '@engine/index';
import { abilityCost } from '@engine/progression';
import { clone } from '@engine/util/clone';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { D, DUELIST, SHADE, combatPack, scriptedCtx, scriptedStep } from '@tests/fixtures/combatContent';

const content = combatPack();
const profile = freshProfile();
const state = (o: StateOverrides = {}): GameState => makeState(o, { content });
const spec = (groups: EncounterSpec['groups']): EncounterSpec => ({
  id: 'enc_test', groups, fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [],
});
const HIT = (v = 1): number[] => [D.pct(0), D.variance(v), D.pct(99)];

function fight(s: GameState, creatureId: string): GameState {
  const ctx = scriptedCtx(s, [D.d4(4), D.d4(1)], content, profile);
  beginCombat(ctx, spec([{ creatureId, count: 1 }]));
  runCombat(ctx);
  (ctx.s.combat as CombatState).intents = {};
  return ctx.s;
}
const me = (s: GameState): Combatant => playerOf(s.combat as CombatState);
const foe = (s: GameState): Combatant => (s.combat as CombatState).enemies[0] as Combatant;
function act(s: GameState, action: Action, draws: readonly number[] = []) {
  const out = scriptedStep(s, action, draws, content, profile);
  expect(out.rejected).toBeNull();
  return out;
}
const rejected = (s: GameState, action: Action): string | null => scriptedStep(s, action, [], content, profile).rejected;
const dealt = (events: readonly GameEvent[]) => events.filter((e) => e.t === 'damageDealt').map((e) => (e as { amount: number }).amount);
const healed = (events: readonly GameEvent[]) => events.filter((e) => e.t === 'healed').map((e) => (e as { amount: number }).amount);

describe('the Blood price by choice (DESIGN §5.6)', () => {
  test('abilityCost: payInBlood pays the whole cost in HP; it needs a Blood price and an MP cost', () => {
    const caster = { hp: 100, hpMax: 100, mp: 50 };
    const blood = { hpPerMp: 2 };
    expect(abilityCost({ id: 'x', mp: 10 }, caster, { bloodPrice: blood })).toMatchObject({ mpPaid: 10, hp: 0, bloodHp: 0, ok: true });
    expect(abilityCost({ id: 'x', mp: 10 }, caster, { bloodPrice: blood, payInBlood: true })).toMatchObject({ mpPaid: 0, hp: 20, bloodHp: 20, ok: true });
    expect(abilityCost({ id: 'x', mp: 10 }, caster, { payInBlood: true }).reason).toBe('You cannot pay in blood');
    expect(abilityCost({ id: 'x', mp: 0 }, caster, { bloodPrice: blood, payInBlood: true }).reason).toBe('Nothing to pay in blood');
    // never lethal: 50 HP for 25 MP needs more than 50 HP
    expect(abilityCost({ id: 'x', mp: 25 }, { ...caster, hp: 50 }, { bloodPrice: blood, payInBlood: true }).reason).toBe('Not enough blood');
    expect(abilityCost({ id: 'x', mp: 25 }, { ...caster, hp: 51 }, { bloodPrice: blood, payInBlood: true }).ok).toBe(true);
  });

  test('a Weaver with MP to spare pays Void Lance in blood: no MP, 2 HP per MP plus the self-cost, and the hit is ×1.25', () => {
    const s = fight(state({ classId: 'shadow_weaver', abilities: ['wvr_void_lance'], mp: 40 }), DUELIST);
    const plain = act(s, { type: 'ability', abilityId: 'wvr_void_lance', targetUid: foe(s).uid }, HIT());
    const blood = act(s, { type: 'ability', abilityId: 'wvr_void_lance', targetUid: foe(s).uid, blood: true }, HIT());
    // Void Lance: 10 MP; self-cost 8 % of 102 = 8 HP
    expect(me(plain.state).mp).toBe(me(s).mp - 10);
    expect(me(plain.state).hp).toBe(me(s).hp - 8);
    expect(me(blood.state).mp).toBe(me(s).mp);
    expect(me(blood.state).hp).toBe(me(s).hp - 8 - 20);
    // 3 + 1.3 × 12 = 18.6 (− ward 1 → 18); empowered 18.6 × 1.25 = 23.25 − 1 → 22
    expect(dealt(plain.events)).toEqual([18]);
    expect(dealt(blood.events)).toEqual([22]);
    expect((blood.state.combat as CombatState).log.some((l) => l.text.includes('empowered'))).toBe(true);
  });

  test('short of MP the missing part is paid in blood, and that cast is empowered too', () => {
    const s = fight(state({ classId: 'shadow_weaver', abilities: ['wvr_void_lance'], mp: 0 }), DUELIST);
    const out = act(s, { type: 'ability', abilityId: 'wvr_void_lance', targetUid: foe(s).uid }, HIT());
    expect(dealt(out.events)).toEqual([22]);
  });

  test('Shield (Leech Veil) and healing are empowered ×1.25', () => {
    const s = fight(state({ classId: 'shadow_weaver', abilities: ['wvr_leech_veil', 'rgr_field_dressing'], mp: 40 }), SHADE);
    const veil = (blood: boolean) => findStatus(me(act(s, blood ? { type: 'ability', abilityId: 'wvr_leech_veil', blood: true } : { type: 'ability', abilityId: 'wvr_leech_veil' }).state), 'status_shield');
    const plain = veil(false)?.tick ?? 0;
    const empowered = veil(true)?.tick ?? 0;
    expect(plain).toBeGreaterThan(0);
    expect(empowered).toBe(Math.round(plain * 1.25));
    const hurt = clone(s);
    me(hurt).hp = 40;
    const heal = (blood: boolean) => healed(act(hurt, { type: 'ability', abilityId: 'rgr_field_dressing', targetUid: me(hurt).uid, ...(blood ? { blood: true } : {}) }, [D.variance(1)]).events)[0] ?? 0;
    // 18 + 0.8 × max(STR 6, AGI 8) = 24.4 → 24; empowered 30.5 → 31 (the multiplier applies before rounding)
    expect([heal(false), heal(true)]).toEqual([24, 31]);
  });

  test('the self-cost rules stay: "Not enough blood" when the HP price reaches current HP; legal ⇔ accepted; out of combat it is refused', () => {
    const s = fight(state({ classId: 'shadow_weaver', abilities: ['wvr_void_lance'], mp: 40 }), DUELIST);
    const lance: Action = { type: 'ability', abilityId: 'wvr_void_lance', targetUid: foe(s).uid, blood: true };
    const at = (hp: number): GameState => {
      const out = clone(s);
      me(out).hp = hp;
      return out;
    };
    // 20 HP of blood + 8 % of 102 (8) = 28
    expect(combatAbilityProblem(at(28), content, at(28).combat!, 'wvr_void_lance', foe(s).uid, true)).toBe('Not enough blood');
    expect(rejected(at(28), lance)).toBe('Not enough blood');
    expect(isLegal(at(28), lance, content, profile)).toBe(false);
    expect(isLegal(at(29), lance, content, profile)).toBe(true);
    expect(me(act(at(29), lance, HIT()).state).hp).toBe(1);
    // the plain spelling is the one listed; the modifier is never listed
    expect(legalActions(at(29), content, profile).some((a) => a.type === 'ability' && 'blood' in a)).toBe(false);
    // other classes cannot pay in blood
    const r = fight(state({ abilities: ['rgr_rend'], mp: 40 }), DUELIST);
    expect(rejected(r, { type: 'ability', abilityId: 'rgr_rend', targetUid: foe(r).uid, blood: true })).toBe('You cannot pay in blood');
    // out of combat
    const field = state({ classId: 'shadow_weaver', abilities: ['rgr_field_dressing'], mp: 40, hp: 30 });
    expect(playerAbilityCost(field, content, 'rgr_field_dressing', undefined, true).bloodHp).toBe(20);
    expect(isLegal(field, { type: 'ability', abilityId: 'rgr_field_dressing', blood: true }, content, profile)).toBe(false);
  });
});
