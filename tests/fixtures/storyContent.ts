// Quest and dialogue fixtures (U33; PLAN §8, §9.1 "later units may append fixtures for their own systems"): the
// companion pack plus
//   - `q_echo_crystal` in its STORY §11.2 shape (replacing the fixture pack's two-stage cut): reach the Library, take the
//     Crystal (shortcut `echo_crystal_location`), return to Ilyra and choose — Give / Keep as branch stages ending the
//     quest; 20 gold, 60 XP, +60 on Give (DESIGN §6.2's legacy halving when kept);
//   - `scene_echo_crystal` (STORY §13): Ilyra's Give / Keep choice, with the Loop 2+ *Listen* and companion reactions;
//   - `q_clear_path` (Brak) with a kill objective (`killed.sinceStage`, DESIGN §13.3 example 9) and a report stage that
//     waits for Brak's scene; `scene_fixture_brak` offers it, takes the report, and recruits Brak once it is done;
//   - fixture quests for each stage-machine rule (optional/hidden objectives, `advanceWhen`, branches, `outcome` fail,
//     `failWhen`/`onFail`, `timeLimitDays`/`onTimeoutTo`, `startWhen`, `onEnter`/`onExit`, every reward kind, once per
//     profile, a class quest, `acceptQuest` through `availableWhen`);
//   - fixture scenes for each dialogue rule (selection by `when` + `priority`, entry rules, text variants, hidden /
//     greyed / `once` / `oncePerLoop` choices, `continue`, `onEnter`/`onEnd`, a companion interjection and reaction, a
//     scene that starts a fight, a scene for the middle of a fight), an `interact` event that opens one, and two camp
//     scenes for Brak (DESIGN §12.7), who stands at the Plaza;
//   - Companion's Trust (`loyalty_gain`) and a fixture `loyalty_start` Attunement.
import { buildContentPack, type ContentPack, type ContentTables } from '@content/index';
import type { AttunementInput } from '@schema/attunement';
import type { CompanionInput } from '@schema/companion';
import type { DialogueSceneInput } from '@schema/dialogue';
import type { EchoInput } from '@schema/echo';
import type { FactionInput } from '@schema/faction';
import type { LocationInput } from '@schema/location';
import type { NpcInput } from '@schema/npc';
import type { QuestInput } from '@schema/quest';
import { clone } from '@engine/util/clone';
import { companionTables } from './companionContent';
import { FIXTURE_VERSION } from './miniContent';

export const CRYSTAL_QUEST = 'q_echo_crystal';
export const CRYSTAL_SCENE = 'scene_echo_crystal';
export const LEDGER = 'q_fixture_ledger';
export const TIMED = 'q_fixture_timed';
export const AUTO = 'q_fixture_auto';
export const ONCE = 'q_fixture_once';
export const CLASS_QUEST = 'q_fixture_class';
export const CLEAR_PATH = 'q_clear_path';
export const LIBRARY = 'loc_shattered_library';
export const RUINS = 'loc_whispering_ruins';
export const PLAZA = 'loc_silverwood_plaza';
export const GLOWLANDS = 'loc_veridian_glowlands';
export const MISTWOOD = 'loc_mistwood_path';
/** STORY §11's Elder Wen Thistlecourt, standing in the Glowlands here (a quest giver who is not a merchant). */
export const WEN = 'npc_elder_wen';

// ---- quests -------------------------------------------------------------------------------------------------------------------

