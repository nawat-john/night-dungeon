import Phaser from 'phaser';
import { TILE } from '../config';
import { CompanionDef, CompanionCommand, COMPANION_COMMANDS } from '../data/companions';
import { Player } from './Player';
import { Enemy } from './Enemy';

const FOLLOW_DIST   = TILE * 2.2;
const ATTACK_COOLDOWN_MS = 900;
const ENEMY_DMG_RADIUS   = 28;    // enemies this close auto-damage companion

export class Companion extends Phaser.Physics.Arcade.Sprite {
  readonly def: CompanionDef;

  private compHp: number;
  readonly maxCompHp: number;
  potions: number;
  fatigue: number;
  affinity: number;
  command: CompanionCommand;

  private aiState: 'follow' | 'chase' | 'attack' | 'hold' | 'regroup' | 'heal' = 'follow';
  private attackCooldown = 0;
  private targetEnemy: Phaser.Physics.Arcade.Sprite | null = null;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBar!:   Phaser.GameObjects.Rectangle;
  private nameLabel!: Phaser.GameObjects.Text;
  private fatigueLabel!: Phaser.GameObjects.Text;

  get currentHp(): number  { return this.compHp; }
  get isDead():    boolean  { return this.compHp <= 0; }

  constructor(
    scene: Phaser.Scene, x: number, y: number,
    def: CompanionDef,
    currentHp: number, potions: number, fatigue: number,
    affinity: number, command: CompanionCommand,
  ) {
    super(scene, x, y, `companion_${def.id}`, 0);
    this.def        = def;
    this.compHp     = currentHp;
    this.maxCompHp  = def.hp;
    this.potions    = potions;
    this.fatigue    = fatigue;
    this.affinity   = affinity;
    this.command    = command;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    (this.body as Phaser.Physics.Arcade.Body).setSize(20, 22).setOffset(6, 22);
    this.setDepth(4);

    // Play idle animation
    if (scene.anims.exists(`${def.id}_idle`)) this.play(`${def.id}_idle`);

    // HP bar above sprite
    this.hpBarBg   = scene.add.rectangle(x, y - 22, 28, 3, 0x330000).setDepth(5);
    this.hpBar     = scene.add.rectangle(x, y - 22, 28, 3, 0x44cc44).setDepth(5);
    this.nameLabel = scene.add.text(x, y - 30, def.name, { fontSize: '5px', color: '#aaffaa' })
      .setOrigin(0.5).setDepth(5);
    this.fatigueLabel = scene.add.text(x, y - 38, '', { fontSize: '5px', color: '#ffaa44' })
      .setOrigin(0.5).setDepth(5);

    this.on('destroy', () => {
      this.hpBarBg.destroy();
      this.hpBar.destroy();
      this.nameLabel.destroy();
      this.fatigueLabel.destroy();
    });
  }

  takeDamage(amount: number): void {
    this.compHp = Math.max(0, this.compHp - amount);
    if (this.compHp <= 0) this.emit('companion-died', this);
  }

  heal(amount: number): void {
    this.compHp = Math.min(this.maxCompHp, this.compHp + amount);
  }

  cycleCommand(): void {
    const idx = COMPANION_COMMANDS.indexOf(this.command);
    this.command = COMPANION_COMMANDS[(idx + 1) % COMPANION_COMMANDS.length];
    this.scene.game.events.emit('companion-command', { name: this.def.name, command: this.command });
  }

  update(time: number, delta: number, enemies: Phaser.Physics.Arcade.Group, player: Player): void {
    if (this.isDead) { this.setActive(false).setVisible(false); return; }

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    // Auto-heal when critically low
    if (this.compHp < this.maxCompHp * this.def.healThreshold && this.potions > 0 && this.aiState !== 'heal') {
      this.potions--;
      this.heal(Math.round(this.maxCompHp * 0.4));
      this.aiState = 'heal';
      this.scene.time.delayedCall(800, () => { if (!this.isDead) this.aiState = 'follow'; });
    }

    // Take incidental enemy melee damage
    for (const child of enemies.getChildren()) {
      const e = child as unknown as Enemy;
      if (!e.active) continue;
      if (Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) < ENEMY_DMG_RADIUS) {
        if (Math.random() < delta / 1000) this.takeDamage(Math.round(e.def.dmg * 0.4));
      }
    }

