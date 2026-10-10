# Brief W-B: WORLD.md §7 Items, §8 Crafting, §9 Merchants

Agent type: general-purpose. Deliverable: `/home/claude/aethelgard/docs/world/07-09-items-crafting-merchants.md`
(create `docs/world/`). Two sibling agents are writing §4–6 (NPCs, creatures) and §10–13 into other
files at the same time; the lead merges them into WORLD.md afterwards. Do NOT edit WORLD.md or any other
existing file. When done, commit only your file per `docs/briefs/COMMIT.md`.

You are the itemization and crafting designer for "Echoes of Aethelgard: The Unraveling", a time-loop
web RPG rebuilt from a Python text RPG.

## Read first
1. `docs/DECISIONS.md` — CANON, all of it. Critical: D-044 (typed-prefix ids: `item_`, `mat_`,
   `recipe_`), **D-062 (precedence: DESIGN owns item mechanics/materials/affixes/economy numbers; WORLD
   owns placement; STORY owns quest items' story role)**, D-047 (Amulet of Echoes exempt from reset;
   grants `itm_echo_bolt`), D-052 (two Heartstone fragments + `recipe_breach_anchor`), D-055 (Dark
   Spellbook drop rule), D-057 (restock at dawn), D-063/D-064 (renamed NPCs, e.g. `npc_hollis_cade`).
2. `docs/DESIGN.md` §7 (items: slots weapon/armor/trinket×2, item types, rarity tiers and multipliers,
   12 affixes with ids, inventory/stack rules, **the 139-item budget: 30 weapons, 18 armor, 20 trinkets,
   16 consumables, 21 materials, 14 quest, 6 keys, 10 recipes, 4 tomes**), §5 (weapon types and basic
   attacks per class: melee, ranged_bow, magic_staff, shield/heavy, void_focus), §8 (crafting: material
   ids, recipe format, upgrade/salvage formulas, Breach-anchor, void-forged line), §9 (economy: price
   formulas, faction tier modifiers, gold per loop), §10 (Echo-gated shortcuts that reference items).
3. `docs/WORLD.md` §1–3 — every item placed in a location (`item_*`), every merchant flag
   (`Merchant: yes (npc_…)`), regions and level bands.
4. `docs/STORY.md` §11 (quest catalog — every reward/required item), §12 (Echo ids for gating),
   §9 (Silverwood Before anchors, Caelum's token).
5. `aethelgard_data.py` — the 26 legacy items (exact names, descriptions, numbers).

## Write
### §7 Items (target 139, minimum 120)
Keep all 26 legacy items: exact names and descriptions; ids per D-044 (e.g. `item_rusty_dagger`,
`item_amulet_of_echoes`, `item_ley_touched_tonic`, `item_chronos_lens`, `item_dark_spellbook`);
rebalanced numbers allowed, legacy numbers noted. Define every `item_*` id referenced in WORLD §3,
STORY, and DESIGN (keep DESIGN's id when DESIGN names an item; if two docs name the same thing with
different ids, use DESIGN's for mechanics and list the alias in Errata). Use DESIGN §8's `mat_*` ids
for materials exactly. Tables per type (weapons by weapon type; armor; trinkets; consumables; materials;
quest; keys; recipes; tomes): id · name · slot/type · tier 1–5 · rarity rule (fixed / rollable) ·
stats and effects in DESIGN's field names (damage, defense, strength/magic/agility, damageType, onHit
status id + chance, resist/weak grants, mana_cost_reduction_percent, life_steal_percent, heal/mana
amounts, grantsAbility, etc.) · value (gold) · sources (`loc_`/`cr_`/`npc_`/`recipe_`/`q_` ids) ·
description (1–2 sentences, house voice). Every class must have usable weapons at every tier.
Must include: `item_breach_anchor`, `item_stabilized_heartstone`, `item_heartstone_core`,
`item_heartstone_fragment_stable`, `item_heartstone_fragment_dead`, `item_chronos_lens`, Caelum's
anchor token, the void-forged line (3 items from kept Void Shards), any schematic halves WORLD §3
places (e.g. `item_breach_anchor_schematic_b`), and a ruling on physical Litany pages (STORY §12
treats verses as Echoes; if WORLD §3 places `item_litany_page_*`, define them as quest items that
grant the verse Echo on reading, or recommend removal in Errata).
Creature drop sources: reference creature ids from WORLD §3 encounters; a sibling agent is defining
those creatures now and will list a few unique drops of its own — do not worry about those.

### §8 Crafting
Materials table (DESIGN §8 ids: name, tier, source families/locations). 30 recipes `recipe_*`:
output item, inputs with counts, gold fee, required Ironclad rep tier, required Echo/flag if any.
Include `recipe_breach_anchor` exactly per D-052 / DESIGN §8.5, the void-forged line, Ley-tuned
crafting unlocked by Heartstone Stabilize (D-017), and recipes for each class's tier 4–5 gear.
Reference DESIGN for upgrade and salvage formulas (do not restate them differently).

### §9 Merchants
For every merchant NPC flagged in WORLD §3 (and `npc_kaelen_stonehand`, `npc_borin_stonefist` as
crafter): stock table (item ids, quantity, restock at dawn per D-057), what they buy, price modifiers
(DESIGN §9 faction tiers), rep-gated stock. Ensure every region band has affordable healing and at least
one weapon upgrade path per class; ensure "never soft-locked by poverty" (DESIGN §9).

### Appendix to your file
- **Errata for §1–3** and id aliases found (doc → canonical id).
- **Open questions (§7–9)**.

Verify before committing (grep): every `item_*`/`mat_*` id referenced in WORLD §3, STORY, and DESIGN
§7–8 is defined in your file; counts per type meet the budget. Reply with counts by type, recipes,
merchants, aliases, open questions.
