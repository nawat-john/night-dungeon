# Characters

> Source: `src/data/races.ts`, `src/data/classes.ts`, `src/config.ts`, `src/entities/Player.ts`

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

**Weapon family:** Sword — light/heavy combo, parry stance  
**Attack type:** Melee (arc hits all enemies within ~42 px in front)  
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

**Weapon family:** Bow — fires arrows, can charge for power shot  
**Attack type:** Arrow (projectile, 220 px/s, disappears on first hit or 1.5 s)  
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

**Weapon family:** Mace — heavy stagger-focused swings  
**Attack type:** Melee  
**Special:** Can Guard/Block with a shield equipped (hold Space + direction); perfect-block window 100 ms  
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

**Weapon family:** Twin Daggers — rapid hits, Frenzy mode on sustained combat  
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

**Weapon family:** Staff / Tome — fires fireballs or glyphs  
**Attack type:** Fireball (140 px/s, 1.4× INT damage multiplier)  
**Starting gear:** Staff, Robe, ×3 Mana Potion, Fireball Tome

---

## Stat formulas

| Derived value | Formula |
|---|---|
| Max HP | `class HP + race HP modifier` |
| Max MP | `class MP` |
| Max Stamina | 100 (flat, all classes) |
| Physical Attack | `max(6, STR × 3 + DEX) × weapon MV` |
| Magic Attack | `max(6, STR × 3 + DEX) × 1.4` (Sage fireball) |
| Crit Chance | `3% base + AGI × 0.6%` |
| Crit Damage | `135%` of normal damage |
| Stamina Regen | 18/s (delayed 600 ms after last spend) |

### Weapon MV (Motion Value)
Light attacks fire at **MV 0.32**; heavy attacks fire at **MV 0.55**.

---

## Level system

| Mechanic | Value |
|---|---|
| Level cap | 50 |
| XP to level | `50 × level^1.6` (rounded) |
| Stat points per level | +5 to distribute |
| Skill points per level | +1 (used in skill trees) |

XP at level 10 ≈ 2,000; level 20 ≈ 6,100; level 30 ≈ 12,300; level 50 ≈ 28,600.

The XP curve is intentionally slow — **out-skill, not out-grind** is the design goal.

---

## Skills (P11)

Each class has a dedicated skill tree unlocked via skill points. Skills persist on the save and are lost only on permadeath. Open the skill menu with **K** in-game.

Each tree has **3 branches × 4 tiers** plus a **capstone** (~50 skill points to fully unlock by Lv50).

### Swordman — Blade / Guard / Tempo
| Branch | Notable skills |
|---|---|
| **Blade** | +slash MV per tier; 3rd-light combo attack; Bleed-on-crit (T3); *Crescent Lunge* art (T4) |
| **Guard** | Faster Riposte window; chip immunity; *Bulwark* (2s omni-guard); counter-stagger on perfect guard |
| **Tempo** | Roll-cancel heavies; +stamina regen; *Momentum* (no-hit streak → +ATK); perfect-dodge → cooldown refund |
| **Capstone** | **Perfect Tempo** — perfect dodge resets one skill cooldown |

### Archer — Precision / Volley / Survival
| Branch | Notable skills |
|---|---|
| **Precision** | +weakpoint dmg; charged-shot crit; *Mark* (tagged target +15%); *Deadeye* (charged weakpoint = part-break) |
| **Volley** | Multishot spread; *Rain of Arrows*; ricochet; +ammo retention |
| **Survival** | Backstep-shot; move-while-aiming; *Trap Arrow*; +i-frames |
| **Capstone** | **Hunter's Eye** — Research Lv of target adds bonus dmg (×5% per Research Lv) |

### Tanker — Aegis / Provoke / Impact
| Branch | Notable skills |
|---|---|
| **Aegis** | +block%; perfect-guard window; reflect chip; *Iron Stance* (immovable 3s) |
| **Provoke** | AoE *Taunt*; threat mult; *Last Stand* (<25% HP → +DEF); aggro-heal |
| **Impact** | +KO build; *Shield Bash* (stun); *Ground Slam* (AoE topple); KO topple bonus dmg |
| **Capstone** | **Immovable** — no knockback; perfect guard → stagger shockwave |

### Assassin — Shadow / Venom / Flow
| Branch | Notable skills |
|---|---|
| **Shadow** | Longer stealth; +backstab crit; vanish-on-kill; *Death Mark* execute |
| **Venom** | Poison/bleed on crit; +dmg vs ailing; *Rupture* (detonate stacks for burst); spread-on-kill |
| **Flow** | +dodge i-frames; *Frenzy* uptime; dash-attack reset on kill; +crit dmg |
| **Capstone** | **Lethality** — crits on wounded hitzones can instakill non-elite enemies |

