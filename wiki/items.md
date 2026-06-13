# Items

> Source: `src/data/items.ts`, `src/scenes/ArmoryScene.ts`, `src/scenes/EmporiumScene.ts`, `src/scenes/TownScene.ts`

---

## Item types

| Type | Description |
|---|---|
| `weapon` | Equips to **mainhand** slot; determines attack type, family, and base attack |
| `armor` | Equips to **head / chest / hands / legs / boots / offhand** slots |
| `consumable` | Single-use; effect applied immediately |
| `ammo` | Stackable resource consumed by ranged attacks |
| `tome` | Unlocks a spell or ability |
| `material` | Crafting/upgrade ingredient; can be sold |
| `bag` | Unlocks the full inventory grid when acquired |
| `jewel` | Slots into gear sockets to grant bonuses (Armory socketing UI, P12) |

---

## Equipment slots

| Slot | Accepts |
|---|---|
| `mainhand` | Weapons |
| `offhand` | Shield, off-hand weapon |
| `weapon2` | Second weapon set (swap with main via hotkey) |
| `head` | Helmets |
| `chest` | Chest armors |
| `hands` | Gauntlets |
| `legs` | Greaves |
| `boots` | Boots |
| `amulet` | Amulets |
| `ring1` / `ring2` | Rings |
| `charm` | Charms |

---

## Rarity & affixes

Every dropped equipment piece rolls a **rarity** and, at uncommon+, random **affixes**.

| Rarity | Affix count | Drop colour |
|---|---|---|
| Common | 0 | Grey |
| Uncommon | 1 | Green |
| Rare | 2 | Blue |
| Epic | 3 | Purple |
| Legendary | 4 | Gold |
| Mythic | 4+ (special) | Red |

Each affix is either `flat` (adds a fixed value to a stat) or `percent` (multiplies a stat). Affixes can target any stat: attack, defense, HP, STR, DEX, INT, VIT, AGI, crit chance, and more.

Items can also have **sockets** (max 2) for rune insertion, and an **upgrade level** (max 5) raised at the Armory.

---

## Starting / base weapons

| ID | Name | Family | Atk | Wt | Sell |
|---|---|---|---|---|---|
| `short_sword` | Short Sword | Sword | 10 | 3 | 10 g |
| `longsword` | Long Sword | Sword | 14 | 4 | 15 g |
| `greatsword` | Greatsword | Greatsword | 20 | 8 | 20 g |
| `twin_daggers` | Twin Daggers | Twin Daggers | 8 | 2 | 12 g |
| `mace` | Mace | Mace | 12 | 6 | 14 g |
| `spear` | Spear | Spear | 13 | 5 | 13 g |
| `gauntlets` | Gauntlets | Gauntlets | 9 | 2 | 10 g |
| `short_bow` | Short Bow | Bow | 11 | 3 | 12 g |
| `crossbow` | Crossbow | Crossbow | 15 | 5 | 15 g |
| `staff` | Staff | Staff | 12 | 4 | 14 g |
| `focus_tome` | Focus Tome | Tome | 10 | 2 | 15 g |
| `fireball_tome` | Fireball Tome | Tome | — | 1 | 18 g |

---

## Tiered weapons (700 total)

### Pure (non-elemental) — 100 items
Ten weapon families × ten material tiers. Formula: `baseAttack = 5 + tier × 6`, `weight = 2 + floor(tier × 1.2)`, `sell = tier × 15 g`. ID: `{family}_t{tier}`.

| Tier | Material | Example (Sword) | Atk |
|---|---|---|---|
| 1 | Iron | Iron Sword | 11 |
| 2 | Bronze | Bronze Sword | 17 |
| 3 | Steel | Steel Sword | 23 |
| 4 | Obsidian | Obsidian Sword | 29 |
| 5 | Silver | Silver Sword | 35 |
| 6 | Mithril | Mithril Sword | 41 |
| 7 | Crystal | Crystal Sword | 47 |
| 8 | Draconic | Draconic Sword | 53 |
| 9 | Abyssal | Abyssal Sword | 59 |
| 10 | Celestial | Celestial Sword | 65 |

