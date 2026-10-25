# ART-2 — creature sprites and character portraits (Grok Imagine)

Decided 2026-10-25 (DECISIONS **D-128**). Part 1 (`docs/ART.md`) painted every place. Part 2 puts **pixel-art figures** in
them, in the same dark-fantasy pixel style:

- **Sprites:** full-body cut-outs that **stand in the scene** during combat, in front of the location's painting. They cover
  every creature you fight, the five player classes and the six companions. Code animates them: idle bob, hit flash, lunge,
  death fade.
- **Portraits:** framed busts of everyone who speaks, shown large in dialogue over a dimmed copy of the location's painting,
  and small in Explore's NPC rows and on the companion chip.

Until a figure is delivered, the game shows today's code-drawn family sigil, so the session can stop anywhere. The sigil also
stays as a small corner badge on every sprite: shape tells colour-blind players a creature's family.

This file is the **brief for the art session**, run from a Claude task on Tim's PC like Part 1. Read Part 1's §6 (how a
session runs: Chrome, Grok settings, one prompt at a time, candidates, contact sheets, `wip/art`) and its §8 lessons first.
Everything here is in addition to that.

---

## 1. What the session delivers

| id | size | Subject line |
|---|---|---|
| Output | Where | Format |
|---|---|---|
| Creature sprites (56) | `public/art/sprites/<creatureId>.webp` | transparent WebP (alpha), trimmed to the figure + 4 px, height per §2 size class, ≤ 120 kB |
| Class sprites (5) | `public/art/sprites/class_<classId>.webp` | as above, **facing right** |
| Companion sprites (6) | `public/art/sprites/companion_<companionId>.webp` | as above, **facing right** |
| Portraits (38) | `public/art/portraits/<npcId>.webp` + `@sm` | 512 × 512 (and 160 × 160), opaque, ≤ 70 kB / 15 kB |
| The log | §8 of this file | one row per approved image |

Creatures face **left**: they stand on the right of the stage, facing the player. If a good candidate faces the wrong way,
mirror it in Pillow, unless it carries lettering or a one-sided feature the story names, and log the mirror.

**Budget:** 105 prompts (~420 images) plus rerolls, in the tiers of §5. Expect more rerolls than for backdrops: figures
drift in anatomy, and the cut-out step (§3) rejects some.

---

## 2. Technical spec

- **Pixel grain matches the backdrops.** Grok's pixel art is about 3 screen px per art pixel at full size; keep that. Downscale
  with LANCZOS to the target height, never nearest-neighbour from a blurry source.
- **Size classes** (the stored height of the trimmed sprite; the game scales them to the stage):

  | class | stored height | examples |
  |---|---|---|
  | `small` | 256 px | wisps, motes, moths, crawlers, leeches, lanterns, rootlings, spore drifts |
  | `medium` | 384 px | humans, hounds, Shade, Stalker, Archivist, Mireling, jackals, toads |
  | `large` | 512 px | Brute, Golem, Knights, Cinderback, Reed Stalker, Spire Loom, Cloud Ray, Starved Shadow, elites |
  | `huge` | 768 px | regional bosses, the Tyrant (both forms), the Unraveling Tide |

  Log each sprite's class in §8; the game's sprite registry reads it.
- **Feet on the ground line.** The figure's lowest point is its feet, or the bottom of a floating figure's glow. The game puts
  that line on the stage floor and draws a soft shadow ellipse there itself, so the sprite carries **no ground and no shadow**.
- **Cut-out (sprites only).** Prompt for a *perfectly flat solid* background: **bright green `#00FF00`** by default, and
  **bright magenta `#FF00FF`** for anything green or green-lit (the Glowfen family, Glowlands creatures, Mireya, any green
  glow). Then, with Pillow:
  1. Key out pixels within ~60 RGB distance of the key colour.
  2. Remove fringe: drop pixels with key hue left at the edge (a 1 px erode where the edge is noisy).
  3. Remove spill: pull remaining key-tinted edge pixels toward their neighbours' colour.
  4. Trim to the alpha bounds + 4 px, then resize to the size class height.
  5. Save as WebP with alpha (`lossless=False, quality=88, alpha_quality=100`).

  Check the result on both a black and a white background in the contact sheet: no green halo, no holes in the figure.
- **Portraits are not cut out.** Bust, head and shoulders, three-quarter view, on a dark plain backdrop with a soft vignette
  in the speaker's accent colour. The game frames them.
