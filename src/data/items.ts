import { WeaponFamily } from './movesets';
import type { PhysType, WeaponTrait } from '../types';

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'ammo' | 'tome' | 'material' | 'bag' | 'jewel';
export type EquipSlot = 'head' | 'chest' | 'hands' | 'legs' | 'boots' | 'mainhand' | 'offhand' | 'weapon2' | 'amulet' | 'ring1' | 'ring2' | 'charm' | 'none';
export type AttackType = 'melee' | 'arrow' | 'bolt' | 'fireball' | 'glyph';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  slot: EquipSlot;
  attackType?: AttackType;
  family?: WeaponFamily;
  physType?: PhysType;       // §E15 — physical damage category for PHYS_CHART lookup
  sellValue?: number;
  expValue?: number;
  stackSize?: number;
  // §16 additions
  weight?: number;
  setName?: string;
  baseDefense?: number;
  baseAttack?: number;
  // §P9 — elemental weapon data
  element?: string;          // elemental type (fire/ice/lightning/poison/void/radiant)
  elementValue?: number;     // flat elemental power; drives elem split in resolveHit
  trait?: WeaponTrait;       // weapon identity trait (P11 behavior)
  isUnique?: boolean;        // legendary / unique weapon flag
  // §P9 — consumable behavior (data-driven)
  healHp?: number;           // HP restored on use
  healMp?: number;           // MP restored on use
  healPercent?: boolean;     // if true, healHp/healMp are % of max
  regenHpPerSec?: number;    // HP regen per second (regen draught)
  regenDurationMs?: number;  // regen duration ms
  tonicEffect?: string;      // tonic buff type: 'str'|'magic'|'def'|'crit'|'speed'|'fire'|...
  tonicDuration?: number;    // tonic duration ms (default 90000)
  cleanseOne?: boolean;      // removes one random negative ailment
  cleanseAll?: boolean;      // removes all ailments + grants 5s immunity
  stopBleed?: boolean;       // stops bleed + small heal
  // §P9 — throwables
  isThrowable?: boolean;
  throwRadius?: number;      // AoE radius px
  throwElement?: string;     // element applied on impact
  throwAilmentBuild?: number;// ailment build-up amount per hit
  isFlash?: boolean;         // flash bomb → blind enemies in radius
  isSonic?: boolean;         // sonic bomb → stagger enemies in radius
  // §P9 — jewel
  jewelSkill?: string;       // stat/bonus this jewel provides
  jewelLevel?: 1 | 2 | 3;
  jewelValue?: number;       // magnitude of jewel bonus
}

