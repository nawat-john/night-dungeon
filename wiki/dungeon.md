# Dungeon

> Source: `src/systems/FloorGenerator.ts`, `src/systems/Fov.ts`, `src/config.ts`, `src/scenes/DungeonScene.ts`, `src/scenes/TownScene.ts`

---

## Map layout

Each dungeon floor is procedurally generated from a **seed + floor number** stored in the save. The same seed always produces the same floor — the map is regenerated deterministically on load. Full map data is never serialized.

### Floor sizes

| Floor | Map size (tiles) | Tile size | World size (px) | Layout |
|---|---|---|---|---|
| Floor 1 | 500 × 400 | 32 × 32 | 16,000 × 12,800 | Single BSP cave |
| Floor 2 | 1,000 × 800 | 32 × 32 | 32,000 × 25,600 | 4-quadrant multi-biome |
| Floors 3–10 | 500 × 400 | 32 × 32 | 16,000 × 12,800 | BSP cave, themed floor tile |
| Floor 10 (gauntlet) | 500 × 400 | 32 × 32 | 16,000 × 12,800 | Linear gauntlet + boss arena |

Only Floor 2 uses the doubled 1000×800 map. Floors 3–10 use the same 500×400 footprint as Floor 1, distinguished visually by a unique procedural floor-tile theme per floor.

| Property | Value |
|---|---|
| Generation algorithm | Binary Space Partitioning (BSP) |
| Room size | 22–55 wide × 18–45 tall tiles |
| Corridor width | 3 tiles |
| Corridor shape | L-shaped between room centres |
| Typical room count | 30–45 (floor 1) / 60–100 (floor 2+) |

---

## Tile types

| Tile ID | Name | Passable | Blocks vision | Used in |
|---|---|---|---|---|
| 1 | Cave Floor | Yes | No | Floors 1, 3–10 (default) |
| 2 | Cave Wall | No | Yes | All dungeon floors |
| 3 | Grass | Yes | No | Town only |
| 4 | Cobble Path | Yes | No | Town only |
| 5 | Warp Portal | Yes | No | All dungeon floors |
| 6 | Void | No | Yes | Town only |
| 7 | Building Interior | Yes | No | Town only |
| 8 | **Stone Pillar** | **No** | **Yes** | All dungeon floors |
| 9 | Floor Stones (rubble) | Yes | No | All dungeon floors |
| 10 | Forest Floor | Yes | No | Floor 2 — Forest quadrant |
| 11 | Deadland Floor | Yes | No | Floor 2 — Deadland quadrant |
| 12 | Pond Floor | Yes | No | Floor 2 — Pond quadrant |
| 13 | Rock Floor | Yes | No | Floor 2 — Rock quadrant |
| 14 | Fungal Floor | Yes | No | Floor 3 — Fungal Depths |
| 15 | Barracks Floor | Yes | No | Floor 4 — Old Barracks |
| 16 | Foundry Floor | Yes | No | Floor 5 — Ashen Foundry |
| 17 | Frozen Floor | Yes | No | Floor 6 — Frozen Reliquary |
| 18 | Catacombs Floor | Yes | No | Floor 7 — Shadowed Catacombs |
| 19 | Void Floor | Yes | No | Floor 8 — Voidtouched Caverns |
| 20 | Throne Floor | Yes | No | Floors 9–11 — Throne Halls |

> All floor tiles (IDs 1, 10–20) are walkable and do not block vision. The tile variant is purely visual, conveying the floor's theme.

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
- **In corridors**: 6% chance per corridor edge tile — creates hiding alcoves without blocking the passage.

Pillars **block movement** (physics collision) and **block line of sight** (FOV algorithm treats them identically to walls). Enemies cannot walk through pillars but also cannot be seen through them → natural ambush cover.

---

## Floor stones

Decorative rubble (`T_STONE = 9`) is placed on 9% of room interior floor tiles. Purely visual — walkable, no collision, does not block vision.

---

## Field of View (FOV)

The player can only see tiles within their **line of sight**.

| Visibility state | Tile alpha | Description |
|---|---|---|
| Hidden | 0 (invisible) | Never visited or out of LOS range |
| Explored | 0.38 (dim) | Previously seen but outside current FOV |
| Visible | 1.0 (full) | Currently lit by player's LOS |

**FOV radius:** 9 tiles (288 px at TILE=32)

Each frame: cast a Bresenham straight line from the player tile to every tile within 9-tile radius. If the line passes through a wall or pillar tile (before reaching the target), the target is hidden. Wall and pillar tiles on the boundary ARE visible (you can see them but not through them).

