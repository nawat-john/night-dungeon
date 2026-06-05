# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Dungeon RPG (Phaser 3 + TypeScript + Vite)

Read `DUNGEON_RPG_SPEC.md` for the full design — it is the source of truth. Build phases in order; do not skip ahead.

**Currently on: PHASE 6 (P1–P5 complete, ready for art/polish pass)**

---

## Commands

```bash
npm run dev      # start Vite dev server with HMR
npm run build    # type-check + bundle to dist/
npm run preview  # serve the built dist/
```

Run a type-check alone: `npx tsc --noEmit`

### Supabase setup (P5)

1. Create a project at supabase.com
2. Run `supabase/migrations/001_saves.sql` in the SQL editor
3. Copy `.env.example` → `.env` and fill in `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
4. Without `.env`, the game silently falls back to localStorage-only mode

---

## Architecture

### Scene flow
`BootScene → PreloadScene → PlayScene` (Phase 0). Each game screen is one `Phaser.Scene` subclass in `src/scenes/`. The `UIScene` runs in parallel as a persistent HUD overlay (Phase 2+).

### Key constraints
- **Pixel art config** — `pixelArt: true`, `roundPixels: true`, `antialias: false`. Internal resolution `480×270` (16:9), integer-scaled to window. `TILE = 32px`.
- **No `any`** — TypeScript strict mode is on. All types go in `src/types/index.ts`.
- **Client-authoritative** — no game server, no WebSockets. Backend (Supabase) is Phase 5 only; `SaveManager` is a stub until then.
- **Deterministic floors** — store seed + floor number in the save; regenerate on load. Never serialize full tilemap data.

### Module layout
| Path | Purpose |
|---|---|
| `src/config.ts` | Central constants: `TILE`, `RES_W`, `RES_H`, `PLAYER_SPEED` |
| `src/main.ts` | `Phaser.Game` instantiation + scene list |
| `src/scenes/` | One file per game screen |
| `src/entities/` | `Player`, `Interactable`, `WarpPad` |
| `src/systems/` | `InputController`, `FloorGenerator`, `SaveManager` |
| `src/data/` | Static tables: `races.ts`, `classes.ts`, `items.ts` |
| `src/types/index.ts` | Shared TS interfaces (`CharacterSave`, `Race`, `CharClass`, etc.) |
| `public/assets/` | Tiles, sprite atlases (PNG + JSON), item icons, Tiled maps |

### Save model
`CharacterSave` is a single JSON blob written to Supabase slot `0`. Serialize on meaningful events (floor transition, town transactions) with a ~2s debounce. On permadeath, delete the row entirely — no soft deletes.

---

## Phase roadmap

| Phase | Deliverable |
|---|---|
| **P0** | Walk-around prototype: Boot→Preload→Play, 40×30 Tiled test map, 8-directional player, arcade collision, clamped camera |
| **P1** | Main menu + character creation (race→class filtered picker) |
| **P2** | Town hub: dungeon gate, shops, inn, proximity "Press E" interactions, UIScene HUD |
| **P3** | `FloorGenerator` (seeded BSP rooms + corridors), warp pads, floors 1–10 |
| **P4** | Combat, enemy AI, loot, inventory + equipment, consumables |
| **P5** | Supabase auth + real `SaveManager`, permadeath wipe, debounced autosave |
| **P6** | Final pixel-art pass, SFX/music, balancing, polish |

After verifying a phase works, update the "Currently on" line above before starting the next phase.

---

## Wiki (`wiki/`)

The `wiki/` folder is the player-facing reference. **Keep it in sync with the code.**

| Changed file | Update wiki page |
|---|---|
| `src/data/enemies.ts` | `wiki/monsters.md` — stat tables |
| `src/data/races.ts` | `wiki/characters.md` — race table |
| `src/data/classes.ts` | `wiki/characters.md` — class entries and starting gear |
| `src/data/items.ts` | `wiki/items.md` — item tables |
| `src/config.ts` | `wiki/mechanics.md` (combat/movement constants) and/or `wiki/dungeon.md` (map/FOV constants) and/or `wiki/traps.md` (trap constants) |
| `src/systems/FloorGenerator.ts` | `wiki/dungeon.md` — map layout, tile types, pillar/stone rules |
| `src/entities/Enemy.ts` | `wiki/monsters.md` — AI behaviour section |
| `src/entities/Trap.ts` | `wiki/traps.md` — visibility and trigger rules |
| `src/scenes/DungeonScene.ts` | `wiki/dungeon.md` — ambient spawn, warp logic |
| `src/scenes/TownScene.ts` | `wiki/items.md` (shop prices), `wiki/dungeon.md` (town layout) |

Rule: if a number changes in source, the matching number in the wiki changes too. No stale documentation.
