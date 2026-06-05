import Phaser from 'phaser';
import { TILE } from '../config';
import { TrapType } from '../systems/FloorGenerator';

export class Trap {
  readonly col: number;
  readonly row: number;
  readonly type: TrapType;
  readonly sprite: Phaser.GameObjects.Image;
  triggered = false;

  constructor(scene: Phaser.Scene, col: number, row: number, type: TrapType) {
    this.col  = col;
    this.row  = row;
    this.type = type;
    this.sprite = scene.add
      .image((col + 0.5) * TILE, (row + 0.5) * TILE, `trap_${type}`)
      .setAlpha(0)
      .setDepth(1);
  }

  /** Called from DungeonScene.updateFOV() each frame. */
  applyVisibility(visState: number): void {
    if (this.triggered) {
      this.sprite.setAlpha(visState >= 1 ? 1.0 : 0);
    } else {
      this.sprite.setAlpha(visState === 2 ? 0.88 : visState === 1 ? 0.32 : 0);
    }
  }

  /** Switch sprite to the "triggered" variant. */
  markTriggered(): void {
    this.triggered = true;
    this.sprite.setTexture(`trap_${this.type}_hit`).setAlpha(1.0);
  }
}