const BASE_ITEMS: Record<string, Item> = {
  // ── Starting equipment & retro-compatibility defaults ──
  short_sword:    { id: 'short_sword',    name: 'Short Sword',    type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'sword',       physType: 'slash',  baseAttack: 10, weight: 3, sellValue: 10 },
  longsword:      { id: 'longsword',      name: 'Long Sword',     type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'sword',       physType: 'slash',  baseAttack: 14, weight: 4, sellValue: 15 },
  greatsword:     { id: 'greatsword',     name: 'Greatsword',     type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'greatsword',  physType: 'slash',  baseAttack: 20, weight: 8, sellValue: 20 },
  twin_daggers:   { id: 'twin_daggers',   name: 'Twin Daggers',   type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'twin_daggers',physType: 'slash',  baseAttack: 8,  weight: 2, sellValue: 12 },
  mace:           { id: 'mace',           name: 'Mace',           type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'mace',        physType: 'blunt',  baseAttack: 12, weight: 6, sellValue: 14 },
  spear:          { id: 'spear',          name: 'Spear',          type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'spear',       physType: 'pierce', baseAttack: 13, weight: 5, sellValue: 13 },
  gauntlets:      { id: 'gauntlets',      name: 'Gauntlets',      type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'gauntlets',   physType: 'blunt',  baseAttack: 9,  weight: 2, sellValue: 10 },
  short_bow:      { id: 'short_bow',      name: 'Short Bow',      type: 'weapon',     slot: 'mainhand', attackType: 'arrow',    family: 'bow',         physType: 'pierce', baseAttack: 11, weight: 3, sellValue: 12 },
  crossbow:       { id: 'crossbow',       name: 'Crossbow',       type: 'weapon',     slot: 'mainhand', attackType: 'bolt',     family: 'crossbow',    physType: 'pierce', baseAttack: 15, weight: 5, sellValue: 15 },
  staff:          { id: 'staff',          name: 'Staff',          type: 'weapon',     slot: 'mainhand', attackType: 'fireball', family: 'staff',       physType: 'blunt',  baseAttack: 12, weight: 4, sellValue: 14 },
  fireball_tome:  { id: 'fireball_tome',  name: 'Fireball Tome',  type: 'tome',       slot: 'none',     attackType: 'fireball', family: 'tome',        physType: 'blunt',  baseAttack: 0,  weight: 1, sellValue: 18 },
  focus_tome:     { id: 'focus_tome',     name: 'Focus Tome',     type: 'weapon',     slot: 'mainhand', attackType: 'glyph',    family: 'tome',        physType: 'blunt',  baseAttack: 10, weight: 2, sellValue: 15 },

  // Basic retro-compatibility armor pieces
  leather_armor:  { id: 'leather_armor',  name: 'Leather Armor',  type: 'armor',      slot: 'chest',    baseDefense: 8,  weight: 4, sellValue: 15 },
  light_leather:  { id: 'light_leather',  name: 'Light Leather',  type: 'armor',      slot: 'chest',    baseDefense: 6,  weight: 2, sellValue: 12 },
  chainmail:      { id: 'chainmail',      name: 'Chainmail',      type: 'armor',      slot: 'chest',    baseDefense: 14, weight: 8, sellValue: 25 },
  robe:           { id: 'robe',           name: 'Robe',           type: 'armor',      slot: 'chest',    baseDefense: 4,  weight: 1, sellValue: 10 },
  round_shield:   { id: 'round_shield',   name: 'Round Shield',   type: 'armor',      slot: 'offhand',  baseDefense: 10, weight: 5, sellValue: 15 },

  // ── Ammo ──
  arrow:          { id: 'arrow',          name: 'Arrow',          type: 'ammo',       slot: 'none', stackSize: 99, sellValue: 1 },
  bolt:           { id: 'bolt',           name: 'Bolt',           type: 'ammo',       slot: 'none', stackSize: 60, sellValue: 1 },

  // ── Consumables — Restoratives ──
  health_potion:  { id: 'health_potion',  name: 'Health Potion',    type: 'consumable', slot: 'none', healHp: 90, sellValue: 18 },
  mana_potion:    { id: 'mana_potion',    name: 'Mana Potion',      type: 'consumable', slot: 'none', healMp: 30, sellValue: 12 },
  minor_potion:   { id: 'minor_potion',   name: 'Minor Potion',     type: 'consumable', slot: 'none', healHp: 40, sellValue: 7 },
  greater_potion: { id: 'greater_potion', name: 'Greater Potion',   type: 'consumable', slot: 'none', healHp: 180, sellValue: 40 },
  mega_elixir:    { id: 'mega_elixir',    name: 'Mega-Elixir',      type: 'consumable', slot: 'none', healHp: 9999, healMp: 9999, healPercent: true, sellValue: 250 },
  regen_draught:  { id: 'regen_draught',  name: 'Regen Draught',    type: 'consumable', slot: 'none', regenHpPerSec: 8, regenDurationMs: 20000, sellValue: 35 },
  greater_mana_potion: { id: 'greater_mana_potion', name: 'Greater Mana Potion', type: 'consumable', slot: 'none', healMp: 80, sellValue: 28 },
  ether_bun:      { id: 'ether_bun',      name: 'Ether Bun',        type: 'consumable', slot: 'none', regenHpPerSec: 0, regenDurationMs: 30000, healMp: 5, sellValue: 14 },
  cleansing_tonic:{ id: 'cleansing_tonic',name: 'Cleansing Tonic',  type: 'consumable', slot: 'none', cleanseOne: true, sellValue: 25 },
  panacea:        { id: 'panacea',        name: 'Panacea',          type: 'consumable', slot: 'none', cleanseAll: true, sellValue: 80 },
  bandage:        { id: 'bandage',        name: 'Bandage',          type: 'consumable', slot: 'none', stopBleed: true, healHp: 15, stackSize: 5, sellValue: 8 },

  // ── Combat Tonics (90s buffs) ──
  might_draught:      { id: 'might_draught',      name: 'Might Draught',      type: 'consumable', slot: 'none', tonicEffect: 'str',     tonicDuration: 90000, sellValue: 30 },
  sorcerers_draught:  { id: 'sorcerers_draught',  name: "Sorcerer's Draught", type: 'consumable', slot: 'none', tonicEffect: 'magic',   tonicDuration: 90000, sellValue: 30 },
  adamant_tonic:      { id: 'adamant_tonic',       name: 'Adamant Tonic',      type: 'consumable', slot: 'none', tonicEffect: 'def',     tonicDuration: 90000, sellValue: 30 },
  focus_tonic:        { id: 'focus_tonic',         name: 'Focus Tonic',        type: 'consumable', slot: 'none', tonicEffect: 'crit',    tonicDuration: 90000, sellValue: 28 },
  endurance_brew:     { id: 'endurance_brew',      name: 'Endurance Brew',     type: 'consumable', slot: 'none', tonicEffect: 'stamina', tonicDuration: 90000, sellValue: 22 },
  quickfoot_tonic:    { id: 'quickfoot_tonic',     name: 'Quickfoot',          type: 'consumable', slot: 'none', tonicEffect: 'speed',   tonicDuration: 90000, sellValue: 22 },
  whetting_oil_flame: { id: 'whetting_oil_flame',  name: 'Flame Oil',          type: 'consumable', slot: 'none', tonicEffect: 'infuse_fire',      tonicDuration: 90000, sellValue: 35 },
  whetting_oil_frost: { id: 'whetting_oil_frost',  name: 'Frost Oil',          type: 'consumable', slot: 'none', tonicEffect: 'infuse_ice',       tonicDuration: 90000, sellValue: 35 },
  whetting_oil_storm: { id: 'whetting_oil_storm',  name: 'Storm Oil',          type: 'consumable', slot: 'none', tonicEffect: 'infuse_lightning',  tonicDuration: 90000, sellValue: 35 },
  whetting_oil_venom: { id: 'whetting_oil_venom',  name: 'Venom Oil',          type: 'consumable', slot: 'none', tonicEffect: 'infuse_poison',    tonicDuration: 90000, sellValue: 35 },
  whetting_oil_radiant:{ id: 'whetting_oil_radiant',name: 'Radiant Oil',       type: 'consumable', slot: 'none', tonicEffect: 'infuse_radiant',   tonicDuration: 90000, sellValue: 40 },

  // ── Throwables ──
  throwing_knife:   { id: 'throwing_knife',   name: 'Throwing Knife',  type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 8,  physType: 'pierce', sellValue: 3,  stackSize: 10 },
  elem_flask_fire:  { id: 'elem_flask_fire',  name: 'Fire Flask',      type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 36, throwElement: 'fire',      throwAilmentBuild: 40, sellValue: 12, stackSize: 5 },
  elem_flask_frost: { id: 'elem_flask_frost', name: 'Frost Flask',     type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 36, throwElement: 'ice',       throwAilmentBuild: 40, sellValue: 12, stackSize: 5 },
  elem_flask_shock: { id: 'elem_flask_shock', name: 'Shock Flask',     type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 36, throwElement: 'lightning', throwAilmentBuild: 40, sellValue: 12, stackSize: 5 },
  elem_flask_venom: { id: 'elem_flask_venom', name: 'Venom Flask',     type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 36, throwElement: 'poison',    throwAilmentBuild: 40, sellValue: 12, stackSize: 5 },
  flash_bomb:       { id: 'flash_bomb',       name: 'Flash Bomb',      type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 48, isFlash: true,  sellValue: 10, stackSize: 5 },
  sonic_bomb:       { id: 'sonic_bomb',       name: 'Sonic Bomb',      type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 40, isSonic: true,  sellValue: 10, stackSize: 5 },
  holy_water:       { id: 'holy_water',       name: 'Holy Water',      type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 40, throwElement: 'radiant', throwAilmentBuild: 60, sellValue: 20, stackSize: 3 },
  caltrops:         { id: 'caltrops',         name: 'Caltrops',        type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 24, throwAilmentBuild: 20, sellValue: 5,  stackSize: 5 },
  dung_bomb:        { id: 'dung_bomb',        name: 'Dung Bomb',       type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 40, sellValue: 4,  stackSize: 5 },
  oil_flask:        { id: 'oil_flask',        name: 'Oil Flask',       type: 'consumable', slot: 'none', isThrowable: true, throwRadius: 32, sellValue: 6,  stackSize: 5 },

  // ── Traps & Deployables ──
  smoke_bomb:     { id: 'smoke_bomb',     name: 'Smoke Bomb',     type: 'consumable', slot: 'none', sellValue: 4 },
  whetstone:      { id: 'whetstone',      name: 'Whetstone',      type: 'consumable', slot: 'none', sellValue: 3 },
  spike_trap:     { id: 'spike_trap',     name: 'Spike Trap',     type: 'consumable', slot: 'none', sellValue: 8 },
  shock_trap:     { id: 'shock_trap',     name: 'Shock Trap',     type: 'consumable', slot: 'none', sellValue: 12 },
  snare_trap:     { id: 'snare_trap',     name: 'Snare Trap',     type: 'consumable', slot: 'none', sellValue: 10 },
  bomb_barrel:    { id: 'bomb_barrel',    name: 'Bomb Barrel',    type: 'consumable', slot: 'none', sellValue: 18 },
  decoy_totem:    { id: 'decoy_totem',    name: 'Decoy Totem',    type: 'consumable', slot: 'none', sellValue: 15 },
  tent:           { id: 'tent',           name: 'Tent',           type: 'consumable', slot: 'none', sellValue: 20 },
  camp_kit:       { id: 'camp_kit',       name: 'Camp Kit',       type: 'consumable', slot: 'none', sellValue: 15 },

  // ── Utility / Exploration ──
  warp_crystal:   { id: 'warp_crystal',   name: 'Warp Crystal',   type: 'consumable', slot: 'none', sellValue: 12 },
  recall_stone:   { id: 'recall_stone',   name: 'Recall Stone',   type: 'consumable', slot: 'none', sellValue: 20 },
  torch:          { id: 'torch',          name: 'Torch',          type: 'consumable', slot: 'none', sellValue: 5, stackSize: 5 },
  lockpick:       { id: 'lockpick',       name: 'Lockpick',       type: 'consumable', slot: 'none', sellValue: 12, stackSize: 5 },
  rope:           { id: 'rope',           name: 'Rope',           type: 'consumable', slot: 'none', sellValue: 8 },
  monster_bait:   { id: 'monster_bait',   name: 'Monster Bait',   type: 'consumable', slot: 'none', sellValue: 6, stackSize: 3 },
  detector_charm: { id: 'detector_charm', name: 'Detector Charm', type: 'consumable', slot: 'none', sellValue: 15 },

  // ── Materials ──
  mana_stone_1:   { id: 'mana_stone_1',   name: 'Lv1 Mana Stone', type: 'material',   slot: 'none', sellValue: 10,  expValue: 50  },
  mana_stone_2:   { id: 'mana_stone_2',   name: 'Lv2 Mana Stone', type: 'material',   slot: 'none', sellValue: 25,  expValue: 150 },
  mana_stone_3:   { id: 'mana_stone_3',   name: 'Lv3 Mana Stone', type: 'material',   slot: 'none', sellValue: 55,  expValue: 350 },
  mana_stone_4:   { id: 'mana_stone_4',   name: 'Lv4 Mana Stone', type: 'material',   slot: 'none', sellValue: 120, expValue: 800 },
  iron_ore:       { id: 'iron_ore',       name: 'Iron Ore',       type: 'material',   slot: 'none', sellValue: 5 },
  dragon_scale:   { id: 'dragon_scale',   name: 'Dragon Scale',   type: 'material',   slot: 'none', sellValue: 50 },

  // §19 Boss part materials (floors 5–10)
  brand_ember:      { id: 'brand_ember',      name: 'Brand Ember',      type: 'material', slot: 'none', sellValue: 90  },
  frost_crystal:    { id: 'frost_crystal',    name: 'Frost Crystal',    type: 'material', slot: 'none', sellValue: 120 },
  choir_soul:       { id: 'choir_soul',       name: 'Choir Soul',       type: 'material', slot: 'none', sellValue: 150 },
  riftmaw_eye:      { id: 'riftmaw_eye',      name: 'Riftmaw Eye',      type: 'material', slot: 'none', sellValue: 180 },
  twin_crest:       { id: 'twin_crest',       name: 'Twin Crest',       type: 'material', slot: 'none', sellValue: 220 },
  sovereign_heart:  { id: 'sovereign_heart',  name: 'Sovereign Heart',  type: 'material', slot: 'none', sellValue: 400 },

  // §20 Anomaly drop materials
  rift_shard:       { id: 'rift_shard',       name: 'Rift Shard',       type: 'material', slot: 'none', sellValue: 350 },
  shade_essence:    { id: 'shade_essence',    name: 'Shade Essence',    type: 'material', slot: 'none', sellValue: 200 },
  grave_ash:        { id: 'grave_ash',        name: 'Grave Ash',        type: 'material', slot: 'none', sellValue: 250 },
  gilded_coin:      { id: 'gilded_coin',      name: 'Gilded Coin',      type: 'material', slot: 'none', sellValue: 180 },
  judge_mechanism:  { id: 'judge_mechanism',  name: 'Judge Mechanism',  type: 'material', slot: 'none', sellValue: 300 },
  friends_token:    { id: 'friends_token',    name: "Friend's Token",   type: 'material', slot: 'none', sellValue: 220 },
  nemesis_mark:     { id: 'nemesis_mark',     name: 'Nemesis Mark',     type: 'material', slot: 'none', sellValue: 400 },

  // §17 Materials & Runes
  goblin_tooth:   { id: 'goblin_tooth',   name: 'Goblin Tooth',   type: 'material',   slot: 'none', sellValue: 15 },
  drowned_pearl:  { id: 'drowned_pearl',  name: 'Drowned Pearl',  type: 'material',   slot: 'none', sellValue: 25 },
  brood_venom:    { id: 'brood_venom',    name: 'Brood Venom',    type: 'material',   slot: 'none', sellValue: 35 },
  captain_badge:  { id: 'captain_badge',  name: 'Captain Badge',  type: 'material',   slot: 'none', sellValue: 45 },

  rune_str:       { id: 'rune_str',       name: 'Strength Rune',   type: 'material',   slot: 'none', sellValue: 30 },
  rune_vit:       { id: 'rune_vit',       name: 'Vitality Rune',   type: 'material',   slot: 'none', sellValue: 30 },
  rune_int:       { id: 'rune_int',       name: 'Intellect Rune',  type: 'material',   slot: 'none', sellValue: 30 },
  rune_lifesteal: { id: 'rune_lifesteal', name: 'Lifesteal Rune',  type: 'material',   slot: 'none', sellValue: 50 },
  rune_dex:       { id: 'rune_dex',       name: 'Dexterity Rune',  type: 'material',   slot: 'none', sellValue: 30 },
  rune_agi:       { id: 'rune_agi',       name: 'Agility Rune',    type: 'material',   slot: 'none', sellValue: 30 },
  rune_guard:     { id: 'rune_guard',     name: 'Guard Rune',      type: 'material',   slot: 'none', sellValue: 40 },
  rune_evade:     { id: 'rune_evade',     name: 'Evade Rune',      type: 'material',   slot: 'none', sellValue: 40 },
  rune_fire:      { id: 'rune_fire',      name: 'Fire Rune',       type: 'material',   slot: 'none', sellValue: 45 },
  rune_ice:       { id: 'rune_ice',       name: 'Ice Rune',        type: 'material',   slot: 'none', sellValue: 45 },
  rune_lightning: { id: 'rune_lightning', name: 'Lightning Rune',  type: 'material',   slot: 'none', sellValue: 45 },
  rune_poison:    { id: 'rune_poison',    name: 'Poison Rune',     type: 'material',   slot: 'none', sellValue: 45 },
  rune_void:      { id: 'rune_void',      name: 'Void Rune',       type: 'material',   slot: 'none', sellValue: 55 },
  rune_radiant:   { id: 'rune_radiant',   name: 'Radiant Rune',    type: 'material',   slot: 'none', sellValue: 60 },
  rune_bleed:     { id: 'rune_bleed',     name: 'Bleed Rune',      type: 'material',   slot: 'none', sellValue: 40 },
  rune_ko:        { id: 'rune_ko',        name: 'KO Rune',         type: 'material',   slot: 'none', sellValue: 40 },
  rune_wound:     { id: 'rune_wound',     name: 'Wound Rune',      type: 'material',   slot: 'none', sellValue: 40 },
  rune_thorns:    { id: 'rune_thorns',    name: 'Thorns Rune',     type: 'material',   slot: 'none', sellValue: 50 },
  rune_greed:     { id: 'rune_greed',     name: 'Greed Rune',      type: 'material',   slot: 'none', sellValue: 35 },

  // §P9 — Jewels (decoration / socket inserts)
  jewel_atk_1:       { id: 'jewel_atk_1',       name: 'Attack Jewel 1',     type: 'jewel', slot: 'none', jewelSkill: 'atk',       jewelLevel: 1, jewelValue: 4,  sellValue: 50  },
  jewel_atk_2:       { id: 'jewel_atk_2',       name: 'Attack Jewel 2',     type: 'jewel', slot: 'none', jewelSkill: 'atk',       jewelLevel: 2, jewelValue: 8,  sellValue: 100 },
  jewel_atk_3:       { id: 'jewel_atk_3',       name: 'Attack Jewel 3',     type: 'jewel', slot: 'none', jewelSkill: 'atk',       jewelLevel: 3, jewelValue: 14, sellValue: 200 },
  jewel_elem_fire:   { id: 'jewel_elem_fire',   name: 'Fire Jewel',         type: 'jewel', slot: 'none', jewelSkill: 'elem_fire', jewelLevel: 2, jewelValue: 6,  sellValue: 90  },
  jewel_elem_ice:    { id: 'jewel_elem_ice',    name: 'Frost Jewel',        type: 'jewel', slot: 'none', jewelSkill: 'elem_ice',  jewelLevel: 2, jewelValue: 6,  sellValue: 90  },
  jewel_elem_lightning:{ id: 'jewel_elem_lightning', name: 'Storm Jewel',   type: 'jewel', slot: 'none', jewelSkill: 'elem_lightning', jewelLevel: 2, jewelValue: 6, sellValue: 90 },
  jewel_elem_poison: { id: 'jewel_elem_poison', name: 'Venom Jewel',        type: 'jewel', slot: 'none', jewelSkill: 'elem_poison', jewelLevel: 2, jewelValue: 6, sellValue: 90  },
  jewel_elem_void:   { id: 'jewel_elem_void',   name: 'Void Jewel',         type: 'jewel', slot: 'none', jewelSkill: 'elem_void', jewelLevel: 2, jewelValue: 6,  sellValue: 110 },
  jewel_elem_radiant:{ id: 'jewel_elem_radiant',name: 'Radiant Jewel',      type: 'jewel', slot: 'none', jewelSkill: 'elem_radiant', jewelLevel: 2, jewelValue: 6, sellValue: 120},
  jewel_guard:       { id: 'jewel_guard',       name: 'Guard Jewel',        type: 'jewel', slot: 'none', jewelSkill: 'def',       jewelLevel: 2, jewelValue: 5,  sellValue: 80  },
  jewel_evade:       { id: 'jewel_evade',       name: 'Evade Jewel',        type: 'jewel', slot: 'none', jewelSkill: 'iframes',   jewelLevel: 2, jewelValue: 2,  sellValue: 80  },
  jewel_status_atk:  { id: 'jewel_status_atk', name: 'Status Jewel',       type: 'jewel', slot: 'none', jewelSkill: 'status_build', jewelLevel: 2, jewelValue: 10, sellValue: 95 },
  jewel_recovery:    { id: 'jewel_recovery',   name: 'Recovery Jewel',     type: 'jewel', slot: 'none', jewelSkill: 'healBonus', jewelLevel: 2, jewelValue: 15, sellValue: 85  },
  jewel_slayer_flesh:   { id: 'jewel_slayer_flesh',   name: 'Flesh Slayer',    type: 'jewel', slot: 'none', jewelSkill: 'slayer_flesh',    jewelLevel: 2, jewelValue: 15, sellValue: 100 },
  jewel_slayer_armored: { id: 'jewel_slayer_armored', name: 'Armor Slayer',    type: 'jewel', slot: 'none', jewelSkill: 'slayer_armored',  jewelLevel: 2, jewelValue: 15, sellValue: 100 },
  jewel_slayer_bone:    { id: 'jewel_slayer_bone',    name: 'Bone Slayer',     type: 'jewel', slot: 'none', jewelSkill: 'slayer_bone',     jewelLevel: 2, jewelValue: 15, sellValue: 100 },
  jewel_slayer_construct: { id: 'jewel_slayer_construct', name: 'Construct Slayer', type: 'jewel', slot: 'none', jewelSkill: 'slayer_construct', jewelLevel: 2, jewelValue: 15, sellValue: 100 },
  jewel_slayer_undead:  { id: 'jewel_slayer_undead',  name: 'Undead Slayer',   type: 'jewel', slot: 'none', jewelSkill: 'slayer_undead',   jewelLevel: 2, jewelValue: 15, sellValue: 100 },
  jewel_slayer_void:    { id: 'jewel_slayer_void',    name: 'Void Slayer',     type: 'jewel', slot: 'none', jewelSkill: 'slayer_void',     jewelLevel: 2, jewelValue: 20, sellValue: 120 },

  // ── Bags ──
  adventure_bag:  { id: 'adventure_bag',  name: 'Adventure Bag',  type: 'bag',        slot: 'none', sellValue: 25 },

  // §21 Camping raw ingredients
  ration:       { id: 'ration',       name: 'Ration',         type: 'material', slot: 'none', stackSize: 10, sellValue: 8  },
  dried_herb:   { id: 'dried_herb',   name: 'Dried Herb',     type: 'material', slot: 'none', stackSize: 10, sellValue: 5  },
  feather:      { id: 'feather',      name: 'Feather',        type: 'material', slot: 'none', stackSize: 20, sellValue: 3  },
  arrow_shaft:  { id: 'arrow_shaft',  name: 'Arrow Shaft',    type: 'material', slot: 'none', stackSize: 20, sellValue: 2  },
  vial:         { id: 'vial',         name: 'Vial',           type: 'material', slot: 'none', stackSize: 10, sellValue: 4  },

  // §21 Cooked meals (consumed for timed buffs)
  hearty_stew:     { id: 'hearty_stew',     name: 'Hearty Stew',     type: 'consumable', slot: 'none', sellValue: 20 },
  spiced_skewers:  { id: 'spiced_skewers',  name: 'Spiced Skewers',  type: 'consumable', slot: 'none', sellValue: 18 },
  iron_porridge:   { id: 'iron_porridge',   name: 'Iron Porridge',   type: 'consumable', slot: 'none', sellValue: 16 },
  hunters_tea:     { id: 'hunters_tea',     name: "Hunter's Tea",    type: 'consumable', slot: 'none', sellValue: 14 },
  mages_broth:     { id: 'mages_broth',     name: "Mage's Broth",    type: 'consumable', slot: 'none', sellValue: 22 },
  trailmix:        { id: 'trailmix',        name: 'Trail Mix',       type: 'consumable', slot: 'none', sellValue: 10 },
};

