// U84 (D-149 #4; DESIGN §5.6, §16.5): the Shadow Weaver's Blood price toggle on the ability bar. With it on, every tile
// with an MP cost is priced in HP (red), says it is empowered, and is checked against the blood rule; other classes never
// get a bloodable tile. The toggle button carries its state in words and `aria-pressed`, and the key B.
import { describe, expect, test } from 'bun:test';
import { beginCombat, legalActions, runCombat, type CombatState, type EncounterSpec, type GameState } from '@engine/index';
import { BloodToggle } from '@ui/components/combat/AbilityBar';
import { abilityTiles, effectiveTarget, tileName } from '@ui/screens/combatModel';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { D, DUELIST, combatPack, scriptedCtx } from '@tests/fixtures/combatContent';
import { byName, call, expand } from './tree';

const content = combatPack();
const profile = freshProfile();
const spec: EncounterSpec = { id: 'enc_test', groups: [{ creatureId: DUELIST, count: 1 }], fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [] };

function fight(o: StateOverrides): GameState {
  const ctx = scriptedCtx(makeState(o, { content }), [D.d4(4), D.d4(1)], content, profile);
  beginCombat(ctx, spec);
  runCombat(ctx);
  return ctx.s;
}
const tilesOf = (s: GameState, on: boolean) => abilityTiles(s, content, legalActions(s, content, profile), effectiveTarget(s.combat as CombatState, null), on);

describe('the Blood price toggle (U84)', () => {
  test('a Weaver: off, Void Lance costs Mana; on, it costs HP only, in red, empowered; a 0-MP ability is not bloodable', () => {
    const s = fight({ classId: 'shadow_weaver', abilities: ['wvr_void_lance', 'wvr_blood_pact'], mp: 40 });
    const off = tilesOf(s, false).find((t) => t.id === 'wvr_void_lance')!;
    expect(off).toMatchObject({ bloodable: true, enabled: true, blood: true }); // its 8 % self-cost is already HP
    expect(off.cost).toBe('10 Mana + 8 HP');
    expect(tileName(off, 'X')).not.toContain('empowered');
    const on = tilesOf(s, true).find((t) => t.id === 'wvr_void_lance')!;
    expect(on).toMatchObject({ enabled: true, blood: true, cost: '28 HP' });
    expect(tileName(on, 'X')).toBe('3: Void Lance, at X, 28 HP, empowered by blood');
    expect(tilesOf(s, true).find((t) => t.id === 'wvr_blood_pact')?.bloodable).toBe(false);
  });

  test('never lethal: at 28 HP the 28 HP price reads "Not enough blood"', () => {
    const s = fight({ classId: 'shadow_weaver', abilities: ['wvr_void_lance'], mp: 40 });
    (s.combat as CombatState).party[0]!.hp = 28;
    expect(tilesOf(s, true).find((t) => t.id === 'wvr_void_lance')).toMatchObject({ enabled: false, reason: 'Not enough blood' });
    expect(tilesOf(s, false).find((t) => t.id === 'wvr_void_lance')).toMatchObject({ enabled: true });
  });

  test('other classes never get a bloodable tile', () => {
    const s = fight({ abilities: ['rgr_rend'], mp: 40 });
    expect(tilesOf(s, true).every((t) => !t.bloodable)).toBe(true);
  });

  test('the toggle says its state in words, is pressed when on, answers to B and calls back', () => {
    let n = 0;
    const offTree = expand(<BloodToggle on={false} onToggle={() => (n += 1)} />);
    const off = byName(offTree, 'button', 'B: Blood price, off');
    expect(off.props['aria-pressed']).toBe(false);
    expect(off.props['aria-keyshortcuts']).toBe('B');
    call(off, 'onClick');
    const on = byName(expand(<BloodToggle on onToggle={() => (n += 1)} />), 'button', 'B: Blood price, on: abilities cost HP and are empowered');
    expect(on.props['aria-pressed']).toBe(true);
    call(on, 'onClick');
    expect(n).toBe(2);
  });
});
