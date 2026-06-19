# Night Dungeon

[Deployment Link](https://night-dungeon.vercel.app/)

A browser-based dungeon-crawler RPG built with **Phaser 3**, **TypeScript**, and **Vite**.
Create a character, shop in town, then descend through seeded procedural floors fighting
cave monsters, dodging traps, and hunting loot — with permadeath.

> Full design lives in [`DUNGEON_RPG_SPEC.md`](./DUNGEON_RPG_SPEC.md) (source of truth).
> Player-facing reference lives in the [`wiki/`](./wiki) folder.

## Getting started

```bash
npm install
npm run dev      # start Vite dev server with HMR
```

Then open the printed local URL in your browser.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with hot-module reload |
| `npm run build` | Type-check (`tsc`) and bundle to `dist/` |
| `npm run preview` | Serve the production build from `dist/` |

Type-check only: `npx tsc --noEmit`

## Cloud saves (optional)

Saves work out of the box using `localStorage`. To enable cloud saves and auth via
[Supabase](https://supabase.com):

1. Create a Supabase project.
2. Run `supabase/migrations/001_saves.sql` in the SQL editor.
3. Copy `.env.example` → `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Without a `.env`, the game silently falls back to localStorage-only mode.

## Project structure

```
src/
  config.ts        Central constants (TILE, resolution, speeds)
  main.ts          Phaser.Game instantiation + scene list
  scenes/          One file per game screen (Boot, Preload, Town, Dungeon, UI, shops…)
  entities/        Player, Enemy, Trap, WarpPad
  systems/         FloorGenerator (seeded BSP), Fov, InputController, SaveManager
  data/            Static tables: races, classes, items, enemies
  lib/             Inventory + Supabase helpers
  types/           Shared TypeScript interfaces
supabase/          SQL migrations
wiki/              Player-facing reference docs
```

## Tech notes

- **Pixel art**: internal resolution `480×270`, integer-scaled; `antialias: false`, `TILE = 32px`.
- **TypeScript strict**: no `any`; shared types in `src/types/index.ts`.
- **Client-authoritative**: no game server. Floors are deterministic — only the seed and
  floor number are saved, never the full tilemap.
