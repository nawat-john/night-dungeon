# Dungeon RPG — Design & Scaffold Spec

> A single-player, pixel-art, roguelike dungeon crawler for the web.
> This document is the source of truth for scaffolding with **Claude Code**.
>
> **Current status: PHASE 6 (P1–P5 complete, ready for art/polish pass)**

All in-game text is **English**.

---

## 1. Concept

A 10-floor dungeon crawler with hardcore permadeath. The player creates one character (race + class), spawns in a town hub in front of the dungeon gate with class-appropriate starting gear, then descends floor by floor. Each floor is a very large map of connected rooms; scattered **warp pads** lead down to the next floor. If the character dies, the save is **wiped** and the player starts over from character creation.

### Design pillars
1. **Readable pixel art** — every race and class is identifiable from silhouette + gear alone.
2. **Permadeath has weight** — one character per account, death = full reset. No respawn.
3. **Lean architecture** — game logic is fully client-side; backend only does auth + save.
4. **Explore-first** — large floors, hidden warp pads, town as the only safe haven.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Engine | **Phaser 3** | Mature 2D web engine: tilemaps, sprites, input, scenes, camera, arcade physics. |
| Language | **TypeScript** | Strict mode on. |
| Bundler / dev server | **Vite** | Fast HMR, simple static build. |
| State (game) | In-engine + plain TS modules | No heavy state lib needed for single-player. |
| Hosting | Static (Vercel / Netlify / Cloudflare Pages) | Just ship the `dist/` bundle. |
| Backend | **Supabase** | Auth + Postgres. Save = one JSONB blob per player (IP-based). |
| Art tool | Aseprite (authoring) / free packs for placeholders | |

---

## 3. Pixel art spec

- **Base tile size:** `32 x 32 px`
- **Character sprites:** `32 x 40 px` (placed in a `32 x 48` cell with headroom)
- **Item / UI icons:** `32 x 32` (inventory) and `16 x 16` (hotbar)
- **Internal render resolution:** `480 x 270` (16:9). Integer-scaled to the window.
- **Phaser scale:** `Phaser.Scale.FIT` with `pixelArt: true`, `roundPixels: true`, `antialias: false`.

---

## 4. Game systems (full design)

### 4.1 Races and classes

| Race | Stat modifiers | Allowed classes |
|---|---|---|
| **Human** | +1 to all | Swordman, Archer, Tanker, Assassin, Sage |
| **Elf** | +DEX +2, +INT +2, −VIT | Swordman, Archer, Assassin, Sage |
| **Dwarf** | +VIT +2, +STR +2, −AGI −2 | Swordman, Tanker, Sage |
| **Barbarian** | +STR +2, +HP +30, −INT −2 | Swordman, Archer, Tanker |
| **Beastman** | +AGI +2, +DEX +2, −INT −2 | Swordman, Archer, Tanker, Assassin |

**Classes** (role + starting equipment):

| Class | Role | Starting equipment |
|---|---|---|
| **Swordman** | Balanced melee | Short Sword, Leather Armor, 3× Health Potion |
| **Archer** | Ranged DPS (DEX) | Short Bow, 20× Arrow, Leather Armor, 3× Health Potion |
| **Tanker** | Defense / guard | Mace, Round Shield, Chainmail, 5× Health Potion |
| **Assassin** | Burst / crit (AGI) | Twin Daggers, Light Leather, 3× Health Potion, 2× Smoke Bomb |
| **Sage** | Magic / ranged (INT) | Staff, Robe, 3× Mana Potion, Fireball Tome |

### 4.2 Stats

Core block: `HP, MP, STR, DEX, INT, VIT, AGI`.
- Max Stamina is flat 100 for all classes.
- Physical ATK = `max(6, STR×3+DEX) × weapon MV`. Magic ATK = same × 1.4.
- Crit chance = `3% + AGI × 0.6%`. Crit damage = 135%.
- XP curve: `50 × level^1.6`. Level cap 50. **+5 stat points** and **+1 skill point** per level.

