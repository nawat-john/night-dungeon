import type { AffixDef } from '../types';

/**
 * §P9 — Affix catalog (~40 affixes across offensive/defensive/utility/legendary).
 * Affixes roll on item generation; actual application is in Player.recomputeDerivedStats.
 */
export const AFFIX_CATALOG: AffixDef[] = [

  // ── Offensive ──────────────────────────────────────────────────────────────
  { id: 'atk_flat',         label: '+{v} Attack',             category: 'offensive', stat: 'baseAttack',      valueMin: 3,  valueMax: 12, isPercent: false, applicableTo: ['weapon'] },
  { id: 'atk_pct',          label: '+{v}% Attack',            category: 'offensive', stat: 'baseAttack',      valueMin: 5,  valueMax: 20, isPercent: true,  applicableTo: ['weapon'] },
  { id: 'elem_atk_fire',    label: '+{v} Fire Power',         category: 'offensive', stat: 'elem_fire',       valueMin: 4,  valueMax: 16, isPercent: false, applicableTo: ['weapon'] },
  { id: 'elem_atk_ice',     label: '+{v} Frost Power',        category: 'offensive', stat: 'elem_ice',        valueMin: 4,  valueMax: 16, isPercent: false, applicableTo: ['weapon'] },
  { id: 'elem_atk_lightning',label: '+{v} Storm Power',       category: 'offensive', stat: 'elem_lightning',  valueMin: 4,  valueMax: 16, isPercent: false, applicableTo: ['weapon'] },
  { id: 'elem_atk_poison',  label: '+{v} Venom Power',        category: 'offensive', stat: 'elem_poison',     valueMin: 4,  valueMax: 16, isPercent: false, applicableTo: ['weapon'] },
  { id: 'elem_atk_void',    label: '+{v} Void Power',         category: 'offensive', stat: 'elem_void',       valueMin: 4,  valueMax: 18, isPercent: false, applicableTo: ['weapon'] },
  { id: 'elem_atk_radiant', label: '+{v} Radiant Power',      category: 'offensive', stat: 'elem_radiant',    valueMin: 4,  valueMax: 18, isPercent: false, applicableTo: ['weapon'] },
  { id: 'status_bleed',     label: '+{v}% Bleed Build',       category: 'offensive', stat: 'bleedBuild',      valueMin: 10, valueMax: 30, isPercent: true,  applicableTo: ['weapon'] },
  { id: 'status_ko',        label: '+{v}% KO Build',          category: 'offensive', stat: 'koBuild',         valueMin: 10, valueMax: 30, isPercent: true,  applicableTo: ['weapon'] },
  { id: 'status_wound',     label: '+{v}% Wound Build',       category: 'offensive', stat: 'woundBuild',      valueMin: 10, valueMax: 30, isPercent: true,  applicableTo: ['weapon'] },
  { id: 'dmg_vs_body',      label: '+{v}% vs Body Type',      category: 'offensive', stat: 'bodySlayer',      valueMin: 8,  valueMax: 20, isPercent: true,  applicableTo: ['weapon'] },
  { id: 'dmg_vs_ailing',    label: '+{v}% vs Statused Foes',  category: 'offensive', stat: 'ailingBonus',     valueMin: 5,  valueMax: 15, isPercent: true,  applicableTo: ['weapon'] },
  { id: 'dmg_vs_fullhp',    label: '+{v}% vs Full HP Foes',   category: 'offensive', stat: 'fullHpBonus',     valueMin: 8,  valueMax: 22, isPercent: true,  applicableTo: ['weapon'] },
  { id: 'lifesteal_pct',    label: '{v}% Lifesteal',           category: 'offensive', stat: 'lifesteal',       valueMin: 2,  valueMax: 8,  isPercent: true,  applicableTo: ['weapon', 'accessory'] },

  // ── Defensive ──────────────────────────────────────────────────────────────
  { id: 'def_flat',         label: '+{v} Defense',            category: 'defensive', stat: 'defense',         valueMin: 2,  valueMax: 10, isPercent: false, applicableTo: ['armor', 'accessory'] },
  { id: 'def_pct',          label: '+{v}% Defense',           category: 'defensive', stat: 'defense',         valueMin: 5,  valueMax: 18, isPercent: true,  applicableTo: ['armor'] },
  { id: 'hp_flat',          label: '+{v} Max HP',             category: 'defensive', stat: 'maxHp',           valueMin: 10, valueMax: 40, isPercent: false, applicableTo: ['armor', 'accessory'] },
  { id: 'elem_res_fire',    label: '+{v}% Fire Resist',       category: 'defensive', stat: 'res_fire',        valueMin: 5,  valueMax: 20, isPercent: true,  applicableTo: ['armor', 'accessory'] },
  { id: 'elem_res_ice',     label: '+{v}% Frost Resist',      category: 'defensive', stat: 'res_ice',         valueMin: 5,  valueMax: 20, isPercent: true,  applicableTo: ['armor', 'accessory'] },
  { id: 'elem_res_lightning',label: '+{v}% Storm Resist',     category: 'defensive', stat: 'res_lightning',   valueMin: 5,  valueMax: 20, isPercent: true,  applicableTo: ['armor', 'accessory'] },
  { id: 'elem_res_poison',  label: '+{v}% Venom Resist',      category: 'defensive', stat: 'res_poison',      valueMin: 5,  valueMax: 20, isPercent: true,  applicableTo: ['armor', 'accessory'] },
  { id: 'elem_res_void',    label: '+{v}% Void Resist',       category: 'defensive', stat: 'res_void',        valueMin: 5,  valueMax: 20, isPercent: true,  applicableTo: ['armor', 'accessory'] },
  { id: 'status_res',       label: '+{v}% Status Resist',     category: 'defensive', stat: 'statusRes',       valueMin: 5,  valueMax: 15, isPercent: true,  applicableTo: ['armor', 'accessory'] },
  { id: 'iframes_bonus',    label: '+{v} i-Frames',           category: 'defensive', stat: 'iframes',         valueMin: 1,  valueMax: 3,  isPercent: false, applicableTo: ['armor', 'accessory'] },
  { id: 'knockback_red',    label: '-{v}% Knockback',         category: 'defensive', stat: 'knockbackRes',    valueMin: 10, valueMax: 30, isPercent: true,  applicableTo: ['armor'] },
  { id: 'thorns',           label: '{v}% Reflect on Hit',     category: 'defensive', stat: 'thorns',          valueMin: 5,  valueMax: 15, isPercent: true,  applicableTo: ['armor', 'accessory'] },

  // ── Utility ────────────────────────────────────────────────────────────────
  { id: 'movespeed',        label: '+{v}% Move Speed',        category: 'utility',   stat: 'moveSpeed',       valueMin: 3,  valueMax: 10, isPercent: true,  applicableTo: ['armor', 'accessory'] },
  { id: 'cooldown_red',     label: '-{v}% Skill Cooldown',    category: 'utility',   stat: 'cooldownRed',     valueMin: 5,  valueMax: 15, isPercent: true,  applicableTo: ['armor', 'accessory'] },
  { id: 'stamina_regen',    label: '+{v} Stamina Regen',      category: 'utility',   stat: 'staminaRegen',    valueMin: 2,  valueMax: 8,  isPercent: false, applicableTo: ['armor', 'accessory'] },
  { id: 'gold_find',        label: '+{v}% Gold Find',         category: 'utility',   stat: 'goldFind',        valueMin: 5,  valueMax: 20, isPercent: true,  applicableTo: ['accessory'] },
  { id: 'research_gain',    label: '+{v}% Research Gain',     category: 'utility',   stat: 'researchGain',    valueMin: 5,  valueMax: 20, isPercent: true,  applicableTo: ['accessory'] },
  { id: 'potion_potency',   label: '+{v}% Potion Potency',    category: 'utility',   stat: 'potionPotency',   valueMin: 10, valueMax: 30, isPercent: true,  applicableTo: ['accessory'] },
  { id: 'fov_bonus',        label: '+{v} FOV Radius',         category: 'utility',   stat: 'fovRadius',       valueMin: 1,  valueMax: 3,  isPercent: false, applicableTo: ['armor', 'accessory'] },
  { id: 'ammo_retain',      label: '{v}% Ammo Retention',     category: 'utility',   stat: 'ammoRetain',      valueMin: 15, valueMax: 35, isPercent: true,  applicableTo: ['weapon', 'armor'] },

  // ── Legendary ──────────────────────────────────────────────────────────────
  { id: 'leg_perfect_dodge_hp', label: 'Perfect dodge restores 5 HP', category: 'legendary', stat: 'perfectDodgeHeal', valueMin: 5, valueMax: 5, isPercent: false, applicableTo: ['accessory'] },
  { id: 'leg_topple_drop',  label: 'Topples drop a potion',          category: 'legendary', stat: 'toppleDropPotion', valueMin: 1, valueMax: 1, isPercent: false, applicableTo: ['weapon'] },
  { id: 'leg_freeze_shatter',label: 'Freezing a foe shatters for AoE',category: 'legendary', stat: 'freezeShatter',   valueMin: 1, valueMax: 1, isPercent: false, applicableTo: ['weapon', 'accessory'] },
  { id: 'leg_first_hit_crit',label: 'First hit each room = guaranteed crit', category: 'legendary', stat: 'firstHitCrit', valueMin: 1, valueMax: 1, isPercent: false, applicableTo: ['weapon'] },
];

/** Look up an AffixDef by its id. */
export function getAffixDef(id: string): AffixDef | undefined {
  return AFFIX_CATALOG.find(a => a.id === id);
}
