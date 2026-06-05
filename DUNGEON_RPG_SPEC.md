# Dungeon RPG — Design & Scaffold Spec

> A single-player, pixel-art, roguelike dungeon crawler for the web.
> This document is the source of truth for scaffolding with **Claude Code**.
> Build **Phase 0** first (walk around an empty map). Everything else is context so the architecture doesn't paint itself into a corner.

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
| Backend (later) | **Supabase** | Auth + Postgres. Save = one JSONB blob per user. NOT needed for Phase 0. |
| Art tool | Aseprite (authoring) / free packs (Kenney, itch.io) for placeholders | |

> **Do not** build a custom game server, websockets, or anti-cheat. It is single-player and client-authoritative.

---

## 3. Pixel art spec

These constraints keep the whole game visually cohesive. Bake them into the Phaser config and asset pipeline.

- **Base tile size:** `32 x 32 px`
- **Character sprites:** `32 x 40 px` (placed in a `32 x 48` cell with headroom for tall races/hats)
- **Item / UI icons:** `32 x 32` (inventory) and `16 x 16` (hotbar)
- **Internal render resolution:** `480 x 270` (16:9). Integer-scaled to the window (×4 = 1920×1080). Shows ~15 tiles wide × ~8.5 tiles tall.
- **Phaser scale:** `Phaser.Scale.FIT` with `pixelArt: true`, `roundPixels: true`, `antialias: false`, `zoom` via integer scale.
- **Palette:** curated, ~32–48 colors, shared across all art. Starter palette below (extend as needed, but keep it tight for cohesion).

### Starter palette (RGB)
```
outline    28,24,34       skin       232,184,142   skin_shadow  196,146,104
elf_skin   226,208,184    beastman   210,170,128   beard        168,116,72
metal      156,162,178    metal_dk   112,118,134   metal_hi     206,210,226
green      78,138,78      green_dk   54,100,54      red          184,62,56
leather    124,88,56      leather_dk 92,62,40       wood         146,104,62
dark_cloth 58,52,66       gold       214,174,74     fur          150,120,86
eye_white  245,245,245    pupil      44,44,64       amber_glow   240,176,64
```

### Animation conventions
Each character spritesheet has these clips (4-directional where relevant):
- `idle_down / idle_up / idle_side` — 2 frames
- `walk_down / walk_up / walk_side` — 4 frames (side flips horizontally for left/right)
- `attack_down / attack_up / attack_side` — 3 frames
- `hurt` — 1 frame, `die` — 1 frame

Pack into a Phaser texture atlas (JSON + PNG). Naming: `{race}_{class}_{clip}_{frame}`.

---

## 4. Game systems (full design)

### 4.1 Races and classes

Each race may only pick classes that fit it. Humans are the versatile "pick anything" race.

| Race | Stat modifiers | Allowed classes |
|---|---|---|
| **Human** | +1 to all (versatile) | Swordman, Archer, Tanker, Assassin, Sage |
| **Elf** | +DEX +INT, −VIT | Swordman, Archer, Assassin, Sage |
| **Dwarf** | +VIT +STR, −AGI | Swordman, Tanker, Sage |
| **Barbarian** | +STR +maxHP, −INT | Swordman, Archer, Tanker |
| **Beastman** | +AGI +DEX, −INT | Swordman, Archer, Tanker, Assassin |

**Classes** (role + starting equipment):

| Class | Role | Starting equipment |
|---|---|---|
| **Swordman** | Balanced melee | Short Sword, Leather Armor, 3× Health Potion |
| **Archer** | Ranged DPS (DEX) | Short Bow, 20× Arrow, Leather Armor, 3× Health Potion |
| **Tanker** | Defense / aggro | Mace, Round Shield, Chainmail, 5× Health Potion |
| **Assassin** | Burst / crit (AGI) | Twin Daggers, Light Leather, 3× Health Potion, 2× Smoke Bomb |
| **Sage** | Magic / support (INT) | Staff, Robe, 3× Mana Potion, Fireball Tome |

### 4.2 Stats
Core block per character: `HP, MP, STR, DEX, INT, VIT, AGI`.
- HP from VIT, MP from INT, physical dmg from STR/DEX, magic dmg from INT, crit/dodge from AGI.
- Base stats per class + race modifiers, applied at creation. Level-ups grant points (deferred to combat phase).

### 4.3 Character creation flow
`New Game → choose Race → choose Class (filtered to that race) → confirm` → create save → spawn in **Town** at the **Dungeon Gate** with starting gear and full HP/MP.

### 4.4 Permadeath save model
- **One character per account.** Fixed save slot `0`.
- On death: show death screen → **delete** the save record → return to character creation.
- The save is a single JSON blob (see §6). No mid-floor checkpoints; the Inn is the only "rest" (full heal). Town is always safe.
- (Optional later: append a row to a `run_history` table for a graveyard/stats screen.)

