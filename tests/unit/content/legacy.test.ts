// Legacy preservation (D-001, PLAN Appendix A, validator rule 22): every legacy location, creature, item and NPC that has
// landed in the real pack is held, character for character, to its source in legacy/aethelgard_data.py (names,
// descriptions, events, exits, placements, loot) and legacy/echoes_of_aethelgard.py (minimap positions, the Depths' lock
// line). U42 starts the list with the Silverwood Ruins' rows; each later region unit appends its legacy ids to `LANDED`
// and the checks below run over them unchanged. WORLD may append one sentence to a legacy description (marked `+`), so a
// description must START with the legacy text; everything else is equal.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { LEGACY_CREATURES, LEGACY_ITEMS, LEGACY_LOCATIONS, LEGACY_NPCS } from '@content/validate';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const DATA = fs.readFileSync(path.join(ROOT, 'legacy/aethelgard_data.py'), 'utf8');
const GAME = fs.readFileSync(path.join(ROOT, 'legacy/echoes_of_aethelgard.py'), 'utf8');
const pack = buildContentPack();

/** The legacy ids that exist in the real pack so far. Later region units append theirs here. */
const LANDED = {
  // U42: Silverwood Ruins
  locations: ['loc_whispering_ruins', 'loc_crumbling_archway', 'loc_darkened_corridor', 'loc_shattered_library', 'loc_silverwood_plaza', 'loc_sunken_archives', 'loc_heartstone_depths'],
  creatures: ['cr_corrupted_shade', 'cr_arcane_wisp', 'cr_drowned_archivist'],
  npcs: ['npc_ilyra'],
} as const;

// ---- Reading the Python source -------------------------------------------------------------------------------------------------

/** Legacy name → id, from the validator's Appendix A tables. */
const idOfLocation = Object.fromEntries(Object.entries(LEGACY_LOCATIONS).map(([id, l]) => [l.name, id]));
const idOfItem = Object.fromEntries(Object.entries(LEGACY_ITEMS).map(([id, name]) => [name, id]));
const idOfCreature = Object.fromEntries(Object.entries(LEGACY_CREATURES).map(([id, name]) => [name, id]));

