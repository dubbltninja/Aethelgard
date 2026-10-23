// The Dialogue screen (U66; DESIGN §13.2, §16.3): the pure model (speakers, numbered answers, greyed reasons, the
// back-log, the Apex prompt), then DialogueView's buttons and names driven through tests/unit/ui/tree.ts, the NpcSigil
// portraits, and the App routing. The container's keys and focus are e2e's (tests/e2e/dialogue.spec.ts).
import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildContentPack } from '@content/index';
import { memoryStorage, type ContentPack, type GameState, type Profile } from '@engine/index';
import { App } from '@ui/App';
import { FRAME, NpcSigil, portraitParts } from '@ui/art/NpcSigil';
import { DialogueLostView, DialogueView, SpeakerPortrait } from '@ui/screens/DialogueScreen';
import { backlog, choiceKey, choiceName, dialogueModel, readable, speakerModel, type ChoiceRow, type DialogueModel } from '@ui/screens/dialogueModel';
import { createGameStore } from '@ui/store/gameStore';
import { freshProfile } from '@ui/store/profile';
import { GameProvider } from '@ui/store/useGame';
import { fixturePack, miniContentTables } from '@tests/fixtures/miniContent';
import { all, byName, call, expand, nameOf } from './tree';

const content = fixturePack();

/** The fixture with the Echo line's closed text authored (the engine greys a line only when its content gives a reason). */
const greying: ContentPack = buildContentPack(
  {
    ...miniContentTables,
    dialogues: miniContentTables.dialogues.map((scene) => ({
      ...scene,
      nodes: scene.nodes.map((n) => ({ ...n, choices: (n.choices ?? []).map((c) => (c.id === 'it_spoke' ? { ...c, disabledText: '(You have not heard it speak.)' } : c)) })),
    })),
  },
  { version: 'u66-test' },
);

function talking(opts: { loop?: number; echoes?: string[]; pack?: ContentPack } = {}): { state: GameState; profile: Profile; store: ReturnType<typeof createGameStore> } {
  const pack = opts.pack ?? content;
  const profile = { ...freshProfile('d'), echoes: opts.echoes ?? [] };
  const store = createGameStore(pack, profile, { storage: null });
  store.shell.newGame('Ann', 'ranger', 'dlg');
  if (opts.loop !== undefined) {
    const s = structuredClone(store.getState());
    s.meta.loop = opts.loop;
    const live = createGameStore(pack, profile, { initialState: s, storage: null });
    live.dispatch({ type: 'talk', npcId: 'npc_ilyra' });
    return { state: live.getState(), profile: live.getProfile(), store: live };
  }
  store.dispatch({ type: 'talk', npcId: 'npc_ilyra' });
  return { state: store.getState(), profile: store.getProfile(), store };
}

describe('speakerModel', () => {
  const { state } = talking();

  test('an NPC: name, role, faction, portrait; a companion is a companion; the narrator has no face', () => {
    expect(speakerModel('npc_ilyra', state, content)).toMatchObject({ kind: 'npc', name: 'Ilyra', faction: 'Remnants', portrait: { sigil: 'quill' } });
    expect(speakerModel('ilyra', state, content)).toMatchObject({ kind: 'companion', name: 'Ilyra', role: 'Companion' });
    expect(speakerModel('npc_tamsin_reed', state, content)).toMatchObject({ role: 'Merchant' });
    expect(speakerModel('narrator', state, content)).toMatchObject({ kind: 'narrator', name: null, portrait: null });
  });

  test('the player speaks as themselves with their class sigil; a creature draws its own sigil; an unknown id gets a readable name', () => {
    expect(speakerModel('player', state, content)).toMatchObject({ kind: 'player', name: 'Ann', portrait: { sigil: 'ranger' } });
    const creature = speakerModel('cr_chronos_tyrant_unveiled', state, content);
    expect(creature).toMatchObject({ kind: 'creature', portrait: null });
    expect(creature.creature?.id).toBe('cr_chronos_tyrant_unveiled');
    expect(speakerModel('npc_old_fennick', state, content)).toMatchObject({ kind: 'npc', name: 'Old Fennick', portrait: null, creature: null });
  });

  test('readable drops the id prefix and capitalises', () => {
    expect(readable('npc_old_fennick')).toBe('Old Fennick');
    expect(readable('fam_ley_born')).toBe('Ley Born');
    expect(readable('plain')).toBe('Plain');
  });
});

