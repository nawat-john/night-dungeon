import { ITEMS } from '../data/items';
import { ItemInstance, Rarity, Affix } from '../types';
import { SaveManager } from '../systems/SaveManager';

export const STACK_MAX = 99; // upgraded stack size for stackable consumables/materials

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function isEquipment(itemId: string): boolean {
  const item = ITEMS[itemId];
  return !!(item && item.slot !== 'none');
}

export function rollRandomRarity(floor = 1): Rarity {
  const r = Math.random() * 100;
  // Floor scaling: shift probabilities slightly towards higher tiers
  const uncommonThresh = Math.max(35, 80 - floor * 2.5);
  const rareThresh     = Math.max(60, 93 - floor * 2.0);
  const epicThresh     = Math.max(80, 98 - floor * 1.5);
  const legendaryThresh= Math.max(90, 99.7 - floor * 0.6);

  if (r < uncommonThresh) return 'common';
  if (r < rareThresh) return 'uncommon';
  if (r < epicThresh) return 'rare';
  if (r < legendaryThresh) return 'epic';
  if (r < 99.9) return 'legendary';
  return 'mythic';
}

export const AFFIX_POOLS = [
  { stat: 'str',        name: 'Strength',       isPercent: false, rangeFlat: [1, 8],   rangePercent: [0, 0],   weaponAllowed: true,  armorAllowed: true },
  { stat: 'dex',        name: 'Dexterity',      isPercent: false, rangeFlat: [1, 8],   rangePercent: [0, 0],   weaponAllowed: true,  armorAllowed: true },
  { stat: 'int',        name: 'Intelligence',   isPercent: false, rangeFlat: [1, 8],   rangePercent: [0, 0],   weaponAllowed: true,  armorAllowed: true },
  { stat: 'vit',        name: 'Vitality',       isPercent: false, rangeFlat: [1, 8],   rangePercent: [0, 0],   weaponAllowed: true,  armorAllowed: true },
  { stat: 'agi',        name: 'Agility',        isPercent: false, rangeFlat: [1, 8],   rangePercent: [0, 0],   weaponAllowed: true,  armorAllowed: true },
  { stat: 'hp',         name: 'Max HP',         isPercent: false, rangeFlat: [5, 40],  rangePercent: [0, 0],   weaponAllowed: false, armorAllowed: true },
  { stat: 'mp',         name: 'Max MP',         isPercent: false, rangeFlat: [3, 20],  rangePercent: [0, 0],   weaponAllowed: false, armorAllowed: true },
  { stat: 'critChance', name: 'Critical Rate',  isPercent: true,  rangeFlat: [0, 0],   rangePercent: [1, 8],   weaponAllowed: true,  armorAllowed: false },
  { stat: 'critDmg',    name: 'Critical Damage',isPercent: true,  rangeFlat: [0, 0],   rangePercent: [5, 25],  weaponAllowed: true,  armorAllowed: false },
  { stat: 'lifesteal',  name: 'Lifesteal',      isPercent: true,  rangeFlat: [0, 0],   rangePercent: [1, 6],   weaponAllowed: true,  armorAllowed: false },
  { stat: 'defense',    name: 'Defense',        isPercent: false, rangeFlat: [2, 15],  rangePercent: [0, 0],   weaponAllowed: false, armorAllowed: true },
  { stat: 'moveSpeed',  name: 'Move Speed',     isPercent: true,  rangeFlat: [0, 0],   rangePercent: [2, 12],  weaponAllowed: false, armorAllowed: true },
];

export function rollRandomAffixes(itemId: string, rarity: Rarity): Affix[] {
  const item = ITEMS[itemId];
  if (!item) return [];
  const isWeapon = item.type === 'weapon';
  const pool = AFFIX_POOLS.filter(a => isWeapon ? a.weaponAllowed : a.armorAllowed);

  const numAffixes = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 }[rarity];
  if (numAffixes === 0) return [];

  // Shuffle pool to pick random distinct stats
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const selected = shuffled.slice(0, Math.min(numAffixes, shuffled.length));
  return selected.map(a => {
    const isPercent = a.isPercent;
    const range = isPercent ? a.rangePercent : a.rangeFlat;
    const value = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    return {
      type: isPercent ? 'percent' as const : 'flat' as const,
      stat: a.stat,
      value
    };
  });
}

