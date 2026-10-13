# WORLD §10–12 — Encounter design, map data, world-state variants (W-C)

Deliverable of brief W-C, for the lead to merge into WORLD.md. Owners per D-062: WORLD owns places,
map, encounters and placement; DESIGN owns systems and numbers; STORY owns quests and Echoes.
Canonical ids follow the sibling errata already filed: faction `weavers` (04-06 E10), STORY Echo ids
(04-06 E9), `npc_elder_wen`, `npc_hollis_cade`. Every number below was computed from WORLD §3 exits
and encounters by a script (graph distances, expected fights, Horde spread, clock); the inputs are
§3 as committed plus the rulings marked **R10-n**, which are proposals until the lead accepts them.

---

## 10. Encounter design per region

### 10.0 Rules used in this section

- **Expected fights.** A `first:` group at p% counts p/100 on the loop's first visit. A `return:`
  line "X (p%) or pool 20%" counts `p + (1 − p)·0.2`. Loop 2+ adds DESIGN §6.6 anomalies
  (`10% + 5%·(loop−1)`, cap 30%) on nodes with no fixed encounter; the tables below are Loop 1.
- **Watches.** One per edge (WORLD §1). Exceptions, as edge data in §11.2: the Pale Gullet → Elder
  Mangrove haul costs 2 (§3.9), and the two Skyreach ascents (Spires → Spire-Crown, Plateau →
  Windward Stair) cost 2 going up (DESIGN §10.1 "Skyreach ascent 2 watches per climb"). Combat costs
  0, a flee 1 (DESIGN §4.7), the Heartstone ritual 1, the first forge action of a visit 1. Silverwood
  Before and the Threshold cost no Breach Clock time.
- **R10-1 · `onFlee` encounter field.** DESIGN §4.7 leaves a fled encounter at the node until it is
  beaten, which turns every 100% fixed group into a wall for anyone who will not kill. WORLD encounter
  data gets one field: `onFlee: "hold" | "scatter"`.
  - `hold` (DESIGN's default behaviour): bosses, Horde encounters, and **story gates**, meaning a
    legacy kill quest's target while that quest is active (`cr_wildling_brute` under `q_clear_path`,
    `cr_stone_hide_golem` ×2 under `q_blighted_outpost`, `cr_drowned_archivist` at the Sunken Archives
    under `q_lost_scroll`) and the Before's day-scripted guards (Archives Day 2, Hall Day 3, Conflux).
  - `scatter`: every other fixed group, wandering roll and anomaly. A successful flee places the party
    at the previous node (DESIGN unchanged); the group is gone for this loop, with no XP and no loot,
    and the node behaves as visited. Passing a scattered node costs **+2 watches** (the flee and the
    re-entry) plus failed-flee turns.
- **R10-2 · Forced combat.** A node is forced when entering and passing it needs a won fight: a `hold`
  encounter with no non-combat bypass satisfied. Only bosses and story gates may be forced (§10.5).
