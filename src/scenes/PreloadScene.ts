import Phaser from 'phaser';
import { TILE } from '../config';
import { ClassId } from '../types';

const FRAME_W = 32;
const FRAME_H = 48;

type ClipName = 'idle_down' | 'idle_up' | 'idle_side' | 'walk_down' | 'walk_up' | 'walk_side';
const CLIPS: { name: ClipName; count: number }[] = [
  { name: 'idle_down', count: 2 }, { name: 'idle_up',   count: 2 },
  { name: 'idle_side', count: 2 }, { name: 'walk_down', count: 4 },
  { name: 'walk_up',   count: 4 }, { name: 'walk_side', count: 4 },
];
const CLASS_IDS: ClassId[] = ['swordman', 'archer', 'tanker', 'assassin', 'sage'];
const ENEMY_IDS = [
  'bat', 'spider', 'skeleton', 'golem', 'troll', 'goblin', 'goblin_shaman',
  // Floor 2
  'treant', 'forest_wisp', 'vine_snare',
  'ghoul', 'wraith', 'bone_golem',
  'frog_warrior', 'swamp_slug', 'water_serpent',
  'rock_crab', 'stone_imp', 'cave_drake',
];

// Palette
const P = {
  skin:      '#e8b88e', skin_dk: '#c49268', outline: '#1c1822',
  eye_w:     '#f5f5f5', pupil:   '#2c2c40', amber:   '#f0b040',
  metal_hi:  '#cdd0e0', metal:   '#9ca0b2', metal_dk:'#707488', metal_sh:'#494e5e',
  gold:      '#d6ae4a', gold_dk: '#a07e28',
  blue_hi:   '#5a80e0', blue:    '#2a50a0', blue_dk: '#1a3070',
  green_hi:  '#6aaa6a', green:   '#4e8a4e', green_dk:'#365e36',
  leather_hi:'#9a7050', leather: '#7c5838', leather_dk:'#5c3828',
  dark_cl:   '#3a3442', purple:  '#5a4066', purple_hi:'#7a5888',
  brown:     '#7a5030', brown_dk:'#4a3018',
  bone:      '#d8d0bc', bone_dk: '#a89880', bone_sh:  '#786858',
  stone:     '#6a6880', stone_dk:'#484660', stone_hi: '#9a98b0',
  red_e:     '#e83030', green_e: '#30e840', bat_body: '#3a3050',
  bat_wing:  '#4a3860', spider_b:'#2c2828', troll_sk: '#5a6840',
  troll_dk:  '#3a4828',
};