describe('choices', () => {
  test('keys are 1–9 in displayed order, then none; the name leads with its number', () => {
    expect(choiceKey(0)).toBe('1');
    expect(choiceKey(8)).toBe('9');
    expect(choiceKey(9)).toBeNull();
    const open: ChoiceRow = { id: 'x', key: '2', text: 'Ask', enabled: true, reason: null, tags: [{ id: 'echo', label: 'Echo' }], echo: 'It Speaks' };
    expect(choiceName(open)).toBe('2: Ask, echo line, you know It Speaks');
    const shut: ChoiceRow = { id: 'y', key: null, text: 'Hmm', enabled: false, reason: '(You do not yet know this)', tags: [], echo: null };
    expect(choiceName(shut)).toBe('Hmm, unavailable: (You do not yet know this)');
  });
});

describe('dialogueModel', () => {
  test('the first meeting in Loop 1: Ilyra speaks, the answers are numbered, nothing greyed that is not hers to see', () => {
    const { state, profile, store } = talking();
    const model = dialogueModel(state, content, profile, store.getLegal())!;
    expect(model).toMatchObject({ sceneId: 'scene_first_meeting_ilyra', nodeId: 'greet', title: 'The whispers are louder', mood: 'warm', canContinue: false, backlog: [] });
    expect(model.speaker).toMatchObject({ name: 'Ilyra', kind: 'npc' });
    expect(model.place).toBe('Whispering Ruins');
    const rows = model.choices.map((c) => [c.key, c.id, c.enabled]);
    expect(rows.slice(0, 2)).toEqual([
      ['1', 'yes', true],
      ['2', 'no', true],
    ]);
    expect(model.choices.find((c) => c.id === 'it_spoke')).toBeUndefined(); // no reason authored: the engine hides it
  });

  test('Loop 2: the loop-aware variant is read, the "done this before" line opens; a missing Echo greys the Echo line with its reason (D-105)', () => {
    const { state, profile, store } = talking({ loop: 2, pack: greying });
    const model = dialogueModel(state, greying, profile, store.getLegal())!;
    expect(model.text).toContain('smudge of ink');
    expect(model.choices.find((c) => c.id === 'done_before')).toMatchObject({ enabled: true });
    const echo = model.choices.find((c) => c.id === 'it_spoke');
    expect(echo).toMatchObject({ enabled: false, tags: [{ id: 'echo', label: 'Echo' }] });
    expect(echo?.reason).toBe('(You have not heard it speak.)');
    expect(echo?.echo).toBeNull();
  });

  test('a known Echo opens its line and names the Echo the player knows', () => {
    const { state, profile, store } = talking({ loop: 2, echoes: ['echo_tyrant_speaks'], pack: greying });
    const model = dialogueModel(state, greying, profile, store.getLegal())!;
    expect(model.choices.find((c) => c.id === 'it_spoke')).toMatchObject({ enabled: true, echo: 'It Speaks' });
  });

  test('after an answer the node moves on, the back-log holds the line and the answer, and Continue ends the scene', () => {
    const { store } = talking();
    store.dispatch({ type: 'choose', choiceId: 'no' });
    const state = store.getState();
    const profile = store.getProfile();
    const model = dialogueModel(state, content, profile, store.getLegal())!;
    expect(model).toMatchObject({ nodeId: 'declined', canContinue: true, endsScene: true, choices: [] });
    expect(model.speaker.kind).toBe('narrator');
    expect(model.backlog).toHaveLength(1);
    expect(model.backlog[0]).toMatchObject({ chose: 'No.', speaker: { name: 'Ilyra' } });
    expect(backlog(state, content, profile)).toEqual(model.backlog);
  });

  test('no scene open, or a scene that is no longer in the pack, gives no model', () => {
    const { state, profile } = talking();
    expect(dialogueModel({ ...state, mode: 'explore', dialogue: null }, content, profile, [])).toBeNull();
    const lost = structuredClone(state);
    lost.dialogue!.sceneId = 'scene_gone';
    expect(dialogueModel(lost, content, profile, [])).toBeNull();
    expect(backlog(lost, content, profile)).toEqual([]);
    expect(backlog({ ...state, dialogue: null }, content, profile)).toEqual([]);
  });

  test('the companion at the party’s side is listening', () => {
    const { state, profile, store } = talking();
    const s = structuredClone(state);
    s.companions.activeId = 'ilyra';
    s.companions.recruited.ilyra = { id: 'ilyra', recruited: true, loyalty: 10, ko: false, dead: false, waitingAt: null } as unknown as GameState['companions']['recruited'][string];
    const model = dialogueModel(s, content, profile, store.getLegal())!;
    expect(model.listener).toMatchObject({ name: 'Ilyra', sigil: 'quill' });
    s.companions.recruited.ilyra!.ko = true;
    expect(dialogueModel(s, content, profile, store.getLegal())!.listener).toBeNull();
  });
});