- **R10-3 · Expiry Horde delay.** The Tyrant-kill Horde keeps the legacy one-move delay. The
  clock-expiry Horde (D-060) starts with a **three-move** delay. With the legacy delay, a player in
  the deep Glowfen at expiry (Firefly Barrows, Pale Gullet, Matron's Hall) must cross 6–7 infected
  nodes, which kills them (each costs ⌈maxHP/3⌉); in Loop 1 that is a FALLEN game-over. With three
  moves, every one of the 61 present-day nodes has a damage-free route to the Library (§10.7).

### 10.1 Wandering pools (`pool(region)` in §3)

Size per DESIGN §4.8: 1 creature (70%) or 2 (30%); `mod_horde_rising` adds 1. Only fodder whose level
sits in the band. Weights are relative.

| pool | entries (weight) | conditions |
|---|---|---|
| `pool_silverwood_ruins` | cr_corrupted_shade 35 · cr_arcane_wisp 35 · cr_mistwood_prowler 20 · cr_drowned_archivist 10 | loc_silverwood_plaza Loop 2+: 25% of rolls become cr_paradox_wisp (§3.1) |
| `pool_mistwood_ironclad_reach` | cr_mistwood_prowler 45 · cr_rootling 40 · cr_wildling_brute 15 | loc_barren_peaks Loop 2+: 15% cr_stutter_hound (§3.2) |
| `pool_voidscar` | cr_void_touched_stalker 100 | Weavers ≤ Wary: cr_veil_sentry 40 · stalker 60 |
| `pool_aether_kissed_highlands` | cr_moment_moth 30 · cr_shimmering_phantom 25 · cr_glass_mote 20 · cr_steppe_harrier 15 · cr_aetherial_weaver 10 | — |
| `pool_glowlands_nexus` | cr_glowfen_mireling 30 · cr_lantern_toad 25 · cr_spore_drift 20 · cr_hourglass_crawler 25 | crawler at loc_chronos_nexus only (its weight goes to mireling elsewhere) |
| `pool_drowned_reach` | cr_brine_lamprey 35 · cr_pale_diver 30 · cr_tide_clerk 20 · cr_drowned_archivist 15 | — |
| `pool_ashen_steppe` | cr_salt_jackal 40 · cr_steppe_harrier 35 · cr_reed_stalker 25 | reed stalker at loc_watchfire_ridge / loc_reedmarch_descent only |
| `pool_veil` | cr_hollow_lantern 40 · cr_null_mouth 35 · cr_veil_sentry 25 | Weavers ≤ Wary: sentry 50 |
| `pool_glowfen` | cr_glowfen_mireling 30 · cr_lantern_toad 25 · cr_spore_drift 20 · cr_reed_stalker 15 · cr_barrow_light 10 | barrow light at dusk/night only |
| `pool_skyreach` | cr_gale_kite 50 · cr_cloud_ray 40 · cr_sky_whisper_sentinel 10 | — |
| (Silverwood Before, Threshold) | none | the Before is day-scripted (§12); the Threshold has no combat |

### 10.2 Anomaly variants (DESIGN §6.6: two per legacy region, one per new region)

Each one twists an existing creature (bestiary shows the twist). XP ×1.3 and a guaranteed material
drop (DESIGN). They spawn only in regions where the base creature lives.

| id | region | base | twist (telegraph-length) | loop ≥ |
|---|---|---|---|---|
| `anomaly_echoed_shade` | silverwood_ruins | cr_corrupted_shade | Repeats its previous intent; both are shown. | 2 |
| `anomaly_split_wisp` | silverwood_ruins | cr_arcane_wisp | At half HP it splits into two wisps at 40%. | 2 |
| `anomaly_frayed_brute` | mistwood_ironclad_reach | cr_wildling_brute | Permanent Haste; telegraphs two intents. | 2 |
| `anomaly_rootbound_pack` | mistwood_ironclad_reach | cr_rootling ×3 | Three rootlings share one HP pool. | 2 |
| `anomaly_phase_stalker` | voidscar | cr_void_touched_stalker | Phased on even turns; Void damage still lands. | 2 |
| `anomaly_tethered_stalkers` | voidscar | cr_void_touched_stalker ×2 | Damage to one is split between both. | 3 |
| `anomaly_doubled_phantom` | aether_kissed_highlands | cr_shimmering_phantom | Fights beside its past self (a 50% HP copy). | 2 |
| `anomaly_flat_chord_weaver` | aether_kissed_highlands | cr_aetherial_weaver | Its Shock chains to you and your companion. | 2 |
| `anomaly_aberration_pair` | glowlands_nexus | cr_temporal_aberration ×2 | Two Aberrations share one Rewind (Nexus only). | 3 |
| `anomaly_late_mireling` | glowlands_nexus | cr_glowfen_mireling | Acts every other turn; each act hits twice. | 2 |
| `anomaly_unfiled_archivist` | drowned_reach | cr_drowned_archivist | Rewinds a wounded ally instead of attacking. | 2 |
| `anomaly_one_herd` | ashen_steppe | cr_salt_jackal ×3 | Three jackals act on one initiative. | 2 |
| `anomaly_unlit_lantern` | veil | cr_hollow_lantern | Intent hidden until it takes damage. | 2 |
| `anomaly_seeding_toad` | glowfen | cr_lantern_toad | Adds one Spore Drift each turn (max 2). | 2 |
| `anomaly_still_kite` | skyreach | cr_gale_kite | Ignores the gale; strikes twice at dawn. | 2 |
| `anomaly_early_hound` | silverwood_before | cr_ley_hound | Roams on First Bell, out of its day. | 2 |

### 10.3 Traversal per region (Loop 1 numbers)

"Through-route" is the path a player walks to use the region; "sweep" is the shortest walk from the
gateway that visits every node of the region. Fights are expected values (§10.0). "To rest" is the
worst node's distance to any rest point.

| region | band | nodes | through-route | watches | fights first / return | sweep watches | sweep fights first / return | to rest | rest points |
|---|---|---|---|---|---|---|---|---|---|
| silverwood_ruins | 1–4 | 7 | WR→SA→HD (Apex road) · WR→CA→DC→SL | 2 · 3 | 0 / 0.4 · 2.4 / 0.6 | 8 | 3.4 / 1.4 (+1 at SA under `q_lost_scroll`) | 2 | WR camp; SL Loop 2+ (Ilyra Trusted) |
| mistwood_ironclad_reach | 2–6 | 6 | WR→MP→IC→BP→BO (→EF) | 4 (5) | 2.8 / 0.8 | 6 | 2.8 / 0.8 | 1 | WY inn, IC inn, EF camp |
| voidscar | 5–8 | 2 | SP→CW→VH | 2 | 2.0 / 0.5 | 1 | 2.0 / 0.5 | 1 | CW camp |
| aether_kissed_highlands | 6–10 | 3 | HD→SM→AS→SW | 3 | 3.0 / 1.3 | 2 | 3.0 / 1.3 | 1 | SM camp, SW camp |
| glowlands_nexus | 9–13 (Apex 15–18) | 3 | SW→VG→CN→TA | 3 | 3.0 incl. Tyrant / 1.0 | 2 | 3.0 / 1.0 | 1 | CN camp (none at the Apex) |
| drowned_reach | 4–8 | 8 | SA→DS→TW→LR · LR→SY→BW | 3 · +2 | 1.6 / 0.6 · +2.0 / +0.5 | 7 | 6.3 / 2.0 | 2 | LR camp |
| ashen_steppe | 7–11 | 9 | BO→SG→AF→HR · SG→WF→RD→VG | 3 · 3 | 1.0 / 0.4 · 1.8 / 0.8 | 10 | 4.9 / 1.9 | 2 | HR camp, WF camp |
| veil | 10–14 | 8 | VH→VM→SU→ST · SU→NO→WS | 3 · +2 | 1.1 / 0.4 · +1.0 / +0.4 | 8 | 4.4 / 1.4 | 4 | ST inn (Weavers ≥ −9) |
| glowfen | 8–12 | 8 | VG→LC→LN · LN→BR→FB→MH | 2 · +3 | 0.5 / 0.2 · +1.6 / +0.3 | 7 | 4.4 / 1.7 | 3 | LN inn |
| skyreach | 12–15 | 5 | SW→WW→AE · AS→CR→RS→PE | 3 · 4 | 1.6 / 0.5 · 3.0 / 0.7 | 5 | 4.6 / 1.1 | 2 | AE inn |
| silverwood_before | 13–17 | 10 | GT→OW→AG · OW→AD→CX · GT→CO→GL→PB→NH | 0 (moves: 2 · +2 · 4; the Before has no watches) | Day 1: 0 to the Garret; see §12 by day | 11 | day-scripted | 3 (Before days, no clock) | AG camp |
| threshold | — | 4 | TS→FL | 0 (no time) | none | — | none | — | none needed |

### 10.4 Elites, forced nodes, pacifist path and Horde entry per region

Elites are §6's `elite` role. Placement rules applied: no elites in band ≤ 4; at most one guaranteed
elite on any through-route; an elite on a settlement's approach must be `scatter`. "Scatter nodes"
are 100% fixed groups that a non-killer passes at +2 watches (R10-1). Horde moves are counted from
the Tyrant's death (legacy one-move delay; add 2 for the expiry Horde, R10-3).

| region | elites (node, chance) | forced nodes (§10.5) | scatter nodes | pacifist path to its settlement / exit | Horde entry → order (move infected) |
|---|---|---|---|---|---|
| silverwood_ruins | none | SA while `q_lost_scroll` is active | DC, SL, SP | WR→SA→HD open without the scroll quest; SL via MP→SP (Wisp scatters) | from the Highlands at HD 7 → SA 8 → WR 9 → CA 10 → DC, SL, SP 11 (the Plaza is held by the MP→SP 2-move delay) |
| mistwood_ironclad_reach | cr_stone_hide_golem ×2 (BO, 100%) | BP while `q_clear_path`; BO while `q_blighted_outpost` | BO when its quest is not active | WY, IC open from WR; EF via the Plateau: SW→BO (scatter)→EF | from the Plateau at BO 5 → BP 6 → IC, EF 7 (forge heat +1) → MP 8 → WY 9 |
| voidscar | none | none | VH (two groups; R10-1 rules the Stalkers `scatter`: `q_void_shards` asks for shards, not kills) | `q_void_shards` accepted opens the bridge; scatter both groups | from the Plaza: CW 11 → VH 12 |
| aether_kissed_highlands | none | none | SM, AS, SW | HD→SM→AS→SW, +6 watches | from the Glowlands at SW 4 → AS 5 → SM 6 |
| glowlands_nexus | cr_temporal_aberration (CN, 100%); cr_orrery_knight (CN return 20%) | TA in Loop 1 (Contained Tyrant) | VG, CN | SW→VG→CN, +4 watches; the Apex itself is the pacifist's limit in Loop 1 | source: TA 0 → CN 2 → VG 3 |
| drowned_reach | cr_ledger_choir (SY, 100%); cr_bell_ringer (BM, 100%) | BW without `echo_rhune_choice` | TW, SY, BS, BM | SA→DS→CI→LR (DS 60%, CI 70%; avoid TW) | through the Depths crack: CI 8 → DS, LR, BS 9 → TW, SY, BM 10 → BW 11 |
| ashen_steppe | cr_cinderback (AF 60%, BN 50%) | HG without `echo_dreyl_brand` | AF, GP | from the south (ungated): VG→RD→WF→SG→AF→HR (AF scatters) | from the Glowlands at RD 4 → WF 5 → SG 6 → AF, BN 7 → GP, HR 8 → SC, HG 9 |
| veil | cr_starved_shadow (VY 70%) | EY without Nyx + `echo_nyx_is_of_the_nine` | NO | VH→VM→SU→ST (no 100% group); WS via SU→NO (scatter) | last region hit: VM, SH 13 → SU, VY 14 → EY, NO, ST 15 → WS 16 |
| glowfen | none | MH without Mireya + lit `item_mireyas_lantern` | PG, FB (dusk/night) | VG→LC→LN (LC 50%) | from the Glowlands at LC 4 → LN, LS 5 → EM, BR 6 → FB, PG 7 → MH 8 |
| skyreach | cr_spire_loom (AE, 100%, at the region's only rest) | PE without `echo_sky_oath` + Talisman | CR, RS, AE | SW→WW→AE (AE scatters; then rest) | from the Plateau at WW 5 → AE, CR 6 → RS 7 → PE 8 |
| silverwood_before | cr_ninefold_knight (NH, Day 3) | CX (Day 3 boss; Days 1–2 pillars from the stair), NH Day 3, AD Day 2 | none | GT→OW→AG→PB on Day 1 (no encounters) | never infected (outside the Breach Clock) |
| threshold | none | none | none | all four places, always | never infected |

**Per-region notes.**
- *Silverwood Ruins* is the tutorial ring: three guaranteed single-fodder fights (Shade, Wisp, Wisp),
  no elites, one camp. The Apex road (WR→SA→HD) is fight-free on first visit, so a returning Loop 3+
  player can leave the Ruins in 2 watches.
- *Mistwood & the Reach* holds the only Loop 1 elite pair (the Golems), behind a quest. The Plateau →
  Outpost edge lets a player reach the Emberforge without Brak.
- *Voidscar* is two nodes and three fights. It is the Veil's only door.
- *Highlands* and *Glowlands & Nexus* are the Apex road: six guaranteed fights in 6 watches, two
  camps, and one elite (the Aberration) one step from the finale. This is the legacy pacing, kept.
- *Drowned Reach* is the densest region (6.3 expected first-visit fights). Its elites sit off the
  Lamplighters' route, and the boss can be reached from either the Bellmouth or the Scriptorium.
- *Ashen Steppe*: every road to Hearthring has an elite chance (Cinderback, telegraphed charge; Guard
  avoids it). Two camps, so no node is more than 2 watches from rest.
- *The Veil* is the only region with a 4-watch rest gap (Eye of the Scar). Its only inn is barred to
  the Wary. Unmaking (5% max HP per watch in NO/EY) makes the gap matter; it is intended.
- *The Glowfen* is a cul-de-sac off the Glowlands (one exit), hence R10-3.
- *Skyreach*: the Spire Loom guards the Eyrie, the region's only rest. A player who cannot win or
  scatter it rests at the Plateau camp, 2 watches down. Accepted, because the Eyrie also holds
  schematic A (ending B).

### 10.5 Forced-combat nodes (complete list)

| node | encounter | kind | forced when | non-combat bypass | justification |
|---|---|---|---|---|---|
| loc_temporal_breach_apex | cr_chronos_tyrant_contained | boss | Loop 1, always | none in Loop 1. Loop 2+ is never forced: the Tyrant speaks first (STORY §5.4; errata W5) | the legacy finale |
| loc_bell_wardens_deep | cr_bell_warden | boss | without `echo_rhune_choice` | say the Master's name (Echo from loc_tidewell_hall, no kill needed) | regional boss, dead end |
| loc_herd_grave | cr_ashmaw | boss | without `echo_dreyl_brand` | break the brand-stone (Echo from loc_bone_orchard) | regional boss, dead end |
| loc_eye_of_the_scar | cr_vells_umbra | boss | without Nyx active + `echo_nyx_is_of_the_nine` | Nyx calls it back | regional boss; WS stays reachable via NO |
| loc_matrons_hall | cr_lantern_matron | boss | without Mireya active + lit `item_mireyas_lantern` | Sulis is lulled | regional boss, cul-de-sac |
| loc_stormcrowns_perch | cr_stormcrown | boss | without `echo_sky_oath` + `item_sky_whisper_talisman` | the bargain | regional boss, dead end |
| loc_conflux_chamber | cr_unbroken_warden (Day 3); cr_warding_pillar ×2 (Days 1–2, entering from the Archives stair only, W8) | boss / story gate | no `item_ward_seal` | seal (Days 1–2); seal + Caelum active (Day 3); arrival through the Apex tear wakes no pillars | the Mending's anchor point |
| loc_ninefold_hall | cr_ninefold_knight | story gate | Day 3 | enter on Days 1–2 with the seal or Caelum | Last Bell's empty hall |
| loc_archives_of_danthe | cr_warding_pillar | story gate | Day 2 without the seal | visit on Day 1 or 3 | the Circle seals the Archives on Second Bell |
| loc_sunken_archives | cr_drowned_archivist | story gate | while `q_lost_scroll` is active | Loop 2+ `q_the_first_drowned`; or decline the quest | the legacy scroll guard |
| loc_barren_peaks | cr_wildling_brute | story gate | while `q_clear_path` is active | (Loop 2+ passwords without the quest: `scatter`) | legacy kill quest |
| loc_blighted_outpost | cr_stone_hide_golem ×2 | story gate | while `q_blighted_outpost` is active | (from the Plateau without the quest: `scatter`) | legacy kill quest |
| loc_darkened_corridor (Horde) | cr_horde_husk ×2; cr_unraveling_tide after move 14 | Horde | node infected | take the Plaza route (9 moves; the Corridor is never entered); the Tide is won by surviving 10 rounds (§6) | escape set piece |
| loc_ironclad_camp, loc_scorched_gate (Horde) | cr_horde_husk ×2 | Horde | infected (Camp: and Brak absent) | route around (the Plaza route crosses the Camp at move 6, before it is infected at 7) | escape set piece |

No other node is forced. In particular the legacy Apex-road fights (Phantom, Weaver, Sentinel,
Mireling, Aberration) are `scatter`: they were never story gates.

### 10.6 Pacifist reachability (settlements and the Apex approach)

Settlements: the seven present-day inhabited nodes, plus the Before's Plaza of Bells and Garret.
"Pacifist" = no kills (D-021 Pacifist's Vow); fleeing is allowed.

| target | Loop 1 pacifist | Loop 2+ pacifist |
|---|---|---|
| loc_wayfarers_respite | WR→MP→WY | same |
| loc_ironclad_camp | WR→MP→IC | same |
| loc_emberforge | Depths gate after 2 quests (`q_echo_crystal` + `q_blood_and_salt`) → HD→SM→AS→SW→BO→EF, 5 scatters | + `echo_ironclad_passwords`: IC→BP→BO→EF, 2 scatters |
| loc_lamplighters_rest | **blocked**: the lantern only appears with `q_lost_scroll`, whose Archivist is a story gate. Fixed by W7 (lantern on the top step from Day 1) → SA→DS→CI→LR | Kaelen sells the lantern → SA→DS→CI→LR |
| loc_hearthring | ungated from the south: VG→RD→WF→SG→AF→HR (AF scatters) | + `echo_nomad_signs`: BO→SG→AF→HR |
| loc_sanctum_of_threads | Weavers 25 without kills (keep the Crystal +10, Exploit +15) + `q_void_shards` accepted → CW→VH (scatter)→VM→SU→ST | `echo_hollow_path` + `echo_veil_watchword` |
| loc_lanternreed | VG (scatter)→LC→LN | same |
| loc_plaza_of_bells, loc_apprentices_garret | — (the Before is Loop 2+) | Nexus ⟂ GT→OW→AG→PB on First Bell |
| loc_chronos_nexus (Apex approach) | SW→VG→CN, 2 scatters; the Apex gate opens with 6 pacifist-completable quests (`q_echo_crystal`, `q_blood_and_salt`, `q_echoing_heartbeat`, `q_high_mark`, `q_the_drowned_lantern`, `q_lantern_in_the_reeds`) | + `echo_apex_resonance`; the Apex is never forced |

The pacifist's Loop 1 ends by expiry (D-005's second closer). Timing in §10.8.

### 10.7 The Horde through the map

- **Spread** (legacy `spread_horde`, unchanged): once per player move; the first move after the
  Horde starts is skipped (`delay`); pending edges resolve first, then every infected node infects all
  its neighbours. It runs over every present-day walkable edge, **ignoring gates** (legacy spread
  ignored locks); never across portal edges, so it never reaches Silverwood Before or the Threshold.
- **Edge delays:** loc_mistwood_path → loc_silverwood_plaza 2 (legacy); loc_blighted_outpost →
  loc_emberforge 1 (WORLD §3.2 "the heat holds them off one extra move").
- **Entering** an infected node costs ⌈maxHP/3⌉ and skips that move's spread (legacy). Three entries
  kill.
- **Result (Tyrant kill):** infection order is in the table in §10.4; all 61 present-day nodes are
  reached by move 16 (Where She Fell). The Library is infected at move 11, the same move as in the
  legacy 21-node map, so the new regions add no shortcut toward the portal. Best escape: TA→CN→VG→SW
  →BO→BP→IC→MP→SP→SL, **9 moves, 0 infected entries**, 2 moves to spare. The Depths route (11
  moves) also arrives clean and stays under the Tide's 14-move threshold.
- **Result (expiry, R10-3 delay 3):** every node has a damage-free route to the Library. The longest
  is Matron's Hall at 12 moves. With the legacy delay, FB, PG and MH would need 6–7 infected entries.

### 10.8 Loop 1 timing

Route T1 is a plausible thorough Loop 1: all six legacy quests, the Heartstone (made 6th), the Apex,
and three optional side trips into new regions. Simulated with the §10.0 rules (rests at camps or
inns; full rest = to next dawn). Clock = position after the leg.

| leg | path | moves | watches | rests | clock after |
|---|---|---|---|---|---|
| A Crystal (`q_echo_crystal`) | WR→CA→DC→SL→SP→MP→WR, rest | 6 | 8 | 1 | D3 Dawn |
| B Scroll (`q_lost_scroll`; lantern; heartbeat starts) | →SA→WR, rest | 2 | 4 | 1 | D4 Dawn |
| C `q_clear_path` | →MP→IC→BP→IC | 4 | 4 | 0 | D5 Dawn |
| D `q_blighted_outpost` + Emberforge | →BP→BO→EF, rest, forge | 3 | 5 | 1 | D6 Day |
| E Turn in to Brak; the Respite | →BO→BP→IC→MP→WY, rest | 5 | 7 | 1 | D8 Dawn |
| F Nyx (`q_void_shards`) | →MP→SP→CW, rest | 3 | 4 | 1 | D9 Dawn |
| G Hollow, shards given | →VH→CW, rest | 2 | 4 | 1 | D10 Dawn |
| H Back to the Ruins | →SP→MP→WR, rest | 3 | 4 | 1 | D11 Dawn |
| I Drowned Reach (side) | →SA→DS→TW→LR→SY→LR, rest | 6 | 8 | 1 | D13 Dawn |
| J Heartstone (6th quest; clock changes now) | →CI→DS→SA→HD, ritual | 4 | 5 | 0 | D14 Day |
| K Highlands | →SM, rest, →AS→SW, rest | 3 | 7 | 2 | D16 Dawn |
| L Ashen Steppe (side) | →BO→SG→AF→HR, rest, →AF→SG→WF, rest, →RD→VG | 9 | 14 | 2 | D19 Dusk |
| M Glowfen (side) | →LC→LN→BR→LN, rest | 4 | 6 | 1 | D21 Dawn |
| N Nexus | →LC→VG→CN, rest | 3 | 4 | 1 | D22 Dawn |
| O Apex | →TA | 1 | 1 | 0 | **D22 Day** |
| P Horde escape | TA→CN→VG→SW→BO→BP→IC→MP→SP→SL | 9 | 9 | 0 | D24 Dusk |
| **total** | | **67** | **94** | **14** | loop closes D24 Dusk |

Result: 67 travels and 14 rests, closing on Day 24. That matches D-005 (22–26 days) and DESIGN §10.1
(~60 travels + ~15 rests). Slack at the Apex (D22 Day, tick 85) by Heartstone choice:

| choice | limit | slack at the Apex | verdict |
|---|---|---|---|
| base, for reference (no Heartstone modifier) | D30 Dawn | 7.75 days | fine |
| Stabilize (+6) | D36 Dawn | 13.75 days | fine |
| Exploit (−5) | D25 Dawn | 2.75 days | fine, tight |
| Destroy (−10) | D20 Dawn | **−2.25 days** | **fails**: expiry fires at Lanternreed during leg M. Skipping L and M after a Destroy reaches the Apex D17 Day (2.75 days slack) |

Comparison runs: the **speedrunner** (legacy quests only, 4 rests) reaches the Apex D12 Night and
closes D15 Dawn, inside DESIGN §19's 12–16. The **pacifist** (six pacifist quests, Exploit, 9
scatters) reaches the Nexus D18 Dawn and ends by expiry on D25, inside the clock.

### 10.9 Loop 3+ focused routes (key locations per ending)

These assume the Echoes a Loop 3+ player holds (`echo_heartstone_path`, `echo_apex_resonance`,
`echo_hollow_path`, the faction-start Echoes) and nothing in hand. The Before costs no clock.

| ending | key locations, in order | moves | rests | at the Apex / goal | limit | slack |
|---|---|---|---|---|---|---|
| A Warden's Vigil | WR→SA→HD→SM→AS→SW→VG→CN→TA | 8 | 2 | D4 Day | D30 | 25.75 d |
| B Mending | VH (shard) → HD (Stabilize) → AS (Aetherium) → EF (forge) → CN ⟂ Before (Caelum anchors at CX) ⟂ CN → TA | 20 | 3 | D8 Day | D36; D39 once anchored (+3, DESIGN §10.1) | 27.75 d (30.75) |
| C Weaver's Dawn | SL (keep Crystal) → CW → VH/SH shards → ST (Nyx's rite) → HD (Exploit) → TA with the Core | 26 | 5 | D11 Day | D25 | 13.75 d |
| D Iron Silence | VH (shard) → IC/BP/BO (Brak, quests, the truth) → HD (Destroy, late) → AS → EF (forge) → TA with Brak | 28 | 4 | D11 Day | D20 | 8.75 d |
| E Long Archive | Remnant chain + SY → HD (Stabilize) → wait → HD **on Day 29** | 20 | 24 | D29 | D36 | the goal is a date, not a race |
| F Unbound | as A | 8 | 2 | D4 Day | D30 | 25.75 d |

