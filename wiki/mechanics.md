# Core Mechanics

> Source: `src/config.ts`, `src/entities/Player.ts`, `src/entities/Enemy.ts`, `src/systems/SaveManager.ts`

---

## Permadeath & Account Meta

Night Dungeon is **hardcore permadeath**.

- One character per save (slot 0). Death = full save wipe via `SaveManager.wipe()`.
- The Inn in town fully restores HP/MP but is not a checkpoint.
- **Account meta** (`nd_account_meta` in localStorage) survives permadeath and tracks:
  - **Run history** — last 50 runs (floor reached, bosses slain, cause of death, gold earned, duration)
  - **Hall of Champions** — runs that cleared all 10 floors (victories)
  - **Checkpoint floors** — unlocked by defeating floor bosses; lets you start new runs from deeper floors

Checkpoint floors unlock after the boss of that floor dies: defeating the Floor 1 boss unlocks a Floor 2 start, defeating Floor 2 boss unlocks Floor 3 start, and so on up to Floor 10. Use them at the Dungeon Gate when starting a new run.

---

## Combat

### Stamina

Every action that expends energy costs stamina. If stamina hits 0, heavy attacks and dodges are locked out.

| Constant | Value |
|---|---|
| Max Stamina | 100 |
| Regen rate | 18 / second |
| Regen delay | 600 ms after last spend |
| Dodge cost | 25 |
| Sprint drain | 12 / second |
| Light attack cost | 8 |
| Heavy attack cost | 22 |

### Attacks

Press **Space** for a light attack. Hold **Space** (or weapon-specific input) for heavy.

| Attack | Startup | Active | Recovery | MV | Poise Dmg |
|---|---|---|---|---|---|
| Light | 167 ms | 67 ms | 267 ms | 0.32 | 12 |
| Heavy | 267 ms | 67 ms | 433 ms | 0.55 | 22 |

**MV (Motion Value):** multiplied against `max(6, STR×3+DEX)` to get final damage.

**Combo window:** the last 40% of recovery time accepts a queued input to continue the combo chain.

**Input buffer:** 300 ms — inputs register up to 300 ms early, so you can queue the next attack during recovery.

### Damage formula

```
rawDmg = max(6, STR × 3 + DEX) × MV
critRoll < (3% + AGI × 0.6%) → finalDmg = rawDmg × 1.35
```

Enemy damage comes from `def.dmg` directly, reduced by player defense from equipment.

### Dodge

Press **Shift** (or the dedicated dodge key) to roll.

| Property | Value |
|---|---|
| Total duration | 200 ms |
| I-frame window | ms 50–150 (100 ms of invincibility) |
| Stamina cost | 25 |

The 100 ms i-frame window is tight — you must read enemy telegraphs to dodge reliably.

### Attack cooldown and i-frames

| Constant | Value |
|---|---|
| `ATTACK_COOLDOWN` | 600 ms between player attacks |
| `IFRAMES_DURATION` | 450 ms player invincibility after taking a hit |

### Poise and stagger

Every hit applies poise damage to the target. When accumulated poise damage exceeds the poise threshold, the target staggers.

| Property | Value |
|---|---|
| Stagger duration | 500 ms |
| Poise decay window | 3,000 ms (resets if no hits within this window) |

Champions are harder to stagger (higher poise threshold). Brute-archetype enemies have super-armor on their own attacks.

### Guard / Block (Tanker + shield)

When a shield is equipped, hold the guard input to block incoming attacks.

| Property | Value |
|---|---|
| Damage blocked | 60% |
| Perfect-block window | 100 ms after raising guard |
| Stamina cost | 30% of incoming damage |

A perfect block (guard raised within 100 ms of the hit) completely nullifies damage and briefly stuns the attacker.

### Knockback

| Source | Knockback |
|---|---|
| Enemy hits player | 90 px |
| Player hits enemy | 80 px |

### Potion use

Pressing the potion key roots the player for **1,500 ms** while drinking. You cannot dodge or attack during this window.

---

## Weapon families

Each weapon family has unique mechanics beyond the base light/heavy framework.

| Family | Special mechanic |
|---|---|
| **Sword** | Parry stance; light → heavy chains into a wide arc |
| **Greatsword** | Charged heavy: hold for 300 ms → tier-1 (MV 0.55, arc); hold 600 ms → tier-2 (MV 0.95, wide arc). Costs 22 or 38 stamina |
| **Twin Daggers** | Frenzy mode: sustained hits build Frenzy; in Frenzy, recovery is 35% faster but stamina drains 14/s |
| **Mace** | Edge gauge: starts at 100, loses 8 per swing; below 20 → "blunt" mode (−50% poise damage) |
| **Spear** | Extended reach; can poke from outside enemy melee range |
| **Gauntlets** | Flow stacks (max 5): each hit adds a stack; stacks amplify damage multiplicatively, decay on miss |
| **Bow** | Charge shot available; consumes arrows |
| **Crossbow** | 900 ms reload between shots; bolts pierce up to 2 enemies |
| **Staff** | Fires fireballs (magic damage ×1.4) |
| **Tome** | Fires glyphs (magic damage, glyph pattern varies by tome) |