### 4.5 Town (hub)
The overworld safe zone. Contains:
- **Dungeon Gate** — entrance to floor 1; player spawns here on new game.
- **Weapon & Armor Shop** — buy/sell gear.
- **Item Shop** — potions, consumables.
- **Inn** — pay to rest → full HP/MP restore (acts as the soft "checkpoint"; does not prevent permadeath).

Interactions are proximity + key prompt ("Press E"). Each is an interactable entity, not a separate scene (keep it simple: open a UI panel overlay).

### 4.6 Dungeon floors (the "25 km²" question)
**25 km² is the in-world lore scale, not a literal tile count.** Do not author or render a 5000×5000 tile grid. Instead:

- Each floor is a **procedurally generated** tilemap of connected rooms (small to large) plus corridors, built from a **seeded RNG**. Store only the seed + floor number in the save; regenerate deterministically on load.
- Suggested generator: **BSP partition** or **room-graph + corridor carving**. Target floor size ~`192 x 192` to `384 x 384` tiles (big, but bounded).
- **Render only what's near the camera.** Phaser tilemap layers cull off-screen tiles automatically; keep collision to the active region.
- **Warp pads:** place `2–4` pads per floor in random rooms. Stepping on one transitions to floor `N+1` (regenerated from a new seed). Floor 10's pad leads to the final room / boss (deferred).
- Difficulty (enemy density, loot tier) scales with floor number.

### 4.7 Combat / inventory
Deferred past Phase 0. Plan for: real-time arcade combat (melee swing arcs, projectiles for Archer/Sage), enemy AI (chase + attack), inventory grid, equipment slots, consumables. Design later — just don't block it architecturally.

---

## 5. Project structure

```
dungeon-rpg/
├─ index.html
├─ package.json
├─ tsconfig.json            # strict: true
├─ vite.config.ts
├─ CLAUDE.md                # short repo guide for Claude Code (see §8)
├─ public/
│  └─ assets/
│     ├─ tiles/             # tileset PNGs
│     ├─ sprites/           # character / enemy atlases (PNG + JSON)
│     ├─ items/             # item icons
│     └─ maps/              # Tiled JSON (for the Phase 0 test map)
└─ src/
   ├─ main.ts               # Phaser.Game config + scene registration
   ├─ config.ts             # constants: TILE=32, RES_W=480, RES_H=270, etc.
   ├─ scenes/
   │  ├─ BootScene.ts       # set scale mode, load nothing heavy
   │  ├─ PreloadScene.ts    # load atlases/tilesets, show a loading bar
   │  ├─ PlayScene.ts       # Phase 0: tilemap + player + camera (the walk-around demo)
   │  ├─ MainMenuScene.ts   # (P1) title + New Game
   │  ├─ CharacterCreateScene.ts  # (P1) race/class picker
   │  ├─ TownScene.ts       # (P2) hub: shops, inn, gate
   │  ├─ DungeonScene.ts    # (P3) generated floors + warp pads
   │  └─ UIScene.ts         # (P2) HUD overlay, runs in parallel
   ├─ entities/
   │  ├─ Player.ts          # sprite + movement + animation state machine
   │  ├─ Interactable.ts    # base for shop/inn/gate/warp-pad
   │  └─ WarpPad.ts
   ├─ systems/
   │  ├─ InputController.ts # WASD + arrows, abstracted
   │  ├─ FloorGenerator.ts  # (P3) seeded room/corridor generation
   │  └─ SaveManager.ts     # (P5) load/save; stub returns local data for now
   ├─ data/
   │  ├─ races.ts           # race table from §4.1
   │  ├─ classes.ts         # class table + starting equipment from §4.1
   │  └─ items.ts
   └─ types/
      └─ index.ts           # shared TS interfaces (see §6)
```

---

## 6. Data models (TypeScript)

```ts
// src/types/index.ts
export type RaceId = 'human' | 'elf' | 'dwarf' | 'barbarian' | 'beastman';
export type ClassId = 'swordman' | 'archer' | 'tanker' | 'assassin' | 'sage';

export interface Stats {
  hp: number; mp: number;
  str: number; dex: number; int: number; vit: number; agi: number;
}

export interface Race {
  id: RaceId;
  name: string;
  modifiers: Partial<Stats>;
  allowedClasses: ClassId[];
}

export interface CharClass {
  id: ClassId;
  name: string;
  baseStats: Stats;
  startingEquipment: string[]; // item ids
}

export interface ItemStack { itemId: string; qty: number; }

export interface CharacterSave {
  version: number;            // save-format version, start at 1
  name: string;
  race: RaceId;
  clazz: ClassId;
  level: number;
  stats: Stats;
  currentHp: number;
  currentMp: number;
  gold: number;
  inventory: ItemStack[];
  equipped: Record<string, string | null>; // slot -> itemId
  location: 'town' | 'dungeon';
  dungeonFloor: number;       // 1..10, 0 if in town
  floorSeed: number;          // for deterministic regeneration
  position: { x: number; y: number };
  createdAt: string;
}
```

