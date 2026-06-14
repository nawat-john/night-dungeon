# Monsters

> Source: `src/data/enemies.ts`, `src/data/bosses.ts`, `src/data/anomalies.ts`, `src/entities/Enemy.ts`, `src/config.ts`

---

## AI Archetypes

Each enemy has an **archetype** that determines its combat behaviour.

| Archetype | Behaviour |
|---|---|
| **Chaser** | Pathfinds directly to the player and hits at melee range |
| **Skirmisher** | Approaches, strikes once, then retreats 1.3 s before re-engaging — forces you to chase or take burst damage |
| **Ranged** | Maintains minimum distance, telegraphs, fires a projectile |
| **Charger** | Closes distance, telegraphs a windup (~620 ms flash), then dashes in a straight line at 3.2× speed |
| **Caster** | Channels an AoE zone (visible circle on the floor) for ~900 ms — step out before it detonates |
| **Swarm** | Small, fast, numerous — spawns in clusters of 2–4; individually weak but stacks pressure |
| **Support** | Stays near allies, heals the most-injured enemy within 8 tiles every ~3.2 s; kill first |
| **Brute** | Super-armored (higher poise threshold), slow, longer windup (900 ms), heavy damage — punishes whiffed dodges |

### Telegraph (anticipation frames)
Before every attack, enemies enter a **telegraph state**: they stop and flash orange for 620 ms (brutes: 900 ms). This is your dodge window.

### Detection rules

| Condition | Range | Notes |
|---|---|---|
| Sight | 160 px (5 tiles) | Always active |
| Hearing | 360 px (11 tiles) | Only while the player is **moving**; works through walls |
| Alert | 3× sight range | Persists 8 s after alarm trap or first hit |

> **Lurkers** ignore detection until the player is within 3.5 tiles — then they spring at 1.6× speed for 2.8 s.

### Leash range
If an alerted enemy gets more than **28 tiles** from the player, it gives up the chase and walks home, partially restoring HP on arrival.

---

## Elite & Champion Modifiers

Normal enemies have an 8–20% chance (scales with floor) to roll as an **Elite** with one affix. A smaller subset become **Champions** (2–3 affixes, 3× HP, champion HP bar, guaranteed rare material drop).

Champions trigger a **Part Break** at 50% HP: 1.2 s stagger + gold burst VFX.

### Elite chance by floor

| Floor | Elite chance | Champion chance |
|---|---|---|
| 1 | 9.2% | 1.4% |
| 5 | 14% | 2.1% |
| 10 | 20% | 3% |

### Elite affixes

| Affix | Aura color | Effect |
|---|---|---|
| **Vampiric** | Red | Heals 8% of damage dealt |
| **Frenzied** | Orange | +40% move speed |
| **Armored** | Silver | −30% incoming damage |
| **Volatile** | Purple | Explodes on death — 56 px radius, 1.2× melee damage |
| **Stormtouched** | Blue | Attacks apply Lightning Shock build-up |
| **Toxic** | Green | Attacks apply Poison build-up |
| **Shielded** | White | First 30% HP is an ablative shield — must be burned through first |
| **Hasted Aura** | Yellow | Nearby allies within 6 tiles gain +40% speed |
| **Warded** *(P10)* | Cyan | Elemental attacks deal −30% damage (forces weapon swap or elemental infusion) |
| **Unstable Core** *(P10)* | Magenta | Cycles a weakness element every 5 s; that element deals +50% — read and react |
| **Bloodgorged** *(P10)* | Dark Red | Heals from all Bleed ticks applied by the player — do not slash it |

---

## Monster Identity (P10)

Each enemy has a one-line **identity** (what makes it scary), a **signature** mechanic, and a **counter** — the intended player answer. Weaknesses and counters are revealed through the **Research / Bestiary** system.

---

## Floor-by-Floor Bestiary

Columns: **Body** (phys chart) · **Family** (elem chart) · **Counter** (revealed at Research Lv2)

> For full elemental multiplier tables see [Mechanics → Elemental family chart](mechanics.md). Key highlights: aquatic = ×2 lightning; fire-family absorbs fire (−0.5×); undead = ×2 radiant; **storm** absorbs lightning (−0.5×) and is weak to fire+ice (×1.5).

### Floor 1 — Ruined Entrance

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Goblin | Chaser | 165 | 32 | flesh | beast | Spread them apart; bleed/poison |
| Goblin Shaman | Ranged | 126 | 48 | flesh | beast | Kill first — stops pack heals |
| Cave Bat | Swarm | 78 | 24 | aerial | beast | Wide-arc sweep or AoE |
| Cave Slime | Brute | 480 | 55 | gelatinous | beast | Slash to split; fire for bonus |

