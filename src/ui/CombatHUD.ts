import type { Encounter } from '../combat/Encounter';
import type { CombatView } from '../combat/CombatView';

export class CombatHUD {
  private readonly hp = document.getElementById('hp')!;
  private readonly healthFill = document.getElementById('health-fill')!;
  private readonly ammo = document.getElementById('ammo')!;
  private readonly weaponState = document.getElementById('weapon-state')!;
  private readonly room = document.getElementById('room-state')!;
  private readonly damage = document.getElementById('damage-overlay')!;
  private readonly crosshair = document.getElementById('crosshair')!;
  private readonly marker = document.getElementById('hit-marker')!;
  private readonly overlay = document.getElementById('overlay')!;
  private readonly title = document.getElementById('intro-title')!;
  private readonly description = document.getElementById('intro-description')!;
  private readonly button = document.getElementById('enter')!;
  private readonly message = document.getElementById('message')!;
  private terminalShown = false;
  constructor(private encounter: Encounter) {}
  reset() {
    this.terminalShown = false;
    this.title.innerHTML = 'FIRST CONTACT.<br><em>MAKE EVERY SECOND COUNT.</em>';
    this.description.innerHTML = 'Two hostiles. One room. Your time.<br>Stop to read the shots. Move to dodge. Fire to wake the world.';
    this.button.innerHTML = 'ENTER COMBAT <span>↗</span>';
    this.message.textContent = 'Click to capture your mouse. Escape releases it.';
  }
  lockChanged(locked: boolean) {
    this.overlay.hidden = locked;
    if (!locked && this.encounter.state === 'ACTIVE') this.button.innerHTML = 'RESUME COMBAT <span>↗</span>';
  }
  update(view: CombatView) {
    const encounter = this.encounter;
    this.hp.textContent = String(encounter.health.current);
    this.healthFill.style.transform = `scaleX(${encounter.health.current / encounter.health.maximum})`;
    this.ammo.textContent = String(encounter.weapon.ammo).padStart(2, '0');
    this.weaponState.textContent = encounter.weapon.state === 'RELOADING' ? `RELOADING ${encounter.weapon.reloadRemaining.toFixed(1)}s` : encounter.weapon.state === 'EMPTY' ? 'EMPTY · R TO RELOAD' : (encounter.activeWeapon===1?'1 · PULSE PISTOL':'2 · SCATTERGUN')+' · R RELOAD';
    this.room.textContent = encounter.state === 'CLEARED' ? 'ROOM CLEARED' : encounter.state === 'DEAD' ? 'SIGNAL LOST' : `FIRST CONTACT / ${encounter.remaining} HOSTILES`;
    const low = encounter.health.current <= 25 && encounter.health.alive;
    this.hp.classList.toggle('critical', low);
    this.damage.style.opacity = String(Math.max(view.damageFlash * 0.8, low ? 0.19 : 0));
    this.crosshair.style.width = this.crosshair.style.height = `${14 + view.recoil * 12}px`;
    this.crosshair.style.borderColor = view.nearMiss > 0.05 ? '#ffb5a1' : '';
    this.marker.style.opacity = view.hitMarker > 0 ? '1' : '0';
    this.marker.style.color = view.headshot ? '#ffc778' : '#f0fff8';
    this.marker.textContent = view.headshot ? '× HEAD' : '×';

  }
}
