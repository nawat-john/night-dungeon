export type RaceId = 'human' | 'elf' | 'dwarf' | 'barbarian' | 'beastman';
export type ClassId = 'swordman' | 'archer' | 'tanker' | 'assassin' | 'sage';

// ── §E15 — Affinity & damage typing ───────────────────────────────────────────

/** Physical damage category determined by weapon family. */
export type PhysType = 'slash' | 'blunt' | 'pierce';

/** Monster body type — drives PHYS_CHART multipliers. */
export type BodyType =
  | 'flesh' | 'armored' | 'bone' | 'gelatinous' | 'chitin'
  | 'construct' | 'ethereal' | 'plant' | 'aerial';

/** Monster element family — drives ELEM_CHART multipliers. */
export type ElemFamily =
  | 'beast' | 'plant' | 'aquatic' | 'fire' | 'ice'
  | 'construct' | 'undead' | 'spectral' | 'void' | 'insect' | 'storm';

// §29 — Extended data model types (source of truth for all combat/element/status)
/** Unified element type — covers both weapon elements and StatusSystem attack types. */
export type Element =
  | 'none' | 'physical' | 'blunt'
  | 'fire' | 'ice' | 'lightning' | 'poison' | 'void' | 'radiant';

export type Ailment =
  // §15 original ailments
  | 'poison' | 'bleed' | 'burn' | 'chill' | 'frozen' | 'shock' | 'stun' | 'curse' | 'webbed' | 'wet'
  // §E15 P7 additions
  | 'ko' | 'wound' | 'sear' | 'blind' | 'stuck' | 'corruption' | 'frostbite';

/** Per-enemy body-part damage modifiers (§E15 hitzone system). */
export interface Hitzone {
  id: string;
  rawMod: number;    // multiplier on physical component
  elemMod: number;   // multiplier on elemental component
  breakable?: boolean;
  breakHp?: number;  // cumulative boss damage threshold at which part breaks
  breakReward?: string;
  disablesAttack?: string;
}

/** Override elemental effectiveness for a specific enemy (sparse; ELEM_CHART is default). */
export interface Affinity {
  body: BodyType;
  weak?: Element[];
  resist?: Element[];
  immune?: Element[];
  absorb?: Element[];
}

/** Weapon identity trait IDs — behaviour implemented in P11. */
export type WeaponTrait =
  | 'riposte' | 'cleave' | 'bleedstack' | 'concussion'
  | 'reach' | 'flow' | 'weakpoint_draw' | 'pierce_through'
  | 'channel' | 'glyph' | 'thornweave' | 'leech' | 'detonate'
  | 'void_absorb' | 'shockchain' | 'defiant';

/** Extended weapon data model — P9 item system extension. */
export interface WeaponExt {
  physType: PhysType;
  element?: Element;
  elementValue?: number;    // flat elemental power; drives elem split
  trait?: WeaponTrait;      // passive weapon trait id
  uniqueEffectId?: string;
  infusedElement?: Element; // from weapon infusion system
}

/** Jewel (decoration) that slots into gear pieces to grant bonuses. */
export interface JewelDef {
  id: string;
  name: string;
  /** Stat key or bonus type this jewel grants. */
  skill: string;
  level: 1 | 2 | 3;
  /** Magnitude of bonus at this jewel level. */
  value: number;
}

/** Single crafting recipe for the Alchemy system. */
export interface AlchemyRecipe {
  id: string;
  name: string;
  inputs: { itemId: string; qty: number }[];
  output: { itemId: string; qty: number };
  /** Research level required to unlock (0 = always available). */
  researchReq?: number;
  availableAt: 'emporium' | 'camp' | 'both';
}

/** Definition of a gear affix that can roll on items. */
export interface AffixDef {
  id: string;
  label: string;
  category: 'offensive' | 'defensive' | 'utility' | 'legendary';
  stat: string;
  valueMin: number;
  valueMax: number;
  isPercent: boolean;
  applicableTo: ('weapon' | 'armor' | 'accessory')[];
}

/** Accumulation record for a single ailment on a target. */
export interface StatusBuildup {
  ailment: Ailment;
  value: number; // 0–100; triggers at 100
}

/** Reusable effect specification for skills, items, and boss abilities. */
export interface EffectSpec {
  id: string;
  kind: string;
  params: Record<string, number | string | boolean>;
  channelMs?: number;
  durationMs?: number;
}

/** Generic timed buff applied to the player (meals, skills, items). */
export interface ActiveBuff {
  id: string;
  stat: string;
  value: number;
  isPercent: boolean;
  expiresAt: number | 'camp' | 'death';
  sourceLabel?: string;
}

/** Shared AI parameter block — drives companions, The Hunter, and rift shades. */
export interface CharacterAIProfile {
  alignment: 'ally' | 'hostile';
  /** 0..1 — how aggressively it pursues targets. */
  aggression: number;
  /** 0..1 — tendency to fall back and self-heal when low. */
  selfPreservation: number;
  usesConsumables: boolean;
  skillUsageProfile: string;
  targetPriority: ('player' | 'lowestHp' | 'support' | 'nearest')[];
}

