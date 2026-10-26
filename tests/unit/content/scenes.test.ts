// U62: STORY §13's 21 key scenes, held to STORY read at test time — every spoken line in its speaker's mouth (or, for the
// lines that are a place's description, an event's text or an encounter's intro, where that is), the legacy lines verbatim to
// legacy/*.py, the choices and effects §13 names — and the five scenes no quest owned (src/content/shared/dialogues/scenes.ts),
// their hooks (the engine's four, the Ruins' event) and their play on the real pack: the Tyrant's fall with and without Brak,
// Brak's stand from the Nexus, the thirtieth dawn with whoever is present, Ilyra at the portal, the waking in Loop 2.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { FROM_LOOP_2, SCENE_PRIORITY } from '@content/shared/dialogues/common';
import { BRAK_AT_THE_APEX, HORDE_LINE_NPCS, dialogues as RAW_SCENES } from '@content/shared/dialogues/scenes';
import {
  BRAK_QUESTS,
  CLOSER_TEXT,
  FLAG_BRAK_KEPT_AWAY,
  HORDE_TEXT,
  legalActions,
  type Action,
  type GameEvent,
  type GameState,
  type Profile,
} from '@engine/index';
import type { DialogueScene } from '@schema/dialogue';
import { freshProfile, makeState, play } from '@tests/fixtures/helpers';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const STORY = read('docs/STORY.md');
const LEGACY = [read('legacy/echoes_of_aethelgard.py'), read('legacy/aethelgard_data.py')].join('\n');
const pack = buildContentPack();

const need = <T>(v: T | undefined, what: string): T => {
  if (v === undefined) throw new Error(`missing ${what}`);
  return v;
};
const scene = (id: string): DialogueScene => need(pack.dialogues[id], id);
const node = (sceneId: string, nodeId: string) => need(scene(sceneId).nodes.find((n) => n.id === nodeId), `${sceneId}.${nodeId}`);
const choice = (sceneId: string, nodeId: string, choiceId: string) => need(node(sceneId, nodeId).choices.find((c) => c.id === choiceId), `${sceneId}.${nodeId}.${choiceId}`);
const loc = (id: string) => need(pack.locations[id], id);

const APEX = 'loc_temporal_breach_apex';
const NEXUS = 'loc_chronos_nexus';
const LIBRARY = 'loc_shattered_library';
const RUINS = 'loc_whispering_ruins';
const UNVEILED = 'cr_chronos_tyrant_unveiled';

/** STORY §13's 21, in its order. */
const KEY_SCENES = [
  'scene_first_meeting_ilyra',
  'scene_echo_crystal',
  'scene_heartstone_choice',
  'scene_tyrant_defeat',
  'scene_braks_stand',
  'scene_ilyra_portal',
  'scene_waking_loop_2',
  'scene_dask_introduction',
  'scene_nyx_unmasking',
  'scene_tyrant_first_words',
  'scene_braks_brother',
  'scene_anchor_in_the_conflux',
  'scene_caelum_crossing',
  'scene_the_first_drowned',
  'scene_clock_expiry',
  'scene_ending_vigil',
  'scene_ending_mending',
  'scene_ending_dawn',
  'scene_ending_silence',
  'scene_ending_archive',
  'scene_ending_unbound',
];
/** This unit's five. */
const NEW_SCENES = ['scene_tyrant_defeat', 'scene_braks_stand', 'scene_ilyra_portal', 'scene_waking_loop_2', 'scene_clock_expiry'];

/**
 * §13 lines that are said by a place, an event, an encounter or the engine, not by the scene (the scene must not say them
 * twice): where each lives. Checked verbatim against that carrier.
 */
const CARRIED: Record<string, { starts: string; by: () => string }[]> = {
  scene_tyrant_first_words: [
    { starts: 'Reality tears here in violent seams.', by: () => loc(APEX).description },
    { starts: 'You sense danger... The Chronos Tyrant approaches!', by: () => loc(APEX).encounters.map((e) => e.intro ?? '').join('\n') },
  ],
  scene_ilyra_portal: [{ starts: 'The Shattered Library. The air here crackles', by: () => loc(LIBRARY).descriptionVariants.map((v) => v.text).join('\n') }],
  scene_waking_loop_2: [
    { starts: 'The air smells of ozone and decay', by: () => loc(RUINS).description },
    { starts: 'A low, resonant hum vibrates under your skin', by: () => loc(RUINS).events.map((e) => e.text).join('\n') },
  ],
};

// ---- Reading STORY §13 ---------------------------------------------------------------------------------------------------------

