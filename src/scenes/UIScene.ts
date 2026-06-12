import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';
import { expForLevel } from '../config';
import { WeaponFamily } from '../data/movesets';
import { Ailment, AILMENT_CONFIGS } from '../systems/StatusSystem';

const BAR_W = 160;
const BAR_H = 8;
const PAD   = 10;

interface HotbarData {
  slots: { label: string; qty: number }[];
}

interface WeaponGaugeData {
  family:  WeaponFamily | undefined;
  edge:    number;   // 0–100
  flow:    number;   // 0–5 stacks
  frenzy:  boolean;
  isBlunt: boolean;
}

export class UIScene extends Phaser.Scene {
  private hpBg!:       Phaser.GameObjects.Rectangle;
  private hpBar!:      Phaser.GameObjects.Rectangle;
  private hpText!:     Phaser.GameObjects.Text;
  private stamBg!:     Phaser.GameObjects.Rectangle;
  private stamBar!:    Phaser.GameObjects.Rectangle;
  private stamText!:   Phaser.GameObjects.Text;
  private mpBg!:       Phaser.GameObjects.Rectangle;
  private mpBar!:      Phaser.GameObjects.Rectangle;
  private mpText!:     Phaser.GameObjects.Text;
  private expBg!:      Phaser.GameObjects.Rectangle;
  private expBar!:     Phaser.GameObjects.Rectangle;
  private expText!:    Phaser.GameObjects.Text;
  private goldText!:   Phaser.GameObjects.Text;
  private floorText!:  Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private hintText!:   Phaser.GameObjects.Text;
  private ammoText!:   Phaser.GameObjects.Text;

  // §11 Guard indicator
  private guardIndicator!: Phaser.GameObjects.Text;

  // §12 Unspent stat points banner
  private statBanner!: Phaser.GameObjects.Text;
  private statBannerTween: Phaser.Tweens.Tween | null = null;

  // §13 Weapon gauge (edge bar + frenzy/flow pips)
  private gaugeBg!:    Phaser.GameObjects.Rectangle;
  private gaugeBar!:   Phaser.GameObjects.Rectangle;
  private gaugeLabel!: Phaser.GameObjects.Text;
  private gaugePips:   Phaser.GameObjects.Rectangle[] = [];
  private gaugeRow!:   Phaser.GameObjects.Container;

