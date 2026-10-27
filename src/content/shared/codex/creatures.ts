// Codex II (U61), part 2: the eight creature families, one entry each (STORY §14.1 rows `codex_creatures_*`; WORLD §5, C-19;
// D-020 voices; every body ≤ 220 words). Each entry gives the family's origin in the Circle or the Sundering, its silhouette,
// what it deals and what it is weak to, what it drops and its one lesson, all from WORLD §5's table, in the voice §14.1
// assigns. Unlocks are §14.1's "Kill or <spare/calm/still/pass> a <creature>" as `killed` atoms over the profile's bestiary
// (`anyLoop`, U34e) plus the Echo that lets the creature be spared where the data has one (the Archivist is calmed by
// `echo_oriel_drowned`'s reader; the golems are stilled by the warder's word, `echo_stone_hide_origin`). Sparing a Shade or a
// Stalker and passing a Mireling have no atom of their own, so the nearest the schema has stands for them (D-108's
// precedent): standing in the Hollow, where the Stalkers are, and entering the Glowfen, past the Glowlands' Mirelings. The
// Unravelled unlock on the Horde witnessed (`echo_horde_path`) or the Apex reached (D-108's "Reach the Apex" reading), or on
// the Day of Teeth told (STORY §12 says that Echo unlocks "codex" and §14.1 gives it no row: the Horde of Year 178 is theirs).
import type { CodexEntryInput } from '@schema/codex';

