# Items

> Source: `src/data/items.ts`, `src/scenes/TownScene.ts`

---

## Item types

| Type | Description |
|---|---|
| `weapon` | Equips to **mainhand** slot; determines attack type and contributes to ATK formula |
| `armor` | Equips to **body** or **offhand** slot |
| `consumable` | Single-use; effect applied immediately (potions, bombs) |
| `ammo` | Stackable resource consumed by ranged attacks |
| `tome` | Unlocks a spell or ability |

---

## Weapons

| ID | Name | Slot | Class(es) |
|---|---|---|---|
| `short_sword` | Short Sword | mainhand | Swordman |
| `short_bow` | Short Bow | mainhand | Archer |
| `mace` | Mace | mainhand | Tanker |
| `twin_daggers` | Twin Daggers | mainhand | Assassin |
| `staff` | Staff | mainhand | Sage |

> Currently weapons contribute to the attack-damage formula indirectly via class STR/DEX stats. Direct weapon damage values are not yet implemented (P6 polish).

---

## Armor

| ID | Name | Slot | Notes |
|---|---|---|---|
| `leather_armor` | Leather Armor | body | Standard light armor |
| `light_leather` | Light Leather | body | Assassin variant |
| `chainmail` | Chainmail | body | Tanker starting armor |
| `robe` | Robe | body | Sage only |
| `round_shield` | Round Shield | offhand | Tanker starting offhand |

> Defense values are not yet implemented; armor is tracked in inventory for future use.

---

## Consumables

| ID | Name | Effect |
|---|---|---|
| `health_potion` | Health Potion | Restores HP (amount TBD — use at inn for now) |
| `mana_potion` | Mana Potion | Restores MP |
| `smoke_bomb` | Smoke Bomb | (Effect TBD — Assassin special) |

---

## Ammo

| ID | Name | Notes |
|---|---|---|
| `arrow` | Arrow | Consumed by Archer attacks (infinite stack in current implementation) |

---

## Tomes

| ID | Name | Notes |
|---|---|---|
| `fireball_tome` | Fireball Tome | Grants Sage the fireball attack type |

---

## Shop prices

### Weapon Shop (Town, west building)

| Item | Buy price |
|---|---|
| Iron Sword | 80 g |
| Steel Bow | 100 g |
| Enchanted Staff | 120 g |

### Item Shop (Town, east building)

| Item | Buy price |
|---|---|
| Health Potion | 15 g |
| Mana Potion | 20 g |
| Smoke Bomb | 10 g |

### Inn (Town, central building)

| Service | Cost |
|---|---|
| Full HP + MP restore | 30 g |

---

## Starting equipment by class

| Class | Gear |
|---|---|
| Swordman | Short Sword, Leather Armor, ×3 Health Potion |
| Archer | Short Bow, Arrow ×1, Leather Armor, ×3 Health Potion |
| Tanker | Mace, Round Shield, Chainmail, ×5 Health Potion |
| Assassin | Twin Daggers, Light Leather, ×3 Health Potion, ×2 Smoke Bomb |
| Sage | Staff, Robe, ×3 Mana Potion, Fireball Tome |

---

## Gold

Gold is the only currency. You earn it by killing enemies (see [Monsters](monsters.md) for per-enemy ranges). Gold persists across floors and is saved on floor transition.

On **permadeath**, the save record (including all gold) is permanently deleted.
