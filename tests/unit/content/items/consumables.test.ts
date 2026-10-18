// U50: the 87 non-gear items (src/content/items/{consumables,materials,quest}.ts, abilities/consumables.ts) checked against the documents
// at test time: WORLD §7.8 (20 consumables), §7.10 (18 quest items), §7.11 (6 keys), §7.12 (10 recipe items), §7.13 (8 tomes) and §8.1
// (25 materials), with §9.2 (merchant stock), §6 (loot) and §3 (placements) for the sources; STORY §14.1 for the codex ids the tomes
// unlock; and the Python source for the ten legacy records (description, gold value, numbers, `major`). The Effect column of the
// consumables is read by a small interpreter; a clause it does not know fails the test, so an edit to WORLD or to the content cannot
// slip through. With U49's gear this makes the item table whole: every id WORLD §7 and §8.1 names is a record, and nothing else is.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { consumableAbilities } from '@content/abilities/consumables';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { armor } from '@content/items/armor';
import { consumables } from '@content/items/consumables';
import { materials } from '@content/items/materials';
import { keyItems, questItems, questTableItems, recipeItems, tomes } from '@content/items/quest';
import { trinkets } from '@content/items/trinkets';
import { weapons } from '@content/items/weapons';
import { INCOMPLETE_TABLES } from '@content/progress';
import { LEGACY_ITEMS, validateContent } from '@content/validate';
import { derive, step, type GameState } from '@engine/index';
import { ITEM_SOURCE_RE, ItemSchema, type Item, type ItemInput } from '@schema/item';
import { freshProfile, makeState } from '@tests/fixtures/helpers';
import { WORLD, ids, section, tableRows, unquote } from '../regions/worldDoc';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const STORY = fs.readFileSync(path.join(ROOT, 'docs/STORY.md'), 'utf8');
const DATA = fs.readFileSync(path.join(ROOT, 'legacy/aethelgard_data.py'), 'utf8');
const pack = buildContentPack();

const item = (id: string): Item => {
  const found = pack.items[id];
  if (!found) throw new Error(`no item ${id}`);
  return found;
};

// ---- the document's rows ------------------------------------------------------------------------------------------------------------

type Cells = string[];
const itemRows = (from: string, to: string): Cells[] => tableRows(section(WORLD, from, to)).filter((c) => /^`(?:item|mat)_[a-z0-9_]+`/.test(c[0] ?? ''));
/** The id in the first cell (`mat_bell_bronze` **W** has a marker after it). */
const idOf = (c: Cells): string => /^`([a-z0-9_]+)`/.exec(c[0] ?? '')?.[1] ?? '';

/** `Chronal Dust` is in §8.1 too ("see §7.8"): its record is the consumable. */
const CONS = itemRows('### 7.8 ', '### 7.9 ');
const QUEST = itemRows('### 7.10 ', '### 7.11 ');
const KEYS = itemRows('### 7.11 ', '### 7.12 ');
const PATTERNS = itemRows('### 7.12 ', '### 7.13 ');
const TOMES = itemRows('### 7.13 ', '## 8. Crafting');
const MATS = itemRows('### 8.1 ', '### 8.2 ').filter((c) => idOf(c) !== 'item_chronal_dust');
const GEAR_ROWS = [
  ['### 7.1 ', '### 7.2 '],
  ['### 7.2 ', '### 7.3 '],
  ['### 7.3 ', '### 7.4 '],
  ['### 7.4 ', '### 7.5 '],
  ['### 7.5 ', '### 7.6 '],
  ['### 7.6 ', '### 7.7 '],
  ['### 7.7 ', '### 7.8 '],
].flatMap(([from, to]) => itemRows(from as string, to as string));

/** The `g` cell: `—` is 0; "30 g — …" and "12" are their number. */
const gold = (cell: string | undefined): number => (cell === undefined || cell.startsWith('—') ? 0 : Number(/^(\d+)/.exec(cell)?.[1]));
const tierOf = (cell: string | undefined): number => Number(/^T([1-5])$/.exec(cell ?? '')?.[1]);
const stripLegacy = (s: string): string => s.replace(/\s*\*\(legacy:.*\)\*\s*$/, '').trim();

// ---- what the records are --------------------------------------------------------------------------------------------------------------

interface Table {
  label: string;
  rows: Cells[];
  records: readonly ItemInput[];
  type: Item['type'];
  /** The columns (0-based) of the row: tier, stack, gold, sources, description. */
  col: { tier?: number; stack?: number; gold?: number; sources: number; description?: number };
}

const TABLES: Table[] = [
  { label: '§7.8 consumables', rows: CONS, records: consumables, type: 'consumable', col: { tier: 2, gold: 4, sources: 5, description: 6 } },
  { label: '§7.10 quest items', rows: QUEST, records: questItems, type: 'quest', col: { gold: 3, sources: 4, description: 5 } },
  { label: '§7.11 keys', rows: KEYS, records: keyItems, type: 'key', col: { sources: 3, description: 4 } },
  { label: '§7.12 recipe items', rows: PATTERNS, records: recipeItems, type: 'recipe', col: { gold: 3, sources: 4 } },
  { label: '§7.13 tomes', rows: TOMES, records: tomes, type: 'tome', col: { gold: 3, sources: 4, description: 5 } },
  { label: '§8.1 materials', rows: MATS, records: materials, type: 'material', col: { tier: 2, stack: 3, gold: 4, sources: 5 } },
];
const ALL_RECORDS: ItemInput[] = TABLES.flatMap((t) => [...t.records]);

