export type EnemyTheme = 'cave' | 'forest' | 'deadland' | 'pond' | 'rock';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  dmg: number;
  speed: number;
  exp: number;
  dropItem?: string;
  dropChance?: number;
  floorMin: number;
  theme?: EnemyTheme;
}

export const ENEMY_DEFS: EnemyDef[] = [
  // ── Floor 1: Cave / Goblin (HP×3, DMG×2 vs original) ────────────────────────
  { id: 'goblin',        name: 'Goblin',        hp: 165,  dmg: 32,  speed: 68, exp: 9,  dropItem: 'mana_stone_1', dropChance: 0.5, floorMin: 1, theme: 'cave' },
  { id: 'goblin_shaman', name: 'Goblin Shaman',  hp: 126,  dmg: 48,  speed: 52, exp: 16, dropItem: 'mana_stone_1', dropChance: 0.5, floorMin: 1, theme: 'cave' },
  { id: 'bat',           name: 'Cave Bat',       hp: 78,   dmg: 24,  speed: 80, exp: 6,  dropItem: 'mana_stone_1', dropChance: 0.5, floorMin: 1, theme: 'cave' },
  { id: 'spider',        name: 'Rock Spider',    hp: 174,  dmg: 40,  speed: 62, exp: 11, dropItem: 'mana_stone_1', dropChance: 0.5, floorMin: 2, theme: 'cave' },
  { id: 'skeleton',      name: 'Skeleton',       hp: 285,  dmg: 56,  speed: 55, exp: 18, dropItem: 'mana_stone_1', dropChance: 0.5, floorMin: 3, theme: 'cave' },
  { id: 'golem',         name: 'Stone Golem',    hp: 630,  dmg: 76,  speed: 36, exp: 35, dropItem: 'mana_stone_1', dropChance: 0.6, floorMin: 5, theme: 'cave' },
  { id: 'troll',         name: 'Cave Troll',     hp: 435,  dmg: 92,  speed: 56, exp: 44, dropItem: 'mana_stone_1', dropChance: 0.6, floorMin: 7, theme: 'cave' },

  // ── Floor 2: Forest ──────────────────────────────────────────────────────────
  { id: 'treant',        name: 'Treant',         hp: 480,  dmg: 55,  speed: 32, exp: 40, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'forest' },
  { id: 'forest_wisp',   name: 'Forest Wisp',    hp: 200,  dmg: 40,  speed: 88, exp: 28, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'forest' },
  { id: 'vine_snare',    name: 'Vine Snare',     hp: 600,  dmg: 35,  speed: 20, exp: 45, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'forest' },

  // ── Floor 2: Deadland ────────────────────────────────────────────────────────
  { id: 'ghoul',         name: 'Ghoul',          hp: 300,  dmg: 60,  speed: 74, exp: 35, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'deadland' },
  { id: 'wraith',        name: 'Wraith',         hp: 240,  dmg: 55,  speed: 70, exp: 32, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'deadland' },
  { id: 'bone_golem',    name: 'Bone Golem',     hp: 720,  dmg: 65,  speed: 30, exp: 55, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'deadland' },

  // ── Floor 2: Pond ────────────────────────────────────────────────────────────
  { id: 'frog_warrior',  name: 'Frog Warrior',   hp: 360,  dmg: 50,  speed: 76, exp: 38, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'pond' },
  { id: 'swamp_slug',    name: 'Swamp Slug',     hp: 800,  dmg: 30,  speed: 22, exp: 50, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'pond' },
  { id: 'water_serpent', name: 'Water Serpent',  hp: 280,  dmg: 65,  speed: 80, exp: 36, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'pond' },

  // ── Floor 2: Rock ────────────────────────────────────────────────────────────
  { id: 'rock_crab',     name: 'Rock Crab',      hp: 660,  dmg: 45,  speed: 34, exp: 48, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'rock' },
  { id: 'stone_imp',     name: 'Stone Imp',      hp: 210,  dmg: 55,  speed: 78, exp: 30, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'rock' },
  { id: 'cave_drake',    name: 'Cave Drake',     hp: 540,  dmg: 70,  speed: 54, exp: 52, dropItem: 'mana_stone_2', dropChance: 0.5, floorMin: 2, theme: 'rock' },
];

export function goblinDefs(): EnemyDef[] {
  return ENEMY_DEFS.filter(d => d.id.startsWith('goblin'));
}

export function caveDefs(floor: number): EnemyDef[] {
  return ENEMY_DEFS.filter(d => d.theme === 'cave' && !d.id.startsWith('goblin') && d.floorMin <= floor);
}

export function getThemeDefs(theme: EnemyTheme): EnemyDef[] {
  return ENEMY_DEFS.filter(d => d.theme === theme);
}

export function enemiesForFloor(floor: number): EnemyDef[] {
  return ENEMY_DEFS.filter(e => e.floorMin <= floor);
}
