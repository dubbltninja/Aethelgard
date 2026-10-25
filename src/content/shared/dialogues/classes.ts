// The scenes of the five class mini-quests (STORY §11.8; BIBLE §3 the voices: Kaelen a merchant's economy, weighs and prices;
// Tamsin ink by the dram, salt by the cup, "Year 500" at the top of every page; Brak fragments, one dry joke, counts things;
// Borin forge verbs, "Speak plain", the fire is a person; Nyx present tense, no exclamation, "the void remembers", "he" of
// Veyran; DESIGN §3 / D-008 the classes: the Ranger reads the ground, the Wizard reads, the Elf's Bladesong and Shadowstep,
// the Warden's Guard and Taunt, the Weaver's Hex). The quests are ../quests/classes.ts; the conventions are this folder's
// index.ts (U52's pattern, D-105, D-109).
//
// Who says what, and when (priority bands from ./common.ts; every NPC scene is closed while the Horde runs; a scene with no
// `npcId` is opened by a place — the region's locations.ts names the event, each a listed edit). Every scene here is its
// class's (`{ class: id }`, D-008) and Loop 2+'s:
//   Kaelen   scene_kaelen_unmarked_trail_offer (the `offer` band, behind Blood and Salt's offer while that stands) · _waiting ·
//            _report (the runner home; the ledger) · _after
//   place    scene_mistwood_read_ground (the Path's `ev_mistwood_read_ground`: the marks, the snare at the drag-line, the runner)
//   Tamsin   scene_tamsin_seventh_page_offer · _waiting · _after (copied, or burned)
//   place    scene_plaza_ley_light (the Plaza's `ev_plaza_ley_light`, at night: Korr's hand; copy it or burn it)
//   place    scene_archway_follow (the Archway's `ev_archway_follow`: the whisper says follow to Silverwood blood) ·
//            scene_plaza_last_duel (the Plaza's `ev_plaza_duelling_ground`, at the `duel` stage: draw, or stand still)
//   Brak     scene_brak_wall_offer (the `offer` band; his hub, scene_brak_arc, chains to it by "About the barricade.") · _waiting
//   place    scene_camp_barricade_night (the Camp's `ev_camp_barricade_gap`: the gap; wave 1 of three)
//   Borin    scene_borin_wall_tempered (the plate tempered, the hammer) · _after
//   Nyx      scene_nyx_unlit_thread_offer (the `offer` band, behind the legacy shard offer until that is taken) · _waiting ·
//            _report (the Shard left: the line she says to no one else, Weavers +5; taken: no line) · _after
//   place    scene_hollow_unlit_thread (the Hollow's `ev_hollow_feel_seam`: the seam, the Stalker, the hex, the Shard)
//
// STORY gives these quests their beats, their first journals and one line (Nyx's "You could have been one of us. Of the nine,
// I mean."); every other line is written (tag `written`, in the speaker's BIBLE voice, listed in the U59 reply and pinned by
// tests/unit/content/quests/classes.test.ts).
import type { Condition } from '@schema/condition';
import type { DialogueSceneInput } from '@schema/dialogue';
import { FROM_LOOP_2, NOT_IN_HORDE, SCENE_PRIORITY, type ChoiceInput } from './common';

const KAELEN = 'npc_kaelen_stonehand';
const TAMSIN = 'npc_tamsin_reed';
const BRAK = 'npc_brak';
const BORIN = 'npc_borin_stonefist';
const NYX = 'npc_nyx';

const RANGER = 'q_class_ranger';
const WIZARD = 'q_class_wizard';
const ELF = 'q_class_elf';
const WARDEN = 'q_class_ironclad_warden';
const WEAVER = 'q_class_shadow_weaver';

const stageOf = (id: `q_${string}`, stage: string): Condition => ({ quest: { id, stage } });
const active = (id: `q_${string}`): Condition => ({ quest: { id, status: 'active' } });
const completed = (id: `q_${string}`): Condition => ({ quest: { id, status: 'completed' } });
const notStarted = (id: `q_${string}`): Condition => ({ not: { quest: { id } } });

