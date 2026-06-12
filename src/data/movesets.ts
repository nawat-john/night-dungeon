/**
 * §13 — Weapon Archetypes & Movesets
 *
 * Each weapon family has:
 *  - light: ComboChain — up to 3 sequential moves; input accepted in the
 *    last TUNING.gauge.comboWindowPct of recovery
 *  - heavy: AttackMove — single charged/powerful swing
 *  - gauge: which gauge mechanic this family uses
 */

export type WeaponFamily =
  | 'sword'
  | 'greatsword'
  | 'twin_daggers'
  | 'mace'
  | 'spear'
  | 'bow'
  | 'crossbow'
  | 'staff'
  | 'tome'
  | 'gauntlets';

export type WeaponGaugeKind = 'edge' | 'frenzy' | 'charge' | 'flow' | 'none';

export interface AttackMove {
  mv:           number;   // motion value — multiplied by attackDmg
  startupMs:    number;
  activeMs:     number;
  recoveryMs:   number;
  poiseDmg:     number;
  range:        number;   // hitbox reach in pixels from player centre
  arc:          number;   // hitbox half-angle in degrees (180 = full front semi-circle)
  staminaCost:  number;
  canRollCancel: boolean;
}

/** A sequence of light-attack moves. The last entry loops when combo is maxed. */
export type ComboChain = [AttackMove, ...AttackMove[]];

