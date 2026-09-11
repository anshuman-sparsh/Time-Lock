import type { Box3, Vector3 } from 'three';

// Slab intersection returns distance along a normalized ray; supports an origin inside a box.
export function rayBoxDistance(origin: Vector3, direction: Vector3, box: Box3, maximum: number, padding = 0) {
  let near = 0, far = maximum;
  for (const axis of ['x', 'y', 'z'] as const) {
    const low = box.min[axis] - padding, high = box.max[axis] + padding;
    if (Math.abs(direction[axis]) < 1e-10) {
      if (origin[axis] < low || origin[axis] > high) return Infinity;
      continue;
    }
    let a = (low - origin[axis]) / direction[axis], b = (high - origin[axis]) / direction[axis];
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a); far = Math.min(far, b);
    if (near > far) return Infinity;
  }
  return near;
}

export function nearestWall(origin: Vector3, direction: Vector3, maximum: number, boxes: readonly Box3[], padding = 0) {
  let distance = Infinity;
  for (const box of boxes) distance = Math.min(distance, rayBoxDistance(origin, direction, box, maximum, padding));
  return distance;
}
