# Dungeon RPG — Depth & Variety Expansion (Plan v2)

> **Companion to `DUNGEON_RPG_SPEC.md` (now at Phase 6) and `DUNGEON_RPG_DESIGN_FULL.md`.**
> Those describe the game *as built*. **This file is the plan to make it deep** — the layer that turns a
> solid action-roguelike into a Monster-Hunter-scale system where **every weapon feels different, every item
> has a purpose, every monster has an identity, and there is a real win/lose matchup** the player must out-think.
>
> The headline new pillar is the **Affinity & Matchup System (§E1–E2)** — physical types + elements + status
> with per-monster weaknesses/resistances. It is the spine everything else hangs on: it gives weapons their
> distinct point, gives potions/consumables a reason to exist, gives monsters their personality, and turns
> "what do I bring into the dungeon?" into the core strategic decision under permadeath.
>
> Everything below is written to **extend the existing data**, not rewrite it. Numbers stay consistent with the
> live formula `physRaw = max(6, STR×3 + DEX) × MV`, crit ×1.35, status build-up to 100, tier attack `5 + tier×6`.
> English in-game text; strict TypeScript; client-side. Numbers are tuning starts (collected in §E14).

---

## Table of contents

- **§E0** — How to read this plan / what "more depth" means here
- **§E1** — Affinity & Matchup: damage types, elements, the effectiveness web *(the core)*
- **§E2** — Hitzones, weak points, breaks & the Research/Bestiary loop
- **§E3** — Weapon identity overhaul (every weapon does something distinct)
- **§E4** — Items: potions, consumables, throwables, utility, alchemy *(huge expansion)*
- **§E5** — Affixes, decorations (jewels), runes & set bonuses (define the hidden ones)
- **§E6** — Monster identity overhaul + new families to complete the web
- **§E7** — Combat depth additions (wounds, status, reactions, guard/parry per weapon)
- **§E8** — Classes, skill trees (concrete nodes), masteries & specializations
- **§E9** — Dungeon, environment hazards, room types & secrets
- **§E10** — Bosses 2.0 (element phases, more breaks, gimmicks)
- **§E11** — Anomalies & secret-boss investigations
- **§E12** — Economy, crafting, loot tables & target farming
- **§E13** — Companions, NPCs, town services & meta-progression
- **§E14** — Difficulty modifiers, accessibility & tuning appendix
- **§E15** — Extended data models (TypeScript, additive)
- **§E16** — Implementation plan: phases P7 → P12 (vertical slices + acceptance criteria)

---

## §E0 — How to read this plan / what "more depth" means here

Three rules guide every addition so "more" never becomes "noise":

1. **Depth = meaningful choice, not more numbers.** A second healing potion that's just "+more HP" is filler.
   A potion that *cures a status you're about to die from* is a decision. Every new item/monster/skill must
   create a decision the player didn't have before.
2. **Build around the matchup.** The affinity web (§E1) is the universal "why." Why carry a second weapon?
   Different damage type for the next floor. Why this rune? Element coverage. Why this meal? Resistance for the
   boss. If a new system doesn't interact with the matchup or the permadeath risk, cut it.
3. **Data-first, vertical slices.** Almost everything here is *data* on top of systems you already have
   (`enemies.ts`, `items.ts`, `movesets.ts`). The plan (§E16) front-loads the one engine change that unlocks
   all the rest — the damage pipeline — then pours content into it.

> **Prioritization at a glance:** §E1 (damage pipeline) is the *one big rock*; ship it first. Everything in
> §E3–E6 is then "fill the tables," parallelizable and low-risk. §E8/E10/E11 are the chunkier content phases.

---

## §E1 — Affinity & Matchup: the core system

Right now damage is one undifferentiated number reduced by defense, and elements only exist as enemy-inflicted
status. We split damage into **Physical (typed)** + **Elemental (typed)**, and give every monster
**weaknesses / resistances** to both. This is the single change that makes weapons distinct and monsters
strategic.

### E1.1 The new damage pipeline

```
// physType ∈ slash | blunt | pierce   (from the weapon/move)
// element  ∈ none | fire | ice | lightning | poison | void | radiant
physRaw   = max(6, STR×3 + DEX) × MV                      // unchanged base
physMult  = PHYS_CHART[target.body][weapon.physType]      // 0.6 .. 1.3
physAfter = (physRaw × physMult) reduced by target.defense
elemRaw   = weapon.elementValue (+ affix/rune/infusion)    // 0 if non-elemental
elemMult  = ELEM_CHART[target] for that element            // -0.5 .. 2.0
elemAfter = elemRaw × elemMult                             // NOT reduced by physical defense
crit      = isCrit ? 1.35 : 1.0
hitzone   = target.hitzone(hitPoint).rawMod                // weak point e.g. 1.4
total     = ((physAfter × hitzone) + elemAfter) × crit × rand(0.97..1.03)
```

Key design points:
- **Physical defense does not block elemental**, so element is the answer when raw damage stalls against a tanky
  or physically-resistant foe (classic MH).
- **Absorb** (elemMult < 0) means a wrong element *heals* the enemy — a real punish for not checking. (Use
  sparingly, mostly on bosses/anomalies, so it teaches without feeling random.)
- Status build-up rides on the element/physType too (E1.4), so the matchup affects *ailments*, not just damage.

### E1.2 Physical type chart (Slash / Blunt / Pierce vs body type)

Every monster gets a `body` tag (independent of its AI archetype). Multipliers are gentle (physical is your
bread-and-butter; element is the spicier lever):

| Body type | Examples | Slash | Blunt | Pierce | Identity / why |
|---|---|---|---|---|---|
| **flesh** | goblin, ghoul, frog, beasts, humanoids | 1.1 | 1.0 | 1.0 | soft; cutting works, bleeds |
| **armored** | skeleton soldier, knight, revenant | 0.6 | **1.3** | 0.9 | plate turns blades; crush it |
| **bone** | skeletons, bone golem/colossus | 0.8 | **1.3** | 0.7 | brittle to impact, arrows rattle off |
| **gelatinous** | slime, ooze, swamp slug | **1.3** | 0.5 | 1.0 | splits to cuts, absorbs blunt |
| **chitin** | spiders, crab, beetle | 0.7 | 1.1 | **1.3** | pierce between/through the shell |
| **construct/metal** | golems, iron guardian, sentinel | 0.8 | **1.2** | 0.5 | dense; arrows ping off, lightning hates it (E1.3) |
| **ethereal** | wraith, shade, echo, wisp | 0.5 | 0.5 | 0.5 | barely material — **bring element** |
| **plant** | treant, vine, myconid | 1.2 | 0.8 | 0.9 | chop it; fire is the real answer |
| **aerial** | bat, forest wisp, flying | 0.9 | 0.7 | **1.3** | hard to melee; shoot it down |

### E1.3 Elemental effectiveness chart (by monster family/theme)

Multipliers are sharper so element choice is the strongest matchup lever. `2.0 = weak`, `1.0 = neutral`,
`0.5 = resist`, `0 = immune`, `−0.5 = absorb (heals)`.

