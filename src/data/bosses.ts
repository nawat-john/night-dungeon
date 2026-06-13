import type { BodyType, ElemFamily, Hitzone } from '../types';

export type BossAttackId =
  | 'melee' | 'heavy' | 'charge' | 'aoe_zone'
  | 'projectile' | 'multi_proj' | 'summon' | 'grab' | 'phase_slam';

export interface BossBreakPart {
  id: string;
  name: string;
  /** Cumulative damage dealt to the boss at which this part breaks */
  hp: number;
  dropItemId: string;
  disablesAttack?: BossAttackId;
  /** If set, breaking this part skips (suppresses) the phase at this index. */
  breakSkipsPhase?: number;
}

export interface BossPhase {
  /** Enter this phase when boss HP% drops below this value (ignored for phases[0]) */
  hpPct: number;
  attackPool: BossAttackId[];
  speedMult?: number;
  arenaEvent?: string;
  /** Override elemFamily for this phase (used by resolveHit and HUD weakness reveal). */
  phaseElemFamily?: ElemFamily;
  /** Override body type for this phase (used by PHYS_CHART). */
  phaseBody?: BodyType;
}

export interface BossDef {
  id: string;
  name: string;
  floor: number;
  hp: number;
  speed: number;
  dmg: number;
  exp: number;
  dropItemId: string;
  phases: BossPhase[];
  breakParts: BossBreakPart[];
  enrage?: { atHpPct: number; speedMult: number; dmgMult: number };
  isTwinA?: boolean;
  // §E15 affinity tagging
  body?: BodyType;
  elemFamily?: ElemFamily;
  hitzones?: Hitzone[];
  /** Riftmaw: cycle void/neutral every N ms (Boss.ts handles the timer). */
  voidCycleMs?: number;
}

