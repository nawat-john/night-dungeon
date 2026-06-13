import type { BodyType, ElemFamily, Hitzone } from '../types';

export type EnemyArchetype = 'chaser' | 'skirmisher' | 'ranged' | 'charger' | 'caster' | 'swarm' | 'support' | 'brute';
export type EliteAffix   = 'vampiric' | 'frenzied' | 'armored' | 'volatile' | 'stormtouched' | 'toxic' | 'shielded' | 'hasted_aura'
                         // P10 — matchup-aware elite affixes
                         | 'warded' | 'unstable_core' | 'bloodgorged';
export type EnemyTheme   = 'cave' | 'goblin' | 'flooded' | 'forest' | 'deadland' | 'pond' | 'rock'
                         | 'fungal' | 'barracks' | 'foundry' | 'frozen' | 'catacombs' | 'void' | 'court' | 'throne';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  dmg: number;
  speed: number;
  exp: number;
  archetype: EnemyArchetype;
  dropItem?: string;
  dropChance?: number;
  floorMin: number;
  theme?: EnemyTheme;
  element?: string;    // elemental type for ATTACKS (what ailment the enemy inflicts)
  rangeMin?: number;   // min engagement distance for ranged/caster/skirmisher
  // ── §E15 affinity (P7) ───────────────────────────────────────────────────────
  body?: BodyType;         // physical type chart lookup
  elemFamily?: ElemFamily; // elemental effectiveness chart lookup
  // ── §E15 P8 — hitzone data (large/elite enemies only) ────────────────────────
  hitzones?: Hitzone[];
  // ── §E15 P8 — mini-break (brutes/champions) ──────────────────────────────────
  breakPart?: { dmgThreshold: number; dropItemId?: string };
  // ── §E6 — Monster identity (P10) ─────────────────────────────────────────────
  identity?:   string;   // one-line "what makes it scary"
  signature?:  string;   // defining mechanic
  counter?:    string;   // intended player answer
  statusVuln?: string[]; // ailments landed with extra effectiveness
  lore?:       string;   // revealed at Research Lv3
  canFeint?:   boolean;  // §P11 — can this enemy feint?
}

export interface EliteConfig {
  affixes: EliteAffix[];
  isChampion: boolean;
  hpMult: number;
}

// ── Archetype spawn budget costs ──────────────────────────────────────────────
export const ARCHETYPE_COST: Record<EnemyArchetype, number> = {
  swarm:      3,
  chaser:     5,
  skirmisher: 7,
  ranged:     8,
  charger:    8,
  caster:    10,
  support:    8,
  brute:     15,
};

// Budget scales with floor; DungeonScene calls this
export function spawnBudgetForFloor(floor: number): number {
  return 180 + floor * 55;
}

// Which enemy themes appear on each floor
export function themesForFloor(floor: number): EnemyTheme[] {
  switch (floor) {
    case 1:  return ['goblin', 'cave'];
    case 2:  return ['flooded', 'forest', 'deadland', 'pond', 'rock'];
    case 3:  return ['fungal'];
    case 4:  return ['barracks'];
    case 5:  return ['foundry'];
    case 6:  return ['frozen'];
    case 7:  return ['catacombs'];
    case 8:  return ['void'];
    case 9:  return ['court'];
    case 10:
    case 11: return ['throne'];
    default: return ['cave'];
  }
}

// ── Elite / Champion rolling ──────────────────────────────────────────────────
const ALL_AFFIXES: EliteAffix[] = [
  'vampiric', 'frenzied', 'armored', 'volatile',
  'stormtouched', 'toxic', 'shielded', 'hasted_aura',
  // P10 matchup-aware affixes
  'warded', 'unstable_core', 'bloodgorged',
];

