// U41: shared content II — the Elf, Warden and Weaver trees (45 rows), the Amulet of Echoes and its Echo Bolt, and the six
// companions with their 24 abilities — checked against the documents themselves. Every expectation below is read from
// DESIGN.md (§5.4–5.7, §7.7, §12.1–12.8), WORLD.md (§4 NPC table, §7 item row) or STORY.md (§11.4 arc headings) at test time,
// so a drive-by edit of either the content or the document fails here; the class rows are also held field-for-field to the
// U26/U26b combat fixture, the companion rows to the U28 fixture (both are cast through the engine in their own tests).
//
// The companions and their 24 abilities are registered since D-111 (they were authored first and held back by D-088): their six
// NPCs are authored with the regions, while each companion's 3 arc quests and 3 camp scenes are pending references (D-090) until
// its unit writes them (U54 Ilyra and Brak, U55 Nyx and Dask, U56 Mireya and Caelum; the pins below hold in any landing order).
// A second pack of the real tables with stub NPC, quest, scene, region and location records (that exist only in this file)
// proves the records are complete once every outside id exists.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { companionAbilities } from '@content/abilities/companions';
import { consumableAbilities } from '@content/abilities/consumables';
import { elfAbilities } from '@content/abilities/elf';
import { itemAbilities } from '@content/abilities/items';
import { wardenAbilities } from '@content/abilities/warden';
import { weaverAbilities } from '@content/abilities/weaver';
import { buildContentPack, contentTables, parseContentPack, type ContentPack, type ContentReport, type ContentTables } from '@content/index';
import { questItems } from '@content/items/quest';
import { INCOMPLETE_TABLES } from '@content/progress';
import { companions } from '@content/shared/companions';
import { gameConfig } from '@content/shared/config';
import { validateContent } from '@content/validate';
import { COMPANION_SCRIPTS, DRAIN_SHARES, companionAllowedAt, derive, knownAbilities, newRun } from '@engine/index';
import { AbilitySchema, COMPANION_KIND_COOLDOWN, SCRIPTED_ABILITIES, type Ability, type AbilityInput } from '@schema/ability';
import { CompanionSchema, type CompanionInput } from '@schema/companion';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { LocationInput } from '@schema/location';
import type { NpcInput } from '@schema/npc';
import type { QuestInput } from '@schema/quest';
import type { RegionInput } from '@schema/region';
import { u26Abilities, u26bAbilities } from '@tests/fixtures/combatContent';
import { companionAbilities as companionFixture } from '@tests/fixtures/companionContent';
import { freshProfile } from '@tests/fixtures/helpers';
import { miniContentTables } from '@tests/fixtures/miniContent';
import { main as validateCli } from '../../../tools/validate-content';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const DESIGN = read('docs/DESIGN.md');
const STORY = read('docs/STORY.md');
const WORLD = read('docs/WORLD.md');
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
const DAMAGE_TYPES = ['physical', 'fire', 'storm', 'ley', 'void', 'chrono'];
const STAT = { ATK: 'atk', SP: 'sp' } as const;

// ---- The real pack ----------------------------------------------------------------------------------------------------------

const TREES = { elf: elfAbilities, ironclad_warden: wardenAbilities, shadow_weaver: weaverAbilities } as const;

describe('the real pack (U41 tables)', () => {
  test('all five classes now have their 15 abilities; the Amulet and its Echo Bolt are in; the six companions and their 24 comp_ abilities are registered (D-111)', () => {
    for (const classId of Object.keys(pack.classes)) expect([classId, pack.index.abilitiesByClass[classId]?.length]).toEqual([classId, 15]);
    for (const [classId, tree] of Object.entries(TREES)) {
      expect(tree).toHaveLength(15);
      expect(pack.index.abilitiesByClass[classId]).toEqual(tree.map((a) => a.id));
    }
    expect(Object.keys(pack.abilities)).toHaveLength(107); // 75 class abilities + itm_echo_bolt + the consumables' seven (U50) + the companions' 24 (D-111)
    expect(Object.keys(pack.abilities).filter((id) => !/^(rgr|wiz|elf|wrd|wvr)_/.test(id))).toEqual([
      'itm_echo_bolt',
      ...consumableAbilities.map((a) => a.id),
      ...companionAbilities.map((a) => a.id),
    ]);
    expect(Object.keys(pack.items)).toContain('item_amulet_of_echoes');
    expect(questItems.filter((i) => i.id === 'item_amulet_of_echoes')).toHaveLength(1);
    expect(itemAbilities.map((a) => a.id)).toEqual(['itm_echo_bolt']);
    // D-111: authored (D-088) and registered — the six records, in DESIGN order, and their 24 abilities in the table and the pack
    expect(companions).toHaveLength(6);
    expect(companionAbilities).toHaveLength(24);
    expect(contentTables.companions).toEqual(companions);
    expect(contentTables.abilities.filter((a) => a.id.startsWith('comp_'))).toEqual(companionAbilities);
    expect(Object.keys(pack.companions)).toEqual(companions.map((c) => c.id));
    expect(Object.keys(pack.abilities).filter((id) => id.startsWith('comp_'))).toEqual(companionAbilities.map((a) => a.id));
    expect(INCOMPLETE_TABLES).not.toContain('companions');
  });

  test('validates with no errors, and rule 13 (15 per class, itm_echo_bolt and its Amulet) has nothing pending', () => {
    // D-090 (U42+): the region tables' references into tables still being authored are pending; the only real warnings are
    // flags later units set (rule 2) and WORLD's out-of-band placements (rule 11), pinned in regions/silverwood_ruins.test.ts
    expect(validateContent(pack, { incompleteTables: INCOMPLETE_TABLES }).errors).toEqual([]);
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(strict.errors).toEqual([]);
    expect(strict.warnings.every((w) => w.message.startsWith('pending — content not yet authored') || w.rule === 'rule-02' || w.rule === 'rule-11')).toBe(true);
    expect(strict.warnings.filter((w) => w.rule === 'rule-13')).toEqual([]);
    // the Amulet's legacy name is there too (rule 22 counts it no more)
    expect(strict.warnings.filter((w) => w.rule === 'rule-22').map((w) => w.id)).not.toContain('item_amulet_of_echoes');
  });

  test('`npm run validate` shows 107 abilities (75 class + 8 item + 24 companion), 6 companions, 157 items (U49: 70 gear, U50: 87) and fewer pending checks than before', () => {
    const out: string[] = [];
    expect(validateCli([], (line) => out.push(line))).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/ items 157 · /);
    expect(text).toMatch(/ abilities 107 · /);
    expect(text).toMatch(/ companions 6 · /);
    expect(text).not.toContain('pending rule-13');
    // the companion counts (6 records, 24 abilities) are met: rule 21 has no pending line for either table
    expect(text).not.toMatch(/pending rule-21: (companions|abilities)\./);
    const pending = Number(/(\d+) pending completeness check/.exec(text)?.[1]);
    // 130 before this unit (U40's pack); without U51's rule 15/16 findings, the Echo grants and ending effects the quests and dialogue bring
    const waiting = [...text.matchAll(/pending rule-1[56]: (\d+) completeness/g)].reduce((n, m) => n + Number(m[1]), 0);
    expect(pending - waiting).toBeLessThan(130);
  });

  test('the companions\' open references: each companion is authored whole (its 3 arc quests and 3 camp scenes in the pack) or not at all (pending, D-090); their 6 NPCs point back', () => {
    for (const c of companions) expect([c.id, c.npcId, pack.npcs[c.npcId]?.companionId]).toEqual([c.id, `npc_${c.id}`, c.id]);
    expect([companions.flatMap((c) => c.arcQuestIds).length, companions.flatMap((c) => c.campScenes).length]).toEqual([18, 18]);
    // a companion whose unit has landed (U54: Ilyra and Brak; U55: Nyx and Dask; U56: Mireya and Caelum) has every reference in the pack
    const authored = (c: CompanionInput): boolean => c.arcQuestIds.every((q) => q in pack.quests) && c.campScenes.every((d) => d in pack.dialogues);
    const open = companions.filter((c) => !authored(c));
    for (const c of open) {
      for (const id of c.arcQuestIds) expect([c.id, id, id in pack.quests]).toEqual([c.id, id, false]);
      for (const id of c.campScenes) expect([c.id, id, id in pack.dialogues]).toEqual([c.id, id, false]);
    }
    // the open set only shrinks: at most the four U54 left (Nyx, Dask, Mireya, Caelum), and never Ilyra or Brak
    expect(open.every((c) => ['nyx', 'dask', 'mireya', 'caelum'].includes(c.id))).toBe(true);
    for (const id of ['ilyra', 'brak']) expect([id, authored(companions.find((c) => c.id === id) as CompanionInput)]).toEqual([id, true]);

    expect(parseContentPack().report.errors).toEqual([]);
    const strict = validateContent(pack, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(strict.errors).toEqual([]);
    const theirs = strict.warnings.filter((w) => w.table === 'companions' || (w.table === 'abilities' && w.id.startsWith('comp_')));
    // exactly the open companions' arc quests and camp scenes are pending references
    const pendingRefs = open.flatMap((c) => [
      ...c.arcQuestIds.map((q, i) => `${c.id}.arcQuestIds.${i}: pending — content not yet authored (reference): arc quest '${q}' not found in quests`),
      ...c.campScenes.map((d, i) => `${c.id}.campScenes.${i}: pending — content not yet authored (reference): camp scene '${d}' not found in dialogues`),
    ]);
    expect(theirs.filter((w) => w.rule === 'rule-01').map((w) => `${w.id}.${w.path}: ${w.message}`).sort()).toEqual([...pendingRefs].sort());
    // rule 18 counts the arcs' terminal outcomes, which the missing arc quests cannot give yet: one pending line per open companion
    expect(theirs.filter((w) => w.rule === 'rule-18').map((w) => [w.id, w.message])).toEqual(
      open.map((c) => [c.id, 'pending — content not yet authored: the arc quests have fewer than two distinct terminal outcomes']),
    );
    expect(theirs).toHaveLength(pendingRefs.length + open.length);
    expect(pendingRefs).toHaveLength(6 * open.length);
  });
});

