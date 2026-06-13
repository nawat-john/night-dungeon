import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { AudioManager } from '../systems/AudioManager';

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  create(): void {
    // Initialise audio and set game reference
    AudioManager.init(this.game);
    AudioManager.playMusic('menu');

    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#0d0b14');

    // Title
    this.add.text(width / 2, height * 0.22, 'NIGHT DUNGEON', {
      fontSize: '22px', color: '#ddaaff',
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.22 + 36, 'DUNGEON CRAWLER', {
      fontSize: '10px', color: '#776699',
    }).setOrigin(0.5);

    const hasSave = SaveManager.hasSave();
    const cx = width / 2;

    this.makeButton(cx, height * 0.44, 'NEW GAME', () => {
      if (hasSave) {
        this.showConfirm('Abandon current run\nand start fresh?', () => {
          SaveManager.wipe();
          this.scene.start('CharacterCreateScene');
        });
      } else {
        this.scene.start('CharacterCreateScene');
      }
    });

    this.makeButton(cx, height * 0.44 + 32, 'CONTINUE', () => {
      const save = SaveManager.load();
      if (!save) return;
      if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
      if (save.location === 'town') {
        this.scene.start('TownScene');
      } else {
        this.scene.start('DungeonScene');
      }
    }, !hasSave);

    this.makeButton(cx, height * 0.44 + 64, 'SETTINGS', () => {
      this.showSettings();
    });

    this.add.text(cx, height - 14, 'WASD move   Space attack   E interact', {
      fontSize: '9px', color: '#443366',
    }).setOrigin(0.5);
  }

  private showSettings(): void {
    const { width, height } = this.cameras.main;
    const bw = width * 0.52;
    const bh = 154;
    const cx = width / 2;
    const cy = height / 2;

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.82).setOrigin(0).setDepth(20);
    const box = this.add.rectangle(cx, cy, bw, bh, 0x0e091a).setStrokeStyle(1.5, 0x8866cc).setDepth(21);
    
    const title = this.add.text(cx, cy - bh / 2 + 10, '— SETTINGS —', {
      fontSize: '11px', color: '#aaddff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(22);

    const items: Phaser.GameObjects.Text[] = [];

    const drawSettingsList = () => {
      items.forEach(t => t.destroy());
      items.length = 0;

      const yStart = cy - bh / 2 + 28;
      const lineH = 16;

      // Master Volume
      const masterStr = `Master Volume: [ ${Math.round(AudioManager.masterVol * 100)}% ]`;
      const masterT = this.add.text(cx, yStart, masterStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(22).setInteractive({ useHandCursor: true });
      masterT.on('pointerdown', () => {
        AudioManager.masterVol = (AudioManager.masterVol + 0.25) > 1.01 ? 0 : AudioManager.masterVol + 0.25;
        AudioManager.applyVolumes();
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // Music Volume
      const musicStr = `Music Volume:  [ ${Math.round(AudioManager.musicVol * 100)}% ]`;
      const musicT = this.add.text(cx, yStart + lineH, musicStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(22).setInteractive({ useHandCursor: true });
      musicT.on('pointerdown', () => {
        AudioManager.musicVol = (AudioManager.musicVol + 0.25) > 1.01 ? 0 : AudioManager.musicVol + 0.25;
        AudioManager.applyVolumes();
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // SFX Volume
      const sfxStr = `SFX Volume:    [ ${Math.round(AudioManager.sfxVol * 100)}% ]`;
      const sfxT = this.add.text(cx, yStart + 2 * lineH, sfxStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(22).setInteractive({ useHandCursor: true });
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
        .setOrigin(0.5).setDepth(22).setInteractive({ useHandCursor: true });
      muteT.on('pointerdown', () => {
        AudioManager.isMuted = !AudioManager.isMuted;
        AudioManager.applyVolumes();
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // Closed Captions Toggle
      const ccStr = `Visual Captions: [ ${AudioManager.closedCaptions ? 'ON' : 'OFF'} ]`;
      const ccT = this.add.text(cx, yStart + 4 * lineH, ccStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(22).setInteractive({ useHandCursor: true });
      ccT.on('pointerdown', () => {
        AudioManager.closedCaptions = !AudioManager.closedCaptions;
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // Audio Cues Only Toggle
      const cuesStr = `Audio Cues Only: [ ${AudioManager.audioCuesOnly ? 'ON' : 'OFF'} ]`;
      const cuesT = this.add.text(cx, yStart + 5 * lineH, cuesStr, { fontSize: '8px', color: '#ccbbee' })
        .setOrigin(0.5).setDepth(22).setInteractive({ useHandCursor: true });
      cuesT.on('pointerdown', () => {
        AudioManager.audioCuesOnly = !AudioManager.audioCuesOnly;
        AudioManager.saveSettings();
        drawSettingsList();
      });

      // Back Button
      const back = this.add.text(cx, cy + bh / 2 - 14, '← BACK', {
        fontSize: '9px', color: '#888888', backgroundColor: '#181224', padding: { x: 8, y: 3 }
      }).setOrigin(0.5).setDepth(22).setInteractive({ useHandCursor: true });
      back.on('pointerdown', () => {
        [overlay, box, title, back, ...items].forEach(o => o.destroy());
      });

      items.push(masterT, musicT, sfxT, muteT, ccT, cuesT, back);
    };

    drawSettingsList();
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void, disabled = false): void {
    const color = disabled ? '#443355' : '#8866cc';
    const hover = '#bbaaee';
    const txt = this.add.text(x, y, label, {
      fontSize: '14px', color,
    }).setOrigin(0.5).setInteractive({ useHandCursor: !disabled });

    if (!disabled) {
      txt.on('pointerover',  () => txt.setColor(hover));
      txt.on('pointerout',   () => txt.setColor(color));
      txt.on('pointerdown',  onClick);
    }
  }

  private showConfirm(message: string, onYes: () => void): void {
    const { width, height } = this.cameras.main;
    const bw = width * 0.35;
    const bh = 100;
    const cx = width / 2;
    const cy = height / 2;

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setDepth(10);
    const box = this.add.rectangle(cx, cy, bw, bh, 0x1a1428).setStrokeStyle(1, 0x886699).setDepth(11);
    const msg = this.add.text(cx, cy - 18, message, {
      fontSize: '10px', color: '#ccbbee', align: 'center',
    }).setOrigin(0.5).setDepth(12);
    const yes = this.add.text(cx - 50, cy + 22, 'YES', {
      fontSize: '12px', color: '#ff7777',
    }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });
    const no = this.add.text(cx + 50, cy + 22, 'NO', {
      fontSize: '12px', color: '#77ff77',
    }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });

    const close = () => [overlay, box, msg, yes, no].forEach(o => o.destroy());
    yes.on('pointerdown', () => { close(); onYes(); });
    no.on('pointerdown', close);
  }
}
