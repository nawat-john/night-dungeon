import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS } from '../config';
import { Player } from '../entities/Player';

// Tile indices: 1 = floor, 2 = wall
const FLOOR = 1;
const WALL  = 2;

export class PlayScene extends Phaser.Scene {
  private player!: Player;

  constructor() {
    super('PlayScene');
  }

  create(): void {
    const mapData = this.buildMapData();
    const map = this.make.tilemap({ data: mapData, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    if (!tileset) throw new Error('Tileset not found in texture cache');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Failed to create tilemap layer');
    layer.setCollision([WALL]);

    const startX = Math.floor(MAP_COLS / 2) * TILE + TILE / 2;
    const startY = Math.floor(MAP_ROWS / 2) * TILE + TILE / 2;
    this.player = new Player(this, startX, startY);

    this.physics.add.collider(this.player, layer);

    const mapW = MAP_COLS * TILE;
    const mapH = MAP_ROWS * TILE;
    this.physics.world.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(this.player, true);
  }

  update(time: number, delta: number): void {
    this.player.update(time, delta);
  }

  private buildMapData(): number[][] {
    return Array.from({ length: MAP_ROWS }, (_, y) =>
      Array.from({ length: MAP_COLS }, (_, x) =>
        x === 0 || x === MAP_COLS - 1 || y === 0 || y === MAP_ROWS - 1 ? WALL : FLOOR
      )
    );
  }
}
