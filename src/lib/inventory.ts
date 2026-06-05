export const STACK_MAX = 8;

export interface ItemStack { itemId: string; qty: number; }

export function addToInventory(inventory: ItemStack[], itemId: string, qty: number): void {
  let remaining = qty;
  for (const stack of inventory) {
    if (stack.itemId === itemId && stack.qty < STACK_MAX) {
      const canAdd = Math.min(remaining, STACK_MAX - stack.qty);
      stack.qty += canAdd;
      remaining -= canAdd;
      if (remaining <= 0) return;
    }
  }
  while (remaining > 0) {
    inventory.push({ itemId, qty: Math.min(remaining, STACK_MAX) });
    remaining -= STACK_MAX;
  }
}

export function removeFromInventory(inventory: ItemStack[], itemId: string): void {
  const idx = inventory.findIndex(s => s.itemId === itemId);
  if (idx === -1) return;
  if (inventory[idx].qty > 1) inventory[idx].qty--;
  else inventory.splice(idx, 1);
}

export function countInInventory(inventory: ItemStack[], itemId: string): number {
  return inventory.filter(s => s.itemId === itemId).reduce((t, s) => t + s.qty, 0);
}
