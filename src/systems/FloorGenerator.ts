import { DUNGEON_COLS, DUNGEON_ROWS, FLOOR2_COLS, FLOOR2_ROWS } from '../config';
import { EnemyTheme } from '../data/enemies';

export const T_FLOOR        = 1;
export const T_WALL         = 2;
export const T_WARP         = 5;
export const T_PILLAR       = 8;
export const T_STONE        = 9;
export const T_FLOOR_FOREST = 10;
export const T_FLOOR_DEAD   = 11;
export const T_FLOOR_POND   = 12;
export const T_FLOOR_ROCK   = 13;

export type TrapType = 'spike' | 'alarm' | 'net';

export interface TrapPosition { col: number; row: number; type: TrapType; }

export interface AreaThemeRegion {
  region: { x: number; y: number; w: number; h: number };
  theme: EnemyTheme;
}

export interface ChestPosition { col: number; row: number; }

export interface FloorData {
  tiles: number[][];
  spawnCol: number;
  spawnRow: number;
  warpPositions: { col: number; row: number }[];
  trapPositions: TrapPosition[];
  chestPositions: ChestPosition[];
  entryPoints?: { col: number; row: number }[];
  areaThemes?: AreaThemeRegion[];
}

interface Rect { x: number; y: number; w: number; h: number; }

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ri(rng: () => number, lo: number, hi: number): number {
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

interface BspNode { bounds: Rect; left?: BspNode; right?: BspNode; room?: Rect; }

function bspSplit(node: BspNode, rng: () => number, minSide: number): void {
  const { w, h } = node.bounds;
  const canH = w >= minSide * 2 + 2;
  const canV = h >= minSide * 2 + 2;
  if (!canH && !canV) return;
  const horiz = canH && canV ? rng() < 0.5 : canV;
  if (horiz) {
    const cut = ri(rng, minSide, h - minSide - 1);
    node.left  = { bounds: { ...node.bounds, h: cut } };
    node.right = { bounds: { ...node.bounds, y: node.bounds.y + cut, h: h - cut } };
  } else {
    const cut = ri(rng, minSide, w - minSide - 1);
    node.left  = { bounds: { ...node.bounds, w: cut } };
    node.right = { bounds: { ...node.bounds, x: node.bounds.x + cut, w: w - cut } };
  }
  bspSplit(node.left, rng, minSide);
  bspSplit(node.right, rng, minSide);
}

function carveRooms(node: BspNode, rng: () => number): void {
  if (node.left && node.right) { carveRooms(node.left, rng); carveRooms(node.right, rng); return; }
  const { x, y, w, h } = node.bounds;
  const rw = ri(rng, 22, Math.min(w - 4, 55));
  const rh = ri(rng, 18, Math.min(h - 4, 45));
  const rx = x + ri(rng, 2, Math.max(2, w - rw - 2));
  const ry = y + ri(rng, 2, Math.max(2, h - rh - 2));
  node.room = { x: rx, y: ry, w: rw, h: rh };
}

function collectRooms(node: BspNode): Rect[] {
  if (!node.left && !node.right) return node.room ? [node.room] : [];
  return [...(node.left ? collectRooms(node.left) : []), ...(node.right ? collectRooms(node.right) : [])];
}

function center(r: Rect): { x: number; y: number } {
  return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) };
}

function carve(tiles: number[][], x: number, y: number): void {
  if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length)
    tiles[y][x] = T_FLOOR;
}

function carveWith(tiles: number[][], x: number, y: number, tile: number): void {
  if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length)
    tiles[y][x] = tile;
}

function corridor(tiles: number[][], a: Rect, b: Rect): void {
  const ca = center(a), cb = center(b);
  const x1 = Math.min(ca.x, cb.x), x2 = Math.max(ca.x, cb.x);
  for (let x = x1; x <= x2; x++) {
    carve(tiles, x, ca.y - 1); carve(tiles, x, ca.y); carve(tiles, x, ca.y + 1);
  }
  const y1 = Math.min(ca.y, cb.y), y2 = Math.max(ca.y, cb.y);
  for (let y = y1; y <= y2; y++) {
    carve(tiles, cb.x - 1, y); carve(tiles, cb.x, y); carve(tiles, cb.x + 1, y);
  }
}