- **No text, no extra figures.** One subject per image. Reject lettering, signatures, watermarks, a second creature, a rider,
  or a scene behind a sprite.

---

## 3. The style locks (paste word for word at the end of every prompt)

**Sprite lock:**
> Detailed dark fantasy pixel art character sprite for a dungeon crawler RPG, visible pixels with hand-placed dithered shading,
> grim and gothic, the whole figure from head to feet in three-quarter view, centred with generous margin on all sides, heavy
> shadows with one luminous accent colour, muted desaturated palette with deep blacks, isolated on a perfectly flat solid
> bright **green** background with nothing else in the image.

(Use **magenta** in place of green for the sprites marked 🟣 in §5.)

**Portrait lock:**
> Detailed dark fantasy pixel art character portrait for a dungeon crawler RPG, visible pixels with hand-placed dithered shading,
> grim and gothic, head and shoulders in three-quarter view, centred, face clearly lit, muted desaturated palette with deep
> blacks, against a plain dark charcoal backdrop with a soft glow of one accent colour behind the head.

**Prompt = subject line (§5) + lock.** 50–100 words. Grok ignores negatives: say what you want. For a sprite's facing, add
"facing left" or "facing right" to the subject line. The cut-out step needs margin, so if Grok crops feet or ears, add "small
in the frame" and reroll.

As in Part 1, if the test batch shows a better phrasing, update the lock here before the tiers.

---

## 4. Consistency

- **Humans look like they live in the backdrops:** worn, layered cloth and leather, muted dyes, no bright armour shine. Faces
  are weathered and individual, not glamorous.
- **The Nine and Silverwood Before** (Veyran, Nyxaria, Oriel, Korr, Vane, Hallow, Aulde, Sallow, Masque, Vask, Dreyl, Rhune,
  Hadrek, Dunn, Anso): five hundred years ago, the city whole. Cleaner robes in blue, white, grey and silver, warm gold light.
  This is the "before" palette of Part 1's Silverwood Before.
- **Twins:** the same person in two times must read as the same face. Nyxaria Vell (Before) is a young Nyx; Oriel Danthe
  has Ilyra's hands; the Redundant Wayfinder reuses the player's class sprite (made in code, not here).
- **Families share a look** (sigil shapes from DESIGN §17.3 for reference):
  - **Hollowed:** smoke and shadow, cold star-eyes.
  - **Wilds:** beasts with bark-light and ash.
  - **Wards:** stone, slate and iron constructs with carved rune-rings.
  - **Spireborn:** crystal, brass and light.
  - **Watch-Wardens:** grey, flickering things of time; hourglass and clockface motifs.
  - **Drowned:** water-logged and pale, with lamps.
  - **Green:** Glowfen bioluminescence.
  - **Unravelled:** loose moments, husks, bone and crystal.
  - **Mortal:** people in uniform.

---

## 5. The list (105 prompts, in tiers)

### Tier 0 — test batch (5 prompts: two sprites, one big sprite, a hero, a portrait)
| id | size | Subject line |
|---|---|---|
| `cr_corrupted_shade` | medium | A smeared shadowy silhouette of a once-noble mage in tattered robes, its outline smudged like wet ink, faint pale-blue crystal light where its eyes should be, hands raised to cast, facing left. |
| `cr_wildling_brute` | large | A hulking creature grown from twisted roots and bone, a skull of antler and bark, mossy shoulders, a faint orange ember-glow in the cracks of its root-body, knuckles on the ground, facing left. |
| `cr_bell_warden` | huge | A drowned giant sitting in black water, wearing a rusted chain of office, a huge bronze bell clapper laid across its knees, pale bloated skin, weeds in its beard, pale aqua light rising from below, facing left. |
| `class_ranger` | medium | A lean ranger in a weathered hooded cloak and leather, a handmade longbow, three knives on the belt, a quiver, alert stance, facing right. |
| `npc_ilyra` (portrait) | — | Ilyra, a Remnant scholar in faded layered robes and a hood, a woman in her thirties, ink-stained fingers at her collar, bright purposeful eyes, pale-blue accent glow. |

### Tier 1 — the heroes, the first loop and every boss (33 prompts)

