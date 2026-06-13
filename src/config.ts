import type { PhysType, BodyType, ElemFamily, Element } from './types';

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
  crit:     { baseChancePct: 3, perAgiPct: 0.6, dmgPct: 135, capChancePct: 60 },
  poise:    { staggerDurationMs: 500, windowMs: 3000 },
  inputBuffer:     300,   // ms — queued input stays valid this long
  spawnProtection: 1000,  // ms — no damage on first second of a floor
  knockback:       { player: 90, enemy: 80 },
  potionChannel:   1500,  // ms — rooted while drinking
  // §16 — Potion heal values (S=small, M=medium, L=large)
  potion:   { healS: 40, healM: 90, healL: 180 },
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

  // §12 — Leveling (xpCurve is expForLevel() above)
  level: {
    cap:               50,
    statPointsPerLevel: 5,
    skillPointsPerLevel: 1,
    softCapStat:       60,   // STR/DEX/INT scaling coefficient bends above this
    softCapCoeff:      0.6,
  },

  // §12 §18 — Floor scaling (multiply enemy stats each floor)
  floorScale: {
    enemyHpPerFloor:    0.18,
    enemyDmgPerFloor:   0.15,
    lootTierPerFloor:   0.12,
  },

  // §18 — Elite / Champion spawn chances
  elite: {
    chanceBase:      0.08,  // base chance a spawn is Elite (rises per floor)
    chancePerFloor:  0.02,
    championChance:  0.015, // chance a spawn is Champion instead of regular Elite
  },

  // §20 — Anomaly director (perFloorRollChance = base probability any floor gets an anomaly)
  anomaly: {
    perFloorRollChance: 0.22,
    // Per-anomaly weights used by rollAnomaly() — higher = more common
    weights: {
      dimensional_rift:    { weight: 5, minFloor: 5, maxFloor: 9 },
      mirror_rift:         { weight: 4, minFloor: 3, maxFloor: 9 },
      hunter_invasion:     { weight: 4, minFloor: 4, maxFloor: 9 },
      wandering_merchant:  { weight: 6, minFloor: 2, maxFloor: 9 },
      cursed_bargain:      { weight: 4, minFloor: 3, maxFloor: 9 },
      gamblers_chest:      { weight: 6, minFloor: 1, maxFloor: 9 },
      caged_ally:          { weight: 4, minFloor: 2, maxFloor: 8 },
      blood_moon:          { weight: 2, minFloor: 5, maxFloor: 9 },
      echo_fallen_hero:    { weight: 3, minFloor: 3, maxFloor: 9 },
      beast_stampede:      { weight: 3, minFloor: 1, maxFloor: 6 },
      gravelord:           { weight: 2, minFloor: 3, maxFloor: 9 },
      avarice:             { weight: 3, minFloor: 2, maxFloor: 9 },
      clockwork_judge:     { weight: 2, minFloor: 4, maxFloor: 9 },
      old_friend:          { weight: 2, minFloor: 3, maxFloor: 9 },
      hungering_dark:      { weight: 2, minFloor: 4, maxFloor: 9 },
    },
  },

  // §21 — Camp & survival
  camp: {
    restHealPct:             0.60,
    restManaPct:             0.50,
    ambushChanceBase:        0.15,
    ambushChancePerFloor:    0.05,
    watchReductionPerComp:   0.10,
    watchReductionMax:       0.20,
  },

  // §24 — Rarity weights for random gear drops (mythic = 0; only from anomalies)
  rarityWeights: {
    common:    60,
    uncommon:  25,
    rare:      10,
    epic:       4,
    legendary:  1,
    mythic:     0,
  },

  /** Global difficulty multiplier — scales enemyHp, enemyDmg, and elite spawn chance. */
  difficultyMod: 1.0,
} as const;