function corridorThemed(tiles: number[][], a: Rect, b: Rect, tile: number): void {
  const ca = center(a), cb = center(b);
  const x1 = Math.min(ca.x, cb.x), x2 = Math.max(ca.x, cb.x);
  for (let x = x1; x <= x2; x++) {
    carveWith(tiles, x, ca.y - 1, tile);
    carveWith(tiles, x, ca.y,     tile);
    carveWith(tiles, x, ca.y + 1, tile);
  }
  const y1 = Math.min(ca.y, cb.y), y2 = Math.max(ca.y, cb.y);
  for (let y = y1; y <= y2; y++) {
    carveWith(tiles, cb.x - 1, y, tile);
    carveWith(tiles, cb.x,     y, tile);
    carveWith(tiles, cb.x + 1, y, tile);
  }
}

function roughenWalls(tiles: number[][], rng: () => number): void {
  const rows = tiles.length, cols = tiles[0].length;
  const DIRS4: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];

  const isFloor = (t: number) =>
    t === T_FLOOR || t === T_FLOOR_FOREST || t === T_FLOOR_DEAD || t === T_FLOOR_POND || t === T_FLOOR_ROCK || t === T_STONE;

  const s1 = tiles.map(r => [...r]);
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (!isFloor(s1[y][x])) continue;
      let w4 = 0;
      for (const [dy, dx] of DIRS4) if (s1[y+dy][x+dx] === T_WALL) w4++;
      if (w4 < 2) continue;
      let w8 = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if ((dy||dx) && (s1[y+dy]?.[x+dx] ?? T_WALL) === T_WALL) w8++;
      if (w8 >= 5 && rng() < 0.68) tiles[y][x] = T_WALL;
    }
  }

  const s2 = tiles.map(r => [...r]);
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (s2[y][x] !== T_WALL) continue;
      if (rng() > 0.09) continue;
      let adjFloor = 0;
      for (const [dy, dx] of DIRS4) if (isFloor(s2[y+dy][x+dx])) adjFloor++;
      if (adjFloor < 1 || adjFloor > 2) continue;
      let safe = false;
      for (const [dy, dx] of DIRS4) {
        if (!isFloor(s2[y+dy][x+dx])) continue;
        let nf = 0;
        for (const [dy2, dx2] of DIRS4)
          if (isFloor(s2[y+dy+dy2]?.[x+dx+dx2])) nf++;
        if (nf >= 2) { safe = true; break; }
      }
      if (safe) tiles[y][x] = T_FLOOR;
    }
  }

  const s3 = tiles.map(r => [...r]);
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (!isFloor(s3[y][x])) continue;
      if (rng() > 0.055) continue;
      let wallCard = 0, floorCard = 0;
      for (const [dy, dx] of DIRS4) {
        if (s3[y+dy][x+dx] === T_WALL) wallCard++;
        else floorCard++;
      }
      if (wallCard === 1 && floorCard >= 3) tiles[y][x] = T_WALL;
    }
  }
}

function placePillars(
  tiles: number[][], rooms: Rect[], spawnRoom: Rect,
  warpSet: Set<string>, rng: () => number,
): void {
  const rows = tiles.length, cols = tiles[0].length;
  const DIRS4: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];

  const isFloor = (t: number) =>
    t === T_FLOOR || t === T_FLOOR_FOREST || t === T_FLOOR_DEAD || t === T_FLOOR_POND || t === T_FLOOR_ROCK || t === T_STONE;

  for (const room of rooms) {
    if (room === spawnRoom) continue;
    if (room.w < 10 || room.h < 10) continue;
    const count = Math.max(1, Math.floor((room.w * room.h) / 110));
    let placed = 0, attempts = 0;
    while (placed < count && attempts < 60) {
      attempts++;
      const px = room.x + 3 + Math.floor(rng() * Math.max(1, room.w - 6));
      const py = room.y + 3 + Math.floor(rng() * Math.max(1, room.h - 6));
      if (px >= cols || py >= rows) continue;
      if (!isFloor(tiles[py][px])) continue;
      if (warpSet.has(`${px},${py}`)) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++)
        for (let dx = -2; dx <= 2 && !near; dx++)
          if ((tiles[py+dy]?.[px+dx] ?? T_WALL) === T_PILLAR) near = true;
      if (near) continue;
      tiles[py][px] = T_PILLAR;
      placed++;
    }
  }

  for (let y = 2; y < rows - 2; y++) {
    for (let x = 2; x < cols - 2; x++) {
      if (!isFloor(tiles[y][x])) continue;
      if (rng() > 0.06) continue;
      if (warpSet.has(`${x},${y}`)) continue;
      let wallCard = 0;
      for (const [dy, dx] of DIRS4) if (tiles[y+dy][x+dx] === T_WALL) wallCard++;
      if (wallCard !== 1) continue;
      const perpFloor = DIRS4.filter(([dy,dx]) => tiles[y+dy][x+dx] !== T_WALL);
      if (perpFloor.length < 3) continue;
      if (DIRS4.some(([dy,dx]) => tiles[y+dy][x+dx] === T_PILLAR)) continue;
      tiles[y][x] = T_PILLAR;
    }
  }
}