    // Affinity slowly increases over time
    this.affinity = Math.min(100, this.affinity + delta / 60000);

    // Fatigue accumulates slowly
    this.fatigue = Math.min(100, this.fatigue + delta / 120000);

    const body = this.body as Phaser.Physics.Arcade.Body;

    // Command-mode AI
    switch (this.command) {
      case 'hold':
        body.setVelocity(0, 0);
        this.attackNearestInRange(enemies, this.def.attackRange);
        break;
      case 'regroup':
        this.moveToward(player.x, player.y, this.def.speed * 1.3);
        break;
      default:
        this.runCombatAI(delta, enemies, player);
        break;
    }

    // Update HUD elements
    this.hpBarBg.setPosition(this.x, this.y - 22);
    this.hpBar.setPosition(this.x - 14 + 14 * (this.compHp / this.maxCompHp), this.y - 22)
      .setDisplaySize(28 * (this.compHp / this.maxCompHp), 3);
    this.nameLabel.setPosition(this.x, this.y - 30);
    this.fatigueLabel
      .setText(this.fatigue >= 80 ? 'TIRED' : '')
      .setPosition(this.x, this.y - 38);
  }

  private runCombatAI(delta: number, enemies: Phaser.Physics.Arcade.Group, player: Player): void {
    const detectRange = this.command === 'aggressive' ? this.def.detectRange * 1.4
                      : this.command === 'defensive'  ? this.def.detectRange * 0.5
                      : this.def.detectRange;

    // Validate / find target
    if (!this.targetEnemy || !(this.targetEnemy as unknown as Enemy).active) {
      this.targetEnemy = this.findNearestEnemy(enemies, detectRange, player);
      if (!this.targetEnemy) {
        this.aiState = 'follow';
      }
    }

    if (this.aiState === 'follow' || !this.targetEnemy) {
      const dx = player.x - this.x, dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > FOLLOW_DIST) {
        this.moveToward(player.x, player.y, this.def.speed);
      } else {
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
      if (this.targetEnemy) this.aiState = 'chase';
      return;
    }

    const te = this.targetEnemy;
    const distToEnemy = Phaser.Math.Distance.Between(this.x, this.y, te.x, te.y);

    if (distToEnemy <= this.def.attackRange) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.aiState = 'attack';
      if (this.attackCooldown <= 0) {
        (te as unknown as Enemy).takeDamage(this.def.dmg, this.x, this.y, 0);
        this.attackCooldown = ATTACK_COOLDOWN_MS;
      }
    } else {
      this.aiState = 'chase';
      this.moveToward(te.x, te.y, this.def.speed);
    }

    void delta;
  }

  private moveToward(tx: number, ty: number, speed: number): void {
    const angle = Math.atan2(ty - this.y, tx - this.x);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
    );
    this.setFlipX(tx < this.x);
  }

  private findNearestEnemy(
    enemies: Phaser.Physics.Arcade.Group,
    range: number,
    player: Player,
  ): Phaser.Physics.Arcade.Sprite | null {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bestDist = range;
    const cx = this.command === 'defensive' ? player.x : this.x;
    const cy = this.command === 'defensive' ? player.y : this.y;
    for (const child of enemies.getChildren()) {
      const e = child as unknown as Enemy;
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(cx, cy, e.x, e.y);
      if (d < bestDist) { bestDist = d; best = e as unknown as Phaser.Physics.Arcade.Sprite; }
    }
    return best;
  }

  private attackNearestInRange(enemies: Phaser.Physics.Arcade.Group, range: number): void {
    if (this.attackCooldown > 0) return;
    for (const child of enemies.getChildren()) {
      const e = child as unknown as Enemy;
      if (!e.active) continue;
      if (Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y) < range) {
        (e as unknown as Enemy).takeDamage(this.def.dmg, this.x, this.y, 0);
        this.attackCooldown = ATTACK_COOLDOWN_MS;
        break;
      }
    }
  }

  toSaveData(): import('../types').CompanionSaveData {
    return {
      id: this.def.id, name: this.def.name, role: this.def.role,
      currentHp: this.compHp, maxHp: this.maxCompHp,
      potions: this.potions, fatigue: this.fatigue,
      affinity: Math.round(this.affinity), command: this.command,
    };
  }
}