### Elemental variants — 600 items
Six element prefixes × ten families × ten tiers. ID: `{prefix}_{family}_t{tier}`. Raw phys ×0.85; `elementValue = tier × 4`.

| Prefix | Element | Example | Raw Atk (T5) | Elem Value (T5) |
|---|---|---|---|---|
| `flame_` | fire | Flame Silver Sword | 29 | 20 |
| `frost_` | ice | Frost Silver Sword | 29 | 20 |
| `storm_` | lightning | Storm Silver Sword | 29 | 20 |
| `venom_` | poison | Venom Silver Sword | 29 | 20 |
| `void_` | void | Void Silver Sword | 29 | 20 |
| `radiant_` | radiant | Radiant Silver Sword | 29 | 20 |

Sell value = `tier × 22 g`.

### Unique / Legendary weapons — 20 items

| ID | Name | Family | Trait | Element | Notes |
|---|---|---|---|---|---|
| `worldknell` | Worldknell | Mace | `concussion` | — | KO build ×2; topple emits blunt shockwave |
| `whisper_and_wane` | Whisper & Wane | Daggers | `detonate` | poison | Poison+bleed simultaneously; detonate stacks |
| `dawnedge` | Dawnedge | Sword | `leech` | radiant | +100% vs undead/void; acts as mini-torch |
| `stormcaller` | Stormcaller | Bow | `shockchain` | lightning | Charged shots chain to wet/metal targets |
| `mountainbreaker` | Mountainbreaker | Greatsword | `cleave` | — | T3 charge ignores 50% def; guarantees part-break |
| `comets_tongue` | Comet's Tongue | Staff | `channel` | fire | Spells leave burning ground; fire reactions free |
| `the_last_page` | The Last Page | Tome | `glyph` | radiant | Summons spectral ally mimicking last spell |
| `gilded_fang` | Gilded Fang | Daggers | — | — | Damage scales with current gold (Avarice) |
| `thornweave` | Thornweave | Spear | `thornweave` | — | Pierce+bleed on every hit |
| `hollow_lance` | Hollow Lance | Spear | `void_absorb` | void | Absorbs enemy void projectiles |
| `shadowstep` | Shadowstep | Daggers | `bleedstack` | — | Backstab on teleport-to-back |
| `ironclad_gauntlets` | Ironclad Gauntlets | Gauntlets | `defiant` | — | +defense on parry |
| `frostfang_xbow` | Frostfang | Crossbow | — | ice | Wet enemies freeze on hit |
| `wyrmfire_staff` | Wyrmfire Staff | Staff | — | fire | Spells leave burn ground patch |
| `chorus_tome` | Chorus Tome | Tome | `glyph` | radiant | Heals allies in AoE on activate |
| `voidcleaver` | Voidcleaver | Greatsword | `cleave` | void | Lowers enemy void resist per hit |
| `bonecrusher` | Bonecrusher | Mace | `concussion` | — | ×2 damage vs bone-body enemies |
| `serpent_bow` | Serpent Bow | Bow | — | poison | Tracks wounded targets |
| `soulreaver` | Soulreaver | Sword | `leech` | — | Drain HP on hit |
| `abyssal_trident` | Abyssal Trident | Spear | — | void | Fire+void hybrid; burns in void water |

### Boss-forge weapons — 10 items

| ID | Name | Material | Family | Element |
|---|---|---|---|---|
| `goblin_shiv` | Goblin Shiv | Goblin Tooth | Daggers | poison |
| `tide_spear` | Tide Spear | Drowned Pearl | Spear | lightning |
| `venom_crossbow` | Venom Crossbow | Brood Venom | Crossbow | poison |
| `warlord_mace` | Warlord's Mace | Captain Badge | Mace | — |
| `furnace_blade` | Furnace Blade | Brand Ember | Sword | fire |
| `ysolds_lance` | Ysold's Lance | Frost Crystal | Spear | ice |
| `requiem_staff` | Requiem Staff | Choir Soul | Staff | radiant |
| `rift_cleaver` | Rift Cleaver | Riftmaw Eye | Greatsword | void |
| `twin_serpents` | Twin Serpents | Twin Crest | Daggers | void |
| `sovereign_blade` | Sovereign Blade | Sovereign Heart | Sword | radiant (mythic) |