// ---- The three trees --------------------------------------------------------------------------------------------------------

const CLASS_SECTIONS: Record<string, { name: string; text: string }> = Object.fromEntries(
  [...section('### 5.2 Ranger', '### 5.7').matchAll(/^### 5\.\d (.+) \(`([a-z_]+)`\)\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)].map((m) => [
    m[2] ?? '',
    { name: m[1] ?? '', text: m[3] ?? '' },
  ]),
);

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

/** Every ability row of a class's DESIGN tree. */
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

/** The first `a·STAT (+ b)` of a cell, with a leading "N hits ×". */
function formula(cell: string): { coef: number; stat: string; base: number; hits: number } | null {
  const m = /(?:(\d+) hits × )?`(?:(\d+(?:\.\d+)?) \+ )?(\d+(?:\.\d+)?)·(ATK|SP)(?: \+ (\d+(?:\.\d+)?))?`/.exec(cell);
  if (!m) return null;
  return { hits: Number(m[1] ?? 1), coef: Number(m[3]), stat: (m[4] ?? '').toLowerCase(), base: Number(m[5] ?? m[2] ?? 0) };
}

/** "Flavor line. (defensive, `field`)" → the line and its role tags. Hex of Frailty's "(defensive via Weaken)" is the tag `defensive`. */
function splitDescription(cell: string): { flavor: string; tags: string[] } {
  const m = /^(.*?)\s*\(([^()]*)\)$/.exec(cell);
  if (!m) return { flavor: cell, tags: [] };
  return { flavor: m[1] ?? '', tags: (m[2] ?? '').replace(/ via .*$/, '').split(/[,/]/).map((t) => unquote(t).trim()) };
}

/** DESIGN rows whose damage is dealt by an engine script, so the ability has a damage type and no `power` field. */
const NO_POWER_FIELD: Readonly<Record<string, string>> = { wvr_ninefold_hex: 'the spread script: each Cursed enemy deals 0.5·SP Void to every other enemy' };
/** `interrupt`, where DESIGN's wording is not the plain word: a boss "Stagger" is the interrupt (§4.2); Spellbreaker's is conditional and scripted. */
const INTERRUPT: Readonly<Record<string, boolean>> = { wrd_mountainfall: true, wrd_spellbreaker: false };
/** The ×mult DESIGN rows state (everything else has no `bonuses`). */
const BONUS: Readonly<Record<string, number>> = { elf_ambush: 1.5, wrd_executioners_arc: 1.5 };

/** What a ready-made kit leaves of the road use of a `field` heal: the formula at level-1 stats, floored (no stat-scaled heal effect). */
function kitStat(classId: string, stat: 'atk' | 'sp'): number {
  const cls = pack.classes[classId];
  if (!cls) throw new Error(classId);
  const weapon = cls.starterItems.map((k) => pack.items[k.itemId]).find((i) => i?.type === 'weapon');
  return stat === 'atk' ? cls.baseStats.strength + (weapon?.stats.power ?? 0) : cls.baseStats.magic + (weapon?.stats.spellPower ?? 0);
}

