// What the Dialogue screen draws (PLAN §6.3 `DialogueScreen`, DESIGN §13.2, §16.3 `screen_dialogue`), as pure functions of
// the state, the pack, the profile and the legal-action list — so the screen's rules are unit-tested without React and
// the view stays a function of props. Nothing here decides legality or availability: the engine's `choiceViews` says
// which answers are shown, which are greyed and why (D-105: Echo-locked lines are greyed from Loop 2 with their reason),
// and `legal` says what can be done now. The Loop 1 Apex prompt (*Face it / Not yet*) is the engine's own scene
// (`APEX_PROMPT_SCENE`, D-074); it has no content node, so it is built here from the engine's constants.
import {
  APEX_FACE_IT,
  APEX_NOT_YET,
  APEX_PROMPT_SCENE,
  APEX_PROMPT_TEXT,
  choiceViews,
  currentNode,
  isApexPromptOpen,
  nodeText,
  speakerOf,
  type Action,
  type ContentPack,
  type GameState,
  type Profile,
} from '@engine/index';
import type { DialogueChoice, DialogueNode } from '@schema/dialogue';
import type { SigilSpec } from '../art/CreatureSigil';
import { legalSet } from './exploreModel';
import { proseText, type ProseResolver } from '../text/prose';

type Pr = Readonly<Profile>;
type ChoiceTag = DialogueChoice['tags'][number];
type Mood = DialogueNode['mood'];

export type SpeakerKind = 'npc' | 'companion' | 'creature' | 'player' | 'narrator';

export interface SpeakerModel {
  kind: SpeakerKind;
  id: string;
  /** "Ilyra"; the narrator has none. */
  name: string | null;
  /** "Quest-giver", "Smith", … */
  role: string | null;
  /** The faction's short name, when the person belongs to one. */
  faction: string | null;
  /** `npc.portrait` (or the Wayfinder's class) for a person's sigil. */
  portrait: { sigil: string; accent?: string } | null;
  /** A creature that speaks (the Tyrant) draws its own sigil. */
  creature: { id: string; sigil: SigilSpec | undefined; family: string | undefined } | null;
}

const ROLE_WORDS: Readonly<Record<string, string>> = {
  questgiver: 'Quest-giver',
  merchant: 'Merchant',
  smith: 'Smith',
  healer: 'Healer',
  companion: 'Companion',
  lore: 'Keeper of lore',
  keeper: 'Keeper',
};

const NARRATOR: SpeakerModel = { kind: 'narrator', id: 'narrator', name: null, role: null, faction: null, portrait: null, creature: null };

/** Who is speaking: `speaker` as `speakerOf` resolved it (an npc id, a companion id, a creature id, `player`, `narrator`). */
export function speakerModel(speakerId: string, state: GameState, content: ContentPack): SpeakerModel {
  if (speakerId === 'narrator') return NARRATOR;
  if (speakerId === 'player') {
    return { kind: 'player', id: 'player', name: state.player.name, role: 'You', faction: null, portrait: { sigil: state.player.classId }, creature: null };
  }
  const companion = content.companions[speakerId];
  const npc = content.npcs[companion?.npcId ?? speakerId];
  if (npc !== undefined) {
    const faction = npc.factionId === 'neutral' ? null : (content.factions[npc.factionId]?.shortName ?? null);
    const role = companion !== undefined || npc.roles.includes('companion') ? 'Companion' : (ROLE_WORDS[npc.roles[0] ?? ''] ?? null);
    return {
      kind: companion !== undefined ? 'companion' : 'npc',
      id: npc.id,
      name: companion?.name ?? npc.name,
      role,
      faction,
      portrait: npc.portrait.accent === undefined ? { sigil: npc.portrait.sigil } : { sigil: npc.portrait.sigil, accent: npc.portrait.accent },
      creature: null,
    };
  }
  const creature = content.creatures[speakerId];
  if (creature !== undefined) {
    return { kind: 'creature', id: creature.id, name: creature.name, role: null, faction: null, portrait: null, creature: { id: creature.id, sigil: creature.sigil, family: creature.family } };
  }
  // an unknown speaker id (a companion who is not in the party, a typo in content): shown by a readable name, no portrait
  return { kind: 'npc', id: speakerId, name: readable(speakerId), role: null, faction: null, portrait: null, creature: null };
}

