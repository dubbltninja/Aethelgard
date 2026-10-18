// Abilities the consumables unleash (WORLD §7.8; D-078 "throwables work via grantAbility on consumables"; DESIGN §7.9). Each is owned
// by its item (`ownerId`), carried by that item's `grantAbility` passive (items/consumables.ts), and resolves free, as the player's
// own, when the item is used in a fight. No MP, no cooldown, no branch or tier (item abilities have none); the damage a flask does is
// attributed to its `itm_` id in the run summary (D-078). `description` is the play-terms line, `flavor` the item's WORLD line.
//   Throwables   a flat amount (`base` with `coef: 0`: WORLD's "fire 25" is a number, not a scaling) of the row's type, then the
//                row's status at the row's chance and duration: Ember Flask Burn, Storm Jar Shock (both 100%), Lantern Oil Burn,
//                Barrow-Light Vial Blind 50%.
//   Ward Salts   "self or ally: status_shield 20": a Shield of 20 on the party member the player picks (Shield lasts 3 turns).
//   Fenlight     the "status_regen (3)" half of the salve (its 50 HP are the item's `heal`): Regen for 3 turns on the user. WORLD
//                gives the duration but no magnitude; 4 per turn is Barkskin's base (DESIGN §5.4). The U50 reply lists it.
//   Stillwater   "cleanse all negative statuses" — the `cleanse` special (every debuff on the user); the 30 MP are the item's `heal`.
import type { AbilityInput } from '@schema/ability';

export const consumableAbilities = [
  {
    id: 'itm_ember_flask',
    ownerId: 'item_ember_flask',
    name: 'Ember Flask',
    description: 'Throw: 25 Fire damage to one enemy, and it Burns for 2 turns.',
    flavor: "Ember ore ground into resin. Don't hold it long.",
    target: 'enemy',
    damageType: 'fire',
    power: { base: 25, coef: 0, stat: 'atk' },
    statuses: [{ status: 'status_burn', duration: 2 }],
  },
  {
    id: 'itm_storm_jar',
    ownerId: 'item_storm_jar',
    name: 'Storm Jar',
    description: 'Throw: 20 Storm damage to one enemy, and it is Shocked for 2 turns.',
    flavor: 'A sealed jar with a captured spark inside. It ticks against the glass.',
    target: 'enemy',
    damageType: 'storm',
    power: { base: 20, coef: 0, stat: 'atk' },
    statuses: [{ status: 'status_shock', duration: 2 }],
  },
  {
    id: 'itm_lantern_oil',
    ownerId: 'item_lantern_oil',
    name: 'Lantern Oil',
    description: 'Throw: 15 Fire damage to one enemy, and it Burns for 2 turns.',
    flavor: "Lamplighters' oil, rendered from something that lived in the dark. It burns clean.",
    target: 'enemy',
    damageType: 'fire',
    power: { base: 15, coef: 0, stat: 'atk' },
    statuses: [{ status: 'status_burn', duration: 2 }],
  },
  {
    id: 'itm_barrow_light_vial',
    ownerId: 'item_barrow_light_vial',
    name: 'Barrow-Light Vial',
    description: 'Throw: 30 Ley damage to one enemy, and a 50% chance to Blind it for 2 turns.',
    flavor: 'A barrow-light caught in glass. Uncork it at something you dislike.',
    target: 'enemy',
    damageType: 'ley',
    power: { base: 30, coef: 0, stat: 'atk' },
    statuses: [{ status: 'status_blind', chance: 0.5, duration: 2 }],
  },
  {
    id: 'itm_ward_salts',
    ownerId: 'item_ward_salts',
    name: 'Ward Salts',
    description: 'Scatter on yourself or an ally: a Shield of 20 for 3 turns.',
    flavor: 'Steppe salt and shade ash in a twist of paper. Scatter it and the air hardens.',
    target: 'self_or_ally',
    shield: { base: 20, coef: 0, stat: 'sp', turns: 3 },
  },
  {
    id: 'itm_fenlight_salve',
    ownerId: 'item_fenlight_salve',
    name: 'Fenlight Salve',
    description: "Rub in: Regen for 3 turns (4 HP a turn), on top of the salve's own healing.",
    flavor: 'Green salve that glows faintly on the skin. The wound closes from the edges in.',
    target: 'self',
    statuses: [{ status: 'status_regen', duration: 3, target: 'self', power: { base: 4, coef: 0 } }],
  },
  {
    id: 'itm_stillwater_phial',
    ownerId: 'item_stillwater_phial',
    name: 'Stillwater Phial',
    description: "Drink: every negative status on you is cleansed, on top of the phial's own mana.",
    flavor: 'Water from the Breathing Pool, perfectly still even when shaken.',
    target: 'self',
    special: 'cleanse',
  },
] satisfies AbilityInput[];