**Player classes (facing right)**
| id | size | Subject line |
|---|---|---|
| `class_wizard` | medium | A self-taught young wizard in a patched dark coat, a scorched grimoire chained at the hip, sparks and a thread of storm-light between the fingers, facing right. |
| `class_elf` | medium | A slender elf of an old city bloodline, long-lived and calm, light layered leathers in silver-grey, a curved blade held low in a dancer's stance, faint ley-light at the wrists, facing right. |
| `class_ironclad_warden` | medium | A broad warrior in heavy scavenged plate and chain, a tower shield and a short hammer, dented and patched, planted feet, facing right. |
| `class_shadow_weaver` | medium | A gaunt figure in grey thread robes, violet light curling from one bare hand, a thin scar of blood at the wrist, hollow watchful eyes, facing right. |

**Companions (facing right)**

| id | size | Subject line |
|---|---|---|
| `companion_ilyra` | medium | Ilyra, the Remnant scholar from her portrait, full figure, faded hooded robes, a satchel of papers, a staff with a pale-blue crystal, facing right. |
| `companion_brak` | medium | Brak, a scarred Ironclad scout, leather and scrap armour, a chipped axe, ash-smudged, hard face, facing right. |
| `companion_nyx` | medium | Nyx, a woman wrapped in shadow and grey thread, eyes burning with quiet starlight, violet void-light around her hands, facing right. |
| `companion_dask` | medium | Dask, a weathered wanderer whose outline is faintly doubled as if seen in two moments, a long travelling coat, a broken hourglass charm, facing right. |
| `companion_caelum` | medium | Caelum, a lanky young apprentice errand-boy of an ancient city, blue-and-white livery, satchel, an anxious clever face, faint warm gold light, facing right. |
| 🟣 `companion_mireya` | medium | Mireya, a Glowfen herbalist with soft yellow-green light under the skin of her wrists, reed-woven shawl, a lantern on a pole, pouches of moss, facing right. |

**The first loop's creatures (facing left)**

| id | size | Subject line |
|---|---|---|
| `cr_mistwood_prowler` | medium | A lean grey forest cat with glowing bark-light patterns along its flanks, low hunting crouch, facing left. |
| `cr_rootling` | small | A knee-high creature of tangled brown roots with a knot-hole face and twig fingers, a faint amber sap-glow in the knot-hole, facing left. |
| `cr_drowned_archivist` | medium | A sodden scholar in waterlogged robes clutching a dripping book, pale skin, weed in its hair, a dim lamp at its belt, pale aqua light, facing left. |
| `cr_arcane_wisp` | small | A floating knot of crackling wild magic, a tangle of pale-blue light and sparks with a dim core, facing left. |
| `cr_stone_hide_golem` | large | A hulking construct of slate and iron plates, carved ring-and-bar runes, sparks skittering off its hide, a dim orange core, facing left. |
| `cr_warding_pillar` | medium | A standing stone carved with a ring-and-bar sigil, cracked, a faint orange ward-glow in the carving, rooted in nothing. |
| `cr_void_touched_stalker` | medium | A lean shadowy predator of smoke and ink, long limbs, eyes like cold white stars, violet void-light along its spine, facing left. |
| `cr_shimmering_phantom` | medium | A mirage given teeth: a heat-shimmer shape of a grey spectral figure with a wide fanged mouth, outline wavering, facing left. |
| `cr_moment_moth` | small | A large grey moth with clockface patterns on its wings, dust falling from it, facing left. |
| `cr_aetherial_weaver` | medium | A luminous spindly entity of white light spinning strands of raw magic between its many fingers, crystal shards for a body, facing left. |
| `cr_sky_whisper_sentinel` | large | A wind-hardened stone and brass guardian with a hood of cloud, a curved blade of wind-cut stone, pale gold light in its eyes, facing left. |
| 🟣 `cr_glowfen_mireling` | medium | An amphibious hunched swamp creature, slick skin, webbed claws, wreathed in eerie green light, facing left. |
| `cr_temporal_aberration` | large | A warped grey being that flickers between moments, three overlapping outlines, hourglass-shaped torso, sand pouring upward, facing left. |
| `cr_horde_husk` | medium | A hollow flickering husk of a person, edges unravelling into loose threads and static, no face, facing left. |
| `cr_unraveling_tide` | huge | A wave of loose moments: a rearing wall of grey static and threads with half-formed husks and hands inside it, violet light at its crest, facing left. |

**The Tyrant and its arm**

| id | size | Subject line |
|---|---|---|
| `cr_chronos_tyrant_contained` | huge | A towering amorphous figure of rippling time held in bands of light, skeletal limbs and crystalline shards surfacing and sinking in its shifting mass, one great eye, violet and silver light, facing left. |
| `cr_chronos_tyrant_unveiled` | huge | The same towering figure of rippling time unbound, the bands of light broken, five half-formed human shapes surfacing in its mass, crystal crown, violet light flaring, facing left. |
| `cr_tyrants_reach` | large | A huge arm of bone and crystal reaching out of the air, the shoulder fading into nothing, violet light along its seams, facing left. |