/** `npc_old_fennick` → "Old Fennick". */
export function readable(id: string): string {
  const words = id.replace(/^(?:npc|cr|fam|loc|region)_/, '').split('_').filter((w) => w !== '');
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ---- choices ----------------------------------------------------------------------------------------------------------------

export const TAG_LABELS: Readonly<Record<ChoiceTag, string>> = { echo: 'Echo', class: 'Class', faction: 'Faction', companion: 'Companion' };

export interface ChoiceRow {
  id: string;
  /** The number key (1–9) in displayed order; null past the ninth (tap or Tab only). */
  key: string | null;
  text: string;
  enabled: boolean;
  /** Why a greyed answer is greyed ("(You do not yet know this)"). */
  reason: string | null;
  /** DESIGN §13.2's glyphs, each with its word (colour and shape are never the only cue). */
  tags: { id: ChoiceTag; label: string }[];
  /** The Echo a usable echo-tagged answer draws on (named for the player who knows it; a greyed one never names it). */
  echo: string | null;
}

export const choiceKey = (index: number): string | null => (index < 9 ? String(index + 1) : null);

/** The accessible name of a choice: its number first, as the ActionBar does ("2: Ask about the Crystal"). */
export function choiceName(row: ChoiceRow): string {
  const tags = row.tags.length === 0 ? '' : `, ${row.tags.map((t) => t.label.toLowerCase()).join(' and ')} line`;
  const echo = row.echo === null ? '' : `, you know ${row.echo}`;
  const locked = row.enabled ? '' : `, unavailable: ${row.reason ?? ''}`;
  return `${row.key === null ? '' : `${row.key}: `}${row.text}${tags}${echo}${locked}`;
}

function contentChoices(state: GameState, content: ContentPack, profile: Pr): ChoiceRow[] {
  return choiceViews(state, content, profile).map((view, i) => ({
    id: view.id,
    key: choiceKey(i),
    text: view.text,
    enabled: view.enabled,
    reason: view.enabled ? null : (view.disabledText ?? null),
    tags: view.tags.map((id) => ({ id, label: TAG_LABELS[id] })),
    echo: view.enabled && view.echoHint !== undefined ? (content.echoes[view.echoHint]?.name ?? null) : null,
  }));
}

function apexChoices(legal: readonly Action[]): ChoiceRow[] {
  const isLegal = legalSet(legal);
  const rows: [string, string][] = [
    [APEX_FACE_IT, 'Face it'],
    [APEX_NOT_YET, 'Not yet'],
  ];
  return rows
    .filter(([id]) => isLegal({ type: 'choose', choiceId: id }))
    .map(([id, text], i) => ({ id, key: choiceKey(i), text, enabled: true, reason: null, tags: [], echo: null }));
}

// ---- the back-log -------------------------------------------------------------------------------------------------------------

export interface BacklogLine {
  key: string;
  speaker: SpeakerModel;
  text: string;
  /** What the player answered at this node. */
  chose: string | null;
}

/**
 * The nodes of the open scene already passed, oldest first, with the answer taken at each (read from the dialogue state's
 * `visitedNodes` and `choicesTaken`, so a reloaded save still has its back-log). Variants are read as they hold now.
 */
export function backlog(state: GameState, content: ContentPack, profile: Pr, text: ProseResolver = proseText): BacklogLine[] {
  const d = state.dialogue;
  const scene = d === null ? undefined : content.dialogues[d.sceneId];
  if (d === null || scene === undefined) return [];
  const out: BacklogLine[] = [];
  for (const nodeId of d.visitedNodes) {
    if (nodeId === d.nodeId) continue;
    const node = scene.nodes.find((n) => n.id === nodeId);
    if (node === undefined) continue;
    const taken = [...d.choicesTaken].reverse().find((k) => k.startsWith(`${nodeId}:`));
    const choice = taken === undefined ? undefined : node.choices.find((c) => c.id === taken.slice(nodeId.length + 1));
    out.push({
      key: nodeId,
      speaker: speakerModel(speakerOf(state, node), state, content),
      text: text(nodeText(state, profile, content, node)) ?? '…',
      chose: choice?.text ?? null,
    });
  }
  return out;
}

// ---- the screen ---------------------------------------------------------------------------------------------------------------

export interface DialogueModel {
  sceneId: string;
  nodeId: string;
  /** The h1: the scene's title, else "Talking with <name>". */
  title: string;
  /** Where the conversation takes place. */
  place: string;
  regionId: string;
  speaker: SpeakerModel;
  /** The line ('' while `loading`). */
  text: string;
  /** U62a: the line's words are in a text chunk still on its way (the view shows a quiet loading line). */
  loading: boolean;
  mood: Mood;
  choices: ChoiceRow[];
  /** A node with nothing to answer: its Continue button. */
  canContinue: boolean;
  /** Continue closes the scene (the node leads to `end`): the button says so. */
  endsScene: boolean;
  backlog: BacklogLine[];
  /** The companion standing in the party, who listens (`npcId`: its portrait's file, U73a). */
  listener: { name: string; sigil: string; accent?: string; npcId?: string } | null;
}

function listenerOf(state: GameState, content: ContentPack): DialogueModel['listener'] {
  const id = state.companions.activeId;
  const run = id === null ? undefined : state.companions.recruited[id];
  const def = id === null ? undefined : content.companions[id];
  if (run === undefined || def === undefined || !run.recruited || run.dead || run.ko) return null;
  const npc = content.npcs[def.npcId];
  return npc === undefined
    ? { name: def.name, sigil: def.id }
    : npc.portrait.accent === undefined
      ? { name: def.name, sigil: npc.portrait.sigil, npcId: npc.id }
      : { name: def.name, sigil: npc.portrait.sigil, accent: npc.portrait.accent, npcId: npc.id };
}

/** U62a: the open node's text as the pack holds it (a text-chunk reference in a split build): the container loads its chunk. */
export function rawLine(state: GameState, content: ContentPack, profile: Pr): string | null {
  const node = state.mode === 'dialogue' ? currentNode(state, content) : undefined;
  return node === undefined ? null : nodeText(state, profile, content, node);
}

/** The screen's model, or null when no scene is open (or its scene is no longer in the pack: an old save). */
export function dialogueModel(state: GameState, content: ContentPack, profile: Pr, legal: readonly Action[], text: ProseResolver = proseText): DialogueModel | null {
  const d = state.dialogue;
  if (d === null || state.mode !== 'dialogue') return null;
  const loc = content.locations[state.world.currentLocationId];
  const place = loc?.name ?? '';
  const regionId = d.returnMode === 'threshold' ? 'region_threshold' : (loc?.regionId ?? 'region_silverwood_ruins');
  const listener = listenerOf(state, content);
  if (isApexPromptOpen(state)) {
    return {
      sceneId: APEX_PROMPT_SCENE,
      nodeId: d.nodeId,
      title: place === '' ? 'The Apex' : place,
      place,
      regionId,
      speaker: NARRATOR,
      text: APEX_PROMPT_TEXT,
      loading: false,
      mood: 'grim',
      choices: apexChoices(legal),
      canContinue: false,
      endsScene: false,
      backlog: [],
      listener,
    };
  }
  const scene = content.dialogues[d.sceneId];
  const node = currentNode(state, content);
  if (scene === undefined || node === undefined) return null;
  const speaker = speakerModel(speakerOf(state, node), state, content);
  const talkedTo = d.npcId === null ? null : (content.npcs[d.npcId]?.name ?? null);
  const line = text(nodeText(state, profile, content, node));
  return {
    sceneId: scene.id,
    nodeId: node.id,
    title: scene.title ?? (talkedTo === null ? 'A conversation' : `Talking with ${talkedTo}`),
    place,
    regionId,
    speaker,
    text: line ?? '',
    loading: line === null,
    mood: node.mood,
    choices: contentChoices(state, content, profile),
    canContinue: legalSet(legal)({ type: 'continue' }),
    endsScene: node.next === undefined || node.next === 'end',
    backlog: backlog(state, content, profile, text),
    listener,
  };
}
