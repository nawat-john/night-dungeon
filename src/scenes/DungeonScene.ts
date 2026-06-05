import Phaser from 'phaser';
import {
  TILE, calcZoom, FOV_RADIUS,
  TRAP_SPIKE_DMG, TRAP_ALARM_RADIUS,
  AMBIENT_SPAWN_INTERVAL, AMBIENT_SPAWN_MIN_DIST, AMBIENT_SPAWN_MAX_DIST,
} from '../config';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { WarpPad } from '../entities/WarpPad';
import { Trap } from '../entities/Trap';
import {
  generateFloor, T_WALL, T_WARP, T_PILLAR,
  T_FLOOR_FOREST, T_FLOOR_DEAD, T_FLOOR_POND, T_FLOOR_ROCK,
  FloorData,
} from '../systems/FloorGenerator';

function mkDecoRng(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
import { computeFOV } from '../systems/Fov';
import { SaveManager } from '../systems/SaveManager';
import { goblinDefs, caveDefs, getThemeDefs, EnemyDef, EnemyTheme } from '../data/enemies';
import { ITEMS } from '../data/items';
import { addToInventory } from '../lib/inventory';

const VIS_HIDDEN   = 0;
const VIS_EXPLORED = 1;
const VIS_VISIBLE  = 2;

const NEAR_WARP_TILES = 30;

export class DungeonScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private warpPads: WarpPad[] = [];
  private traps: Trap[] = [];
  private warping = false;
  private floor = 1;
  private seed = 0;

  private tiles: number[][] = [];
  private visibility!: Uint8Array;
  private mapCols = 0;
  private mapRows = 0;
  private mapLayer!: Phaser.Tilemaps.TilemapLayer;
  private prevVisSet = new Set<number>();

  private ambientTimer = 0;
  private floorData!: FloorData;
  private openedChests = new Set<string>();
  private inventoryPanel: Phaser.GameObjects.Container | null = null;
  private inventoryKey!: Phaser.Input.Keyboard.Key;

  constructor() { super('DungeonScene'); }

  create(): void {
    this.warping      = false;
    this.ambientTimer = 0;
    this.inventoryPanel = null;

    const save = SaveManager.load();
    if (!save) { this.scene.start('MainMenuScene'); return; }

    this.floor = save.dungeonFloor;
    this.seed  = save.floorSeed;

    this.floorData = generateFloor(this.seed, this.floor);
    const { tiles, warpPositions, trapPositions, entryPoints } = this.floorData;
    this.tiles   = tiles;
    this.mapCols = tiles[0].length;
    this.mapRows = tiles.length;

    this.visibility = new Uint8Array(this.mapCols * this.mapRows).fill(VIS_HIDDEN);

    // ── Tilemap ───────────────────────────────────────────────────────────────
    const map = this.make.tilemap({ data: tiles, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    if (!tileset) throw new Error('Tileset not found');
    this.mapLayer = map.createLayer(0, tileset, 0, 0)!;
    if (!this.mapLayer) throw new Error('Layer failed');
    this.mapLayer.setCollision([T_WALL, T_PILLAR]);
    this.mapLayer.forEachTile(t => { t.setAlpha(0); });

    // ── Spawn point ───────────────────────────────────────────────────────────
    let spawnCol = this.floorData.spawnCol;
    let spawnRow = this.floorData.spawnRow;
    if (this.floor === 2 && entryPoints && entryPoints.length > 0) {
      const idx = save.lastWarpIndex ?? 0;
      const entry = entryPoints[Math.min(idx, entryPoints.length - 1)];
      spawnCol = entry.col;
      spawnRow = entry.row;
    }

    // ── Player ────────────────────────────────────────────────────────────────
    const px = (spawnCol + 0.5) * TILE, py = (spawnRow + 0.5) * TILE;
    this.player = new Player(this, px, py);
    this.player.loadFromSave(save);
    this.player.on('died', this.onPlayerDied, this);
    this.physics.add.collider(this.player as unknown as Phaser.GameObjects.GameObject, this.mapLayer);

    const mapW = this.mapCols * TILE, mapH = this.mapRows * TILE;
    this.physics.world.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setZoom(calcZoom(this.scale.width, this.scale.height));
    this.scale.on('resize', () => {
      this.cameras.main.setZoom(calcZoom(this.scale.width, this.scale.height));
    }, this);

    // ── Warp pads ─────────────────────────────────────────────────────────────
    this.warpPads = warpPositions.map((wp, i) => new WarpPad(this, wp.col, wp.row, i));

    // ── Traps ─────────────────────────────────────────────────────────────────
    this.traps = trapPositions.map(tp => new Trap(this, tp.col, tp.row, tp.type));

    // ── Enemy spawning ────────────────────────────────────────────────────────
    this.enemies = this.physics.add.group();
    const floorCells = this.collectFloorCells(tiles);
    if (this.floor === 2) {
      this.populateFloor2Enemies();
    } else {
      this.populateEnemies(floorCells, spawnCol, spawnRow);
    }

    this.physics.add.collider(this.enemies, this.mapLayer);
    this.physics.add.collider(this.enemies, this.enemies);

    // ── Environment decorations + chests ─────────────────────────────────────
    this.placeDecorations();
    this.placeChests();

    // ── UI & keys ─────────────────────────────────────────────────────────────
    this.inventoryKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.game.events.emit('hud-update', this.player);
    this.game.events.emit('floor-update', this.floor);

    this.add.text(this.scale.width / 2, 14, `FLOOR ${this.floor}`, {
      fontSize: '14px', color: '#776699',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);
  }

  update(time: number, delta: number): void {
    if (this.warping) return;
    this.player.update(time, delta);
    this.updateFOV();

    if (Phaser.Input.Keyboard.JustDown(this.inventoryKey)) this.toggleInventory();
    this.checkChestInteract();

    if (this.player.pollAttack()) this.handleAttack();

    const playerIsMoving = this.player.isMoving;
    for (const child of this.enemies.getChildren()) {
      (child as unknown as Enemy).update(time, delta, this.player, playerIsMoving);
    }

    for (const trap of this.traps) {
      if (trap.triggered) continue;
      if (Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        (trap.col + 0.5) * TILE, (trap.row + 0.5) * TILE,
      ) < TILE * 0.65) this.triggerTrap(trap);
    }

    for (let i = 0; i < this.warpPads.length; i++) {
      const wp = this.warpPads[i];
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, wp.x, wp.y) < TILE * 0.7) {
        this.doWarp(wp.padIndex); break;
      }
    }

    this.ambientTimer += delta;
    if (this.ambientTimer >= AMBIENT_SPAWN_INTERVAL) {
      this.ambientTimer = 0;
      this.doAmbientSpawn();
    }
  }

  // ── FOV ───────────────────────────────────────────────────────────────────────
  private updateFOV(): void {
    const px = Math.floor(this.player.x / TILE);
    const py = Math.floor(this.player.y / TILE);

    const newVis = new Set<number>();
    computeFOV(this.tiles, this.mapCols, this.mapRows, px, py, FOV_RADIUS, (col, row) => {
      newVis.add(row * this.mapCols + col);
    });

    for (const idx of this.prevVisSet) {
      if (!newVis.has(idx)) {
        this.visibility[idx] = VIS_EXPLORED;
        const tile = this.mapLayer.getTileAt(idx % this.mapCols, Math.floor(idx / this.mapCols));
        if (tile) tile.setAlpha(0.38);
      }
    }
    for (const idx of newVis) {
      if (this.visibility[idx] !== VIS_VISIBLE) {
        this.visibility[idx] = VIS_VISIBLE;
        const tile = this.mapLayer.getTileAt(idx % this.mapCols, Math.floor(idx / this.mapCols));
        if (tile) tile.setAlpha(1.0);
      }
    }
    this.prevVisSet = newVis;

    for (const child of this.enemies.getChildren()) {
      const e   = child as unknown as Enemy;
      const col = Math.floor(e.x / TILE);
      const row = Math.floor(e.y / TILE);
      if (col >= 0 && row >= 0 && col < this.mapCols && row < this.mapRows)
        e.setVisible(this.visibility[row * this.mapCols + col] === VIS_VISIBLE);
    }
    for (const trap of this.traps) {
      trap.applyVisibility(this.visibility[trap.row * this.mapCols + trap.col]);
    }
  }

  // ── Ambient spawning ──────────────────────────────────────────────────────────
  private doAmbientSpawn(): void {
    const px = Math.floor(this.player.x / TILE);
    const py = Math.floor(this.player.y / TILE);
    const minD = AMBIENT_SPAWN_MIN_DIST, maxD = AMBIENT_SPAWN_MAX_DIST;
    const min2 = minD * minD, max2 = maxD * maxD;

    const candidates: { col: number; row: number }[] = [];
    for (let dy = -maxD; dy <= maxD; dy++) {
      for (let dx = -maxD; dx <= maxD; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 < min2 || d2 > max2) continue;
        const col = px + dx, row = py + dy;
        if (col < 1 || row < 1 || col >= this.mapCols - 1 || row >= this.mapRows - 1) continue;
        const t = this.tiles[row][col];
        if (t === T_WALL || t === T_PILLAR) continue;
        if (this.visibility[row * this.mapCols + col] === VIS_VISIBLE) continue;
        candidates.push({ col, row });
      }
    }
    if (candidates.length === 0) return;

    const count = Math.random() < 0.25 ? 3 : Math.random() < 0.55 ? 2 : 1;
    const defs  = this.getAmbientDefs();

    for (let i = 0; i < count; i++) {
      const cell = candidates[Phaser.Math.Between(0, candidates.length - 1)];
      const def  = defs[Phaser.Math.Between(0, defs.length - 1)];
      this.spawnOneEnemy(def, cell.col, cell.row);
    }
  }

  private getAmbientDefs(): EnemyDef[] {
    if (this.floor === 2) {
      // Spawn based on which area we're in
      const px = Math.floor(this.player.x / TILE);
      const py = Math.floor(this.player.y / TILE);
      const theme = this.themeAtTile(px, py);
      if (theme) return getThemeDefs(theme);
      return getThemeDefs('forest');
    }
    if (goblinDefs().length > 0 && this.floor <= 3) return goblinDefs();
    return [...goblinDefs(), ...caveDefs(this.floor)];
  }

  private themeAtTile(col: number, row: number): EnemyTheme | null {
    if (!this.floorData.areaThemes) return null;
    for (const a of this.floorData.areaThemes) {
      if (col >= a.region.x && col < a.region.x + a.region.w &&
          row >= a.region.y && row < a.region.y + a.region.h) {
        return a.theme;
      }
    }
    return null;
  }

  // ── Floor 1 enemy population ──────────────────────────────────────────────────
  private populateEnemies(
    floorCells: { col: number; row: number }[],
    spawnCol: number, spawnRow: number,
  ): void {
    const gDefs = goblinDefs();
    const cDefs = caveDefs(this.floor);

    const warpTiles = this.warpPads.map(wp => ({ col: Math.floor(wp.x / TILE), row: Math.floor(wp.y / TILE) }));
    const nearSet   = new Set<number>();
    for (const wt of warpTiles) {
      for (let dy = -NEAR_WARP_TILES; dy <= NEAR_WARP_TILES; dy++) {
        for (let dx = -NEAR_WARP_TILES; dx <= NEAR_WARP_TILES; dx++) {
          if (dx*dx + dy*dy > NEAR_WARP_TILES*NEAR_WARP_TILES) continue;
          const nc = wt.col + dx, nr = wt.row + dy;
          if (nc >= 0 && nr >= 0 && nc < this.mapCols && nr < this.mapRows)
            nearSet.add(nr * this.mapCols + nc);
        }
      }
    }

    const near: { col: number; row: number }[] = [];
    const far:  { col: number; row: number }[] = [];
    for (const c of floorCells) {
      if (Math.abs(c.col - spawnCol) < 7 && Math.abs(c.row - spawnRow) < 7) continue;
      (nearSet.has(c.row * this.mapCols + c.col) ? near : far).push(c);
    }

    // 3× original goblin group density
    const numGroups = Math.min(near.length, (10 + this.floor * 2) * 3);
    const nearPool  = [...near];
    for (let g = 0; g < numGroups && nearPool.length > 0 && gDefs.length > 0; g++) {
      const i    = Phaser.Math.Between(0, nearPool.length - 1);
      const cell = nearPool.splice(i, 1)[0];
      const def  = gDefs[Phaser.Math.Between(0, gDefs.length - 1)];
      const size = Math.random() < 0.18 ? 4 : Math.random() < 0.52 ? 3 : 2;
      this.spawnGroup(def, cell, size);
    }

    // 3× cave creature density
    const farPool = [...far];
    const numCave = (5 + this.floor * 2) * 3;
    for (let c = 0; c < numCave && farPool.length > 0 && cDefs.length > 0; c++) {
      const i    = Phaser.Math.Between(0, farPool.length - 1);
      const cell = farPool.splice(i, 1)[0];
      this.spawnOneEnemy(cDefs[Phaser.Math.Between(0, cDefs.length - 1)], cell.col, cell.row);
    }
  }

  // ── Floor 2 area-based enemy population ──────────────────────────────────────
  private populateFloor2Enemies(): void {
    const { areaThemes } = this.floorData;
    if (!areaThemes) return;

    for (const area of areaThemes) {
      const defs = getThemeDefs(area.theme);
      if (defs.length === 0) continue;

      const cells: { col: number; row: number }[] = [];
      for (let r = area.region.y + 1; r < area.region.y + area.region.h - 1; r++) {
        for (let c = area.region.x + 1; c < area.region.x + area.region.w - 1; c++) {
          const t = this.tiles[r][c];
          if (t !== T_WALL && t !== T_WARP && t !== T_PILLAR) cells.push({ col: c, row: r });
        }
      }

      const count = 18; // 18 enemies per area on floor 2
      for (let i = 0; i < count && cells.length > 0; i++) {
        const idx  = Phaser.Math.Between(0, cells.length - 1);
        const cell = cells[idx];
        const def  = defs[Phaser.Math.Between(0, defs.length - 1)];
        const lurker = Math.random() < 0.25;
        this.spawnOneEnemy(def, cell.col, cell.row, lurker);
      }
    }
  }

  private spawnGroup(def: EnemyDef, leader: { col: number; row: number }, size: number): void {
    this.spawnOneEnemy(def, leader.col, leader.row, Math.random() < 0.35);
    const OFFSETS = [
      { dc: 2, dr: 0 }, { dc: -2, dr: 0 },
      { dc: 0, dr: 2 }, { dc: 0,  dr: -2 },
      { dc: 2, dr: 2 }, { dc: -2, dr: 2  },
    ];
    let placed = 1;
    for (const off of OFFSETS) {
      if (placed >= size) break;
      const nc = leader.col + off.dc, nr = leader.row + off.dr;
      if (nc >= 0 && nr >= 0 && nc < this.mapCols && nr < this.mapRows
        && this.tiles[nr][nc] !== T_WALL && this.tiles[nr][nc] !== T_PILLAR
        && this.tiles[nr][nc] !== T_WARP) {
        this.spawnOneEnemy(def, nc, nr, Math.random() < 0.35);
        placed++;
      }
    }
  }

  private spawnOneEnemy(def: EnemyDef, col: number, row: number, lurker = false): void {
    const e = new Enemy(this, (col + 0.5) * TILE, (row + 0.5) * TILE, def);
    if (lurker) e.setLurker();
    e.on('died', () => this.onEnemyDied(e));
    e.setVisible(false);
    this.enemies.add(e as unknown as Phaser.GameObjects.GameObject);
  }

  // ── Inventory panel ───────────────────────────────────────────────────────────
  private toggleInventory(): void {
    if (this.inventoryPanel) {
      this.inventoryPanel.destroy();
      this.inventoryPanel = null;
      return;
    }
    const save = SaveManager.load();
    if (!save) return;

    const sw = this.scale.width, sh = this.scale.height;
    const pw = Math.min(380, Math.round(sw * 0.55));
    const ph = Math.min(300, Math.round(sh * 0.6));
    const container = this.add.container(sw / 2, sh / 2).setDepth(25).setScrollFactor(0);

    container.add(this.add.rectangle(0, 0, pw, ph, 0x120e1c, 0.97).setStrokeStyle(1, 0x886699));
    container.add(this.add.text(0, -ph / 2 + 14, 'INVENTORY', { fontSize: '12px', color: '#ddaaff' }).setOrigin(0.5));
    container.add(this.add.rectangle(0, -ph / 2 + 26, pw - 20, 1, 0x443355));

    if (!save.hasBag) {
      container.add(this.add.text(0, 0, 'Find an Adventure Bag\nto unlock your inventory.',
        { fontSize: '10px', color: '#886699', align: 'center' }).setOrigin(0.5));
    } else {
      const COLS = 5, SZ = 44, GAP = 4;
      const startX = -pw / 2 + 18;
      const startY = -ph / 2 + 36;
      const items = save.inventory;

      for (let i = 0; i < 20; i++) {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const sx = startX + col * (SZ + GAP) + SZ / 2;
        const sy = startY + row * (SZ + GAP) + SZ / 2;
        container.add(this.add.rectangle(sx, sy, SZ, SZ, 0x1e1530).setStrokeStyle(1, 0x443355));
        if (i < items.length) {
          const item = ITEMS[items[i].itemId];
          const label = item ? item.name.substring(0, 7) : items[i].itemId;
          container.add(this.add.text(sx - SZ / 2 + 2, sy - SZ / 2 + 2, label, { fontSize: '6px', color: '#ccbbee' }));
          if (items[i].qty > 1) {
            container.add(this.add.text(sx + SZ / 2 - 2, sy + SZ / 2 - 2, `${items[i].qty}`,
              { fontSize: '7px', color: '#ffdd44' }).setOrigin(1));
          }
        }
      }
    }

    container.add(this.add.text(0, ph / 2 - 10, 'I / Esc: Close', { fontSize: '8px', color: '#443355' }).setOrigin(0.5));
    this.inventoryPanel = container;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'i' || event.key === 'I' || event.key === 'Escape') {
        container.destroy();
        this.inventoryPanel = null;
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);
  }

  // ── Trap triggers ─────────────────────────────────────────────────────────────
  private triggerTrap(trap: Trap): void {
    trap.markTriggered();
    switch (trap.type) {
      case 'spike':
        this.player.takeDamage(TRAP_SPIKE_DMG);
        this.cameras.main.shake(240, 0.016);
        this.floatText('SPIKE TRAP!', this.player.x, this.player.y - 24, '#ff4444');
        break;
      case 'alarm': {
        this.floatText('ALARM!', this.player.x, this.player.y - 24, '#ffbb00');
        const ax = trap.col * TILE, ay = trap.row * TILE;
        for (const child of this.enemies.getChildren()) {
          const e = child as unknown as Enemy;
          if (Phaser.Math.Distance.Between(ax, ay, e.x, e.y) < TRAP_ALARM_RADIUS) e.alert();
        }
        break;
      }
      case 'net':
        this.player.applyNetSlow();
        this.floatText('SLOWED!', this.player.x, this.player.y - 24, '#88aaff');
        break;
    }
  }

  // ── Combat ────────────────────────────────────────────────────────────────────
  private handleAttack(): void {
    const { attackType, currentFacing } = this.player;
    if (attackType === 'melee') {
      this.doMelee(currentFacing);
    } else if (attackType === 'arrow') {
      this.fireProjectile('arrow', currentFacing, 220, this.player.attackDmg);
    } else {
      this.fireProjectile('fireball', currentFacing, 140, this.player.attackDmg * 1.4);
    }
  }

  private doMelee(facing: string): void {
    const range = 42;
    let ax = this.player.x, ay = this.player.y;
    if (facing === 'right') ax += range;
    else if (facing === 'left')  ax -= range;
    else if (facing === 'down')  ay += range;
    else                         ay -= range;

    const slash = this.add.image(ax, ay, 'slash').setAlpha(0.85).setDepth(5);
    this.tweens.add({ targets: slash, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 180, onComplete: () => slash.destroy() });
    for (const child of this.enemies.getChildren()) {
      const e = child as unknown as Enemy;
      if (Phaser.Math.Distance.Between(ax, ay, e.x, e.y) < 44) e.takeDamage(this.player.attackDmg);
    }
  }

  private fireProjectile(key: string, facing: string, speed: number, dmg: number): void {
    const proj = this.physics.add.image(this.player.x, this.player.y, key).setDepth(4);
    let vx = 0, vy = 0;
    if (facing === 'right') { vx =  speed; proj.setAngle(0); }
    else if (facing === 'left')  { vx = -speed; proj.setFlipX(true); }
    else if (facing === 'down')  { vy =  speed; proj.setAngle(90); }
    else                         { vy = -speed; proj.setAngle(-90); }
    proj.setVelocity(vx, vy);

    const hitCheck = this.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        if (!proj.active) { hitCheck.destroy(); return; }
        for (const child of this.enemies.getChildren()) {
          const e = child as unknown as Enemy;
          if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < 24) {
            e.takeDamage(Math.round(dmg)); proj.destroy(); hitCheck.destroy(); return;
          }
        }
        const { x, y } = proj;
        const { width: bw, height: bh } = this.physics.world.bounds;
        if (x < 0 || y < 0 || x > bw || y > bh) { proj.destroy(); hitCheck.destroy(); }
      },
    });
    this.time.delayedCall(1500, () => { if (proj.active) proj.destroy(); hitCheck.destroy(); });
  }

  // ── Warp ──────────────────────────────────────────────────────────────────────
  private doWarp(warpIndex: number): void {
    if (this.warping) return;
    this.warping = true;
    const save = SaveManager.load()!;
    save.lastWarpIndex = warpIndex;

    if (this.floor >= 10) {
      save.location = 'town'; save.dungeonFloor = 0;
      save.currentHp = this.player.currentHp; save.currentMp = this.player.currentMp;
      save.gold = this.player.gold; save.exp = this.player.exp;
      // Spawn near dungeon gate when returning to town
      save.position = { x: 31 * 32 + 16, y: 36 * 32 + 16 };
      SaveManager.write(save);
      this.showCenterText('DUNGEON CLEARED!\nReturning to town...');
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => { this.scene.stop('UIScene'); this.scene.start('TownScene'); });
      this.cameras.main.fadeOut(700, 0, 0, 0);
      return;
    }
    const nextFloor = this.floor + 1;
    save.dungeonFloor = nextFloor;
    save.floorSeed    = Math.floor(Math.random() * 0x7fffffff);
    save.currentHp    = this.player.currentHp;
    save.currentMp    = this.player.currentMp;
    save.gold         = this.player.gold;
    save.exp          = this.player.exp;
    // Reset town position for when player eventually returns
    save.position = { x: 31 * 32 + 16, y: 36 * 32 + 16 };
    SaveManager.write(save);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('UIScene');
      this.scene.start('FloorTransitionScene', { floor: nextFloor });
    });
    this.cameras.main.fadeOut(300, 0, 0, 0);
  }

  // ── Death ─────────────────────────────────────────────────────────────────────
  private onPlayerDied(): void {
    this.player.setActive(false).setVisible(false);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    this.time.delayedCall(400, () => { this.showDeathScreen(); });
  }

  private showDeathScreen(): void {
    const sw = this.scale.width, sh = this.scale.height, cx = sw/2, cy = sh/2;
    this.add.rectangle(cx, cy, sw, sh, 0x000000, 0.8).setScrollFactor(0).setDepth(30);
    this.add.text(cx, cy-30, 'YOU DIED',           { fontSize: '20px', color: '#ff4444' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.add.text(cx, cy+8,  `Floor ${this.floor}`, { fontSize: '13px', color: '#994444' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.add.text(cx, cy+34, 'ENTER to continue',  { fontSize: '11px', color: '#662222' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.input.keyboard!.once('keydown-ENTER', () => { SaveManager.wipe(); this.scene.stop('UIScene'); this.scene.start('MainMenuScene'); });
  }

  // ── Enemy death ───────────────────────────────────────────────────────────────
  private onEnemyDied(enemy: Enemy): void {
    const save = SaveManager.load();

    // EXP gain
    this.player.gainExp(enemy.def.exp);

    // Item drop (mana stones)
    const drop = enemy.getDrop();
    if (drop && save) {
      addToInventory(save.inventory, drop.itemId, drop.qty);
      const itemName = ITEMS[drop.itemId]?.name ?? drop.itemId;
      this.floatText(`+${drop.qty} ${itemName}`, enemy.x, enemy.y, '#88ccff');
    }

    if (save) {
      save.exp = this.player.exp;
      SaveManager.write(save);
    }

    this.floatText(`+${enemy.def.exp}xp`, enemy.x, enemy.y - 14, '#aaddff');
    enemy.destroy();
  }

  // ── Decoration scatter ────────────────────────────────────────────────────────
  private placeDecorations(): void {
    const rng = mkDecoRng(this.seed);
    const isFloorTile = (t: number) =>
      t === 1 || t === 9 || t === T_FLOOR_FOREST || t === T_FLOOR_DEAD || t === T_FLOOR_POND || t === T_FLOOR_ROCK;

    const torches: Phaser.GameObjects.Image[] = [];

    // Scan every other column for performance on large floor 2 maps
    for (let row = 2; row < this.mapRows - 2; row++) {
      for (let col = 2; col < this.mapCols - 2; col += 2) {
        const t = this.tiles[row][col];
        if (!isFloorTile(t)) continue;
        if (rng() > 0.13) continue; // ~13% of sampled positions

        const x = (col + 0.5) * TILE;
        const y = (row + 0.5) * TILE;
        const wallN = this.tiles[row - 1]?.[col] === T_WALL;
        const wallS = this.tiles[row + 1]?.[col] === T_WALL;
        const wallE = this.tiles[row]?.[col + 1] === T_WALL;
        const wallW = this.tiles[row]?.[col - 1] === T_WALL;
        const anyWall = wallN || wallS || wallE || wallW;
        const theme: string = this.floor === 2 ? (this.themeAtTile(col, row) ?? 'cave') : 'cave';
        const r = rng();

        const img = this.spawnDeco(theme, wallN, anyWall, x, y, r);
        if (img && (img.texture.key === 'deco_torch')) torches.push(img);
      }
    }

    // Animate all torches with a random flicker tween
    for (const torch of torches) {
      this.tweens.add({
        targets: torch,
        alpha: { from: 0.78, to: 1.0 },
        duration: 160 + Math.random() * 260,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
        delay: Math.random() * 400,
      });
    }
  }

  private spawnDeco(
    theme: string, wallN: boolean, anyWall: boolean,
    x: number, y: number, r: number,
  ): Phaser.GameObjects.Image | null {
    const add = (key: string, depth = 2, dy = 0) =>
      this.add.image(x, y + dy, key).setDepth(depth);

    if (theme === 'cave') {
      if (wallN && r < 0.22) return add('deco_torch', 4, -6);
      if (r < 0.10) return add(r < 0.05 ? 'deco_mushroom_g' : 'deco_mushroom_b', 2);
      if (r < 0.30) return add('deco_bones', 1);
      if (r < 0.48) return add('deco_crystal_b', 3);
      if (r < 0.58) return add('deco_skull', 1);
      if (r < 0.65) return add('deco_campfire', 2);
      if (anyWall && r < 0.75) return add('deco_urn', 3);
      if (r < 0.82) return add('deco_rune', 1);
      if (anyWall && r < 0.90) return add('deco_chain', 5);
    } else if (theme === 'forest') {
      if (r < 0.28) return add('deco_f_flower', 1);
      if (r < 0.48) return add('deco_f_fern', 2);
      if (r < 0.62) return add('deco_f_log', 2);
      if (r < 0.72) return add(r < 0.67 ? 'deco_mushroom_g' : 'deco_mushroom_b', 2);
      if (wallN && r < 0.85) return add('deco_torch', 4, -6);
      return add('deco_bones', 1);
    } else if (theme === 'deadland') {
      if (r < 0.24) return add('deco_d_grave', 3);
      if (r < 0.44) return add('deco_bones', 1);
      if (r < 0.56) return add('deco_skull', 1);
      if (r < 0.66) return add('deco_d_deadtree', 4);
      if (r < 0.76) return add('deco_d_altar', 3);
      if (wallN && r < 0.88) return add('deco_torch', 4, -6);
      return add('deco_rune', 1);
    } else if (theme === 'pond') {
      if (r < 0.40) return add('deco_p_lily', 1);
      if (r < 0.65) return add('deco_p_reed', 2);
      if (r < 0.76) return add('deco_bones', 1);
      if (r < 0.84) return add('deco_crystal_b', 3);
      return add('deco_mushroom_b', 2);
    } else if (theme === 'rock') {
      if (anyWall && r < 0.38) return add('deco_r_crystal', 3);
      if (anyWall && r < 0.60) return add('deco_r_ore', 2);
      if (r < 0.72) return add('deco_r_crystal', 3);
      if (r < 0.82) return add('deco_skull', 1);
      if (wallN && r < 0.92) return add('deco_torch', 4, -6);
      return add('deco_crystal_b', 3);
    }
    return null;
  }

  // ── Chests ────────────────────────────────────────────────────────────────────
  private chestSprites: { sprite: Phaser.GameObjects.Image; col: number; row: number }[] = [];

  private placeChests(): void {
    this.chestSprites = [];
    for (const cp of this.floorData.chestPositions) {
      const x = (cp.col + 0.5) * TILE;
      const y = (cp.row + 0.5) * TILE;
      const sprite = this.add.image(x, y, 'deco_chest_closed').setDepth(3);
      // Subtle glow tween
      this.tweens.add({ targets: sprite, alpha: { from: 0.88, to: 1.0 }, duration: 900, yoyo: true, repeat: -1 });
      this.chestSprites.push({ sprite, col: cp.col, row: cp.row });
    }
  }

  private checkChestInteract(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.player.interactKey)) return;
    for (const cs of this.chestSprites) {
      const key = `${cs.col},${cs.row}`;
      if (this.openedChests.has(key)) continue;
      const cx = (cs.col + 0.5) * TILE, cy = (cs.row + 0.5) * TILE;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy) < TILE * 1.4) {
        this.openedChests.add(key);
        cs.sprite.setTexture('deco_chest_open');
        this.tweens.killTweensOf(cs.sprite);
        this.grantChestLoot(cx, cy);
        break;
      }
    }
  }

  private grantChestLoot(cx: number, cy: number): void {
    const save = SaveManager.load();
    if (!save) return;

    const lootTable: { weight: number; type: 'gold' | 'item'; value: number | string }[] = this.floor <= 1
      ? [
          { weight: 4, type: 'gold', value: 40 + Math.floor(Math.random() * 80) },
          { weight: 2, type: 'item', value: 'health_potion' },
          { weight: 1, type: 'item', value: 'mana_stone_1' },
          { weight: 1, type: 'item', value: 'mana_potion' },
        ]
      : [
          { weight: 3, type: 'gold', value: 80 + Math.floor(Math.random() * 160) },
          { weight: 3, type: 'item', value: 'mana_stone_2' },
          { weight: 2, type: 'item', value: 'health_potion' },
          { weight: 1, type: 'item', value: 'mana_potion' },
          { weight: 1, type: 'item', value: 'smoke_bomb' },
        ];

    const total = lootTable.reduce((s, l) => s + l.weight, 0);
    let roll = Math.random() * total;
    let loot = lootTable[0];
    for (const entry of lootTable) { roll -= entry.weight; if (roll <= 0) { loot = entry; break; } }

    if (loot.type === 'gold') {
      const amount = loot.value as number;
      this.player.addGold(amount);
      save.gold = this.player.gold;
      this.floatText(`Chest: +${amount}g`, cx, cy - 16, '#ffdd44');
    } else {
      const itemId = loot.value as string;
      addToInventory(save.inventory, itemId, 1);
      const name = ITEMS[itemId]?.name ?? itemId;
      this.floatText(`Chest: ${name}`, cx, cy - 16, '#88ccff');
    }
    SaveManager.write(save);
    this.cameras.main.shake(100, 0.008);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private floatText(msg: string, x: number, y: number, color: string): void {
    const t = this.add.text(x, y, msg, { fontSize: '7px', color }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: t, alpha: 0, y: y - 26, duration: 1000, onComplete: () => t.destroy() });
  }

  private showCenterText(msg: string): void {
    this.add.text(this.scale.width/2, this.scale.height/2, msg,
      { fontSize: '16px', color: '#ddaaff', align: 'center' },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(35);
  }

  private collectFloorCells(tiles: number[][]): { col: number; row: number }[] {
    const walkable = new Set([1, 9, T_FLOOR_FOREST, T_FLOOR_DEAD, T_FLOOR_POND, T_FLOOR_ROCK]);
    const cells: { col: number; row: number }[] = [];
    for (let r = 0; r < tiles.length; r++) {
      for (let c = 0; c < tiles[r].length; c++) {
        if (walkable.has(tiles[r][c])) cells.push({ col: c, row: r });
      }
    }
    return cells;
  }
}
