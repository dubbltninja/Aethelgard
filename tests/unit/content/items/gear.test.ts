// U49: the 70 weapons, armor pieces and trinkets (src/content/items/{weapons,armor,trinkets}.ts) checked against the documents at
// test time: WORLD §7.1–7.7 (every row: name, type, tier, rarity rule, effects, value, sources, description), the WORLD tier
// table before §7.1, §9.2 (merchant stock), §6 and §3 (loot and placements); DESIGN §7.7 (the legacy items' new ids and numbers,
// "those numbers are law"); and the Python source for every legacy item (name, description, numbers, gold, `major`). The
// effects column is read by a small interpreter of WORLD's field vocabulary (conventions before §7.1); a clause it does not know
// fails the test, so an edit to WORLD or to the content cannot slip through.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables, parseContentPack } from '@content/index';
import { armor } from '@content/items/armor';
import { trinkets } from '@content/items/trinkets';
import { weapons } from '@content/items/weapons';
import { INCOMPLETE_TABLES } from '@content/progress';
import { LEGACY_ITEMS, validateContent } from '@content/validate';
import { CURSE_ON_HIT_TURNS, derive, newRun, type PlayerState } from '@engine/index';
import { ITEM_SOURCE_RE, ItemSchema, type Item, type Passive } from '@schema/item';
import { freshProfile } from '@tests/fixtures/helpers';
import { WORLD, ids, section, tableRows, unquote } from '../regions/worldDoc';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const DATA = fs.readFileSync(path.join(ROOT, 'legacy/aethelgard_data.py'), 'utf8');
const pack = buildContentPack();

/** The authored records (input shape) and the parsed ones the pack holds (defaults applied). */
const GEAR_INPUT = [...weapons, ...armor, ...trinkets];
const GEAR_IDS: string[] = GEAR_INPUT.map((i) => i.id);
const gear = (id: string): Item => {
  const item = pack.items[id];
  if (!item) throw new Error(`no item ${id}`);
  return item;
};
const GEAR = GEAR_IDS.map(gear);

// ---- WORLD §7.1–7.7 -------------------------------------------------------------------------------------------------------------

type WeaponType = 'melee' | 'ranged_bow' | 'magic_staff' | 'shield_heavy' | 'void_focus';
interface WorldRow {
  id: string;
  name: string;
  kind: 'weapon' | 'armor' | 'trinket';
  weaponType?: WeaponType;
  weight?: string;
  tierCell: string;
  rarity: string;
  effects: string;
  gold: number;
  sources: string;
  description: string;
  legacy: boolean;
}