function placeStones(tiles: number[][], rooms: Rect[], spawnRoom: Rect, rng: () => number): void {
  const isFloor = (t: number) =>
    t === T_FLOOR || t === T_FLOOR_FOREST || t === T_FLOOR_DEAD || t === T_FLOOR_POND || t === T_FLOOR_ROCK;
  for (const room of rooms) {
    if (room === spawnRoom) continue;
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        if (isFloor(tiles[y][x]) && rng() < 0.09) tiles[y][x] = T_STONE;
      }
    }
  }
}

function pickWarpRooms(rooms: Rect[], spawnRoom: Rect, rng: () => number, cols: number, rows: number): Rect[] {
  const SX = 4, SY = 2;
  const sW = Math.floor(cols / SX), sH = Math.floor(rows / SY);
  const buckets: Rect[][] = Array.from({ length: SX * SY }, () => []);
  for (const room of rooms) {
    if (room === spawnRoom) continue;
    const c = center(room);
    buckets[Math.min(SY-1, Math.floor(c.y/sH)) * SX + Math.min(SX-1, Math.floor(c.x/sW))].push(room);
  }
  return buckets.map(b => b.length ? b[Math.floor(rng() * b.length)] : null).filter(Boolean) as Rect[];
}

function generateTraps(
  tiles: number[][], rooms: Rect[], spawnRoom: Rect,
  warpSet: Set<string>, rng: () => number, count: number,
): TrapPosition[] {
  const isFloor = (t: number) =>
    t === T_FLOOR || t === T_FLOOR_FOREST || t === T_FLOOR_DEAD || t === T_FLOOR_POND || t === T_FLOOR_ROCK || t === T_STONE;
  const sc = center(spawnRoom);
  const pool: { col: number; row: number }[] = [];
  for (const room of rooms) {
    if (room === spawnRoom) continue;
    for (let y = room.y + 2; y < room.y + room.h - 2; y++) {
      for (let x = room.x + 2; x < room.x + room.w - 2; x++) {
        if (isFloor(tiles[y][x]) && !warpSet.has(`${x},${y}`)) {
          if (Math.sqrt((x-sc.x)**2 + (y-sc.y)**2) > 10) pool.push({ col: x, row: y });
        }
      }
    }
  }
  const traps: TrapPosition[] = [];
  const used = Math.min(count, pool.length);
  for (let i = 0; i < used; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    const r = rng();
    traps.push({ col: pool[i].col, row: pool[i].row, type: r < 0.55 ? 'spike' : r < 0.82 ? 'alarm' : 'net' });
  }
  return traps;
}

