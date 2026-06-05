import { Race } from '../types';

export const RACES: Race[] = [
  {
    id: 'human',
    name: 'Human',
    modifiers: { str: 1, dex: 1, int: 1, vit: 1, agi: 1 },
    allowedClasses: ['swordman', 'archer', 'tanker', 'assassin', 'sage'],
  },
  {
    id: 'elf',
    name: 'Elf',
    modifiers: { dex: 2, int: 2, vit: -1 },
    allowedClasses: ['swordman', 'archer', 'assassin', 'sage'],
  },
  {
    id: 'dwarf',
    name: 'Dwarf',
    modifiers: { vit: 2, str: 2, agi: -2 },
    allowedClasses: ['swordman', 'tanker', 'sage'],
  },
  {
    id: 'barbarian',
    name: 'Barbarian',
    modifiers: { str: 2, hp: 30, int: -2 },
    allowedClasses: ['swordman', 'archer', 'tanker'],
  },
  {
    id: 'beastman',
    name: 'Beastman',
    modifiers: { agi: 2, dex: 2, int: -2 },
    allowedClasses: ['swordman', 'archer', 'tanker', 'assassin'],
  },
];
