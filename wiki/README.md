# Night Dungeon — Game Wiki

> Last updated: 2026-06-03 · Phase 6 (P1–P5 complete, art/polish pass)

This wiki is the player-facing reference for **Night Dungeon**, a hardcore permadeath dungeon crawler.
It is maintained alongside the source code — update the relevant page whenever a game system changes.

---

## Contents

| Page | What it covers |
|---|---|
| [Characters](characters.md) | Races, classes, base stats, starting equipment |
| [Monsters](monsters.md) | Every enemy type — stats, AI, floor availability |
| [Traps](traps.md) | Trap types, trigger conditions, effects |
| [Items](items.md) | Weapons, armor, consumables, shop prices |
| [Dungeon](dungeon.md) | Floor layout, FOV, pillars, warp pads, ambient spawns |
| [Mechanics](mechanics.md) | Combat, permadeath, saving, town, stat formulas |

---

## Quick-start

1. Create a character (Race → Class).
2. You spawn in **Town** at the Dungeon Gate with starting gear and full HP/MP.
3. Enter the dungeon — **one life, no checkpoints** (the Inn in Town is the only rest).
4. Reach the warp pads on each floor to descend. Survive all 10 floors to win.
5. Die → save is permanently deleted → start over.

---

## Maintainer notes

- Source of truth: `src/` — all numbers in this wiki are pulled directly from the TypeScript source.
- When changing a constant in `src/config.ts` or a data file in `src/data/`, update the matching wiki page.
- File map: `enemies.ts` → `monsters.md` · `classes.ts` + `races.ts` → `characters.md` · `items.ts` → `items.md` · `config.ts` → `mechanics.md` and `dungeon.md`.
