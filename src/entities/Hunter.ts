import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { EnemyDef } from '../data/enemies';
import { SaveManager } from '../systems/SaveManager';
import { Player } from './Player';
import { TILE } from '../config';

export class Hunter extends Enemy {
  private lastDodgeMs = 0;
  private potionCharges = 2;

  constructor(scene: Phaser.Scene, x: number, y: number, def: EnemyDef) {
    // Escalate stats based on previous defeats
    const save = SaveManager.load();
    const escalation = save?.hunterState?.escalation ?? 0;
    
    // Scale stats based on escalation factor
    const scaledDef = {
      ...def,
      hp: def.hp + escalation * 200,
      dmg: def.dmg + escalation * 5
    };
    
    super(scene, x, y, scaledDef);
    this.eliteBaseTint = 0xcc2222;
    this.setTint(0xcc2222);

    // Increment encounter count in save
    if (save) {
      if (!save.hunterState) {
        save.hunterState = { encounters: 0, defeats: 0, escalation: 0 };
      }
      save.hunterState.encounters++;
      SaveManager.write(save);
    }
  }

  takeDamage(amount: number, fromX?: number, fromY?: number, poiseDmg = 0, element?: string): void {
    const time = this.scene.time.now;
    
    // 20% chance to dodge damage (cooldown 2000ms)
    if (time - this.lastDodgeMs > 2000 && Math.random() < 0.20) {
      this.lastDodgeMs = time;
      this.scene.events.emit('hunter-dodge');
      
      // Floating text indicators
      if ((this.scene as any).floatText) {
        (this.scene as any).floatText('DODGED!', this.x, this.y - 20, '#ff5555');
      }

      // Dodge velocity kick away from player
      if (fromX !== undefined && fromY !== undefined) {
        const angle = Math.atan2(this.y - fromY, this.x - fromX);
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(
          Math.cos(angle) * 200,
          Math.sin(angle) * 200
        );
      }
      return;
    }

    super.takeDamage(amount, fromX, fromY, poiseDmg, element);

    // Check potion usage if health gets low
    const hpPct = (this as any).hp / (this as any).maxHp;
    if (hpPct < 0.40 && this.potionCharges > 0) {
      this.potionCharges--;
      
      // Heal 30% of max HP
      const healAmt = Math.round((this as any).maxHp * 0.30);
      (this as any).hp = Math.min((this as any).maxHp, (this as any).hp + healAmt);
      
      // Play a heal effect
      if ((this.scene as any).floatText) {
        (this.scene as any).floatText('HEALED! +30%', this.x, this.y - 20, '#55ff55');
      }
      this.scene.cameras.main.flash(200, 0, 180, 0, true);
    }
  }
}
