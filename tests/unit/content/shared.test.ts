// U40: the first real content — the five classes, the 19 statuses, the 12 affixes, the Ranger and Wizard trees and the
// starting kits' items — checked against the documents themselves. Every expectation below is read from DESIGN.md
// (§3.3, §4.5, §5.2–5.6, §7.3, §7.7) or the legacy Python (class intros) at test time, so a drive-by edit of either the
// content or the document fails here; the ability rows are also held field-for-field to the U26/U26b combat fixture
// (tests/unit/engine/combat/scripts.test.ts tests those rows against DESIGN and casts every one through the engine).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { elfAbilities } from '@content/abilities/elf';
import { itemAbilities } from '@content/abilities/items';
import { rangerAbilities } from '@content/abilities/ranger';
import { wardenAbilities } from '@content/abilities/warden';
import { weaverAbilities } from '@content/abilities/weaver';
import { wizardAbilities } from '@content/abilities/wizard';
import { buildContentPack, contentTables } from '@content/index';
import { amuletItems } from '@content/items/amulet';
import { starterItems } from '@content/items/starter';
import { affixes } from '@content/shared/affixes';
import { classes } from '@content/shared/classes';
import { statuses } from '@content/shared/statuses';
import { validateContent } from '@content/validate';
import { derive, newRun, resourceGain } from '@engine/index';
import { AbilitySchema, type Ability, type AbilityInput } from '@schema/ability';
import { AFFIX_SLOTS, AffixSlotEffectSchema, type AffixSlotEffect } from '@schema/affix';
import { ResourceEvent } from '@schema/class';
import type { Item, Passive } from '@schema/item';
import { CANONICAL_STATUSES, StatusModifiersSchema } from '@schema/status';
import { u26Abilities, u26bAbilities } from '@tests/fixtures/combatContent';
import { freshProfile } from '@tests/fixtures/helpers';
import { miniContentTables } from '@tests/fixtures/miniContent';
import { main as validateCli } from '../../../tools/validate-content';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');
const pack = buildContentPack();

