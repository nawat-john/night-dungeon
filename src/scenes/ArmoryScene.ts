import Phaser from 'phaser';
import { TILE, INTERACT_RANGE, calcZoom } from '../config';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';
import { addToInventory, countInInventory, isEquipment, rollRandomRarity, rollRandomAffixes, generateId } from '../lib/inventory';
import { ITEMS } from '../data/items';
import { ItemInstance } from '../types';

const B = 2, F = 7;

// 20 cols × 14 rows — weapon shop interior
// Row 0: north wall | Rows 1-3: workshop (NPC territory) | Row 4: counter | Rows 5-12: customer floor | Row 13: south wall+door
const MAP: number[][] = [
  [B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,B,B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B,B,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,B,B,B,B,B,B,B,B,B,B,B,B,B,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,B,B,B,B,B,B,B,B,F,F,B,B,B,B,B,B,B,B,B],
];

const COLS = 20, ROWS = 14;
const SPAWN_COL = 9, SPAWN_ROW = 11;

interface Interactable {
  col: number; row: number; label: string;
  onInteract: () => void;
  promptSprite?: Phaser.GameObjects.Text;
}

export class ArmoryScene extends Phaser.Scene {
  private player!: Player;
  private interactables: Interactable[] = [];
  private activePanel: Phaser.GameObjects.Container | null = null;

  constructor() { super('ArmoryScene'); }

