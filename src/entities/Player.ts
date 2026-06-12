import Phaser from 'phaser';
import { PLAYER_SPEED, IFRAMES_DURATION, TRAP_NET_DURATION, expForLevel, TUNING, LEVEL_CAP } from '../config';
import { InputController } from '../systems/InputController';
import { SaveManager } from '../systems/SaveManager';
import { CharacterSave, ClassId, Stats, ItemInstance } from '../types';
import { StatusSystem, Ailment } from '../systems/StatusSystem';
import { ITEMS, AttackType } from '../data/items';
import { WeaponFamily, WeaponMoveset, AttackMove, getMoveset } from '../data/movesets';

export type Facing = 'down' | 'up' | 'left' | 'right';
export type CombatState = 'idle' | 'startup' | 'active' | 'recovery' | 'dodge' | 'hitstun' | 'channel';

export interface AttackResult {
  startupMs:  number;
  mv:         number;
  poiseDmg:   number;
  facing:     Facing;
  range:      number;
  arc:        number;
  pierce?:    number;      // §13 crossbow
  isHeavy:    boolean;
}

export { expForLevel };

export class Player extends Phaser.Physics.Arcade.Sprite {
  private controller: InputController;
  private facing: Facing = 'down';
  private lockedFacing: Facing | null = null;
  private slowMs = 0;

  // Keys
  private attackKey!: Phaser.Input.Keyboard.Key;
  private heavyKey!: Phaser.Input.Keyboard.Key;
  private dodgeKey!: Phaser.Input.Keyboard.Key;
  private weaponSwitchKey!: Phaser.Input.Keyboard.Key;
  private guardKey!: Phaser.Input.Keyboard.Key;
  interactKey!: Phaser.Input.Keyboard.Key;

  // Combat state machine
  combatState: CombatState = 'idle';
  private stateTimer = 0;
  private currentActiveMs: number = TUNING.light.activeMs;
  private currentRecoveryMs: number = TUNING.light.recoveryMs;
  private recoveryCanRollCancel = true;

  // Post-hit invulnerability frames
  private iframesMs = 0;

  // Dodge
  private dodgeVx = 0;
  private dodgeVy = 0;
  dodgeElapsed = 0;

  // Input buffer (ms remaining)
  private bufferAttack = 0;
  private bufferHeavy = 0;
  private bufferDodge = 0;

  // Stamina
  stamina = 100;
  maxStamina = 100;
  private staminaRegenTimer = 0;

  // Spawn protection
  spawnProtMs = 0;

  // Knockback impulse (decays each frame)
  private knockbackVx = 0;
  private knockbackVy = 0;

  // Ranged cooldown
  private rangedCooldownMs = 0;

  // Potion channel
  private onChannelComplete: (() => void) | null = null;
  private channelCancelled = false;

  // Guard (§11)
  guardActive = false;
  private perfectGuardMs = 0;
  private canBlock = false;

  // §13 — Combo state
  /** Which step of the current combo chain we're on (0-indexed). */
  comboStep = 0;
  /** How long the combo window stays open in recovery (decays to 0). */
  private comboWindowMs = 0;
  /** True when the next SPACE press should advance the combo. */
  private comboReady = false;

  // §13 — Edge / sharpness gauge (all melee families except gauntlets)
  edgeGauge = 100;  // 0–100; below TUNING.gauge.edgeBluntThresh → blunt mode

  // §13 — Flow stacks (Gauntlets family: gained on perfect dodge)
  flowStacks = 0;

  // §13 — Frenzy toggle (Twin Daggers: activated by heavy, drains stamina)
  frenzyActive = false;
  private frenzyDrainAccum = 0;

  // §13 — Greatsword charge: how long heavy key has been held
  private heavyHeldMs = 0;
  private heavyCharging = false;

  // §13 — Active moveset (updated on equip / weapon switch)
  private activeMoveset: WeaponMoveset | null = null;

  // §14 — Skills and Skill Trees
  unspentSkillPoints = 0;
  unlockedSkills: string[] = [];
  skillCooldowns: Map<string, number> = new Map();

  // §15 — Status Effects & Ailments
  activeAilments: Map<string, number> = new Map();
  ailmentBuildUp: Map<string, number> = new Map();
  ailmentGraphics!: Phaser.GameObjects.Graphics;
  stunMashes = 0;

  // Stances / Coatings / Stance states
  riposteStanceMs = 0; // Swordman active parry window duration (ms)
  activeCoating: 'none' | 'power' | 'poison' | 'paralyze' = 'none'; // Archer
  bastionModeActive = false; // Tanker
  stealthActive = false; // Assassin
  activeElement: 'fire' | 'ice' | 'lightning' = 'fire'; // Sage

  private mpRegenAccum = 0;

  // Public stats
  currentHp  = 100;
  maxHp      = 100;
  currentMp  = 30;
  maxMp      = 30;
  gold       = 0;
  exp        = 0;
  level      = 1;
  attackDmg  = 10;
  str        = 5;
  agi        = 5;
  // Derived stats (§12)
  defense      = 0;
  dodgeChancePct = 0;
  unspentStatPoints = 0;

  // §16 additions
  equippedGear: Record<string, ItemInstance | null> = {};
  weightSpeedMult = 1.0;
  weightRollMult = 2.0;
  totalWeight = 0;
  lifestealPct = 0;
  setCounts: Record<string, number> = {};

  // §17 additions
  savedStats: Stats = { hp: 100, mp: 30, str: 5, dex: 5, int: 5, vit: 5, agi: 5 };
  masochist = false;

  hasSetBonus(setName: string, count: number): boolean {
    return (this.setCounts[setName] ?? 0) >= count;
  }

  // Tracks guard state for UIScene indicator
  private _prevGuardActive = false;

  attackType: AttackType = 'melee';
  classKey: ClassId = 'swordman';

  weapon1Id: string | null = null;
  weapon2Id: string | null = null;
  activeWeaponSlot: 0 | 1 = 0;

  get currentFacing(): Facing { return this.lockedFacing ?? this.facing; }

  get isMoving(): boolean {
    const b = this.body as Phaser.Physics.Arcade.Body;
    return Math.abs(b.velocity.x) + Math.abs(b.velocity.y) > 8;
  }

  get isInvulnerable(): boolean {
    if (this.spawnProtMs > 0) return true;
    if (this.iframesMs > 0) return true;
    if (this.combatState === 'dodge') {
      return this.dodgeElapsed >= TUNING.dodge.iFrameStartMs
          && this.dodgeElapsed <= TUNING.dodge.iFrameEndMs;
    }
    return false;
  }

  get isExhausted(): boolean { return this.stamina < 1; }

  /** §13 — Active weapon family for the current weapon slot. */
  get activeFamily(): WeaponFamily | undefined {
    const activeId = this.activeWeaponSlot === 0 ? this.weapon1Id : this.weapon2Id;
    return activeId ? ITEMS[activeId]?.family : undefined;
  }

  /** §13 — True if edge gauge is in blunt territory. */
  get isBlunt(): boolean {
    const f = this.activeFamily;
    const usesEdge = f === 'sword' || f === 'greatsword' || f === 'mace' || f === 'spear';
    return usesEdge && this.edgeGauge < TUNING.gauge.edgeBluntThresh;
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player_swordman', 'idle_down_0');
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    this.controller      = new InputController(scene);
    this.attackKey       = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.heavyKey        = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.dodgeKey        = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.weaponSwitchKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.guardKey        = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.interactKey     = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    (this.body as Phaser.Physics.Arcade.Body).setSize(20, 20).setOffset(6, 24);
    if (scene.anims.exists('swordman_idle_down')) this.play('swordman_idle_down');
    this.ailmentGraphics = scene.add.graphics().setDepth(15);
  }