Enemies and traps follow the same visibility states — enemies outside your FOV are invisible but still active.

---

## Warp pads

Each floor has **up to 8 warp pads** placed in different rooms. The map is divided into a 4-column × 2-row sector grid; one warp is placed per sector.

Stepping within 0.7 tiles (22 px) of a warp pad centre triggers descent to the next floor.

- Floors 1–9: warp → `FloorTransitionScene` → next `DungeonScene`
- Floor 10 warp: dungeon cleared → return to **TownScene** (victory)

### What carries over between floors
- Current HP / MP
- Gold
- Inventory and equipment
- Active meal buff
- Companion state

---

## Ambient spawning

Every **22 seconds** while in the dungeon, 1–3 enemies spawn outside the player's FOV:

- Spawn ring: 8–22 tiles from player
- Candidates: floor tiles not in current FOV, not wall, not pillar
- Enemy pool: themed enemies for the current floor (see floor progression table)

This prevents camping and ensures the dungeon always feels alive.

---

## Enemy spawn budget

Each floor has a **spawn budget** used to populate rooms at generation time.

| Floor | Budget |
|---|---|
| 1 | 235 |
| 2 | 290 |
| 3 | 345 |
| … | +55 per floor |
| 10 | 730 |

Each enemy archetype costs a fixed number of budget points when placed (Swarm=3, Chaser=5, Skirmisher=7, Ranged/Charger/Support=8, Caster=10, Brute=15).

---

## Floor progression

| Floor | Theme | Floor tile | Boss | Notable enemies |
|---|---|---|---|---|
| 1 | Ruined Entrance | Cave (1) | Goblin Warlord | Goblin, Goblin Shaman, Cave Bat, Cave Slime |
| 2 | Flooded / Multi-biome | Forest(10)/Dead(11)/Pond(12)/Rock(13) | The Drowned King | Drowned, Reed Lurker, Toad Caster, Treant, Vine Snare, Ghoul, Wraith, Bone Golem, Frog Warrior, Swamp Slug, Water Serpent, Rock Crab, Stone Imp, Cave Drake |
| 3 | Fungal Depths | Fungal (14) | Brood Matron | Spore Brute, Myconid, Fungal Spider |
| 4 | Old Barracks | Barracks (15) | Sir Mordrek | Skeleton Soldier, Crossbow Wight, Shield Revenant |
| 5 | Ashen Foundry | Foundry (16) | Forgefather Brand | Ember Hound, Forge Golem, Cinder Mage |
| 6 | Frozen Reliquary | Frozen (17) | Frost Warden Ysold | Frost Wolf, Ice Archer, Glacial Knight |
| 7 | Shadowed Catacombs | Catacombs (18) | The Hollow Choir | Wraith Shade, Bone Colossus, Cultist |
| 8 | Voidtouched Caverns | Void (19) | Riftmaw | Void Spawn, Riftling, Maw |
| 9 | The Ascended Court | Throne (20) | The Ascendant Twins (Aeriel + Mordael) | Fallen Knight, Arcane Sentinel, Echo Shade |
| 10 | Throne Approach | Throne (20) | The Sovereign | Iron Guardian, Shadow Herald, Void Herald |

---

## Bosses

Each floor has one boss encounter in a dedicated room. Bosses have multiple phases and **break parts** — destroying a part at a cumulative damage threshold drops additional loot and disables one of the boss's attacks.

| Floor | Boss | HP | Drop | Checkpoint unlocks |
|---|---|---|---|---|
| 1 | Goblin Warlord | 1,500 | Goblin Tooth ×1 | Floor 2 start |
| 2 | The Drowned King | 2,800 | Drowned Pearl ×1 | Floor 3 start |
| 3 | Brood Matron | 3,500 | Brood Venom ×1 | Floor 4 start |
| 4 | Sir Mordrek | 4,200 | Captain Badge ×1 | Floor 5 start |
| 5 | Forgefather Brand | 5,500 | Brand Ember ×1 | Floor 6 start |
| 6 | Frost Warden Ysold | 7,000 | Frost Crystal ×1 | Floor 7 start |
| 7 | The Hollow Choir | 8,500 | Choir Soul ×1 | Floor 8 start |
| 8 | Riftmaw | 10,000 | Riftmaw Eye ×1 | Floor 9 start |
| 9 | The Ascendant Twins | 6,500+6,500 | Twin Crest ×1 | Floor 10 start |
| 10 | The Sovereign | 15,000 | Sovereign Heart ×1 | — (victory) |

All bosses **enrage** at 20% HP (15% for the Twins), gaining speed and damage multipliers.