| Family / theme | Fire | Ice | Lightning | Poison | Void | Radiant |
|---|---|---|---|---|---|---|
| **Beast / organic** (wolves, hounds, frogs) | 1.5 | 1.0 | 1.0 | **2.0** | 1.0 | 0.8 |
| **Plant / fungal** | **2.0** | 1.2 | 1.0 | **0** | 1.0 | 0.8 |
| **Aquatic / wet** (drowned, toad, serpent, slug) | 0.5 | 1.5 | **2.0** | 1.0 | 1.0 | 1.0 |
| **Fire / forge** (ember, cinder, brand, drake) | **−0.5** | **2.0** | 1.0 | 0.5 | 1.0 | 1.0 |
| **Ice / frost** (frost wolf, glacial, ysold) | **2.0** | **−0.5** | 1.0 | 0.5 | 1.0 | 1.0 |
| **Construct / metal** (golems, guardian, sentinel) | 0.75 | 0.75 | **2.0** | **0** | 1.0 | 1.0 |
| **Undead** (skeleton, ghoul, wight, revenant, choir) | 1.2 | 1.0 | 1.0 | **0** | 0.5 | **2.0** |
| **Spectral / ethereal** (wraith, shade, echo) | 1.0 | 1.0 | 1.0 | 0 | 1.2 | **2.0** |
| **Void / demonic** (void spawn, riftling, maw, heralds) | 1.0 | 1.0 | 1.0 | 0.5 | **−0.5** | **2.0** |
| **Insect / chitin** (spiders, crab) | 1.5 | **2.0** | 1.2 | 0.5 | 1.0 | 1.0 |

> **The "win/lose" the player learns:** Poison shreds living things but is *useless vs undead/constructs/plants*.
> Lightning melts wet things and metal. Fire ↔ Ice are hard counters. Radiant is the universal anti-undead/void
> key (and is rare on purpose — see §E5 infusions). Void hits everything but the void floor *absorbs* it. This
> is exactly why a player keeps **weapon2** for a second damage type and farms **infusions/charms** to cover gaps.

### E1.4 Status-by-source (the matchup also drives ailments)

Builds on the existing build-up-to-100 model. Source determines which ailment you build:

| Source | Ailment | Effect (extends current set) | Strong vs | Useless vs |
|---|---|---|---|---|
| **Slash** weapons | **Bleed** | DoT that worsens while the target moves | flesh, beasts | undead, construct, ethereal |
| **Blunt** weapons | **Stun/KO** | fills a KO meter → topple (free hits, big damage window) | brutes, anything with a head hitzone | — (universal; the blunt selling point) |
| **Pierce** weapons | **Wound** | marks a hitzone; next hits there crit | everything with hitzones | formless slimes |
| Fire | **Burn** | existing: 10/tick ×5; +50% vs plant; ignites oil (E7.4) | plant, fire-weak | wet (extinguishes) |
| Ice | **Frostbite → Freeze** | existing slow; at full build = **Freeze Solid** (stun); shatter combo (E7.4) | fire/forge | ice creatures |
| Lightning | **Shock** | existing stun; **×2 build on Wet targets** | aquatic, metal | insulated/void |
| Poison | **Poison** | existing DoT; +duration vs beast | beast, flesh | undead/construct/plant |
| Void | **Corruption** | existing −def; +stacks lower max HP briefly | living | void kin |
| Radiant | **Sear** | huge bonus DoT vs undead/void; **Blind** (lowers accuracy) vs living | undead, void | constructs |

### E1.5 What the player *does* with this

- **Pack two damage types.** `weapon2` swap (already in save as `activeWeaponSlot`) becomes a core tactic:
  blunt mace for the barracks floor, slash sword for slimes, a fire weapon for the frozen floor.
- **Cook for the matchup.** Meals gain resistance/element-boost variants (§E4) so you prep for a known boss.
- **Socket / infuse for coverage.** Elemental runes & infusions (§E5) let any weapon gain an element.
- **Research pays off.** You don't *see* weaknesses until you've fought a monster enough (E2.3) — knowledge is
  the meta-progression that survives permadeath.

---

## §E2 — Hitzones, weak points, breaks & the Research loop

