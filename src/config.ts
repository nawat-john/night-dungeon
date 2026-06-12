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

/** §12 XP curve: slow on purpose — out-skill, not out-grind. */
export function expForLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.6));
}

export const LEVEL_CAP = 50;

export const FOV_RADIUS = 9;  // tiles visible around the player

export const TRAP_SPIKE_DMG    = 26;
export const TRAP_ALARM_RADIUS = 85;  // pixel radius for alarm blast
export const TRAP_NET_DURATION = 2400; // ms slow duration

export const INTERACT_RANGE = 52;
export const ATTACK_COOLDOWN = 600;
export const IFRAMES_DURATION = 450; // reduced — punishment window is shorter

export const ENEMY_DETECT_RANGE    = 160;  // sight (requires LOS-ish proximity)
export const ENEMY_HEAR_RANGE      = 360;  // sound: detected while player is moving, no LOS
export const ENEMY_ATTACK_RANGE    = 50; // slightly outside player melee range (44px) — no free facetanking
export const ENEMY_ATTACK_COOLDOWN = 900;  // faster attacks — no mercy

// Ambient enemy spawning
export const AMBIENT_SPAWN_INTERVAL = 22000; // ms between spawns
export const AMBIENT_SPAWN_MIN_DIST = 8;     // tiles
export const AMBIENT_SPAWN_MAX_DIST = 22;    // tiles

export const INN_COST = 30;

// §11 / §31 — Combat tuning (all starting-point values; tune against telemetry)
export const TUNING = {
  stamina:  { max: 100, regenPerSec: 18, regenDelayMs: 600,
              dodge: 25, sprintPerSec: 12, light: 8, heavy: 22 },
  // dodge: 12 total frames @ 60 fps ≈ 200 ms; i-frames on frames 3–9 = ms 50–150
  dodge:    { totalMs: 200, iFrameStartMs: 50, iFrameEndMs: 150 },
  // light attack: 10 startup / 4 active / 16 recovery frames @ 60 fps
  light:    { startupMs: 167, activeMs: 67, recoveryMs: 267, mv: 0.32, poiseDmg: 12 },
  // heavy attack: 16 startup / 4 active / 26 recovery frames @ 60 fps
  heavy:    { startupMs: 267, activeMs: 67, recoveryMs: 433, mv: 0.55, poiseDmg: 22 },
  crit:     { baseChancePct: 3, perAgiPct: 0.6, dmgPct: 135 },
  poise:    { staggerDurationMs: 500, windowMs: 3000 },
  inputBuffer:     300,   // ms — queued input stays valid this long
  spawnProtection: 1000,  // ms — no damage on first second of a floor
  knockback:       { player: 90, enemy: 80 },
  potionChannel:   1500,  // ms — rooted while drinking
  // §11 guard / block — Tanker or shield-equipped only
  guard:    { blockPct: 0.60, perfectWindowMs: 100, staminaCostFactor: 0.30 },

  // §13 — Weapon-family specific tuning
  greatsword: {
    charge1Ms: 300,   // tap X → tier-1 charge (MV 0.55, standard arc)
    charge2Ms: 600,   // hold X for this long → tier-2 (MV 0.95, wide arc)
    staminaCost1: 22,
    staminaCost2: 38,
  },
  dagger: {
    frenzyDrainPerSec: 14, // stamina/s while Frenzy is active
    frenzySpeedMult:   0.65, // recovery time multiplier in Frenzy mode
  },
  crossbow: {
    reloadMs:    900,   // ms between shots
    pierceCount: 2,     // max enemies hit per bolt
  },
  gauge: {
    edgeMax:          100,
    edgeDecayPerHit:  8,    // points lost per melee swing that connects
    edgeBluntThresh:  20,   // below this → "blunt" mode (−50% poise dmg)
    comboWindowPct:   0.40, // last X% of recovery = valid combo input window
    flowMax:          5,    // max Flow stacks (Gauntlets)
  },
} as const;