  // §12: full derived stats — call whenever stats or level change
  recomputeDerivedStats(stats: Stats, level: number): void {
    this.savedStats = stats;
    let addStr = 0;
    let addDex = 0;
    let addInt = 0;
    let addVit = 0;
    let addAgi = 0;
    let addHp = 0;
    let addMp = 0;
    let addDef = 0;
    let addCritChance = 0;
    let addCritDmg = 0;
    let addLifesteal = 0;
    let addMoveSpeed = 0;
    let totalWeight = 0;
    let addAtk = 0;

    this.setCounts = {};
    const setCounts = this.setCounts;


    const processGear = (item: ItemInstance | null) => {
      if (!item) return;
      const base = ITEMS[item.itemId];
      if (!base) return;

      // Broken items do not contribute stats/bonuses
      if (item.durability !== undefined && item.durability <= 0) return;

      // Handle socketed runes
      if (item.sockets) {
        for (const runeId of item.sockets) {
          if (runeId === 'rune_str') addStr += 4;
          else if (runeId === 'rune_vit') addHp += 25;
          else if (runeId === 'rune_int') addInt += 4;
          else if (runeId === 'rune_lifesteal') addLifesteal += 2;
        }
      }

      // Handle upgrade levels and branches
      const up = item.upgradeLevel ?? 0;
      const isSharp = item.branch === 'sharp';
      if (base.type === 'armor') {
        if (base.baseDefense) addDef += base.baseDefense;
        addDef += up * (isSharp ? 2 : 1);
      } else {
        // Weapon
        addAtk += up * (isSharp ? 6 : 3);
      }

      // Handle weight alterations based on branch
      let wt = base.weight ?? 0;
      if (item.branch === 'light') wt = Math.max(1, wt - 1);
      else if (item.branch === 'sharp') wt += 2;
      totalWeight += wt;

      if (base.setName) {
        setCounts[base.setName] = (setCounts[base.setName] ?? 0) + 1;
      }

      if (item.affixes) {
        for (const aff of item.affixes) {
          const val = aff.value;
          if (aff.stat === 'str') addStr += val;
          else if (aff.stat === 'dex') addDex += val;
          else if (aff.stat === 'int') addInt += val;
          else if (aff.stat === 'vit') addVit += val;
          else if (aff.stat === 'agi') addAgi += val;
          else if (aff.stat === 'hp') addHp += val;
          else if (aff.stat === 'mp') addMp += val;
          else if (aff.stat === 'defense') addDef += val;
          else if (aff.stat === 'critChance') addCritChance += val;
          else if (aff.stat === 'critDmg') addCritDmg += val;
          else if (aff.stat === 'lifesteal') addLifesteal += val;
          else if (aff.stat === 'moveSpeed') addMoveSpeed += val;
        }
      }
    };

    const slots = ['head', 'chest', 'hands', 'legs', 'boots', 'offhand', 'amulet', 'ring1', 'ring2', 'charm'];
    slots.forEach(s => processGear(this.equippedGear[s]));

    const activeWep = this.activeWeaponSlot === 0 ? this.equippedGear['mainhand'] : this.equippedGear['weapon2'];
    processGear(activeWep);

    // Apply set bonuses
    if ((setCounts['goblin'] ?? 0) >= 2) addCritChance += 10;
    if ((setCounts['goblin'] ?? 0) >= 4) addLifesteal += 5;
    if ((setCounts['captain'] ?? 0) >= 2) addDef += 15;
    if ((setCounts['plate'] ?? 0) >= 2) addHp += 25;

    const hasSage2 = (setCounts['sage'] ?? 0) >= 2;
    const hasDrowned2 = (setCounts['drowned'] ?? 0) >= 2;

    let totalStr = stats.str + addStr;
    let totalDex = stats.dex + addDex;
    let totalInt = stats.int + addInt;
    if (hasSage2) totalInt = Math.round(totalInt * 1.15);
    let totalVit = stats.vit + addVit;
    let totalAgi = stats.agi + addAgi;

    let baseHp          = 40 + totalVit * 8  + level * 6 + addHp;
    let baseMp          = 10 + totalInt * 5  + level * 2 + addMp;
    if (hasDrowned2) baseMp = Math.round(baseMp * 1.15);

    let baseStamina     = 100 + Math.floor(totalAgi * 1.5);
    let baseDef         = Math.floor(totalVit * 1.2) + addDef;

    // Apply ailments stats penalties
    if (this.activeAilments && this.activeAilments.has('burn')) {
      baseDef = Math.round(baseDef * 0.70); // Burn: -30% defense
    }
    if (this.getData('superconducting_ms') > 0) {
      baseDef = Math.round(baseDef * 0.50); // Superconduct: -50% defense
    }
    if (this.activeAilments && this.activeAilments.has('curse')) {
      baseHp = Math.round(baseHp * 0.75); // Curse: -25% Max HP
    }

    // Apply passives
    if (this.isSkillUnlocked('sword_b2_t2')) {
      baseDef += 10; // Shield Block: +10 defense
    }
    if (this.isSkillUnlocked('tank_b1_t2')) {
      baseDef += 15; // Fortress Wall: +15 defense
    }
    if (this.isSkillUnlocked('tank_b2_t3') && this.currentHp < baseHp * 0.3) {
      baseDef += 40; // Last Stand: +40 defense under 30% HP
    }
    if (this.isSkillUnlocked('sage_b3_t3')) {
      baseMp = Math.round(baseMp * 1.15); // Sage Wisdom: +15% Max MP
    }

    this.maxHp          = baseHp;
    this.maxMp          = baseMp;
    this.maxStamina     = baseStamina;
    this.defense        = baseDef;
    this.dodgeChancePct = Math.min(30, totalAgi * 0.4);
    this.str            = totalStr;
    this.agi            = totalAgi;

    // Compute attack damage: includes active weapon baseAttack if not broken
    const activeWepBase = (activeWep && (!activeWep.durability || activeWep.durability > 0)) ? ITEMS[activeWep.itemId] : null;
    const baseWepAtk = activeWepBase?.baseAttack ?? 0;
    const effStr = totalStr <= 60 ? totalStr : 60 + (totalStr - 60) * 0.6;
    const effDex = totalDex <= 60 ? totalDex : 60 + (totalDex - 60) * 0.6;
    this.attackDmg      = Math.max(6, Math.floor(effStr * 3 + effDex)) + baseWepAtk + addAtk;

    // Weight penalties
    let weightSpeedMult = 1.0;
    let weightRollMult = 2.0;
    if (totalWeight >= 15 && totalWeight <= 40) {
      weightSpeedMult = 0.92;
      weightRollMult = 1.6;
    } else if (totalWeight > 40) {
      weightSpeedMult = 0.82;
      weightRollMult = 1.25;
    }

    this.weightSpeedMult = weightSpeedMult;
    this.weightRollMult = weightRollMult;
    this.totalWeight = totalWeight;
    this.lifestealPct = addLifesteal;

    // Clamp current values to new maxima
    this.currentHp      = Math.min(this.currentHp,  this.maxHp);
    this.currentMp      = Math.min(this.currentMp,  this.maxMp);
    this.stamina        = Math.min(this.stamina,     this.maxStamina);
  }

