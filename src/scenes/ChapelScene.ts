import Phaser from 'phaser';
import { TILE, INTERACT_RANGE, calcZoom, expForLevel } from '../config';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';

const B = 2, F = 7;

// 20 cols × 22 rows — chapel interior
// Rows 0-2: sanctuary (NPC/altar, inaccessible) | Row 3: altar rail | Rows 4-20: nave w/pews | Row 21: south wall+door
const MAP: number[][] = [
  [B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
  [B,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,B],
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

const COLS = 20, ROWS = 22;
const SPAWN_COL = 9, SPAWN_ROW = 19;

interface Interactable {
  col: number; row: number; label: string;
  onInteract: () => void;
  promptSprite?: Phaser.GameObjects.Text;
}

export class ChapelScene extends Phaser.Scene {
  private player!: Player;
  private interactables: Interactable[] = [];
  private activePanel: Phaser.GameObjects.Container | null = null;

  constructor() { super('ChapelScene'); }

  create(): void {
    const save = SaveManager.load();
    if (!save) { this.scene.start('MainMenuScene'); return; }

    this.cameras.main.setBackgroundColor('#06080e');
    this.cameras.main.fadeIn(400, 0, 0, 0);

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
    this.add.text(COLS * TILE / 2, 10, 'CHAPEL OF LIGHT', { fontSize: '9px', color: '#ccaaff' })
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

    // Altar centerpiece in sanctuary
    d('chapel_altar', 9, 1, 5);
    d('chapel_altar', 10, 1, 5);
    // Candles flanking altar
    for (const [tc, tr] of [[3, 1], [16, 1], [5, 2], [14, 2]]) {
      const torch = d('deco_torch', tc as number, tr as number, 5);
      this.tweens.add({ targets: torch, alpha: { from: 0.7, to: 1 }, duration: 220 + Math.random() * 220, yoyo: true, repeat: -1 });
    }
    // Oracle/Priest NPC at altar
    this.add.image(x(9.5), y(1), 'npc_merchant').setDepth(6).setTint(0xccaaff);
    this.add.text(x(9.5), y(0.3), 'ORACLE', { fontSize: '6px', color: '#ccaaff' }).setOrigin(0.5).setDepth(7);

    // Pews — left and right rows throughout nave
    for (let row = 5; row <= 19; row += 3) {
      // Left side pews
      d('chapel_pew', 2, row, 3); d('chapel_pew', 4, row, 3); d('chapel_pew', 6, row, 3);
      // Right side pews
      d('chapel_pew', 13, row, 3); d('chapel_pew', 15, row, 3); d('chapel_pew', 17, row, 3);
    }

    // Central nave aisle — rune markings
    for (let row = 6; row <= 18; row += 4) {
      d('deco_rune', 9, row, 1); d('deco_rune', 10, row, 1);
    }

    // Stained glass windows on side walls (colored glow effects)
    for (let row = 5; row <= 17; row += 4) {
      this.add.rectangle(x(0.5), y(row), TILE, TILE * 2, 0x3333aa, 0.3).setDepth(1);
      this.add.rectangle(x(19.5), y(row), TILE, TILE * 2, 0x883300, 0.3).setDepth(1);
    }

    // Wall torches
    for (const [tc, tr] of [[1, 10], [18, 10], [1, 16], [18, 16]]) {
      const torch = d('deco_torch', tc as number, tr as number, 5);
      this.tweens.add({ targets: torch, alpha: { from: 0.72, to: 1 }, duration: 200 + Math.random() * 300, yoyo: true, repeat: -1 });
    }

    // Graveside offerings near entrance
    d('deco_bones', 8, 20, 2); d('deco_skull', 12, 20, 2);
  }

  private registerInteractables(): void {
    // Altar / Oracle
    this.interactables.push({
      col: 9, row: 4, label: 'Speak with Oracle',
      onInteract: () => this.openChapelPanel(),
    });
    // Exit door
    this.interactables.push({
      col: 9, row: 21, label: 'Exit to Town',
      onInteract: () => {
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.stop('UIScene');
          this.scene.start('TownScene');
        });
        this.cameras.main.fadeOut(400, 0, 0, 0);
      },
    });
  }

  private openChapelPanel(): void {
    const { width: sw, height: sh } = this.cameras.main;
    const cw = Math.min(350, Math.round(sw * 0.48)), ch = Math.min(300, Math.round(sh * 0.56));
    const save = SaveManager.load()!;
    const stone1 = save.inventory.filter(s => s.itemId === 'mana_stone_1').reduce((t, s) => t + s.qty, 0);
    const stone2 = save.inventory.filter(s => s.itemId === 'mana_stone_2').reduce((t, s) => t + s.qty, 0);
    const expNeeded = expForLevel(save.level);

    const c = this.add.container(sw / 2, sh / 2).setDepth(20).setScrollFactor(0);
    c.add(this.add.rectangle(0, 0, cw, ch, 0x06080e, 0.97).setStrokeStyle(1, 0x554488));
    c.add(this.add.text(0, -ch/2+14, 'CHAPEL OF LIGHT', { fontSize: '11px', color: '#ccaaff' }).setOrigin(0.5));
    c.add(this.add.rectangle(0, -ch/2+26, cw-20, 1, 0x332255));
    const lines = [
      `Lv1 Mana Stones: ${stone1}  (sell 10g | 50 EXP each)`,
      `Lv2 Mana Stones: ${stone2}  (sell 25g | 150 EXP each)`,
      '',
      `Level: ${save.level}   EXP: ${save.exp ?? 0} / ${expNeeded}`,
      '',
      '1. Sell all Lv1 Stones',
      '2. Sell all Lv2 Stones',
      '3. Convert all to EXP',
    ];
    lines.forEach((line, i) => {
      c.add(this.add.text(-cw/2+12, -ch/2+36+i*18, line, { fontSize: '9px', color: i > 4 ? '#aaddaa' : '#ccbbee' }));
    });
    c.add(this.add.text(0, ch/2-12, 'Q/Esc: Leave', { fontSize: '9px', color: '#332255' }).setOrigin(0.5));
    this.activePanel = c;

    const handler = (e: KeyboardEvent) => {
      const s = SaveManager.load()!;
      const s1 = s.inventory.filter(x => x.itemId === 'mana_stone_1').reduce((t, x) => t + x.qty, 0);
      const s2 = s.inventory.filter(x => x.itemId === 'mana_stone_2').reduce((t, x) => t + x.qty, 0);
      if (e.key === '1' && s1 > 0) {
        const gold = s1 * 10;
        this.player.addGold(gold); s.gold = this.player.gold;
        s.inventory = s.inventory.filter(x => x.itemId !== 'mana_stone_1');
        SaveManager.write(s);
        this.showToast(`Sold ${s1} Lv1 stones for ${gold}g`);
        c.destroy(); this.activePanel = null; window.removeEventListener('keydown', handler);
        this.openChapelPanel();
      } else if (e.key === '2' && s2 > 0) {
        const gold = s2 * 25;
        this.player.addGold(gold); s.gold = this.player.gold;
        s.inventory = s.inventory.filter(x => x.itemId !== 'mana_stone_2');
        SaveManager.write(s);
        this.showToast(`Sold ${s2} Lv2 stones for ${gold}g`);
        c.destroy(); this.activePanel = null; window.removeEventListener('keydown', handler);
        this.openChapelPanel();
      } else if (e.key === '3' && (s1 + s2) > 0) {
        const gained = s1 * 50 + s2 * 150;
        s.exp = (s.exp ?? 0) + gained;
        s.inventory = s.inventory.filter(x => x.itemId !== 'mana_stone_1' && x.itemId !== 'mana_stone_2');
        let leveled = false;
        while (s.exp >= expForLevel(s.level)) {
          s.exp -= expForLevel(s.level);
          s.level++;
          s.stats.str = Math.ceil(s.stats.str * 1.1); s.stats.dex = Math.ceil(s.stats.dex * 1.1);
          s.stats.int = Math.ceil(s.stats.int * 1.1); s.stats.vit = Math.ceil(s.stats.vit * 1.1);
          s.stats.agi = Math.ceil(s.stats.agi * 1.1);
          s.stats.hp = Math.ceil(s.stats.hp * 1.1) + 5; s.stats.mp = Math.ceil(s.stats.mp * 1.1) + 3;
          s.currentHp = s.stats.hp; s.currentMp = s.stats.mp;
          this.player.maxHp = s.stats.hp; this.player.maxMp = s.stats.mp;
          this.player.heal(s.stats.hp); this.player.restoreMp(s.stats.mp);
          this.player.attackDmg = Math.max(6, s.stats.str * 3 + s.stats.dex);
          leveled = true;
        }
        this.player.exp = s.exp; this.player.level = s.level;
        SaveManager.write(s);
        this.game.events.emit('hud-update', this.player);
        const msg = leveled ? `+${gained} EXP — LEVEL UP! Lv${s.level}!` : `+${gained} EXP`;
        this.showToast(msg);
        if (leveled) this.cameras.main.flash(600, 200, 180, 255, true);
        c.destroy(); this.activePanel = null; window.removeEventListener('keydown', handler);
        this.openChapelPanel();
      } else if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') {
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
