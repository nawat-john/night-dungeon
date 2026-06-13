export interface BountyTemplate {
  id: string;
  description: string;
  type: 'kill_type' | 'reach_floor' | 'boss_kill' | 'kill_count' | 'break_part' | 'radiant_undead' | 'topple_brute' | 'no_potion_f5';
  /** enemy id, 'champion', floor number string, or boss name */
  target?: string;
  count: number;
  reward: { gold: number; mat?: string; matQty?: number };
  /** only available when player has reached at least this floor (in account meta) */
  minFloor?: number;
}

export const BOUNTY_POOL: BountyTemplate[] = [
  // ── Kill specific enemy types ─────────────────────────────────────────────
  { id: 'b_goblin_10',     description: 'Slay 10 Goblins',           type: 'kill_type', target: 'goblin',           count: 10, reward: { gold: 80 } },
  { id: 'b_bat_15',        description: 'Slay 15 Cave Bats',         type: 'kill_type', target: 'bat',              count: 15, reward: { gold: 60 } },
  { id: 'b_skeleton_8',    description: 'Slay 8 Skeleton Soldiers',  type: 'kill_type', target: 'skeleton_soldier', count: 8,  reward: { gold: 120 } },
  { id: 'b_spore_5',       description: 'Destroy 5 Spore Brutes',    type: 'kill_type', target: 'spore_brute',      count: 5,  reward: { gold: 160 }, minFloor: 3 },
  { id: 'b_ember_4',       description: 'Hunt 4 Ember Hounds',       type: 'kill_type', target: 'ember_hound',      count: 4,  reward: { gold: 200 }, minFloor: 5 },
  { id: 'b_forge_golem_3', description: 'Destroy 3 Forge Golems',    type: 'kill_type', target: 'forge_golem',      count: 3,  reward: { gold: 280, mat: 'brand_ember', matQty: 1 }, minFloor: 5 },
  { id: 'b_frost_wolf_5',  description: 'Hunt 5 Frost Wolves',       type: 'kill_type', target: 'frost_wolf',       count: 5,  reward: { gold: 220 }, minFloor: 6 },
  { id: 'b_glacial_2',     description: 'Slay 2 Glacial Knights',    type: 'kill_type', target: 'glacial_knight',   count: 2,  reward: { gold: 300, mat: 'frost_crystal', matQty: 1 }, minFloor: 6 },
  { id: 'b_void_spawn_8',  description: 'Slay 8 Void Spawn',         type: 'kill_type', target: 'void_spawn',       count: 8,  reward: { gold: 350 }, minFloor: 7 },
  { id: 'b_drowned_6',     description: 'Slay 6 Drowned',            type: 'kill_type', target: 'drowned',          count: 6,  reward: { gold: 140 }, minFloor: 2 },
  { id: 'b_wraith_5',      description: 'Banish 5 Wraiths',          type: 'kill_type', target: 'wraith',           count: 5,  reward: { gold: 200 }, minFloor: 4 },
  // ── Champion kills ────────────────────────────────────────────────────────
  { id: 'b_champion_3',    description: 'Defeat 3 Champion enemies', type: 'kill_type', target: 'champion',         count: 3,  reward: { gold: 250, mat: 'mana_stone_2', matQty: 1 } },
  // ── Reach a floor ─────────────────────────────────────────────────────────
  { id: 'b_reach_3',  description: 'Descend to Floor 3',  type: 'reach_floor', target: '3',  count: 1, reward: { gold: 100 } },
  { id: 'b_reach_5',  description: 'Descend to Floor 5',  type: 'reach_floor', target: '5',  count: 1, reward: { gold: 180, mat: 'iron_ore', matQty: 2 } },
  { id: 'b_reach_7',  description: 'Descend to Floor 7',  type: 'reach_floor', target: '7',  count: 1, reward: { gold: 300, mat: 'dragon_scale', matQty: 1 }, minFloor: 4 },
  { id: 'b_reach_9',  description: 'Descend to Floor 9',  type: 'reach_floor', target: '9',  count: 1, reward: { gold: 500, mat: 'mana_stone_3', matQty: 1 }, minFloor: 6 },
  // ── Boss kills ────────────────────────────────────────────────────────────
  { id: 'b_boss_1', description: 'Defeat the Goblin Warlord',     type: 'boss_kill', target: 'Goblin Warlord',     count: 1, reward: { gold: 150, mat: 'goblin_tooth',  matQty: 2 } },
  { id: 'b_boss_2', description: 'Defeat the Drowned King',       type: 'boss_kill', target: 'The Drowned King',   count: 1, reward: { gold: 200, mat: 'drowned_pearl', matQty: 1 } },
  { id: 'b_boss_5', description: 'Defeat Forgefather Brand',      type: 'boss_kill', target: 'Forgefather Brand',  count: 1, reward: { gold: 350 }, minFloor: 4 },
  { id: 'b_boss_6', description: 'Defeat Frost Warden Ysold',     type: 'boss_kill', target: 'Frost Warden Ysold', count: 1, reward: { gold: 450, mat: 'frost_crystal', matQty: 1 }, minFloor: 5 },
  // ── Total kills ───────────────────────────────────────────────────────────
  { id: 'b_kill_20', description: 'Slay 20 enemies in one run',  type: 'kill_count', count: 20, reward: { gold: 150 } },
  { id: 'b_kill_50', description: 'Slay 50 enemies in one run',  type: 'kill_count', count: 50, reward: { gold: 300, mat: 'iron_ore', matQty: 3 } },
  // ── Bounties 2.0 ──────────────────────────────────────────────────────────
  { id: 'b_break_ysold_antlers', description: "Break Ysold's Antlers", type: 'break_part', target: 'Frost Warden Ysold', count: 1, reward: { gold: 400, mat: 'frost_crystal', matQty: 2 }, minFloor: 6 },
  { id: 'b_radiant_undead', description: 'Destroy 10 Undead with Radiant', type: 'radiant_undead', count: 10, reward: { gold: 250, mat: 'mana_stone_2', matQty: 1 }, minFloor: 4 },
  { id: 'b_topple_brute', description: 'Topple a Brute Enemy', type: 'topple_brute', count: 1, reward: { gold: 150, mat: 'iron_ore', matQty: 2 }, minFloor: 2 },
  { id: 'b_clear_f5_no_pot', description: 'Clear Floor 5 with no potion usage', type: 'no_potion_f5', count: 1, reward: { gold: 500, mat: 'mana_stone_3', matQty: 1 }, minFloor: 5 },
];

/** Pick 4 bounties from the pool seeded by today's date.
 *  @param maxFloor deepest floor reached (from account meta) for unlocking higher-tier bounties.
 */
export function getDailyBounties(maxFloor: number): BountyTemplate[] {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const eligible = BOUNTY_POOL.filter(b => !b.minFloor || maxFloor >= b.minFloor - 1);
  const arr = [...eligible];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = ((Math.imul(s, 1664525) + 1013904223) >>> 0);
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 4);
}
