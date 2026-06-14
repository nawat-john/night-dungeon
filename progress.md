# Dungeon RPG — Expansion Progress (P7 → P12)

> Tracks implementation of `DUNGEON_RPG_EXPANSION.md`.
> Baseline: P1–P5 complete; Phase 6 (art/polish) in progress.
> Numbers & formulas: `physRaw = max(6, STR×3+DEX) × MV`, crit ×1.35, status build-up to 100.

---

## P7 — Damage Pipeline & Affinity Core *(the one big rock)*

### Types & data models (`src/types/index.ts`)
- [x] Add `PhysType = 'slash' | 'blunt' | 'pierce'`
- [x] Add `BodyType` union (flesh / armored / bone / gelatinous / chitin / construct / ethereal / plant / aerial)
- [x] Expand `Element` to include `'radiant'` and unify type (none/physical/blunt/fire/ice/lightning/poison/void/radiant)
- [x] Add `Ailment` extensions: `'ko' | 'wound' | 'sear' | 'blind' | 'stuck' | 'corruption' | 'frostbite'`
- [x] Add `Affinity` interface (body, weak/resist/immune/absorb arrays)
- [x] Add `Hitzone` interface (id, rawMod, elemMod, breakable?, breakHp?, breakReward?, disablesAttack?)
- [x] Add `WeaponExt` interface (physType, element?, elementValue?, trait?, uniqueEffectId?, infusedElement?)
- [x] Add `StatusBuildup` interface (ailment, value → 100)
- [x] Add `EffectSpec` interface (id, kind, params, channelMs?, durationMs?)
- [x] Add `CharacterSaveV2Add` fields (specialization?, hunterState?, activeTonic?, weaponInfusions?, runModifiers?)
- [x] Bump `CharacterSave.version` to 2; `SaveManager.migrate()` forwards v1 → v2 with safe defaults

### Charts & config (`src/config.ts`)
- [x] Add `PHYS_CHART[BodyType][PhysType]` — 9×3 multiplier table (0.5–1.3)
- [x] Add `ELEM_CHART[family][Element]` — family-keyed multiplier table (−0.5–2.0)
- [x] Add `TUNING_V2` block (affinity mult bands, status params, research thresholds, mastery cap, tonic durations, boss phase thresholds)

### Damage resolver refactor
- [x] Create `src/systems/CombatSystem.ts` with `resolveHit(baseDmg, physType, element, body?, elemFamily?) → HitResult`
- [x] Apply `physMult` from `PHYS_CHART` using weapon `physType` vs enemy `body`
- [x] Apply `elemMult` from `ELEM_CHART`; negative mult = heal enemy (absorb)
- [x] Elemental split: 25% phys + 75% elem for elemental attacks; pure phys for `element='none'`
- [x] Accept optional `Hitzone` param in `resolveHit`; apply `rawMod` to physPart, `elemMod` to elemPart
- [x] Apply ±3% random variance at the end of `resolveHit`
- [x] Default all existing weapons to a sensible `physType` via `physTypes` table in `items.ts`

### Enemy & boss data (`src/data/enemies.ts`, `src/data/bosses.ts`)
- [x] Tag every enemy with `body` and `elemFamily` (all ~40 entries in ENEMY_DEFS)
- [x] Tag every boss with `body`, `elemFamily`, and 2–4 hitzones (all 11 boss entries in bosses.ts)

### Visual feedback
- [x] Tinted elemental damage numbers via `elemColor()` helper (fire=orange, ice=cyan, lightning=yellow, poison=green, void=purple, radiant=white)
- [x] "WEAK!" / "RESIST" / "ABSORB" / "IMMUNE" hit indicators

### Acceptance criteria
- [x] Mace out-damages sword vs skeletons (armored/bone body) — PHYS_CHART bone: blunt 1.3 vs slash 0.8
- [x] Fire weapon shows doubled damage vs frost enemies — ELEM_CHART ice: fire 2.0
- [x] Void weapon vs Void floor enemy shows "ABSORB" and heals enemy — ELEM_CHART void: void −0.5
- [x] Existing saves load without error — `SaveManager.migrate()` adds V2 defaults, clamped to `SAVE_VERSION=2`

