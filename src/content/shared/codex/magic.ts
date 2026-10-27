// Codex II (U61), part 3: the rules of the ley (STORY §14.1 rows `codex_breach_clock` and `codex_anchors`; category `magic`):
// the drift between the Heartstone's beat and the Apex's flicker, and what the Conflux keeps. `codex_breach_clock` is STORY
// §14.2's sample text, verbatim, and carries the sample's voice: §14.1's row says RA, §14.2 heads the sample "Wayfinder's
// Notes" and the text is first person ("Counted both for a watch", "I do"), so the sample wins (its voice is the standard;
// an Archive entry cannot say "I"). Facts are STORY §3.2, §9.3 and BIBLE §2, §8.
import type { CodexEntryInput } from '@schema/codex';

export const magicCodex = [
  {
    // STORY §14.2, verbatim
    id: 'codex_breach_clock',
    title: 'The Thirtieth Dawn',
    voice: 'wayfinder_notes',
    category: 'magic',
    order: 10,
    unlockWhen: { echo: 'echo_breach_clock' },
    related: ['codex_breach', 'codex_item_heartstone', 'codex_seven_wayfinders', 'codex_wayfinder_symptom', 'codex_loop', 'codex_item_amulet'],
    body: `Dray's water-clock in the Library. The Heartstone's beat in the Depths. Counted both for a watch. They don't agree, and the disagreement grows by the same amount each day.

Ashcombe worked this out in Year 309 and nobody understood his notes. I do. The beat is Veyran's sentence. The clock is the world. When they're fully out of step the hold breaks, whether or not anybody is standing at the Apex with a sword. Thirty dawns from the day I wake in the Ruins.

Stabilizing the stone buys six. Exploiting it costs five. Breaking it costs ten.

I saw it happen once without touching him. The sky tore east to west and he screamed from the Apex and nobody had done anything. That's the whole case against the Ironclad theory, in one dawn.

Dray's answer to the obvious question, why the world didn't end in 309: it took Ashcombe instead. Took all of them. The hold feeds on a Wayfinder in the shear and steadies for a lifetime. "Thirty, every time. And every time, someone like you was taken before it came." The Amulet keeps me out of its reach. So this is the first time the count runs out.

I don't know yet what buys thirty-one.`,
  },
  {
    id: 'codex_anchors',
    title: 'What the Chamber Keeps',
    voice: 'wayfinder_notes',
    category: 'magic',
    order: 20,
    unlockWhen: { echo: 'echo_anchor_mechanic' },
    related: ['codex_region_silverwood_before', 'codex_place_heartstone_depths', 'codex_caelum', 'codex_durn_hallow', 'codex_loop'],
    body: `I left the Talisman on the cradle's rim. The chamber, Last Bell, the Nine on the stair behind me. I set it on the iron and walked out, and the night tore, and I was back through the door. In the Depths, five hundred years later and the same afternoon, it was lying on the broken rim where I'd put it.

Nothing else I do in the Before stays. The cart goes back. The man goes back to his stall. The Breach replays the three days, and I'm the only thing in the replay that isn't replayed.

Except the chamber. The chamber is where the Breach *is*, at every instant at once. A thing set down there is set down in every instant, so it's still there when the present arrives. The Remnants will find it and not know why.

Limits. Only what the chamber will take: the Talisman took; the page Oriel gives will take; the second pin Hallow forged and never fitted will take, Caelum says. Coin doesn't. A sword doesn't. And it lasts the loop and no longer: the past is remade when I come round again, and so is whatever I left in it. What stays is that it can be done.

Something could be set in that cradle that matters. I'm thinking about what.`,
  },
] satisfies CodexEntryInput[];