export const ITEMS: Record<string, Item> = { ...BASE_ITEMS };

// Generate 10 weapon tiers for 10 families = 100 weapons
const families: WeaponFamily[] = ['sword', 'greatsword', 'twin_daggers', 'mace', 'spear', 'gauntlets', 'bow', 'crossbow', 'staff', 'tome'];
const familiesNames: Record<WeaponFamily, string> = {
  sword: 'Sword',
  greatsword: 'Greatsword',
  twin_daggers: 'Daggers',
  mace: 'Mace',
  spear: 'Spear',
  gauntlets: 'Gauntlets',
  bow: 'Bow',
  crossbow: 'Crossbow',
  staff: 'Staff',
  tome: 'Tome'
};
const weaponMaterials = ['Iron', 'Bronze', 'Steel', 'Obsidian', 'Silver', 'Mithril', 'Crystal', 'Draconic', 'Abyssal', 'Celestial'];
const attackTypes: Record<WeaponFamily, AttackType> = {
  sword: 'melee',
  greatsword: 'melee',
  twin_daggers: 'melee',
  mace: 'melee',
  spear: 'melee',
  gauntlets: 'melee',
  bow: 'arrow',
  crossbow: 'bolt',
  staff: 'fireball',
  tome: 'glyph'
};

const physTypes: Record<WeaponFamily, PhysType> = {
  sword:        'slash',
  greatsword:   'slash',
  twin_daggers: 'slash',
  mace:         'blunt',
  spear:        'pierce',
  gauntlets:    'blunt',
  bow:          'pierce',
  crossbow:     'pierce',
  staff:        'blunt',
  tome:         'blunt',
};