// ── §E1.2 — Physical type chart (body type × phys type → damage multiplier) ──
export const PHYS_CHART: Record<BodyType, Record<PhysType, number>> = {
  flesh:      { slash: 1.1,  blunt: 1.0,  pierce: 1.0  },
  armored:    { slash: 0.6,  blunt: 1.3,  pierce: 0.9  },
  bone:       { slash: 0.8,  blunt: 1.3,  pierce: 0.7  },
  gelatinous: { slash: 1.3,  blunt: 0.5,  pierce: 1.0  },
  chitin:     { slash: 0.7,  blunt: 1.1,  pierce: 1.3  },
  construct:  { slash: 0.8,  blunt: 1.2,  pierce: 0.5  },
  ethereal:   { slash: 0.5,  blunt: 0.5,  pierce: 0.5  },
  plant:      { slash: 1.2,  blunt: 0.8,  pierce: 0.9  },
  aerial:     { slash: 0.9,  blunt: 0.7,  pierce: 1.3  },
};

/** True elements (fire/ice/lightning/poison/void/radiant). Excludes physical/blunt/none. */
export type GameElement = Exclude<Element, 'none' | 'physical' | 'blunt'>;

// ── §E1.3 — Elemental effectiveness chart (enemy family × element → multiplier)
// -0.5 = absorb (heals enemy), 0 = immune, 0.5 = resist, 1.0 = neutral, 2.0 = weak
export const ELEM_CHART: Record<ElemFamily, Partial<Record<GameElement, number>>> = {
  beast:    { fire: 1.5,   ice: 1.0,   lightning: 1.0,  poison: 2.0,  void: 1.0,   radiant: 0.8  },
  plant:    { fire: 2.0,   ice: 1.2,   lightning: 1.0,  poison: 0,    void: 1.0,   radiant: 0.8  },
  aquatic:  { fire: 0.5,   ice: 1.5,   lightning: 2.0,  poison: 1.0,  void: 1.0,   radiant: 1.0  },
  fire:     { fire: -0.5,  ice: 2.0,   lightning: 1.0,  poison: 0.5,  void: 1.0,   radiant: 1.0  },
  ice:      { fire: 2.0,   ice: -0.5,  lightning: 1.0,  poison: 0.5,  void: 1.0,   radiant: 1.0  },
  construct:{ fire: 0.75,  ice: 0.75,  lightning: 2.0,  poison: 0,    void: 1.0,   radiant: 1.0  },
  undead:   { fire: 1.2,   ice: 1.0,   lightning: 1.0,  poison: 0,    void: 0.5,   radiant: 2.0  },
  spectral: { fire: 1.0,   ice: 1.0,   lightning: 1.0,  poison: 0,    void: 1.2,   radiant: 2.0  },
  void:     { fire: 1.0,   ice: 1.0,   lightning: 1.0,  poison: 0.5,  void: -0.5,  radiant: 2.0  },
  insect:   { fire: 1.5,   ice: 2.0,   lightning: 1.2,  poison: 0.5,  void: 1.0,   radiant: 1.0  },
  // Storm Elemental family: absorbs lightning (enrages); weak to fire and ice
  storm:    { fire: 1.5,   ice: 1.5,   lightning: -0.5, poison: 0.5,  void: 1.0,   radiant: 1.0  },
};

// ── §E14.3 — Tuning V2 (affinity system knobs) ────────────────────────────────
export const TUNING_V2 = {
  affinity: {
    physMult: { weak: 1.3, neutral: 1.0, tough: 0.8, resist: 0.6 },
    elemMult: { weak: 2.0, neutral: 1.0, resist: 0.5, immune: 0.0, absorb: -0.5 },
    elementValuePerTier: 4,
    elementalRawTradeoff: 0.85,
  },
  status: {
    bleed:  { perTick: 6, ticks: 6, moveBonus: 1.5 },
    ko:     { threshold: 100, toppleMs: 1500, dmgBonusPct: 30 },
    wound:  { threshold: 80, bonusPct: 25 },
    freezeSolidMs: 1200, shatterBonusPct: 60,
    wetLightningMult: 2.0, wetFireMult: 0.5, oilIgniteBurnMult: 2.0,
  },
  research: { kills: [0, 5, 15, 30], breaksGrantBonus: 2 },
  masteryCapPerFamily: 5,
  tonics: { durationMs: 90000, oilDurationMs: 90000 },
  elite: { wardedResistTier: 1, unstableCycleMs: 5000 },
  bossElementPhase: { brandObsidianAtPct: 40, ysoldBlizzardAtPct: 45 },
} as const;

