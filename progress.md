# Night Dungeon — Progress Tracker

> Based on `DUNGEON_RPG_SPEC.md` + `DUNGEON_RPG_DESIGN_FULL.md`.
> Update this file whenever a feature ships.

---

## Phase Roadmap

| Phase | Status |
|-------|--------|
| P0 — Walk-around prototype | ✅ Done |
| P1 — Main menu + character creation | ✅ Done |
| P2 — Town hub + UIScene HUD | ✅ Done |
| P3 — FloorGenerator, warp pads, floors 1–10 | ✅ Done |
| P4 — Combat, enemy AI, loot, inventory | ✅ Done (basic) |
| P5 — Supabase auth + SaveManager, permadeath wipe | ✅ Done |
| **P6 — Art pass, SFX/music, balancing, polish** | 🔄 Current |

---

## §11 — Combat Core (real-time, MH-weight)

- [x] Basic melee attack (spacebar, hitbox)
- [x] Post-hit i-frames (invulnerability window after taking damage)
- [x] Ranged attack (projectile from bow/staff)
- [x] Weapon switching (Q key, 2 slots)
- [x] Combat state machine (IDLE → STARTUP → ACTIVE → RECOVERY)
- [x] Startup / active / recovery frames per attack (light: 167/67/267ms, heavy: 267/67/433ms)
- [x] Dodge roll with dedicated i-frames (Z key, i-frames ms 50–150 of 200ms roll)
- [x] Roll cancel into light attack recovery (dodge allowed during light recovery, not heavy)
- [x] Stamina bar (second resource under HP — yellow bar in UI)
- [x] Stamina costs: dodge 25, light 8, heavy 22
- [x] Exhausted state (0 stamina → no dodge/heavy, −25% move speed)
- [x] Heavy attack (X key, MV 0.55, no roll cancel, orange tinted slash)
- [x] Poise system (accumulate poise damage per hit → stagger at 15% of enemy max HP threshold)
- [x] Knockback (player: impulse + decay on hit; enemy: impulse + AI override after stagger)
- [x] Damage formula (MV × attackDmg × STR scaling × crit multiplier)
- [x] Crit chance from AGI (3% base + 0.6% per AGI); crit damage ×1.35; yellow float text
- [x] Potion drink = 1.5s rooted channel (1/2/3 hotbar keys, dodge cancels and wastes item)
- [x] Spawn-protection (1.0s no damage after floor load)
- [x] 0.3s input buffer on dodge/attack
- [x] Damage float numbers (white normal, yellow crit, green heal, blue MP)
- [x] Guard / block (shield-capable classes — Tanker; G key, stamina drain, guard window)
- [x] Perfect guard (6-frame/100ms window → 0 damage, stagger attacker 800ms)
- [x] Parry (weapon skill, tight window → riposte) — needs §14 skill system
- [ ] Hitzones per enemy (weak points, armored parts) — needs §19 boss system
- [x] Aggro / threat table (lightweight `threatMap` on Enemy, `addThreat('player', dmg)` on every hit)
- [x] No-facetank enforcement: range asymmetry (ENEMY_ATTACK_RANGE=50 > player light-attack reach ~44px)

---

## §12 — Stats & Progression

- [x] Core stats (HP, MP, STR, DEX, INT, VIT, AGI)
- [x] XP gain from kills
- [x] Level up
- [x] Race modifiers applied at character creation
- [x] Class base stats
- [x] Derived stats from formulas (maxStamina, physAtk, defense, critChance, critDmg, dodgeChance, moveSpeed)
- [x] Manual stat point allocation on level up (+5 per level; C key → character screen panel with +1 buttons)
- [x] Soft caps (STR/DEX/INT scaling bends past 60 — ×0.6 coefficient)
- [x] XP curve: `round(50 × level^1.6)` (implemented in `expForLevel()`)
- [x] Level cap 50 (`LEVEL_CAP = 50` in config)
- [x] Respec at Sage's Tower (escalating gold: `100 × level² / 2`; new SagesTowerScene)

---

## §13 — Weapon Archetypes & Movesets