**Every regional boss**

| id | size | Subject line |
|---|---|---|
| `cr_unbroken_warden` | huge | A colossal stone-and-silver guardian at a stair, a nine-sided shield, carved ring-and-bar sigil on its chest, warm gold Before light, facing left. |
| `cr_ashmaw` | huge | A herd that burned and learned to move as one: a mass of bison shapes fused in ash and glowing coals, many horns and eyes, red-orange fire light, facing left. |
| `cr_vells_umbra` | huge | A tall shadow that no one casts, with a woman's shoulders and stance, edges of violet void-light, starlit eyes, facing left. |
| 🟣 `cr_lantern_matron` | huge | A vast patient swamp-mother creature, her back a hill of glowing lanterns, roots for hair, a sorrowful huge face, yellow-green lantern light, facing left. |
| `cr_stormcrown` | huge | The first Sentinel: a towering stone and brass guardian with a crown of storm-glass, lightning crawling over it, pale gold sunlight on its shoulders, facing left. |

### Tier 2 — everyone else (67 prompts: 30 sprites, 37 portraits)

**Creatures (facing left)**
| id | size | Subject line |
|---|---|---|
| `cr_paradox_wisp` | small | A wisp of pale-blue light caught in two places at once, two overlapping cores, a mirrored spark, facing left. |
| `cr_unmade` | medium | A person-shaped hole cut out of the world, a blank silhouette edged with frayed threads and static. |
| `cr_stutter_hound` | medium | A grey hound captured mid-stride twice, two overlapping heads and doubled legs, hourglass motif on its collar, facing left. |
| `cr_veil_sentry` | medium | A Weaver guard in grey thread robes with a hooded face, a long thread-staff and a counting cord, violet light, facing left. |
| `cr_glass_mote` | small | A hand-sized spinning chip of white crystal, sharp facets, a ring of light around it, facing left. |
| `cr_steppe_harrier` | medium | A huge grey hawk with a man-tall wingspan, ash-dusted feathers, talons out, wings spread, facing left. |
| 🟣 `cr_lantern_toad` | medium | A dog-sized toad with a glowing yellow-green throat-sac, warty dark skin, wide mouth, facing left. |
| 🟣 `cr_spore_drift` | small | A drifting cloud of glowing yellow-green spores with a faint face in it, facing left. |
| `cr_hourglass_crawler` | small | A hand-long crawling creature with a glass hourglass body full of sand and grey legs, facing left. |
| `cr_orrery_knight` | large | A brass knight with a turning orrery of rings and planets for a chest, a tall halberd, facing left. |
| `cr_hour_leech` | small | A grey leech ringed with clockface markings, a round mouth, a faint silver glow, facing left. |
| `cr_ley_hound` | medium | A lean silver-grey hound bred on the ley, faint blue light along its veins, a studded collar, facing left. |
| `cr_ninefold_knight` | large | An empty suit of silver-white plate with no one inside, a nine-sided shield, a ring-and-bar sigil on the breast, warm gold light, facing left. |
| `cr_city_watch_halberdier` | medium | A city watchman in blue and white livery and a steel cap, a halberd and a whistle, a stern but reluctant face, facing left. |
| `cr_circle_adept` | medium | A young scholar-mage in grey robes with ink on the cuffs, a lit spell between the hands, facing left. |
| `cr_tide_clerk` | medium | A drowned clerk in a waterlogged long coat with a ledger and a quill, pale skin, dripping, pale aqua light, facing left. |
| `cr_pale_diver` | medium | A pale drowned diver in old diving leathers and a brass helmet visor open, carrying a dim lamp, facing left. |
| `cr_brine_lamprey` | medium | A pale eel-long lamprey with many round mouths along its body, coiled in the air, facing left. |
| `cr_ledger_choir` | large | A ring of five drowned figures in sodden robes standing close together, reading from one long ledger, pale aqua light, facing left. |
| `cr_bell_ringer` | large | A shape inside a cracked bronze bell lying on its side, a pale hand gripping a rope, facing left. |
| `cr_salt_jackal` | medium | A pale jackal the colour of salt, lean, teeth bared, facing left. |
| `cr_cinderback` | large | A great bull with ash for a hide and glowing coals along its spine, smoke from its nostrils, facing left. |
| 🟣 `cr_reed_stalker` | large | A grey-green wading bird-creature twice a man's height, long neck, spear beak, patient stance, facing left. |
| `cr_starved_shadow` | large | A hunched hungry shadow with a gaping mouth, swallowing a thread of light, starlit eyes, violet edges, facing left. |
| `cr_hollow_lantern` | small | A floating Weaver lantern of black glass holding darkness instead of flame, a violet rim of light, facing left. |
| `cr_null_mouth` | medium | A roughly round mouth with no head, man-height, ringed with teeth, black void inside, violet edge-light, facing left. |
| 🟣 `cr_barrow_light` | small | A slow glowing wisp shaped like a hunched mourner, yellow-green light, facing left. |
| `cr_spire_loom` | large | A brass-and-glass loom running on its own, glass shuttles flying, threads of pale light, no weaver, facing left. |
| `cr_gale_kite` | medium | A diamond-shaped brass-and-cloth kite construct as wide as a man's arms, a tail of wind and pale gold light, facing left. |
| `cr_cloud_ray` | large | A wagon-wide flat gliding construct like a manta of brass and sailcloth, wrapped in its own small cloud, facing left. |