export interface Stats {
  hp: number;
  mp: number;
  str: number;
  dex: number;
  int: number;
  vit: number;
  agi: number;
}

export interface Race {
  id: RaceId;
  name: string;
  modifiers: Partial<Stats>;
  allowedClasses: ClassId[];
}

export interface CharClass {
  id: ClassId;
  name: string;
  baseStats: Stats;
  startingEquipment: string[];
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface Affix {
  type: 'flat' | 'percent';
  stat: string;
  value: number;
}

export interface ItemInstance {
  id: string; // unique ID for gear, or itemId for stackables
  itemId: string;
  qty: number;
  rarity?: Rarity;
  affixes?: Affix[];
  isJunk?: boolean;
  durability?: number;
  maxDurability?: number;
  sockets?: string[];
  maxSockets?: number;
  upgradeLevel?: number;
  branch?: 'sharp' | 'light' | 'none';
}

export type CompanionRole    = 'tanker' | 'archer' | 'sage';
export type CompanionCommand = 'follow' | 'aggressive' | 'defensive' | 'hold' | 'focus' | 'regroup';

export interface CompanionSaveData {
  id: string;
  name: string;
  role: CompanionRole;
  currentHp: number;
  maxHp: number;
  potions: number;
  fatigue: number;
  affinity: number;
  command: CompanionCommand;
}

export interface MealBuff {
  mealId: string;
  /** stat key affected: 'hp' | 'str' | 'vit' | 'dex' | 'int' */
  stat: string;
  /** flat or percent bonus value */
  value: number;
  /** absolute game time (ms) when buff expires */
  expiresAt: number;
}

/** Current save format version. Increment when adding required fields. */
export const SAVE_VERSION = 2;

export interface CharacterSave {
  version: number;
  name: string;
  race: RaceId;
  clazz: ClassId;
  level: number;
  exp: number;
  stats: Stats;
  currentHp: number;
  currentMp: number;
  gold: number;
  inventory: ItemInstance[];
  equipped: Record<string, ItemInstance | null>;
  activeWeaponSlot: 0 | 1;
  hasBag: boolean;
  location: 'town' | 'dungeon';
  dungeonFloor: number;
  floorSeed: number;
  lastWarpIndex: number;
  position: { x: number; y: number };
  unspentStatPoints: number;
  unspentSkillPoints: number;
  unlockedSkills: string[];
  curseActive?: boolean;
  masochist?: boolean;
  ironbound?: boolean;
  starved?: boolean;
  hunted?: boolean;
  blackout?: boolean;
  glass?: boolean;
  wrongfooted?: boolean;
  title?: string;
  biggestHit?: number;
  rarestFind?: string;
  rarestFindRarity?: Rarity;
  nemesisKills?: number;
  companions?: CompanionSaveData[];
  activeMealBuff?: MealBuff;
  bossesSlain?: string[];
  activeBounties?: ActiveBounty[];
  enemiesKilled?: number;
  enemyKillMap?: Record<string, number>;
  createdAt: string;
  // ── V2 additions (P7+) — default-safe (all optional) ────────────────────────
  specialization?: string;
  hunterState?: { encounters: number; defeats: number; escalation: number };
  activeTonic?: { effectId: string; expiresAt: number };
  weaponInfusions?: Record<string, Element>;
  runModifiers?: string[];
}

// ── Account-level meta (never wiped on permadeath) ────────────────────────────

export interface RunHistoryEntry {
  runNumber: number;
  name: string;
  race: RaceId;
  clazz: ClassId;
  floorReached: number;

  bossesSlain: string[];
  causeOfDeath: string;
  survivedMs: number;
  goldEarned: number;
  endedAt: string;
  victory?: boolean;
  title?: string;
  biggestHit?: number;
  rarestFind?: string;
}

// ── Research / Bestiary (P10) — persists on AccountMeta, survives permadeath ──

/** Per-enemy research progress; level unlocks Bestiary info tiers. */
export interface ResearchEntry {
  enemyId: string;
  level: 0 | 1 | 2 | 3;
  kills: number;
  breaks: number;
}

/** Per-weapon-family mastery; survives permadeath (P11 passive unlocks). */
export interface MasteryEntry {
  family: string;
  level: number;
  uses: number;
}

export interface AccountMeta {
  runHistory: RunHistoryEntry[];
  hallOfChampions: RunHistoryEntry[];
  unlockedCheckpointFloors: number[];
  /** New Game+ / Ascension tier. Increments each time the dungeon is conquered. */
  ascensionTier?: number;
  /** Research entries for all encountered enemies. */
  research?: ResearchEntry[];
  /** Weapon mastery entries (P11). */
  masteries?: MasteryEntry[];
  /** Alchemy/crafting recipes unlocked via research or lore notes. */
  unlockedRecipes?: string[];
  /** Secret-boss investigation progress (P12). */
  discoveredClues?: string[];
}

export interface ActiveBounty {
  id: string;
  progress: number;
  completed: boolean;
}
