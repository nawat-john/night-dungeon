import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CharacterCreateScene } from './scenes/CharacterCreateScene';
import { TownScene } from './scenes/TownScene';
import { ArmoryScene } from './scenes/ArmoryScene';
import { EmporiumScene } from './scenes/EmporiumScene';
import { InnScene } from './scenes/InnScene';
import { ChapelScene } from './scenes/ChapelScene';
import { DungeonScene } from './scenes/DungeonScene';
import { UIScene } from './scenes/UIScene';
import { FloorTransitionScene } from './scenes/FloorTransitionScene';
import { SagesTowerScene } from './scenes/SagesTowerScene';

// Wait for "Press Start 2P" to finish loading before Phaser creates any text,
// so no frame ever renders with a fallback font.
document.fonts
  .load('16px "Press Start 2P"')
  .catch(() => { /* offline / CDN failure — game still starts with fallback */ })
  .finally(startGame);

function startGame(): void {
  // Patch the text factory so every scene.add.text() call uses the pixel font.
  // Spread style AFTER the defaults so callers can still override fontSize/color.
  // Critically: do NOT set `resolution` here — Phaser's pixelArt mode uses
  // NEAREST texture filtering, so resolution > 1 causes the text canvas to be
  // downsampled with nearest-neighbour, which destroys quality.
  //
  // The pixel font ("Press Start 2P") packs glyphs tightly against the top of
  // the line box and leaves no gap between lines, so multi-line blocks read as
  // cramped. Default a little `lineSpacing` (gap between lines) and top `padding`
  // (margin above the letters) globally. Both sit BEFORE `...style`, so any call
  // that sets its own value still overrides these defaults.
  const origText = Phaser.GameObjects.GameObjectFactory.prototype.text;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Phaser.GameObjects.GameObjectFactory.prototype as any).text = function (
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    return (origText as (...a: unknown[]) => Phaser.GameObjects.Text).call(
      this, x, y, text,
      { fontFamily: '"Press Start 2P"', lineSpacing: 4, padding: { top: 3 }, ...style },
    );
  };

  // RESIZE mode: canvas fills the viewport at native resolution.
  // Gameplay scenes set an integer camera zoom so world pixels stay crisp.
  // No CSS scale-up means no anti-aliasing amplification on any element.
  new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: '#0d0b14',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: [BootScene, PreloadScene, MainMenuScene, CharacterCreateScene,
      TownScene, ArmoryScene, EmporiumScene, InnScene, ChapelScene, SagesTowerScene,
      FloorTransitionScene, DungeonScene, UIScene],
  });
}
