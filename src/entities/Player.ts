import Phaser from 'phaser';
import { PLAYER_SPEED, ATTACK_COOLDOWN, IFRAMES_DURATION, TRAP_NET_DURATION, expForLevel } from '../config';
import { InputController } from '../systems/InputController';
import { CharacterSave, ClassId } from '../types';
import { ITEMS, AttackType } from '../data/items';

export type Facing = 'down' | 'up' | 'left' | 'right';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private controller: InputController;
  private facing: Facing = 'down';
  private attackCooldownMs = 0;
  private iframesMs = 0;
  private slowMs = 0;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private weaponSwitchKey!: Phaser.Input.Keyboard.Key;
  private classKey: ClassId = 'swordman';

  interactKey!: Phaser.Input.Keyboard.Key;
  currentHp  = 100;
  maxHp      = 100;
  currentMp  = 30;
  maxMp      = 30;
  gold       = 0;
  exp        = 0;
  level      = 1;
  attackDmg  = 10;
  attackType: AttackType = 'melee';

  weapon1Id: string | null = null;
  weapon2Id: string | null = null;
  activeWeaponSlot: 0 | 1 = 0;

  get currentFacing(): Facing { return this.facing; }
  get isMoving(): boolean {
    const b = this.body as Phaser.Physics.Arcade.Body;
    return Math.abs(b.velocity.x) + Math.abs(b.velocity.y) > 8;
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player_swordman', 'idle_down_0');
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    this.controller      = new InputController(scene);
    this.attackKey       = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.weaponSwitchKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.interactKey     = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    (this.body as Phaser.Physics.Arcade.Body).setSize(20, 20).setOffset(6, 24);
    if (scene.anims.exists('swordman_idle_down')) this.play('swordman_idle_down');
  }

  loadFromSave(save: CharacterSave): void {
    this.currentHp       = save.currentHp;
    this.maxHp           = save.stats.hp;
    this.currentMp       = save.currentMp;
    this.maxMp           = save.stats.mp;
    this.gold            = save.gold;
    this.exp             = save.exp ?? 0;
    this.level           = save.level;
    this.attackDmg       = Math.max(6, save.stats.str * 3 + save.stats.dex);
    this.classKey        = save.clazz;
    this.weapon1Id       = save.equipped['mainhand'] ?? null;
    this.weapon2Id       = save.equipped['weapon2'] ?? null;
    this.activeWeaponSlot = save.activeWeaponSlot ?? 0;
    this.attackType      = this.deriveAttackType(save);
    this.setTexture(`player_${save.clazz}`, 'idle_down_0');
    this.play(`${save.clazz}_idle_down`);
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
  }

  takeDamage(amount: number): void {
    if (this.iframesMs > 0) return;
    this.currentHp = Math.max(0, this.currentHp - amount);
    this.iframesMs = IFRAMES_DURATION;
    this.setTint(0xff5555);
    this.scene.time.delayedCall(200, () => { if (this.active) this.clearTint(); });
    this.scene.game.events.emit('hud-update', this);
    if (this.currentHp <= 0) this.emit('died');
  }

  heal(amount: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    this.scene.game.events.emit('hud-update', this);
  }

  restoreMp(amount: number): void {
    this.currentMp = Math.min(this.maxMp, this.currentMp + amount);
    this.scene.game.events.emit('hud-update', this);
  }

  addGold(amount: number): void {
    this.gold += amount;
    this.scene.game.events.emit('hud-update', this);
  }

  gainExp(amount: number): void {
    this.exp += amount;
    this.scene.game.events.emit('hud-update', this);
  }

  applyNetSlow(): void {
    this.slowMs = TRAP_NET_DURATION;
    this.setTint(0x7799ff);
  }

  pollAttack(): boolean {
    if (this.attackCooldownMs > 0) return false;
    if (!Phaser.Input.Keyboard.JustDown(this.attackKey)) return false;
    this.attackCooldownMs = ATTACK_COOLDOWN;
    return true;
  }

  update(_time: number, delta: number): void {
    this.iframesMs        = Math.max(0, this.iframesMs - delta);
    this.attackCooldownMs = Math.max(0, this.attackCooldownMs - delta);
    this.slowMs           = Math.max(0, this.slowMs - delta);
    if (this.slowMs <= 0 && this.tintTopLeft === 0x7799ff) this.clearTint();

    if (Phaser.Input.Keyboard.JustDown(this.weaponSwitchKey)) this.switchWeapon();

    const speedMult = this.slowMs > 0 ? 0.38 : 1.0;
    const dir = this.controller.getDirection();
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    const vx = len > 0 ? (dir.x / len) * PLAYER_SPEED * speedMult : 0;
    const vy = len > 0 ? (dir.y / len) * PLAYER_SPEED * speedMult : 0;
    this.setVelocity(vx, vy);

    const moving = len > 0;
    if (moving) {
      if (Math.abs(dir.x) >= Math.abs(dir.y)) {
        this.facing = dir.x > 0 ? 'right' : 'left';
      } else {
        this.facing = dir.y > 0 ? 'down' : 'up';
      }
    }

    const animDir = (this.facing === 'left' || this.facing === 'right') ? 'side' : this.facing;
    const clip    = moving ? `walk_${animDir}` : `idle_${animDir}`;
    const fullKey = `${this.classKey}_${clip}`;
    if (this.anims.currentAnim?.key !== fullKey) this.play(fullKey);
    this.setFlipX(this.facing === 'left');
  }
}
