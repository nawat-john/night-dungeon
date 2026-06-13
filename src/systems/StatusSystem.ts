import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { TUNING } from '../config';
import { SaveManager } from './SaveManager';
import type { Element, Ailment } from '../types';

export type { Element, Ailment };

export interface AilmentConfig {
  id: Ailment;
  name: string;
  color: number;
  durationMs: number;
  icon: string;
}

export const AILMENT_CONFIGS: Record<Ailment, AilmentConfig> = {
  // §15 original ailments
  poison:    { id: 'poison',    name: 'POISON',    color: 0xaa33ff, durationMs: 6000,  icon: '🧪' },
  bleed:     { id: 'bleed',     name: 'BLEED',     color: 0xff3333, durationMs: 8000,  icon: '🩸' },
  burn:      { id: 'burn',      name: 'BURN',      color: 0xff7700, durationMs: 5000,  icon: '🔥' },
  chill:     { id: 'chill',     name: 'CHILL',     color: 0x00ccff, durationMs: 4000,  icon: '❄️' },
  frozen:    { id: 'frozen',    name: 'FROZEN',    color: 0x00ffff, durationMs: 2500,  icon: '🧊' },
  shock:     { id: 'shock',     name: 'SHOCK',     color: 0xffea00, durationMs: 6000,  icon: '⚡' },
  stun:      { id: 'stun',      name: 'STUN',      color: 0x888888, durationMs: 3000,  icon: '💫' },
  curse:     { id: 'curse',     name: 'CURSE',     color: 0x551177, durationMs: 999999, icon: '💀' },
  webbed:    { id: 'webbed',    name: 'ROOTED',    color: 0x556655, durationMs: 3000,  icon: '🕸️' },
  wet:       { id: 'wet',       name: 'WET',       color: 0x3333ff, durationMs: 10000, icon: '💦' },
  // §E15 P7 additions — data model stubs (full behaviour in P8)
  ko:         { id: 'ko',         name: 'KO',        color: 0xff8800, durationMs: 1500,  icon: '💢' },
  wound:      { id: 'wound',      name: 'WOUND',     color: 0xcc2200, durationMs: 12000, icon: '🩹' },
  sear:       { id: 'sear',       name: 'SEAR',      color: 0xffffaa, durationMs: 8000,  icon: '✨' },
  blind:      { id: 'blind',      name: 'BLIND',     color: 0x222222, durationMs: 5000,  icon: '👁️' },
  stuck:      { id: 'stuck',      name: 'STUCK',     color: 0x88aa44, durationMs: 4000,  icon: '🫙' },
  corruption: { id: 'corruption', name: 'CORRUPT',   color: 0x6600aa, durationMs: 10000, icon: '☠️' },
  frostbite:  { id: 'frostbite',  name: 'FROSTBITE', color: 0x88ddff, durationMs: 6000,  icon: '🌨️' },
};

export class StatusSystem {
  /**
   * Applies build-up points to an entity. Triggers reactions or full ailments when thresholds are crossed.
   */
  static applyBuildUp(
    target: Player | Enemy,
    ailmentId: Ailment,
    amount: number,
    scene: Phaser.Scene,
    attacker?: Player | Enemy
  ): void {
    if (!target.active) return;

    // Check resistances based on player's race or enemy type
    let multiplier = 1.0;
    if (target instanceof Player) {
      const race = target.scene.registry.get('race') || 'human';
      if (race === 'elf' && ailmentId === 'poison') multiplier = 0.70;
      else if (race === 'dwarf' && (ailmentId === 'chill' || ailmentId === 'frozen' || ailmentId === 'frostbite')) multiplier = 0.80;
      else if (race === 'barbarian' && ailmentId === 'stun') multiplier = 0.75;
      else if (race === 'beastman' && ailmentId === 'bleed') multiplier = 0.80;
    }

    // §P9 — Frostward 4pc: +30% freeze/frostbite build-up on enemies
    if (target instanceof Enemy && (ailmentId === 'frostbite' || ailmentId === 'frozen')) {
      const scene2 = target.scene;
      const pl = scene2.children.list.find(c => c instanceof Player) as Player | undefined;
      if (pl && pl.hasSetBonus('frostward', 4)) multiplier *= 1.30;
    }

    // §P9 — Voidbane 4pc: +30% radiant/sear build-up on enemies
    if (target instanceof Enemy && (ailmentId === 'sear')) {
      const scene2 = target.scene;
      const pl = scene2.children.list.find(c => c instanceof Player) as Player | undefined;
      if (pl && pl.hasSetBonus('voidbane', 4)) multiplier *= 1.30;
    }

    // Standing in Oil makes you 2x flammable
    if (ailmentId === 'burn' && target.getData('in_oil')) {
      multiplier *= 2.0;
    }

    const finalAmount = amount * multiplier;
    if (finalAmount <= 0) return;

    // Check opposing reactions first!
    if (StatusSystem.checkReaction(target, ailmentId, scene, attacker)) {
      return; // reaction consumed the elements
    }

    // Accumulate build-up
    const currentBuildUp = target.ailmentBuildUp.get(ailmentId) ?? 0;
    const isAlreadyActive = (target.activeAilments.get(ailmentId) ?? 0) > 0;

    // Build-up cannot accrue if status is already active (except for wet/curse)
    if (isAlreadyActive && ailmentId !== 'wet' && ailmentId !== 'curse') return;

    const nextBuildUp = Math.min(100, currentBuildUp + finalAmount);
    target.ailmentBuildUp.set(ailmentId, nextBuildUp);

    if (nextBuildUp >= 100) {
      target.ailmentBuildUp.set(ailmentId, 0);
      StatusSystem.triggerAilment(target, ailmentId, scene);
    }
  }

