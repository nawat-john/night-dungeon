export type RaceId = 'human' | 'elf' | 'dwarf' | 'barbarian' | 'beastman';
export type ClassId = 'swordman' | 'archer' | 'tanker' | 'assassin' | 'sage';

export interface Stats {
  hp: number;
  mp: number;
  str: number;
  dex: number;
  int: number;
  vit: number;
  agi: number;
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
  startingEquipment: string[];
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface Affix {
  type: 'flat' | 'percent';
  stat: string;
  value: number;
}

export interface ItemInstance {
  id: string; // unique ID for gear, or itemId for stackables
  itemId: string;
  qty: number;
  rarity?: Rarity;
  affixes?: Affix[];
  isJunk?: boolean;
  durability?: number;
  maxDurability?: number;
  sockets?: string[];
  maxSockets?: number;
  upgradeLevel?: number;
  branch?: 'sharp' | 'light' | 'none';
}

export interface CharacterSave {
  version: number;
  name: string;
  race: RaceId;
  clazz: ClassId;
  level: number;
  exp: number;
  stats: Stats;
  currentHp: number;
  currentMp: number;
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
  curseActive?: boolean;
  masochist?: boolean;
  createdAt: string;
}
