// Readers for the parts of docs/WORLD.md the region tests check content against (U42; later region units reuse them):
// a region's location blocks (§3.x), the §6 creature table and blocks, the §11.1 node rows and §11.2 edge rows. Every
// reader works on the document's text at test time, so an edit to WORLD or to the content fails the region's test.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
export const WORLD = fs.readFileSync(path.join(ROOT, 'docs/WORLD.md'), 'utf8');
export const PLAN = fs.readFileSync(path.join(ROOT, 'docs/PLAN.md'), 'utf8');

/** The text from the first heading line that starts with `from` to the next heading that starts with `to`. */
export function section(doc: string, from: string, to: string): string {
  const start = doc.indexOf(`\n${from}`);
  if (start < 0) throw new Error(`section: heading ${JSON.stringify(from)} not found`);
  const end = doc.indexOf(`\n${to}`, start + from.length + 1);
  if (end < 0) throw new Error(`section: heading ${JSON.stringify(to)} not found after ${JSON.stringify(from)}`);
  return doc.slice(start + 1, end);
}

/** The cells of every table row of `text` (header and separator rows included). */
export function tableRows(text: string): string[][] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^-*$/.test(c)));
}

export const unquote = (cell: string): string => cell.replace(/`/g, '');
export const ids = (text: string, prefix: string): string[] => [...new Set([...text.matchAll(new RegExp(`\\b(${prefix}_[a-z0-9_]+)`, 'g'))].map((m) => m[1] ?? ''))];

// ---- §3 locations ----------------------------------------------------------------------------------------------------------

export interface WorldExit {
  dir: string;
  to: string;
  /** `—` in WORLD = no condition. */
  conditional: boolean;
}

export interface WorldLocation {
  id: string;
  name: string;
  regionId: string;
  band: { min: number; max: number };
  map: { x: number; y: number };
  /** 'yes' = unconditional rest point, 'cond' = a conditional one, 'no' = none. */
  rest: 'yes' | 'cond' | 'no';
  merchant: string | null;
  /** The legacy description plus WORLD's `+` sentence (if any), as one string. */
  description: string;
  legacyDescription: string | null;
  exits: WorldExit[];
  itemIds: string[];
  creatureIds: string[];
  npcIds: string[];
  /** Event id (legacy ids without a prefix, as WORLD writes them) → text. */
  events: Record<string, string>;
  horizon: number | null;
  block: string;
}

const DIRS = new Set(['north', 'south', 'east', 'west', 'up', 'down', 'in', 'out', 'path']);

function bullet(block: string, label: string): string | null {
  const start = block.indexOf(`- **${label}`);
  if (start < 0) return null;
  const rest = block.slice(start);
  const end = rest.indexOf('\n- **', 1);
  return (end < 0 ? rest : rest.slice(0, end)).replace(/^- \*\*[^*]+\*\*\.?\s*/, '').trim();
}

/** The `#### \`loc_x\` — Name` blocks of one §3.x region section. */
export function worldLocations(regionSection: string): WorldLocation[] {
  const out: WorldLocation[] = [];
  const parts = regionSection.split(/\n(?=#### `loc_)/);
  for (const part of parts) {
    const head = /^#### `(loc_[a-z_]+)` — (.+)$/m.exec(part);
    if (!head) continue;
    const block = part.trimEnd();
    const meta = /- \*\*Region \/ band \/ map:\*\* (region_[a-z_]+) · (\d+)–(\d+)[^·]*· \((-?\d+), (-?\d+)\) · (.*)$/m.exec(block);
    if (!meta) throw new Error(`worldLocations: no meta line for ${head[1]}`);
    const tail = meta[6] ?? '';
    const rest: WorldLocation['rest'] = /Rest point: yes|Rest: yes/.test(tail) ? 'yes' : /Rest: no \([^)]*yes/.test(tail) ? 'cond' : 'no';
    const merchant = /Merchant: yes\*\* \((npc_[a-z_]+)/.exec(tail)?.[1] ?? null;
    const desc = bullet(block, 'Description.') ?? '';
    const [legacy, added] = desc.split('`+`').map((s) => s.trim());
    const description = added ? `${legacy} ${added}` : (legacy ?? '');
    const exits: WorldExit[] = [];
    const exitsStart = block.indexOf('- **Exits**');
    const exitsText = exitsStart < 0 ? '' : block.slice(exitsStart, block.indexOf('\n- **', exitsStart + 1));
    for (const cells of tableRows(exitsText)) {
      const dir = cells[0] ?? '';
      if (!DIRS.has(dir)) continue; // the header row, arrivals and portal edges (⟂) are not walkable exits
      // `—` = open; WORLD sometimes adds a note in parentheses after the dash
      exits.push({ dir, to: unquote(cells[1] ?? ''), conditional: !(cells[2] ?? '—').startsWith('—') });
    }
    const itemsText = (bullet(block, 'Items:') ?? '').split('**Anchors**')[0] ?? '';
    const events: Record<string, string> = {};
    for (const m of (bullet(block, 'Events:') ?? '').matchAll(/`([a-z_]+)` — "([^"]+)"/g)) events[m[1] ?? ''] = m[2] ?? '';
    const horizon = /horizon (\d\.\d+)/.exec(bullet(block, 'Art spec:') ?? '')?.[1];
    out.push({
      id: head[1] ?? '',
      name: head[2] ?? '',
      regionId: meta[1] ?? '',
      band: { min: Number(meta[2]), max: Number(meta[3]) },
      map: { x: Number(meta[4]), y: Number(meta[5]) },
      rest,
      merchant,
      description,
      legacyDescription: added ? (legacy ?? null) : null,
      exits,
      itemIds: ids(itemsText, 'item').concat(ids(itemsText, 'mat')),
      creatureIds: ids(bullet(block, 'Encounters:') ?? '', 'cr'),
      npcIds: ids(bullet(block, 'NPCs:') ?? '', 'npc'),
      events,
      horizon: horizon === undefined ? null : Number(horizon),
      block,
    });
  }
  return out;
}

// ---- §6 creatures ------------------------------------------------------------------------------------------------------------

export interface WorldCreatureRow {
  id: string;
  name: string;
  family: string;
  role: string;
  level: number;
  regions: string;
  xp: number;
}

const FAMILY_IDS: Record<string, string> = {
  Hollowed: 'fam_hollowed',
  Wilds: 'fam_wilds',
  Drowned: 'fam_drowned',
  Wards: 'fam_wards',
  Spireborn: 'fam_spireborn',
  Green: 'fam_green',
  'Watch-wardens': 'fam_watch_wardens',
  Unravelled: 'fam_unravelled',
};

/** The §6 summary table, keyed by creature id. */
export function worldCreatureTable(): Record<string, WorldCreatureRow> {
  const text = section(WORLD, '## 6. Creatures', '### 6.1');
  const out: Record<string, WorldCreatureRow> = {};
  for (const cells of tableRows(text)) {
    const id = unquote(cells[0] ?? '');
    if (!id.startsWith('cr_')) continue;
    const role = /\b(fodder|elite|boss|anomaly|add)\b/.exec(cells[3] ?? '')?.[1] ?? cells[3] ?? '';
    out[id] = {
      id,
      name: cells[1] ?? '',
      family: FAMILY_IDS[cells[2] ?? ''] ?? (cells[2] ?? ''),
      role,
      level: Number(cells[4]),
      regions: cells[5] ?? '',
      xp: Number((cells[6] ?? '').replace(/,/g, '')),
    };
  }
  return out;
}

export interface WorldCreatureBlock {
  id: string;
  name: string;
  stats: { hp: number; atk: number; armor: number; ward: number; agi: number };
  weak: string[];
  resist: string[];
  immune: string[];
  /** move id → telegraph line, for every intent line that carries one. */
  intents: Record<string, string>;
  gold: { min: number; max: number } | null;
  lootIds: string[];
  legacyDescription: string | null;
  voice: 'remnant_archive' | 'wayfinder_notes' | null;
  block: string;
}

const DAMAGE = new Set(['physical', 'fire', 'storm', 'ley', 'void', 'chrono']);

/** The `#### \`cr_x\` — Name` block of one creature (anywhere in §6). */
export function worldCreature(id: string): WorldCreatureBlock {
  const start = WORLD.indexOf(`#### \`${id}\``);
  if (start < 0) throw new Error(`worldCreature: no block for ${id}`);
  const next = WORLD.slice(start + 5).search(/\n#{3,4} /);
  const block = next < 0 ? WORLD.slice(start) : WORLD.slice(start, start + 5 + next);
  const head = /^#### `cr_[a-z_]+` — ([^(\n]+)/.exec(block);
  // (`HP 130 (DESIGN §6.5 Mistwood elite)`: WORLD may annotate the HP figure)
  const stats = /- \*\*Stats:\*\* HP (\d+)(?: \([^)]*\))? · ATK (\d+) · DEF (\d+)\/(\d+) · AGI (\d+)/.exec(block);
  if (!stats) throw new Error(`worldCreature: no stats line for ${id}`);
  const resistLine = bullet(block, 'Resist:') ?? '';
  const types = (label: string): string[] => {
    const m = new RegExp(`(?:^|· )${label} ([^·]+)`).exec(resistLine);
    return m ? (m[1] ?? '').split(',').map((s) => s.trim().replace(/\s*\(.*$/, '')).filter((t) => DAMAGE.has(t)) : [];
  };
  const immune = /immune ([a-z, ]+)/.exec(resistLine)?.[1]?.split(',').map((s) => s.trim()).filter((s) => s !== '' && s !== '—') ?? [];
  const statusImmune = /status immune: ([a-z, ]+)/.exec(resistLine)?.[1]?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const intents: Record<string, string> = {};
  for (const m of block.matchAll(/^\s*- `([a-z0-9_]+)` · "([^"]+)"/gm)) intents[m[1] ?? ''] = m[2] ?? '';
  const lootText = bullet(block, 'Loot') ?? '';
  const gold = /(\d+)–(\d+) g/.exec(lootText);
  const voice = /- \*\*Bestiary\*\* \((Remnant Archive|Wayfinder's Notes)\)/.exec(block)?.[1];
  return {
    id,
    name: (head?.[1] ?? '').trim(),
    stats: { hp: Number(stats[1]), atk: Number(stats[2]), armor: Number(stats[3]), ward: Number(stats[4]), agi: Number(stats[5]) },
    weak: types('weak'),
    resist: types('resist'),
    immune: [...immune, ...statusImmune],
    intents,
    gold: gold ? { min: Number(gold[1]), max: Number(gold[2]) } : null,
    lootIds: ids(lootText, 'item').concat(ids(lootText, 'mat')),
    legacyDescription: /- \*\*Legacy description:\*\* "([^"]+)"/.exec(block)?.[1] ?? null,
    voice: voice === 'Remnant Archive' ? 'remnant_archive' : voice === "Wayfinder's Notes" ? 'wayfinder_notes' : null,
    block,
  };
}

// ---- §11 map data --------------------------------------------------------------------------------------------------------------

export interface WorldNode {
  id: string;
  abbr: string;
  name: string;
  regionId: string;
  x: number;
  y: number;
  band: { min: number; max: number };
  temporallyUnstable: boolean;
  rest: string;
  merchant: string;
  settlement: boolean;
}

export function worldNodes(): Record<string, WorldNode> {
  const out: Record<string, WorldNode> = {};
  for (const cells of tableRows(section(WORLD, '### 11.1 Nodes', '### 11.2'))) {
    const id = cells[0] ?? '';
    if (!id.startsWith('loc_')) continue;
    const band = /(\d+)(?:–(\d+))?/.exec(cells[6] ?? '');
    out[id] = {
      id,
      abbr: cells[1] ?? '',
      name: cells[2] ?? '',
      regionId: cells[3] ?? '',
      x: Number(cells[4]),
      y: Number(cells[5]),
      band: { min: Number(band?.[1]), max: Number(band?.[2] ?? band?.[1]) },
      temporallyUnstable: cells[7] === 'true',
      rest: cells[8] ?? '',
      merchant: cells[9] ?? '',
      settlement: cells[10] === 'true',
    };
  }
  return out;
}

export interface WorldEdge {
  from: string;
  to: string;
  dir: string;
  reverseDir: string;
  cost: number | null;
  reverseCost: number | null;
  gate: string;
  reverseGate: string;
  kind: string;
}

export function worldEdges(): WorldEdge[] {
  const out: WorldEdge[] = [];
  for (const cells of tableRows(section(WORLD, '### 11.2 Edges', '### 11.3'))) {
    if (!(cells[0] ?? '').startsWith('loc_')) continue;
    const num = (c: string | undefined): number | null => (c === undefined || c === 'none' || c === '' ? null : Number(c));
    out.push({
      from: cells[0] ?? '',
      to: cells[1] ?? '',
      dir: cells[2] ?? '',
      reverseDir: cells[3] ?? '',
      cost: num(cells[4]),
      reverseCost: num(cells[5]),
      gate: cells[6] ?? '',
      reverseGate: cells[7] ?? '',
      kind: cells[8] ?? '',
    });
  }
  return out;
}

/** PLAN Appendix A.2: legacy location id → { legacyName, region }. */
export function appendixLegacyLocations(): Record<string, { name: string; region: string }> {
  const out: Record<string, { name: string; region: string }> = {};
  for (const cells of tableRows(section(PLAN, '### A.2 Locations', '### A.3'))) {
    const id = unquote(cells[0] ?? '');
    if (id.startsWith('loc_')) out[id] = { name: cells[1] ?? '', region: unquote(cells[2] ?? '') };
  }
  return out;
}
