export type ItemType = 'weapon' | 'armor' | 'consumable' | 'ammo' | 'tome' | 'material' | 'bag';
export type EquipSlot = 'mainhand' | 'offhand' | 'body' | 'none';
export type AttackType = 'melee' | 'arrow' | 'fireball';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  slot: EquipSlot;
  attackType?: AttackType;
  sellValue?: number;
  expValue?: number;
}

export const ITEMS: Record<string, Item> = {
  short_sword:    { id: 'short_sword',    name: 'Short Sword',    type: 'weapon',     slot: 'mainhand', attackType: 'melee' },
  short_bow:      { id: 'short_bow',      name: 'Short Bow',      type: 'weapon',     slot: 'mainhand', attackType: 'arrow' },
  mace:           { id: 'mace',           name: 'Mace',           type: 'weapon',     slot: 'mainhand', attackType: 'melee' },
  twin_daggers:   { id: 'twin_daggers',   name: 'Twin Daggers',   type: 'weapon',     slot: 'mainhand', attackType: 'melee' },
  staff:          { id: 'staff',          name: 'Staff',          type: 'weapon',     slot: 'mainhand', attackType: 'fireball' },
  leather_armor:  { id: 'leather_armor',  name: 'Leather Armor',  type: 'armor',      slot: 'body' },
  light_leather:  { id: 'light_leather',  name: 'Light Leather',  type: 'armor',      slot: 'body' },
  chainmail:      { id: 'chainmail',      name: 'Chainmail',      type: 'armor',      slot: 'body' },
  robe:           { id: 'robe',           name: 'Robe',           type: 'armor',      slot: 'body' },
  round_shield:   { id: 'round_shield',   name: 'Round Shield',   type: 'armor',      slot: 'offhand' },
  arrow:          { id: 'arrow',          name: 'Arrow',          type: 'ammo',       slot: 'none' },
  health_potion:  { id: 'health_potion',  name: 'Health Potion',  type: 'consumable', slot: 'none' },
  mana_potion:    { id: 'mana_potion',    name: 'Mana Potion',    type: 'consumable', slot: 'none' },
  smoke_bomb:     { id: 'smoke_bomb',     name: 'Smoke Bomb',     type: 'consumable', slot: 'none' },
  fireball_tome:  { id: 'fireball_tome',  name: 'Fireball Tome',  type: 'tome',       slot: 'none' },
  mana_stone_1:   { id: 'mana_stone_1',   name: 'Lv1 Mana Stone', type: 'material',   slot: 'none', sellValue: 10, expValue: 50  },
  mana_stone_2:   { id: 'mana_stone_2',   name: 'Lv2 Mana Stone', type: 'material',   slot: 'none', sellValue: 25, expValue: 150 },
  adventure_bag:  { id: 'adventure_bag',  name: 'Adventure Bag',  type: 'bag',        slot: 'none' },
};