### 10.10 Clock-math flags

1. **Loop 1 + Destroy fails for a thorough player** (§10.8). It is legitimate pressure, but nothing
   tells the Loop 1 player (the clock is subtle). Proposal: after a Destroy in Loop 1, Brak or Borin
   says the dawn count aloud ("Twenty dawns, Wayfinder. Not thirty.") as STORY §4.1 beat 9 already
   does for the choice itself. DESIGN §19 target 15 (explorer expiry 10–20%) should be measured with
   the bot's Heartstone choice logged.
2. **Ending E fails under `mod_frayed_clock`**: base 20, Stabilize halved to +3 gives D23, but
   `q_long_archive` needs the Depths on "Day 29". Fix: express the stage relative to the limit (the
   last dawn before collapse), e.g. a D-033 extension `{clock:{daysLeft:{max:1}}}`.
3. **The deep Glowfen at expiry** (FB, PG, MH) is a death trap with the legacy one-move delay. Fixed
   by R10-3.
4. **DESIGN's flat "Ashen Steppe crossing 4 watches"** is now graph distance (Outpost→Glowlands by the
   south road: 4 edges). `echo_steppe_waystones` ("2 watches") has no edge to act on. See Open
   question X3.
5. No other region fails. The tightest Loop 3+ case is D under Frayed Clock (limit D15, Apex D11).

---

## 11. Map data

### 11.0 Conventions

- Coordinates are grid units: x spacing 8, y spacing 2, origin at loc_shattered_library (legacy
  `MINIMAP_LAYOUT`). All 21 legacy positions and two-letter abbreviations are kept exactly (checked by
  script against `echoes_of_aethelgard.py` lines 146–168); the 22 legacy `MINIMAP_EDGES` are all in
  §11.2. The 52 new positions are §3's, unchanged: no two nodes share a cell, every walkable edge is
  symmetric with opposite direction labels, and every edge's direction matches the geometry. Three
  long vertical edges span 6 y-units: SP–MP and BO–SW (legacy) and PB–AG. No node lies on them.
- The data range is x −24..80, y −4..16. Renderers translate by (+24, +4) for a non-negative grid.
- `abbr` is the 2-letter minimap code (legacy codes kept; new ones are unique).
- `rest`: `camp` (free), `inn` (DESIGN §9.5 fee), `cond` (Library: Loop 2+ with Ilyra Trusted), `—`.
- `merchant`: the NPC id, `cond:` when conditional, `attunements` for the Loom (not a shop).
- `settlement`: an inhabited node with no hostile encounters. These are the pacifist targets in §10.6.
- `temporallyUnstable` is the static D-059 flag. Infected nodes are added at runtime (§12.3).
- Costs are Breach Clock watches. Before and Threshold edges cost 0: the Before has only its
  three-day clock, advanced by resting at the Garret, and the Threshold has no time.