### E2.1 Hitzones on normal enemies (not just bosses)
Give larger/elite enemies 2–3 **hitzones** with their own `rawMod` and `elemMod` (e.g. a Skeleton's skull takes
1.5× blunt; a Cave Drake's head 1.4×, wings 0.7×). Small/swarm enemies stay single-zone for performance. This
rewards aiming and makes Pierce/ranged classes feel skilful (line up the weak point).

### E2.2 Wound & part-break on normal enemies
- **Wound:** enough focused Pierce/crit damage on one hitzone "wounds" it (visual tear) → that zone takes +25%
  until the enemy dies. Rewards target discipline.
- **Mini-breaks on big enemies:** brutes/champions can have one breakable part (e.g. Forge Golem's arm) that,
  when broken, disables an attack and drops a bonus material — bringing boss-style depth to the field.

### E2.3 The Research / Bestiary loop (knowledge as meta-progression)
A `nd_account_meta` addition: **Research Level** per monster (0→3), raised by kills/breaks/status applications.

| Research Lv | Unlocks in Bestiary |
|---|---|
| 0 | silhouette + name only |
| 1 | HP/dmg bands, AI archetype, body type |
| 2 | **physical & element weaknesses revealed** (the ✓/✗ matchup grid), status vulnerabilities |
| 3 | hitzone map, break rewards, drop table, a lore blurb |

Because the character is wiped on death but **Research persists on the account**, a player who dies on Floor 6
still *learned* Ysold's weakness — their next run starts smarter. This is the cleanest expression of "the player
levels up, not the character." Surface a small "✦ New research" toast on the kill that ranks a monster up.

---

## §E3 — Weapon identity overhaul

**Problem today:** the 100 tiered weapons are pure stat-sticks (`atk = 5 + tier×6`); only the *family* mechanic
differs. **Goal:** every weapon has (a) a physical type, (b) a signature trait, and many have an element. Three
layers of identity, all additive to the existing item data.

### E3.1 Layer 1 — Family default phys type + signature trait
Assign each family its physical type (E1.2) and one always-on trait. The family mechanics you already coded stay;
this just gives each a clear matchup + flavor.

| Family | Phys | Signature trait (passive) | Best against | Weak against |
|---|---|---|---|---|
| Sword | slash | *Riposte*: perfect-dodge → next light is a guaranteed crit | flesh, slimes | armored/bone |
| Greatsword | slash | *Cleave*: hits pass through to a 2nd enemy at 60% | groups, slimes | constructs (bounces) |
| Twin Daggers | slash→pierce | *Bleedstack*: each hit adds bleed; backstab = pierce | flesh, beasts | undead/construct |
| Mace | **blunt** | *Concussion*: +50% KO build; topple bonus dmg | armored, bone, brutes | gelatinous |
| Spear | **pierce** | *Reach*: attacks from outside enemy range; can poke-then-dodge | chitin, aerial, hitzones | groups (single-target) |
| Gauntlets | blunt | *Flow*: hit stacks ramp dmg (existing); perfect-dodge keeps stacks | armored, fast duels | ranged-heavy rooms |
| Bow | pierce | *Weakpoint Draw*: charged shots auto-seek the nearest weak hitzone | aerial, hitzones | tight corridors |
| Crossbow | pierce | *Pierce*: bolts line through up to 2 (existing); +dmg vs full HP | lined-up groups | swarms (slow reload) |
| Staff | magic(blunt chip) | *Channel*: hold to grow spell tier; cheaper MP at higher tier | element-weak foes | melee-pressure |
| Tome | magic | *Glyph*: place runes that detonate; chains element reactions | zoning, packs | mobile single targets |

### E3.2 Layer 2 — Elemental weapon variants
Add an **element axis** to the tiered system. Each family × element variant carries `elementValue ≈ tier×4` and
applies that element's status. Naming convention: `flame_`, `frost_`, `storm_`, `venom_`, `void_`, `radiant_`.

- A **Frost Greatsword (T6)** = slash phys + ice element + frostbite build → murders the Ashen Foundry (fire-weak).
- A **Storm Spear (T5)** = pierce + lightning → deletes the Flooded floor (wet → ×2 shock).
- **Radiant** variants are rare (crafted from boss/anomaly mats only) — the anti-undead/void trump card.

> Don't author all 600 combinations as unique items. Generate them: `{family} × {tier} × {element∣none}` from the
> existing formula + an `element`/`elementValue` field. Pure (non-elemental) variants keep higher raw phys; elemental
> variants trade ~15% raw for the element addend. That trade *is* the build decision.

### E3.3 Layer 3 — Unique / Legendary named weapons (build-defining)
~20 hand-authored uniques that warp playstyle (these are the chase items). Examples:

| Unique | Family | Effect |
|---|---|---|
| **Worldknell** | Mace | KO build doubled; a topple emits an AoE blunt shockwave |
| **Whisper & Wane** | Daggers | two elements at once (poison + bleed); detonate stacks for burst |
| **Dawnedge** | Sword | radiant element; +100% damage to undead/void, glows in the dark (mini-torch) |
| **Stormcaller** | Bow | charged shots chain lightning between wet/metal targets |
| **Mountainbreaker** | Greatsword | T3 charge ignores 50% defense and guarantees a part-break tick |
| **Comet's Tongue** | Staff | spells leave burning ground; fire reactions cost 0 MP |
| **The Last Page** | Tome | summons a temporary spectral ally that mimics your last spell |
| **Gilded Fang** | Daggers | damage scales with current gold (Avarice-anomaly reward) |

### E3.4 Forging weapons from boss parts (define the trees)
Each boss material (`goblin_tooth` … `sovereign_heart`) forges a themed weapon line carrying that boss's element &
a relevant trait. E.g. `frost_crystal` → **Ysold's Lance** (spear/ice, freezes faster); `brand_ember` → **Brand's
Maul** (mace/fire, ignites on topple). This connects "beat boss → break part → craft its weapon → counter the next
floor" into the central gameplay loop.

---

## §E4 — Items: potions, consumables, throwables, utility, alchemy

**Problem today:** ~7 consumables. **Goal:** a deep survival kit where loadout choice before a descent matters as
much as gear. Everything below is stackable consumable data + an `effect` id resolved by an EffectSystem.

### E4.1 Restoratives (tiered + situational)
| Item | Effect | Niche |
|---|---|---|
| Minor / Health / Greater Potion | heal 40 / 90 / 180 over 1.5s (rooted) | the staple; tier for floor depth |
| Mega-Elixir | full HP+MP, 3s root, very rare | the "oh no" button |
| Regen Draught | +HoT 8/s for 20s, no root | drink *before* a fight, not during |
| Cleansing Tonic | removes one negative status instantly | the anti-shock/poison lifesaver |
| Panacea | removes **all** statuses + 5s immunity | clutch vs status-stacking floors (7/8) |
| Bandage | stops Bleed, small heal, can use while moving slowly | bleed counter |
| Mana / Greater Mana Potion | restore MP | Sage lifeline |
| Ether Bun | slow MP regen over time | sustain caster |

### E4.2 Combat tonics (timed buffs — distinct from meals)
Short, strong, pre-fight buffs (90s). Stack with one meal buff but not with each other.
- **Might Draught** +20% phys ATK · **Sorcerer's Draught** +20% magic · **Adamant Tonic** +25% defense ·
  **Whetting Oil** infuse current weapon with an element for 90s (instant matchup fix!) · **Focus Tonic** +crit
  chance · **Endurance Brew** +max stamina & regen · **Quickfoot** +move speed & +2 dodge i-frames.

> **Whetting Oils** are the clutch matchup tool: *Flame Oil / Frost Oil / Storm Oil / Venom Oil / Radiant Oil* —
> temporarily give any weapon the right element when you didn't bring the right weapon. Sold dear, found rarely.

### E4.3 Throwables (active matchup + crowd tools)
| Item | Effect |
|---|---|
| Throwing Knife | small pierce ranged poke (melee classes get a gap-closer answer) |
| Elemental Flask (Fire/Frost/Shock/Venom) | AoE that applies that element's status — bait reactions |
| Flash Bomb | blinds enemies in radius (interrupts casters/chargers; trivializes some tells) |
| Sonic Bomb | staggers sound-sensitive foes; pops burrowed lurkers out of the floor |
| Holy Water | radiant AoE — melts undead/void packs (rare) |
| Caltrops | ground hazard, bleeds + slows pursuers |
| Dung Bomb | forces enemies to lose aggro / scatter (escape tool) |
| Oil Flask | coats target/ground "oiled" → ignite for huge fire (E7.4) |

### E4.4 Traps & deployables (expand the 1 current)
Spike Trap (have) + **Shock Trap** (stun-locks, MH-style capture setup), **Snare Trap** (roots a charging brute
for a free combo), **Bomb Barrel** (place + detonate), **Decoy Totem** (pulls aggro for 6s — solo lifesaver),
**Campfire Kit** (see §E9 rest spots).

### E4.5 Utility / exploration
Torch (raises FOV in dark/Hungering-Dark anomaly), Lockpick (locked vaults §E9), Rope (skip a pit room / shortcut),
Monster Bait (lure a target enemy for farming), Detector Charm (pings nearby traps/secret rooms briefly),
Recall Stone (return to town keeping loot — but ends the descent), **Tent** (deploy a one-time camp anywhere, §E9).

### E4.6 Alchemy / crafting consumables
Let players craft the above at the **Emporium** (town) and at **camps** (limited recipes) from materials:
herbs → potions, monster glands → elemental flasks, oils from fat + reagent, holy water from radiant mats. This
turns trash drops into a sink and lets a prepared player sustain a deep run. Recipes unlock via Research (§E2.3)
and found notes — discovery is content.

### E4.7 Consumable economy guardrails
Everything is finite and you can't pause to shop mid-floor. Inventory has soft pressure (Adventure Bag grid).
The design tension: **carry healing or carry matchup tools?** With one life, that choice should hurt a little.

---
## §E5 — Affixes, decorations (jewels), runes & set bonuses

**Problem today:** affixes are generic flat/percent stat bumps; the 6 set bonuses are "hidden"; only 4 runes
exist. **Goal:** make gear customization a build language that plugs into the matchup web.

### E5.1 Expanded affix pool (~40, tiered by rarity)
Group affixes so drops feel themed, and add matchup-relevant ones:
- **Offensive:** +atk%, +crit chance, +crit dmg, +element atk (per element), +status build-up (per status),
  +damage vs {body type}, +damage to ailing/full-HP targets, lifesteal%, +KO/wound/bleed power.
- **Defensive:** +HP/MP/Stamina, +defense, +%resist (per element), +status resist, +i-frames, −knockback,
  thorns (reflect chip).
- **Utility:** +move speed, −skill cooldown, +stamina regen, +gold find, +XP, +research gain, +potion potency,
  +ammo/edge retention, +FOV radius.
- **Uniques (legendary/mythic only):** *"perfect dodge restores 5 HP"*, *"topples drop a potion"*, *"freezing a
  foe shatters for AoE"*, *"first hit each room is a guaranteed crit"*.

Roll quality bands (an affix's value rolls within a min–max) so two same-name items differ — a reason to keep
hunting and to use the Sage's Tower reroll.

### E5.2 Decorations / jewels (the MH deco system, lightweight)
Add **jewels** that slot into sockets and grant a *named skill* in tiers, separate from raw affixes:
- e.g. *Attack Jewel 1/2/3*, *Element Jewel (Fire)*, *Guard Jewel*, *Evade Jewel (+i-frames)*, *Status Atk
  Jewel*, *Recovery Jewel (potion speed)*, *Slayer Jewel ({body} killer)*.
- Jewels drop from bosses/anomalies and bounties → a clear, gear-agnostic farming target that survives gear
  swaps (you move jewels between pieces). This is the long-tail "perfect build" chase.

### E5.3 Runes — expand from 4 to a coverage set
Current: STR/VIT/INT/Lifesteal. Add: **Elemental Runes** (Fire/Ice/Lightning/Poison/Void/Radiant → grant
`elementValue` to a weapon = budget infusion), **DEX/AGI runes**, **Guard/Evade runes**, **Status runes**
(bleed/KO/wound power), **Thorns/Reflect**, **Greed rune** (+gold/XP). Elemental runes are the *budget* way to
fix a matchup gap if you can't find the right elemental weapon.

### E5.4 Define the set bonuses (currently hidden)
Give each crafted set a 2pc/4pc/5pc identity tied to its boss theme:

| Set | 2-piece | 4-piece | 5-piece (signature) |
|---|---|---|---|
| **Goblin** | +stamina | +move speed | dodging refunds 5 stamina |
| **Drowned** | +lightning resist | +shock build | standing in water heals you (turn the floor's hazard into an ally) |
| **Brood** | +poison resist | +bleed build | your bleeds spread to nearby enemies |
| **Captain** | +defense | +perfect-guard window | perfect guard emits a stagger shockwave |
| **Sage** | +max MP | −skill cooldown | spells cost 10% less; reactions hit harder |
| **Iron Plate** | +poise | −knockback | cannot be staggered below 50% stamina |
| **(new) Frostward** | +fire resist | +freeze build | walk on ice unhindered; freezes shatter for AoE |
| **(new) Voidbane** | +void resist | +radiant build | +damage vs void/undead; immune to Corruption |

> Sets give players a *reason to farm a specific boss* and a counter-identity (Frostward for the fire floor,
> Voidbane for the deep floors). That's the gear treadmill the matchup demands.

---

## §E6 — Monster identity overhaul + new families

**Problem today:** monsters differ mostly by stat block + archetype. **Goal:** each monster has a *signature*
(one thing it does that you must answer), a *counter* (how you beat it), and full matchup data. Plus new families
to complete the affinity web and the floor fantasies.

### E6.1 The monster identity template (fill for every enemy)
```
identity:  one-line "what makes it scary"
signature: its telegraphed special (the thing to dodge/interrupt)
counter:   the intended answer (kite / blunt it / interrupt cast / break part / element)
body:      flesh|armored|bone|gelatinous|chitin|construct|ethereal|plant|aerial
weak/resist/immune/absorb: from E1.2–E1.3 (shown at Research Lv2)
statusVuln: which ailments land hard
hitzones:  [{id, rawMod, elemMod, breakable?}]
```

### E6.2 Worked examples (existing roster gets teeth)
- **Goblin Shaman (F1, Ranged):** *signature* heals/shields other goblins from afar; *counter* it's a
  Support-flavored ranged — kill it first or it turns a trash pack into a slog. Body flesh; weak Poison.
- **Cave Slime (F1, Brute):** *signature* splits into two smaller slimes at 50% HP; *counter* gelatinous → use
  Slash (blunt bounces); burst it past the split threshold. Immune to bleed.
- **Drowned (F2, Lightning):** *signature* leaves a **wet** puddle; *counter* don't stand in it, or use it —
  lightning gets ×2 on wet. Aquatic → weak Lightning, resists Fire.
- **Glacial Knight (F6, Brute):** *signature* armored super-armor charge that applies Freeze; *counter* armored
  body → **Mace/Blunt**; fire element melts it (×2). Break the shield to remove the charge.
- **Bone Colossus (F7, Brute):** *signature* ground-slam shockwave (jump the gap / roll the ring); *counter*
  bone body → blunt + radiant; skull hitzone topples it.
- **Maw (F8, lurker Chaser):** *signature* burrows, invisible, lunges from the floor; *counter* Sonic Bomb pops
  it out; watch the dust tell. Void family → radiant ×2, void absorbed.
- **Echo Shade (F9, Skirmisher):** *signature* mimics the player's last-used skill back at you; *counter* bait a
  cheap skill before engaging; ethereal → physical bounces, bring element.

### E6.3 New monster families to complete the web (and floor flavor)
Add ~12 new enemies so every element/phys type has clear targets and floors feel distinct:
| New enemy | Floor band | Body / family | Niche it fills |
|---|---|---|---|
| **Ironback Beetle** | 3–5 | chitin | a *pierce check* (resists slash/blunt hard) |
| **Gel Cube** | 2–4 | gelatinous | engulfs you (status: stuck) unless you slash free |
| **Mirror Knight** | 4–6 | armored | reflects projectiles → punishes lazy ranged |
| **Storm Elemental** | 6–8 | construct/ethereal | immune lightning, absorbs it to enrage |
| **Bog Witch** | 2–3 | flesh/caster | curses you to "wrong element" (your hits weakened) — interrupt it |
| **Sand Lurker** | 5–7 | chitin/lurker | true ambusher, only Detector/Sonic reveals |
| **Plague Hound pack** | 3–6 | beast/swarm | applies poison fast — bring antidote or Panacea |
| **Living Armor** | 7–9 | construct | empty suit; only the gem hitzone takes damage |
| **Rift Wisp** | 8–10 | void/aerial | teleport-blinks; tags you for a Riftling ambush |
| **Choir Acolyte** | 7 | undead/support | resurrects fallen undead — radiant denies it |
| **Gravetide** | 7–9 | undead/swarm | endless weak adds unless you destroy the spawner |
| **Aurelion (rare beast)** | any (anomaly) | beast/holy | flees; tracking it rewards a Radiant infusion mat |

### E6.4 Elite/Champion affixes — interaction with the web
Extend the existing 8 elite affixes with matchup-aware ones: **Warded** (gains +1 element resist tier — your go-to
element is halved this fight, forcing weapon2), **Unstable Core** (cycles its weakness element every 5s — read and
react), **Bloodgorged** (heals from bleed you apply — don't slash it). These make elites feel like puzzles, not
just stat sponges.

### E6.5 Monster "tells" library (fairness, per §10 of DESIGN_FULL)
Standardize telegraphs so players read by sight + sound: **wind-up flash** (existing 620/900ms), **directional
arc indicator** for sweeps, **ground ring** for AoE (casters), **line indicator** for charges/pierces, **red glow
+ audio sting** for unblockable grabs (must dodge, can't guard). Document each new attack with its tell.

---
## §E7 — Combat depth additions

Layered on the existing stamina/dodge/poise/guard base. Each adds a decision, not just complexity.

### E7.1 Topple / KO state (the blunt payoff)
Blunt build fills a hidden **KO meter**; full meter → enemy **topples** (knocked down) for a long punish window
(longer than a normal stagger). This is *the* reason to bring a mace/gauntlets and the answer to brutes' super-armor.
Bosses topple too (shorter), gated by head hitzones.

### E7.2 Guard & parry per weapon (not just Tanker)
Generalize the shield-guard you have:
- **Shield/Spear:** can guard (spear = brace counter-thrust).
- **Sword:** *Riposte* active parry (tight window → guaranteed crit, no shield needed).
- **Gauntlets:** *Weave* parry (perfect-dodge that counters).
- **Greatsword:** no guard, but the *Tackle* (dodge→heavy) has super-armor frames to power through one hit.
Each weapon thus has a distinct defensive answer → another identity axis.

### E7.3 Perfect-dodge reward
Dodging with i-frames at the last moment (a tighter inner window) grants a brief **Focus** state: slowed time
feel (small), +crit on the next hit, refunds 10 stamina. Rewards reading tells instead of panic-rolling. Ties into
Sword Riposte and Gauntlet Flow.

### E7.4 Environmental reactions (the matchup made physical)
Floors seed hazards; players and enemies interact with them:
- **Water/Wet:** Lightning ×2, Fire halved, Ice can freeze-solid. (Drowned puddles, Pond biome.)
- **Oil:** Fire ignites it → spreading burn field. (Foundry, Oil Flask throwable.)
- **Ice patches:** slipping (less control) unless Frostward set/boots; Frozen enemies + Blunt = **Shatter** (bonus
  + guaranteed break).
- **Poison gas / spore clouds:** Fungal floor; build poison on anything inside (use it on enemies via knockback).
- **Lava/heat vents, void rifts, collapsing floor:** per-floor signature hazards (E9).
Reactions are the skill expression: bait a charger into your Oil Flask, then a Fire Flask, for a one-combo kill.

### E7.5 Stamina-driven enemy behavior & feints
Give tougher enemies a light "stamina" so they occasionally **feint** (fake a wind-up) or pause when pressured —
discourages pure pattern memorization and rewards reactive play. Keep it subtle so tells stay readable.

### E7.6 Combo/weapon-art expansion
Each family gets 1–2 unlockable **weapon arts** (via skill tree, E8): e.g. Sword *Crescent Lunge*, Greatsword
*True Charge*, Daggers *Shadowstep Flurry*, Spear *Skewer* (multi-pierce), Bow *Rain of Arrows*, Staff/Tome
*Meteor/Glyph Storm*. These are the high-MV, high-commitment payoff moves.

---

## §E8 — Classes, skill trees, masteries & specializations

**Problem today:** skill trees exist but are under-specified ("see in-game"). **Goal:** concrete trees that make
each class play several ways, all interacting with the matchup web.

### E8.1 Tree shape (consistent across classes)
**3 branches × 4 tiers + 1 capstone (needs 8 nodes).** Mix passives and actives (cooldown + MP/stamina cost).
Skill points = 1/level (cap 50 → up to ~50 points; a focused build clears ~2 branches + capstone). Respec at
Sage's Tower for escalating gold (discourage matchup-fishing per encounter).

### E8.2 Concrete trees (nodes abbreviated)

**Swordman — Tempo / Guard / Blade**
- Blade: +slash MV · 3rd-light combo · Bleed-on-crit · *Crescent Lunge* (art).
- Guard: faster Riposte window · chip immunity · *Bulwark* (omni-guard 2s) · counter-stagger.
- Tempo: roll-cancel heavies · +stamina regen · *Momentum* (no-hit streak buffs atk) · perfect-dodge → cooldown refund.
- **Capstone — Perfect Tempo:** perfect dodge resets one skill cooldown.

**Archer — Precision / Volley / Survival**
- Precision: +weakpoint dmg · charged-shot crit · *Mark* (tagged foe takes +15%) · *Deadeye* (charged weakpoint = part-break).
- Volley: multishot spread · *Rain of Arrows* · ricochet · +ammo retention.
- Survival: backstep-shot (fire while dodging) · move-while-aiming · *Trap Arrow* (deploys shock/snare) · +i-frames.
- **Capstone — Hunter's Eye:** Research Lv of the target adds bonus damage (knowledge = power, literally).

**Tanker — Aegis / Provoke / Impact**
- Aegis: +block% · perfect-guard window · reflect chip · *Iron Stance*.
- Provoke: AoE *Taunt* · threat mult · *Last Stand* (<25% HP → +def) · aggro-heal.
- Impact: +KO build · *Shield Bash* (stun) · *Ground Slam* (AoE topple) · KO topple bonus dmg.
- **Capstone — Immovable:** no knockback; perfect guard → stagger shockwave (Captain 5pc synergy).

**Assassin — Shadow / Venom / Flow**
- Shadow: longer stealth · +backstab crit · vanish-on-kill · *Death Mark* execute.
- Venom: poison/bleed on crit · +dmg vs ailing · *Rupture* (detonate bleed/poison stacks for burst) · spread-on-kill.
- Flow: +dodge i-frames · *Frenzy* uptime · dash-attack reset on kill · +crit dmg.
- **Capstone — Lethality:** crits against a wounded hitzone can instakill non-elite enemies (huge clear speed, capped vs bosses).

**Sage — Elements / Glyph / Mysticism**
- Elements: +magic MV · element swap (fire/ice/lightning/void/radiant stance) · lingering ground hazard · *Meteor*.
- Glyph: place runes · chain detonations · slow/heal zones · *Glyph Storm*.
- Mysticism: MP efficiency · shields/heals (affect companions) · *Cleanse* (party status wipe) · *Mana Shield*.
- **Capstone — Convergence:** detonating two different elements on one target triggers a big reaction (E1) — the
  Sage *is* the matchup, able to exploit any weakness on demand.

### E8.3 Weapon Mastery (cross-class progression)
Per-weapon-family **Mastery** (account-meta, survives death; small per-run ramp): using a family ranks it up,
unlocking minor passives (e.g. Mastery 3: +5% that family's status build). Rewards weapon loyalty *and* gives the
permadeath account something to grow. Caps low so it's flavor, not a power wall for fresh characters.

### E8.4 Specializations (a mid-run identity pick)
At a milestone (e.g. clear Floor 4 boss), pick **one Specialization** that sharpens your fantasy: *Slayer* (+dmg
vs a chosen body type), *Elementalist* (+all element atk, −raw), *Berserker* (lifesteal, +dmg at low HP),
*Sentinel* (guard/parry focus), *Trapper* (deployables/throwables empowered). One per run, locked in — a build
commitment that fits permadeath stakes.

---

## §E9 — Dungeon, environment hazards, room types & secrets

**Problem today:** floors are BSP rooms + traps + warps + ambient spawns. **Goal:** floors that *do* things, with
exploration payoffs that justify the "explore-first" pillar.

### E9.1 Room archetypes (tag rooms at generation)
Beyond generic rooms: **Treasure Vault** (locked; Lockpick or a key from a nearby elite), **Arena** (doors seal,
clear a wave for loot), **Shrine** (one-time buff or risky bargain), **Library/Lore** (research notes, recipe
unlocks, summon hints), **Rest Nook** (safe-ish camp spot), **Hazard Room** (environmental gimmick), **Puzzle
Room** (light switch/pressure-plate for a reward), **Merchant Pocket** (in-floor stall), **Empty/Quiet** (pacing).
The director (E12) weights these per floor.

### E9.2 Environmental hazards per floor (signature mechanics)
Tie hazards to the matchup so the *floor itself* teaches its element:
- F2 Flooded/Pond: water everywhere → lightning floor (bring/avoid).
- F3 Fungal: spore clouds (poison) + explosive puffballs.
- F5 Foundry: lava channels, oil pools, steam vents (fire reactions central).
- F6 Frozen: ice patches (slip), thin ice (falls), blizzard low-visibility windows.
- F7 Catacombs: curse fog, collapsing tombs, gravetide spawners.
- F8 Void: drifting rifts (teleport/pull), gravity wells, phasing walls.
- F10 Throne: a mix — the "final exam" of every hazard.

### E9.3 Secrets & exploration rewards
**Hidden rooms** (cracked walls revealed by Detector/bombs), **secret warp shortcuts**, **buried caches**, **lore
pages** that feed summon investigations (E11). Reward the player who spends finite time/resources poking around —
under permadeath, the "do I explore or descend?" tension is real and good.

### E9.4 Floor 2 special status & multi-biome
You already doubled Floor 2 into 5 biomes — lean in: each biome carries its element/hazard and a biome-themed
mini-pack, so crossing Floor 2 is a tour of the matchup before it gets lethal. Consider a small biome-boss
mini-encounter per quadrant for variety.

### E9.5 Verticality-lite & shortcuts
Pits/ledges (one-way drops to skip ahead at a cost), breakable floors, and unlockable shortcuts back toward the
warp give floors a sense of place without true 3D. Helps the "huge floor" fantasy read as navigable, not tedious.

---
## §E10 — Bosses 2.0

Keep the existing roster/HP/break-parts; deepen the *fights* so they're matchup puzzles, not DPS races.

### E10.1 Element-phase bosses (forces the weapon2 / oil decision)
Some bosses **change elemental state** between phases, flipping their weakness:
- **Forgefather Brand (F5):** Phase 1 molten (weak Ice). At 40% the arena ignites and he *cools to obsidian* —
  now armored (weak Blunt), fire-immune. A player who only brought ice must adapt (Whetting Oil, weapon2, blunt).
- **Frost Warden Ysold (F6):** mirror of Brand — frozen (weak Fire) → blizzard phase where freezing you is the
  threat; melt her core (radiant/fire) to end it.
- **Riftmaw (F8):** cycles void/neutral; punishes void weapons (absorbs) and rewards radiant.

### E10.2 More breaks + break-driven phase skips
Expand to 3–4 breakable parts on later bosses (Sovereign already has 4). Breaking the right part can **skip or
weaken** an enrage (e.g. break Ysold's Ice Heart pre-enrage → no blizzard phase). Rewards aggression + aim and
gives veteran players a speed-route.

### E10.3 Mechanic vocabulary (reused, escalating)
Standard, learnable mechanics that recombine: **arena AoE** (leave the ring), **grab** (unblockable → must dodge),
**summon adds** (kill priority), **charge line** (sidestep), **pillars/cover phase** (use the room), **enrage**
(spacing up). Floor 10 is explicitly a "greatest hits" exam of these.

### E10.4 Boss research & "investigation" tells
At Research Lv2 on a boss, the HUD shows its current weakness element per phase — earned, not given. Encourages
fighting a boss "to learn it" on an early run even if you die, because the knowledge banks (E2.3).

### E10.5 Optional difficulty: Tempered/Apex bosses
Post-checkpoint, bosses can roll a **Tempered** variant (more aggressive pattern, extra phase, mythic-tier
drops) — the endgame farm target for jewels/uniques, gated behind Research and good gear.

---

## §E11 — Anomalies & secret-boss investigations

Build on the 15 existing anomalies; deepen the rare/secret layer the original brief wanted ("ประตูมิติ, บอสลับ
ที่ต้องอัญเชิญ, โจรตามล่า").

### E11.1 Investigation system (summon secret bosses via knowledge)
Surface **clues** through lore pages (E9.3), monster Research, and NPC banter. Meeting a hidden condition spawns a
secret encounter. Examples (conditions discovered, never quest-marked):
| Secret boss | Investigation condition | Reward |
|---|---|---|
| **The Gravelord** | light 4 black candles on one floor in a single visit | necromancy set + summon-ally charm |
| **Avarice, the Gilded Maw** | enter the cursed vault while carrying ≥ X gold | gold-scaling weapon (*Gilded Fang*) |
| **Clockwork Judge** | kill a floor champion taking 0 damage, then ring the bell | time-slow active rune |
| **Old Friend** | collect 3 journal pages, read them at a camp | permanent named companion |
| **The Hungering Dark** | clear a floor lighting no torch | void weapon line + Radiant counter-mat |
| **Aurelion** | track the rare beast across 3 floors (it flees) | Radiant infusion materials (the anti-void key) |

### E11.2 The Hunter — nemesis arc (deepen the pursuit anomaly)
Make the existing Hunter a recurring rival, not a one-off stalker:
- Escalating encounters (notes → stalking cues → invasions). Stores `hunterState` (encounters, defeats,
  escalation) on the save.
- Plays like a real character (uses the companion/CharacterAI brain, aggressive profile: dodges, drinks potions,
  kites when low). Beating them drops their unique weapon + `nemesis_mark`; fleeing costs you gold/an item and
  they return stronger. Optional finale on F9.

### E11.3 Dimensional Rift / Mirror Rift depth
- **Rift → otherworld arena** with a remixed boss (inverted palette, harder pattern, Mythic mats).
- **Mirror Rift → fight your own build** (Shade with your gear/skills) — pure skill duel; winning grants a unique
  charm. Reuses CharacterAI on *your* loadout.

### E11.4 Anomaly variety & stacking rules
Keep them rare (22% per floor exists; sub-roll which type by weight + floor). Never stack two combat anomalies on
one floor. Always telegraph entry (tint + audio sting). Add a couple more flavor anomalies: **Wandering Merchant
(rare stock)**, **Cursed Bargain (power for a permanent curse)**, **Echo duel (a past dead run)**, **Beast
Stampede**. Mythic-tier mats are anomaly-gated, keeping them special.

---

## §E12 — Economy, crafting, loot tables & target farming

### E12.1 Conditional loot tables (farm with intent)
Extend drop tables with conditions: **on part-break**, **on Champion**, **on status-kill** (e.g. kill while
frozen → extra crystal), **element-kill**, **research-gated rares**. Lets players *farm a specific material* by
playing a certain way — the MH "I need 2 more antlers" loop.

### E12.2 Salvage / disassemble & transmute
Break unwanted gear into materials; transmute surplus low mats upward (existing Sage's Tower) for a chance at the
tier you need. Turns the flood of drops into agency and a gold/mat sink.

### E12.3 Currency & sinks balance
Gold sinks scale so a careful player is always *slightly* short: upgrades (+1→+5 exists), forging, reroll affixes,
jewels, oils/throwables, Inn, respec, companions, Warp/Recall stones. Add a second soft currency only if needed
(e.g. **Research Points** spent to reveal a weakness early) — but prefer fewer currencies.

### E12.4 Bounties 2.0
Extend the daily bounty pool with matchup-flavored objectives: *"break Ysold's antlers"*, *"kill 10 undead with
Radiant"*, *"topple a brute"*, *"clear Floor 5 without drinking a potion"*. Teaches systems by asking for them;
rewards jewels/mats/oils.

### E12.5 Loot feel & pity
Keep rare drops genuinely rare (the dopamine), with a gentle anti-dry-streak nudge on rares and a hard guarantee
on first-time boss-part breaks. Mythic stays anomaly-only.

---

## §E13 — Companions, NPCs, town services & meta-progression

### E13.1 Companions with matchup roles
Companions already exist (Tanker/Archer/Sage, auto-potion, fatigue, can't die). Deepen:
- Give them **element loadouts** so a companion can cover *your* matchup gap (bring the Sage who casts the element
  you lack). Command wheel: *Aggressive/Defensive/Follow/Focus-my-target/Use-skill*.
- Optional **Hardcore companions** toggle (they *can* die permanently) for players who want the stakes — off by
  default to respect the current "retreat at 0 HP" design.
- Affinity unlocks small combat synergies + banter that reacts to Research/boss kills.

### E13.2 Town 2.0 services (round out the hub)
Existing: Armory, Inn, Emporium, Sage's Tower, Chapel, Guild, Wandering Stall, Guard, Gate. Add depth:
- **Armory:** weapon trees + **infusion** (apply element to a weapon with a rune/mat) + jewel socketing.
- **Chapel:** Radiant blessings (temp anti-undead), curse cleansing, set a "respawn-town-loadout" template.
- **Guild:** Research/Bestiary terminal, bounty board, Hall of Champions, companion hire, **investigation log**
  (tracked clues for secret bosses).
- **Sage's Tower:** affix reroll, transmute, **decoration crafting** (jewels), Research-Point spend.

### E13.3 Meta-progression that respects permadeath
Everything account-level and *knowledge/cosmetic*, never raw power that trivializes a fresh run:
- **Research/Bestiary** (E2.3), **Weapon Masteries** (E8.3, capped), **Hall of Champions** titles, **checkpoint
  floors** (exists), **unlocked recipes/clues**, **cosmetic** dyes/sprites. A new character is still fragile; the
  *player* is what got stronger.

---

## §E14 — Difficulty modifiers, accessibility & tuning appendix

### E14.1 Run modifiers (opt-in masochism + leaderboard flavor)
At creation, stackable toggles (titles recorded): **Ironbound** (no Recall/Warp), **Starved** (−50% healing),
**Hunted** (Hunter earlier/often), **Blackout** (−FOV), **Glass** (×2 damage taken, ×1.5 dealt — speed/risk),
**Wrongfooted** (enemy weaknesses hidden even at Research Lv2 — pure player knowledge), **Masochist** (durability
+ inventory weight on).

### E14.2 Accessibility (difficulty ≠ obscurity)
Per §10's "brutal but fair": colorblind-safe element/aura colors + icons, audio-cue option for tells, adjustable
text size, optional **bigger dodge i-frame** assist (clearly marked, disables leaderboard), remappable keys, a
"telegraph emphasis" toggle that brightens wind-ups. Hard should come from execution, never from not-being-able-to-see.

### E14.3 Tuning appendix (new knobs — keep in `config.ts` TUNING)
```ts
export const TUNING_V2 = {
  affinity: {
    physMult: { weak: 1.3, neutral: 1.0, tough: 0.8, resist: 0.6 },
    elemMult: { weak: 2.0, neutral: 1.0, resist: 0.5, immune: 0.0, absorb: -0.5 },
    elementValuePerTier: 4,          // elemental weapon variant scaling
    elementalRawTradeoff: 0.85,      // elemental variants keep 85% of raw phys
  },
  status: {
    bleed:  { perTick: 6, ticks: 6, moveBonus: 1.5 },
    ko:     { threshold: 100, toppleMs: 1500, dmgBonusPct: 30 },
    wound:  { threshold: 80, bonusPct: 25 },
    freezeSolidMs: 1200, shatterBonusPct: 60,
    wetLightningMult: 2.0, wetFireMult: 0.5, oilIgniteBurnMult: 2.0,
  },
  research: { kills: [0, 5, 15, 30], breaksGrantBonus: 2 },  // Lv thresholds
  masteryCapPerFamily: 5,
  tonics: { durationMs: 90000, oilDurationMs: 90000 },
  elite: { wardedResistTier: 1, unstableCycleMs: 5000 },
  bossElementPhase: { brandObsidianAtPct: 40, ysoldBlizzardAtPct: 45 },
} as const;
```

---
## §E15 — Extended data models (TypeScript, additive)

All additive to the existing `src/types/index.ts`. Nothing here forces a save break — gate behind `version` and
default missing fields. Strict, no `any`.

```ts
// ── Affinity & damage typing ─────────────────────────────────────────────
export type PhysType = 'slash' | 'blunt' | 'pierce';
export type Element  = 'none' | 'fire' | 'ice' | 'lightning' | 'poison' | 'void' | 'radiant';
export type BodyType = 'flesh' | 'armored' | 'bone' | 'gelatinous' | 'chitin'
                     | 'construct' | 'ethereal' | 'plant' | 'aerial';

export interface Affinity {
  body: BodyType;
  weak?:   Element[];     // ×2.0
  resist?: Element[];     // ×0.5
  immune?: Element[];     // ×0
  absorb?: Element[];     // ×-0.5 (heals — use sparingly)
}

export interface Hitzone {
  id: string;
  rawMod: number;         // physical multiplier on this zone (weak point > 1)
  elemMod: number;        // elemental multiplier on this zone
  breakable?: boolean;
  breakHp?: number;
  breakReward?: string;   // itemId on break
  disablesAttack?: string;
}

// ── Weapon additions (extend WeaponItem) ─────────────────────────────────
export interface WeaponExt {
  physType: PhysType;
  element?: Element;
  elementValue?: number;          // elemental damage addend
  trait?: string;                 // signature passive id (E3.1)
  uniqueEffectId?: string;        // legendary/mythic build-warping effect
  infusedElement?: Element;       // applied via rune/town infusion at runtime
}

// ── Status / ailments ────────────────────────────────────────────────────
export type Ailment = 'poison' | 'shock' | 'frostbite' | 'burn' | 'corruption'
                    | 'bleed' | 'ko' | 'wound' | 'freeze' | 'sear' | 'blind' | 'stuck';

export interface StatusBuildup { ailment: Ailment; value: number; }   // to 100

// ── Effects (consumables/skills resolve through one system) ───────────────
export interface EffectSpec {
  id: string;
  kind: 'heal' | 'cleanse' | 'buff' | 'throwable' | 'deploy' | 'utility' | 'infuse';
  // numeric/string params resolved by EffectSystem — keep typed, no any
  params: Record<string, number | string | boolean>;
  channelMs?: number;
  durationMs?: number;
}

// ── Decorations / jewels & runes ──────────────────────────────────────────
export interface Jewel { id: string; name: string; skill: string; level: 1 | 2 | 3; }
export interface RuneDef { id: string; name: string; grants: Partial<Affix> | { infuse: Element; value: number }; }

// ── Skills (concrete tree node) ───────────────────────────────────────────
export interface SkillNode {
  id: string; name: string; branch: string; tier: 1 | 2 | 3 | 4;
  type: 'passive' | 'active' | 'art';
  cost: number; requires?: string[];
  cooldownMs?: number; mpCost?: number; staminaCost?: number;
  description: string;
}
export interface ClassSkillTree {
  classId: ClassId; signature: string; weaponFamilies: string[];
  nodes: SkillNode[]; capstone: SkillNode;
}

// ── Monster def (extend enemies.ts entries) ───────────────────────────────
export interface EnemyExt {
  identity: string; signature: string; counter: string;
  affinity: Affinity;
  statusVuln?: Partial<Record<Ailment, number>>;   // build-up multipliers
  hitzones?: Hitzone[];
  feints?: boolean;
}

// ── Research / meta (extend AccountMeta) ──────────────────────────────────
export interface ResearchEntry { enemyId: string; level: 0 | 1 | 2 | 3; kills: number; breaks: number; }
export interface MasteryEntry  { family: string; level: number; uses: number; }
export interface AccountMetaV2 {
  research: ResearchEntry[];
  masteries: MasteryEntry[];
  unlockedRecipes: string[];
  discoveredClues: string[];        // secret-boss investigation progress
  titles: string[];
}

// ── Save additions (extend CharacterSave, default-safe) ───────────────────
export interface CharacterSaveV2Add {
  specialization?: string;          // E8.4, locked per run
  hunterState?: { encounters: number; defeats: number; escalation: number };
  activeTonic?: { effectId: string; expiresAt: number };
  weaponInfusions?: Record<string, Element>;   // instanceId -> infused element
  runModifiers?: string[];          // E14.1
}
```

> **Migration:** bump `CharacterSave.version`; in `SaveManager` default every new field (empty arrays/undefined)
> so existing saves load. Affinity/hitzone data lives in `enemies.ts`/`bosses.ts` (content, not save).

---

## §E16 — Implementation plan: P7 → P12

Build order is **engine-change-first, then content-flood**. The one risky change (the damage pipeline) is P7;
after that, nearly everything is data you can add in parallel and tune safely. Keep doing **vertical slices** and
update `progress.md` + the "currently on" line in `CLAUDE.md` after each phase.

### P7 — Damage pipeline & affinity core *(the one big rock)*
**Goal:** split damage into typed physical + typed elemental with per-monster affinity; nothing else changes
visibly yet except numbers that respect weakness/resistance.
- Add `PhysType`/`Element`/`BodyType`/`Affinity`/`Hitzone` types (§E15) and `PHYS_CHART`/`ELEM_CHART` (§E1.2–E1.3).
- Refactor the damage resolver to the §E1.1 pipeline; add `physType` + `element`/`elementValue` to weapon data
  (default existing weapons to a sensible phys type, no element).
- Tag every enemy/boss with `body` + weak/resist (start from the §E1.3 family table).
- Add elemental damage numbers (color-tinted) + a "resisted/weak" hit indicator.
- **Acceptance:** a mace out-damages a sword vs skeletons; a fire weapon visibly doubles vs the Frozen floor;
  using Void on the Void floor shows "absorbed"; build clean, saves still load.

### P8 — Status & reactions expansion
- Implement Bleed/KO(topple)/Wound/Freeze-solid/Sear/Blind on top of existing statuses (§E1.4, §E7.1).
- Environmental reactions: wet/oil/ice/gas tiles + the multipliers (§E7.4).
- Hitzones + wound + mini-breaks on big/elite enemies (§E2.1–E2.2).
- **Acceptance:** blunt topples a brute for a punish window; freezing + blunt = shatter; lightning ×2 in water;
  arrows crit a marked weak point.

### P9 — Item & gear flood
- Generate elemental weapon variants from the tier system (§E3.2); author ~20 uniques (§E3.3) and boss-forge lines
  (§E3.4) with trait/uniqueEffect ids resolved by an EffectSystem.
- Expand consumables: restoratives, tonics, **whetting oils**, throwables, traps, utility, alchemy recipes (§E4).
- Expand affixes (~40), add jewels/decorations + socketing, expand runes incl. elemental infusion (§E5).
- Define the set bonuses + 2 new sets (§E5.4).
- **Acceptance:** a player can fix a matchup gap three ways (weapon2 / oil / infusion rune); jewels move between
  pieces; every set's 5pc does something named.

### P10 — Monster identity & Research/Bestiary
- Fill the identity template (§E6.1) for the full roster; add ~12 new families (§E6.3) and matchup-aware elite
  affixes (§E6.4); standardize tells (§E6.5).
- Build the Research/Bestiary system + UI (§E2.3) and the Guild terminal; wire Research Lv to weakness reveal +
  `Hunter's Eye`/`Convergence` synergies.
- **Acceptance:** killing a monster ranks its Research; Lv2 reveals its ✓/✗ grid; the Bestiary is browsable in town.

### P11 — Classes, skills, bosses 2.0
- Author the concrete skill trees (§E8.2), weapon arts (§E7.6), masteries (§E8.3), specializations (§E8.4); skill
  menu (K) shows real nodes.
- Bosses 2.0: element-phase flips (§E10.1), extra breaks + break-skip-enrage (§E10.2), phase weakness HUD at
  Research Lv2, optional Tempered variants (§E10.5).
- **Acceptance:** each class plays ≥2 distinct ways; Brand's obsidian phase flips his weakness mid-fight and a
  player must adapt; breaking a key part demonstrably skips an enrage.

### P12 — Dungeon depth, anomalies, economy, polish
- Room archetypes + per-floor hazards + secrets (§E9); investigation system & secret bosses (§E11.1); Hunter
  nemesis arc (§E11.2); rift/mirror depth (§E11.3).
- Conditional loot, salvage/transmute, Bounties 2.0, currency balance (§E12); companion element roles + hardcore
  toggle (§E13.1); Town 2.0 services (§E13.2).
- Run modifiers + accessibility (§E14); final tuning pass against `TUNING_V2` and death telemetry.
- **Acceptance:** a full descent shows varied rooms/hazards, a rare anomaly or two, a learnable matchup arc, and
  the "what do I bring?" decision feels load-bearing.

### Sequencing notes
- **Strict dependency:** P7 unlocks everything; do it first, alone, and verify before flooding content.
- **Parallelizable after P7:** P9 (items) and P10 (monster data) are mostly independent table-filling — split
  across sessions freely.
- **Quick wins to ship early (high impact / low risk):** elemental weapon variants (§E3.2), whetting oils (§E4.2),
  set-bonus definitions (§E5.4), the Research weakness reveal (§E2.3). Each is small and immediately deepens play.
- **Biggest rocks:** the P7 pipeline, the skill trees (P11), and the investigation/secret-boss layer (P12).

### Definition of done for the whole expansion
A new player, on a fresh permadeath character, faces a real question at the Dungeon Gate — *which damage types,
oils, jewels, and meal do I bring for what's ahead?* — and a veteran answers it with **knowledge they earned
across past deaths** (Research, masteries, recipes, clues). Every weapon, item, and monster has a clear reason to
exist inside that decision. That is the depth target.
