// Clean content: prefixed ids, plain ids, nested local ids (quest stages, dialogue nodes) are not checked.
import type { ItemSchema } from '@schema/item';

export const locations = [
  { id: 'loc_whispering_ruins', regionId: 'region_silverwood_ruins', events: [{ id: 'ev_ruins_echo' }] },
  { id: 'cr_ash_wraith' },
] satisfies { id: string }[];

export const classes = [{ id: 'ranger' }, { id: 'ironclad_warden' }];

export const quest = { id: 'q_echo_crystal', stages: [{ id: 'start' }, { id: 'done' }] };

export const unused: ItemSchema | null = null;