function sample(over: Partial<DialogueModel> = {}): DialogueModel {
  const { state, profile, store } = talking({ loop: 2, pack: greying });
  return { ...dialogueModel(state, greying, profile, store.getLegal())!, ...over };
}

describe('DialogueView', () => {
  test('one named button per answer; an open one chooses, a greyed one explains and does nothing', () => {
    const choose = mock((_id: string) => undefined);
    const model = sample();
    const tree = expand(<DialogueView model={model} onChoose={choose} onContinue={() => undefined} />);
    expect(all(tree, 'h1').map(nameOf)).toEqual(['The whispers are louder']);
    expect(all(tree, 'ul').find((u) => u.props['aria-label'] === 'Your answers')).toBeDefined();
    const yes = byName(tree, 'button', '1: Yes.');
    expect(yes.props['data-autofocus']).toBe('');
    expect(yes.props['aria-keyshortcuts']).toBe('1');
    call(yes, 'onClick');
    expect(choose.mock.calls).toEqual([['yes']]);
    const shut = all(tree, 'button').find((b) => b.props['data-choice-id'] === 'it_spoke')!;
    expect(shut.props['aria-disabled']).toBe('true');
    expect(shut.props['aria-describedby']).toBe('choice-reason-it_spoke');
    expect(nameOf(shut)).toContain('unavailable');
    call(shut, 'onClick');
    expect(choose.mock.calls).toHaveLength(1);
    expect(all(tree, 'button').filter((b) => b.props['data-autofocus'] === '')).toHaveLength(1);
  });

  test('a node with nothing to answer shows Continue, and the last one says it ends the conversation', () => {
    const go = mock(() => undefined);
    const model = sample({ choices: [], canContinue: true, endsScene: false });
    const tree = expand(<DialogueView model={model} onChoose={() => undefined} onContinue={go} />);
    call(byName(tree, 'button', /^Continue/), 'onClick');
    expect(go.mock.calls).toHaveLength(1);
    expect(all(tree, 'ul')).toHaveLength(0);
    const last = expand(<DialogueView model={{ ...model, endsScene: true }} onChoose={() => undefined} onContinue={go} />);
    expect(byName(last, 'button', /^End the conversation/).props['data-autofocus']).toBe('');
  });

  test('the back-log is a closed list of earlier lines with the answers taken; the listener and the speaker’s role show', () => {
    const { store } = talking();
    store.dispatch({ type: 'choose', choiceId: 'no' });
    const model = dialogueModel(store.getState(), content, store.getProfile(), store.getLegal())!;
    const html = renderToStaticMarkup(<DialogueView model={{ ...model, listener: { name: 'Ilyra', sigil: 'quill' } }} onChoose={() => undefined} onContinue={() => undefined} />);
    expect(html).toContain('Earlier in this conversation (1)');
    expect(html).toContain('You: </span>No.');
    expect(html).toContain('Ilyra is listening.');
    expect(html).toContain('data-screen="dialogue"');
    expect(html).toContain('aria-live="polite"');
    const none = renderToStaticMarkup(<DialogueView model={sample({ backlog: [] })} onChoose={() => undefined} onContinue={() => undefined} />);
    expect(none).not.toContain('dialogue__backlog');
  });

  test('echo, class, faction and companion answers show their glyph and word; the Echo the player knows is named', () => {
    const row = (id: string, tag: 'echo' | 'class' | 'faction' | 'companion', echo: string | null): ChoiceRow => ({ id, key: '1', text: id, enabled: true, reason: null, tags: [{ id: tag, label: tag }], echo });
    const model = sample({ choices: [row('a', 'echo', 'It Speaks'), row('b', 'class', null), row('c', 'faction', null), row('d', 'companion', null)] });
    const html = renderToStaticMarkup(<DialogueView model={model} onChoose={() => undefined} onContinue={() => undefined} />);
    expect(html).toContain('choice-tag--echo');
    expect(html).toContain('choice-tag--class');
    expect(html).toContain('choice-tag--faction');
    expect(html).toContain('choice-tag--companion');
    expect(html).toContain('You know: It Speaks');
    const tenth = sample({ choices: [{ ...row('z', 'echo', null), key: null, tags: [] }] });
    expect(renderToStaticMarkup(<DialogueView model={tenth} onChoose={() => undefined} onContinue={() => undefined} />)).toContain('choice-btn__key--none');
  });

  test('the lost view offers the title only where the engine allows it', () => {
    const leave = mock(() => undefined);
    expect(renderToStaticMarkup(<DialogueLostView canLeave={false} onTitle={leave} />)).not.toContain('Return to title');
    const tree = expand(<DialogueLostView canLeave onTitle={leave} />);
    call(byName(tree, 'button', 'Return to title'), 'onClick');
    expect(leave.mock.calls).toHaveLength(1);
  });
});