  /**
   * Directly triggers an ailment, skipping build-up (e.g. wet from water hazard, curse from special items).
   */
  static triggerAilment(target: Player | Enemy, ailmentId: Ailment, scene: Phaser.Scene): void {
    if (!target.active) return;

    const cfg = AILMENT_CONFIGS[ailmentId];
    target.activeAilments.set(ailmentId, cfg.durationMs);

    // Visual text alert
    StatusSystem.floatText(scene, `${cfg.icon} ${cfg.name}!`, target.x, target.y - 32, `#${cfg.color.toString(16)}`);

    // Reset contradictory ailments
    if (ailmentId === 'frozen' || ailmentId === 'chill' || ailmentId === 'frostbite') {
      target.activeAilments.delete('burn');
      target.setData('burn_tick_accum', 0);
    } else if (ailmentId === 'burn') {
      target.activeAilments.delete('frozen');
      target.activeAilments.delete('chill');
      target.activeAilments.delete('frostbite');
      target.activeAilments.delete('wet');
      target.setData('chill_tick_accum', 0);
      target.setData('wet_tick_accum', 0);
    } else if (ailmentId === 'wet') {
      target.activeAilments.delete('burn');
      target.setData('burn_tick_accum', 0);
    }

    // P8 — KO/Topple: stagger + open punish window
    if (ailmentId === 'ko' && target instanceof Enemy) {
      target.applyStagger(1500);
      target.setData('ko_punish_ms', 3000);
      StatusSystem.floatText(scene, '💢 TOPPLE!', target.x, target.y - 44, '#ff8800');
      if (target.def.archetype === 'brute') {
        scene.game.events.emit('topple-brute');
      }
    }

    // P8 — Frozen: stun enemy in place
    if (ailmentId === 'frozen' && target instanceof Enemy) {
      target.applyStagger(1200);
      if (target.body) (target.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }

    // P8 — Sear: apply Blind to living targets (not undead/construct/spectral) after 500ms
    if (ailmentId === 'sear') {
      const isLiving = !(target instanceof Enemy) ||
        !(['undead', 'construct', 'spectral'] as string[]).includes(target.def.elemFamily ?? '');
      if (isLiving) {
        scene.time.delayedCall(500, () => {
          if (target.active) StatusSystem.triggerAilment(target, 'blind', scene);
        });
      }
    }

    // Persist curse to CharacterSave if target is Player
    if (target instanceof Player && ailmentId === 'curse') {
      const s = SaveManager.load();
      if (s) {
        s.curseActive = true;
        SaveManager.write(s);
      }
      target.recomputeDerivedStats(s?.stats ?? { hp: 100, mp: 30, str: 5, dex: 5, int: 5, vit: 5, agi: 5 }, target.level);
    }

    scene.game.events.emit('hud-update', target);
  }

  /**
   * Check if applying a new build-up triggers an elemental reaction. Returns true if reaction occurs.
   */
  private static checkReaction(
    target: Player | Enemy,
    newAilment: Ailment,
    scene: Phaser.Scene,
    attacker?: Player | Enemy
  ): boolean {
    const isFrozen      = (target.activeAilments.get('frozen')    ?? 0) > 0;
    const isChilled     = (target.activeAilments.get('chill')     ?? 0) > 0;
    const isFrostbitten = (target.activeAilments.get('frostbite') ?? 0) > 0;
    const isShocked     = (target.activeAilments.get('shock')     ?? 0) > 0;
    const isBurned      = (target.activeAilments.get('burn')      ?? 0) > 0;

    // 1. Fire + Ice/Chill/Frostbite/Frozen -> Shatter
    if (newAilment === 'burn' && (isFrozen || isChilled || isFrostbitten)) {
      target.activeAilments.delete('frozen');
      target.activeAilments.delete('chill');
      target.activeAilments.delete('frostbite');

      const shatterDmg = 35;
      if (target instanceof Enemy) {
        target.takeDamage(shatterDmg, target.x, target.y + 10, 30);
        if (attacker instanceof Player) target.addThreat('player', shatterDmg);
      } else {
        target.takeDamage(shatterDmg);
      }

      StatusSystem.floatText(scene, '💥 SHATTER!', target.x, target.y - 32, '#00ffff');
      const circle = scene.add.circle(target.x, target.y, 25, 0x00ffff, 0.4).setDepth(4);
      scene.tweens.add({ targets: circle, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 250, onComplete: () => circle.destroy() });
      return true;
    }

    // 2. Blunt (KO build-up) + Frozen -> Enhanced Shatter (+60% AoE; frostward 5pc stacks)
    if (newAilment === 'ko' && isFrozen) {
      target.activeAilments.delete('frozen');

      // §P9 — Frostward 5pc: freezing a foe shatters for AoE (+further 30%)
      const player = scene.children.list.find(c => c instanceof Player) as Player | undefined;
      const frostwardBonus = (player && player.hasSetBonus('frostward', 5)) ? 1.3 : 1.0;
      const shatterDmg = Math.round(55 * frostwardBonus);
      StatusSystem.floatText(scene, '💥 SHATTER!', target.x, target.y - 32, '#00ffff');
      const bigCircle = scene.add.circle(target.x, target.y, 10, 0x00ffff, 0.5).setDepth(4);
      scene.tweens.add({ targets: bigCircle, scaleX: 9.0, scaleY: 9.0, alpha: 0, duration: 350, onComplete: () => bigCircle.destroy() });
      scene.cameras.main.shake(100, 0.006);

      const isAttackerPlayer = attacker instanceof Player || !attacker;
      if (target instanceof Enemy || isAttackerPlayer) {
        const enemies = scene.children.list.filter(c => c instanceof Enemy) as Enemy[];
        for (const e of enemies) {
          if (e.active && Phaser.Math.Distance.Between(target.x, target.y, e.x, e.y) < 80) {
            e.takeDamage(shatterDmg, target.x, target.y, 40);
            if (attacker instanceof Player) e.addThreat('player', shatterDmg);
          }
        }
      }
      return true;
    }

    // 3. Fire + Lightning/Shock -> Overload
    if ((newAilment === 'burn' && isShocked) || (newAilment === 'shock' && isBurned)) {
      target.activeAilments.delete('burn');
      target.activeAilments.delete('shock');

      StatusSystem.floatText(scene, '⚡ OVERLOAD!', target.x, target.y - 32, '#ffaa00');

      const explosion = scene.add.circle(target.x, target.y, 10, 0xff7700, 0.5).setDepth(4);
      scene.tweens.add({ targets: explosion, scaleX: 7.0, scaleY: 7.0, alpha: 0, duration: 300, onComplete: () => explosion.destroy() });
      scene.cameras.main.shake(120, 0.008);

      const isAttackerPlayer = attacker instanceof Player || !attacker;
      if (isAttackerPlayer) {
        const enemies = scene.children.list.filter(c => c instanceof Enemy) as Enemy[];
        for (const e of enemies) {
          if (e.active && Phaser.Math.Distance.Between(target.x, target.y, e.x, e.y) < 70) {
            e.takeDamage(25, target.x, target.y, 30);
            e.addThreat('player', 25);
          }
        }
      } else {
        const player = (scene as any).player as Player;
        if (player && player.active && Phaser.Math.Distance.Between(target.x, target.y, player.x, player.y) < 70) {
          player.takeDamage(25, target.x, target.y);
        }
      }
      return true;
    }

    // 4. Ice/Frostbite + Lightning/Shock -> Superconduct
    if ((newAilment === 'chill' && isShocked) || (newAilment === 'frostbite' && isShocked) ||
        (newAilment === 'shock' && (isChilled || isFrostbitten))) {
      target.activeAilments.delete('chill');
      target.activeAilments.delete('frostbite');
      target.activeAilments.delete('shock');

      StatusSystem.floatText(scene, '❄️ SUPERCONDUCT!', target.x, target.y - 32, '#aaccff');

      const superconductDmg = 15;
      if (target instanceof Enemy) {
        target.takeDamage(superconductDmg, target.x, target.y, 10);
        if (attacker instanceof Player) target.addThreat('player', superconductDmg);
      } else {
        target.takeDamage(superconductDmg);
      }

      target.setData('superconducting_ms', 6000);
      if (target instanceof Player) {
        const s = SaveManager.load();
        target.recomputeDerivedStats(s?.stats ?? { hp: 100, mp: 30, str: 5, dex: 5, int: 5, vit: 5, agi: 5 }, target.level);
      }
      return true;
    }

    return false;
  }

  /**
   * Ticks down ailment duration timers, applies DoT values, and renders UI bars.
   */
  static tickAilments(target: Player | Enemy, delta: number, scene: Phaser.Scene): void {
    if (!target.active) {
      if (target.ailmentGraphics) target.ailmentGraphics.clear();
      return;
    }

    // Tick superconduct debuff
    let supercondMs = target.getData('superconducting_ms') ?? 0;
    if (supercondMs > 0) {
      supercondMs = Math.max(0, supercondMs - delta);
      target.setData('superconducting_ms', supercondMs);
      if (supercondMs <= 0 && target instanceof Player) {
        const s = SaveManager.load();
        target.recomputeDerivedStats(s?.stats ?? { hp: 100, mp: 30, str: 5, dex: 5, int: 5, vit: 5, agi: 5 }, target.level);
      }
    }

    // §P9 — Voidbane 5pc: immune to Corruption
    if (target instanceof Player && (target.activeAilments.get('corruption') ?? 0) > 0) {
      if (target.hasSetBonus('voidbane', 5)) {
        target.activeAilments.delete('corruption');
      }
    }

    // P8 — KO punish window countdown
    let koPunishMs = target.getData('ko_punish_ms') ?? 0;
    if (koPunishMs > 0) {
      target.setData('ko_punish_ms', Math.max(0, koPunishMs - delta));
    }

    // P8 — Blind: reduce enemy aggro range while active
    if (target instanceof Enemy && (target.activeAilments.get('blind') ?? 0) > 0) {
      target.setData('aggro_range_override', 48);
    } else if (target instanceof Enemy) {
      target.setData('aggro_range_override', null);
    }

    // Process ailments
    for (const [id, ms] of target.activeAilments.entries()) {
      if (ms <= 0) continue;

      let nextMs = ms - delta;
      if (nextMs <= 0) {
        target.activeAilments.delete(id);
        if (target instanceof Player && id === 'curse') {
          target.activeAilments.set(id, 999999);
        } else {
          // P8 — frostbite expiry chains into frozen
          if (id === 'frostbite') {
            StatusSystem.triggerAilment(target, 'frozen', scene);
          }
          scene.game.events.emit('hud-update', target);
        }
        continue;
      }
      target.activeAilments.set(id, nextMs);

      // DoT Tickers (1s interval)
      if (id === 'poison' || id === 'bleed' || id === 'burn' || id === 'sear' || id === 'corruption') {
        const accumKey = `${id}_tick_accum`;
        let accum = (target.getData(accumKey) ?? 0) + delta;
        if (accum >= 1000) {
          accum -= 1000;
          StatusSystem.applyAilmentDamage(target, id as Ailment);
        }
        target.setData(accumKey, accum);
      }

      // P8 — Stuck: zero velocity every tick
      if (id === 'stuck' && target instanceof Enemy) {
        if (target.body) (target.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }

      // Shock periodic stagger ticker
      if (id === 'shock') {
        let shockAccum = (target.getData('shock_stagger_accum') ?? 0) + delta;
        if (shockAccum >= 1500) {
          shockAccum -= 1500;
          if (target instanceof Enemy) {
            target.applyStagger(300);
          } else {
            target.combatState = 'hitstun';
            target.setData('stateTimer', 300);
            target.setTint(0xffea00);
            scene.time.delayedCall(300, () => {
              if (target.active && target.combatState === 'hitstun') {
                target.combatState = 'idle';
                target.clearTint();
              }
            });
          }
          StatusSystem.floatText(scene, '⚡ SHOCK', target.x, target.y - 20, '#ffea00');
        }
        target.setData('shock_stagger_accum', shockAccum);
      }
    }

    // Redraw build-up and duration UI bars
    StatusSystem.drawVisualBars(target);
  }

  /**
   * Applies tick damage to target.
   */
  private static applyAilmentDamage(target: Player | Enemy, ailmentId: Ailment): void {
    if (ailmentId === 'poison') {
      const effDef = Math.round(target.defense * 0.5);
      StatusSystem.dealFlatDamage(target, Math.max(1, 3 - effDef), '#aa33ff');
    } else if (ailmentId === 'bleed') {
      const isMoving = target.body && target.body.velocity.length() > 8;
      const bleedDmg = isMoving ? 5 : 2;
      // P10 bloodgorged: heal enemy from bleed instead of dealing damage
      if (target instanceof Enemy && (target as Enemy).absorbBleeding(bleedDmg)) return;
      StatusSystem.dealFlatDamage(target, bleedDmg, isMoving ? '#ff1111' : '#ff3333');
    } else if (ailmentId === 'burn') {
      StatusSystem.dealFlatDamage(target, Math.max(1, 4 - target.defense), '#ff7700');
    } else if (ailmentId === 'sear') {
      // P8 — ignores defense entirely
      StatusSystem.dealFlatDamage(target, 5, '#ffffaa');
    } else if (ailmentId === 'corruption') {
      // P8 — 2% of max HP per second
      const maxHp = target instanceof Player ? target.maxHp : (target as Enemy).maxHpValue;
      const corruptDmg = Math.max(1, Math.round(maxHp * 0.02));
      StatusSystem.dealFlatDamage(target, corruptDmg, '#bb44ff');
    }
  }

  private static dealFlatDamage(target: Player | Enemy, dmg: number, color: string): void {
    if (target instanceof Enemy) {
      target.takeDamage(dmg, undefined, undefined, 0);
    } else {
      target.takeDamage(dmg);
    }
    StatusSystem.floatText(target.scene, `${dmg}`, target.x, target.y - 20, color);
  }

  /**
   * Draws ailment indicators above target's head.
   */
  private static drawVisualBars(target: Player | Enemy): void {
    if (!target.ailmentGraphics) return;
    const g = target.ailmentGraphics;
    g.clear();

    const displayAilments: { id: Ailment; ratio: number; color: number; isActive: boolean }[] = [];

    // Collect active ailments with durations
    for (const [id, ms] of target.activeAilments.entries()) {
      if (ms <= 0) continue;
      const ailmentId = id as Ailment;
      const cfg = AILMENT_CONFIGS[ailmentId];
      if (ailmentId === 'curse') {
        displayAilments.push({ id: ailmentId, ratio: 1.0, color: cfg.color, isActive: true });
      } else {
        displayAilments.push({ id: ailmentId, ratio: ms / cfg.durationMs, color: cfg.color, isActive: true });
      }
    }

    // Collect active build-ups
    for (const [id, bp] of target.ailmentBuildUp.entries()) {
      if (bp <= 0 || bp >= 100) continue;
      const ailmentId = id as Ailment;
      const cfg = AILMENT_CONFIGS[ailmentId];
      displayAilments.push({ id: ailmentId, ratio: bp / 100, color: cfg.color, isActive: false });
    }

    if (displayAilments.length === 0) return;

    // Draw bars stacked above character's bounding box
    const BAR_W = 20;
    const BAR_H = 3;
    const startY = -8; // relative to target origin

    displayAilments.forEach((item, idx) => {
      const bx = target.x - BAR_W / 2;
      const by = target.y - (target.body ? target.body.height : 24) + startY - (idx * (BAR_H + 2));

      // Draw background
      g.fillStyle(0x333333, 0.7);
      g.fillRect(bx, by, BAR_W, BAR_H);

      // Draw border
      g.lineStyle(0.5, item.isActive ? 0xffffff : 0x777777, 0.8);
      g.strokeRect(bx, by, BAR_W, BAR_H);

      // Draw fill
      g.fillStyle(item.color, 1.0);
      g.fillRect(bx + 0.5, by + 0.5, Math.max(1, (BAR_W - 1) * item.ratio), BAR_H - 1);
    });
  }

  private static floatText(scene: Phaser.Scene, msg: string, x: number, y: number, color: string): void {
    if ((scene as any).showDamageNumbers === false && /^\d+!?$/.test(msg)) return;
    const t = scene.add.text(x, y, msg, { fontSize: '7px', color }).setOrigin(0.5).setDepth(8);
    scene.tweens.add({ targets: t, alpha: 0, y: y - 26, duration: 1000, onComplete: () => t.destroy() });
  }
}
