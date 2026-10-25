// U61: the 103 Echo `codexLine`s (src/content/shared/echoes.ts) rewritten in the Wayfinder's own voice (D-100: U51's were
// mechanics notes; STORY §14's WN voice and §15.5 are the standard). Every line is read back against U51's, kept here verbatim
// (commit c27b972) so the rewrite is checked line by line: changed, ≤ 40 words (the schema's cap), first person or a margin
// note's clipped fragment, no tooltip wording (no "Ending A seen", no "Loop 2", no "loyalty 25", no percentages), and the
// facts the player needs to act on kept: the proper nouns the old line named still appear, and the exclusive pairs still say so.
import { describe, expect, test } from 'bun:test';
import { buildContentPack } from '@content/index';
import { echoes } from '@content/shared/echoes';
import { ECHO_CODEX_LINE_MAX_WORDS, EchoSchema } from '@schema/echo';
import { wordCount } from '@schema/codex';

/** U51's lines (c27b972), verbatim. */
const U51: Record<string, string> = {
  echo_litany_verse_1: "First verse of the Litany. Give the Crystal and Ilyra speaks it on your next meeting; keep it and Listen. Someone has to witness a thing for it to have happened.",
  echo_litany_verse_2: "Second verse. Read three Dark Spellbooks in one loop and the margins assemble it. It is spoken in the Conflux and chalked on a garret wall in the Before. Korr has an answer for it.",
  echo_litany_verse_3: "Third verse. The sigil-stones at the Blighted Outpost carry it, and in the Before Oriel hands a page of it across. Vane has an answer for it.",
  echo_litany_verse_4: "Fourth verse. It is found at Hallow's Cairn, and again in the Before. It answers Hallow's silence, and it belongs to the Breach-anchor's recipe.",
  echo_litany_verse_5: "Fifth verse. The Apprentice's errand carries it. So does a Spire, if you bring an Aetherium Shard to listen. Aulde has an answer for it.",
  echo_litany_verse_6: "Sixth verse. Learn what the light takes and the verse comes with it. The Before gives it too. Sallow has an answer for it.",
  echo_litany_verse_7: "Seventh verse. Stand at the Nexus at dawn and look through the Lens, or find it in the Before. Masque has an answer for it.",
  echo_litany_verse_8: "Eighth verse. Nyx's unmasking gives it, or Oriel's scroll read to her, or her own copy where she fell. Spoken, it corrects the Choir. Vell has an answer for it.",
  echo_litany_verse_9: "Ninth verse. The Tyrant gives it in the third movement at Resolve 6; so does Nyx once she is Loyal, or Veyran's study draft in the Before. Whoever says it stays in it.",
  echo_litany_complete: "All nine verses held. Ending A needs it, and so does the Mending. At the Apex the Tyrant falls silent when there are no gaps in what you say.",
  echo_heartstone_resonance: "Stabilize the Heartstone and it keeps an even beat. Endings B and E need this one. Ley-tuned crafting opens, and the Glowfen can be dammed. Not in a loop with Hunger or Silence.",
  echo_heartstone_hunger: "Exploit the Heartstone and it takes. Ending C hangs on it, and the Depths turn unstable. Not in a loop with Resonance or Silence.",
  echo_heartstone_silence: "Destroy the Heartstone and the Depths go dark. Ending D hangs on it, and the Breach-born are weaker by a quarter. Not in a loop with Resonance or Hunger.",
  echo_heartstone_triune: "Resonance, Hunger and Silence, held across loops: the stone has three states and you have seen each. Borin has a shortcut in the anchor talk.",
  echo_void_resonance: "Be Trusted by the Weavers in some loop: through Nyx, through Sethe, or through the body-print where she fell. Ending B listens for it at the consent.",
  echo_nine_voices: "Keep the Crystal and Listen in the Library, from Loop 2. It lets you say \"I know what you are, Nyx\", and it opens What the Crystal Heard.",
  echo_ninth_verse_unfinished: "Listen to the Crystal from Loop 2, or finish what the Crystal heard. The ninth verse was left open. In the first movement of the communion, it is an answer.",
  echo_nyx_is_of_the_nine: "Unmask her, by either road, and you know who Nyx was. Her dialogue tree opens, Dask can speak to her, and what she would undo comes within reach.",
  echo_breach_recoil: "Read Oriel's scroll to Nyx, or earn her loyalty. The recoil is what the dark does to the one who names it. In the communion it answers Vell. Not in a loop with the Danthe line.",
  echo_what_she_would_undo: "Nyx asked for help going back, and you heard her out. Ending C now has a name for its path.",
  echo_shard_moments: "Nyx taught you to read a Shard: it is a moment, torn. Do not keep more than three. Three is a verse.",
  echo_choir_knows: "You told Sethe what Nyx is. Sethe speaks to you differently now, and Nyx wakes Wary in the loops after.",
  echo_ilyra_watchword: "The voices in the stacks answered you, and the ink held. From the next loop Ilyra believes you the first time you meet.",
  echo_crystal_location: "Take the Crystal once and you remember where it lies. The next loop, its quest begins further along, with the Crystal waiting.",
  echo_oriel_lineage: "Read the scroll to Ilyra and the Door of Pages confirms it, or meet Oriel at her carrel in the Before. The Archway speaks in Oriel's voice. Not in a loop with the Recoil.",
  echo_oriel_drowned: "Oriel did not leave the Archives. Meet her at the carrel and she can be calmed instead of fought.",
  echo_archive_door: "Oriel's seal opens it. With this you can walk from the Sunken Archives to the Drowned Reach without the bells.",
  echo_ilyra_cost: "Watch the Library fall after you pass the portal, or hear it from Keeper Dray. Each portal costs the one who tears it. That is the Keeper's price.",
  echo_brak_death: "He dies at the Apex. Tell him so in the next loop and he stays away. He will not believe you, and he will remember it in his shoulders.",
  echo_brak_birth_name: "The name Brak gave up with the scout's oath. Say it to Kaelen and he asks you not to. It opens Blood and Salt through Kaelen.",
  echo_brak_lives: "Brak held the line and lived. Ending D goes easier for it, and he begins every loop at loyalty 25.",
  echo_day_of_teeth: "The Day of Teeth, told true, or read in Keeper Dray's Ledger. Hadda keeps the Nomads away from the Apex. Ending D leans on it.",
  echo_hallows_ember: "At his Cairn the iron is still warm. Hallow carried the fire north and did not set it down. Borin has things to say about it.",
  echo_iron_that_does_not_wish: "The Cairn's inscription with Borin's forge-mark, or the Cradle verse and a word with Borin. Without it, no Breach-anchor for Endings B and D.",
  echo_hallow_said_stop: "Hallow said it at the ritual. The Conflux says it again on Last Bell. In the communion it answers his silence and counts for two Resolve.",
  echo_tyrant_speaks: "Listen at the Apex, from Loop 2. It speaks. The communion opens, and combat pauses at the phase changes while it talks.",
  echo_tyrant_name: "Ask its name with the Nine Voices or with Dask's testimony, or hear it said in the Ninefold Hall. Nyx will say, \"You said his name.\"",
  echo_tyrant_jailer: "Any two of five sources and you understand what the Tyrant is doing. The first movement has an answer for it, and the factions' truth-tellings open.",
  echo_six_in_the_mass: "Six of the Nine are in the mass. Finish the second movement, or take the hint on the Still Shore. The Tyrants' hidden intents are shown.",
  echo_tyrant_consent: "At Resolve 8, with the anchor, the pin set and the Mending's Echoes, the third movement can ask and be answered. Ending B's last sequence needs it.",
  echo_tyrant_rejected: "Fail the communion and leave. The next one begins at the second movement.",
  echo_tyrant_never_struck: "The Stormcrown's bargain: it does not strike what keeps its distance. In the communion's first movement, that is an answer.",
  echo_apex_resonance: "Stand at the Apex once. From Loop 2 the Nexus gate opens without six quests.",
  echo_breach_clock: "Thirty dawns from the Ruins. Learn it from the Thirtieth Dawn, the High Mark, or the Ridge's view of the Apex. Exact-day warnings begin, and Steady Hours can be bought.",
  echo_thirtieth_dawn: "The clock ran out with the Tyrant alive. Granted on waking or at the Shore. It answers in the communion, opens Dray's notes, and is one source of the Jailer.",
  echo_amulet_memory: "Wake in Loop 2 and the Amulet is warm. Your hands remember a portal. It lets you Listen.",
  echo_threshold: "The first Fall. Grey water, no horizon, a far light. Dask is there, and the Threshold has quests.",
  echo_horde_path: "Witness the Horde once. Every Horde after shows its infection forecast on the map.",
  echo_flickering_man: "Dask, in the Shimmering Pass, heard all the way through. From Loop 2 he joins you at the first meeting, and his loyalty opens.",
  echo_seven_wayfinders: "Seven Wayfinders before you, and their marks. Dask's quest teaches it, or Keeper Dray's Ledger. It is an answer in the communion's first movement.",
  echo_wayfinder_symptom: "Being a Wayfinder is a symptom. Seven Marks teaches it; from Loop 3 the Tyrant says it aloud. It colours the Unbound's last line.",
  echo_dask_rest: "Dask gets his rest. Phase 3 has one voice fewer, and the epilogues say so.",
  echo_breach_door: "The Nexus shows a door when you carry the Lens and know the first verse. It leads to Silverwood Before.",
  echo_before_route: "You have stood in Silverwood in the three days before the fall. Quests in the Before, and Caelum, are open to you.",
  echo_ritual_inevitable: "Stop the ritual four times and watch it fail four times. Masque's perfect answer follows, and so does refusing Nyx with the truth.",
  echo_bells_of_silverwood: "Stand in the Plaza of Bells on Last Bell. The Bell-Vault order is known after, and the bell puzzle in the Before is solved.",
  echo_caelum_unanchored: "Caelum, not anchored in his time. He can cross forward and be recruited, and his masters' sin comes next. Not in a loop where he stayed.",
  echo_caelum_stayed: "Caelum chose the Before. The Mending is harder for it: you must place the pin yourself.",
  echo_caelum_forgives: "Caelum forgave his masters. At the consent there is no second test.",
  echo_caelum_cannot: "Caelum could not forgive. The consent takes a second test, and the Mending ends colder.",
  echo_hadrek_clockwright: "Hadrek, in the Ninefold Hall on First Bell. A second Orrery Key is yours to take.",
  echo_vask_seal: "From Tobrin Vask on Second Bell, or his hidden copy under Vane's Watch from Loop 2. The ward seal opens the Hall and the Conflux stair before Last Bell.",
  echo_crystal_seeded: "Tell the Library's dark Crystal in the Before what it will hear. From the next loop it knows your voice, whether you kept it or not.",
  echo_anchor_mechanic: "A talisman left on the cradle rim, found in the Depths; or Caelum's first words about the chamber. The Mending can begin, and the Mending's consent asks for it.",
  echo_anchor_half_a: "The first half of the Breach-anchor's design, read from Aulde's notes in her Eyrie.",
  echo_anchor_half_b: "The second half, from Tobrin Vask in the Conflux Chamber on Second Bell, or from his failsafe copy under Vane's Watch from Loop 2.",
  echo_anchor_schema: "Hold both halves, in any loops, and Borin can forge the Breach-anchor. Endings B and D need one.",
  echo_stone_hide_origin: "Vane's sigils, read at the Outpost with the Amulet, or in the Hall in the Before, or from the Warder Plate. One word stills the Outpost golems.",
  echo_spire_note: "The Spires hold a single note. Hear it there and the Aetherial Weavers pass you by on the first visit. Aulde has an answer for it.",
  echo_breathing_pool: "What the light takes, and what the Green gave back. It opens Preserve or Heal, and Sallow has an answer for it.",
  echo_eye_of_masque: "Look through the Lens at the Nexus and see what is on the far side of the sky. Masque has an answer for it.",
  echo_korr_marginalia: "Read any Dark Spellbook with the Amulet and Korr's hand is in every one. The first book each loop costs you nothing.",
  echo_glowfen_dammed: "The Glowfen dammed. The epilogue says so. Not in a loop where it was let run.",
  echo_glowfen_let_run: "The Glowfen left to run. The epilogue says so. Not in a loop where it was dammed.",
  echo_glowlands_leak: "The Glowlands' light is the Breach leaking. Mireya's lantern quest begins at its second stage.",
  echo_high_mark: "From the Windward Stair, look east and see the Breach's edge. The stair opens without the Talisman after, and the Sentinels let you pass.",
  echo_bell_vault: "The Bell Vault's quest teaches the order of the bells. After it, the bells are known.",
  echo_lightless_stair: "Its quest lights the stair, and it stays lit.",
  echo_ending_a: "Ending A seen to its last slide. A frame hangs in the Gallery, and a door opens to New Game+.",
  echo_ending_b: "Ending B seen to its last slide. A frame hangs in the Gallery, and a door opens to New Game+.",
  echo_ending_c: "Ending C seen to its last slide. A frame hangs in the Gallery, and a door opens to New Game+.",
  echo_ending_d: "Ending D seen to its last slide. A frame hangs in the Gallery, and a door opens to New Game+.",
  echo_ending_e: "Ending E seen to its last slide. A frame hangs in the Gallery, and a door opens to New Game+.",
  echo_ending_f: "Ending F seen to its last slide. A frame hangs in the Gallery, and a door opens to New Game+.",
  echo_kaelen_ledger: "Blood and Salt is done, and Kaelen keeps a better account of you. His prices drop five percent for good.",
  echo_borin_oath: "The Blighted Outpost done, then a word with Borin. He will forge void-forged things for you without the Trusted standing.",
  echo_emberforge_vein: "A third visit to the Emberforge in one loop, and the fire shows you where the ore runs. Eight ember ore each loop.",
  echo_weaver_sign: "Finish the Hollow Choir, or end a loop with the Weavers Trusted. They start you at 20 after, and the Veil's curtain opens without an escort.",
  echo_ironclad_oath: "End a loop with the Ironclad Trusted. Brak hears your word at the Ring. They start you at 20 after.",
  echo_ironclad_passwords: "Clear the Barren Peaks once. The pass opens without Brak's leave.",
  echo_nomad_signs: "Scout Ferrin at the Scorched Gate will teach them to a Neutral friend. The Gate and the Herd-Grave open.",
  echo_heartstone_path: "Reach the Heartstone Depths once. From Loop 2 the Depths open without the pulse.",
  echo_hollow_path: "Cross the Chasm bridge once. Voidscar Hollow opens without Whispers of the Void.",
  echo_portal_tear: "At the Keeper's Price, with the Remnants Trusted, Ilyra opens the Library portal on purpose from Loop 2. It closes the loop as an escape. Her oath of the unbound hand disables it for a loop.",
  echo_steppe_waystones: "The Bone Road, done. The Steppe's short road between the Scorched Gate and Reedmarch opens.",
  echo_rhune_choice: "Tidewell Hall's ledger, or Ilsabet Rhune in the Cistern Gardens on Second Bell. The Bell-Warden gives up the Cistern Key.",
  echo_dreyl_brand: "The Bone Orchard's brand. It answers the Steppe's beasts and opens the Ashbrand recipe.",
  echo_sky_oath: "Lightning takes a cairn on the Ashen Steppe when you carry the Sky-Whisper Talisman, and in the glass is a face. At the Perch, from Loop 2, the Stormcrown bargains instead of fighting.",
  echo_nyx_bond: "Nyx at loyalty 50 by a loop's end. The next loop she starts at 25.",
  echo_ilyra_bond: "Ilyra at loyalty 50 by a loop's end. The next loop she starts at 25.",
  echo_dask_bond: "Dask at loyalty 50 by a loop's end. The next loop he starts at 25.",
  echo_mireya_bond: "Mireya at loyalty 50 by a loop's end. The next loop she starts at 25.",
  echo_caelum_bond: "Caelum at loyalty 50 by a loop's end. The next loop he starts at 25. Brak's equivalent is the Line at the Nexus.",};