export const storyQuests: QuestInput[] = [
  {
    id: CRYSTAL_QUEST,
    name: 'Echoes in the Library',
    description: 'Ilyra asks you to retrieve the Echo Crystal from the Shattered Library.',
    category: 'legacy',
    botHint: 'explorer',
    giverNpcId: 'npc_ilyra',
    factionId: 'remnants',
    stages: [
      {
        id: 'reach_library',
        journal: 'Retrieve the Echo Crystal from the Shattered Library to the north of Whispering Ruins.',
        objectives: [{ id: 'obj_library', text: 'Reach the Shattered Library', when: { location: LIBRARY }, hintLocationId: LIBRARY }],
        next: 'take_crystal',
      },
      {
        id: 'take_crystal',
        journal: 'The Crystal is in the third alcove, behind the fallen shelf.',
        objectives: [{ id: 'obj_crystal', text: 'Take the Echo Crystal', when: { item: { id: 'item_echo_crystal' } } }],
        next: 'return',
      },
      {
        id: 'return',
        journal: 'Return to Ilyra and choose what becomes of the Crystal.',
        next: [
          { when: { flag: 'flag_crystal_given' }, to: 'given' },
          { when: { flag: 'flag_kept_echo_crystal' }, to: 'kept' },
        ],
      },
      { id: 'given', journal: 'Ilyra cradles the crystal, whispering a prayer.', onEnter: [{ xp: 60 }], outcome: 'complete' },
      { id: 'kept', journal: 'You tuck the crystal away, its whispers now yours alone.', outcome: 'complete' },
    ],
    rewards: { xp: 60, gold: 20 },
    shortcuts: [{ echo: 'echo_crystal_location', skipTo: 'take_crystal', text: 'Third alcove, behind the fallen shelf.' }],
  },
  {
    id: CLEAR_PATH,
    name: 'Clear the Barren Peaks',
    description: 'Brak wants the Wildling Brute off the road.',
    category: 'legacy',
    botHint: 'melee',
    giverNpcId: 'npc_brak',
    factionId: 'ironclad',
    stages: [
      {
        id: 'hunt',
        journal: 'Defeat the Wildling Brute prowling the Barren Peaks north of Ironclad Camp.',
        objectives: [{ id: 'obj_brute', text: 'Defeat the Wildling Brute', when: { killed: { id: 'cr_wildling_brute', count: 1, sinceStage: true } } }],
        next: 'report',
      },
      { id: 'report', journal: 'Report to Brak.', next: 'done' },
      { id: 'done', journal: 'Brak hands you Ironclad Mail.', outcome: 'complete' },
    ],
    rewards: { xp: 120, items: [{ itemId: 'item_ironclad_mail' }], rep: [{ faction: 'ironclad', delta: 10 }] },
  },
  {
    id: LEDGER,
    name: 'The Fixture Ledger',
    description: 'Fixture: every stage-machine rule in one quest.',
    category: 'regional',
    botHint: 'explorer',
    stages: [
      {
        id: 'gather',
        journal: 'Fixture: find Glow Moss; a Tonic would help.',
        objectives: [
          { id: 'obj_moss', text: 'Find Glow Moss', when: { item: { id: 'item_glow_moss' } } },
          { id: 'obj_tonic', text: 'Bring a Tonic too', when: { item: { id: 'item_ley_touched_tonic' } }, optional: true },
          { id: 'obj_secret', text: 'Learn the scribe’s secret', when: { flag: 'flag_fixture_secret' }, optional: true, hidden: true },
        ],
        onExit: [{ setFlag: 'flag_fixture_left_gather' }],
        next: 'deliver',
      },
      {
        id: 'deliver',
        journal: 'Fixture: deliver it — or burn it.',
        objectives: [{ id: 'obj_deliver', text: 'Deliver the moss', when: { flag: 'flag_fixture_delivered' } }],
        advanceWhen: { any: [{ flag: 'flag_fixture_delivered' }, { flag: 'flag_fixture_burned' }] },
        onEnter: [{ giveItem: { item: 'item_chronal_dust' } }],
        next: [
          { when: { flag: 'flag_fixture_burned' }, to: 'burned' },
          { when: { rep: { faction: 'remnants', min: 20 } }, to: 'trusted' },
          { when: { flag: 'flag_fixture_delivered' }, to: 'plain' },
        ],
      },
      { id: 'trusted', journal: 'Fixture: the Keepers thank you warmly.', onEnter: [{ setFlag: 'flag_fixture_trusted_end' }], outcome: 'complete' },
      { id: 'plain', journal: 'Fixture: delivered.', outcome: 'complete' },
      { id: 'burned', journal: 'Fixture: ash.', outcome: 'fail' },
    ],
    onFail: [{ setFlag: 'flag_fixture_ledger_lost' }],
    rewards: {
      xp: 50,
      gold: 15,
      items: [{ itemId: 'item_mana_bloom', count: 2 }],
      rep: [{ faction: 'remnants', delta: 5 }],
      echoes: ['echo_seven_wayfinders'],
      resonance: 3,
    },
  },
  {
    id: TIMED,
    name: 'The Fixture Errand',
    description: 'Fixture: a deadline, a second chance, and a doom.',
    category: 'regional',
    botHint: 'speedrunner',
    failWhen: { flag: 'flag_fixture_doomed' },
    onFail: [{ setFlag: 'flag_fixture_mourned' }],
    stages: [
      {
        id: 'hurry',
        journal: 'Fixture: reach the Glowlands within two days.',
        objectives: [{ id: 'obj_glow', text: 'Reach the Glowlands', when: { location: GLOWLANDS } }],
        next: 'arrived',
        timeLimitDays: 2,
        onTimeoutTo: 'late',
      },
      {
        id: 'late',
        journal: 'Fixture: late — one more day.',
        objectives: [{ id: 'obj_glow_late', text: 'Reach the Glowlands', when: { location: GLOWLANDS } }],
        next: 'arrived',
        timeLimitDays: 1,
      },
      { id: 'arrived', journal: 'Fixture: you made it.', outcome: 'complete' },
    ],
  },
  {
    id: AUTO,
    name: 'The Fixture Heartbeat',
    description: 'Fixture: starts by itself once a quest is done and the stones hum (legacy q_echoing_heartbeat: two quests).',
    category: 'regional',
    botHint: 'explorer',
    startWhen: { all: [{ counter: { name: 'quests_completed', min: 1 } }, { flag: 'flag_fixture_hum' }] },
    countsForApex: false,
    stages: [
      { id: 'listen', journal: 'Fixture: something beats under the Ruins.', objectives: [{ id: 'obj_ruins', text: 'Return to the Ruins', when: { location: RUINS } }], next: 'heard' },
      { id: 'heard', journal: 'Fixture: heard.', outcome: 'complete' },
    ],
  },
  {
    id: ONCE,
    name: 'The Fixture Reveal',
    description: 'Fixture: once per profile.',
    category: 'loop',
    botHint: 'explorer',
    giverNpcId: WEN,
    availableWhen: { flag: 'flag_fixture_offer' },
    repeatablePerLoop: false,
    stages: [
      { id: 'look', journal: 'Fixture: look closer.', objectives: [{ id: 'obj_look', text: 'Look', when: { flag: 'flag_fixture_looked' } }], next: 'seen' },
      { id: 'seen', journal: 'Fixture: seen.', outcome: 'complete' },
    ],
  },
  {
    id: CLASS_QUEST,
    name: 'The Fixture Lesson',
    description: 'Fixture: a wizard-only errand.',
    category: 'class',
    botHint: 'caster',
    giverNpcId: WEN,
    classId: 'wizard',
    stages: [
      { id: 'study', journal: 'Fixture: study.', objectives: [{ id: 'obj_study', text: 'Study', when: { flag: 'flag_fixture_studied' } }], next: 'learned' },
      { id: 'learned', journal: 'Fixture: learned.', outcome: 'complete' },
    ],
  },
];

