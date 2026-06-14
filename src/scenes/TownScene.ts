import Phaser from 'phaser';
import { TILE, MAP_COLS, MAP_ROWS, INTERACT_RANGE, calcZoom } from '../config';
import { Player } from '../entities/Player';
import { SaveManager } from '../systems/SaveManager';
import { COMPANION_DEFS } from '../data/companions';
import { ITEMS } from '../data/items';
import { addToInventory } from '../lib/inventory';
import { getDailyBounties, BOUNTY_POOL, BountyTemplate } from '../data/bounties';
import { AudioManager } from '../systems/AudioManager';
import { ENEMY_DEFS } from '../data/enemies';
import { ResearchSystem } from '../systems/ResearchSystem';

// ── Tile palette ───────────────────────────────────────────────────────────────
const G = 3;  // ground / dead earth
const W = 2;  // wall / solid stone block
const P = 1;  // stone floor path (cave-floor tile — dark, gritty)
const F = 1;
const I = 7;  // building rooftop (opaque, seen from above)
const V = 6;  // void / absolute darkness

interface Interactable {
  col: number; row: number;
  label: string;
  onInteract: () => void;
  promptSprite?: Phaser.GameObjects.Text;
}

export class TownScene extends Phaser.Scene {
  private player!: Player;
  private interactables: Interactable[] = [];
  private decorGroup!: Phaser.Physics.Arcade.StaticGroup;
  private footstepTimer = 0;
  private bestiaryPage = 0;

  constructor() { super('TownScene'); }

  create(): void {
    const save = SaveManager.load();
    if (!save) { this.scene.start('MainMenuScene'); return; }
    save.location = 'town';
    // Restore surviving companions to full HP in normal mode; dead ones already removed by DungeonScene
    if ((save.companions ?? []).length > 0 && !save.hardcoreCompanions) {
      for (const comp of save.companions!) {
        comp.currentHp = comp.maxHp;
        comp.potions = 3;
        comp.fatigue = Math.max(0, (comp.fatigue ?? 0) - 1);
      }
    }
    SaveManager.write(save);

    AudioManager.playMusic('town');

    this.cameras.main.fadeIn(300, 0, 0, 0);

    const mapData = this.buildTownMap();
    const map = this.make.tilemap({ data: mapData, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    if (!tileset) throw new Error('Tileset not found');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Layer failed');
    layer.setCollision([W]);

    // Use saved position when returning from interior scenes or dungeon
    const spawnX = save.position.x > 10 ? save.position.x : 31 * TILE + TILE / 2;
    const spawnY = save.position.y > 10 ? save.position.y : 36 * TILE + TILE / 2;
    this.player = new Player(this, spawnX, spawnY);
    this.player.loadFromSave(save);

    const mapW = MAP_COLS * TILE;
    const mapH = MAP_ROWS * TILE;
    this.physics.world.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setZoom(calcZoom(this.scale.width, this.scale.height));
    this.scale.on('resize', () => {
      this.cameras.main.setZoom(calcZoom(this.scale.width, this.scale.height));
    }, this);

    this.physics.add.collider(this.player as unknown as Phaser.GameObjects.GameObject, layer);

    this.decorGroup = this.physics.add.staticGroup();
    this.addDecorations();
    this.physics.add.collider(
      this.player as unknown as Phaser.GameObjects.GameObject,
      this.decorGroup,
    );

    this.registerInteractables();

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.game.events.emit('hud-update', this.player);
    this.game.events.emit('floor-update', 0);
  }

  update(_time: number, delta: number): void {
    this.player.update(_time, delta);

    // Footstep sounds
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body && (body.velocity.x !== 0 || body.velocity.y !== 0)) {
      this.footstepTimer -= delta;
      if (this.footstepTimer <= 0) {
        AudioManager.playSFX('footstep');
        this.footstepTimer = 350;
      }
    } else {
      this.footstepTimer = 0;
    }

    const px = this.player.x, py = this.player.y;
    const eJust = Phaser.Input.Keyboard.JustDown(this.player.interactKey);

    for (const ia of this.interactables) {
      const ix = (ia.col + 0.5) * TILE;
      const iy = (ia.row + 0.5) * TILE;
      const dist = Phaser.Math.Distance.Between(px, py, ix, iy);
      if (dist < INTERACT_RANGE) {
        if (!ia.promptSprite) {
          ia.promptSprite = this.add.text(ix, iy - 28, `E: ${ia.label}`, {
            fontSize: '8px', color: '#ffffaa',
          }).setOrigin(0.5).setDepth(10);
        }
        if (eJust) ia.onInteract();
      } else if (ia.promptSprite) {
        ia.promptSprite.destroy();
        ia.promptSprite = undefined;
      }
    }
  }

  // ── Interactables — all shops open their own scenes ──────────────────────────
  private registerInteractables(): void {
    const goScene = (sceneName: string) => {
      const s = SaveManager.load()!;
      s.position = { x: this.player.x, y: this.player.y };
      SaveManager.write(s);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop('UIScene');
        this.scene.start(sceneName);
      });
      this.cameras.main.fadeOut(300, 0, 0, 0);
    };

    // Store entrances — position at door tile (just outside building south wall)
    this.interactables.push({ col: 5,  row: 12, label: 'Enter Armory',       onInteract: () => goScene('ArmoryScene')      });
    this.interactables.push({ col: 30, row: 12, label: 'Enter Inn',           onInteract: () => goScene('InnScene')         });
    this.interactables.push({ col: 57, row: 12, label: 'Enter Emporium',      onInteract: () => goScene('EmporiumScene')    });
    this.interactables.push({ col: 6,  row: 44, label: 'Enter Chapel',        onInteract: () => goScene('ChapelScene')      });
    this.interactables.push({ col: 56, row: 29, label: "Enter Sage's Tower",  onInteract: () => goScene('SagesTowerScene') });

    // Adventurer's Guild — companion hire + bounty board
    this.interactables.push({
      col: 56, row: 44, label: "Adventurer's Guild",
      onInteract: () => this.openGuildPanel(),
    });

    // Dungeon gate — with optional checkpoint floor
    this.interactables.push({
      col: 31, row: 41, label: 'Enter Dungeon',
      onInteract: () => this.openGatePanel(),
    });

    // §25 Ancient Monolith lore monolith
    this.interactables.push({
      col: 30, row: 25, label: 'Read Monolith',
      onInteract: () => this.showMonolithLore(),
    });

