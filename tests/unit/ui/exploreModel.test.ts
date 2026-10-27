// The Explore screen's model (U64; PLAN §6.3, §8.3 `exitBar.test.tsx`; DESIGN §16.2–16.3, §10.1): exits, actions, people
// and things come from the legal-action list only; a locked exit carries its lockedText; the clock chip follows DESIGN
// §10.1's states; the HUD shows Corruption only after the first spellbook; the place text follows variants and the last
// step's events. Fixture pack (tests/fixtures/miniContent.ts).
import { describe, expect, test } from 'bun:test';
import { legalActions, type Action, type GameState, type Profile } from '@engine/index';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import {
  actionRows,
  arrivalText,
  clockLevel,
  clockModel,
  exitRows,
  firstTalk,
  hudModel,
  itemRows,
  legalSet,
  logLines,
  npcRows,
  placeModel,
  resolvedArt,
  threatCue,
} from '@ui/screens/exploreModel';
import { buildMap, nodeLabel } from '@ui/panels/mapModel';
import { exitName } from '@ui/components/MovePad';
import { fixturePack } from '@tests/fixtures/miniContent';

const content = fixturePack();
/** A literal string as a RegExp source. */
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function started(seed = 'explore-model'): { state: GameState; profile: Profile } {
  const store = createGameStore(content, freshProfile('p'), { storage: null });
  const result = store.shell.newGame('Ann', 'ranger', seed);
  if (!result.ok) throw new Error(result.error);
  return { state: store.getState(), profile: store.getProfile() };
}

/** A mutable copy of `state` standing at `locationId` (the model only reads the state). */
function at(state: GameState, locationId: string, edit: (s: GameState) => void = () => undefined): GameState {
  const s = structuredClone(state);
  s.world.currentLocationId = locationId;
  edit(s);
  return s;
}

const legal = (s: GameState, p: Profile): Action[] => legalActions(s, content, p);
const all = { canLook: true, canOpenPanel: () => false };

describe('time and the clock chip (DESIGN §16.2, §10.1)', () => {
  test('arrivalText names the watch, and the day when it changes', () => {
    expect(arrivalText(0, 1)).toBe('Day');
    expect(arrivalText(2, 1)).toBe('Night');
    expect(arrivalText(3, 1)).toBe('Day 2 · Dawn');
    expect(arrivalText(6, 4)).toBe('Day 3 · Dusk');
  });

  test('levels: calm, amber at 10, pulsing at 5, red at 2, bold on the last, expired', () => {
    expect([11, 10, 6, 5, 3, 2, 1, 0].map((d) => clockLevel(d, false))).toEqual(['calm', 'amber', 'amber', 'amber-pulse', 'amber-pulse', 'red', 'red-bold', 'expired']);
    expect(clockLevel(20, true)).toBe('expired');
  });

  const base = { ticks: 26, limitTicks: 116, frozen: false, expired: false, hordeActive: false, before: null };

  test('Loop 1 is the small "Day 7 · Dusk" with no countdown and no colour', () => {
    const c = clockModel({ ...base, loop: 1, ticks: 110 });
    expect(c).toMatchObject({ kind: 'loop1', text: 'Day 28 · Dusk', level: 'calm', day: 28 });
    expect(c.label).toBe('Day 28, dusk.');
  });

  test('Loop 2+ is the Breach Clock with the dawns left and its state', () => {
    const c = clockModel({ ...base, loop: 2 });
    expect(c.text).toBe('Breach Clock · Day 7 · 23 dawns left');
    expect(c.level).toBe('calm');
    const late = clockModel({ ...base, loop: 3, ticks: 108, hordeActive: true });
    expect(late.text).toBe('Breach Clock · Day 28 · 2 dawns left');
    expect(late.level).toBe('red');
    expect(late.label).toContain('The Horde is moving.');
    expect(clockModel({ ...base, loop: 2, ticks: 112 }).text).toBe('Breach Clock · Day 29 · 1 dawn left');
    const over = clockModel({ ...base, loop: 2, ticks: 116, expired: true });
    expect(over).toMatchObject({ level: 'expired', text: 'Breach Clock · Day 30 · the Breach is open' });
  });

  test('inside the Before the chip shows the Bell and the echo’s own hour; the audit trail reads in days', () => {
    const c = clockModel({ ...base, loop: 2, frozen: true, before: { day: 2, resets: 0 }, watch: 2, modifiers: [{ source: 'Heartstone stabilized', watches: 24 }, { source: 'Hour Leech', watches: -1 }] });
    expect(c).toMatchObject({ kind: 'before', text: 'Second Bell · Dusk', level: 'calm' });
    expect(c.modifiers).toEqual(['Heartstone stabilized: +6 days', 'Hour Leech: −1 watch']);
  });
});

