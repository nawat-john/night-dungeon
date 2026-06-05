# Core Mechanics

> Source: `src/config.ts`, `src/entities/Player.ts`, `src/entities/Enemy.ts`, `src/systems/SaveManager.ts`

---

## Permadeath

Night Dungeon is **hardcore permadeath**.

- One character per save slot (slot 0).
- When HP reaches 0, after a brief death screen, the save is **permanently deleted** (`SaveManager.wipe()`).
- No soft delete, no run history. You start over from character creation.
- The Inn in town fully restores HP/MP but is not a checkpoint — dying on any floor still wipes your save.

---

## Combat

### Player attacking

Press **Space** to attack. Attack type depends on class:

| Class | Attack type | Description |
|---|---|---|
| Swordman, Tanker, Assassin | Melee | Hits all enemies within 42 px in the facing direction. Slash effect plays. |
| Archer | Arrow | Fires a projectile at 220 px/s. Disappears on first hit or after 1.5 s. |
| Sage | Fireball | Fires at 140 px/s, deals `attackDmg × 1.4`, disappears on first hit or after 1.5 s. |

| Constant | Value | Meaning |
|---|---|---|
| `ATTACK_COOLDOWN` | 600 ms | Minimum time between player attacks |
| `IFRAMES_DURATION` | 450 ms | Player invincibility after taking a hit |

> With 450 ms iframes, back-to-back enemy hits will both land if they connect within the same window. Two goblins attacking simultaneously is very dangerous.

### Enemy attacking

All enemies share the same attack mechanic: stand adjacent to the player and deal `def.dmg` on a fixed cooldown.

| Constant | Value |
|---|---|
| `ENEMY_ATTACK_RANGE` | 36 px (~1 tile) |
| `ENEMY_ATTACK_COOLDOWN` | 900 ms |

### Damage formula

```
player.attackDmg = max(6, STR × 3 + DEX)
```

Examples with starting stats:

| Class | STR | DEX | ATK |
|---|---|---|---|
| Swordman | 10 | 8 | 38 |
| Archer | 7 | 12 | 33 |
| Tanker | 10 | 5 | 35 |
| Assassin | 7 | 12 | 33 |
| Sage | 4 | 6 | 18 (×1.4 = 25 fireball) |

---

## Movement

| Constant | Value |
|---|---|
| `PLAYER_SPEED` | 120 px/s |
| Net-slowed speed | 45.6 px/s (0.38×) |
| Net slow duration | 2,400 ms |

Movement is **8-directional** with normalised diagonal speed (no faster diagonally). The player faces the direction of movement; animations update accordingly.

> **Hearing mechanic:** While the player is moving (`velocity magnitude > 8`), all enemies detect the player at 360 px (11 tiles) regardless of walls or pillars. Standing still reduces enemy detection to 160 px sight range. Moving quietly is a valid tactic.

---

## Stats

| Stat | Affects |
|---|---|
| HP | Max health (from VIT and class base) |
| MP | Max mana (from INT and class base; not consumed currently) |
| STR | Physical damage (×3 in ATK formula) |
| DEX | Physical damage (+1 per point in ATK formula); Archer/Assassin primary |
| INT | Sage fireball multiplier (baked into class selection; no per-point scaling yet) |
| VIT | Max HP base (baked into class selection) |
| AGI | No mechanical effect currently (reserved for crit/dodge in a future phase) |

---

## Saving

The save format is a single JSON blob (`CharacterSave`) written to:
1. **localStorage** immediately (synchronous)
2. **Supabase** after a 2-second debounce (async, graceful degradation)

### When saves happen
- On floor transition (warp pad step)
- On town transactions (shop purchase, inn rest)
- On gold change from enemy drops

### Save data includes
- Character stats and equipment
- Current HP / MP
- Gold
- Inventory
- Location (`town` or `dungeon`) and floor number
- Floor seed (for deterministic regeneration on reload)
- Character creation timestamp

### No Supabase configured?
The game falls back to localStorage-only mode silently. No error is shown; the game is fully playable offline.

---

## Scene flow

```
BootScene
  └─ resolves player ID, syncs save from server
PreloadScene
  └─ generates all textures and animations in memory
MainMenuScene
  ├─ New Game → CharacterCreateScene → TownScene
  └─ Continue → TownScene (town) or DungeonScene (dungeon)
TownScene ←───────────────────────────────────────┐
  └─ Dungeon Gate → FloorTransitionScene           │
DungeonScene (per floor)                          │
  └─ Warp pad → FloorTransitionScene → DungeonScene│
  └─ Floor 10 warp ──────────────────────────────→─┘
  └─ Player death → MainMenuScene (save wiped)
UIScene  (runs in parallel with Town/Dungeon, shows HUD)
```

---

## HUD

The persistent `UIScene` overlay shows:

| Element | Position | Data source |
|---|---|---|
| HP bar (red) | Top-left | `player.currentHp / maxHp` |
| MP bar (blue) | Top-left below HP | `player.currentMp / maxMp` |
| Gold counter | Top-right | `player.gold` |
| Floor label | Top-centre | Current dungeon floor (hidden in town) |
| Hint text | Bottom-centre | `Space: Attack   E: Interact` |

---

## Controls

| Key | Action |
|---|---|
| WASD / Arrow keys | Move |
| Space | Attack |
| E | Interact (open shop / inn / dungeon gate) |
| 1, 2, 3 | Buy item in shop panel |
| R | Rest at inn |
| Q / Escape | Close panel |
| Enter | Confirm (character creation, death screen) |
| Up / Down | Navigate menus |
