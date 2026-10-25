# ART — painted scene backdrops (Grok Imagine) + code overlays

Decided 2026-10-24 (DECISIONS **D-124**). Every location gets a **painted backdrop** made with Grok Imagine. Code still
draws everything that changes in play, layered on top: time-of-day tint, particles, the Breach overlay and infection hatching,
focal glows, creature sigils, item icons and status glyphs. Where a location has no painting yet, `<Scene>` falls back to its
region-mate's painting and then to U64's parametric SVG, so the game never shows an empty frame.

This file is the **brief for the art session**: Tim runs it from a Claude task on his own PC (Grok Imagine in his Chrome). It is
self-contained — read it top to bottom, then follow §6.

---

## 1. What the session delivers

| Output | Where | Format |
|---|---|---|
| One backdrop per location (73) | `public/art/scenes/<locationId>.webp` | 1440 × 600 (12:5), WebP quality 78, ≤ 160 kB |
| A small copy of each | `public/art/scenes/<locationId>@sm.webp` | 720 × 300, WebP quality 74, ≤ 60 kB |
| Heartstone state variants (3) | `public/art/scenes/loc_heartstone_depths~<state>.webp` (+ `@sm`) | as above; `<state>` ∈ `stabilized`, `exploited`, `destroyed` |
| Title key art (1) | `public/art/title.webp` (+ `title@sm.webp`) | 1440 × 600 / 720 × 300 |
| The log | §8 of this file | one row per approved image |