/** The DESIGN text from the heading that starts with `from` up to the next heading that starts with `to`. */
function section(from: string, to: string): string {
  const start = DESIGN.indexOf(from);
  const end = DESIGN.indexOf(to, start + from.length);
  expect(start, from).toBeGreaterThanOrEqual(0);
  expect(end, to).toBeGreaterThan(start);
  return DESIGN.slice(start, end);
}
/** The cells of every table line of `text` whose first cell matches `first`. */
function rows(text: string, first: RegExp): string[][] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((cells) => first.test(cells[0] ?? ''));
}
const unquote = (cell: string): string => cell.replace(/`/g, '');
/** DESIGN numbers use the Unicode minus. */
const num = (s: string): number => Number(s.replace('−', '-').replace('+', ''));
const DAMAGE_TYPES = ['physical', 'fire', 'storm', 'ley', 'void', 'chrono'];

// ---- The pack ------------------------------------------------------------------------------------------------------------

describe('the real pack (U40 tables)', () => {
  test('builds, holds exactly the authored records, and is registered in contentTables', () => {
    expect(Object.keys(pack.classes)).toEqual(['ranger', 'wizard', 'elf', 'ironclad_warden', 'shadow_weaver']);
    expect(Object.keys(pack.statuses)).toEqual([...CANONICAL_STATUSES]);
    expect(Object.keys(pack.affixes)).toHaveLength(12);
    // U41 appended the other three trees, the Amulet's bolt and the Amulet (tests/unit/content/shared2.test.ts)
    const abilityRows = [...rangerAbilities, ...wizardAbilities, ...elfAbilities, ...wardenAbilities, ...weaverAbilities, ...itemAbilities];
    expect(Object.keys(pack.abilities)).toEqual(abilityRows.map((a) => a.id));
    expect(Object.keys(pack.items)).toEqual([...starterItems, ...amuletItems].map((i) => i.id));
    expect(contentTables.classes).toEqual(classes);
    expect(contentTables.statuses).toEqual(statuses);
    expect(contentTables.affixes).toEqual(affixes);
    expect(pack.index.abilitiesByClass.ranger).toHaveLength(15);
    expect(pack.index.abilitiesByClass.wizard).toHaveLength(15);
  });

  test('validates: no errors or warnings; strict mode leaves only the completeness counts of content not yet authored', () => {
    expect(validateContent(pack)).toEqual({ errors: [], warnings: [] });
    const strict = validateContent(pack, { strict: true, pending: true });
    expect(strict.errors).toEqual([]);
    expect(strict.warnings.every((w) => w.message.startsWith('pending — content not yet authored: '))).toBe(true);
    // all 19 statuses are here (rule 14 is quiet); U41 landed the three other trees and the Amulet's bolt, so rule 13 is quiet too
    expect(strict.warnings.filter((w) => w.rule === 'rule-14')).toEqual([]);
    expect(strict.warnings.filter((w) => w.rule === 'rule-13')).toEqual([]);
    // rule 21 no longer counts classes or statuses short
    expect(strict.warnings.filter((w) => w.rule === 'rule-21' && (w.table === 'classes' || w.table === 'statuses'))).toEqual([]);
  });

  test('`npm run validate` passes on the partial pack (counts pending while it has no locations)', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    expect(out.join('\n')).toMatch(/validate: ok — 0 errors, 0 warning\(s\), \d+ pending completeness check\(s\) \(the pack has no locations yet\)/);
  });
});

// ---- Classes ------------------------------------------------------------------------------------------------------------

const S33 = section('### 3.3 Class base stats', '### 3.4');
/** DESIGN §5.2–5.6, one section per class, keyed by class id. */
const CLASS_SECTIONS: Record<string, { name: string; text: string }> = Object.fromEntries(
  [...section('### 5.2 Ranger', '### 5.7').matchAll(/^### 5\.\d (.+) \(`([a-z_]+)`\)\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)].map((m) => [
    m[2] ?? '',
    { name: m[1] ?? '', text: m[3] ?? '' },
  ]),
);

describe('classes vs DESIGN §3.3 and §5.2–5.6', () => {
  test('five classes, named as their DESIGN sections, the legacy three marked legacy', () => {
    expect(Object.keys(CLASS_SECTIONS)).toEqual(Object.keys(pack.classes));
    for (const [id, { name }] of Object.entries(CLASS_SECTIONS)) expect([id, pack.classes[id]?.name]).toEqual([id, name]);
    expect(Object.values(pack.classes).filter((c) => c.legacy).map((c) => c.id)).toEqual(['ranger', 'wizard', 'elf']);
  });

  test('§3.3: base stats, growth and the level-1 maxima of every class', () => {
    const table = rows(S33, /^`[a-z_]+`$/);
    expect(table).toHaveLength(5);
    for (const [idCell = '', hp = '', mp = '', str = '', mag = '', agi = '', hpLvl = '', mpLvl = '', l1hp = '', l1mp = ''] of table) {
      const cls = pack.classes[unquote(idCell)];
      expect(cls, idCell).toBeDefined();
      if (!cls) continue;
      expect([cls.id, cls.baseStats]).toEqual([cls.id, { hp: num(hp), mp: num(mp), strength: num(str), magic: num(mag), agility: num(agi) }]);
      expect([cls.id, cls.growth]).toEqual([cls.id, { hp: num(hpLvl), mp: num(mpLvl) }]);
      // L1 max HP = base + 2·STR, max MP = base + 2·MAG (DESIGN §3.2); every class sums to 24 primary points
      expect([cls.id, cls.baseStats.hp + 2 * cls.baseStats.strength, cls.baseStats.mp + 2 * cls.baseStats.magic]).toEqual([cls.id, num(l1hp), num(l1mp)]);
      expect(cls.baseStats.strength + cls.baseStats.magic + cls.baseStats.agility).toBe(24);
    }
  });

  test('§3.3 reference table: HP/MP at levels 4, 8, 12, 16 and 20 before stat points and gear', () => {
    const table = rows(S33, /^(ranger|wizard|elf|ironclad_warden|shadow_weaver)$/);
    expect(table).toHaveLength(5);
    for (const [id = '', ...cells] of table) {
      const cls = pack.classes[id];
      if (!cls) throw new Error(id);
      cells.forEach((cell, i) => {
        const level = [4, 8, 12, 16, 20][i] ?? 0;
        const hp = cls.baseStats.hp + cls.growth.hp * (level - 1) + 2 * cls.baseStats.strength;
        const mp = cls.baseStats.mp + cls.growth.mp * (level - 1) + 2 * cls.baseStats.magic;
        expect([id, level, `${hp}/${mp}`]).toEqual([id, level, cell]);
      });
    }
  });

  test('§5.2–5.6: the three branches in DESIGN order (the Branch column of each tree)', () => {
    for (const [id, { text }] of Object.entries(CLASS_SECTIONS)) {
      const names = [...new Set(rows(text, /^`[a-z]+_/).map((r) => r[2] ?? ''))];
      const cls = pack.classes[id];
      expect([id, cls?.branches.map((b) => [b.id, b.name])]).toEqual([id, names.map((n) => [n.toLowerCase().replace(/ /g, '_'), n])]);
    }
  });

  test('§5.2–5.6 resources: what each event yields, through the engine (Wizard 3 + ⌊level/4⌋: 3 at L1, 6 at L12, 8 at L20)', () => {
    // [class, the DESIGN *Resource.* wording this restates, the resource name, the yield per event at level 1]
    const RESOURCES: [string, string, string, Partial<Record<string, number>>][] = [
      ['ranger', '+8 MP per basic-attack hit (+12 on crit), +5 per Guard', 'Focus', { basic_hit: 8, basic_crit: 12, guard: 5 }],
      ['wizard', 'Mana regenerates **`3 + ⌊level/4⌋` MP at the start of each of your turns**', 'Mana', { turn_start: 3, guard: 5 }],
      ['elf', '+10 when an attack against you misses or is Phased, +6 on each of your crits', 'Mana', { dodge: 10, crit: 6, guard: 5 }],
      ['ironclad_warden', '+6 MP each time you are hit by an enemy action, +8 per Guard (replaces the universal +5), +4 per enemy Taunted by Challenge', 'Grit', { hit_taken: 6, guard: 8, taunt: 4 }],
      ['shadow_weaver', '`2 HP per missing MP`', 'Mana', { guard: 5 }],
    ];
    for (const [id, wording, name, yields] of RESOURCES) {
      const cls = pack.classes[id];
      if (!cls) throw new Error(id);
      expect(CLASS_SECTIONS[id]?.text, id).toContain(wording);
      expect([id, cls.resource.name]).toEqual([id, name]);
      for (const on of ResourceEvent.options) expect([id, on, resourceGain(cls, on, 1, pack.config)]).toEqual([id, on, yields[on] ?? 0]);
    }
    const wizard = pack.classes.wizard;
    if (!wizard) throw new Error('wizard');
    expect([1, 4, 8, 12, 16, 20].map((level) => resourceGain(wizard, 'turn_start', level, pack.config))).toEqual([3, 4, 5, 6, 7, 8]);
    expect(pack.classes.shadow_weaver?.resource.bloodPrice).toEqual({ hpPerMp: 2 });
    expect(Object.values(pack.classes).filter((c) => c.resource.bloodPrice).map((c) => c.id)).toEqual(['shadow_weaver']);
  });

  test('§5.2–5.6 starting kits: items, counts, the weapon (and the Warden\'s harness) equipped, 30 gold, no ability yet', () => {
    const byName = new Map(Object.values(pack.items).map((i) => [i.name, i]));
    for (const [id, { text }] of Object.entries(CLASS_SECTIONS)) {
      const kit = /\*Starting kit\.\* (.+)$/m.exec(text)?.[1] ?? '';
      const parts = kit.replace(/\.$/, '').replace(/\s*\([^)]*\)/g, '').split(', ');
      const gold = parts.map((p) => /^(\d+) gold$/.exec(p)?.[1]).find((g) => g !== undefined);
      const wanted = parts
        .filter((p) => !/gold$/.test(p))
        .map((p) => {
          const [, name = '', count = '1'] = /^(.+?)(?: ×(\d+))?$/.exec(p) ?? [];
          const item = byName.get(name);
          expect([id, name, item !== undefined]).toEqual([id, name, true]);
          return { itemId: item?.id, equip: item?.type === 'weapon' || item?.type === 'armor', count: Number(count) };
        });
      const cls = pack.classes[id];
      expect([id, cls?.starterItems]).toEqual([id, wanted]);
      expect([id, cls?.startingGold]).toEqual([id, Number(gold)]);
      expect([id, cls?.startingAbilities]).toEqual([id, []]);
    }
  });

  test('a fresh run of each class: the §3.3 level-1 maxima, the kit weapon in hand, 1 AP to spend', () => {
    const l1 = new Map(rows(S33, /^`[a-z_]+`$/).map((r) => [unquote(r[0] ?? ''), [num(r[8] ?? ''), num(r[9] ?? '')]]));
    for (const cls of Object.values(pack.classes)) {
      const s = newRun('u40', cls.id, pack, freshProfile());
      const d = derive(s.player, pack);
      expect([cls.id, s.player.hpMax, s.player.mpMax, d.hpMax, d.mpMax]).toEqual([cls.id, ...(l1.get(cls.id) ?? []), ...(l1.get(cls.id) ?? [])]);
      const weapon = cls.starterItems.find((k) => pack.items[k.itemId]?.type === 'weapon');
      expect([cls.id, s.player.equipment.weapon?.itemId]).toEqual([cls.id, weapon?.itemId]);
      expect([cls.id, s.player.gold, s.player.apHalf, s.player.abilitiesUnlocked]).toEqual([cls.id, 30, 2, []]);
    }
    expect(newRun('u40', 'ironclad_warden', pack, freshProfile()).player.equipment.armor?.itemId).toBe('item_scrap_harness');
  });

  test('intros: the legacy class-select lines kept word for word for Ranger, Wizard and Elf (D-001)', () => {
    const py = fs.readFileSync(path.join(ROOT, 'legacy/echoes_of_aethelgard.py'), 'utf8');
    for (const [id, legacyName] of [['ranger', 'Ranger'], ['wizard', 'Wizard'], ['elf', 'Elf']] as const) {
      const block = new RegExp(`"${legacyName}": \\{[\\s\\S]*?"intro": \\(([\\s\\S]*?)\\),`).exec(py)?.[1] ?? '';
      const intro = [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join('');
      expect(intro.length).toBeGreaterThan(20);
      expect([id, pack.classes[id]?.intro]).toEqual([id, intro]);
    }
  });
});

