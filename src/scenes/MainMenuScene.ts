import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#0d0b14');

    // Title
    this.add.text(width / 2, height * 0.22, 'NIGHT DUNGEON', {
      fontSize: '22px', color: '#ddaaff',
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.22 + 36, 'DUNGEON CRAWLER', {
      fontSize: '10px', color: '#776699',
    }).setOrigin(0.5);

    const hasSave = SaveManager.hasSave();
    const cx = width / 2;

    this.makeButton(cx, height * 0.52, 'NEW GAME', () => {
      if (hasSave) {
        this.showConfirm('Abandon current run\nand start fresh?', () => {
          SaveManager.wipe();
          this.scene.start('CharacterCreateScene');
        });
      } else {
        this.scene.start('CharacterCreateScene');
      }
    });

    this.makeButton(cx, height * 0.52 + 44, 'CONTINUE', () => {
      const save = SaveManager.load();
      if (!save) return;
      if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
      if (save.location === 'town') {
        this.scene.start('TownScene');
      } else {
        this.scene.start('DungeonScene');
      }
    }, !hasSave);

    this.add.text(cx, height - 14, 'WASD move   Space attack   E interact', {
      fontSize: '9px', color: '#443366',
    }).setOrigin(0.5);
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void, disabled = false): void {
    const color = disabled ? '#443355' : '#8866cc';
    const hover = '#bbaaee';
    const txt = this.add.text(x, y, label, {
      fontSize: '14px', color,
    }).setOrigin(0.5).setInteractive({ useHandCursor: !disabled });

    if (!disabled) {
      txt.on('pointerover',  () => txt.setColor(hover));
      txt.on('pointerout',   () => txt.setColor(color));
      txt.on('pointerdown',  onClick);
    }
  }

  private showConfirm(message: string, onYes: () => void): void {
    const { width, height } = this.cameras.main;
    const bw = width * 0.35;
    const bh = 100;
    const cx = width / 2;
    const cy = height / 2;

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setDepth(10);
    const box = this.add.rectangle(cx, cy, bw, bh, 0x1a1428).setStrokeStyle(1, 0x886699).setDepth(11);
    const msg = this.add.text(cx, cy - 18, message, {
      fontSize: '10px', color: '#ccbbee', align: 'center',
    }).setOrigin(0.5).setDepth(12);
    const yes = this.add.text(cx - 50, cy + 22, 'YES', {
      fontSize: '12px', color: '#ff7777',
    }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });
    const no = this.add.text(cx + 50, cy + 22, 'NO', {
      fontSize: '12px', color: '#77ff77',
    }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });

    const close = () => [overlay, box, msg, yes, no].forEach(o => o.destroy());
    yes.on('pointerdown', () => { close(); onYes(); });
    no.on('pointerdown', close);
  }
}