- `gate_*` = `open`, a gate id from §11.3, or `none` (that direction does not exist).
- `kind`: `walk`, `portal` (both ways, own conditions), `portal_oneway`.

### 11.1 Nodes (73)

| id | abbr | name | region | x | y | band | temporallyUnstable | rest | merchant | settlement |
|---|---|---|---|---|---|---|---|---|---|---|
| loc_whispering_ruins | WR | Whispering Ruins | region_silverwood_ruins | 0 | 6 | 1–2 | false | camp | — | false |
| loc_crumbling_archway | CA | Crumbling Archway | region_silverwood_ruins | 0 | 4 | 1–2 | false | — | — | false |
| loc_darkened_corridor | DC | Darkened Corridor | region_silverwood_ruins | 0 | 2 | 2–3 | false | — | — | false |
| loc_shattered_library | SL | Shattered Library | region_silverwood_ruins | 0 | 0 | 2–3 | false | cond | — | false |
| loc_silverwood_plaza | SP | Silverwood Plaza | region_silverwood_ruins | 8 | 0 | 2–4 | false | — | npc_tamsin_reed | false |
| loc_sunken_archives | SA | Sunken Archives | region_silverwood_ruins | 0 | 8 | 2–4 | false | — | — | false |
| loc_heartstone_depths | HD | Heartstone Depths | region_silverwood_ruins | 0 | 10 | 3–4 | false | — | — | false |
| loc_mistwood_path | MP | Mistwood Path | region_mistwood_ironclad_reach | 8 | 6 | 2–3 | false | — | — | false |
| loc_wayfarers_respite | WY | The Wayfarer's Respite | region_mistwood_ironclad_reach | 8 | 8 | 2–3 | false | inn | npc_kaelen_stonehand | true |
| loc_ironclad_camp | IC | Ironclad Camp | region_mistwood_ironclad_reach | 16 | 6 | 3–4 | false | inn | cond:npc_tessaly_varr | true |
| loc_barren_peaks | BP | Barren Peaks | region_mistwood_ironclad_reach | 16 | 4 | 3–5 | false | — | — | false |
| loc_blighted_outpost | BO | Blighted Outpost | region_mistwood_ironclad_reach | 24 | 4 | 4–6 | false | — | — | false |
| loc_emberforge | EF | The Emberforge | region_mistwood_ironclad_reach | 24 | 2 | 4–6 | false | camp | npc_borin_stonefist | true |
| loc_chasm_of_whispers | CW | Chasm of Whispers | region_voidscar | 16 | 0 | 4–5 | false | camp | — | false |
| loc_voidscar_hollow | VH | Voidscar Hollow | region_voidscar | 24 | 0 | 5–7 | false | — | — | false |
| loc_shimmering_pass | SM | Shimmering Pass | region_aether_kissed_highlands | 8 | 10 | 6–7 | true | camp | — | false |
| loc_aetherium_spires | AS | Aetherium Spires | region_aether_kissed_highlands | 16 | 10 | 7–8 | true | — | — | false |
| loc_sky_whisper_plateau | SW | Sky-Whisper Plateau | region_aether_kissed_highlands | 24 | 10 | 8–10 | true | camp | — | false |
| loc_veridian_glowlands | VG | Veridian Glowlands | region_glowlands_nexus | 32 | 10 | 9–10 | false | — | — | false |
| loc_chronos_nexus | CN | The Chronos Nexus | region_glowlands_nexus | 40 | 10 | 11–13 | true | camp | — | false |
| loc_temporal_breach_apex | TA | The Temporal Breach Apex | region_glowlands_nexus | 40 | 8 | 15–18 | true | — | — | false |
| loc_drowned_stair | DS | The Drowned Stair | region_drowned_reach | -8 | 8 | 4 | false | — | — | false |
| loc_tidewell_hall | TW | Tidewell Hall | region_drowned_reach | -16 | 8 | 4–5 | false | — | — | false |
| loc_cistern_of_names | CI | The Cistern of Names | region_drowned_reach | -8 | 10 | 5 | false | — | — | false |
| loc_lamplighters_rest | LR | Lamplighters' Rest | region_drowned_reach | -16 | 10 | 5 | false | camp | npc_sedge_marrow | true |
| loc_sunken_scriptorium | SY | The Sunken Scriptorium | region_drowned_reach | -24 | 10 | 6–7 | false | — | — | false |
| loc_black_sluice | BS | The Black Sluice | region_drowned_reach | -8 | 12 | 6 | false | — | — | false |
| loc_bellmouth | BM | The Bellmouth | region_drowned_reach | -16 | 12 | 7 | false | — | — | false |
| loc_bell_wardens_deep | BW | The Bell-Warden's Deep | region_drowned_reach | -24 | 12 | 8 | false | — | — | false |
| loc_scorched_gate | SG | The Scorched Gate | region_ashen_steppe | 32 | 4 | 7 | false | — | — | false |
| loc_ash_wind_flats | AF | Ash-Wind Flats | region_ashen_steppe | 40 | 4 | 7–8 | false | — | — | false |
| loc_hearthring | HR | Hearthring | region_ashen_steppe | 48 | 4 | 8 | false | camp | npc_tessaly_varr | true |
| loc_bone_orchard | BN | The Bone Orchard | region_ashen_steppe | 32 | 2 | 8–9 | false | — | — | false |
| loc_grey_salt_pan | GP | Grey Salt Pan | region_ashen_steppe | 40 | 2 | 9 | false | — | — | false |
| loc_stormgate_cairns | SC | Stormgate Cairns | region_ashen_steppe | 48 | 2 | 9–10 | false | — | — | false |
| loc_watchfire_ridge | WF | Watchfire Ridge | region_ashen_steppe | 32 | 6 | 7–8 | false | camp | — | false |
| loc_reedmarch_descent | RD | Reedmarch Descent | region_ashen_steppe | 32 | 8 | 8 | false | — | — | false |
| loc_herd_grave | HG | The Herd-Grave | region_ashen_steppe | 48 | 6 | 11 | false | — | — | false |
| loc_veil_mouth | VM | The Veil Mouth | region_veil | 32 | 0 | 10 | false | — | — | false |
| loc_stair_of_unmaking | SU | Stair of Unmaking | region_veil | 40 | 0 | 10–11 | false | — | — | false |
| loc_sanctum_of_threads | ST | Sanctum of Threads | region_veil | 48 | 0 | 11 | false | inn | npc_hollis_cade | true |
| loc_scar_shelf | SH | The Scar Shelf | region_veil | 24 | -2 | 10 | false | — | — | false |
| loc_voidglass_gallery | VY | Voidglass Gallery | region_veil | 32 | -2 | 11–12 | false | — | — | false |
| loc_null_orchard | NO | The Null Orchard | region_veil | 40 | -2 | 12 | false | — | — | false |
| loc_eye_of_the_scar | EY | Eye of the Scar | region_veil | 32 | -4 | 13 | false | — | — | false |
| loc_where_she_fell | WS | Where She Fell | region_veil | 40 | -4 | 12–13 | false | — | — | false |
| loc_lantern_causeway | LC | The Lantern Causeway | region_glowfen | 32 | 12 | 8 | false | — | — | false |
| loc_lanternreed | LN | Lanternreed | region_glowfen | 32 | 14 | 8–9 | false | inn | npc_old_fennick | true |
| loc_sporelight_shallows | LS | Sporelight Shallows | region_glowfen | 40 | 12 | 9 | false | — | — | false |
| loc_elder_mangrove | EM | The Elder Mangrove | region_glowfen | 40 | 14 | 10 | false | — | — | false |
| loc_breathing_pool | BR | The Breathing Pool | region_glowfen | 32 | 16 | 9–10 | false | — | — | false |
| loc_firefly_barrows | FB | Firefly Barrows | region_glowfen | 40 | 16 | 11 | false | — | — | false |
| loc_pale_gullet | PG | The Pale Gullet | region_glowfen | 48 | 14 | 11–12 | false | — | — | false |
| loc_matrons_hall | MH | Hall of the Lantern Matron | region_glowfen | 48 | 16 | 12 | false | — | — | false |
| loc_windward_stair | WW | The Windward Stair | region_skyreach | 24 | 12 | 12 | true | — | — | false |
| loc_spire_crown | CR | The Spire-Crown | region_skyreach | 16 | 12 | 13 | true | — | — | false |
| loc_roost_of_sentinels | RS | Roost of the Sentinels | region_skyreach | 16 | 14 | 13–14 | true | — | — | false |
| loc_aldours_eyrie | AE | Aulde's Eyrie | region_skyreach | 24 | 14 | 14 | true | inn | — | false |
| loc_stormcrowns_perch | PE | The Stormcrown's Perch | region_skyreach | 8 | 14 | 15 | true | — | — | false |
| loc_silver_gate | GT | The Silver Gate | region_silverwood_before | 64 | 4 | 13 | true | — | — | false |
| loc_outer_walks | OW | The Outer Walks | region_silverwood_before | 64 | 6 | 13 | true | — | — | false |
| loc_scholars_corridor | CO | The Scholars' Corridor | region_silverwood_before | 64 | 2 | 13–14 | true | — | — | false |
| loc_grand_library | GL | The Grand Library of Silverwood | region_silverwood_before | 64 | 0 | 14 | true | — | — | false |
| loc_plaza_of_bells | PB | The Plaza of Bells | region_silverwood_before | 72 | 0 | 13–14 | true | — | npc_bellwright_anso | true |
| loc_ninefold_hall | NH | The Ninefold Hall | region_silverwood_before | 80 | 0 | 15 | true | — | — | false |
| loc_apprentices_garret | AG | The Apprentices' Garret | region_silverwood_before | 72 | 6 | 13 | true | camp | — | true |
| loc_cistern_gardens | CG | The Cistern Gardens | region_silverwood_before | 72 | 8 | 14 | true | — | — | false |
| loc_archives_of_danthe | AD | The Archives of Danthe | region_silverwood_before | 64 | 8 | 14–15 | true | — | — | false |
| loc_conflux_chamber | CX | The Conflux Chamber | region_silverwood_before | 64 | 10 | 16–17 | true | — | — | false |
| loc_still_shore | TS | The Still Shore | region_threshold | 72 | 14 | — | true | — | — | false |
| loc_gallery_of_loops | LG | The Gallery of Loops | region_threshold | 64 | 14 | — | true | — | — | false |
| loc_loom | LM | The Loom | region_threshold | 80 | 14 | — | true | — | attunements | false |
| loc_far_light | FL | The Far Light | region_threshold | 72 | 16 | — | true | — | — | false |
### 11.2 Edges (92 = 88 walk + 2 portal + 2 one-way portal)