// ---- scenes -------------------------------------------------------------------------------------------------------------------

export const storyScenes: DialogueSceneInput[] = [
  {
    id: CRYSTAL_SCENE,
    npcId: 'npc_ilyra',
    title: 'The Crystal choice',
    when: { quest: { id: CRYSTAL_QUEST, stage: 'return' } },
    priority: 10,
    repeatable: false,
    entry: 'ask',
    nodes: [
      {
        id: 'ask',
        speaker: 'npc_ilyra',
        text: 'You found it. Will you share its truth with the Remnants?',
        choices: [
          {
            id: 'give',
            text: 'Give it to her.',
            hotkey: '1',
            effects: [
              { rep: { faction: 'remnants', delta: 15 } },
              { setFlag: 'flag_crystal_given' },
              { takeItem: { item: 'item_echo_crystal' } },
              { grantEcho: 'echo_crystal_location' },
            ],
            next: 'given',
          },
          {
            id: 'keep',
            text: 'Keep it.',
            hotkey: '2',
            effects: [
              { rep: { faction: 'weavers', delta: 10 } },
              { rep: { faction: 'remnants', delta: -10 } },
              { setFlag: 'flag_kept_echo_crystal' },
              { grantEcho: 'echo_crystal_location' },
            ],
            next: 'kept',
          },
        ],
      },
      { id: 'given', speaker: 'narrator', text: 'Ilyra cradles the crystal, whispering a prayer.', next: 'given_trust' },
      { id: 'given_trust', speaker: 'narrator', text: "You gain the Remnants' trust.", next: 'end' },
      {
        id: 'kept',
        speaker: 'narrator',
        text: 'You tuck the crystal away, its whispers now yours alone.',
        textVariants: [{ when: { loop: { min: 2 } }, text: 'The Crystal is cold against the Amulet, and then it is not: two things that remember, agreeing.' }],
        choices: [
          {
            id: 'listen',
            text: 'Listen.',
            when: { loop: { min: 2 } },
            tags: ['echo'],
            effects: [{ grantEcho: 'echo_litany_verse_1' }, { grantEcho: 'echo_nine_voices' }],
            next: 'end',
          },
          { id: 'leave', text: 'Leave it be.', next: 'end' },
        ],
      },
    ],
    companionReactions: [
      { companionId: 'nyx', when: { flag: 'flag_kept_echo_crystal' }, text: 'Nyx smiles at the Crystal the way you smile at a lock you know.', loyalty: 3 },
      { companionId: 'brak', text: 'Brak shrugs. "Rocks that talk. Fine."' },
    ],
  },
  {
    id: 'scene_fixture_brak',
    npcId: 'npc_brak',
    entry: [
      { when: { quest: { id: CLEAR_PATH, stage: 'report' } }, node: 'report' },
      { when: { quest: { id: CLEAR_PATH, status: 'completed' } }, node: 'after' },
      { when: { all: [] }, node: 'offer' },
    ],
    nodes: [
      {
        id: 'offer',
        speaker: 'npc_brak',
        text: 'The Peaks need clearing. You look like you can swing something.',
        choices: [
          { id: 'accept', text: 'I will clear them.', effects: [{ questStart: CLEAR_PATH }], next: 'end' },
          { id: 'later', text: 'Later.', next: 'end' },
        ],
      },
      { id: 'report', speaker: 'npc_brak', text: 'Brak hands you Ironclad Mail.', onEnter: [{ questAdvance: { quest: CLEAR_PATH, stage: 'done' } }], next: 'end' },
      {
        id: 'after',
        speaker: 'npc_brak',
        text: 'The road is quiet. I could use the walk.',
        choices: [
          { id: 'join', text: 'Walk with me.', when: { not: { companion: { id: 'brak', state: 'recruited' } } }, effects: [{ recruit: 'brak' }, { loyalty: { companion: 'brak', delta: 4 } }], next: 'end' },
          { id: 'bye', text: 'Another time.', next: 'end' },
        ],
      },
    ],
  },
  {
    id: 'scene_fixture_wen',
    npcId: WEN,
    entry: [
      { when: { loop: { min: 2 } }, node: 'again' },
      { when: { all: [] }, node: 'hello' },
    ],
    nodes: [
      {
        id: 'hello',
        speaker: WEN,
        text: 'The reeds have been whispering again.',
        textVariants: [{ when: { flag: 'flag_fixture_secret' }, text: 'You again. Keep what I told you to yourself.' }],
        onEnter: [{ counter: { name: 'wen_visits', delta: 1 } }],
        choices: [
          { id: 'ink', text: 'Ask about the reeds.', once: true, effects: [{ gold: -1 }], next: 'hello' },
          { id: 'rumour', text: 'Any rumours?', oncePerLoop: true, effects: [{ setFlag: 'flag_fixture_secret' }], next: 'rumour' },
          { id: 'hidden', text: 'Fixture: never shown.', when: { flag: 'flag_fixture_never' }, next: 'end' },
          { id: 'greyed', text: 'Fixture: shown greyed.', when: { flag: 'flag_fixture_never' }, disabledText: '(You need a reason.)', next: 'end' },
          {
            id: 'nine',
            text: 'I have heard nine voices.',
            disabledWhen: { not: { echo: 'echo_nine_voices' } },
            echoHint: 'echo_nine_voices',
            tags: ['echo'],
            effects: [{ rep: { faction: 'remnants', delta: 1 } }],
            next: 'end',
          },
          { id: 'bye', text: 'Goodbye.', next: 'end' },
        ],
      },
      { id: 'rumour', speaker: WEN, text: 'The Keeper counts something. Days, I think.', next: 'interject' },
      { id: 'interject', speaker: 'brak', text: 'Days until what?', next: 'tail' },
      { id: 'tail', speaker: 'narrator', text: 'She goes back to her lanterns.', next: 'end' },
      { id: 'again', speaker: WEN, text: 'Have we met? You look like someone who has.', next: 'end' },
    ],
    onEnd: [{ setFlag: 'flag_fixture_wen_spoke' }],
    companionReactions: [{ companionId: 'brak', when: { flag: 'flag_fixture_secret' }, text: 'Brak grunts. "Rumours."', loyalty: 2 }],
  },
  {
    id: 'scene_fixture_wen_urgent',
    npcId: WEN,
    when: { flag: 'flag_fixture_urgent' },
    priority: 5,
    repeatable: false,
    entry: 'urgent',
    nodes: [{ id: 'urgent', speaker: WEN, text: 'Quickly — the lanterns are dimming.', next: 'end' }],
  },
  {
    id: 'scene_fixture_ambush',
    entry: 'trap',
    nodes: [
      {
        id: 'trap',
        speaker: 'narrator',
        text: 'Behind the shelf, two shapes unfold from the dark.',
        choices: [
          { id: 'fight', text: 'Fight.', effects: [{ startCombat: 'enc_library_shades' }], next: 'end' },
          { id: 'slip', text: 'Slip away.', effects: [{ passWatches: 1 }], next: 'end' },
        ],
      },
    ],
    onEnd: [{ setFlag: 'flag_fixture_ambush_over' }],
  },
  {
    id: 'scene_fixture_boss_talk',
    entry: 'taunt',
    nodes: [{ id: 'taunt', speaker: 'cr_corrupted_shade', text: 'You keep coming back.', next: 'end' }],
  },
  {
    id: 'scene_fixture_camp_brak_1',
    title: 'By the fire',
    when: { companion: { id: 'brak' } },
    priority: 1,
    repeatable: false,
    entry: 'fire',
    nodes: [{ id: 'fire', speaker: 'brak', text: 'Steel and stubbornness. That is all the Nomads trust.', next: 'end' }],
  },
  {
    id: 'scene_fixture_camp_brak_2',
    title: 'His birth name',
    when: { loyalty: { companion: 'brak', min: 25 } },
    priority: 2,
    repeatable: false,
    entry: 'name',
    nodes: [{ id: 'name', speaker: 'companion', text: 'My mother had another name for me. Never mind it.', next: 'end' }],
  },
];