### Floor 2 — Flooded Halls / Biome Areas

Floor 2 spans 5 biome themes (Flooded, Forest, Deadland, Pond, Rock) across a doubled map.

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Drowned | Chaser | 300 | 55 | flesh | aquatic | Lightning while it's Wet |
| Reed Lurker | Chaser | 220 | 65 | flesh | aquatic | AoE to flush from reeds |
| Toad Caster | Caster | 180 | 70 | flesh | aquatic | Interrupt 900ms cast |
| **Bog Witch** *(new)* | Caster | 220 | 65 | flesh | beast | Interrupt hex; swap element |
| **Gel Cube** *(new)* | Brute | 750 | 45 | gelatinous | aquatic | Slash to free Stuck; lightning if wet |
| Treant | Brute | 480 | 55 | plant | plant | Fire + keep moving |
| Forest Wisp | Ranged | 200 | 40 | ethereal | spectral | Elemental weapon (void/radiant) |
| Vine Snare | Support | 600 | 35 | plant | plant | Kill first or fire element |
| Ghoul | Skirmisher | 300 | 60 | flesh | undead | Punish the retreat gap |
| Wraith | Skirmisher | 240 | 55 | ethereal | spectral | Void or radiant; materialize window |
| Bone Golem | Brute | 720 | 65 | bone | undead | Blunt vs skull; radiant |
| Frog Warrior | Chaser | 360 | 50 | flesh | aquatic | Lightning on the Wet puddle |
| Swamp Slug | Brute | 800 | 30 | gelatinous | aquatic | Pierce the eyestalk |
| Water Serpent | Skirmisher | 280 | 65 | flesh | aquatic | AoE to interrupt strafe orbit |
| Rock Crab | Brute | 660 | 45 | chitin | insect | Pierce the underbelly from behind |
| Stone Imp | Ranged | 210 | 55 | construct | construct | Rush before it screech-alarms |
| Cave Drake | Charger | 540 | 70 | flesh | fire | Ice weapon; punish after charge |

### Floor 3 — Fungal Depths

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Spore Brute | Brute | 600 | 80 | plant | plant | Break cap or fire; poison resist |
| Myconid | Support | 280 | 40 | plant | plant | Kill first; fire if ranged |
| Fungal Spider | Chaser | 240 | 55 | chitin | insect | AoE burst before sacs activate |
| **Ironback Beetle** *(new)* | Brute | 480 | 60 | chitin | insect | Pierce from behind; break underbelly |
| **Plague Hound** *(new, swarm)* | Swarm | 140 | 50 | flesh | beast | Panacea / Cleansing Tonic; fire AoE |

### Floor 4 — Old Barracks

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Skeleton Soldier | Chaser | 400 | 70 | bone | undead | Blunt from behind; radiant |
| Crossbow Wight | Ranged | 300 | 90 | bone | undead | Close gap fast |
| Shield Revenant | Brute | 700 | 60 | armored | undead | Circle to the back |
| **Mirror Knight** *(new)* | Brute | 480 | 75 | armored | undead | Melee only — reflects projectiles |

### Floor 5 — Ashen Foundry

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Ember Hound | Charger | 420 | 100 | flesh | fire | Ice weapon; dodge both charges |
| Forge Golem | Brute | 900 | 110 | construct | fire | Ice on furnace hitzone |
| Cinder Mage | Caster | 320 | 90 | flesh | fire | Interrupt cast or dodge the ring |
| **Sand Lurker** *(new)* | Chaser | 380 | 105 | chitin | insect | Detector Charm / Sonic Bomb; fire flush |

### Floor 6 — Frozen Reliquary

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Frost Wolf | Swarm | 280 | 65 | flesh | ice | Fire splash on the pack |
| Ice Archer | Ranged | 360 | 95 | flesh | ice | Charge inside 120px range |
| Glacial Knight | Brute | 1,100 | 120 | armored | ice | Break visor first; then fire |
| **Storm Elemental** *(new)* | Ranged | 600 | 95 | construct | storm | **Never** use lightning — switch to fire/ice |

