# REVIEW — DESIGN.md + PLAN.md (U6: blockers and majors only)

Reviewer: U6 agent, 2026-10-13. Scope per `docs/briefs/review-design-plan.md`. Canon: DECISIONS D-001..D-065.
WORLD §6 creature stats and §10.8–10.10 timing were used for every number check.

## Summary

22 findings: **3 Blocker, 19 Major**. The systems hang together, but four things would ship a wrong game.
(1) The Contained Tyrant is about twice its 12–18-round target. Rewind every third step erases two thirds
of the damage in P2/P3, and three of five classes have no answer to it. A solo L13 player loses. (2) The
Wizard's 10% regen pays for any Tier-1 spell from level 1, and Fireball is 1.6U plus Burn, so the Echo
Bolt problem is back. (3) PLAN's creature, intent, item and stat schemas can't hold DESIGN/WORLD data:
there is no ordered pattern, no armor/ward, no SP and no affixes. They must be redone before the C1
freeze. (4) Loop-closer flow, communion and the Apex gate still contradict D-049, D-054, D-060 and
D-048. The D-044/D-065 PLAN rewrite is one finding (16).

## Fight checks (hand-computed expected values; DESIGN §3–5 formulas, WORLD §6 stats)

| Fight | Player kills foe in | Foe kills player in | §19 target | Verdict |
|---|---|---|---|---|
| L1 Ranger (ATK 14) vs Corrupted Shade (36 HP) | 3–4 turns (basic 11.8/turn; Rend 3) | 21 | fodder 3–5 | OK |
| L1 Wizard (SP 13) vs Wildling Brute L4 (64 HP, weak fire) | **2** (Fireball 34 ×2 + Burn 6) | 11 | fodder 3–5 | **Too short**. Fireball is 1.63U + Burn ≈ 2.9U for 12 MP. Regen 8/turn ≥ cost (F4) |
| L4 Elf (ATK 12, bow) vs 2× Arcane Wisp (34 HP) | 5 (Ambush r1 29, Twin 14.5, basic 10.8) | ~12 | pair 5–8 | OK (lower edge) |
| L8 Warden (ATK 27) vs Stone-Hide Golem (130 HP, 6 armor) | ~6 (heavy basic 20, Crushing 24; Harden strips Armor Break every other turn) | 27 | elite 6–9 | OK |
| L12 Weaver (SP 28) vs Temporal Aberration (280 HP, weak void) | 5 (Void Lance 69, self-cost 14/cast) | ~7 counting self-costs | elite 6–9 | Short but OK; Weaver ends the fight at ~25% HP |
| L13 Ranger (ATK 35, solo) vs Contained Tyrant P1 (184 HP of 540) | 4–5 (51/turn; WORLD Brace −13/turn) | 11 (DESIGN) / 22 (WORLD) | P1 share of 12–18 | P1 OK. **Whole fight ≈ 22–28 rounds**. P2 incoming ≈ 50/turn → the solo player loses (F1) |

---

## Blockers

### 1. The Contained Tyrant is unwinnable as tuned, and the Loop 1 level claim is off
- **Severity:** Blocker
- **Where:** DESIGN §4.10 (`tyr_remember` "every 3rd step"; P2 "spawn 2× temporal_aberration at 60% HP"; P3 "<33% or turn 14"), §6.6 ("540 HP vs … ~45/turn ≈ 12–18 turns"), §6.1 ("five legacy regions ends at level 12–13"); WORLD §6.8 (Brace, Aulde shield, Sallow regen).
- **Problem:**
  - §6.6 divides 540 by 45 and ignores everything else in the fight. The two Aberration adds bring 336 HP. Brace, Aulde and Sallow add ~150 shield/regen. Rewind (HP = max(now, snapshot) after 2 turns) every 3rd step undoes ~⅔ of the damage in P2/P3.
  - Only Void consumes Rewind. Ranger, Wizard and Elf have no Void, and the Warden's Iron Silence is L16. Effective HP is about 1,400, or 28+ rounds.
  - In P2 the adds plus the Tyrant deal ~50/turn against a 240-HP L13 Ranger.
  - "turn 14" is ambiguous: §0 defines a turn as one combatant's action.
  - XP math: a legacy-regions-only thorough Loop 1 gives ≈5,200 XP (L10–11). Only WORLD route T1, with its three side regions, gives L12–13. The speedrunner gets ≈3,700 XP (L9), which contradicts §19 #11 "≥10".
