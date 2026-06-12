import Phaser from 'phaser';
import { TILE } from '../config';

export type HazardType = 'water' | 'oil' | 'ice' | 'gas' | 'fire';

export class Hazard extends Phaser.GameObjects.Rectangle {
  readonly col: number;
  readonly row: number;
  private _hazardType: HazardType;
  ignited = false;

  get hazardType(): HazardType { return this._hazardType; }

  constructor(scene: Phaser.Scene, col: number, row: number, type: HazardType) {
    let color = 0x3366cc;
    let alpha = 0.4;
    if (type === 'oil') { color = 0x2a1a0a; alpha = 0.7; }
    else if (type === 'ice') { color = 0xaaddff; alpha = 0.5; }
    else if (type === 'gas') { color = 0x55aa66; alpha = 0.35; }
    else if (type === 'fire') { color = 0xff5500; alpha = 0.65; }

    const x = (col + 0.5) * TILE;
    const y = (row + 0.5) * TILE;

    super(scene, x, y, TILE, TILE, color, alpha);
    this.col = col;
    this.row = row;
    this._hazardType = type;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    this.setDepth(1.5);
    if (type === 'fire') {
      scene.tweens.add({
        targets: this,
        fillAlpha: 0.8,
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    }
  }

  ignite(scene: Phaser.Scene): void {
    if (this._hazardType !== 'oil') return;
    this.ignited = true;
    this._hazardType = 'fire';
    this.setFillStyle(0xff4400, 0.7);
    scene.tweens.add({
      targets: this,
      fillAlpha: 0.9,
      duration: 220,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }
}