families.forEach(fam => {
  weaponMaterials.forEach((mat, idx) => {
    const tier = idx + 1;
    const id = `${fam}_t${tier}`;
    const name = `${mat} ${familiesNames[fam]}`;
    ITEMS[id] = {
      id,
      name,
      type: fam === 'tome' && idx === 0 ? 'tome' : 'weapon',
      slot: 'mainhand',
      attackType: attackTypes[fam],
      family: fam,
      physType: physTypes[fam],
      baseAttack: 5 + tier * 6,
      weight: 2 + Math.floor(tier * 1.2),
      sellValue: tier * 15,
    };
  });
});

// Generate 8 sets × 5 slots = 40 armor items (6 original + frostward + voidbane)
const armorSets = [
  { id: 'goblin',    name: 'Goblin',    setName: 'goblin',    weight: 3,  def: 2 },
  { id: 'drowned',   name: 'Drowned',   setName: 'drowned',   weight: 4,  def: 3 },
  { id: 'brood',     name: 'Brood',     setName: 'brood',     weight: 2,  def: 2 },
  { id: 'captain',   name: 'Captain',   setName: 'captain',   weight: 6,  def: 5 },
  { id: 'sage',      name: 'Sage',      setName: 'sage',      weight: 1,  def: 1 },
  { id: 'plate',     name: 'Iron',      setName: 'plate',     weight: 8,  def: 6 },
  { id: 'frostward', name: 'Frostward', setName: 'frostward', weight: 5,  def: 4 },
  { id: 'voidbane',  name: 'Voidbane',  setName: 'voidbane',  weight: 4,  def: 3 },
];

