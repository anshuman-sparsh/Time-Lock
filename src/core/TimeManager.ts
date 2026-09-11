import { settings } from '../config';
export interface Activity { input: number; speed: number; angularSpeed: number; airborne: boolean }
export class TimeManager {
  realDelta = 0;
  worldDelta = 0;
  worldElapsed = 0;
  scale = settings.minimumTimeScale;
  target = settings.minimumTimeScale;
  activity = 0;
  private bursts: { remaining: number; strength: number }[] = [];
  reset() {
    this.realDelta = this.worldDelta = this.worldElapsed = this.activity = 0;
    this.scale = this.target = settings.minimumTimeScale; this.bursts.length = 0;
  }
  get state() { return this.bursts.length ? 'ACTION BURST' : this.scale < 0.065 ? 'LOCKED' : 'FLOWING'; }
  requestActivityBurst(duration = 0.2, strength = 1) {
    if (Number.isFinite(duration) && Number.isFinite(strength) && duration > 0)
      this.bursts.push({ remaining: Math.min(duration, 10), strength: Math.max(0, Math.min(strength, 1)) });
  }
  update(delta: number, activity: Activity) {
    this.realDelta = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.05));
    const movement = Math.max(activity.input, activity.speed / settings.movementSpeed) * settings.movementActivityInfluence;
    const camera = Math.max(0, activity.angularSpeed - 0.18) / 2.5 * settings.cameraActivityInfluence;
    const burst = this.bursts.reduce((value, item) => Math.max(value, item.strength), 0);
    this.activity = Math.max(0, Math.min(1, Math.max(movement, camera, burst, activity.airborne ? 0.8 : 0)));
    this.target = settings.minimumTimeScale + (settings.maximumTimeScale - settings.minimumTimeScale) * this.activity;
    const response = this.target > this.scale ? settings.timeWakeSpeed : settings.timeSleepSpeed;
    this.scale += (this.target - this.scale) * (1 - Math.exp(-response * this.realDelta));
    this.worldDelta = this.realDelta * this.scale;
    this.worldElapsed += this.worldDelta;
    for (const item of this.bursts) item.remaining -= this.realDelta;
    this.bursts = this.bursts.filter(item => item.remaining > 0);
  }
}
