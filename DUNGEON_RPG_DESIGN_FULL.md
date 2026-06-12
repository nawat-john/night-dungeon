# Dungeon RPG — Full Systems Design (Companion Spec)

> **Companion to `DUNGEON_RPG_SPEC.md`.** That file is the scaffold + Phase 0–3 source of truth.
> **This file** is the source of truth for everything *after* you can walk around: combat, progression,
> weapons, skills, items, crafting, enemies, bosses, rare events, camping, companions, the expanded town,
> economy, difficulty, and the data models / roadmap to build it all.
>
> **Design target:** the depth and gear-treadmill of *Monster Hunter*, wrapped in a roguelike,
> **single-life permadeath** shell. Combat is deliberate, telegraphed, and **punishing**. One mistake can
> end a 4-hour run. That pain is the point.
>
> All in-game text is **English**. TypeScript stays **strict** (no `any`). Game logic stays **client-side**.
> Numbers in this document are **starting points for tuning**, gathered into §31 so balancing lives in one place.

---

## Table of contents

- §10 — Design philosophy: the "brutal but fair" contract
- §11 — Combat core (real-time, MH-weight)
- §12 — Stats & progression (formulas)
- §13 — Weapon archetypes & movesets
- §14 — Class identity, skills & skill trees
- §15 — Status effects & elemental reactions
- §16 — Items & equipment catalog
- §17 — Crafting, upgrading & enchanting
- §18 — Enemies & bestiary
- §19 — Floor bosses (1–10)
- §20 — Rare world events ("Anomalies") — the weird stuff
- §21 — Camping & survival
- §22 — Companion / ally NPC system
- §23 — Town 2.0 (expanded hub)
- §24 — Economy, loot tables & drop rates
- §25 — Floor 10, endgame & "what comes after death"
- §26 — Difficulty, death & permadeath UX
- §27 — UI / HUD
- §28 — Audio direction
- §29 — Extended data models (TypeScript)
- §30 — Extended roadmap & folder additions
- §31 — Balancing appendix (tuning knobs)
- §32 — Content & asset checklist

---

## §10 — Design philosophy: the "brutal but fair" contract

The game is hard on purpose, but it must never feel *cheap*. Difficulty comes from the player's knowledge
and execution gaps, not from hidden information or unavoidable damage. Bake these rules into every system:

1. **Every lethal hit is telegraphed.** Enemies wind up. Big attacks get a clear anticipation frame, a sound
   cue, and (for bosses) a directional tell. If a player dies, they should be able to name the mistake.
2. **Damage is high, healing is slow.** Potions heal over ~1.5s (you are vulnerable while drinking, MH-style),
   not instantly. You cannot facetank. Positioning > stat-checking.
3. **Stamina gates aggression.** Dodging, sprinting, and heavy attacks cost stamina. Run out and you are
   exposed. This forces rhythm instead of button-mashing.
4. **The dungeon is a resource war.** You descend with finite potions, arrows, throwables, and gear durability.
   Town is far. Floors are long. Greed kills.
5. **Permadeath is sacred.** No revives, no checkpoints inside the dungeon. The Inn full-heals; camps partially
   heal at real risk (§21). Death wipes the save (§26). The *threat* of loss is the core emotion.
6. **Knowledge is the meta-progression.** Since the character resets, the *player* is what levels up: learning
   tells, routes, summon conditions, and build theory. Track run history (§26) so that knowledge feels earned.
7. **Build diversity is mandatory.** With one life, players need agency over *how* they die trying. Many
   viable weapon/skill/gear combinations (§13–§17) keep runs fresh.

**Anti-frustration guarantees (the "fair" half):**
- No damage during scene transitions, menu opens, or the first 1.0s after a floor/camp load (spawn-protection).
- Off-screen enemies do not deal ranged damage to the player.
- A 0.3s input buffer on dodge/attack so queued inputs feel responsive.
- Status effects always show a HUD icon + remaining duration.
- The killing blow shows a slow-mo death cam + a one-line cause-of-death ("Slain by an Ash Revenant on Floor 6")
  so the loss reads as a *story*, not a glitch.

---

## §11 — Combat core (real-time, MH-weight)

Arcade real-time combat on Phaser arcade physics. Top-down. The feel target is **weighty and committed**:
attacks have startup, active, and recovery frames; you cannot cancel freely; dodging is your main defense.

### 11.1 The combat tick

Run combat on a fixed logical step (e.g. 60 Hz) independent of render. Each combatant is a state machine:

```
IDLE → MOVE → (ATTACK_STARTUP → ATTACK_ACTIVE → ATTACK_RECOVERY) → IDLE
                 ↘ DODGE (i-frames) ↘ GUARD ↘ HITSTUN ↘ STAGGER ↘ DEAD
```

- **Startup frames:** wind-up, no hitbox yet (this is the telegraph).
- **Active frames:** hitbox live; this is when damage lands.
- **Recovery frames:** you are committed and vulnerable. Heavier attacks = longer recovery.
- Transitions are gated: you cannot dodge during recovery unless a skill grants a cancel.

### 11.2 Stamina (the aggression budget)

A second resource bar under HP. Default **max 100**, regen **+18/s** after a **0.6s** delay since last spend.

| Action | Stamina cost |
|---|---|
| Dodge roll | 25 |
| Sprint | 12 / s |
| Light attack | 8 |
| Heavy attack | 22 |
| Guard (hold) | 0 to hold; on block, drains by `incomingPoise` |
| Perfect guard / parry | 0 (refunds 10 on success) |
| Special / weapon-gauge moves | varies (see §13) |

- **Exhausted state:** at 0 stamina you cannot dodge or heavy-attack; movement −25%; a brief "winded" SFX.
- Some foods/skills raise max stamina or regen (§14, §21).

### 11.3 Dodge roll & i-frames

The core survival tool. Tap dodge → short directional roll.

- **Roll:** 12 frames total; **i-frames on frames 3–9** (invulnerable). Frames 10–12 are recovery (you can be hit).
- Reading the boss tell and rolling *into* the active window is the skill ceiling.
- **Roll cancel:** light attacks can cancel into a roll on their recovery (so combos stay safe-ish).
- Class/skill mods: Assassin gets +2 i-frames; Tanker rolls shorter with a guard-frame instead (§14).

### 11.4 Guard, perfect guard & parry

For shield/guard-capable kits (Tanker, some weapons):
- **Guard:** hold to block from the facing arc. Reduces damage by `block%` (gear-based, 50–90%), costs stamina
  equal to the hit's poise value; chip damage = 10% of blocked.
- **Perfect guard:** guard within a **6-frame** window before impact → 0 damage, 0 chip, no stamina loss,
  attacker gets **stagger** (opening for a riposte).
- **Parry (weapon skill):** active parry move with a tight window → deflect + guaranteed crit riposte.

### 11.5 Poise, stagger & knockback

- **Poise** = resistance to flinching. Player poise from armor weight; enemy poise from size/tier.
- Hits carry a **poise damage** value. Accumulate ≥ target poise within a window → **stagger** (free hits).
- **Knockback** scales with hit weight; bosses are immune except on weak-point breaks (§19).
- Heavy enemies "super-armor" through your light hits — you must time around their attacks, not trade.

### 11.6 Damage formula

Physical:

```
raw      = motionValue × weaponAttack × (1 + STR_or_DEX_scaling) × comboMultiplier
mitig    = raw × (100 / (100 + targetDefense))
elem     = elementalAttack × elementMultiplier(target) × hitzoneElemMod
hitzone  = hitzoneRawMod   // weak point e.g. 1.4, armored part e.g. 0.6
crit     = isCrit ? critDamage(1.35 base) : 1.0
final    = (mitig × hitzone + elem) × crit × randVariance(0.97..1.03)
```

- `motionValue` (MV) is per-attack (see §13). A heavy combo finisher might be MV 0.9; a light poke MV 0.18.
- **STR scaling** for STR weapons, **DEX scaling** for DEX/ranged, **INT** for magic (§12).
- **Hitzones:** every enemy defines weak points (high `hitzoneRawMod`) and tough parts. Aiming matters.
- **Crit chance** from AGI + gear; **crit damage** default ×1.35, raisable via skills/affixes.

### 11.7 Aggro / threat

Lightweight threat model so companions and multi-enemy fights read well:
- Each enemy tracks a threat table. Damage adds threat; Tanker taunts multiply it; healing adds partial threat.
- Enemies retarget to the highest-threat valid target in range. Stealth (Assassin) and Smoke Bomb wipe threat.