---

## P8 — Status & Reactions Expansion *(complete)*

### New ailments
- [x] **Bleed** — DoT that worsens while target moves; from slash weapons; ineffective vs undead/construct/ethereal
- [x] **KO / Topple** — blunt fills hidden KO meter → enemy topple (1500ms punish window, +30% dmg bonus)
- [x] **Wound** — pierce/crit builds up; marked hitzone takes +25%; ineffective vs formless slimes
- [x] **Freeze Solid** — ice build-up to full → frostbite (6s) → frozen (1200ms stun); blunt on frozen = +60% Shatter AoE
- [x] **Sear** — radiant DoT 5/s ignores defense; Blind (lowers aggro range) vs living targets after 500ms
- [x] **Blind** — reduces enemy aggro range while active
- [x] **Corruption** — void DoT 2% maxHp/s
- [x] **Stuck** — zeros velocity each tick until expiry (Gel Cube engulf; Gelatinous-source)

### Status-by-source wiring (`applyAttackAilment`)
- [x] Slash weapons → Bleed build-up (skipped vs undead/construct/spectral)
- [x] Blunt weapons → KO meter build-up (+50% with Mace family via `isBlunt`)
- [x] Pierce weapons → Wound build-up (skipped vs gelatinous body)
- [x] Fire element → Burn build-up (+52% vs plant)
- [x] Ice element → Frostbite build-up (chains: frostbite expire → frozen trigger)
- [x] Lightning element → Shock; ×2 build-up on Wet targets
- [x] Poison element → Poison DoT (+25% vs beast)
- [x] Void element → Corruption
- [x] Radiant element → Sear

### Environmental reactions (`src/systems/StatusSystem.ts`)
- [x] Fire + ice/chill/frostbite → Shatter (35 dmg AoE)
- [x] Blunt (KO build) + Frozen → Enhanced Shatter (55 dmg +60% AoE radius)
- [x] Fire + shock → Overload (AoE 25 dmg)
- [x] Ice/frostbite + shock → Superconduct (15 dmg + def debuff 6s)
- [x] **Wet tiles** — lightning ×2 shock build-up (in `applyAttackAilment`); fire ×0.5 burn build-up on wet targets (P12)
- [x] **Oil tiles** — fire attack on oiled target ignites nearby oil hazards (in `applyAttackAilment`, P12)
- [x] **Ice patches** — sliding inertia (0.93) in `Player.ts`; Frostward 4pc negates it (P12)

### Hitzones on normal enemies
- [x] All 13 brute enemies get 2 hitzones with own `rawMod` / `elemMod` and `breakPart`
- [x] Small / swarm enemies remain single-zone

### Mini-breaks on big enemies
- [x] Brutes/champions: one `breakPart` with dmgThreshold + material drop

### Damage multipliers in hit paths
- [x] Wound check (+25% baseDmg) in melee and projectile hit paths
- [x] KO punish window check (+30% baseDmg) in melee and projectile hit paths
- [x] Boss affinity (body/elemFamily) now passed to `resolveHit` in all hit paths

### Acceptance criteria
- [x] Blunt topples a brute → TOPPLE! text + ko_punish_ms set for 3s
- [x] Freezing + blunt = Shatter AoE fires (KO build + frozen reaction)
- [x] Frostbite expires → frozen stun 1200ms
- [x] Lightning damage on wet target = ×2 shock build-up

---

## P9 — Item & Gear Flood *(complete)*

### Elemental weapon variants (`src/data/items.ts`)
- [x] Generate elemental variants: 6 prefixes × 10 families × 10 tiers = 600 items; IDs: `{prefix}_{family}_t{tier}`
- [x] Prefixes: `flame_`, `frost_`, `storm_`, `venom_`, `void_`, `radiant_`; raw phys ×0.85, elementValue = tier×4
- [x] Pure (non-elemental) variants keep full raw phys (existing 100-item generator unchanged)