---

## Base armor

| ID | Name | Slot | Def | Wt | Sell |
|---|---|---|---|---|---|
| `leather_armor` | Leather Armor | chest | 8 | 4 | 15 g |
| `light_leather` | Light Leather | chest | 6 | 2 | 12 g |
| `chainmail` | Chainmail | chest | 14 | 8 | 25 g |
| `robe` | Robe | chest | 4 | 1 | 10 g |
| `round_shield` | Round Shield | offhand | 10 | 5 | 15 g |

---

## Armor sets (40 pieces)

Eight crafted sets, each with 5 slots (Helm, Armor, Gauntlets, Greaves, Boots). Sell value = `20 + set.def × 10 g`.

| Set | ID prefix | Base Def | Weight | 2pc | 4pc | 5pc |
|---|---|---|---|---|---|---|
| Goblin | `goblin_` | 2–6 | 3–7 | +stamina | +move speed | Dodge refunds 5 stamina |
| Drowned | `drowned_` | 3–7 | 4–8 | +lightning resist | +shock build | Standing in water heals |
| Brood | `brood_` | 2–6 | 2–6 | +poison resist | +bleed build | Bleeds spread to nearby enemies |
| Captain | `captain_` | 5–9 | 6–10 | +defense | +perfect-guard window | Perfect guard emits stagger shockwave |
| Sage | `sage_` | 1–5 | 1–5 | +max MP | −skill cooldown | Spells −10% cost; reactions deal more |
| Iron Plate | `plate_` | 6–10 | 8–12 | +poise | −knockback | Cannot be staggered below 50% stamina |
| **Frostward** | `frostward_` | 4–8 | 5–9 | +fire resist | +30% freeze/frostbite build | Freezes shatter for AoE (+30% extra with set) |
| **Voidbane** | `voidbane_` | 3–7 | 4–8 | +void resist | +30% sear/radiant build | +dmg vs void/undead; immune to Corruption |

---

## Accessories

| ID | Name | Slot | Sell |
|---|---|---|---|
| `ruby_amulet` | Ruby Amulet | amulet | 40 g |
| `sapphire_amulet` | Sapphire Amulet | amulet | 40 g |
| `emerald_amulet` | Emerald Amulet | amulet | 40 g |
| `jade_amulet` | Jade Amulet | amulet | 40 g |
| `bone_ring` | Bone Ring | ring | 40 g |
| `gold_ring` | Gold Ring | ring | 40 g |
| `silver_ring` | Silver Ring | ring | 40 g |
| `skull_ring` | Skull Ring | ring | 40 g |
| `fire_charm` | Fire Charm | charm | 40 g |
| `ice_charm` | Ice Charm | charm | 40 g |
| `lightning_charm` | Lightning Charm | charm | 40 g |
| `vampire_charm` | Vampire Charm | charm | 40 g |

Accessories all spawn with random rarity and affixes, making their actual effect purely affix-driven.

---

## Ammo

| ID | Name | Stack | Sell |
|---|---|---|---|
| `arrow` | Arrow | 99 | 1 g |
| `bolt` | Bolt | 60 | 1 g |

---

## Consumables

All consumables channel for `TUNING.potionChannel` ms before activating. Tonic buffs are exclusive (only one active at a time) but stack with meal buffs.

### Restoratives

