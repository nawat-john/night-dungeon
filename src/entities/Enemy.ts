import Phaser from 'phaser';
import { ENEMY_DETECT_RANGE, ENEMY_HEAR_RANGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, TILE, TUNING } from '../config';
import { EnemyDef } from '../data/enemies';
import { Player } from './Player';
import { StatusSystem } from '../systems/StatusSystem';

type EnemyState = 'idle' | 'chase' | 'attack' | 'stagger';

const LURK_RANGE    = TILE * 3.5;
const AMBUSH_SPRINT = 2800;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly def: EnemyDef;
  private aiState: EnemyState = 'idle';
  private attackCooldown = 0;
  private idleTimer = 0;
  private idleVx = 0;
  private idleVy = 0;
  private hp: number;
  private alertTimer  = 0;
  private isLurker    = false;
  private lurking     = false;
  private ambushTimer = 0;

  // §15 — Status Effects & Ailments
  activeAilments: Map<string, number> = new Map();
  ailmentBuildUp: Map<string, number> = new Map();
  ailmentGraphics!: Phaser.GameObjects.Graphics;
  
  // Expose base defense for status DoT checks
  get defense(): number {
    return Math.floor(this.def.hp * 0.05); // simple base defense scaling
  }

  // Poise / stagger
  private poiseAccum = 0;
  private poiseWindow = 0;
  private staggerTimer = 0;
  private readonly poiseThreshold: number;

  // §11 Threat / aggro table — lightweight multi-actor foundation
  private threatMap: Map<string, number> = new Map();

  private get idleAnim(): string { return `${this.def.id}_idle`; }
  private get walkAnim(): string { return `${this.def.id}_walk`; }

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef) {
    super(scene, x, y, `enemy_${def.id}`, 0);
    this.def = def;
    this.hp  = def.hp;
    // Poise threshold scales with max HP — tankier enemies are harder to stagger
    this.poiseThreshold = Math.max(20, def.hp * 0.15);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    (this.body as Phaser.Physics.Arcade.Body).setSize(22, 22).setOffset(5, 22);
    this.play(this.idleAnim);
    this.ailmentGraphics = scene.add.graphics().setDepth(15);
  }

  setLurker(): void {
    this.isLurker = true;
    this.lurking  = true;
  }

  alert(): void {
    this.alertTimer = 8000;
    this.lurking    = false;
    this.aiState    = 'chase';
  }

  /** §11 — Threat table: accumulate threat from a source (player/companion id). */
  addThreat(sourceId: string, amount: number): void {
    const current = this.threatMap.get(sourceId) ?? 0;
    this.threatMap.set(sourceId, current + amount);
  }

  /** §11 — Force-stagger this enemy (called on perfect guard / special skills). */
  applyStagger(durationMs: number = TUNING.poise.staggerDurationMs): void {
    if (this.aiState === 'stagger') return; // already staggered
    this.poiseAccum = 0;
    this.aiState = 'stagger';
    this.staggerTimer = durationMs;
    this.setTint(0xffff44);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  /**
   * @param amount    Raw damage dealt
   * @param fromX     Attacker X position (for knockback direction)
   * @param fromY     Attacker Y position
   * @param poiseDmg  Poise damage — accumulate to stagger
   * @param element   Elemental type of the hit
   */
  takeDamage(amount: number, fromX?: number, fromY?: number, poiseDmg = 0, element?: string): void {
    let rawDmg = amount;

    // Wet elemental reactions damage scale
    if (element === 'fire' && this.activeAilments.has('wet')) {
      rawDmg = Math.round(rawDmg * 0.5);
    } else if (element === 'lightning' && this.activeAilments.has('wet')) {
      rawDmg = Math.round(rawDmg * 1.5);
    }

    this.hp -= rawDmg;
    this.lurking = false;

    // Knockback impulse (velocity is set directly; AI overrides next frame unless staggered)
    if (fromX !== undefined && fromY !== undefined) {
      const angle = Math.atan2(this.y - fromY, this.x - fromX);
      const force = TUNING.knockback.enemy;
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(
        Math.cos(angle) * force, Math.sin(angle) * force,
      );
    }

    // Poise accumulation — stagger if threshold crossed within the window
    if (poiseDmg > 0) {
      this.poiseWindow = TUNING.poise.windowMs;
      this.poiseAccum += poiseDmg;
      if (this.poiseAccum >= this.poiseThreshold) {
        this.applyStagger();
      }
    }

    if (this.aiState !== 'stagger') {
      this.setTint(0xffffff);
      this.scene.time.delayedCall(120, () => { if (this.active) this.clearTint(); });
    }

    if (this.hp <= 0) this.emit('died');
  }

  update(_time: number, delta: number, player: Player, playerIsMoving: boolean): void {
    if (!this.active) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.alertTimer     = Math.max(0, this.alertTimer     - delta);
    this.ambushTimer    = Math.max(0, this.ambushTimer    - delta);

    // Poise window decay
    if (this.poiseWindow > 0) {
      this.poiseWindow -= delta;
      if (this.poiseWindow <= 0) this.poiseAccum = 0;
    }

    // Stagger state — freeze and wait it out
    if (this.aiState === 'stagger') {
      this.staggerTimer -= delta;
      this.setVelocity(0, 0);
      this.play(this.idleAnim, true);
      if (this.staggerTimer <= 0) {
        this.aiState = 'idle';
        this.clearTint();
      }
      return;
    }

    // Tick ailments using StatusSystem
    StatusSystem.tickAilments(this, delta, this.scene);

    // CC locks (Frozen, Stunned) freeze AI entirely
    const isCcLocked = this.activeAilments.has('frozen') || this.activeAilments.has('stun');
    if (isCcLocked) {
      this.setVelocity(0, 0);
      this.play(this.idleAnim, true);
      // Status tinting
      if (this.activeAilments.has('frozen')) {
        this.setTint(0x55dfff);
      } else {
        this.setTint(0x888888);
      }
      return;
    }

    // Apply visual element color overlays
    if (this.activeAilments.has('burn')) {
      this.setTint(0xffaa44);
    } else if (this.activeAilments.has('chill')) {
      this.setTint(0x99e5ff);
    } else if (this.activeAilments.has('wet')) {
      this.setTint(0x7799ff);
    } else {
      this.clearTint();
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (this.lurking) {
      if (dist < LURK_RANGE) {
        this.lurking     = false;
        this.ambushTimer = AMBUSH_SPRINT;
        this.aiState     = 'chase';
        this.setTint(0xffffff);
        this.scene.time.delayedCall(80, () => { if (this.active) this.clearTint(); });
      } else {
        this.setVelocity(0, 0);
        this.play(this.idleAnim, true);
        return;
      }
    }

    const sightRange = this.alertTimer > 0 ? ENEMY_DETECT_RANGE * 3 : ENEMY_DETECT_RANGE;
    const hearRange  = playerIsMoving ? ENEMY_HEAR_RANGE : 0;
    const detected   = dist < Math.max(sightRange, hearRange);

    if (dist < ENEMY_ATTACK_RANGE) {
      this.aiState = 'attack';
    } else if (detected) {
      this.aiState = 'chase';
    } else {
      this.aiState = 'idle';
    }

    const slowMult  = this.activeAilments.has('chill') ? 0.70 : 1.0;
    const oilMult   = this.getData('in_oil') ? 0.70 : 1.0;
    const isRooted  = this.activeAilments.has('webbed');
    const speed     = (this.ambushTimer > 0 ? this.def.speed * 1.6 : this.def.speed) * slowMult * oilMult;

    switch (this.aiState) {
      case 'idle':
        if (isRooted) this.setVelocity(0, 0);
        else this.doIdle(delta);
        break;
      case 'chase':
        if (isRooted) {
          this.setVelocity(0, 0);
          this.play(this.idleAnim, true);
        } else {
          this.scene.physics.moveToObject(
            this as unknown as Phaser.GameObjects.GameObject,
            player as unknown as Phaser.GameObjects.GameObject,
            speed,
          );
          this.play(this.walkAnim, true);
          this.setFlipX(player.x < this.x);
        }
        break;
      case 'attack':
        this.setVelocity(0, 0);
        this.play(this.idleAnim, true);
        if (this.attackCooldown <= 0) {
          this.attackCooldown = ENEMY_ATTACK_COOLDOWN;
          let el = 'physical';
          if (this.def.id.includes('shaman')) el = 'fire';
          else if (this.def.id.includes('skeleton')) el = 'ice';
          else if (this.def.id.includes('spider')) el = 'poison';

          player.takeDamage(this.def.dmg, this.x, this.y, el);

          if (el === 'fire') {
            StatusSystem.applyBuildUp(player, 'burn', 25, this.scene, this);
          } else if (el === 'ice') {
            StatusSystem.applyBuildUp(player, 'chill', 25, this.scene, this);
          } else if (el === 'poison') {
            StatusSystem.applyBuildUp(player, 'poison', 25, this.scene, this);
          }
          if (this.def.id.includes('spider')) {
            StatusSystem.applyBuildUp(player, 'webbed', 40, this.scene, this);
          }
        }
        break;
    }
  }

  private doIdle(delta: number): void {
    this.idleTimer -= delta;
    if (this.idleTimer <= 0) {
      this.idleTimer = Phaser.Math.Between(1000, 2600);
      const angle = Math.random() * Math.PI * 2;
      const spd = this.def.speed * 0.3;
      this.idleVx = Math.cos(angle) * spd;
      this.idleVy = Math.sin(angle) * spd;
      if (Math.random() < 0.35) { this.idleVx = 0; this.idleVy = 0; }
    }
    this.setVelocity(this.idleVx, this.idleVy);
    const moving = Math.abs(this.idleVx) + Math.abs(this.idleVy) > 1;
    this.play(moving ? this.walkAnim : this.idleAnim, true);
    if (this.idleVx !== 0) this.setFlipX(this.idleVx < 0);
  }

  getDrop(): { itemId: string; qty: number } | null {
    if (!this.def.dropItem || !this.def.dropChance) return null;
    if (Math.random() > this.def.dropChance) return null;
    return { itemId: this.def.dropItem, qty: 1 };
  }

  get isPoiseDamaged(): boolean {
    return this.poiseWindow > 0;
  }
}
