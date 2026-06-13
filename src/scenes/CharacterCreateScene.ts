import Phaser from 'phaser';
import { RACES } from '../data/races';
import { CLASSES } from '../data/classes';
import { SaveManager } from '../systems/SaveManager';
import { CharacterSave, Race, CharClass, Stats } from '../types';
import { addToInventory } from '../lib/inventory';

type Step = 'race' | 'class' | 'confirm';

export class CharacterCreateScene extends Phaser.Scene {
  private step: Step = 'race';
  private selectedRace: Race | null = null;
  private selectedClass: CharClass | null = null;
  private cursorIndex = 0;
  private labels: Phaser.GameObjects.Text[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private cursor!: Phaser.Input.Keyboard.Key;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private backKey!: Phaser.Input.Keyboard.Key;
  private mKey!: Phaser.Input.Keyboard.Key;
  private iKey!: Phaser.Input.Keyboard.Key;
  private sKey!: Phaser.Input.Keyboard.Key;
  private hKey!: Phaser.Input.Keyboard.Key;
  private bKey!: Phaser.Input.Keyboard.Key;
  private gKey!: Phaser.Input.Keyboard.Key;
  private oKey!: Phaser.Input.Keyboard.Key;
  private masochistMode = false;
  private ironboundMode = false;
  private starvedMode = false;
  private huntedMode = false;
  private blackoutMode = false;
  private glassMode = false;
  private wrongfootedMode = false;

  constructor() { super('CharacterCreateScene'); }

  create(): void {
    const { keyboard } = this.input;
    this.upKey      = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey    = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.confirmKey = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.backKey    = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.cursor     = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.mKey       = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.iKey       = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.sKey       = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.hKey       = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.bKey       = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.gKey       = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.oKey       = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.O);

    this.cameras.main.setBackgroundColor('#0d0b14');
    const { width, height } = this.cameras.main;
    this.add.text(12, 12, 'ESC: Back', { fontSize: '10px', color: '#443366' });

    this.titleText = this.add.text(width / 2, height * 0.1, '', { fontSize: '13px', color: '#ddaaff' }).setOrigin(0.5);
    this.infoText  = this.add.text(width / 2, height * 0.78, '', { fontSize: '10px', color: '#998bbb', wordWrap: { width: width * 0.7 }, align: 'center' }).setOrigin(0.5);

    this.renderStep();
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
      this.moveCursor(-1);
    } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
      this.moveCursor(1);
    } else if (Phaser.Input.Keyboard.JustDown(this.confirmKey)) {
      this.confirm();
    } else if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
      this.goBack();
    } else if (this.step === 'confirm') {
      if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
        this.masochistMode = !this.masochistMode;
        this.renderStep();
      } else if (Phaser.Input.Keyboard.JustDown(this.iKey)) {
        this.ironboundMode = !this.ironboundMode;
        this.renderStep();
      } else if (Phaser.Input.Keyboard.JustDown(this.sKey)) {
        this.starvedMode = !this.starvedMode;
        this.renderStep();
      } else if (Phaser.Input.Keyboard.JustDown(this.hKey)) {
        this.huntedMode = !this.huntedMode;
        this.renderStep();
      } else if (Phaser.Input.Keyboard.JustDown(this.gKey)) {
        this.glassMode = !this.glassMode;
        this.renderStep();
      } else if (Phaser.Input.Keyboard.JustDown(this.oKey)) {
        this.wrongfootedMode = !this.wrongfootedMode;
        this.renderStep();
      }
    }
  }

  private currentList(): (Race | CharClass)[] {
    if (this.step === 'race') return RACES;
    if (this.step === 'class' && this.selectedRace) {
      return CLASSES.filter(c => this.selectedRace!.allowedClasses.includes(c.id));
    }
    return [];
  }

  private moveCursor(dir: number): void {
    const list = this.currentList();
    if (!list.length) return;
    this.cursorIndex = (this.cursorIndex + dir + list.length) % list.length;
    this.renderStep();
  }

  private confirm(): void {
    if (this.step === 'race') {
      this.selectedRace = RACES[this.cursorIndex];
      this.cursorIndex = 0;
      this.step = 'class';
      this.renderStep();
    } else if (this.step === 'class') {
      const filtered = CLASSES.filter(c => this.selectedRace!.allowedClasses.includes(c.id));
      this.selectedClass = filtered[this.cursorIndex];
      this.step = 'confirm';
      this.renderStep();
    } else if (this.step === 'confirm') {
      this.createAndStart();
    }
  }

  private goBack(): void {
    if (this.step === 'race') {
      this.scene.start('MainMenuScene');
    } else if (this.step === 'class') {
      this.step = 'race';
      this.cursorIndex = RACES.indexOf(this.selectedRace!);
      this.renderStep();
    } else if (this.step === 'confirm') {
      this.step = 'class';
      this.cursorIndex = 0;
      this.renderStep();
    }
  }

  private renderStep(): void {
    // Clear existing labels
    this.labels.forEach(l => l.destroy());
    this.labels = [];

    const { width, height } = this.cameras.main;
    const startY = height * 0.22;
    const lineH  = 28;

    if (this.step === 'race') {
      this.titleText.setText('CHOOSE YOUR RACE');
      this.infoText.setText('Use UP/DOWN to select, ENTER to confirm.');
      RACES.forEach((race, i) => {
        const active = i === this.cursorIndex;
        const txt = this.add.text(width / 2, startY + i * lineH,
          (active ? '> ' : '  ') + race.name.toUpperCase(),
          { fontSize: '12px', color: active ? '#ffffff' : '#887799' }
        ).setOrigin(0.5);
        this.labels.push(txt);
        if (active) {
          const modStr = this.statModString(race.modifiers);
          this.infoText.setText(`Allowed classes: ${race.allowedClasses.join(', ')}\nStat mods: ${modStr}`);
        }
      });
    } else if (this.step === 'class') {
      this.titleText.setText(`${this.selectedRace!.name.toUpperCase()} — CHOOSE CLASS`);
      const filtered = CLASSES.filter(c => this.selectedRace!.allowedClasses.includes(c.id));
      filtered.forEach((cls, i) => {
        const active = i === this.cursorIndex;
        const txt = this.add.text(width / 2, startY + i * lineH,
          (active ? '> ' : '  ') + cls.name.toUpperCase(),
          { fontSize: '12px', color: active ? '#ffffff' : '#887799' }
        ).setOrigin(0.5);
        this.labels.push(txt);
        if (active) {
          const s = cls.baseStats;
          this.infoText.setText(`STR:${s.str} DEX:${s.dex} INT:${s.int} VIT:${s.vit} AGI:${s.agi}\nHP:${s.hp} MP:${s.mp}`);
        }
      });
    } else {
      // Confirm step
      this.titleText.setText('CONFIRM CHARACTER');
      const race = this.selectedRace!;
      const cls  = this.selectedClass!;
      const final = this.mergeStats(cls.baseStats, race.modifiers);

      const lines = [
        `Race:  ${race.name}    Class: ${cls.name}`,
        `HP: ${final.hp}  MP: ${final.mp}`,
        `STR:${final.str}  DEX:${final.dex}  INT:${final.int}  VIT:${final.vit}  AGI:${final.agi}`,
        `Title: [ ${this.getCosmeticTitle().toUpperCase()} ]`,
        `[M] Masochist:   [${this.masochistMode ? 'X' : ' '}] (Durability & Weight)`,
        `[I] Ironbound:    [${this.ironboundMode ? 'X' : ' '}] (Disable Warp Crystals)`,
        `[S] Starved:      [${this.starvedMode ? 'X' : ' '}] (Halve All Healing)`,
        `[H] Hunted:       [${this.huntedMode ? 'X' : ' '}] (Early Nemesis Spawn)`,
        `[B] Blackout:     [${this.blackoutMode ? 'X' : ' '}] (Reduced FOV Radius)`,
        `[G] Glass:        [${this.glassMode ? 'X' : ' '}] (2x Damage Taken, 1.5x Dealt)`,
        `[O] Wrongfooted:  [${this.wrongfootedMode ? 'X' : ' '}] (Weaknesses Hidden)`,
        '',
        `> ENTER to begin your run`,
      ];
      lines.forEach((line, i) => {
        const color = line.startsWith('>') ? '#aaddaa' : '#ccbbee';
        const txt = this.add.text(width / 2, startY - 10 + i * 13, line,
          { fontSize: '8px', color }
        ).setOrigin(0.5);
        this.labels.push(txt);
      });
      this.infoText.setText('Permadeath. One life. Choose wisely.');
    }
  }

  private statModString(mods: Partial<import('../types').Stats>): string {
    return Object.entries(mods).map(([k, v]) => `${k.toUpperCase()}${v! > 0 ? '+' : ''}${v}`).join(' ');
  }

  private mergeStats(base: Stats, mods: Partial<Stats>): Stats {
    return {
      hp:  base.hp  + (mods.hp  ?? 0),
      mp:  base.mp  + (mods.mp  ?? 0),
      str: base.str + (mods.str ?? 0),
      dex: base.dex + (mods.dex ?? 0),
      int: base.int + (mods.int ?? 0),
      vit: base.vit + (mods.vit ?? 0),
      agi: base.agi + (mods.agi ?? 0),
    };
  }

  private getCosmeticTitle(): string {
    const modsCount = (this.masochistMode ? 1 : 0) +
                      (this.ironboundMode ? 1 : 0) +
                      (this.starvedMode ? 1 : 0) +
                      (this.huntedMode ? 1 : 0) +
                      (this.blackoutMode ? 1 : 0) +
                      (this.glassMode ? 1 : 0) +
                      (this.wrongfootedMode ? 1 : 0);

    if (modsCount === 7) return 'Dungeon Overlord';
    if (modsCount === 6) return 'Ascended Deity';
    if (modsCount === 5) return 'Dungeon Deity';
    if (modsCount === 4) return 'Dread Conqueror';
    if (modsCount === 3) return 'Death Seeker';
    if (modsCount === 2) return 'Daring Adventurer';
    if (modsCount === 1) {
      if (this.masochistMode) return 'Masochist';
      if (this.ironboundMode) return 'Ironbound';
      if (this.starvedMode) return 'Starved';
      if (this.huntedMode) return 'Hunted';
      if (this.blackoutMode) return 'Blackout';
      if (this.glassMode) return 'Glass Cannon';
      if (this.wrongfootedMode) return 'Wrongfooted';
    }
    return 'Challenger';
  }

  private createAndStart(): void {
    const race  = this.selectedRace!;
    const cls   = this.selectedClass!;
    const stats = this.mergeStats(cls.baseStats, race.modifiers);

    const save: CharacterSave = {
      version: 1,
      name: `${race.name} ${cls.name}`,
      race: race.id,
      clazz: cls.id,
      level: 1,
      exp: 0,
      stats,
      currentHp: stats.hp,
      currentMp: stats.mp,
      gold: 0,
      inventory: [],
      equipped: {
        head: null,
        chest: null,
        hands: null,
        legs: null,
        boots: null,
        mainhand: null,
        offhand: null,
        weapon2: null,
        amulet: null,
        ring1: null,
        ring2: null,
        charm: null
      },
      activeWeaponSlot: 0,
      hasBag: false,
      location: 'town',
      dungeonFloor: 0,
      floorSeed: 0,
      lastWarpIndex: 0,
      position: { x: 640, y: 600 },
      unspentStatPoints: 0,
      unspentSkillPoints: 0,
      unlockedSkills: [],
      masochist: this.masochistMode,
      ironbound: this.ironboundMode,
      starved: this.starvedMode,
      hunted: this.huntedMode,
      blackout: this.blackoutMode,
      glass: this.glassMode,
      wrongfooted: this.wrongfootedMode,
      title: this.getCosmeticTitle(),
      createdAt: new Date().toISOString(),
    };

    cls.startingEquipment.forEach(id => {
      const qty = id === 'arrow' ? 20 : 1;
      addToInventory(save.inventory, id, qty);
    });

    SaveManager.write(save);

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.scene.start('TownScene');
  }
}