| ID | Name | Effect | Sell |
|---|---|---|---|
| `minor_potion` | Minor Potion | +40 HP | 7 g |
| `health_potion` | Health Potion | +90 HP | 18 g |
| `greater_potion` | Greater Potion | +180 HP | 40 g |
| `mega_elixir` | Mega-Elixir | Full HP+MP restore (very rare) | 250 g |
| `regen_draught` | Regen Draught | +8 HP/s for 20 s | 35 g |
| `mana_potion` | Mana Potion | +30 MP | 12 g |
| `greater_mana_potion` | Greater Mana Potion | +80 MP | 28 g |
| `ether_bun` | Ether Bun | Slow MP regen over 30 s | 14 g |
| `cleansing_tonic` | Cleansing Tonic | Removes one negative ailment | 25 g |
| `panacea` | Panacea | Removes all ailments + 5 s immunity | 80 g |
| `bandage` | Bandage | Stops Bleed + 15 HP heal (stack 5) | 8 g |

### Combat tonics (90 s buffs; only one active)

| ID | Name | Effect | Sell |
|---|---|---|---|
| `might_draught` | Might Draught | +20% physical ATK | 30 g |
| `sorcerers_draught` | Sorcerer's Draught | +20% magic ATK | 30 g |
| `adamant_tonic` | Adamant Tonic | +25% defense | 30 g |
| `focus_tonic` | Focus Tonic | +crit chance | 28 g |
| `endurance_brew` | Endurance Brew | +max stamina & regen | 22 g |
| `quickfoot_tonic` | Quickfoot | +move speed, +2 i-frames | 22 g |
| `whetting_oil_flame` | Flame Oil | Infuse weapon with **fire** for 90 s | 35 g |
| `whetting_oil_frost` | Frost Oil | Infuse weapon with **ice** for 90 s | 35 g |
| `whetting_oil_storm` | Storm Oil | Infuse weapon with **lightning** for 90 s | 35 g |
| `whetting_oil_venom` | Venom Oil | Infuse weapon with **poison** for 90 s | 35 g |
| `whetting_oil_radiant` | Radiant Oil | Infuse weapon with **radiant** for 90 s | 40 g |

### Throwables (isThrowable — P12 throw UI)

| ID | Name | Effect | Sell |
|---|---|---|---|
| `throwing_knife` | Throwing Knife | Small pierce poke | 3 g |
| `elem_flask_fire` | Fire Flask | Fire AoE (r 36), +40 burn build | 12 g |
| `elem_flask_frost` | Frost Flask | Frost AoE (r 36), +40 frostbite build | 12 g |
| `elem_flask_shock` | Shock Flask | Lightning AoE (r 36), +40 shock build | 12 g |
| `elem_flask_venom` | Venom Flask | Poison AoE (r 36), +40 poison build | 12 g |
| `flash_bomb` | Flash Bomb | Blind enemies in r 48 | 10 g |
| `sonic_bomb` | Sonic Bomb | Staggers enemies in r 40 | 10 g |
| `holy_water` | Holy Water | Radiant AoE (r 40), +60 sear build; rare | 20 g |
| `caltrops` | Caltrops | Ground hazard, bleed+slow | 5 g |
| `dung_bomb` | Dung Bomb | Enemies scatter / lose aggro | 4 g |
| `oil_flask` | Oil Flask | Coats ground with oil (ignitable) | 6 g |

### Traps & deployables

| ID | Name | Effect | Sell |
|---|---|---|---|
| `spike_trap` | Spike Trap | Pierce damage tile | 8 g |
| `shock_trap` | Shock Trap | Stun-locks triggering enemy | 12 g |
| `snare_trap` | Snare Trap | Roots a charging brute | 10 g |
| `bomb_barrel` | Bomb Barrel | Place + detonate for AoE | 18 g |
| `decoy_totem` | Decoy Totem | Pulls enemy aggro for 6 s | 15 g |
| `tent` | Tent | Deploy one-time rest spot | 20 g |
| `camp_kit` | Camp Kit | Opens camping interface | 15 g |

### Utility / exploration

