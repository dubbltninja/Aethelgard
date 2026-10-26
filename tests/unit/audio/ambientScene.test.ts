// U75: what the UI tells the ambient layer (sceneOf in src/ui/hooks/useAudio.ts) — the place's bed, indoors, infection, and
// the Tyrant's fight — read from the state and the real content.
import { describe, expect, test } from 'bun:test';
import { NO_SCENE } from '@audio/ambient/ambient';
import { AMBIENT_PRESETS } from '@audio/ambient/recipes';
import { buildContentPack, contentTables } from '@content/index';
import type { GameState } from '@engine/index';
import { ambientFor, sceneOf, sharedAmbient } from '@ui/hooks/useAudio';
import { createAudioEngine } from '@audio/engine/engine';

const content = buildContentPack(contentTables, { validate: false });

interface Fight {
  phase?: string;
  enemies?: { refId: string; phase?: number; alive?: boolean }[];
  communion?: { movement: number; resolve: number } | null;
}
function stateAt(location: string, over: { mode?: string; infected?: string[]; horde?: boolean; fight?: Fight } = {}): GameState {
  const fight = over.fight;
  return {
    mode: over.mode ?? 'explore',
    world: { currentLocationId: location, infected: over.infected ?? [], hordeActive: over.horde ?? false },
    combat:
      fight === undefined
        ? null
        : {
            phase: fight.phase ?? 'playerTurn',
            enemies: (fight.enemies ?? []).map((e) => ({ refId: e.refId, phase: e.phase ?? 0, alive: e.alive ?? true })),
            communion: fight.communion ?? null,
          },
  } as unknown as GameState;
}

const APEX = 'loc_temporal_breach_apex';

describe('sceneOf', () => {
  test('the Title and the endings are silent', () => {
    expect(sceneOf(stateAt('loc_silverwood_plaza', { mode: 'title' }), content)).toEqual(NO_SCENE);
    expect(sceneOf(stateAt('loc_silverwood_plaza', { mode: 'ending' }), content)).toEqual(NO_SCENE);
  });

  test('every place has a bed that exists: its own preset, else its region’s', () => {
    for (const loc of Object.values(content.locations)) {
      const bed = sceneOf(stateAt(loc.id), content).bed;
      expect(bed, loc.id).toBe(loc.ambient ?? content.regions[loc.regionId]?.ambient ?? null);
      expect(AMBIENT_PRESETS, loc.id).toContain(bed as string);
    }
  });

  test('the Threshold’s four places play the Threshold drone, in the Threshold mode too', () => {
    const places = Object.values(content.locations).filter((l) => l.regionId === 'region_threshold');
    expect(places.length).toBe(4);
    for (const p of places) {
      expect(sceneOf(stateAt(p.id), content).bed).toBe('ambient_threshold');
      expect(sceneOf(stateAt(p.id, { mode: 'threshold' }), content).bed).toBe('ambient_threshold');
    }
  });

  test('the Nexus and the Apex have their own beds; Silverwood Before plays its own', () => {
    expect(sceneOf(stateAt(APEX), content).bed).toBe('ambient_temporal_breach_apex');
    const before = Object.values(content.locations).find((l) => l.regionId === 'region_silverwood_before');
    expect(sceneOf(stateAt(before?.id ?? ''), content).bed).toBe('ambient_silverwood_before');
    const nexus = Object.values(content.locations).filter((l) => l.ambient === 'ambient_chronos_nexus');
    expect(nexus.length).toBeGreaterThan(0);
  });

  test('indoor art templates are interior', () => {
    const interior = Object.values(content.locations).filter((l) => sceneOf(stateAt(l.id), content).interior);
    expect(interior.length).toBeGreaterThan(5);
    for (const l of interior) expect(['cavern', 'archive', 'sanctum', 'undercity', 'observatory']).toContain(l.art.template);
    const outdoors = Object.values(content.locations).find((l) => l.art.template === 'steppe');
    expect(sceneOf(stateAt(outdoors?.id ?? ''), content).interior).toBe(false);
  });

  test('an infected node or a running Horde is infected', () => {
    expect(sceneOf(stateAt(APEX), content).infected).toBe(false);
    expect(sceneOf(stateAt(APEX, { infected: [APEX] }), content).infected).toBe(true);
    expect(sceneOf(stateAt(APEX, { infected: ['loc_elsewhere'] }), content).infected).toBe(false);
    expect(sceneOf(stateAt(APEX, { horde: true }), content).infected).toBe(true);
  });

  test('the Tyrant’s fights carry the phase; the communion carries its movement and resolve', () => {
    const tyrant = (over: Fight): GameState => stateAt(APEX, { mode: 'combat', fight: over });
    const contained = { refId: 'cr_chronos_tyrant_contained', phase: 2 };
    expect(sceneOf(tyrant({ enemies: [contained] }), content)).toMatchObject({ tyrant: 2, resolve: -1, bed: 'ambient_temporal_breach_apex' });
    expect(sceneOf(tyrant({ enemies: [{ refId: 'cr_chronos_tyrant_unveiled', phase: 3 }] }), content).tyrant).toBe(3);
    expect(sceneOf(tyrant({ enemies: [contained], communion: { movement: 2, resolve: 5 } }), content)).toMatchObject({ tyrant: 1, resolve: 5 });
    // its adds do not make the theme, nor does an ordinary fight, a dead Tyrant, or a won fight
    expect(sceneOf(tyrant({ enemies: [{ refId: 'cr_tyrants_reach' }] }), content).tyrant).toBe(-1);
    expect(sceneOf(tyrant({ enemies: [{ refId: 'cr_horde_husk' }] }), content).tyrant).toBe(-1);
    expect(sceneOf(tyrant({ enemies: [{ ...contained, alive: false }] }), content).tyrant).toBe(-1);
    for (const phase of ['victory', 'defeat', 'fled']) expect(sceneOf(tyrant({ phase, enemies: [contained] }), content).tyrant).toBe(-1);
    // the theme belongs to the fight, not to the place
    expect(sceneOf(stateAt(APEX), content).tyrant).toBe(-1);
  });
});

describe('the ambient layer of an engine', () => {
  test('one each, and the page’s shared one is the shared engine’s', () => {
    const engine = createAudioEngine();
    expect(ambientFor(engine)).toBe(ambientFor(engine));
    expect(ambientFor(createAudioEngine())).not.toBe(ambientFor(engine));
    expect(sharedAmbient()).toBe(sharedAmbient());
  });
});
