import Phaser from 'phaser';
import { TILE, INTERACT_RANGE, calcZoom } from '../config';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';
import { CLASSES } from '../data/classes';
import { RACES } from '../data/races';
import { Stats, ItemInstance } from '../types';
import { ITEMS } from '../data/items';
import { countInInventory, isEquipment, rollRandomAffixes, addToInventory } from '../lib/inventory';

const B = 2, F = 7;

// 22 cols × 16 rows — sage's tower interior
const MAP: number[][] = [
  [B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,B,B,B,B,B,B,B,B,B,F,F,B,B,B,B,B,B,B,B,B,B],
];

const COLS = 22, ROWS = 16;
const SPAWN_COL = 10, SPAWN_ROW = 13;

/** Gold cost to respec: escalates with level. */
function respecCost(level: number): number {
  return Math.round(100 * level * level * 0.5);
}

interface Interactable {
  col: number; row: number; label: string;
  onInteract: () => void;
  promptSprite?: Phaser.GameObjects.Text;
}

export class SagesTowerScene extends Phaser.Scene {
  private player!: Player;
  private interactables: Interactable[] = [];
  private activePanel: Phaser.GameObjects.Container | null = null;

  constructor() { super('SagesTowerScene'); }

  create(): void {
    const save = SaveManager.load();
    if (!save) { this.scene.start('MainMenuScene'); return; }

    this.cameras.main.setBackgroundColor('#0c0a18');
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

    this.addFurnishings();

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.game.events.emit('hud-update', this.player);
    this.game.events.emit('floor-update', 0);

    this.registerInteractables();
    this.add.text(COLS * TILE / 2, 6, "SAGE'S TOWER", { fontSize: '9px', color: '#9966cc' })
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
          ia.promptSprite = this.add.text(ix, iy - 28, `E: ${ia.label}`, { fontSize: '8px', color: '#cc88ff' }).setOrigin(0.5).setDepth(10);
        }
        if (eJust) ia.onInteract();
      } else if (ia.promptSprite) { ia.promptSprite.destroy(); ia.promptSprite = undefined; }
    }
  }

  private addFurnishings(): void {
    const x = (c: number) => (c + 0.5) * TILE;
    const y = (r: number) => (r + 0.5) * TILE;

    // Sage NPC behind counter
    this.add.image(x(10), y(2), 'npc_merchant').setDepth(5).setScale(0.9).setTint(0xaa66ff);
    this.add.text(x(10), y(2) - 22, 'THE SAGE', { fontSize: '6px', color: '#cc88ff' }).setOrigin(0.5).setDepth(6);

    // Bookshelves and crystals along walls
    for (const col of [2, 4, 6, 8, 12, 14, 16, 18]) {
      this.add.image(x(col), y(1), 'deco_crystal_b').setDepth(3);
    }

    // Glowing runes on floor
    for (const [rc, rr] of [[5, 8], [10, 10], [16, 7]]) {
      const rune = this.add.image(x(rc as number), y(rr as number), 'deco_rune').setDepth(2).setAlpha(0.6);
      this.tweens.add({ targets: rune, alpha: { from: 0.3, to: 0.8 }, duration: 1200 + Math.random() * 600, yoyo: true, repeat: -1 });
    }

    // Wall torches
    for (const [tc, tr] of [[2, 5], [19, 5], [2, 12], [19, 12]]) {
      const torch = this.add.image(x(tc as number), y(tr as number), 'deco_torch').setDepth(5);
      this.tweens.add({ targets: torch, alpha: { from: 0.75, to: 1 }, duration: 160 + Math.random() * 240, yoyo: true, repeat: -1 });
    }
  }

  private registerInteractables(): void {
    // Sage at counter
    this.interactables.push({
      col: 10, row: 3, label: 'Sage Services',
      onInteract: () => this.openSageServices(),
    });
    // Exit door
    this.interactables.push({
      col: 10, row: 15, label: 'Exit to Town',
      onInteract: () => {
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.stop('UIScene');
          this.scene.start('TownScene');
        });
        this.cameras.main.fadeOut(300, 0, 0, 0);
      },
    });
  }

  private openSageServices(): void {
    let mode: 'main' | 'respec' | 'enchant' | 'socket_item' | 'socket_rune' | 'transmute' = 'main';
    let selectedItemIndex = 0;
    let selectedRuneIndex = 0;

    const { width: sw, height: sh } = this.cameras.main;
    const pw = 320, ph = 260;
    const c = this.add.container(sw / 2, sh / 2).setDepth(20).setScrollFactor(0);
    this.activePanel = c;

    const render = () => {
      c.removeAll(true);
      c.add(this.add.rectangle(0, 0, pw, ph, 0x0c0a1c, 0.97).setStrokeStyle(1, 0x9933cc));
      c.add(this.add.text(0, -ph/2 + 14, "SAGE'S SERVICES", { fontSize: '11px', color: '#bb66ff' }).setOrigin(0.5));
      c.add(this.add.rectangle(0, -ph/2 + 26, pw - 20, 1, 0x551177));

      const save = SaveManager.load()!;

      if (mode === 'main') {
        c.add(this.add.text(0, -ph/2 + 50, 'Choose a service:', { fontSize: '10px', color: '#998bbb' }).setOrigin(0.5));
        const choices = [
          '1. Respec Stats / Skills',
          '2. Enchant Gear (Reroll Affixes)',
          '3. Socket Runes',
          '4. Transmute Materials',
        ];
        choices.forEach((choice, i) => {
          c.add(this.add.text(-60, -ph/2 + 80 + i * 22, choice, { fontSize: '10px', color: '#ccccee' }));
        });
        c.add(this.add.text(0, ph/2-14, 'Q/Esc: Close Menu', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
      }
      else if (mode === 'respec') {
        const cost = respecCost(save.level);
        c.add(this.add.text(0, -ph/2 + 38, '=== TRAINING RESPEC ===', { fontSize: '9px', color: '#9933cc' }).setOrigin(0.5));
        c.add(this.add.text(0, -ph/2 + 58, `Stats/Skills respec cost: ${cost} gold.`, { fontSize: '9px', color: '#ccbbee' }).setOrigin(0.5));
        
        const canAfford = this.player.gold >= cost;
        const btnColor = canAfford ? '#88ffaa' : '#664444';

        c.add(this.add.text(0, -ph/2 + 100, `Press [1] to Respec Stats (Regain ${save.level * 5} pts)`, { fontSize: '9px', color: '#e0c0ff' }).setOrigin(0.5));
        c.add(this.add.text(0, -ph/2 + 130, `Press [2] to Respec Skills (Regain ${Math.max(0, save.level - 1)} pts)`, { fontSize: '9px', color: '#e0c0ff' }).setOrigin(0.5));
        
        c.add(this.add.text(0, ph/2 - 40, `You have: ${this.player.gold}g`, { fontSize: '9px', color: btnColor }).setOrigin(0.5));
        c.add(this.add.text(0, ph/2 - 14, '1/2: Choose Respec   Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
      }
      else if (mode === 'enchant') {
        c.add(this.add.text(0, -ph/2 + 38, '=== ENCHANT GEAR (REROLL AFFIXES) ===', { fontSize: '9px', color: '#9933cc' }).setOrigin(0.5));

        const gearList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (isEquipment(item.itemId)) gearList.push({ source: 'inventory', index: idx, item });
        });
        Object.entries(save.equipped).forEach(([slot, item]) => {
          if (item) gearList.push({ source: 'equipped', slot, item });
        });

        if (gearList.length === 0) {
          c.add(this.add.text(0, 0, 'No gear found to enchant.', { fontSize: '9px', color: '#ff4444' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-14, 'Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
        } else {
          const start = Math.max(0, Math.min(gearList.length - 3, selectedItemIndex - 1));
          const visibleList = gearList.slice(start, start + 3);

          visibleList.forEach((entry, i) => {
            const actualIdx = start + i;
            const active = actualIdx === selectedItemIndex;
            const iy = -ph/2 + 56 + i * 36;

            const name = ITEMS[entry.item.itemId]?.name ?? 'Gear';
            const rank = entry.item.upgradeLevel ? `+${entry.item.upgradeLevel}` : '+0';
            const rarity = (entry.item.rarity ?? 'common').toUpperCase();
            
            c.add(this.add.text(-pw/2+14, iy, 
              `${active ? '> ' : '  '}${name} ${rank} (${rarity})`, 
              { fontSize: '8px', color: active ? '#ffffff' : '#887799' }
            ));

            const affNames = entry.item.affixes && entry.item.affixes.length > 0 
              ? entry.item.affixes.map(a => `${a.stat.toUpperCase()}+${a.value}`).join(', ')
              : 'No affixes';
            c.add(this.add.text(-pw/2+24, iy + 12, affNames, { fontSize: '7px', color: '#998bbb' }));
          });

          const hasGold = save.gold >= 100;
          const currentManaStones = countInInventory(save.inventory, 'mana_stone_1');
          const hasMats = currentManaStones >= 1;

          c.add(this.add.text(0, ph/2-42, `Enchant Cost: 100g & 1x Lv1 Mana Stone`, { fontSize: '8px', color: '#ffdd44' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-30, `You have: ${save.gold}g & ${currentManaStones}x Mana Stones`, { fontSize: '8px', color: (hasGold && hasMats) ? '#88ffaa' : '#ff8888' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-14, 'UP/DOWN: Navigate   ENTER: Reroll Affixes   Q/Esc: Back', { fontSize: '7px', color: '#665577' }).setOrigin(0.5));
        }
      }
      else if (mode === 'socket_item') {
        c.add(this.add.text(0, -ph/2 + 38, '=== CHOOSE GEAR FOR SOCKET ===', { fontSize: '9px', color: '#9933cc' }).setOrigin(0.5));

        const gearList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (isEquipment(item.itemId)) gearList.push({ source: 'inventory', index: idx, item });
        });
        Object.entries(save.equipped).forEach(([slot, item]) => {
          if (item) gearList.push({ source: 'equipped', slot, item });
        });

        if (gearList.length === 0) {
          c.add(this.add.text(0, 0, 'No gear found to socket.', { fontSize: '9px', color: '#ff4444' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-14, 'Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
        } else {
          const start = Math.max(0, Math.min(gearList.length - 3, selectedItemIndex - 1));
          const visibleList = gearList.slice(start, start + 3);

          visibleList.forEach((entry, i) => {
            const actualIdx = start + i;
            const active = actualIdx === selectedItemIndex;
            const iy = -ph/2 + 56 + i * 36;

            const name = ITEMS[entry.item.itemId]?.name ?? 'Gear';
            const maxS = entry.item.maxSockets ?? (entry.item.rarity === 'mythic' ? 3 : entry.item.rarity === 'legendary' ? 2 : 1);
            
            c.add(this.add.text(-pw/2+14, iy, 
              `${active ? '> ' : '  '}${name} (Sockets: ${entry.item.sockets?.length ?? 0}/${maxS})`, 
              { fontSize: '8px', color: active ? '#ffffff' : '#887799' }
            ));

            const socketNames = entry.item.sockets && entry.item.sockets.length > 0 
              ? entry.item.sockets.map(rId => ITEMS[rId]?.name ?? 'Rune').join(' | ')
              : 'Empty';
            c.add(this.add.text(-pw/2+24, iy + 12, `Sockets: [${socketNames}]`, { fontSize: '7px', color: '#998bbb' }));
          });

          c.add(this.add.text(0, ph/2-14, 'UP/DOWN: Navigate   ENTER: Choose   Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
        }
      }
      else if (mode === 'socket_rune') {
        c.add(this.add.text(0, -ph/2 + 38, '=== CHOOSE RUNE TO SOCKET ===', { fontSize: '9px', color: '#9933cc' }).setOrigin(0.5));

        const runesList: { index: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (item.itemId.startsWith('rune_')) {
            runesList.push({ index: idx, item });
          }
        });

        if (runesList.length === 0) {
          c.add(this.add.text(0, 0, 'No runes found in inventory.', { fontSize: '9px', color: '#ff4444' }).setOrigin(0.5));
          c.add(this.add.text(0, ph/2-14, 'Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
        } else {
          runesList.forEach((entry, i) => {
            const active = i === selectedRuneIndex;
            const iy = -ph/2 + 56 + i * 20;

            const name = ITEMS[entry.item.itemId]?.name ?? 'Rune';
            c.add(this.add.text(-pw/2+14, iy, 
              `${active ? '> ' : '  '}${name} (x${entry.item.qty})`, 
              { fontSize: '9px', color: active ? '#ffffff' : '#887799' }
            ));
          });

          c.add(this.add.text(0, ph/2-14, 'UP/DOWN: Navigate   ENTER: Socket Rune   Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
        }
      }
      else if (mode === 'transmute') {
        c.add(this.add.text(0, -ph/2 + 38, '=== TRANSMUTE MATERIALS ===', { fontSize: '9px', color: '#9933cc' }).setOrigin(0.5));

        const oreQty = countInInventory(save.inventory, 'iron_ore');
        const ms1Qty = countInInventory(save.inventory, 'mana_stone_1');

        c.add(this.add.text(-pw/2+20, -ph/2 + 70, `1. Transmute Iron Ore ➔ Dragon Scale`, { fontSize: '9px', color: '#ffffff' }));
        c.add(this.add.text(-pw/2+32, -ph/2 + 84, `Cost: 3x Iron Ore (You have: ${oreQty}) + 50g`, { fontSize: '8px', color: '#998bbb' }));
        c.add(this.add.text(-pw/2+32, -ph/2 + 96, `Chance: 50% success rate`, { fontSize: '8px', color: '#ffaa66' }));

        c.add(this.add.text(-pw/2+20, -ph/2 + 130, `2. Transmute Lv1 Mana Stone ➔ Lv2 Mana Stone`, { fontSize: '9px', color: '#ffffff' }));
        c.add(this.add.text(-pw/2+32, -ph/2 + 144, `Cost: 3x Lv1 Mana Stone (You have: ${ms1Qty}) + 80g`, { fontSize: '8px', color: '#998bbb' }));
        c.add(this.add.text(-pw/2+32, -ph/2 + 156, `Chance: 100% success rate`, { fontSize: '8px', color: '#88ffaa' }));

        c.add(this.add.text(0, ph/2-14, '1 or 2: Transmute   Q/Esc: Back', { fontSize: '8px', color: '#665577' }).setOrigin(0.5));
      }
    };

    render();

    const handler = (e: KeyboardEvent) => {
      const save = SaveManager.load()!;

      if (mode === 'main') {
        if (e.key === '1') { mode = 'respec'; render(); }
        else if (e.key === '2') { mode = 'enchant'; selectedItemIndex = 0; render(); }
        else if (e.key === '3') { mode = 'socket_item'; selectedItemIndex = 0; render(); }
        else if (e.key === '4') { mode = 'transmute'; render(); }
        else if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') {
          c.destroy(); this.activePanel = null; window.removeEventListener('keydown', handler);
        }
      }
      else if (mode === 'respec') {
        const cost = respecCost(save.level);
        const canAfford = this.player.gold >= cost;

        if (e.key === '1' && canAfford) {
          this.doRespecStats(cost);
          mode = 'main';
          render();
        }
        else if (e.key === '2' && canAfford) {
          this.doRespecSkills(cost);
          mode = 'main';
          render();
        }
        else if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'main'; render(); }
      }
      else if (mode === 'enchant') {
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
          const entry = gearList[selectedItemIndex];
          if (entry) {
            const hasGold = save.gold >= 100;
            const currentManaStones = countInInventory(save.inventory, 'mana_stone_1');
            const hasMats = currentManaStones >= 1;

            if (hasGold && hasMats) {
              this.player.addGold(-100);
              save.gold = this.player.gold;
              this.consumeInventoryItem(save.inventory, 'mana_stone_1', 1);

              const item = entry.item;
              const rolledAffixes = rollRandomAffixes(item.itemId, item.rarity ?? 'common');
              item.affixes = rolledAffixes;

              if (entry.source === 'equipped') {
                save.equipped[entry.slot!] = item;
              } else {
                save.inventory[entry.index!] = item;
              }

              this.player.recomputeDerivedStats(save.stats, save.level);
              SaveManager.write(save);
              this.game.events.emit('hud-update', this.player);
              this.showToast('Gear Enchanted: Affixes Rerolled!');
              render();
            } else {
              this.showToast('Insufficient gold or Lv1 Mana Stone!');
            }
          }
        }
        if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'main'; render(); }
      }
      else if (mode === 'socket_item') {
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
          const entry = gearList[selectedItemIndex];
          if (entry) {
            const maxS = entry.item.maxSockets ?? (entry.item.rarity === 'mythic' ? 3 : entry.item.rarity === 'legendary' ? 2 : 1);
            if (!entry.item.sockets) entry.item.sockets = [];
            
            if (entry.item.sockets.length >= maxS) {
              this.showToast('Gear sockets are already full!');
            } else {
              mode = 'socket_rune';
              selectedRuneIndex = 0;
              render();
            }
          }
        }
        if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'main'; render(); }
      }
      else if (mode === 'socket_rune') {
        const runesList: { index: number; item: ItemInstance }[] = [];
        save.inventory.forEach((item, idx) => {
          if (item.itemId.startsWith('rune_')) {
            runesList.push({ index: idx, item });
          }
        });

        if (e.key === 'ArrowUp') {
          if (runesList.length > 0) {
            selectedRuneIndex = (selectedRuneIndex - 1 + runesList.length) % runesList.length;
            render();
          }
        }
        else if (e.key === 'ArrowDown') {
          if (runesList.length > 0) {
            selectedRuneIndex = (selectedRuneIndex + 1) % runesList.length;
            render();
          }
        }
        else if (e.key === 'Enter') {
          const gearList: { source: 'inventory' | 'equipped'; slot?: string; index?: number; item: ItemInstance }[] = [];
          save.inventory.forEach((item, idx) => {
            if (isEquipment(item.itemId)) gearList.push({ source: 'inventory', index: idx, item });
          });
          Object.entries(save.equipped).forEach(([slot, item]) => {
            if (item) gearList.push({ source: 'equipped', slot, item });
          });

          const gearEntry = gearList[selectedItemIndex];
          const runeEntry = runesList[selectedRuneIndex];

          if (gearEntry && runeEntry) {
            const gearItem = gearEntry.item;
            if (!gearItem.sockets) gearItem.sockets = [];
            
            gearItem.sockets.push(runeEntry.item.itemId);
            this.consumeInventoryItem(save.inventory, runeEntry.item.itemId, 1);

            const actualIdx = save.inventory.findIndex(i => i.id === gearItem.id);
            if (actualIdx !== -1) save.inventory[actualIdx] = gearItem;

            this.player.recomputeDerivedStats(save.stats, save.level);
            SaveManager.write(save);
            this.game.events.emit('hud-update', this.player);
            this.showToast('Rune socketed successfully!');
            mode = 'socket_item';
            render();
          }
        }
        if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'socket_item'; render(); }
      }
      else if (mode === 'transmute') {
        const oreQty = countInInventory(save.inventory, 'iron_ore');
        const ms1Qty = countInInventory(save.inventory, 'mana_stone_1');

        if (e.key === '1') {
          if (oreQty >= 3 && save.gold >= 50) {
            this.player.addGold(-50);
            save.gold = this.player.gold;
            this.consumeInventoryItem(save.inventory, 'iron_ore', 3);

            const success = Math.random() < 0.50;
            if (success) {
              addToInventory(save.inventory, 'dragon_scale', 1);
              this.showToast('Transmutation Success: Gained Dragon Scale!');
            } else {
              this.showToast('Transmutation Failed: Ore melted into slag.');
            }
            SaveManager.write(save);
            render();
          } else {
            this.showToast('Need 3x Iron Ore and 50g!');
          }
        }
        else if (e.key === '2') {
          if (ms1Qty >= 3 && save.gold >= 80) {
            this.player.addGold(-80);
            save.gold = this.player.gold;
            this.consumeInventoryItem(save.inventory, 'mana_stone_1', 3);
            
            addToInventory(save.inventory, 'mana_stone_2', 1);
            this.showToast('Transmutation Success: Gained Lv2 Mana Stone!');
            
            SaveManager.write(save);
            render();
          } else {
            this.showToast('Need 3x Lv1 Mana Stone and 80g!');
          }
        }
        if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') { mode = 'main'; render(); }
      }
    };

    window.addEventListener('keydown', handler);
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

  /** §12 — Respec: reset stats to class base + race mods, grant level × 5 free points. */
  private doRespecStats(cost: number): void {
    const save = SaveManager.load();
    if (!save) return;

    // Deduct gold
    this.player.addGold(-cost);

    // Recalculate base stats: classBase + raceModifiers
    const classDef = CLASSES.find(c => c.id === save.clazz);
    const raceDef  = RACES.find(r => r.id === save.race);

    if (!classDef) return;

    const baseStats: Stats = { ...classDef.baseStats };
    if (raceDef) {
      for (const [k, v] of Object.entries(raceDef.modifiers)) {
        if (k in baseStats) {
          (baseStats as unknown as Record<string, number>)[k] += v as number;
        }
      }
    }

    // Grant all level-accumulated stat points back as unspent
    const totalPoints = save.level * 5;
    save.stats = baseStats;
    save.unspentStatPoints = totalPoints;
    save.gold = this.player.gold;

    // Recompute derived stats
    this.player.unspentStatPoints = totalPoints;
    this.player.recomputeDerivedStats(baseStats, save.level);

    // Clamp current HP/MP to new maxima
    this.player.currentHp = Math.min(this.player.currentHp, this.player.maxHp);
    this.player.currentMp = Math.min(this.player.currentMp, this.player.maxMp);
    save.currentHp = this.player.currentHp;
    save.currentMp = this.player.currentMp;

    SaveManager.write(save);
    this.game.events.emit('hud-update', this.player);

    this.showToast(`Respec complete! ${totalPoints} stat points restored.`);
    this.cameras.main.flash(500, 120, 60, 200, true);
  }

  /** §14 — Skills Respec: restore free skill points, clear unlocked skills. */
  private doRespecSkills(cost: number): void {
    const save = SaveManager.load();
    if (!save) return;

    // Deduct gold
    this.player.addGold(-cost);

    // Skills respec: restore free skill points to save.level - 1, clear unlockedSkills array
    const totalSkillPoints = Math.max(0, save.level - 1);
    save.unlockedSkills = [];
    save.unspentSkillPoints = totalSkillPoints;
    save.gold = this.player.gold;

    // Apply back to player object
    this.player.unlockedSkills = [];
    this.player.unspentSkillPoints = totalSkillPoints;
    this.player.skillCooldowns.clear();
    this.player.riposteStanceMs = 0;
    this.player.activeCoating = 'none';
    this.player.bastionModeActive = false;
    this.player.stealthActive = false;
    this.player.activeElement = 'fire';
    this.player.clearTint();

    // Recompute player derived stats (some passives change stats)
    this.player.recomputeDerivedStats(save.stats, save.level);

    // Clamp current HP/MP to new maxima
    this.player.currentHp = Math.min(this.player.currentHp, this.player.maxHp);
    this.player.currentMp = Math.min(this.player.currentMp, this.player.maxMp);
    save.currentHp = this.player.currentHp;
    save.currentMp = this.player.currentMp;

    SaveManager.write(save);
    this.game.events.emit('hud-update', this.player);

    this.showToast(`Skills reset complete! ${totalSkillPoints} skill points restored.`);
    this.cameras.main.flash(500, 120, 60, 200, true);
  }

  private showToast(msg: string): void {
    const t = this.add.text(this.cameras.main.width / 2, 40, msg, { fontSize: '10px', color: '#cc88ff' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(25);
    this.tweens.add({ targets: t, alpha: 0, y: 20, duration: 2000, onComplete: () => t.destroy() });
  }
}
