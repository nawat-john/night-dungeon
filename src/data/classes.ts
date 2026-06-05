import { CharClass } from '../types';

export const CLASSES: CharClass[] = [
  {
    id: 'swordman',
    name: 'Swordman',
    baseStats: { hp: 120, mp: 30, str: 10, dex: 8, int: 4, vit: 10, agi: 7 },
    startingEquipment: ['short_sword', 'leather_armor', 'health_potion', 'health_potion', 'health_potion'],
  },
  {
    id: 'archer',
    name: 'Archer',
    baseStats: { hp: 100, mp: 30, str: 7, dex: 12, int: 5, vit: 8, agi: 10 },
    startingEquipment: ['short_bow', 'arrow', 'leather_armor', 'health_potion', 'health_potion', 'health_potion'],
  },
  {
    id: 'tanker',
    name: 'Tanker',
    baseStats: { hp: 160, mp: 20, str: 10, dex: 5, int: 3, vit: 14, agi: 5 },
    startingEquipment: ['mace', 'round_shield', 'chainmail', 'health_potion', 'health_potion', 'health_potion', 'health_potion', 'health_potion'],
  },
  {
    id: 'assassin',
    name: 'Assassin',
    baseStats: { hp: 90, mp: 30, str: 7, dex: 12, int: 5, vit: 7, agi: 14 },
    startingEquipment: ['twin_daggers', 'light_leather', 'health_potion', 'health_potion', 'health_potion', 'smoke_bomb', 'smoke_bomb'],
  },
  {
    id: 'sage',
    name: 'Sage',
    baseStats: { hp: 80, mp: 100, str: 4, dex: 6, int: 14, vit: 6, agi: 7 },
    startingEquipment: ['staff', 'robe', 'mana_potion', 'mana_potion', 'mana_potion', 'fireball_tome'],
  },
];