- **Proposed fix:**
  - `tyr_remember` fires once per phase (P2, P3).
  - Boss Rewind restores at most 10% max HP.
  - Rewind is consumed by Void **or Ley**, so `itm_echo_bolt` (D-047) is every class's answer.
  - P2 adds: 2× Aberration at 40% HP, only 1 with no companion.
  - Brace becomes 0.6×SP and Aulde 1.0×SP; Sallow regen is dropped from the Contained form.
  - HP 540 → 460. Triggers are counted in rounds (P3 at round 12).
  - Tune for L11 (§19 #11: explorer 11–13, speedrunner ≥ 9).
  - Target effective HP ≤ 850 (≈18 rounds at 47/turn). The sim confirms at L11 and L13.

### 2. PLAN's creature/intent/phase schema implements a different AI model than DESIGN
- **Severity:** Blocker
- **Where:** PLAN §5.4 (`IntentSchema` with `weight`, `cooldown`, `when: CombatWhenSchema`; `PhaseSchema.trigger` single union); §4.2 `Intent` (no `hidden`, no projected range). DESIGN §4.2 (`pattern: Step[]`, pointer, `if/weighted/repeat/phase_hold`, "Generation = commitment"), §4.10 (`enterWhen: Trigger[]`, `resolveAtLeast`, `interruptible`).
- **Problem:**
  - PLAN picks intents randomly by weight. DESIGN uses a deterministic ordered pattern evaluated at generation time, which is what makes intents legible (P3).
  - WORLD authored every creature with pattern cadence: `everyNthTurn`, `first`, `once per fight`, `ifAllyPresent`, highest-MAG target, "alternates".
  - The PLAN schema can't express these, nor OR-triggers ("<33% or round 14"), hidden intents, Stagger, `revive`, `riposte`, "shield ally" or "remove own status" (STATUS U1/U2).
  - `family` enum ≠ WORLD's 8 `fam_*`. `stats.def`/`mag` ≠ armor/ward/SP.
  - W3 and W8 would build incompatible halves.
- **Proposed fix:**
  - Replace `intents[]` with DESIGN's `pattern: Step[]` plus a `moves: Record<id, Move>` table.
  - Step conditions use `CombatWhen` and add `everyNth`, `first`, `oncePerFight`, `allyPresent`, `targetRule: highest_mag | marked_first | taunter`.
  - `Move` gains `hidden`, `revive`, `riposte`, `shieldAlly`, `cleanseSelf`.
  - `phases[].enterWhen: Trigger[]` with OR semantics, counted in rounds.
  - Add `interruptible`, `statusImmunities`, `tauntImmune`.
  - Family is `fam_*`. Stats are `{hp, atk, sp, armor, ward, agi}`.
  - `Intent` stores `{moveId, targetUid, projected:[min,max], hidden}`.

### 3. PLAN's item/combatant/ability model can't hold DESIGN's numbers
- **Severity:** Blocker
- **Where:** PLAN §4.2 `ItemInstance` (`upgrade: number`, no affixes), `Combatant.def`, `resistances … 'normal'`; §5.5 `ItemSchema` (`type` lacks `recipe`, has `book`; `weaponType` lacks `shield_heavy`; `stats.def`; `magic_resist_pct`); §5.7 (`power.scaleStat: str|mag|agi`; `resource.generation` single enum + `amount`). DESIGN §3.2 (ATK = STR+weapon, SP = MAG+spell_power, armor vs ward), §5.7 weapon types, §7.1–7.3 rarity + affixes, §5.2–5.6 class resources.
- **Problem:**
  - Affixes (a core loot system), the armor/ward split, spell power, the five weapon types, and abilities scaling on ATK/SP all have no field. The same goes for multi-hit with per-hit crit, conditional multipliers (vs Marked, round 1, missing HP), kill refunds, % HP self-costs, and multi-trigger resource rules (Ranger 8/12/5, Elf 10/6/5, Warden 6/8/4).
  - Saves would drop affixed gear.
  - WORLD's "DEF 1/2" and items' "armor 2, ward 1" can't be authored.
- **Proposed fix:**
  - `ItemInstance {uid, itemId, qty, rarity, affixes: AffixId[]}`. Delete `upgrade`, since rarity is the upgrade ladder per DESIGN §8.3.
  - Item `stats {power, spellPower, armor, ward, str, mag, agi, hpMax, mpMax}`.
  - `weaponType: melee|ranged_bow|magic_staff|shield_heavy|void_focus`; `type` uses DESIGN §7.1's nine.
  - Ability `power {base, coef, stat: 'atk'|'sp', hits, perHitCrit}`, `bonuses: {when: CombatWhen, mult}[]`, `selfCost {hpPctMax?, hpPctCur?}`, `onKill {refundMp?, refundHp?}`.
  - `ClassSchema.resource.rules: {on: 'basic_hit'|'crit'|'guard'|'hit_taken'|'dodge'|'taunt'|'turn_start', amount | pctMax}[]`.
  - Resistance enum `weak|neutral|resist|immune`.

## Majors — DESIGN

### 4. Caster resources don't bind, and Tier-1 budgets are broken (the Echo Bolt problem returns)
- **Severity:** Major
- **Where:** DESIGN §5.3 ("regenerates 10% of max MP … each of your turns"), `fireball` "1.5·SP + 4 … Burn 100%", §5.6 `wvr_void_lance` "1.6·SP + 4", §5.4 `elf_ambush` "×1.5 if … round 1", §5.1 budget "T1 ≈ 1.2–1.3U for 8 MP", §19 #2/#12.
- **Problem:**
  - L1 Wizard regen is 8/turn; Echo Bolt costs 7 and Fireball 11 (staff). At L12 regen is 15. The Wizard never needs the cantrip.
  - Fireball is 1.63U plus Burn 6+0.9·SP. DESIGN's own note says "≈0.9·SP", which leaves out the flat 6. Total ≈ 2.9U for 12 MP.
  - Void Lance is 2.05U at T1. Ambush's "round 1" clause is satisfied in every fight.
  - Result: §19 #12 (abilities 40–60% of actions) fails for the Wizard by construction, and #2 (≤35%) likely fails for Fireball/Void Lance.
- **Proposed fix:**
  - Wizard regen `3 + ⌊level/4⌋` MP per turn.
  - `wiz_fireball` 10 MP, `1.2·SP+3`, Burn 60%. Burn tick `1 + 0.2·SP` for every source.
  - `wiz_echo_bolt` 10 MP (the legacy cost), `1.1·SP+2`.
  - Void Lance `1.3·SP+3` (keeps the HP cost).
  - Ambush ×1.5 only if the Elf acts before the target this fight.
  - §19 #12 becomes per-class bands (casters 55–80%).

### 5. Status-duration rule erases self-buffs; DoT resistance is unspecified
- **Severity:** Major
- **Where:** DESIGN §4.5 ("decrement at the end of its turn"), §4.1 step 3; §4.12 round 4 ("Its Phase is unused; expires end of its turn" — contradicts the rule).
- **Problem:**
  - A status applied to yourself on your own turn decrements at the end of that same turn. Shadowstep, Gale Step, Breach Echo and Veilwalk Phase 1 vanish before any enemy acts.
  - Haste 2, Hunter's Eye 3, Dancer's Guard 2 and Apex Predator 4 each lose one turn.
  - It's unstated whether Burn/Curse ticks take weakness/resistance, ward or Guard. That swings ticks ×0.5 to ×1.5.
- **Proposed fix:**
  - "A status does not decrement at the end of the turn in which it was applied to the afflicted during the afflicted's own turn."
  - Ticks apply the type's resistance step. Ticks never apply armor/ward or Guard; Poison also ignores resistance (as written).

### 6. Blood price and self-costs are free at low HP
- **Severity:** Major
- **Where:** DESIGN §5.6 ("paying 2 HP per missing MP (cannot reduce you below 1 HP)"); % HP costs on Void Lance, Pyre of the Nine, Collapse, Ninefold Hex, Blood Pact.
- **Problem:** Read literally, a Weaver at 2 HP and 0 MP casts a 30-MP capstone for 1 HP, then heals with Siphon. The loop repeats indefinitely. The % HP costs don't say what happens when HP ≤ cost.
- **Proposed fix:** An ability whose HP cost (Blood price or self-cost) is ≥ current HP is unavailable; the tile reads "Not enough blood". Self-costs never kill.

### 7. Communion contradicts D-054 (Resolve 0–8, three Movements)
- **Severity:** Major
- **Where:** DESIGN §4.11 ("`resolve` (0–100)", Speak/Listen/Offer/Resist, "≥ 100 → tyr_stillness"), §10.1 ("resolve ≥ 50 … +2 days"), §10.5 (`echo_tyrant_communion` at 50, `echo_unbound_door` ≥ 75), §15.2 `ach_commune` "resolve 100". STORY §8.3 (0–9; reject "< 3 at any movement's end", STATUS OQ).
- **Problem:**
  - DESIGN still runs the replaced 0–100 meter, and STORY says 0–9 against D-054's 0–8.
  - F at ≥75 conflicts with D-054's ≥3. Unveiled has 4 phases but there are 3 Movements.
  - Starting at 0 with a reject at the end of Movement I means Movement I needs 3/3 perfect answers.
- **Proposed fix:**
  - Integer Resolve 0–8, starting at 1, using STORY's questions (+1 good, +2 for Hallow's silence, −2 for a lie).
  - Reject is checked only at the ends of Movements II and III.
  - Tyrant intents pause during a Movement. P4 has no Movement (communion closes at P3's end).
  - +2 days and `echo_tyrant_communion` at ≥ 4. F at ≥ 3, A at ≥ 6, B at 8 (D-054).
  - `ach_commune` at 8.
  - Add the `{resolve:{min}}` condition and `resolve` effect.

### 8. Loop-closer flow violates D-049 and D-060
- **Severity:** Major
- **Where:** DESIGN §2.2 table and §2.4 (Loop 1 Escape/Fall → Threshold), §10.2 ("Scripted, no fight … → Threshold"), PLAN §4.6 rule 5, §4.11, §1.3 flow ("portal → Threshold → spend Resonance → new loop").
- **Problem:**
  - D-049: Loop 1 → Loop 2 skips the Threshold.
  - D-060: clock expiry runs the Horde infection and closes by portal or death; it isn't a scripted cutscene.
  - Unruled: a Loop 1 clock-Horde death would be a classic game over (D-049), which defeats D-005's "they still reach Loop 2".
- **Proposed fix:**
  - Both Loop 1 closers go straight to Loop 2 Day 1. Resonance is banked and first spendable at Loop 2's end.
  - At expiry: Horde from the Apex with a 3-move delay (WORLD R10-3), and Ilyra's portal opens at the Shattered Library.
  - Any death during an expiry Horde (Loop 1 included) is `closer_fall`.
  - Fix the PLAN mode table and the e2e flow to match.

### 9. Clock modifiers can end a loop instantly; Ending E fails under Frayed Clock
- **Severity:** Major
- **Where:** DESIGN §10.1 modifier table; WORLD §10.8 (Destroy → limit D20 vs thorough Apex D22) and §10.10 #1–2; STORY `q_long_archive` "Day 29"; STATUS U3.
- **Problem:**
  - Destroy (−10) taken after Day 20, or Corruption 6 near the end, puts the limit in the past. That means an immediate Fall with no warning, in Loop 1 where the clock is subtle.
  - `mod_frayed_clock` gives E a limit of D23, so "Day 29" is unreachable.
- **Proposed fix:**
  - A clock effect can't set the limit earlier than the current day + 3 dawns.
  - In Loop 1, Borin/Brak says the new count aloud after Destroy.
  - E's stage condition becomes `{ clock: { daysLeft: { max: 1 } } }` (the last dawn before collapse).

### 10. Silverwood Before has no time model in DESIGN or PLAN
- **Severity:** Major
- **Where:** DESIGN §10.1 ("Silverwood Before is time-locked: no watch passes there"); PLAN §4.2/§4.11 (none). STORY §9 (Day −3..−1, ritual at dusk Day −1, "the echo resets to Day −3", four attempts of `q_stop_the_ritual` "one per reset"); WORLD §3.11/§12.1 (`flag_before_day_1..3`, rest at the Garret advances a day).
- **Problem:** Quests, Caelum recruitment, gates and world-state variants all key off a Before day and resets that no engine contract or condition kind exposes. The undefined parts:
  - what resets inside the Before and what persists;
  - whether you can rest there;
  - what happens if the ritual fires while you're inside.
- **Proposed fix:**
  - `state.before = { day: 1|2|3, watch, resets, persist: string[] }`. The Breach Clock is frozen inside.
  - Resting at the Garret advances the Before day. The ninth verse at Last Bell dusk resets to Day 1 and increments `resets`.
  - Before-local flags, items and enemies reset. Echoes, inventory, Conflux anchors and Caelum's memory persist.
  - Conditions `{ beforeDay }` and `{ beforeResets: {min} }`.

### 11. The Breach-anchor breaks "no ending requires gold" and can strand B/D
- **Severity:** Major
- **Where:** DESIGN §8.5 (`recipe_breach_anchor` 300 gold, Ironclad Trusted, `mat_ember_ore ×5`) vs §9.6 rule 5 ("No quest, exit, ending or Echo requires gold"); §8.2 (vein 3/loop); WORLD §10.9 B route (no Steppe visit); STATUS OQ (fee, two fragments).
- **Problem:** A focused Loop 3+ B/D run reaches the forge around Day 6–8 with about 150–250 g, 3 ore and possibly Ironclad Neutral. Ending B is then blocked by poverty and a tier gate. Mireya's dam and the anchor both want the single fragment.
- **Proposed fix:**
  - Story recipes cost 0 gold; the tier gate is waived while `q_the_mending` or `q_iron_silence` is active.
  - Ember ore ×3.
  - Each Heartstone choice yields 2 fragments.

### 12. Fixed encounters on through-routes have no non-combat bypass
- **Severity:** Major
- **Where:** DESIGN §4.7 (flee → previous node; "the encounter remains … until the next dawn"); WORLD §10.4–10.6 (scatter proposal; Lamplighters' Rest unreachable for pacifists); D-037 "every location reached".
- **Problem:** A pacifist (or a weak character) who flees a fixed group guarding a corridor can never pass it. That's a soft-lock for the pacifist bot and Pacifist's Vow, and it blocks the "every location" gate.
- **Proposed fix:** Accept WORLD's rule into §4.7: only bosses and story-gate fights are unfleeable. A fled fixed non-boss group scatters for the loop (+2 watches, no XP/loot), and the node becomes passable.

### 13. Companions are underspecified (MP, Dask, scaling)
- **Severity:** Major
- **Where:** DESIGN §4.9 ("Companion MP regenerates 10% per turn", `mp(c,a)` checks), §12.3 (no MP column), §12.4 (no costs), §12.8 (`allowedRegions` incl. all of `region_glowlands_nexus`) vs D-059 (per-location flag, Nexus/Apex only, plus infected nodes); "Their level equals the player's" with per-level rows only for HP/ATK/SP.
- **Problem:**
  - Stance AI depends on MP that doesn't exist.
  - Dask's rule contradicts canon (WORLD §12.3 gap X8).
  - Armor/ward/AGI growth is undefined at L12+.
- **Proposed fix:**
  - Companions have no MP. Auto abilities get cooldowns: attack 0, debuff/aoe 2, heal/shield 3. Delete the `mp` checks.
  - Dask: `location.temporallyUnstable || infected` (D-059); delete `allowedRegions`.
  - Companion armor/ward +1 per 4 levels; AGI fixed.

### 14. Keyboard map has destructive collisions
- **Severity:** Major
- **Where:** DESIGN §4.1 ("Companion command | `C`"), §16.4 (`C` codex; "WASD/arrows navigate map and lists"), §16.3 Inventory ("D drop"), Merchant ("B/S switch" vs `B` bestiary).
- **Problem:**
  - In combat, pressing `C` to read the codex spends the turn on the companion signature.
  - In the inventory list, `D` both moves right and drops the selected item.
  - These violate D-035's intent of predictable keys.
- **Proposed fix:**
  - Combat claims `C/I/G/F`; panel keys need Shift in combat.
  - Drop is `Delete` with a confirm.
  - WASD works only on the map; lists use arrows. Merchant tabs use `Tab`.

### 15. DESIGN conformance roll-up (ids and decisions after D-040)
- **Severity:** Major
- **Where / Problem:**
  - D-044/D-061: `rng_*` → `rgr_*`; `fireball`/`lightning_bolt`/`echo_bolt` → `wiz_*`; `dmg_physical` → `physical`; creatures lack `cr_`; quests `echo_crystal`, `quest_*` → STORY's `q_*` (a quest id starting `echo_` is ambiguous); `comp_ilyra` (companion) → `ilyra`.
  - D-064: `npc_kaelen` etc. → WORLD ids.
  - D-047: no `itm_echo_bolt`, and §10.3 discards the Amulet.
  - D-048: §13.3 ex. 7 `{loop:{min:2}} OR stat questsCompleted` opens the Apex unconditionally in Loop 2+.
  - D-055: Shade spellbook 50% (§4.12, §20 Q7).
  - D-058: save `version: 3`.
  - D-065: §16.7 axe-core.
  - D-062: Echo ids not in STORY §12 (e.g. `echo_tyrant_name`, `echo_breach_clock`).
- **Proposed fix:** U8 runs one mechanical sweep using REVIEW-CROSS's registry:
  - add `itm_echo_bolt` (10 MP, Ley, `0.9·ATK` or `4+0.8·SP`, whichever is higher; consumes Rewind per F1);
  - Apex gate exactly as D-048;
  - first Shade 100%;
  - save `version: 1`;
  - in-repo a11y checks.

## Majors — PLAN

### 16. PLAN rewrite for D-044/D-065 (single finding; checklist)
- **Severity:** Major
- **Where / Problem / Fix — sections to rewrite:**
  - §1.1 gates: ESLint/Prettier/vitest coverage → `tools/lint.ts`, `.editorconfig`, `bun test` + `bunfig.toml` thresholds.
  - §1.3, §8.4: axe → in-repo checks (token contrast test, `getByRole` name/role queries, focus-order walk).
  - §2, §2.3: dependency-cruiser isn't installed → a layer-import rule in `tools/lint.ts`. Add `src/types/react.d.ts`, `src/types/bun-test.d.ts`, `tools/{build,dev,link-local-deps}`. `src/App.tsx` vs `src/ui/App.tsx` path is inconsistent.
  - §3.1–3.7: exact pins (esbuild 0.28.2, typescript 6.0.3, react/react-dom 19.2.8, zod 3.25.76, playwright 1.56.0; import from `playwright/test`, since `@playwright/test` is absent). Delete the vite/vitest/eslint configs. `webServer` serves `dist/` statically.
  - §4.0, §4.6: immer → `structuredClone` (clone the profile lazily, only when a reducer touches it); drop `configureEngine/autoFreeze`; add a dev-only deep-freeze of returned objects.
  - §5.17, Appendix A, A.6: typed ids (`loc_whispering_ruins`, `item_amulet_of_echoes`, `npc_ilyra`, `region_*`, `cr_*`, `q_*`, `ending_*`/`closer_*`, `status_*`, full `echo_*`).
  - §7: tsx → bun; re-measure the 60 µs/step budget with `structuredClone` (expect 150–300 µs; still ≤ 10 min for 2,000 runs on 8 workers).
  - §8.2: `expect.soft` → custom soft collector.
  - §8.3: no jsdom/RTL → component behaviour moves to Playwright against a `?gallery=` page, plus `react-dom/server` snapshot tests in bun.
  - §8.3: `import.meta.env.DEV`/`VITE_E2E` → esbuild `define`.
  - §9.4 briefs W1/W7/W11/W12/W15/W16/W18/W19: `npm view`, depcruise, vitest smoke render, jsdom AudioContext mock.
  - §11: no lockfile → `npm install` (not `npm ci`, no `cache: npm`), `oven-sh/setup-bun`, Playwright version read from `playwright/package.json`, `bun test`, `bun tools/build.ts`, static preview. `VITE_BASE` is moot with relative URLs (D-065).

### 17. PLAN §4.10/§4.11 formulas contradict DESIGN (the owner per D-062)
- **Severity:** Major
- **Where:** PLAN §4.10 (hit `70+2·agi−1.5·defAgi` 25–97; spells "always hit"; crit cap 50; `rng.int(−v,+v)` variance; `magicResist`; armor_break ×1.25; curse outgoing ×0.85; invented interplays "fire on bleed", "physical on shock"; resource numbers; legacy flee; XP `100+25(L−1)`, +10/+5 per level); "Mastery … `ceil(pointCost/2)`"; §4.11 "`day > clockLimitDays`"; §5.15 `restockEveryDays` 3, hostile ×1.5, `sellMult` 0.5; §5.16 resonance values.
- **Problem:**
  - W3 is briefed from §4.10, so it would build the wrong combat.
  - `ceil(1/2) = 1`, so mastery gives no discount on 12 of 15 abilities.
  - The clock fires a day late (Day 31 vs DESIGN's Day 30 Dawn, tick 116).
  - Restock, XP, tier prices and Resonance contradict D-056/D-057 and DESIGN §9/§10.6.
- **Proposed fix:**
  - Replace §4.10 with "implement DESIGN §3.2, §4.1–4.8, §5.1, §6.1–6.4 exactly"; keep only the engine-shape notes.
  - AP in half-points.
  - Clock in ticks with `limitTicks`.
  - Merchant restock at dawn; prices/sell per DESIGN §9.2; config defaults from DESIGN tables.

### 18. Condition/Effect shapes differ between DESIGN examples and PLAN zod (and the clock unit is ×4 off)
- **Severity:** Major
- **Where:** DESIGN §13.3 (`{quest:{id,status}}`, `{item:{id,count}}`, `{killed:{enemy,count,sinceStage}}`, `{questAdvance:{quest,stage}}`, `{giveItem:{item,count}}`, `{clock:-40}` "in watches", `stat: "loyalty.comp_mireya"`, `stat: "questsCompleted"`) vs PLAN §4.9 (`{quest, stage}`, `{item, count}`, `{killed, count}`, `{questAdvance, stage}`, `{clock}` "± days", `.strict()`).
- **Problem:**
  - Content copied from DESIGN fails PLAN validation.
  - Worse, `{clock:-40}` read as days is a −40-day Destroy.
  - D-048 uses `counter`, which isn't in DESIGN's list. DESIGN misuses `stat` for loyalty and counters.
  - Missing: `sinceStage`, `resolve`, `daysLeft`, `beforeDay`, `unlockRecipe`, `codex`.
- **Proposed fix:**
  - One canonical shape table, written into DESIGN §13.3 and PLAN §4.9:
    - object forms `{quest:{id,stage?,status?}}`, `{item:{id,count?}}`, `{killed:{id,count?,sinceStage?}}`;
    - `clock` effect in **watches**, named `clockWatches`;
    - conditions `counter`, `loyalty`, `resolve`, `clock.daysLeft`, `beforeDay`;
    - effects `unlockRecipe`, `unlockCodex`, `resolve`.
  - `stat` is restricted to `strength|magic|agility` (D-044).

### 19. GameState/Profile/Action contracts are missing DESIGN state
- **Severity:** Major
- **Where:** PLAN §4.2–§4.4 vs DESIGN §3.2, §4.7, §6.3, §8.2–8.4, §10.7, §14.1.
- **Problem:** Not representable today:
  - **Player and run state:** out-of-combat statuses (Poison/Bleed/Curse tick per watch); per-loop/day usage (`att_second_wind`, free inn rest, Remembered Steps, respec once/day); `status_rested`; gathering nodes (1–2/day); a fled encounter's persisted HP until dawn.
  - **Profile:** equipped Attunements (cap 5, D-011), where PLAN has ranks; `bestiary.revealed`; `classMastery.bestLevel`.
  - **Actions:** short vs full rest, `retreat`, `salvage`, `respec`, `equipAttunement`, `gather`.
  - **Save/profile coherence:** loading a save from an earlier loop than `profile.loopCounter`.
- **Proposed fix:**
  - Add `player.statuses`, `player.uses: Record<string, {loop?: number; day?: number}>`, `world.gather`, and `locationStates[id].encounterHp`.
  - Profile `attunements: {owned, equipped}`, matching DESIGN §14.1.
  - Actions `rest:{kind:'short'|'full'}`, `retreat`, `salvage`, `respec`, `equipAttunement`, `gather`.
  - A run save stores `profileLoopAtSave`; `endLoop` sets `loopCounter = max(profile, run) + 1`.

### 20. Simulation gates are defined three different ways
- **Severity:** Major
- **Where:** PLAN §1.2 ("reaches the Threshold by portal"; "Tyrant kill rate for a level-8+ party 40–75%"; soft-lock K = 50); DESIGN §19 #1 ("Escape or Fall"), #11; §13.4 (60 steps); PLAN §7.2 (melee bot Heartstone *destroy*, caster *exploit*); §7.6 rule 3 ("day unchanged for 400 non-combat steps").
- **Problem:**
  - Under D-049 there's no Loop 1 Threshold.
  - Counting a Fall as "finishing" lets a bot that just waits 30 days pass.
  - The L8 vs L12–13 Tyrant targets conflict.
  - The melee bot's Destroy gives a Day 20 limit, which WORLD §10.8 shows a thorough route can't make, so the 60% gate fails by construction for melee.
  - The day-stuck rule false-positives inside Silverwood Before (no watches), at the Threshold, and in long dialogues.
- **Proposed fix:**
  - Loop 1 completion = Escape rate (Tyrant killed and portal reached); report Fall separately.
  - Adopt DESIGN §19 as the only target table, with the F1 level targets.
  - The melee bot picks Destroy only when the day at the Heartstone ≤ 10.
  - The day-stuck rule excludes Before/Threshold/dialogue steps. K = 60.

### 21. E2E fast-forward depends on recorded traces; there's no scenario loader
- **Severity:** Major
- **Where:** PLAN §8.3 `flows.spec.ts` (`window.__aethelgard.dispatchTrace(trace)`, "load ending-A trace"); §1.3.
- **Problem:** Any content edit (an exit, an encounter, an rng draw order) invalidates the traces. The Tyrant/Threshold/ending e2e tests then break constantly. That's ongoing rework.
- **Proposed fix:**
  - Dev-only `loadScenario(id)` (`?scenario=` in e2e builds), built from `makeState` builders keyed by content ids: `pre_tyrant_l13_ranger`, `loop2_day1`, `ending_a_ready`, `combat_bell_warden_p2`.
  - Traces are kept only for the determinism-parity test, on the fixture pack.

### 22. Ownership map has collisions and unowned work
- **Severity:** Major
- **Where:** PLAN §9.3–9.4.
- **Problem:**
  - Collisions:
    - `progression.ts`: W2 owns it, W6 writes it.
    - `src/content/schema/registries.ts`: W3 owns it, inside W7's `schema/**`.
    - `legacy/README.md`: W1 and W20.
    - `tests/unit/ui/**`: owned by W19, but W12 and W15 acceptance needs component tests there.
    - `tests/fixtures/miniContent.ts`: W2 and lead-owned.
  - No owner for: communion (D-054), the Silverwood Before clock (F10), the clock-expiry Horde (F8), the D-065 type shims and lint tool, or the scenario loader (F21).
- **Proposed fix:**
  - W6 gets `src/engine/derived.ts`.
  - The SPECIALS list moves to `src/engine/combat/specials.ts`; W7 mirrors it by test.
  - The legacy README goes to W1.
  - Component tests move to the owning W's `tests/unit/ui/<area>/`.
  - Communion goes to W3 (combat) plus W5 (dialogue nodes). Before clock and expiry Horde go to W4; shims and lint to W1; the scenario loader to W18.

---

## Rulings the lead should record in DECISIONS.md

1. Contained Tyrant: HP 460; `tyr_remember` once per phase; boss Rewind restores ≤ 10% max HP and is consumed by Void or Ley; P2 adds 2× Aberration at 40% HP (1 if solo); triggers count rounds; tuned for L11 (§19 #11: explorer 11–13, speedrunner ≥ 9).
2. `itm_echo_bolt` (D-047) = 10 MP Ley, max(0.9·ATK, 4+0.8·SP), every class, consumes Rewind.
3. Wizard regen = 3 + ⌊level/4⌋ MP/turn; `wiz_fireball` 10 MP 1.2·SP+3, Burn 60%; Burn tick 1+0.2·SP; `wiz_echo_bolt` 10 MP 1.1·SP+2; Void Lance 1.3·SP+3.
4. A status applied to a combatant during its own turn skips that turn's decrement; DoT ticks use the type's resistance step, never armor/ward/Guard.
5. Blood price and % HP self-costs require current HP > cost; self-costs never kill.
6. Communion: integer Resolve 0–8 starting at 1; reject checked only at the end of Movements II–III; F ≥ 3, A ≥ 6, B = 8; +2 days and `echo_tyrant_communion` at ≥ 4.
7. Both Loop 1 closers go directly to Loop 2 Day 1 (D-049); clock expiry starts the Horde with a 3-move delay and Ilyra's portal; a death in an expiry Horde is `closer_fall` in every loop.
8. No clock effect may set the limit earlier than current day + 3 dawns; Ending E's gate is `{ clock: { daysLeft: { max: 1 } } }`.
9. Silverwood Before has its own clock `state.before {day 1–3, resets}`; the Garret rest advances it; Last Bell resets it; the Breach Clock is frozen inside.
10. Story recipes cost 0 gold; the Breach-anchor tier gate is waived while `q_the_mending`/`q_iron_silence` is active; anchor ember ore ×3; each Heartstone choice yields 2 fragments.
11. Only bosses and story gates are unfleeable; a fled fixed non-boss group scatters for the loop (+2 watches, no XP/loot).
12. Companions have no MP (auto abilities use cooldowns); Dask follows D-059's location flag only.
13. In combat `C/I/G/F` are combat keys and panels need Shift; Drop = Delete + confirm; WASD only on the map.
14. Intent model = DESIGN §4.2 ordered pattern; boss `enterWhen` is an OR list; PLAN's weighted-intent schema is withdrawn.
15. PLAN §4.10 is replaced by DESIGN §3–6 numbers; AP and mastery in half-points; the clock is counted in ticks.
16. Canonical condition/effect shapes: object forms for quest/item/killed; `clockWatches` effect; add `counter`, `loyalty`, `resolve`, `clock.daysLeft`, `beforeDay`; `stat` covers primaries only.
17. Loop 1 completion metric = Escape rate; DESIGN §19 is the single target table; soft-lock K = 60.
18. E2E uses a dev-only `loadScenario(id)`; recorded traces are used only for determinism parity on the fixture pack.
