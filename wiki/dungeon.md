# Dungeon

> Source: `src/systems/FloorGenerator.ts`, `src/systems/Fov.ts`, `src/config.ts`, `src/scenes/DungeonScene.ts`

---

## Map layout

Each dungeon floor is procedurally generated from a **seed + floor number** stored in the save. The same seed always produces the same floor — the map is regenerated deterministically on load. Full map data is never serialized.

| Property | Value |
|---|---|
| Map size | 500 × 400 tiles |
| Tile size | 32 × 32 px |
| World size | 16,000 × 12,800 px |
| Generation algorithm | Binary Space Partitioning (BSP) |
| Room size | 22–55 wide × 18–45 tall tiles |
| Corridor width | 3 tiles |
| Corridor shape | L-shaped between room centres |

With `minSide = 30` the map typically contains **30–45 rooms** connected by very long corridors (50–200+ tiles).

---

## Tile types

| Tile ID | Name | Passable | Blocks vision |
|---|---|---|---|
| 1 | Cave Floor | Yes | No |
| 2 | Cave Wall | No | Yes |
| 3 | Grass | Yes | No |
| 4 | Cobble Path | Yes | No |
| 5 | Warp Portal | Yes | No |
| 6 | Void | No | Yes |
| 7 | Building Interior | Yes | No |
| 8 | **Stone Pillar** | **No** | **Yes** |
| 9 | Floor Stones (rubble) | Yes | No |

> Tiles 3, 4, 7 are used only in the Town map.

---

## Wall roughening

After room and corridor generation, three passes of cave noise are applied:

1. **Corner rounding** — floor tiles touching 2+ cardinal walls AND 5+ octagonal walls become wall (68% chance). Rounds off sharp room corners.
2. **Alcove carving** — wall tiles adjacent to 1–2 floor tiles erode into floor (9% chance). Creates small nooks and irregular passage edges.
3. **Corridor nicks** — floor tiles at a straight corridor edge with 3 open neighbours turn to wall (5.5%). Adds organic waviness to long tunnels.

---

## Stone pillars

Pillars (`T_PILLAR = 8`) are placed after roughening:

- **In rooms**: 1 per ~110 sq tiles of room area, at least 3 tiles from room edges and 2 tiles from other pillars.
- **In corridors**: 6% chance per corridor edge tile (single-wall-adjacent floor tile with 3+ open neighbours) — creates hiding alcoves without blocking the passage.

Pillars **block movement** (physics collision) and **block line of sight** (FOV algorithm treats them identically to walls).  
Enemies cannot walk through pillars but also cannot be seen through them → natural ambush cover.

---

## Floor stones

Decorative rubble (`T_STONE = 9`) is placed on 9% of room interior floor tiles. Purely visual — walkable, no collision, does not block vision. Adds texture to large open rooms.

---

## Field of View (FOV)

The player can only see tiles within their **line of sight**.

| Visibility state | Tile alpha | Description |
|---|---|---|
| Hidden | 0 (invisible) | Never visited or out of LOS range |
| Explored | 0.38 (dim) | Previously seen but outside current FOV |
| Visible | 1.0 (full) | Currently lit by player's LOS |

### Algorithm

Each frame: cast a Bresenham straight line from the player tile to every tile within 9-tile radius. If the line passes through a wall or pillar tile (before reaching the target), the target is hidden. Wall and pillar tiles on the boundary ARE visible (you can see them but not through them).

**FOV radius:** 9 tiles (288 px at TILE=32)

> Enemies and traps follow the same visibility states — enemies outside your FOV are invisible but still active. Traps are invisible until explored.

---

## Warp pads

Each floor has **up to 8 warp pads** placed in different rooms. The map is divided into a 4-column × 2-row sector grid; one warp is placed per sector.

Stepping within 0.7 tiles (22 px) of a warp pad centre triggers descent to the next floor.

- Floors 1–9: warp → `FloorTransitionScene` → next `DungeonScene`
- Floor 10 warp: dungeon cleared → return to **TownScene**

### What carries over between floors
- Current HP / MP
- Gold
- Inventory
- Floor number and new random seed (for the next map)

---

## Ambient spawning

Every **22 seconds** while in the dungeon, 1–3 enemies spawn outside the player's FOV:

- Spawn ring: 8–22 tiles from player
- Candidates: floor tiles not in current FOV, not wall, not pillar
- On floors 1–3: goblins only; deeper floors: full enemy pool

This prevents camping and ensures the dungeon always feels alive.

---

## Floor progression

| Floor | Notable enemies | Threat level |
|---|---|---|
| 1 | Goblin, Goblin Shaman, Cave Bat | Moderate |
| 2 | + Rock Spider | High |
| 3 | + Skeleton | Dangerous |
| 4 | Skeleton, Spider dominant | Dangerous |
| 5 | + Stone Golem | Severe |
| 6–7 | Golem common, + Cave Troll | Severe |
| 8–10 | Full pool, dense ambient spawns | Lethal |

---

## Town — Nightfall (floor 0)

The town is a hand-authored map (**64 × 52 tiles**, world 2048 × 1664 px). It is always safe — no enemies, no traps.

### Layout zones

| Zone | Rows | Description |
|---|---|---|
| **Building row** | 1–11 | Armory (west), The Last Inn (center), Emporium (east) |
| **Main road** | 12–13 | Full-width cobblestone road connecting all buildings |
| **Town square** | 14–29 | Cobblestone plaza with central fountain, benches, lamps |
| **West residential** | 14–29 | Small house + fenced garden + well |
| **East park** | 14–29 | Grass park with scattered trees and benches |
| **South road** | 30–31 | Second connecting road |
| **Dungeon approach** | 32–43 | Flanked by guard posts, barrels, notice board |
| **Dungeon Gate** | 41–51 | Fortress complex; portal at the deepest point |

### Interactive locations

| Location | Col | Row | Interaction |
|---|---|---|---|
| **Armory** | 5 | 12 | Press **E** → 1–3: buy weapon · Q/Esc: close |
| **The Last Inn** | 30 | 12 | Press **E** → **R**: rest (30 g) · Q/Esc: leave |
| **Emporium** | 56 | 12 | Press **E** → 1–3: buy item · Q/Esc: close |
| **Dungeon Gate** | 31 | 41 | Press **E** to enter floor 1 |

### Decorations

| Object | Count | Notes |
|---|---|---|
| Street lamps | ~18 | Along main road, square corners, gate approach; visual only |
| Trees (deciduous) | ~30 | Block movement; placed in gaps, parks, south flanks |
| Pine trees | 3 | East park variant |
| Stone well | 1 | West garden; blocks movement |
| Grand fountain | 1 | Town square center (64×64 sprite); blocks movement |
| Barrels / crates | ~10 | Near shop doors and guard posts; block movement |
| Benches | 6 | Around fountain and east park; visual only |
| Notice board | 1 | South of west guard post; blocks movement |

### Player spawn

Player spawns at **col 31, row 36** (on the dungeon approach path) when entering town from character creation or loading a town save.

Resting at the Inn fully restores HP and MP. It does **not** prevent permadeath — town is a checkpoint, not a save point.
