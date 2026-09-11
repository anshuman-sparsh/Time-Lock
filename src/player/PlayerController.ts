import { Vector3 } from 'three';
import { settings } from '../config';
import type { CollisionWorld } from '../world/CollisionWorld';
export interface PlayerInput { x: number; z: number; jump: boolean; dash: boolean }
export class PlayerController {
  readonly position = new Vector3(0, 0, 9);
  readonly velocity = new Vector3();
  private readonly direction = new Vector3();
  private readonly dashDirection = new Vector3();
  yaw = 0; pitch = 0; grounded = true; cooldown = 0; dashRemaining = 0;
  landing = 0;
  constructor(private collision: CollisionWorld, private onAction: (action: 'jump' | 'dash') => void) {}
  reset() {
    this.position.set(0, 0, 9); this.velocity.set(0, 0, 0);
    this.direction.set(0, 0, 0); this.dashDirection.set(0, 0, 0);
    this.yaw = this.pitch = this.cooldown = this.dashRemaining = this.landing = 0;
    this.grounded = true;
  }
  look(dx: number, dy: number) {
    this.yaw -= dx * settings.mouseSensitivity;
    this.pitch = Math.max(-Math.PI/2 + 0.02, Math.min(Math.PI/2 - 0.02, this.pitch - dy * settings.mouseSensitivity));
  }
  update(dt: number, input: PlayerInput) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.landing *= Math.exp(-16 * dt);
    this.direction.set(input.x, 0, input.z);
    if (this.direction.lengthSq() > 1) this.direction.normalize();
    const localX = this.direction.x, localZ = this.direction.z;
    this.direction.set(localX * Math.cos(this.yaw) + localZ * Math.sin(this.yaw), 0, localZ * Math.cos(this.yaw) - localX * Math.sin(this.yaw));
    if (input.jump && this.grounded) { this.velocity.y = settings.jumpStrength; this.grounded = false; this.onAction('jump'); }
    if (input.dash && this.cooldown <= 0) {
      this.dashDirection.copy(this.direction);
      if (this.dashDirection.lengthSq() === 0) this.dashDirection.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.dashDirection.normalize(); this.dashRemaining = settings.dashDuration; this.cooldown = settings.dashCooldown;
      this.onAction('dash');
    }
    const steps = Math.max(1, Math.ceil(dt / (1/120)));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      const dashing = this.dashRemaining > 0;
      this.dashRemaining = Math.max(0, this.dashRemaining - step);
      if (dashing) {
        this.velocity.x = this.dashDirection.x * settings.dashStrength;
        this.velocity.z = this.dashDirection.z * settings.dashStrength;
      } else {
        const acceleration = (this.direction.lengthSq() ? settings.acceleration : settings.deceleration) * (this.grounded ? 1 : settings.airControl);
        const targetX = this.direction.x * settings.movementSpeed, targetZ = this.direction.z * settings.movementSpeed;
        const dx = targetX - this.velocity.x, dz = targetZ - this.velocity.z;
        const length = Math.hypot(dx, dz), change = Math.min(1, acceleration * step / (length || 1));
        this.velocity.x += dx * change; this.velocity.z += dz * change;
      }
      this.velocity.y -= settings.gravity * step;
      const verticalSpeed = this.velocity.y;
      const wasGrounded = this.grounded;
      this.grounded = this.collision.move(this.position, this.velocity, step);
      if (this.grounded && !wasGrounded) this.landing = Math.min(0.075, Math.abs(verticalSpeed) * 0.006);
      if (dashing && this.dashRemaining === 0) {
        const speed = Math.hypot(this.velocity.x, this.velocity.z);
        if (speed > settings.movementSpeed) { this.velocity.x *= settings.movementSpeed / speed; this.velocity.z *= settings.movementSpeed / speed; }
      }
    }
    if (this.position.y < -20) { this.position.set(0, 0, 9); this.velocity.set(0,0,0); this.dashRemaining = 0; }
  }
}