describe('the Elf, Warden and Weaver trees vs DESIGN §5.4–5.6', () => {
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
      // the class record names the same three branches, five tiers each
      const cls = pack.classes[classId];
      for (const b of cls?.branches ?? []) expect([classId, b.id, ROWS.filter((r) => r.branch === b.id).map((r) => r.tier)]).toEqual([classId, b.id, [1, 2, 3, 4, 5]]);
    });

    test(`${classId}: damage type, power, hits, heal, Shield, self-cost, kill refund, interrupt, bonuses and every status the row names`, () => {
      for (const r of ROWS) {
        const a = pack.abilities[r.id] as Ability;
        if (DAMAGE_TYPES.includes(r.type)) expect([r.id, a.damageType, a.power !== undefined]).toEqual([r.id, r.type as Ability['damageType'], NO_POWER_FIELD[r.id] === undefined]);
        if (r.type === 'heal') expect([r.id, a.heal !== undefined, a.damageType]).toEqual([r.id, true, undefined]);
        if (r.type === '—') expect([r.id, a.damageType]).toEqual([r.id, undefined]);
        const f = DAMAGE_TYPES.includes(r.type) && NO_POWER_FIELD[r.id] === undefined ? formula(r.power) : null;
        if (f) expect([r.id, a.power?.coef, a.power?.stat, a.power?.base, a.power?.hits]).toEqual([r.id, f.coef, f.stat as 'atk' | 'sp', f.base, f.hits]);
        expect([r.id, a.power?.ignoresArmor ?? false, a.power?.maxOf]).toEqual([r.id, false, undefined]);
        const shield = /Shield `(?:(\d+) \+ )?(\d+(?:\.\d+)?)·(SP|ATK)(?: \+ (\d+))?`(?:, (\d+) turns)?/.exec(r.power + r.status);
        if (shield) {
          expect([r.id, a.shield?.base, a.shield?.coef, a.shield?.stat]).toEqual([r.id, Number(shield[1] ?? shield[4] ?? 0), Number(shield[2]), (shield[3] ?? '').toLowerCase() as 'sp' | 'atk']);
          if (shield[5] !== undefined) expect([r.id, a.shield?.turns]).toEqual([r.id, Number(shield[5])]);
        } else expect([r.id, a.shield]).toEqual([r.id, undefined]);
        const heal = r.type === 'heal' ? /`(\d+) \+ (\d+(?:\.\d+)?)·(SP|ATK)`/.exec(r.power) : null;
        if (heal) expect([r.id, a.heal?.base, a.heal?.coef, a.heal?.stat]).toEqual([r.id, Number(heal[1]), Number(heal[2]), STAT[heal[3] as 'ATK' | 'SP']]);
        const pct = /(?:costs|pay) (\d+)% (?:of your )?max HP/.exec(r.power + r.status);
        expect([r.id, a.selfCost?.hpPctMax]).toEqual([r.id, pct ? Number(pct[1]) / 100 : undefined]);
        expect([r.id, a.selfCost?.hpPctCur]).toEqual([r.id, /costs (\d+)% of \*\*current\*\* HP/.test(r.power) ? 0.4 : undefined]);
        expect([r.id, a.selfCost?.hpPerHit]).toEqual([r.id, undefined]);
        const refund = /refunds? .*?(\d+) MP/.exec(r.power);
        expect([r.id, a.onKill?.refundMp]).toEqual([r.id, refund ? Number(refund[1]) : undefined]);
        expect([r.id, a.interrupt]).toEqual([r.id, INTERRUPT[r.id] ?? /interrupt/.test(r.power + r.status)]);
        const mult = /×(\d(?:\.\d+)?) (?:if|vs)/.exec(r.power);
        expect([r.id, a.bonuses.map((b) => b.mult)]).toEqual([r.id, BONUS[r.id] === undefined ? [] : [BONUS[r.id]]]);
        if (BONUS[r.id] !== undefined) expect([r.id, Number(mult?.[1])]).toEqual([r.id, BONUS[r.id]]);
        // every `status_…` the row names is a status row (or the special's own status) with DESIGN's chance and turns
        for (const m of `${r.power} ${r.status}`.matchAll(/`(status_[a-z_]+)`(?: (\d+)%)?(?:,? (\d+)(?![%·\d.]))?/g)) {
          const [, id = '', chance, turns] = m;
          const row = a.statuses.find((st) => st.status === id);
          const bySpecial = a.special !== undefined && SPECIAL_STATUS[a.special] === id;
          expect([r.id, id, row !== undefined || bySpecial]).toEqual([r.id, id, true]);
          if (row && chance !== undefined) expect([r.id, id, row.chance]).toEqual([r.id, id, Number(chance) / 100]);
          if (row && turns !== undefined) expect([r.id, id, row.duration]).toEqual([r.id, id, Number(turns)]);
        }
        // and no status row DESIGN does not name
        // (Doom Sigil's "Stun 1 if Cursed" names the status in words, not in backticks)
        for (const st of a.statuses) {
          const word = new RegExp(`\\b${st.status.replace(/^status_/, '').replace(/_/g, ' ')}\\b`, 'i');
          expect([r.id, st.status, `${r.power} ${r.status}`.includes(`\`${st.status}\``) || word.test(`${r.power} ${r.status}`)]).toEqual([r.id, st.status, true]);
        }
        expect([r.id, a.spell]).toEqual([r.id, a.damageType !== undefined && a.damageType !== 'physical' ? true : false]);
      }
    });

    test(`${classId}: flavor is DESIGN's description line, tags its role notes; \`field\` rows work on the road`, () => {
      for (const r of ROWS) {
        const a = pack.abilities[r.id] as Ability;
        const { flavor, tags } = splitDescription(r.description);
        expect([r.id, a.flavor, a.tags]).toEqual([r.id, flavor, tags]);
        expect(a.description.length).toBeGreaterThan(20);
        expect([r.id, a.outOfCombat.length > 0]).toEqual([r.id, a.tags.includes('field')]);
      }
    });
  }

  test('the scripted rows (SCRIPTED_ABILITIES) are exactly those with nothing to declare, and no unscripted row is empty', () => {
    const scripted = new Set<string>(SCRIPTED_ABILITIES);
    for (const a of [...elfAbilities, ...wardenAbilities, ...weaverAbilities] as AbilityInput[]) {
      const empty = a.power === undefined && a.heal === undefined && a.shield === undefined && (a.statuses ?? []).length === 0 && a.special === undefined;
      if (empty) expect([a.id, scripted.has(a.id)]).toEqual([a.id, true]);
    }
  });

  test('the road use of Ley Mend (Elf) and Steady Breath (Warden): their formula at the level-1 kit, floored — 22 and 20 HP', () => {
    const mend = pack.abilities.elf_ley_mend as Ability;
    const breath = pack.abilities.wrd_steady_breath as Ability;
    expect(mend.outOfCombat).toEqual([{ heal: { hp: Math.floor((mend.heal?.base ?? 0) + (mend.heal?.coef ?? 0) * kitStat('elf', 'sp')) } }]);
    expect(breath.outOfCombat).toEqual([{ heal: { hp: Math.floor((breath.heal?.base ?? 0) + (breath.heal?.coef ?? 0) * kitStat('ironclad_warden', 'atk')) } }]);
    expect([mend.outOfCombat, breath.outOfCombat]).toEqual([[{ heal: { hp: 22 } }], [{ heal: { hp: 20 } }]]);
    // the Warden's 17 ATK is STR 12 + the Nomad's Maul's 5; the Elf's 7 SP is MAG 7 + the bow's 0
    expect([kitStat('ironclad_warden', 'atk'), kitStat('elf', 'sp')]).toEqual([17, 7]);
  });

  test('every mechanical field equals the U26/U26b combat fixture rows (cast through the engine in scripts.test.ts); no row disagrees with DESIGN', () => {
    const fixture = new Map<string, AbilityInput>([...miniContentTables.abilities, ...u26Abilities, ...u26bAbilities].map((a) => [a.id, a]));
    // Text, role tags and the road use are this unit's; everything the engine resolves must be the fixture's.
    const mechanics = (input: AbilityInput) => {
      const { description: _d, flavor: _f, tags: _t, notes: _n, outOfCombat: _o, ...rest } = AbilitySchema.parse(input);
      return rest;
    };
    for (const a of [...elfAbilities, ...wardenAbilities, ...weaverAbilities, ...itemAbilities] as AbilityInput[]) {
      const twin = fixture.get(a.id);
      expect([a.id, twin !== undefined]).toEqual([a.id, true]);
      if (twin) expect(mechanics(a)).toEqual(mechanics(twin));
    }
  });

  test('two values DESIGN leaves open stay the fixture\'s: Silverwood Bloom\'s Regen 6 + 0.3·SP, Last Bastion\'s Shield for 2 turns', () => {
    const bloom = pack.abilities.elf_silverwood_bloom as Ability;
    expect(bloom.statuses.find((s) => s.status === 'status_regen')?.power).toEqual({ base: 6, coef: 0.3, stat: 'sp' });
    expect(DESIGN).toContain('`status_regen` 3 on both'); // DESIGN names no amount
    const bastion = pack.abilities.wrd_last_bastion as Ability;
    expect(bastion.shield?.turns).toBe(2);
    expect(DESIGN).toContain('reflect 25% of damage taken as Physical, 2 turns'); // DESIGN gives the reflect, not the Shield, a duration
  });
});