- [x] Sword / Long Sword (basic melee)
- [x] Bow (basic ranged)
- [x] Staff (basic magic projectile)
- [x] Weapon family data schema (`WeaponMoveset`, `AttackMove` with mv/startup/active/recovery)
- [x] Motion values (MV) per attack
- [x] Light combo chains per family
- [x] Heavy attack (hold/charge) per family
- [x] Special / gauge move per family
- [x] Greatsword (charge tiers, no roll-cancel)
- [x] Twin Daggers (flurry, backstab, Frenzy toggle)
- [x] Mace / Hammer (blunt poise damage, KO build-up)
- [x] Spear / Halberd (reach, brace counter-thrust)
- [x] Crossbow (reload rhythm, pierce)
- [x] Tome + Focus (glyph placement + detonation)
- [x] Gauntlets / Claws (Flow stacks on consecutive perfect dodges)
- [x] Edge / sharpness system (0–100, decays per hit, Whetstone restore)
- [x] Ammo system for bows/crossbows
- [x] Weapon gauge (Edge gauge, Charge gauge, etc.)

---

## §14 — Class Identity, Skills & Skill Trees

- [x] Class selection at character creation (Swordman, Archer, Tanker, Assassin, Sage)
- [x] Class weapon access restrictions (basic)
- [x] Skill tree data (`SkillNode`, `ClassSkillTree` with branches × tiers)
- [x] Skill points (1/level + boss-clear bonuses)
- [x] Active skills (on cooldown, costing MP or stamina)
- [x] Passive skill nodes
- [x] Skill unlock / tree progression
- [x] Swordman — Riposte stance + Blade / Guard / Tempo branches + capstone
- [x] Archer — Coating loadout + Precision / Volley / Survival branches + capstone
- [x] Tanker — Taunt + Bastion + Aegis / Provoke / Impact branches + capstone
- [x] Assassin — Stealth + Shadow / Venom / Tempo branches + capstone
- [x] Sage — Element swap + Pyromancy / Glyph / Mysticism branches + capstone
- [x] Cooldown timers on active skills
- [x] Ultimate / capstone cooldowns (40–90s)

---

## §15 — Status Effects & Elemental Reactions

