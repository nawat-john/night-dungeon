# Characters

> Source: `src/data/races.ts`, `src/data/classes.ts`

---

## Races

Choose your race first. Each race changes your base stats and **restricts which classes you can pick**.

| Race | STR | DEX | INT | VIT | AGI | HP | Available Classes |
|---|---|---|---|---|---|---|---|
| **Human** | +1 | +1 | +1 | +1 | +1 | — | All five |
| **Elf** | — | +2 | +2 | −1 | — | — | Swordman, Archer, Assassin, Sage |
| **Dwarf** | +2 | — | — | +2 | −2 | — | Swordman, Tanker, Sage |
| **Barbarian** | +2 | — | −2 | — | — | +30 | Swordman, Archer, Tanker |
| **Beastman** | — | +2 | −2 | — | +2 | — | Swordman, Archer, Tanker, Assassin |

Race modifiers stack on top of class base stats at character creation.

---

## Classes

### Swordman
> Balanced melee fighter. Reliable in most situations.

| Stat | Value |
|---|---|
| HP | 120 |
| MP | 30 |
| STR | 10 |
| DEX | 8 |
| INT | 4 |
| VIT | 10 |
| AGI | 7 |

**Attack type:** Melee (sword arc, hits all enemies within ~42 px in front)  
**Starting gear:** Short Sword, Leather Armor, ×3 Health Potion

---

### Archer
> Ranged DPS. Stays at distance; fragile up close.

| Stat | Value |
|---|---|
| HP | 100 |
| MP | 30 |
| STR | 7 |
| DEX | 12 |
| INT | 5 |
| VIT | 8 |
| AGI | 10 |

**Attack type:** Arrow (projectile, travels until hitting an enemy or leaving the map)  
**Starting gear:** Short Bow, Arrow ×1 stack, Leather Armor, ×3 Health Potion

---

### Tanker
> High HP, high defense. Slow but can absorb punishment.

| Stat | Value |
|---|---|
| HP | 160 |
| MP | 20 |
| STR | 10 |
| DEX | 5 |
| INT | 3 |
| VIT | 14 |
| AGI | 5 |

**Attack type:** Melee  
**Starting gear:** Mace, Round Shield, Chainmail, ×5 Health Potion

---

### Assassin
> Burst damage, high AGI. Must strike first; cannot take many hits.

| Stat | Value |
|---|---|
| HP | 90 |
| MP | 30 |
| STR | 7 |
| DEX | 12 |
| INT | 5 |
| VIT | 7 |
| AGI | 14 |

**Attack type:** Melee  
**Starting gear:** Twin Daggers, Light Leather, ×3 Health Potion, ×2 Smoke Bomb

---

### Sage
> Low HP, high MP and INT. Destroys enemies at range but dies instantly if cornered.

| Stat | Value |
|---|---|
| HP | 80 |
| MP | 100 |
| STR | 4 |
| DEX | 6 |
| INT | 14 |
| VIT | 6 |
| AGI | 7 |

**Attack type:** Fireball (area-effect projectile, 1.4× INT damage multiplier)  
**Starting gear:** Staff, Robe, ×3 Mana Potion, Fireball Tome

---

## Stat formulas

| Derived value | Formula |
|---|---|
| Attack damage | `max(6, STR × 3 + DEX)` |
| Max HP | `class HP + race HP modifier` |
| Max MP | `class MP` (race has no MP modifier currently) |

> Sage fireball deals `attackDmg × 1.4` rounded to nearest integer.

---

## Race × Class combinations

|  | Swordman | Archer | Tanker | Assassin | Sage |
|---|---|---|---|---|---|
| Human | ✓ | ✓ | ✓ | ✓ | ✓ |
| Elf | ✓ | ✓ | — | ✓ | ✓ |
| Dwarf | ✓ | — | ✓ | — | ✓ |
| Barbarian | ✓ | ✓ | ✓ | — | — |
| Beastman | ✓ | ✓ | ✓ | ✓ | — |

---

## Suggested builds (beginner)

| Build | Race | Class | Why |
|---|---|---|---|
| Safest start | Dwarf | Tanker | 176 HP, 5 potions — survives rookie mistakes |
| High damage | Barbarian | Swordman | 150 HP, STR 12 → 44 ATK at creation |
| Ranged safety | Elf | Archer | DEX 14, can kite most enemies |
| Glass cannon | Elf | Sage | INT 16 → massive fireball, dies in 2 hits |