describe('exits (ExitBar)', () => {
  const { state, profile } = started();

  test('come from the visible exits; `canGo` mirrors legalActions; cost and arrival are shown', () => {
    const rows = exitRows(state, content, profile, legal(state, profile));
    expect(rows).toHaveLength(1); // the fixture road is hidden until its gate holds
    expect(rows[0]).toMatchObject({ to: 'loc_shattered_library', dir: 'north', dirLabel: 'North', name: 'Shattered Library', cost: '1 watch', arrive: 'Day', state: 'open', canGo: true, reason: null, danger: null, road: false });
    // an empty legal list enables nothing
    expect(exitRows(state, content, profile, [])[0]?.canGo).toBe(false);
  });

  test('a locked exit renders its lockedText and what is missing', () => {
    const s = at(state, 'loc_chronos_nexus');
    const rows = exitRows(s, content, profile, legal(s, profile));
    const north = rows.find((r) => r.dir === 'north');
    expect(north?.state).toBe('locked');
    expect(north?.canGo).toBe(false);
    expect(String(north?.reason)).toMatch(new RegExp(`^${escape('The stair up into the Breach will not hold you yet.')}`));
    expect(north?.reason).toContain('Needs:');
    expect(rows.map((r) => r.dir)).toEqual(['north', 'west']); // DIR_ORDER, the road still hidden
  });

  test('a road appears once its gate holds; an infected destination warns; a frozen clock costs nothing', () => {
    const p: Profile = { ...profile, echoes: [...profile.echoes, 'echo_apex_resonance'] };
    const s = at(state, 'loc_whispering_ruins', (x) => {
      x.world.infected = ['loc_shattered_library'];
      x.clock.frozen = true;
    });
    const rows = exitRows(s, content, p, legal(s, p));
    const road = rows.find((r) => r.road);
    expect(road).toMatchObject({ dir: 'path', label: 'the Aether Road, remembered', cost: 'No time passes', arrive: null });
    expect(rows.find((r) => r.to === 'loc_shattered_library')?.danger).toBe('⚠ −33% HP: the Horde is there');
  });
});