Undirected; `a` precedes `b` in §11.1 order. The Apex's "beyond ⟂ ending F" is an ending exit, not an
edge (`g_unbound_exit`, §11.3).

| a | b | dir_ab | dir_ba | cost_ab | cost_ba | gate_ab | gate_ba | kind |
|---|---|---|---|---|---|---|---|---|
| loc_whispering_ruins | loc_crumbling_archway | north | south | 1 | 1 | open | open | walk |
| loc_whispering_ruins | loc_sunken_archives | south | north | 1 | 1 | open | open | walk |
| loc_whispering_ruins | loc_mistwood_path | east | west | 1 | 1 | open | open | walk |
| loc_crumbling_archway | loc_darkened_corridor | north | south | 1 | 1 | open | open | walk |
| loc_darkened_corridor | loc_shattered_library | north | south | 1 | 1 | open | open | walk |
| loc_shattered_library | loc_silverwood_plaza | east | west | 1 | 1 | open | open | walk |
| loc_silverwood_plaza | loc_mistwood_path | south | north | 1 | 1 | open | open | walk |
| loc_silverwood_plaza | loc_chasm_of_whispers | east | west | 1 | 1 | open | open | walk |
| loc_sunken_archives | loc_heartstone_depths | south | north | 1 | 1 | g_depths_descent | open | walk |
| loc_sunken_archives | loc_drowned_stair | west | east | 1 | 1 | open | open | walk |
| loc_heartstone_depths | loc_shimmering_pass | east | west | 1 | 1 | open | open | walk |
| loc_heartstone_depths | loc_cistern_of_names | west | east | 1 | 1 | g_cistern_crack_in | g_cistern_crack | walk |
| loc_mistwood_path | loc_wayfarers_respite | south | north | 1 | 1 | open | open | walk |
| loc_mistwood_path | loc_ironclad_camp | east | west | 1 | 1 | open | open | walk |
| loc_ironclad_camp | loc_barren_peaks | north | south | 1 | 1 | g_peaks_pass | open | walk |
| loc_barren_peaks | loc_blighted_outpost | east | west | 1 | 1 | open | open | walk |
| loc_blighted_outpost | loc_emberforge | north | south | 1 | 1 | open | open | walk |
| loc_blighted_outpost | loc_sky_whisper_plateau | south | north | 1 | 1 | open | open | walk |
| loc_blighted_outpost | loc_scorched_gate | east | west | 1 | 1 | g_scorched_gate | open | walk |
| loc_chasm_of_whispers | loc_voidscar_hollow | east | west | 1 | 1 | g_chasm_bridge | open | walk |
| loc_voidscar_hollow | loc_veil_mouth | east | west | 1 | 1 | g_veil_curtain | open | walk |
| loc_voidscar_hollow | loc_scar_shelf | north | south | 1 | 1 | g_veil_curtain | open | walk |
| loc_shimmering_pass | loc_aetherium_spires | east | west | 1 | 1 | open | open | walk |
| loc_aetherium_spires | loc_sky_whisper_plateau | east | west | 1 | 1 | open | open | walk |
| loc_aetherium_spires | loc_spire_crown | south | north | 2 | 1 | g_thin_air | open | walk |
| loc_sky_whisper_plateau | loc_veridian_glowlands | east | west | 1 | 1 | open | open | walk |
| loc_sky_whisper_plateau | loc_windward_stair | south | north | 2 | 1 | g_thin_air | open | walk |
| loc_veridian_glowlands | loc_chronos_nexus | east | west | 1 | 1 | open | open | walk |
| loc_veridian_glowlands | loc_reedmarch_descent | north | south | 1 | 1 | open | open | walk |
| loc_veridian_glowlands | loc_lantern_causeway | south | north | 1 | 1 | open | open | walk |
| loc_chronos_nexus | loc_temporal_breach_apex | north | south | 1 | 1 | g_apex | open | walk |
| loc_drowned_stair | loc_tidewell_hall | west | east | 1 | 1 | g_drowned_dark | open | walk |
| loc_drowned_stair | loc_cistern_of_names | south | north | 1 | 1 | g_drowned_dark | open | walk |
| loc_tidewell_hall | loc_lamplighters_rest | south | north | 1 | 1 | open | open | walk |
| loc_cistern_of_names | loc_lamplighters_rest | west | east | 1 | 1 | open | open | walk |
| loc_cistern_of_names | loc_black_sluice | south | north | 1 | 1 | open | open | walk |
| loc_lamplighters_rest | loc_sunken_scriptorium | west | east | 1 | 1 | open | open | walk |
| loc_lamplighters_rest | loc_bellmouth | south | north | 1 | 1 | open | open | walk |
| loc_sunken_scriptorium | loc_bell_wardens_deep | south | north | 1 | 1 | open | open | walk |
| loc_black_sluice | loc_bellmouth | west | east | 1 | 1 | g_sluice_walkway | g_sluice_walkway | walk |
| loc_bellmouth | loc_bell_wardens_deep | west | east | 1 | 1 | open | open | walk |
| loc_scorched_gate | loc_ash_wind_flats | east | west | 1 | 1 | open | open | walk |
| loc_scorched_gate | loc_bone_orchard | north | south | 1 | 1 | open | open | walk |
| loc_scorched_gate | loc_watchfire_ridge | south | north | 1 | 1 | open | open | walk |
| loc_ash_wind_flats | loc_hearthring | east | west | 1 | 1 | open | open | walk |
| loc_ash_wind_flats | loc_grey_salt_pan | north | south | 1 | 1 | open | open | walk |
| loc_hearthring | loc_stormgate_cairns | north | south | 1 | 1 | open | open | walk |
| loc_hearthring | loc_herd_grave | south | north | 1 | 1 | g_herd_grave | open | walk |
| loc_bone_orchard | loc_grey_salt_pan | east | west | 1 | 1 | open | open | walk |
| loc_grey_salt_pan | loc_stormgate_cairns | east | west | 1 | 1 | open | open | walk |
| loc_watchfire_ridge | loc_reedmarch_descent | south | north | 1 | 1 | open | open | walk |
| loc_veil_mouth | loc_stair_of_unmaking | east | west | 1 | 1 | open | open | walk |
| loc_veil_mouth | loc_voidglass_gallery | north | south | 1 | 1 | open | open | walk |
| loc_stair_of_unmaking | loc_sanctum_of_threads | east | west | 1 | 1 | g_sanctum_door | open | walk |
| loc_stair_of_unmaking | loc_null_orchard | north | south | 1 | 1 | open | open | walk |
| loc_scar_shelf | loc_voidglass_gallery | east | west | 1 | 1 | open | open | walk |
| loc_voidglass_gallery | loc_null_orchard | east | west | 1 | 1 | open | open | walk |
| loc_voidglass_gallery | loc_eye_of_the_scar | north | south | 1 | 1 | open | open | walk |
| loc_null_orchard | loc_where_she_fell | north | south | 1 | 1 | open | open | walk |
| loc_eye_of_the_scar | loc_where_she_fell | east | west | 1 | 1 | open | open | walk |
| loc_lantern_causeway | loc_lanternreed | south | north | 1 | 1 | open | open | walk |
| loc_lantern_causeway | loc_sporelight_shallows | east | west | 1 | 1 | open | open | walk |
| loc_lanternreed | loc_elder_mangrove | east | west | 1 | 1 | open | open | walk |
| loc_lanternreed | loc_breathing_pool | south | north | 1 | 1 | open | open | walk |
| loc_sporelight_shallows | loc_elder_mangrove | south | north | 1 | 1 | open | open | walk |
| loc_elder_mangrove | loc_firefly_barrows | south | north | 1 | 1 | open | open | walk |
| loc_elder_mangrove | loc_pale_gullet | east | west | 1 | 2 | open | open | walk |
| loc_breathing_pool | loc_firefly_barrows | east | west | 1 | 1 | open | open | walk |
| loc_firefly_barrows | loc_matrons_hall | east | west | 1 | 1 | open | open | walk |
| loc_pale_gullet | loc_matrons_hall | south | north | 1 | 1 | open | open | walk |
| loc_windward_stair | loc_spire_crown | west | east | 1 | 1 | open | open | walk |
| loc_windward_stair | loc_aldours_eyrie | south | north | 1 | 1 | open | open | walk |
| loc_spire_crown | loc_roost_of_sentinels | south | north | 1 | 1 | open | open | walk |
| loc_roost_of_sentinels | loc_aldours_eyrie | east | west | 1 | 1 | open | open | walk |
| loc_roost_of_sentinels | loc_stormcrowns_perch | west | east | 1 | 1 | open | open | walk |
| loc_silver_gate | loc_outer_walks | south | north | 0 | 0 | open | open | walk |
| loc_silver_gate | loc_scholars_corridor | north | south | 0 | 0 | open | open | walk |
| loc_outer_walks | loc_apprentices_garret | east | west | 0 | 0 | open | open | walk |
| loc_outer_walks | loc_archives_of_danthe | south | north | 0 | 0 | open | open | walk |
| loc_scholars_corridor | loc_grand_library | north | south | 0 | 0 | open | open | walk |
| loc_grand_library | loc_plaza_of_bells | east | west | 0 | 0 | open | open | walk |
| loc_plaza_of_bells | loc_ninefold_hall | east | west | 0 | 0 | g_hall_doors | open | walk |
| loc_plaza_of_bells | loc_apprentices_garret | south | north | 0 | 0 | open | open | walk |
| loc_apprentices_garret | loc_cistern_gardens | south | north | 0 | 0 | open | open | walk |
| loc_archives_of_danthe | loc_conflux_chamber | south | north | 0 | 0 | g_conflux_stair | open | walk |
| loc_still_shore | loc_gallery_of_loops | west | east | 0 | 0 | open | open | walk |
| loc_still_shore | loc_loom | east | west | 0 | 0 | open | open | walk |
| loc_still_shore | loc_far_light | south | north | 0 | 0 | open | open | walk |
| loc_whispering_ruins | loc_far_light | none | step into the light | none | 0 | none | g_far_light | portal_oneway |
| loc_shattered_library | loc_still_shore | portal | none | 0 | none | g_library_portal | none | portal_oneway |
| loc_chronos_nexus | loc_silver_gate | east | west | 0 | 0 | g_breach_door | g_breach_door_back | portal |
| loc_temporal_breach_apex | loc_conflux_chamber | through the tear | through the tear | 0 | 0 | g_tyrant_tear | g_tyrant_tear_back | portal |
### 11.3 Gate conditions

D-033 JSON, canonical ids. A dagger (†) marks a change from §3; each is listed in the errata appendix.

