// The three factions (DESIGN §11, BIBLE §6.3, STORY §2.7 and §3.4; PLAN §5.15; D-014). A faction record is the text and the
// chip colour: the tier boundaries (−40 / −10 / 20 / 60) and the price multipliers are `GameConfig` (shared/config.ts), the
// start values from Echoes are engine tables (engine/echoes.ts), the deltas are quest and event effects.
//
// `name` and `shortName` are BIBLE §6.3's ("Remnants of Aethelgard" / "the Remnants", "Shadow Weavers" / "the Weavers",
// "Ironclad Nomads" / "the Ironclad"; the ids are `remnants`, `weavers`, `ironclad`, never `shadow_weavers`). `description`
// follows STORY §2.7. The five `tierTexts` of each faction are one line apiece in the faction's own cadence (STORY §15):
// what the tier looks like at their door, set against DESIGN §11.4 (Hostile refuses to trade and guards attack on sight;
// Wary is curt; Neutral is the plain stranger; Trusted is shown the inside; Sworn is confided in). The Remnants' five lines are
// the ones the DESIGN examples already carried (tests/unit/content/examples.ts); the other ten are new.
import type { FactionInput } from '@schema/faction';

export const factions = [
  {
    id: 'remnants',
    name: 'Remnants of Aethelgard',
    shortName: 'Remnants',
    description:
      "Scribes and keepers who have kept the Ledger of Wayfinders for five hundred years. They took Oriel Danthe's seal and began the count of years, and believe that understanding the past heals the present.",
    color: '#c9a227',
    tierTexts: {
      hostile: 'The Keepers close the Ledger when you enter.',
      wary: 'They answer in single sentences.',
      neutral: 'You are a stranger with a good pen.',
      trusted: 'They show you the margins.',
      sworn: 'They have ruled a line for you.',
    },
  },
  {
    id: 'weavers',
    name: 'Shadow Weavers',
    shortName: 'Weavers',
    description:
      "The descendants of Silverwood's lesser mages, who went down into the Voidscar because the void was thin enough to touch. They sing the Hollow Choir in the Veil and believe the Breach is an opportunity.",
    color: '#6b3fa0',
    tierTexts: {
      hostile: 'The Choir turns its masks toward you and does not sing.',
      wary: 'They keep their hands inside their sleeves.',
      neutral: 'You may listen from the edge of the Choir.',
      trusted: 'They show you the hand-sign and stop looking away.',
      sworn: 'The Choir keeps a place in its cadence for your voice.',
    },
  },
  {
    id: 'ironclad',
    name: 'Ironclad Nomads',
    shortName: 'Ironclad',
    description:
      "The city guard and Hallow's forge-hands, who carried the ember north and have never let it go out. They take the oath, give back their family names, and believe the Tyrant is a monster to be killed properly.",
    color: '#8a8f98',
    tierTexts: {
      hostile: 'Steel comes out when you step into the firelight.',
      wary: 'They count your steps and not your words.',
      neutral: 'You may sit at the fire if you split the wood.',
      trusted: 'They give you a place at the Ring and your own cup.',
      sworn: 'Hadda says the oath-words to you, and means them.',
    },
  },
] satisfies FactionInput[];
