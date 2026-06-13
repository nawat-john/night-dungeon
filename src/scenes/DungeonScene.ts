import Phaser from 'phaser';
import {
  TILE, calcZoom, FOV_RADIUS,
  TRAP_SPIKE_DMG, TRAP_ALARM_RADIUS,
  AMBIENT_SPAWN_INTERVAL, AMBIENT_SPAWN_MIN_DIST, AMBIENT_SPAWN_MAX_DIST,
  TUNING,
} from '../config';
import { AudioManager } from '../systems/AudioManager';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { WarpPad } from '../entities/WarpPad';
import { Trap } from '../entities/Trap';
import {
  generateFloor, T_WALL, T_WARP, T_PILLAR,
  T_FLOOR_FOREST, T_FLOOR_DEAD, T_FLOOR_POND, T_FLOOR_ROCK,
  T_FLOOR_FUNGAL, T_FLOOR_BARRACKS, T_FLOOR_FOUNDRY, T_FLOOR_FROZEN,
  T_FLOOR_CATACOMBS, T_FLOOR_VOID, T_FLOOR_THRONE,
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
import {
  getThemeDefs, EnemyDef, EnemyTheme,
  defsForFloor, rollEliteConfig, spawnBudgetForFloor, ARCHETYPE_COST,
} from '../data/enemies';
import { ITEMS } from '../data/items';
import { addToInventory, sortInventory } from '../lib/inventory';
import { CharacterSave, ItemInstance, Affix, RunHistoryEntry } from '../types';
import { getSkillTree } from '../data/skills';
import { Boss } from '../entities/Boss';
import { bossForFloor, BossBreakPart } from '../data/bosses';
import { AnomalyId, ANOMALY_DEFS, rollAnomaly } from '../data/anomalies';
import { BOUNTY_POOL } from '../data/bounties';
import { Hazard, HazardType } from '../entities/Hazard';
import { StatusSystem, Element, Ailment } from '../systems/StatusSystem';
import { resolveHit } from '../systems/CombatSystem';
import { Companion } from '../entities/Companion';
import { SPECIALIZATIONS, getSpecialization, getSlayerBodyType } from '../data/specializations';
import { defById, COMPANION_DEFS } from '../data/companions';
import { LootSystem, championMatForFloor } from '../data/loot';
import { ResearchSystem } from '../systems/ResearchSystem';

const VIS_HIDDEN   = 0;
const VIS_EXPLORED = 1;
const VIS_VISIBLE  = 2;

const NEAR_WARP_TILES = 30;

export class DungeonScene extends Phaser.Scene {
  public player!: Player;
  private hazards: Hazard[] = [];
  private hazardGroup!: Phaser.Physics.Arcade.StaticGroup;
  private activeGlyph: Phaser.GameObjects.Arc | null = null;
  private enemies!: Phaser.Physics.Arcade.Group;
  public warpPads: WarpPad[] = [];
  private traps: Trap[] = [];
  private warping = false;
  private floor = 1;
  private seed = 0;

  public tiles: number[][] = [];
  public visibility!: Uint8Array;
  public mapCols = 0;
  public mapRows = 0;
  private mapLayer!: Phaser.Tilemaps.TilemapLayer;
  private prevVisSet = new Set<number>();

  private ambientTimer = 0;
  private bosses: Boss[] = [];

  // §22 Companions
  private companions: Companion[] = [];
  private companionTabKey!: Phaser.Input.Keyboard.Key;

  // §21 Camping
  private campSites: { sprite: Phaser.GameObjects.Image; col: number; row: number }[] = [];
  private campChannelMs   = 0;
  private campChannelTarget: { col: number; row: number } | null = null;
  private campChannelBar: Phaser.GameObjects.Rectangle | null = null;
  private campPanelOpen   = false;

  // §20 Anomaly
  private activeAnomaly: AnomalyId | null = null;
  private anomalyState: Record<string, number | boolean> = {};
  public anomalyProps: { sprite: Phaser.GameObjects.Image; col: number; row: number; propType: string; interacted: boolean }[] = [];
  private anomalyTimer = 0;
  private anomalyFovRadius = 0;
  private playerLastHitMs = 0;
  public floorData!: FloorData;
  private openedChests = new Set<string>();
  private consolidatedPanel: Phaser.GameObjects.Container | null = null;
  private leftActiveTab: 'equip' | 'stats' | 'skills' = 'equip';
  private rightActiveTab: 'all' | 'gear' | 'use' | 'mat' = 'all';
  private consolidatedKeydownListener: ((event: KeyboardEvent) => void) | null = null;
  private tooltipBox: Phaser.GameObjects.Container | null = null;
  private inventoryKey!: Phaser.Input.Keyboard.Key;
  private charKey!: Phaser.Input.Keyboard.Key;
  private hotbarKeys: Phaser.Input.Keyboard.Key[] = [];
  private showDamageNumbers = true;
  private damageToggleKey!: Phaser.Input.Keyboard.Key;

  // Live stat snapshot for character screen
  private liveStats: import('../types').Stats | null = null;

  // §26 Run tracking
  private runStartMs = 0;
  private telegraphWarningGraphics!: Phaser.GameObjects.Graphics;

  // §14 Skills & Active parry
  private charActiveTab: 'stats' | 'skills' = 'stats';
  private skillKeys!: {
    R: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
    V: Phaser.Input.Keyboard.Key;
  };

  private activeArenas: {
    roomId: string;
    bounds: { x: number; y: number; w: number; h: number };
    gates: { col: number; row: number; originalTile: number }[];
    enemies: Enemy[];
  }[] = [];
  private puzzlePlates: { sprite: Phaser.GameObjects.Image; col: number; row: number; color: 'orange' | 'blue'; roomId: string }[] = [];
  private usedPotionOnFloor5 = false;
  private tookDamageDuringBoss = false;
  private usedTorchOnFloor = false;
  private colorblindMode = false;
  private tellOpacity = 0.6;
  private remappingActive = false;
  private remappingKeyIndex = -1;
  private remapPanelText: Phaser.GameObjects.Text | null = null;
  private remapPanelBg: Phaser.GameObjects.Rectangle | null = null;
  private keyRemapBindings = [
    { label: 'Interact', keyName: 'interactKey', targetObj: 'player', keyCode: Phaser.Input.Keyboard.KeyCodes.E },
    { label: 'Inventory', keyName: 'inventoryKey', targetObj: 'scene', keyCode: Phaser.Input.Keyboard.KeyCodes.I },
    { label: 'Character', keyName: 'charKey', targetObj: 'scene', keyCode: Phaser.Input.Keyboard.KeyCodes.C },
    { label: 'Skill R', keyName: 'R', targetObj: 'skillKeys', keyCode: Phaser.Input.Keyboard.KeyCodes.R },
    { label: 'Skill F', keyName: 'F', targetObj: 'skillKeys', keyCode: Phaser.Input.Keyboard.KeyCodes.F },
    { label: 'Skill V', keyName: 'V', targetObj: 'skillKeys', keyCode: Phaser.Input.Keyboard.KeyCodes.V },
    { label: 'Dodge', keyName: 'dodgeKey', targetObj: 'player', keyCode: Phaser.Input.Keyboard.KeyCodes.Z },
    { label: 'Guard', keyName: 'guardKey', targetObj: 'player', keyCode: Phaser.Input.Keyboard.KeyCodes.G },
    { label: 'Weapon Switch', keyName: 'weaponSwitchKey', targetObj: 'player', keyCode: Phaser.Input.Keyboard.KeyCodes.Q },
  ];

  // Hazards V2 tracking
  private puffballs: { x: number; y: number; triggered: boolean; circle: Phaser.GameObjects.Arc }[] = [];
  private thinIceTiles: { col: number; row: number; collapsed: boolean; rect: Phaser.GameObjects.Rectangle | null }[] = [];
  private playerOnThinIceTimer = 0;
  private fallingBricks: { x: number; y: number; timer: number; warningCircle: Phaser.GameObjects.Arc | null; sprite: Phaser.GameObjects.Rectangle | null }[] = [];
  private nextBrickSpawnTime = 0;
  private gravetideSpawners: { x: number; y: number; nextSpawnTime: number; sprite: Phaser.GameObjects.Rectangle }[] = [];
  private gravityWells: { x: number; y: number; radius: number; outerCircle: Phaser.GameObjects.Arc; innerCircle: Phaser.GameObjects.Arc }[] = [];
  private driftingRifts: { sprite: Phaser.GameObjects.Arc; vx: number; vy: number }[] = [];

  constructor() { super('DungeonScene'); }

  create(): void {
    this.warping      = false;
    this.ambientTimer = 0;
    this.consolidatedPanel = null;
    this.activeArenas = [];
    this.puzzlePlates = [];
    this.usedPotionOnFloor5 = false;
    this.tookDamageDuringBoss = false;
    this.usedTorchOnFloor = false;
    this.crackedWalls = [];

    // Reset V2 Hazards & Settings
    this.puffballs = [];
    this.thinIceTiles = [];
    this.playerOnThinIceTimer = 0;
    this.fallingBricks = [];
    this.nextBrickSpawnTime = 0;
    this.gravetideSpawners = [];
    this.gravityWells = [];
    this.driftingRifts = [];
    this.remappingActive = false;
    this.remappingKeyIndex = -1;
    this.remapPanelText = null;
    this.remapPanelBg = null;
    this.colorblindMode = false;
    this.tellOpacity = 0.6;

    const save = SaveManager.load();
    if (!save) { this.scene.start('MainMenuScene'); return; }

    // Track run start time from the save's createdAt (persists across floor transitions)
    this.runStartMs = new Date(save.createdAt).getTime();

    this.floor = save.dungeonFloor;
    this.seed  = save.floorSeed;

    // §24 Reset pity/anti-streak on a fresh run (floor 1 = new character)
    if (this.floor === 1) LootSystem.resetStreaks();

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
    this.runSpawnDirector(floorCells, spawnCol, spawnRow);

    this.physics.add.collider(this.enemies, this.mapLayer);
    this.physics.add.collider(this.enemies, this.enemies);

    // ── Boss ──────────────────────────────────────────────────────────────────
    this.bosses = [];
    this.spawnFloorBoss(floorCells);

    this.placeDecorations();
    this.placeChests();
    this.spawnRoomObjects();

    // ── Anomaly ───────────────────────────────────────────────────────────────
    this.buildAnomalyTextures();
    const aRng = mkDecoRng(this.seed ^ 0xcafebabe);
    this.activeAnomaly = rollAnomaly(this.floor, aRng);
    this.anomalyState  = {};
    this.anomalyProps  = [];
    this.anomalyTimer  = 0;
    this.anomalyFovRadius = FOV_RADIUS;
    if (this.activeAnomaly) {
      this.initAnomaly(floorCells, aRng);
      const adef = ANOMALY_DEFS.find(a => a.id === this.activeAnomaly)!;
      if (this.activeAnomaly === 'dimensional_rift' || this.activeAnomaly === 'mirror_rift') {
        AudioManager.startDrone('rift', 65);
      } else if (this.activeAnomaly === 'blood_moon') {
        AudioManager.startDrone('blood_moon', 45);
      }
      this.time.delayedCall(800, () => {
        this.game.events.emit('anomaly-whisper', adef.whisper);
        this.cameras.main.flash(600, 80, 0, 120, true);
      });
    }

    // Play floor music on create
    AudioManager.playMusic('floor');

    // §20 player-hit event — track for clockwork judge
    this.game.events.on('player-hit', () => {
      this.playerLastHitMs = this.time.now;
      this.tookDamageDuringBoss = true;
      if (this.activeAnomaly === 'clockwork_judge') {
        this.anomalyState['tookDmgThisChampion'] = 1;
      }
    }, this);

    // ── §21 Camp sites ────────────────────────────────────────────────────────
    this.campSites          = [];
    this.campChannelMs      = 0;
    this.campChannelTarget  = null;
    this.campChannelBar     = null;
    this.campPanelOpen      = false;
    this.placeCampSites();

    // ── §22 Companions ────────────────────────────────────────────────────────
    this.buildCompanionTextures();
    this.companions = [];
    if (this.floor !== 9) this.spawnCompanions(save);

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
    this.companionTabKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.damageToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.O);

    // Spawn protection — no damage for the first second after loading a floor
    this.player.spawnProtMs = TUNING.spawnProtection;

    // §11 Perfect guard → stagger attacker
    this.game.events.on('perfect-guard', this.onPerfectGuard, this);
    this.game.events.on('champion-break', this.onChampionBreak, this);
    this.game.events.on('perfect-dodge', this.onPerfectDodge, this);
    this.game.events.on('topple-brute', this.onToppleBrute, this);

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
      this.game.canvas.style.filter = '';
      if (this.telegraphWarningGraphics) this.telegraphWarningGraphics.destroy();
      this.game.events.off('perfect-guard', this.onPerfectGuard, this);
      this.game.events.off('champion-break', this.onChampionBreak, this);
      this.game.events.off('perfect-dodge', this.onPerfectDodge, this);
      this.game.events.off('topple-brute', this.onToppleBrute, this);
      this.game.events.off('weapon-switch', onSwitch, this);
      this.game.events.off('cast-skill', this.onCastSkill, this);
      this.game.events.off('parry-success', this.onParrySuccess, this);
      this.game.events.off('player-hit', undefined, this);
      this.closeConsolidatedUI();

      // Audio Cleanup on exit/shutdown
      AudioManager.stopMusic();
      AudioManager.stopHeartbeat();
      AudioManager.stopDrone('rift');
      AudioManager.stopDrone('blood_moon');
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

    this.telegraphWarningGraphics = this.add.graphics().setDepth(50);
  }

  update(time: number, delta: number): void {
    if (this.warping) return;

    // Remap key listener (K)
    const keys = this.input.keyboard!;
    const kKey = keys.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    if (Phaser.Input.Keyboard.JustDown(kKey)) {
      this.toggleRemapPanel();
    }

    if (this.remappingActive) {
      this.handleRemappingInput();
      return;
    }

    // Colorblind toggle key (P)
    const pKey = keys.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    if (Phaser.Input.Keyboard.JustDown(pKey)) {
      this.colorblindMode = !this.colorblindMode;
      this.floatText(this.colorblindMode ? 'COLORBLIND MODE: ON' : 'COLORBLIND MODE: OFF', this.player.x, this.player.y - 28, '#ffffff');
    }

    // Tell transparency toggle key (T)
    const tKey = keys.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    if (Phaser.Input.Keyboard.JustDown(tKey)) {
      const opacities = [1.0, 0.75, 0.5, 0.25, 0.0];
      const nextIdx = (opacities.indexOf(this.tellOpacity) + 1) % opacities.length;
      this.tellOpacity = opacities[nextIdx];
      this.floatText(`TELL OPACITY: ${this.tellOpacity * 100}%`, this.player.x, this.player.y - 28, '#ffffff');
    }

    if (this.telegraphWarningGraphics) {
      this.telegraphWarningGraphics.clear();
      this.updateTelegraphWarnings(time, delta);
    }

    if (Phaser.Input.Keyboard.JustDown(this.damageToggleKey)) {
      this.showDamageNumbers = !this.showDamageNumbers;
      this.floatText(this.showDamageNumbers ? 'DAMAGE NUMBERS: ON' : 'DAMAGE NUMBERS: OFF', this.player.x, this.player.y - 28, '#ffffff');
    }

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
    const allEnemies = this.enemies.getChildren() as unknown as Enemy[];
    for (const child of allEnemies) {
      (child as unknown as Enemy).update(time, delta, this.player, playerIsMoving, allEnemies);
    }

    // Boss update
    for (const boss of this.bosses) {
      if (!boss.isDead) boss.update(time, delta, this.player, this.spawnBossMinion.bind(this));
    }

    // Player attack hits on bosses
    for (const boss of this.bosses) {
      if (boss.isDead) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y) < 90) {
        boss.setData('nearPlayer', true);
      }
    }

    this.checkAnomalyUpdate(delta);
    this.checkAnomalyInteracts();

    // §22 Companion update + command cycle
    if (Phaser.Input.Keyboard.JustDown(this.companionTabKey) && this.companions.length > 0) {
      this.companions[0].cycleCommand();
      this.game.events.emit('companion-hud-update', this.companions.map(c => c.toSaveData()));
    }
    for (const comp of this.companions) {
      comp.update(time, delta, this.enemies, this.player);
    }
    for (let i = this.companions.length - 1; i >= 0; i--) {
      if (this.companions[i].isDead) {
        this.floatText(`${this.companions[i].def.name} has fallen!`, this.companions[i].x, this.companions[i].y - 20, '#ff8888');
        this.companions[i].destroy();
        this.companions.splice(i, 1);
        this.game.events.emit('companion-hud-update', this.companions.map(c => c.toSaveData()));
      }
    }

    // §21 Camp channel (hold E 3 s near a camp, enemy interrupts)
    if (!this.campPanelOpen) this.checkCampChannel(delta);

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

    // Dynamic Boss music scaling based on proximity
    let bossIsNear = false;
    for (const boss of this.bosses) {
      if (boss.isDead) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y) < 150) {
        bossIsNear = true;
      }
    }
    if (bossIsNear && AudioManager.currentTrack !== 'boss') {
      AudioManager.playMusic('boss');
    } else if (!bossIsNear && AudioManager.currentTrack === 'boss') {
      AudioManager.playMusic('floor');
    }

    // Heartbeat warning logic for low HP (< 25%)
    if (this.player && this.player.active && this.player.currentHp > 0) {
      const hpPct = this.player.currentHp / this.player.maxHp;
      if (hpPct < 0.25) {
        const rateMs = 400 + (hpPct / 0.25) * 600;
        AudioManager.startHeartbeat(rateMs);
        AudioManager.updateHeartbeatRate(rateMs);
      } else {
        AudioManager.stopHeartbeat();
      }
    } else {
      AudioManager.stopHeartbeat();
    }

    this.updateRoomArchetypesAndSummons(time, delta);

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

    let radius = this.anomalyFovRadius;
    const save = SaveManager.load();
    if (save && save.blackout) {
      radius = Math.min(4, radius);
    }

    const newVis = new Set<number>();
    computeFOV(this.tiles, this.mapCols, this.mapRows, px, py, radius, (col, row) => {
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
    if (this.floor === 2 && this.floorData.areaThemes) {
      const px = Math.floor(this.player.x / TILE);
      const py = Math.floor(this.player.y / TILE);
      const theme = this.themeAtTile(px, py);
      if (theme) return getThemeDefs(theme);
      return getThemeDefs('forest');
    }
    return this.buildFloorPool();
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

  // ── Boss methods ──────────────────────────────────────────────────────────────
  private spawnFloorBoss(floorCells: { col: number; row: number }[]): void {
    const defs = bossForFloor(this.floor);
    if (defs.length === 0) return;

    // Pick a cell away from warpPads[0] (first warp)
    const refX = this.warpPads.length > 0 ? this.warpPads[0].x : (this.mapCols / 2) * TILE;
    const refY = this.warpPads.length > 0 ? this.warpPads[0].y : (this.mapRows / 2) * TILE;

    // Sort cells by distance from warp; pick far end
    const sorted = [...floorCells].sort((a, b) => {
      const da = Phaser.Math.Distance.Between(a.col * TILE, a.row * TILE, refX, refY);
      const db = Phaser.Math.Distance.Between(b.col * TILE, b.row * TILE, refX, refY);
      return db - da;
    });

    defs.forEach((def, i) => {
      const cell = sorted[Math.min(i * 40, sorted.length - 1)];
      const bx = (cell.col + 0.5) * TILE;
      const by = (cell.row + 0.5) * TILE;
      const boss = new Boss(this, bx, by, def);
      boss.on('died', () => this.onBossDied(boss));
      boss.on('part-broken', (_b: Boss, part: BossBreakPart) => this.onBossPartBroken(boss, part));
      // §P11 — Phase-skip event (e.g. Ysold Ice Heart breaks before blizzard)
      boss.on('phase-skipped', (phaseIdx: number) => {
        this.cameras.main.flash(200, 0, 200, 255, false);
        const skipMsg = def.id === 'frost_warden_ysold'
          ? '❄ ICE HEART SHATTERED — BLIZZARD AVERTED!'
          : `PHASE ${phaseIdx + 1} SKIPPED!`;
        this.showCenterText(skipMsg);
      });
      this.physics.add.existing(boss);
      this.physics.add.collider(boss, this.mapLayer);
      this.bosses.push(boss);
    });

    // §P11 — Riftmaw void cycle float text
    this.game.events.on('boss-void-cycle', (data: { label: string; bossId: string }) => {
      const bossObj = this.bosses.find(b => b.def.id === data.bossId && !b.isDead);
      if (bossObj) this.floatText(data.label, bossObj.x, bossObj.y - 36, data.label.includes('VOID') ? '#9900ff' : '#cccccc');
    });
  }

  private onBossDied(boss: Boss): void {
    const def = boss.def;
    const save = SaveManager.load();

    if (save) {
      addToInventory(save.inventory, def.dropItemId, 1);
      const itemName = ITEMS[def.dropItemId]?.name ?? def.dropItemId;
      this.floatText(`+1 ${itemName}`, boss.x, boss.y - 28, '#ffd700');

      const didLevel = this.player.gainExp(def.exp);
      if (didLevel) this.floatText('LEVEL UP!', this.player.x, this.player.y - 30, '#ffee55');
      save.exp = this.player.exp;
      save.level = this.player.level;

      // Track boss slain for run history + checkpoint unlock
      save.bossesSlain = [...(save.bossesSlain ?? []), def.name];
      SaveManager.unlockCheckpointFloor(this.floor + 1);

      // Progress boss_kill bounties
      if (save.activeBounties) {
        for (const bounty of save.activeBounties) {
          if (bounty.completed) continue;
          const tpl = BOUNTY_POOL.find(b => b.id === bounty.id);
          if (tpl?.type === 'boss_kill' && tpl.target === def.name) {
            bounty.progress = Math.min(tpl.count, bounty.progress + 1);
            if (bounty.progress >= tpl.count) bounty.completed = true;
          }
        }
      }

      SaveManager.write(save);
      this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));

      // Clockwork Judge flawless boss summon check
      if (!this.tookDamageDuringBoss && !this.anomalyState['clockwork_bell_spawned']) {
        this.anomalyState['clockwork_bell_spawned'] = true;
        const col = Math.floor(boss.x / TILE);
        const row = Math.floor(boss.y / TILE);
        this.placeProp(col, row, 'clockwork_bell', 'bell');
        this.floatText("A clockwork bell appeared!", boss.x, boss.y - 20, '#ccaaff');
        this.showCenterText("FLAWLESS VICTORY!\nA clockwork bell has appeared. Ring it to face the Clockwork Judge.");
      }
    }

    this.floatText(`+${def.exp}xp`, boss.x, boss.y - 14, '#aaddff');
    this.cameras.main.shake(400, 0.012);

    if (this.bosses.every(b => b.isDead)) {
      this.game.events.emit('boss-update', { visible: false });
      // §25 Floor 10 victory (if no ascension) or Floor 11 victory
      const hasAscension = SaveManager.getAscensionTier() > 0;
      if (this.floor === 11 || (this.floor === 10 && !hasAscension)) {
        this.time.delayedCall(600, () => this.showVictorySequence());
      } else {
        // §P11 — Floor 4 boss clear → offer Specialization pick (once per run)
        const saveNow = SaveManager.load();
        if (this.floor === 4 && saveNow && !saveNow.specialization) {
          this.time.delayedCall(800, () => this.showSpecializationPick());
        } else {
          this.showCenterText(`${def.name.toUpperCase()} DEFEATED!\nThe way forward is open.`);
        }
      }
    } else {
      this.showCenterText(`${def.name.toUpperCase()} DEFEATED!`);
    }
  }

  // ── §P11 Specialization pick modal ───────────────────────────────────────────

  private showSpecializationPick(): void {
    const sw = this.scale.width, sh = this.scale.height;
    const cx = sw / 2, cy = sh / 2;

    const overlay = this.add.rectangle(cx, cy, sw, sh, 0x000000, 0.85).setScrollFactor(0).setDepth(50);
    const container = this.add.container(cx, cy).setScrollFactor(0).setDepth(51);

    container.add(this.add.text(0, -sh * 0.35, '⚔ SPECIALIZATION', {
      fontSize: '16px', color: '#ffdd44', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));
    container.add(this.add.text(0, -sh * 0.27, 'Choose your path. This choice is permanent for this run.', {
      fontSize: '9px', color: '#ccbbee', align: 'center',
    }).setOrigin(0.5));

    const BODY_TYPES = ['flesh', 'armored', 'construct', 'beast', 'undead', 'spirit'];

    SPECIALIZATIONS.forEach((spec, i) => {
      const btnY = -sh * 0.17 + i * 44;
      const bg = this.add.rectangle(0, btnY, 280, 38, 0x1a1025, 0.95).setStrokeStyle(1.5, 0x553377).setInteractive({ useHandCursor: true });
      const nameT = this.add.text(-130, btnY - 9, spec.name, { fontSize: '10px', color: '#ffffff', fontStyle: 'bold' });
      const descT = this.add.text(-130, btnY + 4, spec.desc, { fontSize: '6px', color: '#aaaaaa', wordWrap: { width: 260 } });

      bg.on('pointerover', () => bg.setStrokeStyle(2, 0xffdd44));
      bg.on('pointerout', () => bg.setStrokeStyle(1.5, 0x553377));
      bg.on('pointerdown', () => {
        if (spec.id === 'slayer') {
          // Show body type sub-picker
          container.destroy(); overlay.destroy();
          this.showSlayerBodyTypePick(BODY_TYPES);
        } else {
          this.applySpecialization(spec.id);
          container.destroy(); overlay.destroy();
        }
      });

      container.add([bg, nameT, descT]);
    });
  }

  private showSlayerBodyTypePick(bodyTypes: string[]): void {
    const sw = this.scale.width, sh = this.scale.height;
    const cx = sw / 2, cy = sh / 2;
    const overlay = this.add.rectangle(cx, cy, sw, sh, 0x000000, 0.85).setScrollFactor(0).setDepth(50);
    const container = this.add.container(cx, cy).setScrollFactor(0).setDepth(51);
    container.add(this.add.text(0, -sh * 0.30, 'SLAYER — Choose Prey', { fontSize: '14px', color: '#ff8888' }).setOrigin(0.5));
    bodyTypes.forEach((bt, i) => {
      const btnY = -sh * 0.20 + i * 36;
      const bg = this.add.rectangle(0, btnY, 180, 28, 0x1a1025, 0.95).setStrokeStyle(1.5, 0x553377).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(0, btnY, bt.toUpperCase(), { fontSize: '9px', color: '#ffbbaa' }).setOrigin(0.5);
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0xff8844));
      bg.on('pointerout', () => bg.setStrokeStyle(1.5, 0x553377));
      bg.on('pointerdown', () => {
        this.applySpecialization(`slayer:${bt}`);
        container.destroy(); overlay.destroy();
      });
      container.add([bg, lbl]);
    });
  }

  private applySpecialization(id: string): void {
    const save = SaveManager.load();
    if (!save) return;
    save.specialization = id;
    SaveManager.write(save);
    this.player.specialization = id;
    const spec = getSpecialization(id);
    this.floatText(`SPECIALIZED: ${(spec?.name ?? id).toUpperCase()}`, this.player.x, this.player.y - 32, '#ffdd44');
    this.showCenterText(`SPECIALIZATION CHOSEN: ${(spec?.name ?? id).toUpperCase()}\nThe way forward is open.`);
    this.game.events.emit('specialization-update', { name: spec?.name ?? id });
  }

  // ── §25 Victory sequence ──────────────────────────────────────────────────────
  private showVictorySequence(): void {
    // Stop persistent sounds
    AudioManager.stopMusic();
    AudioManager.stopHeartbeat();
    AudioManager.stopDrone('rift');
    AudioManager.stopDrone('blood_moon');
    AudioManager.playSFX('victory');

    const save = SaveManager.load();
    const sw = this.scale.width, sh = this.scale.height;

    // Slow-motion effect
    this.time.timeScale  = 0.08;
    this.physics.world.timeScale = 0.08;
    this.game.canvas.style.filter = 'grayscale(100%)';

    // Full-screen desaturate overlay (flash to white then fade to grey)
    const overlay = this.add.rectangle(sw / 2, sh / 2, sw, sh, 0xffffff, 0)
      .setScrollFactor(0).setDepth(40);
    this.tweens.add({ targets: overlay, alpha: 0.55, duration: 1200, ease: 'Quad.easeIn',
      onComplete: () => {
        // Restore time
        this.time.timeScale = 1;
        this.physics.world.timeScale = 1;
        overlay.destroy();
        this.showEpilogueScreen(save);
      },
    });

    // Camera shake + flash
    this.cameras.main.shake(900, 0.02);
    this.cameras.main.flash(400, 255, 220, 100, false);
  }

  private showEpilogueScreen(save: ReturnType<typeof SaveManager.load>): void {
    const sw = this.scale.width, sh = this.scale.height, cx = sw / 2, cy = sh / 2;
    const survivedMs = Date.now() - this.runStartMs;

    // Record as a VICTORY run in history BEFORE wipe
    let newTier = 1;
    if (save) {
      const entry: RunHistoryEntry = {
        runNumber: 0,
        name: save.name,
        race: save.race,
        clazz: save.clazz,
        floorReached: this.floor,
        bossesSlain: save.bossesSlain ?? [],
        causeOfDeath: this.floor === 11 ? 'VICTORY — True Dungeon Heart slain' : 'VICTORY — The Sovereign slain',
        survivedMs,
        goldEarned: save.gold,
        endedAt: new Date().toISOString(),
        victory: true,
        title: save.title,
        biggestHit: save.biggestHit,
        rarestFind: save.rarestFind
      };
      SaveManager.appendRunHistory(entry);
      newTier = SaveManager.incrementAscensionTier();
    }

    // Dark overlay
    this.add.rectangle(cx, cy, sw, sh, 0x000000, 0.92).setScrollFactor(0).setDepth(41);

    // Gold title
    const title = this.add.text(cx, cy - sh * 0.32, 'VICTORY', {
      fontSize: '28px', color: '#ffd700', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(42).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 800, ease: 'Quad.easeOut' });

    // Subtitle
    const subText = this.floor === 11 
      ? 'The Dungeon Heart has been shattered.\nReality is safe — you are a True Conqueror.'
      : 'The Sovereign has fallen.\nThe dungeon sleeps — for now.';
    const sub = this.add.text(cx, cy - sh * 0.18, subText, {
      fontSize: '11px', color: '#ddaaff', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(42).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, delay: 600, duration: 700 });

    // Structured Run Summary Card (styled for victory)
    const card = this.createRunSummaryCard(cx, cy, save, true, '');
    card.setDepth(42);
    card.setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 600, delay: 800 });

    // Continue prompt
    const prompt = this.add.text(cx, cy + 82, 'ENTER — Return to Town', {
      fontSize: '10px', color: '#ffd700',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(42).setAlpha(0);
    this.tweens.add({ targets: prompt, alpha: { from: 0, to: 1 }, delay: 1400, duration: 600,
      onComplete: () => {
        this.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.3 }, duration: 600, yoyo: true, repeat: -1 });
      },
    });

    // Ascension Tier Unlocked line
    const ascText = `Ascension Tier ${newTier} unlocked — dungeon grows stronger.`;
    const loreT = this.add.text(cx, cy + 105, ascText, {
      fontSize: '8px', color: '#ff8844', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(42).setAlpha(0);
    this.tweens.add({ targets: loreT, alpha: 1, delay: 1700, duration: 500 });

    // Wait for ENTER — then wipe save and go to town
    this.input.keyboard!.once('keydown-ENTER', () => {
      this.game.canvas.style.filter = '';
      SaveManager.wipe();
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });
  }

  private onBossPartBroken(boss: Boss, part: BossBreakPart): void {
    const save = SaveManager.load();
    if (save) {
      addToInventory(save.inventory, part.dropItemId, 1);
      const itemName = ITEMS[part.dropItemId]?.name ?? part.dropItemId;
      this.floatText(`+1 ${itemName}`, boss.x, boss.y - 28, '#ff8800');

      if (boss.def.id === 'frost_warden_ysold' && part.id === 'frost_antlers') {
        if (save.activeBounties) {
          for (const bounty of save.activeBounties) {
            if (bounty.id === 'b_break_ysold_antlers' && !bounty.completed) {
              bounty.progress = 1;
              bounty.completed = true;
            }
          }
        }
      }

      SaveManager.write(save);
      this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
    }
    this.floatText(`${part.name} BROKEN!`, boss.x, boss.y - 48, '#ff6600');
    this.cameras.main.shake(200, 0.008);
  }

  private spawnBossMinion(x: number, y: number): void {
    const pool = defsForFloor(this.floor);
    if (pool.length === 0) return;
    const def = pool[Phaser.Math.Between(0, pool.length - 1)];
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 1 || row < 1 || col >= this.mapCols - 1 || row >= this.mapRows - 1) return;
    if (this.tiles[row]?.[col] === T_WALL || this.tiles[row]?.[col] === T_PILLAR) return;
    this.spawnOneEnemy(def, col, row);
  }

  // ── §20 Anomaly system ────────────────────────────────────────────────────────

  private buildAnomalyTextures(): void {
    // Enemy silhouettes for anomaly entities
    const enemies: [string, number, number][] = [
      ['anom_mirror_shade', 0x6622aa, 0xff0000],
      ['anom_echo_shade',   0x447799, 0x00ffff],
      ['anom_gravelord',    0x334433, 0xff0000],
      ['anom_judge',        0x886644, 0xffffff],
      ['anom_avarice',      0xcc9900, 0xffff00],
      ['anom_hunter',       0x222244, 0xff4400],
      ['anom_old_friend',   0x448844, 0xffffff],
    ];
    for (const [id, body, eye] of enemies) {
      const key = `enemy_${id}`;
      if (!this.textures.exists(key)) {
        const t = this.textures.createCanvas(key, 32, 48);
        if (!t) continue;
        const ctx = t.getCanvas().getContext('2d')!;
        ctx.fillStyle = `#${body.toString(16).padStart(6, '0')}`;
        ctx.fillRect(8, 8, 16, 34);
        ctx.fillStyle = '#' + (body > 0x888888 ? '000000' : 'ffffff');
        ctx.fillRect(10, 10, 12, 30);
        ctx.fillStyle = `#${eye.toString(16).padStart(6, '0')}`;
        ctx.fillRect(11, 14, 3, 2);
        ctx.fillRect(18, 14, 3, 2);
        t.refresh();
        if (!this.anims.exists(`${id}_idle`)) {
          this.anims.create({ key: `${id}_idle`, frames: [{ key, frame: 0 }], frameRate: 1, repeat: -1 });
          this.anims.create({ key: `${id}_walk`, frames: [{ key, frame: 0 }], frameRate: 1, repeat: -1 });
        }
      }
    }

    // Prop textures
    const props: [string, (ctx: CanvasRenderingContext2D) => void][] = [
      ['anom_candle_off', (ctx) => {
        ctx.fillStyle = '#c0a880'; ctx.fillRect(7, 6, 4, 11); // candle body
        ctx.fillStyle = '#e8d0b0'; ctx.fillRect(7, 6, 4, 1);  // top highlight
        ctx.fillStyle = '#554433'; ctx.fillRect(8, 5, 2, 2);   // wick
        ctx.fillStyle = '#3a3028'; ctx.fillRect(6, 17, 6, 2);  // wax base plate
      }],
      ['anom_candle_on', (ctx) => {
        ctx.fillStyle = '#e8d8b8'; ctx.fillRect(7, 7, 4, 10); // candle body
        ctx.fillStyle = '#fff0d0'; ctx.fillRect(7, 7, 4, 1);  // top highlight
        ctx.fillStyle = '#664433'; ctx.fillRect(8, 6, 2, 2);  // wick
        ctx.fillStyle = '#ffaa00'; ctx.fillRect(7, 2, 4, 5);  // inner flame
        ctx.fillStyle = '#ff6600'; ctx.fillRect(6, 1, 6, 4);  // outer flame
        ctx.fillStyle = '#ffee44'; ctx.fillRect(8, 1, 2, 3);  // flame core
        ctx.fillStyle = '#3a3028'; ctx.fillRect(6, 17, 6, 2); // base
      }],
      ['anom_portal', (ctx) => {
        // Outer ring dark
        ctx.fillStyle = '#220033';
        ctx.fillRect(2, 2, 16, 16);
        // Outer purple ring
        ctx.fillStyle = '#550088';
        ctx.fillRect(2, 2, 16, 3); ctx.fillRect(2, 15, 16, 3);
        ctx.fillRect(2, 2, 3, 16); ctx.fillRect(15, 2, 3, 16);
        // Mid ring
        ctx.fillStyle = '#8822cc';
        ctx.fillRect(4, 4, 12, 2); ctx.fillRect(4, 14, 12, 2);
        ctx.fillRect(4, 4, 2, 12); ctx.fillRect(14, 4, 2, 12);
        // Inner glow rings
        ctx.fillStyle = '#bb44ff';
        ctx.fillRect(6, 6, 8, 2); ctx.fillRect(6, 12, 8, 2);
        ctx.fillRect(6, 6, 2, 8); ctx.fillRect(12, 6, 2, 8);
        // Center void
        ctx.fillStyle = '#110022';
        ctx.fillRect(8, 8, 4, 4);
        ctx.fillStyle = '#ee99ff';
        ctx.fillRect(9, 9, 2, 2); // bright center
        // Swirl accent pixels
        ctx.fillStyle = '#ff66ff';
        ctx.fillRect(5, 5, 1, 1); ctx.fillRect(14, 5, 1, 1);
        ctx.fillRect(5, 14, 1, 1); ctx.fillRect(14, 14, 1, 1);
      }],
      ['anom_shrine', (ctx) => {
        // Base platform
        ctx.fillStyle = '#554433'; ctx.fillRect(1, 14, 18, 5);
        ctx.fillStyle = '#776655'; ctx.fillRect(1, 14, 18, 1);
        // Altar body
        ctx.fillStyle = '#665544'; ctx.fillRect(3, 8, 14, 6);
        ctx.fillStyle = '#887766'; ctx.fillRect(3, 8, 14, 1);
        // Top ledge
        ctx.fillStyle = '#998877'; ctx.fillRect(2, 6, 16, 3);
        ctx.fillStyle = '#bbaa99'; ctx.fillRect(2, 6, 16, 1);
        // Rune crystal in center
        ctx.fillStyle = '#0044cc'; ctx.fillRect(8, 3, 4, 6);
        ctx.fillStyle = '#4488ff'; ctx.fillRect(9, 3, 2, 4);
        ctx.fillStyle = '#88bbff'; ctx.fillRect(9, 3, 1, 2); // crystal highlight
        // Side candles
        ctx.fillStyle = '#e8d8b8'; ctx.fillRect(4, 9, 2, 5);
        ctx.fillStyle = '#e8d8b8'; ctx.fillRect(14, 9, 2, 5);
        ctx.fillStyle = '#ff8800'; ctx.fillRect(5, 7, 1, 3);
        ctx.fillStyle = '#ff8800'; ctx.fillRect(15, 7, 1, 3);
        ctx.fillStyle = '#ffee44'; ctx.fillRect(5, 7, 1, 1);
        ctx.fillStyle = '#ffee44'; ctx.fillRect(15, 7, 1, 1);
      }],
      ['anom_cage', (ctx) => {
        // Hanging chains
        ctx.fillStyle = '#887766';
        ctx.fillRect(9, 0, 2, 2); // top chain link
        ctx.fillStyle = '#665544';
        ctx.fillRect(10, 2, 1, 2);
        // Cage body
        ctx.fillStyle = '#554422';
        for (let i = 0; i < 5; i++) ctx.fillRect(2 + i * 3, 4, 2, 13); // bars
        ctx.fillRect(2, 4, 14, 2);   // top bar
        ctx.fillRect(2, 15, 14, 2);  // bottom bar
        ctx.fillRect(2, 9, 14, 1);   // middle ring
        // Bar highlight
        ctx.fillStyle = '#887755';
        for (let i = 0; i < 5; i++) ctx.fillRect(2 + i * 3, 4, 1, 13);
        ctx.fillRect(2, 4, 14, 1);
        // Lock
        ctx.fillStyle = '#cc8800'; ctx.fillRect(8, 9, 4, 3);
        ctx.fillStyle = '#664400'; ctx.fillRect(9, 8, 2, 2);
      }],
      ['anom_page', (ctx) => {
        // Parchment
        ctx.fillStyle = '#f5e8c0'; ctx.fillRect(3, 1, 14, 18);
        ctx.fillStyle = '#e0cca0'; ctx.fillRect(3, 1, 14, 1);
        // Ink lines (lore text)
        ctx.fillStyle = '#5a3a18';
        for (let i = 0; i < 6; i++) ctx.fillRect(5, 4 + i * 3, 10, 1);
        ctx.fillRect(5, 4, 6, 1); // short line at top
        // Decorative rune marks
        ctx.fillStyle = '#8833aa';
        ctx.fillRect(5, 4, 2, 2); ctx.fillRect(13, 4, 2, 2);
        ctx.fillRect(5, 16, 2, 2); ctx.fillRect(13, 16, 2, 2);
        // Torn edge
        ctx.fillStyle = '#d4bc90';
        ctx.fillRect(15, 2, 2, 1); ctx.fillRect(16, 4, 1, 2); ctx.fillRect(15, 8, 2, 1);
      }],
      ['anom_merchant', (ctx) => {
        // Body / cloak
        ctx.fillStyle = '#1a6622'; ctx.fillRect(5, 8, 10, 11);
        ctx.fillStyle = '#2a8833'; ctx.fillRect(5, 8, 10, 1);
        // Hood
        ctx.fillStyle = '#1a6622'; ctx.fillRect(4, 4, 12, 6);
        ctx.fillStyle = '#2a8833'; ctx.fillRect(4, 4, 12, 1);
        // Face
        ctx.fillStyle = '#e8c888'; ctx.fillRect(6, 5, 8, 5);
        ctx.fillStyle = '#5a3010'; ctx.fillRect(7, 7, 2, 1); ctx.fillRect(11, 7, 2, 1); // eyes
        ctx.fillStyle = '#c09060'; ctx.fillRect(8, 8, 4, 1); // smile
        // Arms
        ctx.fillStyle = '#1a6622'; ctx.fillRect(2, 9, 4, 6); ctx.fillRect(14, 9, 4, 6);
        // Coin bag in hand
        ctx.fillStyle = '#cc8800'; ctx.fillRect(13, 13, 5, 4);
        ctx.fillStyle = '#eebb00'; ctx.fillRect(13, 13, 5, 1);
        ctx.fillStyle = '#886600'; ctx.fillRect(15, 12, 2, 2); // bag tie
      }],
      ['anom_gchest', (ctx) => {
        // Shadow
        ctx.fillStyle = '#1a0a04'; ctx.fillRect(2, 17, 16, 3);
        // Chest body
        ctx.fillStyle = '#8b3a22'; ctx.fillRect(1, 7, 18, 11);
        // Lid
        ctx.fillStyle = '#a04828'; ctx.fillRect(1, 4, 18, 5);
        ctx.fillStyle = '#c05a30'; ctx.fillRect(1, 4, 18, 1); // lid highlight
        // Lock (suspicious glowing eye)
        ctx.fillStyle = '#442211'; ctx.fillRect(7, 9, 6, 5);
        ctx.fillStyle = '#ee4400'; ctx.fillRect(8, 10, 4, 3); // eye glow
        ctx.fillStyle = '#ffaa00'; ctx.fillRect(9, 11, 2, 1); // pupil
        // Metal corners
        ctx.fillStyle = '#cc9900';
        ctx.fillRect(1, 4, 2, 2); ctx.fillRect(17, 4, 2, 2);
        ctx.fillRect(1, 15, 2, 3); ctx.fillRect(17, 15, 2, 3);
        // Metal band
        ctx.fillStyle = '#aa7a00'; ctx.fillRect(1, 9, 18, 2);
        ctx.fillStyle = '#eebb00'; ctx.fillRect(1, 9, 18, 1);
      }],
      // Additional anomaly props
      ['anom_echo_ghost', (ctx) => {
        // Translucent ghost form (silhouette of hero)
        ctx.fillStyle = '#334466'; ctx.fillRect(6, 2, 8, 8); // head
        ctx.fillStyle = '#446688'; ctx.fillRect(7, 3, 6, 6);  // lighter center
        ctx.fillStyle = '#88aacc'; ctx.fillRect(8, 4, 4, 4);  // bright core
        ctx.fillStyle = '#334466'; ctx.fillRect(5, 10, 10, 9); // body
        ctx.fillStyle = '#446688'; ctx.fillRect(6, 11, 8, 7);
        // Eye glow
        ctx.fillStyle = '#00ccff'; ctx.fillRect(8, 5, 2, 1); ctx.fillRect(10, 5, 2, 1);
        // Wispy bottom
        ctx.fillStyle = '#334466';
        ctx.fillRect(5, 18, 3, 2); ctx.fillRect(9, 19, 2, 1); ctx.fillRect(12, 18, 3, 2);
      }],
    ];
    for (const [key, draw] of props) {
      if (this.textures.exists(key)) continue;
      const t = this.textures.createCanvas(key, 20, 20);
      if (!t) continue;
      draw(t.getCanvas().getContext('2d')!);
      t.refresh();
    }
  }

  private placeProp(col: number, row: number, textureKey: string, propType: string): void {
    const x = (col + 0.5) * TILE, y = (row + 0.5) * TILE;
    const sprite = this.add.image(x, y, textureKey).setDepth(3).setScale(2);
    this.tweens.add({ targets: sprite, alpha: { from: 0.85, to: 1.0 }, duration: 800, yoyo: true, repeat: -1 });
    this.anomalyProps.push({ sprite, col, row, propType, interacted: false });
  }

  private pickFarCell(
    floorCells: { col: number; row: number }[],
    fromCol: number, fromRow: number,
    minDist = 20,
  ): { col: number; row: number } | null {
    const far = floorCells.filter(c =>
      Math.abs(c.col - fromCol) + Math.abs(c.row - fromRow) >= minDist,
    );
    return far.length > 0 ? far[Phaser.Math.Between(0, far.length - 1)] : floorCells[0] ?? null;
  }

  private initAnomaly(floorCells: { col: number; row: number }[], rng: () => number): void {
    const sc = this.floorData.spawnCol, sr = this.floorData.spawnRow;
    switch (this.activeAnomaly) {
      case 'blood_moon': {
        this.anomalyState['bloodMoon'] = 1;
        // Subtle red vignette overlay
        const { width: bw, height: bh } = this.scale;
        this.add.rectangle(bw / 2, bh / 2, bw, bh, 0xff2200, 0.08)
          .setScrollFactor(0).setDepth(2);
        break;
      }
      case 'hungering_dark':   this.anomalyFovRadius = 2; break;
      case 'mirror_rift':      this.initMirrorRift(floorCells); break;
      case 'beast_stampede':   break; // triggered at 5s via timer
      case 'gravelord':        this.initGravelord(floorCells, sc, sr); break;
      case 'dimensional_rift': this.initDimensionalRift(floorCells, sc, sr); break;
      case 'avarice':          break; // triggered by gold threshold in update
      case 'clockwork_judge':  break; // triggered on clean champion kill
      case 'old_friend':       this.initOldFriend(floorCells, sc, sr); break;
      case 'the_hunter':       break; // triggered at 90s via timer
      case 'wandering_merchant': this.initWanderingMerchant(floorCells, sc, sr, rng); break;
      case 'cursed_bargain':   this.initCursedBargain(floorCells, sc, sr); break;
      case 'gamblers_chest':   this.initGamblersChest(floorCells, sc, sr); break;
      case 'caged_ally':       this.initCagedAlly(floorCells, sc, sr); break;
      case 'echo_fallen_hero': this.initEchoFallenHero(floorCells, sc, sr); break;
    }
  }

  private initMirrorRift(floorCells: { col: number; row: number }[]): void {
    const cell = floorCells[Phaser.Math.Between(Math.floor(floorCells.length * 0.4), floorCells.length - 1)];
    if (!cell) return;
    this.spawnAnomalyEnemy('anom_mirror_shade', 'Mirror Shade', (cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, {
      hp: Math.max(80, Math.round(this.player.maxHp * 0.85)),
      dmg: Math.max(12, this.floor * 11 + 8),
      speed: 62, exp: this.floor * 180, archetype: 'chaser',
      dropItem: 'shade_essence', dropChance: 1.0,
    });
  }

  private initGravelord(floorCells: { col: number; row: number }[], sc: number, sr: number): void {
    // Place 4 candles in different quadrants away from spawn
    const quadrants = [
      floorCells.filter(c => c.col < this.mapCols / 2 && c.row < this.mapRows / 2),
      floorCells.filter(c => c.col >= this.mapCols / 2 && c.row < this.mapRows / 2),
      floorCells.filter(c => c.col < this.mapCols / 2 && c.row >= this.mapRows / 2),
      floorCells.filter(c => c.col >= this.mapCols / 2 && c.row >= this.mapRows / 2),
    ];
    for (const q of quadrants) {
      const far = q.filter(c => Math.abs(c.col - sc) + Math.abs(c.row - sr) >= 15);
      const pool = far.length > 0 ? far : q;
      if (pool.length === 0) continue;
      const cell = pool[Phaser.Math.Between(0, pool.length - 1)];
      this.placeProp(cell.col, cell.row, 'anom_candle_off', 'candle');
    }
    this.anomalyState['candlesLit'] = 0;
  }

  private initDimensionalRift(floorCells: { col: number; row: number }[], sc: number, sr: number): void {
    const cell = this.pickFarCell(floorCells, sc, sr, 25);
    if (!cell) return;
    this.placeProp(cell.col, cell.row, 'anom_portal', 'portal');
  }

  private initOldFriend(floorCells: { col: number; row: number }[], sc: number, sr: number): void {
    const used = new Set<string>();
    for (let i = 0; i < 3; i++) {
      let cell: { col: number; row: number } | null = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        const c = floorCells[Phaser.Math.Between(0, floorCells.length - 1)];
        const key = `${c.col},${c.row}`;
        if (!used.has(key) && Math.abs(c.col - sc) + Math.abs(c.row - sr) >= 12) {
          cell = c; used.add(key); break;
        }
      }
      if (cell) this.placeProp(cell.col, cell.row, 'anom_page', 'page');
    }
    this.anomalyState['pagesFound'] = 0;
  }

  private initWanderingMerchant(
    floorCells: { col: number; row: number }[],
    sc: number, sr: number, rng: () => number,
  ): void {
    const cell = this.pickFarCell(floorCells, sc, sr, 18);
    if (!cell) return;
    this.placeProp(cell.col, cell.row, 'anom_merchant', 'merchant');
    // Pre-roll merchant stock (3 items)
    const pool = ['health_potion', 'mana_potion', 'smoke_bomb', 'iron_ore', 'mana_stone_2', 'mana_stone_3'];
    const rare = ['dragon_scale', 'mana_stone_4', 'captain_badge', 'brood_venom', 'goblin_tooth'];
    this.anomalyState['merchantItem1'] = Math.floor(rng() * pool.length);
    this.anomalyState['merchantItem2'] = Math.floor(rng() * pool.length);
    this.anomalyState['merchantItem3'] = Math.floor(rng() * rare.length) + 100; // 100+ = rare pool
    void pool; void rare;
  }

  private initCursedBargain(floorCells: { col: number; row: number }[], sc: number, sr: number): void {
    const cell = this.pickFarCell(floorCells, sc, sr, 15);
    if (!cell) return;
    this.placeProp(cell.col, cell.row, 'anom_shrine', 'shrine');
  }

  private initGamblersChest(floorCells: { col: number; row: number }[], sc: number, sr: number): void {
    const cell = this.pickFarCell(floorCells, sc, sr, 15);
    if (!cell) return;
    this.placeProp(cell.col, cell.row, 'anom_gchest', 'gchest');
  }

  private initCagedAlly(floorCells: { col: number; row: number }[], sc: number, sr: number): void {
    const cell = this.pickFarCell(floorCells, sc, sr, 15);
    if (!cell) return;
    this.placeProp(cell.col, cell.row, 'anom_cage', 'cage');
  }

  private initEchoFallenHero(floorCells: { col: number; row: number }[], sc: number, sr: number): void {
    const cell = this.pickFarCell(floorCells, sc, sr, 20);
    if (!cell) return;
    this.placeProp(cell.col, cell.row, 'anom_page', 'echo_shade');
  }

  private checkAnomalyUpdate(delta: number): void {
    if (!this.activeAnomaly) return;
    this.anomalyTimer += delta;

    switch (this.activeAnomaly) {
      case 'the_hunter': {
        if (this.anomalyState['hunterSpawned']) break;

        // Play warning footsteps before Hunter spawn
        if (this.anomalyState['nextFootstepTimer'] === undefined) {
          this.anomalyState['nextFootstepTimer'] = 2500;
        }
        let ft = this.anomalyState['nextFootstepTimer'] as number;
        ft -= delta;
        if (ft <= 0) {
          AudioManager.playSFX('hunter_footstep');
          ft = 2500 + Math.random() * 1500;
        }
        this.anomalyState['nextFootstepTimer'] = ft;

        const targetTime = (SaveManager.load()?.hunted) ? 30_000 : 90_000;
        if (this.anomalyTimer < targetTime) break;
        const cells = this.collectFloorCells(this.tiles);
        const near = cells.filter(c =>
          Phaser.Math.Distance.Between(c.col * TILE, c.row * TILE, this.player.x, this.player.y) > TILE * 6 &&
          Phaser.Math.Distance.Between(c.col * TILE, c.row * TILE, this.player.x, this.player.y) < TILE * 14,
        );
        const cell = near.length > 0 ? near[Phaser.Math.Between(0, near.length - 1)] : null;
        if (cell) {
          this.spawnAnomalyEnemy('anom_hunter', 'The Hunter', (cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, {
            hp: 1200 + this.floor * 300, dmg: this.floor * 16 + 25, speed: 80, exp: this.floor * 350,
            archetype: 'skirmisher', dropItem: 'nemesis_mark', dropChance: 1.0,
          });
          this.anomalyState['hunterSpawned'] = 1;
          this.showCenterText('THE HUNTER\nhas found you.');
          this.game.events.emit('anomaly-whisper', 'The Hunter arrives.');
          this.cameras.main.flash(400, 50, 0, 50, true);
        }
        break;
      }
      case 'beast_stampede': {
        if (this.anomalyState['stampedeDone']) break;
        const wave = Math.floor(this.anomalyTimer / 5_000);
        if (wave < 1 || this.anomalyState[`stampedeWave${wave}`]) break;
        this.anomalyState[`stampedeWave${wave}`] = 1;
        this.doStampedeWave();
        if (wave >= 3) {
          this.anomalyState['stampedeDone'] = 1;
          this.game.events.emit('anomaly-whisper', 'The stampede has passed.');
        }
        break;
      }
      case 'avarice': {
        if (this.anomalyState['avariceSpawned']) break;
        const threshold = 200 + this.floor * 50;
        if (this.player.gold < threshold) break;
        const cells = this.collectFloorCells(this.tiles);
        const cell = cells[Phaser.Math.Between(0, cells.length - 1)];
        if (!cell) break;
        this.spawnAnomalyEnemy('anom_avarice', 'Avarice, the Gilded Maw', (cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, {
          hp: 900 + this.floor * 250, dmg: this.floor * 14 + 20, speed: 58, exp: this.floor * 300,
          archetype: 'charger', dropItem: 'gilded_coin', dropChance: 1.0,
        });
        this.anomalyState['avariceSpawned'] = 1;
        this.showCenterText('AVARICE, THE GILDED MAW\nsmells your gold!');
        this.game.events.emit('anomaly-whisper', 'Your greed summoned it.');
        break;
      }
    }
  }

  private checkAnomalyInteracts(): void {
    if (!this.activeAnomaly || this.anomalyProps.length === 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.player.interactKey)) return;
    for (const prop of this.anomalyProps) {
      if (prop.interacted) continue;
      const px = (prop.col + 0.5) * TILE, py = (prop.row + 0.5) * TILE;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, px, py) >= TILE * 1.6) continue;
      switch (prop.propType) {
        case 'candle':      this.interactCandle(prop, px, py); break;
        case 'portal':      this.interactPortal(prop, px, py); break;
        case 'shrine':      this.interactShrine(prop, px, py); break;
        case 'cage':        this.interactCage(prop, px, py); break;
        case 'page':        this.interactPage(prop, px, py); break;
        case 'merchant':    this.interactMerchant(prop, px, py); break;
        case 'gchest':      this.interactGamblerChest(prop, px, py); break;
        case 'echo_shade':  this.interactEchoShade(prop, px, py); break;
      }
      break;
    }
  }

  private interactCandle(prop: { sprite: Phaser.GameObjects.Image; interacted: boolean }, px: number, py: number): void {
    prop.interacted = true;
    prop.sprite.setTexture('anom_candle_on').setTint(0xffcc44);
    this.floatText('Candle lit!', px, py - 20, '#ffcc44');
    this.cameras.main.flash(200, 100, 80, 0, true);
    const lit = (this.anomalyState['candlesLit'] as number) + 1;
    this.anomalyState['candlesLit'] = lit;
    if (lit >= 4) {
      this.showCenterText('THE GRAVELORD AWAKENS!');
      this.cameras.main.flash(600, 0, 60, 0, true);
      this.cameras.main.shake(400, 0.015);
      const cells = this.collectFloorCells(this.tiles);
      const mid = cells[Math.floor(cells.length / 2)];
      if (mid) {
        this.spawnAnomalyEnemy('anom_gravelord', 'The Gravelord', (mid.col + 0.5) * TILE, (mid.row + 0.5) * TILE, {
          hp: 3000 + this.floor * 600, dmg: this.floor * 20 + 40, speed: 44, exp: this.floor * 600,
          archetype: 'brute', dropItem: 'grave_ash', dropChance: 1.0,
        });
      }
    }
  }

  private interactPortal(prop: { sprite: Phaser.GameObjects.Image; interacted: boolean }, px: number, py: number): void {
    prop.interacted = true;
    prop.sprite.destroy();
    this.cameras.main.flash(500, 100, 0, 200, true);
    this.showCenterText('DIMENSIONAL RIFT\nSomething tears through...');
    this.spawnAnomalyEnemy('anom_judge', 'Rift Sovereign', px, py, {
      hp: 2500 + this.floor * 500, dmg: this.floor * 20 + 35, speed: 52, exp: this.floor * 500,
      archetype: 'caster', dropItem: 'rift_shard', dropChance: 1.0,
    });
  }

  private interactShrine(prop: { sprite: Phaser.GameObjects.Image; interacted: boolean }, px: number, py: number): void {
    prop.interacted = true;
    prop.sprite.setTint(0x880000);
    const save = SaveManager.load();
    if (!save) return;
    const stats = ['str', 'dex', 'int', 'vit', 'agi'] as const;
    const stat = stats[Phaser.Math.Between(0, stats.length - 1)];
    save.stats[stat] = (save.stats[stat] ?? 0) + 15;
    save.curseActive = true;
    const dmg = Math.round(this.player.maxHp * 0.2);
    this.player.takeDamage(dmg, px, py - 1);
    SaveManager.write(save);
    this.floatText(`CURSED! +15 ${stat.toUpperCase()}`, px, py - 28, '#ff44ff');
    this.showCenterText('CURSED BARGAIN\nA blessing wrapped in blood.');
    this.cameras.main.flash(500, 150, 0, 150, true);
  }

  private interactCage(prop: { sprite: Phaser.GameObjects.Image; interacted: boolean }, px: number, py: number): void {
    prop.interacted = true;
    prop.sprite.destroy();
    const save = SaveManager.load();
    if (!save) return;

    // Recruit a companion if fewer than 2 are active
    if (this.companions.length < 2) {
      const available = COMPANION_DEFS.filter(d => !this.companions.some(c => c.def.id === d.id));
      if (available.length > 0) {
        const def = available[Phaser.Math.Between(0, available.length - 1)];
        const comp = new Companion(this, px, py, def, def.hp, 2, 0, 10, 'follow');
        this.physics.add.collider(comp as unknown as Phaser.GameObjects.GameObject, this.mapLayer);
        this.companions.push(comp);
        if (!save.companions) save.companions = [];
        save.companions.push(comp.toSaveData());
        SaveManager.write(save);
        this.game.events.emit('companion-hud-update', this.companions.map(c => c.toSaveData()));
        this.floatText(`${def.name} joins you!`, px, py - 20, '#88ff88');
        this.showCenterText(`ALLY FREED\n${def.name} joins your party!\n[TAB] to change command`);
        return;
      }
    }

    // Already full — give supplies
    addToInventory(save.inventory, 'health_potion', 3);
    addToInventory(save.inventory, 'smoke_bomb', 2);
    SaveManager.write(save);
    this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
    this.floatText('"Thank you!" +3 Potions, +2 Smoke Bombs', px, py - 20, '#88ff88');
    this.showCenterText('ALLY FREED\n"The dungeon owes you nothing."');
  }

  private interactPage(prop: { sprite: Phaser.GameObjects.Image; interacted: boolean }, px: number, py: number): void {
    prop.interacted = true;
    prop.sprite.destroy();
    this.floatText('Journal page found!', px, py - 20, '#eeddcc');
    const found = (this.anomalyState['pagesFound'] as number) + 1;
    this.anomalyState['pagesFound'] = found;
    this.game.events.emit('anomaly-whisper', `Journal page (${found}/3) — someone was here before.`);
    if (found >= 3) {
      this.time.delayedCall(1500, () => {
        this.showCenterText('OLD FRIEND\n"I knew you would make it this far."');
        const cells = this.collectFloorCells(this.tiles);
        const cell = cells[Phaser.Math.Between(0, cells.length - 1)];
        if (cell) {
          this.spawnAnomalyEnemy('anom_old_friend', 'Old Friend', (cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, {
            hp: 1500 + this.floor * 300, dmg: this.floor * 12 + 20, speed: 55, exp: this.floor * 400,
            archetype: 'chaser', dropItem: 'friends_token', dropChance: 1.0,
          });
        }
      });
    }
  }

  private interactMerchant(
    prop: { sprite: Phaser.GameObjects.Image; col: number; row: number; interacted: boolean },
    px: number, py: number,
  ): void {
    if (prop.interacted) return;
    const pool  = ['health_potion', 'mana_potion', 'smoke_bomb', 'iron_ore', 'mana_stone_2', 'mana_stone_3'];
    const rare  = ['dragon_scale', 'mana_stone_4', 'captain_badge', 'brood_venom', 'goblin_tooth'];
    const i1 = (this.anomalyState['merchantItem1'] as number) % pool.length;
    const i2 = (this.anomalyState['merchantItem2'] as number) % pool.length;
    const i3 = (this.anomalyState['merchantItem3'] as number) % rare.length;
    const stock = [
      { itemId: pool[i1], gold: 60 + this.floor * 8 },
      { itemId: pool[i2], gold: 60 + this.floor * 8 },
      { itemId: rare[i3], gold: 120 + this.floor * 20 },
    ];
    this.showMerchantPanel(stock, prop);
  }

  private showMerchantPanel(
    stock: { itemId: string; gold: number }[],
    prop: { interacted: boolean },
  ): void {
    const sw = this.scale.width, sh = this.scale.height;
    const bg = this.add.rectangle(sw / 2, sh * 0.65, 220, 70, 0x110022, 0.92)
      .setScrollFactor(0).setDepth(40).setStrokeStyle(1, 0x8844cc);
    const lines = stock.map((s, i) => `[${i + 1}] ${ITEMS[s.itemId]?.name ?? s.itemId} — ${s.gold}g`).join('\n');
    const txt = this.add.text(sw / 2, sh * 0.65, `Wandering Merchant\n${lines}\n[ESC] Leave`,
      { fontSize: '8px', color: '#ddccff', align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(41);

    const close = () => { bg.destroy(); txt.destroy(); this.input.keyboard!.off('keydown', handler); };
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { prop.interacted = true; close(); return; }
      const idx = parseInt(e.key) - 1;
      if (idx < 0 || idx >= stock.length) return;
      const item = stock[idx];
      if (this.player.gold >= item.gold) {
        const save = SaveManager.load();
        if (!save) return;
        this.player.addGold(-item.gold);
        save.gold = this.player.gold;
        addToInventory(save.inventory, item.itemId, 1);
        const name = ITEMS[item.itemId]?.name ?? item.itemId;
        this.floatText(`Bought ${name}!`, this.player.x, this.player.y - 20, '#88ff88');
        SaveManager.write(save);
        this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
        prop.interacted = true;
        close();
      } else {
        this.floatText('Not enough gold!', this.player.x, this.player.y - 20, '#ff4444');
      }
    };
    this.input.keyboard!.on('keydown', handler);
    this.time.delayedCall(10_000, close);
  }

  private interactGamblerChest(
    prop: { sprite: Phaser.GameObjects.Image; col: number; row: number; interacted: boolean },
    px: number, py: number,
  ): void {
    prop.interacted = true;
    prop.sprite.destroy();
    if (Math.random() < 0.40) {
      // MIMIC
      this.showCenterText('MIMIC!\nYou grabbed a monster!');
      this.cameras.main.shake(300, 0.018);
      const pool = defsForFloor(this.floor);
      for (let i = 0; i < 4; i++) {
        const def = pool[Phaser.Math.Between(0, pool.length - 1)];
        this.spawnOneEnemy(def, prop.col + Phaser.Math.Between(-2, 2), prop.row + Phaser.Math.Between(-2, 2));
      }
      this.game.events.emit('anomaly-whisper', 'A mimic springs its trap!');
    } else {
      // JACKPOT
      const gold = 300 + Phaser.Math.Between(0, 500) + this.floor * 30;
      this.player.addGold(gold);
      const save = SaveManager.load();
      if (save) {
        save.gold = this.player.gold;
        const matPool = ['mana_stone_3', 'mana_stone_4', 'iron_ore', 'dragon_scale'];
        const mat = matPool[Phaser.Math.Between(0, matPool.length - 1)];
        addToInventory(save.inventory, mat, 1 + Math.floor(this.floor / 3));
        SaveManager.write(save);
        this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
      }
      this.floatText(`JACKPOT: +${gold}g`, px, py - 20, '#ffdd44');
      this.showCenterText(`GAMBLER'S JACKPOT!\n+${gold} gold!`);
      this.cameras.main.flash(400, 200, 200, 50, true);
    }
  }

  private interactEchoShade(
    prop: { sprite: Phaser.GameObjects.Image; col: number; row: number; interacted: boolean },
    px: number, py: number,
  ): void {
    prop.interacted = true;
    prop.sprite.destroy();
    const echoHp = Math.max(60, Math.round(this.player.maxHp * 0.9));
    const echoDmg = Math.max(10, this.floor * 14 + 8);
    this.spawnAnomalyEnemy('anom_echo_shade', 'Echo of the Fallen', px, py, {
      hp: echoHp, dmg: echoDmg, speed: 58, exp: this.floor * 300,
      archetype: 'chaser', dropChance: 0,
    });
    this.showCenterText('ECHO OF THE FALLEN\nFight your past to reclaim it.');
  }

  private doStampedeWave(): void {
    const pool = defsForFloor(this.floor).filter(d => d.archetype === 'chaser' || d.archetype === 'swarm');
    if (pool.length === 0) return;
    const cells = this.collectFloorCells(this.tiles);
    const edgeCells = cells.filter(c =>
      c.col < 5 || c.col > this.mapCols - 5 || c.row < 5 || c.row > this.mapRows - 5,
    );
    for (let i = 0; i < 5; i++) {
      const cell = edgeCells.length > 0
        ? edgeCells[Phaser.Math.Between(0, edgeCells.length - 1)]
        : cells[Phaser.Math.Between(0, cells.length - 1)];
      const def = pool[Phaser.Math.Between(0, pool.length - 1)];
      this.spawnOneEnemy(def, cell.col, cell.row);
    }
    this.cameras.main.shake(250, 0.01);
    this.game.events.emit('anomaly-whisper', 'Another wave of beasts!');
  }

  private spawnAnomalyEnemy(
    id: string,
    name: string,
    x: number,
    y: number,
    stats: {
      hp: number; dmg: number; speed: number; exp: number;
      archetype: import('../data/enemies').EnemyArchetype;
      dropItem?: string; dropChance?: number;
    },
  ): void {
    const def: EnemyDef = {
      id, name,
      hp: stats.hp, dmg: stats.dmg, speed: stats.speed, exp: stats.exp,
      archetype: stats.archetype,
      dropItem: stats.dropItem, dropChance: stats.dropChance ?? 0,
      floorMin: 1,
    };
    const col = Math.floor(x / TILE), row = Math.floor(y / TILE);
    if (col < 1 || row < 1 || col >= this.mapCols - 1 || row >= this.mapRows - 1) return;
    this.spawnOneEnemy(def, col, row);
  }

  // ── Spawn director (budget-based, covers all floors) ─────────────────────────
  private runSpawnDirector(
    floorCells: { col: number; row: number }[],
    spawnCol: number, spawnRow: number,
  ): void {
    const pool = this.buildFloorPool();
    if (pool.length === 0) return;

    // Exclude spawn zone
    const safe = floorCells.filter(c =>
      Math.abs(c.col - spawnCol) >= 7 || Math.abs(c.row - spawnRow) >= 7,
    );
    if (safe.length === 0) return;

    // Shuffle cells
    for (let i = safe.length - 1; i > 0; i--) {
      const j = Phaser.Math.Between(0, i);
      [safe[i], safe[j]] = [safe[j], safe[i]];
    }

    let budget = spawnBudgetForFloor(this.floor);

    // For floor 2 biome areas, prefer area-themed placement
    if (this.floor === 2 && this.floorData.areaThemes) {
      for (const area of this.floorData.areaThemes) {
        const defs = getThemeDefs(area.theme as import('../data/enemies').EnemyTheme);
        if (defs.length === 0) continue;
        const areaCells: { col: number; row: number }[] = [];
        for (let r = area.region.y + 1; r < area.region.y + area.region.h - 1; r++) {
          for (let c = area.region.x + 1; c < area.region.x + area.region.w - 1; c++) {
            const t = this.tiles[r][c];
            if (t !== T_WALL && t !== T_WARP && t !== T_PILLAR) areaCells.push({ col: c, row: r });
          }
        }
        const areaBudget = Math.floor(budget / (this.floorData.areaThemes.length));
        let spent = 0;
        for (let i = areaCells.length - 1; i > 0; i--) {
          const j = Phaser.Math.Between(0, i);
          [areaCells[i], areaCells[j]] = [areaCells[j], areaCells[i]];
        }
        for (const cell of areaCells) {
          if (spent >= areaBudget) break;
          const def  = defs[Phaser.Math.Between(0, defs.length - 1)];
          const cost = ARCHETYPE_COST[def.archetype];
          if (spent + cost > areaBudget) continue;
          const lurker = Math.random() < 0.22;
          this.spawnOneEnemy(def, cell.col, cell.row, lurker);
          spent += cost;
        }
      }
      // Ambush pockets near warps
      this.spawnAmbushPockets(pool, Math.floor(budget * 0.15));
      return;
    }

    // General director: spend budget on pool enemies
    let cellIdx = 0;
    while (budget > 0 && cellIdx < safe.length) {
      const def = pool[Phaser.Math.Between(0, pool.length - 1)];
      const cost = ARCHETYPE_COST[def.archetype];
      if (cost > budget) { cellIdx++; continue; }
      const cell   = safe[cellIdx++];
      const lurker = Math.random() < 0.18;
      this.spawnOneEnemy(def, cell.col, cell.row, lurker);
      budget -= cost;

      // Swarm: place 2-3 more of the same type nearby
      if (def.archetype === 'swarm' && Math.random() < 0.70) {
        const extras = Math.random() < 0.4 ? 3 : 2;
        const OFFSETS = [{ dc: 2, dr: 0 }, { dc: -2, dr: 0 }, { dc: 0, dr: 2 }];
        for (let k = 0; k < extras && budget > 0; k++) {
          const off = OFFSETS[k];
          const nc  = cell.col + off.dc, nr = cell.row + off.dr;
          if (nc >= 0 && nr >= 0 && nc < this.mapCols && nr < this.mapRows
            && this.tiles[nr][nc] !== T_WALL && this.tiles[nr][nc] !== T_PILLAR
            && this.tiles[nr][nc] !== T_WARP) {
            this.spawnOneEnemy(def, nc, nr, false);
            budget -= cost;
          }
        }
      }
    }

    // Ambush pockets: a cluster of enemies near each warp pad
    this.spawnAmbushPockets(pool, Math.floor(spawnBudgetForFloor(this.floor) * 0.20));

    // §25 Floor 10/11 elite gauntlet: force a mixed-archetype elite wave
    if (this.floor === 10 || this.floor === 11) this.spawnGauntletElites(safe);
  }

  /** Reserve budget for ambush clusters near warp pads. */
  private spawnAmbushPockets(pool: EnemyDef[], budget: number): void {
    for (const wp of this.warpPads) {
      const wc = Math.floor(wp.x / TILE), wr = Math.floor(wp.y / TILE);
      let remaining = Math.floor(budget / Math.max(1, this.warpPads.length));
      for (let attempt = 0; attempt < 40 && remaining > 0; attempt++) {
        const dc = Phaser.Math.Between(5, 20) * (Math.random() < 0.5 ? 1 : -1);
        const dr = Phaser.Math.Between(5, 20) * (Math.random() < 0.5 ? 1 : -1);
        const nc = wc + dc, nr = wr + dr;
        if (nc < 1 || nr < 1 || nc >= this.mapCols - 1 || nr >= this.mapRows - 1) continue;
        const t = this.tiles[nr][nc];
        if (t === T_WALL || t === T_PILLAR || t === T_WARP) continue;
        const def  = pool[Phaser.Math.Between(0, pool.length - 1)];
        const cost = ARCHETYPE_COST[def.archetype];
        if (cost > remaining) continue;
        this.spawnOneEnemy(def, nc, nr, Math.random() < 0.30);
        remaining -= cost;
      }
    }
  }

  /**
   * §25 Floor 10 gauntlet: spawn one champion of every archetype as a
   * "final exam" before The Sovereign. All guaranteed champions.
   */
  private spawnGauntletElites(cells: { col: number; row: number }[]): void {
    const archetypes: import('../data/enemies').EnemyArchetype[] = [
      'brute', 'charger', 'skirmisher', 'ranged', 'caster', 'support',
    ];
    // Filter cells to be in the corridor (excluding the boss arena)
    const corridorCells = cells.filter(c => c.col < 290);
    const picks = [...corridorCells].sort(() => Math.random() - 0.5).slice(0, 8);
    const pool  = defsForFloor(this.floor);
    if (pool.length === 0) return;
    picks.forEach((cell, i) => {
      // Rotate through archetypes so all 6 types appear
      const archetype = archetypes[i % archetypes.length];
      const byArch = pool.filter(d => d.archetype === archetype);
      const def = (byArch.length > 0 ? byArch : pool)[Phaser.Math.Between(0, (byArch.length || pool.length) - 1)];
      const e = new Enemy(this, (cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, def);
      // All gauntlet enemies are champions with escalating affixes
      const gauntletAffixes: import('../data/enemies').EliteAffix[][] = [
        ['frenzied', 'armored'],
        ['vampiric', 'shielded'],
        ['hasted_aura', 'toxic'],
        ['stormtouched', 'volatile'],
        ['frenzied', 'vampiric'],
        ['armored', 'hasted_aura'],
        ['volatile', 'shielded'],
        ['stormtouched', 'frenzied'],
      ];
      e.applyElite({
        affixes: gauntletAffixes[i % gauntletAffixes.length],
        isChampion: true,
        hpMult: 1.5 + (SaveManager.getAscensionTier() * 0.25),
      });
      e.setVisible(false);
      e.on('died', () => this.onEnemyDied(e));
      this.enemies.add(e as unknown as Phaser.GameObjects.GameObject);
    });
    this.showCenterText('FINAL GAUNTLET — Prove your worth!');
  }

  /** Weighted enemy pool for the current floor. */
  private buildFloorPool(): EnemyDef[] {
    return defsForFloor(this.floor);
  }

  private spawnOneEnemy(def: EnemyDef, col: number, row: number, lurker = false): Enemy {
    // §25 Ascension mode: scale enemy stats per tier
    const ascTier = SaveManager.getAscensionTier();
    let scaledDef = def;
    if (ascTier > 0) {
      const hpMult  = 1 + ascTier * 0.20;
      const dmgMult = 1 + ascTier * 0.10;
      scaledDef = {
        ...def,
        hp:  Math.round(def.hp  * hpMult),
        dmg: Math.round(def.dmg * dmgMult),
      };
    }

    const e = new Enemy(this, (col + 0.5) * TILE, (row + 0.5) * TILE, scaledDef);
    if (lurker) e.setLurker();

    // Roll elite / champion (blood moon forces elite on all enemies)
    const eliteCfg = this.activeAnomaly === 'blood_moon'
      ? rollEliteConfig(this.floor) ?? { affixes: ['frenzied'], isChampion: false, hpMult: 1.3 }
      : rollEliteConfig(this.floor);
    if (eliteCfg) e.applyElite(eliteCfg);

    e.on('died', () => this.onEnemyDied(e));
    e.setVisible(false);
    this.enemies.add(e as unknown as Phaser.GameObjects.GameObject);
    return e;
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

    // §P11 — Mastery info row below capstone
    const masteryFamily = player.activeFamily;
    if (masteryFamily) {
      const mastLvl = SaveManager.getMasteryLevel(masteryFamily);
      const mastUses = SaveManager.getMasteryUses(masteryFamily);
      const nextThresh = SaveManager.MASTERY_THRESHOLDS[mastLvl] ?? '—';
      const mastColor = mastLvl >= 5 ? '#ffdd44' : '#888866';
      const mastLabel = `${masteryFamily.replace('_', ' ').toUpperCase()} Mastery Lv${mastLvl} (${mastUses}/${nextThresh})`;
      container.add(this.add.text(-110, cy + 18, mastLabel, { fontSize: '5px', color: mastColor }).setOrigin(0.5));
    }

    // §P11 — Active specialization label
    if (player.specialization) {
      const spec = getSpecialization(player.specialization);
      const specLabel = `[${(spec?.name ?? player.specialization).toUpperCase()}]`;
      container.add(this.add.text(-110, cy + 28, specLabel, { fontSize: '6px', color: '#ffaa33' }).setOrigin(0.5));
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
        let lastClickTime = 0;
        itemText.on('pointerdown', (p: Phaser.Input.Pointer) => {
          if (p.event.shiftKey) {
            inst.isJunk = !inst.isJunk;
            const s = SaveManager.load();
            if (s) {
              const sIdx = s.inventory.findIndex(x => x.id === inst.id);
              if (sIdx !== -1) {
                s.inventory[sIdx].isJunk = inst.isJunk;
                SaveManager.write(s);
              }
            }
            this.rebuildConsolidatedUI();
            return;
          }

          const clickDelay = p.time - lastClickTime;
          lastClickTime = p.time;
          if (clickDelay < 350) {
            const s = SaveManager.load();
            if (!s) return;
            const base = ITEMS[inst.itemId];
            if (base.type === 'consumable') {
              this.useConsumable(inst.itemId);
            } else if (base.slot !== 'none') {
              const targetSlot = base.slot;
              let slotToEquip = targetSlot;
              if (targetSlot.startsWith('ring')) {
                slotToEquip = s.equipped['ring1'] ? 'ring2' : 'ring1';
              } else if (targetSlot === 'mainhand') {
                slotToEquip = s.activeWeaponSlot === 0 ? 'mainhand' : 'weapon2';
              }
              const eqItem = s.equipped[slotToEquip];
              s.equipped[slotToEquip] = inst;
              const idx = s.inventory.findIndex(x => x.id === inst.id);
              if (idx !== -1) s.inventory.splice(idx, 1);
              if (eqItem) s.inventory.push(eqItem);
              this.player.loadFromSave(s);
              SaveManager.write(s);
              this.rebuildConsolidatedUI();
              this.floatText('EQUIPPED', this.player.x, this.player.y - 20, '#88ffaa');
            }
          }
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
    if (id === 'sword_riposte_stance' || id === 'assa_vanish' || id === 'sage_element_swap' || id === 'tank_bastion_mode') {
      AudioManager.playSFX('perfect_dodge');
    }

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
      const sageElemColor: Record<string, number> = { fire: 0xff3300, ice: 0x00aaff, lightning: 0xaa00ff, void: 0x6600cc, radiant: 0xffee44 };
      const color = sageElemColor[this.player.activeElement] ?? 0xffffff;
      const blast = this.add.circle(this.player.x, this.player.y, 10, color, 0.4).setDepth(4);
      this.tweens.add({ targets: blast, scaleX: 6.0, scaleY: 6.0, alpha: 0, duration: 250, onComplete: () => blast.destroy() });

      const sageEl = this.player.activeElement as import('../config').GameElement;
      const sagePhys = this.player.getActivePhysType();
      for (const child of this.enemies.getChildren()) {
        const e = child as unknown as Enemy;
        if (e.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < 60) {
          const { dmg: sageDmg } = this.player.computeAttackDamage(0.60);
          let { finalDmg: sageFinal, label: sageLabel } = resolveHit(sageDmg, sagePhys, sageEl, e.def.body, e.def.elemFamily);
          // §P11 — Elementalist specialization: +25% elemental damage
          if (sageFinal > 0 && this.player.specialization === 'elementalist') {
            sageFinal = Math.round(sageFinal * 1.25);
          }
          // §P11 — Slayer specialization: +20% vs chosen body type
          if (sageFinal > 0 && this.player.specialization.startsWith('slayer')) {
            const slayerBody = getSlayerBodyType(this.player.specialization);
            if (slayerBody && e.def.body === slayerBody) sageFinal = Math.round(sageFinal * 1.20);
          }
          if (sageFinal < 0) {
            e.healDirect(-sageFinal);
            this.floatText('ABSORB', e.x, e.y - 20, '#00ff88');
          } else {
            e.takeDamage(sageFinal, this.player.x, this.player.y, 12, sageEl);
            e.addThreat('player', sageFinal);
            this.player.onHitDealt(sageFinal);
            this.floatText(`${sageFinal}`, e.x, e.y - 20, this.elemColor(sageEl));
            if (sageLabel === 'WEAK')        this.floatText('WEAK!',  e.x, e.y - 34, '#ff4400');
            else if (sageLabel === 'RESIST') this.floatText('RESIST', e.x, e.y - 34, '#8888ff');
            else if (sageLabel === 'IMMUNE') this.floatText('IMMUNE', e.x, e.y - 34, '#888888');
          }

          if (this.player.activeElement === 'fire') {
            StatusSystem.triggerAilment(e, 'burn', this);
            for (const h of this.hazards) {
              if (h.hazardType === 'oil' && Phaser.Math.Distance.Between(this.player.x, this.player.y, h.x, h.y) < 60) {
                h.ignite(this);
              }
            }
          } else if (this.player.activeElement === 'ice') {
            StatusSystem.applyBuildUp(e, 'frostbite', 50, this, this.player);
          } else if (this.player.activeElement === 'lightning') {
            StatusSystem.triggerAilment(e, 'shock', this);
          } else if (this.player.activeElement === 'void') {
            StatusSystem.applyBuildUp(e, 'corruption', 50, this, this.player);
          } else if (this.player.activeElement === 'radiant') {
            StatusSystem.applyBuildUp(e, 'sear', 50, this, this.player);
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
    AudioManager.playSFX('parry');
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
    let anyCrit = false;
    const el = this.getPlayerAttackElement();
    const physType = this.player.getActivePhysType();
    const elemArg = (el === 'none' || el === 'physical' || el === 'blunt') ? 'none' : el as import('../config').GameElement;
    for (const child of this.enemies.getChildren()) {
      const e = child as unknown as Enemy;
      if (!e.active) continue;
      if (Phaser.Math.Distance.Between(ax, ay, e.x, e.y) < range) {
        let { dmg: baseDmg, isCrit } = this.player.computeAttackDamage(mv);
        if (isCrit) anyCrit = true;
        // P8 — wound multiplier (+25%)
        if ((e.activeAilments.get('wound') ?? 0) > 0) baseDmg = Math.round(baseDmg * 1.25);
        // P8 — KO punish window (+30%)
        if ((e.getData('ko_punish_ms') ?? 0) > 0) baseDmg = Math.round(baseDmg * 1.30);
        let { finalDmg, label } = resolveHit(baseDmg, physType, elemArg, e.def.body, e.def.elemFamily);
        // §P11 — Elementalist specialization: +25% elemental damage
        if (finalDmg > 0 && elemArg !== 'none' && this.player.specialization === 'elementalist') {
          finalDmg = Math.round(finalDmg * 1.25);
        }
        // §P11 — Slayer specialization: +20% vs chosen body type
        if (finalDmg > 0 && this.player.specialization.startsWith('slayer')) {
          const slayerBody = getSlayerBodyType(this.player.specialization);
          if (slayerBody && e.def.body === slayerBody) finalDmg = Math.round(finalDmg * 1.20);
        }
        // P10 — warded affix: 30% elemental DR
        if (finalDmg > 0 && e.hasAffix('warded') && elemArg !== 'none') {
          finalDmg = Math.round(finalDmg * 0.70);
          label = 'RESIST';
        }
        // P10 — unstable_core: +50% dmg when hitting with the current weakness element
        if (finalDmg > 0 && e.hasAffix('unstable_core') && e.unstableCoreElement === elemArg && elemArg !== 'none') {
          finalDmg = Math.round(finalDmg * 1.50);
          label = 'WEAK';
        }
        if (finalDmg < 0) {
          e.healDirect(-finalDmg);
          this.floatText('ABSORB', e.x, e.y - 20, '#00ff88');
        } else {
          e.takeDamage(finalDmg, this.player.x, this.player.y, poiseDmg, el);
          e.addThreat('player', finalDmg);
          this.player.onHitDealt(finalDmg);
          this.applyAttackAilment(e, el, physType);
          // §P11 — Bleed on Crit (Swordman passive)
          if (isCrit && this.player.classKey === 'swordman' && this.player.isSkillUnlocked('sword_b1_t3')) {
            StatusSystem.applyBuildUp(e, 'bleed', 40, this, this.player);
          }
          const dmgColor = isCrit ? '#ffee00' : (elemArg !== 'none' ? this.elemColor(elemArg) : '#ffffff');
          this.floatText(isCrit ? `${finalDmg}!` : `${finalDmg}`, e.x, e.y - 20, dmgColor);
          if (label === 'WEAK')        this.floatText('WEAK!',  e.x, e.y - 34, '#ff4400');
          else if (label === 'RESIST') this.floatText('RESIST', e.x, e.y - 34, '#8888ff');
          else if (label === 'IMMUNE') this.floatText('IMMUNE', e.x, e.y - 34, '#888888');
        }
        hitConnected = true;
      }
    }

    // Boss melee hits
    for (const boss of this.bosses) {
      if (boss.isDead) continue;
      if (Phaser.Math.Distance.Between(ax, ay, boss.x, boss.y) < range + 24) {
        let { dmg: baseDmg, isCrit } = this.player.computeAttackDamage(mv);
        if (isCrit) anyCrit = true;
        // §P11 — Use phase-aware affinity from Boss 2.0
        const bossElemFamily = boss.currentPhaseElemFamily;
        const bossBody = boss.currentPhaseBody;
        let { finalDmg, label } = resolveHit(baseDmg, physType, elemArg, bossBody, bossElemFamily);
        // §P11 — Elementalist specialization: +25% elemental damage
        if (finalDmg > 0 && elemArg !== 'none' && this.player.specialization === 'elementalist') {
          finalDmg = Math.round(finalDmg * 1.25);
        }
        // §P11 — Slayer specialization: +20% vs chosen body type
        if (finalDmg > 0 && this.player.specialization.startsWith('slayer')) {
          const slayerBody = getSlayerBodyType(this.player.specialization);
          if (slayerBody && bossBody === slayerBody) finalDmg = Math.round(finalDmg * 1.20);
        }
        boss.takeDamage(finalDmg, this.player.x, this.player.y);
        this.player.onHitDealt(finalDmg);
        const color = isCrit ? '#ffee00' : '#ff8844';
        this.floatText(isCrit ? `${finalDmg}!` : `${finalDmg}`, boss.x, boss.y - 28, color);
        if (label === 'WEAK')   this.floatText('WEAK!',  boss.x, boss.y - 42, '#ff4400');
        else if (label === 'RESIST') this.floatText('RESIST', boss.x, boss.y - 42, '#8888ff');
        hitConnected = true;
      }
    }

    if (this.player.isBlunt) {
      AudioManager.playSFX('bounce');
    } else {
      AudioManager.playSFX('swing');
    }

    if (hitConnected) {
      this.player.onMeleeHitConnected();
      if (anyCrit) {
        AudioManager.playSFX('crit');
      } else {
        AudioManager.playSFX('hit');
      }
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
      AudioManager.playSFX('swing');
    } else if (this.player.attackType === 'bolt') {
      const pierce = this.player.rangedPierceCount;
      const { dmg, isCrit } = this.player.computeAttackDamage(0.55);
      this.fireProjectile('bolt', this.player.currentFacing, 250, dmg, isCrit, pierce);
      AudioManager.playSFX('swing');
    } else if (this.player.attackType === 'fireball') {
      const { dmg, isCrit } = this.player.computeAttackDamage(0.50);
      this.fireProjectile('fireball', this.player.currentFacing, 140, dmg, isCrit, 1);
      AudioManager.playSFX('swing');
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
    const projPhysType = this.player.getActivePhysType();

    const hitCheck = this.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        if (!proj.active) { hitCheck.destroy(); return; }
        for (const child of this.enemies.getChildren()) {
          const e = child as unknown as Enemy;
          if (!e.active || hitEnemies.has(e)) continue;
          if (Phaser.Math.Distance.Between(proj.x, proj.y, e.x, e.y) < 24) {
            const el = this.getPlayerAttackElement();
            const elemArg = (el === 'none' || el === 'physical' || el === 'blunt') ? 'none' : el as import('../config').GameElement;
            let projDmg = dmg;
            if ((e.activeAilments.get('wound') ?? 0) > 0) projDmg = Math.round(projDmg * 1.25);
            if ((e.getData('ko_punish_ms') ?? 0) > 0) projDmg = Math.round(projDmg * 1.30);
            let { finalDmg, label } = resolveHit(projDmg, projPhysType, elemArg, e.def.body, e.def.elemFamily);
            // §P11 — Elementalist specialization: +25% elemental damage
            if (finalDmg > 0 && elemArg !== 'none' && this.player.specialization === 'elementalist') {
              finalDmg = Math.round(finalDmg * 1.25);
            }
            // §P11 — Slayer specialization: +20% vs chosen body type
            if (finalDmg > 0 && this.player.specialization.startsWith('slayer')) {
              const slayerBody = getSlayerBodyType(this.player.specialization);
              if (slayerBody && e.def.body === slayerBody) finalDmg = Math.round(finalDmg * 1.20);
            }
            if (finalDmg < 0) {
              e.healDirect(-finalDmg);
              this.floatText('ABSORB', e.x, e.y - 20, '#00ff88');
            } else {
              e.takeDamage(finalDmg, proj.x, proj.y, 5, el);
              e.addThreat('player', finalDmg);
              this.player.onHitDealt(finalDmg);
              this.player.onRangedHitConnected(); // §P11 ranged mastery
              this.applyAttackAilment(e, el, projPhysType);
              const projDmgColor = isCrit ? '#ffee00' : (elemArg !== 'none' ? this.elemColor(elemArg) : '#aaccff');
              this.floatText(isCrit ? `${finalDmg}!` : `${finalDmg}`, e.x, e.y - 20, projDmgColor);
              if (label === 'WEAK')        this.floatText('WEAK!',  e.x, e.y - 34, '#ff4400');
              else if (label === 'RESIST') this.floatText('RESIST', e.x, e.y - 34, '#8888ff');
              else if (label === 'IMMUNE') this.floatText('IMMUNE', e.x, e.y - 34, '#888888');
              AudioManager.playSFX(isCrit ? 'crit' : 'hit');
            }

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
        // Boss projectile hits
        for (const boss of this.bosses) {
          if (boss.isDead || !proj.active) continue;
          if (Phaser.Math.Distance.Between(proj.x, proj.y, boss.x, boss.y) < 36) {
            const el = this.getPlayerAttackElement();
            const elemArg = (el === 'none' || el === 'physical' || el === 'blunt') ? 'none' : el as import('../config').GameElement;
            // §P11 — Use phase-aware affinity from Boss 2.0
            const bossElemFamily = boss.currentPhaseElemFamily;
            const bossBody = boss.currentPhaseBody;
            let { finalDmg, label } = resolveHit(dmg, projPhysType, elemArg, bossBody, bossElemFamily);
            // §P11 — Elementalist specialization: +25% elemental damage
            if (finalDmg > 0 && elemArg !== 'none' && this.player.specialization === 'elementalist') {
              finalDmg = Math.round(finalDmg * 1.25);
            }
            // §P11 — Slayer specialization: +20% vs chosen body type
            if (finalDmg > 0 && this.player.specialization.startsWith('slayer')) {
              const slayerBody = getSlayerBodyType(this.player.specialization);
              if (slayerBody && bossBody === slayerBody) finalDmg = Math.round(finalDmg * 1.20);
            }
            boss.takeDamage(finalDmg, proj.x, proj.y);
            this.player.onHitDealt(finalDmg);
            this.player.onRangedHitConnected(); // §P11 ranged mastery
            const color = isCrit ? '#ffee00' : '#ff8844';
            this.floatText(isCrit ? `${finalDmg}!` : `${finalDmg}`, boss.x, boss.y - 28, color);
            if (label === 'WEAK') this.floatText('WEAK!', boss.x, boss.y - 42, '#ff4400');
            else if (label === 'RESIST') this.floatText('RESIST', boss.x, boss.y - 42, '#8888ff');
            AudioManager.playSFX(isCrit ? 'crit' : 'hit');
            proj.destroy(); hitCheck.destroy(); return;
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

      const el: Element = this.player.classKey === 'sage' ? this.player.activeElement as Element : 'none';
      const glyphElemArg = (el === 'none' || el === 'physical' || el === 'blunt') ? 'none' : el as import('../config').GameElement;
      const glyphPhysType = this.player.getActivePhysType();
      const { dmg: glyphBaseDmg, isCrit } = this.player.computeAttackDamage(0.60);
      let hitConnected = false;
      let anyCrit = false;
      for (const child of this.enemies.getChildren()) {
        const e = child as unknown as Enemy;
        if (!e.active) continue;
        if (Phaser.Math.Distance.Between(gx, gy, e.x, e.y) < 60) {
          if (isCrit) anyCrit = true;
          let { finalDmg, label } = resolveHit(glyphBaseDmg, glyphPhysType, glyphElemArg, e.def.body, e.def.elemFamily);
          // §P11 — Elementalist specialization: +25% elemental damage
          if (finalDmg > 0 && glyphElemArg !== 'none' && this.player.specialization === 'elementalist') {
            finalDmg = Math.round(finalDmg * 1.25);
          }
          // §P11 — Slayer specialization: +20% vs chosen body type
          if (finalDmg > 0 && this.player.specialization.startsWith('slayer')) {
            const slayerBody = getSlayerBodyType(this.player.specialization);
            if (slayerBody && e.def.body === slayerBody) finalDmg = Math.round(finalDmg * 1.20);
          }
          if (finalDmg < 0) {
            e.healDirect(-finalDmg);
            this.floatText('ABSORB', e.x, e.y - 20, '#00ff88');
          } else {
            e.takeDamage(finalDmg, gx, gy, 12, el);
            e.addThreat('player', finalDmg);
            this.player.onHitDealt(finalDmg);
            this.applyAttackAilment(e, el, undefined);
            const color = isCrit ? '#ffee00' : '#ff88ff';
            this.floatText(isCrit ? `${finalDmg}!` : `${finalDmg}`, e.x, e.y - 20, color);
            if (label === 'WEAK')   this.floatText('WEAK!',  e.x, e.y - 34, '#ff4400');
            else if (label === 'RESIST') this.floatText('RESIST', e.x, e.y - 34, '#8888ff');
            else if (label === 'IMMUNE') this.floatText('IMMUNE', e.x, e.y - 34, '#888888');
          }
          hitConnected = true;
        }
      }
      if (hitConnected) {
        if (anyCrit) AudioManager.playSFX('crit');
        else AudioManager.playSFX('hit');
      } else {
        AudioManager.playSFX('swing');
      }

      if (el === 'fire') {
        for (const h of this.hazards) {
          if (h.hazardType === 'oil' && Phaser.Math.Distance.Between(gx, gy, h.x, h.y) < 60) {
            h.ignite(this);
          }
        }
      }

      this.floatText('EXPLODE!', gx, gy - 20, el !== 'none' ? this.elemColor(el) : '#ff88ff');
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
      AudioManager.playSFX('perfect_dodge');

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

    const isWarp = itemId === 'warp_crystal' || itemId === 'recall_stone';
    if (isWarp && save.ironbound) {
      this.floatText('Blocked by Ironbound!', this.player.x, this.player.y - 30, '#ff4444');
      return;
    }

    const idx = save.inventory.findIndex(s => s.itemId === itemId && s.qty > 0);
    if (idx === -1) return;

    const def = ITEMS[itemId];
    const started = this.player.startChannel(TUNING.potionChannel, () => {
      const s = SaveManager.load();
      if (!s) return;
      const i2 = s.inventory.findIndex(is => is.itemId === itemId && is.qty > 0);
      if (i2 === -1) return;
      s.inventory[i2].qty--;
      if (s.inventory[i2].qty <= 0) s.inventory.splice(i2, 1);

      // P12: Track potion usage on F5 and torch usage
      if (itemId.includes('potion') && this.floor === 5) {
        this.usedPotionOnFloor5 = true;
      }
      if (itemId === 'torch') {
        this.usedTorchOnFloor = true;
      }

      // ── Data-driven consumable effects ──────────────────────────────────────
      if (def) {
        // HP restore
        if (def.healHp) {
          const potencyMult = 1.0; // P12: affix potionPotency
          const amt = def.healPercent ? Math.round(this.player.maxHp * (def.healHp / 100)) : Math.round(def.healHp * potencyMult);
          this.player.heal(amt);
          this.floatText(`+${amt} HP`, this.player.x, this.player.y - 30, '#88ff88');
        }
        // MP restore
        if (def.healMp) {
          const amt = def.healPercent ? Math.round(this.player.currentMp + 9999) : def.healMp;
          this.player.restoreMp(amt);
          this.floatText(`+${amt} MP`, this.player.x, this.player.y - 30, '#88aaff');
        }
        // HP regen
        if (def.regenHpPerSec && def.regenDurationMs) {
          s.activeTonic = { effectId: `regen_${def.regenHpPerSec}`, expiresAt: Date.now() + def.regenDurationMs };
          this.floatText('REGEN!', this.player.x, this.player.y - 30, '#88ff88');
        }
        // Tonic buff (including whetting oils)
        if (def.tonicEffect) {
          s.activeTonic = { effectId: def.tonicEffect, expiresAt: Date.now() + (def.tonicDuration ?? 90000) };
          if (def.tonicEffect.startsWith('infuse_')) {
            const elem = def.tonicEffect.replace('infuse_', '');
            s.weaponInfusions = s.weaponInfusions ?? {};
            s.weaponInfusions['mainhand'] = elem as import('../types').Element;
            this.floatText(`${elem.toUpperCase()} INFUSED!`, this.player.x, this.player.y - 30, this.elemColor(elem));
          } else {
            this.floatText('TONIC!', this.player.x, this.player.y - 30, '#ffee44');
          }
        }
        // Cleansing tonic — remove one ailment
        if (def.cleanseOne) {
          const active = [...this.player.activeAilments.entries()].filter(([, ms]) => ms > 0 && ms < 999999);
          if (active.length > 0) {
            this.player.activeAilments.delete(active[0][0]);
            this.floatText('CLEANSED!', this.player.x, this.player.y - 30, '#88ffff');
          } else {
            this.floatText('No status to cleanse', this.player.x, this.player.y - 30, '#aaaaaa');
          }
        }
        // Panacea — remove all ailments + 5s immunity
        if (def.cleanseAll) {
          this.player.activeAilments.clear();
          this.player.setData('status_immune_ms', 5000);
          this.floatText('PANACEA!', this.player.x, this.player.y - 30, '#ffffaa');
        }
        // Bandage — stop bleed + small heal
        if (def.stopBleed) {
          this.player.activeAilments.delete('bleed');
          this.player.setData('bleed_tick_accum', 0);
          if (def.healHp) { /* already handled above */ }
          else { this.player.heal(15); }
          this.floatText('BANDAGED!', this.player.x, this.player.y - 30, '#ffaaaa');
        }
      }

      // ── Legacy special cases ────────────────────────────────────────────────
      if (itemId === 'smoke_bomb') {
        this.floatText('Smoke Bomb Exploded!', this.player.x, this.player.y - 30, '#cccccc');
        this.triggerSmokeBombExplosion();
      } else if (itemId === 'whetstone') {
        this.player.restoreEdge();
        this.floatText('SHARPENED!', this.player.x, this.player.y - 30, '#ffaa44');
      } else if (isWarp) {
        this.floatText('WARPING TO TOWN...', this.player.x, this.player.y - 30, '#88ffff');
        AudioManager.playSFX('anomaly_sting');
        this.time.delayedCall(1000, () => {
          s.location = 'town';
          s.dungeonFloor = 0;
          s.position = { x: 640, y: 600 };
          SaveManager.write(s);
          this.scene.stop('UIScene');
          this.scene.start('TownScene');
        });
      }

      s.currentHp = this.player.currentHp;
      s.currentMp = this.player.currentMp;
      SaveManager.write(s);
      this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(s.inventory));
    });

    if (!started) return;

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
    if (this.bosses.some(b => !b.isDead)) {
      this.showCenterText('A boss is still alive!');
      return;
    }

    // Hungering Dark secret boss spawn check
    const hungeringDarkAlive = this.enemies.getChildren().some(e => (e as any).def?.id === 'anom_hungering_dark' && e.active);
    if (this.anomalyState['hungering_dark_spawned'] && hungeringDarkAlive) {
      this.showCenterText('Defeat the Hungering Dark first!');
      return;
    }
    if (!this.usedTorchOnFloor && !this.anomalyState['hungering_dark_spawned']) {
      this.anomalyState['hungering_dark_spawned'] = true;
      this.showCenterText("THE HUNGERING DARK ARRIVES!\nYour courage in darkness summoned it.");

      this.spawnAnomalyEnemy('anom_hungering_dark', 'The Hungering Dark', this.player.x, this.player.y - TILE * 3, {
        hp: 2400 + this.floor * 400, dmg: this.floor * 18 + 28, speed: 72, exp: this.floor * 400,
        archetype: 'chaser', dropItem: 'void_essence', dropChance: 1.0,
      });
      AudioManager.playSFX('anomaly_sting');
      this.cameras.main.flash(600, 20, 0, 40, true);
      return;
    }

    this.warping = true;
    AudioManager.playSFX('anomaly_sting');
    const save = SaveManager.load()!;
    save.lastWarpIndex = warpIndex;
    save.companions = this.companions.map(c => c.toSaveData());

    const hasAscension = SaveManager.getAscensionTier() > 0;
    if (this.floor >= 11 || (this.floor === 10 && !hasAscension)) {
      this.showVictorySequence();
      return;
    }
    const nextFloor = this.floor + 1;
    save.dungeonFloor = nextFloor;
    save.floorSeed    = Math.floor(Math.random() * 0x7fffffff);
    save.currentHp    = this.player.currentHp;
    save.currentMp    = this.player.currentMp;
    save.gold         = this.player.gold;
    save.exp          = this.player.exp;
    save.position = { x: 31 * 32 + 16, y: 36 * 32 + 16 };

    // Clear F5 without potion check
    if (this.floor === 5 && !this.usedPotionOnFloor5) {
      if (save.activeBounties) {
        for (const bounty of save.activeBounties) {
          if (bounty.id === 'b_clear_f5_no_pot' && !bounty.completed) {
            bounty.progress = 1;
            bounty.completed = true;
          }
        }
      }
    }

    // Progress reach_floor bounties
    if (save.activeBounties) {
      for (const bounty of save.activeBounties) {
        if (bounty.completed) continue;
        const tpl = BOUNTY_POOL.find(b => b.id === bounty.id);
        if (tpl?.type === 'reach_floor' && parseInt(tpl.target ?? '0') <= nextFloor) {
          bounty.progress = 1;
          bounty.completed = true;
        }
      }
    }

    SaveManager.write(save);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('UIScene');
      this.scene.start('FloorTransitionScene', { floor: nextFloor });
    });
    this.cameras.main.fadeOut(300, 0, 0, 0);
  }

  private updateTelegraphWarnings(time: number, delta: number): void {
    if (!this.telegraphWarningGraphics) return;

    const cam = this.cameras.main;
    const bounds = cam.worldView;
    const px = this.player.x;
    const py = this.player.y;

    const pulseAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 0.015));

    // Check all active enemies
    const enemies = (this.enemies?.getChildren() ?? []) as Enemy[];
    for (const enemy of enemies) {
      if (enemy.active && enemy.currentAiState === 'telegraph') {
        if (!bounds.contains(enemy.x, enemy.y)) {
          this.drawTelegraphIndicator(enemy.x, enemy.y, px, py, bounds, pulseAlpha);
        }
      }
    }

    // Check all active bosses
    for (const boss of this.bosses) {
      if (boss.active && !boss.isDead && boss.currentAiState === 'telegraph') {
        if (!bounds.contains(boss.x, boss.y)) {
          this.drawTelegraphIndicator(boss.x, boss.y, px, py, bounds, pulseAlpha);
        }
      }
    }
  }

  private drawTelegraphIndicator(ex: number, ey: number, px: number, py: number, bounds: Phaser.Geom.Rectangle, alpha: number): void {
    const margin = 12;
    const minX = bounds.x + margin;
    const maxX = bounds.right - margin;
    const minY = bounds.y + margin;
    const maxY = bounds.bottom - margin;

    // Clamp coords to viewport edge
    const ix = Phaser.Math.Clamp(ex, minX, maxX);
    const iy = Phaser.Math.Clamp(ey, minY, maxY);

    // Direction vector pointing to the enemy from the edge warning indicator
    const theta = Math.atan2(ey - iy, ex - ix);

    const len = 10;
    const width = 7;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const tipX = ix + cos * len;
    const tipY = iy + sin * len;

    const leftX = ix - cos * 3 - sin * width;
    const leftY = iy - sin * 3 + cos * width;

    const rightX = ix - cos * 3 + sin * width;
    const rightY = iy - sin * 3 - cos * width;

    this.telegraphWarningGraphics.fillStyle(0xff3333, alpha);
    this.telegraphWarningGraphics.beginPath();
    this.telegraphWarningGraphics.moveTo(tipX, tipY);
    this.telegraphWarningGraphics.lineTo(leftX, leftY);
    this.telegraphWarningGraphics.lineTo(rightX, rightY);
    this.telegraphWarningGraphics.closePath();
    this.telegraphWarningGraphics.fillPath();

    this.telegraphWarningGraphics.lineStyle(1.0, 0xffffff, alpha * 0.8);
    this.telegraphWarningGraphics.beginPath();
    this.telegraphWarningGraphics.moveTo(tipX, tipY);
    this.telegraphWarningGraphics.lineTo(leftX, leftY);
    this.telegraphWarningGraphics.lineTo(rightX, rightY);
    this.telegraphWarningGraphics.closePath();
    this.telegraphWarningGraphics.strokePath();
  }

  // ── Death ─────────────────────────────────────────────────────────────────────
  private createRunSummaryCard(cx: number, cy: number, save: any, victory: boolean, cause: string): Phaser.GameObjects.Container {
    const card = this.add.container(0, 0).setScrollFactor(0).setDepth(31);
    const width = 360;
    const height = 90;
    const boxY = cy + 18;

    // Background panel
    const borderCol = victory ? 0xd4af37 : 0xd93838;
    const bg = this.add.rectangle(cx, boxY, width, height, 0x0c0612, 0.92)
      .setStrokeStyle(1.5, borderCol)
      .setOrigin(0.5);
    card.add(bg);

    // Title / Header
    const headerText = victory ? '— CONQUEROR RECORD —' : '— RUN SUMMARY —';
    const headerColor = victory ? '#ffd700' : '#ff5555';
    const header = this.add.text(cx, boxY - height / 2 + 6, headerText, {
      fontSize: '8px',
      color: headerColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    card.add(header);

    // Calculations
    const survivedMs = Date.now() - this.runStartMs;
    const mins = Math.floor(survivedMs / 60000);
    const secs = Math.floor((survivedMs % 60000) / 1000);
    const timeStr = `${mins}m ${secs}s`;

    const name = save?.name ?? 'Unknown Hero';
    const raceClass = save ? `(${save.race}/${save.clazz})` : '';
    const title = save?.title ? `[${save.title}]` : '';

    const gold = save?.gold ?? 0;
    const biggestHit = save?.biggestHit ?? 0;
    const rarestFind = save?.rarestFind ?? 'None';
    const bosses = (save?.bossesSlain ?? []).join(', ') || 'None';

    // Build active modifiers list
    const mods: string[] = [];
    if (save?.masochist) mods.push('Masochist');
    if (save?.ironbound) mods.push('Ironbound');
    if (save?.starved) mods.push('Starved');
    if (save?.hunted) mods.push('Hunted');
    if (save?.blackout) mods.push('Blackout');
    const modsStr = mods.join(', ') || 'None';

    const colYStart = boxY - height / 2 + 16;
    const lineH = 10;

    // Left Column fields
    const leftX = cx - width / 2 + 10;
    const leftLines = [
      `Hero: ${name} ${raceClass}`,
      `Title: ${title || 'Challenger'}`,
      `Time: ${timeStr}`,
      `Gold Earned: ${gold}g`,
      `Modifiers: ${modsStr}`
    ];

    leftLines.forEach((line, i) => {
      const txt = this.add.text(leftX, colYStart + i * lineH, line, {
        fontSize: '7px',
        color: '#ccbbee'
      });
      card.add(txt);
    });

    // Right Column fields
    const rightX = cx + 15;
    const rightLines = [
      victory ? `Status: SURVIVED` : `Status: SLAIN`,
      `Floor: Floor ${this.floor}`,
      `Biggest Hit: ${biggestHit} dmg`,
      `Rarest Find: ${rarestFind}`,
      `Bosses Slain: ${bosses}`
    ];

    rightLines.forEach((line, i) => {
      const txt = this.add.text(rightX, colYStart + i * lineH, line, {
        fontSize: '7px',
        color: '#ccbbee',
        wordWrap: { width: width / 2 - 20 }
      });
      card.add(txt);
    });

    return card;
  }

  private onPlayerDied(): void {
    this.player.playDeathAnim();
    // Stop persistent sounds immediately
    AudioManager.stopMusic();
    AudioManager.stopHeartbeat();
    AudioManager.stopDrone('rift');
    AudioManager.stopDrone('blood_moon');
    AudioManager.playSFX('death');

    // Determine offender
    const aliveBoss = this.bosses.find(b => !b.isDead);
    let offender: any = aliveBoss;
    if (!offender) {
      const enemies = (this.enemies?.getChildren() ?? []) as Enemy[];
      const nearby = enemies
        .filter(e => e.active)
        .sort((a, b) =>
          Phaser.Math.Distance.Between(a.x, a.y, this.player.x, this.player.y) -
          Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y),
        );
      if (nearby.length > 0) offender = nearby[0];
    }

    // Freeze player corporeal state and play red tint
    this.player.anims.stop();
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    this.player.setTint(0xff5555);

    // Freeze offending enemy
    if (offender) {
      if (offender.anims) offender.anims.stop();
      if (offender.body) (offender.body as Phaser.Physics.Arcade.Body).setVelocity(0);
      if (offender.setTint) offender.setTint(0xff5555);
    }

    // Slow-mo and desaturate
    this.time.timeScale = 0.12;
    this.physics.world.timeScale = 0.12;
    this.cameras.main.flash(150, 255, 0, 0, false);
    this.game.canvas.style.filter = 'grayscale(100%)';

    // Wait exactly 400ms (real time) before bringing up the death card overlay
    setTimeout(() => {
      this.showDeathScreen();
    }, 400);
  }

  private onPerfectDodge(data: { x: number; y: number }): void {
    AudioManager.playSFX('perfect_dodge');
    this.floatText('PERFECT DODGE!', data.x, data.y - 20, '#55ff55');
    // §P11 — Grant Focus state: +15% crit on next hit + 10 stamina
    this.player.applyFocusState();
    this.floatText('FOCUS!', data.x, data.y - 34, '#ffdd33');
  }

  private getCauseOfDeath(): string {
    const aliveBoss = this.bosses.find(b => !b.isDead);
    if (aliveBoss) return `Slain by ${aliveBoss.def.name}`;
    const enemies = (this.enemies?.getChildren() ?? []) as Enemy[];
    const nearby = enemies
      .filter(e => e.active)
      .sort((a, b) =>
        Phaser.Math.Distance.Between(a.x, a.y, this.player.x, this.player.y) -
        Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y),
      );
    if (nearby.length > 0) return `Slain by ${nearby[0].def.name}`;
    return `Fell on Floor ${this.floor}`;
  }

  private showDeathScreen(): void {
    // Restore timescales
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;

    const save = SaveManager.load();
    const cause = this.getCauseOfDeath();

    // Record run history before wipe
    let runNumber = 1;
    if (save) {
      const survivedMs = Date.now() - this.runStartMs;
      const entry: RunHistoryEntry = {
        runNumber: 0,
        name: save.name,
        race: save.race,
        clazz: save.clazz,
        floorReached: this.floor,
        bossesSlain: save.bossesSlain ?? [],
        causeOfDeath: `${cause} — Floor ${this.floor}`,
        survivedMs,
        goldEarned: save.gold,
        endedAt: new Date().toISOString(),
        victory: false,
        title: save.title,
        biggestHit: save.biggestHit,
        rarestFind: save.rarestFind
      };
      SaveManager.appendRunHistory(entry);
      runNumber = entry.runNumber || SaveManager.loadAccountMeta().runHistory.length;

      // Log local telemetry for balancing
      const telemetryEntry = {
        causeOfDeath: cause,
        floor: this.floor,
        layoutSeed: this.seed || 0,
        elapsedMs: survivedMs,
        endedAt: new Date().toISOString(),
        modifiers: {
          masochist: save.masochist || false,
          ironbound: save.ironbound || false,
          starved: save.starved || false,
          hunted: save.hunted || false,
          blackout: save.blackout || false,
          glass: save.glass || false,
          wrongfooted: save.wrongfooted || false
        }
      };
      SaveManager.logTelemetry(telemetryEntry);
    }

    const sw = this.scale.width, sh = this.scale.height, cx = sw / 2, cy = sh / 2;
    const meta = SaveManager.loadAccountMeta();
    const ascTier = meta.ascensionTier ?? 0;

    // Backdrop
    const bg = this.add.rectangle(cx, cy, sw, sh, 0x000000, 0).setScrollFactor(0).setDepth(30);
    this.tweens.add({ targets: bg, fillAlpha: 0.88, duration: 600 });

    // YOU DIED
    const died = this.add.text(cx, cy - 60, 'YOU DIED', {
      fontSize: '22px', color: '#ff3333', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(31).setAlpha(0);
    this.tweens.add({ targets: died, alpha: 1, duration: 500, delay: 200 });

    // Cause of death
    const causeT = this.add.text(cx, cy - 34, cause, {
      fontSize: '9px', color: '#cc4444',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(31).setAlpha(0);
    this.tweens.add({ targets: causeT, alpha: 1, duration: 400, delay: 500 });

    // Run Summary Card
    const card = this.createRunSummaryCard(cx, cy, save, false, cause);
    card.setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 600, delay: 700 });

    // Continue prompt
    const prompt = this.add.text(cx, cy + 82, 'ENTER to continue', {
      fontSize: '11px', color: '#885555',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(31).setAlpha(0);
    this.tweens.add({ targets: prompt, alpha: { from: 0, to: 1 }, delay: 1300, duration: 400,
      onComplete: () => {
        this.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.3 }, duration: 700, yoyo: true, repeat: -1 });
      },
    });

    // Lore bottom text
    const loreT = this.add.text(cx, cy + 115, '"Reality resets. A new hero will wake in Nightfall."', {
      fontSize: '7px', color: '#663333', align: 'center', fontStyle: 'italic',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(31).setAlpha(0);
    this.tweens.add({ targets: loreT, alpha: 1, duration: 400, delay: 1500 });

    this.input.keyboard!.once('keydown-ENTER', () => {
      this.game.canvas.style.filter = '';
      SaveManager.wipe();
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });
  }

  // ── Enemy death ───────────────────────────────────────────────────────────────
  private onEnemyDied(enemy: Enemy): void {
    const save = SaveManager.load();

    // Volatile affix: explode on death
    if (enemy.isVolatile) {
      const ex = enemy.x, ey = enemy.y;
      const burst = this.add.circle(ex, ey, 12, 0xaa44ff, 0.5).setDepth(5);
      this.tweens.add({ targets: burst, scaleX: 5, scaleY: 5, alpha: 0, duration: 280, onComplete: () => burst.destroy() });
      const blastRadius = 56;
      if (Phaser.Math.Distance.Between(ex, ey, this.player.x, this.player.y) < blastRadius) {
        this.player.takeDamage(Math.round(enemy.def.dmg * 1.2), ex, ey);
        this.floatText('VOLATILE!', this.player.x, this.player.y - 20, '#aa44ff');
      }
      this.cameras.main.shake(120, 0.008);
    }

    // EXP gain (champions give 3× exp)
    const expGain = enemy.isChampion ? enemy.def.exp * 3 : enemy.def.exp;
    const didLevel = this.player.gainExp(expGain);
    if (didLevel) this.floatText('LEVEL UP!', this.player.x, this.player.y - 30, '#ffee55');

    // §24 Weighted loot drop (floor-scaled, pity nudge, blood-moon doubling)
    const isBloodMoon = this.activeAnomaly === 'blood_moon';
    const lootResults = LootSystem.rollEnemyDrops(enemy.def.id, this.floor, enemy.isChampion, isBloodMoon);
    let gotRareDrop = false;
    for (const drop of lootResults) {
      if (!save) break;
      if (drop.isGold) {
        this.player.addGold(drop.qty);
        save.gold = this.player.gold;
        this.floatText(`+${drop.qty}g`, enemy.x, enemy.y + 12, '#ffd700');
      } else {
        // Inventory weight cap check (masochist toggle)
        if (save.masochist) {
          const currentWeight = (save.inventory ?? []).reduce((w, it) => {
            const item = ITEMS[it.itemId];
            return w + (item?.weight ?? 0) * it.qty;
          }, 0);
          const dropItem = ITEMS[drop.itemId];
          const dropWeight = (dropItem?.weight ?? 0) * drop.qty;
          const MAX_CARRY_WEIGHT = 120;
          if (currentWeight + dropWeight > MAX_CARRY_WEIGHT) {
            this.floatText('BAG FULL (weight)', enemy.x, enemy.y - 20, '#ff8800');
            continue;
          }
        }
        addToInventory(save.inventory, drop.itemId, drop.qty);
        const itemName = ITEMS[drop.itemId]?.name ?? drop.itemId;
        const isRare = drop.itemId.includes('_t5') || drop.itemId.includes('_t6')
          || drop.itemId.includes('_t7') || drop.itemId.includes('_t8')
          || drop.itemId.includes('_t9')
          || drop.itemId === 'dragon_scale' || drop.itemId === 'frost_crystal'
          || drop.itemId === 'choir_soul'   || drop.itemId === 'riftmaw_eye'
          || drop.itemId === 'twin_crest'   || drop.itemId === 'sovereign_heart';
        const floatColor = isRare ? '#ffaa00' : '#88ccff';
        const prefix = isRare ? '★ ' : '+';
        this.floatText(`${prefix}${drop.qty} ${itemName}`, enemy.x, enemy.y - (gotRareDrop ? 14 : 0), floatColor);
        if (isRare) gotRareDrop = true;
        if (isBloodMoon && !drop.isGold) {
          this.floatText('BLOOD MOON DROP!', enemy.x, enemy.y - 28, '#ff4444');
        }
      }
    }

    // Champion guaranteed floor-appropriate rare material drop
    if (enemy.isChampion && save) {
      const matId = championMatForFloor(this.floor);
      addToInventory(save.inventory, matId, 1);
      const matName = ITEMS[matId]?.name ?? matId;
      this.floatText(`CHAMPION DROP: +1 ${matName}!`, enemy.x, enemy.y - 20, '#ffd700');
    }

    // Clockwork judge: clean champion kill
    if (enemy.isChampion && this.activeAnomaly === 'clockwork_judge' && !this.anomalyState['judgeSpawned']) {
      const timeSinceHit = this.time.now - this.playerLastHitMs;
      if (timeSinceHit > 20000 && !this.anomalyState['tookDmgThisChampion']) {
        this.spawnAnomalyEnemy('anom_judge', 'The Clockwork Judge', enemy.x, enemy.y,
          { hp: 2000 + this.floor * 400, dmg: this.floor * 18 + 30, speed: 50, exp: this.floor * 400, archetype: 'caster', dropItem: 'judge_mechanism', dropChance: 1.0 });
        this.anomalyState['judgeSpawned'] = 1;
        this.showCenterText('THE CLOCKWORK JUDGE\n"Perfection acknowledged."');
        this.game.events.emit('anomaly-whisper', 'The judge arrives to test you.');
      }
      this.anomalyState['tookDmgThisChampion'] = 0;
    }

    // Echo shade: grant lost gold
    if (enemy.def.id === 'anom_echo_shade' && this.activeAnomaly === 'echo_fallen_hero' && save) {
      const goldReward = Math.max(50, Math.round(this.player.gold * 0.15));
      this.player.addGold(goldReward);
      save.gold = this.player.gold;
      this.floatText(`+${goldReward}g recovered`, enemy.x, enemy.y - 20, '#ffd700');
    }

    // Gravelord: drop grave_ash
    if (enemy.def.id === 'anom_gravelord' && save) {
      addToInventory(save.inventory, 'grave_ash', 2);
      this.floatText('+2 Grave Ash', enemy.x, enemy.y - 20, '#aaaacc');
    }

    // Hunter: grant nemesis mark + increment kill count
    if (enemy.def.id === 'anom_hunter' && save) {
      addToInventory(save.inventory, 'nemesis_mark', 1);
      save.nemesisKills = (save.nemesisKills ?? 0) + 1;
      this.floatText(`HUNTER SLAIN! Nemesis kills: ${save.nemesisKills}`, enemy.x, enemy.y - 20, '#8844ff');
    }

    if (save) {
      save.exp = this.player.exp;
      save.level = this.player.level;

      // §26 Track kill counts for run history + bounty progress
      if (!enemy.def.id.startsWith('anom_')) {
        save.enemiesKilled = (save.enemiesKilled ?? 0) + 1;
        if (!save.enemyKillMap) save.enemyKillMap = {};
        save.enemyKillMap[enemy.def.id] = (save.enemyKillMap[enemy.def.id] ?? 0) + 1;

        if (save.activeBounties) {
          const total = save.enemiesKilled;
          for (const bounty of save.activeBounties) {
            if (bounty.completed) continue;
            const tpl = BOUNTY_POOL.find(b => b.id === bounty.id);
            if (!tpl) continue;
            if (tpl.type === 'kill_type') {
              const matches = tpl.target === 'champion'
                ? enemy.isChampion
                : tpl.target === enemy.def.id;
              if (matches) {
                bounty.progress = Math.min(tpl.count, bounty.progress + 1);
                if (bounty.progress >= tpl.count) bounty.completed = true;
              }
            } else if (tpl.type === 'kill_count') {
              bounty.progress = total;
              if (bounty.progress >= tpl.count) bounty.completed = true;
            } else if (tpl.type === 'radiant_undead') {
              const isUndead = enemy.def.elemFamily === 'undead' || enemy.def.body === 'bone';
              const wasRadiant = enemy.lastHitElement === 'radiant';
              if (isUndead && wasRadiant) {
                bounty.progress = Math.min(tpl.count, bounty.progress + 1);
                if (bounty.progress >= tpl.count) bounty.completed = true;
              }
            }
          }
        }
      }

      SaveManager.write(save);
      if (lootResults.length > 0 || enemy.isChampion) this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
    }

    // P10 — Research tracking (survives permadeath on AccountMeta)
    if (!enemy.def.id.startsWith('anom_')) {
      const accountMeta = SaveManager.loadAccountMeta();
      const { rankUp, newLevel } = ResearchSystem.recordKill(accountMeta, enemy.def.id);
      SaveManager.writeAccountMeta(accountMeta);
      if (rankUp) {
        this.floatText(`✦ Research Lv${newLevel}: ${enemy.def.name}!`, enemy.x, enemy.y - 36, '#aaffdd');
      }
    }

    this.floatText(`+${expGain}xp`, enemy.x, enemy.y - 14, '#aaddff');
    enemy.destroy();
  }

  private onChampionBreak(data: { x: number; y: number; enemyId?: string }): void {
    this.floatText('PART BROKEN!', data.x, data.y - 24, '#ffd700');
    this.cameras.main.shake(200, 0.014);
    const ring = this.add.circle(data.x, data.y, 20, 0xffd700, 0.4).setDepth(5);
    this.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
    // P10 — Record break in Research
    if (data.enemyId) {
      const accountMeta = SaveManager.loadAccountMeta();
      const { rankUp, newLevel } = ResearchSystem.recordBreak(accountMeta, data.enemyId);
      SaveManager.writeAccountMeta(accountMeta);
      if (rankUp) {
        this.floatText(`✦ Research Lv${newLevel}!`, data.x, data.y - 48, '#aaffdd');
      }
    }
  }

  private onToppleBrute(): void {
    const s = SaveManager.load();
    if (s && s.activeBounties) {
      for (const b of s.activeBounties) {
        if (b.id === 'b_topple_brute' && !b.completed) {
          b.progress = 1;
          b.completed = true;
          this.floatText("Bounty Complete: Topple a Brute!", this.player.x, this.player.y - 28, "#88ff88");
        }
      }
      SaveManager.write(s);
    }
  }

  // ── Decoration scatter ────────────────────────────────────────────────────────
  private placeDecorations(): void {
    const rng = mkDecoRng(this.seed);
    const isFloorTile = (t: number) =>
      t === 1 || t === 9 ||
      t === T_FLOOR_FOREST || t === T_FLOOR_DEAD || t === T_FLOOR_POND || t === T_FLOOR_ROCK ||
      t === T_FLOOR_FUNGAL || t === T_FLOOR_BARRACKS || t === T_FLOOR_FOUNDRY || t === T_FLOOR_FROZEN ||
      t === T_FLOOR_CATACOMBS || t === T_FLOOR_VOID || t === T_FLOOR_THRONE;

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
        // Vault check
        const room = (this.floorData.rooms || []).find(r =>
          cs.col >= r.bounds.x && cs.col < r.bounds.x + r.bounds.w &&
          cs.row >= r.bounds.y && cs.row < r.bounds.y + r.bounds.h
        );
        if (room && room.archetype === 'vault') {
          const save = SaveManager.load();
          if (save) {
            const hasLockpick = save.inventory.some(i => i.itemId === 'lockpick' && i.qty > 0);
            if (!hasLockpick) {
              this.floatText("Locked! You need a Lockpick.", cx, cy - 16, "#ff6666");
              break;
            }
            this.consumeInventoryItem(save.inventory, 'lockpick', 1);
            SaveManager.write(save);
            this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
            this.floatText("-1 Lockpick used", this.player.x, this.player.y - 20, "#ffaa44");
          }
        }

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

  private consumeInventoryItem(inventory: import('../types').ItemInstance[], itemId: string, qty: number): void {
    let remaining = qty;
    for (let i = inventory.length - 1; i >= 0; i--) {
      if (inventory[i].itemId === itemId) {
        if (inventory[i].qty > remaining) {
          inventory[i].qty -= remaining;
          remaining = 0;
          break;
        } else {
          remaining -= inventory[i].qty;
          inventory.splice(i, 1);
          if (remaining <= 0) break;
        }
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  /** Maps a GameElement to its tint color for damage number display (§E15). */
  private elemColor(element: string): string {
    switch (element) {
      case 'fire':      return '#ff6622';
      case 'ice':       return '#00ddff';
      case 'lightning': return '#ffee00';
      case 'poison':    return '#44ff44';
      case 'void':      return '#bb44ff';
      case 'radiant':   return '#ffffcc';
      default:          return '#ffffff';
    }
  }

  private elemShape(element: string): string {
    if (!this.colorblindMode) return '';
    switch (element) {
      case 'fire':      return ' ▲';
      case 'ice':       return ' ■';
      case 'lightning': return ' ◆';
      case 'poison':    return ' ●';
      case 'void':      return ' ▼';
      case 'radiant':   return ' ★';
      default:          return '';
    }
  }

  private floatText(msg: string, x: number, y: number, color: string, element?: string): void {
    if (!this.showDamageNumbers && /^\d+!?$/.test(msg)) return;
    let finalMsg = msg;
    if (element) finalMsg += this.elemShape(element);
    const t = this.add.text(x, y, finalMsg, { fontSize: '7px', color }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: t, alpha: 0, y: y - 26, duration: 1000, onComplete: () => t.destroy() });
  }

  private showCenterText(msg: string): void {
    this.add.text(this.scale.width/2, this.scale.height/2, msg,
      { fontSize: '16px', color: '#ddaaff', align: 'center' },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(35);
  }

  private collectFloorCells(tiles: number[][]): { col: number; row: number }[] {
    const walkable = new Set([
      1, 9, T_FLOOR_FOREST, T_FLOOR_DEAD, T_FLOOR_POND, T_FLOOR_ROCK,
      T_FLOOR_FUNGAL, T_FLOOR_BARRACKS, T_FLOOR_FOUNDRY, T_FLOOR_FROZEN,
      T_FLOOR_CATACOMBS, T_FLOOR_VOID, T_FLOOR_THRONE
    ]);
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

    for (let i = potential.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [potential[i], potential[j]] = [potential[j], potential[i]];
    }

    const count = Math.min(potential.length, 25);

    if (this.floor === 2) {
      for (let i = 0; i < count; i++) {
        const h = new Hazard(this, potential[i].col, potential[i].row, 'water');
        this.hazards.push(h);
        this.hazardGroup.add(h);
      }
    } else if (this.floor === 3) {
      const gasCount = Math.floor(count * 0.6);
      const puffCount = Math.floor(count * 0.4);
      for (let i = 0; i < gasCount; i++) {
        const h = new Hazard(this, potential[i].col, potential[i].row, 'gas');
        this.hazards.push(h);
        this.hazardGroup.add(h);
      }
      for (let i = gasCount; i < gasCount + puffCount; i++) {
        const cell = potential[i];
        const circle = this.add.circle((cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, 8, 0x22aa33, 0.8).setDepth(2);
        this.add.circle((cell.col + 0.3) * TILE, (cell.row + 0.3) * TILE, 2, 0xffaa00, 1.0).setDepth(2.1);
        this.add.circle((cell.col + 0.7) * TILE, (cell.row + 0.6) * TILE, 2, 0xffaa00, 1.0).setDepth(2.1);
        this.puffballs.push({ x: circle.x, y: circle.y, triggered: false, circle });
      }
    } else if (this.floor === 5) {
      const lavaCount = Math.floor(count * 0.5);
      const oilCount = Math.floor(count * 0.5);
      for (let i = 0; i < lavaCount; i++) {
        const h = new Hazard(this, potential[i].col, potential[i].row, 'fire');
        this.hazards.push(h);
        this.hazardGroup.add(h);
      }
      for (let i = lavaCount; i < lavaCount + oilCount; i++) {
        const h = new Hazard(this, potential[i].col, potential[i].row, 'oil');
        this.hazards.push(h);
        this.hazardGroup.add(h);
      }
    } else if (this.floor === 6) {
      const iceCount = Math.floor(count * 0.6);
      const thinCount = Math.floor(count * 0.4);
      for (let i = 0; i < iceCount; i++) {
        const h = new Hazard(this, potential[i].col, potential[i].row, 'ice');
        this.hazards.push(h);
        this.hazardGroup.add(h);
      }
      for (let i = iceCount; i < iceCount + thinCount; i++) {
        const cell = potential[i];
        const rect = this.add.rectangle((cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, TILE - 2, TILE - 2, 0x88ccff, 0.25).setDepth(1.2);
        this.thinIceTiles.push({ col: cell.col, row: cell.row, collapsed: false, rect });
      }
      const { width: sw, height: sh } = this.scale;
      const blizzardOverlay = this.add.rectangle(sw / 2, sh / 2, sw, sh, 0xffffff, 0.12)
        .setScrollFactor(0).setDepth(200);
      this.tweens.add({
        targets: blizzardOverlay,
        alpha: { from: 0.08, to: 0.18 },
        duration: 2500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
      this.anomalyFovRadius = 3.5;
    } else if (this.floor === 7) {
      const curseCount = Math.floor(count * 0.6);
      const spawnerCount = Math.min(3, Math.max(1, Math.floor(count * 0.1)));
      
      for (let i = 0; i < curseCount; i++) {
        const h = new Hazard(this, potential[i].col, potential[i].row, 'gas');
        h.setFillStyle(0x3a1a4a, 0.4);
        (h as any).isCurseFog = true;
        this.hazards.push(h);
        this.hazardGroup.add(h);
      }

      for (let i = 0; i < spawnerCount; i++) {
        const cell = potential[curseCount + i];
        const rect = this.add.rectangle((cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, TILE, TILE, 0x1a0f30).setStrokeStyle(1.5, 0xaa22ff).setDepth(3);
        this.gravetideSpawners.push({
          x: rect.x,
          y: rect.y,
          nextSpawnTime: this.time.now + 10000 + Math.random() * 5000,
          sprite: rect
        });
      }
    } else if (this.floor === 8) {
      const wellCount = Math.min(3, Math.max(1, Math.floor(count * 0.1)));
      const riftCount = 5;

      for (let i = 0; i < wellCount; i++) {
        const cell = potential[i];
        const cx = (cell.col + 0.5) * TILE;
        const cy = (cell.row + 0.5) * TILE;
        const outer = this.add.circle(cx, cy, 60, 0x5a189a, 0.15).setDepth(1.2);
        const inner = this.add.circle(cx, cy, 10, 0x000000, 1.0).setStrokeStyle(2, 0xff00ff).setDepth(1.3);
        this.tweens.add({ targets: outer, scaleX: 1.3, scaleY: 1.3, alpha: 0.05, duration: 1800, yoyo: true, repeat: -1 });
        this.gravityWells.push({ x: cx, y: cy, radius: 60, outerCircle: outer, innerCircle: inner });
      }

      for (let i = 0; i < riftCount; i++) {
        const cell = potential[wellCount + i];
        const rS = this.add.circle((cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, 6, 0x8222ff, 0.75)
          .setStrokeStyle(1.5, 0xffffff).setDepth(3);
        this.physics.add.existing(rS);
        const angle = Math.random() * Math.PI * 2;
        this.driftingRifts.push({
          sprite: rS,
          vx: Math.cos(angle) * 35,
          vy: Math.sin(angle) * 35
        });
      }
    } else {
      const hazardTypes: HazardType[] = ['water', 'oil', 'ice', 'gas'];
      for (let i = 0; i < count; i++) {
        const cell = potential[i];
        const type = hazardTypes[Math.floor(Math.random() * hazardTypes.length)];
        const h = new Hazard(this, cell.col, cell.row, type);
        this.hazards.push(h);
        this.hazardGroup.add(h);
      }
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
      if ((hazard as any).isCurseFog) {
        StatusSystem.applyBuildUp(target, 'corruption', 15 * delta / 1000, this);
      } else {
        StatusSystem.applyBuildUp(target, 'poison', 20 * delta / 1000, this);
      }
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

  // ── P12 Room Objects Spawning & Ticks ──────────────────────────────────────────
  private static readonly LORE_POOL = [
    "Clue: Lighting all 4 black candles in the catacombs summons the Gravelord.",
    "Clue: Avarice, the Gilded Maw, smells gold. Enter a vault with at least 800 gold to summon him.",
    "Clue: Ring the clockwork bell after slaying a floor champion without taking damage to summon the Clockwork Judge.",
    "Clue: Pages of a forgotten journal at campfires will call an Old Friend to your side.",
    "Clue: Warping from a floor without ever lighting a torch or holding lamp items will draw the Hungering Dark.",
    "Clue: Corner the radiant stag Aurelion in all 3 floor quadrants to face him."
  ];

  private spawnRoomObjects(): void {
    const rooms = this.floorData.rooms || [];
    const sc = this.floorData.spawnCol;
    const sr = this.floorData.spawnRow;

    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const rx = (r.bounds.x + r.bounds.w / 2);
      const ry = (r.bounds.y + r.bounds.h / 2);

      const isSpawnRoom = (r.bounds.x <= sc && sc < r.bounds.x + r.bounds.w &&
                           r.bounds.y <= sr && sr < r.bounds.y + r.bounds.h);
      if (isSpawnRoom) continue;

      switch (r.archetype) {
        case 'vault': {
          const exists = this.floorData.chestPositions.some(c => 
            c.col >= r.bounds.x && c.col < r.bounds.x + r.bounds.w &&
            c.row >= r.bounds.y && c.row < r.bounds.y + r.bounds.h
          );
          if (!exists) {
            const cx = Math.floor(rx);
            const cy = Math.floor(ry);
            const sprite = this.add.image((cx + 0.5) * TILE, (cy + 0.5) * TILE, 'deco_chest_closed').setDepth(3);
            this.tweens.add({ targets: sprite, alpha: { from: 0.88, to: 1.0 }, duration: 900, yoyo: true, repeat: -1 });
            this.chestSprites.push({ sprite, col: cx, row: cy });
            this.floorData.chestPositions.push({ col: cx, row: cy });
          }
          break;
        }
        case 'arena': {
          const gates: { col: number; row: number; originalTile: number }[] = [];
          const bounds = r.bounds;
          
          for (let col = bounds.x; col < bounds.x + bounds.w; col++) {
            for (const row of [bounds.y, bounds.y + bounds.h - 1]) {
              const t = this.tiles[row][col];
              if (t !== T_WALL && t !== T_PILLAR && t !== T_WARP) {
                gates.push({ col, row, originalTile: t });
              }
            }
          }
          for (let row = bounds.y + 1; row < bounds.y + bounds.h - 1; row++) {
            for (const col of [bounds.x, bounds.x + bounds.w - 1]) {
              const t = this.tiles[row][col];
              if (t !== T_WALL && t !== T_PILLAR && t !== T_WARP) {
                gates.push({ col, row, originalTile: t });
              }
            }
          }

          this.activeArenas.push({
            roomId: `arena_${i}`,
            bounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
            gates,
            enemies: []
          });
          break;
        }
        case 'shrine': {
          this.placeProp(Math.floor(rx), Math.floor(ry), 'anom_shrine', 'room_shrine');
          break;
        }
        case 'library': {
          this.placeProp(Math.floor(rx), Math.floor(ry), 'deco_lectern', 'room_library');
          break;
        }
        case 'puzzle': {
          const ox = boundsToEmptyTile(r.bounds, 0, Math.floor(r.bounds.w / 2), this.tiles);
          const bx = boundsToEmptyTile(r.bounds, Math.floor(r.bounds.w / 2), r.bounds.w, this.tiles);
          if (ox && bx) {
            const sprO = this.add.image((ox.col + 0.5) * TILE, (ox.row + 0.5) * TILE, 'plate_orange').setDepth(1.2);
            const sprB = this.add.image((bx.col + 0.5) * TILE, (bx.row + 0.5) * TILE, 'plate_blue').setDepth(1.2);
            this.puzzlePlates.push({ sprite: sprO, col: ox.col, row: ox.row, color: 'orange', roomId: `puzzle_${i}` });
            this.puzzlePlates.push({ sprite: sprB, col: bx.col, row: bx.row, color: 'blue', roomId: `puzzle_${i}` });
          }
          break;
        }
        case 'merchant': {
          this.placeProp(Math.floor(rx), Math.floor(ry), 'anom_merchant', 'room_merchant');
          break;
        }
      }
    }

    function boundsToEmptyTile(bounds: { x: number; y: number; w: number; h: number }, xMin: number, xMax: number, tiles: number[][]): { col: number; row: number } | null {
      const candidates: { col: number; row: number }[] = [];
      for (let c = bounds.x + xMin + 1; c < bounds.x + xMax - 1; c++) {
        for (let r = bounds.y + 1; r < bounds.y + bounds.h - 1; r++) {
          if (tiles[r][c] !== T_WALL && tiles[r][c] !== T_PILLAR) {
            candidates.push({ col: c, row: r });
          }
        }
      }
      return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    }

    // Spawn 2-3 cracked wall tiles
    let crackCount = 0;
    for (let attempt = 0; attempt < 100 && crackCount < 3; attempt++) {
      const col = Phaser.Math.Between(3, this.mapCols - 4);
      const row = Phaser.Math.Between(3, this.mapRows - 4);
      if (this.tiles[row][col] === T_WALL) {
        const hasFloorNeighbor = 
          this.tiles[row-1][col] !== T_WALL || this.tiles[row+1][col] !== T_WALL ||
          this.tiles[row][col-1] !== T_WALL || this.tiles[row][col+1] !== T_WALL;
        if (hasFloorNeighbor) {
          this.crackedWalls.push({ col, row, revealed: false, sprite: null });
          crackCount++;
        }
      }
    }

    // Aurelion spawn F3+
    if (this.floor >= 3 && !this.anomalyState['aurelionSpawned']) {
      const cells = this.collectFloorCells(this.tiles);
      const cell = this.pickFarCell(cells, sc, sr, 18);
      if (cell) {
        const sprite = this.add.image((cell.col + 0.5) * TILE, (cell.row + 0.5) * TILE, 'anom_old_friend').setDepth(3).setTint(0xffd700);
        this.tweens.add({ targets: sprite, alpha: { from: 0.85, to: 1.0 }, duration: 800, yoyo: true, repeat: -1 });
        this.anomalyState['aurelionX'] = sprite.x;
        this.anomalyState['aurelionY'] = sprite.y;
        this.anomalyState['aurelionTrackCount'] = 0;
        this.anomalyState['aurelionFled'] = 0;
        this.anomalyState['aurelionSpawned'] = 1;
        (this as any).aurelionSprite = sprite;
      }
    }
  }

  private updateRoomArchetypesAndSummons(time: number, delta: number): void {
    this.updateArenas();
    this.updatePuzzlePlates();
    this.updateAurelionTrack();
    this.checkSecretsAndCrackedWalls();
    this.updateHazardsTick(time, delta);
  }

  private updateArenas(): void {
    const px = this.player.x;
    const py = this.player.y;
    const pCol = Math.floor(px / TILE);
    const pRow = Math.floor(py / TILE);

    for (const arena of this.activeArenas) {
      const bounds = arena.bounds;
      const stateKey = `arena_state_${arena.roomId}`;
      const state = this.anomalyState[stateKey] || 'inactive';

      if (state === 'inactive') {
        const inside = pCol > bounds.x && pCol < bounds.x + bounds.w - 1 &&
                       pRow > bounds.y && pRow < bounds.y + bounds.h - 1;
        if (inside) {
          this.anomalyState[stateKey] = 'active';
          this.showCenterText("ARENA SEALED!\nDefeat the attackers!");
          this.cameras.main.flash(400, 200, 50, 50, true);
          AudioManager.playSFX('anomaly_sting');

          for (const gate of arena.gates) {
            this.tiles[gate.row][gate.col] = T_WALL;
            this.mapLayer.putTileAt(T_WALL, gate.col, gate.row);
          }

          const pool = defsForFloor(this.floor);
          arena.enemies = [];
          for (let i = 0; i < 3; i++) {
            const def = pool[Phaser.Math.Between(0, pool.length - 1)];
            const ec = bounds.x + 1 + Phaser.Math.Between(0, bounds.w - 3);
            const er = bounds.y + 1 + Phaser.Math.Between(0, bounds.h - 3);
            const e = this.spawnOneEnemy(def, ec, er);
            if (e) arena.enemies.push(e);
          }
        }
      } else if (state === 'active') {
        const alive = arena.enemies.some(e => e.active && e.hp > 0);
        if (!alive) {
          this.anomalyState[stateKey] = 'completed';
          this.showCenterText("ARENA CLEARED!\nRoom unsealed.");
          this.cameras.main.flash(400, 50, 200, 50, true);

          for (const gate of arena.gates) {
            this.tiles[gate.row][gate.col] = gate.originalTile;
            this.mapLayer.putTileAt(gate.originalTile, gate.col, gate.row);
          }

          const cx = Math.floor(bounds.x + bounds.w / 2);
          const cy = Math.floor(bounds.y + bounds.h / 2);
          const sprite = this.add.image((cx + 0.5) * TILE, (cy + 0.5) * TILE, 'deco_chest_closed').setDepth(3);
          this.tweens.add({ targets: sprite, alpha: { from: 0.88, to: 1.0 }, duration: 900, yoyo: true, repeat: -1 });
          this.chestSprites.push({ sprite, col: cx, row: cy });
          this.floorData.chestPositions.push({ col: cx, row: cy });
        }
      }
    }
  }

  private updatePuzzlePlates(): void {
    if (this.puzzlePlates.length === 0) return;
    const activePuzzleRooms = new Set<string>();
    
    for (const plate of this.puzzlePlates) {
      const px = (plate.col + 0.5) * TILE;
      const py = (plate.row + 0.5) * TILE;
      let isPressed = false;
      
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, px, py) < TILE * 0.6) {
        isPressed = true;
      }
      
      if (!isPressed) {
        for (const comp of this.companions) {
          if (Phaser.Math.Distance.Between(comp.x, comp.y, px, py) < TILE * 0.6) {
            isPressed = true;
            break;
          }
        }
      }
      
      if (!isPressed) {
        for (const child of this.enemies.getChildren()) {
          const e = child as unknown as Enemy;
          if (e.active && Phaser.Math.Distance.Between(e.x, e.y, px, py) < TILE * 0.6) {
            isPressed = true;
            break;
          }
        }
      }

      if (isPressed) {
        plate.sprite.setScale(0.8);
        plate.sprite.setTint(0x55ff55);
        activePuzzleRooms.add(plate.roomId);
        (plate as any).pressed = true;
      } else {
        plate.sprite.setScale(1.0);
        plate.sprite.setTint(plate.color === 'orange' ? 0xffaa00 : 0x0088ff);
        (plate as any).pressed = false;
      }
    }

    const solvedRooms = new Set<string>();
    for (const plate of this.puzzlePlates) {
      if (plate.roomId && !solvedRooms.has(plate.roomId)) {
        const platesForRoom = this.puzzlePlates.filter(p => p.roomId === plate.roomId);
        if (platesForRoom.length === 2 && platesForRoom.every(p => (p as any).pressed)) {
          solvedRooms.add(plate.roomId);
          const roomIdx = parseInt(plate.roomId.split('_')[1]);
          const room = this.floorData.rooms[roomIdx];
          const cx = Math.floor(room.bounds.x + room.bounds.w / 2);
          const cy = Math.floor(room.bounds.y + room.bounds.h / 2);
          
          const sprite = this.add.image((cx + 0.5) * TILE, (cy + 0.5) * TILE, 'deco_chest_closed').setDepth(3);
          this.tweens.add({ targets: sprite, alpha: { from: 0.88, to: 1.0 }, duration: 900, yoyo: true, repeat: -1 });
          this.chestSprites.push({ sprite, col: cx, row: cy });
          this.floorData.chestPositions.push({ col: cx, row: cy });
          
          this.showCenterText("PUZZLE SOLVED!\nA chest has appeared!");
          this.cameras.main.flash(400, 100, 255, 100, true);
          
          platesForRoom.forEach(p => p.sprite.destroy());
          this.puzzlePlates = this.puzzlePlates.filter(p => p.roomId !== plate.roomId);
          break;
        }
      }
    }
  }

  private updateAurelionTrack(): void {
    if (!this.anomalyState['aurelionSpawned'] || this.anomalyState['aurelionFled']) return;
    
    const sprite = (this as any).aurelionSprite as Phaser.GameObjects.Image | undefined;
    if (!sprite || !sprite.active) return;

    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
    if (d < 56) {
      const count = (this.anomalyState['aurelionTrackCount'] as number) + 1;
      this.anomalyState['aurelionTrackCount'] = count;

      if (count >= 3) {
        this.anomalyState['aurelionFled'] = 1;
        const ax = sprite.x;
        const ay = sprite.y;
        sprite.destroy();
        
        this.showCenterText("AURELION CORNERED!\nDefeat the Radiant Stag.");
        this.cameras.main.flash(600, 255, 220, 100, true);
        this.cameras.main.shake(300, 0.015);
        
        this.spawnAnomalyEnemy('anom_aurelion', 'Aurelion, the Radiant Stag', ax, ay, {
          hp: 2500 + this.floor * 400,
          dmg: this.floor * 15 + 30,
          speed: 65,
          exp: this.floor * 500,
          archetype: 'skirmisher',
          dropItem: 'radiant_ore',
          dropChance: 1.0
        });
        this.game.events.emit('anomaly-whisper', 'Aurelion turns to face you in desperation.');
      } else {
        const ax = sprite.x;
        const ay = sprite.y;
        this.floatText("Aurelion fled!", ax, ay - 20, '#ffff55');
        
        const tele = this.add.circle(ax, ay, 12, 0xffd700, 0.6).setDepth(4);
        this.tweens.add({ targets: tele, scaleX: 3, scaleY: 3, alpha: 0, duration: 400, onComplete: () => tele.destroy() });

        const cells = this.collectFloorCells(this.tiles);
        const colIdx = Math.floor(this.mapCols / 2);
        const rowIdx = Math.floor(this.mapRows / 2);
        let targetCell = cells[Phaser.Math.Between(0, cells.length - 1)];
        
        if (count === 1) {
          const candidates = cells.filter(c => c.col > colIdx && Math.abs(c.col - Math.floor(this.player.x/TILE)) > 12);
          if (candidates.length > 0) targetCell = candidates[Phaser.Math.Between(0, candidates.length - 1)];
        } else {
          const candidates = cells.filter(c => c.row > rowIdx && Math.abs(c.row - Math.floor(this.player.y/TILE)) > 12);
          if (candidates.length > 0) targetCell = candidates[Phaser.Math.Between(0, candidates.length - 1)];
        }

        sprite.setPosition((targetCell.col + 0.5) * TILE, (targetCell.row + 0.5) * TILE);
        this.game.events.emit('anomaly-whisper', `Aurelion flees! Track him down (${count}/3)...`);
      }
    }
  }

  private checkSecretsAndCrackedWalls(): void {
    const save = SaveManager.load();
    if (!save) return;

    const hasDetector = save.inventory.some(i => i.itemId === 'detector_charm');

    for (const wall of this.crackedWalls) {
      const wx = (wall.col + 0.5) * TILE;
      const wy = (wall.row + 0.5) * TILE;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, wx, wy);

      if (hasDetector && d < 64) {
        if (!wall.revealed) {
          wall.revealed = true;
          wall.sprite = this.add.image(wx, wy, 'wall_crack').setDepth(3);
        }
      }

      if (wall.revealed && wall.sprite) {
        wall.sprite.setAlpha(Phaser.Math.Clamp(1.0 - (d - 20) / 44, 0, 1) * 0.9);
      }
    }
  }

  private updateHazardsTick(time: number, delta: number): void {
    const px = this.player.x;
    const py = this.player.y;

    for (let i = this.puffballs.length - 1; i >= 0; i--) {
      const p = this.puffballs[i];
      if (p.triggered) continue;
      if (Phaser.Math.Distance.Between(px, py, p.x, p.y) < 40) {
        p.triggered = true;
        this.tweens.add({
          targets: p.circle,
          fillColor: 0xff0000,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 700,
          onComplete: () => {
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y) < 50 && this.player.active) {
              this.player.takeDamage(12, p.x, p.y, 'poison');
              StatusSystem.applyBuildUp(this.player, 'poison', 40, this);
              this.floatText('PUFFBALL BLAST!', this.player.x, this.player.y - 20, '#55ff55');
            }
            for (let k = 0; k < 6; k++) {
              const cloud = this.add.circle(p.x + Phaser.Math.Between(-15, 15), p.y + Phaser.Math.Between(-15, 15), 8, 0x44aa55, 0.5).setDepth(5);
              this.tweens.add({ targets: cloud, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 600, onComplete: () => cloud.destroy() });
            }
            p.circle.destroy();
            this.puffballs.splice(i, 1);
          }
        });
      }
    }

    const pCol = Math.floor(px / TILE);
    const pRow = Math.floor(py / TILE);
    let onThinIce = false;
    let standingIce: any = null;

    for (const ice of this.thinIceTiles) {
      if (ice.collapsed) continue;
      if (pCol === ice.col && pRow === ice.row) {
        onThinIce = true;
        standingIce = ice;
        break;
      }
    }

    if (onThinIce && standingIce) {
      this.playerOnThinIceTimer += delta;
      standingIce.rect.setAlpha(0.6);
      if (this.playerOnThinIceTimer >= 600) {
        standingIce.collapsed = true;
        standingIce.rect.destroy();
        this.add.rectangle((standingIce.col + 0.5) * TILE, (standingIce.row + 0.5) * TILE, TILE - 2, TILE - 2, 0x0c0818).setDepth(1.1);
        this.floatText('COLLAPSED!', px, py - 20, '#00aaff');
        
        this.player.takeDamage(20, px, py - 1, 'ice');
        this.cameras.main.flash(400, 0, 100, 255, true);
        
        this.warping = true;
        this.time.delayedCall(400, () => {
          this.player.setPosition((this.floorData.spawnCol + 0.5) * TILE, (this.floorData.spawnRow + 0.5) * TILE);
          this.playerOnThinIceTimer = 0;
          this.warping = false;
        });
      }
    } else {
      this.playerOnThinIceTimer = 0;
      for (const ice of this.thinIceTiles) {
        if (!ice.collapsed && ice.rect) ice.rect.setAlpha(0.25);
      }
    }

    if (this.floor === 7) {
      if (time > this.nextBrickSpawnTime) {
        this.nextBrickSpawnTime = time + 3000 + Math.random() * 2000;
        const targetX = px;
        const targetY = py;
        const warning = this.add.circle(targetX, targetY, 20, 0xff0000, 0.22).setDepth(4);
        this.tweens.add({ targets: warning, scaleX: 1.3, scaleY: 1.3, alpha: 0.45, duration: 1000, yoyo: true });
        
        this.fallingBricks.push({
          x: targetX,
          y: targetY,
          timer: 1200,
          warningCircle: warning,
          sprite: null
        });
      }

      for (let i = this.fallingBricks.length - 1; i >= 0; i--) {
        const brick = this.fallingBricks[i];
        brick.timer -= delta;
        
        if (brick.timer <= 0) {
          if (brick.warningCircle) { brick.warningCircle.destroy(); brick.warningCircle = null; }
          
          if (!brick.sprite) {
            const bSprite = this.add.rectangle(brick.x, brick.y - 120, 14, 8, 0x777788).setDepth(8);
            brick.sprite = bSprite;
            this.tweens.add({
              targets: bSprite,
              y: brick.y,
              duration: 250,
              ease: 'Quad.In',
              onComplete: () => {
                const brickD = Phaser.Math.Distance.Between(this.player.x, this.player.y, brick.x, brick.y);
                if (brickD < 22 && this.player.active) {
                  this.player.takeDamage(25, brick.x, brick.y - 1);
                  this.floatText('CRUSHED!', this.player.x, this.player.y - 20, '#ff4444');
                  this.cameras.main.shake(120, 0.012);
                }
                const burst = this.add.circle(brick.x, brick.y, 4, 0x999999, 0.6).setDepth(4);
                this.tweens.add({ targets: burst, scaleX: 4, scaleY: 4, alpha: 0, duration: 250, onComplete: () => burst.destroy() });
                bSprite.destroy();
                this.fallingBricks.splice(i, 1);
              }
            });
          }
        }
      }

      for (const sp of this.gravetideSpawners) {
        if (time > sp.nextSpawnTime) {
          sp.nextSpawnTime = time + 18000 + Math.random() * 5000;
          this.tweens.add({
            targets: sp.sprite,
            strokeColor: 0xff0000,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 800,
            yoyo: true,
            onComplete: () => {
              const spCol = Math.floor(sp.x / TILE);
              const spRow = Math.floor(sp.y / TILE);
              const def = defsForFloor(this.floor).find(d => d.id === 'skeleton' || d.elemFamily === 'undead');
              if (def) {
                this.spawnOneEnemy(def, spCol + Phaser.Math.Between(-1, 1), spRow + Phaser.Math.Between(-1, 1));
                this.floatText('GRAVETIDE RISE!', sp.x, sp.y - 20, '#aa22ff');
              }
            }
          });
        }
      }
    }

    if (this.floor === 8) {
      for (const well of this.gravityWells) {
        const d = Phaser.Math.Distance.Between(px, py, well.x, well.y);
        if (d < well.radius) {
          const angle = Math.atan2(well.y - py, well.x - px);
          const pullForce = 2.0 * (1.0 - d / well.radius);
          const body = this.player.body as Phaser.Physics.Arcade.Body;
          body.velocity.x += Math.cos(angle) * pullForce * 40;
          body.velocity.y += Math.sin(angle) * pullForce * 40;
          
          if (time % 800 < delta) {
            this.floatText('GRAVITY PULL!', px, py - 20, '#bb44ff');
          }
        }
      }

      for (const rift of this.driftingRifts) {
        const rBody = rift.sprite.body as Phaser.Physics.Arcade.Body;
        rBody.setVelocity(rift.vx, rift.vy);

        const rCol = Math.floor(rift.sprite.x / TILE);
        const rRow = Math.floor(rift.sprite.y / TILE);
        if (rCol <= 1 || rCol >= this.mapCols - 2 || this.tiles[rRow][rCol] === T_WALL) {
          rift.vx = -rift.vx;
        }
        if (rRow <= 1 || rRow >= this.mapRows - 2 || this.tiles[rRow][rCol] === T_WALL) {
          rift.vy = -rift.vy;
        }

        const d = Phaser.Math.Distance.Between(px, py, rift.sprite.x, rift.sprite.y);
        if (d < TILE * 0.7) {
          this.player.takeDamage(10, rift.sprite.x, rift.sprite.y, 'void');
          StatusSystem.applyBuildUp(this.player, 'corruption', 15, this);
          this.floatText('RIFT CONTACT!', px, py - 20, '#aa22ff');
          
          const angle = Math.random() * Math.PI * 2;
          rift.vx = Math.cos(angle) * 35;
          rift.vy = Math.sin(angle) * 35;
        }
      }
    }
  }

  private triggerSmokeBombExplosion(): void {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 24;
      const sx = this.player.x + Math.cos(angle) * dist;
      const sy = this.player.y + Math.sin(angle) * dist;
      const circle = this.add.circle(sx, sy, 10 + Math.random() * 8, 0xcccccc, 0.45).setDepth(6);
      this.tweens.add({
        targets: circle,
        scaleX: 1.8,
        scaleY: 1.8,
        alpha: 0,
        duration: 800 + Math.random() * 400,
        onComplete: () => circle.destroy()
      });
    }

    AudioManager.playSFX('perfect_dodge');
    const allEnemies = this.enemies.getChildren() as unknown as Enemy[];
    for (const e of allEnemies) {
      if (e.active) {
        (e as any).aiState = 'idle';
        (e as any).alertTimer = 0;
        (e as any).setVelocity(0, 0);
      }
    }
  }

  private triggerBarrelExplosion(): void {
    const px = this.player.x;
    const py = this.player.y;
    const blast = this.add.circle(px, py, 64, 0xff5500, 0.45).setDepth(6);
    this.tweens.add({ targets: blast, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 400, onComplete: () => blast.destroy() });
    this.cameras.main.shake(200, 0.015);
    AudioManager.playSFX('anomaly_sting');

    for (const child of this.enemies.getChildren()) {
      const e = child as unknown as Enemy;
      if (e.active && Phaser.Math.Distance.Between(px, py, e.x, e.y) < 80) {
        e.takeDamage(30, px, py, 0);
      }
    }

    for (let i = this.crackedWalls.length - 1; i >= 0; i--) {
      const wall = this.crackedWalls[i];
      const wx = (wall.col + 0.5) * TILE;
      const wy = (wall.row + 0.5) * TILE;
      if (Phaser.Math.Distance.Between(px, py, wx, wy) < 64) {
        this.tiles[wall.row][wall.col] = 1;
        this.mapLayer.putTileAt(1, wall.col, wall.row);
        if (wall.sprite) wall.sprite.destroy();
        
        const chest = this.add.image(wx, wy, 'deco_chest_closed').setDepth(3);
        this.tweens.add({ targets: chest, alpha: { from: 0.88, to: 1.0 }, duration: 900, yoyo: true, repeat: -1 });
        this.chestSprites.push({ sprite: chest, col: wall.col, row: wall.row });
        this.floorData.chestPositions.push({ col: wall.col, row: wall.row });
        
        this.floatText('SECRET REVEALED!', wx, wy - 20, '#ffaa00');
        this.crackedWalls.splice(i, 1);
      }
    }
  }

  private triggerSonicExplosion(): void {
    const px = this.player.x;
    const py = this.player.y;
    const blast = this.add.circle(px, py, 96, 0x88ccff, 0.3).setDepth(6);
    this.tweens.add({ targets: blast, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 500, onComplete: () => blast.destroy() });
    AudioManager.playSFX('perfect_dodge');

    for (const child of this.enemies.getChildren()) {
      const e = child as unknown as Enemy;
      if (e.active && Phaser.Math.Distance.Between(px, py, e.x, e.y) < 96) {
        if ((e as any).lurking) {
          (e as any).lurking = false;
          (e as any).aiState = 'chase';
          this.floatText('REVEALED!', e.x, e.y - 20, '#88ccff');
        }
      }
    }

    for (const wall of this.crackedWalls) {
      const wx = (wall.col + 0.5) * TILE;
      const wy = (wall.row + 0.5) * TILE;
      if (Phaser.Math.Distance.Between(px, py, wx, wy) < 48) {
        if (!wall.revealed) {
          wall.revealed = true;
          wall.sprite = this.add.image(wx, wy, 'wall_crack').setDepth(3);
          this.floatText('Wall crack spotted!', wx, wy - 20, '#ffaa00');
        }
      }
    }
  }

  private interactRoomShrine(
    prop: { sprite: Phaser.GameObjects.Image; col: number; row: number; interacted: boolean },
    px: number, py: number
  ): void {
    if (prop.interacted) return;
    const sw = this.scale.width, sh = this.scale.height;
    const bg = this.add.rectangle(sw / 2, sh * 0.65, 240, 80, 0x110022, 0.95)
      .setScrollFactor(0).setDepth(40).setStrokeStyle(1.5, 0x0088ff);
    const txt = this.add.text(sw / 2, sh * 0.65, 
      `ANCIENT SHRINE\n[1] Blessing (+5 all stats)\n[2] Dark Curse (+15 STR/VIT, but get Cursed)\n[ESC] Leave`,
      { fontSize: '8px', color: '#aaddff', align: 'center', lineSpacing: 3 }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(41);

    const close = () => { bg.destroy(); txt.destroy(); this.input.keyboard!.off('keydown', handler); };
    const handler = (e: KeyboardEvent) => {
      const save = SaveManager.load();
      if (!save) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === '1') {
        const stats = ['str', 'dex', 'int', 'vit', 'agi'] as const;
        for (const s of stats) save.stats[s] = (save.stats[s] ?? 0) + 5;
        this.floatText('Blessing active! +5 all stats!', this.player.x, this.player.y - 20, '#55ff55');
        SaveManager.write(save);
        prop.interacted = true;
        close();
      } else if (e.key === '2') {
        save.stats.str = (save.stats.str ?? 0) + 15;
        save.stats.vit = (save.stats.vit ?? 0) + 15;
        save.curseActive = true;
        this.player.takeDamage(Math.round(this.player.maxHp * 0.25), px, py - 1);
        this.floatText('CURSED BARGAIN! +15 STR/VIT', this.player.x, this.player.y - 20, '#ff33ff');
        SaveManager.write(save);
        prop.interacted = true;
        close();
      }
    };
    this.input.keyboard!.on('keydown', handler);
  }

  private interactRoomLibrary(
    prop: { sprite: Phaser.GameObjects.Image; col: number; row: number; interacted: boolean },
    px: number, py: number
  ): void {
    if (prop.interacted) return;
    prop.interacted = true;
    const meta = SaveManager.loadAccountMeta();
    const undiscovered = DungeonScene.LORE_POOL.filter(clue => !meta.discoveredClues?.includes(clue));
    const clueToUnlock = undiscovered.length > 0 ? undiscovered[0] : DungeonScene.LORE_POOL[Math.floor(Math.random() * DungeonScene.LORE_POOL.length)];
    
    if (meta.discoveredClues && !meta.discoveredClues.includes(clueToUnlock)) {
      meta.discoveredClues.push(clueToUnlock);
      SaveManager.writeAccountMeta(meta);
    }
    
    this.showCenterText(`LORE PAGE FOUND\n\n"${clueToUnlock}"`);
    this.floatText('Lore Page Read!', px, py - 20, '#eeddcc');
    AudioManager.playSFX('anomaly_sting');
    
    const pageImg = this.add.image(px, py - TILE, 'anom_page').setDepth(4).setScale(2);
    this.tweens.add({
      targets: pageImg,
      y: py - TILE * 2,
      alpha: 0,
      duration: 2000,
      onComplete: () => pageImg.destroy()
    });
  }

  private interactRoomMerchant(
    prop: { sprite: Phaser.GameObjects.Image; col: number; row: number; interacted: boolean },
    px: number, py: number
  ): void {
    if (prop.interacted) return;
    const pool = ['health_potion', 'mana_potion', 'smoke_bomb', 'whetstone', 'camp_kit', 'lockpick'];
    const rare = ['dragon_scale', 'mana_stone_3', 'mana_stone_4', 'friends_token'];
    
    const stock = [
      { itemId: pool[Phaser.Math.Between(0, pool.length - 1)], gold: 40 + this.floor * 10 },
      { itemId: pool[Phaser.Math.Between(0, pool.length - 1)], gold: 40 + this.floor * 10 },
      { itemId: rare[Phaser.Math.Between(0, rare.length - 1)], gold: 100 + this.floor * 25 }
    ];
    this.showMerchantPanel(stock, prop);
  }

  private toggleRemapPanel(): void {
    this.remappingActive = !this.remappingActive;
    if (this.remappingActive) {
      const sw = this.scale.width, sh = this.scale.height;
      this.remapPanelBg = this.add.rectangle(sw / 2, sh / 2, 280, 200, 0x0a0510, 0.95)
        .setStrokeStyle(1.5, 0xaa44ff).setDepth(100).setScrollFactor(0);
      
      this.remapPanelText = this.add.text(sw / 2, sh / 2, '', {
        fontSize: '9px', color: '#eeddff', align: 'center', lineSpacing: 4
      }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
      
      this.updateRemapPanelText();
    } else {
      if (this.remapPanelBg) { this.remapPanelBg.destroy(); this.remapPanelBg = null; }
      if (this.remapPanelText) { this.remapPanelText.destroy(); this.remapPanelText = null; }
      this.remappingKeyIndex = -1;
    }
  }

  private updateRemapPanelText(): void {
    if (!this.remapPanelText) return;
    if (this.remappingKeyIndex !== -1) {
      const item = this.keyRemapBindings[this.remappingKeyIndex];
      this.remapPanelText.setText(
        `REMAP KEY\n\nPress any key to bind to:\n[ ${item.label.toUpperCase()} ]\n\nPress ESC to cancel.`
      );
      return;
    }

    let list = "KEY REMAPPING MODE\n\nPress [1-9] to select key to remap:\n";
    this.keyRemapBindings.forEach((item, idx) => {
      const currentKey = Phaser.Input.Keyboard.KeyCodes[item.keyCode] || String.fromCharCode(item.keyCode);
      list += `[${idx + 1}] ${item.label}: ${currentKey}\n`;
    });
    list += "\nPress [K] to Save & Exit";
    this.remapPanelText.setText(list);
  }

  private handleRemappingInput(): void {
    const keys = this.input.keyboard!;
    if (this.remappingKeyIndex !== -1) {
      const escKey = keys.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      if (Phaser.Input.Keyboard.JustDown(escKey)) {
        this.remappingKeyIndex = -1;
        this.updateRemapPanelText();
        return;
      }

      for (const [keyStr, code] of Object.entries(Phaser.Input.Keyboard.KeyCodes)) {
        const k = keys.addKey(code);
        if (Phaser.Input.Keyboard.JustDown(k)) {
          const item = this.keyRemapBindings[this.remappingKeyIndex];
          item.keyCode = code;
          if (item.targetObj === 'player') {
            (this.player as any)[item.keyName] = keys.addKey(code);
          } else if (item.targetObj === 'scene') {
            (this as any)[item.keyName] = keys.addKey(code);
          } else if (item.targetObj === 'skillKeys') {
            (this.skillKeys as any)[item.keyName] = keys.addKey(code);
          }

          this.floatText(`Bound ${item.label} to ${keyStr}`, this.player.x, this.player.y - 20, '#cc88ff');
          this.remappingKeyIndex = -1;
          this.updateRemapPanelText();
          break;
        }
      }
      return;
    }

    const numberKeys = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
      Phaser.Input.Keyboard.KeyCodes.SEVEN,
      Phaser.Input.Keyboard.KeyCodes.EIGHT,
      Phaser.Input.Keyboard.KeyCodes.NINE,
    ];

    for (let i = 0; i < numberKeys.length; i++) {
      const nk = keys.addKey(numberKeys[i]);
      if (Phaser.Input.Keyboard.JustDown(nk)) {
        if (i < this.keyRemapBindings.length) {
          this.remappingKeyIndex = i;
          this.updateRemapPanelText();
        }
        break;
      }
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
    // §E15 — no special element; physType from weapon drives PHYS_CHART instead
    return 'none';
  }

  private applyAttackAilment(
    target: Enemy | Player,
    el: Element,
    physType?: import('../types').PhysType,
  ): void {
    const poisonBonus = (this.player && this.player.active && this.player.hasSetBonus('brood', 4)) ? 10 : 0;
    const enemyFamily = target instanceof Enemy ? (target.def.elemFamily ?? '') : '';

    // Physical ailments — driven by physType
    if (physType === 'slash') {
      // Skip if undead/construct/spectral (no blood)
      if (!['undead', 'construct', 'spectral'].includes(enemyFamily)) {
        StatusSystem.applyBuildUp(target, 'bleed', 25, this, this.player);
      }
    } else if (physType === 'blunt') {
      const koAmt = this.player.isBlunt ? 37 : 25; // mace family bonus
      StatusSystem.applyBuildUp(target, 'ko', koAmt, this, this.player);
    } else if (physType === 'pierce') {
      // Skip if gelatinous (no solid tissue to wound)
      const bodyType = target instanceof Enemy ? (target.def.body ?? '') : '';
      if (bodyType !== 'gelatinous') {
        StatusSystem.applyBuildUp(target, 'wound', 25, this, this.player);
      }
    }

    // Elemental ailments
    if (el === 'fire') {
      const burnAmt = enemyFamily === 'plant' ? 38 : 25;
      StatusSystem.applyBuildUp(target, 'burn', burnAmt, this, this.player);
    } else if (el === 'ice') {
      StatusSystem.applyBuildUp(target, 'frostbite', 25, this, this.player);
    } else if (el === 'lightning') {
      const shockAmt = (target.activeAilments.get('wet') ?? 0) > 0 ? 50 : 25;
      StatusSystem.applyBuildUp(target, 'shock', shockAmt, this, this.player);
    } else if (el === 'poison') {
      const poisonAmt = enemyFamily === 'beast' ? Math.round(25 * 1.25) : 25;
      StatusSystem.applyBuildUp(target, 'poison', poisonAmt + poisonBonus, this, this.player);
    } else if (el === 'void') {
      StatusSystem.applyBuildUp(target, 'corruption', 25, this, this.player);
    } else if (el === 'radiant') {
      StatusSystem.applyBuildUp(target, 'sear', 25, this, this.player);
    }

    if (poisonBonus > 0 && el !== 'poison') {
      StatusSystem.applyBuildUp(target, 'poison', poisonBonus, this, this.player);
    }
  }

  // ── §22 Companion textures & spawn ────────────────────────────────────────────

  private buildCompanionTextures(): void {
    for (const def of COMPANION_DEFS) {
      const key = `companion_${def.id}`;
      if (this.textures.exists(key)) continue;
      const t = this.textures.createCanvas(key, 32, 48);
      if (!t) continue;
      const ctx = t.getCanvas().getContext('2d')!;
      ctx.fillStyle = '#' + def.bodyColor.toString(16).padStart(6, '0');
      ctx.fillRect(8, 8, 16, 34);
      ctx.fillStyle = '#' + Math.min(0xffffff, def.bodyColor + 0x222222).toString(16).padStart(6, '0');
      ctx.fillRect(10, 10, 12, 30);
      ctx.fillStyle = '#' + def.eyeColor.toString(16).padStart(6, '0');
      ctx.fillRect(11, 14, 3, 2);
      ctx.fillRect(18, 14, 3, 2);
      t.refresh();
    }
  }

  private spawnCompanions(save: CharacterSave): void {
    if (!save.companions || save.companions.length === 0) return;
    for (const cSave of save.companions) {
      const def = defById(cSave.id);
      if (!def) continue;
      const ox = Phaser.Math.Between(-36, 36);
      const oy = Phaser.Math.Between(-36, 36);
      const comp = new Companion(
        this, this.player.x + ox, this.player.y + oy,
        def, cSave.currentHp, cSave.potions, cSave.fatigue, cSave.affinity, cSave.command,
      );
      this.physics.add.collider(comp as unknown as Phaser.GameObjects.GameObject, this.mapLayer);
      this.companions.push(comp);
    }
    if (this.companions.length > 0) {
      this.game.events.emit('companion-hud-update', this.companions.map(c => c.toSaveData()));
    }
  }

  // ── §21 Camp sites ────────────────────────────────────────────────────────────

  private placeCampSites(): void {
    if (!this.textures.exists('camp_icon')) {
      const t = this.textures.createCanvas('camp_icon', 20, 20);
      if (t) {
        const ctx = t.getCanvas().getContext('2d')!;
        ctx.fillStyle = '#6b3d1e'; ctx.fillRect(5, 12, 10, 5);
        ctx.fillStyle = '#cc5500'; ctx.fillRect(7, 6, 6, 9);
        ctx.fillStyle = '#ffcc00'; ctx.fillRect(8, 3, 4, 6);
        ctx.fillStyle = '#ffeeaa'; ctx.fillRect(9, 2, 2, 4);
        t.refresh();
      }
    }
    for (const cp of this.floorData.campPositions) {
      const x = (cp.col + 0.5) * TILE;
      const y = (cp.row + 0.5) * TILE;
      const sprite = this.add.image(x, y, 'camp_icon').setDepth(3).setScale(2);
      this.tweens.add({ targets: sprite, alpha: { from: 0.72, to: 1.0 }, duration: 850, yoyo: true, repeat: -1 });
      this.campSites.push({ sprite, col: cp.col, row: cp.row });
    }
  }

  private checkCampChannel(delta: number): void {
    const CAMP_RADIUS = TILE * 1.8;
    const CAMP_CHANNEL_MS = 3000;
    const ENEMY_INTERRUPT_DIST = TILE * 5;
    const eKey = this.player.interactKey;

    // Find nearest campsite within activation radius
    let nearestCamp: { sprite: Phaser.GameObjects.Image; col: number; row: number } | null = null;
    let nearestDist = CAMP_RADIUS;
    for (const cs of this.campSites) {
      const cx = (cs.col + 0.5) * TILE, cy = (cs.row + 0.5) * TILE;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy);
      if (d < nearestDist) { nearestDist = d; nearestCamp = cs; }
    }

    if (!nearestCamp || !eKey.isDown) {
      // Cancel channel if active
      if (this.campChannelMs > 0) {
        this.campChannelMs = 0;
        this.campChannelTarget = null;
        if (this.campChannelBar) { this.campChannelBar.destroy(); this.campChannelBar = null; }
      }
      if (nearestCamp && !eKey.isDown) {
        this.floatText('Hold E to set up camp', (nearestCamp.col + 0.5) * TILE, (nearestCamp.row + 0.5) * TILE - 20, '#88cc66');
      }
      return;
    }

    // Check for Camp Kit
    const save = SaveManager.load();
    if (!save) return;
    if (!save.inventory.some(s => s.itemId === 'camp_kit' && s.qty > 0)) {
      if (this.campChannelMs === 0) {
        this.floatText('Need Camp Kit!', this.player.x, this.player.y - 24, '#ff8888');
      }
      return;
    }

    // Enemy proximity interrupts
    const enemyNear = (this.enemies.getChildren() as unknown as Enemy[]).some(e =>
      e.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < ENEMY_INTERRUPT_DIST,
    );
    if (enemyNear) {
      if (this.campChannelMs > 0) {
        this.campChannelMs = 0;
        this.campChannelTarget = null;
        if (this.campChannelBar) { this.campChannelBar.destroy(); this.campChannelBar = null; }
        this.floatText('INTERRUPTED!', this.player.x, this.player.y - 24, '#ff4444');
      }
      return;
    }

    this.campChannelTarget = { col: nearestCamp.col, row: nearestCamp.row };
    this.campChannelMs += delta;

    // Progress bar above player
    if (!this.campChannelBar) {
      this.campChannelBar = this.add.rectangle(this.player.x, this.player.y - 32, 1, 4, 0x66cc44).setDepth(8);
    }
    const pct = Math.min(1, this.campChannelMs / CAMP_CHANNEL_MS);
    this.campChannelBar.setDisplaySize(40 * pct, 4).setPosition(this.player.x, this.player.y - 32);

    if (this.campChannelMs >= CAMP_CHANNEL_MS) {
      // Channel complete — consume kit, open panel
      this.campChannelMs = 0;
      this.campChannelTarget = null;
      if (this.campChannelBar) { this.campChannelBar.destroy(); this.campChannelBar = null; }

      const kitIdx = save.inventory.findIndex(s => s.itemId === 'camp_kit' && s.qty > 0);
      if (kitIdx !== -1) {
        save.inventory[kitIdx].qty--;
        if (save.inventory[kitIdx].qty <= 0) save.inventory.splice(kitIdx, 1);
        SaveManager.write(save);
        this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(save.inventory));
      }

      this.openCampPanel();
    }
  }

  private openCampPanel(): void {
    this.campPanelOpen = true;
    const sw = this.scale.width, sh = this.scale.height;

    const buildPanel = (section: 'main' | 'cook' | 'craft' | 'loadout', loadoutPage = 0): void => {
      if (this.consolidatedPanel) { this.consolidatedPanel.destroy(); this.consolidatedPanel = null; }

      const container = this.add.container(sw / 2, sh / 2).setDepth(40).setScrollFactor(0);
      this.consolidatedPanel = container;

      container.add(this.add.rectangle(0, 0, 290, 230, 0x090f08, 0.97).setStrokeStyle(1.5, 0x44bb66));
      container.add(this.add.text(0, -100, '⛺ CAMP', { fontSize: '11px', color: '#88ffaa' }).setOrigin(0.5));

      const closePanel = () => {
        container.destroy();
        this.consolidatedPanel = null;
        this.campPanelOpen = false;
      };

      const closeBtn = this.add.text(130, -100, '✕', { fontSize: '10px', color: '#ff6666' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      closeBtn.on('pointerdown', closePanel);
      container.add(closeBtn);

      if (section === 'main') {
        const save = SaveManager.load();
        const hpPct  = save ? Math.round(this.player.maxHp   * 0.60) : 0;
        const mpPct  = save ? Math.round(this.player.maxMp   * 0.50) : 0;

        const restBtn = this.add.text(0, -62,
          `[R] REST  (+${hpPct} HP, +${mpPct} MP)`, {
            fontSize: '9px', color: '#aaffaa', backgroundColor: '#1a3320', padding: { x: 10, y: 5 },
          }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        restBtn.on('pointerdown', () => { this.doCampRest(); closePanel(); });
        container.add(restBtn);

        const cookBtn = this.add.text(0, -24,
          '[C] COOK  (Ration + Material)', {
            fontSize: '9px', color: '#ffddaa', backgroundColor: '#332200', padding: { x: 10, y: 5 },
          }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        cookBtn.on('pointerdown', () => { container.destroy(); this.consolidatedPanel = null; buildPanel('cook'); });
        container.add(cookBtn);

        const craftBtn = this.add.text(0, 14,
          '[F] CRAFT  (Potions, Arrows, Whetstones)', {
            fontSize: '9px', color: '#aaddff', backgroundColor: '#001833', padding: { x: 10, y: 5 },
          }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        craftBtn.on('pointerdown', () => { container.destroy(); this.consolidatedPanel = null; buildPanel('craft'); });
        container.add(craftBtn);

        const loadoutBtn = this.add.text(0, 52,
          '[L] LOADOUT  (manage & drop items)', {
            fontSize: '9px', color: '#ddffbb', backgroundColor: '#162200', padding: { x: 10, y: 5 },
          }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        loadoutBtn.on('pointerdown', () => { container.destroy(); this.consolidatedPanel = null; buildPanel('loadout'); });
        container.add(loadoutBtn);

        // Share potions with companions at camp
        if (this.companions.length > 0) {
          const shareBtn = this.add.text(0, 82,
            '[S] SHARE POTIONS  (give 1 potion each)', {
              fontSize: '8px', color: '#ffbbff', backgroundColor: '#22002d', padding: { x: 8, y: 4 },
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
          shareBtn.on('pointerdown', () => {
            const s = SaveManager.load();
            if (!s) return;
            for (const comp of this.companions) {
              const idx = s.inventory.findIndex(x => x.itemId === 'health_potion' && x.qty > 0);
              if (idx !== -1) {
                s.inventory[idx].qty--;
                if (s.inventory[idx].qty <= 0) s.inventory.splice(idx, 1);
                comp.potions++;
                this.floatText(`${comp.def.name} +1 potion`, comp.x, comp.y - 20, '#ffbbff');
              }
            }
            SaveManager.write(s);
            this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(s.inventory));
            closePanel();
          });
          container.add(shareBtn);

          const compInfo = this.companions.map(c =>
            `${c.def.name}  HP:${Math.round(c.currentHp)}/${c.maxCompHp}  Fatigue:${Math.round(c.fatigue)}%`,
          ).join('\n');
          container.add(this.add.text(0, 108, compInfo, { fontSize: '6.5px', color: '#aaffaa', align: 'center' }).setOrigin(0.5));
        }

        const handler = (e: KeyboardEvent) => {
          const k = e.key.toLowerCase();
          if      (k === 'r')      { this.doCampRest(); closePanel(); }
          else if (k === 'c')      { container.destroy(); this.consolidatedPanel = null; buildPanel('cook'); }
          else if (k === 'f')      { container.destroy(); this.consolidatedPanel = null; buildPanel('craft'); }
          else if (k === 'l')      { container.destroy(); this.consolidatedPanel = null; buildPanel('loadout'); }
          else if (k === 's' && this.companions.length > 0) {
            const s = SaveManager.load();
            if (s) {
              for (const comp of this.companions) {
                const idx = s.inventory.findIndex(x => x.itemId === 'health_potion' && x.qty > 0);
                if (idx !== -1) { s.inventory[idx].qty--; if (s.inventory[idx].qty <= 0) s.inventory.splice(idx, 1); comp.potions++; }
              }
              SaveManager.write(s);
              this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(s.inventory));
            }
            closePanel();
          }
          else if (k === 'escape') { closePanel(); }
          window.removeEventListener('keydown', handler);
        };
        window.addEventListener('keydown', handler);
        container.once('destroy', () => window.removeEventListener('keydown', handler));

      } else if (section === 'cook') {
        this.buildCookSection(container, () => { container.destroy(); this.consolidatedPanel = null; buildPanel('main'); }, closePanel);
      } else if (section === 'craft') {
        this.buildCraftSection(container, () => { container.destroy(); this.consolidatedPanel = null; buildPanel('main'); }, closePanel);
      } else if (section === 'loadout') {
        this.buildLoadoutSection(
          container,
          () => { container.destroy(); this.consolidatedPanel = null; buildPanel('main'); },
          closePanel,
          loadoutPage,
          (pg) => { container.destroy(); this.consolidatedPanel = null; buildPanel('loadout', pg); },
        );
      }
    };

    buildPanel('main');
  }

  private doCampRest(): void {
    const hpRestore = Math.round(this.player.maxHp * 0.60);
    const mpRestore = Math.round(this.player.maxMp * 0.50);
    this.player.heal(hpRestore);
    this.player.restoreMp(mpRestore);

    // Reduce companion fatigue by 60%
    for (const comp of this.companions) {
      comp.fatigue = Math.max(0, comp.fatigue - 60);
    }

    // Ambush roll: 15% + 5% per floor, −10% per companion (min 0%)
    const baseChance = 0.15 + this.floor * 0.05;
    const watchReduction = Math.min(this.companions.length * 0.10, 0.20);
    const ambushChance = Math.max(0, baseChance - watchReduction);

    if (Math.random() < ambushChance) {
      const pool  = defsForFloor(this.floor);
      const cells = this.collectFloorCells(this.tiles).filter(c =>
        Phaser.Math.Distance.Between(c.col * TILE, c.row * TILE, this.player.x, this.player.y) > TILE * 3 &&
        Phaser.Math.Distance.Between(c.col * TILE, c.row * TILE, this.player.x, this.player.y) < TILE * 8,
      );
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count && cells.length > 0 && pool.length > 0; i++) {
        const cell = cells[Phaser.Math.Between(0, cells.length - 1)];
        const def  = pool[Phaser.Math.Between(0, pool.length - 1)];
        this.spawnOneEnemy(def, cell.col, cell.row, true);
      }
      this.showCenterText('AMBUSH!\nEnemies attack while you rest!');
      this.cameras.main.shake(300, 0.018);
      this.cameras.main.flash(200, 120, 30, 30, true);
      this.floatText('AMBUSHED!', this.player.x, this.player.y - 28, '#ff4444');
    } else {
      this.showCenterText('You rest and recover.\nThe dungeon falls silent...');
      this.cameras.main.flash(180, 0, 30, 15, true);
      this.floatText(`+${hpRestore} HP, +${mpRestore} MP`, this.player.x, this.player.y - 24, '#88ff88');
    }

    const save = SaveManager.load();
    if (save) {
      save.currentHp  = this.player.currentHp;
      save.currentMp  = this.player.currentMp;
      save.companions = this.companions.map(c => c.toSaveData());
      SaveManager.write(save);
    }
    this.game.events.emit('hud-update', this.player);
    this.game.events.emit('companion-hud-update', this.companions.map(c => c.toSaveData()));
  }

  private buildCookSection(
    container: Phaser.GameObjects.Container,
    onBack: () => void,
    onClose: () => void,
  ): void {
    container.add(this.add.text(0, -80, 'COOKING', { fontSize: '10px', color: '#ffddaa' }).setOrigin(0.5));
    container.add(this.add.text(0, -64, '1x Ration + material below', { fontSize: '6px', color: '#887755' }).setOrigin(0.5));

    const save = SaveManager.load();
    if (!save) return;
    const qty = (id: string) => save.inventory.find(s => s.itemId === id)?.qty ?? 0;
    const hasRation = qty('ration') > 0;

    type MealRecipe = { id: string; mat: string; matQty: number; matLabel: string; label: string };
    const meals: MealRecipe[] = [
      { id: 'hearty_stew',    mat: 'dried_herb',  matQty: 1, matLabel: 'Dried Herb',   label: 'Hearty Stew\n+60 HP regen 5 min' },
      { id: 'spiced_skewers', mat: 'feather',     matQty: 1, matLabel: 'Feather',       label: 'Spiced Skewers\n+15% STR 5 min' },
      { id: 'iron_porridge',  mat: 'iron_ore',    matQty: 1, matLabel: 'Iron Ore',      label: 'Iron Porridge\n+10% VIT 5 min' },
      { id: 'hunters_tea',    mat: 'arrow_shaft', matQty: 1, matLabel: 'Arrow Shaft',   label: "Hunter's Tea\n+10% AGI 5 min" },
      { id: 'mages_broth',    mat: 'vial',        matQty: 1, matLabel: 'Vial',          label: "Mage's Broth\n+15% INT 5 min" },
      { id: 'trailmix',       mat: 'dried_herb',  matQty: 2, matLabel: '2x Dried Herb', label: 'Trail Mix\n+10% DEX 5 min' },
    ];

    meals.forEach((m, i) => {
      const canCook = hasRation && qty(m.mat) >= m.matQty;
      const col = i % 3, row = Math.floor(i / 3);
      const x = -86 + col * 92, y = -42 + row * 58;

      const btn = this.add.text(x, y, m.label, {
        fontSize: '6px', color: canCook ? '#ffddaa' : '#554433',
        backgroundColor: canCook ? '#2a1900' : '#0d0a07',
        padding: { x: 6, y: 4 }, align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: canCook });

      const sub = this.add.text(x, y + 22, `${m.matLabel}`, {
        fontSize: '5px', color: canCook ? '#887755' : '#443322',
      }).setOrigin(0.5);

      if (canCook) {
        btn.on('pointerdown', () => {
          const s = SaveManager.load(); if (!s) return;
          const ri = s.inventory.findIndex(x => x.itemId === 'ration');
          if (ri !== -1) { s.inventory[ri].qty--; if (s.inventory[ri].qty <= 0) s.inventory.splice(ri, 1); }
          const mi = s.inventory.findIndex(x => x.itemId === m.mat);
          if (mi !== -1) { s.inventory[mi].qty -= m.matQty; if (s.inventory[mi].qty <= 0) s.inventory.splice(mi, 1); }
          addToInventory(s.inventory, m.id, 1);
          SaveManager.write(s);
          this.floatText(`Cooked: ${ITEMS[m.id]?.name ?? m.id}!`, this.player.x, this.player.y - 24, '#ffddaa');
          this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(s.inventory));
          onClose();
        });
      }
      container.add([btn, sub]);
    });

    const backBtn = this.add.text(0, 92, '← Back', {
      fontSize: '8px', color: '#888888', backgroundColor: '#111111', padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', onBack);
    container.add(backBtn);
  }

  private buildCraftSection(
    container: Phaser.GameObjects.Container,
    onBack: () => void,
    onClose: () => void,
  ): void {
    container.add(this.add.text(0, -80, 'CAMP CRAFTING', { fontSize: '10px', color: '#aaddff' }).setOrigin(0.5));

    const save = SaveManager.load();
    if (!save) return;
    const qty = (id: string) => save.inventory.find(s => s.itemId === id)?.qty ?? 0;

    type CraftRecipe = { label: string; mats: [string, number][]; result: string; resultQty: number };
    const recipes: CraftRecipe[] = [
      { label: '2× Dried Herb → 1× Health Potion', mats: [['dried_herb', 2]],                     result: 'health_potion', resultQty: 1 },
      { label: 'Arrow Shaft + Feather → 5× Arrow',  mats: [['arrow_shaft', 1], ['feather', 1]],    result: 'arrow',         resultQty: 5 },
      { label: '2× Iron Ore → 1× Whetstone',        mats: [['iron_ore', 2]],                       result: 'whetstone',     resultQty: 1 },
      { label: '1× Vial + 1× Dried Herb → 1× MP Potion', mats: [['vial', 1], ['dried_herb', 1]], result: 'mana_potion',   resultQty: 1 },
    ];

    recipes.forEach((rec, i) => {
      const canCraft = rec.mats.every(([id, n]) => qty(id) >= n);
      const btn = this.add.text(0, -44 + i * 34, rec.label, {
        fontSize: '7px', color: canCraft ? '#aaddff' : '#334455',
        backgroundColor: canCraft ? '#001833' : '#080d12',
        padding: { x: 9, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: canCraft });

      if (canCraft) {
        btn.on('pointerdown', () => {
          const s = SaveManager.load(); if (!s) return;
          for (const [id, n] of rec.mats) {
            const idx = s.inventory.findIndex(x => x.itemId === id);
            if (idx !== -1) { s.inventory[idx].qty -= n; if (s.inventory[idx].qty <= 0) s.inventory.splice(idx, 1); }
          }
          addToInventory(s.inventory, rec.result, rec.resultQty);
          SaveManager.write(s);
          const name = ITEMS[rec.result]?.name ?? rec.result;
          this.floatText(`Crafted: ${rec.resultQty}× ${name}`, this.player.x, this.player.y - 24, '#aaddff');
          this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(s.inventory));
          onClose();
        });
      }
      container.add(btn);
    });

    const backBtn = this.add.text(0, 92, '← Back', {
      fontSize: '8px', color: '#888888', backgroundColor: '#111111', padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', onBack);
    container.add(backBtn);
  }

  // §21.4 — Loadout stash swap at camp
  private buildLoadoutSection(
    container: Phaser.GameObjects.Container,
    onBack: () => void,
    _onClose: () => void,
    page: number,
    onPage: (page: number) => void,
  ): void {
    container.add(this.add.text(0, -85, 'LOADOUT', { fontSize: '10px', color: '#ddffbb' }).setOrigin(0.5));
    container.add(this.add.text(0, -73, 'Click item to toggle junk  •  [D] drop all junk', {
      fontSize: '5.5px', color: '#556633',
    }).setOrigin(0.5));

    const save = SaveManager.load();
    if (!save) return;

    const ITEMS_PER_PAGE = 7;
    const inv = save.inventory;
    const totalPages = Math.max(1, Math.ceil(inv.length / ITEMS_PER_PAGE));
    const safePage   = Math.min(page, totalPages - 1);
    const start      = safePage * ITEMS_PER_PAGE;
    const slice      = inv.slice(start, start + ITEMS_PER_PAGE);

    const RARITY_COLORS: Record<string, string> = {
      common: '#aaaaaa', uncommon: '#44ff44', rare: '#4488ff',
      epic: '#cc44ff', legendary: '#ffaa00', mythic: '#ff2244',
    };

    slice.forEach((stack, i) => {
      const y = -58 + i * 18;
      const def = ITEMS[stack.itemId];
      const name = (def?.name ?? stack.itemId).substring(0, 20);
      const isJunk = stack.isJunk ?? false;
      const rarityColor = RARITY_COLORS[stack.rarity ?? 'common'] ?? '#aaaaaa';

      // Junk indicator
      const junkLabel = isJunk ? '[JUNK] ' : '       ';
      const row = this.add.text(-125, y,
        `${junkLabel}${name}`, {
          fontSize: '7px',
          color: isJunk ? '#ff6644' : '#ccddcc',
        }).setInteractive({ useHandCursor: true });
      row.on('pointerdown', () => {
        const s = SaveManager.load();
        if (!s) return;
        const idx = start + i;
        if (s.inventory[idx]) {
          s.inventory[idx].isJunk = !(s.inventory[idx].isJunk ?? false);
          SaveManager.write(s);
        }
        onPage(safePage);
      });
      container.add(row);

      // Rarity + qty on the right
      const rarityText = this.add.text(112, y,
        `${(stack.rarity ?? 'common').substring(0, 3).toUpperCase()} ×${stack.qty}`, {
          fontSize: '6px', color: rarityColor, align: 'right',
        }).setOrigin(1, 0);
      container.add(rarityText);
    });

    if (inv.length === 0) {
      container.add(this.add.text(0, -20, 'Inventory is empty.', { fontSize: '8px', color: '#556655' }).setOrigin(0.5));
    }

    // Pagination
    if (totalPages > 1) {
      const pageText = this.add.text(0, 70, `Page ${safePage + 1} / ${totalPages}`, {
        fontSize: '7px', color: '#666666',
      }).setOrigin(0.5);
      container.add(pageText);

      if (safePage > 0) {
        const prevBtn = this.add.text(-50, 70, '◀', { fontSize: '9px', color: '#888888' })
          .setOrigin(0.5).setInteractive({ useHandCursor: true });
        prevBtn.on('pointerdown', () => onPage(safePage - 1));
        container.add(prevBtn);
      }
      if (safePage < totalPages - 1) {
        const nextBtn = this.add.text(50, 70, '▶', { fontSize: '9px', color: '#888888' })
          .setOrigin(0.5).setInteractive({ useHandCursor: true });
        nextBtn.on('pointerdown', () => onPage(safePage + 1));
        container.add(nextBtn);
      }
    }

    // Drop all junk button
    const junkCount = inv.filter(s => s.isJunk).length;
    const dropLabel = junkCount > 0 ? `[D] Drop all junk  (${junkCount} items)` : '[D] No junk marked';
    const dropBtn = this.add.text(0, 84, dropLabel, {
      fontSize: '8px',
      color: junkCount > 0 ? '#ff6644' : '#445533',
      backgroundColor: junkCount > 0 ? '#2a0a00' : '#111111',
      padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: junkCount > 0 });
    if (junkCount > 0) {
      dropBtn.on('pointerdown', () => {
        const s = SaveManager.load();
        if (!s) return;
        const kept = s.inventory.filter(x => !x.isJunk);
        const dropped = s.inventory.length - kept.length;
        s.inventory = kept;
        SaveManager.write(s);
        this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(s.inventory));
        this.floatText(`Dropped ${dropped} item(s).`, this.player.x, this.player.y - 28, '#ff6644');
        onPage(0);
      });
    }
    container.add(dropBtn);

    // Back button
    const backBtn = this.add.text(0, 100, '← Back', {
      fontSize: '8px', color: '#888888', backgroundColor: '#111111', padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', onBack);
    container.add(backBtn);

    // Keyboard: D to drop junk, Escape / Backspace to go back
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd' && junkCount > 0) {
        const s = SaveManager.load();
        if (!s) { window.removeEventListener('keydown', handler); return; }
        const dropped = s.inventory.filter(x => x.isJunk).length;
        s.inventory = s.inventory.filter(x => !x.isJunk);
        SaveManager.write(s);
        this.game.events.emit('hotbar-update', this.buildHotbarDataFromInventory(s.inventory));
        this.floatText(`Dropped ${dropped} item(s).`, this.player.x, this.player.y - 28, '#ff6644');
        window.removeEventListener('keydown', handler);
        onPage(0);
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        window.removeEventListener('keydown', handler);
        onBack();
      }
    };
    window.addEventListener('keydown', handler);
    container.once('destroy', () => window.removeEventListener('keydown', handler));
  }
}
