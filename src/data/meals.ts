/**
 * §21 — Camping meals: data table for all cook-able recipes.
 * Each recipe requires 1× Ration + the listed material(s).
 * The resulting meal item is consumed from inventory to apply its buff.
 */

export interface MealRecipe {
  /** Item ID of the cooked meal product */
  id: string;
  /** Display label for the cook button (two lines: name + buff summary) */
  label: string;
  /** Required material item ID */
  mat: string;
  /** Required quantity of that material */
  matQty: number;
  /** Human-readable material label shown under the button */
  matLabel: string;
  /** Stat key affected (matches CharacterSave/Stats key or 'hp'/'mp') */
  buffStat: string;
  /** Flat or percent value of the buff */
  buffValue: number;
  buffIsPercent: boolean;
  /** Duration in milliseconds (5 min = 300 000) */
  durationMs: number;
}

export const MEAL_RECIPES: MealRecipe[] = [
  {
    id: 'hearty_stew',
    label: 'Hearty Stew\n+60 HP regen 5 min',
    mat: 'dried_herb', matQty: 1, matLabel: 'Dried Herb',
    buffStat: 'hp', buffValue: 60, buffIsPercent: false, durationMs: 300_000,
  },
  {
    id: 'spiced_skewers',
    label: 'Spiced Skewers\n+15% STR 5 min',
    mat: 'feather', matQty: 1, matLabel: 'Feather',
    buffStat: 'str', buffValue: 15, buffIsPercent: true, durationMs: 300_000,
  },
  {
    id: 'iron_porridge',
    label: 'Iron Porridge\n+10% VIT 5 min',
    mat: 'iron_ore', matQty: 1, matLabel: 'Iron Ore',
    buffStat: 'vit', buffValue: 10, buffIsPercent: true, durationMs: 300_000,
  },
  {
    id: 'hunters_tea',
    label: "Hunter's Tea\n+10% AGI 5 min",
    mat: 'arrow_shaft', matQty: 1, matLabel: 'Arrow Shaft',
    buffStat: 'agi', buffValue: 10, buffIsPercent: true, durationMs: 300_000,
  },
  {
    id: 'mages_broth',
    label: "Mage's Broth\n+15% INT 5 min",
    mat: 'vial', matQty: 1, matLabel: 'Vial',
    buffStat: 'int', buffValue: 15, buffIsPercent: true, durationMs: 300_000,
  },
  {
    id: 'trailmix',
    label: 'Trail Mix\n+10% DEX 5 min',
    mat: 'dried_herb', matQty: 2, matLabel: '2× Dried Herb',
    buffStat: 'dex', buffValue: 10, buffIsPercent: true, durationMs: 300_000,
  },
];
