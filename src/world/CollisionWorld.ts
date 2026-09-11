import { Box3, Vector3 } from 'three';
export class CollisionWorld {
  readonly boxes: Box3[] = [];
  add(x: number, y: number, z: number, w: number, h: number, d: number) {
    this.boxes.push(new Box3(new Vector3(x-w/2,y-h/2,z-d/2), new Vector3(x+w/2,y+h/2,z+d/2)));
  }
  // Player position is at the feet. Axis sweeps are split into < radius steps, including dash.
  move(position: Vector3, velocity: Vector3, delta: number, radius = 0.32, height = 1.75) {
    const steps = Math.max(1, Math.ceil(velocity.length() * delta / (radius * 0.5)));
    const dt = delta / steps;
    let grounded = false;
    for (let step = 0; step < steps; step++) {
      for (const axis of ['x','z','y'] as const) {
        const amount = velocity[axis] * dt;
        if (amount === 0) continue;
        position[axis] += amount;
        for (const box of this.boxes) {
          if (position.x + radius <= box.min.x || position.x - radius >= box.max.x ||
              position.z + radius <= box.min.z || position.z - radius >= box.max.z ||
              position.y + height <= box.min.y || position.y >= box.max.y) continue;
          if (axis === 'y') {
            position.y = amount > 0 ? box.min.y - height : box.max.y;
            if (amount < 0) grounded = true;
          } else position[axis] = amount > 0 ? box.min[axis] - radius : box.max[axis] + radius;
          velocity[axis] = 0;
        }
      }
    }
    return grounded;
  }
}