const STORY_FLAT = STORY.replace(/\n\s*>?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ');
/** Bracketed stage directions are not spoken. */
const unstaged = (text: string): string => text.replace(/ \([^()]*\)/g, '').replace(/^\([^()]*\)\s*/g, '');
const inStory = (text: string): boolean => text.split('\n').every((line) => STORY_FLAT.includes(line) || unstaged(STORY_FLAT).includes(line));
function storyScene(sceneId: string): { title: string; lines: string[] } {
  const start = STORY.indexOf(`#### \`${sceneId}\``);
  if (start < 0) throw new Error(`no STORY §13 scene ${sceneId}`);
  const ends = ['\n#### ', '\n## ', '\n---'].map((m) => STORY.indexOf(m, start + 10)).filter((i) => i >= 0);
  const block = STORY.slice(start, ends.length === 0 ? undefined : Math.min(...ends));
  const title = (block.split('\n')[0] as string).split(' — ')[1] as string;
  const lines = block
    .split('\n- ')
    .slice(1)
    .map((l) => unstaged(l.replace(/\n\s*/g, ' ').replace(/\*/g, '').trim()));
  return { title, lines };
}
/** The legacy sources as one line: implicit string concatenation joined, `\"` unescaped; the "dust,," typo as STORY corrects it. */
const LEGACY_FLAT = LEGACY.replace(/"\s*\n\s*"/g, '')
  .replace(/\\"/g, '"')
  .replace(/\s+/g, ' ')
  .replace('dust,,', 'dust,');

const SPEAKER: Record<string, string[]> = {
  'The Tyrant': [UNVEILED],
  Caelum: ['npc_caelum', 'caelum'],
  Ilyra: ['npc_ilyra', 'ilyra'],
  Dask: ['npc_dask', 'dask'],
  Nyx: ['npc_nyx', 'nyx'],
  Brak: ['npc_brak', 'brak'],
  Kaelen: ['npc_kaelen_stonehand'],
  Oriel: ['cr_drowned_archivist'],
};
const LABELS = new RegExp(`(?:^|\\s)(${[...Object.keys(SPEAKER), 'Wayfinder'].join('|')}): `, 'g');
const MARKERS = /\[(legacy[^\]]*|new|loop[^\]]*|Loop[^\]]*|Ilyra present|Brak present|Nyx present|Ilyra|Dask|Veil route|Crystal route|Caelum absent|Caelum present[^\]]*|6 Dark Spellbooks read|`[^\]]*)\]/g;
/** A bullet's segments: (speaker, text), the condition tags dropped. */
function segments(line: string): [string, string][] {
  const bare = line.replace(MARKERS, '').replace(/\s+/g, ' ').trim();
  const parts: [string, string][] = [];
  let idx = 0;
  let speaker = 'narrator';
  for (const m of bare.matchAll(LABELS)) {
    const text = bare.slice(idx, m.index).trim();
    if (text !== '') parts.push([speaker, text]);
    speaker = m[1] as string;
    idx = (m.index ?? 0) + m[0].length;
  }
  const tail = bare.slice(idx).trim();
  if (tail !== '') parts.push([speaker, tail]);
  return parts;
}
/** Sentences of a segment: quotes and " / " joins dropped, the "N →" of a choice outcome dropped; three words or more, or one capitalized word. */
const sentences = (text: string): string[] =>
  text
    .replace(/^\d+ → /, '')
    .replace(/^Enter → /, '')
    .split(/(?<=[.?!—])\s+|\s\/\s/)
    .map((t) => t.trim().replace(/^\/\s*/, '').replace(/^["'“‘]+|["'”’]+$/g, '').trim())
    .filter((t) => t.split(' ').length >= 3 || /^[A-Z][a-z]+\.$/.test(t));
/** §13 narration that frames a line instead of being one: the frame is dropped before the line is looked for. */
const FRAMES = ['The narration names him once, the way the Nomads never do: '];

// ---- The 21 ----------------------------------------------------------------------------------------------------------------------

describe('STORY §13’s 21 key scenes', () => {
  test('all 21 exist, titled as STORY names them; the five of this unit are in scenes.ts', () => {
    for (const id of KEY_SCENES) expect([id, scene(id).title]).toEqual([id, storyScene(id).title]);
    expect(RAW_SCENES.filter((s) => NEW_SCENES.includes(s.id)).map((s) => s.id)).toEqual(NEW_SCENES);
  });

  test('line for line: every sentence of every spoken line is in the scene in its speaker’s mouth, the Wayfinder’s lines are its choices, and a line a place or an encounter says is said there, not twice', () => {
    for (const id of KEY_SCENES) {
      const sc = scene(id);
      const said = (mouths: readonly string[] | null, sentence: string): boolean => {
        const fits = (speaker: string) => mouths === null || mouths.includes(speaker);
        const flat = (t: string) => t.replace(/\n/g, ' ');
        if (sc.nodes.some((n) => fits(n.speaker) && (flat(n.text).includes(sentence) || n.textVariants.some((v) => flat(v.text).includes(sentence))))) return true;
        if (sc.nodes.some((n) => n.choices.some((c) => c.text.includes(sentence)))) return true;
        // a companion's reaction: "Ilyra: "…""
        return sc.companionReactions.some((r) => (mouths === null || mouths.some((m) => r.text.startsWith(`${pack.companions[m]?.name ?? m}:`))) && r.text.includes(sentence));
      };
      const carried = CARRIED[id] ?? [];
      const { lines } = storyScene(id);
      for (const raw of lines) {
        if (raw.startsWith('Purpose.') || raw.startsWith('Effect:')) continue;
        if (raw.startsWith('Choices:')) {
          // the quoted words of a Choices bullet are in the scene somewhere (a choice, a node, a reaction), with two §13 shorthands
          for (const q of raw.split('Effect:')[0]!.matchAll(/"([^"]+)"/g)) {
            const quoted = (q[1] as string).trim();
            if (['He said it.', 'Hour, go.'].includes(quoted)) continue;
            for (const sentence of sentences(quoted)) expect([id, 'Choices', sentence, said(null, sentence)]).toEqual([id, 'Choices', sentence, true]);
          }
          continue;
        }
        if (raw.replace(MARKERS, '').trim() === "Ilyra's spellbook paragraph.") {
          // legacy `handle_ilyra`: the six-Spellbook lore, verbatim
          expect(LEGACY_FLAT).toContain(`"Ilyra: ${node('scene_ilyra_portal', 'lore').text}"`);
          continue;
        }
        const line = FRAMES.reduce((l, f) => l.replace(f, ''), raw);
        const carrier = carried.find((c) => line.replace(MARKERS, '').trim().startsWith(c.starts));
        if (carrier !== undefined) {
          const text = line.replace(MARKERS, '').replace(/\s+/g, ' ').trim();
          expect([id, carrier.starts, carrier.by().replace(/\s+/g, ' ').includes(text)]).toEqual([id, carrier.starts, true]);
          expect([id, carrier.starts, sc.nodes.some((n) => n.text.includes(carrier.starts))]).toEqual([id, carrier.starts, false]);
          continue;
        }
        for (const [speaker, text] of segments(line)) {
          if (speaker === 'Wayfinder') {
            const choices = sc.nodes.flatMap((n) => n.choices.map((c) => c.text));
            expect([id, 'Wayfinder', text, choices.includes(text)]).toEqual([id, 'Wayfinder', text, true]);
            continue;
          }
          const mouths = speaker === 'narrator' ? ['narrator'] : (SPEAKER[speaker] as string[]);
          for (const sentence of sentences(text)) expect([id, speaker, sentence, said(mouths, sentence)]).toEqual([id, speaker, sentence, true]);
        }
      }
    }
  });

  test('the new scenes: every node is tagged; legacy nodes are legacy/*.py verbatim, story nodes are STORY’s, written nodes are the pinned ones', () => {
    const WRITTEN = ['scene_braks_stand.spent', 'scene_ilyra_portal.hold', 'scene_clock_expiry.west'];
    const written: string[] = [];
    for (const s of RAW_SCENES.map((r) => scene(r.id))) {
      for (const n of s.nodes) {
        expect([s.id, n.id, n.tags]).toEqual([s.id, n.id, [n.tags[0] as string]]);
        const tag = n.tags[0];
        if (tag === 'legacy') expect([s.id, n.id, LEGACY_FLAT.includes(n.text)]).toEqual([s.id, n.id, true]);
        else if (tag === 'story') expect([s.id, n.id, inStory(n.text)]).toEqual([s.id, n.id, true]);
        else {
          expect([s.id, n.id, tag]).toEqual([s.id, n.id, 'written']);
          written.push(`${s.id}.${n.id}`);
        }
        for (const v of n.textVariants) expect([s.id, n.id, LEGACY_FLAT.includes(v.text) || inStory(v.text) || v.text.split(' ').some((_, i, w) => inStory(w.slice(i).join(' ')))]).toEqual([s.id, n.id, true]);
      }
    }
    expect(written.sort()).toEqual(WRITTEN.sort());
    // STORY: "dust,," corrected to "dust,"
    expect(node('scene_tyrant_defeat', 'dust').text).toContain('temporal dust, a guttural');
    expect(STORY).toContain('[legacy; "dust,," corrected to "dust,"]');
  });
});

// ---- The five: wiring ----------------------------------------------------------------------------------------------------------

describe('the Tyrant’s fall (scene_tyrant_defeat) and Brak’s stand', () => {
  test('four openings: the Loop 2+ breath with echo_tyrant_speaks, Brak at the Apex as the engine reads it; the tails rejoin', () => {
    const sc = scene('scene_tyrant_defeat');
    const knew = { all: [FROM_LOOP_2, { echo: 'echo_tyrant_speaks' }] };
    expect(sc.entry).toEqual([
      { when: { all: [knew, BRAK_AT_THE_APEX] }, node: 'dust_knew_brak' },
      { when: knew, node: 'dust_knew' },
      { when: BRAK_AT_THE_APEX, node: 'dust_brak' },
      { when: { all: [] }, node: 'dust' },
    ]);
    // WORLD §12.1 `ws_brak_at_apex` as horde.ts `brakComesToApex` reads it: the two legacy quests, the kept-away flag, and the
    // Nexus outcome of q_the_line_he_holds (the choice that grants echo_brak_lives this loop)
    expect(BRAK_AT_THE_APEX).toEqual({
      all: [...BRAK_QUESTS.map((id) => ({ quest: { id, status: 'completed' } })), { not: { flag: FLAG_BRAK_KEPT_AWAY } }, { not: { quest: { id: 'q_the_line_he_holds', stage: 'holds_nexus' } } }],
    });
    const nexus = choice('scene_brak_arc', 'choose', 'nexus');
    expect(nexus.effects).toContainEqual({ grantEcho: 'echo_brak_lives' });
    expect(nexus.effects).toContainEqual({ questAdvance: { quest: 'q_the_line_he_holds', stage: 'holds_nexus' } });
    const chain = (from: string): string[] => {
      const out = [from];
      for (let id = from; ; ) {
        const n = node('scene_tyrant_defeat', id);
        const next = n.choices.length > 0 ? 'end' : (n.next ?? 'end');
        if (next === 'end') return out;
        out.push(next);
        id = next;
      }
    };
    expect(chain('dust_knew_brak')).toEqual(['dust_knew_brak', 'breath_knew_brak', 'knew_knew_brak', 'shrieks_knew_brak', 'arrives', 'shatters', 'spills', 'no_time', 'run']);
    expect(chain('dust_knew')).toEqual(['dust_knew', 'breath_knew', 'knew_knew', 'shrieks_knew', 'shatters_alone', 'spills_alone', 'pulse']);
    expect(chain('dust_brak')).toEqual(['dust_brak', 'shrieks_brak', 'arrives', 'shatters', 'spills', 'no_time', 'run']);
    expect(chain('dust')).toEqual(['dust', 'shrieks', 'shatters_alone', 'spills_alone', 'pulse']);
    expect(node('scene_tyrant_defeat', 'knew_knew').speaker).toBe(UNVEILED);
    expect(node('scene_tyrant_defeat', 'knew_knew').text).toBe('You knew.');
    // the legacy lines are the engine's, word for word (horde.ts keeps them for packs without the scene)
    expect([node('scene_tyrant_defeat', 'dust').text, node('scene_tyrant_defeat', 'shrieks').text]).toEqual([...HORDE_TEXT.tyrantFalls]);
    expect(node('scene_tyrant_defeat', 'arrives').text).toBe(HORDE_TEXT.brakArrives);
    expect([node('scene_tyrant_defeat', 'shatters').text, node('scene_tyrant_defeat', 'spills').text]).toEqual([...HORDE_TEXT.collapse]);
    expect(HORDE_TEXT.brakSpeech.map((l) => l.replace(/^Brak: /, ''))).toEqual([node('scene_tyrant_defeat', 'no_time').text, node('scene_tyrant_defeat', 'run').text]);
    expect(node('scene_tyrant_defeat', 'pulse').text).toBe(HORDE_TEXT.portalPulse);
  });

  test('Run, or (Loop 2+, with Brak) stay one watch: the watch passes, the Nexus, Brak’s stand; its first line earns echo_brak_death', () => {
    const run = node('scene_tyrant_defeat', 'run');
    expect(run.choices.map((c) => [c.id, c.text, c.when, c.next])).toEqual([
      ['run', 'Run.', undefined, 'end'],
      ['stay', 'Stay one watch.', FROM_LOOP_2, 'end'],
    ]);
    expect(choice('scene_tyrant_defeat', 'run', 'stay').effects).toEqual([{ passWatches: 1 }, { teleport: NEXUS }, { startDialogue: 'scene_braks_stand' }]);
    expect(node('scene_tyrant_defeat', 'pulse').choices).toEqual([]);
    const stand = scene('scene_braks_stand');
    expect([stand.npcId, stand.entry, stand.nodes.map((n) => n.id)]).toEqual([undefined, 'wound', ['wound', 'steel', 'waves', 'kaelen', 'named', 'spent']]);
    expect(node('scene_braks_stand', 'wound').onEnter).toEqual([{ grantEcho: 'echo_brak_death' }]);
    expect(stand.nodes.every((n) => n.choices.length === 0)).toBe(true);
    expect(stand.nodes.filter((n) => n.speaker === 'npc_brak').map((n) => n.id)).toEqual(['steel', 'kaelen']);
  });
});

describe('the Last Threshold (scene_ilyra_portal)', () => {
  test('Ilyra’s Horde scene at the Library, the urgent band; the lore once at six tomes; the Loop 2+ sentence once told; Enter the portal? → closer_escape, echo_ilyra_cost from Loop 2', () => {
    const sc = scene('scene_ilyra_portal');
    expect([sc.npcId, sc.priority, sc.when, sc.repeatable]).toEqual(['npc_ilyra', SCENE_PRIORITY.urgent, { all: [{ flag: 'flag_horde_active' }, { location: LIBRARY }] }, true]);
    expect(sc.entry).toEqual([
      { when: { all: [{ counter: { name: 'spellbooks_read', min: 6 } }, { not: { flag: 'flag_ilyra_spellbook_lore' } }] }, node: 'lore' },
      { when: { all: [] }, node: 'made_it' },
    ]);
    expect(node('scene_ilyra_portal', 'lore').onEnter).toEqual([{ setFlag: 'flag_ilyra_spellbook_lore' }]);
    expect(node('scene_ilyra_portal', 'lore').next).toBe('made_it');
    const made = node('scene_ilyra_portal', 'made_it');
    expect(made.text).toContain(HORDE_TEXT.ilyraAtPortal.replace(/^Ilyra: /, '').split('!...')[0] as string);
    expect(made.textVariants).toEqual([{ when: { all: [FROM_LOOP_2, { flag: 'flag_ilyra_told' }] }, text: `${made.text} You said you'd done this. Did I say remember? ...Then remember me, this time. The ink still holds.` }]);
    expect(choice('scene_first_meeting_ilyra', 'ask', 'done_this_before').effects).toEqual([{ setFlag: 'flag_ilyra_told' }]);
    expect(node('scene_ilyra_portal', 'ask').text).toBe('Enter the portal?');
    expect(node('scene_ilyra_portal', 'ask').choices.map((c) => [c.id, c.text, c.next])).toEqual([
      ['yes', 'Yes.', 'end'],
      ['no', 'No.', 'hold'],
    ]);
    expect(choice('scene_ilyra_portal', 'ask', 'yes').effects).toEqual([{ onlyIf: { when: FROM_LOOP_2, effects: [{ grantEcho: 'echo_ilyra_cost' }] } }, { endLoop: { closer: 'closer_escape' } }]);
    // every other present-day NPC says the legacy Horde line (and only that) while the Horde runs; Ilyra's Horde scene is this one
    const presentDay = Object.values(pack.npcs)
      .filter((n) => !['region_silverwood_before', 'region_threshold'].includes(pack.locations[n.homeLocationId]?.regionId ?? ''))
      .map((n) => n.id)
      .sort();
    expect([...HORDE_LINE_NPCS, 'npc_ilyra'].sort()).toEqual(presentDay);
    for (const npcId of HORDE_LINE_NPCS) {
      const horde = scene(`scene_horde_${npcId.slice(4)}`);
      expect([npcId, horde.npcId, horde.when, horde.priority, horde.nodes.map((n) => [n.speaker, n.text])]).toEqual([npcId, npcId, { flag: 'flag_horde_active' }, SCENE_PRIORITY.urgent, [[npcId, 'Go, Wayfinder! The horde approaches!']]]);
      expect(LEGACY).toContain('Go, Wayfinder! The horde approaches!');
    }
    for (const s of Object.values(pack.dialogues)) {
      if (s.npcId === undefined || s.id.startsWith('scene_horde_') || s.id === 'scene_ilyra_portal') continue;
      expect([s.id, JSON.stringify(s.when).includes('{"not":{"flag":"flag_horde_active"}}')]).toEqual([s.id, true]);
    }
  });
});

