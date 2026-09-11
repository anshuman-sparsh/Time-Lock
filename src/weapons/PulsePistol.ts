import { combatSettings as config } from '../combat/config';

export class PulsePistol {
  ammo: number;
  constructor(readonly magazine = config.magazine, readonly reloadDuration = config.reloadDuration, readonly fireDelay = config.fireDelay) { this.ammo = magazine; }
  cooldown = 0;
  reloadRemaining = 0;
  get state() { return this.reloadRemaining > 0 ? 'RELOADING' : this.ammo === 0 ? 'EMPTY' : 'READY'; }
  update(realDelta: number) {
    this.cooldown = Math.max(0, this.cooldown - realDelta);
    if (this.reloadRemaining > 0) {
      this.reloadRemaining = Math.max(0, this.reloadRemaining - realDelta);
      if (this.reloadRemaining === 0) this.ammo = this.magazine;
    }
  }
  fire() {
    if (this.cooldown > 0 || this.reloadRemaining > 0 || this.ammo === 0) return false;
    this.ammo--; this.cooldown = this.fireDelay;
    return true;
  }
  reload() {
    if (this.reloadRemaining > 0 || this.ammo === this.magazine) return false;
    this.reloadRemaining = this.reloadDuration;
    return true;
  }
  reset() { this.ammo = this.magazine; this.cooldown = this.reloadRemaining = 0; }
}
