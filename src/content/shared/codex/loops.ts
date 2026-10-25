// Codex II (U61), part 5: the loop (STORY §14.1 rows `codex_loop`, `codex_echoes`, `codex_threshold_shore`; category `loops`;
// all Wayfinder's Notes). Facts are STORY §4.2, §5.1, §10.7, BIBLE §8 and WORLD §3.12. "First Echo gained" has no atom of its
// own, so `codex_echoes` unlocks on any one of the catalog's 103 Echoes (an `any` built from the echoes table, the way U60
// built "any two verse Echoes").
import type { CodexEntryInput } from '@schema/codex';
import type { Condition } from '@schema/condition';
import { echoes } from '../echoes';

/** "First Echo gained": any Echo of the catalog. */
export function anyEcho(): Condition {
  return { any: echoes.map((e) => ({ echo: e.id })) };
}

export const loopsCodex = [
  {
    id: 'codex_loop',
    title: 'On Returning',
    voice: 'wayfinder_notes',
    category: 'loops',
    order: 10,
    unlockWhen: { echo: 'echo_amulet_memory' },
    related: ['codex_item_amulet', 'codex_echoes', 'codex_threshold_shore', 'codex_breach', 'codex_breach_clock', 'codex_ilyra'],
    body: `I came back. I went through the portal with the city screaming behind me, and the stillness broke, and something behind me hadn't finished speaking, and I was in the Ruins at dawn with the Amulet warm at my throat. I didn't pick it up. It was there.

Nobody else came back. Ilyra said the same words at the same fire. Brak had the same ache in the same shoulder and didn't know why. The Crystal was in its alcove. The thirty days were on the clock. Everything I did was undone except what I knew.

What came with me: what I learned. The Amulet. My hands, mostly; the body remembers more than the world does, and I woke stronger than a stranger should be. What didn't: everything I was carrying, everyone I'd persuaded, every door I'd opened, every day I'd spent.

The rule, as far as I have it: the Breach doesn't lead beyond. It leads back. Whatever ends the thirty days, I'm here again at the start, with the same woman looking up from the same fire and seeing a stranger.

I can listen now. The Amulet lets me. Places where something was said still have it in them.

I'm going to count. Somebody should.`,
  },
  {
    id: 'codex_echoes',
    title: 'Echoes',
    voice: 'wayfinder_notes',
    category: 'loops',
    order: 20,
    unlockWhen: anyEcho(),
    related: ['codex_item_amulet', 'codex_loop', 'codex_threshold_shore', 'codex_wayfinder_nature'],
    body: `Something stayed. That's the first thing I knew for certain, and I'm writing it at the top of the page so I don't talk myself out of it.

Here's the shape of it. A thing learned, properly, all the way down, stays learned. Not a thing seen; not a thing carried; a thing *understood*, the kind you could say in one sentence to someone who'd believe you. The Amulet holds it. I feel it settle when it happens, a weight at the throat like a coin dropped in a cup. I've started calling them Echoes, because that's what the Remnants call the whispers in the stones, and the whispers are the same thing in the stones that this is in me.

What persists: Echoes. What I've learned to do with my hands. The Amulet itself. What I've written in this book.

What doesn't: everything in my pack. Every coin. Every friend's trust, which hurts more than the coins. Every quest half-done. The days.

Some of them won't sit together. I learned a thing about the stone one way, and the other way slid out of my head to make room. One at a time, then.

Some open doors. Some are just true. Those are the ones I'd keep if I could only keep one.`,
  },
  {
    id: 'codex_threshold_shore',
    title: 'The Still Shore',
    voice: 'wayfinder_notes',
    category: 'loops',
    order: 30,
    unlockWhen: { echo: 'echo_threshold' },
    related: ['codex_region_threshold', 'codex_loop', 'codex_dask', 'codex_tyrant_holding', 'codex_seven_wayfinders'],
    body: `The first time, I was in the Library, and I was falling, and I was standing on a shore. Those three things in that order, with nothing between them.

The Still Shore. Between loops. I stand here with nothing in my hands, and I'm not hungry and I'm not tired and the clock isn't running, and the water shows me the last thirty days if I stand still enough to watch. It's not a reflection. I'm not in it. The days are.

Dask, when he's come with me, stands at the water's edge and says it's nicer than his.

The figure. Far out on the water, further than the light, a shape holding something up with both hands. It doesn't move. It hasn't moved in all the times I've stood here. I've tried walking toward it, and the water takes me to the light instead. Whatever it's holding up, it's holding it up for someone, and the arms don't tire, and I've started to think the arms can't.

I know what it is. I've known since the second time. I'm not writing it down until I've gone to look at its face.

Then the light, and the morning, and ozone and decay.`,
  },
] satisfies CodexEntryInput[];