| gate | edges (from → to) | condition | notes |
|---|---|---|---|
| `g_depths_descent` | sunken_archives → heartstone_depths | `{any:[{quest:"q_echoing_heartbeat",stage:"accepted"},{echo:"echo_heartstone_path"}]}` | heartbeat after 2 completed quests (STORY §4.1); return is open |
| `g_cistern_crack_in` † | heartstone_depths → cistern_of_names | `{all:[{item:"item_glyphbound_lantern"},{any:[{item:"item_cistern_key"},{flag:"flag_heartstone_destroyed"},{echo:"echo_cistern_crack"}]}]}` | lantern added so the crack cannot bypass the dark (W6) |
| `g_cistern_crack` | cistern_of_names → heartstone_depths | `{any:[{item:"item_cistern_key"},{flag:"flag_heartstone_destroyed"},{echo:"echo_cistern_crack"}]}` | — |
| `g_peaks_pass` | ironclad_camp → barren_peaks | `{any:[{quest:"q_clear_path",stage:"accepted"},{echo:"echo_ironclad_passwords"}]}` | legacy line on lock: "I should talk to Brak before going this way." |
| `g_scorched_gate` | blighted_outpost → scorched_gate | `{any:[{quest:"q_blighted_outpost",stage:"completed"},{echo:"echo_nomad_signs"}]}` | eastbound only; the Steppe is open from the south |
| `g_chasm_bridge` | chasm_of_whispers → voidscar_hollow | `{any:[{quest:"q_void_shards",stage:"accepted"},{echo:"echo_hollow_path"}]}` | — |
| `g_veil_curtain` † | voidscar_hollow → veil_mouth, voidscar_hollow → scar_shelf | `{any:[{rep:{faction:"weavers",min:20}},{echo:"echo_veil_watchword"},{quest:"q_lightless_stair",stage:"accepted"}]}` | faction id per 04-06 E10; `q_lightless_stair` added (W12) |
| `g_sanctum_door` | stair_of_unmaking → sanctum_of_threads | `{rep:{faction:"weavers",min:-9}}` | — |
| `g_drowned_dark` | drowned_stair → tidewell_hall, drowned_stair → cistern_of_names | `{item:"item_glyphbound_lantern"}` | no Echo alternative (WORLD §3.6) |
| `g_sluice_walkway` † | black_sluice ↔ bellmouth (both ways) | `{any:[{item:"item_cistern_key"},{not:{watch:"night"}}]}` | `{watch}` is a proposed D-033 atom (W1); reverse direction added |
| `g_herd_grave` † | hearthring → herd_grave | `{any:[{quest:"q_bone_road",stage:"accepted"},{echo:"echo_nomad_signs"}]}` | `q_herd_of_one` is not a STORY quest (W2) |
| `g_thin_air` | aetherium_spires → spire_crown, sky_whisper_plateau → windward_stair | `{any:[{item:"item_sky_whisper_talisman"},{echo:"echo_breath_of_heights"}]}` | ascent costs 2 watches; descent is open and costs 1 |
| `g_apex` | chronos_nexus → temporal_breach_apex | `{any:[{counter:{name:"quests_completed",min:6}},{echo:"echo_apex_resonance"}]}` | D-048, one form for all loops (the Echo cannot exist in Loop 1) |
| `g_breach_door` | chronos_nexus ⟂ silver_gate | `{all:[{loop:{min:2}},{item:"item_chronos_lens"},{echo:"echo_litany_verse_1"}]}` | D-016; sets `flag_entered_before_via_nexus` |
| `g_breach_door_back` | silver_gate ⟂ chronos_nexus | `{flag:"flag_entered_before_via_nexus"}` | also forced at Last Bell's dusk |
| `g_tyrant_tear` | temporal_breach_apex ⟂ conflux_chamber | `{all:[{loop:{min:2}},{flag:"flag_tyrant_spared"}]}` | sets `flag_entered_before_via_apex` |
| `g_tyrant_tear_back` | conflux_chamber ⟂ temporal_breach_apex | `{flag:"flag_entered_before_via_apex"}` | — |
| `g_hall_doors` | plaza_of_bells → ninefold_hall | `{any:[{flag:"flag_before_day_3"},{item:"item_ward_seal"},{companion:"caelum",state:"active"}]}` | — |
| `g_conflux_stair` | archives_of_danthe → conflux_chamber | `{any:[{flag:"flag_before_day_3"},{item:"item_ward_seal"}]}` | — |
| `g_library_portal` | shattered_library ⟂ still_shore (one-way) | `{any:[{flag:"flag_library_portal_open"},{all:[{loop:{min:2}},{rep:{faction:"remnants",min:20}},{echo:"echo_portal_tear"}]}]}` | ends the loop (`closer_escape`); Loop 1 → Loop 2 skips the Threshold (D-049) |
| `g_far_light` | far_light ⟂ whispering_ruins (one-way) | always | begins the next loop, Day 1 Dawn |
| `g_unbound_exit` | temporal_breach_apex → ending F | `{all:[{loop:{min:2}},{flag:"flag_tyrant_spared"},{flag:"flag_refused_all_paths"}]}` | not a map edge; drawn as the tear's glow |

**Reachability check (script).** From loc_whispering_ruins, with no gate satisfied, 11 nodes are
reachable (WR, CA, DC, SL, SP, SA, MP, WY, IC, CW, DS). With every gate satisfiable, all 73 are. Each
gated region's minimal path is in §3.13; two of its counts are wrong (W10).

### 11.4 Region extents, label anchors, insets

A region is drawn as the union of its rects in node coordinates, padded ±4 in x and ±1 in y. The
rects contain only the region's own nodes. With that padding no two regions overlap, though they may
touch. Plain bounding boxes do overlap: the Apex (40,8) falls inside the Steppe's box, and
Mistwood Path inside the Ruins' box. Use the rects. Label anchors sit on odd rows at x ≡ 4 (mod 8),
where no node or edge can lie.

| region | node bbox x0,y0,x1,y1 | rects (x0,y0,x1,y1; union) | label anchor x,y |
|---|---|---|---|
| region_silverwood_ruins | 0,0,8,10 | 0,0,8,0 ; 0,2,0,10 | 4,-1 |
| region_mistwood_ironclad_reach | 8,2,24,8 | 24,2,24,2 ; 16,4,24,4 ; 8,6,16,6 ; 8,8,8,8 | 20,1 |
| region_voidscar | 16,0,24,0 | 16,0,24,0 | 20,-1 |
| region_aether_kissed_highlands | 8,10,24,10 | 8,10,24,10 | 20,9 |
| region_glowlands_nexus | 32,8,40,10 | 40,8,40,8 ; 32,10,40,10 | 36,7 |
| region_drowned_reach | -24,8,-8,12 | -16,8,-8,8 ; -24,10,-8,12 | -12,7 |
| region_ashen_steppe | 32,2,48,8 | 32,2,48,4 ; 32,6,32,8 ; 48,6,48,6 | 36,1 |
| region_veil | 24,-4,48,0 | 32,-4,40,-4 ; 24,-2,40,-2 ; 32,0,48,0 | 36,-5 |
| region_glowfen | 32,12,48,16 | 32,12,40,12 ; 32,14,48,16 | 36,11 |
| region_skyreach | 8,12,24,14 | 16,12,24,12 ; 8,14,24,14 | 20,11 |
| region_silverwood_before | 64,0,80,10 | 64,0,80,0 ; 64,2,64,4 ; 64,6,72,8 ; 64,10,64,10 | 68,-1 |
| region_threshold | 64,14,80,16 | 64,14,80,14 ; 72,16,72,16 | 76,13 |
- **The Threshold is an inset**, not part of the main map: a separate framed panel (bottom-right of
  the map view on desktop; its own tab on mobile) in local coordinates = world − (64, 14): Gallery
  (0,0), Still Shore (8,0), Loom (16,0), Far Light (8,2). Its two one-way portals are drawn as stubs
  at the inset frame: an arrow in from the Library icon, an arrow out to the Whispering Ruins icon.
- **Silverwood Before** stays on the main map east of the Apex (x 64–80), with a gap column at x = 56.
  Its two portal edges (Nexus ⟂ Silver Gate, Apex ⟂ Conflux) are dotted arcs routed through the gap.
  On narrow screens it may become a second inset with the same rule as the Threshold.

### 11.5 STORY place names → locations

| STORY name | location | note |
|---|---|---|
| the Ring of Wagons | loc_hearthring | 04-06 E8 |
| the Hollow Choir | loc_sanctum_of_threads | 04-06 E8 |
| Vane's Watch | loc_blighted_outpost | codex name |
| Hallow's Cairn | loc_stormgate_cairns | proposed: a named cairn there (`ev_hallows_cairn`) for `q_bone_road` stage 3 |
| the Reed Maze | loc_sporelight_shallows | `q_the_drowned_lantern`, `q_lantern_in_the_reeds` |
| the Door of Pages | loc_sunken_scriptorium | the Scriptorium's door; `q_the_danthe_line` |
| the Wind Stair / the High Mark | loc_windward_stair | `q_high_mark` |
| the Lightless Stair | loc_stair_of_unmaking | begins at the Hollow's curtain, not "the bottom of the Chasm" (W12) |
| the Conflux | loc_heartstone_depths (present) / loc_conflux_chamber (Before) | D-023 |

### 11.6 Rendering notes (node and edge states)

Legacy minimap conventions are kept and mapped to the illustrated map (DESIGN §16.6). Colour is never
the only signal: each state has a glyph.

| state | rule | legacy form | illustrated map |
|---|---|---|---|
| fog | not visited this loop, not remembered, not adjacent | blank | not drawn, nor its edges |
| adjacent | neighbour of a node visited this loop | `[??]` dim | "?" ghost sigil in the region tint at 40%; the edge is dotted (legacy `.`/`:`) |
| visited | visited this loop | `[AB]` | full colour sigil with name; a check when its fixed encounter is cleared or scattered; a danger pip with the band for an uncleared fixed group; a crown pip for a boss |
| current | the player is here | `<AB>` blue (red if infected) | pulsing ring (static with reduced motion) |
| remembered | in `profile.mapMemory`, not visited this loop (D-011) | — | desaturated grey sigil with name, known rest/merchant glyphs and known gates; edges known from memory drawn grey. Remembered beats adjacent: no "?" for a known place |
| npc | an NPC is present | `[AB]` yellow | small speech glyph |
| quest-ready | an NPC here can complete a quest | `[AB]` green | green ring + "!" glyph |
| infected | Horde has reached it (§10.7) | `[AB]` red, drawn even if unvisited | violet-black hatch over the sigil and its edges; red label; travel tooltip "⚠ −33% HP" (DESIGN §16.6) |
| escape | the Library while the Horde runs | `[SL]` green overrides red | green door glyph, always drawn, even under fog |
| forecast | Fall forecast hatch from Day 25 (Loop 2+) or Day 28 (Loop 1), one node per day from the Apex | — | hatch outline only, no fill; nothing changes mechanically |
| unstable | `temporallyUnstable` and Dask in the party | — | hourglass glyph |