---

## Enemy combat

### Detection

| Condition | Range | Notes |
|---|---|---|
| Sight | 160 px (5 tiles) | Always active |
| Hearing | 360 px (11 tiles) | Only while player is **moving**; works through walls |
| Alert | 3× sight range | Persists 8 s after alarm trap or first hit |

> **Lurkers** ignore detection until the player is within 3.5 tiles — then spring at 1.6× speed for 2.8 s.

### Enemy attacks

| Constant | Value |
|---|---|
| `ENEMY_ATTACK_RANGE` | 50 px (slightly outside player melee range) |
| `ENEMY_ATTACK_COOLDOWN` | 900 ms |
| Telegraph flash | 620 ms (brutes: 900 ms) — your dodge window |

### Leash

If an alerted enemy gets more than **28 tiles** from the player it retreats home, partially restoring HP.

---

## Damage pipeline (P7+)

Each hit goes through `resolveHit(baseDmg, physType, element, body?, elemFamily?, hitzone?)`:

```
physPart  = baseDmg × PHYS_CHART[body][physType] × hitzone.rawMod
elemPart  = baseDmg × ELEM_CHART[elemFamily][element] × hitzone.elemMod
finalDmg  = (physPart×0.25 + elemPart×0.75) × variance(0.97–1.03)  [elemental]
finalDmg  = baseDmg × physMult × hzRawMod × variance                [pure phys]
```

Negative `elemMult` (−0.5) = ABSORB; heals target instead of hurting. Zero = IMMUNE.

### Physical type chart (PHYS_CHART)
| Body \ PhysType | slash | blunt | pierce |
|---|---|---|---|
| flesh | 1.0 | 0.9 | 1.1 |
| armored | 0.8 | 1.2 | 0.9 |
| bone | 0.8 | 1.3 | 0.7 |
| gelatinous | 0.5 | 1.1 | 1.3 |
| chitin | 1.0 | 0.8 | 1.2 |
| construct | 0.9 | 1.1 | 0.8 |
| ethereal | 0.7 | 0.6 | 0.8 |
| plant | 1.2 | 0.9 | 1.0 |
| aerial | 1.1 | 0.8 | 1.2 |

### Status-by-source table (P8)
| Source | Build-up | Notes |
|---|---|---|
| Slash weapons | bleed (+25) | Skip vs undead/construct/spectral |
| Blunt weapons | ko (+25, +37 if mace family) | Topple at 100 = 1500ms stun + 3s punish |
| Pierce weapons | wound (+25) | Skip vs gelatinous body |
| fire element | burn (+25, +38 vs plant) | |
| ice element | frostbite (+25) | Expires → frozen (1200ms stun) |
| lightning element | shock (+25, ×2 on wet) | |
| poison element | poison (+25, ×1.25 vs beast) | |
| void element | corruption (+25) | 2% maxHp DoT/s |
| radiant element | sear (+25) | 5 dmg/s, ignores def; queues blind on living |

### Elemental reactions
| Trigger | Reaction | Effect |
|---|---|---|
| fire + frozen/chill/frostbite | **Shatter** | 35 AoE flat dmg |
| blunt build + frozen | **Enhanced Shatter** | 55 AoE dmg (+30% with Frostward 5pc) |
| fire + shock | **Overload** | 25 AoE fire/lightning |
| ice/frostbite + shock | **Superconduct** | 15 dmg + 6s def debuff |

## Status effects (P8)

Build-up accumulates 0→100; triggers the full ailment at 100.

| Status | Source | Effect | Duration |
|---|---|---|---|
| **Poison** | poison weapons/elements | 3 dmg/s (50% def bypass) | 6 s |
| **Bleed** | slash weapons | 2–5 dmg/s (×2 while moving) | 8 s |
| **Burn** | fire element | 4 dmg/s (normal def) | 5 s |
| **Frostbite** | ice element | Ice slow; expires → Frozen | 6 s |
| **Frozen** | frostbite expire; ice direct | 1200ms full stun | 1.2 s |
| **Shock** | lightning element | Stagger 300ms every 1.5s | 6 s |
| **Stun** | heavy blunt | Brief hard stop | 3 s |
| **KO / Topple** | blunt weapons | 1500ms stagger + 3s punish window (+30% dmg) | 1.5 s |
| **Wound** | pierce weapons | +25% dmg taken while wounded | 12 s |
| **Sear** | radiant element | 5 dmg/s (bypasses def); queues Blind on living | 8 s |
| **Blind** | sear on living | Reduces enemy aggro range to 48px | 5 s |
| **Corruption** | void element | 2% maxHp/s DoT | 10 s |
| **Stuck** | Gel Cube engulf | Zero velocity until expiry | 4 s |
| **Wet** | water hazards | ×2 lightning build; quenches burn | 10 s |
| **Curse** | curse items | Permanent until chapel cleanse | permanent |

