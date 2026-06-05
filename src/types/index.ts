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

export interface ItemStack {
  itemId: string;
  qty: number;
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
  inventory: ItemStack[];
  equipped: Record<string, string | null>;
  activeWeaponSlot: 0 | 1;
  hasBag: boolean;
  location: 'town' | 'dungeon';
  dungeonFloor: number;
  floorSeed: number;
  lastWarpIndex: number;
  position: { x: number; y: number };
  createdAt: string;
}