**Portraits (opaque)**
| id | Subject line |
|---|---|
| `npc_tamsin_reed` | Scribe Tamsin Reed, a sharp middle-aged Remnant scribe with ink-stained fingers and a quill behind one ear, pale-blue accent. |
| `npc_ansel_dray` | Keeper Ansel Dray, a Remnant keeper of about seventy with a white beard and spectacles, holding a heavy ledger, pale-blue accent. |
| `npc_kaelen_stonehand` | Kaelen Stonehand, a broad-shouldered trader with weathered hands and a sharp gaze, a fur-trimmed coat, orange ember accent. |
| `npc_brak` | Brak, a scarred Ironclad scout, shaved head, chipped axe over the shoulder, orange ember accent. |
| `npc_borin_stonefist` | Borin Stonefist, a gruff blacksmith with soot-darkened arms and beard, a leather apron, orange forge accent. |
| `npc_nyx` | Nyx, a woman wrapped in shadow and grey thread, eyes burning with quiet starlight, violet accent. |
| `npc_dask` | Dask, a weathered wanderer whose face is faintly doubled as if seen in two moments, silver accent. |
| `npc_caelum` | Caelum Vesper, a lanky anxious young apprentice in blue-and-white livery, warm gold accent. |
| 🟣 `npc_mireya` | Mireya of Lanternreed, a herbalist with soft light under the skin of her wrists and cheeks, reed shawl, yellow-green accent. (Portraits aren't keyed; the 🟣 is just a reminder of her colour.) |
| `npc_bryn_dunn` | Gate-Captain Bryn Dunn, a stern woman in blue-and-white watch livery and a steel cap, warm gold accent. |
| `npc_bellwright_anso` | Anso the Bellwright, a cheerful stout man with burn-scarred hands and a small bell charm, warm gold accent. |
| `npc_veyran_thal` | Archmagus Veyran Thal, leader of the Nine, a tall greying man in fine white-and-silver robes, a kind confident face, warm gold accent. |
| `npc_nyxaria_vell_before` | Nyxaria Vell, the youngest of the Nine, a young woman with ordinary eyes and the same face as Nyx, grey-and-silver robes, warm gold accent. |
| `npc_oriel_danthe` | Oriel Danthe, the Circle's archivist, a careful woman with ink on her hands, writing, blue robes, warm gold accent. |
| `npc_maelis_korr` | Maelis Korr, a severe scholar with a dark annotated workbook, grey robes, warm gold accent. |
| `npc_haldric_vane` | Haldric Vane the Warder, a stony grim man with a ring-and-bar sigil pendant, warm gold accent. |
| `npc_durn_hallow` | Durn Hallow, the Circle's smith, a heavy-set man with an iron cradle and burn scars, warm gold accent. |
| `npc_seraphine_aulde` | Seraphine Aulde, the Spire-builder, an intense woman with a tuning fork and crystal earrings, warm gold accent. |
| `npc_imre_sallow` | Imre Sallow, a life-mage and gardener with soil on her hands and flowers in her hair, warm gold accent. |
| `npc_tovren_masque` | Tovren Masque, an astronomer with a brass eyepiece and star charts, warm gold accent. |
| `npc_tobrin_vask` | Tobrin Vask, a young earnest ward-engineer with drafting tools, warm gold accent. |
| `npc_corvin_dreyl` | Captain Corvin Dreyl of the Silverwood Watch, a hard-faced officer in blue and white, warm gold accent. |
| `npc_ilsabet_rhune` | Ilsabet Rhune, Warden of Waters, a sleepless watchful woman with a chain of office and wet sleeves, warm gold accent. |
| `npc_hadrek` | Hadrek the Clockwright, an old orrery-maker with magnifying lenses and brass gears, warm gold accent. |
| `npc_sedge_marrow` | Sedge Marrow, a Remnant diver with a lamp and old diving leathers, pale aqua accent. |
| `npc_pellam` | Pellam, a lamplighter with a long lamp-pole and a lit lantern, pale aqua accent. |
| `npc_scout_ferrin` | Scout Ferrin, a young Nomad gate scout with a horn and an ash-stained cloak, red-orange fire accent. |
| `npc_hadda_ironvow` | Hadda Ironvow, the clan-mother and warchief of the Steppe, an older fierce woman with braids and a bone-and-iron torc, red-orange fire accent. |
| `npc_oma_varr` | Oma Varr, the Steppe's very old teller, wrinkled, kind, wrapped in hides, red-orange fire accent. |
| `npc_tessaly_varr` | Tessaly Varr, a confident caravan master with a ledger and salt-stained coat, red-orange fire accent. |
| `npc_ketch` | Ketch, a Nomad skald with a frame drum and ash-painted face, red-orange fire accent. |
| `npc_sethe_unlidded` | Sethe the Unlidded, a Weaver lieutenant with no eyelids and wide unblinking eyes, grey thread hood, violet accent. |
| `npc_ysmay` | Ysmay, the Thread-Mother, an ancient eyeless woman holding a single thread, grey and violet, violet accent. |
| `npc_hollis_cade` | Hollis Cade, the Weavers' quartermaster in grey thread with a tally cord, violet accent. |
| `npc_elder_wen` | Elder Wen Thistlecourt, a Glowfen elder woman with glowing veins and a reed mat, yellow-green accent. |
| `npc_elder_tam` | Elder Tam, the eldest of Lanternreed, so far into the glow his skin is half light, roots in his beard, yellow-green accent. |
| `npc_old_fennick` | Old Fennick, a wiry old stall-keeper on stilts with baskets of moss, yellow-green accent. |

(`npc_ilyra` is in Tier 0. That makes 38 portraits.)

---

## 6. How the session runs

As Part 1 §6, with these changes:
- **Contact sheets show every sprite twice,** cut out on black and on white, so halos and holes show. Portraits show inside a
  round-cornered frame at 160 px as well as full size, so faces read small.
- **Commit** sprites to `public/art/sprites/` and portraits to `public/art/portraits/`. Message
  `art: <tier> sprites/portraits (Grok Imagine)`; push to **`wip/art`**; never `main` or `unraveling`.
- The cut-out script and any Pillow helpers go in `tools/art/` (committed: they'll be reused for rerolls).

---

## 7. How the game uses them (unit U73a — for reference)

- **Combat** gets a stage: the location's painting as a band across the top, with the player and the active companion on the
  left and the enemies on the right, standing on a floor line. Sprites are scaled from their size class and bob gently; a hit
  flashes white and shakes 2 px, an attack lunges toward the target, and a defeat fades and drops. All of it is off under
  reduced motion. Clicking a sprite targets it. The stat cards stay below.
- **Dialogue** shows the speaker's portrait large over a dimmed copy of the location's painting. **Explore** NPC rows and the
  companion chip use the `@sm` portrait. The **Bestiary** shows the sprite once seen. **Class Select** shows the class sprite.
- **Anomaly variants** reuse their base creature's sprite with a code effect: a double image, a flicker, a tint, or a split.
  The Redundant Wayfinder is the player's own class sprite, greyed and flickering.
- **Fallback:** a missing sprite or portrait shows the code sigil. The family sigil also stays as a corner badge.

---

## 8. Log (one row per approved image)

| id | file | size class | round / pick | facing / mirrored | notes |
|---|---|---|---|---|---|
| `cr_corrupted_shade` | `sprites/cr_corrupted_shade.webp` | medium | a / A4 | left / no | Hands raised, star-blue eyes; faint dark bounce-tint left in the hem. |
| `class_ranger` | `sprites/class_ranger.webp` | medium | a / B4 | right / **mirrored** | All four came back facing left; bow, quiver, belt knives. |
| `cr_wildling_brute` | `sprites/cr_wildling_brute.webp` | large | a / C2 | left / no | Antler skull, ember-lit root cracks, knuckles down. |
| `cr_bell_warden` | `sprites/cr_bell_warden.webp` | huge | a / D3 | left / no | Seated in a pool of lit black water (the pool is part of the figure). |
| `npc_ilyra` | `portraits/npc_ilyra.webp` (+`@sm`) | — | a / E3 | — | Ink on the fingers at her collar, pale-blue rim light. |
| `class_wizard` | `sprites/class_wizard.webp` | medium | a / a2 | right / no | Patched coat, chained grimoire, storm-light thread in the fingers. Enter was swallowed after the aspect menu; sent with the arrow. |
| `class_elf` | `sprites/class_elf.webp` | medium | a / a2 | right / no | Silver-grey leathers, curved blade low, violet ley-light at the wrists. |
| `class_ironclad_warden` | `sprites/class_ironclad_warden.webp` | medium | a / a1 | right / no | Tower shield and short hammer, dented scavenged plate. |
| `class_shadow_weaver` | `sprites/class_shadow_weaver.webp` | medium | a / a1 | right / no | Grey thread robes, violet light from one bare hand. |
| `companion_ilyra` | `sprites/companion_ilyra.webp` | medium | a / a2 | right / **mirrored** | Matches her Tier 0 portrait: hood, satchel of papers, pale-blue crystal staff. |
| `companion_brak` | `sprites/companion_brak.webp` | medium | a / a1 | right / **mirrored** | Leather and scrap armour, chipped axe. |
| `companion_nyx` | `sprites/companion_nyx.webp` | medium | a / a2 | front / no | Faces the camera; violet void-light at both hands. |
| `companion_dask` | `sprites/companion_dask.webp` | medium | a / a1 | right / no | Long travelling coat, hourglass charm. |
| `companion_caelum` | `sprites/companion_caelum.webp` | medium | a / a1 | right / no | Blue-and-white livery, satchel. Grok painted a darker key green (0,125,0); the cut-out measures the border. |
| `companion_mireya` | `sprites/companion_mireya.webp` | medium | a / a1 | right / **mirrored** | 🟣 magenta key. Reed shawl, lantern pole, moss pouches. |
| `cr_mistwood_prowler` | `sprites/cr_mistwood_prowler.webp` | medium | a / a3 | left / no | Low crouch, amber bark-light on the flanks. |
| `cr_rootling` | `sprites/cr_rootling.webp` | small | a / a3 | left / no | Knot-hole face with an amber sap-glow. |
| `cr_drowned_archivist` | `sprites/cr_drowned_archivist.webp` | medium | a / a2 | left / no | Dripping book, aqua lamp at the belt. |
| `cr_stone_hide_golem` | `sprites/cr_stone_hide_golem.webp` | large | a / a3 | front / no | Slate plates, orange core. |
| `cr_warding_pillar` | `sprites/cr_warding_pillar.webp` | medium | a / a1 | — / no | Cracked standing stone, orange ring-and-bar ward. |
| `cr_void_touched_stalker` | `sprites/cr_void_touched_stalker.webp` | medium | a / a1 | left / no | Violet spine-light, star-white eyes. |
| `cr_shimmering_phantom` | `sprites/cr_shimmering_phantom.webp` | medium | a / a1 | left / no | Fanged spectral figure, wavering outline. |
| `cr_moment_moth` | `sprites/cr_moment_moth.webp` | small | a / a1 | left / no | Clockface wings. |
| `cr_aetherial_weaver` | `sprites/cr_aetherial_weaver.webp` | medium | a / a4 | front / no | Crystal body, white strands between the fingers. |
| `cr_sky_whisper_sentinel` | `sprites/cr_sky_whisper_sentinel.webp` | large | a / a4 | left / no | Cloud hood, wind-cut stone blade. |
| `cr_glowfen_mireling` | `sprites/cr_glowfen_mireling.webp` | medium | a / a1 | left / no | 🟣 magenta key, `--tol 130 --erode 2`; a1 had the least pink fringe on the spines. |
| `cr_temporal_aberration` | `sprites/cr_temporal_aberration.webp` | large | a / a4 | left / no | Hourglass torso. `--erode 3` strips a painted light outline; X2 had a green tint. |
| `cr_horde_husk` | `sprites/cr_horde_husk.webp` | medium | a / a1 | left / no | Faceless hood unravelling into threads. |
| `cr_unraveling_tide` | `sprites/cr_unraveling_tide.webp` | huge | a / a1 | left / no | Wall of grey threads, violet crest, reaching hands. |
| `cr_chronos_tyrant_contained` | `sprites/cr_chronos_tyrant_contained.webp` | huge | a / a3 | front / no | One great eye, light bands spiralling round it. |
| `cr_chronos_tyrant_unveiled` | `sprites/cr_chronos_tyrant_unveiled.webp` | huge | a / a2 | front / no | Crystal crown, five faces surfacing in the mass. |
| `cr_tyrants_reach` | `sprites/cr_tyrants_reach.webp` | large | a / a4 | left / no | The only pick that is just an arm; the others grew legs or a body. |
| `cr_unbroken_warden` | `sprites/cr_unbroken_warden.webp` | huge | a / a1 | left / no | Stands on a stair plinth (part of the figure); nine-sided shield. |
| `cr_ashmaw` | `sprites/cr_ashmaw.webp` | huge | a / a1 | left / no | Fused bison mass, red-orange coal cracks. |
| `cr_vells_umbra` | `sprites/cr_vells_umbra.webp` | huge | a / a1 | left / no | Woman's silhouette in shadow, violet edges. |
| `cr_lantern_matron` | `sprites/cr_lantern_matron.webp` | huge | a / a1 | left / no | 🟣 magenta key. Hill of lanterns, sorrowful face; saved at q70 to stay under 120 kB. |
| `cr_stormcrown` | `sprites/cr_stormcrown.webp` | huge | a / a2 | left / no | Storm-glass crown, lightning across the armour. |
| `cr_unmade` | `sprites/cr_unmade.webp` | medium | a / a1 | left / no | Hooded void with violet seams. |
| `cr_veil_sentry` | `sprites/cr_veil_sentry.webp` | medium | a / a4 | left / no | Thread-staff, hooded; a1 had green specks at the feet. |
| `cr_orrery_knight` | `sprites/cr_orrery_knight.webp` | large | a / a1 | left / **mirrored** | Orrery chest with a gold core, tall halberd. |
| `cr_ninefold_knight` | `sprites/cr_ninefold_knight.webp` | large | a / a1 | left / no | Empty silver plate, ring-and-bar shield. |
| `cr_city_watch_halberdier` | `sprites/cr_city_watch_halberdier.webp` | medium | a / a1 | left / **mirrored** | Blue-and-white livery, steel cap, halberd. |
| `cr_circle_adept` | `sprites/cr_circle_adept.webp` | medium | a / a1 | left / no | Grey robes, violet spell between the hands. |
| `cr_tide_clerk` | `sprites/cr_tide_clerk.webp` | medium | a / a1 | left / no | Waterlogged coat, ledger, aqua light. |
| `cr_pale_diver` | `sprites/cr_pale_diver.webp` | medium | a / a1 | left / no | Brass helmet with the visor open, green-lit lamp. |
| `cr_reed_stalker` | `sprites/cr_reed_stalker.webp` | large | a / a1 | left / no | 🟣 magenta key. Grey-green heron, violet breast-light. |

**Session notes (Tier 0, 2026-10-25).** Both locks worked as written. Aspect: **2:3** for upright figures, **1:1** for wide or
seated ones and for portraits. Grok often ignores "facing right"; mirroring is cheap (Ranger). `tools/art/cutout.py` keys the
background, erodes the fringe, then removes Grok's green *bounce light* within ~10 px of the outline using a hue-ratio test that
leaves olive moss and yellow-green glow alone. `tools/art/sheet.py` builds the black/white screening sheets and
`tools/art/portrait.py` the 512/160 crops.

**Session notes (Tier 1 and the first Tier 2 sprites, 2026-10-25).**
- **Facing is a hard rule:** heroes and companions face **right**, creatures face **left**, so the two sides face each other
  on the combat stage. Grok's three-quarter view often turns the head the other way, so every cut is checked for facing and
  mirrored in Pillow (`cutout.py --mirror`) when needed. A figure that faces the camera is left as it is.
- **Non-humanoid lock:** "the whole figure from head to feet" makes beasts and things into robed people. For anything that
  isn't person-shaped, replace that phrase with "the whole creature from end to end in three-quarter view".
- **Cut-out additions:** the key is measured from the image border, because Grok sometimes paints a darker green.
  `--erode N` shaves a painted light outline (the "sticker" rim on the Temporal Aberration).
- **Still to do:** `cr_arcane_wisp` (Tier 1) needs a reroll; the other 21 Tier 2 creatures and all 37 portraits have not
  been made yet.