Priority when several apply: current > escape > infected > quest-ready > npc > visited > remembered >
adjacent.

| edge state | rule | illustrated map |
|---|---|---|
| known | both ends visible | solid curved stroke |
| toward the unknown | one end adjacent | dotted |
| locked | the gate is unmet and the destination is visible | dashed stroke with a lock glyph at the source end (legacy: red `x` in the first cell beside the source); tooltip gives the reason text |
| costed | cost 2 | "2" pip on the stroke (Pale Gullet haul, Skyreach ascents) |
| portal | `portal` kind | dotted arc with a ⟂ glyph; drawn only once the portal is known (Echo or visit) |
| one-way | `portal_oneway` | dotted arrow (Threshold inset stubs) |
| infected | either end infected | hatch creeps along the stroke from the infected end; a pending delay (MP→SP 2, BO→EF 1) shows as a half-hatched stroke |

---

## 12. World-state variants

### 12.1 State table

Conditions are D-033 (`{watch}` and the `flag_*` names marked † are proposed; see Appendix X).
"Ends" says when the state stops: `loop` = at the loop's end (D-011 reset), `permanent` = profile.

| state | scope | trigger | text | encounters | exits / other | ends |
|---|---|---|---|---|---|---|
| `ws_horde` | global | `{any:[{killed:"cr_chronos_tyrant_contained"},{killed:"cr_chronos_tyrant_unveiled"},{flag:"flag_clock_expired"}]}` → sets `flag_horde_active`, `flag_library_portal_open` | kill: legacy Brak lines (if he is present); expiry: STORY §4.3 | the spread starts (§12.2): delay 1 after a kill, 3 after expiry (R10-3) | Brak leaves loc_ironclad_camp (legacy); Ilyra goes to the Library; merchants close; no resting | loop |
| `ws_infected` | each node, as reached | in the infected set | loc_temporal_breach_apex: legacy Horde text; elsewhere `+` "The air here is coming apart at the seams." | DC: cr_horde_husk ×2, then cr_unraveling_tide after move 14; IC: husk ×2 if Brak is absent; SG: husk ×2; WY "goes quiet" with no fights; SL: none (Ilyra holds the stacks). Other nodes: no new fights, the entry damage is the threat | entry costs ⌈maxHP/3⌉ and skips that move's spread; `temporallyUnstable` true; drawn hatched | loop |
| `ws_portal_ilyra` | loc_shattered_library | `{all:[{flag:"flag_library_portal_open"},{not:{companion:"ilyra",state:"active"}}]}` | legacy "…Ilyra stands before it…" | none | `g_library_portal` open; Ilyra's speech (STORY §4.1 beat 15) | loop |
| `ws_portal_alone` | loc_shattered_library | `{all:[{flag:"flag_library_portal_open"},{companion:"ilyra",state:"active"}]}` | legacy "A swirling, unstable portal now pulses…"; becomes `ws_portal_ilyra` when she arrives with you | none | portal open | loop |
| `ws_portal_scar` | loc_shattered_library | `{all:[{loop:{min:2}},{not:{flag:"flag_horde_active"}}]}` | §3.1 scar line; `ev_library_seam` | — | Ilyra's deliberate tear (`g_library_portal`, Remnants ≥ 20 + `echo_portal_tear`) | loop |
| `ws_heartstone_stabilized` | HD, BW, AS, BR, EF | `{flag:"flag_heartstone_stabilized"}` | HD "The beat is slow and even now…"; Borin "slow and sure" | BW: the Bell-Warden skips phase 1 | Clock +6; a second Aetherium Shard at AS; cleansing at BR is free; the Drowned water calms; Ley-tuned recipes | loop |
| `ws_heartstone_exploited` | HD, VH, WS, EF | `{flag:"flag_heartstone_exploited"}` † | HD "…a socket of dark glass…"; WS glows; Borin "wrong" | HD becomes band 6–8: return cr_hourglass_crawler ×2 50% or cr_unmade ×1 25% (Loop 3+); VH: Void-touched +1 level variants | Clock −5; Heartstone Core | loop |
| `ws_heartstone_destroyed` | HD, MP, CR, AE, Steppe, Drowned, EF | `{flag:"flag_heartstone_destroyed"}` | HD "There is no light here but your own…"; Borin's veins cold | HD return cr_corrupted_shade ×3 40% (04-06 E12); MP none (a Nomad patrol, friendly); CR, AE none (dark; looms idle); all breach-born −25% HP | Clock −10; `g_cistern_crack` open both ways; the Reach goes lamp-dark; Steppe ashfall stops; Ley abilities +25% MP | loop |
| `ws_camp_doubled` | loc_ironclad_camp | `{all:[{quest:"q_clear_path",stage:"completed"},{quest:"q_blighted_outpost",stage:"completed"}]}` | §3.2 state line ("The circle has doubled…") | — | — | loop |
| `ws_caravan` | loc_ironclad_camp | `{flag:"flag_hearthring_caravan"}`, set at the dawn after `{all:[{quest:"q_blighted_outpost",stage:"completed"},{quest:"q_the_scouts_oath",stage:"completed"}]}` | `ev_camp_bull` | — | npc_tessaly_varr sells at IC | loop |
| `ws_brak_at_apex` | IC → TA | the Tyrant dies with `{all:[{quest:"q_clear_path",stage:"completed"},{quest:"q_blighted_outpost",stage:"completed"},{not:{flag:"flag_brak_kept_away"}}]}` † | legacy defeat sequence | — | Brak dies holding the line (D-017; `echo_brak_death`) | loop |
| `ws_brak_kept_away` | IC → loc_hearthring | `{flag:"flag_brak_kept_away"}` † (set by `q_the_line_he_holds`) | — | IC infected → husk ×2 | Brak waits at Hearthring (STORY §7.2) and lives | loop |
| `ws_loop_2` | global | `{loop:{min:2}}` | `ev_ruins_return`, `ev_mouth_count` "Eight again", `ev_plateau_view`, `ev_glowlands_leak`, `ev_apex_watched`; Dask visible at SM | anomalies (§10.2) on nodes with no fixed group: 10% + 5%·(loop−1), cap 30%; cr_paradox_wisp at SP; cr_stutter_hound at BP; all creatures +3%/loop, cap +15% (DESIGN §6.6) | the Tyrant speaks, so the Apex is not forced; Loop 2+ items (CA wax seal, SP bell shard, CN orrery key, CR prism, SL marginalia, EF primer, EM bow) | permanent |
| `ws_loop_3` | global | `{loop:{min:3}}` | `ev_barrows_names` (FB); Dask on the Still Shore | cr_tyrants_reach at AS (10%, once a loop); cr_unmade at HD (exploited) and SY (20%) | — | permanent |
| `ws_loop_4` | global | `{loop:{min:4}}` | `ev_gallery_reflection` spawns at VY | cr_redundant_wayfinder: WR 10% if the last death was there (needs profile `lastDeathLocation` †), VY on reflection; cr_hour_leech at CN 15% | — | permanent |
| `ws_before_day_1` | Silverwood Before | `{flag:"flag_before_day_1"}` | First Bell: festival peals; `ev_plaza_dance`; NH chairs full (`ev_hall_veyran`) | none, except CX pillars ×2 when entering from the Archives stair without the seal | NH only with the seal or Caelum; Caelum at PB; marginalia at GL (seal or Remnants ≥ 20) | Before day |
| `ws_before_day_2` | Silverwood Before | `{flag:"flag_before_day_2"}` | Second Bell: overcast, single tolls; Ilsabet at CG (`ev_gardens_wheels`) | OW cr_ley_hound ×2 40%; AD cr_warding_pillar 100% without the seal; CX pillars as Day 1 | CG gives the cistern key (`echo_rhune_choice`); CX: Tobrin's ward seal (`echo_vask_seal`) | Before day |
| `ws_before_day_3` | Silverwood Before | `{flag:"flag_before_day_3"}` | Last Bell: no birds, 60 Hz hum; `ev_plaza_crack`; NH empty | CO ley-flare (Burn), adept 50% if wanted; GL adepts 60%; OW hounds 40%; NH cr_ninefold_knight 100%; CX boss cr_unbroken_warden | `g_hall_doors`, `g_conflux_stair` open; at dusk `ev_conflux_sundering` returns the player through the door they came by; altar items become Anchors (permanent) | Before day |
| `ws_wanted` | Silverwood Before | `{flag:"flag_wanted_in_silverwood"}` (weapon drawn at PB → arrest, wake at AG, lose a day) | — | GT halberdiers ×2 (Day 3); CO adept 50% | — | Before visit |
| `ws_tyrant_spared` | TA | `{all:[{loop:{min:2}},{flag:"flag_tyrant_spared"}]}` | "a place you can speak in" | no fight | `g_tyrant_tear`, `g_unbound_exit` | loop |
| `ws_weavers_wary` | CW, VH, VM, ST | `{rep:{faction:"weavers",max:-10}}` | Nyx curt | CW pool 20%; VH: cr_veil_sentry joins group B (Loop 2+); VM: sentries ×2 every visit | `g_sanctum_door` fails | loop |
| `ws_weavers_trusted` | VH, VM, ST | `{rep:{faction:"weavers",min:20}}` | — | VM sentries neutral | `g_veil_curtain` open; at Sworn (≥ 60) the Sanctum sells void-forged thread | loop |
| `ws_marked` | BR | `{corruption:{min:6}}` | `ev_pool_cleanse` on cleansing | — | Clock −1; ending E locked until cleansed at BR (free when stabilized) | loop |
| `ws_forecast` | map | Loop 1 `{day:{min:28}}`; Loop 2+ `{day:{min:25}}` | DESIGN §10.1 warnings; `ev_ruins_thirtieth` at Day 29 dusk | — | forecast hatch only (§11.6) | loop |
| `ws_night` | various | `{watch:"night"}` † | Lanternreed folk indoors | FB cr_barrow_light 100% (dusk/night); SC lightning on Soaked | `g_sluice_walkway` closes; Kaelen and the Camp trade close (Borin works) | each night |
| `ws_threshold_n` | Threshold | `{loop:{min:N}}` | Loop 2 bare; 3 Dask on the Shore; 5 `ev_shore_silhouette`; 7 `ev_shore_shards` | none | — | permanent |
| `ws_threshold_ended` | loc_gallery_of_loops | any true ending recorded in the profile | `ev_gallery_ending`; epilogue paintings | none | New Game+ at the Loom | permanent |
| `ws_ending_a` | TA | `ending_wardens_vigil` sequence | the Apex sigil becomes the Wayfinder's | no Horde (D-060) | the clock chip reads "held" | ending |
| `ws_ending_b` | TA, CX, HD | `ending_mending` | both portal edges close; the Depths' ninth plinth lit | no Horde | every `temporallyUnstable` flag clears on the epilogue map | ending |
| `ws_ending_c` | all present-day nodes | `ending_weavers_dawn` | scripted unravelling in §10.7 order (a visual only: no damage, not the infection system, D-060) | — | the sequence ends at the Before's Conflux | ending |
| `ws_ending_d` | the Aether Road (HD, SM, AS, SW, VG, CN, TA) | `ending_iron_silence` | the ley line goes dark; those nodes desaturate | no Horde | every `temporallyUnstable` flag clears (magic dies) | ending |
| `ws_ending_e` | HD, WR | `ending_long_archive` | the Depths glow steadily; Ilyra at the Heartstone | no Horde | the clock chip reads "kept" | ending |
| `ws_ending_f` | TA | `ending_unbound` | the tear opens off-map | — | every other node greys to "remembered" | ending |

