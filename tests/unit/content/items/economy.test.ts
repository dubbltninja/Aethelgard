// U50: the 30 recipes (src/content/shared/recipes.ts) and the 8 merchants (src/content/shared/merchants.ts) checked against the
// documents at test time — WORLD §8.2 (every recipe: output, inputs, fee, rep gate, requirements), §9.1 (markup, faction), §9.2
// (every Core/Pool/Trusted/Sworn line), §9.3 (the prices a Wayfinder pays) and §9.4 (never soft-locked by poverty) — and then run
// in the real engine: Borin crafts every recipe, and each stall restocks and prices as WORLD says. What the schema cannot say is
// pinned where the content says it closest (a Trusted piece is a Rare with a rolled affix, a pooled material is one unit …): the
// U50 reply lists each, and a test below fails if one of them is ever repaired or made worse.
import { describe, expect, test } from 'bun:test';
import { buildContentPack, contentTables } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { merchants } from '@content/shared/merchants';
import { recipes } from '@content/shared/recipes';
import { validateContent } from '@content/validate';
import {
  buyPrice,
  craftQuote,
  forgeFee,
  makeCtx,
  merchantRefusal,
  merchantTier,
  recipeTier,
  restock,
  sellPrice,
  step,
  type GameState,
  type ItemInstance,
  type Profile,
} from '@engine/index';
import { clone } from '@engine/util/clone';
import type { Condition } from '@schema/condition';
import { MAX_AFFIXES, type Item } from '@schema/item';
import type { Merchant } from '@schema/merchant';
import type { Recipe } from '@schema/recipe';
import { freshProfile, makeState, type StateOverrides } from '@tests/fixtures/helpers';
import { WORLD, ids, section, tableRows, unquote } from '../regions/worldDoc';

const pack = buildContentPack();
const FORGE = 'loc_emberforge';
const poolOf = (merchantId: string): readonly string[] => pack.merchants[merchantId]?.rollStock?.pool ?? [];
const item = (id: string): Item => {
  const found = pack.items[id];
  if (!found) throw new Error(`no item ${id}`);
  return found;
};

/** Key-sorted JSON, so conditions compare regardless of key order. */
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

// ---- WORLD §8.2 -------------------------------------------------------------------------------------------------------------------

interface Want {
  id: string;
  outputId: string;
  outputCount: number;
  inputs: { itemId: string; count: number }[];
  anyOf: { itemId: string; count: number }[][];
  gold: number;
  story: boolean;
  repTier: 'neutral' | 'trusted';
  waiver?: string[];
  /** "trusted (or `echo_borin_oath`)": the tier gate is a condition (the fixture's form). */
  echoOr?: `echo_${string}`;
  flags: `flag_${string}`[];
  echoes: `echo_${string}`[];
  read?: string;
  /** The Requires cell has a clause about the quest stage (prose; not the recipe's gate). */
  stageNote: boolean;
}

const take = (text: string): { itemId: string; count: number }[] =>
  [...text.matchAll(/`((?:item|mat)_[a-z0-9_]+)`(?: ×(\d+))?/g)].map((m) => ({ itemId: m[1] ?? '', count: Number(m[2] ?? 1) }));