- [x] Ailment build-up meters (show before trigger)
- [x] Ailment duration bars after trigger
- [x] Poison (DoT, ignores some defense)
- [x] Bleed (DoT worsens while moving)
- [x] Burn (DoT + −defense; roll to extinguish)
- [x] Freeze / Chill (−speed; full freeze = stun)
- [x] Shock / Paralysis (periodic stun-lock)
- [x] Stun / KO (blunt, mash to recover)
- [x] Curse (−max HP until cleansed)
- [x] Webbed / Rooted (can't move)
- [x] Resistance system (race/gear modifiers)
- [x] Elemental triangle (Fire, Ice, Lightning, Void, Light)
- [x] Reactions: Fire+Ice → Shatter, Fire+Lightning → Overload, Ice+Lightning → Superconduct
- [x] Water-soaked amplification (+50% lightning, −50% fire)
- [x] Environmental hazards (oil pools, water, ice patches, gas)

---

## §16 — Items & Equipment

- [x] Basic item data schema (`BaseItem` with id/name/kind/rarity/icon)
- [x] Consumables (HP potions, MP potions)
- [x] Basic weapons and armor in item tables
- [x] Inventory system (add/remove/use)
- [x] Equipment slots (weapon, offhand)
- [x] Full rarity tiers (Common → Uncommon → Rare → Epic → Legendary → Mythic)
- [x] Affix system (rolled on gear: +STR, +critChance, lifesteal%, etc.)
- [x] Set bonuses (2-piece / 4-piece, themed to bosses)
- [x] Full equipment slots: head, chest, hands, legs, boots, amulet, ring1, ring2, charm
- [x] Armor weight penalty (move speed + roll distance)
- [x] Full weapon catalog (10 families × ~10 weapons with upgrade trees)
- [x] Full armor catalog (~6 sets per floor)
- [x] All consumables (Whetstone, Smoke Bomb, Traps, Camp Kit, Warp Crystal, etc.)
- [x] Material items (monster parts, ores, essences, herbs)
- [x] Inventory grid UI with drag-drop
- [x] Equipment paper-doll with stat diff preview (green/red deltas)
- [x] Compare tooltips
- [x] Sort / filter / mark-as-junk

---

## §17 — Crafting, Upgrading & Enchanting

- [x] Blacksmith upgrade trees (branching, spend gold + mats)
- [x] Boss-part forging (rare mats → signature weapon/armor set)
- [x] Enchanting at Sage's Tower (reroll affixes, socket runes, transmute)
- [x] Rune sockets on gear
- [x] Transmute (junk mats → chance at higher mat)
- [x] Durability / repair (Masochist toggle, off by default)

---

## §18 — Enemies & Bestiary

- [x] Chaser AI (pathfind → melee)
- [x] Lurker / ambush variant
- [x] Basic alert / detect ranges (sight + sound)
- [x] Per-floor enemy themes with `floorMin`
- [x] Enemy drop table (item + chance)
- [ ] Full AI archetypes: Skirmisher, Ranged, Charger, Caster, Swarm, Support, Brute
- [ ] Composable AI state data (behavior list per enemy def)
- [ ] Anticipation frames + SFX telegraph on each attack
- [ ] Stagger / flinch reactions to player poise damage
- [ ] Leash range (enemy returns home if player flees far)
- [ ] Elite modifier system (1 affix roll on spawn)
- [ ] Champion modifier (2–3 affixes, mini-boss HP, guaranteed rare drop + breakable part)
- [ ] Elite visual tints / auras
- [ ] Full floor 1–10 enemy roster (~40 enemy defs)
- [ ] Spawn director (budget-based density, ambush pockets, anomaly rolls)

---

## §19 — Floor Bosses (1–10)

- [ ] Boss state machine (phases, HP thresholds, attack pools)
- [ ] Breakable parts (focus damage → stagger → rare mat drop)
- [ ] Phase transitions (new attack pool + arena event)
- [ ] Boss HP bar UI with part-break pips
- [ ] Enrage / soft timer
- [ ] Floor 1: Goblin Warlord
- [ ] Floor 2: The Drowned King
- [ ] Floor 3: Brood Matron
- [ ] Floor 4: Sir Mordrek, Fallen Captain
- [ ] Floor 5: Forgefather Brand
- [ ] Floor 6: Frost Warden Ysold
- [ ] Floor 7: The Hollow Choir
- [ ] Floor 8: Riftmaw
- [ ] Floor 9: The Ascendant Twins
- [ ] Floor 10: The Sovereign / Dungeon Heart (multi-phase finale)

---

## §20 — Anomalies (Rare World Events)

- [ ] Anomaly registry (`AnomalyDef` data + `AnomalySystem`)
- [ ] Spawn director rolls anomaly per floor (22% base chance)
- [ ] Ambient announce cue (screen tint, music sting, HUD whisper)
- [ ] 🌀 Dimensional Rift (otherworld arena, Rift Boss, Mythic drops)
- [ ] 🌀 Mirror Rift (fight your own shade / build)
- [ ] 🕯️ Secret Summon: The Gravelord (light 4 candles)
- [ ] 🕯️ Secret Summon: Avarice, the Gilded Maw (carry gold threshold)
- [ ] 🕯️ Secret Summon: The Clockwork Judge (no-damage champion kill)
- [ ] 🕯️ Secret Summon: Old Friend (3 journal pages + camp)
- [ ] 🕯️ Secret Summon: The Hungering Dark (full floor in dark)
- [ ] 🗡️ The Hunter (nemesis NPC, stalking, invasion, nemesis arc)
- [ ] 🛒 Wandering Merchant
- [ ] ⚖️ Cursed Bargain Shrine (boon for permanent curse)
- [ ] 🎲 Gambler's Chest (mimic or jackpot)
- [ ] ⛓️ The Caged Ally (free them → temporary/permanent companion)
- [ ] 🌑 Blood Moon (floor-wide elite roll, doubled drops)
- [ ] 📜 Echo of a Fallen Hero (duel past dead run, recover lost gold)
- [ ] 🐾 Beast Stampede

---

## §21 — Camping & Survival

- [ ] Camp Kit consumable item
- [ ] `campable` room flag in FloorGenerator
- [ ] Camp setup (hold E, ~3s channel, enemies interrupt)
- [ ] Rest (60% HP, 50% MP restore; advances danger clock)
- [ ] Ambush roll on rest (rises with floor + noise level)
- [ ] Watch system (companion reduces ambush chance)
- [ ] Cooking system (Ration + Mat → timed buff meals)
- [ ] Meal variety: Hearty Stew, Spiced Skewers, Iron Porridge, Hunter's Tea, Mage's Broth, Trailmix
- [ ] Camp basic crafting (potions from herbs, arrows, whetstones)
- [ ] Loadout stash swap at camp

---

## §22 — Companion / Ally NPC System

- [ ] `CharacterAI` module (shared brain for companions, Hunter, shade)
- [ ] AI alignment parameter (ally vs hostile)
- [ ] Companion recruit via Caged Ally anomaly
- [ ] Companion recruit via Guild in Town
- [ ] Story companion "Old Friend" (secret boss unlock)
- [ ] Companion roles (Tanker aggro, Archer poke, Sage heal)
- [ ] Command wheel (Aggressive / Defensive / Follow / Hold / Focus / Regroup)
- [ ] Companions consume their own potions; shareable at camp
- [ ] Companion permanent death
- [ ] Loyalty / banter system (affinity, camp dialogue, combat bonuses)
- [ ] Companion fatigue (needs rest at camp)
- [ ] Boss arenas that limit companions (e.g., Ascendant Twins = solo)

---

## §23 — Town 2.0 (Expanded Hub)

- [x] Dungeon Gate
- [x] Blacksmith / Armory (basic buy/sell)
- [x] Alchemist / Item Shop (Emporium)
- [x] Inn (full HP/MP rest, paid)
- [x] Chapel (basic NPC)
- [x] Sage's Tower (respec stats; escalating gold cost, restores all level×5 points)
- [ ] Sage's Tower enchanting (reroll affixes, socket runes, transmute) — needs §17
- [ ] Adventurer's Guild (bounty board, hire companions, graveyard / run history)
- [ ] Wandering stalls (daily-rotating rare vendor)
- [ ] Bounty board (procedural bounties: kill X, break Y, reach floor Z)
- [ ] Town NPC banter reacting to player progress
- [ ] Hall of Champions display (victorious runs)
- [ ] Checkpoint-floor start option at Gate (Option B, account-level)

---

## §24 — Economy, Loot Tables & Drop Rates

- [x] Gold as currency
- [x] Basic drop table per enemy (item + chance)
- [ ] Full weighted drop tables in `src/data/loot.ts`
- [ ] Condition drops ("only if part broken", "only on Champion")
- [ ] Floor number shifts table toward higher tiers
- [ ] Pity / anti-streak mechanic (nudge weight on dry streaks)
- [ ] Gold sinks balanced (upgrades, consumables, inn, reroll, hiring, warp crystals)
- [ ] Optional inventory weight cap (Masochist toggle)

---

## §25 — Floor 10, Endgame & Post-Death

- [ ] Floor 10 elite gauntlet corridor
- [ ] Victory sequence (slow-mo finisher, credits-style epilogue)
- [ ] Hall of Champions (permanent record across all characters)
- [ ] Checkpoint-floor unlocks at Gate (Option A pure / Option B bonfire)
- [ ] New Game+ / Ascension mode (harder dungeon, remixed bosses, hidden floor 11)
- [ ] Lore frame ("dungeon resets reality on death") surfaced in world

---

## §26 — Difficulty, Death & Permadeath UX

- [x] Permadeath (save deleted on death)
- [x] Death → character creation loop
- [ ] Death sequence: slow-mo + desaturate + frozen killing blow on screen
- [ ] Cause-of-death banner ("Felled by Frost Warden Ysold — Floor 6 — Run #14 — 1h 22m")
- [ ] Run summary screen (floors cleared, bosses slain, biggest hit, gold, rarest find)
- [ ] `run_history` table in Supabase (never wiped, account-level)
- [ ] Graveyard browser in Guild
- [ ] Difficulty modifiers at character creation: Masochist, Ironbound, Starved, Hunted, Blackout
- [ ] Cosmetic titles for stacked modifiers (recorded in Hall of Champions)
- [ ] Local telemetry logging (what kills players + where) for balancing

---

## §27 — UI / HUD

- [x] HP bar
- [x] MP bar
- [x] Gold display
- [x] Floor number display
- [x] Basic hotbar (consumable shortcuts)
- [x] Stamina bar (yellow, between HP and MP)
- [ ] Active ailment icons + remaining duration timers
- [ ] Edge / ammo indicator
- [ ] Skill cooldown pips
- [ ] Minimap (corner, fog of war, marks warp pads / camps / anomalies)
- [ ] Boss UI (named HP bar at top, part-break pips, phase indicator)
- [ ] Damage numbers (color-coded: white normal, yellow crit, element-tinted, grey bounced)
- [ ] Toggleable damage numbers
- [ ] Telegraph feedback (screen-edge flash / directional indicator for off-screen wind-ups)
- [ ] Full inventory grid (drag-drop)
- [ ] Equipment paper-doll (stat diff green/red)
- [ ] Hover tooltips (every status / affix / stat explained)
- [ ] Map overlay (revealed-as-explored, hidden things stay hidden)

---

## §28 — Audio

- [ ] Per-floor ambient themes (10 floors)
- [ ] Town music
- [ ] Boss themes (10)
- [ ] Anomaly spawn sting
- [ ] Victory / death stings
- [ ] Enemy wind-up SFX (the tells) per enemy type
- [ ] Hit / bounce / parry / potion / footstep SFX
- [ ] Hunter footstep ambient warning
- [ ] Rift hum ambient warning
- [ ] Blood Moon drone ambient warning
- [ ] Damage SFX scaled by damage amount
- [ ] "Bounce" clink on low Edge
- [ ] Low-HP heartbeat
- [ ] Potion drink glug (reminds player they're rooted)
- [ ] Perfect-dodge / parry "ping"
- [ ] Global volume + mute control
- [ ] "Audio cues only" accessibility option

---

## §29 — Extended Data Models (TypeScript)

- [x] `RaceId`, `ClassId`, `Stats`, `CharacterSave` (v1)
- [x] `ItemStack`, basic item interfaces
- [ ] `Element`, `Ailment`, `WeaponFamily` types
- [ ] `HitboxShape`, `AttackMove`, `WeaponMoveset`
- [ ] `Rarity`, `EquipSlot`, `ItemKind`, `Affix`
- [ ] `WeaponItem`, `ArmorItem`, `ConsumableItem` (full schemas)
- [ ] `SkillNode`, `ClassSkillTree`
- [ ] `AIRole`, `Hitzone`, `EnemyDef` (full with hitzones + attacks)
- [ ] `EliteAffix`, `BossPhase`, `BossDef`
- [ ] `CharacterAIProfile`
- [ ] `AnomalyId`, `AnomalyDef`
- [ ] `Companion`, `ActiveBuff`
- [ ] `CharacterSaveV2` (superset of v1 + all new fields)
- [ ] `RunHistoryEntry`, `AccountMeta`
- [ ] `SaveManager` migration: v1 → v2

---

## §30 — Systems & Folder Structure

- [x] `src/systems/InputController.ts`
- [x] `src/systems/FloorGenerator.ts`
- [x] `src/systems/SaveManager.ts`
- [x] `src/systems/Fov.ts`
- [x] `src/lib/inventory.ts`
- [ ] `src/systems/CombatSystem.ts` (tick, state machines, damage resolution)
- [ ] `src/systems/StaminaSystem.ts`
- [ ] `src/systems/AilmentSystem.ts` (status + elemental reactions)
- [ ] `src/systems/EffectSystem.ts` (resolve consumable/skill effects)
- [ ] `src/systems/LootSystem.ts` (roll drop tables)
- [ ] `src/systems/InventorySystem.ts` (full grid + equip logic)
- [ ] `src/systems/SkillSystem.ts` (trees, cooldowns, active skills)
- [ ] `src/systems/AIController.ts` (enemy archetype behaviors)
- [ ] `src/systems/CharacterAI.ts` (companions / Hunter / shade shared brain)
- [ ] `src/systems/SpawnDirector.ts` (density + ambush + anomaly rolls)
- [ ] `src/systems/AnomalySystem.ts` (registry + triggers)
- [ ] `src/systems/CampSystem.ts` (rest, cook, ambush rolls)
- [ ] `src/systems/CraftingSystem.ts` (upgrade trees, enchant, transmute)
- [ ] `src/systems/EconomySystem.ts` (shops, bounties, prices)
- [ ] `src/entities/Boss.ts`
- [ ] `src/entities/Companion.ts`
- [ ] `src/entities/Hunter.ts`
- [ ] `src/entities/Projectile.ts` (proper entity)
- [ ] `src/entities/Hitbox.ts`
- [ ] `src/entities/RiftPortal.ts`
- [ ] `src/entities/CampSite.ts`
- [ ] `src/entities/Chest.ts`
- [ ] `src/entities/Merchant.ts`
- [ ] `src/scenes/InventoryScene.ts` (overlay)
- [ ] `src/scenes/BossArenaScene.ts`
- [ ] `src/scenes/OtherworldScene.ts` (rift arenas)
- [ ] `src/scenes/DeathScene.ts` (death cam + run summary)
- [ ] `src/scenes/HallOfChampionsScene.ts`
- [ ] `src/data/weapons.ts` + `movesets.ts`
- [ ] `src/data/skills.ts`
- [ ] `src/data/enemies.ts` (full 40 defs with hitzones)
- [ ] `src/data/bosses.ts`
- [ ] `src/data/loot.ts`
- [ ] `src/data/affixes.ts` + `sets.ts`
- [ ] `src/data/anomalies.ts`
- [ ] `src/data/meals.ts`
- [ ] `src/data/bounties.ts`
- [ ] `src/config.ts` expanded with `TUNING` object (§31)

---

## §31 — Balancing (Tuning Knobs)

- [x] `TUNING` constant object in `src/config.ts` (stamina, dodge frames, crit, poise, input buffer, spawn protection, knockback, potion channel)
- [ ] Remaining TUNING knobs: guard window, level curve, edge decay, floor scaling, elite chance, anomaly weights, camp rest %, rarity weights
- [ ] Difficulty dial (`difficultyMod` multiplier)
- [ ] Telemetry-driven balance iterations

---

## §32 — Content & Asset Checklist

### Sprites / Atlases
- [x] Player sprites (swordman, archer, tanker, assassin, sage — idle/walk/attack)
- [x] Cave enemy sheets (goblin, bat, spider, skeleton, golem, troll — idle/walk)
- [x] Floor 2 enemy sheets (forest, deadland, pond, rock themes)
- [ ] All 5 races × 5 classes (4-dir, idle/walk/attack/hurt/die)
- [ ] Weapon overlays per family (10) on player sprite
- [ ] Elite tint variants for all enemies
- [ ] 10 boss sheets (multi-phase, break-state variants)
- [ ] Hunter + companion sheets (reuse player rig)
- [ ] Anomaly visuals (rift portal, shrines, mimic, merchant, echo ghost)
- [ ] Tilesets: remaining 8 floor themes + otherworld + camp props
- [ ] Full item icons (weapons, armor, consumables, materials — 32×32 + 16×16 hotbar)
- [ ] VFX (slashes, projectiles, elements, ailment overlays, perfect-dodge ping, break/shatter)

### Audio
- [ ] All items listed in §28

### Data Content
- [ ] ~10 weapons per family (upgrade trees)
- [ ] ~6 armor sets per floor
- [ ] Boss-part sets ×10
- [ ] Affix pool (~30) + uniques (~20) + runes (~12)
- [ ] Skill trees ×5 classes (13 nodes each)
- [ ] Full enemy defs (~40) + drop tables
- [ ] Boss defs ×10
- [ ] Anomaly defs (~15)
- [ ] Consumables / materials / meals / bounties tables

### Systems Sign-off (§10 "Brutal but Fair" Contract)
- [ ] Every enemy & boss attack is telegraphed (anticipation frame + SFX)
- [ ] Spawn-protection (1.0s no damage after load) verified
- [ ] Off-screen ranged attacks to player blocked
- [ ] 0.3s input buffer on dodge/attack verified
- [ ] Death cam + cause-of-death banner working
- [ ] Run summary screen working
- [ ] Permadeath wipe verified; account-meta survives the wipe
