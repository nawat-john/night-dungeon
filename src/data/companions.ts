export type CompanionRole    = 'tanker' | 'archer' | 'sage';
export type CompanionCommand = 'follow' | 'aggressive' | 'defensive' | 'hold' | 'focus' | 'regroup';

export const COMPANION_COMMANDS: CompanionCommand[] = [
  'follow', 'aggressive', 'defensive', 'hold', 'focus', 'regroup',
];

export interface CompanionDef {
  id: string;
  name: string;
  role: CompanionRole;
  hireCost: number;
  hp: number;
  dmg: number;
  speed: number;
  attackRange: number;
  detectRange: number;
  healThreshold: number; // HP fraction below which companion self-heals
  bodyColor: number;
  eyeColor: number;
}

export const COMPANION_DEFS: CompanionDef[] = [
  {
    id: 'brom', name: 'Brom the Shield', role: 'tanker',
    hireCost: 400, hp: 350, dmg: 28, speed: 68,
    attackRange: 50, detectRange: 180, healThreshold: 0.35,
    bodyColor: 0x3355aa, eyeColor: 0xffffff,
  },
  {
    id: 'lyra', name: 'Lyra the Swift', role: 'archer',
    hireCost: 350, hp: 180, dmg: 42, speed: 105,
    attackRange: 180, detectRange: 260, healThreshold: 0.30,
    bodyColor: 0x338833, eyeColor: 0xffff00,
  },
  {
    id: 'mira', name: 'Mira the Learned', role: 'sage',
    hireCost: 500, hp: 150, dmg: 32, speed: 88,
    attackRange: 130, detectRange: 220, healThreshold: 0.45,
    bodyColor: 0x882288, eyeColor: 0x00ffff,
  },
  {
    id: 'old_friend', name: 'Old Friend', role: 'sage',
    hireCost: 9999, hp: 220, dmg: 48, speed: 92,
    attackRange: 140, detectRange: 240, healThreshold: 0.40,
    bodyColor: 0xddaa44, eyeColor: 0xff44ff,
  },
];

export function defById(id: string): CompanionDef | undefined {
  return COMPANION_DEFS.find(d => d.id === id);
}
