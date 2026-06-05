import Phaser from 'phaser';
import { TILE } from '../config';

export class WarpPad extends Phaser.GameObjects.Zone {
  readonly padIndex: number;

  constructor(scene: Phaser.Scene, col: number, row: number, padIndex = 0) {
    super(scene, (col + 0.5) * TILE, (row + 0.5) * TILE, TILE, TILE);
    this.padIndex = padIndex;
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }
}
