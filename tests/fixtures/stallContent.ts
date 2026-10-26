// U81a (D-110): a pack whose fights can never end — every creature is immune to every damage type, its moves hit for nothing,
// and none can be fled — so any bot meets the soft-lock detector's combat stall (round > 60). The batch and worker tests used
// the caster Weaver on the combat pack for this, which stalled only because the bots guarded forever (the bug U81a fixes).
// Load by path: `tests/fixtures/stallContent.ts#stallPack`.
import type { ContentPack } from '@engine/index';
import { DamageType } from '@schema/primitives';
import { combatPack } from './combatContent';

let cached: ContentPack | undefined;

export function stallPack(): ContentPack {
  if (cached !== undefined) return cached;
  const base = combatPack();
  const immune = Object.fromEntries(DamageType.options.map((t) => [t, 'immune' as const]));
  const creatures = Object.fromEntries(
    Object.entries(base.creatures).map(([id, c]) => {
      const moves = Object.fromEntries(
        Object.entries(c.moves).map(([mid, m]) => {
          const { type: _type, power: _power, windUp: _windUp, summon: _summon, revive: _revive, riposte: _riposte, shieldAlly: _ally, shield: _shield, heal: _heal, ...rest } = m;
          return [mid, { ...rest, statuses: [], effects: [], leaveCombat: false }];
        }),
      ) as typeof c.moves;
      return [id, { ...c, resistances: immune, moves, fleeable: false, deathMove: undefined }];
    }),
  ) as ContentPack['creatures'];
  const locations = Object.fromEntries(
    Object.entries(base.locations).map(([id, l]) => [id, { ...l, encounters: l.encounters.map((e) => ({ ...e, fleeable: false })) }]),
  ) as ContentPack['locations'];
  cached = { ...base, creatures, locations, encounters: Object.fromEntries(Object.entries(base.encounters).map(([id, e]) => [id, { ...e, fleeable: false }])) };
  return cached;
}

export default stallPack;
