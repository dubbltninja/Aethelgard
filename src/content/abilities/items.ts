// Item-granted abilities (DESIGN §5.7 "the Amulet's Echo Bolt", D-047, D-066 #2, D-067.19, D-085).
// While the Wayfinder carries the Amulet of Echoes (src/content/items/quest.ts, `grantAbility: itm_echo_bolt`), every class
// has one extra ability tile. It costs no AP and is part of no tree, hence no branch, tier or kind; its owner is the granting
// item (validator rule 13 checks the pair). It is the every-class answer to the Tyrant's Rewind: Ley breaks a Rewind
// (interplay row 9). The Wizard's `wiz_echo_bolt` is the real spell and strictly better for a Wizard.
//   description  what it does, in play terms;   flavor  DESIGN's description line, word for word.
// Damage is the larger of 0.75·ATK and 4 + 0.8·SP (`power.maxOf`, D-067.19: the staff cantrip's formula, so a Warden's maul
// is not a worse caster), on a 1-turn cooldown (D-067.19; DESIGN §5.7's old "—" is corrected, D-085).
import type { AbilityInput } from '@schema/ability';

export const itemAbilities = [
  {
    id: 'itm_echo_bolt',
    ownerId: 'item_amulet_of_echoes',
    name: 'Echo Bolt (Amulet)',
    description: 'Ley damage to one enemy: the larger of 0.75·ATK and 4 + 0.8·SP. Ley breaks a Rewind and lifts a Curse. Usable every other turn.',
    flavor: 'The Amulet remembers the first spell you ever saw.',
    mp: 10,
    target: 'enemy',
    damageType: 'ley',
    power: { coef: 0.75, stat: 'atk', maxOf: { base: 4, coef: 0.8, stat: 'sp' } },
    cooldown: 1,
  },
] satisfies AbilityInput[];