### Sage — Elements / Glyph / Mysticism
| Branch | Notable skills |
|---|---|
| **Elements** | +magic MV; element swap stance; lingering ground hazard; *Meteor* |
| **Glyph** | Place runes; chain detonations; slow/heal zones; *Glyph Storm* |
| **Mysticism** | MP efficiency; shields/heals (companions); *Cleanse*; *Mana Shield* |
| **Capstone** | **Convergence** — detonating two elements on one target triggers a large combined reaction |

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

## Starting damage reference

| Class | Race | Final STR | Final DEX | Base ATK (light MV 0.32) |
|---|---|---|---|---|
| Swordman | Human | 11 | 9 | `max(6,11×3+9)×0.32 = 12.8` |
| Archer | Elf | 7 | 14 | `max(6,7×3+14)×0.32 = 11.5` |
| Tanker | Dwarf | 12 | 5 | `max(6,12×3+5)×0.32 = 13.1` |
| Assassin | Beastman | 7 | 14 | `max(6,7×3+14)×0.32 = 11.5` |
| Sage | Elf | 4 | 8 | `max(6,4×3+8)×1.4 = 28` fireball |

---

## Suggested builds (beginner)

| Build | Race | Class | Why |
|---|---|---|---|
| Safest start | Dwarf | Tanker | 176 HP, 5 potions, guard/block — survives rookie mistakes |
| High damage | Barbarian | Swordman | 150 HP, STR 12 → strong light combos |
| Ranged safety | Elf | Archer | DEX 14, can kite most enemies |
| Glass cannon | Elf | Sage | INT 16 → massive fireball damage, dies in 2 hits |

---

## Companions

At the **Adventurer's Guild** in town you can hire up to **2 companions** (Tanker, Archer, or Sage role). Companions follow you into the dungeon, fight alongside you, and use potions automatically.

| Stat | Description |
|---|---|
| HP | Companion's health pool |
| Potions | Auto-uses when HP < 40% |
| Fatigue | Increases each floor; companions refuse to descend above 80 fatigue |
| Affinity | Increases when they land killing blows; unlocks banter lines |

In **normal mode**: companions retreat when HP hits 0, then fully restore HP and potions when you return to town. Fatigue decreases by 1 each town visit (and resets at the Inn).

In **hardcore companion mode** (toggle in Guild → Companions): companions can die permanently. Any companion whose HP reaches 0 is gone forever.

### Companion commands

Press **TAB** in the dungeon to cycle the active companion's command:

| Command | Behaviour |
|---|---|
| Follow | Stays near the player; attacks anything in range |
| Aggressive | Pursues the nearest enemy independently |
| Defensive | Guards the player; only attacks enemies that hit you |
| Focus | Attacks the player's current target |
| Hold | Stays in place; attacks only things that come to them |
| Regroup | Returns to player's position immediately |

---

## Specializations (P11)

At the **Floor 4 boss kill**, you choose a permanent specialization for the rest of this run. Respec is not available mid-run (Sage's Tower respec costs materials and can be used between runs only).

| Specialization | Bonus |
|---|---|
| **Slayer** | +20% damage vs one chosen body type |
| **Elementalist** | +25% all elemental damage (slight raw physical reduction) |
| **Berserker** | Lifesteal on hit; +damage at ≤30% HP |
| **Sentinel** | Improved guard/parry windows; reflect chip on perfect guard |
| **Trapper** | Throwables and deployables deal +40% effect |

---

## Weapon Masteries (P11)

Weapon mastery levels (0–5) are tracked per **family** in **account meta** and survive permadeath.

| Mastery Lv | Passive |
|---|---|
| 1 | +2% base ATK with this family |
| 2 | +1 combo window extension |
| 3 | +5% crit chance with this family |
| 4 | +8% DMG vs body types this family naturally hits well |
| 5 | Unique capstone passive per family |

---

## Run Modifiers (P12)

Toggle at character creation. Harder modifiers → better loot weight and bonus bounty gold.

| Modifier | Key | Effect |
|---|---|---|
| **Ironbound** | I | Warp Crystals and Recall Stones are disabled |
| **Starved** | S | All healing −50% |
| **Hunted** | H | Hunter anomaly appears earlier/more often |
| **Blackout** | B | FOV radius reduced to 3 tiles |
| **Glass** | G | Take ×2 damage; deal ×1.5 damage |
| **Wrongfooted** | O | Enemy elemental weaknesses hidden even at Research Lv2 |
| **Masochist** | M | Equipment durability + inventory weight limit active |