  create(): void {
    const save = SaveManager.load();
    if (!save) { this.scene.start('MainMenuScene'); return; }

    this.cameras.main.setBackgroundColor('#0d0b14');
    this.cameras.main.fadeIn(300, 0, 0, 0);

    const map = this.make.tilemap({ data: MAP, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    const layer = map.createLayer(0, tileset, 0, 0)!;
    layer.setCollision([B]);

    const mapW = COLS * TILE, mapH = ROWS * TILE;
    this.physics.world.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBounds(0, 0, mapW, mapH);

    this.player = new Player(this, (SPAWN_COL + 0.5) * TILE, (SPAWN_ROW + 0.5) * TILE);
    this.player.loadFromSave(save);
    this.physics.add.collider(this.player as unknown as Phaser.GameObjects.GameObject, layer);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setZoom(calcZoom(this.scale.width, this.scale.height));
    this.scale.on('resize', () => { this.cameras.main.setZoom(calcZoom(this.scale.width, this.scale.height)); }, this);

    this.addFurniture();

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.game.events.emit('hud-update', this.player);
    this.game.events.emit('floor-update', 0);

    this.registerInteractables();

    // Scene label
    this.add.text(mapW / 2, 10, 'IRONHOLD ARMORY', { fontSize: '9px', color: '#cdd0e0' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(10);
  }

  update(_t: number, delta: number): void {
    if (this.activePanel) return;
    this.player.update(_t, delta);
    const px = this.player.x, py = this.player.y;
    const eJust = Phaser.Input.Keyboard.JustDown(this.player.interactKey);
    for (const ia of this.interactables) {
      const ix = (ia.col + 0.5) * TILE, iy = (ia.row + 0.5) * TILE;
      const dist = Phaser.Math.Distance.Between(px, py, ix, iy);
      if (dist < INTERACT_RANGE) {
        if (!ia.promptSprite) {
          ia.promptSprite = this.add.text(ix, iy - 28, `E: ${ia.label}`, { fontSize: '8px', color: '#ffffaa' }).setOrigin(0.5).setDepth(10);
        }
        if (eJust) ia.onInteract();
      } else if (ia.promptSprite) { ia.promptSprite.destroy(); ia.promptSprite = undefined; }
    }
  }

  private addFurniture(): void {
    const x = (c: number) => (c + 0.5) * TILE;
    const y = (r: number) => (r + 0.5) * TILE;
    const d = (key: string, c: number, r: number, depth = 3) => this.add.image(x(c), y(r), key).setDepth(depth);

    // Weapon racks on north wall (row 2 bump)
    for (const col of [1, 3, 5, 7, 9, 11, 13, 15, 17]) d('armory_rack', col, 2, 4);
    // Forge in NW corner
    d('inn_fireplace', 1, 1, 4);
    d('town_barrel', 17, 1, 3); d('town_barrel', 18, 1, 3);
    // Weapon decos on floor near walls
    d('deco_crystal_b', 1, 5, 2); d('deco_crystal_b', 18, 5, 2);
    // Armorer NPC behind counter
    this.add.image(x(10), y(2), 'npc_merchant').setDepth(5).setFlipX(false);
    // Anvil/forge suggestion
    d('town_crate', 1, 2, 3); d('town_crate', 17, 2, 3);
    // Counter label
    this.add.text(x(9.5), y(3.6), 'ARMORER', { fontSize: '7px', color: '#cdd0e0' }).setOrigin(0.5).setDepth(6);
    // Wall torches
    for (const col of [4, 9, 14]) {
      const torch = d('deco_torch', col, 5, 5);
      this.tweens.add({ targets: torch, alpha: { from: 0.78, to: 1 }, duration: 200 + Math.random() * 200, yoyo: true, repeat: -1 });
    }
    // Scattered items
    d('deco_bones', 8, 10, 1); d('deco_skull', 14, 8, 1);
  }

  private registerInteractables(): void {
    // Shopkeeper counter
    this.interactables.push({
      col: 9, row: 5, label: 'Blacksmith Services',
      onInteract: () => this.openShop(),
    });
    // Exit door
    this.interactables.push({
      col: 9, row: 13, label: 'Exit to Town',
      onInteract: () => {
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.stop('UIScene');
          this.scene.start('TownScene');
        });
        this.cameras.main.fadeOut(300, 0, 0, 0);
      },
    });
  }

  private openShop(): void {
    let mode: 'main' | 'buy' | 'upgrade' | 'upgrade_confirm' | 'forge' | 'repair' | 'infuse' = 'main';
    let selectedItemIndex = 0;
    let infuseWeaponEntry: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance } | null = null;
    
    const { width: sw, height: sh } = this.cameras.main;
    const pw = 320, ph = 260;
    const c = this.add.container(sw / 2, sh / 2).setDepth(20).setScrollFactor(0);
    this.activePanel = c;

    const render = () => {
      c.removeAll(true);
      c.add(this.add.rectangle(0, 0, pw, ph, 0x0e0a18, 0.97).setStrokeStyle(1, 0x9ca0b2));
      c.add(this.add.text(0, -ph/2+14, 'IRONHOLD BLACKSMITH', { fontSize: '11px', color: '#cdd0e0' }).setOrigin(0.5));
      c.add(this.add.rectangle(0, -ph/2+26, pw-20, 1, 0x4a5060));

      const save = SaveManager.load()!;

      if (mode === 'main') {
        c.add(this.add.text(0, -ph/2 + 50, 'Choose a service:', { fontSize: '10px', color: '#998bbb' }).setOrigin(0.5));
        const choices = [
          '1. Buy Equipment',
          '2. Upgrade Weapons/Armor',
          '3. Forge Boss Equipment',
          '4. Repair Equipment',
          '5. Infuse Weapon (Element)',
        ];
        choices.forEach((choice, i) => {
          c.add(this.add.text(-60, -ph/2 + 80 + i * 22, choice, { fontSize: '10px', color: i === 4 ? '#88ccff' : '#ccccee' }));
        });
        c.add(this.add.text(0, ph/2-14, 'Q/Esc: Close Menu', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
      }
      else if (mode === 'buy') {
        c.add(this.add.text(0, -ph/2 + 38, '=== BUY EQUIPMENT ===', { fontSize: '9px', color: '#9ca0b2' }).setOrigin(0.5));
        const items = [
          { name: 'Iron Sword',        cost: 80,  itemId: 'short_sword'   },
          { name: 'Steel Bow',         cost: 100, itemId: 'short_bow'     },
          { name: 'Enchanted Staff',   cost: 120, itemId: 'staff'         },
          { name: 'Chainmail',         cost: 90,  itemId: 'chainmail'     },
          { name: 'Round Shield',      cost: 60,  itemId: 'round_shield'  },
        ];
        items.forEach((item, i) => {
          const iy = -ph/2 + 56 + i * 20;
          c.add(this.add.text(-pw/2+14, iy, `${i+1}. ${item.name}`, { fontSize: '9px', color: '#ccccee' }));
          c.add(this.add.text(pw/2-12, iy, `${item.cost}g`, { fontSize: '9px', color: '#ffdd44' }).setOrigin(1, 0));
        });
        c.add(this.add.text(0, ph/2-28, `Gold: ${save.gold}g`, { fontSize: '9px', color: '#ffdd44' }).setOrigin(0.5));
        c.add(this.add.text(0, ph/2-14, '1-5: Buy   Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
      }
      else if (mode === 'upgrade') {
        c.add(this.add.text(0, -ph/2 + 38, '=== UPGRADE GEAR ===', { fontSize: '9px', color: '#9ca0b2' }).setOrigin(0.5));
        
        const gearList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (isEquipment(item.itemId)) {
            gearList.push({ source: 'inventory', index: idx, item });
          }
        });
        Object.entries(save.equipped).forEach(([slot, item]) => {
          if (item) {
            gearList.push({ source: 'equipped', slot, item });
          }
        });

        if (gearList.length === 0) {
          c.add(this.add.text(0, 0, 'No upgradeable gear found.', { fontSize: '9px', color: '#ff4444' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-14, 'Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
        } else {
          const start = Math.max(0, Math.min(gearList.length - 5, selectedItemIndex - 2));
          const visibleList = gearList.slice(start, start + 5);

          visibleList.forEach((entry, i) => {
            const actualIdx = start + i;
            const active = actualIdx === selectedItemIndex;
            const iy = -ph/2 + 56 + i * 20;

            const name = ITEMS[entry.item.itemId]?.name ?? 'Gear';
            const rank = entry.item.upgradeLevel ? `+${entry.item.upgradeLevel}` : '+0';
            const suffix = entry.item.branch && entry.item.branch !== 'none' ? ` (${entry.item.branch.toUpperCase()})` : '';
            const location = entry.source === 'equipped' ? `(Equipped)` : '';

            c.add(this.add.text(-pw/2+14, iy, 
              `${active ? '> ' : '  '}${name} ${rank}${suffix} ${location}`, 
              { fontSize: '8px', color: active ? '#ffffff' : '#887799' }
            ));
          });

          c.add(this.add.text(0, ph/2-28, 'UP/DOWN: Navigate   ENTER: Select   Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
        }
      }
      else if (mode === 'upgrade_confirm') {
        const gearList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (isEquipment(item.itemId)) gearList.push({ source: 'inventory', index: idx, item });
        });
        Object.entries(save.equipped).forEach(([slot, item]) => {
          if (item) gearList.push({ source: 'equipped', slot, item });
        });

        const entry = gearList[selectedItemIndex];
        if (!entry) { mode = 'upgrade'; render(); return; }

        const item = entry.item;
        const currentRank = item.upgradeLevel ?? 0;
        const nextRank = currentRank + 1;
        const isArmor = ITEMS[item.itemId].type === 'armor';

        c.add(this.add.text(0, -ph/2 + 38, `=== UPGRADE CONFIRM ===`, { fontSize: '9px', color: '#9ca0b2' }).setOrigin(0.5));
        
        const name = ITEMS[item.itemId]?.name ?? 'Gear';
        c.add(this.add.text(0, -ph/2 + 60, `${name}  +${currentRank} ➔ +${nextRank}`, { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5));

        if (currentRank >= 5) {
          c.add(this.add.text(0, 0, 'Gear is already at max upgrade (+5)!', { fontSize: '10px', color: '#ffdd44' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-14, 'Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
        } else {
          let costGold = 0;
          let matId = 'iron_ore';
          let matQty = 0;

          if (currentRank === 0) { costGold = 50; matQty = 1; }
          else if (currentRank === 1) { costGold = 100; matQty = 2; }
          else if (currentRank === 2) { costGold = 150; matQty = 3; }
          else if (currentRank === 3) { costGold = 250; matId = 'dragon_scale'; matQty = 1; }
          else if (currentRank === 4) { costGold = 400; matId = 'dragon_scale'; matQty = 2; }

          const hasGold = save.gold >= costGold;
          const currentMatQty = countInInventory(save.inventory, matId);
          const hasMats = currentMatQty >= matQty;
          const matName = ITEMS[matId]?.name ?? 'Materials';

          if (currentRank === 3 && (!item.branch || item.branch === 'none')) {
            c.add(this.add.text(0, -ph/2 + 90, 'Select Upgrade Path:', { fontSize: '9px', color: '#ffcc44' }).setOrigin(0.5));
            c.add(this.add.text(-pw/2+20, -ph/2 + 115, isArmor ? '1. Heavy: +2 Defense, +2 Weight' : '1. Sharp: +6 Attack, +2 Weight', { fontSize: '8px', color: '#ff8888' }));
            c.add(this.add.text(-pw/2+20, -ph/2 + 135, isArmor ? '2. Light: +1 Defense, -1 Weight'  : '2. Light: +3 Attack, -1 Weight',  { fontSize: '8px', color: '#88ff88' }));

            c.add(this.add.text(0, ph/2-48, `Cost: ${costGold}g & ${matQty}x ${matName}`, { fontSize: '8px', color: '#ccccee' }).setOrigin(0.5));
            c.add(this.add.text(0, ph/2-34, `You have: ${save.gold}g & ${currentMatQty}x ${matName}`, { fontSize: '8px', color: (hasGold && hasMats) ? '#88ffaa' : '#ff8888' }).setOrigin(0.5));
            c.add(this.add.text(0, ph/2-14, '1 or 2: Choose Path & Upgrade   Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
          } else {
            const isSharp = item.branch === 'sharp';
            const statInc = isArmor ? (isSharp ? '+2 Defense' : '+1 Defense') : (isSharp ? '+6 Attack' : '+3 Attack');
            
            c.add(this.add.text(0, -ph/2 + 100, `Benefits: ${statInc}`, { fontSize: '9px', color: '#88ffaa' }).setOrigin(0.5));
            c.add(this.add.text(0, ph/2-48, `Cost: ${costGold}g & ${matQty}x ${matName}`, { fontSize: '8px', color: '#ccccee' }).setOrigin(0.5));
            c.add(this.add.text(0, ph/2-34, `You have: ${save.gold}g & ${currentMatQty}x ${matName}`, { fontSize: '8px', color: (hasGold && hasMats) ? '#88ffaa' : '#ff8888' }).setOrigin(0.5));
            c.add(this.add.text(0, ph/2-14, 'Space/ENTER: Confirm Upgrade   Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
          }
        }
      }
      else if (mode === 'forge') {
        c.add(this.add.text(0, -ph/2 + 38, '=== FORGE BOSS GEAR ===', { fontSize: '9px', color: '#9ca0b2' }).setOrigin(0.5));
        
        const recipes = [
          { id: 'goblin_helm',   name: 'Goblin Helm',      itemId: 'goblin_head',   cost: 50,  matId: 'goblin_tooth',  matQty: 1, ironQty: 2 },
          { id: 'drowned_chest', name: 'Drowned Chest',    itemId: 'drowned_chest', cost: 80,  matId: 'drowned_pearl', matQty: 1, ironQty: 4 },
          { id: 'brood_greaves', name: 'Brood Greaves',    itemId: 'brood_legs',    cost: 70,  matId: 'brood_venom',   matQty: 1, ironQty: 3 },
          { id: 'captain_gs',    name: 'Captain Sword',    itemId: 'greatsword_t4', cost: 120, matId: 'captain_badge', matQty: 1, ironQty: 5 },
        ];

        recipes.forEach((rec, i) => {
          const iy = -ph/2 + 54 + i * 36;
          c.add(this.add.text(-pw/2+14, iy, `${i+1}. ${rec.name}`, { fontSize: '9px', color: '#ffffff' }));
          
          const hasGold = save.gold >= rec.cost;
          const currentBossMat = countInInventory(save.inventory, rec.matId);
          const currentIron = countInInventory(save.inventory, 'iron_ore');
          const hasMats = currentBossMat >= rec.matQty && currentIron >= rec.ironQty;

          const bossMatName = ITEMS[rec.matId]?.name ?? 'Material';
          const line = `Cost: ${rec.cost}g, 1x ${bossMatName} (${currentBossMat}), ${rec.ironQty}x Iron (${currentIron})`;
          c.add(this.add.text(-pw/2+14, iy + 12, line, { 
            fontSize: '7px', 
            color: (hasGold && hasMats) ? '#88ffaa' : '#ff7777' 
          }));
        });

        c.add(this.add.text(0, ph/2-14, '1-4: Forge Equipment   Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
      }
      else if (mode === 'infuse') {
        c.add(this.add.text(0, -ph/2 + 38, '=== INFUSE WEAPON ===', { fontSize: '9px', color: '#88ccff' }).setOrigin(0.5));
        const ELEM_RUNES: { runeId: string; element: string; label: string }[] = [
          { runeId: 'rune_fire',      element: 'fire',      label: 'Fire Rune   → Fire element' },
          { runeId: 'rune_ice',       element: 'ice',       label: 'Ice Rune    → Ice element'  },
          { runeId: 'rune_lightning', element: 'lightning', label: 'Storm Rune  → Lightning'    },
          { runeId: 'rune_poison',    element: 'poison',    label: 'Venom Rune  → Poison'       },
          { runeId: 'rune_void',      element: 'void',      label: 'Void Rune   → Void'         },
          { runeId: 'rune_radiant',   element: 'radiant',   label: 'Radiant Rune→ Radiant'      },
        ];

        if (!infuseWeaponEntry) {
          // Step 1: pick weapon
          const weapList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
          Object.entries(save.equipped).forEach(([slot, item]) => {
            if (item && ITEMS[item.itemId]?.type === 'weapon') weapList.push({ source: 'equipped', slot, item });
          });
          save.inventory.forEach((item, idx) => {
            if (ITEMS[item.itemId]?.type === 'weapon') weapList.push({ source: 'inventory', index: idx, item });
          });

          if (weapList.length === 0) {
            c.add(this.add.text(0, 0, 'No weapons found to infuse.', { fontSize: '9px', color: '#ff4444' }).setOrigin(0.5));
          } else {
            c.add(this.add.text(0, -ph/2 + 52, 'Step 1: Choose weapon to infuse', { fontSize: '8px', color: '#aaddff' }).setOrigin(0.5));
            const start = Math.max(0, Math.min(weapList.length - 4, selectedItemIndex - 2));
            weapList.slice(start, start + 4).forEach((entry, i) => {
              const actualIdx = start + i;
              const active = actualIdx === selectedItemIndex;
              const iy = -ph/2 + 68 + i * 22;
              const name = ITEMS[entry.item.itemId]?.name ?? 'Weapon';
              const current = entry.item.infusedElement ? ` [${entry.item.infusedElement}]` : '';
              const loc = entry.source === 'equipped' ? '(E)' : '';
              c.add(this.add.text(-pw/2+14, iy, `${active ? '>' : ' '} ${name}${current} ${loc}`,
                { fontSize: '8px', color: active ? '#ffffff' : '#887799' }));
            });
          }
          c.add(this.add.text(0, ph/2-14, 'UP/DOWN: Select   ENTER: Pick Weapon   Q/Esc: Back', { fontSize: '7px', color: '#665577' }).setOrigin(0.5));
        } else {
          // Step 2: pick elemental rune
          c.add(this.add.text(0, -ph/2 + 52, `Step 2: Pick rune for: ${ITEMS[infuseWeaponEntry.item.itemId]?.name ?? 'Weapon'}`, { fontSize: '8px', color: '#aaddff' }).setOrigin(0.5));
          c.add(this.add.text(0, -ph/2 + 64, 'Cost: 150g + 1 Rune (consumed)', { fontSize: '7px', color: '#998888' }).setOrigin(0.5));
          ELEM_RUNES.forEach((r, i) => {
            const qty = countInInventory(save.inventory, r.runeId);
            const canAfford = save.gold >= 150 && qty > 0;
            c.add(this.add.text(-pw/2+14, -ph/2 + 82 + i * 20,
              `${i+1}. ${r.label}  (have ${qty})`,
              { fontSize: '8px', color: canAfford ? '#88ffaa' : '#554455' }));
          });
          c.add(this.add.text(0, ph/2-28, `Gold: ${save.gold}g`, { fontSize: '8px', color: '#ffdd44' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-14, '1-6: Infuse   Q/Esc: Back to weapon select', { fontSize: '7px', color: '#665577' }).setOrigin(0.5));
        }
      }
      else if (mode === 'repair') {
        c.add(this.add.text(0, -ph/2 + 38, '=== REPAIR EQUIPMENT ===', { fontSize: '9px', color: '#9ca0b2' }).setOrigin(0.5));

        const damagedList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (isEquipment(item.itemId) && item.durability !== undefined && item.durability < (item.maxDurability ?? 100)) {
            damagedList.push({ source: 'inventory', index: idx, item });
          }
        });
        Object.entries(save.equipped).forEach(([slot, item]) => {
          if (item && item.durability !== undefined && item.durability < (item.maxDurability ?? 100)) {
            damagedList.push({ source: 'equipped', slot, item });
          }
        });

        if (damagedList.length === 0) {
          c.add(this.add.text(0, 0, 'All equipment is in perfect repair!', { fontSize: '9px', color: '#88ffaa' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-14, 'Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
        } else {
          let totalCost = 0;
          damagedList.forEach(entry => {
            const missing = (entry.item.maxDurability ?? 100) - (entry.item.durability ?? 100);
            totalCost += Math.ceil(missing * 2);
          });

          const start = Math.max(0, Math.min(damagedList.length - 4, selectedItemIndex - 1));
          const visibleList = damagedList.slice(start, start + 4);

          visibleList.forEach((entry, i) => {
            const actualIdx = start + i;
            const active = actualIdx === selectedItemIndex;
            const iy = -ph/2 + 56 + i * 22;

            const name = ITEMS[entry.item.itemId]?.name ?? 'Gear';
            const missing = (entry.item.maxDurability ?? 100) - (entry.item.durability ?? 100);
            const cost = Math.ceil(missing * 2);

            c.add(this.add.text(-pw/2+14, iy, 
              `${active ? '> ' : '  '}${name} (${entry.item.durability}/${entry.item.maxDurability ?? 100})`, 
              { fontSize: '8px', color: active ? '#ffffff' : '#887799' }
            ));
            c.add(this.add.text(pw/2-12, iy, `${cost}g`, { fontSize: '8px', color: '#ffdd44' }).setOrigin(1, 0));
          });

          c.add(this.add.text(0, ph/2-40, `Repair All Cost: ${totalCost}g`, { fontSize: '8px', color: '#ffdd44' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-28, 'A: Repair All   UP/DOWN: Navigate   ENTER: Repair   Q/Esc: Back', { fontSize: '7px', color: '#cdd0e0' }).setOrigin(0.5));
        }
      }
    };

    render();

    const handler = (e: KeyboardEvent) => {
      const save = SaveManager.load()!;

      if (mode === 'main') {
        if (e.key === '1') { mode = 'buy'; render(); }
        else if (e.key === '2') { mode = 'upgrade'; selectedItemIndex = 0; render(); }
        else if (e.key === '3') { mode = 'forge'; render(); }
        else if (e.key === '4') { mode = 'repair'; selectedItemIndex = 0; render(); }
        else if (e.key === '5') { mode = 'infuse'; selectedItemIndex = 0; infuseWeaponEntry = null; render(); }
        else if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') {
          c.destroy(); this.activePanel = null; window.removeEventListener('keydown', handler);
        }
      }
      else if (mode === 'buy') {
        const items = [
          { name: 'Iron Sword',        cost: 80,  itemId: 'short_sword'   },
          { name: 'Steel Bow',         cost: 100, itemId: 'short_bow'     },
          { name: 'Enchanted Staff',   cost: 120, itemId: 'staff'         },
          { name: 'Chainmail',         cost: 90,  itemId: 'chainmail'     },
          { name: 'Round Shield',      cost: 60,  itemId: 'round_shield'  },
        ];
        const idx = ['1','2','3','4','5'].indexOf(e.key);
        if (idx >= 0 && idx < items.length) {
          const item = items[idx];
          if (this.player.gold >= item.cost) {
            this.player.addGold(-item.cost);
            save.gold = this.player.gold;
            
            const isEquip = isEquipment(item.itemId);
            if (isEquip) {
              const rolledRarity = rollRandomRarity();
              const rolledAffixes = rollRandomAffixes(item.itemId, rolledRarity);
              save.inventory.push({
                id: generateId(),
                itemId: item.itemId,
                qty: 1,
                rarity: rolledRarity,
                affixes: rolledAffixes,
                durability: 100,
                maxDurability: 100,
                upgradeLevel: 0,
                branch: 'none',
                sockets: [],
                maxSockets: rolledRarity === 'mythic' ? 3 : rolledRarity === 'legendary' ? 2 : 1
              });
            } else {
              addToInventory(save.inventory, item.itemId, 1);
            }
            SaveManager.write(save);
            this.showToast(`Bought: ${item.name}`);
            render();
          } else { this.showToast('Not enough gold!'); }
        }
        if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'main'; render(); }
      }
      else if (mode === 'upgrade') {
        const gearList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (isEquipment(item.itemId)) gearList.push({ source: 'inventory', index: idx, item });
        });
        Object.entries(save.equipped).forEach(([slot, item]) => {
          if (item) gearList.push({ source: 'equipped', slot, item });
        });

        if (e.key === 'ArrowUp') {
          if (gearList.length > 0) {
            selectedItemIndex = (selectedItemIndex - 1 + gearList.length) % gearList.length;
            render();
          }
        }
        else if (e.key === 'ArrowDown') {
          if (gearList.length > 0) {
            selectedItemIndex = (selectedItemIndex + 1) % gearList.length;
            render();
          }
        }
        else if (e.key === 'Enter') {
          if (gearList.length > 0) {
            mode = 'upgrade_confirm';
            render();
          }
        }
        if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'main'; render(); }
      }
      else if (mode === 'upgrade_confirm') {
        const gearList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (isEquipment(item.itemId)) gearList.push({ source: 'inventory', index: idx, item });
        });
        Object.entries(save.equipped).forEach(([slot, item]) => {
          if (item) gearList.push({ source: 'equipped', slot, item });
        });

        const entry = gearList[selectedItemIndex];
        if (!entry) { mode = 'upgrade'; render(); return; }

        const item = entry.item;
        const currentRank = item.upgradeLevel ?? 0;
        
        if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'upgrade'; render(); return; }

        if (currentRank < 5) {
          let costGold = 0;
          let matId = 'iron_ore';
          let matQty = 0;

          if (currentRank === 0) { costGold = 50; matQty = 1; }
          else if (currentRank === 1) { costGold = 100; matQty = 2; }
          else if (currentRank === 2) { costGold = 150; matQty = 3; }
          else if (currentRank === 3) { costGold = 250; matId = 'dragon_scale'; matQty = 1; }
          else if (currentRank === 4) { costGold = 400; matId = 'dragon_scale'; matQty = 2; }

          const hasGold = save.gold >= costGold;
          const currentMatQty = countInInventory(save.inventory, matId);
          const hasMats = currentMatQty >= matQty;

          if (currentRank === 3 && (!item.branch || item.branch === 'none')) {
            if (e.key === '1' && hasGold && hasMats) {
              this.applyUpgrade(entry, costGold, matId, matQty, 'sharp');
              this.showToast('Upgraded: Sharp branch!');
              mode = 'upgrade';
              render();
            }
            else if (e.key === '2' && hasGold && hasMats) {
              this.applyUpgrade(entry, costGold, matId, matQty, 'light');
              this.showToast('Upgraded: Light branch!');
              mode = 'upgrade';
              render();
            }
          } else {
            if ((e.key === ' ' || e.key === 'Enter') && hasGold && hasMats) {
              this.applyUpgrade(entry, costGold, matId, matQty, item.branch ?? 'none');
              this.showToast('Upgrade successful!');
              mode = 'upgrade';
              render();
            }
          }
        }
      }
      else if (mode === 'forge') {
        const recipes = [
          { id: 'goblin_helm',   name: 'Goblin Helm',      itemId: 'goblin_head',   cost: 50,  matId: 'goblin_tooth',  matQty: 1, ironQty: 2 },
          { id: 'drowned_chest', name: 'Drowned Chest',    itemId: 'drowned_chest', cost: 80,  matId: 'drowned_pearl', matQty: 1, ironQty: 4 },
          { id: 'brood_greaves', name: 'Brood Greaves',    itemId: 'brood_legs',    cost: 70,  matId: 'brood_venom',   matQty: 1, ironQty: 3 },
          { id: 'captain_gs',    name: 'Captain Sword',    itemId: 'greatsword_t4', cost: 120, matId: 'captain_badge', matQty: 1, ironQty: 5 },
        ];

        const idx = ['1','2','3','4'].indexOf(e.key);
        if (idx >= 0 && idx < recipes.length) {
          const rec = recipes[idx];
          const hasGold = save.gold >= rec.cost;
          const currentBossMat = countInInventory(save.inventory, rec.matId);
          const currentIron = countInInventory(save.inventory, 'iron_ore');
          const hasMats = currentBossMat >= rec.matQty && currentIron >= rec.ironQty;

          if (hasGold && hasMats) {
            this.player.addGold(-rec.cost);
            save.gold = this.player.gold;
            this.consumeInventoryItem(save.inventory, rec.matId, rec.matQty);
            this.consumeInventoryItem(save.inventory, 'iron_ore', rec.ironQty);

            const rolledRarity = rollRandomRarity();
            const rolledAffixes = rollRandomAffixes(rec.itemId, rolledRarity);
            save.inventory.push({
              id: generateId(),
              itemId: rec.itemId,
              qty: 1,
              rarity: rolledRarity,
              affixes: rolledAffixes,
              durability: 100,
              maxDurability: 100,
              upgradeLevel: 0,
              branch: 'none',
              sockets: [],
              maxSockets: rolledRarity === 'mythic' ? 3 : rolledRarity === 'legendary' ? 2 : 1
            });

            SaveManager.write(save);
            this.showToast(`Forged: ${rec.name}!`);
            render();
          } else {
            this.showToast('Insufficient materials or gold!');
          }
        }
        if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'main'; render(); }
      }
      else if (mode === 'repair') {
        const damagedList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (isEquipment(item.itemId) && item.durability !== undefined && item.durability < (item.maxDurability ?? 100)) {
            damagedList.push({ source: 'inventory', index: idx, item });
          }
        });
        Object.entries(save.equipped).forEach(([slot, item]) => {
          if (item && item.durability !== undefined && item.durability < (item.maxDurability ?? 100)) {
            damagedList.push({ source: 'equipped', slot, item });
          }
        });

        if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'main'; render(); return; }

        if (damagedList.length > 0) {
          if (e.key === 'ArrowUp') {
            selectedItemIndex = (selectedItemIndex - 1 + damagedList.length) % damagedList.length;
            render();
          }
          else if (e.key === 'ArrowDown') {
            selectedItemIndex = (selectedItemIndex + 1) % damagedList.length;
            render();
          }
          else if (e.key === 'a' || e.key === 'A') {
            let totalCost = 0;
            damagedList.forEach(entry => {
              const missing = (entry.item.maxDurability ?? 100) - (entry.item.durability ?? 100);
              totalCost += Math.ceil(missing * 2);
            });

            if (this.player.gold >= totalCost) {
              this.player.addGold(-totalCost);
              save.gold = this.player.gold;
              
              damagedList.forEach(entry => {
                entry.item.durability = entry.item.maxDurability ?? 100;
                if (entry.source === 'equipped') {
                  save.equipped[entry.slot!] = entry.item;
                } else {
                  save.inventory[entry.index!] = entry.item;
                }
              });

              this.player.recomputeDerivedStats(save.stats, save.level);
              SaveManager.write(save);
              this.showToast('All items repaired!');
              selectedItemIndex = 0;
              render();
            } else {
              this.showToast('Not enough gold to Repair All!');
            }
          }
          else if (e.key === 'Enter') {
            const entry = damagedList[selectedItemIndex];
            if (entry) {
              const missing = (entry.item.maxDurability ?? 100) - (entry.item.durability ?? 100);
              const cost = Math.ceil(missing * 2);

              if (this.player.gold >= cost) {
                this.player.addGold(-cost);
                save.gold = this.player.gold;
                entry.item.durability = entry.item.maxDurability ?? 100;

                if (entry.source === 'equipped') {
                  save.equipped[entry.slot!] = entry.item;
                } else {
                  save.inventory[entry.index!] = entry.item;
                }

                this.player.recomputeDerivedStats(save.stats, save.level);
                SaveManager.write(save);
                this.showToast('Item repaired!');
                selectedItemIndex = 0;
                render();
              } else {
                this.showToast('Not enough gold!');
              }
            }
          }
        }
      }
      else if (mode === 'infuse') {
        const ELEM_RUNES: { runeId: string; element: string }[] = [
          { runeId: 'rune_fire',      element: 'fire'      },
          { runeId: 'rune_ice',       element: 'ice'       },
          { runeId: 'rune_lightning', element: 'lightning' },
          { runeId: 'rune_poison',    element: 'poison'    },
          { runeId: 'rune_void',      element: 'void'      },
          { runeId: 'rune_radiant',   element: 'radiant'   },
        ];

        if (!infuseWeaponEntry) {
          // Step 1: select weapon
          const weapList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
          Object.entries(save.equipped).forEach(([slot, item]) => {
            if (item && ITEMS[item.itemId]?.type === 'weapon') weapList.push({ source: 'equipped', slot, item });
          });
          save.inventory.forEach((item, idx) => {
            if (ITEMS[item.itemId]?.type === 'weapon') weapList.push({ source: 'inventory', index: idx, item });
          });

          if (e.key === 'ArrowUp') { selectedItemIndex = Math.max(0, selectedItemIndex - 1); render(); }
          else if (e.key === 'ArrowDown') { selectedItemIndex = Math.min(weapList.length - 1, selectedItemIndex + 1); render(); }
          else if (e.key === 'Enter' && weapList[selectedItemIndex]) {
            infuseWeaponEntry = weapList[selectedItemIndex];
            render();
          }
          else if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'main'; render(); }
        } else {
          // Step 2: select rune
          const idx = ['1','2','3','4','5','6'].indexOf(e.key);
          if (idx >= 0) {
            const rune = ELEM_RUNES[idx];
            if (!rune) return;
            const qty = countInInventory(save.inventory, rune.runeId);
            if (save.gold < 150) { this.showToast('Need 150g!'); return; }
            if (qty < 1) { this.showToast(`Need 1x ${rune.runeId}!`); return; }
            // Apply infusion
            this.player.addGold(-150);
            save.gold = this.player.gold;
            this.consumeInventoryItem(save.inventory, rune.runeId, 1);
            infuseWeaponEntry.item.infusedElement = rune.element as import('../types').Element;
            if (infuseWeaponEntry.source === 'equipped') {
              save.equipped[infuseWeaponEntry.slot!] = infuseWeaponEntry.item;
            } else {
              save.inventory[infuseWeaponEntry.index!] = infuseWeaponEntry.item;
            }
            SaveManager.write(save);
            this.showToast(`Infused with ${rune.element.toUpperCase()}!`);
            infuseWeaponEntry = null;
            mode = 'infuse';
            render();
          }
          if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { infuseWeaponEntry = null; render(); }
        }
      }
    };
    window.addEventListener('keydown', handler);
  }

  private applyUpgrade(
    entry: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance },
    gold: number,
    matId: string,
    matQty: number,
    branch: 'sharp' | 'light' | 'none'
  ): void {
    const save = SaveManager.load()!;
    this.player.addGold(-gold);
    save.gold = this.player.gold;

    this.consumeInventoryItem(save.inventory, matId, matQty);

    const item = entry.item;
    item.upgradeLevel = (item.upgradeLevel ?? 0) + 1;
    item.branch = branch;

    if (entry.source === 'equipped') {
      save.equipped[entry.slot!] = item;
    } else {
      save.inventory[entry.index!] = item;
    }

    this.player.recomputeDerivedStats(save.stats, save.level);
    SaveManager.write(save);
    this.game.events.emit('hud-update', this.player);
  }

  private consumeInventoryItem(inventory: ItemInstance[], itemId: string, qty: number): void {
    let remaining = qty;
    for (let i = inventory.length - 1; i >= 0; i--) {
      if (inventory[i].itemId === itemId) {
        if (inventory[i].qty > remaining) {
          inventory[i].qty -= remaining;
          remaining = 0;
          break;
        } else {
          remaining -= inventory[i].qty;
          inventory.splice(i, 1);
          if (remaining <= 0) break;
        }
      }
    }
  }

  private showToast(msg: string): void {
    const t = this.add.text(this.cameras.main.width/2, 40, msg, { fontSize: '11px', color: '#ffffff' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(25);
    this.tweens.add({ targets: t, alpha: 0, y: 20, duration: 1500, onComplete: () => t.destroy() });
  }
}