### Unique / Legendary weapons (20)
- [x] All 20 unique weapons defined in ITEMS: Worldknell, Whisper & Wane, Dawnedge, Stormcaller, Mountainbreaker, Comet's Tongue, The Last Page, Gilded Fang + 12 more
- [x] Each carries appropriate family/physType/element/trait/elementValue/isUnique flags
- [x] `WeaponTrait` type union defined in `types/index.ts` (P11 behavior hooks)

### Boss-forge weapon lines (10)
- [x] One weapon per boss material: goblin_shiv, tide_spear, venom_crossbow, warlord_mace, furnace_blade, ysolds_lance, requiem_staff, rift_cleaver, twin_serpents, sovereign_blade
- [x] Each carries boss element + trait where applicable

### Weapon identity traits — data stubs
- [x] `WeaponTrait` type defined; all 16 trait IDs referenced by weapons; behavior implementation P11 scope

### Restoratives
- [x] minor_potion (+40 HP), health_potion (+90 HP, updated), greater_potion (+180 HP), mega_elixir (full HP+MP)
- [x] regen_draught, greater_mana_potion, ether_bun, cleansing_tonic, panacea, bandage

### Combat tonics (11 items)
- [x] might_draught, sorcerers_draught, adamant_tonic, focus_tonic, endurance_brew, quickfoot_tonic
- [x] whetting_oil_flame/frost/storm/venom/radiant — saved to activeTonic + weaponInfusions on use

### Throwables (11 items)
- [x] throwing_knife, elem_flask ×4, flash_bomb, sonic_bomb, holy_water, caltrops, dung_bomb, oil_flask

### Traps & deployables (6 items)
- [x] spike_trap, shock_trap, snare_trap, bomb_barrel, decoy_totem, tent, camp_kit

### Utility / exploration items (7 items)
- [x] torch, lockpick, rope, monster_bait, detector_charm, recall_stone, warp_crystal

### Alchemy / crafting (`src/data/alchemy.ts`)
- [x] 25 recipes covering restoratives, tonics, oils, throwables, arrows, transmutation
- [x] `recipesFor(location, researchLevel)` helper; UI implementation P12

### Affixes expansion (`src/data/affixes.ts`)
- [x] 40+ affixes across offensive/defensive/utility/legendary categories
- [x] `AFFIX_CATALOG: AffixDef[]` exported with valueMin/valueMax bands per affix
- [x] All 4 legendary affixes defined: perfect-dodge heal, topple drop, freeze shatter, first-hit crit

### Decorations / jewels
- [x] `jewelSkill/jewelLevel/jewelValue` fields on Item; `type: 'jewel'` added to ItemType
- [x] Attack Jewel 1/2/3, Element Jewel ×6, Guard/Evade/Status/Recovery jewels, Slayer Jewel ×6 body types = 19 jewel items
- [x] Socketing UI: P12 scope (Armory)

### Runes expansion
- [x] 14 new runes: DEX/AGI, Guard/Evade, Fire/Ice/Lightning/Poison/Void/Radiant (elemental), Bleed/KO/Wound (status), Thorns, Greed

### Set bonuses (all 8 defined)
- [x] Goblin, Drowned, Brood, Captain, Sage, Iron Plate — existing 6 sets wired in code
- [x] **Frostward** — `frostward_` armor set (5 pieces); 4pc: +30% frostbite/frozen build; 5pc: freezes shatter with +30% bonus (wired in StatusSystem)
- [x] **Voidbane** — `voidbane_` armor set (5 pieces); 4pc: +30% sear build; 5pc: immune to Corruption (wired in StatusSystem)

### useConsumable — data-driven dispatch
- [x] Reads healHp/healMp/tonicEffect/cleanseOne/cleanseAll/stopBleed from item definition
- [x] Whetting oils write weaponInfusions[mainhand] to save
- [x] Panacea grants 5s status_immune_ms; bandage clears bleed

### Acceptance criteria
- [x] Player can fix matchup gap three ways: weapon2 swap / whetting oil (infuse element) / elemental rune infusion
- [x] Jewel data fully defined; socketing UI pending P12
- [x] Every set's 5pc has a named effect (all 8 sets documented; frostward/voidbane wired in StatusSystem)

---

