import { Box3, Vector3 } from 'three';
import { combatSettings as config } from './config';
import { nearestWall, rayBoxDistance } from './geometry';

export interface ProjectileOptions { speed?: number; damage?: number; radius?: number; color?: number }
export interface Projectile {
  active: boolean; position: Vector3; direction: Vector3; age: number; nearMiss: boolean;
  speed: number; damage: number; radius: number; color: number;
}
export class ProjectilePool {
  readonly items: Projectile[] = Array.from({ length: config.projectileCapacity }, () => ({
    active: false, position: new Vector3(), direction: new Vector3(), age: 0, nearMiss: false,
    speed: config.projectileSpeed, damage: config.projectileDamage, radius: config.projectileRadius, color: 0xff345b,
  }));
  private readonly playerBox = new Box3(new Vector3(-0.32, 0, -0.32), new Vector3(0.32, 1.75, 0.32));
  private readonly relativeStart = new Vector3();
  private readonly relativeTravel = new Vector3();
  private readonly displacement = new Vector3();
  private readonly closest = new Vector3();
  get count() { return this.items.reduce((sum, item) => sum + Number(item.active), 0); }
  spawn(origin: Vector3, direction: Vector3, options: ProjectileOptions = {}) {
    const item = this.items.find(projectile => !projectile.active);
    if (!item) return false;
    item.active = true; item.position.copy(origin); item.direction.copy(direction).normalize();
    item.age = 0; item.nearMiss = false;
    item.speed = options.speed ?? config.projectileSpeed; item.damage = options.damage ?? config.projectileDamage;
    item.radius = options.radius ?? config.projectileRadius; item.color = options.color ?? 0xff345b;
    return true;
  }
  reset() { for (const item of this.items) { item.active = false; item.age = 0; item.nearMiss = false; } }
  update(worldDelta: number, previousFeet: Vector3, currentFeet: Vector3, walls: readonly Box3[], onHit: (damage: number) => void, onImpact: (position: Vector3) => void, onNearMiss: () => void) {
    this.displacement.copy(currentFeet).sub(previousFeet);
    for (const item of this.items) {
      if (!item.active) continue;
      item.age += worldDelta;
      if (item.age > config.projectileLifetime) { item.active = false; continue; }
      const travel = item.speed * worldDelta;
      const wallDistance = nearestWall(item.position, item.direction, travel, walls, item.radius);
      const wallFraction = wallDistance === Infinity ? Infinity : travel > 0 ? wallDistance / travel : 0;
      // Relative sweep also catches a real-time dash through a nearly stationary world bullet.
      this.relativeStart.copy(item.position).sub(previousFeet);
      this.relativeTravel.copy(item.direction).multiplyScalar(travel).sub(this.displacement);
      const relativeLength = this.relativeTravel.length();
      this.relativeTravel.normalize();
      const hitDistance = rayBoxDistance(this.relativeStart, this.relativeTravel, this.playerBox, relativeLength, item.radius);
      const hitFraction = hitDistance === Infinity ? Infinity : relativeLength > 0 ? hitDistance / relativeLength : 0;
      if (hitFraction < wallFraction && hitFraction <= 1) {
        item.position.addScaledVector(item.direction, travel * hitFraction);
        item.active = false; onHit(item.damage);
      } else if (wallFraction <= 1) {
        item.position.addScaledVector(item.direction, wallDistance); item.active = false; onImpact(item.position);
      } else {
        if (!item.nearMiss) {
          this.closest.copy(this.relativeStart); this.closest.y -= 1.6;
          const t = Math.max(0, Math.min(relativeLength, -this.closest.dot(this.relativeTravel)));
          this.closest.addScaledVector(this.relativeTravel, t);
          if (this.closest.lengthSq() < config.nearMissRadius ** 2) { item.nearMiss = true; onNearMiss(); }
        }
        item.position.addScaledVector(item.direction, travel);
      }
    }
  }
}
