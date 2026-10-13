# REVIEW-STORY-WORLD: combined adversarial review of STORY.md + WORLD.md (U7)

Scope per `docs/briefs/review-story-world.md`: Blocker and Major only. Not re-reported: D-001..D-066, REVIEW-CROSS
C-01..C-58, REGISTRY-DRAFT renames. A settled ruling that creates a new problem is in scope and is marked. Read at
`fbdb6a5`. DESIGN numbers come from that commit, because DESIGN is being edited in parallel.

## Summary

**19 findings: 1 Blocker, 18 Major.** Endings: all six reachable, none circular, but Loop 1 can soft-lock at the Apex
(#1), D hides a Before + Skyreach dependency (#2), B's last loop is unordered (#3), talk endings are an HP check (#4).
Lore holds at the top (the Nine, Litany, Nyx's 40 and Dask's 70 years, the Tyrant's Loop-1 silence, Oriel) and breaks
in detail: the thirtieth dawn vs earlier Wayfinders, the Tyrant's will, Nyx, the Conflux, Caelum (#8–#12). Fun:
levels reset to 1 against bands 13–18, so Loop 2 is a re-grind and Loop 3+ cannot be brisk and winnable (#5); Dask
tells the twist ten minutes into Loop 2 (#15). Balance: fodder on target; bosses run 40–50% long for physical classes
(#19); the Weaver has no non-Void damage (#17); the Before is a free farm and Anchors carry items across loops (#13–14).

## Findings

### 1. Loop 1 can soft-lock at the Apex through the autosave
- **Severity:** Blocker
- **Where:**
  - WORLD §10.5: `loc_temporal_breach_apex` "boss | Loop 1, always | none in Loop 1".
  - DESIGN §14.2: "Autosave writes after every location change".
  - DESIGN §4.7: "Death — Loop 1 … Load autosave / Load slot / Title".
  - D-066 1: the Tyrant is tuned for level 11.
  - WORLD §10.6: six pacifist-completable quests open the Apex.
- **Problem:** Entering the Apex in Loop 1 writes the autosave at the Apex, in front of a boss that can't be fled.
  - A player who arrives under-levelled dies and reloads into the same fight. The only ways out are a manual save or a
    full restart. Six pacifist quests or a speedrun can bring a player here at level 7–9.
  - The Loop 1 Horde has the same trap. An autosave on an infected node, with ⅓ HP left and infected neighbours, is a
    death loop.
- **Proposed fix:**
  - On entering the Apex in Loop 1, play the legacy lines, then offer *Face it* / *Not yet*. *Not yet* returns the
    player to the Nexus at no watch cost.
  - In Loop 1, never write the autosave on arrival at the Apex or during a Horde. While a Horde runs, the autosave
    stays at the state of the Horde's first move.
  - FALLEN's "Load autosave" then always lands at the Nexus camp or at the start of the Horde.

### 2. Ending D quietly needs Silverwood Before and the Skyreach in one loop
- **Severity:** Major. A settled ruling creates this: D-066 10 / C-04 adopted `echo_anchor_schema` ("read both
  schematic halves in one loop").
- **Where:**
  - STORY §6.2: "D … The anchor needs `echo_iron_that_does_not_wish` (Hallow's Cairn) and the Emberforge … Loop 2 or 3".
  - WORLD §7.12: half A is at `loc_aldours_eyrie`. Half B is at `loc_conflux_chamber` "(Before Day 3 … after or
    bypassing `cr_unbroken_warden`)"; that boss is level 18.
  - The recipe needs `mat_silverwood_heartwood`. Its sources are Before gathering, the Ninefold Knight and the
    Unbroken Warden.
  - WORLD §10.9's D route has no Skyreach and no Before.
  - STORY §10.4: "Brak at the player's shoulder", but §7.2 outcome A leaves him at the Ring of Wagons.
- **Problem:** D is the Ironclad "end magic" ending, yet it runs through the Nine's past.
  - In one loop it needs the Skyreach (the Thin-air gate and a 100% elite at the Eyrie).
  - The same loop needs Last Bell in the Before: a level-18 boss, or the ward seal with Caelum in the party.
  - It also needs heartwood from the Before.
  - STORY's D chain mentions none of this.
  - "Brak alive" is satisfied when he stays at Hearthring, which leaves the final scene without him.
  - §6.2 says D needs `echo_brak_death`. It doesn't: D runs no Horde (D-060).
- **Proposed fix:**
  - Split the Echo. `echo_anchor_half_a` and `echo_anchor_half_b` each persist on their own. Holding both, from any
    loops, grants `echo_anchor_schema`.
  - Half B also gets a present-day source: Tobrin's failsafe copy under Vane's Watch, read at `ev_outpost_seal`
    (`loc_blighted_outpost`, Loop 2+).
  - Heartwood also drops from `cr_stone_hide_golem` (25%) and is sold by Kaelen from Loop 2.
  - D requires `{companion:"brak",state:"active"}`.
  - Remove the `echo_brak_death` line from STORY §6.2.
  - The Tyrant's end in D never fires `ws_brak_at_apex`.

### 3. Ending B's last loop: no fixed order, and a role nobody fills
- **Severity:** Major
- **Where:**
  - STORY §7.1: "the Mending needs her to anchor the present end *without* tearing".
  - §7.4: Dask "becomes your anchor for the Mending's present end (needed only if Ilyra swore not to tear)".
  - §10.2: neither the requirements nor the scene use a present-end anchor ("The player drives the Breach-anchor").
  - §8.3: consent needs "Caelum placed the cradle-pin". §7.6: "the Conflux anchor must be placed by the player".
  - `q_his_masters_sin`: "without a second test" (the test is never defined).
  - WORLD §10.9: the B route runs "EF (forge) → CN ⟂ Before", but the heartwood comes from the Before.
  - WORLD §6.8: *Offer* `item_breach_anchor` gives +2. D-054 checks the anchor "in hand".
- **Problem:**
  - Three sections say B needs Ilyra or Dask at the present end. The requirement block and the final scene never use
    it.
  - §7.4's condition is backwards: an Ilyra who swore not to tear *is* that anchor.
  - The present end would need one companion at the Apex. `q_his_masters_sin` needs Caelum in the same communion.
    Only one companion can be active.
  - WORLD's route forges the anchor before the player can have the heartwood.
  - Offering the anchor may use up the item that B then checks for.
- **Proposed fix:**
  - The present end is the anchor the player drives into the Apex.
  - Ilyra's oath and Dask's choice to stay become scene variants (who stands beside you), not requirements. Delete
    "needed only if…".
  - Drop the "second test". If Caelum can't forgive, B still works and the final scene is colder.
  - *Offer* never uses up items.
  - Route order in WORLD §10.9: Before (pin, heartwood, half B), then the Emberforge, then the Apex.
  - Ilyra's "never again" oath disables `echo_portal_tear` for that loop.

### 4. Every talk ending is a hidden HP check
- **Severity:** Major
- **Where:**
  - WORLD §6.8: `tyr_hour_presses` "0.6× SP you × (1 − Resolve/16)", with SP 36.
  - Each *Listen* makes the next intent "a full-strength `tyr_time_lash`" (1.3× SP).
  - The Apex can't be rested in.
  - WORLD §10.9: A reaches "the Apex D4 Day" and B "D8 Day".
  - STORY §11.6: A, B and F are "Bots: all. Pacifist."
- **Problem:** Communion alternates questions with Presses.
  - About nine Presses at ~15 each come to ≈120 damage.
  - Using *Listen* once per Movement adds three lashes of ~45, for ≈255.
  - A focused Loop 3+ player who reaches the Apex on Day 4 or Day 8 is level 3–7, with 110–190 HP. They die
    mid-communion and lose the loop.
  - Endings A, F and B are therefore gated by level, which neither the routes nor the bot claims expect.
- **Proposed fix:**
  - `tyr_hour_presses` deals 8% of the player's max HP × (1 − Resolve/8). It can't take HP below 1 while
    Resolve ≥ 3.
  - *Listen*'s cost becomes: "the next Press is not reduced by Resolve".
  - Communion stays tense at every level without becoming a gear check.

### 5. Levels reset to 1, but the reveal and the late endings sit in bands 13–18
- **Severity:** Major. Settled rulings create this: D-011 resets levels, and D-049 / D-066 7 skip the Threshold
  between Loop 1 and Loop 2.
- **Where:**
  - DESIGN §6.1: "focused Loop 3+ … reaches level 15–17".
  - DESIGN §19 #10: "Loop 3+ focused 20–30 min (120–220 actions)".
  - WORLD §10.9: the routes reach the Apex between Day 4 and Day 11.
  - `q_weavers_dawn` "fight through the hold's failing (two waves)" has no encounter data in WORLD.
  - `q_iron_silence`: "fight the Tyrant to Phase 2".
  - The Before is band 13–17, with forced fights on Day 3. The Highlands, on the road to Dask, are band 6–10.
- **Problem:**
  - Loop 2 opens as a level-1 replay of Loop 1's first hour. Skipping the Threshold also means no Attunements.
  - A player who rushes east to find Dask or the Tyrant meets band 6–13 fights at levels 1–4. Dying there loses the
    loop.
  - A short Loop 3+ reaches the end at level 5–9. At that level C's waves, D's fight option and the Before's Day 3 are
    unwinnable.
  - Reaching level 15 takes more fights than all of Loop 1. DESIGN's two targets can't both hold.
- **Proposed fix:**
  - Each new loop, Loop 2 included, starts at ⌊0.6 × the best level reached in any earlier loop⌋, capped at 10 ("your
    hands remember").
  - WORLD defines C's two waves: Horde Husk ×2, then ×3, level 12.
  - Keep the talk branch in D.
  - Withdraw DESIGN §6.1's "15–17".

### 6. `q_seven_marks` straddles a loop reset
- **Severity:** Major
- **Where:**
  - STORY §11.4: "Giver: Dask at the Threshold or the High Mark. Prereq: `echo_threshold` … 2. Find the marks in the
    Gallery of Loops … 3. At the High Mark".
  - D-011: quests reset.
  - WORLD §3.12: the Threshold is "reached only by a loop ending".
- **Problem:** Stage 2 can only happen between loops, and stage 3 only inside one.
  - If the quest starts at the Threshold, it resets at the Far Light before stage 3.
  - If it starts at the High Mark, stage 2 needs the loop to end first.
  - So it can never complete. Its 10 Resonance and seven codex entries are lost. `echo_seven_wayfinders` survives only
    because Keeper Dray's Ledger also grants it.
- **Proposed fix:** Either quests started at the Threshold belong to the profile and survive the Far Light, or stage 2
  becomes "Dask names the seven at the High Mark", with the Gallery frames as flavour.

### 7. No way to end a loop on purpose, and ending E finishes with rest-spam
- **Severity:** Major. A settled ruling creates this: D-066 7 removed STORY's `portal` reason for `closer_fall`.
- **Where:**
  - WORLD `g_library_portal`: from Loop 2 it needs Remnants ≥ 20 and `echo_portal_tear`, which comes after
    `q_the_keepers_price`.
  - STORY §6.1: Loop 2 ends by "closer_fall (expiry or death)".
  - WORLD §10.9: "E … 24 rests … the goal is a date".
- **Problem:** Take a Loop 2 player on STORY's suggested five-loop path to the true ending (Remnants −25) who has
  learned what they came for. They have three ways out:
  - kill the Tyrant, which they now know is wrong;
  - die on purpose;
  - rest about 20 times to reach Day 30, then run the Horde.

  Ending E's last stage is the same: about 20 rests at the Depths. Both are dead stretches at moments when the player
  most wants to act.
- **Proposed fix:**
  - From Loop 2, the Amulet offers *Let go* at any camp. It closes the loop as `closer_fall` with reason `released`,
    and no Resonance bonus.
  - Once every other requirement for E is met, Ilyra offers *Keep the vigil* at the Depths. It advances to the last
    dawn in one scene.

### 8. Why the thirtieth dawn never ended the world for earlier Wayfinders
- **Severity:** Major
- **Where:**
  - STORY §3.2: "When they fall fully out of phase, the hold breaks … By Pell Ashcombe's count … the thirtieth dawn".
  - STORY §2.8: Ashcombe, Year 309, "First to count the days. His notes name 'the thirtieth dawn.' Died at the Apex of
    the shear".
  - WORLD `npc_ansel_dray`: "Ashcombe counted to thirty".
  - D-005 and D-007.
- **Problem:** If the hold breaks thirty dawns after a Wayfinder arrives, the world should have ended in Year 309,
  when Ashcombe counted it. The same goes for every earlier Wayfinder. Nothing explains why it didn't, or what is
  different in Year 500. This is the setting's central cause-and-effect, and keeping that count is Keeper Dray's whole
  job.
- **Proposed fix:** Add one canon paragraph to STORY §2.8 and §3.2 and to the codex.
  - The shear at the Apex took every earlier Wayfinder, either at once or within the year (Rook). The Holding drew on
    their ley-sense, and that steadied the drift for another generation ("the fever breaks by burning the body").
  - Corwen wounded the Tyrant instead of being taken, which is why it slipped on the Day of Teeth.
  - The Amulet shields this Wayfinder from the shear, so the Holding can't feed and the drift runs out. The Amulet that
    saves you is why the world now ends on time.
  - Dray's line: "Thirty, every time. And every time, someone like you was taken before it came."

### 9. Does the Tyrant choose to strike? The texts disagree
- **Severity:** Major
- **Where:**
  - STORY §2.8: Dask "would not kill it. Tried to speak to it. A chrono-strike scattered him".
  - `scene_dask_introduction`: "I worked that out a second before it worked out I'd worked it out".
  - §8.1: "seven Wayfinders die, four of them trying to kill him". The §2.8 Ledger shows two: Sael and Corwen.
    Ysolde tried to take its power; Hesper, Pell, Rook and Dask did not fight.
  - §8.5: "the fifth to come for me with a blade".
  - WORLD §2.11: Stormcrown "knows the Tyrant does not attack". Yet the Loop 1 Tyrant attacks as soon as you arrive.
  - STORY §2.5: "until now nothing that crossed it survived". Nyx did.
- **Problem:**
  - If Veyran strikes on purpose, he destroyed the one Wayfinder who came to talk. That guts §8.1's "he wants to stop"
    and Dask's whole arc.
  - If he can't strike, Loop 1's fight and Sael's death make no sense.
  - The counts don't match the Ledger.
- **Proposed fix:**
  - Canon rule: the strikes are the Holding's reflex against anything that comes within reach of the tear, not
    Veyran's will. In Phase 1 he "braces" because he is resisting it.
  - From Loop 2 he can hold the reflex back from someone who has crossed, which is why he never attacks first.
  - Text changes:
    - Dask: "…a second before the hold noticed me".
    - Stormcrown: "it does not strike what keeps its distance".
    - §8.1: "two of them trying to kill him, one trying to take him".
    - §8.5: "the third".
    - §2.5: "nothing that crossed it ever came to the Apex".

### 10. Nyx: where she landed, how she knows "thirty", why she lets Loop 1 happen
- **Severity:** Major
- **Where:**
  - STORY §2.5: "arrived in the Voidscar Hollow". `scene_nyx_unmasking`: "I landed in the Hollow".
  - WORLD §2.9 and `loc_where_she_fell`: "a crater of starlight where Nyxaria Vell struck the present", in the Veil.
  - STORY §3.2: "Nyx knows exactly what the thirtieth dawn is".
  - `scene_clock_expiry`: Nyx says "Thirty. He always said it would be thirty."
  - STORY §4.1 beat 8: in Loop 1 she sends the Wayfinder east without a warning.
  - STORY §10.3: ending C needs a living Tyrant and the Heartstone Core.
- **Problem:**
  - The two documents give her two landing sites.
  - "He always said thirty" can't be right: none of the Nine could know a count Ashcombe made in Year 309.
  - She knows that killing Veyran ends her plan to go back, yet in Loop 1 she says nothing while a Wayfinder walks
    east to kill him.
  - Players will ask why C needs him alive and the Core, when killing him "opens the Breach fully" anyway.
- **Proposed fix:**
  - She came down at Where She Fell and crawled to the Hollow. Unmasking line: "I came down in the Veil and crawled
    to the Hollow".
  - "Thirty" comes from Ashcombe's notes, which the Weavers bought from a Remnant diver: "Thirty. Ashcombe counted
    thirty."
  - New one-line hook in Loop 1, after the shards are given: "When you reach the Apex, do not be quick. A dead door
    is a wall."
  - `q_what_she_would_undo` states the rule: the door to the past exists only while he holds it. The Core pries it
    open; killing him slams it shut.

### 11. What is in the Conflux, and STORY's Before scenes have no place on the map
- **Severity:** Major
- **Where:**
  - STORY's Conflux holds the Heartstone:
    - §9.1: "the Conflux chamber (the Heartstone whole in Hallow's iron cradle)".
    - `scene_anchor_in_the_conflux`: "The Heartstone is whole … in Hallow's iron".
    - §9.4 attempt 4: "Break the cradle".
  - WORLD's Conflux is empty:
    - §3.11: "a well of light with no stone in it yet. An altar."
    - `ev_conflux_well`: "The well has no stone in it".
  - Places STORY uses that WORLD's ten Before nodes lack (WORLD §11.5 maps none of them):
    - §9.1: "Veyran's study … Hallow's Forge, the Spire Yard";
    - §9.4: "Masque, from the roof";
    - §9.5: verse 9 comes from "Veyran's study draft";
    - `q_the_apprentices_errand`: "Spire Yard".
  - WORLD `ev_garret_litany` grants verse 2 for "'Hold the moment as a hand holds water'". STORY §2.3's verse 2 is
    "What is read is owed…".
- **Problem:**
  - In STORY the Heartstone already exists and the ritual cracks it. In WORLD the ritual creates it.
  - B's pin is set "on the cradle's rim", but WORLD has no cradle.
  - Three quest beats have no node or event: verse 5 at the Spire Yard, verse 9 in Veyran's study, and
    `echo_ritual_inevitable` from Masque's roof.
  - The Garret line isn't in the Litany.
- **Proposed fix:**
  - STORY wins (D-062): the whole Heartstone sits in Hallow's iron cradle, and the Anchor slot is "the cradle's rim".
    Rewrite WORLD's altar text and `ev_conflux_well`.
  - Map STORY's places to events:
    - Spire Yard: the east terrace of `loc_plaza_of_bells`.
    - Veyran's study: `loc_ninefold_hall`, new event `ev_hall_study_draft` on Days 2–3.
    - Masque's roof: the `loc_ninefold_hall` dome, new event `ev_hall_masque_roof` on Day 3.
    - Hallow's Forge: his field-forge in the Conflux (already in `npc_durn_hallow`).
  - The Garret line becomes "What is read is owed."

### 12. Caelum's message, how he becomes unanchored, and when he joins
- **Severity:** Major
- **Where:**
  - STORY §2.4: "sent up the stair with a message for the Spire Yard; he is on the third step when the first verse
    begins".
  - STORY §9.6: "the Breach's first breath … touched him". The seam only opens at verses 8–9.
  - `q_the_apprentices_errand`: "Cross the Plaza on Day −1 at dusk … Aulde reads it". At that hour Aulde is in the
    chamber speaking verse 5.
  - `scene_caelum_crossing`: "Nobody *ever* delivered it".
  - §7.6: he is recruited "after `q_a_boy_from_a_doomed_city`"; §9.6: "He cannot go back".
  - WORLD `g_hall_doors` and the Day-3 Conflux bypass require `{companion:"caelum",state:"active"}`.
  - The pin scene has Caelum with you before he crosses.
- **Problem:**
  - Aulde can't read a message at the Spire Yard while she stands in the Conflux.
  - If the errand delivers the message, the crossing line is false.
  - If Caelum is walking the Plaza at dusk, he isn't on the stair to be unanchored.
  - WORLD needs Caelum in the party inside the Before, but STORY only recruits him as he leaves it. In STORY's order
    the pin scene and the Day-3 bypass can't happen.
- **Proposed fix:**
  - The errand runs at noon on Day −1. Aulde reads it at the Yard before she goes down at the ninth bell, and laughs:
    *begin at the ninth bell*.
  - Veyran sends a second message at dusk. That is the one Caelum carries up the stair and never delivers.
  - The seam's first breath (verse 8) touches him on the stair in every cycle.
  - Caelum joins as a companion inside the Before after the errand. Outcome A of `q_a_boy_from_a_doomed_city` makes
    him a present-day companion as he crosses.
  - The pin must be set before he crosses.

### 13. Anchors persist across loops, so anchored items are free forever
- **Severity:** Major
- **Where:**
  - WORLD §3.1 Heartstone Depths: "any item placed on the Conflux altar … appears here on the ninth plinth, every loop
    thereafter".
  - §12.1 `ws_before_day_3`: "altar items become Anchors (permanent)".
  - §7.10 `item_caelums_anchor_token`: "lies in loc_heartstone_depths every loop".
  - D-011: inventory resets, and Attunements are "a convenience, not a power creep".
  - STORY §9.3: "Nothing the player changes in the Before survives the reset".
- **Problem:**
  - Anchor any item once and it waits at the Depths on Day 1 of every later loop. That includes a T5 weapon, the
    Unlidded Eye, and the Sky-Whisper Talisman, which becomes a permanent key to the Skyreach.
  - This gets around the reset more than all the Attunements together.
  - It also makes `cradle_pin_anchored` permanent after one placement, while STORY's Mending stage expects it every
    loop.
- **Proposed fix:**
  - Anchors last for the current loop only. The Before replays each loop, so the past is remade each time.
  - Only items tagged `anchorable` can be placed: the Sky-Whisper Talisman (the discovery), the Cradle-Pin, and
    `item_litany_page_3`.
  - `echo_anchor_mechanic` is what persists.

### 14. Silverwood Before is a free, clockless farm that refills on every visit
- **Severity:** Major. Settled rulings create this: D-066 9 (Breach Clock frozen inside, and the Before's day counter
  restarts on every entry) together with REVIEW-DESIGN-PLAN #10 ("Before-local flags, items and enemies reset").
- **Where:**
  - WORLD §1: "Portal edges cost no watches".
  - WORLD §3.11 pick-ups, which come back on every visit:
    - `item_oriels_quill` (T4, worth 300 g);
    - `item_bell_shard` (100%);
    - honeycakes ×3, Mana Bloom ×2, Chronal Dust ×3, Remnant Ink ×2.
  - A full rest at the Garret.
  - XP: Ninefold Knight 738, Unbroken Warden 1,100, adepts and hounds 327–367.
- **Problem:**
  - Going Nexus → Before → Nexus costs nothing, and everything refills each time.
  - From Loop 2 a player can farm unlimited XP, healing items and gold with no clock cost. Oriel's Quill alone sells
    to Kaelen for 225 g per trip.
  - This flattens every level band and the economy (§19 #14), and the Breach Clock stops mattering in any loop where
    the player holds the Lens.
- **Proposed fix:**
  - Each return through a Before door advances the Breach Clock by 1 day ("the door takes a dawn").
  - Creatures and pick-ups in the Before give XP and loot once per loop, not once per visit. The Nine still act; the
    loot doesn't come back.

### 15. The reveal is told, not discovered
- **Severity:** Major
- **Where:**
  - STORY §5.3: Dask "says the thing no one else can: *the Tyrant is holding it shut*".
  - `scene_dask_introduction`: "It *is* the door … Someone could take his place", and it grants
    `echo_tyrant_jailer`.
  - STORY §5.5: "the game provides five" sources.
  - WORLD §2.4: "Loop 2+: Dask is visible from the first visit". With `echo_heartstone_path` the Pass is 3 watches
    from Day 1.
- **Problem:**
  - Loop 2's first walk east ends with an NPC stating the twist and its fix (ending A), and granting the Echo, about
    ten minutes after waking.
  - The Tyrant's first words, the Crystal's ninth voice and Nyx's reading then only repeat it. The player discovers
    nothing.
- **Proposed fix:**
  - Dask's first scene keeps only "Don't kill it. It knows my name." and the offer to recruit him.
  - His full sentence moves to the end of `q_the_flickering_man`.
  - `echo_tyrant_jailer` is granted once the player holds any two of these:
    - Dask's full sentence;
    - `echo_tyrant_speaks`;
    - `echo_ninth_verse_unfinished`;
    - Nyx reading the scroll;
    - `echo_thirtieth_dawn` together with Dray's Ledger.

### 16. Loop 1 opens three times the legacy game
- **Severity:** Major
- **Where:**
  - STORY §11.1 marks eleven non-legacy quests `1+`. Among them: `q_hollow_choir`, `q_bone_road`,
    `q_lightless_stair`, `q_the_drowned_lantern`, `q_the_scouts_oath`, `q_tears_of_the_breach`,
    `q_what_the_light_takes`.
  - WORLD §3.13: all five new regions (38 locations) can be reached in Loop 1.
  - WORLD §10.8: route T1, with only three side trips, already takes 67 moves and 94 watches and closes on Day 24.
  - DESIGN §19 #10: Loop 1 lasts 60–90 minutes. DESIGN P2: "Loop 1 is the original game".
- **Problem:**
  - T1 is already the 90-minute ceiling with just three side trips.
  - A thorough first-time player meets 38 extra locations and a dozen arcs before the twist, so the reveal lands after
    2–3 hours.
  - The new regions' first-time rewards (discovery XP, first codex entries, set pieces) are used up before the game
    explains why they matter.
- **Proposed fix:**
  - Keep four non-legacy quests in Loop 1: `q_blood_and_salt`, `q_bell_vault`, `q_lantern_in_the_reeds`,
    `q_high_mark`. The rest become `{loop:{min:2}}`.
  - The new regions stay walkable in Loop 1, because the pacifist routes need them. In Loop 1 their quest-givers say
    "Come back when you've seen more."
  - Loop 2 then visibly opens up.

### 17. The Shadow Weaver has no answer to its own faction's regions
- **Severity:** Major
- **Where:**
  - DESIGN §5.6: every damaging `wvr_*` ability and the `void_focus` basic attack deal Void.
  - DESIGN §5.6 also says "against Void-resistant creatures … the Weaver must switch branches", yet all three
    branches are Void.
  - WORLD §5: the Hollowed "resist void"; the Unravelled resist "chrono, void".
  - `cr_vells_umbra`: "immune void … status immune: poison, blind, curse".
  - Encounter pools: 100% Stalkers in the Voidscar, 75% Lanterns and Mouths in the Veil.
- **Problem:**
  - The Weaver deals half damage in the Voidscar and the Veil, against both Tyrants and against the Horde.
  - It deals nothing to Vell's Umbra, the Veil's regional boss. The Umbra's curse immunity also shuts down the Hex
    branch.
  - Its only fallback is `itm_echo_bolt`.
  - §19 #1 and #16 fail for this class exactly where the story sends it first.
- **Proposed fix:**
  - New Weaver passive: "Your Void treats *resist void* as neutral against Cursed targets." The Tyrants can be Cursed.
  - `wvr_unravel` deals Chrono.
  - Vell's Umbra: immune void → resist void; drop its curse immunity; physical becomes neutral (see #19).

### 18. `itm_echo_bolt` is every class's best attack against a third of the bestiary
- **Severity:** Major. A settled ruling creates this: D-066 2, "max(0.9·ATK, 4 + 0.8·SP)".
- **Where:**
  - WORLD §5: the Hollowed, the Drowned (except the Lamprey) and the Unravelled are all "weak ley". That is about 19
    of 57 creatures, including both Tyrants and the Horde.
  - Weak-ley share of encounter rolls: 45% in the Ruins, 100% in the Voidscar, 65% in the Drowned Reach, 75% in the
    Veil.
  - DESIGN §19 #2: no ability above 35% of a class's damage.
  - DESIGN §19 #16: no damage type best in more than 35% of fodder encounters.
- **Problem:**
  - Against weak-ley targets the bolt hits for 0.9 × 1.5 = 1.35·ATK, reduced by ward. A basic attack hits for
    1.0·ATK, reduced by armor.
  - That makes it the strongest repeatable button for Ranger, Elf and Warden in four of twelve bands and in both
    finales. The legacy Echo Bolt problem comes back through the Amulet.
  - Ley becomes the best type in at least 45% of fodder encounters in those bands.
- **Proposed fix:**
  - `itm_echo_bolt` = max(0.75·ATK, 4 + 0.8·SP), with a 1-turn cooldown. The Wizard's `wiz_echo_bolt` stays the real
    spell.
  - The Drowned lose "weak ley"; their lesson is already Storm on Soaked.

### 19. Regional bosses run long for physical classes, and D-066 21 makes it worse
- **Severity:** Major. A settled ruling makes this worse: D-066 21 puts bosses at band top + 2.
- **Where:**
  - DESIGN §19 #8 targets: one fodder 3–5 rounds, a pair 5–8, a regional boss 10–14.
  - DESIGN §3.2–3.3, §4.3, §6.5 and §7.4 formulas; WORLD §6 stat blocks.
  - Assumptions: no companion; +1 per level to the main stat; mid-tier Common gear; abilities ≈1.2·ATK; damage over
    time counted.

  | Fight | Player | Rounds | Target | Verdict |
  |---|---|---|---|---|
  | `cr_hollow_lantern` L10 (start of the Veil band) | Ranger L10, ATK 28 / Wizard L10, SP 23 | 3 / 4 | 3–5 | on target |
  | 2× `cr_gale_kite` L12 (start of the Skyreach band) | Ranger L12, ATK 30, HP ≈ 222 | ≈ 6; takes ≈ 170 (kites act first; Mark then Swoop for 24) | 5–8 | right length, nearly lethal |
  | `cr_bell_warden` L9 + Lampreys | Ranger L8, ATK 23 / Wizard L8, SP 19, Storm on a target always Soaked | 16–18 / ≈ 12 | 10–14 | physical runs long |
  | `cr_ashmaw` L12 + 2 Jackals | Ranger L11, ATK 27 / Wizard L11, Storm (its weakness) | ≈ 19–20 / ≈ 13 | 10–14 | physical runs long |

- **Problem:**
  - Boss HP (3.5–4.5× an ordinary enemy's) is effectively tuned for the caster with the matching element.
  - Ranger, Elf and Warden run 40–50% long when solo, and about 13–15 rounds with a companion.
  - Raising bosses two levels with HP scaled up adds roughly 15% more.
  - Long boss fights are where deaths cluster (§19 #9).
- **Proposed fix:**
  - Boss HP = 12 × the expected physical damage per round at the band's top level (≈ 1.2·ATK − armor), plus the adds:
    - Bell-Warden 420 → 320;
    - Ashmaw 520 → 400;
    - Vell's Umbra 600 → 460, with physical neutral.
  - D-066 21's +2 levels raise ATK, accuracy and XP only, not HP.
  - Gale Kite's Swoop: 1.4× → 1.2×.

## Three strongest moments to protect

1. **The tear between Loop 1 and Loop 2** (STORY §4.2).
   - The legacy ESCAPE score screen plays in full, with "a game by Tim Dibert", and holds for two seconds.
   - Then it tears from the corner like paper: "The Breach does not lead *beyond*. It leads *back*."
   - Then: "The Amulet of Echoes is warm against your throat." Keep the screen exactly as it is, the typo fix aside.
2. **Nyx unmasked by the Crystal** (`q_what_the_crystal_heard`, `scene_nyx_unmasking`). The eighth voice fills the
   Chasm and it is hers. A legacy quest-giver becomes the best twist in the game without a line of exposition.
3. **The ninth verse** (`scene_ending_vigil`, STORY §10.1).
   - "Are you sure."
   - Masque's "Tell us true." / "It failed." / "Thank you."
   - "—I hold you."

   Runner-up: Kaelen's "Salt's free. Take the whetstone too."

## Three biggest fun risks

1. **Every loop is a re-grind.** Levels go back to 1 against a reveal and endings set in bands 13–18 (#5). Fix it with
   the carried-over starting level, or loops 2–5 will feel like chores.
2. **Time and death lose their meaning in the wrong places.**
   - Talk endings quietly check HP (#4).
   - Loop 3+ routes have 14–28 spare days (WORLD §10.9), and the Before is free time (#14). The Breach Clock has no
     teeth after Loop 2.
   - Meanwhile a player can't end a loop when they want to (#7).
3. **Knowledge is handed out, not found.**
   - Dask states the twist (#15).
   - The Amulet's *Listen* resolves about 8 quest climaxes and about 15 Echoes. One verb covers every discovery.
   - The Bell Vault's ring order, the blind Lightless Stair and the Reed Maze are the model for varying it.

## Rulings the lead should record

1. **Loop 1 Apex:** entry offers *Face it* / *Not yet*. No autosave at the Loop 1 Apex or during a Horde, so a reload
   lands at the Nexus or at the Horde's start.
2. **Starting level:** each new loop starts at ⌊0.6 × the best level reached⌋, capped at 10. Loop 2 included.
3. **Communion damage:** `tyr_hour_presses` = 8% of max HP × (1 − Resolve/8), and can't kill while Resolve ≥ 3.
   *Offer* never uses up items.
4. **Anchors:** last for the current loop only. Only `anchorable` items can be placed: the Sky-Whisper Talisman, the
   Cradle-Pin and Litany page 3.
5. **Silverwood Before:** each return costs 1 Breach Clock day. Before loot and XP are given once per loop.
6. **Breach-anchor schematic:**
   - Each half grants its own persistent Echo.
   - Half B also comes from Vane's Watch (`ev_outpost_seal`).
   - Heartwood also drops from Stone-Hide Golems (25%) and Kaelen sells it from Loop 2.
7. **Ending D:** requires Brak *active*. D never triggers `ws_brak_at_apex`.
8. **Ending B:** the present end is the anchor the player drives at the Apex. Ilyra's oath and Dask's choice to stay
   are scene variants only.
9. **Caelum:** joins as a companion inside the Before after his errand, and crosses in `q_a_boy_from_a_doomed_city`.
   The pin is set before he crosses.
10. **The Before's Conflux:** the whole Heartstone sits in Hallow's cradle. STORY's Before places become events on
    WORLD nodes: Spire Yard on the Plaza of Bells; Veyran's study and Masque's roof in the Ninefold Hall.
11. **The thirtieth dawn:** the shear took each earlier Wayfinder and steadied the drift. The Amulet prevents that, so
    the thirtieth dawn now comes.
12. **The Tyrant's strikes:** they are the Holding's reflex. From Loop 2, Veyran holds the reflex back from someone who
    has crossed.
13. **Nyx:** she landed at Where She Fell. She knows "thirty" from Ashcombe's notes.
14. **Ending a loop:** from Loop 2, *Let go* at any camp closes the loop as `closer_fall` with reason `released`. For
    E, *Keep the vigil* jumps to the last dawn.
15. **Threshold quests:** quests started at the Threshold belong to the profile and survive the Far Light.
16. **The reveal:** `echo_tyrant_jailer` needs two of the five sources. Dask's first scene gives only the warning.
17. **Loop 1 quests:** only four non-legacy quests stay in Loop 1 (`q_blood_and_salt`, `q_bell_vault`,
    `q_lantern_in_the_reeds`, `q_high_mark`). The rest become `2+`.
18. **Shadow Weaver:**
    - Its Void treats *resist void* as neutral against Cursed targets.
    - `wvr_unravel` deals Chrono.
    - Vell's Umbra resists Void instead of being immune, loses its curse immunity, and takes normal physical damage.
19. **`itm_echo_bolt`:** max(0.75·ATK, 4 + 0.8·SP) with a 1-turn cooldown. The Drowned lose "weak ley".
20. **Regional boss HP:** 12 × the expected physical damage per round at the band's top level, plus adds. D-066 21's +2
    levels raise ATK, accuracy and XP, not HP.