function wantOf(c: string[]): Want {
  const [id = '', outputCell = '', inputsCell = '', goldCell = '', repCell = '', requiresCell = ''] = c;
  const out = /`(item_[a-z0-9_]+)`(?: ×(\d+))?/.exec(outputCell);
  const oneOf = /\*\*one of\*\*(.*?)(?:;|$)/.exec(inputsCell)?.[1];
  const waiver = /\*\*neutral\*\* while `(q_[a-z_]+)` or `(q_[a-z_]+)` is active/.exec(repCell);
  const clausesOf = requiresCell === '—' ? [] : requiresCell.split(';').map((x) => x.trim());
  const want: Want = {
    id: unquote(id),
    outputId: out?.[1] ?? '',
    outputCount: Number(out?.[2] ?? 1),
    inputs: take(oneOf === undefined ? inputsCell : inputsCell.replace(/\*\*one of\*\*.*?(?:;|$)/, '')),
    anyOf: oneOf === undefined ? [] : oneOf.split('**or**').map(take),
    gold: Number(/\d+/.exec(goldCell.replace(/\*/g, ''))?.[0]),
    story: /story recipe/.test(goldCell),
    repTier: repCell.startsWith('trusted') && !/\(or `echo_/.test(repCell) ? 'trusted' : 'neutral',
    flags: [],
    echoes: [],
    stageNote: false,
  };
  if (waiver) want.waiver = [waiver[1] ?? '', waiver[2] ?? ''];
  const echoOr = /^trusted \(or `(echo_[a-z_]+)`\)$/.exec(repCell)?.[1];
  if (echoOr) want.echoOr = echoOr as `echo_${string}`;
  for (const clause of clausesOf) {
    let m: RegExpExecArray | null;
    if ((m = /^read `(item_pattern_[a-z_]+)`$/.exec(clause))) want.read = m[1];
    else if ((m = /^`(flag_[a-z_]+)`(?: this loop)?(?: \(D-017\))?$/.exec(clause))) want.flags.push((m[1] ?? '') as `flag_${string}`);
    else if ((m = /^`(echo_[a-z_]+)`(?: \(.*)?$/.exec(clause))) want.echoes.push((m[1] ?? '') as `echo_${string}`);
    else if (/^the quest stage requires /.test(clause)) want.stageNote = true;
    else throw new Error(`${want.id}: requires clause not understood: ${JSON.stringify(clause)}`);
  }
  return want;
}

const ROWS = tableRows(section(WORLD, '### 8.2 ', '### 8.3 ')).filter((c) => /^`recipe_/.test(c[0] ?? ''));
const WANT = ROWS.map(wantOf);

/** The condition a Requires cell (and the rep cell's "or Echo") makes. */
function conditionOf(w: Want): Condition | undefined {
  const parts: Condition[] = [...w.flags.map((flag): Condition => ({ flag })), ...w.echoes.map((echo): Condition => ({ echo }))];
  if (w.echoOr) parts.push({ any: [{ rep: { faction: 'ironclad', min: pack.config.repTiers.trusted } }, { echo: w.echoOr }] });
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? (parts[0] as Condition) : { all: parts };
}

describe('the recipes (shared/recipes.ts) against WORLD §8.2', () => {
  test('30 recipes, every WORLD row a record in its order and none extra; registered once in contentTables', () => {
    expect(ROWS).toHaveLength(30);
    expect(recipes).toHaveLength(30);
    expect(recipes.map((r) => r.id)).toEqual(WANT.map((w) => w.id));
    expect(contentTables.recipes.map((r) => r.id)).toEqual(WANT.map((w) => w.id));
    expect(Object.keys(pack.recipes)).toEqual(WANT.map((w) => w.id));
  });

  test('output: the item and count of every row; gear comes out Common (the Bell-Warden\'s Clapper item is a fixed Rare, so its recipe says so)', () => {
    for (const w of WANT) {
      const r = pack.recipes[w.id] as Recipe;
      const out = item(w.outputId);
      expect([w.id, r.output.itemId, r.output.count]).toEqual([w.id, w.outputId, w.outputCount]);
      // "Output is Common unless noted" (§8.2): gear says so; a consumable or quest item has no rarity
      expect([w.id, r.output.rarity]).toEqual([w.id, out.slot === undefined ? undefined : 'common']);
      expect([w.id, r.name]).toEqual([w.id, out.name]);
    }
    expect(WANT.find((w) => w.id === 'recipe_bell_clapper')).toBeDefined();
    expect(ROWS.find((c) => unquote(c[0] ?? '') === 'recipe_bell_clapper')?.[1]).toContain('the boss copy is Rare');
    expect(item('item_bell_clapper').fixedRarity).toBe('rare');
  });

  test('category follows the output: weapon, armor, trinket, consumable — and `quest` for the Breach-anchor', () => {
    for (const w of WANT) {
      const out = item(w.outputId);
      expect([w.id, (pack.recipes[w.id] as Recipe).category]).toEqual([w.id, out.type === 'quest' || out.type === 'consumable' ? (out.type === 'quest' ? 'quest' : 'consumable') : out.type]);
    }
  });

  test('inputs: WORLD\'s exact counts, in its order; the Breach-anchor\'s fragment is an `anyOf` (stable or dead, D-052)', () => {
    for (const w of WANT) {
      const r = pack.recipes[w.id] as Recipe;
      expect([w.id, r.inputs.map((i) => ({ itemId: i.itemId, count: i.count }))]).toEqual([w.id, w.inputs]);
      expect([w.id, r.anyOf]).toEqual([w.id, w.anyOf]);
    }
    expect(WANT.filter((w) => w.anyOf.length > 0).map((w) => w.id)).toEqual(['recipe_breach_anchor']);
    expect(pack.recipes.recipe_breach_anchor?.anyOf).toEqual([[{ itemId: 'item_heartstone_fragment_stable', count: 1 }], [{ itemId: 'item_heartstone_fragment_dead', count: 1 }]]);
  });

  test('every recipe\'s inputs, `anyOf` and output exist as items, and no input is gear', () => {
    for (const r of Object.values(pack.recipes)) {
      for (const i of [...r.inputs, ...r.anyOf.flat(), { itemId: r.output.itemId }]) expect([r.id, i.itemId, pack.items[i.itemId] !== undefined]).toEqual([r.id, i.itemId, true]);
      for (const i of [...r.inputs, ...r.anyOf.flat()]) expect([r.id, i.itemId, item(i.itemId).slot]).toEqual([r.id, i.itemId, undefined]);
      expect(item(r.output.itemId).sources).toContain(`craft:${r.id}`);
    }
  });

  test('fee and story: Borin\'s gold of every row; only the Breach-anchor is a story recipe (no fee, D-066 #10); the Glyphbound Lantern is free (§9.6)', () => {
    for (const w of WANT) expect([w.id, (pack.recipes[w.id] as Recipe).gold, (pack.recipes[w.id] as Recipe).story]).toEqual([w.id, w.gold, w.story]);
    expect(WANT.filter((w) => w.story).map((w) => w.id)).toEqual(['recipe_breach_anchor']);
    expect(WANT.filter((w) => w.gold === 0).map((w) => w.id)).toEqual(['recipe_breach_anchor', 'recipe_glyphbound_lantern']);
  });

  test('the Ironclad tier of every row: neutral or trusted; the Breach-anchor is Neutral while its quest is active; the void-forged line takes an Echo instead', () => {
    for (const w of WANT) {
      const r = pack.recipes[w.id] as Recipe;
      expect([w.id, r.repTier]).toEqual([w.id, w.repTier]);
      expect([w.id, r.repTierWhileActive]).toEqual([w.id, w.waiver === undefined ? undefined : { quests: w.waiver, tier: 'neutral' }]);
    }
    expect(WANT.filter((w) => w.repTier === 'trusted').map((w) => w.id)).toEqual(['recipe_breach_anchor', 'recipe_emberwrought_blade', 'recipe_hallows_hammer', 'recipe_sunderforged_plate']);
    expect(WANT.filter((w) => w.echoOr !== undefined).map((w) => w.id)).toEqual(['recipe_voidforged_edge', 'recipe_voidforged_mail', 'recipe_voidforged_band']);
  });

  test('requirements: the flag or Echo each row names (the Heartstone flags per loop), the pattern a row says "read"', () => {
    for (const w of WANT) {
      const r = pack.recipes[w.id] as Recipe;
      expect([w.id, r.requires === undefined ? undefined : canon(r.requires)]).toEqual([w.id, conditionOf(w) === undefined ? undefined : canon(conditionOf(w))]);
      expect([w.id, r.requiresItemRead]).toEqual([w.id, w.read]);
    }
    expect(WANT.filter((w) => w.flags.includes('flag_heartstone_stabilized')).map((w) => w.id)).toEqual([
      'recipe_ley_tuned_staff',
      'recipe_ley_tuned_vestment',
      'recipe_ley_tuned_charm',
      'recipe_ley_tuned_tonic',
    ]);
    expect(WANT.filter((w) => w.read !== undefined)).toHaveLength(8);
    // the Breach-anchor's own gate is `echo_anchor_schema`; the quest stage's (the Forge-Mark Echo) is the quest's, and `echo_void_resonance` is checked at the ending
    expect(WANT.find((w) => w.id === 'recipe_breach_anchor')).toMatchObject({ echoes: ['echo_anchor_schema'], stageNote: true });
    expect(canon(pack.recipes.recipe_breach_anchor?.requires)).toBe(canon({ echo: 'echo_anchor_schema' }));
  });

  test('each pattern is read to unlock exactly its recipe (the pattern item\'s `unlockRecipe`), one pattern for each', () => {
    const patterns = WANT.filter((w) => w.read !== undefined);
    for (const w of patterns) {
      const p = item(w.read as string);
      expect([w.id, p.type, p.onUse]).toEqual([w.id, 'recipe', [{ unlockRecipe: w.id }]]);
    }
    expect(new Set(patterns.map((w) => w.read)).size).toBe(patterns.length);
    // the eight Borin's Patterns unlock a recipe; the two schematic halves grant the Echoes `echo_anchor_schema` is made of (D-067.6)
    const unlocking = Object.values(pack.items).filter((i) => i.onUse.some((e) => 'unlockRecipe' in e));
    expect(unlocking.map((i) => i.id).sort()).toEqual(patterns.map((w) => w.read as string).sort());
  });

  test('time cost is the default (the first craft of a visit costs a watch, later ones none); there is no station field (Borin is the only crafter)', () => {
    for (const r of Object.values(pack.recipes)) expect([r.id, r.timeCost]).toEqual([r.id, 1]);
  });

  test('every gear row WORLD marks "craft" is some recipe\'s output, so no craft-only piece is out of reach', () => {
    const outputs = new Set(WANT.map((w) => w.outputId));
    const gear = ['### 7.1 ', '### 7.2 ', '### 7.3 ', '### 7.4 ', '### 7.5 ', '### 7.6 ', '### 7.7 '].flatMap((from, i, all) =>
      tableRows(section(WORLD, from, all[i + 1] ?? '### 7.8 ')),
    );
    const craft = gear.filter((c) => /^`item_/.test(c[0] ?? '') && c.includes('craft')).map((c) => unquote(c[0] ?? ''));
    expect(craft.length).toBeGreaterThan(0);
    for (const id of craft) expect([id, outputs.has(id)]).toEqual([id, true]);
  });
});

// ---- WORLD §9 ---------------------------------------------------------------------------------------------------------------------------

interface WantStall {
  id: string;
  markup: number;
  faction: string | undefined;
  /** Unconditional core lines. */
  core: { itemId: string; count: number }[];
  loop2: { itemId: string; count: number }[];
  trusted: { itemId: string; rare: boolean }[];
  sworn: { itemId: string; count: number }[];
  pool: string[];
  poolLoop2: string[];
  poolDays12: string[];
}

const CELL = /`((?:item|mat)_[a-z0-9_]+)`(?: ×(\d+))?(?: at fixed Rare)?/g;
const tokens = (text: string): { itemId: string; count: number; rare: boolean; index: number }[] =>
  [...text.matchAll(CELL)].map((m) => ({ itemId: m[1] ?? '', count: Number(m[2] ?? 1), rare: / at fixed Rare$/.test(m[0]), index: m.index ?? 0 }));

function stalls(): WantStall[] {
  const table = Object.fromEntries(
    tableRows(section(WORLD, '### 9.1 ', '### 9.2 '))
      .filter((c) => /^`npc_/.test(c[0] ?? ''))
      .map((c) => [unquote(c[0] ?? ''), c]),
  );
  const out: WantStall[] = [];
  let current: WantStall | undefined;
  for (const line of section(WORLD, '### 9.2 Stock', '### 9.3 ').split('\n')) {
    const head = /^\*\*`(npc_[a-z_]+)`/.exec(line);
    if (head) {
      const id = head[1] ?? '';
      const row = table[id] ?? [];
      const factionCell = row[3] ?? '';
      current = {
        id,
        markup: Number(/^[\d.]+/.exec(row[4] ?? '')?.[0]),
        faction: factionCell.startsWith('none') ? (factionCell.includes('best') ? 'best' : undefined) : unquote(factionCell),
        core: [],
        loop2: [],
        trusted: [],
        sworn: [],
        pool: [],
        poolLoop2: [],
        poolDays12: [],
      };
      out.push(current);
      continue;
    }
    const cells = line.startsWith('|') ? line.split('|').slice(1, -1).map((x) => x.trim()) : [];
    if (!current || cells.length < 2) continue;
    const [section9, text = ''] = cells;
    const loopAt = text.indexOf('Loop 2+:');
    if (section9 === 'Core') {
      for (const t of tokens(text)) (loopAt >= 0 && t.index > loopAt ? current.loop2 : current.core).push({ itemId: t.itemId, count: t.count });
    } else if (section9 === 'Trusted') {
      for (const t of tokens(text.replace(/— the Remnant Ley gear[^;]*/, ''))) current.trusted.push({ itemId: t.itemId, rare: t.rare });
    } else if (section9 === 'Sworn') {
      if (!/\(gift/.test(text)) for (const t of tokens(text)) current.sworn.push({ itemId: t.itemId, count: t.count });
    } else if (section9 === 'Pool') {
      const body = text.replace(/^.*\(legacy exclusion\):/, ''); // Kaelen: the "except" list is what he never stocks
      const loop2At = body.indexOf('Loop 2+:');
      const days12At = body.indexOf('Days 1–2:');
      for (const t of tokens(body)) {
        const tagged = body.slice(t.index + t.itemId.length + 2).startsWith(' (Days 1–2)');
        if (loop2At >= 0 && t.index > loop2At) current.poolLoop2.push(t.itemId);
        else if (tagged || (days12At >= 0 && t.index > days12At)) current.poolDays12.push(t.itemId);
        else current.pool.push(t.itemId);
      }
    }
  }
  return out;
}
const STALLS = stalls();

const canonOfWhen = (when: Condition | undefined): string => (when === undefined ? '' : canon(when));

describe('the merchants (shared/merchants.ts) against WORLD §9.1–9.2', () => {
  const trustedMin = pack.config.repTiers.trusted;
  const swornMin = pack.config.repTiers.sworn;

  test('eight merchants, in WORLD\'s order, keyed by their NPC id; registered once', () => {
    expect(STALLS.map((s) => s.id)).toEqual([
      'npc_kaelen_stonehand',
      'npc_tamsin_reed',
      'npc_borin_stonefist',
      'npc_sedge_marrow',
      'npc_tessaly_varr',
      'npc_old_fennick',
      'npc_hollis_cade',
      'npc_bellwright_anso',
    ]);
    expect(merchants.map((m) => m.id)).toEqual(STALLS.map((s) => s.id));
    expect(Object.keys(pack.merchants)).toEqual(STALLS.map((s) => s.id));
    for (const m of merchants) expect([m.id, m.npcId]).toEqual([m.id, m.id]);
    expect(contentTables.merchants).toHaveLength(8);
  });

  test('region markup and faction of every merchant (§9.1): Kaelen the best of three; Fennick and Anso none', () => {
    for (const s of STALLS) {
      const m = pack.merchants[s.id] as Merchant;
      expect([s.id, m.regionMarkup, m.repFaction]).toEqual([s.id, s.markup, s.faction]);
    }
    expect(STALLS.map((s) => [s.id, s.faction])).toEqual([
      ['npc_kaelen_stonehand', 'best'],
      ['npc_tamsin_reed', 'remnants'],
      ['npc_borin_stonefist', 'ironclad'],
      ['npc_sedge_marrow', 'remnants'],
      ['npc_tessaly_varr', 'ironclad'],
      ['npc_old_fennick', undefined],
      ['npc_hollis_cade', 'weavers'],
      ['npc_bellwright_anso', undefined],
    ]);
  });

  test('core stock: WORLD\'s Core line, its counts, always on the shelf (no `when`, no named rarity, no price change) — Hollis\'s two special lines apart', () => {
    for (const s of STALLS) {
      const m = pack.merchants[s.id] as Merchant;
      const plain = m.stock.filter((e) => e.when === undefined && e.rarity === undefined && e.priceMult === 1).map((e) => ({ itemId: e.itemId, count: e.count }));
      const special = new Set(['item_void_shard', 'item_veil_sigil']);
      const wantCore = s.core.filter((c) => !special.has(c.itemId) || s.id !== 'npc_hollis_cade');
      expect([s.id, plain]).toEqual([s.id, wantCore]);
    }
  });

  test('Loop 2+ lines are core entries with `when: loop ≥ 2` (the schema has no `when` for pool picks), in the order WORLD gives them', () => {
    for (const s of STALLS) {
      const m = pack.merchants[s.id] as Merchant;
      const got = m.stock.filter((e) => canonOfWhen(e.when) === canon({ loop: { min: 2 } })).map((e) => ({ itemId: e.itemId, count: e.count }));
      expect([s.id, got]).toEqual([s.id, [...s.loop2, ...s.poolLoop2.map((itemId) => ({ itemId, count: 1 }))]]);
    }
    expect(STALLS.filter((s) => s.loop2.length + s.poolLoop2.length > 0).map((s) => s.id)).toEqual(['npc_kaelen_stonehand', 'npc_tamsin_reed', 'npc_old_fennick']);
  });

  test('Trusted lines: a core entry gated on rep ≥ Trusted with that merchant\'s faction; "at fixed Rare" is `rarity: rare`; patterns are the same line', () => {
    for (const s of STALLS) {
      const m = pack.merchants[s.id] as Merchant;
      const got = m.stock.filter((e) => canonOfWhen(e.when) === canon({ rep: { faction: m.repFaction, min: trustedMin } })).map((e) => ({ itemId: e.itemId, rare: e.rarity === 'rare' }));
      expect([s.id, got]).toEqual([s.id, s.trusted]);
    }
    expect(STALLS.flatMap((s) => s.trusted.filter((t) => t.rare).map((t) => `${s.id}:${t.itemId}`))).toEqual([
      'npc_tamsin_reed:item_scriptorium_staff',
      'npc_borin_stonefist:item_ironclad_hammer',
      'npc_sedge_marrow:item_divers_coat',
      'npc_tessaly_varr:item_cinderhorn_plate',
      'npc_hollis_cade:item_hollow_lantern_focus',
    ]);
  });

  test('Sworn lines: the stocked ones are core entries gated on rep ≥ Sworn (Hollis\'s thread and shardglass); the "gift" pieces are no stock', () => {
    for (const s of STALLS) {
      const m = pack.merchants[s.id] as Merchant;
      const got = m.stock
        .filter((e) => canonOfWhen(e.when).includes(canon({ rep: { faction: m.repFaction, min: swornMin } })))
        .map((e) => ({ itemId: e.itemId, count: e.count }));
      expect([s.id, got]).toEqual([s.id, s.sworn]);
    }
    expect(STALLS.find((s) => s.id === 'npc_hollis_cade')?.sworn).toEqual([
      { itemId: 'item_nyxs_shardglass', count: 1 },
      { itemId: 'mat_umbral_thread', count: 3 },
    ]);
    // "if not taken from loc_where_she_fell this loop" is read as "not carried"
    const shardglass = pack.merchants.npc_hollis_cade?.stock.find((e) => e.itemId === 'item_nyxs_shardglass');
    expect(canon(shardglass?.when)).toBe(canon({ all: [{ rep: { faction: 'weavers', min: swornMin } }, { not: { item: { id: 'item_nyxs_shardglass' } } }] }));
    for (const gift of ['item_archivists_circlet', 'item_oathplate']) {
      expect(WORLD).toContain(`\`${gift}\``);
      expect(Object.values(pack.merchants).some((m) => m.stock.some((e) => e.itemId === gift) || poolOf(m.id).includes(gift))).toBe(false);
    }
  });

  test('pool: WORLD\'s Pool line (Kaelen\'s explicit list, not the rule above it); 3–4 picks a day; Anso\'s pool is the one rolled charm WORLD leaves unnamed', () => {
    for (const s of STALLS) {
      const m = pack.merchants[s.id] as Merchant;
      if (s.id === 'npc_bellwright_anso') continue;
      expect([s.id, m.rollStock?.pool]).toEqual([s.id, s.pool]);
      expect([s.id, m.rollStock?.pick]).toEqual([s.id, { min: 3, max: 4 }]);
    }
    // Anso: "charms: Bell Shard (Days 1–2), rolled T3–T4 trinkets …; Days 1–2: the Breachwarden pattern" — the two named items are core lines
    // for Days 1–2 (a pool entry has no `when`); the unnamed rolled trinkets are the Salt Charm, the one rolled, non-key T3–T4 trinket
    const anso = pack.merchants.npc_bellwright_anso as Merchant;
    const days12 = canon({ any: [{ beforeDay: 1 }, { beforeDay: 2 }] });
    expect(STALLS.find((s) => s.id === 'npc_bellwright_anso')?.poolDays12).toEqual(['item_bell_shard', 'item_pattern_breachwarden_mail']);
    expect(anso.stock.filter((e) => canonOfWhen(e.when) === days12).map((e) => e.itemId)).toEqual(['item_bell_shard', 'item_pattern_breachwarden_mail']);
    expect([anso.rollStock?.pool, anso.rollStock?.pick]).toEqual([['item_salt_charm'], { min: 0, max: 1 }]);
    const rolledTrinkets = Object.values(pack.items).filter((i) => i.type === 'trinket' && i.tier >= 3 && i.tier <= 4 && i.rarityRule === 'rolled' && !i.tags.includes('key'));
    expect(rolledTrinkets.map((i) => i.id)).toEqual(['item_salt_charm']);
  });

  test('Kaelen\'s pool is the T1–T2 weapons and armor WORLD lists — never the Warrior\'s Sword or the Shadow-Kissed Dagger (legacy exclusion)', () => {
    const pool = pack.merchants.npc_kaelen_stonehand?.rollStock?.pool ?? [];
    expect(pool).toHaveLength(14);
    expect(pool).not.toContain('item_warriors_sword');
    expect(pool).not.toContain('item_shadow_kissed_dagger');
    for (const id of pool) expect([id, (item(id).type === 'weapon' || item(id).type === 'armor') && item(id).tier <= 2 && item(id).rarityRule === 'rolled']).toEqual([id, true]);
    // WORLD's rule ("any T1–T2 weapon or armor that is not quest-locked") would also admit these two rolled pieces its list leaves out; their
    // sources (Borin's harness, the Reach's coat) do not include Kaelen, so the list wins — a contradiction in §9.2 reported by U50
    const byRule = Object.values(pack.items)
      .filter((i) => (i.type === 'weapon' || i.type === 'armor') && i.tier <= 2 && i.rarityRule === 'rolled' && !['item_warriors_sword'].includes(i.id))
      .map((i) => i.id)
      .filter((id) => !pool.includes(id))
      .sort();
    expect(byRule).toEqual(['item_divers_coat', 'item_scrap_harness']);
    for (const id of byRule) expect(item(id).sources).not.toContain('merchant:npc_kaelen_stonehand');
  });

  test('"Free" lines are no stock: the Ember vein, the Forge-Mark, the Hammer pattern and the primer are Borin\'s to give, and the Breach-anchor is a 0 g recipe', () => {
    const borin = pack.merchants.npc_borin_stonefist as Merchant;
    for (const id of ['mat_ember_ore', 'item_borins_forge_mark', 'item_pattern_hallows_hammer', 'item_tobrins_warding_primer', 'item_breach_anchor']) {
      expect([id, borin.stock.some((e) => e.itemId === id) || poolOf(borin.id).includes(id)]).toEqual([id, false]);
    }
    expect(borin.services).toEqual(['buy', 'sell', 'upgrade']);
    for (const m of merchants.filter((x) => x.id !== 'npc_borin_stonefist')) expect([m.id, pack.merchants[m.id]?.services]).toEqual([m.id, ['buy', 'sell']]);
  });

  test('every stocked and pooled item exists and may be sold (rule 20: no quest-bound or unsellable stock); each merchant is a source of what it stocks', () => {
    for (const m of Object.values(pack.merchants)) {
      for (const id of [...m.stock.map((e) => e.itemId), ...(m.rollStock?.pool ?? [])]) {
        expect([m.id, id, pack.items[id] !== undefined]).toEqual([m.id, id, true]);
        expect([m.id, id, item(id).sellable, item(id).type === 'quest']).toEqual([m.id, id, true, false]);
      }
    }
    const report = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.warnings.filter((w) => w.rule === 'rule-20')).toEqual([]);
    expect(report.errors).toEqual([]);
    // WORLD §7's Sources column for the items every stall stocks: the stall is listed (the one exception is the Salt Charm, Anso's unnamed charm)
    for (const m of Object.values(pack.merchants)) {
      for (const e of m.stock) if (!item(e.itemId).sources.includes(`merchant:${m.id}`)) expect([m.id, e.itemId, 'sources']).toEqual([m.id, e.itemId, 'missing']);
    }
  });

  test('Glow Moss (10 g base) is core stock at every merchant, unconditional (§9.4 rule 1: never soft-locked by poverty)', () => {
    expect(item('item_glow_moss').value).toBe(10);
    for (const m of Object.values(pack.merchants)) {
      expect([m.id, m.stock.some((e) => e.itemId === 'item_glow_moss' && e.when === undefined && e.count !== 'unlimited' && e.count >= 3)]).toEqual([m.id, true]);
    }
    expect(WORLD).toContain('Glow Moss (10 g base) is core stock at every merchant');
  });

  test('Hollis: the Veil Sigil is 30 g flat (the Veil tithe) and the Void Shards are priced at twice their value, "expensive" (DESIGN §9 in U8)', () => {
    const hollis = pack.merchants.npc_hollis_cade as Merchant;
    expect(hollis.stock.find((e) => e.itemId === 'item_void_shard')?.priceMult).toBe(2);
    expect(hollis.stock.find((e) => e.itemId === 'item_veil_sigil')).toMatchObject({ count: 1, priceMult: 5 / 6 });
    expect(WORLD).toContain('`item_veil_sigil` ×1 (30 g flat, the Veil tithe)');
    expect(item('item_veil_sigil').value * hollis.regionMarkup * (hollis.stock.find((e) => e.itemId === 'item_veil_sigil')?.priceMult ?? 1)).toBeCloseTo(30, 9);
    expect(canon(hollis.refusesWhen)).toBe(canon({ not: { any: [{ rep: { faction: 'weavers', min: pack.config.repTiers.neutral } }, { corruption: { min: 3 } }] } }));
    expect(WORLD).toContain('Trades only if Weavers ≥ Neutral **or** Corruption ≥ 3');
  });

  test('every item id WORLD §9.2 names for a merchant is an item (a catalog id, no typo)', () => {
    const named = ids(section(WORLD, '### 9.2 Stock', '### 9.3 '), 'item').concat(ids(section(WORLD, '### 9.2 Stock', '### 9.3 '), 'mat'));
    for (const id of named) expect([id, pack.items[id] !== undefined]).toEqual([id, true]);
  });
});

// ---- the real engine: crafting ------------------------------------------------------------------------------------------------------

const profileAt = (loop = 1, over: Partial<Profile> = {}): Profile => freshProfile({ loopCounter: loop, ...over });

describe('Borin crafts every recipe in the real pack', () => {
  const PATTERN_OF: Record<string, string> = Object.fromEntries(WANT.filter((w) => w.read).map((w) => [w.id, w.read as string]));

  /** At the Emberforge, rich, Ironclad Trusted, with the inputs in the pack. */
  function atForge(w: Want, over: StateOverrides = {}, anyOfIndex = 0, profile: Profile = profileAt()): GameState {
    const bill = [...w.inputs, ...(w.anyOf[anyOfIndex] ?? [])];
    const patterns = PATTERN_OF[w.id] === undefined ? [] : [PATTERN_OF[w.id] as string];
    return makeState(
      {
        locationId: FORGE,
        gold: 5000,
        reputation: { ironclad: pack.config.repTiers.trusted },
        flags: { flag_shards_refused: true, flag_heartstone_stabilized: true },
        items: [...bill.map((i) => ({ itemId: i.itemId, qty: i.count })), ...patterns],
        patch: (s) => void s.echoesThisLoop.push('echo_hallows_ember', 'echo_anchor_schema'),
        ...over,
      },
      { content: pack, profile },
    );
  }
  const readPattern = (s: GameState, profile: Profile, pattern: string): GameState => {
    const uid = s.player.inventory.find((i) => i.itemId === pattern)?.uid ?? '';
    const out = step(s, { type: 'use', uid }, pack, profile);
    expect(out.events.filter((e) => e.t === 'actionRejected')).toEqual([]);
    return out.state;
  };

  test('each recipe quotes and crafts at Ironclad Trusted with its inputs: the fee, the inputs spent, the output in the pack at the right rarity and count', () => {
    for (const w of WANT) {
      const profile = profileAt();
      let s = atForge(w, {}, 0, profile);
      if (w.read) s = readPattern(s, profile, w.read);
      const quote = craftQuote(s, pack, profile, w.id);
      expect([w.id, typeof quote]).toEqual([w.id, 'object']);
      if (typeof quote === 'string') continue;
      expect([w.id, quote.fee, quote.rarity]).toEqual([w.id, w.gold, item(w.outputId).slot === undefined ? item(w.outputId).fixedRarity : 'common']);
      const out = step(s, { type: 'craft', recipeId: w.id }, pack, profile);
      expect([w.id, out.events.filter((e) => e.t === 'actionRejected')]).toEqual([w.id, []]);
      const held = out.state.player.inventory.filter((i) => i.itemId === w.outputId);
      expect([w.id, held.reduce((n, i) => n + i.qty, 0), held.every((i) => i.rarity === quote.rarity)]).toEqual([w.id, w.outputCount, true]);
      expect([w.id, out.state.player.gold]).toEqual([w.id, 5000 - w.gold]);
      for (const need of [...w.inputs, ...(w.anyOf[0] ?? [])]) {
        expect([w.id, need.itemId, out.state.player.inventory.filter((i) => i.itemId === need.itemId).reduce((n, i) => n + i.qty, 0)]).toEqual([w.id, need.itemId, 0]);
      }
    }
  });

  test('the Bell-Warden\'s Clapper comes out Common from the recipe although the item is a fixed Rare (U49\'s flag)', () => {
    const w = WANT.find((x) => x.id === 'recipe_bell_clapper') as Want;
    const quote = craftQuote(atForge(w), pack, profileAt(), w.id);
    expect(typeof quote === 'string' ? quote : quote.rarity).toBe('common');
    expect(item('item_bell_clapper').fixedRarity).toBe('rare');
  });

  test('the Breach-anchor takes the dead fragment when there is no stable one, costs nothing, and is Neutral while the Mending is the quest being played', () => {
    const w = WANT.find((x) => x.id === 'recipe_breach_anchor') as Want;
    const profile = profileAt();
    for (const index of [0, 1]) {
      const s = atForge(w, { gold: 0 }, index, profile);
      const quote = craftQuote(s, pack, profile, w.id);
      expect([index, typeof quote === 'string' ? quote : quote.fee]).toEqual([index, 0]);
      if (typeof quote !== 'string') expect(quote.pay.map((n) => n.itemId)).toContain(index === 0 ? 'item_heartstone_fragment_stable' : 'item_heartstone_fragment_dead');
    }
    // Ironclad Neutral: refused, until a quest of `repTierWhileActive` is active
    const neutral = atForge(w, { gold: 0, reputation: { ironclad: 0 } }, 0, profile);
    expect(String(craftQuote(neutral, pack, profile, w.id))).toContain('trusted');
    for (const quest of ['q_the_mending', 'q_iron_silence']) {
      const playing = clone(neutral);
      playing.quests[quest] = { status: 'active', startedDay: 1, endedDay: null, counters: {}, objectivesDone: [], stage: 'start' };
      expect([quest, recipeTier(playing, pack.recipes.recipe_breach_anchor as Recipe)]).toEqual([quest, 'neutral']);
      expect([quest, typeof craftQuote(playing, pack, profile, w.id)]).toEqual([quest, 'object']);
    }
    // without `echo_anchor_schema` (both halves' Echoes) the recipe is closed
    const noSchema = atForge(w, { patch: () => undefined }, 0, profile);
    expect(String(craftQuote(noSchema, pack, profile, w.id))).toContain('requires');
  });

  test('the void-forged line opens only in a loop where the Shards were refused, and only to a Trusted Ironclad standing or `echo_borin_oath`', () => {
    for (const id of ['recipe_voidforged_edge', 'recipe_voidforged_mail', 'recipe_voidforged_band']) {
      const w = WANT.find((x) => x.id === id) as Want;
      const open = (over: StateOverrides, profile: Profile = profileAt()) => typeof craftQuote(atForge(w, over, 0, profile), pack, profile, id) === 'object';
      expect([id, 'trusted + refused', open({})]).toEqual([id, 'trusted + refused', true]);
      expect([id, 'shards not refused', open({ flags: {} })]).toEqual([id, 'shards not refused', false]);
      expect([id, 'neutral, no oath', open({ reputation: { ironclad: 0 } })]).toEqual([id, 'neutral, no oath', false]);
      expect([id, 'neutral, oath', open({ reputation: { ironclad: 0 }, patch: (s) => void s.echoesThisLoop.push('echo_borin_oath') })]).toEqual([id, 'neutral, oath', true]);
    }
  });

  test('the Ley-tuned line needs the Heartstone Stabilized this loop; the four Ironclad-Trusted recipes need Trusted', () => {
    for (const id of ['recipe_ley_tuned_staff', 'recipe_ley_tuned_vestment', 'recipe_ley_tuned_charm', 'recipe_ley_tuned_tonic']) {
      const w = WANT.find((x) => x.id === id) as Want;
      expect([id, typeof craftQuote(atForge(w), pack, profileAt(), id)]).toEqual([id, 'object']);
      expect([id, typeof craftQuote(atForge(w, { flags: {} }), pack, profileAt(), id)]).toEqual([id, 'string']);
    }
    for (const id of ['recipe_emberwrought_blade', 'recipe_hallows_hammer', 'recipe_sunderforged_plate']) {
      const w = WANT.find((x) => x.id === id) as Want;
      const profile = profileAt();
      let s = atForge(w, { reputation: { ironclad: 0 } }, 0, profile);
      if (w.read) s = readPattern(s, profile, w.read);
      expect([id, String(craftQuote(s, pack, profile, id)).includes('trusted')]).toEqual([id, true]);
    }
  });

  test('a read pattern is needed: unread, Borin asks for it; read, the recipe opens (Hallow\'s Hammer also needs Hallow\'s ember)', () => {
    for (const w of WANT.filter((x) => x.read)) {
      const profile = profileAt();
      const s = atForge(w, {}, 0, profile);
      expect([w.id, String(craftQuote(s, pack, profile, w.id)).startsWith('Read the')]).toEqual([w.id, true]);
      const read = readPattern(s, profile, w.read as string);
      expect([w.id, typeof craftQuote(read, pack, profile, w.id)]).toEqual([w.id, 'object']);
    }
    const hammer = WANT.find((x) => x.id === 'recipe_hallows_hammer') as Want;
    const profile = profileAt();
    const noEmber = readPattern(atForge(hammer, { patch: () => undefined }, 0, profile), profile, hammer.read as string);
    expect(String(craftQuote(noEmber, pack, profile, hammer.id))).toContain('requires');
  });

  test('forge fee is the recipe\'s gold before Borin\'s Favor (no Attunement yet), and nothing in the table costs more than a Wayfinder can earn', () => {
    const s = atForge(WANT[1] as Want);
    for (const w of WANT) expect([w.id, forgeFee(s, pack, w.gold)]).toEqual([w.id, w.gold]);
    expect(Math.max(...WANT.map((w) => w.gold))).toBe(300);
  });
});

// ---- the real engine: the stalls ------------------------------------------------------------------------------------------------------------

describe('the stalls in the real pack (restock, prices, refusal)', () => {
  /** The stall after a restock, as the engine builds it for this state. */
  function stockAt(id: string, over: StateOverrides = {}, seed = 'u50', profile?: Profile): ItemInstance[] {
    const prof = profile ?? profileAt(over.loop ?? 1);
    const s = makeState({ seed, ...over }, { content: pack, profile: prof });
    const ctx = makeCtx(clone(s), prof, pack);
    restock(ctx, id);
    return ctx.s.merchants[id]?.stock ?? [];
  }
  const qty = (stock: ItemInstance[], id: string): number => stock.filter((i) => i.itemId === id).reduce((n, i) => n + i.qty, 0);
  const inPool = (id: string, itemId: string): boolean => poolOf(id).includes(itemId);

  test('Loop 1, Neutral: every stall shows its core, at least its listed count (a pool pick may add one unit); the Loop 2+ lines are absent', () => {
    for (const s of STALLS) {
      const stock = stockAt(s.id);
      for (const c of s.core) {
        const got = qty(stock, c.itemId);
        expect([s.id, c.itemId, inPool(s.id, c.itemId) ? got >= c.count : got === c.count]).toEqual([s.id, c.itemId, true]);
      }
      for (const c of s.loop2) expect([s.id, c.itemId, inPool(s.id, c.itemId) ? true : qty(stock, c.itemId)]).toEqual([s.id, c.itemId, inPool(s.id, c.itemId) ? true : 0]);
      // faction-gated stock stays shut at Neutral
      for (const t of s.trusted) expect([s.id, t.itemId, inPool(s.id, t.itemId) ? true : qty(stock, t.itemId)]).toEqual([s.id, t.itemId, inPool(s.id, t.itemId) ? true : 0]);
    }
  });

  test('Loop 2: Kaelen\'s Glyphbound Lantern (Common) and heartwood, Tamsin\'s Remnant Ink and Fennick\'s Heartwood Bow pattern appear', () => {
    const kaelen = stockAt('npc_kaelen_stonehand', { loop: 2 });
    expect([qty(kaelen, 'item_glyphbound_lantern'), qty(kaelen, 'mat_silverwood_heartwood')]).toEqual([1, 1]);
    expect(kaelen.find((i) => i.itemId === 'item_glyphbound_lantern')?.rarity).toBe('common');
    expect(qty(stockAt('npc_tamsin_reed', { loop: 2 }), 'item_remnant_ink')).toBe(2);
    expect(qty(stockAt('npc_old_fennick', { loop: 2 }), 'item_pattern_heartwood_bow')).toBe(1);
    expect(qty(stockAt('npc_old_fennick', { loop: 1 }), 'item_pattern_heartwood_bow')).toBe(0);
  });

  test('3–4 pool picks a day, distinct, drawn from the pool; the same seed and day show the same stall; Kaelen never offers the two excluded pieces', () => {
    for (const s of STALLS) {
      const m = pack.merchants[s.id] as Merchant;
      if (m.rollStock === undefined) continue;
      const pool = poolOf(s.id);
      const coreIds = new Set<string>(m.stock.filter((e) => e.when === undefined).map((e) => e.itemId));
      const coreInPool = pool.filter((p) => coreIds.has(p)).length;
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
        const stock = stockAt(s.id, {}, seed);
        // the picks that are not also core stock: distinct pool items, one unit each
        const picked = [...new Set(stock.map((i) => i.itemId).filter((id) => pool.includes(id) && !coreIds.has(id)))];
        for (const id of picked) expect([s.id, seed, id, qty(stock, id)]).toEqual([s.id, seed, id, 1]);
        const { min, max } = m.rollStock.pick;
        expect([s.id, seed, picked.length <= max, picked.length >= Math.min(min, pool.length) - coreInPool]).toEqual([s.id, seed, true, true]);
        expect(stockAt(s.id, {}, seed).map((i) => `${i.itemId}:${i.rarity}:${i.affixes.join('+')}`)).toEqual(stock.map((i) => `${i.itemId}:${i.rarity}:${i.affixes.join('+')}`));
      }
    }
    const seen = new Set<string>();
    for (let n = 0; n < 60; n++) for (const i of stockAt('npc_kaelen_stonehand', {}, `k${n}`)) seen.add(i.itemId);
    expect(seen.has('item_warriors_sword') || seen.has('item_shadow_kissed_dagger')).toBe(false);
    // every pooled piece can be drawn
    for (const id of pack.merchants.npc_kaelen_stonehand?.rollStock?.pool ?? []) expect([id, seen.has(id)]).toEqual([id, true]);
  });

  test('a Wary standing hides the pool and the faction gear; Trusted adds the Rare piece and the pattern; Sworn adds Hollis\'s thread and the shardglass', () => {
    const borin = (rep: number) => stockAt('npc_borin_stonefist', { reputation: { ironclad: rep } }, 'wary');
    const wary = borin(pack.config.repTiers.wary);
    expect(wary.filter((i) => inPool('npc_borin_stonefist', i.itemId) && !['item_whetstone_strip'].includes(i.itemId) && i.itemId !== 'item_ironclad_hammer').map((i) => i.itemId)).toEqual([]);
    expect(qty(wary, 'item_ironclad_hammer')).toBe(0);
    expect(qty(wary, 'mat_iron_rivet')).toBe(5);
    const trusted = borin(pack.config.repTiers.trusted);
    expect(trusted.some((i) => i.itemId === 'item_ironclad_hammer' && i.rarity === 'rare' && i.affixes.length === MAX_AFFIXES.rare)).toBe(true);
    const tessaly = stockAt('npc_tessaly_varr', { reputation: { ironclad: pack.config.repTiers.trusted } });
    expect(tessaly.some((i) => i.itemId === 'item_cinderhorn_plate' && i.rarity === 'rare')).toBe(true);
    expect(qty(tessaly, 'item_pattern_sunderforged_plate')).toBe(1);
    const hollisTrusted = stockAt('npc_hollis_cade', { reputation: { weavers: pack.config.repTiers.trusted } });
    expect([qty(hollisTrusted, 'item_veil_threadmail'), qty(hollisTrusted, 'item_pattern_breachglass_focus'), qty(hollisTrusted, 'mat_umbral_thread'), qty(hollisTrusted, 'item_nyxs_shardglass')]).toEqual([1, 1, 0, 0]);
    expect(hollisTrusted.some((i) => i.itemId === 'item_hollow_lantern_focus' && i.rarity === 'rare')).toBe(true);
    const sworn = stockAt('npc_hollis_cade', { reputation: { weavers: pack.config.repTiers.sworn } });
    expect([qty(sworn, 'mat_umbral_thread'), qty(sworn, 'item_nyxs_shardglass')]).toEqual([3, 1]);
    const carrying = stockAt('npc_hollis_cade', { reputation: { weavers: pack.config.repTiers.sworn }, items: [{ itemId: 'item_nyxs_shardglass', equip: true }] });
    expect(qty(carrying, 'item_nyxs_shardglass')).toBe(0);
  });

  test('Anso\'s Days 1–2 lines appear only in Silverwood Before, on its first two days', () => {
    const at = (day: 1 | 2 | 3 | undefined) => stockAt('npc_bellwright_anso', { loop: 2, patch: (s) => void (s.before = day === undefined ? null : { day, resets: 0 }) });
    for (const day of [1, 2] as const) {
      expect([day, qty(at(day), 'item_bell_shard'), qty(at(day), 'item_pattern_breachwarden_mail')]).toEqual([day, 1, 1]);
    }
    expect([qty(at(3), 'item_bell_shard'), qty(at(3), 'item_pattern_breachwarden_mail')]).toEqual([0, 0]);
    expect([qty(at(undefined), 'item_bell_shard'), qty(at(undefined), 'item_pattern_breachwarden_mail')]).toEqual([0, 0]);
  });

  test('prices (WORLD §9.1): value × markup × tier_mod; Wary ×1.15, Trusted ×0.90, Sworn ×0.80; the Void Shard is twice its value at Hollis and the Veil Sigil 30 g', () => {
    const priceAt = (merchantId: string, itemId: string, over: StateOverrides = {}): number => {
      const prof = profileAt();
      const s = makeState(over, { content: pack, profile: prof });
      const inst: ItemInstance = { uid: 'x', itemId, qty: 1, rarity: item(itemId).fixedRarity, affixes: [] };
      return buyPrice(s, pack, prof, pack.merchants[merchantId] as Merchant, inst);
    };
    const rep = pack.config.repTiers;
    // Borin (ironclad ×1.0): Glow Moss 10 g at Neutral; 12 at Wary (11.5 rounds up); 9 at Trusted; 8 at Sworn
    expect([rep.wary, 0, rep.trusted, rep.sworn].map((r) => priceAt('npc_borin_stonefist', 'item_glow_moss', { reputation: { ironclad: r } }))).toEqual([12, 10, 9, 8]);
    // §9.3: Tonic 12 g at Kaelen; Hardtack 10 g at Tessaly; Glow Moss 12 g at Hollis and at Anso (×1.2); Honeycake 36 g at Anso; Fenlight Salve 31 g at Fennick
    expect(priceAt('npc_kaelen_stonehand', 'item_ley_touched_tonic')).toBe(12);
    expect(priceAt('npc_tessaly_varr', 'item_nomad_hardtack')).toBe(10);
    expect([priceAt('npc_hollis_cade', 'item_glow_moss'), priceAt('npc_bellwright_anso', 'item_glow_moss'), priceAt('npc_bellwright_anso', 'item_silverwood_honeycake')]).toEqual([12, 12, 36]);
    expect(priceAt('npc_old_fennick', 'item_fenlight_salve')).toBe(31);
    for (const phrase of ['Glow Moss 12 g (Hollis ×1.2)', 'Glow Moss 12 g, Honeycake 36 g', 'Fenlight Salve 31 g', 'Hardtack 10 g', 'Tonic 12 g']) expect(WORLD).toContain(phrase);
    // Hollis: 2× for the Void Shard (20 g → 48 at ×1.2), 30 g flat for the Sigil
    expect(priceAt('npc_hollis_cade', 'item_void_shard')).toBe(48);
    expect(priceAt('npc_hollis_cade', 'item_veil_sigil')).toBe(30);
    // Kaelen\'s tier is the best of the three; Fennick and Anso have none
    expect(priceAt('npc_kaelen_stonehand', 'item_glow_moss', { reputation: { weavers: rep.sworn } })).toBe(8);
    expect(priceAt('npc_old_fennick', 'item_glow_moss', { reputation: { ironclad: rep.sworn } })).toBe(11);
  });

  test('WORLD §9.3\'s Drowned Reach and Glowlands rows quote base prices where the merchant\'s markup (×1.1) makes them dearer — reported, not tuned', () => {
    const prof = profileAt();
    const s = makeState({}, { content: pack, profile: prof });
    const price = (merchantId: string, itemId: string): number =>
      buyPrice(s, pack, prof, pack.merchants[merchantId] as Merchant, { uid: 'x', itemId, qty: 1, rarity: 'common', affixes: [] });
    // "4–8 Drowned Reach | Glow Moss 10 g, Brine 18 g | Sedge" and "8–12 Glowfen | Glow Moss 10 g, Fenlight Salve 31 g | Fennick": the salve is quoted
    // with the ×1.1 (31), the Moss and the Brine without it (11 and 20 are what the engine charges)
    expect(WORLD).toContain('Glow Moss 10 g, Brine 18 g');
    expect(WORLD).toContain('Glow Moss 10 g, Fenlight Salve 31 g');
    expect([price('npc_sedge_marrow', 'item_glow_moss'), price('npc_sedge_marrow', 'item_brine_draught'), price('npc_old_fennick', 'item_glow_moss'), price('npc_old_fennick', 'item_fenlight_salve')]).toEqual([11, 20, 11, 31]);
  });

  test('selling: 75% of the value, rounded down, whatever the tier (the quest-bound and unsellable are refused by the item flags)', () => {
    const merchant = pack.merchants.npc_kaelen_stonehand as Merchant;
    expect(sellPrice(pack, merchant, { uid: 'x', itemId: 'item_glow_moss', qty: 1, rarity: 'common', affixes: [] })).toBe(7);
    expect(sellPrice(pack, merchant, { uid: 'x', itemId: 'mat_silverwood_heartwood', qty: 1, rarity: 'common', affixes: [] })).toBe(30);
  });

  test('refusal: Hostile Ironclad shuts Borin, Tessaly; Hostile Remnants Tamsin and Sedge; Kaelen, Fennick and Anso never refuse; Hollis trades at Neutral or Corruption 3', () => {
    const refuses = (merchantId: string, over: StateOverrides): boolean => {
      const prof = profileAt();
      const s = makeState(over, { content: pack, profile: prof });
      return merchantRefusal(s, pack, prof, pack.merchants[merchantId] as Merchant) !== null;
    };
    const hostile = pack.config.repTiers.hostile;
    expect([
      refuses('npc_borin_stonefist', { reputation: { ironclad: hostile } }),
      refuses('npc_tessaly_varr', { reputation: { ironclad: hostile } }),
      refuses('npc_tamsin_reed', { reputation: { remnants: hostile } }),
      refuses('npc_sedge_marrow', { reputation: { remnants: hostile } }),
    ]).toEqual([true, true, true, true]);
    expect([
      refuses('npc_kaelen_stonehand', { reputation: { ironclad: hostile, remnants: hostile, weavers: hostile } }),
      refuses('npc_old_fennick', { reputation: { ironclad: hostile, remnants: hostile, weavers: hostile } }),
      refuses('npc_bellwright_anso', { reputation: { ironclad: hostile, remnants: hostile, weavers: hostile } }),
    ]).toEqual([false, false, false]);
    const neutralMin = pack.config.repTiers.neutral;
    expect([
      refuses('npc_hollis_cade', { reputation: { weavers: neutralMin - 1 } }),
      refuses('npc_hollis_cade', { reputation: { weavers: neutralMin - 1 }, corruption: 2 }),
      refuses('npc_hollis_cade', { reputation: { weavers: neutralMin - 1 }, corruption: 3 }),
      refuses('npc_hollis_cade', { reputation: { weavers: neutralMin } }),
      refuses('npc_hollis_cade', { reputation: { weavers: pack.config.repTiers.wary }, corruption: 3 }),
    ]).toEqual([true, true, false, false, false]);
    // A gap between the documents and the engine, reported by U50 (not tuned): WORLD §9.2 says Hollis "trades only if Weavers ≥ Neutral or
    // Corruption ≥ 3", but `merchantRefusal` refuses a Hostile faction tier before it reads `refusesWhen`, so a Hostile Weavers standing
    // with Corruption 3 is still turned away
    expect(refuses('npc_hollis_cade', { reputation: { weavers: hostile }, corruption: 3 })).toBe(true);
  });

  test('Kaelen\'s tier is the best of the three tracks, never below Wary', () => {
    const prof = profileAt();
    const kaelen = pack.merchants.npc_kaelen_stonehand as Merchant;
    const tier = (reputation: StateOverrides['reputation']) => merchantTier(makeState({ reputation }, { content: pack, profile: prof }), pack, kaelen);
    expect([tier({}), tier({ remnants: 25 }), tier({ weavers: 70 }), tier({ ironclad: -80, remnants: -80, weavers: -80 })]).toEqual(['neutral', 'trusted', 'sworn', 'wary']);
  });
});