---

## Anomalies

Every floor has a **22% chance** to spawn an anomaly — a special event that disrupts the normal dungeon rhythm.

| Anomaly | Type | Effect |
|---|---|---|
| Dimensional Rift | Combat | Enemies from a different floor bleed through a rift |
| Mirror Rift | Combat | A shadow-copy of the player attacks you |
| The Gravelord | Combat | A reanimating undead lord that raises fallen enemies |
| Avarice, the Gilded Maw | Puzzle/risk | Loot chest that fights back if you take too much |
| The Clockwork Judge | Gauntlet | A timed trial — fail and take damage |
| Old Friend | Story | A familiar ghost that offers a hint or gift |
| The Hungering Dark | Survival | FOV radius shrinks to 3 tiles for 60 s |
| The Hunter | Pursuit | An unkillable stalker appears; must be fled or hidden from |
| Wandering Merchant | Shop | A rare in-dungeon vendor with unique stock |
| Cursed Bargain | Risk/reward | Trade HP or a stat point for powerful loot |
| Gambler's Chest | Risk/reward | A chest that might give great loot or curse you |
| Caged Ally | Rescue | Free a trapped companion (instant-hire at no cost) |
| Blood Moon | Difficulty spike | All enemies gain +30% speed and +20% damage for the floor |
| Echo of a Fallen Hero | Combat | Fight a ghost version of one of your past runs |
| Beast Stampede | Survival | A wave of fast swarm enemies rushes across the floor |

Anomaly enemies use the `anom_*` ID prefix and do **not** count toward bounty kill-tracking.

---

## Checkpoint floors

Defeating a floor's boss permanently unlocks that floor as a **checkpoint start** for future runs (stored in account meta, never wiped).

When starting a new run at the Dungeon Gate, if any checkpoint floors are unlocked above floor 1, a floor-selection panel appears. Choosing a higher floor skips earlier content but still begins with only class starting equipment and stats.

---

## Town — Nightfall (floor 0)

The town is a hand-authored map (**64 × 52 tiles**, world 2,048 × 1,664 px). It is always safe — no enemies, no traps.

### Layout zones

| Zone | Rows | Description |
|---|---|---|
| **Building row** | 1–11 | Armory (west), The Last Inn (center), Emporium (east) |
| **Main road** | 12–13 | Full-width cobblestone road |
| **Town square** | 14–29 | Cobblestone plaza with fountain, benches, lamps |
| **West residential** | 14–29 | Small house, fenced garden, well |
| **East area** | 14–29 | Sage's Tower (east wall), Emporium nearby |
| **South road** | 30–31 | Second connecting road |
| **Dungeon approach** | 32–43 | Guard posts, barrels, notice board, Wandering Stall |
| **Chapel** | 43–50 | West side of approach; resurrection/buff shrine |
| **Dungeon Gate** | 41–51 | Fortress complex; portal at the deepest point |

### Interactive locations

| Location | Col | Row | Interaction |
|---|---|---|---|
| **Armory** | 5 | 12 | Press **E** → buy weapons/armor, upgrade equipment, forge boss-material gear |
| **The Last Inn** | 30 | 12 | Press **E** → rest (30 g) — full HP/MP restore; companions recover fatigue |
| **Emporium** | 57 | 12 | Press **E** → buy consumables, ammo, Adventure Bag |
| **Sage's Tower** | 56 | 29 | Press **E** → enchant, socket, or transmute items |
| **Chapel** | 6 | 44 | Press **E** → bless an item or receive a passive buff |
| **Adventurer's Guild** | 31 | 29 | Press **E** → hire companions, view/claim daily bounties, view run graveyard |
| **Wandering Stall** | 42 | 27 | Press **E** → rare rotating stock (3 items, changes daily) |
| **Town Guard** | 25 | 37 | Press **E** → banter reacting to your current floor progress |
| **Dungeon Gate** | 31 | 41 | Press **E** → enter the dungeon (floor 1 or an unlocked checkpoint floor) |

### Player spawn

Player spawns at **col 31, row 36** (dungeon approach path) when entering town from character creation or loading a town save.

### Decorations

| Object | Count | Notes |
|---|---|---|
| Street lamps | ~18 | Along main road, square corners, gate approach |
| Trees | ~30 | Block movement |
| Stone well | 1 | West garden |
| Grand fountain | 1 | Town square center |
| Barrels / crates | ~10 | Near shop doors and guard posts |
| Benches | 6 | Around fountain and east park |
| Wandering Stall marker | 1 | Distinctive portable-shop sprite in dungeon approach |