// ---- Abilities ------------------------------------------------------------------------------------------------------------

interface DesignRow {
  id: string;
  name: string;
  branch: string;
  tier: number;
  mp: number;
  target: string;
  type: string;
  power: string;
  status: string;
  cd: number;
  description: string;
}

/** Every ability row of a class's DESIGN tree (the U26b reader, plus name and description). */
function designRows(classId: string): DesignRow[] {
  return rows(CLASS_SECTIONS[classId]?.text ?? '', /^`[a-z]+_/).map(([id = '', name = '', branch = '', tier = '', mp = '', target = '', type = '', power = '', status = '', cd = '', description = '']) => ({
    id: unquote(id),
    name,
    branch: branch.toLowerCase().replace(/ /g, '_'),
    tier: Number(tier),
    mp: Number(mp),
    target,
    type: type.toLowerCase(),
    power,
    status,
    cd: cd === '—' ? 0 : Number(cd),
    description,
  }));
}

const TARGETS: Readonly<Record<string, Ability['target']>> = { single: 'enemy', self: 'self', 'self/ally': 'self_or_ally', all: 'all_enemies', party: 'party' };
/** Statuses a special applies itself (specials.ts): a row may name them without a status row. */
const SPECIAL_STATUS: Readonly<Record<string, string>> = { rewind: 'status_rewind', phase: 'status_phase', taunt: 'status_taunt' };

/** The first `a·STAT (+ b)` of a cell, with a leading "N hits ×" (U26b). */
function formula(cell: string): { coef: number; stat: string; base: number; hits: number } | null {
  const m = /(?:(\d+) hits × )?`(?:(\d+(?:\.\d+)?) \+ )?(\d+(?:\.\d+)?)·(ATK|SP)(?: \+ (\d+(?:\.\d+)?))?`/.exec(cell);
  if (!m) return null;
  return { hits: Number(m[1] ?? 1), coef: Number(m[3]), stat: (m[4] ?? '').toLowerCase(), base: Number(m[5] ?? m[2] ?? 0) };
}

/** "Flavor line. (defensive, `field`)" → the line and its role tags. */
function splitDescription(cell: string): { flavor: string; tags: string[] } {
  const m = /^(.*?)\s*\(([^()]*)\)$/.exec(cell);
  if (!m) return { flavor: cell, tags: [] };
  return { flavor: m[1] ?? '', tags: (m[2] ?? '').split(/[,/]/).map((t) => unquote(t).trim()) };
}

const TREES = { ranger: rangerAbilities, wizard: wizardAbilities } as const;
/** DESIGN marks these `field`, but the effect language cannot express their road use yet (reported to the lead). */
const FIELD_GAPS: Readonly<Record<string, string>> = { wiz_rewind: 'no out-of-combat snapshot or cleanse effect' };

describe('the Ranger and Wizard trees vs DESIGN §5.2–5.3', () => {
  for (const [classId, tree] of Object.entries(TREES)) {
    const ROWS = designRows(classId);

    test(`${classId}: the 15 rows, in DESIGN order — name, branch, tier, MP, cooldown, target, level gate and AP cost`, () => {
      expect(ROWS).toHaveLength(15);
      expect(tree.map((a) => a.id)).toEqual(ROWS.map((r) => r.id));
      for (const r of ROWS) {
        const a = pack.abilities[r.id] as Ability;
        expect([r.id, a.ownerId, a.name, a.branch, a.tier, a.mp, a.cooldown, a.target]).toEqual([r.id, classId, r.name, r.branch, r.tier, r.mp, r.cd, TARGETS[r.target]]);
        expect([r.id, a.levelReq, a.costHalf]).toEqual([r.id, [1, 4, 8, 12, 16][r.tier - 1], r.tier === 5 ? 4 : 2]);
      }
    });

    test(`${classId}: damage type, power, heal, Shield, self-cost, kill refund and every status the row names`, () => {
      for (const r of ROWS) {
        const a = pack.abilities[r.id] as Ability;
        if (DAMAGE_TYPES.includes(r.type)) expect([r.id, a.damageType, a.power !== undefined]).toEqual([r.id, r.type as Ability['damageType'], true]);
        if (r.type === 'heal') expect([r.id, a.heal !== undefined]).toEqual([r.id, true]);
        if (r.type === '—') expect([r.id, a.damageType === undefined || a.special === 'counter_stance']).toEqual([r.id, true]);
        const f = DAMAGE_TYPES.includes(r.type) ? formula(r.power) : null;
        if (f) expect([r.id, a.power?.coef, a.power?.stat, a.power?.base, a.power?.hits]).toEqual([r.id, f.coef, f.stat as 'atk' | 'sp', f.base, f.hits]);
        const shield = /Shield `(?:(\d+) \+ )?(\d+(?:\.\d+)?)·(SP|ATK)(?: \+ (\d+))?`(?:, (\d+) turns)?/.exec(r.power + r.status);
        if (shield) {
          expect([r.id, a.shield?.base, a.shield?.coef, a.shield?.stat]).toEqual([r.id, Number(shield[1] ?? shield[4] ?? 0), Number(shield[2]), (shield[3] ?? '').toLowerCase() as 'sp' | 'atk']);
          if (shield[5] !== undefined) expect([r.id, a.shield?.turns]).toEqual([r.id, Number(shield[5])]);
        } else expect([r.id, a.shield]).toEqual([r.id, undefined]);
        const heal = r.type === 'heal' ? /`(\d+) \+ (\d+(?:\.\d+)?)·(SP|ATK|max\(STR,AGI\))`/.exec(r.power) : null;
        if (heal) expect([r.id, a.heal?.base, a.heal?.coef, a.heal?.stat]).toEqual([r.id, Number(heal[1]), Number(heal[2]), ({ SP: 'sp', ATK: 'atk' } as const)[heal[3] as 'SP' | 'ATK'] ?? 'maxStrAgi']);
        const pct = /costs (\d+)% (?:of your )?max HP/.exec(r.power + r.status);
        expect([r.id, a.selfCost?.hpPctMax]).toEqual([r.id, pct ? Number(pct[1]) / 100 : undefined]);
        const refund = /refunds (\d+) MP/.exec(r.power);
        expect([r.id, a.onKill?.refundMp]).toEqual([r.id, refund ? Number(refund[1]) : undefined]);
        expect([r.id, a.interrupt]).toEqual([r.id, /interrupt/.test(r.power + r.status)]);
        expect([r.id, a.power?.ignoresArmor ?? false]).toEqual([r.id, /ignores armor/.test(r.power)]);
        for (const m of `${r.power} ${r.status}`.matchAll(/`(status_[a-z_]+)`(?: (\d+)%)?(?:,? (\d+)(?![%·\d.]))?/g)) {
          const [, id = '', chance, turns] = m;
          const row = a.statuses.find((st) => st.status === id);
          const bySpecial = a.special !== undefined && SPECIAL_STATUS[a.special] === id;
          expect([r.id, id, row !== undefined || bySpecial]).toEqual([r.id, id, true]);
          if (row && chance !== undefined) expect([r.id, id, row.chance]).toEqual([r.id, id, Number(chance) / 100]);
          if (row && turns !== undefined) expect([r.id, id, row.duration]).toEqual([r.id, id, Number(turns)]);
        }
      }
    });

    test(`${classId}: flavor is DESIGN's description line, tags its role notes; \`field\` rows work on the road`, () => {
      for (const r of ROWS) {
        const a = pack.abilities[r.id] as Ability;
        const { flavor, tags } = splitDescription(r.description);
        expect([r.id, a.flavor, a.tags]).toEqual([r.id, flavor, tags]);
        expect(a.description.length).toBeGreaterThan(20);
        const field = a.tags.includes('field');
        if (FIELD_GAPS[r.id] === undefined) expect([r.id, a.outOfCombat.length > 0 || a.special === 'trap']).toEqual([r.id, field || a.special === 'trap']);
        else expect([r.id, field, a.outOfCombat]).toEqual([r.id, true, []]);
      }
    });
  }

  test('Field Dressing on the road heals its in-fight formula at the Ranger\'s base STR: 18 + 0.8·10 = 26', () => {
    const a = pack.abilities.rgr_field_dressing as Ability;
    const str = pack.classes.ranger?.baseStats.strength ?? 0;
    expect(a.outOfCombat).toEqual([{ heal: { hp: (a.heal?.base ?? 0) + (a.heal?.coef ?? 0) * str } }]);
  });

  test('every mechanical field equals the U26/U26b combat fixture rows (cast through the engine in scripts.test.ts)', () => {
    const fixture = new Map<string, AbilityInput>([...miniContentTables.abilities, ...u26Abilities, ...u26bAbilities].map((a) => [a.id, a]));
    // Text, role tags and the road use are this unit's; everything the engine resolves must be the fixture's.
    const mechanics = (input: AbilityInput) => {
      const { description: _d, flavor: _f, tags: _t, notes: _n, outOfCombat: _o, ...rest } = AbilitySchema.parse(input);
      return rest;
    };
    for (const a of [...rangerAbilities, ...wizardAbilities]) {
      const twin = fixture.get(a.id);
      expect([a.id, twin !== undefined]).toEqual([a.id, true]);
      if (twin) expect(mechanics(a)).toEqual(mechanics(twin));
    }
  });
});

