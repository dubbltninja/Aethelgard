// The Amulet of Echoes (DESIGN §7.7 row, WORLD §7 `item_amulet_of_echoes`; D-047, D-066 #2): a quest item (bound: not
// sellable, not droppable), slotless, with a passive +1 MAG (the legacy "magic 1") and `grantAbility: itm_echo_bolt` (the pair
// validator rule 13 checks). Picked up on Day 1 of Loop 1 and already on the neck from Loop 2 (`config.startItems`); the one
// thing the loop reset spares (D-047). The engine finds it by id (AMULET_ITEM_ID); *Listen* is the dialogue unit's.
//
// HANDOVER: the item unit that authors the quest items (WORLD §7) moves this record to its home file and deletes it here.
// `sources` names the Whispering Ruins (WORLD's "Day 1, every loop"; placed in regions/silverwood_ruins/locations.ts, U42,
// D-089).
import type { ItemInput } from '@schema/item';

export const amuletItems = [
  {
    id: 'item_amulet_of_echoes',
    name: 'Amulet of Echoes',
    legacyName: 'Amulet of Echoes',
    description: 'A faintly glowing amulet tied to the Great Sundering. Enhances magical affinity.',
    type: 'quest',
    tier: 0,
    stats: { magic: 1 },
    passives: [{ kind: 'grantAbility', abilityId: 'itm_echo_bolt' }],
    sources: ['loc:loc_whispering_ruins'],
    value: 60,
    art: { icon: 'amulet', major: true },
  },
] satisfies ItemInput[];