const slots: { slotKey: string; name: string }[] = [
  { slotKey: 'head',  name: 'Helm' },
  { slotKey: 'chest', name: 'Armor' },
  { slotKey: 'hands', name: 'Gauntlets' },
  { slotKey: 'legs',  name: 'Greaves' },
  { slotKey: 'boots', name: 'Boots' },
];

armorSets.forEach(set => {
  slots.forEach((s, idx) => {
    const id = `${set.id}_${s.slotKey}`;
    const name = `${set.name} ${s.name}`;
    ITEMS[id] = {
      id,
      name,
      type: 'armor',
      slot: s.slotKey as EquipSlot,
      baseDefense: set.def + idx,
      weight: set.weight + idx,
      setName: set.setName,
      sellValue: 20 + set.def * 10,
    };
  });
});

// Generate Accessories catalog
const accessories = [
  { id: 'ruby_amulet',      name: 'Ruby Amulet',      slot: 'amulet' as const },
  { id: 'sapphire_amulet',  name: 'Sapphire Amulet',  slot: 'amulet' as const },
  { id: 'emerald_amulet',   name: 'Emerald Amulet',   slot: 'amulet' as const },
  { id: 'jade_amulet',      name: 'Jade Amulet',      slot: 'amulet' as const },
  { id: 'bone_ring',        name: 'Bone Ring',        slot: 'ring1' as const },
  { id: 'gold_ring',        name: 'Gold Ring',        slot: 'ring1' as const },
  { id: 'silver_ring',      name: 'Silver Ring',      slot: 'ring1' as const },
  { id: 'skull_ring',       name: 'Skull Ring',       slot: 'ring1' as const },
  { id: 'fire_charm',       name: 'Fire Charm',       slot: 'charm' as const },
  { id: 'ice_charm',        name: 'Ice Charm',        slot: 'charm' as const },
  { id: 'lightning_charm',  name: 'Lightning Charm',  slot: 'charm' as const },
  { id: 'vampire_charm',    name: 'Vampire Charm',    slot: 'charm' as const },
];

