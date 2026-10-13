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
| silverwood_before | 13–17 | 10 | GT→OW→AG · OW→AD→CX · GT→CO→GL→PB→NH | 2 · +2 · 4 | Day 1: 0 to the Garret; see §12 by day | 11 | day-scripted | 3 (Before days, no clock) | AG camp |
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