### 12.2 Horde spread (data form)

```
horde: {
  source: "loc_temporal_breach_apex",
  delay:  { tyrantKilled: 1, clockExpired: 3 },            // moves before the first spread (R10-3)
  graph:  "present-day walk edges, gates ignored, no portals",
  edgeDelay: [ { from: "loc_mistwood_path",   to: "loc_silverwood_plaza", moves: 2 },   // legacy
               { from: "loc_blighted_outpost", to: "loc_emberforge",      moves: 1 } ], // forge heat
  perMove: "resolve pending, then every infected node infects all neighbours",
  entryDamage: "ceil(maxHP / 3)", entrySkipsSpread: true,                  // legacy
  tide: { at: "loc_darkened_corridor", afterMoves: 14 },
  escape: "loc_shattered_library"                                          // always drawn green
}
```

Infection order (Tyrant kill): §10.4 last column. The expiry Horde is the same order, 2 moves later.

### 12.3 `temporallyUnstable` (D-059)

**Static (24):** loc_shimmering_pass, loc_aetherium_spires, loc_sky_whisper_plateau (Highlands);
loc_windward_stair, loc_spire_crown, loc_roost_of_sentinels, loc_aldours_eyrie, loc_stormcrowns_perch
(Skyreach); loc_chronos_nexus; loc_temporal_breach_apex; loc_silver_gate, loc_outer_walks,
loc_scholars_corridor, loc_grand_library, loc_plaza_of_bells, loc_ninefold_hall,
loc_apprentices_garret, loc_cistern_gardens, loc_archives_of_danthe, loc_conflux_chamber (Silverwood
Before); loc_still_shore, loc_gallery_of_loops, loc_loom, loc_far_light (Threshold).
**Dynamic:** every node while it is infected (`ws_infected`). The Heartstone's exploited state does
not set the flag (D-059's list is exhaustive).
**Gap:** loc_veridian_glowlands is not flagged, but it sits between the Plateau and the Nexus, so
under D-059 Dask drops out on the Apex road and returns at the Nexus. DESIGN §12.8's region list
(which includes all of Glowlands & Nexus) disagrees. See X8.

---

## Appendix W — Errata for WORLD §1–3 (map, exits, gates)

Script checks first: 73 nodes; 88 walkable edges, all symmetric with opposite direction labels and
directions consistent with coordinates; no shared coordinates; all 21 legacy positions and 22 legacy
edges intact; all 73 nodes reachable from loc_whispering_ruins. These are the defects found. Siblings'
errata (04-06 E1–E14, 07-09 E-1–E-15) are not repeated; the gate ids in §11.3 already adopt 04-06 E9
and E10.

| # | where | finding | fix |
|---|---|---|---|
| W1 | §3.6 loc_black_sluice west | `{not:{day:{watch:"night"}}}` is not D-033 (`day` takes min/max); and the reverse edge (Bellmouth → Sluice) is ungated though the walkway floods both ways | add a `{watch:"…"}` atom to D-033 (X4); gate both directions (`g_sluice_walkway`) |
| W2 | §3.7 loc_hearthring south | `q_herd_of_one` is not in STORY §11 (D-062) | `{quest:"q_bone_road",stage:"accepted"}` (Hadda's quest, at Hearthring) |
| W3 | §3 gates | 8 gate Echoes are not in STORY §12: `echo_heartstone_path`, `echo_ironclad_passwords`, `echo_hollow_path`, `echo_veil_watchword`, `echo_cistern_crack`, `echo_breath_of_heights`, `echo_portal_tear`, `echo_nomad_signs` | STORY §12 adds them (D-062). Proposed sources: reach the Depths once; complete `q_clear_path` once; cross the bridge once; Weavers Trusted at a loop's end (DESIGN's `echo_veil_password` = this); open the crack once; `ev_stair_breath` (DESIGN's `echo_skyreach_song` overlaps: alias it); Ilyra at Remnants Trusted after `q_the_keepers_price`; Ferrin at the Scorched Gate |
| W4 | §1 Travel logic | "Echo alternative (§3.9)" points at the Glowfen | → §3.13; also "every walkable exit costs one watch" → "…unless the edge says otherwise (§11.2)" |
| W5 | §3.5 Apex encounters | Loop 2+ fight avoided only "with `echo_tyrant_true_name` or `echo_litany_verse_1`"; STORY §5.4 has the Tyrant speak on every Loop 2+ visit | `{loop:{min:2}}`: the fight starts only if the player attacks |
| W6 | §3.1 loc_heartstone_depths west | the crack enters the Drowned Reach without the lantern, bypassing the dark gate | `g_cistern_crack_in` adds `item_glyphbound_lantern` |
| W7 | §3.1 loc_sunken_archives items | the lantern appears only with `q_lost_scroll`, whose Archivist is a story gate, so a Loop 1 pacifist can never reach Lamplighters' Rest | lantern on the top step from Day 1, every loop (Kaelen's Loop 2+ stock and the recipe stay) |
| W8 | §3.11 loc_conflux_chamber | Days 1–2 pillars "100% unless seal" also fire on arrival through the Apex tear | pillars guard the stair: trigger only on entry from loc_archives_of_danthe |
| W9 | §2.10 Hazards, §3.9 loc_pale_gullet | "leaving the Gullet north costs two watches", but its upstream exit is **west** (to the Elder Mangrove, (40,14)) | "west"; the 2-watch cost is edge data |
| W10 | §3.13 table | Apex path "(9)" is 8 moves; Steppe "ungated alternative … (8 from WR)" is 9 (WR→SA→HD→SM→AS→SW→VG→RD→WF→SG) | correct the counts; Skyreach "(7)/(6)" are right only with the 2-watch ascent |
| W11 | §2.2 Changes | "Horde: infected late (it must pass Mistwood Path → Silverwood Plaza, the slow edge)": the Reach is infected early (Outpost at move 5, via the Plateau); the slow edge delays the Plaza, in the Ruins | "Horde: reached from the Plateau at the Outpost (move 5); the Respite falls last (9)" |
| W12 | STORY `q_lightless_stair` vs §3.3/§3.8 | STORY starts the Veil descent "at the bottom of the Chasm" and lets `q_hollow_choir` follow without Weavers Trusted; WORLD has no Chasm→Veil edge and gates the curtain at Trusted | the quest starts at the Hollow's curtain (`ev_hollow_curtain`); `g_veil_curtain` also accepts `q_lightless_stair` accepted (§11.3); no new edge |
| W13 | §1 region graph | missing the Depths ↔ Cistern crack (SR–DR second link) and the Apex tear into the Before | add `SR -. crack .- DR` and `GN -. tear ⟂ .-> SB` |
| W14 | DESIGN §6.5 / §12.8 (for the lead) | region ids `region_mistwood_ironclad`, `region_highlands`, `region_the_veil`; WORLD owns region ids (D-062) | `region_mistwood_ironclad_reach`, `region_aether_kissed_highlands`, `region_veil` |

## Appendix X — Open questions (§10–12)

- **X1 `onFlee` (R10-1).** DESIGN §4.7 should accept the per-encounter `scatter`/`hold` field, or
  pacifist play is impossible past any 100% fixed group. Scatter forfeits XP and loot and costs 2
  watches, so it is no exploit.
- **X2 Expiry Horde delay 3 (R10-3).** Needed so that no node is a death trap at expiry. The
  alternative is accepting a Loop 1 FALLEN for deep-Glowfen players, which is harsh because the clock
  is hidden in Loop 1.
- **X3 Steppe waystones.** DESIGN's "Ashen Steppe crossing 4 / 2 watches" has no single edge. Proposed:
  `echo_steppe_waystones` opens a conditional 1-watch road loc_scorched_gate ↔ loc_reedmarch_descent
  (drawn along Watchfire Ridge's line), so Outpost → Glowlands by the Steppe is 3. Or drop the Echo.
- **X4 D-033 atoms.** Add `{watch:"dawn"|"day"|"dusk"|"night"}` (W1, `ws_night`) and
  `{clock:{daysLeft:{min,max}}}` (ending E under Frayed Clock, §10.10 #2). Add the flags
  `flag_heartstone_exploited`, `flag_brak_kept_away`, `flag_clock_expired` and profile
  `lastDeathLocation` (`ws_loop_4`).
- **X5 Loop 1 Destroy warning.** One spoken dawn-count line after a Loop 1 Destroy (§10.10 #1)? It is
  STORY's call.
- **X6 Skyreach rest under an elite.** The Spire Loom guards the only Skyreach rest. Keep it (the
  Plateau camp is 2 watches down), or move the Loom to the Spire-Crown?
- **X7 Hallow's Cairn.** Mapped to loc_stormgate_cairns (§11.5). STORY or the lead to confirm, or add
  a node (that would make 74 and break D-015's 73).
- **X8 Dask on the Glowlands.** D-059 leaves loc_veridian_glowlands unflagged, so Dask cannot walk the
  Apex road with you; DESIGN §12.8 implies he can. Either amend D-059 to add the Glowlands or accept
  the drop-and-return at the Nexus.
- **X9 Ascent cost.** The 2-watch Skyreach ascent edges reconcile DESIGN §10.1 with the graph. Confirm,
  or make every edge cost 1 and drop the DESIGN line.
- **X10 Infected Library.** Legacy infects the Library (entry damage applies, label stays green). Kept.
  The legacy "Ilyra not yet arrived" text is used when Ilyra is your active companion (§12.1). Confirm.