export interface WeaponMoveset {
  family:           WeaponFamily;
  light:            ComboChain;
  heavy:            AttackMove;
  gauge:            WeaponGaugeKind;
  /** Edge gauge: points lost per melee hit that connects (omit for non-edge weapons) */
  edgeDecayPerHit?: number;
  /** Ranged reload window in ms (bow / crossbow) */
  rangedCooldownMs?: number;
  /** Crossbow only: how many enemies the bolt can pierce */
  pierceCount?:     number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper builders
// ─────────────────────────────────────────────────────────────────────────────

function light(
  mv: number, startup: number, active: number, recovery: number,
  poise: number, range: number, arc: number, stamina: number,
  canRoll = true,
): AttackMove {
  return { mv, startupMs: startup, activeMs: active, recoveryMs: recovery,
           poiseDmg: poise, range, arc, staminaCost: stamina, canRollCancel: canRoll };
}

// ─────────────────────────────────────────────────────────────────────────────
// Moveset definitions per family
// ─────────────────────────────────────────────────────────────────────────────

// ── Sword ────────────────────────────────────────────────────────────────────
// Classic balanced: slash → slash → thrust. Third hit has extra range.
const SWORD: WeaponMoveset = {
  family: 'sword',
  gauge:  'edge',
  edgeDecayPerHit: 8,
  light: [
    light(0.30, 167, 67, 250, 12, 44, 90, 8),   // 1st slash
    light(0.32, 150, 67, 250, 12, 44, 80, 8),   // 2nd slash (slightly faster)
    light(0.42, 200, 67, 320, 18, 56, 60, 10),  // 3rd thrust (more reach, narrower)
  ],
  heavy: light(0.60, 267, 67, 450, 26, 50, 100, 22, false),
};

// ── Greatsword ───────────────────────────────────────────────────────────────
// Slow, no roll-cancel. Two light hits only. Heavy has charge tier handled in Player.
const GREATSWORD: WeaponMoveset = {
  family: 'greatsword',
  gauge:  'charge',
  light: [
    light(0.45, 267, 83, 400, 20, 58, 90,  14, false), // wide overhead
    light(0.50, 300, 83, 450, 24, 58, 110, 16, false), // follow-through
  ],
  heavy: light(0.95, 600, 100, 600, 45, 64, 140, 38, false), // tier-2 held charge
};

// ── Twin Daggers ─────────────────────────────────────────────────────────────
// Fast flurry chain (3 hits). Heavy = Frenzy toggle (handled specially in Player).
const TWIN_DAGGERS: WeaponMoveset = {
  family: 'twin_daggers',
  gauge:  'frenzy',
  light: [
    light(0.22, 100, 50, 180, 8,  38, 70, 6),  // quick slash
    light(0.22, 100, 50, 180, 8,  38, 70, 6),  // cross-slash
    light(0.30, 130, 50, 220, 10, 40, 80, 7),  // finishing flourish
  ],
  heavy: light(0.40, 200, 67, 350, 18, 42, 80, 18, true), // Frenzy toggle (special handling)
};

// ── Mace / Hammer ────────────────────────────────────────────────────────────
// Blunt: high poiseDmg per hit → stagger enemies quickly. Slow combo.
const MACE: WeaponMoveset = {
  family: 'mace',
  gauge:  'edge',
  edgeDecayPerHit: 5,  // mace edge decays slower (blunt doesn't need to be sharp)
  light: [
    light(0.35, 200, 67, 300, 20, 46, 80,  10),  // overhead smash
    light(0.38, 220, 67, 320, 22, 46, 80,  10),  // follow smash
  ],
  heavy: light(0.65, 350, 83, 500, 40, 50, 90, 25, false),
};

// ── Spear / Halberd ──────────────────────────────────────────────────────────
// Extended reach (range 68 vs sword 44). Narrow arc. Heavy = brace thrust.
const SPEAR: WeaponMoveset = {
  family: 'spear',
  gauge:  'edge',
  edgeDecayPerHit: 6,
  light: [
    light(0.30, 167, 67, 250, 12, 68, 45, 8),   // jab
    light(0.28, 150, 67, 240, 10, 68, 45, 8),   // quick jab
    light(0.38, 200, 67, 300, 16, 76, 40, 10),  // lunge (even longer)
  ],
  heavy: light(0.55, 300, 100, 400, 30, 80, 35, 22, false), // brace counter-thrust
};

// ── Bow ───────────────────────────────────────────────────────────────────────
// Ranged. Only one "light" entry (fired as ranged, not melee). Ammo tracked in inventory.
const BOW: WeaponMoveset = {
  family:          'bow',
  gauge:           'none',
  rangedCooldownMs: 600,
  light: [
    light(0.45, 50, 100, 200, 0, 320, 10, 0),  // arrow (range = projectile, range in px handled separately)
  ],
  heavy: light(0.80, 400, 100, 300, 0, 320, 10, 15, false), // charged shot
};

// ── Crossbow ─────────────────────────────────────────────────────────────────
// Slower reload but pierces up to 2 enemies. Ammo tracked separately.
const CROSSBOW: WeaponMoveset = {
  family:          'crossbow',
  gauge:           'none',
  rangedCooldownMs: 900,
  pierceCount:     2,
  light: [
    light(0.55, 100, 100, 500, 0, 320, 8, 0),  // bolt (pierce)
  ],
  heavy: light(0.55, 100, 100, 500, 0, 320, 8, 0), // same as light (no special heavy for now)
};

// ── Staff ────────────────────────────────────────────────────────────────────
// Ranged fireball. Light = normal fireball, heavy = charged (bigger, slower).
const STAFF: WeaponMoveset = {
  family:          'staff',
  gauge:           'none',
  rangedCooldownMs: 600,
  light: [
    light(0.50, 100, 100, 300, 0, 280, 10, 10),
  ],
  heavy: light(0.80, 500, 150, 400, 0, 280, 15, 20, false),
};

// ── Tome + Focus ─────────────────────────────────────────────────────────────
// Cast → place glyph. Second cast → detonate AoE at glyph position.
// The "heavy" is not used; glyph detonation is handled by DungeonScene.
const TOME: WeaponMoveset = {
  family:          'tome',
  gauge:           'none',
  rangedCooldownMs: 400,
  light: [
    light(0.60, 150, 100, 350, 0, 240, 10, 12),  // glyph cast
  ],
  heavy: light(0.60, 150, 100, 350, 0, 240, 10, 12),
};

// ── Gauntlets / Claws ────────────────────────────────────────────────────────
// Flow stacks build on consecutive perfect dodges. High speed, short range.
const GAUNTLETS: WeaponMoveset = {
  family: 'gauntlets',
  gauge:  'flow',
  light: [
    light(0.25, 100, 50, 180, 10, 34, 70, 5),   // jab
    light(0.25, 100, 50, 180, 10, 34, 70, 5),   // cross
    light(0.35, 130, 50, 220, 14, 36, 90, 6),   // uppercut
  ],
  heavy: light(0.50, 200, 67, 300, 22, 38, 80, 18, true),
};

// ─────────────────────────────────────────────────────────────────────────────
// Lookup table
// ─────────────────────────────────────────────────────────────────────────────

export const MOVESETS: Record<WeaponFamily, WeaponMoveset> = {
  sword:        SWORD,
  greatsword:   GREATSWORD,
  twin_daggers: TWIN_DAGGERS,
  mace:         MACE,
  spear:        SPEAR,
  bow:          BOW,
  crossbow:     CROSSBOW,
  staff:        STAFF,
  tome:         TOME,
  gauntlets:    GAUNTLETS,
};

/** Return the moveset for a given weapon family, falling back to sword. */
export function getMoveset(family: WeaponFamily | undefined): WeaponMoveset {
  return family ? MOVESETS[family] : MOVESETS.sword;
}
