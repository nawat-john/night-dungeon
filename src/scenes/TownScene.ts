import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS, INTERACT_RANGE, calcZoom } from '../config';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';

// ── Tile palette ───────────────────────────────────────────────────────────────
const G = 3;  // ground / dead earth
const W = 2;  // wall / solid stone block
const P = 1;  // stone floor path (cave-floor tile — dark, gritty)
const F = 1;
const I = 7;  // building rooftop (opaque, seen from above)
const V = 6;  // void / absolute darkness

interface Interactable {
  col: number; row: number;
  label: string;
  onInteract: () => void;
  promptSprite?: Phaser.GameObjects.Text;
}

export class TownScene extends Phaser.Scene {
  private player!: Player;
  private interactables: Interactable[] = [];
  private decorGroup!: Phaser.Physics.Arcade.StaticGroup;

  constructor() { super('TownScene'); }

  create(): void {
    const save = SaveManager.load();
    if (!save) { this.scene.start('MainMenuScene'); return; }
    save.location = 'town';
    SaveManager.write(save);

    this.cameras.main.fadeIn(300, 0, 0, 0);

    const mapData = this.buildTownMap();
    const map = this.make.tilemap({ data: mapData, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    if (!tileset) throw new Error('Tileset not found');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Layer failed');
    layer.setCollision([W]);

    // Use saved position when returning from interior scenes or dungeon
    const spawnX = save.position.x > 10 ? save.position.x : 31 * TILE + TILE / 2;
    const spawnY = save.position.y > 10 ? save.position.y : 36 * TILE + TILE / 2;
    this.player = new Player(this, spawnX, spawnY);
    this.player.loadFromSave(save);

    const mapW = MAP_COLS * TILE;
    const mapH = MAP_ROWS * TILE;
    this.physics.world.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setZoom(calcZoom(this.scale.width, this.scale.height));
    this.scale.on('resize', () => {
      this.cameras.main.setZoom(calcZoom(this.scale.width, this.scale.height));
    }, this);

    this.physics.add.collider(this.player as unknown as Phaser.GameObjects.GameObject, layer);

    this.decorGroup = this.physics.add.staticGroup();
    this.addDecorations();
    this.physics.add.collider(
      this.player as unknown as Phaser.GameObjects.GameObject,
      this.decorGroup,
    );

    this.registerInteractables();

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.game.events.emit('hud-update', this.player);
    this.game.events.emit('floor-update', 0);
  }

  update(_time: number, delta: number): void {
    this.player.update(_time, delta);
    const px = this.player.x, py = this.player.y;
    const eJust = Phaser.Input.Keyboard.JustDown(this.player.interactKey);

    for (const ia of this.interactables) {
      const ix = (ia.col + 0.5) * TILE;
      const iy = (ia.row + 0.5) * TILE;
      const dist = Phaser.Math.Distance.Between(px, py, ix, iy);
      if (dist < INTERACT_RANGE) {
        if (!ia.promptSprite) {
          ia.promptSprite = this.add.text(ix, iy - 28, `E: ${ia.label}`, {
            fontSize: '8px', color: '#ffffaa',
          }).setOrigin(0.5).setDepth(10);
        }
        if (eJust) ia.onInteract();
      } else if (ia.promptSprite) {
        ia.promptSprite.destroy();
        ia.promptSprite = undefined;
      }
    }
  }

  // ── Interactables — all shops open their own scenes ──────────────────────────
  private registerInteractables(): void {
    const goScene = (sceneName: string) => {
      const s = SaveManager.load()!;
      s.position = { x: this.player.x, y: this.player.y };
      SaveManager.write(s);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop('UIScene');
        this.scene.start(sceneName);
      });
      this.cameras.main.fadeOut(300, 0, 0, 0);
    };

    // Store entrances — position at door tile (just outside building south wall)
    this.interactables.push({ col: 5,  row: 12, label: 'Enter Armory',       onInteract: () => goScene('ArmoryScene')      });
    this.interactables.push({ col: 30, row: 12, label: 'Enter Inn',           onInteract: () => goScene('InnScene')         });
    this.interactables.push({ col: 57, row: 12, label: 'Enter Emporium',      onInteract: () => goScene('EmporiumScene')    });
    this.interactables.push({ col: 6,  row: 44, label: 'Enter Chapel',        onInteract: () => goScene('ChapelScene')      });
    this.interactables.push({ col: 56, row: 29, label: "Enter Sage's Tower",  onInteract: () => goScene('SagesTowerScene') });

    // Dungeon gate
    this.interactables.push({
      col: 31, row: 41, label: 'Enter Dungeon',
      onInteract: () => {
        const s = SaveManager.load()!;
        s.location     = 'dungeon';
        s.dungeonFloor = 1;
        s.floorSeed    = Math.floor(Math.random() * 0x7fffffff);
        s.lastWarpIndex = 0;
        s.currentHp    = this.player.currentHp;
        s.currentMp    = this.player.currentMp;
        s.gold         = this.player.gold;
        SaveManager.write(s);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.stop('UIScene');
          this.scene.start('FloorTransitionScene', { floor: 1 });
        });
        this.cameras.main.fadeOut(400, 0, 0, 0);
      },
    });
  }

  // ── Decorations — sparse dark fantasy ────────────────────────────────────────
  private addDecorations(): void {
    const wx = (c: number) => (c + 0.5) * TILE;
    const wy = (r: number) => (r + 0.5) * TILE;

    const block = (key: string, c: number, r: number, bodyW = 22, bodyH = 22, depth = 3) => {
      const img = this.physics.add.staticImage(wx(c), wy(r), key).setDepth(depth);
      (img.body as Phaser.Physics.Arcade.StaticBody).setSize(bodyW, bodyH);
      this.decorGroup.add(img);
      return img;
    };
    const deco = (key: string, c: number, r: number, depth = 2) => {
      this.add.image(wx(c), wy(r), key).setDepth(depth);
    };

    // ── Iron lampposts — only where they matter ──────────────────────────────────
    // Road junction
    deco('town_lamp', 31, 13, 4);
    // Guard post flanks
    for (const [c, r] of [[24, 36], [39, 36], [24, 41], [39, 41]]) deco('town_lamp', c as number, r as number, 4);
    // Dungeon approach — the torches marking the path into darkness
    for (const [c, r] of [[27, 34], [36, 34], [27, 38], [36, 38], [26, 43], [37, 43]]) {
      deco('town_lamp', c as number, r as number, 4);
    }
    // Chapel entrance
    deco('town_lamp', 3, 31, 4); deco('town_lamp', 11, 31, 4);

    // ── Gnarled trees — clustered in gaps, not scattered everywhere ───────────────
    // North alleys (armory↔inn, inn↔emporium)
    for (const [c, r] of [[13, 3], [14, 7], [49, 5], [50, 2], [49, 9]])
      block('town_tree', c as number, r as number, 24, 24);
    // Far edges
    block('town_tree', 0, 4, 24, 24); block('town_tree', 0, 8, 24, 24);
    block('town_tree', 63, 4, 24, 24); block('town_tree', 63, 8, 24, 24);
    // West side — sparse, foreboding
    block('town_tree', 0, 18, 24, 24); block('town_tree', 0, 24, 24, 24);
    // South-west approach
    block('town_tree', 1, 35, 24, 24); block('town_tree', 2, 42, 24, 24);
    // East park — dead zone near graveyard
    for (const [c, r] of [[52, 16], [58, 14], [63, 18], [55, 22], [61, 26]])
      block('town_tree', c as number, r as number, 24, 24);
    // Chapel tree line
    block('town_tree_pine', 2, 30, 20, 20); block('town_tree_pine', 12, 31, 20, 20);
    block('town_tree', 13, 37, 24, 24); block('town_tree', 14, 43, 24, 24);

    // ── Well (old stone, crumbling) ──────────────────────────────────────────────
    block('town_well', 7, 27, 20, 20);

    // ── Fountain — dark stone monument in the square ─────────────────────────────
    {
      const img = this.physics.add.staticImage(30 * TILE, 21 * TILE + TILE / 2, 'town_fountain').setDepth(3);
      (img.body as Phaser.Physics.Arcade.StaticBody).setSize(44, 44);
      this.decorGroup.add(img);
    }

    // ── Guards — stoic, armored, unsmiling ───────────────────────────────────────
    this.add.image(wx(25), wy(37.5), 'npc_guard').setDepth(5);
    this.add.image(wx(38), wy(37.5), 'npc_guard').setDepth(5).setFlipX(true);

    // ── Notice board (warnings about the dungeon) ────────────────────────────────
    block('town_notice', 23, 37, 24, 28);

    // ── Weathered barrels — only at building entrances ───────────────────────────
    block('town_barrel', 9, 12, 18, 18); block('town_crate', 10, 12, 20, 20);
    block('town_barrel', 55, 12, 18, 18); block('town_crate', 54, 12, 20, 20);
    block('town_barrel', 46, 38, 18, 18); block('town_barrel', 17, 38, 18, 18);

    // ── Graveyard — east park ────────────────────────────────────────────────────
    for (const [c, r] of [[52, 32], [55, 34], [52, 37], [58, 33], [56, 38]])
      deco('deco_d_grave', c as number, r as number, 4);
    deco('deco_d_deadtree', 50, 34, 3);
    deco('deco_d_deadtree', 60, 37, 3);
    deco('deco_d_deadtree', 62, 25, 3);

    // ── Chapel shrine ─────────────────────────────────────────────────────────────
    block('town_shrine', 6, 31, 24, 24, 4);

    // ── A single dark bench in the square — the only resting place ───────────────
    deco('town_bench', 28, 22, 3); deco('town_bench', 33, 22, 3);

    // ── Building labels — small, worn, no icons ──────────────────────────────────
    this.add.text(wx(5.5),  wy(0.5),  'ARMORY',         { fontSize: '7px', color: '#5a4a30' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(31),   wy(0.5),  'THE LAST INN',   { fontSize: '7px', color: '#5a4a30' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(56.5), wy(0.5),  'EMPORIUM',       { fontSize: '7px', color: '#5a4a30' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(6),    wy(31.6), 'CHAPEL',         { fontSize: '7px', color: '#3a3344' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(56.5), wy(15.4), "SAGE'S TOWER",   { fontSize: '7px', color: '#7733aa' }).setOrigin(0.5).setDepth(5);
    // Town name — faded
    this.add.text(wx(31.5), wy(-0.5), 'NIGHTFALL', { fontSize: '10px', color: '#443355' }).setOrigin(0.5).setDepth(5);
    // Dungeon gate inscriptions
    this.add.text(wx(31.5), wy(39.4), 'DUNGEON GATE', { fontSize: '7px', color: '#3a2244' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(40.5), wy(37),   'ABANDON\nALL HOPE', { fontSize: '6px', color: '#4a1818', align: 'center' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(24.5), wy(41.5), '☠', { fontSize: '12px', color: '#3a1a22' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(38.5), wy(41.5), '☠', { fontSize: '12px', color: '#3a1a22' }).setOrigin(0.5).setDepth(5);

    // §12 Sage's Tower — crystal and rune decorations
    for (const col of [52, 55, 58, 61]) deco('deco_crystal_b', col, 16, 4);
    for (const [rc, rr] of [[54, 20], [58, 24], [56, 18]]) {
      const rune = this.add.image(wx(rc as number), wy(rr as number), 'deco_rune').setDepth(2).setAlpha(0.5);
      this.tweens.add({ targets: rune, alpha: { from: 0.2, to: 0.7 }, duration: 1400 + Math.random() * 800, yoyo: true, repeat: -1 });
    }
  }

  // ── Town map (64 × 52 tiles) ──────────────────────────────────────────────────
  private buildTownMap(): number[][] {
    const R = MAP_ROWS, C = MAP_COLS;
    const map: number[][] = Array.from({ length: R }, () => new Array(C).fill(G));

    const fill = (c1: number, r1: number, c2: number, r2: number, t: number) => {
      for (let r = Math.max(0, r1); r <= Math.min(R-1, r2); r++)
        for (let c = Math.max(0, c1); c <= Math.min(C-1, c2); c++) map[r][c] = t;
    };
    const set = (c: number, r: number, t: number) => {
      if (r >= 0 && r < R && c >= 0 && c < C) map[r][c] = t;
    };

    // ── ROAD NETWORK ─────────────────────────────────────────────────────────────
    fill(0,  11, C-1, 11, P);   // north sidewalk strip (in front of shops)
    fill(0,  12, C-1, 13, P);   // main east-west road (2 wide)
    fill(0,  14, C-1, 14, P);   // south sidewalk strip of main road
    fill(0,  30, C-1, 31, P);   // south connecting road
    fill(29,  0, 31, R-1, P);   // north-south central spine (3 wide)
    fill(0,  22, 12,  23, P);   // path to small house / stables

    // Alley between armory and inn
    fill(12, 1, 12, 10, P);
    // Alley between inn and emporium
    fill(49, 1, 49, 10, P);

    // ── WEAPON SHOP / ARMORY (NW): cols 1–11, rows 1–11 ─────────────────────────
    fill(1,  1, 11, 11, W);
    fill(2,  2, 10, 10, I);
    // Internal wall division (creates 2 visible rooms: forge + shop floor)
    fill(2,  6, 6,  6,  W);     // internal divider creating forge room
    set(5,   6, I);              // gap in divider
    // Door opening (south wall)
    set(5, 11, G); set(6, 11, G);
    fill(5, 11, 6, 11, P);
    // Window hints on outer walls
    set(3, 3, P); set(3, 7, P); set(9, 3, P); set(9, 7, P);
    // Chimneys (dark spots on roof)
    set(2, 2, V); set(9, 2, V);

    // ── INN (grand center-north): cols 14–48, rows 1–11 ──────────────────────────
    fill(13, 1, 48, 11, W);
    fill(14, 2, 47, 10, I);
    // Internal courtyard / garden at center (more realistic inn with yard)
    fill(28, 3, 34, 9, P);      // visible cobblestone courtyard inside inn
    // Chimney columns inside inn
    fill(15, 2, 15, 5, W); fill(46, 2, 46, 5, W);
    // Double door (centered on spine)
    set(30, 11, G); set(31, 11, G);
    fill(30, 11, 31, 11, P);
    // Multiple window accents
    for (const wc of [16, 20, 24, 36, 40, 44, 47]) { set(wc, 3, P); set(wc, 8, P); }
    // East/West wing visible separation
    fill(26, 2, 26, 10, W); fill(36, 2, 36, 10, W); // wing divider walls

    // ── EMPORIUM (NE): cols 50–63, rows 1–11 ────────────────────────────────────
    fill(50, 1, 63, 11, W);
    fill(51, 2, 62, 10, I);
    // Bay window display area (protruding shelf visible from outside)
    fill(53, 2, 60, 4, I);
    // Chimney
    set(62, 2, V);
    set(57, 11, G); set(58, 11, G);
    fill(57, 11, 58, 11, P);
    set(52, 4, P); set(52, 7, P); set(61, 4, P); set(61, 7, P);

    // ── SMALL HOUSE (stables area, west): cols 1–9, rows 15–23 ──────────────────
    fill(1, 15, 9, 23, W);
    fill(2, 16, 8, 22, I);
    set(4, 23, G); set(5, 23, G);
    fill(4, 23, 5, 23, P);
    set(3, 18, P); set(7, 18, P);
    // Stable doors (wider opening)
    set(2, 20, I); set(9, 20, P); // side window/door

    // ── GARDEN FENCE (west, rows 25–29) ─────────────────────────────────────────
    fill(1,  25, 11, 29, W);
    fill(2,  26, 10, 28, G);
    set(5, 25, G); set(6, 25, G);

    // ── TOWN SQUARE (center, cols 11–51, rows 15–29) ─────────────────────────────
    fill(11, 15, 51, 29, P);
    // Central fountain plaza (distinct paving)
    fill(25, 18, 37, 26, P);
    // Market lane at south of square
    fill(11, 27, 51, 29, P);
    // Corner plazas
    fill(11, 15, 14, 18, P); fill(48, 15, 51, 18, P);
    fill(11, 26, 14, 29, P); fill(48, 26, 51, 29, P);

    // ── GUARD POST WEST: cols 16–24, rows 33–41 ──────────────────────────────────
    fill(16, 33, 24, 41, W);
    fill(17, 34, 23, 40, I);
    // Watchtower corner
    fill(16, 33, 18, 35, W); set(17, 33, V); // tower corner visible
    set(24, 37, G); set(24, 38, G);
    set(25, 37, P); set(25, 38, P);

    // ── GUARD POST EAST: cols 39–47, rows 33–41 ──────────────────────────────────
    fill(39, 33, 47, 41, W);
    fill(40, 34, 46, 40, I);
    fill(45, 33, 47, 35, W); set(46, 33, V); // tower corner
    set(39, 37, G); set(39, 38, G);
    set(38, 37, P); set(38, 38, P);

    // ── DUNGEON APPROACH — dramatic grand avenue ──────────────────────────────────
    fill(26, 30, 37, 44, P);    // wide cobblestone avenue (12 tiles)
    // Dark atmospheric tiles near the gate (void creeping up)
    fill(27, 40, 36, 42, V);    // shadow spreading from gate base
    fill(28, 43, 35, 44, V);

    // ── DUNGEON GATE COMPLEX (cols 22–41, rows 41–51) ────────────────────────────
    fill(22, 41, 41, 51, W);              // fortress outer walls (wider)
    fill(23, 42, 40, 50, P);             // dungeon-stone floor inside
    // Fortress towers at corners
    fill(22, 41, 24, 44, W); fill(39, 41, 41, 44, W); // NW & NE towers
    fill(22, 47, 24, 51, W); fill(39, 47, 41, 51, W); // SW & SE towers
    // Entrance archway
    for (const c of [28, 29, 30, 31, 32, 33]) set(c, 41, G);
    fill(28, 41, 33, 42, P);
    // Inner void floors (darkness of the dungeon)
    fill(25, 44, 38, 49, V);
    // Portal tiles (deepest point)
    fill(27, 47, 35, 50, 5);
    // Return path
    fill(28, 43, 33, 44, F);
    // Side archways within fortress
    set(22, 45, F); set(22, 46, F); // west side passage
    set(41, 45, F); set(41, 46, F); // east side passage

    // ── CHAPEL (west side, cols 1–12, rows 32–45) ────────────────────────────────
    fill(1,  32, 12, 45, W);
    fill(2,  33, 11, 44, I);
    // Chapel apse (rounded north end — simulate with W tiles)
    fill(3, 33, 10, 35, W); fill(4, 33, 9, 34, I); // inner sanctuary
    // Nave aisle (center visible)
    fill(6, 35, 7, 44, I);
    // Pew rows (slight tile difference for depth)
    for (let r = 36; r <= 43; r += 2) {
      set(3, r, P); set(4, r, P); // left pews
      set(9, r, P); set(10, r, P); // right pews
    }
    // Door (south face)
    set(6, 45, G); set(7, 45, G);
    fill(6, 44, 7, 45, P);
    // Windows
    set(2, 36, P); set(2, 40, P); set(11, 36, P); set(11, 40, P);
    // Steeple hint at top
    set(6, 32, I); set(7, 32, I);

    return map;
  }
}
