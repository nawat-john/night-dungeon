import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';
import { expForLevel, TILE } from '../config';
import { WeaponFamily } from '../data/movesets';
import { Ailment, AILMENT_CONFIGS } from '../systems/StatusSystem';
import { AudioManager } from '../systems/AudioManager';

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
  private skillSlots: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; cooldownOverlay: Phaser.GameObjects.Rectangle; pip: Phaser.GameObjects.Arc }[] = [];

  // §15 Player ailments HUD indicators
  private ailmentGraphics!: Phaser.GameObjects.Graphics;
  private ailmentTexts: Phaser.GameObjects.Text[] = [];
  private ailmentTooltip: Phaser.GameObjects.Container | null = null;

  // §19 Boss HP bar
  private bossSection!: Phaser.GameObjects.Container;
  private bossName!: Phaser.GameObjects.Text;
  private bossHpBg!: Phaser.GameObjects.Rectangle;
  private bossHpBar!: Phaser.GameObjects.Rectangle;
  private bossHpText!: Phaser.GameObjects.Text;
  private bossPhaseText!: Phaser.GameObjects.Text;
  private bossWeaknessText!: Phaser.GameObjects.Text;  // §P11 weakness hint at Research Lv2
  private bossPips: Phaser.GameObjects.Rectangle[] = [];

  // §20 Anomaly whisper
  private anomalyWhisper!: Phaser.GameObjects.Text;
  private anomalyWhisperTween: Phaser.Tweens.Tween | null = null;

  // §22 Companion HUD rows
  private companionRows: Phaser.GameObjects.Container[] = [];

  // §27 Minimap
  private minimapContainer!: Phaser.GameObjects.Container;
  private minimapGraphics!: Phaser.GameObjects.Graphics;

  // §27 Map overlay
  private mapOverlayContainer!: Phaser.GameObjects.Container;
  private mapOverlayGraphics!: Phaser.GameObjects.Graphics;
  private mapKey!: Phaser.Input.Keyboard.Key;

  private settingsButton!: Phaser.GameObjects.Text;
  private captionText!: Phaser.GameObjects.Text;
  private captionTween: Phaser.Tweens.Tween | null = null;
  // §P11 Specialization label
  private specializationLabel!: Phaser.GameObjects.Text;

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

    // §19 Boss HP bar — centered at top
    this.buildBossSection();

    // §27 Minimap
    this.buildMinimap();
    this.buildMapOverlay();

    // §20 Anomaly whisper text — bottom center, initially hidden
    this.anomalyWhisper = this.add.text(0, 0, '', {
      fontSize: '9px', color: '#cc88ff', align: 'center',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setAlpha(0).setDepth(20);

    // Settings button
    this.settingsButton = this.add.text(0, 0, '⚙', {
      fontSize: '14px', color: '#998bbb'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.settingsButton.on('pointerdown', () => this.showSettings());
    this.settingsButton.on('pointerover', () => this.settingsButton.setColor('#ffffff'));
    this.settingsButton.on('pointerout', () => this.settingsButton.setColor('#998bbb'));

    // Caption text
    this.captionText = this.add.text(0, 0, '', {
      fontSize: '10px',
      color: '#ffffff',
      align: 'center',
      backgroundColor: '#00000088',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setVisible(false);

    // §P11 Specialization label (below weapon text)
    this.specializationLabel = this.add.text(0, 0, '', {
      fontSize: '8px', color: '#ffaa33',
    }).setOrigin(0, 0).setDepth(8).setVisible(false);

    this.game.events.on('hud-update',           this.onHudUpdate,        this);
    this.game.events.on('floor-update',         this.onFloorUpdate,      this);
    this.game.events.on('weapon-switch',        this.onWeaponSwitch,     this);
    this.game.events.on('hotbar-update',        this.onHotbarUpdate,     this);
    this.game.events.on('guard-update',         this.onGuardUpdate,      this);
    this.game.events.on('weapon-gauge',         this.onWeaponGauge,      this);
    this.game.events.on('ammo-update',          this.onAmmoUpdate,       this);
    this.game.events.on('boss-update',          this.onBossUpdate,       this);
    this.game.events.on('anomaly-whisper',      this.onAnomalyWhisper,   this);
    this.game.events.on('companion-hud-update', this.onCompanionUpdate,  this);
    this.game.events.on('audio-caption',        this.onAudioCaption,     this);
    this.game.events.on('specialization-update', (d: { name: string }) => {
      this.specializationLabel.setText(`[${d.name.toUpperCase()}]`).setVisible(true);
    }, this);
    this.events.once('shutdown', () => {
      this.game.events.off('hud-update',           this.onHudUpdate,        this);
      this.game.events.off('floor-update',         this.onFloorUpdate,      this);
      this.game.events.off('weapon-switch',        this.onWeaponSwitch,     this);
      this.game.events.off('hotbar-update',        this.onHotbarUpdate,     this);
      this.game.events.off('guard-update',         this.onGuardUpdate,      this);
      this.game.events.off('weapon-gauge',         this.onWeaponGauge,      this);
      this.game.events.off('ammo-update',          this.onAmmoUpdate,       this);
      this.game.events.off('boss-update',          this.onBossUpdate,       this);
      this.game.events.off('anomaly-whisper',      this.onAnomalyWhisper,   this);
      this.game.events.off('companion-hud-update', this.onCompanionUpdate,  this);
      this.game.events.off('audio-caption',        this.onAudioCaption,     this);
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
      // §P11 — Show active specialization label if present
      if (save.specialization) {
        const specName = save.specialization.includes(':')
          ? save.specialization.split(':')[0]
          : save.specialization;
        this.specializationLabel.setText(`[${specName.toUpperCase()}]`).setVisible(true);
      }
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
      const pip = this.add.circle(0, 0, 3, 0x555555)
        .setScrollFactor(0)
        .setDepth(8);
      this.skillSlots.push({ bg, label, cooldownOverlay, pip });
    }
  }

  private buildBossSection(): void {
    const BW = 280, BH = 10, BX = 0, BY = 0;
    this.bossSection = this.add.container(BX, BY).setDepth(12).setVisible(false);

    this.bossName = this.add.text(0, -2, '', {
      fontSize: '9px', color: '#ffcc55', stroke: '#330000', strokeThickness: 2,
    }).setOrigin(0.5, 1);

    this.bossHpBg  = this.add.rectangle(0, 0, BW, BH, 0x330000).setOrigin(0.5, 0);
    this.bossHpBar = this.add.rectangle(0, 0, BW, BH, 0xcc2222).setOrigin(0.5, 0);
    this.bossHpText = this.add.text(BW / 2 + 4, 1, '', { fontSize: '7px', color: '#cc4444' }).setOrigin(0, 0);
    this.bossPhaseText = this.add.text(-BW / 2 - 4, 1, '', { fontSize: '7px', color: '#888888' }).setOrigin(1, 0);
    // §P11 — Weakness hint (shown at Research Lv2+)
    this.bossWeaknessText = this.add.text(0, BH + 2, '', { fontSize: '6px', color: '#ffaa33' }).setOrigin(0.5, 0);

    this.bossSection.add([this.bossName, this.bossHpBg, this.bossHpBar, this.bossHpText, this.bossPhaseText, this.bossWeaknessText]);
  }

  private onBossUpdate(data: {
    visible: boolean; name: string; hp: number; maxHp: number;
    phaseIdx: number; phaseCount: number;
    bossId?: string; phaseElemFamily?: string;
    parts: { id: string; name: string; broken: boolean }[];
  }): void {
    this.bossSection.setVisible(data.visible);
    if (!data.visible) return;

    const BW = 280;
    this.bossName.setText(data.name);
    const ratio = Math.max(0, data.hp / data.maxHp);
    this.bossHpBar.width = BW * ratio;
    this.bossHpBar.setFillStyle(ratio > 0.5 ? 0xcc2222 : ratio > 0.25 ? 0xdd6611 : 0xff4444);
    this.bossHpText.setText(`${data.hp}/${data.maxHp}`);
    this.bossPhaseText.setText(data.phaseCount > 1 ? `P${data.phaseIdx + 1}/${data.phaseCount}` : '');

    // §P11 — Weakness reveal at Research Lv2+
    const meta = SaveManager.loadAccountMeta();
    const save = SaveManager.load();
    const wrongfooted = save?.wrongfooted ?? false;
    const resEntry = data.bossId ? meta.research?.find(r => r.enemyId === data.bossId) : null;
    const resLvl = resEntry?.level ?? 0;
    if (resLvl >= 2 && data.phaseElemFamily && !wrongfooted) {
      // Map elem family to its weakness (approximate from common knowledge)
      const weakMap: Record<string, string> = {
        fire: '💧 ICE', ice: '⚡ LIGHTNING', lightning: '🌿 RADIANT',
        void: '✨ RADIANT', beast: '🗡 SLASH', undead: '✨ RADIANT',
        spirit: '🔮 VOID', construct: '🔨 BLUNT', armored: '🔨 BLUNT',
      };
      const weak = weakMap[data.phaseElemFamily];
      this.bossWeaknessText.setText(weak ? `⚠ WEAK: ${weak}` : '').setVisible(!!weak);
    } else {
      this.bossWeaknessText.setText('');
    }

    // Rebuild part pips
    this.bossPips.forEach(p => p.destroy());
    this.bossPips = [];
    const pipW = 36, pipH = 6, gap = 4;
    const totalPipW = data.parts.length * pipW + (data.parts.length - 1) * gap;
    const startX = -totalPipW / 2;
    data.parts.forEach((part, i) => {
      const pip = this.add.rectangle(startX + i * (pipW + gap) + pipW / 2, 14, pipW, pipH,
        part.broken ? 0x444444 : 0xff8800)
        .setStrokeStyle(1, part.broken ? 0x222222 : 0xffcc00);
      this.bossPips.push(pip);
      this.bossSection.add(pip);

      // Part label
      const lbl = this.add.text(startX + i * (pipW + gap) + pipW / 2, 14, part.name.substring(0, 6),
        { fontSize: '5px', color: part.broken ? '#444444' : '#ffffff' }).setOrigin(0.5);
      this.bossSection.add(lbl);
    });
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
    this.specializationLabel.setPosition(PAD, PAD + 67);
    this.settingsButton.setPosition(w - PAD - 55, PAD - 2);
    this.captionText.setPosition(w / 2, h - 90);

    // §19 Boss bar — top center, below floor text
    this.bossSection.setPosition(w / 2, PAD + 26);

    // Guard indicator — top-right, under gold
    this.guardIndicator.setPosition(w - PAD, PAD + 18);

    // §27 Minimap positioning — under guard indicator
    this.minimapContainer.setPosition(w - PAD - 75, PAD + 36);

    // Stat banner — top center, below floor text
    this.statBanner.setPosition(w / 2, PAD + 18);

    // §20 Anomaly whisper — just above hint text
    this.anomalyWhisper.setPosition(w / 2, h - PAD - 18);

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
      slot.pip.setPosition(x + SLOT_W / 2 - 6, slotY - SLOT_H / 2 + 6);
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
    this.drawMinimap(time);
    this.drawMapOverlay();
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
        slot.pip.setFillStyle(0x555555);
      } else {
        const cdLeft = this.playerRef.skillCooldowns.get(skillId) ?? 0;
        if (cdLeft > 0 && maxCdMs > 0) {
          const ratio = cdLeft / maxCdMs;
          const SLOT_H = 30;
          slot.cooldownOverlay.height = SLOT_H * ratio;
          const secs = (cdLeft / 1000).toFixed(1);
          slot.label.setText(`${slotKey}:${name}\n${secs}s`);
          slot.bg.setFillStyle(0x2a1515, 0.92);
          slot.pip.setFillStyle(0xff3333);
        } else {
          slot.cooldownOverlay.height = 0;
          slot.pip.setFillStyle(0x33ff33);
          let suffix = '';
          if (slotKey === 'R') {
            if (classKey === 'archer' && this.playerRef.activeCoating !== 'none') {
              suffix = `\n(${this.playerRef.activeCoating})`;
            } else if (classKey === 'sage') {
              suffix = `\n(${this.playerRef.activeElement})`;
            } else if (classKey === 'tanker' && this.playerRef.bastionModeActive) {
              suffix = '\n(Bastion)';
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
    const SPACING = 28;

    const AILMENT_DESCRIPTIONS: Record<string, string> = {
      poison: 'Deals 3 flat damage/sec. Ignores 50% defense.',
      bleed: 'Deals 2 flat damage/sec. Increased to 5 while moving.',
      burn: 'Deals 4 damage/sec, defense is reduced by 30%. Roll (Z) to extinguish.',
      chill: 'Reduces movement speed by 30%.',
      frozen: 'Stunned completely. Mash keys to escape.',
      shock: 'Deals 15 damage/sec & periodically staggers/interrupts.',
      stun: 'Stunned. Unable to move or act. Mash keys to recover.',
      curse: 'Reduces maximum HP by 25%. Cleanse at Chapel.',
      webbed: 'Rooted in place. Cannot move.',
      wet: 'Amplifies lightning damage taken by 50%, reduces fire damage by 50%.'
    };

    for (const [id, ms] of this.playerRef.activeAilments.entries()) {
      if (ms <= 0) continue;
      const ailmentId = id as Ailment;
      const cfg = AILMENT_CONFIGS[ailmentId];
      if (!cfg) continue;

      if (!this.ailmentTexts[index]) {
        this.ailmentTexts[index] = this.add.text(0, 0, '', { fontSize: '7px' }).setScrollFactor(0);
      }
      const txt = this.ailmentTexts[index];
      txt.setPosition(startX + index * SPACING, startY);
      
      const sec = Math.ceil(ms / 1000);
      const timerStr = ailmentId === 'curse' ? '∞' : `${sec}s`;
      txt.setText(`${cfg.icon} ${timerStr}`);
      txt.setVisible(true);
      txt.setInteractive({ useHandCursor: true });
      txt.off('pointerover');
      txt.off('pointerout');
      txt.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        const desc = AILMENT_DESCRIPTIONS[ailmentId] || '';
        this.showAilmentTooltip(pointer, cfg.name, cfg.icon, desc);
      });
      txt.on('pointerout', () => {
        this.hideAilmentTooltip();
      });

      const bx = startX + index * SPACING;
      const by = startY + 12;
      const barW = 16;
      const barH = 2;
      const ratio = ailmentId === 'curse' ? 1.0 : ms / cfg.durationMs;

      this.ailmentGraphics.fillStyle(0x333333, 0.7);
      this.ailmentGraphics.fillRect(bx, by, barW, barH);

      this.ailmentGraphics.fillStyle(cfg.color, 1.0);
      this.ailmentGraphics.fillRect(bx, by, barW * ratio, barH);

      index++;
    }
  }

  // §20 Anomaly whisper
  private onAnomalyWhisper(text: string): void {
    if (this.anomalyWhisperTween) {
      this.anomalyWhisperTween.stop();
      this.anomalyWhisperTween = null;
    }
    this.anomalyWhisper.setText(text).setAlpha(1);
    this.anomalyWhisperTween = this.tweens.add({
      targets: this.anomalyWhisper,
      alpha: 0,
      delay: 4000,
      duration: 2000,
      onComplete: () => { this.anomalyWhisperTween = null; },
    });
  }

  // §22 Companion HUD
  private onCompanionUpdate(companions: import('../types').CompanionSaveData[]): void {
    for (const row of this.companionRows) row.destroy();
    this.companionRows = [];

    const sw = this.scale.width;
    companions.forEach((c, i) => {
      const x = sw - 10;
      const y = PAD + 120 + i * 36;
      const row = this.add.container(x, y).setDepth(8);

      const bg = this.add.rectangle(-65, 0, 120, 30, 0x0a1510, 0.85).setOrigin(0);
      const nameT = this.add.text(-62, 2, `${c.name}  [${c.command.toUpperCase()}]`, {
        fontSize: '6px', color: '#aaffaa',
      }).setOrigin(0);

      // HP bar
      const hpFrac = Math.max(0, Math.min(1, c.currentHp / c.maxHp));
      const hpBg = this.add.rectangle(-62, 12, 80, 5, 0x331111).setOrigin(0);
      const hpBar = this.add.rectangle(-62, 12, Math.round(80 * hpFrac), 5, 0xcc3333).setOrigin(0);
      const hpT   = this.add.text(-62, 18, `${Math.round(c.currentHp)}/${c.maxHp}  Ftg:${Math.round(c.fatigue)}%`, {
        fontSize: '5px', color: '#888888',
      }).setOrigin(0);

      row.add([bg, nameT, hpBg, hpBar, hpT]);
      this.companionRows.push(row);
    });
  }

  private showAilmentTooltip(pointer: Phaser.Input.Pointer, name: string, icon: string, desc: string): void {
    if (this.ailmentTooltip) this.ailmentTooltip.destroy();

    this.ailmentTooltip = this.add.container(0, 0).setDepth(100).setScrollFactor(0);
    const title = this.add.text(6, 4, `${icon} ${name}`, { fontSize: '8px', color: '#ff5555', fontStyle: 'bold' });
    const text = this.add.text(6, 14, desc, { fontSize: '6px', color: '#ccbbee', wordWrap: { width: 120 } });

    const boxW = 132;
    const boxH = text.height + 20;

    const bg = this.add.rectangle(0, 0, boxW, boxH, 0x05040a, 0.95).setOrigin(0).setStrokeStyle(1, 0x553377);
    this.ailmentTooltip.add([bg, title, text]);

    this.ailmentTooltip.setPosition(pointer.x + 10, pointer.y + 10);
  }

  private hideAilmentTooltip(): void {
    if (this.ailmentTooltip) {
      this.ailmentTooltip.destroy();
      this.ailmentTooltip = null;
    }
  }

  private buildMinimap(): void {
    this.minimapContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(15);
    const bg = this.add.rectangle(0, 0, 75, 75, 0x05040a, 0.95).setOrigin(0).setStrokeStyle(1.5, 0x553377);
    this.minimapGraphics = this.add.graphics().setDepth(1);
    this.minimapContainer.add([bg, this.minimapGraphics]);
  }

  private drawMinimap(time: number): void {
    if (!this.minimapGraphics) return;
    this.minimapGraphics.clear();

    const dungeon = this.scene.get('DungeonScene') as any;
    if (!dungeon || !dungeon.sys.isActive() || !dungeon.player || dungeon.location !== 'dungeon') {
      this.minimapContainer.setVisible(false);
      return;
    }
    this.minimapContainer.setVisible(true);

    const px = Math.floor(dungeon.player.x / 32);
    const py = Math.floor(dungeon.player.y / 32);
    const mapCols = dungeon.mapCols;
    const mapRows = dungeon.mapRows;
    const visibility = dungeon.visibility;
    const tiles = dungeon.tiles;

    if (!tiles || tiles.length === 0 || !visibility) return;

    const GRID_SIZE = 15;
    const CELL_SIZE = 5;
    const HALF_GRID = Math.floor(GRID_SIZE / 2);

    for (let dy = -HALF_GRID; dy <= HALF_GRID; dy++) {
      for (let dx = -HALF_GRID; dx <= HALF_GRID; dx++) {
        const tx = px + dx;
        const ty = py + dy;

        if (tx >= 0 && tx < mapCols && ty >= 0 && ty < mapRows) {
          const vis = visibility[ty * mapCols + tx];
          if (vis === 2 || vis === 1) { // VIS_VISIBLE (2) or VIS_EXPLORED (1)
            const tileId = tiles[ty][tx];
            const isFloor = tileId === 1 || (tileId >= 10 && tileId <= 13);
            const isWall = !isFloor;
            const cx = (dx + HALF_GRID) * CELL_SIZE;
            const cy = (dy + HALF_GRID) * CELL_SIZE;

            if (isWall) {
              this.minimapGraphics.fillStyle(0x3a2c55, 1);
            } else {
              this.minimapGraphics.fillStyle(vis === 2 ? 0x2b1d4a : 0x1e1530, 1);
            }
            this.minimapGraphics.fillRect(cx, cy, CELL_SIZE, CELL_SIZE);
          }
        }
      }
    }

    // Draw other entities on the map
    // Player - centered
    const center = HALF_GRID * CELL_SIZE + CELL_SIZE / 2;
    this.minimapGraphics.fillStyle(0x33ff33, 1);
    this.minimapGraphics.fillCircle(center, center, 2);

    // Warp Pads
    if (dungeon.warpPads) {
      for (const wp of dungeon.warpPads) {
        const wCol = Math.floor(wp.x / 32);
        const wRow = Math.floor(wp.y / 32);
        const dx = wCol - px;
        const dy = wRow - py;
        if (Math.abs(dx) <= HALF_GRID && Math.abs(dy) <= HALF_GRID) {
          if (visibility[wRow * mapCols + wCol] > 0) {
            const cx = (dx + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            const cy = (dy + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            this.minimapGraphics.fillStyle(0x4488ff, 1);
            this.minimapGraphics.fillCircle(cx, cy, 2);
          }
        }
      }
    }

    // Campsites
    if (dungeon.floorData && dungeon.floorData.campPositions) {
      for (const cp of dungeon.floorData.campPositions) {
        const dx = cp.col - px;
        const dy = cp.row - py;
        if (Math.abs(dx) <= HALF_GRID && Math.abs(dy) <= HALF_GRID) {
          if (visibility[cp.row * mapCols + cp.col] > 0) {
            const cx = (dx + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            const cy = (dy + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            this.minimapGraphics.fillStyle(0xff8800, 1);
            this.minimapGraphics.fillCircle(cx, cy, 2);
          }
        }
      }
    }

    // Anomalies
    if (dungeon.anomalyProps) {
      for (const prop of dungeon.anomalyProps) {
        if (prop.interacted) continue;
        const dx = prop.col - px;
        const dy = prop.row - py;
        if (Math.abs(dx) <= HALF_GRID && Math.abs(dy) <= HALF_GRID) {
          if (visibility[prop.row * mapCols + prop.col] > 0) {
            const cx = (dx + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            const cy = (dy + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            this.minimapGraphics.fillStyle(0xcc88ff, 1);
            this.minimapGraphics.fillCircle(cx, cy, 2);
          }
        }
      }
    }
  }

  private buildMapOverlay(): void {
    this.mapKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.mapOverlayContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(25).setVisible(false);

    // Large backdrop panel for map overlay
    const sw = this.scale.width;
    const sh = this.scale.height;
    const bg = this.add.rectangle(sw / 2, sh / 2, sw * 0.8, sh * 0.8, 0x05040a, 0.95)
      .setStrokeStyle(1.5, 0x553377);
    
    const title = this.add.text(sw / 2, sh / 2 - sh * 0.36, '— FLOOR MAP —', {
      fontSize: '10px',
      color: '#aaddff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.mapOverlayGraphics = this.add.graphics();

    this.mapOverlayContainer.add([bg, title, this.mapOverlayGraphics]);
  }

  private drawMapOverlay(): void {
    if (!this.mapOverlayGraphics) return;
    this.mapOverlayGraphics.clear();

    const dungeon = this.scene.get('DungeonScene') as any;
    if (!dungeon || !dungeon.sys.isActive() || !dungeon.player || dungeon.location !== 'dungeon') {
      this.mapOverlayContainer.setVisible(false);
      return;
    }

    // Toggle visibility based on map key hold
    const isMapKeyDown = this.mapKey && this.mapKey.isDown;
    this.mapOverlayContainer.setVisible(isMapKeyDown);
    if (!isMapKeyDown) return;

    const px = Math.floor(dungeon.player.x / 32);
    const py = Math.floor(dungeon.player.y / 32);
    const mapCols = dungeon.mapCols;
    const mapRows = dungeon.mapRows;
    const visibility = dungeon.visibility;
    const tiles = dungeon.tiles;

    if (!tiles || tiles.length === 0 || !visibility) return;

    const GRID_SIZE = 61;
    const CELL_SIZE = 3;
    const HALF_GRID = Math.floor(GRID_SIZE / 2);

    const sw = this.scale.width;
    const sh = this.scale.height;
    
    // Reposition the overlay elements dynamically
    const bg = this.mapOverlayContainer.getAt(0) as Phaser.GameObjects.Rectangle;
    const title = this.mapOverlayContainer.getAt(1) as Phaser.GameObjects.Text;

    bg.setPosition(sw / 2, sh / 2);
    bg.setSize(sw * 0.8, sh * 0.8);
    title.setPosition(sw / 2, sh / 2 - sh * 0.36);

    // Calculate the start position to draw inside the overlay container
    const startX = sw / 2 - (GRID_SIZE * CELL_SIZE) / 2;
    const startY = sh / 2 - (GRID_SIZE * CELL_SIZE) / 2;

    for (let dy = -HALF_GRID; dy <= HALF_GRID; dy++) {
      for (let dx = -HALF_GRID; dx <= HALF_GRID; dx++) {
        const tx = px + dx;
        const ty = py + dy;

        if (tx >= 0 && tx < mapCols && ty >= 0 && ty < mapRows) {
          const vis = visibility[ty * mapCols + tx];
          if (vis === 2 || vis === 1) { // VIS_VISIBLE (2) or VIS_EXPLORED (1)
            const tileId = tiles[ty][tx];
            const isFloor = tileId === 1 || (tileId >= 10 && tileId <= 13);
            const isWall = !isFloor;
            const cx = startX + (dx + HALF_GRID) * CELL_SIZE;
            const cy = startY + (dy + HALF_GRID) * CELL_SIZE;

            if (isWall) {
              this.mapOverlayGraphics.fillStyle(0x3a2c55, 1);
            } else {
              this.mapOverlayGraphics.fillStyle(vis === 2 ? 0x2b1d4a : 0x1e1530, 1);
            }
            this.mapOverlayGraphics.fillRect(cx, cy, CELL_SIZE, CELL_SIZE);
          }
        }
      }
    }

    // Draw player in the center of the overlay
    const centerIdx = HALF_GRID * CELL_SIZE + CELL_SIZE / 2;
    this.mapOverlayGraphics.fillStyle(0x33ff33, 1);
    this.mapOverlayGraphics.fillCircle(startX + centerIdx, startY + centerIdx, 3);

    // Draw other landmarks if within the grid bounds and explored
    // Warp Pads
    if (dungeon.warpPads) {
      for (const wp of dungeon.warpPads) {
        const wCol = Math.floor(wp.x / 32);
        const wRow = Math.floor(wp.y / 32);
        const dx = wCol - px;
        const dy = wRow - py;
        if (Math.abs(dx) <= HALF_GRID && Math.abs(dy) <= HALF_GRID) {
          if (visibility[wRow * mapCols + wCol] > 0) {
            const cx = startX + (dx + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            const cy = startY + (dy + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            this.mapOverlayGraphics.fillStyle(0x4488ff, 1);
            this.mapOverlayGraphics.fillCircle(cx, cy, 3);
          }
        }
      }
    }

    // Campsites
    if (dungeon.floorData && dungeon.floorData.campPositions) {
      for (const cp of dungeon.floorData.campPositions) {
        const dx = cp.col - px;
        const dy = cp.row - py;
        if (Math.abs(dx) <= HALF_GRID && Math.abs(dy) <= HALF_GRID) {
          if (visibility[cp.row * mapCols + cp.col] > 0) {
            const cx = startX + (dx + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            const cy = startY + (dy + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            this.mapOverlayGraphics.fillStyle(0xff8800, 1);
            this.mapOverlayGraphics.fillCircle(cx, cy, 3);
          }
        }
      }
    }

    // Anomalies
    if (dungeon.anomalyProps) {
      for (const prop of dungeon.anomalyProps) {
        if (prop.interacted) continue;
        const dx = prop.col - px;
        const dy = prop.row - py;
        if (Math.abs(dx) <= HALF_GRID && Math.abs(dy) <= HALF_GRID) {
          if (visibility[prop.row * mapCols + prop.col] > 0) {
            const cx = startX + (dx + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            const cy = startY + (dy + HALF_GRID) * CELL_SIZE + CELL_SIZE / 2;
            this.mapOverlayGraphics.fillStyle(0xcc88ff, 1);
            this.mapOverlayGraphics.fillCircle(cx, cy, 3);
          }
        }
      }
    }
  }

  private onAudioCaption(text: string): void {
    this.captionText.setText(text).setVisible(true).setAlpha(1);
    if (this.captionTween) {
      this.captionTween.stop();
    }
    this.captionTween = this.tweens.add({
      targets: this.captionText,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => {
        this.captionText.setVisible(false);
        this.captionTween = null;
      }
    });
  }

  private showSettings(): void {
    const { width, height } = this.cameras.main;
    const bw = width * 0.52;
    const bh = 154;
    const cx = width / 2;
    const cy = height / 2;

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.82).setOrigin(0).setDepth(100);
    const box = this.add.rectangle(cx, cy, bw, bh, 0x0e091a).setStrokeStyle(1.5, 0x8866cc).setDepth(101);
    
    const title = this.add.text(cx, cy - bh / 2 + 10, '— SETTINGS —', {
      fontSize: '11px', color: '#aaddff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102);

    const items: Phaser.GameObjects.Text[] = [];

    const drawSettingsList = () => {
      items.forEach(t => t.destroy());
      items.length = 0;

      const yStart = cy - bh / 2 + 28;
      const lineH = 16;

      // Master Volume
      const masterStr = `Master Volume: [ ${Math.round(AudioManager.masterVol * 100)}% ]`;
      const masterT = this.add.text(cx, yStart, masterStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
      masterT.on('pointerdown', () => {
        AudioManager.masterVol = (AudioManager.masterVol + 0.25) > 1.01 ? 0 : AudioManager.masterVol + 0.25;
        AudioManager.applyVolumes();
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // Music Volume
      const musicStr = `Music Volume:  [ ${Math.round(AudioManager.musicVol * 100)}% ]`;
      const musicT = this.add.text(cx, yStart + lineH, musicStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
      musicT.on('pointerdown', () => {
        AudioManager.musicVol = (AudioManager.musicVol + 0.25) > 1.01 ? 0 : AudioManager.musicVol + 0.25;
        AudioManager.applyVolumes();
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // SFX Volume
      const sfxStr = `SFX Volume:    [ ${Math.round(AudioManager.sfxVol * 100)}% ]`;
      const sfxT = this.add.text(cx, yStart + 2 * lineH, sfxStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
      sfxT.on('pointerdown', () => {
        AudioManager.sfxVol = (AudioManager.sfxVol + 0.25) > 1.01 ? 0 : AudioManager.sfxVol + 0.25;
        AudioManager.applyVolumes();
        AudioManager.saveSettings();
        AudioManager.playSFX('hit');
        drawSettingsList();
      });

      // Mute Toggle
      const muteStr = `Mute Audio:    [ ${AudioManager.isMuted ? 'MUTED' : 'ACTIVE'} ]`;
      const muteT = this.add.text(cx, yStart + 3 * lineH, muteStr, { fontSize: '8px', color: AudioManager.isMuted ? '#ff5555' : '#55ff55' })
        .setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
      muteT.on('pointerdown', () => {
        AudioManager.isMuted = !AudioManager.isMuted;
        AudioManager.applyVolumes();
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // Closed Captions Toggle
      const ccStr = `Visual Captions: [ ${AudioManager.closedCaptions ? 'ON' : 'OFF'} ]`;
      const ccT = this.add.text(cx, yStart + 4 * lineH, ccStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
      ccT.on('pointerdown', () => {
        AudioManager.closedCaptions = !AudioManager.closedCaptions;
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // Audio Cues Only Toggle
      const cuesStr = `Audio Cues Only: [ ${AudioManager.audioCuesOnly ? 'ON' : 'OFF'} ]`;
      const cuesT = this.add.text(cx, yStart + 5 * lineH, cuesStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
      cuesT.on('pointerdown', () => {
        AudioManager.audioCuesOnly = !AudioManager.audioCuesOnly;
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // Back Button
      const back = this.add.text(cx, cy + bh / 2 - 14, '← BACK', {
        fontSize: '9px', color: '#888888', backgroundColor: '#181224', padding: { x: 8, y: 3 }
      }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
      back.on('pointerdown', () => {
        [overlay, box, title, back, ...items].forEach(o => o.destroy());
      });

      items.push(masterT, musicT, sfxT, muteT, ccT, cuesT, back);
    };

    drawSettingsList();
  }
}