  // Hotbar
  private hotbarSlots: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];

  // §14 Skills HUD slots
  private playerRef: Player | null = null;
  private skillSlots: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; cooldownOverlay: Phaser.GameObjects.Rectangle }[] = [];

  // §15 Player ailments HUD indicators
  private ailmentGraphics!: Phaser.GameObjects.Graphics;
  private ailmentTexts: Phaser.GameObjects.Text[] = [];

  constructor() { super({ key: 'UIScene', active: false }); }

  create(): void {
    // HP bar
    this.hpBg   = this.add.rectangle(PAD, PAD,      BAR_W, BAR_H, 0x331111).setOrigin(0);
    this.hpBar  = this.add.rectangle(PAD, PAD,      BAR_W, BAR_H, 0xcc3333).setOrigin(0);
    this.hpText = this.add.text(PAD + BAR_W + 6, PAD - 1, '', { fontSize: '11px', color: '#cc6666' });

    // Stamina bar (yellow)
    this.stamBg   = this.add.rectangle(PAD, PAD + 16, BAR_W, BAR_H, 0x332200).setOrigin(0);
    this.stamBar  = this.add.rectangle(PAD, PAD + 16, BAR_W, BAR_H, 0xddaa22).setOrigin(0);
    this.stamText = this.add.text(PAD + BAR_W + 6, PAD + 15, '', { fontSize: '11px', color: '#bb9933' });

    // MP bar
    this.mpBg   = this.add.rectangle(PAD, PAD + 32, BAR_W, BAR_H, 0x111133).setOrigin(0);
    this.mpBar  = this.add.rectangle(PAD, PAD + 32, BAR_W, BAR_H, 0x3366cc).setOrigin(0);
    this.mpText = this.add.text(PAD + BAR_W + 6, PAD + 31, '', { fontSize: '11px', color: '#6688cc' });

    // EXP bar
    this.expBg   = this.add.rectangle(PAD, PAD + 48, BAR_W, BAR_H, 0x112211).setOrigin(0);
    this.expBar  = this.add.rectangle(PAD, PAD + 48, BAR_W, BAR_H, 0x33aa55).setOrigin(0);
    this.expText = this.add.text(PAD + BAR_W + 6, PAD + 47, '', { fontSize: '11px', color: '#55cc77' });

    // Weapon slot label
    this.goldText   = this.add.text(0, PAD, '', { fontSize: '12px', color: '#ffdd44' }).setOrigin(1, 0);
    this.floorText  = this.add.text(0, PAD, '', { fontSize: '12px', color: '#998bbb' }).setOrigin(0.5, 0);
    this.weaponText = this.add.text(PAD, PAD + 80, '', { fontSize: '10px', color: '#aaccff' });
    this.ammoText   = this.add.text(PAD, PAD + 92, '', { fontSize: '9px', color: '#88aacc' });
    this.hintText   = this.add.text(0, 0,
      'Space: Attack  X: Heavy  Z: Dodge  G: Guard  E: Interact  Q: Swap  C: Stats  1-4: Items',
      { fontSize: '9px', color: '#332244' }).setOrigin(0.5, 1);

    // §13 Weapon gauge row (edge bar + pips)
    this.gaugeRow  = this.add.container(PAD, PAD + 104).setDepth(8);
    this.gaugeBg   = this.add.rectangle(0, 0, BAR_W, 5, 0x221100).setOrigin(0);
    this.gaugeBar  = this.add.rectangle(0, 0, BAR_W, 5, 0xff8800).setOrigin(0);
    this.gaugeLabel= this.add.text(BAR_W + 6, -2, '', { fontSize: '8px', color: '#ff8822' });
    this.gaugeRow.add([this.gaugeBg, this.gaugeBar, this.gaugeLabel]);
    // Pip row for Flow/Frenzy
    for (let i = 0; i < 5; i++) {
      const pip = this.add.rectangle(i * 10, 8, 8, 5, 0x226688).setOrigin(0);
      this.gaugePips.push(pip);
      this.gaugeRow.add(pip);
    }
    this.gaugeRow.setVisible(false);

    // §15 Player active ailments graphics and text pool
    this.ailmentGraphics = this.add.graphics();
    this.ailmentTexts = [];

    // §11 Guard indicator — shows when blocking
    this.guardIndicator = this.add.text(0, 0, '🛡 GUARD', {
      fontSize: '11px',
      color: '#88ddff',
      stroke: '#003355',
      strokeThickness: 3,
    }).setOrigin(1, 0).setVisible(false).setDepth(10);

    // §12 Stat points banner — pulses when points are available
    this.statBanner = this.add.text(0, 0, '', {
      fontSize: '10px',
      color: '#ffee55',
      stroke: '#332200',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setVisible(false).setDepth(10);

    // Hotbar (3 slots at bottom-center)
    this.buildHotbar();

    this.game.events.on('hud-update',     this.onHudUpdate,     this);
    this.game.events.on('floor-update',   this.onFloorUpdate,   this);
    this.game.events.on('weapon-switch',  this.onWeaponSwitch,  this);
    this.game.events.on('hotbar-update',  this.onHotbarUpdate,  this);
    this.game.events.on('guard-update',   this.onGuardUpdate,   this);
    this.game.events.on('weapon-gauge',   this.onWeaponGauge,   this);
    this.game.events.on('ammo-update',    this.onAmmoUpdate,    this);
    this.events.once('shutdown', () => {
      this.game.events.off('hud-update',    this.onHudUpdate,    this);
      this.game.events.off('floor-update',  this.onFloorUpdate,  this);
      this.game.events.off('weapon-switch', this.onWeaponSwitch, this);
      this.game.events.off('hotbar-update', this.onHotbarUpdate, this);
      this.game.events.off('guard-update',  this.onGuardUpdate,  this);
      this.game.events.off('weapon-gauge',  this.onWeaponGauge,  this);
      this.game.events.off('ammo-update',    this.onAmmoUpdate,    this);
    });

    this.scale.on('resize', this.reposition, this);
    this.reposition();

    const save = SaveManager.load();
    if (save) {
      this.setHp(save.currentHp, save.stats.hp);
      this.setStam(100, 100);
      this.setMp(save.currentMp, save.stats.mp);
      this.setExp(save.exp ?? 0, save.level);
      this.goldText.setText(`${save.gold}g`);
      if (save.location === 'dungeon') this.floorText.setText(`Floor ${save.dungeonFloor}`);
      const wepId = save.equipped['mainhand'];
      if (wepId) this.weaponText.setText(`[${save.activeWeaponSlot === 0 ? '1' : '2'}] ${wepId}`);
      this.refreshHotbarFromSave(save.inventory);
      this.updateStatBanner(save);
    }
  }

  private buildHotbar(): void {
    const SLOT_W = 46, SLOT_H = 30, GAP = 4;
    const labels = ['1:HP', '2:MP', '3:Bomb', '4:Whet'];
    for (let i = 0; i < 4; i++) {
      const bg = this.add.rectangle(0, 0, SLOT_W, SLOT_H, 0x1a1025, 0.92)
        .setStrokeStyle(1, 0x443355)
        .setScrollFactor(0)
        .setDepth(5);
      const label = this.add.text(0, 0, labels[i] + '\n--',
        { fontSize: '8px', color: '#998bbb', align: 'center' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(6);
      this.hotbarSlots.push({ bg, label });
      void GAP;
    }

    // Create skill slots
    const skillKeys = ['R', 'F', 'V'];
    for (let i = 0; i < 3; i++) {
      const bg = this.add.rectangle(0, 0, SLOT_W, SLOT_H, 0x0f0b12, 0.92)
        .setStrokeStyle(1, 0x442b55)
        .setScrollFactor(0)
        .setDepth(5);
      const cooldownOverlay = this.add.rectangle(0, 0, SLOT_W, 0, 0x882222, 0.45)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(6);
      const label = this.add.text(0, 0, `${skillKeys[i]}:--\nLocked`,
        { fontSize: '7px', color: '#cc88ff', align: 'center' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(7);
      this.skillSlots.push({ bg, label, cooldownOverlay });
    }
  }

  private reposition(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.goldText.setPosition(w - PAD, PAD);
    this.floorText.setPosition(w / 2, PAD);
    this.hintText.setPosition(w / 2, h - PAD);
    this.weaponText.setPosition(PAD, PAD + 80);
    this.ammoText.setPosition(PAD, PAD + 92);
    this.gaugeRow.setPosition(PAD, PAD + 104);

    // Guard indicator — top-right, under gold
    this.guardIndicator.setPosition(w - PAD, PAD + 18);

    // Stat banner — top center, below floor text
    this.statBanner.setPosition(w / 2, PAD + 18);

    // Hotbar: centered, just above hint text
    const SLOT_W = 46, SLOT_H = 30, GAP = 4;
    // 4 items + 3 skills = 7 slots total. Plus an extra 8px spacing gap to split items/skills.
    const totalW = 7 * SLOT_W + 6 * GAP + 8;
    const startX = w / 2 - totalW / 2 + SLOT_W / 2;
    const slotY = h - 14 - SLOT_H / 2;
    for (let i = 0; i < this.hotbarSlots.length; i++) {
      const x = startX + i * (SLOT_W + GAP);
      this.hotbarSlots[i].bg.setPosition(x, slotY);
      this.hotbarSlots[i].label.setPosition(x, slotY);
    }
    const skillStartX = startX + 4 * (SLOT_W + GAP) + 8;
    for (let i = 0; i < 3; i++) {
      const x = skillStartX + i * (SLOT_W + GAP);
      const slot = this.skillSlots[i];
      slot.bg.setPosition(x, slotY);
      slot.label.setPosition(x, slotY);
      slot.cooldownOverlay.setPosition(x, slotY + 15);
    }
  }

  private onHudUpdate(player: Player): void {
    this.playerRef = player;
    this.setHp(player.currentHp, player.maxHp);
    this.setStam(player.stamina, player.maxStamina);
    this.setMp(player.currentMp, player.maxMp);
    this.setExp(player.exp, player.level);
    this.goldText.setText(`${player.gold}g`);
    this.updateStatBanner(player);
  }

  private onFloorUpdate(floor: number): void {
    this.floorText.setText(floor > 0 ? `Floor ${floor}` : '');
  }

  private onWeaponSwitch(data: { slot: number; weaponName: string }): void {
    this.weaponText.setText(`[${data.slot + 1}] ${data.weaponName}`);
    // Clear ammo display on switch — will update on next gauge event
    this.ammoText.setText('');
  }

  private onHotbarUpdate(data: HotbarData): void {
    const labels = ['1:HP', '2:MP', '3:Bomb', '4:Whet'];
    for (let i = 0; i < this.hotbarSlots.length; i++) {
      const slot = data.slots[i];
      const base = labels[i] ?? `${i + 1}:?`;
      this.hotbarSlots[i].label.setText(`${base}\n${slot?.qty ?? 0}`);
      const hasItem = (slot?.qty ?? 0) > 0;
      this.hotbarSlots[i].bg.setFillStyle(hasItem ? 0x1e1530 : 0x120e1c, 0.92);
    }
  }

  /** §11 — Show/hide the guard shield indicator. */
  private onGuardUpdate(active: boolean): void {
    this.guardIndicator.setVisible(active);
    if (active) {
      this.tweens.killTweensOf(this.guardIndicator);
      this.tweens.add({
        targets: this.guardIndicator,
        alpha: { from: 0.7, to: 1.0 },
        duration: 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    } else {
      this.tweens.killTweensOf(this.guardIndicator);
      this.guardIndicator.setAlpha(1);
    }
  }

  /** §13 — Update weapon gauge bar (Edge, Frenzy, Flow, Charge). */
  private onWeaponGauge(data: WeaponGaugeData): void {
    const { family, edge, flow, frenzy, isBlunt } = data;

    // Hide gauge for ranged-only / no-gauge weapons
    const hasGauge = family && family !== 'bow' && family !== 'crossbow'
      && family !== 'staff' && family !== 'tome';
    this.gaugeRow.setVisible(!!hasGauge);
    if (!hasGauge) return;

    if (family === 'twin_daggers') {
      // Frenzy gauge: pips glow red when active
      this.gaugeBg.setFillStyle(0x220000);
      this.gaugeBar.setFillStyle(0xff2222);
      this.gaugeBar.width = BAR_W * (frenzy ? 1 : 0.1);
      this.gaugeLabel.setText(frenzy ? 'FRENZY' : '').setStyle({ color: '#ff4444' });
      this.gaugePips.forEach(p => p.setVisible(false));

    } else if (family === 'gauntlets') {
      // Flow stacks: pips
      this.gaugeBg.setFillStyle(0x001122);
      this.gaugeBar.setFillStyle(0x44ccff);
      this.gaugeBar.width = BAR_W * (flow / 5);
      this.gaugeLabel.setText(`FLOW ×${flow}`).setStyle({ color: '#44ccff' });
      this.gaugePips.forEach((p, i) => {
        p.setVisible(i < 5);
        p.setFillStyle(i < flow ? 0x44ccff : 0x112233);
      });

    } else if (family === 'greatsword') {
      // Charge gauge
      this.gaugeBg.setFillStyle(0x221100);
      this.gaugeBar.setFillStyle(0xffcc00);
      this.gaugeBar.width = BAR_W; // always full for now; charge is time-based
      this.gaugeLabel.setText('EDGE').setStyle({ color: '#ffcc00' });
      this.gaugePips.forEach(p => p.setVisible(false));

    } else {
      // Edge gauge (sword, mace, spear)
      const ratio = edge / 100;
      const barColor = isBlunt ? 0x666666 : (ratio > 0.5 ? 0xff8800 : 0xdd5500);
      this.gaugeBg.setFillStyle(0x221100);
      this.gaugeBar.setFillStyle(barColor);
      this.gaugeBar.width = BAR_W * ratio;
      const label = isBlunt ? 'BLUNT' : `EDGE ${Math.round(edge)}`;
      this.gaugeLabel.setText(label).setStyle({ color: isBlunt ? '#888888' : '#ff8822' });
      this.gaugePips.forEach(p => p.setVisible(false));
    }
  }

  /** §12 — Show/hide the unspent stat & skill points notification banner. */
  private updateStatBanner(data: { unspentStatPoints: number; unspentSkillPoints: number }): void {
    const statPts = data.unspentStatPoints;
    const skillPts = data.unspentSkillPoints;
    if (statPts > 0 || skillPts > 0) {
      let text = '';
      if (statPts > 0 && skillPts > 0) text = `⬆ ${statPts} STAT & ${skillPts} SKILL PTS AVAILABLE  (C)`;
      else if (statPts > 0) text = `⬆ ${statPts} STAT POINT${statPts > 1 ? 'S' : ''} AVAILABLE  (C)`;
      else text = `⬆ ${skillPts} SKILL POINT${skillPts > 1 ? 'S' : ''} AVAILABLE  (C)`;

      this.statBanner.setText(text);
      if (!this.statBanner.visible) {
        this.statBanner.setVisible(true).setAlpha(1);
        if (this.statBannerTween) this.statBannerTween.stop();
        this.statBannerTween = this.tweens.add({
          targets: this.statBanner,
          alpha: { from: 0.5, to: 1.0 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }
    } else {
      if (this.statBannerTween) { this.statBannerTween.stop(); this.statBannerTween = null; }
      this.statBanner.setVisible(false);
    }
  }

  private onAmmoUpdate(data: { ammoId: string; qty: number }): void {
    this.updateAmmoDisplay(data.ammoId, data.qty);
  }

  /** Update ammo count display (called externally when ammo changes). */
  updateAmmoDisplay(ammoId: string, qty: number): void {
    if (qty <= 0) {
      this.ammoText.setText('⚠ NO AMMO').setStyle({ color: '#ff4444' });
    } else {
      const label = ammoId === 'arrow' ? '🏹 Arrow' : '⤳ Bolt';
      this.ammoText.setText(`${label} ×${qty}`).setStyle({ color: '#88aacc' });
    }
  }

  private refreshHotbarFromSave(inventory: { itemId: string; qty: number }[]): void {
    const ids = ['health_potion', 'mana_potion', 'smoke_bomb', 'whetstone'];
    const slots = ids.map(id => {
      const stack = inventory.find(s => s.itemId === id);
      return { label: '', qty: stack?.qty ?? 0 };
    });
    this.onHotbarUpdate({ slots });
  }

  private setHp(cur: number, max: number): void {
    this.hpBar.width = BAR_W * Math.max(0, cur / max);
    this.hpText.setText(`${cur}/${max}`);
  }

  private setStam(cur: number, max: number): void {
    this.stamBar.width = BAR_W * Math.max(0, cur / max);
    this.stamText.setText(`${Math.floor(cur)}/${max}`);
  }

  private setMp(cur: number, max: number): void {
    this.mpBar.width = BAR_W * Math.max(0, cur / max);
    this.mpText.setText(`${cur}/${max}`);
  }

  private setExp(exp: number, level: number): void {
    const needed = expForLevel(level);
    this.expBar.width = BAR_W * Math.min(1, exp / needed);
    this.expText.setText(`Lv${level} ${exp}/${needed}`);
  }

  update(time: number, delta: number): void {
    if (!this.playerRef) return;

    const skillKeys = ['R', 'F', 'V'] as const;
    const classKey = this.playerRef.classKey;

    for (let i = 0; i < 3; i++) {
      const slotKey = skillKeys[i];
      const slot = this.skillSlots[i];
      let skillId = '';
      let maxCdMs = 0;
      let name = '';

      if (slotKey === 'R') {
        if (classKey === 'swordman') {
          skillId = 'sword_riposte_stance'; maxCdMs = 6000; name = 'Riposte';
        } else if (classKey === 'archer') {
          skillId = 'arch_coating_cycle'; maxCdMs = 0; name = 'Coating';
        } else if (classKey === 'tanker') {
          skillId = 'tank_bastion_mode'; maxCdMs = 1500; name = 'Bastion';
        } else if (classKey === 'assassin') {
          skillId = 'assa_vanish'; maxCdMs = 8000; name = 'Vanish';
        } else if (classKey === 'sage') {
          skillId = 'sage_element_swap'; maxCdMs = 0; name = 'Element';
        }
      } else if (slotKey === 'F') {
        const fMap: Record<string, string> = {
          swordman: 'sword_b1_t4',
          archer: 'arch_b2_t2',
          tanker: 'tank_b2_t2',
          assassin: 'assa_b2_t2',
          sage: 'sage_b2_t2',
        };
        skillId = fMap[classKey];
        if (classKey === 'swordman') { maxCdMs = 4000; name = 'Thrust'; }
        else if (classKey === 'archer') { maxCdMs = 6000; name = 'Rain'; }
        else if (classKey === 'tanker') { maxCdMs = 5000; name = 'Slam'; }
        else if (classKey === 'assassin') { maxCdMs = 5000; name = 'Dart'; }
        else if (classKey === 'sage') { maxCdMs = 5000; name = 'Blast'; }
      } else if (slotKey === 'V') {
        const vMap: Record<string, string> = {
          swordman: 'sword_cap',
          archer: 'arch_cap',
          tanker: 'tank_cap',
          assassin: 'assa_cap',
          sage: 'sage_cap',
        };
        skillId = vMap[classKey];
        if (classKey === 'swordman') { maxCdMs = 45000; name = 'Tempo'; }
        else if (classKey === 'archer') { maxCdMs = 60000; name = 'Focus'; }
        else if (classKey === 'tanker') { maxCdMs = 80000; name = 'Bulwark'; }
        else if (classKey === 'assassin') { maxCdMs = 60000; name = 'DeathMk'; }
        else if (classKey === 'sage') { maxCdMs = 70000; name = 'Deton'; }
      }

      const isUnlocked = slotKey === 'R' || this.playerRef.isSkillUnlocked(skillId);

      if (!isUnlocked) {
        slot.label.setText(`${slotKey}:--\nLocked`);
        slot.bg.setFillStyle(0x0a070e, 0.92);
        slot.cooldownOverlay.height = 0;
      } else {
        const cdLeft = this.playerRef.skillCooldowns.get(skillId) ?? 0;
        if (cdLeft > 0 && maxCdMs > 0) {
          const ratio = cdLeft / maxCdMs;
          const SLOT_H = 30;
          slot.cooldownOverlay.height = SLOT_H * ratio;
          const secs = (cdLeft / 1000).toFixed(1);
          slot.label.setText(`${slotKey}:${name}\n${secs}s`);
          slot.bg.setFillStyle(0x2a1515, 0.92);
        } else {
          slot.cooldownOverlay.height = 0;

          let suffix = '';
          if (slotKey === 'R') {
            if (classKey === 'archer') {
              suffix = `\n(${this.playerRef.activeCoating})`;
            } else if (classKey === 'sage') {
              suffix = `\n(${this.playerRef.activeElement})`;
            } else if (classKey === 'tanker' && this.playerRef.bastionModeActive) {
              suffix = '\n(Active)';
            } else if (classKey === 'assassin' && this.playerRef.stealthActive) {
              suffix = '\n(Stealth)';
            } else if (classKey === 'swordman' && this.playerRef.riposteStanceMs > 0) {
              suffix = '\n(Parry)';
            }
          }

          slot.label.setText(`${slotKey}:${name}${suffix}`);
          slot.bg.setFillStyle(0x1e1530, 0.92);
        }
      }
    }

    // §15 Player active ailments drawing
    this.ailmentGraphics.clear();
    this.ailmentTexts.forEach(t => t.setVisible(false));

    let index = 0;
    const startX = PAD;
    const startY = PAD + 60;
    const SPACING = 20;

    for (const [id, ms] of this.playerRef.activeAilments.entries()) {
      if (ms <= 0) continue;
      const ailmentId = id as Ailment;
      const cfg = AILMENT_CONFIGS[ailmentId];
      if (!cfg) continue;

      if (!this.ailmentTexts[index]) {
        this.ailmentTexts[index] = this.add.text(0, 0, '', { fontSize: '10px' }).setScrollFactor(0);
      }
      const txt = this.ailmentTexts[index];
      txt.setPosition(startX + index * SPACING, startY);
      txt.setText(cfg.icon);
      txt.setVisible(true);

      const bx = startX + index * SPACING;
      const by = startY + 12;
      const barW = 12;
      const barH = 2;
      const ratio = ailmentId === 'curse' ? 1.0 : ms / cfg.durationMs;

      this.ailmentGraphics.fillStyle(0x333333, 0.7);
      this.ailmentGraphics.fillRect(bx, by, barW, barH);

      this.ailmentGraphics.fillStyle(cfg.color, 1.0);
      this.ailmentGraphics.fillRect(bx, by, barW * ratio, barH);

      index++;
    }
  }
}