// Shorthand fill helper — returns a function bound to ctx
function mk(ctx: CanvasRenderingContext2D) {
  return (x: number, y: number, w: number, h: number, c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
}

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  create(): void {
    this.buildCaveTileset();
    for (const cls of CLASS_IDS) this.buildPlayerTexture(cls);
    for (const id of ENEMY_IDS) this.buildEnemyTexture(id);
    this.buildEffectTextures();
    this.buildTownDecorations();
    this.buildDungeonDecos();
    this.buildTownExtras();
    this.buildInteriorFurniture();
    this.registerAllAnims();
    this.scene.start('MainMenuScene');
  }

  // ── Cave Tileset ─────────────────────────────────────────────────────────────
  // index 1=cave floor  2=cave wall  3=grass  4=cobble  5=warp portal
  // index 6=void        7=building interior
  private buildCaveTileset(): void {
    // 13 tiles: floor, wall, grass, cobble, warp, void, interior, pillar, floor-stones
    //           + forest-floor(10), dead-floor(11), pond-floor(12), rock-floor(13)
    const tex = this.textures.createCanvas('tiles', TILE * 13, TILE);
    if (!tex) throw new Error('createCanvas(tiles) failed');
    const ctx = tex.getContext();

    this.drawCaveFloor(ctx,     0,       0);   // index 1
    this.drawCaveWall(ctx,      TILE,    0);   // index 2
    this.drawGrass(ctx,         TILE*2,  0);   // index 3
    this.drawCobble(ctx,        TILE*3,  0);   // index 4
    this.drawWarpPortal(ctx,    TILE*4,  0);   // index 5
    // void (index 6)
    ctx.fillStyle = '#0d0b14';
    ctx.fillRect(TILE * 5, 0, TILE, TILE);
    // building interior (index 7)
    this.drawBuildingRoof(ctx, TILE * 6, 0); // solid stone rooftop — no grid visible
    // stone pillar (index 8)
    this.drawStonePillar(ctx, TILE * 7, 0);
    // floor stones / rubble (index 9)
    this.drawFloorStones(ctx, TILE * 8, 0);
    // forest floor (index 10)
    this.drawForestFloor(ctx, TILE * 9, 0);
    // deadland floor (index 11)
    this.drawDeadFloor(ctx, TILE * 10, 0);
    // pond floor (index 12)
    this.drawPondFloor(ctx, TILE * 11, 0);
    // rock floor (index 13)
    this.drawRockFloor(ctx, TILE * 12, 0);

    tex.refresh();
  }

  private drawForestFloor(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    f(ox, oy, TILE, TILE, '#1a2a14');
    // Mossy patches
    f(ox,    oy,    14, 12, '#1e3018');
    f(ox+15, oy,    17, 10, '#1a2c14');
    f(ox,    oy+13, 10, 11, '#203214');
    f(ox+11, oy+11, 15, 11, '#1c2e14');
    f(ox,    oy+25, 16,  7, '#1a2c12');
    f(ox+17, oy+23, 15,  9, '#1e3018');
    // Moss veins
    f(ox+14, oy,     1, 12, '#0e1a0a');
    f(ox,    oy+12, 14,  1, '#0e1a0a');
    f(ox+10, oy+13,  1, 11, '#0e1a0a');
    // Leaf highlights
    f(ox+2,  oy+2,  4,  2, '#2e4a1e');
    f(ox+18, oy+3,  5,  2, '#2e4a1e');
    f(ox+6,  oy+18, 4,  2, '#2e4a1e');
    f(ox+22, oy+20, 5,  2, '#2e4a1e');
    f(ox+10, oy+27, 6,  2, '#2e4a1e');
  }

  private drawDeadFloor(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    f(ox, oy, TILE, TILE, '#1e1c18');
    // Ash patches
    f(ox,    oy,    14, 12, '#22201c');
    f(ox+15, oy,    17, 10, '#201e1a');
    f(ox,    oy+13, 10, 11, '#242218');
    f(ox+11, oy+11, 15, 11, '#1e1c18');
    f(ox,    oy+25, 16,  7, '#201e18');
    f(ox+17, oy+23, 15,  9, '#242218');
    // Crack seams (ashen)
    f(ox+14, oy,     1, 12, '#141210');
    f(ox,    oy+12, 14,  1, '#141210');
    f(ox+10, oy+13,  1, 11, '#141210');
    // Bone fragments
    f(ox+3,  oy+5,  4,  2, '#a09880');
    f(ox+19, oy+7,  3,  1, '#a09880');
    f(ox+8,  oy+22, 5,  1, '#a09880');
    f(ox+24, oy+17, 3,  2, '#a09880');
    // Ash highlights
    f(ox+1,  oy+1,  12, 1, '#2e2c28');
    f(ox+16, oy+1,  14, 1, '#2e2c28');
    f(ox+1,  oy+26, 13, 1, '#2e2c28');
  }

  private drawPondFloor(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    f(ox, oy, TILE, TILE, '#141e2a');
    // Wet stone patches
    f(ox,    oy,    14, 12, '#182030');
    f(ox+15, oy,    17, 10, '#141e2e');
    f(ox,    oy+13, 10, 11, '#1a2232');
    f(ox+11, oy+11, 15, 11, '#161e2e');
    f(ox,    oy+25, 16,  7, '#141e2a');
    f(ox+17, oy+23, 15,  9, '#182030');
    // Water seam lines
    f(ox+14, oy,     1, 12, '#0a1020');
    f(ox,    oy+12, 14,  1, '#0a1020');
    f(ox+10, oy+13,  1, 11, '#0a1020');
    // Blue-water highlights
    f(ox+2,  oy+3,  4,  2, '#1e3850');
    f(ox+18, oy+5,  5,  2, '#1e3850');
    f(ox+6,  oy+19, 4,  2, '#1e3850');
    f(ox+22, oy+15, 5,  2, '#1e3850');
    f(ox+10, oy+28, 7,  1, '#2a4a68');  // water shimmer
    f(ox+16, oy+27, 4,  1, '#2a4a68');
  }

  private drawRockFloor(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    f(ox, oy, TILE, TILE, '#221e1a');
    // Rocky brown segments
    f(ox,    oy,    14, 12, '#26221e');
    f(ox+15, oy,    17, 10, '#221e1a');
    f(ox,    oy+13, 10, 11, '#2a2520');
    f(ox+11, oy+11, 15, 11, '#241f1c');
    f(ox,    oy+25, 16,  7, '#221e1a');
    f(ox+17, oy+23, 15,  9, '#282318');
    // Rock seams
    f(ox+14, oy,     1, 12, '#16120e');
    f(ox,    oy+12, 14,  1, '#16120e');
    f(ox+10, oy+13,  1, 11, '#16120e');
    // Rocky highlights
    f(ox+1,  oy+1,  12, 1, '#342e28');
    f(ox+16, oy+1,  14, 1, '#342e28');
    f(ox+1,  oy+26, 13, 1, '#342e28');
    // Mineral flecks
    f(ox+4,  oy+6,  2, 1, '#4a4030');
    f(ox+20, oy+4,  2, 1, '#4a4030');
    f(ox+8,  oy+20, 2, 1, '#4a4030');
    f(ox+25, oy+22, 2, 1, '#4a4030');
  }

  /**
   * Index 7 — building rooftop seen from above (opaque, no floor-grid).
   * Dark neutral slate with subtle stone variation and thin edge-shadow so
   * the raised walls (index 2) read distinctly around it.
   */
  private drawBuildingRoof(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    // Base — dark charcoal slate
    f(ox, oy, TILE, TILE, '#161416');
    // Stone panel variation (irregular slabs, no grid)
    f(ox+ 2, oy+ 1, 12, 10, '#191719');
    f(ox+15, oy+ 0, 14,  9, '#171517');
    f(ox+ 0, oy+12,  9, 10, '#1a181a');
    f(ox+10, oy+11, 15, 10, '#181618');
    f(ox+ 0, oy+23, 15,  9, '#171517');
    f(ox+16, oy+22, 16,  8, '#191719');
    // Very faint crack lines between slabs (barely a pixel wide)
    f(ox+14, oy,     1, 11, '#0f0e0f');
    f(ox+ 0, oy+11, 13,  1, '#0f0e0f');
    f(ox+ 9, oy+12,  1, 10, '#0f0e0f');
    f(ox+15, oy+21, 17,  1, '#0f0e0f');
    // Top-left edge highlight — faint ambient light from above
    f(ox+ 0, oy+ 0, TILE,  1, '#1f1d1f');
    f(ox+ 0, oy+ 0,  1, TILE, '#1f1d1f');
    // Bottom-right edge shadow — implies raised walls below
    f(ox+ 0, oy+31, TILE,  1, '#0c0b0c');
    f(ox+31, oy+ 0,  1, TILE, '#0c0b0c');
  }

  private drawCaveFloor(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    // Deep dungeon floor — near-black stone with cold blue-shadow undertone
    f(ox, oy, TILE, TILE, '#141218');
    // Stone slab segments
    f(ox,    oy,    14, 12, '#18151e');
    f(ox+15, oy,    17, 10, '#161320');
    f(ox,    oy+13, 10, 11, '#1a1720');
    f(ox+11, oy+11, 15, 11, '#17141e');
    f(ox,    oy+25, 16,  7, '#16131e');
    f(ox+17, oy+23, 15,  9, '#191620');
    // Crack seams
    f(ox+14, oy,     1, 12, '#0c0a10');
    f(ox,    oy+12, 14,  1, '#0c0a10');
    f(ox+10, oy+13,  1, 11, '#0c0a10');
    f(ox+11, oy+22, 21,  1, '#0c0a10');
    f(ox+16, oy+22,  1, 10, '#0c0a10');
    // Edge highlights — very subtle, colder tone
    f(ox+1,  oy+1,  12,  1, '#201e28');
    f(ox+1,  oy+1,   1, 10, '#201e28');
    f(ox+16, oy+1,  14,  1, '#201e28');
    f(ox+12, oy+12, 12,  1, '#201e28');
    f(ox+1,  oy+26, 13,  1, '#201e28');
    f(ox+18, oy+24, 12,  1, '#201e28');
    // Pebbles
    f(ox+3,  oy+6,  2,  1, '#2c2840');
    f(ox+8,  oy+4,  1,  2, '#2c2840');
    f(ox+21, oy+3,  2,  1, '#2c2840');
    f(ox+5,  oy+18, 2,  1, '#2c2840');
    f(ox+19, oy+15, 1,  2, '#2c2840');
    f(ox+12, oy+27, 2,  1, '#2c2840');
    f(ox+25, oy+28, 2,  1, '#2c2840');
  }

  private drawCaveWall(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    // Massive dark stone — dungeon walls AND town building exteriors
    f(ox, oy, TILE, TILE, '#131118');
    // Rock face shapes (irregular rough-hewn stone)
    f(ox+2,  oy+3,  12,  9, '#211e30');
    f(ox+16, oy+1,  13,  8, '#201d2e');
    f(ox+1,  oy+14,  9,  9, '#211e30');
    f(ox+11, oy+12, 16,  9, '#201d2e');
    f(ox+3,  oy+24, 12,  8, '#211e30');
    f(ox+17, oy+22, 13,  9, '#201d2e');
    // Stone face surfaces
    f(ox+3,  oy+4,  10,  7, '#2a2640');
    f(ox+17, oy+2,  11,  6, '#28243e');
    f(ox+2,  oy+15,  7,  7, '#2a2640');
    f(ox+12, oy+13, 14,  7, '#28243e');
    f(ox+4,  oy+25, 10,  6, '#2a2640');
    f(ox+18, oy+23, 11,  7, '#28243e');
    // Top-edge catch-light (dim, just enough to read the surface)
    f(ox+3,  oy+4,  10,  1, '#363254');
    f(ox+17, oy+2,  11,  1, '#343050');
    f(ox+2,  oy+15,  7,  1, '#363254');
    f(ox+12, oy+13, 14,  1, '#343050');
    f(ox+4,  oy+25, 10,  1, '#363254');
    f(ox+18, oy+23, 11,  1, '#343050');
    // Deep shadow crevices
    f(ox+14, oy,     2, 13, '#07060c');
    f(ox,    oy+12, 11,  2, '#07060c');
    f(ox+10, oy+14,  2,  8, '#07060c');
    f(ox+27, oy+9,   2, 14, '#07060c');
    f(ox,    oy+23, 17,  1, '#07060c');
    f(ox+15, oy+21,  2, 11, '#07060c');
  }

  private drawWarpPortal(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    // Void background
    f(ox, oy, TILE, TILE, '#0a0814');
    // Outer glowing ring (squared off for pixel art)
    f(ox+4,  oy+4,  24, 24, '#33188a');
    f(ox+6,  oy+6,  20, 20, '#5530cc');
    f(ox+8,  oy+8,  16, 16, '#7a50ee');
    f(ox+10, oy+10, 12, 12, '#9966ff');
    f(ox+12, oy+12,  8,  8, '#bb88ff');
    // Core
    f(ox+14, oy+14,  4,  4, '#ddccff');
    // Sparkles
    f(ox+4,  oy+16,  1,  1, '#ffffff');
    f(ox+16, oy+4,   1,  1, '#ffffff');
    f(ox+27, oy+16,  1,  1, '#ffffff');
    f(ox+16, oy+27,  1,  1, '#ffffff');
    f(ox+7,  oy+7,   1,  1, '#ccaaff');
    f(ox+24, oy+7,   1,  1, '#ccaaff');
    f(ox+7,  oy+24,  1,  1, '#ccaaff');
    f(ox+24, oy+24,  1,  1, '#ccaaff');
    // Down arrow at bottom
    f(ox+14, oy+20,  4,  1, '#ffffff');
    f(ox+15, oy+21,  2,  1, '#ffffff');
    f(ox+16, oy+22,  1,  1, '#ffffff');
  }

  private drawGrass(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    // Dark, damp earth — ground of a settlement built next to a dungeon
    f(ox, oy, TILE, TILE, '#14120c');
    // Cracked earth segments
    f(ox,    oy,    14, 12, '#18160e');
    f(ox+15, oy,    17, 10, '#161410');
    f(ox,    oy+13, 10, 11, '#1a180e');
    f(ox+11, oy+11, 15, 11, '#161410');
    f(ox,    oy+25, 16,  7, '#18160e');
    f(ox+17, oy+23, 15,  9, '#1a180e');
    // Crack lines (parched earth)
    f(ox+14, oy,     1, 12, '#0c0a08');
    f(ox,    oy+12, 14,  1, '#0c0a08');
    f(ox+10, oy+13,  1, 11, '#0c0a08');
    // Sparse dead grass tufts
    f(ox+3,  oy+4,  1, 4, '#252214');
    f(ox+9,  oy+7,  1, 3, '#1e1c10');
    f(ox+20, oy+2,  1, 4, '#252214');
    f(ox+7,  oy+20, 1, 3, '#1e1c10');
    f(ox+25, oy+14, 1, 4, '#252214');
    f(ox+15, oy+25, 1, 3, '#1e1c10');
    f(ox+27, oy+6,  2, 1, '#201e10');
    // Pebbles
    f(ox+5,  oy+16, 2, 1, '#1a1810');
    f(ox+22, oy+22, 2, 1, '#1a1810');
  }

  private drawCobble(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    // Ancient dark stone — worn smooth by centuries, stained by age
    f(ox, oy, TILE, TILE, '#1e1c1a');
    // Stone block divisions (barely visible)
    f(ox,     oy,      TILE, 1, '#141210');
    f(ox,     oy+15,   TILE, 1, '#141210');
    f(ox+15,  oy,      1, 15, '#141210');
    f(ox,     oy+16,   1, TILE-16, '#141210');
    f(ox+24,  oy+16,   1, TILE-16, '#141210');
    // Very subtle worn edge catch-light (just enough to read as stone)
    f(ox+1,   oy+1,    TILE-2, 1, '#26241e');
    f(ox+1,   oy+16,   TILE-2, 1, '#26241e');
    // Dark damp stains
    f(ox+5,   oy+5,    3, 2, '#181614');
    f(ox+21,  oy+19,   3, 2, '#181614');
  }

  private drawStonePillar(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    // Floor background
    f(ox, oy, TILE, TILE, '#1c1929');
    f(ox+1, oy+1, TILE-2, 5, '#221e33'); // subtle floor stones around pillar
    // Drop-shadow behind pillar (bottom-right)
    f(ox+9, oy+21, 16, 4, '#0a0814');
    f(ox+21, oy+8, 4, 14, '#0a0814');
    // Pillar main body (slightly off-center to show depth)
    f(ox+8,  oy+8,  16, 16, '#2a2448');  // outer edge / sides
    // Pillar top face
    f(ox+9,  oy+9,  14, 14, '#3c3660');
    f(ox+10, oy+10, 12, 12, '#454070');  // inner face
    // Top face highlight (top-left corner = light source)
    f(ox+10, oy+10,  9, 1, '#5e5888');
    f(ox+10, oy+10,  1, 9, '#5e5888');
    f(ox+11, oy+11,  6, 1, '#4e4878');
    // Crack detail on top face
    f(ox+13, oy+12,  1, 5, '#2a2448');
    f(ox+16, oy+13,  3, 1, '#2a2448');
    // Stone cap ring (slightly wider than pillar shaft)
    f(ox+8,  oy+8,  16, 1, '#4e4878');  // top ring highlight
    f(ox+8,  oy+23, 16, 1, '#1a1838');  // bottom ring shadow
    f(ox+8,  oy+8,   1, 16, '#3a3460'); // left ring face
    f(ox+23, oy+8,   1, 16, '#1a1838'); // right ring shadow
    // Small rubble at base
    f(ox+6,  oy+22,  2, 1, '#2c2840');
    f(ox+24, oy+23,  2, 1, '#2c2840');
  }

  private drawFloorStones(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const f = mk(ctx);
    // Same base as cave floor
    f(ox, oy, TILE, TILE, '#1c1929');
    f(ox,    oy,    14, 12, '#221e33');
    f(ox+15, oy,    17, 10, '#1e1b30');
    f(ox,    oy+13, 10, 11, '#242039');
    f(ox+11, oy+11, 15, 11, '#201d30');
    f(ox,    oy+25, 16,  7, '#1e1b2e');
    f(ox+17, oy+23, 15,  9, '#232038');
    f(ox+14, oy,     1, 12, '#100e18');
    f(ox,    oy+12, 14,  1, '#100e18');
    f(ox+10, oy+13,  1, 11, '#100e18');
    f(ox+11, oy+22, 21,  1, '#100e18');
    // Extra scattered stone fragments
    f(ox+2,  oy+2,  5, 3, '#2e2a42');  f(ox+2,  oy+2,  5, 1, '#3a3658');
    f(ox+16, oy+1,  6, 4, '#2a2640');  f(ox+16, oy+1,  6, 1, '#38345a');
    f(ox+3,  oy+15, 4, 3, '#2e2a42');  f(ox+3,  oy+15, 4, 1, '#3a3658');
    f(ox+18, oy+13, 7, 4, '#2a2640');  f(ox+18, oy+13, 7, 1, '#38345a');
    f(ox+22, oy+5,  5, 3, '#2c2840');  f(ox+22, oy+5,  5, 1, '#3a3658');
    f(ox+8,  oy+21, 5, 3, '#2e2a42');  f(ox+8,  oy+21, 5, 1, '#3a3658');
    f(ox+24, oy+19, 4, 4, '#2a2640');  f(ox+24, oy+19, 4, 1, '#38345a');
    f(ox+12, oy+26, 6, 4, '#2e2a42');  f(ox+12, oy+26, 6, 1, '#3a3658');
    // Bone fragment
    f(ox+5,  oy+27, 3, 1, '#b0a888');
    f(ox+28, oy+8,  1, 3, '#b0a888');
  }

  private fillGrid(ctx: CanvasRenderingContext2D, ox: number, oy: number, size: number, bg: string, line: string, step: number): void {
    ctx.fillStyle = bg;
    ctx.fillRect(ox, oy, size, size);
    ctx.fillStyle = line;
    for (let i = 0; i < size; i += step) {
      ctx.fillRect(ox + i, oy, 1, size);
      ctx.fillRect(ox, oy + i, size, 1);
    }
  }

  // ── Player textures ───────────────────────────────────────────────────────────
  private buildPlayerTexture(clazz: ClassId): void {
    const total = CLIPS.reduce((s, c) => s + c.count, 0);
    const tex = this.textures.createCanvas(`player_${clazz}`, FRAME_W * total, FRAME_H);
    if (!tex) throw new Error(`createCanvas(player_${clazz}) failed`);
    const ctx = tex.getContext();

    let fx = 0;
    for (const clip of CLIPS) {
      for (let i = 0; i < clip.count; i++) {
        this.drawPlayerFrame(ctx, fx, clip.name, i, clazz);
        tex.add(`${clip.name}_${i}`, 0, fx, 0, FRAME_W, FRAME_H);
        fx += FRAME_W;
      }
    }
    tex.refresh();
  }

  private drawPlayerFrame(ctx: CanvasRenderingContext2D, fx: number, clip: ClipName, frame: number, clazz: ClassId): void {
    const dir    = clip.split('_')[1] as 'down' | 'up' | 'side';
    const isWalk = clip.startsWith('walk');
    const bob    = isWalk && frame % 2 === 1 ? 1 : 0;
    const lp     = isWalk ? frame : 0;
    // Left/right leg step alternation
    const ll = lp === 1 ? 12 : lp === 3 ? 8 : 10;
    const rl = lp === 1 ? 8  : lp === 3 ? 12 : 10;

    const f = (x: number, y: number, w: number, h: number, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect(fx + x, y + bob, w, h);
    };

    switch (clazz) {
      case 'swordman': this.drawSwordman(f, dir, ll, rl); break;
      case 'archer':   this.drawArcher(f, dir, ll, rl);   break;
      case 'tanker':   this.drawTanker(f, dir, ll, rl);   break;
      case 'assassin': this.drawAssassin(f, dir, ll, rl); break;
      case 'sage':     this.drawSage(f, dir, ll, rl);     break;
    }
  }

  // Helper type for the fill function passed into character drawers
  private drawSwordman(f: (x:number,y:number,w:number,h:number,c:string)=>void, dir: 'down'|'up'|'side', ll: number, rl: number): void {
    if (dir === 'up') {
      // Back of helm + cape
      f(10, 7, 12, 9, P.metal_dk);
      f(11, 7, 10,  1, P.metal);
      f(10, 15, 12,  2, P.metal_sh);
      f(11, 17, 10, 10, P.blue_dk);
      f(11, 17, 10,  1, P.blue);
      f(10, 27, 4, ll, P.metal_sh);
      f(18, 27, 4, rl, P.metal_sh);
      return;
    }
    // ── Head / Helm ──────────────────────────────────────────────────────────
    // Helm crown
    f(11, 7, 10, 1, P.metal_hi);
    f(10, 8, 12, 7, P.metal_dk);
    f(11, 8, 10, 1, P.metal);
    // Face visible in visor opening
    if (dir === 'down') {
      f(12, 10, 8, 5, P.skin);
      f(13, 12, 2, 1, P.pupil); // left eye
      f(17, 12, 2, 1, P.pupil); // right eye
    } else {
      // Side: partial face
      f(13, 10, 6, 5, P.skin);
      f(14, 12, 2, 1, P.pupil);
    }
    // Visor bars
    f(11, 10, 1, 5, P.metal_dk);
    f(21, 10, 1, 5, P.metal_dk);
    f(10, 14, 12, 2, P.metal_sh); // chin guard
    f(11, 15, 10, 1, P.metal_sh);
    // Neckguard
    f(12, 16, 8, 1, P.metal_sh);

    // ── Body ────────────────────────────────────────────────────────────────
    f(10, 17, 12, 10, P.metal_dk); // chainmail flanks
    f(13, 17, 6, 9, P.blue);       // blue tabard center
    f(13, 17, 6, 1, P.blue_hi);    // tabard top highlight
    f(10, 17, 1, 10, P.metal);     // left shoulder catch-light
    f(10, 17, 12, 1, P.metal);     // shoulder pad top
    // Belt
    f(10, 26, 12, 1, P.brown_dk);
    f(15, 25, 2, 3, P.gold);       // belt buckle
    // Sword hilt on right hip
    f(22, 21, 1, 5, P.brown);      // handle
    f(20, 21, 5, 1, P.gold);       // crossguard
    f(22, 26, 1, 3, P.metal_sh);   // blade glimpse

    // ── Legs ────────────────────────────────────────────────────────────────
    f(10, 27, 5, ll, P.metal_dk);
    f(17, 27, 5, rl, P.metal_dk);
    f(11, 27+ll-2, 3, 2, P.metal_sh); // boot
    f(18, 27+rl-2, 3, 2, P.metal_sh);
  }

  private drawArcher(f: (x:number,y:number,w:number,h:number,c:string)=>void, dir: 'down'|'up'|'side', ll: number, rl: number): void {
    if (dir === 'up') {
      // Back of hood
      f(11, 6, 10, 10, P.green_dk);
      f(12, 6,  8,  1, P.green);
      // Quiver on back
      f(20, 14, 3, 12, P.brown);
      f(21, 13, 1, 3, P.metal_sh); // arrow tips
      f(11, 17, 10, 10, P.leather);
      f(10, 27, 4, ll, P.leather_dk);
      f(18, 27, 4, rl, P.leather_dk);
      return;
    }
    // ── Hood ────────────────────────────────────────────────────────────────
    f(12, 6, 8, 1, P.green);        // hood tip
    f(11, 7, 10, 3, P.green_dk);    // hood cap
    f(10, 9, 12, 3, P.green_dk);    // hood brim wider
    // Face
    f(12, 10, 8, 6, P.skin);
    f(12, 10, 8, 1, P.green_dk);    // shadow of hood over forehead
    // Eyes
    if (dir === 'down') {
      f(13, 13, 2, 1, P.pupil);
      f(17, 13, 2, 1, P.pupil);
    } else {
      f(14, 13, 2, 1, P.pupil);
    }
    // Hair at sides of hood
    f(11, 10, 1, 5, P.brown);
    f(20, 10, 1, 5, P.brown);
    f(10, 15, 12, 1, P.green_dk);   // hood lower edge

    // ── Body ────────────────────────────────────────────────────────────────
    f(11, 16, 10, 10, P.leather);
    f(11, 16,  1, 10, P.leather_hi); // left highlight
    f(11, 16, 10,  1, P.leather_hi); // shoulder top
    // Green cloak overlay at sides
    f(10, 16, 1, 10, P.green_dk);
    f(21, 16, 1, 10, P.green_dk);
    // Belt with pouch
    f(11, 25, 10, 2, P.brown_dk);
    f(18, 24, 3, 4, P.brown);       // pouch

    // Bow on side frame
    if (dir === 'side') {
      // Bow arc (right side, 3 pixel thick)
      f(22, 12, 1, 18, P.brown);
      f(23, 14, 1, 14, P.brown_dk);
      f(22, 12, 2, 1, P.gold_dk);  // bow tip
      f(22, 29, 2, 1, P.gold_dk);
    }

    // ── Legs ────────────────────────────────────────────────────────────────
    f(11, 27, 4, ll, P.leather_dk);
    f(17, 27, 4, rl, P.leather_dk);
    f(11, 27+ll-2, 4, 2, P.brown_dk); // boot
    f(17, 27+rl-2, 4, 2, P.brown_dk);
  }

  private drawTanker(f: (x:number,y:number,w:number,h:number,c:string)=>void, dir: 'down'|'up'|'side', ll: number, rl: number): void {
    if (dir === 'up') {
      // Back of great helm + wide pauldrons
      f(9, 6, 14, 10, P.metal_dk);
      f(10, 6, 12,  1, P.metal);
      f(9, 15, 14,  2, P.metal_sh);
      f(8, 17, 16, 10, P.metal_dk);
      f(8, 17, 16,  1, P.metal);
      f(8, 17,  1, 10, P.metal);
      f(23,17,  1, 10, P.metal);
      f(9, 27, 6, ll, P.metal_sh);
      f(17, 27, 6, rl, P.metal_sh);
      return;
    }
    // ── Great Helm (full closed) ─────────────────────────────────────────────
    f(9,  6, 14, 10, P.metal_dk);
    f(10, 6, 12,  1, P.metal_hi);  // crown
    f(9,  6,  1, 10, P.metal_sh);  // left shadow
    // T-slit visor
    if (dir === 'down') {
      f(15, 9,  2,  6, P.outline);  // vertical slit
      f(11, 11, 10,  2, P.outline); // horizontal slit
    } else {
      f(13, 10, 2,  5, P.outline);
    }
    // Gold cross/emblem
    f(15,  7, 2,  1, P.gold);
    f(14,  8, 4,  1, P.gold);
    // Gorget
    f(11, 15, 10, 2, P.metal_sh);

    // ── Body (wide plate) ────────────────────────────────────────────────────
    f(8, 17, 16, 10, P.metal_dk);
    f(8, 17, 16,  1, P.metal);       // shoulder highlight
    f(8, 17,  1, 10, P.metal);
    f(23,17,  1, 10, P.metal);
    // Breastplate detail
    f(11,18, 10, 8, P.metal_sh);
    f(11,18, 10,  1, P.metal);
    f(11,18,  1,  8, P.metal);
    f(15,19,  2, 6, P.metal);        // center keel
    // Gold trim
    f(8, 26, 16, 1, P.gold);
    // Shield on left side (front view only)
    if (dir === 'down') {
      f(4, 18,  6, 8, P.metal);
      f(5, 19,  4, 6, P.metal_dk);
      f(4, 18,  6, 1, P.metal_hi);
      f(6, 21,  2, 2, P.gold);       // boss stud
    }

    // ── Legs ────────────────────────────────────────────────────────────────
    f(9,  27, 6, ll, P.metal_sh);
    f(17, 27, 6, rl, P.metal_sh);
    f(9,  27+ll-2, 6, 2, P.metal_dk);
    f(17, 27+rl-2, 6, 2, P.metal_dk);
  }

  private drawAssassin(f: (x:number,y:number,w:number,h:number,c:string)=>void, dir: 'down'|'up'|'side', ll: number, rl: number): void {
    if (dir === 'up') {
      f(12, 6,  8, 10, P.dark_cl);
      f(13, 6,  6,  1, P.purple);
      f(12, 16, 8, 10, P.dark_cl);
      f(12, 16, 8,  1, P.purple_hi);
      f(12, 27, 4, ll, P.outline);
      f(17, 27, 4, rl, P.outline);
      return;
    }
    // ── Cowl / Hood ──────────────────────────────────────────────────────────
    f(12, 6, 8, 1, P.purple);       // hood point
    f(11, 7, 10, 3, P.dark_cl);
    f(10, 9, 12, 3, P.dark_cl);     // brim
    // Only eyes show — glowing amber
    f(12, 10, 8, 6, P.outline);     // shadow face
    if (dir === 'down') {
      f(13, 12, 2, 2, P.amber);     // glowing left eye
      f(17, 12, 2, 2, P.amber);     // glowing right eye
      // Subtle glow halo
      f(12, 12, 1, 2, '#f0a030');
      f(15, 12, 2, 1, P.outline);   // nose bridge
      f(19, 12, 1, 2, '#f0a030');
    } else {
      f(14, 12, 2, 2, P.amber);
      f(13, 12, 1, 2, '#f0a030');
    }
    // Lower face wrap (scarf)
    f(11, 14, 10, 2, P.purple);
    f(12, 16, 8,  1, P.dark_cl);

    // ── Body (light dark leather) ────────────────────────────────────────────
    f(12, 17, 8, 9, P.dark_cl);
    f(12, 17, 8, 1, P.purple_hi);   // collar
    f(12, 17, 1, 9, P.purple);      // left accent strip
    // Belt with dagger sheaths
    f(12, 25, 8, 2, P.brown_dk);
    // Left dagger
    f(11, 22, 1, 5, P.metal);       // blade
    f(10, 22, 3, 1, P.gold_dk);     // crossguard
    // Right dagger
    f(20, 22, 1, 5, P.metal);
    f(19, 22, 3, 1, P.gold_dk);

    // ── Legs ────────────────────────────────────────────────────────────────
    f(12, 27, 4, ll, P.dark_cl);
    f(17, 27, 4, rl, P.dark_cl);
    f(12, 27+ll-2, 4, 2, P.outline); // soft boot
    f(17, 27+rl-2, 4, 2, P.outline);
  }

  private drawSage(f: (x:number,y:number,w:number,h:number,c:string)=>void, dir: 'down'|'up'|'side', ll: number, rl: number): void {
    if (dir === 'up') {
      // Tall hat from behind, robe
      f(13, 2,  6, 8, '#1a1a4e');  // hat
      f(11, 9, 10, 3, '#1a1a4e');  // hat brim
      f(12, 11, 8, 6, P.brown);    // hair
      f(11, 16, 10, 10, '#3a3060');
      f(11, 16, 10,  1, '#5a50a0');
      f(12, 27, 4, ll, '#2a2050');
      f(16, 27, 4, rl, '#2a2050');
      return;
    }
    // ── Pointed Wizard Hat ────────────────────────────────────────────────────
    f(15, 2,  2, 4, '#1a1a4e');    // hat tip
    f(13, 5,  6, 3, '#1a1a4e');
    f(12, 7,  8, 3, '#1a1a4e');
    f(11, 9, 10, 2, '#1a1a4e');    // wide brim
    // Gold star on hat
    f(15, 4,  2, 1, P.gold);
    f(14, 5,  4, 1, P.gold);
    f(15, 6,  2, 1, P.gold);
    // Hat brim highlight
    f(11, 9, 10, 1, '#3030a0');

    // ── Face ────────────────────────────────────────────────────────────────
    f(12, 11, 8, 6, P.skin);
    f(12, 11, 8, 1, '#1a1a4e');    // shadow from hat brim
    if (dir === 'down') {
      f(13, 14, 2, 1, P.pupil);
      f(17, 14, 2, 1, P.pupil);
    } else {
      f(14, 14, 2, 1, P.pupil);
    }
    // Long white beard
    f(13, 16, 6, 2, P.skin);
    f(13, 17, 6, 4, '#d0ccc4');
    f(14, 20, 4, 3, '#c0bcb4');

    // ── Robe ────────────────────────────────────────────────────────────────
    f(11, 17, 10, 10, '#3a3060');
    f(11, 17, 10,  1, '#5a50a0');   // collar glow
    f(11, 17,  1, 10, '#5a50a0');
    // Rune/glyph on robe
    f(14, 19, 4, 1, P.gold);
    f(15, 20, 2, 2, P.gold);
    f(14, 22, 4, 1, P.gold);
    // Long sleeves
    f(9,  18, 2, 6, '#3a3060');
    f(21, 18, 2, 6, '#3a3060');

    // Staff on side frames
    if (dir === 'side') {
      f(23, 8, 2, 20, P.brown);    // staff shaft
      f(22, 8, 4, 1, P.brown_dk);
      f(23, 8, 2, 4, '#3344cc');   // crystal head
      f(22, 9, 4, 2, '#5566ee');   // crystal glow
      f(21, 9, 1, 2, '#8899ff');
    }

    // ── Robe hem (legs hidden) ─────────────────────────────────────────────
    f(11, 27, 10, ll, '#2a2050');
    f(12, 27, 8, rl, '#2a2050');
    f(11, 35,  2,  2, '#1a1840'); // hem shadow left
    f(19, 35,  2,  2, '#1a1840');
  }

  // ── Enemy textures ────────────────────────────────────────────────────────────
  private buildEnemyTexture(id: string): void {
    const tex = this.textures.createCanvas(`enemy_${id}`, FRAME_W * 4, FRAME_H);
    if (!tex) throw new Error(`createCanvas(enemy_${id}) failed`);
    const ctx = tex.getContext();
    for (let i = 0; i < 4; i++) {
      this.drawEnemyFrame(ctx, i * FRAME_W, i, id);
    }
    tex.refresh();
  }

  private drawEnemyFrame(ctx: CanvasRenderingContext2D, fx: number, frame: number, id: string): void {
    const isWalk = frame >= 2;
    const bob    = isWalk && frame % 2 === 1 ? 1 : 0;
    const f = (x: number, y: number, w: number, h: number, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect(fx + x, y + bob, w, h);
    };
    switch (id) {
      case 'bat':           this.drawBat(f, isWalk, frame);          break;
      case 'spider':        this.drawSpider(f, isWalk, frame);        break;
      case 'skeleton':      this.drawSkeleton(f, isWalk, frame);      break;
      case 'golem':         this.drawGolem(f, isWalk, frame);         break;
      case 'troll':         this.drawTroll(f, isWalk, frame);         break;
      case 'goblin':        this.drawGoblin(f, isWalk, frame);        break;
      case 'goblin_shaman': this.drawGoblinShaman(f, isWalk, frame);  break;
      // Floor 2
      case 'treant':        this.drawTreant(f, isWalk, frame);        break;
      case 'forest_wisp':   this.drawForestWisp(f, isWalk, frame);   break;
      case 'vine_snare':    this.drawVineSnare(f, isWalk, frame);     break;
      case 'ghoul':         this.drawGhoul(f, isWalk, frame);         break;
      case 'wraith':        this.drawWraith(f, isWalk, frame);        break;
      case 'bone_golem':    this.drawBoneGolem(f, isWalk, frame);     break;
      case 'frog_warrior':  this.drawFrogWarrior(f, isWalk, frame);   break;
      case 'swamp_slug':    this.drawSwampSlug(f, isWalk, frame);     break;
      case 'water_serpent': this.drawWaterSerpent(f, isWalk, frame);  break;
      case 'rock_crab':     this.drawRockCrab(f, isWalk, frame);      break;
      case 'stone_imp':     this.drawStoneImp(f, isWalk, frame);      break;
      case 'cave_drake':    this.drawCaveDrake(f, isWalk, frame);     break;
    }
  }

  private drawBat(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const wingSpread = isWalk && frame % 2 === 1;
    // Wings
    if (wingSpread) {
      // Wings up
      f(2, 10, 12, 2, P.bat_wing);
      f(4,  8,  8, 2, P.bat_wing);
      f(18, 10, 12, 2, P.bat_wing);
      f(20,  8,  8, 2, P.bat_wing);
      f(2, 12,  2, 3, P.bat_wing);
      f(28, 12, 2, 3, P.bat_wing);
    } else {
      // Wings level/down
      f(2, 14, 12, 4, P.bat_wing);
      f(2, 17,  6, 3, P.bat_wing);
      f(18, 14, 12, 4, P.bat_wing);
      f(24, 17,  6, 3, P.bat_wing);
    }
    // Wing membrane details
    f(4,  wingSpread ? 8 : 14, 2, 2, P.bat_body);
    f(26, wingSpread ? 8 : 14, 2, 2, P.bat_body);
    // Body
    f(12, 13, 8, 7, P.bat_body);
    f(13, 12, 6, 1, P.bat_body);   // top curve
    f(12, 19, 8, 1, '#4a3a62');     // belly lighter
    // Head (sits on body)
    f(13, 10, 6, 4, P.bat_body);
    f(12, 11, 8, 1, P.bat_body);
    // Ears
    f(11,  7, 2, 4, P.bat_wing);
    f(19,  7, 2, 4, P.bat_wing);
    f(12,  7, 1, 1, P.bat_body);
    f(19,  7, 1, 1, P.bat_body);
    // Red eyes
    f(13, 12, 2, 2, P.red_e);
    f(17, 12, 2, 2, P.red_e);
    f(14, 12, 1, 1, '#ff6060');     // eye catch-light
    f(18, 12, 1, 1, '#ff6060');
    // Feet dangling
    f(13, 20, 2, 3, P.bat_body);
    f(17, 20, 2, 3, P.bat_body);
  }

  private drawSpider(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    // Legs (4 pairs, extend further when walking)
    const legExt = isWalk && frame % 2 === 1 ? 2 : 0;
    // Left legs
    f(4,  14+legExt, 8, 2, P.spider_b);
    f(3,  18,        7, 2, P.spider_b);
    f(4,  22-legExt, 7, 2, P.spider_b);
    f(5,  26,        6, 2, P.spider_b);
    // Right legs
    f(20, 14+legExt, 8, 2, P.spider_b);
    f(21, 18,        7, 2, P.spider_b);
    f(21, 22-legExt, 7, 2, P.spider_b);
    f(21, 26,        6, 2, P.spider_b);
    // Abdomen (large, oval-ish)
    f(9,  18, 14, 12, P.spider_b);
    f(8,  20, 16, 8, P.spider_b);
    f(9,  18, 14,  1, '#4a3838');   // top shine
    // Abdomen stripe
    f(10, 22, 12, 2, '#3c2c2c');
    f(10, 24, 12, 1, '#3c2c2c');
    // Cephalothorax / head
    f(10, 12, 12, 7, '#3a3030');
    f(11, 12, 10, 1, '#5a4848');    // head shine
    // Multiple eyes (3 pairs)
    f(11, 14, 2, 2, P.red_e);
    f(15, 14, 2, 2, P.red_e);
    f(19, 14, 2, 2, P.red_e);
    f(12, 14, 1, 1, '#ff8080');
    f(16, 14, 1, 1, '#ff8080');
    f(20, 14, 1, 1, '#ff8080');
    // Mandibles
    f(11, 18, 2, 2, '#2a2020');
    f(19, 18, 2, 2, '#2a2020');
  }

  private drawSkeleton(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    // ── Skull ────────────────────────────────────────────────────────────────
    f(11, 7, 10, 9, P.bone);
    f(12, 7, 8,  1, P.bone_dk); // forehead shadow
    // Eye sockets (hollow)
    f(12, 10, 3, 3, P.outline);
    f(17, 10, 3, 3, P.outline);
    // Nasal cavity
    f(15, 12, 2, 2, '#3a3040');
    // Teeth
    f(12, 14, 2, 2, P.bone);
    f(14, 15, 2, 1, '#8a8880');
    f(16, 14, 2, 2, P.bone);
    f(18, 15, 2, 1, '#8a8880');
    // Jaw outline
    f(11, 15, 10, 1, P.bone_sh);
    // Crown of skull highlight
    f(12, 7,  8,  1, '#ece4d0');

    // ── Ribcage ──────────────────────────────────────────────────────────────
    f(12, 17, 8, 9, P.bone_dk);
    // Ribs (alternating lines)
    f(11, 18, 2, 1, P.bone);  f(19, 18, 2, 1, P.bone);
    f(10, 20, 2, 1, P.bone);  f(20, 20, 2, 1, P.bone);
    f(11, 22, 2, 1, P.bone);  f(19, 22, 2, 1, P.bone);
    f(12, 24, 2, 1, P.bone);  f(18, 24, 2, 1, P.bone);
    // Spine
    f(15, 17, 2, 9, '#b0a898');
    // Shoulder blades
    f(9, 17, 3, 3, P.bone_sh);
    f(20, 17, 3, 3, P.bone_sh);

    // ── Arm bones ───────────────────────────────────────────────────────────
    f(8, 19, 4, 2, P.bone_sh);   // left upper arm
    f(6, 21, 3, 7, P.bone_sh);   // left forearm
    f(22, 19, 4, 2, P.bone_sh);  // right upper arm
    f(23, 21, 3, 7, P.bone_sh);  // right forearm
    // Weapon (rusty sword in right hand)
    f(24, 27, 2, 8, '#7a6858');  // blade
    f(23, 27, 4, 1, P.bone_sh);  // crossguard
    f(24, 26, 2, 1, '#a08060');  // pommel

    // ── Pelvis + legs ────────────────────────────────────────────────────────
    f(11, 26, 10, 2, P.bone_dk);  // pelvis
    const lp = isWalk ? frame : 0;
    const ll = lp === 2 ? 12 : lp === 0 ? 8 : 10;
    const rl = lp === 2 ? 8 : lp === 0 ? 12 : 10;
    f(12, 28, 3, ll, P.bone_sh);  // left femur+tibia
    f(17, 28, 3, rl, P.bone_sh);  // right
    // Foot bones
    f(11, 28+ll-1, 4, 2, P.bone_sh);
    f(17, 28+rl-1, 4, 2, P.bone_sh);
  }

  private drawGolem(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    // ── Chunky rock head ─────────────────────────────────────────────────────
    f(9, 5, 14, 11, P.stone_dk);
    f(10, 5, 12,  1, P.stone);     // top highlight
    f(9,  5,  1, 11, P.stone);     // left highlight
    // Stone texture on head
    f(10, 7, 5, 4, P.stone);
    f(17, 6, 4, 5, P.stone);
    f(10, 7, 5, 1, P.stone_hi);
    f(17, 6, 4, 1, P.stone_hi);
    // Orange glowing eyes
    f(11, 10, 3, 3, '#ee7700');
    f(18, 10, 3, 3, '#ee7700');
    f(12, 11, 1, 1, '#ffaa40');    // bright center
    f(19, 11, 1, 1, '#ffaa40');
    // Cracks on head
    f(15, 6,  1, 9, '#0a0816');
    f(9,  11, 5, 1, '#0a0816');

    // ── Wide slab body ───────────────────────────────────────────────────────
    f(8, 16, 16, 12, P.stone_dk);
    f(8, 16, 16,  1, P.stone);     // top
    f(8, 16,  1, 12, P.stone);     // left
    // Boulder chest stones
    f(9, 17, 6, 5, P.stone);
    f(17, 17, 6, 5, P.stone);
    f(9, 17, 6, 1, P.stone_hi);
    f(17, 17, 6, 1, P.stone_hi);
    f(10, 22, 12, 5, P.stone);
    f(10, 22, 12, 1, P.stone_hi);
    // Body crack
    f(15, 17, 2, 11, '#0a0816');

    // ── Heavy arms ───────────────────────────────────────────────────────────
    f(4, 17, 5, 10, P.stone_dk);   // left arm
    f(4, 17, 5,  1, P.stone);
    f(4, 17, 1, 10, P.stone);
    f(23, 17, 5, 10, P.stone_dk);  // right arm
    f(23, 17, 5,  1, P.stone);
    // Fist
    f(3, 26, 7, 6, P.stone_dk);
    f(22, 26, 7, 6, P.stone_dk);
    f(3, 26, 7, 1, P.stone);
    f(22, 26, 7, 1, P.stone);

    // ── Stubby legs ──────────────────────────────────────────────────────────
    const lp = isWalk ? frame : 0;
    const sh = lp === 2 ? 1 : lp === 0 ? -1 : 0; // stomp offset
    f(9,  28, 7, 10+sh, P.stone_dk);
    f(16, 28, 7, 10-sh, P.stone_dk);
    f(9,  28, 7, 1, P.stone);
    f(16, 28, 7, 1, P.stone);
  }

  private drawTroll(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    // ── Big ugly head ────────────────────────────────────────────────────────
    f(9, 5, 14, 11, P.troll_sk);
    f(10, 5, 12,  1, '#6a7848');    // top highlight
    f(9,  5,  1, 11, '#6a7848');    // left highlight
    // Low brow
    f(9, 8, 14, 3, P.troll_dk);
    // Eyes (yellow)
    f(11, 10, 3, 3, '#e8cc20');
    f(18, 10, 3, 3, '#e8cc20');
    f(12, 11, 1, 1, '#ffee50');     // bright
    f(19, 11, 1, 1, '#ffee50');
    // Boar tusks
    f(12, 15, 2, 4, '#d8c8a0');
    f(18, 15, 2, 4, '#d8c8a0');
    f(11, 14, 10, 2, P.troll_sk);   // mouth/chin
    // Nostrils
    f(14, 13, 2, 1, P.troll_dk);
    f(16, 13, 2, 1, P.troll_dk);

    // ── Hunched body ─────────────────────────────────────────────────────────
    f(10, 16, 12, 11, P.troll_sk);
    f(10, 16, 12,  1, '#6a7848');
    f(10, 16,  1, 11, '#6a7848');
    // Belly
    f(11, 20, 10, 7, '#4e5c38');
    // Crude loincloth
    f(11, 26, 10, 3, '#7a6050');
    f(11, 26, 10, 1, '#9a8070');

    // ── Long arms (knuckle-dragging) ─────────────────────────────────────────
    f(5, 17, 6, 3, P.troll_sk);     // left shoulder
    f(3, 20, 5, 8, P.troll_sk);     // left forearm
    f(21, 17, 6, 3, P.troll_sk);    // right shoulder
    f(24, 20, 5, 8, P.troll_sk);    // right forearm
    // Knuckles on ground
    f(2, 28, 6, 4, P.troll_dk);
    f(24, 28, 6, 4, P.troll_dk);
    // Club in right hand
    f(25, 18, 3, 14, P.brown);
    f(24, 18, 5,  2, P.brown_dk);   // club head (wider)
    f(23, 17, 7,  2, P.brown_dk);
    f(24, 16, 5,  2, P.brown);

    // ── Thick legs ───────────────────────────────────────────────────────────
    const lp = isWalk ? frame : 0;
    const ll = lp === 2 ? 11 : lp === 0 ? 9 : 10;
    const rl = lp === 2 ? 9  : lp === 0 ? 11 : 10;
    f(10, 29, 5, ll, P.troll_sk);
    f(17, 29, 5, rl, P.troll_sk);
    // Foot
    f(9,  29+ll-2, 7, 3, P.troll_dk);
    f(16, 29+rl-2, 7, 3, P.troll_dk);
  }

  // ── Goblin warrior ────────────────────────────────────────────────────────────
  private drawGoblin(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    // Big floppy ears
    f(7,  14, 4, 6, '#2a5828');
    f(8,  14, 2, 5, '#3a7038');
    f(21, 14, 4, 6, '#2a5828');
    f(21, 14, 2, 5, '#3a7038');
    // Rusty iron skullcap helmet
    f(11, 11, 10, 7, '#7a6040');
    f(11, 11, 10, 1, '#9a8060'); // crown highlight
    f(11, 11,  1, 7, '#9a8060'); // left catch-light
    // Rivets on helmet
    f(13, 12, 1, 1, '#b0a070');
    f(18, 12, 1, 1, '#b0a070');
    // Face (green)
    f(12, 13, 8, 7, '#3a7034');
    f(12, 13, 8, 1, '#4a8844'); // forehead highlight
    // Beady yellow eyes
    f(13, 15, 3, 2, '#e8c820');
    f(18, 15, 3, 2, '#e8c820');
    f(14, 15, 1, 1, '#ffee50'); // eye shine
    f(19, 15, 1, 1, '#ffee50');
    // Big warty nose
    f(15, 17, 2, 2, '#2a5828');
    f(15, 17, 2, 1, '#3a7034');
    // Jagged grin showing teeth
    f(13, 19, 2, 1, '#d0c898');
    f(16, 19, 3, 1, '#d0c898');
    // Patchwork leather torso (squat)
    f(11, 20, 10, 8, '#6a5030');
    f(11, 20, 10, 1, '#8a7050');
    f(11, 20,  1, 8, '#8a7050');
    // Crude iron shoulder pads
    f(10, 20, 2, 4, '#5a5a64');  f(10, 20, 2, 1, '#7a7a84');
    f(20, 20, 2, 4, '#5a5a64');  f(20, 20, 2, 1, '#7a7a84');
    // Belt with pouches
    f(11, 27, 10, 1, '#4a3818');
    f(15, 26, 2, 3, '#3a2808'); // belt pouch
    // Short rusty sword at right hip
    f(21, 22, 1, 6, '#8a7a60'); // blade (corroded)
    f(20, 22, 3, 1, '#a07030'); // rusty crossguard
    f(21, 21, 1, 1, '#706050'); // pommel
    // Stubby legs
    const lp = isWalk ? frame : 0;
    const ll = lp === 2 ? 12 : lp === 0 ? 8 : 10;
    const rl = lp === 2 ? 8  : lp === 0 ? 12 : 10;
    f(11, 28, 4, ll, '#4a3020');
    f(17, 28, 4, rl, '#4a3020');
    // Bare green feet with toes
    f(10, 28+ll-2, 6, 3, '#3a7034');
    f(17, 28+rl-2, 6, 3, '#3a7034');
    f(10, 28+ll,   2, 1, '#2a5828'); // toe nub left
    f(14, 28+ll,   2, 1, '#2a5828');
    f(17, 28+rl,   2, 1, '#2a5828'); // toe nub right
    f(21, 28+rl,   2, 1, '#2a5828');
  }

  // ── Goblin shaman ─────────────────────────────────────────────────────────────
  private drawGoblinShaman(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    // Tall bone-and-skull staff hat
    f(14, 3,  4, 7, '#c8c0a0'); // hat shaft (bone)
    f(12, 3,  8, 1, '#e0d8b8'); // hat top edge
    // Skull atop the hat
    f(13, 4,  6, 4, '#d8d0b8');
    f(13, 5,  6, 1, '#ece4d0'); // skull crown
    f(14, 6,  1, 2, '#3a3040'); // left socket
    f(17, 6,  1, 2, '#3a3040'); // right socket
    f(15, 8,  2, 1, '#3a3040'); // nose gap
    // Hat brim (wider)
    f(11, 9, 10, 2, '#b8b098');
    f(11, 9, 10, 1, '#d0c8a8'); // brim highlight
    // Big goblin ears
    f(7, 15, 4, 6, '#2a5828');
    f(8, 15, 2, 5, '#3a7038');
    f(21, 15, 4, 6, '#2a5828');
    f(21, 15, 2, 5, '#3a7038');
    // Green face with magical glow
    f(12, 11, 8, 8, '#3a7034');
    f(12, 11, 8, 1, '#4a9044');
    // Glowing green eyes (arcane)
    f(13, 14, 3, 2, '#30dd30');
    f(18, 14, 3, 2, '#30dd30');
    f(14, 14, 1, 1, '#aaffaa'); // bright arcane core
    f(19, 14, 1, 1, '#aaffaa');
    // Green glow halo around eyes
    f(12, 14, 1, 2, '#1a9020');
    f(16, 14, 2, 1, '#1a9020');
    f(20, 14, 1, 2, '#1a9020');
    // Bone necklace
    f(13, 19, 1, 1, '#d0c898');  f(15, 19, 1, 1, '#d0c898');
    f(17, 19, 1, 1, '#d0c898');  f(19, 19, 1, 1, '#d0c898');
    // Animal-skin robe
    f(11, 20, 10, 9, '#4a3828');
    f(11, 20, 10, 1, '#6a5848');
    f(11, 20,  1, 9, '#6a5848');
    // Robe rune markings
    f(14, 22, 4, 1, '#30bb30');
    f(15, 23, 2, 2, '#30bb30');
    f(14, 25, 4, 1, '#30bb30');
    // Long draping sleeves
    f(9,  21, 2, 6, '#3a2818');
    f(21, 21, 2, 6, '#3a2818');
    // Staff in left hand with glowing orb
    f(7, 12, 2, 18, '#6a4820');    // staff shaft
    f(5, 10, 6,  5, '#1acc1a');    // orb
    f(6, 11, 4,  3, '#50ff50');    // orb bright center
    f(7, 11, 2,  1, '#ccffcc');    // orb core
    // Robe hem and short legs (mostly hidden)
    const lp = isWalk ? frame : 0;
    const ll = lp === 2 ? 10 : lp === 0 ? 8 : 9;
    const rl = lp === 2 ? 8  : lp === 0 ? 10 : 9;
    f(12, 29, 4, ll, '#3a2818');
    f(16, 29, 4, rl, '#3a2818');
    f(11, 29+ll-2, 5, 3, '#3a7034'); // bare green feet
    f(16, 29+rl-2, 5, 3, '#3a7034');
  }

  // ── Floor 2 enemy textures ────────────────────────────────────────────────────

  private drawTreant(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, _frame: number): void {
    // Trunk legs
    const shift = isWalk ? (_frame % 2 === 1 ? 1 : -1) : 0;
    f(10, 28, 5, 12+shift, '#4a3018');
    f(17, 28, 5, 12-shift, '#4a3018');
    f(10, 28, 5, 1, '#5a4020');
    f(17, 28, 5, 1, '#5a4020');
    // Bark body
    f(9, 16, 14, 13, '#4a3018');
    f(9, 16, 14, 1, '#6a4820');
    f(9, 16, 1, 13, '#6a4820');
    f(11, 17, 10, 11, '#5a3c1e');
    // Root arm left
    f(4, 17, 6, 3, '#4a3018'); f(3, 20, 5, 8, '#3a2410');
    // Root arm right
    f(22, 17, 6, 3, '#4a3018'); f(24, 20, 5, 8, '#3a2410');
    // Leafy canopy
    f(6, 4, 20, 14, '#1a3a10');
    f(8, 3, 16, 15, '#1a3a10');
    f(8, 4, 16, 13, '#2a5020');
    f(10, 4, 12, 11, '#3a6828');
    f(11, 3, 10, 10, '#4a7a30');
    f(13, 2,  6,  8, '#5a8a38');
    // Eye knots
    f(12, 10, 3, 2, '#6a3a10');
    f(17, 10, 3, 2, '#6a3a10');
    f(13, 10, 1, 1, '#ee6010');
    f(18, 10, 1, 1, '#ee6010');
  }

  private drawForestWisp(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const pulse = isWalk && frame % 2 === 1 ? 1 : 0;
    // Outer glow
    f(7-pulse, 12-pulse, 18+pulse*2, 18+pulse*2, '#0a3010');
    f(8,  14, 16, 14, '#0e4818');
    // Mid glow ring
    f(9,  15, 14, 12, '#186020');
    f(10, 14, 12, 14, '#186020');
    // Core
    f(11, 16, 10, 10, '#28a030');
    f(12, 15,  8, 12, '#28a030');
    f(12, 16,  8, 10, '#40c840');
    // Bright center
    f(13, 17,  6,  8, '#70e860');
    f(14, 17,  4,  8, '#a0ff90');
    f(14, 18,  4,  6, '#ffffff');
    // Wispy trails
    f(8, 26, 2, 6, '#0e4818');
    f(22, 26, 2, 6, '#0e4818');
    f(15, 28, 2, 5, '#186020');
    f(11, 30, 2, 4, '#0e4818');
    f(19, 29, 2, 4, '#0e4818');
  }

  private drawVineSnare(f: (x:number,y:number,w:number,h:number,c:string)=>void, _isWalk: boolean, frame: number): void {
    const spread = frame % 2 === 1 ? 2 : 0;
    // Ground root mass
    f(6, 24, 20, 10, '#2a3a14');
    f(4, 26, 24, 8, '#2a3a14');
    // Vine tendrils radiating
    f(8-spread, 14, 2, 12, '#3a5a1a');
    f(14, 10, 4, 16, '#3a5a1a');
    f(22+spread, 14, 2, 12, '#3a5a1a');
    f(6-spread, 20, 2, 8, '#4a7022');
    f(24+spread, 20, 2, 8, '#4a7022');
    // Leafy top cluster
    f(10, 8, 12, 8, '#2e5018');
    f(12, 6, 8, 10, '#2e5018');
    f(12, 7, 8,  8, '#3e6820');
    f(13, 6, 6,  7, '#4e7828');
    // Eyes (red trap signal)
    f(12, 11, 3, 2, '#cc2020');
    f(17, 11, 3, 2, '#cc2020');
    f(13, 11, 1, 1, '#ff4040');
    f(18, 11, 1, 1, '#ff4040');
  }

  private drawGhoul(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const lp = isWalk ? frame : 0;
    const ll = lp === 2 ? 12 : lp === 0 ? 8 : 10;
    const rl = lp === 2 ? 8  : lp === 0 ? 12 : 10;
    // Legs (decayed)
    f(11, 28, 4, ll, '#2e3828'); f(17, 28, 4, rl, '#2e3828');
    f(10, 28+ll-2, 6, 3, '#222c20'); f(17, 28+rl-2, 6, 3, '#222c20');
    // Hunched body
    f(10, 17, 12, 11, '#2e3828');
    f(10, 17, 12, 1, '#3e4838');
    f(10, 17, 1, 11, '#3e4838');
    f(11, 18, 10, 9, '#343e2e');
    // Clawed long arms
    f(5, 18, 6, 2, '#2e3828'); f(3, 20, 5, 8, '#2e3828');
    f(21, 18, 6, 2, '#2e3828'); f(24, 20, 5, 8, '#2e3828');
    // Claw fingers
    f(2, 27, 2, 3, '#1a2418'); f(5, 28, 2, 3, '#1a2418');
    f(25, 27, 2, 3, '#1a2418'); f(28, 28, 2, 3, '#1a2418');
    // Skull-like head
    f(11, 8, 10, 10, '#2a3420');
    f(12, 7,  8, 11, '#2a3420');
    f(12, 8,  8,  9, '#343e28');
    // Sunken glowing eyes
    f(12, 12, 3, 3, '#00cc00');
    f(17, 12, 3, 3, '#00cc00');
    f(13, 12, 1, 1, '#80ff80');
    f(18, 12, 1, 1, '#80ff80');
    // Gaping mouth
    f(13, 16, 6, 2, '#1a2418');
    f(14, 16, 2, 1, '#808060');
    f(17, 16, 2, 1, '#808060');
  }

  private drawWraith(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const drift = isWalk && frame % 2 === 1 ? 1 : 0;
    // Wispy lower body (fades out)
    f(12+drift, 28, 8, 8, '#150f20');
    f(11, 26, 10, 6, '#1a1228');
    f(10, 24, 12, 6, '#201830');
    f(10, 22, 12, 6, '#261e3a');
    // Dark robed upper
    f(9, 14, 14, 12, '#1c1430');
    f(9, 14, 14, 1, '#2c2045');
    f(9, 14, 1, 12, '#2c2045');
    f(10, 15, 12, 10, '#221838');
    // Arm wisps
    f(4, 15, 5, 2, '#201830'); f(3, 17, 4, 7, '#1a1228');
    f(23, 15, 5, 2, '#201830'); f(25, 17, 4, 7, '#1a1228');
    // Shadow head
    f(11, 7, 10, 8, '#160e28');
    f(12, 6, 8, 9, '#1c1230');
    f(12, 7, 8, 7, '#221838');
    // Burning red eyes
    f(12, 10, 3, 3, '#cc0000');
    f(17, 10, 3, 3, '#cc0000');
    f(13, 10, 1, 2, '#ff4040');
    f(18, 10, 1, 2, '#ff4040');
    f(13, 10, 1, 1, '#ffffff');
    f(18, 10, 1, 1, '#ffffff');
  }

  private drawBoneGolem(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    // Massive undead construct (bone colored)
    const lp = isWalk ? frame : 0;
    const sh = lp === 2 ? 1 : lp === 0 ? -1 : 0;
    // Skull head (large)
    f(8, 4, 16, 12, '#c8c0a0');
    f(9, 4, 14, 1, '#ddd8c0');
    f(8, 4, 1, 12, '#ddd8c0');
    f(10, 6, 5, 4, '#2a2430'); // left eye socket
    f(17, 6, 5, 4, '#2a2430'); // right socket
    f(13, 9, 4, 2, '#2a2430'); // nose
    f(10, 12, 12, 2, '#2a2430'); // jaw line
    f(11, 13, 2, 2, '#c8c0a0'); f(14, 13, 2, 2, '#c8c0a0'); f(17, 13, 2, 2, '#c8c0a0'); // teeth
    // Ribcage body
    f(8, 16, 16, 13, '#b0a890');
    f(8, 16, 16, 1, '#ccc4a8');
    f(6, 17, 2, 2, '#b0a890'); f(24, 17, 2, 2, '#b0a890'); // shoulder bones
    for (let i = 0; i < 4; i++) {
      f(7, 18+i*3, 4, 2, '#c8c0a0'); f(21, 18+i*3, 4, 2, '#c8c0a0'); // ribs
    }
    f(14, 16, 4, 13, '#a09880'); // spine
    // Heavy bone arms
    f(3, 16, 6, 3, '#b0a890'); f(2, 19, 5, 9, '#b0a890');
    f(23, 16, 6, 3, '#b0a890'); f(25, 19, 5, 9, '#b0a890');
    f(1, 27, 7, 4, '#a09880'); f(24, 27, 7, 4, '#a09880'); // bone fists
    // Pillar legs
    f(9, 29, 6, 10+sh, '#b0a890'); f(17, 29, 6, 10-sh, '#b0a890');
    f(9, 29, 6, 1, '#ccc4a8'); f(17, 29, 6, 1, '#ccc4a8');
  }

  private drawFrogWarrior(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const squat = isWalk && frame % 2 === 1 ? 2 : 0;
    // Squat frog legs
    f(7, 30-squat, 6, 8+squat, '#2a6030');
    f(19, 30-squat, 6, 8+squat, '#2a6030');
    f(5, 32+squat, 8, 4, '#224e28'); // feet
    f(19, 32+squat, 8, 4, '#224e28');
    // Belly
    f(10, 18, 12, 14, '#2a6030');
    f(10, 18, 12, 1, '#3a7840');
    f(11, 19, 10, 12, '#3a7840');
    f(11, 22, 10, 8, '#5a9a58'); // lighter belly
    // Arms with weapon
    f(6, 18, 5, 2, '#2a6030'); f(4, 20, 4, 8, '#224e28');
    f(21, 18, 5, 2, '#2a6030'); f(23, 20, 4, 8, '#224e28');
    f(23, 15, 2, 12, '#9a8060'); // spear shaft
    f(22, 13, 4, 3, '#c0a870'); // spear tip
    // Big frog head
    f(9, 8, 14, 11, '#2a6030');
    f(10, 7, 12, 12, '#2a6030');
    f(10, 8, 12, 10, '#3a7840');
    // Bulging eyes on top
    f(9, 7, 5, 5, '#3a7840'); f(18, 7, 5, 5, '#3a7840');
    f(10, 7, 3, 3, '#e0d040'); f(19, 7, 3, 3, '#e0d040');
    f(11, 7, 1, 1, '#2a2020'); f(20, 7, 1, 1, '#2a2020'); // pupils
    // Wide mouth
    f(10, 16, 12, 2, '#1a3818');
    f(11, 16, 2, 1, '#d0c890'); f(14, 16, 2, 1, '#d0c890'); f(17, 16, 2, 1, '#d0c890'); // teeth
  }

  private drawSwampSlug(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const stretch = isWalk && frame % 2 === 1 ? 2 : 0;
    // Main oval body
    f(5, 18-stretch, 22, 18+stretch*2, '#4a5828');
    f(3, 20, 26, 14, '#4a5828');
    f(4, 19, 24, 16, '#5a6830');
    f(5, 20, 22, 14, '#6a7838');
    // Slime trail
    f(8, 34, 16, 4, '#3a4a20');
    f(10, 36, 12, 4, '#2a3a18');
    f(12, 38, 8, 4, '#1e2e10');
    // Head (front bulge)
    f(9, 14, 14, 6, '#5a6830');
    f(10, 12, 12, 6, '#6a7838');
    // Antennae
    f(12, 8, 2, 6, '#3a4a20');
    f(18, 8, 2, 6, '#3a4a20');
    f(11, 7, 4, 3, '#5a6830'); // antenna tip
    f(17, 7, 4, 3, '#5a6830');
    f(12, 7, 2, 2, '#f0b020'); // antenna eye left
    f(18, 7, 2, 2, '#f0b020'); // antenna eye right
    // Body sheen
    f(8, 20, 16, 2, '#7a8848');
    f(10, 22, 12, 2, '#6a7838');
  }

  private drawWaterSerpent(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const wave = isWalk && frame % 2 === 1 ? 2 : -2;
    // Coiled body segments
    f(8+wave,  10, 16, 4, '#1a5060');
    f(4,       18, 16, 4, '#1a5060');
    f(12-wave, 26, 16, 4, '#1a5060');
    // Body highlights
    f(9+wave,  10, 14, 2, '#2a7080');
    f(5,       18, 14, 2, '#2a7080');
    f(13-wave, 26, 14, 2, '#2a7080');
    // Head
    f(10, 4, 12, 8, '#1a5060');
    f(11, 3, 10, 9, '#1a5060');
    f(11, 4, 10, 7, '#2a7080');
    // Fangs
    f(13, 11, 2, 3, '#c8d0b0'); f(17, 11, 2, 3, '#c8d0b0');
    // Slit eyes
    f(12, 7, 3, 2, '#f0c020'); f(17, 7, 3, 2, '#f0c020');
    f(13, 7, 1, 1, '#2a1010'); f(18, 7, 1, 1, '#2a1010');
    // Tail tip
    f(20-wave, 30, 4, 8, '#1a5060');
    f(21-wave, 36, 2, 6, '#154050');
  }

  private drawRockCrab(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const legShift = isWalk && frame % 2 === 1 ? 1 : -1;
    // Shell (wide and flat)
    f(4, 14, 24, 14, '#6a5840');
    f(2, 16, 28, 10, '#6a5840');
    f(3, 15, 26, 12, '#7a6850');
    f(4, 16, 24, 10, '#8a7860');
    f(5, 17, 22, 8, '#9a8870'); // shell top highlight
    // Rock texture on shell
    f(6, 18, 4, 3, '#7a6850'); f(12, 17, 5, 4, '#7a6850'); f(18, 18, 5, 3, '#7a6850');
    f(7, 20, 2, 2, '#6a5840'); f(16, 19, 3, 3, '#6a5840'); f(23, 20, 2, 2, '#6a5840');
    // Pincers
    f(1, 13, 6, 4, '#7a6850'); f(0, 11, 7, 4, '#8a7860'); f(0, 10, 4, 5, '#9a8870'); // left pincer
    f(25, 13, 6, 4, '#7a6850'); f(25, 11, 7, 4, '#8a7860'); f(28, 10, 4, 5, '#9a8870'); // right pincer
    // Legs (alternating shift)
    for (let i = 0; i < 3; i++) {
      f(4+i*2, 26+legShift, 2, 8, '#5a4830');
      f(22-i*2, 26-legShift, 2, 8, '#5a4830');
    }
    // Eyes on stalks
    f(11, 10, 2, 5, '#5a4830'); f(19, 10, 2, 5, '#5a4830');
    f(10, 9, 4, 3, '#5a4830'); f(18, 9, 4, 3, '#5a4830');
    f(11, 9, 2, 2, '#f0c820'); f(19, 9, 2, 2, '#f0c820');
    f(11, 9, 1, 1, '#1a1010'); f(19, 9, 1, 1, '#1a1010');
  }

  private drawStoneImp(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const lp = isWalk ? frame : 0;
    const ll = lp === 2 ? 10 : lp === 0 ? 7 : 9;
    const rl = lp === 2 ? 7  : lp === 0 ? 10 : 9;
    // Stubby legs
    f(12, 28, 4, ll, '#5a5068'); f(17, 28, 4, rl, '#5a5068');
    f(11, 28+ll-2, 5, 3, '#484060'); f(17, 28+rl-2, 5, 3, '#484060');
    // Compact rocky body
    f(10, 17, 12, 12, '#5a5068');
    f(10, 17, 12, 1, '#6a6080');
    f(10, 17, 1, 12, '#6a6080');
    f(11, 18, 10, 10, '#645e74');
    // Small horn arms
    f(6, 18, 5, 2, '#5a5068'); f(5, 20, 4, 6, '#5a5068');
    f(21, 18, 5, 2, '#5a5068'); f(23, 20, 4, 6, '#5a5068');
    // Rock tail
    f(20, 24, 3, 6, '#5a5068'); f(22, 29, 3, 5, '#484060');
    // Angular head
    f(10, 8, 12, 10, '#5a5068');
    f(11, 7, 10, 11, '#5a5068');
    f(11, 8, 10, 9, '#645e74');
    // Horns
    f(11, 5, 3, 4, '#484060'); f(18, 5, 3, 4, '#484060');
    f(12, 4, 2, 2, '#5a5068'); f(18, 4, 2, 2, '#5a5068');
    // Glowing orange eyes
    f(12, 12, 3, 2, '#ee6600');
    f(17, 12, 3, 2, '#ee6600');
    f(13, 12, 1, 1, '#ffaa40');
    f(18, 12, 1, 1, '#ffaa40');
  }

  private drawCaveDrake(f: (x:number,y:number,w:number,h:number,c:string)=>void, isWalk: boolean, frame: number): void {
    const lp = isWalk ? frame : 0;
    const ll = lp === 2 ? 11 : lp === 0 ? 8 : 10;
    const rl = lp === 2 ? 8  : lp === 0 ? 11 : 10;
    // Thick legs
    f(9, 27, 6, ll, '#3a3a48'); f(17, 27, 6, rl, '#3a3a48');
    f(8, 27+ll-2, 8, 4, '#2a2a38'); f(17, 27+rl-2, 8, 4, '#2a2a38'); // claw feet
    // Scaled body
    f(8, 15, 16, 13, '#3a3a48');
    f(8, 15, 16, 1, '#4a4a5a');
    f(8, 15, 1, 13, '#4a4a5a');
    f(9, 16, 14, 11, '#44445a');
    // Scale pattern
    for (let i = 0; i < 3; i++) {
      f(10+i*4, 17+i*3, 3, 2, '#4a4a58');
      f(12+i*4, 18+i*3, 3, 2, '#4a4a58');
    }
    // Wings (folded, dorsal)
    f(6, 14, 4, 12, '#2c2c3c'); f(22, 14, 4, 12, '#2c2c3c');
    f(5, 14, 2, 14, '#222230'); f(24, 14, 2, 14, '#222230');
    // Tail
    f(22, 22, 4, 5, '#3a3a48'); f(25, 26, 3, 5, '#2a2a38'); f(27, 30, 2, 5, '#1e1e28');
    // Dragon head
    f(8, 5, 16, 12, '#3a3a48');
    f(9, 4, 14, 13, '#3a3a48');
    f(9, 5, 14, 11, '#44445a');
    // Horns
    f(10, 2, 3, 5, '#2a2a38'); f(19, 2, 3, 5, '#2a2a38');
    f(11, 1, 2, 3, '#3a3a48'); f(19, 1, 2, 3, '#3a3a48');
    // Snout
    f(10, 14, 12, 4, '#3a3a48'); f(10, 15, 12, 2, '#44445a');
    f(11, 16, 2, 2, '#c8c0a0'); f(18, 16, 2, 2, '#c8c0a0'); // fangs
    // Fiery eyes
    f(11, 9, 4, 3, '#cc5500'); f(17, 9, 4, 3, '#cc5500');
    f(12, 9, 2, 2, '#ff8800'); f(18, 9, 2, 2, '#ff8800');
    f(12, 9, 1, 1, '#ffcc00'); f(18, 9, 1, 1, '#ffcc00');
  }

  // ── Effect textures ───────────────────────────────────────────────────────────
  private buildEffectTextures(): void {
    // Slash (32×32)
    const slash = this.textures.createCanvas('slash', 32, 32);
    if (slash) {
      const ctx = slash.getContext();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(13, 0, 6, 32);
      ctx.fillRect(0, 13, 32, 6);
      ctx.fillStyle = 'rgba(255,220,100,0.6)';
      ctx.fillRect(14, 1, 4, 30);
      ctx.fillRect(1, 14, 30, 4);
      slash.refresh();
    }

    // Arrow (20×6)
    const arrow = this.textures.createCanvas('arrow', 20, 6);
    if (arrow) {
      const ctx = arrow.getContext();
      ctx.fillStyle = '#c8a060';
      ctx.fillRect(0, 2, 14, 2);
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(14, 0, 6, 6);
      arrow.refresh();
    }

    // Fireball (12×12) — more organic flame shape
    const fire = this.textures.createCanvas('fireball', 12, 12);
    if (fire) {
      const ctx = fire.getContext();
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(4, 0, 4, 12);
      ctx.fillRect(2, 2, 8, 8);
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(4, 1, 4, 10);
      ctx.fillRect(3, 2, 6, 8);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(5, 3, 2, 6);
      ctx.fillRect(4, 4, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 4, 2, 2);
      fire.refresh();
    }

    // ── Trap textures (armed + triggered variants) ─────────────────────────────
    // spike: subtle spike tips on dark floor
    this.buildTrap32('trap_spike', ctx => {
      const f = mk(ctx);
      f(0, 0, 32, 32, '#1a1726');
      // Four spike clusters
      for (const sx of [6, 13, 19, 26]) {
        f(sx,   18, 3, 12, '#8a8090');
        f(sx+1, 14, 1, 18, '#c0b8c8');
        f(sx,   18, 1,  8, '#6a6070');
      }
      f(0, 30, 32, 2, '#221e33');
    });
    this.buildTrap32('trap_spike_hit', ctx => {
      const f = mk(ctx);
      f(0, 0, 32, 32, '#1a1726');
      for (const sx of [6, 13, 19, 26]) {
        f(sx,    4, 3, 26, '#9a909a');
        f(sx+1,  0, 1, 32, '#d0c8d0');
      }
      // Blood splatter
      f(8, 6, 2, 3, '#cc2020'); f(16, 4, 2, 2, '#cc2020');
      f(22, 7, 2, 3, '#cc2020'); f(4, 12, 2, 2, '#991818');
    });

    // alarm: tripwire + bell
    this.buildTrap32('trap_alarm', ctx => {
      const f = mk(ctx);
      f(0, 0, 32, 32, '#1a1726');
      f(0, 16, 32, 1, '#c0a850'); // tripwire
      f(12, 5, 8, 2, '#d6ae4a');  // bell top knob
      f(11, 7, 10, 7, '#d6ae4a'); // bell body
      f(9,  12, 14, 3, '#d6ae4a');// bell flare
      f(11, 7, 10, 1, '#f0d070'); // highlight
      f(14, 14, 4, 2, '#9a7020'); // clapper
    });
    this.buildTrap32('trap_alarm_hit', ctx => {
      const f = mk(ctx);
      f(0, 0, 32, 32, '#1a1726');
      f(13, 4, 8, 2, '#f0c840');
      f(12, 6, 10, 7, '#f8d848'); f(10, 11, 14, 3, '#f8d848');
      f(12, 6, 10, 1, '#fff888'); // bright ring
      f(14, 13, 4, 2, '#9a7020');
      // Vibration lines
      f(8, 5, 1, 4, '#f0d060');  f(23, 5, 1, 4, '#f0d060');
      f(6, 8, 1, 5, '#d0b040');  f(25, 8, 1, 5, '#d0b040');
      // Alert marker
      f(15, 17, 2, 7, '#ff4444'); f(15, 26, 2, 2, '#ff4444');
    });

    // net: rope crosshatch
    this.buildTrap32('trap_net', ctx => {
      const f = mk(ctx);
      f(0, 0, 32, 32, '#1a1726');
      for (let i = 0; i < 32; i += 5) {
        f(i, 0, 1, 32, '#7a6038'); f(0, i, 32, 1, '#7a6038');
      }
      for (let y = 0; y < 32; y += 5) for (let x = 0; x < 32; x += 5) f(x, y, 2, 2, '#aa8850');
    });
    this.buildTrap32('trap_net_hit', ctx => {
      const f = mk(ctx);
      f(0, 0, 32, 32, '#1a1726');
      for (let i = 0; i < 32; i += 5) {
        f(i, 0, 1, 32, '#9a8050'); f(0, i, 32, 1, '#9a8050');
      }
      for (let y = 0; y < 32; y += 5) for (let x = 0; x < 32; x += 5) f(x, y, 2, 2, '#c0a870');
      // Blue slow indicator
      f(10, 10, 12, 12, 'rgba(80,120,220,0.45)');
      f(13, 13,  6,  6, '#6688cc');
    });
  }

  /** Build a 32×32 single-frame canvas texture. */
  private buildTrap32(key: string, drawFn: (ctx: CanvasRenderingContext2D) => void): void {
    const tex = this.textures.createCanvas(key, 32, 32);
    if (tex) { drawFn(tex.getContext()); tex.refresh(); }
  }

  // ── Town decoration sprites ───────────────────────────────────────────────────
  private buildTownDecorations(): void {
    // ── town_tree (32×32) — gnarled dark fantasy tree ────────────────────────
    this.buildDeco32('town_tree', ctx => {
      const f = mk(ctx);
      f(4,  22, 24,  8, '#0a0e06'); // deep shadow under canopy
      f(3,   6, 26, 20, '#10180a'); // outer canopy — nearly black
      f(5,   4, 22, 24, '#10180a');
      f(5,   6, 22, 20, '#14200c'); // mid canopy
      f(7,   5, 18, 22, '#14200c');
      f(7,   7, 18, 18, '#1a2a10'); // inner canopy
      f(9,   6, 14, 20, '#1a2a10');
      f(9,   9, 14, 14, '#1e3010'); // lit inner
      f(11,  8, 10, 16, '#1e3010');
      f(12, 10,  8, 10, '#243614'); // top highlight — very muted
      f(13,  9,  5,  5, '#283c16'); // barely lighter
      f(13, 12,  6,  8, '#2a1c0a'); // trunk
      f(14, 13,  4,  6, '#3a2010');
      f(15, 14,  2,  4, '#4a2810');
    });

    // ── town_tree_pine (32×32) — dark conifer ─────────────────────────────────
    this.buildDeco32('town_tree_pine', ctx => {
      const f = mk(ctx);
      f(5,  24, 22,  6, '#080c06');
      f(6,  18, 20,  8, '#0e1a0a');
      f(8,  14, 16, 10, '#121e0c'); // lower tier
      f(10, 10, 12, 10, '#162410'); // mid tier
      f(12,  7,  8,  9, '#182810'); // upper tier
      f(13,  4,  6,  8, '#1c2e12'); // top tier
      f(14,  2,  4,  5, '#1e3012');
      f(15,  1,  2,  3, '#243614'); // tip
      f(13, 13,  6,  5, '#0e1808');
      f(14,  8,  4,  4, '#141e0c');
    });

    // ── town_lamp (32×32) — iron street lamp ─────────────────────────────────
    this.buildDeco32('town_lamp', ctx => {
      const f = mk(ctx);
      // Stone base
      f(10, 24, 12, 8, '#5a5870');
      f(11, 23, 10, 2, '#7a7890');
      f(12, 22,  8, 2, '#8a88a0');
      // Iron post
      f(14, 10, 4, 14, '#3a384c');
      f(15,  9, 2, 15, '#5a5870');
      // Lamp head arm
      f(11,  9, 4,  2, '#3a384c');
      f(10,  7, 3,  3, '#3a384c');
      // Lantern box
      f(9,   4, 14, 7, '#2e2c3a');
      f(10,  3, 12, 1, '#4a4860');
      f(10, 10, 12, 1, '#4a4860');
      f(9,   3,  1, 8, '#4a4860');
      f(22,  3,  1, 8, '#4a4860');
      // Amber glow
      f(11,  5, 10, 4, '#f0b030');
      f(12,  4,  8, 2, '#ffd050');
      f(13,  5,  6, 3, '#ffe880'); // bright core
      f(14,  6,  4, 2, '#ffffff');
      // Ground glow halo
      f(8,  28, 16, 3, '#2c240c');
    });

    // ── town_well (32×32) — stone well ───────────────────────────────────────
    this.buildDeco32('town_well', ctx => {
      const f = mk(ctx);
      // Stone outer wall
      f(4,  4, 24, 24, '#6a6880');
      f(6,  3, 20, 26, '#6a6880');
      f(5,  5, 22, 22, '#7a7890');
      // Stone top highlight
      f(6,  4, 20,  2, '#9a98b0');
      f(4,  6,  2, 18, '#7a7890');
      // Water interior
      f(8,  8, 16, 16, '#0c1828');
      f(9,  9, 14, 14, '#0e2040');
      f(10, 10, 12, 12, '#162848'); // water surface
      f(11, 12,  4,  4, '#203860'); // water highlight
      f(13, 11,  2,  2, '#304878');
      // Wooden crossbeam
      f(4,  14, 24,  3, '#6a4820');
      f(4,  14, 24,  1, '#8a6030'); // top highlight
      // Rope from center
      f(15, 11,  2, 10, '#8a7040');
      // Bucket hint
      f(13, 19,  6,  6, '#8a6a40');
      f(14, 20,  4,  4, '#a07850');
      f(13, 19,  6,  1, '#c09060');
    });

    // ── town_fountain (64×64) — grand town fountain ───────────────────────────
    {
      const tex = this.textures.createCanvas('town_fountain', 64, 64);
      if (tex) {
        const ctx = tex.getContext();
        const f = mk(ctx);
        // Outer stone basin
        f(4,  4, 56, 56, '#5a5870');
        f(6,  3, 52, 58, '#5a5870');
        f(3,  6, 58, 52, '#5a5870');
        // Stone top-face (lighter)
        f(5,  5, 54, 54, '#706e88');
        f(7,  4, 50, 56, '#706e88');
        f(4,  7, 56, 50, '#706e88');
        // Outer water ring
        f(8,  8, 48, 48, '#1a3a7a');
        f(10, 7, 44, 50, '#1a3a7a');
        f(7, 10, 50, 44, '#1a3a7a');
        // Inner stone platform ring
        f(14, 14, 36, 36, '#5a5870');
        f(16, 13, 32, 38, '#5a5870');
        f(13, 16, 38, 32, '#5a5870');
        f(15, 15, 34, 34, '#6a6880');
        // Inner water pool
        f(18, 18, 28, 28, '#2050a0');
        f(20, 17, 24, 30, '#2050a0');
        f(17, 20, 30, 24, '#2050a0');
        f(19, 19, 26, 26, '#2a60c0');
        f(21, 20, 22, 22, '#3070d8'); // bright inner water
        f(22, 21, 20, 20, '#4088e8');
        // Ripple rings
        f(23, 22, 18, 1, '#5098f0'); f(23, 40, 18, 1, '#5098f0');
        f(22, 23, 1, 16, '#5098f0'); f(40, 23, 1, 16, '#5098f0');
        // Center spout base
        f(26, 26, 12, 12, '#4888e8');
        f(28, 27,  8,  8, '#70a8f8');
        // Spout top (water arc effect)
        f(30, 22,  4,  8, '#90c0ff');
        f(29, 24,  6,  2, '#b0d8ff');
        f(31, 21,  2, 12, '#a8ccff');
        f(30, 20,  4,  2, '#ffffff'); // water top
        // Outer stone highlight
        f(5,  5, 54,  2, '#8a88a4');
        f(5,  5,  2, 54, '#8a88a4');
        tex.refresh();
      }
    }

    // ── town_barrel (32×32) — wooden barrel ──────────────────────────────────
    this.buildDeco32('town_barrel', ctx => {
      const f = mk(ctx);
      // Circular top shape
      f(6,  4, 20, 24, '#7a5030');
      f(4,  6, 24, 20, '#7a5030');
      f(5,  5, 22, 22, '#8a6040');
      // Wood top face
      f(6,  6, 20, 20, '#7a5030');
      f(8,  5, 16, 22, '#8a6040');
      f(6,  8, 20, 16, '#8a6040');
      // Wood grain lines (radial)
      f(15,  6,  2, 20, '#6a4020');
      f(10,  7,  2, 18, '#704828');
      f(20,  7,  2, 18, '#704828');
      f(7,  10,  2, 12, '#704828');
      f(23, 10,  2, 12, '#704828');
      // Iron rings
      f(4, 11, 24,  2, '#3a3848');
      f(5, 10, 22,  1, '#5a5870');
      f(4, 18, 24,  2, '#3a3848');
      f(5, 17, 22,  1, '#5a5870');
      // Top center (lid)
      f(12, 12,  8,  8, '#6a4020');
      f(13, 13,  6,  6, '#704828');
    });

    // ── town_bench (32×32) — wooden bench ────────────────────────────────────
    this.buildDeco32('town_bench', ctx => {
      const f = mk(ctx);
      // Seat planks (top view)
      f(2,  10, 28, 12, '#7a5030');
      f(2,  10, 28,  1, '#9a7050'); // front edge highlight
      // Plank lines
      f(2,  13, 28,  1, '#6a4020');
      f(2,  17, 28,  1, '#6a4020');
      // Armrests (ends)
      f(1,   8,  4, 16, '#5a3818');
      f(27,  8,  4, 16, '#5a3818');
      f(1,   8,  4,  1, '#7a5030');
      f(27,  8,  4,  1, '#7a5030');
      // Legs (visible from top)
      f(2,  22,  4,  6, '#4a2e10');
      f(26, 22,  4,  6, '#4a2e10');
      f(2,  22,  4,  1, '#6a4820');
      f(26, 22,  4,  1, '#6a4820');
    });

    // ── town_notice (32×32) — notice board ───────────────────────────────────
    this.buildDeco32('town_notice', ctx => {
      const f = mk(ctx);
      // Posts
      f(6,  18,  4, 14, '#4a3018');
      f(22, 18,  4, 14, '#4a3018');
      f(6,  17,  4,  2, '#6a5030'); // post top cap
      f(22, 17,  4,  2, '#6a5030');
      // Board backing (dark wood)
      f(3,   6, 26, 14, '#3a2810');
      f(4,   5, 24, 14, '#4a3818');
      // Parchment papers pinned to board
      f(5,   7, 10, 10, '#d0c8a0'); // left paper
      f(18,  7, 10, 10, '#d0c8a0'); // right paper
      f(6,   8,  8,  8, '#c8c090');
      f(19,  8,  8,  8, '#c8c090');
      // Faint text lines on papers
      f(6,   9,  7,  1, '#a0988c');
      f(6,  11,  7,  1, '#a0988c');
      f(6,  13,  5,  1, '#a0988c');
      f(19,  9,  7,  1, '#a0988c');
      f(19, 11,  7,  1, '#a0988c');
      f(19, 13,  5,  1, '#a0988c');
      // Board top rail
      f(3,   5, 26,  2, '#6a5030');
      f(3,   5, 26,  1, '#8a7050');
    });

    // ── town_crate (32×32) — wooden crate ────────────────────────────────────
    this.buildDeco32('town_crate', ctx => {
      const f = mk(ctx);
      f(2,  2, 28, 28, '#7a5a30');
      f(3,  3, 26, 26, '#8a6a40');
      // Cross brace top
      f(3,  3,  1, 26, '#5a4020');
      f(28, 3,  1, 26, '#5a4020');
      f(3,  3, 26,  1, '#5a4020');
      f(3, 28, 26,  1, '#5a4020');
      f(3, 14, 26,  1, '#5a4020');
      f(14, 3,  1, 26, '#5a4020');
      // Nail dots
      f(4,  4, 2, 2, '#9a8060'); f(26, 4, 2, 2, '#9a8060');
      f(4, 26, 2, 2, '#9a8060'); f(26,26, 2, 2, '#9a8060');
      f(15, 4, 2, 2, '#9a8060'); f(4, 15, 2, 2, '#9a8060');
      f(15,26, 2, 2, '#9a8060'); f(26,15, 2, 2, '#9a8060');
      // Top highlight
      f(3,  3, 26,  2, '#a07a50');
      f(3,  3,  2, 26, '#a07a50');
    });
  }

  /** Build a square canvas texture and call drawFn. */
  private buildDeco32(key: string, drawFn: (ctx: CanvasRenderingContext2D) => void): void {
    const tex = this.textures.createCanvas(key, 32, 32);
    if (tex) { drawFn(tex.getContext()); tex.refresh(); }
  }

  // ── Dungeon environment decorations ───────────────────────────────────────────
  private buildDungeonDecos(): void {
    // Wall torch with flickering flame
    this.buildDeco32('deco_torch', ctx => {
      const f = mk(ctx);
      f(14,  22, 4, 8, '#5a4020');   // bracket arm
      f(12,  20, 8, 3, '#6a5030');   // bracket base
      f(13,  17, 6, 5, '#8a6040');   // cup
      f(14,  16, 4, 1, '#a07050');   // cup rim
      f(13,   9, 6, 9, '#cc4400');   // outer flame
      f(14,   7, 4, 9, '#ee6600');   // mid flame
      f(15,   5, 2, 8, '#ffaa00');   // inner flame
      f(15,   4, 2, 4, '#ffdd40');   // flame tip
      f(15,   3, 2, 2, '#ffffff');   // spark
      f(13,  13, 2, 2, '#ff8800');   // left flicker
      f(17,  12, 2, 3, '#ff6600');   // right flicker
      // glow halo (dim)
      f( 8,   6, 16, 16, 'rgba(200,100,0,0.08)');
    });

    // Glowing green mushroom cluster
    this.buildDeco32('deco_mushroom_g', ctx => {
      const f = mk(ctx);
      // stems
      f(10, 24, 3, 6, '#6a8a50'); f(18, 25, 3, 5, '#6a8a50'); f(15, 26, 2, 4, '#7a9a60');
      // caps
      f( 6, 14, 10, 10, '#1a6a20'); f(16, 15, 8, 9, '#186018'); f(13, 20, 7, 8, '#206828');
      f( 7, 14, 8,  2, '#28a030'); f(17, 15, 6, 2, '#28a030'); f(14, 20, 5, 2, '#2ab030');
      // glow spots
      f( 9, 17, 4, 4, '#40e040'); f(19, 18, 3, 3, '#38d038'); f(15, 22, 3, 3, '#48ee48');
      f(10, 18, 2, 2, '#80ff80'); f(20, 19, 1, 2, '#80ff80');
      // underglow
      f( 8, 24, 16, 2, 'rgba(40,200,40,0.25)');
    });

    // Glowing blue mushroom
    this.buildDeco32('deco_mushroom_b', ctx => {
      const f = mk(ctx);
      f(12, 24, 3, 6, '#4a6a8a'); f(19, 25, 3, 5, '#3a5a7a'); f(16, 26, 2, 4, '#5a7a9a');
      f( 6, 13, 11, 11, '#102860'); f(17, 14, 9, 10, '#0e2458'); f(13, 20, 7,  8, '#132c68');
      f( 7, 13,  9,  2, '#2050b0'); f(18, 14, 7,  2, '#1a48a0'); f(14, 20, 5,  2, '#2258b8');
      f( 8, 17,  5,  4, '#3070e0'); f(19, 18, 4,  3, '#2860cc'); f(15, 22, 4,  3, '#3878ee');
      f( 9, 18,  3,  2, '#80b0ff'); f(20, 19, 2,  2, '#70a0f0');
      f( 8, 24, 16,  2, 'rgba(40,80,200,0.25)');
    });

    // Scattered bones
    this.buildDeco32('deco_bones', ctx => {
      const f = mk(ctx);
      // Long bone 1 (diagonal)
      f( 4, 18, 14, 3, '#c0b898'); f( 4, 18, 14, 1, '#d8d0b8'); f(5, 20, 2, 2, '#c0b898'); f(16, 18, 2, 2, '#c0b898');
      // Long bone 2 (cross)
      f(16, 12,  3, 12, '#b8b098'); f(16, 12, 3, 1, '#ccc4a8'); f(15, 12, 5, 3, '#b0a890'); f(15, 20, 5, 3, '#b0a890');
      // Short bone
      f( 6, 24,  8,  2, '#c8c0a0'); f(5, 23, 3, 2, '#c0b898'); f(13, 24, 3, 2, '#c0b898');
      // Rib fragment
      f(20, 22, 2, 6, '#b0a888'); f(23, 21, 2, 6, '#b0a888');
    });

    // Skull
    this.buildDeco32('deco_skull', ctx => {
      const f = mk(ctx);
      f( 9, 14, 14, 10, '#c8c0a0');  // cranium
      f(10, 13, 12,  2, '#d0c8a8');  // crown
      f(10, 14, 12,  1, '#e0d8c0');  // top highlight
      f(11, 17,  3,  3, '#302830');  // left eye socket
      f(18, 17,  3,  3, '#302830');  // right eye socket
      f(14, 18,  4,  2, '#302830');  // nasal cavity
      f(10, 22, 12,  2, '#a09880');  // jaw
      f(11, 23,  2,  2, '#c8c0a0'); f(14, 23, 2, 2, '#c8c0a0'); f(17, 23, 2, 2, '#c8c0a0'); // teeth
    });

    // Closed treasure chest
    this.buildDeco32('deco_chest_closed', ctx => {
      const f = mk(ctx);
      // Body
      f( 4, 18, 24, 12, '#6a4820');
      f( 5, 19, 22, 10, '#7a5828');
      f( 5, 19, 22,  1, '#9a7848');  // top highlight
      f( 4, 18,  1, 12, '#9a7848');
      // Lid (rounded)
      f( 4, 10, 24,  9, '#7a5020');
      f( 5, 10, 22,  1, '#9a6828');  // lid top
      f( 5, 11, 22,  8, '#7a5020');
      f( 4, 10,  1,  9, '#9a6828');
      // Lid arc curve
      f( 6,  9, 20,  2, '#8a6030');
      f( 8,  8, 16,  2, '#9a6828');
      f(12,  7,  8,  2, '#a07030');
      // Iron bands
      f( 4, 17, 24, 2, '#3a3040');
      f( 4, 17, 24, 1, '#5a5068');
      f(13, 10,  6, 10, '#3a3040');
      f(13, 10,  6,  1, '#5a5068');
      // Lock
      f(13, 18, 6, 4, '#c0a030');
      f(14, 19, 4, 2, '#e0c040');
      f(15, 21, 2, 1, '#c0a030');
    });

    // Open treasure chest
    this.buildDeco32('deco_chest_open', ctx => {
      const f = mk(ctx);
      // Open lid (tilted back)
      f( 4,  6, 24,  8, '#7a5020');
      f( 5,  6, 22,  1, '#9a6828');
      f( 4,  6,  1,  8, '#9a6828');
      f( 5,  7, 22,  7, '#6a4418');
      // Body (interior visible)
      f( 4, 14, 24, 16, '#6a4820');
      f( 5, 14, 22,  1, '#9a7848');
      f( 4, 14,  1, 16, '#9a7848');
      // Interior (dark)
      f( 5, 15, 22, 14, '#2a1c10');
      // Gold glint inside
      f(10, 18,  4,  3, '#d0a020');
      f(16, 19,  4,  2, '#c09018');
      f(12, 22,  6,  2, '#e0b030');
      f( 9, 17,  2,  2, '#f0c040');
      // Iron bands
      f( 4, 22, 24,  2, '#3a3040');
      f(13, 14,  6, 16, '#3a3040');
      f(13, 14,  6,  1, '#5a5068');
    });

    // Ancient urn
    this.buildDeco32('deco_urn', ctx => {
      const f = mk(ctx);
      f(10, 26,  12, 4, '#5a5068');   // base
      f( 8, 14,  16, 12, '#5a5068');  // body
      f( 6, 16,  20, 8, '#6a6080');   // body wider
      f( 7, 15,  18, 1, '#8a8098');   // shoulder highlight
      f( 6, 16,   1, 8, '#7a7088');
      f( 8, 12,  16, 3, '#5a5068');   // neck
      f( 9, 11,  14, 2, '#6a6080');
      f( 9, 10,  14, 2, '#4a4858');   // neck ring
      f(10,  9,  12, 2, '#5a5870');   // rim
      f(10,  9,  12, 1, '#8a8898');   // rim highlight
      // Crack
      f(16, 14,   1, 12, '#2a2838');
      f(18, 17,   1,  8, '#2a2838');
      // Rune on body
      f(11, 18,   2, 1, '#9090b8'); f(11, 20, 6, 1, '#9090b8'); f(16, 18, 2, 3, '#9090b8');
    });

    // Blue cave crystal
    this.buildDeco32('deco_crystal_b', ctx => {
      const f = mk(ctx);
      // Main crystal spire
      f(14,  4,  4, 22, '#1a3060'); f(14,  4,  4, 1, '#4070c0');
      f(13,  8,  6, 18, '#1e3870'); f(13,  8,  2, 2, '#5080d0');
      f(12, 14,  8, 12, '#243888'); f(12, 14,  2, 2, '#4878c0');
      // Secondary crystals
      f( 8, 10,  3, 16, '#162850'); f( 8, 10,  3, 1, '#3860a8');
      f(21, 12,  3, 14, '#182a58'); f(21, 12,  3, 1, '#3868b0');
      // Glow effect
      f(10, 18, 12,  8, 'rgba(40,80,200,0.2)');
      f(13,  6,  6, 18, 'rgba(80,130,255,0.15)');
      // Highlight facets
      f(15,  5,  1, 18, '#6090e0');
      f(14, 15,  2,  4, '#80a8f0');
    });

    // Dead campfire ring
    this.buildDeco32('deco_campfire', ctx => {
      const f = mk(ctx);
      // Stone ring
      f( 6, 20, 20, 6, '#4a4858'); f( 4, 22, 24, 4, '#5a5868'); f( 6, 20, 1, 6, '#6a6878'); f(25, 20, 1, 6, '#6a6878');
      f( 7, 19, 18, 2, '#6a6878'); f( 7, 25, 18, 2, '#4a4858');
      // Ash interior
      f( 7, 21, 18, 4, '#383440'); f( 8, 22, 16, 2, '#2e2a38');
      // Charred logs
      f( 9, 21,  8, 2, '#2a2020'); f( 9, 21,  8, 1, '#3a2c20');
      f(15, 21,  8, 2, '#282020'); f(15, 21,  8, 1, '#382a1e');
      // Ash glow (faint, indicating recent use)
      f(11, 22,  10, 2, '#402818');
      f(12, 23,   8, 1, '#381808');
      // Scattered embers
      f( 9, 20,  1, 1, '#884020'); f(20, 20, 1, 1, '#884020'); f(14, 19, 1, 1, '#664018');
    });

    // Hanging chain (on walls)
    this.buildDeco32('deco_chain', ctx => {
      const f = mk(ctx);
      for (let i = 0; i < 14; i++) {
        const x = 14 + (i % 2 === 0 ? 0 : 1);
        f(x, 4 + i * 2, 3, 2, '#5a5868');
        f(x, 4 + i * 2, 3, 1, '#7a7888');
      }
      f(12, 2, 8, 3, '#6a6878'); // ceiling mount
      f(12, 2, 8, 1, '#8a8898');
      f(12, 30, 8, 2, '#4a4858'); // dangling weight
      f(13, 32, 6, 4, '#5a5868'); f(13, 32, 6, 1, '#7a7888');
    });

    // Cobweb (in corners)
    this.buildDeco32('deco_cobweb', ctx => {
      const c = ctx; c.strokeStyle = '#4a4858'; c.lineWidth = 0.8; c.globalAlpha = 0.7;
      // Radial strands from top-left
      const cx2 = 2, cy2 = 2;
      for (const [ex, ey] of [[30, 10], [20, 0], [30, 20], [10, 0], [30, 30], [0, 16]]) {
        c.beginPath(); c.moveTo(cx2, cy2); c.lineTo(ex, ey); c.stroke();
      }
      // Concentric arcs
      for (const r of [6, 12, 18, 24]) {
        c.beginPath(); c.arc(cx2, cy2, r, 0, Math.PI / 2); c.stroke();
      }
      c.globalAlpha = 1;
    });

    // Floor rune (arcane marking)
    this.buildDeco32('deco_rune', ctx => {
      const f = mk(ctx);
      f( 0, 0, 32, 32, 'rgba(0,0,0,0)');
      // Outer circle
      ctx.strokeStyle = '#4040a0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(16, 16, 12, 0, Math.PI * 2); ctx.stroke();
      // Inner rune cross
      f(15, 8, 2, 16, '#3838a0'); f(8, 15, 16, 2, '#3838a0');
      // Diagonal accents
      ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(22, 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(22, 10); ctx.lineTo(10, 22); ctx.stroke();
      // Center diamond
      f(14, 13, 4, 2, '#6060cc'); f(13, 14, 6, 4, '#6060cc'); f(14, 17, 4, 2, '#6060cc');
      f(15, 14, 2, 4, '#9090ff');
    });

    // ── Forest theme decos ─────────────────────────────────────────────────────
    this.buildDeco32('deco_f_flower', ctx => {
      const f = mk(ctx);
      // Grass base
      f( 2, 26, 28, 6, 'rgba(0,0,0,0)');
      // Stems
      for (const [sx, sh] of [[8, 10], [14, 12], [20, 9], [6, 7], [24, 11]]) {
        f(sx as number, 26 - (sh as number), 1, sh as number, '#4a6a28');
      }
      // Petals — white daisy
      f(6, 14, 4, 2, '#d8d8e8'); f(8, 12, 2, 4, '#d8d8e8'); f(10, 14, 4, 2, '#d8d8e8'); f(8, 16, 2, 4, '#d8d8e8');
      f(7, 13, 2, 2, '#e0e0f0'); f(9, 13, 2, 2, '#e0e0f0'); f(7, 15, 2, 2, '#e0e0f0'); f(9, 15, 2, 2, '#e0e0f0');
      f(8, 14, 2, 2, '#f0e040'); // center
      // Purple wildflower
      f(18, 14, 2, 2, '#9050c8'); f(20, 13, 2, 4, '#9050c8'); f(16, 13, 2, 4, '#9050c8'); f(18, 12, 2, 2, '#9050c8');
      f(17, 14, 4, 2, '#9050c8'); f(18, 14, 2, 2, '#c080f0');
      // Small red flowers
      f(4, 18, 3, 3, '#d03020'); f(24, 17, 3, 3, '#c82818'); f(22, 20, 2, 2, '#e04030');
    });

    this.buildDeco32('deco_f_fern', ctx => {
      const f = mk(ctx);
      // Main frond left
      f( 4, 28, 1, 1, '#2a5018');
      for (let i = 0; i < 8; i++) {
        f(4 + i, 28 - i * 2, 8 - i, 2, '#3a6820');
        f(4 + i, 28 - i * 2, 8 - i, 1, '#4a7828');
      }
      // Main frond right
      for (let i = 0; i < 8; i++) {
        f(22 - i, 28 - i * 2, 8 - i, 2, '#3a6820');
        f(22 - i, 28 - i * 2, 8 - i, 1, '#4a7828');
      }
      // Central stalk
      f(15, 8, 2, 22, '#2a5018'); f(15, 8, 2, 1, '#4a7828');
      // Small leaflets
      for (let i = 0; i < 5; i++) {
        f(11 - i, 10 + i * 4, 5, 2, '#3a6820'); f(18 + i, 10 + i * 4, 5, 2, '#3a6820');
      }
    });

    this.buildDeco32('deco_f_log', ctx => {
      const f = mk(ctx);
      // Log body (horizontal)
      f( 2, 18, 28, 10, '#5a3818');
      f( 2, 18, 28,  2, '#6a4820');  // top highlight
      f( 2, 18,  1, 10, '#7a5828');  // left end
      f(29, 18,  1, 10, '#3a2410');  // right shadow
      // Bark texture rings
      f( 4, 18,  1, 10, '#4a3010'); f(10, 18, 1, 10, '#4a3010'); f(16, 18, 1, 10, '#4a3010'); f(22, 18, 1, 10, '#4a3010');
      // End rings
      f( 2, 18,  4, 10, '#7a5030');
      f( 3, 19,  2,  8, '#9a6840');
      f( 3, 20,  2,  4, '#a07048');
      // Moss on top
      f( 4, 18, 10,  2, '#3a5a18'); f(16, 18, 8, 2, '#3a5a18'); f(22, 18, 4, 1, '#3a5a18');
      // Mushroom on log
      f(20, 13,  2,  6, '#5a4030'); f(17, 11,  8,  4, '#c84020'); f(17, 11,  8,  1, '#e05028');
    });

    // ── Deadland theme decos ───────────────────────────────────────────────────
    this.buildDeco32('deco_d_grave', ctx => {
      const f = mk(ctx);
      // Stone slab
      f( 8,  4, 16, 20, '#5a5568');
      f( 9,  4, 14,  1, '#7a7588');  // top highlight
      f( 8,  4,  1, 20, '#7a7588');
      // Arch top
      f(10,  3, 12,  2, '#5a5568');
      f(12,  2,  8,  2, '#5a5568');
      f(14,  1,  4,  2, '#5a5568');
      f(10,  3, 12,  1, '#7a7588');
      // Engraved cross
      f(15,  6,  2, 12, '#3a3848'); f(10, 10,  12, 2, '#3a3848');
      // Cracked surface
      f(12,  8,  1,  8, '#3a3848'); f(19, 12,  1,  5, '#3a3848');
      // Name plate (weathered)
      f(10, 14,  12,  6, '#4a4858'); f(11, 15, 10, 4, '#3a3848');
      // Ground mound
      f( 4, 24, 24,  6, '#2a2820'); f( 2, 26, 28, 4, '#222018');
      f( 4, 24, 24,  1, '#3a3828'); // mound highlight
    });

    this.buildDeco32('deco_d_deadtree', ctx => {
      const f = mk(ctx);
      // Main trunk
      f(14, 10, 4, 22, '#2a2420'); f(14, 10, 4, 1, '#3a3228'); f(14, 10, 1, 22, '#3a3228');
      // Roots
      f(10, 28, 4, 4, '#222018'); f(18, 28, 4, 4, '#222018'); f(8, 30, 4, 2, '#1e1c16'); f(20, 30, 4, 2, '#1e1c16');
      // Branch left big
      f( 4, 16, 11, 3, '#2a2420'); f( 4, 16, 11, 1, '#3a3228'); f(4, 16, 1, 3, '#3a3228');
      f( 2, 12,  4, 5, '#242018'); f( 2, 10,  3, 3, '#2a2018');
      // Branch right big
      f(18, 14, 11, 3, '#2a2420'); f(18, 14, 11, 1, '#3a3228');
      f(28, 10,  3, 5, '#242018'); f(28,  8,  3, 3, '#2a2018');
      // Small branches
      f( 8,  8,  6, 2, '#242018'); f( 8,  8,  1, 2, '#3a3028');
      f(18,  6,  6, 2, '#242018'); f(23,  4,  4, 2, '#1e1c16');
      // Crows (suggestion)
      f( 5,  5,  2, 1, '#181418'); f(24,  4,  2, 1, '#181418');
    });

    this.buildDeco32('deco_d_altar', ctx => {
      const f = mk(ctx);
      // Stone base
      f( 4, 22, 24,  8, '#3a3040');
      f( 4, 22, 24,  1, '#5a4e60');
      f( 4, 22,  1,  8, '#5a4e60');
      f( 6, 18, 20,  5, '#3a3040');
      f( 6, 18, 20,  1, '#5a4e60');
      // Altar top slab
      f( 2, 14, 28,  5, '#302838');
      f( 2, 14, 28,  1, '#504458');
      f( 2, 14,  1,  5, '#504458');
      // Dark stain
      f( 8, 15, 16,  3, '#1e1428');
      f(10, 15, 12,  2, '#280a18');
      // Candles
      f( 6, 10,  3,  5, '#d0b050'); f( 6,  9,  3,  2, '#ffdd60'); f( 7,  8,  1,  2, '#ffffff');
      f(23, 10,  3,  5, '#d0b050'); f(23,  9,  3,  2, '#ffdd60'); f(24,  8,  1,  2, '#ffffff');
      // Skull on altar
      f(13, 10,  6,  5, '#c0b898'); f(14,  9,  4,  2, '#ccc4a8');
      f(13, 12,  2,  2, '#2a2030'); f(17, 12,  2,  2, '#2a2030');
      // Dark rune
      f(10, 16,  4,  1, '#5a2068'); f(14, 15,  4,  3, '#5a2068'); f(18, 16,  4,  1, '#5a2068');
    });

    // ── Pond theme decos ───────────────────────────────────────────────────────
    this.buildDeco32('deco_p_lily', ctx => {
      const f = mk(ctx);
      // Water surface
      f( 0, 20, 32, 12, '#0e2040');
      f( 2, 20, 28,  1, '#1e3858'); // water highlight
      // Lily pad (round, green)
      f( 6, 16, 20,  8, '#1a5020');
      f( 4, 18, 24,  4, '#1a5020');
      f( 6, 16, 20,  1, '#2a6830'); // pad top highlight
      f( 6, 16,  1,  8, '#2a6830');
      // Notch in pad
      f(15,  16,  2,  4, '#0e2040');
      // Flower on pad
      f(13,  12,  6,  5, '#e8a0b0');
      f(11,  13,  10,  3, '#e8a0b0');
      f(14,  11,  4,  2, '#f0b8c0');
      f(15,  10,  2,  3, '#ffd0d8'); // center
      f(15,  12,  2,  1, '#ffee40'); // stamen
      // Pad reflection ripples
      f( 8, 24,  6,  1, '#1a3050'); f(18, 25, 6, 1, '#1a3050');
    });

    this.buildDeco32('deco_p_reed', ctx => {
      const f = mk(ctx);
      // Water base
      f(0, 26, 32, 6, '#0e2040'); f(2, 26, 28, 1, '#1e3858');
      // Reed stems
      for (const [rx, rh] of [[9, 24], [14, 26], [19, 22], [23, 20]]) {
        f(rx as number, 26 - (rh as number), 2, rh as number, '#5a6830');
        f(rx as number, 26 - (rh as number), 2, 1, '#7a8848');
      }
      // Cattail heads
      f( 8,  2,  4, 12, '#6a3818'); f( 8,  2,  4,  1, '#8a5028');
      f(13,  0,  4, 14, '#6a3818'); f(13,  0,  4,  1, '#8a5028');
      f(18,  4,  4, 10, '#6a3818'); f(18,  4,  4,  1, '#8a5028');
      // Leaf blades
      f(11, 14, 1, 14, '#4a6028'); f(16,  8, 1, 18, '#4a6028'); f(21, 10, 1, 16, '#4a6028');
      // Fluffy tip detail
      f( 7,  2, 2, 2, '#8a5a28'); f(12, -0, 2, 2, '#8a5a28'); f(17,  4, 2, 2, '#8a5a28');
    });

    // ── Rock theme decos ───────────────────────────────────────────────────────
    this.buildDeco32('deco_r_crystal', ctx => {
      const f = mk(ctx);
      // Orange/amber crystals
      f(14,  2,  4, 24, '#602000'); f(14,  2,  4,  1, '#c04010');
      f(12,  6,  8, 20, '#702810'); f(12,  6,  2,  2, '#e05020');
      f(10, 12, 12, 14, '#7a3010'); f(10, 12,  2,  2, '#d04818');
      // Secondary crystals
      f( 7,  8,  3, 18, '#501800'); f( 7,  8,  3,  1, '#a03010');
      f(22, 10,  3, 16, '#581a00'); f(22, 10,  3,  1, '#aa3818');
      // Glow
      f( 8, 20, 16, 8, 'rgba(220,80,20,0.2)');
      // Highlight facets
      f(15,  3,  2, 20, '#e06030');
      f(14, 13,  2,  4, '#ff8040');
    });

    this.buildDeco32('deco_r_ore', ctx => {
      const f = mk(ctx);
      // Rock face background
      f( 0, 0, 32, 32, '#2a2420');
      f( 2, 2, 28, 28, '#322820');
      // Ore veins (golden)
      f( 6,  4,  2, 10, '#c09020'); f( 6,  4,  2,  1, '#e0b030');
      f( 8,  8,  6,  2, '#c09020'); f( 8,  8,  6,  1, '#e0b030');
      f(14,  6,  4, 14, '#b08010'); f(14,  6,  4,  1, '#d0a020');
      f(10, 18, 12,  2, '#c09020'); f(10, 18, 12,  1, '#e0b030');
      f(20, 10,  4, 12, '#b88010'); f(20, 10,  4,  1, '#d8a020');
      f( 6, 16, 10,  2, '#c09020'); f( 6, 16, 10,  1, '#e0b030');
      // Ore chunks (bright)
      f( 9,  6,  4,  4, '#e0b040'); f( 9,  6,  4,  1, '#f0c840');
      f(16, 14,  5,  5, '#d8a830'); f(16, 14,  5,  1, '#f0c840');
      f( 8, 22,  6,  4, '#d0a020'); f( 8, 22,  6,  1, '#e8b828');
      // Sparkle glints
      f(11,  7,  2,  2, '#f8e060'); f(18, 16,  2,  2, '#f0d040'); f(10, 24,  2,  2, '#f8e060');
    });
  }

  // ── Town extra decorations + NPCs ─────────────────────────────────────────────
  private buildTownExtras(): void {
    // Market stall (64×32) — wooden awning with goods
    {
      const tex = this.textures.createCanvas('town_stall', 64, 32);
      if (tex) {
        const ctx = tex.getContext();
        const f = mk(ctx);
        // Awning
        f( 0,  0, 64, 12, '#8a3010');
        f( 0,  0, 64,  2, '#aa4818');
        f( 0,  0,  1, 12, '#aa4818');
        // Stripe
        for (let i = 0; i < 64; i += 8) { f(i, 0, 4, 12, '#7a2808'); }
        // Fringe
        for (let i = 2; i < 62; i += 6) { f(i, 10, 3, 5, '#aa4818'); }
        // Counter
        f( 2, 14, 60, 12, '#7a5030');
        f( 2, 14, 60,  1, '#9a7048');
        f( 2, 14,  1, 12, '#9a7048');
        // Goods on counter
        f( 6, 13, 6, 4, '#c04020'); f(6, 13, 6, 1, '#e05030'); // red apples
        f(16, 13, 6, 4, '#d09020'); f(16, 13, 6, 1, '#e8b030'); // pumpkins
        f(26, 13, 8, 3, '#8a6030'); f(26, 13, 8, 1, '#9a7040'); // bread loaves
        f(38, 14, 4, 4, '#88a830'); f(38, 14, 4, 1, '#a0c040'); // cabbages
        f(46, 13, 4, 4, '#c07820'); f(46, 13, 4, 1, '#e08c28'); // carrots
        f(54, 14, 4, 4, '#a03040'); f(54, 14, 4, 1, '#c04050'); // berries
        // Support poles
        f( 1, 12,  3, 20, '#5a3818'); f(60, 12, 3, 20, '#5a3818');
        tex.refresh();
      }
    }

    // Merchant cart (64×32)
    {
      const tex = this.textures.createCanvas('town_cart', 64, 32);
      if (tex) {
        const ctx = tex.getContext();
        const f = mk(ctx);
        // Cart body
        f( 8,  4, 48, 20, '#7a5030'); f( 8,  4, 48,  1, '#9a7048'); f( 8,  4,  1, 20, '#9a7048');
        f( 9,  5, 46, 18, '#6a4020');
        // Planks
        for (let i = 10; i < 54; i += 8) { f(i, 4, 1, 20, '#5a3010'); }
        // Goods in cart
        f(12,  2, 10, 4, '#c04020'); f(12,  2, 10, 1, '#e05030'); // pile of goods
        f(24,  1, 12, 5, '#d09020'); f(24,  1, 12, 1, '#e8b030');
        f(38,  2,  8, 4, '#8a6030'); f(38,  2,  8, 1, '#9a7040');
        // Wheels
        f( 2, 18, 12, 12, '#4a3018'); f( 2, 18, 12,  1, '#6a4820');
        ctx.beginPath(); ctx.arc(8, 24, 6, 0, Math.PI * 2); ctx.strokeStyle = '#6a4820'; ctx.lineWidth = 2; ctx.stroke();
        f(50, 18, 12, 12, '#4a3018'); f(50, 18, 12, 1, '#6a4820');
        ctx.beginPath(); ctx.arc(56, 24, 6, 0, Math.PI * 2); ctx.stroke();
        // Wheel spokes
        const f2 = mk(ctx);
        for (const cx2 of [8, 56]) {
          f2(cx2-1, 18, 2, 12, '#5a3818'); f2(cx2-6, 23, 12, 2, '#5a3818');
        }
        tex.refresh();
      }
    }

    // Small flower pot (16×16)
    this.buildDeco16('town_flowerpot', ctx => {
      const f = mk(ctx);
      f( 4,  8, 8, 6, '#8a4820');  // pot
      f( 3,  8, 10, 1, '#aa6030'); // rim
      f( 3, 13, 10, 2, '#7a3818'); // base
      f( 5,  2, 2, 7, '#2a6018'); f( 9, 3, 2, 6, '#2a6018'); // stems
      f( 3,  2, 5, 3, '#e84040'); f( 9, 2, 5, 3, '#f06020'); // flowers
      f( 4,  2, 3, 1, '#ff6060'); f(10, 2, 3, 1, '#ff8040');
    });

    // Flag on pole (16×48)
    {
      const tex = this.textures.createCanvas('town_flag', 16, 48);
      if (tex) {
        const ctx = tex.getContext();
        const f = mk(ctx);
        // Pole
        f(7, 0, 2, 48, '#5a5060'); f(7, 0, 2, 1, '#8a8098');
        // Flag fabric
        f( 9,  2, 6, 14, '#8a1818');
        f( 9,  2, 6,  1, '#aa2828');
        f( 9,  2, 1, 14, '#aa2828');
        f(10,  3, 4, 12, '#9a2020');
        // Emblem on flag
        f(11,  6, 2, 5, '#d0a020'); f(10, 8, 4, 2, '#d0a020');
        tex.refresh();
      }
    }

    // Water trough (32×20)
    {
      const tex = this.textures.createCanvas('town_trough', 32, 20);
      if (tex) {
        const ctx = tex.getContext();
        const f = mk(ctx);
        f( 2,  4, 28, 12, '#7a5030');
        f( 2,  4, 28,  1, '#9a7048');
        f( 2,  4,  1, 12, '#9a7048');
        f( 3,  5, 26, 10, '#6a4020');
        f( 3,  6, 26,  8, '#0e2840');  // water interior
        f( 3,  6, 26,  1, '#1e4060');  // water surface
        f( 0, 14, 10,  6, '#5a3818'); f(22, 14, 10, 6, '#5a3818'); // legs
        f( 0, 14, 10,  1, '#7a5030'); f(22, 14, 10, 1, '#7a5030');
        tex.refresh();
      }
    }

    // Hay bale (32×32)
    this.buildDeco32('town_haybale', ctx => {
      const f = mk(ctx);
      f( 4,  8, 24, 20, '#c09020');
      f( 2, 10, 28, 16, '#c09020');
      f( 4,  8, 24,  1, '#e0b030');
      f( 4,  8,  1, 20, '#e0b030');
      // Hay strands
      for (let i = 6; i < 26; i += 3) { f(i, 8, 1, 20, '#a07018'); }
      // Binding twine
      f( 2, 14, 28,  2, '#8a6818'); f( 2, 14, 28, 1, '#aa8828');
      f( 2, 20, 28,  2, '#8a6818'); f( 2, 20, 28, 1, '#aa8828');
      // Top detail
      f( 6,  7, 6, 3, '#d0a020'); f(12, 6, 8, 3, '#c89018'); f(20, 7, 6, 3, '#d0a020');
    });

    // Directional signpost (32×32)
    this.buildDeco32('town_signpost', ctx => {
      const f = mk(ctx);
      // Post
      f(15, 14, 2, 18, '#5a3818'); f(15, 14, 2, 1, '#7a5028');
      // Arrow sign — pointing left (DUNGEON)
      f( 2,  6, 18,  7, '#8a6030');
      f( 2,  6, 18,  1, '#aa8048');
      f( 2,  6,  1,  7, '#aa8048');
      f( 2,  9,  4,  1, '#c09050');
      f( 0,  7,  4,  4, '#8a6030'); // arrow tip
      f( 3,  6, 10,  1, '#3a2010'); f( 3,  8,  8,  1, '#3a2010'); f( 3, 10,  6,  1, '#3a2010');
      // Arrow sign — pointing right (TOWN)
      f(12, 14, 18,  7, '#8a6030');
      f(12, 14, 18,  1, '#aa8048');
      f(12, 14,  1,  7, '#aa8048');
      f(28, 17,  4,  4, '#8a6030'); // arrow tip
      f(14, 14, 10,  1, '#3a2010'); f(14, 16, 8, 1, '#3a2010'); f(14, 18, 6, 1, '#3a2010');
    });

    // Small shrine near chapel (32×32)
    this.buildDeco32('town_shrine', ctx => {
      const f = mk(ctx);
      // Stone base
      f( 6, 22, 20, 10, '#5a5568'); f( 4, 24, 24, 8, '#5a5568');
      f( 6, 22, 20,  1, '#7a7588'); f( 4, 24,  1, 8, '#7a7588');
      // Pillar body
      f( 8, 10, 16, 13, '#6a6578'); f( 8, 10, 16, 1, '#8a8598'); f( 8, 10, 1, 13, '#8a8598');
      // Roof (triangular)
      f( 4,  6, 24,  5, '#7a7588');
      f( 6,  4, 20,  3, '#8a8598');
      f( 8,  2, 16,  3, '#9a9aaa');
      f(12,  0,  8,  3, '#aaaabb');
      f( 4,  6, 24,  1, '#aaaabc');
      // Cross
      f(15,  7,  2, 14, '#c8c0d8'); f(11, 12,  10, 2, '#c8c0d8');
      // Candle glow
      f(10, 19,  2,  4, '#e0b040'); f(10, 18,  2,  2, '#ffd060'); f(10, 17,  2,  2, '#ffee80');
      f(20, 19,  2,  4, '#e0b040'); f(20, 18,  2,  2, '#ffd060'); f(20, 17,  2,  2, '#ffee80');
    });

    // Static NPC — Town Guard (32×48, single frame)
    this.buildNPC('npc_guard', ctx => {
      const f = mk(ctx);
      // Helmet
      f(11, 7, 10, 8, '#9ca0b2'); f(11, 7, 10, 1, '#cdd0e0'); f(11, 7, 1, 8, '#cdd0e0');
      f(12, 9, 8, 5, '#e8b88e'); // face
      f(13, 11, 2, 1, '#2c2c40'); f(17, 11, 2, 1, '#2c2c40'); // eyes
      f(10, 14, 12, 2, '#707488'); // gorget
      // Armored body
      f(10, 16, 12, 11, '#9ca0b2');
      f(10, 16, 12,  1, '#cdd0e0');
      f(10, 16,  1, 11, '#cdd0e0');
      f(12, 17, 8,  9, '#707488'); // breastplate
      f(15, 18, 2, 7, '#9ca0b2'); // center line
      f(10, 26, 12, 1, '#d6ae4a'); // gold belt
      // Shield left side
      f( 4, 18, 7, 8, '#9ca0b2'); f( 4, 18, 7, 1, '#cdd0e0'); f( 5, 20, 5, 5, '#707488'); f( 6, 21, 3, 2, '#d6ae4a');
      // Spear right side
      f(22, 4, 2, 24, '#6a4820'); f(22, 3, 2, 3, '#cdd0e0'); f(21, 3, 4, 1, '#9ca0b2');
      // Legs
      f(10, 27, 5, 13, '#707488'); f(17, 27, 5, 13, '#707488');
      f(10, 38, 5, 2, '#9ca0b2'); f(17, 38, 5, 2, '#9ca0b2'); // boots
    });

    // Static NPC — Merchant (32×48)
    this.buildNPC('npc_merchant', ctx => {
      const f = mk(ctx);
      // Hat
      f(10, 4, 12, 3, '#4a3010'); f(8, 6, 16, 2, '#5a3818'); f(8, 6, 16, 1, '#7a5028'); // brim
      // Head
      f(12, 8, 8, 8, '#e8b88e'); f(12, 8, 8, 1, '#f8c89e');
      f(13, 11, 2, 1, '#2c2c40'); f(17, 11, 2, 1, '#2c2c40');
      // Beard
      f(12, 14, 8, 4, '#8a7050'); f(13, 16, 6, 3, '#7a6040');
      // Merchant robe (dark green)
      f(9, 17, 14, 11, '#2a4820'); f(9, 17, 14, 1, '#3a5828'); f(9, 17, 1, 11, '#3a5828');
      f(10, 18, 12, 9, '#324e28');
      // Money bag in right hand
      f(23, 20, 6, 7, '#c09020'); f(23, 20, 6, 1, '#e0b030'); f(25, 18, 4, 3, '#a07018');
      f(26, 19, 2, 1, '#c09020');
      // Left arm gesturing
      f(5, 18, 5, 2, '#2a4820'); f(3, 20, 4, 7, '#2a4820');
      // Robe hem / legs
      f(9, 27, 14, 12, '#203818'); f(9, 27, 14, 1, '#2a4820');
      f(10, 36, 4, 4, '#1a2e10'); f(18, 36, 4, 4, '#1a2e10'); // shoes
    });

    // Static NPC — Citizen (32×48)
    this.buildNPC('npc_citizen', ctx => {
      const f = mk(ctx);
      // Head scarf / hair
      f(11, 7, 10, 4, '#7a4820'); f(11, 7, 10, 1, '#9a6030'); f(11, 10, 10, 2, '#8a5828');
      // Face
      f(12, 9, 8, 7, '#e8b88e'); f(12, 9, 8, 1, '#f8c89e');
      f(13, 12, 2, 1, '#2c2c40'); f(17, 12, 2, 1, '#2c2c40');
      // Simple tunic (blue-gray)
      f(10, 17, 12, 11, '#485868'); f(10, 17, 12, 1, '#607888'); f(10, 17, 1, 11, '#607888');
      f(11, 18, 10, 9, '#505e6e');
      // Apron (light tan)
      f(12, 19, 8, 8, '#c8a870'); f(12, 19, 8, 1, '#d8b880');
      // Arms
      f(5, 17, 5, 2, '#485868'); f(4, 19, 4, 7, '#485868');
      f(23, 17, 5, 2, '#485868'); f(25, 19, 4, 7, '#485868');
      // Basket in right hand (carrying goods)
      f(24, 22, 7, 6, '#8a5030'); f(24, 22, 7, 1, '#aa6840'); f(25, 23, 5, 4, '#c08040');
      // Legs
      f(10, 27, 5, 13, '#384048'); f(17, 27, 5, 13, '#384048');
      f(10, 38, 5, 2, '#282e38'); f(17, 38, 5, 2, '#282e38');
    });
  }

  // ── Interior furniture textures ────────────────────────────────────────────────
  // These are used by the interior scenes (Armory, Emporium, Inn, Chapel)
  buildInteriorFurniture(): void {
    // Weapon/armor display rack (32×32)
    this.buildDeco32('armory_rack', ctx => {
      const f = mk(ctx);
      // Horizontal bars (rack frame)
      f( 2,  6, 28, 3, '#4a3018'); f(2, 6, 28, 1, '#6a4820');
      f( 2, 14, 28, 3, '#4a3018'); f(2, 14, 28, 1, '#6a4820');
      f( 2, 22, 28, 3, '#4a3018'); f(2, 22, 28, 1, '#6a4820');
      // Vertical supports
      f( 2,  4, 3, 26, '#3a2410'); f(2,  4, 3, 1, '#5a3818');
      f(27,  4, 3, 26, '#3a2410'); f(27, 4, 3, 1, '#5a3818');
      // Weapons hanging on rack
      f( 7,  3, 2, 10, '#9ca0b2'); f( 7, 3, 2, 1, '#cdd0e0');  // sword blade
      f( 6,  4, 4,  2, '#9ca0b2');                              // crossguard
      f(13,  3, 2, 10, '#9ca0b2'); f(13, 3, 2, 1, '#cdd0e0');
      f(12,  4, 4,  2, '#9ca0b2');
      f(19,  3, 2, 12, '#c09020'); f(19, 3, 2, 1, '#e0b030');  // mace/club
      f(24,  3, 1, 14, '#6a4820'); f(23, 3, 3, 2, '#9a6030');  // staff
    });

    // Potion shelf (32×32)
    this.buildDeco32('shelf_potions', ctx => {
      const f = mk(ctx);
      // Shelf plank
      f( 2,  4, 28, 4, '#5a3818'); f(2, 4, 28, 1, '#7a5028');
      f( 2, 16, 28, 4, '#5a3818'); f(2, 16, 28, 1, '#7a5028');
      f( 2, 26, 28, 4, '#5a3818'); f(2, 26, 28, 1, '#7a5028');
      // Side walls
      f( 2,  4, 2, 26, '#4a2e10'); f(28, 4, 2, 26, '#4a2e10');
      // Potion bottles — various colors
      f( 5,  0, 4, 5, '#3060cc'); f( 5, 0, 4, 1, '#6090ff');  // blue potion
      f(10,  0, 4, 5, '#cc3030'); f(10, 0, 4, 1, '#ff6060');  // red potion
      f(15,  0, 4, 5, '#30aa30'); f(15, 0, 4, 1, '#60dd60');  // green potion
      f(21,  0, 3, 5, '#aa6000'); f(21, 0, 3, 1, '#dd9020');  // amber potion
      f( 5, 12, 4, 5, '#cc3030'); f(10, 12, 4, 5, '#3060cc');
      f(15, 12, 3, 5, '#aa6000'); f(20, 12, 4, 5, '#883388');
      f( 5, 22, 4, 5, '#30aa30'); f(11, 22, 3, 5, '#cc3030');
      f(16, 22, 4, 5, '#3060cc'); f(22, 22, 3, 5, '#aa6000');
    });

    // Round inn table (32×32 top-down)
    this.buildDeco32('inn_table', ctx => {
      const f = mk(ctx);
      // Table shadow
      f(6, 24, 20, 6, '#0a0814');
      // Table top (round-ish via inset squares)
      f(4,  8, 24, 18, '#6a4820');
      f(2, 10, 28, 14, '#6a4820');
      f(4,  8, 24,  1, '#9a7048'); // top highlight
      f(4,  8,  1, 18, '#9a7048'); // left highlight
      // Wood grain
      f(14,  8,  1, 18, '#5a3818'); f(20,  8,  1, 18, '#5a3818');
      f( 4, 16, 24,  1, '#5a3818');
      // Table leg (center, visible from top)
      f(13, 21, 6, 5, '#4a2e10'); f(14, 25, 4, 3, '#3a2010');
    });

    // Stone fireplace (32×32 top-down view)
    this.buildDeco32('inn_fireplace', ctx => {
      const f = mk(ctx);
      // Stone surround
      f( 2,  4, 28, 24, '#5a5568');
      f( 4,  2, 24, 28, '#5a5568');
      f( 2,  4, 28,  1, '#7a7588');  // top highlight
      f( 2,  4,  1, 24, '#7a7588');  // left highlight
      // Stone face detail
      f( 4,  6,  8,  6, '#6a6578'); f(20, 6, 8, 6, '#6a6578');
      f( 4, 16, 24,  8, '#6a6578');
      // Fire opening (dark center)
      f( 8,  8, 16, 14, '#1a0e0a');
      f( 9,  8, 14,  1, '#2a1a12');
      // Fire flames
      f(11,  6,  3, 10, '#cc4400'); f(11, 6, 3, 1, '#ee6600');
      f(13,  5,  4, 10, '#ee6600'); f(13, 5, 4, 1, '#ffaa00');
      f(16,  6,  3, 10, '#cc4400'); f(16, 6, 3, 1, '#ee6600');
      f(14,  4,  4,  6, '#ffcc00'); f(15, 3, 2, 4, '#ffffff'); // bright flame tip
      // Ash at base
      f( 9, 18, 14,  2, '#382820');
    });

    // Chapel pew (32×32 top-down)
    this.buildDeco32('chapel_pew', ctx => {
      const f = mk(ctx);
      // Pew body (long bench)
      f( 2, 12, 28, 12, '#4a3010');
      f( 2, 12, 28,  1, '#6a4820'); // top highlight
      f( 2, 12,  1, 12, '#6a4820'); // left highlight
      // Wood grain lines
      f( 8, 12,  1, 12, '#3a2010'); f(16, 12, 1, 12, '#3a2010'); f(24, 12, 1, 12, '#3a2010');
      // Armrest ends
      f( 2, 10,  4, 16, '#5a3818'); f(2, 10, 4, 1, '#7a5028');
      f(26, 10,  4, 16, '#5a3818'); f(26, 10, 4, 1, '#7a5028');
      // Kneeler at front
      f( 3, 24, 26,  5, '#3a2810'); f(3, 24, 26, 1, '#5a4020');
    });

    // Chapel altar (32×32 top-down)
    this.buildDeco32('chapel_altar', ctx => {
      const f = mk(ctx);
      // Stone altar base
      f( 2, 12, 28, 16, '#5a5568');
      f( 2, 12, 28,  1, '#8a8598');
      f( 2, 12,  1, 16, '#8a8598');
      f( 4, 14, 24, 12, '#6a6578');
      // Altar cloth
      f( 4, 12, 24,  6, '#4a2288');
      f( 4, 12, 24,  1, '#6a40aa');
      // Altar cross
      f(14,  2,  4, 24, '#e0d8c8'); f(6,  8, 20,  4, '#e0d8c8');
      f(14,  2,  4,  1, '#ffffff');
      // Candles
      f( 6,  8,  3,  4, '#e0c060'); f( 6, 7, 3, 2, '#ffe880'); f( 7, 6, 1, 2, '#ffffff');
      f(23,  8,  3,  4, '#e0c060'); f(23, 7, 3, 2, '#ffe880'); f(24, 6, 1, 2, '#ffffff');
    });
  }

  private buildDeco16(key: string, drawFn: (ctx: CanvasRenderingContext2D) => void): void {
    const tex = this.textures.createCanvas(key, 16, 16);
    if (tex) { drawFn(tex.getContext()); tex.refresh(); }
  }

  private buildNPC(key: string, drawFn: (ctx: CanvasRenderingContext2D) => void): void {
    const tex = this.textures.createCanvas(key, 32, 48);
    if (tex) { drawFn(tex.getContext()); tex.refresh(); }
  }

  // ── Animation registration ────────────────────────────────────────────────────
  private registerAllAnims(): void {
    for (const clazz of CLASS_IDS) {
      this.registerPlayerAnims(clazz);
    }
    for (const id of ENEMY_IDS) {
      this.registerEnemyAnims(id);
    }
  }

  private registerPlayerAnims(clazz: ClassId): void {
    const key = `player_${clazz}`;
    const add = (clip: string, count: number, rate: number): void => {
      this.anims.create({
        key: `${clazz}_${clip}`,
        frames: Array.from({ length: count }, (_, i) => ({ key, frame: `${clip}_${i}` })),
        frameRate: rate,
        repeat: -1,
      });
    };
    add('idle_down', 2, 2); add('idle_up', 2, 2); add('idle_side', 2, 2);
    add('walk_down', 4, 8); add('walk_up', 4, 8); add('walk_side', 4, 8);
  }

  private registerEnemyAnims(id: string): void {
    const key = `enemy_${id}`;
    this.anims.create({
      key: `${id}_idle`,
      frames: [{ key, frame: 0 }, { key, frame: 1 }],
      frameRate: 3,
      repeat: -1,
    });
    this.anims.create({
      key: `${id}_walk`,
      frames: [{ key, frame: 2 }, { key, frame: 3 }],
      frameRate: 8,
      repeat: -1,
    });
  }
}