  private computePhysAtk(stats: Stats): number {
    // Soft cap: points above 60 give 0.6× benefit
    const effStr = stats.str <= 60 ? stats.str : 60 + (stats.str - 60) * 0.6;
    const effDex = stats.dex <= 60 ? stats.dex : 60 + (stats.dex - 60) * 0.6;
    return Math.max(6, Math.floor(effStr * 3 + effDex));
  }

  loadFromSave(save: CharacterSave): void {
    this.masochist         = save.masochist ?? false;
    this.gold              = save.gold;
    this.exp               = save.exp ?? 0;
    this.level             = save.level;
    this.unspentStatPoints = save.unspentStatPoints ?? 0;
    this.unspentSkillPoints = save.unspentSkillPoints ?? 0;
    this.unlockedSkills    = save.unlockedSkills ?? [];
    this.classKey          = save.clazz;

    // Reset active skill/stance states on load
    this.skillCooldowns.clear();
    this.activeAilments.clear();
    this.ailmentBuildUp.clear();
    this.stunMashes = 0;
    if (save.curseActive) {
      this.activeAilments.set('curse', 999999);
    }
    this.riposteStanceMs = 0;
    this.activeCoating = 'none';
    this.bastionModeActive = false;
    this.stealthActive = false;
    this.activeElement = 'fire';
    this.mpRegenAccum = 0;

    // Migrate old equipped string structure if present
    this.equippedGear = {};
    if (save.equipped) {
      for (const [slot, val] of Object.entries(save.equipped)) {
        if (val) {
          if (typeof val === 'string') {
            this.equippedGear[slot] = {
              id: val,
              itemId: val,
              qty: 1,
              rarity: 'common',
              affixes: []
            };
          } else {
            this.equippedGear[slot] = val;
          }
        } else {
          this.equippedGear[slot] = null;
        }
      }
    }

    this.recomputeDerivedStats(save.stats, save.level);
    this.currentHp         = Math.min(save.currentHp, this.maxHp);
    this.currentMp         = Math.min(save.currentMp, this.maxMp);
    this.stamina           = this.maxStamina;

    const w1 = this.equippedGear['mainhand'];
    const w2 = this.equippedGear['weapon2'];
    const offhand = this.equippedGear['offhand'];

    this.weapon1Id         = w1 ? w1.itemId : null;
    this.weapon2Id         = w2 ? w2.itemId : null;
    this.activeWeaponSlot  = save.activeWeaponSlot ?? 0;
    this.attackType        = this.deriveAttackType(save);
    this.canBlock          = save.clazz === 'tanker' || (offhand ? offhand.itemId === 'round_shield' : false);
    this.setTexture(`player_${save.clazz}`, 'idle_down_0');
    this.play(`${save.clazz}_idle_down`);
    this.refreshMoveset();
  }

  decayWeaponDurability(): void {
    if (!this.masochist) return;
    const activeWep = this.activeWeaponSlot === 0 ? this.equippedGear['mainhand'] : this.equippedGear['weapon2'];
    if (!activeWep) return;
    if (activeWep.durability === undefined) {
      activeWep.durability = 100;
      activeWep.maxDurability = 100;
    }
    const prevDur = activeWep.durability;
    activeWep.durability = Math.max(0, parseFloat((activeWep.durability - 0.2).toFixed(1)));
    if (activeWep.durability <= 0 && prevDur > 0) {
      this.recomputeDerivedStats(this.savedStats, this.level);
      this.scene.game.events.emit('hud-update', this);
      if ((this.scene as any).floatText) {
        (this.scene as any).floatText('WEAPON BROKEN!', this.x, this.y - 30, '#ff4444');
      }
    }
    this.saveDurability();
  }

  decayArmorDurability(): void {
    if (!this.masochist) return;
    const slots = ['head', 'chest', 'hands', 'legs', 'boots', 'offhand', 'amulet', 'ring1', 'ring2', 'charm'];
    const equippedSlots = slots.filter(s => this.equippedGear[s] !== null && this.equippedGear[s] !== undefined);
    if (equippedSlots.length === 0) return;
    const randSlot = equippedSlots[Math.floor(Math.random() * equippedSlots.length)];
    const item = this.equippedGear[randSlot]!;
    if (item.durability === undefined) {
      item.durability = 100;
      item.maxDurability = 100;
    }
    const prevDur = item.durability;
    item.durability = Math.max(0, parseFloat((item.durability - 0.1).toFixed(1)));
    if (item.durability <= 0 && prevDur > 0) {
      this.recomputeDerivedStats(this.savedStats, this.level);
      this.scene.game.events.emit('hud-update', this);
      const slotName = randSlot.toUpperCase();
      if ((this.scene as any).floatText) {
        (this.scene as any).floatText(`${slotName} BROKEN!`, this.x, this.y - 30, '#ff4444');
      }
    }
    this.saveDurability();
  }

  private saveDurability(): void {
    const save = SaveManager.load();
    if (save) {
      save.equipped = { ...this.equippedGear };
      SaveManager.write(save);
    }
  }

  private deriveAttackType(save: CharacterSave): AttackType {
    const activeId = this.activeWeaponSlot === 0 ? this.weapon1Id : this.weapon2Id;
    if (activeId && ITEMS[activeId]?.attackType) return ITEMS[activeId].attackType!;
    return Player.classToAttackType(save.clazz);
  }

  private static classToAttackType(clazz: ClassId): AttackType {
    if (clazz === 'archer') return 'arrow';
    if (clazz === 'sage')   return 'fireball';
    return 'melee';
  }

  /** §13 — Refresh activeMoveset from the currently equipped weapon. */
  private refreshMoveset(): void {
    const family = this.activeFamily;
    this.activeMoveset = family ? getMoveset(family) : null;
    // Reset combo on weapon change
    this.comboStep = 0;
    this.comboWindowMs = 0;
    this.comboReady = false;
    this.emitGaugeEvent();
  }

  switchWeapon(): void {
    this.activeWeaponSlot = this.activeWeaponSlot === 0 ? 1 : 0;
    const activeId = this.activeWeaponSlot === 0 ? this.weapon1Id : this.weapon2Id;
    if (activeId && ITEMS[activeId]?.attackType) {
      this.attackType = ITEMS[activeId].attackType!;
    } else {
      this.attackType = Player.classToAttackType(this.classKey);
    }
    this.scene.game.events.emit('weapon-switch', {
      slot: this.activeWeaponSlot,
      weaponId: activeId,
      weaponName: activeId ? (ITEMS[activeId]?.name ?? activeId) : 'Unarmed',
    });
    this.refreshMoveset();
  }