### 4.3 Character creation flow
`New Game → choose Race → choose Class (filtered to that race) → confirm` → create save → spawn in **Town** at the **Dungeon Gate** with starting gear.

### 4.4 Permadeath save model
- **One character per account.** IP-based player ID.
- On death: show death screen (cause, floor, time, gold) → `SaveManager.wipe()` → main menu.
- **Account meta** (`nd_account_meta`) survives permadeath: run history (50 entries), Hall of Champions (victories), unlocked checkpoint floors.
- Checkpoint floors: defeating floor N boss permanently unlocks floor N+1 as a start option for future runs.

### 4.5 Town (hub)
A hand-authored 64×52 tile map. All buildings and locations:
- **Armory** — buy weapons/armor, upgrade equipment (+1 to +5), forge boss-material gear
- **The Last Inn** — rest (30 g) → full HP/MP restore; companions recover fatigue
- **Emporium** — consumables, ammo, Adventure Bag
- **Sage's Tower** — enchant (add affixes), socket runes, transmute items
- **Chapel** — blessing and passive buffs
- **Adventurer's Guild** — hire companions (up to 2), daily bounties (4 of 22 pool, date-seeded), run graveyard (Hall of Champions + last 6 runs)
- **Wandering Stall** — daily-rotating rare vendor (3 of 12 items, date-seeded)
- **Town Guard** — banter NPC, reacts to player's deepest floor and boss kills
- **Dungeon Gate** — enter dungeon; shows checkpoint floor selector if any floors above 1 are unlocked

### 4.6 Dungeon floors
- **Floor 1:** 500×400 tiles. **Floor 2:** 1,000×800 tiles (multi-biome quadrant layout). **Floors 3–10:** 500×400 tiles each, with a unique procedural floor-tile theme per floor.
- Generated from a **seeded BSP** algorithm. Seed + floor number stored in save; map regenerated deterministically on load.
- Each floor has a **spawn budget** (180 + floor×55) allocating themed enemies.
- **Up to 8 warp pads** per floor, placed in a 4×2 sector grid.
- **Traps:** spike, alarm, net — 1 per room average.
- **Bosses:** one boss per floor in a dedicated room. Two phases + enrage at 20% HP. Break parts for extra loot. Each boss has a unique procedural sprite (`boss_<id>` key).
- **Anomalies:** 22% chance per floor; 15 types (combat, puzzle, shop, survival events).
- **Ambient spawning:** every 22 s, 1–3 themed enemies spawn 8–22 tiles away.

### 4.7 Combat
Real-time action combat with stamina, dodge i-frames, poise, and guard/parry.
- **Stamina** (100 max, 18/s regen after 600 ms delay). Dodge (25), light (8), heavy (22).
- **Dodge:** 200 ms total, i-frames at ms 50–150.
- **Poise:** heavy hits + stagger system. Brutes have super-armor.
- **Guard (Tanker):** 60% block, 100 ms perfect window for nullify + stun.
- **Weapon families:** each of 10 families has unique mechanics (greatsword charge, dagger frenzy, crossbow pierce, gauntlet flow stacks, etc.).
- **Status effects:** Poison, Lightning Shock, Frostbite, Burn, Void Corruption — each with build-up mechanic.
- **Skills:** class skill trees, 1 point per level.

### 4.8 Inventory & equipment
- 10 equipment slots: head, chest, hands, legs, boots, mainhand, offhand, weapon2, amulet, ring + charm.
- Items have **rarity** (common → mythic), **affixes** (flat/percent stat bonuses), **sockets** (rune slots), **upgrade level** (0–5), and **upgrade branch** (sharp/light).
- **Adventure Bag** unlocks the full inventory grid; without it only a small starting grid is available.

### 4.9 Companions
Hire up to 2 companions at the Adventurer's Guild (Tanker/Archer/Sage role). Companions fight alongside the player, auto-use potions, and gain affinity over time. Fatigue increases each floor; resets at inn. Cannot permanently die.

