import Phaser from 'phaser';
import {
  TILE, calcZoom, FOV_RADIUS,
  TRAP_SPIKE_DMG, TRAP_ALARM_RADIUS,
  AMBIENT_SPAWN_INTERVAL, AMBIENT_SPAWN_MIN_DIST, AMBIENT_SPAWN_MAX_DIST,
  TUNING,
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
import { addToInventory, sortInventory } from '../lib/inventory';
import { CharacterSave, ItemInstance, Affix } from '../types';
import { getSkillTree } from '../data/skills';
import { Hazard, HazardType } from '../entities/Hazard';
import { StatusSystem, Element, Ailment } from '../systems/StatusSystem';

const VIS_HIDDEN   = 0;
const VIS_EXPLORED = 1;
const VIS_VISIBLE  = 2;

const NEAR_WARP_TILES = 30;

export class DungeonScene extends Phaser.Scene {
  private player!: Player;
  private hazards: Hazard[] = [];
  private hazardGroup!: Phaser.Physics.Arcade.StaticGroup;
  private activeGlyph: Phaser.GameObjects.Arc | null = null;
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
  private consolidatedPanel: Phaser.GameObjects.Container | null = null;
  private leftActiveTab: 'equip' | 'stats' | 'skills' = 'equip';
  private rightActiveTab: 'all' | 'gear' | 'use' | 'mat' = 'all';
  private consolidatedKeydownListener: ((event: KeyboardEvent) => void) | null = null;
  private tooltipBox: Phaser.GameObjects.Container | null = null;
  private inventoryKey!: Phaser.Input.Keyboard.Key;
  private charKey!: Phaser.Input.Keyboard.Key;
  private hotbarKeys: Phaser.Input.Keyboard.Key[] = [];

  // Live stat snapshot for character screen
  private liveStats: import('../types').Stats | null = null;

  // §14 Skills & Active parry
  private charActiveTab: 'stats' | 'skills' = 'stats';
  private skillKeys!: {
    R: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
    V: Phaser.Input.Keyboard.Key;
  };

  constructor() { super('DungeonScene'); }

  create(): void {
    this.warping      = false;
    this.ambientTimer = 0;
    this.consolidatedPanel = null;

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

    this.placeDecorations();
    this.placeChests();

    // ── Environment hazards ──────────────────────────────────────────────────
    this.hazardGroup = this.physics.add.staticGroup();
    this.spawnHazards();

    this.physics.add.overlap(this.player as unknown as Phaser.GameObjects.GameObject, this.hazardGroup, this.handlePlayerHazardOverlap as any, undefined, this);
    this.physics.add.overlap(this.enemies, this.hazardGroup, this.handleEnemyHazardOverlap as any, undefined, this);

    // ── UI & keys ─────────────────────────────────────────────────────────────
    this.activeGlyph = null;
    this.charActiveTab = 'stats';

    this.inventoryKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.charKey      = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.hotbarKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
    ];
    this.skillKeys = {
      R: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      F: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      V: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V),
    };

    // Spawn protection — no damage for the first second after loading a floor
    this.player.spawnProtMs = TUNING.spawnProtection;

    // §11 Perfect guard → stagger attacker
    this.game.events.on('perfect-guard', this.onPerfectGuard, this);

    const onSwitch = () => {
      const save = SaveManager.load();
      if (!save) return;
      const ammoId = this.player.attackType === 'arrow' ? 'arrow'
                   : this.player.attackType === 'bolt'  ? 'bolt'
                   : null;
      if (ammoId) {
        const qty = save.inventory.find(s => s.itemId === ammoId)?.qty ?? 0;
        this.game.events.emit('ammo-update', { ammoId, qty });
      } else {
        this.game.events.emit('ammo-update', { ammoId: '', qty: 0 });
      }
    };
    this.game.events.on('weapon-switch', onSwitch, this);

    // §14 active skills VFX and parry-riposte wiring
    this.game.events.on('cast-skill', this.onCastSkill, this);
    this.game.events.on('parry-success', this.onParrySuccess, this);

    this.events.once('shutdown', () => {
      this.game.events.off('perfect-guard', this.onPerfectGuard, this);
      this.game.events.off('weapon-switch', onSwitch, this);
      this.game.events.off('cast-skill', this.onCastSkill, this);
      this.game.events.off('parry-success', this.onParrySuccess, this);
      this.closeConsolidatedUI();
    });

    // Initialise live stats snapshot from save
    const _initSave = SaveManager.load();
    if (_initSave) {
      this.liveStats = { ..._initSave.stats };
      const ammoId = this.player.attackType === 'arrow' ? 'arrow'
                   : this.player.attackType === 'bolt'  ? 'bolt'
                   : null;
      if (ammoId) {
        const qty = _initSave.inventory.find(s => s.itemId === ammoId)?.qty ?? 0;
        this.time.delayedCall(50, () => {
          this.game.events.emit('ammo-update', { ammoId, qty });
        });
      }
    }

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.game.events.emit('hud-update', this.player);
    this.game.events.emit('floor-update', this.floor);
    this.game.events.emit('hotbar-update', this.buildHotbarData());

    this.add.text(this.scale.width / 2, 14, `FLOOR ${this.floor}`, {
      fontSize: '14px', color: '#776699',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);
  }

  update(time: number, delta: number): void {
    if (this.warping) return;

    // Reset hazard status flags on targets at start of frame
    this.player.setData('in_oil', false);
    this.player.setData('on_ice', false);
    for (const child of this.enemies.getChildren()) {
      child.setData('in_oil', false);
      child.setData('on_ice', false);
    }

    this.player.update(time, delta);
    this.updateFOV();

    if (Phaser.Input.Keyboard.JustDown(this.inventoryKey)) this.toggleConsolidatedUI('equip');
    if (Phaser.Input.Keyboard.JustDown(this.charKey)) this.toggleConsolidatedUI('stats');
    this.checkChestInteract();
    this.checkHotbarInput();

    // Check skill casting inputs
    if (this.skillKeys) {
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.R)) this.player.castActiveSkill('R');
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.F)) this.player.castActiveSkill('F');
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.V)) this.player.castActiveSkill('V');
    }

    // Melee: schedule hitbox after startup frames
    const lightAtk = this.player.pollLightAttack();
    if (lightAtk) {
      this.time.delayedCall(lightAtk.startupMs, () => {
        if (this.player.active) this.doMeleeHit(lightAtk.facing, lightAtk.mv, lightAtk.poiseDmg, lightAtk.range, false);
      });
    }
    const heavyAtk = this.player.pollHeavyAttack();
    if (heavyAtk) {
      this.time.delayedCall(heavyAtk.startupMs, () => {
        if (this.player.active) this.doMeleeHit(heavyAtk.facing, heavyAtk.mv, heavyAtk.poiseDmg, heavyAtk.range, true);
      });
    }
    if (this.player.pollRangedAttack()) this.handleRangedAttack();

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

      const count = 18;
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
  private toggleConsolidatedUI(forceTab?: 'equip' | 'stats' | 'skills'): void {
    if (this.consolidatedPanel) {
      if (forceTab && this.leftActiveTab !== forceTab) {
        this.leftActiveTab = forceTab;
        this.rebuildConsolidatedUI();
        return;
      }
      this.closeConsolidatedUI();
      return;
    }
    if (forceTab) {
      this.leftActiveTab = forceTab;
    }
    this.rebuildConsolidatedUI();
  }

  private closeConsolidatedUI(): void {
    if (this.consolidatedPanel) {
      this.consolidatedPanel.destroy();
      this.consolidatedPanel = null;
    }
    if (this.tooltipBox) {
      this.tooltipBox.destroy();
      this.tooltipBox = null;
    }
    if (this.consolidatedKeydownListener) {
      window.removeEventListener('keydown', this.consolidatedKeydownListener);
      this.consolidatedKeydownListener = null;
    }
  }

  private rebuildConsolidatedUI(): void {
    if (this.consolidatedPanel) {
      this.consolidatedPanel.destroy();
      this.consolidatedPanel = null;
    }

    const save = SaveManager.load();
    if (!save) return;

    if (!this.liveStats) this.liveStats = { ...save.stats };

    const sw = this.scale.width, sh = this.scale.height;
    const pw = 440;
    const ph = 300;

    const container = this.add.container(sw / 2, sh / 2).setDepth(25).setScrollFactor(0);
    this.consolidatedPanel = container;

    container.add(this.add.rectangle(0, 0, pw, ph, 0x0c0914, 0.98).setStrokeStyle(1.5, 0x8866aa));
    container.add(this.add.text(0, -ph / 2 + 12, 'CHARACTER & INVENTORY', { fontSize: '10px', color: '#ddaaff' }).setOrigin(0.5));
    container.add(this.add.rectangle(0, -ph / 2 + 22, pw - 20, 1, 0x443355));
    container.add(this.add.rectangle(-110, 10, 204, 256, 0x120f24, 0.95).setStrokeStyle(1, 0x3d2b55));
    container.add(this.add.rectangle(110, 10, 204, 256, 0x120f24, 0.95).setStrokeStyle(1, 0x3d2b55));

    const tabY = -ph / 2 + 32;
    const tabKeys: ('equip' | 'stats' | 'skills')[] = ['equip', 'stats', 'skills'];
    const tabLabels = ['EQUIP', 'STATS', 'SKILLS'];
    const tabXs = [-165, -110, -55];

    tabKeys.forEach((key, idx) => {
      const active = this.leftActiveTab === key;
      const btn = this.add.text(tabXs[idx], tabY, tabLabels[idx], {
        fontSize: '7px',
        color: active ? '#ffffff' : '#8855bb',
        backgroundColor: active ? '#551177' : '#1d132b',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.leftActiveTab = key;
        this.rebuildConsolidatedUI();
      });
      container.add(btn);
    });

    if (this.leftActiveTab === 'equip') {
      this.renderEquipTab(container, save);
    } else if (this.leftActiveTab === 'stats') {
      this.renderStatsTabConsolidated(container, save);
    } else if (this.leftActiveTab === 'skills') {
      this.renderSkillsTabConsolidated(container, save);
    }

    this.renderInventoryRight(container, save);
    container.add(this.add.text(0, ph / 2 - 10, 'I / C / Esc: Close  |  Shift+Click item: Mark Junk  |  Drag to Equip/Rearrange', { fontSize: '6px', color: '#554477' }).setOrigin(0.5));

    this.setupDragAndDrop();

    if (!this.consolidatedKeydownListener) {
      const onKey = (event: KeyboardEvent) => {
        const k = event.key.toLowerCase();
        if (k === 'escape') {
          this.closeConsolidatedUI();
        } else if (k === 'i') {
          if (this.leftActiveTab === 'equip') {
            this.closeConsolidatedUI();
          } else {
            this.leftActiveTab = 'equip';
            this.rebuildConsolidatedUI();
          }
        } else if (k === 'c') {
          if (this.leftActiveTab === 'stats') {
            this.closeConsolidatedUI();
          } else {
            this.leftActiveTab = 'stats';
            this.rebuildConsolidatedUI();
          }
        }
      };
      window.addEventListener('keydown', onKey);
      this.consolidatedKeydownListener = onKey;
    }
  }

  private renderEquipTab(container: Phaser.GameObjects.Container, save: CharacterSave): void {
    const slots = [
      { key: 'head',     name: 'Head',    x: -110, y: -65 },
      { key: 'chest',    name: 'Chest',   x: -110, y: -25 },
      { key: 'legs',     name: 'Legs',    x: -110, y: 15 },
      { key: 'boots',    name: 'Boots',   x: -110, y: 55 },
      { key: 'amulet',   name: 'Amulet',  x: -155, y: -65 },
      { key: 'ring1',    name: 'Ring 1',  x: -155, y: -25 },
      { key: 'ring2',    name: 'Ring 2',  x: -155, y: 15 },
      { key: 'charm',    name: 'Charm',   x: -155, y: 55 },
      { key: 'hands',    name: 'Hands',   x: -65,  y: -65 },
      { key: 'mainhand', name: 'Weapon1', x: -65,  y: -25 },
      { key: 'weapon2',  name: 'Weapon2', x: -65,  y: 15 },
      { key: 'offhand',  name: 'Offhand', x: -65,  y: 55 }
    ];

    slots.forEach(slot => {
      const bg = this.add.rectangle(slot.x, slot.y, 32, 32, 0x1e1530).setStrokeStyle(1, 0x3a2c55);
      container.add(bg);
      const lbl = this.add.text(slot.x, slot.y, slot.name, { fontSize: '5px', color: '#4d3b66' }).setOrigin(0.5);
      container.add(lbl);

      const inst = this.player.equippedGear[slot.key];
      if (inst) {
        const item = ITEMS[inst.itemId];
        if (item) {
          lbl.setVisible(false);
          bg.setStrokeStyle(1.5, this.getRarityColor(inst.rarity ?? 'common'));

          const iconText = this.add.text(slot.x, slot.y, item.name.substring(0, 7), {
            fontSize: '6px',
            color: this.getRarityHexColor(inst.rarity ?? 'common'),
            align: 'center'
          }).setOrigin(0.5).setInteractive({ draggable: true });

          iconText.setData('isEquipped', true);
          iconText.setData('slotKey', slot.key);
          iconText.setData('itemInstance', inst);
          this.input.setDraggable(iconText);

          iconText.on('pointerover', (p: Phaser.Input.Pointer) => this.showTooltip(p, inst));
          iconText.on('pointerout', () => this.hideTooltip());
          iconText.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (this.tooltipBox && this.tooltipBox.active) {
              const bgRect = this.tooltipBox.getAt(0) as Phaser.GameObjects.Rectangle;
              const tx = Math.min(p.x + 15, this.scale.width - bgRect.width - 10);
              const ty = Math.min(p.y + 15, this.scale.height - bgRect.height - 10);
              this.tooltipBox.setPosition(tx, ty);
            }
          });
          container.add(iconText);
        }
      }
    });

    const speedPct = Math.round(this.player.weightSpeedMult * 100);
    const weightClass = this.player.totalWeight < 15 ? 'Light' : (this.player.totalWeight <= 40 ? 'Medium' : 'Heavy');
    const statsText = `HP: ${this.player.currentHp}/${this.player.maxHp}  MP: ${this.player.currentMp}/${this.player.maxMp}\nATK: ${this.player.attackDmg}  DEF: ${this.player.defense}\nCRIT: ${this.player.dodgeChancePct.toFixed(1)}%  LIFESTEAL: ${this.player.lifestealPct}%\nSPEED: ${speedPct}%  WT: ${this.player.totalWeight.toFixed(1)} (${weightClass})`;

    container.add(this.add.text(-110, 105, statsText, { fontSize: '6.5px', color: '#aaccff', align: 'center', lineSpacing: 4 }).setOrigin(0.5));
  }

  private renderStatsTabConsolidated(container: Phaser.GameObjects.Container, save: CharacterSave): void {
    const stats = this.liveStats!;
    const pts = this.player.unspentStatPoints;

    container.add(this.add.text(-110, -75, `Unspent Points: ${pts}`, { fontSize: '8px', color: pts > 0 ? '#ffee55' : '#665577' }).setOrigin(0.5));

    const STAT_KEYS: (keyof typeof stats)[] = ['str', 'dex', 'int', 'vit', 'agi', 'hp', 'mp'];
    const STAT_LABELS: Record<string, string> = { str: 'STR', dex: 'DEX', int: 'INT', vit: 'VIT', agi: 'AGI', hp: 'HP', mp: 'MP' };
    const STAT_DESC: Record<string, string> = { str: 'Melee Atk', dex: 'Ranged Atk', int: 'Magic/MP', vit: 'HP/Defense', agi: 'Crit/Roll', hp: 'Base HP', mp: 'Base MP' };

    const startY = -55;
    const rowH = 22;

    STAT_KEYS.forEach((key, idx) => {
      const ry = startY + idx * rowH;
      container.add([
        this.add.text(-200, ry, `${STAT_LABELS[key]}: ${stats[key]}`, { fontSize: '7px', color: '#ccbbee' }),
        this.add.text(-200, ry + 8, STAT_DESC[key], { fontSize: '5px', color: '#776688' })
      ]);

      const canSpend = pts > 0;
      const btn = this.add.text(-30, ry + 2, '+1', { fontSize: '8px', color: canSpend ? '#88ffaa' : '#443355', backgroundColor: canSpend ? '#1a2e1a' : '#111111', padding: { x: 3, y: 1 } }).setOrigin(1, 0).setInteractive({ useHandCursor: canSpend });
      if (canSpend) {
        btn.on('pointerdown', () => {
          if (this.player.spendStatPoint(key, stats)) {
            const s = SaveManager.load();
            if (s) { s.stats = { ...stats }; s.currentHp = this.player.currentHp; s.currentMp = this.player.currentMp; s.unspentStatPoints = this.player.unspentStatPoints; SaveManager.write(s); }
            this.rebuildConsolidatedUI();
          }
        });
      }
      container.add(btn);
    });
    container.add(this.add.text(-110, 115, `Level ${this.player.level} ${save.clazz.toUpperCase()}`, { fontSize: '7px', color: '#88cca3' }).setOrigin(0.5));
  }

  private renderSkillsTabConsolidated(container: Phaser.GameObjects.Container, save: CharacterSave): void {
    const player = this.player;
    const skillPts = player.unspentSkillPoints;
    container.add(this.add.text(-110, -80, `Skill Points: ${skillPts}`, { fontSize: '8px', color: skillPts > 0 ? '#ffee55' : '#665577' }).setOrigin(0.5));
    const tree = getSkillTree(player.classKey);
    const tooltipBg = this.add.rectangle(-110, 105, 190, 34, 0x07050e, 0.95).setStrokeStyle(1, 0x332244);
    const tooltipText = this.add.text(-200, 92, 'Hover over a skill node for details.', { fontSize: '5px', color: '#ccbbee', wordWrap: { width: 180 } });
    container.add([tooltipBg, tooltipText]);
    const colWidth = 60, rowHeight = 26, startX = -110 - colWidth, startY = -50;
    const branches = player.classKey === 'swordman' ? ['Blade', 'Guard', 'Tempo'] : player.classKey === 'archer' ? ['Precision', 'Volley', 'Survival'] : player.classKey === 'tanker' ? ['Aegis', 'Provoke', 'Impact'] : player.classKey === 'assassin' ? ['Shadow', 'Venom', 'Tempo'] : ['Elements', 'Glyph', 'Mysticism'];
    branches.forEach((brName, colIdx) => container.add(this.add.text(startX + colIdx * colWidth + colWidth, startY - 12, brName, { fontSize: '6px', color: '#8855bb' }).setOrigin(0.5)));
    tree.nodes.forEach((node) => {
      const colIdx = branches.indexOf(node.branch);
      if (colIdx === -1) return;
      const nx = startX + colIdx * colWidth + colWidth, ny = startY + (node.tier - 1) * rowHeight;
      const isUnlocked = player.isSkillUnlocked(node.id), reqMet = !tree.nodes.find(n => n.branch === node.branch && n.tier === node.tier - 1) || player.isSkillUnlocked(tree.nodes.find(n => n.branch === node.branch && n.tier === node.tier - 1)!.id);
      const canUnlock = !isUnlocked && reqMet && skillPts >= 1;
      const nodeCircle = this.add.circle(nx, ny, 8, isUnlocked ? 0x113322 : (canUnlock ? 0x222211 : 0x111111)).setStrokeStyle(1.5, isUnlocked ? 0x44ffaa : (canUnlock ? 0xffdd55 : 0x555566)).setInteractive({ useHandCursor: isUnlocked || canUnlock });
      const nodeText = this.add.text(nx, ny, `${node.tier}`, { fontSize: '6px', color: isUnlocked ? '#aaffdd' : (canUnlock ? '#ffea88' : '#777777') }).setOrigin(0.5);
      container.add([nodeCircle, nodeText]);
      nodeCircle.on('pointerover', () => tooltipText.setText(`[T${node.tier}] ${node.name}${node.type === 'active' ? ' [Active]' : ' [Passive]'}: ${node.description}`));
      nodeCircle.on('pointerout', () => tooltipText.setText('Hover over a skill node for details.'));
      if (canUnlock) {
        nodeCircle.on('pointerdown', () => {
          player.unspentSkillPoints--; player.unlockedSkills.push(node.id); player.recomputeDerivedStats(save.stats, player.level);
          const s = SaveManager.load();
          if (s) { s.unspentSkillPoints = player.unspentSkillPoints; s.unlockedSkills = player.unlockedSkills; SaveManager.write(s); }
          this.rebuildConsolidatedUI();
        });
      }
    });
    const cap = tree.capstone, cy = startY + 4 * rowHeight - 12, isCapUnlocked = player.isSkillUnlocked(cap.id), canUnlockCap = !isCapUnlocked && player.unlockedSkills.length >= 8 && skillPts >= 1;
    const capCircle = this.add.circle(-110, cy, 10, isCapUnlocked ? 0x331144 : (canUnlockCap ? 0x222211 : 0x111111)).setStrokeStyle(2, isCapUnlocked ? 0xdd88ff : (canUnlockCap ? 0xffdd55 : 0x555566)).setInteractive({ useHandCursor: isCapUnlocked || canUnlockCap });
    container.add([capCircle, this.add.text(-110, cy, '★', { fontSize: '8px', color: isCapUnlocked ? '#f0ccff' : '#777777' }).setOrigin(0.5)]);
    capCircle.on('pointerover', () => tooltipText.setText(`[CAP] ${cap.name}: ${cap.description}`));
    capCircle.on('pointerout', () => tooltipText.setText('Hover over a skill node for details.'));
    if (canUnlockCap) {
      capCircle.on('pointerdown', () => {
        player.unspentSkillPoints--; player.unlockedSkills.push(cap.id); player.recomputeDerivedStats(save.stats, player.level);
        const s = SaveManager.load();
        if (s) { s.unspentSkillPoints = player.unspentSkillPoints; s.unlockedSkills = player.unlockedSkills; SaveManager.write(s); }
        this.rebuildConsolidatedUI();
      });
    }
  }

  private renderInventoryRight(container: Phaser.GameObjects.Container, save: CharacterSave): void {
    const filterKeys: ('all' | 'gear' | 'use' | 'mat')[] = ['all', 'gear', 'use', 'mat'];
    filterKeys.forEach((key, idx) => {
      const active = this.rightActiveTab === key;
      const btn = this.add.text(50 + idx * 40, -300 / 2 + 32, ['ALL', 'GEAR', 'USE', 'MAT'][idx], { fontSize: '7px', color: active ? '#ffffff' : '#8855bb', backgroundColor: active ? '#551177' : '#1d132b', padding: { x: 4, y: 2 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => { this.rightActiveTab = key; this.rebuildConsolidatedUI(); });
      container.add(btn);
    });

    if (!save.hasBag) {
      container.add(this.add.text(110, 10, 'Find an Adventure Bag\nto unlock inventory.', { fontSize: '8px', color: '#665577', align: 'center', wordWrap: { width: 180 } }).setOrigin(0.5));
      return;
    }

    let filtered = save.inventory.filter((i: ItemInstance) => {
      const base = ITEMS[i.itemId];
      if (this.rightActiveTab === 'gear') return base && (base.type === 'weapon' || base.type === 'armor');
      if (this.rightActiveTab === 'use') return base && (base.type === 'consumable' || base.type === 'ammo' || base.type === 'bag' || base.type === 'tome');
      if (this.rightActiveTab === 'mat') return base && base.type === 'material';
      return true;
    });

    for (let i = 0; i < 25; i++) {
      const slotX = 38 + (i % 5) * 36, slotY = -70 + Math.floor(i / 5) * 36;
      const slotBg = this.add.rectangle(slotX, slotY, 32, 32, 0x1e1530).setStrokeStyle(1, 0x3a2c55);
      container.add(slotBg);
      if (i < filtered.length) {
        const inst = filtered[i], base = ITEMS[inst.itemId];
        slotBg.setStrokeStyle(1.5, this.getRarityColor(inst.rarity ?? 'common'));
        const itemText = this.add.text(slotX, slotY, base.name.substring(0, 7), { fontSize: '6px', color: this.getRarityHexColor(inst.rarity ?? 'common'), align: 'center' }).setOrigin(0.5).setInteractive({ draggable: true });
        if (inst.qty > 1) container.add(this.add.text(slotX + 14, slotY + 14, `${inst.qty}`, { fontSize: '6px', color: '#ffdd44' }).setOrigin(1, 1));
        if (inst.isJunk) { itemText.setAlpha(0.4); container.add(this.add.text(slotX - 14, slotY + 14, 'JUNK', { fontSize: '5px', color: '#ff3333' }).setOrigin(0, 1)); }
        itemText.setData('isEquipped', false); itemText.setData('index', save.inventory.indexOf(inst)); itemText.setData('itemInstance', inst);
        this.input.setDraggable(itemText);
        itemText.on('pointerover', (p: Phaser.Input.Pointer) => this.showTooltip(p, inst));
        itemText.on('pointerout', () => this.hideTooltip());
        itemText.on('pointermove', (p: Phaser.Input.Pointer) => {
          if (this.tooltipBox && this.tooltipBox.active) {
            const bgRect = this.tooltipBox.getAt(0) as Phaser.GameObjects.Rectangle;
            this.tooltipBox.setPosition(Math.min(p.x + 15, this.scale.width - bgRect.width - 10), Math.min(p.y + 15, this.scale.height - bgRect.height - 10));
          }
        });
        itemText.on('pointerdown', (p: Phaser.Input.Pointer) => {
          if (p.event.shiftKey) { inst.isJunk = !inst.isJunk; const s = SaveManager.load(); if (s) { const sIdx = s.inventory.findIndex(x => x.id === inst.id); if (sIdx !== -1) { s.inventory[sIdx].isJunk = inst.isJunk; SaveManager.write(s); } } this.rebuildConsolidatedUI(); }
        });
        container.add(itemText);
      }
    }
    const sortBtn = this.add.text(55, 112, 'SORT', { fontSize: '7px', color: '#ffffff', backgroundColor: '#2b1d3d', padding: { x: 8, y: 3 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    sortBtn.on('pointerdown', () => { sortInventory(save.inventory); SaveManager.write(save); this.rebuildConsolidatedUI(); });
    const sellBtn = this.add.text(145, 112, 'SELL JUNK', { fontSize: '7px', color: '#ff8888', backgroundColor: '#3d1d1d', padding: { x: 8, y: 3 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    sellBtn.on('pointerdown', () => this.floatText('Must sell at shop in town!', this.player.x, this.player.y - 20, '#ff5555'));
    container.add([sortBtn, sellBtn]);
  }

  private setupDragAndDrop(): void {
    this.input.off('drag'); this.input.off('dragend');
    this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
      const obj = gameObject as Phaser.GameObjects.Text;
      obj.x = dragX; obj.y = dragY;
    });
    this.input.on('dragend', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      this.hideTooltip();
      const obj = gameObject as Phaser.GameObjects.Text;
      const isEquipped = obj.getData('isEquipped'), inst = obj.getData('itemInstance') as ItemInstance, base = ITEMS[inst.itemId];
      const localX = obj.x, localY = obj.y;
      const paperDoll: Record<string, { x: number, y: number }> = { head: { x: -110, y: -65 }, chest: { x: -110, y: -25 }, legs: { x: -110, y: 15 }, boots: { x: -110, y: 55 }, amulet: { x: -155, y: -65 }, ring1: { x: -155, y: -25 }, ring2: { x: -155, y: 15 }, charm: { x: -155, y: 55 }, hands: { x: -65, y: -65 }, mainhand: { x: -65, y: -25 }, weapon2: { x: -65, y: 15 }, offhand: { x: -65, y: 55 } };
      let droppedSlot: string | null = null;
      for (const [s, p] of Object.entries(paperDoll)) if (Phaser.Math.Distance.Between(localX, localY, p.x, p.y) < 20) droppedSlot = s;
      const save = SaveManager.load();
      if (!save) return;
      if (droppedSlot) {
        if (base.slot === droppedSlot || (droppedSlot.startsWith('ring') && base.slot.startsWith('ring')) || ((droppedSlot === 'mainhand' || droppedSlot === 'weapon2') && base.slot === 'mainhand')) {
          if (!isEquipped) {
            const idx = obj.getData('index'), item = save.inventory[idx], equipped = save.equipped[droppedSlot];
            save.equipped[droppedSlot] = item; save.inventory.splice(idx, 1); if (equipped) save.inventory.push(equipped);
          } else {
            const fSlot = obj.getData('slotKey'), fItem = save.equipped[fSlot], tItem = save.equipped[droppedSlot];
            save.equipped[droppedSlot] = fItem; save.equipped[fSlot] = tItem;
          }
          this.player.loadFromSave(save); SaveManager.write(save); this.floatText('EQUIPPED', this.player.x, this.player.y - 20, '#88ffaa');
        } else this.floatText('INVALID SLOT', this.player.x, this.player.y - 20, '#ff5555');
      } else if (localX > 10 && localX < 210 && localY > -90 && localY < 95) {
        if (isEquipped) {
          const s = obj.getData('slotKey'), item = save.equipped[s];
          if (item) { save.equipped[s] = null; save.inventory.push(item); this.player.loadFromSave(save); SaveManager.write(save); this.floatText('UNEQUIPPED', this.player.x, this.player.y - 20, '#ffaa44'); }
        } else {
          const col = Math.floor((localX - 22) / 36), row = Math.floor((localY + 54) / 36), idx = row * 5 + col;
          if (col >= 0 && col < 5 && row >= 0 && row < 5) {
            const filteredIndices: number[] = [];
            save.inventory.forEach((item, originalIdx) => {
              const def = ITEMS[item.itemId];
              if (this.rightActiveTab === 'all' || (this.rightActiveTab === 'gear' && def && (def.type === 'weapon' || def.type === 'armor')) || (this.rightActiveTab === 'use' && def && (def.type === 'consumable' || def.type === 'ammo' || def.type === 'bag' || def.type === 'tome')) || (this.rightActiveTab === 'mat' && def && def.type === 'material')) filteredIndices.push(originalIdx);
            });
            if (idx < filteredIndices.length) {
              const fIdx = obj.getData('index'), tIdx = filteredIndices[idx];
              if (fIdx !== tIdx) { const temp = save.inventory[fIdx]; save.inventory[fIdx] = save.inventory[tIdx]; save.inventory[tIdx] = temp; SaveManager.write(save); }
            }
          }
        }
      }
      this.rebuildConsolidatedUI();
    });
  }

  private showTooltip(pointer: Phaser.Input.Pointer, itemInstance: ItemInstance): void {
    if (this.tooltipBox) { this.tooltipBox.destroy(); this.tooltipBox = null; }
    const base = ITEMS[itemInstance.itemId];
    if (!base) return;
    this.tooltipBox = this.add.container(0, 0).setDepth(40).setScrollFactor(0);
    const lines: string[] = [base.name, `${(itemInstance.rarity ?? 'common').toUpperCase()} ${base.type.toUpperCase()}`, `Sell Value: ${base.sellValue ?? 5}g`];
    const colors: string[] = [this.getRarityHexColor(itemInstance.rarity ?? 'common'), '#888888', '#ffee55'];
    const save = SaveManager.load();
    if (save && base.slot !== 'none') {
      const eqInst = save.equipped[base.slot] || (base.slot.startsWith('ring') ? save.equipped['ring1'] : null), getStats = (inst: ItemInstance) => { const b = ITEMS[inst.itemId], s: Record<string, number> = {}; if (!b) return s; if (b.baseAttack) s['atk'] = b.baseAttack; if (b.baseDefense) s['def'] = b.baseDefense; if (b.weight) s['wt'] = b.weight; if (inst.affixes) for (const a of inst.affixes) s[a.stat] = (s[a.stat] ?? 0) + a.value; return s; };
      const hS = getStats(itemInstance), eS = eqInst ? getStats(eqInst) : {}, statLabels: Record<string, string> = { atk: 'Attack', def: 'Defense', wt: 'Weight', str: 'STR', dex: 'DEX', int: 'INT', vit: 'VIT', agi: 'AGI', hp: 'Max HP', mp: 'Max MP', critChance: 'Crit Rate', critDmg: 'Crit Dmg', lifesteal: 'Lifesteal', moveSpeed: 'Speed' };
      ['atk', 'def', 'wt', 'str', 'dex', 'int', 'vit', 'agi', 'hp', 'mp', 'critChance', 'critDmg', 'lifesteal', 'moveSpeed'].forEach(key => {
        const hV = hS[key] ?? 0, eV = eS[key] ?? 0;
        if (hV === 0 && eV === 0) return;
        const d = hV - eV, isPct = ['critChance', 'critDmg', 'lifesteal', 'moveSpeed'].includes(key);
        lines.push(`${statLabels[key] ?? key.toUpperCase()}: ${hV}${isPct ? '%' : ''}${d !== 0 ? ` (${d > 0 ? '+' : ''}${d}${isPct ? '%' : ''})` : ''}`);
        colors.push(d === 0 ? '#ccbbee' : ((d > 0 && key !== 'wt') || (d < 0 && key === 'wt') ? '#88ffaa' : '#ff5555'));
      });
      if (base.setName) { lines.push(`Set: ${base.setName.toUpperCase()}`); colors.push('#ddaaff'); }
    } else if (itemInstance.affixes) {
      itemInstance.affixes.forEach((aff: Affix) => {
        const isPct = ['critChance', 'critDmg', 'lifesteal', 'moveSpeed'].includes(aff.stat);
        lines.push(`${aff.stat.toUpperCase()}: ${aff.value >= 0 ? '+' : ''}${aff.value}${isPct ? '%' : ''}`);
        colors.push('#aaffcc');
      });
    }
    if (itemInstance.isJunk) { lines.push('MARKED AS JUNK'); colors.push('#ff3333'); }
    let maxW = 100;
    lines.forEach((l, i) => { const t = this.add.text(8, 6 + i * 10, l, { fontSize: i === 0 ? '8px' : '6px', color: colors[i] }); this.tooltipBox!.add(t); if (t.width + 16 > maxW) maxW = t.width + 16; });
    const boxH = lines.length * 10 + 12;
    this.tooltipBox.addAt(this.add.rectangle(0, 0, maxW, boxH, 0x05040a, 0.95).setOrigin(0).setStrokeStyle(1, 0x553377), 0);
    this.tooltipBox.setPosition(Math.min(pointer.x + 15, this.scale.width - maxW - 10), Math.min(pointer.y + 15, this.scale.height - boxH - 10));
  }

  private hideTooltip(): void { if (this.tooltipBox) { this.tooltipBox.destroy(); this.tooltipBox = null; } }
  private getRarityHexColor(rarity: string): string { return { common: '#ffffff', uncommon: '#88ff88', rare: '#88ccff', epic: '#cc88ff', legendary: '#ffaa33', mythic: '#ff3388' }[rarity] ?? '#ffffff'; }
  private getRarityColor(rarity: string): number { return { common: 0xaaaaaa, uncommon: 0x44bb44, rare: 0x4488ff, epic: 0xa844ff, legendary: 0xffaa00, mythic: 0xff3366 }[rarity] ?? 0xaaaaaa; }

  // ── §14 Active Skills execution visuals ─────────────────────────────────────────
  private onCastSkill(data: { slotKey: string, skillId: string, name: string, cdMs: number }): void {
    this.floatText(data.name.toUpperCase(), this.player.x, this.player.y - 28, '#cc88ff');

    const id = data.skillId;
    if (id === 'sword_riposte_stance') {
      const ring = this.add.circle(this.player.x, this.player.y, 22, 0xbb88ff, 0.35).setDepth(4);
      this.tweens.add({ targets: ring, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    } else if (id === 'sword_b1_t4') {
      // Blade Thrust lunge forward
      const dist = 60;
      let lx = 0, ly = 0;
      if (this.player.currentFacing === 'right') lx = dist;
      else if (this.player.currentFacing === 'left') lx = -dist;
      else if (this.player.currentFacing === 'down') ly = dist;
      else ly = -dist;

      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(lx * 4.5, ly * 4.5);
      this.time.delayedCall(120, () => {
        if (this.player.active) {
          this.doMeleeHit(this.player.currentFacing, 1.4, 30, 50, true);
        }
      });
    } else if (id === 'sword_cap') {
      // Perfect Tempo 3-hit flurry
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 120, () => {
          if (this.player.active) {
            // Check if hits connected. If so, refund other cooldowns.
            let connected = false;
            let range = 46;
            let ax = this.player.x, ay = this.player.y;
            if (this.player.currentFacing === 'right') ax += range;
            else if (this.player.currentFacing === 'left')  ax -= range;
            else if (this.player.currentFacing === 'down')  ay += range;
            else                         ay -= range;
            
            for (const child of this.enemies.getChildren()) {
              const e = child as unknown as Enemy;
              if (e.active && Phaser.Math.Distance.Between(ax, ay, e.x, e.y) < range) {
                connected = true;
              }
            }
            this.doMeleeHit(this.player.currentFacing, 0.7, 10, range, false);
            if (connected) {
              // Refund other active skill cooldowns by 1.5s
              for (const [cdId, ms] of this.player.skillCooldowns.entries()) {
                if (cdId !== 'sword_cap' && ms > 0) {
                  this.player.skillCooldowns.set(cdId, Math.max(0, ms - 1500));
                }
              }
              this.floatText('REFUND!', this.player.x, this.player.y - 20, '#aaffdd');
            }
          }
        });
      }
    } else if (id === 'arch_b2_t2') {
      // Arrow Rain AoE zone
      let tx = this.player.x, ty = this.player.y;
      const dist = 90;
      if (this.player.currentFacing === 'right') tx += dist;
      else if (this.player.currentFacing === 'left') tx -= dist;
      else if (this.player.currentFacing === 'down') ty += dist;
      else ty -= dist;

      const rainZone = this.add.circle(tx, ty, 50, 0x33ff68, 0.25).setDepth(2);
      this.tweens.add({ targets: rainZone, scaleX: 1.1, scaleY: 1.1, duration: 200, yoyo: true, repeat: 4 });

      // Falling arrow visuals
      for (let k = 0; k < 12; k++) {
        this.time.delayedCall(Math.random() * 1600, () => {
          if (!rainZone.active) return;
          const ax = tx + (Math.random() - 0.5) * 80;
          const ay = ty - 45 + (Math.random() - 0.5) * 80;
          const arrow = this.add.rectangle(ax, ay, 2, 8, 0x88ffbb).setDepth(3);
          this.tweens.add({
            targets: arrow, y: ay + 45, alpha: 0, duration: 150,
            onComplete: () => arrow.destroy()
          });
        });
      }

      let ticks = 0;
      const rainTimer = this.time.addEvent({
        delay: 400, loop: true,
        callback: () => {
          ticks++;
          if (ticks > 5 || !rainZone.active) {
            rainZone.destroy(); rainTimer.destroy(); return;
          }
          for (const child of this.enemies.getChildren()) {
            const e = child as unknown as Enemy;
            if (e.active && Phaser.Math.Distance.Between(tx, ty, e.x, e.y) < 50) {
              const { dmg } = this.player.computeAttackDamage(0.30);
              e.takeDamage(dmg, tx, ty, 2);
              e.addThreat('player', dmg);
              this.player.onHitDealt(dmg);
              e.applyStagger(150);
              this.floatText(`${dmg}`, e.x, e.y - 20, '#aaffcc');
            }
          }
        }
      });
    } else if (id === 'arch_cap') {
      const ring = this.add.circle(this.player.x, this.player.y, 30, 0x33ffaa, 0.15).setDepth(2).setStrokeStyle(1.5, 0x33ffaa);
      this.tweens.add({ targets: ring, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 6000, onComplete: () => ring.destroy() });
    } else if (id === 'tank_b2_t2') {
      // Taunt Slam AoE threat Counter
      const ring = this.add.circle(this.player.x, this.player.y, 10, 0xffaa00, 0.4).setDepth(4);
      this.tweens.add({ targets: ring, scaleX: 7.0, scaleY: 7.0, alpha: 0, duration: 320, onComplete: () => ring.destroy() });

      for (const child of this.enemies.getChildren()) {
        const e = child as unknown as Enemy;
        if (e.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < 70) {
          e.takeDamage(12, this.player.x, this.player.y, 35);
          e.addThreat('player', 150); // huge aggro taunt
          e.alert();
          this.floatText('TAUNTED', e.x, e.y - 20, '#ffee55');
        }
      }
      this.cameras.main.shake(150, 0.012);
    } else if (id === 'tank_cap') {
      const shieldRing = this.add.circle(this.player.x, this.player.y, 25, 0xffdd44, 0.2).setDepth(2).setStrokeStyle(1.5, 0xffcc33);
      this.tweens.add({ targets: shieldRing, scaleX: 1.2, scaleY: 1.2, duration: 8000, onComplete: () => shieldRing.destroy() });
      this.tweens.add({
        targets: shieldRing, alpha: 0.4, yoyo: true, repeat: -1, duration: 400
      });
      // follow player
      this.time.addEvent({
        delay: 16, repeat: 500,
        callback: () => {
          if (shieldRing.active) shieldRing.setPosition(this.player.x, this.player.y);
        }
      });
    } else if (id === 'assa_b2_t2') {
      // Poison Dart firing
      const speed = 280;
      const { dmg, isCrit } = this.player.computeAttackDamage(0.40);
      this.firePoisonDart(this.player.currentFacing, speed, dmg, isCrit);
    } else if (id === 'assa_cap') {
      // Death Mark
      let nearest: Enemy | null = null;
      let minDist = 180;
      for (const child of this.enemies.getChildren()) {
        const e = child as unknown as Enemy;
        if (e.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < minDist) {
          minDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
          nearest = e;
        }
      }
      if (nearest) {
        this.floatText('MARKED', nearest.x, nearest.y - 28, '#ff3333');
        nearest.setData('deathMarked', true);
        const markText = this.add.text(nearest.x, nearest.y - 26, '💀', { fontSize: '10px', color: '#ff3333' }).setOrigin(0.5).setDepth(8);
        const followTimer = this.time.addEvent({
          delay: 16, loop: true,
          callback: () => {
            if (!nearest || !nearest.active || !nearest.getData('deathMarked')) {
              markText.destroy(); followTimer.destroy(); return;
            }
            markText.setPosition(nearest.x, nearest.y - 26);
          }
        });
        this.time.delayedCall(5000, () => {
          if (nearest && nearest.active) nearest.setData('deathMarked', false);
          markText.destroy(); followTimer.destroy();
        });
      } else {
        this.floatText('NO TARGET', this.player.x, this.player.y - 20, '#ff4444');
      }
    } else if (id === 'sage_b2_t2') {
      // Glyph Blast corresponding to active element
      const color = this.player.activeElement === 'fire' ? 0xff3300 : (this.player.activeElement === 'ice' ? 0x00aaff : 0xaa00ff);
      const blast = this.add.circle(this.player.x, this.player.y, 10, color, 0.4).setDepth(4);
      this.tweens.add({ targets: blast, scaleX: 6.0, scaleY: 6.0, alpha: 0, duration: 250, onComplete: () => blast.destroy() });

      for (const child of this.enemies.getChildren()) {
        const e = child as unknown as Enemy;
        if (e.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < 60) {
          const { dmg } = this.player.computeAttackDamage(0.60);
          e.takeDamage(dmg, this.player.x, this.player.y, 12);
          e.addThreat('player', dmg);
          this.player.onHitDealt(dmg);
          
          if (this.player.activeElement === 'fire') {
            StatusSystem.triggerAilment(e, 'burn', this);
            for (const h of this.hazards) {
              if (h.hazardType === 'oil' && Phaser.Math.Distance.Between(this.player.x, this.player.y, h.x, h.y) < 60) {
                h.ignite(this);
              }
            }
          } else if (this.player.activeElement === 'ice') {
            StatusSystem.triggerAilment(e, 'frozen', this);
          } else if (this.player.activeElement === 'lightning') {
            StatusSystem.triggerAilment(e, 'shock', this);
          }
        }
      }
    } else if (id === 'sage_cap') {
      // Convergence Detonation (AoE on element stance combiners)
      let target: Enemy | null = null;
      let minDist = 180;
      for (const child of this.enemies.getChildren()) {
        const e = child as unknown as Enemy;
        if (e.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < minDist) {
          minDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
          target = e;
        }
      }
      if (target) {
        // Detonate convergence
        const color = 0xffffff;
        const blast = this.add.circle(target.x, target.y, 10, color, 0.6).setDepth(4);
        this.tweens.add({ targets: blast, scaleX: 6.0, scaleY: 6.0, alpha: 0, duration: 300, onComplete: () => blast.destroy() });
        this.cameras.main.flash(100, 255, 255, 255, false);

        // Convergence deals 80 flat damage (elemental reaction detonation)
        target.takeDamage(80, this.player.x, this.player.y, 40);
        target.addThreat('player', 80);
        this.player.onHitDealt(80);
        this.floatText('CONVERGENCE!', target.x, target.y - 28, '#ff55ff');
      } else {
        this.floatText('NO TARGET', this.player.x, this.player.y - 20, '#ff4444');
      }
    }
  }

  private onParrySuccess(data: { px: number; py: number; fromX?: number; fromY?: number }): void {
    this.floatText('PARRY!', data.px, data.py - 24, '#ffee33');
    this.cameras.main.flash(100, 255, 255, 200, false);

    // Stagger nearest enemy
    this.onPerfectGuard({ px: data.px, py: data.py });

    // Execute Riposte guaranteed crit counter-thrust!
    this.time.delayedCall(100, () => {
      if (this.player.active) {
        this.floatText('RIPOSTE!', this.player.x, this.player.y - 20, '#ffbb33');
        // Push forward
        const dist = 52;
        let lx = 0, ly = 0;
        if (this.player.currentFacing === 'right') lx = dist;
        else if (this.player.currentFacing === 'left') lx = -dist;
        else if (this.player.currentFacing === 'down') ly = dist;
        else ly = -dist;
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(lx * 4, ly * 4);
        
        // Thrust dealing 1.8x damage
        this.time.delayedCall(100, () => {
          if (this.player.active) {
            this.doMeleeHit(this.player.currentFacing, 1.8, 45, 52, true);
          }
        });
      }
    });
  }

  private onPerfectGuard(data: { px: number; py: number; fromX?: number; fromY?: number }): void {
    let target: Enemy | null = null;
    let minDist = 999999;
    const searchX = data.fromX !== undefined ? data.fromX : data.px;
    const searchY = data.fromY !== undefined ? data.fromY : data.py;

    for (const child of this.enemies.getChildren()) {
      const e = child as unknown as Enemy;
      if (e.active) {
        const dist = Phaser.Math.Distance.Between(searchX, searchY, e.x, e.y);
        if (dist < minDist) {
          minDist = dist;
          target = e;
        }
      }
    }

    if (target && minDist < 150) {
      let duration = 800;
      if (this.player && this.player.active && this.player.hasSetBonus('captain', 4)) {
        duration = 1200;
      }
      target.applyStagger(duration);
      this.floatText('STAGGER!', target.x, target.y - 20, '#ffbb33');
    }
  }

  private firePoisonDart(facing: string, speed: number, dmg: number, isCrit: boolean): void {
    const proj = this.physics.add.image(this.player.x, this.player.y, 'arrow').setDepth(4).setTint(0xcc33ff);
    let vx = 0, vy = 0;
    if (facing === 'right')     { vx =  speed; proj.setAngle(0); }
    else if (facing === 'left') { vx = -speed; proj.setFlipX(true); }
    else if (facing === 'down') { vy =  speed; proj.setAngle(90); }
    else                        { vy = -speed; proj.setAngle(-90); }
    proj.setVelocity(vx, vy);

    const hitCheck = this.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        if (!proj.active) { hitCheck.destroy(); return; }
        for (const child of this.enemies.getChildren()) {
          const e = child as unknown as Enemy;
          if (e.active && Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < 24) {
            e.takeDamage(dmg, proj.x, proj.y, 5, 'poison');
            e.addThreat('player', dmg);
            this.player.onHitDealt(dmg);
            StatusSystem.applyBuildUp(e, 'poison', 100, this, this.player);

            const color = isCrit ? '#ffee00' : '#cc88ff';
            this.floatText(isCrit ? `${dmg}!` : `${dmg}`, e.x, e.y - 20, color);
            proj.destroy(); hitCheck.destroy(); return;
          }
        }
        const { x, y } = proj;
        const { width: bw, height: bh } = this.physics.world.bounds;
        if (x < 0 || y < 0 || x > bw || y > bh) { proj.destroy(); hitCheck.destroy(); }
      },
    });
  }


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

  private doMeleeHit(facing: string, mv: number, poiseDmg: number, range: number, isHeavy: boolean): void {
    let ax = this.player.x, ay = this.player.y;
    if (facing === 'right') ax += range;
    else if (facing === 'left')  ax -= range;
    else if (facing === 'down')  ay += range;
    else                         ay -= range;

    const scale = isHeavy ? 1.7 : 1.0;
    const slash = this.add.image(ax, ay, 'slash').setAlpha(0.85).setDepth(5).setScale(scale);
    if (isHeavy) slash.setTint(0xffaa44);
    this.tweens.add({ targets: slash, alpha: 0, scaleX: scale * 1.4, scaleY: scale * 1.4, duration: 180, onComplete: () => slash.destroy() });

    let hitConnected = false;
    const el = this.getPlayerAttackElement();
    for (const child of this.enemies.getChildren()) {
      const e = child as unknown as Enemy;
      if (!e.active) continue;
      if (Phaser.Math.Distance.Between(ax, ay, e.x, e.y) < range) {
        const { dmg, isCrit } = this.player.computeAttackDamage(mv);
        e.takeDamage(dmg, this.player.x, this.player.y, poiseDmg, el);
        e.addThreat('player', dmg); // §11 threat table
        this.player.onHitDealt(dmg);
        
        // Apply element build-up
        this.applyAttackAilment(e, el);

        const color = isCrit ? '#ffee00' : '#ffffff';
        this.floatText(isCrit ? `${dmg}!` : `${dmg}`, e.x, e.y - 20, color);
        hitConnected = true;
      }
    }

    if (hitConnected) {
      this.player.onMeleeHitConnected();
    }
  }

  private handleRangedAttack(): void {
    const save = SaveManager.load();
    if (!save) return;

    // Ammo check/consumption
    const isAmmoBased = this.player.attackType === 'arrow' || this.player.attackType === 'bolt';
    if (isAmmoBased) {
      const ammoId = this.player.attackType === 'arrow' ? 'arrow' : 'bolt';
      const success = this.player.consumeAmmo(save.inventory);
      if (!success) {
        this.floatText('NO AMMO!', this.player.x, this.player.y - 20, '#ff4444');
        return;
      }
      SaveManager.write(save);
      // Emit updates
      const qty = save.inventory.find(s => s.itemId === ammoId)?.qty ?? 0;
      this.game.events.emit('ammo-update', { ammoId, qty });
      this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
    }

    if (this.player.attackType === 'arrow') {
      const { dmg, isCrit } = this.player.computeAttackDamage(0.35);
      this.fireProjectile('arrow', this.player.currentFacing, 220, dmg, isCrit, 1);
    } else if (this.player.attackType === 'bolt') {
      const pierce = this.player.rangedPierceCount;
      const { dmg, isCrit } = this.player.computeAttackDamage(0.55);
      this.fireProjectile('bolt', this.player.currentFacing, 250, dmg, isCrit, pierce);
    } else if (this.player.attackType === 'fireball') {
      const { dmg, isCrit } = this.player.computeAttackDamage(0.50);
      this.fireProjectile('fireball', this.player.currentFacing, 140, dmg, isCrit, 1);
    } else if (this.player.attackType === 'glyph') {
      this.handleGlyphCast();
    }
  }

  private fireProjectile(key: string, facing: string, speed: number, dmg: number, isCrit: boolean, pierceCount = 1): void {
    const proj = this.physics.add.image(this.player.x, this.player.y, key).setDepth(4);
    let vx = 0, vy = 0;
    if (facing === 'right')     { vx =  speed; proj.setAngle(0); }
    else if (facing === 'left') { vx = -speed; proj.setFlipX(true); }
    else if (facing === 'down') { vy =  speed; proj.setAngle(90); }
    else                        { vy = -speed; proj.setAngle(-90); }
    proj.setVelocity(vx, vy);

    const hitEnemies = new Set<Enemy>();
    let remainingPierce = pierceCount;

    const hitCheck = this.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        if (!proj.active) { hitCheck.destroy(); return; }
        for (const child of this.enemies.getChildren()) {
          const e = child as unknown as Enemy;
          if (!e.active || hitEnemies.has(e)) continue;
          if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < 24) {
            const el = this.getPlayerAttackElement();
            e.takeDamage(dmg, proj.x, proj.y, 5, el);
            e.addThreat('player', dmg);
            this.player.onHitDealt(dmg);
            
            // Apply attack build-up
            this.applyAttackAilment(e, el);

            const color = isCrit ? '#ffee00' : '#aaccff';
            this.floatText(isCrit ? `${dmg}!` : `${dmg}`, e.x, e.y - 20, color);
            
            // Ignite nearby oil hazards if fireball
            if (key === 'fireball') {
              for (const h of this.hazards) {
                if (h.hazardType === 'oil' && Phaser.Math.Distance.Between(proj.x, proj.y, h.x, h.y) < 32) {
                  h.ignite(this);
                }
              }
            }

            hitEnemies.add(e);
            remainingPierce--;
            if (remainingPierce <= 0) {
              proj.destroy(); hitCheck.destroy(); return;
            }
          }
        }
        const { x, y } = proj;
        const { width: bw, height: bh } = this.physics.world.bounds;
        if (x < 0 || y < 0 || x > bw || y > bh) { proj.destroy(); hitCheck.destroy(); }
      },
    });
    this.time.delayedCall(1500, () => { if (proj.active) proj.destroy(); hitCheck.destroy(); });
  }

  private handleGlyphCast(): void {
    if (this.activeGlyph && this.activeGlyph.active) {
      // Detonate glyph
      const gx = this.activeGlyph.x;
      const gy = this.activeGlyph.y;
      this.activeGlyph.destroy();
      this.activeGlyph = null;

      const blast = this.add.circle(gx, gy, 60, 0xff55ff, 0.6).setDepth(4);
      this.tweens.add({
        targets: blast,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: 250,
        onComplete: () => blast.destroy()
      });

      const el = this.player.classKey === 'sage' ? this.player.activeElement : 'physical';
      const { dmg, isCrit } = this.player.computeAttackDamage(0.60);
      for (const child of this.enemies.getChildren()) {
        const e = child as unknown as Enemy;
        if (!e.active) continue;
        if (Phaser.Math.Distance.Between(gx, gy, e.x, e.y) < 60) {
          e.takeDamage(dmg, gx, gy, 12, el);
          e.addThreat('player', dmg);
          this.player.onHitDealt(dmg);
          this.applyAttackAilment(e, el as Element);
          const color = isCrit ? '#ffee00' : '#ff88ff';
          this.floatText(isCrit ? `${dmg}!` : `${dmg}`, e.x, e.y - 20, color);
        }
      }
      if (el === 'fire') {
        for (const h of this.hazards) {
          if (h.hazardType === 'oil' && Phaser.Math.Distance.Between(gx, gy, h.x, h.y) < 60) {
            h.ignite(this);
          }
        }
      }

      this.floatText('EXPLODE!', gx, gy - 20, '#ff88ff');
      this.cameras.main.shake(120, 0.008);
    } else {
      // Place glyph
      let tx = this.player.x;
      let ty = this.player.y;
      const distance = 80;
      if (this.player.currentFacing === 'right') tx += distance;
      else if (this.player.currentFacing === 'left') tx -= distance;
      else if (this.player.currentFacing === 'down') ty += distance;
      else ty -= distance;

      const glyph = this.add.circle(tx, ty, 16, 0x9966cc, 0.4).setDepth(2).setStrokeStyle(1, 0xddaaff);
      this.activeGlyph = glyph;
      this.floatText('Glyph Placed', tx, ty - 12, '#ddaaff');

      this.tweens.add({
        targets: glyph,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0.7,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    }
  }

  // ── Hotbar item use ────────────────────────────────────────────────────────────

  private checkHotbarInput(): void {
    const itemIds = ['health_potion', 'mana_potion', 'smoke_bomb', 'whetstone'];
    for (let i = 0; i < this.hotbarKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.hotbarKeys[i])) {
        this.useConsumable(itemIds[i]);
        break;
      }
    }
  }

  private useConsumable(itemId: string): void {
    const save = SaveManager.load();
    if (!save) return;
    const idx = save.inventory.findIndex(s => s.itemId === itemId && s.qty > 0);
    if (idx === -1) return;

    const started = this.player.startChannel(TUNING.potionChannel, () => {
      // Re-load save inside callback to avoid stale reference
      const s = SaveManager.load();
      if (!s) return;
      const i2 = s.inventory.findIndex(is => is.itemId === itemId && is.qty > 0);
      if (i2 === -1) return;
      s.inventory[i2].qty--;
      if (s.inventory[i2].qty <= 0) s.inventory.splice(i2, 1);

      if (itemId === 'health_potion') {
        this.player.heal(40);
        this.floatText('+40 HP', this.player.x, this.player.y - 30, '#88ff88');
      } else if (itemId === 'mana_potion') {
        this.player.restoreMp(30);
        this.floatText('+30 MP', this.player.x, this.player.y - 30, '#88aaff');
      } else if (itemId === 'smoke_bomb') {
        this.floatText('Smoke!', this.player.x, this.player.y - 30, '#cccccc');
      } else if (itemId === 'whetstone') {
        this.player.restoreEdge();
        this.floatText('SHARPENED!', this.player.x, this.player.y - 30, '#ffaa44');
      }

      s.currentHp = this.player.currentHp;
      s.currentMp = this.player.currentMp;
      SaveManager.write(s);
      this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(s.inventory));
    });

    if (!started) return; // player was mid-combat, can't channel

    this.floatText('...', this.player.x, this.player.y - 20, '#88ff88');
  }

  private buildHotbarData(): { slots: { label: string; qty: number }[] } {
    const save = SaveManager.load();
    return this.buildHotbarDataFromInventory(save?.inventory ?? []);
  }

  private buildHotbarDataFromInventory(
    inventory: { itemId: string; qty: number }[],
  ): { slots: { label: string; qty: number }[] } {
    const ids = ['health_potion', 'mana_potion', 'smoke_bomb', 'whetstone'];
    return {
      slots: ids.map(id => {
        const qty = inventory.find(s => s.itemId === id)?.qty ?? 0;
        return { label: id, qty };
      }),
    };
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
      if (drop) this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
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
    this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
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

  private spawnHazards(): void {
    const cells = this.collectFloorCells(this.floorData.tiles);
    const sc = { col: this.floorData.spawnCol, row: this.floorData.spawnRow };
    const potential = cells.filter(cell => {
      const dist = Phaser.Math.Distance.Between(cell.col, cell.row, sc.col, sc.row);
      return dist > 6;
    });

    const hazardTypes: HazardType[] = ['water', 'oil', 'ice', 'gas'];
    const count = Math.min(potential.length, 30);

    for (let i = potential.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [potential[i], potential[j]] = [potential[j], potential[i]];
    }

    for (let i = 0; i < count; i++) {
      const cell = potential[i];
      const type = hazardTypes[Math.floor(Math.random() * hazardTypes.length)];
      const h = new Hazard(this, cell.col, cell.row, type);
      this.hazards.push(h);
      this.hazardGroup.add(h);
    }
  }

  private handlePlayerHazardOverlap(player: Player, hazard: Hazard): void {
    const delta = this.game.loop.delta;
    this.applyHazardOverlap(player, hazard, delta);
  }

  private handleEnemyHazardOverlap(enemy: Enemy, hazard: Hazard): void {
    const delta = this.game.loop.delta;
    this.applyHazardOverlap(enemy, hazard, delta);
  }

  private applyHazardOverlap(target: Player | Enemy, hazard: Hazard, delta: number): void {
    if (hazard.hazardType === 'water') {
      StatusSystem.applyBuildUp(target, 'wet', 35 * delta / 1000, this);
      if (target.activeAilments.has('burn')) {
        target.activeAilments.delete('burn');
        target.setData('burn_tick_accum', 0);
      }
    } else if (hazard.hazardType === 'oil') {
      target.setData('in_oil', true);
    } else if (hazard.hazardType === 'ice') {
      target.setData('on_ice', true);
      StatusSystem.applyBuildUp(target, 'chill', 15 * delta / 1000, this);
    } else if (hazard.hazardType === 'gas') {
      StatusSystem.applyBuildUp(target, 'poison', 20 * delta / 1000, this);
    } else if (hazard.hazardType === 'fire') {
      StatusSystem.applyBuildUp(target, 'burn', 30 * delta / 1000, this);
      
      let fireAccum = target.getData('hazard_fire_accum') ?? 0;
      fireAccum += delta;
      if (fireAccum >= 500) {
        fireAccum -= 500;
        if (target instanceof Enemy) {
          target.takeDamage(1, undefined, undefined, 0, 'fire');
        } else {
          target.takeDamage(1, undefined, undefined, 'fire');
        }
      }
      target.setData('hazard_fire_accum', fireAccum);
    }
  }

  private getPlayerAttackElement(): Element {
    if (this.player.classKey === 'sage') {
      return this.player.activeElement as Element;
    }
    if (this.player.classKey === 'archer') {
      const c = this.player.activeCoating;
      if (c === 'poison') return 'poison';
      if (c === 'paralyze') return 'lightning';
      if (c === 'power') return 'fire';
    }
    const fam = this.player.activeFamily;
    if (fam === 'mace') return 'blunt';
    return 'physical';
  }

  private applyAttackAilment(target: Enemy | Player, el: Element): void {
    const poisonBonus = (this.player && this.player.active && this.player.hasSetBonus('brood', 4)) ? 10 : 0;

    if (el === 'fire') {
      StatusSystem.applyBuildUp(target, 'burn', 25, this, this.player);
    } else if (el === 'ice') {
      StatusSystem.applyBuildUp(target, 'chill', 25, this, this.player);
    } else if (el === 'lightning') {
      StatusSystem.applyBuildUp(target, 'shock', 25, this, this.player);
    } else if (el === 'poison') {
      StatusSystem.applyBuildUp(target, 'poison', 25 + poisonBonus, this, this.player);
    } else if (el === 'blunt') {
      StatusSystem.applyBuildUp(target, 'stun', 25, this, this.player);
    }

    if (poisonBonus > 0 && el !== 'poison') {
      StatusSystem.applyBuildUp(target, 'poison', poisonBonus, this, this.player);
    }
  }
}