| ID | Name | Effect | Sell |
|---|---|---|---|
| `warp_crystal` | Warp Crystal | Warp to town (blocked by Ironbound) | 12 g |
| `recall_stone` | Recall Stone | Instant return to town keeping loot | 20 g |
| `torch` | Torch | Raises FOV in dark/Hungering-Dark anomaly | 5 g |
| `lockpick` | Lockpick | Opens locked vault rooms | 12 g |
| `rope` | Rope | Skip a pit / shortcut | 8 g |
| `monster_bait` | Monster Bait | Lure target enemy for farming | 6 g |
| `detector_charm` | Detector Charm | Briefly pings nearby traps/secret rooms | 15 g |
| `whetstone` | Whetstone | +~10% ATK this floor | 3 g |
| `smoke_bomb` | Smoke Bomb | Smoke cloud, breaks enemy LOS 3 s | 4 g |

### Cooked meals

Made via `camp_kit` (requires 1× Ration + material per recipe). One active buff at a time.

| ID | Name | Material | Effect | Duration | Sell |
|---|---|---|---|---|---|
| `hearty_stew` | Hearty Stew | Dried Herb ×1 | +60 HP regeneration | 5 min | 20 g |
| `spiced_skewers` | Spiced Skewers | Feather ×1 | +15% STR | 5 min | 18 g |
| `iron_porridge` | Iron Porridge | Iron Ore ×1 | +10% VIT | 5 min | 16 g |
| `hunters_tea` | Hunter's Tea | Arrow Shaft ×1 | +10% AGI | 5 min | 14 g |
| `mages_broth` | Mage's Broth | Vial ×1 | +15% INT | 5 min | 22 g |
| `trailmix` | Trail Mix | Dried Herb ×2 | +10% DEX | 5 min | 10 g |

---

## Bags

| ID | Name | Effect | Sell |
|---|---|---|---|
| `adventure_bag` | Adventure Bag | Permanently unlocks the full inventory grid | 25 g |

Without the bag, inventory is limited to a small starting grid.

---

## Materials

### Basic materials

| ID | Name | Sell | XP |
|---|---|---|---|
| `mana_stone_1` | Lv1 Mana Stone | 10 g | 50 |
| `mana_stone_2` | Lv2 Mana Stone | 25 g | 150 |
| `mana_stone_3` | Lv3 Mana Stone | 55 g | 350 |
| `mana_stone_4` | Lv4 Mana Stone | 120 g | 800 |
| `iron_ore` | Iron Ore | 5 g | — |
| `dragon_scale` | Dragon Scale | 50 g | — |

Mana Stones are sold to the Armory for XP or used in upgrade recipes.

### Boss-drop materials (floors 1–10)

| ID | Name | Boss | Sell |
|---|---|---|---|
| `goblin_tooth` | Goblin Tooth | Goblin Warlord (F1) | 15 g |
| `drowned_pearl` | Drowned Pearl | The Drowned King (F2) | 25 g |
| `brood_venom` | Brood Venom | Brood Matron (F3) | 35 g |
| `captain_badge` | Captain Badge | Sir Mordrek (F4) | 45 g |
| `brand_ember` | Brand Ember | Forgefather Brand (F5) | 90 g |
| `frost_crystal` | Frost Crystal | Frost Warden Ysold (F6) | 120 g |
| `choir_soul` | Choir Soul | The Hollow Choir (F7) | 150 g |
| `riftmaw_eye` | Riftmaw Eye | Riftmaw (F8) | 180 g |
| `twin_crest` | Twin Crest | The Ascendant Twins (F9) | 220 g |
| `sovereign_heart` | Sovereign Heart | The Sovereign (F10) | 400 g |

### Anomaly-drop materials

| ID | Name | Source | Sell |
|---|---|---|---|
| `rift_shard` | Rift Shard | Dimensional Rift anomaly | 350 g |
| `shade_essence` | Shade Essence | Mirror Rift / Echo anomaly | 200 g |
| `grave_ash` | Grave Ash | Gravelord anomaly | 250 g |
| `gilded_coin` | Gilded Coin | Avarice anomaly | 180 g |
| `judge_mechanism` | Judge Mechanism | Clockwork Judge anomaly | 300 g |
| `friends_token` | Friend's Token | Old Friend anomaly | 220 g |
| `nemesis_mark` | Nemesis Mark | The Hunter anomaly | 400 g |

