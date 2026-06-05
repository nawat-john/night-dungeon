import Phaser from 'phaser';
import { TILE, INTERACT_RANGE, INN_COST, calcZoom } from '../config';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';

const B = 2, F = 7;

// 26 cols × 18 rows — inn interior
// Rows 0-1: storage (blocked) | Row 2: bar counter | Rows 3-16: common room | Row 17: south wall+door
const MAP: number[][] = [
  [B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,B,B,B,B,B,B,B,B,B,B,B,F,F,B,B,B,B,B,B,B,B,B,B,B,B],
];

const COLS = 26, ROWS = 18;
const SPAWN_COL = 12, SPAWN_ROW = 15;

interface Interactable {
  col: number; row: number; label: string;
  onInteract: () => void;
  promptSprite?: Phaser.GameObjects.Text;
}

export class InnScene extends Phaser.Scene {
  private player!: Player;
  private interactables: Interactable[] = [];
  private activePanel: Phaser.GameObjects.Container | null = null;

  constructor() { super('InnScene'); }

  create(): void {
    const save = SaveManager.load();
    if (!save) { this.scene.start('MainMenuScene'); return; }

    this.cameras.main.setBackgroundColor('#100c1c');
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
    this.add.text(COLS * TILE / 2, 10, 'THE LAST INN', { fontSize: '9px', color: '#d6ae4a' })
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

    // Barrels and bottles behind bar (row 1)
    for (const col of [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]) d('town_barrel', col, 1, 3);
    // Innkeeper NPC behind bar
    this.add.image(x(13), y(1), 'npc_citizen').setDepth(5);
    this.add.text(x(13), y(1) - 20, 'INNKEEPER', { fontSize: '6px', color: '#d6ae4a' }).setOrigin(0.5).setDepth(6);

    // Fireplace NE corner
    const fire = d('inn_fireplace', 23, 4, 4);
    this.tweens.add({ targets: fire, alpha: { from: 0.85, to: 1 }, duration: 300, yoyo: true, repeat: -1 });
    d('deco_campfire', 23, 5, 2);

    // Tables and benches in common room
    for (const [tc, tr] of [[5, 6], [5, 10], [5, 14], [13, 6], [13, 10], [13, 14], [20, 6], [20, 10]]) {
      d('inn_table', tc as number, tr as number, 2);
      // Chairs around table
      d('town_bench', (tc as number) - 1, (tr as number), 2);
      d('town_bench', (tc as number) + 1, (tr as number), 2);
    }

    // Wall torches
    for (const [tc, tr] of [[2, 4], [24, 4], [2, 10], [24, 10], [2, 15], [24, 15]]) {
      const torch = d('deco_torch', tc as number, tr as number, 5);
      this.tweens.add({ targets: torch, alpha: { from: 0.75, to: 1 }, duration: 180 + Math.random() * 240, yoyo: true, repeat: -1 });
    }

    // Mood lighting - rune on floor
    d('deco_rune', 13, 12, 1);

    // Notice board on west wall
    d('town_notice', 1, 8, 4);

    // Ambient NPC citizens sitting
    this.add.image(x(6), y(6), 'npc_citizen').setDepth(4).setScale(0.8);
    this.add.image(x(14), y(10), 'npc_citizen').setDepth(4).setScale(0.8).setFlipX(true);
    this.add.image(x(20), y(14), 'npc_guard').setDepth(4).setScale(0.8);
  }

  private registerInteractables(): void {
    // Bar / innkeeper
    this.interactables.push({
      col: 12, row: 3, label: 'Rest Here',
      onInteract: () => this.openInn(),
    });
    // Exit door
    this.interactables.push({
      col: 12, row: 17, label: 'Exit to Town',
      onInteract: () => {
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.stop('UIScene');
          this.scene.start('TownScene');
        });
        this.cameras.main.fadeOut(300, 0, 0, 0);
      },
    });
  }

  private openInn(): void {
    const { width: sw, height: sh } = this.cameras.main;
    const iw = Math.min(280, Math.round(sw * 0.38)), ih = Math.min(200, Math.round(sh * 0.38));
    const c = this.add.container(sw / 2, sh / 2).setDepth(20).setScrollFactor(0);
    c.add(this.add.rectangle(0, 0, iw, ih, 0x0e0a18, 0.97).setStrokeStyle(1, 0x886644));
    c.add(this.add.text(0, -ih/2+14, 'THE LAST INN', { fontSize: '11px', color: '#d6ae4a' }).setOrigin(0.5));
    c.add(this.add.rectangle(0, -ih/2+26, iw-20, 1, 0x443322));
    c.add(this.add.text(0, 0,
      `Rest well, adventurer.\nFull HP & MP restored.\n\nCost: ${INN_COST} gold`,
      { fontSize: '10px', color: '#ccbbee', align: 'center' }).setOrigin(0.5));
    c.add(this.add.text(0, ih/2-12, 'R: Rest   Q/Esc: Leave', { fontSize: '9px', color: '#443322' }).setOrigin(0.5));
    this.activePanel = c;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (this.player.gold >= INN_COST) {
          this.player.addGold(-INN_COST);
          this.player.heal(this.player.maxHp);
          this.player.restoreMp(this.player.maxMp);
          const s = SaveManager.load()!;
          s.currentHp = this.player.currentHp; s.currentMp = this.player.currentMp; s.gold = this.player.gold;
          SaveManager.write(s);
          this.cameras.main.flash(400, 255, 220, 100, true);
          this.showToast('Fully rested! Sleep well.');
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