// ---- The Amulet of Echoes and its Echo Bolt --------------------------------------------------------------------------------

describe('itm_echo_bolt and the Amulet of Echoes vs DESIGN §5.7 and §7.7', () => {
  const S57 = section('### 5.7 Basic attacks by weapon type', '## 6. Progression');
  const S77 = section('### 7.7 Legacy items', '### 7.8');

  test('itm_echo_bolt: owner, MP, target, Ley, max(0.75·ATK, 4 + 0.8·SP), cooldown 1, DESIGN\'s description line', () => {
    const [row] = rows(S57, /^`itm_echo_bolt`$/);
    if (!row) throw new Error('DESIGN §5.7 has no itm_echo_bolt row');
    const [, name = '', source = '', mp = '', target = '', type = '', power = '', status = '', cd = '', description = ''] = row;
    const bolt = pack.abilities.itm_echo_bolt as Ability;
    expect([bolt.name, bolt.ownerId, bolt.mp, bolt.target, bolt.damageType, bolt.cooldown, bolt.flavor]).toEqual([name, unquote(source), Number(mp), TARGETS[target], type.toLowerCase(), Number(cd), description]);
    const m = /`max\((\d+(?:\.\d+)?)·(ATK|SP), (\d+) \+ (\d+(?:\.\d+)?)·(ATK|SP)\)`/.exec(power);
    expect(m).not.toBeNull();
    expect(bolt.power).toEqual({ base: 0, coef: Number(m?.[1]), stat: STAT[m?.[2] as 'ATK' | 'SP'], hits: 1, perHitCrit: true, ignoresArmor: false, maxOf: { base: Number(m?.[3]), coef: Number(m?.[4]), stat: STAT[m?.[5] as 'ATK' | 'SP'] } });
    expect(status).toContain('removes Rewind'); // Ley breaks a Rewind: interplay row 9, no status row
    expect([bolt.statuses, bolt.special, bolt.selfCost, bolt.spell, bolt.branch, bolt.tier, bolt.kind]).toEqual([[], undefined, undefined, false, undefined, undefined, undefined]);
    expect(bolt.description.length).toBeGreaterThan(20);
    expect([bolt.levelReq, bolt.costHalf]).toEqual([1, 2]);
  });

  test('item_amulet_of_echoes: a bound, slotless quest item; +1 MAG; grants itm_echo_bolt; legacy name; 60 gold; WORLD\'s description', () => {
    const [row] = rows(S77, /^Amulet of Echoes$/);
    if (!row) throw new Error('DESIGN §7.7 has no Amulet row');
    const [name = '', , type = '', , numbers = '', value = ''] = row;
    const amulet = pack.items.item_amulet_of_echoes;
    if (!amulet) throw new Error('item_amulet_of_echoes is not in the pack');
    expect([amulet.name, amulet.legacyName, amulet.type]).toEqual([name, name, 'quest']);
    expect(type).toContain('bound, slotless');
    expect([amulet.slot, amulet.sellable, amulet.droppable, amulet.stackable, amulet.upgradeable]).toEqual([undefined, false, false, false, false]);
    expect(numbers).toContain('+1 MAG passive');
    expect(numbers).toContain('grants `itm_echo_bolt`');
    expect(amulet.stats.magic).toBe(1);
    expect(amulet.passives).toEqual([{ kind: 'grantAbility', abilityId: 'itm_echo_bolt' }]);
    expect([amulet.value, amulet.tier]).toEqual([Number(/^(\d+)/.exec(value)?.[1]), 0]);
    const worldRow = WORLD.split('\n').find((line) => line.startsWith('| `item_amulet_of_echoes`')) ?? '';
    expect(worldRow).toContain(amulet.description);
    expect(worldRow).toContain('slotless passive magic +1; grants_ability `itm_echo_bolt`');
  });

  test('carried, it grants the bolt to every class (+1 MAG too): derive() and the known abilities of a Loop 2 run', () => {
    for (const classId of Object.keys(pack.classes)) {
      const s = newRun('u41', classId, pack, freshProfile({ loopCounter: 2 }));
      expect(s.player.inventory.map((i) => i.itemId)).toContain('item_amulet_of_echoes');
      const d = derive(s.player, pack);
      expect([classId, d.grantedAbilities]).toEqual([classId, ['itm_echo_bolt']]);
      expect([classId, knownAbilities(s, pack)]).toEqual([classId, ['itm_echo_bolt']]);
      expect([classId, d.magic]).toEqual([classId, (pack.classes[classId]?.baseStats.magic ?? 0) + 1]);
      // no AP spent: it is in no tree
      expect([classId, s.player.abilitiesUnlocked, s.player.apHalf]).toEqual([classId, [], 2]);
    }
  });
});

// ---- The companions: records, abilities, and a pack with stubs -------------------------------------------------------------------

const S123 = section('### 12.3 Stats', '### 12.4');
const S124 = section('### 12.4 Abilities', '### 12.5');
const S121 = section('### 12.1 Recruitment', '### 12.2');
const S128 = section('### 12.8 Dask', '---');

/** Parsed ("80 / +6" → [80, 6]; "0" → [0, 0]). */
const pair = (cell: string): [number, number] => {
  const m = /^(\d+(?:\.\d+)?)(?: \/ \+(\d+(?:\.\d+)?))?$/.exec(cell);
  return [Number(m?.[1]), Number(m?.[2] ?? 0)];
};

