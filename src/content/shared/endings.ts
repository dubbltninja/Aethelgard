// The eight ending records (STORY §10 endings A–F and §10.7 the loop closers; PLAN §5.14; DESIGN §2.2, D-049, D-060, D-066 #7,
// D-067.14): six true endings and the two closers. The ids are the ones the engine and the Apex communion's outcomes use
// (`ENDING_LETTERS` in schema/ending.ts; `{ ending }` effects, `endLoop` closers). The flow after an ending is the engine's
// (reducers/loop.ts): Loop 1 closers → Loop 2 Day 1, every other closer and every true ending → Threshold.
//
// What is in a record:
//   requirements       STORY §10.x "Requirements", exactly (the condition blocks of DESIGN §13.3 example 11 for B). Closers: `{ all: [] }`.
//   requirementTexts   one "what you still need" line per requirement (the Gallery's eligibility hint). Words written for this
//                      unit; each `when` is the negation of one atom of `requirements`.
//   sequence           the ending's slides, taken verbatim from STORY §10.x "Final sequence" (stage directions such as "if present"
//                      and "Slide:" left out). U62 (ending sequences and scenes, STORY §13) writes the final player-facing text
//                      and may replace these.
//   epilogues          STORY §10.x "Epilogue slides", each with its label as STORY gives it ("World: …"); then the companion fates of
//                      STORY §7.7 (shown for a companion recruited this loop; Kaelen and Borin always).
//   achievementId      the DESIGN §15.2 achievement the ending pays (STORY §10.x names each achievement differently, see achievements.ts).
//   resonance          left at 0: the engine pays `GameConfig.resonance.ending` (+50, DESIGN §10.6) for 0, and `.closer` (+10) for a closer.
//   credits            every true ending closes with "a game by Tim Dibert" (D-027).
//
// The two closers are text the engine also holds (reducers/loop.ts `CLOSER_TEXT`, STORY §4.2 and §10.7), and a record that
// exists replaces that fallback in `endingSlides`. `closer_escape` carries the same two slides, with the "It happened anyway"
// line as a conditional epilogue (the fallback appends it to the shear; with a record it is a slide of its own). `closer_fall`
// carries the shear only: its first slide depends on the reason (death / expiry / rejected / released), which a Condition
// cannot read, so `endingSlides` puts `CLOSER_TEXT.fall[reason]` in front of the record's slides (U51's one engine line).
import type { Condition } from '@schema/condition';
import type { EndingInput } from '@schema/ending';

const companionRecruited = (id: 'ilyra' | 'brak' | 'nyx' | 'dask' | 'mireya' | 'caelum'): Condition => ({ companion: { id, state: 'recruited' } });

/** STORY §7.7 for one ending: each companion's one-line fate, shown when that companion was recruited this loop. */
function fates(row: Record<'ilyra' | 'brak' | 'nyx' | 'dask' | 'mireya' | 'caelum', string>, kaelenBorin?: string): NonNullable<EndingInput['epilogues']> {
  const names = { ilyra: 'Ilyra', brak: 'Brak', nyx: 'Nyx', dask: 'Dask', mireya: 'Mireya', caelum: 'Caelum' } as const;
  const out: NonNullable<EndingInput['epilogues']> = (Object.keys(names) as (keyof typeof names)[]).map((id) => ({
    subject: id,
    when: companionRecruited(id),
    text: `${names[id]}: ${row[id]}`,
  }));
  if (kaelenBorin !== undefined) out.push({ subject: 'kaelen_borin', text: `Kaelen and Borin: ${kaelenBorin}` });
  return out;
}

const atApex: Condition = { location: 'loc_temporal_breach_apex' };

// U62: the paintings behind the slides (docs/ART.md §5 location ids; the Ending screen shows them, U71) and a mood where
// STORY §10 implies one (the dialogue Mood words: grim, cold, warm, urgent, afraid, wry).
const APEX = 'loc_temporal_breach_apex';
const NEXUS = 'loc_chronos_nexus';
const CONFLUX = 'loc_conflux_chamber';
const DEPTHS = 'loc_heartstone_depths';
const RUINS = 'loc_whispering_ruins';
const LIBRARY = 'loc_shattered_library';
const PLAZA = 'loc_silverwood_plaza';
const SPIRES = 'loc_aetherium_spires';
const GLOWLANDS = 'loc_veridian_glowlands';
const CHASM = 'loc_chasm_of_whispers';
const EMBERFORGE = 'loc_emberforge';
const SHORE = 'loc_still_shore';
const FAR_LIGHT = 'loc_far_light';

