# Echoes of Aethelgard: The Unraveling

This merges `unraveling` into `main`. The game is a ground-up rebuild of the Python text RPG as a time-loop RPG for the
browser. It deploys to GitHub Pages from `main`.

## Summary

*Echoes of Aethelgard: The Unraveling* rebuilds Tim's Python text RPG as a time-loop RPG for the browser. The legacy game is
Loop 1, kept word for word. Around it are thirty days on a Breach Clock, Echoes that persist from loop to loop, the
Threshold between loops, Silverwood Before (the city on its last three days, five hundred years ago), and six true
endings.

**The game, in numbers** (the real pack at `2b3b53d`, after U84):

| | |
|---|---|
| World | 12 regions, 73 locations; 38 NPCs, 8 merchants, 3 factions |
| Fights | 73 creatures (33 fodder, 9 elite, 22 anomaly incl. 16 variants, 9 bosses), 12 encounter tables, 19 statuses |
| Characters | 5 classes × 15 abilities, 6 companions (24 companion abilities), 8 Amulet/item abilities; 15 attunements |
| Story | 49 quests (6 legacy, 6 regional, 4 faction, 18 companion, 5 class, 4 loop, 6 ending); 228 dialogue scenes; 103 Echoes; 90 codex entries |
| Endings | 6 true endings + 2 loop closers; 40 achievements; 6 run modifiers (New Game+) |
| Items | 157 items, 31 recipes, 12 affixes |
| Art | 77 painted backdrops (with `@sm` copies), 67 sprites, 38 portraits, title art: Grok Imagine, approved by Tim |
| Audio | 30 synthesized SFX, region beds, the Threshold drone, the Tyrant's theme (Web Audio, no samples) |

**Engineering:**
- **Engine:** a pure, deterministic reducer, with a seeded RNG and replayable traces (24 committed, checked in bun and in
  the browser).
- **Saves:** frozen at v1 with golden files, plus migration tables (D-142).
- **Content:** zod-validated, with 22 cross-reference rules.
- **UI:** React, with an in-repo a11y check on every screen, a fixed movement pad, and one-screen layouts on desktop and
  phones (D-148).
- **Tests:** 4,944 unit tests plus the coverage gate; 361 e2e (desktop and mobile Chromium), with in-repo a11y checks on
  every screen; 81 quest proofs; 8 ending scripts.
- **Bundle:** JS 529.5 kB gzip of a 600 kB budget, plus 75.0 kB of lazily loaded text.

**Balance** (U82's release batch; BALANCE.md "After U82"):
- **Runs:** 1,499 (990 main, 420 scenario, 8 ending scripts, 81 quest proofs).
- **Health:** 0 engine errors, 0 soft-locks, determinism 200/200.
- **Coverage:** quests 49/49, locations 73/73, endings 8/8, creatures 70/71 (two are Loop 4+ by design), items 146/157.
- **Gates:** Loop 1 Escape is at least 97 % for every class. 8 of DESIGN §19's 20 rows pass outright, and every other row
  carries a ruling (D-149, D-151).

The full record is in `docs/REPORT.md`: the final audit, the PLAN §10.7 checklist, the decisions worth knowing and the D-150
trade-offs. The rulings are in `docs/DECISIONS.md` (D-001–D-152), and the balance numbers in `docs/BALANCE.md`.

## How to test

- **After the merge, on Pages:** first set the one-time **Settings → Pages → Source = GitHub Actions**. The `Pages` workflow
  then deploys `main` to <https://dubbltninja.github.io/Aethelgard/>.
- **Locally:** `npm install` (or `node tools/link-local-deps.mjs` offline), then `npm run dev`. Or `npm run preview`, which
  builds and serves `dist/` under `/Aethelgard/`, like Pages.
- **The gates:** `npm run check` (what CI runs), `npm run test:e2e`, `npm run sim -- quest --pack real` (81/81) and
  `npm run sim:endings` (8/8). All four passed on a clean clone of `unraveling` at `2b3b53d`, with 361 e2e passed and 0
  failed. The production `dist/` was also opened from `/Aethelgard/` in Playwright, with no 404s and no console errors.
- **What to try:** a new Ranger. Talk to Ilyra, take the Amulet, and head north through the Archway to the Darkened Corridor for the first fight. Then
  `?scenario=pre_tyrant_l13_ranger` for the Loop 1 Tyrant, and play into Loop 2 to see the Echoes at work.

## Known issues

These are accepted for this release (D-149, D-151, D-152; the README has the player-facing list):
- The Drowned Reach and the Highlands are deadlier than their level bands. The danger cue warns: "Dangerous" from 2 levels
  above the party, "Deadly" from 4.
- Gold piles up (about 900 at the end of Loop 1), and there's no gold sink yet. It resets at the Threshold.
- The Contained Tyrant takes 7–10 rounds for a Wizard and 20–30 for an Elf, because of class damage. *Remember*'s late
  rewind can feel like lost progress.
- Casters are 47 % death-free in band, against a 55 % target. A full Loop 1 sweep doesn't fit in one clock.
- The bots don't use the empowered Blood price toggle, so its share is unmeasured.
- No bot reaches these, though a player can: the Loop 4+ creatures, the Horde's Unraveling Tide, seven late forge patterns,
  the Voidforged set and the Ward Seal.
- The first fight opens under queued toasts, and the class ability point is easy to miss.
- The developer `pre_tyrant_*` scenarios' summary says "The Heartstone: Intact".
- CI runs Chromium only. Safari, Firefox and real phones still need testing.

## Credits

A game by Tim Dibert. The art was made with Grok Imagine and approved by Tim. The audio is synthesized. The original Python
game is in `legacy/`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