/** U55's reading: Nyx's home, where her lip scenes play (her schedule moves her during the Choir's quest). */
const AT_CHASM: Condition = { location: 'loc_chasm_of_whispers' };
/** U55: told in the Dark Between, she is Hostile and says nothing more. */
const NYX_HOSTILE: Condition = { flag: 'flag_nyx_hostile' };

/** The giver's ask: a yes that starts the quest, a no that goes to the refusal line. */
const offer = (questId: `q_${string}`, yes: string, no: string, afterYes: string, refused: string): ChoiceInput[] => [
  { id: 'yes', text: yes, effects: [{ questStart: questId }], next: afterYes },
  { id: 'no', text: no, next: refused },
];

/** A class's own offer: Loop 2+, playing the class, the quest not yet in the journal (D-008, D-069.7). */
const classOffer = (classId: 'ranger' | 'wizard' | 'elf' | 'ironclad_warden' | 'shadow_weaver', questId: `q_${string}`, more: Condition[] = []): Condition => ({
  all: [NOT_IN_HORDE, FROM_LOOP_2, { class: classId }, notStarted(questId), ...more],
});

export const dialogues = [
  // ==== Kaelen · q_class_ranger (The Unmarked Trail) ===========================================================================

  // STORY §11.8: the salt-runner never came back from the Mistwood Path. The `offer` band: Blood and Salt's offer (U54's, first
  // in content order) wins the tie while it stands; this one comes up otherwise
  {
    id: 'scene_kaelen_unmarked_trail_offer',
    npcId: KAELEN,
    title: 'The salt-runner',
    when: classOffer('ranger', RANGER),
    priority: SCENE_PRIORITY.offer,
    entry: 'runner',
    nodes: [
      {
        id: 'runner',
        tags: ['written'],
        speaker: KAELEN,
        text: 'My salt-runner went up the Mistwood Path at dawn with a sack worth eleven gold and did not come down it. The sack I can price. The boy I cannot, so I am not trying.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: KAELEN,
        text: 'You walk like someone who reads the ground before the sky. Read it for me. Find where he left the trail, and bring back whatever is there to bring. I will not haggle on this one.',
        choices: offer(RANGER, 'I will read the ground.', 'Not now.', 'agree', 'refused'),
      },
      { id: 'agree', tags: ['written'], speaker: KAELEN, text: "Then go while the ground still holds the story. Fog takes a track in a day. I'll keep the lamp up.", next: 'end' },
      { id: 'refused', tags: ['written'], speaker: KAELEN, text: 'Fair. A runner is not your account. I will add the sack to the loss and keep the lamp up anyway.', next: 'end' },
    ],
  },
  {
    id: 'scene_kaelen_unmarked_trail_waiting',
    npcId: KAELEN,
    when: { all: [NOT_IN_HORDE, active(RANGER), { not: stageOf(RANGER, 'bring_home') }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'edges',
    nodes: [{ id: 'edges', tags: ['written'], speaker: KAELEN, text: 'The Path, north. He had a bad habit of stepping off it for the glow-herbs. Read the edges, not the middle.', next: 'end' }],
  },
  // The Path (its `ev_mistwood_read_ground`, while the quest stands at `read_ground` or `snare`): the marks (Hunt), then the snare at
  // the drag-line (Wildcraft) — one watch in the waiting — and the runner under the roots
  {
    id: 'scene_mistwood_read_ground',
    title: 'Read the ground',
    entry: [
      { when: stageOf(RANGER, 'snare'), node: 'line' },
      { when: { all: [] }, node: 'ground' },
    ],
    nodes: [
      {
        id: 'ground',
        tags: ['written'],
        speaker: 'narrator',
        text: "You crouch at the trail's edge where the fog is thinnest. Boot prints, one pair, light, going north. Over them, four pads with the claws in and a long stride: a Prowler, keeping pace, not closing. The scholars' kind of cat.",
        choices: [
          { id: 'read_marks', text: 'Read the marks. (Hunt)', when: { class: 'ranger' }, tags: ['class'], next: 'marks' },
          { id: 'leave', text: 'Not now.', next: 'end' },
        ],
      },
      {
        id: 'marks',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The pads turn off the trail at a crushed herb-bed. Past it the loam is scored in two lines a hand apart: a drag-line, heels first, into the bark-glow. The cat did not eat him here. It took him somewhere it could.',
        onEnter: [{ questAdvance: { quest: RANGER, stage: 'snare' } }],
        next: 'line',
      },
      {
        id: 'line',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The drag-line runs under the glowing bark to a hollow of roots. Something breathes in there, shallow and fast, and something else paces the far side of it on four feet. The cat comes back for what it caches. You know this because you have cached things.',
        choices: [
          { id: 'snare', text: 'Set a snare across the drag-line. (Wildcraft)', when: { class: 'ranger' }, tags: ['class'], next: 'set' },
          { id: 'leave', text: 'Not yet.', next: 'end' },
        ],
      },
      {
        id: 'set',
        tags: ['written'],
        speaker: 'narrator',
        text: "Rootbone cord from the bark, a bent sapling, a loop the width of a cat's shoulders, laid in the drag-line where the loam is soft. You step back into the fog, stand downwind, and wait.",
        onEnter: [{ passWatches: 1 }],
        next: 'taken',
      },
      {
        id: 'taken',
        tags: ['written'],
        speaker: 'narrator',
        text: "A watch goes by. Then the sapling snaps straight and a grey shape hangs by the hind leg, spitting, bark-light rippling on its flanks. You leave it swinging. In the hollow the salt-runner is on his back with his ankle torn and the sack under his head, and he says, 'I knew somebody read ground.'",
        onEnter: [{ questAdvance: { quest: RANGER, stage: 'bring_home' } }],
        next: 'end',
      },
    ],
  },
  // STORY §11.8 stage 3: the runner home. Consequences: Kaelen's prices −5 % (`echo_kaelen_ledger`, the quest's reward), the Harrier Bow
  {
    id: 'scene_kaelen_unmarked_trail_report',
    npcId: KAELEN,
    title: 'The runner home',
    when: { all: [NOT_IN_HORDE, stageOf(RANGER, 'bring_home')] },
    priority: SCENE_PRIORITY.report,
    entry: 'weighed',
    nodes: [
      {
        id: 'weighed',
        tags: ['written'],
        speaker: KAELEN,
        text: 'Set him down by the stream. Ankle torn, sack whole, both of them home. I weighed the boy against the salt on the way in, Wayfinder, and the boy was heavier. I did not expect that of myself.',
        next: 'ledger',
      },
      {
        id: 'ledger',
        tags: ['written'],
        speaker: KAELEN,
        text: "I keep an account of you now. A twentieth off whatever is on the counter, and this: horn and sinew, strung for birds that dive. A runner's bow. He will not be running for a month, so it is yours.",
        onEnter: [{ questAdvance: { quest: RANGER, stage: 'home' } }],
        next: 'end',
      },
    ],
    companionReactions: [{ companionId: 'brak', text: 'Brak: "He said the boy was heavier. Write that down. He\'ll deny it by morning."' }],
  },
  {
    id: 'scene_kaelen_unmarked_trail_after',
    npcId: KAELEN,
    when: { all: [NOT_IN_HORDE, completed(RANGER)] },
    priority: SCENE_PRIORITY.after,
    entry: 'mending',
    nodes: [{ id: 'mending', tags: ['written'], speaker: KAELEN, text: 'The ankle is mending. He asks after you. I told him you were on the account, which is as near as I come to it.', next: 'end' }],
  },

  // ==== Tamsin · q_class_wizard (The Seventh Page) =============================================================================

  // STORY §11.8: a page no Remnant can read; read it by ley-light at the fountain, at night
  {
    id: 'scene_tamsin_seventh_page_offer',
    npcId: TAMSIN,
    title: 'The seventh page',
    when: classOffer('wizard', WIZARD),
    priority: SCENE_PRIORITY.offer,
    entry: 'page',
    nodes: [
      {
        id: 'page',
        tags: ['written'],
        speaker: TAMSIN,
        text: "Year 500. I write it at the top of every page so I don't forget. This one came up out of the Archives with no year on it, and no top, and no Remnant alive can read it. The ink moves when the salt gets near it.",
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: TAMSIN,
        text: 'You hold a staff the way the books taught you, not the way the Keeper does. Take this to the fountain when the ley-light is up, after dark, and read it over the water. Ink by the dram, Wayfinder; I will not charge you for this one.',
        choices: offer(WIZARD, 'I will read it by ley-light.', 'Not now.', 'agree', 'refused'),
      },
      { id: 'agree', tags: ['written'], speaker: TAMSIN, text: 'After dark. The fountain lights from underneath then, and the page will show you what it is. Do not bring it back to me wet.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: TAMSIN, text: 'Then it goes back under the salt. It has waited five hundred years without a top; it can wait one more scribe.', next: 'end' },
    ],
  },
  {
    id: 'scene_tamsin_seventh_page_waiting',
    npcId: TAMSIN,
    when: { all: [NOT_IN_HORDE, active(WIZARD)] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'rim',
    nodes: [{ id: 'rim', tags: ['written'], speaker: TAMSIN, text: "Night, and the fountain's rim. The ley comes up through the cracks there. Hold the page over the water, not in it.", next: 'end' }],
  },
  // The Plaza (its `ev_plaza_ley_light`, while the quest stands at `read`): Korr's hand; copy it (Corruption +1, `echo_korr_marginalia`)
  // or burn it (Remnants +5) — STORY §11.8 stages 2–3
  {
    id: 'scene_plaza_ley_light',
    title: 'By ley-light',
    entry: 'light',
    nodes: [
      {
        id: 'light',
        tags: ['written'],
        speaker: 'narrator',
        text: "The fountain's basin is dry, but under the cracked marble the ley comes up blue and slow, and the mist over it stands still. You hold the page out over the light. The ink lifts off the vellum a hair, as if it would rather be read from below.",
        next: 'hand',
      },
      {
        id: 'hand',
        tags: ['written'],
        speaker: 'narrator',
        text: 'A tight, slanted hand, each letter leaning into the next word before the last is done, and marginalia down both sides in the same hand, crowding the text. You have seen it in every Dark Spellbook you ever opened. Maelis Korr wrote this. At the foot, underlined twice: what is read is owed.',
        next: 'choose',
      },
      {
        id: 'choose',
        tags: ['written'],
        speaker: 'narrator',
        text: 'It is the seventh page of a book that was bound with six. The light shows the back of it too, and there is more on the back.',
        choices: [
          {
            id: 'copy',
            text: 'Copy it into your own book.',
            when: { class: 'wizard' },
            tags: ['class'],
            effects: [{ corruption: 1 }, { grantEcho: 'echo_korr_marginalia' }, { questAdvance: { quest: WIZARD, stage: 'copied' } }],
            next: 'copied',
          },
          {
            id: 'burn',
            text: 'Burn it on the rim.',
            effects: [{ rep: { faction: 'remnants', delta: 5 } }, { questAdvance: { quest: WIZARD, stage: 'burned' } }],
            next: 'burned',
          },
        ],
      },
      {
        id: 'copied',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You copy it line for line, and the marginalia, and the underlined words. Your hand slants by the end. The ink on the vellum goes still, as if it has been read enough.',
        next: 'end',
      },
      {
        id: 'burned',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Vellum takes slowly and then all at once. The ink burns blue, the ley colour, and the mist over the basin moves for the first time all night. Ash on the rim; you sweep it into your palm for Tamsin.',
        next: 'end',
      },
    ],
  },
  {
    id: 'scene_tamsin_seventh_page_after',
    npcId: TAMSIN,
    when: { all: [NOT_IN_HORDE, completed(WIZARD)] },
    priority: SCENE_PRIORITY.after,
    entry: [
      { when: stageOf(WIZARD, 'burned'), node: 'ash' },
      { when: { all: [] }, node: 'dry' },
    ],
    nodes: [
      {
        id: 'dry',
        tags: ['written'],
        speaker: TAMSIN,
        text: 'You brought it back dry, and you brought it back read. I will not ask what it said. I write Year 500 at the top of my pages so I do not forget, Wayfinder; I think you have just learned why.',
        next: 'end',
      },
      {
        id: 'ash',
        tags: ['written'],
        speaker: TAMSIN,
        text: 'Ash. Good. Some pages are weighed by the dram and some by what they would cost to keep. The Keeper will hear you chose the cheaper one, and he will not call it that.',
        next: 'end',
      },
    ],
  },

  // ==== The Archway and the Plaza · q_class_elf (Bladesong at the Archway) =====================================================

  // The Archway (its `ev_archway_follow`, Elf only, Loop 2+, until the quest is in the journal): STORY §11.8 "the whisper says follow
  // to Silverwood blood"
  {
    id: 'scene_archway_follow',
    title: 'Follow',
    entry: 'follow',
    nodes: [
      {
        id: 'follow',
        tags: ['written'],
        speaker: 'narrator',
        text: "'Wayfinder... follow.' The whisper has said it to every scholar who walked under the arch for five hundred years, and none of them had the blood to hear the second word under it. You do. It is a name, and it is not yours. Orrin.",
        choices: [
          { id: 'follow', text: 'Follow it. (Silverwood blood)', when: { class: 'elf' }, tags: ['class'], effects: [{ questStart: ELF }], next: 'dusk' },
          { id: 'no', text: 'Not now.', next: 'end' },
        ],
      },
      {
        id: 'dusk',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The whisper goes south with the failing light, toward the Plaza, and thins to nothing by full dark. It walks at dusk. Come back then and keep its pace.',
        next: 'end',
      },
    ],
  },
  // The Plaza (its `ev_plaza_duelling_ground`, while the quest stands at `duel`): the buried duelling-ground; draw (Bladesong: the fight,
  // `onVictory` → won) or stand still and let it pass (Shadowstep: → passed) — STORY §11.8 stages 2–3
  {
    id: 'scene_plaza_last_duel',
    title: 'The last duel',
    entry: 'down',
    nodes: [
      {
        id: 'down',
        tags: ['written'],
        speaker: 'narrator',
        text: "Under the fountain ring a flagstone has lifted on its hinge. Stairs, dry, cut for a dancer's step. Below, a long room floored in white marble scored with five hundred years of blade-marks, and a lamp that has no oil in it and is lit.",
        next: 'phantom',
      },
      {
        id: 'phantom',
        tags: ['written'],
        speaker: 'narrator',
        text: "At the far end a Shimmering Phantom stands in a duellist's third guard, flickering between one moment and the next. It is not fighting you. It is fighting a man who stood here in Year 44 and went to the Apex the next morning. It has been losing to him every dusk since.",
        choices: [
          { id: 'draw', text: 'Draw, and sing it. (Bladesong)', when: { class: 'elf' }, tags: ['class'], effects: [{ startCombat: 'enc_plaza_last_duel' }], next: 'end' },
          { id: 'still', text: 'Stand still, and let it pass. (Shadowstep)', when: { class: 'elf' }, tags: ['class'], next: 'still' },
          { id: 'back', text: 'Go back up.', next: 'end' },
        ],
      },
      {
        id: 'still',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You stand where Orrin stood and do not move. The Phantom flickers, and strikes where you were, which is where he was, which is five hundred years ago. The blade goes through a man who is not there. It bows to him. The lamp goes out.',
        onEnter: [{ questAdvance: { quest: ELF, stage: 'passed' } }],
        next: 'mark',
      },
      {
        id: 'mark',
        tags: ['written'],
        speaker: 'narrator',
        text: "In the floor where the duellist stood, cut deep and inked with something that has not faded: a mark, a circle crossed once. The first Wayfinder's. Seven more stood after him; the Ledger has their names.",
        next: 'end',
      },
    ],
  },

  // ==== Brak and Borin · q_class_ironclad_warden (The Wall That Holds) ==========================================================

  // STORY §11.8: a Wildling pack at the barricade tonight; Brak wants a wall. Offered by `talk` in the `offer` band, and chained from
  // his hub (scene_brak_arc "About the barricade.", the one edit to companions_u54.ts)
  {
    id: 'scene_brak_wall_offer',
    npcId: BRAK,
    title: 'A wall',
    when: classOffer('ironclad_warden', WARDEN),
    priority: SCENE_PRIORITY.offer,
    entry: 'pack',
    nodes: [
      {
        id: 'pack',
        tags: ['written'],
        speaker: BRAK,
        text: 'Scouts counted a pack in the fog. Cats first, then the big ones. Tonight. Barricade has a gap in it, and I have two scouts and an axe.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: BRAK,
        text: 'You stand like a wall. Nomad-built. Be one. The gap, all night, nothing through. Three waves, if the scouts can count.',
        choices: offer(WARDEN, 'I will hold the gap.', 'Not tonight.', 'agree', 'refused'),
      },
      { id: 'agree', tags: ['written'], speaker: BRAK, text: "Good. Guard when they wind up. Shout when they look at the scouts. Rest of it is standing there. You're built for it.", next: 'end' },
      { id: 'refused', tags: ['written'], speaker: BRAK, text: "Then it's me and the axe. One of us runs out first.", next: 'end' },
    ],
  },
  {
    id: 'scene_brak_wall_waiting',
    npcId: BRAK,
    when: { all: [NOT_IN_HORDE, active(WARDEN), { not: stageOf(WARDEN, 'dawn') }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'gap',
    nodes: [{ id: 'gap', tags: ['written'], speaker: BRAK, text: "Night. Gap's that way. Don't go through it; that's their job.", next: 'end' }],
  },
  // The Camp (its `ev_camp_barricade_gap`, while the quest stands at `hold`): the gap; the first wave (the three chain, ../quests/classes.ts)
  {
    id: 'scene_camp_barricade_night',
    title: 'The gap',
    entry: 'gap',
    nodes: [
      {
        id: 'gap',
        tags: ['written'],
        speaker: 'narrator',
        text: 'The gap faces north, two paces wide, scrap iron on either side and nothing in the middle but you. The scouts have torches. Brak has the axe and is not using it. In the fog something coughs, twice.',
        choices: [
          { id: 'take', text: 'Plant your feet. (Bulwark)', when: { class: 'ironclad_warden' }, tags: ['class'], effects: [{ startCombat: 'enc_camp_wall_wave_1' }], next: 'end' },
          { id: 'not_yet', text: 'Not yet.', next: 'end' },
        ],
      },
    ],
  },
  // STORY §11.8 stage 3: Borin tempers the shield at dawn. Consequences: Ironclad +5 and the Ironclad Hammer (the quest's rewards)
  {
    id: 'scene_borin_wall_tempered',
    npcId: BORIN,
    title: 'Tempered',
    when: { all: [NOT_IN_HORDE, stageOf(WARDEN, 'dawn')] },
    priority: SCENE_PRIORITY.report,
    entry: 'plate',
    nodes: [
      {
        id: 'plate',
        tags: ['written'],
        speaker: BORIN,
        text: "Speak plain. You held the Camp's gap all night with that on your arm, and the fire can smell it on you. Give it here.",
        next: 'temper',
      },
      {
        id: 'temper',
        tags: ['written'],
        speaker: BORIN,
        text: 'Draw it hot, quench it slow. Iron that has been hit learns; it wants tempering while it still remembers the blows. There. It will take a Maul now and not ring.',
        next: 'hammer',
      },
      {
        id: 'hammer',
        tags: ['written'],
        speaker: BORIN,
        text: 'And this. Riveted iron on ash. I make ten a season and sell nine; the tenth goes to whoever the fire says. She says you. Brak said wall. She said hammer. Both of you are right.',
        onEnter: [{ questAdvance: { quest: WARDEN, stage: 'tempered' } }],
        next: 'end',
      },
    ],
    companionReactions: [{ companionId: 'brak', text: 'Brak: "Three waves. Counted them. Nothing through. Write that down somewhere the fire can\'t burn."' }],
  },
  {
    id: 'scene_borin_wall_after',
    npcId: BORIN,
    when: { all: [NOT_IN_HORDE, completed(WARDEN)] },
    priority: SCENE_PRIORITY.after,
    entry: 'holding',
    nodes: [{ id: 'holding', tags: ['written'], speaker: BORIN, text: "The plate's holding? Good. Don't bring it back till it's been hit again. The fire likes a story.", next: 'end' }],
  },

  // ==== Nyx · q_class_shadow_weaver (The Unlit Thread) ==========================================================================

  // STORY §11.8: whether the void knows your hand. The `offer` band: the legacy shard offer (first in content order) wins the tie until
  // it is taken; her arc's offers (U55) win theirs while they stand
  {
    id: 'scene_nyx_unlit_thread_offer',
    npcId: NYX,
    title: 'Your hand',
    when: classOffer('shadow_weaver', WEAVER, [AT_CHASM, { not: NYX_HOSTILE }]),
    priority: SCENE_PRIORITY.offer,
    entry: 'hand',
    nodes: [
      {
        id: 'hand',
        tags: ['written'],
        speaker: NYX,
        text: 'You hold your hands the way we did, before. Palm down, the fingers a little open. The void stirs when you do it. I would like to know whether it knows you, or only the shape.',
        next: 'ask',
      },
      {
        id: 'ask',
        tags: ['written'],
        speaker: NYX,
        text: "There is a seam at the Hollow's far edge, under the curtain. Go to it at night and feel for it, the way you would feel for a pulse. Something comes to the hand. Hex it. Make it turn on its own. And take nothing from what follows; the void remembers a thief.",
        choices: offer(WEAVER, 'I will feel for the seam.', 'Not yet.', 'agree', 'refused'),
      },
      { id: 'agree', tags: ['written'], speaker: NYX, text: 'Night. The seam is cold on the back of the hand first. Do not pull it. It pulls.', next: 'end' },
      { id: 'refused', tags: ['written'], speaker: NYX, text: 'Then keep your hands in your sleeves. The void is patient with the shape of a thing. Less so with the thing.', next: 'end' },
    ],
  },
  {
    id: 'scene_nyx_unlit_thread_waiting',
    npcId: NYX,
    when: { all: [NOT_IN_HORDE, AT_CHASM, { any: [stageOf(WEAVER, 'seam'), stageOf(WEAVER, 'hex')] }] },
    priority: SCENE_PRIORITY.waiting,
    entry: 'colder',
    nodes: [{ id: 'colder', tags: ['written'], speaker: NYX, text: 'The Hollow, at night, the far edge. Feel for it. It is colder than the rest of the dark, which you would not think possible, and it is.', next: 'end' }],
  },
  // The Hollow (its `ev_hollow_feel_seam`, while the quest stands at `hex`): the seam, the Stalker that comes to the hand, the hex (Hex)
  // that turns it on its pack, and the Shard left (→ return) or taken (→ return_took) — STORY §11.8 stage 2
  {
    id: 'scene_hollow_unlit_thread',
    title: 'The seam',
    entry: 'seam',
    nodes: [
      {
        id: 'seam',
        tags: ['written'],
        speaker: 'narrator',
        text: "You put your hand out flat into the dark at the scree's edge, under the curtain, and go by touch. Cold, colder, and then a line in it like a healed cut, running up and away. The seam. It pulls, a little, at the hand that found it.",
        next: 'stalker',
      },
      {
        id: 'stalker',
        tags: ['written'],
        speaker: 'narrator',
        text: 'Something comes along the seam toward your hand, the way a fish comes to a finger in the water. A Stalker, eyes like cold stars, alone, ahead of its pack. It stops a pace off and tilts its head. It is waiting to be told what you are.',
        choices: [
          { id: 'hex', text: 'Put the hex in it. (Hex)', when: { class: 'shadow_weaver' }, tags: ['class'], next: 'turns' },
          { id: 'withdraw', text: 'Take your hand back.', next: 'end' },
        ],
      },
      {
        id: 'turns',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You take the strength out of it before it can swing: a word, a turn of the wrist, and the hex goes into it like cold into stone. It shivers once, all along its length. Then it turns, and goes back up the seam toward the two cold stars behind it, and does not go as a friend.',
        next: 'pack',
      },
      {
        id: 'pack',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You do not watch. You hear it: the scree moving, a sound like a rope parting, then another, then nothing. When it is quiet you go up. Three shapes fraying into smoke on the stones, and in the crystal where they fell, a Void Shard, warm.',
        choices: [
          { id: 'leave', text: 'Leave it. Take nothing.', effects: [{ questAdvance: { quest: WEAVER, stage: 'return' } }], next: 'nothing' },
          { id: 'take', text: 'Take the Shard.', effects: [{ giveItem: { item: 'item_void_shard' } }, { questAdvance: { quest: WEAVER, stage: 'return_took' } }], next: 'took' },
        ],
      },
      {
        id: 'nothing',
        tags: ['written'],
        speaker: 'narrator',
        text: 'You leave it in the crystal and walk back down the scree with your hands in your sleeves. Behind you the seam closes over, the way a healed cut does. It knows your hand now.',
        next: 'end',
      },
      {
        id: 'took',
        tags: ['written'],
        speaker: 'narrator',
        text: 'It is cold in your palm before your fingers close. Behind you the seam closes over. It knows your hand now, and what it held.',
        next: 'end',
      },
    ],
  },
  // STORY §11.8 stage 3: "Return; she says the thing she says to no one else" — with the Shard left. Consequences: Weavers +5 (on the
  // line), the Chasmglass Focus (the quest's reward either way). The Shard taken: no line, no +5 (the void remembers a thief)
  {
    id: 'scene_nyx_unlit_thread_report',
    npcId: NYX,
    title: 'What the void did',
    when: { all: [NOT_IN_HORDE, AT_CHASM, { any: [stageOf(WEAVER, 'return'), stageOf(WEAVER, 'return_took')] }] },
    priority: SCENE_PRIORITY.report,
    entry: [
      { when: stageOf(WEAVER, 'return_took'), node: 'thief' },
      { when: { all: [] }, node: 'knows' },
    ],
    nodes: [
      {
        id: 'knows',
        tags: ['written'],
        speaker: NYX,
        text: 'It turned. I felt it from here; the void remembers a hex the way skin remembers a burn. And your hands are empty. You left the Shard where the pack died.',
        next: 'one_of_us',
      },
      {
        id: 'one_of_us',
        tags: ['story'],
        speaker: NYX,
        text: 'You could have been one of us. Of the nine, I mean.',
        onEnter: [{ rep: { faction: 'weavers', delta: 5 } }, { questAdvance: { quest: WEAVER, stage: 'one_of_us' } }],
        next: 'focus',
      },
      {
        id: 'focus',
        tags: ['written'],
        speaker: NYX,
        text: 'Take this instead. Glass from the lip, ground to a lens. It is always cold. So were we.',
        next: 'end',
      },
      {
        id: 'thief',
        tags: ['written'],
        speaker: NYX,
        text: 'It turned. I felt it from here. And then you went up the scree and put your hand in the crystal, and I felt that too. The void remembers a thief, Wayfinder. It is the one thing it never forgets.',
        next: 'focus_cold',
      },
      {
        id: 'focus_cold',
        tags: ['written'],
        speaker: NYX,
        text: 'Take the lens anyway; it was always going to be yours. I had something else to say to you. I find I do not.',
        onEnter: [{ questAdvance: { quest: WEAVER, stage: 'remembered' } }],
        next: 'end',
      },
    ],
  },
  {
    id: 'scene_nyx_unlit_thread_after',
    npcId: NYX,
    when: { all: [NOT_IN_HORDE, AT_CHASM, completed(WEAVER)] },
    priority: SCENE_PRIORITY.after,
    entry: [
      { when: stageOf(WEAVER, 'remembered'), node: 'sleeves' },
      { when: { all: [] }, node: 'once' },
    ],
    nodes: [
      { id: 'once', tags: ['written'], speaker: NYX, text: 'Of the nine, I mean. I said that. Do not make me say it twice; the void remembers it once.', next: 'end' },
      { id: 'sleeves', tags: ['written'], speaker: NYX, text: 'Your hands are in your sleeves. Keep them there.', next: 'end' },
    ],
  },
] satisfies DialogueSceneInput[];