describe('the danger cue (U84, D-149 #1)', () => {
  const { state, profile } = started();
  const bandMin = (id: string): number => {
    const loc = content.locations[id]!;
    return (loc.levelBand ?? content.regions[loc.regionId]?.levelBand)!.min;
  };

  test('threatCue: nothing at or below the band, "Dangerous" 1–2 levels under it, "Deadly" 3 or more; never for a safe place', () => {
    const lib = 'loc_shattered_library';
    const min = bandMin(lib);
    expect(threatCue(content, lib, min)).toBeNull();
    expect(threatCue(content, lib, min + 3)).toBeNull();
    if (min >= 2) expect(threatCue(content, lib, min - 1)).toBe(`Dangerous (L${min}+)`);
    expect(threatCue(content, lib, min - 2)).toBe(`Dangerous (L${min}+)`);
    expect(threatCue(content, lib, min - 3)).toBe(`Deadly (L${min}+)`);
    const safe = Object.values(content.locations).find((l) => l.safe);
    if (safe !== undefined) expect(threatCue(content, safe.id, -50)).toBeNull();
    expect(threatCue(content, 'nowhere', 1)).toBeNull();
  });

  test('the pad button and the map node carry it in their names, in words', () => {
    const lib = 'loc_shattered_library';
    const s = at(state, state.world.currentLocationId, (x) => void (x.player.level = bandMin(lib) - 3));
    const row = exitRows(s, content, profile, legal(s, profile)).find((r) => r.to === lib)!;
    expect(row.threat).toBe(`Deadly (L${bandMin(lib)}+)`);
    expect(exitName(row)).toMatch(new RegExp(`^${escape(`North: Shattered Library, Deadly (L${bandMin(lib)}+), 1 watch`)}`));
    const node = buildMap(s, content, profile).nodes.find((n) => n.id === lib)!;
    expect(node.threat).toBe(row.threat);
    expect(nodeLabel(node)).toContain(`Deadly (L${bandMin(lib)}+)`);
    // where you stand carries none; at the band's level there is none
    expect(buildMap(s, content, profile).nodes.find((n) => n.state === 'current')?.threat).toBeNull();
    const even = at(state, state.world.currentLocationId, (x) => void (x.player.level = bandMin(lib)));
    expect(exitRows(even, content, profile, legal(even, profile)).find((r) => r.to === lib)?.threat).toBeNull();
  });
});

describe('people, things and actions', () => {
  const { state, profile } = started();
  const l = legal(state, profile);

  test('NPCs present, with Talk only where `talk` is legal; T picks the first who will talk', () => {
    const npcs = npcRows(state, content, profile, l);
    expect(npcs.map((n) => n.id)).toEqual(['npc_ilyra']);
    expect(npcs[0]?.canTalk).toBe(l.some((a) => a.type === 'talk'));
    expect(firstTalk([{ id: 'a', name: 'A', role: null, canTalk: false }, { id: 'b', name: 'B', role: null, canTalk: true }])?.id).toBe('b');
    expect(firstTalk([])).toBeUndefined();
  });

  test('items lying here, each takeable when `take` is legal', () => {
    const items = itemRows(state, content, l);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Amulet of Echoes', qty: 1, canTake: true });
    expect(itemRows(state, content, [])[0]?.canTake).toBe(false);
  });

  test('the ActionBar lists the location actions that are legal, in a fixed order, with their previews', () => {
    const rows = actionRows(state, content, l, all);
    expect(rows.map((r) => r.id)).toEqual(['look', 'take-all', 'rest-short', 'rest-full', 'wait']);
    expect(rows.find((r) => r.id === 'rest-full')?.detail).toBe('Sleep until Day 2 · Dawn');
    expect(rows.find((r) => r.id === 'rest-short')?.detail).toBe('1 watch → Day · +30% HP and MP');
    expect(rows.find((r) => r.id === 'wait')?.action).toEqual({ type: 'wait' });
    // nothing that is not legal: no list, no buttons (Look is the caller's examine check)
    expect(actionRows(state, content, [], { ...all, canLook: false })).toEqual([]);
  });

  test('gather, retreat, interact, the portal, the camp loop-enders and the panels', () => {
    const s = at(state, 'loc_veridian_glowlands', (x) => {
      x.world.previousLocationId = 'loc_silverwood_plaza';
      x.world.hordeActive = false;
    });
    const fake: Action[] = [
      { type: 'gather' },
      { type: 'retreat' },
      { type: 'enterPortal' },
      { type: 'keepVigil' },
      { type: 'letGo' },
      { type: 'interact', eventId: 'ev_glowlands_pulse' },
    ];
    const rows = actionRows(s, content, fake, { canLook: false, canOpenPanel: () => true });
    expect(rows.map((r) => r.id)).toEqual(['gather-item_glow_moss', 'retreat', 'interact-ev_glowlands_pulse', 'portal', 'vigil', 'let-go']);
    expect(rows.find((r) => r.id === 'retreat')?.label).toBe('Go back to Silverwood Plaza');
    expect(rows.find((r) => r.id === 'gather-item_glow_moss')?.label).toBe('Gather Glow Moss');
    for (const id of ['portal', 'vigil', 'let-go']) expect(rows.find((r) => r.id === id)?.confirm).toBeDefined();
    expect(rows.find((r) => r.id === 'let-go')?.danger).toBe(true);
    // a merchant's stall opens the merchant panel once it exists
    const plaza = at(state, 'loc_silverwood_plaza');
    expect(actionRows(plaza, content, [], { canLook: false, canOpenPanel: () => true }).map((r) => [r.id, r.panel])).toEqual([['merchant', 'merchant']]);
    expect(actionRows(plaza, content, [], { canLook: false, canOpenPanel: () => false })).toEqual([]);
  });

  test('legalSet compares actions by content, not key order', () => {
    const has = legalSet([{ type: 'move', to: 'x' }, { type: 'examine', target: { kind: 'location' } }]);
    expect(has({ to: 'x', type: 'move' } as Action)).toBe(true);
    expect(has({ type: 'move', to: 'y' })).toBe(false);
  });
});