function rowsOf(from: string, to: string, kind: WorldRow['kind'], weaponType?: WeaponType): WorldRow[] {
  return tableRows(section(WORLD, from, to))
    .filter((c) => /^`item_/.test(c[0] ?? ''))
    .map((c) => {
      // weapons and trinkets: id | name | tier | rarity | effects | g | sources | description; armor adds Weight after the name
      const o = kind === 'armor' ? 3 : 2;
      const desc = c[o + 5] ?? '';
      const row: WorldRow = {
        id: unquote(c[0] ?? ''),
        name: c[1] ?? '',
        kind,
        tierCell: c[o] ?? '',
        rarity: c[o + 1] ?? '',
        effects: c[o + 2] ?? '',
        gold: Number(c[o + 3]),
        sources: c[o + 4] ?? '',
        description: desc.replace(/\s*\*\(legacy:.*\)\*\s*$/, '').trim(),
        legacy: /\*\(legacy:/.test(desc),
      };
      if (weaponType) row.weaponType = weaponType;
      if (kind === 'armor') row.weight = c[2] ?? '';
      return row;
    });
}

const ROWS: WorldRow[] = [
  ...rowsOf('### 7.1 ', '### 7.2 ', 'weapon', 'melee'),
  ...rowsOf('### 7.2 ', '### 7.3 ', 'weapon', 'ranged_bow'),
  ...rowsOf('### 7.3 ', '### 7.4 ', 'weapon', 'magic_staff'),
  ...rowsOf('### 7.4 ', '### 7.5 ', 'weapon', 'shield_heavy'),
  ...rowsOf('### 7.5 ', '### 7.6 ', 'weapon', 'void_focus'),
  ...rowsOf('### 7.6 ', '### 7.7 ', 'armor'),
  ...rowsOf('### 7.7 ', '### 7.8 ', 'trinket'),
];
const num = (s: string): number => Number(s.replace('−', '-').replace('+', ''));
const asStatus = (s: string | undefined): `status_${string}` => (s ?? '') as `status_${string}`;

// ---- the effects interpreter ----------------------------------------------------------------------------------------------------

interface Expected {
  stats: Record<string, number>;
  passives: Passive[];
  resist: string[];
  tags: string[];
  anchorable: boolean;
}

const STAT_FIELD: Record<string, string> = {
  power: 'power',
  spell_power: 'spellPower',
  armor: 'armor',
  ward: 'ward',
  accuracy: 'accuracy',
  crit: 'crit',
  agility: 'agility',
  initiative: 'initiative',
  strength: 'strength',
  magic: 'magic',
  evasion: 'evasion',
};

/** The cell's `;`-separated clauses; a `;` inside parentheses is part of its clause ("(as `att_foresight`; does not stack with it)"). */
function splitClauses(cell: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  [...cell].forEach((ch, i) => {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) {
      out.push(cell.slice(start, i).trim());
      start = i + 1;
    }
  });
  out.push(cell.slice(start).trim());
  return out;
}

/** WORLD's "Stats and effects" cell as the item record should say it (conventions before §7.1; D-087). */
function expectedOf(r: WorldRow): Expected {
  const out: Expected = { stats: {}, passives: [], resist: [], tags: [], anchorable: false };
  const clauses = splitClauses(r.effects);
  const selfCost = clauses.map((c) => /^self_cost_hp (\d+) per hit$/.exec(c)).find((m) => m !== null && m !== undefined);
  for (const clause of clauses) {
    let m: RegExpExecArray | null;
    if ((m = /^(power|spell_power|armor|ward|accuracy|crit|agility|initiative|strength|magic|evasion) ([+−-]?\d+)$/.exec(clause))) {
      out.stats[STAT_FIELD[m[1] ?? ''] ?? ''] = num(m[2] ?? '');
    } else if ((m = /^max_hp ([+−-]\d+)$/.exec(clause))) out.stats.hpMax = num(m[1] ?? '');
    else if ((m = /^max_hp \+(\d+)%$/.exec(clause))) out.stats.hpMaxPct = Number(m[1]) / 100;
    else if ((m = /^max_mp \+(\d+)$/.exec(clause))) out.stats.mpMax = Number(m[1]);
    else if ((m = /^mp_regen \+(\d+)$/.exec(clause))) out.passives.push({ kind: 'regen', hp: 0, mp: Number(m[1]) });
    else if ((m = /^mp_cost_reduction (\d+)$/.exec(clause))) out.passives.push({ kind: 'mpCostReduction', pct: Number(m[1]) / 100 });
    else if ((m = /^life_steal (\d+)$/.exec(clause))) out.passives.push({ kind: 'lifeSteal', pct: Number(m[1]) / 100 });
    else if ((m = /^on_hit `(status_[a-z_]+)` (\d+)% \((\d+)\)$/.exec(clause))) {
      const [status, chance, duration] = [asStatus(m[1]), Number(m[2]) / 100, Number(m[3])];
      // the dagger's "self_cost_hp 2 per hit" is the `curse` passive's `damage` (D-087), and its Curse lasts the engine's 3 turns
      if (selfCost?.[1] !== undefined) {
        expect([status, duration]).toEqual(['status_curse', CURSE_ON_HIT_TURNS]);
        out.passives.push({ kind: 'curse', chance, damage: Number(selfCost[1]) });
      } else out.passives.push({ kind: 'statusOnHit', status, chance, duration });
    } else if ((m = /^resist `([a-z]+)`$/.exec(clause))) out.resist.push(m[1] ?? '');
    else if ((m = /^dmg_bonus `([a-z]+)` \+(\d+)%$/.exec(clause))) out.passives.push({ kind: 'damageBonus', damageType: m[1] as 'ley', pct: Number(m[2]) / 100 });
    else if ((m = /^Guard reduces (\d+)%$/.exec(clause))) out.passives.push({ kind: 'guardValue', pct: Number(m[1]) / 100 });
    else if ((m = /^basic attacks add (\d+)% as `([a-z]+)`$/.exec(clause))) {
      out.passives.push({ kind: 'custom', scriptId: 'basic_attack_rider', params: { damageType: m[2], pct: Number(m[1]) / 100 } });
    } else if ((m = /^heavy Stun chance (\d+)% \(base 10%\)$/.exec(clause))) {
      out.passives.push({ kind: 'custom', scriptId: 'basic_stun_chance', params: { chance: Number(m[1]) / 100 } });
    } else if ((m = /^immune `(status_[a-z_]+)`$/.exec(clause)) || (m = /^immune `(status_[a-z_]+)` on the first turn of an ambush \(/.exec(clause))) {
      out.passives.push({ kind: 'statusImmunity', status: asStatus(m[1]) });
    } else if ((m = /^`(status_[a-z_]+)` lasts (\d+) turn less$/.exec(clause))) {
      out.passives.push({ kind: 'custom', scriptId: 'status_duration_reduction', params: { statuses: [m[1]], turns: Number(m[2]) } });
    } else if ((m = /^`(status_[a-z_]+)` and `(status_[a-z_]+)` last (\d+) turn less$/.exec(clause))) {
      out.passives.push({ kind: 'custom', scriptId: 'status_duration_reduction', params: { statuses: [m[1], m[2]], turns: Number(m[3]) } });
    } else if ((m = /^immune to the ([A-Za-z]+) hazard \(WORLD §2\.9\)$/.exec(clause))) {
      out.passives.push({ kind: 'custom', scriptId: 'hazard_immunity', params: { hazard: (m[1] ?? '').toLowerCase() } });
    } else if (/^enemy intents shown one turn early \(as `att_foresight`; does not stack with it\)$/.test(clause)) {
      out.passives.push({ kind: 'custom', scriptId: 'foresight', params: {} });
    } else if ((m = /^first time each fight HP drops below (\d+)%: `(status_[a-z_]+)` \((\d+)\)$/.exec(clause))) {
      out.passives.push({ kind: 'custom', scriptId: 'low_hp_status', params: { below: Number(m[1]) / 100, status: m[2], duration: Number(m[3]), oncePerFight: true } });
    } else if ((m = /^([A-Z][a-z]+) abilities mp_cost_reduction (\d+)$/.exec(clause))) {
      out.passives.push({ kind: 'custom', scriptId: 'ability_mp_cost_reduction', params: { damageType: (m[1] ?? '').toLowerCase(), pct: Number(m[2]) / 100 } });
    } else if (/^tag `key`: /.test(clause)) out.tags.push('key');
    else if (/^tag \*\*`anchorable`\*\*/.test(clause)) out.anchorable = true;
    else if (/^self_cost_hp \d+ per hit$/.test(clause) || clause === 'no self-cost') continue; // read with the on_hit above / nothing to carry
    else throw new Error(`${r.id}: effects clause not understood: ${JSON.stringify(clause)}`);
  }
  return out;
}

/** Key-sorted JSON, so passives compare regardless of key order. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => `${JSON.stringify(k)}:${canon(x)}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}
const sortedCanon = (list: readonly unknown[]): string[] => list.map(canon).sort();

/** The non-zero stats of a record, plus `ward: 0`-style explicit zeros dropped. */
const nonZero = (stats: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(stats).filter(([, v]) => v !== 0));

// ---- counts, ids and the record shape --------------------------------------------------------------------------------------------

describe('the gear tables (items/weapons.ts, armor.ts, trinkets.ts) against WORLD §7.1–7.7', () => {
  test('counts: 32 weapons (8 melee, 6 each of the other four types), 18 armor, 20 trinkets; every WORLD row is a record and no record is extra', () => {
    expect(weapons).toHaveLength(32);
    expect(armor).toHaveLength(18);
    expect(trinkets).toHaveLength(20);
    const count = (t: WeaponType) => Object.values(pack.items).filter((i) => i.weaponType === t).length;
    expect([count('melee'), count('ranged_bow'), count('magic_staff'), count('shield_heavy'), count('void_focus')]).toEqual([8, 6, 6, 6, 6]);
    expect(ROWS.filter((r) => r.kind === 'weapon')).toHaveLength(32);
    expect(ROWS.filter((r) => r.kind === 'armor')).toHaveLength(18);
    expect(ROWS.filter((r) => r.kind === 'trinket')).toHaveLength(20);
    expect(weapons.map((i) => i.id)).toEqual(ROWS.filter((r) => r.kind === 'weapon').map((r) => r.id));
    expect(armor.map((i) => i.id)).toEqual(ROWS.filter((r) => r.kind === 'armor').map((r) => r.id));
    expect(trinkets.map((i) => i.id)).toEqual(ROWS.filter((r) => r.kind === 'trinket').map((r) => r.id));
    expect(new Set(GEAR_IDS).size).toBe(70);
  });

  test('registered once each in contentTables, first (U50 deleted starter.ts and amulet.ts and registered its own items after the gear)', () => {
    const registered = contentTables.items.map((i) => i.id);
    for (const id of GEAR_IDS) expect([id, registered.filter((x) => x === id).length]).toEqual([id, 1]);
    expect(registered.slice(0, 70)).toEqual(GEAR_IDS);
    expect(Object.keys(pack.items).filter((id) => GEAR_IDS.includes(id))).toEqual(GEAR_IDS);
  });

  test('every record parses on its own with the item schema and is gear in the right slot', () => {
    for (const rec of GEAR_INPUT) {
      const parsed = ItemSchema.safeParse(rec);
      expect([rec.id, parsed.success]).toEqual([rec.id, true]);
    }
    for (const r of ROWS) {
      const item = gear(r.id);
      expect([r.id, item.type, item.slot]).toEqual([r.id, r.kind, r.kind]);
      expect([r.id, item.weaponType]).toEqual([r.id, r.weaponType]);
      expect([r.id, item.armorClass]).toEqual([r.id, r.weight]);
    }
  });

  test('name, tier, value, description and the legacy name of every row (WORLD §7; "T1–2" is the higher tier; "—" is tier 0)', () => {
    for (const r of ROWS) {
      const item = gear(r.id);
      const tiers = [...r.tierCell.matchAll(/\d/g)].map((m) => Number(m[0]));
      const tier = r.tierCell === '—' ? 0 : Math.max(...tiers);
      expect([r.id, item.name, item.tier, item.value, item.description]).toEqual([r.id, r.name, tier, r.gold, r.description]);
      expect([r.id, item.legacyName]).toEqual([r.id, r.legacy ? r.name : undefined]);
      expect(item.description.length).toBeGreaterThan(20);
    }
  });

  test('the rarity rule of every row: roll = rolled; fixed U/R/E = that rarity with the listed affixes; craft and bound = fixed Common', () => {
    const RARITY: Record<string, string> = { U: 'uncommon', R: 'rare', E: 'epic' };
    for (const r of ROWS) {
      const item = gear(r.id);
      const fixed = /^fixed ([URE])(?: \((.*)\))?$/.exec(r.rarity);
      if (r.rarity === 'roll') expect([r.id, item.rarityRule, item.fixedAffixes]).toEqual([r.id, 'rolled', []]);
      else if (r.rarity === 'craft' || r.rarity === 'bound') expect([r.id, item.rarityRule, item.fixedRarity, item.fixedAffixes]).toEqual([r.id, 'fixed', 'common', []]);
      else if (fixed) expect([r.id, item.rarityRule, item.fixedRarity, item.fixedAffixes]).toEqual([r.id, 'fixed', RARITY[fixed[1] ?? ''], ids(fixed[2] ?? '', 'affix')]);
      else throw new Error(`${r.id}: rarity cell not understood: ${r.rarity}`);
      // every named affix exists and can roll on this slot
      for (const a of item.fixedAffixes) expect([r.id, a, pack.affixes[a]?.[item.slot as 'weapon'] !== undefined]).toEqual([r.id, a, true]);
    }
    // bound = not sellable, not droppable, not upgradeable (no rarity to tier up); nothing else is bound
    for (const r of ROWS) {
      const item = gear(r.id);
      expect([r.id, item.sellable, item.droppable, item.upgradeable]).toEqual(r.rarity === 'bound' ? [r.id, false, false, false] : [r.id, true, true, true]);
    }
    expect(ROWS.filter((r) => r.rarity === 'bound').map((r) => r.id)).toEqual(['item_stabilized_heartstone', 'item_heartstone_core']);
  });

  test('the effects of every row: stats, passives, resistance steps, tags and the Anchor flag, exactly (no extra effect, none missing)', () => {
    for (const r of ROWS) {
      const item = gear(r.id);
      const want = expectedOf(r);
      expect([r.id, nonZero(item.stats)]).toEqual([r.id, nonZero(want.stats)]);
      expect([r.id, sortedCanon(item.passives)]).toEqual([r.id, sortedCanon(want.passives)]);
      expect([r.id, [...item.resistSteps].sort()]).toEqual([r.id, [...want.resist].sort()]);
      expect([r.id, item.tags]).toEqual([r.id, want.tags]);
      expect([r.id, item.anchorable]).toEqual([r.id, want.anchorable]);
    }
  });

  test('requirements: none (any class may wield anything, WORLD conventions); placements that need a quest or a rep tier are the sources', () => {
    for (const item of GEAR) expect([item.id, item.requirements]).toEqual([item.id, undefined]);
  });

  test('art keys: one per record, `major` exactly on the legacy pieces the Python source marks major', () => {
    const major = new Set(
      [...DATA.matchAll(/^ {4}"([^"]+)": \{[\s\S]*?\n {4}\},?$/gm)]
        .filter((m) => /"major": True/.test(m[0]))
        .map((m) => m[1] ?? ''),
    );
    for (const r of ROWS) {
      const item = gear(r.id);
      expect([r.id, item.art.icon.length > 0, item.art.major]).toEqual([r.id, true, r.legacy && major.has(r.name)]);
    }
    expect(ROWS.filter((r) => gear(r.id).art.major).map((r) => r.name)).toEqual([
      'Shadow-Kissed Dagger',
      'Ironclad Mail',
      'Ironclad Plate Armor',
      'Sky-Whisper Talisman',
      'Chronos Lens',
      'Stabilized Heartstone',
      'Heartstone Core',
    ]);
  });
});

// ---- sources ----------------------------------------------------------------------------------------------------------------

const SOURCE_KIND: Record<string, string> = { cr_: 'drop:', npc_: 'merchant:', recipe_: 'craft:', q_: 'quest:', loc_: 'loc:' };
const asSource = (id: string): string => `${SOURCE_KIND[Object.keys(SOURCE_KIND).find((p) => id.startsWith(p)) ?? ''] ?? '?:'}${id}`;

/** WORLD §9.2: the gear each merchant's Core/Pool/Trusted/Sworn rows name (Kaelen's "except …" list is what he never stocks). */
function merchantGear(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  let current = '';
  for (const line of section(WORLD, '### 9.2 Stock', '### 9.3 ').split('\n')) {
    const head = /^\*\*`(npc_[a-z_]+)`/.exec(line);
    if (head) current = head[1] ?? '';
    const first = line.startsWith('|') ? line.split('|')[1]?.trim() : undefined;
    if (current === '' || !['Core', 'Pool', 'Trusted', 'Sworn'].includes(first ?? '')) continue;
    for (const id of ids(line.replace(/\*\*except\*\*[^:]*\(legacy exclusion\):/, ''), 'item')) (out[id] ??= new Set()).add(current);
  }
  return out;
}

/** WORLD §3: the item ids each location block's Items line names. */
function placements(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const part of section(WORLD, '## 3. Locations', '## 4. Non-companion NPCs').split(/\n(?=#### `loc_)/)) {
    const head = /^#### `(loc_[a-z0-9_]+)`/.exec(part);
    const line = /\*\*Items:\*\*([^\n]*)/.exec(part)?.[1];
    if (!head || line === undefined) continue;
    const text = ['**Encounters:**', '**NPCs:**', '**Anchors**'].reduce((t, cut) => (t.includes(cut) ? t.slice(0, t.indexOf(cut)) : t), line);
    for (const id of ids(text, 'item')) (out[id] ??= new Set()).add(head[1] ?? '');
  }
  return out;
}

/** WORLD §6: the creatures whose Loot line names a piece of gear. */
function creatureDrops(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const part of section(WORLD, '## 6. Creatures', '## 7. Items').split(/\n(?=#### `cr_)/)) {
    const head = /^#### `(cr_[a-z0-9_]+)`/.exec(part);
    const start = part.indexOf('- **Loot');
    if (!head || start < 0) continue;
    const rest = part.slice(start);
    const end = rest.indexOf('\n- **', 1);
    for (const id of ids(end < 0 ? rest : rest.slice(0, end), 'item')) (out[id] ??= new Set()).add(head[1] ?? '');
  }
  // the Redundant Wayfinder's "the player's class starter weapon 30%" (prose: WORLD §6): the five kit weapons
  for (const id of ['item_rusty_dagger', 'item_apprentice_staff', 'item_primitive_bow', 'item_nomads_maul', 'item_cracked_void_focus']) (out[id] ??= new Set()).add('cr_redundant_wayfinder');
  return out;
}

describe('sources', () => {
  const stock = merchantGear();
  const placed = placements();
  const drops = creatureDrops();

  test('every source is well-formed and listed once', () => {
    for (const item of GEAR) {
      expect(item.sources.length).toBeGreaterThan(0);
      for (const s of item.sources) expect([item.id, s, ITEM_SOURCE_RE.test(s)]).toEqual([item.id, s, true]);
      expect([item.id, new Set(item.sources).size]).toEqual([item.id, item.sources.length]);
    }
  });

  test('each item\'s sources are WORLD §7\'s Sources column, the §9.2 merchants that stock it, the §6 creatures that drop it and the §3 locations that hold it', () => {
    for (const r of ROWS) {
      const want = new Set<string>();
      for (const m of r.sources.matchAll(/`((?:cr|npc|recipe|q|loc)_[a-z0-9_]+)`/g)) want.add(asSource(m[1] ?? ''));
      for (const npc of stock[r.id] ?? []) want.add(asSource(npc));
      for (const cr of drops[r.id] ?? []) want.add(asSource(cr));
      for (const loc of placed[r.id] ?? []) want.add(asSource(loc));
      expect([r.id, [...gear(r.id).sources].sort()]).toEqual([r.id, [...want].sort()]);
    }
  });

  test('Kaelen never stocks the Warrior\'s Sword or the Shadow-Kissed Dagger (legacy exclusion); the dagger comes from Nyx\'s quest only', () => {
    expect(gear('item_warriors_sword').sources).not.toContain('merchant:npc_kaelen_stonehand');
    expect(gear('item_shadow_kissed_dagger').sources).toEqual(['quest:q_void_shards']);
  });

  test('what the authored creatures and locations already drop or hold is a source of that item', () => {
    for (const c of Object.values(pack.creatures)) {
      for (const l of c.loot) if (GEAR_IDS.includes(l.itemId)) expect([l.itemId, c.id, gear(l.itemId).sources.includes(`drop:${c.id}`)]).toEqual([l.itemId, c.id, true]);
    }
    for (const loc of Object.values(pack.locations)) {
      for (const it of loc.items) if (GEAR_IDS.includes(it.itemId)) expect([it.itemId, loc.id, gear(it.itemId).sources.includes(`loc:${loc.id}`)]).toEqual([it.itemId, loc.id, true]);
    }
  });

  test('locations are complete (D-090), so every `loc:` source resolves; the rest are pending until their tables land', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors).toEqual([]);
    for (const item of GEAR) for (const s of item.sources) if (s.startsWith('loc:')) expect([s, pack.locations[s.slice(4)] !== undefined]).toEqual([s, true]);
  });
});

// ---- the tier table -----------------------------------------------------------------------------------------------------------

type Range = [number, number];
const range = (cell: string): Range => {
  const parts = cell.replace(/\+/g, '').split('–').map((p) => Number(p.trim()));
  return [parts[0] ?? NaN, parts[parts.length - 1] ?? NaN];
};
const within = (v: number, [lo, hi]: Range): boolean => v >= lo && v <= hi;

interface TierRow {
  weaponPower: Range;
  focusPower: Range;
  focusSpell: Range;
  armor: Range;
  ward: Range;
  trinket: Range;
  value: Range;
}
const TIERS: TierRow[] = tableRows(section(WORLD, '#### Tiers', '#### Count'))
  .filter((c) => /^T[1-5]$/.test(c[0] ?? ''))
  .map((c) => {
    const [focusPower = '', focusSpell = ''] = (c[3] ?? '').split('/').map((x) => x.trim());
    const [armorCell = '', wardCell = ''] = (c[4] ?? '').split('/').map((x) => x.trim());
    return { weaponPower: range(c[2] ?? ''), focusPower: range(focusPower), focusSpell: range(focusSpell), armor: range(armorCell), ward: range(wardCell), trinket: range(c[5] ?? ''), value: range(c[6] ?? '') };
  });

/** Where a record leaves WORLD's tier table for its tier (the Common numbers; the table is DESIGN §7.4's, T5 from D-066 #22). */
function tierFlags(item: Item): string[] {
  const t = TIERS[item.tier - 1];
  if (!t) return item.tier === 0 ? [] : ['tier has no row'];
  const out: string[] = [];
  const check = (what: string, v: number, r: Range) => {
    if (!within(v, r)) out.push(`${what} ${v} outside ${r[0]}–${r[1]}`);
  };
  if (item.type === 'weapon') {
    const caster = item.weaponType === 'magic_staff' || item.weaponType === 'void_focus';
    check('power', item.stats.power, caster ? t.focusPower : t.weaponPower);
    if (caster) check('spell power', item.stats.spellPower, t.focusSpell);
  } else if (item.type === 'armor') {
    check('armor', item.stats.armor, t.armor);
    check('ward', item.stats.ward, t.ward);
  } else {
    const primary = Math.max(item.stats.strength, item.stats.magic, item.stats.agility);
    if (primary !== 0) check('trinket stat', primary, t.trinket); // a trinket with no MAG/STR/AGI bonus (Thread Ring, Unlidded Eye) has nothing to compare
  }
  check('value', item.value, t.value);
  return out;
}

/**
 * The balance flags: rows whose numbers are WORLD's (or DESIGN §7.7's, for the legacy pieces) and still sit outside WORLD's tier table.
 * Reported in the U49 reply, not fixed (the numbers are law); the test pins them so a new one, or a repaired one, shows.
 */
const KNOWN_FLAGS: Record<string, string[]> = {
  // T3 trinkets with a +1 primary stat (the table says +2)
  item_choir_mask: ['trinket stat 1 outside 2–2'],
  item_dasks_scout_badge: ['trinket stat 1 outside 2–2'],
  item_salt_charm: ['trinket stat 1 outside 2–2'],
  // heavy armor whose ward sits one point under its tier's row (Ironclad Plate Armor is the legacy "weak to magic", ward −2, DESIGN §7.7)
  item_cinderhorn_plate: ['ward 1 outside 2–3'],
  item_ironclad_plate_armor: ['ward -2 outside 1–2'],
  item_oathplate: ['ward 2 outside 3–4'],
  item_sunderforged_plate: ['ward 3 outside 4–5'],
  // legacy: DESIGN §7.7 keeps the Talisman at 32 g, under T2's 40–110
  item_sky_whisper_talisman: ['value 32 outside 40–110'],
};

describe('the tier table (WORLD before §7.1, DESIGN §7.4)', () => {
  test('five tiers are read from the document', () => {
    expect(TIERS).toHaveLength(5);
    expect(TIERS[0]).toEqual({ weaponPower: [4, 6], focusPower: [2, 2], focusSpell: [1, 2], armor: [2, 3], ward: [0, 1], trinket: [1, 1], value: [8, 40] });
    expect(TIERS[4]).toEqual({ weaponPower: [21, 24], focusPower: [9, 9], focusSpell: [11, 13], armor: [13, 15], ward: [4, 5], trinket: [3, 3], value: [400, 650] });
  });

  test('every rolled item (and every fixed or crafted one) sits inside the table for its tier, except the pinned balance flags', () => {
    const flagged: Record<string, string[]> = {};
    for (const item of GEAR) {
      const flags = tierFlags(item);
      if (flags.length > 0) flagged[item.id] = flags;
    }
    expect(flagged).toEqual(KNOWN_FLAGS);
  });

  test('every weapon type has gear at each of T1–T5', () => {
    for (const type of ['melee', 'ranged_bow', 'magic_staff', 'shield_heavy', 'void_focus'] as const) {
      for (const tier of [1, 2, 3, 4, 5]) {
        const have = weapons.filter((w) => w.weaponType === type && w.tier === tier);
        expect([type, tier, have.length > 0]).toEqual([type, tier, true]);
      }
    }
  });
});

// ---- legacy ----------------------------------------------------------------------------------------------------------------------

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

describe('legacy gear (DESIGN §7.7 and legacy/aethelgard_data.py ITEM_DEFS)', () => {
  const legacyGear = GEAR.filter((i) => LEGACY_ITEMS[i.id] !== undefined);

  test('sixteen legacy pieces, each carrying its Appendix A name as name and legacyName', () => {
    expect(legacyGear).toHaveLength(16);
    expect(legacyGear.map((i) => i.id).sort()).toEqual(ROWS.filter((r) => r.legacy).map((r) => r.id).sort());
    for (const item of legacyGear) expect([item.id, item.name, item.legacyName]).toEqual([item.id, LEGACY_ITEMS[item.id], LEGACY_ITEMS[item.id]]);
    for (const item of GEAR.filter((i) => LEGACY_ITEMS[i.id] === undefined)) expect([item.id, item.legacyName]).toEqual([item.id, undefined]);
  });

  test('the Python source: description character for character, gold value, and the numbers that carried over', () => {
    for (const item of legacyGear) {
      const block = pyBlock(item.name);
      expect([item.id, item.description]).toEqual([item.id, pyString(block, 'description')]);
      expect([item.id, item.value]).toEqual([item.id, pyNumber(block, 'gold_value')]);
      const kind = pyString(block, 'item_type');
      expect([item.id, kind === 'quest_item' ? 'trinket' : kind]).toEqual([item.id, item.type]); // the five legacy trinkets were quest items
      const weaponType = /"weapon_type": "([a-z_]+)"/.exec(block)?.[1];
      if (item.type === 'weapon') expect([item.id, item.weaponType]).toEqual([item.id, weaponType ?? 'melee']);
      const damage = pyNumber(block, 'damage');
      const defense = pyNumber(block, 'defense');
      const magic = pyNumber(block, 'magic');
      const agility = pyNumber(block, 'agility');
      const mana = pyNumber(block, 'mana');
      const health = pyNumber(block, 'health');
      if (damage !== undefined) expect([item.id, item.stats.power]).toEqual([item.id, damage]);
      if (defense !== undefined) expect([item.id, item.stats.armor]).toEqual([item.id, defense]);
      if (agility !== undefined) expect([item.id, item.stats.agility]).toEqual([item.id, agility]);
      if (mana !== undefined) expect([item.id, item.stats.mpMax]).toEqual([item.id, mana]);
      if (health !== undefined) expect([item.id, item.stats.hpMax]).toEqual([item.id, health]);
      // legacy "magic" is MAG on a trinket and spell power on a staff (DESIGN §7.7: "power 2, spell power 1")
      if (magic !== undefined) expect([item.id, item.type === 'weapon' ? item.stats.spellPower : item.stats.magic]).toEqual([item.id, magic]);
      const cut = pyNumber(block, 'mana_cost_reduction_percent');
      if (cut !== undefined) expect([item.id, item.passives.find((p) => p.kind === 'mpCostReduction')]).toEqual([item.id, { kind: 'mpCostReduction', pct: cut / 100 }]);
      const steal = pyNumber(block, 'life_steal_percent');
      if (steal !== undefined) expect([item.id, item.passives.find((p) => p.kind === 'lifeSteal')]).toEqual([item.id, { kind: 'lifeSteal', pct: steal / 100 }]);
      const curse = pyNumber(block, 'curse_chance');
      if (curse !== undefined) {
        // the legacy dagger's "curse_damage 3" is the Curse's 3 turns; DESIGN §7.7 adds the 2 HP the wielder pays per hit
        expect(pyNumber(block, 'curse_damage')).toBe(CURSE_ON_HIT_TURNS);
        expect([item.id, item.passives]).toEqual([item.id, [{ kind: 'curse', chance: curse / 100, damage: 2 }]]);
      }
    }
  });

  test('DESIGN §7.7: name, type, tier, value and "new numbers" of every legacy gear row', () => {
    const rows7 = tableRows(section(DESIGN, '### 7.7 Legacy items', '### 7.8')).filter((c) => /^`item_/.test(c[1] ?? '') && GEAR_IDS.includes(unquote(c[1] ?? '')));
    expect(rows7).toHaveLength(16);
    for (const [name = '', idCell = '', typeCell = '', tierCell = '', numbers = '', valueCell = ''] of rows7) {
      const item = gear(unquote(idCell));
      expect([item.id, item.name]).toEqual([item.id, name]);
      expect([item.id, typeCell.split(' ')[0]]).toEqual([item.id, item.type]); // weapon / armor / trinket
      const wt = /`([a-z_]+)`/.exec(typeCell)?.[1];
      if (item.type === 'weapon') expect([item.id, item.weaponType]).toEqual([item.id, wt]);
      const tiers = [...tierCell.matchAll(/\d/g)].map((m) => Number(m[0]));
      expect([item.id, tiers.length === 0 ? item.tier === 0 : tiers.includes(item.tier)]).toEqual([item.id, true]);
      expect([item.id, item.value]).toEqual([item.id, Number(/^(\d+)/.exec(valueCell)?.[1])]);
      // the numbers: every token the cell gives, and nothing else on the record
      const stats: Record<string, number> = {};
      const passives: unknown[] = [];
      const take = (re: RegExp, f: (m: RegExpExecArray) => void) => {
        const m = re.exec(numbers);
        if (m) f(m);
      };
      take(/(?<!spell )power (\d+)/, (m) => (stats.power = Number(m[1])));
      take(/spell power (\d+)/, (m) => (stats.spellPower = Number(m[1])));
      take(/armor (\d+)/, (m) => (stats.armor = Number(m[1])));
      take(/ward ([−-]?\d+)/, (m) => (stats.ward = num(m[1] ?? '')));
      take(/([+−-]\d+) AGI/, (m) => (stats.agility = num(m[1] ?? '')));
      take(/([+−-]\d+) MAG/, (m) => (stats.magic = num(m[1] ?? '')));
      take(/([+−-]\d+) max MP/, (m) => (stats.mpMax = num(m[1] ?? '')));
      take(/([+−-]\d+) max HP/, (m) => (stats.hpMax = num(m[1] ?? '')));
      take(/MP costs −(\d+)%/, (m) => passives.push({ kind: 'mpCostReduction', pct: Number(m[1]) / 100 }));
      take(/lifesteal (\d+)%/, (m) => passives.push({ kind: 'lifeSteal', pct: Number(m[1]) / 100 }));
      take(/(\d+)% on hit: Curse \((\d+)\) on target; each hit costs the wielder (\d+) HP/, (m) => {
        expect(Number(m[2])).toBe(CURSE_ON_HIT_TURNS);
        passives.push({ kind: 'curse', chance: Number(m[1]) / 100, damage: Number(m[3]) });
      });
      expect([item.id, nonZero(item.stats)]).toEqual([item.id, nonZero(stats)]);
      expect([item.id, sortedCanon(item.passives)]).toEqual([item.id, sortedCanon(passives)]);
    }
  });

  test('validator rule 22 no longer counts any legacy gear piece missing', () => {
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    const missing = report.warnings.filter((w) => w.rule === 'rule-22' && GEAR_IDS.includes(w.id));
    expect(missing).toEqual([]);
  });

  test('the Shadow-Kissed Dagger: 20% Curse (3) on hit, 2 HP from the wielder per hit (D-087), Uncommon; the Voidforged Edge has no self-cost', () => {
    const dagger = gear('item_shadow_kissed_dagger');
    expect([dagger.rarityRule, dagger.fixedRarity, dagger.passives]).toEqual(['fixed', 'uncommon', [{ kind: 'curse', chance: 0.2, damage: 2 }]]);
    expect(gear('item_voidforged_edge').passives).toEqual([{ kind: 'statusOnHit', status: 'status_curse', chance: 0.2, duration: 3 }]);
  });
});

// ---- the pack and the engine --------------------------------------------------------------------------------------------------------

describe('the pack with the gear in it', () => {
  test('builds, and validates with no errors; the real warnings are the region units\' (rule 02 flags, rule 11 levels)', () => {
    const { report } = parseContentPack(contentTables);
    expect(report.errors).toEqual([]);
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(strict.errors).toEqual([]);
    const real = strict.warnings.filter((w) => !w.message.startsWith('pending — content not yet authored'));
    expect(real.every((w) => w.rule === 'rule-02' || w.rule === 'rule-11')).toBe(true);
    expect(strict.warnings.filter((w) => w.rule === 'rule-12' || w.rule === 'rule-04')).toEqual([]);
  });

  test('no reference into items is pending any more: the table is complete (U50), so every id a region, creature or merchant names exists', () => {
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    const intoItems = strict.warnings.filter((w) => / not found in items$/.test(w.message));
    expect(intoItems).toEqual([]);
    expect(INCOMPLETE_TABLES).not.toContain('items');
  });
});

describe('the gear in the engine (derive)', () => {
  const EQUIP = { weapon: 'weapon', armor: 'armor', trinket: 'trinket1' } as const;
  function wearing(slot: 'weapon' | 'armor' | 'trinket', itemId: string): PlayerState {
    const run = newRun('u49', 'wizard', pack, freshProfile());
    const player = structuredClone(run.player);
    player.equipment = { weapon: null, armor: null, trinket1: null, trinket2: null };
    player.equipment[EQUIP[slot]] = { uid: 'i-test', itemId, qty: 1, rarity: 'common', affixes: [] };
    return player;
  }
  const bare = (): PlayerState => wearing('weapon', 'item_cracked_void_focus');

  test('every piece equips at Common and adds its stats, resistance steps and passives to the derived values', () => {
    const base = newRun('u49', 'wizard', pack, freshProfile()).player;
    base.equipment = { weapon: null, armor: null, trinket1: null, trinket2: null };
    const d0 = derive(base, pack);
    for (const item of GEAR) {
      const d = derive(wearing(item.slot as 'weapon' | 'armor' | 'trinket', item.id), pack);
      expect([item.id, d.armor - d0.armor, d.ward - d0.ward]).toEqual([item.id, item.stats.armor, item.stats.ward]);
      expect([item.id, d.atk - d0.atk, d.sp - d0.sp]).toEqual([item.id, item.stats.power + item.stats.strength, item.stats.spellPower + item.stats.magic]);
      expect([item.id, d.resistSteps]).toEqual([item.id, item.resistSteps.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t]: (acc[t] ?? 0) + 1 }), {})]);
      expect([item.id, d.passives]).toEqual([item.id, item.passives]);
    }
  });

  test('spot checks: the staves\' MP discount and life steal, the Heartstone Core\'s trade, the Oathplate\'s 10% HP, the Unlidded Eye', () => {
    const necro = derive(wearing('weapon', 'item_necromancer_staff'), pack);
    expect([necro.mpCostReduction, necro.lifeSteal]).toEqual([0.2, 0.05]);
    const core = derive(wearing('trinket', 'item_heartstone_core'), pack);
    const none = derive(bare(), pack);
    expect([core.mpMax - none.mpMax, core.hpMax - none.hpMax]).toEqual([25 + 2 * 2, -15]);
    const oath = derive(wearing('armor', 'item_oathplate'), pack);
    expect(oath.hpMax).toBeGreaterThan(none.hpMax);
    expect(derive(wearing('armor', 'item_cinderhorn_plate'), pack).guardValue).toBe(0.55);
    expect(derive(wearing('trinket', 'item_stiltwalkers_boots'), pack).statusImmunities).toEqual(['status_soaked']);
    expect(derive(wearing('weapon', 'item_hollow_lantern_focus'), pack).statusImmunities).toEqual(['status_blind']);
  });
});