export const creaturesCodex = [
  {
    id: 'codex_creatures_hollowed',
    title: 'The Hollowed',
    voice: 'weaver_fragment',
    category: 'creatures',
    order: 10,
    unlockWhen: { any: [{ killed: { id: 'cr_corrupted_shade', anyLoop: true } }, { killed: { id: 'cr_void_touched_stalker', anyLoop: true } }, { location: 'loc_voidscar_hollow' }] },
    related: ['codex_maelis_korr', 'codex_nyxaria_vell', 'codex_item_dark_spellbook', 'codex_item_void_shard', 'codex_region_voidscar', 'codex_region_veil'],
    body: `Do not pity them. They were students once and they are paying now, and pity is a coin they cannot take.

Two makers. The Shades are Korr's: the ones who read his workbooks and owed, and are paying the debt down still, in the Corridor and the Library, with a book in their hands. The rest came out of the dark between when she named it. The Stalkers that fray at the edges in the Hollow. The Lanterns that carry a light that is not light. The Mouths in the Orchard that are only a mouth. At the Eye, something in her shape that has waited forty years to be looked at.

Teardrop sigil. Smeared outline. Pieces missing, as if erased.

What they do: curse, weaken, blind. The big hit comes after the Curse lands and never before it. So: clean the Curse and the big hit never comes. Ley lifts it. The Amulet's bolt is Ley, and every hand that wears the Amulet has one. Fire burns a Shade. Nothing plain reaches a wraith.

What they leave: shadow-ash, breach-glass, umbral thread, and Shards. Keep the Shards. Burn the rest.

They are weak to the ley because the ley is what they were before. Do not tell them so. They know.`,
  },
  {
    id: 'codex_creatures_wilds',
    title: 'The Wilds',
    voice: 'ironclad_telling',
    category: 'creatures',
    order: 20,
    unlockWhen: { killed: { id: 'cr_wildling_brute', anyLoop: true } },
    related: ['codex_region_mistwood_reach', 'codex_region_ashen_steppe', 'codex_corvin_dreyl', 'codex_ironclad'],
    body: `You'll have killed a Brute by now, so you know the wind-up. It drops its head and its shoulders go back and there's a whole breath where it's telling you what it's about to do. Guard the heavy. That's the lesson, and it's the only one the Wilds have.

No maker. That's what sets them apart from everything else out there. Nobody made the Wilds. The ley washed over the woods and the plains the night the city broke, and what lived there bent. Prowlers in the Mistwood. Rootlings. Brutes. Harriers on the wind over the Highlands and the Flats. Salt jackals on the Pan. Cinderbacks that run in lanes. And on the Steppe, what the old city's fire burned and branded as it went: every beast on the ash carries the same mark on the flank, and the biggest of them, the Ashmaw, keeps the Herd-Grave and takes the first calf of every spring.

Triangle for the sigil. Four legs or none. Head low.

They bleed you and they slow you. Mistwood kin burn. Ash kin don't; they were born in it. Storm for those. Poison works on all of them, because they're alive, which most of what you'll fight out here isn't.

Hide, rootbone, salt, ember ore, cinder horn. Nothing wasted.`,
  },
  {
    id: 'codex_creatures_drowned',
    title: 'The Drowned',
    voice: 'remnant_archive',
    category: 'creatures',
    order: 30,
    date: 'Year 500 of the Sundering',
    unlockWhen: { any: [{ killed: { id: 'cr_drowned_archivist', anyLoop: true } }, { echo: 'echo_oriel_drowned' }] },
    related: ['codex_ilsabet_rhune', 'codex_oriel_danthe', 'codex_region_drowned_reach', 'codex_place_sunken_archives', 'codex_ilyra'],
    body: `The Drowned: the Archive's name for what stands in the undercity's water and at the Archives' shelves. Hunched, robed, dripping. Circle sigil, cut by a waterline.

Origin, as the Archive has it. On the first night of Year 0 the Warden of Waters, Ilsabet Rhune, opened the cisterns to drown the Conflux's fire, and the water rose through the Archives and never left. The scholars at the shelves did not leave either. The Archive holds that the Drowned are those scholars, still at their work: Archivists reading, Tide Clerks checking names at Tidewell, divers that were divers, a Choir that sings a ledger, Bell-Ringers, and under the bell a Warden in the Warden's own chain of office. The first of them, by the present Keeper's reading, was the Archivist of the Circle, in her carrel, with the record. That entry is in pencil. The Archive does not use pencil for a finding.

Method. They are always soaked. Storm goes through them and jumps; fire does not take. The ley does nothing to them in particular, which is unusual among the Breach-born. Kill the reader first, or it reads the others back up.

A Drowned Archivist can be calmed rather than fought, by one who reads to it. The order has one such reader. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_creatures_wards',
    title: 'Wards',
    voice: 'ironclad_telling',
    category: 'creatures',
    order: 40,
    unlockWhen: { any: [{ killed: { id: 'cr_stone_hide_golem', anyLoop: true } }, { echo: 'echo_stone_hide_origin' }] },
    related: ['codex_haldric_vane', 'codex_place_blighted_outpost', 'codex_tobrin_vask', 'codex_litany_3', 'codex_borin'],
    body: `You'll have broken one by now, or stood one down, so you know the first rule: magic skitters off them. Fire, ley, void, the time-stuff, all of it. Stone and iron don't care. You break the armor, and then you hit it with something plain.

Here's what they are. A mage called Vane, the Warder, built stone men to shrug off the backlash of the thing the Nine were doing, and set them on the ley-knot north of the city with one order. The Outpost was his Watch. When the city broke they turned to face outward and locked on the order, and they've kept it since: *guard*. The pillars with the ring-and-bar on them are his too. They re-arm, so break them twice.

Hexagon sigil. Slate and iron. The ring-and-bar on the chest; on the brow, a square inside a circle, which is a different man's mark and a different telling.

They hit hard and they stun, and they don't tire, and they don't chase past their lanes. Stay out of the lanes.

Slate-core, rivets, heartwood, and a dust that ticks when you hold it to your ear. Borin wants all of it.

Stone standing where flesh would fall. Ours is the same idea with worse materials.`,
  },
  {
    id: 'codex_creatures_spireborn',
    title: 'Spireborn',
    voice: 'weaver_fragment',
    category: 'creatures',
    order: 50,
    unlockWhen: { any: [{ killed: { id: 'cr_aetherial_weaver', anyLoop: true } }, { killed: { id: 'cr_arcane_wisp', anyLoop: true } }, { killed: { id: 'cr_sky_whisper_sentinel', anyLoop: true } }] },
    related: ['codex_seraphine_aulde', 'codex_place_aetherium_spires', 'codex_region_skyreach', 'codex_region_highlands', 'codex_litany_5'],
    body: `Cut the tether before the dive. Kill the loom, not the cord. If you learn nothing else in the basin, learn the order of those two.

Her strands. The one of the Nine who built the Spires kept looms in her eyrie, and the looms spin cords of light and let them go, and the cords drift down to the Spires and spin there, carrying her note. Those are the weavers of the air; do not confuse them with us. The Wisps in the Ruins are the same thread, frayed shorter. The Glass Motes are the Spires' own dust. The Sentinels are her watchers, sky-born, with spotters to mark you for the dive; the first of them has sat on its Perch five hundred years watching the Apex and has learned one thing from it.

Rhombus sigil. Threads of light, vanes, glass.

What they do: shock, slow, mark. Ley does nothing to them; it is what they are made of. Void unspins them. Glass breaks to anything plain. The sky-born lose their speed to the time-stuff. Her note, if you have heard it at the Spires, buys you one pass unharmed.

What they leave: ley-spark, Aetherium, spire-thread, gale feathers, sky-crystal, storm-glass.

She loved one note. These are what loving one note looks like after five hundred years.`,
  },
  {
    id: 'codex_creatures_green',
    title: 'The Green',
    voice: 'wayfinder_notes',
    category: 'creatures',
    order: 60,
    unlockWhen: { any: [{ killed: { id: 'cr_glowfen_mireling', anyLoop: true } }, { region: 'region_glowfen' }] },
    related: ['codex_imre_sallow', 'codex_region_glowfen', 'codex_region_glowlands_nexus', 'codex_mireya', 'codex_place_lanternreed'],
    body: `Take the Regen away first. I wrote that in the mud with a stick after the first one and I'm writing it again here. Void strips it. Fire burns what's left. Ley does nothing; it's what they're full of.

They glow at the throat and the wrists. The same places the fen folk glow. I've stopped pretending I haven't noticed.

What I think they are: the overflow. One of the Nine was a life-mage, and the light under the Glowlands and the fen is hers, leaking. The Mirelings are what it makes of a toad, a drift of spores, a stalker in the reeds, and, given long enough, a person. The barrow-lights are the fen's dead, leaking it back. The Matron in the hall at the end of the Gullet was an elder once. Her name was Sulis.

Circle sigil, lit from inside. Soft, swollen.

Poison won't touch them; they carry it. Blind, poison, regen: that's their whole kit. They hit soft and they don't die, which is the problem. So: Regen first.

I passed one once without fighting. It looked at me the way the child did.`,
  },
  {
    id: 'codex_creatures_watch_wardens',
    title: 'Watch-wardens',
    voice: 'remnant_archive',
    category: 'creatures',
    order: 70,
    date: 'Year 500 of the Sundering',
    unlockWhen: { any: [{ killed: { id: 'cr_shimmering_phantom', anyLoop: true } }, { killed: { id: 'cr_temporal_aberration', anyLoop: true } }] },
    related: ['codex_tovren_masque', 'codex_place_chronos_nexus', 'codex_region_highlands', 'codex_item_chronos_lens', 'codex_creatures_unravelled'],
    body: `Watch-wardens: the Archive's name, after their maker's office, for what keeps the Nexus and flickers in the Pass. Spiral sigil. Doubled outlines; after-images that arrive before the thing that cast them.

Tovren Masque set wardens about his observatory to keep its hours: to open and close it, to turn the orrery, to mark the sky at the proper watches. On the first night of Year 0 the hours broke. The wardens keep them still, all of them, out of order, which the Archive holds to explain most of what visitors to the Nexus report. The Phantoms in the Pass are the same make, strayed down the Road. The Moths, the Crawlers under the dome, the Knights that walk the orrery's rim, and the Leeches, of which the order has two reports and no drawing: all his.

Method. Chrono does nothing to them; it is their element. They slow, they haste, they wind back a wound you gave them, and they strike where you were. What they intend is often hidden. Where a report shows a question in place of the intent, the order's advice is to Guard. Void consumes a rewind; use it after they wind back, not before.

They leave chronal dust and a frayed moment, which the Archive cannot shelve. — *Keeper's hand, Year 500.*`,
  },
  {
    id: 'codex_creatures_unravelled',
    title: 'The Unravelled',
    voice: 'wayfinder_notes',
    category: 'creatures',
    order: 80,
    unlockWhen: { any: [{ echo: 'echo_horde_path' }, { location: 'loc_temporal_breach_apex' }, { echo: 'echo_apex_resonance' }, { echo: 'echo_day_of_teeth' }] }, // + STORY §12: the Day of Teeth's row says "codex"
    related: ['codex_tyrant_naming', 'codex_tyrant_six', 'codex_breach', 'codex_seven_wayfinders', 'codex_tyrant_holding'],
    body: `Ley gives them an order to fall apart in. That's the whole lesson. Chrono does nothing. Void does nothing. The Amulet's bolt does something, and so does anything else that's ley, and I don't know why yet, but I know it works.

What they are. The thing at the Apex, first. And then what spills when the thing at the Apex slips: Husks that walk the ley lines out from the Apex node by node and cost a third of me to cross; a Tide of them in the Corridor; a Reach of it that comes as far as the Spires. And things the Ledger's margins mention that I haven't met: the Unmade in the Scriptorium, and something it calls *redundant*.

Broken circle with a spiral through it. Pieces of every other family in them, flickering, because they were every other family before they were this.

Most of their intents are hidden. Not because they're cunning. Because they have no next moment. There's nothing to telegraph; the move hasn't been decided when it lands. Guard when the intent is a question. Hit ley when it isn't.

They leave a frayed moment and breach-glass. The big one leaves shards of itself, and I'm not sure I should be picking those up.`,
  },
] satisfies CodexEntryInput[];
