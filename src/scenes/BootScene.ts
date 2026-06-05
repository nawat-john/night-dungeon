import Phaser from 'phaser';
import { initSaveManager } from '../systems/SaveManager';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0b14');
    const msg = this.add.text(
      this.scale.width / 2, this.scale.height / 2,
      'CONNECTING...',
      { fontSize: '14px', color: '#443366' },
    ).setOrigin(0.5);

    // Blink the message while waiting
    this.tweens.add({ targets: msg, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    initSaveManager().finally(() => {
      this.scene.start('PreloadScene');
    });
  }
}