### 11.8 The "no-facetank" rule, enforced

To keep the MH feel, the engine should make trading damage a losing strategy by default:
- Potion drink = 1.5s rooted channel (movement locked, dodge cancels and wastes the potion).
- Enemy contact damage exists (touching a boss hurts), so you cannot stand inside them.
- Most enemy attacks out-range your light attacks slightly, so you must close, hit, and retreat.

---

## §12 — Stats & progression (formulas)

### 12.1 Core stats

`HP, MP, STR, DEX, INT, VIT, AGI` (as in SPEC §4.2). Derived stats are computed, never stored raw:

```
maxHP      = 40 + VIT × 8  + level × 6   + gearHP
maxMP      = 10 + INT × 5  + level × 2   + gearMP
maxStamina = 100 + floor(AGI × 1.5)      + gearStam
physAtk    = STR (melee STR weapons) or DEX (ranged/finesse)   // feeds weaponAttack scaling
magAtk     = INT
defense    = VIT × 1.2 + gearDef
critChance = clamp(3% + AGI × 0.6%, 0, 60%)
critDmg    = 135% + gearCritDmg
dodgeChance= clamp(AGI × 0.4%, 0, 30%)    // passive "lucky dodge" on top of i-frames
moveSpeed  = base × (1 - armorWeightPenalty)
```

Soft caps: scaling on STR/DEX/INT bends down past 60 (×0.6 per point above 60) to prevent runaway builds.

### 12.2 Leveling

- XP from kills, scaled by enemy tier and floor. Boss kills are big lumps.
- **Curve:** `xpToNext(level) = round(50 × level^1.6)`. Slow on purpose — you out-skill, not out-grind.
- **Level cap 50.** Reaching cap is rare in a single life; it's an aspirational flex, not an assumption.
- Each level: **+5 stat points** to allocate manually + small auto HP/MP per the formulas above.
- Respec only at the town **Sage's Tower** for escalating gold (discourage save-scum-style fishing).

### 12.3 Race & class application

At creation: `final = classBase + raceModifier`. Race mods from SPEC §4.1, expressed as flat deltas, e.g.
Barbarian `{ str:+3, vit:+2, hp:+20, int:-3 }`. Class base stat blocks live in `src/data/classes.ts`.

### 12.4 The power fantasy curve (per floor)

Players should feel under-geared on a fresh floor and over-geared right before the next, *if they explored*.
Tuning intent per floor band:

| Floors | Player should be | Enemy DPS vs player HP | Notes |
|---|---|---|---|
| 1–3 | Learning | low | tutorialize tells, status, stamina |
| 4–6 | Comfortable if careful | medium | elemental weaknesses start mattering |
| 7–9 | Always tense | high | elites common, anomalies appear |
| 10 | At the edge | lethal | the boss gauntlet |

---

## §13 — Weapon archetypes & movesets

Borrowing MH's best idea: **the weapon defines how you play**, more than the class does. A class gates *which*
weapon families you can wield and adds passive identity, but the moveset lives on the weapon. This is the single
biggest lever for "diverse characters" without writing 50 classes.

Each weapon family has: a **light combo**, a **heavy attack**, a **special** (often gauge-driven), a **mobility
quirk**, and **motion values (MV)** per move. Higher MV = more damage but more commitment.

### 13.1 Weapon families

| Family | Wielded by | Style | Special gauge / quirk |
|---|---|---|---|
| **Short / Long Sword** | Swordman, Elf, most | Balanced, safe pokes, roll-cancellable | *Edge* gauge: builds on hits, spend on a lunging Crescent Slash |
| **Greatsword** | Swordman, Dwarf, Barbarian | Slow, huge MV, charge attacks | *Charge*: hold heavy for 3 tiers; tier-3 = armor-breaking overhead |
| **Twin Daggers** | Assassin, Beastman | Fast, low MV, high crit, mobile | *Frenzy*: spend stamina to enter a fast-hit state; backstabs crit |
| **Mace / Hammer** | Tanker, Dwarf | Blunt, high poise damage, KO | *Impact*: blunt builds **Stun** on hitzones; can KO for free hits |
| **Spear / Halberd** | Tanker, Swordman | Reach, pokes, can attack while guarding | *Brace*: hold-guard counter-thrust |
| **Short / Long Bow** | Archer, Elf, Beastman | Ranged, charge shots, ammo coatings | *Coatings*: power/poison/para/elem arrows; aim at weak points |
| **Crossbow** | Archer | Bursty bolts, slow reload, pierces | *Reload* rhythm; pierce rewards lining up enemies |
| **Staff (Arcane)** | Sage, Elf | Mid-range magic, MP cost | *Channel*: hold to grow a spell; risk/reward |
| **Tome + Focus** | Sage | Set-and-detonate zoning, summons | *Glyphs*: place runes, detonate for combos |
| **Gauntlets / Claws** | Beastman, Assassin | Brawler, parry-heavy, fastest | *Flow*: consecutive perfect dodges build damage stacks |

> Implement weapons as data (`src/data/weapons.ts`) with a shared `WeaponMoveset` shape (see §29), not bespoke
> classes. A move = `{ name, mv, poiseDmg, staminaCost, startup, active, recovery, hitboxShape, cancelsInto[] }`.

### 13.2 Example moveset — Greatsword (the commitment weapon)

| Input | Move | MV | Startup→Active→Recovery (frames) | Notes |
|---|---|---|---|---|
| Light | Rising Slash | 0.32 | 10→4→16 | overhead, decent poise |
| Light×2 | Wide Slash | 0.40 | 8→5→20 | sweeps an arc |
| Heavy (tap) | Strong Slash | 0.55 | 16→4→26 | big commitment |
| Heavy (hold) | Charged Slash T1/T2/T3 | 0.7 / 1.0 / 1.4 | 30/55/80 charge | T3 staggers most non-bosses |
| Dodge→Heavy | Tackle | 0.25 | super-armor i-frames vs flinch | repositions through small hits |

The greatsword *cannot* roll-cancel its recovery — you must read the fight and commit at the right moment.
This is the clearest expression of the game's "commitment" philosophy.

### 13.3 Example moveset — Twin Daggers (the speed weapon)

| Input | Move | MV | Frames | Notes |
|---|---|---|---|---|
| Light spam | Flurry (4-hit) | 0.10 ea | 4→2→6 | roll-cancellable any time |
| Heavy | Lunging Stab | 0.30 | 8→3→12 | gap-closer |
| Special | Frenzy (toggle) | — | — | drains stamina/s; +40% atk speed, +i-frame on roll |
| Behind target | Backstab | 0.45 + guaranteed crit | 6→2→10 | pairs with stealth |

### 13.4 Sharpness analog: **Edge**

Melee weapons have an **Edge** value (0–100) that decays on hits (−1 per hit, −3 vs armored hitzones). Low Edge:
−damage, more bounces (your hit deflects and you eat recovery). Restore Edge with a **Whetstone** consumable
(2.0s rooted channel — another "don't do this near a boss" decision). Ranged weapons use **ammo** instead; magic
uses **MP**. This keeps every weapon type resource-juggling, MH-style.

---

## §14 — Class identity, skills & skill trees

Class = **identity + skill tree + weapon access + a signature mechanic**. Each class has a compact tree of
**passives** and **active skills** (on cooldown, costing MP or stamina). Players unlock nodes with **Skill Points**
(1 per level + boss-clear bonuses). Trees are small enough to fully clear near level cap but force real choices
mid-run.

Tree shape per class: **3 branches × 4 tiers = 12 nodes**, plus **1 capstone** that requires 8 nodes spent.

### 14.1 Swordman — *Tempo*
Signature: **Riposte stance** — a brief active-parry that turns a perfect block into a guaranteed crit lunge.

- **Blade branch:** +melee MV, combo extender (adds a 3rd light), +Edge retention.
- **Guard branch:** shorter perfect-guard timing, chip immunity, Bulwark (block from any direction briefly).
- **Tempo branch:** roll-cancel heavies, +stamina regen, *Momentum* (consecutive no-damage hits buff atk).
- **Capstone — Perfect Tempo:** a perfect dodge refunds the next skill's cooldown.

### 14.2 Archer — *Kiting & coatings*
Signature: **Coating loadout** — swap arrow coatings (power/poison/para/elemental) on the fly.

- **Precision branch:** +weak-point damage, +crit on charged shots, *Mark* (tag a foe; party hits it harder).
- **Volley branch:** multi-shot spread, rain-of-arrows zoning, ricochet.
- **Survival branch:** backstep shot (fire while dodging), +move speed while aiming, trap arrows.
- **Capstone — Deadeye:** charged shots that hit a weak point can **break parts** (see §19) at +50% rate.

