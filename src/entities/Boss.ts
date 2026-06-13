import Phaser from 'phaser';
import { TILE } from '../config';
import { BossDef, BossAttackId, BossBreakPart } from '../data/bosses';
import type { ElemFamily, BodyType } from '../types';
import { Player } from './Player';
import { SaveManager } from '../systems/SaveManager';
import { AudioManager } from '../systems/AudioManager';

type BossState = 'idle' | 'chase' | 'telegraph' | 'attack' | 'recover' | 'stagger' | 'phase_transition' | 'dead';

const BOSS_DETECT_RANGE = TILE * 12;
const BOSS_ATTACK_RANGE = 80;
const BOSS_MELEE_RANGE  = 72;
const BOSS_IDLE_MS      = 1000;
const BOSS_STAGGER_MS   = 1200;
const BOSS_PHASE_MS     = 1500;
const CHARGE_SPEED_MULT = 4.5;
const CHARGE_MS         = 650;
const AOE_RADIUS        = 72;
const AOE_DELAY_MS      = 1200;

const TELEGRAPH_DUR: Record<BossAttackId, number> = {
  melee: 800, heavy: 1200, charge: 900, aoe_zone: 700,
  projectile: 800, multi_proj: 900, summon: 1300, grab: 700, phase_slam: 1600,
};
const RECOVER_DUR: Record<BossAttackId, number> = {
  melee: 700, heavy: 1100, charge: 700, aoe_zone: 600,
  projectile: 600, multi_proj: 700, summon: 800, grab: 700, phase_slam: 1000,
};

export class Boss extends Phaser.Physics.Arcade.Sprite {
  readonly def: BossDef;
  private hp: number;
  readonly maxHp: number;
  private totalDmgTaken = 0;
  private phaseIdx = 0;
  private enraged = false;

  private breakStatus: { broken: boolean }[];
  private disabledAttacks = new Set<BossAttackId>();

  private bossState: BossState = 'idle';
  private stateTimer = 0;
  private idleTimer = BOSS_IDLE_MS;
  private flashTimer = 0;

  private currentAttack: BossAttackId | null = null;
  private atkTargetX = 0;
  private atkTargetY = 0;
  private chargeVx = 0;
  private chargeVy = 0;
  private chargeTimer = 0;

  private aoeZone: Phaser.GameObjects.Arc | null = null;
  private aoeTimer = 0;
  private aoeTx = 0;
  private aoeTy = 0;

  private auraRing: Phaser.GameObjects.Arc;
  private auraPhase = 0;
  private projectiles: Phaser.Physics.Arcade.Image[] = [];

  // §E10.1 Riftmaw void cycle
  private voidCycleTimer = 0;
  private voidPhaseActive = false; // true = void; false = neutral

  // §E10.2 Phases that have been skipped via break
  private skippedPhases = new Set<number>();

  get isDead(): boolean { return this.bossState === 'dead'; }

  constructor(scene: Phaser.Scene, x: number, y: number, def: BossDef) {
    const texKey = scene.textures.exists('boss_' + def.id) ? 'boss_' + def.id : 'boss_placeholder';
    super(scene, x, y, texKey, 0);
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.breakStatus = def.breakParts.map(() => ({ broken: false }));
    // §E10.1 Initialize void cycle timer
    if (def.voidCycleMs) this.voidCycleTimer = def.voidCycleMs;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    this.setScale(1.6).setDepth(6);
    (this.body as Phaser.Physics.Arcade.Body).setSize(28, 28).setOffset(2, 20);

    this.auraRing = scene.add.arc(x, y, 26, 0, 360, false, 0x000000, 0)
      .setStrokeStyle(3, 0xffcc00).setDepth(5);

    this.on('destroy', () => {
      this.auraRing.destroy();
      this.aoeZone?.destroy();
      this.projectiles.forEach(p => { if (p.active) p.destroy(); });
    });

    this.emitUpdate();
  }

  private get phase() { return this.def.phases[this.phaseIdx]; }

  /** Current phase-aware element family (overrides def.elemFamily when phase specifies it). */
  get currentPhaseElemFamily(): ElemFamily | undefined {
    if (this.def.id === 'riftmaw') {
      return this.voidPhaseActive ? 'void' : 'beast';
    }
    return this.phase.phaseElemFamily ?? this.def.elemFamily;
  }

