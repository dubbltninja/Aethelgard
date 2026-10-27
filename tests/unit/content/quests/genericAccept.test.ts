// U81b2 (D-146 ruling 2): the generic Accept (`acceptQuest`, any talk with a quest's giver) must never strand a quest. A quest
// whose offer scene starts it and moves it on in one effect list (its first stage "passes through" the scene) would otherwise sit
// on that first stage for the loop: nothing else advances it and the offer scene (`notStarted`) never plays again. Every such
// quest with a giver lets its first stage pass through by itself (`advanceWhen` the quest is active) to the stage the scene names.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import type { Action, GameState } from '@engine/index';
import type { Effect } from '@schema/effect';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';

const pack = buildContentPack();

/** quest id → the stages some dialogue effect list starts it and moves it to in one go. */
function passThroughs(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) {
      const effects = x as Effect[];
      const starts = effects.flatMap((e) => (e !== null && typeof e === 'object' && 'questStart' in e ? [e.questStart] : []));
      for (const e of effects) {
        if (e === null || typeof e !== 'object' || !('questAdvance' in e)) continue;
        if (!starts.includes(e.questAdvance.quest)) continue;
        const set = out.get(e.questAdvance.quest) ?? new Set<string>();
        set.add(e.questAdvance.stage);
        out.set(e.questAdvance.quest, set);
      }
      for (const y of x) walk(y);
    } else if (x !== null && typeof x === 'object') for (const v of Object.values(x)) walk(v);
  };
  walk(pack.dialogues);
  return out;
}

describe('the generic Accept never strands a quest (D-146 ruling 2)', () => {
  const found = passThroughs();

  test('the pass-through quests are the two of Caelum (a new one is checked by the next test too)', () => {
    expect([...found.keys()].sort()).toEqual(['q_a_boy_from_a_doomed_city', 'q_the_apprentices_errand']);
  });

  test('every quest with a giver whose scene starts and advances it passes its first stage by itself, to the scene\'s stage', () => {
    for (const [questId, targets] of found) {
      const q = pack.quests[questId];
      expect(q).toBeDefined();
      if (q === undefined || q.giverNpcId === undefined) continue;
      const first = q.stages.find((s) => s.id === (q.firstStage ?? q.stages[0]?.id));
      expect([questId, first?.advanceWhen]).toEqual([questId, { quest: { id: questId, status: 'active' } }]);
      expect([questId, [...targets]]).toEqual([questId, [first?.next as string]]);
    }
  });

  test('played: Accept at the Garret moves the errand and the boy\'s quest on, as the offer scenes do', () => {
    const inBefore = (s: GameState): void => {
      s.before = { day: 3, resets: 0 };
      s.clock.frozen = true;
      s.flags['flag_before_day_3'] = true;
      s.flags['flag_entered_before_via_nexus'] = true;
      s.counters.custom['before_watch'] = 1;
      s.counters.custom['before_resets'] = 0;
    };
    const profile = freshProfile({ loopCounter: 2, echoes: ['echo_before_route'] });
    const talk: Action = { type: 'talk', npcId: 'npc_caelum' };
    const accept = (questId: string): Action => ({ type: 'acceptQuest', questId });
    const garret = makeState({ loop: 2, locationId: 'loc_apprentices_garret', patch: inBefore }, { content: pack, profile });
    const errand = play(garret, [talk, accept('q_the_apprentices_errand')], { content: pack, profile });
    expect(errand.state.quests.q_the_apprentices_errand).toMatchObject({ status: 'active', stage: 'cross' });
    const done = makeState(
      { loop: 2, locationId: 'loc_apprentices_garret', quests: { q_the_apprentices_errand: { status: 'completed', stage: 'joined' } }, patch: inBefore },
      { content: pack, profile },
    );
    const boy = play(done, [talk, accept('q_a_boy_from_a_doomed_city')], { content: pack, profile });
    expect(boy.state.quests.q_a_boy_from_a_doomed_city).toMatchObject({ status: 'active', stage: 'door' });
  });
});