export const endings = [
  // ---- A · The Warden's Vigil (STORY §10.1) --------------------------------------------------------------------------------
  {
    id: 'ending_wardens_vigil',
    letter: 'A',
    kind: 'true',
    name: "The Warden's Vigil",
    tagline: 'Bittersweet; stillness earned.',
    requirements: { all: [{ echo: 'echo_litany_complete' }, { flag: 'flag_tyrant_spared' }, { resolve: { min: 6 } }, atApex] },
    requirementTexts: [
      { when: { not: { echo: 'echo_litany_complete' } }, text: 'You do not yet hold all nine verses of the Litany.' },
      { when: { not: { flag: 'flag_tyrant_spared' } }, text: 'The Tyrant must be spared, not struck down.' },
      { when: { not: { resolve: { min: 6 } } }, text: 'It must hear you out: Resolve 6 or more in the communion.' },
      { when: { not: atApex }, text: 'Stand at the Temporal Breach Apex.' },
    ],
    // U62: STORY §10.1's six steps, its words verbatim, the joins in the house voice; art: the Apex, then the Nexus for the sky
    sequence: [
      {
        text: 'The chorus goes under, and the one voice beneath it says the thing it has never been able to say to anyone: "You have all nine. You could say them. You understand that whoever says the ninth must stay in it."',
        art: APEX,
        mood: 'grim',
      },
      {
        text: 'You speak the Litany, verse by verse. At each the matching member of the Nine surfaces in the mass and goes still: Oriel with ink on her hands, Korr, Vane, Hallow with his palms open. At the seventh, Masque, from his far side: "Tell us true." You tell him. "It failed." "Thank you."',
        art: APEX,
        mood: 'grim',
      },
      {
        text: 'Verse nine. "Hour, stay. Be as you are, and do not become. I hold you. I hold you." Veyran, for the first time in five hundred years, stops speaking. "—I hold you," you finish, and the mass is yours.',
        art: APEX,
        mood: 'cold',
      },
      {
        text: 'Veyran Thal steps out of the tear as a man, old, and sits down on the Apex floor. "It is heavier than it looks. It is lighter than it was." He dies in the next watch, in no pain.',
        art: APEX,
        mood: 'warm',
      },
      {
        text: 'Whoever came up with you is let go, gently; you have the hands for it now, and nothing else to do with them. Dask, if he came this far, is gathered into one instant, and rests.',
        art: APEX,
        mood: 'warm',
      },
      { text: 'The sky over the Apex steadies. The Breach Clock stops at the current day and does not restart.', art: NEXUS, mood: 'cold' },
    ],
    epilogues: [
      { subject: 'world', text: 'World: Aethelgard is saved; the Breach is held, not sealed; wild magic quiets to a murmur.' },
      { subject: 'remnants', text: 'Remnants: the Ledger gains an eighth name and the words "did not die."' },
      { subject: 'weavers', text: 'Weavers: the Shards stop falling; the Choir sings to a door that answers.' },
      { subject: 'ironclad', text: 'Ironclad: Hadda sends a scout to the Apex every year to leave an axe-head on the floor.' },
      {
        subject: 'wayfinder',
        text: 'Wayfinder: "You hold. You are not in pain. You can hear every bell in Silverwood, ringing back a note." No more Wayfinders are born: the symptom has a cause that is now content.',
      },
      ...fates(
        {
          ilyra: 'Writes the eighth name in the Ledger; never tears another portal.',
          brak: 'Lives; names a wagon-child Stonehand.',
          nyx: 'Weeps once, at the Chasm, where no one sees. Leads the Choir honestly.',
          dask: "Rests; the Tyrant's chorus is one voice quieter.",
          mireya: "Lanternreed glows or doesn't, as chosen; she tends it.",
          caelum: 'Stays in the present; apprentices to Borin.',
        },
        'Trade and forge; the Respite stays neutral.',
      ),
    ],
    achievementId: 'ach_vigil',
    credits: true,
  },

  // ---- B · The Mending (STORY §10.2; DESIGN §13.3 example 11) --------------------------------------------------------------
  {
    id: 'ending_mending',
    letter: 'B',
    kind: 'true',
    name: 'The Mending',
    tagline: 'Release; quiet joy with grief in it.',
    requirements: {
      all: [
        { resolve: { min: 8 } },
        { flag: 'flag_tyrant_spared' },
        { echo: 'echo_heartstone_resonance' },
        { echo: 'echo_litany_complete' },
        { echo: 'echo_void_resonance' },
        { echo: 'echo_anchor_mechanic' },
        { item: { id: 'item_breach_anchor' } },
        { counter: { name: 'factions_trusted', min: 2 } },
        { flag: 'flag_conflux_anchored' },
        { flag: 'flag_cradle_pin_anchored' },
        atApex,
      ],
    },
    requirementTexts: [
      { when: { not: { resolve: { min: 8 } } }, text: 'It must hear everything you can say: Resolve 8 in the communion.' },
      { when: { not: { flag: 'flag_tyrant_spared' } }, text: 'The Tyrant must be spared, not struck down.' },
      { when: { not: { echo: 'echo_heartstone_resonance' } }, text: 'You have not yet stabilized the Heartstone in any loop.' },
      { when: { not: { echo: 'echo_litany_complete' } }, text: 'You do not yet hold all nine verses of the Litany.' },
      { when: { not: { echo: 'echo_void_resonance' } }, text: "You have not yet earned the Weavers' trust in any loop." },
      { when: { not: { echo: 'echo_anchor_mechanic' } }, text: 'You have not yet learned what the Conflux chamber keeps.' },
      { when: { not: { item: { id: 'item_breach_anchor' } } }, text: 'Forge the Breach-anchor and carry it to the Apex.' },
      { when: { not: { counter: { name: 'factions_trusted', min: 2 } } }, text: 'Two factions must trust you.' },
      { when: { not: { flag: 'flag_conflux_anchored' } }, text: 'Something of yours must be set in the Conflux, and kept.' },
      { when: { not: { flag: 'flag_cradle_pin_anchored' } }, text: "The cradle's second pin must be set on its rim in the Before." },
      { when: { not: atApex }, text: 'Stand at the Temporal Breach Apex.' },
    ],
    // U62: STORY §10.2's six steps (the companions' lines of step 1 are the scene's reactions, dialogues/endings.ts)
    sequence: [
      {
        text: 'Movement III, the Breach-anchor cold in your hands and the line it was made for humming under the floor. "Both ends. You found the other end."',
        art: APEX,
        mood: 'grim',
      },
      { text: 'Consent. "Then I will say the word I have not been able to say."', art: APEX, mood: 'warm' },
      {
        text: "You drive the Breach-anchor into the Apex floor. In the Before, at the same instant, the cradle-pin set on the rim takes the Heartstone's weight that Hallow's iron could not.",
        art: CONFLUX,
        mood: 'urgent',
      },
      { text: 'Veyran speaks the ninth verse\'s ending: "Hour, go."', art: APEX, mood: 'cold' },
      {
        text: 'The Nine come out of the mass one by one as the dead, lie down, and are dead. Oriel, Korr, Vane, Hallow, Aulde, Sallow, Masque, and the empty place where Nyxaria stood. Veyran last, standing, then not.',
        art: APEX,
        mood: 'grim',
      },
      { text: 'Time flows forward. The Breach Clock reads "Day 1" and then, for the first time, "Day 31."', art: PLAZA, mood: 'warm' },
    ],
    epilogues: [
      {
        subject: 'world',
        text: 'World: the Breach is sealed from both ends; the Heartstone beats evenly; the Glowlands dim to ordinary green over a decade; the Spires fall silent.',
      },
      { subject: 'remnants', text: 'Remnants: begin a new count, Year 1 of the Mending, and argue about whether to keep the old one.' },
      { subject: 'weavers', text: 'Weavers: the Choir disbands; some stay to tend the Chasm as a grave.' },
      { subject: 'ironclad', text: 'Ironclad: Borin forges the next anchor-pin out of habit and hangs it over the door.' },
      {
        subject: 'wayfinder',
        text: 'Wayfinder: "You are not pulled anywhere. You stand in the Plaza where the fountains have stopped seeping, and you do not know what to do with your hands. It is a good problem." The ley stops making Wayfinders.',
      },
      ...fates(
        {
          ilyra: 'Keeps the Archive dry; teaches children the count of years starting again at one.',
          brak: 'Lives; speaks to his brother every market day.',
          nyx: 'Freed from her hope; grows old quickly and gratefully.',
          // STORY §7.7: "Rests, if `echo_dask_rest`; else fades with the Breach, content." — the two halves are the two entries below.
          dask: 'Fades with the Breach, content.',
          mireya: 'The leak stops; the changed stop changing; she grieves the light.',
          caelum: "Places the cradle-pin; stays; grows up in a world his masters didn't break twice.",
        },
        'Kaelen crosses to the camp for the first time in years. Borin lets the fire go out for one night, on purpose, and relights it.',
      ).map((e) => (e.subject === 'dask' ? { ...e, when: { all: [companionRecruited('dask'), { not: { echo: 'echo_dask_rest' } }] } satisfies Condition } : e)),
      { subject: 'dask', when: { all: [companionRecruited('dask'), { echo: 'echo_dask_rest' }] }, text: 'Dask: Rests.' },
    ],
    achievementId: 'ach_mending',
    credits: true,
  },

  // ---- C · The Weaver's Dawn (STORY §10.3) -----------------------------------------------------------------------------------
  {
    id: 'ending_weavers_dawn',
    letter: 'C',
    kind: 'true',
    name: "The Weaver's Dawn",
    tagline: 'Dark; a circle closing with a click.',
    requirements: {
      all: [
        { rep: { faction: 'weavers', min: 60 } },
        { flag: 'flag_heartstone_exploited' },
        { item: { id: 'item_heartstone_core' } },
        { companion: { id: 'nyx', state: 'active' } },
        { loyalty: { companion: 'nyx', min: 50 } },
        { quest: { id: 'q_what_she_would_undo', stage: 'agreed' } },
        { not: { flag: 'flag_tyrant_dead' } },
        atApex,
      ],
    },
    requirementTexts: [
      { when: { not: { rep: { faction: 'weavers', min: 60 } } }, text: 'The Weavers must be sworn to you.' },
      { when: { not: { flag: 'flag_heartstone_exploited' } }, text: 'The Heartstone must have been seized, not soothed or shattered.' },
      { when: { not: { item: { id: 'item_heartstone_core' } } }, text: 'Carry the Heartstone Core.' },
      { when: { not: { companion: { id: 'nyx', state: 'active' } } }, text: 'Nyx must walk beside you.' },
      { when: { not: { loyalty: { companion: 'nyx', min: 50 } } }, text: 'Nyx must trust you.' },
      { when: { not: { quest: { id: 'q_what_she_would_undo', stage: 'agreed' } } }, text: "You must have agreed to Nyx's plan." },
      { when: { flag: 'flag_tyrant_dead' }, text: 'The Tyrant must still be alive.' },
      { when: { not: atApex }, text: 'Stand at the Temporal Breach Apex.' },
    ],
    // U62: STORY §10.3's six steps; the last slide is its one black line, on the Ruins
    sequence: [
      {
        text: 'The Apex. Nyx, for the first time, looks at the Tyrant\'s face. "Veyran. It\'s me. I\'m going to fix it." The chorus says her name in eight voices and his.',
        art: APEX,
        mood: 'afraid',
      },
      {
        text: 'With the Heartstone Core you and Nyx tear the hold open. The Horde does not wait for the Tyrant to die; it comes as the hold fails, and the present unravels behind you as you step through.',
        art: APEX,
        mood: 'urgent',
      },
      {
        text: 'Silverwood Before, Last Bell, dusk, the ninth bell. Nyx runs down the Archive stair past Caelum. You follow. The circle is closed; she cannot enter it; she speaks the sixth verse\'s warning from the edge and Hallow turns, and says "Stop," and Veyran says "It holds."',
        art: CONFLUX,
        mood: 'urgent',
      },
      {
        text: 'It fails identically. The recoil, finding the one mind that has named the dark twice, does not throw her forward. It keeps her. She becomes one of the shards.',
        art: CONFLUX,
        mood: 'grim',
      },
      {
        text: 'The tear widens. Veyran steps in. The mass forms. Among the skeletal limbs and crystalline shards there is a face you know, because it is yours.',
        art: APEX,
        mood: 'cold',
      },
      { text: 'Five hundred years later, something pulls at the edge of the Whispering Ruins.', art: RUINS, mood: 'cold' },
    ],
    epilogues: [
      { subject: 'world', text: 'World: unravelled, then remade identically, with one more in the Tyrant.' },
      // STORY §10.3 "Factions: one line each" — the same line, three times, as the circle closes
      { subject: 'remnants', text: 'Remnants: they form again. They are wrong again, in the same three ways.' },
      { subject: 'weavers', text: 'Weavers: they form again. They are wrong again, in the same three ways.' },
      { subject: 'ironclad', text: 'Ironclad: they form again. They are wrong again, in the same three ways.' },
      { subject: 'wayfinder', text: 'Wayfinder: "You hold. You are in pain that does not vary. You are waiting for someone to cross."' },
      ...fates(
        {
          ilyra: 'Unravelled with the Library, holding a door nobody comes through.',
          brak: 'Dies holding a line against a tide that was always coming.',
          nyx: 'Becomes one of the shards.',
          dask: 'Scattered again across a world that is ending.',
          mireya: 'Unravelled.',
          caelum: 'Dies in the chamber on the stair, as he always did.',
        },
        'Unravelled.',
      ),
    ],
    achievementId: 'ach_weavers_dawn',
    credits: true,
  },

  // ---- D · The Iron Silence (STORY §10.4) --------------------------------------------------------------------------------------
  {
    id: 'ending_iron_silence',
    letter: 'D',
    kind: 'true',
    name: 'The Iron Silence',
    tagline: 'Stern; a cost paid in full and in silence.',
    requirements: {
      all: [
        { rep: { faction: 'ironclad', min: 60 } },
        { flag: 'flag_heartstone_destroyed' },
        { item: { id: 'item_breach_anchor' } },
        { echo: 'echo_iron_that_does_not_wish' },
        { companion: { id: 'brak', state: 'active' } },
        atApex,
      ],
    },
    requirementTexts: [
      { when: { not: { rep: { faction: 'ironclad', min: 60 } } }, text: 'The Ironclad must be sworn to you.' },
      { when: { not: { flag: 'flag_heartstone_destroyed' } }, text: 'The Heartstone must have been shattered.' },
      { when: { not: { item: { id: 'item_breach_anchor' } } }, text: 'Forge the Breach-anchor and carry it to the Apex.' },
      { when: { not: { echo: 'echo_iron_that_does_not_wish' } }, text: 'You do not yet know what iron the cradle was made of.' },
      { when: { not: { companion: { id: 'brak', state: 'active' } } }, text: 'Brak must stand at your shoulder.' },
      { when: { not: atApex }, text: 'Stand at the Temporal Breach Apex.' },
    ],
    // U62: STORY §10.4's five steps; step 4 "in one slide per place", each on its painting
    sequence: [
      {
        text: 'The Apex, Brak at your shoulder; he insisted, and this is the one loop he is allowed. The thing in the mass looks at what you carry. "Iron that does not wish. He made that for me once. I see."',
        art: APEX,
        mood: 'grim',
      },
      {
        text: 'You drive the Breach-anchor into the Apex floor and Brak hammers it home with the flat of his axe. The ley line under the Apex parts with a sound like a bell cracking.',
        art: APEX,
        mood: 'urgent',
      },
      {
        text: "The Breach, fed by nothing, closes like a mouth with nothing to say. The Tyrant's mass goes to dust without a scream; it does not unravel, because there is nothing left for it to unravel through. A man is briefly visible, and then is not.",
        art: APEX,
        mood: 'cold',
      },
      { text: 'The Spires stop humming. The glass goes still in the frames, and stays glass.', art: SPIRES, mood: 'cold' },
      { text: 'The Glowlands go dark. The reeds are reeds; the water is water.', art: GLOWLANDS, mood: 'cold' },
      { text: "The Chasm's murmurs end. The void remembers nothing, and says so.", art: CHASM, mood: 'cold' },
      { text: 'Ilyra, in the Ruins, puts a hand to her ear. The whispers are not louder today. They are not there.', art: RUINS, mood: 'cold' },
      { text: "The Emberforge's fire burns as an ordinary fire. Borin feeds it anyway.", art: EMBERFORGE, mood: 'warm' },
      { text: 'Brak: "Quiet. I thought I\'d like it."', art: APEX, mood: 'wry' },
    ],
    epilogues: [
      { subject: 'world', text: 'World: magic dies; no more Wayfinders; a mundane world with ruins in it.' },
      { subject: 'remnants', text: 'Remnants: keep books nobody can hear anymore; the count of years continues out of stubbornness.' },
      { subject: 'weavers', text: 'Weavers: disperse; Nyx sleeps.' },
      { subject: 'ironclad', text: 'Ironclad: inherit; Hadda is first chief of a confederation that no longer needs the oath and keeps it anyway.' },
      { subject: 'wayfinder', text: 'Wayfinder: "The pull is gone. You are a person with a sword in a place with weather."' },
      ...fates(
        {
          ilyra: 'Hears nothing ever again; copies books by hand and says it is enough.',
          // STORY §7.7: "Lives (he was at your shoulder for the stroke; D runs no Horde); the Nomads inherit a mundane world and he hates how quiet it is."
          brak: 'Lives; the Nomads inherit a mundane world and he hates how quiet it is.',
          nyx: 'Ages five hundred years in a season; sleeps.',
          dask: 'Gone; nothing between instants remains.',
          mireya: 'The fen goes dark; she lights real lanterns.',
          caelum: 'Loses his Chrono gift; learns to forge.',
        },
        "Borin's fire is the only fire that matters now.",
      ),
    ],
    achievementId: 'ach_iron_silence',
    credits: true,
  },

  // ---- E · The Long Archive (STORY §10.5) ----------------------------------------------------------------------------------------
  {
    id: 'ending_long_archive',
    letter: 'E',
    kind: 'true',
    name: 'The Long Archive',
    tagline: 'Gentle and uncanny; peace as a held breath.',
    requirements: {
      all: [
        { rep: { faction: 'remnants', min: 60 } },
        { flag: 'flag_heartstone_stabilized' },
        { echo: 'echo_heartstone_resonance' },
        { any: [{ not: { corruption: { min: 6 } } }, { flag: 'flag_corruption_cleansed' }] },
        { companion: { id: 'ilyra', state: 'recruited' } },
        { quest: { id: 'q_the_keepers_price', stage: 'keeper' } },
        { location: 'loc_heartstone_depths' },
        { clock: { daysLeft: { max: 1 } } },
      ],
    },
    requirementTexts: [
      { when: { not: { rep: { faction: 'remnants', min: 60 } } }, text: 'The Remnants must be sworn to you.' },
      { when: { not: { flag: 'flag_heartstone_stabilized' } }, text: 'The Heartstone must have been soothed, not seized or shattered.' },
      { when: { not: { echo: 'echo_heartstone_resonance' } }, text: 'You have not yet stabilized the Heartstone in any loop.' },
      { when: { corruption: { min: 6 } }, text: 'The Corruption on you is too deep, unless Elder Wen cleanses it.' },
      { when: { not: { companion: { id: 'ilyra', state: 'recruited' } } }, text: 'Ilyra must have joined you.' },
      { when: { not: { quest: { id: 'q_the_keepers_price', stage: 'keeper' } } }, text: "You have not yet reached the Keeper's offer." },
      { when: { not: { location: 'loc_heartstone_depths' } }, text: 'Stand in the Heartstone Depths.' },
      { when: { not: { clock: { daysLeft: { max: 1 } } } }, text: 'It comes on the last dawn before the thirtieth.' },
    ],
    // U62: STORY §10.5's five steps; the choice itself is the scene's (Stay / Leave), so the last slide holds both roads
    sequence: [
      {
        text: "The Heartstone Depths on the last dawn before the thirtieth. Ilyra sets the Stabilized Heartstone back in the cradle's broken rim; the resonance climbs the ley line to the Apex.",
        art: DEPTHS,
        mood: 'warm',
      },
      {
        text: "The Apex, seen through the Lens from the Nexus: the Tyrant's mass eases, the limbs sink, the chorus drops to a hum. Under it, once: \"Ah. The archivist's blood. She would do this. Tell her it is not nothing.\"",
        art: NEXUS,
        mood: 'warm',
      },
      { text: 'The thirtieth dawn comes up and goes down and comes up again as the first. Nothing unravels. Ilyra, alone of everyone, remembers.', art: RUINS, mood: 'cold' },
      { text: 'Ilyra: "I will keep it. All of it. Every time. Go or stay; I\'ll know which you chose, and I\'ll be kind about it."', art: RUINS, mood: 'warm' },
      {
        text: 'Stay, and you fade on the Ruins, Day 1 again, the Amulet warm, Ilyra smiling before she has seen you. Go, and she tears a portal without pain: the same door, a different shore.',
        art: LIBRARY,
        mood: 'cold',
      },
    ],
    epilogues: [
      { subject: 'world', text: 'World: Aethelgard becomes a conscious time-ring, safe and unchanging, thirty days long.' },
      {
        subject: 'remnants',
        text: "Remnants: the Keeper's order; one person who remembers, and children who are told stories about the thirty-first day.",
      },
      { subject: 'weavers', text: 'Weavers: the Shards fall and are gathered and fall again.' },
      { subject: 'ironclad', text: 'Ironclad: the same hunt, the same fire, the same market day.' },
      {
        subject: 'wayfinder',
        text: 'Wayfinder: "You may leave. You are the only one who may. Ilyra waves, and already knows whether you will wave back."',
      },
      ...fates(
        {
          ilyra: 'Becomes the Keeper; remembers every loop; is kind about it.',
          brak: 'Lives the same thirty days forever and never minds.',
          nyx: 'Keeps her secret forever in a world where forever is thirty days.',
          dask: "Stays in the Pass, flickering, the Keeper's only confidant.",
          mireya: 'The fen glows the same every thirty days.',
          caelum: 'Lives the same three days in the Before, forever, never delivering the message.',
        },
        'Same market day forever.',
      ),
    ],
    achievementId: 'ach_long_archive',
    credits: true,
  },

  // ---- F · The Unbound (STORY §10.6) --------------------------------------------------------------------------------------------
  {
    id: 'ending_unbound',
    letter: 'F',
    kind: 'true',
    name: 'The Unbound',
    tagline: 'Cold; honest; the game does not argue.',
    requirements: {
      all: [{ flag: 'flag_tyrant_spared' }, { loop: { min: 2 } }, { resolve: { min: 3 } }, atApex, { flag: 'flag_refused_all_paths' }],
    },
    requirementTexts: [
      { when: { not: { flag: 'flag_tyrant_spared' } }, text: 'The Tyrant must be spared, not struck down.' },
      { when: { not: { loop: { min: 2 } } }, text: 'It opens only once you have come back from a loop.' },
      { when: { not: { resolve: { min: 3 } } }, text: 'It must hear you out: Resolve 3 or more in the communion.' },
      { when: { not: atApex }, text: 'Stand at the Temporal Breach Apex.' },
      { when: { not: { flag: 'flag_refused_all_paths' } }, text: 'Turn down every other path the Tyrant offers.' },
    ],
    // U62: STORY §10.6's three steps; the last is the legacy line, now literally true
    sequence: [
      {
        text: 'Communion to the end of Movement III. Spared, it says the only thing it has left to offer: "Or go. The tear is open. I will not stop you. I have never been able to stop anyone."',
        art: APEX,
        mood: 'cold',
      },
      { text: 'You step past it, into the Breach, toward somewhere that is not Aethelgard. Nothing reaches after you.', art: APEX, mood: 'cold' },
      {
        text: 'The journey through the Temporal Breach is disorienting, a maelstrom of fractured realities. When you finally emerge, the air is still, the world unfamiliar.',
        art: FAR_LIGHT,
        mood: 'cold',
      },
    ],
    epilogues: [
      { subject: 'world', text: 'World: "The thirtieth dawn came. The sky tore. It was as you saw it."' },
      { subject: 'remnants', text: 'Remnants: "They kept writing until there was no paper."' },
      { subject: 'weavers', text: 'Weavers: "They sang."' },
      { subject: 'ironclad', text: 'Ironclad: "Twenty held the Nexus for a day. It was not enough and they knew."' },
      { subject: 'wayfinder', text: 'Wayfinder: "You remember all of it. Nobody where you are knows what an Echo is."' },
      ...fates({
        ilyra: 'Holds the portal; you go; she does not know where.',
        brak: 'Lives; the thirtieth dawn comes after you are gone, and he holds the Nexus for a day.',
        nyx: 'Goes to the Apex at last and looks at his face.',
        dask: 'Watches you go and says "fair."',
        mireya: 'As chosen; she waves from the stilts.',
        caelum: 'Comes with you if asked; else returns to the stair.',
      }),
    ],
    achievementId: 'ach_unbound',
    credits: true,
  },

  // ---- The loop closers (STORY §4.2, §4.3, §10.7) ---------------------------------------------------------------------------------
  {
    id: 'closer_escape',
    kind: 'closer',
    name: 'The Escape',
    tagline: 'Any flight through the Library portal into the Breach.',
    requirements: { all: [] },
    sequence: [
      {
        // STORY §4.2 step 1: the legacy paragraph, lightly trimmed (= reducers/loop.ts CLOSER_TEXT.lastThreshold)
        text: "The Last Threshold. You plunge through the shimmering portal, the screams of Aethelgard's final moments echoing behind you. The journey through the Temporal Breach is disorienting, a maelstrom of fractured realities. When you finally emerge, the air is still, the world unfamiliar. The Wayfinder's true journey has just begun...",
        art: LIBRARY,
        mood: 'urgent',
      },
      {
        // STORY §4.2 step 3: the Breach shear (= CLOSER_TEXT.shear)
        text: 'The stillness breaks. Something behind you has not finished speaking. The Breach does not lead beyond. It leads back.',
        art: SHORE,
        mood: 'cold',
      },
    ],
    epilogues: [
      // STORY §4.3: after a clock expiry the shear carries one more line (the engine appends it to the shear; here it is a slide)
      {
        subject: 'world',
        when: { all: [{ flag: 'flag_clock_expired' }, { not: { flag: 'flag_tyrant_dead' } }] },
        text: 'You did not kill it. It happened anyway.',
      },
      // U62 (STORY §12 `echo_ilyra_cost`: "watch the Library fall after passing the portal"): from Loop 2, what the door costs
      {
        subject: 'ilyra',
        when: { all: [{ loop: { min: 2 } }, { flag: 'flag_horde_active' }] },
        text: 'From the far side you see it for the length of one breath: the Library going, and Ilyra still holding the door when it takes her. That is what the door costs. Now you know.',
      },
    ],
    achievementId: 'ach_the_escape',
  },
  {
    id: 'closer_fall',
    kind: 'closer',
    name: 'The Fall',
    tagline: 'The Still Shore: grey water, no horizon, a far light.',
    reasons: ['death', 'expiry', 'rejected', 'released'],
    requirements: { all: [] },
    sequence: [{ text: 'The stillness breaks. Something behind you has not finished speaking. The Breach does not lead beyond. It leads back.', art: SHORE, mood: 'cold' }],
    epilogues: [
      {
        subject: 'world',
        when: { all: [{ flag: 'flag_clock_expired' }, { not: { flag: 'flag_tyrant_dead' } }] },
        text: 'You did not kill it. It happened anyway.',
      },
    ],
  },
] satisfies EndingInput[];