describe('the item tables (items/consumables.ts, materials.ts, quest.ts) against WORLD §7.8–7.13 and §8.1', () => {
  test('counts: 20 consumables, 18 quest items, 6 keys, 10 recipe items, 8 tomes, 25 materials; every WORLD row is a record, in its order', () => {
    expect(TABLES.map((t) => [t.label, t.rows.length, t.records.length])).toEqual([
      ['§7.8 consumables', 20, 20],
      ['§7.10 quest items', 18, 18],
      ['§7.11 keys', 6, 6],
      ['§7.12 recipe items', 10, 10],
      ['§7.13 tomes', 8, 8],
      ['§8.1 materials', 25, 25],
    ]);
    for (const t of TABLES) expect([t.label, t.records.map((r) => r.id)]).toEqual([t.label, t.rows.map(idOf)]);
    expect(questTableItems.map((r) => r.id)).toEqual([...questItems, ...keyItems, ...recipeItems, ...tomes].map((r) => r.id));
    expect(consumableAbilities).toHaveLength(7);
  });

  test('registered once each in contentTables, after the 70 pieces of gear (consumables, materials, then the quest file\'s four tables); starter.ts and amulet.ts are gone', () => {
    const registered = contentTables.items.map((i) => i.id);
    for (const r of ALL_RECORDS) expect([r.id, registered.filter((x) => x === r.id).length]).toEqual([r.id, 1]);
    expect(registered.slice(70, 70 + ALL_RECORDS.length)).toEqual([...consumables, ...materials, ...questTableItems].map((r) => r.id));
    expect(registered.slice(0, 70)).toEqual([...weapons, ...armor, ...trinkets].map((i) => i.id));
    expect(fs.existsSync(path.join(ROOT, 'src/content/items/starter.ts'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src/content/items/amulet.ts'))).toBe(false);
  });

  test('the whole item table is WORLD §7 and §8.1: 157 records, at least the 120 the validator wants, no id missing and none extra', () => {
    const wanted = [...new Set([...GEAR_ROWS, ...CONS, ...QUEST, ...KEYS, ...PATTERNS, ...TOMES, ...MATS].map(idOf))].sort();
    expect(wanted).toHaveLength(157);
    expect(Object.keys(pack.items).sort()).toEqual(wanted);
    expect(contentTables.items.length).toBeGreaterThanOrEqual(120);
    expect(new Set(contentTables.items.map((i) => i.id)).size).toBe(contentTables.items.length);
  });

  test('every record parses on its own with the item schema, and has the type of its table', () => {
    for (const t of TABLES) {
      for (const rec of t.records) {
        expect([rec.id, ItemSchema.safeParse(rec).success]).toEqual([rec.id, true]);
        expect([rec.id, item(rec.id).type]).toEqual([rec.id, t.type]);
      }
    }
  });

  test('name, tier, gold value and description of every row (tier 0 where WORLD gives none: the item belongs to no band)', () => {
    for (const t of TABLES) {
      for (const row of t.rows) {
        const rec = item(idOf(row));
        const tier = t.col.tier === undefined ? 0 : tierOf(row[t.col.tier]);
        // the keys' table has no g column: the Veil Sigil's "30 g" is in its Sources cell, the rest are never sold (§7.11)
        const value = t.col.gold === undefined ? gold(/\((\d+) g/.exec(row[t.col.sources] ?? '')?.[1]) : gold(row[t.col.gold]);
        expect([rec.id, rec.name, rec.tier, rec.value]).toEqual([rec.id, row[1], tier, value]);
        if (t.col.description !== undefined) expect([rec.id, rec.description]).toEqual([rec.id, stripLegacy(row[t.col.description] ?? '')]);
        else expect([rec.id, rec.description.length > 30]).toEqual([rec.id, true]); // WORLD has none for these: U50's words
      }
    }
  });

  test('stack sizes: consumables 10, tomes 5 (WORLD 7.8, 7.13), materials the Stack column (99; the Tyrant Shard 9); quest, key and recipe items do not stack', () => {
    for (const row of CONS) expect([idOf(row), item(idOf(row)).stackable, item(idOf(row)).maxStack]).toEqual([idOf(row), true, 10]);
    for (const row of TOMES) expect([idOf(row), item(idOf(row)).stackable, item(idOf(row)).maxStack]).toEqual([idOf(row), true, 5]);
    for (const row of MATS) expect([idOf(row), item(idOf(row)).stackable, item(idOf(row)).maxStack]).toEqual([idOf(row), true, Number(row[3])]);
    for (const row of [...QUEST, ...KEYS, ...PATTERNS]) expect([idOf(row), item(idOf(row)).stackable]).toEqual([idOf(row), false]);
    // §8.1 lists Chronal Dust again, as a material of stack 10: the consumable's own stack
    expect(tableRows(section(WORLD, '### 8.1 ', '### 8.2 ')).find((c) => unquote(c[0] ?? '') === 'item_chronal_dust')?.[3]).toBe('10');
    expect(item('item_chronal_dust').maxStack).toBe(10);
  });

  test('bound items: quest items are never sold or dropped; keys are never sold (WORLD 7.11) except the one a merchant stocks; schematic halves are bound', () => {
    for (const row of QUEST) expect([idOf(row), item(idOf(row)).sellable, item(idOf(row)).droppable]).toEqual([idOf(row), false, false]);
    const stocked = merchantStock();
    for (const row of KEYS) {
      const rec = item(idOf(row));
      // Hollis sells the Veil Sigil (the Veil tithe), and the validator forbids stocking what cannot be sold (rule 20)
      expect([rec.id, rec.sellable]).toEqual([rec.id, stocked[rec.id] !== undefined]);
      if (rec.id !== 'item_veil_sigil') expect([rec.id, rec.droppable]).toEqual([rec.id, false]);
    }
    // "Sellable except the two schematic halves (bound)"
    for (const row of PATTERNS) {
      const half = /_schematic_[ab]$/.test(idOf(row));
      expect([idOf(row), item(idOf(row)).sellable, item(idOf(row)).droppable]).toEqual([idOf(row), !half, !half]);
    }
    for (const row of [...CONS, ...TOMES, ...MATS]) expect([idOf(row), item(idOf(row)).sellable]).toEqual([idOf(row), true]);
  });

  test('legacy names: exactly the ten legacy non-gear items carry their Appendix A name as name and legacyName; the rest carry none', () => {
    const legacy = ALL_RECORDS.filter((r) => LEGACY_ITEMS[r.id] !== undefined);
    expect(legacy.map((r) => r.id).sort()).toEqual(
      [
        'item_ley_touched_tonic',
        'item_glow_moss',
        'item_mana_bloom',
        'item_chronal_dust',
        'item_dark_spellbook',
        'item_amulet_of_echoes',
        'item_echo_crystal',
        'item_scholars_lost_scroll',
        'item_void_shard',
        'item_aetherium_shard',
      ].sort(),
    );
    for (const r of legacy) expect([r.id, r.name, r.legacyName]).toEqual([r.id, LEGACY_ITEMS[r.id], LEGACY_ITEMS[r.id]]);
    for (const r of ALL_RECORDS.filter((x) => LEGACY_ITEMS[x.id] === undefined)) expect([r.id, r.legacyName]).toEqual([r.id, undefined]);
    // WORLD marks them: "*(legacy: …)*" in the Description cell, "*(legacy desc: …)*" in a material's Used-in cell
    const marked = [...CONS, ...QUEST, ...TOMES].filter((c) => /\*\(legacy:/.test(c[c.length - 1] ?? '')).map(idOf);
    const markedMats = MATS.filter((c) => /\*\(legacy desc:/.test(c[6] ?? '')).map(idOf);
    expect(legacy.map((r) => r.id).sort()).toEqual([...new Set([...marked, ...markedMats])].sort());
  });

  test('anchorable: exactly the items WORLD marks **anchorable** (Hallow\'s Cradle-Pin and the Warding Litany page)', () => {
    const want = [...QUEST, ...KEYS, ...PATTERNS, ...TOMES].filter((c) => /\*\*anchorable\*\*/.test(c.join('|'))).map(idOf);
    expect(want).toEqual(['item_caelums_anchor_token', 'item_litany_page_3']);
    for (const r of ALL_RECORDS) expect([r.id, item(r.id).anchorable]).toEqual([r.id, want.includes(r.id)]);
  });

  test('art: one icon per record; `major` exactly on the legacy items the Python source marks major', () => {
    const major = new Set(
      [...DATA.matchAll(/^ {4}"([^"]+)": \{[\s\S]*?\n {4}\},?$/gm)].filter((m) => /"major": True/.test(m[0])).map((m) => m[1] ?? ''),
    );
    for (const r of ALL_RECORDS) {
      const rec = item(r.id);
      expect([r.id, rec.art.icon.length > 0, rec.art.major]).toEqual([r.id, true, LEGACY_ITEMS[r.id] !== undefined && major.has(LEGACY_ITEMS[r.id] ?? '')]);
    }
    expect(ALL_RECORDS.filter((r) => item(r.id).art.major).map((r) => r.name)).toEqual([
      'Mana Bloom',
      'Amulet of Echoes',
      'Echo Crystal',
      "Scholar's Lost Scroll",
      'Dark Spellbook',
    ]);
  });
});

// ---- the consumables' Effect column ------------------------------------------------------------------------------------------------------

interface Use {
  heal: { hp?: number; mp?: number };
  revive?: number;
  cleanse?: { statuses: string[] } | 'all';
  /** An item ability (thrown, shield, regen, cleanse-all) the item grants. */
  ability?: { target: 'enemy' | 'self_or_ally' | 'self'; damageType?: string; amount?: number; statuses: { status: string; chance: number; duration: number }[]; shield?: number };
  /** The row says the item is for out-of-combat use only. */
  outOfCombatOnly: boolean;
  /** The row has an "out of combat" clause of its own. */
  outOfCombatClause: boolean;
  whetstone?: { basicAttacks: number; power: number };
  ink?: { status: string; amount: number };
  oilWard?: { status: string };
}

/** The clauses of an Effect cell: `;` and `. ` separate them. */
const clauses = (cell: string): string[] => cell.split(/;\s*|\.\s+/).map((c) => c.trim()).filter((c) => c !== '');

function useOf(row: Cells): Use {
  const out: Use = { heal: {}, outOfCombatOnly: false, outOfCombatClause: false };
  const ability = (): NonNullable<Use['ability']> => (out.ability ??= { target: 'enemy', statuses: [] });
  for (const clause of clauses(row[3] ?? '')) {
    let m: RegExpExecArray | null;
    if ((m = /^heal (\d+)$/.exec(clause))) out.heal.hp = Number(m[1]);
    else if ((m = /^mp (\d+)(?: \(also a material, §8\.1\))?$/.exec(clause))) out.heal.mp = Number(m[1]);
    else if (/^cleanse `status_/.test(clause)) out.cleanse = { statuses: [...clause.matchAll(/`(status_[a-z_]+)`/g)].map((x) => x[1] ?? '') };
    else if (clause === 'cleanse all negative statuses') {
      out.cleanse = 'all';
      Object.assign(ability(), { target: 'self' });
    } else if ((m = /^thrown: `([a-z]+)` (\d+)$/.exec(clause))) Object.assign(ability(), { target: 'enemy', damageType: m[1], amount: Number(m[2]) });
    else if ((m = /^`(status_[a-z_]+)` (\d+)% \((\d+)\)$/.exec(clause))) {
      ability().statuses.push({ status: m[1] ?? '', chance: Number(m[2]) / 100, duration: Number(m[3]) });
    } else if ((m = /^self or ally: `status_shield` (\d+)$/.exec(clause))) Object.assign(ability(), { target: 'self_or_ally', shield: Number(m[1]) });
    else if ((m = /^`(status_regen)` \((\d+)\)$/.exec(clause))) {
      Object.assign(ability(), { target: 'self' });
      ability().statuses.push({ status: m[1] ?? '', chance: 1, duration: Number(m[2]) });
    } else if ((m = /^out of combat only: heal (\d+)$/.exec(clause))) {
      out.heal.hp = Number(m[1]);
      out.outOfCombatOnly = true;
    } else if ((m = /^out of combat: next (\d+) basic attacks power \+(\d+) \(this fight\)$/.exec(clause))) {
      Object.assign(out, { whetstone: { basicAttacks: Number(m[1]), power: Number(m[2]) }, outOfCombatOnly: true, outOfCombatClause: true });
    } else if ((m = /^revive a KO'd companion at (\d+)% HP \(in or out of combat\)$/.exec(clause))) out.revive = Number(m[1]) / 100;
    else if ((m = /^out of combat: `(status_shield)` (\d+) at the start of the next fight$/.exec(clause))) {
      Object.assign(out, { ink: { status: m[1], amount: Number(m[2]) }, outOfCombatOnly: true, outOfCombatClause: true });
    } else if (clause === 'Out of combat: no Blind on ambush until next dawn') Object.assign(out, { oilWard: { status: 'status_blind' }, outOfCombatClause: true });
    else throw new Error(`${idOf(row)}: effect clause not understood: ${JSON.stringify(clause)}`);
  }
  return out;
}

const slug = (id: string): string => id.replace(/^item_/, '');
type Atom = Record<string, unknown>;

describe('the consumables\' effects (WORLD §7.8 Effect column)', () => {
  test('the interpreter reads all twenty rows', () => {
    expect(CONS.map((r) => useOf(r)).filter((u) => Object.keys(u.heal).length > 0 || u.revive !== undefined || u.ability || u.cleanse || u.whetstone || u.ink)).toHaveLength(20);
  });

  test('heal and revive are the item\'s `onUse`; a use that does something else is only counted (a consumable needs one onUse effect)', () => {
    for (const row of CONS) {
      const want = useOf(row);
      const rec = item(idOf(row));
      const atoms: Atom[] = [];
      if (Object.keys(want.heal).length > 0) atoms.push({ heal: want.heal });
      if (want.revive !== undefined) atoms.push({ revive: want.revive });
      if (atoms.length === 0) atoms.push({ counter: { name: `used_${slug(rec.id)}`, delta: 1 } });
      expect([rec.id, rec.onUse]).toEqual([rec.id, atoms]);
    }
  });

  test('combat and explore: out-of-combat rows are not usable in a fight; a thrown item or a shield is not usable out of one', () => {
    for (const row of CONS) {
      const want = useOf(row);
      const rec = item(idOf(row));
      const onlyAbility = want.ability !== undefined && Object.keys(want.heal).length === 0 && want.revive === undefined && want.cleanse !== 'all';
      expect([rec.id, rec.usableInCombat, rec.usableOutOfCombat]).toEqual([rec.id, !want.outOfCombatOnly, !(onlyAbility && !want.outOfCombatClause)]);
      expect([rec.id, rec.consumeOnUse]).toEqual([rec.id, true]);
    }
  });

  test('passives: the granted item ability, the named cleanse, and the three out-of-combat effects with WORLD\'s numbers', () => {
    for (const row of CONS) {
      const want = useOf(row);
      const rec = item(idOf(row));
      const kinds: string[] = [];
      if (want.ability) kinds.push(`grantAbility:itm_${slug(rec.id)}`);
      if (want.cleanse !== undefined && want.cleanse !== 'all') kinds.push('custom:cleanse');
      if (want.oilWard) kinds.push('custom:lantern_oil_ward');
      if (want.whetstone) kinds.push('custom:whetstone_strip');
      if (want.ink) kinds.push('custom:remnant_ink');
      const got = rec.passives.map((p) => (p.kind === 'grantAbility' ? `grantAbility:${p.abilityId}` : p.kind === 'custom' ? `custom:${p.scriptId}` : p.kind));
      expect([rec.id, got.sort()]).toEqual([rec.id, kinds.sort()]);
      const custom = (scriptId: string) => rec.passives.find((p) => p.kind === 'custom' && p.scriptId === scriptId);
      if (want.cleanse !== undefined && want.cleanse !== 'all') expect(custom('cleanse')).toMatchObject({ params: { statuses: want.cleanse.statuses } });
      if (want.whetstone) expect(custom('whetstone_strip')).toMatchObject({ params: want.whetstone });
      if (want.ink) expect(custom('remnant_ink')).toMatchObject({ params: want.ink });
      if (want.oilWard) expect(custom('lantern_oil_ward')).toMatchObject({ params: { preventsStatusOnAmbush: want.oilWard.status } });
    }
  });

  test('item abilities: seven, each owned by its item and carried by its `grantAbility`; flat damage, the row\'s status, chance and duration', () => {
    const granting = CONS.filter((r) => useOf(r).ability !== undefined);
    expect(granting.map(idOf)).toEqual([
      'item_ward_salts',
      'item_ember_flask',
      'item_storm_jar',
      'item_lantern_oil',
      'item_fenlight_salve',
      'item_barrow_light_vial',
      'item_stillwater_phial',
    ]);
    // the abilities table holds `itm_echo_bolt` (the Amulet's, D-047) and exactly these seven
    expect(Object.keys(pack.abilities).filter((id) => id.startsWith('itm_')).sort()).toEqual(['itm_echo_bolt', ...granting.map((r) => `itm_${slug(idOf(r))}`)].sort());
    for (const row of granting) {
      const want = useOf(row).ability;
      const ability = pack.abilities[`itm_${slug(idOf(row))}`];
      expect([idOf(row), ability?.ownerId, ability?.target]).toEqual([idOf(row), idOf(row), want?.target]);
      expect([idOf(row), ability?.mp, ability?.cooldown]).toEqual([idOf(row), 0, 0]); // item abilities cost nothing
      if (want?.damageType !== undefined) {
        expect([idOf(row), ability?.damageType, ability?.power?.base, ability?.power?.coef]).toEqual([idOf(row), want.damageType, want.amount, 0]);
      }
      if (want?.shield !== undefined) expect([idOf(row), ability?.shield?.base, ability?.shield?.coef]).toEqual([idOf(row), want.shield, 0]);
      const statuses = (ability?.statuses ?? []).map((s) => ({ status: s.status, chance: s.chance ?? 1, duration: s.duration }));
      expect([idOf(row), statuses]).toEqual([idOf(row), want?.statuses]);
      expect([idOf(row), ability?.special]).toEqual([idOf(row), useOf(row).cleanse === 'all' ? 'cleanse' : undefined]);
    }
  });

  test('Fenlight Salve: WORLD gives Regen\'s duration (3) but no magnitude; 4 a turn (Barkskin\'s base) is U50\'s pinned guess, applied to the user', () => {
    const regen = pack.abilities.itm_fenlight_salve?.statuses[0];
    expect([regen?.status, regen?.duration, regen?.target]).toEqual(['status_regen', 3, 'self']);
    expect(regen?.power).toMatchObject({ base: 4, coef: 0 });
    expect(section(WORLD, '### 7.8 ', '### 7.9 ')).toContain('`status_regen` (3)');
  });

  test('every status a consumable names exists in the statuses table', () => {
    for (const row of CONS) for (const s of (row[3] ?? '').matchAll(/`(status_[a-z_]+)`/g)) expect([idOf(row), s[1], pack.statuses[s[1] ?? ''] !== undefined]).toEqual([idOf(row), s[1], true]);
  });
});

// ---- quest items, recipe items and tomes ------------------------------------------------------------------------------------------------

/** STORY §14.1: codex title → id. */
function codexIds(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of tableRows(section(STORY, '### 14.1 Table', '### 14.2 '))) {
    const id = unquote(c[0] ?? '');
    if (id.startsWith('codex_')) out[c[1] ?? ''] = id;
  }
  // the three people STORY §14.1 had no entry for, written by U60 (D-108)
  Object.assign(out, { 'Tobrin Vask': 'codex_tobrin_vask', 'Ilsabet Rhune': 'codex_ilsabet_rhune', 'Corvin Dreyl': 'codex_corvin_dreyl' });
  return out;
}

describe('quest items, recipe items and tomes (WORLD §7.10, §7.12, §7.13)', () => {
  const effects = (id: string): Atom[] => item(id).onUse as Atom[];

  test('the Amulet: slotless, magic +1, grants Echo Bolt (D-047); no other quest item has stats', () => {
    const amulet = item('item_amulet_of_echoes');
    const row = QUEST.find((c) => idOf(c) === 'item_amulet_of_echoes') ?? [];
    expect(row[2]).toContain('magic +1');
    expect(row[2]).toContain('grants_ability `itm_echo_bolt`');
    expect([amulet.stats.magic, amulet.slot, amulet.passives]).toEqual([1, undefined, [{ kind: 'grantAbility', abilityId: 'itm_echo_bolt' }]]);
    for (const r of [...QUEST, ...KEYS].filter((c) => idOf(c) !== 'item_amulet_of_echoes')) {
      expect([idOf(r), Object.values(item(idOf(r)).stats).filter((v) => v !== 0)]).toEqual([idOf(r), []]);
    }
  });

  test('Litany pages: read (out of combat) and grant the verse Echo named; the page is kept (WORLD "read: grants … if not held")', () => {
    for (const row of QUEST.filter((c) => /^`item_litany_page_/.test(c[0] ?? ''))) {
      const echo = /grants `(echo_litany_verse_\d+)`/.exec(row[2] ?? '')?.[1];
      expect([idOf(row), effects(idOf(row)), item(idOf(row)).usableInCombat, item(idOf(row)).consumeOnUse]).toEqual([idOf(row), [{ grantEcho: echo }], false, false]);
    }
  });

  test('the objects the world reads by being carried have no effect of their own; the three the engine has no atom for are `custom` passives', () => {
    const custom = [...QUEST, ...KEYS, ...PATTERNS, ...TOMES].filter((c) => item(idOf(c)).passives.some((p) => p.kind === 'custom')).map(idOf);
    expect(custom).toEqual(['item_keepers_copy', 'item_scouts_whistle', 'item_remnant_wax_seal', 'item_korrs_marginalia']);
    for (const row of QUEST.filter((c) => !/litany_page|amulet|keepers_copy|scouts_whistle|remnant_wax_seal/.test(idOf(c)))) {
      expect([idOf(row), item(idOf(row)).onUse, item(idOf(row)).passives]).toEqual([idOf(row), [], []]);
    }
    expect(QUEST.find((c) => idOf(c) === 'item_scouts_whistle')?.[2]).toContain('call Brak');
    expect(item('item_remnant_wax_seal').passives[0]).toMatchObject({ kind: 'custom', scriptId: 'remnant_wax_seal', params: { faction: 'remnants', stockOnly: true, merchants: ['npc_tamsin_reed', 'npc_sedge_marrow'] } });
  });

  test('keys do nothing themselves: exits and events test `{ item: … }`', () => {
    for (const row of KEYS) expect([idOf(row), item(idOf(row)).onUse, item(idOf(row)).passives]).toEqual([idOf(row), [], []]);
  });

  test('recipe items: a pattern unlocks the recipe the document names, one for each; a schematic half grants its persistent Echo (D-067.6)', () => {
    for (const row of PATTERNS) {
      const id = idOf(row);
      const rec = item(id);
      expect([id, rec.usableInCombat]).toEqual([id, false]);
      if (/_schematic_[ab]$/.test(id)) {
        const echo = /grants the persistent `(echo_anchor_half_[ab])`/.exec(row[2] ?? '')?.[1];
        expect([id, rec.onUse]).toEqual([id, [{ grantEcho: echo }]]);
      } else {
        expect([id, rec.onUse]).toEqual([id, [{ unlockRecipe: unquote(row[2] ?? '') }]]);
        expect([id, unquote(row[2] ?? '').startsWith('recipe_'), unquote(row[1] ?? '')]).toEqual([id, true, row[1] ?? '']);
        expect(gold(row[3])).toBe(90);
      }
    }
  });

  test('the Dark Spellbook costs 15 HP and adds 1 Corruption (DESIGN §6.7); the Warder Plate grants its Echo once the quest is complete', () => {
    const book = TOMES.find((c) => idOf(c) === 'item_dark_spellbook')?.[2] ?? '';
    expect(book).toContain('−15 HP (current); +1 Corruption');
    expect(effects('item_dark_spellbook')).toEqual([{ damage: { hp: 15 } }, { corruption: 1 }]);
    const plate = TOMES.find((c) => idOf(c) === 'item_warder_plate')?.[2] ?? '';
    expect(plate).toContain('grants `echo_stone_hide_origin`');
    expect(plate).toContain('needs `q_blighted_outpost` complete');
    expect(effects('item_warder_plate')).toEqual([{ grantEcho: 'echo_stone_hide_origin' }]);
    expect(item('item_warder_plate').requirements).toEqual({ when: { quest: { id: 'q_blighted_outpost', status: 'completed' } } });
  });

  test('codex tomes: read out of combat, unlock the STORY §14.1 entry titled with the person WORLD names; a person STORY has no entry for unlocks nothing and says so', () => {
    const codex = codexIds();
    const named = TOMES.filter((c) => /^codex \(/.test(c[2] ?? ''));
    expect(named.map(idOf)).toEqual([
      'item_korrs_marginalia',
      'item_tobrins_warding_primer',
      'item_oriels_ledger',
      'item_rhunes_hydromancy',
      'item_dreyls_pyre_ledger',
      'item_auldes_spire_notes',
    ]);
    const unlocked: string[] = [];
    for (const row of named) {
      const person = /^codex \(([^)]+)\)/.exec(row[2] ?? '')?.[1] ?? '';
      const rec = item(idOf(row));
      expect([rec.id, rec.usableInCombat, rec.consumeOnUse]).toEqual([rec.id, false, true]);
      if (codex[person] !== undefined) {
        unlocked.push(rec.id);
        expect([rec.id, rec.onUse]).toEqual([rec.id, [{ unlockCodex: codex[person] }]]);
        expect([rec.id, rec.notes]).toEqual([rec.id, undefined]);
      } else {
        expect([rec.id, rec.onUse, rec.notes?.includes('STORY §14.1')]).toEqual([rec.id, [], true]);
      }
    }
    // every codex tome now unlocks its person (U60 wrote Vask, Rhune and Dreyl, D-108)
    expect(named.map(idOf).filter((id) => !unlocked.includes(id))).toEqual([]);
  });

  test('Korr\'s Marginalia counts as a Dark Spellbook toward `echo_litany_verse_2` at no cost (a `custom` passive the engine does not read yet)', () => {
    expect(TOMES.find((c) => idOf(c) === 'item_korrs_marginalia')?.[2]).toContain('counts as one Dark Spellbook toward `echo_litany_verse_2`, with no HP or Corruption cost');
    expect(item('item_korrs_marginalia').passives).toEqual([{ kind: 'custom', scriptId: 'counts_as_spellbook', params: { toward: 'echo_litany_verse_2', hpCost: 0, corruption: 0 } }]);
  });
});

// ---- materials -------------------------------------------------------------------------------------------------------------------------

describe('materials (WORLD §8.1)', () => {
  test('25 records: 23 `mat_` and the two legacy shards that kept their `item_` ids (D-044)', () => {
    expect(materials.filter((m) => m.id.startsWith('mat_'))).toHaveLength(23);
    expect(materials.filter((m) => m.id.startsWith('item_')).map((m) => m.id)).toEqual(['item_void_shard', 'item_aetherium_shard']);
    for (const m of materials) expect([m.id, item(m.id).type, item(m.id).upgradeable, item(m.id).rarityRule]).toEqual([m.id, 'material', false, 'fixed']);
  });

  test('the four regional materials marked **W** are in the table', () => {
    const w = tableRows(section(WORLD, '### 8.1 ', '### 8.2 ')).filter((c) => /\*\*W\*\*/.test(c[0] ?? '')).map(idOf);
    expect(w).toEqual(['mat_bell_bronze', 'mat_cinder_horn', 'mat_storm_glass', 'mat_umbral_thread']);
    for (const id of w) expect(item(id).type).toBe('material');
  });

  test('the two legacy shards carry the Python description, character for character; the others are U50\'s words', () => {
    for (const row of MATS.filter((c) => /legacy desc:/.test(c[6] ?? ''))) {
      const desc = /legacy desc: "([^"]+)"/.exec(row[6] ?? '')?.[1];
      expect([idOf(row), item(idOf(row)).description]).toEqual([idOf(row), desc]);
    }
    expect(MATS.filter((c) => /legacy desc:/.test(c[6] ?? '')).map(idOf)).toEqual(['item_void_shard', 'item_aetherium_shard']);
  });
});

// ---- the Python source --------------------------------------------------------------------------------------------------------------------

/** The `"Name": { … }` block of ITEM_DEFS (balanced braces). */
function pyBlock(name: string): string {
  const dictStart = DATA.indexOf('ITEM_DEFS = {');
  const start = DATA.indexOf(`\n    "${name}": {`, dictStart);
  if (start < 0) throw new Error(`no entry ${name} in ITEM_DEFS`);
  let depth = 0;
  for (let i = DATA.indexOf('{', start); i < DATA.length; i++) {
    if (DATA[i] === '{') depth++;
    else if (DATA[i] === '}' && --depth === 0) return DATA.slice(start, i + 1);
  }
  throw new Error(`unbalanced entry ${name}`);
}
/** A Python string value, adjacent fragments joined. */
function pyString(block: string, key: string): string {
  const m = new RegExp(`"${key}":\\s*\\(?\\s*((?:"(?:[^"\\\\]|\\\\.)*"\\s*)+)\\)?`).exec(block);
  if (!m) throw new Error(`no string ${key}`);
  return [...(m[1] ?? '').matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((f) => (f[1] ?? '').replace(/\\"/g, '"')).join('');
}
const pyNumber = (block: string, key: string): number | undefined => {
  const m = new RegExp(`"${key}":\\s*(-?\\d+)`).exec(block);
  return m ? Number(m[1]) : undefined;
};

describe('legacy items (legacy/aethelgard_data.py ITEM_DEFS)', () => {
  const legacy = ALL_RECORDS.filter((r) => LEGACY_ITEMS[r.id] !== undefined);

  test('description character for character and gold value of all ten', () => {
    expect(legacy).toHaveLength(10);
    for (const r of legacy) {
      const block = pyBlock(LEGACY_ITEMS[r.id] ?? '');
      expect([r.id, item(r.id).description]).toEqual([r.id, pyString(block, 'description')]);
      expect([r.id, item(r.id).value]).toEqual([r.id, pyNumber(block, 'gold_value')]);
    }
  });

  test('the numbers that carried over: health and mana are the heal, the Spellbook\'s −15 health is the HP it costs, the Amulet\'s magic is its stat', () => {
    for (const r of legacy) {
      const block = pyBlock(LEGACY_ITEMS[r.id] ?? '');
      const rec = item(r.id);
      const health = pyNumber(block, 'health');
      const mana = pyNumber(block, 'mana');
      const magic = pyNumber(block, 'magic');
      if (rec.type === 'consumable') {
        expect([r.id, rec.onUse[0]]).toEqual([r.id, { heal: { ...(health === undefined ? {} : { hp: health }), ...(mana === undefined ? {} : { mp: mana }) } }]);
      }
      if (r.id === 'item_dark_spellbook') expect([health, rec.onUse[0]]).toEqual([-15, { damage: { hp: 15 } }]);
      if (magic !== undefined) expect([r.id, rec.stats.magic]).toEqual([r.id, magic]);
      // the type: the Python source's quest items stay quest items, but the two shards became materials (DESIGN §8.2)
      const kind = pyString(block, 'item_type');
      const want = kind === 'quest_item' ? (rec.type === 'material' ? 'material' : 'quest') : kind === 'consumable' && r.id === 'item_dark_spellbook' ? 'tome' : kind;
      expect([r.id, rec.type]).toEqual([r.id, want]);
    }
  });

  test('validator rule 22: all 26 legacy names are items now, and the validator no longer counts any missing', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    // (the six legacy quests are the quest unit's: pending)
    expect(report.warnings.filter((w) => w.rule === 'rule-22' && w.table === 'items')).toEqual([]);
    for (const id of Object.keys(LEGACY_ITEMS)) expect([id, pack.items[id]?.name]).toEqual([id, LEGACY_ITEMS[id]]);
    expect(Object.keys(LEGACY_ITEMS)).toHaveLength(26);
  });
});

// ---- sources --------------------------------------------------------------------------------------------------------------------------------

const SOURCE_KIND: Record<string, string> = { cr_: 'drop:', npc_: 'merchant:', recipe_: 'craft:', q_: 'quest:', loc_: 'loc:' };
const asSource = (id: string): string => `${SOURCE_KIND[Object.keys(SOURCE_KIND).find((p) => id.startsWith(p)) ?? ''] ?? '?:'}${id}`;

/** WORLD §9.2: every item (and material) each merchant's Core, Pool, Trusted and Sworn rows name, by item id. Kaelen's "except" list is what he never stocks. */
function merchantStock(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  let current = '';
  for (const line of section(WORLD, '### 9.2 Stock', '### 9.3 ').split('\n')) {
    const head = /^\*\*`(npc_[a-z_]+)`/.exec(line);
    if (head) current = head[1] ?? '';
    const first = line.startsWith('|') ? line.split('|')[1]?.trim() : undefined;
    if (current === '' || !['Core', 'Pool', 'Trusted', 'Sworn'].includes(first ?? '')) continue;
    for (const id of [...ids(line.replace(/\*\*except\*\*[^:]*\(legacy exclusion\):/, ''), 'item'), ...ids(line, 'mat')]) (out[id] ??= new Set()).add(current);
  }
  return out;
}

/** WORLD §3: the item and material ids each location block's Items line names (an item needed to get another — "requires `item_…`" — is not placed there). */
function placements(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const part of section(WORLD, '## 3. Locations', '## 4. Non-companion NPCs').split(/\n(?=#### `loc_)/)) {
    const head = /^#### `(loc_[a-z0-9_]+)`/.exec(part);
    const line = /\*\*Items:\*\*([^\n]*)/.exec(part)?.[1];
    if (!head || line === undefined) continue;
    let text = ['**Encounters:**', '**NPCs:**', '**Anchors**'].reduce((t, cut) => (t.includes(cut) ? t.slice(0, t.indexOf(cut)) : t), line);
    text = text.replace(/(?:requires|without|with)\s+`(?:item|mat)_[a-z0-9_]+`/g, '');
    for (const id of [...ids(text, 'item'), ...ids(text, 'mat')]) (out[id] ??= new Set()).add(head[1] ?? '');
  }
  return out;
}

/** WORLD §6: the creatures whose Loot line names an item or material. */
function creatureDrops(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const part of section(WORLD, '## 6. Creatures', '## 7. Items').split(/\n(?=#### `cr_)/)) {
    const head = /^#### `(cr_[a-z0-9_]+)`/.exec(part);
    const start = part.indexOf('- **Loot');
    if (!head || start < 0) continue;
    const rest = part.slice(start);
    const end = rest.indexOf('\n- **', 1);
    for (const id of [...ids(end < 0 ? rest : rest.slice(0, end), 'item'), ...ids(end < 0 ? rest : rest.slice(0, end), 'mat')]) (out[id] ??= new Set()).add(head[1] ?? '');
  }
  return out;
}

/** Where WORLD names the source only in prose: the quest, the place. */
const PROSE_SOURCES: Record<string, string[]> = {
  // "`npc_kaelen_stonehand` (outcome A)": Kaelen is a merchant, but not of this item — the quest moves it
  item_fathers_whetstone: ['quest:q_blood_and_salt'],
  // "`npc_borin_stonefist` gives it with `echo_hallows_ember`": Borin's "Free" row is no stock; he stands in the Emberforge
  item_pattern_hallows_hammer: ['loc:loc_emberforge'],
  // "`npc_sethe_unlidded` free at Weavers Trusted": Sethe is no merchant; she stands in the Sanctum
  item_veil_sigil: ['loc:loc_sanctum_of_threads'],
  // the Grave's first clear is the Ashmaw fight, and the Steppe unit (regions/ashen_steppe/creatures.ts) pays the ledger from the boss too
  item_dreyls_pyre_ledger: ['drop:cr_ashmaw'],
};

describe('sources', () => {
  const stock = merchantStock();
  const placed = placements();
  const drops = creatureDrops();
  const rows = TABLES.flatMap((t) => t.rows.map((r) => ({ row: r, cell: r[t.col.sources] ?? '' })));

  test('every source is well-formed and listed once; every record has at least one', () => {
    for (const r of ALL_RECORDS) {
      const rec = item(r.id);
      expect([r.id, rec.sources.length > 0]).toEqual([r.id, true]);
      for (const s of rec.sources) expect([r.id, s, ITEM_SOURCE_RE.test(s)]).toEqual([r.id, s, true]);
      expect([r.id, new Set(rec.sources).size]).toEqual([r.id, rec.sources.length]);
    }
  });

  test('each item\'s sources are WORLD\'s Sources column, the §9.2 merchants that stock it, the §6 creatures that drop it and the §3 locations that hold it', () => {
    for (const { row, cell } of rows) {
      const id = idOf(row);
      const want = new Set<string>();
      for (const m of cell.matchAll(/`((?:cr|npc|recipe|q|loc)_[a-z0-9_]+)`/g)) {
        const target = m[1] ?? '';
        // a creature, recipe, quest or place the column names is a source; an NPC only if she sells it (the others give it where they stand)
        if (!target.startsWith('npc_') || stock[id]?.has(target)) want.add(asSource(target));
      }
      for (const npc of stock[id] ?? []) want.add(asSource(npc));
      for (const cr of drops[id] ?? []) want.add(asSource(cr));
      for (const loc of placed[id] ?? []) want.add(asSource(loc));
      for (const extra of PROSE_SOURCES[id] ?? []) want.add(extra);
      expect([id, [...item(id).sources].sort()]).toEqual([id, [...want].sort()]);
    }
  });

  test('what the authored creatures and locations already drop or hold is a source of that item', () => {
    const mine = new Set(ALL_RECORDS.map((r) => r.id));
    for (const c of Object.values(pack.creatures)) {
      for (const l of c.loot) if (mine.has(l.itemId)) expect([l.itemId, c.id, item(l.itemId).sources.includes(`drop:${c.id}`)]).toEqual([l.itemId, c.id, true]);
    }
    for (const loc of Object.values(pack.locations)) {
      for (const it of loc.items) if (mine.has(it.itemId)) expect([it.itemId, loc.id, item(it.itemId).sources.includes(`loc:${loc.id}`)]).toEqual([it.itemId, loc.id, true]);
    }
  });

  test('locations, recipes and merchants are complete, so every `loc:`, `craft:` and `merchant:` source resolves; creatures and quests are pending', () => {
    for (const r of ALL_RECORDS) {
      for (const s of item(r.id).sources) {
        if (s.startsWith('loc:')) expect([s, pack.locations[s.slice(4)] !== undefined]).toEqual([s, true]);
        if (s.startsWith('craft:')) expect([s, pack.recipes[s.slice(6)] !== undefined]).toEqual([s, true]);
        if (s.startsWith('merchant:') && stock[r.id]) expect([r.id, s, pack.merchants[s.slice(9)] !== undefined]).toEqual([r.id, s, true]);
      }
    }
    for (const done of ['items', 'recipes', 'merchants', 'locations', 'regions'] as const) expect(INCOMPLETE_TABLES).not.toContain(done);
  });
});


// ---- the consumables in the real engine ------------------------------------------------------------------------------------------------------

describe('the consumables in the engine (real pack)', () => {
  const profile = freshProfile();
  /** A wounded, drained Wayfinder carrying one of `itemId`. */
  const holding = (itemId: string): { s: GameState; uid: string } => {
    const s = makeState({ hp: 1, mp: 0, items: [itemId] }, { content: pack, profile });
    return { s, uid: s.player.inventory.find((i) => i.itemId === itemId)?.uid ?? '' };
  };
  const rejected = (events: readonly { t: string }[]): boolean => events.some((e) => e.t === 'actionRejected');
  /** How many of `itemId` the Wayfinder carries (a class kit may already hold some). */
  const held = (s: GameState, itemId: string): number => s.player.inventory.filter((i) => i.itemId === itemId).reduce((n, i) => n + i.qty, 0);

  test('out of combat each consumable that heals restores exactly WORLD\'s HP and MP (up to the maxima) and is spent; a throwable cannot be used there', () => {
    for (const row of CONS) {
      const want = useOf(row);
      const { s, uid } = holding(idOf(row));
      const out = step(s, { type: 'use', uid }, pack, profile);
      const throwOnly = item(idOf(row)).usableOutOfCombat === false;
      expect([idOf(row), rejected(out.events)]).toEqual([idOf(row), throwOnly]);
      if (throwOnly) {
        expect([idOf(row), held(out.state, idOf(row))]).toEqual([idOf(row), held(s, idOf(row))]);
        continue;
      }
      const max = derive(s.player, pack);
      expect([idOf(row), out.state.player.hp, out.state.player.mp]).toEqual([idOf(row), Math.min(max.hpMax, 1 + (want.heal.hp ?? 0)), Math.min(max.mpMax, want.heal.mp ?? 0)]);
      expect([idOf(row), held(out.state, idOf(row))]).toEqual([idOf(row), held(s, idOf(row)) - 1]);
    }
  });

  test('a stack of ten fits in the pack as one stack; the eleventh starts another (DESIGN §7.8)', () => {
    const s = makeState({ items: [{ itemId: 'item_glow_moss', qty: 10 }, { itemId: 'item_glow_moss', qty: 3 }] }, { content: pack, profile });
    expect(s.player.inventory.filter((i) => i.itemId === 'item_glow_moss').map((i) => i.qty)).toEqual([10, 3]);
  });

  test('the Dark Spellbook, read, costs 15 HP and adds 1 Corruption (DESIGN §6.7)', () => {
    const s = makeState({ hp: 40, items: ['item_dark_spellbook'] }, { content: pack, profile });
    const uid = s.player.inventory.find((i) => i.itemId === 'item_dark_spellbook')?.uid ?? '';
    const out = step(s, { type: 'readBook', uid }, pack, profile);
    expect(rejected(out.events)).toBe(false);
    expect([out.state.player.hp, out.state.player.corruption]).toEqual([25, 1]);
    expect(held(out.state, 'item_dark_spellbook')).toBe(held(s, 'item_dark_spellbook') - 1);
  });

  test('the item abilities resolve through the pack: each granting item names an ability that exists and an owner that is the item', () => {
    for (const row of CONS.filter((r) => useOf(r).ability !== undefined)) {
      const grant = item(idOf(row)).passives.find((p) => p.kind === 'grantAbility');
      expect([idOf(row), grant !== undefined && pack.abilities[grant.abilityId]?.ownerId === idOf(row)]).toEqual([idOf(row), true]);
    }
  });
});

// ---- the pack -----------------------------------------------------------------------------------------------------------------------------------

describe('the pack with the item tables in it', () => {
  test('builds and validates with no errors; every remaining warning is a pending reference or a region unit\'s (rule 02 flags, rule 11 levels)', () => {
    const { report } = parseContentPack(contentTables);
    expect(report.errors).toEqual([]);
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(strict.errors).toEqual([]);
    const real = strict.warnings.filter((w) => !w.message.startsWith('pending — content not yet authored'));
    expect(real.every((w) => w.rule === 'rule-02' || w.rule === 'rule-11')).toBe(true);
    // the item rules: 12 (shape), 20 (stock sells), 21 (counts) and 22 (legacy names) have nothing to say
    expect(strict.warnings.filter((w) => w.table === 'items' && ['rule-12', 'rule-20', 'rule-21', 'rule-22'].includes(w.rule))).toEqual([]);
  });

  test('no reference into items, recipes or merchants is pending any more; every item id a region, creature, recipe or merchant names exists', () => {
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(strict.warnings.filter((w) => / not found in (items|recipes|merchants)$/.test(w.message))).toEqual([]);
  });

  test('the item abilities count is rule 21\'s: Echo Bolt and the seven consumable abilities', () => {
    expect(Object.values(pack.abilities).filter((a) => a.id.startsWith('itm_'))).toHaveLength(8);
  });
});