describe('the waking (scene_waking_loop_2) and the thirtieth dawn (scene_clock_expiry)', () => {
  test('the Ruins’ last enter event opens the waking in Loop 2 only, saying the Amulet’s line (the engine’s own) once; the clock and Ilyra follow', () => {
    const events = loc(RUINS).events;
    const ev = events[events.length - 1] as (typeof events)[number];
    expect([ev.id, ev.when, ev.once, ev.effects]).toEqual(['ev_ruins_waking', { loop: { min: 2, max: 2 } }, true, [{ startDialogue: 'scene_waking_loop_2' }]]);
    expect(ev.text).toBe(node('scene_waking_loop_2', 'warm').text); // the engine's `sceneSaysIt`: the event logs nothing itself
    expect(node('scene_waking_loop_2', 'warm').text).toBe(CLOSER_TEXT.amuletWarm);
    expect(node('scene_waking_loop_2', 'warm').onEnter).toEqual([{ grantEcho: 'echo_amulet_memory' }]);
    expect(scene('scene_waking_loop_2').nodes.map((n) => [n.id, n.speaker])).toEqual([
      ['warm', 'narrator'],
      ['clock', 'narrator'],
      ['ilyra', 'narrator'],
    ]);
    expect(node('scene_waking_loop_2', 'clock').text).toBe('Breach Clock — Day 1 of 30.');
  });

  test('the thirtieth dawn: STORY §4.3’s text (the engine’s expiry line, split), one line each for Ilyra, Brak and Nyx as companions, echo_thirtieth_dawn', () => {
    const sc = scene('scene_clock_expiry');
    expect(sc.npcId).toBeUndefined();
    expect(`${node('scene_clock_expiry', 'tears').text} ${node('scene_clock_expiry', 'scream').text}`).toBe(HORDE_TEXT.expiry);
    expect(node('scene_clock_expiry', 'tears').onEnter).toEqual([{ grantEcho: 'echo_thirtieth_dawn' }]);
    expect(sc.nodes.map((n) => [n.id, n.speaker])).toEqual([
      ['tears', 'narrator'],
      ['scream', 'narrator'],
      ['ilyra', 'ilyra'],
      ['brak', 'brak'],
      ['nyx', 'nyx'],
      ['west', 'narrator'],
    ]);
    expect(sc.nodes.every((n) => n.choices.length === 0)).toBe(true);
  });
});