  takeDamage(amount: number, fromX?: number, fromY?: number, element?: string): void {
    if (this.isInvulnerable) return;

    // Swordman active parry (Riposte Stance)
    if (this.classKey === 'swordman' && this.riposteStanceMs > 0) {
      this.riposteStanceMs = 0;
      this.scene.game.events.emit('parry-success', { px: this.x, py: this.y, fromX, fromY });
      return;
    }

    // Stealth break on hit
    if (this.stealthActive) {
      this.stealthActive = false;
      this.clearTint();
      this.scene.game.events.emit('stealth-break');
    }

    // Passive lucky dodge (§12 — AGI-based chance)
    if (this.dodgeChancePct > 0 && Math.random() * 100 < this.dodgeChancePct) {
      this.scene.game.events.emit('lucky-dodge', { x: this.x, y: this.y });
      this.iframesMs = 100; // brief window to prevent double-hit
      return;
    }

    let rawDmg = amount;
    
    // Wet elemental reactions damage scale
    if (element === 'fire' && this.activeAilments.has('wet')) {
      rawDmg = Math.round(rawDmg * 0.5);
    } else if (element === 'lightning' && this.activeAilments.has('wet')) {
      rawDmg = Math.round(rawDmg * 1.5);
    }

    // Tanker Bastion mode: 50% damage reduction
    if (this.classKey === 'tanker' && this.bastionModeActive) {
      rawDmg = Math.round(rawDmg * 0.5);
    }

    // Defense mitigation: D(raw, def) = raw × 100 / (100 + def)
    let dmg = Math.max(1, Math.round(rawDmg * 100 / (100 + this.defense)));

    // Sage Mana Shield: mitigate 20% of damage using MP instead of HP
    if (this.classKey === 'sage' && this.isSkillUnlocked('sage_b3_t2') && this.currentMp > 0) {
      const mpAbsorb = Math.min(this.currentMp, Math.round(dmg * 0.20));
      this.currentMp -= mpAbsorb;
      dmg -= mpAbsorb;
    }

    // §11 Guard check
    if (this.guardActive && this.canBlock) {
      if (this.perfectGuardMs > 0) {
        // Perfect guard: 0 damage + stagger attacker + small stamina refund
        this.scene.game.events.emit('perfect-guard', { px: this.x, py: this.y, fromX, fromY });
        this.stamina = Math.min(this.maxStamina, this.stamina + 10);
        // §13 Gauntlets: perfect guard also grants a Flow stack
        if (this.activeFamily === 'gauntlets') {
          this.flowStacks = Math.min(TUNING.gauge.flowMax, this.flowStacks + 1);
          this.emitGaugeEvent();
        }
        this.scene.game.events.emit('hud-update', this);
        return;
      }
      // Regular guard: 10% chip damage, stamina drain
      const chip = Math.max(1, Math.ceil(dmg * (1 - TUNING.guard.blockPct)));
      this.spendStamina(Math.max(2, Math.ceil(amount * TUNING.guard.staminaCostFactor)));
      if (this.isExhausted) {
        // Guard broken — full damage
        dmg = Math.max(1, Math.round(rawDmg * 100 / (100 + this.defense)));
        this.guardActive = false;
      } else {
        dmg = chip;
      }
    }

    this.currentHp = Math.max(0, this.currentHp - dmg);
    if (dmg > 0) {
      this.decayArmorDurability();
    }
    this.iframesMs = IFRAMES_DURATION;

    // Knockback impulse
    if (fromX !== undefined && fromY !== undefined) {
      const angle = Math.atan2(this.y - fromY, this.x - fromX);
      this.knockbackVx = Math.cos(angle) * TUNING.knockback.player;
      this.knockbackVy = Math.sin(angle) * TUNING.knockback.player;
    }

    // Interrupt — dodge and guard are untouchable
    if (this.combatState !== 'dodge' && !this.guardActive) {
      this.combatState = 'hitstun';
      this.stateTimer = 180;
      this.lockedFacing = null;
    }
    if (this.onChannelComplete) {
      this.channelCancelled = true;
      this.onChannelComplete = null;
      this.clearTint();
    }

    // §13 — Getting hit resets combo
    this.comboStep = 0;
    this.comboWindowMs = 0;
    this.comboReady = false;

    this.setTint(0xff5555);
    this.scene.time.delayedCall(200, () => { if (this.active) this.clearTint(); });
    this.scene.game.events.emit('hud-update', this);
    if (this.currentHp <= 0) this.emit('died');
  }

  heal(amount: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    this.scene.game.events.emit('hud-update', this);
  }

  onHitDealt(dmg: number): void {
    if (this.lifestealPct > 0 && this.active) {
      const healAmt = Math.max(1, Math.round(dmg * this.lifestealPct / 100));
      this.heal(healAmt);
      const t = this.scene.add.text(this.x, this.y - 20, `+${healAmt}`, { fontSize: '7px', color: '#00ff00' }).setOrigin(0.5).setDepth(8);
      this.scene.tweens.add({ targets: t, alpha: 0, y: this.y - 46, duration: 1000, onComplete: () => t.destroy() });
    }
  }

  restoreMp(amount: number): void {
    this.currentMp = Math.min(this.maxMp, this.currentMp + amount);
    this.scene.game.events.emit('hud-update', this);
  }

  addGold(amount: number): void {
    this.gold += amount;
    this.scene.game.events.emit('hud-update', this);
  }

  /** Returns true if at least one level-up occurred. */
  gainExp(amount: number): boolean {
    if (this.level >= LEVEL_CAP) return false;
    this.exp += amount;
    let leveled = false;
    while (this.level < LEVEL_CAP) {
      const needed = expForLevel(this.level);
      if (this.exp < needed) break;
      this.exp -= needed;
      this.level++;
      this.unspentStatPoints += 5;
      this.unspentSkillPoints += 1;
      leveled = true;
    }
    this.scene.game.events.emit('hud-update', this);
    return leveled;
  }

  applyNetSlow(): void {
    this.slowMs = TRAP_NET_DURATION;
    this.setTint(0x7799ff);
  }

  /**
   * §12 — Spend one unspent stat point into the given stat key.
   * Returns true if the point was spent, false if none available.
   */
  spendStatPoint(stat: keyof Stats, currentStats: Stats): boolean {
    if (this.unspentStatPoints <= 0) return false;
    (currentStats as unknown as Record<string, number>)[stat] += 1;
    this.unspentStatPoints--;
    this.recomputeDerivedStats(currentStats, this.level);
    this.scene.game.events.emit('hud-update', this);
    return true;
  }

  /** Compute attack damage: MV × physAtk × STR scale × crit, with soft cap. */
  computeAttackDamage(mv: number): { dmg: number; isCrit: boolean } {
    let critChancePct = TUNING.crit.baseChancePct + this.agi * TUNING.crit.perAgiPct;
    // Assassin passives
    if (this.classKey === 'assassin' && this.isSkillUnlocked('assa_b3_t1')) {
      critChancePct += 20; // Opportunist: +20% crit chance
    }
    if (this.classKey === 'archer' && this.isSkillUnlocked('arch_b1_t1')) {
      critChancePct += 15; // Eagle Eye: +15% crit chance
    }

    let isCrit = Math.random() * 100 < critChancePct;
    let critMult = TUNING.crit.dmgPct / 100;
    let forceCrit = false;

    if (this.classKey === 'assassin') {
      if (this.stealthActive) {
        forceCrit = true;
        // Shadow/Stealth crit mult is 2.0x
        critMult = 2.0;
        this.stealthActive = false;
        this.clearTint();
        this.scene.game.events.emit('stealth-break');
      } else if (this.isSkillUnlocked('assa_b3_t1')) {
        // Opportunist backstab crit multiplier +20%
        critMult += 0.20;
      }
    }

    if (this.classKey === 'archer' && this.isSkillUnlocked('arch_b1_t2')) {
      critMult += 0.20; // Precise Arrow: +20% crit dmg
    }

    if (forceCrit) isCrit = true;

    const effStr = this.str <= 60 ? this.str : 60 + (this.str - 60) * 0.6;
    let strScale = 1 + effStr * 0.02;

    // Apply passives
    if (this.classKey === 'swordman' && this.isSkillUnlocked('sword_b1_t1')) {
      strScale *= 1.15; // Blade Mastery: +15% melee damage
    }
    if (this.classKey === 'sage' && this.isSkillUnlocked('sage_b1_t1')) {
      strScale *= 1.15; // Element Mastery: +15% magic damage
    }

    // Archer power coating
    if (this.classKey === 'archer' && this.activeCoating === 'power') {
      strScale *= 1.20; // Power Coating: +20% damage
    }

    const baseDmg = this.attackDmg * strScale;
    let finalDmg = Math.max(1, Math.round(mv * baseDmg * (isCrit ? critMult : 1.0)));

    // Swordman combo passive
    if (this.classKey === 'swordman' && this.isSkillUnlocked('sword_b1_t2') && this.comboStep === 2) {
      finalDmg = Math.round(finalDmg * 1.20); // Blade Combo: +20% on 3rd light hit
    }

    return { dmg: finalDmg, isCrit };
  }