export function addToInventory(
  inventory: ItemInstance[],
  itemId: string,
  qty: number,
  rarity?: Rarity,
  affixes?: Affix[]
): void {
  const isEquip = isEquipment(itemId);
  const rarityOrder: Record<Rarity, number> = {
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5
  };
  const itemDef = ITEMS[itemId];

  if (isEquip) {
    // Gear doesn't stack — create unique instances
    for (let i = 0; i < qty; i++) {
      const rolledRarity = rarity ?? rollRandomRarity();
      const rolledAffixes = affixes ?? rollRandomAffixes(itemId, rolledRarity);
      inventory.push({
        id: generateId(),
        itemId,
        qty: 1,
        rarity: rolledRarity,
        affixes: rolledAffixes,
        isJunk: false
      });

      if (itemDef) {
        const save = SaveManager.load();
        if (save) {
          const currentVal = rarityOrder[rolledRarity];
          const prevVal = save.rarestFindRarity ? rarityOrder[save.rarestFindRarity] : -1;
          if (currentVal > prevVal) {
            save.rarestFindRarity = rolledRarity;
            save.rarestFind = `${itemDef.name} (${rolledRarity.toUpperCase()})`;
            SaveManager.write(save);
          }
        }
      }
    }
  } else {
    if (itemDef) {
      const save = SaveManager.load();
      if (save) {
        const currentVal = rarityOrder['common'];
        const prevVal = save.rarestFindRarity ? rarityOrder[save.rarestFindRarity] : -1;
        if (currentVal > prevVal) {
          save.rarestFindRarity = 'common';
          save.rarestFind = `${itemDef.name} (COMMON)`;
          SaveManager.write(save);
        }
      }
    }
    // Stackable items (consumables, materials, ammo)
    let remaining = qty;
    const maxStack = itemDef?.stackSize ?? STACK_MAX;

    for (const stack of inventory) {
      if (stack.itemId === itemId && stack.qty < maxStack) {
        const canAdd = Math.min(remaining, maxStack - stack.qty);
        stack.qty += canAdd;
        remaining -= canAdd;
        if (remaining <= 0) return;
      }
    }
    while (remaining > 0) {
      const addQty = Math.min(remaining, maxStack);
      inventory.push({
        id: itemId, // stackables share id with their itemId for simplicity
        itemId,
        qty: addQty,
        rarity: 'common',
        affixes: [],
        isJunk: false
      });
      remaining -= maxStack;
    }
  }
}

export function removeFromInventory(inventory: ItemInstance[], id: string): void {
  const idx = inventory.findIndex(s => s.id === id);
  if (idx === -1) return;
  if (inventory[idx].qty > 1) {
    inventory[idx].qty--;
  } else {
    inventory.splice(idx, 1);
  }
}

export function countInInventory(inventory: ItemInstance[], itemId: string): number {
  return inventory.filter(s => s.itemId === itemId).reduce((t, s) => t + s.qty, 0);
}

export function sortInventory(inventory: ItemInstance[]): void {
  const rarityOrder: Record<string, number> = {
    mythic: 5,
    legendary: 4,
    epic: 3,
    rare: 2,
    uncommon: 1,
    common: 0
  };

  const typeOrder: Record<string, number> = {
    weapon: 0,
    armor: 1,
    consumable: 2,
    ammo: 3,
    tome: 4,
    material: 5,
    bag: 6
  };

  inventory.sort((a, b) => {
    const itemA = ITEMS[a.itemId];
    const itemB = ITEMS[b.itemId];
    if (!itemA && !itemB) return 0;
    if (!itemA) return 1;
    if (!itemB) return -1;

    // First sort by type
    const typeA = typeOrder[itemA.type] ?? 99;
    const typeB = typeOrder[itemB.type] ?? 99;
    if (typeA !== typeB) return typeA - typeB;

    // Then sort by rarity
    const rarityA = rarityOrder[a.rarity ?? 'common'] ?? 0;
    const rarityB = rarityOrder[b.rarity ?? 'common'] ?? 0;
    if (rarityA !== rarityB) return rarityB - rarityA;

    // Then sort by name
    return itemA.name.localeCompare(itemB.name);
  });
}