## P10 — Monster Identity & Research/Bestiary *(complete)*

### Monster identity template
- [x] `identity`, `signature`, `counter`, `statusVuln`, `lore` fields added to EnemyDef interface
- [x] All 35 existing enemies filled with identity data (body/elemFamily already set P7)
- [x] Identity strings cover: what makes it scary, the counter, status vulnerabilities

### New monster families (12 new enemies added to ENEMY_DEFS)
- [x] **Ironback Beetle** (F3+, fungal, chitin/insect) — carapace resists slash+blunt; pierce underbelly
- [x] **Gel Cube** (F2+, flooded, gelatinous/aquatic) — engulf → Stuck; slash to free; nucleus hitzone
- [x] **Mirror Knight** (F4+, barracks, armored/undead) — gem hitzone (mirror_shield = 0 mod); melee flank only
- [x] **Storm Elemental** (F6+, frozen, construct/storm) — absorbs lightning (enrages); fire+ice break it
- [x] **Bog Witch** (F2+, flooded, flesh/beast) — element-curse hex; interrupt or swap element
- [x] **Sand Lurker** (F5+, foundry, chitin/insect) — ash-burrow ambush; Detector/Sonic reveals
- [x] **Plague Hound** (F3+, deadland, flesh/beast) — fast-pack poison; Panacea + fire AoE
- [x] **Living Armor** (F7+, court, construct/undead) — gem hitzone 3.0×/2.5× only; armor = 0.05×
- [x] **Rift Wisp** (F8+, void, ethereal/void) — blink-skirmisher; radiant forces materialization
- [x] **Choir Acolyte** (F7+, catacombs, bone/undead) — resurrection chant; radiant interrupts
- [x] **Gravetide** (F7+, catacombs, flesh/undead) — endless swarm from spawner-crypt
- [x] **Aurelion** (F1+, cave, flesh/beast) — rare fleeing stag; rewards Radiant mat for tracking

### New ElemFamily
- [x] `'storm'` added to ElemFamily union and ELEM_CHART: absorbs lightning (−0.5), weak fire+ice (1.5)

### Elite/Champion affixes (matchup-aware)
- [x] **Warded** (cyan aura) — elemental attacks ×0.70; shows RESIST label; forces weapon swap
- [x] **Unstable Core** (magenta) — cycles weakness element every 5s in Enemy.update; matching hit +50%
- [x] **Bloodgorged** (dark red) — bleed ticks absorbed via `Enemy.absorbBleeding()` in StatusSystem

### Monster "tells" library
- [x] Identity/signature/counter documented on all enemies in code; telegraph times unchanged (620/900ms)
- [x] Wiki monsters.md updated with identity columns and counter table

### Research / Bestiary system (`src/systems/ResearchSystem.ts`)
- [x] `ResearchEntry { enemyId, level: 0|1|2|3, kills, breaks }` interface in types/index.ts
- [x] `MasteryEntry` and `AccountMeta.research/masteries/unlockedRecipes` added
- [x] `ResearchSystem.recordKill(meta, id)` and `recordBreak(meta, id)` — breaks count 2×
- [x] Rank thresholds: Lv1=5, Lv2=15, Lv3=30 (combined score)
- [x] Research persists on AccountMeta (survives permadeath); forward-migrated in `loadAccountMeta()`
- [x] "✦ Research Lv{n}: {Name}!" toast on kill/break that ranks up
- [x] Bestiary tab in Adventurer's Guild panel: paginated, 5 per page, Lv-gated info reveal
- [x] Lv0: name + progress; Lv1: +stats/archetype/body; Lv2: +counter/elemFamily; Lv3: +hitzones/lore

### Acceptance criteria
- [x] Killing a monster ranks its Research entry (AccountMeta.research updated on kill)
- [x] Lv2 reveals counter/family in Bestiary
- [x] Bestiary browsable at Guild in town (BESTIARY tab)

---

## P11 — Classes, Skill Trees & Bosses 2.0

### Concrete skill trees (§E8.2)
- [x] Tree shape: 3 branches × 4 tiers + 1 capstone; ~50 skill points to level 50

