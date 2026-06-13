import type { AccountMeta, ResearchEntry } from '../types';
import type { EnemyDef } from '../data/enemies';

/** Kill/break counts needed to reach research level 1, 2, 3.
 *  Each break counts as 2 kills in the combined score. */
const RANK_THRESHOLDS = [5, 15, 30] as const;

export class ResearchSystem {
  /** Get the research entry for an enemy, or a default Lv0 entry. */
  static getEntry(meta: AccountMeta, enemyId: string): ResearchEntry {
    return (meta.research ?? []).find(r => r.enemyId === enemyId)
      ?? { enemyId, level: 0, kills: 0, breaks: 0 };
  }

  /** Record a kill. Mutates meta in-place. Returns whether level increased. */
  static recordKill(
    meta: AccountMeta,
    enemyId: string,
  ): { rankUp: boolean; newLevel: 0 | 1 | 2 | 3 } {
    if (!meta.research) meta.research = [];
    let entry = meta.research.find(r => r.enemyId === enemyId);
    if (!entry) {
      entry = { enemyId, level: 0, kills: 0, breaks: 0 };
      meta.research.push(entry);
    }
    entry.kills += 1;
    return ResearchSystem.checkRankUp(entry);
  }

  /** Record a part-break. Mutates meta in-place. Breaks count 2× toward research. */
  static recordBreak(
    meta: AccountMeta,
    enemyId: string,
  ): { rankUp: boolean; newLevel: 0 | 1 | 2 | 3 } {
    if (!meta.research) meta.research = [];
    let entry = meta.research.find(r => r.enemyId === enemyId);
    if (!entry) {
      entry = { enemyId, level: 0, kills: 0, breaks: 0 };
      meta.research.push(entry);
    }
    entry.breaks += 1;
    return ResearchSystem.checkRankUp(entry);
  }

  private static checkRankUp(
    entry: ResearchEntry,
  ): { rankUp: boolean; newLevel: 0 | 1 | 2 | 3 } {
    const oldLevel = entry.level;
    const score = entry.kills + entry.breaks * 2;
    let newLevel: 0 | 1 | 2 | 3 = 0;
    if (score >= RANK_THRESHOLDS[2]) newLevel = 3;
    else if (score >= RANK_THRESHOLDS[1]) newLevel = 2;
    else if (score >= RANK_THRESHOLDS[0]) newLevel = 1;
    const rankUp = newLevel > oldLevel;
    entry.level = newLevel;
    return { rankUp, newLevel };
  }

  /** Progress string shown in Bestiary: "5 / 15 kills". */
  static progressLabel(entry: ResearchEntry): string {
    const score = entry.kills + entry.breaks * 2;
    if (entry.level >= 3) return `Lv3 — fully researched (${entry.kills} kills)`;
    const nextThresh = RANK_THRESHOLDS[entry.level as 0 | 1 | 2];
    return `Lv${entry.level} — ${score}/${nextThresh}`;
  }

  /** Structured data for the Bestiary UI based on current research level. */
  static getBestiaryInfo(def: EnemyDef, level: 0 | 1 | 2 | 3) {
    return {
      id:           def.id,
      name:         def.name,
      level,
      showStats:    level >= 1,
      showWeakness: level >= 2,
      showHitzones: level >= 3,
      hp:           def.hp,
      dmg:          def.dmg,
      archetype:    def.archetype,
      body:         def.body,
      elemFamily:   def.elemFamily,
      identity:     def.identity,
      counter:      def.counter,
      statusVuln:   def.statusVuln,
      lore:         def.lore,
      hitzones:     def.hitzones,
      dropItem:     def.dropItem,
      floorMin:     def.floorMin,
    };
  }
}
