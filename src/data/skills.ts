import { ClassId } from '../types';

export interface SkillNode {
  id: string;
  name: string;
  branch: string;
  tier: number;            // 1..4
  type: 'passive' | 'active';
  cost: number;            // skill points
  requires?: string[];     // node ids
  cooldownMs?: number;
  mpCost?: number;
  staminaCost?: number;
  description: string;
}

export interface ClassSkillTree {
  classId: ClassId;
  signatureName: string;
  signatureDesc: string;
  nodes: SkillNode[];
  capstone: SkillNode;
}

// Helper builder for skill tree nodes
function node(
  id: string, name: string, branch: string, tier: number, type: 'passive' | 'active',
  desc: string, opts: { req?: string[], cd?: number, mp?: number, stam?: number } = {}
): SkillNode {
  return {
    id, name, branch, tier, type, cost: 1,
    requires: opts.req, cooldownMs: opts.cd,
    mpCost: opts.mp, staminaCost: opts.stam, description: desc
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SWORDMAN SKILLS
// ─────────────────────────────────────────────────────────────────────────────
const SWORDMAN_TREE: ClassSkillTree = {
  classId: 'swordman',
  signatureName: 'Riposte Stance',
  signatureDesc: 'Active Parry. When hit in this stance, parry damage and execute a 100% crit Riposte thrust.',
  capstone: node('sword_cap', 'Perfect Tempo', 'Capstone', 5, 'active', 'Capstone: Deals flurry of 3 quick hits. Connecting refunds 50% of active skill cooldowns.', { cd: 45000, stam: 20 }),
  nodes: [
    // Branch 1: Blade
    node('sword_b1_t1', 'Blade Mastery', 'Blade', 1, 'passive', '+15% Melee damage.'),
    node('sword_b1_t2', 'Blade Combo', 'Blade', 2, 'passive', 'Third light combo hit deals +20% damage.', { req: ['sword_b1_t1'] }),
    node('sword_b1_t3', 'Sharp Blade', 'Blade', 3, 'passive', 'Edge gauge decays 30% slower.', { req: ['sword_b1_t2'] }),
    node('sword_b1_t4', 'Blade Thrust', 'Blade', 4, 'active', 'Lunge forward quickly, dealing 1.4x damage and high poise damage.', { req: ['sword_b1_t3'], cd: 4000, stam: 10 }),

    // Branch 2: Guard
    node('sword_b2_t1', 'Parry Focus', 'Guard', 1, 'passive', 'Signature stance parry window extended by 200ms.'),
    node('sword_b2_t2', 'Shielded Guard', 'Guard', 2, 'passive', 'Regular guard block mitigation rate +15%.', { req: ['sword_b2_t1'] }),
    node('sword_b2_t3', 'Aegis Shield', 'Guard', 3, 'passive', 'Chip damage taken during guard reduced by 50%.', { req: ['sword_b2_t2'] }),
    node('sword_b2_t4', 'Bulwark Stance', 'Guard', 4, 'passive', 'Block incoming attacks from any direction during active parry.', { req: ['sword_b2_t3'] }),

    // Branch 3: Tempo
    node('sword_b3_t1', 'Quick Roll', 'Tempo', 1, 'passive', 'Roll cancels recover 10 stamina.'),
    node('sword_b3_t2', 'Adrenaline', 'Tempo', 2, 'passive', '+25% Stamina regeneration rate.', { req: ['sword_b3_t1'] }),
    node('sword_b3_t3', 'Momentum', 'Tempo', 3, 'passive', 'Each hit without taking damage increases critical chance by 2%.', { req: ['sword_b3_t2'] }),
    node('sword_b3_t4', 'Heavy Cancel', 'Tempo', 4, 'passive', 'Allows dodge-roll cancellation during heavy attack recovery.', { req: ['sword_b3_t3'] }),
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. ARCHER SKILLS
// ─────────────────────────────────────────────────────────────────────────────
const ARCHER_TREE: ClassSkillTree = {
  classId: 'archer',
  signatureName: 'Coating Cycle',
  signatureDesc: 'Cycle coatings (None -> Power [+20% dmg] -> Poison [DoT] -> Paralysis [Stun]).',
  capstone: node('arch_cap', 'Deadeye Focus', 'Capstone', 5, 'active', 'Capstone: Focus mode for 6s: arrows pierce all targets and critical damage +50%.', { cd: 60000, mp: 30 }),
  nodes: [
    // Branch 1: Precision
    node('arch_b1_t1', 'Eagle Eye', 'Precision', 1, 'passive', '+15% Critical strike chance.'),
    node('arch_b1_t2', 'Precise Arrow', 'Precision', 2, 'passive', 'Critical damage multiplier +20%.', { req: ['arch_b1_t1'] }),
    node('arch_b1_t3', 'Mark Target', 'Precision', 3, 'passive', 'Hitting an enemy increases all damage they take by 10% for 4s.', { req: ['arch_b1_t2'] }),
    node('arch_b1_t4', 'Weak Point Focus', 'Precision', 4, 'passive', 'Basic ranged attacks deal +25% damage to full-HP enemies.', { req: ['arch_b1_t3'] }),

    // Branch 2: Volley
    node('arch_b2_t1', 'Multi-Shot', 'Volley', 1, 'passive', 'Bows fire 2 arrows in a slight spread for 75% damage each.'),
    node('arch_b2_t2', 'Arrow Rain', 'Volley', 2, 'active', 'Fire a circular volley slowing enemies by 50% and ticking DoT.', { req: ['arch_b2_t1'], cd: 6000, mp: 15 }),
    node('arch_b2_t3', 'Piercing Bolt', 'Volley', 3, 'passive', 'Crossbow bolts pierce 1 additional target.', { req: ['arch_b2_t2'] }),
    node('arch_b2_t4', 'Ricochet', 'Volley', 4, 'passive', 'Arrows and bolts bounce once to nearest enemy within 80px.', { req: ['arch_b2_t3'] }),

    // Branch 3: Survival
    node('arch_b3_t1', 'Backstep Shot', 'Survival', 1, 'passive', '+20% Dodge roll distance.'),
    node('arch_b3_t2', 'Swift Aim', 'Survival', 2, 'passive', '+15% Movement speed while reloading or aiming.', { req: ['arch_b3_t1'] }),
    node('arch_b3_t3', 'Trap Arrow', 'Survival', 3, 'passive', 'Projectile hits slow enemies by 30% for 2 seconds.', { req: ['arch_b3_t2'] }),
    node('arch_b3_t4', 'Resourcefulness', 'Survival', 4, 'passive', '25% Chance not to consume arrow/bolt ammo on shot.', { req: ['arch_b3_t3'] }),
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. TANKER SKILLS
// ─────────────────────────────────────────────────────────────────────────────
const TANKER_TREE: ClassSkillTree = {
  classId: 'tanker',
  signatureName: 'Bastion Mode',
  signatureDesc: 'Toggle Stance. Moves 40% slower, but reduces damage by 50%. Perfect guard emits counter shockwaves.',
  capstone: node('tank_cap', 'Immovable Bulwark', 'Capstone', 5, 'active', 'Capstone: Absolute crowd control immunity (no knockback/stagger) +80 Defense for 8s.', { cd: 80000, stam: 25 }),
  nodes: [
    // Branch 1: Aegis
    node('tank_b1_t1', 'Aegis Guard', 'Aegis', 1, 'passive', 'Regular guard block mitigation increased by 15%.'),
    node('tank_b1_t2', 'Fortress Wall', 'Aegis', 2, 'passive', 'Flat defense rating increased by 15.', { req: ['tank_b1_t1'] }),
    node('tank_b1_t3', 'Spiked Shield', 'Aegis', 3, 'passive', 'Reflect 15% of blocked damage back to the attacker.', { req: ['tank_b1_t2'] }),
    node('tank_b1_t4', 'Aegis Shielding', 'Aegis', 4, 'passive', 'Perfect guard active window increased by 50ms.', { req: ['tank_b1_t3'] }),

    // Branch 2: Provoke
    node('tank_b2_t1', 'Loud Taunt', 'Provoke', 1, 'passive', 'All player attacks generate 50% more threat.'),
    node('tank_b2_t2', 'Taunt Slam', 'Provoke', 2, 'active', 'Slam shield dealing 12 damage to nearby enemies and drawing threat.', { req: ['tank_b2_t1'], cd: 5000, stam: 15 }),
    node('tank_b2_t3', 'Last Stand', 'Provoke', 3, 'passive', 'When under 30% HP, gain a bonus +40 Defense.', { req: ['tank_b2_t2'] }),
    node('tank_b2_t4', 'Bastion Shockwave', 'Provoke', 4, 'passive', 'Counter-attack shockwaves during Bastion deal +50% damage.', { req: ['tank_b2_t3'] }),

    // Branch 3: Impact
    node('tank_b3_t1', 'Heavy Impact', 'Impact', 1, 'passive', 'Mace and hammer poise damage increased by 25%.'),
    node('tank_b3_t2', 'Shield Bash', 'Impact', 2, 'passive', 'Critical hits stagger and stun target for 500ms.', { req: ['tank_b3_t1'] }),
    node('tank_b3_t3', 'Stun Hammer', 'Impact', 3, 'passive', '+20% Damage dealt to staggered or stunned targets.', { req: ['tank_b3_t2'] }),
    node('tank_b3_t4', 'Ground Tremor', 'Impact', 4, 'passive', 'Basic attacks have a 15% chance to trigger mini-stagger.', { req: ['tank_b3_t3'] }),
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. ASSASSIN SKILLS
// ─────────────────────────────────────────────────────────────────────────────
const ASSASSIN_TREE: ClassSkillTree = {
  classId: 'assassin',
  signatureName: 'Vanish Stealth',
  signatureDesc: 'Drop threat and become invisible. First strike from stealth deals 100% crit at 2x crit multiplier.',
  capstone: node('assa_cap', 'Death Mark', 'Capstone', 5, 'active', 'Capstone: Mark a target. Hitting marked target executes 20% of missing HP (max 150).', { cd: 60000, stam: 30 }),
  nodes: [
    // Branch 1: Shadow
    node('assa_b1_t1', 'Shadow Cover', 'Shadow', 1, 'passive', 'Vanish stealth duration extended by 3 seconds.'),
    node('assa_b1_t2', 'Vanish Kill', 'Shadow', 2, 'passive', 'Killing an enemy instantly triggers 2 seconds of Stealth.', { req: ['assa_b1_t1'] }),
    node('assa_b1_t3', 'Infiltrator', 'Shadow', 3, 'passive', '+15% Movement speed while in stealth.', { req: ['assa_b1_t2'] }),
    node('assa_b1_t4', 'Assassinate', 'Shadow', 4, 'passive', 'First attack out of stealth deals +40% extra damage.', { req: ['assa_b1_t3'] }),

    // Branch 2: Venom
    node('assa_b2_t1', 'Toxic Venom', 'Venom', 1, 'passive', 'Poison status effects deal +25% damage per tick.'),
    node('assa_b2_t2', 'Poison Dart', 'Venom', 2, 'active', 'Throws a quick dart dealing 8 damage and applying poison.', { req: ['assa_b2_t1'], cd: 5000, stam: 10 }),
    node('assa_b2_t3', 'Bleed Out', 'Venom', 3, 'passive', 'Critical hits apply bleed dealing 2 DoT for 4s.', { req: ['assa_b2_t2'] }),
    node('assa_b2_t4', 'Rupture Blast', 'Venom', 4, 'passive', 'Hitting a poisoned target triggers a rupture dealing 20 damage.', { req: ['assa_b2_t3'] }),

    // Branch 3: Tempo
    node('assa_b3_t1', 'Opportunist', 'Tempo', 1, 'passive', '+20% Critical chance when attacking from behind.'),
    node('assa_b3_t2', 'Frenzy Mastery', 'Tempo', 2, 'passive', 'Twin Daggers frenzy stamina drain rate reduced by 30%.', { req: ['assa_b3_t1'] }),
    node('assa_b3_t3', 'Flow Step', 'Tempo', 3, 'passive', 'Consecutive hits without taking damage give +15% dodge chance.', { req: ['assa_b3_t2'] }),
    node('assa_b3_t4', 'Adrenaline Roll', 'Tempo', 4, 'passive', 'Dodge rolling successfully refunds 10 Stamina.', { req: ['assa_b3_t3'] }),
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. SAGE SKILLS
// ─────────────────────────────────────────────────────────────────────────────
const SAGE_TREE: ClassSkillTree = {
  classId: 'sage',
  signatureName: 'Element Swap',
  signatureDesc: 'Swap element stance (Fire [Burn] -> Ice [Chill/Slow] -> Lightning [Chain Bolt]).',
  capstone: node('sage_cap', 'Convergence', 'Capstone', 5, 'active', 'Capstone: Cast reaction detonation dealing 80 damage if target hit by multiple elements.', { cd: 70000, mp: 40 }),
  nodes: [
    // Branch 1: Elements
    node('sage_b1_t1', 'Element Mastery', 'Elements', 1, 'passive', 'Elemental fireball and magic bolts deal +15% damage.'),
    node('sage_b1_t2', 'Pyromaniac', 'Elements', 2, 'passive', 'Fire element stance spells have a 25% chance to burn target.', { req: ['sage_b1_t1'] }),
    node('sage_b1_t3', 'Frost Mage', 'Elements', 3, 'passive', 'Ice spells chill targets, slowing speed by an extra 15%.', { req: ['sage_b1_t2'] }),
    node('sage_b1_t4', 'Storm Caster', 'Elements', 4, 'passive', 'Lightning bolts chain to 2 targets instead of 1.', { req: ['sage_b1_t3'] }),

    // Branch 2: Glyph
    node('sage_b2_t1', 'Glyph Focus', 'Glyph', 1, 'passive', 'Tome glyph marker placing cost reduced by 4 MP.'),
    node('sage_b2_t2', 'Glyph Blast', 'Glyph', 2, 'active', 'Trigger a localized shockwave blast matching active element.', { req: ['sage_b2_t1'], cd: 5000, mp: 15 }),
    node('sage_b2_t3', 'Healing Glyph', 'Glyph', 3, 'passive', 'Standing near your active glyph heals you for 3 HP per second.', { req: ['sage_b2_t2'] }),
    node('sage_b2_t4', 'Glyph Trap', 'Glyph', 4, 'passive', 'Enemies that pass through glyph are slowed by 60% for 3 seconds.', { req: ['sage_b2_t3'] }),

    // Branch 3: Mysticism
    node('sage_b3_t1', 'Mana Flow', 'Mysticism', 1, 'passive', '+20% Mana regeneration rate.'),
    node('sage_b3_t2', 'Mana Shield', 'Mysticism', 2, 'passive', 'Consume MP instead of HP to mitigate 20% of damage taken.', { req: ['sage_b3_t1'] }),
    node('sage_b3_t3', 'Sage Wisdom', 'Mysticism', 3, 'passive', 'Sage stats increase max MP capacity by 15%.', { req: ['sage_b3_t2'] }),
    node('sage_b3_t4', 'Cleanse roll', 'Mysticism', 4, 'passive', 'Executing a perfect dodge cleanses all negative status ailments.', { req: ['sage_b3_t3'] }),
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Tree registry lookup
// ─────────────────────────────────────────────────────────────────────────────
export const SKILL_TREES: Record<ClassId, ClassSkillTree> = {
  swordman:     SWORDMAN_TREE,
  archer:       ARCHER_TREE,
  tanker:       TANKER_TREE,
  assassin:     ASSASSIN_TREE,
  sage:         SAGE_TREE
};

export function getSkillTree(classId: ClassId): ClassSkillTree {
  return SKILL_TREES[classId] || SKILL_TREES.swordman;
}