**Swordman — Tempo / Guard / Blade**
- [x] Blade branch: +slash MV, 3rd-light combo, Bleed-on-crit, *Crescent Lunge* (art)
- [x] Guard branch: faster Riposte window, chip immunity, *Bulwark* (omni-guard 2s), counter-stagger
- [x] Tempo branch: roll-cancel heavies, +stamina regen, *Momentum* (no-hit streak buffs atk), perfect-dodge → cooldown refund
- [x] Capstone — **Perfect Tempo**: perfect dodge resets one skill cooldown

**Archer — Precision / Volley / Survival**
- [x] Precision branch: +weakpoint dmg, charged-shot crit, *Mark* (tagged foe +15%), *Deadeye* (charged weakpoint = part-break)
- [x] Volley branch: multishot spread, *Rain of Arrows*, ricochet, +ammo retention
- [x] Survival branch: backstep-shot (fire while dodging), move-while-aiming, *Trap Arrow*, +i-frames
- [x] Capstone — **Hunter's Eye**: Research Lv of target adds bonus damage

**Tanker — Aegis / Provoke / Impact**
- [x] Aegis branch: +block%, perfect-guard window, reflect chip, *Iron Stance*
- [x] Provoke branch: AoE *Taunt*, threat mult, *Last Stand* (<25% HP +def), aggro-heal
- [x] Impact branch: +KO build, *Shield Bash* (stun), *Ground Slam* (AoE topple), KO topple bonus dmg
- [x] Capstone — **Immovable**: no knockback; perfect guard → stagger shockwave

**Assassin — Shadow / Venom / Flow**
- [x] Shadow branch: longer stealth, +backstab crit, vanish-on-kill, *Death Mark* execute
- [x] Venom branch: poison/bleed on crit, +dmg vs ailing, *Rupture* (detonate stacks for burst), spread-on-kill
- [x] Flow branch: +dodge i-frames, *Frenzy* uptime, dash-attack reset on kill, +crit dmg
- [x] Capstone — **Lethality**: crits on wounded hitzone can instakill non-elite enemies

**Sage — Elements / Glyph / Mysticism**
- [x] Elements branch: +magic MV, element swap stance, lingering ground hazard, *Meteor*
- [x] Glyph branch: place runes, chain detonations, slow/heal zones, *Glyph Storm*
- [x] Mysticism branch: MP efficiency, shields/heals (companions), *Cleanse*, *Mana Shield*
- [x] Capstone — **Convergence**: detonating two elements on one target triggers big reaction

### Weapon arts (unlockable)
- [x] Sword *Crescent Lunge*
- [x] Greatsword *True Charge*
- [x] Daggers *Shadowstep Flurry*
- [x] Spear *Skewer* (multi-pierce)
- [x] Bow *Rain of Arrows*
- [x] Staff *Meteor*
- [x] Tome *Glyph Storm*

### Weapon mastery (account-meta)
- [x] Per-family mastery level (survives death); uses tracked per run
- [x] Minor passives unlock at mastery tiers (cap 5 per family)

### Specializations (mid-run pick at Floor 4 boss)
- [x] *Slayer* — +dmg vs chosen body type
- [x] *Elementalist* — +all element atk, −raw
- [x] *Berserker* — lifesteal, +dmg at low HP
- [x] *Sentinel* — guard/parry focus
- [x] *Trapper* — deployables/throwables empowered
- [x] Lock-in on pick; respec not available mid-run

### Guard & parry per weapon (§E7.2)
- [x] Spear: brace → counter-thrust guard
- [x] Sword: *Riposte* active parry (tight window → guaranteed crit)
- [x] Gauntlets: *Weave* parry (perfect-dodge counter)
- [x] Greatsword: *Tackle* (dodge→heavy) with super-armor frames

### Perfect-dodge reward (§E7.3)
- [x] Inner i-frame window for "perfect dodge" — brief Focus state
- [x] Focus: +crit on next hit, refund 10 stamina
- [x] Ties into Sword Riposte and Gauntlet Flow

### Enemy feints (§E7.5)
- [x] Tougher enemies occasionally feint (fake wind-up) or pause when pressured

