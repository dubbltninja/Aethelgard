# Echoes of Aethelgard — the original Python game

This folder holds the original text RPG exactly as it was before the rebuild (D-039). The files were moved here
unchanged; the new game, *Echoes of Aethelgard: The Unraveling*, lives in the repository root (`src/`).

## Requirements

Python 3 (last checked with 3.13). Standard library only — nothing to install.

## How to play

Run these from the repository root (or `cd legacy` and drop the `legacy/` prefix):

| Command | What it does |
|---|---|
| `python3 legacy/echoes_of_aethelgard.py` | Launch menu: choose terminal or browser mode |
| `python3 legacy/echoes_of_aethelgard.py --cli` | Play in the terminal |
| `python3 legacy/echoes_of_aethelgard.py --web` | Play in a local web browser (serves `legacy/web_ui/`) |
| `python3 legacy/echoes_of_aethelgard.py --web --host HOST --port PORT` | Browser mode on another address (default `127.0.0.1:8000`) |
| `python3 legacy/echoes_of_aethelgard.py --web --no-browser` | Start the web server without opening a browser |

`--cli` and `--web` are mutually exclusive. Type `help` in game to see the commands (including `examine <item>`).

## Saves

Save slots are written next to the script: `legacy/savegame_slot1.json` … `legacy/savegame_slot3.json` (the game
locates them from its own path, so the working directory does not matter). They are ignored by git.

## Files

- `echoes_of_aethelgard.py` — the game: engine, terminal UI, and the small HTTP server for browser mode.
- `aethelgard_data.py` — locations, enemies, items and the ending art.
- `web_ui/` — the browser front end (`index.html`, `app.js`, `styles.css`).
