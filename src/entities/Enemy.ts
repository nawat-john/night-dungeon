import Phaser from 'phaser';
import { ENEMY_DETECT_RANGE, ENEMY_HEAR_RANGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, TILE } from '../config';
import { EnemyDef } from '../data/enemies';
import { Player } from './Player';

type EnemyState = 'idle' | 'chase' | 'attack';

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

  private get idleAnim(): string { return `${this.def.id}_idle`; }
  private get walkAnim(): string { return `${this.def.id}_walk`; }

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef) {
    super(scene, x, y, `enemy_${def.id}`, 0);
    this.def = def;
    this.hp  = def.hp;
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    (this.body as Phaser.Physics.Arcade.Body).setSize(22, 22).setOffset(5, 22);
    this.play(this.idleAnim);
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

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.lurking = false;
    this.setTint(0xffffff);
    this.scene.time.delayedCall(120, () => { if (this.active) this.clearTint(); });
    if (this.hp <= 0) this.emit('died');
  }

  update(_time: number, delta: number, player: Player, playerIsMoving: boolean): void {
    if (!this.active) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.alertTimer     = Math.max(0, this.alertTimer     - delta);
    this.ambushTimer    = Math.max(0, this.ambushTimer    - delta);

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

    const speed = this.ambushTimer > 0 ? this.def.speed * 1.6 : this.def.speed;

    switch (this.aiState) {
      case 'idle':
        this.doIdle(delta);
        break;
      case 'chase':
        this.scene.physics.moveToObject(
          this as unknown as Phaser.GameObjects.GameObject,
          player as unknown as Phaser.GameObjects.GameObject,
          speed,
        );
        this.play(this.walkAnim, true);
        this.setFlipX(player.x < this.x);
        break;
      case 'attack':
        this.setVelocity(0, 0);
        this.play(this.idleAnim, true);
        if (this.attackCooldown <= 0) {
          this.attackCooldown = ENEMY_ATTACK_COOLDOWN;
          player.takeDamage(this.def.dmg);
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

  /** Returns item drop or null. Replaces gold drops. */
  getDrop(): { itemId: string; qty: number } | null {
    if (!this.def.dropItem || !this.def.dropChance) return null;
    if (Math.random() > this.def.dropChance) return null;
    return { itemId: this.def.dropItem, qty: 1 };
  }
}