const pack = buildContentPack();
const FIRST_PERSON = /\bI\b|\bI'|\bme\b|\bmy\b|\bmine\b|\bI've\b|\bI'm\b/;
/** U51's tooltip shapes (D-100): the UI's own words and numbers, the Echo named as a line item. */
const TOOLTIP = /^(?:Ending [A-F]|Loop \d|Witnessed|Grants?|Unlocks?)\b|\bLoop \d|\bloyalty \d|\d+%|\d+ percent|\bstage \d|\bResolve \d|\bNew Game\+|seen to its last slide|A frame hangs|is yours to take|Exact-day/;
const STOP = new Set(['Ending', 'Loop', 'New', 'Game', 'Not', 'The', 'It', 'In', 'At', 'From', 'His', 'Her', 'He', 'She', 'They', 'Do', 'So', 'That', 'This', 'With', 'Without', 'And', 'A', 'An', 'Each', 'Every', 'Someone', 'Whoever', 'Granted', 'Exploit', 'Stabilize', 'Destroy', 'Fail', 'Stand', 'Finish', 'Keep', 'Listen', 'Read', 'Take', 'Learn', 'Hold', 'Tell', 'Ask', 'Watch', 'Wake', 'Being', 'Stop', 'Cross', 'Reach', 'Witness', 'Clear', 'End', 'Give', 'Unmask', 'Any', 'All', 'Nothing', 'Phase', 'Endings']);
/** Proper nouns in a line (stemmed of a plural or possessive): capitalised words, past the first of each sentence unless `anywhere`, less the stoplist. */
function nouns(line: string, anywhere = false): string[] {
  const out = new Set<string>();
  for (const sentence of line.split(/(?<=[.;:!?])\s+/)) {
    const words = sentence.split(/\s+/);
    for (const w of anywhere ? words : words.slice(1)) {
      const m = /^[A-Z][A-Za-z'-]{2,}/.exec(w.replace(/^[("']+/, ''));
      if (m && !STOP.has(m[0])) out.add(m[0].replace(/'s$/, '').replace(/'$/, '').replace(/s$/, ''));
    }
  }
  return [...out];
}