### Runes (socketable — insert via Armory)

**Stat runes:**
| ID | Bonus | Sell |
|---|---|---|
| `rune_str` | +STR | 30 g |
| `rune_vit` | +VIT | 30 g |
| `rune_int` | +INT | 30 g |
| `rune_dex` | +DEX | 30 g |
| `rune_agi` | +AGI | 30 g |
| `rune_lifesteal` | Lifesteal % | 50 g |
| `rune_guard` | +block % | 40 g |
| `rune_evade` | +i-frames | 40 g |
| `rune_thorns` | Reflect chip dmg | 50 g |
| `rune_greed` | +gold/XP | 35 g |

**Elemental runes (grant elementValue to weapon):**
| ID | Element | Sell |
|---|---|---|
| `rune_fire` | fire | 45 g |
| `rune_ice` | ice | 45 g |
| `rune_lightning` | lightning | 45 g |
| `rune_poison` | poison | 45 g |
| `rune_void` | void | 55 g |
| `rune_radiant` | radiant | 60 g |

**Status runes (+build-up power):**
| ID | Bonus | Sell |
|---|---|---|
| `rune_bleed` | +bleed build | 40 g |
| `rune_ko` | +KO build | 40 g |
| `rune_wound` | +wound build | 40 g |

### Jewels (socket inserts — Armory UI, P12)

Jewels drop from bosses, anomalies, and bounties. They socket into gear with available slots. Up to 2 sockets per piece.

| ID | Name | Skill | Level | Bonus |
|---|---|---|---|---|
| `jewel_atk_1` | Attack Jewel 1 | atk | 1 | +4 ATK |
| `jewel_atk_2` | Attack Jewel 2 | atk | 2 | +8 ATK |
| `jewel_atk_3` | Attack Jewel 3 | atk | 3 | +14 ATK |
| `jewel_elem_fire` | Fire Jewel | elem_fire | 2 | +6 fire power |
| `jewel_elem_ice` | Frost Jewel | elem_ice | 2 | +6 frost power |
| `jewel_elem_lightning` | Storm Jewel | elem_lightning | 2 | +6 storm power |
| `jewel_elem_poison` | Venom Jewel | elem_poison | 2 | +6 venom power |
| `jewel_elem_void` | Void Jewel | elem_void | 2 | +6 void power |
| `jewel_elem_radiant` | Radiant Jewel | elem_radiant | 2 | +6 radiant power |
| `jewel_guard` | Guard Jewel | def | 2 | +5 defense |
| `jewel_evade` | Evade Jewel | iframes | 2 | +2 i-frames |
| `jewel_status_atk` | Status Jewel | status_build | 2 | +10% status build |
| `jewel_recovery` | Recovery Jewel | healBonus | 2 | +15% potion potency |
| `jewel_slayer_flesh` | Flesh Slayer | slayer_flesh | 2 | +15% vs flesh |
| `jewel_slayer_armored` | Armor Slayer | slayer_armored | 2 | +15% vs armored |
| `jewel_slayer_bone` | Bone Slayer | slayer_bone | 2 | +15% vs bone |
| `jewel_slayer_construct` | Construct Slayer | slayer_construct | 2 | +15% vs construct |
| `jewel_slayer_undead` | Undead Slayer | slayer_undead | 2 | +15% vs undead |
| `jewel_slayer_void` | Void Slayer | slayer_void | 2 | +20% vs void |

### Alchemy recipes (craft at Emporium or camp — P12 UI)

Key recipes; full list in `src/data/alchemy.ts`.