describe('the six companions vs DESIGN §12.1–12.3', () => {
  test('six records in DESIGN order, plain ids, each NPC `npc_<id>` (WORLD §4 says so, and names it the companion anchor)', () => {
    expect(companions.map((c) => c.id)).toEqual(rows(S121, /^`[a-z]+`$/).map((r) => unquote(r[0] ?? '')));
    for (const c of companions) {
      expect([c.id, c.npcId]).toEqual([c.id, `npc_${c.id}`]);
      expect([c.id, WORLD.split('\n').some((line) => line.startsWith(`| \`npc_${c.id}\` |`) && line.includes(`companion anchor \`${c.id}\``))]).toEqual([c.id, true]);
      expect([c.id, CompanionSchema.safeParse(c).success]).toEqual([c.id, true]);
    }
  });

  test('§12.3: HP, ATK and SP (level 1 and per level), AGI, armor/ward, the innate evasion and the Poison immunity', () => {
    const table = rows(S123, /^`[a-z]+`$/);
    expect(table).toHaveLength(6);
    for (const [idCell = '', hp = '', atk = '', sp = '', agi = '', armorWard = '', note = ''] of table) {
      const c = CompanionSchema.parse(companions.find((x) => x.id === unquote(idCell)));
      const [hp0, hpL] = pair(hp);
      const [atk0, atkL] = pair(atk);
      const [sp0, spL] = pair(sp);
      const [armor, ward] = armorWard.split('/').map(Number);
      expect([c.id, c.stats]).toEqual([c.id, { hp: hp0, atk: atk0, sp: sp0, agi: Number(agi), armor, ward, evasion: /innate \+(\d+) evasion/.exec(note)?.[1] === undefined ? 0 : Number(/innate \+(\d+) evasion/.exec(note)?.[1]) }]);
      expect([c.id, c.perLevel]).toEqual([c.id, { hp: hpL, atk: atkL, sp: spL }]);
      expect([c.id, c.statusImmunities]).toEqual([c.id, /immune Poison/.test(note) ? ['status_poison'] : []]);
    }
    expect(S123).toContain('Armor and ward gain +1 each per 4 levels'); // an engine rule, not a field
  });

  test('§12.1 roles: support / Ley caster, bruiser, Void caster, Chrono phantom, glow healer, Chrono caster', () => {
    const WORDS: Record<string, [string, string, string]> = {
      ilyra: ['support / Ley caster', 'support', 'ley'],
      brak: ['bruiser / tank', 'bruiser', 'physical'],
      nyx: ['Void caster', 'caster', 'void'],
      dask: ['Chrono phantom', 'skirmisher', 'chrono'],
      mireya: ['nature/glow healer', 'support', 'ley'],
      caelum: ['Chrono caster', 'caster', 'chrono'],
    };
    for (const c of companions) {
      const [wording, role, damageType] = WORDS[c.id] ?? ['', '', ''];
      expect([c.id, S121.includes(wording)]).toEqual([c.id, true]);
      expect([c.id, c.role, c.damageType]).toEqual([c.id, role, damageType]);
    }
  });

  test('loyalty starts at 0 (the bond Echoes raise it, DESIGN §12.5); Brak alone has a scripted permadeath (§12.6)', () => {
    expect(companions.map((c) => c.startingLoyalty)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(companions.map((c) => [c.id, c.deathRule])).toEqual([['ilyra', 'ko'], ['brak', 'permadeath_scripted'], ['nyx', 'ko'], ['dask', 'ko'], ['mireya', 'ko'], ['caelum', 'ko']]);
    expect(DESIGN).toContain('Permadeath only via story (Brak at the Apex');
  });
});

describe('the 24 companion abilities vs DESIGN §12.4', () => {
  const TABLE = rows(S124, /^`comp_/);
  const abilityOf = (id: string): Ability => AbilitySchema.parse(companionAbilities.find((a) => a.id === id));

  test('24 rows in DESIGN order, each a valid ability owned by its companion, no MP, a play description and no flavor', () => {
    expect(TABLE).toHaveLength(24);
    expect(companionAbilities.map((a) => a.id)).toEqual(TABLE.map((r) => unquote(r[0] ?? '')));
    for (const [idCell = '', owner = '', kind = ''] of TABLE) {
      const id = unquote(idCell);
      const parsed = AbilitySchema.safeParse(companionAbilities.find((a) => a.id === id));
      expect([id, parsed.success]).toEqual([id, true]);
      const a = abilityOf(id);
      expect([id, a.ownerId, a.kind, a.mp, a.branch, a.tier]).toEqual([id, owner.toLowerCase(), kind.startsWith('**signature**') ? 'signature' : kind.replace(/ \(self\)$/, ''), 0, undefined, undefined]);
      expect(a.description.length).toBeGreaterThan(10);
      expect([id, a.flavor]).toEqual([id, undefined]);
    }
  });

  test('damage type and power, Shield, heal, Regen, self-cost: the numbers of the Effect column', () => {
    for (const [idCell = '', , , effect = ''] of TABLE) {
      const id = unquote(idCell);
      const a = abilityOf(id);
      const dmg = /^(Physical|Ley|Void|Chrono) `(\d+(?:\.\d+)?)·(ATK|SP)`/.exec(effect);
      if (dmg) expect([id, a.damageType, a.power?.coef, a.power?.stat, a.power?.base ?? 0]).toEqual([id, (dmg[1] ?? '').toLowerCase() as Ability['damageType'], Number(dmg[2]), STAT[dmg[3] as 'ATK' | 'SP'], 0]);
      else expect([id, a.power]).toEqual([id, undefined]);
      const shield = /Shield `(?:(\d+) \+ )?(\d+(?:\.\d+)?)·(SP|ATK)(?: \+ (\d+))?`/.exec(effect);
      if (shield) expect([id, a.shield?.base, a.shield?.coef, a.shield?.stat]).toEqual([id, Number(shield[1] ?? shield[4] ?? 0), Number(shield[2]), (shield[3] ?? '').toLowerCase() as 'sp' | 'atk']);
      else expect([id, a.shield]).toEqual([id, undefined]);
      // a plain heal row starts with its formula ("`12 + 1.1·SP`", "`10 + 1.0·SP` + Regen …")
      const heal = /^`(\d+) \+ (\d+(?:\.\d+)?)·SP`/.exec(effect);
      if (heal) expect([id, a.heal]).toEqual([id, { base: Number(heal[1]), coef: Number(heal[2]), stat: 'sp', target: 'ally' }]);
      else expect([id, a.heal]).toEqual([id, undefined]);
      const regen = /Regen `(\d+) \+ (\d+(?:\.\d+)?)·SP`(?:, (\d+))?/.exec(effect);
      const row = a.statuses.find((s) => s.status === 'status_regen');
      if (regen) expect([id, row?.power, row?.duration]).toEqual([id, { base: Number(regen[1]), coef: Number(regen[2]), stat: 'sp' }, Number(regen[3])]);
      else expect([id, row]).toEqual([id, undefined]);
      const cost = /costs (\d+)% of Nyx's HP/.exec(effect);
      expect([id, a.selfCost]).toEqual([id, cost ? { hpPctMax: Number(cost[1]) / 100 } : undefined]);
    }
    // The Shield rows state their duration only for Ward ("…, 3"); the rest take the Shield status's 3
    expect(abilityOf('comp_ilyra_ward').shield?.turns).toBe(3);
    expect(DRAIN_SHARES.comp_nyx_drink).toBe(0.6); // "heals Nyx 60% of damage": the drain special's share, an engine table
  });

  /** The statuses each DESIGN effect names: [status, chance, duration, which combatants], read from the quoted wording. */
  const STATUSES: Record<string, { wording: string; statuses: [string, number, number, string][]; special?: string; interrupt?: boolean }> = {
    comp_ilyra_archive_light: { wording: 'cleanse party', statuses: [], special: 'cleanse' },
    comp_brak_shieldbreak: { wording: 'Armor Break 100%, 3', statuses: [['status_armor_break', 1, 3, 'target']] },
    comp_brak_hold_the_line: { wording: 'Taunt all 2; Guard self', statuses: [['status_taunt', 1, 2, 'all_enemies']], special: 'guard' },
    comp_nyx_hex: { wording: 'Weaken 100%, 2', statuses: [['status_weaken', 1, 2, 'target']] },
    comp_nyx_drink: { wording: 'heals Nyx 60% of damage', statuses: [], special: 'drain' },
    comp_dask_stall: { wording: 'Slow 100%, 2', statuses: [['status_slow', 1, 2, 'target']] },
    comp_dask_glimpse: { wording: 'next-next intents', statuses: [], special: 'foresight' },
    comp_dask_between_instants: { wording: 'Rewind (2) on the player; Haste (2) on both', statuses: [['status_rewind', 1, 2, 'ally'], ['status_haste', 1, 2, 'all_allies']] },
    comp_mireya_glowsalve: { wording: 'Regen `3 + 0.3·SP`, 3', statuses: [['status_regen', 1, 3, 'target']] },
    comp_mireya_spore_cloud: { wording: 'Blind 100%, 2 on all enemies', statuses: [['status_blind', 1, 2, 'target']] },
    comp_mireya_lantern_light: { wording: 'Soaked 100%, 3', statuses: [['status_soaked', 1, 3, 'target']] },
    comp_mireya_lanternreed_bloom: { wording: 'cleanse; Regen `4 + 0.4·SP`, 3', statuses: [['status_regen', 1, 3, 'all_allies']], special: 'cleanse' },
    comp_caelum_chrono_shard: { wording: 'Slow 30%, 2', statuses: [['status_slow', 0.3, 2, 'target']] },
    comp_caelum_haste: { wording: 'Haste 2 on the player', statuses: [['status_haste', 1, 2, 'target']] },
    comp_caelum_stutter: { wording: 'interrupt + Stun 1 (non-boss) or Stagger + Slow 2 (boss)', statuses: [['status_stun', 1, 1, 'target'], ['status_slow', 1, 2, 'target']], interrupt: true },
  };

  test('statuses, specials and interrupts: each named by the DESIGN effect it is read from, and no other', () => {
    for (const [idCell = '', , , effect = ''] of TABLE) {
      const id = unquote(idCell);
      const a = abilityOf(id);
      const want = STATUSES[id];
      if (want) expect([id, effect.includes(want.wording)]).toEqual([id, true]);
      expect([id, a.statuses.map((s) => [s.status, s.chance, s.duration, s.target])]).toEqual([id, (want?.statuses ?? []).map(([status, chance, duration, who]) => [status, chance, duration, who])]);
      expect([id, a.special]).toEqual([id, want?.special]);
      expect([id, a.interrupt]).toEqual([id, want?.interrupt ?? false]);
    }
    // Stutter: the Stun is for non-bosses, the Slow for bosses
    const stutter = abilityOf('comp_caelum_stutter');
    expect(stutter.statuses.map((s) => s.when)).toEqual([{ targetIsBoss: false }, { targetIsBoss: true }]);
  });

  test('targets by the Effect column: single, all, party, the lowest-HP / chosen ally, or self', () => {
    const TARGET: Record<string, Ability['target']> = {
      comp_ilyra_ley_dart: 'enemy', comp_ilyra_ward: 'ally', comp_ilyra_mend: 'ally', comp_ilyra_archive_light: 'party',
      comp_brak_axe: 'enemy', comp_brak_cleave: 'all_enemies', comp_brak_shieldbreak: 'enemy', comp_brak_hold_the_line: 'self',
      comp_nyx_void_needle: 'enemy', comp_nyx_hex: 'enemy', comp_nyx_drink: 'enemy', comp_nyx_unmaking: 'all_enemies',
      comp_dask_flicker_strike: 'enemy', comp_dask_stall: 'enemy', comp_dask_glimpse: 'self', comp_dask_between_instants: 'party',
      comp_mireya_glowsalve: 'ally', comp_mireya_spore_cloud: 'all_enemies', comp_mireya_lantern_light: 'enemy', comp_mireya_lanternreed_bloom: 'party',
      comp_caelum_chrono_shard: 'enemy', comp_caelum_haste: 'ally', comp_caelum_foresight: 'ally', comp_caelum_stutter: 'enemy',
    };
    for (const [idCell = '', , , effect = ''] of TABLE) {
      const id = unquote(idCell);
      expect([id, abilityOf(id).target]).toEqual([id, TARGET[id]]);
      if (TARGET[id] === 'all_enemies') expect([id, /\ball\b/.test(effect)]).toEqual([id, true]);
      if (TARGET[id] === 'party') expect([id, /party|both/.test(effect)]).toEqual([id, true]);
    }
  });

  test('every mechanical field equals the U28 companion fixture rows and the fixture pack\'s Ilyra (cast through the engine in companionAi.test.ts)', () => {
    const fixture = new Map<string, AbilityInput>([...miniContentTables.abilities.filter((a) => a.id.startsWith('comp_')), ...companionFixture].map((a) => [a.id, a]));
    const mechanics = (input: AbilityInput) => {
      const { description: _d, flavor: _f, tags: _t, notes: _n, ...rest } = AbilitySchema.parse(input);
      return rest;
    };
    for (const a of companionAbilities as AbilityInput[]) {
      const twin = fixture.get(a.id);
      expect([a.id, twin !== undefined]).toEqual([a.id, true]);
      if (twin) expect(mechanics(a)).toEqual(mechanics(twin));
    }
  });

  test('the two clauses the fields cannot say are scripted by the engine (U34c), and the descriptions state them (a signature heal of 30% max HP; hidden intents revealed for 2 turns)', () => {
    expect(TABLE.find((r) => unquote(r[0] ?? '') === 'comp_mireya_lanternreed_bloom')?.[3]).toContain('party heal 30% max HP');
    expect(abilityOf('comp_mireya_lanternreed_bloom').heal).toBeUndefined();
    expect(abilityOf('comp_mireya_lanternreed_bloom').description).toMatch(/30% of max HP/);
    expect(TABLE.find((r) => unquote(r[0] ?? '') === 'comp_ilyra_archive_light')?.[3]).toContain('all hidden intents revealed for 2 turns');
    expect(abilityOf('comp_ilyra_archive_light').description).toMatch(/hidden enemy intent for 2 turns/);
    expect(COMPANION_SCRIPTS).toEqual({ comp_mireya_lanternreed_bloom: { healMaxHpPct: 0.3 }, comp_ilyra_archive_light: { revealTurns: 2 } });
  });
});

describe('three auto abilities and one signature each; cooldowns', () => {
  const TABLE = rows(S124, /^`comp_/);

  test('each record names exactly its three non-signature rows as the autos and its one signature row, in DESIGN order', () => {
    for (const c of companions) {
      const mine = TABLE.filter((r) => r[1]?.toLowerCase() === c.id);
      expect(mine).toHaveLength(4);
      const autos = mine.filter((r) => !(r[2] ?? '').startsWith('**signature**')).map((r) => unquote(r[0] ?? ''));
      const sig = mine.filter((r) => (r[2] ?? '').startsWith('**signature**')).map((r) => unquote(r[0] ?? ''));
      expect([c.id, c.abilities]).toEqual([c.id, autos]);
      expect([c.id, [c.signature.abilityId]]).toEqual([c.id, sig]);
    }
  });

  test('auto cooldowns follow the kind (attack 0, debuff/aoe/utility/buff 2, heal/shield/cleanse 3); signature cooldowns are DESIGN\'s CD', () => {
    expect(S124).toContain('`attack` 0 · `debuff`, `aoe`, `utility`, `buff` 2 · `heal`, `shield`, `cleanse` 3');
    for (const c of companions) {
      for (const id of c.abilities) {
        const a = AbilitySchema.parse(companionAbilities.find((x) => x.id === id));
        expect([id, a.kind === 'signature', a.cooldown]).toEqual([id, false, COMPANION_KIND_COOLDOWN[a.kind as keyof typeof COMPANION_KIND_COOLDOWN]]);
      }
      const row = TABLE.find((r) => unquote(r[0] ?? '') === c.signature.abilityId);
      expect([c.id, c.signature.cooldown]).toEqual([c.id, Number(/CD (\d+)/.exec(row?.[2] ?? '')?.[1])]);
      expect([c.id, AbilitySchema.parse(companionAbilities.find((x) => x.id === c.signature.abilityId)).kind]).toEqual([c.id, 'signature']);
    }
    expect(companions.map((c) => c.signature.cooldown)).toEqual([4, 4, 4, 5, 5, 4]);
  });
});

// ---- Arc quests, camp scenes: the real pack, and a pack with stubs for what is still pending ----------------------------------------------------------------------

/** STORY §11.4's headings: `#### \`q_voices_in_the_stacks\` — Voices in the Stacks (Ilyra 1)` → companion → arc order. */
function storyArcs(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const text = STORY.slice(STORY.indexOf('### 11.4 Companion arcs'), STORY.indexOf('### 11.5 Loop-only quests'));
  for (const m of text.matchAll(/^#### `(q_[a-z_]+)` — .* \((Ilyra|Brak|Nyx|Dask|Mireya|Caelum) (\d)\)$/gm)) {
    (out[(m[2] ?? '').toLowerCase()] ??= [])[Number(m[3]) - 1] = m[1] ?? '';
  }
  return out;
}

const HOME = gameConfig.startLocationId;
const UNSTABLE = 'loc_stub_unstable';
const CALM = 'loc_stub_calm';

// Rule 22 pins the legacy start location (the config's `startLocationId`) to its Appendix A region, so the stub region has that id.
const STUB_REGION = 'region_silverwood_ruins';
const stubRegion = {
  id: STUB_REGION,
  name: 'Stub Region',
  description: 'Test stub.',
  order: 1,
  levelBand: { min: 1, max: 20 },
  legacy: true,
  palette: { bg: '#000', bgAlt: '#111', fg: '#fff', accent: '#0f0', glow: '#0ff' },
  ambient: 'silverwood_drone',
} satisfies RegionInput;
const stubLocation = (id: `loc_${string}`, over: Partial<LocationInput>): LocationInput => ({
  id, regionId: STUB_REGION, name: `Stub ${id}`, description: 'Test stub.', exits: [], art: { template: 'ruins', silhouettes: [], particles: 'motes', timeOfDay: 'dusk' }, map: { x: 0, y: 0 }, ...over,
});
const stubLocations: LocationInput[] = [
  stubLocation(HOME, { exits: [{ dir: 'east', to: UNSTABLE }, { dir: 'south', to: CALM }], safe: true }),
  stubLocation(UNSTABLE, { exits: [{ dir: 'west', to: HOME }], temporallyUnstable: true, map: { x: 1, y: 0 } }),
  stubLocation(CALM, { exits: [{ dir: 'north', to: HOME }], map: { x: 0, y: 1 } }),
];
const stubNpcs: NpcInput[] = companions.map((c) => ({
  id: c.npcId, name: c.name, description: 'Test stub.', homeLocationId: HOME, portrait: { sigil: c.id }, roles: ['companion'], companionId: c.id,
}));
const stubQuests: QuestInput[] = companions.flatMap((c) =>
  c.arcQuestIds.map((id) => ({
    id,
    name: `Stub ${id}`,
    description: 'Test stub.',
    category: 'companion' as const,
    botHint: 'pacifist' as const,
    companionId: c.id,
    stages: [
      { id: 'start', journal: 'Stub.', next: [{ when: { companion: { id: c.id } }, to: 'done_yes' }, { when: { not: { companion: { id: c.id } } }, to: 'done_no' }] },
      { id: 'done_yes', journal: 'Stub.', outcome: 'complete' as const },
      { id: 'done_no', journal: 'Stub.', outcome: 'fail' as const },
    ],
  })),
);
const stubScenes: DialogueSceneInput[] = companions.flatMap((c) =>
  c.campScenes.map((id, i) => ({
    id,
    title: 'Stub',
    when: i === 0 ? { companion: { id: c.id } } : { loyalty: { companion: c.id, min: i * 25 } },
    priority: i + 1,
    repeatable: false,
    entry: 'n',
    nodes: [{ id: 'n', speaker: c.id, text: 'Test stub.', next: 'end' as const }],
  })),
);

/** The real tables (the six companion records and 24 abilities among them since D-111) and the stubs. `drop` removes one stub record by id. */
function stubTables(drop?: string): ContentTables {
  const keep = <T extends { id: string }>(list: readonly T[]): T[] => list.filter((r) => r.id !== drop);
  return {
    ...contentTables,
    // the items' `sources` name merchants, recipes, quests and creatures this stub pack does not have (U49, U50), and the schematics,
    // patterns, tomes and Litany pages grant Echoes, recipes and codex entries (and the Warder Plate asks about a quest) it lacks too
    items: contentTables.items.map((i) => ({
      ...i,
      sources: [],
      onUse: (i.onUse ?? []).filter((e) => !('grantEcho' in e || 'unlockRecipe' in e || 'unlockCodex' in e)),
      requirements: i.requirements === undefined ? undefined : { ...i.requirements, when: undefined },
    })),
    // the real apexGate reads `echo_apex_resonance`, which no table here defines (config conditions are checked once there are locations)
    config: { ...contentTables.config, apexGate: { counter: { name: 'quests_completed', min: 6 } } },
    regions: [stubRegion],
    locations: [...stubLocations],
    creatures: [], // the region units' creatures (U42+) reference items and creatures outside this stub pack
    // U51: the loop records name quests, items, locations and Echoes of the whole game (and the Echoes are granted by quests and
    // dialogue this pack does not have); tests/unit/content/shared/{echoes,loopRecords}.test.ts build them with the real pack
    echoes: [],
    achievements: [],
    modifiers: [],
    attunements: [],
    endings: [],
    // the recipes and merchants (U50) name quests, NPCs, factions, flags and Echoes this stub pack does not have
    recipes: [],
    merchants: [],
    // U60: the codex entries' unlocks and cross-links name Echoes, quests, locations and codex entries of the whole game;
    // tests/unit/content/codex/codexI.test.ts builds them with the real pack
    codex: [],
    // the quests' own fights (U53: the Horde-echo's waves) name a creature this stub pack does not have
    encounters: [],
    npcs: keep(stubNpcs),
    quests: keep(stubQuests),
    dialogues: keep(stubScenes),
  };
}

describe('the companions in the real pack (D-111)', () => {
  test('STORY §11.4: three arc quests per companion, in arc order, are the record\'s `arcQuestIds`', () => {
    const arcs = storyArcs();
    expect(Object.keys(arcs).sort()).toEqual(companions.map((c) => c.id).sort());
    for (const c of companions) expect([c.id, c.arcQuestIds]).toEqual([c.id, arcs[c.id]]);
  });

  test('camp scenes: scene_<id>_camp_1…3 each (STORY names none; DESIGN §12.5: a second conversation at loyalty 25)', () => {
    for (const c of companions) expect([c.id, c.campScenes]).toEqual([c.id, [1, 2, 3].map((n) => `scene_${c.id}_camp_${n}`)]);
    expect(DESIGN).toContain('25 → camp conversation 2');
  });

  test('without its companion record a comp_ ability is an error, and without its NPC pointing back so is the record (rule 1)', () => {
    const noRecord = parseContentPack({ ...contentTables, companions: companions.filter((c) => c.id !== 'nyx') }).report.errors.map((e) => `${e.table}.${e.id}`);
    expect(noRecord).toContain('abilities.comp_nyx_void_needle');
    const unlinked = parseContentPack({ ...contentTables, npcs: contentTables.npcs.map((n) => (n.id === 'npc_brak' ? { ...n, companionId: undefined } : n)) }, { incompleteTables: INCOMPLETE_TABLES }).report.errors;
    expect(unlinked.some((e) => e.table === 'companions' && e.id === 'brak' && /point back/.test(e.message))).toBe(true);
  });

  test('each of the six NPCs is needed: drop one from the real npcs and the validator names it on its companion', () => {
    const strictReport = (p: ContentPack): ContentReport => validateContent(p, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    for (const c of companions) {
      const { report } = parseContentPack({ ...contentTables, npcs: contentTables.npcs.filter((n) => n.id !== c.npcId) }, { incompleteTables: INCOMPLETE_TABLES, validate: strictReport });
      const named = [...report.errors, ...report.warnings].filter((f) => f.table === 'companions' && f.id === c.id && f.message.includes(`'${c.npcId}'`));
      expect([c.id, named.length]).toEqual([c.id, 1]);
    }
  });

  test('Dask\'s restriction in data (DESIGN §12.8): active only where a location is temporally unstable or infected; nobody else is restricted', () => {
    expect(S128).toContain('`location.temporallyUnstable || location.infected`');
    expect(S128).toContain('No region list');
    expect(companions.filter((c) => c.requiresTemporallyUnstable).map((c) => c.id)).toEqual(['dask']);
    const dask = CompanionSchema.parse(companions.find((c) => c.id === 'dask') as CompanionInput);
    expect([dask.requiresTemporallyUnstable, dask.constraintText, dask.stats.evasion]).toEqual([true, 'Dask flickers and cannot follow.', 20]);
    expect(dask.banter.length + dask.campScenes.length).toBeGreaterThan(0);

    // the real map: every location, every companion — only Dask is ever kept out, and only where the node is calm and uninfected
    const s = newRun('u41', 'ranger', pack, freshProfile());
    expect(s.world.infected).toEqual([]);
    const locations = Object.values(pack.locations);
    const unstable = locations.filter((l) => l.temporallyUnstable === true);
    const calm = locations.filter((l) => l.temporallyUnstable !== true);
    expect(unstable.length).toBeGreaterThan(0);
    expect(calm.length).toBeGreaterThan(1);
    for (const c of companions) {
      for (const l of locations) {
        expect([c.id, l.id, companionAllowedAt(s, pack, c.id, l.id)]).toEqual([c.id, l.id, c.id !== 'dask' || l.temporallyUnstable === true]);
      }
    }
    // a Horde-infected node counts while infected
    const [infected, other] = calm;
    s.world.infected = [infected?.id ?? ''];
    expect(companionAllowedAt(s, pack, 'dask', infected?.id ?? '')).toBe(true);
    expect(companionAllowedAt(s, pack, 'dask', other?.id ?? '')).toBe(false);
  });
});

describe('the companions in a pack with stub NPC, arc-quest and camp-scene records (exists only in this test)', () => {
  test('every record and ability parses, and the whole pack builds and validates with no errors or warnings', () => {
    const parsed = parseContentPack(stubTables());
    expect(parsed.report).toEqual({ errors: [], warnings: [] });
    const p = buildContentPack(stubTables());
    expect(Object.keys(p.companions)).toEqual(companions.map((c) => c.id));
    expect(Object.keys(p.abilities).filter((id) => id.startsWith('comp_'))).toEqual(companionAbilities.map((a) => a.id));
    expect(p.index.abilitiesByClass.elf).toHaveLength(15);
    // strict mode adds only pending completeness counts; the companions themselves lack nothing (rule 18 counts only the arcs' outcomes)
    const strict = validateContent(p, { strict: true, pending: true });
    expect(strict.errors).toEqual([]);
    expect(strict.warnings.every((w) => w.message.startsWith('pending — content not yet authored: '))).toBe(true);
    expect(strict.warnings.filter((w) => w.rule === 'rule-18' && w.table === 'companions')).toEqual([]);
  });

  test('the outside ids the records reference are exactly 6 NPCs, 18 arc quests and 18 camp scenes — and each is needed (drop one: the validator names it)', () => {
    const needed: string[] = [...companions.map((c) => c.npcId), ...companions.flatMap((c) => c.arcQuestIds), ...companions.flatMap((c) => c.campScenes)];
    expect(needed).toHaveLength(42);
    expect(new Set(needed).size).toBe(42);
    expect(needed).toEqual([...stubNpcs.map((n) => n.id), ...stubQuests.map((q) => q.id), ...stubScenes.map((s) => s.id)].sort((a, b) => needed.indexOf(a) - needed.indexOf(b)));
    for (const id of needed) {
      const { report } = parseContentPack(stubTables(id));
      expect([id, report.errors.some((e) => e.message.includes(`'${id}'`))]).toEqual([id, true]);
    }
  });
});