  /** Current phase-aware body type. */
  get currentPhaseBody(): BodyType | undefined {
    return this.phase.phaseBody ?? this.def.body;
  }

  // ── Public interface ──────────────────────────────────────────────────────

  takeDamage(amount: number, fromX?: number, fromY?: number): void {
    if (this.bossState === 'dead') return;
    void fromX; void fromY;
    this.hp = Math.max(0, this.hp - amount);
    this.totalDmgTaken += amount;

    // Part breaks
    for (let i = 0; i < this.def.breakParts.length; i++) {
      if (!this.breakStatus[i].broken && this.totalDmgTaken >= this.def.breakParts[i].hp) {
        this.doBreakPart(i);
      }
    }

    // Phase transition
    this.checkPhase();

    // Enrage
    if (this.def.enrage && !this.enraged && this.hp / this.maxHp < this.def.enrage.atHpPct) {
      this.enraged = true;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.onDied();
    } else {
      this.emitUpdate();
    }
  }

  applyStagger(ms: number): void {
    if (this.bossState === 'dead') return;
    this.cancelActive();
    this.bossState = 'stagger';
    this.stateTimer = ms;
    this.setTint(0xffff44);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
  }

  // ── Main update ───────────────────────────────────────────────────────────

  update(time: number, delta: number, player: Player, spawnMinion: (x: number, y: number) => void): void {
    void time;
    if (this.bossState === 'dead') return;

    // §E10.1 Riftmaw void cycle
    if (this.def.voidCycleMs) {
      this.voidCycleTimer -= delta;
      if (this.voidCycleTimer <= 0) {
        this.voidPhaseActive = !this.voidPhaseActive;
        this.voidCycleTimer = this.def.voidCycleMs;
        const label = this.voidPhaseActive ? '⬛ VOID' : '⬜ NEUTRAL';
        this.scene.game.events.emit('boss-void-cycle', { label, bossId: this.def.id });
        this.emitUpdate();
      }
    }

    // Aura pulse
    this.auraPhase += delta * 0.003;
    const pulse = 0.5 + 0.5 * Math.sin(this.auraPhase);
    const auraColor = this.enraged ? 0xff4400 : 0xffcc00;
    this.auraRing.setPosition(this.x, this.y).setStrokeStyle(3 + pulse * 2, auraColor).setAlpha(0.4 + pulse * 0.5);

    // Telegraph flash
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      this.setTint(Math.floor(this.flashTimer / 80) % 2 === 0 ? 0xff6600 : 0xffffff);
    } else if (this.bossState !== 'stagger' && this.bossState !== 'phase_transition') {
      this.clearTint();
    }

    this.tickProjectiles(delta, player);

