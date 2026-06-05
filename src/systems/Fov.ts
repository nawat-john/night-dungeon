import { T_WALL, T_PILLAR } from './FloorGenerator';

/**
 * Circular field-of-view via Bresenham line-of-sight.
 * For every tile within `radius` tiles of (px,py), casts a straight line;
 * if no wall tile blocks the path the tile is marked visible.
 * Wall tiles themselves are visible (you can see the wall, not through it).
 */
export function computeFOV(
  tiles: number[][],
  cols: number,
  rows: number,
  px: number,
  py: number,
  radius: number,
  markVisible: (col: number, row: number) => void,
): void {
  markVisible(px, py);
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const tx = px + dx;
      const ty = py + dy;
      if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
      if (bresenhamLOS(tiles, cols, rows, px, py, tx, ty)) {
        markVisible(tx, ty);
      }
    }
  }
}

function bresenhamLOS(
  tiles: number[][],
  cols: number,
  rows: number,
  x0: number, y0: number,
  x1: number, y1: number,
): boolean {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;

  while (true) {
    if (x === x1 && y === y1) return true;
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    // Walls and pillars block vision unless they ARE the target tile
    const t = tiles[y][x];
    if ((t === T_WALL || t === T_PILLAR) && (x !== x0 || y !== y0)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx)  { err += dx; y += sy; }
  }
}