// ---- the rest -----------------------------------------------------------------------------------------------------------------

export const storyEchoes: EchoInput[] = [
  {
    id: 'echo_crystal_location',
    name: 'Third Alcove',
    codexLine: 'Fixture: the Crystal is behind the fallen shelf, third alcove.',
    category: 'shortcut',
    obtainedBy: [`scene:${CRYSTAL_SCENE}`],
  },
  { id: 'echo_litany_verse_1', name: 'Litany, Verse One', codexLine: 'Fixture: the first verse.', category: 'lore', obtainedBy: [`scene:${CRYSTAL_SCENE}`] },
  { id: 'echo_nine_voices', name: 'Nine Voices', codexLine: 'Fixture: nine voices in one stone.', category: 'lore', obtainedBy: [`scene:${CRYSTAL_SCENE}`] },
];

export const storyAttunements: AttunementInput[] = [
  {
    id: 'att_companions_trust',
    name: "Companion's Trust",
    description: 'Fixture: loyalty gains +25 %.',
    cost: 25,
    effects: [{ kind: 'custom', scriptId: 'loyalty_gain', params: { pct: 0.25 } }],
    icon: 'companions_trust',
  },
  {
    id: 'att_fixture_kinship',
    name: 'Fixture Kinship',
    description: 'Fixture: companions start 5 loyalty higher.',
    cost: 10,
    effects: [{ kind: 'loyalty_start', amount: 5 }],
    icon: 'kinship',
  },
];