describe('portraits', () => {
  test('the same key draws the same face; the frame is a sized, decorative or named image', () => {
    expect(portraitParts('quill')).toEqual(portraitParts('quill'));
    const keys = ['quill', 'inkwell', 'anvil', 'lantern', 'ranger', 'wizard', 'knight', 'rogue', 'moth', 'stag'];
    expect(new Set(keys.map((k) => JSON.stringify(portraitParts(k)))).size).toBeGreaterThan(3);
    expect(FRAME).toContain('M22 12');
    const plain = renderToStaticMarkup(<NpcSigil sigilKey="quill" />);
    expect(plain).toContain('npc-sigil');
    expect(plain).toContain('aria-hidden="true"');
    const named = renderToStaticMarkup(<NpcSigil sigilKey="quill" accent="remnants" size="sm" title="Ilyra" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('Ilyra');
    expect(named).toContain('remnants');
  });

  test('SpeakerPortrait: a person, a creature and the narrator each draw something', () => {
    const { state } = talking();
    for (const id of ['npc_ilyra', 'cr_chronos_tyrant_unveiled', 'narrator', 'player']) {
      const html = renderToStaticMarkup(<SpeakerPortrait speaker={speakerModel(id, state, content)} />);
      expect(html.length).toBeGreaterThan(20);
    }
    expect(renderToStaticMarkup(<SpeakerPortrait speaker={speakerModel('narrator', state, content)} />)).toContain('narrator-mark');
  });
});

describe('App routing', () => {
  test('dialogue mode renders the Dialogue screen; a scene lost from the pack renders the way out', () => {
    const { state, profile } = talking();
    const live = createGameStore(content, profile, { initialState: state, storage: memoryStorage() });
    const html = renderToStaticMarkup(
      <GameProvider value={live}>
        <App />
      </GameProvider>,
    );
    expect(html).toContain('data-screen="dialogue"');
    expect(html).toContain('data-scene="scene_first_meeting_ilyra"');
    expect(html).toContain('1: Yes.');
    const lost = structuredClone(state);
    lost.dialogue!.sceneId = 'scene_gone';
    const gone = createGameStore(content, profile, { initialState: lost, storage: memoryStorage() });
    const goneHtml = renderToStaticMarkup(
      <GameProvider value={gone}>
        <App />
      </GameProvider>,
    );
    expect(goneHtml).toContain('lost its thread');
  });
});
