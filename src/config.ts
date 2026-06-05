export const TILE = 32;
export const RES_W = 480;   // logical game world width in pixels
export const RES_H = 270;   // logical game world height in pixels
export const PLAYER_SPEED = 120;

/** Integer zoom level that fits the logical world into the given viewport. */
export function calcZoom(viewW: number, viewH: number): number {
  return Math.max(1, Math.floor(Math.min(viewW / RES_W, viewH / RES_H)));
}

export const MAP_COLS = 64;
export const MAP_ROWS = 52;
export const DUNGEON_COLS = 500;
export const DUNGEON_ROWS = 400;
export const FLOOR2_COLS  = DUNGEON_COLS * 2;
export const FLOOR2_ROWS  = DUNGEON_ROWS * 2;

export function expForLevel(level: number): number {
  return level * 150;
}

export const FOV_RADIUS = 9;  // tiles visible around the player

export const TRAP_SPIKE_DMG    = 26;
export const TRAP_ALARM_RADIUS = 85;  // pixel radius for alarm blast
export const TRAP_NET_DURATION = 2400; // ms slow duration

export const INTERACT_RANGE = 52;
export const ATTACK_COOLDOWN = 600;
export const IFRAMES_DURATION = 450; // reduced — punishment window is shorter

export const ENEMY_DETECT_RANGE    = 160;  // sight (requires LOS-ish proximity)
export const ENEMY_HEAR_RANGE      = 360;  // sound: detected while player is moving, no LOS
export const ENEMY_ATTACK_RANGE    = 36;
export const ENEMY_ATTACK_COOLDOWN = 900;  // faster attacks — no mercy

// Ambient enemy spawning
export const AMBIENT_SPAWN_INTERVAL = 22000; // ms between spawns
export const AMBIENT_SPAWN_MIN_DIST = 8;     // tiles
export const AMBIENT_SPAWN_MAX_DIST = 22;    // tiles

export const INN_COST = 30;
