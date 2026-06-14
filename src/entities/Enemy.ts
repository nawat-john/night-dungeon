import Phaser from 'phaser';
import { ENEMY_DETECT_RANGE, ENEMY_HEAR_RANGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, TILE, TUNING } from '../config';
import { EnemyDef, EliteAffix, EliteConfig, AFFIX_AURA_COLOR } from '../data/enemies';
import { Player } from './Player';
import { StatusSystem } from '../systems/StatusSystem';
import { AudioManager } from '../systems/AudioManager';

type EnemyState = 'idle' | 'chase' | 'telegraph' | 'attack' | 'retreat' | 'charge' | 'cast' | 'support_cast' | 'stagger' | 'leash' | 'feint_pause';

const LURK_RANGE    = TILE * 3.5;
const AMBUSH_SPRINT = 2800;
const LEASH_RANGE   = TILE * 28;   // flee this far → give up and go home
const TELEGRAPH_MS  = 620;         // windup duration for all archetypes
const BRUTE_TELEGRAPH_MS = 900;    // brutes wind up longer
const RETREAT_MS    = 1300;        // skirmisher backs off duration
const CHARGE_SPEED  = 3.2;         // charger dash speed multiplier
const CHARGE_MS     = 380;         // charger dash duration
const CAST_CHANNEL_MS = 900;       // caster AoE resolves after this
const CAST_ZONE_RADIUS = 46;       // AoE radius in pixels
const SUPPORT_HEAL_INTERVAL = 3200;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly def: EnemyDef;
  private aiState: EnemyState = 'idle';
  private attackCooldown = 0;
  private idleTimer = 0;
  private idleVx = 0;
  private idleVy = 0;
  private hp: number;
  private maxHp: number;
  private alertTimer  = 0;
  private isLurker    = false;
  private lurking     = false;
  private ambushTimer = 0;

  // §P11 — Enemy feinting behavior
  private isFeint = false;
  private feintTimeThreshold = 0;
  private isFeintRealAttack = false;
  private feintPauseTimer = 0;
  private shadeSkillTimer = 3000;

  // Leash — return home when player flees far
  private homeX: number;
  private homeY: number;

  // Telegraph windup
  private telegraphMs = 0;
  private telegraphFlash = 0;

  // Retreat (skirmisher)
  private retreatTimer = 0;
  private retreatVx = 0;
  private retreatVy = 0;

  // Charge (charger)
  private chargeVx = 0;
  private chargeVy = 0;
  private chargeTimer = 0;

  // Caster AoE
  private castZone: Phaser.GameObjects.Arc | null = null;
  private castTimer = 0;
  private castTargetX = 0;
  private castTargetY = 0;

  // Support heal timer
  private supportTimer = SUPPORT_HEAL_INTERVAL;

  // Elite / Champion
  private eliteAffixes: EliteAffix[] = [];
  isChampion = false;
  protected eliteBaseTint = 0xffffff; // sprite tint that persists between hit flashes
  private eliteAura: Phaser.GameObjects.Arc | null = null;
  private champHpBar: Phaser.GameObjects.Graphics | null = null;
  // Champion break point: triggers at 50% HP, once
  private breakTriggered = false;
  private shieldHp = 0; // "shielded" affix absorbs this much before real damage
  // P10 — unstable_core cycling weakness
  private _unstableCoreTimer = 0;
  private _unstableCorePhase = 0;
  private static readonly UNSTABLE_ELEMENTS = ['fire', 'ice', 'lightning', 'poison', 'void', 'radiant'] as const;

  // §15 — Status Effects & Ailments
  activeAilments: Map<string, number> = new Map();
  ailmentBuildUp: Map<string, number> = new Map();
  ailmentGraphics!: Phaser.GameObjects.Graphics;

  get defense(): number { return Math.floor(this.maxHp * 0.05); }

  // Poise / stagger
  private poiseAccum = 0;
  private poiseWindow = 0;
  private staggerTimer = 0;
  private readonly poiseThreshold: number;

  // §11 Threat / aggro table
  private threatMap: Map<string, number> = new Map();

  private get idleAnim(): string { return `${this.def.id}_idle`; }
  private get walkAnim(): string { return `${this.def.id}_walk`; }

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef) {
    super(scene, x, y, `enemy_${def.id}`, 0);
    this.def  = def;
    this.hp   = def.hp;
    this.maxHp = def.hp;
    this.homeX = x;
    this.homeY = y;

    // Brutes have higher poise threshold — harder to stagger
    const poiseMult = def.archetype === 'brute' ? 0.25 : 0.15;
    this.poiseThreshold = Math.max(20, def.hp * poiseMult);

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);
    (this.body as Phaser.Physics.Arcade.Body).setSize(22, 22).setOffset(5, 22);
    this.play(this.idleAnim);
    this.ailmentGraphics = scene.add.graphics().setDepth(15);

    this.on('destroy', () => {
      this.eliteAura?.destroy();
      this.champHpBar?.destroy();
      this.castZone?.destroy();
      this.ailmentGraphics?.destroy();
    });
  }

  // ── Elite / Champion setup ─────────────────────────────────────────────────

  applyElite(config: EliteConfig): void {
    this.eliteAffixes = config.affixes;
    this.isChampion   = config.isChampion;
    this.hp    = Math.round(this.def.hp * config.hpMult);
    this.maxHp = this.hp;

    if (this.eliteAffixes.includes('shielded')) {
      this.shieldHp = Math.round(this.hp * 0.30);
    }

    // Pick first affix color for aura; champions use gold
    const auraColor = config.isChampion
      ? 0xffd700
      : AFFIX_AURA_COLOR[config.affixes[0]];

    // Persistent sprite tint: champions are gold, elites get a subtle hue shift
    this.eliteBaseTint = config.isChampion ? 0xffe860 : Enemy.auraToSpriteTint(auraColor);
    this.setTint(this.eliteBaseTint);

    this.eliteAura = this.scene.add.circle(this.x, this.y, 18, auraColor, 0)
      .setStrokeStyle(config.isChampion ? 2.5 : 1.5, auraColor)
      .setDepth(3);

    this.scene.tweens.add({
      targets: this.eliteAura,
      alpha: { from: 0.55, to: 0.18 },
      duration: config.isChampion ? 400 : 600,
      yoyo: true, repeat: -1,
    });

    if (config.isChampion) {
      this.champHpBar = this.scene.add.graphics().setDepth(20);
      this.setScale(1.25);
    }
  }

  /** Map a full-brightness aura color to a subtle sprite tint (blended toward white). */
  private static auraToSpriteTint(color: number): number {
    const r = ((color >> 16) & 0xff);
    const g = ((color >>  8) & 0xff);
    const b = (color & 0xff);
    // Lerp 60% toward white so the sprite stays readable but has a clear hue
    const lerp = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.60));
    return (lerp(r) << 16) | (lerp(g) << 8) | lerp(b);
  }

  hasAffix(affix: EliteAffix): boolean { return this.eliteAffixes.includes(affix); }

  /** Current cycling weakness element for unstable_core affix; null if not applicable. */
  get unstableCoreElement(): string | null {
    if (!this.hasAffix('unstable_core')) return null;
    return Enemy.UNSTABLE_ELEMENTS[this._unstableCorePhase % Enemy.UNSTABLE_ELEMENTS.length];
  }

  /** bloodgorged: absorbs bleed tick and heals instead. Returns true if absorbed. */
  absorbBleeding(dmg: number): boolean {
    if (!this.hasAffix('bloodgorged')) return false;
    this.hp = Math.min(this.maxHp, this.hp + dmg);
    return true;
  }

  private restoreBaseTint(): void {
    if (this.eliteBaseTint !== 0xffffff) this.setTint(this.eliteBaseTint);
    else this.clearTint();
  }

  // ── Lurker / alert ────────────────────────────────────────────────────────

  setLurker(): void { this.isLurker = true; this.lurking = true; }

  alert(): void {
    this.alertTimer = 8000;
    this.lurking    = false;
    this.aiState    = 'chase';
  }

  addThreat(sourceId: string, amount: number): void {
    const current = this.threatMap.get(sourceId) ?? 0;
    this.threatMap.set(sourceId, current + amount);
  }

  applyStagger(durationMs: number = TUNING.poise.staggerDurationMs): void {
    if (this.aiState === 'stagger') return;
    this.cancelCastZone();
    this.poiseAccum  = 0;
    this.aiState     = 'stagger';
    this.staggerTimer = durationMs;
    this.setTint(0xffff44);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  lastHitElement?: string;
  lastHitWasStatusTick = false;

  takeDamage(amount: number, fromX?: number, fromY?: number, poiseDmg = 0, element?: string): void {
    this.lastHitElement = element;
    this.lastHitWasStatusTick = fromX === undefined;
    let rawDmg = amount;

    // Back-hit bonus: 15% extra damage when attacker is behind the enemy
    if (fromX !== undefined && fromY !== undefined) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const vx = body.velocity.x, vy = body.velocity.y;
      const vlen = Math.sqrt(vx * vx + vy * vy);
      if (vlen > 8) {
        // Direction from attacker to enemy
        const adx = this.x - fromX, ady = this.y - fromY;
        const alen = Math.sqrt(adx * adx + ady * ady);
        if (alen > 0) {
          const dot = (vx / vlen) * (adx / alen) + (vy / vlen) * (ady / alen);
          if (dot < -0.5) rawDmg = Math.round(rawDmg * 1.15);
        }
      }
    }

    // Elemental reactions
    if (element === 'fire' && this.activeAilments.has('wet'))      rawDmg = Math.round(rawDmg * 0.5);
    else if (element === 'lightning' && this.activeAilments.has('wet')) rawDmg = Math.round(rawDmg * 1.5);

    // Armored affix: 30% DR
    if (this.hasAffix('armored')) rawDmg = Math.round(rawDmg * 0.70);

    // Shielded affix: absorbs into shield pool first
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, rawDmg);
      this.shieldHp -= absorbed;
      rawDmg -= absorbed;
      if (rawDmg <= 0) return; // fully blocked
    }

    this.hp -= rawDmg;
    this.lurking = false;

    // Flinch flash for poise hits that don't stagger (visual feedback)
    if (poiseDmg > 0 && this.aiState !== 'stagger') {
      this.setTint(0xffaa00);
      this.scene.time.delayedCall(80, () => { if (this.active && this.aiState !== 'stagger') this.restoreBaseTint(); });
    }

    // Knockback
    if (fromX !== undefined && fromY !== undefined) {
      const angle = Math.atan2(this.y - fromY, this.x - fromX);
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(
        Math.cos(angle) * TUNING.knockback.enemy,
        Math.sin(angle) * TUNING.knockback.enemy,
      );
    }

    // Poise accumulation
    if (poiseDmg > 0) {
      this.poiseWindow = TUNING.poise.windowMs;
      this.poiseAccum += poiseDmg;
      if (this.poiseAccum >= this.poiseThreshold) this.applyStagger();
    }

    if (this.aiState !== 'stagger') {
      this.setTint(0xffffff);
      this.scene.time.delayedCall(120, () => { if (this.active && this.aiState !== 'stagger') this.restoreBaseTint(); });
    }

    // Vampiric affix: healer restores 8% of damage dealt back
    // (handled externally via getVampiricHeal)

    // Champion break point: first time HP drops below 50%
    if (this.isChampion && !this.breakTriggered && this.hp <= this.maxHp * 0.50) {
      this.breakTriggered = true;
      this.applyStagger(1200);
      this.scene.game.events.emit('champion-break', { x: this.x, y: this.y });
    }

    if (this.hp <= 0) this.emit('died');
  }

  /** §E15 — Directly restore HP (absorb mechanic: elemental attack heals the enemy). */
  healDirect(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.setTint(0x00ff88);
    this.scene.time.delayedCall(120, () => { if (this.active) this.restoreBaseTint(); });
  }

  /** How much HP to restore to attacker (vampiric affix). */
  getVampiricHeal(dmgDealt: number): number {
    if (!this.hasAffix('vampiric')) return 0;
    return Math.max(1, Math.round(dmgDealt * 0.08));
  }

  /** True if this enemy has the volatile affix (explodes on death). */
  get isVolatile(): boolean { return this.hasAffix('volatile'); }

  get hpPct(): number { return this.maxHp > 0 ? this.hp / this.maxHp : 0; }
  get maxHpValue(): number { return this.maxHp; }

  // ── Main update ───────────────────────────────────────────────────────────

  update(_time: number, delta: number, player: Player, playerIsMoving: boolean, allies: Enemy[] = []): void {
    if (!this.active) return;

    if (this.def.id === 'anom_mirror_shade') {
      this.shadeSkillTimer -= delta;
      if (this.shadeSkillTimer <= 0) {
        this.shadeSkillTimer = 3000 + Math.random() * 2000;
        this.castShadeMirrorSkill(player);
      }
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.alertTimer     = Math.max(0, this.alertTimer     - delta);
    this.ambushTimer    = Math.max(0, this.ambushTimer    - delta);
    this.telegraphMs    = Math.max(0, this.telegraphMs    - delta);

    // Sync elite aura position
    if (this.eliteAura?.active) this.eliteAura.setPosition(this.x, this.y);

    // Draw champion HP bar
    if (this.isChampion && this.champHpBar) this.drawChampHpBar();

    // Poise window decay
    if (this.poiseWindow > 0) {
      this.poiseWindow -= delta;
      if (this.poiseWindow <= 0) this.poiseAccum = 0;
    }

    // Stagger — freeze and wait
    if (this.aiState === 'stagger') {
      this.staggerTimer -= delta;
      this.setVelocity(0, 0);
      this.play(this.idleAnim, true);
      if (this.staggerTimer <= 0) { this.aiState = 'idle'; this.restoreBaseTint(); }
      return;
    }

    StatusSystem.tickAilments(this, delta, this.scene);

    // CC lock
    const isCcLocked = this.activeAilments.has('frozen') || this.activeAilments.has('stun');
    if (isCcLocked) {
      this.setVelocity(0, 0);
      this.play(this.idleAnim, true);
      this.setTint(this.activeAilments.has('frozen') ? 0x55dfff : 0x888888);
      return;
    }

    // Ailment visual tint (lower priority than CC)
    if (!this.hasAffix('shielded') || this.shieldHp <= 0) {
      if (this.activeAilments.has('burn'))        this.setTint(0xffaa44);
      else if (this.activeAilments.has('chill'))  this.setTint(0x99e5ff);
      else if (this.activeAilments.has('wet'))    this.setTint(0x7799ff);
      else if (this.shieldHp > 0)                 this.setTint(0xddddff);
      else                                        this.restoreBaseTint();
    }

    // P10 — unstable_core: cycle weakness element every 5000ms
    if (this.hasAffix('unstable_core')) {
      this._unstableCoreTimer += delta;
      if (this._unstableCoreTimer >= 5000) {
        this._unstableCoreTimer -= 5000;
        this._unstableCorePhase = (this._unstableCorePhase + 1) % Enemy.UNSTABLE_ELEMENTS.length;
      }
    }

    // Hasted aura: buff nearby allies every tick
    if (this.hasAffix('hasted_aura')) {
      for (const ally of allies) {
        if (ally === this || !ally.active) continue;
        if (Phaser.Math.Distance.Between(this.x, this.y, ally.x, ally.y) < TILE * 6) {
          ally.setData('hasted', true);
        }
      }
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    // ── Lurker ──────────────────────────────────────────────────────────────
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

    // Alert on detection (transition to chase)
    if (detected && this.aiState === 'idle') {
      this.aiState = 'chase';
      this.alertTimer = Math.max(this.alertTimer, 4000);
    }

    // Leash check — give up if player flees too far while alert
    if (this.alertTimer > 0 && dist > LEASH_RANGE && this.aiState !== 'leash') {
      this.aiState    = 'leash';
      this.alertTimer = 0;
    }

    // Oil / chill speed modifiers
    const slowMult = (this.activeAilments.has('chill') ? 0.70 : 1.0)
                   * (this.getData('in_oil') ? 0.70 : 1.0)
                   * (this.getData('hasted') ? 1.40 : 1.0);
    this.setData('hasted', false); // reset each frame; hasted_aura re-sets it

    const baseSpeed = (this.ambushTimer > 0 ? this.def.speed * 1.6 : this.def.speed) * slowMult;
    const isRooted  = this.activeAilments.has('webbed');

    switch (this.aiState) {
      case 'idle':
        if (isRooted) this.setVelocity(0, 0);
        else this.doIdle(delta);
        break;

      case 'chase':
        this.doChase(player, dist, baseSpeed, isRooted, delta);
        break;

      case 'telegraph':
        this.doTelegraph(player, delta);
        break;

      case 'attack':
        this.doMeleeAttack(player);
        break;

      case 'retreat':
        this.doRetreat(player, baseSpeed, delta, isRooted);
        break;

      case 'charge':
        this.doCharge(player, delta);
        break;

      case 'cast':
        this.doCast(player, delta);
        break;

      case 'support_cast':
        this.doSupportCast(allies, delta);
        break;

      case 'leash':
        this.doLeash(baseSpeed, isRooted);
        break;

      case 'feint_pause':
        this.doFeintPause(player, delta);
        break;
    }
  }

  // ── AI behaviour implementations ──────────────────────────────────────────

  private doChase(player: Player, dist: number, speed: number, isRooted: boolean, delta: number): void {
    const arch = this.def.archetype;
    const rangeMin = this.def.rangeMin ?? 0;
    const attackRange = ENEMY_ATTACK_RANGE + (arch === 'brute' ? 8 : 0);

    if (isRooted) {
      this.setVelocity(0, 0);
      this.play(this.idleAnim, true);
      return;
    }

    // Decide when to stop chasing and initiate action
    if (arch === 'ranged' || arch === 'caster') {
      if (dist <= (rangeMin || 90) + 20) {
        // In firing range — telegraph then attack
        this.enterTelegraph(arch === 'caster' ? CAST_CHANNEL_MS : TELEGRAPH_MS);
        return;
      }
      // Too close — keep distance
      if (dist < (rangeMin || 90) - 10) {
        this.aiState = 'retreat';
        this.retreatTimer = RETREAT_MS * 0.5;
        this.setRetreatDir(player);
        return;
      }
    } else if (arch === 'charger') {
      const chargeRange = TILE * 3.5;
      if (dist < chargeRange && this.attackCooldown <= 0) {
        this.enterTelegraph(TELEGRAPH_MS);
        return;
      }
    } else if (arch === 'support') {
      if (this.supportTimer <= 0) {
        this.aiState = 'support_cast';
        return;
      }
      this.supportTimer -= delta;
      // Support doesn't chase the player, it wanders
      this.doIdle(delta);
      return;
    } else if (dist < attackRange && this.attackCooldown <= 0) {
      this.enterTelegraph(arch === 'brute' ? BRUTE_TELEGRAPH_MS : TELEGRAPH_MS);
      return;
    }

    // Move toward player (or away from player for ranged if too close)
    this.scene.physics.moveToObject(
      this as unknown as Phaser.GameObjects.GameObject,
      player as unknown as Phaser.GameObjects.GameObject,
      speed,
    );
    this.play(this.walkAnim, true);
    this.setFlipX(player.x < this.x);
  }

  private enterTelegraph(durationMs: number): void {
    this.aiState     = 'telegraph';
    this.telegraphMs = durationMs;
    this.telegraphFlash = 0;
    this.setVelocity(0, 0);
    this.play(this.idleAnim, true);

    // Roll for feint if canFeint is true and not the immediate follow-up
    if (this.def.canFeint && !this.isFeintRealAttack && Math.random() < 0.30) {
      this.isFeint = true;
      this.feintTimeThreshold = durationMs * 0.40; // 60% elapsed = 40% remaining
    } else {
      this.isFeint = false;
    }
    this.isFeintRealAttack = false;

    const arch = this.def.archetype;
    let pitch = 1.0;
    if (arch === 'brute') pitch = 0.7;
    else if (arch === 'caster' || arch === 'ranged' || arch === 'support') pitch = 1.35;
    else if (arch === 'swarm') pitch = 1.6;
    AudioManager.playSFX('telegraph', pitch);
  }

  private doTelegraph(player: Player, _delta: number): void {
    // Pulse orange to warn player
    const flash = Math.floor(_delta) % 200 < 100;
    if (flash) this.setTint(0xff8800);
    else       this.clearTint();

    if (this.isFeint && this.telegraphMs <= this.feintTimeThreshold) {
      this.clearTint();
      this.setTint(0xffffff); // flash white
      this.scene.time.delayedCall(150, () => { if (this.active) this.restoreBaseTint(); });
      this.aiState = 'feint_pause';
      this.feintPauseTimer = 400; // 400ms pause
      this.isFeint = false;
      return;
    }

    if (this.telegraphMs <= 0) {
      this.clearTint();
      this.executeArchetypeAttack(player);
    }
  }

  private doFeintPause(player: Player, delta: number): void {
    this.setVelocity(0, 0);
    this.play(this.idleAnim, true);
    this.feintPauseTimer -= delta;
    if (this.feintPauseTimer <= 0) {
      this.isFeintRealAttack = true;
      const arch = this.def.archetype;
      this.enterTelegraph(arch === 'caster' ? CAST_CHANNEL_MS : (arch === 'brute' ? BRUTE_TELEGRAPH_MS : TELEGRAPH_MS));
    }
  }

  private executeArchetypeAttack(player: Player): void {
    const arch = this.def.archetype;
    if (arch === 'charger') {
      // Launch charge dash
      this.aiState = 'charge';
      this.chargeTimer = CHARGE_MS;
      const angle = Math.atan2(player.y - this.y, player.x - this.x);
      const spd = this.def.speed * CHARGE_SPEED;
      this.chargeVx = Math.cos(angle) * spd;
      this.chargeVy = Math.sin(angle) * spd;
    } else if (arch === 'ranged') {
      this.aiState = 'idle';
      this.attackCooldown = ENEMY_ATTACK_COOLDOWN * 1.3;
      this.fireProjectile(player);
    } else if (arch === 'caster') {
      // Place cast zone at player position
      this.aiState = 'cast';
      this.castTimer = CAST_CHANNEL_MS;
      this.castTargetX = player.x;
      this.castTargetY = player.y;
      this.spawnCastZone();
    } else {
      // Melee archetypes: go to attack state
      this.aiState = 'attack';
    }
  }

  private doMeleeAttack(player: Player): void {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const reach = ENEMY_ATTACK_RANGE + (this.def.archetype === 'brute' ? 12 : 0);

    if (dist > reach * 1.6) {
      // Target moved away — chase again
      this.aiState = 'chase';
      return;
    }

    this.setVelocity(0, 0);
    this.play(this.idleAnim, true);

    if (this.attackCooldown <= 0) {
      this.attackCooldown = ENEMY_ATTACK_COOLDOWN + (this.def.archetype === 'brute' ? 400 : 0);
      this.dealMeleeDamage(player, this.def.dmg);

      // Skirmisher retreats after hit
      if (this.def.archetype === 'skirmisher') {
        this.aiState = 'retreat';
        this.retreatTimer = RETREAT_MS;
        this.setRetreatDir(player);
      }
    }
  }

  private dealMeleeDamage(player: Player, dmg: number): void {
    const el = this.def.element ?? 'physical';
    player.takeDamage(dmg, this.x, this.y, el);
    this.applyStatusOnHit(player);

    // Vampiric: heal self for 8% of damage
    if (this.hasAffix('vampiric')) {
      this.hp = Math.min(this.maxHp, this.hp + Math.max(1, Math.round(dmg * 0.08)));
    }
  }

  private applyStatusOnHit(player: Player): void {
    const el = this.def.element;
    if (el === 'fire')      StatusSystem.applyBuildUp(player, 'burn',    28, this.scene, this);
    else if (el === 'ice')  StatusSystem.applyBuildUp(player, 'chill',   28, this.scene, this);
    else if (el === 'poison') StatusSystem.applyBuildUp(player, 'poison', 28, this.scene, this);
    else if (el === 'lightning' || this.hasAffix('stormtouched'))
                            StatusSystem.applyBuildUp(player, 'shock',   28, this.scene, this);
    if (this.hasAffix('toxic')) StatusSystem.applyBuildUp(player, 'poison', 20, this.scene, this);
    if (this.def.id.includes('spider')) StatusSystem.applyBuildUp(player, 'webbed', 40, this.scene, this);
  }

  private setRetreatDir(player: Player): void {
    const angle = Math.atan2(this.y - player.y, this.x - player.x);
    this.retreatVx = Math.cos(angle);
    this.retreatVy = Math.sin(angle);
  }

  private doRetreat(player: Player, speed: number, delta: number, isRooted: boolean): void {
    this.retreatTimer -= delta;
    if (this.retreatTimer <= 0 || isRooted) {
      this.aiState = 'chase';
      return;
    }
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    // Stop retreating if already far enough
    if (dist > (this.def.rangeMin ?? 90) * 1.5) {
      this.aiState = 'idle';
      return;
    }
    this.setVelocity(this.retreatVx * speed, this.retreatVy * speed);
    this.play(this.walkAnim, true);
    this.setFlipX(this.retreatVx < 0);
  }

  private doCharge(player: Player, delta: number): void {
    this.chargeTimer -= delta;
    if (this.chargeTimer <= 0) {
      this.aiState = 'idle';
      this.attackCooldown = ENEMY_ATTACK_COOLDOWN * 1.8;
      this.setVelocity(0, 0);
      return;
    }
    this.setVelocity(this.chargeVx, this.chargeVy);
    this.play(this.walkAnim, true);

    // Hit player if close during dash
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist < 28 && this.attackCooldown <= 0) {
      this.attackCooldown = ENEMY_ATTACK_COOLDOWN * 1.8;
      // Charger deals 1.5× damage on dash hit
      this.dealMeleeDamage(player, Math.round(this.def.dmg * 1.5));
    }
  }

  private spawnCastZone(): void {
    const color = this.def.element === 'fire' ? 0xff4400
                : this.def.element === 'ice'  ? 0x44aaff
                : this.def.element === 'lightning' ? 0xffee00
                : 0xcc44ff;

    this.castZone = this.scene.add.circle(this.castTargetX, this.castTargetY, CAST_ZONE_RADIUS, color, 0.22)
      .setStrokeStyle(1.5, color, 0.8)
      .setDepth(2);

    this.scene.tweens.add({
      targets: this.castZone,
      alpha: { from: 0.22, to: 0.38 },
      duration: 350,
      yoyo: true, repeat: -1,
    });
  }

  private cancelCastZone(): void {
    if (this.castZone?.active) {
      this.castZone.destroy();
      this.castZone = null;
    }
  }

  private doCast(player: Player, delta: number): void {
    this.castTimer -= delta;
    this.setVelocity(0, 0);

    if (this.castTimer <= 0) {
      this.cancelCastZone();
      // Deal AoE damage in the zone
      const dist = Phaser.Math.Distance.Between(this.castTargetX, this.castTargetY, player.x, player.y);
      if (dist < CAST_ZONE_RADIUS + 16) {
        this.dealMeleeDamage(player, Math.round(this.def.dmg * 1.3));
        // Caster AoE burst VFX
        const burst = this.scene.add.circle(this.castTargetX, this.castTargetY, CAST_ZONE_RADIUS, 0xffffff, 0.4).setDepth(5);
        this.scene.tweens.add({ targets: burst, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 200, onComplete: () => burst.destroy() });
      }
      this.aiState = 'retreat';
      this.retreatTimer = RETREAT_MS;
      this.setRetreatDir(player);
      this.attackCooldown = ENEMY_ATTACK_COOLDOWN * 2;
    }
  }

  private doSupportCast(allies: Enemy[], _delta: number): void {
    this.supportTimer = SUPPORT_HEAL_INTERVAL;
    this.setVelocity(0, 0);
    this.aiState = 'idle';

    // Find the most-injured ally within range
    let target: Enemy | null = null;
    let lowestPct = 0.85; // only heal if below 85% HP
    for (const ally of allies) {
      if (ally === this || !ally.active) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, ally.x, ally.y);
      if (dist > TILE * 8) continue;
      const pct = ally.hpPct;
      if (pct < lowestPct) { lowestPct = pct; target = ally; }
    }

    if (target) {
      const heal = Math.round(target.maxHp * 0.18);
      target.hp = Math.min(target.maxHp, target.hp + heal);
      // Heal VFX
      const txt = this.scene.add.text(target.x, target.y - 16, `+${heal}`, { fontSize: '7px', color: '#88ff88' })
        .setOrigin(0.5).setDepth(9);
      this.scene.tweens.add({ targets: txt, alpha: 0, y: target.y - 36, duration: 900, onComplete: () => txt.destroy() });
      const ring = this.scene.add.circle(target.x, target.y, 16, 0x44ff44, 0.25).setDepth(3);
      this.scene.tweens.add({ targets: ring, scaleX: 2, scaleY: 2, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
    }
  }

  private doLeash(speed: number, isRooted: boolean): void {
    const distHome = Phaser.Math.Distance.Between(this.x, this.y, this.homeX, this.homeY);
    if (distHome < TILE || isRooted) {
      this.aiState = 'idle';
      this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.08)); // partial regen on leash
      this.setVelocity(0, 0);
      return;
    }
    this.scene.physics.moveTo(
      this as unknown as Phaser.GameObjects.GameObject,
      this.homeX, this.homeY, speed * 0.8,
    );
    this.play(this.walkAnim, true);
    this.setFlipX(this.homeX < this.x);
  }

  private doIdle(delta: number): void {
    this.idleTimer -= delta;
    if (this.idleTimer <= 0) {
      this.idleTimer = Phaser.Math.Between(1000, 2600);
      const angle = Math.random() * Math.PI * 2;
      const spd   = this.def.speed * 0.3;
      this.idleVx = Math.cos(angle) * spd;
      this.idleVy = Math.sin(angle) * spd;
      if (Math.random() < 0.35) { this.idleVx = 0; this.idleVy = 0; }
    }
    this.setVelocity(this.idleVx, this.idleVy);
    const moving = Math.abs(this.idleVx) + Math.abs(this.idleVy) > 1;
    this.play(moving ? this.walkAnim : this.idleAnim, true);
    if (this.idleVx !== 0) this.setFlipX(this.idleVx < 0);
  }

  // ── Ranged projectile ─────────────────────────────────────────────────────

  private fireProjectile(player: Player): void {
    const speed = 200;
    const tintColor = this.def.element === 'fire'      ? 0xff4400
                    : this.def.element === 'ice'       ? 0x44aaff
                    : this.def.element === 'lightning' ? 0xffee00
                    : this.def.element === 'poison'    ? 0x44ff44
                    : 0xff8888;

    const proj = this.scene.physics.add.image(this.x, this.y, 'arrow')
      .setDepth(4).setTint(tintColor).setScale(0.85);
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    proj.setAngle(Phaser.Math.RadToDeg(angle));
    (proj.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    const hitCheck = this.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        if (!proj.active) { hitCheck.destroy(); return; }
        if (Phaser.Math.Distance.Between(proj.x, proj.y, player.x, player.y) < 22) {
          this.dealMeleeDamage(player, this.def.dmg);
          proj.destroy(); hitCheck.destroy(); return;
        }
        const bounds = this.scene.physics.world.bounds;
        if (proj.x < 0 || proj.y < 0 || proj.x > bounds.width || proj.y > bounds.height) {
          proj.destroy(); hitCheck.destroy();
        }
      },
    });
    this.scene.time.delayedCall(1800, () => { if (proj.active) proj.destroy(); hitCheck.destroy(); });
  }

  // ── Champion HP bar ───────────────────────────────────────────────────────

  private drawChampHpBar(): void {
    if (!this.champHpBar) return;
    const pct  = Math.max(0, this.hp / this.maxHp);
    const barW = 34, barH = 4;
    const bx   = this.x - barW / 2, by = this.y - 26;
    this.champHpBar.clear();
    this.champHpBar.fillStyle(0x000000, 0.75);
    this.champHpBar.fillRect(bx, by, barW, barH);
    const barColor = pct > 0.5 ? 0xffaa00 : (pct > 0.25 ? 0xff6600 : 0xff0000);
    this.champHpBar.fillStyle(barColor);
    this.champHpBar.fillRect(bx, by, barW * pct, barH);
    this.champHpBar.lineStyle(1, 0xffffff, 0.4);
    this.champHpBar.strokeRect(bx, by, barW, barH);
    // Shield overlay
    if (this.shieldHp > 0) {
      const shieldPct = this.shieldHp / (this.maxHp * 0.30);
      this.champHpBar.fillStyle(0xccddff, 0.6);
      this.champHpBar.fillRect(bx, by, barW * Math.min(1, shieldPct), barH);
    }
  }

  // ── Drop ──────────────────────────────────────────────────────────────────

  getDrop(): { itemId: string; qty: number } | null {
    if (!this.def.dropItem || !this.def.dropChance) return null;
    if (Math.random() > this.def.dropChance) return null;
    return { itemId: this.def.dropItem, qty: 1 };
  }

  get isPoiseDamaged(): boolean { return this.poiseWindow > 0; }

  get currentAiState(): EnemyState { return this.aiState; }

  private castShadeMirrorSkill(player: Player): void {
    const classKey = player.classKey;
    const px = player.x, py = player.y;
    const scene = this.scene as any;

    if (classKey === 'swordman') {
      if (Math.random() < 0.5) {
        if (scene.floatText) scene.floatText('BLADE THRUST!', this.x, this.y - 28, '#cc88ff');
        const dist = 60;
        const angle = Math.atan2(py - this.y, px - this.x);
        this.setVelocity(Math.cos(angle) * dist * 4, Math.sin(angle) * dist * 4);
        this.scene.time.delayedCall(120, () => {
          if (this.active && Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < 56) {
            player.takeDamage(Math.round(this.def.dmg * 1.4), this.x, this.y, 'slash');
          }
        });
      } else {
        if (scene.floatText) scene.floatText('PARRY STANCE!', this.x, this.y - 28, '#cc88ff');
        const originalInvuln = (this as any).isInvulnerable;
        (this as any).isInvulnerable = true;
        this.setTint(0xbb88ff);
        this.scene.time.delayedCall(1200, () => {
          (this as any).isInvulnerable = originalInvuln;
          this.restoreBaseTint();
        });
      }
    } else if (classKey === 'archer') {
      if (scene.floatText) scene.floatText('ARROW RAIN!', this.x, this.y - 28, '#44ff44');
      const zone = this.scene.add.circle(px, py, 40, 0xff0000, 0.25).setDepth(4);
      this.scene.tweens.add({
        targets: zone,
        scaleX: 1.2,
        scaleY: 1.2,
        alpha: 0.1,
        duration: 1000,
        onComplete: () => {
          const d = Phaser.Math.Distance.Between(player.x, player.y, zone.x, zone.y);
          if (d < 48 && player.active) {
            player.takeDamage(Math.round(this.def.dmg * 1.1), zone.x, zone.y, 'poison');
          }
          for (let i = 0; i < 5; i++) {
            const arr = this.scene.add.circle(zone.x + Phaser.Math.Between(-15, 15), zone.y + Phaser.Math.Between(-15, 15), 4, 0x00ff00, 0.7).setDepth(5);
            this.scene.tweens.add({ targets: arr, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 300, onComplete: () => arr.destroy() });
          }
          zone.destroy();
        }
      });
    } else if (classKey === 'tanker') {
      if (scene.floatText) scene.floatText('TAUNT SLAM!', this.x, this.y - 28, '#ffee33');
      const wave = this.scene.add.circle(this.x, this.y, 10, 0xffee33, 0.6).setDepth(4);
      this.scene.tweens.add({
        targets: wave,
        scaleX: 5.5,
        scaleY: 5.5,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          const d = Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y);
          if (d < 56 && player.active) {
            player.takeDamage(Math.round(this.def.dmg * 1.2), this.x, this.y);
            StatusSystem.applyBuildUp(player, 'ko', 25, this.scene as any);
          }
          wave.destroy();
        }
      });
    } else if (classKey === 'assassin') {
      if (scene.floatText) scene.floatText('VANISH!', this.x, this.y - 28, '#888888');
      this.setAlpha(0.2);
      this.scene.time.delayedCall(600, () => {
        if (this.active) {
          const angle = Math.random() * Math.PI * 2;
          this.setPosition(player.x + Math.cos(angle) * 28, player.y + Math.sin(angle) * 28);
          this.setAlpha(1.0);
          if (scene.floatText) scene.floatText('AMBUSH!', this.x, this.y - 28, '#cc2222');
          player.takeDamage(Math.round(this.def.dmg * 1.3), this.x, this.y, 'poison');
        }
      });
    } else if (classKey === 'sage') {
      if (scene.floatText) scene.floatText('GLYPH BLAST!', this.x, this.y - 28, '#88aaff');
      const rune = this.scene.add.circle(px, py, 32, 0xaa22ff, 0.3).setDepth(4);
      this.scene.tweens.add({
        targets: rune,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0.1,
        duration: 900,
        onComplete: () => {
          const d = Phaser.Math.Distance.Between(player.x, player.y, rune.x, rune.y);
          if (d < 40 && player.active) {
            player.takeDamage(Math.round(this.def.dmg * 1.2), rune.x, rune.y, 'void');
            StatusSystem.applyBuildUp(player, 'corruption', 20, this.scene as any);
          }
          rune.destroy();
        }
      });
    }
  }
}