### 14.3 Tanker — *Stand and punish*
Signature: **Taunt + Bastion** — pull aggro, then a stance that converts blocked damage into a counter shockwave.

- **Aegis branch:** +block%, perfect-guard window, reflect chip as damage.
- **Provoke branch:** AoE taunt, threat multipliers, *Last Stand* (under 25% HP → +defense).
- **Impact branch:** mace KO build-up, shield bash stun, ground slam AoE.
- **Capstone — Immovable:** cannot be knocked back; perfect guards emit a stagger shockwave.

### 14.4 Assassin — *Burst & disappear*
Signature: **Stealth** — Smoke Bomb or skill drops you out of threat; first hit from stealth is a guaranteed crit.

- **Shadow branch:** longer stealth, +backstab crit, vanish-on-kill.
- **Venom branch:** apply poison/bleed on crit, +damage to ailing foes, *Rupture* (detonate bleed stacks).
- **Tempo branch:** +dodge i-frames, *Flow* dagger stacks, dash-attack resets on kill.
- **Capstone — Death Mark:** mark a foe; if you land a backstab within 5s, deal a huge execute (scales with missing HP — busted on elites, capped vs bosses).

### 14.5 Sage — *Zone control & support*
Signature: **Element swap** — fire/ice/lightning stance changes spell behavior and reaction potential (§15).

- **Pyromancy/Elements branch:** +magic MV, lingering ground hazards, elemental detonation combos.
- **Glyph branch:** place runes that explode, slow, or heal-zone; chain detonations.
- **Mysticism branch:** MP efficiency, shields/heals (works on companions), *Cleanse* status.
- **Capstone — Convergence:** detonating two different elements on one target triggers a big **reaction** (§15).

### 14.6 Cooldowns, MP, and the "no infinite combos" rule
Active skills have **cooldowns** and most cost **MP** (Sage) or **stamina** (martials). No skill is spammable
to the point of trivializing tells. Ultimates (capstone-adjacent actives) have 40–90s cooldowns and are run-defining
moments, not rotation filler.

---

## §15 — Status effects & elemental reactions

### 15.1 Ailments (apply to player and enemies)

| Ailment | Build-up source | Effect | Cure |
|---|---|---|---|
| **Poison** | venom weapons, spores | DoT, ignores some defense | Antidote, time |
| **Bleed** | daggers, beasts | DoT that worsens while moving | stand still, bandage |
| **Burn** | fire | DoT + −defense | roll on ground, water |
| **Freeze/Chill** | ice | −move/atk speed; full freeze = brief stun | take a hit, fire, time |
| **Shock/Paralysis** | lightning | periodic stun-lock (terrifying with one life) | nulberry-equiv item |
| **Stun/KO** | blunt (mace), falls | knocked down, free hits | mash to recover |
| **Curse** | special foes, traps | −max HP until cleansed | shrine, Sage cleanse |
| **Webbed/Rooted** | spiders, vines | can't move, can still attack/dodge in place | break free / cut |

All ailments show a **build-up meter** before they trigger (so the player can react), then a **duration bar**.
Resistances come from gear/race (Dwarf resists poison, etc.).

### 15.2 Elemental triangle + reactions (the Sage's playground)

Targets have per-element multipliers (weak/neutral/resist). Beyond simple weakness, **reactions** trigger when two
elements meet on one target within a short window (Sage capstone makes this central):

- **Fire + Ice → Shatter:** burst AoE + brief stun.
- **Fire + Lightning → Overload:** big single-target spike.
- **Ice + Lightning → Superconduct:** −defense debuff (sets up the whole party).
- **Any + Water-soaked → amplified:** wet targets take +50% lightning, −50% fire.

Environmental tie-ins: oil pools (ignite), water (conduct), ice patches (slip), gas (explode). Floors seed these
hazards; smart players bait enemies into them.

---
## §16 — Items & equipment catalog

The "many items" pillar. Items are **pure data** (`src/data/items.ts`) keyed by `itemId`, with a shared schema
(§29). Categories below; numbers are tuning starters (§31).

### 16.1 Rarity & affixes

Six tiers, color-coded: **Common (grey) → Uncommon (green) → Rare (blue) → Epic (purple) → Legendary (gold) →
Mythic (red, anomaly-only)**. Higher rarity rolls more **affixes**.

Affixes (rolled on gear): `+STR/DEX/INT/VIT/AGI`, `+atk%`, `+critChance`, `+critDmg`, `+elemAtk(type)`,
`+ailmentBuildup(type)`, `+%resist(type)`, `+maxHP/MP/Stamina`, `+moveSpeed`, `+EdgeRetention`, `lifesteal%`,
`+i-frames`, `−skillCooldown%`, and rare **uniques** (e.g. *"perfect dodges restore 5 HP"*).

**Set bonuses:** crafted boss-material sets grant 2-piece / 4-piece bonuses themed to that boss (e.g. the
*Ash Revenant* set: 2pc burn immunity, 4pc your burns spread to nearby foes).

### 16.2 Equipment slots

`weapon, offhand (shield/quiver/focus), head, chest, hands, legs, boots, amulet, ring1, ring2, charm`.
Armor has a **weight** that feeds `armorWeightPenalty` (move speed + roll distance). Light = nimble glass,
heavy = slow bastion. This is a core build axis.

### 16.3 Weapons (samples per family — each is a base; upgrade trees in §17)

- **Swords:** Short Sword → Soldier's Blade → Knight's Longsword → Runed Estoc → *Dawnedge* (legendary, light element)
- **Greatswords:** Iron Cleaver → War Greatsword → Obsidian Slab → *Mountainbreaker*
- **Daggers:** Twin Daggers → Fang Knives → Venomfangs → *Whisper & Wane* (twin uniques, bleed/poison)
- **Maces/Hammers:** Mace → Spiked Maul → Thunder Hammer → *Worldknell* (KO god)
- **Spears:** Short Spear → Pike → Halberd → *Dragoon's Reach*
- **Bows:** Short Bow → Hunter's Bow → Composite Bow → *Stormcaller* (lightning charge)
- **Crossbows:** Light Crossbow → Repeater → Siege Arbalest
- **Staves:** Apprentice Staff → Elemental Rod → Archon Staff → *Comet's Tongue*
- **Tomes:** Fireball Tome → Frost Codex → Storm Grimoire → *The Last Page* (summons a spectral ally)
- **Gauntlets:** Leather Wraps → Iron Knuckles → Beast Claws → *Tempest Fists*

### 16.4 Consumables (the survival kit)

| Item | Effect | Notes |
|---|---|---|
| Health Potion (S/M/L) | heal 40/90/180 over 1.5s | rooted while drinking |
| Mana Potion (S/M/L) | restore MP | Sage lifeline |
| Antidote / Herbal Salve | cure poison / bleed | |
| Nulberry-equiv | clear elemental/para debuffs | |
| Whetstone | restore weapon Edge | rooted 2s |
| Arrows / Bolts (+ coatings) | ammo | poison/para/elem/power |
| Smoke Bomb | drop threat / break aggro | Assassin staple |
| Throwing Knife / Bomb | ranged burst / AoE | bombs stagger |
| Trap (Pit / Shock) | immobilize a foe | clutch vs elites |
| Rations / Cooked Meals | camp buffs (§21) | timed buffs |
| Warp Crystal | emergency teleport to town | **drops your descent**; single-use; pricey |
| Phoenix Down? | **NO.** No revives. (Listed to be explicit.) | permadeath is sacred |

### 16.5 Materials (the crafting economy)

Monster parts (`ash_revenant_horn`, `frost_wolf_pelt`...), ores (`iron`, `silver`, `mythril`, `voidsteel`),
essences (`fire_essence`, `void_shard`), and herbs. Drop tables in §24. Materials are the bridge between
"explore + kill" and "get stronger" (§17). **Mythic** mats only drop from anomalies (§20).

---

## §17 — Crafting, upgrading & enchanting

The gear treadmill that makes exploring worth it. All done in **Town 2.0** (§23).

### 17.1 Upgrade trees (Blacksmith)
Each weapon/armor has a branching **upgrade tree**: spend gold + materials to advance a base item into stronger,
sometimes branching, versions (pick a fire branch *or* a raw-damage branch). Upgrades raise base attack/defense,
sometimes add an element or an affix slot. Mirrors MH's weapon trees — discovering a tree's endpoint is a goal.

