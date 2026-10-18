// U34e item 3 — creature mechanics the region units could only approximate (D-091, D-092, D-094, D-096, D-097, D-098).
// Engine rules on the real pack's creatures, with deterministic draws.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { BLEED_IMMUNE_TAGS, beginCombat, statusImmunities, type EncounterSpec, type GameState } from '@engine/index';
import { D, scriptedCtx } from '@tests/fixtures/combatContent';
import { freshProfile, makeState } from '@tests/fixtures/helpers';

const pack = buildContentPack();
const profile = freshProfile();
const at = (overrides: Parameters<typeof makeState>[0] = {}): GameState => makeState(overrides, { content: pack, profile });
const spec = (creatureId: string, count = 1): EncounterSpec => ({
  id: 'enc_u34e_test', groups: [{ creatureId, count }], fleeable: true, onFlee: 'scatter', ambush: false, onVictory: [], onDefeat: [], onFleeEffects: [],
});

describe('construct Bleed immunity (D-094: WORLD §6 "`construct`: Poison and Bleed immune")', () => {
  test('every construct is Bleed- and Poison-immune by its tag, whatever its record writes', () => {
    expect(BLEED_IMMUNE_TAGS).toEqual(['construct']);
    const constructs = Object.values(pack.creatures).filter((c) => c.tags.includes('construct'));
    expect(constructs.length).toBeGreaterThan(10);
    const s = at();
    for (const c of constructs) {
      const ctx = scriptedCtx(s, Array.from({ length: 4 }, () => D.d4(1)), pack, profile);
      const combat = beginCombat(ctx, spec(c.id));
      const immune = statusImmunities(ctx.s, pack, combat.enemies[0]!);
      expect([c.id, immune.includes('status_bleed'), immune.includes('status_poison')]).toEqual([c.id, true, true]);
    }
  });
});
