// U76 (PLAN §8.2 `crossrefs.test.ts`), the real-pack half: `validateContent()` returns zero errors on the finished pack, and a
// mutated deep copy of it makes each of the 22 rules fire. tests/unit/content/crossrefs.test.ts already holds 100+ failing
// examples for all 22 rules on the small fixture pack (its "rule coverage" test proves every rule has one), so nothing was
// missing there; these prove the same validator catches the same defects on the REAL 73-location pack, one per rule.
import { describe, expect, test } from 'bun:test';
import { buildContentPack, formatIssue } from '@content/index';
import { INCOMPLETE_TABLES } from '@content/progress';
import { RULES, validateContent, type ValidateOptions } from '@content/validate';
import type { ContentPack, ContentReport } from '@schema/contentPack';

const real = buildContentPack();

/** An unfrozen deep copy of the real pack, edited by `edit`, validated strict (the release setting). */
function mutated(edit: (p: ContentPack) => void, options: ValidateOptions = {}): ContentReport {
  const pack = structuredClone(real) as ContentPack;
  edit(pack);
  return validateContent(pack, { strict: true, incompleteTables: INCOMPLETE_TABLES, ...options });
}

const got = <T>(v: T | undefined, what: string): T => {
  if (v === undefined) throw new Error(`the real pack has no ${what}`);
  return v;
};
const firedBy = (r: ContentReport): string[] => [...new Set([...r.errors, ...r.warnings].map((i) => i.rule))];
const words = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

const library = 'loc_shattered_library';

/** One defect per rule, made on the real pack. */
const MUTATIONS: Record<string, { title: string; edit: (p: ContentPack) => void; options?: ValidateOptions }> = {
  'rule-01': { title: 'an exit to a location that does not exist', edit: (p) => { got(p.locations[library], library).exits.push({ dir: 'up', to: 'loc_nowhere' } as never); } },
  'rule-02': { title: 'an event that grants an Echo that does not exist', edit: (p) => { got(p.locations[library], library).events.push({ id: 'ev_ghost', text: 'x', effects: [{ grantEcho: 'echo_ghost' }] } as never); } },
  'rule-03': { title: 'an ability with an unknown special', edit: (p) => { got(p.abilities['rgr_rend'], 'rgr_rend').special = 'nonsense' as never; } },
  'rule-04': { title: 'a silhouette missing from the art registry', edit: () => undefined, options: { registries: { silhouettes: ['not_a_silhouette'] } } },
  'rule-05': { title: 'an ambient preset missing from the audio registry', edit: () => undefined, options: { registries: { ambient: ['not_a_preset'] } } },
  'rule-06': { title: 'a record filed under another key', edit: (p) => { p.items['item_renamed'] = got(p.items['item_glow_moss'], 'item_glow_moss'); } },
  'rule-07': { title: 'an exit with no way back', edit: (p) => { const l = got(p.locations[library], library); const e = l.exits.find((x) => !x.oneWay); if (e) p.locations[e.to] = { ...got(p.locations[e.to], e.to), exits: got(p.locations[e.to], e.to).exits.filter((x) => x.to !== library) }; } },
  'rule-08': { title: 'a location nothing leads to', edit: (p) => { for (const l of Object.values(p.locations)) l.exits = l.exits.filter((e) => e.to !== 'loc_voidscar_hollow'); } },
  'rule-09': { title: 'a quest whose first stage is no stage', edit: (p) => { got(p.quests['q_echo_crystal'], 'q_echo_crystal').firstStage = 'stage_ghost'; } },
  'rule-10': { title: 'a dialogue node no entry leads to', edit: (p) => { got(p.dialogues['scene_first_meeting_ilyra'], 'scene_first_meeting_ilyra').nodes.push({ id: 'orphan', speaker: 'narrator', text: 'Unheard.', choices: [], next: 'end' } as never); } },
  'rule-11': { title: 'a boss that can be fled', edit: (p) => { got(p.creatures['cr_chronos_tyrant_contained'], 'tyrant').fleeable = true; } },
  'rule-12': { title: 'a consumable with no effects', edit: (p) => { got(p.items['item_glow_moss'], 'item_glow_moss').onUse = []; } },
  'rule-13': { title: 'an ability tier at the wrong level', edit: (p) => { got(p.abilities['rgr_rend'], 'rgr_rend').levelReq = 99; } },
  'rule-14': { title: 'a canonical status removed', edit: (p) => { delete p.statuses['status_bleed']; } },
  'rule-15': { title: 'an ending removed', edit: (p) => { delete p.endings['ending_unbound']; } },
  'rule-16': { title: 'an Echo exclusive with another that is not exclusive back', edit: (p) => { const ids = Object.keys(p.echoes); got(p.echoes[ids[0] as string], 'echo').exclusiveWith = [ids[1] as string] as never; } },
  'rule-17': { title: 'a codex body over 220 words', edit: (p) => { got(Object.values(p.codex)[0], 'codex entry').body = words(221); } },
  'rule-18': { title: 'a companion with no arc quests', edit: (p) => { got(Object.values(p.companions)[0], 'companion').arcQuestIds = []; } },
  'rule-19': { title: 'an Attunement removed', edit: (p) => { delete p.attunements[got(Object.keys(p.attunements)[0], 'attunement')]; } },
  'rule-20': { title: 'a quest item in a merchant\'s stock', edit: (p) => { const q = got(Object.values(p.items).find((i) => i.type === 'quest'), 'quest item'); got(Object.values(p.merchants)[0], 'merchant').stock.push({ itemId: q.id, count: 1, priceMult: 1, rollRarity: true } as never); } },
  'rule-21': { title: 'a region removed (the game-wide counts)', edit: (p) => { delete p.regions['region_threshold']; } },
  'rule-22': { title: 'a legacy location removed', edit: (p) => { delete p.locations['loc_whispering_ruins']; } },
};

describe('the real pack against validateContent() (PLAN §8.2 crossrefs)', () => {
  test('0 errors, strict, with nothing pending (D-136)', () => {
    const report = validateContent(real, { strict: true, pending: true, incompleteTables: INCOMPLETE_TABLES });
    expect(report.errors.map(formatIssue)).toEqual([]);
    expect(report.warnings.filter((w) => w.message.startsWith('pending'))).toEqual([]);
    expect(INCOMPLETE_TABLES).toEqual([]);
  });

  test('one mutation is written for every one of the 22 rules', () => {
    expect(Object.keys(MUTATIONS)).toEqual(RULES.map((r) => r.rule));
    expect(RULES).toHaveLength(22);
  });

  for (const [rule, m] of Object.entries(MUTATIONS)) {
    test(`${rule}: ${m.title}`, () => {
      const report = mutated(m.edit, m.options);
      expect([rule, firedBy(report).includes(rule)]).toEqual([rule, true]);
    });
  }
});
