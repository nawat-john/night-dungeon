/** §E8.4 — Mid-run Specialization picks (locked at Floor 4 boss clear). */

export interface SpecializationDef {
  id: string;
  name: string;
  desc: string;
  /** Effect key used in Player.ts and DungeonScene to apply passive. */
  effect: string;
}

/** Slayer: a second sub-body-type is stored as specialization = 'slayer:flesh' etc. */
export const SPECIALIZATIONS: SpecializationDef[] = [
  {
    id: 'slayer',
    name: 'Slayer',
    desc: '+20% damage vs a chosen body type (pick on select). Mastery of hunting specific prey.',
    effect: 'slayer_dmg',
  },
  {
    id: 'elementalist',
    name: 'Elementalist',
    desc: '+25% all elemental ATK, −10% raw physical damage. You are the matchup.',
    effect: 'elem_boost',
  },
  {
    id: 'berserker',
    name: 'Berserker',
    desc: '+15% damage when below 50% HP, +3% lifesteal. Pain is power.',
    effect: 'berserk',
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    desc: '+20% block mitigation, +50ms perfect-guard window. The immovable wall.',
    effect: 'sentinel_guard',
  },
  {
    id: 'trapper',
    name: 'Trapper',
    desc: 'Throwables deal +40% damage, trap deploy time halved. Control the battlefield.',
    effect: 'trapper_boost',
  },
];

export function getSpecialization(id: string): SpecializationDef | undefined {
  const baseId = id.includes(':') ? id.split(':')[0] : id;
  return SPECIALIZATIONS.find(s => s.id === baseId);
}

/** For Slayer: extract the chosen body type from the saved string (e.g. 'slayer:bone'). */
export function getSlayerBodyType(specializationStr: string): string | null {
  if (!specializationStr.startsWith('slayer:')) return null;
  return specializationStr.split(':')[1] ?? null;
}