// ---- Statuses -------------------------------------------------------------------------------------------------------------

const S45 = section('### 4.5 Status effects', '### 4.6');

/** The flat modifiers DESIGN §4.5's "Numeric effect" column states, each with the wording it is read from. */
const MODIFIERS: Readonly<Record<string, [string[], Record<string, unknown>]>> = {
  status_shock: [['−15 accuracy'], { accuracyFlat: -15 }],
  status_slow: [['−5 initiative, −10 evasion, cannot flee'], { initiativeFlat: -5, evasionFlat: -10, blockActions: ['flee'] }],
  status_haste: [['+5 initiative, +10 evasion'], { initiativeFlat: 5, evasionFlat: 10 }],
  status_stun: [['loses its next action'], { skipTurn: true }],
  status_weaken: [['deals −25% damage'], { outgoingPct: -0.25 }],
  status_armor_break: [['armor and ward treated as 0'], { armorWardZero: true }],
  status_mark: [['takes +15% damage'], { incomingPct: 0.15 }],
  status_curse: [['healing received ×0.5'], { healingPct: -0.5 }],
  status_taunt: [['target the taunter'], { forcedTargetUidFromSource: true }],
  status_blind: [['−30 accuracy'], { accuracyFlat: -30 }],
};
const BUFFS = ['status_haste', 'status_shield', 'status_regen', 'status_phase', 'status_rewind', 'status_rested'];