accessories.forEach(acc => {
  ITEMS[acc.id] = {
    id: acc.id,
    name: acc.name,
    type: 'armor',
    slot: acc.slot,
    weight: 1,
    sellValue: 40,
  };
});

// ── §P9: Elemental weapon variants — {prefix}_{family}_t{tier} ───────────────
// 6 elements × 10 families × 10 tiers = 600 variants; raw phys ×0.85, elementValue = tier×4
const elemPrefixes: { prefix: string; element: string; label: string }[] = [
  { prefix: 'flame',   element: 'fire',      label: 'Flame'   },
  { prefix: 'frost',   element: 'ice',       label: 'Frost'   },
  { prefix: 'storm',   element: 'lightning', label: 'Storm'   },
  { prefix: 'venom',   element: 'poison',    label: 'Venom'   },
  { prefix: 'void',    element: 'void',      label: 'Void'    },
  { prefix: 'radiant', element: 'radiant',   label: 'Radiant' },
];

elemPrefixes.forEach(ep => {
  families.forEach(fam => {
    weaponMaterials.forEach((mat, idx) => {
      const tier = idx + 1;
      const id   = `${ep.prefix}_${fam}_t${tier}`;
      const name = `${ep.label} ${mat} ${familiesNames[fam]}`;
      ITEMS[id] = {
        id,
        name,
        type: 'weapon',
        slot: 'mainhand',
        attackType: attackTypes[fam],
        family: fam,
        physType: physTypes[fam],
        element: ep.element,
        elementValue: tier * 4,
        baseAttack: Math.round((5 + tier * 6) * 0.85),
        weight: 2 + Math.floor(tier * 1.2),
        sellValue: tier * 22,
      };
    });
  });
});