### 4.10 Bounties
Daily rotation of 4 bounties from a pool of 22, seeded by current date. Types: kill specific enemy type, kill count, reach a floor, defeat a boss. Bounty rewards: gold + optional materials. Tracked per-run in `activeBounties`; claimed flag stored in `enemyKillMap` with a date key.

---

## 5. Project structure

```
night-dungeon/
├─ index.html
├─ package.json
├─ tsconfig.json            # strict: true
├─ vite.config.ts
├─ CLAUDE.md                # repo guide for Claude Code
├─ DUNGEON_RPG_SPEC.md      # this file
├─ DUNGEON_RPG_DESIGN_FULL.md # extended design details
├─ progress.md              # step-by-step implementation progress
├─ wiki/                    # player-facing reference docs
├─ supabase/migrations/     # 001_saves.sql
├─ public/assets/           # tiles, sprites, maps
└─ src/
   ├─ main.ts
   ├─ config.ts             # TILE=32, RES_W=480, RES_H=270, PLAYER_SPEED=120, TUNING
   ├─ lib/                  # inventory helpers, supabase client
   ├─ scenes/
   │  ├─ BootScene.ts       # init, save sync
   │  ├─ PreloadScene.ts    # asset loading + texture generation
   │  ├─ MainMenuScene.ts   # title + continue/new game
   │  ├─ CharacterCreateScene.ts
   │  ├─ TownScene.ts       # hub: all shops, NPCs, gate
   │  ├─ ArmoryScene.ts     # weapon/armor shop interior
   │  ├─ EmporiumScene.ts   # consumables shop interior
   │  ├─ InnScene.ts        # inn interior
   │  ├─ SagesTowerScene.ts # enchant/socket/transmute
   │  ├─ ChapelScene.ts     # bless/buff
   │  ├─ DungeonScene.ts    # generated floors + combat
   │  ├─ FloorTransitionScene.ts
   │  └─ UIScene.ts         # HUD overlay
   ├─ entities/
   │  ├─ Player.ts
   │  ├─ Enemy.ts
   │  ├─ Boss.ts
   │  ├─ Companion.ts
   │  ├─ Interactable.ts
   │  └─ WarpPad.ts
   ├─ systems/
   │  ├─ InputController.ts
   │  ├─ FloorGenerator.ts  # seeded BSP rooms + corridors
   │  ├─ Fov.ts             # Bresenham FOV
   │  └─ SaveManager.ts     # load/write/wipe + account meta
   └─ data/
      ├─ races.ts
      ├─ classes.ts
      ├─ items.ts           # 100 tiered weapons, 30 armor set pieces, accessories, consumables, materials
      ├─ enemies.ts         # 47 enemy defs + elite/champion logic
      ├─ bosses.ts          # 10 boss defs (11 entities for twin fight)
      ├─ anomalies.ts       # 15 anomaly types
      ├─ bounties.ts        # 22 bounty templates + daily picker
      ├─ companions.ts      # companion roster
      └─ movesets.ts        # weapon family attack patterns
```

---

## 6. Data models (TypeScript)

