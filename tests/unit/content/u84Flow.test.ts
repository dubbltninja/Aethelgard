// U84 (REPORT U79 #4, #5; DESIGN §16.8): two first-hour frictions, played on the real pack.
//   #4  Ilyra offers the Lost Scroll in the same talk the crystal is given (its condition, the crystal quest done, holds
//       from that moment), instead of only on a later talk.
//   #11 A choice that sets a flag, and a quest completed inside a scene, are autosave checkpoints.
//   #13 The place card says "Camp" only where the camp fire can be used; respec's refusal says where to go.
//   #5  While Ilyra's quest is open the journal says "take the Crystal": it lies in plain sight in the Library, no
//       *Look around* needed. Without the quest (or the Echo) the alcove search stays.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { step, type Action, type GameState, type Profile } from '@engine/index';
import { placeModel } from '@ui/screens/exploreModel';
import { freshProfile, makeState } from '@tests/fixtures/helpers';

const pack = buildContentPack();

function run(s0: GameState, actions: readonly Action[], p0: Profile = freshProfile()): GameState {
  let s = s0;
  let p = p0;
  for (const a of actions) {
    const out = step(s, a, pack, p);
    const rejected = out.events.find((e) => e.t === 'actionRejected');
    if (rejected !== undefined) throw new Error(`${JSON.stringify(a)}: ${JSON.stringify(rejected)}`);
    s = out.state;
    p = out.profile;
  }
  return s;
}

describe('U84: the first hour', () => {
  test("#4: giving the Crystal, Ilyra asks for the Lost Scroll in the same talk; Yes starts it", () => {
    const s0 = makeState({ locationId: 'loc_whispering_ruins', items: ['item_echo_crystal'], quests: { q_echo_crystal: 'return' } }, { content: pack });
    let s = run(s0, [{ type: 'talk', npcId: 'npc_ilyra' }]);
    expect(s.dialogue?.sceneId).toBe('scene_echo_crystal');
    s = run(s, [{ type: 'choose', choiceId: 'give' }]);
    for (let i = 0; i < 4 && s.dialogue !== null && s.dialogue.nodeId !== 'scroll_ask'; i++) s = run(s, [{ type: 'continue' }]);
    expect(s.dialogue?.nodeId).toBe('scroll_ask');
    expect(s.quests['q_echo_crystal']?.status).toBe('completed');
    s = run(s, [{ type: 'choose', choiceId: 'yes' }]);
    expect(s.quests['q_lost_scroll']?.status).toBe('active');
  });

  test('#11: a choice that sets a flag, and a quest completed inside a scene, are autosave checkpoints (written when the scene closes)', () => {
    const s0 = makeState({ locationId: 'loc_whispering_ruins', items: ['item_echo_crystal'], quests: { q_echo_crystal: 'return' } }, { content: pack });
    const talked = run(s0, [{ type: 'talk', npcId: 'npc_ilyra' }]);
    const give = step(talked, { type: 'choose', choiceId: 'give' }, pack, freshProfile());
    const reasons = give.events.flatMap((e) => (e.t === 'autosaveCheckpoint' ? [e.reason] : []));
    expect(reasons).toContain('dialogueOutcome'); // flag_crystal_given
    expect(reasons).toContain('questCompleted'); // the crystal quest, done inside the scene
    expect(give.state.mode).toBe('dialogue');
  });

  test('#13: the place card says "Camp" only where the camp fire is usable, so respec works wherever it says Camp', () => {
    const p = freshProfile();
    const library = makeState({ locationId: 'loc_shattered_library' }, { content: pack });
    expect(placeModel(library, pack, p)?.facts).not.toContain('Camp'); // Ilyra's nook: Loop 2+, Trusted
    const ruins = makeState({ locationId: 'loc_whispering_ruins' }, { content: pack });
    expect(placeModel(ruins, pack, p)?.facts).toContain('Camp');
    const out = step(library, { type: 'respec' }, pack, p).events.find((e) => e.t === 'actionRejected');
    expect(out).toMatchObject({ reason: 'You can only rethink your path at a camp fire: rest at a place marked Camp or Wild camp' });
  });

  test('#5: with the quest open, the Crystal lies on the Library floor on arrival; without it, it waits for the search', () => {
    const go: Action = { type: 'move', to: 'loc_shattered_library' };
    const withQuest = run(makeState({ locationId: 'loc_darkened_corridor', quests: { q_echo_crystal: 'reach_library' } }, { content: pack }), [go]);
    expect(withQuest.world.locationStates['loc_shattered_library']?.items.some((i) => i.itemId === 'item_echo_crystal')).toBe(true);
    const without = run(makeState({ locationId: 'loc_darkened_corridor' }, { content: pack }), [go]);
    expect(without.world.locationStates['loc_shattered_library']?.items.some((i) => i.itemId === 'item_echo_crystal') ?? false).toBe(false);
  });
});