### 17.2 Forging from boss parts
Break a boss part (§19) → get rare mats → forge that boss's **signature weapon/armor set**. These carry the boss's
theme (the Frost Warden's lance applies chill; its armor set resists ice and lets you walk on ice patches).

### 17.3 Enchanting / runes (Sage's Tower)
- **Reroll affixes** on gear (gold + essence; escalating cost to prevent fishing).
- **Socket runes:** some gear has sockets; runes add flat element, ailment build-up, or utility.
- **Transmute:** convert surplus low mats into a chance at a higher mat (sink for junk).

### 17.3.1 Durability & repair (optional hardcore toggle)
Armor can **degrade** on big hits; repair at the Blacksmith. Off by default; a "Masochist" run modifier turns it
on for extra tension. (Edge/ammo/MP already provide combat-resource pressure, so this is opt-in.)

---

## §18 — Enemies & bestiary

### 18.1 Archetypes (AI behaviors)

Build enemies from composable **AI states** so new monsters are data + a behavior list, not new code:

- **Chaser:** pathfinds to player, basic melee (telegraphed lunge).
- **Skirmisher:** approaches, hits, retreats (kites you).
- **Ranged:** keeps distance, fires projectiles (telegraphed, dodgeable).
- **Charger:** winds up, dashes in a line (sidestep it).
- **Caster:** channels AoE zones you must leave.
- **Swarm:** weak, many, surrounds you (panic button territory).
- **Ambusher:** hidden (in walls/ceilings/loot), springs out.
- **Support:** buffs/heals/shields other enemies — **kill first**.
- **Brute:** super-armored, slow, huge punish if you whiff a dodge.

AI shared bits: aggro radius, leash range (returns home if you flee far), telegraph windups with anticipation
frames + SFX, and **stagger/flinch** reactions to your poise damage.

### 18.2 Elite & Champion modifiers (roguelike spice)

Roll modifiers onto normal spawns (chance scales with floor):

- **Elite** (1 affix): *Vampiric, Frenzied (faster), Armored, Volatile (explodes on death), Stormtouched (lightning),
  Toxic, Shielded, Hasted-aura (buffs nearby)*.
- **Champion** (named, 2–3 affixes, mini-boss HP, guaranteed rare drop + a part to break).
- Modifiers stack visually (auras/tints) so players can read danger at a glance and choose to fight or flee.

### 18.3 Per-floor enemy themes

| Floor | Theme | Sample enemies | New threat introduced |
|---|---|---|---|
| 1 | Ruined Entrance | Goblin Chaser, Cave Bat (swarm), Slime | basic tells, stamina |
| 2 | Flooded Halls | Drowned, Reed Lurker (ambusher), Toad Caster | water/conduct hazard |
| 3 | Fungal Depths | Spore Brute, Myconid Support, Web Spider | poison + webbed status |
| 4 | Old Barracks | Skeleton Soldier, Crossbow Wight (ranged), Shield Revenant | blocking enemies, formations |
| 5 | Ashen Foundry | Ember Hound (charger), Forge Golem (brute), Cinder Mage | burn + oil/ignite combos |
| 6 | Frozen Reliquary | Frost Wolf (pack), Ice Archer, Glacial Knight | chill/freeze, slippery floors |
| 7 | Shadowed Catacombs | Wraith (phases), Bone Colossus (champion-prone), Cultist (support) | curse, anomaly density rises |
| 8 | Voidtouched Caverns | Void Spawn (swarm), Riftling (teleports), Maw (ambush) | random rift anomalies (§20) |
| 9 | The Ascended Court | Fallen Knight (elite-heavy), Arcane Sentinel, Echo (mimics your last skill) | everything at once |
| 10 | Throne Approach → Boss | gauntlet of mixed elites → the final boss | the test of the whole run |

### 18.4 Spawn director
A light **director** controls density/pacing per floor: budget = `f(floor, difficultyMod)`; spend on spawns,
weighted by theme; reserve budget for an occasional **ambush pocket** and **anomaly roll** (§20). Keeps floors
varied within the seeded layout and prevents flat "every room = 3 goblins" monotony.

---
## §19 — Floor bosses (1–10)

Each floor's final warp pad is guarded by (or leads to) a **boss arena**. Bosses are the skill checks that gate
descent. Every boss follows the **boss contract**:

- **Telegraphed everything.** Each attack has a readable wind-up + audio cue. No undodgeable damage.
- **Phases.** At HP thresholds, new attacks unlock and the arena may change.
- **Breakable parts.** Specific hitzones can be **broken** (focus damage) → stagger, weaken an attack, and drop
  the boss's rare crafting part (§17.2). Rewards aggression *and* aim.
- **Punish windows.** After big attacks, the boss is open. The fight is a rhythm of dodge → punish → reset.
- **Enrage / soft timer (optional):** some bosses speed up at low HP rather than a hard timer.

### 19.1 Boss roster

| Floor | Boss | Theme | Signature mechanics | Break parts |
|---|---|---|---|---|
| 1 | **Goblin Warlord** | tutorial boss | telegraphed cleave, summons 2 adds at 50% | club arm |
| 2 | **The Drowned King** | water | tidal sweep (jump/roll timing), conducts if you're wet, grab attack | crown, trident |
| 3 | **Brood Matron** | poison spider | web-pin (struggle out), spawns spiderlings, ceiling-drop ambush | fangs, abdomen |
| 4 | **Sir Mordrek, Fallen Captain** | undead duelist | parry-able combos (perfect-guard reward), shield charge | shield, helm |
| 5 | **Forgefather Brand** | fire golem | floor-wide ignite lines, oil + ignite combo, throws molten chunks | core (chest), arms |
| 6 | **Frost Warden Ysold** | ice | freezes patches, ice-spear barrage, full-freeze grab (=near death) | antlers, ice heart |
| 7 | **The Hollow Choir** | undead gestalt | three wraiths sharing one HP bar; curse stacks; phases merge | each wraith mask |
| 8 | **Riftmaw** | void | teleports, pulls you toward its mouth, spawns mini-rifts (anomaly tie-in) | eyes, maw |
| 9 | **The Ascendant Twins** | dual boss | two bosses, alternate aggression, enrage if one dies far before the other | weapon arms |
| 10 | **The Dungeon Heart / Sovereign** | final | multi-phase; reuses earlier mechanics as a "final exam"; arena transforms per phase | many; full break = secret line on §25 |

### 19.2 Anatomy of a boss fight (template for implementation)

```
BossState: { phase, hp, parts[{id, hp, broken}], enrage, attackPool[], currentTelegraph }
loop:
  pick attack from pool weighted by phase + distance
  → telegraph (anticipation frames + cue) → active hitbox(es) → recovery (punish window)
  on part hp 0 → break event (stagger, drop part, disable linked attack)
  on hp threshold → phase transition (arena event + new pool)
```

Bosses are the **highest-authored** content — hand-tune each. The roguelike randomness lives in the floors and
anomalies; the bosses are fixed, learnable tests (that's what makes mastery feel real under permadeath).

---

## §20 — Rare world events ("Anomalies") — the weird stuff

This is the heart of your "อีเว้นท์แปลกๆ โผล่มานานๆที" request. **Anomalies** are rare, high-stakes, optional
encounters seeded by the spawn director. They appear infrequently (tuned rates in §31), announced by an
**ambient cue** (screen tint, music sting, a HUD whisper) so they feel like *events*, not noise.

Design rules for all anomalies:
- **Rare & memorable.** A player might see 2–3 per full descent. Scarcity = specialness.
- **Optional but tempting.** Always avoidable; always lucrative or dangerous enough to tempt greed.
- **Permadeath-aware.** They can absolutely kill you. That's the thrill. Telegraph the *entrance*, not the safety.

### 20.1 🌀 The Dimensional Rift (otherworld boss)
A shimmering **rift portal** spawns in a random room (more common floors 6–9). Step through → loaded into a
hand-authored **otherworld arena** (inverted palette, eerie audio) to fight a **Rift Boss** — a stronger,
remixed boss with a unique moveset and **Mythic** drops.

- **Risk:** the rift collapses after the fight or on a timer; failing/dying = normal permadeath.
- **Reward:** Mythic materials, a unique affixed drop, big XP.
- **Variants:** "Mirror" rifts spawn a **shade of your own character** (your build, turned against you) — a
  pure skill duel. Beating your shade grants a unique charm.

### 20.2 🕯️ Secret Summon Bosses (ritual conditions)
Hidden bosses you must **summon** by meeting conditions, MH-investigation style. Discovery is the puzzle.

| Secret boss | Summon condition | Reward |
|---|---|---|
| **The Gravelord** | Light all 4 black candles found across a single floor within one visit | necromancy set, summon-ally charm |
| **Avarice, the Gilded Maw** | Carry ≥ a gold threshold and open the cursed chest in a treasure vault | gold-scaling weapon (more gold = more atk) |
| **The Clockwork Judge** | Defeat the floor's champion *without taking damage*, then ring the broken bell | time-stop active skill rune |
| **Old Friend** | Find 3 torn journal pages across floors, read them at a camp, sleep | story boss; unique companion unlock (§22) |
| **The Hungering Dark** | Descend a full floor without lighting any torch (play in the dark) | void weapon line, Mythic shard |

Conditions are surfaced subtly via item descriptions, NPC hints, and environmental clues — never a quest marker.
This rewards *player knowledge* (the real meta-progression, §10).

### 20.3 🗡️ The Hunter (rogue-adventurer nemesis)
Your requested "นักผจญภัยที่เป็นโจรจ้องจะฆ่าเรา." A **rival adventurer NPC** who hunts *you*.

- **Introduction:** around floor 3–4 you find signs (a looted corpse, a taunting note pinned to a door).
- **Stalking:** on later floors, ambient cues warn you ("you feel watched"; footsteps). The Hunter can appear in
  a random room and **invade** — a 1v1 duel against a full *character* (race+class+gear+skills, scaled to you).
- **Behavior:** plays like a smart player — dodges, drinks potions, uses skills, retreats when low. Genuinely
  dangerous. If you flee, they may steal gold/an item and vanish, returning later stronger (a **nemesis arc**).
- **Resolution:** beat them for their gear (their unique weapon is a great drop) and a bounty. They escalate each
  encounter, so ducking the fight has a cost. Optional: a final Hunter encounter on floor 9 as a "rival's end."
- **Implementation:** reuse the **companion/character AI** (§22) with aggressive parameters + a small "uses
  consumables / kites when low" utility layer. One codebase, two faces (ally vs invader).

### 20.4 Other anomalies (variety pool)
- **🛒 The Wandering Merchant:** a masked NPC with rare stock at steep prices; appears once, then gone. Tempts
  you to spend the gold you were saving for town.
- **⚖️ Cursed Bargain Shrine:** offers a powerful boon for a permanent curse (−max HP, can't heal above 80%,
  enemies see further...). Greed test.
- **🎲 Gambler's Chest:** a mimic-or-treasure chest. 50/50: jackpot, or a **Mimic** ambush (champion-tier).
- **⛓️ The Caged Ally:** a trapped NPC; free them (fight the jailer) → temporary companion for the floor (§22).
- **🌑 Blood Moon (floor-wide):** for one floor visit, all enemies are Elite-rolled, drops doubled. Announced at
  floor entry — descend now or warp out and re-roll the seed (at the cost of a Warp Crystal).
- **📜 Echo of a Fallen Hero:** a graveyard ghost of a *past dead run* (from run history, §26) appears as an
  optional duel; beating your own past corpse returns some of that run's lost gold. (Lovely permadeath flavor.)
- **🐾 Beast Stampede:** a corridor fills with a fleeing herd — ride the chaos for drops or get trampled.

> Keep all anomalies in a registry (`src/data/anomalies.ts`) with `{ id, weight, minFloor, maxFloor, trigger,
> announce, onEnter }` so the director can roll them cleanly and you can tune rarity in one place (§31).

---
## §21 — Camping & survival

Your requested "การพักแรมระหว่างอยู่ในดันเจี้ยน." Camps are the dungeon's **risky middle ground** between the
safe Inn and pressing on with no recovery. **Camps never prevent permadeath** and **never act as a save-revive
point** — they are a tactical heal-and-buff with a price.

### 21.1 Making camp
- Carry a **Camp Kit** (consumed on use) and find a **safe-ish spot** (a cleared room; some rooms are flagged
  `campable`). Hold E to set up (a ~3s vulnerable channel — don't camp with enemies near).
- A camp gives access to: **Rest**, **Cook**, **Craft (basic)**, **Stash swap**, and **Talk** (companions, §22).

### 21.2 Rest (the trade-off)
- **Rest** restores a chunk of HP/MP over time (e.g. 60% HP, 50% MP) but **advances a danger clock**.
- **Ambush risk:** resting rolls against an **Ambush chance** (rises with floor and with how "hot" the area is —
  recent loud fights, Blood Moon, being stalked by the Hunter). On a hit, you wake mid-ambush (surrounded,
  short spawn-protection, then it's on). This is the cost of safety.
- You may **set a watch** if you have a companion (§22) — they reduce ambush chance but get tired.

### 21.3 Cooking (buffs)
Combine **Rations + Materials** at a camp to cook **Meals** granting timed buffs (MH's canteen, slimmed down):

| Meal | Buff | Duration |
|---|---|---|
| Hearty Stew | +max HP | until next camp/death |
| Spiced Skewers | +attack | timed |
| Iron Porridge | +defense | timed |
| Hunter's Tea | +stamina regen | timed |
| Mage's Broth | +MP / −skill cooldown | timed |
| Trailmix | +move speed | timed |

Better ingredients (boss/rare mats) = stronger/longer buffs. Cooking is a small **mini-decision** before a hard
push: which buff for which boss?

### 21.4 Camp craft & stash
- **Basic craft** at camp: potions from herbs, arrows, whetstones, repair Edge — but **not** full forging
  (that's town). Lets a careful player sustain a deep run without warping back.
- **Stash swap:** rearrange loadout, drop junk. (No teleporting loot to town — you carry your greed.)

### 21.5 Why camps matter to the fantasy
Camps create the game's best *quiet* moments: low HP, deep on floor 7, deciding whether to risk a rest with the
Hunter on your trail, or push to the warp pad on fumes. That tension is the whole pitch.

---

## §22 — Companion / ally NPC system

Your requested "npc เป็นพรรคพวก." Companions are recruitable AI allies who fight alongside you. With permadeath,
**they can die for good too** — which makes them matter.

### 22.1 Acquiring companions
- **Caged Ally** anomaly (§20.4): free them → they join for that floor (temporary) or permanently if you escort
  them to a warp pad alive.
- **Town recruits (§23):** the **Guild** offers hireable adventurers (pay upfront + a cut of loot).
- **Story unlock — "Old Friend"** (secret boss §20.2): a permanent, named, characterful companion.

### 22.2 Companion design
A companion is essentially a **character** (race + class + gear + a subset of skills) run by AI — the same brain
as the Hunter (§20.3), tuned cooperative.

- **Roles** mirror classes: a Tanker companion holds aggro; an Archer pokes; a Sage heals/shields you.
- **Command wheel:** light orders — *Aggressive / Defensive / Follow / Hold / Focus my target / Regroup*.
- **They consume resources:** companions use *their own* potions; you can share via camp. They get tired (need
  rest at camp). They can be downed and, if not protected, **die permanently** (a real gut-punch).
- **Loyalty / banter:** simple affinity that unlocks camp dialogue and small combat bonuses; flavor that makes
  their death land. Keep it light to author.

### 22.3 Balance guardrails
- Companions are **forces multipliers, not crutches.** They die to mechanics if you ignore them, and the game
  is tuned assuming you *might* be solo. Bringing allies trades a loot cut + their fragility for survivability.
- **Boss arenas** may limit companions (the Ascendant Twins fight solo for the duel fantasy) — author per boss.

### 22.4 Implementation note
One **`CharacterAI`** module drives companions, the Hunter, and your "shade" (Mirror Rift §20.1). Parameters:
`{ alignment: ally|hostile, aggression, selfPreservation, usesConsumables, skillUsageProfile, targetPriority }`.
This is huge leverage — write the brain once, reskin behavior via data.

---

## §23 — Town 2.0 (expanded hub)

The SPEC's town has Gate/Weapon-Armor Shop/Item Shop/Inn. Expand it into a real hub. Each is still a proximity
"Press E" interactable opening a **UI panel overlay** (no separate scenes), per SPEC §4.5.

| Building | Service |
|---|---|
| **Dungeon Gate** | Descend. Shows current floor / lets you start at the deepest **unlocked checkpoint floor** (see §25.2). |
| **Blacksmith** | Forge & **upgrade trees** (§17.1), boss-part sets (§17.2), repair, buy/sell weapons & armor. |
| **Alchemist / Item Shop** | Potions, antidotes, coatings, bombs, traps, **Camp Kits**, Warp Crystals. |
| **Sage's Tower** | **Respec**, **enchant/reroll affixes**, **socket runes**, **transmute** (§17.3), elemental lore hints. |
| **Inn** | Full HP/MP rest (paid). Soft checkpoint *feel* but **does not stop permadeath**. Sleep → next-day stock refresh. |
| **Adventurer's Guild** | **Bounty board** (kill X / break Y / reach floor Z for gold+mats), **hire companions** (§22), see the **Graveyard / run history** (§26). |
| **Wandering stalls (rotating)** | A daily-rotating rare vendor; gives town replay value between runs. |

### 23.1 Bounty board (directed goals)
Procedural bounties give runs objectives beyond "go down": *"Break the Frost Warden's antlers"*, *"Reach floor 7
without using a Warp Crystal"*, *"Defeat a Champion on floor 5"*. Rewards: gold, mats, sometimes a unique. Turns
exploration into goals and teaches mechanics by asking for them.

### 23.2 Town as emotional pacing
Town is the exhale between held breaths. Quiet music, safe, NPCs with light banter that reacts to your progress
("Heard you cleared the Forgefather — half the guild owes me a drink"). After a death, town is also where the new
character starts amid the **graveyard** of past runs (§26) — continuity of *world*, not of *character*.

---

## §24 — Economy, loot tables & drop rates

### 24.1 Currency & sinks
- **Gold** is the only currency. Sources: kills, selling loot/mats, bounties, the Avarice anomaly.
- **Sinks:** upgrades (the big one), potions/ammo/camp kits, Inn rests, respecs, affix rerolls, hiring companions,
  Warp Crystals. Tuned so a careful player is always slightly short — you cannot buy your way past skill.

### 24.2 Loot tables (data-driven)
Each enemy/chest/boss has a weighted `dropTable[{ itemId, weight, qtyRange, condition? }]`. Conditions allow
"only drops if part broken" (boss mats) or "only on Champion" (rare affixed gear). Floor number shifts the table
toward higher tiers. Keep tables in `src/data/loot.ts`.

### 24.3 Drop philosophy
- **Mats are common, gear is rare, uniques are special, Mythics are anomaly-gated.** The dopamine spike is real
  because gold/purple drops are *infrequent*.
- **Pity/anti-streak (gentle):** track dry streaks on rare drops and nudge the weight slightly to avoid
  feel-bad runs — without removing variance.
- **Greed loop:** more loot = heavier inventory? Optional weight cap forces "take the good stuff, leave the junk"
  decisions deep in a floor. (Off by default; a hardcore toggle.)

### 24.4 Sample early-floor table (Floor 1 Goblin Chaser)

| Drop | Weight | Qty |
|---|---|---|
| Goblin Fang (mat) | 50 | 1–2 |
| Tattered Cloth (mat) | 30 | 1 |
| Health Potion (S) | 12 | 1 |
| Gold pouch | 6 | 5–15g |
| Uncommon gear (random affix) | 2 | 1 |

Scale weights toward rarer rows as floors deepen; bosses guarantee a part on break + a roll on their unique.

---
## §25 — Floor 10, endgame & "what comes after death"

### 25.1 The final gauntlet
Floor 10 is a **boss rush + finale**: a short corridor of mixed elites (a "final exam" reusing every mechanic),
then the **Sovereign / Dungeon Heart** (§19.1). Multi-phase, arena-transforming, references earlier bosses'
attacks so a player who learned the dungeon is rewarded. Full **part breaks** on the final boss unlock a secret
ending line and a Mythic.

### 25.2 What "winning" means under permadeath
You only get one life, so beating the dungeon must be a *huge* deal:
- **Victory = the run of a lifetime.** Slow-mo finisher, credits-style epilogue, your character enshrined in the
  Guild's **Hall of Champions** (a permanent record across all future characters).
- **Optional checkpoint-floors (design choice — pick one):**
  - **(A) Pure roguelike (default):** every new character starts at floor 1. Hardcore. Recommended for your
    "ทรมาน" goal.
  - **(B) Bonfire unlocks:** clearing a floor boss the first time unlocks the Gate's option to *start a future
    character* at that floor (but at appropriate gear/level expectations). Softer, more "build mastery over many
    deaths." Store unlocks in account-level meta, separate from the wiped character save.

### 25.3 New Game+ / Ascension (post-victory)
For the rare winner: an **Ascension** mode — the dungeon reopens harder (enemy +stats, new anomaly variants,
remixed boss movesets, a hidden 11th "true" floor). Each Ascension tier ups the ceiling. This is the long-tail
endgame for the few who survive.

### 25.4 Lore frame (why permadeath, in-world)
The dungeon "resets reality" on a hero's death; a new soul wakes in town. The **graveyard** and **Echo** anomaly
(§20.4) make past deaths diegetic — your failures literally populate the world. Death isn't a fail screen; it's
worldbuilding.

---

## §26 — Difficulty, death & permadeath UX

### 26.1 The death sequence
1. Lethal hit → **slow-mo + desaturate**, the offending attack frozen on screen.
2. **Cause-of-death banner:** *"Felled by Frost Warden Ysold — Floor 6 — Run #14 — survived 1h 22m."*
3. **Run summary:** floors cleared, bosses slain, biggest hit dealt/taken, gold earned, rarest find.
4. Save **deleted** (per SPEC §4.4); a row appended to **`run_history`** (the graveyard).
5. Return to **character creation**. Town remembers your past (Hall of Champions, graveyard, Echoes).

### 26.2 Run history / graveyard (meta-continuity)
A `run_history` table (Supabase, Phase 5) stores each run's summary. The Guild's graveyard lets you browse fallen
characters; the **Echo** anomaly resurrects them as optional duels. This turns permadeath from pure loss into a
**growing personal legend**. Account-level, never wiped.

### 26.3 Difficulty modifiers (opt-in masochism)
At character creation, optional toggles for self-imposed pain (and bragging rights / cosmetic titles):
- **Masochist:** gear durability on (§17.3.1), inventory weight cap on (§24.3).
- **Ironbound:** no Warp Crystals (can't bail to town mid-descent).
- **Starved:** halved healing from all sources.
- **Hunted:** the Hunter (§20.3) appears earlier and more often.
- **Blackout:** reduced vision radius dungeon-wide.
Stack them for leaderboard-worthy runs (titles recorded in Hall of Champions).

### 26.4 Fairness telemetry (dev-side)
Log (locally) what kills players and where. If one attack or floor spikes deaths unfairly (untelegraphed, too
fast), it's a **tuning bug**, not "hard." Use it to honor the §10 contract.

---

## §27 — UI / HUD

Keep it pixel-clean and minimal; information density without clutter. `UIScene` (SPEC) runs in parallel.

- **HUD:** HP bar, Stamina bar, MP bar (Sage), active ailment icons + timers, Edge/ammo indicator, hotbar
  (1–5 consumables, 16×16 icons), skill cooldown pips, minimap corner, gold, floor # + depth.
- **Boss UI:** named HP bar at top, part-break pips, phase indicator.
- **Inventory:** grid (drag-drop), equipment paper-doll with stat diff preview (green/red deltas), compare
  tooltips, sort/filter, mark-as-junk for quick selling.
- **Map:** revealed-as-explored floor map (fog of war); marks warp pads (once found), camps, anomalies, the
  player. Hidden things stay hidden until discovered.
- **Damage numbers:** small, color-coded (white normal, yellow crit, element-tinted, grey "bounced/blocked").
  Toggleable.
- **Telegraph feedback:** subtle screen-edge flash or directional indicator for off-screen wind-ups about to hit
  you (fairness, §10).
- **Tooltips teach:** every status/affix/stat has a hover/inspect tooltip. The game explains itself; difficulty
  is in execution, not obfuscation.

---

## §28 — Audio direction

Audio is a core fairness *and* mood tool (telegraph cues live here).

- **Music:** ambient/sparse in dungeon (tension), distinct per-floor-theme motifs, big orchestral-chiptune for
  bosses, warm/quiet town theme, a unique sting for **anomaly spawns** (so players learn "that sound = something
  rare appeared").
- **SFX as tells:** every enemy wind-up has a signature sound; the player learns to dodge by ear. Boss "big
  attack" cues are unmistakable. Perfect-dodge/parry have a satisfying *ping*.
- **Diegetic warnings:** the Hunter's footsteps, the rift's hum, the Blood Moon's drone — audio foreshadows
  danger before it's on screen.
- **Feedback:** crunchy hit SFX scaled by damage; "bounce" clink on low Edge; low-HP heartbeat; potion-drink glug
  (reminds you you're rooted).
- **Tooling:** Web Audio via Phaser; keep assets small (OGG); a global volume + mute, and an "audio cues only"
  accessibility option.

---
## §29 — Extended data models (TypeScript)

Extend the SPEC §6 types. Everything stays strict; no `any`. These are the **shapes**, not the content
(content lives in `src/data/*.ts`).

```ts
// ---- Combat & weapons -----------------------------------------------------
export type Element = 'none' | 'fire' | 'ice' | 'lightning' | 'void' | 'light';
export type Ailment = 'poison' | 'bleed' | 'burn' | 'chill' | 'shock'
                    | 'stun' | 'curse' | 'webbed';
export type WeaponFamily =
  | 'sword' | 'greatsword' | 'daggers' | 'mace' | 'spear'
  | 'bow' | 'crossbow' | 'staff' | 'tome' | 'gauntlets';

export interface HitboxShape {
  kind: 'arc' | 'circle' | 'line' | 'projectile';
  // tuning fields per kind (radius, angle, length, speed...) — keep numeric, no any
  [k: string]: number | string;
}

export interface AttackMove {
  id: string;
  name: string;
  mv: number;              // motion value
  poiseDmg: number;
  staminaCost: number;
  mpCost?: number;
  startup: number;         // frames
  active: number;
  recovery: number;
  hitbox: HitboxShape;
  element?: Element;
  ailmentBuildup?: Partial<Record<Ailment, number>>;
  cancelsInto?: string[];  // move ids reachable from recovery
}

export interface WeaponMoveset {
  family: WeaponFamily;
  light: string[];         // combo chain of AttackMove ids
  heavy: string[];
  special?: string[];
  gauge?: { name: string; max: number; buildPerHit: number };
}

// ---- Items & gear ---------------------------------------------------------
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type EquipSlot =
  | 'weapon' | 'offhand' | 'head' | 'chest' | 'hands'
  | 'legs' | 'boots' | 'amulet' | 'ring1' | 'ring2' | 'charm';
export type ItemKind = 'weapon' | 'armor' | 'consumable' | 'material' | 'tool' | 'quest';

export interface Affix { id: string; stat: string; value: number; }

export interface BaseItem {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  icon: string;            // atlas frame key
  sellPrice: number;
  stackable: boolean;
  maxStack?: number;
  description: string;
}

export interface WeaponItem extends BaseItem {
  kind: 'weapon';
  family: WeaponFamily;
  attack: number;
  scaling: Partial<Record<'str' | 'dex' | 'int', number>>;
  element?: Element;
  elemAttack?: number;
  edgeMax?: number;        // melee
  affixSlots: number;
  affixes: Affix[];
  upgradePath?: string[];  // item ids this can become
  setId?: string;
}

export interface ArmorItem extends BaseItem {
  kind: 'armor';
  slot: EquipSlot;
  defense: number;
  weight: number;
  resist?: Partial<Record<Element | Ailment, number>>;
  affixSlots: number;
  affixes: Affix[];
  setId?: string;
}

export interface ConsumableItem extends BaseItem {
  kind: 'consumable';
  effect: string;          // effect id resolved by an EffectSystem
  potency?: number;
  channelMs?: number;      // rooted-while-using (potions, whetstone)
}

// ---- Skills & classes -----------------------------------------------------
export interface SkillNode {
  id: string;
  name: string;
  branch: string;
  tier: number;            // 1..4
  type: 'passive' | 'active';
  cost: number;            // skill points
  requires?: string[];     // node ids
  cooldownMs?: number;
  mpCost?: number;
  staminaCost?: number;
  description: string;
}

export interface ClassSkillTree {
  classId: ClassId;
  signature: string;
  nodes: SkillNode[];
  capstone: SkillNode;
  weaponFamilies: WeaponFamily[];   // what this class may wield
}

// ---- Enemies, bosses, AI --------------------------------------------------
export type AIRole = 'chaser' | 'skirmisher' | 'ranged' | 'charger'
                   | 'caster' | 'swarm' | 'ambusher' | 'support' | 'brute';

export interface Hitzone { id: string; rawMod: number; elemMod: number; partHp?: number; }

export interface EnemyDef {
  id: string;
  name: string;
  role: AIRole;
  baseStats: Stats;
  hitzones: Hitzone[];
  attacks: string[];       // AttackMove ids
  dropTableId: string;
  poise: number;
  floorRange: [number, number];
  resist?: Partial<Record<Element | Ailment, number>>;
}

export type EliteAffix =
  | 'vampiric' | 'frenzied' | 'armored' | 'volatile' | 'stormtouched'
  | 'toxic' | 'shielded' | 'hasted_aura';

export interface BossPhase { hpThreshold: number; attackPool: string[]; arenaEvent?: string; }
export interface BossDef {
  id: string;
  name: string;
  floor: number;
  phases: BossPhase[];
  breakParts: { id: string; hp: number; dropItemId: string; disablesAttack?: string }[];
  enrage?: { atHpPct: number; mods: Partial<Stats> };
}

// ---- Character AI (companions, Hunter, shade) -----------------------------
export interface CharacterAIProfile {
  alignment: 'ally' | 'hostile';
  aggression: number;        // 0..1
  selfPreservation: number;  // 0..1 (when to retreat/heal)
  usesConsumables: boolean;
  skillUsageProfile: string; // references a behavior preset
  targetPriority: ('player' | 'lowestHp' | 'support' | 'nearest')[];
}

// ---- Anomalies (rare events) ----------------------------------------------
export type AnomalyId =
  | 'dimensional_rift' | 'mirror_rift' | 'summon_gravelord' | 'summon_avarice'
  | 'summon_clockwork_judge' | 'summon_old_friend' | 'summon_hungering_dark'
  | 'hunter_invasion' | 'wandering_merchant' | 'cursed_bargain' | 'gamblers_chest'
  | 'caged_ally' | 'blood_moon' | 'fallen_echo' | 'beast_stampede';

export interface AnomalyDef {
  id: AnomalyId;
  weight: number;          // director roll weight
  minFloor: number;
  maxFloor: number;
  oncePerRun?: boolean;
  announce: string;        // audio/visual cue key
  // trigger + onEnter resolved by the AnomalySystem
}

// ---- Camp & companions in save -------------------------------------------
export interface Companion {
  id: string;
  name: string;
  race: RaceId;
  clazz: ClassId;
  level: number;
  ai: CharacterAIProfile;
  loyalty: number;
  alive: boolean;
}

export interface ActiveBuff { id: string; stat: string; value: number; expiresAt: number | 'camp' | 'death'; }

// ---- Extended save (superset of SPEC CharacterSave) -----------------------
export interface CharacterSaveV2 {
  version: 2;
  name: string;
  race: RaceId;
  clazz: ClassId;
  level: number;
  xp: number;
  unspentStatPoints: number;
  unspentSkillPoints: number;
  stats: Stats;
  currentHp: number;
  currentMp: number;
  currentStamina: number;
  gold: number;
  inventory: ItemStack[];
  equipped: Record<EquipSlot, string | null>;
  affixRolls: Record<string, Affix[]>;     // per-itemInstance affixes
  unlockedSkillNodes: string[];
  activeBuffs: ActiveBuff[];
  ailments: Partial<Record<Ailment, { stacks: number; expiresAt: number }>>;
  companions: Companion[];
  location: 'town' | 'dungeon';
  dungeonFloor: number;       // 1..10, 0 in town
  floorSeed: number;
  position: { x: number; y: number };
  hunterState?: { encountered: boolean; defeats: number; escalation: number };
  runModifiers: string[];     // masochist toggles (§26.3)
  createdAt: string;
}

// ---- Account-level meta (NOT wiped on death) ------------------------------
export interface RunHistoryEntry {
  runNumber: number;
  name: string; race: RaceId; clazz: ClassId;
  floorReached: number; bossesSlain: string[];
  causeOfDeath: string; survivedMs: number;
  goldEarned: number; rarestFind?: string;
  position: { floor: number; x: number; y: number };   // for the Echo anomaly
  endedAt: string;
}

export interface AccountMeta {
  runHistory: RunHistoryEntry[];
  hallOfChampions: RunHistoryEntry[];     // victorious runs
  unlockedCheckpointFloors: number[];     // if using §25.2 option B
  ascensionTier: number;
}
```

> **Save migration:** keep SPEC's `CharacterSave` (v1) loadable; write a `migrate(v1 → v2)` in `SaveManager`.
> The Supabase `saves` table stays one JSONB blob per user (SPEC §6); add a separate `run_history` /
> `account_meta` table for the never-wiped meta (RLS per user).

---

## §30 — Extended roadmap & folder additions

Continue SPEC §8. Build **one phase at a time**, keep the "currently on" line in `CLAUDE.md` updated, verify each
phase runs before advancing. Suggested re-slicing of the post-combat phases (SPEC's P4 was a single lump — split it):

| Phase | Deliverable |
|---|---|
| **P4a** | Combat core: stamina, dodge/i-frames, one weapon family end-to-end (Sword), damage formula, hitzones, 1 enemy archetype (Chaser), death→creation loop. |
| **P4b** | All weapon families + movesets (§13); Edge/ammo/MP resources; guard/parry. |
| **P4c** | Enemy archetypes (§18.1) + elite/champion modifiers + spawn director. |
| **P4d** | Status/ailments + elemental reactions (§15). |
| **P4e** | Inventory, equipment, affixes, loot tables (§16, §24). |
| **P4f** | Skill trees per class (§14); skill points; cooldowns. |
| **P5**  | Supabase auth + `SaveManager` (v2 + migration); permadeath wipe; `run_history`/`account_meta`; debounced autosave. |
| **P6**  | Floor bosses 1–10 (§19), break parts, boss UI. |
| **P7**  | Crafting/upgrade trees, enchanting, boss-part sets (§17); Town 2.0 buildings (§23). |
| **P8**  | Camping & survival (§21); Companion/CharacterAI (§22). |
| **P9**  | Anomalies (§20): rifts, secret summons, the Hunter, merchant, etc. |
| **P10** | Floor 10 finale, endgame, Hall of Champions, Echo, Ascension (§25). |
| **P11** | Audio (§28), full HUD (§27), final pixel-art atlas pass, balancing pass via telemetry (§26.4), polish. |

### 30.1 New folders / modules

```
src/
  systems/
    CombatSystem.ts        # tick, state machines, damage resolution
    StaminaSystem.ts
    AilmentSystem.ts       # status + elemental reactions
    EffectSystem.ts        # resolves consumable/skill effects
    LootSystem.ts          # roll drop tables
    InventorySystem.ts
    SkillSystem.ts         # trees, cooldowns, active skills
    AIController.ts         # enemy archetype behaviors
    CharacterAI.ts         # companions / Hunter / shade (shared brain)
    SpawnDirector.ts       # density + ambush + anomaly rolls
    AnomalySystem.ts       # registry + triggers
    CampSystem.ts          # rest, cook, ambush rolls
    CraftingSystem.ts      # upgrade trees, enchant, transmute
    EconomySystem.ts       # shops, bounties, prices
  entities/
    Enemy.ts  Boss.ts  Companion.ts  Hunter.ts  Projectile.ts  Hitbox.ts
    RiftPortal.ts  CampSite.ts  Chest.ts  Merchant.ts
  scenes/
    CombatHUDScene.ts      # extends UIScene responsibilities
    InventoryScene.ts      # overlay
    BossArenaScene.ts      # (or reuse DungeonScene with arena loader)
    OtherworldScene.ts     # rift arenas
    DeathScene.ts          # death cam + run summary
    HallOfChampionsScene.ts
  data/
    weapons.ts  movesets.ts  skills.ts  enemies.ts  bosses.ts
    items.ts  loot.ts  affixes.ts  sets.ts  anomalies.ts  meals.ts  bounties.ts
```

---

## §31 — Balancing appendix (tuning knobs in one place)

> Centralize these in `src/config.ts` (or `src/data/tuning.ts`) so balancing is a one-file job. **All numbers are
> starting points** — expect to iterate against §26.4 telemetry.

```ts
export const TUNING = {
  stamina: { max: 100, regenPerSec: 18, regenDelayMs: 600,
             dodge: 25, sprintPerSec: 12, light: 8, heavy: 22 },
  dodge:   { totalFrames: 12, iFrameStart: 3, iFrameEnd: 9 },
  guard:   { perfectWindowFrames: 6, chipPct: 0.10 },
  crit:    { baseChancePct: 3, perAgiPct: 0.6, baseDmgPct: 135, capChancePct: 60 },
  potion:  { channelMs: 1500, healS: 40, healM: 90, healL: 180 },
  level:   { cap: 50, statPointsPerLevel: 5, xpCurve: (lvl: number) => Math.round(50 * lvl ** 1.6) },
  edge:    { max: 100, lossPerHit: 1, lossVsArmored: 3, whetstoneMs: 2000 },
  floorScale: { enemyHpPerFloor: 0.18, enemyDmgPerFloor: 0.15, lootTierPerFloor: 0.12 },
  elite:   { chanceBase: 0.06, chancePerFloor: 0.02, championChance: 0.015 },
  anomalies: {                         // expected appearances per FULL descent ≈ 2–3
    dimensional_rift:   { weight: 5, minFloor: 5, maxFloor: 9 },
    hunter_invasion:    { weight: 4, minFloor: 4, maxFloor: 9 },
    wandering_merchant: { weight: 6, minFloor: 2, maxFloor: 9 },
    cursed_bargain:     { weight: 4, minFloor: 3, maxFloor: 9 },
    gamblers_chest:     { weight: 6, minFloor: 1, maxFloor: 9 },
    caged_ally:         { weight: 4, minFloor: 2, maxFloor: 8 },
    blood_moon:         { weight: 2, minFloor: 5, maxFloor: 9, oncePerRun: true },
    fallen_echo:        { weight: 3, minFloor: 3, maxFloor: 9 },
    beast_stampede:     { weight: 3, minFloor: 1, maxFloor: 6 },
    perFloorRollChance:  0.22,         // chance the director even rolls an anomaly on a floor
  },
  camp:    { restHealPct: 0.60, restManaPct: 0.50,
             ambushChanceBase: 0.18, ambushPerFloor: 0.03, watchReduction: 0.5 },
  rarityWeights: { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1, mythic: 0 }, // mythic via anomalies only
} as const;
```

**Difficulty dial:** a single `difficultyMod` multiplies `enemyHpPerFloor`, `enemyDmgPerFloor`, and `elite.chance`.
Run modifiers (§26.3) layer on top.

---

## §32 — Content & asset checklist

A production punch-list so "make it big" stays trackable. (Quantities are ambition targets — ship vertical
slices first: one floor *fully* before ten floors *shallow*.)

**Sprites / atlases**
- [ ] 5 races × 5 classes player base sheets (idle/walk/attack/hurt/die, 4-dir) — or modular layers (body+gear)
- [ ] Weapon overlays per family (10) so gear shows on the sprite
- [ ] ~30–40 enemy sheets across 10 floor themes (+ elite tint variants)
- [ ] 10 boss sheets (multi-phase frames, break-state variants)
- [ ] The Hunter + companion sheets (reuse player rig)
- [ ] Anomaly visuals: rift portal, shrines, mimic, merchant, echo ghost
- [ ] Tilesets: 10 floor themes + town + otherworld + camp props
- [ ] Item icons: weapons, armor, consumables, materials (32×32 + 16×16 hotbar)
- [ ] VFX: slashes, projectiles, elements, ailment overlays, perfect-dodge ping, break/shatter

**Audio**
- [ ] 10 floor ambiences + town + boss themes (10) + anomaly sting + victory/death stings
- [ ] Enemy/boss wind-up SFX (the tells), hit/bounce/parry/potion/footstep SFX

**Data content**
- [ ] ~10 weapons per family (upgrade trees) | ~6 armor sets/floor | boss-part sets ×10
- [ ] Affix pool (~30) + uniques (~20) + runes (~12)
- [ ] Skill trees ×5 classes (13 nodes each)
- [ ] Enemy defs (~40) + drop tables | boss defs ×10 | anomaly defs (~15)
- [ ] Consumables/materials/meals/bounties tables

**Systems sign-off (the §10 contract)**
- [ ] Every enemy & boss attack is telegraphed (anticipation frame + SFX)
- [ ] Spawn-protection + no off-screen ranged + input buffer in place
- [ ] Death cam + cause-of-death + run history working
- [ ] Permadeath wipe verified; account-meta survives the wipe

---

### Final note for Claude Code

Build **vertical slices**, not horizontal layers: get **one weapon, one enemy, one floor, one boss, the death
loop, and the inventory** feeling *great* before scaling to all the content tables. The numbers here are
deliberately conservative starting points — playtest, watch §26.4 telemetry, and tune toward "hard but fair"
(§10). When in doubt, make the *tell* clearer and the *punish* harsher.