### Floor 7 — Shadowed Catacombs

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Wraith Shade | Skirmisher | 450 | 100 | ethereal | spectral | Vary dodge timing; void/radiant |
| Bone Colossus | Brute | 1,400 | 140 | bone | undead | Blunt on ribcage; dodge shockwave |
| Cultist | Support | 380 | 70 | flesh | void | Interrupt death-channel |
| **Choir Acolyte** *(new)* | Support | 320 | 55 | bone | undead | Radiant interrupts resurrection chant |
| **Living Armor** *(new)* | Brute | 1,200 | 130 | construct | undead | Only the gemstone takes damage — pierce/radiant |
| **Gravetide** *(new, swarm)* | Swarm | 180 | 65 | flesh | undead | Destroy the spawner-crypt first |

### Floor 8 — Voidtouched Caverns

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Void Spawn | Swarm | 320 | 75 | ethereal | void | Radiant splash; close rifts |
| Riftling | Skirmisher | 520 | 110 | flesh | void | Seal pockets with radiant |
| Maw | Chaser | 900 | 150 | flesh | void | Sonic Bomb to reveal; radiant element |
| **Rift Wisp** *(new)* | Skirmisher | 280 | 85 | ethereal | void | Radiant to force materialization |

### Floor 9 — The Ascended Court

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Fallen Knight | Chaser | 800 | 130 | armored | undead | Fire or radiant; dodge charge |
| Arcane Sentinel | Caster | 600 | 140 | construct | construct | Break antenna first; then anything |
| Echo Shade | Skirmisher | 650 | 120 | ethereal | spectral | Switch weapon before it mirrors |

### Floor 10 — Throne Approach

| Enemy | Archetype | HP | Dmg | Body | Family | Counter |
|---|---|---|---|---|---|---|
| Iron Guardian | Brute | 1,600 | 160 | construct | construct | Blunt on power core; then lightning |
| Shadow Herald | Skirmisher | 750 | 145 | flesh | void | Kill before mark locks (3s) |
| Void Herald | Caster | 650 | 155 | flesh | void | Kill before gate opens (900ms) |

### Cave pool (global filler)

These Cave-theme enemies fill ambient spawns from their `floorMin` onward:

| Enemy | Archetype | HP | Dmg | Body | Family | floorMin |
|---|---|---|---|---|---|---|
| Rock Spider | Chaser | 174 | 40 | chitin | insect | 2 |
| Skeleton | Chaser | 285 | 56 | bone | undead | 3 |
| Stone Golem | Brute | 630 | 76 | construct | construct | 5 |
| Cave Troll | Brute | 435 | 92 | flesh | beast | 7 |
| **Aurelion** *(new, rare)* | — | 600 | 0 | flesh | beast | 1 |

> **Aurelion** is a radiant stag that flees on sight. Tracking it across 3 floors without killing it rewards a Radiant infusion material.

---

## Boss Roster

Each boss has a unique procedural pixel-art sprite (keyed `boss_<id>` in the texture atlas). The HP bar at the top of the screen shows the boss name, current HP, and part-break pips.

| Floor | Boss | ID | HP | Phases | Enrage HP% |
|---|---|---|---|---|---|
| 1 | Goblin Warlord | `goblin_warlord` | 1,500 | 2 (adds charge+summon at 50%) | 20% |
| 2 | The Drowned King | `drowned_king` | 2,800 | 2 (adds grab+multi-proj at 50%) | 20% |
| 3 | Brood Matron | `brood_matron` | 3,500 | 2 (adds summon+grab at 50%) | 20% |
| 4 | Sir Mordrek | `sir_mordrek` | 4,200 | 2 (adds multi-proj+grab at 50%) | 20% |
| 5 | Forgefather Brand | `forgefather_brand` | 5,500 | 2 (arena ignites at 40%) | 20% |
| 6 | Frost Warden Ysold | `frost_warden_ysold` | 7,000 | 2 (blizzard arena at 45%) | 20% |
| 7 | The Hollow Choir | `hollow_choir` | 8,500 | 2 (choir merge at 50%) | 20% |
| 8 | Riftmaw | `riftmaw` | 10,000 | 2 (rift tears at 40%) | 20% |
| 9 | The Ascendant Twins | `twin_aeriel` + `twin_mordael` | 6,500+6,500 | 2 each (enrage at 15%) | 15% |
| 10 | The Sovereign | `the_sovereign` | 15,000 | 3 (phase 2 at 70%, phase 3 at 40%) | — |
| 11 | Dungeon Heart | `dungeon_heart` | — | Post-sovereign secret encounter | — |

### Break parts