export const BOSS_DEFS: BossDef[] = [
  // ── Floor 1: Goblin Warlord ───────────────────────────────────────────────
  {
    id: 'goblin_warlord', name: 'Goblin Warlord', floor: 1,
    hp: 1500, speed: 52, dmg: 55, exp: 450,
    dropItemId: 'goblin_tooth',
    body: 'flesh', elemFamily: 'beast',
    hitzones: [
      { id: 'head',   rawMod: 1.3, elemMod: 1.4, breakable: true,  breakHp: 1050 },
      { id: 'body',   rawMod: 0.9, elemMod: 1.0 },
      { id: 'weapon', rawMod: 1.0, elemMod: 0.8, breakable: true,  breakHp: 600,  disablesAttack: 'heavy' },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['melee', 'heavy', 'charge'] },
      { hpPct: 0.5, attackPool: ['melee', 'heavy', 'charge', 'charge', 'summon'] },
    ],
    breakParts: [
      { id: 'club_arm',     name: 'Club Arm',  hp: 600,  dropItemId: 'goblin_tooth',  disablesAttack: 'heavy' },
      { id: 'warlord_helm', name: 'War Helm',  hp: 1050, dropItemId: 'mana_stone_1' },
    ],
    enrage: { atHpPct: 0.2, speedMult: 1.5, dmgMult: 1.3 },
  },

  // ── Floor 2: The Drowned King ─────────────────────────────────────────────
  {
    id: 'drowned_king', name: 'The Drowned King', floor: 2,
    hp: 2800, speed: 44, dmg: 75, exp: 900,
    dropItemId: 'drowned_pearl',
    body: 'armored', elemFamily: 'aquatic',
    hitzones: [
      { id: 'crown',   rawMod: 1.2, elemMod: 1.5, breakable: true, breakHp: 840  },
      { id: 'armor',   rawMod: 0.6, elemMod: 0.8 },
      { id: 'trident', rawMod: 1.0, elemMod: 1.0, breakable: true, breakHp: 1680, disablesAttack: 'multi_proj' },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['melee', 'charge', 'aoe_zone'] },
      { hpPct: 0.5, attackPool: ['melee', 'charge', 'aoe_zone', 'grab', 'multi_proj'] },
    ],
    breakParts: [
      { id: 'drowned_crown',   name: 'Crown',   hp: 840,  dropItemId: 'drowned_pearl' },
      { id: 'drowned_trident', name: 'Trident', hp: 1680, dropItemId: 'mana_stone_2', disablesAttack: 'multi_proj' },
    ],
    enrage: { atHpPct: 0.2, speedMult: 1.4, dmgMult: 1.35 },
  },

  // ── Floor 3: Brood Matron ─────────────────────────────────────────────────
  {
    id: 'brood_matron', name: 'Brood Matron', floor: 3,
    hp: 3500, speed: 38, dmg: 90, exp: 1400,
    dropItemId: 'brood_venom',
    body: 'chitin', elemFamily: 'insect',
    hitzones: [
      { id: 'head',    rawMod: 1.2, elemMod: 1.3, breakable: true,  breakHp: 2100, disablesAttack: 'summon' },
      { id: 'abdomen', rawMod: 0.7, elemMod: 0.9, breakable: true,  breakHp: 1050, disablesAttack: 'grab' },
      { id: 'legs',    rawMod: 1.1, elemMod: 1.0 },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['aoe_zone', 'projectile', 'charge'] },
      { hpPct: 0.5, attackPool: ['aoe_zone', 'summon', 'projectile', 'grab', 'charge'] },
    ],
    breakParts: [
      { id: 'brood_fangs',   name: 'Fangs',   hp: 1050, dropItemId: 'brood_venom',  disablesAttack: 'grab' },
      { id: 'brood_abdomen', name: 'Abdomen', hp: 2100, dropItemId: 'mana_stone_2', disablesAttack: 'summon' },
    ],
    enrage: { atHpPct: 0.2, speedMult: 1.45, dmgMult: 1.4 },
  },

  // ── Floor 4: Sir Mordrek, Fallen Captain ─────────────────────────────────
  {
    id: 'sir_mordrek', name: 'Sir Mordrek', floor: 4,
    hp: 4200, speed: 56, dmg: 105, exp: 2000,
    dropItemId: 'captain_badge',
    body: 'armored', elemFamily: 'undead',
    hitzones: [
      { id: 'helm',   rawMod: 0.7, elemMod: 1.2, breakable: true, breakHp: 2940 },
      { id: 'chest',  rawMod: 0.5, elemMod: 1.0 },
      { id: 'shield', rawMod: 0.4, elemMod: 0.7, breakable: true, breakHp: 1260, disablesAttack: 'heavy' },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['melee', 'heavy', 'charge'] },
      { hpPct: 0.5, attackPool: ['melee', 'heavy', 'charge', 'multi_proj', 'grab'] },
    ],
    breakParts: [
      { id: 'mordrek_shield', name: 'Shield', hp: 1260, dropItemId: 'captain_badge', disablesAttack: 'heavy' },
      { id: 'mordrek_helm',   name: 'Helm',   hp: 2940, dropItemId: 'mana_stone_3' },
    ],
    enrage: { atHpPct: 0.2, speedMult: 1.5, dmgMult: 1.35 },
  },

  // ── Floor 5: Forgefather Brand ────────────────────────────────────────────
  {
    id: 'forgefather_brand', name: 'Forgefather Brand', floor: 5,
    hp: 5500, speed: 34, dmg: 125, exp: 2800,
    dropItemId: 'brand_ember',
    body: 'construct', elemFamily: 'fire',
    hitzones: [
      { id: 'core', rawMod: 1.4, elemMod: 1.5, breakable: true, breakHp: 1650, disablesAttack: 'aoe_zone' },
      { id: 'arms', rawMod: 0.8, elemMod: 0.9, breakable: true, breakHp: 3300, disablesAttack: 'multi_proj' },
      { id: 'body', rawMod: 0.7, elemMod: 0.8 },
    ],
    phases: [
      {
        hpPct: 1.0, attackPool: ['aoe_zone', 'multi_proj', 'charge'],
        phaseElemFamily: 'fire', phaseBody: 'construct',
      },
      {
        // §E10.1 — Obsidian Phase: fire-immune, weak Blunt; body becomes armored
        hpPct: 0.4, attackPool: ['aoe_zone', 'multi_proj', 'charge', 'summon', 'heavy'],
        arenaEvent: 'forge_ignite',
        phaseElemFamily: 'construct', phaseBody: 'armored',
      },
    ],
    breakParts: [
      { id: 'brand_core', name: 'Core',  hp: 1650, dropItemId: 'brand_ember', disablesAttack: 'aoe_zone' },
      { id: 'brand_arms', name: 'Arms',  hp: 3300, dropItemId: 'mana_stone_3', disablesAttack: 'multi_proj' },
    ],
    enrage: { atHpPct: 0.2, speedMult: 1.4, dmgMult: 1.45 },
  },

  // ── Floor 6: Frost Warden Ysold ──────────────────────────────────────────
  {
    id: 'frost_warden_ysold', name: 'Frost Warden Ysold', floor: 6,
    hp: 7000, speed: 46, dmg: 145, exp: 3800,
    dropItemId: 'frost_crystal',
    body: 'flesh', elemFamily: 'ice',
    hitzones: [
      { id: 'antlers',   rawMod: 1.1, elemMod: 1.4, breakable: true, breakHp: 2100, disablesAttack: 'multi_proj' },
      { id: 'ice_heart', rawMod: 1.5, elemMod: 1.6, breakable: true, breakHp: 4200, disablesAttack: 'grab' },
      { id: 'body',      rawMod: 0.9, elemMod: 1.0 },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['aoe_zone', 'multi_proj', 'charge'], phaseElemFamily: 'ice' },
      {
        // §E10.2 — Blizzard phase; skipped if Ice Heart is broken before this triggers
        hpPct: 0.45, attackPool: ['aoe_zone', 'multi_proj', 'charge', 'grab', 'summon'],
        arenaEvent: 'frost_blizzard', phaseElemFamily: 'ice',
      },
    ],
    breakParts: [
      { id: 'frost_antlers', name: 'Antlers',  hp: 2100, dropItemId: 'frost_crystal', disablesAttack: 'multi_proj' },
      {
        id: 'frost_heart', name: 'Ice Heart', hp: 4200, dropItemId: 'mana_stone_4',
        disablesAttack: 'grab',
        // Breaking Ice Heart skips the blizzard phase (index 1)
        breakSkipsPhase: 1,
      },
    ],
    enrage: { atHpPct: 0.2, speedMult: 1.45, dmgMult: 1.4 },
  },

  // ── Floor 7: The Hollow Choir ─────────────────────────────────────────────
  {
    id: 'hollow_choir', name: 'The Hollow Choir', floor: 7,
    hp: 8500, speed: 58, dmg: 140, exp: 4800,
    dropItemId: 'choir_soul',
    body: 'ethereal', elemFamily: 'spectral',
    hitzones: [
      { id: 'mask_1', rawMod: 0.6, elemMod: 1.3, breakable: true, breakHp: 2550 },
      { id: 'mask_2', rawMod: 0.6, elemMod: 1.3, breakable: true, breakHp: 5950, disablesAttack: 'summon' },
      { id: 'core',   rawMod: 0.4, elemMod: 1.5 },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['aoe_zone', 'charge', 'melee'] },
      { hpPct: 0.5, attackPool: ['aoe_zone', 'summon', 'charge', 'heavy', 'multi_proj'], arenaEvent: 'choir_merge' },
    ],
    breakParts: [
      { id: 'choir_mask_1', name: 'First Mask',  hp: 2550, dropItemId: 'choir_soul' },
      { id: 'choir_mask_2', name: 'Second Mask', hp: 5950, dropItemId: 'mana_stone_4', disablesAttack: 'summon' },
    ],
    enrage: { atHpPct: 0.2, speedMult: 1.5, dmgMult: 1.45 },
  },

  // ── Floor 8: Riftmaw ──────────────────────────────────────────────────────
  {
    id: 'riftmaw', name: 'Riftmaw', floor: 8,
    hp: 10000, speed: 52, dmg: 160, exp: 6000,
    dropItemId: 'riftmaw_eye',
    body: 'flesh', elemFamily: 'void',
    // §E10.1 — Riftmaw cycles void/neutral every 8 seconds
    voidCycleMs: 8000,
    hitzones: [
      { id: 'eye_l', rawMod: 1.4, elemMod: 1.4, breakable: true, breakHp: 3000,  disablesAttack: 'grab' },
      { id: 'maw',   rawMod: 1.2, elemMod: 1.2, breakable: true, breakHp: 6500,  disablesAttack: 'summon' },
      { id: 'body',  rawMod: 0.9, elemMod: 1.0 },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['charge', 'aoe_zone', 'grab'] },
      { hpPct: 0.4, attackPool: ['charge', 'aoe_zone', 'grab', 'multi_proj', 'summon'], arenaEvent: 'rift_tear' },
    ],
    breakParts: [
      { id: 'riftmaw_eye_l', name: 'Left Eye', hp: 3000,  dropItemId: 'riftmaw_eye', disablesAttack: 'grab' },
      { id: 'riftmaw_maw',   name: 'Maw',      hp: 6500,  dropItemId: 'mana_stone_4', disablesAttack: 'summon' },
    ],
    enrage: { atHpPct: 0.2, speedMult: 1.45, dmgMult: 1.5 },
  },

  // ── Floor 9: The Ascendant Twins — Twin A (Aeriel) ────────────────────────
  {
    id: 'twin_aeriel', name: 'Aeriel, the Ascendant', floor: 9,
    hp: 6500, speed: 70, dmg: 170, exp: 4000,
    dropItemId: 'twin_crest',
    isTwinA: true,
    body: 'flesh', elemFamily: 'void',
    hitzones: [
      { id: 'head',      rawMod: 1.3, elemMod: 1.3, breakable: true, breakHp: 1950, disablesAttack: 'heavy' },
      { id: 'body',      rawMod: 1.0, elemMod: 1.0 },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['melee', 'charge', 'multi_proj'] },
      { hpPct: 0.3, attackPool: ['melee', 'charge', 'multi_proj', 'grab', 'heavy'] },
    ],
    breakParts: [
      { id: 'aeriel_arm', name: 'Weapon Arm', hp: 1950, dropItemId: 'twin_crest', disablesAttack: 'heavy' },
    ],
    enrage: { atHpPct: 0.15, speedMult: 1.6, dmgMult: 1.5 },
  },

  // ── Floor 9: The Ascendant Twins — Twin B (Mordael) ──────────────────────
  {
    id: 'twin_mordael', name: 'Mordael, the Ascendant', floor: 9,
    hp: 6500, speed: 56, dmg: 175, exp: 4000,
    dropItemId: 'twin_crest',
    body: 'armored', elemFamily: 'void',
    hitzones: [
      { id: 'head',   rawMod: 1.2, elemMod: 1.3, breakable: true, breakHp: 1950, disablesAttack: 'aoe_zone' },
      { id: 'armor',  rawMod: 0.6, elemMod: 0.9 },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['heavy', 'aoe_zone', 'charge'] },
      { hpPct: 0.3, attackPool: ['heavy', 'aoe_zone', 'charge', 'summon', 'grab'] },
    ],
    breakParts: [
      { id: 'mordael_arm', name: 'Weapon Arm', hp: 1950, dropItemId: 'twin_crest', disablesAttack: 'aoe_zone' },
    ],
    enrage: { atHpPct: 0.15, speedMult: 1.5, dmgMult: 1.55 },
  },

  // ── Floor 10: The Sovereign / Dungeon Heart ───────────────────────────────
  {
    id: 'the_sovereign', name: 'The Sovereign', floor: 10,
    hp: 15000, speed: 52, dmg: 200, exp: 15000,
    dropItemId: 'sovereign_heart',
    body: 'construct', elemFamily: 'void',
    hitzones: [
      { id: 'left_arm',  rawMod: 0.9, elemMod: 1.0, breakable: true, breakHp: 3000,  disablesAttack: 'heavy' },
      { id: 'right_arm', rawMod: 0.9, elemMod: 1.0, breakable: true, breakHp: 5500,  disablesAttack: 'multi_proj' },
      { id: 'core',      rawMod: 1.5, elemMod: 1.5, breakable: true, breakHp: 9000,  disablesAttack: 'phase_slam' },
      { id: 'crown',     rawMod: 1.2, elemMod: 1.2, breakable: true, breakHp: 12000 },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['heavy', 'aoe_zone', 'charge'] },
      { hpPct: 0.7, attackPool: ['heavy', 'aoe_zone', 'charge', 'multi_proj', 'summon'], speedMult: 1.15, arenaEvent: 'sov_phase2' },
      { hpPct: 0.4, attackPool: ['heavy', 'aoe_zone', 'charge', 'multi_proj', 'summon', 'phase_slam', 'grab'], speedMult: 1.3, arenaEvent: 'sov_phase3' },
    ],
    breakParts: [
      { id: 'sov_left_arm',  name: 'Left Arm',  hp: 3000,  dropItemId: 'sovereign_heart', disablesAttack: 'heavy' },
      { id: 'sov_right_arm', name: 'Right Arm', hp: 5500,  dropItemId: 'sovereign_heart', disablesAttack: 'multi_proj' },
      { id: 'sov_core',      name: 'Core',      hp: 9000,  dropItemId: 'sovereign_heart', disablesAttack: 'phase_slam' },
      { id: 'sov_crown',     name: 'Crown',     hp: 12000, dropItemId: 'mana_stone_4' },
    ],
  },

  // ── Floor 11: True Dungeon Heart ──────────────────────────────────────────
  {
    id: 'dungeon_heart', name: 'True Dungeon Heart', floor: 11,
    hp: 20000, speed: 60, dmg: 250, exp: 25000,
    dropItemId: 'sovereign_heart',
    body: 'construct', elemFamily: 'void',
    hitzones: [
      { id: 'shell', rawMod: 0.7, elemMod: 0.9, breakable: true, breakHp: 10000 },
      { id: 'core',  rawMod: 1.6, elemMod: 1.6 },
    ],
    phases: [
      { hpPct: 1.0, attackPool: ['melee', 'heavy', 'aoe_zone', 'charge'] },
      { hpPct: 0.6, attackPool: ['melee', 'heavy', 'aoe_zone', 'charge', 'multi_proj', 'summon', 'phase_slam'], speedMult: 1.25, arenaEvent: 'heart_transition' },
    ],
    breakParts: [
      { id: 'heart_shell', name: 'Heart Shell', hp: 10000, dropItemId: 'sovereign_heart' },
    ],
  },
];

export function bossForFloor(floor: number): BossDef[] {
  return BOSS_DEFS.filter(b => b.floor === floor);
}