describe('the place and the HUD', () => {
  const { state, profile } = started();

  test('the place: region, band, facts, description, and the last step’s events', () => {
    const place = placeModel(state, content, profile);
    expect(place).toMatchObject({ name: 'Whispering Ruins', regionName: 'Silverwood Ruins', band: 'Lv 1–2', facts: ['Camp', 'Safe'], infected: false });
    expect(place?.notes).toEqual(['A low, resonant hum vibrates under your skin, as if the stones are breathing.']);
    expect(placeModel(at(state, 'loc_nowhere'), content, profile)).toBeNull();
  });

  test('description variants, the infected line, merchants, art variants', () => {
    const s = at(state, 'loc_whispering_ruins', (x) => {
      x.meta.loop = 2;
      x.world.infected = ['loc_whispering_ruins'];
    });
    const place = placeModel(s, content, profile);
    expect(String(place?.description)).toMatch(new RegExp(`^${escape('The whispers are the same.')}`));
    expect(String(place?.description)).toMatch(new RegExp(`${escape('The air here is coming apart at the seams.')}$`));
    expect(place?.infected).toBe(true);
    expect(placeModel(at(state, 'loc_silverwood_plaza'), content, profile)?.facts).toEqual(['Trader: Scribe Tamsin Reed']);
    expect(resolvedArt(state, content, profile, 'loc_whispering_ruins')?.template).toBe('ruins');
    expect(resolvedArt(state, content, profile, 'loc_nowhere')).toBeUndefined();
  });

  test('the HUD: vitals by the class resource name, gold, the loop, the clock; Corruption after the first spellbook', () => {
    const hud = hudModel(state, content);
    expect(hud).toMatchObject({ name: 'Ann', className: 'Ranger', level: 1, resourceName: 'Focus', loop: 1, showCorruption: false, companion: null });
    expect(hud.hp).toBe(hud.hpMax);
    expect(hud.clock.text).toBe('Day 1 · Dawn');
    const read = structuredClone(state);
    read.player.uses.spellbooksRead = { loop: 1, count: 1 };
    read.player.statuses = [{ statusId: 'status_poison', stacks: 1, duration: 3, sourceUid: null, appliedOnOwnTurn: false }];
    const after = hudModel(read, content);
    expect(after.showCorruption).toBe(true);
    expect(after.statuses).toEqual([{ id: 'status_poison', name: content.statuses.status_poison?.name ?? 'status_poison', left: 3, icon: 'status_poison' }]);
  });

  test('the log: the last lines of the run, oldest first, with stable keys', () => {
    const lines = logLines(state, 40);
    expect(lines.map((l) => l.text)).toContain('A low, resonant hum vibrates under your skin, as if the stones are breathing.');
    const many = structuredClone(state);
    many.recentLog = Array.from({ length: 60 }, (_, i) => ({ step: i, text: `line ${i}`, kind: 'narration' as const }));
    const tail = logLines(many, 40);
    expect(tail).toHaveLength(40);
    expect(tail[0]?.text).toBe('line 20');
    expect(new Set(tail.map((l) => l.key)).size).toBe(40);
  });
});
