import type { AlchemyRecipe } from '../types';

/**
 * §P9 — Alchemy recipes available at the Emporium (town) and/or camp.
 * UI implementation is P12 scope; data is source of truth for crafting.
 */
export const ALCHEMY_RECIPES: AlchemyRecipe[] = [

  // ── Basic restoratives ────────────────────────────────────────────────────
  {
    id:           'brew_minor_potion',
    name:         'Minor Potion',
    inputs:       [{ itemId: 'dried_herb', qty: 2 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'minor_potion', qty: 1 },
    availableAt:  'both',
  },
  {
    id:           'brew_health_potion',
    name:         'Health Potion',
    inputs:       [{ itemId: 'dried_herb', qty: 4 }, { itemId: 'vial', qty: 1 }, { itemId: 'iron_ore', qty: 1 }],
    output:       { itemId: 'health_potion', qty: 1 },
    availableAt:  'both',
  },
  {
    id:           'brew_greater_potion',
    name:         'Greater Potion',
    inputs:       [{ itemId: 'dried_herb', qty: 8 }, { itemId: 'vial', qty: 2 }, { itemId: 'mana_stone_2', qty: 1 }],
    output:       { itemId: 'greater_potion', qty: 1 },
    researchReq:  1,
    availableAt:  'emporium',
  },
  {
    id:           'brew_mana_potion',
    name:         'Mana Potion',
    inputs:       [{ itemId: 'mana_stone_1', qty: 1 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'mana_potion', qty: 1 },
    availableAt:  'both',
  },
  {
    id:           'brew_regen_draught',
    name:         'Regen Draught',
    inputs:       [{ itemId: 'dried_herb', qty: 3 }, { itemId: 'vial', qty: 1 }, { itemId: 'feather', qty: 2 }],
    output:       { itemId: 'regen_draught', qty: 1 },
    availableAt:  'both',
  },
  {
    id:           'brew_bandage',
    name:         'Bandage',
    inputs:       [{ itemId: 'feather', qty: 3 }],
    output:       { itemId: 'bandage', qty: 2 },
    availableAt:  'both',
  },
  {
    id:           'brew_cleansing_tonic',
    name:         'Cleansing Tonic',
    inputs:       [{ itemId: 'dried_herb', qty: 3 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'cleansing_tonic', qty: 1 },
    researchReq:  1,
    availableAt:  'both',
  },
  {
    id:           'brew_panacea',
    name:         'Panacea',
    inputs:       [{ itemId: 'dried_herb', qty: 8 }, { itemId: 'vial', qty: 2 }, { itemId: 'mana_stone_3', qty: 1 }],
    output:       { itemId: 'panacea', qty: 1 },
    researchReq:  2,
    availableAt:  'emporium',
  },

  // ── Combat tonics ─────────────────────────────────────────────────────────
  {
    id:           'brew_might',
    name:         'Might Draught',
    inputs:       [{ itemId: 'iron_ore', qty: 2 }, { itemId: 'vial', qty: 1 }, { itemId: 'ration', qty: 1 }],
    output:       { itemId: 'might_draught', qty: 1 },
    researchReq:  1,
    availableAt:  'emporium',
  },
  {
    id:           'brew_sorcerer',
    name:         "Sorcerer's Draught",
    inputs:       [{ itemId: 'mana_stone_1', qty: 2 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'sorcerers_draught', qty: 1 },
    researchReq:  1,
    availableAt:  'emporium',
  },
  {
    id:           'brew_adamant',
    name:         'Adamant Tonic',
    inputs:       [{ itemId: 'iron_ore', qty: 3 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'adamant_tonic', qty: 1 },
    researchReq:  1,
    availableAt:  'emporium',
  },

  // ── Whetting oils ─────────────────────────────────────────────────────────
  {
    id:           'brew_oil_flame',
    name:         'Flame Oil',
    inputs:       [{ itemId: 'brand_ember', qty: 1 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'whetting_oil_flame', qty: 1 },
    researchReq:  1,
    availableAt:  'emporium',
  },
  {
    id:           'brew_oil_frost',
    name:         'Frost Oil',
    inputs:       [{ itemId: 'frost_crystal', qty: 1 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'whetting_oil_frost', qty: 1 },
    researchReq:  1,
    availableAt:  'emporium',
  },
  {
    id:           'brew_oil_storm',
    name:         'Storm Oil',
    inputs:       [{ itemId: 'drowned_pearl', qty: 1 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'whetting_oil_storm', qty: 1 },
    researchReq:  1,
    availableAt:  'emporium',
  },
  {
    id:           'brew_oil_venom',
    name:         'Venom Oil',
    inputs:       [{ itemId: 'brood_venom', qty: 1 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'whetting_oil_venom', qty: 1 },
    researchReq:  1,
    availableAt:  'emporium',
  },
  {
    id:           'brew_oil_radiant',
    name:         'Radiant Oil',
    inputs:       [{ itemId: 'choir_soul', qty: 1 }, { itemId: 'vial', qty: 1 }],
    output:       { itemId: 'whetting_oil_radiant', qty: 1 },
    researchReq:  2,
    availableAt:  'emporium',
  },

  // ── Throwables ────────────────────────────────────────────────────────────
  {
    id:           'brew_fire_flask',
    name:         'Fire Flask',
    inputs:       [{ itemId: 'vial', qty: 1 }, { itemId: 'iron_ore', qty: 1 }],
    output:       { itemId: 'elem_flask_fire', qty: 2 },
    availableAt:  'both',
  },
  {
    id:           'brew_venom_flask',
    name:         'Venom Flask',
    inputs:       [{ itemId: 'vial', qty: 1 }, { itemId: 'brood_venom', qty: 1 }],
    output:       { itemId: 'elem_flask_venom', qty: 2 },
    availableAt:  'both',
  },
  {
    id:           'brew_holy_water',
    name:         'Holy Water',
    inputs:       [{ itemId: 'vial', qty: 1 }, { itemId: 'mana_stone_3', qty: 1 }],
    output:       { itemId: 'holy_water', qty: 1 },
    researchReq:  2,
    availableAt:  'emporium',
  },
  {
    id:           'brew_oil_flask',
    name:         'Oil Flask',
    inputs:       [{ itemId: 'vial', qty: 1 }, { itemId: 'ration', qty: 1 }],
    output:       { itemId: 'oil_flask', qty: 2 },
    availableAt:  'both',
  },
  {
    id:           'craft_arrows',
    name:         'Arrows (×10)',
    inputs:       [{ itemId: 'arrow_shaft', qty: 5 }, { itemId: 'feather', qty: 3 }, { itemId: 'iron_ore', qty: 1 }],
    output:       { itemId: 'arrow', qty: 10 },
    availableAt:  'both',
  },
  {
    id:           'craft_bolts',
    name:         'Bolts (×8)',
    inputs:       [{ itemId: 'arrow_shaft', qty: 4 }, { itemId: 'iron_ore', qty: 2 }],
    output:       { itemId: 'bolt', qty: 8 },
    availableAt:  'both',
  },

  // ── Material transmutation ────────────────────────────────────────────────
  {
    id:           'transmute_stone_1_to_2',
    name:         'Transmute Mana Stone 1→2',
    inputs:       [{ itemId: 'mana_stone_1', qty: 5 }],
    output:       { itemId: 'mana_stone_2', qty: 1 },
    researchReq:  1,
    availableAt:  'emporium',
  },
  {
    id:           'transmute_stone_2_to_3',
    name:         'Transmute Mana Stone 2→3',
    inputs:       [{ itemId: 'mana_stone_2', qty: 4 }],
    output:       { itemId: 'mana_stone_3', qty: 1 },
    researchReq:  2,
    availableAt:  'emporium',
  },
  {
    id:           'transmute_stone_3_to_4',
    name:         'Transmute Mana Stone 3→4',
    inputs:       [{ itemId: 'mana_stone_3', qty: 4 }],
    output:       { itemId: 'mana_stone_4', qty: 1 },
    researchReq:  3,
    availableAt:  'emporium',
  },
];

/** Get all recipes available at a given location and research level. */
export function recipesFor(location: 'emporium' | 'camp', researchLevel: number): AlchemyRecipe[] {
  return ALCHEMY_RECIPES.filter(r =>
    (r.availableAt === location || r.availableAt === 'both') &&
    (r.researchReq ?? 0) <= researchLevel
  );
}