// ---- The five: played on the real pack --------------------------------------------------------------------------------------------

const logsOf = (events: readonly GameEvent[]): string[] => events.filter((e): e is Extract<GameEvent, { t: 'log' }> => e.t === 'log').map((e) => e.text);
const nodesOf = (events: readonly GameEvent[]): string[] => events.filter((e): e is Extract<GameEvent, { t: 'dialogueNode' }> => e.t === 'dialogueNode').map((e) => e.nodeId);
const examine: Action = { type: 'examine', target: { kind: 'location' } };
type Run = { state: GameState; profile: Profile; events: GameEvent[] };
/** Plays the open dialogue to its end: `continue`, or the named choice when it is offered (else the first), collecting the nodes seen. */
function throughDialogue(start: Run, prefer: string[] = []): Run & { nodes: string[]; scenes: string[] } {
  let cur = start;
  const nodes: string[] = [];
  const scenes: string[] = [];
  const events: GameEvent[] = [];
  for (let i = 0; i < 40 && cur.state.mode === 'dialogue'; i++) {
    if (cur.state.dialogue !== null && scenes[scenes.length - 1] !== cur.state.dialogue.sceneId) scenes.push(cur.state.dialogue.sceneId);
    const legal = legalActions(cur.state, pack, cur.profile);
    const choose = legal.filter((a): a is Extract<Action, { type: 'choose' }> => a.type === 'choose');
    const act: Action = choose.find((a) => prefer.includes(a.choiceId)) ?? legal.find((a) => a.type === 'continue') ?? (choose[0] as Action);
    const out = play(cur.state, [act], { content: pack, profile: cur.profile });
    nodes.push(...nodesOf(out.events));
    events.push(...out.events);
    cur = out;
  }
  return { ...cur, events, nodes, scenes };
}
const hordeAt = (st: GameState, cause: 'tyrant' | 'expiry' = 'tyrant'): void => {
  st.world.hordeActive = true;
  st.world.hordeCause = cause;
  st.world.hordeDelay = 0;
  st.world.infected = [APEX];
  st.world.npcOverrides['npc_ilyra'] = { location: LIBRARY };
};