| Recipe | Inputs | Output | Research req | Where |
|---|---|---|---|---|
| Minor Potion | Herb ×2, Vial | minor_potion | — | Both |
| Health Potion | Herb ×4, Vial, Iron Ore | health_potion | — | Both |
| Regen Draught | Herb ×3, Vial, Feather ×2 | regen_draught | — | Both |
| Cleansing Tonic | Herb ×3, Vial | cleansing_tonic | 1 | Both |
| Greater Potion | Herb ×8, Vial ×2, Stone2 | greater_potion | 1 | Emporium |
| Flame Oil | Brand Ember, Vial | whetting_oil_flame | 1 | Emporium |
| Frost Oil | Frost Crystal, Vial | whetting_oil_frost | 1 | Emporium |
| Holy Water | Vial, Stone3 | holy_water | 2 | Emporium |
| Panacea | Herb ×8, Vial ×2, Stone3 | panacea | 2 | Emporium |
| Stone 1→2 | Stone1 ×5 | mana_stone_2 | 1 | Emporium |
| Arrows ×10 | Shaft ×5, Feather ×3, Ore | arrow ×10 | — | Both |

### Camping ingredients

| ID | Name | Stack | Sell |
|---|---|---|---|
| `ration` | Ration | 10 | 8 g |
| `dried_herb` | Dried Herb | 10 | 5 g |
| `feather` | Feather | 20 | 3 g |
| `arrow_shaft` | Arrow Shaft | 20 | 2 g |
| `vial` | Vial | 10 | 4 g |

---

## Shop prices

### Armory (west building)

**Buy:**

| Item | Price |
|---|---|
| Iron Sword | 80 g |
| Steel Bow | 100 g |
| Enchanted Staff | 120 g |
| Chainmail | 90 g |
| Round Shield | 60 g |

**Upgrade (equipment level +1):**

| Current rank | Gold | Material |
|---|---|---|
| 0 → 1 | 50 g | 1× Iron Ore |
| 1 → 2 | 100 g | 2× Iron Ore |
| 2 → 3 | 150 g | 3× Iron Ore |
| 3 → 4 | 250 g | 1× Dragon Scale |
| 4 → 5 | 400 g | 2× Dragon Scale |

**Forge (boss-material recipes):**

| Recipe | Gold | Materials |
|---|---|---|
| Goblin Helm | 50 g | 1× Goblin Tooth + 2× Iron Ore |
| Drowned Chest | 80 g | 1× Drowned Pearl + 4× Iron Ore |
| Brood Greaves | 70 g | 1× Brood Venom + 3× Iron Ore |
| Captain Sword (Greatsword T4) | 120 g | 1× Captain Badge + 5× Iron Ore |

### Emporium (east building)

| Item | Price |
|---|---|
| Health Potion | 15 g |
| Mana Potion | 20 g |
| Smoke Bomb | 10 g |
| Adventure Bag | 50 g |
| Arrows ×20 | 12 g |

### Inn

| Service | Cost |
|---|---|
| Full HP + MP restore (companions rest too) | 30 g |

### Wandering Stall (dungeon approach, daily rotation — 3 of 12)

| Item | Price |
|---|---|
| Camp Kit | 60 g |
| Warp Crystal | 150 g |
| Lv2 Mana Stone | 90 g |
| Lv3 Mana Stone | 200 g |
| Dragon Scale | 130 g |
| Smoke Bomb | 25 g |
| Spike Trap | 40 g |
| Whetstone | 20 g |
| Health Potion | 30 g |
| Mana Potion | 35 g |
| Frost Crystal | 180 g |
| Brand Ember | 160 g |

The Stall's stock rotates daily (date-seeded). Check back after midnight for new inventory.

---

## Starting equipment by class

| Class | Gear |
|---|---|
| Swordman | Short Sword, Leather Armor, ×3 Health Potion |
| Archer | Short Bow, Arrow ×1 stack, Leather Armor, ×3 Health Potion |
| Tanker | Mace, Round Shield, Chainmail, ×5 Health Potion |
| Assassin | Twin Daggers, Light Leather, ×3 Health Potion, ×2 Smoke Bomb |
| Sage | Staff, Robe, ×3 Mana Potion, Fireball Tome |

---

## Gold

Gold is the only currency. Earned by killing enemies (each enemy has a gold drop range), bounty rewards, and selling items. Persists across floors and is saved on floor transitions.

On **permadeath**, all gold (and the entire save) is permanently deleted.