/** Place one chest per 6 rooms, preferring rooms far from spawn. */
function generateChests(
  tiles: number[][], rooms: Rect[], spawnRoom: Rect,
  warpSet: Set<string>, rng: () => number,
): ChestPosition[] {
  const isFloor = (t: number) =>
    t === T_FLOOR || t === T_FLOOR_FOREST || t === T_FLOOR_DEAD || t === T_FLOOR_POND || t === T_FLOOR_ROCK || t === T_STONE;
  const sc = center(spawnRoom);
  const candidates = rooms
    .filter(r => r !== spawnRoom)
    .sort((a, b) => {
      const ca = center(a), cb = center(b);
      return (cb.x - sc.x) ** 2 + (cb.y - sc.y) ** 2 - ((ca.x - sc.x) ** 2 + (ca.y - sc.y) ** 2);
    });
  const chests: ChestPosition[] = [];
  for (let i = 0; i < candidates.length; i += ri(rng, 5, 8)) {
    const c = center(candidates[i]);
    const col = c.x + ri(rng, -2, 2);
    const row = c.y + ri(rng, -2, 2);
    if (col < 2 || row < 2 || col >= tiles[0].length - 2 || row >= tiles.length - 2) continue;
    if (!isFloor(tiles[row][col])) continue;
    if (warpSet.has(`${col},${row}`)) continue;
    chests.push({ col, row });
  }
  return chests;
}

// ── Floor 1 / 3-10 generator ─────────────────────────────────────────────────

function generateFloor1Plus(seed: number): FloorData {
  const cols = DUNGEON_COLS, rows = DUNGEON_ROWS;
  const rng  = mulberry32(seed);
  const tiles: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(T_WALL));

  const root: BspNode = { bounds: { x: 1, y: 1, w: cols - 2, h: rows - 2 } };
  bspSplit(root, rng, 30);
  carveRooms(root, rng);

  const rooms = collectRooms(root);
  for (const r of rooms) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++)
        tiles[y][x] = T_FLOOR;
  }
  for (let i = 1; i < rooms.length; i++) corridor(tiles, rooms[i - 1], rooms[i]);

  const spawnRoom = rooms[Math.floor(rng() * rooms.length)];
  const spawnC    = center(spawnRoom);

  const warpRooms     = pickWarpRooms(rooms, spawnRoom, rng, cols, rows);
  const warpPositions = warpRooms.map((r, idx) => {
    const c = center(r); tiles[c.y][c.x] = T_WARP; return { col: c.x, row: c.y, padIndex: idx };
  });
  const warpSet = new Set(warpPositions.map(w => `${w.col},${w.row}`));

  roughenWalls(tiles, rng);
  placePillars(tiles, rooms, spawnRoom, warpSet, rng);
  placeStones(tiles, rooms, spawnRoom, rng);

  const trapPositions  = generateTraps(tiles, rooms, spawnRoom, warpSet, rng, Math.max(15, rooms.length));
  const chestPositions = generateChests(tiles, rooms, spawnRoom, warpSet, rng);

  return { tiles, spawnCol: spawnC.x, spawnRow: spawnC.y, warpPositions, trapPositions, chestPositions };
}

// ── Floor 2 four-area generator ──────────────────────────────────────────────

function nearestRoom(rooms: Rect[], tx: number, ty: number): Rect {
  return rooms.reduce((best, r) => {
    const c = center(r);
    const d = Math.abs(c.x - tx) + Math.abs(c.y - ty);
    const bc = center(best);
    const bd = Math.abs(bc.x - tx) + Math.abs(bc.y - ty);
    return d < bd ? r : best;
  });
}

function farthestRooms(rooms: Rect[], fromX: number, fromY: number, n: number): Rect[] {
  return [...rooms]
    .sort((a, b) => {
      const ca = center(a), cb = center(b);
      const da = (ca.x - fromX) ** 2 + (ca.y - fromY) ** 2;
      const db = (cb.x - fromX) ** 2 + (cb.y - fromY) ** 2;
      return db - da;
    })
    .slice(0, n);
}