### Bosses 2.0 (`src/data/bosses.ts`)
- [x] **Forgefather Brand (F5)**: Phase 1 molten (weak Ice) → Phase 2 obsidian at 40% HP (armored, weak Blunt, fire-immune)
- [x] **Frost Warden Ysold (F6)**: frozen (weak Fire) → blizzard phase (weak Radiant/Fire); break Ice Heart pre-enrage to skip blizzard
- [x] **Riftmaw (F8)**: cycles void/neutral; void absorbs void weapons; rewards radiant
- [x] 3–4 breakable parts on later bosses; breaking key part can skip/weaken enrage
- [x] Phase weakness shown in HUD at Research Lv2
- [x] **Tempered/Apex** boss variants (post-checkpoint, harder pattern + extra phase, mythic drops)

### Acceptance criteria
- [x] Each class plays ≥2 distinct ways via tree branches
- [x] Brand's obsidian phase flips weakness mid-fight; player must adapt
- [x] Breaking Ysold's Ice Heart demonstrably skips blizzard enrage
- [x] Skill menu (K) shows real tree nodes with unlock state

---

## P12 — Dungeon Depth, Anomalies, Economy & Polish *(complete)*

### Room archetypes (`src/systems/FloorGenerator.ts`)
- [x] **Treasure Vault** — locked; Lockpick or elite key
- [x] **Arena** — doors seal; clear wave for loot (`updateArenas()` in DungeonScene)
- [x] **Shrine** — one-time buff or risky bargain (`interactShrine`)
- [x] **Library/Lore** — research notes, recipe unlocks, summon hints (`interactLibrary`)
- [x] **Rest Nook** — safe camp spot
- [x] **Hazard Room** — floor-themed environmental hazards spawned in `spawnRoomObjects()` (P12)
- [x] **Puzzle Room** — pressure-plate / light switch for reward (`updatePuzzlePlates()`)
- [x] **Merchant Pocket** — in-floor stall (`interactMerchant`)
- [x] **Empty/Quiet** — pacing room
- [x] Director weights room types per floor number (`ARCHETYPE_WEIGHTS` in FloorGenerator)

### Per-floor environmental hazards
- [x] F2 Flooded/Pond — water tiles
- [x] F3 Fungal — spore clouds (gas) + explosive puffballs
- [x] F5 Foundry — lava (fire) + oil pools
- [x] F6 Frozen — ice hazards + thin ice tiles + blizzard overlay
- [x] F7 Catacombs — curse fog + gravetide spawners
- [x] F8 Void — gravity wells + drifting rifts
- [x] F10 Throne — generic mix
- [x] Hazard archetype rooms spawn floor-appropriate hazards (P12, `case 'hazard'`)

### Secrets & exploration
- [x] Hidden rooms (cracked walls; revealed by Detector Charm or bombs) — `checkSecretsAndCrackedWalls()`
- [x] Secret warp shortcuts (via warp pad system)
- [x] Lore pages feeding investigation clues — `discoveredClues` in AccountMeta

### Investigation system & secret bosses (§E11.1)
- [x] `discoveredClues` tracked in `AccountMeta`
- [x] All 15 anomalies defined in `src/data/anomalies.ts` (gravelord, avarice, clockwork_judge, old_friend, hungering_dark, aurelion, dimensional_rift, mirror_rift, the_hunter, wandering_merchant, cursed_bargain, gamblers_chest, caged_ally, blood_moon, echo_fallen_hero, beast_stampede)
- [x] Aurelion — track across 3 floors (flees) → Radiant infusion materials (`updateAurelionTrack()`)
- [x] Investigation log browsable in Guild (`buildGuildInvestigation()`)

### Hunter nemesis arc (§E11.2)
- [x] `hunterState` (encounters, defeats, escalation) persisted on save
- [x] Hunter anomaly defined (`the_hunter` in anomalies.ts)

### Anomaly additions
- [x] All 15 anomalies defined including: Wandering Merchant, Cursed Bargain, Echo Duel, Beast Stampede
- [x] `rollAnomaly()` floor-aware with 22% per floor