  // ── §13 — Edge gauge ──────────────────────────────────────────────────────

  onMeleeHitConnected(): void {
    const ms = this.activeMoveset;
    if (!ms) return;
    let decay = ms.edgeDecayPerHit ?? 0;
    if (decay <= 0) return;

    // Swordman Sharp Blade passive: 30% slower edge decay
    if (this.classKey === 'swordman' && this.isSkillUnlocked('sword_b1_t3')) {
      decay = Math.max(1, Math.round(decay * 0.70));
    }

    this.edgeGauge = Math.max(0, this.edgeGauge - decay);
    this.emitGaugeEvent();
  }

  /** §13 — Whetstone consumable: restore edge gauge to full. */
  restoreEdge(): void {
    this.edgeGauge = TUNING.gauge.edgeMax;
    this.emitGaugeEvent();
  }

  /** §13 — Gauntlets: add a Flow stack (called on perfect dodge). */
  addFlowStack(): void {
    this.flowStacks = Math.min(TUNING.gauge.flowMax, this.flowStacks + 1);
    this.emitGaugeEvent();
  }

  /** §13 — Consume all Flow stacks (§14 special will call this). */
  consumeFlow(): number {
    const stacks = this.flowStacks;
    this.flowStacks = 0;
    this.emitGaugeEvent();
    return stacks;
  }

  private emitGaugeEvent(): void {
    const family = this.activeFamily;
    this.scene.game.events.emit('weapon-gauge', {
      family,
      edge:    this.edgeGauge,
      flow:    this.flowStacks,
      frenzy:  this.frenzyActive,
      isBlunt: this.isBlunt,
    });
  }

  // ── §13 — Ammo system ─────────────────────────────────────────────────────

  consumeAmmo(inventory: { itemId: string; qty: number }[]): boolean {
    const ammoId = this.attackType === 'arrow' ? 'arrow'
                 : this.attackType === 'bolt'  ? 'bolt'
                 : null;
    if (!ammoId) return true; // non-ammo weapon — no consumption

    // Archer Resourcefulness passive: 25% chance to save ammo
    if (this.classKey === 'archer' && this.isSkillUnlocked('arch_b3_t4') && Math.random() < 0.25) {
      return true;
    }

    const stack = inventory.find(s => s.itemId === ammoId);
    if (!stack || stack.qty <= 0) {
      this.scene.game.events.emit('out-of-ammo', { ammoId });
      return false;
    }
    stack.qty--;
    return true;
  }

  // ── §13 — Moveset-aware attack polling ────────────────────────────────────

  /**
   * Poll for a light melee attack using the active weapon's combo chain.
   * Returns an AttackResult if the attack is queued, null otherwise.
   */
  pollLightAttack(): AttackResult | null {
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) this.bufferAttack = TUNING.inputBuffer;
    if (this.bufferAttack <= 0) return null;
    if (this.combatState !== 'idle') return null;
    if (this.attackType !== 'melee') return null;
    if (this.isExhausted) return null;
    if (this.guardActive) return null;

    this.bufferAttack = 0;

    // Pick attack move from combo chain
    const ms = this.activeMoveset;
    const chain = ms?.light;
    const move: AttackMove = chain
      ? chain[Math.min(this.comboStep, chain.length - 1)]
      : { mv: TUNING.light.mv, startupMs: TUNING.light.startupMs,
          activeMs: TUNING.light.activeMs, recoveryMs: TUNING.light.recoveryMs,
          poiseDmg: TUNING.light.poiseDmg, range: 44, arc: 90,
          staminaCost: TUNING.stamina.light, canRollCancel: true };

    // Frenzy mode: compress recovery for daggers
    const recovMs = this.frenzyActive
      ? Math.round(move.recoveryMs * TUNING.dagger.frenzySpeedMult)
      : move.recoveryMs;

    if (this.stamina < move.staminaCost && !this.frenzyActive) return null;
    if (!this.frenzyActive) this.spendStamina(move.staminaCost);

    this.decayWeaponDurability();

    this.currentActiveMs   = move.activeMs;
    this.currentRecoveryMs = recovMs;
    this.recoveryCanRollCancel = move.canRollCancel;
    this.lockedFacing = this.facing;
    this.combatState = 'startup';
    this.stateTimer = move.startupMs;

    // Advance combo step — will be applied after recovery
    this.comboReady = false;

    // Poise dmg blunted if edge gauge is low
    const poise = this.isBlunt
      ? Math.floor(move.poiseDmg * 0.5)
      : move.poiseDmg;

