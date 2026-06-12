import { WeaponFamily } from './movesets';

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'ammo' | 'tome' | 'material' | 'bag';
export type EquipSlot = 'head' | 'chest' | 'hands' | 'legs' | 'boots' | 'mainhand' | 'offhand' | 'weapon2' | 'amulet' | 'ring1' | 'ring2' | 'charm' | 'none';
export type AttackType = 'melee' | 'arrow' | 'bolt' | 'fireball' | 'glyph';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  slot: EquipSlot;
  attackType?: AttackType;
  family?: WeaponFamily;
  sellValue?: number;
  expValue?: number;
  stackSize?: number;
  // §16 additions
  weight?: number;
  setName?: string;
  baseDefense?: number;
  baseAttack?: number;
}

const BASE_ITEMS: Record<string, Item> = {
  // ── Starting equipment & retro-compatibility defaults ──
  short_sword:    { id: 'short_sword',    name: 'Short Sword',    type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'sword',       baseAttack: 10, weight: 3, sellValue: 10 },
  longsword:      { id: 'longsword',      name: 'Long Sword',     type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'sword',       baseAttack: 14, weight: 4, sellValue: 15 },
  greatsword:     { id: 'greatsword',     name: 'Greatsword',     type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'greatsword',  baseAttack: 20, weight: 8, sellValue: 20 },
  twin_daggers:   { id: 'twin_daggers',   name: 'Twin Daggers',   type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'twin_daggers',baseAttack: 8,  weight: 2, sellValue: 12 },
  mace:           { id: 'mace',           name: 'Mace',           type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'mace',        baseAttack: 12, weight: 6, sellValue: 14 },
  spear:          { id: 'spear',          name: 'Spear',          type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'spear',       baseAttack: 13, weight: 5, sellValue: 13 },
  gauntlets:      { id: 'gauntlets',      name: 'Gauntlets',      type: 'weapon',     slot: 'mainhand', attackType: 'melee',    family: 'gauntlets',   baseAttack: 9,  weight: 2, sellValue: 10 },
  short_bow:      { id: 'short_bow',      name: 'Short Bow',      type: 'weapon',     slot: 'mainhand', attackType: 'arrow',    family: 'bow',         baseAttack: 11, weight: 3, sellValue: 12 },
  crossbow:       { id: 'crossbow',       name: 'Crossbow',       type: 'weapon',     slot: 'mainhand', attackType: 'bolt',     family: 'crossbow',    baseAttack: 15, weight: 5, sellValue: 15 },
  staff:          { id: 'staff',          name: 'Staff',          type: 'weapon',     slot: 'mainhand', attackType: 'fireball', family: 'staff',       baseAttack: 12, weight: 4, sellValue: 14 },
  fireball_tome:  { id: 'fireball_tome',  name: 'Fireball Tome',  type: 'tome',       slot: 'none',     attackType: 'fireball', family: 'tome',        baseAttack: 0,  weight: 1, sellValue: 18 },
  focus_tome:     { id: 'focus_tome',     name: 'Focus Tome',     type: 'weapon',     slot: 'mainhand', attackType: 'glyph',    family: 'tome',        baseAttack: 10, weight: 2, sellValue: 15 },

  // Basic retro-compatibility armor pieces
  leather_armor:  { id: 'leather_armor',  name: 'Leather Armor',  type: 'armor',      slot: 'chest',    baseDefense: 8,  weight: 4, sellValue: 15 },
  light_leather:  { id: 'light_leather',  name: 'Light Leather',  type: 'armor',      slot: 'chest',    baseDefense: 6,  weight: 2, sellValue: 12 },
  chainmail:      { id: 'chainmail',      name: 'Chainmail',      type: 'armor',      slot: 'chest',    baseDefense: 14, weight: 8, sellValue: 25 },
  robe:           { id: 'robe',           name: 'Robe',           type: 'armor',      slot: 'chest',    baseDefense: 4,  weight: 1, sellValue: 10 },
  round_shield:   { id: 'round_shield',   name: 'Round Shield',   type: 'armor',      slot: 'offhand',  baseDefense: 10, weight: 5, sellValue: 15 },

  // ── Ammo ──
  arrow:          { id: 'arrow',          name: 'Arrow',          type: 'ammo',       slot: 'none', stackSize: 99, sellValue: 1 },
  bolt:           { id: 'bolt',           name: 'Bolt',           type: 'ammo',       slot: 'none', stackSize: 60, sellValue: 1 },

  // ── Consumables ──
  health_potion:  { id: 'health_potion',  name: 'Health Potion',  type: 'consumable', slot: 'none', sellValue: 5 },
  mana_potion:    { id: 'mana_potion',    name: 'Mana Potion',    type: 'consumable', slot: 'none', sellValue: 7 },
  smoke_bomb:     { id: 'smoke_bomb',     name: 'Smoke Bomb',     type: 'consumable', slot: 'none', sellValue: 4 },
  whetstone:      { id: 'whetstone',      name: 'Whetstone',      type: 'consumable', slot: 'none', sellValue: 3 },
  spike_trap:     { id: 'spike_trap',     name: 'Spike Trap',     type: 'consumable', slot: 'none', sellValue: 8 },
  camp_kit:       { id: 'camp_kit',       name: 'Camp Kit',       type: 'consumable', slot: 'none', sellValue: 15 },
  warp_crystal:   { id: 'warp_crystal',   name: 'Warp Crystal',   type: 'consumable', slot: 'none', sellValue: 12 },

  // ── Materials ──
  mana_stone_1:   { id: 'mana_stone_1',   name: 'Lv1 Mana Stone', type: 'material',   slot: 'none', sellValue: 10,  expValue: 50  },
  mana_stone_2:   { id: 'mana_stone_2',   name: 'Lv2 Mana Stone', type: 'material',   slot: 'none', sellValue: 25,  expValue: 150 },
  iron_ore:       { id: 'iron_ore',       name: 'Iron Ore',       type: 'material',   slot: 'none', sellValue: 5 },
  dragon_scale:   { id: 'dragon_scale',   name: 'Dragon Scale',   type: 'material',   slot: 'none', sellValue: 50 },

  // §17 Materials & Runes
  goblin_tooth:   { id: 'goblin_tooth',   name: 'Goblin Tooth',   type: 'material',   slot: 'none', sellValue: 15 },
  drowned_pearl:  { id: 'drowned_pearl',  name: 'Drowned Pearl',  type: 'material',   slot: 'none', sellValue: 25 },
  brood_venom:    { id: 'brood_venom',    name: 'Brood Venom',    type: 'material',   slot: 'none', sellValue: 35 },
  captain_badge:  { id: 'captain_badge',  name: 'Captain Badge',  type: 'material',   slot: 'none', sellValue: 45 },

  rune_str:       { id: 'rune_str',       name: 'Strength Rune',  type: 'material',   slot: 'none', sellValue: 30 },
  rune_vit:       { id: 'rune_vit',       name: 'Vitality Rune',  type: 'material',   slot: 'none', sellValue: 30 },
  rune_int:       { id: 'rune_int',       name: 'Intellect Rune', type: 'material',   slot: 'none', sellValue: 30 },
  rune_lifesteal: { id: 'rune_lifesteal', name: 'Lifesteal Rune', type: 'material',   slot: 'none', sellValue: 50 },

  // ── Bags ──
  adventure_bag:  { id: 'adventure_bag',  name: 'Adventure Bag',  type: 'bag',        slot: 'none', sellValue: 25 },
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
      baseAttack: 5 + tier * 6,
      weight: 2 + Math.floor(tier * 1.2),
      sellValue: tier * 15,
    };
  });
});

// Generate 6 sets × 5 slots = 30 armor items
const armorSets = [
  { id: 'goblin',   name: 'Goblin',   setName: 'goblin',   weight: 3,  def: 2 },
  { id: 'drowned',  name: 'Drowned',  setName: 'drowned',  weight: 4,  def: 3 },
  { id: 'brood',    name: 'Brood',    setName: 'brood',    weight: 2,  def: 2 },
  { id: 'captain',  name: 'Captain',  setName: 'captain',  weight: 6,  def: 5 },
  { id: 'sage',     name: 'Sage',     setName: 'sage',     weight: 1,  def: 1 },
  { id: 'plate',    name: 'Iron',     setName: 'plate',    weight: 8,  def: 6 },
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