// ── §P9: Unique / Legendary weapons (20) ─────────────────────────────────────
const UNIQUE_WEAPONS: Item[] = [
  // 8 from spec
  { id: 'worldknell',       name: 'Worldknell',         type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'mace',         physType: 'blunt',  baseAttack: 58, weight: 9,  trait: 'concussion', isUnique: true, sellValue: 500 },
  { id: 'whisper_and_wane', name: 'Whisper & Wane',     type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'twin_daggers', physType: 'slash',  baseAttack: 38, weight: 3,  trait: 'detonate',   isUnique: true, element: 'poison', elementValue: 18, sellValue: 500 },
  { id: 'dawnedge',         name: 'Dawnedge',           type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'sword',        physType: 'slash',  baseAttack: 46, weight: 5,  trait: 'leech',      isUnique: true, element: 'radiant', elementValue: 22, sellValue: 500 },
  { id: 'stormcaller',      name: 'Stormcaller',        type: 'weapon', slot: 'mainhand', attackType: 'arrow',    family: 'bow',          physType: 'pierce', baseAttack: 40, weight: 4,  trait: 'shockchain', isUnique: true, element: 'lightning', elementValue: 20, sellValue: 500 },
  { id: 'mountainbreaker',  name: 'Mountainbreaker',    type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'greatsword',   physType: 'slash',  baseAttack: 72, weight: 14, trait: 'cleave',     isUnique: true, sellValue: 500 },
  { id: 'comets_tongue',    name: "Comet's Tongue",     type: 'weapon', slot: 'mainhand', attackType: 'fireball', family: 'staff',        physType: 'blunt',  baseAttack: 38, weight: 5,  trait: 'channel',    isUnique: true, element: 'fire', elementValue: 28, sellValue: 500 },
  { id: 'the_last_page',    name: 'The Last Page',      type: 'weapon', slot: 'mainhand', attackType: 'glyph',    family: 'tome',         physType: 'blunt',  baseAttack: 36, weight: 2,  trait: 'glyph',      isUnique: true, element: 'radiant', elementValue: 24, sellValue: 500 },
  { id: 'gilded_fang',      name: 'Gilded Fang',        type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'twin_daggers', physType: 'pierce', baseAttack: 30, weight: 2,  isUnique: true, sellValue: 500 },
  // 12 additional
  { id: 'thornweave',       name: 'Thornweave',         type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'spear',        physType: 'pierce', baseAttack: 44, weight: 6,  trait: 'thornweave', isUnique: true, sellValue: 400 },
  { id: 'hollow_lance',     name: 'Hollow Lance',       type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'spear',        physType: 'pierce', baseAttack: 40, weight: 5,  trait: 'void_absorb',isUnique: true, element: 'void', elementValue: 20, sellValue: 420 },
  { id: 'shadowstep',       name: 'Shadowstep',         type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'twin_daggers', physType: 'slash',  baseAttack: 36, weight: 2,  trait: 'bleedstack', isUnique: true, sellValue: 410 },
  { id: 'ironclad_gauntlets',name: 'Ironclad Gauntlets',type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'gauntlets',    physType: 'blunt',  baseAttack: 42, weight: 7,  trait: 'defiant',    isUnique: true, sellValue: 390 },
  { id: 'frostfang_xbow',   name: 'Frostfang',          type: 'weapon', slot: 'mainhand', attackType: 'bolt',     family: 'crossbow',     physType: 'pierce', baseAttack: 46, weight: 6,  isUnique: true, element: 'ice', elementValue: 22, sellValue: 440 },
  { id: 'wyrmfire_staff',   name: 'Wyrmfire Staff',     type: 'weapon', slot: 'mainhand', attackType: 'fireball', family: 'staff',        physType: 'blunt',  baseAttack: 44, weight: 6,  isUnique: true, element: 'fire', elementValue: 30, sellValue: 450 },
  { id: 'chorus_tome',      name: 'Chorus Tome',        type: 'weapon', slot: 'mainhand', attackType: 'glyph',    family: 'tome',         physType: 'blunt',  baseAttack: 34, weight: 2,  trait: 'glyph',  isUnique: true, element: 'radiant', elementValue: 26, sellValue: 460 },
  { id: 'voidcleaver',      name: 'Voidcleaver',        type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'greatsword',   physType: 'slash',  baseAttack: 62, weight: 12, trait: 'cleave', isUnique: true, element: 'void', elementValue: 28, sellValue: 470 },
  { id: 'bonecrusher',      name: 'Bonecrusher',        type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'mace',         physType: 'blunt',  baseAttack: 54, weight: 10, trait: 'concussion', isUnique: true, sellValue: 380 },
  { id: 'serpent_bow',      name: 'Serpent Bow',        type: 'weapon', slot: 'mainhand', attackType: 'arrow',    family: 'bow',          physType: 'pierce', baseAttack: 36, weight: 4,  isUnique: true, element: 'poison', elementValue: 18, sellValue: 400 },
  { id: 'soulreaver',       name: 'Soulreaver',         type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'sword',        physType: 'slash',  baseAttack: 50, weight: 5,  trait: 'leech',  isUnique: true, sellValue: 480 },
  { id: 'abyssal_trident',  name: 'Abyssal Trident',    type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'spear',        physType: 'pierce', baseAttack: 48, weight: 7,  isUnique: true, element: 'void', elementValue: 24, sellValue: 490 },
];