describe('played on the real pack', () => {
  test('Loop 1, the Contained Tyrant dead, nobody else at the Apex: the scene says the legacy fall (no engine line twice), the pulse, and the Horde is up', () => {
    const s = makeState({ loop: 1, locationId: APEX, level: 13, flags: { flag_tyrant_dead: true } }, { content: pack });
    const first = play(s, [examine], { content: pack });
    expect([first.state.mode, first.state.dialogue?.sceneId, first.state.dialogue?.nodeId]).toEqual(['dialogue', 'scene_tyrant_defeat', 'dust']);
    expect(first.state.world.hordeActive).toBe(true);
    expect(first.state.world.tyrant).toBe('defeated');
    for (const line of [...HORDE_TEXT.tyrantFalls, ...HORDE_TEXT.collapse, HORDE_TEXT.portalPulse, HORDE_TEXT.brakArrives]) expect(logsOf(first.events)).not.toContain(line);
    const rest = throughDialogue(first);
    expect(rest.nodes).toEqual(['shrieks', 'shatters_alone', 'spills_alone', 'pulse']);
    expect([rest.state.mode, rest.state.world.currentLocationId]).toEqual(['explore', APEX]);
    expect(rest.state.echoesThisLoop).toContain('echo_horde_path');
    expect(rest.state.echoesThisLoop).not.toContain('echo_brak_death');
  });

  test('Loop 2, it has spoken, Brak at the Apex: "You knew.", his arrival and his words; Stay one watch → the Nexus, his stand, echo_brak_death; the engine has moved him on', () => {
    const profile = freshProfile({ loopCounter: 2, echoes: ['echo_tyrant_speaks'] });
    const doneQuests = { q_clear_path: { stage: 'done', status: 'completed' }, q_blighted_outpost: { stage: 'done', status: 'completed' } } as const;
    const s = makeState({ loop: 2, locationId: APEX, level: 13, day: 12, flags: { flag_tyrant_dead: true }, quests: doneQuests as never }, { content: pack, profile });
    const first = play(s, [examine], { content: pack, profile });
    expect(first.state.dialogue?.nodeId).toBe('dust_knew_brak');
    expect(first.state.world.npcOverrides['npc_brak']).toEqual({ location: null });
    expect(logsOf(first.events).some((l) => l.startsWith('Brak:'))).toBe(false);
    const stand = throughDialogue(first, ['stay']);
    expect(stand.scenes).toEqual(['scene_tyrant_defeat', 'scene_braks_stand']);
    expect(stand.nodes).toEqual(['breath_knew_brak', 'knew_knew_brak', 'shrieks_knew_brak', 'arrives', 'shatters', 'spills', 'no_time', 'run', 'wound', 'steel', 'waves', 'kaelen', 'named', 'spent']);
    expect([stand.state.mode, stand.state.world.currentLocationId, stand.state.clock.ticks - s.clock.ticks]).toEqual(['explore', NEXUS, 1]);
    for (const e of ['echo_brak_death', 'echo_horde_path']) expect(stand.state.echoesThisLoop).toContain(e);
    expect(stand.state.world.infected).toEqual([APEX]); // a teleport is not a move: the spread waits for the first step
    // Run instead: the Apex, and no stand
    const ran = throughDialogue(first, ['run']);
    expect([ran.scenes, ran.state.world.currentLocationId, ran.state.echoesThisLoop.includes('echo_brak_death')]).toEqual([['scene_tyrant_defeat'], APEX, true]);
    // Loop 1 never offers the watch
    const one = play(makeState({ loop: 1, locationId: APEX, level: 13, flags: { flag_tyrant_dead: true }, quests: doneQuests as never }, { content: pack }), [examine], { content: pack });
    const atRun = throughDialogue({ ...one, events: [...one.events] }, ['__none__']);
    expect(atRun.nodes).toContain('run');
    expect(atRun.scenes).toEqual(['scene_tyrant_defeat']);
  });

  test('the thirtieth dawn: the expiry opens the scene over the engine’s line, the Horde three moves off; the standing companion’s line plays, the others are skipped', () => {
    const quiet = play(makeState({ loop: 1, locationId: RUINS, day: 30, watch: 3 }, { content: pack }), [{ type: 'wait' }], { content: pack });
    expect([quiet.state.mode, quiet.state.dialogue?.sceneId, quiet.state.world.hordeActive, quiet.state.world.hordeCause, quiet.state.world.hordeDelay]).toEqual(['dialogue', 'scene_clock_expiry', true, 'expiry', pack.config.clock.expiryHordeDelay]);
    expect(logsOf(quiet.events)).not.toContain(HORDE_TEXT.expiry);
    expect(quiet.state.echoesThisLoop).toContain('echo_thirtieth_dawn');
    const alone = throughDialogue(quiet);
    expect(alone.nodes).toEqual(['scream', 'west']);
    expect(alone.state.mode).toBe('explore');
    const withBrak = makeState({ loop: 2, locationId: RUINS, day: 30, watch: 3, patch: (st) => {
      st.companions.recruited['brak'] = { id: 'brak', recruited: true, loyalty: 40, hp: 60, hpMax: 60, ko: false, dead: false, stance: 'guarded', cooldowns: {}, waitingAt: null, arcFlags: {} } as never;
      st.companions.activeId = 'brak';
    } }, { content: pack, profile: freshProfile({ loopCounter: 2 }) });
    const tear = play(withBrak, [{ type: 'wait' }], { content: pack, profile: freshProfile({ loopCounter: 2 }) });
    expect(throughDialogue(tear).nodes).toEqual(['scream', 'brak', 'west']);
  });

  test('Ilyra at the portal: the lore first at six tomes (once), her line with the Loop 2+ sentence once told, No. then Yes. → closer_escape with echo_ilyra_cost; the engine’s arrival line is not logged', () => {
    const profile = freshProfile({ loopCounter: 2 });
    const s = makeState(
      {
        loop: 2,
        locationId: 'loc_darkened_corridor',
        flags: { flag_horde_active: true, flag_library_portal_open: true, flag_ilyra_told: true },
        patch: (st) => {
          hordeAt(st);
          st.counters.custom['spellbooks_read'] = 6;
        },
      },
      { content: pack, profile },
    );
    const arrived = play(s, [{ type: 'move', to: LIBRARY }], { content: pack, profile });
    expect(logsOf(arrived.events)).not.toContain(HORDE_TEXT.ilyraAtPortal);
    expect(legalActions(arrived.state, pack, profile)).toContainEqual({ type: 'talk', npcId: 'npc_ilyra' });
    const talk = play(arrived.state, [{ type: 'talk', npcId: 'npc_ilyra' }, { type: 'continue' }, { type: 'continue' }, { type: 'choose', choiceId: 'no' }, { type: 'continue' }], { content: pack, profile });
    expect(nodesOf(talk.events)).toEqual(['lore', 'made_it', 'ask', 'hold']);
    const told = talk.events.find((e): e is Extract<GameEvent, { t: 'dialogueNode' }> => e.t === 'dialogueNode' && e.nodeId === 'made_it');
    expect(told?.text).toContain('Then remember me, this time. The ink still holds.');
    expect(talk.state.mode).toBe('explore');
    // again: the lore is said once
    const again = play(talk.state, [{ type: 'talk', npcId: 'npc_ilyra' }, { type: 'continue' }, { type: 'choose', choiceId: 'yes' }], { content: pack, profile: talk.profile });
    expect(nodesOf(again.events)).toEqual(['made_it', 'ask']);
    expect([again.state.mode, again.state.pendingEnding?.outcome]).toEqual(['ending', 'closer_escape']);
    expect(again.state.echoesThisLoop).toContain('echo_ilyra_cost');
    // Dray, a shelf away, has only the Horde's line
    const dray = play(arrived.state, [{ type: 'talk', npcId: 'npc_ansel_dray' }], { content: pack, profile });
    expect([dray.state.dialogue?.sceneId, nodesOf(dray.events)]).toEqual(['scene_horde_ansel_dray', ['go']]);
    // Loop 1: the portal costs nothing yet
    const one = makeState({ loop: 1, locationId: LIBRARY, flags: { flag_horde_active: true, flag_library_portal_open: true }, patch: (st) => hordeAt(st) }, { content: pack });
    const out = play(one, [{ type: 'talk', npcId: 'npc_ilyra' }, { type: 'continue' }, { type: 'choose', choiceId: 'yes' }], { content: pack });
    expect([out.state.mode, out.state.echoesThisLoop.includes('echo_ilyra_cost')]).toEqual(['ending', false]);
    // the engine's own portal, from Loop 2 while she holds it, pays the same Echo
    const walked = play(makeState({ loop: 2, locationId: LIBRARY, flags: { flag_horde_active: true, flag_library_portal_open: true }, patch: (st) => hordeAt(st) }, { content: pack, profile }), [{ type: 'enterPortal' }], { content: pack, profile });
    expect(walked.state.echoesThisLoop).toContain('echo_ilyra_cost');
  });

  test('Loop 1 → Loop 2 through the portal: the slides, then the Ruins open the waking over the engine’s Amulet line; the Echo is the profile’s; Loop 3 wakes without it', () => {
    const one = makeState({ loop: 1, locationId: LIBRARY, flags: { flag_horde_active: true, flag_library_portal_open: true }, patch: (st) => hordeAt(st) }, { content: pack });
    let cur: Run = play(one, [{ type: 'enterPortal' }], { content: pack, profile: freshProfile({ loopCounter: 1 }) });
    expect(cur.state.mode).toBe('ending');
    let last: GameEvent[] = [];
    for (let i = 0; i < 10 && cur.state.mode === 'ending'; i++) {
      cur = play(cur.state, [{ type: 'acknowledgeEnding' }], { content: pack, profile: cur.profile });
      last = cur.events;
    }
    expect([cur.state.mode, cur.state.meta.loop, cur.state.dialogue?.sceneId, cur.state.world.currentLocationId]).toEqual(['dialogue', 2, 'scene_waking_loop_2', RUINS]);
    expect(logsOf(last)).not.toContain(CLOSER_TEXT.amuletWarm); // the scene says it
    expect(last.filter((e) => e.t === 'dialogueNode').map((e) => (e as Extract<GameEvent, { t: 'dialogueNode' }>).text)).toEqual([CLOSER_TEXT.amuletWarm]);
    expect(cur.profile.echoes).toContain('echo_amulet_memory');
    const woke = throughDialogue(cur);
    expect([woke.nodes, woke.state.mode]).toEqual([['clock', 'ilyra'], 'explore']);
    // Loop 3's waking is the engine's line, as before
    const three = makeState({ loop: 2, locationId: LIBRARY, flags: { flag_horde_active: true, flag_library_portal_open: true }, patch: (st) => hordeAt(st) }, { content: pack, profile: freshProfile({ loopCounter: 2, echoes: ['echo_amulet_memory'] }) });
    let next: Run = play(three, [{ type: 'enterPortal' }], { content: pack, profile: freshProfile({ loopCounter: 2, echoes: ['echo_amulet_memory'] }) });
    for (let i = 0; i < 10 && next.state.mode === 'ending'; i++) next = play(next.state, [{ type: 'acknowledgeEnding' }], { content: pack, profile: next.profile });
    expect(next.state.mode).toBe('threshold');
    const back = play(next.state, [{ type: 'thresholdGo', to: 'far_light' }, { type: 'newLoop' }], { content: pack, profile: next.profile });
    expect([back.state.meta.loop, back.state.mode]).toEqual([3, 'explore']);
    expect(logsOf(back.events)).toContain(CLOSER_TEXT.amuletWarm);
  });
});