### Conditional loot tables (§E12.1)
- [x] Drop conditions: `always | champion_only | part_broken | status_kill | element_kill` (P12)
- [x] `killContext` `{ statusKill, elementKill }` passed to `rollDrops()` from `onEnemyDied()`
- [x] `Enemy.lastHitWasStatusTick` tracks whether death came from a status DoT

### Salvage / disassemble & transmute
- [x] Salvage in Sage's Tower (mode `'salvage'`)
- [x] Transmute in Sage's Tower (mode `'transmute'`)
- [x] Socket jewels/runes in Sage's Tower (mode `'socket_item' / 'socket_rune'`)

### Bounties 2.0 (§E12.4)
- [x] Break Ysold's antlers (`b_break_ysold_antlers`)
- [x] Kill 10 undead with Radiant (`b_radiant_undead`)
- [x] Topple a brute (`b_topple_brute`)
- [x] Clear Floor 5 without drinking a potion (`b_clear_f5_no_pot`)

### Town 2.0 services
- [x] **Armory**: weapon element infusion (rune + 150g, 6 elemental options) — P12
- [x] **Chapel**: Radiant Blessing (200g, +25% radiant dmg for 1 hour) — P12; curse cleansing existing
- [x] **Guild**: Research/Bestiary terminal, bounty board, Hall of Champions, companion hire, investigation log
- [x] **Sage's Tower**: affix reroll (enchant), transmute, salvage, socket runes/jewels

### Companion depth
- [x] Command wheel: Follow / Aggressive / Defensive / Focus / Hold / Regroup — `cycleCommand()` via TAB
- [x] Hardcore companions toggle — `save.hardcoreCompanions`; off by default; toggle in Guild (P12)
- [x] Normal mode: companions restore HP + potions on town return (P12)
- [x] Fatigue system — decrements by 1 each town visit in normal mode

### Run modifiers (§E14.1)
- [x] **Ironbound** — no Recall/Warp stones (`ironboundMode`)
- [x] **Starved** — −50% healing (`starvedMode`)
- [x] **Hunted** — Hunter appears earlier (`huntedMode`)
- [x] **Blackout** — −FOV (`blackoutMode`)
- [x] **Glass** — ×2 damage taken, ×1.5 dealt (`glassMode`)
- [x] **Wrongfooted** — enemy weaknesses hidden (`wrongfootedMode`)
- [x] **Masochist** — durability + inventory weight on (`masochistMode`)

### Accessibility (§E14.2)
- [x] Colorblind-safe element colors — P key toggles colorblind mode
- [x] "Telegraph emphasis" toggle — T key adjusts tell opacity
- [x] Remappable keys — K key opens key remapping panel

### Acceptance criteria
- [x] Full descent shows varied room archetypes + floor hazard + rare anomaly
- [x] Hazard rooms spawn floor-appropriate threats (puffballs F3, fire/oil F5, thin ice F6, etc.)
- [x] Radiant Blessing and weapon infusion give meaningful pre-descent decisions

---

## Cross-cutting tasks

- [x] `wiki/monsters.md` — affinity data, hitzones, new families (P10), ELEM_CHART note (P12)
- [x] `wiki/items.md` — consumables, tonics, throwables, uniques, jewels, runes, alchemy, Armory infusion, Chapel/Sage's Tower services (P12)
- [x] `wiki/mechanics.md` — damage pipeline, PHYS_CHART, ELEM_CHART, status-by-source, tile interactions, specializations, weapon masteries, run modifiers, Radiant Blessing, weapon infusion (P12)
- [x] `wiki/dungeon.md` — room archetypes, per-floor hazards, secrets/cracked walls, investigation clues (P12)
- [x] `wiki/characters.md` — skill trees per class (P11), specializations, weapon masteries, run modifiers, companion commands + hardcore toggle (P12)
- [x] Type-check clean: `npx tsc --noEmit` — 0 errors
- [x] Save migration safe: all new fields optional (`hardcoreCompanions?`, `infusedElement?`) — existing saves load unchanged

---

*Last updated: 2026-06-14 · P7–P12 complete · All phases done*