```ts
// src/types/index.ts

export type RaceId = 'human' | 'elf' | 'dwarf' | 'barbarian' | 'beastman';
export type ClassId = 'swordman' | 'archer' | 'tanker' | 'assassin' | 'sage';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface Stats {
  hp: number; mp: number;
  str: number; dex: number; int: number; vit: number; agi: number;
}

export interface Affix { type: 'flat' | 'percent'; stat: string; value: number; }

export interface ItemInstance {
  id: string;              // unique instance ID
  itemId: string;          // references ITEMS catalog
  qty: number;
  rarity?: Rarity;
  affixes?: Affix[];
  isJunk?: boolean;
  durability?: number;
  maxDurability?: number;
  sockets?: string[];      // rune IDs inserted
  maxSockets?: number;
  upgradeLevel?: number;   // 0–5
  branch?: 'sharp' | 'light' | 'none';
}

export interface CompanionSaveData {
  id: string; name: string; role: 'tanker' | 'archer' | 'sage';
  currentHp: number; maxHp: number; potions: number;
  fatigue: number; affinity: number; command: CompanionCommand;
}

export interface MealBuff {
  mealId: string; stat: string; value: number; expiresAt: number;
}

export interface ActiveBounty { id: string; progress: number; completed: boolean; }

export interface CharacterSave {
  version: number;
  name: string; race: RaceId; clazz: ClassId;
  level: number; exp: number;
  stats: Stats;
  currentHp: number; currentMp: number;
  gold: number;
  inventory: ItemInstance[];
  equipped: Record<string, ItemInstance | null>;
  activeWeaponSlot: 0 | 1;
  hasBag: boolean;
  location: 'town' | 'dungeon';
  dungeonFloor: number;
  floorSeed: number;
  lastWarpIndex: number;
  position: { x: number; y: number };
  unspentStatPoints: number;
  unspentSkillPoints: number;
  unlockedSkills: string[];
  companions?: CompanionSaveData[];
  activeMealBuff?: MealBuff;
  bossesSlain?: string[];
  activeBounties?: ActiveBounty[];
  enemiesKilled?: number;
  enemyKillMap?: Record<string, number>;
  createdAt: string;
}

// ── Account-level meta (never wiped on permadeath) ────────────────────────────

export interface RunHistoryEntry {
  runNumber: number; name: string; race: RaceId; clazz: ClassId;
  floorReached: number; bossesSlain: string[];
  causeOfDeath: string; survivedMs: number; goldEarned: number;
  endedAt: string; victory?: boolean;
}

export interface AccountMeta {
  runHistory: RunHistoryEntry[];        // last 50 runs
  hallOfChampions: RunHistoryEntry[];   // victories only
  unlockedCheckpointFloors: number[];   // e.g. [2, 3, 5]
}
```

### Supabase save table (Phase 5 — implemented)
```sql
create table saves (
  ip_address  text not null primary key,
  data        jsonb not null,
  updated_at  timestamptz default now()
);
```

---

## 7. Phase 0 acceptance criteria (historical — completed)

The walk-around prototype was the first milestone:
1. Vite dev server, Phaser canvas at 480×270, integer-scaled, pixel-perfect.
2. Tiled JSON map with floor and walls/collision layer.
3. 8-directional player movement (WASD + arrows), normalised diagonal speed.
4. Arcade collision with walls.
5. Camera follows player, clamped to map bounds.
6. Constants in `src/config.ts`.
7. Strict TypeScript, no `any`, clean build.

---

## 8. Phase roadmap

| Phase | Status | Deliverable |
|---|---|---|
| **P0** | ✅ Complete | Walk-around prototype: Boot→Preload→Play, 40×30 test map, 8-directional player, arcade collision, clamped camera |
| **P1** | ✅ Complete | Main menu + character creation (race→class filtered picker), stats, starting gear, spawn in town |
| **P2** | ✅ Complete | Town hub: Armory, Inn, Emporium, proximity "Press E" interactions, UIScene HUD |
| **P3** | ✅ Complete | `FloorGenerator` (seeded BSP), warp pads, floors 1–10 descent, FOV system, traps |
| **P4** | ✅ Complete | Real-time combat (stamina, dodge, poise, guard), enemy AI + archetypes, loot + rarity system, full inventory + equipment, consumables, skills, weapon families, status effects, camping/meals, companions, bosses (phases + break parts), anomalies, Sage's Tower enchanting |
| **P5** | ✅ Complete | Supabase save (IP-based), `SaveManager.wipe()` on permadeath, debounced autosave, account meta, run history, Hall of Champions, checkpoint floors, daily bounties, Town 2.0 (Guild, Wandering Stall, Guard banter, Chapel) |
| **P6** | 🔄 In progress | Final pixel-art pass (Aseprite atlases), SFX/music, balancing, polish |

---

## 9. Using this with Claude Code

See `CLAUDE.md` in the repo root for the short session-start guide.

The game is **fully playable** without a Supabase project — it gracefully falls back to localStorage.

To connect Supabase:
1. Create a project at supabase.com
2. Run `supabase/migrations/001_saves.sql` in the SQL editor
3. Copy `.env.example` → `.env` and fill in `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