UNIQUE_WEAPONS.forEach(w => { ITEMS[w.id] = w; });

// ── §P9: Boss-forge weapon lines (1 per boss material) ───────────────────────
const BOSS_FORGE_WEAPONS: Item[] = [
  { id: 'goblin_shiv',      name: 'Goblin Shiv',        type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'twin_daggers', physType: 'pierce', baseAttack: 28, weight: 2,  element: 'poison', elementValue: 12, isUnique: true, sellValue: 200 },
  { id: 'tide_spear',       name: 'Tide Spear',         type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'spear',        physType: 'pierce', baseAttack: 36, weight: 5,  element: 'lightning', elementValue: 16, isUnique: true, sellValue: 240 },
  { id: 'venom_crossbow',   name: 'Venom Crossbow',     type: 'weapon', slot: 'mainhand', attackType: 'bolt',     family: 'crossbow',     physType: 'pierce', baseAttack: 32, weight: 5,  element: 'poison', elementValue: 20, isUnique: true, sellValue: 260 },
  { id: 'warlord_mace',     name: "Warlord's Mace",     type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'mace',         physType: 'blunt',  baseAttack: 38, weight: 8,  trait: 'concussion', isUnique: true, sellValue: 280 },
  { id: 'furnace_blade',    name: 'Furnace Blade',      type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'sword',        physType: 'slash',  baseAttack: 42, weight: 6,  element: 'fire', elementValue: 22, isUnique: true, sellValue: 320 },
  { id: 'ysolds_lance',     name: "Ysold's Lance",      type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'spear',        physType: 'pierce', baseAttack: 44, weight: 6,  element: 'ice', elementValue: 24, isUnique: true, sellValue: 360 },
  { id: 'requiem_staff',    name: 'Requiem Staff',      type: 'weapon', slot: 'mainhand', attackType: 'fireball', family: 'staff',        physType: 'blunt',  baseAttack: 38, weight: 5,  element: 'radiant', elementValue: 26, isUnique: true, sellValue: 380 },
  { id: 'rift_cleaver',     name: 'Rift Cleaver',       type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'greatsword',   physType: 'slash',  baseAttack: 54, weight: 11, element: 'void', elementValue: 22, isUnique: true, sellValue: 400 },
  { id: 'twin_serpents',    name: 'Twin Serpents',      type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'twin_daggers', physType: 'slash',  baseAttack: 38, weight: 3,  element: 'void', elementValue: 18, isUnique: true, sellValue: 420 },
  { id: 'sovereign_blade',  name: 'Sovereign Blade',    type: 'weapon', slot: 'mainhand', attackType: 'melee',    family: 'sword',        physType: 'slash',  baseAttack: 68, weight: 7,  element: 'radiant', elementValue: 40, isUnique: true, sellValue: 800 },
];

BOSS_FORGE_WEAPONS.forEach(w => { ITEMS[w.id] = w; });
