import Phaser from 'phaser';
import { TILE, INTERACT_RANGE, calcZoom } from '../config';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';
import { addToInventory } from '../lib/inventory';

const B = 2, F = 7;

// 20 cols × 14 rows — potion shop interior
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

export class EmporiumScene extends Phaser.Scene {
  private player!: Player;
  private interactables: Interactable[] = [];
  private activePanel: Phaser.GameObjects.Container | null = null;

  constructor() { super('EmporiumScene'); }

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
    this.add.text(COLS * TILE / 2, 10, 'THE EMPORIUM', { fontSize: '9px', color: '#88aaff' })
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

    // Potion shelves on north wall
    for (const col of [1, 3, 5, 7, 9, 11, 13, 15, 17]) d('shelf_potions', col, 2, 4);
    // Ingredient storage east/west
    d('town_barrel', 1, 1, 3); d('town_barrel', 18, 1, 3);
    d('deco_urn', 17, 2, 3); d('deco_urn', 2, 2, 3);
    // Merchant NPC behind counter
    this.add.image(x(10), y(2), 'npc_merchant').setDepth(5).setFlipX(true);
    // Glowing potions scattered on floor
    d('deco_mushroom_b', 3, 7, 2); d('deco_mushroom_g', 16, 9, 2);
    d('deco_mushroom_b', 8, 11, 2); d('deco_mushroom_g', 13, 10, 2);
    // Display table in center floor
    d('inn_table', 9, 8, 2); d('inn_table', 11, 8, 2);
    // Colorful glow effect
    d('deco_rune', 9, 8, 1); d('deco_rune', 11, 8, 1);
    // Counter label
    this.add.text(x(9.5), y(3.6), 'MERCHANT', { fontSize: '7px', color: '#88aaff' }).setOrigin(0.5).setDepth(6);
    // Blue-tinted torches
    for (const col of [4, 9, 14]) {
      const torch = d('deco_torch', col, 5, 5);
      this.tweens.add({ targets: torch, alpha: { from: 0.7, to: 1 }, duration: 250 + Math.random() * 200, yoyo: true, repeat: -1 });
    }
  }

  private registerInteractables(): void {
    this.interactables.push({
      col: 9, row: 5, label: 'Browse Goods',
      onInteract: () => this.openShop(),
    });
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
    const items = [
      { name: 'Health Potion',  cost: 15, itemId: 'health_potion'  },
      { name: 'Mana Potion',    cost: 20, itemId: 'mana_potion'    },
      { name: 'Smoke Bomb',     cost: 10, itemId: 'smoke_bomb'     },
      { name: 'Adventure Bag',  cost: 50, itemId: 'adventure_bag'  },
      { name: 'Arrows (×20)',   cost: 12, itemId: 'arrow'          },
    ];
    const { width: sw, height: sh } = this.cameras.main;
    const pw = Math.min(310, Math.round(sw * 0.42)), ph = Math.min(260, Math.round(sh * 0.52));
    const c = this.add.container(sw / 2, sh / 2).setDepth(20).setScrollFactor(0);
    c.add(this.add.rectangle(0, 0, pw, ph, 0x0a0c1e, 0.97).setStrokeStyle(1, 0x3355aa));
    c.add(this.add.text(0, -ph/2+14, 'THE EMPORIUM', { fontSize: '11px', color: '#88aaff' }).setOrigin(0.5));
    c.add(this.add.rectangle(0, -ph/2+26, pw-20, 1, 0x223366));
    items.forEach((item, i) => {
      const iy = -ph/2 + 44 + i * 22;
      c.add(this.add.text(-pw/2+14, iy, `${i+1}. ${item.name}`, { fontSize: '10px', color: '#ccccee' }));
      c.add(this.add.text(pw/2-12, iy, `${item.cost}g`, { fontSize: '10px', color: '#ffdd44' }).setOrigin(1, 0));
    });
    c.add(this.add.text(0, ph/2-12, '1–5: Buy   Q/Esc: Close', { fontSize: '8px', color: '#223355' }).setOrigin(0.5));
    this.activePanel = c;
    const handler = (e: KeyboardEvent) => {
      const idx = ['1','2','3','4','5'].indexOf(e.key);
      if (idx >= 0 && idx < items.length) {
        const item = items[idx];
        if (this.player.gold >= item.cost) {
          this.player.addGold(-item.cost);
          const s = SaveManager.load()!;
          s.gold = this.player.gold;
          if (item.itemId === 'adventure_bag') {
            if (!s.hasBag) { s.hasBag = true; this.showToast('Adventure Bag! Inventory unlocked.'); }
            else { this.player.addGold(item.cost); this.showToast('Already have a bag.'); }
          } else {
            const qty = item.itemId === 'arrow' ? 20 : 1;
            addToInventory(s.inventory, item.itemId, qty);
            this.showToast(`Bought: ${item.name}`);
          }
          SaveManager.write(s);
        } else { this.showToast('Not enough gold!'); }
      }
      if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') {
        c.destroy(); this.activePanel = null; window.removeEventListener('keydown', handler);
      }
    };
    window.addEventListener('keydown', handler);
  }

  private showToast(msg: string): void {
    const t = this.add.text(this.cameras.main.width/2, 40, msg, { fontSize: '11px', color: '#ffffff' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(25);
    this.tweens.add({ targets: t, alpha: 0, y: 20, duration: 1500, onComplete: () => t.destroy() });
  }
}