/** The Library's `interact` event that opens the ambush scene (fixture). */
const alcove: NonNullable<LocationInput['events']>[number] = {
  id: 'ev_fixture_alcove',
  text: 'You pull the fallen shelf aside.',
  trigger: 'interact',
  label: 'Search the alcove',
  effects: [{ startDialogue: 'scene_fixture_ambush' }],
};

const wen: NpcInput = {
  id: WEN,
  name: 'Elder Wen Thistlecourt',
  description: 'Fixture: the Glowfen elder.',
  homeLocationId: GLOWLANDS,
  portrait: { sigil: 'reed' },
  roles: ['questgiver'],
};

/** The two factions the fixture pack lacks (rep effects name them; DESIGN §11). */
const tiers = (name: string): FactionInput['tierTexts'] => ({
  hostile: `${name}: hostile.`,
  wary: `${name}: wary.`,
  neutral: `${name}: neutral.`,
  trusted: `${name}: trusted.`,
  sworn: `${name}: sworn.`,
});
export const storyFactions: FactionInput[] = [
  { id: 'weavers', name: 'Shadow Weavers', shortName: 'Weavers', description: 'Fixture: the Weavers.', color: '#6b3fa0', tierTexts: tiers('Weavers') },
  { id: 'ironclad', name: 'Ironclad Nomads', shortName: 'Ironclad', description: 'Fixture: the Nomads.', color: '#8a8f98', tierTexts: tiers('Ironclad') },
];

