# Traps

> Source: `src/systems/FloorGenerator.ts`, `src/entities/Trap.ts`, `src/config.ts`, `src/scenes/DungeonScene.ts`

---

## Overview

Traps are scattered throughout dungeon rooms (never in corridors, never in the spawn room, never on warp pad tiles). They appear **invisible by default** and are revealed by your field of view as you explore.

### Visibility states

| FOV state | Trap appearance |
|---|---|
| Hidden (unexplored) | Invisible — cannot be seen |
| Visible (in current FOV) | Fully visible at 88% opacity |
| Explored (seen before, outside current FOV) | Dimly visible at 32% opacity |

> Once triggered, a trap switches to its "triggered" sprite and stays visible in any explored area.

### Density

Approximately **1 trap per room** is placed at generation time. Distribution:

| Type | Spawn weight |
|---|---|
| Spike | 55% |
| Alarm | 27% |
| Net | 18% |

Traps are placed at room interior tiles at least 10 tiles from the spawn point and 2 tiles from any room edge.

---

## Spike Trap

> The most common trap. Punishes careless movement.

**Armed sprite:** Four clusters of silver spike tips barely visible above the floor.  
**Triggered sprite:** Spikes fully extended with blood spatters.

### Effect
- **Damage:** 26 (flat, ignores defense)
- **Camera shake:** 240 ms, magnitude 0.016
- **Float text:** `SPIKE TRAP!` in red

### Notes
- Triggers when the player center is within **0.65 tiles** of the trap center.
- No cooldown — reactivation is prevented by the `triggered` flag (one-shot).
- 26 damage is significant for low-VIT classes:
  - Sage (80 HP) loses 32% of max HP
  - Tanker (160 HP) loses 16%
- At 450 ms iframes, a spike trap followed immediately by an enemy attack will both land if you're not careful.

---

## Alarm Trap

> Awakens every nearby enemy at once. Can turn a quiet area into a chaotic fight.

**Armed sprite:** Thin tripwire line at floor level with a small bell above it.  
**Triggered sprite:** Bell swinging with vibration lines; red `!` exclamation below.

### Effect
- **Alert radius:** 85 px (roughly 2.5 tiles)
- All enemies within that radius call `enemy.alert()`:
  - Forced chase state for **8 seconds**
  - Detection range tripled (480 px, ~15 tiles) during those 8 seconds
- **Float text:** `ALARM!` in orange

### Notes
- Does no direct damage — the danger is the enemies it wakes.
- Near a warp pad the alarm radius can wake entire goblin patrols.
- An alarmed enemy will chase through pillars and around corners.
- The 85 px radius is in world pixels, not tile units.

---

## Net Trap

> Slows movement drastically. Dangerous when paired with enemies.

**Armed sprite:** Brown crosshatch rope pattern barely visible on the floor.  
**Triggered sprite:** Same pattern with a blue slow-indicator circle overlay.

### Effect
- **Duration:** 2,400 ms (2.4 seconds)
- **Speed multiplier:** 0.38 (62% speed reduction)
- **Visual:** Player tinted blue for the duration
- **Float text:** `SLOWED!` in blue

### Notes
- At 0.38× speed, the player moves at ~45 px/s instead of 120 px/s.
- A goblin at 68 px/s can easily chase a slowed player (45 px/s).
- The slow ends automatically; the tint clears when the timer expires.
- Unlike spike and alarm traps this is not immediately lethal but can be lethal in the presence of enemies.

---

## Avoiding Traps

1. **Move slowly near walls** — traps appear at 88% alpha when in FOV; they blend with floor stones but are visible.
2. **Look before walking into a room** — approach the doorway, scan the visible tiles, then enter.
3. **Alarm traps near warps** — goblins cluster near warp pads, and alarm traps appear there too. Triggering an alarm next to a goblin group is often fatal.
4. **Net + spike combination** — if slowed by a net you may stumble into a spike trap. Check the floor ahead after getting netted.

---

## Trap stat reference

| Trap | Damage | Radius/Duration | Source constant |
|---|---|---|---|
| Spike | 26 | — | `TRAP_SPIKE_DMG` |
| Alarm | 0 | 85 px radius | `TRAP_ALARM_RADIUS` |
| Net | 0 | 2,400 ms slow | `TRAP_NET_DURATION` |