Approved originals (Grok's full-size JPEGs) stay on Tim's PC in `Documents\Aethelgard Art\approved\` — they are not committed.
Candidates go in `Documents\Aethelgard Art\candidates\`.

**Budget.** Each Grok prompt returns **4 images**. The full list is 77 prompts (~310 images) plus rerolls. Work in the tiers of
§5 and stop wherever credits run out: anything unpainted falls back cleanly (above).

---

## 2. Technical spec

- **Aspect.** The game's scene frame is **12:5** (1200 × 500 viewBox, `src/ui/art/Scene.tsx`). Generate at Grok's widest
  landscape ratio (16:9 if offered, else 3:2) and crop to 12:5. Keep the subject in the **middle horizontal band**: every prompt
  says so (§3). Default crop is centred; move it up or down per image if the horizon or subject sits off-centre, and log the offset.
- **Mobile.** The frame shows full width on a phone, so the centre 60% must read on its own — no key detail at the far edges.
- **No people, no text.** Characters, the Tyrant and creatures are drawn by the game; a painted figure would clash. Screen out
  any image with figures, lettering, signatures or watermarks.
- **Overlays sit on top.** The game darkens the top and bottom 15% slightly for legibility, tints by time of day, and adds
  particles. Paintings should be rich but not busy; a calm sky band helps.
- **Accent colour.** Each region has one glowing accent (§4). It should appear in every painting of that region, and nowhere else.
- **Convert** with Pillow (`pip install pillow`): crop → resize with LANCZOS → `save(..., 'WEBP', quality=78, method=6)`; then
  the `@sm` copy at 720 × 300. Check sizes against the table.

---

## 3. The style lock (paste word for word at the end of every prompt)

> Atmospheric fantasy matte painting, painterly digital brushwork with soft edges, cinematic wide panoramic establishing shot at
> eye level, the main subject in the middle horizontal band of the frame, deep layered depth from foreground to far horizon, moody
> low-key light with one luminous accent colour, muted and slightly desaturated palette, still and quiet, an empty landscape with
> only the place itself.

**Prompt = subject line (§5) + region light line (§4) + style lock.** 60–110 words in all. Grok ignores negatives — describe what
you want, never "no X".

If the first round drifts (too saturated, too photographic, figures appear), change one thing per round, as in Tim's Exobyte art
skill: e.g. add "oil-painting texture" or "concept art for a dark fantasy video game". Stop after 3 rounds per location and pitch
the best with its flaws named. Once a phrasing works for the test batch, **update the style lock here** so every later prompt
uses the improved wording.

---

## 4. Region light lines (DESIGN §17.1 palettes, in words)

| Region | Light line |
|---|---|
| Silverwood Ruins | Indigo twilight sky fading to dusky violet, deep plum silhouettes, cold pale-blue crystal glow in cracks and branches. |
| Mistwood & the Ironclad Reach | Grey-green overcast sky over sage and moss tones, dark pine shadows, warm orange forge-ember light. |
| The Voidscar | Near-black sky bruised with deep purple, obsidian and ink shadows, electric violet void-light. |
| Aether-Kissed Highlands | Deep blue sky paling to soft cornflower at the horizon, slate-blue stone, brilliant white aether light. |
| Glowlands & Nexus | Dark emerald gloom, black-green water, vivid bioluminescent mint-green glow. |
| Silverwood Before | Twilight blue sky warming to golden dusk at the horizon, lavender stone, soft warm cream-gold light — the same city, whole and alive. |
| The Drowned Reach | Deep navy water-dark, teal depths, pale aqua ley-light shining up through water. |
| The Ashen Steppe | Dusty brown-grey sky, tan and umber ash plains, smouldering red-orange fire light. |
| The Veil | Black-violet sky with wrong stars, deep purple glass, bright orchid-violet sanctum light. |
| The Glowfen | Dark moss-green dusk, olive water, soft yellow-green lantern glow. |
| The Skyreach | Deep blue zenith fading to pale sky-blue, slate stone and cloud, warm pale-gold sunlight on stone. |
| The Threshold | Black void, faint midnight-blue haze, a single cool silver-blue far light. |

---

## 5. The shot list (77 prompts, in tiers)

Order of work: **Tier 0** (the test batch) → Tim approves the look → **Tier 1** → **Tier 2**. Show Tim one contact sheet per
region batch (§6.4). Silverwood Before mirrors the present-day Ruins: same places, whole and alive — keep its compositions
recognisably the same as their ruined twins (noted per line).

### Tier 0 — the test batch (4 prompts, four different lights)
| id | Subject line |
|---|---|
| `loc_whispering_ruins` | Overgrown ruins of a fallen marble city at dusk, twisted trees with small glowing crystals in their branches, a row of half-buried carved stone tablets, a broken half-arch, scattered rubble in the foreground. |
| `loc_emberforge` | A warm cavern opening off a sheltered canyon, rock walls veined with ember-bright stone, a great stone forge with a glowing hearth and anvil at the centre, heat haze rising. |
| `loc_lanternreed` | A village of reed huts on stilts over a softly glowing pool, lantern-glass windows, rope walkways between the huts, reeds and mangrove roots, mist on the water. |
| `loc_still_shore` | A shore of black sand beside perfectly still dark water that reflects nothing, no visible sky, a single small light far out across the water at the horizon. |

### Tier 1 — the main road and the story's places (24 prompts)
| id | Subject line |
|---|---|
| `title` (key art) | The Whispering Ruins at first light seen from a low hill, a broken marble archway framing a distant torn sky with a thin violet rift, glowing crystal trees, a long road leading away into the ruins. |
| `loc_crumbling_archway` | A monumental cracked marble arch standing alone, its keystone carved with nine faces, vines across the stone, ruins and crystal-lit trees beyond it. |
| `loc_darkened_corridor` | A long underground stone corridor slick with moisture, pale glowing fungi on the vaulted ceiling, faint light rippling across wet flagstones, darkness at the far end. |
| `loc_shattered_library` | A vast ruined library hall, collapsed bookshelves forming jagged ridges of wood and stone, dust motes drifting in dim shafts of light, a broken glass roof high above. |
| `loc_silverwood_plaza` | A cratered ring of cracked marble that was once a city plaza, broken fountains seeping shimmering mist, ruined colonnades around the edge. |
| `loc_sunken_archives` | Half-flooded underground vaults, sagging shelves of soaked books, still brackish water with glowing lines of ley-light under the surface, a stair descending into the water. |
| `loc_heartstone_depths` | A deep cavern chamber of raw pulsing magic, a massive glowing crystal heart at the centre on a dais, nine stone plinths in a ring around it, ripples of light in the air. |
| `loc_mistwood_path` | A winding forest trail through fog-laden trees with faintly glowing bark, small stone cairns along the path, shadows between the trunks. |
| `loc_ironclad_camp` | A rough circle of canvas tents and scrap-metal barricades in a forest clearing, smoke rising, a forge glowing between the tents, a gap in the barricade. |
| `loc_barren_peaks` | Razor-edged mountain ridges under a windy sky, broken stone, a worn path climbing between the crags. |
| `loc_chasm_of_whispers` | A jagged rift splitting the earth, cold violet light rising from far below, a single rope bridge spanning the chasm. |
| `loc_aetherium_spires` | Colossal crystalline spires rising from a wide basin, humming with white light, pale drifting light-trails between them, the tallest spire in the middle. |
| `loc_veridian_glowlands` | A swampy basin packed with bioluminescent plants, glowing green soil, a causeway of flat stones crossing dark water, humid haze. |
| `loc_chronos_nexus` | A ruined observatory beneath a shattered dome, cracked stone floor, faint ghostly afterimages of the room flickering in the air, a sealed doorway in the east wall. |
| `loc_temporal_breach_apex` | A place where reality tears in violent glowing seams, impossible folded angles of stone and sky, a vast wound of light at the centre. |
| `loc_silver_gate` | *(twin of the Crumbling Archway)* The same monumental marble arch, whole and gleaming, silver leaf on the keystone with nine newly carved faces, a living city of roofs rising beyond it at dawn. |
| `loc_grand_library` | *(twin of the Shattered Library)* A towering intact library hall, shelves to an unseen ceiling, ladders on rails, warm light falling through a glass roof. |
| `loc_plaza_of_bells` | *(twin of Silverwood Plaza)* A grand marble plaza with running fountains, nine bronze bells hanging in a frame above them, colonnades and banners. |
| `loc_conflux_chamber` | *(twin of the Heartstone Depths)* The same cavern chamber before the wound: nine plinths around a well of light, a whole and steady crystal heart held in the light, calm and golden. |
| `loc_hearthring` | A ring of tall standing stones on an ash plain with a great fire burning in the middle, hide tents leaning against the stones. |
| `loc_sanctum_of_threads` | A hall woven rather than built, thousands of grey and violet threads running wall to wall, the walls themselves made of thread, soft violet light. |
| `loc_gallery_of_loops` | A colonnade standing on black sand beside still water, framed paintings hanging between the columns, a cool far light on the horizon. |
| `loc_loom` | A large loom made of driftwood on black sand, strung with threads of soft light, still water behind it. |
| `loc_far_light` | A path of still water leading toward a bright door of light at the horizon, the light like a sunrise seen through a doorway, black void all around. |

### Tier 2 — everywhere else (49 prompts, by region)

**Silverwood Ruins & Mistwood / Ironclad Reach**

| id | Subject line |
|---|---|
| `loc_wayfarers_respite` | A calm pocket between mana-scarred cliffs, a silver-tinged stream over smooth stones, a small trader's awning and a campfire. |
| `loc_blighted_outpost` | A ruined frontier outpost of splintered wooden palisades jutting from rock like broken teeth, drag marks in the dirt, a burned gate. |

**The Voidscar & Aether-Kissed Highlands**

| id | Subject line |
|---|---|
| `loc_voidscar_hollow` | A collapsed hollow of black obsidian scree and bruised violet crystal beneath a dark sky. |
| `loc_shimmering_pass` | A narrow winding path between jagged crystal-laced rocks, shimmering heat-like distortion in the air. |
| `loc_sky_whisper_plateau` | A windswept high stone shelf with weathered standing markers, a wide view over a fractured land far below. |

**Silverwood Before** (whole, alive, golden; the ruins' twins)

| id | Subject line |
|---|---|
| `loc_outer_walks` | Ordered gardens outside a city gate, straight young trees, newly carved stone tablets standing at intervals along a path. |
| `loc_scholars_corridor` | A long covered stone walkway lit by lamps every ten paces, arches opening onto a sunny city. |
| `loc_ninefold_hall` | A round stately hall with nine tall carved chairs in a circle, a floor map of glowing silver lines inlaid in the stone. |
| `loc_apprentices_garret` | A long attic dormitory at night, rows of simple cots and slates, a round window looking down on a lamplit plaza. |
| `loc_cistern_gardens` | Terraced pools green with lilies, wooden sluice-wheels at each pool, steps between terraces in sunlight. |
| `loc_archives_of_danthe` | *(twin of the Sunken Archives)* Dry orderly underground vaults, straight shelves of bound tomes, a brass rail along each aisle, a desk by a stair leading down. |

**The Drowned Reach**

| id | Subject line |
|---|---|
| `loc_drowned_stair` | A stone stair descending under clear dark water, lamps burning underwater on every ninth step, the deep below them black. |
| `loc_tidewell_hall` | A flooded guildhall with water at chest height, long tables in rows beneath the surface, ledgers floating open. |
| `loc_cistern_of_names` | A round flooded cistern with a walkway at its rim, every wall stone carved with a name, water pouring in from a crack. |
| `loc_lamplighters_rest` | A small dry room above the waterline, lamps hanging from every hook, jars of oil, nets drying, a kettle on a stove. |
| `loc_sunken_scriptorium` | Tiered desks like a theatre all facing one lectern, under water clear as glass, open books on the desks. |
| `loc_black_sluice` | A channel of fast black water between iron grates in a stone tunnel, swirling eddies. |
| `loc_bellmouth` | A flooded bell tower lying on its side, a huge bronze bell filling the far end like a shell, water inside it. |
| `loc_bell_wardens_deep` | A well of black water lit from far below beneath a great fallen bell, a vast bell clapper lying across the water. |

**The Ashen Steppe**

| id | Subject line |
|---|---|
| `loc_scorched_gate` | A burned fortress gateway with a smaller rough gate built inside its frame, a brazier burning, grey ash plains beyond. |
| `loc_ash_wind_flats` | Flat grey ash land under a flat white sky, straight herd-paths crossing to the horizon, wind-blown ash. |
| `loc_bone_orchard` | Rows of bison turned to white stone in mid-stride, mouths open, grey grass growing between them on an ash plain. |
| `loc_grey_salt_pan` | A perfectly flat white salt lake under a grey sky, the horizon erased by glare. |
| `loc_stormgate_cairns` | A field of tall cairns of dark iron stone each capped with a metal spike, dry lightning between them at dusk. |
| `loc_watchfire_ridge` | A spine of black rock above grey plains with a signal fire burning on top, a green haze far to the south. |
| `loc_reedmarch_descent` | Terraces stepping down from a grey ridge into green reeds, the land turning from ash to green in three steps. |
| `loc_herd_grave` | A deep bowl in the ash plain where the ash lies thick, smouldering embers glowing beneath the grey surface. |

**The Veil**

| id | Subject line |
|---|---|
| `loc_veil_mouth` | A curtain of darkness parting onto a plain of black glass under a sky of wrong stars. |
| `loc_stair_of_unmaking` | Steps cut down into a dark scar, each step fainter and less solid than the one above, a single glowing thread running along them. |
| `loc_scar_shelf` | A ledge of obsidian flowed and frozen in sheets, overlooking a dark hollow below and a violet void above. |
| `loc_voidglass_gallery` | A long hall of polished black glass walls that reflect nothing, faint violet light along the floor. |
| `loc_null_orchard` | An orchard of tree-shaped absences, the outlines of trunks and branches cut out of the world showing black void, ground of dark glass. |
| `loc_eye_of_the_scar` | A round floor of glass beneath a round sky of nothing, a lone cast shadow lying on the glass. |
| `loc_where_she_fell` | A crater of fused glittering glass forty paces across, starlight frozen in the glass, a faint print at its centre. |

**The Glowfen**

| id | Subject line |
|---|---|
| `loc_lantern_causeway` | A road of lashed reeds just above dark water, lanterns on poles lit by glow rising from the water. |
| `loc_sporelight_shallows` | Knee-deep swamp water over soft mud, glowing fungal shelves on every stump shedding drifting light-dust. |
| `loc_elder_mangrove` | One enormous ancient mangrove tree whose roots form a hall, pools of soft light in the hollows of the roots. |
| `loc_breathing_pool` | A well of soft light in a swamp clearing, the surface swelling gently, a reed mat at its edge. |
| `loc_firefly_barrows` | Low burial mounds rising from swamp water, slow glowing light leaking from each mound at dusk. |
| `loc_pale_gullet` | A swamp narrowing into a throat of pale roots, fast water running downhill, white light instead of green. |
| `loc_matrons_hall` | A cavern under the swamp with glowing light pooled thick on dark water, an island of roots at its centre. |

**The Skyreach & Glowlands**

| id | Subject line |
|---|---|
| `loc_windward_stair` | Steps carved into open air high above clouds, stone treads floating in the wind, a sheer drop below. |
| `loc_spire_crown` | The flat top of a giant crystal spire above the clouds, a wide crystal disc, threads of pale light leaving it to other spires. |
| `loc_roost_of_sentinels` | A cliff face honeycombed with ledges and alcoves high above the clouds, old weapons resting on the high ledges. |
| `loc_auldes_eyrie` | A workshop of glass and brass set into a cliff, looms weaving cords of light, drawings covering the walls, sky beyond the windows. |
| `loc_stormcrowns_perch` | A single stone pinnacle above everything, ringed with lightning that never reaches the ground. |

**Heartstone variants** (same composition as the approved `loc_heartstone_depths`; describe only the change)

| id | Subject line |
|---|---|
| `loc_heartstone_depths~stabilized` | …the crystal heart bound in calm bands of steady blue light, the plinths glowing evenly. |
| `loc_heartstone_depths~exploited` | …the crystal heart cracked and bleeding violet light into channels cut in the floor. |
| `loc_heartstone_depths~destroyed` | …the dais empty and shattered, crystal shards scattered, the chamber dark and cold. |

---

## 6. How the art session runs

### 6.1 Start
Tim opens a task in the Claude desktop app with **his computer selected** and says: *"Read docs/ART.md in
dubbltninja/Aethelgard (branch `unraveling`) and run the art session."* The session:
1. Reads this file. If Tim's `grok-imagine-art` skill is available, read it too for the Chrome mechanics (opening Grok Imagine,
   choosing Image + Quality, downloading by on-screen position) — its *stitch-ready* screening rules do **not** apply here; §6.3
   replaces them.
2. Confirms Grok's usage terms allow the images in a free public web game, and notes the answer in §8.

### 6.2 Generate
- Grok Imagine in Tim's Chrome, Image mode, **Quality**, the widest landscape ratio.
- One prompt per row of §5: subject line + region light line + style lock.
- Download candidates as `<id>-<round><n>.jpg` (e.g. `loc_emberforge-a2.jpg`) into `Documents\Aethelgard Art\candidates\`.

### 6.3 Screen every image
- Reads as **one place**, matching its subject line and its region's accent.
- The subject sits in the middle band and survives the 12:5 crop and the 60% phone centre.
- Painterly, not photographic; consistent with the approved test batch.
- No figures, creatures, faces, text, signatures, watermarks or logos; nothing resembling a known artwork, film still or game.
- Twins (Silverwood Before ↔ Ruins) recognisably the same place.

### 6.4 Pitch
One contact sheet per batch (Tier 0; then a region at a time), built with Pillow: candidates in a grid at the 12:5 crop, labelled
`A1…` with the location name. Send it to Tim with your favourite and alternate per location and any flaw. Tim replies with picks or
"redo X + change". Never overwrite an approved image.

### 6.5 Deliver
For each approved image: crop, convert and size-check (§2), then put the files in `public/art/scenes/` (or `public/art/` for the
title). Commit in batches with explicit pathspecs, message `art: <region> backdrops (Grok Imagine)`, attribution as usual, and push
to **`wip/art`** only — never `main` or `unraveling`; the lead merges. Add each image's row to §8.

If the session cannot run git on Tim's PC, it leaves the WebPs in `Documents\Aethelgard Art\export\` and tells Tim to attach them
to the lead's chat.

---

## 7. How the game uses them (U71's job — for reference)
`<Scene>` renders a `<picture>` (`@sm` below 760 px wide, lazy-loaded, decoding async) under the code layers when
`public/art/scenes/<id>.webp` exists, chosen by a manifest generated at build time from that folder. The Heartstone Depths pick
the variant for `heartstone` state. Fallback order: the location's own painting → a region-mate's painting with the region tint →
U64's parametric SVG. The painting is decorative (`alt=""`); the location's text describes the place. Paintings preload for the
current location's exits only.

---

## 8. Log (one row per approved image)

Grok terms checked: _(the art session fills this in)_

| id | file | round / pick | crop offset | notes |
|---|---|---|---|---|