function pickAffixes(count: number): EliteAffix[] {
  const pool = [...ALL_AFFIXES];
  const result: EliteAffix[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

/** Roll whether a spawn becomes elite/champion. Returns null for normal enemy. */
export function rollEliteConfig(floor: number): EliteConfig | null {
  const eliteChance    = Math.min(0.20, 0.08 + floor * 0.012);
  const championChance = eliteChance * 0.15;
  const r = Math.random();
  if (r < championChance) {
    const numAffixes = Math.random() < 0.5 ? 2 : 3;
    return { affixes: pickAffixes(numAffixes), isChampion: true, hpMult: 3.0 };
  }
  if (r < eliteChance) {
    return { affixes: pickAffixes(1), isChampion: false, hpMult: 1.5 };
  }
  return null;
}

// ── Aura colors per affix ─────────────────────────────────────────────────────
export const AFFIX_AURA_COLOR: Record<EliteAffix, number> = {
  vampiric:       0xff3333,
  frenzied:       0xff8800,
  armored:        0x99aacc,
  volatile:       0xaa44ff,
  stormtouched:   0x3388ff,
  toxic:          0x44ff44,
  shielded:       0xffffff,
  hasted_aura:    0xffff33,
  // P10 matchup-aware affixes
  warded:         0x44ddff,
  unstable_core:  0xff44aa,
  bloodgorged:    0xcc0000,
};

// ── Full enemy roster ─────────────────────────────────────────────────────────
export const ENEMY_DEFS: EnemyDef[] = [

  // ── Floor 1: Goblin / Cave ───────────────────────────────────────────────────
  { id: 'goblin',         name: 'Goblin',           hp: 165,  dmg: 32,  speed: 68, exp: 9,  archetype: 'chaser',
    dropItem: 'mana_stone_1', dropChance: 0.50, floorMin: 1, theme: 'goblin',
    body: 'flesh', elemFamily: 'beast',
    identity: 'rushes in packs; uses numbers to overwhelm', signature: 'pack pressure + shield-charge', counter: 'spread them apart before they clump',
    statusVuln: ['bleed', 'poison'], lore: 'Tunnel-bred scavengers that overwhelm by weight of numbers. Every goblin killed earns the shaman\'s wrath.' },
  { id: 'goblin_shaman',  name: 'Goblin Shaman',    hp: 126,  dmg: 48,  speed: 52, exp: 16, archetype: 'ranged',
    dropItem: 'mana_stone_1', dropChance: 0.50, floorMin: 1, theme: 'goblin', element: 'fire', rangeMin: 90,
    body: 'flesh', elemFamily: 'beast',
    identity: 'heals and buffs pack members; kill-first priority', signature: 'fire bolt + pack heal aura', counter: 'burst it down before engaging the pack',
    statusVuln: ['poison'], lore: 'Barely shamanic, but their hex-healing and fire spit makes a trash pack into an attrition fight.' },
  { id: 'bat',            name: 'Cave Bat',          hp: 78,   dmg: 24,  speed: 88, exp: 6,  archetype: 'swarm',
    dropItem: 'mana_stone_1', dropChance: 0.40, floorMin: 1, theme: 'cave',
    body: 'aerial', elemFamily: 'beast',
    identity: 'fast, erratic, difficult to track in low light', signature: 'dive-bomb swarm pattern', counter: 'wide-arc sweep or AoE to hit multiple',
    statusVuln: ['shock'], lore: 'Nocturnal echolocators. Individually harmless; in numbers they interrupt every attack animation.' },
  { id: 'cave_slime',     name: 'Cave Slime',        hp: 480,  dmg: 55,  speed: 28, exp: 22, archetype: 'brute',
    dropItem: 'mana_stone_1', dropChance: 0.55, floorMin: 1, theme: 'cave',
    body: 'gelatinous', elemFamily: 'beast',
    hitzones: [{ id: 'core', rawMod: 1.4, elemMod: 1.2 }, { id: 'body', rawMod: 0.8, elemMod: 0.9 }],
    breakPart: { dmgThreshold: 240, dropItemId: 'mana_stone_1' },
    identity: 'gelatinous tank; absorbs blunt and bleed; core is exposed when damaged', signature: 'slow advance + acid engulf', counter: 'slash to split, then mop up fragments',
    statusVuln: ['burn'], lore: 'Animated digestive acid. Every sword stroke that misses the core feeds it. Fire is the reliable answer.' },
  { id: 'spider',         name: 'Rock Spider',       hp: 174,  dmg: 40,  speed: 62, exp: 11, archetype: 'chaser',
    dropItem: 'mana_stone_1', dropChance: 0.50, floorMin: 2, theme: 'cave', element: 'poison',
    body: 'chitin', elemFamily: 'insect',
    identity: 'ambushes from above; poisons on contact', signature: 'ceiling drop + poison bite', counter: 'fire burst or ice to interrupt bite chain',
    statusVuln: ['burn', 'frozen'], lore: 'Stalactite predators. The first bite is guaranteed if you walk under a colony.' },
  { id: 'skeleton',       name: 'Skeleton',          hp: 285,  dmg: 56,  speed: 55, exp: 18, archetype: 'chaser',
    dropItem: 'mana_stone_1', dropChance: 0.50, floorMin: 3, theme: 'cave',
    body: 'bone', elemFamily: 'undead',
    identity: 'resilient to slashing; bones shatter under blunt', signature: 'rattle charge', counter: 'blunt weapon or radiant element',
    statusVuln: ['ko'], lore: 'Animated calcium. Slashing just nicks bone; a mace breaks it properly.' },
  { id: 'golem',          name: 'Stone Golem',       hp: 630,  dmg: 76,  speed: 30, exp: 35, archetype: 'brute',
    dropItem: 'mana_stone_1', dropChance: 0.60, floorMin: 5, theme: 'cave',
    body: 'construct', elemFamily: 'construct',
    hitzones: [{ id: 'core', rawMod: 1.5, elemMod: 1.5, breakable: true }, { id: 'body', rawMod: 0.7, elemMod: 0.8 }],
    breakPart: { dmgThreshold: 315, dropItemId: 'iron_ore' },
    identity: 'near-immune until glowing core is exposed', signature: 'ground slam + core energy burst', counter: 'target the glowing core (lightning or blunt)',
    statusVuln: ['shock'], lore: 'Ancient guardian animated by a lodestone. The core is its heart and sole weakness.' },
  { id: 'troll',          name: 'Cave Troll',        hp: 435,  dmg: 92,  speed: 56, exp: 44, archetype: 'brute',
    dropItem: 'mana_stone_1', dropChance: 0.60, floorMin: 7, theme: 'cave',
    body: 'flesh', elemFamily: 'beast',
    hitzones: [{ id: 'head', rawMod: 1.3, elemMod: 1.3 }, { id: 'body', rawMod: 1.0, elemMod: 1.0 }],
    breakPart: { dmgThreshold: 220, dropItemId: 'mana_stone_1' },
    identity: 'regenerates HP unless burned; charges through corners', signature: 'shoulder-charge + regen', counter: 'fire element to stop regen; interrupt charge',
    statusVuln: ['burn', 'wound'], lore: 'Stone flesh knits itself back unless set alight. Every pause is regen time.' },

  // ── Floor 2: Flooded Halls ───────────────────────────────────────────────────
  { id: 'drowned',        name: 'Drowned',           hp: 300,  dmg: 55,  speed: 65, exp: 28, archetype: 'chaser',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'flooded', element: 'lightning',
    body: 'flesh', elemFamily: 'aquatic',
    identity: 'applies Wet on contact — sets up Superconduct chain', signature: 'wet grasp + lightning pulse', counter: 'lightning while it is wet for ×2 shock',
    statusVuln: ['shock', 'wound'], lore: 'Drowned sailors still clutching their lanterns. The waterlogged flesh conducts lightning terribly well.' },
  { id: 'reed_lurker',    name: 'Reed Lurker',       hp: 220,  dmg: 65,  speed: 78, exp: 30, archetype: 'chaser',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'flooded', element: 'poison',
    body: 'flesh', elemFamily: 'aquatic',
    identity: 'ambushes from water-reeds; poisons and retreats', signature: 'stalk + poison slash + retreat', counter: 'area splash to flush before it re-enters reeds',
    statusVuln: ['bleed'], lore: 'Amphibious predator. Disappears into flooded channels between strikes. Fire and AoE flush it out.' },
  { id: 'toad_caster',    name: 'Toad Caster',       hp: 180,  dmg: 70,  speed: 38, exp: 34, archetype: 'caster',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'flooded', element: 'lightning', rangeMin: 80,
    body: 'flesh', elemFamily: 'aquatic',
    identity: 'channels lightning AoE pools — step out before detonation', signature: '900ms AoE pool cast', counter: 'interrupt during cast window or dodge wide',
    statusVuln: ['burn', 'frostbite'], lore: 'Bloated with stored lightning. The throat-sac glow means a pool is coming. You have 900ms.' },

  // ── Floor 2: Forest biome ────────────────────────────────────────────────────
  { id: 'treant',         name: 'Treant',            hp: 480,  dmg: 55,  speed: 32, exp: 40, archetype: 'brute',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'forest',
    body: 'plant', elemFamily: 'plant',
    hitzones: [{ id: 'roots', rawMod: 1.4, elemMod: 1.0 }, { id: 'trunk', rawMod: 0.8, elemMod: 1.2 }],
    breakPart: { dmgThreshold: 240, dropItemId: 'mana_stone_2' },
    identity: 'roots-ensnare if you stand still; fire dismantles it fast', signature: 'root stomp + branch sweep', counter: 'fire element + keep moving',
    statusVuln: ['burn'], lore: 'Ancient grove-heart gone hostile. It roots enemies that hold position. Fire is the universal counter.' },
  { id: 'forest_wisp',    name: 'Forest Wisp',       hp: 200,  dmg: 40,  speed: 88, exp: 28, archetype: 'ranged',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'forest', rangeMin: 80,
    body: 'ethereal', elemFamily: 'spectral',
    identity: 'ethereal — physical attacks heavily penalized', signature: 'erratic orbit + chill bolt', counter: 'bring an elemental weapon; void or radiant',
    statusVuln: ['sear'], lore: 'Compressed forest spirits. Pure physical barely registers on them. Elements do.' },
  { id: 'vine_snare',     name: 'Vine Snare',        hp: 600,  dmg: 35,  speed: 20, exp: 45, archetype: 'support',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'forest',
    body: 'plant', elemFamily: 'plant',
    identity: 'roots the player to set up pack attacks', signature: 'ranged snare tendril', counter: 'kill first or fire element to burn the vines',
    statusVuln: ['burn', 'bleed'], lore: 'A carnivorous plant that evolved a ranged strangler-tendril. The real threat is what it holds you for.' },

  // ── Floor 2: Deadland biome ──────────────────────────────────────────────────
  { id: 'ghoul',          name: 'Ghoul',             hp: 300,  dmg: 60,  speed: 74, exp: 35, archetype: 'skirmisher',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'deadland', rangeMin: 60,
    body: 'flesh', elemFamily: 'undead',
    identity: 'stab-and-retreat loop; hard to punish', signature: 'lunge hit + 1.3s retreat', counter: 'punish the retreat with a heavy during its back-step',
    statusVuln: ['wound', 'bleed'], lore: 'Grave-risen predator that learned caution from its first death. Its retreat is timed to dodge retaliation.' },
  { id: 'wraith',         name: 'Wraith',            hp: 240,  dmg: 55,  speed: 72, exp: 32, archetype: 'skirmisher',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'deadland', rangeMin: 60,
    body: 'ethereal', elemFamily: 'spectral',
    identity: 'ethereal; chill-on-hit slows retaliation', signature: 'phase-through-wall approach + chill touch', counter: 'void or radiant element; attack during its materialization',
    statusVuln: ['sear'], lore: 'A hate-echo with no body. Physical attacks pass through at half effect. Radiant light forces it to materialize.' },
  { id: 'bone_golem',     name: 'Bone Golem',        hp: 720,  dmg: 65,  speed: 30, exp: 55, archetype: 'brute',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'deadland',
    body: 'bone', elemFamily: 'undead',
    hitzones: [{ id: 'skull', rawMod: 1.4, elemMod: 1.3, breakable: true }, { id: 'frame', rawMod: 0.9, elemMod: 0.9 }],
    breakPart: { dmgThreshold: 360, dropItemId: 'mana_stone_2' },
    identity: 'skull is the critical hitzone; breaking it stuns and drops bone material', signature: 'ground slam + skull projectile', counter: 'blunt vs skull; radiant for bonus',
    statusVuln: ['ko', 'wound'], lore: 'Stitched from a mass grave. The skull was the original owner — and it is still the weakest link.' },

  // ── Floor 2: Pond biome ──────────────────────────────────────────────────────
  { id: 'frog_warrior',   name: 'Frog Warrior',      hp: 360,  dmg: 50,  speed: 76, exp: 38, archetype: 'chaser',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'pond',
    body: 'flesh', elemFamily: 'aquatic',
    identity: 'leaps; leaves Wet puddle on landing — sets up lightning chain', signature: 'leap + Wet splash', counter: 'lightning weapon to chain off puddles',
    statusVuln: ['shock'], lore: 'Marsh warrior that uses its own body as a conductor. Step in the puddle and the next hit chains.' },
  { id: 'swamp_slug',     name: 'Swamp Slug',        hp: 800,  dmg: 30,  speed: 22, exp: 50, archetype: 'brute',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'pond', element: 'poison',
    body: 'gelatinous', elemFamily: 'aquatic',
    hitzones: [{ id: 'eyestalk', rawMod: 1.5, elemMod: 1.3, breakable: true }, { id: 'body', rawMod: 0.7, elemMod: 0.8 }],
    breakPart: { dmgThreshold: 400, dropItemId: 'mana_stone_2' },
    identity: 'poison aura at close range; eyestalk is the only viable weak point', signature: 'poison cloud + eyestalk beam', counter: 'target eyestalk with pierce weapon',
    statusVuln: ['wound'], lore: 'A living chemical vat. Its gelatinous body absorbs physical hits. The eyestalk is nerve-rich and vulnerable.' },
  { id: 'water_serpent',  name: 'Water Serpent',     hp: 280,  dmg: 65,  speed: 80, exp: 36, archetype: 'skirmisher',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'pond', rangeMin: 55,
    body: 'flesh', elemFamily: 'aquatic',
    identity: 'fast strafe-bites; bleeds through thin armor', signature: 'figure-eight strafe + bite-chain', counter: 'AoE to interrupt its strafe orbit',
    statusVuln: ['bleed', 'shock'], lore: 'Strikes from unexpected angles. The bite pattern requires tracking its orbit to dodge effectively.' },

  // ── Floor 2: Rock biome ──────────────────────────────────────────────────────
  { id: 'rock_crab',      name: 'Rock Crab',         hp: 660,  dmg: 45,  speed: 34, exp: 48, archetype: 'brute',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'rock',
    body: 'chitin', elemFamily: 'insect',
    hitzones: [{ id: 'underbelly', rawMod: 1.6, elemMod: 1.4, breakable: true }, { id: 'shell', rawMod: 0.6, elemMod: 0.7 }],
    breakPart: { dmgThreshold: 330, dropItemId: 'mana_stone_2' },
    identity: 'shell resists everything; flip it to expose the soft underbelly', signature: 'shell-guard + claw slam', counter: 'pierce the underbelly (approach from behind or below)',
    statusVuln: ['wound', 'burn'], lore: 'Evolved carapace thicker than iron. But flip it and the underbelly is exposed chitin — no armor.' },
  { id: 'stone_imp',      name: 'Stone Imp',         hp: 210,  dmg: 55,  speed: 78, exp: 30, archetype: 'ranged',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'rock', rangeMin: 80,
    body: 'construct', elemFamily: 'construct',
    identity: 'ranged rock-hurls that stagger; kites and calls attention', signature: 'stagger throw + screech alarm', counter: 'rush it fast before it walls you in with screech reinforcements',
    statusVuln: ['shock'], lore: 'Stone-bodied minor construct. Its screech alarm brings trouble; its rocks stagger. Neither is fun.' },
  { id: 'cave_drake',     name: 'Cave Drake',        hp: 540,  dmg: 70,  speed: 54, exp: 52, archetype: 'charger',
    dropItem: 'mana_stone_2', dropChance: 0.50, floorMin: 2, theme: 'rock', element: 'fire',
    body: 'flesh', elemFamily: 'fire',
    identity: 'charges headlong then breathes fire on wake; fire absorb', signature: 'charge + fire breath linger', counter: 'dodge the charge, punish during the breath window with ice',
    statusVuln: ['frozen', 'frostbite'], lore: 'Dragonkin degenerate. Charges because it is too aggressive for strategy. Its fire wake punishes chasers.' },

  // ── Floor 3: Fungal Depths ───────────────────────────────────────────────────
  { id: 'spore_brute',    name: 'Spore Brute',       hp: 600,  dmg: 80,  speed: 28, exp: 52, archetype: 'brute',
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 3, theme: 'fungal', element: 'poison',
    body: 'plant', elemFamily: 'plant',
    hitzones: [{ id: 'cap', rawMod: 1.4, elemMod: 1.2, breakable: true }, { id: 'stalk', rawMod: 0.8, elemMod: 1.0 }],
    breakPart: { dmgThreshold: 300, dropItemId: 'mana_stone_3' },
    identity: 'cap break releases pollen cloud that obscures vision', signature: 'spore cap burst + trample', counter: 'break cap early or bring poison resistance',
    statusVuln: ['burn', 'wound'], lore: 'Overgrown mycelium pillar. The cap stores concentrated pollen. Breaking it releases a blinding cloud — your choice.' },
  { id: 'myconid',        name: 'Myconid',           hp: 280,  dmg: 40,  speed: 44, exp: 38, archetype: 'support',
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 3, theme: 'fungal', element: 'poison',
    body: 'plant', elemFamily: 'plant',
    identity: 'support: heals allies and propagates spores; kill before pack heals', signature: 'heal pulse + spore propagation', counter: 'kill it first; fire if you need range',
    statusVuln: ['burn', 'bleed'], lore: 'The fungal colony\'s mother-node. Its death sends a death-pulse that speeds up nearby mycelium. Kill it fast.' },
  { id: 'fungal_spider',  name: 'Fungal Spider',     hp: 240,  dmg: 55,  speed: 70, exp: 36, archetype: 'chaser',
    dropItem: 'mana_stone_3', dropChance: 0.50, floorMin: 3, theme: 'fungal', element: 'poison',
    body: 'chitin', elemFamily: 'insect',
    identity: 'breeds when not killed quickly; pack multiplication threat', signature: 'rapid-bite + spawn sac', counter: 'AoE burst to suppress before sacs activate',
    statusVuln: ['burn', 'frozen'], lore: 'Infested with fungal eggs. Let it run loose for four seconds and the floor gets much harder.' },

  // ── Floor 4: Old Barracks ────────────────────────────────────────────────────
  { id: 'skeleton_soldier', name: 'Skeleton Soldier', hp: 400, dmg: 70,  speed: 58, exp: 55, archetype: 'chaser',
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 4, theme: 'barracks',
    body: 'bone', elemFamily: 'undead',
    identity: 'shield-bearer; front-facing hits are heavily reduced', signature: 'shield-block + weapon stab', counter: 'blunt from behind or radiant element',
    statusVuln: ['ko', 'sear'], lore: 'Centuries of garrison duty left muscle memory. It still blocks exactly as trained. Its back is unarmored.' },
  { id: 'crossbow_wight',  name: 'Crossbow Wight',   hp: 300,  dmg: 90,  speed: 44, exp: 62, archetype: 'ranged',
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 4, theme: 'barracks', rangeMin: 110,
    body: 'bone', elemFamily: 'undead',
    identity: 'rapid-fire bolt barrage; retreats from melee range', signature: 'three-bolt burst + backpedal', counter: 'close in fast to shut down the bolt window',
    statusVuln: ['bleed', 'ko'], lore: 'A marksman even in death. Its bolts stagger at range and it knows to retreat when cornered.' },
  { id: 'shield_revenant', name: 'Shield Revenant',  hp: 700,  dmg: 60,  speed: 35, exp: 70, archetype: 'brute',
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 4, theme: 'barracks',
    body: 'armored', elemFamily: 'undead',
    hitzones: [{ id: 'back', rawMod: 1.5, elemMod: 1.4 }, { id: 'front', rawMod: 0.5, elemMod: 0.6 }],
    breakPart: { dmgThreshold: 350, dropItemId: 'mana_stone_3' },
    identity: 'face is near-immune; back is fully exposed — rotate around it', signature: 'frontal shield-bash + spin tracking', counter: 'circle to the back while it tracks forward',
    statusVuln: ['wound', 'sear'], lore: 'The shield is part of its skeleton now — it cannot put it down. But backs need armor too.' },

  // ── Floor 5: Ashen Foundry ───────────────────────────────────────────────────
  { id: 'ember_hound',    name: 'Ember Hound',       hp: 420,  dmg: 100, speed: 74, exp: 72, archetype: 'charger',
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 5, theme: 'foundry', element: 'fire',
    body: 'flesh', elemFamily: 'fire',
    identity: 'charges in pairs; fire breath lingers as a floor hazard', signature: 'sprint charge + fire breath', counter: 'ice weapon + dodge both charges at once',
    statusVuln: ['frozen', 'frostbite'], lore: 'Bred in the foundry furnaces. Pairs hunt together. Separating them is the first task.' },
  { id: 'forge_golem',    name: 'Forge Golem',       hp: 900,  dmg: 110, speed: 28, exp: 88, archetype: 'brute', canFeint: true,
    dropItem: 'mana_stone_3', dropChance: 0.60, floorMin: 5, theme: 'foundry', element: 'fire',
    body: 'construct', elemFamily: 'fire',
    hitzones: [{ id: 'furnace', rawMod: 1.6, elemMod: 1.5, breakable: true }, { id: 'plating', rawMod: 0.6, elemMod: 0.7 }],
    breakPart: { dmgThreshold: 450, dropItemId: 'mana_stone_3' },
    identity: 'furnace hitzone is the critical weak point; breaking vents steam', signature: 'piston slam + molten pour', counter: 'ice element on furnace — both overcomes fire absorb and hits the weak point',
    statusVuln: ['frozen', 'wound'], lore: 'The foundry\'s autonomous foreman. Its furnace core glows white with built-up heat. Ice cracks it.' },
  { id: 'cinder_mage',    name: 'Cinder Mage',       hp: 320,  dmg: 90,  speed: 44, exp: 80, archetype: 'caster', canFeint: true,
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 5, theme: 'foundry', element: 'fire', rangeMin: 90,
    body: 'flesh', elemFamily: 'fire',
    identity: 'channels Meteor — the circle will one-shot if you stand in it', signature: '900ms Meteor cast — visible floor ring', counter: 'interrupt during cast or dodge the circle entirely',
    statusVuln: ['frozen', 'frostbite'], lore: 'A pyromancer with one spell and perfect aim. The ring on the floor is not decoration.' },

  // ── Floor 6: Frozen Reliquary ────────────────────────────────────────────────
  { id: 'frost_wolf',     name: 'Frost Wolf',        hp: 280,  dmg: 65,  speed: 90, exp: 68, archetype: 'swarm',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 6, theme: 'frozen', element: 'ice',
    body: 'flesh', elemFamily: 'ice',
    identity: 'pack that applies Frostbite and pins you for the alpha', signature: 'encircle + Frostbite nip', counter: 'fire splash to thaw the whole pack',
    statusVuln: ['burn', 'bleed'], lore: 'Tundra hunters that evolved a cooperative frostbite-and-lunge tactic. The alpha only moves after the pack stacks chill.' },
  { id: 'ice_archer',     name: 'Ice Archer',        hp: 360,  dmg: 95,  speed: 48, exp: 80, archetype: 'ranged',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 6, theme: 'frozen', element: 'ice', rangeMin: 120,
    body: 'flesh', elemFamily: 'ice',
    identity: 'kites endlessly; fires Frozen bolts from range', signature: 'endless kite + frozen bolt', counter: 'close inside minimum range of 120px',
    statusVuln: ['burn', 'wound'], lore: 'Former reliquary guard. Maintains exactly 120px distance by instinct. Step inside that bubble.' },
  { id: 'glacial_knight', name: 'Glacial Knight',    hp: 1100, dmg: 120, speed: 32, exp: 110,archetype: 'brute', canFeint: true,
    dropItem: 'mana_stone_4', dropChance: 0.60, floorMin: 6, theme: 'frozen', element: 'ice',
    body: 'armored', elemFamily: 'ice',
    hitzones: [{ id: 'visor', rawMod: 1.4, elemMod: 1.5, breakable: true }, { id: 'armor', rawMod: 0.7, elemMod: 0.8 }],
    breakPart: { dmgThreshold: 550, dropItemId: 'mana_stone_4' },
    identity: 'super-armor charge that one-shots on hit; break visor to interrupt charge', signature: 'ice-charge + visor-guard', counter: 'break visor first; then fire element to exploit ice weakness',
    statusVuln: ['burn', 'ko'], lore: 'Entombed in the reliquary for eight hundred years. Its charge is unchanged. The visor has a pressure fracture.' },

  // ── Floor 7: Shadowed Catacombs ──────────────────────────────────────────────
  { id: 'wraith_shade',   name: 'Wraith Shade',      hp: 450,  dmg: 100, speed: 76, exp: 95, archetype: 'skirmisher',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 7, theme: 'catacombs', rangeMin: 65,
    body: 'ethereal', elemFamily: 'spectral',
    identity: 'mimics your last attack frame — baits same dodge twice', signature: 'shadow copy attack', counter: 'vary your dodge timing; void or radiant element',
    statusVuln: ['sear', 'corruption'], lore: 'The dungeon\'s memory of deaths. Fights using moves it copied from past adventurers. Familiarity is the trap.' },
  { id: 'bone_colossus',  name: 'Bone Colossus',     hp: 1400, dmg: 140, speed: 25, exp: 130,archetype: 'brute', canFeint: true,
    dropItem: 'mana_stone_4', dropChance: 0.60, floorMin: 7, theme: 'catacombs',
    body: 'bone', elemFamily: 'undead',
    hitzones: [{ id: 'ribcage', rawMod: 1.3, elemMod: 1.4, breakable: true }, { id: 'limbs', rawMod: 1.0, elemMod: 0.9 }],
    breakPart: { dmgThreshold: 700, dropItemId: 'mana_stone_4' },
    identity: 'ground-slam shockwave forces jump; ribcage breaks for huge damage window', signature: 'shockwave slam + ribcage collapse', counter: 'blunt on ribcage; dodge the shockwave ring',
    statusVuln: ['ko', 'sear'], lore: 'Built from a full catacomb\'s worth of bones. Its ribcage is a cathedral arch — structurally magnificent but fragile to impact.' },
  { id: 'cultist',        name: 'Cultist',           hp: 380,  dmg: 70,  speed: 55, exp: 85, archetype: 'support',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 7, theme: 'catacombs', element: 'void',
    body: 'flesh', elemFamily: 'void',
    identity: 'summons void pools underfoot; channels corruption on death', signature: 'void pool summon + death channel', counter: 'interrupt channeling; stay mobile on the void pools',
    statusVuln: ['bleed', 'sear'], lore: 'Devout servants of the Void. Their final act is a death-channel that tries to corrupt the killer.' },

  // ── Floor 8: Voidtouched Caverns ─────────────────────────────────────────────
  { id: 'void_spawn',     name: 'Void Spawn',        hp: 320,  dmg: 75,  speed: 96, exp: 88, archetype: 'swarm',
    dropItem: 'mana_stone_4', dropChance: 0.50, floorMin: 8, theme: 'void',
    body: 'ethereal', elemFamily: 'void',
    identity: 'emerges from rift tears; grows stronger near void rifts', signature: 'rift emergence + proximity enrage', counter: 'radiant splash to close rifts and deny reinforcements',
    statusVuln: ['sear', 'corruption'], lore: 'Unformed matter from the void given just enough shape to hunt. They strengthen near open rifts.' },
  { id: 'riftling',       name: 'Riftling',          hp: 520,  dmg: 110, speed: 82, exp: 108,archetype: 'skirmisher',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 8, theme: 'void', rangeMin: 70,
    body: 'flesh', elemFamily: 'void',
    identity: 'tears pocket dimensions that summon more riftlings', signature: 'blink-dash + pocket-rift tear', counter: 'seal pockets with radiant before they cascade',
    statusVuln: ['sear', 'wound'], lore: 'A Void-touched humanoid that learned to slip between spatial layers. Each pocket it opens costs time and patience to close.' },
  { id: 'maw',            name: 'Maw',               hp: 900,  dmg: 150, speed: 60, exp: 120,archetype: 'chaser',
    dropItem: 'mana_stone_4', dropChance: 0.60, floorMin: 8, theme: 'void',
    body: 'flesh', elemFamily: 'void',
    hitzones: [{ id: 'maw', rawMod: 1.5, elemMod: 1.3 }, { id: 'body', rawMod: 0.9, elemMod: 1.0 }],
    breakPart: { dmgThreshold: 450, dropItemId: 'mana_stone_4' },
    identity: 'turns invisible between lunges; Sonic Bomb reveals it', signature: 'invisible stalk + lunge from blind spot', counter: 'Sonic Bomb to reveal; radiant element counters void absorb',
    statusVuln: ['sear', 'wound'], lore: 'A predator evolved from the void itself. Between attacks it is indistinguishable from shadow. Listen for the audio sting.' },

  // ── Floor 9: The Ascended Court ──────────────────────────────────────────────
  { id: 'fallen_knight',  name: 'Fallen Knight',     hp: 800,  dmg: 130, speed: 62, exp: 130,archetype: 'chaser',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 9, theme: 'court',
    body: 'armored', elemFamily: 'undead',
    identity: 'carries boss-tier poise; charges through walls', signature: 'wall-charge + heavy combo', counter: 'fire or radiant to bypass armor; dodge the charge line',
    statusVuln: ['wound', 'sear'], lore: 'Elite guardians who asked to be interred in their armor. They still guard the court. Against everything.' },
  { id: 'arcane_sentinel',name: 'Arcane Sentinel',   hp: 600,  dmg: 140, speed: 40, exp: 145,archetype: 'caster',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 9, theme: 'court', element: 'lightning', rangeMin: 100,
    body: 'construct', elemFamily: 'construct',
    identity: 'magic-immune until antenna is destroyed; then weak to all', signature: 'lightning volley + antenna shield', counter: 'break antenna with physical first; then anything',
    statusVuln: ['shock', 'ko'], lore: 'Animated court defense automaton. Its antenna projects an arcane null-field. Break it and every element hits full.' },
  { id: 'echo_shade',     name: 'Echo Shade',        hp: 650,  dmg: 120, speed: 80, exp: 138,archetype: 'skirmisher',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 9, theme: 'court', rangeMin: 65,
    body: 'ethereal', elemFamily: 'spectral',
    identity: 'copies your most recent weapon moveset and uses it back at you', signature: 'skill mirror + ethereal dodge', counter: 'switch weapon or element before it mirrors; void element',
    statusVuln: ['corruption', 'sear'], lore: 'The court\'s entertainment: a duel with your own technique. It learns from the last three seconds of your input.' },

  // ── Floor 10: Throne Approach ────────────────────────────────────────────────
  { id: 'iron_guardian',  name: 'Iron Guardian',     hp: 1600, dmg: 160, speed: 28, exp: 175,archetype: 'brute', canFeint: true,
    dropItem: 'mana_stone_4', dropChance: 0.65, floorMin: 10, theme: 'throne',
    body: 'construct', elemFamily: 'construct',
    hitzones: [{ id: 'power_core', rawMod: 1.6, elemMod: 1.6, breakable: true }, { id: 'chassis', rawMod: 0.6, elemMod: 0.7 }],
    breakPart: { dmgThreshold: 800, dropItemId: 'mana_stone_4' },
    identity: 'power-core absorbs nearly all element; sustained physical cracks it', signature: 'sweeping arm + core shockwave', counter: 'pure blunt on power core until it cracks; then lightning finishes it',
    statusVuln: ['shock', 'ko'], lore: 'The throne\'s last line of automated defense. Its power core is a structural engineering marvel. Also its only weakness.' },
  { id: 'shadow_herald',  name: 'Shadow Herald',     hp: 750,  dmg: 145, speed: 82, exp: 165,archetype: 'skirmisher',
    dropItem: 'mana_stone_4', dropChance: 0.60, floorMin: 10, theme: 'throne', rangeMin: 65,
    body: 'flesh', elemFamily: 'void',
    identity: 'marks player for The Hunter — attracts nemesis if mark locks in', signature: 'void mark + hunter beacon', counter: 'kill it before the mark completes (3s window)',
    statusVuln: ['bleed', 'sear'], lore: 'An advance scout that doubles as a lure. Its death mark radiates a signal only The Hunter can track.' },
  { id: 'void_herald',    name: 'Void Herald',       hp: 650,  dmg: 155, speed: 46, exp: 170,archetype: 'caster', canFeint: true,
    dropItem: 'mana_stone_4', dropChance: 0.60, floorMin: 10, theme: 'throne', element: 'void', rangeMin: 95,
    body: 'flesh', elemFamily: 'void',
    identity: 'opens Void Gate; if gate opens floor fills with reinforcements', signature: '900ms Void Gate cast', counter: 'kill the herald before the gate opens (900ms interrupt window)',
    statusVuln: ['sear', 'wound'], lore: 'A living key to the void-between. If you let it finish the gate, what comes through is the floor\'s final challenge.' },

  // ── P10: New monster families — complete the web ─────────────────────────────

  // Ironback Beetle (F3-5, chitin, fungal theme)
  { id: 'ironback_beetle', name: 'Ironback Beetle',  hp: 480,  dmg: 60,  speed: 40, exp: 50, archetype: 'brute',
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 3, theme: 'fungal',
    body: 'chitin', elemFamily: 'insect',
    hitzones: [{ id: 'underbelly', rawMod: 1.8, elemMod: 1.5, breakable: true }, { id: 'carapace', rawMod: 0.4, elemMod: 0.5 }],
    breakPart: { dmgThreshold: 240, dropItemId: 'mana_stone_3' },
    identity: 'carapace resists slash and blunt; only pierce on underbelly deals real damage', signature: 'carapace-guard + mandible slam', counter: 'pierce weapon from behind; break underbelly to expose soft tissue',
    statusVuln: ['wound', 'burn'], lore: 'The fungal cavern\'s armored detritivore. Its carapace evolved to resist root-burrowing roots. Knives and mauls bounce off.' },

  // Gel Cube (F2-4, gelatinous, flooded theme)
  { id: 'gel_cube',        name: 'Gel Cube',          hp: 750,  dmg: 45,  speed: 22, exp: 52, archetype: 'brute',
    dropItem: 'mana_stone_2', dropChance: 0.55, floorMin: 2, theme: 'flooded',
    body: 'gelatinous', elemFamily: 'aquatic',
    hitzones: [{ id: 'nucleus', rawMod: 1.6, elemMod: 1.3 }, { id: 'body', rawMod: 0.6, elemMod: 0.8 }],
    breakPart: { dmgThreshold: 375, dropItemId: 'mana_stone_2' },
    identity: 'engulfs player (applies Stuck); slash to free', signature: 'slow-approach + engulf + digest', counter: 'slash through the gel to escape Stuck; lightning chain if wet',
    statusVuln: ['burn', 'shock'], lore: 'A carnivorous cube of animated digestive gel. Once engulfed, the only motion is dissolution.' },

  // Mirror Knight (F4-6, armored, barracks theme)
  { id: 'mirror_knight',   name: 'Mirror Knight',     hp: 480,  dmg: 75,  speed: 50, exp: 68, archetype: 'brute',
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 4, theme: 'barracks',
    body: 'armored', elemFamily: 'undead',
    hitzones: [{ id: 'mirror_shield', rawMod: 0.0, elemMod: 0.0 }, { id: 'exposed_flank', rawMod: 1.4, elemMod: 1.3 }],
    breakPart: { dmgThreshold: 240, dropItemId: 'mana_stone_3' },
    identity: 'reflects projectiles back at full speed; punishes lazy ranged play', signature: 'shield reflect + counter lunge', counter: 'melee-only approach; target the exposed flank on the left side',
    statusVuln: ['bleed', 'ko'], lore: 'A dead knight whose polished shield became part of its haunting. Arrows come back. Swords don\'t.' },

  // Storm Elemental (F6-8, construct/storm, frozen theme)
  { id: 'storm_elemental', name: 'Storm Elemental',   hp: 600,  dmg: 95,  speed: 68, exp: 90, archetype: 'ranged',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 6, theme: 'frozen', element: 'lightning', rangeMin: 90,
    body: 'construct', elemFamily: 'storm',
    identity: 'absorbs lightning and enrages; weak to fire and ice', signature: 'lightning bolt + absorb-enrage at 3 lightning hits', counter: 'switch to fire or ice immediately if you were using lightning',
    statusVuln: ['burn', 'frostbite'], lore: 'A storm given physical form by the reliquary\'s ancient binding circles. Lightning feeds it. Fire and ice unmake it.' },

  // Bog Witch (F2-3, flesh, flooded theme)
  { id: 'bog_witch',       name: 'Bog Witch',          hp: 220,  dmg: 65,  speed: 42, exp: 40, archetype: 'caster',
    dropItem: 'mana_stone_2', dropChance: 0.55, floorMin: 2, theme: 'flooded', element: 'poison', rangeMin: 80,
    body: 'flesh', elemFamily: 'beast',
    identity: 'curses the player\'s equipped element to deal half damage for 8s', signature: 'element-curse hex + poison barrage', counter: 'interrupt the hex cast or swap to a different element immediately',
    statusVuln: ['burn', 'sear'], lore: 'A hagfish-blooded crone who learned the dungeon\'s element bindings. The element she curses is always the one you entered the room with.' },

  // Sand Lurker (F5-7, chitin, foundry theme)
  { id: 'sand_lurker',     name: 'Sand Lurker',        hp: 380,  dmg: 105, speed: 72, exp: 78, archetype: 'chaser',
    dropItem: 'mana_stone_3', dropChance: 0.55, floorMin: 5, theme: 'foundry',
    body: 'chitin', elemFamily: 'insect',
    identity: 'buries in ash/sand; ambushes from below with a lunge', signature: 'burrowed stealth + erupt lunge', counter: 'Detector Charm or Sonic Bomb reveals; fire splash to flush out',
    statusVuln: ['burn', 'wound'], lore: 'An ambush predator from the foundry ash-fields. Its dorsal sensors detect footstep vibration to within two tiles.' },

  // Plague Hound (F3-6, flesh/beast, deadland theme)
  { id: 'plague_hound',    name: 'Plague Hound',       hp: 140,  dmg: 50,  speed: 96, exp: 36, archetype: 'swarm',
    dropItem: 'mana_stone_3', dropChance: 0.50, floorMin: 3, theme: 'deadland', element: 'poison',
    body: 'flesh', elemFamily: 'beast',
    identity: 'pack that stacks poison rapidly; each bite adds build-up', signature: 'pack bite-chain + poison aura', counter: 'Panacea or Cleansing Tonic; fire AoE to scatter the pack',
    statusVuln: ['burn', 'frozen'], lore: 'Diseased hunting dogs, faster in death than they ever were alive. A single bite is manageable. A pack of six is not.' },

  // Living Armor (F7-9, construct, court theme)
  { id: 'living_armor',    name: 'Living Armor',       hp: 1200, dmg: 130, speed: 30, exp: 140,archetype: 'brute', canFeint: true,
    dropItem: 'mana_stone_4', dropChance: 0.65, floorMin: 7, theme: 'court',
    body: 'construct', elemFamily: 'undead',
    hitzones: [{ id: 'gemstone', rawMod: 3.0, elemMod: 2.5, breakable: true }, { id: 'armor_plate', rawMod: 0.05, elemMod: 0.05 }],
    breakPart: { dmgThreshold: 600, dropItemId: 'mana_stone_4' },
    identity: 'armor plates are near-impervious; only the gemstone binding-focus deals real damage', signature: 'sweeping halberd + gem-shield', counter: 'locate the gem (front torso); pierce or radiant element only',
    statusVuln: ['sear'], lore: 'The court\'s animated ceremonial armor. The binding gem on the breastplate is the only point of vulnerability. Everything else is cosmetic.' },

  // Rift Wisp (F8-10, ethereal/void, void theme)
  { id: 'rift_wisp',       name: 'Rift Wisp',          hp: 280,  dmg: 85,  speed: 90, exp: 102,archetype: 'skirmisher',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 8, theme: 'void', rangeMin: 72,
    body: 'ethereal', elemFamily: 'void',
    identity: 'teleport-blinks around the room; tags the player to summon Riftlings', signature: 'blink + player-tag beacon', counter: 'radiant element to interrupt blink and deny Riftling summon',
    statusVuln: ['sear', 'corruption'], lore: 'A void lighthouse that calls Riftlings to its beacon. Stopping the beacon requires forcing it to materialize.' },

  // Choir Acolyte (F7, bone/undead, catacombs theme)
  { id: 'choir_acolyte',   name: 'Choir Acolyte',      hp: 320,  dmg: 55,  speed: 46, exp: 90, archetype: 'support',
    dropItem: 'mana_stone_4', dropChance: 0.55, floorMin: 7, theme: 'catacombs', element: 'void', rangeMin: 70,
    body: 'bone', elemFamily: 'undead',
    identity: 'chants to resurrect fallen undead nearby; radiant element disrupts the chant', signature: 'resurrection chant (900ms cast) + void bolt', counter: 'radiant element to interrupt or kill acolyte first',
    statusVuln: ['sear', 'ko'], lore: 'The catacomb choir-boys who refused to stop singing. Their hymn now animates the dead rather than praising the living.' },

  // Gravetide (F7-9, flesh/undead, catacombs theme)
  { id: 'gravetide',       name: 'Gravetide',           hp: 180,  dmg: 65,  speed: 88, exp: 80, archetype: 'swarm',
    dropItem: 'mana_stone_4', dropChance: 0.50, floorMin: 7, theme: 'catacombs',
    body: 'flesh', elemFamily: 'undead',
    identity: 'endless add-swarm unless the spawner-crypt is destroyed first', signature: 'mass emergence from crypt', counter: 'locate and destroy the spawner-crypt; radiant AoE on swarm',
    statusVuln: ['sear', 'burn'], lore: 'The catacomb dead responding to the acolyte\'s call. They keep coming as long as the crypt-seal pulses.' },

  // Aurelion (F1+, rare anomaly, flesh/beast, cave theme)
  { id: 'aurelion',        name: 'Aurelion',            hp: 600,  dmg: 0,   speed: 120, exp: 200,archetype: 'skirmisher',
    dropItem: 'mana_stone_1', dropChance: 0.0,  floorMin: 1, theme: 'cave', rangeMin: 999,
    body: 'flesh', elemFamily: 'beast',
    identity: 'rare radiant stag that flees on sight; tracking across 3 floors rewards Radiant infusion mat', signature: 'instant flee + cross-floor tracking', counter: 'follow its trail across three floors without killing it',
    statusVuln: [], lore: 'A luminous stag that appears at most once per descent. Ancient hunters claim it leads those patient enough to a place of radiant power.' },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function goblinDefs(): EnemyDef[] {
  return ENEMY_DEFS.filter(d => d.theme === 'goblin');
}

export function caveDefs(floor: number): EnemyDef[] {
  return ENEMY_DEFS.filter(d => d.theme === 'cave' && d.floorMin <= floor);
}

export function getThemeDefs(theme: EnemyTheme): EnemyDef[] {
  return ENEMY_DEFS.filter(d => d.theme === theme);
}

export function defsForFloor(floor: number): EnemyDef[] {
  const themes = new Set(themesForFloor(floor));
  return ENEMY_DEFS.filter(d => d.theme && themes.has(d.theme));
}

export function enemiesForFloor(floor: number): EnemyDef[] {
  return ENEMY_DEFS.filter(e => e.floorMin <= floor);
}