/** The `"Name": { … }` block of one entry of a Python dict literal (balanced braces). */
function pyBlock(source: string, dict: string, name: string): string {
  const dictStart = source.indexOf(`${dict} = {`);
  if (dictStart < 0) throw new Error(`no dict ${dict}`);
  const start = source.indexOf(`\n    "${name}": {`, dictStart);
  if (start < 0) throw new Error(`no entry ${name} in ${dict}`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unbalanced entry ${name}`);
}

/** A Python string value: adjacent `"…" "…"` fragments (implicit concatenation) joined; `\"` unescaped. */
function pyString(block: string, key: string): string {
  const m = new RegExp(`"${key}":\\s*\\(?\\s*((?:"(?:[^"\\\\]|\\\\.)*"\\s*)+)\\)?`).exec(block);
  if (!m) throw new Error(`no string ${key}`);
  return [...(m[1] ?? '').matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((f) => (f[1] ?? '').replace(/\\"/g, '"')).join('');
}

/** A Python list of strings: `["A", "B"]`. */
function pyStringList(block: string, key: string): string[] {
  const m = new RegExp(`"${key}":\\s*\\[([^\\]]*)\\]`).exec(block);
  return m ? [...(m[1] ?? '').matchAll(/"([^"]*)"/g)].map((f) => f[1] ?? '') : [];
}

/** A Python dict of string → string: `{"north": "Crumbling Archway", …}`. */
function pyStringDict(block: string, key: string): Record<string, string> {
  const m = new RegExp(`"${key}":\\s*\\{([^}]*)\\}`).exec(block);
  return Object.fromEntries([...(m?.[1] ?? '').matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((f) => [f[1] ?? '', f[2] ?? '']));
}

/** The legacy `events` list: `{"id": …, "text": …, "once": True}` entries. */
function pyEvents(block: string): { id: string; text: string; once: boolean }[] {
  const start = block.indexOf('"events": [');
  if (start < 0) return [];
  const list = block.slice(start, block.indexOf(']', start));
  return [...list.matchAll(/\{\s*"id":\s*"([^"]+)",\s*"text":\s*"((?:[^"\\]|\\.)*)",\s*"once":\s*(True|False)/g)].map((m) => ({ id: m[1] ?? '', text: (m[2] ?? '').replace(/\\"/g, '"'), once: m[3] === 'True' }));
}

/** `MINIMAP_LAYOUT`: legacy name → (x, y). */
function minimap(): Record<string, { x: number; y: number }> {
  const start = GAME.indexOf('MINIMAP_LAYOUT = {');
  const end = GAME.indexOf('\n}', start);
  return Object.fromEntries([...GAME.slice(start, end).matchAll(/"([^"]+)": \{"abbr": "[A-Z]{2}", "pos": \((-?\d+), (-?\d+)\)\}/g)].map((m) => [m[1] ?? '', { x: Number(m[2]), y: Number(m[3]) }]));
}

const need = <T>(v: T | undefined, what: string): T => {
  if (v === undefined) throw new Error(`missing ${what}`);
  return v;
};

// ---- Locations ---------------------------------------------------------------------------------------------------------------

describe('legacy locations (aethelgard_data.py LOCATION_DEFS; echoes_of_aethelgard.py MINIMAP_LAYOUT)', () => {
  const positions = minimap();

  test('every landed legacy location exists with its Appendix A name as legacyName, and the LANDED list names only legacy ids', () => {
    for (const id of LANDED.locations) {
      const loc = need(pack.locations[id], id);
      expect([id, loc.legacyName, loc.name]).toEqual([id, LEGACY_LOCATIONS[id]?.name, LEGACY_LOCATIONS[id]?.name]);
      expect([id, loc.regionId]).toEqual([id, LEGACY_LOCATIONS[id]?.region]);
    }
    for (const id of LANDED.creatures) expect(LEGACY_CREATURES[id]).toBeDefined();
    for (const id of LANDED.npcs) expect(LEGACY_NPCS[id]).toBeDefined();
  });

  test('descriptions start with the Python text, character for character (WORLD may append one sentence)', () => {
    for (const id of LANDED.locations) {
      const loc = need(pack.locations[id], id);
      const block = pyBlock(DATA, 'LOCATION_DEFS', loc.legacyName ?? '');
      const legacy = pyString(block, 'description');
      expect(legacy.length).toBeGreaterThan(20);
      expect([id, loc.description.startsWith(legacy)]).toEqual([id, true]);
      const extra = loc.description.slice(legacy.length);
      if (extra !== '') expect([id, /^ [A-Z][^.]*\.$/.test(extra)]).toEqual([id, true]); // exactly one appended sentence
    }
  });

  test('legacy exits are all present, direction for direction, destination for destination (new exits may be added, none removed)', () => {
    for (const id of LANDED.locations) {
      const loc = need(pack.locations[id], id);
      const exits = pyStringDict(pyBlock(DATA, 'LOCATION_DEFS', loc.legacyName ?? ''), 'exits');
      expect(Object.keys(exits).length).toBeGreaterThan(0);
      for (const [dir, destName] of Object.entries(exits)) {
        const to = need(idOfLocation[destName], destName);
        expect([id, dir, loc.exits.find((e) => e.dir === dir)?.to]).toEqual([id, dir, to]);
      }
    }
  });

  test('legacy events keep their text, fire once, and their ids with the ev_ prefix', () => {
    for (const id of LANDED.locations) {
      const loc = need(pack.locations[id], id);
      for (const ev of pyEvents(pyBlock(DATA, 'LOCATION_DEFS', loc.legacyName ?? ''))) {
        const got = loc.events.find((e) => e.id === `ev_${ev.id}`);
        expect([id, ev.id, got?.text, got?.once, got?.trigger]).toEqual([id, ev.id, ev.text, ev.once, 'enter']);
      }
    }
  });

  test('legacy ground items are placed there (the Amulet in Loop 1 only, D-047; the Crystal in its alcove)', () => {
    for (const id of LANDED.locations) {
      const loc = need(pack.locations[id], id);
      for (const name of pyStringList(pyBlock(DATA, 'LOCATION_DEFS', loc.legacyName ?? ''), 'items')) {
        const itemId = need(idOfItem[name], name);
        expect([id, name, loc.items.some((i) => i.itemId === itemId)]).toEqual([id, name, true]);
      }
    }
    expect(pack.locations['loc_whispering_ruins']?.items).toEqual([{ itemId: 'item_amulet_of_echoes', count: 1, when: { loop: { max: 1 } }, hidden: false, once: true }]);
  });

  test('legacy enemies stand where they stood: a 100 % fixed encounter of that creature (WORLD may hold it off during a Horde)', () => {
    const hordeOff = JSON.stringify({ not: { flag: 'flag_horde_active' } });
    for (const id of LANDED.locations) {
      const loc = need(pack.locations[id], id);
      for (const name of pyStringList(pyBlock(DATA, 'LOCATION_DEFS', loc.legacyName ?? ''), 'enemies')) {
        const creatureId = need(idOfCreature[name], name);
        const enc = loc.encounters.find(
          (e) => e.groups.some((g) => g.creatureId === creatureId) && e.chance === 1 && e.once && (e.when === undefined || JSON.stringify(e.when) === hordeOff),
        );
        expect([id, name, enc !== undefined]).toEqual([id, name, true]);
      }
    }
  });

  test('legacy NPCs stand at their legacy location with their legacy description', () => {
    for (const id of LANDED.locations) {
      const loc = need(pack.locations[id], id);
      const block = pyBlock(DATA, 'LOCATION_DEFS', loc.legacyName ?? '');
      const npcsStart = block.indexOf('"npcs": [');
      const npcsText = block.slice(npcsStart, block.indexOf('"events"', npcsStart));
      for (const m of npcsText.matchAll(/"name": "([^"]+)",\s*"description": "([^"]+)"/g)) {
        const npcId = Object.entries(LEGACY_NPCS).find(([, name]) => name === m[1])?.[0];
        expect([id, m[1], npcId !== undefined && (loc.npcs as string[]).includes(npcId)]).toEqual([id, m[1], true]);
        expect([m[1], pack.npcs[npcId ?? '']?.description, pack.npcs[npcId ?? '']?.legacyName]).toEqual([m[1], m[2], m[1]]);
      }
    }
  });

  test('minimap positions are the legacy MINIMAP_LAYOUT (x spacing 8, y spacing 2, origin at the Library)', () => {
    for (const id of LANDED.locations) {
      const loc = need(pack.locations[id], id);
      expect([id, loc.map]).toEqual([id, positions[loc.legacyName ?? '']]);
    }
    expect(pack.locations['loc_shattered_library']?.map).toEqual({ x: 0, y: 0 });
  });

  test('the legacy exit graph of the Ruins (Appendix A.2) and the Depths’ legacy lock line', () => {
    const edges: [string, string, string][] = [
      ['loc_whispering_ruins', 'north', 'loc_crumbling_archway'],
      ['loc_whispering_ruins', 'east', 'loc_mistwood_path'],
      ['loc_whispering_ruins', 'south', 'loc_sunken_archives'],
      ['loc_crumbling_archway', 'north', 'loc_darkened_corridor'],
      ['loc_darkened_corridor', 'north', 'loc_shattered_library'],
      ['loc_shattered_library', 'east', 'loc_silverwood_plaza'],
      ['loc_silverwood_plaza', 'south', 'loc_mistwood_path'],
      ['loc_silverwood_plaza', 'east', 'loc_chasm_of_whispers'],
      ['loc_sunken_archives', 'south', 'loc_heartstone_depths'],
      ['loc_heartstone_depths', 'east', 'loc_shimmering_pass'],
    ];
    for (const [from, dir, to] of edges) expect([from, dir, pack.locations[from]?.exits.find((e) => e.dir === dir)?.to]).toEqual([from, dir, to]);
    const lock = /else:\n\s+print\("([^"]+)"\)/.exec(GAME.slice(GAME.indexOf('def move_player'), GAME.indexOf('def trigger_events')))?.[1];
    expect(lock).toBe('A sealed passage blocks your way. Something deeper must call you first.');
    expect(pack.locations['loc_sunken_archives']?.exits.find((e) => e.to === 'loc_heartstone_depths')?.lockedText).toBe(lock);
  });
});

// ---- Creatures ---------------------------------------------------------------------------------------------------------------

describe('legacy creatures (aethelgard_data.py ENEMY_DEFS)', () => {
  test('names and descriptions verbatim; legacy loot still drops', () => {
    for (const id of LANDED.creatures) {
      const c = need(pack.creatures[id], id);
      const name = need(LEGACY_CREATURES[id], id);
      expect([id, c.legacyName, c.name]).toEqual([id, name, name]);
      const block = pyBlock(DATA, 'ENEMY_DEFS', name);
      expect([id, c.description]).toEqual([id, pyString(block, 'description')]);
      for (const drop of pyStringList(block, 'loot')) {
        const itemId = need(idOfItem[drop], drop);
        expect([id, drop, c.loot.some((l) => l.itemId === itemId)]).toEqual([id, drop, true]);
      }
    }
  });

  test('the Shade’s Dark Spellbook: 100 % for the first Shade of the loop, then 50 % (D-055), as PLAN §5.4 spells it', () => {
    const shade = need(pack.creatures['cr_corrupted_shade'], 'shade');
    const rows = shade.loot.filter((l) => l.itemId === 'item_dark_spellbook');
    expect(rows.map((r) => [r.chance, JSON.stringify(r.when)])).toEqual([[1, JSON.stringify({ not: { flag: 'flag_spellbook_dropped' } })], [0.5, JSON.stringify({ flag: 'flag_spellbook_dropped' })]]);
    expect(shade.onDefeat).toEqual([{ setFlag: 'flag_spellbook_dropped' }]);
  });
});