function generateFloor2(seed: number): FloorData {
  const QW = DUNGEON_COLS, QH = DUNGEON_ROWS;
  const totalCols = FLOOR2_COLS, totalRows = FLOOR2_ROWS;
  const rng = mulberry32(seed);

  const tiles: number[][] = Array.from({ length: totalRows }, () => new Array(totalCols).fill(T_WALL));

  const quads = [
    { x: 0,  y: 0,  w: QW, h: QH, theme: 'forest'   as EnemyTheme, ft: T_FLOOR_FOREST },
    { x: QW, y: 0,  w: QW, h: QH, theme: 'rock'      as EnemyTheme, ft: T_FLOOR_ROCK   },
    { x: 0,  y: QH, w: QW, h: QH, theme: 'deadland'  as EnemyTheme, ft: T_FLOOR_DEAD   },
    { x: QW, y: QH, w: QW, h: QH, theme: 'pond'      as EnemyTheme, ft: T_FLOOR_POND   },
  ];

  const allQuadRooms: Rect[][] = [];

  // Generate BSP for each quadrant using plain T_FLOOR first
  for (const q of quads) {
    const root: BspNode = { bounds: { x: q.x + 1, y: q.y + 1, w: q.w - 2, h: q.h - 2 } };
    bspSplit(root, rng, 30);
    carveRooms(root, rng);
    const rooms = collectRooms(root);

    for (const r of rooms) {
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          tiles[y][x] = T_FLOOR;
    }
    for (let i = 1; i < rooms.length; i++) corridor(tiles, rooms[i - 1], rooms[i]);
    allQuadRooms.push(rooms);
  }

  // Center hub room at the intersection of all 4 quadrants
  const cx = QW, cy = QH;
  const hubRoom: Rect = { x: cx - 7, y: cy - 7, w: 14, h: 14 };
  for (let y = hubRoom.y; y < hubRoom.y + hubRoom.h; y++)
    for (let x = hubRoom.x; x < hubRoom.x + hubRoom.w; x++)
      tiles[y][x] = T_FLOOR;

  // Connect each quadrant's nearest room to the hub
  for (let qi = 0; qi < 4; qi++) {
    const q = quads[qi];
    const qCenterX = q.x + q.w / 2, qCenterY = q.y + q.h / 2;
    const near = nearestRoom(allQuadRooms[qi], qCenterX, qCenterY);
    corridor(tiles, near, hubRoom);
  }

  // Single pass roughen on full map
  roughenWalls(tiles, rng);

  // Re-theme floor tiles per quadrant (convert plain T_FLOOR → themed tile)
  for (const q of quads) {
    for (let y = q.y; y < q.y + q.h; y++) {
      for (let x = q.x; x < q.x + q.w; x++) {
        if (tiles[y][x] === T_FLOOR) tiles[y][x] = q.ft;
      }
    }
  }
  // Hub and cross-quadrant corridor tiles stay T_FLOOR (neutral transition)

  // Exit portal in hub center → this is the floor-3 warp
  tiles[cy][cx] = T_WARP;
  const warpPositions = [{ col: cx, row: cy }];
  const warpSet = new Set<string>([`${cx},${cy}`]);

  // Entry points: 2 per quadrant = 8 total (where players arrive from floor 1 warp pads)
  const entryPoints: { col: number; row: number }[] = [];
  for (let qi = 0; qi < 4; qi++) {
    const q = quads[qi];
    const qcx = q.x + q.w / 2, qcy = q.y + q.h / 2;
    const far = farthestRooms(allQuadRooms[qi], qcx, qcy, 4);
    for (let k = 0; k < 2 && k < far.length; k++) {
      const c = center(far[k]);
      // Entry portals look like warp tiles visually but have no WarpPad object
      tiles[c.y][c.x] = T_WARP;
      warpSet.add(`${c.x},${c.y}`);
      entryPoints.push({ col: c.x, row: c.y });
    }
  }

  // Pillars and stones across the full map
  const allRooms = [...allQuadRooms.flat(), hubRoom];
  placePillars(tiles, allRooms, hubRoom, warpSet, rng);
  placeStones(tiles, allRooms, hubRoom, rng);

  // Traps (more traps on floor 2)
  const trapPositions  = generateTraps(tiles, allRooms, hubRoom, warpSet, rng, Math.max(40, allRooms.length * 2));
  const chestPositions = generateChests(tiles, allRooms, hubRoom, warpSet, rng);

  const spawnCol = cx + 2;
  const spawnRow = cy + 2;

  return {
    tiles, spawnCol, spawnRow, warpPositions, trapPositions, chestPositions, entryPoints,
    areaThemes: quads.map(q => ({ region: { x: q.x, y: q.y, w: q.w, h: q.h }, theme: q.theme })),
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export function generateFloor(seed: number, floor = 1): FloorData {
  if (floor === 2) return generateFloor2(seed);
  return generateFloor1Plus(seed);
}
