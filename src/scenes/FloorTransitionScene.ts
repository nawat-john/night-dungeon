import Phaser from 'phaser';

export class FloorTransitionScene extends Phaser.Scene {
  private floor = 1;

  constructor() { super('FloorTransitionScene'); }

  init(data: { floor?: number }): void {
    this.floor = data.floor ?? 1;
  }

  create(): void {
    const cx = this.scale.width  / 2;
    const cy = this.scale.height / 2;

    this.cameras.main.setBackgroundColor('#060412');
    this.cameras.main.fadeIn(200, 0, 0, 0);

    const subtitle = this.floor === 1 ? 'ENTERING THE DUNGEON' : 'DESCENDING...';

    const t1 = this.add.text(cx, cy - 32, subtitle, {
      fontSize: '12px', color: '#554477',
    }).setOrigin(0.5).setAlpha(0);

    const t2 = this.add.text(cx, cy + 14, `FLOOR  ${this.floor}`, {
      fontSize: '30px', color: '#ccaaff',
    }).setOrigin(0.5).setAlpha(0);

    // Thin horizontal accent line between the two labels
    const line = this.add.rectangle(cx, cy - 4, 0, 1, 0x554477).setAlpha(0);

    this.tweens.add({ targets: t1,   alpha: 1,             duration: 300, delay:  60 });
    this.tweens.add({ targets: line, alpha: 0.6, width: 200, duration: 450, delay: 100 });
    this.tweens.add({
      targets: t2,
      alpha: 1,
      scaleX: { from: 0.75, to: 1 },
      scaleY: { from: 0.75, to: 1 },
      duration: 450,
      delay: 150,
      ease: 'Back.Out',
    });

    this.time.delayedCall(1900, () => {
      this.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => this.scene.start('DungeonScene'),
      );
      this.cameras.main.fadeOut(350, 0, 0, 0);
    });
  }
}