The player can also be inflicted by enemy status attacks (same thresholds apply).

---

## Skills

Each level grants 1 skill point to spend in your class skill tree. Skills persist in the save and are only lost on permadeath.

Press **K** in-game to open the skill menu.

---

## Meals (Camping)

Use a **Camp Kit** from inventory to open the camping interface. Choose ingredients from your inventory to cook a meal. Meals grant timed stat buffs that persist until the timer expires (even across floor transitions).

Each recipe requires **1× Ration** plus the listed material.

| Meal | Material | Effect | Duration |
|---|---|---|---|
| Hearty Stew | Dried Herb ×1 | +60 HP regeneration | 5 min |
| Spiced Skewers | Feather ×1 | +15% STR | 5 min |
| Iron Porridge | Iron Ore ×1 | +10% VIT | 5 min |
| Hunter's Tea | Arrow Shaft ×1 | +10% AGI | 5 min |
| Mage's Broth | Vial ×1 | +15% INT | 5 min |
| Trail Mix | Dried Herb ×2 | +10% DEX | 5 min |

Only one meal buff is active at a time. Cooking a second meal replaces the first.

---

## Movement

| Constant | Value |
|---|---|
| `PLAYER_SPEED` | 120 px/s |
| Net-slowed speed | 45.6 px/s (0.38×) |
| Diagonal speed | Same as cardinal (normalised) |

Standing still reduces enemy detection from 360 px (hearing) to 160 px (sight only). Staying still is a valid tactic in patrol-heavy areas.

**Spawn protection:** No damage can be taken for the first 1,000 ms on a new floor.

---

## Saving

The save format is a single JSON blob (`CharacterSave`) written to:
1. **localStorage** immediately (synchronous, key `nd_save_v1`)
2. **Supabase** after a 2-second debounce (async, graceful degradation)

**Account meta** is a second key (`nd_account_meta`) that never gets wiped.

### When saves happen
- On floor transition (warp pad step)
- On town transactions (shop purchase, inn rest)
- On bounty reward claim
- On gold change from enemy drops

### Save fields (CharacterSave)
| Field | Description |
|---|---|
| `version` | Save format version |
| `name` / `race` / `clazz` | Character identity |
| `level` / `exp` | Progression |
| `stats` | STR, DEX, INT, VIT, AGI, HP, MP |
| `currentHp` / `currentMp` | Current resources |
| `gold` | Currency |
| `inventory` | Array of `ItemInstance` (with rarity, affixes, sockets, upgrade level) |
| `equipped` | Map of slot → ItemInstance |
| `activeWeaponSlot` | Which weapon set is active (0 or 1) |
| `hasBag` | Whether the Adventure Bag is owned (unlocks full inventory) |
| `location` / `dungeonFloor` / `floorSeed` | Position in the world |
| `unspentStatPoints` / `unspentSkillPoints` | Pending level-up points |
| `unlockedSkills` | Array of skill IDs |
| `companions` | Active companion data |
| `activeMealBuff` | Current meal buff (stat, value, expiresAt) |
| `bossesSlain` | Boss IDs defeated this run |
| `activeBounties` | Bounty progress (id, progress, completed) |
| `enemiesKilled` / `enemyKillMap` | Kill tracking for bounties |
| `createdAt` | Run start timestamp |

### No Supabase configured?
The game falls back to localStorage-only mode silently.

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
TownScene ←───────────────────────────────────────────────┐
  └─ Dungeon Gate → FloorTransitionScene                  │
DungeonScene (per floor)                                  │
  └─ Warp pad → FloorTransitionScene → DungeonScene       │
  └─ Floor 10 warp ────────────────────────────────────→──┘
  └─ Player death → death screen → MainMenuScene (save wiped)
UIScene  (runs in parallel with Town/Dungeon, shows HUD)
```

---

## HUD

The persistent `UIScene` overlay shows:

| Element | Position | Data source |
|---|---|---|
| HP bar (red) | Top-left | `player.currentHp / maxHp` |
| MP bar (blue) | Below HP | `player.currentMp / maxMp` |
| Stamina bar (yellow) | Below MP | `player.stamina / 100` |
| Gold counter | Top-right | `player.gold` |
| Floor label | Top-centre | Current floor (hidden in town) |
| Level / XP | Top-right | Current level and XP bar |

---

## Controls

| Key | Action |
|---|---|
| WASD / Arrow keys | Move |
| Space | Light attack |
| Hold Space | Heavy attack (greatsword: charged) |
| Shift | Dodge roll |
| Hold guard key | Block (Tanker / shield equipped) |
| E | Interact (shop / inn / dungeon gate / NPCs) |
| Q / Escape | Close panel |
| K | Open skill menu |
| Tab | Open inventory |
| Enter | Confirm |
| Up / Down | Navigate menus |
