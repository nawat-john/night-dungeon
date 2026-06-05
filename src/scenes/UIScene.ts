import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';
import { expForLevel } from '../config';

const BAR_W = 160;
const BAR_H = 8;
const PAD   = 10;

export class UIScene extends Phaser.Scene {
  private hpBg!:    Phaser.GameObjects.Rectangle;
  private hpBar!:   Phaser.GameObjects.Rectangle;
  private hpText!:  Phaser.GameObjects.Text;
  private mpBg!:    Phaser.GameObjects.Rectangle;
  private mpBar!:   Phaser.GameObjects.Rectangle;
  private mpText!:  Phaser.GameObjects.Text;
  private expBg!:   Phaser.GameObjects.Rectangle;
  private expBar!:  Phaser.GameObjects.Rectangle;
  private expText!: Phaser.GameObjects.Text;
  private goldText!:   Phaser.GameObjects.Text;
  private floorText!:  Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private hintText!:   Phaser.GameObjects.Text;

  constructor() { super({ key: 'UIScene', active: false }); }

  create(): void {
    // HP bar
    this.hpBg   = this.add.rectangle(PAD, PAD, BAR_W, BAR_H, 0x331111).setOrigin(0);
    this.hpBar  = this.add.rectangle(PAD, PAD, BAR_W, BAR_H, 0xcc3333).setOrigin(0);
    this.hpText = this.add.text(PAD + BAR_W + 6, PAD - 1, '', { fontSize: '11px', color: '#cc6666' });

    // MP bar
    this.mpBg   = this.add.rectangle(PAD, PAD + 16, BAR_W, BAR_H, 0x111133).setOrigin(0);
    this.mpBar  = this.add.rectangle(PAD, PAD + 16, BAR_W, BAR_H, 0x3366cc).setOrigin(0);
    this.mpText = this.add.text(PAD + BAR_W + 6, PAD + 15, '', { fontSize: '11px', color: '#6688cc' });

    // EXP bar
    this.expBg   = this.add.rectangle(PAD, PAD + 32, BAR_W, BAR_H, 0x112211).setOrigin(0);
    this.expBar  = this.add.rectangle(PAD, PAD + 32, BAR_W, BAR_H, 0x33aa55).setOrigin(0);
    this.expText = this.add.text(PAD + BAR_W + 6, PAD + 31, '', { fontSize: '11px', color: '#55cc77' });

    // Gold, floor, weapon slot, hint
    this.goldText   = this.add.text(0, PAD,      '', { fontSize: '12px', color: '#ffdd44' }).setOrigin(1, 0);
    this.floorText  = this.add.text(0, PAD,      '', { fontSize: '12px', color: '#998bbb' }).setOrigin(0.5, 0);
    this.weaponText = this.add.text(PAD, 0,      '', { fontSize: '10px', color: '#aaccff' });
    this.hintText   = this.add.text(0, 0, 'Space: Attack   E: Interact   Q: Switch Wep   I: Inventory',
      { fontSize: '9px', color: '#332244' }).setOrigin(0.5, 1);

    this.game.events.on('hud-update',    this.onHudUpdate,    this);
    this.game.events.on('floor-update',  this.onFloorUpdate,  this);
    this.game.events.on('weapon-switch', this.onWeaponSwitch, this);
    this.events.once('shutdown', () => {
      this.game.events.off('hud-update',    this.onHudUpdate,    this);
      this.game.events.off('floor-update',  this.onFloorUpdate,  this);
      this.game.events.off('weapon-switch', this.onWeaponSwitch, this);
    });

    this.scale.on('resize', this.reposition, this);
    this.reposition();

    const save = SaveManager.load();
    if (save) {
      this.setHp(save.currentHp, save.stats.hp);
      this.setMp(save.currentMp, save.stats.mp);
      this.setExp(save.exp ?? 0, save.level);
      this.goldText.setText(`${save.gold}g`);
      if (save.location === 'dungeon') this.floorText.setText(`Floor ${save.dungeonFloor}`);
      const wepId = save.equipped['mainhand'];
      if (wepId) this.weaponText.setText(`[${save.activeWeaponSlot === 0 ? '1' : '2'}] ${wepId}`);
    }
  }

  private reposition(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.goldText.setPosition(w - PAD, PAD);
    this.floorText.setPosition(w / 2, PAD);
    this.hintText.setPosition(w / 2, h - PAD);
    this.weaponText.setPosition(PAD, PAD + 52);
  }

  private onHudUpdate(player: Player): void {
    this.setHp(player.currentHp, player.maxHp);
    this.setMp(player.currentMp, player.maxMp);
    this.setExp(player.exp, player.level);
    this.goldText.setText(`${player.gold}g`);
  }

  private onFloorUpdate(floor: number): void {
    this.floorText.setText(floor > 0 ? `Floor ${floor}` : '');
  }

  private onWeaponSwitch(data: { slot: number; weaponName: string }): void {
    this.weaponText.setText(`[${data.slot + 1}] ${data.weaponName}`);
  }

  private setHp(cur: number, max: number): void {
    this.hpBar.width = BAR_W * Math.max(0, cur / max);
    this.hpText.setText(`${cur}/${max}`);
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
}