    return {
      startupMs: move.startupMs, mv: move.mv, poiseDmg: poise,
      facing: this.facing, range: move.range, arc: move.arc, isHeavy: false,
    };
  }

  /**
   * Poll for a heavy attack — family-specific behaviour:
   *  - Greatsword: hold X for charge tier
   *  - Twin Daggers: toggle Frenzy
   *  - Others: standard heavy
   */
  pollHeavyAttack(): AttackResult | null {
    const family = this.activeFamily;

    // ── Greatsword charge ────────────────────────────────────────────────────
    if (family === 'greatsword') {
      if (this.heavyKey.isDown && this.combatState === 'idle' && !this.heavyCharging) {
        this.heavyCharging = true;
        this.heavyHeldMs = 0;
        // Show charge tint
        this.setTint(0xffcc44);
      }
      if (this.heavyCharging && this.combatState === 'idle') {
        if (this.heavyKey.isDown) {
          this.heavyHeldMs += 16; // approximated per frame; delta arrives via update
          return null; // still charging
        }
        // Key released — fire based on charge level
        this.heavyCharging = false;
        this.clearTint();
        const isT2 = this.heavyHeldMs >= TUNING.greatsword.charge2Ms;
        const cost = isT2 ? TUNING.greatsword.staminaCost2 : TUNING.greatsword.staminaCost1;
        if (this.stamina < cost) return null;
        this.spendStamina(cost);

        this.decayWeaponDurability();

        const ms = this.activeMoveset!;
        const move = ms.heavy; // T2 is same heavy def but with wider arc applied by DungeonScene
        this.currentActiveMs   = move.activeMs;
        this.currentRecoveryMs = move.recoveryMs;
        this.recoveryCanRollCancel = false;
        this.lockedFacing = this.facing;
        this.combatState = 'startup';
        this.stateTimer  = isT2 ? TUNING.greatsword.charge2Ms : TUNING.greatsword.charge1Ms;
        return {
          startupMs: this.stateTimer, mv: isT2 ? 0.95 : 0.55,
          poiseDmg: isT2 ? 45 : 26, facing: this.facing,
          range: isT2 ? 64 : 58, arc: isT2 ? 140 : 90, isHeavy: true,
        };
      }
      if (!this.heavyKey.isDown) this.heavyCharging = false;
      return null;
    }

    // ── Twin Daggers: Frenzy toggle ──────────────────────────────────────────
    if (family === 'twin_daggers') {
      if (Phaser.Input.Keyboard.JustDown(this.heavyKey) && this.combatState === 'idle') {
        this.bufferHeavy = 0;
        this.frenzyActive = !this.frenzyActive;
        this.setTint(this.frenzyActive ? 0xff4444 : 0xffffff);
        if (!this.frenzyActive) this.clearTint();
        this.emitGaugeEvent();
      }
      return null; // Frenzy is a mode, not an attack
    }

    // ── Standard heavy ───────────────────────────────────────────────────────
    if (Phaser.Input.Keyboard.JustDown(this.heavyKey)) this.bufferHeavy = TUNING.inputBuffer;
    if (this.bufferHeavy <= 0) return null;
    if (this.combatState !== 'idle') return null;
    if (this.attackType !== 'melee') return null;
    if (this.stamina < TUNING.stamina.heavy) return null;
    if (this.guardActive) return null;

    this.bufferHeavy = 0;

    const ms = this.activeMoveset;
    const move: AttackMove = ms?.heavy ?? {
      mv: TUNING.heavy.mv, startupMs: TUNING.heavy.startupMs,
      activeMs: TUNING.heavy.activeMs, recoveryMs: TUNING.heavy.recoveryMs,
      poiseDmg: TUNING.heavy.poiseDmg, range: 52, arc: 100,
      staminaCost: TUNING.stamina.heavy, canRollCancel: false,
    };

    this.spendStamina(move.staminaCost);
    this.decayWeaponDurability();
    this.currentActiveMs   = move.activeMs;
    this.currentRecoveryMs = move.recoveryMs;
    this.recoveryCanRollCancel = false;
    this.lockedFacing = this.facing;
    this.combatState = 'startup';
    this.stateTimer  = move.startupMs;

    const poise = this.isBlunt ? Math.floor(move.poiseDmg * 0.5) : move.poiseDmg;
    return {
      startupMs: move.startupMs, mv: move.mv, poiseDmg: poise,
      facing: this.facing, range: move.range, arc: move.arc, isHeavy: true,
    };
  }

  pollRangedAttack(): boolean {
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) this.bufferAttack = TUNING.inputBuffer;
    if (this.bufferAttack <= 0) return false;
    if (this.attackType === 'melee') return false;
    if (this.combatState !== 'idle') return false;
    if (this.rangedCooldownMs > 0) return false;

    this.bufferAttack = 0;
    const ms = this.activeMoveset;
    this.rangedCooldownMs = ms?.rangedCooldownMs ?? 600;
    this.decayWeaponDurability();
    return true;
  }

  /** §13 — Pierce count for the current ranged weapon (crossbow only for now). */
  get rangedPierceCount(): number {
    return this.activeMoveset?.pierceCount ?? 1;
  }

  startDodge(): void {
    const inRecovery = this.combatState === 'recovery' && this.recoveryCanRollCancel;
    const canDodge = this.combatState === 'idle' || inRecovery || this.combatState === 'channel';
    if (!canDodge) return;
    if (this.stamina < TUNING.stamina.dodge) return;

    // Burn Roll-to-Extinguish
    const burnMs = this.activeAilments.get('burn') ?? 0;
    if (burnMs > 0) {
      this.activeAilments.set('burn', Math.max(0, burnMs - 1500));
    }

    if (this.combatState === 'channel') {
      this.channelCancelled = true;
      this.onChannelComplete = null;
      this.clearTint();
    }

    this.spendStamina(TUNING.stamina.dodge);

    // Swordman Quick Roll stamina refund on roll cancel
    if (inRecovery && this.isSkillUnlocked('sword_b3_t1')) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 10);
    }
    // Assassin Adrenaline Roll stamina refund
    if (this.isSkillUnlocked('assa_b3_t4')) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 10);
    }
    // Sage Cleanse roll (cleanses slow debuff instantly)
    if (this.isSkillUnlocked('sage_b3_t4')) {
      this.slowMs = 0;
      this.clearTint();
    }

    const dir = this.controller.getDirection();
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    if (len > 0) {
      this.dodgeVx = dir.x / len;
      this.dodgeVy = dir.y / len;
    } else {
      const fMap: Record<Facing, [number, number]> = {
        right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1],
      };
      [this.dodgeVx, this.dodgeVy] = fMap[this.facing];
    }

    this.combatState = 'dodge';
    this.stateTimer = TUNING.dodge.totalMs;
    this.dodgeElapsed = 0;
    this.lockedFacing = null;
    this.knockbackVx = 0;
    this.knockbackVy = 0;

    // §13 — Gauntlets: perfect-dodge grants a Flow stack
    if (this.activeFamily === 'gauntlets') {
      this.addFlowStack();
    }

    this.setTint(0xaaddff);
    this.scene.time.delayedCall(TUNING.dodge.totalMs, () => { if (this.active) this.clearTint(); });
  }

  startChannel(durationMs: number, onComplete: () => void): boolean {
    if (this.combatState !== 'idle') return false;
    this.combatState = 'channel';
    this.stateTimer = durationMs;
    this.channelCancelled = false;
    this.onChannelComplete = onComplete;
    this.setTint(0x88ff88);
    return true;
  }

  private spendStamina(amount: number): void {
    this.stamina = Math.max(0, this.stamina - amount);
    this.staminaRegenTimer = TUNING.stamina.regenDelayMs;
    this.scene.game.events.emit('hud-update', this);
  }

  update(_time: number, delta: number): void {
    // Tick timers
    this.iframesMs        = Math.max(0, this.iframesMs - delta);
    this.slowMs           = Math.max(0, this.slowMs - delta);
    this.spawnProtMs      = Math.max(0, this.spawnProtMs - delta);
    this.rangedCooldownMs = Math.max(0, this.rangedCooldownMs - delta);
    this.bufferAttack     = Math.max(0, this.bufferAttack - delta);
    this.bufferHeavy      = Math.max(0, this.bufferHeavy - delta);
    this.bufferDodge      = Math.max(0, this.bufferDodge - delta);
    this.perfectGuardMs   = Math.max(0, this.perfectGuardMs - delta);
    this.comboWindowMs    = Math.max(0, this.comboWindowMs - delta);

    // §14 active skill cooldowns tick
    for (const [id, ms] of this.skillCooldowns.entries()) {
      if (ms > 0) {
        this.skillCooldowns.set(id, Math.max(0, ms - delta));
      }
    }
    this.riposteStanceMs = Math.max(0, this.riposteStanceMs - delta);
    // Visual parry flash
    if (this.riposteStanceMs > 0 && _time % 200 < 50) {
      this.setTint(0xcc88ff);
    } else if (this.riposteStanceMs <= 0 && this.tintTopLeft === 0xcc88ff) {
      this.clearTint();
    }

    // Tick active status ailments
    StatusSystem.tickAilments(this, delta, this.scene);

    const isCcLocked = this.activeAilments.has('frozen') || this.activeAilments.has('stun');

    if (isCcLocked) {
      if (this.activeAilments.has('stun')) {
        // Stun Mashing to reduce stun time
        const left = Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT));
        const right = Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT));
        const up = Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP));
        const down = Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN));
        const space = Phaser.Input.Keyboard.JustDown(this.attackKey);
        const zKey = Phaser.Input.Keyboard.JustDown(this.dodgeKey);
        if (left || right || up || down || space || zKey) {
          const rem = this.activeAilments.get('stun') ?? 0;
          if (rem > 0) {
            this.activeAilments.set('stun', Math.max(0, rem - 150));
            this.scene.game.events.emit('hud-update', this);
          }
        }
      }

      this.riposteStanceMs = 0;
      this.frenzyActive = false;
      this.heavyCharging = false;
      this.guardActive = false;
      this.combatState = 'idle';
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.updateAnim(false);
      return;
    }

    // Sage passive MP regen
    if (this.classKey === 'sage') {
      this.mpRegenAccum = (this.mpRegenAccum ?? 0) + delta;
      const regenInterval = this.isSkillUnlocked('sage_b3_t1') ? 1667 : 2000;
      if (this.mpRegenAccum >= regenInterval) {
        this.mpRegenAccum -= regenInterval;
        this.restoreMp(1);
      }
    }

    if (this.slowMs <= 0 && this.tintTopLeft === 0x7799ff) this.clearTint();

    // §13 — Frenzy stamina drain
    if (this.frenzyActive) {
      let drainRate = TUNING.dagger.frenzyDrainPerSec;
      if (this.isSkillUnlocked('assa_b3_t2')) {
        drainRate *= 0.70; // Assassin Frenzy Mastery: -30% drain rate
      }
      this.frenzyDrainAccum += drainRate * delta / 1000;
      if (this.frenzyDrainAccum >= 1) {
        const drain = Math.floor(this.frenzyDrainAccum);
        this.frenzyDrainAccum -= drain;
        this.spendStamina(drain);
        if (this.stamina <= 0) {
          // Auto-cancel Frenzy when stamina runs out
          this.frenzyActive = false;
          this.clearTint();
          this.emitGaugeEvent();
        }
      }
    }

    // §13 — Greatsword charge: accumulate held time
    if (this.heavyCharging && this.heavyKey.isDown) {
      this.heavyHeldMs += delta;
    }

    // Stamina regeneration (after regen delay)
    if (this.staminaRegenTimer > 0) {
      this.staminaRegenTimer -= delta;
    } else if (this.stamina < this.maxStamina) {
      let regenRate = TUNING.stamina.regenPerSec;
      if (this.isSkillUnlocked('sword_b3_t2')) {
        regenRate *= 1.25; // Swordman Adrenaline: +25% regen rate
      }
      this.stamina = Math.min(this.maxStamina,
        this.stamina + regenRate * delta / 1000);
      this.scene.game.events.emit('hud-update', this);
    }

    // Guard: perfect-guard window opens on G just-pressed
    if (Phaser.Input.Keyboard.JustDown(this.guardKey) && this.canBlock && this.combatState === 'idle') {
      this.perfectGuardMs = TUNING.guard.perfectWindowMs;
    }
    this.guardActive = this.guardKey.isDown && this.canBlock && this.combatState === 'idle';

    // Emit guard state change for UI
    if (this.guardActive !== this._prevGuardActive) {
      this._prevGuardActive = this.guardActive;
      this.scene.game.events.emit('guard-update', this.guardActive);
    }

    // Weapon switch (idle, not guarding)
    if (this.combatState === 'idle' && !this.guardActive
        && Phaser.Input.Keyboard.JustDown(this.weaponSwitchKey)) {
      this.switchWeapon();
    }

    // Dodge input — buffer and attempt
    if (Phaser.Input.Keyboard.JustDown(this.dodgeKey)) this.bufferDodge = TUNING.inputBuffer;
    if (this.bufferDodge > 0) { this.startDodge(); this.bufferDodge = 0; }

    // Advance combat state timer
    this.stateTimer -= delta;
    if (this.stateTimer <= 0 && this.combatState !== 'idle') {
      this.advanceState();
    }

    if (this.combatState === 'dodge') this.dodgeElapsed += delta;

    this.updateMovement(delta);
  }

  private advanceState(): void {
    switch (this.combatState) {
      case 'startup':
        this.combatState = 'active';
        this.stateTimer = this.currentActiveMs;
        break;
      case 'active':
        this.combatState = 'recovery';
        this.stateTimer = this.currentRecoveryMs;
        // §13 — open combo window in last comboWindowPct of recovery
        this.comboWindowMs = this.currentRecoveryMs * TUNING.gauge.comboWindowPct;
        this.comboReady = true;
        break;
      case 'recovery': {
        // Did a combo input arrive during the window?
        const didCombo = this.comboReady && this.bufferAttack > 0 && this.combatState === 'recovery';
        if (didCombo) {
          const chain = this.activeMoveset?.light;
          const maxStep = chain ? chain.length - 1 : 0;
          this.comboStep = this.comboStep >= maxStep ? 0 : this.comboStep + 1;
        } else {
          this.comboStep = 0; // reset on miss
        }
        this.comboReady = false;
        this.combatState = 'idle';
        this.lockedFacing = null;
        this.stateTimer = 0;
        break;
      }
      case 'hitstun':
      case 'dodge':
        this.combatState = 'idle';
        this.lockedFacing = null;
        this.stateTimer = 0;
        break;
      case 'channel':
        if (!this.channelCancelled && this.onChannelComplete) {
          this.onChannelComplete();
        }
        this.onChannelComplete = null;
        this.channelCancelled = false;
        this.combatState = 'idle';
        this.clearTint();
        break;
    }
  }

  private updateMovement(delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.combatState === 'channel') {
      body.setVelocity(0, 0);
      this.updateAnim(false);
      return;
    }

    if (this.combatState === 'hitstun') {
      const decay = Math.pow(0.55, delta / 16.67);
      this.knockbackVx *= decay; this.knockbackVy *= decay;
      if (Math.abs(this.knockbackVx) < 1) this.knockbackVx = 0;
      if (Math.abs(this.knockbackVy) < 1) this.knockbackVy = 0;
      body.setVelocity(this.knockbackVx, this.knockbackVy);
      this.updateAnim(false);
      return;
    }

    if (this.combatState === 'dodge') {
      body.setVelocity(this.dodgeVx * PLAYER_SPEED * 2.0, this.dodgeVy * PLAYER_SPEED * 2.0);
      this.updateAnim(true);
      return;
    }

    const slowMult    = this.slowMs > 0 ? 0.38 : (this.getData('in_oil') ? 0.70 : 1.0);
    const recoverMult = this.combatState === 'recovery' ? 0.7 : 1.0;
    const exhaustMult = this.isExhausted ? 0.75 : 1.0;
    const guardMult   = this.guardActive  ? 0.50 : 1.0; // guard-walk is slower
    const bastionMult = this.classKey === 'tanker' && this.bastionModeActive ? 0.60 : 1.0;
    const stealthMult = this.classKey === 'assassin' && this.stealthActive && this.isSkillUnlocked('assa_b1_t3') ? 1.15 : 1.0;
    const chillMult   = this.activeAilments.has('chill') ? 0.70 : 1.0;
    const isRooted    = this.activeAilments.has('webbed');
    const speedMult   = slowMult * recoverMult * exhaustMult * guardMult * bastionMult * stealthMult * chillMult;

    const dir = this.controller.getDirection();
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    let vx = len > 0 ? (dir.x / len) * PLAYER_SPEED * speedMult : 0;
    let vy = len > 0 ? (dir.y / len) * PLAYER_SPEED * speedMult : 0;
    if (isRooted) { vx = 0; vy = 0; }

    if (this.getData('on_ice')) {
      const slideInertia = 0.93;
      vx = body.velocity.x * slideInertia + vx * (1 - slideInertia);
      vy = body.velocity.y * slideInertia + vy * (1 - slideInertia);
    }

    vx += this.knockbackVx; vy += this.knockbackVy;
    const kbDecay = Math.pow(0.6, delta / 16.67);
    this.knockbackVx *= kbDecay; this.knockbackVy *= kbDecay;
    if (Math.abs(this.knockbackVx) < 1) this.knockbackVx = 0;
    if (Math.abs(this.knockbackVy) < 1) this.knockbackVy = 0;

    body.setVelocity(vx, vy);

    if (len > 0 && this.lockedFacing === null) {
      if (Math.abs(dir.x) >= Math.abs(dir.y)) {
        this.facing = dir.x > 0 ? 'right' : 'left';
      } else {
        this.facing = dir.y > 0 ? 'down' : 'up';
      }
    }

    this.updateAnim(len > 0);
  }

  isSkillUnlocked(id: string): boolean {
    return this.unlockedSkills.includes(id);
  }

  isSkillCooldown(id: string): boolean {
    return (this.skillCooldowns.get(id) ?? 0) > 0;
  }

  castActiveSkill(slotKey: 'R' | 'F' | 'V'): boolean {
    if (this.activeAilments.has('frozen') || this.activeAilments.has('stun')) return false;
    if (this.combatState !== 'idle' && this.combatState !== 'recovery') return false;

    let skillId = '';
    let cdMs = 0;
    let mpCost = 0;
    let stamCost = 0;
    let name = '';

    if (slotKey === 'R') {
      // Signature active skills (always unlocked)
      if (this.classKey === 'swordman') {
        skillId = 'sword_riposte_stance'; cdMs = 6000; stamCost = 15; name = 'Riposte Stance';
      } else if (this.classKey === 'archer') {
        skillId = 'arch_coating_cycle'; cdMs = 0; mpCost = 0; name = 'Coating Swap';
      } else if (this.classKey === 'tanker') {
        skillId = 'tank_bastion_mode'; cdMs = 1500; stamCost = 0; name = 'Bastion Mode';
      } else if (this.classKey === 'assassin') {
        skillId = 'assa_vanish'; cdMs = 8000; stamCost = 20; name = 'Vanish';
      } else if (this.classKey === 'sage') {
        skillId = 'sage_element_swap'; cdMs = 0; mpCost = 0; name = 'Element Cycle';
      }
    } else if (slotKey === 'F') {
      const fMap: Record<ClassId, string> = {
        swordman: 'sword_b1_t4',
        archer: 'arch_b2_t2',
        tanker: 'tank_b2_t2',
        assassin: 'assa_b2_t2',
        sage: 'sage_b2_t2',
      };
      skillId = fMap[this.classKey];
      if (!this.isSkillUnlocked(skillId)) {
        this.scene.game.events.emit('skill-locked', { slotKey });
        return false;
      }
      if (this.classKey === 'swordman') { cdMs = 4000; stamCost = 10; name = 'Blade Thrust'; }
      else if (this.classKey === 'archer') { cdMs = 6000; mpCost = 15; name = 'Arrow Rain'; }
      else if (this.classKey === 'tanker') { cdMs = 5000; stamCost = 15; name = 'Taunt Slam'; }
      else if (this.classKey === 'assassin') { cdMs = 5000; stamCost = 10; name = 'Poison Dart'; }
      else if (this.classKey === 'sage') { cdMs = 5000; mpCost = 15; name = 'Glyph Blast'; }
    } else if (slotKey === 'V') {
      const vMap: Record<ClassId, string> = {
        swordman: 'sword_cap',
        archer: 'arch_cap',
        tanker: 'tank_cap',
        assassin: 'assa_cap',
        sage: 'sage_cap',
      };
      skillId = vMap[this.classKey];
      if (!this.isSkillUnlocked(skillId)) {
        this.scene.game.events.emit('skill-locked', { slotKey });
        return false;
      }
      if (this.classKey === 'swordman') { cdMs = 45000; stamCost = 20; name = 'Perfect Tempo'; }
      else if (this.classKey === 'archer') { cdMs = 60000; mpCost = 30; name = 'Deadeye Focus'; }
      else if (this.classKey === 'tanker') { cdMs = 80000; stamCost = 25; name = 'Immovable Bulwark'; }
      else if (this.classKey === 'assassin') { cdMs = 60000; stamCost = 30; name = 'Death Mark'; }
      else if (this.classKey === 'sage') { cdMs = 70000; mpCost = 40; name = 'Convergence'; }
    }

    if (!skillId) return false;

    // Check cooldown
    if (this.isSkillCooldown(skillId)) return false;

    // Check costs
    if (this.currentMp < mpCost) {
      this.scene.game.events.emit('out-of-mana');
      return false;
    }
    if (this.stamina < stamCost) return false;

    // Spend resource
    if (mpCost > 0) {
      this.currentMp -= mpCost;
    }
    if (stamCost > 0) {
      this.spendStamina(stamCost);
    }

    // Set cooldown
    if (cdMs > 0) {
      this.skillCooldowns.set(skillId, cdMs);
    }

    // Execute skill self-triggers/stances in Player object
    this.applySkillSelfEffects(skillId);

    // Emit event for DungeonScene VFX/combat updates
    this.scene.game.events.emit('cast-skill', { slotKey, skillId, name, cdMs });
    this.scene.game.events.emit('hud-update', this);
    return true;
  }

  private applySkillSelfEffects(skillId: string): void {
    if (skillId === 'sword_riposte_stance') {
      let duration = 1200;
      if (this.isSkillUnlocked('sword_b2_t1')) duration += 200; // extended parry window
      this.riposteStanceMs = duration;
    } else if (skillId === 'arch_coating_cycle') {
      const cycle: ('none' | 'power' | 'poison' | 'paralyze')[] = ['none', 'power', 'poison', 'paralyze'];
      const curIdx = cycle.indexOf(this.activeCoating);
      this.activeCoating = cycle[(curIdx + 1) % cycle.length];
    } else if (skillId === 'tank_bastion_mode') {
      this.bastionModeActive = !this.bastionModeActive;
      this.setTint(this.bastionModeActive ? 0x88ccff : 0xffffff);
      if (!this.bastionModeActive) this.clearTint();
    } else if (skillId === 'assa_vanish') {
      let duration = 5000;
      if (this.isSkillUnlocked('assa_b1_t1')) duration += 3000;
      this.stealthActive = true;
      this.setTint(0x555555);
      this.scene.time.delayedCall(duration, () => {
        if (this.active && this.stealthActive) {
          this.stealthActive = false;
          this.clearTint();
          this.scene.game.events.emit('stealth-break');
        }
      });
    } else if (skillId === 'sage_element_swap') {
      const cycle: ('fire' | 'ice' | 'lightning')[] = ['fire', 'ice', 'lightning'];
      const curIdx = cycle.indexOf(this.activeElement);
      this.activeElement = cycle[(curIdx + 1) % cycle.length];
    }
  }

  private updateAnim(moving: boolean): void {
    const displayFacing = this.lockedFacing ?? this.facing;
    const animDir = (displayFacing === 'left' || displayFacing === 'right') ? 'side' : displayFacing;
    const clip    = moving ? `walk_${animDir}` : `idle_${animDir}`;
    const fullKey = `${this.classKey}_${clip}`;
    if (this.anims.currentAnim?.key !== fullKey) this.play(fullKey);
    this.setFlipX(displayFacing === 'left');
  }
}