describe('statuses vs DESIGN §4.5', () => {
  test('all 19 (the 18 of the table and Rested), named as DESIGN names them', () => {
    const table = rows(S45, /^`status_/);
    expect(table.map((r) => unquote(r[0] ?? ''))).toEqual(CANONICAL_STATUSES.filter((id) => id !== 'status_rested'));
    for (const [id = '', name = ''] of table) expect([id, pack.statuses[unquote(id)]?.name]).toEqual([id, name]);
    expect(pack.statuses.status_rested?.name).toBe('Rested');
  });

  test('default duration, stacking, tick timing and the DoT formulas (damage type, per stack)', () => {
    for (const [idCell = '', , duration = '', stacking = '', timing = '', effect = ''] of rows(S45, /^`status_/)) {
      const s = pack.statuses[unquote(idCell)];
      if (!s) throw new Error(idCell);
      expect([s.id, s.defaultDuration]).toEqual([s.id, Number(/^(\d+)/.exec(duration)?.[1])]);
      const stacks = /^up to (\d+) stacks/.exec(stacking);
      expect([s.id, s.stackable, s.maxStacks]).toEqual([s.id, stacks !== null, stacks ? Number(stacks[1]) : 1]);
      expect([s.id, s.tick?.timing]).toEqual([s.id, /^start of/.test(timing) ? 'turn_start' : undefined]);
      const dot = /`round\((\d+) \+ ([\d.]+)·source\.(ATK|SP)\)`/.exec(effect);
      if (dot) {
        const first = (/^(\w+)/.exec(effect)?.[1] ?? '').toLowerCase();
        expect([s.id, s.tick?.damage]).toEqual([
          s.id,
          { base: Number(dot[1]), coef: Number(dot[2]), stat: (dot[3] ?? '').toLowerCase() as 'atk' | 'sp', perStack: /per stack/.test(effect), type: DAMAGE_TYPES.includes(first) ? (first as 'physical') : undefined },
        ]);
      } else expect([s.id, s.tick?.damage]).toEqual([s.id, undefined]);
    }
    expect(pack.statuses.status_poison?.tick?.damage?.type).toBeUndefined(); // untyped: ignores resistances
    expect(pack.statuses.status_regen?.tick?.heal).toEqual({ flat: 0, pctMaxHp: 0 }); // the heal is the application's
  });

  test('the flat modifiers of the Numeric effect column; buffs and debuffs; Phase spent by a hit', () => {
    const effects = new Map(rows(S45, /^`status_/).map((r) => [unquote(r[0] ?? ''), r[5] ?? '']));
    for (const s of Object.values(pack.statuses)) {
      const [wording, mods] = MODIFIERS[s.id] ?? [[], {}];
      for (const w of wording) expect([s.id, effects.get(s.id)?.toLowerCase().includes(w.toLowerCase())]).toEqual([s.id, true]);
      if (s.id !== 'status_rested') expect([s.id, s.modifiers]).toEqual([s.id, StatusModifiersSchema.parse(mods)]);
      expect([s.id, s.kind]).toEqual([s.id, BUFFS.includes(s.id) ? 'buff' : 'debuff']);
      expect([s.id, s.expiresOn]).toEqual([s.id, s.id === 'status_phase' ? ['hit_taken', 'turn'] : ['turn']]);
      expect(s.description.length).toBeGreaterThan(5);
    }
    // §4.5 / §9.5: Rested is +2 initiative and +5 accuracy for the first fight of the day
    expect(S45).toContain('`status_rested` (inn rest: +2 initiative, +5 accuracy for the first fight of the day');
    expect(pack.statuses.status_rested?.modifiers).toEqual(StatusModifiersSchema.parse({ initiativeFlat: 2, accuracyFlat: 5 }));
    expect(pack.statuses.status_rested?.defaultDuration).toBe(1);
  });
});

// ---- Affixes --------------------------------------------------------------------------------------------------------------

/** What one DESIGN §7.3 cell means in the item vocabulary (several clauses are joined by ", "). */
function cellEffect(text: string): AffixSlotEffect {
  const stats: Record<string, number> = {};
  const resistSteps: string[] = [];
  const passives: Passive[] = [];
  const status = (name: string): `status_${string}` => `status_${name.toLowerCase().replace(/ /g, '_')}`;
  for (const clause of text.split(', ')) {
    let m: RegExpExecArray | null;
    if ((m = /^\+(\d+) (initiative|evasion|armor)$/.exec(clause))) stats[m[2] ?? ''] = Number(m[1]);
    else if ((m = /^\+(\d+) max MP$/.exec(clause))) stats.mpMax = Number(m[1]);
    else if ((m = /^\+(\d+)% max HP$/.exec(clause))) stats.hpMaxPct = Number(m[1]) / 100;
    else if ((m = /^\+(\d+) crit chance$/.exec(clause))) stats.crit = Number(m[1]);
    else if ((m = /^one (?:resistance )?step vs (\w+)$/.exec(clause))) resistSteps.push((m[1] ?? '').toLowerCase());
    else if ((m = /^\+(\d+)% (\w+) damage dealt$/.exec(clause))) passives.push({ kind: 'damageBonus', damageType: (m[2] ?? '').toLowerCase() as 'fire', pct: Number(m[1]) / 100 });
    else if ((m = /^(\d+)% chance on hit to (?:apply )?(\w+) \((\d+)\)$/.exec(clause))) passives.push({ kind: 'statusOnHit', status: status(m[2] ?? ''), chance: Number(m[1]) / 100, duration: Number(m[3]) });
    else if ((m = /^class resource generation \+(\d+)%$/.exec(clause))) passives.push({ kind: 'resourceGain', pct: Number(m[1]) / 100 });
    else if ((m = /^\+(\d+) MP regen per turn$/.exec(clause))) passives.push({ kind: 'regen', hp: 0, mp: Number(m[1]) });
    else if ((m = /^Guard reduces (\d+)%/.exec(clause))) passives.push({ kind: 'guardValue', pct: Number(m[1]) / 100 });
    else if ((m = /^basic attacks add (\d+)% of damage as (\w+)$/.exec(clause))) passives.push({ kind: 'custom', scriptId: 'basic_attack_rider', params: { damageType: (m[2] ?? '').toLowerCase(), pct: Number(m[1]) / 100 } });
    else if ((m = /^\+(\d+)% damage vs (.+)$/.exec(clause))) passives.push({ kind: 'custom', scriptId: 'damage_vs_status', params: { status: status((m[2] ?? '').replace(/ Broken$/, ' Break')), pct: Number(m[1]) / 100 } });
    else if ((m = /^reflect (\d+)% of melee damage taken as (\w+)$/.exec(clause))) passives.push({ kind: 'custom', scriptId: 'reflect_melee', params: { damageType: (m[2] ?? '').toLowerCase(), pct: Number(m[1]) / 100 } });
    else if ((m = /^\+(\d+)% XP from kills/.exec(clause))) passives.push({ kind: 'custom', scriptId: 'kill_xp', params: { pct: Number(m[1]) / 100 } });
    else throw new Error(`no reading for the DESIGN §7.3 clause '${clause}'`);
  }
  return AffixSlotEffectSchema.parse({ text, stats, resistSteps, passives });
}

describe('affixes vs DESIGN §7.3', () => {
  const table = rows(section('### 7.3 Affixes', '### 7.4'), /^`affix_/);

  test('the twelve, in DESIGN order, with their suffixes; only "of Echoes" is unique (not stackable)', () => {
    expect(table).toHaveLength(12);
    expect(affixes.map((a) => a.id)).toEqual(table.map((r) => unquote(r[0] ?? '')));
    for (const [id = '', suffix = '', ...cells] of table) {
      const affix = pack.affixes[unquote(id)];
      expect([id, affix?.suffix, affix?.unique]).toEqual([id, suffix, cells.some((c) => /not stackable/.test(c))]);
    }
  });

  test('each slot: absent exactly where DESIGN has "—"; the cell\'s words and what they mean in the item vocabulary', () => {
    for (const [idCell = '', , weapon = '', armor = '', trinket = ''] of table) {
      const affix = pack.affixes[unquote(idCell)];
      if (!affix) throw new Error(idCell);
      const cells: Record<(typeof AFFIX_SLOTS)[number], string> = { weapon, armor, trinket: trinket === 'both' ? `${weapon}, ${armor}` : trinket };
      for (const slot of AFFIX_SLOTS) {
        const cell = cells[slot];
        if (cell === '—') expect([affix.id, slot, affix[slot]]).toEqual([affix.id, slot, undefined]);
        else expect([affix.id, slot, affix[slot]]).toEqual([affix.id, slot, cellEffect(cell)]);
      }
    }
  });
});

// ---- The starting kits' items ---------------------------------------------------------------------------------------------

/** The numbers of a DESIGN item cell ("power 2, spell power 1, MP costs −10%", "+25 HP, +15 MP", "read: −15 HP, +1 Corruption"). */
function itemNumbers(cell: string) {
  const grab = (re: RegExp): number | undefined => {
    const m = re.exec(cell);
    return m ? num(m[1] ?? '') : undefined;
  };
  return {
    power: grab(/(?<!spell )power (−?\d+)/),
    spellPower: grab(/spell power (\d+)/),
    armor: grab(/armor (\d+)/),
    ward: grab(/ward (−?\d+)/),
    accuracy: grab(/accuracy (−?\d+)/),
    healHp: grab(/\+(\d+) HP/),
    healMp: grab(/\+(\d+) MP/),
    loseHp: grab(/−(\d+) HP/),
    corruption: grab(/\+(\d+) Corruption/),
    mpCostPct: grab(/MP costs −(\d+)%/),
  };
}

function expectNumbers(item: Item, cell: string): void {
  const n = itemNumbers(cell);
  if (item.type === 'weapon' || item.type === 'armor') {
    const { power, spellPower, armor, ward, accuracy } = item.stats;
    expect([item.id, { power, spellPower, armor, ward, accuracy }]).toEqual([
      item.id,
      { power: n.power ?? 0, spellPower: n.spellPower ?? 0, armor: n.armor ?? 0, ward: n.ward ?? 0, accuracy: n.accuracy ?? 0 },
    ]);
    const reduction = item.passives.find((p) => p.kind === 'mpCostReduction');
    expect([item.id, reduction?.kind === 'mpCostReduction' ? reduction.pct : undefined]).toEqual([item.id, n.mpCostPct === undefined ? undefined : n.mpCostPct / 100]);
  } else if (item.type === 'consumable') {
    expect([item.id, item.onUse]).toEqual([item.id, [{ heal: { hp: n.healHp, mp: n.healMp } }]]);
  } else {
    expect([item.id, item.onUse]).toEqual([item.id, [{ damage: { hp: n.loseHp } }, { corruption: n.corruption }]]);
  }
}

describe('the starting kits\' items vs DESIGN §7.7 and §5.5–5.6', () => {
  test('ten records, each in some class kit, none elsewhere in the pack yet', () => {
    const kits = new Set(Object.values(pack.classes).flatMap((c) => c.starterItems.map((s) => s.itemId)));
    expect(starterItems.map((i) => i.id).sort()).toEqual([...kits].sort());
  });

  test('the seven legacy items: §7.7 name (kept exactly), type, weapon type, tier, numbers and value', () => {
    const legacy = rows(section('### 7.7 Legacy items', '### 7.8'), /^[A-Z]/).filter((r) => /^`item_/.test(r[1] ?? ''));
    let seen = 0;
    const kitIds = new Set<string>(starterItems.map((i) => i.id));
    for (const [name = '', idCell = '', type = '', tier = '', numbers = '', value = ''] of legacy) {
      const item = pack.items[unquote(idCell)];
      if (!item || !kitIds.has(item.id)) continue; // the Amulet (quest item) is checked in shared2.test.ts
      seen += 1;
      const weaponType = /`([a-z_]+)`/.exec(type)?.[1];
      expect([item.id, item.name, item.legacyName, item.type, item.weaponType, item.tier, item.value]).toEqual([
        item.id, name, name, type.split(' ')[0], weaponType, /^T(\d)/.test(tier) ? Number(tier.slice(1, 2)) : 0, Number(/^(\d+)/.exec(value)?.[1]),
      ]);
      expectNumbers(item, numbers);
    }
    expect(seen).toBe(7);
  });

  test('the three new kit pieces: the numbers DESIGN gives in the Warden and Weaver kits', () => {
    const kitText = `${CLASS_SECTIONS.ironclad_warden?.text ?? ''}\n${CLASS_SECTIONS.shadow_weaver?.text ?? ''}`;
    for (const id of ['item_nomads_maul', 'item_scrap_harness', 'item_cracked_void_focus']) {
      const item = pack.items[id] as Item;
      const cell = new RegExp(`${item.name} \\(\`${id}\`, ([^)]*)\\)`).exec(kitText)?.[1];
      expect([id, cell !== undefined]).toEqual([id, true]);
      expectNumbers(item, cell ?? '');
      expect(item.legacyName).toBeUndefined();
    }
    expect(pack.items.item_nomads_maul?.weaponType).toBe('shield_heavy'); // "heavy" (DESIGN §5.7: the Warden kit's type)
    expect(pack.items.item_cracked_void_focus?.weaponType).toBe('void_focus');
  });
});
