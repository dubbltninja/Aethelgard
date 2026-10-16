// U39: the coverage report (PLAN §7.7) — the union of runs against what the pack defines.
import { describe, expect, test } from 'bun:test';
import { computeCoverage, coverageRatios, dialogueChoiceIds, neverLists } from '@sim/coverage';
import { storyPack } from '@tests/fixtures/storyContent';
import { blankResult } from './helpers';

const story = storyPack();

describe('dialogueChoiceIds', () => {
  test('every scene/choice pair of the pack, sorted and unique', () => {
    const ids = dialogueChoiceIds(story);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual([...new Set(ids)].sort());
    expect(ids.every((id) => /^scene_\w+\/\w+$/.test(id))).toBe(true);
  });
});

describe('computeCoverage', () => {
  test('no runs: nothing reached, everything on the punch list', () => {
    const c = computeCoverage(story, []);
    expect(c.quests).toMatchObject({ total: 7, completed: [], startedNeverCompleted: [] });
    expect(c.quests.neverStarted).toHaveLength(7);
    expect(c.locations).toMatchObject({ total: 7, visited: [] });
    expect(c.endings.total).toBe(5); // the pack's three true endings plus the two closers
    expect(c.endings.never).toEqual(['closer_escape', 'closer_fall', 'ending_mending', 'ending_unbound', 'ending_wardens_vigil']);
    expect(c.abilities.used).toEqual([]);
    expect(c.dialogueChoices.taken).toEqual([]);
  });

  test('the union of runs, in the pack\'s id order; ids the pack does not define are ignored', () => {
    const choices = dialogueChoiceIds(story);
    const a = blankResult({
      questsStarted: ['q_echo_crystal', 'q_clear_path'],
      questsCompleted: ['q_echo_crystal', 'q_not_in_pack'],
      locationsVisited: ['loc_whispering_ruins', 'loc_nowhere'],
      endings: ['ending_unbound'],
      closers: ['closer_escape'],
      creaturesSeen: ['cr_corrupted_shade', 'cr_glowfen_mireling'],
      creaturesKilled: { cr_corrupted_shade: 2, cr_glowfen_mireling: 0 },
      itemsObtained: ['item_glow_moss'],
      echoes: ['echo_tyrant_speaks'],
      codexUnlocked: ['codex_nope'],
      abilitiesUsed: { rgr_marked_shot: 3, wiz_fireball: 0 },
      choicesTaken: [choices[0] as string],
    });
    const b = blankResult({ questsCompleted: ['q_clear_path'], closers: ['closer_fall'], locationsVisited: ['loc_shattered_library'], creaturesKilled: { cr_glowfen_mireling: 1 }, abilitiesUsed: { wiz_fireball: 1 } });
    const c = computeCoverage(story, [a, b]);
    expect(c.quests.completed).toEqual(['q_clear_path', 'q_echo_crystal']);
    expect(c.quests.startedNeverCompleted).toEqual([]);
    expect(c.quests.neverStarted).not.toContain('q_echo_crystal');
    expect(c.locations.visited).toEqual(['loc_shattered_library', 'loc_whispering_ruins']);
    expect(c.endings.reached).toEqual(['closer_escape', 'closer_fall', 'ending_unbound']);
    expect(c.creatures).toMatchObject({ seen: ['cr_corrupted_shade', 'cr_glowfen_mireling'], killed: ['cr_corrupted_shade', 'cr_glowfen_mireling'] });
    expect(c.creatures.neverKilled).not.toContain('cr_corrupted_shade');
    expect(c.items.obtained).toEqual(['item_glow_moss']);
    expect(c.echoes.gained).toEqual(['echo_tyrant_speaks']);
    expect(c.codex.unlocked).toEqual([]);
    expect(c.abilities.used).toEqual(['rgr_marked_shot', 'wiz_fireball']);
    expect(c.dialogueChoices.taken).toEqual([choices[0] as string]);
  });

  test('a quest started in one run and never completed is listed as such', () => {
    const c = computeCoverage(story, [blankResult({ questsStarted: ['q_clear_path'] }), blankResult({ questsCompleted: ['q_echo_crystal'], questsStarted: ['q_echo_crystal'] })]);
    expect(c.quests.startedNeverCompleted).toEqual(['q_clear_path']);
  });
});

describe('coverageRatios and neverLists', () => {
  test('ratios per kind; an empty kind counts as covered', () => {
    const c = computeCoverage({ ...story, quests: {} }, [blankResult({ locationsVisited: ['loc_whispering_ruins'] })]);
    const ratios = coverageRatios(c);
    expect(ratios.map((r) => r.kind)).toEqual(['quests', 'locations', 'endings', 'creatures', 'items', 'echoes', 'codex', 'abilities', 'dialogueChoices']);
    expect(ratios[0]).toMatchObject({ covered: 0, total: 0, ratio: 1 });
    expect(ratios[1]).toMatchObject({ verb: 'visited', covered: 1, total: 7 });
    expect(ratios[1]?.ratio).toBeCloseTo(1 / 7);
  });

  test('the punch list omits the kinds with nothing left', () => {
    const c = computeCoverage(story, []);
    const lists = neverLists(c);
    expect(lists.map((l) => l.label)).toContain('quests never started');
    expect(lists.map((l) => l.label)).not.toContain('quests started, never completed');
    const complete = computeCoverage({ ...story, quests: {}, locations: {}, endings: {}, creatures: {}, items: {}, echoes: {}, codex: {}, abilities: {}, dialogues: {} }, [blankResult({ closers: ['closer_escape', 'closer_fall'] })]);
    expect(neverLists(complete)).toEqual([]);
  });
});
