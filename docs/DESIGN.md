# DESIGN.md — Systems Design for *Echoes of Aethelgard: The Unraveling*

Status: implementable systems design. Canon is `docs/DECISIONS.md` (D-001..D-066); this document elaborates it and never overrides it. Ids follow D-044 and the canonical registry `docs/reviews/REGISTRY-DRAFT.md` (until BIBLE.md supersedes it); under D-062 this document owns systems and numbers, STORY owns Echo/quest/scene/codex ids, WORLD owns places, creatures and NPC ids. Where DECISIONS gives a number, that number is used. Where it does not, a number is chosen here and justified in one sentence. Every named game object has a stable `snake_case` id; downstream engineers turn these tables into `src/content/` data files validated by zod.

Conventions used throughout:

- `ATK` = Strength + weapon power. `SP` (Spell Power) = Magic + weapon spell power. `AGI` = Agility.
- "Turn" = one combatant's action. "Round" = every living combatant has acted once.
- All rounding is round-half-up to an integer, applied once at the end of a calculation unless a step says otherwise.
- Percent chances are integers 0–100 rolled against `rng.next()` (D-032).
- Legacy names (items, enemies, locations, spells, quests, NPCs) are spelled exactly as in `aethelgard_data.py` / `echoes_of_aethelgard.py`. Legacy `D-###` references point to DECISIONS.
- DECISIONS writes Echo ids as `echo.crystal_location`; the data id form is `echo_crystal_location` (one namespace, no dots). The mapping is one-to-one. STORY §12 is the Echo catalog (D-062); this document cites Echo ids only from it.
- Time is counted in **watches** (4 per day; one watch = one engine tick). Every clock effect in data is expressed in watches (D-066 #15); prose may say "days" (1 day = 4 watches).

---

## 1. Design pillars

### P1 · Knowledge is the only thing you keep
Everything that resets at the Threshold (level, gold, gear, reputation) is a means; what the Wayfinder *knows* is the end. Echoes (D-010), the codex, the bestiary and map memory persist, and every one of them has a mechanical hook: a dialogue line, a skipped fetch step, an open door, an ending flag. The design test for any new feature is "does this give the player something to remember?" — if yes, it should produce an Echo or a codex entry; if no, it is set dressing.

### P2 · Loop 1 is the original game, intact and better
Loop 1 is the legacy game with the legacy names, quests, factions, locations and the "ESCAPE" closer (D-001, D-002). Nothing is renamed. The Breach Clock is subtle, death is classic game-over, the twist lands only when the portal throws you back. Every improvement (intents, trees, statuses, bands) must make Loop 1 better on its own terms, because ≥60% of first-time players must finish it (D-037).

### P3 · Legible combat: every number has a reason
Enemies telegraph intents with type, target and number (D-009). Damage is a nine-step pipeline that the UI can show step by step. Variance is a bounded ±10% roll, never a hidden die. Resistances are four values. Status interplay is a small fixed table. The player should always be able to answer "why did that hit for 17?" from what is on the screen.

### P4 · Regions are levels, not treadmills
No enemy scales with the player (D-009). Each region has a fixed band; the Silverwood Ruins are a level 1–4 place forever. Levelling is felt as regions becoming easy, and new regions as dangerous, in a predictable order. The loop counter adds *variety* (anomaly encounters) and a tiny nudge (+3%/loop, capped +15%), never a treadmill.

### P5 · Every class has three answers and no best button
Five classes × three branches × five tiers (D-008). The legacy "Echo Bolt problem" (one spell that outclasses everything at 2–3 casts per fight) is designed out: damage-per-MP is budgeted per tier, every strong attack carries a condition or a cost, resource generation differs per class so basic attacks remain part of every rotation, and the simulation harness (D-037) rejects any ability over 35% of a class's total damage.

### P6 · Choices cost time, trust or blood — and the game remembers
The Breach Clock (D-005) makes time a resource; faction reputation (D-014) makes trust one; Corruption and Blood price make the body one. Every legacy choice now moves at least two of these (D-017), and the consequence is visible in the Loop Timeline so the player can compare loops.

### P7 · Brisk loops, honest resets
Loop 3+ should take 20–30 minutes (D-011). The reset is real (level 1, 30 gold) so choices keep weight, but Echoes skip solved problems, mastery halves re-unlock costs, Attunements are conveniences, and the UI remembers the map. "Grinding again" is a bug; "deciding again, faster, knowing more" is the game.

---

## 2. Core loop

### 2.1 Moment-to-moment
`explore → talk → fight → loot → craft → rest`, repeated per region:

1. **Explore.** Pick an adjacent node on the illustrated map (1 watch). Arriving fires location events, reveals items, may start an encounter (fixed encounters, 20% return-encounter from the region's wandering pool, anomaly encounters from Loop 2).
2. **Talk.** NPC dialogue is a node graph with conditioned choices (§13). Quests advance here; Echoes unlock lines.
3. **Fight.** Initiative-ordered turns vs 1–3 enemies with telegraphed intents (§4). Win → XP, gold, loot. Lose → Loop 1: the FALLEN game-over (D-049) / Loop 2+: The Fall (`closer_fall`, reason `death`).
4. **Loot.** Gear with rarity and affixes, consumables, crafting materials by creature family, quest items.
5. **Craft.** Only at the Emberforge, only with Borin (§8): recipes, rarity upgrades, salvage.
6. **Rest.** Short rest (1 watch, +30% HP/MP) or full rest (advance to dawn, full heal, companion swap, merchant restock, camp conversation).

### 2.2 Per loop
Day 1, Dawn, Whispering Ruins, Amulet of Echoes at your feet → explore the eleven regions under the Breach Clock (base 30 days) → one of four loop-closers/endings:

| Exit | Loop | Where it leads |
|---|---|---|
| **The Escape** `closer_escape` (any portal flight during a Horde: after the Tyrant dies in combat, or after the Breach Clock expires) | 1+ | Loop 1: straight to Loop 2 Day 1 in the Whispering Ruins, no Threshold (D-049); Loop 2+: Threshold |
| **The Fall** `closer_fall` (reason `death` \| `expiry` \| `rejected` \| `released`): death in any Horde, death in Loop 2+, communion rejection, or *Let go* at a camp (Loop 2+, D-067.14) | 1+ | Loop 1 (Horde death only): straight to Loop 2 Day 1 (D-066 #7); Loop 2+: Threshold |
| **True ending A–F** (D-018) | 2+ | Ending sequence → epilogues → Threshold (New Game+ offered) |
| Death in Loop 1 outside a Horde | 1 | FALLEN game-over → load/restart (no Threshold); Echoes and codex gained are still written to the profile (D-049) |

Clock expiry is never a cutscene: it starts the Horde (D-060) from the Apex with a 3-move delay, and Ilyra's portal opens at the Shattered Library (§10.2). Resonance earned in Loop 1 is banked and first spendable at the end of Loop 2.

### 2.3 Meta
Threshold (D-012; first visited at the end of Loop 2, D-049): run summary → Echoes gained → Resonance tally → Gallery (history, achievements) → the Loom (Attunements, modifiers) → Far Light (class choice, mastery) → Day 1. New Game+ (D-021) starts a fresh save with the profile's Echoes/codex and continues the loop counter.

### 2.4 Flowchart

```mermaid
flowchart TD
  T[Title] --> CS[Class Select / Far Light]
  CS --> D1[Day 1 · Whispering Ruins]
  D1 --> EX[Explore node]
  EX -->|NPC present| TK[Talk / Quest]
  EX -->|encounter| CB[Combat]
  CB -->|win| LT[Loot · XP · Gold]
  CB -->|flee| EX
  CB -->|HP 0, Loop 1, no Horde| GO[FALLEN game over → Load]
  CB -->|HP 0, Loop 2+ or any Horde| FALL[The Fall · closer_fall]
  LT --> EX
  TK --> EX
  EX -->|Emberforge| CR[Craft with Borin]
  CR --> EX
  EX -->|camp| RS[Rest · dawn · restock]
  RS --> EX
  EX -->|clock expires| HORDE[Horde · 3-move delay on expiry · Library portal]
  EX -->|Apex: kill Tyrant| HORDE
  HORDE -->|portal| ESC[The Escape · closer_escape]
  HORDE -->|HP 0| FALL
  EX -->|Apex: commune / ending quest| END[Ending A–F]
  ESC -->|Loop 1| D1
  FALL -->|Loop 1| D1
  ESC -->|Loop 2+| TH[Threshold]
  FALL -->|Loop 2+| TH
  END --> TH
  TH --> SUM[Run Summary · Echoes · Resonance]
  SUM --> LOOM[Loom: Attunements · Modifiers]
  LOOM --> CS
  END -->|any true ending| NGP[New Game+ available]
```

---

## 3. Stats and derived values

### 3.1 Primaries
Three primaries, as in the legacy game and as DECISIONS keeps them: **Strength (STR)**, **Magic (MAG)**, **Agility (AGI)**. No Vitality: max HP derives from class and STR instead (every class then has a reason to touch STR, and the Warden's identity stays "big"). The player gets **+1 primary of choice per level** (legacy rule kept).

### 3.2 Derived values

| Derived | Formula | Notes |
|---|---|---|
| `max_hp` | `class.base_hp + class.hp_growth·(level−1) + 2·STR + gear_hp` | Legacy was flat 100 + 10/level. |
| `max_mp` | `class.base_mp + class.mp_growth·(level−1) + 2·MAG + gear_mp` | Legacy 50 + 5/level. |
| `ATK` | `STR + weapon.power` | Legacy `attack_power()` unchanged in shape. |
| `SP` | `MAG + weapon.spell_power` | Legacy used `magic + weapon.magic`. |
| `accuracy` | `85 + floor(AGI/2) + gear + status`; abilities tagged `spell` +10 | |
| `evasion` | `floor(AGI/2) + gear + status` | |
| `hit%` | `clamp(attacker.accuracy − defender.evasion, 50, 100)` | Floor 50 so intents are never pointless to read. |
| `crit%` | `5 + floor(AGI/2) + gear + status`, cap 60 | Legacy had no crits. |
| `crit_mult` | `1.5 + gear` | Hunter's Eye raises to 1.75. |
| `initiative` | `AGI + status + d4 (rolled once per fight)` | Order re-sorted every round. Ties: player, companion, enemies by slot. |
| `guard_value` | 50% reduction (D-009); Warden Iron Guard 65%; `affix_of_the_warden` 60% | Multiplicative, applied after flat armor. |
| `armor` | sum of gear `armor`; flat reduction vs Physical | |
| `ward` | sum of gear `ward`; flat reduction vs Fire/Storm/Ley/Void/Chrono | May be negative (Ironclad Plate Armor). |
| `flee%` | `clamp(40 + 3·AGI − 2·max_enemy_AGI, 10, 90) + 15·failed_attempts_this_fight` | Bosses and story gates: cannot flee (§4.7). Slowed: cannot flee. |
| `travel_regen` | +5% max HP, +10% max MP per watch travelled | Legacy regen was 2% HP per move. |

### 3.3 Class base stats (level 1) and growth

| class id | base HP | base MP | STR | MAG | AGI | HP/lvl | MP/lvl | L1 max HP | L1 max MP |
|---|---|---|---|---|---|---|---|---|---|
| `ranger` | 100 | 36 | 10 | 6 | 8 | +8 | +3 | 120 | 48 |
| `wizard` | 84 | 50 | 6 | 11 | 7 | +6 | +5 | 96 | 72 |
| `elf` | 90 | 44 | 7 | 7 | 10 | +7 | +4 | 104 | 58 |
| `ironclad_warden` | 116 | 30 | 12 | 5 | 7 | +11 | +2 | 140 | 40 |
| `shadow_weaver` | 90 | 48 | 6 | 10 | 8 | +7 | +4 | 102 | 68 |

Every class sums to 24 primary points at level 1 (legacy: 21 + 2 class bonus = 23; the extra point funds the wider spread). Reference values before stat points and gear:

| class | L4 HP/MP | L8 | L12 | L16 | L20 |
|---|---|---|---|---|---|
| ranger | 144/57 | 176/69 | 208/81 | 240/93 | 272/105 |
| wizard | 114/87 | 138/107 | 162/127 | 186/147 | 210/167 |
| elf | 125/70 | 153/86 | 181/102 | 209/118 | 237/134 |
| ironclad_warden | 173/46 | 217/54 | 261/62 | 305/70 | 349/78 |
| shadow_weaver | 123/80 | 151/96 | 179/112 | 207/128 | 235/144 |

### 3.4 What changes from legacy, and why

| Legacy | New | Why |
|---|---|---|
| Player hit `70 + 2·AGI − 3·enemyAGI` (5–95) | `85 + ⌊AGI/2⌋ − ⌊enemyAGI/2⌋` (50–100) | Misses were ~25% and felt random; with intents the tension moves to *choices*, so base accuracy rises and the floor is 50. |
| Enemy hit `70 + 2·enemyAGI − 1·AGI` | same single formula for everyone | One rule for all combatants is legible and testable. |
| Damage `ATK + randint(0,4) − def` | `(base + coef·stat) × U(0.90,1.10) …` (§4.3) | Flat +0..4 was 40% of a level-1 hit and 5% of a level-15 hit; a proportional ±10% keeps variance meaningful at every band. |
| Spell `base + 2·(MAG+weapon)`, ×(1−res), staff halves res | `base + coef·SP`, four-step resistance (weak/neutral/resist/immune) | The 2× MAG multiplier was the Echo Bolt problem. Coefficients are 0.8–1.7 by tier and MP cost. |
| Enemies scale ±1 level with the player; Tyrant = level+1 | No scaling; fixed bands; hand-tuned bosses | D-009. Levels must feel like progress. |
| Flee `50 + 2·AGI − 4·enemyAGI` | `40 + 3·AGI − 2·maxEnemyAGI`, +15 per failed try, bosses 0 | Legacy flee vs AGI-7 enemies was ~34% for the average character; new keeps it ~45–60% and ramps so a player is never stuck failing forever. |
| +10 HP, +5 MP per level, flat | class-specific growth + 2·STR / 2·MAG | Class identity (D-008). |
| No crit, no initiative | crit from AGI, initiative from AGI | AGI needed a combat role beyond hit chance. |

---

## 4. Combat

### 4.1 Turn structure

- **Setup.** Combatants: player, active companion (if any, D-013), 1–3 enemies in slots `left/center/right`. Each rolls `initiative = AGI + d4` (the d4 is rolled once and kept). Every enemy generates its first intent (§4.2). Boss fights may open with a dialogue node.
- **Round.** Sort all living combatants by initiative (desc; ties player → companion → enemies by slot). Each acts in order. Order is re-sorted at the start of every round so Haste/Slow matter.
- **A combatant's turn.** (1) Start-of-turn ticks: DoTs (Bleed, Burn, Poison, Curse) deal damage, Regen heals, Rewind checks its timer, Doom Sigil checks its timer. A combatant killed by ticks does not act. (2) Action (exactly one). (3) End-of-turn: durations of statuses *on this combatant* decrement by 1 — **except** a status applied to this combatant during this same turn, which skips this one decrement (D-066 #4; so a self-buff such as Shadowstep's Phase or Haste 2 lasts through the enemies' next actions and its full stated duration); expired statuses are removed; cooldowns of this combatant's abilities decrement.
- **Enemy turn.** Execute the telegraphed intent (retargeting if the target died or is Taunting/Phased per §4.2), then generate the next intent from `pattern`.
- **End of round.** Boss phase triggers are also checked here (HP-threshold triggers are additionally checked immediately after any damage). Round-count triggers count **rounds** (the round counter starts at 1 and increments when every living combatant has acted), never individual turns.
- **Combat ends** when all enemies are dead/spared/fled, when the player's HP is 0, or on a successful flee. Combat costs **0 watches** (D-005).

**Player actions (one per turn):**

| Action | Key | Cost | Notes |
|---|---|---|---|
| Basic attack | `1` | 0 MP | Weapon-type dependent (§5.7). Generates resource for Ranger/Warden. |
| Ability | `2`–`9` | MP (and HP for Blood price or self-costs) | Tier/cooldown gated. An ability whose HP cost (Blood price or % HP self-cost) is ≥ current HP is unavailable; its tile reads "Not enough blood". Self-costs never kill (D-066 #5). |
| Guard | `G` | 0 | 50% reduction until your next turn; generates class resource (Ranger +5, Wizard +5, Elf +5, Warden +8, Weaver +5 MP). Does not reduce DoT ticks. |
| Item | `I` | 0 MP, consumes item | Consumables only (§7.9). |
| Companion command | `C` | 0 MP | Triggers the companion's signature ability now (if off cooldown). Uses the player's action. |
| Flee | `F` | 0 | Roll `flee%`; success ends combat and moves you to the previous node (§4.7). Fail: turn wasted, +15% next try. Unavailable against bosses and story-gate fights. |

In combat `1`–`9`, `G`, `I`, `C`, `F` are combat keys; the panel hotkeys that share letters (codex, inventory, bestiary, map) require **Shift** while a fight is on screen (D-066 #13, §16.4).

**Free actions** (no turn cost, unlimited): change companion stance (once per turn), inspect an enemy (bestiary card with known resistances), scroll the log, open the ability tooltip, swap ability-bar page.

### 4.2 Enemy intents

Every creature has a `pattern`: an ordered list of steps with conditional branches. A step is one of:

```ts
type Step =
  | { move: MoveId; target: TargetRule; when?: CombatWhen }   // skipped (pointer advances) if `when` is false
  | { if: CombatWhen | Condition; then: Step[]; else?: Step[] }
  | { weighted: { w: number; step: Step }[] }
  | { repeat: Step[]; times: number }
  | { phaseHold: true }   // bosses: hold here until phase changes
// a creature also carries moves: Record<MoveId, Move>; a Move is
// { name, type, power: {base, coef, stat}, statuses?, hidden?, summon?, revive?, riposte?, shieldAlly?, cleanseSelf? }
```

- `TargetRule` ∈ `player | companion | lowest_hp | highest_mag | random | all | self | ally | marked_first | taunter`.
- `CombatWhen` (combat-only predicates, evaluated at generation): `{ hpBelow: 0.5 }`, `{ roundAtLeast: 4 }`, `{ allyCountBelow: 2 }`, `{ allyPresent: true | CreatureId }`, `{ targetHas: "status_soaked" }`, `{ selfHas: "status_shield" }`, `{ everyNth: 3 }` (true on the creature's 3rd, 6th, … turn), `{ first: true }` (its first turn of the fight), `{ oncePerFight: true }` (true until this step has fired once), plus `all/any/not`. `Condition` is the §13.3 language. WORLD §6's cadence words map one-to-one: `everyNthTurn:n` → `everyNth`, "first" → `first`, "once per fight" → `oncePerFight`, `ifAllyPresent` → `allyPresent`, "alternates" → a two-step pattern.
- The pattern **pointer** advances one step per turn and wraps. Conditions are evaluated **when the intent is generated** (immediately after the creature acts), never silently re-evaluated later, so what the player sees is what will happen. A `then`/`else` block runs to completion before the pointer continues.
- **Generation = commitment.** The intent stores `{ moveId, targetUid, projected: [min,max], hidden }`. Projected damage is the full pipeline (§4.3) with variance bounds, against the target's *current* statuses and armor, **not** assuming Guard. Hovering/focusing the Guard button shows the halved projection ("14–17 → 7–9").

**Display (intent chip on the enemy card):**
- Icon = damage type glyph (§17.5) or effect glyph (shield, heal, eye for buffs/debuffs).
- Text = ability name ("Maul") plus an effect tag ("may Weaken", "Shield", "heals itself").
- Number = projected damage range ("14–17"), or "—" for non-damaging actions.
- Target arrow → player card or companion card; "ALL" for AoE.

**Hidden vs revealed:**
- Default: type, name, target and number are shown.
- `hidden: true` steps show a "?" chip with the type glyph only (Temporal Aberration's flickering strike; boss specials). A hidden intent resolves (becomes fully visible) at the start of the player's turn immediately preceding it.
- Status chances are shown as text ("may Weaken"); exact percentages are in the bestiary once the creature has been killed 3 times.
- Resistances are shown in the inspect card only after the first kill of that family (or at once with `att_echo_sense`). Deeper bestiary reveals (hidden-intent tells, Rewind timing, Mireling glow) unlock by kill count — ×2 or ×3 of that creature, persisting in the profile (D-011) — not by Echoes (REGISTRY §6.3).
- `rgr_hunters_eye`, `comp_dask_glimpse`, `att_foresight`: show the *next-next* intent as a dimmed second chip.

**Interrupts and stuns:**
- **Stun** cancels the stored intent; the creature loses its action; next turn it generates a fresh intent from the *next* pattern step (the stunned step is skipped, not replayed).
- **Interrupt** (Pinning Shot, Stutter, Spellbreaker, Mountainfall on bosses) cancels the stored intent but the creature still acts next turn (new intent from the next step). On bosses this is called **Stagger** and is the only way a boss "loses" an action.
- **Taunt** retargets any single-target intent to the taunter at generation *and* at execution.
- **Phase** on the intended target: single-target intent executes and misses (consuming Phase); AoE unaffected; Chrono ignores Phase.
- **Target death:** single-target intents retarget to the rule's next valid pick (default: player).
- **Slow/Haste** do not alter the intent, only when it fires (initiative re-sort).

### 4.3 Damage pipeline

Each damaging hit runs these steps in order, in floating point, with one rounding at the end:

| # | Step | Rule |
|---|---|---|
| 1 | **Base** | `ability.base` (0 for basic attacks). |
| 2 | **Stat scaling** | `+ coef · stat` where stat is `ATK` or `SP` as the ability declares. Basic attack: `1.0·ATK` (melee). |
| 3 | **Variance** | `× U(0.90, 1.10)` — one `rng.next()` draw mapped linearly. Replaces legacy `randint(0,4)`: proportional, bounded, never hides a kill. DoT ticks have **no variance**. |
| 4 | **Crit** | if `roll < crit%`: `× crit_mult`. Statuses/abilities may force a crit (`guaranteed_crit`). |
| 5 | **Resistance / weakness** | `× 1.5` weak, `× 1.0` neutral, `× 0.5` resist, `× 0` immune (immune short-circuits to 0 and prints "Immune"). |
| 6 | **Interplay** | multipliers from the §4.6 table (e.g., Storm on Soaked ×1.5; Fire on Soaked ×0.5). Stack multiplicatively. |
| 7 | **Status modifiers** | attacker Weaken ×0.75; target Mark ×1.15; target Armor Break vs Physical ×1.15; Glass modifier ×2; Collapse's missing-HP bonus etc. Multiplicative. |
| 8 | **Flat reduction** | Physical: `− target.armor`; other types: `− target.ward`. Skipped if the attack `ignores_armor` or the target has Armor Break. |
| 9 | **Guard** | `× (1 − guard_value)` if the target Guarded this round. Not applied to DoT ticks. |
| 10 | **Shield** | Subtract from the target's Shield pool first; the remainder goes to HP. Void damage destroys the Shield before this step (no absorption). |
| 11 | **Clamp & round** | round half-up; minimum **1** for any non-immune hit that connected (legacy enemy rule `max(1, …)` made universal); maximum `target.max_hp` per hit. |

Ordering note: the brief's sketch lists Guard and Shield before status modifiers; here the percentage modifiers (7) are applied before the flat reduction (8) because applying a percentage after a flat subtraction makes armor stronger against weakened attackers, which players cannot predict from the chips. Everything else follows the sketch.

Healing pipeline: `base + coef·stat` → variance ±10% → target Curse ×0.5 → clamp to missing HP. Overheal from abilities that say so becomes Shield.

### 4.4 Damage types

| id | Name | Fiction | Typical sources |
|---|---|---|---|
| `physical` | Physical | Steel, claw, stone — what the Nomads trust. | Weapons, beasts, golems, Steel/Bladesong/Breaker. |
| `fire` | Fire | Pyre and forge-heat; the fire that lit the Conflux. | Pyre branch, Emberforge gear, `affix_of_embers`. |
| `storm` | Storm | Lightning and the plateau's cutting gales. | Storm branch, Sky-Whisper Sentinels. |
| `ley` | Ley | The world's own current, drawn clean. Remnant magic. | Echo Bolt (`wiz_echo_bolt`, and the Amulet's `itm_echo_bolt`), Leyweave, Wisps, Weavers, Ilyra. |
| `void` | Void | Tears from the Breach; unmaking. | Hex/Drain/Unmaking, Stalkers, Nyx, void-forged gear. |
| `chrono` | Chrono | Time-shear; the Tyrant's agony made edge. | Chronomancy, Phantoms, Aberrations, Dask, Caelum, the Tyrant. |

Resistance scale per creature per type: `weak` ×1.5 · `neutral` ×1.0 · `resist` ×0.5 · `immune` ×0 (D-009). Players have no innate resistances; gear and `wrd_null_plate`/`wrd_iron_silence` grant steps (a "step" moves one notch toward immune, never past it).

### 4.5 Status effects

Durations are in **turns of the afflicted** (decrement at the end of its turn), except that a status applied to the afflicted during its own turn skips that turn's decrement (D-066 #4). "Refresh" = reapplying resets duration to the default and keeps the stronger tick. All ticks are computed at application time from the *source's* stats and stored on the status instance. **DoT ticks** (Bleed, Burn, Curse, Poison) apply the damage type's resistance step (§4.3 step 5; weak ×1.5 … immune ×0) but never armor, ward or Guard, and have no variance or crit; Poison is untyped and also ignores resistance.

| id | Name | Default duration | Stacking | Tick timing | Numeric effect | Cleansed by | Cue |
|---|---|---|---|---|---|---|---|
| `status_bleed` | Bleed | 3 | up to 3 stacks; each application +1 stack and refresh | start of afflicted's turn | Physical `round(1 + 0.2·source.ATK)` per stack; ignores armor; no variance | Regen tick (−1 stack), Field Dressing, Oathbound, Silverwood Bloom, Steady Breath | red drip chip "Bleed ×n" |
| `status_burn` | Burn | 3 | no; refresh | start of turn | Fire `round(1 + 0.2·source.SP)` for every source (D-066 #3); cannot be applied to Soaked | Soaked application, cleanses | orange flame chip |
| `status_shock` | Shock | 2 | no; refresh | — | −15 accuracy; takes +25% Storm; Storm crit on Shocked → Stun 1 | Steady Breath, Oathbound, Bloom | yellow jag chip |
| `status_soaked` | Soaked | 3 | no; refresh | — | takes +50% Storm; takes −50% Fire; removes Burn on application | Fire hit (removes it), cleanses | blue droplet chip |
| `status_slow` | Slow | 2 | no; refresh | — | −5 initiative, −10 evasion, cannot flee; removes Haste | Haste application, Steady Breath, Oathbound | grey hourglass chip |
| `status_haste` | Haste | 2 | no; refresh | — | +5 initiative, +10 evasion; removes Slow | Chrono hit (removes it), Unravel, Iron Silence | bright hourglass chip |
| `status_stun` | Stun | 1 | no; a target that just recovered is immune for 2 of its turns (internal cooldown) | — | loses its next action; intent cancelled | Oathbound (pre-emptive immunity only) | starburst chip |
| `status_weaken` | Weaken | 2 | no; refresh | — | deals −25% damage (all types) | Steady Breath, Oathbound, Bloom | drooping arrow chip |
| `status_armor_break` | Armor Break | 3 | no; refresh | — | armor and ward treated as 0; takes +15% Physical | Oathbound, Bloom; Golem "Harden" reapplies armor | cracked plate chip |
| `status_mark` | Mark | 3 | no; refresh | — | takes +15% damage; attacks against it cannot miss; Aggressive companions prefer it | Veilwalk (on allies), Phase consumption | crosshair chip |
| `status_curse` | Curse | 3 | no; refresh | start of turn | Void `round(2 + 0.2·source.SP)`; healing received ×0.5 | Ley hit (removes it), Steady Breath, Bloom, Lanternreed | purple sigil chip |
| `status_shield` | Shield | 3 or until depleted | no; keeps the higher pool, refreshes duration | — | absorbs damage before HP; Void destroys it outright | Unravel, Iron Silence, Nyx's Unmaking | cyan hex chip with number |
| `status_regen` | Regen | 3 | no; refresh | start of turn | heals stored amount; removes 1 Bleed stack per tick; halved while Poisoned | Void hit (removes it), Unravel | green leaf chip |
| `status_taunt` | Taunt | 2 | no; refresh | — | taunted creatures' single-target intents target the taunter | Stun on the taunter ends it | red horn chip on the enemy, shield-arrow on the taunter |
| `status_phase` | Phase | 1 (or until consumed) | no | — | next single-target attack against the holder misses; AoE unaffected; Chrono ignores it | consumption | translucent outline on the card |
| `status_rewind` | Rewind | 2 | one per target | checked at start of turn when duration hits 0 | snapshot HP at application; on expiry HP = max(current, snapshot); also cleanses Bleed/Burn/Poison then. **On a boss** the restore is capped at 10% of its max HP (D-066 #1) | any Void **or Ley** hit consumes it (Void also deals +25%; so the Amulet's `itm_echo_bolt` answers it for every class), Unravel, Iron Silence | spiral chip with countdown |
| `status_poison` | Poison | 4 | no; refresh | start of turn | untyped `round(1 + 0.15·source.ATK)`; ignores armor and resistances; halves Regen; constructs and breach-born are immune | Field Dressing, Steady Breath, Bloom, Lanternreed | green skull chip |
| `status_blind` | Blind | 2 | no; refresh | — | −30 accuracy | Steady Breath, Oathbound, Bloom | closed-eye chip |

Rules common to all: statuses on a dead combatant are discarded; statuses never carry out of combat except **Poison, Bleed and Curse**, which continue to tick once per watch travelled (they are cleared by any rest); a status with chance `c` is rolled once per application; bosses declare per-status immunity in their definition (the Tyrant: Stun, Slow, Poison, Bleed immune; Taunt ignored). One buff outside the D-009 set exists, `status_rested` (inn rest: +2 initiative, +5 accuracy for the first fight of the day, §9.5); it is out-of-combat-granted, never applied by abilities, and does not interact with the table above.

### 4.6 Interplay table

| # | Trigger | Result |
|---|---|---|
| 1 | Storm damage on Soaked target | ×1.5 and apply Shock (2) to every *other* enemy (D-009) |
| 2 | Fire damage on Soaked target | ×0.5 and remove Soaked (D-009) |
| 3 | Chrono damage on Hasted target | remove Haste (D-009) |
| 4 | Void damage on Shielded target | destroy the Shield; no absorption (D-009) |
| 5 | Soaked applied to Burning target | remove Burn; Burn cannot be applied while Soaked |
| 6 | Slow applied to Hasted target (or vice versa) | the existing one is removed; the new one is not applied (they cancel) |
| 7 | Regen tick on Bleeding target | remove 1 Bleed stack |
| 8 | Poison on target with Regen | Regen heals 50% |
| 9 | Void or Ley damage on Rewound target | consume Rewind (snapshot lost); Void ×1.25 (D-066 #1–2) |
| 10 | Chrono attack vs Phased target | ignores Phase (hits normally) |
| 11 | Stun on a Taunting combatant | Taunt ends |
| 12 | Storm **crit** on Shocked target | apply Stun (1) if not stun-immune |
| 13 | Ley damage on Cursed target | remove Curse, ×1.25 |
| 14 | Void damage on target with Regen | remove Regen |
| 15 | Physical crit on Bleeding target | +1 Bleed stack (max 3) |
| 16 | Fire damage on Burning target by `wiz_immolate` | consume Burn: deal 3× its remaining ticks instantly |
| 17 | Armor Break + Physical | ×1.15 and ignore armor (status definition) |
| 18 | Mark + any attack | cannot miss; ×1.15 (status definition) |

### 4.7 Guard, flee, death, retreat

- **Guard.** Lasts until the guarder's next turn begins. Halves (50%) all direct damage after flat reduction; does nothing to ticks. Generates class resource (§4.1). Guarding while Taunting keeps Taunt. The Guard button shows the projected post-guard numbers for every incoming intent.
- **Flee.** `flee%` as §3.2. Only **bosses and story-gate fights** (`fleeable: false`) cannot be fled (D-066 #11); everything else, including fixed groups, quest fights and Horde packs, can. Success: combat ends, the flee costs 1 watch (you still walked the road) and grants no XP and no loot, and **the party always falls back to the previous node** (the way it came; it stays put only when there is no previous node or it is this one), with no encounter roll on that arrival (D-143). What happens to the encounter depends on its `onFlee`:
  - **Wandering / return rolls** (`onFlee: "previous"`): the encounter is gone.
  - **Fixed non-boss groups** (`onFlee: "scatter"`, the default): the group **scatters for the rest of the loop**: the flee costs +2 watches more (3 in all), and the node is passable when the party walks back in. This keeps every location reachable for pacifist play (D-037, WORLD §10).
  - **Quest-drop groups** (`onFlee: "regroup"`, D-143/D-144): every fixed group with a creature that can drop an item a quest objective needs (any chance, the Apex road included) **regroups** instead of scattering. The flight costs the same 3 watches; the group is **gone until the next dawn** — the next arrival after the flight always passes, even when the flight and the road back cross a dawn, and another group of that node already sent off stays off with it — so the node is passable for the rest of that day and no road is ever blocked (D-037). At dawn it gathers again at full HP with its drops (a first-visit group then fires on the next arrival whatever its roll, until beaten; a return group rolls as ever). Fleeing costs time, never the quest. The content test `fleeRules.test` lists every quest-drop group and forbids `scatter` or `hold` on them.
  - **Bosses and story gates** (`onFlee: "hold"`, `fleeable: false`): not fleeable; the Retreat action below is the way to avoid them. A fleeable `hold` group keeps each creature's wounds until dawn and re-fires on the next arrival (a creature felled before the flight stands again whole).
  `rgr_smoke_bomb`/`elf_veilwalk` make the next flee automatic vs non-bosses.
- **Death — Loop 1.** HP 0 → Game Over screen ("FALLEN", legacy art) → Load autosave / Load slot / Title. Classic rule preserved (D-002, D-049); Echoes and codex gained are already in the profile. **Exception:** death during a Horde (after the Tyrant dies, or after clock expiry) is `closer_fall` (reason `death`) and leads straight to Loop 2 Day 1 (D-066 #7).
- **Death — Loop 2+.** HP 0 → **The Fall** (short sequence: the Breach reclaims you) → Threshold. The run summary records `closer: "closer_fall"`, `reason: "death"`. `att_second_wind` once per loop leaves you at 1 HP instead.
- **Companion KO** does not end combat.
- **Retreat to previous node** (out of combat): from any node, the "Retreat" action in the travel panel returns you along the edge you arrived by for 1 watch, with no encounter roll on arrival. It exists so a player who sees a locked door or a tough fixed encounter card ("Elite · Lv 6") can leave without a wandering roll.

### 4.8 Groups and targeting

- 1–3 enemies in slots. Encounter definitions list slot contents; wandering encounters pick 1 (70%) or 2 (30%) from the region's pool; Horde Rising adds +1.
- Player single-target abilities: default target = last targeted enemy if alive, else leftmost. AoE hits all enemies. Ally-targeted abilities default to the companion if alive else self.
- Enemy targeting without a Taunt: `player` rule picks the player; `random` picks 60/40 player/companion; `lowest_hp` by HP%; `highest_mag` for anti-caster creatures.
- AoE ("all") enemy intents damage player and companion; each defender applies its own Guard/armor/Shield.

### 4.9 Companions in combat

One active companion (D-013). It acts on its own initiative turn by **stance**; the player may trigger its **signature** by spending the player's action.

```ts
function companionAct(c, state): Action {
  const foes = aliveEnemies(state), me = c, pl = state.player;
  switch (c.stance) {
    case "aggressive":
      if (c.auto.find(a => a.kind==="debuff") && !foes.some(f => f.has(a.status)) && ready(c,a)) return use(a, foes.find(f=>!f.has(a.status)));
      if (foes.length >= 2 && c.auto.find(a => a.kind==="aoe") && ready) return use(aoe, "all");
      return use(c.auto.find(a=>a.kind==="attack") ?? basic(c), foes.sort(byMarkedThenLowestHp)[0]);
    case "guarded":
      if (pl.hp/pl.maxHp < 0.4 && c.auto.find(a=>a.kind==="heal") && ready) return use(heal, pl);
      if (c.hp/c.maxHp < 0.35) return guard(c);
      if (nextIntentDamage(pl) >= 0.3*pl.maxHp && c.auto.find(a=>a.kind==="shield") && !pl.has("status_shield") && ready) return use(shield, pl);
      return use(c.auto.find(a=>a.kind==="attack") ?? basic(c), foes.sort(byLowestHp)[0]);
    case "support":
      const low = [pl, c].sort(byHpPct)[0];
      if (low.hp/low.maxHp < 0.6 && c.auto.find(a=>a.kind==="heal") && ready) return use(heal, low);
      if (hasCleansable(pl) && c.auto.find(a=>a.kind==="cleanse") && ready) return use(cleanse, pl);
      if (c.auto.find(a=>a.kind==="shield") && !pl.has("status_shield") && ready) return use(shield, pl);
      if (c.auto.find(a=>a.kind==="debuff") && ready) return use(debuff, foes[0]);
      return basic(c);
  }
}
```

- `ready(c,a)` = the auto ability is off cooldown. **Companions have no MP** (D-066 #12); auto abilities use cooldowns in the companion's turns: `attack` 0, `debuff`/`aoe` 2, `heal`/`shield`/`cleanse` 3 (§12.4 lists them). Companions never use items.
- **Signature**: cooldown in the companion's turns (4–5); the player's action triggers it immediately on the player's turn; the companion still takes its own stance action that round.
- **HP/KO**: HP 0 → KO: removed from the fight, no further actions; revived at the next **full rest** at 50% HP, by `wrd_last_bastion`, or by `item_lanternreed_salts`. No permadeath except story (Brak at the Apex, D-013/D-017).
- Companions use the same pipeline and statuses. Their level equals the player's (D-053); HP/ATK/SP grow per §12.3, armor and ward gain +1 per 4 levels (at levels 4, 8, 12, 16, 20), and AGI is fixed at its §12.3 value.

### 4.10 Boss framework

A boss definition adds to a creature:

```ts
boss: {
  phases: [{ id, name, enterWhen: Trigger[], pattern: Step[], adds?: { creatureId, count, countSolo?, hpPct }[],
             onEnter?: Effect[], damageTakenMult?: number, barColor }],
  statusImmunities: StatusId[],  // e.g. status_stun, status_slow
  tauntImmune: boolean,
  interruptible: boolean,        // Stagger allowed
  communion?: CommunionSpec,     // §4.11
  fleeable: false
}
type Trigger = { hpBelow: number } | { round: number } | { event: "addsDead" | "communionMovementEnd" } | { resolveAtLeast: number };
```

Rules: `enterWhen` is an **OR-list** (D-066 #14): the phase is entered when any trigger in it is true. Round triggers count rounds (§4.1). Triggers are evaluated after every damage event and at end of round; entering a phase replaces the pattern pointer, fires `onEnter` (dialogue line, AoE, adds spawn into empty slots, up to 3 total combatants on the enemy side), and resets the intent. Phases never go backwards. HP bars are segmented by phase thresholds so the player can see the next trigger. Adds killed before the next phase do not respawn unless the phase says so; adds alive at a phase change stay. `countSolo` is the add count when the player has no active companion. Boss Rewind restores at most 10% of the boss's max HP and is removed by Void or Ley damage (§4.5). Phase ids for both Tyrants are `tyr_movement_1..3` (D-051 names, D-054 Movements); the Unveiled fourth phase is `tyr_phase_4`.

**Legacy bosses re-expressed:** Stone-Hide Golem pair at the Blighted Outpost is an **elite encounter**, not a boss (no phases). The Chronos Tyrant has two definitions (D-051); move ids and lines follow WORLD §6.8, numbers are owned here:

| id | Loop | HP / ATK / SP / armor / ward / AGI | Phases | Notes |
|---|---|---|---|---|
| `cr_chronos_tyrant_contained` | 1 | 460 / 24 / 26 / 6 / 8 / 4 | **`tyr_movement_1` The Holding** (100–66%): `tyr_brace` (shield self `0.6·SP`) alternating with `tyr_grasp` (Physical `1.2·ATK`, Slow 100% 2) / `tyr_shear` (Chrono `1.0·SP` all) / `tyr_time_lash` (Chrono `1.3·SP` single). **`tyr_movement_2` The Fracture** (`hpBelow 0.66`): `onEnter` spawn 1× `cr_temporal_aberration` at 40% HP (none if no companion; U81b2, was 2 / 1 solo); rotation `tyr_korr_burns` (Fire `1.0·SP`, Burn 60% 3), `tyr_vane_closes` (Physical `1.1·ATK`, Armor Break 60% 3), `tyr_gather` → `tyr_chrono_strike` (hidden 2-turn wind-up; Chrono `2.0·SP`; Stun 1 unless the target Guarded — "the strike that scattered Dask"), `tyr_aulde_sings` (shield self `1.0·SP`), `tyr_sallow_breathes` (Ley `0.6·SP`, Poison 70% 4; **no regen** in this form), `tyr_remember` (self Rewind 2) **once in this phase**. **`tyr_movement_3` The Nine Speak** (`hpBelow 0.33` OR `round 12`): no more Brace; takes ×1.5 damage (STORY §8.4; provisional pending sims, REVIEW-CROSS C-33); `tyr_unraveling` (Chrono `0.8·SP` all + Armor Break 100% 2; U81b2, was `1.1·SP`: the slow classes died to it after round 12 in full runs) every turn; `tyr_remember` **once in this phase**. | Immune Stun/Slow/Poison/Bleed; Taunt ignored; Stagger allowed. Resist Chrono, Void; weak Ley. XP 900 (D-051: not raised). Cannot speak (D-004). **Tuned for a level-11 party** (§19 #11: explorer 11–13, speedrunner ≥ 9); target 12–18 rounds; effective HP (HP + shields + capped Rewinds + adds a player must kill − the P3 ×1.5 bonus) ≤ 850 ≈ 18 rounds at 47 damage/round; the sim confirms at L11 and L13 (§6.6). |
| `cr_chronos_tyrant_unveiled` | 2+ | 900 / 32 / 36 / 8 / 10 / 4 | **`tyr_movement_1`** "Lament" (100–75%): `tyr_speak` first (no action), then `tyr_time_lash`, `tyr_grasp`, `tyr_shear`. **`tyr_movement_2`** "The Nine Surface" (`hpBelow 0.75`): spawn 2× `cr_tyrants_reach` (90 HP each; bound mages rolled without repeat; one more each time one dies, max 2 alive and 5 in total — WORLD §6.8); `tyr_remember` `everyNth 3`, otherwise Phase 1 moves. **`tyr_movement_3`** "Chrono-Strike" (`hpBelow 0.5`): `tyr_gather` → `tyr_chrono_strike` `everyNth 3`, otherwise Phase 1 moves. **`tyr_phase_4`** "The Hold Fails" (`hpBelow 0.25` OR `round 20`): `tyr_unraveling` every turn, outgoing damage +10% per round in this phase (uncapped). No communion Movement in Phase 4 (communion closes at the end of Movement III). | Same immunities. XP 1,600. From Loop 2 it never attacks first (WORLD §6.8). Communion available (§4.11). Killing it in any loop triggers the Horde (D-060) and The Escape, never a true ending (D-004, D-018). |

### 4.11 Communion (non-combat resolution for the Tyrant)

D-054 / D-066 #6. Available against `cr_chronos_tyrant_unveiled` (Loop 2+) once the player holds `echo_tyrant_speaks`, or from the moment the player chooses **Listen** (STORY §8.3). The Tyrant never attacks first from Loop 2, so communion can open on turn 1; the player may also switch to it at any phase transition, entering the Movement that matches the phase (a player who fought into Phase 2 starts at Movement II). The encounter screen is the combat screen; the ability bar gains a seventh toggle **Commune** (free action) that swaps the bar for four **dialogue actions**, each costing the player's turn.

**Resolve** is an integer **0–8** that starts at **1** (D-066 #6), shown as eight pips. While a Movement runs the Tyrant's combat pattern is paused: its intent alternates a **question** pseudo-intent (no damage; STORY §8.3 owns the questions, WORLD §6.8 the ids `tyr_q_*`) with `tyr_hour_presses` (D-067.3: Chrono, **8% of the player's max HP × (1 − Resolve/8)**; it **cannot kill while Resolve ≥ 3** — it stops at 1 HP — so communion is never a gear check). Movement I has three questions, Movement II six (five askers plus Hallow's silence), Movement III one (the choice); a Movement ends when its last question has been answered.

| Action | Effect on Resolve | Notes |
|---|---|---|
| **Speak** (answer the current question; answers require Echoes, STORY §8.3) | matching Echo answer **+1**; `echo_hallow_said_stop` (Hallow's silence) **+2**; `echo_ritual_inevitable` for Masque **+2**; the honest "to kill you" +1; a **lie −2** | each answer once per encounter |
| **Listen** | **+1**, once per Movement; the Tyrant speaks a codex fragment (unlocks `codex_*` entries) | no damage rider (D-069.8); the only communion damage is `tyr_hour_presses` |
| **Offer** (present an item; **never consumes** it, D-067.3) | `item_chronos_lens` +1; `item_stabilized_heartstone` +1; `item_breach_anchor` +2 (sets `flag_anchor_offered`); `item_heartstone_core` **−2** (it recoils) | each item once per encounter |
| **Resist** | +0; acts as Guard | |

- **Attacking during communion forfeits the current question** (D-067.3): that question is skipped unanswered (no Resolve gain).
- A companion in Support stance adds **+1 once per Movement** — Dask or Caelum only (WORLD §6.8).
- "It is tired": below 30% Tyrant HP every gain is +1 more.
- Corruption ≥ 3 satisfies Korr's question (+1) but costs −1 at the next asker (STORY §8.3).
- Resolve is clamped to 0–8 after every change. Resolve is per encounter and never saved across loops.
- **Rejection** is checked only at the **end of Movements II and III** (Resolve < 3), or immediately on a second lie (D-066 #6). The Tyrant speaks STORY §8.5's line; combat resumes at Phase 2, or the player may leave, which closes the loop as `closer_fall` with reason `rejected` and grants `echo_tyrant_rejected` (STORY §8.5: the next communion starts at Movement II).
- The first time in a loop Resolve reaches **≥ 4**, the Breach Clock gains **+8 watches** (+2 days, §10.1).
- **End of Movement III** (`tyr_q_choice`): combat ends with the Tyrant spared and the Resolution dialogue follows (STORY owns the lines). Outcomes offered: **Resolve ≥ 3** — let you pass (Silverwood Before, D-016, or ending F); **≥ 6** with `echo_litany_complete` — take its place (A); **8** with `echo_void_resonance`, `echo_heartstone_resonance` and `item_breach_anchor` in hand (plus STORY's `echo_anchor_mechanic` and `flag_cradle_pin_anchored`) — consent to the Mending (B, `echo_tyrant_consent`). `ach_commune` = reach Resolve 8.
- Attacking during communion is allowed (it costs the turn and ends the current question unanswered); a kill ends in the Horde as usual. Fleeing is impossible.

### 4.12 Worked example — Ranger level 4 vs Wildling Brute + Corrupted Shade

Setting: Mistwood Path, Loop 1, a return encounter from the legacy wandering pool. No companion.

**Ranger L4** (`ranger`): STR 12 (10 + 2 points), MAG 6, AGI 9 (8 + 1). Weapon Traveler's Sword, Uncommon (power 5 × 1.1 = 5.5 → 6) → **ATK 18**. Armor Wildling Hide Armor, Common → armor 2, ward 1. max HP = 100 + 8·3 + 2·12 = **148**; max MP = 36 + 3·3 + 2·6 = **57**. accuracy 89, evasion 4, crit 9%, crit ×1.5. Abilities (4 AP): `rgr_venom_coat`, `rgr_marked_shot`, `rgr_rend`, `rgr_piercing_arrow`. Focus: +8 MP per basic hit (+12 on crit), +5 on Guard.

**Wildling Brute** (`cr_wildling_brute`, L4): HP 64, ATK 11, armor 3, ward 0, AGI 3 → accuracy 86, evasion 1. Pattern: `strike(1.0·ATK) → strike → maul(1.6·ATK) → {hp<50%: root_knit(Regen 3×2) | strike}`. **Corrupted Shade** (`cr_corrupted_shade`, L2): HP 36, ATK 7, SP 7, armor 1, ward 2, AGI 5 → accuracy 87 (Wail is a spell: 97), evasion 2. Immune Poison (breach-born). Pattern: `rake(1.0·ATK) → wail(Void 0.9·SP, Weaken 50%, 2) → {hp<70%: fade(Phase self) | rake}`.

Initiative: Ranger 9+2 = 11, Shade 5+3 = 8, Brute 3+1 = 4. Order every round: Ranger → Shade → Brute. Opening intents: Shade **Rake → Ranger 4–6** (7×0.9−2 = 4.3→4; 7×1.1−2 = 5.7→6); Brute **Strike → Ranger 8–10**.

| Rd | Actor | Action and pipeline | Result | New intents |
|---|---|---|---|---|
| 1 | Ranger | `rgr_venom_coat` (6 MP → 51). Self buff, 3 turns: attacks apply Poison. | — | — |
| 1 | Shade | Rake: hit roll needs ≤ 87−4 = 83; rolls 90 → **miss**. | — | **Wail → Ranger 5–6, may Weaken** (6.3×0.9−1 = 4.67→5; 6.3×1.1−1 = 5.93→6) |
| 1 | Brute | Strike: needs ≤ 82; rolls 37 hit. 11 × 1.07 = 11.77; no crit (80 > 6); neutral; −2 armor = 9.77 → **10**. | Ranger 148 → 138 | **Strike → Ranger 8–10** |
| 2 | Ranger | `rgr_marked_shot` → Shade (8 MP → 43). Needs ≤ 87; hit. 1.1×18 = 19.8 × 1.03 = 20.39; no crit; neutral; −1 armor = 19.39 → **19**. Mark (3) applied. Venom Coat tries Poison → **Immune** (chip flashes "Immune"). | Shade 36 → 17 (47%) | — |
| 2 | Shade | Wail: spell accuracy 97−4 = 93; hit. Void 6.3 × 1.02 = 6.43 − ward 1 = 5.43 → **5**. Weaken roll 32 ≤ 50 → Ranger **Weakened (2)**. | Ranger 138 → 133 | pointer → branch: hp 47% < 70% → **Fade (Phase self)**, chip "shrouds itself" |
| 2 | Brute | Strike: hit. 11 × 0.98 = 10.78 − 2 = 8.78 → **9**. | Ranger 133 → 124 | **Maul → Ranger 14–17** (heavy glyph) |
| 3 | Ranger | **Guard** (+5 Focus → 48). Reasoning the UI supports: Weakened this turn (−25% damage dealt) and a 14–17 heavy incoming; Guard preview shows "7–9". | — | — |
| 3 | Shade | Fade → gains **Phase (1)**. | — | **Rake → Ranger 4–6** |
| 3 | Brute | Maul: hit. 17.6 × 1.05 = 18.48 − 2 = 16.48; Guard ×0.5 = 8.24 → **8**. | Ranger 124 → 116 | pointer → branch: hp 100% → **Strike → Ranger 8–10** |
| 4 | Ranger | `rgr_rend` → Brute (8 MP → 40). Weaken still active (expires end of this turn). Needs ≤ 88; hit. 18 × 0.98 = 17.64 × 0.75 = 13.23 − 3 armor = 10.23 → **10**. Bleed ×1 (3 turns, tick `round(1+0.2·18)` = **5**). Venom Coat → **Poison (4 turns, tick `round(1+0.15·18)` = 4)**. | Brute 64 → 54 | — |
| 4 | Shade | Rake: hit. 7 × 0.90 = 6.3 − 2 = 4.3 → **4**. (Its Phase, applied during its own round-3 turn, skipped that turn's countdown, protected it through the Ranger's round-4 turn unused, and expires at the end of this turn.) | Ranger 116 → 112 | **Wail → Ranger 5–6, may Weaken** (§4.2 pointer; corrected in U25 — never played) |
| 4 | Brute | Start of turn: Bleed 5 + Poison 4 = **9**. Strike: needs ≤ 82; rolls 88 → **miss**. | Brute 54 → 45 | **Strike → Ranger 8–10** |
| 5 | Ranger | Basic attack (sword) → Shade (its Mark expired at the end of its round-4 turn, §4.5 / D-066 #4, so the attack rolls to hit: hit). 18 × 1.02 = 18.36; crit roll 07 ≤ 9 → **crit** ×1.5 = 27.54; −1 armor = 26.54 → **27** (corrected in U24; still lethal). Focus +12 → 52. | Shade 17 → **0, dies**; intent removed | — |
| 5 | Brute | Ticks 9. Strike: hit. 11 × 0.91 = 10.01 − 2 = 8.01 → **8**. | Brute 45 → 36; Ranger 112 → 104 | **Strike → Ranger 8–10** (§4.2 pointer; corrected in U25 — never played) |
| 6 | Ranger | `rgr_piercing_arrow` → Brute (12 MP → 40). Hit. 1.5×18 = 27 × 1.04 = 28.08; no crit; ignores armor → **28**. | Brute 36 → 8 | — |
| 6 | Brute | Start of turn: Bleed 5 (3rd and last tick) + Poison 4 = 9 ≥ 8 → **dies before acting**. Log: "The Brute bleeds out before it can swing." | Brute 8 → 0 | — |

Outcome after 6 rounds: Ranger 104/148 HP, 40/57 MP. Rewards: XP 71 (Brute, L4) + 41 (Shade, L2) = **112**; gold 14 + 9 = **23**; loot rolls: Shade → Dark Spellbook (the first Corrupted Shade killed this loop: 100%, D-055; later Shades 50%), `mat_shadow_ash` (80%: yes); Brute → Ley-Touched Tonic (60%: yes), Wildling Hide Armor (25%: no), `mat_wildling_hide` (80%: yes). Bestiary: Corrupted Shade kills 1 (resistances now shown), Wildling Brute kills 1. Autosave fires (§14).

What the example demonstrates: intents with ranges and effect tags; a conditional branch flipping an intent (Fade); Guard against a telegraphed heavy; a resistance surprise (Poison immune) that costs nothing but teaches; Weaken's visible −25%; DoTs killing at start-of-turn; Mark making a finishing blow certain; Focus economy (two basic-attack-equivalents fund the abilities).

---

## 5. Classes and ability trees

### 5.1 Shared rules

- **Tiers and level gates.** Tier 1 = level 1, Tier 2 = level 4, Tier 3 = level 8, Tier 4 = level 12, Tier 5 (capstone) = level 16. In addition, Tier 3 requires ≥2 abilities already unlocked in that branch, Tier 4 ≥3, and the capstone all four. Capstones therefore cost 6 AP per branch in total (4 + 2).
- **Ability points.** 1 AP per level including level 1 (so a level-1 character unlocks one Tier-1 ability before the first fight); capstones cost 2. AP and ability costs are stored internally in **half-points** (1 AP = 2 half-points) so that mastery (§6.4) halves every cost exactly (D-066 #15).
- **Power budget (the anti-Echo-Bolt rule).** Let U = the class's basic-attack damage at that level. Single-target damage abilities are budgeted at T1 ≈ 1.2–1.3U for 8 MP, T2 ≈ 1.5–1.7U for 12–14 MP, T3 ≈ 1.8–2.0U, T4 ≈ 2.2–2.4U (or ≈1.0U to all), T5 ≈ 2.6–3.2U for 24–30 MP with a cooldown. Every ability above 1.3U carries at least one of: a cooldown, a self-cost, a setup condition (status on target), or a damage type that 25%+ of creatures in its band resist. **DoT ticks count toward the budget** at their expected total over the full duration × apply chance (Burn 60% × 3 ticks of `1 + 0.2·SP`). A "setup" condition must be one the player has to create in that fight (a status on the target, acting before the target), never one that every fight satisfies. The harness (§19) flags any ability over 35% of a class's aggregate damage. (U81b2: the three no-cooldown T2–T3 strikes over 1.3U — Piercing Arrow, Lightning Bolt, Flurry — took 39–45% each, so they carry a 1-turn cooldown.)
- **Self-costs** (D-066 #5). Blood price and % HP costs require current HP **>** the cost; otherwise the ability is unavailable (tile reads "Not enough blood"). A self-cost never reduces HP below 1 and never kills.
- **Cooldowns** are counted in the caster's turns and shown as a numeric overlay; they persist within a fight only (reset at combat end).
- **MP cost modifiers.** Staff `mp_cost_reduction` (Apprentice 10%, Necromancer 20%) applies to every ability, rounded down, minimum 1. Heartstone Destroy: Ley abilities +25% MP (D-017). Corruption does not reduce costs (its bonus is to SP, §6.7).
- **Out-of-combat use.** Abilities tagged `field` (heals, cleanses, Rewind) can be used outside combat at their MP cost.
- All ability ids are stable. Columns: Branch · Tier · MP · Target · Type · Power (base + coef·stat) · Status (id, chance, duration) · CD · Description.

### 5.2 Ranger (`ranger`)

*Fantasy.* Hunter of the wilds between settlements. You read the ground before the sky, carry three kinds of knife and a bow you made yourself, and you have never once asked a ley line for help. The Ranger is the game's baseline body: good HP, honest Physical damage, and tools for every situation if you spent the points.

*Resource.* Mana as **Focus**: +8 MP per basic-attack hit (+12 on crit), +5 per Guard; small pool. Rotation is basic-attack-then-ability by design.

*Base stats.* HP 100 (+8), MP 36 (+3), STR 10, MAG 6, AGI 8. *Starting kit.* Rusty Dagger, Ley-Touched Tonic ×2, 30 gold.

| id | Name | Branch | Tier | MP | Target | Type | Power | Status | CD | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| `rgr_marked_shot` | Marked Shot | Hunt | 1 | 8 | single | Physical | `1.1·ATK` | `status_mark` 100%, 3 | — | Every hunt begins with a choice of prey. |
| `rgr_piercing_arrow` | Piercing Arrow | Hunt | 2 | 12 | single | Physical | `1.5·ATK`, ignores armor; ×1.25 vs Marked | — | 1 | Hide, plate, bark. It does not care. |
| `rgr_hunters_eye` | Hunter's Eye | Hunt | 3 | 10 | self | — | — | self: +20 crit, crit ×1.75, see next-next intents; 3 turns | 4 | You stop blinking. The forest slows down. (utility) |
| `rgr_pinning_shot` | Pinning Shot | Hunt | 4 | 14 | single | Physical | `1.0·ATK` | interrupts the target's intent; `status_slow` 100%, 2 | 3 | Through the foot, into the root. It isn't going anywhere. (defensive) |
| `rgr_killing_shot` | Killing Shot | Hunt | 5 | 24 | single | Physical | `2.2·ATK`; guaranteed crit vs Marked; refunds 24 MP if it kills | — | 4 | One arrow. You have been saving it since the Ruins. (capstone) |
| `rgr_rend` | Rend | Steel | 1 | 8 | single | Physical | `1.0·ATK` | `status_bleed` 100%, 3 (+1 stack) | — | A wound that keeps working after you stop. |
| `rgr_riposte_stance` | Riposte Stance | Steel | 2 | 8 | self | — | — | Guard (50%) this round; each melee attacker takes `0.8·ATK` Physical and you gain 8 Focus | 3 | Let them come. (defensive) |
| `rgr_hamstring` | Hamstring | Steel | 3 | 10 | single | Physical | `0.9·ATK` | `status_slow` 100%, 2; +1 Bleed stack if already bleeding | — | Behind the knee, where the Nomads taught you. (utility) |
| `rgr_whirling_steel` | Whirling Steel | Steel | 4 | 16 | all | Physical | `0.85·ATK` | +1 Bleed stack on each already-bleeding target | — | Three blades, one breath. |
| `rgr_exsanguinate` | Exsanguinate | Steel | 5 | 20 | single | Physical | `1.4·ATK` + consume all Bleed: deal 2× the remaining tick total instantly | — | 4 | Finish what the first cut started. (capstone) |
| `rgr_venom_coat` | Venom Coat | Wildcraft | 1 | 6 | self | — | — | for 3 turns your attacks and Hunt/Steel abilities apply `status_poison` 100%, 4 | — | Mistwood sap, nightshade, patience. (utility) |
| `rgr_field_dressing` | Field Dressing | Wildcraft | 2 | 10 | self/ally | heal | `18 + 0.8·max(STR,AGI)`; removes Bleed and Poison | — | — | Boiled moss and a steady hand. Works on the road too. (defensive, `field`) |
| `rgr_snare_trap` | Snare Trap | Wildcraft | 3 | 12 | single | Physical | `0.5·ATK` | `status_stun` 100%, 1 (non-boss); bosses: `status_slow` 2 | 3 | They never look down. (utility) |
| `rgr_smoke_bomb` | Smoke Bomb | Wildcraft | 4 | 12 | all | — | — | `status_blind` 100%, 2 on all enemies; your next flee auto-succeeds (non-boss) | 3 | Rootbone ash and glow gland. Nobody sees what you do next. (defensive/utility) |
| `rgr_apex_predator` | Apex Predator | Wildcraft | 5 | 20 | self | — | — | 4 turns: all DoTs you applied tick twice per turn; Focus generation ×2 | 5 | The wilds have a new top of the chain. (capstone) |

*Why no single best button:* Marked Shot and Rend are both 1.0–1.1U at 8 MP with different payoffs (certainty vs. attrition); Piercing Arrow's 1.5U needs 12 MP that only basic attacks replenish; Killing Shot refunds only on a kill. In the sim the Ranger's damage splits roughly 35% basic / 25% Bleed+Poison ticks / 40% abilities.

### 5.3 Wizard (`wizard`)

*Fantasy.* Self-taught ley-caster. Nobody trained you; the Dark Spellbooks did, and they are not kind teachers. Big pool, steady regeneration, fragile body. Pyre burns, Storm chains, Chronomancy bends the order of things.

*Resource.* Mana regenerates **`3 + ⌊level/4⌋` MP at the start of each of your turns** (D-066 #3: 3 at L1, 6 at L12, 8 at L20); large pool. The staff cantrip (§5.7) also restores 3 MP. No generation from Guard beyond the universal +5. Regen alone never pays for a Tier-1 spell every turn, so the cantrip stays in the rotation.

*Base stats.* HP 84 (+6), MP 50 (+5), STR 6, MAG 11, AGI 7. *Starting kit.* Apprentice Staff, Mana Bloom ×1, Ley-Touched Tonic ×1, 30 gold.

| id | Name | Branch | Tier | MP | Target | Type | Power | Status | CD | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| `wiz_fireball` | Fireball | Pyre | 1 | 10 | single | Fire | `1.2·SP + 3` | `status_burn` 60%, 3 | — | The first spell Maelis wrote down. It still works. |
| `wiz_cinder_shield` | Cinder Shield | Pyre | 2 | 10 | self | — | Shield `1.5·SP + 10`, 3 turns | melee attackers take `0.5·SP` Fire and Burn 50%, 3 | 3 | Heat the air until steel flinches. (defensive) |
| `wiz_flame_wave` | Flame Wave | Pyre | 3 | 18 | all | Fire | `1.0·SP + 3` | `status_burn` 60%, 3 | — | The Spires' light, borrowed and angry. |
| `wiz_immolate` | Immolate | Pyre | 4 | 16 | single | Fire | `1.2·SP`; consumes Burn for 3× its remaining ticks (interplay 16) | — | — | Everything that is burning, burns now. (utility) |
| `wiz_pyre_of_the_nine` | Pyre of the Nine | Pyre | 5 | 30 | all | Fire | `2.0·SP + 10` | `status_burn` 100%, 3; `status_armor_break` 100%, 2; costs 10% of your max HP | 4 | The fire that lit the Conflux. You pay what they paid. (capstone) |
| `wiz_static_lash` | Static Lash | Storm | 1 | 8 | single | Storm | `1.1·SP + 2` | `status_shock` 50%, 2 | — | A crack of blue across the gap. |
| `wiz_lightning_bolt` | Lightning Bolt | Storm | 2 | 14 | single | Storm | `1.7·SP + 4`; chains to one other enemy at 50% if the target is Soaked or Shocked | `status_shock` 100%, 2 | 1 | The sky's own argument. |
| `wiz_gale_step` | Gale Step | Storm | 3 | 10 | self | — | — | `status_haste` 3; `status_phase` 1 | 3 | Be where the blow is not. (defensive/utility) |
| `wiz_chain_tempest` | Chain Tempest | Storm | 4 | 20 | all | Storm | `1.1·SP` | Shocked targets take ×1.25 and spread Shock (interplay 1/12) | — | One bolt is weather. Three is a verdict. |
| `wiz_skyfall` | Skyfall | Storm | 5 | 30 | single | Storm | `2.6·SP + 8`; if the target is Soaked: Stun 1 and forks to all enemies at 50% | — | 4 | Call the plateau's storm down the ley line. (capstone) |
| `wiz_echo_bolt` | Echo Bolt | Chronomancy | 1 | 10 | single | Ley | `1.1·SP + 2` | — | — | A moment's residue, thrown. Cheap, clean, reliable — and no more than that. |
| `wiz_temporal_drag` | Temporal Drag | Chronomancy | 2 | 10 | single | Chrono | `0.8·SP` | `status_slow` 100%, 2; removes Haste | — | Make a second last. (utility) |
| `wiz_rewind` | Rewind | Chronomancy | 3 | 14 | self/ally | — | — | `status_rewind` 2 (HP returns to the higher of now/then; cleanses Bleed/Burn/Poison on trigger) | 4 | Remember being whole. (defensive, `field`) |
| `wiz_stutter` | Stutter | Chronomancy | 4 | 16 | single | Chrono | `0.6·SP` | interrupt; `status_stun` 100%, 1 (non-boss) or `status_slow` 2 (boss) | 3 | Their next moment never arrives. (utility) |
| `wiz_unmoment` | Unmoment | Chronomancy | 5 | 30 | all | Chrono | `1.8·SP + 6` | `status_slow` 100%, 2 on all; self `status_haste` 2 | 5 | For one breath, you are the only thing that moves. (capstone) |

*Why Echo Bolt is no longer the answer:* `wiz_echo_bolt` keeps the legacy 10 MP cost and does 1.1·SP+2 — about 1.25× the cantrip — with no status; Fireball at 10 MP does 1.2·SP+3 plus a 60% Burn (expected ≈0.36·SP+1.8 over three ticks, ≈1.6U in all) and Static Lash sets up Storm combos. With regen at `3 + ⌊level/4⌋` the Wizard casts a Tier-1 spell roughly every second turn and fills with the cantrip (§19 #12). Against the Ruins' Shades (weak Fire) and Wisps (resist Ley), Fireball is the better Tier-1 and Echo Bolt is the filler. The legacy Dark Spellbook unlock chain is gone: Fireball and Lightning Bolt are ordinary tree abilities; spellbooks now grant Corruption and SP (§6.7, D-017).

### 5.4 Elf (`elf`)

*Fantasy.* A Silverwood-blooded ley-duelist (D-008): the old bloodlines of the capital, long-lived, ley-sensitive, trained to fight the way the city's fountains moved. Fast, evasive, and the only class that heals as naturally as it cuts.

*Resource.* Mana generated **+10 when an attack against you misses or is Phased, +6 on each of your crits**; small pool; the universal +5 on Guard.

*Base stats.* HP 90 (+7), MP 44 (+4), STR 7, MAG 7, AGI 10. *Starting kit.* Primitive Bow, Glow Moss ×2, 30 gold.

| id | Name | Branch | Tier | MP | Target | Type | Power | Status | CD | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| `elf_twin_strike` | Twin Strike | Bladesong | 1 | 8 | single | Physical | 2 hits × `0.65·ATK` (each rolls hit and crit) | — | — | Two notes, one breath. |
| `elf_dancers_guard` | Dancer's Guard | Bladesong | 2 | 8 | self | — | — | 2 turns: +25 evasion; each dodge grants +5 extra MP | 3 | Never be where the blade expects. (defensive) |
| `elf_flurry` | Flurry | Bladesong | 3 | 14 | single | Physical | 3 hits × `0.55·ATK`; a crit adds a 4th hit (max one) | — | 1 | The fountain-step, the arch-step, the fall. |
| `elf_crescendo` | Crescendo | Bladesong | 4 | 16 | all | Physical | `0.8·ATK`, +15% per Bladesong ability used earlier this fight (cap +60%) | — | — | The song remembers its own verses. |
| `elf_final_verse` | Final Verse | Bladesong | 5 | 24 | single | Physical | 5 hits × `0.5·ATK`; last hit guaranteed crit | self `status_haste` 2 | 4 | Silverwood's last dance, performed once. (capstone) |
| `elf_ley_mend` | Ley Mend | Leyweave | 1 | 8 | self/ally | heal | `14 + 1.2·SP` | — | — | The current wants things whole. Ask it. (defensive, `field`) |
| `elf_barkskin` | Barkskin | Leyweave | 2 | 10 | self/ally | — | Shield `12 + 1.4·SP`, 3 | `status_regen` `4 + 0.4·SP`/turn, 3 | 3 | Wear the forest for a while. (defensive) |
| `elf_thornlash` | Thornlash | Leyweave | 3 | 12 | single | Ley | `1.3·SP + 4` | `status_bleed` 100%, 3 | — | Green has teeth. |
| `elf_silverwood_bloom` | Silverwood Bloom | Leyweave | 4 | 16 | party | — | — | cleanse all negative statuses on player and companion; `status_regen` 3 on both; `status_soaked` 100%, 3 on all enemies | 4 | Dew falls on everything. Your enemies notice later. (utility) |
| `elf_heart_of_the_grove` | Heart of the Grove | Leyweave | 5 | 26 | party | — | 3 turns: `status_regen` `8 + 0.8·SP`, Shield `20 + 1.5·SP`, Ley damage dealt +30% | — | 5 | Stand where the capital's trees once stood. (capstone) |
| `elf_shadowstep` | Shadowstep | Shadowstep | 1 | 6 | self | — | — | `status_phase` 1; your next attack is a guaranteed crit | 2 | Between one shadow and the next. (defensive/utility) |
| `elf_ambush` | Ambush | Shadowstep | 2 | 12 | single | Physical | `1.6·ATK`; ×1.5 if you are Phased or you act before the target has acted this fight | — | — | The fight is decided before it is noticed. |
| `elf_blink_strike` | Blink Strike | Shadowstep | 3 | 12 | single | Physical | `1.1·ATK` | `status_weaken` 100%, 2; you act first next round | — | Cut the tendon, be gone. |
| `elf_veilwalk` | Veilwalk | Shadowstep | 4 | 14 | party | — | — | player and companion gain `status_phase` 1; removes Mark/Taunt from both; next flee auto-succeeds (non-boss) | 4 | Take someone with you into the between. (utility) |
| `elf_moment_between` | The Moment Between | Shadowstep | 5 | 24 | self | — | — | take a second full action immediately (cannot chain itself) | 5 | Two heartbeats in the space of one. (capstone) |

*Balance note:* multi-hit abilities roll each hit, so armor applies per hit; Bladesong is weak against high-armor Golems and strong against Phantoms/Wisps — the Leyweave branch covers the gap with Ley damage.

### 5.5 Ironclad Warden (`ironclad_warden`)

*Fantasy.* The Nomads' wall. Steel and stubbornness (Brak's words). You win by being the last one standing and making sure everything is hitting you. Slow, heavy, nearly immune to being rushed.

*Resource.* Mana as **Grit**: +6 MP each time you are hit by an enemy action, +8 per Guard (replaces the universal +5), +4 per enemy Taunted by Challenge. Small pool, low growth.

*Base stats.* HP 116 (+11), MP 30 (+2), STR 12, MAG 5, AGI 7. *Starting kit.* Nomad's Maul (`item_nomads_maul`, heavy, power 5, accuracy −5), Scrap Harness (`item_scrap_harness`, armor 2, ward 0), Ley-Touched Tonic ×1, 30 gold.

| id | Name | Branch | Tier | MP | Target | Type | Power | Status | CD | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| `wrd_iron_guard` | Iron Guard | Bulwark | 1 | 6 | self | — | Guard at 65% this round; +12 Grit; companion takes −25% this round | — | — | Set your feet. Let the hill come to you. (defensive) |
| `wrd_challenge` | Challenge | Bulwark | 2 | 8 | all | — | — | `status_taunt` 100%, 2 on all enemies | 2 | Here. Me. Now. (utility) |
| `wrd_shield_wall` | Shield Wall | Bulwark | 3 | 12 | party | — | Shield `18 + 1.2·ATK` on self and companion, 3 turns | — | 3 | Two is a wall. One is a wall that remembers two. (defensive) |
| `wrd_unbroken` | Unbroken | Bulwark | 4 | 14 | self | — | 2 turns: no single hit may exceed 25% of your max HP | immune to Stun and Slow for the duration | 4 | They will have to do it the slow way. (defensive) |
| `wrd_last_bastion` | Last Bastion | Bulwark | 5 | 20 | party | — | revive a KO'd companion at 40% HP (or heal 30%); Shield `30 + 1.5·ATK` on both; reflect 25% of damage taken as Physical, 2 turns | `status_taunt` 100%, 2 on all | 5 | The line holds because you are the line. (capstone) |
| `wrd_crushing_blow` | Crushing Blow | Breaker | 1 | 8 | single | Physical | `1.3·ATK`, accuracy −5 | `status_armor_break` 100%, 3 | — | Hit the plate until it stops being plate. |
| `wrd_concussive_slam` | Concussive Slam | Breaker | 2 | 12 | single | Physical | `1.0·ATK` | `status_stun` 75%, 1 (non-boss); bosses: `status_weaken` 2 | 3 | A bell rung inside a skull. (defensive/utility) |
| `wrd_earthbreaker` | Earthbreaker | Breaker | 3 | 16 | all | Physical | `0.9·ATK` | `status_slow` 100%, 2 | — | The ground is also a weapon. |
| `wrd_executioners_arc` | Executioner's Arc | Breaker | 4 | 16 | single | Physical | `1.6·ATK`; ×1.5 vs Armor Broken or Stunned | — | — | When the opening comes, take all of it. |
| `wrd_mountainfall` | Mountainfall | Breaker | 5 | 26 | single | Physical | `2.6·ATK` | `status_armor_break` 3; `status_stun` 1 (bosses: Stagger instead); you cannot Guard next turn | 4 | The Peaks falling on one head. (capstone) |
| `wrd_steady_breath` | Steady Breath | Iron Will | 1 | 6 | self | heal | `10 + 0.6·ATK`; removes one negative status (Burn, Bleed, Poison, Curse, Blind, Weaken, Slow, Shock — first found in that order) | — | — | Count to four. Spit. Continue. (utility, `field`) |
| `wrd_null_plate` | Null Plate | Iron Will | 2 | 10 | self | — | 3 turns: one resistance step against Fire, Storm, Ley, Void, Chrono | — | 4 | Magic skitters off. Borin says it's the rivets. (defensive) |
| `wrd_spellbreaker` | Spellbreaker | Iron Will | 3 | 12 | single | Physical | `1.1·ATK`; if the target's intent is non-Physical, interrupt it and gain 10 Grit | — | — | Interrupt the sentence. (utility) |
| `wrd_oathbound` | Oathbound | Iron Will | 4 | 12 | party | — | — | remove all negative statuses from player and companion; both immune to new statuses for 1 turn | 4 | An oath is a thing that does not bend. (utility) |
| `wrd_iron_silence` | Iron Silence | Iron Will | 5 | 24 | all | — | dispel Shield, Regen, Haste, Rewind, Phase from all enemies | `status_weaken` 100%, 3 on all; self immune to Fire/Storm/Ley/Void/Chrono for 2 turns | 5 | A world without magic, two turns at a time. (capstone) |

*Balance note:* the Warden deals ~20% less damage than the Ranger in aggregate and takes ~40% less; its damage share leans on Crushing Blow + Executioner's Arc (a two-step combo capped by the Breaker branch's 1.6U/16 MP).

### 5.6 Shadow Weaver (`shadow_weaver`)

*Fantasy.* Void-touched. You have heard the Chasm's murmur and answered. Your spells unmake; your body is the purse you pay from. Hex to control, Drain to endure, Unmaking to end things quickly or die trying.

*Resource.* Mana, normal pool; **Blood price**: any ability may be cast with insufficient MP by paying `2 HP per missing MP` (shown as a red cost preview). The total HP cost (Blood price plus any % HP self-cost) must be **less than** current HP, otherwise the ability is unavailable ("Not enough blood", D-066 #5). Drain abilities return HP.

*Base stats.* HP 90 (+7), MP 48 (+4), STR 6, MAG 10, AGI 8. *Starting kit.* Cracked Void Focus (`item_cracked_void_focus`, `void_focus`, power 2, spell power 2), Dark Spellbook ×1 (the lure), Ley-Touched Tonic ×1, 30 gold.

| id | Name | Branch | Tier | MP | Target | Type | Power | Status | CD | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| `wvr_hex_of_frailty` | Hex of Frailty | Hex | 1 | 8 | single | Void | `0.9·SP + 2` | `status_weaken` 100%, 2 | — | Take the strength out of the arm before it swings. (defensive via Weaken) |
| `wvr_mark_of_the_void` | Mark of the Void | Hex | 2 | 10 | single | Void | `0.8·SP` | `status_curse` 100%, 3 | — | A small, patient hunger. |
| `wvr_wither` | Wither | Hex | 3 | 16 | all | Void | `0.8·SP` | `status_weaken` 60%, 2 on all; Cursed targets also `status_slow` 2 | — | Everything in the room grows old at once. |
| `wvr_doom_sigil` | Doom Sigil | Hex | 4 | 14 | single | Void | after 3 of the target's turns: `3.0·SP`; Stun 1 if Cursed when it fires | — | 4 | Written now. Read later. (utility) |
| `wvr_ninefold_hex` | Ninefold Hex | Hex | 5 | 26 | all | Void | each already-Cursed enemy deals `0.5·SP` Void to every other enemy | `status_curse` 3, `status_weaken` 3, `status_armor_break` 3, `status_blind` 2 on all; costs 15% max HP | 5 | Nine names, spoken backwards. (capstone) |
| `wvr_siphon` | Siphon | Drain | 1 | 8 | single | Void | `1.0·SP + 2`; heal self 50% of damage dealt | — | — | What leaves them arrives in you. |
| `wvr_blood_pact` | Blood Pact | Drain | 2 | 0 | self | — | pay 15% max HP → gain 30% max MP | — | 2 | The price, paid forward. (utility) |
| `wvr_leech_veil` | Leech Veil | Drain | 3 | 12 | self | — | Shield `1.2·SP + 8`, 3 turns; 30% of damage the Shield absorbs heals you | — | 3 | Let the blow feed you. (defensive) |
| `wvr_soul_tether` | Soul Tether | Drain | 4 | 14 | single | Void | `0.6·SP` | 3 turns: 40% of all damage the target takes heals your party (split evenly) | — | Tie their hurt to your health. |
| `wvr_feast_of_moments` | Feast of Moments | Drain | 5 | 24 | all | Void | `1.4·SP + 4`; heal self 60% of total damage; overheal becomes Shield (3) | — | 4 | Eat the room. (capstone) |
| `wvr_void_lance` | Void Lance | Unmaking | 1 | 10 | single | Void | `1.3·SP + 3`; costs 8% max HP | — | — | Reach into the Breach and pull out something sharp. |
| `wvr_unravel` | Unravel | Unmaking | 2 | 12 | single | Chrono (D-067.18, D-085) | `1.1·SP`; removes Shield/Regen/Rewind/Haste; ×1.5 if something was removed | — | — | Pull the thread. Watch it all go. (utility) |
| `wvr_breach_echo` | Breach Echo | Unmaking | 3 | 10 | self | — | — | `status_phase` 1; your next Unmaking ability costs 0 MP; costs 5% max HP | 3 | Step into the instant between instants. (defensive) |
| `wvr_collapse` | Collapse | Unmaking | 4 | 20 | all | Void | `1.3·SP + 2`, +1% per 1% of your HP missing (cap +50%); costs 12% max HP | — | — | The closer you are to nothing, the more nothing you can hold. |
| `wvr_unmaking_word` | The Unmaking Word | Unmaking | 5 | 30 | single | Void | `3.2·SP + 10`; costs 40% of **current** HP; if the target dies, refund all HP spent and 20 MP | — | 5 | The word Veyran should never have learned. (capstone) |

*Balance note:* Void Lance is the strongest Tier-1 attack in the game (1.3·SP+3, D-066 #3) and costs 8% HP per cast; against Void-resistant creatures (Shades, Stalkers, the Tyrant) the Weaver must switch branches. The sim target is Void Lance ≤ 30% of Weaver damage.

### 5.7 Basic attacks by weapon type

| weapon_type | Users | Damage | Accuracy | Extra |
|---|---|---|---|---|
| `melee` | any | Physical `1.0·ATK` | +0 | Ranger: +8 Focus on hit (+12 crit). Interplay 15 (crit on Bleeding → +1 stack). |
| `ranged_bow` | any | Physical `0.9·ATK` | +5 | +5 crit chance; Ranger Focus as melee. |
| `magic_staff` | any | Ley `4 + 0.8·SP` ("cantrip", legacy name kept) | +10 (`spell`) | restores 3 MP on hit. |
| `shield_heavy` | any (Warden kit) | Physical `1.1·ATK` | −5 | +5 Grit on hit (Warden only); 10% chance to Stun non-bosses. |
| `void_focus` | any (Weaver kit) | Void `3 + 0.7·SP` | +10 (`spell`) | costs 2 HP; restores 4 MP on hit. |

Any class may wield any weapon; the class fantasy is carried by the trees and resource rules, not by weapon locks. Abilities scale off `ATK` or `SP` as written and are weapon-agnostic.

**Item-granted ability — the Amulet's Echo Bolt (D-047, D-066 #2).** While the Wayfinder carries the Amulet of Echoes (`item_amulet_of_echoes`: picked up on Day 1 of Loop 1, already on the neck from Loop 2, never reset), it grants every class one extra ability tile, so Loop 1 still plays like the original:

| id | Name | Source | MP | Target | Type | Power | Status | CD | Description |
|---|---|---|---|---|---|---|---|---|---|
| `itm_echo_bolt` | Echo Bolt (Amulet) | `item_amulet_of_echoes` | 10 | single | Ley | `max(0.75·ATK, 4 + 0.8·SP)` (D-067.19) | removes Rewind (interplay 9) | 1 | The Amulet remembers the first spell you ever saw. |

It costs no AP, is not part of any tree, and is the every-class answer to the Tyrant's Rewind. The Wizard's `wiz_echo_bolt` is the real spell and is strictly better for a Wizard.

---

## 6. Progression

### 6.1 XP curve (levels 1–20)

Shape: gently super-linear (`xp_to_next` grows ~1.3× per level early and ~1.1× late), chosen so that a thorough Loop 1 that follows WORLD §10.8 route T1 (the five legacy regions plus three side regions) ends at level 12–13, a Loop 1 that stays in the legacy regions ends at 10–11 (≈5,200 XP), a Loop 1 speedrun at ≥ 9 (≈3,700 XP), and a focused Loop 3+ through new regions reaches level 15–17 by its ending. The Contained Tyrant is tuned for level 11 (§4.10, §19 #11). Level 20 needs 26,900 total XP — reachable only in New Game+ or a very thorough loop.

| Level | XP to next | Total XP to reach | Level | XP to next | Total XP to reach |
|---|---|---|---|---|---|
| 1 | 100 | 0 | 11 | 1,340 | 5,240 |
| 2 | 150 | 100 | 12 | 1,560 | 6,580 |
| 3 | 220 | 250 | 13 | 1,800 | 8,140 |
| 4 | 300 | 470 | 14 | 2,060 | 9,940 |
| 5 | 400 | 770 | 15 | 2,340 | 12,000 |
| 6 | 520 | 1,170 | 16 | 2,640 | 14,340 |
| 7 | 650 | 1,690 | 17 | 2,960 | 16,980 |
| 8 | 800 | 2,340 | 18 | 3,300 | 19,940 |
| 9 | 960 | 3,140 | 19 | 3,660 | 23,240 |
| 10 | 1,140 | 4,100 | 20 | — | 26,900 |

Legacy was `level × 100` per level (cumulative 100, 300, 600, …, 19,000 at 20); the new curve is slightly steeper late and flatter early so that levels 2–6 arrive in the Ruins and Mistwood at a satisfying clip.

### 6.2 XP sources

| Source | Formula / value | Notes |
|---|---|---|
| Fodder kill | `xp = round(20 + 8·L + 1.2·L²)` where L = creature level | L1 29 · L2 41 · L4 71 · L6 111 · L8 161 · L10 220 · L12 289 · L14 367 · L16 455 · L18 553 |
| Elite kill | fodder × 1.8 | Stone-Hide Golem (L6) = 200 |
| Boss kill | hand-set | Contained Tyrant 900; Unveiled 1,600; regional bosses 400–1,200 (WORLD) |
| Loop variety nudge | creature XP × (1 + 0.03·min(loop−1, 5)) | mirrors the stat nudge |
| Quest completion | 60–600 by tier | Legacy re-rated: `q_echo_crystal` 120 (60 if kept — legacy halving kept), `q_lost_scroll` 150, `q_clear_path` 120, `q_blighted_outpost` 220, `q_void_shards` 260, `q_echoing_heartbeat` 400; faction chain 150/250/400; companion arc 150/250/400; regional 200–350; loop-only 300; ending quests 600 |
| Discovery | first visit **this loop** to a location: `10 + 5·bandMin` | Ruins 15, Mistwood 20, Voidscar 35, Highlands 40, Glowlands 55, Apex 85 … |
| First-time codex | +25 XP the first time any codex entry unlocks in the profile | one-time; later loops get Resonance only |
| Pacifist's Vow | kill XP 0; quest and discovery XP ×2 | D-021 |

### 6.3 Stat points, ability points, respec

- **+1 primary of choice per level** (legacy). Chosen on the level-up toast or later from the character panel; unspent points persist.
- **1 AP per level** (level 1 included); capstones cost 2; stored as half-points (§5.1).
- **Respec.** AP: at any camp fire, `50 × level` gold, once per day, refunds all AP (cooldowns and bar layout reset). Stat points: not respeccable inside a loop (they are too cheap to be a trap); the Threshold resets everything anyway.
- **Level-up** restores HP and MP to full (legacy behaviour kept) — it is one of the few free heals and the sim counts on it.

### 6.4 Class mastery

Per class, the profile records `mastered: AbilityId[]` — every ability ever unlocked in any loop. Re-unlocking a mastered ability costs **half**: Tier 1–4 = ½ AP (1 half-point), capstone = 1 AP (2 half-points). Level gates still apply, so a mastered Wizard at level 9 can hold 12 abilities but no capstone. Mastery also tracks `loopsPlayed`, `endingsReached`, `bestLevel` per class for the Far Light screen badges. Mastery is never lost; New Game+ copies it.

### 6.5 Level bands per region

| Region (D-015) | id | Band | Fodder HP range | Fodder ATK range |
|---|---|---|---|---|
| Silverwood Ruins | `region_silverwood_ruins` | 1–4 | 24–54 | 4–8 |
| Mistwood & the Ironclad Reach | `region_mistwood_ironclad_reach` | 2–6 | 40–80 (elite 90: the Golem pair, U81b2/D-140, was 130) | 8–14 |
| The Drowned Reach | `region_drowned_reach` | 4–8 | 60–95 | 10–15 |
| The Voidscar | `region_voidscar` | 5–8 | 70–95 | 12–15 |
| Aether-Kissed Highlands | `region_aether_kissed_highlands` | 6–10 | 72–110 | 13–17 |
| The Ashen Steppe | `region_ashen_steppe` | 7–11 | 85–120 | 14–19 |
| The Glowfen | `region_glowfen` | 8–12 | 95–140 | 15–20 |
| Glowlands & Nexus (excl. Apex) | `region_glowlands_nexus` | 9–13 | 105–160 | 17–22 |
| The Veil | `region_veil` | 10–14 | 120–180 | 18–24 |
| The Skyreach | `region_skyreach` | 12–15 | 150–210 | 21–27 |
| Silverwood Before | `region_silverwood_before` | 13–17 | 170–250 | 23–31 |
| The Temporal Breach Apex | `loc_temporal_breach_apex` | 15–18 | adds 200–280 | 28–36 |
| The Threshold | `region_threshold` | — | no combat | — |

Fodder HP rule of thumb: `hp ≈ 22 + 9·L` ± 20%; ATK `≈ 5 + 1.5·L`; armor `≈ L/3`; gold `[3 + 2L, 6 + 3L]`. Elites ≈ ×2 fodder HP. **Regional bosses sit 2 levels above their band's top** (D-066 #21; WORLD's +1 stats are retuned in U9) with HP ≈ 3.5–4.5× a fodder of the boss's level (the Tyrants: ×3.0 Contained after the D-066 retune, ×4.5 Unveiled) and 10–14 rounds to kill (§19).

### 6.6 The no-scaling rule and loop variety

- **No enemy scales with the player** (D-009). The legacy `apply_level` multipliers (HP ×1.15, damage ×1.10, defence ×1.07 per level, Tyrant = level+1) are removed. A level-9 Wayfinder in the Ruins one-shots Wisps; that is the point.
- **Loop 1 and the Apex band.** The Apex band (15–18) describes the Unveiled Tyrant and its anomaly adds from Loop 2. In Loop 1 a player arrives at level 9 (speedrun) to 13 (route T1), and the Contained Tyrant is hand-tuned for a **level-11** party (§4.10, D-066 #1). Its effective HP is budgeted, not just its HP bar: 460 HP + Brace (`0.6·SP` every second P1 turn, ≈30) + Aulde (`1.0·SP` per P2 rotation, ≈26–52) + two Rewinds capped at 10% (≤ 92, removed by any Void or Ley hit, so `itm_echo_bolt` answers it for every class) + adds the player must kill (1 × 112 HP Aberration at 40% with a companion, none solo; U81b2: 2 / 1 left companion fights at 24% wins in the §19 #19 sims) − the Phase 3 ×1.5 bonus (≈ −50) ≈ **≤ 850**, which a level-11 player dealing ≈ 47/round clears in ≈ 18 rounds (12 if the adds are ignored). Incoming damage in Phase 2 (Tyrant + adds) stays ≤ 40/round against a 210-HP L11 Ranger. The sim must confirm both L11 and L13 (§19 #11). (The legacy Tyrant at level 2 was 126 HP ×1.15 vs 100 HP / 50 MP and was not winnable either.)
- **Loop variety instead of scaling.** From Loop 2 each region gets a pool of **anomaly encounters** (`cr_anomaly_*`, REGISTRY §10.2): variants with one twist (an Echoed Shade that repeats its last intent; a Frayed Brute with permanent Haste; a Doubled Phantom that fights beside its past self; an Aberration pair sharing one Rewind). Spawn chance on entering a node with no fixed encounter: `10% + 5%·(loop−1)`, cap 30%. Anomalies give XP ×1.3 and a guaranteed material drop. WORLD.md defines two per legacy region and one per new region (minimum 16).
- **Tiny stat nudge.** All creatures: HP and ATK/SP × `(1 + 0.03·min(loop−1, 5))` — +3% per loop, capped at +15% from Loop 6. Shown in the bestiary as "Frayed +9%". Never more.

### 6.7 Corruption (0–6)

Reading a Dark Spellbook: −15 HP (legacy), +1 Corruption; the seventh book cannot be read (legacy line kept: "I've already seen too much"). Effects, cumulative:

| Corruption | Effect |
|---|---|
| each point | Wizard and Shadow Weaver: +1 SP. Other classes: Void damage dealt +5%. All: Ley damage dealt −3%. |
| 1 | Nyx dialogue branch "You have read Maelis." |
| 3 | "Veil-touched": Weaver vendor in the Veil sells to you; `wvr_*` abilities cost −1 MP; Ilyra remarks (legacy spellbook lore line moves here). Codex `codex_maelis_korr` unlocks (STORY: `echo_korr_marginalia` or Corruption ≥ 3). |
| 6 | "Marked for the Weavers": Remnants −10 (D-017); max HP −10%; Breach Clock −4 watches (−1 day, subject to the clock floor §10.1); ending E locked unless cleansed by Elder Wen at the Breathing Pool (`npc_elder_wen`, `loc_breathing_pool`, D-064: one full rest there + `item_glow_moss` ×3; sets Corruption 0 and removes all bonuses; sets `flag_corruption_cleansed`). |

Corruption resets with the loop. `echo_korr_marginalia` lets the player read the first spellbook without the HP cost (they know which pages to skip).

---

## 7. Items and equipment

### 7.1 Slots and types

Equipment slots: `weapon`, `armor`, `trinket_1`, `trinket_2`. Item types: `weapon`, `armor`, `trinket`, `consumable`, `material`, `quest`, `key`, `recipe`, `tome`.

- `quest` items are bound (cannot be sold, dropped or salvaged) and live in the Satchel tab; those with passive stats (Amulet of Echoes) apply without a slot.
- `key` items open exits/routes (Chronos Lens is both `trinket` and `key` via `tags`).
- `recipe` items unlock a Borin recipe when read (consumed).
- `tome` items are read (consumed) for Corruption/codex (Dark Spellbook; three new codex tomes).

### 7.2 Rarity

Five tiers kept with legacy multipliers and base weights: Common 50% ×1.0 · Uncommon 30% ×1.1 · Rare 15% ×1.25 · Epic 4% ×1.5 · Legendary 1% ×1.75. Weights shift with band: bands ≥9 use 35/35/20/8/2; bands ≥13 use 25/35/25/12/3. Rarity scales: weapon `power` and `spell_power`, armor `armor` and `ward` (negative ward is not scaled), trinket primary stat bonuses, `gold_value`. Scaled values round half-up with a minimum of +1 over the previous tier. Consumables, materials, quest, key, recipe and tome items have no rarity (legacy rule kept).

### 7.3 Affixes

Uncommon gear has a 50% chance of one affix; Rare always one; Epic 1–2; Legendary 2 (never duplicates). Affixes append their suffix to the display name ("Warrior's Sword of Embers").

| id | Suffix | On weapon | On armor | On trinket |
|---|---|---|---|---|
| `affix_of_embers` | of Embers | basic attacks add 15% of damage as Fire | one resistance step vs Fire | +10% Fire damage dealt |
| `affix_of_the_gale` | of the Gale | +2 initiative | +5 evasion | both |
| `affix_of_ley` | of the Ley | +10% Ley damage dealt | +5 max MP | +5 max MP |
| `affix_of_the_void` | of the Void | 15% chance on hit to apply Curse (3) | one step vs Void | +10% Void damage dealt |
| `affix_of_moments` | of Moments | 10% chance on hit to apply Slow (2) | one step vs Chrono | +1 initiative |
| `affix_of_iron` | of Iron | +10% damage vs Armor Broken | +2 armor | +1 armor |
| `affix_of_the_hunt` | of the Hunt | +5 crit chance | — | +3 crit chance |
| `affix_of_vigor` | of Vigor | — | +8% max HP | +5% max HP |
| `affix_of_the_wellspring` | of the Wellspring | class resource generation +25% | +2 MP regen per turn | +2 MP regen per turn |
| `affix_of_thorns` | of Thorns | 10% chance on hit to Bleed (3) | reflect 10% of melee damage taken as Physical | — |
| `affix_of_the_warden` | of the Warden | — | Guard reduces 60% instead of 50% | Guard reduces 55% |
| `affix_of_echoes` | of Echoes | — | — | +10% XP from kills (not stackable) |

### 7.4 Item tiers (level bands)

| Item tier | Band | Weapon power | Staff/focus power / spell power | Armor (armor / ward) | Trinket stat bonus | Base value |
|---|---|---|---|---|---|---|
| T1 | 1–4 | 4–6 | 2 / 1–2 | 2–3 / 0–1 | +1 | 8–40 |
| T2 | 5–8 | 7–10 | 3–4 / 3–4 | 4–6 / 1–2 | +1–2 | 40–110 |
| T3 | 9–13 | 11–14 | 5–6 / 5–7 | 7–9 / 2–3 | +2 | 110–220 |
| T4 | 14–15 | 15–20 | 7–8 / 8–10 | 10–12 / 3–4 | +2–3 | 220–400 |
| T5 | 16–18 | 21–24 | 9 / 11–13 | 13–15 / 4–5 | +3 | 400–650 |

T5 (D-066 #22, WORLD §7) is capstone gear for Silverwood Before and the Apex, almost all crafted from a read pattern; T4 pieces may still appear in 16–18 bands as lower-rarity fill. Item mechanical fields used by WORLD (`power`, `spell_power`, `armor`, `ward`, primary bonuses, `max_hp`/`max_mp` flat or %, `crit`, `accuracy`, `initiative`, `mp_cost_reduction`, `life_steal`, `dmg_bonus` by type, `resist` steps, `on_hit` status chance) are the complete stat vocabulary; PLAN §5.5 schemas exactly these.

### 7.5 Prices
Sell price = `floor(0.75 × gold_value)` (legacy 75% kept), where `gold_value` already includes the rarity multiplier. Buy price per §9.2. Quest items cannot be sold (legacy "I don't buy quest relics").

### 7.6 Item budget (target ≥120)

| Type | Count | Of which legacy | Notes |
|---|---|---|---|
| weapon | 30 | 8 | 6 melee, 6 ranged_bow, 6 magic_staff, 6 shield_heavy, 6 void_focus across T1–T4 |
| armor | 18 | 3 | light/medium/heavy × T1–T4, plus Ironclad set and void-forged mail |
| trinket | 20 | 5 | the Heartstone pair, Chronos Lens, Sky-Whisper Talisman, Glyphbound Lantern + 15 new |
| consumable | 16 | 4 | Ley-Touched Tonic, Mana Bloom, Chronal Dust (also a material), Glow Moss; new: antidotes, ward salts, throwables, Lanternreed Salts |
| material | 21 | 2 | Void Shard, Aetherium Shard + 19 `mat_*` (§8.2; Chronal Dust is a consumable that also serves as a material and is counted under consumable) |
| quest | 14 | 3 | Amulet of Echoes, Echo Crystal, Scholar's Lost Scroll + anchors, fragments, ending items |
| key | 6 | 0 | region gates (`item_cistern_key`, Veil sigil, Skyreach chain…) |
| recipe | 10 | 0 | one per Borin advanced recipe |
| tome | 4 | 1 | Dark Spellbook + 3 codex tomes |
| **Total** | **139** | **26** | a floor, not a cap: WORLD §7 authors **157** (incl. T5), adopted (REVIEW-CROSS C-43) |

### 7.7 Legacy items — new ids and rebalanced numbers

| Legacy name (kept exactly) | id | Type | Tier | New numbers | Value |
|---|---|---|---|---|---|
| Rusty Dagger | `item_rusty_dagger` | weapon `melee` | T1 | power 4 | 8 |
| Amulet of Echoes | `item_amulet_of_echoes` | quest (bound, slotless) | — | +1 MAG passive; grants `itm_echo_bolt` (§5.7); the loop's memory vessel; **never reset** — the one exception to the inventory wipe (D-047) | 60 (unsellable) |
| Ley-Touched Tonic | `item_ley_touched_tonic` | consumable | T1 | +25 HP, +15 MP (unchanged) | 12 |
| Ironclad Mail | `item_ironclad_mail` | armor | T1/T2 | armor 4, ward 1 | 40 |
| Echo Crystal | `item_echo_crystal` | quest | — | — | 70 |
| Dark Spellbook | `item_dark_spellbook` | tome | — | read: −15 HP, +1 Corruption | 8 |
| Mana Bloom | `item_mana_bloom` | consumable | T1 | +10 HP, +30 MP (unchanged) | 25 |
| Scholar's Lost Scroll | `item_scholars_lost_scroll` | quest | — | — | 45 |
| Void Shard | `item_void_shard` | material (stack 99) | — | crafting + Nyx's quest | 20 |
| Shadow-Kissed Dagger | `item_shadow_kissed_dagger` | weapon `melee` | T2 | power 7; 20% on hit: Curse (3) on target; each hit costs the wielder 2 HP ("hungers for its wielder") | 75 |
| Ironclad Plate Armor | `item_ironclad_plate_armor` | armor | T2 | armor 6, ward −2 ("weak to magic") | 65 |
| Stabilized Heartstone | `item_stabilized_heartstone` | trinket (bound) | — | +1 MAG, +15 max MP; grants `echo_heartstone_resonance` | 90 |
| Heartstone Core | `item_heartstone_core` | trinket (bound) | — | +2 MAG, +25 max MP, −15 max HP | 100 |
| Chronal Dust | `item_chronal_dust` | consumable | T2 | +25 MP (unchanged) | 18 |
| Glow Moss | `item_glow_moss` | consumable | T1 | +20 HP, +5 MP (unchanged); Corruption-cleanse ingredient (Elder Wen, §6.7) | 10 |
| Aetherium Shard | `item_aetherium_shard` | material (stack 99) | — | Breach-anchor ingredient | 28 |
| Sky-Whisper Talisman | `item_sky_whisper_talisman` | trinket + key | T2 | +1 AGI; permits the Skyreach ascent | 32 |
| Chronos Lens | `item_chronos_lens` | trinket + key | T3 | +2 MAG, +10 max MP; Breach-door key with `echo_litany_verse_1` | 120 |
| Traveler's Sword | `item_travelers_sword` | weapon `melee` | T1 | power 5 | 20 |
| Primitive Bow | `item_primitive_bow` | weapon `ranged_bow` | T1 | power 4 | 15 |
| Elven Bow | `item_elven_bow` | weapon `ranged_bow` | T2 | power 8, +1 AGI | 70 |
| Apprentice Staff | `item_apprentice_staff` | weapon `magic_staff` | T1 | power 2, spell power 1, MP costs −10% | 30 |
| Necromancer Staff | `item_necromancer_staff` | weapon `magic_staff` | T2 | power 4, spell power 3, MP costs −20%, lifesteal 5% | 100 |
| Warrior's Sword | `item_warriors_sword` | weapon `melee` | T2 | power 7 | 40 |
| Wildling Hide Armor | `item_wildling_hide_armor` | armor | T1 | armor 2, ward 1 | 25 |
| Glyphbound Lantern | `item_glyphbound_lantern` | trinket | T1 | +1 MAG | 30 |

The legacy "Stabilized Heartstone +1 MAG +15 mana" and "Heartstone Core" passive-once rule (`passive_bonus_*` flags) becomes ordinary trinket equipping; the Core's −15 HP becomes −15 max HP so it is a real trade.

### 7.8 Stacking and inventory limits

- No weight. **40 stack slots** for weapon/armor/trinket/consumable/material/recipe/tome; quest and key items live in the Satchel and do not count.
- Gear never stacks (each piece has rarity/affixes). Consumables stack to **10**; materials to **99**; tomes to 5.
- Equipped items occupy no slots. A full inventory blocks pickup with a prompt to drop/sell; loot left on the ground persists at the node until the next dawn.

### 7.9 Consumable use rules

- In combat: using an item is the turn's action; only `consumable` items; Dark Spellbooks cannot be read in combat.
- Out of combat: free; healing items cannot exceed max; Dark Spellbook reading is confirmed with the Corruption preview.
- Throwable consumables (`item_ember_flask` Fire 25 + Burn, `item_storm_jar` Storm 20 + Shock, `item_ward_salts` Shield 20, `item_antidote_root` cleanse Poison/Bleed, `item_lanternreed_salts` revive companion 30%) exist so non-casters can touch the interplay table.

---

## 8. Crafting at the Emberforge

Borin Stonefist is the only crafter (D-015/legacy). The Emberforge is the only forge node. No crafting helpers exist (not in DECISIONS).

### 8.1 Recipe format

```ts
type Recipe = {
  id: string;                        // "recipe_voidforged_edge"
  name: string;
  output: { item: ItemId; rarity?: Rarity; count?: number };
  inputs: { item: ItemId; count: number }[];
  gold: number;                      // Borin's fee, before Attunement discount
  repTier: "neutral" | "trusted" | "sworn";   // Ironclad Nomads tier required
  requiresEcho?: EchoId[];
  requiresFlag?: string[];
  requiresItemRead?: ItemId;         // a recipe item that must have been read this loop (or known via Echo)
  timeCost: 0 | 1;                   // watches; the first craft per visit costs 1, later ones 0
};
```

### 8.2 Materials (26 entries: 25 material-typed items plus Chronal Dust) and sources by creature family

| id | Name | Stack | Source |
|---|---|---|---|
| `mat_shadow_ash` | Shadow Ash | 99 | family `shade` (Corrupted Shade) 80% |
| `mat_wildling_hide` | Wildling Hide | 99 | family `wildling` (Wildling Brute) 80% |
| `mat_rootbone` | Rootbone | 99 | `wildling` 40%; Mistwood gathering |
| `mat_ley_spark` | Ley Spark | 99 | family `wisp` (Arcane Wisp) 80% |
| `mat_sodden_vellum` | Sodden Vellum | 99 | family `drowned` (Drowned Archivist) 80% |
| `item_void_shard` | Void Shard (legacy) | 99 | family `void_touched` (Void-Touched Stalker) 100% |
| `mat_slate_core` | Slate Core | 99 | family `golem` (Stone-Hide Golem) 100% |
| `mat_iron_rivet` | Iron Rivet | 99 | `golem` 60%; Ironclad Camp vendor |
| `item_chronal_dust` | Chronal Dust (legacy, also consumable) | 10 | family `phantom`, `aberration` 100% |
| `mat_frayed_moment` | Frayed Moment | 99 | `aberration` 80%, `phantom` 30% |
| `item_aetherium_shard` | Aetherium Shard (legacy) | 99 | family `aetherial` (Aetherial Weaver) 100%; Spires gathering |
| `mat_spire_thread` | Spire Thread | 99 | `aetherial` 70% |
| `mat_gale_feather` | Gale Feather | 99 | family `sentinel` (Sky-Whisper Sentinel) 80% |
| `mat_glow_gland` | Glow Gland | 99 | family `mireling` (Glowfen Mireling) 70% |
| `mat_tyrant_shard` | Tyrant Shard | 9 | `chronos_tyrant_*` on kill (Loop 2+), 1 per phase cleared |
| `mat_ember_ore` | Ember Ore | 99 | Emberforge vein (3/loop; 8 with `echo_emberforge_vein`), Ashen Steppe gathering |
| `mat_silverwood_heartwood` | Silverwood Heartwood | 99 | Silverwood Before gathering |
| `mat_breach_glass` | Breach Glass | 99 | The Veil gathering; `cr_tyrants_reach` 40% |
| `mat_drowned_pearl` | Drowned Pearl | 99 | Drowned Reach gathering |
| `mat_skyreach_crystal` | Skyreach Crystal | 99 | Skyreach gathering |
| `mat_steppe_salt` | Steppe Salt | 99 | Ashen Steppe gathering; Nomad vendor |
| `mat_ley_resin` | Ley Resin | 99 | Mistwood gathering; Wayfarer's Respite vendor |
| `mat_bell_bronze` | Bell Bronze | 99 | `cr_bell_ringer`; Drowned Reach gathering (WORLD §8.1) |
| `mat_cinder_horn` | Cinder Horn | 99 | `cr_cinderback`; Ashen Steppe gathering (WORLD §8.1) |
| `mat_storm_glass` | Storm Glass | 99 | `cr_steppe_harrier` 30%; Steppe/Skyreach gathering (WORLD §8.1) |
| `mat_umbral_thread` | Umbral Thread | 99 | `cr_vells_umbra`, `cr_null_mouth` 30%; Veil gathering; Weavers Sworn vendor (WORLD §8.1) |

Family names in this table are **material kin** for loot tables; creature lore follows WORLD §5's eight `fam_*` families (REVIEW-CROSS C-19). The last four rows were added by WORLD (REVIEW-CROSS C-42); WORLD places their gathering nodes.

Gathering nodes yield 1–2 units per visit per day (reset at dawn); the engine records per-node use in `world.gather`.

### 8.3 Upgrades (rarity tier-up)

Legacy cost multipliers kept and materials added from Rare:

| From → To | Gold fee | Materials | Rep |
|---|---|---|---|
| Common → Uncommon | 0.50 × gold_value | none (gold-only, so poverty never blocks a first upgrade) | neutral |
| Uncommon → Rare | 1.00 × | `mat_ember_ore` ×2 | neutral |
| Rare → Epic | 1.50 × | `mat_ember_ore` ×3 + 2 of the item's tier material (T1 `mat_wildling_hide`/`mat_ley_spark`, T2 `mat_slate_core`, T3 `mat_spire_thread`/`mat_glow_gland`, T4 `mat_skyreach_crystal`) | trusted |
| Epic → Legendary | 2.00 × | `mat_ember_ore` ×5 + `mat_frayed_moment` ×2 + 1 regional rare (`mat_breach_glass`, `mat_drowned_pearl`, `mat_silverwood_heartwood`, or `mat_tyrant_shard`) | trusted |

Upgrading re-rolls nothing: existing affixes stay; reaching Rare/Epic/Legendary adds affix slots to the tier's count, filled by player choice from three offered. Legendary cannot be upgraded (legacy).

### 8.4 Salvage
Destroy a non-quest item: Common 1 material of its tier, Uncommon 2, Rare 2 + 1 ember ore, Epic/Legendary 3 + 2 ember ore (+ the item's affix material: an "of the Void" piece returns a Void Shard). No gold. Takes 0 watches.

### 8.5 Special recipes

| id | Output | Inputs | Gold | Rep | Requires |
|---|---|---|---|---|---|
| `recipe_breach_anchor` | `item_breach_anchor` (quest; "Breach-anchor") | `item_aetherium_shard` ×3, **one Heartstone fragment** (`item_heartstone_fragment_stable` from Stabilize **or** `item_heartstone_fragment_dead` from Destroy), `item_void_shard` ×3 (its "void resonance"), `mat_ember_ore` ×3, `mat_silverwood_heartwood` ×1 | **0** (story recipe) | trusted; **neutral** while `q_the_mending` or `q_iron_silence` is active | `echo_anchor_schema` (the quest stage also requires STORY's `echo_iron_that_does_not_wish`) |
| `recipe_voidforged_edge` | `item_voidforged_edge` (melee, T3, power 12, 20% Curse on hit, no self-cost) | `item_void_shard` ×3, `mat_ember_ore` ×3, `mat_iron_rivet` ×2 | 120 | trusted (or `echo_borin_oath`) | Void Shards refused to Nyx this loop (`flag_shards_refused`) |
| `recipe_voidforged_mail` | `item_voidforged_mail` (armor T3, armor 8, ward 3, one step vs Void) | `item_void_shard` ×4, `mat_slate_core` ×2, `mat_ember_ore` ×3 | 150 | trusted | as above |
| `recipe_voidforged_band` | `item_voidforged_band` (trinket, +2 MAG, Void damage +10%) | `item_void_shard` ×2, `mat_breach_glass` ×1 | 90 | trusted | as above |
| `recipe_ley_tuned_*` (4) | Ley-tuned weapon/armor/trinket/consumable line | `mat_ley_spark`, `item_aetherium_shard`, `mat_ley_resin` | 80–200 | neutral | Heartstone Stabilized this loop (D-017 "Ley-tuned crafting") |
| `recipe_storm_jar`, `recipe_ember_flask`, `recipe_antidote_root`, `recipe_ward_salts` | throwables ×3 | T1–T2 materials | 15–30 | neutral | — |

The Breach-anchor's behaviour at the Apex depends on the fragment used: a stable fragment seals (ending B route); a dead fragment cuts (ending D route). Exploiting the Heartstone yields no fragment, so no anchor can be forged in that loop — consistent with ending C needing none. **Stabilize yields `item_heartstone_fragment_stable` ×2 and Destroy `item_heartstone_fragment_dead` ×2** (D-066 #10), so Mireya's dam (D-052, either fragment) and the anchor fit in one loop.

**Story recipes cost 0 gold** (D-066 #10; §9.6 rule 5): any recipe a quest stage requires charges no fee and its rep gate drops to Neutral while that quest is active. `echo_void_resonance` is not a recipe requirement; it is checked at ending B's consent (§4.11, D-054), so a dead-fragment anchor for ending D needs no Weavers loop. The ember-ore requirement (×3) fits the vein's 3 per loop without `echo_emberforge_vein`.

---

## 9. Economy

### 9.1 Sources and sinks (expected per loop)

| Band | Kills/loop (explorer) | Gold per kill | Kill gold | Quest gold | Loot sales | Caches | Band total earned |
|---|---|---|---|---|---|---|---|
| 1–4 (Ruins) | 8 | 5–12 | ~70 | 60 | 40 | 30 | ~200 |
| 2–6 (Mistwood) | 7 | 9–18 | ~95 | 80 | 60 | 40 | ~275 |
| 5–8 (Voidscar, Drowned) | 7 | 13–27 | ~140 | 120 | 90 | 50 | ~400 |
| 6–11 (Highlands, Steppe) | 8 | 15–39 | ~215 | 160 | 120 | 60 | ~555 |
| 8–13 (Glowfen, Glowlands, Nexus) | 7 | 19–45 | ~225 | 200 | 150 | 80 | ~655 |
| 10–18 (Veil, Skyreach, Before, Apex) | 8 | 23–60 | ~330 | 300 | 200 | 100 | ~930 |

Loop 1 (legacy regions only): ≈1,250 gold earned; focused Loop 3+: ≈1,600–2,200. Sinks and expected spend per loop: consumables 250–400; gear 300–600; upgrades 250–500; inns 60–120; Borin special recipes 300–600; bribes/tolls (Steppe ferry 20, Veil tithe 30) ~50. Expected end-of-loop balance: 50–200 (gold resets anyway).

### 9.2 Price formula

`buy = round(gold_value × region_markup × tier_mod × (1 − ledger_discount))`

- `gold_value` includes rarity (§7.2).
- `region_markup` (per merchant, WORLD §9.1): Kaelen (Wayfarer's Respite) 1.0 · Tamsin (Silverwood Plaza) 1.0 · Borin (Emberforge) 1.0 · Sedge (Lamplighters' Rest) 1.1 · Tessaly (Hearthring / Ironclad Camp caravan) 1.0 · Fennick (Lanternreed) 1.1 · Hollis Cade (Sanctum of Threads) 1.2 · Anso (Silverwood Before) 1.2. There is no Skyreach merchant (REVIEW-CROSS C-31).
- `tier_mod` by the merchant's faction tier (D-014): Hostile — **refuses to trade** (dialogue line, no shop); Wary ×1.15; Neutral ×1.0; Trusted ×0.90 (−10%); Sworn ×0.80 (−20%). Kaelen (neutral ground) uses the *best* of the player's three tiers but never refuses.
- `ledger_discount`: 5% from `att_kaelens_ledger`, plus 5% at Kaelen only from `echo_kaelen_ledger` (additive, max 10%).
- Selling is always `floor(0.75 × gold_value)` regardless of tier (a Hostile vendor still refuses).

### 9.3 Restock
Merchant stock regenerates **on every dawn** (full rest), not every 5 moves (legacy). Each merchant has a fixed core list (always present) plus `3–4` random gear picks from its theme pool, re-rolled at dawn. Items sold by the player stay in that merchant's stock until the next dawn (buy-back).

### 9.4 Regional merchant stock themes

| Merchant | Node | Core | Theme pool |
|---|---|---|---|
| Kaelen Stonehand (`npc_kaelen_stonehand`) | `loc_wayfarers_respite` | Ley-Touched Tonic ×3, Mana Bloom ×1, Antidote Root ×2 | any T1–T2 weapon/armor not quest-locked (legacy exclusions kept: no Warrior's Sword, no Shadow-Kissed Dagger) |
| Tamsin Reed (`npc_tamsin_reed`, Remnant scribe-merchant) | `loc_silverwood_plaza` | Chronal Dust ×2, codex tomes | staves, trinkets of the Ley, recipes |
| Borin Stonefist (`npc_borin_stonefist`) | `loc_emberforge` | Iron Rivet ×5, Ward Salts ×2 (he also carries Ironclad core stock until the caravan arrives) | heavy weapons, medium/heavy armor T1–T3, `affix_of_iron`/`affix_of_the_warden` bias |
| Sedge Marrow (`npc_sedge_marrow`) | `loc_lamplighters_rest` | per WORLD §9.2 | materials, consumables, armor |
| Tessaly Varr (`npc_tessaly_varr`, caravan master) | `loc_hearthring`; caravan at `loc_ironclad_camp` after `flag_hearthring_caravan` | Steppe Salt ×3, Iron Rivet ×5 | heavy weapons, medium/heavy armor T2–T4 |
| Old Fennick (`npc_old_fennick`) | `loc_lanternreed` (Glowfen) | Glow Moss ×5, Antidote Root ×3, Lanternreed Salts ×1 | light armor, bows, herbs |
| Hollis Cade (`npc_hollis_cade`) | `loc_sanctum_of_threads` | Dark Spellbook ×1, Void Shard ×2 (expensive) | void focuses, `affix_of_the_void` gear; requires Weavers ≥ Neutral or Corruption ≥ 3 |
| Bellwright Anso (`npc_bellwright_anso`) | `loc_plaza_of_bells` (Silverwood Before) | per WORLD §9.2 | trinkets, consumables; restocks each Before day |

Core lists and theme pools beyond these lines are WORLD §9.2's (D-062: WORLD owns placement and stock lists; this section owns prices and cadence).

### 9.5 Inn and camp costs
- **Camp** (designated nodes, ≥1 per region): short rest free (1 watch, +30% HP/MP); full rest free (to dawn).
- **Inn** (Respite, Hearthring/Ironclad Camp caravan, Lanternreed, Sanctum of Threads — WORLD §9.1): full rest costs 10 gold and grants `status_rested` for the first fight of the day (+2 initiative, +5 accuracy). `att_old_road`: one free inn rest per loop.
- Resting at the Whispering Ruins (Ilyra's fire) is free and always available — the Day-1 anchor.

### 9.6 Never soft-locked by poverty
1. Every kill drops at least `3 + 2L` gold. 2. Kaelen buys anything non-quest at 75% and never refuses. 3. Camps are free; the Ruins camp is always reachable. 4. Common → Uncommon upgrades are gold-only; every story recipe costs 0 gold and accepts materials the player necessarily holds by then (§8.5). 5. No quest, exit, ending or Echo requires gold. 6. The bot harness asserts `gold ≥ 0` and that `the cheapest healing consumable (Glow Moss, 10g) is affordable within two kills` at every band.

---

## 10. The Loop system

### 10.1 The Breach Clock

- A loop starts **Day 1, Dawn**. Four watches per day: `dawn → day → dusk → night`. The clock is stored as an integer `clock.ticks` (one tick = one watch; 0 = Day 1 Dawn; 4 per day); `(day, watch)` is derived for display. The limit is `clock.limitTicks`. Every clock effect in data is in **watches** (`clockWatches`, D-066 #15).
- **Travel** between adjacent nodes = 1 watch. **Combat** = 0. **Short rest** = 1 watch (+30% HP/MP). **Full rest** = advance to the next dawn (full HP/MP, companion swap, restock, camp conversation). Resting at Dawn still advances to the *next* dawn (a whole day) — the UI warns.
- Night travel: +10% anomaly/wandering chance; Kaelen and Tessaly are closed (Borin works through the night).
- **Events that cost time** (data field `timeCost` on effects): Heartstone ritual 1 watch; first forge action per visit 1 watch; Drowned Reach sluice draining 1 watch; Skyreach ascent 2 watches per climb (WORLD's 2-watch ascent edges); the Ashen Steppe crossing is graph distance (4 watches Outpost → Glowlands by the south road), and `echo_steppe_waystones` (STORY §12 addition; source `q_bone_road`) opens WORLD's conditional 1-watch road `loc_scorched_gate` ↔ `loc_reedmarch_descent`, making it 3 (REVIEW-CROSS C-46, WORLD X3 accepted here); Nyx's rite at the Sanctum of Threads 1 watch; Dask's "walk between" at the Nexus 1 watch; Elder Wen's Corruption cleanse = one full rest. **Silverwood Before is time-locked for the Breach Clock** and runs its own three-day counter (below).
- Legacy pacing check: ~60 travels + ~15 full rests ≈ 22–26 days for a thorough Loop 1 (D-005).

**Limit and modifiers.** Base limit: containment collapses at **Day 30 Dawn** (`clock.limitTicks = 116`). Modifiers below are shown in days for readability and stored in watches (1 day = 4).

| Source | Clock change |
|---|---|
| Base (D-005) | 30 days |
| Heartstone — Stabilize (D-017) | +6 days |
| Heartstone — Exploit (D-017) | −5 days |
| Heartstone — Destroy (D-017) | −10 days |
| Anchor the Conflux (`q_the_mending` stage `anchor_the_conflux`, Silverwood Before) | +3 days |
| `q_day_of_teeth` (Hadda sends scouts east; STORY) | −2 days |
| Corruption 6 ("Marked") | −1 day |
| Tyrant communion reaching Resolve ≥ 4 (first time this loop) | +2 days this loop ("it steadies when heard") |
| `att_steady_hours` | +1 day |
| `mod_frayed_clock` (D-021) | base 20 days; all other modifiers halved toward zero |

**Clock floor** (D-066 #8). No clock effect may set the limit earlier than **the current day + 3 dawns** (`limitTicks ≥ dayStartTick(now) + 12`); a reduction that would go past the floor stops at it. In Loop 1, where the clock is subtle, Borin (or Brak if present) says the new count aloud after a Destroy ("Twenty dawns, Wayfinder. Not thirty."), WORLD §10.10 #1.

**Ending E's gate** is relative to the limit, not a fixed day: `q_long_archive`'s final stage requires `{ clock: { daysLeft: { max: 1 } } }` — the last dawn before collapse — so it also works under Frayed Clock (D-066 #8).

**Warnings** (text + HUD state; Loop 1 lines are delivered by NPCs/ambient so the counter stays subtle, Loop 2+ as explicit Breach Clock callouts). They fire at fixed **dawns before the limit** (Days 20/25/28/29 at the base limit of 30):

| Dawns left | Loop 1 | Loop 2+ | HUD |
|---|---|---|---|
| 10 | Ilyra: "The whispers have changed key." | "Ten dawns remain." | clock turns amber |
| 5 | Brak: "The east is bleeding light." Map: violet hatch appears on the Apex node. | "Five dawns." Infection forecast drawn on the map | amber, pulsing (static in reduced motion) |
| 2 | Nexus and Glowlands nodes show infection | "Two dawns." | red |
| 1 | All eastern regions hatched; ambient audio detunes | "One dawn." | red, bold |
| 0 (limit) | **Clock expiry → the Horde** (§10.2) | **Clock expiry → the Horde** | — |

**Silverwood Before clock** (D-066 #9). Inside `region_silverwood_before` the Breach Clock is frozen. The run state carries `before = { day: 1 | 2 | 3, resets: number }`, set to Day 1 on every entry. Before edges cost 0 watches; **resting at the Garret** advances the Before day (and is the Before's only full rest); resting there on Day 3 brings Last Bell dusk: the ninth verse is spoken and the echo **resets to Day 1** (`resets + 1`, one attempt of `q_stop_the_ritual` per reset, STORY §9) unless that quest has been resolved. On a reset, Before-local flags, items on the ground and enemies reset; Echoes, inventory, Conflux anchors (`flag_conflux_anchored`, `flag_cradle_pin_anchored`) and Caelum's memory persist. The engine mirrors the day into `flag_before_day_1..3` for WORLD's world-state variants; conditions read it as `{ beforeDay: n }` and `{ beforeResets: { min } }` (§13.3). Merchants in the Before restock at each Before day. **Returning to the present** from the Before costs **1 Breach-Clock day** (4 watches, a `passWatches` effect on the exit edge; D-067.5), and the Before's loot and XP are granted **once per loop** — a re-entry after a return or an echo reset does not pay them out again.

### 10.2 The Fall (clock expiry)

Clock expiry is **not** a cutscene (D-060, D-066 #7). At the limit the sky tears above the Apex (art layer `breach_overlay`), the legacy node-by-node **Horde infection** starts from `loc_temporal_breach_apex` after a **3-move delay** (WORLD R10-3, so no node is a death trap), and **Ilyra's portal opens at the Shattered Library**. The loop closes when the player either:

- reaches the portal → `closer_escape`; or
- dies in the Horde → `closer_fall` with reason `expiry` (a death in the post-Tyrant Horde has reason `death`).

**Ending a loop on purpose** (D-067.14). From **Loop 2**, every camp offers **Let go**: it closes the loop at once as `closer_fall` with reason `released` (no death, no Horde; the Threshold follows as for any Loop 2+ Fall). For ending E, **Keep the vigil** at a camp skips the clock to the last dawn (`daysLeft` 1), so the final stage's gate (§10.1) is reachable without waiting out the days.

**No Apex soft-lock** (D-067.1). Entering `loc_temporal_breach_apex` in Loop 1 asks **Face it / Not yet**: *Not yet* returns the player to the previous node with nothing started; *Face it* commits to the Contained Tyrant. The game does **not** autosave at the Loop 1 Apex or while a Horde is active (§14.2), so a reload can never land the player in a fight or a spreading Horde with no way back.

In **Loop 1** both closers lead straight to Loop 2 Day 1 in the Whispering Ruins, with no Threshold (D-049); the Gallery shows Loop 1 retroactively and Loop 1's Resonance is banked, first spendable at the end of Loop 2. This is the alternate route to Loop 2 (D-005), so a Loop 1 player who never reaches the Apex still reaches Loop 2. An expiry grants `echo_thirtieth_dawn` and `echo_amulet_memory` if missing (STORY §12 sources), and sets `flag_clock_expired` for WORLD's variants.

### 10.3 The reset procedure

At any loop end the engine runs `endLoop(reason)`:

1. Compute the run summary (§15.3) and append it to `profile.runHistory`.
2. **Copy to the profile layer** (persists, D-011): new `echoes` (set union), `codex` unlocks, `bestiary` (seen/killed counts, revealed resistances, pattern knowledge level), `mapMemory` (every node visited in any loop + known exits + known camps/merchants), `achievements`, `classMastery[class]` (abilities unlocked this loop → mastered; `loopsPlayed++`; `bestLevel`; endings), `resonance` (+ this loop's tally), `attunements` (unchanged), `loopCounter++`, `lifetimeStats`, `settings`, `modifiers` (as set at the Loom), `lastClass`, `seedBase`.
3. **Discard** (resets): XP, stat points, AP, abilities, HP/MP, and level — except that the new loop **starts at level ⌊0.6 × best level reached⌋, capped at 10 (never below 1), with the ability points for that level** (D-067.2, amending D-011; e.g. best 13 → 7, best 17 → 10; applies to every loop start, including the Threshold-less Loop 1 → 2), inventory and equipment **except the Amulet of Echoes, which is never reset** (D-047, D-066 #19: it is on the Wayfinder's neck at Day 1 of every loop from Loop 2, the "Amulet warm" cue), gold, Corruption, quests and stages (quests *started at the Threshold* survive into the next loop, D-067.15), flags (`flag_*`, including `flag_tyrant_dead`, which is set when either Tyrant dies in combat and cleared here, D-069.6), world state (items on ground, enemies, unlocked exits, infection, Heartstone state), companions (recruited, active, loyalty, KO), faction reputation, merchant stock, clock, combat state, `rng` (reseeded as `hash(seedBase, loopCounter)`).
4. Loop 1 → Loop 2: skip the Threshold and start Loop 2 Day 1 directly (D-049); Loop 2+: enter the Threshold with `threshold.pending = { closer|ending, reason?, echoesGained[], resonanceGained }`.
5. `profile.loopCounter = max(profile.loopCounter, run.loop) + 1`, so loading an older run save never rewinds the counter; run saves record `profileLoopAtSave` (§14.1).

Nothing in the run layer survives except through an Echo, a codex entry, a bestiary entry, map memory, mastery, Resonance, an Attunement, an achievement, or run history. That list is exhaustive and is asserted by a unit test (`resetInvariant.test.ts`).

### 10.4 Echo data model

```ts
type Echo = {
  id: `echo_${string}`;
  title: string;                   // ≤ 40 chars, shown in Timeline/Codex
  codex: string;                   // ≤ 220 words, Wayfinder's Notes voice unless tagged
  voice: "wayfinder" | "remnant" | "ironclad" | "weaver";
  sources: EchoSource[];           // how it can be earned (any one suffices)
  effects: {
    dialogueUnlock?: { npc: string; node: string }[];
    shortcut?: { quest: QuestId; skipToStage: string }[] | { flagOnLoopStart: string }[];
    route?: { from: LocationId; to: LocationId; alsoRequires?: Condition }[];
    endingFlag?: EndingId[];       // which endings consult this Echo
    repStart?: { faction: FactionId; value: number }[];
    bestiary?: { family: string; reveal: "resist" | "pattern" | "all" }[];
    misc?: Effect[];               // any §13 effect applied at loop start
  };
  exclusiveWith?: EchoId[];        // cannot be earned in the same loop
};
type EchoSource = { kind: "story"; beat: string } | { kind: "quest"; quest: QuestId; stage?: string }
  | { kind: "dialogue"; npc: string; node: string } | { kind: "discovery"; location: LocationId }
  | { kind: "kill"; enemy: string; count: number } | { kind: "closer"; closer: string } | { kind: "ending"; ending: EndingId };
```

### 10.5 Echo effects (the catalog is STORY §12)

STORY §12 owns every Echo's id, title and sources (D-062; REGISTRY-DRAFT §6 maps every older DESIGN id). This table owns only the **mechanical effects** of the Echoes that have one; an Echo not listed here has dialogue/codex effects only (STORY). Ids marked † are among the 26 that U9 adds to STORY §12 (REGISTRY §6.2). WORLD's gate Echoes (`echo_ironclad_passwords`, `echo_nomad_signs`, `echo_heartstone_path`, `echo_hollow_path`, `echo_portal_tear`, `echo_rhune_choice`, `echo_dreyl_brand`, `echo_sky_oath`, `echo_vask_seal`, `echo_hadrek_clockwright`, `echo_crystal_seeded`, `echo_tyrant_never_struck` †) carry their route/gate effects in WORLD §11.3.

Effect kinds: **D** dialogue unlock · **S** shortcut · **R** route · **E** ending flag · **Rep** reputation start · **C** communion answer (§4.11) · **M** misc engine rule.

| id | Effect |
|---|---|
| `echo_amulet_memory` | M: the Breach Clock becomes explicit; the Threshold is unlocked (D-002); Dask line |
| `echo_ilyra_watchword` | D: Ilyra believes you about the loop on first meeting; Rep: Remnants start 20 (Trusted) |
| `echo_crystal_location` | S: `q_echo_crystal` opens at stage `retrieve`; the Crystal is at the alcove on arrival |
| `echo_litany_verse_1` | R: the Nexus Breach-door opens with `item_chronos_lens` (D-010); E: A, B |
| `echo_litany_verse_2` … `echo_litany_verse_9` | E: A, B; C: verses 2/3/5/6/7 answer Korr/Vane/Aulde/Sallow/Masque (+1) |
| `echo_litany_complete` | E: A (Resolve ≥ 6), B (D-018) |
| `echo_nine_voices` | D: Nyx "I heard nine voices" |
| `echo_nyx_is_of_the_nine` | D: "I know what you are, Nyx." (D-010); Nyx's arc stage 2 opens at once |
| `echo_what_she_would_undo` | E: C |
| `echo_tyrant_speaks` | M: opens communion at the Apex (§4.11) |
| `echo_tyrant_name` | E: A; C: Movement I/II answer |
| `echo_tyrant_jailer` | C: Movement I answer (+1); E: A, B, F |
| `echo_six_in_the_mass` | M: the Tyrants' hidden intents are shown |
| `echo_brak_death` | D: tell Brak the truth → he stays away from the Apex |
| `echo_brak_lives` | E: D helper; Brak starts loyalty 25 |
| `echo_brak_birth_name` | S: `q_blood_and_salt` starts at stage 2; D with both brothers |
| `echo_kaelen_ledger` † | M: Kaelen's prices −5% permanently (stacks with `att_kaelens_ledger`, max 10%) |
| `echo_heartstone_resonance` | E: B, E |
| `echo_heartstone_hunger` | D: Nyx; Heartstone Depths anomalies known |
| `echo_heartstone_silence` | D: Brak/Borin; E: D |
| `echo_void_resonance` | E: B — checked at the consent (D-054), not by the anchor recipe. Sources per STORY §12 / D-018 (Weavers Trusted in some loop: Nyx or Sethe); no Exploit condition and no exclusivity (REVIEW-CROSS C-08) |
| `echo_breach_clock` | M: exact-day warnings; `att_steady_hours` purchasable |
| `echo_thirtieth_dawn` | M: Still Shore variant; C: Movement I answer |
| `echo_seven_wayfinders` | C: Movement I answer |
| `echo_flickering_man` | S: Dask joins on first meeting at the Shimmering Pass (Loop 2+ only, REVIEW-CROSS C-09) |
| `echo_breach_door` | R: shows the Nexus door; with verse 1 opens it |
| `echo_oriel_lineage` | S: Ilyra's arc opens at stage 2; D: the Archway speaks in Oriel's voice |
| `echo_korr_marginalia` | M: the first Dark Spellbook read per loop costs no HP; C: Korr; unlocks `codex_maelis_korr` |
| `echo_stone_hide_origin` | S: a word stills the Blighted Outpost Golems (the encounter becomes optional); C: Vane |
| `echo_spire_note` | S: Aetherial Weavers at the Spires are passive on first visit; C: Aulde |
| `echo_glowlands_leak` † | S: `q_lantern_in_the_reeds` starts at stage 2; D: Mireya |
| `echo_weaver_sign` † | Rep: Weavers start 20; R: opens `gate_veil_curtain` without escort |
| `echo_ironclad_oath` † | Rep: Ironclad start 20 |
| `echo_steppe_waystones` † | R: WORLD X3's conditional road (§10.1) |
| `echo_archive_door` | R: Sunken Archives ↔ Drowned Reach without `item_cistern_key` |
| `echo_high_mark` | S: Sky-Whisper Sentinels passive; R: the Skyreach stair opens without the Talisman |
| `echo_anchor_mechanic` | M: `q_the_mending` available; required for ending B's consent (STORY §8.3) |
| `echo_anchor_schema` † | M: unlocks `recipe_breach_anchor` |
| `echo_ritual_inevitable` | E: A, B; C: Masque's perfect answer (+2) |
| `echo_hallow_said_stop` | C: Hallow's silence (+2) |
| `echo_caelum_unanchored` | S: Caelum can cross forward (STORY §9.6) |
| `echo_day_of_teeth` | E: D |
| `echo_horde_path` † | M: infection forecast on the map during any Horde |
| `echo_borin_oath` † | M: void-forged recipes without the Trusted requirement |
| `echo_emberforge_vein` † | M: Emberforge ember ore 8 per loop |
| `echo_bells_of_silverwood` | S: the Before's bell puzzle is solved |
| `echo_oriel_drowned` | D: calm the Drowned Archivist (the fight becomes optional) |
| `echo_apex_resonance` | R: the Apex gate in Loop 2+ (D-048) |
| `echo_nyx_bond` † / `echo_ilyra_bond` † / `echo_dask_bond` † / `echo_mireya_bond` † / `echo_caelum_bond` † | that companion starts the loop at loyalty 25 (Brak's equivalent is `echo_brak_lives`) |
| `echo_ending_a` … `echo_ending_f` | Gallery entry; New Game+; epilogue variants in later loops |
| `echo_tyrant_rejected` | M: the next communion starts at Movement II (STORY §8.5) |

**Retired DESIGN ids** (REGISTRY §6.3, D-066 #20): bestiary-reveal Echoes (`echo_phantom_moments`, `echo_aberration_rewind`, `echo_mireling_glow`, `echo_golem_slate`, `echo_stalker_eyes`) become bestiary reveals at kill ×2/×3 (§4.2); map-reveal Echoes (`echo_weaver_sanctum`, `echo_glowfen_lanternreed`) become map memory (D-011); `echo_tyrant_communion`, `echo_unbound_door` (F = Resolve ≥ 3 + refusal), `echo_ilyra_keeper`, `echo_lanternreed_cleanse` (Elder Wen always cleanses), `echo_respite_spring` (duplicates `att_old_road`), `echo_nexus_future_voice`, `echo_first_wayfinder` are removed.

The three faction-start Echoes make Loop 3+ reputations fast to recover without making Sworn free (Sworn still needs ~40 points of that loop's work).

### 10.6 Resonance

Earned into the profile at the moment of the event (shown as a small "+n ◇" toast), **first time ever** per id:

| Event | Resonance |
|---|---|
| first discovery of a location | +2 |
| first bestiary entry (first kill or spare of a creature id) | +3 |
| first codex entry | +1 |
| first completion of a quest id | +5 |
| reaching an ending | +50 |
| loop closer (Escape or Fall), each | +10 |
| challenge modifiers | multiply the loop's total (§15.1) |

Expected income: Loop 1 ≈ 140; each later loop ≈ 120–180 plus +50 per new ending. Spent only at the Loom (§10.8). Loop 1 skips the Threshold (D-049), so Loop 1's Resonance is banked and first spendable at the end of Loop 2.

### 10.7 Attunements (15)

Permanent conveniences bought with Resonance at the Loom; owned forever; **at most 5 equipped** at once (the cap that keeps them a convenience, D-011). A loop's equipped set is fixed at the Far Light.

| id | Name | Cost | Effect |
|---|---|---|---|
| `att_steady_hand` | Steady Hand | 20 | +5% max HP |
| `att_deep_well` | Deep Well | 20 | +5% max MP |
| `att_full_purse` | Full Purse | 15 | start each loop with +60 gold |
| `att_old_road` | Old Road | 15 | one free inn rest per loop |
| `att_foresight` | Foresight | 40 | enemy intents revealed one turn earlier (next-next shown dimmed) |
| `att_quick_study` | Quick Study | 30 | +10% XP |
| `att_keen_eye` | Keen Eye | 25 | +3 crit chance |
| `att_light_step` | Light Step | 20 | travel regen +5% HP, +10% MP per watch |
| `att_steady_hours` | Steady Hours | 50 | Breach Clock +1 day (requires `echo_breach_clock`) |
| `att_borins_favor` | Borin's Favor | 25 | Emberforge fees −15% |
| `att_kaelens_ledger` | Kaelen's Ledger | 25 | merchant prices −5% |
| `att_remembered_steps` | Remembered Steps | 40 | once per day, the first travel along a remembered edge costs no watch |
| `att_echo_sense` | Echo-Sense | 20 | creature resistances shown on first sight |
| `att_companions_trust` | Companion's Trust | 25 | loyalty gains +25% |
| `att_second_wind` | Second Wind | 60 | once per loop (Loop 2+), a killing blow leaves you at 1 HP instead |

Total cost of all fifteen: 440 Resonance (≈3 loops). Hard caps: HP/MP bonuses +5% each (no stacking source exists); XP bonuses from all sources ≤ +20%.

### 10.8 The Threshold — screen by screen

The Threshold is first visited at the end of Loop 2 (D-049); its Gallery then shows Loop 1 retroactively.

1. **Still Shore** (`screen_threshold_shore`). Arrival text by closer/ending (STORY), Dask present from the loop after he is met, "glimpses" line when `echo_tyrant_*` grows. Buttons: Run Summary · Echoes Gained · Continue.
2. **Run Summary** (modal, §15.3) → **Echoes Gained** (list with codex line and effect icons; Resonance tally animates per line).
3. **Gallery of Loops** (`screen_threshold_gallery`): one card per loop (number, class, days, closer/ending, level, key choices as glyphs); tab Achievements (§15.2); tab Timeline (§16, Loop Timeline across loops).
4. **The Loom** (`screen_threshold_loom`): Resonance balance; Attunement grid (owned / equipped / cost; 5 equip slots); Challenge modifiers toggles with their Resonance multiplier; New Game+ button if any ending has been reached.
5. **The Far Light** (`screen_threshold_far_light`): class choice with mastery badges (abilities mastered n/15, loops played, best level, endings), starting kit preview, equipped Attunements summary, active modifiers, "Step into the light" → transition → Day 1.

Keyboard: `←/→` between the four places, `Enter` select, `Esc` back; on mobile the four places are bottom tabs.

### 10.9 Class change between loops
Free at the Far Light (D-008). The Wayfinder re-manifests: new class base stats, kit, 1 AP, 30 gold (+`att_full_purse`). Mastery is per class. Echoes are class-agnostic; the five class mini-quests (`q_class_ranger`, `q_class_wizard`, `q_class_elf`, `q_class_ironclad_warden`, `q_class_shadow_weaver`; D-008, added to STORY §11 outside D-045's 44) are available only while playing that class, **only from Loop 2** (D-069.7; Loop 1 has just four non-legacy quests open, D-067.17), and grant the class's badge. A handful of dialogue lines check `{ class: id }` (D-008).

---

## 11. Factions and reputation

### 11.1 Math
Three tracks, `rep[faction] ∈ [−100, 100]`, start 0 (or an Echo's `repStart`). Tiers (D-014): Hostile ≤ −40 · Wary −39..−10 · Neutral −9..19 · Trusted 20..59 · Sworn ≥ 60. Deltas apply immediately with a toast; tier changes fire `onTierChange` effects (vendor refusal, companion remarks). Rep resets per loop (D-011).

### 11.2 Exact deltas for every legacy choice (D-017) and legacy quests

| Choice / quest | Remnants | Weavers | Ironclad | Other |
|---|---|---|---|---|
| Heartstone — Stabilize | +15 | — | — | Clock +6; `echo_heartstone_resonance`; Ley-tuned recipes |
| Heartstone — Exploit | −15 | +15 | — | Clock −5; Heartstone Core; Depths unstable |
| Heartstone — Destroy | −25 | −10 | +20 | Clock −10; Breach-born −25% HP this loop; Ley abilities +25% MP; Depths dark |
| Echo Crystal — give | +15 | — | — | `echo_litany_verse_1` next talk |
| Echo Crystal — keep | −10 | +10 | — | Loop 2+: verse 1 + `echo_nine_voices` |
| Void Shards — give | — | +20 | — | Shadow-Kissed Dagger |
| Void Shards — refuse | — | −20 (Nyx turns Wary) | +5 | shards kept; void-forged recipes |
| Dark Spellbooks → Corruption 6 | −10 | — | — | ending E locked unless cleansed |
| `q_lost_scroll` — scroll to Ilyra | +10 | −3 | — | +1 MAG (legacy), Mana Bloom |
| `q_lost_scroll` — scroll to Nyx (STORY) | −15 | +15 | — | `echo_breach_recoil`, `echo_litany_verse_8`, `echo_tyrant_jailer` (STORY §11.2) |
| `q_clear_path` complete | — | — | +10 | Ironclad Mail |
| `q_blighted_outpost` complete | — | −3 | +15 | Ironclad Plate Armor, +15 max HP (legacy) |
| Brak's quests skipped | — | — | 0 | Brak not at the Apex (lives) |
| Telling Brak the truth with `echo_brak_death` | — | — | +10 | Brak survives the Apex |

### 11.3 Rep budget per faction per loop

Re-cut to STORY §11's structure (REVIEW-CROSS C-16: STORY owns which choices exist, this section owns magnitudes). Each faction has three chain quests (STORY's "Remnants 1–3", "Ironclad 1–3", "Weavers 1–3"); the legacy ones are counted under legacy choices.

| Faction | Legacy choices (max) | New chain quests (STORY §11.2) | Companion arc (STORY §11.4) | Regional/other | Max positive | Typical Loop 1 |
|---|---|---|---|---|---|---|
| Remnants | +40 (crystal, scroll, stabilize) | `q_keepers_ledger` +25 (Loop 2+) | Ilyra +5 / +10 / +15 (Loop 2+) | +10 | ~105 | 25–45 |
| Shadow Weavers | +45 (keep, shards, exploit) | `q_hollow_choir` +15; `q_unlidded_eye` +20 (Loop 2+) | Nyx +5 / +10 / +15 | +10 | ~120 | 10–40 |
| Ironclad Nomads | +50 (peaks, outpost, destroy, refuse) | `q_day_of_teeth` +25 (Loop 2+) | Brak +5 / +10 / +15 | +10 | ~115 | 25–45 |

Sworn (60) in one loop requires the faction chain plus most legacy choices in its favour — a deliberate commitment that costs the others (§11.5). Checked per faction for a Loop 2+ run with no start Echo: Remnants 40 + 25 + 30 − cross costs ≈ 80; Weavers 45 + 35 + 30 − ≈ 95; Ironclad 50 + 25 + 30 − ≈ 90 — each reaches 60 in one loop. In Loop 1 any faction can reach Sworn (D-069.4).

### 11.4 Tier effects

| Tier | Prices (§9.2) | Gear | Scenes | Endings / other |
|---|---|---|---|---|
| Hostile | vendor refuses | — | faction guards attack on sight at faction nodes (fixed encounters re-enabled); faction companion refuses to join | — |
| Wary | ×1.15 | core stock only | faction NPCs curt; chain quest 1 unavailable | — |
| Neutral | ×1.0 | core + theme pool | chain quest 1 | — |
| Trusted | ×0.90 | faction-unique Rare gear unlocked (Remnant Ley trinkets; Weaver focuses; Ironclad plate) | chain quests 2–3; companion loyalty scene 2; `echo_void_resonance` possible | B requires Trusted with two factions |
| Sworn | ×0.80 | faction Epic signature item (`item_archivists_circlet`, `item_nyxs_shardglass`, `item_oathplate`) | companion loyalty scene 3; faction leader confides | C (Weavers), D (Ironclad), E (Remnants) require Sworn |

### 11.5 Cross-faction penalties
Every faction chain quest completion costs the two other factions −3 (quest 1), −5 (quest 2), −8 (quest 3), except that the legacy chain quests cost only what §11.2 lists (legacy numbers kept). Siding in the three exclusive moments (Heartstone; Crystal; Shards) applies the D-017 numbers above. Being Sworn with two factions at once is possible only with the faction-start Echoes and a near-perfect loop — intended as an achievement (`ach_two_oaths`).

### 11.6 Echoes restore rep on later loops
`echo_ilyra_watchword` → Remnants start 20; `echo_weaver_sign` → Weavers start 20; `echo_ironclad_oath` → Ironclad start 20 (after the oath line to Brak). `echo_brak_birth_name` makes `q_blood_and_salt` (+10 Ironclad) start at stage 2 from Day 1. With all three a Loop 3+ Wayfinder reaches Trusted everywhere immediately and can push one faction to Sworn by ~Day 12.

---

## 12. Companions

### 12.1 Recruitment conditions (summary; STORY owns the scenes)

| id | Name | Where | Condition (Loop 1 unless noted) | Role |
|---|---|---|---|---|
| `ilyra` | Ilyra | Whispering Ruins | **Loop 2+** (D-069.4; STORY wins) — after `q_echo_crystal` resolved (either way) and `q_lost_scroll` accepted; Remnants ≥ Neutral | support / Ley caster |
| `brak` | Brak | Ironclad Camp | after `q_clear_path`; Ironclad ≥ Neutral | bruiser / tank |
| `nyx` | Nyx | Chasm of Whispers | after `q_void_shards` (given) or Loop 2+ with `echo_nyx_is_of_the_nine`; Weavers ≥ Neutral | Void caster |
| `dask` | Dask | Shimmering Pass | **Loop 2+ only** (glimpsed but not spoken to in Loop 1, STORY §4.4; REVIEW-CROSS C-09); `echo_flickering_man` makes it immediate | Chrono phantom; **location-restricted** (D-013, D-059): may only be active in locations flagged `temporallyUnstable` (§12.8); elsewhere he "flickers out" (auto-dismissed to the roster, rejoins when you re-enter one) |
| `mireya` | Mireya of Lanternreed | Lanternreed (Glowfen) | `q_lantern_in_the_reeds` stage 1; not Hostile with Remnants | nature/glow healer |
| `caelum` | Caelum Vesper | Silverwood Before | crosses forward by his own choice in `q_a_boy_from_a_doomed_city` (`echo_caelum_unanchored`, STORY §9.6; REVIEW-CROSS C-39) — typically Loop 3+ | Chrono caster |

Companion ids are plain (D-044); each companion's NPC record is `npc_<name>` with `companion: "<id>"`.

Only one is active (D-013); swapping happens at a full rest or at a node where the companion is present. Dismissed companions wait at their home node.

### 12.2 Stance rules (pseudocode)
See §4.9 `companionAct`. Stances are set per companion and remembered per loop; default Guarded. Loyalty ≥ 75 adds the **Trusted** rider: +10% to the companion's damage and healing.

### 12.3 Stats

Companions have **no MP** (D-066 #12). Armor and ward gain +1 each per 4 levels (at 4, 8, 12, 16, 20); AGI is fixed.

| id | HP (L1 / per level) | ATK (L1 / per lvl) | SP | AGI | armor/ward (L1) | Note |
|---|---|---|---|---|---|---|
| `ilyra` | 80 / +6 | 6 / +0.5 | 10 / +1 | 7 | 1/3 | |
| `brak` | 130 / +10 | 12 / +1 | 0 | 5 | 4/0 | |
| `nyx` | 90 / +6 | 5 / +0.5 | 11 / +1 | 8 | 1/2 | |
| `dask` | 70 / +5 | 6 / +0.5 | 10 / +1 | 12 | 0/2 | innate +20 evasion ("flickering") |
| `mireya` | 95 / +7 | 6 / +0.5 | 9 / +1 | 6 | 2/2 | immune Poison |
| `caelum` | 75 / +5 | 5 / +0.5 | 11 / +1 | 8 | 1/3 | |

### 12.4 Abilities (3 auto + 1 signature each)

Auto abilities use **cooldowns** in the companion's own turns instead of MP (D-066 #12): `attack` 0 · `debuff`, `aoe`, `utility`, `buff` 2 · `heal`, `shield`, `cleanse` 3. Signature cooldowns are as listed.

| id | Owner | Kind | Effect |
|---|---|---|---|
| `comp_ilyra_ley_dart` | Ilyra | attack | Ley `1.0·SP` single |
| `comp_ilyra_ward` | Ilyra | shield | Shield `10 + 1.2·SP` on lowest-HP ally, 3 |
| `comp_ilyra_mend` | Ilyra | heal | `12 + 1.1·SP` |
| `comp_ilyra_archive_light` | Ilyra | **signature**, CD 4 | cleanse party; Shield `1.5·SP + 10` on both; all hidden intents revealed for 2 turns |
| `comp_brak_axe` | Brak | attack | Physical `1.1·ATK` |
| `comp_brak_cleave` | Brak | aoe | Physical `0.8·ATK` all |
| `comp_brak_shieldbreak` | Brak | debuff | Physical `0.7·ATK`, Armor Break 100%, 3 |
| `comp_brak_hold_the_line` | Brak | **signature**, CD 4 | Taunt all 2; Guard self; Shield `1.0·ATK + 15` |
| `comp_nyx_void_needle` | Nyx | attack | Void `1.1·SP` |
| `comp_nyx_hex` | Nyx | debuff | Void `0.6·SP`, Weaken 100%, 2 |
| `comp_nyx_drink` | Nyx | heal (self) | Void `0.8·SP` single, heals Nyx 60% of damage |
| `comp_nyx_unmaking` | Nyx | **signature**, CD 4 | Void `1.6·SP` all; destroys Shield/Rewind; costs 10% of Nyx's HP |
| `comp_dask_flicker_strike` | Dask | attack | Chrono `1.0·SP`, ignores Phase |
| `comp_dask_stall` | Dask | debuff | Chrono `0.5·SP`, Slow 100%, 2 |
| `comp_dask_glimpse` | Dask | utility | party sees next-next intents this round (counts as his action when no better option) |
| `comp_dask_between_instants` | Dask | **signature**, CD 5 | Rewind (2) on the player; Haste (2) on both |
| `comp_mireya_glowsalve` | Mireya | heal | `10 + 1.0·SP` + Regen `3 + 0.3·SP`, 3 |
| `comp_mireya_spore_cloud` | Mireya | debuff | Blind 100%, 2 on all enemies |
| `comp_mireya_lantern_light` | Mireya | attack | Ley `0.9·SP`, Soaked 100%, 3 |
| `comp_mireya_lanternreed_bloom` | Mireya | **signature**, CD 5 | party heal 30% max HP; cleanse; Regen `4 + 0.4·SP`, 3 |
| `comp_caelum_chrono_shard` | Caelum | attack | Chrono `1.1·SP`, Slow 30%, 2 |
| `comp_caelum_haste` | Caelum | buff | Haste 2 on the player |
| `comp_caelum_foresight` | Caelum | shield | Shield `1.0·SP + 8` on the ally targeted by the largest incoming intent |
| `comp_caelum_stutter` | Caelum | **signature** *Skipped Beat* (U81b2: renamed from *Stutter*, the Wizard's spell), CD 4 | interrupt + Stun 1 (non-boss) or Stagger + Slow 2 (boss) |

### 12.5 Loyalty (0–100)

| Change | Amount |
|---|---|
| personal quest stage completed | +5; **+6 for Ilyra's and Brak's arcs** (U81b2, D-113: Ilyra's nine stages reached about 46 in a loop, short of Loyal 50 for ending E) |
| camp conversation (max one per full rest, needs new content) | +2 |
| choice aligned with their value (Ilyra: stabilize/give crystal; Brak: Ironclad quests, destroy; Nyx: keep crystal, give shards, exploit; Dask: spare the Tyrant; Mireya: cleanse, protect the Glowfen; Caelum: attempt the anchor) | +3 |
| choice against their value | −10 (Dask: killing the Tyrant −30; Nyx: refusing shards −15) |
| companion KO'd in a fight | −2 |
| `att_companions_trust` | gains ×1.25 |

Thresholds: 25 → camp conversation 2 and the companion's arc stage 2 available; 50 → arc stage 3, signature cooldown −1; 75 → **Trusted** rider; 100 → `ach_bond_any`. Loyalty resets per loop; `echo_brak_lives`, `echo_nyx_bond`, `echo_ilyra_bond`, `echo_dask_bond`, `echo_mireya_bond` and `echo_caelum_bond` (granted at loyalty ≥ 50 at loop end, §10.5) start that companion at 25.

### 12.6 KO and revive
HP 0 → KO (§4.9). Revive: full rest (50% HP), `wrd_last_bastion` (40%), `item_lanternreed_salts` (30%, in or out of combat). A KO'd companion cannot be swapped out until revived (you carry them). Permadeath only via story (Brak at the Apex when the Tyrant falls and he was not kept away).

### 12.7 Camp conversations
Each full rest with an active companion offers at most one conversation node, gated by `{ companion: { id } }` and `{ loyalty: { companion, min } }` (§13.3), quest stage, Echoes and loop count. Conversations are where arc quests are offered and where Echo-triggered truths ("I know what you are, Nyx") can be spoken outside combat.

### 12.8 Dask's restriction in data
No region list (D-059, D-066 #12). Dask may be active only where `location.temporallyUnstable || location.infected` is true. WORLD sets the static flag on every location in the Aether-Kissed Highlands, Skyreach, the Chronos Nexus, the Temporal Breach Apex, all of Silverwood Before and all of the Threshold; Horde-infected nodes count while infected. `loc_veridian_glowlands` is **not** flagged, so on the Apex road Dask drops out on the Glowlands and returns at the Nexus (WORLD X8) unless the lead amends D-059. Travelling to an unflagged node auto-dismisses him with a one-line flicker; re-entering a flagged node offers him back if he is the chosen active companion. He cannot be at the Emberforge or any camp outside flagged nodes, so his conversations happen at the Pass, the Nexus and the Threshold.

---

## 13. Quests and dialogue data model

### 13.1 Quest schema

```ts
type Quest = {
  id: `q_${string}`;                  // D-044; legacy names kept (see list below)
  name: string;                       // legacy names kept exactly (see list below)
  giver: NpcId | "world";
  category: "legacy" | "faction" | "companion" | "regional" | "loop" | "ending" | "class";
  faction?: FactionId;
  availableWhen?: Condition;          // offered only if true
  stages: Stage[];                    // linear by default; branches jump by id
  failWhen?: Condition;               // e.g. { flag: "flag_brak_dead" } for Brak's arc stage 3
  onFail?: Effect[];
  journalTitle?: string;
  botHint: "melee" | "caster" | "explorer" | "speedrunner" | "pacifist";   // which bot must be able to complete it (D-019)
};
type Stage = {
  id: string;
  journal: string;                    // ≤ 60 words
  objectives: Objective[];            // all must be satisfied unless `anyOf: true`
  anyOf?: boolean;
  onEnter?: Effect[];
  onComplete?: Effect[];
  next?: string | Branch[];           // default: following stage; last stage completes the quest
  optional?: boolean;
};
type Objective = { id: string; text: string; when: Condition; hidden?: boolean };
type Branch = { when: Condition; next: string };
```

The six legacy quests keep their names exactly; their ids take the `q_` prefix (D-044): `q_echo_crystal` "Echoes in the Library" (giver Ilyra; rewards 120 XP + 20 gold, or 60 XP if the Crystal is kept), `q_lost_scroll` "The Scholar's Lost Scroll" (Ilyra; +1 MAG, Mana Bloom, Remnants +10; spawns the Drowned Archivist and the scroll in the Sunken Archives on accept), `q_clear_path` "Clear the Barren Peaks" (Brak; 120 XP, Ironclad Mail; unlocks the Barren Peaks exit on accept), `q_blighted_outpost` "The Blighted Outpost" (Brak; 220 XP, Ironclad Plate Armor, +15 max HP), `q_void_shards` "Whispers of the Void" (Nyx; 260 XP, Shadow-Kissed Dagger on give; unlocks the Voidscar Hollow exit on accept), `q_echoing_heartbeat` "The Echoing Heartbeat" (world; offered after 2 completed quests, legacy rule; unlocks the Heartstone Depths exit; three-way choice stage). The Apex gate is D-048's (§13.3 example 7).

Rules: a quest completes when its final stage's `onComplete` runs; `questAdvance` effects may jump stages explicitly (used by Echo shortcuts: `echo_crystal_location` sets `skipToStage: "retrieve"`). Objectives are evaluated after every engine step (cheap: conditions are pure functions over `GameState`). Journal shows current-stage text plus completed stages collapsed.

### 13.2 Dialogue schema

```ts
type Dialogue = { id: string; npc: NpcId; entry: NodeRule[]; nodes: Record<string, DNode> };
type NodeRule = { when: Condition; node: string };            // first match wins; last rule is unconditional
type DNode = {
  speaker: NpcId | "player" | "narrator";
  text: string | { when: Condition; text: string }[];          // conditional text variants
  onEnter?: Effect[];
  choices?: Choice[];                                           // none → "Continue" to `next`
  next?: string | "end";
};
type Choice = {
  text: string;
  when?: Condition;                   // hidden if false
  disabledWhen?: Condition;           // shown greyed with reason (used for Echo-locked lines: "(You do not yet know this)")
  effects?: Effect[];
  next: string | "end";
  tags?: ("echo" | "class" | "faction" | "companion")[];        // UI glyph on the choice
};
```

Choices tagged `echo` render with the Echo glyph so the player sees which lines are loop knowledge. Legacy yes/no prompts become two-choice nodes with identical outcomes.

### 13.3 Condition/effect language (D-033) — canonical shapes and worked examples

This is the **one canonical set** (D-066 #16); PLAN §4.9's zod schemas implement exactly these shapes, and STORY/WORLD data use only them. Object forms are used wherever an atom has more than one field. All ids are full D-044 ids (`flag_*`, `echo_*`, `q_*`, `cr_*`, …).

**Conditions**

| Atom | Shape | Notes |
|---|---|---|
| logic | `{ all: C[] }` · `{ any: C[] }` · `{ not: C }` | |
| flag | `{ flag: "flag_x" }` | true if set this loop |
| echo | `{ echo: "echo_x" }` | profile |
| quest | `{ quest: { id, stage?, status? } }` | `status` ∈ `inactive` \| `active` \| `completed` \| `failed`; `stage` = current stage id |
| item | `{ item: { id, count? } }` | count default 1; inventory + satchel + equipped |
| rep | `{ rep: { faction, min?, max? } }` | |
| loop | `{ loop: { min?, max? } }` | |
| day | `{ day: { min?, max? } }` | Breach Clock day |
| watch | `{ watch: "dawn" \| "day" \| "dusk" \| "night" }` | WORLD `ws_night` |
| clock | `{ clock: { daysLeft: { min?, max? } } }` | dawns before the limit (Ending E: `max: 1`) |
| beforeDay | `{ beforeDay: 1 \| 2 \| 3 }` | Silverwood Before counter (§10.1) |
| beforeResets | `{ beforeResets: { min?, max? } }` | |
| class | `{ class: "ranger" }` | plain class id |
| level | `{ level: { min?, max? } }` | |
| stat | `{ stat: { name: "strength" \| "magic" \| "agility", min?, max? } }` | primaries only (D-044) |
| companion | `{ companion: { id, state? } }` | `state` ∈ `active` (default) \| `recruited` \| `ko` |
| loyalty | `{ loyalty: { companion, min?, max? } }` | |
| corruption | `{ corruption: { min?, max? } }` | |
| location | `{ location: "loc_x" }` | current node |
| killed | `{ killed: { id: "cr_x", count?, sinceStage? } }` | this loop; `sinceStage` counts only kills after the current stage began |
| counter | `{ counter: { name, min?, max? } }` | named counters; engine-maintained: `quests_completed` (D-048), `factions_trusted` (factions at ≥ Trusted) |
| resolve | `{ resolve: { min?, max? } }` | communion only (§4.11) |
| modifier | `{ modifier: "mod_x" }` | active challenge modifier |

**Effects**

| Atom | Shape | Notes |
|---|---|---|
| flags | `{ setFlag: "flag_x" }` · `{ clearFlag: "flag_x" }` | |
| echo | `{ grantEcho: "echo_x" }` | written to the profile at once |
| quests | `{ questStart: "q_x" }` · `{ questAdvance: { quest, stage } }` · `{ questFail: "q_x" }` | |
| items | `{ giveItem: { item, count?, rarity? } }` · `{ takeItem: { item, count? } }` | |
| rep / loyalty | `{ rep: { faction, delta } }` · `{ loyalty: { companion, delta } }` | |
| economy | `{ gold: n }` · `{ xp: n }` · `{ resonance: n }` | |
| body | `{ heal: { hp?, mp? } }` · `{ damage: { hp } }` · `{ corruption: n }` | |
| clock limit | `{ clockWatches: n }` | moves the Breach Clock **limit** by n watches (−10 days = −40), subject to the clock floor (§10.1) |
| time passes | `{ passWatches: n }` | advances the current time by n watches (n ≥ 1; the `timeCost` of events) without touching the limit; crossing a dawn fires the usual dawn effects. D-069.5: the dropped clock effects become `passWatches` — `q_preserve_or_heal` 8, the Bell Vault descent 4 |
| combat hits | `{ multiHit: { hits: n } }` | **combat scope.** The enclosing Move resolves as n separate hits, each at the Move's per-hit power with its own accuracy, crit and armor roll (`crown_seven`: 7 × 0.3×); same as `power.hits` |
| combat strip | `{ stripBuffs: { kinds: ("shield" \| "regen" \| "haste" \| "rewind")[], target? } }` | **combat scope.** Removes the listed beneficial statuses from the Move's target (`target` as `StatusApply`, default the Move's target): `tide_take` all four, `umbra_unname` shield, `moth_eat_a_second` haste |
| combat drain | `{ healOnDamage: { pct: n } }` | **combat scope.** The user heals `pct` (0–1) of the damage the Move actually dealt, after shields and mitigation (`lantern_drink` 0.5, `lamprey_drink` 1.0) |
| combat survive | `{ surviveRounds: { rounds: n, line? } }` | **combat scope; encounter-level** (a boss's first phase `onEnter`). The party **wins by standing at the end of round n**: the fight ends, with the optional `line`, and grants **no XP or loot**. The Unraveling Tide is `{ surviveRounds: { rounds: 10 } }` (D-069.9); it is a survival fight, not a regional boss, so D-067.20's HP rule does not retune it |
| combat leave | `{ leaveCombat: true }` | **combat scope.** The acting creature withdraws from the fight (no XP, no loot, not a kill): `redundant_leave`, `reach_withdraw` |
| world | `{ spawn: { creature, location? } }` · `{ teleport: "loc_x" }` · `{ unlockExit: { from, to } }` · `{ scatter: { location } }` (§4.7) | |
| companions | `{ recruit: "<companion>" }` · `{ dismiss: "<companion>" }` | |
| flow | `{ startCombat: "<encounter>" }` · `{ startDialogue: "<dialogue>" }` · `{ endLoop: { closer: "closer_escape" \| "closer_fall", reason? } }` · `{ ending: "ending_x" }` | `reason` ∈ `death` \| `expiry` \| `rejected` \| `released` (D-067.14) |
| unlocks | `{ unlockRecipe: "recipe_x" }` · `{ unlockCodex: "codex_x" }` | |
| counters | `{ counter: { name, delta } }` · `{ resolve: n }` | `resolve` is communion-only and clamped 0–8 |

1. **Heartstone Destroy** (choice effects): `[{ setFlag: "flag_heartstone_destroyed" }, { clockWatches: -40 }, { rep: { faction: "ironclad", delta: 20 } }, { rep: { faction: "remnants", delta: -25 } }, { rep: { faction: "weavers", delta: -10 } }, { grantEcho: "echo_heartstone_silence" }, { giveItem: { item: "item_heartstone_fragment_dead", count: 2 } }, { setFlag: "flag_ley_cost_up" }, { setFlag: "flag_breach_born_weakened" }, { questAdvance: { quest: "q_echoing_heartbeat", stage: "done_destroy" } }]` — −10 days = −40 watches, floored at current day + 3 dawns.
2. **Ilyra believes you** (entry rule): `{ when: { all: [{ echo: "echo_ilyra_watchword" }, { loop: { min: 2 } }, { not: { flag: "flag_ilyra_told" } }] }, node: "watchword_greeting" }`.
3. **Breach-door exit** (location exit condition): `{ all: [{ echo: "echo_litany_verse_1" }, { item: { id: "item_chronos_lens" } }, { loop: { min: 2 } }] }`.
4. **Sethe's void resonance** (choice `when`, STORY §12 source): `{ all: [{ rep: { faction: "weavers", min: 20 } }, { quest: { id: "q_unlidded_eye", status: "completed" } }, { location: "loc_sanctum_of_threads" }] }` → effects `[{ grantEcho: "echo_void_resonance" }]`.
5. **Brak stays away** (choice): `when: { all: [{ echo: "echo_brak_death" }, { quest: { id: "q_blighted_outpost", status: "completed" } }] }` → `[{ setFlag: "flag_brak_kept_away" }, { loyalty: { companion: "brak", delta: 6 } }, { rep: { faction: "ironclad", delta: 10 } }]`.
6. **Corruption dialogue**: `{ corruption: { min: 3 } }` on Nyx's "You have read Maelis" node; ending E's `availableWhen` includes `{ any: [{ not: { corruption: { min: 6 } } }, { flag: "flag_corruption_cleansed" }] }`.
7. **Apex gate** (D-048, exactly): Loop 1 `{ counter: { name: "quests_completed", min: 6 } }`; Loop 2+ `{ any: [{ counter: { name: "quests_completed", min: 6 } }, { echo: "echo_apex_resonance" }] }`. Since `echo_apex_resonance` is only granted on first reaching the Apex, the single data form `{ any: [...] }` is used in every loop.
8. **Golem shortcut**: Blighted Outpost encounter `optionalWhen: { echo: "echo_stone_hide_origin" }` and a dialogue action `speak_warder_word` with effects `[{ setFlag: "flag_outpost_golems_stilled" }, { questAdvance: { quest: "q_blighted_outpost", stage: "cleared" } }]` — Pacifist's Vow relies on it.
9. **Kill objective**: `{ killed: { id: "cr_wildling_brute", count: 1, sinceStage: true } }` for `q_clear_path`; the legacy flag `defeated_wildling` becomes this condition.
10. **Companion-gated camp talk**: `{ all: [{ companion: { id: "mireya" } }, { loyalty: { companion: "mireya", min: 25 } }, { day: { min: 5 } }] }`.
11. **Ending B eligibility** (`ending_mending`, at the Movement III consent): `{ all: [{ resolve: { min: 8 } }, { echo: "echo_heartstone_resonance" }, { echo: "echo_litany_complete" }, { echo: "echo_void_resonance" }, { echo: "echo_anchor_mechanic" }, { item: { id: "item_breach_anchor" } }, { counter: { name: "factions_trusted", min: 2 } }, { flag: "flag_conflux_anchored" }, { flag: "flag_cradle_pin_anchored" }] }` (D-018, D-054).
12. **Ending E's last stage** (`q_long_archive`): `{ all: [{ location: "loc_heartstone_depths" }, { clock: { daysLeft: { max: 1 } } }] }` (D-066 #8).
13. **Silverwood Before**: `{ all: [{ beforeDay: 2 }, { location: "loc_cistern_gardens" }] }`; Caelum's third-reset line `{ beforeResets: { min: 3 } }`.

**Combat-scope** effects (`multiHit`, `stripBuffs`, `healOnDamage`, `surviveRounds`, `leaveCombat`; D-069.9) are legal only in creature definitions — a Move's `effects`, a phase's `onEnter` — and `validateContent()` rejects them in quest, dialogue and event effects.

Effects are applied atomically within one `step`; every effect emits an `events[]` entry the UI renders (toasts, log lines, Echo fanfare).

### 13.4 Completability rule
Every quest in the content pack (the 44 of D-045, which include the 6 legacy quests; the 5 class mini-quests; and any of STORY's 6 optional stretch quests that are built) declares a `botHint`, and the harness proves the named bot completes it in ≥1 of 200 seeded runs (ending quests: ≥1 of 500 three-loop runs). A quest without a passing proof fails `validateContent()`. Soft-lock detection (no progress-making legal action for 60 steps) is a CI failure.

---

## 14. Saves and profile

### 14.1 Shapes

Saves are disposable until the first full-screen integration checkpoint; from then on they carry `version: 1` and migrations (D-058). Field names follow PLAN §4.2–4.3; ids follow D-044.

```jsonc
// Run save — key "aethelgard.run.slot1" | slot2 | slot3 | "aethelgard.run.auto"
{
  "kind": "run", "version": 1, "seed": "a1b2c3d4", "profileLoopAtSave": 2, "createdAt": "2026-10-09T12:00:00Z", "updatedAt": "…",
  "summary": { "class": "ranger", "level": 7, "loop": 2, "day": 11, "watch": "dusk", "location": "loc_ironclad_camp", "playtimeSec": 5400, "title": "Loop 2 · Day 11 · Ironclad Camp" },
  "state": {
    "rng": [1,2,3,4], "loop": 2, "clock": { "ticks": 42, "limitTicks": 140, "modifiers": [{ "source": "heartstone_stabilize", "watches": 24 }] },
    "before": null,
    "player": { "class": "ranger", "level": 7, "xp": 1820, "stats": { "strength": 13, "magic": 6, "agility": 11 }, "hp": 150, "mp": 44, "statPoints": 0, "apHalf": 2,
      "abilities": ["rgr_marked_shot","rgr_rend","rgr_venom_coat","rgr_piercing_arrow","rgr_riposte_stance","rgr_field_dressing"], "cooldowns": {},
      "inventory": [{ "uid": "c_01", "itemId": "item_ley_touched_tonic", "qty": 3 }, { "uid": "w_17", "itemId": "item_warriors_sword", "qty": 1, "rarity": "rare", "affixes": ["affix_of_embers"] }],
      "equipment": { "weapon": "w_17", "armor": "a_03", "trinket_1": null, "trinket_2": null }, "satchel": ["item_amulet_of_echoes"], "gold": 212, "corruption": 1,
      "statuses": [{ "id": "status_poison", "turns": 2, "tick": 3 }],
      "uses": { "att_second_wind": { "loop": 2 }, "respec": { "day": 9 }, "att_old_road": { "loop": 2 } } },
    "companions": { "active": "brak", "roster": { "brak": { "hp": 190, "loyalty": 31, "stance": "guarded", "ko": false, "home": "loc_ironclad_camp", "cooldowns": {} } } },
    "reputation": { "remnants": 25, "weavers": -5, "ironclad": 30 },
    "quests": { "q_clear_path": { "status": "completed" }, "q_blighted_outpost": { "status": "active", "stage": "cleared", "objectives": { "kill_golems": true } } },
    "flags": { "flag_heartstone_stabilized": true }, "counters": { "quests_completed": 3 }, "killed": { "cr_wildling_brute": 2 },
    "world": { "location": "loc_ironclad_camp", "previous": "loc_mistwood_path", "visited": ["…"], "ground": { "loc_barren_peaks": [] },
      "encounters": { "loc_blighted_outpost": "cleared", "loc_barren_peaks": "scattered" }, "encounterHp": { "loc_sunken_archives": { "cr_drowned_archivist": 40 } },
      "exits": { "loc_sunken_archives->loc_heartstone_depths": true }, "infection": [],
      "merchants": { "npc_kaelen_stonehand": { "stock": ["…"], "restockDay": 11 } }, "gather": { "loc_mistwood_path": { "day": 11, "taken": 1 } } },
    "combat": null, "ui": { "lastTarget": null }
  }
}
// Profile — key "aethelgard.profile"
{
  "kind": "profile", "version": 1, "seedBase": "a1b2c3d4", "loopCounter": 2,
  "echoes": ["echo_amulet_memory", "echo_ilyra_watchword"], "codex": ["codex_breach"],
  "bestiary": { "cr_wildling_brute": { "seen": 3, "killed": 2, "revealed": "all" } },
  "mapMemory": { "nodes": ["loc_whispering_ruins"], "edges": ["loc_whispering_ruins->loc_mistwood_path"], "camps": ["…"], "merchants": ["…"] },
  "achievements": { "ach_loop_two": "2026-10-09T13:10:00Z" },
  "classMastery": { "ranger": { "mastered": ["rgr_rend"], "loopsPlayed": 1, "bestLevel": 13, "endings": [] } },
  "resonance": { "balance": 95, "earned": 145, "spent": 50 }, "attunements": { "owned": ["att_full_purse","att_old_road"], "equipped": ["att_full_purse","att_old_road"] },
  "modifiers": [], "runHistory": [ { "loop": 1, "class": "ranger", "closer": "closer_escape", "days": 24, "level": 13, "choices": { "heartstone": "stabilize", "crystal": "give", "shards": "give" }, "echoesGained": ["…"], "resonance": 145 } ],
  "lifetime": { "kills": 41, "damage": 9120, "deaths": 1, "playtimeSec": 6100 }, "settings": { "textScale": 1.0, "highContrast": false, "reducedMotion": "system", "volumes": { "master": 0.8, "ambient": 0.6, "sfx": 0.8, "music": 0.5 }, "muted": false }
}
```

State notes (REVIEW-DESIGN-PLAN F19): `player.statuses` holds out-of-combat Poison/Bleed/Curse (they tick per watch, §4.5); `player.uses` records per-loop/per-day usage (Second Wind, free inn rest, Remembered Steps, respec once per day); `status_rested` lives in `player.statuses`; `world.gather` tracks gathering nodes; `world.encounterHp` keeps a fled boss/story-gate encounter's HP until dawn; `before` is the Silverwood Before counter (`{ day, resets }` or `null`, §10.1). Companions carry cooldowns, not MP.

### 14.2 Slots, autosave, timing
Three manual slots + one autosave (D-034). **Autosave** writes after every location change, after every combat (win or flee), at every loop transition, and on entering the Threshold; it never writes mid-combat (a reload resumes at the pre-combat node with the encounter intact), **nor at the Loop 1 Apex or while a Horde is active** (D-067.1, §10.2). Manual save is allowed anywhere outside combat/dialogue. Each slot shows the `summary`. Deleting a run never touches the profile; deleting the profile asks twice and exports first.

### 14.3 Export / import
Export: `Blob` download `aethelgard-<kind>-<slot>-<yyyymmdd-hhmm>.json` (pretty-printed). Import: file picker → `JSON.parse` → zod `SaveSchema` (strict) → migrate → preview card → confirm overwrite of the chosen slot. A profile import merges by default (set-union of Echoes/codex/achievements, max of mastery, sum of Resonance capped at the sum of observable sources) and offers "replace" as a second option.

### 14.4 Migrations and corruption handling
`migrations: Record<number, (save) => save>` keyed by `version`, applied in order, each a pure function with a unit test fixture. Unknown higher versions are refused with a message. Writes are two-phase: write to `<key>.tmp`, verify by re-reading and parsing, then rename (copy to `<key>`, delete `.tmp`), keeping the previous value in `<key>.bak`. On load failure (parse or schema), the slot is marked **Corrupted** in the slot list with actions: Restore `.bak` (if it validates), Export raw text, Delete. Content references to unknown ids (an item removed in a later build) are dropped with a warning event, mirroring the legacy `safe_clone_item` behaviour.

---

## 15. Difficulty, modifiers, achievements

### 15.1 Challenge modifiers (D-021), toggled at the Loom, fixed for the loop

| id | Name | Exact effect | Resonance multiplier |
|---|---|---|---|
| `mod_iron_loop` | Iron Loop | equipped Attunements inactive this loop | ×1.25 |
| `mod_frayed_clock` | Frayed Clock | base clock 20 days; all clock modifiers halved toward zero | ×1.25 |
| `mod_mute_ley` | Mute Ley | Echo **shortcuts** disabled (`effects.shortcut`, `repStart`); dialogue unlocks, routes and ending flags still work (endings must stay reachable) | ×1.25 |
| `mod_horde_rising` | Horde Rising | every non-boss encounter gains +1 enemy (max 3) drawn from the region pool; 30% of fodder spawn as elite variants (+40% HP, +20% ATK, ×1.8 XP) | ×1.25 |
| `mod_glass` | Glass | pipeline step 7 multiplies all damage (both directions, including DoT ticks) ×2 | ×1.5 |
| `mod_pacifist` | Pacifist's Vow | kill XP = 0; quest and discovery XP ×2; gold from kills unchanged | ×1.5 |

Multipliers stack multiplicatively, capped at ×3.0. Modifiers are recorded in the run summary and on achievements that require them.

### 15.2 Achievements (40)

| id | Name | Condition | Hidden |
|---|---|---|---|
| `ach_first_steps` | First Steps | leave the Whispering Ruins | no |
| `ach_echo_in_the_library` | Echoes in the Library | complete `q_echo_crystal` | no |
| `ach_six_quests` | The Apex Opens | complete 6 quests in Loop 1 (`quests_completed` ≥ 6, D-048) | no |
| `ach_the_escape` | The Escape | close a loop by the portal (`closer_escape`) | no |
| `ach_the_fall` | The Thirtieth Dawn | see the thirtieth dawn (the Breach Clock expires, D-060) | no |
| `ach_loop_two` | Day One, Again | begin Loop 2 | yes |
| `ach_i_know_what_you_are` | I Know What You Are | speak the `echo_nyx_is_of_the_nine` line to Nyx | yes |
| `ach_brak_lives` | Stonehand Lives | end a loop with Brak alive after the Tyrant falls | no |
| `ach_two_brothers` | The Brothers Stonehand | complete `q_blood_and_salt` | no |
| `ach_vigil` | The Warden's Vigil | ending A | no |
| `ach_mending` | The Mending | ending B | no |
| `ach_weavers_dawn` | The Weaver's Dawn | ending C | no |
| `ach_iron_silence` | The Iron Silence | ending D | no |
| `ach_long_archive` | The Long Archive | ending E | no |
| `ach_unbound` | The Unbound | ending F | no |
| `ach_all_endings` | Every Door | all six endings | no |
| `ach_commune` | It Listens | reach Resolve 8 in communion (D-054) | yes |
| `ach_speedrun` | Before the Tenth Dawn | reach any ending by Day 10 | no |
| `ach_untouched` | Untouched | win a boss fight without taking damage | yes |
| `ach_sworn_remnant` / `ach_sworn_weaver` / `ach_sworn_ironclad` | Sworn to … | reach Sworn with that faction | no |
| `ach_two_oaths` | Two Oaths | Sworn with two factions in one loop | yes |
| `ach_mastery_any` | Mastered | 15/15 abilities mastered in one class | no |
| `ach_five_classes` | Every Life | finish a loop with each class | no |
| `ach_capstone_trio` | Three Capstones | hold all three capstones of a class in one loop | no |
| `ach_bestiary_full` | The Whole Horde | every creature id in the bestiary | no |
| `ach_codex_full` | The Long Reading | all codex entries | no |
| `ach_all_echoes` | Nothing Forgotten | every Echo | no |
| `ach_cartographer` | Cartographer | all 73 locations in map memory | no |
| `ach_legendary` | Legend-Forged | own a Legendary item | no |
| `ach_breach_anchor` | The Anchor | forge the Breach-anchor | no |
| `ach_voidforged` | Void-Forged | craft any void-forged item | no |
| `ach_corrupted` | Marked | reach Corruption 6 | yes |
| `ach_cleansed` | Lanternreed Light | have Elder Wen cleanse Corruption at `loc_breathing_pool` (D-064) | yes |
| `ach_pacifist_loop` | The Vow Kept | finish a loop with Pacifist's Vow and zero kills | no |
| `ach_glass_boss` | Glass Cannon | beat the Unveiled Tyrant with Glass active | no |
| `ach_iron_frayed` | Bare and Hurried | reach an ending with Iron Loop + Frayed Clock | no |
| `ach_bond_any` | A Bond Kept | any companion at loyalty 100 | no |
| `ach_ng_plus` | The Ring Turns | start New Game+ | no |

(Three "Sworn" ids share a row; the table defines 40 distinct ids.)

### 15.3 Run summary contents
Loop number · class · closer or ending · days used and watch of ending · level reached and total XP · gold earned/spent · kills by family (and spared) · damage dealt by source (top 5 abilities with share %, basic attack, DoTs, companion) · damage taken by type · deaths (Loop 1 count; Loop 2+ "Fell on Day n", with the `closer_fall` reason) · quests completed/total available · locations discovered (new to profile marked ◇) · Echoes gained (with codex line) · Resonance earned (breakdown) and multiplier · companions used, final loyalty · faction standings and tiers · key choices (Heartstone, Crystal, Shards, Brak told, Corruption, Tyrant fate) · achievements unlocked · modifiers active · seed and action count (for repro) · "a game by Tim Dibert" (D-027). Legacy score formula (`gold·5 + damage/2 + XP`, halved on loss) is kept as a vanity "Legacy Score" line.

---

## 16. UI/UX specification

### 16.1 Layout model
- **Desktop (≥1024px):** three columns. Left (280px): HUD + context panel (location card, quest tracker, companion card). Center (fluid): the active screen. Right (320px): log (ARIA live) + secondary panel (map thumbnail, intents detail, item detail). Panels (Inventory, Quest Log, Codex, Bestiary, Map, Timeline) open as the center screen with the previous one dimmed behind.
- **Tablet (640–1023px):** two columns (center + right); left panel collapses into the HUD bar.
- **Mobile (<640px):** single column; **bottom tab bar** with five tabs: Explore · Journal (quests/codex/bestiary/timeline) · Pack (inventory/equipment/character) · Map · Menu. Combat and Dialogue take over the screen. Touch targets ≥ 44px (D-035). Swipe left/right between Journal tabs; long-press any item/ability for its tooltip.

### 16.2 HUD
Always visible (top bar on mobile, left column on desktop): name/class/level with XP bar; HP bar (red) and MP bar (blue, labelled by class resource name: Focus/Mana/Mana/Grit/Mana); gold; **clock chip** — Loop 1: small "Day 7 · Dusk"; Loop 2+: "Breach Clock · Day 7 · 23 dawns left" with amber/red states (§10.1); Corruption pips (0–6) appear after the first spellbook; active statuses out of combat (Poison/Bleed/Curse). Companion mini-card with HP and stance.

### 16.3 Screen inventory

| id | Screen | Purpose | Desktop layout | Mobile | Key elements | Keys | Gestures |
|---|---|---|---|---|---|---|---|
| `screen_title` | Title | start/continue; credits "a game by Tim Dibert" | centered card over the Ruins scene | same | Continue (autosave), New Loop, Load, Settings, Achievements, Lore | ↑↓ Enter | tap |
| `screen_class_select` | Class Select | pick class; shows trees | 5 cards center; tree preview right | carousel | fantasy text, base stats, kit, 15-ability tree map, mastery badges (Loop 2+) | ←→ Enter | swipe |
| `screen_explore` | Explore/Map | the main screen | scene art top-center; node map below; actions bar; exits list | scene, actions, map tab | scene SVG, description, NPC/item chips, exits with watch cost, Rest/Retreat/Talk/Take | WASD/arrows select exit, Enter travel, T talk, R rest, E take all | tap node to select, tap again to go |
| `screen_combat` | Combat | fights | §16.5 | §16.5 | enemy cards, intents, ability bar, companion, log | 1–9, G, F, I, C, Tab target, Space log; panels need Shift (Shift+I/Q/C/B/M/L) | tap target, long-press ability |
| `screen_dialogue` | Dialogue | NPC conversations | portrait left, text center, choices stacked | full-screen sheet | speaker, text, choices with glyphs (Echo/class/faction), disabled reasons | 1–9 choose, Enter continue, Esc (if allowed) | tap |
| `screen_inventory` | Inventory & Equipment | manage items | grid 8×5 left, equipment doll right, detail panel | list + detail sheet | slot counter 40, filters by type, compare tooltips (legacy ± diff kept), Use/Equip/Drop/Salvage | I toggle, arrows, Enter, Delete drop (with confirm) | long-press detail |
| `screen_quest_log` | Quest Log | track quests | list left, detail right | list → detail | active/completed/failed tabs, stage journal, objectives checklist, "tracked" star | Q | swipe tabs |
| `screen_codex` | Codex | lore in four voices | categories left, entry right | list → entry | voice tag filter, unlock source, Echo cross-links | C | swipe |
| `screen_bestiary` | Bestiary | creature knowledge | family list left, card right | list → card | sigil, stats known, resistances (revealed or "?"), pattern knowledge level, drops, kills | B | swipe |
| `screen_loop_timeline` | Loop Timeline | compare loops | horizontal rows per loop | vertical, one loop per card | day axis, choice glyphs, Echo pins, ending/closer marker, ending-eligibility hints read from the profile | L | pinch-zoom |
| `screen_threshold_*` | Threshold (4 places) | between loops | one place per screen, nav strip bottom | bottom tabs | §10.8 | ←→ Enter | tabs |
| `screen_merchant` | Merchant | buy/sell | stock left, inventory right, gold center | tabs Buy/Sell | prices with tier modifier shown, compare tooltips, buy-back | Tab switches Buy/Sell, Enter | tap |
| `screen_forge` | Forge | Borin | tabs Upgrade/Craft/Salvage | tabs | recipe list with missing inputs highlighted, upgrade preview (legacy "Damage 5 -> 6" kept), fee, time cost | U/C/V | tap |
| `screen_camp` | Camp | rest and company | fire scene, companion roster, rest options | sheet | Short rest / Full rest (with clock preview "→ Day 8 Dawn"), swap companion, conversation, respec | R short, Shift+R full | tap |
| `screen_settings` | Settings | accessibility, audio | form | form | text scale 100–150, high contrast, reduced motion (system/on/off), volumes, mute, keybinds, screen-reader verbosity | — | — |
| `screen_saves` | Save Slots | 3 + auto | cards | cards | summary, Save/Load/Export/Import/Delete, corrupted state | 1–4 | tap |
| `screen_achievements` | Achievements | 40 badges | grid | grid | hidden shown as "?" until earned | — | — |
| `screen_run_summary` | Run Summary | after each loop | two columns | single | §15.3 | Enter | scroll |
| `screen_ending` | Ending | ending sequence | full-bleed scene, text, epilogue slides | same | per-ending art, epilogue cards per companion/faction, credit | Enter/Space advance | tap |

### 16.4 Global keyboard map (D-035)
`1–9` actions/choices · `WASD` navigate **the map only**; arrows navigate the map and every list · `Enter` confirm · `Esc` back/close · `I` inventory · `Q` quests · `C` codex · `B` bestiary · `M` map · `L` timeline · `T` talk · `R` rest · `G` guard · `F` flee · `Tab` cycle focus groups (and switch tabs in the merchant) · `Space` advance log/dialogue · `?` keybind overlay · `H` toggle HUD detail · `Delete` drop the selected item (always asks to confirm). **In combat** `C`, `I`, `G` and `F` are combat actions (§4.1), so every panel hotkey needs **Shift** while a fight is on screen (Shift+I inventory, Shift+C codex, …) (D-066 #13). All rebindable in Settings; conflicts are rejected with a message.

### 16.5 Combat screen anatomy
- **Top:** 1–3 **enemy cards** (slot order): sigil (SVG, animated unless reduced motion), name + level + elite/boss tag, segmented HP bar (boss: phase segments), **status chips** row (icon + stacks/turns), **intent chip** (type glyph, name, projected range, target arrow; "?" when hidden; dimmed second chip for next-next when revealed). Click/tap a card to target; inspect button opens the bestiary card.
- **Center:** **log**, `aria-live="polite"`, last 8 lines visible (legacy `COMBAT_LOG_LIMIT`), expandable; each damage line can be expanded to show the pipeline steps.
- **Bottom left:** **player panel**: HP/MP bars, status chips, Guard (shows post-guard projections on hover/focus), Flee (shows %), Item (opens consumables sheet).
- **Bottom center:** **ability bar**: tiles grouped by branch colour, tier dots (●●○○○), MP cost (red if Blood price), cooldown overlay, hotkey number; disabled tiles explain why on hover/focus ("Needs 12 MP", "Cooldown 2", "Level 8").
- **Bottom right:** **companion card**: portrait, HP, stance toggle (free), signature button with cooldown (costs the action — label says "Command").
- **Mobile:** enemy cards horizontally scrollable; log collapsed to the last line (tap to expand); ability bar in a bottom sheet with two rows; Guard/Flee/Item/Command as a fixed row above it.
- **Communion** (§4.11): toggle swaps the ability bar for Speak/Listen/Offer/Resist and adds the Resolve meter (eight pips, 0–8, starting at 1) under the Tyrant's HP bar, with the current Movement's question count.

### 16.6 Illustrated node map
- Nodes are rounded sigils tinted by region palette with the location's glyph; the current node pulses (static ring in reduced motion). Edges are curved strokes; locked/conditional exits draw dashed with a lock glyph and tooltip reason (legacy lines kept: "I should talk to Brak before going this way.").
- **Fog:** unknown nodes are not drawn; nodes adjacent to a visited node appear as "?" ghosts (legacy minimap discovery rule). **Remembered** nodes (in `mapMemory` but not visited this loop) are drawn in desaturated grey with name and known camps/merchants (D-011). Visited-this-loop nodes are full colour; cleared encounters show a small check; fixed encounters show a danger pip with level band.
- **Travel:** select an adjacent node (click/tap/arrow keys) → tooltip shows watch cost and the resulting time ("Dusk → Night"), encounter risk ("Lv 2–6 · wandering") and whether a companion restriction applies (Dask) → confirm with Enter/second tap/Go.
- **Breach infection:** a violet-black hatched overlay creeps along edges: from 5 dawns before the limit a forecast shows where the expiry Horde will spread (one node per day from the Apex); any Horde (post-Tyrant, or at expiry after a 3-move delay, §10.2) spreads per move per legacy rules (`infection_delay` edge data; Mistwood Path → Silverwood Plaza = 2). Infected node entry shows "⚠ −33% HP". The Library portal is marked once a Horde starts.
- Region labels float over clusters; a legend toggles. Desktop shows the full map in `screen_explore`; mobile has a Map tab with pinch-zoom and a "center on me" button.

### 16.7 Accessibility checklist
- Contrast ≥ 4.5:1 for all text and ≥ 3:1 for UI glyphs in both themes; a **high-contrast theme** swaps the palette for solid fills and thick outlines.
- Visible focus ring (2px outline + 2px offset) on every interactive element; logical tab order; focus trapped in modals; `Esc` closes.
- `prefers-reduced-motion` (or setting): no pulses, no particle drift, no screen shake; transitions ≤ 150ms fades; the audio "pulse" disabled (D-035).
- Text scale 100–150% via root `font-size`; layouts reflow, no truncation of numbers.
- Screen-reader labels: every chip has `aria-label` ("Intent: Maul, physical, 14 to 17 damage, targeting you"); HP bars are `role="meter"`; the log is a live region; map nodes are buttons with names and states ("Barren Peaks, remembered, 1 watch").
- Colour is never the only carrier: damage types have glyphs, statuses have icons + text, infection has hatching, rarity has a border pattern.
- Touch targets ≥ 44px; no hover-only information (long-press equivalents).
- Playwright a11y checks, implemented in-repo because axe-core is unavailable (D-065): a token-contrast unit test over both themes; `getByRole` name/role queries on every screen (every interactive element has an accessible name); a keyboard focus-order walk per screen (no traps outside modals, visible focus ring); `prefers-reduced-motion` emulation asserts no animations longer than 150 ms.

### 16.8 Onboarding (Loop 1)
- **First fight** (Darkened Corridor, Corrupted Shade — legacy placement): the Shade's first intent is forced to **Wail** with a callout "An intent shows what the enemy will do next: type, target, number." After the player's first action, callout "Guard halves the number and builds your resource" with the Guard button highlighted; the Shade's second intent is forced to Rake so Guard visibly halves it. No forced choice; callouts dismiss on action.
- **Abilities:** the level-1 AP toast explains tiers ("More open at levels 4, 8, 12, 16").
- **First camp** (Whispering Ruins fire, prompted after the first fight by Ilyra's line): callout "Resting carries you to the next dawn" with the day counter ticking Day 1 → Day 2; the clock chip is pointed out once ("Days pass. Nothing more — for now."). Short rest is introduced at the second camp.
- **Statuses:** the first time any status appears, its chip tooltip opens automatically once.
- **Intent branching:** the first creature with a conditional (Wildling Brute at Barren Peaks) shows "Some creatures change plans below half health."
- **Loop 2 Day 1:** a single callout introduces the Breach Clock and the Loop Timeline; Echo glyph callout on the first Echo-tagged dialogue choice.
- All callouts are skippable in Settings ("Tutorials: off") and never appear in Loop 2+ except the Breach Clock one.

---

## 17. Art direction

### 17.1 Palettes (hex) — 11 regions + Threshold
Each palette: sky top · sky bottom · far silhouettes · mid elements · near elements · accent/particles.

| Region | sky top | sky bottom | far | mid | near | accent |
|---|---|---|---|---|---|---|
| Silverwood Ruins | `#1B1F3B` | `#4A3F6B` | `#2E2A4D` | `#5B5380` | `#1A1826` | `#9FD8FF` (crystal glow) |
| Mistwood & the Ironclad Reach | `#2B3A3A` | `#6E8C7A` | `#3F5A4E` | `#5E7A68` | `#1F2A24` | `#D98B3A` (forge ember) |
| The Voidscar | `#0B0A14` | `#2A1B3D` | `#1C1230` | `#3B2A57` | `#070610` | `#7B3FE4` (void violet) |
| Aether-Kissed Highlands | `#1E2A4A` | `#7FA8D9` | `#3C5A8A` | `#6E8FC4` | `#1A2238` | `#E8F3FF` (aether white) |
| Glowlands & Nexus | `#0F2A22` | `#1F5C44` | `#15382C` | `#2F7A5A` | `#071A14` | `#7CFF9E` (bioluminescent green) |
| The Drowned Reach | `#0D1B2A` | `#1F4E6E` | `#153A52` | `#2C6A8A` | `#081219` | `#8FD3E8` (ley through water) |
| The Ashen Steppe | `#3A2E2A` | `#B08A6A` | `#6B4F40` | `#9C7A5F` | `#2A1F1A` | `#E05A3A` (ash fire) |
| The Veil | `#120A1E` | `#3A1F52` | `#24143A` | `#4B2C6E` | `#0A0612` | `#C86BFF` (sanctum light) |
| The Glowfen | `#14261A` | `#3E6E3A` | `#244A2A` | `#4F8A44` | `#0C1A10` | `#D9FF66` (lantern yellow-green) |
| The Skyreach | `#0E1C3A` | `#9FC0E8` | `#2F4F80` | `#7F9FD0` | `#1A2A4A` | `#FFE9A8` (sun on stone) |
| Silverwood Before | `#2B2E5A` | `#E0C27A` | `#5A5E9A` | `#C9B47A` | `#2A2440` | `#FFF4D0` (pre-Sundering gold) |
| The Threshold | `#05060C` | `#1A2140` | `#0F1428` | `#283055` | `#030408` | `#B8C7FF` (far light) |

UI neutrals: background `#0E0F14`, surface `#171922`, text `#ECEFF4`, muted text `#A7ADBD`, HP `#E24B4B`, MP `#4B8BE2`, gold `#E2B14B`, Echo `#9FD8FF`, Corruption `#7B3FE4`. High-contrast theme: text `#FFFFFF` on `#000000`, borders `#FFFFFF`, status fills solid.

### 17.2 Parametric SVG scene system
One `<Scene>` component composes six layers from a `SceneSpec` per location:

```ts
type SceneSpec = {
  palette: RegionId; timeOfDay: "dawn"|"day"|"dusk"|"night";       // tints sky and particles
  horizon: { y: number; curve: "flat"|"hills"|"jagged"|"flooded" };
  far: { kind: "spires"|"ruins"|"trees"|"peaks"|"dome"|"none"; density: 0..1; seed: number };
  mid: { elements: ("arch"|"fountain"|"tent"|"palisade"|"shelves"|"crystal"|"heartstone"|"forge"|"reeds"|"chasm"|"lantern")[]; seed: number };
  near: { elements: ("rubble"|"roots"|"water"|"scree"|"grass"|"ice")[]; seed: number };
  particles: { kind: "dust"|"motes"|"embers"|"mist"|"glow"|"ash"|"snow"|"void_flecks"|"none"; rate: 0..1 };
  focal?: FocalId;                                                   // hand-authored piece (Heartstone, Apex tear, Emberforge, Tyrant)
  breachOverlay?: 0..1;                                              // infection/Fall intensity
};
```

Layers: (1) sky linear gradient top→bottom, dawn/dusk add a horizon band of the accent at 30%; (2) horizon path; (3) far silhouettes at 35% opacity, seeded placement; (4) mid elements at 70%; (5) near elements at 100% with the "near" palette; (6) particles (CSS animation, disabled under reduced motion; count ≤ 24). Scenes render at a 16:7 viewBox, scale with the column, and are deterministic from `seed` (visual seed, not game RNG, D-032). Legacy ASCII art is retired but each legacy location's spec is written to echo its ASCII silhouette (the Archway's arch, the Library's shelf rows, the Emberforge's flame).

### 17.3 Creature sigils
Each creature is a 96×96 SVG sigil: a bold outer shape (circle for breach-born, hexagon for constructs, teardrop for void, triangle for beasts, rhombus for aetherial, spiral for chrono) in the region's mid colour, an inner glyph in the accent, and one animated detail (flicker opacity for Phantoms, slow rotation for Aberrations, ember drift for Golem seams, drip for Drowned). Elite variants add a thin double outline; bosses a segmented ring that doubles as the phase bar. Companions and NPCs get portrait sigils in the same grammar with a warm backing.

### 17.4 Item icons
48×48 single-stroke glyphs with a rarity-patterned border (Common plain, Uncommon dotted, Rare dashed, Epic double, Legendary double with corner marks) and a type badge. Affixes add a small suffix glyph at the lower right. Numbers never live inside icons.

### 17.5 Iconography — damage types and statuses
Damage types: Physical = diagonal blade; Fire = three-tongue flame; Storm = jagged bolt; Ley = flowing double wave; Void = ring with a missing arc; Chrono = hourglass-spiral. Statuses: Bleed drop, Burn flame-with-base, Shock small bolt in a circle, Soaked droplet with ripple, Slow hourglass bottom-heavy, Haste hourglass top-heavy with motion lines, Stun starburst, Weaken down-arrow, Armor Break cracked plate, Mark crosshair, Curse sigil-eye, Shield hexagon with number, Regen leaf, Taunt horn, Phase dashed outline figure, Rewind counter-clockwise spiral with countdown, Poison skull-dot, Blind closed eye. Each is a 16×16 glyph and a text label; glyph + colour + label always appear together.

### 17.6 Typography
System fonts only (no external assets, D-036). Titles: `Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", "Times New Roman", serif`. Body: `"Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, system-ui, sans-serif`. Numbers in tables and bars use `font-variant-numeric: tabular-nums`. Minimum body size 16px at 100% scale; line-height 1.5; max text measure 68ch.

### 17.7 Motion rules
Durations: micro 120ms, panel 200ms, scene crossfade 400ms; easing `cubic-bezier(.2,.8,.2,1)`. One ambient motion per scene at most (particles), one per creature card (its detail). Damage numbers float 600ms; crits scale 1.2× once. No screen shake above 2px and never under reduced motion. The Breach overlay animates only on day change. All motion respects `prefers-reduced-motion` and the Settings override.

---

## 18. Audio direction

### 18.1 Web Audio architecture
A single `AudioEngine` (D-036): `AudioContext` created lazily and `resume()`d on the first user gesture (pointer/keydown); until then the UI shows a muted glyph. Graph: `master (GainNode, with DynamicsCompressor) ← { ambient, sfx, music } (GainNodes)`. Volumes 0–1 per bus + mute, persisted in profile settings. Ambient and music use a `crossfade(toRecipe, 1.5s)` with two voice slots. SFX are fire-and-forget nodes scheduled at `ctx.currentTime` with ≤ 8 concurrent voices (oldest stolen). Everything is synthesised: oscillators, noise buffers (generated once), biquad filters, LFOs, convolution-free reverb via feedback delay lines. Audio never affects game state and uses its own RNG seed.

### 18.2 Per-region ambient recipes

| Region | Oscillators | Filter | LFO | Noise | Character |
|---|---|---|---|---|---|
| Silverwood Ruins | 2× sine (55, 82.5 Hz) + triangle (220) at −18 dB | lowpass 600 Hz | 0.08 Hz on filter ±200 | pink, −30 dB, band 200–800 | hum of whispering stone |
| Mistwood & Ironclad Reach | sawtooth 110 Hz through lowpass 300 at −20 | highpass 80 | 0.2 Hz amp wobble | brown (wind), −26 dB | wind, distant hammer tick every 3–5 s (sfx bus) |
| The Voidscar | sine 41 Hz + detuned sine 41.7 (beating) | lowpass 250 | 0.05 Hz detune drift | white, bandpass 3 kHz, −36 dB sparse bursts | cold void beat |
| Aether-Kissed Highlands | 3× sine (330, 440, 660) at −24 with slow random pan | bandpass 800 Q 2 | 0.3 Hz pan | pink −34 | shimmer chord |
| Glowlands & Nexus | triangle 73 Hz + square 146 at −26 | lowpass 400 | 0.5 Hz amp (breathing) | water drips: filtered clicks every 2–4 s | breathing glow; Nexus adds a 7 kHz tick every 1 s (clock) |
| The Drowned Reach | sine 49 Hz | lowpass 200 | 0.1 Hz | underwater brown noise −24 with resonant 180 Hz | submerged |
| The Ashen Steppe | sawtooth 98 Hz −22 | highpass 120 | 0.15 Hz filter sweep | wind brown −20, gusts | dry wind, ash |
| The Veil | sine 36 Hz + sine 54 (fifth) −20 | lowpass 180 | 0.04 Hz | whispered formant noise (bandpass 1.2 kHz sweeping) −36 | hushed sanctum |
| The Glowfen | triangle 65 Hz −24 | lowpass 500 | 0.4 Hz | insect chirps: short sine bursts 2.5–4 kHz random | humid night |
| The Skyreach | sine 220 + 330 −26 | highpass 300 | 0.25 Hz pan | wind white −18 with 2 kHz whistle resonance | thin air |
| Silverwood Before | triangle 131, 165, 196 (major triad) −22 | lowpass 1.2 kHz | 0.1 Hz | crowd murmur (filtered pink) −30, bells every 20 s | the living city |
| The Threshold | sine 32.7 Hz −16 + sine 65.4 −22 | lowpass 150 | 0.03 Hz | none | the still shore |

### 18.3 SFX list (synthesis sketches)

| id | Sketch |
|---|---|
| `sfx_ui_tick` | 2 ms click: square 2 kHz, decay 20 ms |
| `sfx_ui_confirm` | sine 660→880 Hz glide 60 ms |
| `sfx_ui_back` | sine 440→330 Hz 60 ms |
| `sfx_ui_error` | square 220 Hz, 2 pulses × 40 ms |
| `sfx_travel` | footsteps: 3× filtered noise taps 80 ms apart, lowpass 400 |
| `sfx_rest_dawn` | rising sine 110→440 over 1.2 s + pink wash |
| `sfx_hit_physical` | noise burst 30 ms + sine 150 Hz thump 80 ms |
| `sfx_hit_fire` | noise bandpass 1.5 kHz 200 ms + sine 90 Hz sweep down |
| `sfx_hit_storm` | white noise 15 ms crack + sine 4 kHz→200 Hz 120 ms |
| `sfx_hit_ley` | triangle 523 Hz + 784 Hz, 300 ms, slow release |
| `sfx_hit_void` | sine 60 Hz + reversed envelope noise 250 ms, lowpass 300 |
| `sfx_hit_chrono` | three stuttered sine 880 Hz blips 40 ms each, descending |
| `sfx_crit` | layered `sfx_hit_*` + sine 1.2 kHz ping 150 ms |
| `sfx_miss` | noise whoosh bandpass 2 kHz 120 ms, pan across |
| `sfx_guard` | metallic: square 330 + 495 Hz 60 ms through highpass 500 |
| `sfx_shield_up` | triangle 440 Hz arpeggio 3 notes 50 ms each |
| `sfx_shield_break` | glass: noise bandpass 5 kHz 90 ms + descending sine |
| `sfx_status_apply` | short sine 660 Hz 40 ms + status-specific tail (Burn crackle, Bleed drip 2 kHz tick, Shock buzz) |
| `sfx_heal` | sine 523→659→784 Hz 200 ms |
| `sfx_level_up` | triad chord sine (262, 330, 392) 800 ms + sparkle noise |
| `sfx_echo_gain` | bell: sine 1047 Hz with 3 partials, decay 2 s, slight reverb |
| `sfx_resonance` | soft sine 880 Hz 80 ms ×n per unit |
| `sfx_intent_flip` | two-note square 440→523 Hz 40 ms (when a creature changes plan) |
| `sfx_clock_warning` | low bell sine 220 Hz with 110 Hz sub, 1.5 s; Day 28+ adds detune |
| `sfx_breach_tear` | long noise sweep 2 s lowpass 200→4 kHz + sine 30 Hz |
| `sfx_forge_hammer` | noise 20 ms + sine 200 Hz 60 ms, ring sine 1.8 kHz 300 ms |
| `sfx_coin` | two sine clicks 2.2 kHz / 3.1 kHz 30 ms |
| `sfx_combat_start` | low drum: sine 55 Hz 200 ms + noise snap |
| `sfx_victory` | ascending triangle 330-440-550 Hz 500 ms |
| `sfx_ko` | descending sine 330→110 Hz 400 ms |

Combat percussion: a `music` bus pattern during fights — kick (sine 50 Hz, 120 ms) on each round start, a filtered noise hat on each turn, tempo fixed at 84 BPM-equivalent spacing but triggered by events, not a clock, so it never desyncs from turn flow.

### 18.4 The Tyrant theme
`music` bus, built from the Threshold drone: fundamental 32.7 Hz (C1) sine with a second sine at 34.6 Hz (beating ~2 Hz = the Tyrant's "held moment"); above it a triad that is *almost* in tune (C3, E♭3 at +25 cents, G3 at −25 cents) on triangle waves at −20 dB; a 7 kHz clock-tick every 0.75 s that desyncs by 30 ms per phase; a reversed-envelope noise swell every 8 s. Phase changes add a voice (P2: sawtooth 65 Hz filtered 300 Hz; P3: the tick doubles; P4: all detune drifts to ±50 cents). Communion progress pulls the triad back toward just intonation as resolve rises (resolve 100 = pure C minor, tick silent). Length: infinite loop by construction; no samples.

### 18.5 Mute, volume, reduced motion
Mute toggles `master.gain = 0` instantly and persists. Volume sliders 0–100 map to perceptual gain (`gain = v²`). Reduced motion (system or setting) disables the audio "pulse" (LFO amplitude modulation on ambient) and the combat hat ticks, leaving static drones and event SFX (D-035). Tab hidden → `ctx.suspend()`; shown → `resume()`. Audio errors never throw into the engine or UI.

---

## 19. Balance targets

D-037 restated as measurable assertions produced by `src/sim/` and written to `BALANCE.md`:

| # | Target | Measure |
|---|---|---|
| 1 | Every class finishes Loop 1 ≥ 60% | **Escape rate** (D-066 #17): share of seeded runs that kill the Contained Tyrant and reach the portal (`closer_escape`) with the `melee` or `caster` bot, N ≥ 200 per class. Clock-expiry closers and FALLEN game-overs are reported separately and do not count |
| 2 | No single ability > 35% of a class's total damage | aggregate over all runs per class, `damageBySource` |
| 3 | Difficulty monotone across regions | median fight length (turns) and death rate per region band are non-decreasing in band order |
| 4 | Every ending reached | each of A–F reached ≥ 1 in the three-loop `explorer` + scripted-choice suites |
| 5 | Every quest completed | §13.4 |
| 6 | Every location reached | 73/73 in the union of `explorer` runs |
| 7 | Zero soft-locks in 2,000+ runs | no state with no legal progress-making action for 60 steps |
| 8 | Fight length by band | fodder single: 3–5 turns; fodder pair/triple: 5–8; elite: 6–9; regional boss: 10–14; Contained Tyrant: 12–18; Unveiled Tyrant (fight path): 14–20 |
| 9 | Deaths per loop by bot | Loop 1 `melee`/`caster`: mean ≤ 1.0, ≥ 55% zero-death; `explorer`: ≤ 1.5; `random`: ≥ 3 (sanity: the game must punish randomness) |
| 10 | Loop duration | Loop 1 human 60–90 min (bot proxy 350–600 engine actions, 22–26 days for `explorer`, 12–16 for `speedrunner`); Loop 3+ focused 20–30 min (120–220 actions) |
| 11 | Level at the Loop 1 Apex | `explorer` median 11–13; `speedrunner` ≥ 9 (D-066 #1) |
| 12 | Ability usage | per-class bands: Ranger, Elf, Warden 40–60% of combat actions; Wizard and Shadow Weaver (casters) 55–80% (no class reduced to basic-attack spam, none to pure spam); Blood price used in 10–30% of Weaver casts |
| 13 | Resource health | fights ending with 0 MP ≤ 15% for every class |
| 14 | Economy | gold never negative; healing consumable affordable within two kills at every band; end-of-loop balance 50–200 median |
| 15 | Clock | `explorer` Loop 1 expiry rate 10–20% (expiry must be reachable but not common), measured with the bot's Heartstone choice logged; `speedrunner` 0% |
| 16 | Resistance relevance | each damage type is the best choice in ≥ 15% and ≤ 35% of fodder encounters by band |
| 17 | Companion value | fights with a companion end 20–35% faster than without at equal level |
| 18 | Variance sanity | the ±10% roll changes a fight's outcome (win/lose) in < 3% of replays with fixed decisions |
| 19 | Contained Tyrant | fixed-level scenario sims (`pre_tyrant_*`) for every class at **L11 and L13**, solo and with a companion: median 12–18 rounds at L11; `melee`/`caster` win rate ≥ 60% at L11 and ≥ 80% at L13; effective HP (§6.6) ≤ 850 |
| 20 | Unveiled Tyrant | fight path at L15–18: median 14–20 rounds; communion path: Resolve ≥ 3 reachable by the scripted bot from Loop 2 with STORY's Movement I–II Echoes |

This table is the **single balance-target table** (D-066 #17); PLAN §1.2 and §7 measure exactly these rows.

---

## 20. Open questions for the lead

Questions 1–10 of the first draft are resolved: Apex band vs Loop 1 level (D-051, D-066 #1: the Contained Tyrant is tuned for level 11); quest count (D-045: 44 total including the six legacy quests; class mini-quests and stretch quests are outside it); two Heartstone fragments (D-052, D-066 #10); companion command costs the action and Guard generates resource for every class (D-053); Echo id spelling (D-044); Dark Spellbook drop (D-055: first Shade 100%, later 50%); closer Resonance +10 (D-055); id reconciliation (D-062, REGISTRY-DRAFT, D-066 #20); Resolve and phase ids (D-054, D-066 #6). Still open:

1. **Steppe road (REVIEW-CROSS C-46).** This revision accepts WORLD X3: `echo_steppe_waystones` opens a conditional 1-watch road `loc_scorched_gate` ↔ `loc_reedmarch_descent` (§10.1). If the lead prefers to drop the Echo, delete it from §10.1/§10.5 and REGISTRY §6.2.
2. **Dask on the Veridian Glowlands (C-10, WORLD X8).** D-059 leaves it unflagged, so Dask drops out on the Apex road and returns at the Nexus (§12.8). Amend D-059 if he should walk the whole road.
3. **Phase 3 ×1.5 damage taken** on the Contained Tyrant (STORY §8.4) is kept provisionally (C-33); the §19 #19 sims decide.
4. **Regional boss level** stays band top + 2 (D-066 #21); WORLD's +1 stat blocks are retuned in U9 and checked by §19 #8.

---

## Changelog (U8)

Revision U8 (2026-10-13) applies `docs/reviews/REVIEW-DESIGN-PLAN.md` (as ruled in D-066), REVIEW-CROSS §4's U8 list and every REGISTRY-DRAFT action that targets DESIGN.

- **Header / conventions:** canon through D-066; ids per D-044 and REGISTRY-DRAFT; time counted in watches; STORY §12 named as the Echo catalog.
- **§2:** loop-closer table and flowchart follow D-049/D-060/D-066 #7 (both Loop 1 closers → Loop 2 Day 1; expiry starts the Horde; `closer_escape` / `closer_fall` + reason); Threshold first visited after Loop 2.
- **§3.2:** flee blocked only for bosses and story gates.
- **§4.1:** status-timing exception (D-066 #4); round counter defined; self-cost availability rule; combat keys vs Shift-panels.
- **§4.2:** `Step` uses `move` + a `moves` table, `phaseHold`; canonical `CombatWhen` (`everyNth`, `first`, `oncePerFight`, `allyPresent`, …); intent stores `{moveId, targetUid, projected, hidden}`; bestiary reveals by kill count replace bestiary Echoes.
- **§4.4–4.6:** plain damage-type ids; Burn tick `1 + 0.2·SP`; DoT ticks take resistance, never armor/ward/Guard; Rewind consumed by Void or Ley, boss Rewind capped at 10% max HP.
- **§4.7:** scatter rule for fled fixed groups (D-066 #11); Horde deaths in Loop 1 are `closer_fall`.
- **§4.9:** companions have no MP; cooldown-based auto abilities; armor/ward +1 per 4 levels.
- **§4.10:** boss schema (`enterWhen` OR-list, rounds, `countSolo`, `statusImmunities`, `tauntImmune`); Contained Tyrant retuned (460 HP, Remember once per phase, adds 2× Aberration at 40% / 1 solo, Brace 0.6·SP, Aulde 1.0·SP, no Sallow regen, P3 at round 12, tuned for L11, effective HP ≤ 850); WORLD's moves adopted; phase ids `tyr_movement_1..3` + `tyr_phase_4`; `cr_tyrants_reach` adds.
- **§4.11:** communion rewritten: Resolve 0–8 from 1, Movements I–III, STORY questions, WORLD conversions, rejection at the end of II/III, F ≥ 3 / A ≥ 6 / B = 8, +2 days at ≥ 4; `tyr_stillness` and `echo_tyrant_communion` removed.
- **§4.12:** ids; first Shade's spellbook 100%; Phase expiry note matches the new timing rule.
- **§5:** half-point AP; DoTs count toward budgets; self-cost rule; Wizard regen `3 + ⌊level/4⌋`; `wiz_fireball` 10 MP `1.2·SP + 3` Burn 60%; `wiz_echo_bolt` 10 MP `1.1·SP + 2`; `wiz_lightning_bolt`; Ambush condition; Blood price rule; Void Lance `1.3·SP + 3`; `rgr_*` ids; new `itm_echo_bolt` (Amulet, every class).
- **§6:** Loop 1 level ranges (route T1 12–13, legacy-only 10–11, speedrun ≥ 9); boss level +2 and boss HP ×3.5–4.5; Tyrant effective-HP budget; `cr_anomaly_*`; region ids; Korr codex at Corruption 3; Elder Wen's cleanse and `flag_corruption_cleansed`; `echo_korr_marginalia`.
- **§7:** T5 row (D-066 #22); item stat vocabulary; item budget 157 adopted; Amulet never resets; `item_cistern_key`.
- **§8:** four WORLD materials added; family names are material kin; `cr_tyrants_reach`; Breach-anchor 0 gold, Neutral gate during `q_the_mending`/`q_iron_silence`, ember ore ×3, `echo_void_resonance` moved to the B consent; two fragments per Heartstone choice; `recipe_storm_jar`.
- **§9:** WORLD's eight merchants and markups; no Skyreach merchant or inn; story recipes cost 0.
- **§10.1:** clock stored in ticks, effects in watches; `q_the_mending` stage +3, `q_day_of_teeth` −2, communion +2 at Resolve ≥ 4; clock floor (current day + 3 dawns); Loop 1 Destroy line; Ending E gate `daysLeft ≤ 1`; warnings by dawns left; Steppe road (C-46); Silverwood Before counter.
- **§10.2–10.3:** clock expiry runs the Horde with a 3-move delay and the Library portal; the Amulet is kept; Loop 1 → Loop 2 skips the Threshold; `loopCounter = max + 1`.
- **§10.5:** catalog replaced by an effects table keyed to STORY §12 ids (REGISTRY §6 mapping; 26 adds marked; 14 retired).
- **§10.6–10.9:** Loop 1 Resonance banked; `screen_threshold_*` ids; `q_class_*` ids.
- **§11:** `q_*` ids; scroll-to-Nyx choice; rep budget re-cut to STORY §11 with a Sworn check; `echo_brak_birth_name` / `q_blood_and_salt`.
- **§12:** plain companion ids; Dask Loop 2+ and D-059 flag (no region list); Caelum per STORY; no companion MP; cooldowns by kind; `echo_brak_lives`, `echo_nyx_bond`; loyalty/companion condition forms.
- **§13:** `q_*` quest ids; one canonical condition/effect table (adds `counter`, `loyalty`, `resolve`, `clock.daysLeft`, `watch`, `beforeDay`, `beforeResets`, `level`, `modifier`; `clockWatches`, `passWatches`, `scatter`, `unlockRecipe`, `unlockCodex`, `resolve`; `stat` limited to primaries); examples rewritten (Apex gate = D-048 exactly); completability scope per D-045.
- **§14.1:** save/profile `version: 1` (D-058), `profileLoopAtSave`, `player.statuses`/`uses`, `world.gather`/`encounterHp`, `before`, companions without MP, all ids canonical.
- **§15:** achievement conditions per REGISTRY §18; Mute Ley no longer mentions bestiary Echoes.
- **§16:** keyboard map (Shift-panels in combat, Delete-to-drop, WASD map-only, Tab in merchant); Resolve pips; Horde forecast; in-repo a11y checks replace axe-core (D-065).
- **§19:** #1 Escape rate; #11 explorer 11–13 / speedrunner ≥ 9; #12 per-class bands (casters 55–80%); new #19 Contained Tyrant scenario sims at L11/L13 and #20 Unveiled; declared the single balance-target table.
- **§20:** resolved questions folded; four remaining open items.

### Changelog (U9.5)

Touch-ups from D-067 / D-068 / D-069.
- **§2 / §10.2:** `closer_fall` reason `released`; *Let go* at any camp from Loop 2 and *Keep the vigil* for ending E (D-067.14); Loop 1 Apex *Face it / Not yet* (D-067.1).
- **§4.11:** `tyr_hour_presses` = 8% max HP × (1 − Resolve/8), cannot kill while Resolve ≥ 3; *Offer* never consumes; attacking forfeits the current question (D-067.3); *Listen* carries no damage rider (D-069.8).
- **§10.1 / §10.3 / §10.9:** Silverwood Before return costs 1 day, loot once per loop (D-067.5); level carry-over ⌊0.6 × best level⌋, cap 10 (D-067.2); `flag_tyrant_dead` cleared at reset (D-069.6); Threshold-started quests survive (D-067.15); class mini-quests Loop 2+ (D-069.7).
- **§11.3 / §12.1:** any faction can reach Sworn in Loop 1; Ilyra recruitable from Loop 2 (D-069.4).
- **§13.3:** effect kinds `multiHit`, `stripBuffs`, `healOnDamage`, `surviveRounds` (Unraveling Tide), `leaveCombat` added, `passWatches` examples (`q_preserve_or_heal` 8, Bell Vault 4; D-069.5, D-069.9); `endLoop` reason `released`.
- **§14.2:** no autosave at the Loop 1 Apex or during a Horde.