describe('the 103 Echo codex lines, rewritten (U61) against U51\'s (D-100)', () => {
  test('one line per Echo of the catalog, every one changed from U51\'s', () => {
    expect(Object.keys(U51).sort()).toEqual(echoes.map((e) => e.id).sort());
    expect(echoes).toHaveLength(103);
    for (const e of echoes) expect([e.id, e.codexLine !== U51[e.id]]).toEqual([e.id, true]);
    expect(new Set(echoes.map((e) => e.codexLine)).size).toBeGreaterThan(95); // the five bonds share a shape; the six endings differ in their first clause
  });

  test('every line is 4–40 words and the schema accepts it; the real pack builds', () => {
    for (const e of echoes) {
      const words = wordCount(e.codexLine);
      expect([e.id, words >= 4 && words <= ECHO_CODEX_LINE_MAX_WORDS]).toEqual([e.id, true]);
      expect([e.id, EchoSchema.safeParse(e).success]).toEqual([e.id, true]);
      expect(pack.echoes[e.id]?.codexLine).toBe(e.codexLine);
    }
  });

  test('the voice: the Wayfinder\'s own margin note, not a tooltip (first person in most lines; no UI numbers; no "Ending A seen", "Loop 2", "loyalty 25", "−5%"; no exclamation mark)', () => {
    const firstPerson = echoes.filter((e) => FIRST_PERSON.test(e.codexLine));
    expect(firstPerson.length).toBeGreaterThanOrEqual(80);
    for (const e of echoes) {
      expect([e.id, TOOLTIP.exec(e.codexLine)?.[0] ?? null]).toEqual([e.id, null]);
      expect([e.id, e.codexLine.includes('!')]).toEqual([e.id, false]);
      expect([e.id, e.codexLine === e.description]).toEqual([e.id, false]);
      // a margin note is short sentences: none over 30 words
      for (const s of e.codexLine.split(/(?<=[.;?])\s+/)) expect([e.id, s, wordCount(s) <= 30]).toEqual([e.id, s, true]);
    }
    // read aloud: a fixed sample, every ninth line, each in the first person
    const sample = echoes.filter((_, i) => i % 9 === 0);
    expect(sample.length).toBeGreaterThanOrEqual(11);
    for (const e of sample) expect([e.id, e.codexLine, FIRST_PERSON.test(e.codexLine)]).toEqual([e.id, e.codexLine, true]);
  });

  test('the information the player acts on is kept: a proper noun of the old line still appears, and what was exclusive still says "not in a loop"', () => {
    for (const e of echoes) {
      const old = nouns(U51[e.id] ?? '');
      const now = new Set(nouns(e.codexLine, true));
      if (old.length > 0) expect([e.id, old, old.some((n) => now.has(n))]).toEqual([e.id, old, true]);
      if (/Not in a loop/.test(U51[e.id] ?? '')) expect([e.id, /\bNot (?:in|with)\b[^.]*\bloop\b/.test(e.codexLine)]).toEqual([e.id, true]);
      if (/Not in a loop/.test(U51[e.id] ?? '')) expect((e.exclusiveWith ?? []).length).toBeGreaterThan(0);
    }
  });

  test('the five bonds and the six endings keep their one-line shape but name their own person or ending', () => {
    for (const who of ['nyx', 'ilyra', 'dask', 'mireya', 'caelum']) {
      const e = echoes.find((x) => x.id === `echo_${who}_bond`);
      expect(e?.codexLine.toLowerCase().startsWith(who)).toBe(true);
    }
    const endings = ['a', 'b', 'c', 'd', 'e', 'f'].map((l) => echoes.find((x) => x.id === `echo_ending_${l}`)?.codexLine ?? '');
    expect(new Set(endings.map((l) => l.split(',')[0])).size).toBe(6);
    for (const l of endings) expect(l).toContain('Gallery');
  });
});