    // Wandering Stall — daily-rotating rare vendor in the market lane
    this.interactables.push({
      col: 42, row: 27, label: 'Wandering Stall',
      onInteract: () => this.openWanderingStall(),
    });

    // Guard banter — left guard post
    this.interactables.push({
      col: 25, row: 37, label: 'Talk to Guard',
      onInteract: () => this.showGuardBanter(),
    });
  }

  // ── Dungeon Gate panel (with checkpoint option) ──────────────────────────────
  private openGatePanel(): void {
    const meta = SaveManager.loadAccountMeta();
    const checkpoints = meta.unlockedCheckpointFloors.filter(f => f > 1);

    if (checkpoints.length === 0) {
      // No checkpoints — go straight in at floor 1
      this.descend(1);
      return;
    }

    // Show floor selection panel
    const sw = this.scale.width, sh = this.scale.height;
    if (this.children.getByName('gate_panel')) return;
    const c = this.add.container(sw / 2, sh / 2).setDepth(30).setName('gate_panel').setScrollFactor(0);
    const pw = 280, ph = 200 + checkpoints.length * 22;
    c.add(this.add.rectangle(0, 0, pw, ph, 0x08050f, 0.97).setStrokeStyle(1.5, 0x663377));
    c.add(this.add.text(0, -ph / 2 + 14, 'DUNGEON GATE', { fontSize: '10px', color: '#cc88ff' }).setOrigin(0.5));
    c.add(this.add.text(0, -ph / 2 + 30, 'Choose entry floor:', { fontSize: '8px', color: '#777799' }).setOrigin(0.5));

    const close = () => c.destroy();
    c.add(this.add.text(pw / 2 - 10, -ph / 2 + 10, '✕', { fontSize: '10px', color: '#ff6666' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', close));

    const allFloors = [1, ...checkpoints];
    allFloors.forEach((floor, i) => {
      const y = -ph / 2 + 60 + i * 26;
      const label = floor === 1 ? 'Floor 1 — The Entrance' : `Floor ${floor} — Unlocked checkpoint`;
      const btn = this.add.text(0, y, label, {
        fontSize: '9px', color: '#ddccff',
        backgroundColor: '#1a0a2a', padding: { x: 10, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => { close(); this.descend(floor); });
      c.add(btn);
    });

    c.add(this.add.text(0, ph / 2 - 12, '[ESC] to close', { fontSize: '6px', color: '#443344' }).setOrigin(0.5));

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); window.removeEventListener('keydown', handler); }
    };
    window.addEventListener('keydown', handler);
    c.once('destroy', () => window.removeEventListener('keydown', handler));
  }

  private descend(floor: number): void {
    const s = SaveManager.load()!;
    s.location      = 'dungeon';
    s.dungeonFloor  = floor;
    s.floorSeed     = Math.floor(Math.random() * 0x7fffffff);
    s.lastWarpIndex = 0;
    s.currentHp     = this.player.currentHp;
    s.currentMp     = this.player.currentMp;
    s.gold          = this.player.gold;
    // Reset per-run tracking
    s.bossesSlain   = [];
    s.enemiesKilled = 0;
    s.enemyKillMap  = {};
    SaveManager.write(s);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('UIScene');
      this.scene.start('FloorTransitionScene', { floor });
    });
    this.cameras.main.fadeOut(400, 0, 0, 0);
  }

  // ── Wandering Stall (daily-rotating rare vendor) ──────────────────────────────
  private openWanderingStall(): void {
    const sw = this.scale.width, sh = this.scale.height;
    if (this.children.getByName('stall_panel')) return;

    // Daily stock: seeded by date, 3 items from a pool
    const STALL_POOL = [
      { id: 'camp_kit',      price: 60  },
      { id: 'warp_crystal',  price: 150 },
      { id: 'mana_stone_2',  price: 90  },
      { id: 'mana_stone_3',  price: 200 },
      { id: 'dragon_scale',  price: 130 },
      { id: 'smoke_bomb',    price: 25  },
      { id: 'spike_trap',    price: 40  },
      { id: 'whetstone',     price: 20  },
      { id: 'health_potion', price: 30  },
      { id: 'mana_potion',   price: 35  },
      { id: 'frost_crystal', price: 180 },
      { id: 'brand_ember',   price: 160 },
    ];
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + 7919;
    let s = seed >>> 0;
    const pool = [...STALL_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      s = ((Math.imul(s, 1664525) + 1013904223) >>> 0);
      const j = s % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const stock = pool.slice(0, 3);

    const c = this.add.container(sw / 2, sh / 2).setDepth(30).setName('stall_panel').setScrollFactor(0);
    const pw = 260, ph = 220;
    c.add(this.add.rectangle(0, 0, pw, ph, 0x0a0c0a, 0.97).setStrokeStyle(1.5, 0x446644));
    c.add(this.add.text(0, -ph / 2 + 14, '🛒 WANDERING STALL', { fontSize: '9px', color: '#88cc88' }).setOrigin(0.5));
    c.add(this.add.text(0, -ph / 2 + 28, 'Rare wares — today only', { fontSize: '7px', color: '#557755' }).setOrigin(0.5));

    const close = () => c.destroy();
    c.add(this.add.text(pw / 2 - 10, -ph / 2 + 10, '✕', { fontSize: '10px', color: '#ff6666' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', close));

    stock.forEach((entry, i) => {
      const itemDef = ITEMS[entry.id];
      if (!itemDef) return;
      const y = -ph / 2 + 65 + i * 46;
      const canAfford = this.player.gold >= entry.price;
      c.add(this.add.text(-pw / 2 + 16, y - 6, itemDef.name, { fontSize: '9px', color: canAfford ? '#ddffdd' : '#666666' }));
      c.add(this.add.text(-pw / 2 + 16, y + 8, `${entry.price}g`, { fontSize: '8px', color: canAfford ? '#ffdd44' : '#554444' }));
      if (canAfford) {
        const btn = this.add.text(pw / 2 - 16, y, 'BUY', {
          fontSize: '8px', color: '#88ffaa',
          backgroundColor: '#0a2a0a', padding: { x: 6, y: 3 },
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
          const save = SaveManager.load();
          if (!save || save.gold < entry.price) return;
          this.player.addGold(-entry.price);
          save.gold = this.player.gold;
          addToInventory(save.inventory, entry.id, 1);
          SaveManager.write(save);
          this.game.events.emit('hud-update', this.player);
          AudioManager.playSFX('bounce');
          close();
          this.openWanderingStall();
        });
        c.add(btn);
      }
      c.add(this.add.rectangle(0, y + 20, pw - 20, 1, 0x334433, 0.5));
    });

    c.add(this.add.text(0, ph / 2 - 12, '[ESC] to close', { fontSize: '6px', color: '#334433' }).setOrigin(0.5));
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); window.removeEventListener('keydown', handler); }
    };
    window.addEventListener('keydown', handler);
    c.once('destroy', () => window.removeEventListener('keydown', handler));
  }

  // ── Guard banter ─────────────────────────────────────────────────────────────
  private showGuardBanter(): void {
    const save = SaveManager.load();
    if (!save) return;
    const meta = SaveManager.loadAccountMeta();
    const maxFloor = Math.max(0, ...meta.runHistory.map(r => r.floorReached), 0);
    const bosses = meta.runHistory.flatMap(r => r.bossesSlain).length;

    const lines = maxFloor >= 9
      ? ['"You\'ve made it to the deepest floors."', '"Few return from where you\'ve been."', '"I don\'t know whether to salute or run."']
      : maxFloor >= 5
      ? ['"Still breathing, adventurer? Impressive."', '"The Forgefather is no joke. Respect."', '"Watch the fire on those lower floors."']
      : maxFloor >= 2
      ? ['"Back from the dungeon in one piece?"', '"Don\'t get too comfortable up here."', '"Floor two\'s got surprises. Be careful."']
      : ['"Turn back if you value your life."', '"Only fools and legends go down there."', '"The last dozen who entered didn\'t return."'];

    if (bosses > 0) lines.push(`"${bosses} boss${bosses > 1 ? 'es' : ''} slain across all your runs. Not bad."`);

    const sw = this.scale.width, sh = this.scale.height;
    if (this.children.getByName('banter_panel')) return;
    const c = this.add.container(sw / 2, sh * 0.65).setDepth(30).setName('banter_panel').setScrollFactor(0);
    const pw = 280, ph = 80 + lines.length * 18;
    c.add(this.add.rectangle(0, 0, pw, ph, 0x080808, 0.95).setStrokeStyle(1, 0x554422));
    c.add(this.add.text(0, -ph / 2 + 12, 'GATE GUARD', { fontSize: '8px', color: '#aa8844' }).setOrigin(0.5));
    lines.forEach((line, i) => {
      c.add(this.add.text(0, -ph / 2 + 32 + i * 18, line, { fontSize: '7px', color: '#ccbbaa', wordWrap: { width: pw - 20 }, align: 'center' }).setOrigin(0.5));
    });
    c.add(this.add.text(0, ph / 2 - 12, '[E or ESC] to dismiss', { fontSize: '6px', color: '#443322' }).setOrigin(0.5));

    const close = () => c.destroy();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') { close(); window.removeEventListener('keydown', handler); }
    };
    this.time.delayedCall(200, () => window.addEventListener('keydown', handler));
    c.once('destroy', () => window.removeEventListener('keydown', handler));
  }

  // ── Decorations — sparse dark fantasy ────────────────────────────────────────
  // ── Adventurer's Guild panel ──────────────────────────────────────────────────
  private openGuildPanel(tab: 'companions' | 'bounties' | 'graveyard' | 'bestiary' | 'investigation' = 'companions'): void {
    const sw = this.scale.width, sh = this.scale.height;
    const save = SaveManager.load();
    if (!save) return;

    if (this.children.getByName('guild_panel')) {
      this.children.getByName('guild_panel')?.destroy();
    }

    const pw = 330, ph = 280;
    const container = this.add.container(sw / 2, sh / 2).setDepth(30).setName('guild_panel').setScrollFactor(0);
    container.add(this.add.rectangle(0, 0, pw, ph, 0x0a0c14, 0.97).setStrokeStyle(1.5, 0x886622));
    container.add(this.add.text(0, -ph / 2 + 12, "ADVENTURER'S GUILD", { fontSize: '10px', color: '#ffcc44' }).setOrigin(0.5));

    const close = () => container.destroy();
    container.add(this.add.text(pw / 2 - 10, -ph / 2 + 10, '✕', { fontSize: '10px', color: '#ff6666' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', close));

    // Tab headers
    const TABS: { id: 'companions' | 'bounties' | 'graveyard' | 'bestiary' | 'investigation'; label: string }[] = [
      { id: 'companions', label: 'COMPANIONS' },
      { id: 'bounties',   label: 'BOUNTIES'   },
      { id: 'graveyard',  label: 'GRAVEYARD'  },
      { id: 'bestiary',   label: 'BESTIARY'   },
      { id: 'investigation', label: 'CLUES'   },
    ];
    TABS.forEach((t, i) => {
      const tx = -132 + i * 66;
      const active = t.id === tab;
      const tabBg = this.add.rectangle(tx, -ph / 2 + 30, 60, 16, active ? 0x332200 : 0x111111).setStrokeStyle(1, active ? 0x886622 : 0x333333).setInteractive({ useHandCursor: true });
      tabBg.on('pointerdown', () => { close(); this.openGuildPanel(t.id); });
      const tabLabel = this.add.text(tx, -ph / 2 + 30, t.label, { fontSize: '6px', color: active ? '#ffcc44' : '#666644' }).setOrigin(0.5);
      container.add([tabBg, tabLabel]);
    });

    const contentY = -ph / 2 + 46;

    if (tab === 'companions') {
      this.buildGuildCompanions(container, save, contentY, pw, close);
    } else if (tab === 'bounties') {
      this.buildGuildBounties(container, save, contentY, pw, ph, close);
    } else if (tab === 'bestiary') {
      this.buildGuildBestiary(container, contentY, pw, ph);
    } else if (tab === 'investigation') {
      this.buildGuildInvestigation(container, contentY, pw, ph);
    } else {
      this.buildGuildGraveyard(container, contentY, pw, ph);
    }

    container.add(this.add.text(0, ph / 2 - 12, '[ESC] to close', { fontSize: '6px', color: '#443322' }).setOrigin(0.5));
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); window.removeEventListener('keydown', handler); }
    };
    window.addEventListener('keydown', handler);
    container.once('destroy', () => window.removeEventListener('keydown', handler));
  }

  private buildGuildCompanions(container: Phaser.GameObjects.Container, save: ReturnType<typeof SaveManager.load>, contentY: number, _pw: number, close: () => void): void {
    if (!save) return;
    container.add(this.add.text(0, contentY + 6, 'Hire a Companion for your next run:', { fontSize: '7px', color: '#aaaaaa' }).setOrigin(0.5));

    const active = save.companions ?? [];
    COMPANION_DEFS.forEach((def, i) => {
      const already = active.some(c => c.id === def.id);
      const canAfford = this.player.gold >= def.hireCost;
      const canHire   = !already && canAfford && active.length < 2;
      const col = i % 3, x = -90 + col * 90;
      const y   = contentY + 64;
      const bg = this.add.rectangle(x, y, 80, 96, already ? 0x112233 : (canHire ? 0x1a1a0a : 0x0d0d0d)).setStrokeStyle(1, already ? 0x4477aa : (canHire ? 0x886622 : 0x333333));
      const nameT  = this.add.text(x, y - 36, def.name, { fontSize: '6px', color: canHire ? '#ffcc44' : '#776644', align: 'center', wordWrap: { width: 72 } }).setOrigin(0.5);
      const roleT  = this.add.text(x, y - 20, def.role.toUpperCase(), { fontSize: '5px', color: '#887755' }).setOrigin(0.5);
      const statsT = this.add.text(x, y - 10, `HP:${def.hp}  DMG:${def.dmg}`, { fontSize: '5px', color: '#666666' }).setOrigin(0.5);
      const costT  = this.add.text(x, y + 14, already ? 'HIRED' : `${def.hireCost}g`, { fontSize: '7px', color: already ? '#44aaff' : (canHire ? '#ffdd44' : '#663333') }).setOrigin(0.5);
      if (canHire) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          const s = SaveManager.load();
          if (!s || s.gold < def.hireCost) return;
          s.gold -= def.hireCost;
          this.player.addGold(-def.hireCost);
          if (!s.companions) s.companions = [];
          s.companions.push({ id: def.id, name: def.name, role: def.role, currentHp: def.hp, maxHp: def.hp, potions: 3, fatigue: 0, affinity: 0, command: 'follow' });
          SaveManager.write(s);
          this.game.events.emit('hud-update', this.player);
          close();
          this.openGuildPanel('companions');
        });
      }
      container.add([bg, nameT, roleT, statsT, costT]);
    });

    if (active.length > 0) {
      container.add(this.add.text(0, contentY + 140, 'Active companions:', { fontSize: '6.5px', color: '#888888' }).setOrigin(0.5));
      active.forEach((comp, i) => {
        const dismissBtn = this.add.text(0, contentY + 154 + i * 18, `${comp.name} — [Dismiss]`, {
          fontSize: '6.5px', color: '#ff8888', backgroundColor: '#1a0000', padding: { x: 6, y: 2 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        dismissBtn.on('pointerdown', () => {
          const s = SaveManager.load();
          if (!s) return;
          s.companions = (s.companions ?? []).filter(x => x.id !== comp.id);
          SaveManager.write(s);
          close();
          this.openGuildPanel('companions');
        });
        container.add(dismissBtn);
      });
    }

    // Hardcore companion toggle
    const isHardcore = save.hardcoreCompanions ?? false;
    const toggleLabel = isHardcore ? 'Companion Mode: HARDCORE (death = permanent)' : 'Companion Mode: Normal (respawn between runs)';
    const toggleBtn = this.add.text(0, contentY + 204, toggleLabel, {
      fontSize: '6px', color: isHardcore ? '#ff6666' : '#66bbff', backgroundColor: '#111111', padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    toggleBtn.on('pointerdown', () => {
      const s = SaveManager.load();
      if (!s) return;
      s.hardcoreCompanions = !(s.hardcoreCompanions ?? false);
      SaveManager.write(s);
      close();
      this.openGuildPanel('companions');
    });
    container.add(toggleBtn);
  }

  private buildGuildBounties(container: Phaser.GameObjects.Container, save: ReturnType<typeof SaveManager.load>, contentY: number, pw: number, ph: number, close: () => void): void {
    if (!save) return;
    const meta = SaveManager.loadAccountMeta();
    const maxFloor = Math.max(0, ...meta.runHistory.map(r => r.floorReached), 0);
    const daily = getDailyBounties(maxFloor);

    // Ensure activeBounties is initialized for this set of dailies
    if (!save.activeBounties) save.activeBounties = [];
    for (const tpl of daily) {
      if (!save.activeBounties.some(b => b.id === tpl.id)) {
        save.activeBounties.push({ id: tpl.id, progress: 0, completed: false });
      }
    }

    container.add(this.add.text(0, contentY + 6, 'Daily Bounties  (resets each day)', { fontSize: '7px', color: '#aa9944' }).setOrigin(0.5));

    daily.forEach((tpl, i) => {
      const bounty = save.activeBounties!.find(b => b.id === tpl.id)!;
      const y = contentY + 30 + i * 52;
      const completed = bounty.completed;
      const progress  = Math.min(bounty.progress, tpl.count);
      const color     = completed ? '#44ff88' : '#ccccaa';

      container.add(this.add.text(-pw / 2 + 14, y, tpl.description, { fontSize: '8px', color }).setDepth(1));
      container.add(this.add.text(-pw / 2 + 14, y + 13, `Progress: ${progress}/${tpl.count}`, { fontSize: '7px', color: '#888866' }));
      const rewardStr = `${tpl.reward.gold}g${tpl.reward.mat ? ` + ${tpl.reward.matQty ?? 1}x ${ITEMS[tpl.reward.mat]?.name ?? tpl.reward.mat}` : ''}`;
      container.add(this.add.text(-pw / 2 + 14, y + 26, `Reward: ${rewardStr}`, { fontSize: '7px', color: '#aa8833' }));

      if (completed) {
        // Claim button — only if not yet claimed
        const claimedKey = `${tpl.id}_claimed_${new Date().toDateString()}`;
        const alreadyClaimed = !!save.enemyKillMap?.[claimedKey]; // reuse as a flag store
        if (!alreadyClaimed) {
          const claimBtn = this.add.text(pw / 2 - 14, y + 13, 'CLAIM', {
            fontSize: '8px', color: '#ffee44', backgroundColor: '#2a1a00', padding: { x: 6, y: 3 },
          }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
          claimBtn.on('pointerdown', () => {
            const s = SaveManager.load();
            if (!s) return;
            this.player.addGold(tpl.reward.gold);
            s.gold = this.player.gold;
            if (tpl.reward.mat) addToInventory(s.inventory, tpl.reward.mat, tpl.reward.matQty ?? 1);
            if (!s.enemyKillMap) s.enemyKillMap = {};
            s.enemyKillMap[claimedKey] = 1;
            SaveManager.write(s);
            this.game.events.emit('hud-update', this.player);
            close();
            this.openGuildPanel('bounties');
          });
          container.add(claimBtn);
        } else {
          container.add(this.add.text(pw / 2 - 14, y + 13, '✓ CLAIMED', { fontSize: '7px', color: '#336633' }).setOrigin(1, 0.5));
        }
      } else {
        container.add(this.add.text(pw / 2 - 14, y + 13, 'In progress', { fontSize: '7px', color: '#555544' }).setOrigin(1, 0.5));
      }

      if (i < daily.length - 1) {
        container.add(this.add.rectangle(0, y + 40, pw - 20, 1, 0x332200, 0.5));
      }
    });

    // Save the initialized bounties
    SaveManager.write(save);
  }

  private buildGuildGraveyard(container: Phaser.GameObjects.Container, contentY: number, pw: number, ph: number): void {
    const meta = SaveManager.loadAccountMeta();
    const history = [...meta.runHistory].reverse().slice(0, 6);
    const champions = meta.hallOfChampions;

    if (champions.length > 0) {
      container.add(this.add.text(0, contentY + 6, '🏆 HALL OF CHAMPIONS', { fontSize: '8px', color: '#ffd700' }).setOrigin(0.5));
      champions.slice(0, 2).forEach((r, i) => {
        const titleStr = r.title ? `[${r.title}] ` : '';
        container.add(this.add.text(0, contentY + 22 + i * 14,
          `Run #${r.runNumber}  ${titleStr}${r.name}  Floor ${r.floorReached}  ${r.goldEarned}g`,
          { fontSize: '7px', color: '#ccaa33' }).setOrigin(0.5));
      });
      container.add(this.add.rectangle(0, contentY + 50 + Math.min(2, champions.length) * 14, pw - 20, 1, 0x554400, 0.6));
    }

    const gravY = champions.length > 0 ? contentY + 60 + Math.min(2, champions.length) * 14 : contentY + 6;
    container.add(this.add.text(0, gravY, '⚰ FALLEN ADVENTURERS', { fontSize: '8px', color: '#886666' }).setOrigin(0.5));

    if (history.length === 0) {
      container.add(this.add.text(0, gravY + 18, 'No fallen heroes yet.', { fontSize: '8px', color: '#555555' }).setOrigin(0.5));
    } else {
      history.forEach((r, i) => {
        const mins = Math.floor(r.survivedMs / 60000);
        const y = gravY + 18 + i * 30;
        const titleStr = r.title ? `[${r.title}] ` : '';
        container.add(this.add.text(-pw / 2 + 14, y, `#${r.runNumber} ${titleStr}${r.name}  (${r.race}/${r.clazz})`, { fontSize: '7px', color: '#aa8888' }));
        container.add(this.add.text(-pw / 2 + 14, y + 12, `${r.causeOfDeath}  •  ${mins}m  •  ${r.goldEarned}g`, { fontSize: '6px', color: '#666655' }));
      });
    }

    if (meta.runHistory.length === 0 && meta.hallOfChampions.length === 0) {
      container.add(this.add.text(0, contentY + ph / 2 - 60, 'Enter the dungeon to write your legend.', { fontSize: '7px', color: '#444444' }).setOrigin(0.5));
    }
  }

  // ── Bestiary tab ──────────────────────────────────────────────────────────────
  private buildGuildBestiary(
    container: Phaser.GameObjects.Container,
    contentY: number,
    pw: number,
    ph: number,
  ): void {
    const meta = SaveManager.loadAccountMeta();
    // Only show enemies the player has at least encountered (kills > 0)
    const researched = ENEMY_DEFS
      .map(def => ({ def, entry: ResearchSystem.getEntry(meta, def.id) }))
      .filter(({ entry }) => entry.kills > 0)
      .sort((a, b) => b.entry.level - a.entry.level || b.entry.kills - a.entry.kills);

    if (researched.length === 0) {
      container.add(this.add.text(0, contentY + 40, 'No entries yet — venture into the dungeon.', {
        fontSize: '7px', color: '#555555',
      }).setOrigin(0.5));
      return;
    }

    container.add(this.add.text(0, contentY + 6, `BESTIARY  (${researched.length} entries)`, {
      fontSize: '8px', color: '#aaffdd',
    }).setOrigin(0.5));

    const visibleCount = 5;
    const page = this.bestiaryPage;
    const maxPage = Math.max(0, Math.ceil(researched.length / visibleCount) - 1);
    const pageResearched = researched.slice(page * visibleCount, page * visibleCount + visibleCount);

    const lvColor = ['#888888', '#aaaaff', '#55ffcc', '#ffd700'];
    const bodyY = contentY + 20;
    pageResearched.forEach(({ def, entry }, i) => {
      const y = bodyY + i * 40;
      const info = ResearchSystem.getBestiaryInfo(def, entry.level);
      const lv = entry.level;
      // Row background
      container.add(this.add.rectangle(-2, y + 15, pw - 20, 36, 0x111122, 0.85).setStrokeStyle(1, 0x333355));
      // Name + level badge
      container.add(this.add.text(-pw / 2 + 14, y + 4, def.name, { fontSize: '7px', color: lvColor[lv] }));
      container.add(this.add.text(pw / 2 - 14, y + 4, `Lv${lv}`, { fontSize: '7px', color: lvColor[lv] }).setOrigin(1, 0));
      // Progress
      container.add(this.add.text(-pw / 2 + 14, y + 14, ResearchSystem.progressLabel(entry), { fontSize: '5px', color: '#666688' }));
      // Stats at Lv1+
      if (info.showStats) {
        container.add(this.add.text(-pw / 2 + 14, y + 24, `HP ~${def.hp}  DMG ~${def.dmg}  ${def.archetype}  ${def.body ?? ''}`, { fontSize: '5px', color: '#aaaacc' }));
      }
      // Weakness at Lv2+
      const save = SaveManager.load();
      const wrongfooted = save?.wrongfooted ?? false;
      if (info.showWeakness && def.elemFamily && !wrongfooted) {
        const counter = def.counter ? `Counter: ${def.counter}` : `Family: ${def.elemFamily}`;
        container.add(this.add.text(-pw / 2 + 14, y + 32, counter, { fontSize: '5px', color: '#aaffaa', wordWrap: { width: pw - 30 } }));
      } else if (!info.showStats) {
        container.add(this.add.text(-pw / 2 + 14, y + 24, 'Kill 5× to reveal stats', { fontSize: '5px', color: '#444466' }));
      }
    });

    // Pagination
    const navY = contentY + 20 + visibleCount * 40 + 6;
    if (page > 0) {
      const prevBtn = this.add.text(-60, navY, '◀ Prev', { fontSize: '7px', color: '#aaaaff', backgroundColor: '#222233', padding: { x: 6, y: 3 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      prevBtn.on('pointerdown', () => {
        this.bestiaryPage = page - 1;
        container.destroy();
        this.openGuildPanel('bestiary');
      });
      container.add(prevBtn);
    }
    if (page < maxPage) {
      const nextBtn = this.add.text(60, navY, 'Next ▶', { fontSize: '7px', color: '#aaaaff', backgroundColor: '#222233', padding: { x: 6, y: 3 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      nextBtn.on('pointerdown', () => {
        this.bestiaryPage = page + 1;
        container.destroy();
        this.openGuildPanel('bestiary');
      });
      container.add(nextBtn);
    }
    container.add(this.add.text(0, navY, `${page + 1}/${maxPage + 1}`, { fontSize: '6px', color: '#555577' }).setOrigin(0.5));
  }

  private buildGuildInvestigation(container: Phaser.GameObjects.Container, contentY: number, pw: number, ph: number): void {
    container.add(this.add.text(0, contentY + 6, 'INVESTIGATION LOG (SUMMON CLUES)', {
      fontSize: '8px', color: '#aaffdd',
    }).setOrigin(0.5));

    const meta = SaveManager.loadAccountMeta();
    const clues = meta.discoveredClues ?? [];

    if (clues.length === 0) {
      container.add(this.add.text(0, contentY + 60, 'No clues discovered yet.\nExplore library rooms in the dungeon.', {
        fontSize: '7px', color: '#888899', align: 'center'
      }).setOrigin(0.5));
      return;
    }

    clues.forEach((clue, i) => {
      const y = contentY + 28 + i * 28;
      // Bordered card for each clue
      container.add(this.add.rectangle(0, y + 8, pw - 30, 24, 0x111122, 0.85).setStrokeStyle(1, 0x444466));
      container.add(this.add.text(-pw/2 + 22, y + 2, clue, {
        fontSize: '6px', color: '#ddccff', wordWrap: { width: pw - 50 }
      }));
    });
  }

  private showMonolithLore(): void {
    const lines = [
      '"Know this, traveler:',
      ' The dungeon is a living anomaly. When a hero dies within,',
      ' the dungeon resets reality to a moment before their entry.',
      ' A new soul wakes in town, yet the history of your past runs',
      ' remains written in the Guild\'s Graveyard."',
      '',
      '"Your failures literally populate the world. Choose your destiny."',
    ];

    const sw = this.scale.width, sh = this.scale.height;
    if (this.children.getByName('monolith_panel')) return;
    const c = this.add.container(sw / 2, sh * 0.65).setDepth(30).setName('monolith_panel').setScrollFactor(0);
    const pw = 300, ph = 80 + lines.length * 16;
    c.add(this.add.rectangle(0, 0, pw, ph, 0x07050d, 0.95).setStrokeStyle(1.5, 0x5a3aa3));
    c.add(this.add.text(0, -ph / 2 + 12, 'ANCIENT MONOLITH', { fontSize: '8px', color: '#8866cc' }).setOrigin(0.5));
    lines.forEach((line, i) => {
      c.add(this.add.text(0, -ph / 2 + 32 + i * 16, line, { fontSize: '7px', color: '#ccaaff', wordWrap: { width: pw - 20 }, align: 'center' }).setOrigin(0.5));
    });
    c.add(this.add.text(0, ph / 2 - 12, '[E or ESC] to dismiss', { fontSize: '6px', color: '#443366' }).setOrigin(0.5));

    const close = () => c.destroy();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') { close(); window.removeEventListener('keydown', handler); }
    };
    this.time.delayedCall(200, () => window.addEventListener('keydown', handler));
    c.once('destroy', () => window.removeEventListener('keydown', handler));
  }

  private addDecorations(): void {
    const wx = (c: number) => (c + 0.5) * TILE;
    const wy = (r: number) => (r + 0.5) * TILE;

    const block = (key: string, c: number, r: number, bodyW = 22, bodyH = 22, depth = 3) => {
      const img = this.physics.add.staticImage(wx(c), wy(r), key).setDepth(depth);
      (img.body as Phaser.Physics.Arcade.StaticBody).setSize(bodyW, bodyH);
      this.decorGroup.add(img);
      return img;
    };
    const deco = (key: string, c: number, r: number, depth = 2) => {
      this.add.image(wx(c), wy(r), key).setDepth(depth);
    };

    // ── Iron lampposts — only where they matter ──────────────────────────────────
    // Road junction
    deco('town_lamp', 31, 13, 4);
    // Guard post flanks
    for (const [c, r] of [[24, 36], [39, 36], [24, 41], [39, 41]]) deco('town_lamp', c as number, r as number, 4);
    // Dungeon approach — the torches marking the path into darkness
    for (const [c, r] of [[27, 34], [36, 34], [27, 38], [36, 38], [26, 43], [37, 43]]) {
      deco('town_lamp', c as number, r as number, 4);
    }
    // Chapel entrance
    deco('town_lamp', 3, 31, 4); deco('town_lamp', 11, 31, 4);

    // ── Gnarled trees — clustered in gaps, not scattered everywhere ───────────────
    // North alleys (armory↔inn, inn↔emporium)
    for (const [c, r] of [[13, 3], [14, 7], [49, 5], [50, 2], [49, 9]])
      block('town_tree', c as number, r as number, 24, 24);
    // Far edges
    block('town_tree', 0, 4, 24, 24); block('town_tree', 0, 8, 24, 24);
    block('town_tree', 63, 4, 24, 24); block('town_tree', 63, 8, 24, 24);
    // West side — sparse, foreboding
    block('town_tree', 0, 18, 24, 24); block('town_tree', 0, 24, 24, 24);
    // South-west approach
    block('town_tree', 1, 35, 24, 24); block('town_tree', 2, 42, 24, 24);
    // East park — dead zone near graveyard
    for (const [c, r] of [[52, 16], [58, 14], [63, 18], [55, 22], [61, 26]])
      block('town_tree', c as number, r as number, 24, 24);
    // Chapel tree line
    block('town_tree_pine', 2, 30, 20, 20); block('town_tree_pine', 12, 31, 20, 20);
    block('town_tree', 13, 37, 24, 24); block('town_tree', 14, 43, 24, 24);

    // ── Well (old stone, crumbling) ──────────────────────────────────────────────
    block('town_well', 7, 27, 20, 20);

    // ── Fountain — dark stone monument in the square ─────────────────────────────
    {
      const img = this.physics.add.staticImage(30 * TILE, 21 * TILE + TILE / 2, 'town_fountain').setDepth(3);
      (img.body as Phaser.Physics.Arcade.StaticBody).setSize(44, 44);
      this.decorGroup.add(img);
    }

    // §25 Ancient Monolith near central fountain
    block('town_shrine', 30, 25, 24, 24, 3);

    // ── Guards — stoic, armored, unsmiling ───────────────────────────────────────
    this.add.image(wx(25), wy(37.5), 'npc_guard').setDepth(5);
    this.add.image(wx(38), wy(37.5), 'npc_guard').setDepth(5).setFlipX(true);

    // ── Notice board (warnings about the dungeon) ────────────────────────────────
    block('town_notice', 23, 37, 24, 28);

    // ── Weathered barrels — only at building entrances ───────────────────────────
    block('town_barrel', 9, 12, 18, 18); block('town_crate', 10, 12, 20, 20);
    block('town_barrel', 55, 12, 18, 18); block('town_crate', 54, 12, 20, 20);
    block('town_barrel', 46, 38, 18, 18); block('town_barrel', 17, 38, 18, 18);

    // ── Graveyard — east park ────────────────────────────────────────────────────
    for (const [c, r] of [[52, 32], [55, 34], [52, 37], [58, 33], [56, 38]])
      deco('deco_d_grave', c as number, r as number, 4);
    deco('deco_d_deadtree', 50, 34, 3);
    deco('deco_d_deadtree', 60, 37, 3);
    deco('deco_d_deadtree', 62, 25, 3);

    // ── Chapel shrine ─────────────────────────────────────────────────────────────
    block('town_shrine', 6, 31, 24, 24, 4);

    // ── A single dark bench in the square — the only resting place ───────────────
    deco('town_bench', 28, 22, 3); deco('town_bench', 33, 22, 3);

    // ── Wandering Stall — market lane, east side ─────────────────────────────────
    this.add.image(wx(42), wy(27), 'town_barrel').setDepth(3).setTint(0x886622);
    this.add.text(wx(42), wy(26.2), '?  STALL', { fontSize: '6px', color: '#886622' }).setOrigin(0.5).setDepth(5);

    // ── Building labels — small, worn, no icons ──────────────────────────────────
    this.add.text(wx(5.5),  wy(0.5),  'ARMORY',         { fontSize: '7px', color: '#5a4a30' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(31),   wy(0.5),  'THE LAST INN',   { fontSize: '7px', color: '#5a4a30' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(56.5), wy(0.5),  'EMPORIUM',       { fontSize: '7px', color: '#5a4a30' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(6),    wy(31.6), 'CHAPEL',            { fontSize: '7px', color: '#3a3344' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(56.5), wy(15.4), "SAGE'S TOWER",      { fontSize: '7px', color: '#7733aa' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(56.5), wy(31.4), "ADVENTURER'S GUILD", { fontSize: '6px', color: '#886622' }).setOrigin(0.5).setDepth(5);
    // Town name — faded
    this.add.text(wx(31.5), wy(-0.5), 'NIGHTFALL', { fontSize: '10px', color: '#443355' }).setOrigin(0.5).setDepth(5);
    // Dungeon gate inscriptions
    this.add.text(wx(31.5), wy(39.4), 'DUNGEON GATE', { fontSize: '7px', color: '#3a2244' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(40.5), wy(37),   'ABANDON\nALL HOPE', { fontSize: '6px', color: '#4a1818', align: 'center' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(24.5), wy(41.5), '☠', { fontSize: '12px', color: '#3a1a22' }).setOrigin(0.5).setDepth(5);
    this.add.text(wx(38.5), wy(41.5), '☠', { fontSize: '12px', color: '#3a1a22' }).setOrigin(0.5).setDepth(5);

    // §12 Sage's Tower — crystal and rune decorations
    for (const col of [52, 55, 58, 61]) deco('deco_crystal_b', col, 16, 4);
    for (const [rc, rr] of [[54, 20], [58, 24], [56, 18]]) {
      const rune = this.add.image(wx(rc as number), wy(rr as number), 'deco_rune').setDepth(2).setAlpha(0.5);
      this.tweens.add({ targets: rune, alpha: { from: 0.2, to: 0.7 }, duration: 1400 + Math.random() * 800, yoyo: true, repeat: -1 });
    }
  }

  // ── Town map (64 × 52 tiles) ──────────────────────────────────────────────────
  private buildTownMap(): number[][] {
    const R = MAP_ROWS, C = MAP_COLS;
    const map: number[][] = Array.from({ length: R }, () => new Array(C).fill(G));

    const fill = (c1: number, r1: number, c2: number, r2: number, t: number) => {
      for (let r = Math.max(0, r1); r <= Math.min(R-1, r2); r++)
        for (let c = Math.max(0, c1); c <= Math.min(C-1, c2); c++) map[r][c] = t;
    };
    const set = (c: number, r: number, t: number) => {
      if (r >= 0 && r < R && c >= 0 && c < C) map[r][c] = t;
    };

    // ── ROAD NETWORK ─────────────────────────────────────────────────────────────
    fill(0,  11, C-1, 11, P);   // north sidewalk strip (in front of shops)
    fill(0,  12, C-1, 13, P);   // main east-west road (2 wide)
    fill(0,  14, C-1, 14, P);   // south sidewalk strip of main road
    fill(0,  30, C-1, 31, P);   // south connecting road
    fill(29,  0, 31, R-1, P);   // north-south central spine (3 wide)
    fill(0,  22, 12,  23, P);   // path to small house / stables

    // Alley between armory and inn
    fill(12, 1, 12, 10, P);
    // Alley between inn and emporium
    fill(49, 1, 49, 10, P);

    // ── WEAPON SHOP / ARMORY (NW): cols 1–11, rows 1–11 ─────────────────────────
    fill(1,  1, 11, 11, W);
    fill(2,  2, 10, 10, I);
    // Internal wall division (creates 2 visible rooms: forge + shop floor)
    fill(2,  6, 6,  6,  W);     // internal divider creating forge room
    set(5,   6, I);              // gap in divider
    // Door opening (south wall)
    set(5, 11, G); set(6, 11, G);
    fill(5, 11, 6, 11, P);
    // Window hints on outer walls
    set(3, 3, P); set(3, 7, P); set(9, 3, P); set(9, 7, P);
    // Chimneys (dark spots on roof)
    set(2, 2, V); set(9, 2, V);

    // ── INN (grand center-north): cols 14–48, rows 1–11 ──────────────────────────
    fill(13, 1, 48, 11, W);
    fill(14, 2, 47, 10, I);
    // Internal courtyard / garden at center (more realistic inn with yard)
    fill(28, 3, 34, 9, P);      // visible cobblestone courtyard inside inn
    // Chimney columns inside inn
    fill(15, 2, 15, 5, W); fill(46, 2, 46, 5, W);
    // Double door (centered on spine)
    set(30, 11, G); set(31, 11, G);
    fill(30, 11, 31, 11, P);
    // Multiple window accents
    for (const wc of [16, 20, 24, 36, 40, 44, 47]) { set(wc, 3, P); set(wc, 8, P); }
    // East/West wing visible separation
    fill(26, 2, 26, 10, W); fill(36, 2, 36, 10, W); // wing divider walls

    // ── EMPORIUM (NE): cols 50–63, rows 1–11 ────────────────────────────────────
    fill(50, 1, 63, 11, W);
    fill(51, 2, 62, 10, I);
    // Bay window display area (protruding shelf visible from outside)
    fill(53, 2, 60, 4, I);
    // Chimney
    set(62, 2, V);
    set(57, 11, G); set(58, 11, G);
    fill(57, 11, 58, 11, P);
    set(52, 4, P); set(52, 7, P); set(61, 4, P); set(61, 7, P);

    // ── SMALL HOUSE (stables area, west): cols 1–9, rows 15–23 ──────────────────
    fill(1, 15, 9, 23, W);
    fill(2, 16, 8, 22, I);
    set(4, 23, G); set(5, 23, G);
    fill(4, 23, 5, 23, P);
    set(3, 18, P); set(7, 18, P);
    // Stable doors (wider opening)
    set(2, 20, I); set(9, 20, P); // side window/door

    // ── GARDEN FENCE (west, rows 25–29) ─────────────────────────────────────────
    fill(1,  25, 11, 29, W);
    fill(2,  26, 10, 28, G);
    set(5, 25, G); set(6, 25, G);

    // ── TOWN SQUARE (center, cols 11–51, rows 15–29) ─────────────────────────────
    fill(11, 15, 51, 29, P);
    // Central fountain plaza (distinct paving)
    fill(25, 18, 37, 26, P);
    // Market lane at south of square
    fill(11, 27, 51, 29, P);
    // Corner plazas
    fill(11, 15, 14, 18, P); fill(48, 15, 51, 18, P);
    fill(11, 26, 14, 29, P); fill(48, 26, 51, 29, P);

    // ── GUARD POST WEST: cols 16–24, rows 33–41 ──────────────────────────────────
    fill(16, 33, 24, 41, W);
    fill(17, 34, 23, 40, I);
    // Watchtower corner
    fill(16, 33, 18, 35, W); set(17, 33, V); // tower corner visible
    set(24, 37, G); set(24, 38, G);
    set(25, 37, P); set(25, 38, P);

    // ── GUARD POST EAST: cols 39–47, rows 33–41 ──────────────────────────────────
    fill(39, 33, 47, 41, W);
    fill(40, 34, 46, 40, I);
    fill(45, 33, 47, 35, W); set(46, 33, V); // tower corner
    set(39, 37, G); set(39, 38, G);
    set(38, 37, P); set(38, 38, P);

    // ── DUNGEON APPROACH — dramatic grand avenue ──────────────────────────────────
    fill(26, 30, 37, 44, P);    // wide cobblestone avenue (12 tiles)
    // Dark atmospheric tiles near the gate (void creeping up)
    fill(27, 40, 36, 42, V);    // shadow spreading from gate base
    fill(28, 43, 35, 44, V);

    // ── DUNGEON GATE COMPLEX (cols 22–41, rows 41–51) ────────────────────────────
    fill(22, 41, 41, 51, W);              // fortress outer walls (wider)
    fill(23, 42, 40, 50, P);             // dungeon-stone floor inside
    // Fortress towers at corners
    fill(22, 41, 24, 44, W); fill(39, 41, 41, 44, W); // NW & NE towers
    fill(22, 47, 24, 51, W); fill(39, 47, 41, 51, W); // SW & SE towers
    // Entrance archway
    for (const c of [28, 29, 30, 31, 32, 33]) set(c, 41, G);
    fill(28, 41, 33, 42, P);
    // Inner void floors (darkness of the dungeon)
    fill(25, 44, 38, 49, V);
    // Portal tiles (deepest point)
    fill(27, 47, 35, 50, 5);
    // Return path
    fill(28, 43, 33, 44, F);
    // Side archways within fortress
    set(22, 45, F); set(22, 46, F); // west side passage
    set(41, 45, F); set(41, 46, F); // east side passage

    // ── CHAPEL (west side, cols 1–12, rows 32–45) ────────────────────────────────
    fill(1,  32, 12, 45, W);
    fill(2,  33, 11, 44, I);
    // Chapel apse (rounded north end — simulate with W tiles)
    fill(3, 33, 10, 35, W); fill(4, 33, 9, 34, I); // inner sanctuary
    // Nave aisle (center visible)
    fill(6, 35, 7, 44, I);
    // Pew rows (slight tile difference for depth)
    for (let r = 36; r <= 43; r += 2) {
      set(3, r, P); set(4, r, P); // left pews
      set(9, r, P); set(10, r, P); // right pews
    }
    // Door (south face)
    set(6, 45, G); set(7, 45, G);
    fill(6, 44, 7, 45, P);
    // Windows
    set(2, 36, P); set(2, 40, P); set(11, 36, P); set(11, 40, P);
    // Steeple hint at top
    set(6, 32, I); set(7, 32, I);

    return map;
  }
}