    switch (this.bossState) {
      case 'idle':             this.tickIdle(delta, player); break;
      case 'chase':            this.tickChase(delta, player); break;
      case 'telegraph':        this.tickTelegraph(delta, player, spawnMinion); break;
      case 'attack':           this.tickAttack(delta, player, spawnMinion); break;
      case 'recover':          this.tickRecover(delta); break;
      case 'stagger':          this.tickStagger(delta); break;
      case 'phase_transition': this.tickPhaseTransition(delta, player); break;
    }
  }

  // ── State ticks ───────────────────────────────────────────────────────────

  private tickIdle(delta: number, player: Player): void {
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    this.idleTimer -= delta;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist < BOSS_DETECT_RANGE && this.idleTimer <= 0) {
      if (dist < BOSS_ATTACK_RANGE) this.beginAttack(player);
      else this.bossState = 'chase';
    }
  }

  private tickChase(delta: number, player: Player): void {
    void delta;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist < BOSS_ATTACK_RANGE) { this.beginAttack(player); return; }
    const spd = this.effectiveSpeed;
    const dx = player.x - this.x, dy = player.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(dx / len * spd, dy / len * spd);
  }

  private tickTelegraph(delta: number, player: Player, spawnMinion: (x: number, y: number) => void): void {
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    this.stateTimer -= delta;
    if (this.currentAttack === 'charge' || this.currentAttack === 'grab') {
      this.atkTargetX = player.x;
      this.atkTargetY = player.y;
    }
    if (this.stateTimer <= 0) this.executeAttack(player, spawnMinion);
  }

  private tickAttack(delta: number, player: Player, spawnMinion: (x: number, y: number) => void): void {
    void spawnMinion;
    switch (this.currentAttack) {
      case 'charge': this.tickCharge(delta, player); break;
      case 'aoe_zone': this.tickAoe(delta, player); break;
      case 'grab': this.tickGrab(delta, player); break;
      default:
        this.stateTimer -= delta;
        if (this.stateTimer <= 0) this.enterRecover();
    }
  }

  private tickRecover(delta: number): void {
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    this.stateTimer -= delta;
    if (this.stateTimer <= 0) {
      this.idleTimer = BOSS_IDLE_MS + Math.random() * 800;
      this.bossState = 'idle';
    }
  }

  private tickStagger(delta: number): void {
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    this.stateTimer -= delta;
    if (this.stateTimer <= 0) { this.clearTint(); this.idleTimer = 500; this.bossState = 'idle'; }
  }

  private tickPhaseTransition(delta: number, player: Player): void {
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    this.stateTimer -= delta;
    this.setTint(Math.floor(this.stateTimer / 100) % 2 === 0 ? 0xff8800 : 0xffffff);
    if (this.stateTimer <= 0) {
      this.clearTint();
      // Auto phase-slam after transition
      this.currentAttack = 'phase_slam';
      this.bossState = 'telegraph';
      this.stateTimer = 1000;
      this.flashTimer = 1000;
      AudioManager.playSFX('telegraph', 0.55);
      this.doMeleeHit(player, 1.0); // preemptive warning hit (usually miss)
    }
  }

  // ── Attack selection & execution ──────────────────────────────────────────

  private beginAttack(player: Player): void {
    const ascTier = SaveManager.getAscensionTier();
    let pool = [...this.phase.attackPool].filter(a => !this.disabledAttacks.has(a));
    if (ascTier > 0 && pool.length > 0) {
      if (!pool.includes('multi_proj') && !this.disabledAttacks.has('multi_proj')) {
        pool.push('multi_proj');
      }
      if (!pool.includes('aoe_zone') && !this.disabledAttacks.has('aoe_zone')) {
        pool.push('aoe_zone');
      }
    }
    if (pool.length === 0) return;
    this.currentAttack = pool[Math.floor(Math.random() * pool.length)];
    this.atkTargetX = player.x;
    this.atkTargetY = player.y;
    this.bossState = 'telegraph';
    this.stateTimer = TELEGRAPH_DUR[this.currentAttack];
    this.flashTimer = this.stateTimer;
    AudioManager.playSFX('telegraph', 0.55);
  }

  private executeAttack(player: Player, spawnMinion: (x: number, y: number) => void): void {
    this.flashTimer = 0;
    this.clearTint();
    this.bossState = 'attack';

    switch (this.currentAttack) {
      case 'melee':
        this.doMeleeHit(player, 1.0);
        this.stateTimer = 150;
        break;
      case 'heavy':
        this.doMeleeHit(player, 1.8);
        this.stateTimer = 200;
        break;
      case 'charge':
        this.startCharge();
        break;
      case 'aoe_zone':
        this.startAoe(player);
        break;
      case 'projectile':
        this.fireProjectiles(player, 1);
        this.stateTimer = 150;
        break;
      case 'multi_proj':
        this.fireProjectiles(player, 3);
        this.stateTimer = 200;
        break;
      case 'summon':
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
          const a = Math.random() * Math.PI * 2;
          spawnMinion(this.x + Math.cos(a) * TILE * 3, this.y + Math.sin(a) * TILE * 3);
        }
        this.stateTimer = 200;
        break;
      case 'grab':
        this.startGrab();
        break;
      case 'phase_slam':
        this.doPhaseSlamAoe(player);
        this.stateTimer = 500;
        break;
    }
  }

  // ── Specific attack logic ─────────────────────────────────────────────────

  private doMeleeHit(player: Player, mult: number): void {
    if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < BOSS_MELEE_RANGE) {
      const dmg = Math.round(this.effectiveDmg * mult);
      player.takeDamage(dmg, this.x, this.y);
      const dx = player.x - this.x, dy = player.y - this.y;
      const len = Math.hypot(dx, dy) || 1;
      (player.body as Phaser.Physics.Arcade.Body).setVelocity(dx / len * 360, dy / len * 360);
      this.scene.time.delayedCall(220, () => { if (player.active) (player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0); });
    }
  }

  private startCharge(): void {
    const dx = this.atkTargetX - this.x, dy = this.atkTargetY - this.y;
    const spd = this.effectiveSpeed * CHARGE_SPEED_MULT;
    const len = Math.hypot(dx, dy) || 1;
    this.chargeVx = dx / len * spd;
    this.chargeVy = dy / len * spd;
    this.chargeTimer = CHARGE_MS;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.chargeVx, this.chargeVy);
  }

  private tickCharge(delta: number, player: Player): void {
    this.chargeTimer -= delta;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.chargeVx, this.chargeVy);

    if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 40) {
      const dmg = Math.round(this.effectiveDmg * 1.4);
      player.takeDamage(dmg, this.x, this.y);
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
      this.enterRecover();
      return;
    }
    if (this.chargeTimer <= 0) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
      this.enterRecover();
    }
  }

  private startAoe(player: Player): void {
    this.aoeTx = player.x; this.aoeTy = player.y;
    this.aoeTimer = AOE_DELAY_MS;
    this.aoeZone = this.scene.add.arc(this.aoeTx, this.aoeTy, AOE_RADIUS, 0, 360, false, 0xff4400, 0)
      .setStrokeStyle(2, 0xff8800).setDepth(5).setAlpha(0.5);
    this.scene.tweens.add({ targets: this.aoeZone, alpha: { from: 0.3, to: 0.7 }, duration: 280, yoyo: true, repeat: -1 });
  }

  private tickAoe(delta: number, player: Player): void {
    this.aoeTimer -= delta;
    if (this.aoeTimer <= 0) {
      this.aoeZone?.destroy(); this.aoeZone = null;
      if (Phaser.Math.Distance.Between(this.aoeTx, this.aoeTy, player.x, player.y) < AOE_RADIUS) {
        player.takeDamage(Math.round(this.effectiveDmg * 0.9), this.aoeTx, this.aoeTy);
      }
      const burst = this.scene.add.arc(this.aoeTx, this.aoeTy, 10, 0, 360, false, 0xff4400, 0.8).setDepth(5);
      this.scene.tweens.add({ targets: burst, scaleX: AOE_RADIUS / 5, scaleY: AOE_RADIUS / 5, alpha: 0, duration: 320, onComplete: () => burst.destroy() });
      this.scene.cameras.main.shake(120, 0.010);
      this.enterRecover();
    }
  }

  private startGrab(): void {
    const dx = this.atkTargetX - this.x, dy = this.atkTargetY - this.y;
    const spd = this.effectiveSpeed * 3.5;
    const len = Math.hypot(dx, dy) || 1;
    this.chargeVx = dx / len * spd;
    this.chargeVy = dy / len * spd;
    this.chargeTimer = 320;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.chargeVx, this.chargeVy);
  }

  private tickGrab(delta: number, player: Player): void {
    this.chargeTimer -= delta;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(this.chargeVx, this.chargeVy);

    const hit = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 50;
    if (hit || this.chargeTimer <= 0) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
      if (hit) {
        player.takeDamage(Math.round(this.effectiveDmg * 2.0), this.x, this.y);
        const dx = player.x - this.x, dy = player.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        (player.body as Phaser.Physics.Arcade.Body).setVelocity(dx / len * 620, dy / len * 620);
        this.scene.time.delayedCall(300, () => { if (player.active) (player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0); });
      }
      this.enterRecover();
    }
  }

  private doPhaseSlamAoe(player: Player): void {
    const r = 100;
    const burst = this.scene.add.arc(this.x, this.y, 10, 0, 360, false, 0xff8800, 0.7).setDepth(5);
    this.scene.tweens.add({ targets: burst, scaleX: r / 5, scaleY: r / 5, alpha: 0, duration: 400, onComplete: () => burst.destroy() });
    this.scene.cameras.main.shake(260, 0.020);
    if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < r) {
      player.takeDamage(Math.round(this.effectiveDmg * 1.2), this.x, this.y);
    }
  }

  private fireProjectiles(player: Player, count: number): void {
    const base = Math.atan2(player.y - this.y, player.x - this.x);
    const spread = Math.PI / 7;
    for (let i = 0; i < count; i++) {
      const angle = base + (i - Math.floor(count / 2)) * spread;
      const proj = this.scene.physics.add.image(this.x, this.y, 'proj_boss')
        .setDepth(7).setScale(1.4);
      (proj.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(angle) * 180, Math.sin(angle) * 180);
      this.projectiles.push(proj);
      this.scene.time.delayedCall(3000, () => { if (proj.active) proj.destroy(); });
    }
  }

  private tickProjectiles(delta: number, player: Player): void {
    void delta;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.active) { this.projectiles.splice(i, 1); continue; }
      if (Phaser.Math.Distance.Between(p.x, p.y, player.x, player.y) < 20) {
        player.takeDamage(Math.round(this.effectiveDmg * 0.7), p.x, p.y);
        p.destroy(); this.projectiles.splice(i, 1);
      }
    }
  }

  // ── Part breaks & phase transitions ───────────────────────────────────────

  private doBreakPart(idx: number): void {
    this.breakStatus[idx].broken = true;
    const part = this.def.breakParts[idx];
    if (part.disablesAttack) this.disabledAttacks.add(part.disablesAttack);
    // §E10.2 Check if this break skips a phase
    if (part.breakSkipsPhase !== undefined) {
      this.skippedPhases.add(part.breakSkipsPhase);
      this.emit('phase-skipped', part.breakSkipsPhase);
    }
    this.applyStagger(BOSS_STAGGER_MS);
    this.emit('part-broken', part);
    this.emitUpdate();
  }

  private checkPhase(): void {
    if (this.bossState === 'dead' || this.bossState === 'phase_transition') return;
    const next = this.phaseIdx + 1;
    if (next >= this.def.phases.length) return;
    if (this.hp / this.maxHp < this.def.phases[next].hpPct) {
      // Skip phases that were suppressed by a break
      if (this.skippedPhases.has(next)) {
        this.phaseIdx = next; // advance index but don't trigger transition
        this.emitUpdate();
        this.checkPhase(); // check for further phase thresholds
        return;
      }
      this.phaseIdx = next;
      this.cancelActive();
      this.bossState = 'phase_transition';
      this.stateTimer = BOSS_PHASE_MS;
      this.scene.cameras.main.shake(300, 0.018);
      this.emitUpdate();
    }
  }

  private cancelActive(): void {
    this.aoeZone?.destroy(); this.aoeZone = null;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
  }

  private enterRecover(): void {
    this.cancelActive();
    this.bossState = 'recover';
    this.stateTimer = RECOVER_DUR[this.currentAttack!] ?? 700;
    this.currentAttack = null;
  }

  private onDied(): void {
    this.bossState = 'dead';
    this.cancelActive();
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    this.setVisible(false).setActive(false);
    this.auraRing.setVisible(false);
    this.scene.game.events.emit('boss-update', { visible: false, name: '', hp: 0, maxHp: 1, phaseIdx: 0, phaseCount: 1, parts: [] });
    this.emit('died');
  }

  // ── Computed properties ───────────────────────────────────────────────────

  private get effectiveSpeed(): number {
    let s = this.def.speed;
    if (this.enraged && this.def.enrage) s *= this.def.enrage.speedMult;
    s *= this.phase.speedMult ?? 1.0;
    return s;
  }

  private get effectiveDmg(): number {
    let d = this.def.dmg;
    if (this.enraged && this.def.enrage) d = Math.round(d * this.def.enrage.dmgMult);
    return d;
  }

  private emitUpdate(): void {
    this.scene.game.events.emit('boss-update', {
      name: this.def.name,
      bossId: this.def.id,
      hp: this.hp,
      maxHp: this.maxHp,
      phaseIdx: this.phaseIdx,
      phaseCount: this.def.phases.length,
      phaseElemFamily: this.currentPhaseElemFamily,
      parts: this.def.breakParts.map((p, i) => ({
        id: p.id,
        name: (p as BossBreakPart).name,
        broken: this.breakStatus[i].broken,
      })),
      visible: true,
    });
  }

  get currentAiState(): BossState { return this.bossState; }
}