export function storyTables(): ContentTables {
  const base = companionTables();
  return {
    ...base,
    quests: [...base.quests.filter((q) => q.id !== CRYSTAL_QUEST), ...storyQuests],
    dialogues: [...base.dialogues, ...storyScenes],
    echoes: [...base.echoes, ...storyEchoes],
    attunements: [...base.attunements, ...storyAttunements],
    factions: [...base.factions, ...storyFactions],
    npcs: [...base.npcs, wen],
    companions: base.companions.map((c) =>
      c.id === 'brak' ? ({ ...clone(c), campScenes: ['scene_fixture_camp_brak_1', 'scene_fixture_camp_brak_2'] } satisfies CompanionInput) : c,
    ),
    locations: base.locations.map((loc) => {
      const l = clone(loc) as LocationInput;
      if (l.id === LIBRARY) l.events = [...(l.events ?? []), clone(alcove)];
      if (l.id === PLAZA) l.npcs = [...(l.npcs ?? []), 'npc_brak']; // Brak waits at the Plaza in this fixture
      if (l.id === GLOWLANDS) l.npcs = [...(l.npcs ?? []), WEN];
      return l;
    }),
  };
}

let cached: ContentPack | null = null;

/** The story pack (built and validated like the fixture pack; cached). */
export function storyPack(): ContentPack {
  cached ??= buildContentPack(storyTables(), { version: FIXTURE_VERSION });
  return cached;
}
