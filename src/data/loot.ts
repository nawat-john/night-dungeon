/**
 * §24 — Economy, Loot Tables & Drop Rates
 *
 * Each enemy / chest / boss has a weighted `dropTable[{ itemId, weight, qtyRange, condition? }]`.
 * Conditions allow "only drops if part broken" (boss mats) or "only on Champion".
 * Floor number shifts the table toward higher tiers (rarity gate per `minFloor`).
 * Pity / anti-streak: a gentle dry-streak nudge tracked in the `LootSystem`.
 */

export type DropCondition = 'always' | 'champion_only' | 'part_broken' | 'status_kill' | 'element_kill';

export interface DropEntry {
  itemId: string;
  /** Relative weight — higher = more common within this table. */
  weight: number;
  /** [min, max] quantity inclusive. */
  qtyRange: [number, number];
  /** Optional floor minimum for this entry to be eligible. */
  minFloor?: number;
  /** Special condition override (default 'always'). */
  condition?: DropCondition;
}

export interface LootTable {
  /** Gold drop range [min, max]. 0 = no gold. */
  goldRange?: [number, number];
  entries: DropEntry[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function qty(table: LootTable): LootTable { return table; }

// ─── Per-enemy loot tables ────────────────────────────────────────────────────
// Key = EnemyDef.id

export const ENEMY_LOOT: Record<string, LootTable> = {

  // ── Floor 1: Goblin / Cave ─────────────────────────────────────────────────

  goblin: qty({
    goldRange: [5, 15],
    entries: [
      { itemId: 'goblin_tooth',  weight: 50, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 30, qtyRange: [1, 1] },
      { itemId: 'health_potion', weight: 12, qtyRange: [1, 1] },
      { itemId: 'mana_stone_1',  weight: 6,  qtyRange: [1, 1] },
      // Uncommon gear drop (scaled by floor)
      { itemId: 'sword_t1',      weight: 2,  qtyRange: [1, 1] },
    ],
  }),

  goblin_shaman: qty({
    goldRange: [8, 20],
    entries: [
      { itemId: 'goblin_tooth',  weight: 40, qtyRange: [1, 1] },
      { itemId: 'iron_ore',      weight: 25, qtyRange: [1, 2] },
      { itemId: 'mana_stone_1',  weight: 20, qtyRange: [1, 1] },
      { itemId: 'dried_herb',    weight: 12, qtyRange: [1, 2] },
      { itemId: 'staff_t1',      weight: 3,  qtyRange: [1, 1] },
    ],
  }),

  bat: qty({
    goldRange: [0, 5],
    entries: [
      { itemId: 'feather',       weight: 60, qtyRange: [1, 2] },
      { itemId: 'mana_stone_1',  weight: 30, qtyRange: [1, 1] },
      { itemId: 'iron_ore',      weight: 10, qtyRange: [1, 1] },
    ],
  }),

  cave_slime: qty({
    goldRange: [5, 12],
    entries: [
      { itemId: 'iron_ore',      weight: 50, qtyRange: [1, 2] },
      { itemId: 'mana_stone_1',  weight: 35, qtyRange: [1, 2] },
      { itemId: 'vial',          weight: 15, qtyRange: [1, 2] },
    ],
  }),

  spider: qty({
    goldRange: [3, 8],
    entries: [
      { itemId: 'feather',       weight: 45, qtyRange: [1, 1] },
      { itemId: 'mana_stone_1',  weight: 40, qtyRange: [1, 1] },
      { itemId: 'dried_herb',    weight: 15, qtyRange: [1, 1] },
    ],
  }),

  skeleton: qty({
    goldRange: [8, 18],
    entries: [
      { itemId: 'iron_ore',      weight: 40, qtyRange: [1, 2] },
      { itemId: 'mana_stone_1',  weight: 35, qtyRange: [1, 1] },
      { itemId: 'mace_t1',       weight: 10, qtyRange: [1, 1] },
      { itemId: 'mana_stone_2',  weight: 15, qtyRange: [1, 1] },
    ],
  }),

  golem: qty({
    goldRange: [10, 25],
    entries: [
      { itemId: 'iron_ore',      weight: 45, qtyRange: [2, 3] },
      { itemId: 'mana_stone_2',  weight: 30, qtyRange: [1, 2] },
      { itemId: 'mana_stone_1',  weight: 15, qtyRange: [1, 1] },
      { itemId: 'round_shield',  weight: 10, qtyRange: [1, 1] },
    ],
  }),

  troll: qty({
    goldRange: [15, 35],
    entries: [
      { itemId: 'mana_stone_2',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 35, qtyRange: [2, 3] },
      { itemId: 'mana_stone_3',  weight: 15, qtyRange: [1, 1] },
      { itemId: 'greatsword_t2', weight: 10, qtyRange: [1, 1] },
    ],
  }),

  // ── Floor 2: Flooded Halls ─────────────────────────────────────────────────

  drowned: qty({
    goldRange: [10, 25],
    entries: [
      { itemId: 'drowned_pearl', weight: 45, qtyRange: [1, 1] },
      { itemId: 'mana_stone_2',  weight: 35, qtyRange: [1, 1] },
      { itemId: 'iron_ore',      weight: 15, qtyRange: [1, 2] },
      { itemId: 'sword_t2',      weight: 5,  qtyRange: [1, 1] },
    ],
  }),

  reed_lurker: qty({
    goldRange: [8, 20],
    entries: [
      { itemId: 'dried_herb',    weight: 45, qtyRange: [1, 2] },
      { itemId: 'mana_stone_2',  weight: 40, qtyRange: [1, 1] },
      { itemId: 'twin_daggers_t2', weight: 5, qtyRange: [1, 1] },
      { itemId: 'feather',       weight: 10, qtyRange: [1, 2] },
    ],
  }),

  toad_caster: qty({
    goldRange: [12, 28],
    entries: [
      { itemId: 'mana_stone_2',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'dried_herb',    weight: 30, qtyRange: [1, 2] },
      { itemId: 'mana_potion',   weight: 20, qtyRange: [1, 1] },
      { itemId: 'staff_t2',      weight: 10, qtyRange: [1, 1] },
    ],
  }),

  treant: qty({
    goldRange: [12, 24],
    entries: [
      { itemId: 'mana_stone_2',  weight: 50, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 30, qtyRange: [2, 3] },
      { itemId: 'mana_stone_3',  weight: 10, qtyRange: [1, 1] },
      { itemId: 'spear_t2',      weight: 10, qtyRange: [1, 1] },
    ],
  }),

  forest_wisp: qty({
    goldRange: [8, 18],
    entries: [
      { itemId: 'mana_stone_2',  weight: 50, qtyRange: [1, 1] },
      { itemId: 'dried_herb',    weight: 35, qtyRange: [1, 2] },
      { itemId: 'mana_potion',   weight: 15, qtyRange: [1, 1] },
    ],
  }),

  vine_snare: qty({
    goldRange: [5, 15],
    entries: [
      { itemId: 'dried_herb',    weight: 60, qtyRange: [2, 3] },
      { itemId: 'mana_stone_2',  weight: 30, qtyRange: [1, 1] },
      { itemId: 'feather',       weight: 10, qtyRange: [1, 2] },
    ],
  }),

  ghoul: qty({
    goldRange: [12, 25],
    entries: [
      { itemId: 'mana_stone_2',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 30, qtyRange: [1, 2] },
      { itemId: 'mana_stone_3',  weight: 15, qtyRange: [1, 1] },
      { itemId: 'twin_daggers_t2', weight: 10, qtyRange: [1, 1] },
      { itemId: 'goblin_head',   weight: 5,  qtyRange: [1, 1] },  // easter egg no-op but shows in float
    ],
  }),

  wraith: qty({
    goldRange: [10, 22],
    entries: [
      { itemId: 'mana_stone_2',  weight: 45, qtyRange: [1, 1] },
      { itemId: 'iron_ore',      weight: 25, qtyRange: [1, 1] },
      { itemId: 'mana_stone_3',  weight: 20, qtyRange: [1, 1] },
      { itemId: 'tome_t2',       weight: 10, qtyRange: [1, 1] },
    ],
  }),

  bone_golem: qty({
    goldRange: [15, 30],
    entries: [
      { itemId: 'iron_ore',      weight: 45, qtyRange: [2, 4] },
      { itemId: 'mana_stone_3',  weight: 30, qtyRange: [1, 2] },
      { itemId: 'mace_t2',       weight: 15, qtyRange: [1, 1] },
      { itemId: 'mana_stone_2',  weight: 10, qtyRange: [1, 1] },
    ],
  }),

  frog_warrior: qty({
    goldRange: [10, 22],
    entries: [
      { itemId: 'mana_stone_2',  weight: 45, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 30, qtyRange: [1, 2] },
      { itemId: 'spear_t2',      weight: 10, qtyRange: [1, 1] },
      { itemId: 'feather',       weight: 15, qtyRange: [1, 2] },
    ],
  }),

  swamp_slug: qty({
    goldRange: [5, 15],
    entries: [
      { itemId: 'iron_ore',      weight: 50, qtyRange: [2, 3] },
      { itemId: 'mana_stone_2',  weight: 35, qtyRange: [1, 1] },
      { itemId: 'dried_herb',    weight: 15, qtyRange: [1, 2] },
    ],
  }),

  water_serpent: qty({
    goldRange: [10, 22],
    entries: [
      { itemId: 'mana_stone_2',  weight: 45, qtyRange: [1, 1] },
      { itemId: 'iron_ore',      weight: 30, qtyRange: [1, 2] },
      { itemId: 'feather',       weight: 25, qtyRange: [2, 3] },
    ],
  }),

  rock_crab: qty({
    goldRange: [12, 28],
    entries: [
      { itemId: 'iron_ore',      weight: 50, qtyRange: [2, 4] },
      { itemId: 'mana_stone_2',  weight: 30, qtyRange: [1, 2] },
      { itemId: 'mana_stone_3',  weight: 15, qtyRange: [1, 1] },
      { itemId: 'mace_t2',       weight: 5,  qtyRange: [1, 1] },
    ],
  }),

  stone_imp: qty({
    goldRange: [8, 18],
    entries: [
      { itemId: 'mana_stone_2',  weight: 50, qtyRange: [1, 1] },
      { itemId: 'iron_ore',      weight: 35, qtyRange: [1, 2] },
      { itemId: 'bow_t2',        weight: 10, qtyRange: [1, 1] },
      { itemId: 'mana_stone_3',  weight: 5,  qtyRange: [1, 1] },
    ],
  }),

  cave_drake: qty({
    goldRange: [18, 35],
    entries: [
      { itemId: 'mana_stone_3',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 30, qtyRange: [2, 3] },
      { itemId: 'dragon_scale',  weight: 10, qtyRange: [1, 1] },
      { itemId: 'sword_t2',      weight: 20, qtyRange: [1, 1] },
    ],
  }),

  // ── Floor 3: Fungal Depths ─────────────────────────────────────────────────

  spore_brute: qty({
    goldRange: [15, 30],
    entries: [
      { itemId: 'brood_venom',   weight: 45, qtyRange: [1, 2] },
      { itemId: 'mana_stone_3',  weight: 35, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 15, qtyRange: [1, 2] },
      { itemId: 'gauntlets_t3',  weight: 5,  qtyRange: [1, 1] },
    ],
  }),

  myconid: qty({
    goldRange: [8, 18],
    entries: [
      { itemId: 'dried_herb',    weight: 50, qtyRange: [2, 3] },
      { itemId: 'mana_stone_3',  weight: 35, qtyRange: [1, 1] },
      { itemId: 'brood_venom',   weight: 15, qtyRange: [1, 1] },
    ],
  }),

  fungal_spider: qty({
    goldRange: [10, 22],
    entries: [
      { itemId: 'brood_venom',   weight: 50, qtyRange: [1, 2] },
      { itemId: 'mana_stone_3',  weight: 35, qtyRange: [1, 1] },
      { itemId: 'feather',       weight: 15, qtyRange: [1, 2] },
    ],
  }),

  // ── Floor 4: Old Barracks ──────────────────────────────────────────────────

  skeleton_soldier: qty({
    goldRange: [18, 35],
    entries: [
      { itemId: 'captain_badge', weight: 35, qtyRange: [1, 1] },
      { itemId: 'mana_stone_3',  weight: 35, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 20, qtyRange: [2, 3] },
      { itemId: 'sword_t3',      weight: 10, qtyRange: [1, 1] },
    ],
  }),

  crossbow_wight: qty({
    goldRange: [20, 40],
    entries: [
      { itemId: 'captain_badge', weight: 30, qtyRange: [1, 1] },
      { itemId: 'mana_stone_3',  weight: 35, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 20, qtyRange: [2, 3] },
      { itemId: 'crossbow_t3',   weight: 15, qtyRange: [1, 1] },
    ],
  }),

  shield_revenant: qty({
    goldRange: [22, 45],
    entries: [
      { itemId: 'captain_badge', weight: 40, qtyRange: [1, 2] },
      { itemId: 'mana_stone_3',  weight: 30, qtyRange: [1, 2] },
      { itemId: 'mana_stone_4',  weight: 15, qtyRange: [1, 1] },
      { itemId: 'mace_t3',       weight: 10, qtyRange: [1, 1] },
      { itemId: 'round_shield',  weight: 5,  qtyRange: [1, 1] },
    ],
  }),

  // ── Floor 5: Ashen Foundry ─────────────────────────────────────────────────

  ember_hound: qty({
    goldRange: [22, 42],
    entries: [
      { itemId: 'mana_stone_3',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 30, qtyRange: [2, 3] },
      { itemId: 'mana_stone_4',  weight: 20, qtyRange: [1, 1] },
      { itemId: 'gauntlets_t4',  weight: 10, qtyRange: [1, 1] },
    ],
  }),

  forge_golem: qty({
    goldRange: [30, 60],
    entries: [
      { itemId: 'mana_stone_4',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 30, qtyRange: [3, 5] },
      { itemId: 'brand_ember',   weight: 20, qtyRange: [1, 1] },
      { itemId: 'mace_t4',       weight: 10, qtyRange: [1, 1] },
    ],
  }),

  cinder_mage: qty({
    goldRange: [25, 50],
    entries: [
      { itemId: 'mana_stone_4',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'mana_potion',   weight: 25, qtyRange: [1, 2] },
      { itemId: 'brand_ember',   weight: 20, qtyRange: [1, 1] },
      { itemId: 'staff_t4',      weight: 15, qtyRange: [1, 1] },
    ],
  }),

  // ── Floor 6: Frozen Reliquary ──────────────────────────────────────────────

  frost_wolf: qty({
    goldRange: [20, 40],
    entries: [
      { itemId: 'mana_stone_4',  weight: 45, qtyRange: [1, 2] },
      { itemId: 'feather',       weight: 30, qtyRange: [2, 3] },
      { itemId: 'frost_crystal', weight: 15, qtyRange: [1, 1] },
      { itemId: 'spear_t5',      weight: 10, qtyRange: [1, 1] },
    ],
  }),

  ice_archer: qty({
    goldRange: [25, 50],
    entries: [
      { itemId: 'mana_stone_4',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'frost_crystal', weight: 30, qtyRange: [1, 1] },
      { itemId: 'arrow',         weight: 20, qtyRange: [5, 15] },
      { itemId: 'bow_t5',        weight: 10, qtyRange: [1, 1] },
    ],
  }),

  glacial_knight: qty({
    goldRange: [35, 65],
    entries: [
      { itemId: 'frost_crystal', weight: 45, qtyRange: [1, 2] },
      { itemId: 'mana_stone_4',  weight: 30, qtyRange: [2, 3] },
      { itemId: 'mana_stone_3',  weight: 15, qtyRange: [1, 1] },
      { itemId: 'sword_t5',      weight: 10, qtyRange: [1, 1] },
    ],
  }),

  // ── Floor 7: Shadowed Catacombs ────────────────────────────────────────────

  wraith_shade: qty({
    goldRange: [30, 55],
    entries: [
      { itemId: 'choir_soul',    weight: 30, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'tome_t6',       weight: 20, qtyRange: [1, 1] },
      { itemId: 'mana_potion',   weight: 10, qtyRange: [1, 2] },
    ],
  }),

  bone_colossus: qty({
    goldRange: [40, 80],
    entries: [
      { itemId: 'choir_soul',    weight: 35, qtyRange: [1, 2] },
      { itemId: 'mana_stone_4',  weight: 35, qtyRange: [2, 3] },
      { itemId: 'mace_t6',       weight: 20, qtyRange: [1, 1] },
      { itemId: 'iron_ore',      weight: 10, qtyRange: [3, 5] },
    ],
  }),

  cultist: qty({
    goldRange: [25, 50],
    entries: [
      { itemId: 'choir_soul',    weight: 30, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',  weight: 40, qtyRange: [1, 2] },
      { itemId: 'mana_potion',   weight: 20, qtyRange: [1, 2] },
      { itemId: 'tome_t6',       weight: 10, qtyRange: [1, 1] },
    ],
  }),

  // ── Floor 8: Voidtouched Caverns ───────────────────────────────────────────

  void_spawn: qty({
    goldRange: [25, 50],
    entries: [
      { itemId: 'riftmaw_eye',   weight: 25, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',  weight: 50, qtyRange: [1, 2] },
      { itemId: 'iron_ore',      weight: 25, qtyRange: [2, 3] },
    ],
  }),

  riftling: qty({
    goldRange: [35, 65],
    entries: [
      { itemId: 'riftmaw_eye',   weight: 35, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',  weight: 35, qtyRange: [1, 2] },
      { itemId: 'twin_daggers_t7', weight: 20, qtyRange: [1, 1] },
      { itemId: 'mana_potion',   weight: 10, qtyRange: [1, 2] },
    ],
  }),

  maw: qty({
    goldRange: [45, 90],
    entries: [
      { itemId: 'riftmaw_eye',   weight: 45, qtyRange: [1, 2] },
      { itemId: 'mana_stone_4',  weight: 30, qtyRange: [2, 3] },
      { itemId: 'gauntlets_t7',  weight: 15, qtyRange: [1, 1] },
      { itemId: 'health_potion', weight: 10, qtyRange: [1, 2] },
    ],
  }),

  // ── Floor 9: The Ascended Court ────────────────────────────────────────────

  fallen_knight: qty({
    goldRange: [50, 100],
    entries: [
      { itemId: 'twin_crest',    weight: 35, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',  weight: 35, qtyRange: [2, 3] },
      { itemId: 'sword_t8',      weight: 20, qtyRange: [1, 1] },
      { itemId: 'health_potion', weight: 10, qtyRange: [1, 2] },
    ],
  }),

  arcane_sentinel: qty({
    goldRange: [55, 110],
    entries: [
      { itemId: 'twin_crest',    weight: 30, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',  weight: 35, qtyRange: [2, 4] },
      { itemId: 'staff_t8',      weight: 25, qtyRange: [1, 1] },
      { itemId: 'mana_potion',   weight: 10, qtyRange: [1, 2] },
    ],
  }),

  echo_shade: qty({
    goldRange: [45, 90],
    entries: [
      { itemId: 'twin_crest',    weight: 35, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',  weight: 35, qtyRange: [1, 3] },
      { itemId: 'twin_daggers_t8', weight: 20, qtyRange: [1, 1] },
      { itemId: 'smoke_bomb',    weight: 10, qtyRange: [1, 2] },
    ],
  }),

  // ── Floor 10: Throne Approach ──────────────────────────────────────────────

  iron_guardian: qty({
    goldRange: [70, 140],
    entries: [
      { itemId: 'sovereign_heart', weight: 20, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',   weight: 40, qtyRange: [3, 5] },
      { itemId: 'mace_t9',        weight: 25, qtyRange: [1, 1] },
      { itemId: 'health_potion',  weight: 15, qtyRange: [2, 3] },
    ],
  }),

  shadow_herald: qty({
    goldRange: [65, 130],
    entries: [
      { itemId: 'sovereign_heart', weight: 20, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',   weight: 40, qtyRange: [2, 4] },
      { itemId: 'twin_daggers_t9', weight: 25, qtyRange: [1, 1] },
      { itemId: 'smoke_bomb',     weight: 15, qtyRange: [1, 2] },
    ],
  }),

  void_herald: qty({
    goldRange: [70, 140],
    entries: [
      { itemId: 'sovereign_heart', weight: 20, qtyRange: [1, 1] },
      { itemId: 'mana_stone_4',   weight: 40, qtyRange: [2, 4] },
      { itemId: 'staff_t9',       weight: 25, qtyRange: [1, 1] },
      { itemId: 'mana_potion',    weight: 15, qtyRange: [2, 3] },
    ],
  }),
};

// ─── Chest loot tables (keyed by rarity tier) ─────────────────────────────────

export const CHEST_LOOT: Record<'common' | 'rare' | 'epic', LootTable> = {
  common: {
    goldRange: [10, 40],
    entries: [
      { itemId: 'iron_ore',      weight: 30, qtyRange: [2, 4] },
      { itemId: 'health_potion', weight: 25, qtyRange: [1, 2] },
      { itemId: 'mana_stone_1',  weight: 20, qtyRange: [1, 2] },
      { itemId: 'arrow',         weight: 15, qtyRange: [5, 15] },
      { itemId: 'whetstone',     weight: 10, qtyRange: [1, 1] },
    ],
  },
  rare: {
    goldRange: [40, 120],
    entries: [
      { itemId: 'mana_stone_2',  weight: 30, qtyRange: [2, 3] },
      { itemId: 'mana_stone_3',  weight: 20, qtyRange: [1, 2] },
      { itemId: 'health_potion', weight: 20, qtyRange: [2, 3] },
      { itemId: 'dragon_scale',  weight: 15, qtyRange: [1, 1] },
      { itemId: 'mana_potion',   weight: 15, qtyRange: [1, 2] },
    ],
  },
  epic: {
    goldRange: [100, 300],
    entries: [
      { itemId: 'mana_stone_4',  weight: 30, qtyRange: [2, 3] },
      { itemId: 'dragon_scale',  weight: 25, qtyRange: [2, 3] },
      { itemId: 'frost_crystal', weight: 15, qtyRange: [1, 2] },
      { itemId: 'riftmaw_eye',   weight: 15, qtyRange: [1, 1] },
      { itemId: 'health_potion', weight: 15, qtyRange: [3, 5] },
    ],
  },
};

// ─── Champion guaranteed rare material pool (floor-scaled) ────────────────────

export const CHAMPION_MATS_BY_FLOOR: Record<number, string[]> = {
  1:  ['goblin_tooth', 'iron_ore'],
  2:  ['drowned_pearl', 'goblin_tooth', 'brood_venom'],
  3:  ['brood_venom', 'drowned_pearl'],
  4:  ['captain_badge', 'brood_venom'],
  5:  ['brand_ember', 'captain_badge'],
  6:  ['frost_crystal', 'brand_ember'],
  7:  ['choir_soul', 'frost_crystal'],
  8:  ['riftmaw_eye', 'choir_soul'],
  9:  ['twin_crest', 'riftmaw_eye'],
  10: ['sovereign_heart', 'twin_crest'],
};

export function championMatForFloor(floor: number): string {
  const pool = CHAMPION_MATS_BY_FLOOR[Math.min(10, Math.max(1, floor))] ?? ['iron_ore'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── LootSystem ───────────────────────────────────────────────────────────────

export class LootSystem {
  /**
   * Track dry-streak counters per rarity bucket.
   * Persisted in memory across a floor; reset on death.
   */
  private static dryStreaks: { rare: number; epic: number; legendary: number } = {
    rare: 0, epic: 0, legendary: 0,
  };

  static resetStreaks(): void {
    this.dryStreaks = { rare: 0, epic: 0, legendary: 0 };
  }

  /**
   * Roll a drop from a LootTable, applying:
   * - floor-tier filtering (minFloor)
   * - condition filtering (champion_only, part_broken)
   * - pity / anti-streak weight nudge on rare+ entries
   *
   * @param table        The loot table to roll.
   * @param floor        Current dungeon floor (1–10).
   * @param isChampion   Whether the enemy is a champion.
   * @param isBloodMoon  Whether the Blood Moon anomaly is active (doubles the drop).
   * @returns Array of { itemId, qty } to add to inventory (can be empty).
   */
  static rollDrops(
    table: LootTable,
    floor: number,
    isChampion = false,
    isBloodMoon = false,
    killContext?: { statusKill?: boolean; elementKill?: boolean },
  ): { itemId: string; qty: number; isGold?: boolean }[] {
    const results: { itemId: string; qty: number; isGold?: boolean }[] = [];

    // Gold drop
    if (table.goldRange) {
      const [gmin, gmax] = table.goldRange;
      // Floor bonus: +5g per floor above 1
      const floorBonus = (floor - 1) * 5;
      const baseGold = Math.round(gmin + Math.random() * (gmax - gmin));
      const gold = baseGold + floorBonus;
      results.push({ itemId: '__gold__', qty: gold, isGold: true });
    }

    // Filter entries by floor and condition
    const eligible = table.entries.filter(e => {
      if (e.minFloor !== undefined && floor < e.minFloor) return false;
      if (e.condition === 'champion_only' && !isChampion) return false;
      if (e.condition === 'part_broken') return false; // only via explicit boss-part break
      if (e.condition === 'status_kill' && !killContext?.statusKill) return false;
      if (e.condition === 'element_kill' && !killContext?.elementKill) return false;
      return true;
    });
    if (eligible.length === 0) return results;

    // Pity nudge: if player has had many kills without a rare drop, bump weights of rarer entries
    const pityMult = 1 + Math.min(this.dryStreaks.rare * 0.04, 0.8); // up to +80% at 20 dry

    // Build weighted pool
    const totalWeight = eligible.reduce((sum, e) => {
      // Assume any item with mana_stone_4 / dragon_scale / etc. is "rare"
      const isRareEntry = e.itemId.includes('_t5')
        || e.itemId.includes('_t6') || e.itemId.includes('_t7')
        || e.itemId.includes('_t8') || e.itemId.includes('_t9')
        || e.itemId === 'dragon_scale' || e.itemId === 'frost_crystal'
        || e.itemId === 'choir_soul'  || e.itemId === 'riftmaw_eye'
        || e.itemId === 'twin_crest'  || e.itemId === 'sovereign_heart';
      const w = isRareEntry ? e.weight * pityMult : e.weight;
      return sum + w;
    }, 0);

    let roll = Math.random() * totalWeight;
    let chosen: DropEntry | null = null;
    for (const e of eligible) {
      const isRareEntry = e.itemId.includes('_t5')
        || e.itemId.includes('_t6') || e.itemId.includes('_t7')
        || e.itemId.includes('_t8') || e.itemId.includes('_t9')
        || e.itemId === 'dragon_scale' || e.itemId === 'frost_crystal'
        || e.itemId === 'choir_soul'  || e.itemId === 'riftmaw_eye'
        || e.itemId === 'twin_crest'  || e.itemId === 'sovereign_heart';
      const w = isRareEntry ? e.weight * pityMult : e.weight;
      roll -= w;
      if (roll <= 0) { chosen = e; break; }
    }
    chosen = chosen ?? eligible[eligible.length - 1];

    const [qmin, qmax] = chosen.qtyRange;
    const baseQty = qmin + Math.floor(Math.random() * (qmax - qmin + 1));

    // Update dry-streak tracker
    const isRareItem = chosen.itemId.includes('_t5')
      || chosen.itemId.includes('_t6') || chosen.itemId.includes('_t7')
      || chosen.itemId.includes('_t8') || chosen.itemId.includes('_t9')
      || chosen.itemId === 'dragon_scale' || chosen.itemId === 'frost_crystal';
    if (isRareItem) {
      this.dryStreaks.rare = 0;
    } else {
      this.dryStreaks.rare++;
    }

    results.push({ itemId: chosen.itemId, qty: isBloodMoon ? baseQty * 2 : baseQty });
    return results;
  }

  /**
   * Roll drops for an enemy by its id, optionally with pity + blood-moon.
   */
  static rollEnemyDrops(
    enemyId: string,
    floor: number,
    isChampion = false,
    isBloodMoon = false,
    killContext?: { statusKill?: boolean; elementKill?: boolean },
  ): { itemId: string; qty: number; isGold?: boolean }[] {
    const table = ENEMY_LOOT[enemyId];
    if (!table) {
      // Fallback: generic material + small gold
      const fallbackFloorMat = floor <= 2 ? 'mana_stone_1'
                             : floor <= 4 ? 'mana_stone_2'
                             : floor <= 6 ? 'mana_stone_3'
                             : 'mana_stone_4';
      const goldAmt = 5 + (floor - 1) * 4 + Math.floor(Math.random() * 10);
      return [
        { itemId: '__gold__', qty: goldAmt, isGold: true },
        ...(Math.random() < 0.5 ? [{ itemId: fallbackFloorMat, qty: 1 }] : []),
      ];
    }
    return this.rollDrops(table, floor, isChampion, isBloodMoon, killContext);
  }
}