### Supabase save table (Phase 5)
```sql
create table saves (
  user_id    uuid references auth.users not null,
  slot       int  not null default 0,        -- always 0 (one char per account)
  data       jsonb not null,                 -- the CharacterSave blob
  updated_at timestamptz default now(),
  primary key (user_id, slot)
);
-- Enable Row Level Security so a user can only read/write their own save.
```

Save strategy: serialize `CharacterSave` to JSON, write on meaningful events (enter/exit floor, town transactions) with a ~2s debounce. On death, `delete` the row.

---

## 7. PHASE 0 — build this first (acceptance criteria)

> Goal: an empty game you can walk around in. Placeholder art is fine.

Implement **only** `BootScene → PreloadScene → PlayScene`.

**Must-haves:**
1. `npm run dev` starts Vite; the Phaser canvas renders at internal `480 x 270`, integer-scaled and centered, **pixel-perfect (no blur)**.
2. A tilemap loads from a Tiled JSON in `public/assets/maps/` — a single bounded test area with a floor layer and a walls/collision layer. (A simple hand-made room ~40×30 tiles is enough; full generation comes in P3.)
3. A **player** sprite spawns and moves with **WASD + arrow keys** (8-directional movement, normalized diagonal speed). Walk/idle animations play and face the movement direction.
4. **Collision** with the walls layer (arcade physics).
5. **Camera follows** the player and is clamped to the map bounds (`camera.setBounds`).
6. Constants centralized in `src/config.ts` (`TILE=32`, `RES_W=480`, `RES_H=270`, `PLAYER_SPEED`).
7. Strict TypeScript, no `any`, builds clean with `npm run build`.

**Phaser config seed (`src/main.ts`):**
```ts
import Phaser from 'phaser';
import { RES_W, RES_H } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { PlayScene } from './scenes/PlayScene';

new Phaser.Game({
  type: Phaser.AUTO,
  width: RES_W,
  height: RES_H,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, PreloadScene, PlayScene],
});
```

**Not in Phase 0:** combat, enemies, inventory UI, character creation, town, save/auth, floor generation. Stub `SaveManager` to return an in-memory default character.

---

## 8. Roadmap (after Phase 0)

| Phase | Deliverable |
|---|---|
| **P0** | Walk-around prototype (this scaffold). |
| **P1** | Main menu + character creation (race→class filtered picker) → spawn with stats & starting gear. |
| **P2** | Town hub scene: dungeon gate, weapon/armor shop, item shop, inn; proximity "Press E" interactions + UI panels; HUD (UIScene). |
| **P3** | `FloorGenerator` (seeded rooms + corridors), warp pads, floor 1→10 descent, camera/collision on generated maps. |
| **P4** | Combat (melee arcs, projectiles), enemy AI, loot, inventory + equipment, consumables. |
| **P5** | Supabase auth + `SaveManager` real implementation; permadeath wipe; debounced autosave. |
| **P6** | Final pixel-art pass (Aseprite atlases), SFX/music, balancing, polish. |

---

## 9. Using this with Claude Code

Suggested `CLAUDE.md` to drop in the repo root:

```md
# Project: Dungeon RPG (Phaser 3 + TS + Vite)
- Read DUNGEON_RPG_SPEC.md for full design. Build phases in order.
- We are currently on: PHASE 0.
- All in-game text is English. Keep TypeScript strict (no `any`).
- Pixel art only: TILE=32, internal res 480x270, pixelArt+roundPixels on.
- Single-player, client-authoritative. No game server. Backend (Supabase) is Phase 5 only.
- Prefer small, composable modules. One Phaser Scene per game screen.
```

**First prompt to Claude Code:**
> "Read DUNGEON_RPG_SPEC.md. Scaffold the Vite + TypeScript + Phaser 3 project per §5, then implement PHASE 0 (§7) end to end: Boot/Preload/Play scenes, a 40×30 Tiled test map with a wall collision layer, an 8-directional player with idle/walk animations, arcade collision, and a clamped follow-camera. Use simple placeholder art (colored rects or a basic sprite) so I can run `npm run dev` and walk around. Stop after Phase 0 and let me verify."

After verifying P0 runs, advance one phase at a time and update the "currently on" line in `CLAUDE.md`.