Each boss has 2 breakable parts (The Sovereign has 4). Breaking a part at the cumulative damage threshold drops extra loot and disables a boss attack.

**Goblin Warlord:** Club Arm (600 dmg → disables heavy), War Helm (1,050 dmg)  
**The Drowned King:** Crown (840 dmg), Trident (1,680 dmg → disables multi-projectile)  
**Brood Matron:** Fangs (1,050 dmg → disables grab), Abdomen (2,100 dmg → disables summon)  
**Sir Mordrek:** Shield (1,260 dmg → disables heavy), Helm (2,940 dmg)  
**Forgefather Brand:** Core (1,650 dmg → disables AoE zone), Arms (3,300 dmg → disables multi-proj)  
**Frost Warden Ysold:** Antlers (2,100 dmg → disables multi-proj), Ice Heart (4,200 dmg → disables grab)  
**The Hollow Choir:** First Mask (2,550 dmg), Second Mask (5,950 dmg → disables summon)  
**Riftmaw:** Left Eye (3,000 dmg → disables grab), Maw (6,500 dmg → disables summon)  
**The Ascendant Twins:** Aeriel's Weapon Arm (1,950 dmg → disables heavy), Mordael's Weapon Arm (1,950 dmg → disables AoE)  
**The Sovereign:** Left Arm (3,000) / Right Arm (5,500) / Core (9,000) / Crown (12,000)

---

## Ambient Spawning

Every **22 seconds**, 1–3 enemies from the **current floor's themed pool** spawn outside your field of view, 8–22 tiles away. The dungeon is never safe to stand still in.

---

## Anomaly Enemies

When an anomaly activates, it may spawn special enemies prefixed with `anom_`. These **do not count toward bounty kill-tracking**.

| Anomaly | Spawns |
|---|---|
| Dimensional Rift | Themed enemies from a different floor |
| Mirror Rift | Shadow copy of the player character |
| The Gravelord | Reanimating undead lord + skeleton thralls |
| The Hunter | Unkillable pursuer (cannot be killed, only fled) |
| Blood Moon | All existing floor enemies gain +30% speed/damage |
| Echo of a Fallen Hero | Ghost version of one of your past run characters |
| Beast Stampede | Large pack of floor-appropriate swarm enemies |

---

## Research / Bestiary (P10)

Killing and breaking parts builds **Research Level** (0→3) for each enemy. Research persists on your **Account** — it survives permadeath. Your next run starts smarter.

| Research Lv | Unlocked in Bestiary | Kill/break threshold |
|---|---|---|
| 0 | Name only (silhouette in UI) | 0 |
| 1 | HP/dmg bands, archetype, body type | 5 combined kills |
| 2 | Physical & elemental weakness grid, status vulnerabilities, counter hint | 15 combined kills |
| 3 | Hitzone map, break reward table, drop table, lore blurb | 30 combined kills |

> Part-breaks count **2×** toward research score. Break a boss part → 2 free research points.

A **✦ Research Lv{n}: {Enemy Name}!** toast pops on the kill that ranks you up.

### Accessing the Bestiary

Open the **Adventurer's Guild** in town → **BESTIARY** tab. Entries are sorted by research level, then kill count. Enemies you have never fought do not appear.

### Research and gameplay synergies (P11)

- **Archer capstone "Hunter's Eye"**: Research Lv of the target adds bonus damage.
- **Sage capstone "Convergence"**: element reactions on a researched foe hit harder.
- **Boss Phase weakness (Bosses 2.0)**: At Research Lv2 on a boss, the HUD shows its current phase weakness — earned knowledge, not a given.

---

## Encounter Tips

| Situation | Advice |
|---|---|
| Orange flash on enemy | Telegraph! Dodge immediately — you have ~620 ms |
| Caster placing a glowing circle | The AoE fires after ~900 ms; step out of the ring |
| Charger winding up | Side-step — it dashes in a straight line |
| Swarm cluster | AoE consumable or back into a corridor chokepoint |
| Support nearby | Kill the support first — it can reverse all your poise damage |
| Gold aura on enemy | Champion — expect 3× HP and 2–3 affixes; dodge more aggressively |
| Red aura | Vampiric Elite — don't trade hits; burst it down |
| Purple aura | Volatile — back off before it dies or you eat the explosion |
| Leashing enemy | It's going home; follow for an easy finish, or let it regen and avoid |
| Boss enrage (20% HP) | Increase spacing; boss gains speed and damage multipliers |
| Break part indicator | Focus damage on the glowing body part to disable that attack |
